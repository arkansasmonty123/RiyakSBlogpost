/**
 * Phase 6 foundations: deterministic guardrails for the experimental local-AI path.
 *
 * These checks run entirely in the browser before/after a request to the local
 * llama-server. They are NOT a knowledge source: the local model never receives
 * canonical case truth, hidden motives, evidence authenticity or any save/case
 * data, and its output is always treated as non-authoritative.
 *
 * Design constraints (D-013 / ADR-001 / ADR-002):
 *  - schema/shape validation of model output;
 *  - citation-looking and knowledge-boundary checks via the existing guards;
 *  - bounded prompt/response sizes;
 *  - deterministic behaviour when the feature is unused.
 */
import { looksLikeSpecificCitation } from '@/domain/legalSources';

/** Bounded input/output so a runaway local model cannot flood the UI. */
export const MAX_AI_PROMPT_CHARS = 2000;
export const MAX_AI_RESPONSE_CHARS = 4000;
/** Raw envelopes larger than this are rejected before any text is shown (DoS backstop). */
export const MAX_LLM_RAW_RESPONSE_CHARS = MAX_AI_RESPONSE_CHARS * 4;

export const AI_CITATION_WARNING =
  'Response contains specific-looking legal citation text. Treat it as unverified; never rely on it as legal authority.';
export const AI_NON_AUTHORITATIVE_NOTICE =
  'Local AI output is experimental, may be inaccurate, and is not legal advice.';
export const AI_BOUNDARY_WARNING =
  'The assistant was asked to reveal hidden information. Only the player-supplied prompt was sent; hidden case truth is never available to the model.';
export const AI_UNSAFE_CLAIM_WARNING =
  'Response makes authoritative-sounding legal claims. Treat every statement as unverified and check primary sources yourself.';
export const AI_CITATION_FABRICATION_WARNING =
  'Your prompt asks for legal citations. This tool cannot invent or verify authority; check primary sources yourself.';

/**
 * Field names from the canonical-truth record plus a few exact seed values. Matching is
 * case-insensitive substring matching so that paraphrased field names cannot slip through.
 * This is a *boundary* guard: it rejects content rather than trying to redact it.
 */
const CANONICAL_TRUTH_MARKERS: readonly string[] = [
  'canonicaltruth',
  'actualevents',
  'actualtimeline',
  'responsibleparties',
  'hiddenmotives',
  'evidenceauthenticity',
  'unresolvedambiguities',
  'canonical party responsibility withheld from player view',
  'a shove occurred after an argument',
  'a portion of the phone recording was removed before it was shared',
  'witness had prior dispute with complainant',
  '18:12 shove',
];

/** Attempts to escape the knowledge boundary or ask for hidden/non-public information. */
const BOUNDARY_BYPASS_PATTERNS: readonly RegExp[] = [
  /\b(ignore|disregard|forget|override)\b.{0,40}\b(system|previous|earlier|instructions|prompt|rules)\b/i,
  /\b(reveal|show|disclose|tell me|what is|give me)\b.{0,40}\b(canonical|hidden|actual|authenticity|motive|culprit|responsible)\b/i,
  /\b(system prompt|canonical truth|hidden motive|hidden truth|evidence authenticity)\b/i,
  /\b(print|output|dump|repeat|show|reveal|give)\b.{0,60}\b(canonical|hidden|actual timeline|actual events|responsible parties|authenticity|motive|culprit)\b/i,
  /\b(hidden|canonical|actual)\s+(truth|timeline|events|party|parties|motive|motives)\b/i,
];

/** Claims that assert legal conclusions or hidden responsibility as if they were settled. */
const UNSAFE_CLAIM_PATTERNS: readonly RegExp[] = [
  /\b(court|tribunal|judge|bench)\b.{0,40}\b(held|ruled|has held|found|decided)\b/i,
  /\b(held|ruled|decided)\b.{0,40}\b(court|tribunal|judge|bench)\b/i,
  /\bsettled law\b|\bwell[- ]settled\b|\bestablished (law|precedent)\b/i,
  /\b(the culprit|the responsible party|the person responsible)\b/i,
  /\b(is|are|was|were)\s+(guilty|liable)\b/i,
  /\baccording to\s+[A-Z][A-Za-z.]+\s+v\.?\s+[A-Z]/i,
];

/** Prompts that request invented / unverifiable legal authority. */
const CITATION_FABRICATION_REQUEST_PATTERNS: readonly RegExp[] = [
  /\b(invent|fabricate|make up|generate|give me|provide|write|draft|cite)\b.{0,50}\b(citation|case law|judgment|statute|precedent|section \d+|AIR \d{4})\b/i,
  /\b(citation|case law|judgment|statute|precedent)\b.{0,50}\b(invent|fabricate|make up|fake)\b/i,
];

/** True when text contains canonical-truth field names or exact hidden values. */
export function containsCanonicalTruth(text: string): boolean {
  const normalized = (text ?? '').toLowerCase();
  return CANONICAL_TRUTH_MARKERS.some((marker) => normalized.includes(marker));
}

/** True when text tries to bypass the knowledge boundary / ask for hidden information. */
export function containsKnowledgeBoundaryBypass(text: string): boolean {
  const value = text ?? '';
  return BOUNDARY_BYPASS_PATTERNS.some((pattern) => pattern.test(value));
}

/** True when text asserts legal conclusions / hidden responsibility as authoritative. */
export function containsUnsafeClaim(text: string): boolean {
  const value = text ?? '';
  return UNSAFE_CLAIM_PATTERNS.some((pattern) => pattern.test(value));
}

/** True when a prompt asks the model to invent or supply unverifiable legal authority. */
export function looksLikeCitationFabricationRequest(text: string): boolean {
  const value = text ?? '';
  return CITATION_FABRICATION_REQUEST_PATTERNS.some((pattern) => pattern.test(value));
}

export type PromptRejectionCode = 'empty-prompt' | 'prompt-too-long' | 'blocked-prompt';

export interface PromptGuardResult {
  ok: boolean;
  prompt: string;
  code?: PromptRejectionCode;
  reason?: string;
  /** Non-blocking notices shown to the user (e.g. a request for fabricated citations). */
  warnings: string[];
}

/**
 * Validate/bound the only value ever sent to the local model: the player's own prompt.
 * No case, save, character or canonical-truth data is read by this path.
 */
export function guardPrompt(raw: string): PromptGuardResult {
  const prompt = (raw ?? '').trim();
  if (!prompt) return { ok: false, prompt: '', code: 'empty-prompt', reason: 'Enter a prompt.', warnings: [] };
  if (prompt.length > MAX_AI_PROMPT_CHARS) {
    return {
      ok: false,
      prompt: '',
      code: 'prompt-too-long',
      reason: `Prompt is too long (maximum ${MAX_AI_PROMPT_CHARS} characters).`,
      warnings: [],
    };
  }
  if (containsCanonicalTruth(prompt) || containsKnowledgeBoundaryBypass(prompt)) {
    return {
      ok: false,
      prompt: '',
      code: 'blocked-prompt',
      reason: AI_BOUNDARY_WARNING,
      warnings: [],
    };
  }
  const warnings = looksLikeCitationFabricationRequest(prompt) ? [AI_CITATION_FABRICATION_WARNING] : [];
  return { ok: true, prompt, warnings };
}

export interface LlmShapeResult {
  ok: boolean;
  text: string;
  reason?: string;
}

/** Validate the OpenAI-compatible chat-completions shape before any text is used. */
export function validateLocalLlmShape(raw: unknown): LlmShapeResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, text: '', reason: 'Unexpected local LLM response: not an object.' };
  }
  const choices = (raw as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return { ok: false, text: '', reason: 'Unexpected local LLM response: no choices.' };
  }
  const first = choices[0];
  if (!first || typeof first !== 'object') {
    return { ok: false, text: '', reason: 'Unexpected local LLM response: invalid choice.' };
  }
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== 'object') {
    return { ok: false, text: '', reason: 'Unexpected local LLM response: no message.' };
  }
  const content = (message as { content?: unknown }).content;
  if (typeof content !== 'string') {
    return { ok: false, text: '', reason: 'Unexpected local LLM response: content is not text.' };
  }
  if (content.length > MAX_LLM_RAW_RESPONSE_CHARS) {
    return { ok: false, text: '', reason: 'Unexpected local LLM response: content exceeds the safe size limit.' };
  }
  return { ok: true, text: content.trim() };
}

export interface AiOutputCheck {
  warnings: string[];
  blocked: boolean;
  reasons: string[];
}

/**
 * Post-process model output. Citation-looking text and the non-authoritative notice are
 * warnings (the text is still shown, clearly labelled). Canonical truth in output is a
 * hard block so nothing hidden can ever appear in the panel.
 */
export function checkAiOutput(text: string): AiOutputCheck {
  const warnings: string[] = [AI_NON_AUTHORITATIVE_NOTICE];
  const reasons: string[] = [];
  if (typeof text !== 'string' || !text.trim()) {
    reasons.push('Model output was not usable text; nothing was displayed.');
    return { warnings, blocked: true, reasons };
  }
  if (looksLikeSpecificCitation(text)) warnings.push(AI_CITATION_WARNING);
  if (containsUnsafeClaim(text)) warnings.push(AI_UNSAFE_CLAIM_WARNING);
  if (containsCanonicalTruth(text)) reasons.push('Hidden case truth appeared in model output; nothing was displayed.');
  if (text.length > MAX_AI_RESPONSE_CHARS)
    warnings.push('Response exceeded the safe length limit and will be shortened.');
  return { warnings, blocked: reasons.length > 0, reasons };
}

/** Centralised response cap used by the service so every caller applies the same bound. */
export function truncateAiResponse(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_AI_RESPONSE_CHARS) return { text, truncated: false };
  return { text: `${text.slice(0, MAX_AI_RESPONSE_CHARS - 1)}…`, truncated: true };
}
