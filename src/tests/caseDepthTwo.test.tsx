import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '@/app/App';
import { assertNoCanonicalTruthLeak, toPlayerCaseView } from '@/domain/caseAccess';
import { buildCaseSummary } from '@/domain/caseSummary';
import {
  challengeEvidenceAdmissibility,
  recordCustodyObservation,
  submitFinalBrief,
  submitSeniorReview,
} from '@/domain/casework';
import { buildChapterCompletionSummary } from '@/domain/completion';
import { applyDialogueChoice, availableDialogueScenes } from '@/domain/dialogue';
import { addEvidenceNote, discoverEvidenceItem, reviewEvidence, setEvidenceAssessment } from '@/domain/evidence';
import { checkDraftCitations } from '@/domain/guards';
import { looksLikeSpecificCitation } from '@/domain/legalSources';
import { advanceClock, reviewAssignment } from '@/domain/progression';
import { ALL_REVIEW_PROMPT_TEXT, reviewPromptsFor } from '@/domain/reviewPrompts';
import { DIALOGUE_SCENES, createInitialSave } from '@/domain/seed';
import { loadSave, persistSave, SAVE_KEY } from '@/storage/save';
import type { StorageLike } from '@/storage/save';
import type { SaveGame } from '@/domain/types';

const NEW_EVIDENCE_IDS = ['ev-10', 'ev-11'];
const NEW_EVENT_IDS = ['d-clerk-custody-gap', 'd-specialist-still-scope'];
const NEW_OPEN_QUESTIONS = [
  'Whether the corridor still and the canteen clip can be read on the same timeline.',
  'Whether the second staff recollection note can be reconciled with the supervisor’s account.',
];
const CANONICAL_MARKERS = [
  'canonicaltruth',
  'actualevents',
  'actualtimeline',
  'responsibleparties',
  'hiddenmotives',
  'evidenceauthenticity',
  'unresolvedambiguities',
  'prior dispute',
  '18:05',
  '18:10',
  '18:12',
  '18:15',
  '18:20',
  'first physical contact',
  '"ev-10":false',
  '"ev-11":true',
];

const GOOD_SUMMARY =
  'Issue: what happened outside the canteen. I reviewed the medical report, the partial clip, the corridor still and the staff notes, attached the verified educational summary, and kept known facts separate from claims and disputed points.';
const NEW_SOURCE_NOTE = {
  id: 'n-source',
  day: 2,
  kind: 'research' as const,
  title: 'Source: verified educational summary',
  content: 'Verified educational summary on evidence handling.',
  sourceId: 'ls-4',
  source: 'Educational summary',
  verified: true,
};

function advanceToDay(save: SaveGame, day: number): void {
  while (save.clock.day < day) advanceClock(save);
}

function discoverAndReview(save: SaveGame, id: string): void {
  if (!discoverEvidenceItem(save, id)) throw new Error(`cannot discover ${id}`);
  if (!reviewEvidence(save, id)) throw new Error(`cannot review ${id}`);
}

function authoredText(sceneIds: readonly string[]): string[] {
  return DIALOGUE_SCENES.filter((scene) => sceneIds.includes(scene.id)).flatMap((scene) => [
    scene.prompt,
    ...scene.choices.flatMap((choice) => [choice.label, choice.reply, choice.memory, ...(choice.reveals ?? [])]),
  ]);
}

function expectSafePlayerText(text: string, save: SaveGame): void {
  expect(looksLikeSpecificCitation(text)).toBe(false);
  expect(checkDraftCitations(text, save.legalSources).blocked).toEqual([]);
  const lower = text.toLowerCase();
  for (const marker of CANONICAL_MARKERS) expect(lower).not.toContain(marker);
}

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = { ...initial };
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

/** Day 1–10 playthrough that resolves the new events and reviews the expanded file. */
function playExpandedChapter(): SaveGame {
  const save = createInitialSave();
  advanceToDay(save, 2);
  applyDialogueChoice(save, 'd-client-interview', 'ask-personal-observation');
  discoverAndReview(save, 'ev-1');
  save.notebook.unshift({ ...NEW_SOURCE_NOTE, day: save.clock.day });
  expect(reviewAssignment(save, 'a1').ok).toBe(true);

  advanceToDay(save, 3);
  applyDialogueChoice(save, 'd-clerk-custody-gap', 'record-gap');
  discoverAndReview(save, 'ev-2');
  expect(reviewAssignment(save, 'a2').ok).toBe(true);

  advanceToDay(save, 5);
  discoverAndReview(save, 'ev-3');
  addEvidenceNote(save, 'ev-3', 'contradiction', 'The witness account does not address the gap in the clip.');
  discoverAndReview(save, 'ev-10');
  discoverAndReview(save, 'ev-11');
  addEvidenceNote(save, 'ev-10', 'corroboration', 'The corridor still bears on movement near the door.');
  expect(reviewAssignment(save, 'a3').ok).toBe(true);

  advanceToDay(save, 6);
  applyDialogueChoice(save, 'd-specialist-still-scope', 'scope-limits');
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

describe('expanded evidence set (ev-10, ev-11)', () => {
  it('appends two documented items with provenance and player-visible ambiguity', () => {
    const save = createInitialSave();
    const ids = save.caseFile.evidence.map((e) => e.id);
    expect(ids.slice(-2)).toEqual(NEW_EVIDENCE_IDS);
    expect(ids).toHaveLength(11);

    for (const id of NEW_EVIDENCE_IDS) {
      const item = save.caseFile.evidence.find((e) => e.id === id)!;
      expect(item.provenance.length).toBeGreaterThan(10);
      expect(item.provenance).toContain('fictional seed');
      expect(item.description.length).toBeGreaterThan(80);
      expect(item.description).toMatch(/may|does not|not |cannot|differs|without/i);
      expect(item.discovered).toBe(false);
      expect(item.reviewed).toBe(false);
      expect(item.assessment).toEqual({ admissibility: 'unknown', reliability: 'unknown', rationale: '' });
    }
    expect(NEW_EVIDENCE_IDS.map((id) => save.caseFile.evidence.find((e) => e.id === id)!.type)).toEqual([
      'digital',
      'testimony',
    ]);
  });

  it('keeps hidden authenticity values append-only and out of every player-facing view', () => {
    const save = createInitialSave();
    expect(save.caseFile.canonicalTruth.evidenceAuthenticity['ev-10']).toBe(false);
    expect(save.caseFile.canonicalTruth.evidenceAuthenticity['ev-11']).toBe(true);
    // Earlier entries and canonical facts are never rewritten.
    expect(save.caseFile.canonicalTruth.evidenceAuthenticity['ev-9']).toBe(true);
    expect(save.caseFile.canonicalTruth.actualEvents.slice(0, 3)).toEqual([
      'A shove occurred after an argument.',
      'A phone recording is incomplete and may be misleading.',
      'Medical report confirms minor injury but timing is disputed.',
    ]);

    for (const id of NEW_EVIDENCE_IDS) {
      discoverEvidenceItem(save, id);
      reviewEvidence(save, id);
    }
    const playerFacing = JSON.stringify({
      view: toPlayerCaseView(save.caseFile),
      summary: buildCaseSummary(save),
      synthesis: buildChapterCompletionSummary(save).synthesis,
      completion: buildChapterCompletionSummary(save),
      notebook: save.notebook,
      memories: save.memories,
    }).toLowerCase();
    expect(() => assertNoCanonicalTruthLeak(playerFacing)).not.toThrow();
    for (const marker of CANONICAL_MARKERS) expect(playerFacing).not.toContain(marker);
  });

  it('follows the discover → review → assess → note flow', () => {
    const save = createInitialSave();
    for (const id of NEW_EVIDENCE_IDS) {
      expect(toPlayerCaseView(save.caseFile).evidence.find((e) => e.id === id)!.description).toBe(
        'Not yet discovered.',
      );
      expect(setEvidenceAssessment(save, id, { admissibility: 'admissible' })).toBe(false);
      expect(addEvidenceNote(save, id, 'corroboration', 'note')).toBeNull();

      const item = discoverEvidenceItem(save, id);
      expect(item?.admissibility).toBe('questionable');
      expect(item?.reliability).toBe(id === 'ev-11' ? 'low' : 'medium');
      expect(reviewEvidence(save, id)).toBe(true);
      expect(reviewEvidence(save, id)).toBe(false);
      expect(
        setEvidenceAssessment(save, id, { admissibility: 'questionable', rationale: 'Context is incomplete.' }),
      ).toBe(true);
      expect(addEvidenceNote(save, id, 'corroboration', 'It bears on timing only.')?.evidenceId).toBe(id);

      const viewItem = toPlayerCaseView(save.caseFile).evidence.find((e) => e.id === id)!;
      expect(viewItem.description).not.toBe('Not yet discovered.');
      expect(viewItem.assessment?.rationale).toBe('Context is incomplete.');
    }
  });

  it('adds explicit unresolved questions without asserting what really happened', () => {
    const summary = buildCaseSummary(createInitialSave());
    for (const question of NEW_OPEN_QUESTIONS) expect(summary.openQuestions).toContain(question);
    expect(summary.openQuestions).toContain('What happened in the missing 20 seconds of video?');
    expect(summary.openQuestions.join(' ')).not.toMatch(/18:\d\d|prior dispute|first physical contact/i);
    for (const question of NEW_OPEN_QUESTIONS) expectSafePlayerText(question, createInitialSave());
  });

  it('contains no fabricated citations or canonical markers in new evidence text', () => {
    const save = createInitialSave();
    const texts = NEW_EVIDENCE_IDS.flatMap((id) => {
      const item = save.caseFile.evidence.find((e) => e.id === id)!;
      return [item.title, item.description, item.provenance];
    });
    for (const text of texts) expectSafePlayerText(text, save);
  });
});

describe('new day-gated events with bounded consequences', () => {
  it('defines once-only events on Days 3 and 6', () => {
    const save = createInitialSave();
    for (const id of NEW_EVENT_IDS) {
      const scene = DIALOGUE_SCENES.find((s) => s.id === id)!;
      expect(scene).toBeDefined();
      expect(scene.once).toBe(true);
      expect(scene.kind).toBe('event');
      expect(scene.choices).toHaveLength(2);
    }
    expect(DIALOGUE_SCENES.find((s) => s.id === 'd-clerk-custody-gap')!.minDay).toBe(3);
    expect(DIALOGUE_SCENES.find((s) => s.id === 'd-specialist-still-scope')!.minDay).toBe(6);
    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-clerk-custody-gap');
    advanceToDay(save, 3);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-clerk-custody-gap');
    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-specialist-still-scope');
    advanceToDay(save, 6);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-specialist-still-scope');
  });

  it('the Day 3 custody event changes relationships, standing, memory and player knowledge', () => {
    const save = createInitialSave();
    advanceToDay(save, 3);
    const clerk = save.relationships.find((r) => r.toId === 'clerk')!;
    const knowledgeBefore = save.caseFile.playerKnowledge.length;
    const result = applyDialogueChoice(save, 'd-clerk-custody-gap', 'record-gap');

    expect(result.ok).toBe(true);
    expect(result.characterId).toBe('clerk');
    expect(clerk.trust).toBe(35);
    expect(clerk.respect).toBe(33);
    expect(save.player.reputation.reliability).toBe(12);
    expect(result.reputationEffects).toEqual([{ dimension: 'reliability', amount: 2 }]);
    expect(save.flags.custodyGapRecorded).toBe(true);
    expect(save.caseFile.playerKnowledge.length).toBe(knowledgeBefore + 1);
    expect(result.reveals?.[0]).toContain('without a documented sealing record');
    expect(save.memories[0].summary).toContain('filing register');
    expect(applyDialogueChoice(save, 'd-clerk-custody-gap', 'record-gap').ok).toBe(false);
  });

  it('the Day 3 shortcut damages standing and reveals nothing', () => {
    const save = createInitialSave();
    advanceToDay(save, 3);
    const clerk = save.relationships.find((r) => r.toId === 'clerk')!;
    const knowledgeBefore = save.caseFile.playerKnowledge.length;
    const result = applyDialogueChoice(save, 'd-clerk-custody-gap', 'leave-clean');

    expect(result.ok).toBe(true);
    expect(result.reveals).toBeUndefined();
    expect(clerk.trust).toBe(26);
    expect(clerk.resentment).toBe(3);
    expect(save.player.reputation.integrity).toBe(8);
    expect(save.player.reputation.reliability).toBe(9);
    expect(save.caseFile.playerKnowledge.length).toBe(knowledgeBefore);
    expect(save.flags.custodyGapRecorded).toBe(true);
  });

  it('the Day 6 still-scope event rewards the honest limit and stays within the specialist’s knowledge', () => {
    const save = createInitialSave();
    advanceToDay(save, 6);
    const specialist = save.relationships.find((r) => r.toId === 'specialist')!;
    const knowledgeBefore = save.caseFile.playerKnowledge.length;
    const result = applyDialogueChoice(save, 'd-specialist-still-scope', 'scope-limits');

    expect(result.ok).toBe(true);
    expect(result.characterId).toBe('specialist');
    expect(specialist.trust).toBe(35);
    expect(specialist.respect).toBe(45);
    expect(save.player.reputation.competence).toBe(12);
    expect(save.player.reputation.reliability).toBe(11);
    expect(save.flags.stillScopeNoted).toBe(true);
    expect(save.caseFile.playerKnowledge.length).toBe(knowledgeBefore + 1);
    expect(result.reveals?.[0]).toContain('not checked against a common clock');
    expect(save.memories[0].summary).toContain('corridor still');
  });

  it('overstating the still lowers standing without revealing facts', () => {
    const save = createInitialSave();
    advanceToDay(save, 6);
    const specialist = save.relationships.find((r) => r.toId === 'specialist')!;
    const knowledgeBefore = save.caseFile.playerKnowledge.length;
    const result = applyDialogueChoice(save, 'd-specialist-still-scope', 'overstate-still');

    expect(result.ok).toBe(true);
    expect(result.reveals).toBeUndefined();
    expect(specialist.respect).toBe(35);
    expect(specialist.resentment).toBe(4);
    expect(save.player.reputation.integrity).toBe(8);
    expect(save.player.reputation.competence).toBe(9);
    expect(save.caseFile.playerKnowledge.length).toBe(knowledgeBefore);
    expect(save.flags.stillScopeNoted).toBe(true);
  });

  it('never leaks canonical truth or citations through event content or its consequences', () => {
    const save = createInitialSave();
    for (const text of authoredText(NEW_EVENT_IDS)) expectSafePlayerText(text, save);

    advanceToDay(save, 6);
    applyDialogueChoice(save, 'd-clerk-custody-gap', 'record-gap');
    applyDialogueChoice(save, 'd-specialist-still-scope', 'scope-limits');
    const playerFacing = {
      knowledge: save.caseFile.playerKnowledge,
      notebook: save.notebook,
      memories: save.memories,
      summary: buildCaseSummary(save),
    };
    const json = JSON.stringify(playerFacing).toLowerCase();
    expect(() => assertNoCanonicalTruthLeak(playerFacing)).not.toThrow();
    for (const marker of CANONICAL_MARKERS) expect(json).not.toContain(marker);
  });
});

describe('review prompts and case-coherence coverage', () => {
  it('keeps new prompts hidden until their items are discovered and reviewed', () => {
    const save = createInitialSave();
    expect(reviewPromptsFor(save)).toEqual([]);

    discoverEvidenceItem(save, 'ev-10');
    expect(reviewPromptsFor(save)).toEqual([]);
    reviewEvidence(save, 'ev-10');
    expect(reviewPromptsFor(save).map((p) => p.id)).toEqual(['rp-adjacent-still']);

    discoverAndReview(save, 'ev-11');
    expect(reviewPromptsFor(save).map((p) => p.id)).toEqual(['rp-adjacent-still', 'rp-staff-recollection']);
  });

  it('new prompt text is player-legible, citations-free and truth-safe', () => {
    const save = createInitialSave();
    for (const text of ALL_REVIEW_PROMPT_TEXT) {
      expectSafePlayerText(text, save);
      expect(() => assertNoCanonicalTruthLeak({ text })).not.toThrow();
    }
  });

  it('reports review coverage of the expanded file and renders it on the case board', () => {
    const save = createInitialSave();
    expect(buildCaseSummary(save).coverageNote).toContain('0 of 11 items');
    discoverAndReview(save, 'ev-10');
    discoverAndReview(save, 'ev-11');
    const summary = buildCaseSummary(save);
    expect(summary.coverageNote).toContain('2 of 11 items');
    expect(summary.coverageNote).not.toContain('canonical');

    const storage = memoryStorage();
    persistSave(save, storage);
    const globals = globalThis as Record<string, unknown>;
    const previous = globals.window;
    globals.window = { localStorage: storage };
    try {
      const html = renderToString(<App initialPanel="case" />).replace(/<!-- -->/g, '');
      expect(html).toContain('2 of 11 items');
      expect(html).toContain('Evidence 2/11 discovered');
      expect(html).toContain('Corroboration limits');
      for (const marker of CANONICAL_MARKERS) expect(html.toLowerCase()).not.toContain(marker);
    } finally {
      globals.window = previous;
    }
  });
});

describe('migration compatibility and progression integrity', () => {
  it('appends new evidence and flags to an older save without changing progression', () => {
    const payload = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    payload.version = 2;
    payload.caseFile.evidence = payload.caseFile.evidence.filter(
      (e: { id: string }) => !NEW_EVIDENCE_IDS.includes(e.id),
    );
    delete payload.flags.custodyGapRecorded;
    delete payload.flags.stillScopeNoted;
    payload.flags.caseAccepted = true;

    const loaded = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(payload) }));
    expect(loaded.caseFile.evidence.map((e) => e.id)).toEqual(createInitialSave().caseFile.evidence.map((e) => e.id));
    for (const id of NEW_EVIDENCE_IDS) {
      const item = loaded.caseFile.evidence.find((e) => e.id === id)!;
      expect(item.discovered).toBe(false);
      expect(item.reviewed).toBe(false);
      expect(item.assessment.rationale).toBe('');
    }
    expect(loaded.flags.custodyGapRecorded).toBe(false);
    expect(loaded.flags.stillScopeNoted).toBe(false);
    expect(loaded.flags.caseAccepted).toBe(true);
    expect(loaded.assignments.map((a) => a.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']);
    expect(
      loaded.assignments.flatMap((a) => a.requiredEvidenceIds).every((id) => ['ev-1', 'ev-2', 'ev-3'].includes(id)),
    ).toBe(true);
    expect(loaded.clock).toEqual({ day: 1, slot: 'morning' });
  });

  it('keeps resolved new events resolved across a save round-trip', () => {
    const save = createInitialSave();
    advanceToDay(save, 6);
    applyDialogueChoice(save, 'd-clerk-custody-gap', 'record-gap');
    applyDialogueChoice(save, 'd-specialist-still-scope', 'scope-limits');
    const storage = memoryStorage();
    persistSave(save, storage);
    const loaded = loadSave(storage);

    expect(loaded.usedDialogueSceneIds).toEqual(NEW_EVENT_IDS);
    expect(loaded.flags.custodyGapRecorded).toBe(true);
    expect(loaded.flags.stillScopeNoted).toBe(true);
    expect(availableDialogueScenes(loaded).map((s) => s.id)).not.toContain('d-specialist-still-scope');
    expect(applyDialogueChoice(loaded, 'd-specialist-still-scope', 'scope-limits').ok).toBe(false);
  });
});

describe('endgame coherence with the expanded file', () => {
  it('final feedback reflects review coverage and keeps unresolved ambiguity explicit', () => {
    const save = playExpandedChapter();
    const a8 = save.assignments.find((a) => a.id === 'a8')!;
    const feedback = a8.feedback ?? '';
    expect(a8.status).toBe('reviewed');
    expect(feedback).toContain('You reviewed');
    expect(feedback).toContain('items on the file');
    expect(feedback).toContain('player-visible open question');
    for (const line of feedback.split(/(?<=\.)\s+/)) expectSafePlayerText(line, save);

    const completion = buildChapterCompletionSummary(save);
    expect(completion.openQuestions).toEqual(toPlayerCaseView(save.caseFile).unresolvedAmbiguity);
    for (const question of NEW_OPEN_QUESTIONS) expect(completion.openQuestions).toContain(question);
    expect(() => assertNoCanonicalTruthLeak(completion)).not.toThrow();
    const json = JSON.stringify(completion).toLowerCase();
    for (const marker of CANONICAL_MARKERS) expect(json).not.toContain(marker);
  });

  it('renders the expanded synthesis and new open questions on the completion screen', () => {
    const save = playExpandedChapter();
    const storage = memoryStorage();
    persistSave(save, storage);
    const globals = globalThis as Record<string, unknown>;
    const previous = globals.window;
    globals.window = { localStorage: storage };
    try {
      const html = renderToString(<App initialPanel="completion" />).replace(/<!-- -->/g, '');
      expect(html).toContain('Evidence synthesis &amp; open questions');
      expect(html).toContain('Second staff recollection note');
      expect(html).toContain('corridor still and the canteen clip');
      expect(html).toContain('player-visible open question');
      for (const marker of CANONICAL_MARKERS) expect(html.toLowerCase()).not.toContain(marker);
    } finally {
      globals.window = previous;
    }
  });
});
