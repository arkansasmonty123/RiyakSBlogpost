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

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err: Error) => {
  console.error('Fatal error:', err);
  await pool.end();
  process.exit(1);
});
