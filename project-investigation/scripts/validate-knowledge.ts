// M2 knowledge validation (READ-ONLY).
//
//   npm run knowledge:validate
//
// Checks schema presence, specialist/artifact/disagreement content rules, the
// showcase-case minimums, and a leakage guard against canonical solution
// strings and evidence UUIDs. Runs only SELECT statements; never writes.

import { pool, query } from '../src/db';
import { toPublicArtifactSummary } from '../src/knowledge';

const CASE_ID = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc';

const EXPECTED_COLUMNS: Record<string, string[]> = {
  specialists: [
    'id', 'specialist_key', 'name', 'title', 'specialization', 'discipline',
    'knowledge_domains', 'personality', 'communication_style', 'reasoning_approach',
    'expertise_summary', 'limitations', 'depth_guidance', 'is_fictional',
    'real_discipline_basis', 'created_at', 'updated_at',
  ],
  case_specialists: ['id', 'case_id', 'specialist_id', 'case_relevance', 'display_order', 'created_at', 'updated_at'],
  knowledge_artifacts: [
    'id', 'artifact_key', 'title', 'artifact_type', 'description', 'content',
    'specialist_id', 'case_id', 'source_author', 'source_url', 'source_verified',
    'bibliography_ref', 'publication_date', 'knowledge_class', 'reliability',
    'related_concepts', 'is_fictional', 'usage_note', 'created_at', 'updated_at',
  ],
  knowledge_disagreements: [
    'id', 'disagreement_key', 'case_id', 'topic', 'specialist_a_id', 'specialist_b_id',
    'position_a', 'position_b', 'disciplinary_basis', 'uncertainty_note',
    'distinguishing_evidence', 'related_artifact_keys', 'created_at', 'updated_at',
  ],
  notebook_entries: [
    'id', 'investigation_id', 'user_id', 'entry_type', 'artifact_id', 'specialist_id',
    'concept', 'title', 'content', 'source_snapshot', 'created_at', 'updated_at',
  ],
};

const FORBIDDEN_STRINGS = ['Victor Sterling', 'hollow base', 'silver trophy'];

let failures = 0;
function check(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✅ ${message}`);
  } else {
    console.log(`  ❌ ${message}`);
    failures += 1;
  }
}

function parseJson(value: unknown): any {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return null;
}

async function main(): Promise<void> {
  console.log('M2 knowledge validation (read-only)\n');

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
      check(missing.length === 0, `table ${table} has all expected columns${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
    }
  }

  console.log('\n== Showcase case: The Midnight Heist ==');
  const caseCheck = await query('SELECT id FROM cases WHERE id = $1', [CASE_ID]);
  check(caseCheck.rows.length === 1, 'showcase case exists');

  // SELECT s.* (not *) so the join does not shadow s.id with cs.id.
  const specialists = (await query('SELECT s.* FROM specialists s JOIN case_specialists cs ON cs.specialist_id = s.id WHERE cs.case_id = $1', [CASE_ID])).rows;
  const artifacts = (await query('SELECT * FROM knowledge_artifacts WHERE case_id = $1', [CASE_ID])).rows;
  const disagreements = (await query('SELECT * FROM knowledge_disagreements WHERE case_id = $1', [CASE_ID])).rows;
  const evidenceIds = (await query('SELECT id FROM evidence WHERE case_id = $1', [CASE_ID])).rows.map((r: any) => String(r.id));

  check(specialists.length >= 3, `>=3 specialists (found ${specialists.length})`);
  check(artifacts.length >= 5, `>=5 knowledge artifacts (found ${artifacts.length})`);
  check(disagreements.length >= 1, `>=1 disagreement (found ${disagreements.length})`);

  console.log('\n== Specialist content rules ==');
  const specialistIds = new Set(specialists.map((s: any) => String(s.id)));
  for (const s of specialists) {
    const limitations = parseJson(s.limitations);
    const guidance = parseJson(s.depth_guidance);
    const label = s.specialist_key;
    check(Array.isArray(limitations) && limitations.length > 0, `${label}: has explicit limitations`);
    check(
      !!guidance && ['plain', 'working', 'technical'].every((k) => typeof guidance[k] === 'string' && guidance[k].length > 0),
      `${label}: has plain/working/technical depth guidance`,
    );
    check(s.is_fictional === true || s.is_fictional === 't' || s.is_fictional === 'true', `${label}: marked fictional persona`);
    check(typeof s.real_discipline_basis === 'string' && s.real_discipline_basis.trim().length > 0, `${label}: has real discipline basis`);
  }

  console.log('\n== Artifact metadata rules ==');
  for (const a of artifacts) {
    const label = a.artifact_key;
    if (a.is_fictional === true || a.is_fictional === 't' || a.is_fictional === 'true') {
      check(a.knowledge_class === 'fictional' && a.reliability === 'fiction', `${label}: fictional artifact marked class=fictional, reliability=fiction`);
    } else {
      check(typeof a.bibliography_ref === 'string' && a.bibliography_ref.trim().length > 0, `${label}: non-fictional artifact has bibliography_ref`);
    }
    if (a.source_verified === true || a.source_verified === 't' || a.source_verified === 'true') {
      check(typeof a.source_url === 'string' && /^https?:\/\//i.test(a.source_url), `${label}: verified source has an http(s) source_url`);
    }
    // DTO rule: an unverified source_url must never be exposed as verified.
    const dto = toPublicArtifactSummary(a);
    if (a.source_verified !== true && a.source_verified !== 't' && a.source_verified !== 'true') {
      check(dto.sourceUrl === null, `${label}: DTO hides unverified source_url`);
    } else {
      check(dto.sourceUrl === a.source_url, `${label}: DTO exposes verified source_url`);
    }
    check(!('content' in dto), `${label}: summary DTO omits content`);
  }

  console.log('\n== Disagreement rules ==');
  for (const d of disagreements) {
    const label = d.disagreement_key;
    check(String(d.specialist_a_id) !== String(d.specialist_b_id), `${label}: distinct specialists`);
    check(specialistIds.has(String(d.specialist_a_id)) && specialistIds.has(String(d.specialist_b_id)), `${label}: both specialists belong to the showcase case`);
    check(typeof d.uncertainty_note === 'string' && d.uncertainty_note.trim().length > 0, `${label}: records uncertainty`);
    check(typeof d.distinguishing_evidence === 'string' && d.distinguishing_evidence.trim().length > 0, `${label}: records distinguishing evidence`);
  }

  console.log('\n== Leakage guard ==');
  const allText = JSON.stringify([...specialists, ...artifacts, ...disagreements]);
  for (const forbidden of FORBIDDEN_STRINGS) {
    check(!allText.includes(forbidden), `no seeded knowledge text contains "${forbidden}"`);
  }
  const leakedUuids = evidenceIds.filter((id) => allText.includes(id));
  check(leakedUuids.length === 0, `no evidence UUID appears in seeded knowledge${leakedUuids.length ? ` (found ${leakedUuids.length})` : ''}`);

  console.log(`\nKNOWLEDGE VALIDATE: ${failures === 0 ? 'PASS' : `FAIL (${failures} issue(s))`}`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((err: Error) => {
    console.error('KNOWLEDGE VALIDATE: FAIL (fatal)');
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
