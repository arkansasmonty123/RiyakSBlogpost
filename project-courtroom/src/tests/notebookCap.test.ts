import { describe, expect, it } from 'vitest';
import { discoverEvidenceItem, reviewEvidence } from '@/domain/evidence';
import { MAX_NOTEBOOK_ENTRIES, addNotebookEntry } from '@/domain/notebook';
import { recordCustodyObservation } from '@/domain/casework';
import { createInitialSave } from '@/domain/seed';
import { loadSave, persistSave, SAVE_KEY } from '@/storage/save';
import type { StorageLike } from '@/storage/save';

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

function note(id: string, index: number) {
  return { id, day: 1, kind: 'note' as const, title: `Note ${index}`, content: `Entry ${index}`, verified: false };
}

describe('bounded player notebook', () => {
  it('drops the oldest entries and keeps the newest on append', () => {
    const save = createInitialSave();
    save.notebook = [];
    for (let i = 0; i < MAX_NOTEBOOK_ENTRIES + 5; i += 1) {
      addNotebookEntry(save, note(`n-${i}`, i));
    }

    expect(save.notebook).toHaveLength(MAX_NOTEBOOK_ENTRIES);
    expect(save.notebook[0].title).toBe(`Note ${MAX_NOTEBOOK_ENTRIES + 4}`);
    expect(save.notebook[MAX_NOTEBOOK_ENTRIES - 1].title).toBe('Note 5');
  });

  it('caps notes written by domain casework flows as well', () => {
    const save = createInitialSave();
    expect(discoverEvidenceItem(save, 'ev-2')).not.toBeNull();
    expect(reviewEvidence(save, 'ev-2')).toBe(true);
    save.notebook = [];
    for (let i = 0; i < MAX_NOTEBOOK_ENTRIES + 3; i += 1) {
      expect(recordCustodyObservation(save, 'ev-2', `Observation ${i}`).ok).toBe(true);
    }

    expect(save.notebook).toHaveLength(MAX_NOTEBOOK_ENTRIES);
    expect(save.notebook[0].content).toBe(`Observation ${MAX_NOTEBOOK_ENTRIES + 2}`);
  });

  it('trims oversized notebooks on persist and when loading an untrusted save', () => {
    const storage = memoryStorage();
    const save = createInitialSave();
    // Notebook arrays are newest-first, so the first entries must survive the trim.
    save.notebook = Array.from({ length: MAX_NOTEBOOK_ENTRIES + 4 }, (_, i) =>
      note(`n-${i}`, MAX_NOTEBOOK_ENTRIES + 3 - i),
    );

    persistSave(save, storage);
    const persisted = JSON.parse(storage.data[SAVE_KEY]);
    expect(persisted.notebook).toHaveLength(MAX_NOTEBOOK_ENTRIES);
    expect(persisted.notebook[0].title).toBe(`Note ${MAX_NOTEBOOK_ENTRIES + 3}`);
    expect(persisted.notebook[MAX_NOTEBOOK_ENTRIES - 1].title).toBe('Note 4');
    expect(loadSave(storage).notebook).toHaveLength(MAX_NOTEBOOK_ENTRIES);

    const raw = JSON.parse(storage.data[SAVE_KEY]);
    raw.notebook = Array.from({ length: MAX_NOTEBOOK_ENTRIES + 2 }, (_, i) =>
      note(`stored-${i}`, MAX_NOTEBOOK_ENTRIES + 1 - i),
    );
    const loaded = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(raw) }));
    expect(loaded.notebook).toHaveLength(MAX_NOTEBOOK_ENTRIES);
    expect(loaded.notebook[0].title).toBe(`Note ${MAX_NOTEBOOK_ENTRIES + 1}`);
  });
});
