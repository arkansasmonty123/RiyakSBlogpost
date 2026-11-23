import { DEFAULT_GAME_SLOT, type GameRepository } from './gameRepository';
import { LEGACY_KEY, loadSave, persistSave, resetSave, SAVE_KEY, type PersistResult, type StorageLike } from './save';
import type { SaveGame } from '@/domain/types';

function defaultBrowserStorage(): StorageLike {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
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

export class LocalStorageGameRepository implements GameRepository {
  constructor(private readonly storage: StorageLike = defaultBrowserStorage()) {}

  loadGameSync(slotId: string = DEFAULT_GAME_SLOT): SaveGame {
    return loadSave(slotStorage(this.storage, slotId));
  }

  saveGameSync(slotId: string, state: SaveGame): PersistResult {
    return persistSave(state, slotStorage(this.storage, slotId));
  }

  resetGameSync(slotId: string = DEFAULT_GAME_SLOT): SaveGame {
    return resetSave(slotStorage(this.storage, slotId));
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
