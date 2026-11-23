import type {
  CaseDefinition,
  ChatMessage,
  NegotiationEvent,
  NegotiationSession,
  Offer,
  PreparationInput,
  SenderType,
} from '../../shared/types.js';
import type { ParticipantResponse, ResponseSource } from '../../shared/ai.js';
import { validateAgreement, isOpenOffer, latestOpenOffer } from './agreement.js';
import { computeDebrief, ratingToScore } from './debrief.js';
import { EngineError } from './errors.js';
import {
  clamp, clone, detectConcessions, detectIntent, resolveDeps,
  termLabel, validateTerms, type EngineDeps, type ResolvedDeps,
} from './utils.js';

export * from './agreement.js';
export * from './debrief.js';
export * from './errors.js';
export * from './scoring.js';
export { detectIntent, validateTerms } from './utils.js';
export type { EngineDeps } from './utils.js';

export interface TurnResult {
  state: NegotiationSession;
  messages: ChatMessage[];
  events: NegotiationEvent[];
}

export interface FinalizeResult extends TurnResult {
  debrief: ReturnType<typeof computeDebrief>;
}

export interface TurnMetadata {
  turn: number;
  responders: string[];
  source: ResponseSource;
  llmCalls: number;
  fallbackUsed: boolean;
  latencyMs: number;
}

function makeEvent(
  state: NegotiationSession,
  deps: ResolvedDeps,
  type: NegotiationEvent['type'],
  payload: Record<string, unknown>,
): NegotiationEvent {
  const event: NegotiationEvent = {
    id: deps.id(), sessionId: state.id, type, payload, createdAt: deps.now(),
  };
  state.events.push(event);
  return event;
}

function makeMessage(
  state: NegotiationSession,
  deps: ResolvedDeps,
  senderType: SenderType,
  senderId: string | null,
  senderName: string,
  target: string,
  content: string,
  meta?: Record<string, unknown>,
): ChatMessage {
  return {
    id: deps.id(), sessionId: state.id, senderType, senderId, senderName,
    target, content, createdAt: deps.now(), meta,
  };
}

function touch(state: NegotiationSession, deps: ResolvedDeps): void {
  state.updatedAt = deps.now();
  state.stateVersion = (state.stateVersion ?? 1) + 1;
}

/** Guard: no state changes after a terminal outcome. */
function assertMutable(state: NegotiationSession): void {
  if (state.status === 'completed' || state.status === 'abandoned') {
    throw new EngineError('This negotiation is already closed.', 409);
  }
  if (['full', 'walked_away', 'failed'].includes(state.agreementStatus)) {
    throw new EngineError('This negotiation has already ended.', 409);
  }
}

function initialTrust(caseDef: CaseDefinition, participantId: string): number {
  const priv = caseDef.participantPrivate[participantId];
  if (!priv) return 50;
  let score = 50;
  score += priv.cooperativeness === 'high' ? 8 : priv.cooperativeness === 'low' ? -8 : 0;
  score -= priv.bluffTendency === 'high' ? 6 : 0;
  score += priv.influence === 'high' ? 2 : 0;
  return clamp(score, 10, 90);
}

function adjustTrust(
  state: NegotiationSession,
  deps: ResolvedDeps,
  participantId: string,
  delta: number,
  reason: string,
): void {
  const trust = state.trust.find((t) => t.participantId === participantId);
  if (!trust || delta === 0) return;
  const from = trust.score;
  trust.score = clamp(trust.score + delta, 0, 100);
  if (trust.score === from) return;
  trust.notes.push(reason);
  if (trust.notes.length > 20) trust.notes.shift();
  makeEvent(state, deps, 'trust_changed', { participantId, from, to: trust.score, reason });
}

function allRequiredAccepted(offer: Offer, caseDef: CaseDefinition): boolean {
  const acceptances = new Set(offer.acceptances ?? []);
  return (
    acceptances.has('player') &&
    caseDef.participants.every(
      (p) => !caseDef.participantPrivate[p.id]?.requiredForAgreement || acceptances.has(p.id),
    )
  );
}

function maybeFinalizeAgreement(
  state: NegotiationSession,
  caseDef: CaseDefinition,
  deps: ResolvedDeps,
  offerId: string,
): void {
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer || !allRequiredAccepted(offer, caseDef)) return;
  const validation = validateAgreement(state, caseDef, offerId);
  if (validation.valid) {
    offer.status = 'accepted';
    offer.validated = true;
    offer.respondedAt = deps.now();
    state.agreementStatus = 'full';
    state.agreementOfferId = offer.id;
    makeEvent(state, deps, 'agreement_reached', {
      offerId: offer.id, terms: offer.terms, reason: validation.reason,
    });
    return;
  }
  const alreadyReported = [...state.events].reverse().some(
    (e) => e.type === 'agreement_failed' && e.payload.offerId === offerId,
  );
  if (!alreadyReported) {
    state.agreementStatus = 'none';
    makeEvent(state, deps, 'agreement_failed', {
      offerId,
      reason: validation.reason,
      missingParties: validation.missingParties,
      missingIssues: validation.missingIssues,
    });
  }
}

function activate(state: NegotiationSession, deps: ResolvedDeps, auto: boolean): void {
  if (state.status === 'active') return;
  makeEvent(state, deps, 'session_activated', { auto, turnCount: state.turnCount });
  state.status = 'active';
}

export function createSessionState(
  caseDef: CaseDefinition,
  sessionId?: string,
  deps?: EngineDeps,
): NegotiationSession {
  const d = resolveDeps(deps);
  const now = d.now();
  const state: NegotiationSession = {
    id: sessionId ?? d.id(),
    caseId: caseDef.id,
    status: 'briefing',
    preparation: null,
    offers: [],
    trust: caseDef.participants.map((p) => ({ participantId: p.id, score: initialTrust(caseDef, p.id), notes: [] })),
    agreementStatus: 'none',
    agreementOfferId: null,
    turnCount: 0,
    llmCalls: 0,
    stateVersion: 1,
    events: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  makeEvent(state, d, 'session_started', { caseId: caseDef.id, participants: caseDef.participants.map((p) => p.id) });
  return state;
}

/** Explicit transition briefing/preparation -> active. Idempotent when already active. */
export function activateSession(
  inputState: NegotiationSession,
  opts: { skipPreparation?: boolean } = {},
  deps?: EngineDeps,
): TurnResult {
  const d = resolveDeps(deps);
  const state = clone(inputState);
  assertMutable(state);
  if (state.status === 'active') return { state, messages: [], events: [] };
  if (!state.preparation && !opts.skipPreparation) {
    throw new EngineError('Save a preparation (or skip it explicitly) before activating.', 409);
  }
  const eventCount = state.events.length;
  activate(state, d, false);
  touch(state, d);
  return { state, messages: [], events: state.events.slice(eventCount) };
}

export function savePreparation(
  inputState: NegotiationSession,
  preparation: PreparationInput,
  deps?: EngineDeps,
): TurnResult {
  const d = resolveDeps(deps);
  const state = clone(inputState);
  assertMutable(state);
  if (state.status === 'active') {
    throw new EngineError('Preparation is locked once the negotiation is active.', 409);
  }
  const eventCount = state.events.length;
  state.preparation = clone(preparation);
  if (state.status === 'briefing') state.status = 'preparation';
  makeEvent(state, d, 'preparation_saved', { fields: Object.keys(preparation) });
  touch(state, d);
  return { state, messages: [], events: state.events.slice(eventCount) };
}

/** Apply a player action. Free text never creates numeric terms; use offerTerms. */
export function applyPlayerMessage(
  inputState: NegotiationSession,
  caseDef: CaseDefinition,
  input: {
    content: string;
    target?: string;
    type?: 'message' | 'offer' | 'counteroffer' | 'accept' | 'reject' | 'withdraw' | 'walk_away';
    offerTerms?: unknown;
    offerId?: string;
  },
  deps?: EngineDeps,
): TurnResult {
  const d = resolveDeps(deps);
  const state = clone(inputState);
  assertMutable(state);
  const content = input.content?.trim();
  if (!content) throw new EngineError('Message content cannot be empty.');

  const eventCount = state.events.length;
  const intent = (!input.type || input.type === 'message') ? detectIntent(content) : input.type;
  const target = input.target ?? 'group';
  const message = makeMessage(state, d, 'player', null, 'You', target, content, { intent });
  activate(state, d, true);
  state.turnCount = (state.turnCount ?? 0) + 1;

  if (intent === 'walk_away') {
    state.agreementStatus = 'walked_away';
    makeEvent(state, d, 'walk_away', { reason: content });
    touch(state, d);
    return { state, messages: [message], events: state.events.slice(eventCount) };
  }

  if (intent === 'offer' || intent === 'counteroffer') {
    const terms = validateTerms(caseDef, input.offerTerms);
    let parentId = input.offerId;
    if (intent === 'counteroffer' && !parentId) parentId = latestOpenOffer(state)?.id;
    const parent = parentId ? state.offers.find((o) => o.id === parentId) : undefined;
    if (parentId && !parent) throw new EngineError(`Offer "${parentId}" was not found in this session.`);
    if (parent && !isOpenOffer(parent)) throw new EngineError('That offer is no longer open.');

    const offer: Offer = {
      id: d.id(), sessionId: state.id, proposerType: 'player', proposerId: null,
      proposerName: 'You', terms, message: content, status: 'proposed', createdAt: d.now(),
      acceptances: ['player'], parentOfferId: parent?.id,
    };
    if (parent) {
      parent.status = 'countered';
      parent.respondedAt = d.now();
      parent.respondedBy = 'player';
    }
    state.offers.push(offer);
    message.meta = { ...message.meta, offerId: offer.id, terms };
    makeEvent(state, d, parent ? 'offer_countered' : 'offer_made', {
      offerId: offer.id, parentOfferId: parent?.id ?? null, proposer: 'player', terms,
    });

    if (parent) {
      for (const term of detectConcessions(caseDef, parent.terms, terms)) {
        makeEvent(state, d, 'concession_made', {
          by: 'player', issueId: term.issueId,
          description: `Moved ${termLabel(caseDef, term)} from your previous offer.`,
        });
        adjustTrust(
          state, d,
          parent.proposerType === 'participant' && parent.proposerId ? parent.proposerId : '',
          2, 'You moved toward their position with a structured concession.',
        );
      }
    }
    touch(state, d);
    return { state, messages: [message], events: state.events.slice(eventCount) };
  }

  if (intent === 'accept' || intent === 'reject' || intent === 'withdraw') {
    const offerId = input.offerId ?? latestOpenOffer(state)?.id;
    const offer = offerId ? state.offers.find((o) => o.id === offerId) : undefined;
    if (!offer) throw new EngineError('There is no open offer to respond to.');
    if (!isOpenOffer(offer) && intent !== 'withdraw') throw new EngineError('That offer is no longer open.');
    if (intent === 'accept') {
      offer.acceptances = Array.from(new Set([...(offer.acceptances ?? []), 'player']));
      message.meta = { ...message.meta, offerId: offer.id };
      makeEvent(state, d, 'offer_accepted', { offerId: offer.id, by: 'player' });
      adjustTrust(state, d, offer.proposerId ?? '', 4, 'You accepted a structured offer.');
      maybeFinalizeAgreement(state, caseDef, d, offer.id);
    } else if (intent === 'reject') {
      offer.status = 'rejected';
      offer.respondedAt = d.now();
      offer.respondedBy = 'player';
      makeEvent(state, d, 'offer_rejected', { offerId: offer.id, by: 'player' });
    } else {
      offer.status = 'withdrawn';
      offer.respondedAt = d.now();
      offer.respondedBy = 'player';
      makeEvent(state, d, 'offer_withdrawn', { offerId: offer.id, by: 'player' });
    }
    message.meta = { ...message.meta, offerId: offer.id };
    touch(state, d);
    return { state, messages: [message], events: state.events.slice(eventCount) };
  }

  // General message / question / challenge. Recorded for evidence, never a state change.
  const bluffChallenge = intent === 'challenge' || /\b(bluff|prove|evidence|source|claim|mandate|ceiling)\b/i.test(content);
  message.meta = { ...message.meta, bluffChallenge };
  makeEvent(state, d, 'message_sent', { intent, target, bluffChallenge, excerpt: content.slice(0, 240) });
  if (intent === 'challenge') {
    for (const p of caseDef.participants) {
      if (caseDef.participantPrivate[p.id]?.requiredForAgreement) {
        adjustTrust(state, d, p.id, -1, 'You challenged a claim in the room.');
      }
    }
  }
  touch(state, d);
  return { state, messages: [message], events: state.events.slice(eventCount) };
}

/** Consume structured AI responses. Every state claim is re-validated here. */
export function applyParticipantResponses(
  inputState: NegotiationSession,
  caseDef: CaseDefinition,
  responses: ParticipantResponse[],
  deps?: EngineDeps,
): TurnResult {
  const d = resolveDeps(deps);
  const state = clone(inputState);
  assertMutable(state);
  const eventCount = state.events.length;
  const messages: ChatMessage[] = [];
  const touchedOffers = new Set<string>();

  for (const response of responses) {
    if (!response || response.intent === 'silence') continue;
    const participant = caseDef.participants.find((p) => p.id === response.participantId);
    if (!participant) continue;
    const content = (response.message ?? '').trim();
    if (!content) continue;

    messages.push(makeMessage(
      state, d, 'participant', participant.id, participant.name,
      response.target ?? 'group', content,
      { intent: response.intent, source: response.source, sentiment: response.sentiment ?? 'neutral' },
    ));

    if (response.intent === 'offer' || response.intent === 'counteroffer') {
      try {
        const terms = validateTerms(caseDef, response.proposedOffer);
        const parentId = response.parentOfferId ?? latestOpenOffer(state)?.id;
        const parent = parentId ? state.offers.find((o) => o.id === parentId) : undefined;
        const offer: Offer = {
          id: d.id(), sessionId: state.id, proposerType: 'participant',
          proposerId: participant.id, proposerName: participant.name, terms,
          message: content, status: 'proposed', createdAt: d.now(),
          acceptances: [participant.id], parentOfferId: parent?.id,
        };
        if (parent && isOpenOffer(parent)) {
          parent.status = 'countered';
          parent.respondedAt = d.now();
          parent.respondedBy = participant.id;
        }
        state.offers.push(offer);
        makeEvent(state, d, parent ? 'offer_countered' : 'offer_made', {
          offerId: offer.id, parentOfferId: parent?.id ?? null, proposer: participant.id, terms,
        });
        touchedOffers.add(offer.id);
        if (parent && response.intent === 'counteroffer') {
          const concessions = detectConcessions(caseDef, parent.terms, terms);
          if (concessions.length > 0) {
            makeEvent(state, d, 'concession_made', {
              by: participant.name,
              issueIds: concessions.map((c) => c.issueId),
              description: response.concession ?? `Moved on ${concessions.map((c) => termLabel(caseDef, c)).join(', ')}.`,
            });
          }
        }
      } catch (error) {
        // Malformed AI proposals never become game state.
        messages.push(makeMessage(
          state, d, 'system', null, 'Table', response.target ?? 'group',
          `${participant.name}'s proposal could not be recorded: ${(error as Error).message}.`,
          { reason: 'invalid_ai_offer' },
        ));
        makeEvent(state, d, 'offer_rejected', {
          offerId: null, proposer: participant.id, reason: (error as Error).message,
        });
      }
    }

    const targetOfferId = response.offerId ?? response.parentOfferId;
    if (response.intent === 'accept' && targetOfferId) {
      const offer = state.offers.find((o) => o.id === targetOfferId);
      if (offer) {
        offer.acceptances = Array.from(new Set([...(offer.acceptances ?? []), participant.id]));
        makeEvent(state, d, 'offer_accepted', { offerId: offer.id, by: participant.id });
        adjustTrust(state, d, participant.id, 4, `${participant.name} accepted your structured offer.`);
        touchedOffers.add(offer.id);
      }
    }
    if ((response.intent === 'reject' || response.intent === 'withdraw') && targetOfferId) {
      const offer = state.offers.find((o) => o.id === targetOfferId);
      if (offer && isOpenOffer(offer)) {
        offer.status = response.intent === 'reject' ? 'rejected' : 'withdrawn';
        offer.respondedAt = d.now();
        offer.respondedBy = participant.id;
        makeEvent(state, d, response.intent === 'reject' ? 'offer_rejected' : 'offer_withdrawn', {
          offerId: offer.id, by: participant.id,
        });
      }
    }
    if (response.intent === 'concession') {
      makeEvent(state, d, 'concession_made', {
        by: participant.name,
        description: response.concession ?? `${participant.name} signalled flexibility.`,
      });
      adjustTrust(state, d, participant.id, 2, `${participant.name} made a concession.`);
    }
    if (response.intent === 'challenge') {
      adjustTrust(state, d, participant.id, -2, `${participant.name} challenged your position.`);
    }
    if (response.sentiment === 'positive') adjustTrust(state, d, participant.id, 1, `${participant.name} responded warmly.`);
    else if (response.sentiment === 'negative') adjustTrust(state, d, participant.id, -1, `${participant.name} responded coolly.`);
  }

  for (const offerId of touchedOffers) maybeFinalizeAgreement(state, caseDef, d, offerId);
  touch(state, d);
  return { state, messages, events: state.events.slice(eventCount) };
}

/** Cost/latency instrumentation and one-time degradation notice. */
export function recordTurnMetadata(
  inputState: NegotiationSession,
  meta: TurnMetadata,
  deps?: EngineDeps,
): TurnResult {
  const d = resolveDeps(deps);
  const state = clone(inputState);
  const eventCount = state.events.length;
  state.llmCalls = (state.llmCalls ?? 0) + meta.llmCalls;
  makeEvent(state, d, 'turn_completed', {
    turn: meta.turn, responders: meta.responders, source: meta.source,
    llmCalls: meta.llmCalls, latencyMs: meta.latencyMs,
  });
  if (meta.fallbackUsed && !state.events.some((e) => e.type === 'llm_degraded')) {
    makeEvent(state, d, 'llm_degraded', { reason: 'provider unavailable, malformed or budget exhausted' });
  }
  touch(state, d);
  return { state, messages: [], events: state.events.slice(eventCount) };
}

export function walkAway(
  state: NegotiationSession,
  caseDef: CaseDefinition,
  deps?: EngineDeps,
): TurnResult {
  return applyPlayerMessage(state, caseDef, { content: 'I am walking away from this negotiation.', type: 'walk_away' }, deps);
}

export function finalizeSession(
  inputState: NegotiationSession,
  caseDef: CaseDefinition,
  deps?: EngineDeps,
): FinalizeResult {
  const d = resolveDeps(deps);
  const state = clone(inputState);
  const eventCount = state.events.length;
  if (state.status !== 'completed') {
    if (state.agreementStatus === 'none') {
      state.agreementStatus = 'failed';
      makeEvent(state, d, 'agreement_failed', {
        offerId: state.agreementOfferId,
        reason: 'The negotiation ended without a validated agreement.',
      });
    }
    state.status = 'completed';
    state.completedAt = d.now();
  }
  const debrief = computeDebrief(state, caseDef);
  if (!state.events.some((e) => e.type === 'debrief_generated')) {
    makeEvent(state, d, 'debrief_generated', {
      decisionQuality: debrief.decisionQuality,
      outcomeQuality: debrief.outcomeQuality,
      skills: debrief.skillAssessment.map((s) => ({ skill: s.skill, rating: s.rating })),
    });
  }
  touch(state, d);
  return { state, debrief, events: state.events.slice(eventCount), messages: [] };
}

/** Stable ids make repeated finalizes idempotent in the skill_scores table. */
export function skillRecordsFromDebrief(
  debrief: ReturnType<typeof computeDebrief>,
  deps?: EngineDeps,
) {
  const d = resolveDeps(deps);
  return debrief.skillAssessment.map((s) => ({
    id: `${debrief.sessionId}:${s.skill}`,
    sessionId: debrief.sessionId,
    caseId: debrief.caseId,
    skill: s.skill,
    rating: s.rating,
    score: ratingToScore(s.rating),
    evidence: s.evidence,
    createdAt: d.now(),
  }));
}
