import http from 'node:http';
import { URL } from 'node:url';
import { closeDb, getDb } from './db/database';
import {
  CorruptSaveError,
  deleteSaveSlot,
  getSaveSlot,
  listAuditEvents,
  listSaveSlots,
  SaveConflictError,
  upsertSaveSlot,
} from './db/repository';

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

async function readBody(req: http.IncomingMessage, limitBytes = 2_000_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > limitBytes) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(buf);
  }
  if (chunks.length === 0) return null;
  const text = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(text);
}

function isLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // non-browser / same-origin tooling
  try {
    const u = new URL(origin);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
  } catch {
    return false;
  }
}

function assertMutatingRequestSafe(req: http.IncomingMessage): void {
  const origin = req.headers.origin;
  if (!isLocalOrigin(typeof origin === 'string' ? origin : undefined)) {
    throw new Error('FORBIDDEN_ORIGIN');
  }
  const method = req.method ?? 'GET';
  if (method === 'PUT' || method === 'POST') {
    const ct = String(req.headers['content-type'] ?? '').toLowerCase();
    if (!ct.includes('application/json')) {
      throw new Error('UNSUPPORTED_CONTENT_TYPE');
    }
  }
}

// Keep this pattern in sync with SLOT_ID_PATTERN in src/storage/slotId.ts (ADR-003 risk #5).
function slotIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/api\/saves\/([a-zA-Z0-9_-]{1,64})$/);
  return m ? m[1] : null;
}

export async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const { pathname } = url;
    const method = req.method ?? 'GET';

    if (method === 'GET' && pathname === '/api/health') {
      getDb();
      return sendJson(res, 200, { ok: true, service: 'the-bar-db', storage: 'sqlite' });
    }

    if (method === 'GET' && pathname === '/api/saves') {
      return sendJson(res, 200, { ok: true, slots: listSaveSlots(getDb()) });
    }

    if (method === 'GET' && pathname === '/api/audit') {
      const slotId = url.searchParams.get('slotId') ?? undefined;
      const rawLimit = Number(url.searchParams.get('limit') ?? '100');
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(500, Math.floor(rawLimit))) : 100;
      return sendJson(res, 200, { ok: true, events: listAuditEvents(getDb(), slotId, limit) });
    }

    const slotId = slotIdFromPath(pathname);
    if (slotId) {
      if (method === 'GET') {
        const slot = getSaveSlot(getDb(), slotId);
        if (!slot) return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
        return sendJson(res, 200, { ok: true, slot });
      }
      if (method === 'PUT' || method === 'POST') {
        assertMutatingRequestSafe(req);
        const body = await readBody(req);
        const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
        const payload = bodyObj && 'payload' in bodyObj ? bodyObj.payload : body;
        const expectedSavedAt = typeof bodyObj?.expectedSavedAt === 'string' ? bodyObj.expectedSavedAt : undefined;
        const slot = upsertSaveSlot(getDb(), slotId, payload, { expectedSavedAt });
        return sendJson(res, 200, { ok: true, slot });
      }
      if (method === 'DELETE') {
        assertMutatingRequestSafe(req);
        const deleted = deleteSaveSlot(getDb(), slotId);
        return sendJson(res, 200, { ok: true, deleted });
      }
    }

    return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
  } catch (error) {
    if (error instanceof SaveConflictError) return sendJson(res, 409, { ok: false, error: 'SAVE_CONFLICT' });
    if (error instanceof CorruptSaveError) return sendJson(res, 422, { ok: false, error: 'CORRUPT_SAVE' });
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'FORBIDDEN_ORIGIN') return sendJson(res, 403, { ok: false, error: message });
    if (message === 'UNSUPPORTED_CONTENT_TYPE') return sendJson(res, 415, { ok: false, error: message });
    if (message === 'PAYLOAD_TOO_LARGE') return sendJson(res, 413, { ok: false, error: message });
    if (error instanceof SyntaxError) return sendJson(res, 400, { ok: false, error: 'INVALID_JSON' });
    return sendJson(res, 500, { ok: false, error: 'INTERNAL_ERROR' });
  }
}

export function createServer(): http.Server {
  return http.createServer((req, res) => {
    void handleRequest(req, res);
  });
}

export function startServer(port = Number(process.env.PORT ?? 8787)): http.Server {
  const server = createServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`[the-bar-db] listening on http://127.0.0.1:${port}`);
  });
  const shutdown = () => {
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return server;
}
