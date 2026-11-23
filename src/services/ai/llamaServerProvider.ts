/**
 * Concrete local provider: OpenAI-compatible chat completions through the Vite proxy
 * `/api/local-llm` (rewritten to `http://127.0.0.1:8081/v1/chat/completions`).
 *
 * This module owns only transport/shape concerns: bounded request, timeout, cancellation,
 * HTTP/JSON errors and the chat-completions envelope. Prompt guarding, output guarding,
 * non-authoritative labelling and length capping stay in `src/services/localLlm.ts` so every
 * provider is subject to the same guardrails.
 */
import { validateLocalLlmShape } from '@/domain/ai/guards';
import type { LocalAiProvider, ProviderErrorCode, ProviderRequest, ProviderResult } from '@/domain/ai/provider';
import { LOCAL_AI_PROVIDER_ID, LOCAL_AI_PROVIDER_META } from '@/domain/ai/provider';

export const LOCAL_LLM_ENDPOINT = LOCAL_AI_PROVIDER_META.endpoint;
export const DEFAULT_LOCAL_LLM_TIMEOUT_MS = 15000;

const UNREACHABLE_HINT = 'Is llama-server running locally on 127.0.0.1:8081?';

export interface LlamaServerProviderOptions {
  /** Injectable for deterministic tests; defaults to the browser `fetch`. */
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

function fail(code: ProviderErrorCode, error: string): ProviderResult {
  return { ok: false, code, error };
}

/** Build a provider bound to a fetch implementation and timeout (both injectable in tests). */
export function createLlamaServerProvider(options: LlamaServerProviderOptions = {}): LocalAiProvider {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOCAL_LLM_TIMEOUT_MS;

  return {
    id: LOCAL_AI_PROVIDER_ID,
    label: LOCAL_AI_PROVIDER_META.label,
    async generate(request: ProviderRequest): Promise<ProviderResult> {
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      const external = request.signal;
      const onExternalAbort = () => controller.abort();
      if (external?.aborted) controller.abort();
      else external?.addEventListener('abort', onExternalAbort, { once: true });

      try {
        const res = await fetchFn(LOCAL_LLM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: request.messages,
            max_tokens: request.maxTokens,
            temperature: request.temperature,
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
        return { ok: true, text: shape.text };
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
    },
  };
}
