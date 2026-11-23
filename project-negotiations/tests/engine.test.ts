import { describe, it, expect } from 'vitest';
import { acquisitionCase } from '../src/server/cases/acquisition.js';
import { fragilePeaceCase } from '../src/server/cases/fragile-peace.js';
import { walkoutCase } from '../src/server/cases/walkout.js';
import type { OfferTerm, PreparationInput } from '../src/shared/types.js';
import type { ParticipantResponse } from '../src/shared/ai.js';
import {
  applyParticipantResponses, applyPlayerMessage, createSessionState, finalizeSession,
  savePreparation, validateAgreement, walkAway, issueScore,
} from '../src/server/engine/index.js';

function deps() {
  let n = 0;
  return { id: () => `t${++n}`, now: () => '2026-01-01T00:00:00.000Z' };
}

const prep: PreparationInput = {
  objectives: 'Protect price and liability',
  batna: 'Walk away and keep the company',
  reservationPoint: '$10M price, $3M liability',
  openingPosition: '$17M',
  leverage: 'Vision benchmark advantage',
  concessions: 'Board seat first',
  questions: 'Why is $14M a ceiling?',
  predictions: 'They need the government contract',
  strategy: 'Anchor high, trade board seat for price',
};

const validTerms: OfferTerm[] = [
  { issueId: 'price', value: 12 },
  { issueId: 'earnout', value: 18 },
  { issueId: 'boardSeats', value: 1 },
  { issueId: 'liabilityCap', value: 2 },
];

describe('engine session lifecycle', () => {
  it('creates a session with trust, counters and a start event', () => {
    const state = createSessionState(acquisitionCase, 'session-1', deps());
    expect(state.id).toBe('session-1');
    expect(state.status).toBe('briefing');
    expect(state.trust).toHaveLength(acquisitionCase.participants.length);
    expect(state.turnCount).toBe(0);
    expect(state.llmCalls).toBe(0);
    expect(state.stateVersion).toBe(1);
    expect(state.events.map((e) => e.type)).toContain('session_started');
  });

  it('saves preparation and activates explicitly or on the first message', () => {
    const d = deps();
    const created = createSessionState(acquisitionCase, 's', d);
    const prepared = savePreparation(created, prep, d);
    expect(prepared.state.status).toBe('preparation');
    const messaged = applyPlayerMessage(prepared.state, acquisitionCase, {
      content: 'Let us talk about the price.', target: 'group',
    }, d);
    expect(messaged.state.status).toBe('active');
    expect(messaged.state.turnCount).toBe(1);
    expect(messaged.messages).toHaveLength(1);
    expect(messaged.events.map((e) => e.type)).toContain('session_activated');
  });
});

describe('offer and counteroffer tracking', () => {
  it('records offers, links counteroffers and logs concessions', () => {
    const d = deps();
    const created = createSessionState(acquisitionCase, 's', d);
    const first = applyPlayerMessage(created, acquisitionCase, {
      content: 'My offer is $14M with a 20% earnout.', type: 'offer',
      offerTerms: [
        { issueId: 'price', value: 14 }, { issueId: 'earnout', value: 20 },
        { issueId: 'boardSeats', value: 1 }, { issueId: 'liabilityCap', value: 2 },
      ],
    }, d);
    expect(first.state.offers).toHaveLength(1);
    expect(first.state.offers[0].acceptances).toEqual(['player']);

    const counter = applyPlayerMessage(first.state, acquisitionCase, {
      content: 'I can move to $12M.', type: 'counteroffer',
      offerId: first.state.offers[0].id, offerTerms: validTerms,
    }, d);
    expect(counter.state.offers).toHaveLength(2);
    expect(counter.state.offers[0].status).toBe('countered');
    expect(counter.state.offers[1].parentOfferId).toBe(first.state.offers[0].id);
    expect(counter.events.map((e) => e.type)).toContain('concession_made');
  });

  it('rejects malformed terms instead of guessing numbers from text', () => {
    const d = deps();
    const state = createSessionState(acquisitionCase, 's', d);
    expect(() => applyPlayerMessage(state, acquisitionCase, {
      content: 'I offer 99 million dollars', type: 'offer', offerTerms: [{ issueId: 'price', value: 99 }],
    }, d)).toThrow(/between/);
    expect(() => applyPlayerMessage(state, acquisitionCase, {
      content: 'I offer something', type: 'offer',
    }, d)).toThrow(/at least one term/);
  });
});

describe('agreement validation (engine is the sole authority)', () => {
  it('requires all parties, all issues and valid terms', () => {
    const d = deps();
    const created = createSessionState(acquisitionCase, 's', d);
    const offered = applyPlayerMessage(created, acquisitionCase, {
      content: 'Here is my package.', type: 'offer', offerTerms: validTerms,
    }, d);
    const offerId = offered.state.offers[0].id;

    const before = validateAgreement(offered.state, acquisitionCase, offerId);
    expect(before.valid).toBe(false);
    expect(before.missingParties).toContain('Dana Reyes');
    expect(before.missingParties).toContain('Elliot Vance');

    const accept = (participantId: string): ParticipantResponse => ({
      participantId, target: 'group', message: 'I accept those terms.',
      intent: 'accept', offerId, source: 'deterministic_fallback',
    });
    const accepted = applyParticipantResponses(offered.state, acquisitionCase, [
      accept('corp-dev-vp'), accept('general-counsel'),
    ], d);

    expect(validateAgreement(accepted.state, acquisitionCase, offerId).valid).toBe(true);
    expect(accepted.state.agreementStatus).toBe('full');
    expect(accepted.events.map((e) => e.type)).toContain('agreement_reached');
  });

  it('flags missing issues, reservation breaches and self-acceptance alone', () => {
    const d = deps();
    const created = createSessionState(acquisitionCase, 's', d);
    const partial = applyPlayerMessage(created, acquisitionCase, {
      content: 'Only price.', type: 'offer', offerTerms: [{ issueId: 'price', value: 12 }],
    }, d);
    const p = validateAgreement(partial.state, acquisitionCase, partial.state.offers[0].id);
    expect(p.missingIssues).toContain('earnout');
    expect(p.missingIssues).toContain('liabilityCap');
    expect(p.valid).toBe(false);

    const breach = applyPlayerMessage(created, acquisitionCase, {
      content: 'Low price.', type: 'offer',
      offerTerms: [{ issueId: 'price', value: 8 }, ...validTerms.slice(1)],
    }, d);
    expect(validateAgreement(breach.state, acquisitionCase, breach.state.offers[0].id).violations.join(' '))
      .toMatch(/reservation point/);
  });

  it('does not let chat text claiming acceptance create an agreement', () => {
    const d = deps();
    const created = createSessionState(acquisitionCase, 's', d);
    const offered = applyPlayerMessage(created, acquisitionCase, {
      content: 'Here is my package.', type: 'offer', offerTerms: validTerms,
    }, d);
    const result = applyParticipantResponses(offered.state, acquisitionCase, [{
      participantId: 'corp-dev-vp', target: 'group',
      message: 'I accept. We have a deal, this agreement is final.',
      intent: 'message', source: 'deterministic_fallback',
    }], d);
    expect(result.state.agreementStatus).toBe('none');
    expect(result.state.agreementOfferId).toBeNull();
  });

  it('never exposes private AI notes in chat metadata', () => {
    const d = deps();
    const state = createSessionState(acquisitionCase, 's', d);
    const result = applyParticipantResponses(state, acquisitionCase, [{
      participantId: 'corp-dev-vp', target: 'group', message: 'Show me the numbers.',
      intent: 'question', internalNote: 'SECRET INTERNAL REASONING', source: 'llm',
    }], d);
    expect(result.messages[0].meta?.source).toBe('llm');
    expect(JSON.stringify(result.messages)).not.toContain('SECRET INTERNAL REASONING');
  });
});

describe('walk-away, finalize and debrief', () => {
  it('records a walk-away and produces a debrief with separated quality ratings', () => {
    const d = deps();
    const prepared = savePreparation(createSessionState(acquisitionCase, 's', d), prep, d);
    const away = walkAway(prepared.state, acquisitionCase, d);
    expect(away.state.agreementStatus).toBe('walked_away');
    const finalized = finalizeSession(away.state, acquisitionCase, d);
    expect(finalized.state.status).toBe('completed');
    expect(finalized.debrief.outcome.id).toBe('walk_away');
    expect(finalized.debrief.hiddenReveals.length).toBe(acquisitionCase.hiddenReveals.length);
    expect(finalized.debrief.skillAssessment).toHaveLength(10);
    expect(finalized.debrief.decisionQuality).toBeDefined();
    expect(finalized.debrief.outcomeQuality).toBeDefined();
  });

  it('rates decision quality from process evidence, independently of outcome', () => {
    const d = deps();
    const bare = finalizeSession(createSessionState(acquisitionCase, 'bare', d), acquisitionCase, d);
    const ready = savePreparation(createSessionState(acquisitionCase, 'ready', d), prep, d);
    const readyFinal = finalizeSession(ready.state, acquisitionCase, d);
    expect(readyFinal.debrief.decisionQuality).not.toBe(bare.debrief.decisionQuality);
    expect(readyFinal.debrief.outcomeQuality).toBe(bare.debrief.outcomeQuality);
  });

  it('grounds skill evidence in observed counts', () => {
    const d = deps();
    const asked = applyPlayerMessage(createSessionState(acquisitionCase, 's', d), acquisitionCase, {
      content: 'Why is $14M your ceiling?', target: 'group',
    }, d);
    const event = asked.events.find((e) => e.type === 'message_sent');
    expect(event?.payload.intent).toBe('question');
    expect(event?.payload.bluffChallenge).toBe(true);
    const debrief = finalizeSession(asked.state, acquisitionCase, d).debrief;
    expect(debrief.skillAssessment.find((s) => s.skill === 'questioning')?.evidence).toMatch(/1 question/);
  });

  it('scores issue value from reservation (0) to ideal (100)', () => {
    expect(issueScore(acquisitionCase, 'price', 10)).toBe(0);
    expect(issueScore(acquisitionCase, 'price', 17)).toBe(100);
    expect(issueScore(acquisitionCase, 'liabilityCap', 3)).toBe(0);
    expect(issueScore(acquisitionCase, 'liabilityCap', 0)).toBe(100);
  });

  it('teaches BATNA and prediction calibration when predictions are documented', () => {
    const d = deps();
    const prepared = savePreparation(createSessionState(acquisitionCase, 'pred', d), prep, d);
    const debrief = finalizeSession(prepared.state, acquisitionCase, d).debrief;
    const concepts = debrief.conceptLessons.map((l) => l.concept);
    expect(concepts).toContain('BATNA / Reservation price');
    const calibration = debrief.conceptLessons.find((l) => l.concept === 'Prediction calibration');
    expect(calibration).toBeDefined();
    // Evidence is grounded in the recorded prediction and the actual outcome.
    expect(calibration!.evidence).toContain('They need the government contract');
    expect(calibration!.evidence).toContain(debrief.outcome.title);
    expect(calibration!.lesson.length).toBeGreaterThan(0);
  });

  it('records a missing-predictions lesson as a missed opportunity, not a fabricated calibration', () => {
    const d = deps();
    const bare = finalizeSession(createSessionState(acquisitionCase, 'bare', d), acquisitionCase, d).debrief;
    const concepts = bare.conceptLessons.map((l) => l.concept);
    expect(concepts).not.toContain('Prediction calibration');
    // BATNA guidance is always present, even with no preparation at all.
    expect(concepts).toContain('BATNA / Reservation price');
    expect(bare.missedOpportunities.some((m) => /No pre-negotiation predictions/.test(m))).toBe(true);
  });
});

describe('release readiness regressions', () => {
  it('detects question/challenge intent even when client sends generic type "message"', () => {
    const d = deps();
    const state = createSessionState(acquisitionCase, 'intent', d);
    const asked = applyPlayerMessage(state, acquisitionCase, {
      content: 'What is your real mandate on the ceiling?', target: 'group', type: 'message',
    }, d);
    const event = asked.events.find((e) => e.type === 'message_sent');
    expect(event?.payload.intent).toBe('question');
    expect(asked.messages[0].meta?.intent).toBe('question');

    const challenged = applyPlayerMessage(asked.state, acquisitionCase, {
      content: 'Prove the ceiling with evidence. Show me the authorization.', target: 'group', type: 'message',
    }, d);
    const challengeEvent = challenged.events.find((e) => e.type === 'message_sent' && e.payload.intent === 'challenge');
    expect(challengeEvent).toBeDefined();
  });

  it('returns an explicit no-agreement outcome (not a signed-deal tier) when finalized without agreement', () => {
    const cases = [acquisitionCase, fragilePeaceCase, walkoutCase];
    for (const caseDef of cases) {
      const d = deps();
      const state = createSessionState(caseDef, `no-deal-${caseDef.id}`, d);
      const finalized = finalizeSession(state, caseDef, d);
      expect(finalized.state.agreementStatus).toBe('failed');
      expect(finalized.debrief.outcome.id).toBe('no_agreement');
      expect(finalized.debrief.outcome.title).toMatch(/No agreement/i);
      expect(finalized.debrief.outcome.rationale).toMatch(/No validated agreement/);
      expect(finalized.debrief.outcome.description).not.toMatch(/signed|deal reached|barely clears/i);
    }
  });
});
