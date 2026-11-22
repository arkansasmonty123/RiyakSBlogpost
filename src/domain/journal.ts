import type { NotebookEntry, SaveGame } from './types';

/**
 * Journal entries are assembled only from player-legible records: memories the player
 * experienced and notebook entries the player wrote. Canonical case truth is never read,
 * so the chronological view cannot reveal the real sequence, responsibility or authenticity.
 */
export type JournalKind = 'event' | 'evidence' | 'note' | 'casework' | 'theory';

export const JOURNAL_KINDS: readonly JournalKind[] = ['event', 'evidence', 'note', 'casework', 'theory'];

export interface JournalEntry {
  id: string;
  day: number;
  kind: JournalKind;
  title: string;
  detail: string;
  /** Provenance the player legitimately recorded, when one is attached. */
  source?: string;
  evidenceId?: string;
  /** For evidence-linked notes: whether the note records a contradiction or corroboration. */
  relation?: 'contradiction' | 'corroboration';
  /** Stable tie-breaker for entries recorded on the same in-game day. */
  order: number;
}

function journalKindFor(entry: NotebookEntry): JournalKind {
  if (entry.kind === 'theory') return 'theory';
  if (entry.evidenceId && (entry.kind === 'fact' || entry.kind === 'contradiction')) return 'evidence';
  if (entry.kind === 'feedback' || entry.kind === 'mistake') return 'casework';
  return 'note';
}

/**
 * Give a recorded event a short, scannable title drawn only from the memory summary the
 * player already received. No canonical data is read, so a title can never reveal more
 * than the event detail beneath it.
 */
function eventTitle(summary: string): string {
  // Protect common abbreviations so "under Adv. Meera Kulkarni" is not cut at "Adv".
  const protectedAbbrev = summary.replace(/\b(Adv|Dr|Mr|Mrs|Ms|No)\.\s+/g, '$1\u0000 ');
  const firstClause = (protectedAbbrev.split(/\.\s+/)[0] ?? '')
    .replaceAll('\u0000', '.')
    .replace(/[.:]+$/, '')
    .trim();
  return firstClause.length > 0 && firstClause.length <= 80 ? firstClause : 'Noted event';
}

/** Build a deterministic, ascending chronological journal of what the player knows. */
export function buildCaseJournal(save: SaveGame): JournalEntry[] {
  let order = 0;
  const entries: JournalEntry[] = [];

  // Memories are stored newest-first; walking backwards restores their chronology.
  for (let i = save.memories.length - 1; i >= 0; i--) {
    const memory = save.memories[i];
    entries.push({
      id: `journal-memory-${memory.id}`,
      day: memory.day,
      kind: 'event',
      title: eventTitle(memory.summary),
      detail: memory.summary,
      order: order++,
    });
  }

  // Notebook entries are the player's own dated records. `source` is provenance the
  // player already has; no authenticity value or canonical fact is inferred from it.
  for (let i = save.notebook.length - 1; i >= 0; i--) {
    const note = save.notebook[i];
    entries.push({
      id: `journal-note-${note.id}`,
      day: note.day,
      kind: journalKindFor(note),
      title: note.title,
      detail: note.content,
      ...(note.source ? { source: note.source } : {}),
      ...(note.evidenceId ? { evidenceId: note.evidenceId } : {}),
      ...(note.relation ? { relation: note.relation } : {}),
      order: order++,
    });
  }

  return entries.sort((a, b) => a.day - b.day || a.order - b.order);
}

export interface JournalDay {
  day: number;
  entries: JournalEntry[];
}

/** Group an already sorted journal into stable day sections for rendering. */
export function groupJournalByDay(entries: JournalEntry[]): JournalDay[] {
  const days: JournalDay[] = [];
  for (const entry of entries) {
    let current = days[days.length - 1];
    if (!current || current.day !== entry.day) {
      current = { day: entry.day, entries: [] };
      days.push(current);
    }
    current.entries.push(entry);
  }
  return days;
}
