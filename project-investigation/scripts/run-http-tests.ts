// HTTP regression harness (QA-001 / GAP-11).
//
// Spawns the API on an ephemeral (or HTTP_TEST_PORT) port, waits for
// /api/health, runs scripts/smoke-http.ts against it with SMOKE_BASE_URL, and
// always tears the server down. This is the CI-friendly entry point:
//
//   npm run test:http
//   HTTP_TEST_PORT=3100 npm run test:http   # optional fixed port
//
// Prerequisite: the same seeded Postgres DB required by test:smoke. Set
// DATABASE_URL / PG* env vars as usual; they are inherited by both children.

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const HEALTH_TIMEOUT_MS = 20_000;

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close(() => reject(new Error('Could not determine an ephemeral port')));
        return;
      }
      const { port } = address;
      probe.close(() => resolve(port));
    });
  });
}

async function waitForHealth(url: string): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastError = 'no response';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server health check timed out after ${HEALTH_TIMEOUT_MS}ms (${lastError})`);
}

function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  const configuredPort = Number(process.env.HTTP_TEST_PORT);
  const port = Number.isInteger(configuredPort) && configuredPort > 0
    ? configuredPort
    : await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const server = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: ROOT,
    // PROD-014: force the deterministic chat responder so role-aware response
    // shape/fallback assertions are reproducible and never depend on a local
    // LLM endpoint being up. Production/default behaviour is unchanged.
    env: { ...process.env, PORT: String(port), SMOKE_BASE_URL: baseUrl, USE_LLM: 'false', AUTH_RATE_MAX: '100000', CHAT_RATE_MAX: '100000', WRITE_RATE_MAX: '100000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverLog = '';
  const record = (chunk: Buffer | string): void => {
    serverLog = (serverLog + chunk.toString()).slice(-8000);
    process.stdout.write(chunk);
  };
  server.stdout.on('data', record);
  server.stderr.on('data', record);

  try {
    await waitForHealth(`${baseUrl}/api/health`);
    console.log(`[test:http] server ready at ${baseUrl}; running smoke-http.ts`);
    const smoke = spawn(process.execPath, ['--import', 'tsx', 'scripts/smoke-http.ts'], {
      cwd: ROOT,
      env: { ...process.env, SMOKE_BASE_URL: baseUrl },
      stdio: 'inherit',
    });
    process.exitCode = await waitForExit(smoke);
  } catch (err) {
    console.error(`[test:http] ${err instanceof Error ? err.message : String(err)}`);
    console.error('[test:http] --- server output (tail) ---');
    console.error(serverLog);
    process.exitCode = 1;
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      server.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
    }
  }
}

main().catch((err) => {
  console.error('[test:http] fatal:', err);
  process.exitCode = 1;
});
