/**
 * Track C first milestone — "The Senior reviews your legal research".
 *
 * Event-driven orchestration only: a model is called (if at all) on one explicit submit
 * event, never on a click, panel switch, tick or database lookup. The deterministic senior
 * gate (`submitSeniorReview`) ALWAYS runs first and remains the only writer of gameplay
 * state. An accepted AI proposal can enrich the dialogue and a provenance-labelled save
 * record, but it can never accept an assignment that the deterministic gate would reject,
 * change a reputation value, or unlock a milestone.
 *
 * Canonical truth is never part of the request projection; retrieval only touches approved
 * internal summaries; every cited id must pass `canCiteAsAuthoritative`. The gateway
 * (schema + safety + provenance gates) is disabled by default, so with no opt-in this module
 * is behaviourally identical to calling `submitSeniorReview` directly.
 */
import { checkAiOutput, AI_NON_AUTHORITATIVE_NOTICE, MAX_AI_PROMPT_CHARS } from '@/domain/ai/guards';
import { createAiGateway, disabledAiGateway, type AiGateway, type AiGatewayResult } from '@/domain/ai/gateway';
import type { LocalAiProvider } from '@/domain/ai/provider';
import { retrieveApprovedInternalSummaries, type RetrievedSource } from '@/domain/ai/retrieval';
import type { ReviewFeedback, SeniorMentorRequest } from '@/domain/ai/roles';
import { recordAudit } from '@/domain/audit';
import { submitSeniorReview, type SeniorReviewResult } from '@/domain/casework';
import { canCiteAsAuthoritative } from '@/domain/legalSources';
import { makeId } from '@/domain/progression';
import { MAX_AI_REVIEW_RECORDS, type AiReviewRecord, type SaveGame } from '@/domain/types';

/** Prompt is the player's own note; the context copy is bounded separately by the role contract. */
export const MAX_RESEARCH_NOTE_CHARS = MAX_AI_PROMPT_CHARS;
const MAX_SUBMITTED_WORK_CHARS = 600;
const MAX_AI_DIALOGUE_CHARS = 600;
const MAX_CONTEXT_IDS = 20;

/** Registry ids the player may legitimately see cited, after provenance verification. */
export function citableSourceIds(save: SaveGame): string[] {
  return save.legalSources.filter(canCiteAsAuthoritative).map((source) => source.id);
}

/** Only evidence the player actually discovered and reviewed may appear as a `ref`. */
export function visibleReviewedEvidenceIds(save: SaveGame): string[] {
  return save.caseFile.evidence.filter((item) => item.discovered && item.reviewed).map((item) => item.id);
}

/** Deterministic projection of player-visible state into the senior-mentor context envelope. */
export interface SeniorReviewProjection {
  readonly request: SeniorMentorRequest | null;
  readonly retrievedSources: RetrievedSource[];
  readonly verifiedSourceIds: string[];
}

export function projectSeniorReview(save: SaveGame, assignmentId: string, workSummary: string): SeniorReviewProjection {
  const assignment = save.assignments.find((item) => item.id === assignmentId);
  if (!assignment) return { request: null, retrievedSources: [], verifiedSourceIds: [] };

  const note = (workSummary ?? '').trim().slice(0, MAX_RESEARCH_NOTE_CHARS);
  // Retrieval is offline RAG-lite over approved internal summaries only; it never reads
  // canonical truth and the returned blocks are already labelled non-authoritative.
  const retrievedSources = retrieveApprovedInternalSummaries(save.legalSources, note);
  const verifiedSourceIds = citableSourceIds(save);
  const sourceIds = [...new Set([...retrievedSources.map((source) => source.id), ...verifiedSourceIds])].slice(
    0,
    MAX_CONTEXT_IDS,
  );
  const notebookKinds = [...new Set(save.notebook.map((entry) => entry.kind))].slice(0, MAX_CONTEXT_IDS);

  const request: SeniorMentorRequest = {
    roleId: 'senior-mentor',
    taskType: 'review-research',
    responseSchemaId: 'review-feedback.v1',
    prompt: note,
    context: {
      assignmentId: assignment.id,
      assignmentTitle: assignment.title.slice(0, MAX_SUBMITTED_WORK_CHARS),
      assignmentRequirements: assignment.description.slice(0, MAX_SUBMITTED_WORK_CHARS),
      submittedWork: note.slice(0, MAX_SUBMITTED_WORK_CHARS),
      visibleEvidenceIds: visibleReviewedEvidenceIds(save).slice(0, MAX_CONTEXT_IDS),
      visibleSourceIds: sourceIds,
      visibleNotebookKinds: notebookKinds,
    },
  };
  return { request, retrievedSources, verifiedSourceIds };
}

export interface AiSeniorReviewOptions {
  /** Injected gateway; defaults to the disabled-by-default instance (no model call). */
  readonly gateway?: AiGateway;
  /** Convenience for tests/callers without a gateway; ignored when `gateway` is supplied. */
  readonly provider?: LocalAiProvider;
  /** Only consulted with `provider`; the gateway's own `enabled` flag remains authoritative. */
  readonly enabled?: boolean;
  /** Cancellation forwarded to the transport (unmount / new request). */
  readonly signal?: AbortSignal;
  /** Caller correlation id; a stable fingerprint is used when omitted. */
  readonly requestId?: string;
}

export interface AiSeniorReviewOutcome {
  /** The deterministic writer result. Always present, always authoritative. */
  readonly deterministic: SeniorReviewResult;
  /** Gateway result, or null when no model was invoked (locked assignment / no request). */
  readonly gateway: AiGatewayResult | null;
  readonly retrievedSources: RetrievedSource[];
  /** The stored evaluation record, or null when AI was disabled/unavailable. */
  readonly record: AiReviewRecord | null;
  /** Senior dialogue: deterministic text plus, when gated, labelled AI suggestions. */
  readonly dialogue: string;
  /** True only when an accepted proposal enriched the presentation. */
  readonly aiAssisted: boolean;
  /** Player-facing status line for the review panel. */
  readonly notice: string;
}

function acceptedFeedback(result: AiGatewayResult): ReviewFeedback | null {
  if (result.status !== 'accepted') return null;
  const output = result.output;
  return output.schemaId === 'review-feedback.v1' && output.status === 'ok' ? output : null;
}

/** Plain-language, bounded senior dialogue. AI text is optional, labelled and never authoritative. */
function composeDialogue(
  deterministic: SeniorReviewResult,
  feedback: ReviewFeedback | null,
): { dialogue: string; aiText: string } {
  const base = deterministic.feedback || 'Senior review recorded.';
  if (!feedback) return { dialogue: base, aiText: '' };
  const parts = [feedback.summary, ...feedback.gaps.map((gap) => `${gap.point} ${gap.fix}`.trim())].filter(Boolean);
  const aiText = parts.join(' ').slice(0, MAX_AI_DIALOGUE_CHARS);
  if (!aiText) return { dialogue: base, aiText: '' };
  // Defence in depth: even a gateway-accepted proposal is re-checked before display.
  const check = checkAiOutput(aiText);
  if (check.blocked) return { dialogue: base, aiText: '' };
  return {
    dialogue: `${base} (AI-assisted, unverified, non-authoritative: ${aiText})`,
    aiText,
  };
}

/** Append a bounded review record through deterministic code; the only writer of `aiReviews`. */
function storeAiReview(save: SaveGame, record: AiReviewRecord): AiReviewRecord {
  save.aiReviews ??= [];
  save.aiReviews.unshift(record);
  if (save.aiReviews.length > MAX_AI_REVIEW_RECORDS) save.aiReviews.length = MAX_AI_REVIEW_RECORDS;
  return record;
}

/**
 * Submit one research note for senior review with an optional, explicit AI assist.
 *
 * The deterministic gate runs first and unconditionally; the gateway is consulted only for
 * an unlocked assignment with a well-formed request. A degraded proposal leaves gameplay and
 * storage exactly as the plain deterministic path; a rejected proposal stores only a
 * provenance record (no accepted AI text) and never changes the deterministic outcome.
 */
export async function submitSeniorReviewWithAi(
  save: SaveGame,
  assignmentId: string,
  workSummary: string,
  options: AiSeniorReviewOptions = {},
): Promise<AiSeniorReviewOutcome> {
  const projection = projectSeniorReview(save, assignmentId, workSummary);
  // 1. The deterministic writer is the only source of gameplay truth, and always runs.
  const deterministic = submitSeniorReview(save, assignmentId, workSummary);
  const baseNotice = 'Deterministic senior feedback was used.';

  if (!deterministic.ok || !deterministic.round) {
    return {
      deterministic,
      gateway: null,
      retrievedSources: projection.retrievedSources,
      record: null,
      dialogue: deterministic.feedback || deterministic.reason || 'Senior review unavailable.',
      aiAssisted: false,
      notice: baseNotice,
    };
  }

  // 2. No request projection (e.g. assignment vanished mid-flow) → deterministic only.
  if (!projection.request) {
    return {
      deterministic,
      gateway: null,
      retrievedSources: [],
      record: null,
      dialogue: deterministic.feedback,
      aiAssisted: false,
      notice: baseNotice,
    };
  }

  const gateway: AiGateway =
    options.gateway ??
    (options.provider
      ? createAiGateway({ provider: options.provider, enabled: options.enabled === true })
      : disabledAiGateway);

  // 3. Structured proposal only; the gateway never throws and never returns raw model text.
  const gatewayResult = await gateway.invoke(projection.request, {
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.requestId ? { requestId: options.requestId } : {}),
    verifiedSourceIds: projection.verifiedSourceIds,
  });

  // 4. Degraded (disabled / offline / cancelled) → byte-for-byte the deterministic path.
  if (gatewayResult.status === 'degraded') {
    return {
      deterministic,
      gateway: gatewayResult,
      retrievedSources: projection.retrievedSources,
      record: null,
      dialogue: deterministic.feedback,
      aiAssisted: false,
      notice: `${AI_NON_AUTHORITATIVE_NOTICE} ${gatewayResult.reason} ${baseNotice}`,
    };
  }

  const feedback = acceptedFeedback(gatewayResult);
  const { dialogue, aiText } = composeDialogue(deterministic, feedback);
  const aiAssisted = feedback !== null && aiText.length > 0;
  const citedSources = feedback ? [...feedback.citedSources] : [];
  const warnings = [...gatewayResult.warnings];
  if (aiAssisted) warnings.push(AI_NON_AUTHORITATIVE_NOTICE);

  // 5. Deterministic code stores a provenance-labelled evaluation; AI text never becomes fact.
  const record = storeAiReview(save, {
    id: makeId('ai'),
    day: save.clock.day,
    assignmentId,
    round: deterministic.round.round,
    requestId: gatewayResult.requestId,
    deterministicStatus: deterministic.round.status,
    aiAssisted,
    gatewayStatus: gatewayResult.status,
    summary: feedback?.summary ?? '',
    citedSources,
    warnings: warnings.slice(0, MAX_AI_REVIEW_RECORDS),
  });
  recordAudit(
    save,
    'senior-review-ai',
    aiAssisted
      ? `AI-assisted senior review recorded (${assignmentId}, round ${deterministic.round.round}); deterministic outcome unchanged.`
      : `AI-assisted senior review requested (${assignmentId}); proposal rejected by gates, deterministic outcome unchanged.`,
  );

  const notice = aiAssisted
    ? 'AI suggestions were checked by the safety and provenance gates and labelled non-authoritative; they did not change the review outcome.'
    : gatewayResult.status === 'accepted'
      ? 'The model declined to propose feedback; deterministic senior feedback was used.'
      : 'The AI proposal was rejected by the safety/provenance gates; deterministic senior feedback was used.';

  return {
    deterministic,
    gateway: gatewayResult,
    retrievedSources: projection.retrievedSources,
    record,
    dialogue,
    aiAssisted,
    notice,
  };
}
