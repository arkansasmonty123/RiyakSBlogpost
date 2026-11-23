import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CORPUS_MANIFEST_SCHEMA_VERSION, validateCorpusManifest } from '@/domain/sourceValidation';
import type { CorpusManifestResult } from '@/domain/sourceValidation';
import type { LegalSource } from '@/domain/types';

/**
 * All records below use internal/fictional identifiers. No real statutory provision, judgment,
 * reporter citation or procedural rule is created or ingested by these tests. The only string
 * that resembles a specific citation is a fictional "Section 999 of the Fictional Act" and it is
 * used solely to prove the gate rejects unreviewed specific-looking references.
 */
const INTERNAL_SUMMARY: LegalSource = {
  id: 'cm-1',
  title: 'Internal fictional evidence-handling summary',
  sourceName: 'Internal fictional training summary (prototype)',
  citation: 'INTERNAL-SUMMARY-0001',
  sourceType: 'summary',
  jurisdiction: 'Fictional',
  verificationStatus: 'verified',
  provenance: 'Internal prototype summary; not a statutory citation. Checked against the internal fictional brief.',
  verifiedBy: 'Internal prototype review',
  verificationDate: '2026-11-22',
  intake: 'seed',
};

function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: CORPUS_MANIFEST_SCHEMA_VERSION,
    corpusId: 'INTERNAL-TEST-CORPUS',
    status: 'draft',
    owner: 'Internal test owner (not a legal reviewer)',
    intakeFolder: 'intake/',
    reviewedOfficialIdentifiers: [],
    sources: [],
    ...overrides,
  };
}

function codes(result: CorpusManifestResult): string[] {
  return result.errors.map((error) => error.code);
}

describe('corpus manifest validation (legal-corpus pipeline)', () => {
  it('accepts a well-formed manifest with an empty source list', () => {
    const result = validateCorpusManifest(manifest());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.sources?.total).toBe(0);
    expect(result.schemaVersion).toBe(CORPUS_MANIFEST_SCHEMA_VERSION);
    expect(result.status).toBe('draft');
  });

  it('accepts a manifest whose verified source is an internal fictional summary', () => {
    const result = validateCorpusManifest(manifest({ sources: [INTERNAL_SUMMARY] }));
    expect(result.ok).toBe(true);
    expect(result.sources?.total).toBe(1);
    // Source-level issues are reported with their record position for clear reporting.
    expect(result.warnings.some((warning) => warning.message.startsWith('sources[0]'))).toBe(true);
  });

  it('rejects the shipped template as a template, not a corpus', () => {
    const template = JSON.parse(
      readFileSync('docs/legal-corpus/manifest.template.json', { encoding: 'utf8' }),
    ) as unknown;
    const result = validateCorpusManifest(template);
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain('MANIFEST_IS_TEMPLATE');
  });

  it('rejects any truthy template marker even when sources pass the ordinary gate', () => {
    const result = validateCorpusManifest(manifest({ template: true, sources: [INTERNAL_SUMMARY] }));
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain('MANIFEST_IS_TEMPLATE');
  });

  it('requires a supported schemaVersion, corpusId and sources array', () => {
    expect(codes(validateCorpusManifest(manifest({ schemaVersion: undefined })))).toContain('MISSING_SCHEMA_VERSION');
    expect(codes(validateCorpusManifest(manifest({ schemaVersion: 99 })))).toContain('UNSUPPORTED_SCHEMA_VERSION');
    expect(codes(validateCorpusManifest(manifest({ corpusId: '  ' })))).toContain('MISSING_CORPUS_ID');
    expect(codes(validateCorpusManifest(manifest({ sources: undefined })))).toContain('MISSING_SOURCES');
    expect(codes(validateCorpusManifest(null))).toContain('INVALID_MANIFEST');
  });

  it('rejects invalid status, owner, intakeFolder and allowlist shapes', () => {
    expect(codes(validateCorpusManifest(manifest({ status: 'verified-ish' })))).toContain('INVALID_MANIFEST_STATUS');
    expect(codes(validateCorpusManifest(manifest({ owner: 42 })))).toContain('INVALID_OWNER');
    expect(codes(validateCorpusManifest(manifest({ intakeFolder: '' })))).toContain('INVALID_INTAKE_FOLDER');
    expect(codes(validateCorpusManifest(manifest({ reviewedOfficialIdentifiers: 'not-an-array' })))).toContain(
      'INVALID_REVIEWED_IDENTIFIERS',
    );
    expect(codes(validateCorpusManifest(manifest({ reviewedOfficialIdentifiers: ['ok', '  '] })))).toContain(
      'INVALID_REVIEWED_IDENTIFIERS',
    );
  });

  it('propagates source-level blockers: placeholder-marked-verified and missing attestation', () => {
    const placeholderVerified: LegalSource = {
      ...INTERNAL_SUMMARY,
      citation: 'PLACEHOLDER (exact text not checked)',
    };
    expect(codes(validateCorpusManifest(manifest({ sources: [placeholderVerified] })))).toContain(
      'PLACEHOLDER_CANNOT_BE_VERIFIED',
    );

    const noReviewer: LegalSource = { ...INTERNAL_SUMMARY };
    delete (noReviewer as Partial<LegalSource>).verifiedBy;
    expect(codes(validateCorpusManifest(manifest({ sources: [noReviewer] })))).toContain('VERIFIED_WITHOUT_REVIEWER');

    const noDate: LegalSource = { ...INTERNAL_SUMMARY };
    delete (noDate as Partial<LegalSource>).verificationDate;
    expect(codes(validateCorpusManifest(manifest({ sources: [noDate] })))).toContain('VERIFIED_WITHOUT_DATE');

    const noProvenance: LegalSource = { ...INTERNAL_SUMMARY, provenance: '   ' };
    expect(codes(validateCorpusManifest(manifest({ sources: [noProvenance] })))).toContain('MISSING_PROVENANCE');
  });

  it('rejects an unreviewed specific-looking citation but accepts it when the manifest allowlists it', () => {
    // Clearly fictional, yet matches the specific-citation pattern; used only to prove rejection.
    const specific: LegalSource = {
      ...INTERNAL_SUMMARY,
      citation: 'Section 999 of the Fictional Act',
      jurisdiction: 'Fictional',
      sourceType: 'rule',
      sourceUrl: 'https://example.invalid/fictional-official-text',
    };
    expect(codes(validateCorpusManifest(manifest({ sources: [specific] })))).toContain('UNREVIEWED_SPECIFIC_CITATION');
    const allowed = validateCorpusManifest(
      manifest({
        sources: [specific],
        reviewedOfficialIdentifiers: ['  section 999   of the fictional act  '],
      }),
    );
    expect(allowed.ok).toBe(true);
  });

  it('emits clear consistency warnings for a blocked/ownerless corpus', () => {
    const ownerless = validateCorpusManifest(manifest({ owner: null, status: 'blocked', sources: [INTERNAL_SUMMARY] }));
    expect(ownerless.ok).toBe(true);
    expect(ownerless.warnings.map((warning) => warning.code)).toContain('NO_CORPUS_OWNER');

    const blockedWithIds = validateCorpusManifest(
      manifest({ status: 'blocked', reviewedOfficialIdentifiers: ['INTERNAL-SUMMARY-0001'] }),
    );
    expect(blockedWithIds.warnings.map((warning) => warning.code)).toContain('BLOCKED_WITH_REVIEWED_IDS');

    const approvedEmpty = validateCorpusManifest(manifest({ status: 'approved' }));
    expect(approvedEmpty.warnings.map((warning) => warning.code)).toContain('APPROVED_EMPTY_CORPUS');
  });
});
