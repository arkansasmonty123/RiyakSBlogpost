import { describe, it, expect } from 'vitest';
import type { AIProvider, GenerateStructuredRequest, GenerateStructuredResult } from '../src/shared/ai.js';
import type { OfferTerm } from '../src/shared/types.js';
import { acquisitionCase } from '../src/server/cases/acquisition.js';
import {
  DeterministicProvider, createProvider, buildCharacterContext, deterministicResponse,
  orchestrateTurn, selectResponders,
} from '../src/server/ai/index.js';
import { applyParticipantResponses, applyPlayerMessage, createSessionState } from '../src/server/engine/index.js';

const validTerms: OfferTerm[] = [
  { issueId: 'price', value: 12 },
  { issueId: 'earnout', value: 18 },
  { issueId: 'boardSeats', value: 1 },
  { issueId: 'liabilityCap', value: 2 },
];

class MalformedLLMProvider implements AIProvider {
  readonly name = 'malformed-test';
  readonly usesLLM = true;
  async generateStructured<T>(_request: GenerateStructuredRequest): Promise<GenerateStructuredResult<T>> {
    return { data: { participantId: 'wrong-person', message: 'I accept', intent: 'accept' } as T, source: 'llm' };
  }
}

describe('deterministic fallback', () => {
  it('is the default and never claims to be an LLM', async () => {
    const provider = createProvider({});
    expect(provider).toBeInstanceOf(DeterministicProvider);
    expect(provider.usesLLM).toBe(false);
    const result = await provider.generateStructured({ system: 'x', prompt: 'y', schemaName: 'z' });
    expect(result.data).toBeNull();
    expect(result.source).toBe('deterministic_fallback');
    expect(result.error).toBeTruthy();
  });

  it('accepts an offer inside limits and counters one outside', () => {
    const state = createSessionState(acquisitionCase, 's');
    const context = buildCharacterContext(acquisitionCase, state, [], 'corp-dev-vp')!;
    const accept = deterministicResponse({
      caseDef: acquisitionCase, context, playerIntent: 'offer', playerContent: '', numericTerms: validTerms,
    });
    expect(accept.intent).toBe('accept');
    expect(accept.source).toBe('deterministic_fallback');

    const badTerms = [{ issueId: 'price', value: 20 }, ...validTerms.slice(1)];
    const counter = deterministicResponse({
      caseDef: acquisitionCase, context, playerIntent: 'offer', playerContent: '', numericTerms: badTerms,
    });
    expect(counter.intent).toBe('counteroffer');
    for (const term of counter.proposedOffer ?? []) {
      const issue = acquisitionCase.issues.find((i) => i.id === term.issueId)!;
      expect(term.value).toBeGreaterThanOrEqual(issue.minValue);
      expect(term.value).toBeLessThanOrEqual(issue.maxValue);
    }
  });

  it('selects zero responders for silence/walk-away and few for a substantive message', () => {
    const state = createSessionState(acquisitionCase, 's');
    const messages = [{
      id: 'm1', sessionId: state.id, senderType: 'player' as const, senderId: null,
      senderName: 'You', target: 'group', content: 'Walking away now.', createdAt: '', meta: {},
    }];
    expect(selectResponders(acquisitionCase, state, messages, 'walk_away')).toEqual([]);
    expect(selectResponders(acquisitionCase, state, [{ ...messages[0], content: 'ok' }], 'message')).toEqual([]);
    const selected = selectResponders(acquisitionCase, state,
      [{ ...messages[0], content: 'What is your justification for the price and earnout?' }], 'question');
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.length).toBeLessThanOrEqual(2);
  });

  it('falls back when a provider returns malformed/mismatched output', async () => {
    const d = { id: (() => { let n = 0; return () => `f${++n}`; })(), now: () => '2026-01-01T00:00:00.000Z' };
    const created = createSessionState(acquisitionCase, 's', d);
    const asked = applyPlayerMessage(created, acquisitionCase, {
      content: 'What justifies your price ceiling?', target: 'group',
    }, d);
    let calls = 0;
    const responses = await orchestrateTurn({
      caseDef: acquisitionCase,
      state: asked.state,
      messages: asked.messages.map((m) => ({ ...m, sessionId: 's' })),
      playerIntent: 'question',
      provider: new MalformedLLMProvider(),
      onLlmCall: () => { calls += 1; },
    });
    expect(calls).toBeGreaterThan(0);
    expect(responses.length).toBeGreaterThan(0);
    expect(responses.every((r) => r.source === 'deterministic_fallback')).toBe(true);
  });

  it('honors the LLM call budget and marks fallback responses in chat metadata', async () => {
    const d = { id: (() => { let n = 0; return () => `g${++n}`; })(), now: () => '2026-01-01T00:00:00.000Z' };
    const state = createSessionState(acquisitionCase, 's', d);
    state.llmCalls = 40;
    let calls = 0;
    const responses = await orchestrateTurn({
      caseDef: acquisitionCase,
      state,
      messages: [{ id: 'm', sessionId: state.id, senderType: 'player', senderId: null,
        senderName: 'You', target: 'group', content: 'What is the basis for that price?', createdAt: '' }],
      playerIntent: 'question',
      provider: new MalformedLLMProvider(),
      onLlmCall: () => { calls += 1; },
    });
    expect(calls).toBe(0);
    expect(responses.every((r) => r.source === 'deterministic_fallback')).toBe(true);

    const mapped = applyParticipantResponses(state, acquisitionCase, [{
      participantId: 'corp-dev-vp', target: 'group', message: 'Show me evidence.',
      intent: 'challenge', source: 'deterministic_fallback',
    }], d);
    expect(mapped.messages[0].meta?.source).toBe('deterministic_fallback');
    expect(JSON.stringify(mapped.messages)).not.toContain('SECRET INTERNAL REASONING');
  });
});
