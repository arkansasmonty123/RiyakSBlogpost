import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  App,
  createSessionBoot,
  isSyncGameRepository,
  loadBootSave,
  loadInitialSave,
  persistSaveThrough,
  resetSaveThrough,
} from '@/app/App';
import { createInitialSave } from '@/domain/seed';
import type { SaveGame } from '@/domain/types';
import { DEFAULT_GAME_SLOT, type GameRepository } from '@/storage/gameRepository';
import { getGameRepository, resetGameRepositoryCache } from '@/storage/getGameRepository';
import { localStorageGameRepository } from '@/storage/localStorageGameRepository';
import { SAVE_KEY, type PersistResult } from '@/storage/save';
import { SqliteApiGameRepository } from '@/storage/sqliteApiGameRepository';

/** SSR renders the real tree with the same minimal localStorage stub used by uiSmoke. */
function withLocalSave<T>(save: SaveGame, run: () => T): T {
  const data: Record<string, string> = { [SAVE_KEY]: JSON.stringify(save) };
  const globals = globalThis as Record<string, unknown>;
  const previousWindow = globals.window;
  globals.window = {
    localStorage: {
      getItem: (key: string) => data[key] ?? null,
      setItem: (key: string, value: string) => {
        data[key] = value;
      },
      removeItem: (key: string) => {
        delete data[key];
      },
    },
  };
  try {
    return run();
  } finally {
    globals.window = previousWindow;
  }
}

function asyncRepository(overrides: Partial<GameRepository> = {}): GameRepository {
  return {
    loadGame: vi.fn(async () => createInitialSave()),
    saveGame: vi.fn(async () => ({ ok: true })),
    resetGame: vi.fn(async () => createInitialSave()),
    ...overrides,
  };
}

afterEach(() => {
  resetGameRepositoryCache();
});

describe('App ↔ GameRepository integration (ADR-001)', () => {
  it('keeps localStorage as the default adapter', () => {
    resetGameRepositoryCache();
    expect(getGameRepository()).toBe(localStorageGameRepository);
  });

  it('boots the real App synchronously in default mode, with no loading frame', () => {
    resetGameRepositoryCache();
    const save = createInitialSave();
    save.clock.day = 7;
    const html = withLocalSave(save, () => renderToString(<App />)).replace(/<!-- -->/g, '');
    expect(html).toContain('Day 7');
    expect(html).toContain('Current objective');
    expect(html).not.toContain('Loading your case file');
  });

  it('loads, saves and resets through the sync path of the local adapter', () => {
    const stored = createInitialSave();
    stored.player.name = 'Local Player';
    withLocalSave(stored, () => {
      const boot = createSessionBoot(getGameRepository());
      expect(isSyncGameRepository(boot.repository)).toBe(true);
      expect(loadInitialSave(boot)?.player.name).toBe('Local Player');

      const next = createInitialSave();
      next.player.name = 'Next Player';
      const saved = persistSaveThrough(boot, next);
      expect(saved).not.toBeInstanceOf(Promise);
      expect((saved as PersistResult).ok).toBe(true);
      expect(loadInitialSave(boot)?.player.name).toBe('Next Player');

      const fresh = resetSaveThrough(boot) as SaveGame;
      expect(fresh.player.name).not.toBe('Next Player');
      expect(loadInitialSave(boot)?.player.name).not.toBe('Next Player');
    });
  });

  it('selects the sqlite-api adapter only when explicitly opted in', async () => {
    const env = await import('@/config/env');
    const mode = vi.spyOn(env, 'getStorageMode').mockReturnValue('sqlite-api');
    resetGameRepositoryCache();
    expect(getGameRepository()).toBeInstanceOf(SqliteApiGameRepository);

    mode.mockReturnValue('local');
    resetGameRepositoryCache();
    expect(getGameRepository()).toBe(localStorageGameRepository);
    mode.mockRestore();
  });

  it('defers the first save for async adapters and loads through the mocked repository', async () => {
    const loaded = createInitialSave();
    loaded.clock.day = 6;
    loaded.player.name = 'Remote Player';
    const repo = asyncRepository({ loadGame: vi.fn(async () => loaded) });
    const boot = createSessionBoot(repo);

    expect(isSyncGameRepository(boot.repository)).toBe(false);
    expect(loadInitialSave(boot)).toBeNull();
    expect(await loadBootSave(boot)).toBe(loaded);
    expect(repo.loadGame).toHaveBeenCalledWith(DEFAULT_GAME_SLOT);
  });

  it('throws on async load failure so the UI can block overwrites instead of replacing a valid save', async () => {
    const repo = asyncRepository({
      loadGame: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    await expect(loadBootSave(createSessionBoot(repo))).rejects.toThrow('offline');
  });

  it('routes async save and reset through the mocked repository', async () => {
    const repo = asyncRepository();
    const boot = createSessionBoot(repo);
    const next = createInitialSave();

    const result = await persistSaveThrough(boot, next);
    expect(result).toEqual({ ok: true });
    expect(repo.saveGame).toHaveBeenCalledWith(DEFAULT_GAME_SLOT, next, undefined);

    const fresh = await resetSaveThrough(boot);
    expect(fresh.version).toBe(2);
    expect(repo.resetGame).toHaveBeenCalledWith(DEFAULT_GAME_SLOT);
  });

  it('passes a one-shot force option through the async save helper only', async () => {
    const repo = asyncRepository();
    const boot = createSessionBoot(repo);
    await persistSaveThrough(boot, createInitialSave(), { force: true });
    expect(repo.saveGame).toHaveBeenCalledWith(DEFAULT_GAME_SLOT, expect.anything(), { force: true });
  });

  it('drives sqlite-api load/save/reset with a mocked fetch through the same helpers', async () => {
    const methods: string[] = [];
    const repo = new SqliteApiGameRepository('', async (_input, init) => {
      const method = String(init?.method ?? 'GET');
      methods.push(method);
      return method === 'GET'
        ? new Response(JSON.stringify({ ok: false }), { status: 404 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const boot = createSessionBoot(repo);

    expect(loadInitialSave(boot)).toBeNull();
    expect((await loadBootSave(boot)).version).toBe(2);
    expect((await persistSaveThrough(boot, createInitialSave())).ok).toBe(true);
    expect((await resetSaveThrough(boot)).version).toBe(2);
    expect(methods).toEqual(['GET', 'PUT', 'DELETE']);
  });
});
