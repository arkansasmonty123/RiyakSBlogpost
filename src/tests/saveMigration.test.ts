import { describe, expect, it } from 'vitest';
import { createInitialSave } from '@/domain/seed';
import { LEGACY_KEY, loadSave, persistSave, resetSave, SAVE_KEY } from '@/storage/save';
import type { StorageLike } from '@/storage/save';
import type { SaveGame } from '@/domain/types';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

/** Simulate a real v1 payload: old version, no draft/used-scenes, no review fields. */
function makeV1Payload(): Record<string, any> {
  const v1 = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
  v1.version = 1;
  delete v1.draft;
  delete v1.usedDialogueSceneIds;
  for (const item of v1.caseFile.evidence) {
    delete item.reviewed;
    delete item.assessment;
  }
  for (const assignment of v1.assignments) delete assignment.unlockAfter;
  return v1;
}

describe('save/load migration', () => {
  it('merges an old v1 save with v2 defaults without losing player state', () => {
    const v1 = makeV1Payload();
    v1.player.reputation.competence = 77;
    v1.clock = { day: 4, slot: 'afternoon' };
    v1.flags = { ...(v1.flags as object), caseAccepted: true, customFlag: true };
    const storage = memoryStorage({ [LEGACY_KEY]: JSON.stringify(v1) });

    const loaded = loadSave(storage);

    expect(loaded.version).toBe(2);
    expect(loaded.player.reputation.competence).toBe(77);
    expect(loaded.clock).toEqual({ day: 4, slot: 'afternoon' });
    expect(loaded.flags.caseAccepted).toBe(true);
    expect(loaded.flags.customFlag).toBe(true);
    expect(loaded.flags.introSeen).toBe(false); // merged default
    expect(loaded.draft.current).toContain('Issue:');
    expect(loaded.draft.versions).toEqual([]);
    expect(loaded.usedDialogueSceneIds).toEqual([]);
    expect(loaded.caseFile.evidence.every((e) => e.reviewed === false)).toBe(true);
    expect(loaded.caseFile.evidence.every((e) => e.assessment.admissibility === 'unknown' && e.assessment.rationale === '')).toBe(true);
    // New progression data is restored from defaults and not silently dropped.
    expect(loaded.assignments.find((a) => a.id === 'a2')?.unlockAfter).toBe('a1');
    expect(loaded.assignments.find((a) => a.id === 'a2')?.status).toBe('locked');
    // Canonical truth still present in the domain save (never rendered directly).
    expect(loaded.caseFile.canonicalTruth.evidenceAuthenticity['ev-3']).toBe(false);
  });

  it('persists v2 under the new key and prefers it over a stale legacy key', () => {
    const storage = memoryStorage({ [LEGACY_KEY]: JSON.stringify(makeV1Payload()) });
    const save = createInitialSave();
    save.player.name = 'Saved Player';

    persistSave(save, storage);

    expect(storage.data[LEGACY_KEY]).toBeUndefined();
    expect(JSON.parse(storage.data[SAVE_KEY]).version).toBe(2);
    expect(JSON.parse(storage.data[SAVE_KEY]).player.name).toBe('Saved Player');
    expect(loadSave(storage).player.name).toBe('Saved Player');
  });

  it('caps persisted draft history and rejects unsupported save versions', () => {
    const storage = memoryStorage();
    const save = createInitialSave();
    save.draft.versions = Array.from({ length: 20 }, (_, i) => ({
      id: `v${i}`, savedAt: new Date().toISOString(), day: 1, slot: 'morning' as const, text: `text ${i}`,
    }));
    persistSave(save, storage);
    expect(JSON.parse(storage.data[SAVE_KEY]).draft.versions).toHaveLength(8);

    const bad = memoryStorage({ [SAVE_KEY]: JSON.stringify({ ...makeV1Payload(), version: 99 }) });
    const fresh: SaveGame = loadSave(bad);
    expect(fresh.version).toBe(2);
    expect(fresh.clock.day).toBe(1);
    expect(fresh.player.reputation.competence).toBe(10);
  });

  it('reset clears both keys', () => {
    const storage = memoryStorage({
      [SAVE_KEY]: JSON.stringify(createInitialSave()),
      [LEGACY_KEY]: JSON.stringify(makeV1Payload()),
    });
    resetSave(storage);
    expect(storage.data[SAVE_KEY]).toBeUndefined();
    expect(storage.data[LEGACY_KEY]).toBeUndefined();
    expect(loadSave(storage).player.name).toBe('Newcomer');
  });
});
