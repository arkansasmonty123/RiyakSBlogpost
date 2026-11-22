import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '@/app/App';
import { assertNoCanonicalTruthLeak } from '@/domain/caseAccess';
import { buildChapterCompletionSummary, isChapterComplete } from '@/domain/completion';
import { markHelpSeen } from '@/domain/onboarding';
import { advanceClock, reviewAssignment } from '@/domain/progression';
import { createInitialSave } from '@/domain/seed';
import {
  challengeEvidenceAdmissibility,
  recordCustodyObservation,
  submitFinalBrief,
  submitSeniorReview,
} from '@/domain/casework';
import { addEvidenceNote, discoverEvidenceItem, reviewEvidence } from '@/domain/evidence';
import { applyDialogueChoice } from '@/domain/dialogue';
import { persistSave } from '@/storage/save';
import type { StorageLike } from '@/storage/save';
import type { SaveGame } from '@/domain/types';

const GOOD_SUMMARY =
  'Issue: what happened outside the canteen. I reviewed the medical report, the partial clip and the witness note, attached the verified educational summary, and kept known facts separate from claims and disputed points.';

function advanceToDay(save: SaveGame, day: number): void {
  while (save.clock.day < day) advanceClock(save);
}

function discoverAndReview(save: SaveGame, id: string): void {
  if (!discoverEvidenceItem(save, id)) throw new Error(`missing ${id}`);
  reviewEvidence(save, id);
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

/** Play the deterministic Day 1–10 path through a closed case. */
function completeChapter(): SaveGame {
  const save = createInitialSave();
  advanceToDay(save, 2);
  applyDialogueChoice(save, 'd-client-interview', 'ask-personal-observation');

  discoverAndReview(save, 'ev-1');
  addSourceNote(save);
  expect(reviewAssignment(save, 'a1').ok).toBe(true);

  advanceToDay(save, 3);
  discoverAndReview(save, 'ev-2');
  expect(reviewAssignment(save, 'a2').ok).toBe(true);

  advanceToDay(save, 5);
  discoverAndReview(save, 'ev-3');
  addEvidenceNote(save, 'ev-3', 'contradiction', 'The witness account does not address the gap in the clip.');
  expect(reviewAssignment(save, 'a3').ok).toBe(true);

  advanceToDay(save, 6);
  expect(reviewAssignment(save, 'a4').ok).toBe(true);

  advanceToDay(save, 7);
  recordCustodyObservation(save, 'ev-2', 'The clip export has no sealing record; note the gap.');
  expect(reviewAssignment(save, 'a5').ok).toBe(true);

  advanceToDay(save, 8);
  challengeEvidenceAdmissibility(save, 'ev-3', 'reliability', 'The consistency of the account was never tested against the recording.');
  expect(reviewAssignment(save, 'a6').ok).toBe(true);

  advanceToDay(save, 9);
  expect(submitSeniorReview(save, 'a7', GOOD_SUMMARY).status).toBe('needs_revision');
  expect(submitSeniorReview(save, 'a7', `${GOOD_SUMMARY} Revised to address the notes.`).status).toBe('accepted');

  advanceToDay(save, 10);
  expect(submitFinalBrief(save, GOOD_SUMMARY).ok).toBe(true);
  markHelpSeen(save); // simulate a player who already dismissed the first-day guide
  return save;
}

/** Render the real component tree with a loaded save so the completion panel can be checked. */
function renderWithSave(save: SaveGame): string {
  const data: Record<string, string> = {};
  const storage: StorageLike = {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
  persistSave(save, storage);
  const globalAny = globalThis as { window?: unknown };
  const previous = globalAny.window;
  globalAny.window = { localStorage: storage };
  try {
    return renderToString(<App initialPanel="completion" />).replace(/<!-- -->/g, '');
  } finally {
    if (previous === undefined) delete globalAny.window;
    else globalAny.window = previous;
  }
}

describe('chapter completion summary', () => {
  it('reports completion only after the final brief closes the case', () => {
    const fresh = createInitialSave();
    expect(isChapterComplete(fresh)).toBe(false);
    expect(buildChapterCompletionSummary(fresh).isComplete).toBe(false);

    const finished = completeChapter();
    const summary = buildChapterCompletionSummary(finished);
    expect(isChapterComplete(finished)).toBe(true);
    expect(summary.isComplete).toBe(true);
    expect(summary.caseStatus).toBe('closed');
    expect(summary.day).toBe(10);
    expect(summary.finalDay).toBe(10);
  });

  it('summarises player-visible achievements, reputation, relationships, evidence and memories', () => {
    const finished = completeChapter();
    const summary = buildChapterCompletionSummary(finished);

    expect(summary.outcome).toBe(finished.assignments.find((a) => a.id === 'a8')?.feedback);
    expect(summary.outcome.length).toBeGreaterThan(0);
    expect(summary.closingNote).toContain('Case closed');
    expect(summary.assignmentsTotal).toBe(8);
    expect(summary.assignmentsCompletedCount).toBe(8);
    expect(summary.assignmentsCompleted.map((a) => a.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']);
    expect(summary.evidenceDiscovered.map((e) => e.id)).toEqual(['ev-1', 'ev-2', 'ev-3']);
    expect(summary.evidenceDiscovered.every((e) => e.reviewed)).toBe(true);
    expect(summary.relationships.some((r) => r.characterId === 'senior' && r.trust > 35)).toBe(true);
    expect(summary.memoryHighlights.length).toBeGreaterThan(0);
    expect(summary.reputation).toEqual(finished.player.reputation);
    expect(summary.reputation.competence).toBeGreaterThan(10);
    expect(summary.careerStage).toBe(finished.player.careerStage);
  });

  it('uses the player-facing ambiguity list and never the canonical ambiguity record', () => {
    const finished = completeChapter();
    finished.caseFile.unresolvedAmbiguity = ['Player-visible question about the missing interval.'];

    const summary = buildChapterCompletionSummary(finished);
    expect(summary.openQuestions).toEqual(['Player-visible question about the missing interval.']);
    expect(summary.openQuestions).not.toContain('Exact first physical contact');
    expect(JSON.stringify(summary)).not.toContain('Whether the missing footage would change the account');
  });

  it('exposes no canonical truth in completion data', () => {
    const summary = buildChapterCompletionSummary(completeChapter());
    expect(() => assertNoCanonicalTruthLeak(summary)).not.toThrow();

    const json = JSON.stringify(summary).toLowerCase();
    for (const forbidden of [
      'canonicaltruth',
      'actualevents',
      'actualtimeline',
      'responsibleparties',
      'hiddenmotives',
      'evidenceauthenticity',
      'prior dispute',
      '18:12',
      '"ev-3":false',
      'exact first physical contact',
    ]) {
      expect(json).not.toContain(forbidden);
    }
    expect(summary.openQuestions).toContain('What happened in the missing 20 seconds of video?');
  });

  it('renders the completion panel with player-legible highlights and no canonical truth', () => {
    const html = renderWithSave(completeChapter());
    for (const expected of [
      'The First Brief — Chapter Complete',
      'What you achieved',
      'Relationship highlights',
      'Key evidence discovered',
      'Memory highlights',
      'Unresolved ambiguities',
      'What happened in the missing 20 seconds of video?',
      'Chapter summary',
    ]) {
      expect(html).toContain(expected);
    }

    const lower = html.toLowerCase();
    for (const forbidden of [
      'canonicaltruth',
      'actualevents',
      'hiddenmotives',
      'evidenceauthenticity',
      'prior dispute',
      '18:12',
      'exact first physical contact',
    ]) {
      expect(lower).not.toContain(forbidden);
    }
  });
});
