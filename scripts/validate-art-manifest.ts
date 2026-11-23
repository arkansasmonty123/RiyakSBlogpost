/**
 * Offline art-asset manifest validator for the Phase 5 art pipeline (D-002/D-012/D-018).
 *
 *   npm run validate:art-manifest -- docs/art-pipeline/asset-manifest.json
 *   npm run validate:art-manifest -- --template
 *
 * The --template form validates the shipped shape template and is EXPECTED TO FAIL: it proves
 * that a template can never be mistaken for an approved, rights-cleared asset pack. With no path,
 * the real manifest (docs/art-pipeline/asset-manifest.json) is used; it currently records only
 * lightweight ORIGINAL in-repo SVG placeholders with self-attested authorship. Nothing is
 * downloaded, written, ingested or approved by this tool, and D-002/D-012/D-018 still await the
 * named owner's human sign-off.
 *
 * Exit codes: 0 = all assets valid, 1 = manifest/assets failed validation,
 * 2 = usage/IO error.
 */

import { readFileSync } from 'node:fs';
import { validateArtManifest } from '@/domain/artManifestValidation';
import type { ArtValidationIssue } from '@/domain/artManifestValidation';

const DEFAULT_MANIFEST = 'docs/art-pipeline/asset-manifest.json';
const TEMPLATE_MANIFEST = 'docs/art-pipeline/asset-manifest.template.json';

const USAGE = [
  'Usage:',
  '  npm run validate:art-manifest -- <path-to-manifest.json>',
  '  npm run validate:art-manifest -- --template   (validate the template; expected to FAIL)',
  '',
  `With no path, ${DEFAULT_MANIFEST} is used if present.`,
  '',
  'A manifest is a JSON object with schemaVersion, manifestId, status',
  '(blocked|draft|in-review|approved), owner (null until assigned), optional budget overrides,',
  'and an assets array. Approved assets require full human-attested provenance:',
  'license, source, author, origin, createdDate, approvedDate, approvedBy, sha256 checksum, sizeBytes.',
  'See docs/art-pipeline/README.md.',
  '',
  'The real manifest records only lightweight ORIGINAL in-repo SVG placeholders (self-attested',
  'authorship, no third-party assets). D-002/D-012/D-018 still await the named owner: choose a',
  'style, clear asset rights and decide the content/asset licence. This tool never approves anything.',
].join('\n');

function reportIssue(issue: ArtValidationIssue, label: string): void {
  const field = issue.field ? ` [${issue.field}]` : '';
  const prefix = issue.severity === 'warning' ? 'WARN' : 'ERROR';
  process.stderr.write(`${prefix} ${issue.code}${field} (${label}): ${issue.message}\n`);
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  const path = args.includes('--template') ? TEMPLATE_MANIFEST : (args[0] ?? DEFAULT_MANIFEST);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, { encoding: 'utf8' })) as unknown;
  } catch (error) {
    process.stderr.write(`Could not read/parse art manifest at "${path}": ${String(error)}\n`);
    process.stderr.write('Pass a valid manifest path, or use --template to validate the shipped template.\n');
    return 2;
  }

  const result = validateArtManifest(parsed);
  process.stdout.write(`Art manifest: ${path}\n`);
  process.stdout.write(`  schemaVersion: ${result.schemaVersion ?? '(missing)'}\n`);
  process.stdout.write(`  status: ${result.status ?? '(missing)'}\n`);
  process.stdout.write(`  assets: ${result.assets?.total ?? 0}\n`);
  process.stdout.write(`  total size: ${result.totalSizeBytes ?? 0} bytes\n`);

  for (const error of result.errors) reportIssue(error, 'manifest');
  for (const warning of result.warnings) reportIssue(warning, 'manifest');

  if (result.ok) {
    process.stdout.write(`PASS: manifest valid; ${result.assets?.total ?? 0} asset record(s) valid.\n`);
    return 0;
  }
  process.stderr.write('FAIL: manifest rejected. Nothing was downloaded, ingested or approved.\n');
  return 1;
}

process.exit(main());
