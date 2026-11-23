import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from './api';
import { closeDb, getDb } from './db/database';

const originalDbPath = process.env.THE_BAR_DB_PATH;

let server: Server | null = null;
let tempDir: string | null = null;
let baseUrl = '';

async function startTestServer(): Promise<void> {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'the-bar-api-'));
  // The API handler calls getDb() with no options, so it honours this env var
  // as long as the singleton has been closed first.
  closeDb();
  process.env.THE_BAR_DB_PATH = path.join(tempDir, 'test.sqlite');

  server = createServer();
  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject);
    server!.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port');
  baseUrl = `http://127.0.0.1:${address.port}`;
}

interface JsonResponse {
  status: number;
  body: any;
}

async function requestJson(urlPath: string, init?: RequestInit): Promise<JsonResponse> {
  const res = await fetch(`${baseUrl}${urlPath}`, init);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

function putSave(slotId: string, payload: unknown, expectedSavedAt?: string): Promise<JsonResponse> {
  return requestJson(`/api/saves/${slotId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload, ...(expectedSavedAt ? { expectedSavedAt } : {}) }),
  });
}

beforeEach(async () => {
  await startTestServer();
});

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => resolve());
      // Undici keeps idle keep-alive sockets open; close them so shutdown is deterministic.
      server!.closeAllConnections();
    });
    server = null;
  }
  closeDb();
  if (originalDbPath === undefined) delete process.env.THE_BAR_DB_PATH;
  else process.env.THE_BAR_DB_PATH = originalDbPath;
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('ADR-001 persistence over HTTP (server/api.ts)', () => {
  it('GET /api/health reports a healthy sqlite-backed service', async () => {
    const { status, body } = await requestJson('/api/health');
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, service: 'the-bar-db', storage: 'sqlite' });
  });

  it('PUT then GET roundtrips a slot, including on POST', async () => {
    const payload = {
      version: 2,
      savedAt: '2026-11-23T00:00:00.000Z',
      player: { name: 'Test Player' },
      caseFile: { id: 'case-1', title: 'State v. Test' },
    };

    const put = await putSave('slot-1', payload);
    expect(put.status).toBe(200);
    expect(put.body.ok).toBe(true);
    expect(put.body.slot).toMatchObject({
      slotId: 'slot-1',
      schemaVersion: 2,
      savedAt: payload.savedAt,
    });
    expect(put.body.slot.payload.player).toEqual({ name: 'Test Player' });

    const got = await requestJson('/api/saves/slot-1');
    expect(got.status).toBe(200);
    expect(got.body.slot.payload).toEqual(payload);

    const post = await requestJson('/api/saves/slot-2', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: { ...payload, savedAt: '2026-11-23T00:00:01.000Z' } }),
    });
    expect(post.status).toBe(200);
    expect(post.body.slot.slotId).toBe('slot-2');
    expect((await requestJson('/api/saves/slot-2')).body.slot.savedAt).toBe('2026-11-23T00:00:01.000Z');
  });

  it('strips caseFile.canonicalTruth from the stored payload and every API response', async () => {
    const secret = 'canonical-truth-must-never-leak';
    const payload = {
      version: 2,
      savedAt: '2026-11-23T00:00:00.000Z',
      caseFile: { id: 'case-1', canonicalTruth: { secret, hidden: ['witness', 'verdict'] } },
    };

    const put = await putSave('slot-secret', payload);
    expect(put.status).toBe(200);
    expect(put.body.slot.payload.caseFile.id).toBe('case-1');
    expect(put.body.slot.payload.caseFile.canonicalTruth).toBeUndefined();
    expect(JSON.stringify(put.body)).not.toContain(secret);

    // The GET path reads back from SQLite, so this also proves the stored payload is sanitized.
    const got = await requestJson('/api/saves/slot-secret');
    expect(got.status).toBe(200);
    expect(got.body.slot.payload.caseFile.canonicalTruth).toBeUndefined();
    expect(JSON.stringify(got.body)).not.toContain(secret);

    const raw = getDb().prepare('SELECT payload_json FROM save_slots WHERE slot_id = ?').get('slot-secret') as {
      payload_json: string;
    };
    expect(raw.payload_json).not.toContain('canonicalTruth');
    expect(raw.payload_json).not.toContain(secret);

    const listed = await requestJson('/api/saves');
    expect(JSON.stringify(listed.body)).not.toContain(secret);
    const audit = await requestJson('/api/audit');
    expect(JSON.stringify(audit.body)).not.toContain(secret);
  });

  it('DELETE removes the slot and a subsequent GET returns 404', async () => {
    await putSave('slot-del', { version: 2, savedAt: '2026-11-23T00:00:00.000Z' });

    const del = await requestJson('/api/saves/slot-del', { method: 'DELETE' });
    expect(del.status).toBe(200);
    expect(del.body).toMatchObject({ ok: true, deleted: true });

    const got = await requestJson('/api/saves/slot-del');
    expect(got.status).toBe(404);
    expect(got.body).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('GET /api/saves lists stored slots without leaking payloads', async () => {
    await putSave('slot-a', { version: 2, savedAt: '2026-11-23T00:00:00.000Z' });
    await putSave('slot-b', { version: 2, savedAt: '2026-11-23T00:00:01.000Z' });

    const { status, body } = await requestJson('/api/saves');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.slots.map((slot: any) => slot.slotId).sort()).toEqual(['slot-a', 'slot-b']);
    expect(body.slots.every((slot: any) => slot.payload === undefined)).toBe(true);
  });

  it('GET /api/audit records save.upsert and save.delete for a slot', async () => {
    await putSave('slot-audit', { version: 2, savedAt: '2026-11-23T00:00:00.000Z' });
    await requestJson('/api/saves/slot-audit', { method: 'DELETE' });

    const { status, body } = await requestJson('/api/audit?slotId=slot-audit');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    const eventTypes = body.events.map((event: any) => event.eventType);
    expect(eventTypes).toContain('save.upsert');
    expect(eventTypes).toContain('save.delete');
    expect(body.events.every((event: any) => event.slotId === 'slot-audit')).toBe(true);

    const limited = await requestJson('/api/audit?slotId=slot-audit&limit=1');
    expect(limited.body.events).toHaveLength(1);
  });

  it('a stale expectedSavedAt returns 409 SAVE_CONFLICT and does not overwrite the slot', async () => {
    const original = { version: 2, savedAt: '2026-11-23T00:00:00.000Z', marker: 'original-write' };
    await putSave('slot-conflict', original);

    const conflict = await putSave(
      'slot-conflict',
      { version: 2, savedAt: '2026-11-23T00:00:01.000Z', marker: 'stale-write' },
      'definitely-not-the-current-saved-at',
    );
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ ok: false, error: 'SAVE_CONFLICT' });

    const got = await requestJson('/api/saves/slot-conflict');
    expect(got.status).toBe(200);
    expect(got.body.slot.savedAt).toBe(original.savedAt);
    expect(got.body.slot.payload.marker).toBe('original-write');
    expect(got.body.slot.payload.marker).not.toBe('stale-write');
    expect(JSON.stringify(got.body)).not.toContain('stale-write');
  });

  it('a matching expectedSavedAt permits the optimistic-concurrency update', async () => {
    await putSave('slot-cas', { version: 2, savedAt: '2026-11-23T00:00:00.000Z', marker: 'first' });

    const update = await putSave(
      'slot-cas',
      { version: 2, savedAt: '2026-11-23T00:00:01.000Z', marker: 'second' },
      '2026-11-23T00:00:00.000Z',
    );
    expect(update.status).toBe(200);
    expect(update.body.slot.savedAt).toBe('2026-11-23T00:00:01.000Z');
    expect((await requestJson('/api/saves/slot-cas')).body.slot.payload.marker).toBe('second');
  });

  it('malformed JSON returns 400 INVALID_JSON', async () => {
    const res = await fetch(`${baseUrl}/api/saves/slot-1`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{ this is not json',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'INVALID_JSON' });
  });

  it('an oversized payload returns 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await fetch(`${baseUrl}/api/saves/slot-1`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: { blob: 'x'.repeat(2_000_001) } }),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ ok: false, error: 'PAYLOAD_TOO_LARGE' });
  });

  it('an unknown route returns 404 NOT_FOUND', async () => {
    const { status, body } = await requestJson('/api/does-not-exist');
    expect(status).toBe(404);
    expect(body).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('rejects slot IDs outside [A-Za-z0-9_-]{1,64} with 404 NOT_FOUND', async () => {
    const invalidPaths = [
      '/api/saves/',
      '/api/saves/a%2Fb',
      '/api/saves/a%20b',
      '/api/saves/sl%C3%B6t',
      `/api/saves/${'x'.repeat(65)}`,
    ];
    for (const urlPath of invalidPaths) {
      const { status, body } = await requestJson(urlPath);
      expect(status).toBe(404);
      expect(body).toEqual({ ok: false, error: 'NOT_FOUND' });
    }

    const put = await requestJson('/api/saves/a%2Fb', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: { version: 2 } }),
    });
    expect(put.status).toBe(404);
    expect((await requestJson('/api/saves')).body.slots).toEqual([]);
  });

  it('rejects cross-origin and non-JSON mutating requests (CSRF hardening)', async () => {
    const seed = await putSave('default', { version: 2, player: { name: 'Original' } });
    expect(seed.status).toBe(200);

    const crossOrigin = await fetch(`${baseUrl}/api/saves/default`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', origin: 'https://evil.example' },
      body: JSON.stringify({ payload: { version: 2, player: { name: 'Pwned' } } }),
    });
    expect(crossOrigin.status).toBe(403);
    expect(await crossOrigin.json()).toEqual({ ok: false, error: 'FORBIDDEN_ORIGIN' });

    const badContentType = await fetch(`${baseUrl}/api/saves/default`, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ payload: { version: 2, player: { name: 'Pwned' } } }),
    });
    expect(badContentType.status).toBe(415);
    expect(await badContentType.json()).toEqual({ ok: false, error: 'UNSUPPORTED_CONTENT_TYPE' });

    const after = await requestJson('/api/saves/default');
    expect(after.body.slot.payload.player.name).toBe('Original');
  });
});
