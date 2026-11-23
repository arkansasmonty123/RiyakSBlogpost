import type { PersistResult } from './save';
import type { SaveGame } from '@/domain/types';

export const DEFAULT_GAME_SLOT = 'default';

/** Optional per-write controls. Ignored by adapters without a concurrency model. */
export interface SaveOptions {
  /** Bypass the optimistic-concurrency guard for this write only (explicit user choice). */
  force?: boolean;
}

/**
 * Persistence boundary for game state. Adapters must preserve canonical-truth
 * isolation and migration behavior. Slot IDs are opaque storage keys.
 */
export interface GameRepository {
  loadGame(slotId?: string): Promise<SaveGame>;
  saveGame(slotId: string, state: SaveGame, options?: SaveOptions): Promise<PersistResult>;
  resetGame(slotId?: string): Promise<SaveGame>;
}
