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
  results: BatchRecordResult[];
}

const VERIFICATION_STATUSES: readonly SourceVerificationStatus[] = ['verified', 'unverified', 'placeholder'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PLACEHOLDER_WORD = /\bplaceholder\b/i;
/** Real-world authority needs an official source URL; internal fictional summaries do not. */
const REAL_AUTHORITY_TYPES: ReadonlySet<string> = new Set(['statute', 'judgment', 'rule']);

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

  const placeholderMarked = PLACEHOLDER_WORD.test(
    [
      hasText(record.title) ? record.title : '',
      hasText(record.sourceName) ? record.sourceName : '',
      hasText(record.citation) ? record.citation : '',
    ].join(' '),
  );

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
    if (!hasText(record.verifiedBy)) {
      errors.push(
        issue(
          'VERIFIED_WITHOUT_REVIEWER',
          'A verified record must name the human/content owner who reviewed it (verifiedBy).',
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
    } else if (!needsOfficialUrl && !hasText(record.sourceUrl)) {
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
  const results: BatchRecordResult[] = records.map((record, index) => {
    const result = validateSourceRecord(record, options);
    const rawId =
      record && typeof record === 'object' && !Array.isArray(record)
        ? (record as Record<string, unknown>).id
        : undefined;
    return {
      index,
      ...(hasText(rawId) ? { id: rawId } : {}),
      ...result,
    };
  });
  return {
    ok: results.every((result) => result.ok),
    total: results.length,
    invalid: results.filter((result) => !result.ok).length,
    results,
  };
}
