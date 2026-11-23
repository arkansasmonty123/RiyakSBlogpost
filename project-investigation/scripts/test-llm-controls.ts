/**
 * M8-5 focused regression tests for LLM cost/quality controls.
 *
 * Uses local fake OpenAI-compatible endpoints; no external network or DB.
 * Verifies: output guardrails, one-shot failover, deterministic fallback when
 * disabled/unavailable, env-configurable caps, and secret-free log lines.
 *
 *   npm run test:llm-controls
 */

import http from 'node:http';
import { requestChatCompletion } from '../src/llm-provider';

interface CapturedRequest {
  body: any;
  url: string;
}

interface FakeResponse {
  status: number;
  content: string | null;
}

interface FakeServer {
  url: string;
  requests: CapturedRequest[];
  close: () => Promise<void>;
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
}

async function startFake(handler: (body: any) => FakeResponse): Promise<FakeServer> {
  const requests: CapturedRequest[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk.toString(); });
    req.on('end', () => {
      let body: any = null;
      try { body = JSON.parse(raw); } catch { body = null; }
      requests.push({ body, url: req.url ?? '' });
      const response = handler(body);
      res.writeHead(response.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: response.content } }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
  return {
    url: `http://127.0.0.1:${port}/v1/chat/completions`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

const LLM_ENV_KEYS = [
  'USE_LLM', 'LLM_PROVIDER', 'LLM_URL', 'LLM_MODEL', 'LLM_API_KEY',
  'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'LLM_TIMEOUT_MS', 'LLM_MAX_TOKENS',
  'LLM_TEMPERATURE', 'LLM_FAILOVER_PROVIDER', 'LLM_FAILOVER_URL',
  'LLM_FAILOVER_MODEL', 'LLM_FAILOVER_API_KEY',
] as const;

const savedEnv = new Map<string, string | undefined>();
for (const key of LLM_ENV_KEYS) savedEnv.set(key, process.env[key]);

function resetEnv(): void {
  for (const key of LLM_ENV_KEYS) delete process.env[key];
  process.env.USE_LLM = 'true';
  process.env.LLM_PROVIDER = 'local';
}

function restoreEnv(): void {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function main(): Promise<void> {
  const realInfo = console.info;
  let logs: string[] = [];
  console.info = (...args: any[]) => { logs.push(args.map((a) => String(a)).join(' ')); };

  const servers: FakeServer[] = [];
  try {
    // A) Invalid output (internal leak marker) -> null, invalid outcome, no secrets in logs.
    resetEnv();
    process.env.LLM_API_KEY = 'super-secret-key-xyz';
    const primary = await startFake(() => ({ status: 200, content: 'Here is the answer; canonical_truth revealed.' }));
    servers.push(primary);
    process.env.LLM_URL = primary.url;
    logs = [];
    const invalid = await requestChatCompletion('system SECRET_PROMPT_MARKER', 'user SECRET_USER_MARKER');
    assert(invalid === null, 'leak-marker output is rejected');
    assert(logs.length === 1 && logs[0]!.includes('"outcome":"invalid"'), 'invalid outcome logged');
    assert(logs[0]!.includes('"fallbackUsed":true'), 'invalid output marks fallback used');
    for (const secret of ['super-secret-key-xyz', 'SECRET_PROMPT_MARKER', 'SECRET_USER_MARKER']) {
      assert(!logs.join('\n').includes(secret), `logs must not contain ${secret}`);
    }
    console.log('  ✅ guardrail rejects leak-marker output and logs no secrets');

    // B) Primary fails -> one-shot failover succeeds.
    resetEnv();
    const failing = await startFake(() => ({ status: 500, content: null }));
    const backup = await startFake(() => ({ status: 200, content: 'Valid advisory answer.' }));
    servers.push(failing, backup);
    process.env.LLM_URL = failing.url;
    process.env.LLM_FAILOVER_URL = backup.url;
    process.env.LLM_FAILOVER_PROVIDER = 'openai';
    logs = [];
    const viaFailover = await requestChatCompletion('system', 'user', { maxTokens: 77, timeoutMs: 3000 });
    assert(viaFailover === 'Valid advisory answer.', 'failover returns valid content');
    assert(failing.requests.length === 1 && backup.requests.length === 1, 'exactly one primary and one failover attempt');
    assert(failing.requests[0]!.body.max_tokens === 77 && backup.requests[0]!.body.max_tokens === 77, 'per-call token cap applied');
    // One structured summary line per call, reflecting the endpoint that answered.
    assert(logs.length === 1 && logs[0]!.includes('"failoverUsed":true') && logs[0]!.includes('"outcome":"ok"'), 'failover success logged');
    assert(logs[0]!.includes('"fallbackUsed":false'), 'successful failover does not use deterministic fallback');
    console.log('  ✅ single failover attempt on primary failure');

    // C) Primary fails with no failover -> null (caller uses deterministic fallback).
    resetEnv();
    const failingOnly = await startFake(() => ({ status: 503, content: null }));
    servers.push(failingOnly);
    process.env.LLM_URL = failingOnly.url;
    logs = [];
    const noFailover = await requestChatCompletion('system', 'user');
    assert(noFailover === null, 'failure without failover returns null');
    assert(logs.length === 1 && logs[0]!.includes('"outcome":"http_error"') && logs[0]!.includes('"fallbackUsed":true'), 'http_error logged');
    console.log('  ✅ unavailable provider returns null for deterministic fallback');

    // D) USE_LLM=false -> no network call, no metrics log.
    resetEnv();
    process.env.USE_LLM = 'false';
    process.env.LLM_URL = failingOnly.url;
    const before = failingOnly.requests.length;
    logs = [];
    const disabled = await requestChatCompletion('system', 'user');
    assert(disabled === null, 'disabled provider returns null');
    assert(failingOnly.requests.length === before, 'disabled provider makes zero HTTP requests');
    assert(logs.length === 0, 'disabled provider emits no call metrics');
    console.log('  ✅ USE_LLM=false makes no LLM call');

    // E) Env caps override per-call values.
    resetEnv();
    process.env.LLM_MAX_TOKENS = '17';
    process.env.LLM_TEMPERATURE = '0.9';
    process.env.LLM_TIMEOUT_MS = '5000';
    const capped = await startFake(() => ({ status: 200, content: 'ok' }));
    servers.push(capped);
    process.env.LLM_URL = capped.url;
    const ok = await requestChatCompletion('system', 'user', { maxTokens: 220, temperature: 0.7, timeoutMs: 15000 });
    assert(ok === 'ok', 'valid non-empty output returned');
    assert(capped.requests[0]!.body.max_tokens === 17, 'LLM_MAX_TOKENS env cap applied');
    assert(capped.requests[0]!.body.temperature === 0.9, 'LLM_TEMPERATURE env cap applied');
    console.log('  ✅ env-configurable token/temperature caps override call defaults');

    // F) Empty model output is rejected.
    resetEnv();
    const empty = await startFake(() => ({ status: 200, content: '   ' }));
    servers.push(empty);
    process.env.LLM_URL = empty.url;
    logs = [];
    const emptyResult = await requestChatCompletion('system', 'user');
    assert(emptyResult === null, 'blank output is rejected');
    assert(logs.length === 1 && logs[0]!.includes('"outcome":"invalid"') && logs[0]!.includes('empty'), 'blank output logged as invalid/empty');
    console.log('  ✅ blank model output falls back deterministically');

    console.log('\nTEST LLM CONTROLS: PASS (6 scenarios)');
  } finally {
    console.info = realInfo;
    restoreEnv();
    await Promise.all(servers.map((s) => s.close()));
  }
}

main().catch((err) => {
  console.error('TEST LLM CONTROLS: FAIL', err);
  process.exitCode = 1;
});
