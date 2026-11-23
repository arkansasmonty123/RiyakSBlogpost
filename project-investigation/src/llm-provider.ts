/**
 * Shared, bounded LLM configuration and chat-completion helper.
 *
 * Extracted from server.ts so the M7 discovery service can use the same
 * provider configuration without duplicating environment handling. Nothing in
 * this module reads canonical truth, evidence or hidden case data: callers
 * supply fully sanitised prompts.
 *
 * Hard invariant for M7/M8: this helper is OPTIONAL. A disabled provider, a
 * timeout, a malformed/invalid response, or any failure returns null so the
 * caller can use its deterministic fallback. Model output can never authorise
 * acceptance, evidence release, verdicts or case-state transitions.
 *
 * M8-5 additions (all additive): env-configurable bounds, safe structured
 * cost/latency instrumentation, output guardrails, and a single optional
 * one-shot provider failover. No LLM call is made for deterministic-only
 * operations (USE_LLM=false returns immediately without network I/O).
 */

import {
  estimateApproxTokens,
  logLlmCall,
  resolveLlmBounds,
  safeEndpointForLog,
  validateLlmOutput,
  type LlmBoundsDefaults,
} from './llm-guardrails';

export type LlmProvider = 'local' | 'openai' | 'gemini';

export interface LlmEndpoint {
  url: string;
  model: string;
  apiKey: string;
  provider: LlmProvider;
}

export interface LlmConfig extends LlmEndpoint {
  enabled: boolean;
  bounds: ReturnType<typeof resolveLlmBounds>;
  /** Present only when an explicit failover endpoint is configured. */
  failover: LlmEndpoint | null;
}

function normalizeProvider(value: string): LlmProvider {
  const p = value.toLowerCase();
  return p === 'gemini' || p === 'openai' || p === 'local' ? p : 'local';
}

function defaultUrlFor(provider: LlmProvider): string {
  return provider === 'gemini'
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    : 'http://127.0.0.1:8080/v1/chat/completions';
}

function defaultModelFor(provider: LlmProvider): string {
  return provider === 'gemini' ? 'gemini-2.0-flash' : 'qwen2.5-1.5b-instruct';
}

export function resolveLlmConfig(): LlmConfig {
  const enabled = process.env.USE_LLM !== 'false';
  const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const explicitProvider = (process.env.LLM_PROVIDER || '').toLowerCase();
  const provider: LlmProvider =
    explicitProvider === 'gemini' ? 'gemini' :
    explicitProvider === 'openai' ? 'openai' :
    explicitProvider === 'local' ? 'local' :
    apiKey && !process.env.LLM_URL ? 'gemini' : 'local';

  const primary: LlmEndpoint = {
    url: process.env.LLM_URL || defaultUrlFor(provider),
    model: process.env.LLM_MODEL || defaultModelFor(provider),
    apiKey,
    provider,
  };

  // Optional failover: activated only when explicitly configured. One extra
  // attempt is made when the primary fails or times out; no retry loops.
  const failoverUrl = (process.env.LLM_FAILOVER_URL || '').trim();
  const failoverProviderEnv = (process.env.LLM_FAILOVER_PROVIDER || '').trim();
  let failover: LlmEndpoint | null = null;
  if (failoverUrl || failoverProviderEnv) {
    const failoverProvider = failoverProviderEnv ? normalizeProvider(failoverProviderEnv) : provider;
    failover = {
      url: failoverUrl || defaultUrlFor(failoverProvider),
      model: process.env.LLM_FAILOVER_MODEL || defaultModelFor(failoverProvider),
      apiKey: process.env.LLM_FAILOVER_API_KEY || apiKey || '',
      provider: failoverProvider,
    };
  }

  return {
    ...primary,
    enabled,
    bounds: resolveLlmBounds(),
    failover,
  };
}

export interface ChatCompletionOptions extends LlmBoundsDefaults {}

interface CompletionRequest {
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
}

type CompletionAttempt =
  | { ok: true; content: string | null }
  | { ok: false; timedOut: boolean; status: number | null; error: string | null };

/** A single bounded POST to one endpoint. Never throws to the caller. */
async function postCompletion(
  endpoint: LlmEndpoint,
  system: string,
  user: string,
  request: CompletionRequest,
): Promise<CompletionAttempt> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;
  try {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Math.max(1, request.timeoutMs));
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (endpoint.apiKey) headers.Authorization = `Bearer ${endpoint.apiKey}`;
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: endpoint.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: Math.max(1, request.maxTokens),
        temperature: request.temperature,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, timedOut, status: res.status, error: null };
    const data = await res.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = data?.choices?.[0]?.message?.content;
    return { ok: true, content: typeof content === 'string' ? content : null };
  } catch (err) {
    return {
      ok: false,
      timedOut,
      status: null,
      error: (err as Error)?.message ?? String(err),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * One bounded chat-completion request with optional one-shot failover.
 * Returns validated message content, or null on disabled/failed/timed-out/
 * invalid responses. Never throws to the caller. Every attempted call emits a
 * single structured, secret-free `[LLM-METRICS]` log line.
 */
export async function requestChatCompletion(
  system: string,
  user: string,
  options: ChatCompletionOptions = {},
): Promise<string | null> {
  const cfg = resolveLlmConfig();
  if (!cfg.enabled) return null;

  // Env caps override per-call defaults; per-call defaults preserve legacy
  // behaviour when no env var is configured.
  const bounds = resolveLlmBounds(options);
  const request: CompletionRequest = {
    timeoutMs: Math.max(1, bounds.timeoutMs),
    maxTokens: Math.max(1, bounds.maxTokens),
    temperature: bounds.temperature,
  };

  const promptChars = String(system ?? '').length + String(user ?? '').length;
  const approxPromptTokens = estimateApproxTokens(promptChars);
  const startedAt = Date.now();

  let attempt = await postCompletion(cfg, system, user, request);
  let failoverUsed = false;
  let endpoint: LlmEndpoint = cfg;

  if (!attempt.ok && cfg.failover) {
    failoverUsed = true;
    endpoint = cfg.failover;
    attempt = await postCompletion(cfg.failover, system, user, request);
  }

  const latencyMs = Date.now() - startedAt;
  const common = {
    provider: endpoint.provider,
    model: endpoint.model,
    latencyMs,
    promptChars,
    approxPromptTokens,
    maxTokens: request.maxTokens,
    failoverUsed,
    endpoint: safeEndpointForLog(endpoint.url),
  };

  if (!attempt.ok) {
    const reason = attempt.timedOut
      ? 'timeout'
      : attempt.status !== null
        ? `http_${attempt.status}`
        : (attempt.error ?? 'error');
    logLlmCall({
      ...common,
      outcome: attempt.timedOut ? 'timeout' : attempt.status !== null ? 'http_error' : 'error',
      fallbackUsed: true,
      reason,
    });
    return null;
  }

  if (attempt.content === null) {
    logLlmCall({ ...common, outcome: 'no_response', fallbackUsed: true, reason: 'empty_content' });
    return null;
  }

  const validation = validateLlmOutput(attempt.content);
  if (!validation.valid) {
    logLlmCall({
      ...common,
      outcome: 'invalid',
      fallbackUsed: true,
      reason: `${validation.reason ?? 'invalid'}${validation.detail ? `:${validation.detail}` : ''}`,
    });
    return null;
  }

  logLlmCall({ ...common, outcome: 'ok', fallbackUsed: false });
  return attempt.content.trim();
}
