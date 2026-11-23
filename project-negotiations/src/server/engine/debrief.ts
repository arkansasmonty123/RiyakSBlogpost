import type {
  CaseDefinition,
  DebriefReport,
  NegotiationEvent,
  NegotiationSession,
  RatingLevel,
  SkillId,
} from '../../shared/types.js';
import { determineOutcome, evaluateDecisionQuality, outcomeQuality, playerValueScore } from './scoring.js';
import { termLabel } from './utils.js';

function participantName(caseDef: CaseDefinition, id: string | null | undefined): string {
  if (!id) return 'the table';
  return caseDef.participants.find((p) => p.id === id)?.name ?? id;
}

function eventText(caseDef: CaseDefinition, e: NegotiationEvent): { description: string; impact: string } {
  const p = e.payload;
  switch (e.type) {
    case 'session_started':
      return { description: 'Negotiation opened.', impact: 'Baseline trust and positions established.' };
    case 'session_activated':
      return { description: 'Session entered the active negotiation phase.', impact: 'Table opened for offers.' };
    case 'offer_made':
      return {
        description: `Structured offer made${p.proposerName ? ` by ${String(p.proposerName)}` : ''}.`,
        impact: p.terms ? `Terms on the table: ${JSON.stringify(p.terms)}.` : 'Opened the bargaining range.',
      };
    case 'offer_countered':
      return { description: 'A counteroffer was put on the table.', impact: 'Previous offer was superseded.' };
    case 'agreement_reached':
      return { description: 'Agreement validated by the engine.', impact: 'All required parties accepted within constraints.' };
    case 'walk_away':
      return { description: 'Player walked away.', impact: 'No agreement was validated.' };
    case 'concession_made':
      return { description: `Concession by ${String(p.by ?? 'unknown')}.`, impact: String(p.description ?? 'Positional movement recorded.') };
    case 'trust_changed':
      return {
        description: `Trust toward ${participantName(caseDef, String(p.participantId))} changed from ${String(p.from)} to ${String(p.to)}.`,
        impact: String(p.reason ?? 'Interaction recorded.'),
      };
    case 'message_sent':
      return {
        description: `Player ${String(p.intent ?? 'message')}: ${String(p.excerpt ?? '').slice(0, 120)}`,
        impact: p.bluffChallenge ? 'A claim was directly tested.' : 'Information was introduced into the room.',
      };
    case 'turn_completed':
      return {
        description: `Turn ${String(p.turn ?? '')} completed with ${String(p.responders ?? 0)} responders.`,
        impact: `Source ${String(p.source ?? 'unknown')}; ${String(p.llmCalls ?? 0)} LLM calls.`,
      };
    case 'llm_degraded':
      return { description: 'AI provider degraded to deterministic fallback.', impact: String(p.reason ?? 'Provider unavailable or malformed.') };
    default:
      return { description: e.type.replaceAll('_', ' '), impact: 'Recorded in the audit trail.' };
  }
}

function ratingForHits(hits: number, strongAt: number, developingAt: number): RatingLevel {
  if (hits >= strongAt) return 'strong';
  if (hits >= developingAt) return 'developing';
  return 'needs_work';
}

function qualityToSkillRating(q: 'strong' | 'mixed' | 'weak'): RatingLevel {
  return q === 'strong' ? 'strong' : q === 'mixed' ? 'developing' : 'needs_work';
}

export function computeDebrief(state: NegotiationSession, caseDef: CaseDefinition): DebriefReport {
  const outcome = determineOutcome(state, caseDef);
  const signals = evaluateDecisionQuality(state, caseDef);
  const score = playerValueScore(state, caseDef);
  const finalOffer = state.agreementOfferId ? state.offers.find((o) => o.id === state.agreementOfferId) : undefined;
  const termMap = new Map((finalOffer?.terms ?? []).map((t) => [t.issueId, t.value]));

  const objectivesMet = caseDef.issues.map((issue) => {
    const value = termMap.get(issue.id);
    if (value === undefined) {
      return { objective: issue.label, met: false, evidence: 'Not included in a validated agreement.' };
    }
    const localScore = issue.direction === 'maximize'
      ? ((value - issue.playerReservation) / (issue.playerIdeal - issue.playerReservation || 1)) * 100
      : ((issue.playerReservation - value) / (issue.playerReservation - issue.playerIdeal || 1)) * 100;
    return {
      objective: issue.label,
      met: localScore >= 50,
      evidence: `Final term ${value}${issue.unit}; your ideal ${issue.playerIdeal}${issue.unit}, reservation ${issue.playerReservation}${issue.unit}.`,
    };
  });
  objectivesMet.unshift({
    objective: state.preparation?.objectives?.trim() || 'Your stated overall objective',
    met: state.agreementStatus === 'full' && score >= 50,
    evidence: `Outcome "${outcome.title}" with weighted value score ${score}/100.`,
  });

  const concessions = state.events
    .filter((e) => e.type === 'concession_made')
    .map((e) => ({ by: String(e.payload.by ?? 'unknown'), description: String(e.payload.description ?? 'Positional movement recorded.') }));

  const unresolvedIssues = caseDef.issues.filter((i) => i.required && !termMap.has(i.id)).map((i) => i.label);

  const trustChanges = state.events
    .filter((e) => e.type === 'trust_changed')
    .map((e) => ({
      participant: participantName(caseDef, String(e.payload.participantId)),
      from: Number(e.payload.from ?? 0),
      to: Number(e.payload.to ?? 0),
      reason: String(e.payload.reason ?? 'Interaction recorded.'),
    }));

  const momentTypes = new Set([
    'session_started', 'session_activated', 'offer_made', 'offer_countered', 'agreement_reached',
    'walk_away', 'concession_made', 'trust_changed', 'message_sent', 'turn_completed', 'llm_degraded',
  ]);
  const keyMoments = state.events
    .filter((e) => momentTypes.has(e.type))
    .map((e) => ({ timestamp: e.createdAt, ...eventText(caseDef, e) }))
    .slice(0, 8);

  const mistakes: string[] = [];
  const prep = state.preparation;
  const prepCount = prep
    ? [prep.objectives, prep.batna, prep.reservationPoint, prep.openingPosition, prep.leverage,
       prep.concessions, prep.questions, prep.predictions, prep.strategy]
        .filter((v) => v.trim().length > 0).length
    : 0;
  if (prepCount < 4) mistakes.push('You entered the room without a documented BATNA and reservation point.');
  if (signals.questionCount + signals.challengeCount === 0) {
    mistakes.push('No question or challenge was recorded, so opposing claims went untested.');
  }
  if (state.agreementStatus === 'walked_away' && signals.offerCount === 0) {
    mistakes.push('You walked away without putting a structured offer on the table.');
  }
  if (state.agreementStatus === 'full' && score < 55) {
    mistakes.push('The accepted package sat close to your reservation point on weighted issues.');
  }
  if (signals.concessionCount >= 4 && signals.offerCount <= 2) {
    mistakes.push('Concessions accumulated without matching structured counteroffers.');
  }
  const negativeTrust = trustChanges.reduce((sum, t) => sum + Math.min(0, t.to - t.from), 0);
  if (negativeTrust <= -10) mistakes.push('Trust fell materially with at least one participant.');

  const missedOpportunities: string[] = [];
  for (const issue of caseDef.issues) {
    if (!issue.required && !termMap.has(issue.id)) {
      missedOpportunities.push(`"${issue.label}" was available as a tradeable issue but never used.`);
    }
  }
  if (signals.challengeCount === 0 && caseDef.hiddenReveals.some((r) => r.infoClass !== 'unknown')) {
    missedOpportunities.push('A verifiable claim or bluff was available to challenge.');
  }
  if (signals.questionCount < 2) missedOpportunities.push('Targeted questions about counterpart interests were available.');

  const messageCount = state.events.filter((e) => e.type === 'message_sent').length;
  const skillEvidence: Record<SkillId, { rating: RatingLevel; evidence: string }> = {
    negotiation: {
      rating: ratingForHits(signals.offerCount, 3, 1),
      evidence: `${signals.offerCount} structured offer${signals.offerCount === 1 ? '' : 's'}/counteroffers made; agreement status ${state.agreementStatus}.`,
    },
    questioning: {
      rating: ratingForHits(signals.questionCount, 3, 1),
      evidence: `${signals.questionCount} question${signals.questionCount === 1 ? '' : 's'} recorded in the negotiation log.`,
    },
    bluff_detection: {
      rating: ratingForHits(signals.challengeCount, 2, 1),
      evidence: `${signals.challengeCount} direct challenge${signals.challengeCount === 1 ? '' : 's'} of a claim; ${caseDef.hiddenReveals.filter((r) => r.infoClass === 'verified').length} verified hidden facts existed in this case.`,
    },
    strategic_communication: {
      rating: ratingForHits(messageCount, 5, 2),
      evidence: `${messageCount} message events; ${signals.offerCount} were expressed as structured positions.`,
    },
    information_management: {
      rating: ratingForHits(prepCount > 0 ? signals.offerCount : 0, 3, 1),
      evidence: prep
        ? `Preparation recorded ${prep.leverage?.trim() ? 'available leverage' : 'no leverage note'} and ${prep.strategy?.trim() ? 'a strategy' : 'no strategy'}; ${signals.offerCount} structured offers controlled what was disclosed.`
        : 'No preparation was recorded, so disclosure was not planned.',
    },
    incentive_reading: {
      rating: ratingForHits(signals.questionCount + signals.challengeCount + (termMap.size > 0 ? 1 : 0), 4, 2),
      evidence: `${signals.questionCount + signals.challengeCount} investigative interventions and ${termMap.size} issues in the final package.`,
    },
    emotional_control: {
      rating: ratingForHits(negativeTrust <= -15 ? 0 : signals.offerCount + signals.questionCount, 4, 2),
      evidence: `Net trust movement ${negativeTrust}; ${signals.offerCount} offers and ${signals.questionCount} questions were made under time pressure.`,
    },
    concessions: {
      rating: ratingForHits(signals.concessionCount, 3, 1),
      evidence: `${signals.concessionCount} recorded concession${signals.concessionCount === 1 ? '' : 's'}, against ${signals.offerCount} structured offers.`,
    },
    critical_thinking: {
      rating: ratingForHits(signals.challengeCount + (prep?.predictions?.trim() ? 1 : 0), 3, 1),
      evidence: `${signals.challengeCount} challenges; preparation ${prep?.predictions?.trim() ? 'included predictions' : 'did not include predictions'}.`,
    },
    decision_quality: {
      rating: qualityToSkillRating(signals.rating),
      evidence: signals.rationale,
    },
  };

  const oq = outcomeQuality(score);
  const conceptLessons: DebriefReport['conceptLessons'] = [];
  if (prep?.batna?.trim() || prep?.reservationPoint?.trim()) {
    conceptLessons.push({
      concept: 'BATNA / Reservation price',
      lesson: state.agreementStatus === 'walked_away'
        ? 'You documented alternatives/reservation boundaries; walking away can be rational when terms fall below them.'
        : 'Your BATNA and reservation point should anchor when to accept, push, or walk away.',
      evidence: `BATNA ${prep?.batna?.trim() ? 'recorded' : 'missing'}; reservation point ${prep?.reservationPoint?.trim() ? 'recorded' : 'missing'}; outcome ${state.agreementStatus}.`,
    });
  } else {
    conceptLessons.push({
      concept: 'BATNA / Reservation price',
      lesson: 'Without a documented BATNA and reservation point, it is hard to know whether a deal is good or just available.',
      evidence: 'Preparation had no BATNA/reservation point recorded.',
    });
  }
  const firstPlayerOffer = state.offers.find((o) => o.proposerType === 'player');
  if (firstPlayerOffer) {
    conceptLessons.push({
      concept: 'Anchoring',
      lesson: 'Your first structured offer set an anchor; effective anchors are ambitious but defensible within the ZOPA.',
      evidence: `First player offer: ${firstPlayerOffer.terms.map((t) => termLabel(caseDef, t)).join(', ')}.`,
    });
  }
  conceptLessons.push({
    concept: 'ZOPA / Information asymmetry',
    lesson: 'Deals are possible where reservation ranges overlap; hidden information means you must test assumptions rather than assume the visible range is real.',
    evidence: `${caseDef.hiddenReveals.length} hidden reveal(s) existed; ${signals.questionCount} question(s) and ${signals.challengeCount} challenge(s) recorded.`,
  });
  if (signals.challengeCount > 0 || caseDef.hiddenReveals.some((r) => r.infoClass === 'verified')) {
    conceptLessons.push({
      concept: 'Signalling / Bluff detection',
      lesson: 'Claims can be credible signals or bluffs; credibility improves when claims are specific, testable, and consistent with incentives.',
      evidence: `${signals.challengeCount} challenge(s) recorded; ${caseDef.hiddenReveals.filter((r) => r.infoClass === 'verified').length} verified hidden fact(s) were available.`,
    });
  }
  if (signals.concessionCount > 0) {
    conceptLessons.push({
      concept: 'Strategic concessions / Game theory',
      lesson: 'Concessions should trade for value, not just reduce pressure. In multi-party settings, one concession can shift coalition incentives.',
      evidence: `${signals.concessionCount} concession(s) recorded across ${caseDef.participants.length} participants.`,
    });
  }
  if (negativeTrust <= -10 || signals.questionCount + signals.challengeCount > 0) {
    conceptLessons.push({
      concept: 'Cognitive biases / Pressure',
      lesson: 'Under pressure, anchor, confirmation, and commitment biases can distort judgment; explicit questions and evidence checks reduce that risk.',
      evidence: `Net trust movement ${negativeTrust}; ${signals.questionCount + signals.challengeCount} investigative action(s).`,
    });
  }
  if (prep?.predictions?.trim()) {
    const predictionSnippet = prep.predictions.trim().slice(0, 120);
    conceptLessons.push({
      concept: 'Prediction calibration',
      lesson: state.agreementStatus === 'full'
        ? 'Compare your pre-negotiation predictions to the validated agreement and trust shifts; calibration improves when you update beliefs from evidence, not commitment.'
        : 'Compare your pre-negotiation predictions to how the negotiation actually ended; missed predictions are useful data for updating your mental model next time.',
      evidence: `Prediction recorded: "${predictionSnippet}${prep.predictions.trim().length > 120 ? '…' : ''}". Actual outcome: ${outcome.title}; agreement ${state.agreementStatus}; net trust movement ${negativeTrust}.`,
    });
  } else {
    missedOpportunities.push('No pre-negotiation predictions were recorded; writing predictions makes post-negotiation calibration possible.');
  }
  return {
    sessionId: state.id,
    caseId: state.caseId,
    agreementStatus: state.agreementStatus,
    agreementSummary: finalOffer
      ? finalOffer.terms.map((t) => termLabel(caseDef, t)).join(', ')
      : state.agreementStatus === 'walked_away'
        ? 'No agreement - player walked away.'
        : 'No validated agreement.',
    outcome,
    objectivesMet,
    concessions,
    unresolvedIssues,
    trustChanges,
    keyMoments,
    mistakes,
    missedOpportunities,
    alternativeApproaches: [...caseDef.debriefNotes],
    hiddenReveals: caseDef.hiddenReveals.map((r) => ({
      participant: participantName(caseDef, r.participantId),
      reveal: r.reveal,
      infoClass: r.infoClass,
    })),
    skillAssessment: Object.entries(skillEvidence).map(([skill, value]) => ({
      skill: skill as SkillId, rating: value.rating, evidence: value.evidence,
    })),
    conceptLessons,
    decisionQuality: signals.rating,
    decisionQualityRationale: signals.rationale,
    outcomeQuality: oq,
    outcomeQualityRationale: state.agreementStatus === 'full'
      ? `Weighted agreement value ${score}/100 maps to "${outcome.title}" (${oq}).`
      : `No validated agreement, so outcome quality is ${oq}; decision quality is reported separately above.`,
  };
}

export function ratingToScore(rating: RatingLevel): number {
  return rating === 'strong' ? 3 : rating === 'developing' ? 2 : 1;
}
