import { makeId } from './progression';
import type { DraftVersion, SaveGame } from './types';

/** Bound stored history so localStorage stays small. */
export const MAX_DRAFT_VERSIONS = 8;
export const MAX_DRAFT_CHARS = 4000;

/** Snapshot the current draft with its in-game day/slot and wall-clock timestamp. Mutates on success. */
export function saveDraftVersion(save: SaveGame, text: string): DraftVersion | null {
  const content = text.slice(0, MAX_DRAFT_CHARS);
  const version: DraftVersion = {
    id: makeId('v'),
    savedAt: new Date().toISOString(),
    day: save.clock.day,
    slot: save.clock.slot,
    text: content,
  };
  save.draft.current = content;
  save.draft.versions.unshift(version);
  if (save.draft.versions.length > MAX_DRAFT_VERSIONS) {
    save.draft.versions.length = MAX_DRAFT_VERSIONS;
  }
  return version;
}

/** Restore a prior version as the current draft. Returns its text, or null if missing. */
export function loadDraftVersion(save: SaveGame, versionId: string): string | null {
  const version = save.draft.versions.find((v) => v.id === versionId);
  if (!version) return null;
  save.draft.current = version.text;
  return version.text;
}

export function setCurrentDraft(save: SaveGame, text: string): void {
  save.draft.current = text.slice(0, MAX_DRAFT_CHARS);
}
