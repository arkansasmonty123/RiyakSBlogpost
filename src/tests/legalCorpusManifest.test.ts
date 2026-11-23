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

  it('accepts complete, well-formed optional pipeline metadata (fictional values only)', () => {
    const result = validateCorpusManifest(
      manifest({
        status: 'approved',
        provenanceNote: 'Fictional workflow test only; not a real provenance record.',
        acquisition: {
          checklistCompleted: true,
          reviewerAssigned: true,
          officialSources: ['INTERNAL-FICTIONAL-PUBLICATION'],
          retrievalDate: '2026-11-22',
        },
        signoff: {
          reviewer: 'Internal fictional reviewer',
          date: '2026-11-23',
          scope: 'INTERNAL-TEST-CORPUS',
          notes: 'Fictional workflow test only.',
        },
        rights: {
          status: 'cleared',
          basis: 'Internal fictional public-text stand-in for workflow testing.',
          confirmedBy: 'Internal fictional rights reviewer',
          confirmedDate: '2026-11-23',
        },
        versionPolicy: {
          effectiveDatePolicy: 'Fictional test note; no real policy agreed.',
          asOf: '2026-11-23',
          note: 'Workflow test only.',
          supersedes: 'INTERNAL-PREVIOUS-TEST-CORPUS',
        },
        allowlistPolicy: {
          maintainedBy: 'Internal fictional maintainer',
          lastReviewed: '2026-11-23',
          policyNote: 'Fictional workflow test only.',
        },
        staging: {
          stage: 'promoted',
          unverifiedFolder: 'intake/unverified/',
          reviewedFolder: 'intake/reviewed/',
          importNote: 'Fictional workflow test only.',
        },
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects malformed metadata with specific, stable error codes', () => {
    expect(codes(validateCorpusManifest(manifest({ provenanceNote: 42 })))).toContain('INVALID_CORPUS_PROVENANCE');
    for (const [field, code] of [
      ['acquisition', 'INVALID_ACQUISITION'],
      ['signoff', 'INVALID_SIGNOFF'],
      ['rights', 'INVALID_RIGHTS'],
      ['versionPolicy', 'INVALID_VERSION_POLICY'],
      ['allowlistPolicy', 'INVALID_ALLOWLIST_POLICY'],
      ['staging', 'INVALID_STAGING'],
    ] as const) {
      expect(codes(validateCorpusManifest(manifest({ [field]: 'not-an-object' }))), field).toContain(code);
    }
    expect(codes(validateCorpusManifest(manifest({ acquisition: { retrievalDate: '23-11-2026' } })))).toContain(
      'INVALID_ACQUISITION_DATE',
    );
    expect(codes(validateCorpusManifest(manifest({ acquisition: { officialSources: ['ok', ''] } })))).toContain(
      'INVALID_ACQUISITION_SOURCES',
    );
    expect(codes(validateCorpusManifest(manifest({ signoff: { reviewer: 'TBD', date: '2026-11-23' } })))).toContain(
      'NON_HUMAN_SIGNOFF_REVIEWER',
    );
    expect(codes(validateCorpusManifest(manifest({ signoff: { reviewer: 'Named reviewer' } })))).toContain(
      'INCOMPLETE_SIGNOFF',
    );
    expect(codes(validateCorpusManifest(manifest({ rights: { status: 'unknown-status' } })))).toContain(
      'INVALID_RIGHTS_STATUS',
    );
    expect(codes(validateCorpusManifest(manifest({ rights: { status: 'cleared' } })))).toContain(
      'RIGHTS_CLEARANCE_INCOMPLETE',
    );
    expect(codes(validateCorpusManifest(manifest({ staging: { stage: 'launch' } })))).toContain(
      'INVALID_STAGING_STAGE',
    );
    expect(codes(validateCorpusManifest(manifest({ staging: {} })))).toContain('MISSING_STAGING_STAGE');
  });

  it('warns when a gated corpus has no signoff, rights clearance or version note', () => {
    const result = validateCorpusManifest(manifest({ status: 'approved', sources: [INTERNAL_SUMMARY] }));
    const warningCodes = result.warnings.map((warning) => warning.code);
    expect(warningCodes).toContain('MISSING_SIGNOFF');
    expect(warningCodes).toContain('RIGHTS_NOT_CLEARED');
    expect(warningCodes).toContain('NO_VERSION_POLICY');
    expect(warningCodes).toContain('NO_ACQUISITION_RECORD');
    expect(warningCodes).toContain('NO_STAGING_RECORD');
  });

  it('warns about a stale allowlist entry and stage/status mismatch', () => {
    const stale = validateCorpusManifest(
      manifest({
        sources: [INTERNAL_SUMMARY],
        reviewedOfficialIdentifiers: ['INTERNAL-SUMMARY-0001', 'INTERNAL-NEVER-REVIEWED-0002'],
      }),
    );
    const warningCodes = stale.warnings.map((warning) => warning.code);
    expect(warningCodes).toContain('UNUSED_REVIEWED_IDENTIFIER');
    expect(warningCodes).toContain('REVIEWED_IDS_WITHOUT_ALLOWLIST_POLICY');

    const mismatch = validateCorpusManifest(manifest({ sources: [INTERNAL_SUMMARY], staging: { stage: 'promoted' } }));
    expect(mismatch.warnings.map((warning) => warning.code)).toContain('STAGE_STATUS_MISMATCH');
  });

  it('propagates duplicate source ids from the manifest to the batch report', () => {
    const duplicate = { ...INTERNAL_SUMMARY, title: 'Later internal record with a reused id' };
    const result = validateCorpusManifest(manifest({ sources: [INTERNAL_SUMMARY, duplicate] }));
    expect(codes(result)).toContain('DUPLICATE_SOURCE_ID');
    expect(result.duplicateIds).toEqual(['cm-1']);
    expect(result.sources?.duplicateIds).toEqual(['cm-1']);
  });
});
