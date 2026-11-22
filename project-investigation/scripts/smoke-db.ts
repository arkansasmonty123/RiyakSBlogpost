import assert from 'node:assert/strict';
import {
  createUser,
  getUserByEmail,
  getAllCases,
  getCharactersByCase,
  getEvidenceByCase,
  getSafeEvidenceById,
  createInvestigation,
  getActiveInvestigation,
  createAccusation,
  evaluateAccusation,
  hashRateLimitKey,
  consumeRateLimit,
  query,
  pool,
} from '../src/db';
import { computeEvidenceProgress } from '../src/progress';

async function main() {
  // GAP-12: progress math is case-relative, 0-safe and clamped to 0-100.
  assert.equal(computeEvidenceProgress(5, 10), 50, 'half of case evidence = 50%');
  assert.equal(computeEvidenceProgress(10, 10), 100, 'all case evidence = 100%');
  assert.equal(computeEvidenceProgress(1, 10), 10, 'one of ten = 10%');
  assert.equal(computeEvidenceProgress(0, 10), 0, 'no discoveries = 0%');
  assert.equal(computeEvidenceProgress(3, 0), 0, 'zero total is safe (no NaN/Infinity)');
  assert.equal(computeEvidenceProgress(15, 10), 100, 'over-discovery clamps to 100%');
  assert.equal(computeEvidenceProgress(1, 3), 33, 'rounds to nearest integer');
  const cases = await getAllCases();
  assert.ok(cases.length >= 1, 'expected at least one case');
  const caseId = cases[0].id;

  const chars = await getCharactersByCase(caseId);
  assert.ok(chars.length >= 1, 'characters should load');

  const evidence = await getEvidenceByCase(caseId);
  for (const ev of evidence) {
    assert.equal('hiddenInterpretation' in ev, false, 'hiddenInterpretation leaked');
    assert.equal('supportedHypotheses' in ev, false, 'supportedHypotheses leaked');
    assert.equal('contradictedHypotheses' in ev, false, 'contradictedHypotheses leaked');
    // PROD-007: release/discovery rules are server-only too.
    assert.equal('discoveryConditions' in ev, false, 'discoveryConditions leaked');
    assert.equal('releaseConditions' in ev, false, 'releaseConditions leaked');
  }

  // --- PROD-007 case-content integrity (server-side data quality) --------
  const seededCase = await query('SELECT id FROM cases WHERE id = $1', [caseId]);
  assert.equal(seededCase.rows.length, 1, 'seed case id must be preserved');

  const suspects = await query(
    `SELECT name, role, motive, alibi, background, knowledge, beliefs, secrets
       FROM characters WHERE case_id = $1 AND role = 'suspect'`,
    [caseId]
  );
  assert.ok(suspects.rows.length >= 5, 'MVP requires 5+ meaningful suspects');
  for (const s of suspects.rows) {
    assert.ok(s.name && s.background && s.motive && s.alibi, `suspect ${s.name} missing profile fields`);
    for (const model of ['knowledge', 'beliefs', 'secrets'] as const) {
      const value = s[model];
      assert.ok(value && typeof value === 'object' && Object.keys(value).length > 0,
        `suspect ${s.name} has empty ${model} model`);
    }
  }

  const truth = await query(
    `SELECT culprit, solution_explanation, red_herrings, alternative_theories, clue_resolutions
       FROM canonical_truth WHERE case_id = $1`,
    [caseId]
  );
  assert.equal(truth.rows.length, 1, 'canonical truth must exist for the seed case');
  const ct = truth.rows[0];
  assert.ok(suspects.rows.some((s: any) => s.name === ct.culprit), 'canonical culprit must be a profiled suspect');
  assert.ok(ct.solution_explanation && ct.solution_explanation.length > 100, 'solution explanation too short');
  assert.ok(Array.isArray(ct.red_herrings) && ct.red_herrings.length >= 1, 'no red herrings authored');
  assert.ok(Array.isArray(ct.alternative_theories) && ct.alternative_theories.length >= 1, 'no alternative theory authored');
  assert.ok(ct.clue_resolutions && Object.keys(ct.clue_resolutions).length >= 1, 'no clue resolutions authored');

  const evidenceShape = await query(
    `SELECT source, player_visible, discovery_conditions, release_conditions, timeline_reference
       FROM evidence WHERE case_id = $1`,
    [caseId]
  );
  assert.ok(evidenceShape.rows.length >= 8 && evidenceShape.rows.length <= 10,
    'expected 8-10 evidence items');
  for (const e of evidenceShape.rows) {
    assert.ok(e.timeline_reference, `evidence ${e.source} missing timeline_reference`);
    assert.ok(e.discovery_conditions && Object.keys(e.discovery_conditions).length > 0,
      `evidence ${e.source} missing discovery_conditions`);
  }
  assert.ok(evidenceShape.rows.some((e: any) => e.player_visible === true), 'no initially visible evidence');
  assert.ok(evidenceShape.rows.some((e: any) => e.player_visible === false), 'no gated evidence');

  const raw = await query('SELECT id, player_visible FROM evidence WHERE case_id = $1 ORDER BY discovery_order ASC LIMIT 50', [caseId]);
  const hidden = raw.rows.find((r: any) => r.player_visible === false);
  if (hidden) {
    const safe = await getSafeEvidenceById(hidden.id);
    assert.ok(safe);
    assert.equal('hiddenInterpretation' in safe, false);
  }

  const email = `smoke-${Date.now()}@example.com`;
  const user = await createUser(email, 'password123');
  const fetched = await getUserByEmail(email);
  assert.equal(fetched?.email, email);

  const inv = await createInvestigation(user.id, caseId);
  const active = await getActiveInvestigation(user.id);
  assert.equal(active?.id, inv.id);

  // PROD-010: establish readiness legitimately through the progression table,
  // then verify a failed verdict records an attempt and starts a cooldown.
  await query(
    `INSERT INTO deduction_checkpoints
       (investigation_id, checkpoint_id, submitted_theory, supporting_evidence, result)
     VALUES ($1, 'silver-cane-identified', 'a plausible theory', '{}'::uuid[], 'plausible')`,
    [inv.id]
  );
  await createAccusation(inv.id, { submittedCulprit: 'Unknown Person', motive: 'm', method: 'm', supportingEvidence: [] });
  const evalRes = await evaluateAccusation(inv.id, 'Unknown Person', 'm', 'm', []);
  assert.notEqual(evalRes.evaluationResult, 'correct');
  assert.equal(evalRes.status, 'evaluated');
  assert.equal(evalRes.attempts, 1, 'failed verdict must increment the attempt counter');
  assert.ok(evalRes.retryAfterSeconds > 0, 'failed verdict must start a cooldown');

  // A second attempt inside the cooldown is rejected without consuming an attempt.
  const cooled = await evaluateAccusation(inv.id, 'Someone Else', 'm', 'm', []);
  assert.equal(cooled.status, 'cooldown', 'cooldown must be enforced server-side');
  assert.equal(cooled.attempts, 1, 'cooldown rejection must not consume an attempt');

  await query('DELETE FROM investigations WHERE id = $1', [inv.id]);
  await query('DELETE FROM users WHERE id = $1', [user.id]);

  // P2-RATE-LIMITS: durable fixed-window counter persists across calls and
  // resets once the window expires. Uses a unique hashed key and cleans up.
  const rlKeyHash = hashRateLimitKey(`smoke-test:${Date.now()}:${Math.random()}`);
  const winStart = new Date();
  const winReset = new Date(winStart.getTime() + 60_000);
  const first = await consumeRateLimit(rlKeyHash, winStart, winReset);
  assert.equal(first.count, 1, 'first request in a window has count 1');
  const second = await consumeRateLimit(rlKeyHash, winStart, winReset);
  assert.equal(second.count, 2, 'second request in the same window increments persistently');
  assert.equal(second.windowStart.getTime(), first.windowStart.getTime(), 'window bounds are stable');
  const nextWinStart = new Date(winReset.getTime() + 1);
  const nextWinReset = new Date(nextWinStart.getTime() + 60_000);
  const rotated = await consumeRateLimit(rlKeyHash, nextWinStart, nextWinReset);
  assert.equal(rotated.count, 1, 'a new window resets the counter to 1');
  assert.ok(rotated.resetAt.getTime() > winReset.getTime(), 'a new window has a later reset');
  await query('DELETE FROM rate_limits WHERE key_hash = $1', [rlKeyHash]);

  console.log('smoke-db: ok');
}

main()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  });