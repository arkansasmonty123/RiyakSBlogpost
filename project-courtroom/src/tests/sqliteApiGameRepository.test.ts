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
        clearLocalSave: () => {},
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

describe('SqliteApiGameRepository optimistic concurrency', () => {
  it('does not send expectedSavedAt until the server savedAt is known, then uses the PUT ack', async () => {
    const bodies: any[] = [];
    let puts = 0;
    const repo = new SqliteApiGameRepository('', async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')));
      puts += 1;
      return jsonResponse({ ok: true, slot: { slotId: 'default', savedAt: `ack-${puts}` } });
    });

    expect((await repo.saveGame('default', createInitialSave())).ok).toBe(true);
    expect(bodies[0].expectedSavedAt).toBeUndefined();
    expect((await repo.saveGame('default', createInitialSave())).ok).toBe(true);
    // The ack's savedAt wins over the locally generated payload stamp.
    expect(bodies[1].expectedSavedAt).toBe('ack-1');
  });

  it('tracks savedAt from GET (slot.savedAt, falling back to payload.savedAt)', async () => {
    let putBody: any = null;
    const repo = new SqliteApiGameRepository('', async (_input, init) => {
      if (String(init?.method ?? 'GET') === 'PUT') {
        putBody = JSON.parse(String(init?.body ?? '{}'));
        return jsonResponse({ ok: true, slot: { savedAt: 'new-stamp' } });
      }
      return jsonResponse({ ok: true, slot: { payload: { version: 2, savedAt: 'loaded-stamp' } } });
    });
    await repo.loadGame('default');
    await repo.saveGame('default', createInitialSave());
    expect(putBody.expectedSavedAt).toBe('loaded-stamp');
  });

  it('prefers slot.savedAt over payload.savedAt when both are present', async () => {
    let putBody: any = null;
    const repo = new SqliteApiGameRepository('', async (_input, init) => {
      if (String(init?.method ?? 'GET') === 'PUT') {
        putBody = JSON.parse(String(init?.body ?? '{}'));
        return jsonResponse({ ok: true, slot: { savedAt: 'new-stamp' } });
      }
      return jsonResponse({
        ok: true,
        slot: { savedAt: 'slot-stamp', payload: { version: 2, savedAt: 'payload-stamp' } },
      });
    });
    await repo.loadGame('default');
    await repo.saveGame('default', createInitialSave());
    expect(putBody.expectedSavedAt).toBe('slot-stamp');
  });

  it('returns a distinguishable conflict result on 409 and keeps guarding with the old stamp', async () => {
    const bodies: any[] = [];
    const repo = new SqliteApiGameRepository('', async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')));
      return bodies.length === 1
        ? jsonResponse({ ok: true, slot: { savedAt: 'server-stamp' } })
        : jsonResponse({ ok: false, error: 'SAVE_CONFLICT' }, 409);
    });
    await repo.saveGame('default', createInitialSave());

    expect(await repo.saveGame('default', createInitialSave())).toEqual({
      ok: false,
      reason: 'SAVE_CONFLICT',
      conflict: true,
    });
    expect(bodies[1].expectedSavedAt).toBe('server-stamp');
    // A conflict never silently disables the guard for the next write.
    await repo.saveGame('default', createInitialSave());
    expect(bodies[2].expectedSavedAt).toBe('server-stamp');
  });

  it('force omits expectedSavedAt for that write only', async () => {
    const bodies: any[] = [];
    const repo = new SqliteApiGameRepository('', async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')));
      return jsonResponse({ ok: true, slot: { savedAt: `ack-${bodies.length}` } });
    });
    await repo.saveGame('default', createInitialSave());

    expect((await repo.saveGame('default', createInitialSave(), { force: true })).ok).toBe(true);
    expect(bodies[1].expectedSavedAt).toBeUndefined();

    await repo.saveGame('default', createInitialSave());
    expect(bodies[2].expectedSavedAt).toBe('ack-2');
  });

  it('reset clears the tracked savedAt so the next save is unguarded', async () => {
    const bodies: any[] = [];
    const repo = new SqliteApiGameRepository('', async (_input, init) => {
      if (String(init?.method ?? 'GET') === 'PUT') {
        bodies.push(JSON.parse(String(init?.body ?? '{}')));
        return jsonResponse({ ok: true, slot: { savedAt: 'server-stamp' } });
      }
      return jsonResponse({ ok: true, deleted: true });
    });
    await repo.saveGame('default', createInitialSave());
    await repo.resetGame('default');
    await repo.saveGame('default', createInitialSave());
    expect(bodies[1].expectedSavedAt).toBeUndefined();
  });

  it('a 404 load clears a stale savedAt', async () => {
    const bodies: any[] = [];
    let phase: 'put' | 'get' = 'put';
    const repo = new SqliteApiGameRepository('', async (_input, init) => {
      if (phase === 'get') return jsonResponse({ ok: false }, 404);
      bodies.push(JSON.parse(String(init?.body ?? '{}')));
      return jsonResponse({ ok: true, slot: { savedAt: 'server-stamp' } });
    });
    await repo.saveGame('default', createInitialSave());
    phase = 'get';
    await repo.loadGame('default');
    phase = 'put';
    await repo.saveGame('default', createInitialSave());
    expect(bodies[1].expectedSavedAt).toBeUndefined();
  });

  it('migration import does not send a guard for the unknown slot', async () => {
    const putBodies: any[] = [];
    const local = createInitialSave();
    const repo = new SqliteApiGameRepository(
      '',
      async (_input, init) => {
        if (String(init?.method ?? 'GET') === 'PUT') {
          putBodies.push(JSON.parse(String(init?.body ?? '{}')));
          return jsonResponse({ ok: true, slot: { savedAt: 'imported-stamp' } });
        }
        return jsonResponse({ ok: false }, 404);
      },
      { hasLocalSave: () => true, loadLocalSave: () => local, clearLocalSave: () => {} },
    );
    await repo.loadGame('default');
    expect(putBodies).toHaveLength(1);
    expect(putBodies[0].expectedSavedAt).toBeUndefined();
  });
});

describe('SqliteApiGameRepository slot ID hardening', () => {
  const invalidIds = ['', 'a/b', 'a b', 'a\nb', 'slöt', 'x'.repeat(65), 'a%2Fb'];

  it('normalizes invalid slot IDs to the default slot instead of issuing malformed URLs', async () => {
    const urls: string[] = [];
    const repo = new SqliteApiGameRepository('', async (input) => {
      urls.push(String(input));
      return jsonResponse({ ok: false }, 404);
    });

    for (const id of invalidIds) await repo.loadGame(id);
    expect(urls).toEqual(invalidIds.map(() => '/api/saves/default'));

    await repo.loadGame('slot-1');
    await repo.loadGame('_');
    expect(urls.slice(invalidIds.length)).toEqual(['/api/saves/slot-1', '/api/saves/_']);
  });

  it('save/reset share the normalized slot so the concurrency guard stays consistent', async () => {
    const putBodies: any[] = [];
    const methods: string[] = [];
    const repo = new SqliteApiGameRepository('', async (input, init) => {
      const method = String(init?.method ?? 'GET');
      methods.push(method);
      expect(String(input)).toBe('/api/saves/default');
      if (method === 'PUT') {
        putBodies.push(JSON.parse(String(init?.body ?? '{}')));
        return jsonResponse({ ok: true, slot: { savedAt: `stamp-${putBodies.length}` } });
      }
      return jsonResponse({ ok: true, deleted: true });
    });

    for (const id of invalidIds) expect((await repo.saveGame(id, createInitialSave())).ok).toBe(true);
    expect(putBodies[0].expectedSavedAt).toBeUndefined();
    expect(putBodies[1].expectedSavedAt).toBe('stamp-1');

    await repo.resetGame('a/b');
    expect(methods[methods.length - 1]).toBe('DELETE');
    expect((await repo.saveGame('a/b', createInitialSave())).ok).toBe(true);
    expect(putBodies[putBodies.length - 1].expectedSavedAt).toBeUndefined();
  });

  it('normalizes slot IDs before consulting the migration source', async () => {
    const queried: string[] = [];
    const repo = new SqliteApiGameRepository('', async () => jsonResponse({ ok: false }, 404), {
      hasLocalSave: (id) => {
        queried.push(id);
        return false;
      },
      loadLocalSave: () => createInitialSave(),
      clearLocalSave: () => {},
    });
    await repo.loadGame('bad/id');
    expect(queried).toEqual(['default']);
  });
});
