import type { SaveGame } from '@/domain/types';
import { createInitialSave } from '@/domain/seed';

const KEY = 'the-bar-save-v1';

export function loadSave(): SaveGame {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createInitialSave();
    const parsed = JSON.parse(raw) as SaveGame;
    if (parsed.version !== 1) return createInitialSave();
    return parsed;
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
