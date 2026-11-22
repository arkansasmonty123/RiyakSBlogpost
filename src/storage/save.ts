import type { SaveGame } from '@/domain/types';
import { createInitialSave } from '@/domain/seed';

const KEY = 'the-bar-save-v1';

export function loadSave(): SaveGame {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createInitialSave();
    const parsed = JSON.parse(raw) as Partial<SaveGame>;
    if (parsed.version !== 1) return createInitialSave();
    const base = createInitialSave();
    return {
      ...base,
      ...parsed,
      player: { ...base.player, ...(parsed.player || {}) },
      clock: { ...base.clock, ...(parsed.clock || {}) },
      characters: parsed.characters?.length ? parsed.characters as SaveGame['characters'] : base.characters,
      relationships: parsed.relationships?.length ? parsed.relationships as SaveGame['relationships'] : base.relationships,
      memories: parsed.memories?.length ? parsed.memories as SaveGame['memories'] : base.memories,
      caseFile: { ...base.caseFile, ...(parsed.caseFile || {}), evidence: (parsed.caseFile?.evidence?.length ? parsed.caseFile.evidence : base.caseFile.evidence) as SaveGame['caseFile']['evidence'], canonicalTruth: { ...base.caseFile.canonicalTruth, ...(parsed.caseFile?.canonicalTruth || {}) } },
      legalSources: parsed.legalSources?.length ? parsed.legalSources as SaveGame['legalSources'] : base.legalSources,
      assignments: parsed.assignments?.length ? parsed.assignments as SaveGame['assignments'] : base.assignments,
      notebook: parsed.notebook?.length ? parsed.notebook as SaveGame['notebook'] : base.notebook,
      flags: { ...base.flags, ...(parsed.flags || {}) },
    };
  } catch {
    return createInitialSave();
  }
}

export function persistSave(save: SaveGame): void {
  localStorage.setItem(KEY, JSON.stringify({ ...save, savedAt: new Date().toISOString() }));
}

export function resetSave(): SaveGame {
  localStorage.removeItem(KEY);
  return createInitialSave();
}
