import { DEFAULT_GAME_SLOT, type GameRepository } from './gameRepository';
import { normalizeSlotId } from './slotId';
import { LEGACY_KEY, loadSave, persistSave, resetSave, SAVE_KEY, type PersistResult, type StorageLike } from './save';
import type { SaveGame } from '@/domain/types';

function defaultBrowserStorage(): StorageLike {
  return {
    getItem(key) {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.getItem(key);
      return null;
    },
    setItem(key, value) {
      if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(key, value);
    },
    removeItem(key) {
      if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(key);
    },
  };
}

function slotStorage(base: StorageLike, slotId: string): StorageLike {
  if (slotId === DEFAULT_GAME_SLOT) return base;
  const key = `${SAVE_KEY}:slot:${slotId}`;
  return {
    getItem(requestedKey) {
      if (requestedKey === SAVE_KEY) return base.getItem(key);
      if (requestedKey === LEGACY_KEY) return null; // legacy migration is only for default slot
      return base.getItem(requestedKey);
    },
    setItem(requestedKey, value) {
      if (requestedKey === SAVE_KEY) return base.setItem(key, value);
      if (requestedKey === LEGACY_KEY) return;
      return base.setItem(requestedKey, value);
    },
    removeItem(requestedKey) {
      if (requestedKey === SAVE_KEY) return base.removeItem(key);
      if (requestedKey === LEGACY_KEY) return;
      return base.removeItem(requestedKey);
    },
  };
}

function slotRawKey(slotId: string): string {
  return slotId === DEFAULT_GAME_SLOT ? SAVE_KEY : `${SAVE_KEY}:slot:${slotId}`;
}

export class LocalStorageGameRepository implements GameRepository {
  constructor(private readonly storage: StorageLike = defaultBrowserStorage()) {}

  hasPersistedSave(slotId: string = DEFAULT_GAME_SLOT): boolean {
    const slot = normalizeSlotId(slotId);
    const raw = this.storage.getItem(slotRawKey(slot));
    if (raw) return true;
    if (slot === DEFAULT_GAME_SLOT) return this.storage.getItem(LEGACY_KEY) !== null;
    return false;
  }

  clearPersistedSave(slotId: string = DEFAULT_GAME_SLOT): void {
    const slot = normalizeSlotId(slotId);
    this.storage.removeItem(slotRawKey(slot));
    if (slot === DEFAULT_GAME_SLOT) this.storage.removeItem(LEGACY_KEY);
  }

  loadGameSync(slotId: string = DEFAULT_GAME_SLOT): SaveGame {
    return loadSave(slotStorage(this.storage, normalizeSlotId(slotId)));
  }

  saveGameSync(slotId: string, state: SaveGame): PersistResult {
    return persistSave(state, slotStorage(this.storage, normalizeSlotId(slotId)));
  }

  resetGameSync(slotId: string = DEFAULT_GAME_SLOT): SaveGame {
    return resetSave(slotStorage(this.storage, normalizeSlotId(slotId)));
  }

  async loadGame(slotId: string = DEFAULT_GAME_SLOT): Promise<SaveGame> {
    return this.loadGameSync(slotId);
  }

  async saveGame(slotId: string, state: SaveGame): Promise<PersistResult> {
    return this.saveGameSync(slotId, state);
  }

  async resetGame(slotId: string = DEFAULT_GAME_SLOT): Promise<SaveGame> {
    return this.resetGameSync(slotId);
  }
}

export const localStorageGameRepository = new LocalStorageGameRepository();
