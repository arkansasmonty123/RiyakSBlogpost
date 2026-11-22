import { MAX_DRAFT_CHARS, MAX_DRAFT_VERSIONS } from '@/domain/draft';
import { validateSourceProvenance } from '@/domain/legalSources';
import { createInitialSave } from '@/domain/seed';
import type {
  Assignment,
  DraftState,
  EvidenceItem,
  LegalSource,
  SaveGame,
  SourceVerificationStatus,
} from '@/domain/types';

export const SAVE_KEY = 'the-bar-save-v2';
export const LEGACY_KEY = 'the-bar-save-v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  // Non-browser contexts (e.g. unit tests that pass explicit storage) never persist.
  return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
}

function mergeById<T extends { id: string }>(baseItems: T[], parsed: unknown): T[] {
  if (!Array.isArray(parsed) || parsed.length === 0) return baseItems;
  const defaults = new Map(baseItems.map((item) => [item.id, item]));
  return (parsed as T[])
    .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
    .map((item) => ({ ...(defaults.get(item.id) ?? ({} as T)), ...item }));
}

function mergeEvidence(base: EvidenceItem[], parsed: unknown): EvidenceItem[] {
  return mergeById<EvidenceItem>(base, parsed).map((item) => ({
    ...item,
    discovered: item.discovered ?? false,
    reviewed: item.reviewed ?? false,
    admissibility: item.admissibility ?? 'unknown',
    reliability: item.reliability ?? 'unknown',
    // v1 saves have no assessment object; fill defaults so old data stays loadable.
    assessment: {
      admissibility: item.assessment?.admissibility ?? 'unknown',
      reliability: item.assessment?.reliability ?? 'unknown',
      rationale: item.assessment?.rationale ?? '',
    },
  }));
}

/**
 * Legal sources are untrusted stored data. Fill new provenance fields from defaults, and
 * demote any stored `verified` flag that lacks traceable provenance so it cannot be cited.
 */
function mergeLegalSources(base: LegalSource[], parsed: unknown): LegalSource[] {
  if (!Array.isArray(parsed) || parsed.length === 0) return base;
  const defaults = new Map(base.map((item) => [item.id, item]));
  return (parsed as LegalSource[])
    .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
    .map((item) => {
      const fallback = defaults.get(item.id) ?? ({} as LegalSource);
      const rawStatus = item.verificationStatus as SourceVerificationStatus | undefined;
      const status: SourceVerificationStatus =
        rawStatus === 'verified' || rawStatus === 'unverified' || rawStatus === 'placeholder'
          ? rawStatus
          : 'unverified';
      const merged: LegalSource = {
        ...fallback,
        ...item,
        sourceName: item.sourceName?.trim() || fallback.sourceName || item.title || '(unnamed source)',
        provenance: item.provenance?.trim() || fallback.provenance || item.notes || '',
        verificationStatus: status,
      };
      if (status === 'verified' && !validateSourceProvenance(merged).ok) {
        merged.verificationStatus = 'unverified';
      }
      return merged;
    });
}

function mergeAssignments(base: Assignment[], parsed: unknown): Assignment[] {
  return mergeById<Assignment>(base, parsed).map((item) => ({
    ...item,
    status: item.status ?? 'locked',
    requiredNotebookKinds: item.requiredNotebookKinds ?? [],
  }));
}

function mergeDraft(base: DraftState, parsed: unknown): DraftState {
  if (!parsed || typeof parsed !== 'object') return base;
  const value = parsed as Partial<DraftState>;
  return {
    current: typeof value.current === 'string' ? value.current.slice(0, MAX_DRAFT_CHARS) : base.current,
    versions: Array.isArray(value.versions) ? value.versions.slice(0, MAX_DRAFT_VERSIONS) : base.versions,
  };
}

/** Load v1 or v2 saves, merging new fields over sane defaults. Never trusts unknown versions. */
export function loadSave(storage: StorageLike = defaultStorage()): SaveGame {
  try {
    const raw = storage.getItem(SAVE_KEY) ?? storage.getItem(LEGACY_KEY);
    if (!raw) return createInitialSave();
    const parsed = JSON.parse(raw) as Partial<SaveGame>;
    const version = (parsed as { version?: number }).version;
    if (version !== 1 && version !== 2) return createInitialSave();

    const base = createInitialSave();
    const parsedCase = parsed.caseFile as Partial<SaveGame['caseFile']> | undefined;
    return {
      ...base,
      ...parsed,
      version: 2,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : base.savedAt,
      player: { ...base.player, ...(parsed.player ?? {}) },
      clock: { ...base.clock, ...(parsed.clock ?? {}) },
      characters: parsed.characters?.length ? (parsed.characters as SaveGame['characters']) : base.characters,
      relationships: parsed.relationships?.length ? (parsed.relationships as SaveGame['relationships']) : base.relationships,
      memories: parsed.memories?.length ? (parsed.memories as SaveGame['memories']) : base.memories,
      caseFile: {
        ...base.caseFile,
        ...(parsedCase ?? {}),
        evidence: mergeEvidence(base.caseFile.evidence, parsedCase?.evidence),
        canonicalTruth: { ...base.caseFile.canonicalTruth, ...(parsedCase?.canonicalTruth ?? {}) },
      },
      legalSources: mergeLegalSources(base.legalSources, parsed.legalSources),
      assignments: mergeAssignments(base.assignments, parsed.assignments),
      notebook: parsed.notebook?.length ? (parsed.notebook as SaveGame['notebook']) : base.notebook,
      flags: { ...base.flags, ...(parsed.flags ?? {}) },
      usedDialogueSceneIds: Array.isArray(parsed.usedDialogueSceneIds)
        ? parsed.usedDialogueSceneIds.filter((id): id is string => typeof id === 'string')
        : base.usedDialogueSceneIds,
      draft: mergeDraft(base.draft, parsed.draft),
      // Extended Day 1–10 casework: absent in older saves, so fall back to defaults.
      custodyLog: Array.isArray(parsed.custodyLog) ? parsed.custodyLog : base.custodyLog,
      challenges: Array.isArray(parsed.challenges) ? parsed.challenges : base.challenges,
      reviewRounds: Array.isArray(parsed.reviewRounds) ? parsed.reviewRounds : base.reviewRounds,
    };
  } catch {
    return createInitialSave();
  }
}

export function persistSave(save: SaveGame, storage: StorageLike = defaultStorage()): void {
  const payload: SaveGame = {
    ...save,
    version: 2,
    savedAt: new Date().toISOString(),
    draft: {
      current: save.draft.current,
      versions: save.draft.versions.slice(0, MAX_DRAFT_VERSIONS),
    },
  };
  storage.setItem(SAVE_KEY, JSON.stringify(payload));
  storage.removeItem(LEGACY_KEY);
}

export function resetSave(storage: StorageLike = defaultStorage()): SaveGame {
  storage.removeItem(SAVE_KEY);
  storage.removeItem(LEGACY_KEY);
  return createInitialSave();
}
