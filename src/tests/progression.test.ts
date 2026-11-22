import { describe, expect, it } from 'vitest';
import { createInitialSave } from '@/domain/seed';
import { reviewEvidence, addEvidenceNote, discoverEvidenceItem } from '@/domain/evidence';
import { advanceClock, currentObjective, isAssignmentUnlocked, refreshAssignmentUnlocks, reviewAssignment } from '@/domain/progression';
import type { SaveGame } from '@/domain/types';

function advanceToDay(save: SaveGame, day: number): void {
  while (save.clock.day < day) advanceClock(save);
}

function discoverAndReview(save: SaveGame, id: string): void {
  if (!discoverEvidenceItem(save, id)) throw new Error(`missing ${id}`);
  reviewEvidence(save, id);
}

function addVerifiedSourceNote(save: SaveGame): void {
  save.notebook.unshift({
    id: 'n-source', day: save.clock.day, kind: 'research', title: 'Source: educational summary',
    content: 'Verified educational summary', sourceId: 'ls-4', source: 'Educational summary', verified: true,
  });
}

describe('day-based assignment progression', () => {
  it('unlocks assignments only by day AND reviewed prerequisite', () => {
    const save = createInitialSave();
    const a1 = save.assignments.find((a) => a.id === 'a1')!;
    const a2 = save.assignments.find((a) => a.id === 'a2')!;
    const a3 = save.assignments.find((a) => a.id === 'a3')!;

    expect(isAssignmentUnlocked(a1, save)).toBe(true);
    expect(isAssignmentUnlocked(a2, save)).toBe(false); // day 1, a1 not reviewed

    discoverAndReview(save, 'ev-1');
    addVerifiedSourceNote(save);
    expect(reviewAssignment(save, 'a1').ok).toBe(true);
    expect(isAssignmentUnlocked(a2, save)).toBe(false); // a1 reviewed but day < 3

    advanceToDay(save, 3);
    expect(isAssignmentUnlocked(a2, save)).toBe(true);
    expect(isAssignmentUnlocked(a3, save)).toBe(false);
    refreshAssignmentUnlocks(save);
    expect(a2.status).toBe('active');
    expect(a3.status).toBe('locked');
  });

  it('advances time meaningfully: day rollover writes a memory and processes unlocks', () => {
    const save = createInitialSave();
    advanceClock(save);
    expect(save.clock).toEqual({ day: 1, slot: 'afternoon' });
    advanceClock(save);
    expect(save.clock.slot).toBe('evening');

    const rolled = advanceClock(save);
    expect(rolled.dayChanged).toBe(true);
    expect(save.clock).toEqual({ day: 2, slot: 'morning' });
    expect(save.memories[0].summary).toContain('Day 2 begins');
  });

  it('reports the current objective with evidence/source/note progress', () => {
    const save = createInitialSave();
    let objective = currentObjective(save);
    expect(objective?.assignmentId).toBe('a1');
    expect(objective?.evidenceProgress).toBe('0/1');
    expect(objective?.sourceProgress).toBe('0/1');

    discoverAndReview(save, 'ev-1');
    addVerifiedSourceNote(save);
    objective = currentObjective(save);
    expect(objective?.evidenceProgress).toBe('1/1');
    expect(objective?.sourceProgress).toBe('1/1');

    expect(reviewAssignment(save, 'a1').ok).toBe(true);
    advanceToDay(save, 3);
    objective = currentObjective(save);
    expect(objective?.assignmentId).toBe('a2');
    expect(objective?.status).toBe('active');
  });

  it('review requires reviewed evidence, verified sources and required notes, and unlocks the next task', () => {
    const save = createInitialSave();
    const a2 = save.assignments.find((a) => a.id === 'a2')!;
    const a3 = save.assignments.find((a) => a.id === 'a3')!;

    // Discovery alone is not enough; the item must have been reviewed.
    discoverEvidenceItem(save, 'ev-1');
    addVerifiedSourceNote(save);
    expect(reviewAssignment(save, 'a1').ok).toBe(false);
    expect(save.assignments.find((a) => a.id === 'a1')!.status).toBe('active');

    reviewEvidence(save, 'ev-1');
    const firstReview = reviewAssignment(save, 'a1');
    expect(firstReview.ok).toBe(true);
    expect(firstReview.feedback).toContain('Facts');
    expect(save.flags.assignment1Submitted).toBe(true);
    expect(save.player.reputation.reliability).toBe(12);
    expect(reviewAssignment(save, 'a1').ok).toBe(false); // idempotent

    advanceToDay(save, 3);
    expect(a2.status).toBe('active');
    discoverAndReview(save, 'ev-2');
    expect(reviewAssignment(save, 'a2').ok).toBe(true);

    advanceToDay(save, 5);
    expect(a3.status).toBe('active');
    // a3 needs all three items reviewed plus a contradiction note.
    expect(reviewAssignment(save, 'a3').ok).toBe(false);
    discoverAndReview(save, 'ev-3');
    addEvidenceNote(save, 'ev-3', 'contradiction', 'The eyewitness account conflicts with the gap in the clip.');
    expect(reviewAssignment(save, 'a3').ok).toBe(true);
    // The extended chapter continues with the Day 6 client-interview record.
    expect(currentObjective(save)?.assignmentId).toBe('a4');
  });
});
