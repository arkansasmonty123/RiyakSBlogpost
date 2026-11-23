import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Express } from 'express';
import type { Server } from 'node:http';
import { DeterministicProvider } from '../src/server/ai/index.js';
import { closeDb } from '../src/server/db/index.js';

process.env.NEGOTIATION_DB_PATH = ':memory:';

async function serve(app: Express): Promise<{ base: string; server: Server }> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const address = server.address();
  return { base: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`, server };
}

describe('deployment hardening headers and opt-in CORS', () => {
  let plain: { base: string; server: Server };
  let cors: { base: string; server: Server };
  const savedOrigins = process.env.ALLOWED_ORIGINS;

  beforeAll(async () => {
    const { createApp } = await import('../src/server/app.js');
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.FRONTEND_URL;
    plain = await serve(createApp(new DeterministicProvider()));

    process.env.ALLOWED_ORIGINS = 'https://app.example.com, https://admin.example.com';
    cors = await serve(createApp(new DeterministicProvider()));
  });

  afterAll(async () => {
    await Promise.all([plain, cors].map(({ server }) => new Promise<void>((resolve) => server.close(() => resolve()))));
    if (savedOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = savedOrigins;
    closeDb();
  });

  it('sets baseline hardening headers on every response', async () => {
    const res = await fetch(`${plain.base}/api/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin');
  });

  it('sends no CORS headers by default and no ACAO for an unlisted origin', async () => {
    const noOrigin = await fetch(`${plain.base}/api/health`);
    expect(noOrigin.headers.get('access-control-allow-origin')).toBeNull();
    const unlisted = await fetch(`${cors.base}/api/health`, { headers: { Origin: 'https://evil.example.com' } });
    expect(unlisted.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('allows a listed origin and answers preflight when CORS is configured', async () => {
    const allowed = await fetch(`${cors.base}/api/health`, { headers: { Origin: 'https://app.example.com' } });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(allowed.headers.get('vary')).toContain('Origin');

    const preflight = await fetch(`${cors.base}/api/sessions`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example.com', 'Access-Control-Request-Method': 'POST' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toContain('POST');
  });
});
