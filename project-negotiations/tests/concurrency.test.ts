import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AIProvider, GenerateStructuredRequest, GenerateStructuredResult } from '../src/shared/ai.js';
import type { Server } from 'node:http';
import { closeDb } from '../src/server/db/index.js';

process.env.NEGOTIATION_DB_PATH = ':memory:';

/**
 * Deterministic proof of the in-process per-session turn lock: the first turn
 * is held inside the provider, so a second concurrent turn must be rejected
 * with 409 and must not corrupt session state. This is a single-instance
 * guarantee only (see docs/ARCHITECTURE.md).
 */
describe('in-process per-session turn lock', () => {
  let server: Server;
  let base: string;
  let release!: () => void;
  let signalEntered!: () => void;
  const entered = new Promise<void>((resolve) => { signalEntered = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });

  class GatedProvider implements AIProvider {
    readonly name = 'gated-test';
    readonly usesLLM = true;
    async generateStructured<T>(_req: GenerateStructuredRequest): Promise<GenerateStructuredResult<T>> {
      signalEntered();
      await gate; // hold the first turn open while the second request arrives
      return { data: null, source: 'deterministic_fallback', error: 'gated for test' };
    }
  }

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    return { status: res.status, body: await res.json() as any };
  }
  const post = (p: string, b: unknown = {}) => api(p, { method: 'POST', body: JSON.stringify(b) });

  beforeAll(async () => {
    const { createApp } = await import('../src/server/app.js');
    const app = createApp(new GatedProvider());
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });

  afterAll(async () => {
    release(); // unblock in case an assertion failed before the explicit release
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDb();
  });

  it('rejects a second concurrent turn and commits exactly one', async () => {
    const created = await post('/api/sessions', { caseId: 'acquisition' });
    expect(created.status).toBe(201);
    const id = created.body.session.id as string;
    await post(`/api/sessions/${id}/activate`, { skipPreparation: true });

    const first = post(`/api/sessions/${id}/messages`, {
      content: 'What is the basis for your price and earnout terms?',
      target: 'corp-dev-vp', // guaranteed responder so the gate is reached
    });
    await entered;

    const second = await post(`/api/sessions/${id}/messages`, {
      content: 'Can you justify the liability cap and board seats?', target: 'group',
    });
    expect(second.status).toBe(409);

    release();
    expect((await first).status).toBe(200);

    const after = await api(`/api/sessions/${id}`);
    expect(after.body.session.turnCount).toBe(1);
  }, 10_000);
});
