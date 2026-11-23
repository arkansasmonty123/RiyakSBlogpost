/**
 * Provider abstraction for the experimental local-AI path (Phase 6).
 *
 * The domain only knows this small interface; the concrete llama-server adapter lives in
 * `src/services/ai/llamaServerProvider.ts`. There is no hosted provider, no bundled model
 * and no network call at import time. Canonical case truth is never a provider input — the
 * only free-form text a provider receives is the player's own (guarded) prompt plus, when
 * explicitly enabled, non-authoritative internal-summary context.
 */

export const LOCAL_AI_PROVIDER_ID = 'local-llama-server';

/** Static, human-readable metadata used by the Local AI Lab status line. */
export const LOCAL_AI_PROVIDER_META = {
  id: LOCAL_AI_PROVIDER_ID,
  label: 'Local llama-server (llama.cpp)',
  endpoint: '/api/local-llm',
  note: 'Runs only against a model you start yourself on 127.0.0.1:8081.',
} as const;

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ProviderMessage {
  role: ChatRole;
  content: string;
}

export interface ProviderRequest {
  messages: ProviderMessage[];
  maxTokens: number;
  temperature: number;
  /** Caller cancellation (unmount / new request), forwarded to the transport. */
  signal?: AbortSignal;
}

export type ProviderErrorCode = 'timeout' | 'unavailable' | 'http' | 'invalid-response' | 'empty-response';

export interface ProviderFailure {
  ok: false;
  code: ProviderErrorCode;
  error: string;
}

export interface ProviderSuccess {
  ok: true;
  text: string;
}

/** Transport-level result. Prompt/output guards are deliberately outside the provider. */
export type ProviderResult = ProviderSuccess | ProviderFailure;

export interface LocalAiProvider {
  readonly id: string;
  readonly label: string;
  generate(request: ProviderRequest): Promise<ProviderResult>;
}
