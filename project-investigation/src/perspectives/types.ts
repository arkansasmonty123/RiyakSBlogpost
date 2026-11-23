// M5 (Milestone 5): Perspective Engine — shared types and pure helpers.
// ---------------------------------------------------------------------------
// This module is a LEAF. It is deliberately free of any import from db.ts or
// server.ts and never references canonical_truth. It only declares the
// authored-content shapes, the player-state shapes, allowlists/guards and a
// handful of coercion helpers. Every other module in src/perspectives/ may be
// imported by the server, but this one can be imported by anyone safely.

import type { KnowledgeClass, VerificationStatus, SourceType } from '../knowledge';

export type AnyRow = Record<string, any>;

// ---------------------------------------------------------------------------
// Allowlists (mirrors the CHECK constraints in migration 009).
// ---------------------------------------------------------------------------

export const PERSPECTIVE_FORMATS = [
  'philosophical_parable', 'thought_experiment', 'ethical_dilemma',
  'psychological_demonstration', 'historical_episode', 'scientific_controversy',
  'spiritual_teaching', 'competing_arguments', 'mistaken_assumption', 'real_world_case',
] as const;
export type PerspectiveFormat = (typeof PERSPECTIVE_FORMATS)[number];

/** Pedagogical role of an experience; independent of its knowledge_class. */
export const PERSPECTIVE_CLASSES = [
  'framework_primer', 'case_bridge', 'challenge', 'reflection',
  'counterexample', 'comparison',
] as const;
export type PerspectiveClass = (typeof PERSPECTIVE_CLASSES)[number];

export const EXPERIENCE_STATUSES = ['draft', 'published', 'retired'] as const;
export type ExperienceStatus = (typeof EXPERIENCE_STATUSES)[number];

export const DIFFICULTIES = ['introductory', 'intermediate', 'advanced'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const REFLECTION_KINDS = [
  'reflection', 'argument_for', 'argument_against', 'assumption',
  'open_question', 'alternative_interpretation', 'disagreement',
  'hypothesis_reconsideration',
] as const;
export type ReflectionKind = (typeof REFLECTION_KINDS)[number];

export const SUGGESTION_STATES = ['dismissed', 'opened', 'saved'] as const;
export type SuggestionState = (typeof SUGGESTION_STATES)[number];

/** Why an advisory suggestion was surfaced. Advisory language only. */
export const SUGGESTION_REASON_CODES = [
  'framework_primer', 'matches_case_genre', 'matches_discovered_evidence',
  'challenges_active_hypothesis', 'addresses_open_question',
  'recommended_by_specialist', 'broadens_perspective', 'related_bridge',
] as const;
export type SuggestionReasonCode = (typeof SUGGESTION_REASON_CODES)[number];

export const FRAMEWORK_STATUSES = EXPERIENCE_STATUSES;
export type FrameworkStatus = ExperienceStatus;

// ---------------------------------------------------------------------------
// Bounded limits. Source quotes are deliberately short (no long verbatim
// passages ship to the client); context builders are bounded for the LLM.
// ---------------------------------------------------------------------------

export const PERSPECTIVE_LIMITS = {
  maxFrameworkNameChars: 120,
  maxExperienceTitleChars: 200,
  maxTextFieldChars: 6_000,
  maxSourceQuoteChars: 240,
  maxSourceLabelChars: 200,
  maxReflectionChars: 4_000,
  maxReflectionPromptChars: 600,
  maxSuggestions: 6,
  maxContextChars: 3_500,
  maxContextExperiences: 3,
  maxReasonTextChars: 240,
  expectedFrameworkCount: 7,
  expectedExperienceCount: 12,
} as const;

// ---------------------------------------------------------------------------
// Authored content shapes (used by the registry and the seed).
// ---------------------------------------------------------------------------

/** A bibliographic-style supporting source. URL is stored raw but only ever
 * exposed by dto.ts when BOTH sourceVerified and a verified review status. */
export interface PerspectiveSource {
  label: string;
  author?: string | undefined;
  title?: string | undefined;
  url?: string | null | undefined;
  sourceType?: SourceType | null | undefined;
  verificationStatus: VerificationStatus;
  sourceVerified?: boolean | undefined;
  notes?: string | undefined;
  /** Provenance note surfaced by dto.ts (which reads verificationNotes/verification_notes). */
  verificationNotes?: string | undefined;
  /** Short quotation only; validator enforces PERSPECTIVE_LIMITS.maxSourceQuoteChars. */
  quote?: string | undefined;
}

export interface ExperienceSection {
  heading: string;
  body: string;
}

export interface FrameworkDefinition {
  frameworkKey: string;
  name: string;
  intellectualDomain: string;
  summary: string;
  coreQuestions: string[];
  keyConcepts: string[];
  methodOfReasoning: string;
  limitations: string[];
  commonMisconceptions: string[];
  internalDifferences: string[];
  relevantDisciplines: string[];
  displayOrder: number;
  status: FrameworkStatus;
}

export interface ExperienceDefinition {
  experienceKey: string;
  title: string;
  frameworkKey: string;
  format: PerspectiveFormat;
  knowledgeClass: KnowledgeClass;
  perspectiveClass: PerspectiveClass;
  scopeNote: string;
  traditionScope: string;
  intellectualPurpose: string;
  primaryQuestion: string;
  introduction: string;
  intellectualBackground: string;
  mainIdea: string;
  detailedExplanation: string;
  sections: ExperienceSection[];
  historicalContext: string;
  /** Map of plain-language label -> bounded explanation of the epistemic status. */
  epistemicBreakdown: Record<string, string>;
  keyConcepts: string[];
  supportingSources: PerspectiveSource[];
  limitations: string[];
  counterarguments: string[];
  commonMisconceptions: string[];
  reflectionQuestions: string[];
  activities: string[];
  recommendationTags: string[];
  relatedExperienceKeys: string[];
  relatedSpecialistKeys: string[];
  relatedArtifactKeys: string[];
  relatedCaseTitles: string[];
  estimatedMinutes: number;
  difficulty: Difficulty;
  displayOrder: number;
  status: ExperienceStatus;
}

/** Maps a case (by title or genre) to the lenses that pair well with it. Pure. */
export interface PerspectiveBridge {
  bridgeKey: string;
  caseTitle?: string | undefined;
  genre?: string | undefined;
  frameworkKeys: string[];
  reasonCodes: SuggestionReasonCode[];
  note: string;
}

// ---------------------------------------------------------------------------
// Recommendation contracts (pure input -> pure output; no state mutation).
// ---------------------------------------------------------------------------

export interface RecommendationContext {
  caseTitle?: string | undefined;
  genre?: string | undefined;
  discoveredEvidenceCategories?: string[] | undefined;
  activeHypothesisCategories?: string[] | undefined;
  openQuestionCount?: number | undefined;
  dismissedExperienceKeys?: string[] | undefined;
  savedExperienceKeys?: string[] | undefined;
  availableExperiences?: ExperienceDefinition[] | undefined;
  limit?: number | undefined;
}

export interface ExperienceRecommendation {
  experienceKey: string;
  title: string;
  frameworkKey: string;
  reasonCodes: SuggestionReasonCode[];
  reasonText: string;
  score: number;
  stateFingerprint: string;
}

// ---------------------------------------------------------------------------
// Guards.
// ---------------------------------------------------------------------------

function inList<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

export const isPerspectiveFormat = (v: unknown): v is PerspectiveFormat => inList(PERSPECTIVE_FORMATS, v);
export const isPerspectiveClass = (v: unknown): v is PerspectiveClass => inList(PERSPECTIVE_CLASSES, v);
export const isExperienceStatus = (v: unknown): v is ExperienceStatus => inList(EXPERIENCE_STATUSES, v);
export const isFrameworkStatus = (v: unknown): v is FrameworkStatus => inList(FRAMEWORK_STATUSES, v);
export const isDifficulty = (v: unknown): v is Difficulty => inList(DIFFICULTIES, v);
export const isReflectionKind = (v: unknown): v is ReflectionKind => inList(REFLECTION_KINDS, v);
export const isSuggestionState = (v: unknown): v is SuggestionState => inList(SUGGESTION_STATES, v);
export const isSuggestionReasonCode = (v: unknown): v is SuggestionReasonCode => inList(SUGGESTION_REASON_CODES, v);

// M3 knowledge classes and verification statuses remain the single source of
// truth for those concepts; re-exported as guards for convenience.
export function isPerspectiveKnowledgeClass(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  const allowed: readonly string[] = [
    'established_scientific', 'contested_scientific', 'historical', 'legal',
    'philosophical', 'religious_spiritual', 'fictional_in_world',
  ];
  return allowed.includes(v);
}

// ---------------------------------------------------------------------------
// Pure coercion helpers (tolerate camelCase DTO rows and raw snake_case rows).
// ---------------------------------------------------------------------------

export function clip(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.length <= max ? value : `${value.slice(0, max).trimEnd()}…`;
}

export function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

export function pick(row: AnyRow, camel: string, snake: string): any {
  if (row[camel] !== undefined) return row[camel];
  return row[snake];
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
  }
  return {};
}

/** Stable, dependency-free fingerprint for advisory suggestion state. */
export function fingerprint(parts: readonly string[]): string {
  let hash = 0x811c9dc5;
  const joined = parts.join('|');
  for (let i = 0; i < joined.length; i += 1) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `m5-${hash.toString(16).padStart(8, '0')}`;
}
