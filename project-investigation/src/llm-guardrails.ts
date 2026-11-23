/**
 * M8-5: lightweight, pure guardrails and instrumentation helpers shared by all
 * LLM call sites (chat/responder paths and the M7 discovery advisory).
 *
 * Boundaries:
 *  - No canonical truth, evidence or hidden case data is read here.
 *  - No prompt bodies, model output or credentials are ever logged. Only sizes,
 *    provider/model names and outcome codes are emitted.
 *  - Validation is deliberately conservative to avoid false positives during
 *    normal play; the deterministic fallback remains the safety net.
 */

// ---------------------------------------------------------------------------
// Configurable bounds (env-driven, with safe per-call defaults)
// ---------------------------------------------------------------------------

/** Explicit `undefined` is allowed so caller option objects can be passed through. */
export interface LlmBoundsDefaults {
  timeoutMs?: number | undefined;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
}

export interface LlmBounds {
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
}

/** Parse a non-negative integer env var, falling back on missing/invalid input. */
export function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

/** Parse a bounded float env var (e.g. temperature), clamped to [min, max]. */
export function readFloatEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * Resolve global cost/timeout caps. Callers pass their own defaults so existing
 * per-path behaviour is preserved when no env var is set; an explicit env var
 * overrides the per-call default.
 */
export function resolveLlmBounds(defaults: LlmBoundsDefaults = {}): LlmBounds {
  return {
    timeoutMs: readPositiveIntEnv('LLM_TIMEOUT_MS', defaults.timeoutMs ?? 8000),
    maxTokens: readPositiveIntEnv('LLM_MAX_TOKENS', defaults.maxTokens ?? 300),
    temperature: readFloatEnv('LLM_TEMPERATURE', defaults.temperature ?? 0.2, 0, 2),
  };
}

// ---------------------------------------------------------------------------
// Cheap size/estimate helpers (no network, no secrets)
// ---------------------------------------------------------------------------

/** Rough token estimate (~4 chars/token). Used only for cost visibility logs. */
export function estimateApproxTokens(chars: number): number {
  return Math.max(1, Math.ceil(Math.max(0, chars) / 4));
}

/**
 * Strip query strings from an endpoint URL before logging. API keys are sent in
 * Authorization headers in this app, but dropping the query removes any chance
 * of leaking a `?key=...` style credential into logs.
 */
export function safeEndpointForLog(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}

// ---------------------------------------------------------------------------
// Output guardrails
// ---------------------------------------------------------------------------

/**
 * High-signal internal identifiers that must never appear in player-facing
 * model output. Natural-language phrases such as "the culprit is" are avoided
 * on purpose: a refusal like "I won't say who the culprit is" is legitimate.
 */
export const INTERNAL_LLM_LEAK_MARKERS: readonly string[] = [
  'canonical_truth', 'canonical_solution', 'hidden_events', 'hidden_interpretation',
  'release_conditions', 'conceptcriteria', 'concept_criteria',
  'minessentialmatches', 'min_essential_matches', 'acceptance_threshold',
  'subjectaliases', 'subject_aliases', 'leakage_terms',
];

export type LlmOutputInvalidReason = 'non_text' | 'empty' | 'too_long' | 'leak_marker';

export interface OutputValidationResult {
  valid: boolean;
  reason?: LlmOutputInvalidReason;
  detail?: string;
}

export interface OutputValidationOptions {
  maxChars?: number;
  extraMarkers?: readonly string[];
}

/**
 * Validate model output before it reaches a player. Invalid output triggers the
 * caller's deterministic fallback. Kept intentionally lightweight.
 */
export function validateLlmOutput(content: unknown, options: OutputValidationOptions = {}): OutputValidationResult {
  if (typeof content !== 'string') return { valid: false, reason: 'non_text' };
  const trimmed = content.trim();
  if (!trimmed) return { valid: false, reason: 'empty' };
  const maxChars = options.maxChars ?? 8000;
  if (trimmed.length > maxChars) {
    return { valid: false, reason: 'too_long', detail: String(trimmed.length) };
  }
  const lower = trimmed.toLowerCase();
  const markers: readonly string[] = [...INTERNAL_LLM_LEAK_MARKERS, ...(options.extraMarkers ?? [])];
  for (const marker of markers) {
    const normalized = String(marker ?? '').toLowerCase();
    if (normalized && lower.includes(normalized)) {
      return { valid: false, reason: 'leak_marker', detail: marker };
    }
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Structured, secret-free instrumentation
// ---------------------------------------------------------------------------

export type LlmCallOutcome =
  | 'ok'
  | 'invalid'
  | 'http_error'
  | 'timeout'
  | 'error'
  | 'no_response';

export interface LlmCallLog {
  provider: string;
  model: string;
  outcome: LlmCallOutcome;
  latencyMs: number;
  promptChars: number;
  approxPromptTokens: number;
  maxTokens: number;
  fallbackUsed: boolean;
  failoverUsed: boolean;
  endpoint?: string | undefined;
  reason?: string | undefined;
}

/**
 * Emit one structured JSON line per attempted LLM call. Contains no prompt
 * body, no model output and no credentials - only sizes and outcome metadata.
 */
export function logLlmCall(fields: LlmCallLog): void {
  const payload = {
    event: 'llm_call',
    provider: fields.provider,
    model: fields.model,
    outcome: fields.outcome,
    latencyMs: fields.latencyMs,
    promptChars: fields.promptChars,
    approxPromptTokens: fields.approxPromptTokens,
    maxTokens: fields.maxTokens,
    fallbackUsed: fields.fallbackUsed,
    failoverUsed: fields.failoverUsed,
    ...(fields.endpoint !== undefined ? { endpoint: fields.endpoint } : {}),
    ...(fields.reason !== undefined ? { reason: fields.reason } : {}),
  };
  console.info('[LLM-METRICS] ' + JSON.stringify(payload));
}
