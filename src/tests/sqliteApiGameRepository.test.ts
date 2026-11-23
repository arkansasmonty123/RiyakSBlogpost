import { describe, expect, it } from 'vitest';
import { SqliteApiGameRepository } from '@/storage/sqliteApiGameRepository';
import { createInitialSave } from '@/domain/seed';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('SqliteApiGameRepository', () => {
  it('loads fresh save on 404', async () => {
    const repo = new SqliteApiGameRepository('', async () => jsonResponse({ ok: false }, 404));
    const save = await repo.loadGame('default');
    expect(save.version).toBe(2);
    expect(save.caseFile.canonicalTruth.actualEvents.length).toBeGreaterThan(0);
  });

  it('loads and hydrates save payload, never trusting canonical truth', async () => {
    const base = createInitialSave();
    const payload = {
      ...base,
      player: { ...base.player, name: 'Loaded' },
      caseFile: { ...base.caseFile, canonicalTruth: { actualEvents: ['TAMPER'] } },
    };
    const repo = new SqliteApiGameRepository('', async () => jsonResponse({ ok: true, slot: { payload } }));
    const save = await repo.loadGame('default');
    expect(save.player.name).toBe('Loaded');
    expect(save.caseFile.canonicalTruth.actualEvents).not.toContain('TAMPER');
  });

  it('saves player-safe payload without canonical truth', async () => {
    let seenBody: unknown = null;
    const repo = new SqliteApiGameRepository('', async (_input, init) => {
      seenBody = JSON.parse(String(init?.body ?? '{}'));
      return jsonResponse({ ok: true, slot: { slotId: 'default' } });
    });
    const save = createInitialSave();
    const result = await repo.saveGame('default', save);
    expect(result.ok).toBe(true);
    const body = seenBody as { payload?: Record<string, unknown> };
    expect(body.payload).toBeTruthy();
    expect(JSON.stringify(body.payload).toLowerCase()).not.toContain('canonicaltruth');
  });

  it('returns ok:false on save HTTP failure', async () => {
    const repo = new SqliteApiGameRepository('', async () => jsonResponse({ ok: false }, 500));
    const result = await repo.saveGame('default', createInitialSave());
    expect(result.ok).toBe(false);
  });

  it('reset deletes slot and returns fresh save', async () => {
    let method = '';
    const repo = new SqliteApiGameRepository('', async (_input, init) => {
      method = String(init?.method ?? 'GET');
      return jsonResponse({ ok: true, deleted: true });
    });
    const save = await repo.resetGame('default');
    expect(method).toBe('DELETE');
    expect(save.version).toBe(2);
  });

  it('imports local save on 404 when migration source has data', async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const local = createInitialSave();
    local.player.name = 'Imported';
    const repo = new SqliteApiGameRepository(
      '',
      async (input, init) => {
        const method = String(init?.method ?? 'GET');
        calls.push({ url: String(input), method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        if (method === 'GET') return jsonResponse({ ok: false }, 404);
        return jsonResponse({ ok: true, slot: { slotId: 'default' } });
      },
      {
        hasLocalSave: () => true,
        loadLocalSave: () => local,
      },
    );
    const save = await repo.loadGame('default');
    expect(save.player.name).toBe('Imported');
    expect(calls.some((c) => c.method === 'PUT')).toBe(true);
    const put = calls.find((c) => c.method === 'PUT');
    expect(JSON.stringify(put?.body).toLowerCase()).not.toContain('canonicaltruth');
  });

  it('returns fresh save on 404 when no migration source', async () => {
    const repo = new SqliteApiGameRepository('', async () => jsonResponse({ ok: false }, 404));
    const save = await repo.loadGame('missing');
    expect(save.player.name).not.toBe('Imported');
    expect(save.version).toBe(2);
  });
});
