import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../../server/api';
import { closeDb, getDb } from '../../server/db/database';
import { SqliteApiGameRepository, type FetchLike, type MigrationSource } from '@/storage/sqliteApiGameRepository';
import { toPersistedSave } from '@/storage/save';
import { createInitialSave } from '@/domain/seed';

/**
 * End-to-end coverage of the sqlite-api persistence path: a real `createServer()`
 * backed by a temp SQLite file, driven by the real `SqliteApiGameRepository` over
 * real HTTP (global fetch is never mocked here).
 */

const originalDbPath = process.env.THE_BAR_DB_PATH;

let server: Server | null = null;
let tempDir: string | null = null;
let baseUrl = '';

async function startTestServer(): Promise<void> {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'the-bar-e2e-'));
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

describe('SqliteApiGameRepository end-to-end (real HTTP + temp SQLite)', () => {
  it('roundtrips a save through the repository against the real server', async () => {
    const repo = new SqliteApiGameRepository(baseUrl);
    const original = createInitialSave();
    original.player.name = 'E2E Roundtrip Player';
    original.clock.day = 4;

    expect(await repo.saveGame('e2e-roundtrip', original)).toEqual({ ok: true });

    // The server really persisted the slot: a raw HTTP GET sees the player-safe payload.
    const raw = await requestJson('/api/saves/e2e-roundtrip');
    expect(raw.status).toBe(200);
    expect(raw.body.slot.schemaVersion).toBe(2);
    expect(raw.body.slot.payload.player.name).toBe('E2E Roundtrip Player');
    expect(JSON.stringify(raw.body)).not.toContain('canonicalTruth');

    const loaded = await repo.loadGame('e2e-roundtrip');
    expect(loaded.version).toBe(2);
    expect(loaded.player.name).toBe('E2E Roundtrip Player');
    expect(loaded.clock.day).toBe(4);
    expect(loaded.caseFile.id).toBe(original.caseFile.id);
    // Hidden truth is always rebuilt from the deterministic seed, never from storage.
    expect(loaded.caseFile.canonicalTruth).toEqual(createInitialSave().caseFile.canonicalTruth);
  });

  it('never exposes canonical truth in server responses and never trusts it on load', async () => {
    const secret = 'E2E_CANONICAL_TRUTH_SECRET';
    const tampered = 'E2E_TAMPERED_EVENT';
    const repo = new SqliteApiGameRepository(baseUrl);

    // A naive/malicious client PUTs canonicalTruth. The server strips it on write and on
    // every read response (PUT ack, GET, list, audit are all covered by JSON scanning).
    const put = await putSave('e2e-secret', {
      version: 2,
      savedAt: '2026-11-23T00:00:00.000Z',
      player: { name: 'Secret Tester' },
      caseFile: { id: 'case-e2e', canonicalTruth: { actualEvents: [secret], hiddenMotives: [secret] } },
    });
    expect(put.status).toBe(200);
    expect(JSON.stringify(put.body)).not.toContain('canonicalTruth');
    expect(JSON.stringify(put.body)).not.toContain(secret);

    const rawGet = await requestJson('/api/saves/e2e-secret');
    expect(rawGet.status).toBe(200);
    expect(rawGet.body.slot.payload.caseFile.canonicalTruth).toBeUndefined();
    expect(JSON.stringify(rawGet.body)).not.toContain(secret);

    const row = getDb().prepare('SELECT payload_json FROM save_slots WHERE slot_id = ?').get('e2e-secret') as {
      payload_json: string;
    };
    expect(row.payload_json).not.toContain('canonicalTruth');
    expect(row.payload_json).not.toContain(secret);

    // Defense in depth: even if canonicalTruth reaches storage, hydration must ignore it
    // and rebuild from the seed. The player-controlled field IS read, proving the tampered
    // payload was actually consumed by the repository.
    getDb()
      .prepare('UPDATE save_slots SET payload_json = ? WHERE slot_id = ?')
      .run(
        JSON.stringify({
          version: 2,
          savedAt: '2026-11-23T00:00:00.000Z',
          player: { name: 'Tampered Player' },
          caseFile: { id: 'case-e2e', canonicalTruth: { actualEvents: [tampered] } },
        }),
        'e2e-secret',
      );

    const loaded = await repo.loadGame('e2e-secret');
    expect(loaded.player.name).toBe('Tampered Player');
    expect(loaded.caseFile.canonicalTruth.actualEvents).not.toContain(tampered);
    expect(loaded.caseFile.canonicalTruth).toEqual(createInitialSave().caseFile.canonicalTruth);
  });

  it('resetGame deletes the slot so a subsequent repository load returns a fresh save', async () => {
    const repo = new SqliteApiGameRepository(baseUrl);
    const save = createInitialSave();
    save.player.name = 'Before Reset';
    expect((await repo.saveGame('e2e-reset', save)).ok).toBe(true);

    const fresh = await repo.resetGame('e2e-reset');
    expect(fresh.version).toBe(2);
    expect(fresh.player.name).not.toBe('Before Reset');

    // The DELETE really reached the server and removed the slot.
    expect((await requestJson('/api/saves/e2e-reset')).status).toBe(404);

    const loaded = await repo.loadGame('e2e-reset');
    expect(loaded.version).toBe(2);
    expect(loaded.player.name).not.toBe('Before Reset');
  });

  it('returns a fresh seed save when the slot does not exist (404)', async () => {
    expect((await requestJson('/api/saves/e2e-missing')).status).toBe(404);

    const repo = new SqliteApiGameRepository(baseUrl);
    const loaded = await repo.loadGame('e2e-missing');
    expect(loaded.version).toBe(2);
    expect(loaded.player.name).not.toBe('Imported E2E Player');
    expect(loaded.caseFile.canonicalTruth.actualEvents.length).toBeGreaterThan(0);
    expect(loaded.caseFile.canonicalTruth).toEqual(createInitialSave().caseFile.canonicalTruth);
  });

  it('imports a local save into the server slot on 404 when a MigrationSource has data', async () => {
    const local = createInitialSave();
    local.player.name = 'Imported E2E Player';
    const migration: MigrationSource = {
      hasLocalSave: (slotId) => slotId === 'e2e-migrate',
      loadLocalSave: () => local,
    };
    const repo = new SqliteApiGameRepository(baseUrl, fetch, migration);

    const loaded = await repo.loadGame('e2e-migrate');
    expect(loaded.player.name).toBe('Imported E2E Player');

    // The import was actually written to the server over HTTP, player-safe.
    const raw = await requestJson('/api/saves/e2e-migrate');
    expect(raw.status).toBe(200);
    expect(raw.body.slot.payload.player.name).toBe('Imported E2E Player');
    expect(raw.body.slot.payload.caseFile.canonicalTruth).toBeUndefined();
    expect(JSON.stringify(raw.body)).not.toContain('canonicalTruth');

    // Now that the slot exists, a subsequent load reads from the server and does not
    // consult the migration source at all (no 404, so hasLocalSave is never called).
    const migrationCalls: string[] = [];
    const trackingMigration: MigrationSource = {
      hasLocalSave: (slotId) => {
        migrationCalls.push(slotId);
        return true;
      },
      loadLocalSave: () => {
        throw new Error('loadLocalSave must not be called for an existing server slot');
      },
    };
    const repo2 = new SqliteApiGameRepository(baseUrl, fetch, trackingMigration);
    expect((await repo2.loadGame('e2e-migrate')).player.name).toBe('Imported E2E Player');
    expect(migrationCalls).toEqual([]);
  });

  it('returns 409 on a stale expectedSavedAt and surfaces it as a failed repository save', async () => {
    const original = { version: 2, savedAt: '2026-11-23T00:00:00.000Z', marker: 'original' };
    await putSave('e2e-conflict', original);

    const conflict = await putSave(
      'e2e-conflict',
      { version: 2, savedAt: '2026-11-23T00:00:01.000Z', marker: 'stale' },
      'a-stale-expected-saved-at',
    );
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ ok: false, error: 'SAVE_CONFLICT' });
    expect((await requestJson('/api/saves/e2e-conflict')).body.slot.payload.marker).toBe('original');

    // A fresh repository has no known stamp, so its first save is unguarded and overwrites.
    const plainRepo = new SqliteApiGameRepository(baseUrl);
    const nextSave = createInitialSave();
    nextSave.player.name = 'Overwrote Without CAS';
    expect(await plainRepo.saveGame('e2e-conflict', nextSave)).toEqual({ ok: true });
    expect((await requestJson('/api/saves/e2e-conflict')).body.slot.payload.player.name).toBe('Overwrote Without CAS');

    // Once a stamp is known (here injected by a stale fetch wrapper over a real PUT), a 409 is
    // surfaced as a distinguishable conflict result — it never throws and never overwrites.
    const withStaleCas: FetchLike = (input, init) => {
      if (String(init?.method ?? 'GET') !== 'PUT') return fetch(input, init);
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      return fetch(input, {
        ...init,
        body: JSON.stringify({ ...body, expectedSavedAt: 'a-stale-expected-saved-at' }),
      });
    };
    const casRepo = new SqliteApiGameRepository(baseUrl, withStaleCas);
    const casSave = createInitialSave();
    casSave.player.name = 'Should Not Be Written';
    expect(await casRepo.saveGame('e2e-conflict', casSave)).toEqual({
      ok: false,
      reason: 'SAVE_CONFLICT',
      conflict: true,
    });
    expect((await requestJson('/api/saves/e2e-conflict')).body.slot.payload.player.name).toBe('Overwrote Without CAS');
  });

  it('detects an external write after load, reloads it, and supports a one-shot force overwrite', async () => {
    const slot = 'e2e-cas-flow';
    const repo = new SqliteApiGameRepository(baseUrl);
    const mine = createInitialSave();
    mine.player.name = 'My Copy';
    expect((await repo.saveGame(slot, mine)).ok).toBe(true);
    expect((await repo.loadGame(slot)).player.name).toBe('My Copy');

    // Another tab writes a newer version directly over HTTP.
    const external = toPersistedSave(createInitialSave());
    external.player.name = 'Other Tab';
    external.savedAt = '2026-11-23T12:00:00.000Z';
    expect((await putSave(slot, external)).status).toBe(200);

    const conflict = await repo.saveGame(slot, mine);
    expect(conflict).toEqual({ ok: false, reason: 'SAVE_CONFLICT', conflict: true });
    expect((await requestJson(`/api/saves/${slot}`)).body.slot.payload.player.name).toBe('Other Tab');

    // Reload adopts the server copy; the repository re-learns the stamp and can save again.
    const reloaded = await repo.loadGame(slot);
    expect(reloaded.player.name).toBe('Other Tab');
    expect((await repo.saveGame(slot, reloaded)).ok).toBe(true);

    // Force ignores the guard for exactly one write.
    const second = toPersistedSave(createInitialSave());
    second.player.name = 'Second Writer';
    second.savedAt = '2026-11-23T13:00:00.000Z';
    await putSave(slot, second);
    const forcedMine = createInitialSave();
    forcedMine.player.name = 'Forced Win';
    expect((await repo.saveGame(slot, forcedMine, { force: true })).ok).toBe(true);
    expect((await requestJson(`/api/saves/${slot}`)).body.slot.payload.player.name).toBe('Forced Win');

    // Normal conditional writes still conflict afterwards.
    const third = toPersistedSave(createInitialSave());
    third.player.name = 'Third Writer';
    third.savedAt = '2026-11-23T14:00:00.000Z';
    await putSave(slot, third);
    expect(await repo.saveGame(slot, forcedMine)).toMatchObject({ ok: false, conflict: true });
    expect((await requestJson(`/api/saves/${slot}`)).body.slot.payload.player.name).toBe('Third Writer');
  });
});
