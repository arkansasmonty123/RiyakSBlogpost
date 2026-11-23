import type { NotebookEntry, SaveGame } from './types';

/**
 * The notebook is an append-only, newest-first record of player-authored notes. Entries
 * are written from many flows (evidence, dialogue, theory, casework), so the cap lives in
 * one shared helper: every append drops the oldest entries past the limit, and load/persist
 * trim untrusted or legacy arrays the same way. Keeping this bounded stops a long save
 * (or a tampered one) from growing localStorage without limit. No canonical case truth is
 * stored here — only what the player could legitimately record.
 */
export const MAX_NOTEBOOK_ENTRIES = 300;

/** Trim an existing array in place so the newest `MAX_NOTEBOOK_ENTRIES` entries remain. */
export function capNotebook(entries: NotebookEntry[]): NotebookEntry[] {
  if (entries.length > MAX_NOTEBOOK_ENTRIES) entries.length = MAX_NOTEBOOK_ENTRIES;
  return entries;
}

/** Prepend one entry (newest first), keeping the notebook within the cap. */
export function addNotebookEntry(save: SaveGame, entry: NotebookEntry): void {
  save.notebook.unshift(entry);
  capNotebook(save.notebook);
}

/** Non-mutating trim for untrusted stored data on load and persist. */
export function trimNotebook(entries: NotebookEntry[]): NotebookEntry[] {
  return entries.length > MAX_NOTEBOOK_ENTRIES ? entries.slice(0, MAX_NOTEBOOK_ENTRIES) : entries;
}
