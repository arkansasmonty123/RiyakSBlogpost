import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '@/app/App';
import { DIALOGUE_SCENES, createInitialSave } from '@/domain/seed';
import { assertNoCanonicalTruthLeak, toPlayerCaseView } from '@/domain/caseAccess';
import { buildCaseSummary } from '@/domain/caseSummary';
import { addEvidenceNote, discoverEvidenceItem, reviewEvidence, setEvidenceAssessment } from '@/domain/evidence';
import { checkDraftCitations } from '@/domain/guards';
import { buildCaseJournal } from '@/domain/journal';
import { looksLikeSpecificCitation } from '@/domain/legalSources';
import { advanceClock, currentObjective, MAX_DAY } from '@/domain/progression';
import { applyDialogueChoice, availableDialogueScenes } from '@/domain/dialogue';
import { loadSave, SAVE_KEY } from '@/storage/save';
import type { StorageLike } from '@/storage/save';
import type { SaveGame } from '@/domain/types';

const NEW_EVIDENCE_IDS = ['ev-7', 'ev-8', 'ev-9'];
const EVENT_IDS = ['d-client-pressure', 'd-junior-credit'];
const CANONICAL_MARKERS = [
  'canonicaltruth', 'actualevents', 'actualtimeline', 'responsibleparties',
  'hiddenmotives', 'evidenceauthenticity', 'prior dispute',
  '18:05', '18:10', '18:12', '18:15', '18:20',
];

function advanceToDay(save: SaveGame, day: number): void {
  while (save.clock.day < day) advanceClock(save);
}

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

function renderApp(panel: 'case' | 'dialogue' | 'journal', save: SaveGame): string {
  const data: Record<string, string> = { [SAVE_KEY]: JSON.stringify(save) };
  const globals = globalThis as Record<string, unknown>;
  const previousWindow = globals.window;
  globals.window = {
    localStorage: {
      getItem: (key: string) => data[key] ?? null,
      setItem: (key: string, value: string) => { data[key] = value; },
      removeItem: (key: string) => { delete data[key]; },
    },
  };
  try {
    return renderToString(<App initialPanel={panel} />).replace(/<!-- -->/g, '');
  } finally {
    globals.window = previousWindow;
  }
}

function authoredText(sceneIds: readonly string[]): string[] {
  return DIALOGUE_SCENES.filter((s) => sceneIds.includes(s.id)).flatMap((scene) => [
    scene.prompt,
    ...scene.choices.flatMap((choice) => [
      choice.label, choice.reply, choice.memory, ...(choice.reveals ?? []),
    ]),
  ]);
}

describe('richer evidence set (ev-7..ev-9)', () => {
  it('appends three documented items with provenance and player-visible ambiguity', () => {
    const save = createInitialSave();
    const ids = save.caseFile.evidence.map((e) => e.id);
    expect(ids).toEqual(['ev-1', 'ev-2', 'ev-3', 'ev-4', 'ev-5', 'ev-6', 'ev-7', 'ev-8', 'ev-9']);

    for (const id of NEW_EVIDENCE_IDS) {
      const item = save.caseFile.evidence.find((e) => e.id === id)!;
      expect(item.provenance.length).toBeGreaterThan(10);
      expect(item.provenance).toContain('fictional seed');
      expect(item.description.length).toBeGreaterThan(80);
      // Ambiguity / corroboration language is player-visible, not a conclusion.
      expect(item.description).toMatch(/may|does not|not |incomplete|differs|bears on/i);
      expect(item.discovered).toBe(false);
      expect(item.reviewed).toBe(false);
      expect(item.assessment).toEqual({ admissibility: 'unknown', reliability: 'unknown', rationale: '' });
    }

    const types = NEW_EVIDENCE_IDS.map((id) => save.caseFile.evidence.find((e) => e.id === id)!.type);
    expect(types).toEqual(['documentary', 'digital', 'testimony']);
  });

  it('keeps new authenticity values in canonical truth only, never in the player view', () => {
    const save = createInitialSave();
    for (const id of NEW_EVIDENCE_IDS) {
      expect(id in save.caseFile.canonicalTruth.evidenceAuthenticity).toBe(true);
    }
    // Original canonical content is untouched (append-only).
    expect(save.caseFile.canonicalTruth.actualEvents.slice(0, 3)).toEqual([
      'A shove occurred after an argument.',
      'A phone recording is incomplete and may be misleading.',
      'Medical report confirms minor injury but timing is disputed.',
    ]);
    expect(save.caseFile.canonicalTruth.hiddenMotives).toContain('Witness had prior dispute with complainant');

    for (const id of NEW_EVIDENCE_IDS) {
      discoverEvidenceItem(save, id);
      reviewEvidence(save, id);
    }
    const playerFacing = JSON.stringify({
      view: toPlayerCaseView(save.caseFile),
      notebook: save.notebook,
      memories: save.memories,
      summary: buildCaseSummary(save),
    }).toLowerCase();
    expect(() => assertNoCanonicalTruthLeak(playerFacing)).not.toThrow();
    for (const marker of CANONICAL_MARKERS) expect(playerFacing).not.toContain(marker);
    for (const value of ['"ev-7":true', '"ev-8":false', '"ev-9":true']) {
      expect(playerFacing).not.toContain(value);
    }
  });

  it('follows the same discover → review → assess flow as core evidence', () => {
    const save = createInitialSave();
    for (const id of NEW_EVIDENCE_IDS) {
      expect(toPlayerCaseView(save.caseFile).evidence.find((e) => e.id === id)!.description).toBe('Not yet discovered.');
      expect(setEvidenceAssessment(save, id, { admissibility: 'admissible' })).toBe(false);

      const item = discoverEvidenceItem(save, id);
      expect(item?.admissibility).toBe('questionable');
      expect(item?.reliability).toBe(id === 'ev-9' ? 'low' : 'medium');
      expect(reviewEvidence(save, id)).toBe(true);
      expect(reviewEvidence(save, id)).toBe(false);
      expect(setEvidenceAssessment(save, id, { admissibility: 'questionable', rationale: 'Context is incomplete.' })).toBe(true);

      const viewItem = toPlayerCaseView(save.caseFile).evidence.find((e) => e.id === id)!;
      expect(viewItem.description).not.toBe('Not yet discovered.');
      expect(viewItem.assessment?.rationale).toBe('Context is incomplete.');
    }
  });

  it('adds player-visible open questions without closing any of them', () => {
    const summary = buildCaseSummary(createInitialSave());
    expect(summary.openQuestions).toContain('What happened in the missing 20 seconds of video?');
    expect(summary.openQuestions).toContain('Whether the camera clock and the clinic register times can be reconciled.');
    expect(summary.openQuestions).toContain('Whether the earlier and later eyewitness accounts can be reconciled.');
    expect(summary.openQuestions).toContain('Whether the message screenshot is complete and in context.');
    expect(summary.openQuestions.join(' ')).not.toMatch(/18:\d\d|prior dispute|first physical contact/i);
  });

  it('contains no fabricated citations or canonical markers in new evidence text', () => {
    const save = createInitialSave();
    const texts = NEW_EVIDENCE_IDS.flatMap((id) => {
      const item = save.caseFile.evidence.find((e) => e.id === id)!;
      return [item.title, item.description, item.provenance];
    });
    for (const text of texts) {
      expect(looksLikeSpecificCitation(text)).toBe(false);
      expect(checkDraftCitations(text, save.legalSources).blocked).toEqual([]);
    }
    for (const marker of CANONICAL_MARKERS) expect(JSON.stringify(texts).toLowerCase()).not.toContain(marker);
  });
});

describe('day-gated world events with consequences', () => {
  it('defines two once-only events on Days 4 and 9, gated and labelled as events', () => {
    const save = createInitialSave();
    for (const id of EVENT_IDS) {
      const scene = DIALOGUE_SCENES.find((s) => s.id === id)!;
      expect(scene).toBeDefined();
      expect(scene.kind).toBe('event');
      expect(scene.once).toBe(true);
      expect(scene.choices.length).toBe(2);
    }
    expect(DIALOGUE_SCENES.find((s) => s.id === 'd-client-pressure')!.minDay).toBe(4);
    expect(DIALOGUE_SCENES.find((s) => s.id === 'd-junior-credit')!.minDay).toBe(9);

    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-client-pressure');
    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-junior-credit');
    advanceToDay(save, 4);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-client-pressure');
    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-junior-credit');
    advanceToDay(save, 9);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-junior-credit');
  });

  it('the Day 4 client event changes relationships, standing, memory and player knowledge only', () => {
    const save = createInitialSave();
    advanceToDay(save, 4);
    const client = save.relationships.find((r) => r.toId === 'client')!;
    const senior = save.relationships.find((r) => r.toId === 'senior')!;
    const knowledgeBefore = save.caseFile.playerKnowledge.length;
    const result = applyDialogueChoice(save, 'd-client-pressure', 'provisional-view');

    expect(result.ok).toBe(true);
    expect(result.characterId).toBe('client');
    expect(client.trust).toBe(31);
    expect(client.respect).toBe(33);
    expect(senior.respect).toBe(43);
    expect(result.reputationEffects).toEqual([{ dimension: 'reliability', amount: 2 }]);
    expect(save.player.reputation.reliability).toBe(12);
    expect(save.flags.clientPressureHandled).toBe(true);
    expect(save.caseFile.playerKnowledge.length).toBe(knowledgeBefore + 1);
    expect(save.notebook.some((n) => n.title === 'The Client — fact stated')).toBe(true);
    expect(save.memories[0].summary).toContain('provisional');
    expect(applyDialogueChoice(save, 'd-client-pressure', 'provisional-view').ok).toBe(false);
  });

  it('the Day 4 shortcut damages trust and standing and reveals nothing', () => {
    const save = createInitialSave();
    advanceToDay(save, 4);
    const client = save.relationships.find((r) => r.toId === 'client')!;
    const senior = save.relationships.find((r) => r.toId === 'senior')!;
    const knowledgeBefore = save.caseFile.playerKnowledge.length;
    const result = applyDialogueChoice(save, 'd-client-pressure', 'promise-outcome');

    expect(result.ok).toBe(true);
    expect(result.reveals).toBeUndefined();
    expect(client.trust).toBe(20);
    expect(client.respect).toBe(27);
    expect(senior.respect).toBe(36);
    expect(senior.resentment).toBe(3);
    expect(save.player.reputation.integrity).toBe(8);
    expect(save.player.reputation.reliability).toBe(9);
    expect(save.caseFile.playerKnowledge.length).toBe(knowledgeBefore);
    expect(save.flags.clientPressureHandled).toBe(true);
  });

  it('the Day 9 junior-credit event rewards attribution and adds a bounded player-knowledge fact', () => {
    const save = createInitialSave();
    advanceToDay(save, 9);
    const junior = save.relationships.find((r) => r.toId === 'junior')!;
    const knowledgeBefore = save.caseFile.playerKnowledge.length;
    const result = applyDialogueChoice(save, 'd-junior-credit', 'credit-note');

    expect(result.ok).toBe(true);
    expect(result.characterId).toBe('junior');
    expect(junior.trust).toBe(41);
    expect(junior.respect).toBe(34);
    expect(junior.loyalty).toBe(28);
    expect(junior.professionalDependence).toBe(22);
    expect(save.player.reputation.integrity).toBe(12);
    expect(save.player.reputation.reliability).toBe(11);
    expect(save.flags.juniorCredited).toBe(true);
    expect(save.caseFile.playerKnowledge.length).toBe(knowledgeBefore + 1);
    expect(result.reveals?.[0]).toContain('does not resolve the disputed sequence');
    expect(save.notebook.some((n) => n.title === 'Priya Nair — fact stated')).toBe(true);
    expect(save.memories[0].summary).toContain('Credited Priya Nair');
  });

  it('claiming the junior’s work damages the relationship and standing without revealing facts', () => {
    const save = createInitialSave();
    advanceToDay(save, 9);
    const junior = save.relationships.find((r) => r.toId === 'junior')!;
    const knowledgeBefore = save.caseFile.playerKnowledge.length;
    const result = applyDialogueChoice(save, 'd-junior-credit', 'claim-note');

    expect(result.ok).toBe(true);
    expect(result.reveals).toBeUndefined();
    expect(junior.trust).toBe(29);
    expect(junior.respect).toBe(25);
    expect(junior.resentment).toBe(4);
    expect(junior.rivalry).toBe(14);
    expect(save.player.reputation.integrity).toBe(8);
    expect(save.caseFile.playerKnowledge.length).toBe(knowledgeBefore);
    expect(save.flags.juniorCredited).toBe(true);
  });

  it('never leaks canonical truth or citations through event content or its consequences', () => {
    const save = createInitialSave();
    const texts = authoredText(EVENT_IDS);
    for (const text of texts) {
      expect(looksLikeSpecificCitation(text)).toBe(false);
      expect(checkDraftCitations(text, save.legalSources).blocked).toEqual([]);
    }
    for (const marker of CANONICAL_MARKERS) expect(JSON.stringify(texts).toLowerCase()).not.toContain(marker);

    advanceToDay(save, 9);
    applyDialogueChoice(save, 'd-client-pressure', 'provisional-view');
    applyDialogueChoice(save, 'd-junior-credit', 'credit-note');
    const playerFacing = {
      knowledge: save.caseFile.playerKnowledge,
      notebook: save.notebook,
      memories: save.memories,
      summary: buildCaseSummary(save),
      journal: buildCaseJournal(save),
    };
    const json = JSON.stringify(playerFacing).toLowerCase();
    expect(() => assertNoCanonicalTruthLeak(playerFacing)).not.toThrow();
    for (const marker of CANONICAL_MARKERS) expect(json).not.toContain(marker);
    for (const value of ['"ev-7":true', '"ev-8":false', '"ev-9":true']) expect(json).not.toContain(value);
  });
});

describe('case summary and timeline coherence', () => {
  it('reflects chapter phase and discovered/reviewed counts from player-visible state only', () => {
    const save = createInitialSave();
    let summary = buildCaseSummary(save);
    expect(summary.phase).toBe('Foundations · Days 1–5');
    expect(summary.evidenceTotal).toBe(9);
    expect(summary.discoveredCount).toBe(0);
    expect(summary.reviewedCount).toBe(0);

    discoverEvidenceItem(save, 'ev-7');
    summary = buildCaseSummary(save);
    expect(summary.discoveredCount).toBe(1);
    expect(summary.reviewedCount).toBe(0);

    reviewEvidence(save, 'ev-7');
    advanceToDay(save, 6);
    summary = buildCaseSummary(save);
    expect(summary.phase).toBe('First case · Days 6–10');
    expect(summary.reviewedCount).toBe(1);
  });

  it('surfaces corroboration and contradiction notes tied to evidence titles', () => {
    const save = createInitialSave();
    discoverEvidenceItem(save, 'ev-7');
    reviewEvidence(save, 'ev-7');
    addEvidenceNote(save, 'ev-7', 'corroboration', 'The timing note bears on the clip timing question.');
    discoverEvidenceItem(save, 'ev-9');
    reviewEvidence(save, 'ev-9');
    addEvidenceNote(save, 'ev-9', 'contradiction', 'The two witness accounts differ in emphasis.');

    const summary = buildCaseSummary(save);
    expect(summary.evidenceNoteCount).toBeGreaterThanOrEqual(2);
    expect(summary.corroborationLinks).toHaveLength(2);
    expect(summary.corroborationLinks.map((l) => l.evidenceTitle)).toEqual([
      'Earlier eyewitness account', 'Camera clock synchronisation note',
    ]);
    expect(summary.corroborationLinks.map((l) => l.relation)).toEqual(['contradiction', 'corroboration']);
    expect(summary.corroborationLinks.every((l) => l.note.length > 0 && l.day >= 1)).toBe(true);
  });

  it('gives recorded events readable titles drawn from the player’s own memory', () => {
    const save = createInitialSave();
    advanceClock(save); // morning -> afternoon, no new day
    advanceToDay(save, 2);
    save.memories.unshift({
      id: 'm-custom', day: 2,
      summary: 'Reviewed evidence: Camera clock synchronisation note.',
      participants: ['player'],
    });
    const titles = buildCaseJournal(save).filter((e) => e.kind === 'event').map((e) => e.title);
    expect(titles).toContain('Day 2 begins');
    expect(titles).toContain('Reviewed evidence: Camera clock synchronisation note');
    expect(buildCaseJournal(save).every((e) => e.title.length > 0)).toBe(true);
  });

  it('renders the new case content and event badges without leaking truth', () => {
    const save = createInitialSave();
    discoverEvidenceItem(save, 'ev-7');
    reviewEvidence(save, 'ev-7');
    addEvidenceNote(save, 'ev-7', 'corroboration', 'The timing note bears on the clip timing question.');

    const caseHtml = renderApp('case', save);
    expect(caseHtml).toContain('Case at a glance');
    expect(caseHtml).toContain('Foundations · Days 1–5');
    expect(caseHtml).toContain('Evidence 1/9 discovered');
    expect(caseHtml).toContain('Corroboration &amp; contradiction notes');
    expect(caseHtml).toContain('Camera clock synchronisation note');

    advanceToDay(save, 9);
    const dialogueHtml = renderApp('dialogue', save);
    expect(dialogueHtml).toContain('Available conversations &amp; events (Day 9)');
    expect(dialogueHtml).toContain('World event');
    expect(dialogueHtml).toContain('research note she prepared');
    for (const forbidden of [...CANONICAL_MARKERS, '"ev-8":false']) {
      expect(caseHtml.toLowerCase()).not.toContain(forbidden);
      expect(dialogueHtml.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe('save migration and progression integrity with expanded content', () => {
  it('appends missing evidence and merges new event flags from an older save', () => {
    const payload = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    payload.version = 2;
    payload.caseFile.evidence = payload.caseFile.evidence.filter((e: any) => !NEW_EVIDENCE_IDS.includes(e.id));
    delete payload.flags.clientPressureHandled;
    delete payload.flags.juniorCredited;
    payload.flags.caseAccepted = true;
    const loaded = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(payload) }));

    expect(loaded.caseFile.evidence.map((e) => e.id)).toContain('ev-7');
    expect(loaded.caseFile.evidence.map((e) => e.id)).toContain('ev-8');
    expect(loaded.caseFile.evidence.map((e) => e.id)).toContain('ev-9');
    for (const id of NEW_EVIDENCE_IDS) {
      const item = loaded.caseFile.evidence.find((e) => e.id === id)!;
      expect(item.discovered).toBe(false);
      expect(item.reviewed).toBe(false);
      expect(item.assessment.rationale).toBe('');
    }
    expect(loaded.flags.clientPressureHandled).toBe(false);
    expect(loaded.flags.juniorCredited).toBe(false);
    expect(loaded.flags.caseAccepted).toBe(true);
  });

  it('a saved resolved event stays resolved after load', () => {
    const payload = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    payload.version = 2;
    payload.clock = { day: 9, slot: 'morning' };
    payload.usedDialogueSceneIds = ['d-client-pressure', 'd-junior-credit'];
    const loaded = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(payload) }));

    expect(loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(loaded) })).usedDialogueSceneIds).toEqual([
      'd-client-pressure', 'd-junior-credit',
    ]);
    expect(availableDialogueScenes(loaded).map((s) => s.id)).not.toContain('d-junior-credit');
    expect(applyDialogueChoice(loaded, 'd-junior-credit', 'credit-note').ok).toBe(false);
  });

  it('does not change required evidence, assignment chain or clock when optional events resolve', () => {
    const save = createInitialSave();
    const assignmentIds = save.assignments.map((a) => a.id);
    expect(assignmentIds).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']);
    const required = save.assignments.flatMap((a) => a.requiredEvidenceIds);
    expect(required.every((id) => ['ev-1', 'ev-2', 'ev-3'].includes(id))).toBe(true);
    for (const assignment of save.assignments) {
      const flags = assignment.requiredFlags ?? [];
      expect(flags).not.toContain('clientPressureHandled');
      expect(flags).not.toContain('juniorCredited');
    }

    advanceToDay(save, 4);
    const day = save.clock.day;
    const statuses = save.assignments.map((a) => a.status);
    const objective = currentObjective(save)?.assignmentId;
    expect(applyDialogueChoice(save, 'd-client-pressure', 'provisional-view').ok).toBe(true);
    expect(save.clock.day).toBe(day);
    expect(save.assignments.map((a) => a.status)).toEqual(statuses);
    expect(currentObjective(save)?.assignmentId).toBe(objective);

    advanceToDay(save, MAX_DAY);
    expect(save.clock.day).toBe(MAX_DAY);
    const finalStatuses = save.assignments.map((a) => a.status);
    expect(applyDialogueChoice(save, 'd-junior-credit', 'credit-note').ok).toBe(true);
    expect(save.assignments.map((a) => a.status)).toEqual(finalStatuses);
  });
});
