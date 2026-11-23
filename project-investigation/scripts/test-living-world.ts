// M6 deterministic living-world test harness (node/tsx, DB-backed).
//
//   npm run test:living
//
// Creates temporary users/investigations, drives processLivingWorld from an
// injected `now`, and removes every row it created in `finally`. It never
// touches canonical truth and never writes evidence discoveries directly.

import { pool } from '../src/db';
import {
  getActivitySnapshot, initializeInvestigationEvents, markActivitySeen, processLivingWorld,
} from '../src/living-world/engine';

const INTERNAL_TERMS = ['canonical_truth', 'hidden_events', 'discovery_conditions', 'hidden_interpretation'];

let passed = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  passed += 1;
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function createUser(tag: string): Promise<string> {
  const email = `m6-test-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.invalid`;
  const result = await pool.query(
    'INSERT INTO users (email, created_at, updated_at) VALUES ($1, NOW(), NOW()) RETURNING id',
    [email],
  );
  return String(result.rows[0].id);
}

async function caseId(title: string): Promise<string> {
  const result = await pool.query('SELECT id FROM cases WHERE title=$1 LIMIT 1', [title]);
  const row = result.rows[0] as { id: string } | undefined;
  if (!row) throw new Error(`Missing fixture case: ${title}`);
  return String(row.id);
}

async function createInvestigation(userId: string, targetCaseId: string, startedAt: Date): Promise<string> {
  const result = await pool.query(
    `INSERT INTO investigations
       (user_id, case_id, status, start_timestamp, discovered_evidence_ids, created_at, updated_at)
     VALUES ($1, $2, 'active', $3, '{}'::uuid[], NOW(), NOW())
     RETURNING id`,
    [userId, targetCaseId, startedAt],
  );
  return String(result.rows[0].id);
}

async function cleanInvestigation(investigationId: string): Promise<void> {
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.columns
      WHERE table_schema='public' AND column_name='investigation_id'`,
  );
  const names = (tables.rows as Array<{ table_name: string }>)
    .map((row) => String(row.table_name))
    .filter((name) => name !== 'investigations');
  for (const name of names) {
    try {
      await pool.query(`DELETE FROM ${quoteIdentifier(name)} WHERE investigation_id = $1`, [investigationId]);
    } catch {
      // Best-effort: some tables may not exist in every environment.
    }
  }
  await pool.query('DELETE FROM investigations WHERE id=$1', [investigationId]);
}

async function eventCount(investigationId: string): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS count FROM investigation_events WHERE investigation_id=$1',
    [investigationId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function main(): Promise<void> {
  console.log('M6 Living World deterministic tests\n');
  const now = new Date();
  const nowMs = now.getTime();
  const startedAt = new Date(nowMs - 200 * 60_000);

  const heistUser = await createUser('heist');
  const plainUser = await createUser('plain');
  let heistInv: string | null = null;
  let plainInv: string | null = null;

  try {
    const heistCaseId = await caseId('The Midnight Heist');
    heistInv = await createInvestigation(heistUser, heistCaseId, startedAt);
    await initializeInvestigationEvents(heistInv, now);
    assert((await eventCount(heistInv)) > 0, 'materialization created event instances');

    const first = await processLivingWorld(heistInv, { now, maxEvents: 12 });
    console.log(`  heist first tick: resolved=${first.counts.resolved} expired=${first.counts.expired}`);
    assert(first.counts.resolved >= 4, 'first tick resolves time-anchored events');
    assert(first.counts.expired >= 1, 'first tick expires the bounded callback window');
    assert(first.expired.length >= 1, 'expired events are returned in the DTO list');
    assert(first.resolved.length >= 1, 'resolved events are returned in the DTO list');

    const second = await processLivingWorld(heistInv, { now, maxEvents: 12 });
    assert(second.counts.resolved === 0 && second.counts.expired === 0, 'repeat tick at same time is idempotent');

    // Expiry consequence must publish an alternative availability flag.
    const flagRes = await pool.query(
      `SELECT value FROM investigation_flags WHERE investigation_id=$1 AND flag='mh:callback-window-missed'`,
      [heistInv],
    );
    const flagRow = flagRes.rows[0] as { value: { alternativeEventKey?: string; nonEssential?: boolean } } | undefined;
    assert(flagRow !== undefined, 'expiry published the missed-opportunity flag');
    assert(
      flagRow?.value?.alternativeEventKey === 'mh-callback-recovery' && flagRow?.value?.nonEssential === true,
      'expiry flag advertises a non-essential alternative',
    );

    // Bounded catch-up: reset three resolved rows and reprocess with maxEvents=2.
    await pool.query(
      `UPDATE investigation_events
          SET status='scheduled', resolved_at=NULL, outcome='{}'::jsonb
        WHERE id IN (SELECT id FROM investigation_events
                      WHERE investigation_id=$1 AND status='resolved'
                      ORDER BY id LIMIT 3)`,
      [heistInv],
    );
    const bounded = await processLivingWorld(heistInv, { now, maxEvents: 2 });
    assert(bounded.counts.resolved <= 2, 'maxEvents bounds the resolved batch');
    assert(bounded.hasMore === true, 'hasMore is set when backlog exceeds the bound');

    // Activity snapshot DTO must not contain internal or canonical-sensitive terms.
    const snapshot = await getActivitySnapshot(heistInv, heistUser, { limit: 50, now });
    const serialized = JSON.stringify(snapshot).toLowerCase();
    for (const term of INTERNAL_TERMS) {
      assert(!serialized.includes(term), `activity DTO excludes internal term ${term}`);
    }
    assert(!serialized.includes('victor sterling'), 'activity DTO excludes canonical culprit');
    assert(snapshot.counts.total > 0, 'activity snapshot includes resolved events');
    assert(snapshot.groups.length > 0, 'activity snapshot groups events');

    // markActivitySeen never accepts a future timestamp.
    await markActivitySeen(heistInv, heistUser, { through: new Date(nowMs + 10 * 60_000).toISOString() });
    const seenRes = await pool.query(
      'SELECT last_seen_at FROM investigations WHERE id=$1',
      [heistInv],
    );
    const seenAt = new Date((seenRes.rows[0] as { last_seen_at: string | Date }).last_seen_at).getTime();
    assert(seenAt <= nowMs + 1000, 'last_seen_at is clamped to server time');

    // A case with no authored package is a deterministic no-op.
    const plainCaseRes = await pool.query(
      `SELECT id FROM cases WHERE title NOT IN ('The Midnight Heist','Code Blue at the Clinic','Blaze at Dawn Bakery')
        ORDER BY title LIMIT 1`,
    );
    const plainCase = plainCaseRes.rows[0] as { id: string } | undefined;
    assert(plainCase !== undefined, 'fixture case without an event package exists');
    if (plainCase) {
      plainInv = await createInvestigation(plainUser, String(plainCase.id), startedAt);
      await initializeInvestigationEvents(plainInv, now);
      const noPackage = await processLivingWorld(plainInv, { now });
      assert(
        noPackage.counts.resolved === 0 && noPackage.counts.expired === 0 && noPackage.counts.materialized === 0,
        'no-package case is a no-op',
      );
      assert((await eventCount(plainInv)) === 0, 'no-package case materializes no event rows');
    }

    console.log(`\nM6 LIVING WORLD TESTS: PASS (${passed} assertions)`);
  } finally {
    try { if (heistInv) await cleanInvestigation(heistInv); } catch { /* best effort */ }
    try { if (plainInv) await cleanInvestigation(plainInv); } catch { /* best effort */ }
    try { await pool.query('DELETE FROM users WHERE id=$1', [heistUser]); } catch { /* best effort */ }
    try { await pool.query('DELETE FROM users WHERE id=$1', [plainUser]); } catch { /* best effort */ }
  }
}

main()
  .catch((err: Error) => {
    console.error('M6 LIVING WORLD TESTS: FAIL');
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
