import { describe, expect, it } from 'vitest';
import { createInitialSave } from '@/domain/seed';
import { LEGACY_KEY, loadSave, persistSave, resetSave, SAVE_KEY } from '@/storage/save';
import type { StorageLike } from '@/storage/save';
import type { SaveGame } from '@/domain/types';

const CANONICAL_MARKERS = [
  'canonicaltruth',
  'actualevents',
  'actualtimeline',
  'responsibleparties',
  'hiddenmotives',
  'evidenceauthenticity',
  'unresolvedambiguities',
  '18:12',
];

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
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

function throwingStorage(): StorageLike {
  return {
    getItem: () => {
      throw new Error('storage blocked');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {
      throw new Error('storage blocked');
    },
  };
}

describe('save privacy: canonical truth is never persisted', () => {
  it('omits all canonical-truth markers from the persisted payload', () => {
    const storage = memoryStorage();
    const save = createInitialSave();
    // The seed really does contain the hidden material, so the assertions below are meaningful.
    expect(JSON.stringify(save).toLowerCase()).toContain('18:12');

    expect(persistSave(save, storage).ok).toBe(true);

    const payload = storage.data[SAVE_KEY];
    expect(payload).toBeDefined();
    const serialized = payload.toLowerCase();
    for (const marker of CANONICAL_MARKERS) {
      expect(serialized).not.toContain(marker);
    }
    // Hidden authenticity values and motives must not survive in any form.
    expect(serialized).not.toContain('prior dispute');
    expect(serialized).not.toContain('exact first physical contact');
  });

  it('rehydrates seed canonical truth on load instead of trusting stored canonical data', () => {
    const payload = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    payload.caseFile.canonicalTruth = {
      actualEvents: ['TAMPERED EVENT'],
      responsibleParties: ['TAMPERED PARTY'],
      actualTimeline: ['99:99 TAMPERED'],
      evidenceAuthenticity: { 'ev-1': false },
      hiddenMotives: ['TAMPERED MOTIVE'],
      unresolvedAmbiguities: ['TAMPERED AMBIGUITY'],
    };

    const loaded = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(payload) }));

    expect(loaded.caseFile.canonicalTruth).toEqual(createInitialSave().caseFile.canonicalTruth);
    expect(JSON.stringify(loaded.caseFile.canonicalTruth)).not.toContain('TAMPERED');
    expect(loaded.caseFile.canonicalTruth.evidenceAuthenticity['ev-3']).toBe(false);
    expect(loaded.caseFile.canonicalTruth.actualTimeline).toContain('18:12 shove');
  });

  it('keeps the player-safe case file intact across a save/load round trip', () => {
    const save = createInitialSave();
    save.caseFile.playerKnowledge.push('Player learned a new fact.');
    save.caseFile.allegations.push('A new allegation.');
    save.caseFile.admissibleMaterial.push('A new item of admissible material.');
    save.caseFile.unresolvedAmbiguity.push('A new open question.');
    save.caseFile.evidence[0].discovered = true;
    save.caseFile.evidence[0].reviewed = true;

    const storage = memoryStorage();
    persistSave(save, storage);
    const loaded: SaveGame = loadSave(storage);

    expect(loaded.caseFile.playerKnowledge).toContain('Player learned a new fact.');
    expect(loaded.caseFile.allegations).toContain('A new allegation.');
    expect(loaded.caseFile.admissibleMaterial).toContain('A new item of admissible material.');
    expect(loaded.caseFile.unresolvedAmbiguity).toContain('A new open question.');
    expect(loaded.caseFile.evidence[0].discovered).toBe(true);
    expect(loaded.caseFile.evidence[0].reviewed).toBe(true);
    expect(loaded.caseFile.canonicalTruth).toEqual(createInitialSave().caseFile.canonicalTruth);
  });

  it('ignores canonical truth injected into an older payload as well', () => {
    const payload = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    payload.version = 1;
    payload.caseFile.canonicalTruth.hiddenMotives = ['INJECTED VIA LEGACY SAVE'];

    const loaded = loadSave(memoryStorage({ [LEGACY_KEY]: JSON.stringify(payload) }));
    expect(JSON.stringify(loaded.caseFile.canonicalTruth)).not.toContain('INJECTED VIA LEGACY SAVE');
  });
});

describe('persistence failure-safe behavior', () => {
  it('reports a failed write without throwing', () => {
    const save = createInitialSave();
    expect(() => persistSave(save, throwingStorage())).not.toThrow();
    const result = persistSave(save, throwingStorage());
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('does not fail a successful save when legacy-key cleanup throws', () => {
    const storage = memoryStorage();
    storage.removeItem = () => {
      throw new Error('cleanup blocked');
    };
    expect(persistSave(createInitialSave(), storage).ok).toBe(true);
    expect(storage.data[SAVE_KEY]).toBeDefined();
  });

  it('resets in memory even when storage rejects removal', () => {
    const storage = throwingStorage();
    expect(() => resetSave(storage)).not.toThrow();
    const fresh = resetSave(storage);
    expect(fresh.version).toBe(2);
    expect(fresh.player.name).toBe('Newcomer');
    expect(fresh.caseFile.canonicalTruth).toEqual(createInitialSave().caseFile.canonicalTruth);
  });

  it('returns success for a normal in-memory write', () => {
    const result = persistSave(createInitialSave(), memoryStorage());
    expect(result).toEqual({ ok: true });
  });
});
