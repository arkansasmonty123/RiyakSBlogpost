import { describe, expect, it } from 'vitest';
import { LocalStorageGameRepository } from '@/storage/localStorageGameRepository';
import { DEFAULT_GAME_SLOT } from '@/storage/gameRepository';
import type { StorageLike } from '@/storage/save';
import { createInitialSave } from '@/domain/seed';

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe('GameRepository (localStorage adapter)', () => {
  it('loads initial save for empty slot', async () => {
    const repo = new LocalStorageGameRepository(memoryStorage());
    const save = await repo.loadGame(DEFAULT_GAME_SLOT);
    expect(save.version).toBe(2);
    expect(save.caseFile.id).toBeTruthy();
  });

  it('saves and loads roundtrip', async () => {
    const repo = new LocalStorageGameRepository(memoryStorage());
    const save = createInitialSave();
    save.player.name = 'Test Player';
    const result = await repo.saveGame(DEFAULT_GAME_SLOT, save);
    expect(result.ok).toBe(true);
    const loaded = await repo.loadGame(DEFAULT_GAME_SLOT);
    expect(loaded.player.name).toBe('Test Player');
  });

  it('resetGame returns fresh save and clears slot', async () => {
    const repo = new LocalStorageGameRepository(memoryStorage());
    const save = createInitialSave();
    save.player.name = 'Changed';
    await repo.saveGame(DEFAULT_GAME_SLOT, save);
    const fresh = await repo.resetGame(DEFAULT_GAME_SLOT);
    expect(fresh.player.name).not.toBe('Changed');
    const loaded = await repo.loadGame(DEFAULT_GAME_SLOT);
    expect(loaded.player.name).not.toBe('Changed');
  });

  it('does not persist canonicalTruth', async () => {
    const storage = memoryStorage();
    const repo = new LocalStorageGameRepository(storage);
    const save = createInitialSave();
    await repo.saveGame(DEFAULT_GAME_SLOT, save);
    const raw = storage.getItem('the-bar-save-v2');
    expect(raw).toBeTruthy();
    expect(raw!.toLowerCase()).not.toContain('canonicaltruth');
    expect(raw!.toLowerCase()).not.toContain('actualevents');
  });

  it('isolates named slots', async () => {
    const repo = new LocalStorageGameRepository(memoryStorage());
    const a = createInitialSave();
    a.player.name = 'Slot A';
    const b = createInitialSave();
    b.player.name = 'Slot B';
    await repo.saveGame('a', a);
    await repo.saveGame('b', b);
    expect((await repo.loadGame('a')).player.name).toBe('Slot A');
    expect((await repo.loadGame('b')).player.name).toBe('Slot B');
  });

  it('sync methods behave same as async for localStorage adapter', () => {
    const repo = new LocalStorageGameRepository(memoryStorage());
    const save = createInitialSave();
    save.player.name = 'Sync';
    const result = repo.saveGameSync(DEFAULT_GAME_SLOT, save);
    expect(result.ok).toBe(true);
    expect(repo.loadGameSync(DEFAULT_GAME_SLOT).player.name).toBe('Sync');
    const fresh = repo.resetGameSync(DEFAULT_GAME_SLOT);
    expect(fresh.player.name).not.toBe('Sync');
  });
});
