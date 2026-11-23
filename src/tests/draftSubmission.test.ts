import { describe, expect, it } from 'vitest';
import { submitDraftForFeedback } from '@/domain/draftSubmission';
import { discoverEvidenceItem, reviewEvidence } from '@/domain/evidence';
import { advanceClock, reviewAssignment } from '@/domain/progression';
import { createInitialSave } from '@/domain/seed';
import type { SaveGame } from '@/domain/types';

const GOOD_DRAFT =
  'Issue: what happened outside the canteen. Facts: known, claimed and disputed points are kept separate. ' +
  'Analysis ties the reviewed medical report and CCTV material to the record. Conclusion: the recording gap stays noted.';
const WEAK_DRAFT = 'Facts: notes without an issue heading.';

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

function reviewEvidenceItem(save: SaveGame, id: string): void {
  expect(discoverEvidenceItem(save, id)).not.toBeNull();
  expect(reviewEvidence(save, id)).toBe(true);
}

/** Day 3, A1 reviewed, A2 unlocked and all of its requirements satisfied. */
function readyForA2(): SaveGame {
  const save = createInitialSave();
  advanceToDay(save, 3);
  reviewEvidenceItem(save, 'ev-1');
  reviewEvidenceItem(save, 'ev-2');
  addSourceNote(save);
  expect(reviewAssignment(save, 'a1').ok).toBe(true);
  return save;
}

describe('draft submission feedback', () => {
  it('reviews A2 when the draft is submitted with all A2 requirements met', () => {
    const save = readyForA2();
    const result = submitDraftForFeedback(save, GOOD_DRAFT);

    expect(result.ok).toBe(true);
    expect(result.a2Reviewed).toBe(true);
    expect(result.missingRequirements).toEqual([]);
    expect(result.message).toBe('Draft submitted — A2 reviewed.');

    const a2 = save.assignments.find((a) => a.id === 'a2')!;
    expect(a2.status).toBe('reviewed');
    expect(a2.feedback).toBeTruthy();
    expect(save.flags.assignment2Submitted).toBe(true);
    expect(save.draft.current).toBe(GOOD_DRAFT);
    expect(save.memories.some((m) => m.summary.includes('Submitted case brief draft'))).toBe(true);
    expect(save.auditLog.some((e) => e.type === 'draft-submitted')).toBe(true);
    expect(save.auditLog.some((e) => e.type === 'assignment-reviewed' && e.summary.includes('Case brief draft'))).toBe(
      true,
    );
    expect(
      save.notebook.some((n) => n.title === 'Senior feedback (deterministic)' && n.content.startsWith(result.message)),
    ).toBe(true);
    expect(save.notebook.some((n) => n.title.startsWith('Assignment reviewed:') && n.content === a2.feedback)).toBe(
      true,
    );
  });

  it('gives feedback without reviewing A2 when evidence or the source note is missing', () => {
    const missingEvidence = createInitialSave();
    advanceToDay(missingEvidence, 3);
    reviewEvidenceItem(missingEvidence, 'ev-1');
    addSourceNote(missingEvidence);
    expect(reviewAssignment(missingEvidence, 'a1').ok).toBe(true);

    const evidenceResult = submitDraftForFeedback(missingEvidence, GOOD_DRAFT);
    expect(evidenceResult.ok).toBe(true);
    expect(evidenceResult.a2Reviewed).toBe(false);
    expect(evidenceResult.missingRequirements.some((r) => r.includes('Canteen CCTV clip'))).toBe(true);
    expect(evidenceResult.message).toMatch(/^Draft submitted for feedback — A2 still needs:/);
    expect(missingEvidence.assignments.find((a) => a.id === 'a2')!.status).not.toBe('reviewed');
    expect(missingEvidence.flags.assignment2Submitted).toBe(true);
    expect(missingEvidence.notebook.some((n) => n.title === 'Senior feedback (deterministic)')).toBe(true);
    expect(missingEvidence.notebook.some((n) => n.title.startsWith('Assignment reviewed:'))).toBe(false);

    const missingSource = readyForA2();
    missingSource.notebook = missingSource.notebook.filter((n) => n.sourceId !== 'ls-4');
    const sourceResult = submitDraftForFeedback(missingSource, GOOD_DRAFT);
    expect(sourceResult.a2Reviewed).toBe(false);
    expect(sourceResult.missingRequirements).toContain('add the verified source note to your notebook');
    expect(missingSource.assignments.find((a) => a.id === 'a2')!.status).not.toBe('reviewed');
  });

  it('still blocks an unverified citation before any A2 review or standing change', () => {
    const save = readyForA2();
    const reputationBefore = structuredClone(save.player.reputation);
    const result = submitDraftForFeedback(
      save,
      'Issue: the report relies on Section 999, which no verified source in the file supports.',
    );

    expect(result.ok).toBe(false);
    expect(result.blocked.length).toBeGreaterThan(0);
    expect(result.a2Reviewed).toBe(false);
    expect(save.assignments.find((a) => a.id === 'a2')!.status).not.toBe('reviewed');
    expect(save.flags.assignment2Submitted).toBe(false);
    expect(save.player.reputation).toEqual(reputationBefore);
    expect(save.notebook.some((n) => n.title === 'Draft blocked: citation guardrail')).toBe(true);
    expect(save.notebook.some((n) => n.title === 'Senior feedback (deterministic)')).toBe(false);
  });

  it('clamps reputation changes to 0-100 after the whole submission including A2 review', () => {
    const high = readyForA2();
    high.player.reputation = { competence: 99, integrity: 99, reliability: 99 };
    expect(submitDraftForFeedback(high, GOOD_DRAFT).ok).toBe(true);
    for (const value of Object.values(high.player.reputation)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    expect(high.player.reputation.reliability).toBe(100);

    const low = createInitialSave();
    low.player.reputation = { competence: 0, integrity: 0, reliability: 0 };
    expect(submitDraftForFeedback(low, WEAK_DRAFT).ok).toBe(true);
    for (const value of Object.values(low.player.reputation)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    expect(low.player.reputation.reliability).toBe(0);
  });
});
