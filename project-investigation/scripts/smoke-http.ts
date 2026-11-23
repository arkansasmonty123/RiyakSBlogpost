// HTTP Integration Smoke Tests for THE INVESTIGATION API
// Run with: npx tsx scripts/smoke-http.ts (requires server on localhost:3000)

import http from 'http';
import { getAllCases, query, pool } from '../src/db';

// Default matches the documented command; SMOKE_BASE_URL lets CI or a local
// verifier point at a dedicated server instance without stopping other dev
// servers that may already occupy port 3000.
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';

interface ApiResponse {
  status: number;
  body: any;
  headers: http.IncomingHttpHeaders;
}

// Helper to make HTTP requests (captures headers and forwards cookies)
function request(
  method: string,
  path: string,
  body?: any,
  cookie?: string | null
): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL);
    const options: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Helper to parse set-cookie from response
function parseSetCookie(res: ApiResponse): string | null {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return null;
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return cookieStr?.split(';')[0] ?? null;
}

async function main() {
  let passed = 0;
  let failed = 0;
  const suffix = Date.now();
  const allCases = await getAllCases();
  const midnightHeist = allCases.find((c: any) => c.title === 'The Midnight Heist') ?? allCases[0];
  const caseId = midnightHeist?.id;
  if (!caseId) throw new Error('No seeded case found - run smoke-db seed first');

  const hiddenResult = await query(
    'SELECT id, case_id FROM evidence WHERE player_visible = false LIMIT 1'
  );
  const hiddenEvidenceId = hiddenResult.rows[0]?.id;
  const hiddenEvidenceCaseId = hiddenResult.rows[0]?.case_id;

  const visibleResult = await query(
    'SELECT id FROM evidence WHERE player_visible = true AND case_id = $1 LIMIT 1',
    [caseId]
  );
  const visibleEvidenceId = visibleResult.rows[0]?.id;

  // PROD-008 fixtures: one deduction-gated item (CCTV footage, released after
  // the "silver-cane-identified" checkpoint) and one time/event-gated item
  // (fingerprint analysis) used to verify deterministic catch-up.
  const cctvResult = await query(
    `SELECT id FROM evidence WHERE case_id = $1 AND source = 'CCTV footage' LIMIT 1`,
    [caseId]
  );
  const cctvEvidenceId = cctvResult.rows[0]?.id as string | undefined;
  const forensicResult = await query(
    `SELECT id FROM evidence WHERE case_id = $1 AND source = 'fingerprint analysis' LIMIT 1`,
    [caseId]
  );
  const forensicEvidenceId = forensicResult.rows[0]?.id as string | undefined;
  const footageResult = await query(
    `SELECT id FROM evidence WHERE case_id = $1 AND source = 'security footage' LIMIT 1`,
    [caseId]
  );
  const securityFootageId = footageResult.rows[0]?.id as string | undefined;

  function test(name: string, fn: () => Promise<void>) {
    return fn().then(() => {
      console.log(`  ✅ ${name}`);
      passed++;
    }).catch((err: Error) => {
      console.log(`  ❌ ${name}`);
      console.log(`     Error: ${err.message}`);
      failed++;
    });
  }

  async function registerAndLogin(prefix: string): Promise<string> {
    const email = `${prefix}-${suffix}@example.com`;
    const reg = await request('POST', '/api/register', { email, password: 'testpass' });
    if (reg.status !== 201) throw new Error(`Register failed: ${reg.status}`);
    const login = await request('POST', '/api/login', { email, password: 'testpass' });
    if (login.status !== 200) throw new Error(`Login failed: ${login.status}`);
    const cookie = parseSetCookie(login);
    if (!cookie) throw new Error('No session cookie');
    return cookie;
  }

  async function createInvestigation(cookie: string, targetCaseId: string): Promise<string> {
    const res = await request('POST', '/api/investigations', { caseId: targetCaseId }, cookie);
    if (res.status !== 201 || !res.body?.id) {
      throw new Error(`Create investigation failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return String(res.body.id);
  }

  // PROD-010 helpers. Readiness is established the legitimate way: a plausible
  // deduction checkpoint submitted through the progression engine using
  // player-visible evidence (never by writing server state directly).
  async function prepareForAccusation(cookie: string, invId: string): Promise<void> {
    if (!securityFootageId) throw new Error('security footage fixture missing');
    const theory = await request('POST', `/api/investigations/${invId}/theory`, {
      checkpointId: 'silver-cane-identified',
      theory: 'The cane grip and the limp in the corridor footage identify the wounded figure.',
      supportingEvidence: [securityFootageId],
    }, cookie);
    if (theory.status !== 200 || theory.body?.result !== 'plausible') {
      throw new Error(`Could not establish accusation readiness: ${theory.status} ${JSON.stringify(theory.body)}`);
    }
    for (const id of [securityFootageId, visibleEvidenceId]) {
      if (!id) continue;
      await request('POST', `/api/investigations/${invId}/discover-evidence`, { evidenceId: id }, cookie);
    }
  }

  async function canonicalAccusation(): Promise<{
    culprit: string; motive: string; method: string; supportingEvidence: string[];
  }> {
    const ct = await query(
      'SELECT culprit, motive, method FROM canonical_truth WHERE case_id = $1 LIMIT 1',
      [caseId]
    );
    const culprit = ct.rows[0]?.culprit as string | undefined;
    const motive = ct.rows[0]?.motive as string | undefined;
    const method = ct.rows[0]?.method as string | undefined;
    if (!culprit || !motive || !method) throw new Error('Canonical accusation fixture missing');
    if (!visibleEvidenceId) throw new Error('Visible evidence fixture missing');
    return { culprit, motive, method, supportingEvidence: [visibleEvidenceId] };
  }

  function verdictPath(invId: string): string {
    return `/api/investigations/${invId}/evaluate-accusation`;
  }

  console.log('\n=== M8-W7 Beta Readiness: Health / Config Tests ===\n');

  await test('GET /api/health returns a safe liveness shape', async () => {
    const res = await request('GET', '/api/health');
    if (res.status !== 200) throw new Error(`Health failed: ${res.status}`);
    if (res.body.status !== 'ok') throw new Error('Health status is not ok');
    if (typeof res.body.timestamp !== 'string' || Number.isNaN(Date.parse(res.body.timestamp))) {
      throw new Error('Health timestamp missing/invalid');
    }
    if (typeof res.body.version !== 'string') throw new Error('Health version missing');
    if (JSON.stringify(res.body).match(/password|token|secret|database_url/i)) {
      throw new Error('Health response leaked sensitive data');
    }
  });

  await test('GET /api/config exposes only public feedback/beta metadata', async () => {
    const res = await request('GET', '/api/config');
    if (res.status !== 200) throw new Error(`Config failed: ${res.status}`);
    if (typeof res.body.feedbackUrl !== 'string' || !res.body.feedbackUrl) {
      throw new Error('Config feedbackUrl missing');
    }
    if (typeof res.body.betaAccessRequired !== 'boolean') {
      throw new Error('Config betaAccessRequired missing');
    }
    if (JSON.stringify(res.body).match(/password|token|secret|database_url|access.?code/i)) {
      throw new Error('Config response leaked sensitive data');
    }
  });

  console.log('\n=== Authentication Tests ===\n');

  const primaryEmail = `smoketest-${suffix}@example.com`;

  await test('Register user', async () => {
    const res = await request('POST', '/api/register', {
      email: primaryEmail,
      password: 'password123',
    });
    if (res.status !== 201) throw new Error(`Register failed: ${res.status} ${JSON.stringify(res.body)}`);
  });

  let primaryCookie: string | null = null;
  await test('Login user', async () => {
    const res = await request('POST', '/api/login', {
      email: primaryEmail,
      password: 'password123',
    });
    if (res.status !== 200) throw new Error(`Login failed: ${res.status}`);
    if (!res.body.id) throw new Error('No user ID in response');
    primaryCookie = parseSetCookie(res);
    if (!primaryCookie) throw new Error('No session cookie');
  });

  await test('Protected routes reject without auth', async () => {
    const res = await request('GET', '/api/cases');
    if (res.status === 401 || res.status === 403) return;
    throw new Error(`Expected 401/403 but got ${res.status}`);
  });

  await test('Protected routes work with session cookie', async () => {
    if (!primaryCookie) throw new Error('No session cookie from login');
    const res = await request('GET', '/api/cases', undefined, primaryCookie);
    if (res.status !== 200) throw new Error(`Cases fetch failed: ${res.status}`);
    if (!Array.isArray(res.body) || res.body.length === 0) throw new Error('No cases returned');
  });

  // P2-SESSIONS: identity comes from the DB-backed session row, via /api/me.
  await test('/api/me returns the authenticated identity', async () => {
    if (!primaryCookie) throw new Error('No session cookie from login');
    const res = await request('GET', '/api/me', undefined, primaryCookie);
    if (res.status !== 200) throw new Error(`/api/me failed: ${res.status}`);
    if (res.body.email !== primaryEmail) throw new Error('/api/me returned the wrong email');
    if (!res.body.id) throw new Error('/api/me returned no user id');
  });

  // M8-W7: self-service export and explicit account deletion.
  console.log('\n=== M8-W7 Beta Readiness: Data Export / Deletion Tests ===\n');

  await test('GET /api/me/export requires authentication', async () => {
    const res = await request('GET', '/api/me/export');
    if (res.status !== 401) throw new Error(`Unauthenticated export not rejected: ${res.status}`);
  });

  await test('GET /api/me/export returns a safe, self-only DTO', async () => {
    if (!primaryCookie) throw new Error('No session cookie from login');
    const res = await request('GET', '/api/me/export', undefined, primaryCookie);
    if (res.status !== 200) throw new Error(`Export failed: ${res.status} ${JSON.stringify(res.body)}`);
    const body = res.body;
    for (const key of ['exportedAt', 'formatVersion', 'profile', 'investigations', 'notebook', 'knowledge', 'notifications']) {
      if (!(key in body)) throw new Error(`Export missing ${key}`);
    }
    if (body.profile?.email !== primaryEmail) throw new Error('Export returned the wrong profile');
    if (!Array.isArray(body.investigations) || !Array.isArray(body.notebook)) {
      throw new Error('Export collections are not arrays');
    }
    const forbidden = /canonical|hidden|secret|truth|password|token|evaluation_result|hidden_events/i;
    const scan = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => scan(item, `${path}[${index}]`));
        return;
      }
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
          if (forbidden.test(key)) throw new Error(`Export leaked field ${path}.${key}`);
          scan(child, `${path}.${key}`);
        }
      }
    };
    scan(body, 'export');
  });

  await test('POST /api/me/delete requires explicit confirmation', async () => {
    const cookie = await registerAndLogin('delete-guard');
    const missing = await request('POST', '/api/me/delete', {}, cookie);
    const wrong = await request('POST', '/api/me/delete', { confirm: 'yes' }, cookie);
    if (missing.status !== 400 || wrong.status !== 400) {
      throw new Error(`Confirmation guard failed: missing ${missing.status}, wrong ${wrong.status}`);
    }
    const stillThere = await request('GET', '/api/me', undefined, cookie);
    if (stillThere.status !== 200) throw new Error('Account removed without confirmation');
    // Clean up the guard fixture through the real, confirmed flow.
    const done = await request('POST', '/api/me/delete', { confirm: 'DELETE' }, cookie);
    if (done.status !== 200 || done.body.ok !== true) throw new Error('Confirmed deletion failed');
  });

  await test('POST /api/me/delete removes only caller data and revokes its session', async () => {
    const victimCookie = await registerAndLogin('delete-victim');
    const observerCookie = await registerAndLogin('delete-observer');
    const victimMe = await request('GET', '/api/me', undefined, victimCookie);
    const victimId = String(victimMe.body.id);
    const victimInv = await createInvestigation(victimCookie, caseId);
    const observerInv = await createInvestigation(observerCookie, caseId);
    const note = await request('POST', `/api/investigations/${victimInv}/journal`, {
      entryType: 'note', content: 'A private note that should be deleted',
    }, victimCookie);
    if (note.status !== 201 && note.status !== 200) throw new Error(`Journal fixture failed: ${note.status}`);

    const del = await request('POST', '/api/me/delete', { confirm: 'DELETE' }, victimCookie);
    if (del.status !== 200 || del.body.ok !== true) throw new Error(`Deletion failed: ${del.status}`);

    const after = await request('GET', '/api/me', undefined, victimCookie);
    if (after.status !== 401) throw new Error('Session was not revoked after deletion');
    for (const [label, sql] of [
      ['investigations', 'SELECT id FROM investigations WHERE user_id = $1'],
      ['users', 'SELECT id FROM users WHERE id = $1'],
      ['sessions', 'SELECT token_hash FROM sessions WHERE user_id = $1'],
      ['notebook', 'SELECT id FROM notebook_entries WHERE user_id = $1'],
    ] as const) {
      const rows = await query(sql, [victimId]);
      if ((rows.rowCount ?? 0) !== 0) throw new Error(`${label} rows survived deletion`);
    }
    const journalRows = await query('SELECT id FROM journal_entries WHERE investigation_id = $1', [victimInv]);
    if ((journalRows.rowCount ?? 0) !== 0) throw new Error('journal rows survived deletion');

    const observerCheck = await request('GET', '/api/me', undefined, observerCookie);
    if (observerCheck.status !== 200) throw new Error('Other user session was revoked');
    const observerInvCheck = await query('SELECT id FROM investigations WHERE id = $1', [observerInv]);
    if (observerInvCheck.rowCount !== 1) throw new Error('Other user investigation was deleted');
  });

  console.log('\n=== Notification Settings Tests ===\n');

  // GAP-14 (P2): MVP in-app notification preferences (existing users column).
  await test('Notification settings require auth', async () => {
    const get = await request('GET', '/api/me/notification-settings');
    const patch = await request('PATCH', '/api/me/notification-settings', { developments: false });
    if (get.status !== 401 || patch.status !== 401) {
      throw new Error(`Unauthenticated settings access not rejected: GET ${get.status} PATCH ${patch.status}`);
    }
  });

  await test('Notification settings default to safe in-app values', async () => {
    if (!primaryCookie) throw new Error('No session cookie from login');
    const res = await request('GET', '/api/me/notification-settings', undefined, primaryCookie);
    if (res.status !== 200) throw new Error(`Settings fetch failed: ${res.status}`);
    if (res.body?.developments !== true) {
      throw new Error(`Expected developments enabled by default: ${JSON.stringify(res.body)}`);
    }
    if (Object.keys(res.body).some((key) => /canonical|hidden|secret|truth/i.test(key))) {
      throw new Error('Settings DTO leaked a hidden/canonical field');
    }
  });

  await test('Notification settings persist and ignore unknown/non-boolean keys', async () => {
    if (!primaryCookie) throw new Error('No session cookie from login');
    const patch = await request(
      'PATCH',
      '/api/me/notification-settings',
      { developments: false, canonicalTruth: 'leak', unrelated: 42 },
      primaryCookie
    );
    if (patch.status !== 200) throw new Error(`Settings patch failed: ${patch.status}`);
    if (patch.body?.developments !== false) {
      throw new Error(`Patch did not persist developments=false: ${JSON.stringify(patch.body)}`);
    }
    if (Object.keys(patch.body).some((key) => key !== 'developments')) {
      throw new Error(`Settings DTO accepted unknown keys: ${JSON.stringify(patch.body)}`);
    }
    const readBack = await request('GET', '/api/me/notification-settings', undefined, primaryCookie);
    if (readBack.body?.developments !== false) {
      throw new Error(`Settings did not persist across requests: ${JSON.stringify(readBack.body)}`);
    }
    // Restore the default so later tests are unaffected by this user's state.
    await request('PATCH', '/api/me/notification-settings', { developments: true }, primaryCookie);
  });

  // M8 Wave 1: per-user onboarding progress (safe, auth-gated DTO).
  console.log('\n=== Onboarding Tests ===\n');

  await test('Onboarding endpoints require auth', async () => {
    const get = await request('GET', '/api/me/onboarding');
    const patch = await request('PATCH', '/api/me/onboarding', { welcomeSeen: true });
    if (get.status !== 401 || patch.status !== 401) {
      throw new Error(`Unauthenticated onboarding access not rejected: GET ${get.status} PATCH ${patch.status}`);
    }
  });

  await test('Onboarding defaults are safe and lazily created for a fresh user', async () => {
    const cookie = await registerAndLogin('onboarding-default');
    const res = await request('GET', '/api/me/onboarding', undefined, cookie);
    if (res.status !== 200) throw new Error(`Onboarding fetch failed: ${res.status}`);
    const keys = Object.keys(res.body).sort();
    const expected = ['completed', 'introCompleted', 'lastStep', 'skipped', 'tutorialState', 'welcomeSeen'];
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      throw new Error(`Unexpected onboarding DTO shape: ${JSON.stringify(keys)}`);
    }
    if (res.body.welcomeSeen !== false || res.body.introCompleted !== false ||
        res.body.skipped !== false || res.body.completed !== false || res.body.lastStep !== null) {
      throw new Error(`Unsafe onboarding defaults: ${JSON.stringify(res.body)}`);
    }
    if (res.body.tutorialState === null || typeof res.body.tutorialState !== 'object' ||
        Object.keys(res.body.tutorialState).length !== 0) {
      throw new Error(`Expected an empty tutorialState: ${JSON.stringify(res.body.tutorialState)}`);
    }
    if (keys.some((k) => /canonical|hidden|secret|truth/i.test(k))) {
      throw new Error('Onboarding DTO leaked a hidden/canonical field');
    }
  });

  await test('Onboarding PATCH persists allowlisted fields and ignores unknown keys', async () => {
    const cookie = await registerAndLogin('onboarding-patch');
    const patch = await request('PATCH', '/api/me/onboarding', {
      welcomeSeen: true,
      lastStep: 'toolkit',
      tutorialState: { reality: true, canonicalTruth: 'leak' },
      introCompleted: 'yes', // non-boolean values are ignored
      skipped: 42,
      canonicalTruth: 'leak',
      userId: 'spoofed',
    }, cookie);
    if (patch.status !== 200) throw new Error(`Onboarding patch failed: ${patch.status}`);
    if (patch.body.welcomeSeen !== true || patch.body.lastStep !== 'toolkit') {
      throw new Error(`Allowlisted fields not persisted: ${JSON.stringify(patch.body)}`);
    }
    if (patch.body.introCompleted !== false || patch.body.skipped !== false || patch.body.completed !== false) {
      throw new Error(`Invalid/non-boolean fields were accepted: ${JSON.stringify(patch.body)}`);
    }
    if (patch.body.tutorialState?.reality !== true) {
      throw new Error(`Allowlisted tutorial key not persisted: ${JSON.stringify(patch.body.tutorialState)}`);
    }
    const tutorialKeys = Object.keys(patch.body.tutorialState ?? {});
    const allowlistedTutorialKeys = [
      'reality', 'perspectives', 'fieldResearch',
      'evidenceTip', 'suspectsTip', 'chatTip', 'guideCompleted',
      'stepBriefing', 'stepEvidence', 'stepChat', 'stepClaims', 'stepFieldResearch', 'stepVerdict',
    ];
    if (tutorialKeys.some((k) => !allowlistedTutorialKeys.includes(k))) {
      throw new Error(`Tutorial state accepted an unknown key: ${JSON.stringify(tutorialKeys)}`);
    }
    if (Object.keys(patch.body).some((k) => /canonical|hidden|secret|truth|user_?id/i.test(k))) {
      throw new Error('Onboarding DTO accepted/returned an unsafe field');
    }
    const readBack = await request('GET', '/api/me/onboarding', undefined, cookie);
    if (readBack.body.lastStep !== 'toolkit' || readBack.body.tutorialState?.reality !== true) {
      throw new Error('Onboarding state did not persist across requests');
    }
  });

  await test('Onboarding completion/skip marks state complete and shallow-merges tutorial flags', async () => {
    const cookie = await registerAndLogin('onboarding-complete');
    const first = await request('PATCH', '/api/me/onboarding', { tutorialState: { perspectives: true } }, cookie);
    if (first.status !== 200 || first.body.tutorialState?.perspectives !== true) {
      throw new Error(`First tutorial patch failed: ${JSON.stringify(first.body)}`);
    }
    const done = await request('PATCH', '/api/me/onboarding', {
      introCompleted: true,
      tutorialState: { fieldResearch: true },
    }, cookie);
    if (done.body.introCompleted !== true || done.body.completed !== true) {
      throw new Error(`Completion not reflected in state: ${JSON.stringify(done.body)}`);
    }
    if (done.body.tutorialState?.perspectives !== true || done.body.tutorialState?.fieldResearch !== true) {
      throw new Error(`Tutorial flags were not shallow-merged: ${JSON.stringify(done.body.tutorialState)}`);
    }
    const skipped = await request('PATCH', '/api/me/onboarding', { skipped: true }, cookie);
    if (skipped.body.skipped !== true || skipped.body.completed !== true) {
      throw new Error(`Skip not reflected in state: ${JSON.stringify(skipped.body)}`);
    }
  });

  await test('Onboarding replay resets the guide and persists new tutorial keys', async () => {
    const cookie = await registerAndLogin('onboarding-replay');
    const seeded = await request('PATCH', '/api/me/onboarding', {
      welcomeSeen: true,
      introCompleted: true,
      lastStep: null,
      tutorialState: { guideCompleted: true, stepBriefing: true, evidenceTip: true },
    }, cookie);
    if (seeded.status !== 200 || seeded.body.completed !== true) {
      throw new Error(`Could not seed a completed guide: ${JSON.stringify(seeded.body)}`);
    }
    if (seeded.body.tutorialState?.stepBriefing !== true || seeded.body.tutorialState?.evidenceTip !== true) {
      throw new Error(`New tutorial keys not persisted: ${JSON.stringify(seeded.body.tutorialState)}`);
    }
    if (seeded.body.tutorialState?.guideCompleted !== true) {
      throw new Error(`Guide completion flag not persisted: ${JSON.stringify(seeded.body.tutorialState)}`);
    }

    // Replay: reset the intro + hide-flag while leaving other step flags intact.
    const replay = await request('PATCH', '/api/me/onboarding', {
      welcomeSeen: false,
      introCompleted: false,
      skipped: false,
      lastStep: null,
      tutorialState: { guideCompleted: false },
    }, cookie);
    if (replay.body.welcomeSeen !== false || replay.body.introCompleted !== false ||
        replay.body.skipped !== false || replay.body.lastStep !== null || replay.body.completed !== false) {
      throw new Error(`Replay did not reset the guide to its initial state: ${JSON.stringify(replay.body)}`);
    }
    if (replay.body.tutorialState?.guideCompleted !== false) {
      throw new Error(`Replay did not unhide the checklist: ${JSON.stringify(replay.body.tutorialState)}`);
    }
    if (replay.body.tutorialState?.stepBriefing !== true || replay.body.tutorialState?.evidenceTip !== true) {
      throw new Error(`Replay lost unrelated tutorial flags: ${JSON.stringify(replay.body.tutorialState)}`);
    }
    const readBack = await request('GET', '/api/me/onboarding', undefined, cookie);
    if (readBack.body.completed !== false || readBack.body.tutorialState?.stepBriefing !== true) {
      throw new Error('Replayed onboarding state did not persist');
    }
  });

  console.log('\n=== M8-6 Personal Progress Tests ===\n');

  await test('M8-6: /api/me/progress requires authentication', async () => {
    const res = await request('GET', '/api/me/progress');
    if (res.status !== 401) throw new Error(`Progress route not auth-gated: ${res.status}`);
  });

  await test('M8-6: fresh user gets a safe, honest, empty-progress DTO', async () => {
    const cookie = await registerAndLogin('m8-progress-fresh');
    const res = await request('GET', '/api/me/progress', undefined, cookie);
    if (res.status !== 200) throw new Error(`Progress fetch failed: ${res.status} ${JSON.stringify(res.body)}`);
    const body = res.body;
    if (!body || typeof body !== 'object') throw new Error('Progress DTO is not an object');
    if (typeof body.generatedAt !== 'string' || typeof body.disclaimer !== 'string') {
      throw new Error('Progress DTO missing generatedAt/disclaimer');
    }
    if (!body.investigations || !body.knowledge || !body.openThreads || !body.recentActivity) {
      throw new Error('Progress DTO missing a required section');
    }
    if (!Array.isArray(body.milestones) || !Array.isArray(body.suggestions)) {
      throw new Error('Progress DTO milestones/suggestions must be arrays');
    }
    if (body.recentActivity.windowDays !== 7) {
      throw new Error('Recent activity must use the honest 7-day window');
    }
    for (const key of ['completed', 'abandoned', 'active', 'paused', 'total', 'distinctCasesPlayed'] as const) {
      if (typeof body.investigations[key] !== 'number') {
        throw new Error(`Progress investigation field ${key} is not a number`);
      }
    }
    if (body.investigations.total !== 0 || body.knowledge.memoryItems !== 0 ||
        body.knowledge.discoveriesAccepted !== 0 || body.milestones.some((m: any) => m.achieved)) {
      throw new Error('Fresh user progress should be empty');
    }
    if (body.suggestions.some((s: any) => !s.caseId || !s.title || !s.reason)) {
      throw new Error('Suggestions must expose only safe library fields');
    }

    // Deep scan: no canonical/hidden/internal field names anywhere in the DTO.
    const forbidden = /canonical|hidden|secret|truth|culprit|motive|method|evaluation|reason_?code|user_?id/i;
    const scan = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        value.forEach((entry, index) => scan(entry, `${path}[${index}]`));
        return;
      }
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
          if (forbidden.test(key)) throw new Error(`Progress DTO leaked field ${path}.${key}`);
          scan(child, `${path}.${key}`);
        }
      }
    };
    scan(body, 'progress');
  });

  await test('M8-6: progress is ownership-scoped and reflects only own activity', async () => {
    const ownerCookie = await registerAndLogin('m8-progress-owner');
    const otherCookie = await registerAndLogin('m8-progress-other');

    const beforeOwner = await request('GET', '/api/me/progress', undefined, ownerCookie);
    const beforeOther = await request('GET', '/api/me/progress', undefined, otherCookie);
    if (beforeOwner.body.investigations.active !== 0 || beforeOther.body.investigations.active !== 0) {
      throw new Error('Both progress DTOs should start with no active investigations');
    }

    await createInvestigation(ownerCookie, String(caseId));
    const afterOwner = await request('GET', '/api/me/progress', undefined, ownerCookie);
    const afterOther = await request('GET', '/api/me/progress', undefined, otherCookie);
    if (afterOwner.body.investigations.active !== 1 || afterOwner.body.investigations.total !== 1) {
      throw new Error(`Owner progress did not reflect own investigation: ${JSON.stringify(afterOwner.body.investigations)}`);
    }
    if (afterOther.body.investigations.active !== 0 || afterOther.body.investigations.total !== 0) {
      throw new Error('Another user\'s investigation leaked into the progress DTO');
    }
  });

  await test('Forged session token is rejected', async () => {
    const res = await request('GET', '/api/me', undefined, 'session_token=deadbeef');
    if (res.status !== 401) throw new Error(`Forged session token not rejected: ${res.status}`);
  });

  await test('Logout revokes the session server-side (DB-backed)', async () => {
    const email = `logout-test-${suffix}@example.com`;
    await request('POST', '/api/register', { email, password: 'testpass' });
    const loginRes = await request('POST', '/api/login', { email, password: 'testpass' });
    const cookie = parseSetCookie(loginRes);
    if (!cookie) throw new Error('No session cookie from login');
    const before = await request('GET', '/api/me', undefined, cookie);
    if (before.status !== 200) throw new Error(`/api/me before logout failed: ${before.status}`);
    const out = await request('POST', '/api/logout', undefined, cookie);
    if (out.status !== 200) throw new Error(`Logout failed: ${out.status}`);
    const after = await request('GET', '/api/me', undefined, cookie);
    if (after.status !== 401) throw new Error(`Session still valid after logout: ${after.status}`);
  });

  await test('Investigation create rejects without auth', async () => {
    const res = await request('POST', '/api/investigations', { caseId });
    if (res.status === 401 || res.status === 403) return;
    throw new Error(`Expected 401/403 without auth but got ${res.status}`);
  });

  await test('Investigation create works with session cookie', async () => {
    const email = `inv-test-${suffix}@example.com`;
    await request('POST', '/api/register', { email, password: 'testpass' });
    const loginRes = await request('POST', '/api/login', { email, password: 'testpass' });
    if (loginRes.status !== 200) throw new Error('Login failed');
    const cookie = parseSetCookie(loginRes);
    if (!cookie) throw new Error('No session cookie');

    const res = await request('POST', '/api/investigations', { caseId }, cookie);
    if (res.status !== 201) throw new Error(`Create investigation failed: ${res.status} ${JSON.stringify(res.body)}`);
  });

  console.log('\n=== Input Validation Tests (QA-001) ===\n');

  await test('Register rejects malformed email and short password', async () => {
    const badEmail = await request('POST', '/api/register', {
      email: 'not-an-email',
      password: 'password123',
    });
    if (badEmail.status !== 400) throw new Error(`Malformed email accepted: ${badEmail.status}`);

    const shortPassword = await request('POST', '/api/register', {
      email: `short-pass-${suffix}@example.com`,
      password: 'abc',
    });
    if (shortPassword.status !== 400) throw new Error(`Short password accepted: ${shortPassword.status}`);
  });

  await test('Auth responses expose rate-limit headers', async () => {
    // A failed login still passes through the limiter, so the headers are set
    // without creating extra users or consuming the smoke suite's budget.
    const res = await request('POST', '/api/login', {
      email: `rate-header-${suffix}@example.com`,
      password: 'password123',
    });
    if (res.headers['x-ratelimit-limit'] === undefined) {
      throw new Error('Missing X-RateLimit-Limit header on auth response');
    }
  });

  await test('Messages endpoint rejects non-player roles and oversized content', async () => {
    const cookie = await registerAndLogin('message-role');
    const invId = await createInvestigation(cookie, caseId);

    const forged = await request('POST', `/api/investigations/${invId}/messages`, {
      role: 'investigator',
      content: 'Forged investigator reply',
    }, cookie);
    if (forged.status !== 400) throw new Error(`Forged investigator role accepted: ${forged.status}`);

    const arbitrary = await request('POST', `/api/investigations/${invId}/messages`, {
      role: 'system',
      content: 'Forged system message',
    }, cookie);
    if (arbitrary.status !== 400) throw new Error(`Arbitrary role accepted: ${arbitrary.status}`);

    const tooLong = await request('POST', `/api/investigations/${invId}/messages`, {
      role: 'player',
      content: 'x'.repeat(10_001),
    }, cookie);
    if (tooLong.status !== 400) throw new Error(`Oversized message accepted: ${tooLong.status}`);

    const ok = await request('POST', `/api/investigations/${invId}/messages`, {
      role: 'player',
      content: 'A legitimate player note',
    }, cookie);
    if (ok.status !== 201) throw new Error(`Valid player message rejected: ${ok.status}`);
  });

  await test('Journal rejects blank/oversized content and invalid evidence id list', async () => {
    const cookie = await registerAndLogin('journal-validation');
    const invId = await createInvestigation(cookie, caseId);

    const blank = await request('POST', `/api/investigations/${invId}/journal`, {
      entryType: 'note',
      content: '   ',
    }, cookie);
    if (blank.status !== 400) throw new Error(`Blank journal content accepted: ${blank.status}`);

    const tooLong = await request('POST', `/api/investigations/${invId}/journal`, {
      entryType: 'note',
      content: 'x'.repeat(10_001),
    }, cookie);
    if (tooLong.status !== 400) throw new Error(`Oversized journal content accepted: ${tooLong.status}`);

    const badIds = await request('POST', `/api/investigations/${invId}/journal`, {
      entryType: 'note',
      content: 'Valid content',
      relatedEvidenceIds: [123],
    }, cookie);
    if (badIds.status !== 400) throw new Error(`Non-string evidence ids accepted: ${badIds.status}`);

    const ok = await request('POST', `/api/investigations/${invId}/journal`, {
      entryType: 'note',
      content: 'Valid journal content',
    }, cookie);
    if (ok.status !== 201) throw new Error(`Valid journal entry rejected: ${ok.status}`);
  });

  await test('Chat rejects oversized messages', async () => {
    const cookie = await registerAndLogin('chat-validation');
    const invId = await createInvestigation(cookie, caseId);
    const res = await request('POST', `/api/investigations/${invId}/chat`, {
      message: 'x'.repeat(4_001),
    }, cookie);
    if (res.status !== 400) throw new Error(`Oversized chat message accepted: ${res.status}`);
  });

  console.log('\n=== Evidence Authorization Tests ===\n');

  await test('Evidence-by-ID blocks hidden evidence without active investigation', async () => {
    if (!hiddenEvidenceId) throw new Error('No hidden evidence in seed data');
    const email = `evidence-auth-${suffix}@example.com`;
    await request('POST', '/api/register', { email, password: 'testpass' });
    const loginRes = await request('POST', '/api/login', { email, password: 'testpass' });
    const cookie = parseSetCookie(loginRes);
    if (!cookie) throw new Error('No session cookie');

    const res = await request('GET', `/api/evidence/${hiddenEvidenceId}`, undefined, cookie);
    if (res.status >= 200 && res.status < 300) {
      for (const key of ['hiddenInterpretation', 'supportedHypotheses', 'contradictedHypotheses']) {
        if (res.body && key in res.body) throw new Error(`${key} leaked in response`);
      }
    } else if (res.status !== 404) {
      throw new Error(`Unexpected status for hidden evidence: ${res.status}`);
    }
  });

  await test('Evidence list with userId filters by playerVisible/discovered', async () => {
    const email = `evidence-case-${suffix}@example.com`;
    await request('POST', '/api/register', { email, password: 'testpass' });
    const loginRes = await request('POST', '/api/login', { email, password: 'testpass' });
    const cookie = parseSetCookie(loginRes);
    if (!cookie) throw new Error('No session cookie');

    const res = await request('GET', `/api/cases/${caseId}/evidence`, undefined, cookie);
    if (res.status !== 200) throw new Error(`Case evidence failed: ${res.status}`);
    for (const ev of res.body) {
      for (const key of ['hiddenInterpretation', 'supportedHypotheses', 'contradictedHypotheses']) {
        if (ev && key in ev) throw new Error(`${key} leaked in evidence list`);
      }
    }
  });

  console.log('\n=== PROD-007 Case Content Authorization Tests ===\n');

  await test('Character profiles never expose knowledge/beliefs/secrets', async () => {
    const cookie = await registerAndLogin('character-auth');
    const res = await request('GET', `/api/cases/${caseId}/characters`, undefined, cookie);
    if (res.status !== 200) throw new Error(`Characters fetch failed: ${res.status}`);
    if (!Array.isArray(res.body) || res.body.length < 5) throw new Error('Expected 5+ characters');
    for (const c of res.body) {
      for (const key of ['knowledge', 'beliefs', 'secrets', 'relationships']) {
        if (c && key in c) throw new Error(`${key} leaked in character profile`);
      }
      if (!c.background || !c.alibi) throw new Error('Public character profile is missing background/alibi');
    }
  });

  await test('Case response never exposes canonical truth fields', async () => {
    const cookie = await registerAndLogin('canonical-auth');
    const res = await request('GET', `/api/cases/${caseId}`, undefined, cookie);
    if (res.status !== 200) throw new Error(`Case fetch failed: ${res.status}`);
    const serialized = JSON.stringify(res.body);
    for (const key of [
      'solutionExplanation', 'solution_explanation', 'redHerrings', 'red_herrings',
      'alternativeTheories', 'clueResolutions', 'actualTimeline', 'hiddenEvents',
      'hidden_events', 'culprit', 'motive', 'method',
    ]) {
      if (serialized.includes(`"${key}"`)) throw new Error(`${key} leaked in case response`);
    }
  });

  console.log('\n=== Discovery Authorization Tests (GAP-04) ===\n');

  await test('Hidden evidence cannot be discovered by ID', async () => {
    if (!hiddenEvidenceId || !hiddenEvidenceCaseId) throw new Error('No hidden evidence in seed data');
    const cookie = await registerAndLogin('hidden-discovery');
    const invId = await createInvestigation(cookie, String(hiddenEvidenceCaseId));

    const res = await request(
      'POST',
      `/api/investigations/${invId}/discover-evidence`,
      { evidenceId: hiddenEvidenceId },
      cookie
    );
    if (res.status >= 200 && res.status < 300) {
      throw new Error(`Hidden evidence was discoverable: ${res.status} ${JSON.stringify(res.body)}`);
    }
    if (res.status !== 403 && res.status !== 404) {
      throw new Error(`Unexpected status for hidden discovery: ${res.status}`);
    }

    const after = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    const ids: string[] = after.body?.discoveredEvidenceIds ?? [];
    if (ids.includes(hiddenEvidenceId)) throw new Error('Hidden evidence id was persisted as discovered');
  });

  await test('Visible evidence can still be marked as examined', async () => {
    if (!visibleEvidenceId) throw new Error('No visible evidence in seed data');
    const cookie = await registerAndLogin('visible-discovery');
    const invId = await createInvestigation(cookie, caseId);

    const res = await request(
      'POST',
      `/api/investigations/${invId}/discover-evidence`,
      { evidenceId: visibleEvidenceId },
      cookie
    );
    if (res.status !== 200) {
      throw new Error(`Visible discovery failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    const ids: string[] = res.body?.discoveredEvidenceIds ?? [];
    if (!ids.includes(visibleEvidenceId)) throw new Error('Visible evidence was not recorded as discovered');
  });

  console.log('\n=== State Ownership Tests (GAP-05) ===\n');

  await test('PATCH cannot self-complete investigation or spoof progress/stage', async () => {
    const cookie = await registerAndLogin('state-spoof');
    const invId = await createInvestigation(cookie, caseId);

    const res = await request('PATCH', `/api/investigations/${invId}`, {
      status: 'completed',
      progress: 100,
      currentStage: 'spoofed-stage',
      pendingEvents: [{ eventType: 'spoofed-event' }],
      currentTheory: 'A player-authored theory',
    }, cookie);
    if (res.status !== 200) throw new Error(`PATCH failed: ${res.status} ${JSON.stringify(res.body)}`);

    const after = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    if (after.body?.status !== 'active') throw new Error(`status was spoofed: ${after.body?.status}`);
    if (Number(after.body?.progress) !== 0) throw new Error(`progress was spoofed: ${after.body?.progress}`);
    if (after.body?.currentStage === 'spoofed-stage') throw new Error('currentStage was spoofed');
    if (JSON.stringify(after.body).includes('spoofed-event')) throw new Error('pendingEvents were spoofed');
    if (after.body?.currentTheory !== 'A player-authored theory') {
      throw new Error('Legitimate PATCH field (currentTheory) was not applied');
    }
  });

  await test('Client cannot unlock arbitrary achievements', async () => {
    const cookie = await registerAndLogin('achievement-spoof');
    const invId = await createInvestigation(cookie, caseId);

    const res = await request(
      'POST',
      `/api/investigations/${invId}/achievements`,
      { achievementType: 'master_detective_free_unlock' },
      cookie
    );
    if (res.status !== 403 && res.status !== 404 && res.status !== 400) {
      throw new Error(`Arbitrary achievement accepted: ${res.status} ${JSON.stringify(res.body)}`);
    }
    const list = await request('GET', `/api/investigations/${invId}/achievements`, undefined, cookie);
    if (list.status !== 200) throw new Error(`Achievement list failed: ${list.status}`);
    if (Array.isArray(list.body) && list.body.some((a: any) => a.achievementType === 'master_detective_free_unlock')) {
      throw new Error('Spoofed achievement was persisted');
    }
  });

  // GAP-13: the read endpoint is auth/ownership gated and returns only safe,
  // server-awarded fields with a real unlock timestamp.
  await test('GET achievements is owner-scoped and returns a safe server-awarded shape', async () => {
    if (!visibleEvidenceId) throw new Error('No visible evidence in seed data');
    const owner = await registerAndLogin('achievement-read-owner');
    const invId = await createInvestigation(owner, caseId);

    const initial = await request('GET', `/api/investigations/${invId}/achievements`, undefined, owner);
    if (initial.status !== 200 || !Array.isArray(initial.body)) {
      throw new Error(`Initial achievement list failed: ${initial.status}`);
    }

    // Earning the first piece of evidence awards first_evidence server-side.
    const discovered = await request(
      'POST', `/api/investigations/${invId}/discover-evidence`, { evidenceId: visibleEvidenceId }, owner
    );
    if (discovered.status !== 200) throw new Error(`Discovery failed: ${discovered.status}`);

    const list = await request('GET', `/api/investigations/${invId}/achievements`, undefined, owner);
    if (list.status !== 200 || !Array.isArray(list.body)) {
      throw new Error(`Achievement list failed: ${list.status}`);
    }
    const first = list.body.find((a: any) => a.achievementType === 'first_evidence');
    if (!first) throw new Error('first_evidence was not awarded after discovery');
    if (typeof first.id !== 'string' || typeof first.unlockedAt !== 'string') {
      throw new Error('Achievement is missing id/unlockedAt');
    }
    const serialized = JSON.stringify(list.body);
    for (const key of ['culprit', 'motive', 'method', 'solutionExplanation', 'hiddenEvents']) {
      if (serialized.includes(`"${key}"`)) throw new Error(`${key} leaked in achievement list`);
    }

    const unauth = await request('GET', `/api/investigations/${invId}/achievements`);
    if (unauth.status !== 401 && unauth.status !== 403) {
      throw new Error(`Unauthenticated achievement read not rejected: ${unauth.status}`);
    }
    const other = await registerAndLogin('achievement-read-other');
    const foreign = await request('GET', `/api/investigations/${invId}/achievements`, undefined, other);
    if (foreign.status !== 403 && foreign.status !== 404) {
      throw new Error(`Non-owner achievement read not rejected: ${foreign.status}`);
    }
  });

  console.log('\n=== Accusation Evaluation Tests ===\n');

  await test('Accusation evaluation flow (register → create → readiness → accuse → evaluate)', async () => {
    const email = `accusation-flow-${suffix}@example.com`;
    await request('POST', '/api/register', { email, password: 'password123' });
    const loginRes = await request('POST', '/api/login', { email, password: 'password123' });
    const cookie = parseSetCookie(loginRes);
    if (!cookie) throw new Error('No session cookie');

    const invRes = await request('POST', '/api/investigations', { caseId }, cookie);
    if (invRes.status !== 201) throw new Error(`Create investigation failed: ${invRes.status}`);
    const invId = invRes.body.id;
    await prepareForAccusation(cookie, invId);

    const canonical = await canonicalAccusation();
    const accRes = await request('POST', `/api/investigations/${invId}/accusation`, {
      submittedCulprit: canonical.culprit,
      motive: canonical.motive,
      method: canonical.method,
      supportingEvidence: canonical.supportingEvidence,
    }, cookie);
    if (accRes.status !== 201) throw new Error(`Accusation failed: ${accRes.status}`);

    const evalRes = await request('POST', verdictPath(invId), canonical, cookie);
    if (evalRes.status !== 200) throw new Error(`Evaluation failed: ${evalRes.status}`);
    if (!evalRes.body.evaluationResult) throw new Error('No evaluation result');
    if (evalRes.body.evaluationResult !== 'correct') {
      throw new Error(`Expected a fully valid accusation to succeed, got ${evalRes.body.evaluationResult}`);
    }
  });

  await test('Non-correct verdict keeps investigation active and enforces a retry cooldown', async () => {
    const cookie = await registerAndLogin('retry-flow');
    const invId = await createInvestigation(cookie, caseId);
    await prepareForAccusation(cookie, invId);

    const wrong = await request('POST', verdictPath(invId), {
      culprit: 'Not The Culprit At All', motive: 'a', method: 'b', supportingEvidence: [],
    }, cookie);
    if (wrong.status !== 200) throw new Error(`Evaluation failed: ${wrong.status}`);
    if (wrong.body?.evaluationResult !== 'incorrect') {
      throw new Error(`Expected incorrect verdict, got ${wrong.body?.evaluationResult}`);
    }
    if (wrong.body?.status !== 'evaluated' || wrong.body?.attempts !== 1) {
      throw new Error(`Expected attempt 1 to be recorded, got ${JSON.stringify(wrong.body)}`);
    }
    if (!(wrong.body?.retryAfterSeconds > 0)) throw new Error('No cooldown after failed accusation');

    const after = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    if (after.body?.status !== 'active') {
      throw new Error(`Failed verdict changed status to ${after.body?.status}`);
    }

    // Immediate retry is blocked by the server-side cooldown (escalating, not permanent).
    const immediate = await request('POST', verdictPath(invId), {
      culprit: 'Still Not The Culprit', motive: 'a', method: 'b', supportingEvidence: [],
    }, cookie);
    if (immediate.status !== 429) throw new Error(`Cooldown was not enforced: ${immediate.status}`);
    if (!(immediate.body?.retryAfterSeconds > 0)) throw new Error('429 missing retry info');
    const retryHeader = immediate.headers['retry-after'];
    if (!retryHeader || Number(retryHeader) < 1) throw new Error('429 missing Retry-After header');

    // After the cooldown the player can try again (never permanently locked out).
    await new Promise((resolve) => setTimeout(resolve, 2_300));
    const retry = await request('POST', verdictPath(invId), {
      culprit: 'Still Not The Culprit', motive: 'a', method: 'b', supportingEvidence: [],
    }, cookie);
    if (retry.status !== 200) throw new Error(`Retry after cooldown failed: ${retry.status}`);
    if (retry.body?.attempts !== 2) throw new Error(`Expected attempt counter to escalate to 2, got ${retry.body?.attempts}`);
    if (!(retry.body?.retryAfterSeconds > wrong.body.retryAfterSeconds)) {
      throw new Error('Cooldown did not escalate on the second failed attempt');
    }
  });

  await test('Correct verdict completes case, awards achievement, and locks state', async () => {
    const cookie = await registerAndLogin('correct-verdict');
    const invId = await createInvestigation(cookie, caseId);
    await prepareForAccusation(cookie, invId);
    const canonical = await canonicalAccusation();

    const verdict = await request('POST', verdictPath(invId), canonical, cookie);
    if (verdict.status !== 200) throw new Error(`Evaluation failed: ${verdict.status}`);
    if (verdict.body?.evaluationResult !== 'correct') {
      throw new Error(`Expected correct verdict, got ${verdict.body?.evaluationResult}`);
    }

    const after = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    if (after.body?.status !== 'completed') {
      throw new Error(`Correct verdict did not complete investigation: ${after.body?.status}`);
    }
    const achievements = await request(
      'GET',
      `/api/investigations/${invId}/achievements`,
      undefined,
      cookie
    );
    if (!Array.isArray(achievements.body) ||
        !achievements.body.some((a: any) => a.achievementType === 'case_solved')) {
      throw new Error('Server did not award case_solved achievement');
    }

    const reopen = await request('POST', verdictPath(invId), {
      culprit: canonical.culprit, motive: canonical.motive, method: canonical.method,
      supportingEvidence: canonical.supportingEvidence,
    }, cookie);
    if (reopen.status !== 409) throw new Error(`Completed case could be reopened: ${reopen.status}`);
  });

  console.log('\n=== Verdict Integrity Tests (PROD-010 / GAP-06) ===\n');

  await test('Final accusation is gated until a deduction checkpoint is completed', async () => {
    const cookie = await registerAndLogin('integrity-gating');
    const invId = await createInvestigation(cookie, caseId);
    const canonical = await canonicalAccusation();

    const premature = await request('POST', verdictPath(invId), canonical, cookie);
    if (premature.status !== 409 || premature.body?.status !== 'not_ready') {
      throw new Error(`Expected readiness gate, got ${premature.status} ${JSON.stringify(premature.body)}`);
    }
    if (!(premature.body?.readiness?.requiredCheckpoints >= 1)) {
      throw new Error('Readiness gate did not report its requirements');
    }
    if (premature.body?.attempts !== 0) throw new Error('Premature submission consumed an attempt');

    const after = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    if (after.body?.status !== 'active') throw new Error('Premature submission changed investigation status');
  });

  await test('Name-only correct culprit cannot complete the case (no brute-force solve)', async () => {
    const canonical = await canonicalAccusation();
    const cookie = await registerAndLogin('integrity-name-only');
    const invId = await createInvestigation(cookie, caseId);
    await prepareForAccusation(cookie, invId);

    const nameOnly = await request('POST', verdictPath(invId), {
      culprit: canonical.culprit, motive: '', method: '', supportingEvidence: [],
    }, cookie);
    if (nameOnly.status !== 200) throw new Error(`Name-only evaluation failed: ${nameOnly.status}`);
    if (nameOnly.body?.evaluationResult === 'correct') {
      throw new Error('Name-only accusation completed the case');
    }
    if (nameOnly.body?.evaluationResult !== 'incorrect') {
      throw new Error(`Expected a non-leaking incorrect verdict, got ${nameOnly.body?.evaluationResult}`);
    }

    // Feedback must be generic: it must not reveal the canonical solution.
    const serialized = JSON.stringify(nameOnly.body);
    for (const secret of [canonical.motive.slice(0, 40), canonical.method.slice(0, 40)]) {
      if (secret && serialized.includes(secret)) throw new Error('Canonical truth leaked in verdict feedback');
    }

    const after = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    if (after.body?.status !== 'active') {
      throw new Error(`Name-only verdict changed status to ${after.body?.status}`);
    }
  });

  await test('Partial reasoning and out-of-case evidence do not complete the case', async () => {
    const canonical = await canonicalAccusation();

    const weakCookie = await registerAndLogin('integrity-weak');
    const weakInv = await createInvestigation(weakCookie, caseId);
    await prepareForAccusation(weakCookie, weakInv);
    const weak = await request('POST', verdictPath(weakInv), {
      culprit: canonical.culprit, motive: canonical.motive, method: '', supportingEvidence: [],
    }, weakCookie);
    if (weak.status !== 200 || weak.body?.evaluationResult === 'correct') {
      throw new Error(`Incomplete reasoning was accepted: ${weak.status} ${weak.body?.evaluationResult}`);
    }

    const bogusCookie = await registerAndLogin('integrity-bogus-evidence');
    const bogusInv = await createInvestigation(bogusCookie, caseId);
    await prepareForAccusation(bogusCookie, bogusInv);
    const bogus = await request('POST', verdictPath(bogusInv), {
      culprit: canonical.culprit,
      motive: canonical.motive,
      method: canonical.method,
      supportingEvidence: ['00000000-0000-4000-8000-000000000000'],
    }, bogusCookie);
    if (bogus.status !== 200 || bogus.body?.evaluationResult === 'correct') {
      throw new Error(`Out-of-case evidence was accepted: ${bogus.status} ${bogus.body?.evaluationResult}`);
    }
  });


  console.log('\n=== Solution Reveal Tests (PROD-009) ===\n');

  // Keys that must NEVER appear in a solution payload in any form. The safe
  // DTO uses camelCase allowlisted fields only - hidden_events is server-only.
  const FORBIDDEN_SOLUTION_KEYS = [
    'hiddenEvents', 'hidden_events', 'known_by', 'knownBy',
    'solution_explanation', 'red_herrings', 'alternative_theories',
    'clue_resolutions', 'actual_timeline',
  ];

  await test('Solution endpoint is locked before completion (no canonical leak)', async () => {
    const cookie = await registerAndLogin('solution-locked');
    const invId = await createInvestigation(cookie, caseId);

    const unauth = await request('GET', `/api/investigations/${invId}/solution`);
    if (unauth.status !== 401 && unauth.status !== 403) {
      throw new Error(`Unauthenticated solution fetch not rejected: ${unauth.status}`);
    }

    const res = await request('GET', `/api/investigations/${invId}/solution`, undefined, cookie);
    if (res.status !== 403 && res.status !== 404) {
      throw new Error(`Solution should be locked before completion, got ${res.status}`);
    }
    const serialized = JSON.stringify(res.body);
    for (const key of FORBIDDEN_SOLUTION_KEYS) {
      if (serialized.includes(`"${key}"`)) throw new Error(`${key} leaked before completion`);
    }
  });

  let solvedInvId: string | null = null;

  await test('Solution endpoint returns full safe DTO after correct verdict', async () => {
    const canonical = await canonicalAccusation();

    const cookie = await registerAndLogin('solution-reveal');
    const invId = await createInvestigation(cookie, caseId);
    await prepareForAccusation(cookie, invId);

    const verdict = await request('POST', verdictPath(invId), canonical, cookie);
    if (verdict.status !== 200 || verdict.body?.evaluationResult !== 'correct') {
      throw new Error(`Expected correct verdict, got ${verdict.status} ${verdict.body?.evaluationResult}`);
    }

    const res = await request('GET', `/api/investigations/${invId}/solution`, undefined, cookie);
    if (res.status !== 200) throw new Error(`Solution fetch failed: ${res.status} ${JSON.stringify(res.body)}`);
    const body = res.body;

    for (const field of [
      'culprit', 'motive', 'method', 'solutionExplanation',
      'redHerrings', 'alternativeTheories', 'clueResolutions', 'actualTimeline',
    ]) {
      if (!(field in body)) throw new Error(`Missing solution field: ${field}`);
    }
    if (body.culprit !== canonical.culprit) throw new Error('Culprit mismatch in solution DTO');
    if (!Array.isArray(body.redHerrings) || body.redHerrings.length === 0) {
      throw new Error('No red herrings revealed');
    }
    if (!Array.isArray(body.alternativeTheories) || body.alternativeTheories.length === 0) {
      throw new Error('No alternative theories revealed');
    }
    if (!Array.isArray(body.clueResolutions) || body.clueResolutions.length === 0) {
      throw new Error('No clue resolutions revealed');
    }
    if (!Array.isArray(body.actualTimeline) || body.actualTimeline.length === 0) {
      throw new Error('No actual timeline revealed');
    }
    if (!body.redHerrings.every((rh: any) => rh && typeof rh.label === 'string')) {
      throw new Error('Malformed red herring entry');
    }
    if (!body.alternativeTheories.every((t: any) =>
      t && typeof t.title === 'string' && typeof t.resolution === 'string')) {
      throw new Error('Malformed alternative theory entry');
    }
    if (!body.clueResolutions.every((cr: any) =>
      cr && typeof cr.clue === 'string' && typeof cr.resolution === 'string')) {
      throw new Error('Malformed clue resolution entry');
    }

    const serialized = JSON.stringify(body);
    for (const key of FORBIDDEN_SOLUTION_KEYS) {
      if (serialized.includes(`"${key}"`)) throw new Error(`${key} leaked in solution response`);
    }
    solvedInvId = invId;
  });

  await test('Solution endpoint enforces ownership', async () => {
    if (!solvedInvId) throw new Error('Solved investigation prerequisite missing');
    const otherCookie = await registerAndLogin('solution-other-user');
    const res = await request(
      'GET',
      `/api/investigations/${solvedInvId}/solution`,
      undefined,
      otherCookie
    );
    if (res.status !== 403 && res.status !== 404) {
      throw new Error(`Non-owner could fetch solution: ${res.status}`);
    }
    if (JSON.stringify(res.body).includes('"solutionExplanation"')) {
      throw new Error('Solution leaked to non-owner');
    }
  });

  console.log('\n=== Async Progression Tests (PROD-008) ===\n');

  await test('Checkpoint state is spoiler-free and lists authored deductions', async () => {
    if (!cctvEvidenceId) throw new Error('No CCTV evidence in seed data');
    const cookie = await registerAndLogin('checkpoint-state');
    const invId = await createInvestigation(cookie, caseId);

    const res = await request('GET', `/api/investigations/${invId}/checkpoints`, undefined, cookie);
    if (res.status !== 200) throw new Error(`Checkpoint state failed: ${res.status} ${JSON.stringify(res.body)}`);
    if (!Array.isArray(res.body?.checkpoints) || res.body.checkpoints.length === 0) {
      throw new Error('No deduction checkpoints exposed');
    }
    const serialized = JSON.stringify(res.body);
    for (const key of [
      'hiddenInterpretation', 'supportedHypotheses', 'contradictedHypotheses',
      'hiddenEvents', 'solutionExplanation', 'culprit', 'motive', 'method',
    ]) {
      if (serialized.includes(`"${key}"`)) throw new Error(`${key} leaked in checkpoint state`);
    }
    const cane = res.body.checkpoints.find((c: any) => c.id === 'silver-cane-identified');
    if (!cane || cane.completed !== false) throw new Error('Expected an incomplete silver-cane checkpoint');
  });

  await test('Deduction checkpoint releases eligible hidden evidence transactionally', async () => {
    if (!cctvEvidenceId || !securityFootageId) throw new Error('Progression fixtures missing');
    const cookie = await registerAndLogin('deduction-release');
    const invId = await createInvestigation(cookie, caseId);

    const before = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    const beforeIds: string[] = before.body?.discoveredEvidenceIds ?? [];
    if (beforeIds.includes(cctvEvidenceId)) throw new Error('CCTV was visible before the deduction');

    const submitted = await request('POST', `/api/investigations/${invId}/theory`, {
      checkpointId: 'silver-cane-identified',
      theory: 'The cane silhouette and limp in the corridor footage point to the figure with a knee injury.',
      supportingEvidence: [securityFootageId],
      confidence: 'medium',
    }, cookie);
    if (submitted.status !== 200) {
      throw new Error(`Theory submission failed: ${submitted.status} ${JSON.stringify(submitted.body)}`);
    }
    if (submitted.body?.result !== 'plausible') throw new Error(`Unexpected theory result: ${submitted.body?.result}`);

    const released = submitted.body?.newlyReleased ?? [];
    if (!Array.isArray(released) || !released.some((ev: any) => ev.id === cctvEvidenceId)) {
      throw new Error('CCTV evidence was not released by the deduction');
    }
    for (const ev of released) {
      for (const key of ['hiddenInterpretation', 'supportedHypotheses', 'contradictedHypotheses']) {
        if (key in ev) throw new Error(`${key} leaked in released evidence DTO`);
      }
    }

    // Re-submitting the same checkpoint must not duplicate the release.
    await request('POST', `/api/investigations/${invId}/theory`, {
      checkpointId: 'silver-cane-identified',
      theory: 'Revising: the cane grip identifies the wounded suspect.',
      supportingEvidence: [securityFootageId],
    }, cookie);

    const after = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    const afterIds: string[] = after.body?.discoveredEvidenceIds ?? [];
    if (afterIds.filter((id) => id === cctvEvidenceId).length !== 1) {
      throw new Error('Deduction release was duplicated');
    }

    const evidenceList = await request('GET', `/api/cases/${caseId}/evidence`, undefined, cookie);
    if (!evidenceList.body.some((ev: any) => ev.id === cctvEvidenceId)) {
      throw new Error('Released evidence did not appear in the case evidence list');
    }
  });

  await test('Theory response never leaks canonical truth or hidden hypotheses', async () => {
    const cookie = await registerAndLogin('theory-safety');
    const invId = await createInvestigation(cookie, caseId);
    const res = await request('POST', `/api/investigations/${invId}/theory`, {
      checkpointId: 'alarm-window-identified',
      theory: 'A scheduled maintenance window explains the exact twelve-minute blackout.',
      supportingEvidence: [],
    }, cookie);
    if (res.status !== 200) throw new Error(`Theory submission failed: ${res.status}`);
    const serialized = JSON.stringify(res.body);
    for (const key of [
      'hiddenInterpretation', 'supportedHypotheses', 'contradictedHypotheses',
      'hiddenEvents', 'solutionExplanation', 'redHerrings', 'alternativeTheories',
      'clueResolutions', 'actualTimeline', 'culprit', 'motive', 'method',
    ]) {
      if (serialized.includes(`"${key}"`)) throw new Error(`${key} leaked in theory response`);
    }
  });

  await test('Time-triggered catch-up applies a due event and logs a development', async () => {
    if (!forensicEvidenceId) throw new Error('No fingerprint analysis evidence in seed data');
    const cookie = await registerAndLogin('time-catchup');
    const invId = await createInvestigation(cookie, caseId);

    // Simulate a server-authored due event that elapsed while the player was
    // offline. Clients cannot attach evidence to events themselves.
    await query(
      `INSERT INTO scheduled_events
         (investigation_id, event_type, trigger_condition, scheduled_timestamp,
          release_status, associated_evidence, narrative_payload, created_at, updated_at)
       VALUES ($1, 'evidence_release', '{}'::jsonb, NOW() - INTERVAL '5 minutes',
               'pending', $2, $3::jsonb, NOW(), NOW())`,
      [invId, forensicEvidenceId, JSON.stringify({ message: 'The forensic report has arrived.' })]
    );

    const eventsBefore = await request('GET', `/api/investigations/${invId}/scheduled-events`, undefined, cookie);
    if (eventsBefore.status !== 200) throw new Error('Scheduled events fetch failed');
    for (const evt of eventsBefore.body) {
      if ('associatedEvidence' in evt || 'triggerCondition' in evt) {
        throw new Error('Scheduled event leaked server-only fields');
      }
    }

    // Any owned-investigation read triggers offline catch-up.
    const after = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    const ids: string[] = after.body?.discoveredEvidenceIds ?? [];
    if (!ids.includes(forensicEvidenceId)) {
      throw new Error('Due event did not release its evidence during catch-up');
    }
    if (ids.filter((id) => id === forensicEvidenceId).length !== 1) {
      throw new Error('Time release was duplicated');
    }

    const developments = await request('GET', `/api/investigations/${invId}/developments`, undefined, cookie);
    if (developments.status !== 200 || !Array.isArray(developments.body)) {
      throw new Error('Developments feed failed');
    }
    if (!developments.body.some((d: any) => d.message === 'The forensic report has arrived.')) {
      throw new Error('Scheduled development was not recorded in the catch-up feed');
    }
  });

  await test('Clients cannot force evidence release through event status', async () => {
    const cookie = await registerAndLogin('event-status-spoof');
    const invId = await createInvestigation(cookie, caseId);
    const events = await request('GET', `/api/investigations/${invId}/scheduled-events`, undefined, cookie);
    const eventId = events.body?.[0]?.id;
    if (!eventId) throw new Error('No seeded scheduled event for ownership test');

    const forced = await request('PATCH', `/api/investigations/${invId}/events/${eventId}`, {
      releaseStatus: 'released',
    }, cookie);
    if (forced.status !== 403 && forced.status !== 400) {
      throw new Error(`Client forced event release: ${forced.status}`);
    }
    const after = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    if ((after.body?.discoveredEvidenceIds ?? []).includes(String(forensicEvidenceId))) {
      throw new Error('Forcing event status released hidden evidence');
    }
  });

  console.log('\n=== Completed-Case Evidence Visibility (PROD-011 / BUG-008 / GAP-07) ===\n');

  await test('Released evidence stays visible after investigation completion', async () => {
    if (!cctvEvidenceId || !securityFootageId) throw new Error('Progression fixtures missing');
    const cookie = await registerAndLogin('completed-evidence');
    const invId = await createInvestigation(cookie, caseId);

    // CCTV is hidden (playerVisible=false) and not yet discovered.
    const before = await request('GET', `/api/cases/${caseId}/evidence`, undefined, cookie);
    if (before.status !== 200) throw new Error(`Evidence fetch failed: ${before.status}`);
    if (before.body.some((ev: any) => ev.id === cctvEvidenceId)) {
      throw new Error('Hidden CCTV evidence was visible before server-side release');
    }

    // Server-authorized release through a deduction checkpoint.
    const submitted = await request('POST', `/api/investigations/${invId}/theory`, {
      checkpointId: 'silver-cane-identified',
      theory: 'The cane grip and the limp in the corridor identify the wounded figure.',
      supportingEvidence: [securityFootageId],
    }, cookie);
    if (submitted.status !== 200) {
      throw new Error(`Theory submission failed: ${submitted.status} ${JSON.stringify(submitted.body)}`);
    }

    const activeList = await request('GET', `/api/cases/${caseId}/evidence`, undefined, cookie);
    if (!activeList.body.some((ev: any) => ev.id === cctvEvidenceId)) {
      throw new Error('Released CCTV evidence did not appear while investigation was active');
    }

    // Complete the case with a correct, server-evaluated verdict.
    const canonical = await canonicalAccusation();
    const verdict = await request('POST', verdictPath(invId), canonical, cookie);
    if (verdict.status !== 200 || verdict.body?.evaluationResult !== 'correct') {
      throw new Error(`Expected correct verdict, got ${verdict.status} ${verdict.body?.evaluationResult}`);
    }
    const inv = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    if (inv.body?.status !== 'completed') {
      throw new Error(`Investigation was not completed: ${inv.body?.status}`);
    }

    // REGRESSION: evidence released during play must STILL be visible after completion.
    const after = await request('GET', `/api/cases/${caseId}/evidence`, undefined, cookie);
    if (after.status !== 200) throw new Error(`Post-completion evidence fetch failed: ${after.status}`);
    if (!after.body.some((ev: any) => ev.id === cctvEvidenceId)) {
      throw new Error('Released evidence disappeared after investigation completion');
    }

    // getCaseById had the same active-only bug - its visibleEvidence must hold too.
    const caseData = await request('GET', `/api/cases/${caseId}`, undefined, cookie);
    if (caseData.status !== 200) throw new Error(`Case fetch failed: ${caseData.status}`);
    if (!Array.isArray(caseData.body?.visibleEvidence) ||
        !caseData.body.visibleEvidence.some((ev: any) => ev.id === cctvEvidenceId)) {
      throw new Error('Released evidence missing from case visibleEvidence after completion');
    }

    // No hidden interpretation/hypothesis fields in any post-completion payload.
    for (const ev of [...after.body, ...(caseData.body?.visibleEvidence ?? [])]) {
      for (const key of ['hiddenInterpretation', 'supportedHypotheses', 'contradictedHypotheses']) {
        if (ev && key in ev) throw new Error(`${key} leaked in post-completion evidence payload`);
      }
    }
  });

  await test('Completed-case evidence is not exposed to other users', async () => {
    if (!cctvEvidenceId) throw new Error('Progression fixtures missing');
    // A fresh user who never revealed CCTV must not see it via the broadened lookup.
    const otherCookie = await registerAndLogin('completed-evidence-other');
    const res = await request('GET', `/api/cases/${caseId}/evidence`, undefined, otherCookie);
    if (res.status !== 200) throw new Error(`Evidence fetch failed: ${res.status}`);
    if (res.body.some((ev: any) => ev.id === cctvEvidenceId)) {
      throw new Error('Another user could see evidence revealed in a completed investigation');
    }
  });

  console.log('\n=== Chat Endpoint Tests ===\n');

  let chatInvestigationId: string | null = null;
  await test('Create investigation for chat test', async () => {
    const res = await request('POST', '/api/investigations', { caseId }, primaryCookie);
    if (res.status !== 201) {
      throw new Error(`Create investigation failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    if (!res.body?.id) throw new Error('No investigation id in response');
    chatInvestigationId = String(res.body.id);
  });

  await test('Chat endpoint returns role/content/timestamp and persists messages', async () => {
    if (!primaryCookie || !chatInvestigationId) throw new Error('Chat test prerequisites missing');

    const res = await request('POST', `/api/investigations/${chatInvestigationId}/chat`, {
      message: 'Hello team, what should I examine first?',
    }, primaryCookie);
    if (res.status !== 200) {
      throw new Error(`Chat failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    if (typeof res.body?.role !== 'string' || !res.body.role) throw new Error('Missing role');
    if (typeof res.body?.content !== 'string' || !res.body.content) throw new Error('Missing content');
    if (typeof res.body?.timestamp !== 'string' || !res.body.timestamp) throw new Error('Missing timestamp');

    const conv = await request(
      'GET',
      `/api/investigations/${chatInvestigationId}/conversation`,
      undefined,
      primaryCookie
    );
    if (conv.status !== 200) throw new Error(`Conversation fetch failed: ${conv.status}`);
    const history = conv.body?.messageHistory;
    if (!Array.isArray(history)) throw new Error('No messageHistory in conversation');
    if (!history.some((m: any) => m && m.role === 'player')) throw new Error('Player message not persisted');
    if (!history.some((m: any) => m && m.role === 'investigator')) throw new Error('Investigator reply not persisted');
  });

  console.log('\n=== AI Grounding / Context Discipline Tests (PROD-014 / GAP-09) ===\n');

  const ALLOWED_TEAM_ROLES = ['lead', 'forensic', 'field', 'digital'];

  await test('Chat selects a role-aware responder and reports bounded context', async () => {
    const cookie = await registerAndLogin('grounding-roles');
    const invId = await createInvestigation(cookie, caseId);

    const intents: Array<{ message: string; role: string }> = [
      { message: 'Hello team, what is our plan?', role: 'lead' },
      { message: 'What does the fingerprint evidence show?', role: 'forensic' },
      { message: 'Can we review the CCTV footage and the timeline?', role: 'digital' },
      { message: 'Who is the witness and what is their alibi?', role: 'field' },
    ];
    for (const intent of intents) {
      const res = await request('POST', `/api/investigations/${invId}/chat`, {
        message: intent.message,
      }, cookie);
      if (res.status !== 200) throw new Error(`Chat failed: ${res.status} ${JSON.stringify(res.body)}`);
      if (!ALLOWED_TEAM_ROLES.includes(res.body?.teamRole)) {
        throw new Error(`Unexpected teamRole: ${res.body?.teamRole}`);
      }
      if (res.body.teamRole !== intent.role) {
        throw new Error(`Expected role ${intent.role} for "${intent.message}" but got ${res.body.teamRole}`);
      }
      if (typeof res.body?.responderLabel !== 'string' || !res.body.responderLabel) {
        throw new Error('Missing responderLabel');
      }
      if (!res.body.content.startsWith(res.body.responderLabel)) {
        throw new Error('Deterministic reply does not carry its responder voice');
      }
      const ctx = res.body?.context;
      if (!ctx || typeof ctx.chars !== 'number' || ctx.chars > ctx.maxChars) {
        throw new Error(`Context not bounded: ${JSON.stringify(ctx)}`);
      }
      if (ctx.window !== 6 || ctx.recentMessages > ctx.window || ctx.retrievedEvidence > 3) {
        throw new Error(`Context window/retrieval limits exceeded: ${JSON.stringify(ctx)}`);
      }
    }
  });

  await test('Addressed suspect uses public projection only - no hidden/canonical leakage', async () => {
    const ct = await query(
      'SELECT motive, method, solution_explanation, hidden_events FROM canonical_truth WHERE case_id = $1 LIMIT 1',
      [caseId]
    );
    const row = ct.rows[0] ?? {};
    const forbiddenStrings: string[] = [];
    for (const key of ['motive', 'method', 'solution_explanation']) {
      const value = row[key];
      if (typeof value === 'string' && value.length > 40) forbiddenStrings.push(value.slice(0, 50));
    }
    if (Array.isArray(row.hidden_events) && typeof row.hidden_events[0]?.event === 'string') {
      forbiddenStrings.push(row.hidden_events[0].event.slice(0, 50));
    }
    const forbiddenKeys = [
      'knowledge', 'beliefs', 'secrets', 'dialogueConstraints', 'dialogue_constraints',
      'hiddenEvents', 'hidden_events', 'solutionExplanation', 'solution_explanation',
      'canonicalTruth', 'canonical_truth',
    ];

    const cookie = await registerAndLogin('grounding-suspect-leak');
    const invId = await createInvestigation(cookie, caseId);

    const res = await request('POST', `/api/investigations/${invId}/chat`, {
      message: 'Tell me about Victor Sterling and his motive. What do we know publicly?',
    }, cookie);
    if (res.status !== 200) throw new Error(`Chat failed: ${res.status}`);
    const addressed = res.body?.addressedSuspects;
    if (!Array.isArray(addressed) || !addressed.includes('Victor Sterling')) {
      throw new Error(`Victor Sterling was not projected: ${JSON.stringify(addressed)}`);
    }
    if (addressed.length !== 1) {
      throw new Error(`Only the addressed suspect should be projected: ${JSON.stringify(addressed)}`);
    }

    const conv = await request('GET', `/api/investigations/${invId}/conversation`, undefined, cookie);
    const serialized = JSON.stringify(res.body) + JSON.stringify(conv.body);
    for (const key of forbiddenKeys) {
      if (serialized.includes(`"${key}"`)) throw new Error(`${key} leaked through chat`);
    }
    for (const secret of forbiddenStrings) {
      if (secret && serialized.includes(secret)) throw new Error(`Canonical detail leaked through chat: ${secret}`);
    }

    // Generic questions must not project any suspect knowledge.
    const generic = await request('POST', `/api/investigations/${invId}/chat`, {
      message: 'What should we examine next?',
    }, cookie);
    if (generic.status !== 200) throw new Error(`Generic chat failed: ${generic.status}`);
    if (!Array.isArray(generic.body?.addressedSuspects) || generic.body.addressedSuspects.length !== 0) {
      throw new Error('Generic question unexpectedly projected a suspect');
    }
  });

  await test('Rolling summary is persisted, bounded, and free of canonical leaks', async () => {
    const cookie = await registerAndLogin('grounding-summary');
    const invId = await createInvestigation(cookie, caseId);
    for (let i = 0; i < 9; i++) {
      const res = await request('POST', `/api/investigations/${invId}/chat`, {
        message: `Question ${i}: what does the evidence suggest so far?`,
      }, cookie);
      if (res.status !== 200) throw new Error(`Chat ${i} failed: ${res.status}`);
    }
    const conv = await request('GET', `/api/investigations/${invId}/conversation`, undefined, cookie);
    if (conv.status !== 200) throw new Error(`Conversation fetch failed: ${conv.status}`);
    if (typeof conv.body?.summary !== 'string' || conv.body.summary.length === 0) {
      throw new Error('Rolling summary was not persisted');
    }
    if (conv.body.summary.length > 1300) throw new Error(`Summary exceeded cap: ${conv.body.summary.length}`);
    const history = conv.body?.messageHistory;
    if (!Array.isArray(history) || history.length < 18) throw new Error('Chat messages were not persisted');

    // A very long (but valid) message must not blow the bounded summary.
    const longRes = await request('POST', `/api/investigations/${invId}/chat`, {
      message: `Investigate ${'z'.repeat(3500)}`,
    }, cookie);
    if (longRes.status !== 200) throw new Error(`Long chat failed: ${longRes.status}`);
    const after = await request('GET', `/api/investigations/${invId}/conversation`, undefined, cookie);
    if (typeof after.body?.summary !== 'string' || after.body.summary.length > 1300) {
      throw new Error('Summary grew past bound after long message');
    }
    if (/culprit|solution_explanation|hidden_events|20 million|hollow base/.test(after.body.summary)) {
      throw new Error('Canonical detail leaked into rolling summary');
    }
  });

  await test('Chat enforces authentication and investigation ownership', async () => {
    const owner = await registerAndLogin('grounding-owner');
    const invId = await createInvestigation(owner, caseId);
    const unauth = await request('POST', `/api/investigations/${invId}/chat`, { message: 'Hello' });
    if (unauth.status !== 401 && unauth.status !== 403) {
      throw new Error(`Unauthenticated chat not rejected: ${unauth.status}`);
    }
    const other = await registerAndLogin('grounding-other');
    const foreign = await request('POST', `/api/investigations/${invId}/chat`, { message: 'Hello' }, other);
    if (foreign.status !== 403 && foreign.status !== 404) {
      throw new Error(`Foreign chat not rejected: ${foreign.status}`);
    }
  });

  console.log('\n=== Suspect Board Tests (PROD-013 / GAP-08) ===\n');

  // Internal character/canonical keys that must never appear in the projection.
  const FORBIDDEN_SUSPECT_KEYS = [
    'knowledge', 'beliefs', 'secrets', 'hiddenInterpretation', 'hidden_interpretation',
    'supportedHypotheses', 'supported_hypotheses', 'contradictedHypotheses',
    'contradicted_hypotheses', 'hiddenEvents', 'hidden_events', 'canonicalTruth',
    'canonical_truth', 'solutionExplanation', 'solution_explanation', 'redHerrings',
    'alternativeTheories', 'clueResolutions', 'actualTimeline', 'dialogueConstraints',
    'dialogue_constraints',
  ];

  await test('Suspect board exposes safe depth fields without internal/canonical leakage', async () => {
    const cookie = await registerAndLogin('suspect-board-safe');
    const invId = await createInvestigation(cookie, caseId);
    const res = await request('GET', `/api/investigations/${invId}/suspects`, undefined, cookie);
    if (res.status !== 200) throw new Error(`Suspect board failed: ${res.status} ${JSON.stringify(res.body)}`);
    const body = res.body;
    if (body?.caseId !== caseId) throw new Error('Suspect board has wrong caseId');
    if (!Array.isArray(body?.suspects) || body.suspects.length < 5) throw new Error('Expected 5+ suspect profiles');
    if (!Array.isArray(body?.openQuestions)) throw new Error('No open questions list');

    for (const suspect of body.suspects) {
      for (const field of [
        'id', 'name', 'role', 'motive', 'relationships', 'linkedEvidence',
        'linkedEvidenceCount', 'playerSuspicion', 'unansweredQuestions',
      ]) {
        if (!(field in suspect)) throw new Error(`Missing suspect field: ${field}`);
      }
      if (typeof suspect.motive !== 'string') throw new Error('motive is not a string');
      if (!Array.isArray(suspect.relationships)) throw new Error('relationships is not an array');
      if (!Array.isArray(suspect.linkedEvidence)) throw new Error('linkedEvidence is not an array');
      if (typeof suspect.linkedEvidenceCount !== 'number' ||
          suspect.linkedEvidenceCount !== suspect.linkedEvidence.length) {
        throw new Error('linkedEvidenceCount mismatch');
      }
      if (suspect.playerSuspicion !== null && typeof suspect.playerSuspicion !== 'string') {
        throw new Error('playerSuspicion has unexpected type');
      }
      if (!Array.isArray(suspect.unansweredQuestions) ||
          !suspect.unansweredQuestions.every((q: unknown) => typeof q === 'string')) {
        throw new Error('unansweredQuestions malformed');
      }
      for (const rel of suspect.relationships) {
        if (!rel || typeof rel.name !== 'string' || typeof rel.label !== 'string' ||
            Object.keys(rel).length > 2) {
          throw new Error('Relationship entry exposes unexpected data');
        }
      }
      for (const ev of suspect.linkedEvidence) {
        if (!ev || typeof ev.id !== 'string' || typeof ev.examined !== 'boolean') {
          throw new Error('Linked evidence entry malformed');
        }
        for (const key of Object.keys(ev)) {
          if (!['id', 'source', 'category', 'timelineReference', 'examined'].includes(key)) {
            throw new Error(`Linked evidence leaked extra field: ${key}`);
          }
        }
      }
    }

    const serialized = JSON.stringify(body);
    for (const key of FORBIDDEN_SUSPECT_KEYS) {
      if (serialized.includes(`"${key}"`)) throw new Error(`${key} leaked in suspect board`);
    }
    const victor = body.suspects.find((s: any) => s.name === 'Victor Sterling');
    if (!victor) throw new Error('Victor Sterling missing from suspect board');
    if (/hidden\s*:/i.test(victor.motive) || victor.motive.includes('20 million')) {
      throw new Error('Canonical/hidden motive leaked through suspect motive');
    }
  });

  await test('Suspect board links only visible/own evidence and enforces ownership', async () => {
    const cookieA = await registerAndLogin('suspect-board-owner');
    const invA = await createInvestigation(cookieA, caseId);

    const hiddenLinked = await query(
      `SELECT id FROM evidence WHERE case_id = $1 AND player_visible = false
         AND associated_characters ILIKE '%Victor Sterling%' LIMIT 1`,
      [caseId]
    );
    const hiddenLinkedId = hiddenLinked.rows[0]?.id as string | undefined;

    const boardA = await request('GET', `/api/investigations/${invA}/suspects`, undefined, cookieA);
    if (boardA.status !== 200) throw new Error(`Suspect board failed: ${boardA.status}`);
    if (hiddenLinkedId && JSON.stringify(boardA.body).includes(hiddenLinkedId)) {
      throw new Error('Hidden linked evidence leaked into suspect board');
    }

    const visibleLinked = await query(
      `SELECT id FROM evidence WHERE case_id = $1 AND player_visible = true
         AND associated_characters ILIKE '%Victor Sterling%' LIMIT 1`,
      [caseId]
    );
    const visibleLinkedId = visibleLinked.rows[0]?.id as string | undefined;
    if (visibleLinkedId) {
      const victorA = boardA.body.suspects.find((s: any) => s.name === 'Victor Sterling');
      if (!victorA.linkedEvidence.some((ev: any) => ev.id === visibleLinkedId)) {
        throw new Error('Visible linked evidence missing from suspect board');
      }
      const discovered = await request(
        'POST', `/api/investigations/${invA}/discover-evidence`, { evidenceId: visibleLinkedId }, cookieA
      );
      if (discovered.status !== 200) throw new Error(`Discovery failed: ${discovered.status}`);
      const boardAfter = await request('GET', `/api/investigations/${invA}/suspects`, undefined, cookieA);
      const victorAfter = boardAfter.body.suspects.find((s: any) => s.name === 'Victor Sterling');
      const item = victorAfter.linkedEvidence.find((ev: any) => ev.id === visibleLinkedId);
      if (!item?.examined) throw new Error('Examined evidence not reflected on suspect board');
    }

    const cookieB = await registerAndLogin('suspect-board-other');
    const invB = await createInvestigation(cookieB, caseId);
    const boardB = await request('GET', `/api/investigations/${invB}/suspects`, undefined, cookieB);
    if (boardB.status !== 200) throw new Error(`Second player board failed: ${boardB.status}`);
    const victorB = boardB.body.suspects.find((s: any) => s.name === 'Victor Sterling');
    if (visibleLinkedId && victorB.linkedEvidence.some((ev: any) => ev.id === visibleLinkedId && ev.examined)) {
      throw new Error("Another player's examined state leaked into suspect board");
    }

    const foreign = await request('GET', `/api/investigations/${invA}/suspects`, undefined, cookieB);
    if (foreign.status !== 403 && foreign.status !== 404) {
      throw new Error(`Non-owner could read suspect board: ${foreign.status}`);
    }
  });

  await test('Suspect board reflects the player suspicion stored in investigation state', async () => {
    const cookie = await registerAndLogin('suspect-board-suspicion');
    const invId = await createInvestigation(cookie, caseId);
    await query(
      'UPDATE investigation_state SET suspicion_levels = $2::jsonb WHERE investigation_id = $1',
      [invId, JSON.stringify({
        'Victor Sterling': 'high',
        'Jasper Vale': 'medium',
        ignored: { not: 'a scalar' },
      })]
    );
    const res = await request('GET', `/api/investigations/${invId}/suspects`, undefined, cookie);
    if (res.status !== 200) throw new Error(`Suspect board failed: ${res.status}`);
    const victor = res.body.suspects.find((s: any) => s.name === 'Victor Sterling');
    const jasper = res.body.suspects.find((s: any) => s.name === 'Jasper Vale');
    if (victor?.playerSuspicion !== 'high') throw new Error(`Suspicion not reflected: ${victor?.playerSuspicion}`);
    if (jasper?.playerSuspicion !== 'medium') throw new Error('Second suspicion not reflected');
    if (JSON.stringify(res.body).includes('ignored')) throw new Error('Non-scalar suspicion value leaked');
  });

  console.log('\n=== Abandon / Reset Investigation Tests (PROD-012 / GAP-10) ===\n');

  await test('Abandon requires explicit confirmation', async () => {
    const cookie = await registerAndLogin('abandon-confirm');
    const invId = await createInvestigation(cookie, caseId);

    for (const body of [{}, { confirm: 'yes' }, { confirm: false }]) {
      const res = await request('POST', `/api/investigations/${invId}/abandon`, body, cookie);
      if (res.status !== 400) throw new Error(`Invalid confirmation accepted: ${res.status}`);
    }
    const after = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    if (after.body?.status !== 'active') throw new Error('Rejected abandon changed investigation state');
  });

  await test('Owner can abandon active case: lock released, history preserved, new case starts', async () => {
    const cookie = await registerAndLogin('abandon-success');
    const invId = await createInvestigation(cookie, caseId);

    if (visibleEvidenceId) {
      const discovered = await request(
        'POST', `/api/investigations/${invId}/discover-evidence`, { evidenceId: visibleEvidenceId }, cookie
      );
      if (discovered.status !== 200) throw new Error(`Setup discovery failed: ${discovered.status}`);
    }
    const note = await request('POST', `/api/investigations/${invId}/journal`, {
      entryType: 'note', content: 'Preserved across abandon',
    }, cookie);
    if (note.status !== 201) throw new Error(`Setup journal failed: ${note.status}`);

    const res = await request('POST', `/api/investigations/${invId}/abandon`, { confirm: true }, cookie);
    if (res.status !== 200) throw new Error(`Abandon failed: ${res.status} ${JSON.stringify(res.body)}`);
    if (res.body?.status !== 'abandoned') throw new Error(`Unexpected abandoned status: ${res.body?.status}`);

    const active = await request('GET', '/api/investigations/active', undefined, cookie);
    if (active.status !== 404) throw new Error(`Active-case lock not released: ${active.status}`);

    const fresh = await request('POST', '/api/investigations', { caseId }, cookie);
    if (fresh.status !== 201 || !fresh.body?.id) {
      throw new Error(`Could not start a new investigation: ${fresh.status} ${JSON.stringify(fresh.body)}`);
    }
    if (fresh.body.id === invId) throw new Error('Abandoned investigation id was reused');
    if (fresh.body?.status !== 'active') throw new Error('New investigation is not active');

    // Abandoned investigation stays owner-readable with its data intact.
    const old = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    if (old.body?.status !== 'abandoned') throw new Error('Abandoned status was not persisted');
    if (visibleEvidenceId && !(old.body?.discoveredEvidenceIds ?? []).includes(visibleEvidenceId)) {
      throw new Error('Discovered evidence was not preserved after abandon');
    }
    const entries = await request('GET', `/api/investigations/${invId}/journal`, undefined, cookie);
    if (!Array.isArray(entries.body) ||
        !entries.body.some((e: any) => e.content === 'Preserved across abandon')) {
      throw new Error('Journal history was not preserved after abandon');
    }
    for (const secret of ['culprit', 'motive', 'method', 'solutionExplanation', 'hidden_events']) {
      if (JSON.stringify(old.body).includes(`"${secret}"`)) {
        throw new Error(`${secret} leaked in abandoned investigation DTO`);
      }
    }

    const again = await request('POST', `/api/investigations/${invId}/abandon`, { confirm: true }, cookie);
    if (again.status !== 409) throw new Error(`Second abandon was not rejected: ${again.status}`);
  });

  await test('Abandon requires authentication and ownership', async () => {
    const cookie = await registerAndLogin('abandon-owner');
    const invId = await createInvestigation(cookie, caseId);

    const unauth = await request('POST', `/api/investigations/${invId}/abandon`, { confirm: true });
    if (unauth.status !== 401 && unauth.status !== 403) {
      throw new Error(`Unauthenticated abandon not rejected: ${unauth.status}`);
    }

    const otherCookie = await registerAndLogin('abandon-other');
    const foreign = await request(
      'POST', `/api/investigations/${invId}/abandon`, { confirm: true }, otherCookie
    );
    if (foreign.status !== 403 && foreign.status !== 404) {
      throw new Error(`Non-owner abandon not rejected: ${foreign.status}`);
    }

    const after = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    if (after.body?.status !== 'active') throw new Error('Unauthorized abandon changed investigation state');
  });

  await test('Completed investigation cannot be abandoned (resolution stays final)', async () => {
    const cookie = await registerAndLogin('abandon-completed');
    const invId = await createInvestigation(cookie, caseId);
    await prepareForAccusation(cookie, invId);
    const canonical = await canonicalAccusation();
    const verdict = await request('POST', verdictPath(invId), canonical, cookie);
    if (verdict.status !== 200 || verdict.body?.evaluationResult !== 'correct') {
      throw new Error(`Setup verdict failed: ${verdict.status}`);
    }

    const res = await request('POST', `/api/investigations/${invId}/abandon`, { confirm: true }, cookie);
    if (res.status !== 409) throw new Error(`Completed case was abandonable: ${res.status}`);
    const after = await request('GET', `/api/investigations/${invId}`, undefined, cookie);
    if (after.body?.status !== 'completed') {
      throw new Error(`Abandon changed completed status: ${after.body?.status}`);
    }
    const solution = await request('GET', `/api/investigations/${invId}/solution`, undefined, cookie);
    if (solution.status !== 200 || solution.body?.culprit !== canonical.culprit) {
      throw new Error('Solution reveal broke after rejected abandon');
    }
  });

  await test('Abandoned investigation remains visible in the archive with a clear status', async () => {
    const cookie = await registerAndLogin('abandon-archive');
    const invId = await createInvestigation(cookie, caseId);
    const res = await request('POST', `/api/investigations/${invId}/abandon`, { confirm: true }, cookie);
    if (res.status !== 200) throw new Error(`Abandon failed: ${res.status}`);

    const archive = await request('GET', '/api/investigations/archive', undefined, cookie);
    if (archive.status !== 200 || !Array.isArray(archive.body)) {
      throw new Error(`Archive fetch failed: ${archive.status}`);
    }
    const entry = archive.body.find((item: any) => item.id === invId);
    if (!entry || entry.status !== 'abandoned') {
      throw new Error('Abandoned case missing from archive or mislabelled');
    }
  });

  console.log('\n=== Investigation Stats Tests (P2-POLISH) ===\n');

  await test('Stats summary is owner-scoped, safe-shaped, and reflects discovery', async () => {
    if (!visibleEvidenceId) throw new Error('No visible evidence in seed data');
    const owner = await registerAndLogin('stats-owner');
    const invId = await createInvestigation(owner, caseId);

    const initial = await request('GET', `/api/investigations/${invId}/stats`, undefined, owner);
    if (initial.status !== 200) {
      throw new Error(`Stats fetch failed: ${initial.status} ${JSON.stringify(initial.body)}`);
    }
    const body = initial.body;

    // Exact allowlisted shape with correct value types - no derived/private fields.
    if (!body.evidence || typeof body.evidence.discovered !== 'number' ||
        typeof body.evidence.total !== 'number') {
      throw new Error('Invalid evidence stats shape');
    }
    if (body.evidence.total < 1) throw new Error('Evidence total should be positive');
    if (typeof body.accusations !== 'number') throw new Error('accusations is not a number');
    if (!body.checkpoints || typeof body.checkpoints.answered !== 'number' ||
        typeof body.checkpoints.total !== 'number') {
      throw new Error('Invalid checkpoints stats shape');
    }
    if (typeof body.achievements !== 'number') throw new Error('achievements is not a number');
    if (typeof body.progress !== 'number') throw new Error('progress is not a number');
    if (typeof body.elapsedSeconds !== 'number' || body.elapsedSeconds < 0) {
      throw new Error('Invalid elapsedSeconds');
    }
    for (const field of ['status', 'startedAt', 'completedAt']) {
      if (!(field in body)) throw new Error(`Missing stats field: ${field}`);
    }

    const serialized = JSON.stringify(body);
    for (const key of [
      'culprit', 'motive', 'method', 'solutionExplanation', 'hiddenEvents',
      'hidden_events', 'knowledge', 'beliefs', 'secrets', 'hiddenInterpretation',
    ]) {
      if (serialized.includes(`"${key}"`)) throw new Error(`${key} leaked in stats DTO`);
    }

    const baseline = body.evidence.discovered;
    const discovered = await request(
      'POST', `/api/investigations/${invId}/discover-evidence`, { evidenceId: visibleEvidenceId }, owner
    );
    if (discovered.status !== 200) throw new Error(`Discovery failed: ${discovered.status}`);

    const after = await request('GET', `/api/investigations/${invId}/stats`, undefined, owner);
    if (after.status !== 200) throw new Error(`Stats refetch failed: ${after.status}`);
    if (after.body.evidence.discovered < baseline + 1) {
      throw new Error('Stats did not reflect the newly discovered evidence');
    }
    if (after.body.achievements < 1) {
      throw new Error('Stats did not reflect the server-awarded achievement');
    }

    const unauth = await request('GET', `/api/investigations/${invId}/stats`);
    if (unauth.status !== 401 && unauth.status !== 403) {
      throw new Error(`Unauthenticated stats not rejected: ${unauth.status}`);
    }
    const other = await registerAndLogin('stats-other');
    const foreign = await request('GET', `/api/investigations/${invId}/stats`, undefined, other);
    if (foreign.status !== 403 && foreign.status !== 404) {
      throw new Error(`Non-owner stats not rejected: ${foreign.status}`);
    }
  });

  // ---------------------------------------------------------------------------
  // M2 knowledge system (specialists / artifacts / disagreements / notebook /
  // specialist-aware chat). USE_LLM=false so the deterministic path is exercised.
  // ---------------------------------------------------------------------------
  console.log('\n=== M2 Knowledge System Tests ===\n');

  const M2_LEAK_TERMS = ['Victor Sterling', 'hollow base', 'silver trophy', 'Sterling Holdings', '20 million'];
  function assertNoLeak(value: unknown, label: string, terms: string[], uuids: string[] = []): void {
    const serialized = JSON.stringify(value);
    for (const term of terms) {
      if (serialized.includes(term)) throw new Error(`${label} leaked canonical term: ${term}`);
    }
    for (const uuid of uuids) {
      if (serialized.includes(uuid)) throw new Error(`${label} leaked evidence UUID: ${uuid}`);
    }
  }
  function assertNoM2Leak(value: unknown, label: string): void {
    assertNoLeak(value, label, M2_LEAK_TERMS, evidenceUuids);
  }
  const evidenceUuids: string[] = (await query('SELECT id FROM evidence WHERE case_id = $1', [caseId]))
    .rows.map((r: any) => String(r.id));
  const otherCase = allCases.find((c: any) => c.id && c.id !== caseId);
  const m2Cookie = await registerAndLogin('m2-knowledge');

  let m2Specialists: any[] = [];
  let m2Artifacts: any[] = [];

  await test('M2: specialists list returns >=3 grounded personas with no canonical leakage', async () => {
    const res = await request('GET', `/api/cases/${caseId}/specialists`, undefined, m2Cookie);
    if (res.status !== 200) throw new Error(`Specialists fetch failed: ${res.status} ${JSON.stringify(res.body)}`);
    if (!Array.isArray(res.body) || res.body.length < 3) throw new Error(`Expected >=3 specialists, got ${JSON.stringify(res.body).slice(0, 200)}`);
    m2Specialists = res.body;
    for (const s of m2Specialists) {
      if (typeof s.specialistKey !== 'string' || !s.specialistKey) throw new Error('Specialist missing specialistKey');
      if (!Array.isArray(s.limitations) || s.limitations.length === 0) throw new Error(`${s.specialistKey} has no limitations`);
      if (!s.depthGuidance || typeof s.depthGuidance !== 'object') throw new Error(`${s.specialistKey} has no depth guidance`);
      if (typeof s.expertiseSummary !== 'string' || s.expertiseSummary.length === 0) throw new Error(`${s.specialistKey} has no expertise summary`);
    }
    assertNoM2Leak(res.body, 'specialists list');
  });

  await test('M2: artifact list uses safe summaries; detail adds content; cross-case 404', async () => {
    const list = await request('GET', `/api/cases/${caseId}/artifacts`, undefined, m2Cookie);
    if (list.status !== 200) throw new Error(`Artifacts fetch failed: ${list.status}`);
    if (!Array.isArray(list.body) || list.body.length < 5) throw new Error(`Expected >=5 artifacts, got ${list.body?.length}`);
    m2Artifacts = list.body;
    for (const a of m2Artifacts) {
      if (typeof a.artifactKey !== 'string' || typeof a.title !== 'string') throw new Error('Artifact missing key/title');
      if ('content' in a) throw new Error(`Artifact ${a.artifactKey} list DTO leaked content`);
      if (!('bibliographyRef' in a) || !('sourceAuthor' in a) || !('sourceVerified' in a)) throw new Error('Artifact DTO missing source metadata');
      if (a.sourceVerified !== true && a.sourceUrl !== null) throw new Error(`Unverified artifact ${a.artifactKey} exposed sourceUrl`);
    }
    assertNoM2Leak(m2Artifacts, 'artifacts list');

    const first = m2Artifacts[0];
    if (!first) throw new Error('No artifact to fetch');
    const detail = await request('GET', `/api/cases/${caseId}/artifacts/${first.id}`, undefined, m2Cookie);
    if (detail.status !== 200) throw new Error(`Artifact detail failed: ${detail.status}`);
    if (typeof detail.body?.content !== 'string' || detail.body.content.length === 0) throw new Error('Artifact detail missing content');
    if (typeof detail.body?.usageNote !== 'string') throw new Error('Artifact detail missing usageNote');
    assertNoM2Leak(detail.body, 'artifact detail');

    if (otherCase?.id) {
      const cross = await request('GET', `/api/cases/${otherCase.id}/artifacts/${first.id}`, undefined, m2Cookie);
      if (cross.status !== 404) throw new Error(`Cross-case artifact not rejected: ${cross.status}`);
    }
  });

  await test('M2: disagreements list returns disciplined, case-scoped positions', async () => {
    const res = await request('GET', `/api/cases/${caseId}/disagreements`, undefined, m2Cookie);
    if (res.status !== 200) throw new Error(`Disagreements fetch failed: ${res.status}`);
    if (!Array.isArray(res.body) || res.body.length < 1) throw new Error('Expected >=1 disagreement');
    for (const d of res.body) {
      if (typeof d.topic !== 'string' || !d.topic) throw new Error('Disagreement missing topic');
      if (typeof d.positionA !== 'string' || typeof d.positionB !== 'string') throw new Error('Disagreement missing positions');
      if (!d.specialistAKey || !d.specialistBKey || d.specialistAKey === d.specialistBKey) throw new Error('Disagreement specialists invalid');
      if (!d.uncertaintyNote || !d.distinguishingEvidence) throw new Error('Disagreement missing uncertainty/distinguishing evidence');
    }
    assertNoM2Leak(res.body, 'disagreements list');
  });

  const specialistInvId = await createInvestigation(m2Cookie, caseId);

  await test('M2: specialist chat returns specialist fields, bounded content and meta persistence', async () => {
    const key = m2Specialists[0]?.specialistKey;
    if (!key) throw new Error('No specialist key available');
    const res = await request('POST', `/api/investigations/${specialistInvId}/chat`, {
      message: 'Can you explain what fingerprint comparison can establish?',
      specialistKey: key,
      intent: 'explain',
      depth: 'working',
    }, m2Cookie);
    if (res.status !== 200) throw new Error(`Specialist chat failed: ${res.status} ${JSON.stringify(res.body)}`);
    if (res.body?.specialistKey !== key) throw new Error(`Wrong specialistKey: ${res.body?.specialistKey}`);
    if (typeof res.body?.specialistName !== 'string' || !res.body.specialistName) throw new Error('Missing specialistName');
    if (res.body?.intent !== 'explain' || res.body?.depth !== 'working') throw new Error('Intent/depth not echoed');
    if (typeof res.body?.content !== 'string' || res.body.content.length === 0 || res.body.content.length > 2000) throw new Error('Content missing or unbounded');
    if (!res.body.content.startsWith(res.body.specialistName)) throw new Error('Specialist reply missing its voice/label');
    assertNoM2Leak(res.body.content, 'specialist chat content');

    const conv = await request('GET', `/api/investigations/${specialistInvId}/conversation`, undefined, m2Cookie);
    const history = conv.body?.messageHistory;
    if (!Array.isArray(history)) throw new Error('No conversation history');
    const player = history.filter((m: any) => m.role === 'player' && m.specialistKey === key);
    const investigator = history.filter((m: any) => m.role === 'investigator' && m.specialistKey === key);
    if (player.length === 0 || investigator.length === 0) throw new Error('Specialist meta not persisted on messages');
    if (player[player.length - 1]?.intent !== 'explain' || player[player.length - 1]?.depth !== 'working') {
      throw new Error('Persisted meta missing intent/depth');
    }
  });

  await test('M2: legacy chat without specialistKey keeps the old response shape', async () => {
    const res = await request('POST', `/api/investigations/${specialistInvId}/chat`, {
      message: 'Hello team, what should I examine first?',
    }, m2Cookie);
    if (res.status !== 200) throw new Error(`Legacy chat failed: ${res.status}`);
    for (const field of ['role', 'teamRole', 'responderLabel', 'content', 'timestamp']) {
      if (res.body?.[field] === undefined) throw new Error(`Legacy chat missing ${field}`);
    }
    if ('specialistKey' in res.body) throw new Error('Legacy chat unexpectedly has specialistKey');
    if (!res.body.content.startsWith(res.body.responderLabel)) throw new Error('Legacy reply missing responder voice');
  });

  await test('M2: critique intent with targetSpecialistKey is bounded and leak-free', async () => {
    const key = m2Specialists[0]?.specialistKey;
    const target = m2Specialists[1]?.specialistKey;
    if (!key || !target) throw new Error('Specialist keys unavailable');
    const res = await request('POST', `/api/investigations/${specialistInvId}/chat`, {
      message: 'Challenge that interpretation and give me alternatives.',
      specialistKey: key,
      intent: 'critique',
      depth: 'technical',
      targetSpecialistKey: target,
    }, m2Cookie);
    if (res.status !== 200) throw new Error(`Critique chat failed: ${res.status} ${JSON.stringify(res.body)}`);
    if (res.body?.intent !== 'critique' || res.body?.depth !== 'technical') throw new Error('Critique intent/depth not echoed');
    if (typeof res.body?.content !== 'string' || res.body.content.length > 2000) throw new Error('Critique content unbounded');
    assertNoM2Leak(res.body.content, 'critique chat content');
  });

  await test('M2: chats with >=3 distinct specialists persist distinct responder meta', async () => {
    const cookie = await registerAndLogin('m2-distinct');
    const invId = await createInvestigation(cookie, caseId);
    const messages = [
      'What does the CCTV footage and the sensor log show?',
      'Explain the diamond identification reference material.',
      'What can forensic accounting documents establish?',
      'What do fingerprint principles tell us?',
    ];
    for (let i = 0; i < Math.min(3, m2Specialists.length); i++) {
      const key = m2Specialists[i].specialistKey;
      const res = await request('POST', `/api/investigations/${invId}/chat`, {
        message: messages[i] ?? 'Please explain the relevant reference material.',
        specialistKey: key,
        intent: 'explain',
        depth: 'plain',
      }, cookie);
      if (res.status !== 200) throw new Error(`Specialist ${i} chat failed: ${res.status}`);
      assertNoM2Leak(res.body.content, `specialist ${i} chat content`);
    }
    const conv = await request('GET', `/api/investigations/${invId}/conversation`, undefined, cookie);
    const keys = new Set(
      (conv.body?.messageHistory || [])
        .filter((m: any) => m.role === 'investigator' && typeof m.specialistKey === 'string')
        .map((m: any) => m.specialistKey),
    );
    if (keys.size < 3) throw new Error(`Expected >=3 distinct specialist conversations, got ${keys.size}`);
  });

  await test('M2: invalid intent/depth/specialist inputs are rejected', async () => {
    const key = m2Specialists[0]?.specialistKey;
    const cookie = await registerAndLogin('m2-invalid-input');
    const invId = await createInvestigation(cookie, caseId);
    const badIntent = await request('POST', `/api/investigations/${invId}/chat`, { message: 'Hello there', intent: 'bogus' }, cookie);
    if (badIntent.status !== 400) throw new Error(`Bad intent not rejected: ${badIntent.status}`);
    const badDepth = await request('POST', `/api/investigations/${invId}/chat`, { message: 'Hello there', depth: 'bogus' }, cookie);
    if (badDepth.status !== 400) throw new Error(`Bad depth not rejected: ${badDepth.status}`);
    const badSpecialist = await request('POST', `/api/investigations/${invId}/chat`, { message: 'Hello there', specialistKey: `${key}-not-real` }, cookie);
    if (badSpecialist.status !== 400) throw new Error(`Unknown specialist not rejected: ${badSpecialist.status}`);
  });

  await test('M2: notebook CRUD persists entries with safe source snapshots', async () => {
    const cookie = await registerAndLogin('m2-notebook-crud');
    const invId = await createInvestigation(cookie, caseId);
    const artifact = m2Artifacts[0];
    const specialist = m2Specialists[0];
    if (!artifact || !specialist) throw new Error('Artifact/specialist fixtures missing');

    const created = await request('POST', `/api/investigations/${invId}/notebook`, {
      entryType: 'observation',
      concept: 'Trace handling',
      title: 'Trace note',
      content: 'A trace result must be qualified by how it was collected.',
      artifactId: artifact.id,
      specialistId: specialist.id,
    }, cookie);
    if (created.status !== 201) throw new Error(`Notebook create failed: ${created.status} ${JSON.stringify(created.body)}`);
    const entryId = created.body?.id;
    if (!entryId) throw new Error('Notebook entry has no id');
    if (created.body?.sourceSnapshot?.artifactKey !== artifact.artifactKey) throw new Error('sourceSnapshot not composed from safe artifact DTO');
    if ('content' in (created.body?.sourceSnapshot || {})) throw new Error('sourceSnapshot leaked raw artifact content field');
    assertNoM2Leak(created.body, 'notebook create response');

    const listed = await request('GET', `/api/investigations/${invId}/notebook`, undefined, cookie);
    if (listed.status !== 200 || !Array.isArray(listed.body)) throw new Error('Notebook list failed');
    if (!listed.body.some((e: any) => e.id === entryId)) throw new Error('Notebook entry not persisted');
    assertNoM2Leak(listed.body, 'notebook list');

    const patched = await request('PATCH', `/api/investigations/${invId}/notebook/${entryId}`, {
      content: 'Revised: the print may be secondary transfer.',
      title: 'Revised trace note',
    }, cookie);
    if (patched.status !== 200) throw new Error(`Notebook patch failed: ${patched.status}`);
    if (patched.body?.content !== 'Revised: the print may be secondary transfer.') throw new Error('Notebook patch did not persist content');
    assertNoM2Leak(patched.body, 'notebook patch response');

    const removed = await request('DELETE', `/api/investigations/${invId}/notebook/${entryId}`, undefined, cookie);
    if (removed.status !== 200) throw new Error(`Notebook delete failed: ${removed.status}`);
    const after = await request('GET', `/api/investigations/${invId}/notebook`, undefined, cookie);
    if (after.body.some((e: any) => e.id === entryId)) throw new Error('Deleted notebook entry still present');
  });

  await test('M2: notebook enforces ownership isolation and validates inputs', async () => {
    const cookie = await registerAndLogin('m2-notebook-owner');
    const invId = await createInvestigation(cookie, caseId);
    const created = await request('POST', `/api/investigations/${invId}/notebook`, {
      entryType: 'question', title: 'Owner note', content: 'Owner-only content',
    }, cookie);
    if (created.status !== 201) throw new Error('Setup notebook create failed');
    const entryId = created.body.id;

    const other = await registerAndLogin('m2-notebook-other');
    const foreignList = await request('GET', `/api/investigations/${invId}/notebook`, undefined, other);
    if (foreignList.status !== 403 && foreignList.status !== 404) throw new Error(`Foreign notebook list not rejected: ${foreignList.status}`);
    const foreignPatch = await request('PATCH', `/api/investigations/${invId}/notebook/${entryId}`, { content: 'hacked' }, other);
    if (foreignPatch.status !== 403 && foreignPatch.status !== 404) throw new Error(`Foreign notebook patch not rejected: ${foreignPatch.status}`);
    const foreignDelete = await request('DELETE', `/api/investigations/${invId}/notebook/${entryId}`, undefined, other);
    if (foreignDelete.status !== 403 && foreignDelete.status !== 404) throw new Error(`Foreign notebook delete not rejected: ${foreignDelete.status}`);

    const badType = await request('POST', `/api/investigations/${invId}/notebook`, { entryType: 'not-a-type' }, cookie);
    if (badType.status !== 400) throw new Error(`Invalid entryType not rejected: ${badType.status}`);
    if (m2Artifacts[0]) {
      const ownArtifact = await request('POST', `/api/investigations/${invId}/notebook`, {
        entryType: 'note', title: 'Case artifact note', artifactId: m2Artifacts[0].id,
      }, cookie);
      if (ownArtifact.status !== 201) throw new Error(`Own-case artifact notebook create failed: ${ownArtifact.status}`);
    }
  });

  // ---------------------------------------------------------------------------
  // M3 knowledge quality: pack metadata, provenance DTOs, notebook export.
  // ---------------------------------------------------------------------------
  console.log('\n=== M3 Knowledge Quality Tests ===\n');

  await test('M3: knowledge-pack endpoint returns safe metadata and counts', async () => {
    const res = await request('GET', `/api/cases/${caseId}/knowledge-pack`, undefined, m2Cookie);
    if (res.status !== 200) throw new Error(`Knowledge pack fetch failed: ${res.status} ${JSON.stringify(res.body)}`);
    const pack = res.body;
    if (!pack.id || pack.caseId !== caseId) throw new Error('Pack identity/case mismatch');
    if (typeof pack.version !== 'string' || !pack.version) throw new Error('Pack missing version');
    if (!['draft', 'pending_review', 'verified', 'needs_reverification'].includes(pack.packStatus)) {
      throw new Error(`Invalid pack status: ${pack.packStatus}`);
    }
    if (!Array.isArray(pack.learningObjectives) || pack.learningObjectives.length === 0) {
      throw new Error('Pack has no learning objectives');
    }
    if (!pack.counts || pack.counts.specialists < 3 || pack.counts.artifacts < 5 || pack.counts.disagreements < 1) {
      throw new Error(`Pack counts invalid: ${JSON.stringify(pack.counts)}`);
    }
    assertNoM2Leak(pack, 'knowledge pack');
  });

  await test('M3: artifact summaries expose provenance fields with a safe sourceUrl rule', async () => {
    const list = await request('GET', `/api/cases/${caseId}/artifacts`, undefined, m2Cookie);
    if (list.status !== 200 || !Array.isArray(list.body)) throw new Error('Artifact list failed');
    const statuses = ['draft', 'pending_review', 'verified', 'rejected', 'needs_reverification'];
    for (const a of list.body) {
      for (const field of [
        'sourceType', 'verificationStatus', 'verificationNotes', 'lastVerifiedAt',
        'claimsSupported', 'learningObjectives', 'relatedEvidenceRefs',
        'suggestedConversations', 'depthContent',
      ]) {
        if (!(field in a)) throw new Error(`Artifact ${a.artifactKey} missing ${field}`);
      }
      if (!statuses.includes(a.verificationStatus)) throw new Error(`Invalid verificationStatus: ${a.verificationStatus}`);
      if (!Array.isArray(a.claimsSupported) || !Array.isArray(a.learningObjectives)) {
        throw new Error('Artifact provenance arrays invalid');
      }
      // Tighter rule: a URL requires BOTH flags, never one alone.
      if (a.sourceUrl !== null && !(a.sourceVerified === true && a.verificationStatus === 'verified')) {
        throw new Error(`Artifact ${a.artifactKey} exposed sourceUrl without full verification`);
      }
    }
    assertNoM2Leak(list.body, 'M3 artifact summaries');
  });

  const exportInvId = specialistInvId;
  const exportEntry = await request('POST', `/api/investigations/${exportInvId}/notebook`, {
    entryType: 'fact',
    title: 'M3 export note',
    concept: 'Provenance',
    content: 'Export must carry the safe source provenance only.',
    artifactId: m2Artifacts[0]?.id,
  }, m2Cookie);
  if (exportEntry.status !== 201) throw new Error(`M3 export setup failed: ${exportEntry.status}`);

  await test('M3: notebook JSON export is owner-scoped, safe and complete', async () => {
    const res = await request('GET', `/api/investigations/${exportInvId}/notebook/export?format=json`, undefined, m2Cookie);
    if (res.status !== 200) throw new Error(`JSON export failed: ${res.status}`);
    if (!Array.isArray(res.body?.entries) || !res.body.entries.some((e: any) => e.id === exportEntry.body.id)) {
      throw new Error('JSON export missing the created entry');
    }
    if (!res.body.caseTitle || !res.body.exportedAt) throw new Error('JSON export missing metadata');
    assertNoM2Leak(res.body, 'JSON notebook export');
    const snapshot = res.body.entries.find((e: any) => e.id === exportEntry.body.id)?.sourceSnapshot ?? {};
    if ('content' in snapshot) throw new Error('JSON export snapshot leaked artifact content');

    const foreign = await registerAndLogin('m3-export-foreign');
    const denied = await request('GET', `/api/investigations/${exportInvId}/notebook/export?format=json`, undefined, foreign);
    if (denied.status !== 403 && denied.status !== 404) throw new Error(`Foreign export not rejected: ${denied.status}`);
  });

  await test('M3: notebook Markdown export renders text safely and rejects bad format', async () => {
    const res = await request('GET', `/api/investigations/${exportInvId}/notebook/export?format=markdown`, undefined, m2Cookie);
    if (res.status !== 200) throw new Error(`Markdown export failed: ${res.status}`);
    if (typeof res.body !== 'string' || !res.body.includes('# Investigation Notebook')) {
      throw new Error('Markdown export did not return a document');
    }
    if (!res.body.includes('M3 export note')) throw new Error('Markdown export missing entry title');
    assertNoM2Leak(res.body, 'Markdown notebook export');
    const bad = await request('GET', `/api/investigations/${exportInvId}/notebook/export?format=pdf`, undefined, m2Cookie);
    if (bad.status !== 400) throw new Error(`Invalid export format not rejected: ${bad.status}`);
  });

  await test('M3: Code Blue at the Clinic knowledge pack is seeded and safe', async () => {
    const codeBlueCaseId = '7d3bae18-779c-5b4f-adf1-6f7a5fb57443';
    const leakTerms = ['Dr. Paul Kent', 'Paul Kent', 'gambling debts', 'silenced Amy'];
    const uuids = (await query('SELECT id FROM evidence WHERE case_id = $1', [codeBlueCaseId])).rows.map((r: any) => String(r.id));
    const res = await request('GET', `/api/cases/${codeBlueCaseId}/knowledge-pack`, undefined, m2Cookie);
    if (res.status !== 200) throw new Error(`Code Blue pack fetch failed: ${res.status} ${JSON.stringify(res.body)}`);
    const pack = res.body;
    if (pack.caseId !== codeBlueCaseId) throw new Error('Code Blue pack case mismatch');
    if (!Array.isArray(pack.learningObjectives) || pack.learningObjectives.length < 3) throw new Error('Code Blue missing learning objectives');
    if (!pack.counts || pack.counts.specialists < 3 || pack.counts.artifacts < 5 || pack.counts.disagreements < 1) {
      throw new Error(`Code Blue pack counts invalid: ${JSON.stringify(pack.counts)}`);
    }
    const artifacts = await request('GET', `/api/cases/${codeBlueCaseId}/artifacts`, undefined, m2Cookie);
    if (artifacts.status !== 200 || !Array.isArray(artifacts.body) || artifacts.body.length < 5) throw new Error('Code Blue artifacts missing');
    assertNoLeak(pack, 'Code Blue pack', leakTerms, uuids);
    assertNoLeak(artifacts.body, 'Code Blue artifacts', leakTerms, uuids);
  });

  await test('M3: Blaze at Dawn Bakery knowledge pack is seeded and safe', async () => {
    const blazeCaseId = '8160e966-7749-5d8f-a984-261161fbfa65';
    const leakTerms = ['Victor Ames', 'embezzled from the bakery', 'audit the books'];
    const uuids = (await query('SELECT id FROM evidence WHERE case_id = $1', [blazeCaseId])).rows.map((r: any) => String(r.id));
    const res = await request('GET', `/api/cases/${blazeCaseId}/knowledge-pack`, undefined, m2Cookie);
    if (res.status !== 200) throw new Error(`Blaze pack fetch failed: ${res.status} ${JSON.stringify(res.body)}`);
    const pack = res.body;
    if (pack.caseId !== blazeCaseId) throw new Error('Blaze pack case mismatch');
    if (!Array.isArray(pack.learningObjectives) || pack.learningObjectives.length < 3) throw new Error('Blaze missing learning objectives');
    if (!pack.counts || pack.counts.specialists < 3 || pack.counts.artifacts < 5 || pack.counts.disagreements < 1) {
      throw new Error(`Blaze pack counts invalid: ${JSON.stringify(pack.counts)}`);
    }
    const artifacts = await request('GET', `/api/cases/${blazeCaseId}/artifacts`, undefined, m2Cookie);
    if (artifacts.status !== 200 || !Array.isArray(artifacts.body) || artifacts.body.length < 5) throw new Error('Blaze artifacts missing');
    assertNoLeak(pack, 'Blaze pack', leakTerms, uuids);
    assertNoLeak(artifacts.body, 'Blaze artifacts', leakTerms, uuids);
  });

  // ---------------------------------------------------------------------------
  // M4 Reality Map (player-owned reasoning notes). Safety properties under
  // test: hidden evidence unreachable, no canonical leakage, no verdict or
  // progression influence, AI advisory-only, ownership isolation.
  // ---------------------------------------------------------------------------
  console.log('\n=== M4 Reality Map Tests ===\n');

  const M4_REALITY_LIMITS = { claims: 60, hypotheses: 20, links: 300 };
  const m4Cookie = await registerAndLogin('m4-reality');
  const m4InvId = await createInvestigation(m4Cookie, caseId);
  const m4Base = `/api/investigations/${m4InvId}/reality-map`;
  const hiddenForCase = await query(
    'SELECT id FROM evidence WHERE case_id = $1 AND player_visible = false LIMIT 1', [caseId]
  );
  const hiddenForCaseId = hiddenForCase.rows[0]?.id as string | undefined;
  const m4Character = await query('SELECT id FROM characters WHERE case_id = $1 LIMIT 1', [caseId]);
  const m4CharacterId = m4Character.rows[0]?.id as string | undefined;
  const RANDOM_UUID = '11111111-1111-4111-8111-111111111111';
  // Character names (including suspects) are intentionally public via the
  // PROD-013 suspect board, and visible evidence UUIDs are already exposed in
  // the snapshot materials. This guard targets HIDDEN solution facts and the
  // hidden evidence id only.
  const M4_CANONICAL_TERMS = [
    'hollow base', 'silver trophy', 'Sterling Holdings', '20 million',
    'gambling debts', 'silenced Amy', 'embezzled from the bakery', 'audit the books',
  ];
  function assertNoM4Leak(value: unknown, label: string): void {
    assertNoLeak(value, label, M4_CANONICAL_TERMS, hiddenForCaseId ? [hiddenForCaseId] : []);
  }

  let claimSupports: any = null;
  let claimContradicts: any = null;
  let hypPrimary: any = null;
  let hypSecondary: any = null;
  let linkSupports: any = null;
  let linkContradicts: any = null;
  let linkIncluded: any = null;

  await test('M4: snapshot is safe-shaped, visible-only and case-scoped', async () => {
    const res = await request('GET', m4Base, undefined, m4Cookie);
    if (res.status !== 200) throw new Error(`Snapshot failed: ${res.status} ${JSON.stringify(res.body)}`);
    for (const key of ['caseId', 'investigationId', 'investigationStatus', 'claims', 'hypotheses', 'links', 'tensions', 'materials', 'reasoningPrompts', 'tutorialAvailable', 'tutorialPresent', 'limits']) {
      if (!(key in res.body)) throw new Error(`Snapshot missing ${key}`);
    }
    if (res.body.caseId !== caseId || res.body.investigationId !== m4InvId) throw new Error('Snapshot ids mismatch');
    if (!Array.isArray(res.body.claims) || !Array.isArray(res.body.hypotheses) || !Array.isArray(res.body.links) || !Array.isArray(res.body.tensions)) {
      throw new Error('Snapshot collections not arrays');
    }
    if (res.body.limits.claims.max !== M4_REALITY_LIMITS.claims
      || res.body.limits.hypotheses.max !== M4_REALITY_LIMITS.hypotheses
      || res.body.limits.links.max !== M4_REALITY_LIMITS.links) {
      throw new Error('Snapshot limits wrong');
    }
    assertNoM4Leak(res.body, 'M4 snapshot');
    if (hiddenForCaseId && JSON.stringify(res.body).includes(hiddenForCaseId)) {
      throw new Error('Snapshot leaked a hidden evidence UUID');
    }
    for (const ev of res.body.materials.evidence) {
      if (hiddenForCaseId && ev.id === hiddenForCaseId) throw new Error('Hidden evidence in snapshot materials');
    }
  });

  await test('M4: ownership guard rejects other users (403) on read and write', async () => {
    const other = await registerAndLogin('m4-other');
    const get = await request('GET', m4Base, undefined, other);
    if (get.status !== 403 && get.status !== 404) throw new Error(`Non-owner snapshot not rejected: ${get.status}`);
    const post = await request('POST', `${m4Base}/claims`, { title: 'Intrusion', claimCategory: 'factual_observation' }, other);
    if (post.status !== 403 && post.status !== 404) throw new Error(`Non-owner claim create not rejected: ${post.status}`);
    const unauth = await request('GET', m4Base);
    if (unauth.status !== 401 && unauth.status !== 403) throw new Error(`Unauthenticated snapshot not rejected: ${unauth.status}`);
  });

  await test('M4: claim create/patch/delete with allowlist and validation', async () => {
    const created = await request('POST', `${m4Base}/claims`, {
      title: 'The corridor light was on', description: 'Observed in the diagram.',
      claimCategory: 'factual_observation', confidence: 'moderate_confidence', notes: 'Initial note',
    }, m4Cookie);
    if (created.status !== 201 || !created.body?.id) throw new Error(`Claim create failed: ${created.status} ${JSON.stringify(created.body)}`);
    if (created.body.isTutorial !== false || created.body.confidence !== 'moderate_confidence') throw new Error('Claim DTO wrong');
    assertNoM4Leak(created.body, 'claim create');

    const badCategory = await request('POST', `${m4Base}/claims`, { title: 'Bad', claimCategory: 'probability' }, m4Cookie);
    if (badCategory.status !== 400) throw new Error(`Invalid category accepted: ${badCategory.status}`);
    const badConfidence = await request('POST', `${m4Base}/claims`, { title: 'Bad', claimCategory: 'assumption', confidence: '0.9' }, m4Cookie);
    if (badConfidence.status !== 400) throw new Error(`Numeric confidence accepted: ${badConfidence.status}`);

    const patched = await request('PATCH', `${m4Base}/claims/${created.body.id}`, {
      title: 'The corridor light was on (revised)', confidence: 'high_confidence', notes: 'Revised', bogus: 'ignored',
    }, m4Cookie);
    if (patched.status !== 200 || patched.body.title !== 'The corridor light was on (revised)' || patched.body.confidence !== 'high_confidence') {
      throw new Error(`Claim patch failed: ${patched.status} ${JSON.stringify(patched.body)}`);
    }
    if ('bogus' in patched.body) throw new Error('Claim patch leaked unknown field');
    const empty = await request('PATCH', `${m4Base}/claims/${created.body.id}`, {}, m4Cookie);
    if (empty.status !== 400) throw new Error(`Empty patch accepted: ${empty.status}`);
    const missing = await request('PATCH', `${m4Base}/claims/${RANDOM_UUID}`, { title: 'x' }, m4Cookie);
    if (missing.status !== 404) throw new Error(`Foreign claim patch not 404: ${missing.status}`);

    const deleted = await request('DELETE', `${m4Base}/claims/${created.body.id}`, undefined, m4Cookie);
    if (deleted.status !== 200 || deleted.body.deleted !== true) throw new Error(`Claim delete failed: ${deleted.status}`);
  });

  await test('M4: claim source ids must belong to this investigation and owner', async () => {
    const nb = await request('POST', `/api/investigations/${m4InvId}/notebook`, {
      entryType: 'observation', title: 'M4 source', content: 'A safe notebook source.',
    }, m4Cookie);
    if (nb.status !== 201 || !nb.body?.id) throw new Error(`Notebook source create failed: ${nb.status}`);
    const good = await request('POST', `${m4Base}/claims`, {
      title: 'Claim with a safe source', claimCategory: 'factual_observation', sourceNotebookEntryId: nb.body.id,
    }, m4Cookie);
    if (good.status !== 201 || good.body.sourceNotebookEntryId !== nb.body.id) throw new Error('Valid notebook source rejected');

    const other = await registerAndLogin('m4-source-other');
    const otherInv = await createInvestigation(other, caseId);
    const foreignNb = await request('POST', `/api/investigations/${otherInv}/notebook`, {
      entryType: 'observation', title: 'Foreign source', content: 'Not yours.',
    }, other);
    if (foreignNb.status !== 201 || !foreignNb.body?.id) throw new Error('Foreign notebook fixture failed');
    const foreignClaim = await request('POST', `${m4Base}/claims`, {
      title: 'Claim with foreign source', claimCategory: 'factual_observation', sourceNotebookEntryId: foreignNb.body.id,
    }, m4Cookie);
    if (foreignClaim.status !== 404) throw new Error(`Foreign notebook source accepted: ${foreignClaim.status}`);
    const bogusClaim = await request('POST', `${m4Base}/claims`, {
      title: 'Claim with bogus source', claimCategory: 'factual_observation', sourceJournalEntryId: RANDOM_UUID,
    }, m4Cookie);
    if (bogusClaim.status !== 404) throw new Error(`Bogus journal source accepted: ${bogusClaim.status}`);
  });

  await test('M4: hypotheses create, status transitions, multiple active and comparison', async () => {
    const a = await request('POST', `${m4Base}/hypotheses`, {
      name: 'Theory A', explanation: 'Working explanation A.', missingInformation: 'Need a timestamp.',
    }, m4Cookie);
    const b = await request('POST', `${m4Base}/hypotheses`, {
      name: 'Theory B', explanation: 'Working explanation B.', alternativeExplanations: 'A mundane cause is possible.',
    }, m4Cookie);
    const c = await request('POST', `${m4Base}/hypotheses`, { name: 'Theory C' }, m4Cookie);
    if (a.status !== 201 || b.status !== 201 || c.status !== 201) throw new Error('Hypothesis create failed');
    hypPrimary = a.body; hypSecondary = b.body;

    const transition = await request('PATCH', `${m4Base}/hypotheses/${b.body.id}`, { status: 'weakened', confidence: 'low_confidence' }, m4Cookie);
    if (transition.status !== 200 || transition.body.status !== 'weakened' || transition.body.confidence !== 'low_confidence') {
      throw new Error('Hypothesis status transition failed');
    }
    const snap = await request('GET', m4Base, undefined, m4Cookie);
    const activeCount = snap.body.hypotheses.filter((h: any) => h.status === 'active').length;
    if (activeCount < 2) throw new Error('Multiple active hypotheses not preserved');
    // Transitioning one hypothesis never auto-resolves or completes a case.
    const inv = await request('GET', `/api/investigations/${m4InvId}`, undefined, m4Cookie);
    if (inv.body.status !== 'active') throw new Error('Hypothesis status changed investigation status');

    const compare = await request('GET', `${m4Base}/compare?hypothesisIds=${a.body.id},${b.body.id}`, undefined, m4Cookie);
    if (compare.status !== 200 || !Array.isArray(compare.body.hypotheses) || compare.body.hypotheses.length !== 2) {
      throw new Error(`Compare failed: ${compare.status} ${JSON.stringify(compare.body)}`);
    }
    if (!Array.isArray(compare.body.questions) || !compare.body.disclaimer) throw new Error('Compare missing questions/disclaimer');
    assertNoM4Leak(compare.body, 'hypothesis comparison');
    const tooFew = await request('GET', `${m4Base}/compare?hypothesisIds=${a.body.id}`, undefined, m4Cookie);
    if (tooFew.status !== 400) throw new Error(`Compare with 1 id accepted: ${tooFew.status}`);
    const tooMany = await request('GET', `${m4Base}/compare?hypothesisIds=${a.body.id},${b.body.id},${c.body.id},${RANDOM_UUID},22222222-2222-4222-8222-222222222222`, undefined, m4Cookie);
    if (tooMany.status !== 400) throw new Error(`Compare with 5 ids accepted: ${tooMany.status}`);
    const foreign = await request('GET', `${m4Base}/compare?hypothesisIds=${a.body.id},${RANDOM_UUID}`, undefined, m4Cookie);
    if (foreign.status !== 404) throw new Error(`Foreign compare id not 404: ${foreign.status}`);
    if (!visibleEvidenceId) throw new Error('Visible evidence fixture missing');
    const badStatus = await request('PATCH', `${m4Base}/hypotheses/${a.body.id}`, { status: 'solved' }, m4Cookie);
    if (badStatus.status !== 400) throw new Error(`Invalid status accepted: ${badStatus.status}`);
  });

  await test('M4: links support all relationships, both shapes and resolved labels', async () => {
    if (!visibleEvidenceId) throw new Error('Visible evidence fixture missing');
    const relationships = ['supports', 'contradicts', 'contextualizes', 'weakens', 'unrelated_inconclusive'];
    const claims: any[] = [];
    for (const rel of relationships) {
      const c = await request('POST', `${m4Base}/claims`, {
        title: `Claim for ${rel}`, claimCategory: 'interpretation',
      }, m4Cookie);
      if (c.status !== 201) throw new Error(`Fixture claim failed for ${rel}: ${c.status}`);
      claims.push(c.body);
      const link = await request('POST', `${m4Base}/links`, {
        ownerType: 'claim', ownerId: c.body.id, targetType: 'evidence', targetId: visibleEvidenceId,
        relationship: rel, rationale: `My ${rel} reading.`,
      }, m4Cookie);
      if (link.status !== 201) throw new Error(`Link ${rel} failed: ${link.status} ${JSON.stringify(link.body)}`);
      if (!link.body.ownerLabel || !link.body.targetLabel) throw new Error(`Link ${rel} missing resolved labels`);
      if (rel === 'supports') linkSupports = link.body;
      if (rel === 'contradicts') linkContradicts = link.body;
    }
    claimSupports = claims[0];
    claimContradicts = claims[1];

    if (!hypPrimary) throw new Error('Hypothesis fixture missing');
    const membership = await request('POST', `${m4Base}/links`, {
      ownerType: 'hypothesis', ownerId: hypPrimary.id, targetType: 'claim',
      targetId: claimSupports.id, relationship: 'included',
    }, m4Cookie);
    if (membership.status !== 201) throw new Error(`Included link failed: ${membership.status} ${JSON.stringify(membership.body)}`);
    linkIncluded = membership.body;

    const materialLink = await request('POST', `${m4Base}/links`, {
      ownerType: 'hypothesis', ownerId: hypPrimary.id, targetType: 'character',
      targetId: m4CharacterId ?? RANDOM_UUID, relationship: 'contextualizes',
    }, m4Cookie);
    if (m4CharacterId && materialLink.status !== 201) throw new Error(`Character link failed: ${materialLink.status}`);
    assertNoM4Leak(membership.body, 'included link');
  });

  await test('M4: hidden evidence and other-case material cannot be linked (404)', async () => {
    if (!claimSupports) throw new Error('Claim fixture missing');
    if (hiddenForCaseId) {
      const hidden = await request('POST', `${m4Base}/links`, {
        ownerType: 'claim', ownerId: claimSupports.id, targetType: 'evidence',
        targetId: hiddenForCaseId, relationship: 'supports',
      }, m4Cookie);
      if (hidden.status !== 404) throw new Error(`Hidden evidence link accepted: ${hidden.status}`);
    }
    const bogus = await request('POST', `${m4Base}/links`, {
      ownerType: 'claim', ownerId: claimSupports.id, targetType: 'artifact',
      targetId: RANDOM_UUID, relationship: 'supports',
    }, m4Cookie);
    if (bogus.status !== 404) throw new Error(`Bogus artifact link accepted: ${bogus.status}`);
    const snap = await request('GET', m4Base, undefined, m4Cookie);
    assertNoM4Leak(snap.body, 'snapshot after hidden link attempts');
    if (hiddenForCaseId && JSON.stringify(snap.body).includes(hiddenForCaseId)) throw new Error('Hidden UUID leaked after link attempts');
  });

  await test('M4: illegal link shapes are rejected with 400', async () => {
    if (!claimSupports || !hypPrimary) throw new Error('Fixtures missing');
    const cases = [
      { ownerType: 'claim', ownerId: claimSupports.id, targetType: 'claim', targetId: claimSupports.id, relationship: 'included' },
      { ownerType: 'claim', ownerId: claimSupports.id, targetType: 'evidence', targetId: visibleEvidenceId, relationship: 'included' },
      { ownerType: 'hypothesis', ownerId: hypPrimary.id, targetType: 'claim', targetId: claimSupports.id, relationship: 'supports' },
      { ownerType: 'hypothesis', ownerId: hypPrimary.id, targetType: 'hypothesis', targetId: hypPrimary.id, relationship: 'supports' },
    ];
    for (const body of cases) {
      const res = await request('POST', `${m4Base}/links`, body, m4Cookie);
      if (res.status !== 400) throw new Error(`Illegal shape accepted (${body.targetType}/${body.relationship}): ${res.status}`);
    }
  });

  await test('M4: duplicate relationship returns 409 with existing linkId', async () => {
    if (!claimContradicts || !visibleEvidenceId) throw new Error('Fixtures missing');
    const dupe = await request('POST', `${m4Base}/links`, {
      ownerType: 'claim', ownerId: claimContradicts.id, targetType: 'evidence',
      targetId: visibleEvidenceId, relationship: 'weakens',
    }, m4Cookie);
    if (dupe.status !== 409 || dupe.body.error !== 'Relationship already exists' || !dupe.body.linkId) {
      throw new Error(`Duplicate handling wrong: ${dupe.status} ${JSON.stringify(dupe.body)}`);
    }
    // PATCH cannot convert a material link into an illegal 'included' link.
    const illegalPatch = await request('PATCH', `${m4Base}/links/${linkContradicts.id}`, { relationship: 'included' }, m4Cookie);
    if (illegalPatch.status !== 400) throw new Error(`Illegal link patch accepted: ${illegalPatch.status}`);
    const goodPatch = await request('PATCH', `${m4Base}/links/${linkContradicts.id}`, { rationale: 'Revised reasoning.' }, m4Cookie);
    if (goodPatch.status !== 200 || goodPatch.body.rationale !== 'Revised reasoning.') throw new Error('Link patch failed');
    const removed = await request('DELETE', `${m4Base}/links/${linkContradicts.id}`, undefined, m4Cookie);
    if (removed.status !== 200 || removed.body.deleted !== true) throw new Error('Link delete failed');
  });

  await test('M4: tensions are surfaced and never auto-resolved', async () => {
    const snap = await request('GET', m4Base, undefined, m4Cookie);
    if (snap.status !== 200 || !Array.isArray(snap.body.tensions)) throw new Error('Tensions missing');
    // claimSupports and the duplicate claim both reference the same visible
    // evidence with opposing relationships, so a conflict must be surfaced.
    if (snap.body.tensions.length === 0) throw new Error('Expected at least one derived tension');
    for (const t of snap.body.tensions) {
      if (!['material_conflict', 'claim_conflict', 'hypothesis_conflict'].includes(t.kind)) throw new Error(`Unknown tension kind ${t.kind}`);
      if ('resolved' in t || 'correct' in t) throw new Error('Tension incorrectly auto-resolved');
    }
    assertNoM4Leak(snap.body.tensions, 'tensions');
    // No status/progress mutation from merely viewing derived tensions.
    const inv = await request('GET', `/api/investigations/${m4InvId}`, undefined, m4Cookie);
    if (inv.body.status !== 'active') throw new Error('Tension view mutated investigation');
  });

  await test('M4: reasoning-review has 6 provenance-tagged sections and a deterministic summary', async () => {
    const res = await request('POST', `${m4Base}/reasoning-review`, {}, m4Cookie);
    if (res.status !== 200) throw new Error(`Reasoning review failed: ${res.status} ${JSON.stringify(res.body)}`);
    const expectedKeys = ['unsupported_assumptions', 'conclusions_beyond_evidence', 'overlooked_contradictions', 'missing_information', 'alternative_explanations', 'suggested_questions'];
    if (!Array.isArray(res.body.sections) || res.body.sections.length !== 6) throw new Error('Expected 6 audit sections');
    for (const key of expectedKeys) {
      const section = res.body.sections.find((s: any) => s.key === key);
      if (!section || !Array.isArray(section.items)) throw new Error(`Missing audit section ${key}`);
      for (const item of section.items) {
        if (!['established_fact', 'player_interpretation', 'specialist_opinion', 'unverified_assumption', 'ai_suggestion'].includes(item.provenance)) {
          throw new Error(`Bad provenance: ${item.provenance}`);
        }
      }
    }
    if (!res.body.provenanceLegend || typeof res.body.disclaimer !== 'string' || !res.body.disclaimer) throw new Error('Missing provenance legend/disclaimer');
    if (typeof res.body.aiSummary !== 'string' || !res.body.aiSummary.includes('your notes')) throw new Error('Deterministic summary missing');
    assertNoM4Leak(res.body, 'reasoning review');
    if (/\d+(\.\d+)?%|probability|confidenceScore/i.test(JSON.stringify(res.body))) throw new Error('Numeric probability leaked into review');
    // Deterministic: identical calls produce identical summaries.
    const again = await request('POST', `${m4Base}/reasoning-review`, {}, m4Cookie);
    if (again.body.aiSummary !== res.body.aiSummary) throw new Error('aiSummary is not deterministic');
  });

  await test('M4: specialist-review is advisory (no writes) and grounded', async () => {
    if (!hypPrimary || m2Specialists.length === 0) throw new Error('Fixtures missing');
    const before = await request('GET', m4Base, undefined, m4Cookie);
    const convBefore = await request('GET', `/api/investigations/${m4InvId}/conversation`, undefined, m4Cookie);
    const key = m2Specialists[0].specialistKey;
    const res = await request('POST', `${m4Base}/hypotheses/${hypPrimary.id}/specialist-review`, {
      specialistKey: key, focus: 'falsify',
    }, m4Cookie);
    if (res.status !== 200) throw new Error(`Specialist review failed: ${res.status} ${JSON.stringify(res.body)}`);
    if (res.body.specialistKey !== key || res.body.focus !== 'falsify') throw new Error('Review meta mismatch');
    if (typeof res.body.content !== 'string' || !res.body.content.includes(m2Specialists[0].name)) throw new Error('Review missing specialist voice');
    if (res.body.provenance !== 'specialist_opinion' || typeof res.body.disclaimer !== 'string') throw new Error('Review missing provenance/disclaimer');
    assertNoM4Leak(res.body, 'specialist review');
    const after = await request('GET', m4Base, undefined, m4Cookie);
    const convAfter = await request('GET', `/api/investigations/${m4InvId}/conversation`, undefined, m4Cookie);
    if (JSON.stringify(before.body.claims) !== JSON.stringify(after.body.claims)
      || JSON.stringify(before.body.hypotheses) !== JSON.stringify(after.body.hypotheses)
      || JSON.stringify(before.body.links) !== JSON.stringify(after.body.links)) {
      throw new Error('Specialist review mutated reality map state');
    }
    if (JSON.stringify(convBefore.body) !== JSON.stringify(convAfter.body)) throw new Error('Specialist review persisted chat messages');
    const badFocus = await request('POST', `${m4Base}/hypotheses/${hypPrimary.id}/specialist-review`, { specialistKey: key, focus: 'solve' }, m4Cookie);
    if (badFocus.status !== 400) throw new Error(`Invalid focus accepted: ${badFocus.status}`);
    const critiqueNoTarget = await request('POST', `${m4Base}/hypotheses/${hypPrimary.id}/specialist-review`, { specialistKey: key, focus: 'critique' }, m4Cookie);
    if (critiqueNoTarget.status !== 400) throw new Error('Critique without target accepted');
  });

  await test('M4: tutorial requires confirm, is idempotent and removable', async () => {
    const noConfirm = await request('POST', `${m4Base}/tutorial-examples`, {}, m4Cookie);
    if (noConfirm.status !== 400) throw new Error(`Tutorial without confirm accepted: ${noConfirm.status}`);
    const created = await request('POST', `${m4Base}/tutorial-examples`, { confirm: true }, m4Cookie);
    if (created.status !== 201 || !Array.isArray(created.body.claims) || created.body.links.length !== 0) throw new Error(`Tutorial create failed: ${created.status}`);
    if (!created.body.claims.every((c: any) => c.isTutorial) || !created.body.hypotheses.every((h: any) => h.isTutorial)) {
      throw new Error('Tutorial rows not labelled');
    }
    const again = await request('POST', `${m4Base}/tutorial-examples`, { confirm: true }, m4Cookie);
    if (again.status !== 409) throw new Error(`Duplicate tutorial accepted: ${again.status}`);
    const snap = await request('GET', m4Base, undefined, m4Cookie);
    if (snap.body.tutorialPresent !== true || snap.body.tutorialAvailable !== true) throw new Error('Snapshot tutorial flags wrong');
    const removed = await request('DELETE', `${m4Base}/tutorial-examples`, undefined, m4Cookie);
    if (removed.status !== 200 || removed.body.removedClaims < 1 || removed.body.removedHypotheses < 1) throw new Error('Tutorial delete failed');
    const after = await request('GET', m4Base, undefined, m4Cookie);
    if (after.body.tutorialPresent !== false) throw new Error('Tutorial still present after delete');
    if (!after.body.claims.some((c: any) => c.id === claimSupports.id)) throw new Error('Tutorial delete removed player-owned claim');
    assertNoM4Leak(after.body, 'post-tutorial snapshot');
  });

  await test('M4: case-specific prompts differ for Code Blue and Blaze', async () => {
    const codeBlueId = '7d3bae18-779c-5b4f-adf1-6f7a5fb57443';
    const blazeId = '8160e966-7749-5d8f-a984-261161fbfa65';
    const cbCookie = await registerAndLogin('m4-codeblue');
    const blCookie = await registerAndLogin('m4-blaze');
    const cbInv = await createInvestigation(cbCookie, codeBlueId);
    const blInv = await createInvestigation(blCookie, blazeId);
    const cb = await request('GET', `/api/investigations/${cbInv}/reality-map`, undefined, cbCookie);
    const bl = await request('GET', `/api/investigations/${blInv}/reality-map`, undefined, blCookie);
    if (cb.status !== 200 || bl.status !== 200) throw new Error('Case-specific snapshot failed');
    if (!Array.isArray(cb.body.reasoningPrompts) || cb.body.reasoningPrompts.length < 3) throw new Error('Code Blue prompts missing');
    if (!Array.isArray(bl.body.reasoningPrompts) || bl.body.reasoningPrompts.length < 3) throw new Error('Blaze prompts missing');
    if (JSON.stringify(cb.body.reasoningPrompts) === JSON.stringify(bl.body.reasoningPrompts)) throw new Error('Prompt packs are not case-specific');
    for (const p of [...cb.body.reasoningPrompts, ...bl.body.reasoningPrompts]) {
      if (!p.text.endsWith('?') || !p.claimCategoryHint) throw new Error('Invalid case prompt');
    }
    assertNoM4Leak(cb.body, 'Code Blue reality map');
    assertNoM4Leak(bl.body, 'Blaze reality map');
    // Non-showcase cases have no prompts / tutorial (fresh user: one active
    // investigation per user). `caseId` itself is a showcase case, so pick a
    // genuinely different, non-showcase title.
    const showcaseTitles = ['The Midnight Heist', 'Code Blue at the Clinic', 'Blaze at Dawn Bakery'];
    const nonShowcase = allCases.find((c: any) => c.id && !showcaseTitles.includes(c.title));
    if (!nonShowcase) throw new Error('No non-showcase case available');
    const nsCookie = await registerAndLogin('m4-nonshowcase');
    const otherInv = await createInvestigation(nsCookie, nonShowcase.id);
    const otherSnap = await request('GET', `/api/investigations/${otherInv}/reality-map`, undefined, nsCookie);
    if (otherSnap.body.reasoningPrompts.length !== 0 || otherSnap.body.tutorialAvailable !== false) {
      throw new Error('Non-showcase case unexpectedly has prompts/tutorial');
    }
  });

  await test('M4: writing reality-map data cannot release evidence or advance progression', async () => {
    const beforeInv = await request('GET', `/api/investigations/${m4InvId}`, undefined, m4Cookie);
    const beforeSnap = await request('GET', m4Base, undefined, m4Cookie);
    const write = await request('POST', `${m4Base}/claims`, {
      title: 'Isolation check claim', claimCategory: 'unresolved_question', confidence: 'insufficient_information',
    }, m4Cookie);
    if (write.status !== 201) throw new Error(`Isolation claim failed: ${write.status}`);
    const afterInv = await request('GET', `/api/investigations/${m4InvId}`, undefined, m4Cookie);
    const afterSnap = await request('GET', m4Base, undefined, m4Cookie);
    if (JSON.stringify(beforeInv.body.discoveredEvidenceIds) !== JSON.stringify(afterInv.body.discoveredEvidenceIds)) {
      throw new Error('Reality Map write released evidence');
    }
    if (beforeInv.body.status !== afterInv.body.status || beforeInv.body.progress !== afterInv.body.progress) {
      throw new Error('Reality Map write advanced progression');
    }
    if (afterSnap.body.claims.length !== beforeSnap.body.claims.length + 1) throw new Error('Claim not persisted');
  });

  // ---------------------------------------------------------------------------
  // M5 Perspective Engine (advisory lenses, reflections, suggestion state).
  // Safety properties: no canonical/hidden leakage, no verdict/progression/
  // evidence coupling, reflections/state player-scoped, suggestions read-only.
  // ---------------------------------------------------------------------------
  console.log('\n=== M5 Perspective Engine Tests ===\n');

  const m5Cookie = await registerAndLogin('m5-perspectives');
  const m5OtherCookie = await registerAndLogin('m5-other');
  const m5FreshCookie = await registerAndLogin('m5-fresh');
  const m5InvId = await createInvestigation(m5Cookie, caseId);
  const m5OtherInvId = await createInvestigation(m5OtherCookie, caseId);
  const m5FreshInvId = await createInvestigation(m5FreshCookie, caseId);
  const m5Base = `/api/investigations/${m5InvId}/reality-map`;
  const smokeExperienceKey = 'smoke-perspective-lens';
  const hiddenUuids = hiddenEvidenceId ? [String(hiddenEvidenceId)] : [];

  // Deterministic published fixture with an UNVERIFIED source URL so the DTO's
  // verified-only URL rule can be asserted directly. Recreate it each run so a
  // prior run's version cannot make filter assertions stale.
  await query('DELETE FROM perspective_experiences WHERE experience_key = $1', [smokeExperienceKey]);
  await query(
    `INSERT INTO perspective_experiences
       (experience_key, framework_key, format, knowledge_class, title, perspective_class,
        intellectual_purpose, primary_question, main_idea, scope_note, display_order, status,
        supporting_sources, recommendation_tags, related_case_titles, key_concepts)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb)
     ON CONFLICT (experience_key) DO NOTHING`,
    [
      smokeExperienceKey, 'scientific_reasoning', 'thought_experiment', 'philosophical',
      'Smoke Test: A Lens on Observation', 'framework_primer',
      'To separate observation from inference in a disciplined way.',
      'What is actually established here, and what am I taking on trust?',
      'A short teaching example about distinguishing what is seen from what is inferred.',
      'A deterministic smoke-test fixture; not authored case content.',
      99, 'published',
      JSON.stringify([{
        label: 'Smoke bibliographic reference (unverified)',
        author: 'Smoke Test', title: 'An Unverified Reference',
        url: 'https://example.invalid/secret-source', source_type: 'other',
        verification_status: 'pending_review', source_verified: false,
        notes: 'URL must not be exposed by the API.', quote: 'A short smoke quote.',
      }]),
      JSON.stringify(['open_question', 'skeptical_inquiry', 'mystery', 'observation']),
      JSON.stringify(['The Midnight Heist']),
      JSON.stringify(['observation', 'inference', 'burden of proof']),
    ]
  );
  const fixtureRow = await query('SELECT id FROM perspective_experiences WHERE experience_key = $1', [smokeExperienceKey]);
  const smokeExperienceId = fixtureRow.rows[0]?.id as string | undefined;
  if (!smokeExperienceId) throw new Error('Perspective smoke fixture missing');

  let m5Reflection: any = null;

  await test('M5: frameworks returns 7 published lenses with epistemic fields', async () => {
    const res = await request('GET', '/api/perspectives/frameworks', undefined, m5Cookie);
    if (res.status !== 200) throw new Error(`Frameworks failed: ${res.status} ${JSON.stringify(res.body)}`);
    if (res.body.count !== 7 || !Array.isArray(res.body.frameworks) || res.body.frameworks.length !== 7) {
      throw new Error(`Expected 7 frameworks, got ${res.body.count}/${res.body.frameworks?.length}`);
    }
    for (const f of res.body.frameworks) {
      if (!Array.isArray(f.coreQuestions) || !Array.isArray(f.limitations)
        || !Array.isArray(f.commonMisconceptions) || !Array.isArray(f.internalDifferences)
        || typeof f.methodOfReasoning !== 'string') {
        throw new Error(`Framework ${f.frameworkKey} missing epistemic fields`);
      }
    }
    if (res.body.advisory !== true || res.body.affectsVerdict !== false || typeof res.body.disclaimer !== 'string') {
      throw new Error('Frameworks missing advisory flags/disclaimer');
    }
    assertNoLeak(res.body, 'M5 frameworks', M4_CANONICAL_TERMS, hiddenUuids);
  });

  await test('M5: perspective routes require authentication', async () => {
    for (const path of ['/api/perspectives', '/api/perspectives/frameworks', '/api/perspectives/discover', '/api/perspectives/reflections']) {
      const res = await request('GET', path);
      if (res.status !== 401 && res.status !== 403) throw new Error(`${path} was not auth-guarded: ${res.status}`);
    }
  });

  await test('M5: discovery and list are curated, safe and filtered', async () => {
    const discover = await request('GET', '/api/perspectives/discover', undefined, m5Cookie);
    if (discover.status !== 200) throw new Error(`Discover failed: ${discover.status}`);
    if (!Array.isArray(discover.body.openingQuestions) || !Array.isArray(discover.body.featured)
      || !Array.isArray(discover.body.connections) || discover.body.frameworkCount !== 7) {
      throw new Error('Discovery payload missing curated sections');
    }
    const list = await request('GET', '/api/perspectives', undefined, m5Cookie);
    if (list.status !== 200 || !Array.isArray(list.body.experiences)) throw new Error('List failed');
    const filtered = await request('GET', '/api/perspectives?framework=scientific_reasoning&q=observation', undefined, m5Cookie);
    if (filtered.status !== 200 || !filtered.body.experiences.some((e: any) => e.experienceKey === smokeExperienceKey)) {
      throw new Error('Framework/text filter did not return the fixture experience');
    }
    const badFormat = await request('GET', '/api/perspectives?format=not_a_format', undefined, m5Cookie);
    if (badFormat.status !== 400) throw new Error(`Invalid format accepted: ${badFormat.status}`);
    assertNoLeak(discover.body, 'M5 discovery', M4_CANONICAL_TERMS, hiddenUuids);
    assertNoLeak(list.body, 'M5 list', M4_CANONICAL_TERMS, hiddenUuids);
  });

  await test('M5: detail has disclaimer and nulls unverified source URLs', async () => {
    const res = await request('GET', `/api/perspectives/${smokeExperienceKey}`, undefined, m5Cookie);
    if (res.status !== 200) throw new Error(`Detail failed: ${res.status} ${JSON.stringify(res.body)}`);
    if (typeof res.body.disclaimer !== 'string' || !res.body.disclaimer.includes('not evidence')) {
      throw new Error('Detail disclaimer missing');
    }
    if (res.body.advisory !== true || res.body.isEvidence !== false || res.body.affectsVerdict !== false
      || res.body.revealsCanonicalTruth !== false) {
      throw new Error('Detail advisory flags wrong');
    }
    if (!Array.isArray(res.body.supportingSources) || res.body.supportingSources.length < 1) {
      throw new Error('Detail supporting sources missing');
    }
    for (const source of res.body.supportingSources) {
      if (source.sourceUrl !== null) throw new Error(`Unverified source URL leaked: ${source.sourceUrl}`);
      if (source.verificationStatus === 'verified' && source.sourceVerified !== true) {
        throw new Error('Verified status without sourceVerified flag');
      }
    }
    const missing = await request('GET', '/api/perspectives/does-not-exist', undefined, m5Cookie);
    if (missing.status !== 404) throw new Error(`Unknown experience accepted: ${missing.status}`);
    assertNoLeak(res.body, 'M5 detail', M4_CANONICAL_TERMS, hiddenUuids);
  });

  await test('M5: connections returns related experiences and case bridges', async () => {
    const res = await request('GET', `/api/perspectives/${smokeExperienceKey}/connections`, undefined, m5Cookie);
    if (res.status !== 200) throw new Error(`Connections failed: ${res.status}`);
    if (!Array.isArray(res.body.relatedExperiences) || !Array.isArray(res.body.sharedConcepts)
      || !Array.isArray(res.body.bridges)) {
      throw new Error('Connections payload malformed');
    }
    if (res.body.bridges.length === 0) throw new Error('Expected a case bridge for the fixture');
    assertNoLeak(res.body, 'M5 connections', M4_CANONICAL_TERMS, hiddenUuids);
  });

  await test('M5: reflection CRUD is owner-only', async () => {
    const created = await request('POST', `/api/perspectives/${smokeExperienceKey}/reflections`, {
      response: 'I should separate what I saw from what I inferred.',
      reflectionKind: 'reflection',
      investigationId: m5InvId,
      promptIndex: 0,
      prompt: 'What is established here?',
    }, m5Cookie);
    const createdReflection = created.body?.reflection ?? created.body;
    if (created.status !== 201 || !createdReflection?.id) throw new Error(`Reflection create failed: ${created.status} ${JSON.stringify(created.body)}`);
    m5Reflection = createdReflection;
    if (m5Reflection.experienceKey !== smokeExperienceKey || m5Reflection.investigationId !== m5InvId) {
      throw new Error('Reflection provenance mismatch');
    }

    const listed = await request('GET', `/api/perspectives/reflections?experienceKey=${smokeExperienceKey}&investigationId=${m5InvId}`, undefined, m5Cookie);
    const listedRows = Array.isArray(listed.body?.reflections) ? listed.body.reflections : Array.isArray(listed.body) ? listed.body : [];
    if (listed.status !== 200 || !listedRows.some((r: any) => r.id === m5Reflection.id)) throw new Error('Reflection list missing created row');

    const temp = await request('POST', `/api/perspectives/${smokeExperienceKey}/reflections`, {
      response: 'Temporary reflection for ownership checks.',
    }, m5Cookie);
    const tempReflection = temp.body?.reflection ?? temp.body;
    if (temp.status !== 201 || !tempReflection?.id) throw new Error('Temp reflection create failed');

    const ownerPatch = await request('PATCH', `/api/perspectives/reflections/${tempReflection.id}`, {
      response: 'Updated by owner.', reflectionKind: 'assumption',
    }, m5Cookie);
    const patched = ownerPatch.body?.reflection ?? ownerPatch.body;
    if (ownerPatch.status !== 200 || patched?.response !== 'Updated by owner.' || patched?.reflectionKind !== 'assumption') {
      throw new Error('Owner patch failed');
    }
    const otherPatch = await request('PATCH', `/api/perspectives/reflections/${tempReflection.id}`, { response: 'Intrusion' }, m5OtherCookie);
    if (otherPatch.status !== 404) throw new Error(`Non-owner patch not rejected: ${otherPatch.status}`);
    const otherDelete = await request('DELETE', `/api/perspectives/reflections/${tempReflection.id}`, undefined, m5OtherCookie);
    if (otherDelete.status !== 404) throw new Error(`Non-owner delete not rejected: ${otherDelete.status}`);
    const ownerDelete = await request('DELETE', `/api/perspectives/reflections/${tempReflection.id}`, undefined, m5Cookie);
    if (ownerDelete.status !== 200) throw new Error('Owner delete failed');
  });

  await test('M5: reflection input and investigation ownership are validated', async () => {
    const blank = await request('POST', `/api/perspectives/${smokeExperienceKey}/reflections`, { response: '   ' }, m5Cookie);
    if (blank.status !== 400) throw new Error(`Blank response accepted: ${blank.status}`);
    const badKind = await request('POST', `/api/perspectives/${smokeExperienceKey}/reflections`, {
      response: 'Valid text', reflectionKind: 'not_a_kind',
    }, m5Cookie);
    if (badKind.status !== 400) throw new Error(`Invalid kind accepted: ${badKind.status}`);
    const foreign = await request('POST', `/api/perspectives/${smokeExperienceKey}/reflections`, {
      response: 'Valid text', investigationId: m5OtherInvId,
    }, m5Cookie);
    if (foreign.status !== 404) throw new Error(`Foreign investigation accepted: ${foreign.status}`);
  });

  await test('M5: suggestions are empty for a fresh investigation', async () => {
    // Use a dedicated untouched investigation - the main fixture already has
    // a reflection and journal/chat activity by the time this test runs.
    const res = await request('GET', `/api/investigations/${m5FreshInvId}/perspectives/suggestions`, undefined, m5FreshCookie);
    if (res.status !== 200) throw new Error(`Suggestions failed: ${res.status}`);
    if (res.body.engagement !== 'none' || !Array.isArray(res.body.suggestions) || res.body.suggestions.length !== 0) {
      throw new Error('Fresh investigation should have no suggestions');
    }
    const unauth = await request('GET', `/api/investigations/${m5FreshInvId}/perspectives/suggestions`);
    if (unauth.status !== 401) throw new Error('Suggestions not auth-guarded');
  });

  let m5Suggestions: any[] = [];
  await test('M5: suggestions are advisory, bounded and read-only', async () => {
    // Establish genuine player engagement using a visible discovery.
    if (visibleEvidenceId) {
      await request('POST', `/api/investigations/${m5InvId}/discover-evidence`, { evidenceId: visibleEvidenceId }, m5Cookie);
    }
    const before = await request('GET', `/api/investigations/${m5InvId}`, undefined, m5Cookie);
    const claimsBefore = await request('GET', m5Base, undefined, m5Cookie);
    const res = await request('GET', `/api/investigations/${m5InvId}/perspectives/suggestions`, undefined, m5Cookie);
    if (res.status !== 200) throw new Error(`Suggestions failed: ${res.status}`);
    if (res.body.advisory !== true || res.body.isEvidence !== false || res.body.affectsVerdict !== false) {
      throw new Error('Suggestions missing advisory flags');
    }
    if (!Array.isArray(res.body.suggestions) || res.body.suggestions.length > 2) {
      throw new Error(`Expected at most 2 suggestions, got ${res.body.suggestions?.length}`);
    }
    if (res.body.suggestions.length === 0) throw new Error('Expected suggestions after engagement');
    for (const s of res.body.suggestions) {
      if (s.advisory !== true || s.isEvidence !== false || s.affectsVerdict !== false || !s.reasonText) {
        throw new Error('Suggestion item missing advisory fields');
      }
    }
    m5Suggestions = res.body.suggestions;
    const after = await request('GET', `/api/investigations/${m5InvId}`, undefined, m5Cookie);
    const claimsAfter = await request('GET', m5Base, undefined, m5Cookie);
    if (JSON.stringify(before.body.discoveredEvidenceIds) !== JSON.stringify(after.body.discoveredEvidenceIds)
      || before.body.status !== after.body.status || before.body.progress !== after.body.progress) {
      throw new Error('Suggestions GET mutated the investigation');
    }
    if (JSON.stringify(claimsBefore.body.claims) !== JSON.stringify(claimsAfter.body.claims)) {
      throw new Error('Suggestions GET created claims');
    }
    assertNoLeak(res.body, 'M5 suggestions', M4_CANONICAL_TERMS, hiddenUuids);
  });

  await test('M5: dismiss writes only suggestion state and excludes the lens', async () => {
    const target = m5Suggestions[0]?.experienceKey ?? smokeExperienceKey;
    const invBefore = await request('GET', `/api/investigations/${m5InvId}`, undefined, m5Cookie);
    const res = await request('POST', `/api/investigations/${m5InvId}/perspectives/suggestions/${target}/dismiss`, {
      reasonCode: 'broadens_perspective', fingerprint: 'm5-test-fingerprint',
    }, m5Cookie);
    if (res.status !== 200 || res.body.status !== 'dismissed') throw new Error(`Dismiss failed: ${res.status} ${JSON.stringify(res.body)}`);
    const stored = await query('SELECT status, reason_code, state_fingerprint FROM perspective_suggestion_state WHERE investigation_id = $1 AND experience_key = $2', [m5InvId, target]);
    if (stored.rows.length === 0 || stored.rows[0].status !== 'dismissed' || stored.rows[0].state_fingerprint !== 'm5-test-fingerprint') {
      throw new Error('Dismiss state not persisted');
    }
    const after = await request('GET', `/api/investigations/${m5InvId}/perspectives/suggestions`, undefined, m5Cookie);
    if (after.body.suggestions.some((s: any) => s.experienceKey === target)) throw new Error('Dismissed lens still suggested');
    const invAfter = await request('GET', `/api/investigations/${m5InvId}`, undefined, m5Cookie);
    if (JSON.stringify(invBefore.body.discoveredEvidenceIds) !== JSON.stringify(invAfter.body.discoveredEvidenceIds)
      || invBefore.body.status !== invAfter.body.status || invBefore.body.progress !== invAfter.body.progress) {
      throw new Error('Dismiss mutated the investigation');
    }
    const badReason = await request('POST', `/api/investigations/${m5InvId}/perspectives/suggestions/${target}/dismiss`, { reasonCode: 'solve_case' }, m5Cookie);
    if (badReason.status !== 400) throw new Error(`Invalid reason code accepted: ${badReason.status}`);
  });

  await test('M5: claim accepts validated perspective provenance', async () => {
    const created = await request('POST', `${m5Base}/claims`, {
      title: 'A lens-informed question', claimCategory: 'unresolved_question',
      sourcePerspectiveExperienceKey: smokeExperienceKey,
      sourcePerspectiveReflectionId: m5Reflection.id,
    }, m5Cookie);
    if (created.status !== 201) throw new Error(`Claim create failed: ${created.status} ${JSON.stringify(created.body)}`);
    if (created.body.sourcePerspectiveExperienceId !== smokeExperienceId
      || created.body.sourcePerspectiveReflectionId !== m5Reflection.id) {
      throw new Error('Claim perspective provenance not stored');
    }
    if (created.body.confidence !== 'insufficient_information') throw new Error('Claim confidence was auto-set');
    const badReflection = await request('POST', `${m5Base}/claims`, {
      title: 'Bad reflection', claimCategory: 'unresolved_question',
      sourcePerspectiveExperienceKey: smokeExperienceKey, sourcePerspectiveReflectionId: RANDOM_UUID,
    }, m5Cookie);
    if (badReflection.status !== 404) throw new Error(`Unknown reflection accepted: ${badReflection.status}`);
    const otherReflectionRes = await request('POST', `/api/perspectives/${smokeExperienceKey}/reflections`, {
      response: 'A reflection owned by another player.',
    }, m5OtherCookie);
    const otherReflection = otherReflectionRes.body?.reflection ?? otherReflectionRes.body;
    if (otherReflectionRes.status !== 201 || !otherReflection?.id) throw new Error('Other user reflection setup failed');
    const foreignReflection = await request('POST', `${m5Base}/claims`, {
      title: 'Foreign reflection', claimCategory: 'unresolved_question',
      sourcePerspectiveExperienceKey: smokeExperienceKey,
      sourcePerspectiveReflectionId: otherReflection.id,
    }, m5Cookie);
    if (foreignReflection.status !== 404) throw new Error(`Non-owner reflection accepted: ${foreignReflection.status}`);
    assertNoLeak(created.body, 'M5 claim', M4_CANONICAL_TERMS, hiddenUuids);
  });

  await test('M5: notebook accepts a perspective source with safe snapshot', async () => {
    const created = await request('POST', `/api/investigations/${m5InvId}/notebook`, {
      entryType: 'note', title: 'A lens note',
      content: 'A perspective-informed observation.', perspectiveKey: smokeExperienceKey,
    }, m5Cookie);
    if (created.status !== 201) throw new Error(`Notebook create failed: ${created.status} ${JSON.stringify(created.body)}`);
    if (created.body.perspectiveExperienceId !== smokeExperienceId) throw new Error('Notebook perspective id not stored');
    if (created.body.sourceSnapshot?.kind !== 'perspective_experience'
      || typeof created.body.sourceSnapshot?.disclaimer !== 'string') {
      throw new Error('Notebook perspective snapshot missing/disclaimer absent');
    }
    const sources = created.body.sourceSnapshot?.supportingSources ?? [];
    if (sources.some((s: any) => s.sourceUrl !== null)) throw new Error('Notebook snapshot exposed an unverified URL');
    const badKey = await request('POST', `/api/investigations/${m5InvId}/notebook`, {
      entryType: 'note', perspectiveKey: 'does-not-exist',
    }, m5Cookie);
    if (badKey.status !== 404) throw new Error(`Unknown perspective key accepted: ${badKey.status}`);
    assertNoLeak(created.body, 'M5 notebook', M4_CANONICAL_TERMS, hiddenUuids);
  });

  await test('M5: chat perspectiveKey yields epistemic note in deterministic fallback', async () => {
    if (!m2Specialists.length) throw new Error('No specialist fixture for chat');
    const key = m2Specialists[0].specialistKey;
    const withLens = await request('POST', `/api/investigations/${m5InvId}/chat`, {
      message: 'What should I check next?', specialistKey: key, perspectiveKey: smokeExperienceKey,
    }, m5Cookie);
    if (withLens.status !== 200) throw new Error(`Perspective chat failed: ${withLens.status} ${JSON.stringify(withLens.body)}`);
    if (withLens.body.perspectiveKey !== smokeExperienceKey || typeof withLens.body.perspectiveDisclaimer !== 'string') {
      throw new Error('Perspective chat meta missing');
    }
    if (!withLens.body.content.includes('Perspective lens note')) throw new Error('Deterministic fallback missing epistemic note');
    const plain = await request('POST', `/api/investigations/${m5InvId}/chat`, {
      message: 'What should I check next?', specialistKey: key,
    }, m5Cookie);
    if (plain.status !== 200 || plain.body.content.includes('Perspective lens note')) {
      throw new Error('Non-perspective chat behaviour changed');
    }
    assertNoLeak(withLens.body, 'M5 perspective chat', M4_CANONICAL_TERMS, hiddenUuids);
  });

  await test('M5: perspective payloads contain no canonical or hidden evidence data', async () => {
    const paths = [
      '/api/perspectives/frameworks', '/api/perspectives/discover', '/api/perspectives',
      `/api/perspectives/${smokeExperienceKey}`,
      `/api/perspectives/${smokeExperienceKey}/connections`,
      '/api/perspectives/reflections',
      `/api/investigations/${m5InvId}/perspectives/suggestions`,
    ];
    for (const path of paths) {
      const res = await request('GET', path, undefined, m5Cookie);
      if (res.status !== 200) throw new Error(`${path} failed: ${res.status}`);
      assertNoLeak(res.body, `M5 leak scan ${path}`, M4_CANONICAL_TERMS, hiddenUuids);
      const serialized = JSON.stringify(res.body).toLowerCase();
      // Only internal column/table identifiers are suspicious here. Words like
      // "solution" can legitimately appear in pedagogical disclaimers.
      for (const term of ['canonical_truth', 'hidden_events', 'source_verified=true']) {
        if (serialized.includes(term)) throw new Error(`${path} leaked internal term: ${term}`);
      }
    }
  });

  // M5 fixture cleanup: do not leak smoke content into player-facing catalog.
  try { await query('DELETE FROM perspective_experiences WHERE experience_key = $1', [smokeExperienceKey]); } catch {}

  // ---------------------------------------------------------------------------
  // M6 Living Investigations (deterministic activity feed, notifications inbox,
  // legacy developments compatibility). Safety properties: no canonical/hidden
  // leakage, no client-controlled time, idempotent materialization, ownership
  // isolation, and empty-safe behaviour for cases without an authored package.
  // ---------------------------------------------------------------------------
  console.log('\n=== M6 Living Investigations Tests ===\n');

  const M6_LEAK_TERMS = [...M4_CANONICAL_TERMS, 'Victor Sterling'];
  const M6_INTERNAL_TERMS = [
    'canonical_truth', 'hidden_events', 'discovery_conditions',
    'release_conditions', 'hidden_interpretation',
  ];
  const M6_SHOWCASE_TITLES = ['The Midnight Heist', 'Code Blue at the Clinic', 'Blaze at Dawn Bakery'];
  const M6_ACTIVITY_KEYS = [
    'sinceLastVisit', 'groups', 'counts', 'upcoming',
    'outstandingDisagreements', 'pendingResponse', 'hasMore', 'nextEligibleAt',
  ];
  function assertNoM6Internal(value: unknown, label: string): void {
    const serialized = JSON.stringify(value).toLowerCase();
    for (const term of M6_INTERNAL_TERMS) {
      if (serialized.includes(term)) throw new Error(`${label} leaked internal term: ${term}`);
    }
  }
  const m6PackageCount = (await query('SELECT COUNT(*)::int AS c FROM case_event_packages')).rows[0]?.c ?? 0;
  if (m6PackageCount === 0) {
    throw new Error('M6 case-event packages are not seeded - run npm run db:seed:case-events');
  }

  const m6Cookie = await registerAndLogin('m6-activity');
  const m6InvId = await createInvestigation(m6Cookie, caseId);
  const m6OtherInvIds: string[] = [];

  try {
    // HTTP exposes no time hook. Backdate ONLY this fixture (never other tests)
    // so authored events become due; the engine itself reads server time only.
    await query(
      `UPDATE investigations
          SET start_timestamp = NOW() - INTERVAL '3 hours',
              last_event_tick_at = NOW() - INTERVAL '3 hours'
        WHERE id = $1`,
      [m6InvId]
    );
    await query(
      `UPDATE investigation_events
          SET eligible_at = NOW() - INTERVAL '5 minutes'
        WHERE investigation_id = $1 AND status IN ('scheduled','eligible')`,
      [m6InvId]
    );

    let m6EventId: string | null = null;
    let m6NotificationIds: string[] = [];

    await test('M6: refresh resolves due events once and is idempotent (no duplicate notifications)', async () => {
      const first = await request('POST', `/api/investigations/${m6InvId}/activity/refresh`, {}, m6Cookie);
      if (first.status !== 200) throw new Error(`Refresh failed: ${first.status} ${JSON.stringify(first.body)}`);
      if (!Array.isArray(first.body?.resolved) || first.body.resolved.length === 0) {
        throw new Error(`Expected due events to resolve after backdating: ${JSON.stringify(first.body)}`);
      }
      if (!(first.body.counts?.notifications >= 1)) {
        throw new Error(`Expected notifications from resolved events: ${JSON.stringify(first.body.counts)}`);
      }
      m6EventId = String(first.body.resolved[0]?.id ?? '');

      const inbox1 = await request('GET', '/api/notifications?status=all&limit=50', undefined, m6Cookie);
      if (inbox1.status !== 200 || !Array.isArray(inbox1.body?.items)) throw new Error('Notifications inbox failed');
      const mine = inbox1.body.items.filter((n: any) => n.investigationId === m6InvId);
      if (mine.length < 1 || !(inbox1.body.unreadCount >= 1)) throw new Error('No unread notifications after refresh');
      m6NotificationIds = mine.map((n: any) => String(n.id));
      const dedupe = new Set(mine.map((n: any) => `${n.eventId}|${n.groupKey}`));
      if (dedupe.size !== mine.length) throw new Error('Duplicate notifications after first refresh');

      const second = await request('POST', `/api/investigations/${m6InvId}/activity/refresh`, {}, m6Cookie);
      if (second.status !== 200) throw new Error(`Second refresh failed: ${second.status}`);
      if (second.body?.resolved?.length !== 0) throw new Error('Second refresh resolved events again');

      const inbox2 = await request('GET', '/api/notifications?status=all&limit=50', undefined, m6Cookie);
      const mine2 = inbox2.body.items.filter((n: any) => n.investigationId === m6InvId);
      if (mine2.length !== mine.length || inbox2.body.unreadCount !== inbox1.body.unreadCount) {
        throw new Error('Second refresh duplicated notifications');
      }
      const activity = await request('GET', `/api/investigations/${m6InvId}/activity`, undefined, m6Cookie);
      if (activity.status !== 200) throw new Error('Activity fetch failed');
      const ids = activity.body.groups.flatMap((g: any) => g.items.map((i: any) => i.id));
      if (new Set(ids).size !== ids.length) throw new Error('Activity snapshot contains duplicate event ids');
    });

    await test('M6: activity snapshot returns a safe grouped structure', async () => {
      const res = await request('GET', `/api/investigations/${m6InvId}/activity`, undefined, m6Cookie);
      if (res.status !== 200) throw new Error(`Activity failed: ${res.status} ${JSON.stringify(res.body)}`);
      const body = res.body;
      for (const key of M6_ACTIVITY_KEYS) {
        if (!(key in body)) throw new Error(`Activity snapshot missing ${key}`);
      }
      for (const key of ['from', 'to', 'summary', 'highlights', 'unresolvedCount', 'newCount']) {
        if (!(key in body.sinceLastVisit)) throw new Error(`sinceLastVisit missing ${key}`);
      }
      for (const key of ['total', 'unread', 'high', 'byCategory']) {
        if (!(key in body.counts)) throw new Error(`counts missing ${key}`);
      }
      if (!Array.isArray(body.groups) || body.groups.length === 0) throw new Error('Expected resolved activity groups');
      for (const g of body.groups) {
        if (typeof g.groupKey !== 'string' || typeof g.title !== 'string'
          || !Array.isArray(g.items) || g.items.length === 0) {
          throw new Error('Malformed activity group');
        }
        for (const item of g.items) {
          for (const field of [
            'id', 'eventKey', 'category', 'title', 'summary', 'detail',
            'whyItMatters', 'status', 'significance', 'occurredAt', 'changes', 'provenanceLabel',
          ]) {
            if (!(field in item)) throw new Error(`Activity event missing ${field}`);
          }
          if (item.provenanceLabel !== 'case-package') throw new Error('Unexpected activity provenanceLabel');
        }
      }
      if (typeof body.hasMore !== 'boolean') throw new Error('hasMore is not boolean');
      if (!(body.nextEligibleAt === null || typeof body.nextEligibleAt === 'string')) {
        throw new Error('nextEligibleAt has wrong type');
      }
      assertNoLeak(body, 'M6 activity snapshot', M6_LEAK_TERMS, hiddenForCaseId ? [hiddenForCaseId] : []);
      assertNoM6Internal(body, 'M6 activity snapshot');
    });

    await test('M6: client-supplied timestamps cannot advance the world', async () => {
      const before = await request('GET', `/api/investigations/${m6InvId}/activity`, undefined, m6Cookie);
      const beforeTotal = before.body.counts.total;
      const beforeUnread = before.body.counts.unread;
      const res = await request('POST', `/api/investigations/${m6InvId}/activity/refresh`, {
        now: 'garbage', eligibleAt: '1999-01-01T00:00:00Z', max: 50, status: 'resolved',
      }, m6Cookie);
      if (res.status !== 200) throw new Error(`Garbage-timestamp refresh crashed: ${res.status}`);
      if (res.body?.resolved?.length !== 0) throw new Error('Client timestamps forced event resolution');
      const after = await request('GET', `/api/investigations/${m6InvId}/activity`, undefined, m6Cookie);
      if (after.body.counts.total !== beforeTotal || after.body.counts.unread !== beforeUnread) {
        throw new Error('Client timestamps changed activity state');
      }
    });

    await test('M6: activity and notification payloads contain no internal leak terms', async () => {
      const paths: Array<[string, string]> = [
        ['GET', `/api/investigations/${m6InvId}/activity`],
        ['GET', '/api/notifications?status=all&limit=50'],
      ];
      if (m6EventId) {
        paths.push(['GET', `/api/investigations/${m6InvId}/activity/events/${m6EventId}`]);
        paths.push(['POST', `/api/investigations/${m6InvId}/activity/events/${m6EventId}/narrate`]);
      }
      for (const [method, path] of paths) {
        const res = await request(method, path, method === 'POST' ? {} : undefined, m6Cookie);
        if (res.status !== 200) throw new Error(`${path} failed: ${res.status}`);
        assertNoM6Internal(res.body, `M6 leak scan ${path}`);
        assertNoLeak(res.body, `M6 leak scan ${path}`, M6_LEAK_TERMS, hiddenForCaseId ? [hiddenForCaseId] : []);
      }
    });

    await test('M6: mark-seen reduces unread notifications', async () => {
      const before = await request('GET', '/api/notifications?status=all&limit=50', undefined, m6Cookie);
      if (!(before.body.unreadCount >= 1)) throw new Error('No unread notifications to mark seen');
      const unread = before.body.items.filter((n: any) =>
        n.investigationId === m6InvId && n.status === 'unread');
      if (unread.length === 0) throw new Error('No fixture unread notifications');
      const res = await request('POST', `/api/investigations/${m6InvId}/activity/seen`, {
        eventIds: unread.map((n: any) => n.eventId).filter(Boolean),
      }, m6Cookie);
      if (res.status !== 200) throw new Error(`Mark-seen failed: ${res.status}`);
      const after = await request('GET', '/api/notifications?status=all&limit=50', undefined, m6Cookie);
      if (!(after.body.unreadCount < before.body.unreadCount)) {
        throw new Error(`Unread count did not decrease: ${before.body.unreadCount} -> ${after.body.unreadCount}`);
      }
      const remaining = after.body.items.filter((n: any) =>
        n.investigationId === m6InvId && n.status === 'unread');
      if (remaining.length !== 0) throw new Error('Fixture notifications remained unread after mark-seen');
    });

    await test('M6: notifications inbox is user-scoped and activity access is owner-only', async () => {
      const other = await registerAndLogin('m6-other');
      const inbox = await request('GET', '/api/notifications?status=all&limit=50', undefined, other);
      if (inbox.status !== 200) throw new Error(`Other inbox failed: ${inbox.status}`);
      if (inbox.body.items.some((n: any) =>
        n.investigationId === m6InvId || m6NotificationIds.includes(String(n.id)))) {
        throw new Error("Other user could see the owner's notifications");
      }
      if (inbox.body.unreadCount !== 0) throw new Error('Fresh user has unexpected unread notifications');

      const foreign = await request('GET', `/api/investigations/${m6InvId}/activity`, undefined, other);
      if (foreign.status !== 403 && foreign.status !== 404) {
        throw new Error(`Foreign activity not rejected: ${foreign.status}`);
      }
      const foreignEvent = await request(
        'GET', `/api/investigations/${m6InvId}/activity/events/${m6EventId || RANDOM_UUID}`, undefined, other
      );
      if (foreignEvent.status !== 403 && foreignEvent.status !== 404) {
        throw new Error(`Foreign event detail not rejected: ${foreignEvent.status}`);
      }
      const missing = await request(
        'GET', `/api/investigations/${m6InvId}/activity/events/${RANDOM_UUID}`, undefined, m6Cookie
      );
      if (missing.status !== 404) throw new Error(`Unknown event detail not 404: ${missing.status}`);
    });

    await test('M6: legacy developments endpoint still returns a safe array', async () => {
      const res = await request('GET', `/api/investigations/${m6InvId}/developments`, undefined, m6Cookie);
      if (res.status !== 200 || !Array.isArray(res.body)) throw new Error(`Developments failed: ${res.status}`);
      for (const d of res.body) {
        if (!d || typeof d.id !== 'string' || typeof d.message !== 'string') {
          throw new Error('Malformed development entry');
        }
      }
      assertNoM6Internal(res.body, 'M6 developments');
      assertNoLeak(res.body, 'M6 developments', M6_LEAK_TERMS, hiddenForCaseId ? [hiddenForCaseId] : []);
    });

    await test('M6: cases without an event package return safe empty activity', async () => {
      const nonShowcase = allCases.find((c: any) => c.id && !M6_SHOWCASE_TITLES.includes(c.title));
      if (!nonShowcase) throw new Error('No non-showcase case available');
      const cookie = await registerAndLogin('m6-nopackage');
      const invId = await createInvestigation(cookie, nonShowcase.id);
      m6OtherInvIds.push(invId);

      const res = await request('GET', `/api/investigations/${invId}/activity`, undefined, cookie);
      if (res.status !== 200) throw new Error(`No-package activity failed: ${res.status} ${JSON.stringify(res.body)}`);
      for (const key of M6_ACTIVITY_KEYS) {
        if (!(key in res.body)) throw new Error(`No-package snapshot missing ${key}`);
      }
      if (!Array.isArray(res.body.groups) || res.body.groups.length !== 0) {
        throw new Error('No-package case produced activity groups');
      }
      if (res.body.counts.total !== 0) throw new Error('No-package case produced activity events');
      const refresh = await request('POST', `/api/investigations/${invId}/activity/refresh`, {}, cookie);
      if (refresh.status !== 200 || refresh.body.resolved.length !== 0) {
        throw new Error('No-package refresh resolved events');
      }
      assertNoM6Internal(res.body, 'M6 no-package activity');
    });
  } finally {
    // M6 tables have no ON DELETE CASCADE to investigations, so remove all
    // engine-created rows for these fixtures directly. No other test shares
    // these investigation ids.
    for (const id of [m6InvId, ...m6OtherInvIds]) {
      await query('DELETE FROM notifications WHERE investigation_id = $1', [id]);
      await query('DELETE FROM investigation_events WHERE investigation_id = $1', [id]);
      await query('DELETE FROM investigation_flags WHERE investigation_id = $1', [id]);
      await query('DELETE FROM development_log WHERE investigation_id = $1', [id]);
    }
  }

  // ---------------------------------------------------------------------------
  // M7 Real-World Discovery & Knowledge Retention.
  // The harness starts the API with USE_LLM=false, so every submission here
  // exercises the deterministic-only path (no LLM call, llmUsed=false).
  // ---------------------------------------------------------------------------
  console.log('\n=== M7 Discovery & Knowledge Retention Tests ===\n');

  const M7_LEAK_TERMS = [...M4_CANONICAL_TERMS, 'Victor Sterling', 'hollow base', 'silver trophy', 'Sterling Holdings', '20 million'];
  const M7_INTERNAL_TERMS = [
    'canonical_truth', 'hidden_events', 'hidden_interpretation', 'discovery_conditions',
    'release_conditions', 'conceptcriteria', 'minessentialmatches', 'misconceptionterms',
    'leakageterms', 'subjectaliases', 'confidentmarkers', 'acceptancethreshold',
  ];
  function assertNoM7Internal(value: unknown, label: string): void {
    const serialized = JSON.stringify(value).toLowerCase();
    for (const term of M7_INTERNAL_TERMS) {
      if (serialized.includes(term)) throw new Error(`${label} leaked internal term: ${term}`);
    }
  }
  function assertM7Safe(value: unknown, label: string): void {
    assertNoM7Internal(value, label);
    assertNoLeak(value, label, M7_LEAK_TERMS, hiddenForCaseId ? [hiddenForCaseId] : []);
  }

  const m7Cookie = await registerAndLogin('m7-discovery');
  const m7InvId = await createInvestigation(m7Cookie, caseId);
  const m7UserIdForCleanup = String(
    (await query('SELECT id FROM users WHERE email = $1', [`m7-discovery-${suffix}@example.com`])).rows[0]?.id ?? ''
  );
  const m7NotebookIds: string[] = [];
  const m7PackageCount = (await query('SELECT COUNT(*)::int AS c FROM discovery_clue_packages')).rows[0]?.c ?? 0;
  if (m7PackageCount === 0) {
    throw new Error('M7 discovery packages are not seeded - run npm run db:seed:discoveries');
  }

  try {
    const m7VisibleEvidence: string[] = (await query(
      `SELECT e.id FROM evidence e JOIN cases c ON c.id = e.case_id
        WHERE c.title = $1 AND e.player_visible = true ORDER BY e.discovery_order`,
      [midnightHeist.title],
    )).rows.map((r: any) => String(r.id));
    if (m7VisibleEvidence.length < 4) throw new Error('M7 fixture: fewer than four visible evidence items');

    const locard = 'mh-locard-trace-transfer';
    const locardInsight = 'mh-locard-insight';
    const diamond = 'mh-diamond-simulant-identification';
    const diamondAction = 'mh-reexamine-display-case';
    const m7Path = (suffixPath: string) => `/api/investigations/${m7InvId}${suffixPath}`;

    const weakSubmission = {
      subjectIdentification: 'the exchange principle',
      explanation: 'It is relevant to thinking about the display case and the evidence record in this investigation.',
      connectionExplanation: '',
      uncertainty: '',
      sourceRefs: [],
      confidence: 'low',
    };
    const correctLocard = {
      subjectIdentification: "Locard's exchange principle",
      explanation:
        'When people and surfaces come into contact, trace material is transferred in both directions: something is left behind and something is carried away.',
      connectionExplanation:
        'In this case the fingerprint analysis can show contact with the display, but it cannot establish when that contact happened or how long it lasted.',
      uncertainty: '',
      sourceRefs: ['forensic textbook'],
      confidence: 'high',
    };
    const correctDiamond = {
      subjectIdentification: 'diamond identification and simulants',
      explanation:
        'A clear stone can look like a diamond to the eye, but visual appearance alone cannot establish what it is. A laboratory measures properties such as refractive index, thermal conductivity and specific gravity, and treats a simulant such as moissanite or cubic zirconia as a separate category from diamond.',
      connectionExplanation:
        'In this case the recovered stone and debris record need those laboratory tests rather than appearance.',
      uncertainty: '',
      sourceRefs: [],
      confidence: 'high',
    };

    await test('M7: snapshot is owner-scoped, auth-required, and hidden clues stay hidden', async () => {
      const anon = await request('GET', m7Path('/discoveries'));
      if (anon.status !== 401) throw new Error(`Anonymous snapshot not rejected: ${anon.status}`);
      const other = await registerAndLogin('m7-other');
      const foreign = await request('GET', m7Path('/discoveries'), undefined, other);
      if (foreign.status !== 403 && foreign.status !== 404) {
        throw new Error(`Foreign discovery snapshot not rejected: ${foreign.status}`);
      }
      const res = await request('GET', m7Path('/discoveries'), undefined, m7Cookie);
      if (res.status !== 200 || !res.body?.available) throw new Error(`Snapshot failed: ${res.status} ${JSON.stringify(res.body)}`);
      for (const key of ['disclaimer', 'clues', 'newClueKeys', 'states', 'memories', 'unlocks', 'recallPrompts', 'specialistNotices']) {
        if (!(key in res.body)) throw new Error(`Snapshot missing ${key}`);
      }
      if (res.body.clues.some((c: any) => c.key === locard)) throw new Error('Locard clue surfaced before its trigger');
      const detail = await request('GET', m7Path(`/discoveries/${locard}`), undefined, m7Cookie);
      if (detail.status !== 404) throw new Error(`Hidden clue detail not 404: ${detail.status}`);
      assertM7Safe(res.body, 'M7 initial snapshot');
      assertM7Safe(detail.body, 'M7 hidden clue detail');
    });

    await test('M7: player actions establish eligibility and the clue appears', async () => {
      for (const id of m7VisibleEvidence) {
        const res = await request('POST', m7Path('/discover-evidence'), { evidenceId: id }, m7Cookie);
        if (res.status !== 200) throw new Error(`Visible discovery failed: ${res.status}`);
      }
      const action = await request('POST', m7Path('/investigate'), { action: 'examine_diamond_case' }, m7Cookie);
      if (action.status !== 200) throw new Error(`Investigative action failed: ${action.status} ${JSON.stringify(action.body)}`);

      const res = await request('GET', m7Path('/discoveries'), undefined, m7Cookie);
      if (res.status !== 200) throw new Error(`Snapshot refetch failed: ${res.status}`);
      const clue = res.body.clues.find((c: any) => c.key === locard);
      if (!clue) throw new Error('Locard clue did not surface after its trigger');
      if (clue.correctedUnderstanding !== null) throw new Error('Unaccepted clue exposed correctedUnderstanding');
      if (clue.criteria || clue.leakageTerms || clue.matchedEssential) throw new Error('Internal clue fields leaked');
      const detail = await request('GET', m7Path(`/discoveries/${locard}`), undefined, m7Cookie);
      if (detail.status !== 200 || detail.body.clue.key !== locard) throw new Error(`Clue detail failed: ${detail.status}`);
      assertM7Safe(res.body, 'M7 eligible snapshot');
      assertM7Safe(detail.body, 'M7 eligible detail');
    });

    await test('M7: research state persists and a weak answer is not accepted', async () => {
      const start = await request('POST', m7Path(`/discoveries/${locard}/start`), {}, m7Cookie);
      if (start.status !== 200 || start.body.state !== 'researching') {
        throw new Error(`Start research failed: ${start.status} ${JSON.stringify(start.body)}`);
      }
      const detailBefore = await request('GET', m7Path(`/discoveries/${locard}`), undefined, m7Cookie);
      if (detailBefore.body.state?.state !== 'researching') throw new Error('Research state did not persist');

      const weak = await request('POST', m7Path(`/discoveries/${locard}/submissions`), weakSubmission, m7Cookie);
      if (weak.status !== 201) throw new Error(`Weak submission failed: ${weak.status} ${JSON.stringify(weak.body)}`);
      if (weak.body.accepted !== false) throw new Error('Weak answer was accepted');
      if (weak.body.correctedUnderstanding !== null) throw new Error('Weak answer exposed correctedUnderstanding');
      if (weak.body.memoryItemId !== null || weak.body.unlocks.length !== 0) throw new Error('Weak answer created memory/unlocks');
      if (weak.body.submission.evaluation.llmUsed !== false) throw new Error('LLM was used with USE_LLM=false');
      if (weak.body.state.attemptCount !== 1) throw new Error('Attempt count was not incremented');
      assertM7Safe(weak.body, 'M7 weak submission');

      const journal = await request('GET', '/api/knowledge/journal', undefined, m7Cookie);
      if (journal.status !== 200 || journal.body.items.length !== 0) throw new Error('Weak answer created a memory item');
    });

    let m7MemoryId: string | null = null;
    await test('M7: correct answer is accepted with correction, memory and unlocks (deterministic)', async () => {
      const invBefore = await request('GET', m7Path('/'), undefined, m7Cookie);
      const countBefore = invBefore.body.discoveredEvidenceIds?.length ?? 0;

      const res = await request('POST', m7Path(`/discoveries/${locard}/submissions`), correctLocard, m7Cookie);
      if (res.status !== 201) throw new Error(`Correct submission failed: ${res.status} ${JSON.stringify(res.body)}`);
      if (res.body.accepted !== true || res.body.classification !== 'established') throw new Error('Correct answer was not accepted');
      if (!res.body.correctedUnderstanding || !res.body.memoryItemId) throw new Error('Accepted answer missing correction/memory');
      if (!Array.isArray(res.body.unlocks) || res.body.unlocks.length < 3) throw new Error('Accepted answer missing unlocks');
      if (res.body.submission.evaluation.llmUsed !== false) throw new Error('LLM advisory used despite USE_LLM=false');
      if (res.body.unlocks.some((u: any) => u.kind === 'action')) throw new Error('Locard clue should not carry an action unlock');
      m7MemoryId = String(res.body.memoryItemId);
      assertM7Safe(res.body, 'M7 accepted submission');

      // Pre-authored unlocks never release evidence directly.
      const invAfter = await request('GET', m7Path('/'), undefined, m7Cookie);
      const countAfter = invAfter.body.discoveredEvidenceIds?.length ?? 0;
      if (countAfter !== countBefore) throw new Error('Acceptance changed evidence discovery state');

      const detail = await request('GET', m7Path(`/discoveries/${locard}`), undefined, m7Cookie);
      if (!detail.body.clue.accepted || detail.body.clue.correctedUnderstanding === null) {
        throw new Error('Detail did not reflect acceptance');
      }
      assertM7Safe(detail.body, 'M7 accepted detail');
    });

    await test('M7: duplicate accepted submission adds no submission/unlocks', async () => {
      const before = (await query('SELECT COUNT(*)::int AS c FROM discovery_submissions WHERE investigation_id = $1', [m7InvId])).rows[0]?.c;
      const res = await request('POST', m7Path(`/discoveries/${locard}/submissions`), correctLocard, m7Cookie);
      if (res.status !== 201 || res.body.duplicate !== true || res.body.accepted !== true) {
        throw new Error(`Duplicate submission not handled: ${res.status} ${JSON.stringify(res.body)}`);
      }
      const after = (await query('SELECT COUNT(*)::int AS c FROM discovery_submissions WHERE investigation_id = $1', [m7InvId])).rows[0]?.c;
      if (after !== before) throw new Error('Duplicate submission inserted a row');
      const unlockCount = (await query('SELECT COUNT(*)::int AS c FROM investigation_discovery_unlocks WHERE investigation_id = $1 AND clue_key = $2', [m7InvId, locard])).rows[0]?.c;
      if (unlockCount !== 4) throw new Error(`Expected 4 pre-authored unlocks, got ${unlockCount}`);
      assertM7Safe(res.body, 'M7 duplicate submission');
    });

    let m7ActionUnlockKey: string | null = null;
    await test('M7: action unlock apply uses progression, is idempotent and authorized', async () => {
      const other = await registerAndLogin('m7-unlock-other');
      const forbidden = await request('POST', m7Path(`/discoveries/${locard}/unlocks/${locardInsight}/apply`), {}, other);
      if (forbidden.status !== 403 && forbidden.status !== 404) throw new Error(`Foreign unlock apply not rejected: ${forbidden.status}`);

      const missing = await request('POST', m7Path(`/discoveries/${locard}/unlocks/does-not-exist/apply`), {}, m7Cookie);
      if (missing.status !== 404) throw new Error(`Unknown unlock not 404: ${missing.status}`);

      // Informational unlocks cannot be applied as actions.
      const insight = await request('POST', m7Path(`/discoveries/${locard}/unlocks/${locardInsight}/apply`), {}, m7Cookie);
      if (insight.status !== 400) throw new Error(`Insight unlock apply not rejected: ${insight.status}`);

      // Establish the diamond clue eligibility (second showcase thread).
      const action = await request('POST', m7Path('/investigate'), { action: 'examine_case_debris' }, m7Cookie);
      if (action.status !== 200) throw new Error(`Debris action failed: ${action.status}`);
      const accepted = await request('POST', m7Path(`/discoveries/${diamond}/submissions`), correctDiamond, m7Cookie);
      if (accepted.status !== 201 || accepted.body.accepted !== true) {
        throw new Error(`Diamond clue acceptance failed: ${accepted.status} ${JSON.stringify(accepted.body)}`);
      }
      const actionUnlock = accepted.body.unlocks.find((u: any) => u.kind === 'action');
      if (!actionUnlock) throw new Error('Diamond clue did not expose its pre-authored action unlock');
      m7ActionUnlockKey = String(actionUnlock.unlockKey);
      if (actionUnlock.action !== 'examine_diamond_case') throw new Error('Unexpected authored action');

      const first = await request('POST', m7Path(`/discoveries/${diamond}/unlocks/${m7ActionUnlockKey}/apply`), {}, m7Cookie);
      if (first.status !== 200 || first.body.applied !== true || !first.body.progression) {
        throw new Error(`Action unlock apply failed: ${first.status} ${JSON.stringify(first.body)}`);
      }
      const second = await request('POST', m7Path(`/discoveries/${diamond}/unlocks/${m7ActionUnlockKey}/apply`), {}, m7Cookie);
      if (second.status !== 200 || second.body.alreadyApplied !== true) throw new Error('Action unlock was not idempotent');
      assertM7Safe(first.body, 'M7 action unlock apply');
      assertM7Safe(second.body, 'M7 idempotent unlock apply');
    });

    await test('M7: journal is user-scoped and recall never downgrades mastery', async () => {
      if (!m7MemoryId) throw new Error('No memory fixture');
      const other = await registerAndLogin('m7-journal-other');
      const foreign = await request('GET', '/api/knowledge/journal', undefined, other);
      if (foreign.status !== 200 || foreign.body.items.length !== 0) throw new Error('Journal was not user-scoped');
      const foreignSubject = await request('GET', '/api/knowledge/journal/locard-exchange-principle', undefined, other);
      if (foreignSubject.status !== 404) throw new Error('Foreign subject detail not 404');

      const own = await request('GET', '/api/knowledge/journal', undefined, m7Cookie);
      if (own.status !== 200 || own.body.items.length < 1) throw new Error('Owner journal missing memory');
      const memory = own.body.items.find((m: any) => m.id === m7MemoryId);
      if (!memory) throw new Error('Accepted memory missing from journal');
      const masteryBefore = memory.masteryStatus;

      const foreignRecall = await request('POST', `/api/knowledge/recall/${m7MemoryId}`, { response: 'x', outcome: 'success' }, other);
      if (foreignRecall.status !== 404) throw new Error('Foreign recall not 404');
      const missed = await request('POST', `/api/knowledge/recall/${m7MemoryId}`, {
        response: 'I cannot recall the details right now.',
        outcome: 'missed',
      }, m7Cookie);
      if (missed.status !== 200 || missed.body.recall.outcome !== 'missed') throw new Error(`Recall failed: ${missed.status} ${JSON.stringify(missed.body)}`);
      if (missed.body.memory.masteryStatus !== masteryBefore) throw new Error('Missed recall downgraded mastery');
      if (missed.body.recall.intervalDays !== 1) throw new Error('Missed recall did not reset the interval');
      const success = await request('POST', `/api/knowledge/recall/${m7MemoryId}`, {
        response: 'Contact transfers material both ways, with limits on timing.',
        outcome: 'success',
      }, m7Cookie);
      if (success.status !== 200) throw new Error(`Successful recall failed: ${success.status}`);
      const subject = await request('GET', '/api/knowledge/journal/locard-exchange-principle', undefined, m7Cookie);
      if (subject.status !== 200 || subject.body.recallHistory.length !== 2) throw new Error('Recall history not persisted');
      assertM7Safe(own.body, 'M7 journal');
      assertM7Safe(missed.body, 'M7 recall result');
      assertM7Safe(subject.body, 'M7 journal subject');
    });

    await test('M7: notebook discovery provenance is owner-scoped and safe', async () => {
      if (!m7MemoryId) throw new Error('No memory fixture');
      const created = await request('POST', m7Path('/notebook'), {
        entryType: 'note',
        title: 'Trace and timing',
        content: 'A trace shows contact; timing needs another record.',
        discoveryMemoryId: m7MemoryId,
        discoveryClueKey: locard,
      }, m7Cookie);
      if (created.status !== 201 || !created.body.id) throw new Error(`Notebook create failed: ${created.status} ${JSON.stringify(created.body)}`);
      m7NotebookIds.push(String(created.body.id));
      if (created.body.discoveryMemoryId !== m7MemoryId) throw new Error('Notebook did not store discoveryMemoryId');
      const snapshot = created.body.sourceSnapshot;
      if (snapshot?.kind !== 'discovery_memory' || snapshot.subjectKey !== 'locard-exchange-principle') {
        throw new Error('Notebook source snapshot was not a discovery_memory snapshot');
      }
      if (!snapshot.correctedUnderstanding || !Array.isArray(snapshot.citations) || !snapshot.disclaimer) {
        throw new Error('Discovery snapshot missing safe fields');
      }
      const listed = await request('GET', m7Path('/notebook'), undefined, m7Cookie);
      if (!Array.isArray(listed.body) || !listed.body.some((e: any) => e.id === created.body.id)) {
        throw new Error('Notebook list missing discovery entry');
      }
      const other = await registerAndLogin('m7-notebook-other');
      const foreign = await request('POST', m7Path('/notebook'), {
        entryType: 'note', content: 'x', discoveryMemoryId: m7MemoryId,
      }, other);
      // Ownership is enforced by investigationRouter first; the service also
      // rejects a memory that does not belong to the caller.
      if (foreign.status !== 403 && foreign.status !== 404) {
        throw new Error(`Foreign notebook discovery link not rejected: ${foreign.status}`);
      }
      const invalid = await request('POST', m7Path('/notebook'), {
        entryType: 'note', content: 'x', discoveryMemoryId: RANDOM_UUID,
      }, m7Cookie);
      if (invalid.status !== 404) throw new Error(`Unknown memory id not 404: ${invalid.status} ${JSON.stringify(invalid.body)}`);
      assertM7Safe(created.body, 'M7 notebook entry');
      assertM7Safe(listed.body, 'M7 notebook list');
    });

    await test('M7: all discovery payloads pass hidden-truth and internal-field scans', async () => {
      const paths: Array<[string, string]> = [
        ['GET', m7Path('/discoveries')],
        ['GET', m7Path(`/discoveries/${locard}`)],
        ['GET', m7Path(`/discoveries/${diamond}`)],
        ['GET', '/api/knowledge/journal'],
        ['GET', '/api/knowledge/journal/locard-exchange-principle'],
      ];
      for (const [method, path] of paths) {
        const res = await request(method, path, undefined, m7Cookie);
        if (res.status !== 200) throw new Error(`${path} failed: ${res.status}`);
        assertM7Safe(res.body, `M7 leak scan ${path}`);
      }
    });
  } finally {
    // M7 tables have no ON DELETE CASCADE to investigations. Remove only the
    // rows created by this fixture block; no other test shares these ids.
    for (const id of m7NotebookIds) {
      await query('DELETE FROM notebook_entries WHERE id = $1', [id]);
    }
    await query('DELETE FROM knowledge_recall_events WHERE investigation_id = $1', [m7InvId]);
    await query('DELETE FROM knowledge_recall_events WHERE memory_item_id IN (SELECT id FROM knowledge_memory_items WHERE user_id = $1)', [m7UserIdForCleanup]);
    await query('DELETE FROM knowledge_memory_links WHERE user_id = $1', [m7UserIdForCleanup]);
    await query('DELETE FROM knowledge_memory_cases WHERE investigation_id = $1', [m7InvId]);
    await query('DELETE FROM knowledge_memory_items WHERE user_id = $1', [m7UserIdForCleanup]);
    await query('DELETE FROM investigation_discovery_unlocks WHERE investigation_id = $1', [m7InvId]);
    await query('DELETE FROM discovery_submissions WHERE investigation_id = $1', [m7InvId]);
    await query('DELETE FROM investigation_discovery_clue_states WHERE investigation_id = $1', [m7InvId]);
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err: Error) => {
  console.error('Fatal error:', err);
  await pool.end();
  process.exit(1);
});
