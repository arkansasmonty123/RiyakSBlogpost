import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ART_MANIFEST_SCHEMA_VERSION, validateArtAsset, validateArtManifest } from '@/domain/artManifestValidation';
import type { ArtManifestResult } from '@/domain/artManifestValidation';

/**
 * All manifest values below are internal/fictional examples. No external asset, third-party
 * artwork, real licence claim or canonical case fact is introduced or approved by these tests.
 */
const APPROVED_ASSET: Record<string, unknown> = {
  id: 'view-chamber-entrance-v1',
  kind: 'viewpoint',
  file: 'viewpoints/chamber/entrance-v1.svg',
  origin: 'original',
  license: 'EXAMPLE-ONLY - internal fictional license string',
  source: 'Original in-repo SVG based on the internal CSS/SVG placeholder.',
  author: 'Internal prototype (fictional)',
  createdDate: '2026-11-22',
  status: 'approved',
  approvedDate: '2026-11-22',
  approvedBy: 'Internal prototype review (fictional)',
  checksum: `sha256:${'a'.repeat(64)}`,
  sizeBytes: 8192,
  usedAt: 'Senior Chamber / entrance viewpoint',
  notes: 'Fictional example for validator testing only.',
};

function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: ART_MANIFEST_SCHEMA_VERSION,
    manifestId: 'INTERNAL-TEST-ART-MANIFEST',
    status: 'draft',
    owner: 'Internal test owner (not a real art owner)',
    intakeFolder: 'intake/',
    perAssetBudgetBytes: 1_048_576,
    totalBudgetBytes: 5_242_880,
    assets: [],
    ...overrides,
  };
}

function codes(result: ArtManifestResult): string[] {
  return result.errors.map((error) => error.code);
}

function warningCodes(result: ArtManifestResult): string[] {
  return result.warnings.map((warning) => warning.code);
}

describe('art manifest validation (Phase 5 art pipeline)', () => {
  it('accepts a well-formed manifest with an empty asset list', () => {
    const result = validateArtManifest(manifest());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.assets?.total).toBe(0);
    expect(result.schemaVersion).toBe(ART_MANIFEST_SCHEMA_VERSION);
    expect(result.status).toBe('draft');
  });

  it('accepts a fully-provenanced approved asset', () => {
    const result = validateArtManifest(manifest({ assets: [APPROVED_ASSET] }));
    expect(result.ok).toBe(true);
    expect(result.assets?.total).toBe(1);
    expect(result.assets?.invalid).toBe(0);
    expect(result.totalSizeBytes).toBe(8192);
  });

  it('rejects the shipped template as a template, not a manifest', () => {
    const template = JSON.parse(
      readFileSync('docs/art-pipeline/asset-manifest.template.json', { encoding: 'utf8' }),
    ) as unknown;
    const result = validateArtManifest(template);
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain('MANIFEST_IS_TEMPLATE');
  });

  it('rejects any truthy template marker even when assets pass the ordinary gate', () => {
    const result = validateArtManifest(manifest({ template: true, assets: [APPROVED_ASSET] }));
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain('MANIFEST_IS_TEMPLATE');
  });

  it('requires a supported schemaVersion, manifestId and assets array', () => {
    expect(codes(validateArtManifest(manifest({ schemaVersion: undefined })))).toContain('MISSING_SCHEMA_VERSION');
    expect(codes(validateArtManifest(manifest({ schemaVersion: 99 })))).toContain('UNSUPPORTED_SCHEMA_VERSION');
    expect(codes(validateArtManifest(manifest({ manifestId: '  ' })))).toContain('MISSING_MANIFEST_ID');
    expect(codes(validateArtManifest(manifest({ assets: undefined })))).toContain('MISSING_ASSETS');
    expect(codes(validateArtManifest(null))).toContain('INVALID_MANIFEST');
    expect(codes(validateArtManifest([]))).toContain('INVALID_MANIFEST');
  });

  it('rejects invalid status, owner, intakeFolder and budget shapes', () => {
    expect(codes(validateArtManifest(manifest({ status: 'verified-ish' })))).toContain('INVALID_MANIFEST_STATUS');
    expect(codes(validateArtManifest(manifest({ owner: 42 })))).toContain('INVALID_OWNER');
    expect(codes(validateArtManifest(manifest({ intakeFolder: '' })))).toContain('INVALID_INTAKE_FOLDER');
    expect(codes(validateArtManifest(manifest({ perAssetBudgetBytes: 0 })))).toContain('INVALID_PER_ASSET_BUDGET');
    expect(codes(validateArtManifest(manifest({ totalBudgetBytes: -1 })))).toContain('INVALID_TOTAL_BUDGET');
  });

  it('forbids missing license and source on an approved asset', () => {
    const noLicense: Record<string, unknown> = { ...APPROVED_ASSET };
    delete noLicense.license;
    expect(codes(validateArtManifest(manifest({ assets: [noLicense] })))).toContain('APPROVED_MISSING_LICENSE');

    const noSource: Record<string, unknown> = { ...APPROVED_ASSET };
    delete noSource.source;
    expect(codes(validateArtManifest(manifest({ assets: [noSource] })))).toContain('APPROVED_MISSING_SOURCE');

    const blankLicense = validateArtManifest(manifest({ assets: [{ ...APPROVED_ASSET, license: '   ' }] }));
    expect(codes(blankLicense)).toContain('APPROVED_MISSING_LICENSE');
  });

  it('requires the remaining human-attested provenance fields on an approved asset', () => {
    for (const [field, code] of [
      ['author', 'APPROVED_MISSING_AUTHOR'],
      ['origin', 'APPROVED_MISSING_ORIGIN'],
      ['createdDate', 'APPROVED_MISSING_CREATED_DATE'],
      ['approvedDate', 'APPROVED_MISSING_DATE'],
      ['approvedBy', 'APPROVED_WITHOUT_REVIEWER'],
      ['checksum', 'APPROVED_MISSING_CHECKSUM'],
      ['sizeBytes', 'APPROVED_MISSING_SIZE'],
    ] as const) {
      const asset: Record<string, unknown> = { ...APPROVED_ASSET };
      delete asset[field];
      expect(codes(validateArtManifest(manifest({ assets: [asset] })))).toContain(code);
    }
  });

  it('rejects malformed dates, checksums, sizes, paths and enum values', () => {
    expect(
      codes(validateArtManifest(manifest({ assets: [{ ...APPROVED_ASSET, approvedDate: '22-11-2026' }] }))),
    ).toContain('INVALID_APPROVED_DATE');
    expect(codes(validateArtManifest(manifest({ assets: [{ ...APPROVED_ASSET, checksum: 'md5:abc' }] })))).toContain(
      'INVALID_CHECKSUM',
    );
    expect(codes(validateArtManifest(manifest({ assets: [{ ...APPROVED_ASSET, sizeBytes: -3 }] })))).toContain(
      'INVALID_SIZE',
    );
    expect(codes(validateArtManifest(manifest({ assets: [{ ...APPROVED_ASSET, file: '../secret.svg' }] })))).toContain(
      'UNSAFE_ASSET_PATH',
    );
    expect(codes(validateArtManifest(manifest({ assets: [{ ...APPROVED_ASSET, kind: 'poster' }] })))).toContain(
      'INVALID_KIND',
    );
    expect(codes(validateArtManifest(manifest({ assets: [{ ...APPROVED_ASSET, status: 'verified' }] })))).toContain(
      'INVALID_STATUS',
    );
    expect(codes(validateArtManifest(manifest({ assets: [{ ...APPROVED_ASSET, origin: 'scraped' }] })))).toContain(
      'INVALID_ORIGIN',
    );
  });

  it('warns (without failing) on incomplete drafts', () => {
    const draft = {
      id: 'portrait-meera-neutral-v1',
      kind: 'portrait',
      file: 'portraits/meera/neutral.webp',
      status: 'draft',
    };
    const result = validateArtManifest(manifest({ assets: [draft] }));
    expect(result.ok).toBe(true);
    const warnList = warningCodes(result);
    expect(warnList).toContain('ORIGIN_UNDECLARED');
    expect(warnList).toContain('LICENSE_UNDECLARED');
    expect(warnList).toContain('SOURCE_UNDECLARED');
  });

  it('warns on per-asset and total size budget overruns', () => {
    const bigAsset = { ...APPROVED_ASSET, sizeBytes: 2_000_000 };
    const result = validateArtManifest(manifest({ assets: [bigAsset], totalBudgetBytes: 1_000_000 }));
    expect(result.ok).toBe(true);
    expect(warningCodes(result)).toContain('ASSET_OVER_SIZE_BUDGET');
    expect(warningCodes(result)).toContain('TOTAL_OVER_SIZE_BUDGET');
  });

  it('warns about unconfirmed generative-output rights and missing usage location', () => {
    const aiAsset: Record<string, unknown> = {
      ...APPROVED_ASSET,
      origin: 'ai-generated',
      notes: undefined,
    };
    delete aiAsset.rightsNote;
    delete aiAsset.usedAt;
    const warnList = warningCodes(validateArtManifest(manifest({ assets: [aiAsset] })));
    expect(warnList).toContain('AI_RIGHTS_UNCONFIRMED');
    expect(warnList).toContain('NO_USAGE_LOCATION');
  });

  it('propagates asset-level errors with their record position and id', () => {
    const result = validateArtManifest(
      manifest({
        assets: [
          { ...APPROVED_ASSET, id: 'bad-asset', license: '   ' },
          { ...APPROVED_ASSET, id: 'second-asset' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.assets?.invalid).toBe(1);
    expect(result.errors[0]?.message).toContain('assets[0] "bad-asset"');
  });

  it('emits consistency warnings for an ownerless or prematurely approved manifest', () => {
    const ownerless = validateArtManifest(manifest({ owner: null, assets: [APPROVED_ASSET] }));
    expect(ownerless.ok).toBe(true);
    expect(warningCodes(ownerless)).toContain('NO_ART_OWNER');

    const approved = validateArtManifest(manifest({ status: 'approved', assets: [APPROVED_ASSET] }));
    expect(warningCodes(approved)).toContain('APPROVED_MANIFEST_UNRESOLVED_DECISIONS');

    const resolved = validateArtManifest(
      manifest({
        status: 'approved',
        styleDecision: 'D-002 recorded',
        rightsDecision: 'D-012 recorded',
        licenseDecision: 'D-018 recorded',
        assets: [APPROVED_ASSET],
      }),
    );
    expect(warningCodes(resolved)).not.toContain('APPROVED_MANIFEST_UNRESOLVED_DECISIONS');

    expect(warningCodes(validateArtManifest(manifest({ status: 'approved' })))).toContain('APPROVED_MANIFEST_EMPTY');
  });

  it('validates a single asset directly and rejects non-objects', () => {
    expect(validateArtAsset(APPROVED_ASSET).ok).toBe(true);
    expect(validateArtAsset(null).errors[0]?.code).toBe('INVALID_ASSET');
    expect(validateArtAsset('asset').errors[0]?.code).toBe('INVALID_ASSET');
  });

  it('accepts a real manifest of original in-repo records while rejecting the template', () => {
    const real = JSON.parse(readFileSync('docs/art-pipeline/asset-manifest.json', { encoding: 'utf8' })) as Record<
      string,
      unknown
    >;
    const result = validateArtManifest(real);
    expect(real.template).toBe(false);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.assets?.total).toBeGreaterThan(0);
    expect(result.assets?.invalid).toBe(0);
    for (const asset of result.assets?.results ?? []) {
      expect(asset.ok).toBe(true);
    }

    const template = JSON.parse(
      readFileSync('docs/art-pipeline/asset-manifest.template.json', { encoding: 'utf8' }),
    ) as unknown;
    expect(codes(validateArtManifest(template))).toContain('MANIFEST_IS_TEMPLATE');
  });

  it('rejects duplicate asset ids and duplicate file paths', () => {
    const duplicateId = validateArtManifest(
      manifest({ assets: [APPROVED_ASSET, { ...APPROVED_ASSET, id: APPROVED_ASSET.id }] }),
    );
    expect(duplicateId.ok).toBe(false);
    expect(codes(duplicateId)).toContain('DUPLICATE_ASSET_ID');

    const duplicateFile = validateArtManifest(
      manifest({ assets: [APPROVED_ASSET, { ...APPROVED_ASSET, id: 'other-id' }] }),
    );
    expect(duplicateFile.ok).toBe(false);
    expect(codes(duplicateFile)).toContain('DUPLICATE_ASSET_FILE');
  });
});
