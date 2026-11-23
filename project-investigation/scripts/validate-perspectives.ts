// M5 Perspective Engine validation (READ-ONLY).
//
//   npm run perspectives:validate
//
// Validates the additive migration-009 schema, the 7 authored frameworks, the
// authored experiences (when present), source/provenance rules, no long quotes,
// no canonical-leakage terms in shipped strings, and a static purity guard on
// the recommender and DTO modules. Runs only SELECT statements; never writes.
// Canonical solution strings are NEVER printed in check messages.
//
// M5-CONTENT: the experience count is a hard failure by default (12); a CI or
// local override may raise it further via PERSPECTIVES_MIN_EXPERIENCES.
// The script is READ-ONLY: only SELECT statements are issued against the DB.

import fs from 'node:fs';
import path from 'node:path';
import { pool, query } from '../src/db';
import { FRAMEWORKS } from '../src/perspectives/frameworks';
import { PERSPECTIVE_EXPERIENCES } from '../src/perspectives/experiences/index';
import {
  PERSPECTIVE_LIMITS,
  isDifficulty,
  isExperienceStatus,
  isPerspectiveClass,
  isPerspectiveFormat,
  isPerspectiveKnowledgeClass,
} from '../src/perspectives/types';
import { toPublicSources } from '../src/perspectives/dto';
import { VERIFICATION_STATUSES, SOURCE_TYPES } from '../src/knowledge';

const EXPECTED_COLUMNS: Record<string, string[]> = {
  perspective_frameworks: [
    'id', 'framework_key', 'name', 'intellectual_domain', 'summary', 'core_questions',
    'key_concepts', 'method_of_reasoning', 'limitations', 'common_misconceptions',
    'internal_differences', 'relevant_disciplines', 'display_order', 'status',
    'created_at', 'updated_at',
  ],
  perspective_experiences: [
    'id', 'experience_key', 'title', 'framework_key', 'format', 'knowledge_class',
    'perspective_class', 'scope_note', 'tradition_scope', 'intellectual_purpose',
    'primary_question', 'introduction', 'intellectual_background', 'main_idea',
    'detailed_explanation', 'sections', 'historical_context', 'epistemic_breakdown',
    'key_concepts', 'supporting_sources', 'limitations', 'counterarguments',
    'common_misconceptions', 'reflection_questions', 'activities', 'recommendation_tags',
    'related_experience_keys', 'related_specialist_keys', 'related_artifact_keys',
    'related_case_titles', 'estimated_minutes', 'difficulty', 'display_order', 'status',
    'created_at', 'updated_at',
  ],
  perspective_reflections: [
    'id', 'experience_id', 'experience_key', 'user_id', 'investigation_id', 'prompt_index',
    'prompt', 'reflection_kind', 'response', 'created_at', 'updated_at',
  ],
  perspective_suggestion_state: [
    'id', 'investigation_id', 'user_id', 'experience_key', 'reason_code',
    'state_fingerprint', 'status', 'created_at', 'updated_at',
  ],
  investigation_claims: [
    'source_perspective_experience_id', 'source_perspective_reflection_id',
  ],
  notebook_entries: ['perspective_experience_id'],
};

let failures = 0;
let warnings = 0;
function check(condition: boolean, message: string): void {
  if (condition) console.log(`  ✅ ${message}`);
  else { console.log(`  ❌ ${message}`); failures += 1; }
}
function warn(condition: boolean, message: string): void {
  if (!condition) { console.log(`  ⚠️  ${message}`); warnings += 1; }
}

function parseJson(value: unknown): any {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (typeof value === 'string') { try { return JSON.parse(value); } catch { return null; } }
  return null;
}
function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}
function hasContent(value: unknown, min = 20): boolean {
  return text(value).trim().length >= min;
}
function arr(value: unknown): unknown[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : [];
}

// Canonical/character terms that must never appear in shipped perspective text.
const LEAK_TERMS = [
  'Victor Sterling', 'Sterling Holdings', 'hollow base', 'silver trophy', '20 million',
  'Paul Kent', 'Dr. Paul Kent', 'gambling debts', 'silenced Amy',
  'Victor Ames', 'embezzled from the bakery', 'audit the books',
  'canonical truth', 'hidden evidence', 'hidden_events', 'culprit',
];
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function scanShippedText(value: unknown, label: string): void {
  const serialized = JSON.stringify(value ?? '');
  for (const term of LEAK_TERMS) {
    check(!serialized.toLowerCase().includes(term.toLowerCase()), `${label}: no leaked term (${term})`);
  }
  check(!UUID_RE.test(serialized), `${label}: no raw UUID appears in shipped content`);
}

function staticPurityCheck(relPath: string, label: string): void {
  const modulePath = path.join(process.cwd(), relPath);
  let source = '';
  try { source = fs.readFileSync(modulePath, 'utf8'); }
  catch { check(false, `cannot read ${relPath}`); return; }
  const codeOnly = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
  check(!/canonical_truth|getCanonicalTruth/i.test(codeOnly), `${label}: no canonical truth reference`);
  check(!/from\s+['"](\.\.\/)+db['"]/i.test(codeOnly) && !/from\s+['"]\.\/db['"]/i.test(codeOnly), `${label}: no db import`);
  check(!/from\s+['"](\.\.\/)+server['"]/i.test(codeOnly) && !/from\s+['"]\.\/server['"]/i.test(codeOnly), `${label}: no server import`);
  check(!/\b(UPDATE|INSERT|DELETE|DROP)\s+(INTO|FROM|TABLE)?\s*(public\.)?(investigation|users|evidence|canonical)/i.test(codeOnly), `${label}: no SQL mutation statements`);
}

async function main(): Promise<void> {
  console.log('M5 Perspective Engine validation (read-only)\n');

  console.log('== Schema ==');
  const colsResult = await query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`
  );
  const cols = colsResult.rows as Array<{ table_name: string; column_name: string }>;
  const byTable = new Map<string, Set<string>>();
  for (const row of cols) {
    if (!byTable.has(row.table_name)) byTable.set(row.table_name, new Set());
    byTable.get(row.table_name)?.add(row.column_name);
  }
  for (const [table, expected] of Object.entries(EXPECTED_COLUMNS)) {
    const actual = byTable.get(table);
    check(!!actual, `table ${table} exists`);
    if (actual) {
      const missing = expected.filter((c) => !actual.has(c));
      check(missing.length === 0, `table ${table} has expected columns${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
    }
  }

  console.log('\n== Frameworks (seeded) ==');
  const frameworkRows = (
    await query("SELECT * FROM perspective_frameworks WHERE status = 'published' ORDER BY display_order, framework_key")
  ).rows;
  check(frameworkRows.length === 7, `7 frameworks seeded (found ${frameworkRows.length})`);
  const dbKeys = new Set<string>();
  for (const row of frameworkRows) {
    const key = text(row.framework_key);
    dbKeys.add(key);
    check(key.length > 0, `framework has key (${key})`);
    check(hasContent(row.name, 4), `${key}: substantive name`);
    check(hasContent(row.intellectual_domain, 4), `${key}: intellectual domain`);
    check(hasContent(row.summary, 40), `${key}: substantive summary`);
    check(hasContent(row.method_of_reasoning, 60), `${key}: substantive method of reasoning`);
    for (const field of ['core_questions', 'key_concepts', 'limitations', 'common_misconceptions', 'internal_differences', 'relevant_disciplines']) {
      check(arr(row[field]).length > 0, `${key}: ${field} non-empty`);
    }
    check(['draft', 'published', 'retired'].includes(text(row.status)), `${key}: valid status`);
  }

  console.log('\n== Frameworks (authored registry) ==');
  check(FRAMEWORKS.length === PERSPECTIVE_LIMITS.expectedFrameworkCount, `registry has 7 frameworks (found ${FRAMEWORKS.length})`);
  const registryKeys = new Set<string>();
  for (const f of FRAMEWORKS) {
    check(!registryKeys.has(f.frameworkKey), `framework key unique: ${f.frameworkKey}`);
    registryKeys.add(f.frameworkKey);
    check(dbKeys.has(f.frameworkKey), `seeded framework matches registry: ${f.frameworkKey}`);
    check(f.coreQuestions.length >= 4, `${f.frameworkKey}: >=4 core questions`);
    check(f.keyConcepts.length >= 5, `${f.frameworkKey}: >=5 key concepts`);
    check(f.limitations.length >= 3, `${f.frameworkKey}: >=3 limitations`);
    check(f.commonMisconceptions.length >= 3, `${f.frameworkKey}: >=3 misconceptions`);
    check(f.internalDifferences.length >= 2, `${f.frameworkKey}: >=2 internal differences`);
    check(f.relevantDisciplines.length >= 2, `${f.frameworkKey}: >=2 disciplines`);
    check(hasContent(f.methodOfReasoning, 60), `${f.frameworkKey}: substantive method`);
    check(isExperienceStatus(f.status), `${f.frameworkKey}: valid status`);
    scanShippedText(f, `framework ${f.frameworkKey}`);
  }

  console.log('\n== Experiences (authored registry) ==');
  const publishedTitles = new Set<string>(
    (await query("SELECT title FROM cases WHERE publication_status = 'published'")).rows
      .map((row: any) => text(row.title)),
  );
  check(publishedTitles.size > 0, 'published case titles available for bridge validation');
  const experienceKeys = new Set<string>();
  const experienceTitles = new Set<string>();
  const experiencePurposes = new Set<string>();
  for (const e of PERSPECTIVE_EXPERIENCES) {
    check(!experienceKeys.has(e.experienceKey), `experience key unique: ${e.experienceKey}`);
    experienceKeys.add(e.experienceKey);
    check(!experienceTitles.has(e.title.trim().toLowerCase()), `experience title unique: ${e.experienceKey}`);
    check(!experiencePurposes.has(e.intellectualPurpose.trim().toLowerCase()), `intellectual purpose unique: ${e.experienceKey}`);
    experienceTitles.add(e.title.trim().toLowerCase());
    experiencePurposes.add(e.intellectualPurpose.trim().toLowerCase());
    check(registryKeys.has(e.frameworkKey), `${e.experienceKey}: frameworkKey resolves`);
    check(isPerspectiveFormat(e.format), `${e.experienceKey}: valid format`);
    check(isPerspectiveKnowledgeClass(e.knowledgeClass), `${e.experienceKey}: valid knowledge_class`);
    check(isPerspectiveClass(e.perspectiveClass), `${e.experienceKey}: valid perspective_class`);
    check(isDifficulty(e.difficulty), `${e.experienceKey}: valid difficulty`);
    check(isExperienceStatus(e.status), `${e.experienceKey}: valid status`);
    check(hasContent(e.title, 8), `${e.experienceKey}: substantive title`);
    check(hasContent(e.scopeNote, 40), `${e.experienceKey}: substantive scope note`);
    check(hasContent(e.traditionScope, 10), `${e.experienceKey}: tradition scope stated`);
    check(hasContent(e.intellectualPurpose, 40), `${e.experienceKey}: distinct intellectual purpose`);
    check(hasContent(e.primaryQuestion, 12) && e.primaryQuestion.trim().endsWith('?'), `${e.experienceKey}: primary question ends with ?`);
    check(hasContent(e.introduction, 80), `${e.experienceKey}: substantive introduction`);
    check(hasContent(e.intellectualBackground, 80), `${e.experienceKey}: substantive intellectual background`);
    check(hasContent(e.mainIdea, 40), `${e.experienceKey}: main idea`);
    check(e.detailedExplanation.trim().length >= 1500, `${e.experienceKey}: detailed explanation >= 1500 chars`);
    check(e.sections.length >= 3, `${e.experienceKey}: >=3 sections`);
    check(e.sections.every((s) => hasContent(s.heading, 2) && hasContent(s.body, 80)), `${e.experienceKey}: sections substantive`);
    check(hasContent(e.historicalContext, 80), `${e.experienceKey}: substantive historical context`);
    check(Object.keys(e.epistemicBreakdown).length >= 2, `${e.experienceKey}: epistemic breakdown present`);
    check(e.keyConcepts.length >= 5, `${e.experienceKey}: >=5 key concepts`);
    check(e.supportingSources.length >= 1, `${e.experienceKey}: >=1 supporting source`);
    check(e.limitations.length >= 2, `${e.experienceKey}: >=2 limitations`);
    check(e.counterarguments.length >= 2, `${e.experienceKey}: >=2 counterarguments`);
    check(e.commonMisconceptions.length >= 2, `${e.experienceKey}: >=2 misconceptions`);
    check(e.reflectionQuestions.length >= 3, `${e.experienceKey}: >=3 reflection questions`);
    check(e.activities.length >= 1, `${e.experienceKey}: >=1 activity`);
    check(e.relatedCaseTitles.every((t) => publishedTitles.has(t)), `${e.experienceKey}: related case titles are published`);
    check(Number.isFinite(e.estimatedMinutes) && e.estimatedMinutes > 0, `${e.experienceKey}: valid estimatedMinutes`);
    for (const source of e.supportingSources) {
      check(VERIFICATION_STATUSES.includes(source.verificationStatus), `${e.experienceKey}: valid source verification_status`);
      if (source.sourceType !== undefined && source.sourceType !== null) {
        check(SOURCE_TYPES.includes(source.sourceType), `${e.experienceKey}: valid source_type`);
      }
      check(hasContent(source.label, 4), `${e.experienceKey}: source has label`);
      const quote = source.quote ?? '';
      check(quote.length <= PERSPECTIVE_LIMITS.maxSourceQuoteChars, `${e.experienceKey}: source quote is short`);
      if (source.verificationStatus === 'verified') {
        check(source.sourceVerified === true, `${e.experienceKey}: verified status implies source_verified`);
        check(typeof source.url === 'string' && /^https?:\/\/\S+/i.test(source.url), `${e.experienceKey}: verified source has http(s) URL`);
      } else {
        check(!source.url || text(source.url).trim().length === 0, `${e.experienceKey}: pending source exposes no URL`);
        check(hasContent(source.verificationNotes ?? source.notes, 20), `${e.experienceKey}: pending source has provenance notes`);
      }
      if (source.sourceVerified === true) {
        check(source.verificationStatus === 'verified', `${e.experienceKey}: source_verified implies verified status`);
      }
    }
    scanShippedText(e, `experience ${e.experienceKey}`);
  }
  check(
    PERSPECTIVE_EXPERIENCES.length >= PERSPECTIVE_LIMITS.expectedExperienceCount,
    `at least ${PERSPECTIVE_LIMITS.expectedExperienceCount} experiences authored (found ${PERSPECTIVE_EXPERIENCES.length})`,
  );
  const distinctFormats = new Set(PERSPECTIVE_EXPERIENCES.map((e) => e.format));
  check(distinctFormats.size >= 6, `format diversity >= 6 (found ${distinctFormats.size})`);
  const coveredFrameworks = new Set(
    PERSPECTIVE_EXPERIENCES.filter((e) => e.status === 'published').map((e) => e.frameworkKey),
  );
  for (const key of registryKeys) {
    check(coveredFrameworks.has(key), `framework ${key} has >=1 published experience`);
  }
  for (const e of PERSPECTIVE_EXPERIENCES) {
    for (const related of e.relatedExperienceKeys) {
      check(experienceKeys.has(related), `${e.experienceKey}: related key ${related} resolves`);
    }
  }

  const minRequired = Number(
    process.env.PERSPECTIVES_MIN_EXPERIENCES ?? PERSPECTIVE_LIMITS.expectedExperienceCount,
  );
  if (Number.isFinite(minRequired)) {
    check(PERSPECTIVE_EXPERIENCES.length >= minRequired, `at least ${minRequired} experiences (found ${PERSPECTIVE_EXPERIENCES.length})`);
  }

  console.log('\n== DTO provenance rule ==');
  const withheld = toPublicSources([{ label: 'Ref', url: 'https://example.invalid/source', verificationStatus: 'pending_review', sourceVerified: false }]);
  check(withheld[0]?.sourceUrl === null, 'DTO withholds URL for unverified source');
  const exposed = toPublicSources([{ label: 'Ref', url: 'https://example.invalid/source', verificationStatus: 'verified', sourceVerified: true }]);
  check(exposed[0]?.sourceUrl === 'https://example.invalid/source', 'DTO exposes URL for verified source');
  const longQuote = 'x'.repeat(PERSPECTIVE_LIMITS.maxSourceQuoteChars + 50);
  const clipped = toPublicSources([{ label: 'Ref', quote: longQuote, verificationStatus: 'draft' }]);
  check((clipped[0]?.quote ?? '').length <= PERSPECTIVE_LIMITS.maxSourceQuoteChars, 'DTO clips long quotes');

  console.log('\n== Static purity guards ==');
  staticPurityCheck('src/perspectives/recommendations.ts', 'recommendations.ts');
  staticPurityCheck('src/perspectives/dto.ts', 'dto.ts');
  console.log('  - recommender and DTO modules contain no canonical/db/server imports or SQL mutations');

  const headline = failures === 0 ? 'PASS' : `FAIL (${failures} issue(s))`;
  console.log(`\nPERSPECTIVES VALIDATE: ${headline}${warnings > 0 ? ` with ${warnings} warning(s)` : ''}`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((err: Error) => {
    console.error('PERSPECTIVES VALIDATE: FAIL (fatal)');
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
