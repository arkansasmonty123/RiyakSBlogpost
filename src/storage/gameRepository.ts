import type { PersistResult } from './save';
import type { SaveGame } from '@/domain/types';

export const DEFAULT_GAME_SLOT = 'default';

/**
 * Persistence boundary for game state. Adapters must preserve canonical-truth
 * isolation and migration behavior. Slot IDs are opaque storage keys.
 */
export interface GameRepository {
  loadGame(slotId?: string): Promise<SaveGame>;
  saveGame(slotId: string, state: SaveGame): Promise<PersistResult>;
  resetGame(slotId?: string): Promise<SaveGame>;
}
