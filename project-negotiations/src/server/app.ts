import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z, ZodError } from 'zod';
import type { NegotiationSession, ResponseIntent, SessionView } from '../shared/types.js';
import type { AIProvider } from '../shared/ai.js';
import { getCase, listCaseSummaries, toBriefing, toCaseSummary } from './cases/index.js';
import {
  getDb, getDebrief, getSkillSummaries, loadSessionState, saveDebrief, saveSessionState,
} from './db/index.js';
import {
  activateSession, applyParticipantResponses, applyPlayerMessage, createSessionState,
  EngineError, finalizeSession, recordTurnMetadata, savePreparation, skillRecordsFromDebrief,
  walkAway, type TurnResult,
} from './engine/index.js';
import { createProvider, DeterministicProvider, orchestrateTurn } from './ai/index.js';

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();
function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const b = rateBuckets.get(key);
  if (!b || now >= b.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count += 1;
  if (b.count > limit) throw new HttpError(429, 'Too many requests. Please slow down and try again shortly.');
}

const preparationSchema = z.object({
  objectives: z.string().max(4000).optional().default(''),
  batna: z.string().max(4000).optional().default(''),
  reservationPoint: z.string().max(4000).optional().default(''),
  openingPosition: z.string().max(4000).optional().default(''),
  leverage: z.string().max(4000).optional().default(''),
  concessions: z.string().max(4000).optional().default(''),
  questions: z.string().max(4000).optional().default(''),
  predictions: z.string().max(4000).optional().default(''),
  strategy: z.string().max(4000).optional().default(''),
});

const messageSchema = z.object({
  content: z.string().min(1, 'Message content is required.').max(4000),
  target: z.string().max(120).optional().default('group'),
  type: z.enum(['message', 'offer', 'counteroffer', 'accept', 'reject', 'withdraw', 'walk_away']).optional(),
  offerTerms: z.array(z.object({ issueId: z.string(), value: z.number() })).max(20).optional(),
  offerId: z.string().max(120).optional(),
  expectedStateVersion: z.number().int().positive().optional(),
});

function requireCase(id: string) {
  const caseDef = getCase(id);
  if (!caseDef) throw new HttpError(404, `Unknown case "${id}".`);
  return caseDef;
}

function requireSession(id: string): NegotiationSession {
  const session = loadSessionState(id);
  if (!session) throw new HttpError(404, `Unknown session "${id}".`);
  return session;
}

function checkVersion(session: NegotiationSession, expected?: number): void {
  if (expected !== undefined && expected !== session.stateVersion) {
    throw new HttpError(409, `State version mismatch: expected ${expected}, found ${session.stateVersion}. Retry with the current session state.`);
  }
}

/**
 * Best-effort extraction of the optional optimistic-concurrency field from a
 * request body. Absent/invalid values mean "no guard" (backward compatible).
 */
function requestVersion(body: unknown): number | undefined {
  const parsed = z.object({ expectedStateVersion: z.number().int().positive().optional() })
    .safeParse(body ?? {});
  return parsed.success ? parsed.data.expectedStateVersion : undefined;
}

/**
 * Lightweight per-IP guard for non-message mutations. This is NOT a security
 * boundary: it is in-process, resets on restart, and assumes a single instance
 * behind a trusted proxy. See docs/ARCHITECTURE.md and docs/DEPLOYMENT.md.
 */
function limitMutation(req: Request, action: string): void {
  rateLimit(`${action}:${req.ip}`, 200, 5 * 60_000);
}

function checkActive(session: NegotiationSession): void {
  if (session.status !== 'active' && session.status !== 'preparation') {
    throw new HttpError(409, `Session is "${session.status}"; activate it before sending messages.`);
  }
}

function view(session: NegotiationSession): SessionView {
  const caseDef = requireCase(session.caseId);
  return {
    ...session,
    case: toCaseSummary(caseDef),
    briefing: toBriefing(caseDef),
    messages: session.messages ?? [],
  };
}

/** Append new messages from one or more turns, then persist atomically. */
function commit(state: NegotiationSession, ...turns: TurnResult[]): NegotiationSession {
  state.messages = [...(state.messages ?? []), ...turns.flatMap((t) => t.messages)];
  saveSessionState(state);
  return state;
}

/** Per-session in-process lock: prevents two simultaneous turns on one session. */
const inFlight = new Set<string>();
async function withTurnLock<T>(sessionId: string, fn: () => T | Promise<T>): Promise<T> {
  if (inFlight.has(sessionId)) throw new HttpError(409, 'A turn is already in progress for this session.');
  inFlight.add(sessionId);
  try {
    return await fn();
  } finally {
    inFlight.delete(sessionId);
  }
}

export function createApp(provider: AIProvider = createProvider()): Express {
  getDb();
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // Dependency-free baseline hardening headers (see docs/DEPLOYMENT.md).
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
  });

  // Opt-in CORS allowlist. Off by default: the client is normally same-origin
  // (static build or Vite proxy). Set ALLOWED_ORIGINS (or FRONTEND_URL) when the
  // API and client are served from different origins. No cookies/auth tokens
  // are used, so there is no credentialed-CORS or CSRF surface here.
  const configuredOrigins = process.env.ALLOWED_ORIGINS ?? process.env.FRONTEND_URL ?? '';
  const allowedOrigins = configuredOrigins.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowedOrigins.length > 0) {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    });
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'the-negotiation-table', llm: provider.usesLLM, ts: new Date().toISOString() });
  });

  app.get('/api/cases', (_req, res) => res.json({ cases: listCaseSummaries() }));
  app.get('/api/cases/:id', (req, res) => res.json({ case: toBriefing(requireCase(req.params.id)) }));

  app.post('/api/sessions', (req, res) => {
    rateLimit(`create:${req.ip}`, 30, 10 * 60_000);
    const { caseId } = z.object({ caseId: z.string().min(1) }).parse(req.body);
    const caseDef = requireCase(caseId);
    const state = createSessionState(caseDef);
    state.messages = [];
    saveSessionState(state);
    res.status(201).json({ session: view(state) });
  });

  app.get('/api/sessions/:id', (req, res) => res.json({ session: view(requireSession(req.params.id)) }));

  app.post('/api/sessions/:id/activate', (req, res) =>
    withTurnLock(req.params.id, () => {
      limitMutation(req, 'activate');
      const session = requireSession(req.params.id);
      const body = z.object({
        skipPreparation: z.boolean().optional(),
        expectedStateVersion: z.number().int().positive().optional(),
      }).parse(req.body ?? {});
      checkVersion(session, body.expectedStateVersion);
      const turn = activateSession(session, { skipPreparation: body.skipPreparation ?? false });
      res.json({ session: view(commit(turn.state, turn)) });
    }),
  );

  app.post('/api/sessions/:id/preparation', (req, res) =>
    withTurnLock(req.params.id, () => {
      limitMutation(req, 'preparation');
      const session = requireSession(req.params.id);
      const body = req.body ?? {};
      checkVersion(session, requestVersion(body));
      const preparation = preparationSchema.parse(body.preparation ?? body);
      const turn = savePreparation(session, preparation);
      res.json({ session: view(commit(turn.state, turn)) });
    }),
  );

  app.post('/api/sessions/:id/messages', (req, res) =>
    withTurnLock(req.params.id, async () => {
      rateLimit(`msg:${req.ip}:${req.params.id}`, 60, 5 * 60_000);
      const started = Date.now();
      const session = requireSession(req.params.id);
      const input = messageSchema.parse(req.body);
      checkVersion(session, input.expectedStateVersion);
      checkActive(session);
      const caseDef = requireCase(session.caseId);

      const playerTurn = applyPlayerMessage(session, caseDef, input);
      const current = commit(playerTurn.state, playerTurn);

      let llmCalls = 0;
      let responses;
      try {
        responses = await orchestrateTurn({
          caseDef,
          state: current,
          messages: current.messages ?? [],
          playerIntent: (playerTurn.messages[0]?.meta?.intent as ResponseIntent | undefined) ?? input.type ?? 'message',
          provider,
          onLlmCall: () => { llmCalls += 1; },
        });
      } catch {
        responses = await orchestrateTurn({
          caseDef,
          state: current,
          messages: current.messages ?? [],
          playerIntent: input.type ?? 'message',
          provider: new DeterministicProvider(),
          onLlmCall: () => { llmCalls += 1; },
        });
      }

      const aiTurn = applyParticipantResponses(current, caseDef, responses);
      const source = responses.some((r) => r.source === 'llm') ? 'llm' : 'deterministic_fallback';
      const metaTurn = recordTurnMetadata(aiTurn.state, {
        turn: current.turnCount,
        responders: responses.map((r) => r.participantId),
        source,
        llmCalls,
        fallbackUsed: responses.some((r) => r.source === 'deterministic_fallback'),
        latencyMs: Date.now() - started,
      });
      const finalState = commit(metaTurn.state, aiTurn, metaTurn);
      res.json({
        session: view(finalState),
        messages: [...playerTurn.messages, ...aiTurn.messages],
        events: [...playerTurn.events, ...aiTurn.events, ...metaTurn.events],
      });
    }),
  );

  app.post('/api/sessions/:id/walk-away', (req, res) =>
    withTurnLock(req.params.id, () => {
      limitMutation(req, 'walk-away');
      const session = requireSession(req.params.id);
      checkVersion(session, requestVersion(req.body));
      if (session.status === 'completed' || ['full', 'walked_away', 'failed'].includes(session.agreementStatus)) {
        throw new HttpError(409, 'This negotiation has already ended.');
      }
      const caseDef = requireCase(session.caseId);
      const turn = walkAway(session, caseDef);
      res.json({ session: view(commit(turn.state, turn)), messages: turn.messages, events: turn.events });
    }),
  );

  app.post('/api/sessions/:id/finalize', (req, res) =>
    withTurnLock(req.params.id, () => {
      limitMutation(req, 'finalize');
      const session = requireSession(req.params.id);
      const existing = getDebrief(req.params.id);
      // Idempotent replay returns the cached debrief before any version guard,
      // so retrying finalize with the original expected version still succeeds.
      if (session.status === 'completed' && existing) {
        res.json({ session: view(session), debrief: existing });
        return;
      }
      checkVersion(session, requestVersion(req.body));
      if (session.status === 'briefing' || session.status === 'preparation') {
        throw new HttpError(409, 'Activate the session and run at least one turn before finalizing.');
      }
      const caseDef = requireCase(session.caseId);
      const result = finalizeSession(session, caseDef);
      const state = commit(result.state, result);
      saveDebrief(result.debrief, skillRecordsFromDebrief(result.debrief));
      res.json({ session: view(state), debrief: result.debrief });
    }),
  );

  app.get('/api/sessions/:id/debrief', (req, res) => {
    requireSession(req.params.id);
    const debrief = getDebrief(req.params.id);
    if (!debrief) throw new HttpError(404, 'No debrief exists for this session yet.');
    res.json({ debrief });
  });

  app.get('/api/skills', (_req, res) => res.json({ skills: getSkillSummaries() }));

  const clientDist = path.resolve(process.cwd(), 'dist/client');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({ error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
      return;
    }
    if (error instanceof EngineError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('[api] unexpected error', error);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
