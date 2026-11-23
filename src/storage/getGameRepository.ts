import { getStorageMode } from '@/config/env';
import { DEFAULT_GAME_SLOT, type GameRepository } from './gameRepository';
import { localStorageGameRepository } from './localStorageGameRepository';
import { SqliteApiGameRepository } from './sqliteApiGameRepository';

export { DEFAULT_GAME_SLOT };
export type { GameRepository };

let cached: GameRepository | null = null;

/** Returns the configured persistence adapter. Default is localStorage (stable). */
export function getGameRepository(): GameRepository {
  if (cached) return cached;
  if (getStorageMode() === 'sqlite-api') {
    cached = new SqliteApiGameRepository('', fetch, {
      hasLocalSave: (slotId) => localStorageGameRepository.hasPersistedSave(slotId),
      loadLocalSave: (slotId) => localStorageGameRepository.loadGameSync(slotId),
    });
  } else {
    cached = localStorageGameRepository;
  }
  return cached;
}

/** Test seam: reset cached repository selection. */
export function resetGameRepositoryCache(): void {
  cached = null;
}
