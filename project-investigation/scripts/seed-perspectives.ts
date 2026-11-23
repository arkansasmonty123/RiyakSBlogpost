// M5 perspective seed: loads the 7 frameworks and the authored experiences
// from the typed registry into the additive migration-009 tables.
//
//   npm run db:seed:perspectives
//
// SAFETY / NON-LEAKAGE:
//   * Idempotent, keyed upserts (framework_key / experience_key).
//   * The additive migration is applied defensively so this works on a fresh
//     DB as well as one where CI already applied it.
//   * No source is auto-verified: seed content carries its own
//     verification_status (default pending_review in the registry) and the
//     API DTO withholds every URL unless explicitly verified.
//   * No canonical truth, culprit, hidden location or evidence UUID is written.
//   * Framework keys that are no longer authored are retired (status change,
//     never deletion) so the published lens list converges on the registry.
//
// M5-CONTENT has populated src/perspectives/experiences/index.ts with the 12
// final experiences; this script needed no change for that registry update.

import fs from 'node:fs';
import path from 'node:path';
import { pool, query } from '../src/db';
import { FRAMEWORKS } from '../src/perspectives/frameworks';
import { PERSPECTIVE_EXPERIENCES } from '../src/perspectives/experiences/index';
import type { ExperienceDefinition, FrameworkDefinition } from '../src/perspectives/types';

async function applyMigration(): Promise<void> {
  const resolved = path.resolve(process.cwd(), 'migrations', '009_m5_perspective_engine.sql');
  if (!fs.existsSync(resolved)) throw new Error(`Missing migration: ${resolved}`);
  await query(fs.readFileSync(resolved, 'utf8'));
}

const FRAMEWORK_FIELDS: Array<[keyof FrameworkDefinition, string]> = [
  ['frameworkKey', 'framework_key'],
  ['name', 'name'],
  ['intellectualDomain', 'intellectual_domain'],
  ['summary', 'summary'],
  ['coreQuestions', 'core_questions'],
  ['keyConcepts', 'key_concepts'],
  ['methodOfReasoning', 'method_of_reasoning'],
  ['limitations', 'limitations'],
  ['commonMisconceptions', 'common_misconceptions'],
  ['internalDifferences', 'internal_differences'],
  ['relevantDisciplines', 'relevant_disciplines'],
  ['displayOrder', 'display_order'],
  ['status', 'status'],
];
const FRAMEWORK_JSONB = new Set(['core_questions', 'key_concepts', 'limitations', 'common_misconceptions', 'internal_differences', 'relevant_disciplines']);

const EXPERIENCE_FIELDS: Array<[keyof ExperienceDefinition, string]> = [
  ['experienceKey', 'experience_key'],
  ['title', 'title'],
  ['frameworkKey', 'framework_key'],
  ['format', 'format'],
  ['knowledgeClass', 'knowledge_class'],
  ['perspectiveClass', 'perspective_class'],
  ['scopeNote', 'scope_note'],
  ['traditionScope', 'tradition_scope'],
  ['intellectualPurpose', 'intellectual_purpose'],
  ['primaryQuestion', 'primary_question'],
  ['introduction', 'introduction'],
  ['intellectualBackground', 'intellectual_background'],
  ['mainIdea', 'main_idea'],
  ['detailedExplanation', 'detailed_explanation'],
  ['sections', 'sections'],
  ['historicalContext', 'historical_context'],
  ['epistemicBreakdown', 'epistemic_breakdown'],
  ['keyConcepts', 'key_concepts'],
  ['supportingSources', 'supporting_sources'],
  ['limitations', 'limitations'],
  ['counterarguments', 'counterarguments'],
  ['commonMisconceptions', 'common_misconceptions'],
  ['reflectionQuestions', 'reflection_questions'],
  ['activities', 'activities'],
  ['recommendationTags', 'recommendation_tags'],
  ['relatedExperienceKeys', 'related_experience_keys'],
  ['relatedSpecialistKeys', 'related_specialist_keys'],
  ['relatedArtifactKeys', 'related_artifact_keys'],
  ['relatedCaseTitles', 'related_case_titles'],
  ['estimatedMinutes', 'estimated_minutes'],
  ['difficulty', 'difficulty'],
  ['displayOrder', 'display_order'],
  ['status', 'status'],
];
const EXPERIENCE_JSONB = new Set([
  'sections', 'epistemic_breakdown', 'key_concepts', 'supporting_sources', 'limitations',
  'counterarguments', 'common_misconceptions', 'reflection_questions', 'activities',
  'recommendation_tags', 'related_experience_keys', 'related_specialist_keys',
  'related_artifact_keys', 'related_case_titles',
]);

function upsertSql(table: string, fields: Array<[string, string]>, keyColumn: string): string {
  const columns = fields.map(([, column]) => column);
  const placeholders = fields.map((_, i) => `$${i + 1}`);
  const updates = columns
    .filter((column) => column !== keyColumn)
    .map((column) => `${column} = EXCLUDED.${column}`);
  return `INSERT INTO ${table} (${columns.join(', ')})
          VALUES (${placeholders.join(', ')})
          ON CONFLICT (${keyColumn}) DO UPDATE SET ${updates.join(', ')}, updated_at = NOW()`;
}

async function upsertFramework(framework: FrameworkDefinition): Promise<void> {
  const values = FRAMEWORK_FIELDS.map(([field, column]) => {
    const value = framework[field];
    return FRAMEWORK_JSONB.has(column) ? JSON.stringify(value) : value;
  });
  await query(upsertSql('perspective_frameworks', FRAMEWORK_FIELDS, 'framework_key'), values);
}

async function upsertExperience(experience: ExperienceDefinition): Promise<void> {
  const values = EXPERIENCE_FIELDS.map(([field, column]) => {
    const value = experience[field];
    return EXPERIENCE_JSONB.has(column) ? JSON.stringify(value) : value;
  });
  await query(upsertSql('perspective_experiences', EXPERIENCE_FIELDS, 'experience_key'), values);
}

/** Retire (never delete) previously seeded frameworks that are no longer in
 *  the authored registry. Keeps the published lens list aligned with the spec
 *  while preserving historical rows and reflection provenance. */
async function retireStaleFrameworks(): Promise<number> {
  const keys = FRAMEWORKS.map((f) => f.frameworkKey);
  const result = await query(
    `UPDATE perspective_frameworks
        SET status = 'retired', updated_at = NOW()
      WHERE status <> 'retired' AND NOT (framework_key = ANY($1::text[]))
      RETURNING framework_key`,
    [keys],
  );
  return result.rowCount ?? 0;
}

async function main(): Promise<void> {
  console.log('M5 Perspective seed (idempotent)\n');
  await applyMigration();

  const retired = await retireStaleFrameworks();
  if (retired > 0) console.log(`  retired ${retired} superseded framework row(s)`);

  for (const framework of FRAMEWORKS) {
    await upsertFramework(framework);
    console.log(`  framework: ${framework.frameworkKey}`);
  }
  for (const experience of PERSPECTIVE_EXPERIENCES) {
    await upsertExperience(experience);
    console.log(`  experience: ${experience.experienceKey}`);
  }

  console.log(`\nTotals: ${FRAMEWORKS.length} published frameworks, ${PERSPECTIVE_EXPERIENCES.length} experiences`);
  if (PERSPECTIVE_EXPERIENCES.length < 12) {
    throw new Error(`Expected 12 authored experiences, found ${PERSPECTIVE_EXPERIENCES.length}`);
  }
  console.log('PERSPECTIVES SEED: PASS');
}

main()
  .catch((err: Error) => {
    console.error('PERSPECTIVES SEED: FAIL');
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
