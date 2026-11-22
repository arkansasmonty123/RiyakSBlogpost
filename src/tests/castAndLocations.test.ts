import { describe, expect, it } from 'vitest';
import { createInitialSave, DIALOGUE_SCENES } from '@/domain/seed';
import { assertNoCanonicalTruthLeak } from '@/domain/caseAccess';
import { advanceClock } from '@/domain/progression';
import { applyDialogueChoice, availableDialogueScenes } from '@/domain/dialogue';
import { checkDraftCitations } from '@/domain/guards';
import { looksLikeSpecificCitation } from '@/domain/legalSources';
import {
  ALL_LOCATION_IDS,
  ALL_VIEWPOINT_IDS,
  describeHotspotAction,
  getLocationForViewpoint,
  getViewpoint,
  isValidViewpoint,
  LOCATIONS,
  VIEWPOINTS,
  viewpointsForLocation,
} from '@/domain/scenes';
import { loadSave, SAVE_KEY } from '@/storage/save';
import type { StorageLike } from '@/storage/save';
import type { SaveGame } from '@/domain/types';

const NEW_CHARACTER_IDS = ['opposing', 'receptionist'] as const;
const NEW_SCENE_IDS = [
  'd-receptionist-diary',
  'd-opposing-disclosure',
  'd-receptionist-corridor',
  'd-opposing-gap',
] as const;
const CANONICAL_MARKERS = [
  'canonicaltruth', 'actualevents', 'actualtimeline', 'responsibleparties',
  'hiddenmotives', 'evidenceauthenticity', 'prior dispute',
  '18:05', '18:10', '18:12', '18:15', '18:20',
];

function advanceToDay(save: SaveGame, day: number): void {
  while (save.clock.day < day) advanceClock(save);
}

function relationship(save: SaveGame, id: string) {
  const found = save.relationships.find((r) => r.fromId === 'player' && r.toId === id);
  if (!found) throw new Error(`Missing relationship for ${id}`);
  return found;
}

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = { ...initial };
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

describe('expanded cast (8 persistent characters)', () => {
  it('defines eight characters with identity, role, portrait, boundaries and goals', () => {
    const save = createInitialSave();
    expect(save.characters).toHaveLength(8);
    expect(save.characters.map((c) => c.id)).toEqual([
      'senior', 'peer', 'clerk', 'client', 'witness', 'specialist', 'opposing', 'receptionist',
    ]);
    for (const character of save.characters) {
      expect(character.name.length).toBeGreaterThan(0);
      expect(character.role.length).toBeGreaterThan(0);
      expect(['neutral', 'thinking', 'smiling', 'disappointed', 'angry', 'surprised']).toContain(character.portrait);
      expect(character.knowledgeBoundaries.length).toBeGreaterThan(0);
      expect(character.goals.length).toBeGreaterThan(0);
    }
    const opposing = save.characters.find((c) => c.id === 'opposing')!;
    expect(opposing.name).toBe('Adv. Vikram Rathore');
    expect(opposing.role).toBe('Opposing Counsel');
    expect(opposing.knowledgeBoundaries.join(' ').toLowerCase()).toContain('disclosed');
    const receptionist = save.characters.find((c) => c.id === 'receptionist')!;
    expect(receptionist.name).toBe('Deepa');
    expect(receptionist.role).toContain('Receptionist');
    expect(receptionist.knowledgeBoundaries.join(' ').toLowerCase()).toContain('private meetings');
  });

  it('gives every new character a multidimensional relationship with the player', () => {
    const save = createInitialSave();
    expect(save.relationships.filter((r) => r.fromId === 'player')).toHaveLength(8);
    for (const id of NEW_CHARACTER_IDS) {
      const rel = relationship(save, id);
      for (const dimension of ['trust', 'respect', 'loyalty', 'rivalry', 'resentment', 'affection', 'professionalDependence'] as const) {
        expect(typeof rel[dimension]).toBe('number');
      }
    }
    expect(relationship(save, 'opposing').rivalry).toBeGreaterThan(0);
    expect(relationship(save, 'receptionist').trust).toBeGreaterThan(0);
  });

  it('gives each new character at least one day-gated interaction across Days 1–10', () => {
    const save = createInitialSave();
    const newScenes = DIALOGUE_SCENES.filter((s) => (NEW_SCENE_IDS as readonly string[]).includes(s.id));
    expect(newScenes).toHaveLength(4);
    expect(newScenes.map((s) => s.minDay)).toEqual([2, 3, 5, 9]);
    for (const id of NEW_CHARACTER_IDS) {
      const scenes = newScenes.filter((s) => s.characterId === id);
      expect(scenes.length).toBeGreaterThanOrEqual(1);
      for (const scene of scenes) expect(scene.choices.length).toBeGreaterThanOrEqual(2);
    }

    // Day 1 is unchanged: the original opening conversation is the only one available.
    expect(availableDialogueScenes(save).map((s) => s.id)).toEqual(['d-senior-intro']);
    advanceToDay(save, 2);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-receptionist-diary');
    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-opposing-disclosure');
    advanceToDay(save, 3);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-opposing-disclosure');
    advanceToDay(save, 5);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-receptionist-corridor');
    advanceToDay(save, 9);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-opposing-gap');
  });
});

describe('new character interaction consequences', () => {
  it('applies bounded relationship, memory, reputation and player-knowledge effects', () => {
    const save = createInitialSave();
    advanceToDay(save, 2);
    const rec = relationship(save, 'receptionist');
    const reliabilityBefore = save.player.reputation.reliability;
    const knowledgeBefore = save.caseFile.playerKnowledge.length;

    const diary = applyDialogueChoice(save, 'd-receptionist-diary', 'ask-diary-dates');
    expect(diary.ok).toBe(true);
    expect(diary.characterId).toBe('receptionist');
    expect(rec.trust).toBe(35);
    expect(rec.respect).toBe(28);
    expect(save.player.reputation.reliability).toBe(reliabilityBefore + 1);
    expect(diary.reputationEffects).toEqual([{ dimension: 'reliability', amount: 1 }]);
    expect(save.caseFile.playerKnowledge).toHaveLength(knowledgeBefore + 1);
    expect(save.memories[0].participants).toEqual(['player', 'receptionist']);
    expect(save.notebook[0].title).toBe('Deepa — fact stated');
    expect(applyDialogueChoice(save, 'd-receptionist-diary', 'ask-diary-dates').ok).toBe(false);

    advanceToDay(save, 3);
    const opp = relationship(save, 'opposing');
    const integrityBefore = save.player.reputation.integrity;
    const disclosure = applyDialogueChoice(save, 'd-opposing-disclosure', 'stick-to-disclosed');
    expect(disclosure.ok).toBe(true);
    expect(opp.respect).toBe(36);
    expect(opp.rivalry).toBe(42);
    expect(save.player.reputation.integrity).toBe(integrityBefore + 2);
    expect(save.caseFile.playerKnowledge.at(-1)).toContain('Opposing counsel states');

    advanceToDay(save, 9);
    const competenceBefore = save.player.reputation.competence;
    expect(applyDialogueChoice(save, 'd-opposing-gap', 'note-gap').ok).toBe(true);
    expect(save.player.reputation.competence).toBe(competenceBefore + 2);
  });

  it('respects knowledge boundaries: refused questions reveal nothing and cost standing', () => {
    const save = createInitialSave();
    advanceToDay(save, 2);
    const knowledgeBefore = [...save.caseFile.playerKnowledge];
    const rec = relationship(save, 'receptionist');
    const privateQuestion = applyDialogueChoice(save, 'd-receptionist-diary', 'ask-private-meeting');
    expect(privateQuestion.ok).toBe(true);
    expect(privateQuestion.reveals).toBeUndefined();
    expect(privateQuestion.reply).toContain('not in the room');
    expect(rec.trust).toBe(26);
    expect(rec.resentment).toBe(3);
    expect(save.caseFile.playerKnowledge).toEqual(knowledgeBefore);

    advanceToDay(save, 3);
    const opp = relationship(save, 'opposing');
    const privilegedQuestion = applyDialogueChoice(save, 'd-opposing-disclosure', 'ask-client-confidence');
    expect(privilegedQuestion.ok).toBe(true);
    expect(privilegedQuestion.reveals).toBeUndefined();
    expect(privilegedQuestion.reply).toContain('cannot discuss privileged instructions');
    expect(opp.resentment).toBe(4);
    expect(opp.rivalry).toBe(49);
    expect(save.caseFile.playerKnowledge).toEqual(knowledgeBefore);

    advanceToDay(save, 5);
    const corridor = applyDialogueChoice(save, 'd-receptionist-corridor', 'share-private-reason');
    expect(corridor.ok).toBe(true);
    expect(corridor.reveals).toBeUndefined();
    expect(corridor.reply).toContain('I only need the time and the room');
    expect(save.caseFile.playerKnowledge).toEqual(knowledgeBefore);

    advanceToDay(save, 9);
    const overstate = applyDialogueChoice(save, 'd-opposing-gap', 'overstate-clip');
    expect(overstate.ok).toBe(true);
    expect(overstate.reveals).toBeUndefined();
    expect(save.caseFile.playerKnowledge).toEqual(knowledgeBefore);
  });

  it('never leaks canonical truth or fabricated citations through the new content', () => {
    const save = createInitialSave();
    const newScenes = DIALOGUE_SCENES.filter((s) => (NEW_SCENE_IDS as readonly string[]).includes(s.id));
    const authored = newScenes.flatMap((scene) => [
      scene.prompt,
      ...scene.choices.flatMap((choice) => [
        choice.label, choice.reply, choice.memory, ...(choice.reveals ?? []),
      ]),
    ]);
    for (const text of authored) {
      expect(looksLikeSpecificCitation(text)).toBe(false);
      expect(checkDraftCitations(text, save.legalSources).blocked).toEqual([]);
    }
    const authoredJson = JSON.stringify(authored).toLowerCase();
    for (const marker of CANONICAL_MARKERS) expect(authoredJson).not.toContain(marker);
    expect(() => assertNoCanonicalTruthLeak(authored)).not.toThrow();

    // Applying every positive choice must not put canonical markers into player-facing state.
    advanceToDay(save, 9);
    applyDialogueChoice(save, 'd-receptionist-diary', 'ask-diary-dates');
    applyDialogueChoice(save, 'd-opposing-disclosure', 'stick-to-disclosed');
    applyDialogueChoice(save, 'd-receptionist-corridor', 'confirm-booking');
    applyDialogueChoice(save, 'd-opposing-gap', 'note-gap');
    const playerFacing = {
      knowledge: save.caseFile.playerKnowledge,
      notebook: save.notebook,
      memories: save.memories,
    };
    expect(() => assertNoCanonicalTruthLeak(playerFacing)).not.toThrow();
    for (const marker of CANONICAL_MARKERS) {
      expect(JSON.stringify(playerFacing).toLowerCase()).not.toContain(marker);
    }
  });
});

describe('second location and viewpoint navigation data', () => {
  it('defines two locations with 4 and 3 viewpoints', () => {
    expect(ALL_LOCATION_IDS).toEqual(['chamber', 'reception']);
    expect(LOCATIONS.chamber.label).toBe('Senior Chamber');
    expect(LOCATIONS.reception.label).toBe('Office Reception');
    expect(LOCATIONS.chamber.viewpointIds).toHaveLength(4);
    expect(LOCATIONS.reception.viewpointIds.length).toBeGreaterThanOrEqual(2);
    expect(LOCATIONS.reception.viewpointIds.length).toBeLessThanOrEqual(4);
    expect(ALL_VIEWPOINT_IDS).toHaveLength(7);
  });

  it('gives every viewpoint a valid location and resolvable hotspot targets', () => {
    const characters = createInitialSave().characters;
    for (const [id, viewpoint] of Object.entries(VIEWPOINTS)) {
      expect(LOCATIONS[viewpoint.locationId]).toBeDefined();
      expect(LOCATIONS[viewpoint.locationId].viewpointIds).toContain(id);
      expect(viewpoint.hotspots.length).toBeGreaterThanOrEqual(2);
      for (const hotspot of viewpoint.hotspots) {
        const [kind, value] = hotspot.action.split(':');
        expect(['view', 'panel', 'time', 'dialogue']).toContain(kind);
        if (kind === 'view') expect(isValidViewpoint(value)).toBe(true);
        if (kind === 'dialogue') expect(characters.some((c) => c.id === value)).toBe(true);
        if (kind === 'time') expect(value).toBe('advance');
        expect(describeHotspotAction(hotspot.action).length).toBeGreaterThan(0);
      }
    }
  });

  it('navigates between the chamber and the reception and falls back safely', () => {
    const save = createInitialSave();
    expect(getViewpoint(save.selectedViewpoint).locationId).toBe('chamber');

    const toReception = VIEWPOINTS.entrance.hotspots.find((h) => h.id === 'reception')!;
    expect(toReception.action).toBe('view:reception-desk');
    expect(getLocationForViewpoint(toReception.action.split(':')[1]).id).toBe('reception');
    expect(viewpointsForLocation('reception').map((v) => v.id)).toEqual([
      'reception-desk', 'corridor', 'waiting-area',
    ]);
    expect(viewpointsForLocation('chamber').map((v) => v.id)).toEqual([
      'entrance', 'desk', 'bookshelf', 'window',
    ]);

    const back = VIEWPOINTS['waiting-area'].hotspots.find((h) => h.id === 'back')!;
    expect(getLocationForViewpoint(back.action.split(':')[1]).id).toBe('chamber');

    expect(getViewpoint('no-such-viewpoint').id).toBe('entrance');
    expect(getLocationForViewpoint('no-such-viewpoint').id).toBe('chamber');
    expect(viewpointsForLocation('no-such-location')).toEqual([]);
    expect(isValidViewpoint('no-such-viewpoint')).toBe(false);
    expect(isValidViewpoint('corridor')).toBe(true);
  });
});

describe('save migration compatibility with the expanded cast and locations', () => {
  it('appends new characters and relationships to an older save without losing stored values', () => {
    const payload = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    payload.version = 2;
    payload.characters = payload.characters.filter((c: any) => !NEW_CHARACTER_IDS.includes(c.id));
    payload.relationships = payload.relationships.filter((r: any) => !NEW_CHARACTER_IDS.includes(r.toId));
    payload.characters.find((c: any) => c.id === 'senior').name = 'Mentor Renamed';
    delete payload.characters.find((c: any) => c.id === 'senior').goals;
    payload.relationships.find((r: any) => r.toId === 'senior').trust = 88;

    const loaded = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(payload) }));

    expect(loaded.characters.map((c) => c.id)).toEqual([
      'senior', 'peer', 'clerk', 'client', 'witness', 'specialist', 'opposing', 'receptionist',
    ]);
    expect(loaded.characters.find((c) => c.id === 'senior')!.name).toBe('Mentor Renamed');
    // Missing fields on stored characters are backfilled from the new defaults.
    expect(loaded.characters.find((c) => c.id === 'senior')!.goals.length).toBeGreaterThan(0);
    expect(loaded.relationships.find((r) => r.toId === 'senior')!.trust).toBe(88);
    for (const id of NEW_CHARACTER_IDS) {
      expect(loaded.characters.find((c) => c.id === id)).toBeDefined();
      expect(loaded.relationships.find((r) => r.toId === id)).toBeDefined();
    }
  });

  it('falls back to the default cast and sanitizes unknown viewpoint ids', () => {
    const payload = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    payload.version = 1;
    delete payload.characters;
    delete payload.relationships;
    payload.selectedViewpoint = 'removed-old-viewpoint';

    const loaded = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(payload) }));

    expect(loaded.version).toBe(2);
    expect(loaded.characters).toHaveLength(8);
    expect(loaded.relationships).toHaveLength(8);
    expect(loaded.selectedViewpoint).toBe('entrance');
    expect(getViewpoint(loaded.selectedViewpoint).locationId).toBe('chamber');
  });

  it('supports applying new dialogue after migrating an old save', () => {
    const payload = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    payload.version = 2;
    payload.characters = payload.characters.filter((c: any) => c.id !== 'receptionist');
    payload.relationships = payload.relationships.filter((r: any) => r.toId !== 'receptionist');
    payload.clock = { day: 2, slot: 'morning' };
    const loaded = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(payload) }));

    const result = applyDialogueChoice(loaded, 'd-receptionist-diary', 'ask-diary-dates');
    expect(result.ok).toBe(true);
    expect(relationship(loaded, 'receptionist').trust).toBe(35);
  });
});
