import type { SaveGame } from './types';

/** Persisted flag: set once the player dismisses the first-day help panel. */
export const HELP_SEEN_FLAG = 'helpSeen';

/** Show first-day guidance until the player has dismissed it at least once. */
export function shouldShowHelp(save: SaveGame): boolean {
  return save.flags[HELP_SEEN_FLAG] !== true;
}

/** Mutates the given save so guidance does not auto-open on future loads. */
export function markHelpSeen(save: SaveGame): SaveGame {
  save.flags[HELP_SEEN_FLAG] = true;
  return save;
}
