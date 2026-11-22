import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '@/app/App';
import { assertNoCanonicalTruthLeak, toPlayerCaseView } from '@/domain/caseAccess';
import { buildCaseSummary } from '@/domain/caseSummary';
import { buildChapterCompletionSummary } from '@/domain/completion';
import {
  challengeEvidenceAdmissibility,
  recordCustodyObservation,
  submitFinalBrief,
  submitSeniorReview,
} from '@/domain/casework';
import { applyDialogueChoice } from '@/domain/dialogue';
import { buildEvidenceSynthesis, reviewSynthesis } from '@/domain/evidenceSynthesis';
import { addEvidenceNote, discoverEvidenceItem, reviewEvidence } from '@/domain/evidence';
import { buildCaseJournal } from '@/domain/journal';
import { markHelpSeen } from '@/domain/onboarding';
import { advanceClock, reviewAssignment } from '@/domain/progression';
import { ALL_REVIEW_PROMPT_TEXT, reviewPromptsFor } from '@/domain/reviewPrompts';
import { createInitialSave } from '@/domain/seed';
import { addTheoryClaim } from '@/domain/theory';
import { checkDraftCitations } from '@/domain/guards';
import { looksLikeSpecificCitation } from '@/domain/legalSources';
import { loadSave, persistSave } from '@/storage/save';
import type { StorageLike } from '@/storage/save';
import type { SaveGame } from '@/domain/types';

const GOOD_SUMMARY =
  'Issue: what happened outside the canteen. I reviewed the medical report, the partial clip and the witness note, attached the verified educational summary, and kept known facts separate from claims and disputed points.';

const CANONICAL_MARKERS = [
  'canonicaltruth', 'actualevents', 'actualtimeline', 'responsibleparties',
  'hiddenmotives', 'evidenceauthenticity', 'prior dispute', '18:12',
  'exact first physical contact',
];

function advanceToDay(save: SaveGame, day: number): void {
  while (save.clock.day < day) advanceClock(save);
}

function discoverAndReview(save: SaveGame, id: string): void {
  if (!discoverEvidenceItem(save, id)) throw new Error(`missing ${id}`);
  if (!reviewEvidence(save, id)) throw new Error(`cannot review ${id}`);
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

/** A deterministic Day 1–10 playthrough with extra grounded notes, prompts and theory. */
function playGroundedChapter(): SaveGame {
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

  // Optional depth: review the bonus items and tie notes and theory to them.
  discoverAndReview(save, 'ev-7');
  discoverAndReview(save, 'ev-9');
  addEvidenceNote(save, 'ev-2', 'corroboration', 'The partial clip and the clock note both concern timing.');
  expect(addTheoryClaim(
    save,
    'The medical report records a minor injury, but its timing is disputed.',
    'disputed',
    ['ev-1'],
  ).ok).toBe(true);

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
  markHelpSeen(save);
  return save;
}

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = { ...initial };
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

function renderCompletion(save: SaveGame): string {
  const storage = memoryStorage();
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

function expectSafePlayerText(text: string, save: SaveGame): void {
  expect(looksLikeSpecificCitation(text)).toBe(false);
  expect(checkDraftCitations(text, save.legalSources).blocked).toEqual([]);
  const lower = text.toLowerCase();
  for (const marker of CANONICAL_MARKERS) expect(lower).not.toContain(marker);
}

describe('evidence-linked review prompts (case depth)', () => {
  it('stays hidden until the tied item is discovered and reviewed', () => {
    const save = createInitialSave();
    expect(reviewPromptsFor(save)).toEqual([]);

    discoverEvidenceItem(save, 'ev-7');
    expect(reviewPromptsFor(save)).toEqual([]);

    reviewEvidence(save, 'ev-7');
    const prompts = reviewPromptsFor(save);
    expect(prompts).toHaveLength(1);
    expect(prompts[0].evidenceId).toBe('ev-7');
    expect(prompts[0].evidenceTitle).toContain('Camera clock');
    expect(prompts[0].focus).toBe('Timing & records');
  });

  it('surfaces both prompts after the relevant bonus items are reviewed', () => {
    const save = playGroundedChapter();
    expect(reviewPromptsFor(save).map((prompt) => prompt.id)).toEqual([
      'rp-clock-register',
      'rp-earlier-later-account',
    ]);

    const summary = buildCaseSummary(save);
    expect(summary.reviewPrompts.map((prompt) => prompt.id)).toEqual([
      'rp-clock-register',
      'rp-earlier-later-account',
    ]);
    expect(() => assertNoCanonicalTruthLeak(summary)).not.toThrow();
  });

  it('never leaks canonical truth or fabricated citations through prompt text', () => {
    const save = createInitialSave();
    for (const text of ALL_REVIEW_PROMPT_TEXT) {
      expectSafePlayerText(text, save);
      expect(() => assertNoCanonicalTruthLeak({ text })).not.toThrow();
    }
  });

  it('renders prompts on the case board only for reviewed items', () => {
    const storage = memoryStorage();
    const save = createInitialSave();
    persistSave(save, storage);
    const globalAny = globalThis as { window?: unknown };
    const previous = globalAny.window;
    globalAny.window = { localStorage: storage };
    try {
      const before = renderToString(<App />);
      expect(before).not.toContain('Review prompts for reviewed items');
    } finally {
      if (previous === undefined) delete globalAny.window;
      else globalAny.window = previous;
    }

    const html = renderCompletion(playGroundedChapter());
    // The completion panel renders from the same player-visible case summary data.
    expect(buildCaseSummary(playGroundedChapter()).reviewPrompts).toHaveLength(2);
    expect(html).not.toContain('canonicaltruth');
  });
});

describe('evidence synthesis', () => {
  it('summarises contradictions, corroborations and theory grounding from the player file', () => {
    const save = playGroundedChapter();
    const synthesis = buildEvidenceSynthesis(save);

    expect(synthesis.contradictions).toHaveLength(1);
    expect(synthesis.corroborations).toHaveLength(1);
    expect(synthesis.links).toHaveLength(2);
    expect(synthesis.totalClaims).toBe(1);
    expect(synthesis.groundedClaimsCount).toBe(1);
    expect(synthesis.theoryGrounding[0].reviewedEvidenceTitles).toContain('Medical report summary');
    expect(reviewSynthesis(save)).toEqual({
      contradictions: 1,
      corroborations: 1,
      groundedClaims: 1,
      totalClaims: 1,
      openQuestions: toPlayerCaseView(save.caseFile).unresolvedAmbiguity.length,
    });
  });

  it('uses only the player-facing ambiguity list, never canonical ambiguity', () => {
    const save = playGroundedChapter();
    const synthesis = buildEvidenceSynthesis(save);
    expect(synthesis.openQuestions).toEqual(toPlayerCaseView(save.caseFile).unresolvedAmbiguity);
    expect(synthesis.openQuestions).not.toContain('Exact first physical contact');
    expect(synthesis.openQuestions).not.toContain('Whether the missing footage would change the account');

    const empty = buildEvidenceSynthesis(createInitialSave());
    expect(empty.links).toHaveLength(0);
    expect(empty.totalClaims).toBe(0);
    expect(empty.overview).toContain('No contradiction or corroboration notes');
    expect(empty.ambiguityNote).toContain('player-visible open question');
  });

  it('is player-legible: no canonical markers, truth keys or fabricated citations', () => {
    const save = playGroundedChapter();
    const synthesis = buildEvidenceSynthesis(save);
    expect(() => assertNoCanonicalTruthLeak(synthesis)).not.toThrow();
    for (const text of [synthesis.overview, synthesis.ambiguityNote]) expectSafePlayerText(text, save);

    const json = JSON.stringify(synthesis).toLowerCase();
    for (const marker of CANONICAL_MARKERS) expect(json).not.toContain(marker);
  });
});

describe('endgame review grounding', () => {
  it('includes grounded synthesis counts and safe lines in the final brief result', () => {
    const save = playGroundedChapter();
    const preFinal = structuredClone(save);
    const a8 = preFinal.assignments.find((a) => a.id === 'a8')!;
    a8.status = 'active';
    preFinal.flags.finalBriefSubmitted = false;
    preFinal.flags.chapterOneComplete = false;
    preFinal.caseFile.status = 'active';

    const result = submitFinalBrief(preFinal, GOOD_SUMMARY);
    expect(result.ok).toBe(true);
    expect(result.reviewSynthesis).toEqual({
      contradictions: 1,
      corroborations: 1,
      groundedClaims: 1,
      totalClaims: 1,
      openQuestions: toPlayerCaseView(save.caseFile).unresolvedAmbiguity.length,
    });
    expect(result.consequence).toContain('contradiction note');
    expect(result.consequence).toContain('corroboration note');
    expect(result.consequence).toContain('player-visible open question');
    for (const line of result.highlights ?? []) {
      expectSafePlayerText(line, save);
      expect(() => assertNoCanonicalTruthLeak({ line })).not.toThrow();
    }
  });

  it('grounds accepted senior feedback in recorded evidence notes and theory', () => {
    const save = playGroundedChapter();
    const accepted = save.reviewRounds.find((r) => r.assignmentId === 'a7' && r.status === 'accepted');
    expect(accepted).toBeDefined();
    expect(accepted!.feedback).toContain('evidence-linked note');
    expect(accepted!.feedback).toContain('theory claim');
    expectSafePlayerText(accepted!.feedback, save);
  });

  it('reports and renders the synthesis on the chapter completion screen', () => {
    const save = playGroundedChapter();
    const completion = buildChapterCompletionSummary(save);
    expect(completion.synthesis).toEqual(buildEvidenceSynthesis(save));
    expect(() => assertNoCanonicalTruthLeak(completion)).not.toThrow();

    const html = renderCompletion(save);
    for (const expected of [
      'Evidence synthesis &amp; open questions',
      'How your theory was grounded',
      'contradiction',
      'corroboration',
      'player-visible open question',
    ]) {
      expect(html).toContain(expected);
    }
    const lower = html.toLowerCase();
    for (const marker of CANONICAL_MARKERS) expect(lower).not.toContain(marker);
    expect(lower).not.toContain('evidenceauthenticity');
  });

  it('records the contradiction and corroboration relation in the timeline', () => {
    const journal = buildCaseJournal(playGroundedChapter());
    expect(journal.some((entry) => entry.relation === 'contradiction')).toBe(true);
    expect(journal.some((entry) => entry.relation === 'corroboration')).toBe(true);
  });
});

describe('synthesis compatibility and progression integrity', () => {
  it('survives save round-trips and legacy payloads without canonical data', () => {
    const save = playGroundedChapter();
    const storage = memoryStorage();
    persistSave(save, storage);
    expect(buildEvidenceSynthesis(loadSave(storage))).toEqual(buildEvidenceSynthesis(save));

    const legacyPayload = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    legacyPayload.version = 1;
    delete legacyPayload.caseTheory;
    delete legacyPayload.custodyLog;
    delete legacyPayload.challenges;
    delete legacyPayload.reviewRounds;
    const legacy = loadSave(memoryStorage({ 'the-bar-save-v1': JSON.stringify(legacyPayload) }));
    const synthesis = buildEvidenceSynthesis(legacy);
    expect(synthesis.totalClaims).toBe(0);
    expect(synthesis.links).toHaveLength(0);
    expect(synthesis.openQuestions.length).toBeGreaterThan(0);
    expect(() => assertNoCanonicalTruthLeak(synthesis)).not.toThrow();
  });

  it('does not mutate progression, evidence discovery or the clock', () => {
    const save = createInitialSave();
    const assignmentIds = save.assignments.map((a) => a.id);
    const requiredEvidence = save.assignments.map((a) => a.requiredEvidenceIds.join(','));
    const discovered = toPlayerCaseView(save.caseFile).evidence.filter((e) => e.discovered).length;

    reviewPromptsFor(save);
    buildEvidenceSynthesis(save);
    reviewSynthesis(save);
    buildCaseSummary(save);

    expect(save.assignments.map((a) => a.id)).toEqual(assignmentIds);
    expect(save.assignments.map((a) => a.requiredEvidenceIds.join(','))).toEqual(requiredEvidence);
    expect(save.clock).toEqual({ day: 1, slot: 'morning' });
    expect(toPlayerCaseView(save.caseFile).evidence.filter((e) => e.discovered).length).toBe(discovered);
    expect(assignmentIds).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']);
  });
});
