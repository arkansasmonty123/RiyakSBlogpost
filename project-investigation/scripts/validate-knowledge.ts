// M3 knowledge validation (READ-ONLY).
//
//   npm run knowledge:validate
//
// Validates every case that has M2 knowledge data and/or an M3 case knowledge
// pack. Checks schema presence, provenance/classification rules, pack rules,
// duplicate keys, content depth and per-case canonical-leakage guards. Runs
// only SELECT statements; never writes. Canonical solution strings are used
// only for in-memory matching and are NEVER printed in check messages.

import { pool, query } from '../src/db';
import {
  toPublicArtifactSummary,
  KNOWLEDGE_CLASSES,
  PACK_STATUSES,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  isKnowledgeClass,
  asStringArray,
} from '../src/knowledge';
import { KNOWLEDGE_PACKS } from '../src/knowledge-packs';

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
    // M3 (migration 007).
    'source_type', 'verification_status', 'verification_notes', 'last_verified_at',
    'claims_supported', 'learning_objectives', 'related_evidence_refs',
    'suggested_conversations', 'depth_content',
  ],
  case_knowledge_packs: [
    'id', 'case_id', 'version', 'pack_status', 'learning_objectives', 'summary',
    'created_at', 'updated_at',
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

let failures = 0;
let warnings = 0;
function check(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✅ ${message}`);
  } else {
    console.log(`  ❌ ${message}`);
    failures += 1;
  }
}
function warn(condition: boolean, message: string): void {
  if (!condition) {
    console.log(`  ⚠️  ${message}`);
    warnings += 1;
  }
}

function parseJson(value: unknown): any {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return null;
}

function isTrue(value: unknown): boolean {
  return value === true || value === 't' || value === 'true' || value === 1;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function hasContent(value: unknown, min = 20): boolean {
  return text(value).trim().length >= min;
}

function depth(value: unknown): boolean {
  const obj = parseJson(value);
  return !!obj && ['plain', 'working', 'technical'].every((k) => typeof obj[k] === 'string' && obj[k].trim().length > 0);
}

async function main(): Promise<void> {
  console.log('M3 knowledge validation (read-only)\n');

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

  // All cases with any knowledge data (M2 rows or an M3 pack).
  const casesResult = await query(
    `SELECT DISTINCT c.id, c.title FROM cases c
      WHERE c.id IN (SELECT case_id FROM case_specialists)
         OR c.id IN (SELECT case_id FROM knowledge_artifacts)
         OR c.id IN (SELECT case_id FROM knowledge_disagreements)
         OR c.id IN (SELECT case_id FROM case_knowledge_packs)
      ORDER BY c.title`
  );
  const cases = casesResult.rows as Array<{ id: string; title: string }>;
  check(cases.length > 0, `at least one case has knowledge data (found ${cases.length})`);

  const leakageByTitle = new Map(KNOWLEDGE_PACKS.map((p) => [p.caseTitle, p.leakageTerms]));
  const allArtifactKeys = new Set<string>();
  const allDisagreementKeys = new Set<string>();
  let duplicateArtifactKeys = 0;
  let duplicateDisagreementKeys = 0;

  for (const target of cases) {
    const caseId = String(target.id);
    const label = target.title;
    console.log(`\n== Case: ${label} ==`);

    // SELECT s.* (not *) so the join does not shadow s.id with cs.id.
    const specialists = (await query('SELECT s.* FROM specialists s JOIN case_specialists cs ON cs.specialist_id = s.id WHERE cs.case_id = $1', [caseId])).rows;
    const artifacts = (await query('SELECT * FROM knowledge_artifacts WHERE case_id = $1', [caseId])).rows;
    const disagreements = (await query('SELECT * FROM knowledge_disagreements WHERE case_id = $1', [caseId])).rows;
    const packRows = (await query('SELECT * FROM case_knowledge_packs WHERE case_id = $1', [caseId])).rows;
    const evidence = (await query('SELECT id, source, description FROM evidence WHERE case_id = $1', [caseId])).rows as Array<{ id: string; source: string; description: string }>;

    check(specialists.length >= 3, `${label}: >=3 specialists (found ${specialists.length})`);
    check(artifacts.length >= 5, `${label}: >=5 knowledge artifacts (found ${artifacts.length})`);
    check(disagreements.length >= 1, `${label}: >=1 disagreement (found ${disagreements.length})`);

    console.log(`-- Specialist content rules (${label}) --`);
    const specialistIds = new Set(specialists.map((s: any) => String(s.id)));
    for (const s of specialists) {
      const key = text(s.specialist_key);
      const limitations = parseJson(s.limitations);
      check(Array.isArray(limitations) && limitations.length > 0, `${key}: has explicit limitations`);
      check(depth(s.depth_guidance), `${key}: has plain/working/technical depth guidance`);
      check(isTrue(s.is_fictional), `${key}: marked fictional persona`);
      check(hasContent(s.real_discipline_basis, 10), `${key}: has real discipline basis`);
      check(hasContent(s.expertise_summary, 30), `${key}: has substantive expertise summary`);
    }

    console.log(`-- Artifact metadata rules (${label}) --`);
    for (const a of artifacts) {
      const key = text(a.artifact_key);
      if (allArtifactKeys.has(key)) duplicateArtifactKeys += 1;
      allArtifactKeys.add(key);

      check(VERIFICATION_STATUSES.includes(text(a.verification_status) as any), `${key}: valid verification_status`);
      if (a.source_type !== null && a.source_type !== undefined && a.source_type !== '') {
        check(SOURCE_TYPES.includes(text(a.source_type) as any), `${key}: valid source_type`);
      }
      check(isKnowledgeClass(a.knowledge_class), `${key}: valid knowledge_class (legacy aliases accepted)`);

      const verified = isTrue(a.source_verified);
      const reviewStatus = text(a.verification_status);
      const url = text(a.source_url);
      const validUrl = /^https?:\/\/\S+/i.test(url);
      const fictional = isTrue(a.is_fictional);
      const bibliography = text(a.bibliography_ref);

      if (verified) {
        check(reviewStatus === 'verified', `${key}: source_verified implies verification_status=verified`);
        check(validUrl, `${key}: verified source has an http(s) source_url`);
      }
      if (reviewStatus === 'verified') {
        const sufficientRef = validUrl || fictional || bibliography.trim().length >= 40;
        check(hasContent(a.verification_notes, 10) && sufficientRef,
          `${key}: verified status has verification notes + sufficient provenance`);
      }
      if (!fictional) {
        check(bibliography.trim().length > 0, `${key}: non-fictional artifact has bibliography_ref`);
        warn(asStringArray(a.claims_supported).length > 0, `${key}: no claims_supported recorded (recommended)`);
      } else {
        check(text(a.knowledge_class) === 'fictional_in_world' || text(a.knowledge_class) === 'fictional',
          `${key}: fictional artifact uses fictional class`);
        check(text(a.reliability) === 'fiction', `${key}: fictional artifact uses fiction reliability`);
      }

      check(hasContent(a.title, 8), `${key}: substantive title`);
      check(hasContent(a.description, 30), `${key}: substantive description`);
      check(hasContent(a.content, 60), `${key}: substantive content`);

      // DTO rules: verified-only URL, normalized class, no content in summary.
      const dto = toPublicArtifactSummary(a);
      check(!('content' in dto), `${key}: summary DTO omits content`);
      if (!verified || reviewStatus !== 'verified') {
        check(dto.sourceUrl === null, `${key}: DTO withholds non-verified source_url`);
      } else {
        check(dto.sourceUrl === a.source_url, `${key}: DTO exposes verified source_url`);
      }

      // Evidence refs are stable text snippets; confirm they fuzzy-match this
      // case's evidence source/description strings.
      const refs = asStringArray(a.related_evidence_refs);
      for (const ref of refs) {
        const needle = ref.toLowerCase().trim();
        const matched = needle.length === 0 || evidence.some((e) =>
          text(e.source).toLowerCase().includes(needle) ||
          text(e.description).toLowerCase().includes(needle) ||
          needle.includes(text(e.source).toLowerCase())
        );
        warn(matched, `${key}: evidence ref does not match any case evidence (${needle.slice(0, 40)})`);
      }
    }

    console.log(`-- Pack rules (${label}) --`);
    if (packRows.length === 0) {
      warn(false, `${label}: no case_knowledge_packs row (learning objectives missing at pack level)`);
    } else {
      const pack = packRows[0] as any;
      check(PACK_STATUSES.includes(text(pack.pack_status) as any), `${label}: valid pack_status`);
      const objectives = asStringArray(pack.learning_objectives).filter((o) => o.trim().length > 0);
      check(objectives.length > 0, `${label}: pack has learning_objectives`);
      check(hasContent(pack.summary, 30), `${label}: pack has a substantive summary`);
      check(hasContent(pack.version, 3), `${label}: pack has a version`);
    }

    console.log(`-- Disagreement rules (${label}) --`);
    for (const d of disagreements) {
      const key = text(d.disagreement_key);
      if (allDisagreementKeys.has(key)) duplicateDisagreementKeys += 1;
      allDisagreementKeys.add(key);
      check(text(d.specialist_a_id) !== text(d.specialist_b_id), `${key}: distinct specialists`);
      check(specialistIds.has(String(d.specialist_a_id)) && specialistIds.has(String(d.specialist_b_id)), `${key}: both specialists belong to this case`);
      check(hasContent(d.uncertainty_note, 15), `${key}: records uncertainty`);
      check(hasContent(d.distinguishing_evidence, 15), `${key}: records distinguishing evidence`);
      check(hasContent(d.topic, 8), `${key}: substantive topic`);
    }

    console.log(`-- Leakage guard (${label}) --`);
    const allText = JSON.stringify([...specialists, ...artifacts, ...disagreements, ...packRows]);
    const forbidden = leakageByTitle.get(label) ?? [];
    for (let i = 0; i < forbidden.length; i += 1) {
      // Message never includes the canonical string itself.
      check(!allText.includes(forbidden[i] as string), `${label}: no canonical leakage (guard term ${i + 1})`);
    }
    const evidenceUuids = evidence.map((e) => String(e.id));
    const leakedUuids = evidenceUuids.filter((id) => allText.includes(id));
    check(leakedUuids.length === 0, `${label}: no evidence UUID appears in seeded knowledge`);
  }

  console.log('\n== Global uniqueness ==');
  check(duplicateArtifactKeys === 0, `no duplicate artifact_key (found ${duplicateArtifactKeys})`);
  check(duplicateDisagreementKeys === 0, `no duplicate disagreement_key (found ${duplicateDisagreementKeys})`);
  check(KNOWLEDGE_CLASSES.length === 7, 'M3 knowledge_class allowlist has 7 classes');

  console.log(`\nKNOWLEDGE VALIDATE: ${failures === 0 ? 'PASS' : `FAIL (${failures} issue(s))`}${warnings > 0 ? ` with ${warnings} warning(s)` : ''}`);
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
