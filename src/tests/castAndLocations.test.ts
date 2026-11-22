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

const NEW_CHARACTER_IDS = ['opposing', 'receptionist', 'junior', 'medical'] as const;
const NEW_SCENE_IDS = [
  'd-receptionist-diary',
  'd-opposing-disclosure',
  'd-receptionist-corridor',
  'd-opposing-gap',
  'd-junior-review',
  'd-medical-record',
] as const;
const JUNIOR_MEDICAL_SCENE_IDS = ['d-junior-review', 'd-medical-record'] as const;
/** The latest expansion (cast 10 → 12): a professional rival and a canteen supervisor. */
const LATEST_CHARACTER_IDS = ['rival', 'supervisor'] as const;
const LATEST_SCENE_IDS = [
  'd-rival-intro', 'd-rival-final', 'd-supervisor-roster', 'd-supervisor-recollection',
] as const;
const ALL_CAST_IDS = [
  'senior', 'peer', 'clerk', 'client', 'witness', 'specialist', 'opposing', 'receptionist',
  'junior', 'medical', 'rival', 'supervisor',
];
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

describe('expanded cast (12 persistent characters)', () => {
  it('defines twelve characters with identity, role, portrait, boundaries and goals', () => {
    const save = createInitialSave();
    expect(save.characters).toHaveLength(12);
    expect(save.characters.map((c) => c.id)).toEqual(ALL_CAST_IDS);
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
    const junior = save.characters.find((c) => c.id === 'junior')!;
    expect(junior.name).toBe('Priya Nair');
    expect(junior.role).toContain('Junior Advocate');
    expect(junior.knowledgeBoundaries.join(' ').toLowerCase()).toContain('disclosed');
    expect(junior.knowledgeBoundaries.join(' ').toLowerCase()).toContain('canonical truth');
    const medical = save.characters.find((c) => c.id === 'medical')!;
    expect(medical.name).toBe('Dr. Kavita Iyer');
    expect(medical.role).toContain('Medical Consultant');
    expect(medical.knowledgeBoundaries.join(' ').toLowerCase()).toContain('injury report');
    expect(medical.knowledgeBoundaries.join(' ').toLowerCase()).toContain('canonical truth');
  });

  it('gives every new character a multidimensional relationship with the player', () => {
    const save = createInitialSave();
    expect(save.relationships.filter((r) => r.fromId === 'player')).toHaveLength(12);
    for (const id of NEW_CHARACTER_IDS) {
      const rel = relationship(save, id);
      for (const dimension of ['trust', 'respect', 'loyalty', 'rivalry', 'resentment', 'affection', 'professionalDependence'] as const) {
        expect(typeof rel[dimension]).toBe('number');
      }
    }
    expect(relationship(save, 'opposing').rivalry).toBeGreaterThan(0);
    expect(relationship(save, 'receptionist').trust).toBeGreaterThan(0);
    expect(relationship(save, 'junior').professionalDependence).toBeGreaterThan(0);
    expect(relationship(save, 'medical').respect).toBeGreaterThan(0);
  });

  it('gives each new character at least one day-gated interaction across Days 1–10', () => {
    const save = createInitialSave();
    const newScenes = DIALOGUE_SCENES.filter((s) => (NEW_SCENE_IDS as readonly string[]).includes(s.id));
    expect(newScenes).toHaveLength(6);
    expect(newScenes.map((s) => s.minDay).sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 9]);
    for (const id of NEW_CHARACTER_IDS) {
      const scenes = newScenes.filter((s) => s.characterId === id);
      expect(scenes.length).toBeGreaterThanOrEqual(1);
      for (const scene of scenes) {
        expect(scene.once).toBe(true);
        expect(scene.choices.length).toBeGreaterThanOrEqual(2);
      }
    }

    // Day 1 is unchanged: the original opening conversation is the only one available.
    expect(availableDialogueScenes(save).map((s) => s.id)).toEqual(['d-senior-intro']);
    advanceToDay(save, 2);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-receptionist-diary');
    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-opposing-disclosure');
    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-junior-review');
    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-medical-record');
    advanceToDay(save, 3);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-opposing-disclosure');
    advanceToDay(save, 4);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-junior-review');
    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-medical-record');
    advanceToDay(save, 5);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-receptionist-corridor');
    advanceToDay(save, 6);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-medical-record');
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
  it('defines two locations with 4 viewpoints each', () => {
    expect(ALL_LOCATION_IDS).toEqual(['chamber', 'reception']);
    expect(LOCATIONS.chamber.label).toBe('Senior Chamber');
    expect(LOCATIONS.reception.label).toBe('Office Reception');
    expect(LOCATIONS.chamber.viewpointIds).toHaveLength(4);
    expect(LOCATIONS.reception.viewpointIds.length).toBeGreaterThanOrEqual(2);
    expect(LOCATIONS.reception.viewpointIds.length).toBeLessThanOrEqual(4);
    expect(ALL_VIEWPOINT_IDS).toHaveLength(8);
  });

  it('places the two new characters in reachable, static hotspots', () => {
    const deskHotspots = VIEWPOINTS.desk.hotspots;
    expect(deskHotspots.find((h) => h.id === 'colleague')?.action).toBe('dialogue:junior');
    const consultation = VIEWPOINTS['consultation-room'];
    expect(consultation.locationId).toBe('reception');
    expect(consultation.hotspots.map((h) => h.action)).toContain('dialogue:medical');
    expect(consultation.hotspots.map((h) => h.action)).toContain('dialogue:junior');
    // Reachable from two viewpoints and returns to the rest of the world.
    expect(VIEWPOINTS.corridor.hotspots.some((h) => h.action === 'view:consultation-room')).toBe(true);
    expect(VIEWPOINTS['waiting-area'].hotspots.some((h) => h.action === 'view:consultation-room')).toBe(true);
    expect(consultation.hotspots.some((h) => h.action === 'view:corridor')).toBe(true);
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
      'reception-desk', 'corridor', 'waiting-area', 'consultation-room',
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
    // Simulate a save predating both expansions; missing characters are appended in default order.
    const expansionIds = [...NEW_CHARACTER_IDS, ...LATEST_CHARACTER_IDS];
    payload.characters = payload.characters.filter((c: any) => !expansionIds.includes(c.id));
    payload.relationships = payload.relationships.filter((r: any) => !expansionIds.includes(r.toId));
    payload.characters.find((c: any) => c.id === 'senior').name = 'Mentor Renamed';
    delete payload.characters.find((c: any) => c.id === 'senior').goals;
    payload.relationships.find((r: any) => r.toId === 'senior').trust = 88;

    const loaded = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(payload) }));

    expect(loaded.characters.map((c) => c.id)).toEqual(ALL_CAST_IDS);
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
    expect(loaded.characters).toHaveLength(12);
    expect(loaded.relationships).toHaveLength(12);
    expect(loaded.flags.juniorConsulted).toBe(false);
    expect(loaded.flags.medicalConsulted).toBe(false);
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

  it('supports the two new characters’ dialogue after migrating an older save', () => {
    const payload = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    payload.version = 2;
    payload.characters = payload.characters.filter((c: any) => c.id !== 'junior' && c.id !== 'medical');
    payload.relationships = payload.relationships.filter((r: any) => r.toId !== 'junior' && r.toId !== 'medical');
    delete payload.flags.juniorConsulted;
    delete payload.flags.medicalConsulted;
    payload.clock = { day: 6, slot: 'morning' };
    const loaded = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(payload) }));

    expect(loaded.characters).toHaveLength(12);
    expect(loaded.flags.juniorConsulted).toBe(false);
    expect(applyDialogueChoice(loaded, 'd-junior-review', 'compare-sources').ok).toBe(true);
    expect(loaded.flags.juniorConsulted).toBe(true);
    expect(relationship(loaded, 'junior').trust).toBe(40);
    expect(applyDialogueChoice(loaded, 'd-medical-record', 'ask-clinic-limits').ok).toBe(true);
    expect(loaded.flags.medicalConsulted).toBe(true);
    expect(loaded.caseFile.playerKnowledge.at(-1)).toContain('clinician states');
  });
});

describe('new cast interactions (junior advocate and medical consultant)', () => {
  it('applies bounded relationship, memory, reputation and player-knowledge effects', () => {
    const save = createInitialSave();
    advanceToDay(save, 4);
    const junior = relationship(save, 'junior');
    const competenceBefore = save.player.reputation.competence;
    const knowledgeBefore = save.caseFile.playerKnowledge.length;

    const compare = applyDialogueChoice(save, 'd-junior-review', 'compare-sources');
    expect(compare.ok).toBe(true);
    expect(compare.characterId).toBe('junior');
    expect(compare.characterName).toBe('Priya Nair');
    expect(junior.trust).toBe(40);
    expect(junior.respect).toBe(34);
    expect(junior.professionalDependence).toBe(23);
    expect(save.player.reputation.competence).toBe(competenceBefore + 2);
    expect(save.flags.juniorConsulted).toBe(true);
    expect(save.caseFile.playerKnowledge).toHaveLength(knowledgeBefore + 1);
    expect(save.notebook[0].title).toBe('Priya Nair — fact stated');
    expect(save.memories[0].participants).toEqual(['player', 'junior']);
    expect(save.memories[0].summary).toContain('clinic record');
    expect(applyDialogueChoice(save, 'd-junior-review', 'compare-sources').ok).toBe(false); // once only

    advanceToDay(save, 6);
    const medical = relationship(save, 'medical');
    const reliabilityBefore = save.player.reputation.reliability;
    const consult = applyDialogueChoice(save, 'd-medical-record', 'ask-clinic-limits');
    expect(consult.ok).toBe(true);
    expect(consult.characterName).toBe('Dr. Kavita Iyer');
    expect(medical.trust).toBe(30);
    expect(medical.respect).toBe(41);
    expect(save.player.reputation.reliability).toBe(reliabilityBefore + 1);
    expect(save.flags.medicalConsulted).toBe(true);
    expect(consult.reputationEffects).toEqual([
      { dimension: 'competence', amount: 2 },
      { dimension: 'reliability', amount: 1 },
    ]);
    expect(save.notebook[0].title).toBe('Dr. Kavita Iyer — fact stated');
  });

  it('respects knowledge boundaries: refused questions reveal nothing and cost standing', () => {
    const save = createInitialSave();
    advanceToDay(save, 6);
    const before = [...save.caseFile.playerKnowledge];

    const junior = applyDialogueChoice(save, 'd-junior-review', 'ask-fault');
    expect(junior.ok).toBe(true);
    expect(junior.reveals).toBeUndefined();
    expect(junior.reply).toContain('will not guess');
    expect(relationship(save, 'junior').respect).toBe(25);
    expect(relationship(save, 'junior').resentment).toBe(3);
    expect(save.caseFile.playerKnowledge).toEqual(before);

    const medical = applyDialogueChoice(save, 'd-medical-record', 'ask-attribute-fault');
    expect(medical.ok).toBe(true);
    expect(medical.reveals).toBeUndefined();
    expect(medical.reply).toContain('does not answer that');
    expect(relationship(save, 'medical').resentment).toBe(4);
    expect(save.caseFile.playerKnowledge).toEqual(before);
    // Milestone flags are set only by the careful, boundary-respecting choices.
    expect(save.flags.juniorConsulted).toBe(false);
    expect(save.flags.medicalConsulted).toBe(false);
  });

  it('never leaks canonical truth or fabricated citations through the new content', () => {
    const save = createInitialSave();
    const scenes = DIALOGUE_SCENES.filter((s) => (JUNIOR_MEDICAL_SCENE_IDS as readonly string[]).includes(s.id));
    expect(scenes).toHaveLength(2);
    const authored = scenes.flatMap((scene) => [
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

    advanceToDay(save, 6);
    applyDialogueChoice(save, 'd-junior-review', 'compare-sources');
    applyDialogueChoice(save, 'd-medical-record', 'ask-clinic-limits');
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

describe('12-character cast: professional rival and canteen supervisor', () => {
  it('defines both new characters with distinct identity, boundaries and goals', () => {
    const save = createInitialSave();
    expect(save.characters.map((c) => c.id)).toEqual(ALL_CAST_IDS);

    const rival = save.characters.find((c) => c.id === 'rival')!;
    expect(rival.name).toBe('Adv. Nisha Deshmukh');
    expect(rival.role).toContain('Professional Rival');
    expect(['neutral', 'thinking', 'smiling', 'disappointed', 'angry', 'surprised']).toContain(rival.portrait);
    expect(rival.knowledgeBoundaries.join(' ').toLowerCase()).toContain('disclosed record');
    expect(rival.knowledgeBoundaries.join(' ').toLowerCase()).toContain('canonical truth');
    expect(rival.goals.length).toBeGreaterThan(0);

    const supervisor = save.characters.find((c) => c.id === 'supervisor')!;
    expect(supervisor.name).toBe('Iqbal Sheikh');
    expect(supervisor.role).toContain('Canteen Supervisor');
    expect(['neutral', 'thinking', 'smiling', 'disappointed', 'angry', 'surprised']).toContain(supervisor.portrait);
    expect(supervisor.knowledgeBoundaries.join(' ').toLowerCase()).toContain('duty roster');
    expect(supervisor.knowledgeBoundaries.join(' ').toLowerCase()).toContain('canonical truth');
    expect(supervisor.goals.length).toBeGreaterThan(0);

    for (const id of LATEST_CHARACTER_IDS) {
      const rel = relationship(save, id);
      for (const dimension of ['trust', 'respect', 'loyalty', 'rivalry', 'resentment', 'affection', 'professionalDependence'] as const) {
        expect(typeof rel[dimension]).toBe('number');
      }
    }
    expect(relationship(save, 'rival').rivalry).toBeGreaterThan(0);
    expect(relationship(save, 'supervisor').respect).toBeGreaterThan(0);
  });

  it('gives each new character day-gated interactions with relationship, memory, reputation and knowledge effects', () => {
    const save = createInitialSave();
    const scenes = DIALOGUE_SCENES.filter((s) => (LATEST_SCENE_IDS as readonly string[]).includes(s.id));
    expect(scenes).toHaveLength(4);
    expect(scenes.map((s) => s.minDay).sort((a, b) => a - b)).toEqual([3, 5, 7, 8]);
    for (const id of LATEST_CHARACTER_IDS) {
      const forCharacter = scenes.filter((s) => s.characterId === id);
      expect(forCharacter.length).toBeGreaterThanOrEqual(1);
      for (const scene of forCharacter) {
        expect(scene.once).toBe(true);
        expect(scene.choices.length).toBeGreaterThanOrEqual(2);
      }
    }

    // Day 1/2: neither new character's conversation is available yet.
    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-rival-intro');
    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-supervisor-roster');

    advanceToDay(save, 3);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-rival-intro');
    const rival = relationship(save, 'rival');
    const integrityBefore = save.player.reputation.integrity;
    const knowledgeBefore = save.caseFile.playerKnowledge.length;
    const intro = applyDialogueChoice(save, 'd-rival-intro', 'stick-to-record');
    expect(intro.ok).toBe(true);
    expect(intro.characterId).toBe('rival');
    expect(intro.characterName).toBe('Adv. Nisha Deshmukh');
    expect(rival.respect).toBe(40);
    expect(rival.trust).toBe(22);
    expect(rival.rivalry).toBe(47);
    expect(save.player.reputation.integrity).toBe(integrityBefore + 1);
    expect(save.flags.rivalMet).toBe(true);
    expect(save.caseFile.playerKnowledge).toHaveLength(knowledgeBefore + 1);
    expect(save.caseFile.playerKnowledge.at(-1)).toContain('disclosed record');
    expect(save.notebook[0].title).toBe('Adv. Nisha Deshmukh — fact stated');
    expect(save.memories[0].participants).toEqual(['player', 'rival']);
    expect(applyDialogueChoice(save, 'd-rival-intro', 'stick-to-record').ok).toBe(false); // once only

    advanceToDay(save, 5);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-supervisor-roster');
    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-supervisor-recollection');
    const supervisor = relationship(save, 'supervisor');
    const reliabilityBefore = save.player.reputation.reliability;
    const roster = applyDialogueChoice(save, 'd-supervisor-roster', 'ask-roster-limits');
    expect(roster.ok).toBe(true);
    expect(roster.characterId).toBe('supervisor');
    expect(roster.characterName).toBe('Iqbal Sheikh');
    expect(supervisor.trust).toBe(25);
    expect(supervisor.respect).toBe(34);
    expect(supervisor.professionalDependence).toBe(18);
    expect(save.player.reputation.reliability).toBe(reliabilityBefore + 2);
    expect(roster.reputationEffects).toEqual([{ dimension: 'reliability', amount: 2 }]);
    expect(save.flags.supervisorConsulted).toBe(true);
    expect(save.caseFile.playerKnowledge.at(-1)).toContain('duty roster records');
    expect(save.notebook[0].title).toBe('Iqbal Sheikh — fact stated');

    advanceToDay(save, 7);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-supervisor-recollection');
    expect(applyDialogueChoice(save, 'd-supervisor-recollection', 'ask-personal-observation').ok).toBe(true);
    expect(save.flags.supervisorStatement).toBe(true);
    expect(save.caseFile.playerKnowledge.at(-1)).toContain('cannot identify who acted first');

    advanceToDay(save, 8);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-rival-final');
    const competenceBefore = save.player.reputation.competence;
    const finalRival = applyDialogueChoice(save, 'd-rival-final', 'record-limits');
    expect(finalRival.ok).toBe(true);
    expect(rival.respect).toBe(45);
    expect(rival.rivalry).toBe(43);
    expect(save.player.reputation.competence).toBe(competenceBefore + 2);
    expect(save.flags.rivalRespect).toBe(true);
  });

  it('respects knowledge boundaries: outside knowledge reveals nothing and costs standing', () => {
    const save = createInitialSave();
    const before = [...save.caseFile.playerKnowledge];

    advanceToDay(save, 3);
    const hunch = applyDialogueChoice(save, 'd-rival-intro', 'share-hunch');
    expect(hunch.ok).toBe(true);
    expect(hunch.reveals).toBeUndefined();
    expect(hunch.reply).toContain('not treat an unverified hunch as a fact');
    expect(relationship(save, 'rival').rivalry).toBe(56);
    expect(relationship(save, 'rival').resentment).toBe(3);
    expect(save.player.reputation.integrity).toBe(8);
    expect(save.flags.rivalMet).toBe(false); // boundary-respecting choices only
    expect(save.caseFile.playerKnowledge).toEqual(before);

    advanceToDay(save, 5);
    const rosterGuess = applyDialogueChoice(save, 'd-supervisor-roster', 'ask-from-roster');
    expect(rosterGuess.ok).toBe(true);
    expect(rosterGuess.reveals).toBeUndefined();
    expect(rosterGuess.reply).toContain('A roster cannot answer that');
    expect(relationship(save, 'supervisor').resentment).toBe(4);
    expect(save.flags.supervisorConsulted).toBe(false);
    expect(save.caseFile.playerKnowledge).toEqual(before);

    advanceToDay(save, 7);
    const nameFirst = applyDialogueChoice(save, 'd-supervisor-recollection', 'name-first-mover');
    expect(nameFirst.ok).toBe(true);
    expect(nameFirst.reveals).toBeUndefined();
    expect(nameFirst.reply).toContain('will not name anyone');
    expect(relationship(save, 'supervisor').resentment).toBe(9);
    expect(save.flags.supervisorStatement).toBe(false);
    expect(save.caseFile.playerKnowledge).toEqual(before);

    advanceToDay(save, 8);
    const overstate = applyDialogueChoice(save, 'd-rival-final', 'overstate');
    expect(overstate.ok).toBe(true);
    expect(overstate.reveals).toBeUndefined();
    expect(relationship(save, 'rival').resentment).toBe(7);
    expect(save.flags.rivalRespect).toBe(false);
    expect(save.caseFile.playerKnowledge).toEqual(before);
  });

  it('never leaks canonical truth or fabricated citations through the new content', () => {
    const save = createInitialSave();
    const scenes = DIALOGUE_SCENES.filter((s) => (LATEST_SCENE_IDS as readonly string[]).includes(s.id));
    const authored = scenes.flatMap((scene) => [
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

    advanceToDay(save, 8);
    applyDialogueChoice(save, 'd-rival-intro', 'stick-to-record');
    applyDialogueChoice(save, 'd-supervisor-roster', 'ask-roster-limits');
    applyDialogueChoice(save, 'd-supervisor-recollection', 'ask-personal-observation');
    applyDialogueChoice(save, 'd-rival-final', 'record-limits');
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

  it('places both new characters in reachable, static hotspots', () => {
    expect(VIEWPOINTS.corridor.hotspots.find((h) => h.id === 'rival')?.action).toBe('dialogue:rival');
    expect(VIEWPOINTS['waiting-area'].hotspots.find((h) => h.id === 'rival')?.action).toBe('dialogue:rival');
    expect(VIEWPOINTS['waiting-area'].hotspots.find((h) => h.id === 'supervisor')?.action).toBe('dialogue:supervisor');
    expect(VIEWPOINTS['consultation-room'].hotspots.find((h) => h.id === 'supervisor')?.action).toBe('dialogue:supervisor');
    // No new viewpoint or asset is required; all placements reuse existing static scenes.
    expect(ALL_VIEWPOINT_IDS).toHaveLength(8);
  });

  it('appends the new cast, relationships and flags when loading an older save', () => {
    const payload = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    payload.version = 2;
    payload.characters = payload.characters.filter((c: any) => !LATEST_CHARACTER_IDS.includes(c.id));
    payload.relationships = payload.relationships.filter((r: any) => !LATEST_CHARACTER_IDS.includes(r.toId));
    for (const key of ['rivalMet', 'rivalRespect', 'supervisorConsulted', 'supervisorStatement']) delete payload.flags[key];
    payload.characters.find((c: any) => c.id === 'senior').name = 'Mentor Renamed';
    payload.relationships.find((r: any) => r.toId === 'senior').trust = 88;
    payload.clock = { day: 5, slot: 'morning' };

    const loaded = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(payload) }));

    expect(loaded.characters.map((c) => c.id)).toEqual(ALL_CAST_IDS);
    expect(loaded.relationships.filter((r) => r.fromId === 'player')).toHaveLength(12);
    expect(loaded.characters.find((c) => c.id === 'senior')!.name).toBe('Mentor Renamed');
    expect(loaded.relationships.find((r) => r.toId === 'senior')!.trust).toBe(88);
    for (const id of LATEST_CHARACTER_IDS) {
      expect(loaded.characters.find((c) => c.id === id)).toBeDefined();
      expect(loaded.relationships.find((r) => r.toId === id)).toBeDefined();
    }
    expect(loaded.flags.rivalMet).toBe(false);
    expect(loaded.flags.supervisorConsulted).toBe(false);

    // New conversations remain usable after the migration.
    expect(applyDialogueChoice(loaded, 'd-rival-intro', 'stick-to-record').ok).toBe(true);
    expect(relationship(loaded, 'rival').respect).toBe(40);
    expect(applyDialogueChoice(loaded, 'd-supervisor-roster', 'ask-roster-limits').ok).toBe(true);
    expect(loaded.flags.supervisorConsulted).toBe(true);
  });
});
