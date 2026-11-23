import type {
  CaseDefinition,
  NegotiationEvent,
  NegotiationSession,
  OutcomeResult,
  QualityLevel,
} from '../../shared/types.js';
import { clamp } from './utils.js';

/** 0 at your reservation point, 100 at your ideal for an issue. */
export function issueScore(caseDef: CaseDefinition, issueId: string, value: number): number {
  const issue = caseDef.issues.find((i) => i.id === issueId);
  if (!issue) return 0;
  if (issue.direction === 'maximize') {
    const span = issue.playerIdeal - issue.playerReservation;
    if (span <= 0) return 100;
    return clamp(((value - issue.playerReservation) / span) * 100, 0, 100);
  }
  const span = issue.playerReservation - issue.playerIdeal;
  if (span <= 0) return 100;
  return clamp(((issue.playerReservation - value) / span) * 100, 0, 100);
}

export function playerValueScore(state: NegotiationSession, caseDef: CaseDefinition): number {
  if (state.agreementStatus !== 'full' || !state.agreementOfferId) return 0;
  const offer = state.offers.find((o) => o.id === state.agreementOfferId);
  if (!offer) return 0;
  let weighted = 0;
  let total = 0;
  for (const term of offer.terms) {
    const issue = caseDef.issues.find((i) => i.id === term.issueId);
    if (!issue) continue;
    weighted += issueScore(caseDef, term.issueId, term.value) * issue.weight;
    total += issue.weight;
  }
  return total > 0 ? Math.round(weighted / total) : 0;
}

export function determineOutcome(state: NegotiationSession, caseDef: CaseDefinition): OutcomeResult {
  const score = playerValueScore(state, caseDef);
  const walked = state.agreementStatus === 'walked_away';
  if (walked) {
    const tier =
      caseDef.outcomeDefinitions.find((o) => o.walkAway) ??
      caseDef.outcomeDefinitions[0];
    return {
      id: tier.id,
      title: tier.title,
      description: tier.description,
      playerScore: score,
      rationale: `You ended the negotiation without an agreement. No terms were validated (score recorded as ${score}).`,
    };
  }

  if (state.agreementStatus !== 'full') {
    return {
      id: 'no_agreement',
      title: 'No agreement',
      description: 'The negotiation ended without a validated agreement. No terms were accepted by all required parties.',
      playerScore: score,
      rationale: `No validated agreement was reached (agreement status: ${state.agreementStatus}). Score is ${score}/100 because no deal was finalized.`,
    };
  }

  const tier =
    caseDef.outcomeDefinitions.find((o) => !(o.walkAway ?? false) && score >= o.minScore && score <= o.maxScore) ??
    caseDef.outcomeDefinitions.find((o) => !(o.walkAway ?? false)) ??
    caseDef.outcomeDefinitions[0];

  return {
    id: tier.id,
    title: tier.title,
    description: tier.description,
    playerScore: score,
    rationale: `Weighted value of the validated agreement against your issue ideals is ${score}/100, which falls in the "${tier.title}" band.`,
  };
}

export function outcomeQuality(score: number): QualityLevel {
  if (score >= 75) return 'strong';
  if (score >= 50) return 'mixed';
  return 'weak';
}

export interface DecisionSignals {
  score: number;
  rating: QualityLevel;
  rationale: string;
  questionCount: number;
  challengeCount: number;
  offerCount: number;
  concessionCount: number;
}

function countEvents(events: NegotiationEvent[], predicate: (e: NegotiationEvent) => boolean): number {
  return events.filter(predicate).length;
}

/** Decision quality is evaluated from observable process evidence, never from the outcome tier. */
export function evaluateDecisionQuality(state: NegotiationSession, _caseDef: CaseDefinition): DecisionSignals {
  const prep = state.preparation;
  const prepFields = prep
    ? [prep.objectives, prep.batna, prep.reservationPoint, prep.openingPosition, prep.leverage,
       prep.concessions, prep.questions, prep.predictions, prep.strategy]
    : [];
  const prepCount = prepFields.filter((v) => typeof v === 'string' && v.trim().length > 0).length;
  const questionCount = countEvents(state.events, (e) => e.type === 'message_sent' && e.payload.intent === 'question');
  const challengeCount = countEvents(state.events, (e) => e.type === 'message_sent' && e.payload.intent === 'challenge');
  const offerCount = state.offers.filter((o) => o.proposerType === 'player').length;
  const concessionCount = countEvents(
    state.events,
    (e) => e.type === 'concession_made' && e.payload.by === 'player',
  );

  let score = 20;
  const reasons: string[] = [];
  if (prepCount >= 7) {
    score += 25; reasons.push('thorough preparation across most planning fields');
  } else if (prepCount >= 4) {
    score += 15; reasons.push('partial preparation');
  } else {
    score -= 10; reasons.push('little or no preparation recorded');
  }
  if (prep?.batna?.trim()) { score += 8; reasons.push('a BATNA was defined'); }
  if (prep?.reservationPoint?.trim()) { score += 8; reasons.push('a reservation point was defined'); }
  if (questionCount + challengeCount >= 2) {
    score += 15; reasons.push(`${questionCount} questions and ${challengeCount} challenges were put to the table`);
  } else if (questionCount + challengeCount === 1) {
    score += 7; reasons.push('one investigative intervention');
  } else {
    score -= 8; reasons.push('no substantive questions or challenges');
  }
  if (offerCount >= 2) { score += 12; reasons.push(`${offerCount} structured offers/counteroffers were made`); }
  else if (offerCount === 1) { score += 6; reasons.push('one structured offer was made'); }
  if (concessionCount > 0 && offerCount >= 2) { score += 6; reasons.push('concessions were exchanged'); }
  if (concessionCount >= 4 && offerCount <= 2) { score -= 10; reasons.push('several concessions without structured counteroffers'); }
  if (state.agreementStatus === 'walked_away' && prepCount < 4) { score -= 12; reasons.push('walked away without a recorded alternative'); }

  score = clamp(score, 0, 100);
  const rating: QualityLevel = score >= 70 ? 'strong' : score >= 45 ? 'mixed' : 'weak';
  return {
    score,
    rating,
    rationale: `Decision quality is based on process evidence: ${reasons.join('; ') || 'no interpretable actions recorded'}. This is independent of the agreement reached.`,
    questionCount,
    challengeCount,
    offerCount,
    concessionCount,
  };
}
