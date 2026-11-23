// M6 case-event seed: loads the three authored showcase packages into the
// additive migration-010 table. Idempotent, keyed by case_id/package_key.
//
//   npm run db:seed:case-events
//
// SAFETY / NON-LEAKAGE:
//   * Only package metadata is written — no event instances, no canonical
//     truth, no hidden evidence ids, no secret conditions.
//   * The migration is applied defensively so fresh and CI-bootstrapped DBs
//     both work. No existing row is deleted.

import fs from 'node:fs';
import path from 'node:path';
import { pool, query } from '../src/db';
import { getCaseEventPackages } from '../src/case-events/registry';

async function applyMigration(): Promise<void> {
  const resolved = path.resolve(process.cwd(), 'migrations', '010_m6_living_investigations.sql');
  if (!fs.existsSync(resolved)) throw new Error(`Missing migration: ${resolved}`);
  await query(fs.readFileSync(resolved, 'utf8'));
}

async function main(): Promise<void> {
  console.log('M6 Case-event package seed (idempotent)\n');
  await applyMigration();

  const packages = getCaseEventPackages();
  let seeded = 0;

  for (const pkg of packages) {
    const caseRes = await query('SELECT id FROM cases WHERE title = $1 LIMIT 1', [pkg.caseTitle]);
    const caseRow = caseRes.rows[0] as { id: string } | undefined;
    if (!caseRow) throw new Error(`Case not found for package ${pkg.packageKey}: ${pkg.caseTitle}`);

    await query(
      `INSERT INTO case_event_packages
         (case_id, package_key, version, package_status, summary, event_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (case_id) DO UPDATE SET
         package_key = EXCLUDED.package_key,
         version = EXCLUDED.version,
         package_status = EXCLUDED.package_status,
         summary = EXCLUDED.summary,
         event_count = EXCLUDED.event_count,
         updated_at = NOW()`,
      [caseRow.id, pkg.packageKey, pkg.version, pkg.status, pkg.summary, pkg.events.length],
    );
    seeded += 1;
    console.log(`  ${pkg.packageKey} -> ${pkg.caseTitle}: ${pkg.events.length} event(s)`);
  }

  console.log(`\nSeeded ${seeded} case-event package(s).`);
  console.log('CASE-EVENT SEED: PASS');
}

main()
  .catch((err: Error) => {
    console.error('CASE-EVENT SEED: FAIL');
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
