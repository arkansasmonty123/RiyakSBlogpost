/**
 * Offline source-record validator for the D-005/D-011 content-owner workflow.
 *
 *   npm run validate:sources -- --seed
 *   npm run validate:sources -- docs/examples/legal-sources.example.json
 *
 * For a corpus manifest (with schemaVersion/corpusId/owner/status), use the manifest-aware
 * CLI instead: npm run validate:legal-corpus -- <path-to-manifest.json>
 *
 * Exit codes: 0 = all records valid, 1 = at least one record failed validation,
 * 2 = usage/IO error. Nothing is written, ingested or marked verified by this tool.
 */

import { readFileSync } from 'node:fs';
import { createInitialSave } from '@/domain/seed';
import { validateSourceRecords } from '@/domain/sourceValidation';
import type { SourceValidationOptions, ValidationIssue } from '@/domain/sourceValidation';

interface CorpusFile {
  sources?: unknown[];
  reviewedOfficialIdentifiers?: string[];
}

const USAGE = [
  'Usage:',
  '  npm run validate:sources -- --seed',
  '  npm run validate:sources -- <path-to-corpus.json>',
  '',
  'Corpus JSON shape:',
  '  { "reviewedOfficialIdentifiers": [], "sources": [ ...LegalSource records... ] }',
  '  (a bare array of source records is also accepted)',
  '',
  'reviewedOfficialIdentifiers is the human-reviewed allowlist. It must stay empty',
  'until a content owner has checked exact text against an official publication.',
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
  if (args.length === 0) {
    process.stderr.write(`${USAGE}\n\nNo input given.\n`);
    return 2;
  }

  let sources: unknown[];
  let options: SourceValidationOptions = {};

  if (args.includes('--seed')) {
    sources = createInitialSave().legalSources;
    process.stdout.write('Validating the in-app seed corpus...\n');
  } else {
    const path = args[0];
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, { encoding: 'utf8' })) as unknown;
    } catch (error) {
      process.stderr.write(`Could not read/parse corpus JSON at "${path}": ${String(error)}\n`);
      return 2;
    }

    // A manifest carries pipeline metadata that this record-only CLI does not understand.
    // Point the operator at the manifest-aware validator rather than silently ignoring it.
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      ('schemaVersion' in parsed || 'corpusId' in parsed || 'template' in parsed)
    ) {
      process.stderr.write(
        'This looks like a corpus manifest. Use `npm run validate:legal-corpus -- <path>` instead.\n',
      );
      return 2;
    }

    const corpus = (Array.isArray(parsed) ? { sources: parsed } : parsed) as CorpusFile;
    if (!corpus || typeof corpus !== 'object' || !Array.isArray(corpus.sources)) {
      process.stderr.write('Corpus JSON must be an array of source records or an object with a "sources" array.\n');
      return 2;
    }
    sources = corpus.sources;
    options = {
      reviewedOfficialIdentifiers: Array.isArray(corpus.reviewedOfficialIdentifiers)
        ? corpus.reviewedOfficialIdentifiers
        : [],
    };
    process.stdout.write(`Validating ${sources.length} source record(s) from ${path}...\n`);
  }

  const batch = validateSourceRecords(sources, options);
  const errors = batch.results.reduce((count, result) => count + result.errors.length, 0);
  const warnings = batch.results.reduce((count, result) => count + result.warnings.length, 0);
  for (const result of batch.results) {
    const label = `record ${result.index + 1}${result.id ? ` "${result.id}"` : ''}`;
    for (const error of result.errors) reportIssue(error, label);
    for (const warning of result.warnings) reportIssue(warning, label);
  }
  process.stdout.write(
    `Summary: ${batch.total} record(s), ${batch.invalid} invalid, ${errors} error(s), ${warnings} warning(s).` +
      (batch.duplicateIds.length ? ` Duplicate ids: ${batch.duplicateIds.join(', ')}.` : '') +
      '\n',
  );

  if (batch.ok) {
    process.stdout.write('STATUS: VALID — nothing was ingested or verified by this tool.\n');
    process.stdout.write(
      '  - A named content owner must still sign off official text before any record is authoritative (D-005/D-011).\n',
    );
    return 0;
  }
  process.stderr.write('STATUS: BLOCKED — no records were ingested or verified.\n');
  process.stderr.write(
    '  - Fix the errors above; keep stand-ins non-authoritative and only allowlist citations a human checked.\n',
  );
  return 1;
}

process.exit(main());
