// M7 discovery-clue seed: loads authored package metadata into the additive
// migration-011 table. Idempotent, keyed by case_id.
//
//   npm run db:seed:discoveries
//
// SAFETY / NON-LEAKAGE:
//   * Only package metadata (keys, counts, summary) is written. Clue bodies,
//     answer criteria, leakage guard terms and unlock payloads stay in code.
//   * No canonical truth, no hidden evidence ids, no evidence_discoveries rows.
//   * The migration is applied defensively so fresh and CI-bootstrapped DBs
//     both work. No existing row is deleted.

import fs from 'node:fs';
import path from 'node:path';
import { pool, query } from '../src/db';
import { getDiscoveryPackages } from '../src/discovery-clues/registry';

async function applyMigration(): Promise<void> {
  const resolved = path.resolve(process.cwd(), 'migrations', '011_m7_discovery_knowledge.sql');
  if (!fs.existsSync(resolved)) throw new Error(`Missing migration: ${resolved}`);
  await query(fs.readFileSync(resolved, 'utf8'));
}

async function main(): Promise<void> {
  console.log('M7 discovery-clue package seed (idempotent)\n');
  await applyMigration();

  const packages = getDiscoveryPackages();
  let seeded = 0;
  let clueTotal = 0;

  for (const pkg of packages) {
    const caseRes = await query('SELECT id FROM cases WHERE title = $1 LIMIT 1', [pkg.caseTitle]);
    const caseRow = caseRes.rows[0] as { id: string } | undefined;
    if (!caseRow) throw new Error(`Case not found for package ${pkg.packageKey}: ${pkg.caseTitle}`);

    await query(
      `INSERT INTO discovery_clue_packages
         (case_id, package_key, version, package_status, summary, clue_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (case_id) DO UPDATE SET
         package_key = EXCLUDED.package_key,
         version = EXCLUDED.version,
         package_status = EXCLUDED.package_status,
         summary = EXCLUDED.summary,
         clue_count = EXCLUDED.clue_count,
         updated_at = NOW()`,
      [caseRow.id, pkg.packageKey, pkg.version, pkg.status, pkg.summary, pkg.clues.length],
    );
    seeded += 1;
    clueTotal += pkg.clues.length;
    console.log(`  ${pkg.packageKey} -> ${pkg.caseTitle}: ${pkg.clues.length} clue(s)`);
  }

  console.log(`\nSeeded ${seeded} package(s), ${clueTotal} authored discovery clue(s).`);
  console.log('DISCOVERY CLUE SEED: PASS');
}

main()
  .catch((err: Error) => {
    console.error('DISCOVERY CLUE SEED: FAIL');
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
