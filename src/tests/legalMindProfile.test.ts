import { describe, expect, it } from 'vitest';
import { assertNoCanonicalTruthLeak } from '@/domain/caseAccess';
import { buildChapterCompletionSummary } from '@/domain/completion';
import { buildLegalMindProfile, LEGAL_MIND_LEVEL_RANK, type LegalMindProfile } from '@/domain/legalMindProfile';
import { looksLikeSpecificCitation } from '@/domain/legalSources';
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
import { loadSave, SAVE_KEY } from '@/storage/save';
import type { StorageLike } from '@/storage/save';
import type { SaveGame } from '@/domain/types';

const GOOD_SUMMARY =
  'Issue: what happened outside the canteen. I reviewed the medical report, the partial clip and the witness note, attached the verified educational summary, and kept known facts separate from claims and disputed points.';

const CANONICAL_MARKERS = [
  'Exact first physical contact',
  'Whether the missing footage would change the account',
  'Witness had prior dispute',
  '18:12',
  'prior dispute',
  '"ev-3":false',
  'canonicalTruth',
  'hiddenMotives',
  'evidenceAuthenticity',
  'responsibleParties',
  'actualTimeline',
  'actualEvents',
];

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
  challengeEvidenceAdmissibility(
    save,
    'ev-3',
    'reliability',
    'The consistency of the account was never tested against the recording.',
  );
  expect(reviewAssignment(save, 'a6').ok).toBe(true);

  advanceToDay(save, 9);
  expect(submitSeniorReview(save, 'a7', GOOD_SUMMARY).status).toBe('needs_revision');
  expect(submitSeniorReview(save, 'a7', `${GOOD_SUMMARY} Revised to address the notes.`).status).toBe('accepted');

  advanceToDay(save, 10);
  expect(submitFinalBrief(save, GOOD_SUMMARY).ok).toBe(true);
  return save;
}

/** Collect every string in a profile so no field escapes the guardrails. */
function profileStrings(profile: LegalMindProfile): string[] {
  const out: string[] = [profile.intro, profile.closing];
  for (const d of profile.dimensions) {
    out.push(d.id, d.label, d.level, d.levelLabel, d.rationale, d.nextStep, ...d.evidence);
  }
  return out;
}

function memoryStorage(data: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe('Legal Mind Profile (lite)', () => {
  it('computes deterministic, qualitative dimensions with no aggregate score', () => {
    const save = completeChapter();
    const first = buildLegalMindProfile(save);
    const second = buildLegalMindProfile(save);

    expect(first).toEqual(second);
    expect(first.dimensions).toHaveLength(6);
    expect(new Set(first.dimensions.map((d) => d.id)).size).toBe(6);
    expect(first.dimensions.map((d) => d.id)).toEqual([
      'issue-spotting',
      'fact-analysis',
      'evidence-evaluation',
      'legal-interpretation',
      'procedure',
      'ethics',
    ]);
    // No single numeric score field anywhere in the profile.
    expect(Object.keys(first).sort()).toEqual(['closing', 'dimensions', 'intro']);
    for (const d of first.dimensions) {
      expect(Object.keys(d).sort()).toEqual([
        'evidence',
        'id',
        'label',
        'level',
        'levelLabel',
        'nextStep',
        'rationale',
      ]);
      expect(['emerging', 'developing', 'consistent']).toContain(d.level);
      expect(d.levelLabel).toBeTruthy();
      expect(d.rationale.length).toBeGreaterThan(0);
      expect(d.nextStep.length).toBeGreaterThan(0);
      expect(d.evidence.length).toBeGreaterThan(0);
    }
  });

  it('grounds every rating in recorded actions and explains why the level changed', () => {
    const save = completeChapter();
    const profile = buildLegalMindProfile(save);
    const evidence = profile.dimensions.find((d) => d.id === 'evidence-evaluation')!;
    const procedure = profile.dimensions.find((d) => d.id === 'procedure')!;

    expect(evidence.level).toBe('consistent');
    expect(procedure.level).toBe('consistent');
    expect(evidence.evidence.join(' ')).toContain('chain-of-custody');
    expect(evidence.rationale).toContain('recorded action');
    expect(evidence.rationale).toContain('Consistent');
    expect(procedure.evidence.join(' ')).toContain('custody-log assignment');

    // A playthrough without casework milestones earns genuinely lower, explained levels.
    const thinned = structuredClone(save);
    thinned.custodyLog = [];
    thinned.challenges = [];
    thinned.reviewRounds = [];
    thinned.flags.custodyLogged = false;
    thinned.flags.admissibilityChallenged = false;
    for (const id of ['a5', 'a6']) {
      const a = thinned.assignments.find((x) => x.id === id);
      if (a) a.status = 'pending';
    }
    const thinner = buildLegalMindProfile(thinned);
    const thinnerEvidence = thinner.dimensions.find((d) => d.id === 'evidence-evaluation')!;
    const thinnerProcedure = thinner.dimensions.find((d) => d.id === 'procedure')!;

    expect(LEGAL_MIND_LEVEL_RANK[thinnerEvidence.level]).toBeLessThan(LEGAL_MIND_LEVEL_RANK[evidence.level]);
    expect(LEGAL_MIND_LEVEL_RANK[thinnerProcedure.level]).toBeLessThan(LEGAL_MIND_LEVEL_RANK[procedure.level]);
    expect(thinnerEvidence.rationale).toContain('recorded action');
    expect(thinnerProcedure.evidence.length).toBeLessThan(procedure.evidence.length);
  });

  it('starts at emerging for a fresh player and never mutates the save', () => {
    const save = createInitialSave();
    const before = JSON.stringify(save);
    const profile = buildLegalMindProfile(save);

    expect(JSON.stringify(save)).toBe(before);
    for (const d of profile.dimensions) expect(d.level).toBe('emerging');
  });

  it('never leaks canonical truth into any profile field', () => {
    const profile = buildLegalMindProfile(completeChapter());
    expect(() => assertNoCanonicalTruthLeak(profile)).not.toThrow();

    const json = JSON.stringify(profile).toLowerCase();
    for (const marker of CANONICAL_MARKERS) expect(json).not.toContain(marker.toLowerCase());
  });

  it('never fabricates a legal citation in the profile or the strengthened final review', () => {
    const save = completeChapter();
    const profile = buildLegalMindProfile(save);
    for (const text of profileStrings(profile)) expect(looksLikeSpecificCitation(text)).toBe(false);

    const summary = buildChapterCompletionSummary(save);
    expect(looksLikeSpecificCitation(summary.outcome)).toBe(false);
    expect(summary.outcome).not.toMatch(/section\s+\d+/i);
  });

  it('adds specific, grounded highlights to the final review and completion outcome', () => {
    const save = completeChapter();
    // Re-run the final brief on a save that has not submitted it yet to inspect the result.
    const preFinal = structuredClone(save);
    // The helper already submitted; reset just the final-submission state for a clean call.
    const a8 = preFinal.assignments.find((a) => a.id === 'a8')!;
    a8.status = 'active';
    preFinal.flags.finalBriefSubmitted = false;
    preFinal.flags.chapterOneComplete = false;
    preFinal.caseFile.status = 'active';
    const result = submitFinalBrief(preFinal, GOOD_SUMMARY);

    expect(result.ok).toBe(true);
    expect(result.highlights!.length).toBeGreaterThan(0);
    for (const line of result.highlights!) {
      expect(looksLikeSpecificCitation(line)).toBe(false);
      expect(() => assertNoCanonicalTruthLeak({ line })).not.toThrow();
    }
    expect(result.consequence).toContain('Medical report summary');
    expect(result.consequence).toContain('Legal Mind Profile');
    expect(result.consequence).toContain('revision round');

    const summary = buildChapterCompletionSummary(save);
    expect(summary.outcome).toContain('Medical report summary');
    expect(summary.legalMindProfile.dimensions).toHaveLength(6);
  });

  it('stays compatible with previously saved games and old payload shapes', () => {
    const completed = completeChapter();

    // A v2 save round-tripped through storage still produces the same profile and summary.
    const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify(completed) });
    const loaded = loadSave(storage);
    expect(buildLegalMindProfile(loaded)).toEqual(buildLegalMindProfile(completed));
    expect(buildChapterCompletionSummary(loaded).legalMindProfile).toEqual(
      buildChapterCompletionSummary(completed).legalMindProfile,
    );

    // An old payload with none of the newer fields still loads and profiles without error.
    const old = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    old.version = 1;
    delete old.custodyLog;
    delete old.challenges;
    delete old.reviewRounds;
    delete old.caseTheory;
    const legacy = loadSave(memoryStorage({ 'the-bar-save-v1': JSON.stringify(old) }));
    const legacyProfile = buildLegalMindProfile(legacy);
    expect(legacyProfile.dimensions).toHaveLength(6);
    expect(() => assertNoCanonicalTruthLeak(legacyProfile)).not.toThrow();
    expect(buildChapterCompletionSummary(legacy).isComplete).toBe(false);
  });
});
