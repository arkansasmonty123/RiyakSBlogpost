import { describe, expect, it } from 'vitest';
import { createInitialSave } from '@/domain/seed';
import { assertNoCanonicalTruthLeak } from '@/domain/caseAccess';
import { buildCaseJournal, groupJournalByDay, JOURNAL_KINDS } from '@/domain/journal';
import type { SaveGame } from '@/domain/types';

/** Mirror the UI's evidence records: a discovery note and a later review note. */
function recordEvidenceNotes(save: SaveGame): void {
  const item = save.caseFile.evidence[0];
  save.clock.day = 2;
  save.notebook.unshift({
    id: 'n-discovered', day: save.clock.day, kind: 'fact',
    title: `Evidence: ${item.title}`, content: item.description,
    source: item.provenance, evidenceId: item.id, verified: false,
  });
  save.clock.day = 3;
  save.notebook.unshift({
    id: 'n-reviewed', day: save.clock.day, kind: 'fact',
    title: `Reviewed: ${item.title}`, content: 'Recorded a provisional assessment; authenticity undetermined.',
    source: item.provenance, evidenceId: item.id, verified: false,
  });
}

describe('case timeline / journal', () => {
  it('builds an ascending, day-grouped record of player-known events and notes', () => {
    const save = createInitialSave();
    recordEvidenceNotes(save);
    const journal = buildCaseJournal(save);

    expect(journal.map((e) => e.day)).toEqual([1, 1, 2, 3]);
    expect(journal.some((e) => e.detail === 'Joined the firm as an intern under Adv. Meera Kulkarni.')).toBe(true);
    expect(journal.some((e) => e.title === 'First day')).toBe(true);
    expect(journal.every((e, i) => i === 0 || e.day >= journal[i - 1].day)).toBe(true);

    const days = groupJournalByDay(journal);
    expect(days.map((d) => d.day)).toEqual([1, 2, 3]);
    expect(days[0].entries).toHaveLength(2);
  });

  it('shows discovered-evidence chronology with provenance and supports filtering by kind', () => {
    const save = createInitialSave();
    recordEvidenceNotes(save);
    const journal = buildCaseJournal(save);
    const provenance = save.caseFile.evidence[0].provenance;

    const evidenceEntries = journal.filter((e) => e.kind === 'evidence');
    expect(evidenceEntries.map((e) => e.day)).toEqual([2, 3]);
    expect(evidenceEntries.every((e) => e.source === provenance)).toBe(true);
    expect(evidenceEntries.every((e) => e.evidenceId === 'ev-1')).toBe(true);
    expect(groupJournalByDay(evidenceEntries).map((d) => d.day)).toEqual([2, 3]);
    expect(JOURNAL_KINDS).toContain('evidence');
    expect(journal.some((e) => e.kind === 'note' && e.title === 'First day')).toBe(true);
  });

  it('never projects canonical truth, authenticity or undiscovered evidence detail', () => {
    const save = createInitialSave();
    recordEvidenceNotes(save);
    // Poison the hidden truth: nothing from here may reach the player-facing journal.
    save.caseFile.canonicalTruth.actualTimeline.push('SECRET 18:12 shove');
    save.caseFile.canonicalTruth.hiddenMotives.push('SECRET prior dispute');

    const journal = buildCaseJournal(save);
    const json = JSON.stringify(journal).toLowerCase();
    expect(() => assertNoCanonicalTruthLeak(journal)).not.toThrow();
    for (const marker of ['secret', '18:12', 'prior dispute', 'canonicaltruth', 'evidenceauthenticity']) {
      expect(json).not.toContain(marker);
    }
    for (const item of save.caseFile.evidence.slice(3)) {
      expect(json).not.toContain(item.description.toLowerCase());
    }
  });
});
