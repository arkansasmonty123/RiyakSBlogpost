import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import crypto from 'crypto';
import {
  getUserByEmail,
  createUser,
  verifyUserPassword,
  getAllCases,
  getCaseById,
  getCharactersByCase,
  getInvestigationSuspicionLevels,
  getEvidenceByCase,
  getSafeEvidenceById,
  createInvestigation,
  getActiveInvestigation,
  abandonInvestigation,
  getInvestigationsArchive,
  getInvestigationById,
  updateInvestigation,
  addDiscoveredEvidence,
  createConversation,
  addMessage,
  getConversation,
  createJournalEntry,
  getJournalEntries,
  createScheduledEvent,
  getScheduledEvents,
  updateEventReleaseStatus,
  createAccusation,
  getAccusation,
  evaluateAccusation,
  awardAchievement,
  getAchievements,
  getCaseEvidenceCount,
  getAccusationCount,
  getWeeklyCollections,
  getCanonicalTruth,
  updateConversationMemory,
  createSession,
  getSessionByTokenHash,
  deleteSession,
  deleteExpiredSessions,
  hashSessionToken,
  getNotificationSettings,
  updateNotificationSettings,
  hashRateLimitKey,
  consumeRateLimit,
  deleteExpiredRateLimits,
  getSpecialistsByCase,
  getSpecialistByKey,
  getKnowledgeArtifactsByCase,
  getKnowledgeArtifactById,
  getKnowledgeDisagreementsByCase,
  getCaseKnowledgePack,
  createNotebookEntry,
  getNotebookEntries,
  updateNotebookEntry,
  deleteNotebookEntry,
  createClaim,
  getClaims,
  getClaimById,
  updateClaim,
  deleteClaim,
  createHypothesis,
  getHypotheses,
  getHypothesisById,
  updateHypothesis,
  deleteHypothesis,
  createLink,
  getLinks,
  getLinkById,
  findLinkByShape,
  updateLink,
  deleteLink,
  countRealityRows,
  resolveLinkTarget,
  deleteTutorialRealityExamples,
  type CanonicalTruth,
  type RealityClaim,
  type RealityHypothesis,
  type RealityMapLink,
  query,
} from './db';
import {
  KNOWLEDGE_LIMITS,
  isKnowledgeIntent,
  isKnowledgeDepth,
  isNotebookEntryType,
  toPublicSpecialist,
  toPublicArtifactSummary,
  toPublicArtifactDetail,
  toPublicDisagreement,
  toPublicNotebookEntry,
  toPublicCaseKnowledgePack,
  renderNotebookMarkdown,
  retrieveRelevantArtifacts,
  buildSpecialistContext,
  deterministicSpecialistReply,
  clip,
  type KnowledgeIntent,
  type KnowledgeDepth,
} from './knowledge';
import {
  GROUNDING_LIMITS,
  detectTeamRole,
  findAddressedSuspectNames,
  buildGroundedContext,
  deterministicReply,
  roleSystemHint,
  responderLabel,
  capResponse,
  type TeamRole,
  type SuspectContextInput,
} from './ai-grounding';
import {
  initializeProgression,
  processProgression,
  getCheckpointState,
  submitDeductionTheory,
  recordInvestigationAction,
  getDevelopments,
  runSchedulerSweep,
} from './mystery-engine';
import {
  REALITY_MAP_LIMITS,
  isClaimCategory,
  isConfidence,
  isHypothesisStatus,
  isRelationship,
  isLinkTargetType,
  isRealityMapOwnerType,
  isLinkShapeValid,
  isReviewFocus,
  toPublicClaim,
  toPublicHypothesis,
  toPublicLink,
  buildMaterialIndex,
  deriveTensions,
  buildReasoningAudit,
  buildHypothesisReviewContext,
  deterministicHypothesisReview,
  buildHypothesisComparison,
  REASONING_DISCLAIMER,
  type PublicClaim,
  type PublicHypothesis,
  type PublicLink,
  type MaterialIndex,
  type Tension,
} from './reality-map';
import {
  getReasoningPrompts,
  getTutorialScaffold,
  isRealityMapTutorialAvailable,
} from './reality-map-prompts';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const SESSION_COOKIE = 'session_token';
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(helmet());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined'));

// ---------------------------------------------------------------------------
// Rate limiting (QA-001 / GAP-11; P2-RATE-LIMITS)
// ---------------------------------------------------------------------------
// Fixed-window limiter backed by the `rate_limits` table. Counters survive
// process restarts and are shared across instances, so the same client IP is
// throttled consistently no matter which replica handles the request. The raw
// bucket key (which includes the client IP) is SHA-256 hashed before it reaches
// the DB; only the digest is persisted. The atomic INSERT ... ON CONFLICT DO
// UPDATE in consumeRateLimit() makes concurrent requests race-free.
//
// Dev/MVP defaults are deliberately generous so the local smoke suite (which
// registers many users from one IP) is not throttled; tighten the env values
// before a public deployment. RATE_LIMIT_ENABLED=false disables all limits for
// load tests / CI. A store error fails open (request allowed) with a log so a
// rate-limit DB hiccup cannot take down the API. For accurate client IPs behind
// a proxy, configure Express `trust proxy` in the deployment.

function readPositiveEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';
const AUTH_WINDOW_MS = readPositiveEnvInt('AUTH_RATE_WINDOW_MS', 15 * 60 * 1000);
const AUTH_MAX = readPositiveEnvInt('AUTH_RATE_MAX', 500);
const CHAT_WINDOW_MS = readPositiveEnvInt('CHAT_RATE_WINDOW_MS', 60 * 1000);
const CHAT_MAX = readPositiveEnvInt('CHAT_RATE_MAX', 120);
const WRITE_WINDOW_MS = readPositiveEnvInt('WRITE_RATE_WINDOW_MS', 60 * 1000);
const WRITE_MAX = readPositiveEnvInt('WRITE_RATE_MAX', 600);

function rateLimiter(name: string, windowMs: number, max: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!RATE_LIMIT_ENABLED) {
      next();
      return;
    }
    const identity = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const keyHash = hashRateLimitKey(`${name}:${identity}`);
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowMs);

    void consumeRateLimit(keyHash, now, resetAt)
      .then((state) => {
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - state.count)));
        if (state.count > max) {
          res.setHeader(
            'Retry-After',
            String(Math.max(1, Math.ceil((state.resetAt.getTime() - now.getTime()) / 1000)))
          );
          res.status(429).json({ error: 'Too many requests. Please try again later.' });
          return;
        }
        next();
      })
      .catch((err: unknown) => {
        // Fail open: a rate-limit store failure must not block legitimate
        // traffic. Surface it in logs so it is not silent in production.
        console.error(
          '[rate-limit] store error (failing open):',
          err instanceof Error ? err.message : String(err)
        );
        next();
      });
  };
}

const authLimiter = rateLimiter('auth', AUTH_WINDOW_MS, AUTH_MAX);
const chatLimiter = rateLimiter('chat', CHAT_WINDOW_MS, CHAT_MAX);
const writeLimiter = rateLimiter('write', WRITE_WINDOW_MS, WRITE_MAX);

// Prune expired windows so the table does not grow without bound. Best effort:
// sweep failures are logged and retried on the next tick.
const rateSweeper = setInterval(() => {
  void deleteExpiredRateLimits().catch((err: unknown) => {
    console.error(
      '[rate-limit] sweep error:',
      err instanceof Error ? err.message : String(err)
    );
  });
}, Math.min(AUTH_WINDOW_MS, CHAT_WINDOW_MS, WRITE_WINDOW_MS));
rateSweeper.unref();

// ---------------------------------------------------------------------------
// Async route / middleware helper
// ---------------------------------------------------------------------------
// Express 5 forwards rejected promises, but wrapping explicitly keeps every
// async handler (including authMiddleware itself) on one error path.
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
function asyncRoute(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ---------------------------------------------------------------------------
// Sessions (DB-backed; P2-SESSIONS)
// ---------------------------------------------------------------------------
// Sessions live in the `sessions` table, so they survive process restarts and
// are shared across instances. Only a SHA-256 digest of the random token is
// persisted; the raw token lives solely in the httpOnly `session_token` cookie.
// Rate-limit counters are likewise durable in the `rate_limits` table (see the
// rate-limiting section above).

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function setSessionCookie(res: Response, user: { id: string; email: string }): Promise<void> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL);
  await createSession(hashSessionToken(token), user.id, expiresAt);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL,
    path: '/',
  });
}

function getSessionToken(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return null;
}

// Only ever derives identity from the server-side session store.
const authMiddleware = asyncRoute(async (req: Request, res: Response, next: NextFunction) => {
  const token = getSessionToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  const session = await getSessionByTokenHash(hashSessionToken(token));
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) await deleteSession(session.tokenHash);
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  res.locals.userId = session.userId;
  res.locals.email = session.email;
  res.locals.sessionToken = token;
  next();
});

// Best-effort periodic cleanup of expired session rows (idempotent, unref'd so
// it never keeps the process alive). Expired rows are also removed lazily in
// authMiddleware when they are actually presented.
const sessionSweeper = setInterval(() => {
  void deleteExpiredSessions().catch((err) => console.error('session sweep failed:', err));
}, 60 * 60 * 1000);
sessionSweeper.unref();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Input validation (QA-001 / GAP-11)
// ---------------------------------------------------------------------------
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = readPositiveEnvInt('MIN_PASSWORD_LENGTH', 8);

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_EMAIL_LENGTH
    && EMAIL_PATTERN.test(value);
}

// Non-blank, bounded text used for all player-authored free-form fields.
function boundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

// Ownership guard for every /api/investigations/:investigationId/* route.
const requireOwnedInvestigation = asyncRoute(async (req: Request, res: Response, next: NextFunction) => {
  const investigationId = req.params.investigationId;
  if (!isUuid(investigationId)) {
    res.status(404).json({ error: 'Investigation not found' });
    return;
  }
  const investigation = await getInvestigationById(investigationId);
  if (!investigation) {
    res.status(404).json({ error: 'Investigation not found' });
    return;
  }
  if (investigation.userId !== res.locals.userId) {
    res.status(403).json({ error: 'Not your investigation' });
    return;
  }
  // Offline catch-up: time-triggered and newly eligible evidence is applied on
  // every owned-investigation request before the handler reads state. The
  // engine is idempotent and is a no-op when nothing is due.
  await processProgression(investigationId);
  const refreshed = await getInvestigationById(investigationId);
  res.locals.investigation = refreshed ?? investigation;
  next();
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post('/api/register', authLimiter, asyncRoute(async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== 'string') {
    res.status(400).json({ error: 'A valid email and password are required' });
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    res.status(400).json({
      error: `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`,
    });
    return;
  }
  if (await getUserByEmail(email)) {
    res.status(409).json({ error: 'User already exists' });
    return;
  }
  // db.createUser hashes the password internally (scrypt).
  const user = await createUser(email, password);
  await setSessionCookie(res, user);
  res.status(201).json({
    id: user.id,
    email: user.email,
    message: 'User registered successfully',
  });
}));

app.post('/api/login', authLimiter, asyncRoute(async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }
  const user = await verifyUserPassword(email, password);
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  await setSessionCookie(res, user);
  res.json({
    id: user.id,
    email: user.email,
    message: 'Login successful',
  });
}));

app.post('/api/logout', asyncRoute(async (req: Request, res: Response) => {
  const token = getSessionToken(req);
  if (token) await deleteSession(hashSessionToken(token));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ message: 'Logged out successfully' });
}));

app.get('/api/me', authMiddleware, (req: Request, res: Response) => {
  res.json({ id: res.locals.userId, email: res.locals.email });
});

// GAP-14 (P2): MVP in-app notification preferences. Auth is required; the
// identity always comes from the session, never the request body. Settings are
// stored in the existing users.notification_settings JSONB column and carry no
// canonical/hidden data.
app.get('/api/me/notification-settings', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  res.json(await getNotificationSettings(res.locals.userId));
}));

app.patch('/api/me/notification-settings', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  res.json(await updateNotificationSettings(res.locals.userId, req.body));
}));

// ---------------------------------------------------------------------------
// Case library
// ---------------------------------------------------------------------------

app.get('/api/cases', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  const filters: { genre?: string; difficulty?: string; duration?: string; search?: string } = {};
  if (typeof req.query.genre === 'string') filters.genre = req.query.genre;
  if (typeof req.query.difficulty === 'string') filters.difficulty = req.query.difficulty;
  if (typeof req.query.duration === 'string') filters.duration = req.query.duration;
  if (typeof req.query.search === 'string') filters.search = req.query.search;
  res.json(await getAllCases(filters));
}));

app.get('/api/cases/:caseId', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  const caseId = req.params.caseId;
  if (!isUuid(caseId)) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }
  const caseData = await getCaseById(caseId, res.locals.userId as string);
  if (!caseData) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }
  res.json(caseData);
}));

// Character data is public to authenticated players, but canonical/internal
// fields (secrets, knowledge, beliefs, relationships) are never exposed.
function toPublicCharacter(row: any) {
  return {
    id: row.id,
    caseId: row.caseId,
    name: row.name,
    role: row.role,
    personality: row.personality,
    background: row.background,
    alibi: row.alibi,
    confirmedAlibi: row.confirmedAlibi,
    dialogueConstraints: row.dialogueConstraints,
  };
}

// ---------------------------------------------------------------------------
// PROD-013 (GAP-08): safe suspect board projection
// ---------------------------------------------------------------------------
// The board enriches public character data with investigation context that is
// strictly player-owned: apparent motive, public relationship labels, evidence
// the player has actually seen, their own recorded suspicion, and spoiler-free
// questions to investigate. Internal character fields (knowledge, beliefs,
// secrets, hidden interpretation, hypothesis tags), AI direction and the
// canonical solution are never read or returned here. Every value below is
// copied through an explicit allowlist so a future schema change cannot leak
// a new private column by accident.

interface PublicSuspectRelationship {
  name: string;
  label: string;
}

interface PublicSuspectLinkedEvidence {
  id: string;
  source: string;
  category: string;
  timelineReference?: string;
  examined: boolean;
}

interface PublicSuspect {
  id: string;
  caseId: string;
  name: string;
  role: string;
  personality?: string;
  background?: string;
  alibi?: string;
  confirmedAlibi?: string;
  motive: string;
  relationships: PublicSuspectRelationship[];
  linkedEvidence: PublicSuspectLinkedEvidence[];
  linkedEvidenceCount: number;
  playerSuspicion: string | null;
  unansweredQuestions: string[];
}

interface PublicSuspectBoard {
  caseId: string;
  openQuestions: string[];
  suspects: PublicSuspect[];
}

// Character `motive` is authored as "Apparent: <public>. Hidden: <private>".
// Only the apparent portion is player-safe; everything from a hidden marker
// onward is stripped so the canonical motive can never surface on the board.
function toPublicMotive(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let text = raw.trim();
  const hiddenMarkers = [
    /hidden\s*:/i,
    /;\s*in fact\b/i,
    /,\s*in fact\b/i,
    /\.\s*in fact\b/i,
  ];
  let cut = text.length;
  for (const marker of hiddenMarkers) {
    const found = marker.exec(text);
    if (found) cut = Math.min(cut, found.index);
  }
  text = text.slice(0, cut);
  text = text.replace(/^apparent\s*:\s*/i, '').trim();
  text = text.replace(/[\s;,:.\-]+$/, '').trim();
  return text;
}

// Relationship values are short public labels (e.g. "sister", "business
// rival"). Copy only string keys/values - never nested/internal character data.
function toPublicRelationships(raw: unknown): PublicSuspectRelationship[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const out: PublicSuspectRelationship[] = [];
  for (const [name, label] of Object.entries(raw)) {
    if (typeof label === 'string' && label.trim()) {
      out.push({ name, label: label.trim() });
    }
  }
  return out;
}

function characterNameIn(raw: unknown, name: string): boolean {
  const target = name.trim().toLowerCase();
  if (!target) return false;
  if (typeof raw === 'string') {
    return raw.split(',').map((part) => part.trim().toLowerCase()).includes(target);
  }
  if (Array.isArray(raw)) {
    return raw.some((part) => typeof part === 'string' && part.trim().toLowerCase() === target);
  }
  return false;
}

// Build the whole board from already-sourced, player-visible inputs. This
// function never queries canonical_truth and never reads a hidden character
// field, so the result is safe to send to any authenticated owner.
function toPublicSuspectBoard(params: {
  caseId: string;
  characters: any[];
  visibleEvidence: any[];
  suspicionLevels: Record<string, string>;
  discoveredIds: string[];
  openQuestions: string[];
}): PublicSuspectBoard {
  const discovered = new Set(params.discoveredIds);
  const suspects: PublicSuspect[] = params.characters.map((row) => {
    const name = String(row.name ?? '');
    const id = String(row.id ?? '');
    const linkedEvidence: PublicSuspectLinkedEvidence[] = params.visibleEvidence
      .filter((ev) => characterNameIn(ev.associatedCharacters, name))
      .map((ev) => ({
        id: String(ev.id),
        source: String(ev.source ?? ''),
        category: String(ev.category ?? ''),
        ...(typeof ev.timelineReference === 'string' && ev.timelineReference
          ? { timelineReference: ev.timelineReference }
          : {}),
        examined: discovered.has(String(ev.id)),
      }));

    const relationships = toPublicRelationships(row.relationships);
    const alibi = typeof row.alibi === 'string' ? row.alibi : '';
    const confirmedAlibi = typeof row.confirmedAlibi === 'string' ? row.confirmedAlibi : '';

    // Spoiler-free prompts derived only from the safe fields above.
    const unansweredQuestions: string[] = [];
    if (relationships.length > 0) {
      unansweredQuestions.push(`What is ${name}'s relationship to the people involved?`);
    }
    if (alibi) {
      unansweredQuestions.push(`Can ${name}'s alibi be independently confirmed?`);
    }
    if (linkedEvidence.length > 0) {
      unansweredQuestions.push(`Which linked evidence connects ${name} to the timeline?`);
    }
    if (unansweredQuestions.length === 0) {
      unansweredQuestions.push(`What motive could ${name} have?`);
    }

    return {
      id,
      caseId: String(row.caseId ?? params.caseId),
      name,
      role: String(row.role ?? ''),
      personality: typeof row.personality === 'string' ? row.personality : undefined,
      background: typeof row.background === 'string' ? row.background : undefined,
      alibi: alibi || undefined,
      confirmedAlibi: confirmedAlibi || undefined,
      motive: toPublicMotive(row.motive),
      relationships,
      linkedEvidence,
      linkedEvidenceCount: linkedEvidence.length,
      playerSuspicion: params.suspicionLevels[name] ?? params.suspicionLevels[id] ?? null,
      unansweredQuestions,
    };
  });

  return {
    caseId: params.caseId,
    openQuestions: params.openQuestions,
    suspects,
  };
}

app.get('/api/cases/:caseId/characters', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  const caseId = req.params.caseId;
  if (!isUuid(caseId)) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }
  const characters = await getCharactersByCase(caseId);
  res.json(characters.map(toPublicCharacter));
}));

// Evidence is visibility-filtered by db.getEvidenceByCase: only playerVisible
// items plus evidence discovered/released in the player's owned investigations
// (active OR completed) are returned, so the archive keeps revealed evidence.
// Hidden interpretation/hypothesis fields are never selected.
app.get('/api/cases/:caseId/evidence', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  const caseId = req.params.caseId;
  if (!isUuid(caseId)) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }
  res.json(await getEvidenceByCase(caseId, res.locals.userId as string));
}));

// ---------------------------------------------------------------------------
// M2 knowledge routes (case-scoped; require auth + an existing case).
// All responses are built from safe DTO allowlists in src/knowledge.ts. These
// routes never read canonical truth or hidden evidence fields.
// ---------------------------------------------------------------------------

async function caseExists(caseId: string): Promise<boolean> {
  const result = await query('SELECT 1 FROM cases WHERE id = $1 LIMIT 1', [caseId]);
  return result.rows.length > 0;
}

app.get('/api/cases/:caseId/specialists', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  const caseId = req.params.caseId;
  if (!isUuid(caseId) || !(await caseExists(caseId))) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }
  const specialists = await getSpecialistsByCase(caseId);
  res.json(specialists.map(toPublicSpecialist));
}));

app.get('/api/cases/:caseId/artifacts', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  const caseId = req.params.caseId;
  if (!isUuid(caseId) || !(await caseExists(caseId))) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }
  const artifacts = await getKnowledgeArtifactsByCase(caseId);
  // List uses the summary DTO only: no `content`, no unverified source URL.
  res.json(artifacts.map(toPublicArtifactSummary));
}));

app.get('/api/cases/:caseId/artifacts/:artifactId', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  const { caseId, artifactId } = req.params;
  if (!isUuid(caseId) || !isUuid(artifactId) || !(await caseExists(caseId))) {
    res.status(404).json({ error: 'Artifact not found' });
    return;
  }
  // Passing caseId scopes the lookup: an artifact belonging to another case is
  // indistinguishable from a missing one.
  const artifact = await getKnowledgeArtifactById(artifactId, caseId);
  if (!artifact) {
    res.status(404).json({ error: 'Artifact not found' });
    return;
  }
  res.json(toPublicArtifactDetail(artifact));
}));

app.get('/api/cases/:caseId/disagreements', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  const caseId = req.params.caseId;
  if (!isUuid(caseId) || !(await caseExists(caseId))) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }
  const disagreements = await getKnowledgeDisagreementsByCase(caseId);
  res.json(disagreements.map(toPublicDisagreement));
}));

// M3: safe per-case knowledge-pack metadata with simple content counts. A case
// without a pack returns 404; callers treat that as "no pack for this case".
app.get('/api/cases/:caseId/knowledge-pack', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  const caseId = req.params.caseId;
  if (!isUuid(caseId) || !(await caseExists(caseId))) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }
  const pack = await getCaseKnowledgePack(caseId);
  if (!pack) {
    res.status(404).json({ error: 'Knowledge pack not found' });
    return;
  }
  const [specialists, artifacts, disagreements] = await Promise.all([
    getSpecialistsByCase(caseId),
    getKnowledgeArtifactsByCase(caseId),
    getKnowledgeDisagreementsByCase(caseId),
  ]);
  res.json({
    ...toPublicCaseKnowledgePack(pack),
    counts: {
      specialists: specialists.length,
      artifacts: artifacts.length,
      disagreements: disagreements.length,
    },
  });
}));

app.get('/api/evidence/:evidenceId', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  const evidenceId = req.params.evidenceId;
  if (!isUuid(evidenceId)) {
    res.status(404).json({ error: 'Evidence not found' });
    return;
  }
  const evidence = await getSafeEvidenceById(evidenceId);
  if (!evidence) {
    res.status(404).json({ error: 'Evidence not found' });
    return;
  }
  let visible = evidence.playerVisible === true;
  if (!visible) {
    const active = await getActiveInvestigation(res.locals.userId as string);
    if (active && active.caseId === evidence.caseId) {
      const discovered = Array.isArray(active.discoveredEvidenceIds) ? active.discoveredEvidenceIds : [];
      visible = discovered.includes(evidenceId);
    }
  }
  if (!visible) {
    res.status(404).json({ error: 'Evidence not found' });
    return;
  }
  // getSafeEvidenceById already omits hiddenInterpretation/supportedHypotheses/
  // contradictedHypotheses; respond with that projection only.
  res.json(evidence);
}));

// ---------------------------------------------------------------------------
// Investigations
// ---------------------------------------------------------------------------

app.post('/api/investigations', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  const caseId = req.body?.caseId;
  if (!caseId) {
    res.status(400).json({ error: 'caseId required' });
    return;
  }
  if (!isUuid(caseId)) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }
  const caseResult = await query('SELECT id FROM cases WHERE id = $1', [caseId]);
  if (caseResult.rows.length === 0) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }
  const userId = res.locals.userId as string;
  if (await getActiveInvestigation(userId)) {
    res.status(409).json({ error: 'User already has an active investigation' });
    return;
  }
  const investigation = await createInvestigation(userId, caseId);
  // Seed authored time-triggered developments for this investigation (MVP:
  // persisted scheduled events, processed by catch-up and the in-process sweep).
  await initializeProgression(investigation.id);
  res.status(201).json(investigation);
}));

app.get('/api/investigations/active', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  const existing = await getActiveInvestigation(res.locals.userId as string);
  if (existing) await processProgression(existing.id);
  const investigation = existing ? await getInvestigationById(existing.id) : null;
  if (!investigation) {
    res.status(404).json({ error: 'No active investigation found' });
    return;
  }
  res.json(investigation);
}));

// Player-facing archive of completed / paused investigations. Registered
// before the `/:investigationId` router so "archive" is not parsed as an id.
app.get('/api/investigations/archive', authMiddleware, asyncRoute(async (req: Request, res: Response) => {
  res.json(await getInvestigationsArchive(res.locals.userId as string));
}));

// All routes below are scoped to an owned investigation.
const investigationRouter = express.Router({ mergeParams: true });
investigationRouter.use(authMiddleware);
investigationRouter.use(requireOwnedInvestigation);

// Load a specific owned investigation by id (also used by archive/verdict views
// after the investigation is no longer "active"). Contains no canonical data.
investigationRouter.get('/', (_req: Request, res: Response) => {
  res.json(res.locals.investigation);
});

// P2-POLISH: compact, player-safe stats summary for an owned investigation.
// Mounted on investigationRouter, so auth + ownership + offline progression
// catch-up are already applied before we read state. Every field is a count,
// percentage, status label or timestamp derived from this player's own data;
// canonical truth and hidden evidence are never read here. The DTO is built
// with an explicit allowlist so a future schema change cannot leak a new
// private column by accident.
investigationRouter.get('/stats', asyncRoute(async (req: Request, res: Response) => {
  const investigation = res.locals.investigation;
  const caseId = String(investigation.caseId);
  const discoveredIds = Array.isArray(investigation.discoveredEvidenceIds)
    ? investigation.discoveredEvidenceIds.map(String)
    : [];
  const [evidenceTotal, accusationCount, checkpointState, achievements] = await Promise.all([
    getCaseEvidenceCount(caseId),
    getAccusationCount(investigation.id),
    getCheckpointState(investigation.id),
    getAchievements(investigation.id),
  ]);

  const startedMs = investigation.startTimestamp
    ? new Date(investigation.startTimestamp).getTime()
    : Number.NaN;
  const endMs = investigation.completionTimestamp
    ? new Date(investigation.completionTimestamp).getTime()
    : Date.now();
  const elapsedSeconds = Number.isFinite(startedMs) && Number.isFinite(endMs) && endMs >= startedMs
    ? Math.floor((endMs - startedMs) / 1000)
    : 0;

  res.json({
    evidence: {
      discovered: discoveredIds.length,
      total: evidenceTotal,
    },
    accusations: accusationCount,
    checkpoints: {
      answered: checkpointState.completedCheckpoints.length,
      total: checkpointState.checkpoints.length,
    },
    achievements: achievements.length,
    progress: Number(investigation.progress) || 0,
    status: investigation.status ?? null,
    elapsedSeconds,
    startedAt: investigation.startTimestamp
      ? new Date(investigation.startTimestamp).toISOString()
      : null,
    completedAt: investigation.completionTimestamp
      ? new Date(investigation.completionTimestamp).toISOString()
      : null,
  });
}));

// PROD-013 (GAP-08): enriched suspect board. Mounted on investigationRouter,
// so authentication and ownership are verified before any data is read. Linked
// evidence comes from getEvidenceByCase, which only returns player-visible
// items plus evidence discovered/released in this user's own investigations
// for the case - hidden evidence and another player's discoveries are excluded.
investigationRouter.get('/suspects', asyncRoute(async (req: Request, res: Response) => {
  const investigation = res.locals.investigation;
  const caseId = String(investigation.caseId);
  const [characters, visibleEvidence, suspicionLevels, checkpointState] = await Promise.all([
    getCharactersByCase(caseId),
    getEvidenceByCase(caseId, res.locals.userId as string),
    getInvestigationSuspicionLevels(investigation.id),
    getCheckpointState(investigation.id),
  ]);
  const discoveredIds = Array.isArray(investigation.discoveredEvidenceIds)
    ? investigation.discoveredEvidenceIds.map(String)
    : [];
  res.json(toPublicSuspectBoard({
    caseId,
    characters,
    visibleEvidence,
    suspicionLevels,
    discoveredIds,
    openQuestions: checkpointState.checkpoints
      .filter((cp) => !cp.completed)
      .map((cp) => cp.prompt),
  }));
}));

// Only player-authored notes are client-writable. Status, progress, stage and
// pending events are part of the server-owned state machine and are ignored even
// if a client sends them (no 400 needed - legacy clients keep working).
investigationRouter.patch('/', asyncRoute(async (req: Request, res: Response) => {
  const data: Record<string, string> = {};
  for (const key of ['currentTheory', 'suspicionLevel'] as const) {
    const value = req.body?.[key];
    if (typeof value === 'string') data[key] = value;
  }
  res.json(await updateInvestigation(res.locals.investigation.id, data));
}));

// PROD-012 (GAP-10): abandon an investigation to release the one-active-case
// lock. The router has already verified authentication and ownership before
// reaching this handler. Abandoning is destructive from the player's point of
// view, so BOTH the client and the API must supply an explicit confirmation
// flag; a missing/incorrect value is a 400 and changes nothing.
//
// Completed cases are protected: their verdict, solution reveal and archive
// semantics are final and must never be overwritten by an abandon. Everything
// else (active, accusationFailed/legacy) may be abandoned; the row is only
// marked `abandoned` - evidence, journal, conversation and accusations are
// preserved for history, and getActiveInvestigation never matches the new
// status, so the player can immediately start a fresh investigation.
investigationRouter.post('/abandon', asyncRoute(async (req: Request, res: Response) => {
  if (req.body?.confirm !== true) {
    res.status(400).json({ error: 'Explicit confirmation is required to abandon an investigation' });
    return;
  }

  const currentStatus = res.locals.investigation?.status;
  if (currentStatus === 'completed' || currentStatus === 'abandoned') {
    res.status(409).json({
      error: currentStatus === 'completed'
        ? 'Completed investigations cannot be abandoned'
        : 'Investigation is already abandoned',
    });
    return;
  }

  // The conditional UPDATE in db.ts re-checks the status atomically, covering
  // a concurrent correct verdict between the guard above and this write.
  const abandoned = await abandonInvestigation(res.locals.investigation.id);
  if (!abandoned) {
    res.status(409).json({ error: 'Investigation can no longer be abandoned' });
    return;
  }
  // Safe investigation DTO only - no canonical truth is read or returned.
  res.json(abandoned);
}));

investigationRouter.post('/discover-evidence', asyncRoute(async (req: Request, res: Response) => {
  const evidenceId = req.body?.evidenceId;
  if (!evidenceId) {
    res.status(400).json({ error: 'evidenceId required' });
    return;
  }
  if (!isUuid(evidenceId)) {
    res.status(404).json({ error: 'Evidence not found' });
    return;
  }
  const evidence = await getSafeEvidenceById(evidenceId);
  if (!evidence || evidence.caseId !== res.locals.investigation.caseId) {
    res.status(404).json({ error: 'Evidence not found for this investigation' });
    return;
  }
  // Hidden evidence is never discoverable by ID from the client. A future
  // release engine would mark evidence playerVisible server-side (or write the
  // discovered id itself) before it could be reached through this endpoint.
  if (evidence.playerVisible !== true) {
    res.status(404).json({ error: 'Evidence not found for this investigation' });
    return;
  }
  const updated = await addDiscoveredEvidence(res.locals.investigation.id, evidenceId);
  if (!updated) {
    res.status(404).json({ error: 'Investigation not found' });
    return;
  }
  const discoveredCount = Array.isArray(updated.discoveredEvidenceIds)
    ? updated.discoveredEvidenceIds.length
    : 0;
  if (discoveredCount === 1) {
    await awardAchievement(res.locals.investigation.id, 'first_evidence');
  }
  res.json(updated);
}));

investigationRouter.post('/conversation', asyncRoute(async (req: Request, res: Response) => {
  const participants = req.body?.participants;
  if (!Array.isArray(participants)) {
    res.status(400).json({ error: 'participants array required' });
    return;
  }
  res.status(201).json(await createConversation(res.locals.investigation.id, participants));
}));

investigationRouter.get('/conversation', asyncRoute(async (req: Request, res: Response) => {
  const conversation = await getConversation(res.locals.investigation.id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  res.json(conversation);
}));

// Only player-authored messages are client-writable. The `investigator` role
// (and any other role) is server-owned: AI replies are written by /chat via
// addMessage directly. A client must never be able to inject dialogue as the
// investigator or as any other participant.
const ALLOWED_CLIENT_MESSAGE_ROLES = new Set(['player']);

investigationRouter.post('/messages', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  const { role, content } = req.body || {};
  if (typeof role !== 'string' || !ALLOWED_CLIENT_MESSAGE_ROLES.has(role) || !boundedText(content, 10_000)) {
    res.status(400).json({ error: "role must be 'player' and content must be 1-10000 characters" });
    return;
  }
  res.status(201).json(await addMessage(res.locals.investigation.id, 'player', content));
}));

investigationRouter.post('/journal', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  const { entryType, content, relatedEvidenceIds, isConfirmed } = req.body || {};
  if (!boundedText(entryType, 100) || !boundedText(content, 10_000)) {
    res.status(400).json({ error: 'entryType (max 100) and content (max 10000) required' });
    return;
  }
  const data: {
    entryType: string;
    content: string;
    relatedEvidenceIds?: string[];
    isConfirmed?: boolean;
  } = { entryType, content };
  if (Array.isArray(relatedEvidenceIds)) {
    if (relatedEvidenceIds.length > 100 || !relatedEvidenceIds.every((id) => typeof id === 'string')) {
      res.status(400).json({ error: 'relatedEvidenceIds must be at most 100 string ids' });
      return;
    }
    data.relatedEvidenceIds = relatedEvidenceIds as string[];
  }
  if (typeof isConfirmed === 'boolean') data.isConfirmed = isConfirmed;
  res.status(201).json(await createJournalEntry(res.locals.investigation.id, data));
}));

investigationRouter.get('/journal', asyncRoute(async (req: Request, res: Response) => {
  res.json(await getJournalEntries(res.locals.investigation.id));
}));

// PROD-008: project scheduled events to a safe DTO. associatedEvidence and
// triggerCondition are server-only (they can reference unreleased evidence).
investigationRouter.get('/scheduled-events', asyncRoute(async (req: Request, res: Response) => {
  const events = await getScheduledEvents(res.locals.investigation.id);
  res.json(events.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    scheduledTimestamp: event.scheduledTimestamp,
    releaseStatus: event.releaseStatus,
    narrativePayload: event.narrativePayload ?? {},
  })));
}));

investigationRouter.post('/events', asyncRoute(async (req: Request, res: Response) => {
  const { eventType, triggerCondition, scheduledTimestamp } = req.body || {};
  if (typeof eventType !== 'string' || !eventType || !scheduledTimestamp) {
    res.status(400).json({ error: 'eventType and scheduledTimestamp required' });
    return;
  }
  const timestamp = new Date(scheduledTimestamp);
  if (Number.isNaN(timestamp.getTime())) {
    res.status(400).json({ error: 'invalid scheduledTimestamp' });
    return;
  }
  // PROD-008 safety: the client may schedule a reminder but may never attach
  // evidence or author narrative content to it. Only the server-authored
  // progression engine links events to evidence and writes development text.
  res.status(201).json(await createScheduledEvent(res.locals.investigation.id, {
    eventType,
    triggerCondition: triggerCondition ?? {},
    scheduledTimestamp: timestamp,
    narrativePayload: { title: 'Scheduled development', message: 'A scheduled development has been noted.' },
  }));
}));

investigationRouter.patch('/events/:eventId', asyncRoute(async (req: Request, res: Response) => {
  const eventId = req.params.eventId;
  const releaseStatus = req.body?.releaseStatus;
  if (!isUuid(eventId) || typeof releaseStatus !== 'string' || !releaseStatus) {
    res.status(400).json({ error: 'eventId and releaseStatus required' });
    return;
  }
  // PROD-008 safety: release/processed are engine-owned transition states.
  if (releaseStatus === 'released' || releaseStatus === 'processed') {
    res.status(403).json({ error: 'Event release status is controlled by the progression engine' });
    return;
  }
  const eventResult = await query('SELECT investigation_id FROM scheduled_events WHERE id = $1', [eventId]);
  if (eventResult.rows.length === 0 || eventResult.rows[0].investigation_id !== res.locals.investigation.id) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  const updated = await updateEventReleaseStatus(eventId, releaseStatus);
  // Same safe projection as GET: never echo associatedEvidence/triggerCondition.
  res.json(updated ? {
    id: updated.id,
    eventType: updated.eventType,
    scheduledTimestamp: updated.scheduledTimestamp,
    releaseStatus: updated.releaseStatus,
    narrativePayload: updated.narrativePayload ?? {},
  } : null);
}));

// ---------------------------------------------------------------------------
// PROD-008: async progression endpoints
// ---------------------------------------------------------------------------

// Spoiler-free checkpoint/action state + pending development count.
investigationRouter.get('/checkpoints', asyncRoute(async (req: Request, res: Response) => {
  res.json(await getCheckpointState(res.locals.investigation.id));
}));

// Player-facing development feed used for offline catch-up in the UI.
investigationRouter.get('/developments', asyncRoute(async (req: Request, res: Response) => {
  res.json(await getDevelopments(res.locals.investigation.id));
}));

// Submit a theory at a deduction checkpoint. The engine evaluates it using only
// player-visible evidence, stores the checkpoint, and releases eligible evidence.
investigationRouter.post('/theory', asyncRoute(async (req: Request, res: Response) => {
  const { checkpointId, theory, supportingEvidence, confidence } = req.body || {};
  if (typeof checkpointId !== 'string' || typeof theory !== 'string' || !theory.trim()) {
    res.status(400).json({ error: 'checkpointId and theory required' });
    return;
  }
  const result = await submitDeductionTheory(res.locals.investigation.id, {
    checkpointId,
    theory,
    supportingEvidence: Array.isArray(supportingEvidence) ? supportingEvidence.map(String) : [],
    ...(typeof confidence === 'string' ? { confidence } : {}),
  });
  if (!result) {
    res.status(400).json({ error: 'Unknown checkpoint or investigation is no longer active' });
    return;
  }
  res.json(result);
}));

// Perform an authored investigative action (investigation-triggered release).
investigationRouter.post('/investigate', asyncRoute(async (req: Request, res: Response) => {
  const action = req.body?.action;
  if (typeof action !== 'string' || !action.trim()) {
    res.status(400).json({ error: 'action required' });
    return;
  }
  const result = await recordInvestigationAction(res.locals.investigation.id, action);
  if (!result) {
    res.status(400).json({ error: 'Unknown investigative action or investigation is no longer active' });
    return;
  }
  res.json(result);
}));

investigationRouter.post('/accusation', asyncRoute(async (req: Request, res: Response) => {
  const { submittedCulprit, motive, method, supportingEvidence } = req.body || {};
  if (typeof submittedCulprit !== 'string' || typeof motive !== 'string' ||
      typeof method !== 'string' || !submittedCulprit || !motive || !method) {
    res.status(400).json({ error: 'submittedCulprit, motive, and method required' });
    return;
  }
  res.status(201).json(await createAccusation(res.locals.investigation.id, {
    submittedCulprit,
    motive,
    method,
    supportingEvidence: Array.isArray(supportingEvidence) ? supportingEvidence : [],
  }));
}));

investigationRouter.get('/accusation', asyncRoute(async (req: Request, res: Response) => {
  const accusation = await getAccusation(res.locals.investigation.id);
  if (!accusation) {
    res.status(404).json({ error: 'No accusation found' });
    return;
  }
  res.json(accusation);
}));

// Deterministic evaluation lives entirely in db.ts (canonical_truth wiring).
// The response contains the verdict only - never canonical truth values.
investigationRouter.post('/evaluate-accusation', asyncRoute(async (req: Request, res: Response) => {
  const { culprit, motive, method, supportingEvidence } = req.body || {};
  if (typeof culprit !== 'string' || !culprit) {
    res.status(400).json({ error: 'culprit required' });
    return;
  }
  // A solved investigation is final; a client must not be able to reopen it by
  // submitting another accusation (status is server-authoritative).
  if (res.locals.investigation.status === 'completed') {
    res.status(409).json({ error: 'Investigation already completed' });
    return;
  }
  const verdict = await evaluateAccusation(
    res.locals.investigation.id,
    culprit,
    typeof motive === 'string' ? motive : '',
    typeof method === 'string' ? method : '',
    Array.isArray(supportingEvidence) ? supportingEvidence : [],
  );

  // PROD-010: translate the server-authoritative integrity state into HTTP.
  // Canonical truth is never part of these responses - only generic status,
  // attempt count and cooldown timing are exposed to the player.
  if (verdict.status === 'completed') {
    res.status(409).json({ error: verdict.message, status: verdict.status });
    return;
  }
  if (verdict.status === 'not_ready') {
    res.status(409).json({
      error: verdict.message,
      status: verdict.status,
      readiness: verdict.readiness,
      attempts: verdict.attempts,
    });
    return;
  }
  if (verdict.status === 'cooldown') {
    res.setHeader('Retry-After', String(Math.max(1, verdict.retryAfterSeconds)));
    res.status(429).json({
      error: `Accusations are temporarily unavailable. Try again in ${verdict.retryAfterSeconds}s.`,
      status: verdict.status,
      retryAfterSeconds: verdict.retryAfterSeconds,
      cooldownUntil: verdict.cooldownUntil,
      attempts: verdict.attempts,
    });
    return;
  }

  // Achievements are granted here, from the verdict, never from the request.
  if (verdict.evaluationResult === 'correct') {
    await awardAchievement(res.locals.investigation.id, 'case_solved');
  }
  res.json(verdict);
}));

// ---------------------------------------------------------------------------
// Post-resolution solution reveal (PROD-009 / GAP-03 / MVP 16)
// ---------------------------------------------------------------------------
//
// The complete canonical solution is SERVER-ONLY until an investigation is
// actually completed. This route is the single, narrow read path that turns
// canonical_truth into a player-safe DTO. It is mounted on investigationRouter,
// so authMiddleware + requireOwnedInvestigation already guarantee the caller
// owns this investigation. Two independent gates prevent premature disclosure:
//   1. status === 'completed' (only a correct server-evaluated verdict sets it)
//   2. a canonical_truth row must exist for the case
// The DTO is built with an explicit allowlist: hidden_events and any other
// internal fields are never copied, so they cannot leak through a future
// schema change.

interface PublicSolutionRedHerring {
  label: string;
  apparentMeaning?: string;
  actualExplanation?: string;
  resolvedBy?: string;
}

interface PublicSolutionTheory {
  title: string;
  summary: string;
  whyPlausible?: string;
  disprovenBy?: string[];
  resolution?: string;
}

interface PublicSolutionTimelineEntry {
  seq?: number;
  time?: string;
  event?: string;
  participants?: string[];
  evidence?: string[];
}

interface PublicSolution {
  culprit: string;
  motive: string;
  method: string;
  solutionExplanation: string;
  redHerrings: PublicSolutionRedHerring[];
  alternativeTheories: PublicSolutionTheory[];
  clueResolutions: Array<{ clue: string; resolution: string }>;
  actualTimeline: PublicSolutionTimelineEntry[];
}

// Copy only whitelisted keys from an untrusted JSONB timeline entry.
function toPublicTimelineEntry(entry: any): PublicSolutionTimelineEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  const out: PublicSolutionTimelineEntry = {};
  if (typeof entry.seq === 'number') out.seq = entry.seq;
  if (typeof entry.time === 'string') out.time = entry.time;
  if (typeof entry.event === 'string') out.event = entry.event;
  if (Array.isArray(entry.participants)) {
    out.participants = entry.participants.map((p: unknown) => String(p));
  }
  if (Array.isArray(entry.evidence)) {
    out.evidence = entry.evidence.map((e: unknown) => String(e));
  }
  return out;
}

// Never attach the raw CanonicalTruth object (or hiddenEvents) to a response.
function toPublicSolution(ct: CanonicalTruth): PublicSolution {
  const redHerrings: PublicSolutionRedHerring[] = Array.isArray(ct.redHerrings)
    ? ct.redHerrings.map((rh) => {
        const out: PublicSolutionRedHerring = { label: String(rh?.label ?? '') };
        const apparent = rh?.apparentMeaning ?? rh?.apparent_meaning;
        const actual = rh?.actualExplanation ?? rh?.actual_explanation;
        const resolved = rh?.resolvedBy ?? rh?.resolved_by;
        if (typeof apparent === 'string') out.apparentMeaning = apparent;
        if (typeof actual === 'string') out.actualExplanation = actual;
        if (typeof resolved === 'string') out.resolvedBy = resolved;
        return out;
      })
    : [];

  const alternativeTheories: PublicSolutionTheory[] = Array.isArray(ct.alternativeTheories)
    ? ct.alternativeTheories.map((t) => {
        const out: PublicSolutionTheory = {
          title: String(t?.title ?? ''),
          summary: String(t?.summary ?? ''),
        };
        const whyPlausible = t?.whyPlausible ?? t?.why_plausible;
        const disprovenBy = t?.disprovenBy ?? t?.disproven_by;
        if (typeof whyPlausible === 'string') out.whyPlausible = whyPlausible;
        if (typeof t?.resolution === 'string') out.resolution = t.resolution;
        if (Array.isArray(disprovenBy)) {
          out.disprovenBy = disprovenBy.map((d: unknown) => String(d));
        }
        return out;
      })
    : [];

  const clueResolutions: Array<{ clue: string; resolution: string }> = [];
  if (ct.clueResolutions && typeof ct.clueResolutions === 'object' && !Array.isArray(ct.clueResolutions)) {
    for (const [clue, resolution] of Object.entries(ct.clueResolutions)) {
      clueResolutions.push({ clue, resolution: String(resolution) });
    }
  }

  const actualTimeline: PublicSolutionTimelineEntry[] = Array.isArray(ct.actualTimeline)
    ? ct.actualTimeline
        .map(toPublicTimelineEntry)
        .filter((entry): entry is PublicSolutionTimelineEntry => entry !== null)
    : [];

  return {
    culprit: String(ct.culprit ?? ''),
    motive: String(ct.motive ?? ''),
    method: String(ct.method ?? ''),
    solutionExplanation: String(ct.solutionExplanation ?? ''),
    redHerrings,
    alternativeTheories,
    clueResolutions,
    actualTimeline,
  };
}

investigationRouter.get('/solution', asyncRoute(async (_req: Request, res: Response) => {
  const investigation = res.locals.investigation;
  if (investigation.status !== 'completed') {
    // Intentionally vague: do not confirm whether a solution even exists.
    res.status(403).json({ error: 'The full solution is available only after this investigation is completed.' });
    return;
  }
  const canonical = await getCanonicalTruth(investigation.caseId as string);
  if (!canonical) {
    res.status(404).json({ error: 'Solution is not available for this case.' });
    return;
  }
  res.json(toPublicSolution(canonical));
}));

// AI Investigator chat endpoint (PROD-014 / GAP-09: grounded + bounded)
// ---------------------------------------------------------------------------
// Every input below is player-visible and server-derived. Role selection,
// suspect projection, rolling summary and retrieval all happen here on the
// server; the client only supplies `message`. Canonical truth and hidden
// character fields are never read on this path, so they cannot leak through a
// local LLM response or the deterministic fallback.
investigationRouter.post('/chat', chatLimiter, asyncRoute(async (req: Request, res: Response) => {
  const { message, specialistKey, targetSpecialistKey } = req.body || {};
  const intentRaw = req.body?.intent;
  const depthRaw = req.body?.depth;
  if (!boundedText(message, KNOWLEDGE_LIMITS.maxMessageChars)) {
    res.status(400).json({ error: 'message required (1-4000 characters)' });
    return;
  }

  // M2 optional fields are strictly allowlisted/bounded. When absent, the
  // legacy team-role conversation path is used with byte-identical behaviour.
  if (intentRaw !== undefined && !isKnowledgeIntent(intentRaw)) {
    res.status(400).json({ error: 'Invalid intent' });
    return;
  }
  if (depthRaw !== undefined && !isKnowledgeDepth(depthRaw)) {
    res.status(400).json({ error: 'Invalid depth' });
    return;
  }
  if (specialistKey !== undefined && (typeof specialistKey !== 'string' || specialistKey.length === 0 || specialistKey.length > 120)) {
    res.status(400).json({ error: 'Invalid specialistKey' });
    return;
  }
  if (targetSpecialistKey !== undefined && (typeof targetSpecialistKey !== 'string' || targetSpecialistKey.length === 0 || targetSpecialistKey.length > 120)) {
    res.status(400).json({ error: 'Invalid targetSpecialistKey' });
    return;
  }
  const intent: KnowledgeIntent | undefined = intentRaw as KnowledgeIntent | undefined;
  const depth: KnowledgeDepth | undefined = depthRaw as KnowledgeDepth | undefined;

  const investigationId = res.locals.investigation.id;

  const investigation = await getInvestigationById(investigationId);
  if (!investigation) {
    res.status(404).json({ error: 'Investigation not found' });
    return;
  }

  const caseData = await getCaseById(investigation.caseId, res.locals.userId as string);
  if (!caseData) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }

  const conversation = await getConversation(investigationId);
  const messageHistory = conversation?.messageHistory || [];
  const visibleEvidence = await getEvidenceByCase(investigation.caseId, res.locals.userId as string);
  const journalEntries = await getJournalEntries(investigationId);

  // Reuse the PROD-013 vetted safe suspect board as the only suspect source.
  // It strips hidden motive/secrets/knowledge/beliefs and canonical data, and
  // links only evidence this player has actually seen.
  const [characters, suspicionLevels] = await Promise.all([
    getCharactersByCase(investigation.caseId),
    getInvestigationSuspicionLevels(investigationId),
  ]);
  const safeBoard = toPublicSuspectBoard({
    caseId: investigation.caseId,
    characters,
    visibleEvidence,
    suspicionLevels,
    discoveredIds: Array.isArray(investigation.discoveredEvidenceIds)
      ? investigation.discoveredEvidenceIds.map(String)
      : [],
    openQuestions: [],
  });

  const teamRole = detectTeamRole(message);
  const addressedSuspectNames = findAddressedSuspectNames(
    message,
    safeBoard.suspects.map((s) => s.name),
  );

  const grounded = buildGroundedContext({
    caseTitle: caseData.title,
    caseBriefing: caseData.briefing,
    message,
    messageHistory,
    previousSummary: conversation?.summary ?? '',
    alreadySummarizedCount: Number(conversation?.contextReferences?.summarizedMessageCount) || 0,
    visibleEvidence,
    journalEntries,
    suspects: safeBoard.suspects,
    addressedSuspectNames,
    teamRole,
    currentTheory: investigation.currentTheory || '',
    suspicionLevel: investigation.suspicionLevel || '',
  });

  // The addressed suspects are taken from the already-safe board DTO, so the
  // fallback can quote only public motive/alibi - never hidden character data.
  const addressedSafeSuspects: SuspectContextInput[] = safeBoard.suspects.filter((s) =>
    grounded.addressedSuspects.includes(s.name),
  );

  // Default: the legacy team-role responder. Building this spec keeps the
  // non-specialist chat path byte-for-byte compatible with pre-M2 behaviour.
  let responderContext = grounded.context;
  let responderLabelOut = responderLabel(teamRole);
  let responderSpec: ResponderSpec = {
    label: responderLabelOut,
    systemHint: roleSystemHint(teamRole),
    fallbackFn: (m, addressed) => deterministicReply(m, teamRole, addressed),
  };
  let specialistMeta: Record<string, unknown> | undefined;

  if (specialistKey !== undefined) {
    // Specialist path: add a bounded persona/intent context on top of the
    // existing grounded context. No canonical truth is ever read or appended.
    const caseId = investigation.caseId as string;
    const specialistRow = await getSpecialistByKey(caseId, specialistKey);
    if (!specialistRow) {
      res.status(400).json({ error: 'Specialist not found for this case' });
      return;
    }
    const specialist = toPublicSpecialist(specialistRow);
    const chosenIntent: KnowledgeIntent = intent ?? 'explain';
    const chosenDepth: KnowledgeDepth = depth ?? 'working';

    const [artifactRows, disagreementRows] = await Promise.all([
      getKnowledgeArtifactsByCase(caseId),
      getKnowledgeDisagreementsByCase(caseId),
    ]);
    const artifactDetails = artifactRows.map(toPublicArtifactDetail);
    const relevantArtifacts = retrieveRelevantArtifacts(
      artifactDetails,
      message,
      `${specialist.specialization} ${specialist.knowledgeDomains.join(' ')}`,
    );
    const wantsDisagreements = ['critique', 'challenge', 'discriminate', 'alternatives'].includes(chosenIntent);
    const relevantDisagreements = disagreementRows
      .map(toPublicDisagreement)
      .filter((d) => relevantArtifacts.some((a) => d.relatedArtifactKeys.includes(a.artifactKey)))
      .slice(0, 2);
    const disagreementsForReply = wantsDisagreements
      ? (relevantDisagreements.length > 0 ? relevantDisagreements : disagreementRows.map(toPublicDisagreement).slice(0, 2))
      : [];

    let targetLine = '';
    if (targetSpecialistKey !== undefined) {
      const targetRow = await getSpecialistByKey(caseId, targetSpecialistKey);
      if (!targetRow) {
        res.status(400).json({ error: 'targetSpecialistKey not found for this case' });
        return;
      }
      const target = toPublicSpecialist(targetRow);
      targetLine = `\nTARGET SPECIALIST (for critique): ${clip(target.name, 80)} — ${clip(target.expertiseSummary, 240)}. Limitations: ${target.limitations.map((l) => clip(l, 160)).join('; ')}`;
    }

    const specialistContext = buildSpecialistContext({
      specialist,
      intent: chosenIntent,
      depth: chosenDepth,
      message,
      artifacts: relevantArtifacts,
      disagreements: disagreementsForReply,
    });
    responderContext = `${grounded.context}\n\n${specialistContext}${targetLine}`;
    if (responderContext.length > 9_000) {
      responderContext = `${responderContext.slice(0, 8_940)}…\n[context truncated for length]`;
    }

    responderLabelOut = specialist.name;
    const limitationsText = specialist.limitations.map((l) => clip(l, 160)).join('; ');
    responderSpec = {
      label: responderLabelOut,
      systemHint: `You are ${specialist.name}, ${clip(specialist.title, 80)} (${clip(specialist.discipline, 80)}). ${clip(specialist.expertiseSummary, 400)} Style: ${clip(specialist.communicationStyle, 160)}. Respect these limits: ${limitationsText}. Stay strictly within the provided context and never cite an unverified source URL.`,
      fallbackFn: (m, addressed) => deterministicSpecialistReply(
        m, specialist, chosenIntent, chosenDepth, relevantArtifacts, disagreementsForReply,
      ),
    };
    specialistMeta = {
      specialistKey: specialist.specialistKey,
      specialistName: specialist.name,
      intent: chosenIntent,
      depth: chosenDepth,
    };
  }

  const response = await generateAIResponse(message, responderContext, responderSpec, addressedSafeSuspects);

  await addMessage(investigationId, 'player', message, specialistMeta);
  await addMessage(investigationId, 'investigator', response.content, specialistMeta);
  // Persist bounded rolling memory + the summarized-message cursor atomically.
  const priorRefs = conversation?.contextReferences;
  const contextRefs: Record<string, unknown> = priorRefs && typeof priorRefs === 'object' && !Array.isArray(priorRefs)
    ? { ...priorRefs }
    : {};
  await updateConversationMemory(investigationId, grounded.summary, {
    ...contextRefs,
    summarizedMessageCount: grounded.summarizedMessageCount,
  });

  const body: Record<string, unknown> = {
    role: 'investigator',
    teamRole,
    responderLabel: responderLabelOut,
    addressedSuspects: grounded.addressedSuspects,
    context: {
      window: GROUNDING_LIMITS.recentWindow,
      recentMessages: grounded.recentMessageCount,
      retrievedEvidence: grounded.retrievedEvidenceCount,
      chars: grounded.charCount,
      maxChars: GROUNDING_LIMITS.maxContextChars,
    },
    content: response.content,
    timestamp: new Date().toISOString(),
  };
  if (specialistMeta) {
    body.specialistKey = specialistMeta.specialistKey;
    body.specialistName = specialistMeta.specialistName;
    body.intent = specialistMeta.intent;
    body.depth = specialistMeta.depth;
  }
  res.json(body);
}));

// ---------------------------------------------------------------------------
// M2 notebook routes. Mounted on investigationRouter, so authentication,
// investigation ownership and offline progression are already enforced, and
// the user id is always server-derived from the session.
// ---------------------------------------------------------------------------

function buildNotebookSourceSnapshot(artifact: any): Record<string, unknown> {
  if (!artifact) return {};
  const detail = toPublicArtifactDetail(artifact);
  const snapshot: Record<string, unknown> = {
    ...detail,
    verificationNotes: clip(detail.verificationNotes, 280),
    claimsSupported: detail.claimsSupported.slice(0, 5).map((c: string) => clip(c, 160)),
    relatedEvidenceRefs: detail.relatedEvidenceRefs.slice(0, 5).map((r: string) => clip(r, 160)),
    contentExcerpt: clip(detail.content, 240),
  };
  delete (snapshot as Record<string, unknown>).content;
  // suggestedConversations and depthContent are useful in the drawer, but too
  // verbose for a stored provenance snapshot; keep the snapshot compact.
  delete (snapshot as Record<string, unknown>).suggestedConversations;
  delete (snapshot as Record<string, unknown>).depthContent;
  let serialized = JSON.stringify(snapshot);
  if (serialized.length <= KNOWLEDGE_LIMITS.maxSourceSnapshotChars) return snapshot;
  const compact = {
    ...snapshot,
    description: clip(detail.description, 120),
    verificationNotes: '',
    contentExcerpt: '',
    usageNote: '',
  };
  serialized = JSON.stringify(compact);
  if (serialized.length <= KNOWLEDGE_LIMITS.maxSourceSnapshotChars) return compact;
  // Final fallback: keep identity + provenance essentials only.
  return {
    id: detail.id,
    artifactKey: detail.artifactKey,
    title: detail.title,
    artifactType: detail.artifactType,
    knowledgeClass: detail.knowledgeClass,
    reliability: detail.reliability,
    sourceAuthor: detail.sourceAuthor,
    bibliographyRef: clip(detail.bibliographyRef, 240),
    sourceVerified: detail.sourceVerified,
    verificationStatus: detail.verificationStatus,
    isFictional: detail.isFictional,
  };
}

investigationRouter.get('/notebook', asyncRoute(async (_req: Request, res: Response) => {
  const entries = await getNotebookEntries(res.locals.investigation.id, res.locals.userId as string);
  res.json(entries.map(toPublicNotebookEntry));
}));

// M3: export the owner's notebook. Both shapes are built exclusively from the
// safe PublicNotebookEntry DTO (source snapshots never contain raw artifact
// content or canonical data). Auth + ownership come from investigationRouter.
investigationRouter.get('/notebook/export', asyncRoute(async (req: Request, res: Response) => {
  const rawFormat = typeof req.query.format === 'string' ? req.query.format.toLowerCase() : 'json';
  if (rawFormat !== 'json' && rawFormat !== 'markdown') {
    res.status(400).json({ error: "format must be 'json' or 'markdown'" });
    return;
  }
  const investigation = res.locals.investigation;
  const entries = (await getNotebookEntries(investigation.id, res.locals.userId as string))
    .map(toPublicNotebookEntry);
  const caseData = await getCaseById(investigation.caseId as string);
  const meta = {
    caseTitle: caseData?.title ?? 'Unknown case',
    investigationId: String(investigation.id),
    exportedAt: new Date().toISOString(),
  };
  if (rawFormat === 'markdown') {
    const markdown = renderNotebookMarkdown(entries, meta);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="notebook-${investigation.id}.md"`);
    res.send(markdown);
    return;
  }
  res.json({ ...meta, entries });
}));

investigationRouter.post('/notebook', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  const body = req.body || {};
  if (!isNotebookEntryType(body.entryType)) {
    res.status(400).json({ error: 'Invalid entryType' });
    return;
  }
  if (body.concept !== undefined && !boundedText(body.concept, KNOWLEDGE_LIMITS.maxConceptChars)) {
    res.status(400).json({ error: 'concept must be non-blank text' });
    return;
  }
  if (body.title !== undefined && !boundedText(body.title, KNOWLEDGE_LIMITS.maxTitleChars)) {
    res.status(400).json({ error: 'title must be non-blank text' });
    return;
  }
  if (body.content !== undefined && (typeof body.content !== 'string' || body.content.length > KNOWLEDGE_LIMITS.maxContentChars)) {
    res.status(400).json({ error: 'content too long' });
    return;
  }

  const caseId = res.locals.investigation.caseId as string;
  let artifactId: string | null = null;
  let specialistId: string | null = null;
  let sourceSnapshot: Record<string, unknown> = {};

  if (body.artifactId !== undefined && body.artifactId !== null && body.artifactId !== '') {
    if (!isUuid(body.artifactId)) {
      res.status(400).json({ error: 'Invalid artifactId' });
      return;
    }
    const artifact = await getKnowledgeArtifactById(body.artifactId, caseId);
    if (!artifact) {
      res.status(404).json({ error: 'Artifact not found in this case' });
      return;
    }
    artifactId = body.artifactId;
    sourceSnapshot = buildNotebookSourceSnapshot(artifact);
  }
  if (body.specialistId !== undefined && body.specialistId !== null && body.specialistId !== '') {
    if (!isUuid(body.specialistId)) {
      res.status(400).json({ error: 'Invalid specialistId' });
      return;
    }
    const sp = await query(
      `SELECT s.id FROM specialists s
         JOIN case_specialists cs ON cs.specialist_id = s.id
        WHERE s.id = $1 AND cs.case_id = $2 LIMIT 1`,
      [body.specialistId, caseId]
    );
    if (sp.rows.length === 0) {
      res.status(404).json({ error: 'Specialist not found in this case' });
      return;
    }
    specialistId = body.specialistId;
  }

  const entry = await createNotebookEntry(res.locals.investigation.id, res.locals.userId as string, {
    entryType: body.entryType,
    concept: body.concept ?? '',
    title: body.title ?? '',
    content: body.content ?? '',
    artifactId,
    specialistId,
    sourceSnapshot,
  });
  res.status(201).json(toPublicNotebookEntry(entry));
}));

investigationRouter.patch('/notebook/:entryId', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  const entryId = req.params.entryId;
  if (!isUuid(entryId)) {
    res.status(404).json({ error: 'Notebook entry not found' });
    return;
  }
  const body = req.body || {};
  const data: {
    entryType?: string;
    concept?: string;
    title?: string;
    content?: string;
    artifactId?: string | null;
    specialistId?: string | null;
    sourceSnapshot?: Record<string, unknown>;
  } = {};

  if (body.entryType !== undefined) {
    if (!isNotebookEntryType(body.entryType)) {
      res.status(400).json({ error: 'Invalid entryType' });
      return;
    }
    data.entryType = body.entryType;
  }
  if (body.concept !== undefined) {
    if (!boundedText(body.concept, KNOWLEDGE_LIMITS.maxConceptChars)) {
      res.status(400).json({ error: 'concept must be non-blank text' });
      return;
    }
    data.concept = body.concept;
  }
  if (body.title !== undefined) {
    if (!boundedText(body.title, KNOWLEDGE_LIMITS.maxTitleChars)) {
      res.status(400).json({ error: 'title must be non-blank text' });
      return;
    }
    data.title = body.title;
  }
  if (body.content !== undefined) {
    if (typeof body.content !== 'string' || body.content.length > KNOWLEDGE_LIMITS.maxContentChars) {
      res.status(400).json({ error: 'content too long' });
      return;
    }
    data.content = body.content;
  }

  const caseId = res.locals.investigation.caseId as string;
  if (body.artifactId !== undefined) {
    if (body.artifactId === null || body.artifactId === '') {
      data.artifactId = null;
      data.sourceSnapshot = {};
    } else {
      if (!isUuid(body.artifactId)) {
        res.status(400).json({ error: 'Invalid artifactId' });
        return;
      }
      const artifact = await getKnowledgeArtifactById(body.artifactId, caseId);
      if (!artifact) {
        res.status(404).json({ error: 'Artifact not found in this case' });
        return;
      }
      data.artifactId = body.artifactId;
      data.sourceSnapshot = buildNotebookSourceSnapshot(artifact);
    }
  }
  if (body.specialistId !== undefined) {
    if (body.specialistId === null || body.specialistId === '') {
      data.specialistId = null;
    } else {
      if (!isUuid(body.specialistId)) {
        res.status(400).json({ error: 'Invalid specialistId' });
        return;
      }
      const sp = await query(
        `SELECT s.id FROM specialists s
           JOIN case_specialists cs ON cs.specialist_id = s.id
          WHERE s.id = $1 AND cs.case_id = $2 LIMIT 1`,
        [body.specialistId, caseId]
      );
      if (sp.rows.length === 0) {
        res.status(404).json({ error: 'Specialist not found in this case' });
        return;
      }
      data.specialistId = body.specialistId;
    }
  }

  const updated = await updateNotebookEntry(entryId, res.locals.investigation.id, res.locals.userId as string, data);
  if (!updated) {
    res.status(404).json({ error: 'Notebook entry not found' });
    return;
  }
  res.json(toPublicNotebookEntry(updated));
}));

investigationRouter.delete('/notebook/:entryId', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  const entryId = req.params.entryId;
  if (!isUuid(entryId)) {
    res.status(404).json({ error: 'Notebook entry not found' });
    return;
  }
  const removed = await deleteNotebookEntry(entryId, res.locals.investigation.id, res.locals.userId as string);
  if (!removed) {
    res.status(404).json({ error: 'Notebook entry not found' });
    return;
  }
  res.json({ success: true });
}));

// Achievements cannot be unlocked by the client. They are awarded server-side
// from real gameplay events (first discovery, correct verdict). Kept as an
// explicit 403 so stale clients get a clear answer instead of a generic 404.
investigationRouter.post('/achievements', (_req: Request, res: Response) => {
  res.status(403).json({ error: 'Achievements are awarded by the server' });
});

investigationRouter.get('/achievements', asyncRoute(async (req: Request, res: Response) => {
  res.json(await getAchievements(res.locals.investigation.id));
}));

// ---------------------------------------------------------------------------
// M4: Reality Map (player-owned reasoning notes).
// ---------------------------------------------------------------------------
// HARD INVARIANTS:
//   * These endpoints never read canonical_truth, never score a verdict, never
//     advance progression and never release evidence. They only read/write the
//     player's own claims/hypotheses/links and already-visible case material.
//   * Hidden evidence cannot be linked (resolveLinkTarget filters through
//     getEvidenceByCase) and cannot appear in a snapshot (materials come from
//     the same vetted source). Stale links are filtered from reads as well.
//   * Specialists / AI are advisory only: review endpoints perform NO writes.
// Auth + ownership + offline progression are inherited from investigationRouter.
// ---------------------------------------------------------------------------

interface RealityMapContext {
  investigation: any;
  caseId: string;
  caseTitle: string;
  userId: string;
  claimRows: RealityClaim[];
  hypothesisRows: RealityHypothesis[];
  linkRows: RealityMapLink[];
  claims: PublicClaim[];
  hypotheses: PublicHypothesis[];
  links: PublicLink[];
  tensions: Tension[];
  materialIndex: MaterialIndex;
  prompts: Array<{ text: string; claimCategoryHint: string }>;
  tutorialAvailable: boolean;
  tutorialPresent: boolean;
  snapshot: Record<string, unknown>;
}

async function loadRealityMapContext(investigation: any, userId: string): Promise<RealityMapContext> {
  const investigationId = String(investigation.id);
  const caseId = String(investigation.caseId);

  const [caseData, claimRows, hypothesisRows, linkRows, evidence, artifactRows, specialistRows, characterRows, journalRows, notebookRows] =
    await Promise.all([
      getCaseById(caseId),
      getClaims(investigationId, userId),
      getHypotheses(investigationId, userId),
      getLinks(investigationId, userId),
      getEvidenceByCase(caseId, userId),
      getKnowledgeArtifactsByCase(caseId),
      getSpecialistsByCase(caseId),
      getCharactersByCase(caseId),
      getJournalEntries(investigationId),
      getNotebookEntries(investigationId, userId),
    ]);

  const caseTitle = String(caseData?.title ?? '');
  const safeMaterials = {
    evidence,
    artifacts: artifactRows.map(toPublicArtifactSummary),
    specialists: specialistRows.map(toPublicSpecialist),
    characters: characterRows.map((c: any) => ({ id: String(c.id), name: String(c.name ?? ''), role: String(c.role ?? '') })),
    journalEntries: journalRows.map((j: any) => ({ id: String(j.id), entryType: String(j.entryType ?? ''), content: clip(j.content, 200) })),
    notebookEntries: notebookRows.map(toPublicNotebookEntry),
  };

  const claims = claimRows.map(toPublicClaim);
  const hypotheses = hypothesisRows.map(toPublicHypothesis);
  const materialIndex = buildMaterialIndex({
    ...safeMaterials,
    claims,
    hypotheses,
  });
  // Defence in depth: drop any link whose owner or target no longer resolves
  // (deleted node, evidence that is no longer visible, cross-case id, ...).
  const links = linkRows
    .map((row) => toPublicLink(row, materialIndex))
    .filter((link): link is PublicLink => link !== null);
  const tensions = deriveTensions({ claims, hypotheses, links });
  const prompts = getReasoningPrompts(caseTitle);
  const tutorialAvailable = isRealityMapTutorialAvailable(caseTitle);
  const tutorialPresent = claims.some((c) => c.isTutorial)
    || hypotheses.some((h) => h.isTutorial)
    || links.some((l) => l.isTutorial);

  const snapshot: Record<string, unknown> = {
    caseId,
    investigationId,
    investigationStatus: String(investigation.status ?? ''),
    claims,
    hypotheses,
    links,
    tensions,
    materials: {
      evidence: materialIndex.byType.evidence ?? [],
      artifacts: materialIndex.byType.artifact ?? [],
      specialists: materialIndex.byType.specialist ?? [],
      characters: materialIndex.byType.character ?? [],
      journalEntries: materialIndex.byType.journal_entry ?? [],
      notebookEntries: materialIndex.byType.notebook_entry ?? [],
    },
    reasoningPrompts: prompts,
    tutorialAvailable,
    tutorialPresent,
    limits: {
      claims: { used: claims.length, max: REALITY_MAP_LIMITS.maxClaims },
      hypotheses: { used: hypotheses.length, max: REALITY_MAP_LIMITS.maxHypotheses },
      links: { used: links.length, max: REALITY_MAP_LIMITS.maxLinks },
    },
  };

  return {
    investigation, caseId, caseTitle, userId,
    claimRows, hypothesisRows, linkRows, claims, hypotheses, links, tensions,
    materialIndex, prompts, tutorialAvailable, tutorialPresent, snapshot,
  };
}

/** Minimal MaterialIndex used to render a single freshly created/edited link. */
function linkResponseIndex(
  ownerType: string, ownerId: string, ownerLabel: string,
  targetType: string, targetId: string, targetLabel: string, targetSubLabel: string,
): MaterialIndex {
  const byKey: Record<string, { id: string; type: any; label: string; subLabel: string }> = {
    [`${ownerType}:${ownerId}`]: { id: ownerId, type: ownerType, label: ownerLabel, subLabel: '' },
    [`${targetType}:${targetId}`]: { id: targetId, type: targetType, label: targetLabel, subLabel: targetSubLabel },
  };
  return { byKey, items: [], byType: {} };
}

function textField(value: unknown, max: number, field: string): string | null {
  if (typeof value !== 'string' || value.length > max) return null;
  void field;
  return value;
}

function optionalTextField(value: unknown, max: number): { ok: true; value: string } | { ok: false } {
  if (value === undefined) return { ok: true, value: '' };
  if (typeof value !== 'string' || value.length > max) return { ok: false };
  return { ok: true, value };
}

investigationRouter.get('/reality-map', asyncRoute(async (req: Request, res: Response) => {
  const context = await loadRealityMapContext(res.locals.investigation, res.locals.userId as string);
  res.json(context.snapshot);
}));

// --- Claims ----------------------------------------------------------------

investigationRouter.post('/reality-map/claims', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  const body = req.body || {};
  if (!boundedText(body.title, REALITY_MAP_LIMITS.maxTitleChars)) {
    res.status(400).json({ error: 'title required (1-160 characters)' });
    return;
  }
  if (!isClaimCategory(body.claimCategory)) {
    res.status(400).json({ error: 'Invalid claimCategory' });
    return;
  }
  if (body.confidence !== undefined && !isConfidence(body.confidence)) {
    res.status(400).json({ error: 'Invalid confidence' });
    return;
  }
  const description = optionalTextField(body.description, REALITY_MAP_LIMITS.maxTextChars);
  const notes = optionalTextField(body.notes, REALITY_MAP_LIMITS.maxTextChars);
  if (!description.ok || !notes.ok) {
    res.status(400).json({ error: 'description/notes too long' });
    return;
  }

  const investigationId = String(res.locals.investigation.id);
  const userId = res.locals.userId as string;
  let sourceJournalEntryId: string | null = null;
  if (body.sourceJournalEntryId !== undefined && body.sourceJournalEntryId !== null && body.sourceJournalEntryId !== '') {
    if (!isUuid(body.sourceJournalEntryId)) {
      res.status(400).json({ error: 'Invalid sourceJournalEntryId' });
      return;
    }
    const found = await query(
      'SELECT id FROM journal_entries WHERE id = $1 AND investigation_id = $2 LIMIT 1',
      [body.sourceJournalEntryId, investigationId]
    );
    if (found.rows.length === 0) {
      res.status(404).json({ error: 'Source journal entry not found in this investigation' });
      return;
    }
    sourceJournalEntryId = body.sourceJournalEntryId;
  }
  let sourceNotebookEntryId: string | null = null;
  if (body.sourceNotebookEntryId !== undefined && body.sourceNotebookEntryId !== null && body.sourceNotebookEntryId !== '') {
    if (!isUuid(body.sourceNotebookEntryId)) {
      res.status(400).json({ error: 'Invalid sourceNotebookEntryId' });
      return;
    }
    const found = await query(
      `SELECT id FROM notebook_entries WHERE id = $1 AND investigation_id = $2 AND user_id = $3 LIMIT 1`,
      [body.sourceNotebookEntryId, investigationId, userId]
    );
    if (found.rows.length === 0) {
      res.status(404).json({ error: 'Source notebook entry not found in this investigation' });
      return;
    }
    sourceNotebookEntryId = body.sourceNotebookEntryId;
  }

  if (await countRealityRows('investigation_claims', investigationId, userId) >= REALITY_MAP_LIMITS.maxClaims) {
    res.status(409).json({ error: 'Claim limit reached' });
    return;
  }
  const claim = await createClaim(investigationId, userId, {
    title: body.title,
    description: description.value,
    claimCategory: body.claimCategory,
    confidence: body.confidence ?? 'insufficient_information',
    notes: notes.value,
    sourceJournalEntryId,
    sourceNotebookEntryId,
  });
  res.status(201).json(toPublicClaim(claim));
}));

investigationRouter.patch('/reality-map/claims/:claimId', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  if (!isUuid(req.params.claimId)) {
    res.status(404).json({ error: 'Claim not found' });
    return;
  }
  const body = req.body || {};
  const patch: {
    title?: string; description?: string; claimCategory?: string;
    confidence?: string; notes?: string;
  } = {};
  if (body.title !== undefined) {
    if (!boundedText(body.title, REALITY_MAP_LIMITS.maxTitleChars)) {
      res.status(400).json({ error: 'Invalid title' });
      return;
    }
    patch.title = body.title;
  }
  if (body.claimCategory !== undefined) {
    if (!isClaimCategory(body.claimCategory)) {
      res.status(400).json({ error: 'Invalid claimCategory' });
      return;
    }
    patch.claimCategory = body.claimCategory;
  }
  if (body.confidence !== undefined) {
    if (!isConfidence(body.confidence)) {
      res.status(400).json({ error: 'Invalid confidence' });
      return;
    }
    patch.confidence = body.confidence;
  }
  for (const key of ['description', 'notes'] as const) {
    if (body[key] !== undefined) {
      const parsed = textField(body[key], REALITY_MAP_LIMITS.maxTextChars, key);
      if (parsed === null) {
        res.status(400).json({ error: `Invalid ${key}` });
        return;
      }
      patch[key] = parsed;
    }
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'Empty patch' });
    return;
  }
  const updated = await updateClaim(
    req.params.claimId as string, String(res.locals.investigation.id), res.locals.userId as string, patch
  );
  if (!updated) {
    res.status(404).json({ error: 'Claim not found' });
    return;
  }
  res.json(toPublicClaim(updated));
}));

investigationRouter.delete('/reality-map/claims/:claimId', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  if (!isUuid(req.params.claimId)) {
    res.status(404).json({ error: 'Claim not found' });
    return;
  }
  const result = await deleteClaim(
    req.params.claimId as string, String(res.locals.investigation.id), res.locals.userId as string
  );
  if (!result.deleted) {
    res.status(404).json({ error: 'Claim not found' });
    return;
  }
  res.json({ deleted: true, removedLinks: result.removedLinks });
}));

// --- Hypotheses ------------------------------------------------------------

const HYPOTHESIS_TEXT_FIELDS = {
  explanation: REALITY_MAP_LIMITS.maxTextChars,
  missingInformation: REALITY_MAP_LIMITS.maxTextChars,
  alternativeExplanations: REALITY_MAP_LIMITS.maxTextChars,
  playerNotes: REALITY_MAP_LIMITS.maxTextChars,
} as const;

function parseHypothesisText(body: any, patch: Record<string, string>): boolean {
  for (const key of Object.keys(HYPOTHESIS_TEXT_FIELDS) as Array<keyof typeof HYPOTHESIS_TEXT_FIELDS>) {
    if (body[key] === undefined) continue;
    const parsed = textField(body[key], HYPOTHESIS_TEXT_FIELDS[key], key);
    if (parsed === null) return false;
    patch[key] = parsed;
  }
  return true;
}

investigationRouter.post('/reality-map/hypotheses', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  const body = req.body || {};
  if (!boundedText(body.name, REALITY_MAP_LIMITS.maxNameChars)) {
    res.status(400).json({ error: 'name required (1-160 characters)' });
    return;
  }
  if (body.status !== undefined && !isHypothesisStatus(body.status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  if (body.confidence !== undefined && !isConfidence(body.confidence)) {
    res.status(400).json({ error: 'Invalid confidence' });
    return;
  }
  const patch: Record<string, string> = {};
  if (!parseHypothesisText(body, patch)) {
    res.status(400).json({ error: 'Hypothesis text field too long' });
    return;
  }
  const investigationId = String(res.locals.investigation.id);
  const userId = res.locals.userId as string;
  if (await countRealityRows('investigation_hypotheses', investigationId, userId) >= REALITY_MAP_LIMITS.maxHypotheses) {
    res.status(409).json({ error: 'Hypothesis limit reached' });
    return;
  }
  const hypothesis = await createHypothesis(investigationId, userId, {
    name: body.name,
    status: body.status ?? 'active',
    confidence: body.confidence ?? 'insufficient_information',
    ...patch,
  });
  res.status(201).json(toPublicHypothesis(hypothesis));
}));

investigationRouter.patch('/reality-map/hypotheses/:hypothesisId', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  if (!isUuid(req.params.hypothesisId)) {
    res.status(404).json({ error: 'Hypothesis not found' });
    return;
  }
  const body = req.body || {};
  const patch: Record<string, string> = {};
  if (body.name !== undefined) {
    if (!boundedText(body.name, REALITY_MAP_LIMITS.maxNameChars)) {
      res.status(400).json({ error: 'Invalid name' });
      return;
    }
    patch.name = body.name;
  }
  if (body.status !== undefined) {
    if (!isHypothesisStatus(body.status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    patch.status = body.status;
  }
  if (body.confidence !== undefined) {
    if (!isConfidence(body.confidence)) {
      res.status(400).json({ error: 'Invalid confidence' });
      return;
    }
    patch.confidence = body.confidence;
  }
  if (!parseHypothesisText(body, patch)) {
    res.status(400).json({ error: 'Hypothesis text field too long' });
    return;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'Empty patch' });
    return;
  }
  const updated = await updateHypothesis(
    req.params.hypothesisId as string, String(res.locals.investigation.id), res.locals.userId as string, patch
  );
  if (!updated) {
    res.status(404).json({ error: 'Hypothesis not found' });
    return;
  }
  res.json(toPublicHypothesis(updated));
}));

investigationRouter.delete('/reality-map/hypotheses/:hypothesisId', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  if (!isUuid(req.params.hypothesisId)) {
    res.status(404).json({ error: 'Hypothesis not found' });
    return;
  }
  const result = await deleteHypothesis(
    req.params.hypothesisId as string, String(res.locals.investigation.id), res.locals.userId as string
  );
  if (!result.deleted) {
    res.status(404).json({ error: 'Hypothesis not found' });
    return;
  }
  res.json({ deleted: true, removedLinks: result.removedLinks });
}));

// --- Links -----------------------------------------------------------------

investigationRouter.post('/reality-map/links', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  const body = req.body || {};
  const { ownerType, ownerId, targetType, targetId, relationship } = body;
  if (!isRealityMapOwnerType(ownerType) || !isLinkTargetType(targetType) || !isRelationship(relationship)) {
    res.status(400).json({ error: 'Invalid link type/relationship' });
    return;
  }
  if (!isUuid(ownerId) || !isUuid(targetId)) {
    res.status(400).json({ error: 'Invalid ownerId/targetId' });
    return;
  }
  if (!isLinkShapeValid(ownerType, targetType, relationship)) {
    res.status(400).json({ error: 'Illegal link shape for this relationship' });
    return;
  }
  if (body.rationale !== undefined && (typeof body.rationale !== 'string' || body.rationale.length > REALITY_MAP_LIMITS.maxRationaleChars)) {
    res.status(400).json({ error: 'rationale too long' });
    return;
  }

  const investigation = res.locals.investigation;
  const investigationId = String(investigation.id);
  const userId = res.locals.userId as string;

  const owner = ownerType === 'claim'
    ? await getClaimById(ownerId, investigationId, userId)
    : await getHypothesisById(ownerId, investigationId, userId);
  if (!owner) {
    res.status(404).json({ error: 'Link owner not found in this investigation' });
    return;
  }
  // Hidden / other-case evidence and any non-visible material resolve to null.
  const target = await resolveLinkTarget({
    investigationId,
    caseId: String(investigation.caseId),
    userId,
    targetType,
    targetId,
  });
  if (!target) {
    res.status(404).json({ error: 'Link target not found or not visible in this case' });
    return;
  }

  if (await countRealityRows('reality_map_links', investigationId, userId) >= REALITY_MAP_LIMITS.maxLinks) {
    res.status(409).json({ error: 'Link limit reached' });
    return;
  }

  let created: RealityMapLink;
  try {
    created = await createLink(investigationId, userId, {
      ownerType, ownerId, targetType, targetId, relationship,
      rationale: body.rationale ?? '',
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      const existing = await findLinkByShape(investigationId, userId, { ownerType, ownerId, targetType, targetId });
      res.status(409).json({ error: 'Relationship already exists', linkId: existing?.id ?? null });
      return;
    }
    throw error;
  }

  const ownerLabel = ownerType === 'claim'
    ? clip((owner as RealityClaim).title, 160)
    : clip((owner as RealityHypothesis).name, 160);
  const dto = toPublicLink(created, linkResponseIndex(
    ownerType, ownerId, ownerLabel, targetType, targetId, target.label, target.subLabel
  ));
  if (!dto) {
    res.status(404).json({ error: 'Link target not found or not visible in this case' });
    return;
  }
  res.status(201).json(dto);
}));

investigationRouter.patch('/reality-map/links/:linkId', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  if (!isUuid(req.params.linkId)) {
    res.status(404).json({ error: 'Link not found' });
    return;
  }
  const investigationId = String(res.locals.investigation.id);
  const userId = res.locals.userId as string;
  const existing = await getLinkById(req.params.linkId as string, investigationId, userId);
  if (!existing) {
    res.status(404).json({ error: 'Link not found' });
    return;
  }
  const body = req.body || {};
  const patch: { relationship?: string; rationale?: string } = {};
  if (body.relationship !== undefined) {
    if (!isRelationship(body.relationship)
      || !isLinkShapeValid(existing.ownerType, existing.targetType, body.relationship)) {
      res.status(400).json({ error: 'Invalid relationship for this link shape' });
      return;
    }
    patch.relationship = body.relationship;
  }
  if (body.rationale !== undefined) {
    if (typeof body.rationale !== 'string' || body.rationale.length > REALITY_MAP_LIMITS.maxRationaleChars) {
      res.status(400).json({ error: 'rationale too long' });
      return;
    }
    patch.rationale = body.rationale;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'Empty patch' });
    return;
  }
  const updated = await updateLink(req.params.linkId as string, investigationId, userId, patch);
  if (!updated) {
    res.status(404).json({ error: 'Link not found' });
    return;
  }
  const context = await loadRealityMapContext(res.locals.investigation, userId);
  const dto = context.links.find((l) => l.id === updated.id);
  if (!dto) {
    res.status(404).json({ error: 'Link target no longer visible' });
    return;
  }
  res.json(dto);
}));

investigationRouter.delete('/reality-map/links/:linkId', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  if (!isUuid(req.params.linkId)) {
    res.status(404).json({ error: 'Link not found' });
    return;
  }
  const removed = await deleteLink(
    req.params.linkId as string, String(res.locals.investigation.id), res.locals.userId as string
  );
  if (!removed) {
    res.status(404).json({ error: 'Link not found' });
    return;
  }
  res.json({ deleted: true });
}));

// --- Comparison ------------------------------------------------------------

investigationRouter.get('/reality-map/compare', asyncRoute(async (req: Request, res: Response) => {
  const raw = typeof req.query.hypothesisIds === 'string' ? req.query.hypothesisIds : '';
  const ids = [...new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))];
  if (ids.length < 2 || ids.length > REALITY_MAP_LIMITS.maxCompareHypotheses) {
    res.status(400).json({ error: 'Provide 2-4 hypothesisIds' });
    return;
  }
  if (ids.some((id) => !isUuid(id))) {
    res.status(400).json({ error: 'Invalid hypothesisIds' });
    return;
  }
  const investigationId = String(res.locals.investigation.id);
  const userId = res.locals.userId as string;
  const selected: PublicHypothesis[] = [];
  for (const id of ids) {
    const row = await getHypothesisById(id, investigationId, userId);
    if (!row) {
      res.status(404).json({ error: 'Hypothesis not found in this investigation' });
      return;
    }
    selected.push(toPublicHypothesis(row));
  }
  const context = await loadRealityMapContext(res.locals.investigation, userId);
  const comparison = buildHypothesisComparison({
    hypotheses: selected,
    claims: context.claims,
    links: context.links,
  });
  res.json(comparison);
}));

// --- Reasoning review (audit + optional grounded summary) ------------------

investigationRouter.post('/reality-map/reasoning-review', chatLimiter, asyncRoute(async (req: Request, res: Response) => {
  const context = await loadRealityMapContext(res.locals.investigation, res.locals.userId as string);
  const audit = buildReasoningAudit({
    claims: context.claims,
    hypotheses: context.hypotheses,
    links: context.links,
    tensions: context.tensions,
    prompts: context.prompts,
  });
  let aiSummary = audit.aiSummary;
  if (process.env.USE_LLM !== 'false') {
    // Optional enhancement. The prompt carries ONLY non-canonical counts and
    // section sizes; the deterministic fallback is always available.
    const enhanced = await generateAIResponse(
      'Summarise the state of these reasoning notes in two neutral sentences.',
      JSON.stringify({ counts: audit.counts, sections: audit.sections.map((s) => ({ key: s.key, itemCount: s.items.length })) }),
      {
        label: 'Reasoning Review',
        systemHint: 'Summarise only the supplied counts. Never reveal a solution or endorse a hypothesis. Be neutral and concise.',
        fallbackFn: () => audit.aiSummary,
      },
      []
    );
    if (enhanced?.content) aiSummary = clip(enhanced.content, REALITY_MAP_LIMITS.maxReviewChars);
  }
  res.json({ ...audit, aiSummary });
}));

// --- Specialist hypothesis review (advisory only, NO writes) ---------------

investigationRouter.post(
  '/reality-map/hypotheses/:hypothesisId/specialist-review',
  chatLimiter,
  asyncRoute(async (req: Request, res: Response) => {
    const body = req.body || {};
    const { specialistKey, focus, compareWithHypothesisId, targetSpecialistKey } = body;
    if (typeof specialistKey !== 'string' || specialistKey.length === 0 || specialistKey.length > 120) {
      res.status(400).json({ error: 'Invalid specialistKey' });
      return;
    }
    if (!isReviewFocus(focus)) {
      res.status(400).json({ error: 'Invalid focus' });
      return;
    }
    if (focus === 'critique' && (typeof targetSpecialistKey !== 'string' || targetSpecialistKey.length === 0)) {
      res.status(400).json({ error: 'critique requires targetSpecialistKey' });
      return;
    }
    if (targetSpecialistKey !== undefined && (typeof targetSpecialistKey !== 'string' || targetSpecialistKey.length > 120)) {
      res.status(400).json({ error: 'Invalid targetSpecialistKey' });
      return;
    }
    if (compareWithHypothesisId !== undefined && !isUuid(compareWithHypothesisId)) {
      res.status(400).json({ error: 'Invalid compareWithHypothesisId' });
      return;
    }

    const investigation = res.locals.investigation;
    const investigationId = String(investigation.id);
    const caseId = String(investigation.caseId);
    const userId = res.locals.userId as string;
    if (!isUuid(req.params.hypothesisId)) {
      res.status(404).json({ error: 'Hypothesis not found' });
      return;
    }
    const hypothesisRow = await getHypothesisById(req.params.hypothesisId as string, investigationId, userId);
    if (!hypothesisRow) {
      res.status(404).json({ error: 'Hypothesis not found' });
      return;
    }
    const specialistRow = await getSpecialistByKey(caseId, specialistKey);
    if (!specialistRow) {
      res.status(400).json({ error: 'Specialist not found for this case' });
      return;
    }
    if (targetSpecialistKey !== undefined) {
      const targetRow = await getSpecialistByKey(caseId, targetSpecialistKey as string);
      if (!targetRow) {
        res.status(400).json({ error: 'targetSpecialistKey not found for this case' });
        return;
      }
    }
    let comparisonHypothesis: PublicHypothesis | null = null;
    if (compareWithHypothesisId !== undefined) {
      const compareRow = await getHypothesisById(compareWithHypothesisId, investigationId, userId);
      if (!compareRow) {
        res.status(404).json({ error: 'Comparison hypothesis not found in this investigation' });
        return;
      }
      comparisonHypothesis = toPublicHypothesis(compareRow);
    }

    const context = await loadRealityMapContext(investigation, userId);
    const specialist = toPublicSpecialist(specialistRow);
    const hypothesis = toPublicHypothesis(hypothesisRow);
    const reviewInput = {
      specialistName: specialist.name,
      focus,
      hypothesis,
      claims: context.claims,
      hypotheses: context.hypotheses,
      links: context.links,
      tensions: context.tensions,
      comparisonHypothesis,
      materialIndex: context.materialIndex,
    };
    const reviewContext = buildHypothesisReviewContext(reviewInput);
    const response = await generateAIResponse(
      focus === 'critique'
        ? `Critique the reasoning of ${targetSpecialistKey} using only the supplied notes.`
        : `Review my hypothesis "${clip(hypothesis.name, 100)}" (focus: ${focus}).`,
      reviewContext,
      {
        label: specialist.name,
        systemHint: `You are ${clip(specialist.name, 80)}, ${clip(specialist.title, 80)} (${clip(specialist.discipline, 80)}). ${clip(specialist.expertiseSummary, 300)} Never assert facts outside the provided context, never state which hypothesis is correct, and never mention canonical truth or hidden evidence. Limitations: ${specialist.limitations.map((l: string) => clip(l, 120)).join('; ')}`,
        fallbackFn: () => deterministicHypothesisReview(reviewInput),
      },
      []
    );

    // NOTE: deliberately no addMessage / no DB write — specialists advise only.
    res.json({
      content: response.content,
      specialistKey: specialist.specialistKey,
      specialistName: specialist.name,
      focus,
      limitations: specialist.limitations,
      provenance: 'specialist_opinion',
      disclaimer: REASONING_DISCLAIMER,
      ...(compareWithHypothesisId !== undefined ? { compareWithHypothesisId } : {}),
      ...(targetSpecialistKey !== undefined ? { targetSpecialistKey } : {}),
    });
  })
);

// --- Tutorial scaffolding --------------------------------------------------

investigationRouter.post('/reality-map/tutorial-examples', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  if ((req.body || {}).confirm !== true) {
    res.status(400).json({ error: 'confirm:true is required to add tutorial examples' });
    return;
  }
  const context = await loadRealityMapContext(res.locals.investigation, res.locals.userId as string);
  if (!context.tutorialAvailable) {
    res.status(409).json({ error: 'Tutorial examples are not available for this case' });
    return;
  }
  if (context.tutorialPresent) {
    res.status(409).json({ error: 'Tutorial examples already present' });
    return;
  }
  const scaffold = getTutorialScaffold(context.caseTitle);
  if (!scaffold) {
    res.status(409).json({ error: 'Tutorial examples are not available for this case' });
    return;
  }
  const investigationId = String(res.locals.investigation.id);
  const userId = res.locals.userId as string;
  const claims = [];
  for (const c of scaffold.claims) {
    claims.push(toPublicClaim(await createClaim(investigationId, userId, {
      title: c.title, description: c.description, claimCategory: c.claimCategory,
      confidence: c.confidence, isTutorial: true,
    })));
  }
  const hypotheses = [];
  for (const h of scaffold.hypotheses) {
    hypotheses.push(toPublicHypothesis(await createHypothesis(investigationId, userId, {
      name: h.name, explanation: h.explanation, status: h.status, confidence: h.confidence,
      missingInformation: h.missingInformation, alternativeExplanations: h.alternativeExplanations,
      isTutorial: true,
    })));
  }
  // Tutorial scaffolding deliberately has zero links.
  res.status(201).json({ claims, hypotheses, links: [] });
}));

investigationRouter.delete('/reality-map/tutorial-examples', writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  const removed = await deleteTutorialRealityExamples(
    String(res.locals.investigation.id), res.locals.userId as string
  );
  res.json({ deleted: true, ...removed });
}));

app.use('/api/investigations/:investigationId', investigationRouter);

// ---------------------------------------------------------------------------
// Weekly collections
// ---------------------------------------------------------------------------

app.get('/api/weekly-collections', authMiddleware, asyncRoute(async (_req: Request, res: Response) => {
  res.json(await getWeeklyCollections());
}));

// ---------------------------------------------------------------------------
// Error handler / startup
// ---------------------------------------------------------------------------

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  console.error('API error:', err);
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
});

// --- AI Model Abstraction Interface ---
//
// The platform uses a model abstraction layer that can be swapped between
// different LLM providers or a deterministic mock mode. This keeps the
// frontend/chat logic decoupled from any specific model implementation.
//
// In production, this would call an actual LLM with the assembled context.
// For the MVP, we use a deterministic mock responder that adheres to the
// same interface and never reveals canonical truth or hidden evidence.

/**
 * AI investigator response generator with local LLM support (PROD-014).
 * Tries the local OpenAI-compatible endpoint (llama-server) with a role-aware
 * system prompt, then falls back to a deterministic, role-aware responder.
 * Neither path ever receives canonical truth or hidden evidence, so neither
 * can reveal them. Context and response lengths are capped.
 */
type LlmProvider = 'local' | 'openai' | 'gemini';

function resolveLlmConfig(): { url: string; model: string; apiKey: string; provider: LlmProvider; enabled: boolean } {
  const enabled = process.env.USE_LLM !== 'false';
  const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const explicitProvider = (process.env.LLM_PROVIDER || '').toLowerCase();
  const provider: LlmProvider =
    explicitProvider === 'gemini' ? 'gemini' :
    explicitProvider === 'openai' ? 'openai' :
    explicitProvider === 'local' ? 'local' :
    apiKey && !process.env.LLM_URL ? 'gemini' : 'local';

  const defaultUrl = provider === 'gemini'
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    : 'http://127.0.0.1:8080/v1/chat/completions';
  const defaultModel = provider === 'gemini' ? 'gemini-2.0-flash' : 'qwen2.5-1.5b-instruct';

  return {
    url: process.env.LLM_URL || defaultUrl,
    model: process.env.LLM_MODEL || defaultModel,
    apiKey,
    provider,
    enabled,
  };
}

/**
 * Responder spec: one shared inference architecture, many grounded voices.
 * The legacy path constructs this from the detected team role; the M2
 * specialist path constructs it from a specialist DTO. Both feed the same
 * generateAIResponse function, so LLM and deterministic paths stay aligned.
 */
interface ResponderSpec {
  label: string;
  systemHint: string;
  fallbackFn: (message: string, addressed: SuspectContextInput[]) => string;
}

async function generateAIResponse(
  message: string,
  context: string,
  responderSpec: ResponderSpec,
  addressed: SuspectContextInput[],
): Promise<{ content: string }> {
  const cfg = resolveLlmConfig();
  const label = responderSpec.label;

  if (cfg.enabled) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            {
              role: 'system',
              content: `You are the ${label} on an AI investigative team in a detective game. ${responderSpec.systemHint} Stay in character. Use ONLY the provided investigation context. NEVER reveal unreleased evidence, character secrets, the culprit, or the canonical solution. NEVER invent new evidence, quotes or source URLs. Challenge weak theories politely. Be concise (max ~80 words).\n\n${context}`,
            },
            { role: 'user', content: message },
          ],
          max_tokens: 220,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json() as any;
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (content) return { content: capResponse(`${label}: ${content}`) };
      } else {
        console.warn(`[AI] ${cfg.provider} request failed: ${res.status}`);
      }
    } catch (err) {
      console.warn(`[AI] ${cfg.provider} unavailable, using deterministic fallback:`, (err as Error)?.message ?? err);
    }
  }

  return { content: capResponse(responderSpec.fallbackFn(message, addressed)) };
}

const server = app.listen(PORT, () => {
  console.log(`🔍 THE INVESTIGATION API running on port ${PORT}`);
});

// ---------------------------------------------------------------------------
// PROD-008: in-process progression scheduler (MVP)
// ---------------------------------------------------------------------------
// Sweeps all active investigations for due scheduled events. This is a
// single-process, best-effort timer: scheduled events are persisted in Postgres
// and `processProgression` also runs on every investigation read, so a restart
// or a multi-instance deployment still catches up correctly on the next read.
// A distributed worker/queue is a future concern, not an MVP requirement.
const SCHEDULER_INTERVAL_MS = Number(process.env.PROGRESSION_INTERVAL_MS) || 60_000;
const scheduler = setInterval(() => {
  runSchedulerSweep().catch((err) => {
    console.error('Progression sweep failed:', err);
  });
}, SCHEDULER_INTERVAL_MS);
scheduler.unref(); // never keep the process alive solely for the timer

function stopBackgroundTasks(): void {
  clearInterval(scheduler);
  clearInterval(rateSweeper);
  // Close the listener too: with signal handlers registered Node will not exit
  // on its own, and the test harness relies on a clean SIGTERM shutdown.
  server.closeAllConnections();
  server.close(() => process.exit(0));
}
process.on('SIGTERM', stopBackgroundTasks);
process.on('SIGINT', stopBackgroundTasks);

export default server;
