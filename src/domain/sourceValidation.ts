import { looksLikeSpecificCitation, MAX_SOURCE_FIELDS, SOURCE_JURISDICTIONS, SOURCE_TYPES } from './legalSources';
import type { LegalSource, SourceVerificationStatus } from './types';

/**
 * Deterministic, offline validation of source records for the content-owner ingestion
 * workflow (D-005/D-011). This is deliberately stricter than the lightweight game-time
 * provenance check in `legalSources.ts`: it is the gate a human reviewer must pass before a
 * record enters the corpus. It never invents legal text and never verifies anything on its
 * own — it only checks that the required human attestation and traceable provenance exist.
 */

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  /** Stable machine-readable code, suitable for CI output and tests. */
  code: string;
  /** Clear, actionable explanation. */
  message: string;
  field?: string;
  severity: ValidationSeverity;
}

export interface SourceValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface SourceValidationOptions {
  /**
   * Citation identifiers that a human content owner has already checked against an official
   * publication. Empty by default. This is the ONLY route by which a specific-looking
   * citation may be verified, and it must be populated by the documented review workflow —
   * never by the game, by intake, or by an AI stub.
   */
  reviewedOfficialIdentifiers?: readonly string[];
}

export interface BatchRecordResult extends SourceValidationResult {
  index: number;
  id?: string;
}

export interface BatchValidationResult {
  ok: boolean;
  total: number;
  invalid: number;
  /** IDs that appear on more than one record (normalized by trimming). */
  duplicateIds: string[];
  results: BatchRecordResult[];
}

const VERIFICATION_STATUSES: readonly SourceVerificationStatus[] = ['verified', 'unverified', 'placeholder'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PLACEHOLDER_WORD = /\bplaceholder\b/i;
/**
 * A record that labels itself a template/example/sample is a shape demonstration, never law.
 * It may exist as a non-authoritative draft, but it can never carry a verified status.
 */
const NON_AUTHORITATIVE_MARKER = /\b(?:template|example|sample|tbd|todo|do\s+not\s+use|not\s+for\s+use)\b/i;
/** Names that are not a named human reviewer and must never count as a sign-off. */
const NON_HUMAN_REVIEWER = /\b(?:tbd|todo|placeholder|automatic|auto|system|n\/?a|none|unknown)\b/i;
/** Uppercase-only: a human may legitimately be named "Ai", but never labeled "AI". */
const AI_REVIEWER = /\bAI\b/;
/** Real-world authority needs an official source URL; internal fictional summaries do not. */
const REAL_AUTHORITY_TYPES: ReadonlySet<string> = new Set(['statute', 'judgment', 'rule']);

/** Stages of the offline intake/import flow documented in docs/legal-corpus/ACQUISITION_CHECKLIST.md. */
export const CORPUS_MANIFEST_STAGES = ['unverified', 'reviewed', 'promoted'] as const;
/** Rights states: no rights to reproduce, rights being checked, or rights confirmed by a human. */
export const CORPUS_RIGHTS_STATUSES = ['none', 'pending', 'cleared'] as const;

/**
 * Corpus kinds supported by the offline manifest validator.
 * - `internal-educational-summary`: original non-authoritative teaching summaries (no real law fabricated).
 * - `official-source-metadata`: metadata records pointing to official publications (India Code, etc.).
 *   Records may reference real official Acts/publications by name/identifier and official URL, but must
 *   not reproduce or fabricate statutory/procedural provision text. Human review and provenance are required.
 */
export const INTERNAL_EDUCATIONAL_CATEGORY = 'internal-educational-summary';
export const OFFICIAL_SOURCE_METADATA_CATEGORY = 'official-source-metadata';
/** Declaration required of an internal educational corpus/record: it is never legal authority. */
export const NON_AUTHORITATIVE_DECLARATION = 'non-authoritative';
/** Supported corpus kinds. */
export const CORPUS_KINDS = [INTERNAL_EDUCATIONAL_CATEGORY, OFFICIAL_SOURCE_METADATA_CATEGORY] as const;

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value.trim());
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function issue(code: string, message: string, field?: string, severity: ValidationSeverity = 'error'): ValidationIssue {
  return field ? { code, message, field, severity } : { code, message, severity };
}

/** Text of selected string fields, used only to detect self-labelled stand-ins. */
function markerText(record: Record<string, unknown>, fields: readonly string[]): string {
  return fields.map((field) => (hasText(record[field]) ? String(record[field]) : '')).join(' ');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Validate a single source record. Accepts unknown input so untrusted corpus JSON is safe. */
export function validateSourceRecord(source: unknown, options: SourceValidationOptions = {}): SourceValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return {
      ok: false,
      errors: [issue('INVALID_RECORD', 'Each source must be a JSON object with provenance fields.')],
      warnings,
    };
  }

  const record = source as Record<string, unknown>;

  const required: Array<[string, string, string]> = [
    ['id', 'MISSING_ID', 'A stable record id is required.'],
    ['title', 'MISSING_TITLE', 'A source title is required.'],
    ['sourceName', 'MISSING_SOURCE_NAME', 'The official source name is required.'],
    ['citation', 'MISSING_CITATION', 'A citation or stable identifier is required. Never invent one.'],
    ['provenance', 'MISSING_PROVENANCE', 'A provenance note describing where the record came from is required.'],
  ];
  for (const [field, code, message] of required) {
    if (!hasText(record[field])) {
      errors.push(issue(code, message, field));
    }
  }

  if (hasText(record.sourceType) && !SOURCE_TYPES.includes(record.sourceType as LegalSource['sourceType'])) {
    errors.push(issue('INVALID_SOURCE_TYPE', `Source type must be one of: ${SOURCE_TYPES.join(', ')}.`, 'sourceType'));
  }
  if (
    hasText(record.jurisdiction) &&
    !SOURCE_JURISDICTIONS.includes(record.jurisdiction as LegalSource['jurisdiction'])
  ) {
    errors.push(
      issue('INVALID_JURISDICTION', `Jurisdiction must be one of: ${SOURCE_JURISDICTIONS.join(', ')}.`, 'jurisdiction'),
    );
  }
  if (
    hasText(record.verificationStatus) &&
    !VERIFICATION_STATUSES.includes(record.verificationStatus as SourceVerificationStatus)
  ) {
    errors.push(
      issue(
        'INVALID_VERIFICATION_STATUS',
        'Verification status must be verified, unverified or placeholder.',
        'verificationStatus',
      ),
    );
  }
  if (record.intake !== undefined && record.intake !== 'seed' && record.intake !== 'player-draft') {
    errors.push(issue('INVALID_INTAKE', "Intake must be 'seed' or 'player-draft' when present.", 'intake'));
  }

  // Optional honesty markers. Validated when present for backward compatibility.
  const category = record.category;
  if (
    category !== undefined &&
    category !== null &&
    category !== INTERNAL_EDUCATIONAL_CATEGORY &&
    category !== OFFICIAL_SOURCE_METADATA_CATEGORY
  ) {
    errors.push(
      issue(
        'INVALID_SOURCE_CATEGORY',
        `category must be "${INTERNAL_EDUCATIONAL_CATEGORY}" or "${OFFICIAL_SOURCE_METADATA_CATEGORY}" when present.`,
        'category',
      ),
    );
  }
  const authority = record.authority;
  if (
    authority !== undefined &&
    authority !== null &&
    authority !== NON_AUTHORITATIVE_DECLARATION &&
    authority !== 'official-publication-metadata'
  ) {
    errors.push(
      issue(
        'INVALID_AUTHORITY_DECLARATION',
        `authority must be "${NON_AUTHORITATIVE_DECLARATION}" or "official-publication-metadata" when present.`,
        'authority',
      ),
    );
  }
  const disclaimer = record.disclaimer;
  if (disclaimer !== undefined && disclaimer !== null && !hasText(disclaimer)) {
    errors.push(issue('INVALID_DISCLAIMER', 'disclaimer must be a non-empty string when present.', 'disclaimer'));
  }
  const assertsRealCitation = record.assertsRealCitation;
  if (assertsRealCitation !== undefined && assertsRealCitation !== null && typeof assertsRealCitation !== 'boolean') {
    errors.push(
      issue('INVALID_CITATION_ASSERTION', 'assertsRealCitation must be a boolean when present.', 'assertsRealCitation'),
    );
  }
  const isInternalEducational = category === INTERNAL_EDUCATIONAL_CATEGORY;
  const isOfficialMetadata = category === OFFICIAL_SOURCE_METADATA_CATEGORY;
  if (isInternalEducational && assertsRealCitation === true) {
    errors.push(
      issue(
        'INVALID_CITATION_ASSERTION',
        'assertsRealCitation must be false for an internal educational summary.',
        'assertsRealCitation',
      ),
    );
  }
  if (isOfficialMetadata && assertsRealCitation === false) {
    errors.push(
      issue(
        'INVALID_CITATION_ASSERTION',
        'assertsRealCitation must be true for an official-source-metadata record that references a real official publication.',
        'assertsRealCitation',
      ),
    );
  }

  if (record.sourceUrl !== undefined && record.sourceUrl !== '' && !isHttpUrl(String(record.sourceUrl))) {
    errors.push(issue('INVALID_SOURCE_URL', 'Source URL must be a valid http:// or https:// address.', 'sourceUrl'));
  }
  for (const [field, code] of [
    ['effectiveDate', 'INVALID_EFFECTIVE_DATE'],
    ['verificationDate', 'INVALID_VERIFICATION_DATE'],
  ] as const) {
    const value = record[field];
    if (value !== undefined && value !== '' && (!hasText(value) || !isIsoDate(value))) {
      errors.push(issue(code, `${field} must use YYYY-MM-DD format.`, field));
    }
  }

  for (const [field, cap] of Object.entries(MAX_SOURCE_FIELDS)) {
    const value = record[field];
    if (typeof value === 'string' && value.length > cap) {
      warnings.push(
        issue(
          'FIELD_TOO_LONG',
          `${field} exceeds the ${cap}-character field cap and would be truncated by the app.`,
          field,
          'warning',
        ),
      );
    }
  }

  const identityText = markerText(record, ['title', 'sourceName', 'citation']);
  const placeholderMarked = PLACEHOLDER_WORD.test(identityText);
  const nonAuthoritativeMarked = NON_AUTHORITATIVE_MARKER.test(identityText);

  if (record.verificationStatus === 'verified') {
    // `provenance` and `citation` are already required above for every record; for a
    // verified record those codes are the "identifier/provenance" blockers.
    if (placeholderMarked) {
      errors.push(
        issue(
          'PLACEHOLDER_CANNOT_BE_VERIFIED',
          'A record labeled placeholder is a stand-in and can never be marked verified.',
          'verificationStatus',
        ),
      );
    }
    if (nonAuthoritativeMarked) {
      errors.push(
        issue(
          'TEMPLATE_OR_EXAMPLE_CANNOT_BE_VERIFIED',
          'A record labeled template/example/sample (or TBD/do-not-use) is a non-authoritative shape example and can never be marked verified.',
          'verificationStatus',
        ),
      );
    }
    if (!hasText(record.verifiedBy)) {
      errors.push(
        issue(
          'VERIFIED_WITHOUT_REVIEWER',
          'A verified record must name the human/content owner who reviewed it (verifiedBy).',
          'verifiedBy',
        ),
      );
    } else if (NON_HUMAN_REVIEWER.test(String(record.verifiedBy)) || AI_REVIEWER.test(String(record.verifiedBy))) {
      errors.push(
        issue(
          'NON_HUMAN_REVIEWER',
          'verifiedBy must name a human/content owner; generic values such as TBD, auto, AI, system or unknown are not a sign-off.',
          'verifiedBy',
        ),
      );
    }
    if (!hasText(record.verificationDate)) {
      errors.push(
        issue(
          'VERIFIED_WITHOUT_DATE',
          'A verified record must record the review date (verificationDate, YYYY-MM-DD).',
          'verificationDate',
        ),
      );
    }

    const specific = hasText(record.citation) && looksLikeSpecificCitation(record.citation);
    const realAuthority =
      record.jurisdiction === 'India' && hasText(record.sourceType) && REAL_AUTHORITY_TYPES.has(record.sourceType);
    const needsOfficialUrl = specific || realAuthority;

    if (needsOfficialUrl && !hasText(record.sourceUrl)) {
      errors.push(
        issue(
          'VERIFIED_WITHOUT_OFFICIAL_URL',
          'A verified real-world legal authority or specific-looking citation requires an official publisher URL.',
          'sourceUrl',
        ),
      );
    } else if (!needsOfficialUrl && !hasText(record.sourceUrl) && !isInternalEducational) {
      // An explicitly marked internal educational summary has no official text to point at by
      // design, so an absent URL is expected rather than a warning. Unmarked summaries keep the
      // existing warning so real-world authority is not silently accepted without a trace.
      warnings.push(
        issue(
          'NO_OFFICIAL_URL',
          'No official URL recorded. Acceptable for internal/fictional summaries; required before treating real-world authority as verified.',
          'sourceUrl',
          'warning',
        ),
      );
    }

    if (specific) {
      const reviewed = (options.reviewedOfficialIdentifiers ?? []).map(normalizeIdentifier);
      if (!reviewed.includes(normalizeIdentifier(record.citation as string))) {
        errors.push(
          issue(
            'UNREVIEWED_SPECIFIC_CITATION',
            'This citation looks like a specific provision, reporter reference or case name. It may not be marked verified unless a human content owner has checked the exact text against an official publication and added the identifier to the reviewed allowlist. See docs/LEGAL_SOURCE_VERIFICATION.md.',
            'citation',
          ),
        );
      }
    }

    if (record.intake === 'player-draft') {
      warnings.push(
        issue(
          'PLAYER_DRAFT_VERIFIED_BY_HUMAN',
          'This record began as a player draft; confirm a human reviewer checked it against the official source.',
          'verificationStatus',
          'warning',
        ),
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Validate a whole corpus file in one deterministic pass, preserving record positions. */
export function validateSourceRecords(input: unknown, options: SourceValidationOptions = {}): BatchValidationResult {
  const records: unknown[] = Array.isArray(input) ? input : input === undefined ? [] : [input];
  const recordId = (record: unknown): string | undefined => {
    const raw = isObject(record) ? record.id : undefined;
    return hasText(raw) ? (raw as string).trim() : undefined;
  };
  const ids = records.map(recordId);
  const counts = new Map<string, number>();
  const firstIndex = new Map<string, number>();
  ids.forEach((id, index) => {
    if (!id) return;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (!firstIndex.has(id)) firstIndex.set(id, index);
  });
  const duplicateIds = [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);

  const results: BatchRecordResult[] = records.map((record, index) => {
    const result = validateSourceRecord(record, options);
    const id = ids[index];
    const errors = [...result.errors];
    const warnings = [...result.warnings];
    // Keep the first occurrence; every later reuse of the same id is a hard blocker so a
    // corpus cannot silently overwrite or shadow one record with another.
    if (id && duplicateIds.includes(id) && index !== firstIndex.get(id)) {
      errors.push(
        issue(
          'DUPLICATE_SOURCE_ID',
          `Duplicate source id "${id}". Ids must be unique within a corpus; the first occurrence is sources[${firstIndex.get(id)}].`,
          'id',
        ),
      );
    }
    return {
      index,
      ...(id ? { id } : {}),
      ok: errors.length === 0,
      errors,
      warnings,
    };
  });
  return {
    ok: results.every((result) => result.ok),
    total: results.length,
    invalid: results.filter((result) => !result.ok).length,
    duplicateIds,
    results,
  };
}

/**
 * Corpus manifest support for the offline intake pipeline documented in
 * `docs/legal-corpus/README.md` and `docs/legal-corpus/ACQUISITION_CHECKLIST.md`. A manifest is
 * the container a human content owner uses to present a batch of source records for validation:
 * it carries the pipeline metadata (schema version, internal corpus id, owner/status, reviewed
 * allowlist, acquisition/sign-off/rights/version/staging attestations) plus the `sources` array
 * validated by `validateSourceRecords`.
 *
 * This function is deliberately read-only and deterministic. It verifies only that the
 * required human attestation/metadata exists and is well formed; it never invents legal text,
 * never verifies a source on its own, and rejects anything explicitly marked as a template so
 * that a shape/example file can never be mistaken for a real corpus. All pipeline metadata is
 * optional for backward compatibility; a present-but-malformed field is an error, while an
 * absent/incomplete attestation on a gated (in-review/approved) corpus is a warning.
 */
export const CORPUS_MANIFEST_SCHEMA_VERSION = 1;
export const CORPUS_MANIFEST_STATUSES = ['blocked', 'draft', 'in-review', 'approved'] as const;

export interface CorpusManifestResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Source-level results, preserved with record positions for clear reporting. */
  sources?: BatchValidationResult;
  /** IDs repeated across sources[] (blockers, reported on the later records). */
  duplicateIds?: string[];
  schemaVersion?: number;
  status?: string;
  /** Declared corpus kind, when present (e.g. internal-educational-summary). */
  corpusKind?: string;
}

/** Read an optional nested metadata object; a present non-object is always a hard error. */
function optionalManifestObject(
  manifest: Record<string, unknown>,
  field: string,
  code: string,
  errors: ValidationIssue[],
): Record<string, unknown> | undefined {
  const value = manifest[field];
  if (value === undefined || value === null) return undefined;
  if (!isObject(value)) {
    errors.push(issue(code, `${field} must be an object when present.`, field));
    return undefined;
  }
  return value;
}

function optionalString(
  parent: Record<string, unknown>,
  field: string,
  parentName: string,
  code: string,
  errors: ValidationIssue[],
): string | undefined {
  const value = parent[field];
  if (value === undefined || value === null) return undefined;
  if (!hasText(value)) {
    errors.push(
      issue(code, `${parentName}.${field} must be a non-empty string when present.`, `${parentName}.${field}`),
    );
    return undefined;
  }
  return String(value);
}

function optionalDate(
  parent: Record<string, unknown>,
  field: string,
  parentName: string,
  code: string,
  errors: ValidationIssue[],
): string | undefined {
  const value = parent[field];
  if (value === undefined || value === null || value === '') return undefined;
  if (!hasText(value) || !isIsoDate(value)) {
    errors.push(issue(code, `${parentName}.${field} must use YYYY-MM-DD format.`, `${parentName}.${field}`));
    return undefined;
  }
  return String(value).trim();
}

function optionalBoolean(
  parent: Record<string, unknown>,
  field: string,
  parentName: string,
  code: string,
  errors: ValidationIssue[],
): boolean | undefined {
  const value = parent[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') {
    errors.push(issue(code, `${parentName}.${field} must be a boolean when present.`, `${parentName}.${field}`));
    return undefined;
  }
  return value;
}

function optionalStringArray(
  parent: Record<string, unknown>,
  field: string,
  parentName: string,
  code: string,
  errors: ValidationIssue[],
): void {
  const value = parent[field];
  if (value === undefined || value === null) return;
  if (!Array.isArray(value) || !value.every(hasText)) {
    errors.push(
      issue(
        code,
        `${parentName}.${field} must be an array of non-empty strings when present.`,
        `${parentName}.${field}`,
      ),
    );
  }
}

/**
 * Validate the optional pipeline metadata defined in the acquisition checklist. Structural
 * errors are hard blockers; incomplete-but-well-formed attestations on an approved/in-review
 * corpus are warnings so historical manifests remain readable (backward compatible).
 */
function validateManifestMetadata(
  manifest: Record<string, unknown>,
  status: string | undefined,
  reviewedIds: string[],
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): void {
  const gated = status === 'in-review' || status === 'approved';

  if (manifest.provenanceNote !== undefined && manifest.provenanceNote !== null && !hasText(manifest.provenanceNote)) {
    errors.push(
      issue('INVALID_CORPUS_PROVENANCE', 'provenanceNote must be a non-empty string when present.', 'provenanceNote'),
    );
  }

  // Acquisition checklist: did a human obtain exact text from an acceptable official source?
  const acquisition = optionalManifestObject(manifest, 'acquisition', 'INVALID_ACQUISITION', errors);
  if (acquisition) {
    const completed = optionalBoolean(
      acquisition,
      'checklistCompleted',
      'acquisition',
      'INVALID_ACQUISITION_CHECKLIST',
      errors,
    );
    optionalBoolean(acquisition, 'reviewerAssigned', 'acquisition', 'INVALID_ACQUISITION_CHECKLIST', errors);
    optionalStringArray(acquisition, 'officialSources', 'acquisition', 'INVALID_ACQUISITION_SOURCES', errors);
    optionalDate(acquisition, 'retrievalDate', 'acquisition', 'INVALID_ACQUISITION_DATE', errors);
    if (completed !== true) {
      warnings.push(
        issue(
          'ACQUISITION_CHECKLIST_INCOMPLETE',
          'The source-acquisition checklist is not marked complete; see docs/legal-corpus/ACQUISITION_CHECKLIST.md.',
          'acquisition.checklistCompleted',
          'warning',
        ),
      );
    }
  } else if (gated) {
    warnings.push(
      issue(
        'NO_ACQUISITION_RECORD',
        'No acquisition record is attached to a gated corpus; record publisher, exact text and retrieval date/version.',
        'acquisition',
        'warning',
      ),
    );
  }

  // Reviewer sign-off: a named human and a date, never an AI/auto/TBD value.
  const signoff = optionalManifestObject(manifest, 'signoff', 'INVALID_SIGNOFF', errors);
  if (signoff) {
    const reviewer = optionalString(signoff, 'reviewer', 'signoff', 'INVALID_SIGNOFF_REVIEWER', errors);
    const date = optionalDate(signoff, 'date', 'signoff', 'INVALID_SIGNOFF_DATE', errors);
    optionalString(signoff, 'scope', 'signoff', 'INVALID_SIGNOFF_SCOPE', errors);
    optionalString(signoff, 'notes', 'signoff', 'INVALID_SIGNOFF_NOTES', errors);
    if (!reviewer || !date) {
      errors.push(
        issue(
          'INCOMPLETE_SIGNOFF',
          'A signoff block must name a human reviewer and date before it can be treated as a review.',
          'signoff',
        ),
      );
    } else if (NON_HUMAN_REVIEWER.test(reviewer) || AI_REVIEWER.test(reviewer)) {
      errors.push(
        issue(
          'NON_HUMAN_SIGNOFF_REVIEWER',
          'signoff.reviewer must be a named human/content owner, not TBD, auto, AI, system or unknown.',
          'signoff.reviewer',
        ),
      );
    }
  } else if (gated) {
    warnings.push(
      issue(
        'MISSING_SIGNOFF',
        'A gated corpus must still carry a named human signoff (signoff.reviewer and signoff.date).',
        'signoff',
        'warning',
      ),
    );
  }

  // Rights/licensing: 'cleared' is an explicit claim that needs a basis and a human confirmer.
  let rightsStatus: string | undefined;
  const rights = optionalManifestObject(manifest, 'rights', 'INVALID_RIGHTS', errors);
  if (rights) {
    const rawStatus = rights.status;
    if (rawStatus === undefined || rawStatus === null) {
      warnings.push(
        issue(
          'RIGHTS_STATUS_MISSING',
          'rights.status is unset; record whether reproduction rights exist.',
          'rights.status',
          'warning',
        ),
      );
    } else if (!hasText(rawStatus) || !(CORPUS_RIGHTS_STATUSES as readonly string[]).includes(String(rawStatus))) {
      errors.push(
        issue(
          'INVALID_RIGHTS_STATUS',
          `rights.status must be one of: ${CORPUS_RIGHTS_STATUSES.join(', ')}.`,
          'rights.status',
        ),
      );
    } else {
      rightsStatus = String(rawStatus);
    }
    const basis = optionalString(rights, 'basis', 'rights', 'INVALID_RIGHTS_BASIS', errors);
    const confirmedBy = optionalString(rights, 'confirmedBy', 'rights', 'INVALID_RIGHTS_CONFIRMER', errors);
    optionalString(rights, 'license', 'rights', 'INVALID_RIGHTS_LICENSE', errors);
    optionalDate(rights, 'confirmedDate', 'rights', 'INVALID_RIGHTS_DATE', errors);
    if (rightsStatus === 'cleared' && (!basis || !confirmedBy)) {
      errors.push(
        issue(
          'RIGHTS_CLEARANCE_INCOMPLETE',
          'rights.status "cleared" requires a rights.basis (official publication/license) and a rights.confirmedBy human.',
          'rights',
        ),
      );
    }
  }
  if (gated && rightsStatus !== 'cleared') {
    warnings.push(
      issue(
        'RIGHTS_NOT_CLEARED',
        'Reproduction rights are not recorded as cleared for this gated corpus.',
        'rights.status',
        'warning',
      ),
    );
  }

  // Version / effective-date policy note (the formal policy is still an open decision).
  const versionPolicy = optionalManifestObject(manifest, 'versionPolicy', 'INVALID_VERSION_POLICY', errors);
  if (versionPolicy) {
    optionalString(versionPolicy, 'effectiveDatePolicy', 'versionPolicy', 'INVALID_VERSION_POLICY', errors);
    optionalDate(versionPolicy, 'asOf', 'versionPolicy', 'INVALID_VERSION_POLICY_AS_OF', errors);
    optionalString(versionPolicy, 'note', 'versionPolicy', 'INVALID_VERSION_POLICY', errors);
    optionalString(versionPolicy, 'supersedes', 'versionPolicy', 'INVALID_VERSION_POLICY', errors);
  } else if (status === 'approved') {
    warnings.push(
      issue(
        'NO_VERSION_POLICY',
        'No version/effective-date policy note is attached to an approved corpus (D-011 policy is still open).',
        'versionPolicy',
        'warning',
      ),
    );
  }

  // Allowlist workflow: who maintains it, and when they last reviewed the identifiers.
  const allowlistPolicy = optionalManifestObject(manifest, 'allowlistPolicy', 'INVALID_ALLOWLIST_POLICY', errors);
  if (allowlistPolicy) {
    optionalString(allowlistPolicy, 'maintainedBy', 'allowlistPolicy', 'INVALID_ALLOWLIST_POLICY', errors);
    optionalDate(allowlistPolicy, 'lastReviewed', 'allowlistPolicy', 'INVALID_ALLOWLIST_POLICY_DATE', errors);
    optionalString(allowlistPolicy, 'policyNote', 'allowlistPolicy', 'INVALID_ALLOWLIST_POLICY', errors);
  }
  if (reviewedIds.length > 0 && !allowlistPolicy) {
    warnings.push(
      issue(
        'REVIEWED_IDS_WITHOUT_ALLOWLIST_POLICY',
        'Reviewed identifiers are present but no allowlist policy records who maintains them.',
        'allowlistPolicy',
        'warning',
      ),
    );
  }

  // Import staging flow: unverified -> reviewed -> promoted. Warn on mismatches with status.
  let stage: string | undefined;
  const staging = optionalManifestObject(manifest, 'staging', 'INVALID_STAGING', errors);
  if (staging) {
    const rawStage = staging.stage;
    if (!hasText(rawStage)) {
      errors.push(
        issue('MISSING_STAGING_STAGE', 'staging.stage is required when a staging block is present.', 'staging.stage'),
      );
    } else if (!(CORPUS_MANIFEST_STAGES as readonly string[]).includes(String(rawStage))) {
      errors.push(
        issue(
          'INVALID_STAGING_STAGE',
          `staging.stage must be one of: ${CORPUS_MANIFEST_STAGES.join(', ')}.`,
          'staging.stage',
        ),
      );
    } else {
      stage = String(rawStage);
    }
    optionalString(staging, 'unverifiedFolder', 'staging', 'INVALID_STAGING', errors);
    optionalString(staging, 'reviewedFolder', 'staging', 'INVALID_STAGING', errors);
    optionalString(staging, 'importNote', 'staging', 'INVALID_STAGING', errors);
  } else if (gated) {
    warnings.push(
      issue('NO_STAGING_RECORD', 'No import staging record is attached to this gated corpus.', 'staging', 'warning'),
    );
  }
  if (stage === 'promoted' && status !== 'approved') {
    warnings.push(
      issue('STAGE_STATUS_MISMATCH', 'staging.stage "promoted" expects status "approved".', 'staging.stage', 'warning'),
    );
  }
  const sources = Array.isArray(manifest.sources) ? manifest.sources : [];
  const hasVerifiedSource = sources.some((source) => isObject(source) && source.verificationStatus === 'verified');
  if (stage === 'unverified' && hasVerifiedSource) {
    warnings.push(
      issue(
        'UNSTAGED_VERIFIED_SOURCES',
        'Records are still staged as "unverified" but the corpus contains verified sources.',
        'staging.stage',
        'warning',
      ),
    );
  }

  // A reviewed allowlist entry that matches no source is stale; it must not silently grant
  // authority to a future citation that was never checked by the named reviewer.
  if (reviewedIds.length > 0) {
    const cited = new Set<string>();
    for (const source of sources) {
      if (isObject(source) && hasText(source.citation)) cited.add(normalizeIdentifier(String(source.citation)));
    }
    for (const id of reviewedIds) {
      if (!cited.has(normalizeIdentifier(id))) {
        warnings.push(
          issue(
            'UNUSED_REVIEWED_IDENTIFIER',
            `Reviewed identifier "${id}" does not match any source citation in this corpus. Remove it or add the record a human actually reviewed.`,
            'reviewedOfficialIdentifiers',
            'warning',
          ),
        );
      }
    }
  }
}

export function validateCorpusManifest(input: unknown, options: SourceValidationOptions = {}): CorpusManifestResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      errors: [issue('INVALID_MANIFEST', 'A corpus manifest must be a JSON object (see docs/legal-corpus/README.md).')],
      warnings,
    };
  }

  const manifest = input as Record<string, unknown>;

  // A shape/example file must never be ingestible as a real corpus, even if its example
  // records happen to pass the ordinary source gate.
  if (manifest.template) {
    errors.push(
      issue(
        'MANIFEST_IS_TEMPLATE',
        'This is a TEMPLATE, not a legal corpus. Never ingest a template; create a real manifest only through the human review workflow in docs/LEGAL_SOURCE_VERIFICATION.md.',
        'template',
      ),
    );
  }

  const schemaVersion = manifest.schemaVersion;
  if (schemaVersion === undefined) {
    errors.push(issue('MISSING_SCHEMA_VERSION', 'A corpus manifest requires a schemaVersion.', 'schemaVersion'));
  } else if (schemaVersion !== CORPUS_MANIFEST_SCHEMA_VERSION) {
    errors.push(
      issue(
        'UNSUPPORTED_SCHEMA_VERSION',
        `Unsupported schemaVersion ${String(schemaVersion)}; this tool supports ${CORPUS_MANIFEST_SCHEMA_VERSION}.`,
        'schemaVersion',
      ),
    );
  }

  if (!hasText(manifest.corpusId)) {
    errors.push(
      issue('MISSING_CORPUS_ID', 'A stable internal corpusId is required (not a legal citation).', 'corpusId'),
    );
  }

  const status = hasText(manifest.status) ? manifest.status : undefined;
  if (status !== undefined && !(CORPUS_MANIFEST_STATUSES as readonly string[]).includes(status)) {
    errors.push(
      issue(
        'INVALID_MANIFEST_STATUS',
        `Manifest status must be one of: ${CORPUS_MANIFEST_STATUSES.join(', ')}.`,
        'status',
      ),
    );
  }

  if (manifest.owner !== undefined && manifest.owner !== null && !hasText(manifest.owner)) {
    errors.push(issue('INVALID_OWNER', 'owner must be null or the name of the human content owner.', 'owner'));
  }
  if (manifest.intakeFolder !== undefined && !hasText(manifest.intakeFolder)) {
    errors.push(
      issue('INVALID_INTAKE_FOLDER', 'intakeFolder must be a non-empty path string when present.', 'intakeFolder'),
    );
  }

  // Optional corpus-level honesty markers (see the internal educational manifest shipped in
  // docs/legal-corpus/manifest.json). They are validated when present so a corpus cannot claim
  // to be non-authoritative while asserting real citations, and remain optional for older files.
  const corpusKind = manifest.corpusKind;
  if (corpusKind !== undefined && corpusKind !== null) {
    if (typeof corpusKind !== 'string' || !(CORPUS_KINDS as readonly string[]).includes(corpusKind)) {
      errors.push(
        issue(
          'INVALID_CORPUS_KIND',
          `Unsupported corpusKind; supported kinds: ${CORPUS_KINDS.join(', ')}.`,
          'corpusKind',
        ),
      );
    }
  }
  const corpusAuthority = manifest.authority;
  if (corpusAuthority !== undefined && corpusAuthority !== null) {
    const allowedAuthority =
      corpusKind === OFFICIAL_SOURCE_METADATA_CATEGORY
        ? ['official-publication-metadata', NON_AUTHORITATIVE_DECLARATION]
        : [NON_AUTHORITATIVE_DECLARATION];
    if (!allowedAuthority.includes(String(corpusAuthority))) {
      errors.push(
        issue(
          'INVALID_AUTHORITY_DECLARATION',
          `authority must be one of ${allowedAuthority.join(', ')} for this corpus kind.`,
          'authority',
        ),
      );
    }
  }
  const corpusDisclaimer = manifest.disclaimer;
  if (corpusDisclaimer !== undefined && corpusDisclaimer !== null && !hasText(corpusDisclaimer)) {
    errors.push(issue('INVALID_DISCLAIMER', 'disclaimer must be a non-empty string when present.', 'disclaimer'));
  }
  if (manifest.assertsRealCitation !== undefined && manifest.assertsRealCitation !== null) {
    if (typeof manifest.assertsRealCitation !== 'boolean') {
      errors.push(
        issue(
          'INVALID_CITATION_ASSERTION',
          'assertsRealCitation must be a boolean when present.',
          'assertsRealCitation',
        ),
      );
    } else if (corpusKind === INTERNAL_EDUCATIONAL_CATEGORY && manifest.assertsRealCitation !== false) {
      errors.push(
        issue(
          'INVALID_CITATION_ASSERTION',
          'assertsRealCitation must be false for an internal educational corpus.',
          'assertsRealCitation',
        ),
      );
    } else if (corpusKind === OFFICIAL_SOURCE_METADATA_CATEGORY && manifest.assertsRealCitation !== true) {
      errors.push(
        issue(
          'INVALID_CITATION_ASSERTION',
          'assertsRealCitation must be true for an official-source-metadata corpus (it references real official publications by metadata only).',
          'assertsRealCitation',
        ),
      );
    }
  }

  let reviewed: string[] = [];
  if (manifest.reviewedOfficialIdentifiers !== undefined) {
    if (!Array.isArray(manifest.reviewedOfficialIdentifiers)) {
      errors.push(
        issue(
          'INVALID_REVIEWED_IDENTIFIERS',
          'reviewedOfficialIdentifiers must be an array of strings.',
          'reviewedOfficialIdentifiers',
        ),
      );
    } else if (!manifest.reviewedOfficialIdentifiers.every(hasText)) {
      errors.push(
        issue(
          'INVALID_REVIEWED_IDENTIFIERS',
          'Every reviewed identifier must be a non-empty string.',
          'reviewedOfficialIdentifiers',
        ),
      );
    } else {
      reviewed = manifest.reviewedOfficialIdentifiers as string[];
    }
  }

  if (!Array.isArray(manifest.sources)) {
    errors.push(issue('MISSING_SOURCES', 'A corpus manifest requires a "sources" array.', 'sources'));
  }

  // A corpus that declares itself internal/original educational content is held to a strict,
  // honesty-preserving shape: only clearly marked non-authoritative summaries, no specific-
  // looking citations, no statute/judgment/rule records and no reviewed allowlist. This is what
  // lets the shipped manifest be real (non-template) without fabricating any law.
  if (corpusKind === INTERNAL_EDUCATIONAL_CATEGORY) {
    if (corpusAuthority === undefined || corpusAuthority === null) {
      errors.push(
        issue(
          'MISSING_AUTHORITY_DECLARATION',
          'An internal educational corpus must declare authority: "non-authoritative".',
          'authority',
        ),
      );
    }
    if (corpusDisclaimer === undefined || corpusDisclaimer === null) {
      errors.push(
        issue(
          'MISSING_DISCLAIMER',
          'An internal educational corpus must carry a disclaimer stating it is not legal advice and asserts no real citation.',
          'disclaimer',
        ),
      );
    }
    if (manifest.assertsRealCitation === undefined || manifest.assertsRealCitation === null) {
      errors.push(
        issue(
          'MISSING_CITATION_ASSERTION',
          'An internal educational corpus must explicitly set assertsRealCitation to false.',
          'assertsRealCitation',
        ),
      );
    }
    if (reviewed.length > 0) {
      errors.push(
        issue(
          'EDUCATIONAL_CORPUS_WITH_ALLOWLIST',
          'An internal educational corpus contains no reviewed official citations; reviewedOfficialIdentifiers must be empty.',
          'reviewedOfficialIdentifiers',
        ),
      );
    }
    const educationalSources = Array.isArray(manifest.sources) ? manifest.sources : [];
    const educationalIssue = (code: string, message: string, field: string, label: string): ValidationIssue => ({
      code,
      message: `${label}: ${message}`,
      field,
      severity: 'error',
    });
    educationalSources.forEach((source, index) => {
      if (!isObject(source)) return;
      const label = `sources[${index}]`;
      if (source.sourceType !== 'summary') {
        errors.push(
          educationalIssue(
            'EDUCATIONAL_CORPUS_NON_SUMMARY',
            'An internal educational corpus may contain only "summary" records, never statute/judgment/rule records.',
            'sourceType',
            label,
          ),
        );
      }
      if (hasText(source.citation) && looksLikeSpecificCitation(String(source.citation))) {
        errors.push(
          educationalIssue(
            'EDUCATIONAL_CORPUS_SPECIFIC_CITATION',
            'An internal educational corpus must not contain specific-looking citations (section/article numbers, reporter references or case names).',
            'citation',
            label,
          ),
        );
      }
      if (source.category === undefined || source.category === null) {
        errors.push(
          educationalIssue(
            'MISSING_EDUCATIONAL_CATEGORY',
            `Each record must declare category: "${INTERNAL_EDUCATIONAL_CATEGORY}".`,
            'category',
            label,
          ),
        );
      }
      if (source.authority === undefined || source.authority === null) {
        errors.push(
          educationalIssue(
            'MISSING_SOURCE_AUTHORITY',
            `Each record must declare authority: "${NON_AUTHORITATIVE_DECLARATION}".`,
            'authority',
            label,
          ),
        );
      }
      if (source.assertsRealCitation === undefined || source.assertsRealCitation === null) {
        errors.push(
          educationalIssue(
            'MISSING_CITATION_ASSERTION',
            'Each record must explicitly set assertsRealCitation to false.',
            'assertsRealCitation',
            label,
          ),
        );
      }
    });
  }

  // Official-source-metadata corpora reference real official publications (e.g. India Code) by
  // metadata/provenance only. They may assert real official citation identifiers, but must not
  // reproduce or fabricate statutory/procedural provision text. Human review and official URLs are required.
  if (corpusKind === OFFICIAL_SOURCE_METADATA_CATEGORY) {
    if (corpusAuthority === undefined || corpusAuthority === null) {
      errors.push(
        issue(
          'MISSING_AUTHORITY_DECLARATION',
          'An official-source-metadata corpus must declare authority: "official-publication-metadata".',
          'authority',
        ),
      );
    }
    if (corpusDisclaimer === undefined || corpusDisclaimer === null) {
      errors.push(
        issue(
          'MISSING_DISCLAIMER',
          'An official-source-metadata corpus must carry a disclaimer stating it contains metadata/provenance only and is not reproduced legal text/legal advice.',
          'disclaimer',
        ),
      );
    }
    if (manifest.assertsRealCitation === undefined || manifest.assertsRealCitation === null) {
      errors.push(
        issue(
          'MISSING_CITATION_ASSERTION',
          'An official-source-metadata corpus must explicitly set assertsRealCitation to true.',
          'assertsRealCitation',
        ),
      );
    }
    const officialSources = Array.isArray(manifest.sources) ? manifest.sources : [];
    officialSources.forEach((source, index) => {
      if (!isObject(source)) return;
      const label = `sources[${index}]`;
      if (source.category === undefined || source.category === null) {
        errors.push({
          code: 'MISSING_OFFICIAL_CATEGORY',
          message: `${label}: Each record must declare category: "${OFFICIAL_SOURCE_METADATA_CATEGORY}".`,
          field: 'category',
          severity: 'error',
        });
      }
      if (source.assertsRealCitation === undefined || source.assertsRealCitation === null) {
        errors.push({
          code: 'MISSING_CITATION_ASSERTION',
          message: `${label}: Each record must explicitly set assertsRealCitation to true.`,
          field: 'assertsRealCitation',
          severity: 'error',
        });
      }
      if (!hasText(source.sourceUrl)) {
        errors.push({
          code: 'OFFICIAL_METADATA_MISSING_URL',
          message: `${label}: Official-source-metadata records must include an official sourceUrl.`,
          field: 'sourceUrl',
          severity: 'error',
        });
      }
      if (!hasText(source.provenance)) {
        errors.push({
          code: 'MISSING_PROVENANCE',
          message: `${label}: Official-source-metadata records must include provenance describing the official source and verification.`,
          field: 'provenance',
          severity: 'error',
        });
      }
      const excerpt = typeof source.excerpt === 'string' ? source.excerpt.trim() : '';
      if (excerpt.length > 240) {
        errors.push({
          code: 'OFFICIAL_METADATA_EXCERPT_TOO_LONG',
          message: `${label}: Official-source-metadata excerpts must be short metadata notes only (<=240 chars). Do not reproduce statutory/procedural text.`,
          field: 'excerpt',
          severity: 'error',
        });
      }
    });
  }

  // The manifest's own allowlist is the machine-readable record of human review; any
  // identifiers supplied by the caller are additional (never a way to fabricate authority).
  const combinedReviewed = [...new Set([...reviewed, ...(options.reviewedOfficialIdentifiers ?? [])])];
  const batch = validateSourceRecords(Array.isArray(manifest.sources) ? manifest.sources : [], {
    reviewedOfficialIdentifiers: combinedReviewed,
  });
  for (const result of batch.results) {
    const label = `sources[${result.index}]${result.id ? ` "${result.id}"` : ''}`;
    for (const error of result.errors) {
      errors.push({ ...error, message: `${label}: ${error.message}` });
    }
    for (const warning of result.warnings) {
      warnings.push({ ...warning, message: `${label}: ${warning.message}` });
    }
  }

  // Consistency warnings: non-blocking, but make an incomplete/blocked corpus obvious.
  if (!hasText(manifest.owner) && batch.total > 0) {
    warnings.push(
      issue(
        'NO_CORPUS_OWNER',
        'No named content owner is recorded; a human must sign off before any real source is authoritative.',
        'owner',
        'warning',
      ),
    );
  }
  if (status === 'blocked' && combinedReviewed.length > 0) {
    warnings.push(
      issue(
        'BLOCKED_WITH_REVIEWED_IDS',
        'A blocked corpus should not carry reviewed identifiers yet.',
        'reviewedOfficialIdentifiers',
        'warning',
      ),
    );
  }
  if (status === 'approved' && batch.total === 0) {
    warnings.push(
      issue('APPROVED_EMPTY_CORPUS', 'A corpus marked approved contains no source records.', 'sources', 'warning'),
    );
  }

  validateManifestMetadata(manifest, status, reviewed, errors, warnings);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    sources: batch,
    duplicateIds: batch.duplicateIds,
    ...(typeof schemaVersion === 'number' ? { schemaVersion } : {}),
    ...(status ? { status } : {}),
    ...(typeof corpusKind === 'string' ? { corpusKind } : {}),
  };
}
