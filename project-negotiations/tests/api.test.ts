import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Express } from 'express';
import type { Server } from 'node:http';
import { DeterministicProvider } from '../src/server/ai/index.js';

process.env.NEGOTIATION_DB_PATH = ':memory:';

let app: Express;
let server: Server;
let base: string;

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json();
  return { status: response.status, body } as { status: number; body: any };
}

const post = (path: string, body: unknown = {}) => api(path, { method: 'POST', body: JSON.stringify(body) });

beforeAll(async () => {
  const { createApp } = await import('../src/server/app.js');
  app = createApp(new DeterministicProvider());
  await new Promise<void>((resolve) => { server = app.listen(0, () => resolve()); });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

describe('HTTP API journey', () => {
  it('serves health, case list and a secret-free briefing', async () => {
    const health = await api('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.ok).toBe(true);
    expect(health.body.llm).toBe(false);

    const cases = await api('/api/cases');
    expect(cases.body.cases).toHaveLength(3);

    const detail = await api('/api/cases/acquisition');
    expect(detail.body.case.participants).toHaveLength(5);
    expect(JSON.stringify(detail.body)).not.toContain('Helix finance authorized $16M');
  });

  it('validates bad input and reports unknown resources', async () => {
    expect((await post('/api/sessions', { caseId: 'nope' })).status).toBe(404);
    expect((await api('/api/sessions/does-not-exist')).status).toBe(404);
    expect((await post('/api/sessions', {})).status).toBe(400);
  });

  it('runs a full negotiation to agreement, debrief and skill tracking', async () => {
    const created = await post('/api/sessions', { caseId: 'acquisition' });
    expect(created.status).toBe(201);
    const id = created.body.session.id as string;
    expect(created.body.session.status).toBe('briefing');
    expect(created.body.session.turnCount).toBe(0);
    expect(created.body.session.stateVersion).toBe(1);

    const prepared = await post(`/api/sessions/${id}/preparation`, {
      preparation: {
        objectives: 'Protect price', batna: 'Keep the company', reservationPoint: '$10M',
        openingPosition: '$17M', leverage: 'Benchmark data', concessions: 'Board seat',
        questions: 'Why $14M?', predictions: 'They need the contract', strategy: 'Anchor high',
      },
    });
    expect(prepared.body.session.status).toBe('preparation');

    const messaged = await post(`/api/sessions/${id}/messages`, {
      content: 'Here is my full package.', target: 'group', type: 'offer',
      offerTerms: [
        { issueId: 'price', value: 12 }, { issueId: 'earnout', value: 18 },
        { issueId: 'boardSeats', value: 1 }, { issueId: 'liabilityCap', value: 2 },
      ],
    });
    expect(messaged.status).toBe(200);
    expect(messaged.body.messages.length).toBeGreaterThan(1);
    expect(messaged.body.messages.some((m: any) => m.meta?.source === 'deterministic_fallback')).toBe(true);
    expect(messaged.body.session.agreementStatus).toBe('full');
    expect(messaged.body.session.turnCount).toBe(1);
    expect(messaged.body.session.llmCalls).toBe(0);
    expect(messaged.body.session.stateVersion).toBeGreaterThan(1);
    expect(messaged.body.events.some((e: any) => e.type === 'turn_completed')).toBe(true);
    expect(messaged.body.events.some((e: any) => e.type === 'llm_degraded')).toBe(true);

    const resumed = await api(`/api/sessions/${id}`);
    expect(resumed.body.session.offers.length).toBe(1);
    expect(resumed.body.session.stateVersion).toBe(messaged.body.session.stateVersion);

    const finalized = await post(`/api/sessions/${id}/finalize`, {});
    expect(finalized.status).toBe(200);
    expect(finalized.body.debrief.sessionId).toBe(id);
    const again = await post(`/api/sessions/${id}/finalize`, {});
    expect(again.status).toBe(200);
    expect(again.body.debrief).toEqual(finalized.body.debrief);
    expect(again.body.session.stateVersion).toBe(finalized.body.session.stateVersion);

    const debrief = await api(`/api/sessions/${id}/debrief`);
    expect(debrief.status).toBe(200);
    expect(debrief.body.debrief.skillAssessment).toHaveLength(10);

    const skills = await api('/api/skills');
    expect(skills.body.skills.length).toBe(10);
    expect(skills.body.skills.every((s: any) => s.sessions === 1)).toBe(true);
  });

  it('supports explicit activation and rejects illegal transitions', async () => {
    const created = await post('/api/sessions', { caseId: 'walkout' });
    const id = created.body.session.id as string;
    const blocked = await post(`/api/sessions/${id}/messages`, { content: 'Can we begin?' });
    expect(blocked.status).toBe(409);
    const activated = await post(`/api/sessions/${id}/activate`, { skipPreparation: true });
    expect(activated.status).toBe(200);
    expect(activated.body.session.status).toBe('active');

    const stale = await post(`/api/sessions/${id}/messages`, {
      content: 'What is the wage position?', expectedStateVersion: 1,
    });
    expect(stale.status).toBe(409);
    const valid = await post(`/api/sessions/${id}/messages`, {
      content: 'What is the wage position?',
      expectedStateVersion: activated.body.session.stateVersion,
    });
    expect(valid.status).toBe(200);
  });

  it('supports walk-away and finalized debrief in a separate session', async () => {
    const created = await post('/api/sessions', { caseId: 'walkout' });
    const id = created.body.session.id as string;
    const away = await post(`/api/sessions/${id}/walk-away`, {});
    expect(away.body.session.agreementStatus).toBe('walked_away');
    const finalized = await post(`/api/sessions/${id}/finalize`, {});
    expect(finalized.body.debrief.outcome.id).toBe('walk_away');
    expect(finalized.body.session.status).toBe('completed');
  });

  it('honors optional expectedStateVersion on every mutating endpoint', async () => {
    // Activation: stale version is rejected, current version succeeds.
    const a = await post('/api/sessions', { caseId: 'acquisition' });
    const aid = a.body.session.id as string;
    expect((await post(`/api/sessions/${aid}/activate`, {
      skipPreparation: true, expectedStateVersion: 1,
    })).status).toBe(200);
    expect((await post(`/api/sessions/${aid}/activate`, {
      skipPreparation: true, expectedStateVersion: 1,
    })).status).toBe(409);

    // Preparation: wrapped and raw bodies both honor the guard.
    const p = await post('/api/sessions', { caseId: 'acquisition' });
    const pid = p.body.session.id as string;
    expect((await post(`/api/sessions/${pid}/preparation`, {
      preparation: { batna: 'x' }, expectedStateVersion: 99,
    })).status).toBe(409);
    expect((await post(`/api/sessions/${pid}/preparation`, {
      preparation: { batna: 'x' }, expectedStateVersion: 1,
    })).status).toBe(200);

    // Walk-away: stale version is rejected before any state change.
    const w = await post('/api/sessions', { caseId: 'walkout' });
    const wid = w.body.session.id as string;
    expect((await post(`/api/sessions/${wid}/walk-away`, { expectedStateVersion: 9 })).status).toBe(409);
    expect((await post(`/api/sessions/${wid}/walk-away`, { expectedStateVersion: 1 })).status).toBe(200);

    // Finalize: guard applies on the real finalize path, but idempotent replay
    // (completed + cached debrief) still returns without a version check.
    const f = await post('/api/sessions', { caseId: 'acquisition' });
    const fid = f.body.session.id as string;
    const activated = await post(`/api/sessions/${fid}/activate`, { skipPreparation: true });
    const currentVersion = activated.body.session.stateVersion as number;
    expect((await post(`/api/sessions/${fid}/finalize`, { expectedStateVersion: 1 })).status).toBe(409);
    const done = await post(`/api/sessions/${fid}/finalize`, { expectedStateVersion: currentVersion });
    expect(done.status).toBe(200);
    const replay = await post(`/api/sessions/${fid}/finalize`, { expectedStateVersion: 1 });
    expect(replay.status).toBe(200);
    expect(replay.body.debrief).toEqual(done.body.debrief);
  });
});
