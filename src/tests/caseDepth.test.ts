import { describe, expect, it } from 'vitest';
import { createInitialSave, DIALOGUE_SCENES } from '@/domain/seed';
import { assertNoCanonicalTruthLeak, toPlayerCaseView } from '@/domain/caseAccess';
import { advanceClock } from '@/domain/progression';
import { applyDialogueChoice, availableDialogueScenes } from '@/domain/dialogue';
import { discoverEvidenceItem, reviewEvidence } from '@/domain/evidence';
import { CHALLENGE_GROUNDS, GROUND_FEEDBACK } from '@/domain/casework';
import { addTheoryClaim, groupTheoryClaims, THEORY_STATUSES } from '@/domain/theory';
import { checkDraftCitations } from '@/domain/guards';
import { looksLikeSpecificCitation } from '@/domain/legalSources';
import { loadSave, SAVE_KEY } from '@/storage/save';
import type { StorageLike } from '@/storage/save';
import type { SaveGame } from '@/domain/types';

function advanceToDay(save: SaveGame, day: number): void {
  while (save.clock.day < day) advanceClock(save);
}

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = { ...initial };
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

const CANONICAL_MARKERS = [
  'canonicaltruth', 'actualevents', 'actualtimeline', 'responsibleparties',
  'hiddenmotives', 'evidenceauthenticity', 'prior dispute',
  '18:05', '18:10', '18:12', '18:15', '18:20',
];

describe('richer First Brief case content', () => {
  it('expands the cast and evidence set while keeping canonical truth stable', () => {
    const save = createInitialSave();
    expect(save.characters.map((c) => c.id)).toEqual([
      'senior', 'peer', 'clerk', 'client', 'witness', 'specialist',
    ]);
    expect(save.caseFile.evidence.map((e) => e.id)).toEqual([
      'ev-1', 'ev-2', 'ev-3', 'ev-4', 'ev-5', 'ev-6',
    ]);
    // Original canonical facts remain unchanged; new detail is appended, never rewritten.
    expect(save.caseFile.canonicalTruth.actualEvents.slice(0, 3)).toEqual([
      'A shove occurred after an argument.',
      'A phone recording is incomplete and may be misleading.',
      'Medical report confirms minor injury but timing is disputed.',
    ]);
    expect(save.caseFile.canonicalTruth.actualTimeline).toContain('18:12 shove');
    expect(save.caseFile.canonicalTruth.hiddenMotives).toContain('Witness had prior dispute with complainant');
    for (const item of save.caseFile.evidence) {
      expect(item.id in save.caseFile.canonicalTruth.evidenceAuthenticity).toBe(true);
    }
    // Every new character declares knowledge boundaries.
    for (const character of save.characters) {
      expect(character.knowledgeBoundaries.length).toBeGreaterThan(0);
    }
  });

  it('keeps all new evidence hidden until discovered and never reveals canonical markers', () => {
    const save = createInitialSave();
    let view = toPlayerCaseView(save.caseFile);
    expect(view.evidence.slice(3).every((e) => e.description === 'Not yet discovered.')).toBe(true);

    for (const id of ['ev-4', 'ev-5', 'ev-6']) {
      expect(discoverEvidenceItem(save, id)).not.toBeNull();
      expect(reviewEvidence(save, id)).toBe(true);
    }
    view = toPlayerCaseView(save.caseFile);
    expect(view.evidence.slice(3).every((e) => e.reviewed && e.assessment !== null)).toBe(true);

    const playerFacing = JSON.stringify({
      view, notebook: save.notebook, memories: save.memories,
    }).toLowerCase();
    expect(() => assertNoCanonicalTruthLeak(playerFacing)).not.toThrow();
    for (const marker of CANONICAL_MARKERS) expect(playerFacing).not.toContain(marker);
  });

  it('documents every challenge ground for the casework guidance', () => {
    expect(CHALLENGE_GROUNDS).toEqual(['relevance', 'reliability', 'custody', 'provenance']);
    for (const ground of CHALLENGE_GROUNDS) {
      expect(GROUND_FEEDBACK[ground].length).toBeGreaterThan(20);
    }
  });

  it('does not change the required-evidence progression chain when bonus evidence is added', () => {
    const save = createInitialSave();
    expect(save.assignments.map((a) => a.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']);
    for (const assignment of save.assignments) {
      for (const id of assignment.requiredEvidenceIds) {
        expect(['ev-1', 'ev-2', 'ev-3']).toContain(id);
      }
    }
  });
});

describe('character and event depth across Days 1–10', () => {
  it('adds at least two distinct, day-gated character interactions', () => {
    const save = createInitialSave();
    const newScenes = DIALOGUE_SCENES.filter((s) =>
      ['d-witness-statement', 'd-specialist-metadata', 'd-peer-integrity'].includes(s.id));
    expect(newScenes.length).toBeGreaterThanOrEqual(2);
    expect(newScenes.map((s) => s.id)).toEqual([
      'd-witness-statement', 'd-specialist-metadata', 'd-peer-integrity',
    ]);
    expect(newScenes.map((s) => s.minDay)).toEqual([6, 7, 8]);
    // Not available on day 1.
    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-witness-statement');
  });

  it('witness interview changes relationships, reputation, memory and player knowledge only', () => {
    const save = createInitialSave();
    advanceToDay(save, 6);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-witness-statement');

    const witness = save.relationships.find((r) => r.toId === 'witness')!;
    const reliabilityBefore = save.player.reputation.reliability;
    const knowledgeBefore = save.caseFile.playerKnowledge.length;
    const result = applyDialogueChoice(save, 'd-witness-statement', 'ask-personal-view');

    expect(result.ok).toBe(true);
    expect(result.characterId).toBe('witness');
    expect(witness.trust).toBe(26);
    expect(witness.respect).toBe(29);
    expect(reliabilityBefore).toBe(10);
    expect(save.player.reputation.reliability).toBe(reliabilityBefore + 2);
    expect(result.reputationEffects).toEqual([{ dimension: 'reliability', amount: 2 }]);
    expect(save.flags.witnessInterviewed).toBe(true);
    expect(save.caseFile.playerKnowledge.length).toBe(knowledgeBefore + 2);
    expect(save.memories[0].summary).toContain('eyewitness');
    expect(save.notebook.some((n) => n.title === 'The Eyewitness — fact stated')).toBe(true);
  });

  it('refuses to let the witness or specialist overstate what they know', () => {
    const save = createInitialSave();
    advanceToDay(save, 6);
    const knowledgeBefore = save.caseFile.playerKnowledge.length;
    const witness = save.relationships.find((r) => r.toId === 'witness')!;
    const pushed = applyDialogueChoice(save, 'd-witness-statement', 'push-for-certainty');
    expect(pushed.ok).toBe(true);
    expect(pushed.reveals).toBeUndefined();
    expect(witness.resentment).toBe(5);
    expect(save.player.reputation.integrity).toBe(9);
    expect(save.caseFile.playerKnowledge.length).toBe(knowledgeBefore);

    advanceToDay(save, 7);
    const specialist = save.relationships.find((r) => r.toId === 'specialist')!;
    const honest = applyDialogueChoice(save, 'd-specialist-metadata', 'ask-limits');
    expect(honest.ok).toBe(true);
    expect(honest.reputationEffects).toEqual([{ dimension: 'competence', amount: 2 }]);
    expect(save.player.reputation.competence).toBe(12);
    expect(honest.reveals?.[0]).toContain('cannot, on its own, prove');
    expect(save.flags.specialistConsulted).toBe(true);
    expect(specialist.respect).toBe(46);
  });

  it('turns a peer integrity moment into a deterministic reputation and relationship outcome', () => {
    const honest = createInitialSave();
    advanceToDay(honest, 8);
    const peerHonest = honest.relationships.find((r) => r.toId === 'peer')!;
    const flagged = applyDialogueChoice(honest, 'd-peer-integrity', 'flag-gap');
    expect(flagged.ok).toBe(true);
    expect(honest.player.reputation.integrity).toBe(12);
    expect(peerHonest.respect).toBe(40);
    expect(honest.flags.peerIntegrityChoice).toBe(true);

    const shortcut = createInitialSave();
    advanceToDay(shortcut, 8);
    const peerShortcut = shortcut.relationships.find((r) => r.toId === 'peer')!;
    const agreed = applyDialogueChoice(shortcut, 'd-peer-integrity', 'use-as-complete');
    expect(agreed.ok).toBe(true);
    expect(shortcut.player.reputation.integrity).toBe(8);
    expect(peerShortcut.rivalry).toBe(14);
    expect(shortcut.flags.peerIntegrityChoice).toBe(false);
  });

  it('keeps all authored dialogue content free of citations and canonical truth markers', () => {
    const save = createInitialSave();
    const newScenes = DIALOGUE_SCENES.filter((s) =>
      ['d-witness-statement', 'd-specialist-metadata', 'd-peer-integrity'].includes(s.id));
    const authored = newScenes.flatMap((scene) =>
      scene.choices.flatMap((choice) => [
        scene.prompt, choice.label, choice.reply, choice.memory, ...(choice.reveals ?? []),
      ]));
    for (const text of authored) {
      expect(looksLikeSpecificCitation(text)).toBe(false);
      expect(checkDraftCitations(text, save.legalSources).blocked).toEqual([]);
    }
    const asJson = JSON.stringify(authored).toLowerCase();
    for (const marker of CANONICAL_MARKERS) expect(asJson).not.toContain(marker);
    expect(() => assertNoCanonicalTruthLeak(authored)).not.toThrow();
  });
});

describe('evidence-linked case theory organisation', () => {
  it('validates claims, links only reviewed evidence and refuses fault conclusions', () => {
    const save = createInitialSave();
    expect(addTheoryClaim(save, '', 'known', []).ok).toBe(false);
    expect(addTheoryClaim(save, 'A claim', 'speculative' as never, []).ok).toBe(false);
    expect(addTheoryClaim(save, 'The report is inconclusive.', 'known', ['ev-1']).ok).toBe(false);
    expect(addTheoryClaim(save, 'The accused is guilty.', 'known', []).ok).toBe(false);
    expect(save.caseTheory.claims).toHaveLength(0);

    discoverEvidenceItem(save, 'ev-1');
    reviewEvidence(save, 'ev-1');
    expect(addTheoryClaim(save, 'The report records a minor injury.', 'known', ['ev-1']).ok).toBe(true);
    expect(save.caseTheory.claims).toHaveLength(1);
  });

  it('records a claim in the case theory, notebook and memory without touching canonical truth', () => {
    const save = createInitialSave();
    discoverEvidenceItem(save, 'ev-1');
    reviewEvidence(save, 'ev-1');
    const result = addTheoryClaim(save, 'Injury noted; timing is disputed.', 'disputed', ['ev-1']);

    expect(result.ok).toBe(true);
    expect(result.claim?.status).toBe('disputed');
    expect(result.claim?.evidenceIds).toEqual(['ev-1']);
    expect(result.notebookEntry?.kind).toBe('theory');
    expect(save.notebook.some((n) => n.kind === 'theory')).toBe(true);
    expect(save.memories[0].summary).toContain('case-theory claim');

    const grouped = groupTheoryClaims(save);
    expect(THEORY_STATUSES.every((s) => Array.isArray(grouped[s]))).toBe(true);
    expect(grouped.disputed).toHaveLength(1);
    expect(grouped.known).toHaveLength(0);

    const playerFacing = JSON.stringify({
      claims: save.caseTheory.claims, notebook: save.notebook, memories: save.memories,
    }).toLowerCase();
    expect(() => assertNoCanonicalTruthLeak(playerFacing)).not.toThrow();
    for (const marker of CANONICAL_MARKERS) expect(playerFacing).not.toContain(marker);
  });
});

describe('save migration compatibility with expanded content', () => {
  it('appends newly added evidence and defaults case theory for older saves', () => {
    const payload = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    payload.version = 2;
    payload.caseFile.evidence = payload.caseFile.evidence.filter((e: any) => e.id !== 'ev-4' && e.id !== 'ev-5' && e.id !== 'ev-6');
    delete payload.caseTheory;
    const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify(payload) });

    const loaded = loadSave(storage);
    expect(loaded.caseFile.evidence.map((e: { id: string }) => e.id)).toEqual([
      'ev-1', 'ev-2', 'ev-3', 'ev-4', 'ev-5', 'ev-6',
    ]);
    for (const id of ['ev-4', 'ev-5', 'ev-6']) {
      const item = loaded.caseFile.evidence.find((e: { id: string }) => e.id === id)!;
      expect(item.discovered).toBe(false);
      expect(item.reviewed).toBe(false);
    }
    expect(loaded.caseTheory).toEqual({ claims: [] });
    // Existing progress and assignments survive unchanged.
    expect(loaded.assignments.map((a: { id: string }) => a.id)).toEqual([
      'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8',
    ]);
  });

  it('drops malformed theory claims from an untrusted save', () => {
    const payload = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    payload.caseTheory = {
      claims: [
        { id: 'ok', day: 1, text: 'A note', status: 'known', evidenceIds: [] },
        { id: 'bad', day: 1, text: 'Bad status', status: 'fabricated', evidenceIds: [] },
      ],
    };
    const loaded = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(payload) }));
    expect(loaded.caseTheory.claims).toHaveLength(1);
    expect(loaded.caseTheory.claims[0].id).toBe('ok');
  });
});
