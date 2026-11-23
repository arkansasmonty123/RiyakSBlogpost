// M5: public DTO allowlists for perspective content and player state.
// ---------------------------------------------------------------------------
// SAFETY CONTRACT: no db/server/canonical imports. This module only transforms
// already-safe rows into client DTOs. The single most important rule lives in
// safeSourceUrl(): a source URL is NEVER exposed unless BOTH source_verified is
// true AND verification_status == 'verified'. Unverified sources keep their
// bibliography-style label/notes but report sourceUrl: null.
//
// Long verbatim passages are clipped: `quote` is bounded to
// PERSPECTIVE_LIMITS.maxSourceQuoteChars.

import {
  PERSPECTIVE_LIMITS,
  asRecord,
  asStringArray,
  bool,
  clip,
  isDifficulty,
  isExperienceStatus,
  isPerspectiveClass,
  isPerspectiveFormat,
  isReflectionKind,
  isSuggestionState,
  isPerspectiveKnowledgeClass,
  pick,
  str,
  type AnyRow,
} from './types';
import { normalizeVerificationStatus, isSourceType } from '../knowledge';
import type { SourceType, VerificationStatus } from '../knowledge';

/** Like clip() but guarantees the result length is <= max (ellipsis included). */
function clipStrict(value: unknown, max: number): string {
  const s = str(value);
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function safeSourceUrl(source: AnyRow): string | null {
  const verified = bool(pick(source, 'sourceVerified', 'source_verified'));
  const status = normalizeVerificationStatus(pick(source, 'verificationStatus', 'verification_status'));
  const url = pick(source, 'url', 'url');
  return verified && status === 'verified' && typeof url === 'string' && url.trim().length > 0 ? url : null;
}

function normalizeSource(raw: unknown): AnyRow | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as AnyRow;
  if (typeof raw === 'string' && raw.trim().length > 0) return { label: raw };
  return null;
}

/**
 * Safe supporting-source projection. `label` is always kept (it is the
 * bibliography-style citation); the URL is conditional.
 */
export function toPublicSources(value: unknown): Array<{
  label: string;
  author: string;
  title: string;
  sourceType: SourceType | null;
  verificationStatus: VerificationStatus;
  verificationNotes: string;
  sourceVerified: boolean;
  sourceUrl: string | null;
  quote: string;
}> {
  const list = Array.isArray(value)
    ? value
    : (() => { try { const p = JSON.parse(str(value)); return Array.isArray(p) ? p : []; } catch { return []; } })();
  const sources: AnyRow[] = [];
  for (const raw of list) {
    const source = normalizeSource(raw);
    if (source) sources.push(source);
  }
  return sources.map((source) => {
    const sourceTypeValue = pick(source, 'sourceType', 'source_type');
    return {
      label: clip(pick(source, 'label', 'label'), PERSPECTIVE_LIMITS.maxSourceLabelChars),
      author: clip(pick(source, 'author', 'author'), 160),
      title: clip(pick(source, 'title', 'title'), PERSPECTIVE_LIMITS.maxSourceLabelChars),
      sourceType: isSourceType(sourceTypeValue) ? sourceTypeValue : null,
      verificationStatus: normalizeVerificationStatus(pick(source, 'verificationStatus', 'verification_status')),
      verificationNotes: clip(pick(source, 'verificationNotes', 'verification_notes'), 600),
      sourceVerified: bool(pick(source, 'sourceVerified', 'source_verified')),
      sourceUrl: safeSourceUrl(source),
      quote: clipStrict(pick(source, 'quote', 'quote'), PERSPECTIVE_LIMITS.maxSourceQuoteChars),
    };
  });
}

function boundedRecord(value: unknown, maxValues: number): Record<string, string> {
  const raw = asRecord(value);
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (Object.keys(result).length >= maxValues) break;
    if (typeof entry === 'string' && entry.trim().length > 0) {
      result[clip(key, 80)] = clip(entry, 400);
    }
  }
  return result;
}

function sections(value: unknown): Array<{ heading: string; body: string }> {
  const raw = Array.isArray(value) ? value : (() => { try { const p = JSON.parse(str(value)); return Array.isArray(p) ? p : []; } catch { return []; } })();
  const out: Array<{ heading: string; body: string }> = [];
  for (const item of raw.slice(0, 24)) {
    const section = normalizeSource(item);
    if (!section) continue;
    out.push({
      heading: clip(pick(section, 'heading', 'heading'), 160),
      body: clip(pick(section, 'body', 'body'), PERSPECTIVE_LIMITS.maxTextFieldChars),
    });
  }
  return out;
}

export function toPublicFramework(row: AnyRow) {
  const status = pick(row, 'status', 'status');
  return {
    id: str(pick(row, 'id', 'id')),
    frameworkKey: str(pick(row, 'frameworkKey', 'framework_key')),
    name: clip(pick(row, 'name', 'name'), PERSPECTIVE_LIMITS.maxFrameworkNameChars),
    intellectualDomain: clip(pick(row, 'intellectualDomain', 'intellectual_domain'), 200),
    summary: clip(pick(row, 'summary', 'summary'), PERSPECTIVE_LIMITS.maxTextFieldChars),
    coreQuestions: asStringArray(pick(row, 'coreQuestions', 'core_questions')),
    keyConcepts: asStringArray(pick(row, 'keyConcepts', 'key_concepts')),
    methodOfReasoning: clip(pick(row, 'methodOfReasoning', 'method_of_reasoning'), PERSPECTIVE_LIMITS.maxTextFieldChars),
    limitations: asStringArray(pick(row, 'limitations', 'limitations')),
    commonMisconceptions: asStringArray(pick(row, 'commonMisconceptions', 'common_misconceptions')),
    internalDifferences: asStringArray(pick(row, 'internalDifferences', 'internal_differences')),
    relevantDisciplines: asStringArray(pick(row, 'relevantDisciplines', 'relevant_disciplines')),
    displayOrder: Number(pick(row, 'displayOrder', 'display_order') ?? 0),
    status: isExperienceStatus(status) ? status : 'draft',
  };
}

export function toPublicExperienceSummary(row: AnyRow) {
  const format = pick(row, 'format', 'format');
  const kc = pick(row, 'knowledgeClass', 'knowledge_class');
  const pClass = pick(row, 'perspectiveClass', 'perspective_class');
  const difficulty = pick(row, 'difficulty', 'difficulty');
  const status = pick(row, 'status', 'status');
  return {
    id: str(pick(row, 'id', 'id')),
    experienceKey: str(pick(row, 'experienceKey', 'experience_key')),
    title: clip(pick(row, 'title', 'title'), PERSPECTIVE_LIMITS.maxExperienceTitleChars),
    frameworkKey: str(pick(row, 'frameworkKey', 'framework_key')),
    format: isPerspectiveFormat(format) ? format : 'thought_experiment',
    knowledgeClass: isPerspectiveKnowledgeClass(kc) ? kc : 'philosophical',
    perspectiveClass: isPerspectiveClass(pClass) ? pClass : 'framework_primer',
    scopeNote: clip(pick(row, 'scopeNote', 'scope_note'), 600),
    traditionScope: clip(pick(row, 'traditionScope', 'tradition_scope'), 400),
    intellectualPurpose: clip(pick(row, 'intellectualPurpose', 'intellectual_purpose'), 800),
    primaryQuestion: clip(pick(row, 'primaryQuestion', 'primary_question'), 600),
    mainIdea: clip(pick(row, 'mainIdea', 'main_idea'), 1200),
    keyConcepts: asStringArray(pick(row, 'keyConcepts', 'key_concepts')),
    recommendationTags: asStringArray(pick(row, 'recommendationTags', 'recommendation_tags')),
    relatedExperienceKeys: asStringArray(pick(row, 'relatedExperienceKeys', 'related_experience_keys')),
    relatedSpecialistKeys: asStringArray(pick(row, 'relatedSpecialistKeys', 'related_specialist_keys')),
    relatedArtifactKeys: asStringArray(pick(row, 'relatedArtifactKeys', 'related_artifact_keys')),
    relatedCaseTitles: asStringArray(pick(row, 'relatedCaseTitles', 'related_case_titles')),
    estimatedMinutes: Number(pick(row, 'estimatedMinutes', 'estimated_minutes') ?? 10),
    difficulty: isDifficulty(difficulty) ? difficulty : 'introductory',
    displayOrder: Number(pick(row, 'displayOrder', 'display_order') ?? 0),
    status: isExperienceStatus(status) ? status : 'draft',
    // Provenance: every source is projected through the verified-only URL rule.
    supportingSources: toPublicSources(pick(row, 'supportingSources', 'supporting_sources')),
  };
}

/** Detail DTO adds long-form sections and bounded epistemic breakdown only. */
export function toPublicExperienceDetail(row: AnyRow) {
  return {
    ...toPublicExperienceSummary(row),
    introduction: clip(pick(row, 'introduction', 'introduction'), PERSPECTIVE_LIMITS.maxTextFieldChars),
    intellectualBackground: clip(pick(row, 'intellectualBackground', 'intellectual_background'), PERSPECTIVE_LIMITS.maxTextFieldChars),
    detailedExplanation: clip(pick(row, 'detailedExplanation', 'detailed_explanation'), PERSPECTIVE_LIMITS.maxTextFieldChars),
    sections: sections(pick(row, 'sections', 'sections')),
    historicalContext: clip(pick(row, 'historicalContext', 'historical_context'), PERSPECTIVE_LIMITS.maxTextFieldChars),
    epistemicBreakdown: boundedRecord(pick(row, 'epistemicBreakdown', 'epistemic_breakdown'), 12),
    limitations: asStringArray(pick(row, 'limitations', 'limitations')),
    counterarguments: asStringArray(pick(row, 'counterarguments', 'counterarguments')),
    commonMisconceptions: asStringArray(pick(row, 'commonMisconceptions', 'common_misconceptions')),
    reflectionQuestions: asStringArray(pick(row, 'reflectionQuestions', 'reflection_questions')),
    activities: asStringArray(pick(row, 'activities', 'activities')),
  };
}

export function toPublicReflection(row: AnyRow) {
  const kind = pick(row, 'reflectionKind', 'reflection_kind');
  return {
    id: str(pick(row, 'id', 'id')),
    experienceId: str(pick(row, 'experienceId', 'experience_id')),
    experienceKey: str(pick(row, 'experienceKey', 'experience_key')),
    userId: str(pick(row, 'userId', 'user_id')),
    investigationId: pick(row, 'investigationId', 'investigation_id') ?? null,
    promptIndex: Number(pick(row, 'promptIndex', 'prompt_index') ?? 0),
    prompt: clip(pick(row, 'prompt', 'prompt'), PERSPECTIVE_LIMITS.maxReflectionPromptChars),
    reflectionKind: isReflectionKind(kind) ? kind : 'reflection',
    response: clip(pick(row, 'response', 'response'), PERSPECTIVE_LIMITS.maxReflectionChars),
    createdAt: pick(row, 'createdAt', 'created_at'),
    updatedAt: pick(row, 'updatedAt', 'updated_at'),
  };
}

export function toPublicSuggestionState(row: AnyRow) {
  const status = pick(row, 'status', 'status');
  return {
    id: str(pick(row, 'id', 'id')),
    investigationId: str(pick(row, 'investigationId', 'investigation_id')),
    userId: str(pick(row, 'userId', 'user_id')),
    experienceKey: str(pick(row, 'experienceKey', 'experience_key')),
    reasonCode: str(pick(row, 'reasonCode', 'reason_code')),
    stateFingerprint: str(pick(row, 'stateFingerprint', 'state_fingerprint')),
    status: isSuggestionState(status) ? status : 'opened',
    createdAt: pick(row, 'createdAt', 'created_at'),
    updatedAt: pick(row, 'updatedAt', 'updated_at'),
  };
}
