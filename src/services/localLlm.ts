/**
 * Experimental, local-only AI adapter.
 *
 * Calls the dev/proxy endpoint `/api/local-llm` (rewritten by Vite to the OpenAI-compatible
 * `/v1/chat/completions` of a locally running llama-server). There is no bundled model, no
 * hosted provider and no RAG. Only the player's own prompt is sent: canonical case truth is
 * never an input to this module, and output is always labelled non-authoritative.
 */
import { checkAiOutput, guardPrompt, MAX_AI_RESPONSE_CHARS, validateLocalLlmShape } from '@/domain/ai/guards';

export const LOCAL_LLM_ENDPOINT = '/api/local-llm';
export const DEFAULT_LOCAL_LLM_TIMEOUT_MS = 15000;

export type LocalLlmErrorCode =
  | 'empty-prompt'
  | 'prompt-too-long'
  | 'blocked-prompt'
  | 'timeout'
  | 'unavailable'
  | 'http'
  | 'invalid-response'
  | 'empty-response'
  | 'unsafe-response';

export interface LocalLlmResult {
  ok: boolean;
  text: string;
  warnings: string[];
  error?: string;
  /** Stable, machine-readable failure reason for callers/tests. */
  code?: LocalLlmErrorCode;
}

export interface LocalLlmOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** Optional caller cancellation (e.g. unmount or a new request). */
  signal?: AbortSignal;
}

const SYSTEM_PROMPT =
  'You are a local experimental assistant inside a legal-training game prototype. ' +
  'Be helpful and concise. Do not invent real statutes, case citations, judgments, or procedural rules. ' +
  'If legal sources are needed, say that verified sources must be checked. ' +
  'Only the player-supplied prompt is available to you; no hidden case truth is provided.';

const UNREACHABLE_HINT = 'Is llama-server running locally on 127.0.0.1:8081?';

function fail(code: LocalLlmErrorCode, error: string): LocalLlmResult {
  return { ok: false, text: '', warnings: [], error, code };
}

/**
 * Ask the local model. Never throws: transport, parsing, shape, timeout and boundary
 * failures are all returned as structured results so the UI can render them safely.
 */
export async function askLocalLlm(prompt: string, options: LocalLlmOptions = {}): Promise<LocalLlmResult> {
  const guarded = guardPrompt(prompt);
  if (!guarded.ok) return fail(guarded.code ?? 'empty-prompt', guarded.reason ?? 'Invalid prompt.');

  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOCAL_LLM_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const external = options.signal;
  const onExternalAbort = () => controller.abort();
  if (external?.aborted) controller.abort();
  else external?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const res = await fetchFn(LOCAL_LLM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: guarded.prompt },
        ],
        max_tokens: 256,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!res.ok) return fail('http', `Local LLM request failed (${res.status}). ${UNREACHABLE_HINT}`);

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return fail('invalid-response', 'Local LLM returned malformed JSON.');
    }

    const shape = validateLocalLlmShape(data);
    if (!shape.ok) return fail('invalid-response', shape.reason ?? 'Unexpected local LLM response.');
    if (!shape.text) return fail('empty-response', 'Local LLM returned an empty response.');

    const output = checkAiOutput(shape.text);
    if (output.blocked) return fail('unsafe-response', output.reasons.join(' '));

    const truncated = shape.text.length > MAX_AI_RESPONSE_CHARS;
    const text = truncated ? `${shape.text.slice(0, MAX_AI_RESPONSE_CHARS - 1)}…` : shape.text;
    const warnings = [...output.warnings];
    if (truncated) warnings.push('Response was shortened to a safe length.');
    return { ok: true, text, warnings };
  } catch (err) {
    if (timedOut) {
      return fail('timeout', `Local LLM did not respond within ${timeoutMs}ms. ${UNREACHABLE_HINT}`);
    }
    if (external?.aborted) return fail('unavailable', 'Local LLM request was cancelled.');
    const message = err instanceof Error ? err.message : 'Unknown error';
    return fail('unavailable', `Could not reach local LLM. ${UNREACHABLE_HINT} (${message})`);
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onExternalAbort);
  }
}
