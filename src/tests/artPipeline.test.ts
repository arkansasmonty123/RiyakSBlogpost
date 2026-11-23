import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateArtManifest } from '@/domain/artManifestValidation';

/**
 * Guards the real, non-template manifest of ORIGINAL in-repo SVG placeholders. No external asset,
 * third-party artwork, real licence claim or canonical case fact is introduced or approved here.
 * These checks confirm the committed files actually match the provenance the manifest records.
 *
 * Only the project's minimal Node shim (readFileSync with utf8) is used; no @types/node is added.
 */
const MANIFEST_PATH = 'docs/art-pipeline/asset-manifest.json';
const TEMPLATE_PATH = 'docs/art-pipeline/asset-manifest.template.json';
const ART_ROOT = 'public/assets/art';
const PROVENANCE =
  'Original in-repo placeholder created for THE BAR prototype; no third-party asset; CC0/project-owned by default for this repo';
const FORBIDDEN = ['canonicaltruth', 'actualevents', 'hiddenmotives', 'evidenceauthenticity', '18:12'];
const EXPECTED_FILES = [
  'props/chamber/bookshelf-v1.svg',
  'props/chamber/desk-v1.svg',
  'props/consultation/table-v1.svg',
  'props/reception/counter-v1.svg',
  'ui-icons/evidence-v1.svg',
];

type AssetRecord = Record<string, unknown>;

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, { encoding: 'utf8' })) as Record<string, unknown>;
}

function assetRecords(manifest: Record<string, unknown>): AssetRecord[] {
  return Array.isArray(manifest.assets) ? (manifest.assets as AssetRecord[]) : [];
}

function readSvg(file: string): string {
  return readFileSync(`${ART_ROOT}/${file}`, { encoding: 'utf8' });
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

describe('original in-repo art placeholder pipeline', () => {
  const manifest = loadJson(MANIFEST_PATH);
  const assets = assetRecords(manifest);

  it('ships a real, non-template manifest that the validator accepts', () => {
    expect(manifest.template).toBe(false);
    const result = validateArtManifest(manifest);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.assets?.total).toBe(assets.length);
    expect(result.assets?.invalid).toBe(0);
    expect(assets.length).toBeGreaterThan(0);
  });

  it('records only lightweight original assets with explicit, honest provenance', () => {
    expect(assets.length).toBe(5);
    for (const asset of assets) {
      expect(asset.origin).toBe('original');
      expect(asset.status).toBe('approved');
      expect(String(asset.license)).toContain('CC0-1.0');
      expect(String(asset.license)).toContain('no third-party rights');
      expect(String(asset.source)).toContain(PROVENANCE);
      expect(String(asset.author)).toContain('in-repo author');
      expect(String(asset.approvedBy)).toContain('self-attested original work');
      expect(String(asset.approvedBy)).toContain('NOT a named human art-owner rights sign-off');
      expect(typeof asset.sizeBytes).toBe('number');
      expect(asset.sizeBytes as number).toBeLessThan(2048);
      expect(String(asset.checksum)).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    expect(manifest.owner).toBeNull();
    expect(String(manifest.styleDecision)).toContain('D-002');
    expect(String(manifest.rightsDecision)).toContain('D-012');
    expect(String(manifest.licenseDecision)).toContain('D-018');
  });

  it('matches every recorded checksum and size to the committed SVG file', async () => {
    let total = 0;
    for (const asset of assets) {
      const file = String(asset.file);
      expect(file.startsWith('/')).toBe(false);
      const content = readSvg(file);
      expect(await sha256(content)).toBe(asset.checksum);
      // All SVGs are ASCII, so UTF-8 byte length equals the committed file size.
      expect(new TextEncoder().encode(content).length).toBe(asset.sizeBytes);
      total += new TextEncoder().encode(content).length;
    }
    expect(total).toBe(4053);
  });

  it('covers exactly the shipped SVG files - no orphan assets and no missing records', () => {
    const recorded = assets.map((asset) => String(asset.file)).sort();
    expect(recorded).toEqual([...EXPECTED_FILES].sort());
    expect(new Set(recorded).size).toBe(recorded.length);
    for (const file of recorded) expect(readSvg(file)).toContain('<svg');
  });

  it('embeds provenance in every SVG and no remote, scripted or leak-bearing payload', () => {
    for (const asset of assets) {
      const content = readSvg(String(asset.file));
      expect(content).toContain(PROVENANCE);
      expect(content.trimStart().startsWith('<!--')).toBe(true);
      expect(content).toContain('<svg');
      expect(content).toContain('aria-hidden="true"');
      expect(content).toContain('focusable="false"');
      expect(content).not.toContain('<image');
      expect(content).not.toContain('data:image');
      expect(content).not.toContain('<script');
      expect(content).not.toContain('<animate');
      // Only the fixed SVG namespace URI is permitted; no remote fetch or external reference.
      const withoutNamespace = content.replace('http://www.w3.org/2000/svg', '');
      expect(withoutNamespace).not.toContain('http://');
      expect(withoutNamespace).not.toContain('https://');
      for (const forbidden of FORBIDDEN) expect(content.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('keeps the shipped template rejected even with the real manifest present', () => {
    const result = validateArtManifest(loadJson(TEMPLATE_PATH));
    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('MANIFEST_IS_TEMPLATE');
  });

  it('rejects an approved original record whose provenance fields are missing', () => {
    const incomplete = { ...assets[0] };
    delete incomplete.source;
    expect(validateArtManifest({ ...manifest, assets: [incomplete] }).errors.map((error) => error.code)).toContain(
      'APPROVED_MISSING_SOURCE',
    );

    const noChecksum = { ...assets[0] };
    delete noChecksum.checksum;
    expect(validateArtManifest({ ...manifest, assets: [noChecksum] }).errors.map((error) => error.code)).toContain(
      'APPROVED_MISSING_CHECKSUM',
    );
  });
});
