/**
 * Offline corpus-manifest validator for the D-005/D-011 content-owner workflow.
 *
 *   npm run validate:legal-corpus -- docs/legal-corpus/manifest.json
 *   npm run validate:legal-corpus -- --template
 *
 * The --template form validates the shipped shape template and is EXPECTED TO FAIL: it proves
 * that a template can never be mistaken for a real, ingestible corpus. Nothing is written,
 * ingested or marked verified by this tool.
 *
 * Exit codes: 0 = all records valid, 1 = manifest/records failed validation,
 * 2 = usage/IO error.
 */

import { readFileSync } from 'node:fs';
import { validateCorpusManifest } from '@/domain/sourceValidation';
import type { ValidationIssue } from '@/domain/sourceValidation';

const DEFAULT_MANIFEST = 'docs/legal-corpus/manifest.json';
const TEMPLATE_MANIFEST = 'docs/legal-corpus/manifest.template.json';

const USAGE = [
  'Usage:',
  '  npm run validate:legal-corpus -- <path-to-manifest.json>',
  '  npm run validate:legal-corpus -- --template   (validate the template; expected to FAIL)',
  '',
  `With no path, ${DEFAULT_MANIFEST} is used if present.`,
  '',
  'A manifest is a JSON object with schemaVersion, corpusId, status (blocked|draft|in-review|approved),',
  'owner (null until assigned), an optional intakeFolder, reviewedOfficialIdentifiers (human allowlist)',
  'and a sources array of LegalSource records. See docs/legal-corpus/README.md.',
  '',
  'No real corpus is shipped: D-005/D-011 remain blocked until a legal content owner supplies and',
  'signs off official text. This tool never verifies or fabricates anything.',
].join('\n');

function reportIssue(issue: ValidationIssue, label: string): void {
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
    process.stderr.write(`Could not read/parse corpus manifest at "${path}": ${String(error)}\n`);
    process.stderr.write(
      'No real corpus manifest is shipped yet (D-005/D-011 blocked). Use --template to check the template.\n',
    );
    return 2;
  }

  const result = validateCorpusManifest(parsed);
  process.stdout.write(`Corpus manifest: ${path}\n`);
  process.stdout.write(`  schemaVersion: ${result.schemaVersion ?? '(missing)'}\n`);
  process.stdout.write(`  status: ${result.status ?? '(missing)'}\n`);
  process.stdout.write(`  source records: ${result.sources?.total ?? 0}\n`);

  for (const error of result.errors) reportIssue(error, 'manifest');
  for (const warning of result.warnings) reportIssue(warning, 'manifest');

  if (result.ok) {
    process.stdout.write(`PASS: manifest valid; ${result.sources?.total ?? 0} source record(s) valid.\n`);
    return 0;
  }
  process.stderr.write('FAIL: manifest rejected. Nothing was ingested or verified.\n');
  return 1;
}

process.exit(main());
