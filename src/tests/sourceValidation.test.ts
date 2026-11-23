import { describe, expect, it } from 'vitest';
import { intakeSource, markSourceVerified } from '@/domain/legalSources';
import { validateSourceRecord, validateSourceRecords } from '@/domain/sourceValidation';
import { createInitialSave } from '@/domain/seed';
import type { LegalSource } from '@/domain/types';

/**
 * All examples below are internal/fictional identifiers. No real statutory provision,
 * judgment, reporter citation or procedural rule is created or ingested by these tests.
 */
const INTERNAL_SUMMARY: LegalSource = {
  id: 'v-1',
  title: 'Internal fictional evidence-handling summary',
  sourceName: 'Internal fictional training summary (prototype)',
  citation: 'INTERNAL-SUMMARY-0001',
  sourceType: 'summary',
  jurisdiction: 'Fictional',
  verificationStatus: 'verified',
  provenance:
    'Internal prototype summary; not a statutory citation. Checked against the internal fictional case brief.',
  verifiedBy: 'Internal prototype review',
  verificationDate: '2026-11-22',
  intake: 'seed',
};

function codes(source: unknown, options?: Parameters<typeof validateSourceRecord>[1]): string[] {
  return validateSourceRecord(source, options).errors.map((error) => error.code);
}

describe('source record validation (D-005/D-011 ingestion gate)', () => {
  it('accepts a verified internal/fictional summary with full human attestation', () => {
    const result = validateSourceRecord(INTERNAL_SUMMARY);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    // An internal summary needs no official URL; the absence is surfaced, not blocked.
    expect(result.warnings.map((warning) => warning.code)).toContain('NO_OFFICIAL_URL');
  });

  it('accepts unverified and placeholder record shapes without attestation fields', () => {
    const unverified: LegalSource = { ...INTERNAL_SUMMARY, verificationStatus: 'unverified' };
    delete (unverified as Partial<LegalSource>).verifiedBy;
    delete (unverified as Partial<LegalSource>).verificationDate;
    expect(validateSourceRecord(unverified).ok).toBe(true);

    const placeholder: LegalSource = {
      ...unverified,
      verificationStatus: 'placeholder',
      citation: 'BNS (placeholder - verify exact provision before use)',
    };
    expect(validateSourceRecord(placeholder).ok).toBe(true);
  });

  it('rejects missing provenance, identifier and other required fields with clear errors', () => {
    expect(codes({ ...INTERNAL_SUMMARY, provenance: '   ' })).toContain('MISSING_PROVENANCE');
    expect(codes({ ...INTERNAL_SUMMARY, citation: '' })).toContain('MISSING_CITATION');
    expect(codes({ ...INTERNAL_SUMMARY, id: '  ' })).toContain('MISSING_ID');
    expect(codes({ ...INTERNAL_SUMMARY, sourceName: '' })).toContain('MISSING_SOURCE_NAME');
    expect(codes({ ...INTERNAL_SUMMARY, title: '' })).toContain('MISSING_TITLE');

    const noProvenance = validateSourceRecord({ ...INTERNAL_SUMMARY, provenance: '' });
    expect(noProvenance.ok).toBe(false);
    expect(noProvenance.errors.find((error) => error.code === 'MISSING_PROVENANCE')?.field).toBe('provenance');
    expect(noProvenance.errors.find((error) => error.code === 'MISSING_PROVENANCE')?.message).toMatch(/provenance/i);
  });

  it('blocks verified status without a named reviewer and a review date', () => {
    const noReviewer = { ...INTERNAL_SUMMARY };
    delete (noReviewer as Partial<LegalSource>).verifiedBy;
    expect(codes(noReviewer)).toContain('VERIFIED_WITHOUT_REVIEWER');

    const noDate = { ...INTERNAL_SUMMARY };
    delete (noDate as Partial<LegalSource>).verificationDate;
    expect(codes(noDate)).toContain('VERIFIED_WITHOUT_DATE');
  });

  it('blocks verified status without an official URL for real-world authority', () => {
    const authority: LegalSource = {
      ...INTERNAL_SUMMARY,
      citation: 'OFFICIAL-ACT-INTERNAL-ID', // non-specific identifier, no fabricated citation
      jurisdiction: 'India',
      sourceType: 'statute',
    };
    expect(codes(authority)).toContain('VERIFIED_WITHOUT_OFFICIAL_URL');
    expect(validateSourceRecord({ ...authority, sourceUrl: 'https://example.invalid/official-text' }).ok).toBe(true);
  });

  it('rejects verified fabricated-looking specific citations even with full metadata', () => {
    // These strings are used ONLY to prove the gate rejects specific-looking references.
    for (const citation of ['Section 302 IPC', 'AIR 2020 SC 123', 'Foo v. Bar']) {
      const record: LegalSource = {
        ...INTERNAL_SUMMARY,
        citation,
        jurisdiction: 'India',
        sourceType: citation.includes('v.') ? 'judgment' : 'statute',
        sourceUrl: 'https://example.invalid/official-text',
      };
      expect(codes(record), citation).toContain('UNREVIEWED_SPECIFIC_CITATION');
      expect(validateSourceRecord(record).ok).toBe(false);
    }
  });

  it('allows a specific-looking citation only when a human-reviewed allowlist contains it', () => {
    // Clearly fictional provision; demonstrates the review gate without a real citation.
    const fictional: LegalSource = {
      ...INTERNAL_SUMMARY,
      citation: 'Section 999 of the Fictional Act',
      jurisdiction: 'Fictional',
      sourceType: 'rule',
      sourceUrl: 'https://example.invalid/fictional-official-text',
    };
    expect(codes(fictional)).toContain('UNREVIEWED_SPECIFIC_CITATION');
    const allowed = validateSourceRecord(fictional, {
      reviewedOfficialIdentifiers: ['  section 999   of the fictional act  '],
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.errors).toEqual([]);
  });

  it('never lets a placeholder-labeled record become verified', () => {
    const record: LegalSource = {
      ...INTERNAL_SUMMARY,
      citation: 'BNS (placeholder - verify exact provision before use)',
    };
    expect(codes(record)).toContain('PLACEHOLDER_CANNOT_BE_VERIFIED');
  });

  it('rejects invalid enums, date/URL formats, non-object input and overlong fields', () => {
    expect(validateSourceRecord(null).errors.map((e) => e.code)).toContain('INVALID_RECORD');
    expect(codes({ ...INTERNAL_SUMMARY, sourceType: 'fiction' })).toContain('INVALID_SOURCE_TYPE');
    expect(codes({ ...INTERNAL_SUMMARY, jurisdiction: 'Mars' })).toContain('INVALID_JURISDICTION');
    expect(codes({ ...INTERNAL_SUMMARY, verificationStatus: 'verified-ish' })).toContain('INVALID_VERIFICATION_STATUS');
    expect(codes({ ...INTERNAL_SUMMARY, effectiveDate: '01-01-2024' })).toContain('INVALID_EFFECTIVE_DATE');
    expect(codes({ ...INTERNAL_SUMMARY, verificationDate: '22-11-2026' })).toContain('INVALID_VERIFICATION_DATE');
    expect(codes({ ...INTERNAL_SUMMARY, sourceUrl: 'not-a-url' })).toContain('INVALID_SOURCE_URL');
    expect(codes({ ...INTERNAL_SUMMARY, intake: 'alien' })).toContain('INVALID_INTAKE');

    const long = validateSourceRecord({ ...INTERNAL_SUMMARY, citation: 'X'.repeat(400) });
    expect(long.warnings.map((e) => e.code)).toContain('FIELD_TOO_LONG');
  });

  it('validates a whole corpus with record positions and an overall verdict', () => {
    const bad: LegalSource = { ...INTERNAL_SUMMARY, id: 'v-bad', provenance: '' };
    const batch = validateSourceRecords([INTERNAL_SUMMARY, bad]);
    expect(batch.ok).toBe(false);
    expect(batch.total).toBe(2);
    expect(batch.invalid).toBe(1);
    expect(batch.results[0].ok).toBe(true);
    expect(batch.results[1].index).toBe(1);
    expect(batch.results[1].id).toBe('v-bad');
    expect(batch.results[1].errors.map((e) => e.code)).toContain('MISSING_PROVENANCE');
    expect(validateSourceRecords([]).ok).toBe(true);
  });

  it('confirms the shipped seed corpus itself satisfies the ingestion gate', () => {
    const batch = validateSourceRecords(createInitialSave().legalSources);
    expect(batch.ok).toBe(true);
    expect(batch.invalid).toBe(0);
    expect(batch.duplicateIds).toEqual([]);
  });

  it('detects duplicate ids and only invalidates the later occurrences', () => {
    const duplicate = { ...INTERNAL_SUMMARY, title: 'Later record with the same internal id' };
    const batch = validateSourceRecords([INTERNAL_SUMMARY, duplicate]);
    expect(batch.ok).toBe(false);
    expect(batch.total).toBe(2);
    expect(batch.invalid).toBe(1);
    expect(batch.duplicateIds).toEqual(['v-1']);
    expect(batch.results[0].ok).toBe(true);
    expect(batch.results[1].errors.map((error) => error.code)).toContain('DUPLICATE_SOURCE_ID');
    expect(batch.results[1].errors.find((error) => error.code === 'DUPLICATE_SOURCE_ID')?.field).toBe('id');
    // Distinct ids remain valid; whitespace-only differences are normalized by trimming.
    expect(validateSourceRecords([INTERNAL_SUMMARY, { ...INTERNAL_SUMMARY, id: 'v-2' }]).ok).toBe(true);
  });

  it('rejects verified records that label themselves template/example/sample/TBD', () => {
    // Fictional internal identifiers used only to prove template stand-ins cannot be verified.
    for (const citation of ['TEMPLATE-ONLY-0001', 'INTERNAL-EXAMPLE-0001', 'SAMPLE-SUMMARY-01', 'TBD-INTERNAL-01']) {
      const record: LegalSource = { ...INTERNAL_SUMMARY, citation };
      expect(codes(record), citation).toContain('TEMPLATE_OR_EXAMPLE_CANNOT_BE_VERIFIED');
      expect(validateSourceRecord(record).ok, citation).toBe(false);
    }
    // The same stand-in is fine when it is explicitly non-authoritative.
    const unverified = {
      ...INTERNAL_SUMMARY,
      citation: 'TEMPLATE-ONLY-0001',
      verificationStatus: 'placeholder' as const,
    };
    expect(codes(unverified)).not.toContain('TEMPLATE_OR_EXAMPLE_CANNOT_BE_VERIFIED');
  });

  it('rejects generic/auto reviewer names as a verified sign-off', () => {
    for (const verifiedBy of ['TBD', 'auto', 'AI', 'system', 'unknown']) {
      expect(codes({ ...INTERNAL_SUMMARY, verifiedBy }), verifiedBy).toContain('NON_HUMAN_REVIEWER');
    }
    expect(validateSourceRecord({ ...INTERNAL_SUMMARY, verifiedBy: 'Named internal reviewer' }).ok).toBe(true);
  });

  it('ignores unknown extra fields so the gate is forward compatible', () => {
    const extended = { ...INTERNAL_SUMMARY, someFutureField: { nested: true } };
    expect(validateSourceRecord(extended).ok).toBe(true);
  });

  it('validates optional internal-educational honesty markers on a record', () => {
    const educational = {
      ...INTERNAL_SUMMARY,
      category: 'internal-educational-summary',
      authority: 'non-authoritative',
      assertsRealCitation: false,
      disclaimer: 'Internal educational summary; not legal advice; not a statement of law.',
    };
    const result = validateSourceRecord(educational);
    expect(result.ok).toBe(true);
    // An explicitly non-authoritative original summary has no official text to link to.
    expect(result.warnings.map((warning) => warning.code)).not.toContain('NO_OFFICIAL_URL');

    expect(codes({ ...educational, category: 'official' })).toContain('INVALID_SOURCE_CATEGORY');
    expect(codes({ ...educational, authority: 'authoritative' })).toContain('INVALID_AUTHORITY_DECLARATION');
    expect(codes({ ...educational, assertsRealCitation: true })).toContain('INVALID_CITATION_ASSERTION');
    expect(codes({ ...educational, disclaimer: '' })).toContain('INVALID_DISCLAIMER');
  });

  it('still rejects fabricated-looking citations and stand-in labels on marked educational records', () => {
    const educational = {
      ...INTERNAL_SUMMARY,
      category: 'internal-educational-summary',
      authority: 'non-authoritative',
      assertsRealCitation: false,
    };
    // Real-looking string used ONLY to prove the gate rejects it; never asserted as law.
    const specific = {
      ...educational,
      citation: 'Section 302 IPC',
      jurisdiction: 'India' as const,
      sourceType: 'statute' as const,
      sourceUrl: 'https://example.invalid/official-text',
    };
    expect(codes(specific)).toContain('UNREVIEWED_SPECIFIC_CITATION');
    expect(codes({ ...educational, citation: 'PLACEHOLDER (exact text not checked)' })).toContain(
      'PLACEHOLDER_CANNOT_BE_VERIFIED',
    );
    expect(codes({ ...educational, citation: 'INTERNAL-EXAMPLE-0001' })).toContain(
      'TEMPLATE_OR_EXAMPLE_CANNOT_BE_VERIFIED',
    );
  });
});

describe('human verification step uses the strict ingestion gate', () => {
  it('requires a dated human review and never auto-verifies a specific citation', () => {
    const draft = intakeSource(
      {
        title: 'Internal notebook reference',
        sourceName: 'Fictional notebook',
        citation: 'NOTEBOOK-REF-12',
        sourceType: 'summary',
        jurisdiction: 'Fictional',
        provenance: 'Copied from an internal notebook; not checked against an official source.',
      },
      'lv-1',
    ).source!;

    expect(markSourceVerified(draft, 'Legal content owner').ok).toBe(false);
    const verified = markSourceVerified(draft, 'Legal content owner', '2026-11-22');
    expect(verified.ok).toBe(true);
    expect(verified.source?.verifiedBy).toBe('Legal content owner');
    expect(validateSourceRecord(verified.source!).ok).toBe(true);
  });
});
