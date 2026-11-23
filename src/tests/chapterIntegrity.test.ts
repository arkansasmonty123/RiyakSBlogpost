import { describe, expect, it } from 'vitest';
import { createInitialSave } from '@/domain/seed';
import { addEvidenceNote, discoverEvidenceItem, reviewEvidence } from '@/domain/evidence';
import { advanceClock, currentObjective, MAX_DAY, reviewAssignment } from '@/domain/progression';
import { applyDialogueChoice } from '@/domain/dialogue';
import {
  challengeEvidenceAdmissibility,
  recordCustodyObservation,
  submitFinalBrief,
  submitSeniorReview,
} from '@/domain/casework';
import type { SaveGame } from '@/domain/types';

const GOOD_SUMMARY =
  'Issue: what happened outside the canteen. I reviewed the medical report, the partial clip and the witness note, attached the verified educational summary, and kept known facts separate from claims and disputed points.';

function advanceToDay(save: SaveGame, day: number): void {
  while (save.clock.day < day) advanceClock(save);
}

function addSourceNote(save: SaveGame): void {
  save.notebook.unshift({
    id: 'n-source',
    day: save.clock.day,
    kind: 'research',
    title: 'Source: verified educational summary',
    content: 'Verified educational summary on evidence handling.',
    sourceId: 'ls-4',
    source: 'Educational summary',
    verified: true,
  });
}

function discoverAndReview(save: SaveGame, id: string): void {
  if (!discoverEvidenceItem(save, id)) throw new Error(`missing ${id}`);
  expect(reviewEvidence(save, id)).toBe(true);
}

/**
 * Integrity guardrails for the First Brief chapter. These tests fail if a future content or
 * progression edit leaves a dangling requirement that makes the chapter impossible to finish.
 */
describe('chapter integrity', () => {
  it('every assignment requirement resolves against seeded evidence, sources and flags', () => {
    const seed = createInitialSave();
    const evidenceIds = new Set(seed.caseFile.evidence.map((e) => e.id));
    const sourceIds = new Set(seed.legalSources.map((s) => s.id));

    for (const assignment of seed.assignments) {
      for (const id of assignment.requiredEvidenceIds) {
        expect(evidenceIds.has(id), `${assignment.id} requires missing evidence ${id}`).toBe(true);
      }
      for (const id of assignment.requiredSourceIds) {
        expect(sourceIds.has(id), `${assignment.id} requires missing source ${id}`).toBe(true);
      }
      for (const flag of assignment.requiredFlags ?? []) {
        expect(
          Object.prototype.hasOwnProperty.call(seed.flags, flag),
          `${assignment.id} requires missing seed flag ${flag}`,
        ).toBe(true);
      }
    }

    // Self-earned endgame flags must also be seeded so load/save keeps a stable shape.
    expect(Object.prototype.hasOwnProperty.call(seed.flags, 'reviewAccepted')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(seed.flags, 'finalBriefSubmitted')).toBe(true);
  });

  it('every seeded evidence item is discoverable and reviewable through the domain functions', () => {
    const seed = createInitialSave();
    expect(seed.caseFile.evidence.length).toBeGreaterThan(0);

    for (const item of seed.caseFile.evidence) {
      const save = createInitialSave();
      expect(discoverEvidenceItem(save, item.id), `cannot discover ${item.id}`).not.toBeNull();
      expect(reviewEvidence(save, item.id), `cannot review ${item.id}`).toBe(true);
      const reviewed = save.caseFile.evidence.find((e) => e.id === item.id);
      expect(reviewed?.discovered).toBe(true);
      expect(reviewed?.reviewed).toBe(true);
    }
  });

  it('assignments are ordered across Days 1–10 and the clock caps at the final day', () => {
    const save = createInitialSave();
    expect(save.assignments.map((a) => a.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']);
    expect(save.assignments.map((a) => a.day)).toEqual([1, 3, 5, 6, 7, 8, 9, 10]);
    expect(MAX_DAY).toBe(10);

    advanceToDay(save, MAX_DAY);
    for (let i = 0; i < 4; i += 1) advanceClock(save);
    expect(save.clock.day).toBe(MAX_DAY);
  });

  it('a full Day 1–10 path closes the chapter and leaves no remaining objective', () => {
    const save = createInitialSave();

    // Day 2 client interview.
    advanceToDay(save, 2);
    expect(applyDialogueChoice(save, 'd-client-interview', 'ask-personal-observation').ok).toBe(true);

    // Days 1, 3 and 5 — fact matrix, brief draft, contradiction note.
    discoverAndReview(save, 'ev-1');
    addSourceNote(save);
    expect(reviewAssignment(save, 'a1').ok).toBe(true);

    advanceToDay(save, 3);
    discoverAndReview(save, 'ev-2');
    expect(reviewAssignment(save, 'a2').ok).toBe(true);

    advanceToDay(save, 5);
    discoverAndReview(save, 'ev-3');
    expect(
      addEvidenceNote(save, 'ev-3', 'contradiction', 'The witness account does not address the clip gap.'),
    ).not.toBeNull();
    expect(reviewAssignment(save, 'a3').ok).toBe(true);

    // Day 6 — interview record.
    advanceToDay(save, 6);
    expect(reviewAssignment(save, 'a4').ok).toBe(true);

    // Day 7 — chain of custody.
    advanceToDay(save, 7);
    expect(recordCustodyObservation(save, 'ev-2', 'No sealing record; noting the gap.').ok).toBe(true);
    expect(reviewAssignment(save, 'a5').ok).toBe(true);

    // Day 8 — admissibility challenge.
    advanceToDay(save, 8);
    expect(
      challengeEvidenceAdmissibility(save, 'ev-3', 'reliability', 'Consistency was never tested against the recording.')
        .ok,
    ).toBe(true);
    expect(reviewAssignment(save, 'a6').ok).toBe(true);

    // Day 9 — senior review requires a revision before acceptance.
    advanceToDay(save, 9);
    expect(submitSeniorReview(save, 'a7', GOOD_SUMMARY).status).toBe('needs_revision');
    expect(submitSeniorReview(save, 'a7', `${GOOD_SUMMARY} Revised to address the notes.`).status).toBe('accepted');

    // Day 10 — final brief closes the chapter.
    advanceToDay(save, 10);
    const final = submitFinalBrief(save, GOOD_SUMMARY);
    expect(final.ok).toBe(true);
    expect(['strong', 'solid', 'shaky']).toContain(final.tier);
    expect(save.flags.finalBriefSubmitted).toBe(true);
    expect(save.flags.chapterOneComplete).toBe(true);
    expect(save.caseFile.status).toBe('closed');
    expect(save.assignments.every((a) => a.status === 'reviewed')).toBe(true);
    expect(currentObjective(save)).toBeNull();
  });
});
