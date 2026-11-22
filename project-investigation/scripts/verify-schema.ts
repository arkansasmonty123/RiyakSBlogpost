/**
 * PROD-004 / BUG-003 — read-only schema verification.
 *
 * Checks two things and NEVER mutates the database or the filesystem:
 *   1. Migration files exist, are numerically prefixed, and start with the
 *      canonical 000 baseline (000 -> 001 -> 002 -> 003 ...).
 *   2. The connected PostgreSQL DB contains every canonical table/column that
 *      src/db.ts and migrations/ rely on.
 *
 * Run: npm run db:schema:verify
 * Connection mirrors src/db.ts: DATABASE_URL when set, otherwise the local
 * Postgres socket (/var/run/postgresql, database `investigation`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

// Derived from migrations/000_baseline.sql (the canonical schema snapshot).
// snake_case identifiers only — these are the real column names in the DB.
const EXPECTED_TABLES: Record<string, string[]> = {
  accusations: [
    'id', 'investigation_id', 'submitted_culprit', 'motive', 'method',
    'supporting_evidence', 'evaluation_result', 'submission_timestamp', 'resolved_at',
  ],
  canonical_truth: [
    'id', 'case_id', 'culprit', 'motive', 'method', 'timeline', 'hidden_events',
    'created_at', 'updated_at', 'solution_explanation', 'red_herrings',
    'alternative_theories', 'clue_resolutions', 'actual_timeline',
  ],
  case_achievements: ['id', 'investigation_id', 'achievement_type', 'unlocked_at'],
  cases: [
    'id', 'title', 'description', 'genre', 'difficulty', 'duration',
    'publication_status', 'case_version', 'canonical_package_reference',
    'briefing', 'initial_characters', 'initial_facts', 'objectives',
    'created_at', 'updated_at',
  ],
  // M2 knowledge system (migration 006).
  specialists: [
    'id', 'specialist_key', 'name', 'title', 'specialization', 'discipline',
    'knowledge_domains', 'personality', 'communication_style', 'reasoning_approach',
    'expertise_summary', 'limitations', 'depth_guidance', 'is_fictional',
    'real_discipline_basis', 'created_at', 'updated_at',
  ],
  case_specialists: [
    'id', 'case_id', 'specialist_id', 'case_relevance', 'display_order', 'created_at', 'updated_at',
  ],
  knowledge_artifacts: [
    'id', 'artifact_key', 'title', 'artifact_type', 'description', 'content',
    'specialist_id', 'case_id', 'source_author', 'source_url', 'source_verified',
    'bibliography_ref', 'publication_date', 'knowledge_class', 'reliability',
    'related_concepts', 'is_fictional', 'usage_note', 'created_at', 'updated_at',
    // M3 knowledge quality (migration 007).
    'source_type', 'verification_status', 'verification_notes', 'last_verified_at',
    'claims_supported', 'learning_objectives', 'related_evidence_refs',
    'suggested_conversations', 'depth_content',
  ],
  case_knowledge_packs: [
    'id', 'case_id', 'version', 'pack_status', 'learning_objectives', 'summary',
    'created_at', 'updated_at',
  ],
  // M4 Reality Map (migration 008). Player notes only - never canonical data.
  investigation_claims: [
    'id', 'investigation_id', 'user_id', 'title', 'description', 'claim_category',
    'confidence', 'notes', 'source_journal_entry_id', 'source_notebook_entry_id',
    'is_tutorial', 'created_at', 'updated_at',
  ],
  investigation_hypotheses: [
    'id', 'investigation_id', 'user_id', 'name', 'explanation', 'status',
    'confidence', 'missing_information', 'alternative_explanations', 'player_notes',
    'is_tutorial', 'created_at', 'updated_at',
  ],
  reality_map_links: [
    'id', 'investigation_id', 'user_id', 'owner_type', 'owner_id', 'target_type',
    'target_id', 'relationship', 'rationale', 'is_tutorial', 'created_at', 'updated_at',
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
  characters: [
    'id', 'case_id', 'name', 'role', 'personality', 'background', 'knowledge',
    'beliefs', 'secrets', 'dialogue_constraints', 'alibi', 'confirmed_alibi',
    'relationships', 'created_at', 'updated_at', 'motive',
  ],
  conversations: [
    'id', 'investigation_id', 'participants', 'message_history', 'summary',
    'context_references', 'created_at', 'updated_at',
  ],
  deduction_checkpoints: [
    'id', 'investigation_id', 'checkpoint_id', 'submitted_theory',
    'supporting_evidence', 'result', 'created_at', 'updated_at',
  ],
  development_log: [
    'id', 'investigation_id', 'kind', 'message', 'evidence_id', 'created_at',
  ],
  evidence: [
    'id', 'case_id', 'category', 'source', 'description', 'hidden_interpretation',
    'discovery_conditions', 'release_conditions', 'timeline_reference',
    'reliability', 'associated_characters', 'supported_hypotheses',
    'contradicted_hypotheses', 'player_visible', 'discovery_order',
    'created_at', 'updated_at',
  ],
  evidence_discoveries: [
    'id', 'investigation_id', 'evidence_id', 'trigger', 'discovered_at',
  ],
  investigation_actions: ['id', 'investigation_id', 'action', 'created_at'],
  investigation_state: [
    'id', 'investigation_id', 'discovered_evidence_ids', 'current_theories',
    'suspicion_levels', 'completed_checkpoints', 'investigation_stage', 'last_updated',
  ],
  investigations: [
    'id', 'user_id', 'case_id', 'status', 'start_timestamp', 'current_stage',
    'progress', 'completion_timestamp', 'current_theory', 'suspicion_level',
    'discovered_evidence_ids', 'pending_events', 'theory_history', 'created_at',
    'updated_at', 'accusation_attempts', 'last_accusation_at', 'accusation_cooldown_until',
  ],
  journal_entries: [
    'id', 'investigation_id', 'entry_type', 'content', 'related_evidence_ids',
    'is_confirmed', 'creation_timestamp',
  ],
  scheduled_events: [
    'id', 'investigation_id', 'event_type', 'trigger_condition',
    'scheduled_timestamp', 'release_status', 'associated_evidence',
    'narrative_payload', 'created_at', 'updated_at',
  ],
  // P2-RATE-LIMITS: durable fixed-window rate counters (SHA-256 key hash).
  rate_limits: ['key_hash', 'window_start', 'reset_at', 'count', 'created_at'],
  // P2-SESSIONS: durable auth sessions (SHA-256 token hash, never raw token).
  sessions: ['token_hash', 'user_id', 'expires_at', 'created_at'],
  users: [
    'id', 'email', 'password_hash', 'preferences', 'notification_settings',
    'created_at', 'updated_at',
  ],
  weekly_collections: [
    'id', 'release_date', 'included_case_ids', 'featured_case_id',
    'publication_status', 'created_at',
  ],
};

interface MigrationReport {
  issues: string[];
  files: string[];
  prefixes: number[];
}

function checkMigrationFiles(projectRoot: string): MigrationReport {
  const issues: string[] = [];
  const dir = path.join(projectRoot, 'migrations');
  if (!fs.existsSync(dir)) {
    return { issues: ['migrations/ directory is missing'], files: [], prefixes: [] };
  }
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  if (!files.includes('000_baseline.sql')) {
    issues.push('canonical baseline migrations/000_baseline.sql is missing');
  }

  const prefixes: number[] = [];
  const seen = new Map<number, string>();
  for (const file of files) {
    const match = /^(\d+)_/.exec(file);
    if (!match || match[1] === undefined) {
      issues.push(`migration file has no numeric prefix: ${file}`);
      continue;
    }
    const prefix = Number(match[1]);
    const previous = seen.get(prefix);
    if (previous !== undefined) {
      issues.push(`duplicate migration prefix ${prefix}: ${previous} and ${file}`);
    } else {
      seen.set(prefix, file);
      prefixes.push(prefix);
    }
  }
  prefixes.sort((a, b) => a - b);
  const first = prefixes[0];
  if (first !== undefined && first !== 0) {
    issues.push('migration sequence must start at 000_baseline.sql');
  }
  for (let i = 1; i < prefixes.length; i += 1) {
    const prev = prefixes[i - 1];
    const current = prefixes[i];
    if (prev !== undefined && current !== undefined && current <= prev) {
      issues.push(`migration prefixes are not increasing: ${prev} -> ${current}`);
    }
  }
  return { issues, files, prefixes };
}

interface DbReport {
  issues: string[];
  tablesFound: number;
  columnsFound: number;
  extraTables: string[];
}

async function checkDatabase(pool: Pool): Promise<DbReport> {
  const result = await pool.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position`
  );

  const actual = new Map<string, Set<string>>();
  for (const row of result.rows) {
    let columns = actual.get(row.table_name);
    if (!columns) {
      columns = new Set<string>();
      actual.set(row.table_name, columns);
    }
    columns.add(row.column_name);
  }

  const issues: string[] = [];
  let expectedColumns = 0;
  for (const [table, columns] of Object.entries(EXPECTED_TABLES)) {
    expectedColumns += columns.length;
    const actualColumns = actual.get(table);
    if (!actualColumns) {
      issues.push(`missing table: ${table}`);
      continue;
    }
    for (const column of columns) {
      if (!actualColumns.has(column)) {
        issues.push(`missing column: ${table}.${column}`);
      }
    }
  }

  const extraTables = [...actual.keys()]
    .filter((table) => !Object.prototype.hasOwnProperty.call(EXPECTED_TABLES, table))
    .sort();

  console.log(
    `  tables: ${actual.size}/${Object.keys(EXPECTED_TABLES).length} expected found; ` +
    `columns checked: ${expectedColumns} (DB exposes ${result.rows.length})`
  );
  return { issues, tablesFound: actual.size, columnsFound: result.rows.length, extraTables };
}

function connectionConfig(): Record<string, unknown> {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  const config: Record<string, unknown> = {
    host: process.env.PGHOST || '/var/run/postgresql',
    database: process.env.PGDATABASE || 'investigation',
  };
  if (process.env.PGUSER) config.user = process.env.PGUSER;
  if (process.env.PGPASSWORD) config.password = process.env.PGPASSWORD;
  if (process.env.PGPORT) config.port = Number(process.env.PGPORT);
  return config;
}

async function main(): Promise<void> {
  console.log('PROD-004 schema verification (read-only; no DB writes)\n');

  const migrationReport = checkMigrationFiles(process.cwd());
  if (migrationReport.issues.length === 0) {
    console.log(
      `[Migrations] PASS — ${migrationReport.files.length} SQL file(s), ` +
      `order: ${migrationReport.prefixes.join(' -> ')}; baseline present.`
    );
  } else {
    console.log('[Migrations] FAIL');
    for (const issue of migrationReport.issues) console.log(`  - ${issue}`);
  }

  const pool = new Pool(connectionConfig() as any);
  let dbReport: DbReport | undefined;
  try {
    console.log('[Database] connecting...');
    dbReport = await checkDatabase(pool);
    if (dbReport.issues.length === 0) {
      console.log('[Database] PASS — all canonical tables and columns present.');
    } else {
      console.log('[Database] FAIL');
      for (const issue of dbReport.issues) console.log(`  - ${issue}`);
    }
    if (dbReport.extraTables.length > 0) {
      console.log(`  note: additional DB tables (not failures): ${dbReport.extraTables.join(', ')}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('[Database] FAIL — could not inspect the database.');
    console.log(`  ${message}`);
    console.log('  Hint: start Postgres and ensure DB `investigation` exists, or set DATABASE_URL.');
    dbReport = { issues: [message], tablesFound: 0, columnsFound: 0, extraTables: [] };
  } finally {
    await pool.end();
  }

  const failures = migrationReport.issues.length + (dbReport?.issues.length ?? 0);
  console.log(`\nSCHEMA VERIFY: ${failures === 0 ? 'PASS' : `FAIL (${failures} issue(s))`}`);
  if (failures > 0) process.exitCode = 1;
}

void main();
