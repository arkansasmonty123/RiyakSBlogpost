import type { KnowledgeConnection, KnowledgeDomain, NotebookEntry, SaveGame } from './types';

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

export const KNOWLEDGE_DOMAINS: readonly KnowledgeDomain[] = [
  'forensic',
  'medical',
  'psychology',
  'economics',
  'accounting',
  'cybersecurity',
  'history',
  'philosophy',
  'sociology',
  'technology',
];

export interface KnowledgeConnectionInput {
  evidenceId?: string;
  legalTopic: string;
  domain: KnowledgeDomain;
  relatedConcept: string;
  description: string;
}

/** Deterministic, player-authored interdisciplinary connection. No LLM, no canonical truth. */
export function addKnowledgeConnectionEntry(
  save: SaveGame,
  input: KnowledgeConnectionInput,
  id: string,
): NotebookEntry {
  const connection: KnowledgeConnection = {
    id: `kc-${id}`,
    legalTopic: input.legalTopic.trim().slice(0, 120),
    domain: input.domain,
    relatedConcept: input.relatedConcept.trim().slice(0, 120),
    description: input.description.trim().slice(0, 500),
    strength: 'moderate',
  };
  const entry: NotebookEntry = {
    id,
    day: save.clock.day,
    kind: 'knowledge-connection',
    title: `Interdisciplinary link: ${connection.legalTopic} ↔ ${connection.domain}`,
    content: `${connection.relatedConcept} — ${connection.description}`,
    evidenceId: input.evidenceId,
    knowledgeGraphIds: [connection.id],
    connection,
  };
  addNotebookEntry(save, entry);
  return entry;
}
