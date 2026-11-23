/**
 * OPT-IN real LLM end-to-end verification.
 *
 * Skipped by default so `npm test` stays hermetic. To run against a real
 * OpenAI-compatible provider (see docs/TESTING.md):
 *
 *   LLM_E2E=1 LLM_PROVIDER=openai LLM_MODEL=gpt-4o-mini LLM_API_KEY=... \
 *     npx vitest run tests/llm-e2e.test.ts
 *
 * Or for a local Ollama server:
 *
 *   LLM_E2E=1 LLM_PROVIDER=local LLM_MODEL=qwen3.5:2b \
 *     LLM_URL=http://127.0.0.1:11434/v1/chat/completions \
 *     LLM_TIMEOUT_MS=120000 npx vitest run tests/llm-e2e.test.ts
 *
 * If LLM_E2E=1 is set without usable credentials, the suite FAILS LOUDLY
 * (it never silently falls back and reports success).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import type { AIProvider, GenerateStructuredRequest, GenerateStructuredResult } from '../src/shared/ai.js';
import type { Express } from 'express';
import type { Server } from 'node:http';
import { createProvider } from '../src/server/ai/provider.js';
import { closeDb } from '../src/server/db/index.js';

const enabled = process.env.LLM_E2E === '1';
const DB_FILE = `/tmp/opencode/neg-llm-e2e-${process.pid}.db`;

describe.skipIf(!enabled)('real LLM end-to-end (opt-in)', () => {
  let app: Express;
  let server: Server;
  let base: string;

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    return { status: res.status, body: await res.json() as any };
  }
  const post = (path: string, body: unknown = {}) => api(path, { method: 'POST', body: JSON.stringify(body) });

  beforeAll(async () => {
    process.env.NEGOTIATION_DB_PATH = DB_FILE;
    for (const s of ['', '-wal', '-shm']) fs.rmSync(`${DB_FILE}${s}`, { force: true });
    closeDb();
    const provider = createProvider();
    if (!provider.usesLLM) {
      throw new Error(
        'LLM_E2E=1 requires a real provider: set LLM_API_KEY (or OPENAI_API_KEY/GEMINI_API_KEY), '
        + 'or LLM_PROVIDER=local with a running OpenAI-compatible server. '
        + 'No credentials were detected, so real LLM verification cannot run.',
      );
    }
    const { createApp } = await import('../src/server/app.js');
    app = createApp(provider);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDb();
    for (const s of ['', '-wal', '-shm']) fs.rmSync(`${DB_FILE}${s}`, { force: true });
  });

  it('drives a complete negotiation through the real provider with distinct participants and engine authority', async () => {
    const created = await post('/api/sessions', { caseId: 'acquisition' });
    expect(created.status).toBe(201);
    const id = created.body.session.id as string;

    const prep = await post(`/api/sessions/${id}/preparation`, {
      preparation: {
        objectives: 'Protect price and liability', batna: 'Keep the company',
        reservationPoint: '$10M', predictions: 'They need the government contract',
      },
    });
    expect(prep.status).toBe(200);

    // Turn 1: a structured offer (engine tracks terms; LLM suggests reactions).
    const offer = await post(`/api/sessions/${id}/messages`, {
      content: 'Here is my package: $12M price with a 20% earnout, one board seat and a $2M liability cap.',
      type: 'offer',
      offerTerms: [
        { issueId: 'price', value: 12 }, { issueId: 'earnout', value: 18 },
        { issueId: 'boardSeats', value: 1 }, { issueId: 'liabilityCap', value: 2 },
      ],
      expectedStateVersion: prep.body.session.stateVersion,
    });
    expect(offer.status).toBe(200);
    expect(offer.body.session.offers.length).toBeGreaterThanOrEqual(1);

    // Turn 2: a substantive group question to elicit further reactions.
    const asked = await post(`/api/sessions/${id}/messages`, {
      content: 'What justifies the price ceiling and the earnout structure you described?',
      expectedStateVersion: offer.body.session.stateVersion,
    });
    expect(asked.status).toBe(200);

    const all = [...offer.body.messages, ...asked.body.messages];
    const participants = all.filter((m: any) => m.senderType === 'participant');
    expect(participants.length).toBeGreaterThan(0);
    // Distinct AI participants (not one voice repeated).
    expect(new Set(participants.map((m: any) => m.senderId)).size).toBeGreaterThanOrEqual(2);
    // At least one response came from the real LLM path, and every response is
    // explicitly labeled with its source (no unlabeled/fabricated LLM output).
    expect(participants.some((m: any) => m.meta?.source === 'llm')).toBe(true);
    expect(participants.every((m: any) => m.meta?.source === 'llm' || m.meta?.source === 'deterministic_fallback')).toBe(true);
    expect(asked.body.session.llmCalls).toBeGreaterThan(0);
    expect(asked.body.session.stateVersion).toBeGreaterThan(1);

    // Debrief completes and includes concept lessons grounded in prep.
    const finalized = await post(`/api/sessions/${id}/finalize`, {
      expectedStateVersion: asked.body.session.stateVersion,
    });
    expect(finalized.status).toBe(200);
    expect(finalized.body.debrief.conceptLessons.map((l: any) => l.concept)).toContain('BATNA / Reservation price');
    expect(finalized.body.debrief.conceptLessons.map((l: any) => l.concept)).toContain('Prediction calibration');
  }, 180_000);

  it('keeps the engine authoritative when the LLM is degraded, malformed or times out', async () => {
    // A stub that misbehaves the way a real provider can (malformed JSON, then
    // a thrown/aborted request). It exercises the SAME orchestrator fallback
    // path a real provider uses; deterministic unit coverage lives in ai-fallback.test.ts.
    class FlakyProvider implements AIProvider {
      readonly name = 'flaky-test';
      readonly usesLLM = true;
      private n = 0;
      async generateStructured<T>(_req: GenerateStructuredRequest): Promise<GenerateStructuredResult<T>> {
        this.n += 1;
        if (this.n === 1) return { data: { participantId: 'wrong', message: 'x', intent: 'accept' } as T, source: 'llm' };
        throw new Error('simulated timeout');
      }
    }
    const { orchestrateTurn } = await import('../src/server/ai/orchestrator.js');
    const { applyParticipantResponses, createSessionState } = await import('../src/server/engine/index.js');
    const { acquisitionCase } = await import('../src/server/cases/acquisition.js');

    const state = createSessionState(acquisitionCase, 'flaky');
    const messages = [{
      id: 'm', sessionId: 'flaky', senderType: 'player' as const, senderId: null,
      senderName: 'You', target: 'group', content: 'What justifies the price and earnout terms?',
      createdAt: new Date().toISOString(), meta: {},
    }];
    const responses = await orchestrateTurn({
      caseDef: acquisitionCase, state, messages, playerIntent: 'question',
      provider: new FlakyProvider(),
    });
    expect(responses.length).toBeGreaterThan(0);
    expect(responses.every((r) => r.source === 'deterministic_fallback')).toBe(true);

    // Even if a response claims acceptance, no agreement is created without
    // engine validation of structured terms.
    const result = applyParticipantResponses(state, acquisitionCase, responses.map((r) => ({
      ...r, intent: 'accept' as const, offerId: 'does-not-exist',
    })));
    expect(result.state.agreementStatus).toBe('none');
  });
});
