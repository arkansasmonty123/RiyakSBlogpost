/**
 * Experimental, local-only AI orchestrator.
 *
 * Owns the guardrails around every local provider: prompt guarding (including the
 * knowledge-boundary red-team checks), optional non-authoritative internal-summary context,
 * output guarding, non-authoritative labelling and length capping. The concrete transport
 * lives in `src/services/ai/llamaServerProvider.ts`; it never receives case/save truth.
 */
import { checkAiOutput, containsCanonicalTruth, guardPrompt, truncateAiResponse } from '@/domain/ai/guards';
import type { ProviderMessage } from '@/domain/ai/provider';
import { LOCAL_AI_PROVIDER_META } from '@/domain/ai/provider';
import { createLlamaServerProvider } from '@/services/ai/llamaServerProvider';

// Preserve the existing public constants/imports for callers and tests.
export { DEFAULT_LOCAL_LLM_TIMEOUT_MS, LOCAL_LLM_ENDPOINT } from '@/services/ai/llamaServerProvider';
export const LOCAL_AI_PROVIDER_LABEL = LOCAL_AI_PROVIDER_META.label;

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
  /**
   * Optional prompt context retrieved locally from approved internal summaries. Every block
   * is already labelled non-authoritative; canonical-truth-bearing blocks are dropped here
   * as a defence-in-depth backstop. Omitted by default, so the plain path is unchanged.
   */
  contextBlocks?: string[];
}

const SYSTEM_PROMPT =
  'You are a local experimental assistant inside a legal-training game prototype. ' +
  'Be helpful and concise. Do not invent real statutes, case citations, judgments, or procedural rules. ' +
  'If legal sources are needed, say that verified sources must be checked. ' +
  'Any "[Approved internal summary]" context is non-authoritative and is not legal authority. ' +
  'Only the player-supplied prompt is available to you; no hidden case truth is provided.';

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

  const messages: ProviderMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];
  for (const raw of options.contextBlocks ?? []) {
    const block = (raw ?? '').trim();
    if (!block || containsCanonicalTruth(block)) continue;
    messages.push({ role: 'system', content: block });
  }
  messages.push({ role: 'user', content: guarded.prompt });

  const provider = createLlamaServerProvider({ fetchFn: options.fetchFn, timeoutMs: options.timeoutMs });
  const result = await provider.generate({
    messages,
    maxTokens: 256,
    temperature: 0.2,
    signal: options.signal,
  });
  if (!result.ok) return fail(result.code, result.error);

  const output = checkAiOutput(result.text);
  if (output.blocked) return fail('unsafe-response', output.reasons.join(' '));

  const bounded = truncateAiResponse(result.text);
  const warnings = [...guarded.warnings, ...output.warnings];
  if (bounded.truncated) warnings.push('Response was shortened to a safe length.');
  return { ok: true, text: bounded.text, warnings };
}
