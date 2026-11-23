// Types shared between the AI simulation layer and the engine.
// `source` is intentionally explicit: deterministic fallback output is never
// presented as if it came from a language model.

import type { MessageTarget, OfferTerm, ResponseIntent } from './types.js';

export type ResponseSource = 'llm' | 'deterministic_fallback';

export interface ParticipantResponse {
  participantId: string;
  target: MessageTarget;
  message: string;
  intent: ResponseIntent;
  proposedOffer?: OfferTerm[];
  /** Parent offer when countering, or the exact offer being accepted/rejected. */
  parentOfferId?: string;
  /** Explicit target offer id (preferred for accept/reject). */
  offerId?: string;
  concession?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  /** Private reasoning hint. Used for engine evidence only; never sent to client DTOs. */
  internalNote?: string;
  source: ResponseSource;
}

export interface TurnResponse {
  responses: ParticipantResponse[];
  source: ResponseSource;
}

export interface GenerateStructuredRequest {
  system: string;
  prompt: string;
  /** Label used for logging / error reporting. */
  schemaName: string;
  timeoutMs?: number;
}

export interface GenerateStructuredResult<T> {
  /** null means the call failed, timed out, or returned malformed data. */
  data: T | null;
  source: ResponseSource;
  error?: string;
}

export interface AIProvider {
  readonly name: string;
  readonly usesLLM: boolean;
  generateStructured<T>(request: GenerateStructuredRequest): Promise<GenerateStructuredResult<T>>;
}
