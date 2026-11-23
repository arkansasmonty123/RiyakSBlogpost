import { containsCanonicalTruth } from '@/domain/ai/guards';
import { sanitizeAuditLog } from '@/domain/audit';
import { MAX_DRAFT_CHARS, MAX_DRAFT_VERSIONS } from '@/domain/draft';
import { validateSourceProvenance } from '@/domain/legalSources';
import { trimNotebook } from '@/domain/notebook';
import { isValidViewpoint } from '@/domain/scenes';
import { createInitialSave } from '@/domain/seed';
import { MAX_AI_REVIEW_RECORDS } from '@/domain/types';
import type {
  AiReviewRecord,
  Assignment,
  CaseFile,
  Character,
  DraftState,
  EvidenceItem,
  LegalSource,
  Relationship,
  SaveGame,
  SourceVerificationStatus,
} from '@/domain/types';

export const SAVE_KEY = 'the-bar-save-v2';
export const LEGACY_KEY = 'the-bar-save-v1';

const MAX_AI_REVIEW_SUMMARY_CHARS = 400;
const MAX_AI_REVIEW_STRING_CHARS = 200;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * On-disk shape. `canonicalTruth` is deliberately absent: it is authoritative game data,
 * never player data, so it is rehydrated from the deterministic seed on load instead of
 * being written to (or trusted from) storage. The allow-list below also means that adding
 * a new case-file field cannot accidentally leak it into a save.
 */
export type PersistedCaseFile = Omit<CaseFile, 'canonicalTruth'>;
export type PersistedSave = Omit<SaveGame, 'caseFile'> & { caseFile: PersistedCaseFile };

/** Server rejected a conditional write because another copy was saved first. */
export const SAVE_CONFLICT_REASON = 'SAVE_CONFLICT';

export interface PersistResult {
  ok: boolean;
  reason?: string;
  /**
   * True only when a conditional (optimistic-concurrency) write lost to a newer server copy.
   * `reason` carries the same signal for callers that only inspect the string. Adapters with
   * no concurrency model (localStorage) never set it, so their UX is unchanged.
   */
  conflict?: boolean;
}

/** Distinguish a lost conditional write from ordinary persistence failures. */
export function isSaveConflict(result: PersistResult): boolean {
  return result.conflict === true || result.reason === SAVE_CONFLICT_REASON;
}

/** Storage can be unavailable (private mode, disabled cookies, quota policy). Cleanup must never fail a save/reset. */
function safeRemove(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Best effort only; an undeleted stale legacy key is harmless because SAVE_KEY wins on load.
  }
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
  const merged = mergeById<EvidenceItem>(base, parsed).map((item) => ({
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
  // Content added after a save was written must still appear: append any seed item that
  // an older save does not know about (as undiscovered, with default assessment fields).
  const seen = new Set(merged.map((item) => item.id));
  for (const item of base) {
    if (!seen.has(item.id)) merged.push({ ...item });
  }
  return merged;
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

/**
 * Cast expansion is additive: a save written before the new characters existed keeps its
 * stored versions of known characters, while the missing ones are appended from defaults.
 */
function mergeCharacters(base: Character[], parsed: unknown): Character[] {
  if (!Array.isArray(parsed) || parsed.length === 0) return base;
  const defaults = new Map(base.map((item) => [item.id, item]));
  const merged = (parsed as Character[])
    .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
    .map((item) => ({ ...(defaults.get(item.id) ?? ({} as Character)), ...item }));
  const seen = new Set(merged.map((item) => item.id));
  for (const item of base) {
    if (!seen.has(item.id)) merged.push({ ...item });
  }
  return merged;
}

function relationshipKey(item: Relationship): string {
  return `${item.fromId}:${item.toId}`;
}

/** Relationship expansion is additive and keyed by the participant pair (no `id` field). */
function mergeRelationships(base: Relationship[], parsed: unknown): Relationship[] {
  if (!Array.isArray(parsed) || parsed.length === 0) return base;
  const defaults = new Map(base.map((item) => [relationshipKey(item), item]));
  const merged = (parsed as Relationship[])
    .filter(
      (item) => item && typeof item === 'object' && typeof item.fromId === 'string' && typeof item.toId === 'string',
    )
    .map((item) => ({ ...(defaults.get(relationshipKey(item)) ?? ({} as Relationship)), ...item }));
  const seen = new Set(merged.map(relationshipKey));
  for (const item of base) {
    if (!seen.has(relationshipKey(item))) merged.push({ ...item });
  }
  return merged;
}

function mergeDraft(base: DraftState, parsed: unknown): DraftState {
  if (!parsed || typeof parsed !== 'object') return base;
  const value = parsed as Partial<DraftState>;
  return {
    current: typeof value.current === 'string' ? value.current.slice(0, MAX_DRAFT_CHARS) : base.current,
    versions: Array.isArray(value.versions) ? value.versions.slice(0, MAX_DRAFT_VERSIONS) : base.versions,
  };
}

/**
 * AI-review records are untrusted stored metadata. Keep only known, bounded, player-safe
 * fields and drop anything carrying canonical-truth markers. Older saves have no such field.
 */
export function sanitizeAiReviews(value: unknown): AiReviewRecord[] {
  if (!Array.isArray(value)) return [];
  const clean: AiReviewRecord[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Partial<AiReviewRecord>;
    if (typeof item.id !== 'string' || !item.id.trim()) continue;
    if (typeof item.assignmentId !== 'string' || typeof item.requestId !== 'string') continue;
    if (typeof item.day !== 'number' || !Number.isFinite(item.day)) continue;
    if (typeof item.round !== 'number' || !Number.isFinite(item.round)) continue;
    if (item.deterministicStatus !== 'accepted' && item.deterministicStatus !== 'needs_revision') continue;
    if (item.gatewayStatus !== 'accepted' && item.gatewayStatus !== 'rejected') continue;
    if (typeof item.summary !== 'string' || typeof item.aiAssisted !== 'boolean') continue;
    const summary = item.summary.trim().slice(0, MAX_AI_REVIEW_SUMMARY_CHARS);
    if (!summary || containsCanonicalTruth(summary)) continue;
    const safeStrings = (rawIds: unknown): string[] =>
      Array.isArray(rawIds)
        ? rawIds
            .filter((id): id is string => typeof id === 'string')
            .slice(0, MAX_AI_REVIEW_RECORDS)
            .map((id) => id.trim().slice(0, MAX_AI_REVIEW_STRING_CHARS))
            .filter(Boolean)
        : [];
    const citedSources = safeStrings(item.citedSources);
    const warnings = safeStrings(item.warnings);
    if (citedSources.some(containsCanonicalTruth) || warnings.some(containsCanonicalTruth)) continue;
    clean.push({
      id: item.id.trim().slice(0, MAX_AI_REVIEW_STRING_CHARS),
      day: Math.floor(item.day),
      assignmentId: item.assignmentId.trim().slice(0, MAX_AI_REVIEW_STRING_CHARS),
      round: Math.floor(item.round),
      requestId: item.requestId.trim().slice(0, MAX_AI_REVIEW_STRING_CHARS),
      deterministicStatus: item.deterministicStatus,
      aiAssisted: item.aiAssisted,
      gatewayStatus: item.gatewayStatus,
      summary,
      citedSources,
      warnings,
    });
    if (clean.length >= MAX_AI_REVIEW_RECORDS) break;
  }
  return clean;
}

/** Merge/sanitize untrusted persisted data into a complete SaveGame. Never trusts canonical truth. */
export function hydrateSave(parsed: unknown): SaveGame {
  try {
    if (!parsed || typeof parsed !== 'object') return createInitialSave();
    const value = parsed as Partial<SaveGame>;
    const version = (value as { version?: number }).version;
    if (version !== 1 && version !== 2) return createInitialSave();

    const base = createInitialSave();
    const parsedCase = value.caseFile as Partial<SaveGame['caseFile']> | undefined;
    const player = { ...base.player, ...(value.player ?? {}) };
    // Saves written before the chapter payoff predate the promotion; bring a completed
    // chapter up to date so the completion summary matches the recorded chapter state.
    if (player.careerStage === 'intern' && value.flags?.chapterOneComplete === true) {
      player.careerStage = 'junior_advocate';
    }
    return {
      ...base,
      ...value,
      version: 2,
      savedAt: typeof value.savedAt === 'string' ? value.savedAt : base.savedAt,
      player,
      clock: { ...base.clock, ...(value.clock ?? {}) },
      characters: mergeCharacters(base.characters, value.characters),
      relationships: mergeRelationships(base.relationships, value.relationships),
      memories: value.memories?.length ? (value.memories as SaveGame['memories']) : base.memories,
      caseFile: {
        ...base.caseFile,
        ...(parsedCase ?? {}),
        evidence: mergeEvidence(base.caseFile.evidence, parsedCase?.evidence),
        // Never trust canonical truth from storage. Rehydrate a fresh seed copy so a
        // tampered or stale save cannot alter hidden events, motives or authenticity.
        canonicalTruth: structuredClone(base.caseFile.canonicalTruth),
      },
      legalSources: mergeLegalSources(base.legalSources, value.legalSources),
      assignments: mergeAssignments(base.assignments, value.assignments),
      // Untrusted/legacy notebooks are trimmed to the newest entries on load as well.
      notebook: value.notebook?.length ? trimNotebook(value.notebook as SaveGame['notebook']) : base.notebook,
      flags: { ...base.flags, ...(value.flags ?? {}) },
      // A stale or unknown viewpoint id must never leave the scene panel without a view.
      selectedViewpoint: isValidViewpoint(value.selectedViewpoint) ? value.selectedViewpoint : base.selectedViewpoint,
      usedDialogueSceneIds: Array.isArray(value.usedDialogueSceneIds)
        ? value.usedDialogueSceneIds.filter((id): id is string => typeof id === 'string')
        : base.usedDialogueSceneIds,
      draft: mergeDraft(base.draft, value.draft),
      // Extended Day 1–10 casework: absent in older saves, so fall back to defaults.
      custodyLog: Array.isArray(value.custodyLog) ? value.custodyLog : base.custodyLog,
      challenges: Array.isArray(value.challenges) ? value.challenges : base.challenges,
      reviewRounds: Array.isArray(value.reviewRounds) ? value.reviewRounds : base.reviewRounds,
      // Case theory is absent in older saves; fall back to an empty, player-authored file.
      caseTheory: {
        claims: Array.isArray(value.caseTheory?.claims)
          ? value.caseTheory!.claims.filter(
              (c) =>
                c &&
                typeof c.id === 'string' &&
                typeof c.text === 'string' &&
                typeof c.day === 'number' &&
                (c.status === 'known' || c.status === 'claimed' || c.status === 'disputed') &&
                Array.isArray(c.evidenceIds),
            )
          : base.caseTheory.claims,
      },
      // Audit log is absent in older saves; sanitize untrusted stored entries on load.
      auditLog: sanitizeAuditLog(value.auditLog),
      // AI-review history is additive and absent in older saves; default to none.
      aiReviews: sanitizeAiReviews(value.aiReviews),
    };
  } catch {
    return createInitialSave();
  }
}

function quarantineCorruptSave(storage: StorageLike, raw: string | null, reason: string): void {
  if (!raw) return;
  try {
    storage.setItem(`${SAVE_KEY}:corrupt-backup`, JSON.stringify({ at: new Date().toISOString(), reason, raw }));
  } catch {
    // best-effort quarantine; never block recovery
  }
}

/** Load v1 or v2 saves, merging new fields over sane defaults. Never trusts unknown versions. */
export function loadSave(storage: StorageLike = defaultStorage()): SaveGame {
  let raw: string | null = null;
  try {
    raw = storage.getItem(SAVE_KEY) ?? storage.getItem(LEGACY_KEY);
    if (!raw) return createInitialSave();
    const parsed = JSON.parse(raw) as unknown;
    return hydrateSave(parsed);
  } catch {
    quarantineCorruptSave(storage, raw, 'load-or-parse-failed');
    return createInitialSave();
  }
}

/** Build a player-safe save projection. Never includes canonical truth. */
export function toPersistedSave(save: SaveGame): PersistedSave {
  return {
    ...save,
    version: 2,
    savedAt: new Date().toISOString(),
    // Explicit player-safe fields; `canonicalTruth` is intentionally never serialized.
    caseFile: {
      id: save.caseFile.id,
      title: save.caseFile.title,
      status: save.caseFile.status,
      playerKnowledge: save.caseFile.playerKnowledge,
      allegations: save.caseFile.allegations,
      admissibleMaterial: save.caseFile.admissibleMaterial,
      unresolvedAmbiguity: save.caseFile.unresolvedAmbiguity,
      evidence: save.caseFile.evidence,
    },
    draft: {
      current: save.draft.current,
      versions: save.draft.versions.slice(0, MAX_DRAFT_VERSIONS),
    },
    // Keep the newest notes only; an oversized in-memory save must not bloat storage.
    notebook: trimNotebook(save.notebook),
    auditLog: sanitizeAuditLog(save.auditLog),
  };
}

/** Persist a player-safe projection of the save. Never throws; callers surface `ok`/`reason`. */
export function persistSave(save: SaveGame, storage: StorageLike = defaultStorage()): PersistResult {
  try {
    const payload = toPersistedSave(save);
    storage.setItem(SAVE_KEY, JSON.stringify(payload));
    safeRemove(storage, LEGACY_KEY);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Reset always yields a fresh in-memory save, even if local storage rejects the cleanup. */
export function resetSave(storage: StorageLike = defaultStorage()): SaveGame {
  safeRemove(storage, SAVE_KEY);
  safeRemove(storage, LEGACY_KEY);
  return createInitialSave();
}
