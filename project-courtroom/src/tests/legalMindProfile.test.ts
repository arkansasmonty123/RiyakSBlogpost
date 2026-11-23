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
import { loadSave, persistSave, SAVE_KEY } from '@/storage/save';
import type { StorageLike } from '@/storage/save';
import { LEGAL_MIND_DIMENSION_IDS, type SaveGame } from '@/domain/types';

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

function dimension(profile: LegalMindProfile, id: string) {
  const found = profile.dimensions.find((d) => d.id === id);
  if (!found) throw new Error(`missing profile dimension: ${id}`);
  return found;
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
    expect(first.dimensions).toHaveLength(LEGAL_MIND_DIMENSION_IDS.length);
    expect(first.dimensions).toHaveLength(10);
    expect(new Set(first.dimensions.map((d) => d.id)).size).toBe(10);
    expect(first.dimensions.map((d) => d.id)).toEqual([...LEGAL_MIND_DIMENSION_IDS]);
    expect(first.dimensions.map((d) => d.id)).toEqual([
      'issue-spotting',
      'fact-analysis',
      'logical-consistency',
      'evidence-evaluation',
      'legal-interpretation',
      'precedent-analysis',
      'strategy',
      'counterargument-anticipation',
      'drafting',
      'ethical-reasoning',
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
    const strategy = profile.dimensions.find((d) => d.id === 'strategy')!;

    expect(evidence.level).toBe('consistent');
    expect(strategy.level).toBe('consistent');
    expect(evidence.evidence.join(' ')).toContain('chain-of-custody');
    expect(evidence.rationale).toContain('recorded action');
    expect(evidence.rationale).toContain('Consistent');
    expect(strategy.evidence.join(' ')).toContain('senior feedback');

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
    const thinnerStrategy = thinner.dimensions.find((d) => d.id === 'strategy')!;

    expect(LEGAL_MIND_LEVEL_RANK[thinnerEvidence.level]).toBeLessThan(LEGAL_MIND_LEVEL_RANK[evidence.level]);
    expect(LEGAL_MIND_LEVEL_RANK[thinnerStrategy.level]).toBeLessThan(LEGAL_MIND_LEVEL_RANK[strategy.level]);
    expect(thinnerEvidence.rationale).toContain('recorded action');
    expect(thinnerStrategy.evidence.length).toBeLessThan(strategy.evidence.length);
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
    expect(summary.legalMindProfile.dimensions).toHaveLength(LEGAL_MIND_DIMENSION_IDS.length);
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
    expect(legacyProfile.dimensions).toHaveLength(LEGAL_MIND_DIMENSION_IDS.length);
    expect(() => assertNoCanonicalTruthLeak(legacyProfile)).not.toThrow();
    expect(buildChapterCompletionSummary(legacy).isComplete).toBe(false);
  });
  it('keeps ten separate qualitative dimensions and never a single composite score', () => {
    const profile = buildLegalMindProfile(completeChapter());
    for (const key of ['score', 'total', 'overall', 'composite', 'average']) {
      expect(profile).not.toHaveProperty(key);
    }
    expect(typeof profile.intro).toBe('string');
    expect(typeof profile.closing).toBe('string');
    for (const d of profile.dimensions) {
      expect(typeof d.level).toBe('string');
      expect(Number.isFinite(Number(d.level))).toBe(false);
      expect(Object.keys(d).sort()).toEqual([
        'evidence',
        'id',
        'label',
        'level',
        'levelLabel',
        'nextStep',
        'rationale',
      ]);
    }
    // One grade is not applied globally: each dimension reflects its own recorded actions.
    expect(new Set(profile.dimensions.map((d) => d.level)).size).toBeGreaterThan(1);
  });

  it('updates from assignment review outcomes', () => {
    const base = createInitialSave();
    const before = dimension(buildLegalMindProfile(base), 'issue-spotting');
    expect(before.level).toBe('emerging');

    const reviewed = structuredClone(base);
    reviewed.assignments.find((a) => a.id === 'a1')!.status = 'reviewed';
    const after = dimension(buildLegalMindProfile(reviewed), 'issue-spotting');
    expect(after.evidence.join(' ')).toContain('fact matrix');
    expect(LEGAL_MIND_LEVEL_RANK[after.level]).toBeGreaterThan(LEGAL_MIND_LEVEL_RANK[before.level]);

    reviewed.assignments.find((a) => a.id === 'a2')!.status = 'reviewed';
    expect(dimension(buildLegalMindProfile(reviewed), 'drafting').evidence.join(' ')).toContain('case-brief draft');
  });

  it('updates from senior review results', () => {
    const base = createInitialSave();
    base.reviewRounds = [
      {
        id: 'r-accepted',
        day: 9,
        assignmentId: 'a7',
        round: 2,
        status: 'accepted',
        feedback: 'Accepted.',
        strengths: ['Work summary states the issue and the basis for conclusions.', 'Verified source notes attached.'],
        gaps: [],
      },
    ];
    expect(dimension(buildLegalMindProfile(base), 'legal-interpretation').evidence.join(' ')).toContain(
      'verified source notes',
    );
    expect(dimension(buildLegalMindProfile(base), 'logical-consistency').evidence.join(' ')).toContain(
      'basis for your conclusions',
    );

    base.reviewRounds.unshift({
      id: 'r-revision',
      day: 9,
      assignmentId: 'a7',
      round: 1,
      status: 'needs_revision',
      feedback: 'Revise.',
      strengths: [],
      gaps: ['Expand the work summary.'],
    });
    expect(dimension(buildLegalMindProfile(base), 'drafting').evidence.join(' ')).toContain('revised and resubmitted');
    expect(dimension(buildLegalMindProfile(base), 'counterargument-anticipation').evidence.join(' ')).toContain(
      'resubmitted your work',
    );
  });

  it('updates from case conclusions', () => {
    const base = createInitialSave();
    const before = dimension(buildLegalMindProfile(base), 'strategy');

    const closed = structuredClone(base);
    closed.flags.finalBriefSubmitted = true;
    closed.flags.chapterOneComplete = true;
    closed.caseFile.status = 'closed';
    const after = dimension(buildLegalMindProfile(closed), 'strategy');
    expect(after.evidence.join(' ')).toContain('final submission');
    expect(LEGAL_MIND_LEVEL_RANK[after.level]).toBeGreaterThan(LEGAL_MIND_LEVEL_RANK[before.level]);
    expect(dimension(buildLegalMindProfile(closed), 'drafting').evidence.join(' ')).toContain('final brief');
  });

  it('updates from evidence discoveries and reviews', () => {
    const base = createInitialSave();
    const discovered = structuredClone(base);
    expect(discoverEvidenceItem(discovered, 'ev-1')).not.toBeNull();
    // Discovery alone is not relied-upon work: no dimension level moves yet.
    expect(dimension(buildLegalMindProfile(discovered), 'evidence-evaluation').level).toBe('emerging');

    expect(reviewEvidence(discovered, 'ev-1')).toBe(true);
    expect(discoverEvidenceItem(discovered, 'ev-2')).not.toBeNull();
    expect(reviewEvidence(discovered, 'ev-2')).toBe(true);
    const after = dimension(buildLegalMindProfile(discovered), 'evidence-evaluation');
    expect(after.level).toBe('developing');
    expect(after.evidence.join(' ')).toContain('reviewed items of evidence');
  });

  it('updates from AI review accepted and rejected outcomes', () => {
    const base = createInitialSave();
    const record = {
      id: 'ai-1',
      day: 9,
      assignmentId: 'a7',
      round: 1,
      requestId: 'req-1',
      deterministicStatus: 'accepted' as const,
      summary: 'Structured feedback.',
      citedSources: ['ls-4'],
      warnings: [],
    };

    const accepted = structuredClone(base);
    accepted.aiReviews = [{ ...record, gatewayStatus: 'accepted', aiAssisted: true }];
    expect(dimension(buildLegalMindProfile(accepted), 'precedent-analysis').evidence.join(' ')).toContain(
      'cited sources',
    );

    const rejected = structuredClone(base);
    rejected.aiReviews = [{ ...record, gatewayStatus: 'rejected', aiAssisted: false, citedSources: [] }];
    const counter = dimension(buildLegalMindProfile(rejected), 'counterargument-anticipation');
    expect(counter.evidence.join(' ')).toContain('provenance gates');
    expect(LEGAL_MIND_LEVEL_RANK[counter.level]).toBeGreaterThan(
      LEGAL_MIND_LEVEL_RANK[dimension(buildLegalMindProfile(base), 'counterargument-anticipation').level],
    );
  });

  it('stores and retrieves every dimension through save round-trips and v1/v2 migration', () => {
    const completed = completeChapter();
    const storage = memoryStorage();
    expect(persistSave(completed, storage).ok).toBe(true);
    const loaded = loadSave(storage);
    const original = buildLegalMindProfile(completed);
    const retrieved = buildLegalMindProfile(loaded);

    expect(retrieved).toEqual(original);
    expect(retrieved.dimensions).toHaveLength(LEGAL_MIND_DIMENSION_IDS.length);
    for (const id of LEGAL_MIND_DIMENSION_IDS) {
      const before = original.dimensions.find((d) => d.id === id)!;
      const after = retrieved.dimensions.find((d) => d.id === id)!;
      expect(after.level).toBe(before.level);
      expect(after.evidence).toEqual(before.evidence);
    }

    // An unknown/stored profile field from an older or tampered save is ignored: the profile is
    // always rebuilt from recorded gameplay events, never trusted from storage.
    const payload = JSON.parse(storage.getItem(SAVE_KEY)!) as Record<string, any>;
    payload.version = 1;
    payload.legalMindProfile = { dimensions: [{ id: 'score', level: 10 }], score: 10 };
    delete payload.auditLog;
    const legacy = loadSave(memoryStorage({ 'the-bar-save-v1': JSON.stringify(payload) }));
    expect(legacy.version).toBe(2);
    const migrated = buildLegalMindProfile(legacy);
    expect(migrated.dimensions.map((d) => d.id)).toEqual([...LEGAL_MIND_DIMENSION_IDS]);
    expect(migrated).not.toHaveProperty('score');
    expect(migrated).toEqual(original);
  });
});
