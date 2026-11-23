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
import type { CorpusManifestResult, ValidationIssue } from '@/domain/sourceValidation';

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
  'and a sources array of LegalSource records. Optional pipeline metadata (acquisition, signoff,',
  'rights, versionPolicy, allowlistPolicy, staging) is documented in docs/legal-corpus/ACQUISITION_CHECKLIST.md.',
  '',
  'No real corpus is shipped: D-005/D-011 remain blocked until a legal content owner supplies and',
  'signs off official text. This tool never verifies or fabricates anything.',
].join('\n');

function reportIssue(issue: ValidationIssue, label: string): void {
  const field = issue.field ? ` [${issue.field}]` : '';
  const prefix = issue.severity === 'warning' ? 'WARN' : 'ERROR';
  process.stderr.write(`${prefix} ${issue.code}${field} (${label}): ${issue.message}\n`);
}

/** Actionable, deterministic guidance derived only from the codes actually emitted. */
function nextSteps(result: CorpusManifestResult): string[] {
  const codes = new Set(result.errors.map((error) => error.code));
  const steps: string[] = [];
  if (codes.has('MANIFEST_IS_TEMPLATE')) {
    steps.push(
      'This file is a TEMPLATE. Create a real manifest only after the human review workflow; templates are never ingestible.',
    );
  }
  if ([...codes].some((code) => code.startsWith('MISSING_'))) {
    steps.push(
      'Fill every required manifest/record field. Never invent a citation or URL to do so (use an internal identifier until reviewed).',
    );
  }
  if (codes.has('UNREVIEWED_SPECIFIC_CITATION')) {
    steps.push(
      'A named content owner must check the exact text against an official publication, then add the identifier to reviewedOfficialIdentifiers.',
    );
  }
  if (codes.has('PLACEHOLDER_CANNOT_BE_VERIFIED') || codes.has('TEMPLATE_OR_EXAMPLE_CANNOT_BE_VERIFIED')) {
    steps.push('Keep stand-ins/templates unverified or placeholder; they can never be marked verified.');
  }
  if (codes.has('DUPLICATE_SOURCE_ID')) {
    steps.push('Give every record a unique id so one record cannot shadow another.');
  }
  if ([...codes].some((code) => code.startsWith('INVALID_') || code === 'NON_HUMAN_REVIEWER')) {
    steps.push('Correct the malformed field(s); see the field named in each error above.');
  }
  if (result.ok) {
    steps.push(
      'A named content owner must still sign off official text and rights before any record is authoritative (D-005/D-011).',
    );
    steps.push(
      'Keep reviewedOfficialIdentifiers limited to exact citations a human checked; review version/effective dates before promotion.',
    );
  }
  if (steps.length === 0) {
    steps.push(
      'Follow docs/legal-corpus/ACQUISITION_CHECKLIST.md and docs/LEGAL_SOURCE_VERIFICATION.md, then re-run this validator.',
    );
  }
  return steps;
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
  const total = result.sources?.total ?? 0;
  const invalid = result.sources?.invalid ?? 0;
  process.stdout.write(`Corpus manifest: ${path}\n`);
  process.stdout.write(`  schemaVersion: ${result.schemaVersion ?? '(missing)'}\n`);
  process.stdout.write(`  status: ${result.status ?? '(missing)'}\n`);
  process.stdout.write(`  source records: ${total} (${total - invalid} valid, ${invalid} invalid)\n`);
  process.stdout.write(`  duplicate ids: ${result.duplicateIds?.length ? result.duplicateIds.join(', ') : 'none'}\n`);
  process.stdout.write(`Summary: ${result.errors.length} error(s), ${result.warnings.length} warning(s)\n`);

  for (const error of result.errors) reportIssue(error, 'manifest');
  for (const warning of result.warnings) reportIssue(warning, 'manifest');

  if (result.ok) {
    process.stdout.write(
      'STATUS: VALID — structure and attestations pass; nothing was ingested or verified by this tool.\n',
    );
    process.stdout.write('Next steps:\n');
    for (const step of nextSteps(result)) process.stdout.write(`  - ${step}\n`);
    return 0;
  }
  process.stderr.write('STATUS: BLOCKED — manifest rejected. Nothing was ingested or verified.\n');
  process.stderr.write('Next steps:\n');
  for (const step of nextSteps(result)) process.stderr.write(`  - ${step}\n`);
  return 1;
}

process.exit(main());
