import type { OfferTerm, ResponseIntent, CaseDefinition } from '../../shared/types.js';
import type { ParticipantResponse } from '../../shared/ai.js';
import type { CharacterContext } from './context.js';
import { clamp } from '../engine/utils.js';

export interface FallbackInput {
  caseDef: CaseDefinition;
  context: CharacterContext;
  playerIntent: ResponseIntent;
  playerContent: string;
  /** Numeric terms of the current open player offer, supplied by orchestrator. */
  numericTerms?: OfferTerm[];
}

function counterTerms(caseDef: CaseDefinition, openTerms: OfferTerm[]): OfferTerm[] {
  return caseDef.issues.filter((i) => i.required).map((issue) => {
    const playerTerm = openTerms.find((t) => t.issueId === issue.id);
    const anchor = playerTerm?.value ?? issue.playerIdeal;
    const proposed = issue.opposingIdeal + 0.4 * (anchor - issue.opposingIdeal);
    const value = issue.direction === 'maximize'
      ? clamp(Math.round(proposed), issue.playerReservation, issue.opposingReservation)
      : clamp(Math.round(proposed), issue.opposingReservation, issue.playerReservation);
    return { issueId: issue.id, value };
  });
}

function openingTerms(caseDef: CaseDefinition): OfferTerm[] {
  return caseDef.issues.filter((i) => i.required).map((issue) => ({
    issueId: issue.id,
    value: Math.round((issue.playerReservation + issue.opposingReservation) / 2),
  }));
}

function acceptableToParticipant(caseDef: CaseDefinition, context: CharacterContext, terms: OfferTerm[]): boolean {
  const priv = caseDef.participantPrivate[context.participantId];
  for (const term of terms) {
    const issue = caseDef.issues.find((i) => i.id === term.issueId);
    if (!issue) return false;
    const zopaOk = issue.direction === 'maximize'
      ? term.value >= issue.playerReservation && term.value <= issue.opposingReservation
      : term.value >= issue.opposingReservation && term.value <= issue.playerReservation;
    if (!zopaOk) return false;
    const limit = priv?.issueLimits?.[term.issueId];
    if (limit?.min !== undefined && term.value < limit.min) return false;
    if (limit?.max !== undefined && term.value > limit.max) return false;
  }
  return true;
}

function lineFor(context: CharacterContext, intent: ResponseIntent, termsSummary: string): string {
  const firstIssue = context.requiredIssues[0] ?? 'the terms';
  switch (intent) {
    case 'accept':
      return context.cooperativeness === 'high'
        ? `I can support that. Let us write it down before anyone changes their mind. ${termsSummary}`.trim()
        : `I have no objection to those terms. ${termsSummary}`.trim();
    case 'counteroffer':
      return `That is not where I can land. What I can defend is this: ${termsSummary}. I need to know you are serious about ${firstIssue}.`;
    case 'question':
      return `${context.publicStance || 'I have been listening.'} I would want to understand how you intend to handle ${firstIssue} before we move further.`;
    case 'challenge':
      return `Before I accept a number like that, show me what it is based on. ${context.publicStance || 'I need evidence, not confidence.'}`;
    case 'concession':
      return `I can move a little on ${firstIssue}, but only if the movement is reciprocated.`;
    case 'reject':
      return 'No. That position does not work for me or the people I represent.';
    default:
      return context.cooperativeness === 'low'
        ? `${context.publicStance || 'I am not convinced.'} Give me something concrete.`
        : `${context.publicStance || 'I am listening.'} Tell me what would make this workable for your side.`;
  }
}

/** Deterministic, clearly-labelled counterparty used when no LLM is available. */
export function deterministicResponse(input: FallbackInput): ParticipantResponse {
  const { caseDef, context, playerIntent, numericTerms } = input;
  let intent: ResponseIntent = 'message';
  let proposedOffer: OfferTerm[] | undefined;
  let parentOfferId: string | undefined;
  let offerId: string | undefined;
  let concession: string | undefined;
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';

  const terms = numericTerms ?? [];
  const evaluatingOffer =
    Boolean(context.openOffer) ||
    (terms.length > 0 && (playerIntent === 'offer' || playerIntent === 'counteroffer'));
  if (evaluatingOffer) {
    if (terms.length > 0 && acceptableToParticipant(caseDef, context, terms)) {
      intent = 'accept';
      offerId = context.openOffer?.id;
      sentiment = 'positive';
    } else {
      intent = 'counteroffer';
      proposedOffer = terms.length > 0 ? counterTerms(caseDef, terms) : openingTerms(caseDef);
      parentOfferId = context.openOffer?.id;
      concession = `Countered within the viable range on ${proposedOffer.map((t) => t.issueId).join(', ')}.`;
    }
  } else if (playerIntent === 'question' || playerIntent === 'challenge') {
    intent = playerIntent;
  } else if (playerIntent === 'reject') {
    sentiment = 'negative';
  }

  const termsSummary = proposedOffer
    ? proposedOffer.map((t) => {
        const issue = caseDef.issues.find((i) => i.id === t.issueId);
        return `${issue?.label ?? t.issueId} ${t.value}${issue?.unit ?? ''}`;
      }).join(', ')
    : '';

  return {
    participantId: context.participantId,
    target: 'group',
    message: lineFor(context, intent, termsSummary),
    intent,
    proposedOffer,
    parentOfferId,
    offerId,
    concession,
    sentiment,
    internalNote: `Deterministic fallback for ${context.name}. Private context was used only for constraint checks.`,
    source: 'deterministic_fallback',
  };
}
