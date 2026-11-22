import { validateSourceRecord } from './sourceValidation';
import type {
  LegalSource,
  SourceJurisdiction,
  SourceType,
  SourceVerificationStatus,
} from './types';

export const SOURCE_TYPES: readonly SourceType[] = ['statute', 'judgment', 'rule', 'commentary', 'summary'];
export const SOURCE_JURISDICTIONS: readonly SourceJurisdiction[] = ['India', 'Fictional'];

/** Field caps keep arbitrary save/UI input bounded and deterministic. */
export const MAX_SOURCE_FIELDS = {
  title: 200,
  sourceName: 200,
  citation: 300,
  provenance: 1000,
  sourceUrl: 500,
  excerpt: 1000,
  notes: 1000,
} as const;

/**
 * Patterns that look like a *specific* authoritative citation. A player-drafted source
 * containing one of these is recorded as a non-authoritative placeholder; it is never
 * silently promoted to a real citation.
 */
export const SPECIFIC_CITATION_PATTERNS: readonly RegExp[] = [
  /\bsection\s+\d+[a-z]?\b/i,
  /\barticle\s+\d+[a-z]?\b/i,
  /\bAIR\s+\d{4}\b/i,
  /\b\d{4}\s+(?:SCC|SCR|CLR)\b/i,
  /\b[A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+)*\s+v\.?\s+[A-Z][A-Za-z.]+/,
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function looksLikeSpecificCitation(text: string): boolean {
  return SPECIFIC_CITATION_PATTERNS.some((pattern) => pattern.test(text || ''));
}

function isPlaceholderText(source: { title: string; citation: string }): boolean {
  return /\bplaceholder\b/i.test(`${source.title} ${source.citation}`);
}

type ProvenanceShape = Pick<LegalSource, 'title' | 'citation' | 'provenance' | 'verificationStatus'> & {
  sourceUrl?: string;
};

export interface ProvenanceValidation {
  ok: boolean;
  reason?: string;
}

/**
 * Deterministic provenance check. Independent of how a record was loaded, so a forged or
 * partially migrated `verified` flag can never be trusted on its own.
 */
export function validateSourceProvenance(source: ProvenanceShape): ProvenanceValidation {
  if (!source.citation?.trim()) {
    return { ok: false, reason: 'A citation/identifier is required.' };
  }
  const hasTrace = Boolean(source.provenance?.trim() || source.sourceUrl?.trim());
  if (!hasTrace) {
    return { ok: false, reason: 'A provenance note or official source URL is required.' };
  }
  if (source.verificationStatus === 'verified') {
    if (isPlaceholderText(source)) {
      return { ok: false, reason: 'A placeholder source can never be verified or cited as authoritative.' };
    }
    if (looksLikeSpecificCitation(source.citation) && !source.sourceUrl?.trim()) {
      return { ok: false, reason: 'A specific-looking citation requires an official source URL before it may be treated as verified.' };
    }
  }
  return { ok: true };
}

/** True only when a source may be cited as authoritative in a draft submission. */
export function canCiteAsAuthoritative(source: LegalSource): boolean {
  return source.verificationStatus === 'verified'
    && !isPlaceholderText(source)
    && validateSourceProvenance(source).ok;
}

export interface SourceDraftInput {
  title: string;
  sourceName: string;
  citation: string;
  sourceType: SourceType | string;
  jurisdiction: SourceJurisdiction | string;
  provenance: string;
  sourceUrl?: string;
  effectiveDate?: string;
  excerpt?: string;
  notes?: string;
  /** UI checkbox: save this clearly as a stand-in. Never authoritative. */
  requestPlaceholder?: boolean;
  /** Exposed for deterministic tests/callers; `verified` is always rejected here. */
  requestedStatus?: SourceVerificationStatus;
}

export interface IntakeResult {
  ok: boolean;
  reason?: string;
  warnings: string[];
  source?: LegalSource;
}

function trimTo(value: string | undefined, cap: number): string {
  return (value ?? '').trim().slice(0, cap);
}

/**
 * Source Intake / Add Source. Creates only unverified or placeholder records. There is no
 * auto-verification path: the game never infers that a drafted source is real law.
 */
export function intakeSource(input: SourceDraftInput, id: string): IntakeResult {
  const warnings: string[] = [];
  const title = trimTo(input.title, MAX_SOURCE_FIELDS.title);
  const sourceName = trimTo(input.sourceName, MAX_SOURCE_FIELDS.sourceName);
  const citation = trimTo(input.citation, MAX_SOURCE_FIELDS.citation);
  const provenance = trimTo(input.provenance, MAX_SOURCE_FIELDS.provenance);
  const sourceUrl = trimTo(input.sourceUrl, MAX_SOURCE_FIELDS.sourceUrl);
  const effectiveDate = trimTo(input.effectiveDate, 10);
  const excerpt = trimTo(input.excerpt, MAX_SOURCE_FIELDS.excerpt);
  const notes = trimTo(input.notes, MAX_SOURCE_FIELDS.notes);

  if (!title) return { ok: false, reason: 'A source title is required.', warnings };
  if (!sourceName) return { ok: false, reason: 'A source name is required.', warnings };
  if (!citation) return { ok: false, reason: 'A citation/identifier is required.', warnings };
  if (!provenance) return { ok: false, reason: 'A provenance note is required (where did this record come from?).', warnings };
  if (!SOURCE_TYPES.includes(input.sourceType as SourceType)) {
    return { ok: false, reason: 'Select a valid source type.', warnings };
  }
  if (!SOURCE_JURISDICTIONS.includes(input.jurisdiction as SourceJurisdiction)) {
    return { ok: false, reason: 'Select a valid jurisdiction.', warnings };
  }
  if (effectiveDate && !ISO_DATE.test(effectiveDate)) {
    return { ok: false, reason: 'Effective date must use YYYY-MM-DD format.', warnings };
  }
  if (input.requestedStatus === 'verified') {
    return {
      ok: false,
      reason: 'Source Intake cannot create a verified source. A human reviewer must verify provenance separately before citation.',
      warnings,
    };
  }

  const specific = looksLikeSpecificCitation(citation);
  let verificationStatus: SourceVerificationStatus;
  if (input.requestPlaceholder || specific) {
    verificationStatus = 'placeholder';
    if (specific) {
      warnings.push('This citation looks like a specific provision or judgment reference. It was saved as a non-authoritative placeholder; verify the exact text against an official source before relying on it.');
    }
  } else {
    verificationStatus = 'unverified';
    warnings.push('Saved as unverified. It cannot be cited as authoritative until a human reviewer confirms its provenance.');
  }

  const source: LegalSource = {
    id,
    title,
    sourceName,
    citation,
    sourceType: input.sourceType as SourceType,
    jurisdiction: input.jurisdiction as SourceJurisdiction,
    verificationStatus,
    provenance,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(effectiveDate ? { effectiveDate } : {}),
    ...(excerpt ? { excerpt } : {}),
    ...(notes ? { notes } : {}),
    intake: 'player-draft',
  };
  return { ok: true, warnings, source };
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  source?: LegalSource;
}

/**
 * The human/content-owner verification step, kept separate from player intake so the game
 * never auto-verifies. Requires a named reviewer and traceable provenance.
 */
export function markSourceVerified(
  source: LegalSource,
  reviewer: string,
  verificationDate?: string,
): VerifyResult {
  if (source.verificationStatus === 'placeholder') {
    return { ok: false, reason: 'A placeholder can never be marked verified. Intake a new source with official provenance instead.' };
  }
  const reviewerName = (reviewer ?? '').trim();
  if (!reviewerName) {
    return { ok: false, reason: 'A named human reviewer is required to verify a source.' };
  }
  if (verificationDate && !ISO_DATE.test(verificationDate)) {
    return { ok: false, reason: 'Verification date must use YYYY-MM-DD format.' };
  }
  const candidate: LegalSource = {
    ...source,
    verificationStatus: 'verified',
    verifiedBy: reviewerName,
    ...(verificationDate ? { verificationDate } : {}),
  };
  const provenance = validateSourceProvenance(candidate);
  if (!provenance.ok) return { ok: false, reason: provenance.reason };
  // The content-owner gate is stricter: a named reviewer, a dated review, traceable
  // provenance and (for real authority/specific citations) an official URL plus a
  // reviewed identifier are all required. No specific-looking citation is auto-verified.
  const strict = validateSourceRecord(candidate);
  if (!strict.ok) {
    return { ok: false, reason: strict.errors.map((error) => error.message).join(' ') };
  }
  return { ok: true, source: candidate };
}
