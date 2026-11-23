import { Pool } from 'pg';
import crypto from 'crypto';
import { computeEvidenceProgress } from './progress';

// Database configuration
// Using socket-based authentication for local development
// In production, use connection string from environment

const connectionConfig: any = {
  host: process.env.PGHOST || '/var/run/postgresql',
  database: process.env.PGDATABASE || 'investigation',
  ...(process.env.PGUSER ? { user: process.env.PGUSER } : {}),
  ...(process.env.PGPASSWORD ? { password: process.env.PGPASSWORD } : {}),
  ...(process.env.PGPORT ? { port: Number(process.env.PGPORT) } : {}),
};

// Check if we should use connection string (production) or socket (development)
const useConnectionString = process.env.DATABASE_URL ? true : false;

export const pool = new Pool(
  useConnectionString
    ? { connectionString: process.env.DATABASE_URL }
    : connectionConfig
);

// Backward-compatible export name used by older server code.
export const database = pool;

const COLUMN_ALIASES: Record<string, string> = {
  case_id: 'caseId',
  user_id: 'userId',
  investigation_id: 'investigationId',
  player_visible: 'playerVisible',
  discovery_order: 'discoveryOrder',
  discovered_evidence_ids: 'discoveredEvidenceIds',
  hidden_interpretation: 'hiddenInterpretation',
  discovery_conditions: 'discoveryConditions',
  release_conditions: 'releaseConditions',
  timeline_reference: 'timelineReference',
  associated_characters: 'associatedCharacters',
  supported_hypotheses: 'supportedHypotheses',
  contradicted_hypotheses: 'contradictedHypotheses',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  password_hash: 'passwordHash',
  notification_settings: 'notificationSettings',
  publication_status: 'publicationStatus',
  caseversion: 'caseVersion',
  canonical_package_reference: 'canonicalPackageReference',
  initial_characters: 'initialCharacters',
  initial_facts: 'initialFacts',
  start_timestamp: 'startTimestamp',
  current_stage: 'currentStage',
  completion_timestamp: 'completionTimestamp',
  current_theory: 'currentTheory',
  suspicion_level: 'suspicionLevel',
  pending_events: 'pendingEvents',
  theory_history: 'theoryHistory',
  current_theories: 'currentTheories',
  suspicion_levels: 'suspicionLevels',
  completed_checkpoints: 'completedCheckpoints',
  investigation_stage: 'investigationStage',
  last_updated: 'lastUpdated',
  message_history: 'messageHistory',
  context_references: 'contextReferences',
  entry_type: 'entryType',
  related_evidence_ids: 'relatedEvidenceIds',
  is_confirmed: 'isConfirmed',
  creation_timestamp: 'creationTimestamp',
  event_type: 'eventType',
  trigger_condition: 'triggerCondition',
  scheduled_timestamp: 'scheduledTimestamp',
  release_status: 'releaseStatus',
  associated_evidence: 'associatedEvidence',
  narrative_payload: 'narrativePayload',
  submitted_culprit: 'submittedCulprit',
  supporting_evidence: 'supportingEvidence',
  evaluation_result: 'evaluationResult',
  submission_timestamp: 'submissionTimestamp',
  accusation_attempts: 'accusationAttempts',
  last_accusation_at: 'lastAccusationAt',
  accusation_cooldown_until: 'accusationCooldownUntil',
  resolved_at: 'resolvedAt',
  release_date: 'releaseDate',
  included_case_ids: 'includedCaseIds',
  featured_case_id: 'featuredCaseId',
  achievement_type: 'achievementType',
  unlocked_at: 'unlockedAt',
  dialogue_constraints: 'dialogueConstraints',
  confirmed_alibi: 'confirmedAlibi',
  // M2 knowledge system (migration 006).
  specialist_key: 'specialistKey',
  knowledge_domains: 'knowledgeDomains',
  communication_style: 'communicationStyle',
  reasoning_approach: 'reasoningApproach',
  expertise_summary: 'expertiseSummary',
  real_discipline_basis: 'realDisciplineBasis',
  display_order: 'displayOrder',
  case_relevance: 'caseRelevance',
  artifact_key: 'artifactKey',
  artifact_type: 'artifactType',
  source_author: 'sourceAuthor',
  source_url: 'sourceUrl',
  source_verified: 'sourceVerified',
  bibliography_ref: 'bibliographyRef',
  publication_date: 'publicationDate',
  knowledge_class: 'knowledgeClass',
  related_concepts: 'relatedConcepts',
  usage_note: 'usageNote',
  is_fictional: 'isFictional',
  disagreement_key: 'disagreementKey',
  specialist_a_id: 'specialistAId',
  specialist_b_id: 'specialistBId',
  specialist_a_key: 'specialistAKey',
  specialist_b_key: 'specialistBKey',
  specialist_a_name: 'specialistAName',
  specialist_b_name: 'specialistBName',
  position_a: 'positionA',
  position_b: 'positionB',
  disciplinary_basis: 'disciplinaryBasis',
  uncertainty_note: 'uncertaintyNote',
  distinguishing_evidence: 'distinguishingEvidence',
  related_artifact_keys: 'relatedArtifactKeys',
  artifact_id: 'artifactId',
  source_snapshot: 'sourceSnapshot',
  // M4 Reality Map (migration 008).
  claim_category: 'claimCategory',
  source_journal_entry_id: 'sourceJournalEntryId',
  source_notebook_entry_id: 'sourceNotebookEntryId',
  is_tutorial: 'isTutorial',
  owner_type: 'ownerType',
  owner_id: 'ownerId',
  target_type: 'targetType',
  target_id: 'targetId',
  missing_information: 'missingInformation',
  alternative_explanations: 'alternativeExplanations',
  player_notes: 'playerNotes',
  // M5 Perspective Engine (migration 009).
  framework_key: 'frameworkKey',
  intellectual_domain: 'intellectualDomain',
  core_questions: 'coreQuestions',
  key_concepts: 'keyConcepts',
  method_of_reasoning: 'methodOfReasoning',
  common_misconceptions: 'commonMisconceptions',
  internal_differences: 'internalDifferences',
  relevant_disciplines: 'relevantDisciplines',
  experience_key: 'experienceKey',
  perspective_class: 'perspectiveClass',
  scope_note: 'scopeNote',
  tradition_scope: 'traditionScope',
  intellectual_purpose: 'intellectualPurpose',
  primary_question: 'primaryQuestion',
  intellectual_background: 'intellectualBackground',
  main_idea: 'mainIdea',
  detailed_explanation: 'detailedExplanation',
  historical_context: 'historicalContext',
  epistemic_breakdown: 'epistemicBreakdown',
  supporting_sources: 'supportingSources',
  counterarguments: 'counterarguments',
  reflection_questions: 'reflectionQuestions',
  recommendation_tags: 'recommendationTags',
  related_experience_keys: 'relatedExperienceKeys',
  related_specialist_keys: 'relatedSpecialistKeys',
  related_case_titles: 'relatedCaseTitles',
  estimated_minutes: 'estimatedMinutes',
  source_perspective_experience_id: 'sourcePerspectiveExperienceId',
  source_perspective_reflection_id: 'sourcePerspectiveReflectionId',
  perspective_experience_id: 'perspectiveExperienceId',
  reflection_kind: 'reflectionKind',
  prompt_index: 'promptIndex',
  reason_code: 'reasonCode',
  state_fingerprint: 'stateFingerprint',
};

function toCamelKey(key: string): string {
  if (COLUMN_ALIASES[key]) return COLUMN_ALIASES[key];
  if (!key.includes('_')) return key;
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function mapRow<T = any>(row: any): T {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row as T;
  const mapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = toCamelKey(key);
    mapped[camel] = value;
    // Preserve original key if different, to avoid breaking any legacy access.
    if (camel !== key && mapped[key] === undefined) mapped[key] = value;
  }
  return mapped as T;
}

function mapRows<T = any>(rows: any[]): T[] {
  return rows.map((r) => mapRow<T>(r));
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string | undefined | null): boolean {
  if (!stored) return false;
  if (!stored.startsWith('scrypt:')) {
    // Legacy plaintext fallback for existing dev rows; do not use for new passwords.
    return password === stored;
  }
  const [, salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(actual, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

// Helper to run queries
export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ===== USER OPERATIONS =====

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  preferences?: any;
  notificationSettings?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Investigation {
  id: string;
  userId: string;
  caseId: string;
  status?: string;
  startTimestamp?: Date;
  currentStage?: string;
  progress?: number;
  completionTimestamp?: Date;
  currentTheory?: string;
  suspicionLevel?: string;
  discoveredEvidenceIds?: string[];
  pendingEvents?: any;
  theoryHistory?: any;
  createdAt?: Date;
  updatedAt?: Date;
  // PROD-010: server-owned accusation integrity bookkeeping (never client-writable).
  accusationAttempts?: number;
  lastAccusationAt?: Date;
  accusationCooldownUntil?: Date;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] ? mapRow<User>(result.rows[0]) : null;
}

export async function createUser(email: string, password: string): Promise<User> {
  const passwordHash = hashPassword(password);
  const result = await query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *`,
    [email, passwordHash]
  );
  return mapRow<User>(result.rows[0]);
}

export async function verifyUserPassword(email: string, password: string): Promise<User | null> {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  if (result.rows.length === 0) return null;
  const user = mapRow<User>(result.rows[0]);
  return verifyPassword(password, user.passwordHash) ? user : null;
}

// ===== NOTIFICATION SETTINGS (GAP-14, P2) =====
//
// MVP-only in-app preferences. Stored in the existing `users.notification_settings`
// JSONB column (no schema change). Only the boolean allowlist below is ever
// read or written, so a client cannot stash arbitrary/canonical data here.

/** Player-facing notification preferences. No push, email or hidden data. */
export interface NotificationSettings {
  /** Highlight new development-log entries in the investigation room. */
  developments: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = { developments: true };

/** Coerce an untrusted JSONB value into the safe, explicit preference shape. */
export function normalizeNotificationSettings(raw: unknown): NotificationSettings {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  return {
    developments: typeof obj.developments === 'boolean'
      ? obj.developments
      : DEFAULT_NOTIFICATION_SETTINGS.developments,
  };
}

/** Read a user's notification preferences, falling back to safe defaults. */
export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  const result = await query('SELECT notification_settings FROM users WHERE id = $1', [userId]);
  return normalizeNotificationSettings(result.rows[0]?.notification_settings);
}

/**
 * Merge a partial, untrusted patch into the allowlisted preferences and persist
 * it. Unknown keys and non-boolean values are ignored. Returns the full,
 * normalized settings so the client can render from the server response.
 */
export async function updateNotificationSettings(
  userId: string,
  patch: unknown
): Promise<NotificationSettings> {
  const current = await getNotificationSettings(userId);
  const obj = patch && typeof patch === 'object' && !Array.isArray(patch)
    ? (patch as Record<string, unknown>)
    : {};
  const next: NotificationSettings = { ...current };
  if (typeof obj.developments === 'boolean') next.developments = obj.developments;
  await query(
    'UPDATE users SET notification_settings = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(next), userId]
  );
  return next;
}

// ===== USER ONBOARDING (M8 Wave 1) =====
//
// Per-user, player-owned first-experience progress. Stored in the additive
// `user_onboarding` table (migration 012). This carries NO canonical truth and
// no hidden evidence. Every field read/written here goes through an explicit
// allowlist so a client cannot stash arbitrary (or canonical) data in jsonb.

/**
 * Player-owned first-experience flags. Every key is allowlisted in
 * ONBOARDING_TUTORIAL_KEYS and values are always booleans. This is UI state only
 * (no canonical/hidden data). Slice 1 introduced the contextual tab-tip keys;
 * slice 2 adds a few more tips plus the first-investigation checklist steps.
 */
export interface OnboardingTutorialState {
  // Contextual tab tips (slice 1).
  reality?: boolean;
  perspectives?: boolean;
  fieldResearch?: boolean;
  // Contextual tab tips (slice 2).
  evidenceTip?: boolean;
  suspectsTip?: boolean;
  chatTip?: boolean;
  // First-investigation interactive checklist (slice 2).
  guideCompleted?: boolean;
  stepBriefing?: boolean;
  stepEvidence?: boolean;
  stepChat?: boolean;
  stepClaims?: boolean;
  stepFieldResearch?: boolean;
  stepVerdict?: boolean;
}

/** Safe, player-facing onboarding projection returned by the API. */
export interface OnboardingState {
  welcomeSeen: boolean;
  introCompleted: boolean;
  skipped: boolean;
  lastStep: string | null;
  tutorialState: OnboardingTutorialState;
  /** True when the user finished OR skipped the intro (never shown again). */
  completed: boolean;
}

const ONBOARDING_TUTORIAL_KEYS = [
  'reality', 'perspectives', 'fieldResearch',
  'evidenceTip', 'suspectsTip', 'chatTip',
  'guideCompleted',
  'stepBriefing', 'stepEvidence', 'stepChat', 'stepClaims', 'stepFieldResearch', 'stepVerdict',
] as const;
const MAX_ONBOARDING_STEP_LENGTH = 80;

function normalizeTutorialState(raw: unknown): OnboardingTutorialState {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const out: OnboardingTutorialState = {};
  for (const key of ONBOARDING_TUTORIAL_KEYS) {
    if (typeof obj[key] === 'boolean') out[key] = obj[key] as boolean;
  }
  return out;
}

function mapOnboardingRow(row: any): OnboardingState {
  const introCompleted = row?.intro_completed === true;
  const skipped = row?.skipped === true;
  return {
    welcomeSeen: row?.welcome_seen === true,
    introCompleted,
    skipped,
    lastStep: typeof row?.last_step === 'string' && row.last_step.trim()
      ? row.last_step.trim().slice(0, MAX_ONBOARDING_STEP_LENGTH)
      : null,
    tutorialState: normalizeTutorialState(row?.tutorial_state),
    completed: introCompleted || skipped,
  };
}

/** Read a user's onboarding state, lazily creating a safe default row. */
export async function getOnboarding(userId: string): Promise<OnboardingState> {
  await query(
    `INSERT INTO user_onboarding (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  const result = await query('SELECT * FROM user_onboarding WHERE user_id = $1', [userId]);
  return mapOnboardingRow(result.rows[0]);
}

/**
 * Merge a partial, untrusted patch into the allowlisted onboarding fields and
 * persist it. Unknown keys/non-boolean values are ignored; tutorialState is a
 * shallow merge over only the allowlisted boolean keys. Returns the full,
 * normalized state so the client can render from the server response.
 */
export async function updateOnboarding(
  userId: string,
  patch: unknown
): Promise<OnboardingState> {
  // Ensure the row exists before reading/merging (idempotent, race-safe).
  await getOnboarding(userId);
  const obj = patch && typeof patch === 'object' && !Array.isArray(patch)
    ? (patch as Record<string, unknown>)
    : {};

  const current = await query(
    'SELECT tutorial_state FROM user_onboarding WHERE user_id = $1',
    [userId]
  );
  const mergedTutorial = normalizeTutorialState(current.rows[0]?.tutorial_state);
  if (obj.tutorialState && typeof obj.tutorialState === 'object' && !Array.isArray(obj.tutorialState)) {
    const incoming = normalizeTutorialState(obj.tutorialState);
    for (const key of ONBOARDING_TUTORIAL_KEYS) {
      const value = incoming[key];
      if (typeof value === 'boolean') mergedTutorial[key] = value;
    }
  }

  const assignments: string[] = ['tutorial_state = $1', 'updated_at = NOW()'];
  const params: any[] = [JSON.stringify(mergedTutorial)];

  const addBoolean = (column: string, value: boolean): void => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };
  if (typeof obj.welcomeSeen === 'boolean') addBoolean('welcome_seen', obj.welcomeSeen);
  if (typeof obj.introCompleted === 'boolean') addBoolean('intro_completed', obj.introCompleted);
  if (typeof obj.skipped === 'boolean') addBoolean('skipped', obj.skipped);

  if (typeof obj.lastStep === 'string' && obj.lastStep.trim()) {
    params.push(obj.lastStep.trim().slice(0, MAX_ONBOARDING_STEP_LENGTH));
    assignments.push(`last_step = $${params.length}`);
  } else if (obj.lastStep === null) {
    params.push(null);
    assignments.push(`last_step = $${params.length}`);
  }

  params.push(userId);
  const result = await query(
    `UPDATE user_onboarding SET ${assignments.join(', ')} WHERE user_id = $${params.length} RETURNING *`,
    params
  );
  return mapOnboardingRow(result.rows[0]);
}

// ===== SESSION OPERATIONS (P2-SESSIONS) =====
//
// Durable, DB-backed sessions replace the old in-memory Map. The raw token is
// only ever held by the client in the `session_token` cookie; the database
// stores a SHA-256 digest of it, so a DB read cannot be replayed as a cookie.
// The token itself is 32 random bytes (64 hex chars), so hashing adds defence
// in depth without any lookup cost (the digest is the primary key).

/** A session row joined with the owning user's email (for /api/me). */
export interface Session {
  tokenHash: string;
  userId: string;
  email: string;
  expiresAt: Date;
  createdAt: Date;
}

/** Digest used as the DB primary key. Never store the raw cookie token. */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(tokenHash: string, userId: string, expiresAt: Date): Promise<void> {
  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (token_hash) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           expires_at = EXCLUDED.expires_at,
           created_at = now()`,
    [tokenHash, userId, expiresAt]
  );
}

/** Returns the session (with email) or null when absent/expired. */
export async function getSessionByTokenHash(tokenHash: string): Promise<Session | null> {
  const result = await query(
    `SELECT s.token_hash, s.user_id, s.expires_at, s.created_at, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1`,
    [tokenHash]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    tokenHash: row.token_hash,
    userId: row.user_id,
    email: row.email,
    expiresAt: row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
}

/** Best-effort cleanup of stale rows; safe to call periodically. */
export async function deleteExpiredSessions(): Promise<void> {
  await query('DELETE FROM sessions WHERE expires_at <= now()', []);
}

// ===== RATE-LIMIT OPERATIONS (P2-RATE-LIMITS) =====
//
// Durable fixed-window counters replace the old in-memory Map. A single atomic
// INSERT ... ON CONFLICT DO UPDATE ... RETURNING statement advances the counter
// so concurrent requests cannot race. The raw bucket key (which includes the
// client IP) is hashed before it ever reaches the database; only the digest is
// persisted. This is consistent with how session tokens are stored above.

/** Stable digest used as the DB primary key. Never persist the raw client IP. */
export function hashRateLimitKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export interface RateLimitState {
  count: number;
  windowStart: Date;
  resetAt: Date;
}

/**
 * Atomically consume one request from a fixed-window bucket.
 *
 * When `now` is at/after the stored `reset_at`, the window is rotated: count
 * resets to 1 and the new window bounds are applied. Otherwise the existing
 * count is incremented and its bounds are kept. The whole read-modify-write is
 * one statement so it is safe under concurrency.
 */
export async function consumeRateLimit(
  keyHash: string,
  now: Date,
  resetAt: Date
): Promise<RateLimitState> {
  const result = await query(
    `INSERT INTO rate_limits (key_hash, window_start, reset_at, count)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (key_hash) DO UPDATE
        SET count = CASE WHEN rate_limits.reset_at <= $2 THEN 1 ELSE rate_limits.count + 1 END,
            window_start = CASE WHEN rate_limits.reset_at <= $2 THEN $2 ELSE rate_limits.window_start END,
            reset_at = CASE WHEN rate_limits.reset_at <= $2 THEN $3 ELSE rate_limits.reset_at END
     RETURNING count, window_start, reset_at`,
    [keyHash, now, resetAt]
  );
  const row = result.rows[0];
  return {
    count: Number(row.count),
    windowStart: row.window_start instanceof Date ? row.window_start : new Date(row.window_start),
    resetAt: row.reset_at instanceof Date ? row.reset_at : new Date(row.reset_at),
  };
}

/** Best-effort cleanup of expired windows; safe to call periodically. */
export async function deleteExpiredRateLimits(): Promise<void> {
  await query('DELETE FROM rate_limits WHERE reset_at <= now()', []);
}

// ===== CASE OPERATIONS =====

export interface Case {
  id: string;
  title: string;
  description?: string;
  genre?: string;
  difficulty?: string;
  duration?: string;
  publicationStatus?: string;
  caseVersion?: string;
  canonicalPackageReference?: string;
  briefing: string;
  initialCharacters?: any;
  initialFacts?: any;
  objectives: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Case library routes

export async function getAllCases(filters?: {
  genre?: string;
  difficulty?: string;
  duration?: string;
  search?: string;
}) {
  let sql = 'SELECT * FROM cases';
  const conditions: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (filters) {
    if (filters.genre) {
      conditions.push(`genre = $${paramCount}`);
      values.push(filters.genre);
      paramCount++;
    }
    if (filters.difficulty) {
      conditions.push(`difficulty = $${paramCount}`);
      values.push(filters.difficulty);
      paramCount++;
    }
    if (filters.duration) {
      conditions.push(`duration = $${paramCount}`);
      values.push(filters.duration);
      paramCount++;
    }
    if (filters.search) {
      conditions.push(`(title ILIKE $${paramCount} OR description ILIKE $${paramCount + 1})`);
      values.push(`%${filters.search}%`, `%${filters.search}%`);
      paramCount += 2;
    }
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY title';
  
  const result = await query(sql, values);
  return mapRows(result.rows);
}

function toSafeEvidence(row: any) {
  const ev = mapRow<any>(row);
  return {
    id: ev.id,
    caseId: ev.caseId,
    category: ev.category,
    source: ev.source,
    description: ev.description,
    reliability: ev.reliability,
    associatedCharacters: ev.associatedCharacters,
    timelineReference: ev.timelineReference,
    playerVisible: !!ev.playerVisible,
    discoveryOrder: ev.discoveryOrder,
    createdAt: ev.createdAt,
    updatedAt: ev.updatedAt,
  };
}

export async function getCaseById(caseId: string, playerUserId?: string) {
  const result = await query('SELECT * FROM cases WHERE id = $1', [caseId]);

  if (result.rows.length === 0) return null;

  const caseData = mapRow<any>(result.rows[0]);

  // Get the player's discovered evidence for this case across ALL owned
  // investigations (active OR completed). Evidence discovered or server-released
  // during play must remain visible in the archive/resolution view after the
  // investigation is completed. Ownership is still enforced by user_id + case_id,
  // and only safe evidence fields are ever returned (see toSafeEvidence).
  let discoveredEvidenceIds: string[] = [];
  if (playerUserId) {
    const invResult = await query(
      'SELECT discovered_evidence_ids FROM investigations WHERE user_id = $1 AND case_id = $2',
      [playerUserId, caseId]
    );
    for (const row of invResult.rows) {
      const inv = mapRow<any>(row);
      if (Array.isArray(inv.discoveredEvidenceIds)) {
        discoveredEvidenceIds.push(...inv.discoveredEvidenceIds);
      }
    }
  }

  // Get evidence items visible to player - never expose hidden interpretation fields
  const evidenceResult = await query(
    `SELECT id, case_id, category, source, description, reliability, associated_characters, timeline_reference, player_visible, discovery_order, created_at, updated_at
     FROM evidence WHERE case_id = $1 ORDER BY discovery_order ASC NULLS LAST`,
    [caseId]
  );

  const allEvidence = mapRows<any>(evidenceResult.rows);
  const visibleEvidence = allEvidence
    .filter((ev: any) => ev.playerVisible || discoveredEvidenceIds.includes(ev.id))
    .map(toSafeEvidence);

  return {
    ...caseData,
    visibleEvidence,
  };
}

export interface GetCaseByIdResult extends Case {
  visibleEvidence: any[];
}

// Character routes

export async function getCharactersByCase(caseId: string) {
  const result = await query('SELECT * FROM characters WHERE case_id = $1', [caseId]);
  return mapRows(result.rows);
}

// Evidence routes

export async function getEvidenceById(evidenceId: string) {
  const result = await query('SELECT * FROM evidence WHERE id = $1', [evidenceId]);
  return result.rows[0] ? mapRow<any>(result.rows[0]) : null;
}

export async function getSafeEvidenceById(evidenceId: string) {
  const row = await getEvidenceById(evidenceId);
  return row ? toSafeEvidence(row) : null;
}

export async function getEvidenceByCase(case_id: string, playerUserId?: string) {
  // Start with empty discovered evidence list
  let discoveredEvidenceIds: string[] = [];

  // If playerUserId is provided, gather discovered evidence from ALL owned
  // investigations for this case (active OR completed). Completed investigations
  // must keep their revealed/discovered evidence visible in the archive view.
  // The lookup is scoped by user_id + case_id so a player only ever sees their
  // own discoveries; hidden interpretation fields are never selected.
  if (playerUserId) {
    const invResult = await query(
      'SELECT discovered_evidence_ids FROM investigations WHERE user_id = $1 AND case_id = $2',
      [playerUserId, case_id]
    );
    for (const row of invResult.rows) {
      const inv = mapRow<any>(row);
      if (Array.isArray(inv.discoveredEvidenceIds)) {
        discoveredEvidenceIds.push(...inv.discoveredEvidenceIds);
      }
    }
  }

  // Query evidence for the case - exclude hidden interpretation fields
  const result = await query(
    `SELECT id, case_id, category, source, description, reliability, associated_characters, timeline_reference, player_visible, discovery_order, created_at, updated_at
     FROM evidence WHERE case_id = $1 ORDER BY discovery_order ASC NULLS LAST`,
    [case_id]
  );

  const allEvidence = mapRows<any>(result.rows);
  return allEvidence
    .filter((ev: any) => ev.playerVisible || discoveredEvidenceIds.includes(ev.id))
    .map(toSafeEvidence);
}

/**
 * PROD-013 (GAP-08): read the player's own suspicion notes for an
 * investigation. `suspicion_levels` is a free-form jsonb map written by the
 * player's investigative flow; only scalar string/number values are returned
 * so it can be projected onto a safe suspect DTO. No canonical data is read.
 */
export async function getInvestigationSuspicionLevels(
  investigationId: string
): Promise<Record<string, string>> {
  const result = await query(
    'SELECT suspicion_levels FROM investigation_state WHERE investigation_id = $1',
    [investigationId]
  );
  const raw = result.rows[0]?.suspicion_levels;
  const levels: Record<string, string> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' || typeof value === 'number') {
        levels[key] = String(value);
      }
    }
  }
  return levels;
}

// Investigation routes

export async function createInvestigation(userId: string, caseId: string) {
  // Check if user already has an active investigation
  const existing = await query(
    'SELECT * FROM investigations WHERE user_id = $1 AND status = $2',
    [userId, 'active']
  );

  if (existing.rows.length > 0) {
    return mapRow<Investigation>(existing.rows[0]); // User already has an active case
  }

  const result = await query(
    `INSERT INTO investigations (user_id, case_id, status, progress) VALUES ($1, $2, 'active', 0) RETURNING *`,
    [userId, caseId]
  );

  const investigation = mapRow<Investigation>(result.rows[0]);

  // Also create initial investigation state
  await query(
    `INSERT INTO investigation_state (investigation_id, discovered_evidence_ids, current_theories, suspicion_levels, completed_checkpoints, investigation_stage)
     VALUES ($1, '{}'::uuid[], '{}'::jsonb, '{}'::jsonb, '{}'::text[], 'available')`,
    [investigation.id]
  );

  return investigation;
}

export async function getActiveInvestigation(userId: string) {
  const result = await query(
    'SELECT * FROM investigations WHERE user_id = $1 AND status = $2',
    [userId, 'active']
  );
  return result.rows[0] ? mapRow<Investigation>(result.rows[0]) : null;
}

/**
 * PROD-012 (GAP-10): abandon an investigation to release the one-active-case
 * lock WITHOUT destroying case history. The row stays in the database with a
 * clear `abandoned` status; discovered evidence, journal entries, conversation
 * and accusations are deliberately left intact. Because getActiveInvestigation
 * only matches `status = 'active'`, the player can immediately start a new case.
 *
 * Completed cases are excluded: their verdict/solution/archive semantics are
 * final and must never be overwritten by an abandon. The conditional UPDATE is
 * also the DB-side guard against a verdict completing the case in the small
 * window between the HTTP status check and this write (returns null then).
 *
 * No canonical_truth data is read or returned here.
 */
export async function abandonInvestigation(investigationId: string) {
  const result = await query(
    `UPDATE investigations
        SET status = 'abandoned', updated_at = NOW()
      WHERE id = $1
        AND status IS DISTINCT FROM 'completed'
        AND status IS DISTINCT FROM 'abandoned'
      RETURNING *`,
    [investigationId]
  );
  return result.rows[0] ? mapRow<Investigation>(result.rows[0]) : null;
}

/**
 * Player-facing archive: the current user's finished, abandoned or paused
 * investigations. Abandoned cases stay visible with an explicit status so case
 * history is never silently lost. Only safe fields are projected; canonical
 * truth / hidden data is never read.
 */
export async function getInvestigationsArchive(userId: string) {
  const result = await query(
    `SELECT i.id, i.case_id, i.status, i.progress, i.start_timestamp,
            i.completion_timestamp, i.updated_at,
            c.title AS case_title,
            (SELECT a.evaluation_result
               FROM accusations a
              WHERE a.investigation_id = i.id
              ORDER BY a.submission_timestamp DESC
              LIMIT 1) AS evaluation_result
       FROM investigations i
       LEFT JOIN cases c ON c.id = i.case_id
      WHERE i.user_id = $1 AND i.status IN ('completed', 'accusationFailed', 'abandoned')
      ORDER BY COALESCE(i.completion_timestamp, i.updated_at) DESC NULLS LAST`,
    [userId]
  );
  return mapRows<any>(result.rows);
}

export async function updateInvestigation(
  investigationId: string,
  data: Partial<Investigation>
) {
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (data.status !== undefined) {
    setClauses.push(`status = $${paramCount}`);
    values.push(data.status);
    paramCount++;
  }
  if (data.currentStage !== undefined) {
    setClauses.push(`current_stage = $${paramCount}`);
    values.push(data.currentStage);
    paramCount++;
  }
  if (data.progress !== undefined) {
    setClauses.push(`progress = $${paramCount}`);
    values.push(data.progress);
    paramCount++;
  }
  if (data.currentTheory !== undefined) {
    setClauses.push(`current_theory = $${paramCount}`);
    values.push(data.currentTheory);
    paramCount++;
  }
  if (data.suspicionLevel !== undefined) {
    setClauses.push(`suspicion_level = $${paramCount}`);
    values.push(data.suspicionLevel);
    paramCount++;
  }
  if (data.pendingEvents !== undefined) {
    setClauses.push(`pending_events = $${paramCount}`);
    values.push(JSON.stringify(data.pendingEvents));
    paramCount++;
  }
  if (data.theoryHistory !== undefined) {
    setClauses.push(`theory_history = $${paramCount}`);
    values.push(JSON.stringify(data.theoryHistory));
    paramCount++;
  }

  values.push(investigationId);
  
  if (setClauses.length === 0) return getInvestigationById(investigationId);

  const result = await query(
    `UPDATE investigations SET ${setClauses.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );
  return result.rows[0] ? mapRow<Investigation>(result.rows[0]) : null;
}

// Add discovered evidence IDs to investigation
export async function addDiscoveredEvidence(
  investigationId: string,
  evidenceId: string
) {
  const investigation = await getInvestigationById(investigationId);
  if (!investigation) return null;
  
  const currentIds = investigation.discoveredEvidenceIds || [];
  const newIds = [...new Set([...currentIds, evidenceId])];

  // GAP-12: progress is relative to the case's real evidence count, not a
  // hardcoded 20 (which capped a 10-evidence case at 50%).
  const totalRes = await query(
    'SELECT COUNT(*)::int AS total FROM evidence WHERE case_id = $1',
    [investigation.caseId]
  );
  const totalEvidence = Number(totalRes.rows[0]?.total ?? 0);
  const progress = computeEvidenceProgress(newIds.length, totalEvidence);

  await query(
    `UPDATE investigations SET discovered_evidence_ids = $1::uuid[], progress = $2 WHERE id = $3`,
    [newIds, progress, investigationId]
  );
  
  // Return updated investigation
  return await getInvestigationById(investigationId);
}

export async function getInvestigationById(investigationId: string) {
  const result = await query('SELECT * FROM investigations WHERE id = $1', [investigationId]);
  return result.rows[0] ? mapRow<Investigation>(result.rows[0]) : null;
}

// Conversation routes

export interface Message {
  role: string;
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  investigationId: string;
  participants: string[];
  messageHistory: Message[];
  summary: string;
  contextReferences: any;
  createdAt: Date;
  updatedAt: Date;
}

export async function createConversation(investigationId: string, participants: string[]) {
  const result = await query(
    `INSERT INTO conversations (investigation_id, participants, message_history, summary, context_references)
     VALUES ($1, $2::text[], '[]'::jsonb, '', '{}'::jsonb) RETURNING *`,
    [investigationId, participants]
  );
  return mapRow<Conversation>(result.rows[0]);
}

export async function getConversation(investigationId: string) {
  const result = await query(
    'SELECT * FROM conversations WHERE investigation_id = $1',
    [investigationId]
  );
  return result.rows[0] ? mapRow<Conversation>(result.rows[0]) : null;
}

export async function addMessage(
  investigationId: string,
  role: string,
  content: string,
  meta?: Record<string, unknown>
) {
  let conversation = await getConversation(investigationId);

  if (!conversation) {
    conversation = await createConversation(investigationId, [role]);
  }

  // M2: optional responder metadata (specialistKey/Name, intent, depth) is
  // merged onto the stored message. Existing 3-argument callers are unchanged,
  // so legacy chat history keeps its original shape. Reserved fields are never
  // overwritten by caller-supplied meta.
  const storedMessage: Record<string, unknown> = {
    role,
    content,
    timestamp: new Date(),
  };
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    for (const [key, value] of Object.entries(meta)) {
      if (key === 'role' || key === 'content' || key === 'timestamp') continue;
      storedMessage[key] = value;
    }
  }

  const existingHistory = Array.isArray(conversation.messageHistory) ? conversation.messageHistory : [];
  const messageHistory = existingHistory.concat(storedMessage as unknown as Message);

  const result = await query(
    `UPDATE conversations
     SET message_history = $1::jsonb, summary = $2, context_references = $3::jsonb, updated_at = NOW()
     WHERE investigation_id = $4
     RETURNING *`,
    [
      JSON.stringify(messageHistory),
      conversation.summary ?? '',
      JSON.stringify(conversation.contextReferences ?? {}),
      investigationId,
    ]
  );
  return result.rows[0] ? mapRow<Conversation>(result.rows[0]) : null;
}

/**
 * PROD-014 (GAP-09): persist the rolling conversation memory. `summary` is a
 * bounded, player-safe text projection; `contextReferences` carries the count
 * of already-summarized messages so the next turn only folds in new turns
 * (no duplicate accumulation). Both columns already exist in the schema - no
 * migration required. No canonical data is ever written here.
 */
export async function updateConversationMemory(
  investigationId: string,
  summary: string,
  contextReferences: Record<string, unknown>
) {
  const result = await query(
    `UPDATE conversations
     SET summary = $2, context_references = $3::jsonb, updated_at = NOW()
     WHERE investigation_id = $1
     RETURNING *`,
    [investigationId, summary, JSON.stringify(contextReferences)]
  );
  return result.rows[0] ? mapRow<Conversation>(result.rows[0]) : null;
}

// Journal routes

export interface JournalEntry {
  id: string;
  investigationId: string;
  entryType: string;
  content: string;
  relatedEvidenceIds: string[];
  isConfirmed: boolean;
  creationTimestamp: Date;
}

export async function createJournalEntry(
  investigationId: string,
  data: {
    entryType: string;
    content: string;
    relatedEvidenceIds?: string[];
    isConfirmed?: boolean;
  }
) {
  const result = await query(
    `INSERT INTO journal_entries (investigation_id, entry_type, content, related_evidence_ids, is_confirmed, creation_timestamp) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
    [investigationId, data.entryType, data.content, data.relatedEvidenceIds || [], data.isConfirmed !== undefined ? data.isConfirmed : false]
  );
  return mapRow<JournalEntry>(result.rows[0]);
}

export async function getJournalEntries(investigationId: string) {
  const result = await query(
    'SELECT * FROM journal_entries WHERE investigation_id = $1 ORDER BY creation_timestamp ASC',
    [investigationId]
  );
  return mapRows<JournalEntry>(result.rows);
}

// Scheduled events routes

export interface ScheduledEvent {
  id: string;
  investigationId: string;
  eventType: string;
  triggerCondition: any;
  scheduledTimestamp: Date;
  releaseStatus: string;
  associatedEvidence?: string;
  narrativePayload?: any;
  createdAt: Date;
  updatedAt: Date;
}

export async function createScheduledEvent(
  investigationId: string,
  data: {
    eventType: string;
    triggerCondition: any;
    scheduledTimestamp: Date;
    associatedEvidence?: string;
    narrativePayload?: any;
  }
) {
  const result = await query(
    `INSERT INTO scheduled_events (investigation_id, event_type, trigger_condition, scheduled_timestamp, release_status, associated_evidence, narrative_payload, created_at, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, NOW(), NOW()) RETURNING *`,
    [
      investigationId,
      data.eventType,
      JSON.stringify(data.triggerCondition ?? {}),
      data.scheduledTimestamp,
      'pending',
      data.associatedEvidence ?? null,
      JSON.stringify(data.narrativePayload ?? {}),
    ]
  );
  return mapRow<ScheduledEvent>(result.rows[0]);
}

export async function getScheduledEvents(investigationId: string) {
  const result = await query(
    'SELECT * FROM scheduled_events WHERE investigation_id = $1 ORDER BY scheduled_timestamp ASC NULLS LAST',
    [investigationId]
  );
  return mapRows<ScheduledEvent>(result.rows);
}

export async function updateEventReleaseStatus(
  eventId: string,
  status: string
) {
  const result = await query(
    `UPDATE scheduled_events SET release_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, eventId]
  );
  return result.rows[0] ? mapRow<ScheduledEvent>(result.rows[0]) : null;
}

// ===== CANONICAL TRUTH (SERVER-ONLY) =====
//
// PROD-007 enriched the canonical_truth table with the full solution package
// (solution explanation, red herrings, eliminated alternative theories and a
// clue-resolution map). This data is PRIVATE. No API route may return it until
// PROD-009 wires an explicit, narrowed solution-reveal DTO behind a *correct*
// verdict. Keeping the accessor here (rather than in a route) makes accidental
// leakage harder and gives PROD-009 one authoritative read path.

export interface CanonicalTruth {
  id: string;
  caseId: string;
  culprit: string;
  motive: string;
  method: string;
  timeline: any[];
  hiddenEvents: any[];
  solutionExplanation: string;
  redHerrings: Array<{
    label: string;
    apparent_meaning?: string;
    apparentMeaning?: string;
    actual_explanation?: string;
    actualExplanation?: string;
    resolved_by?: string;
    resolvedBy?: string;
  }>;
  alternativeTheories: Array<{
    title: string;
    summary: string;
    why_plausible?: string;
    whyPlausible?: string;
    disproven_by?: string[];
    disprovenBy?: string[];
    resolution?: string;
  }>;
  clueResolutions: Record<string, string>;
  actualTimeline: any[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Read the complete canonical solution package for a case.
 * SERVER-ONLY: callers must never attach the result (or its fields) to an
 * ordinary API response. PROD-009 will expose a safe subset after a correct
 * verdict has been evaluated server-side.
 */
export async function getCanonicalTruth(caseId: string): Promise<CanonicalTruth | null> {
  // Explicit aliases prevent snake_case duplicate keys from mapRow and keep the
  // shape identical to the CanonicalTruth interface above.
  const result = await query(
    `SELECT id,
            case_id AS "caseId",
            culprit, motive, method,
            timeline,
            hidden_events AS "hiddenEvents",
            solution_explanation AS "solutionExplanation",
            red_herrings AS "redHerrings",
            alternative_theories AS "alternativeTheories",
            clue_resolutions AS "clueResolutions",
            actual_timeline AS "actualTimeline",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
       FROM canonical_truth WHERE case_id = $1`,
    [caseId]
  );
  return result.rows[0] ? mapRow<CanonicalTruth>(result.rows[0]) : null;
}

// Accusation routes

export interface Accusation {
  id: string;
  investigationId: string;
  submittedCulprit: string;
  motive: string;
  method: string;
  supportingEvidence: string[];
  evaluationResult?: string;
  submissionTimestamp: Date;
  resolvedAt?: Date;
}

export async function createAccusation(
  investigationId: string,
  data: {
    submittedCulprit: string;
    motive: string;
    method: string;
    supportingEvidence: string[];
  }
) {
  const result = await query(
    `INSERT INTO accusations (investigation_id, submitted_culprit, motive, method, supporting_evidence, evaluation_result, submission_timestamp)
     VALUES ($1, $2, $3, $4, $5::uuid[], NULL, NOW()) RETURNING *`,
    [investigationId, data.submittedCulprit, data.motive, data.method, data.supportingEvidence ?? []]
  );
  return mapRow<Accusation>(result.rows[0]);
}

export async function getAccusation(investigationId: string) {
  const result = await query(
    'SELECT * FROM accusations WHERE investigation_id = $1 ORDER BY submission_timestamp DESC LIMIT 1',
    [investigationId]
  );
  return result.rows[0] ? mapRow<Accusation>(result.rows[0]) : null;
}

// ---------------------------------------------------------------------------
// PROD-010 (GAP-06): verdict integrity v2.
// ---------------------------------------------------------------------------
// The canonical solution stays server-only. Evaluation is deterministic and
// gated by three independent server-authoritative checks, so a correct NAME by
// itself can never complete a case:
//
//   1. READINESS  - at least N plausible deduction checkpoints must be recorded.
//   2. INTEGRITY  - culprit must match canonical AND the submitted motive/method
//                   must overlap the canonical wording (keyword/semantic-light
//                   match) AND at least one supporting evidence id must belong
//                   to the case. Name-only accusations fail this step.
//   3. COOLDOWN   - failed accusations increment an attempt counter and start an
//                   escalating (but capped, never permanent) cooldown.
//
// Feedback is deliberately uniform for every non-correct verdict so a player
// cannot brute-force the culprit by watching for a different answer. All checks
// and mutations happen in ONE transaction with a row lock, so concurrent
// requests cannot bypass the cooldown.

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const ACCUSATION_REQUIRED_CHECKPOINTS = Math.floor(
  readPositiveNumberEnv('ACCUSATION_REQUIRED_CHECKPOINTS', 1)
);
const ACCUSATION_MOTIVE_THRESHOLD = readPositiveNumberEnv('ACCUSATION_MOTIVE_THRESHOLD', 0.18);
const ACCUSATION_METHOD_THRESHOLD = readPositiveNumberEnv('ACCUSATION_METHOD_THRESHOLD', 0.18);
const ACCUSATION_MIN_KEYWORD_OVERLAP = Math.floor(
  readPositiveNumberEnv('ACCUSATION_MIN_KEYWORD_OVERLAP', 4)
);
const ACCUSATION_MIN_SUPPORTING_EVIDENCE = Math.floor(
  readPositiveNumberEnv('ACCUSATION_MIN_SUPPORTING_EVIDENCE', 1)
);
// Generous dev defaults keep the local smoke suite fast. Tighten in production.
const ACCUSATION_BASE_COOLDOWN_MS = Math.floor(
  readPositiveNumberEnv('ACCUSATION_BASE_COOLDOWN_MS', 2_000)
);
const ACCUSATION_MAX_COOLDOWN_MS = Math.floor(
  readPositiveNumberEnv('ACCUSATION_MAX_COOLDOWN_MS', 60_000)
);

const ACCUSATION_STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'because', 'been', 'before', 'being',
  'between', 'both', 'could', 'during', 'each', 'from', 'here', 'into', 'itself',
  'might', 'more', 'most', 'must', 'other', 'over', 'same', 'should', 'their', 'them',
  'then', 'there', 'these', 'they', 'this', 'those', 'through', 'under', 'until',
  'very', 'were', 'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your',
]);

function accusationContentTokens(text: string): string[] {
  const parts = String(text ?? '').toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return Array.from(new Set(
    parts.filter((token) => token.length >= 4 && !ACCUSATION_STOPWORDS.has(token))
  ));
}

function accusationTokenMatches(submitted: string, canonical: string): boolean {
  if (submitted === canonical) return true;
  // Light stem/prefix tolerance: "fraud" ~ "fraudulent", "policy" ~ "policies".
  return Math.min(submitted.length, canonical.length) >= 4
    && (submitted.startsWith(canonical) || canonical.startsWith(submitted));
}

/** Fraction of canonical content words echoed by the player's free text. */
function accusationKeywordCoverage(submitted: string, canonical: string): {
  coverage: number;
  overlap: number;
} {
  const submittedTokens = accusationContentTokens(submitted);
  const canonicalTokens = accusationContentTokens(canonical);
  if (canonicalTokens.length === 0) return { coverage: 0, overlap: 0 };
  let overlap = 0;
  for (const canonicalToken of canonicalTokens) {
    if (submittedTokens.some((token) => accusationTokenMatches(token, canonicalToken))) {
      overlap += 1;
    }
  }
  return { coverage: overlap / canonicalTokens.length, overlap };
}

/** Escalating but capped cooldown. No permanent lockout is ever possible. */
export function accusationCooldownMs(attempts: number): number {
  const step = Math.max(0, attempts - 1);
  const raw = ACCUSATION_BASE_COOLDOWN_MS * Math.pow(2, step);
  return Math.min(Number.isFinite(raw) ? raw : ACCUSATION_MAX_COOLDOWN_MS, ACCUSATION_MAX_COOLDOWN_MS);
}

export interface AccusationEvaluation {
  valid: boolean;
  status: 'evaluated' | 'not_ready' | 'cooldown' | 'completed';
  evaluationResult: 'correct' | 'incorrect' | 'partial';
  message: string;
  attempts: number;
  cooldownUntil: string | null;
  retryAfterSeconds: number;
  readiness: {
    ready: boolean;
    completedCheckpoints: number;
    requiredCheckpoints: number;
  };
  caseId: string | null;
  culprit: string;
  motive: string;
  method: string;
  submittedCulprit: string;
  submittedMotive: string;
  submittedMethod: string;
  supportingEvidenceCount: number;
  canonicalTruthConfigured: boolean;
}

export async function evaluateAccusation(
  investigationId: string,
  culprit: string,
  motive: string,
  method: string,
  supportingEvidence: string[]
): Promise<AccusationEvaluation> {
  const submittedCulprit = String(culprit ?? '');
  const submittedMotive = String(motive ?? '');
  const submittedMethod = String(method ?? '');
  const evidenceIds = Array.isArray(supportingEvidence) ? supportingEvidence.map(String) : [];

  const baseResult = (
    status: AccusationEvaluation['status'],
    evaluationResult: AccusationEvaluation['evaluationResult'],
    message: string,
    extra: Partial<AccusationEvaluation> = {}
  ): AccusationEvaluation => ({
    valid: status === 'evaluated',
    status,
    evaluationResult,
    message,
    attempts: 0,
    cooldownUntil: null,
    retryAfterSeconds: 0,
    readiness: {
      ready: true,
      completedCheckpoints: ACCUSATION_REQUIRED_CHECKPOINTS,
      requiredCheckpoints: ACCUSATION_REQUIRED_CHECKPOINTS,
    },
    caseId: null,
    culprit: submittedCulprit,
    motive: submittedMotive,
    method: submittedMethod,
    submittedCulprit,
    submittedMotive,
    submittedMethod,
    supportingEvidenceCount: evidenceIds.length,
    canonicalTruthConfigured: false,
    ...extra,
  });

  const invResult = await query('SELECT * FROM investigations WHERE id = $1', [investigationId]);
  if (invResult.rows.length === 0) {
    return baseResult('evaluated', 'incorrect', 'Investigation not found');
  }

  return withTransaction(async (client) => {
    // Lock the investigation row: check + record attempts is atomic, so a burst
    // of concurrent requests cannot slip past the cooldown.
    const locked = await client.query('SELECT * FROM investigations WHERE id = $1 FOR UPDATE', [investigationId]);
    const row = locked.rows[0];
    if (!row) {
      return baseResult('evaluated', 'incorrect', 'Investigation not found');
    }
    const investigation = mapRow<Investigation>(row);
    const caseId = String(investigation.caseId ?? '');
    const currentAttempts = Math.max(0, Number(row.accusation_attempts ?? 0) || 0);
    const cooldownUntilRaw = row.accusation_cooldown_until
      ? new Date(row.accusation_cooldown_until)
      : null;
    const cooldownUntil = cooldownUntilRaw && !Number.isNaN(cooldownUntilRaw.getTime())
      ? cooldownUntilRaw.toISOString()
      : null;

    // A solved investigation is final - never reopen it through evaluation.
    if (String(investigation.status) === 'completed') {
      return baseResult('completed', 'correct', 'Investigation already completed', {
        attempts: currentAttempts,
        cooldownUntil,
        caseId,
      });
    }

    const nowMs = Date.now();
    const retryAfterMs = cooldownUntilRaw
      ? Math.max(0, cooldownUntilRaw.getTime() - nowMs)
      : 0;

    // (3) COOLDOWN - checked first so a cooling-down player cannot spend an
    // attempt or learn anything about the verdict.
    if (retryAfterMs > 0) {
      return baseResult('cooldown', 'incorrect', 'Accusations are temporarily unavailable.', {
        attempts: currentAttempts,
        cooldownUntil,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        caseId,
      });
    }

    // (1) READINESS - the final accusation is the climax of the case. At least
    // one plausible deduction checkpoint must be recorded by the engine.
    const cpRes = await client.query(
      `SELECT COUNT(DISTINCT checkpoint_id)::int AS count
         FROM deduction_checkpoints
        WHERE investigation_id = $1 AND result = 'plausible'`,
      [investigationId]
    );
    const completedCheckpoints = Number(cpRes.rows[0]?.count ?? 0);
    const readiness = {
      ready: completedCheckpoints >= ACCUSATION_REQUIRED_CHECKPOINTS,
      completedCheckpoints,
      requiredCheckpoints: ACCUSATION_REQUIRED_CHECKPOINTS,
    };
    if (!readiness.ready) {
      return baseResult(
        'not_ready',
        'partial',
        'Complete at least one deduction before making a final accusation.',
        { attempts: currentAttempts, cooldownUntil, readiness, caseId }
      );
    }

    // (2) INTEGRITY - canonical data is read only here and never echoed to the
    // client. Every comparison happens server-side.
    const canonicalResult = await client.query(
      'SELECT culprit, motive, method FROM canonical_truth WHERE case_id = $1',
      [caseId]
    );
    const canonicalTruth = canonicalResult.rows[0];
    const canonicalTruthConfigured = Boolean(canonicalTruth);
    const culpritMatch = Boolean(canonicalTruth)
      && submittedCulprit.trim().toLowerCase()
         === String(canonicalTruth.culprit ?? '').trim().toLowerCase();

    const motiveScore = canonicalTruth
      ? accusationKeywordCoverage(submittedMotive, String(canonicalTruth.motive ?? ''))
      : { coverage: 0, overlap: 0 };
    const methodScore = canonicalTruth
      ? accusationKeywordCoverage(submittedMethod, String(canonicalTruth.method ?? ''))
      : { coverage: 0, overlap: 0 };

    // Only evidence the player can actually know about counts as reasoning:
    // it must belong to this case AND be initially visible or already
    // discovered/released. Unreleased evidence ids can never be cited.
    const discoveredEvidenceIds = Array.isArray(row.discovered_evidence_ids)
      ? row.discovered_evidence_ids.map(String)
      : [];
    const knownEvidenceIds = new Set(discoveredEvidenceIds);
    let validEvidenceCount = 0;
    if (evidenceIds.length > 0) {
      const placeholders = evidenceIds.map((_, i) => `$${i + 2}`).join(', ');
      const evRes = await client.query(
        `SELECT DISTINCT id, player_visible FROM evidence
          WHERE case_id = $1 AND id IN (${placeholders})`,
        [caseId, ...evidenceIds]
      );
      for (const ev of evRes.rows) {
        if (ev.player_visible === true || knownEvidenceIds.has(String(ev.id))) {
          validEvidenceCount += 1;
        }
      }
    }

    const reasoningComplete =
      motiveScore.coverage >= ACCUSATION_MOTIVE_THRESHOLD
      && motiveScore.overlap >= ACCUSATION_MIN_KEYWORD_OVERLAP
      && methodScore.coverage >= ACCUSATION_METHOD_THRESHOLD
      && methodScore.overlap >= ACCUSATION_MIN_KEYWORD_OVERLAP
      && validEvidenceCount >= ACCUSATION_MIN_SUPPORTING_EVIDENCE;

    let evaluationResult: AccusationEvaluation['evaluationResult'] = 'incorrect';
    let message = 'Your accusation could not be confirmed against the evidence. Review the motive, method and supporting evidence before trying again. The investigation continues.';

    if (!canonicalTruthConfigured) {
      // Legacy behaviour: without canonical truth we can never confirm correct.
      evaluationResult = 'partial';
      message = 'Canonical truth is not yet configured for this case. The verdict cannot be confirmed as correct.';
    } else if (culpritMatch && reasoningComplete) {
      evaluationResult = 'correct';
      message = 'Correct verdict. The investigation is complete.';
    }
    // All other paths (unknown culprit, wrong culprit, correct name but weak
    // motive/method/evidence) deliberately share ONE generic message so the
    // response never reveals whether the guessed name was right.

    // Persist the latest accusation's verdict when one was actually submitted.
    await client.query(
      `UPDATE accusations
          SET evaluation_result = $1, resolved_at = NOW()
        WHERE investigation_id = $2
          AND id = (
            SELECT id FROM accusations WHERE investigation_id = $2 ORDER BY submission_timestamp DESC LIMIT 1
          )`,
      [evaluationResult, investigationId]
    );

    const isCorrect = evaluationResult === 'correct';
    const nextAttempts = isCorrect ? 0 : currentAttempts + 1;
    const nextCooldownMs = isCorrect ? 0 : accusationCooldownMs(nextAttempts);
    const nextCooldownUntil = isCorrect ? null : new Date(nowMs + nextCooldownMs);

    // Server-authoritative state machine: only a fully verified verdict
    // completes an investigation. Failed verdicts stay ACTIVE and retryable;
    // clients can never PATCH attempts/cooldown/status themselves.
    await client.query(
      `UPDATE investigations
          SET status = $1,
              completion_timestamp = CASE WHEN $1 = 'completed' THEN NOW() ELSE completion_timestamp END,
              accusation_attempts = $2,
              last_accusation_at = NOW(),
              accusation_cooldown_until = $3,
              updated_at = NOW()
        WHERE id = $4`,
      [isCorrect ? 'completed' : 'active', nextAttempts, nextCooldownUntil, investigationId]
    );

    return baseResult('evaluated', evaluationResult, message, {
      attempts: nextAttempts,
      cooldownUntil: nextCooldownUntil ? nextCooldownUntil.toISOString() : null,
      retryAfterSeconds: isCorrect ? 0 : Math.ceil(nextCooldownMs / 1000),
      readiness,
      caseId,
      canonicalTruthConfigured,
    });
  });
}

// Achievement routes

// Achievements are awarded by the server only. The client never chooses an
// achievement type; this allowlist is the complete set of MVP achievements.
export const SERVER_ACHIEVEMENT_TYPES = ['first_evidence', 'case_solved'] as const;
export type ServerAchievementType = (typeof SERVER_ACHIEVEMENT_TYPES)[number];

export async function awardAchievement(
  investigationId: string,
  achievementType: ServerAchievementType
) {
  if (!(SERVER_ACHIEVEMENT_TYPES as readonly string[]).includes(achievementType)) {
    return null;
  }
  // Idempotent: at most one of each achievement type per investigation.
  const existing = await query(
    'SELECT id FROM case_achievements WHERE investigation_id = $1 AND achievement_type = $2 LIMIT 1',
    [investigationId, achievementType]
  );
  if (existing.rows.length > 0) return null;

  const result = await query(
    `INSERT INTO case_achievements (investigation_id, achievement_type, unlocked_at)
     VALUES ($1, $2, NOW()) RETURNING *`,
    [investigationId, achievementType]
  );
  return mapRow(result.rows[0]);
}

export async function getAchievements(investigationId: string) {
  const result = await query(
    'SELECT * FROM case_achievements WHERE investigation_id = $1',
    [investigationId]
  );
  return mapRows(result.rows);
}

// P2-POLISH: small, read-only counts used by the investigation stats summary.
// These are plain INTEGER counts (no canonical/hidden content) and are safe to
// project to an authenticated owner. Keeping them in db.ts preserves the data
// layer boundary - the route never builds its own SQL.
export async function getCaseEvidenceCount(caseId: string): Promise<number> {
  const result = await query(
    'SELECT COUNT(*)::int AS total FROM evidence WHERE case_id = $1',
    [caseId]
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function getAccusationCount(investigationId: string): Promise<number> {
  const result = await query(
    'SELECT COUNT(*)::int AS total FROM accusations WHERE investigation_id = $1',
    [investigationId]
  );
  return Number(result.rows[0]?.total ?? 0);
}

// Weekly collection routes

export interface WeeklyCollection {
  id: string;
  releaseDate: Date;
  includedCaseIds: string[];
  featuredCaseId?: string;
  publicationStatus: string;
  createdAt: Date;
}

export async function createWeeklyCollection(
  data: {
    releaseDate: Date;
    includedCaseIds: string[];
    featuredCaseId?: string;
    publicationStatus?: string;
  }
) {
  const result = await query(
    `INSERT INTO weekly_collections (release_date, included_case_ids, featured_case_id, publication_status, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
    [data.releaseDate, data.includedCaseIds, data.featuredCaseId ?? null, data.publicationStatus || 'upcoming']
  );
  return mapRow<WeeklyCollection>(result.rows[0]);
}

export async function getWeeklyCollections() {
  const result = await query('SELECT * FROM weekly_collections ORDER BY release_date ASC NULLS LAST');
  return mapRows<WeeklyCollection>(result.rows);
}

// ===========================================================================
// M2 KNOWLEDGE SYSTEM (migration 006)
// ---------------------------------------------------------------------------
// All selects use explicit column allowlists. No query in this section reads
// canonical_truth, hidden character fields or hidden evidence fields.
// ===========================================================================

export interface Specialist {
  id: string;
  specialistKey: string;
  name: string;
  title: string;
  specialization: string;
  discipline: string;
  knowledgeDomains: unknown;
  personality: string;
  communicationStyle: string;
  reasoningApproach: string;
  expertiseSummary: string;
  limitations: unknown;
  depthGuidance: unknown;
  isFictional: boolean;
  realDisciplineBasis: string;
  caseRelevance?: string;
  displayOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const SPECIALIST_COLUMNS = `s.id, s.specialist_key, s.name, s.title, s.specialization, s.discipline,
  s.knowledge_domains, s.personality, s.communication_style, s.reasoning_approach,
  s.expertise_summary, s.limitations, s.depth_guidance, s.is_fictional,
  s.real_discipline_basis, s.created_at, s.updated_at`;

export async function getSpecialistsByCase(caseId: string): Promise<Specialist[]> {
  const result = await query(
    `SELECT ${SPECIALIST_COLUMNS}, cs.case_relevance, cs.display_order
       FROM case_specialists cs
       JOIN specialists s ON s.id = cs.specialist_id
      WHERE cs.case_id = $1
      ORDER BY cs.display_order ASC, s.name ASC`,
    [caseId]
  );
  return mapRows<Specialist>(result.rows);
}

export async function getSpecialistByKey(caseId: string, specialistKey: string): Promise<Specialist | null> {
  const result = await query(
    `SELECT ${SPECIALIST_COLUMNS}, cs.case_relevance, cs.display_order
       FROM case_specialists cs
       JOIN specialists s ON s.id = cs.specialist_id
      WHERE cs.case_id = $1 AND s.specialist_key = $2
      LIMIT 1`,
    [caseId, specialistKey]
  );
  return result.rows[0] ? mapRow<Specialist>(result.rows[0]) : null;
}

export interface KnowledgeArtifact {
  id: string;
  artifactKey: string;
  title: string;
  artifactType: string;
  description: string;
  content: string;
  specialistId: string;
  caseId: string;
  sourceAuthor: string;
  sourceUrl: string;
  sourceVerified: boolean;
  bibliographyRef: string;
  publicationDate: string;
  knowledgeClass: string;
  reliability: string;
  relatedConcepts: unknown;
  isFictional: boolean;
  usageNote: string;
  // M3 provenance / pedagogy metadata (migration 007).
  sourceType: string | null;
  verificationStatus: string;
  verificationNotes: string;
  lastVerifiedAt: string | null;
  claimsSupported: unknown;
  learningObjectives: unknown;
  relatedEvidenceRefs: unknown;
  suggestedConversations: unknown;
  depthContent: unknown;
  specialistKey?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ARTIFACT_COLUMNS = `a.id, a.artifact_key, a.title, a.artifact_type, a.description, a.content,
  a.specialist_id, a.case_id, a.source_author, a.source_url, a.source_verified,
  a.bibliography_ref, a.publication_date, a.knowledge_class, a.reliability,
  a.related_concepts, a.is_fictional, a.usage_note, a.created_at, a.updated_at,
  a.source_type, a.verification_status, a.verification_notes, a.last_verified_at,
  a.claims_supported, a.learning_objectives, a.related_evidence_refs,
  a.suggested_conversations, a.depth_content,
  s.specialist_key`;

const ARTIFACT_JOIN = ` FROM knowledge_artifacts a
  LEFT JOIN specialists s ON s.id = a.specialist_id`;

export async function getKnowledgeArtifactsByCase(caseId: string): Promise<KnowledgeArtifact[]> {
  const result = await query(
    `SELECT ${ARTIFACT_COLUMNS}${ARTIFACT_JOIN} WHERE a.case_id = $1 ORDER BY a.title ASC`,
    [caseId]
  );
  return mapRows<KnowledgeArtifact>(result.rows);
}

export async function getKnowledgeArtifactById(
  artifactId: string,
  caseId?: string
): Promise<KnowledgeArtifact | null> {
  const params: any[] = [artifactId];
  let where = 'WHERE a.id = $1';
  if (caseId) {
    params.push(caseId);
    where += ' AND a.case_id = $2';
  }
  const result = await query(
    `SELECT ${ARTIFACT_COLUMNS}${ARTIFACT_JOIN} ${where} LIMIT 1`,
    params
  );
  return result.rows[0] ? mapRow<KnowledgeArtifact>(result.rows[0]) : null;
}

export interface KnowledgeDisagreement {
  id: string;
  disagreementKey: string;
  caseId: string;
  topic: string;
  specialistAId: string;
  specialistBId: string;
  positionA: string;
  positionB: string;
  disciplinaryBasis: string;
  uncertaintyNote: string;
  distinguishingEvidence: string;
  relatedArtifactKeys: unknown;
  specialistAKey?: string;
  specialistBKey?: string;
  specialistAName?: string;
  specialistBName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export async function getKnowledgeDisagreementsByCase(caseId: string): Promise<KnowledgeDisagreement[]> {
  const result = await query(
    `SELECT d.id, d.disagreement_key, d.case_id, d.topic, d.specialist_a_id, d.specialist_b_id,
            d.position_a, d.position_b, d.disciplinary_basis, d.uncertainty_note,
            d.distinguishing_evidence, d.related_artifact_keys, d.created_at, d.updated_at,
            sa.specialist_key AS specialist_a_key, sb.specialist_key AS specialist_b_key,
            sa.name AS specialist_a_name, sb.name AS specialist_b_name
       FROM knowledge_disagreements d
       JOIN specialists sa ON sa.id = d.specialist_a_id
       JOIN specialists sb ON sb.id = d.specialist_b_id
      WHERE d.case_id = $1
      ORDER BY d.disagreement_key ASC`,
    [caseId]
  );
  return mapRows<KnowledgeDisagreement>(result.rows);
}

export interface CaseKnowledgePack {
  id: string;
  caseId: string;
  version: string;
  packStatus: string;
  learningObjectives: unknown;
  summary: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** M3 case knowledge-pack metadata. No canonical truth is selected here. */
export async function getCaseKnowledgePack(caseId: string): Promise<CaseKnowledgePack | null> {
  const result = await query(
    `SELECT id, case_id, version, pack_status, learning_objectives, summary, created_at, updated_at
       FROM case_knowledge_packs WHERE case_id = $1 LIMIT 1`,
    [caseId]
  );
  return result.rows[0] ? mapRow<CaseKnowledgePack>(result.rows[0]) : null;
}

export interface NotebookEntry {
  id: string;
  investigationId: string;
  userId: string;
  entryType: string;
  artifactId: string;
  specialistId: string;
  concept: string;
  title: string;
  content: string;
  sourceSnapshot: unknown;
  /** M5: optional perspective provenance (null unless captured from an experience). */
  perspectiveExperienceId?: string | null;
  /** M7: optional link to an accepted knowledge memory item / authored clue. */
  discoveryMemoryId?: string | null;
  discoveryClueKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const NOTEBOOK_COLUMNS = `id, investigation_id, user_id, entry_type, artifact_id, specialist_id,
  concept, title, content, source_snapshot, perspective_experience_id,
  discovery_memory_id, discovery_clue_key, created_at, updated_at`;

export async function createNotebookEntry(
  investigationId: string,
  userId: string,
  data: {
    entryType: string;
    concept?: string;
    title?: string;
    content?: string;
    artifactId?: string | null;
    specialistId?: string | null;
    sourceSnapshot?: Record<string, unknown>;
    perspectiveExperienceId?: string | null;
    discoveryMemoryId?: string | null;
    discoveryClueKey?: string | null;
  }
): Promise<NotebookEntry> {
  const result = await query(
    `INSERT INTO notebook_entries
       (investigation_id, user_id, entry_type, artifact_id, specialist_id, concept, title, content, source_snapshot,
        perspective_experience_id, discovery_memory_id, discovery_clue_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12) RETURNING ${NOTEBOOK_COLUMNS}`,
    [
      investigationId,
      userId,
      data.entryType,
      data.artifactId ?? null,
      data.specialistId ?? null,
      data.concept ?? '',
      data.title ?? '',
      data.content ?? '',
      JSON.stringify(data.sourceSnapshot ?? {}),
      data.perspectiveExperienceId ?? null,
      data.discoveryMemoryId ?? null,
      data.discoveryClueKey ?? null,
    ]
  );
  return mapRow<NotebookEntry>(result.rows[0]);
}

export async function getNotebookEntries(
  investigationId: string,
  userId: string
): Promise<NotebookEntry[]> {
  const result = await query(
    `SELECT ${NOTEBOOK_COLUMNS} FROM notebook_entries
      WHERE investigation_id = $1 AND user_id = $2
      ORDER BY created_at DESC`,
    [investigationId, userId]
  );
  return mapRows<NotebookEntry>(result.rows);
}

export async function updateNotebookEntry(
  entryId: string,
  investigationId: string,
  userId: string,
  data: {
    entryType?: string;
    concept?: string;
    title?: string;
    content?: string;
    artifactId?: string | null;
    specialistId?: string | null;
    sourceSnapshot?: Record<string, unknown>;
    discoveryMemoryId?: string | null;
    discoveryClueKey?: string | null;
  }
): Promise<NotebookEntry | null> {
  const columns: string[] = [];
  const values: any[] = [];
  let next = 1;
  const add = (column: string, value: unknown): void => {
    columns.push(`${column} = $${next}`);
    values.push(value);
    next += 1;
  };
  if (data.entryType !== undefined) add('entry_type', data.entryType);
  if (data.concept !== undefined) add('concept', data.concept);
  if (data.title !== undefined) add('title', data.title);
  if (data.content !== undefined) add('content', data.content);
  if (data.artifactId !== undefined) add('artifact_id', data.artifactId);
  if (data.specialistId !== undefined) add('specialist_id', data.specialistId);
  if (data.sourceSnapshot !== undefined) add('source_snapshot', JSON.stringify(data.sourceSnapshot));
  if (data.discoveryMemoryId !== undefined) add('discovery_memory_id', data.discoveryMemoryId);
  if (data.discoveryClueKey !== undefined) add('discovery_clue_key', data.discoveryClueKey);

  const params = [entryId, investigationId, userId];
  if (columns.length === 0) {
    const current = await query(
      `SELECT ${NOTEBOOK_COLUMNS} FROM notebook_entries
        WHERE id = $1 AND investigation_id = $2 AND user_id = $3`,
      params
    );
    return current.rows[0] ? mapRow<NotebookEntry>(current.rows[0]) : null;
  }

  values.push(entryId, investigationId, userId);
  const sql = `UPDATE notebook_entries SET ${columns.join(', ')}, updated_at = NOW()
                WHERE id = $${next} AND investigation_id = $${next + 1} AND user_id = $${next + 2}
                RETURNING ${NOTEBOOK_COLUMNS}`;
  const result = await query(sql, values);
  return result.rows[0] ? mapRow<NotebookEntry>(result.rows[0]) : null;
}

export async function deleteNotebookEntry(
  entryId: string,
  investigationId: string,
  userId: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM notebook_entries
      WHERE id = $1 AND investigation_id = $2 AND user_id = $3
      RETURNING id`,
    [entryId, investigationId, userId]
  );
  return result.rows.length > 0;
}
// ===========================================================================
// M4 Reality Map (migration 008) — player-owned claims, hypotheses and links.
// EVERY query here is scoped by investigation_id AND user_id. This feature is
// player notes only: nothing in this section reads canonical_truth or touches
// verdict evaluation, progression or evidence release.
// ===========================================================================

export interface RealityClaim {
  id: string;
  investigationId: string;
  userId: string;
  title: string;
  description: string;
  claimCategory: string;
  confidence: string;
  notes: string;
  sourceJournalEntryId: string | null;
  sourceNotebookEntryId: string | null;
  /** M5: optional perspective provenance (null unless created from an experience). */
  sourcePerspectiveExperienceId?: string | null;
  sourcePerspectiveReflectionId?: string | null;
  isTutorial: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RealityHypothesis {
  id: string;
  investigationId: string;
  userId: string;
  name: string;
  explanation: string;
  status: string;
  confidence: string;
  missingInformation: string;
  alternativeExplanations: string;
  playerNotes: string;
  isTutorial: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RealityMapLink {
  id: string;
  investigationId: string;
  userId: string;
  ownerType: string;
  ownerId: string;
  targetType: string;
  targetId: string;
  relationship: string;
  rationale: string;
  isTutorial: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LinkTargetResolution {
  targetType: string;
  targetId: string;
  label: string;
  subLabel: string;
}

const CLAIM_COLUMNS = `id, investigation_id, user_id, title, description, claim_category,
  confidence, notes, source_journal_entry_id, source_notebook_entry_id,
  source_perspective_experience_id, source_perspective_reflection_id,
  is_tutorial, created_at, updated_at`;
const HYPOTHESIS_COLUMNS = `id, investigation_id, user_id, name, explanation, status, confidence,
  missing_information, alternative_explanations, player_notes, is_tutorial, created_at, updated_at`;
const LINK_COLUMNS = `id, investigation_id, user_id, owner_type, owner_id, target_type, target_id,
  relationship, rationale, is_tutorial, created_at, updated_at`;

type RealityTable = 'investigation_claims' | 'investigation_hypotheses' | 'reality_map_links';

/** Bounded COUNT used for per-investigation write caps. Table is allowlisted. */
export async function countRealityRows(
  table: RealityTable,
  investigationId: string,
  userId?: string
): Promise<number> {
  const allowed: RealityTable[] = ['investigation_claims', 'investigation_hypotheses', 'reality_map_links'];
  if (!allowed.includes(table)) throw new Error('Invalid reality map table');
  const params: any[] = [investigationId];
  let where = 'investigation_id = $1';
  if (userId) {
    params.push(userId);
    where += ' AND user_id = $2';
  }
  const result = await query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE ${where}`, params);
  return Number(result.rows[0]?.count ?? 0);
}

// --- Claims ----------------------------------------------------------------

export interface CreateClaimData {
  title: string;
  description?: string;
  claimCategory: string;
  confidence?: string;
  notes?: string;
  sourceJournalEntryId?: string | null;
  sourceNotebookEntryId?: string | null;
  sourcePerspectiveExperienceId?: string | null;
  sourcePerspectiveReflectionId?: string | null;
  isTutorial?: boolean;
}

export async function createClaim(
  investigationId: string,
  userId: string,
  data: CreateClaimData
): Promise<RealityClaim> {
  const result = await query(
    `INSERT INTO investigation_claims
       (investigation_id, user_id, title, description, claim_category, confidence,
        notes, source_journal_entry_id, source_notebook_entry_id,
        source_perspective_experience_id, source_perspective_reflection_id, is_tutorial)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${CLAIM_COLUMNS}`,
    [
      investigationId, userId, data.title, data.description ?? '', data.claimCategory,
      data.confidence ?? 'insufficient_information', data.notes ?? '',
      data.sourceJournalEntryId ?? null, data.sourceNotebookEntryId ?? null,
      data.sourcePerspectiveExperienceId ?? null, data.sourcePerspectiveReflectionId ?? null,
      data.isTutorial === true,
    ]
  );
  return mapRow<RealityClaim>(result.rows[0]);
}

export async function getClaims(investigationId: string, userId: string): Promise<RealityClaim[]> {
  const result = await query(
    `SELECT ${CLAIM_COLUMNS} FROM investigation_claims
      WHERE investigation_id = $1 AND user_id = $2
      ORDER BY created_at DESC, id ASC`,
    [investigationId, userId]
  );
  return mapRows<RealityClaim>(result.rows);
}

export async function getClaimById(
  claimId: string,
  investigationId: string,
  userId: string
): Promise<RealityClaim | null> {
  const result = await query(
    `SELECT ${CLAIM_COLUMNS} FROM investigation_claims
      WHERE id = $1 AND investigation_id = $2 AND user_id = $3 LIMIT 1`,
    [claimId, investigationId, userId]
  );
  return result.rows[0] ? mapRow<RealityClaim>(result.rows[0]) : null;
}

export type ClaimPatch = Partial<Pick<RealityClaim,
  'title' | 'description' | 'claimCategory' | 'confidence' | 'notes'>>;

export async function updateClaim(
  claimId: string,
  investigationId: string,
  userId: string,
  patch: ClaimPatch
): Promise<RealityClaim | null> {
  const columns: string[] = [];
  const values: any[] = [];
  let next = 1;
  const add = (column: string, value: unknown): void => {
    columns.push(`${column} = $${next}`);
    values.push(value);
    next += 1;
  };
  if (patch.title !== undefined) add('title', patch.title);
  if (patch.description !== undefined) add('description', patch.description);
  if (patch.claimCategory !== undefined) add('claim_category', patch.claimCategory);
  if (patch.confidence !== undefined) add('confidence', patch.confidence);
  if (patch.notes !== undefined) add('notes', patch.notes);
  if (columns.length === 0) return getClaimById(claimId, investigationId, userId);
  values.push(claimId, investigationId, userId);
  const result = await query(
    `UPDATE investigation_claims SET ${columns.join(', ')}, updated_at = NOW()
      WHERE id = $${next} AND investigation_id = $${next + 1} AND user_id = $${next + 2}
      RETURNING ${CLAIM_COLUMNS}`,
    values
  );
  return result.rows[0] ? mapRow<RealityClaim>(result.rows[0]) : null;
}

/** Delete a claim and every link that references it, atomically. */
export async function deleteClaim(
  claimId: string,
  investigationId: string,
  userId: string
): Promise<{ deleted: boolean; removedLinks: number }> {
  return withTransaction(async (client) => {
    const owned = await client.query(
      'SELECT id FROM investigation_claims WHERE id = $1 AND investigation_id = $2 AND user_id = $3',
      [claimId, investigationId, userId]
    );
    if (owned.rows.length === 0) return { deleted: false, removedLinks: 0 };
    const removed = await client.query(
      `DELETE FROM reality_map_links
        WHERE investigation_id = $2 AND user_id = $3
          AND ((owner_type = 'claim' AND owner_id = $1)
            OR (target_type = 'claim' AND target_id = $1))`,
      [claimId, investigationId, userId]
    );
    await client.query(
      'DELETE FROM investigation_claims WHERE id = $1 AND investigation_id = $2 AND user_id = $3',
      [claimId, investigationId, userId]
    );
    return { deleted: true, removedLinks: removed.rowCount ?? 0 };
  });
}

// --- Hypotheses ------------------------------------------------------------

export interface CreateHypothesisData {
  name: string;
  explanation?: string;
  status?: string;
  confidence?: string;
  missingInformation?: string;
  alternativeExplanations?: string;
  playerNotes?: string;
  isTutorial?: boolean;
}

export async function createHypothesis(
  investigationId: string,
  userId: string,
  data: CreateHypothesisData
): Promise<RealityHypothesis> {
  const result = await query(
    `INSERT INTO investigation_hypotheses
       (investigation_id, user_id, name, explanation, status, confidence,
        missing_information, alternative_explanations, player_notes, is_tutorial)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${HYPOTHESIS_COLUMNS}`,
    [
      investigationId, userId, data.name, data.explanation ?? '',
      data.status ?? 'active', data.confidence ?? 'insufficient_information',
      data.missingInformation ?? '', data.alternativeExplanations ?? '',
      data.playerNotes ?? '', data.isTutorial === true,
    ]
  );
  return mapRow<RealityHypothesis>(result.rows[0]);
}

export async function getHypotheses(investigationId: string, userId: string): Promise<RealityHypothesis[]> {
  const result = await query(
    `SELECT ${HYPOTHESIS_COLUMNS} FROM investigation_hypotheses
      WHERE investigation_id = $1 AND user_id = $2
      ORDER BY created_at ASC, id ASC`,
    [investigationId, userId]
  );
  return mapRows<RealityHypothesis>(result.rows);
}

export async function getHypothesisById(
  hypothesisId: string,
  investigationId: string,
  userId: string
): Promise<RealityHypothesis | null> {
  const result = await query(
    `SELECT ${HYPOTHESIS_COLUMNS} FROM investigation_hypotheses
      WHERE id = $1 AND investigation_id = $2 AND user_id = $3 LIMIT 1`,
    [hypothesisId, investigationId, userId]
  );
  return result.rows[0] ? mapRow<RealityHypothesis>(result.rows[0]) : null;
}

export type HypothesisPatch = Partial<Pick<RealityHypothesis,
  'name' | 'explanation' | 'status' | 'confidence' |
  'missingInformation' | 'alternativeExplanations' | 'playerNotes'>>;

export async function updateHypothesis(
  hypothesisId: string,
  investigationId: string,
  userId: string,
  patch: HypothesisPatch
): Promise<RealityHypothesis | null> {
  const columns: string[] = [];
  const values: any[] = [];
  let next = 1;
  const add = (column: string, value: unknown): void => {
    columns.push(`${column} = $${next}`);
    values.push(value);
    next += 1;
  };
  if (patch.name !== undefined) add('name', patch.name);
  if (patch.explanation !== undefined) add('explanation', patch.explanation);
  if (patch.status !== undefined) add('status', patch.status);
  if (patch.confidence !== undefined) add('confidence', patch.confidence);
  if (patch.missingInformation !== undefined) add('missing_information', patch.missingInformation);
  if (patch.alternativeExplanations !== undefined) add('alternative_explanations', patch.alternativeExplanations);
  if (patch.playerNotes !== undefined) add('player_notes', patch.playerNotes);
  if (columns.length === 0) return getHypothesisById(hypothesisId, investigationId, userId);
  values.push(hypothesisId, investigationId, userId);
  const result = await query(
    `UPDATE investigation_hypotheses SET ${columns.join(', ')}, updated_at = NOW()
      WHERE id = $${next} AND investigation_id = $${next + 1} AND user_id = $${next + 2}
      RETURNING ${HYPOTHESIS_COLUMNS}`,
    values
  );
  return result.rows[0] ? mapRow<RealityHypothesis>(result.rows[0]) : null;
}

/** Delete a hypothesis and links it owns. Scoped to the owner. */
export async function deleteHypothesis(
  hypothesisId: string,
  investigationId: string,
  userId: string
): Promise<{ deleted: boolean; removedLinks: number }> {
  return withTransaction(async (client) => {
    const owned = await client.query(
      'SELECT id FROM investigation_hypotheses WHERE id = $1 AND investigation_id = $2 AND user_id = $3',
      [hypothesisId, investigationId, userId]
    );
    if (owned.rows.length === 0) return { deleted: false, removedLinks: 0 };
    const removed = await client.query(
      `DELETE FROM reality_map_links
        WHERE investigation_id = $2 AND user_id = $3
          AND owner_type = 'hypothesis' AND owner_id = $1`,
      [hypothesisId, investigationId, userId]
    );
    await client.query(
      'DELETE FROM investigation_hypotheses WHERE id = $1 AND investigation_id = $2 AND user_id = $3',
      [hypothesisId, investigationId, userId]
    );
    return { deleted: true, removedLinks: removed.rowCount ?? 0 };
  });
}

// --- Links -----------------------------------------------------------------

export interface CreateLinkData {
  ownerType: string;
  ownerId: string;
  targetType: string;
  targetId: string;
  relationship: string;
  rationale?: string;
  isTutorial?: boolean;
}

export async function createLink(
  investigationId: string,
  userId: string,
  data: CreateLinkData
): Promise<RealityMapLink> {
  const result = await query(
    `INSERT INTO reality_map_links
       (investigation_id, user_id, owner_type, owner_id, target_type, target_id,
        relationship, rationale, is_tutorial)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${LINK_COLUMNS}`,
    [
      investigationId, userId, data.ownerType, data.ownerId, data.targetType, data.targetId,
      data.relationship, data.rationale ?? '', data.isTutorial === true,
    ]
  );
  return mapRow<RealityMapLink>(result.rows[0]);
}

/** Find an existing link (used to report the duplicate id on 23505). */
export async function findLinkByShape(
  investigationId: string,
  userId: string,
  data: Pick<CreateLinkData, 'ownerType' | 'ownerId' | 'targetType' | 'targetId'>
): Promise<RealityMapLink | null> {
  const result = await query(
    `SELECT ${LINK_COLUMNS} FROM reality_map_links
      WHERE investigation_id = $1 AND user_id = $2
        AND owner_type = $3 AND owner_id = $4 AND target_type = $5 AND target_id = $6
      LIMIT 1`,
    [investigationId, userId, data.ownerType, data.ownerId, data.targetType, data.targetId]
  );
  return result.rows[0] ? mapRow<RealityMapLink>(result.rows[0]) : null;
}

export async function getLinks(investigationId: string, userId: string): Promise<RealityMapLink[]> {
  const result = await query(
    `SELECT ${LINK_COLUMNS} FROM reality_map_links
      WHERE investigation_id = $1 AND user_id = $2
      ORDER BY created_at ASC, id ASC`,
    [investigationId, userId]
  );
  return mapRows<RealityMapLink>(result.rows);
}

export async function getLinkById(
  linkId: string,
  investigationId: string,
  userId: string
): Promise<RealityMapLink | null> {
  const result = await query(
    `SELECT ${LINK_COLUMNS} FROM reality_map_links
      WHERE id = $1 AND investigation_id = $2 AND user_id = $3 LIMIT 1`,
    [linkId, investigationId, userId]
  );
  return result.rows[0] ? mapRow<RealityMapLink>(result.rows[0]) : null;
}

export async function updateLink(
  linkId: string,
  investigationId: string,
  userId: string,
  patch: { relationship?: string; rationale?: string }
): Promise<RealityMapLink | null> {
  const columns: string[] = [];
  const values: any[] = [];
  let next = 1;
  const add = (column: string, value: unknown): void => {
    columns.push(`${column} = $${next}`);
    values.push(value);
    next += 1;
  };
  if (patch.relationship !== undefined) add('relationship', patch.relationship);
  if (patch.rationale !== undefined) add('rationale', patch.rationale);
  if (columns.length === 0) return getLinkById(linkId, investigationId, userId);
  values.push(linkId, investigationId, userId);
  const result = await query(
    `UPDATE reality_map_links SET ${columns.join(', ')}, updated_at = NOW()
      WHERE id = $${next} AND investigation_id = $${next + 1} AND user_id = $${next + 2}
      RETURNING ${LINK_COLUMNS}`,
    values
  );
  return result.rows[0] ? mapRow<RealityMapLink>(result.rows[0]) : null;
}

export async function deleteLink(
  linkId: string,
  investigationId: string,
  userId: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM reality_map_links
      WHERE id = $1 AND investigation_id = $2 AND user_id = $3 RETURNING id`,
    [linkId, investigationId, userId]
  );
  return result.rows.length > 0;
}

/**
 * Resolve a link target to a safe label. Hidden/other-case evidence and any
 * material outside the player's own investigation return null, so links to
 * invisible content cannot be created or resolved on read.
 */
export async function resolveLinkTarget(params: {
  investigationId: string;
  caseId: string;
  userId: string;
  targetType: string;
  targetId: string;
}): Promise<LinkTargetResolution | null> {
  const { investigationId, caseId, userId, targetType, targetId } = params;
  if (!targetId || typeof targetId !== 'string') return null;

  if (targetType === 'evidence') {
    // getEvidenceByCase returns ONLY player-visible/discovered safe evidence.
    const visible = await getEvidenceByCase(caseId, userId);
    const match = visible.find((ev: any) => String(ev.id) === String(targetId));
    if (!match) return null;
    return {
      targetType, targetId,
      label: String(match.source || match.description || 'Evidence').slice(0, 160),
      subLabel: String(match.category || '').slice(0, 120),
    };
  }
  if (targetType === 'artifact') {
    const artifact = await getKnowledgeArtifactById(targetId, caseId);
    if (!artifact) return null;
    return { targetType, targetId, label: String(artifact.title || artifact.artifactKey || 'Artifact').slice(0, 160), subLabel: String(artifact.artifactType || '').slice(0, 120) };
  }
  if (targetType === 'specialist') {
    const result = await query(
      `SELECT s.name, s.title FROM specialists s
         JOIN case_specialists cs ON cs.specialist_id = s.id
        WHERE s.id = $1 AND cs.case_id = $2 LIMIT 1`,
      [targetId, caseId]
    );
    const row = mapRow<any>(result.rows[0] ?? null);
    if (!row) return null;
    return { targetType, targetId, label: String(row.name || 'Specialist').slice(0, 160), subLabel: String(row.title || '').slice(0, 120) };
  }
  if (targetType === 'character') {
    const result = await query(
      'SELECT name, role FROM characters WHERE id = $1 AND case_id = $2 LIMIT 1',
      [targetId, caseId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return { targetType, targetId, label: String(row.name || 'Character').slice(0, 160), subLabel: String(row.role || '').slice(0, 120) };
  }
  if (targetType === 'journal_entry') {
    const result = await query(
      'SELECT entry_type, content FROM journal_entries WHERE id = $1 AND investigation_id = $2 LIMIT 1',
      [targetId, investigationId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return { targetType, targetId, label: `Journal: ${String(row.entry_type || 'entry').slice(0, 80)}`, subLabel: String(row.content || '').slice(0, 120) };
  }
  if (targetType === 'notebook_entry') {
    const result = await query(
      `SELECT title, concept, entry_type FROM notebook_entries
        WHERE id = $1 AND investigation_id = $2 AND user_id = $3 LIMIT 1`,
      [targetId, investigationId, userId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return { targetType, targetId, label: String(row.title || row.concept || 'Notebook entry').slice(0, 160), subLabel: String(row.entry_type || '').slice(0, 120) };
  }
  if (targetType === 'claim') {
    const claim = await getClaimById(targetId, investigationId, userId);
    if (!claim) return null;
    return { targetType, targetId, label: String(claim.title || 'Claim').slice(0, 160), subLabel: 'your claim' };
  }
  // 'hypothesis' is not a legal link target (see the shape CHECK in 008).
  return null;
}

/** Remove only tutorial scaffolding (and its links) for one investigation. */
export async function deleteTutorialRealityExamples(
  investigationId: string,
  userId: string
): Promise<{ removedClaims: number; removedHypotheses: number; removedLinks: number }> {
  return withTransaction(async (client) => {
    const links = await client.query(
      `DELETE FROM reality_map_links
        WHERE investigation_id = $1 AND user_id = $2 AND is_tutorial = true`,
      [investigationId, userId]
    );
    const claims = await client.query(
      `DELETE FROM investigation_claims
        WHERE investigation_id = $1 AND user_id = $2 AND is_tutorial = true`,
      [investigationId, userId]
    );
    const hypotheses = await client.query(
      `DELETE FROM investigation_hypotheses
        WHERE investigation_id = $1 AND user_id = $2 AND is_tutorial = true`,
      [investigationId, userId]
    );
    return {
      removedLinks: links.rowCount ?? 0,
      removedClaims: claims.rowCount ?? 0,
      removedHypotheses: hypotheses.rowCount ?? 0,
    };
  });
}

// ===========================================================================
// M5 Perspective Engine (migration 009) — authored content, player reflections
// and advisory suggestion state. Educational/advisory only: NOTHING in this
// section reads canonical_truth or touches verdict, progression or evidence
// release. Reflection/suggestion rows are scoped by user_id (and
// investigation_id where applicable). No foreign keys, matching the baseline.
// ===========================================================================

const PERSPECTIVE_FRAMEWORK_COLUMNS = `id, framework_key, name, intellectual_domain, summary,
  core_questions, key_concepts, method_of_reasoning, limitations, common_misconceptions,
  internal_differences, relevant_disciplines, display_order, status, created_at, updated_at`;

const PERSPECTIVE_EXPERIENCE_COLUMNS = `id, experience_key, title, framework_key, format, knowledge_class,
  perspective_class, scope_note, tradition_scope, intellectual_purpose, primary_question,
  introduction, intellectual_background, main_idea, detailed_explanation, sections, historical_context,
  epistemic_breakdown, key_concepts, supporting_sources, limitations, counterarguments,
  common_misconceptions, reflection_questions, activities, recommendation_tags,
  related_experience_keys, related_specialist_keys, related_artifact_keys, related_case_titles,
  estimated_minutes, difficulty, display_order, status, created_at, updated_at`;

const PERSPECTIVE_REFLECTION_COLUMNS = `id, experience_id, experience_key, user_id, investigation_id,
  prompt_index, prompt, reflection_kind, response, created_at, updated_at`;

const PERSPECTIVE_SUGGESTION_COLUMNS = `id, investigation_id, user_id, experience_key, reason_code,
  state_fingerprint, status, created_at, updated_at`;

export interface PerspectiveFramework {
  id: string;
  frameworkKey: string;
  name: string;
  intellectualDomain: string;
  summary: string;
  coreQuestions: unknown;
  keyConcepts: unknown;
  methodOfReasoning: string;
  limitations: unknown;
  commonMisconceptions: unknown;
  internalDifferences: unknown;
  relevantDisciplines: unknown;
  displayOrder: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PerspectiveExperience {
  id: string;
  experienceKey: string;
  title: string;
  frameworkKey: string;
  format: string;
  knowledgeClass: string;
  perspectiveClass: string;
  scopeNote: string;
  traditionScope: string;
  intellectualPurpose: string;
  primaryQuestion: string;
  introduction: string;
  intellectualBackground: string;
  mainIdea: string;
  detailedExplanation: string;
  sections: unknown;
  historicalContext: string;
  epistemicBreakdown: unknown;
  keyConcepts: unknown;
  supportingSources: unknown;
  limitations: unknown;
  counterarguments: unknown;
  commonMisconceptions: unknown;
  reflectionQuestions: unknown;
  activities: unknown;
  recommendationTags: unknown;
  relatedExperienceKeys: unknown;
  relatedSpecialistKeys: unknown;
  relatedArtifactKeys: unknown;
  relatedCaseTitles: unknown;
  estimatedMinutes: number;
  difficulty: string;
  displayOrder: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PerspectiveReflection {
  id: string;
  experienceId: string;
  experienceKey: string;
  userId: string;
  investigationId: string | null;
  promptIndex: number;
  prompt: string;
  reflectionKind: string;
  response: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PerspectiveSuggestionState {
  id: string;
  investigationId: string;
  userId: string;
  experienceKey: string;
  reasonCode: string;
  stateFingerprint: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getPerspectiveFrameworks(status?: string): Promise<PerspectiveFramework[]> {
  const result = status
    ? await query(
        `SELECT ${PERSPECTIVE_FRAMEWORK_COLUMNS} FROM perspective_frameworks
          WHERE status = $1 ORDER BY display_order, framework_key`,
        [status]
      )
    : await query(
        `SELECT ${PERSPECTIVE_FRAMEWORK_COLUMNS} FROM perspective_frameworks
          WHERE status = 'published' ORDER BY display_order, framework_key`
      );
  return mapRows<PerspectiveFramework>(result.rows);
}

export async function getPerspectiveFrameworkByKey(frameworkKey: string): Promise<PerspectiveFramework | null> {
  const result = await query(
    `SELECT ${PERSPECTIVE_FRAMEWORK_COLUMNS} FROM perspective_frameworks WHERE framework_key = $1`,
    [frameworkKey]
  );
  return result.rows[0] ? mapRow<PerspectiveFramework>(result.rows[0]) : null;
}

export interface PerspectiveExperienceFilters {
  frameworkKey?: string | undefined;
  format?: string | undefined;
  q?: string | undefined;
  status?: string | undefined;
  limit?: number | undefined;
}

export async function getPerspectiveExperiences(
  filters: PerspectiveExperienceFilters = {}
): Promise<PerspectiveExperience[]> {
  const clauses: string[] = [];
  const values: any[] = [];
  if (filters.frameworkKey !== undefined) {
    values.push(filters.frameworkKey);
    clauses.push(`framework_key = $${values.length}`);
  }
  if (filters.format !== undefined) {
    values.push(filters.format);
    clauses.push(`format = $${values.length}`);
  }
  const status = filters.status ?? 'published';
  values.push(status);
  clauses.push(`status = $${values.length}`);
  if (typeof filters.q === 'string' && filters.q.trim().length > 0) {
    // Search only player-facing text columns. The bound is a parameter, never
    // concatenated, and '%'/'_' in the query are treated as literals.
    const needle = `%${filters.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
    values.push(needle);
    clauses.push(`(title ILIKE $${values.length} ESCAPE '\\' OR primary_question ILIKE $${values.length} ESCAPE '\\' OR main_idea ILIKE $${values.length} ESCAPE '\\' OR scope_note ILIKE $${values.length} ESCAPE '\\')`);
  }
  let sql = `SELECT ${PERSPECTIVE_EXPERIENCE_COLUMNS} FROM perspective_experiences
          WHERE ${clauses.join(' AND ')} ORDER BY display_order, experience_key`;
  if (Number.isFinite(filters.limit)) {
    const limit = Math.max(0, Math.min(Math.trunc(filters.limit as number), 200));
    values.push(limit);
    sql += ` LIMIT $${values.length}`;
  }
  const result = await query(sql, values);
  return mapRows<PerspectiveExperience>(result.rows);
}

export async function getPerspectiveExperienceByKey(experienceKey: string): Promise<PerspectiveExperience | null> {
  const result = await query(
    `SELECT ${PERSPECTIVE_EXPERIENCE_COLUMNS} FROM perspective_experiences WHERE experience_key = $1`,
    [experienceKey]
  );
  return result.rows[0] ? mapRow<PerspectiveExperience>(result.rows[0]) : null;
}

/** Resolve an experience by its stable UUID (used by notebook/claim provenance). */
export async function getPerspectiveExperienceById(id: string): Promise<PerspectiveExperience | null> {
  const result = await query(
    `SELECT ${PERSPECTIVE_EXPERIENCE_COLUMNS} FROM perspective_experiences WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapRow<PerspectiveExperience>(result.rows[0]) : null;
}

export interface CreatePerspectiveReflectionData {
  experienceId: string;
  experienceKey: string;
  userId: string;
  investigationId?: string | null;
  promptIndex?: number | undefined;
  prompt?: string | undefined;
  reflectionKind: string;
  response: string;
}

export async function createPerspectiveReflection(
  data: CreatePerspectiveReflectionData
): Promise<PerspectiveReflection> {
  const result = await query(
    `INSERT INTO perspective_reflections
       (experience_id, experience_key, user_id, investigation_id, prompt_index, prompt, reflection_kind, response)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${PERSPECTIVE_REFLECTION_COLUMNS}`,
    [
      data.experienceId,
      data.experienceKey,
      data.userId,
      data.investigationId ?? null,
      data.promptIndex ?? 0,
      data.prompt ?? '',
      data.reflectionKind,
      data.response,
    ]
  );
  return mapRow<PerspectiveReflection>(result.rows[0]);
}

export async function getPerspectiveReflections(
  userId: string,
  experienceKey?: string,
  investigationId?: string
): Promise<PerspectiveReflection[]> {
  const clauses: string[] = ['user_id = $1'];
  const values: any[] = [userId];
  if (experienceKey !== undefined) {
    values.push(experienceKey);
    clauses.push(`experience_key = $${values.length}`);
  }
  if (investigationId !== undefined) {
    values.push(investigationId);
    clauses.push(`investigation_id = $${values.length}`);
  }
  const result = await query(
    `SELECT ${PERSPECTIVE_REFLECTION_COLUMNS} FROM perspective_reflections
      WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`,
    values
  );
  return mapRows<PerspectiveReflection>(result.rows);
}

/** Fetch a single reflection by id. Ownership is checked by the caller (or the
 *  scoped update/delete helpers below); this helper is read-only. */
export async function getPerspectiveReflectionById(id: string): Promise<PerspectiveReflection | null> {
  const result = await query(
    `SELECT ${PERSPECTIVE_REFLECTION_COLUMNS} FROM perspective_reflections WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapRow<PerspectiveReflection>(result.rows[0]) : null;
}

export async function updatePerspectiveReflection(
  id: string,
  userId: string,
  data: { response?: string; reflectionKind?: string }
): Promise<PerspectiveReflection | null> {
  const columns: string[] = [];
  const values: any[] = [];
  let next = 1;
  const add = (column: string, value: unknown): void => {
    columns.push(`${column} = $${next}`);
    values.push(value);
    next += 1;
  };
  if (data.response !== undefined) add('response', data.response);
  if (data.reflectionKind !== undefined) add('reflection_kind', data.reflectionKind);
  if (columns.length === 0) {
    const current = await query(
      `SELECT ${PERSPECTIVE_REFLECTION_COLUMNS} FROM perspective_reflections WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return current.rows[0] ? mapRow<PerspectiveReflection>(current.rows[0]) : null;
  }
  values.push(id, userId);
  const result = await query(
    `UPDATE perspective_reflections SET ${columns.join(', ')}, updated_at = NOW()
      WHERE id = $${next} AND user_id = $${next + 1}
      RETURNING ${PERSPECTIVE_REFLECTION_COLUMNS}`,
    values
  );
  return result.rows[0] ? mapRow<PerspectiveReflection>(result.rows[0]) : null;
}

export async function deletePerspectiveReflection(id: string, userId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM perspective_reflections WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  return result.rows.length > 0;
}

export async function getPerspectiveSuggestionState(
  investigationId: string,
  userId: string,
  experienceKey: string
): Promise<PerspectiveSuggestionState | null> {
  const result = await query(
    `SELECT ${PERSPECTIVE_SUGGESTION_COLUMNS} FROM perspective_suggestion_state
      WHERE investigation_id = $1 AND user_id = $2 AND experience_key = $3`,
    [investigationId, userId, experienceKey]
  );
  return result.rows[0] ? mapRow<PerspectiveSuggestionState>(result.rows[0]) : null;
}

export async function getPerspectiveSuggestionStates(
  investigationId: string,
  userId: string
): Promise<PerspectiveSuggestionState[]> {
  const result = await query(
    `SELECT ${PERSPECTIVE_SUGGESTION_COLUMNS} FROM perspective_suggestion_state
      WHERE investigation_id = $1 AND user_id = $2 ORDER BY experience_key`,
    [investigationId, userId]
  );
  return mapRows<PerspectiveSuggestionState>(result.rows);
}

export async function upsertPerspectiveSuggestionState(data: {
  investigationId: string;
  userId: string;
  experienceKey: string;
  reasonCode: string;
  stateFingerprint: string;
  status: string;
}): Promise<PerspectiveSuggestionState> {
  const result = await query(
    `INSERT INTO perspective_suggestion_state
       (investigation_id, user_id, experience_key, reason_code, state_fingerprint, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (investigation_id, user_id, experience_key) DO UPDATE SET
       reason_code = EXCLUDED.reason_code,
       state_fingerprint = EXCLUDED.state_fingerprint,
       status = EXCLUDED.status,
       updated_at = NOW()
     RETURNING ${PERSPECTIVE_SUGGESTION_COLUMNS}`,
    [
      data.investigationId,
      data.userId,
      data.experienceKey,
      data.reasonCode,
      data.stateFingerprint,
      data.status,
    ]
  );
  return mapRow<PerspectiveSuggestionState>(result.rows[0]);
}

// ===========================================================================
// M7 Real-World Discovery & Knowledge Retention (migration 011).
//
// DUMB + SAFE BY DESIGN: every query below is explicitly column-projected,
// parameterised, and scoped by investigation_id AND/OR user_id. No query in
// this section reads canonical_truth, hidden evidence or release conditions,
// and none writes to evidence_discoveries. Acceptance, unlock creation and
// scheduling orchestration live in src/discovery-service.ts.
// ===========================================================================

export interface DiscoveryClueState {
  id: string;
  investigationId: string;
  userId: string;
  caseId: string;
  clueKey: string;
  state: string;
  surfacedAt: Date | null;
  researchStartedAt: Date | null;
  acceptedAt: Date | null;
  lastSubmittedAt: Date | null;
  attemptCount: number;
  sourceContext: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const DISCOVERY_CLUE_STATE_COLUMNS = `id, investigation_id, user_id, case_id, clue_key, state,
  surfaced_at, research_started_at, accepted_at, last_submitted_at, attempt_count,
  source_context, created_at, updated_at`;

export async function getDiscoveryClueStates(
  investigationId: string,
  userId: string,
): Promise<DiscoveryClueState[]> {
  const result = await query(
    `SELECT ${DISCOVERY_CLUE_STATE_COLUMNS} FROM investigation_discovery_clue_states
      WHERE investigation_id = $1 AND user_id = $2
      ORDER BY clue_key ASC`,
    [investigationId, userId],
  );
  return mapRows<DiscoveryClueState>(result.rows);
}

export async function getDiscoveryClueState(
  investigationId: string,
  userId: string,
  clueKey: string,
): Promise<DiscoveryClueState | null> {
  const result = await query(
    `SELECT ${DISCOVERY_CLUE_STATE_COLUMNS} FROM investigation_discovery_clue_states
      WHERE investigation_id = $1 AND user_id = $2 AND clue_key = $3 LIMIT 1`,
    [investigationId, userId, clueKey],
  );
  return result.rows[0] ? mapRow<DiscoveryClueState>(result.rows[0]) : null;
}

export async function upsertDiscoveryClueState(data: {
  investigationId: string;
  userId: string;
  caseId: string;
  clueKey: string;
  state: 'noticed' | 'researching' | 'submitted' | 'accepted' | 'dormant';
  surfacedAt?: Date | string | null;
  researchStartedAt?: Date | string | null;
  acceptedAt?: Date | string | null;
  lastSubmittedAt?: Date | string | null;
  attemptCount?: number;
  sourceContext?: Record<string, unknown>;
}): Promise<DiscoveryClueState> {
  const result = await query(
    `INSERT INTO investigation_discovery_clue_states
       (investigation_id, user_id, case_id, clue_key, state, surfaced_at, research_started_at,
        accepted_at, last_submitted_at, attempt_count, source_context)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
     ON CONFLICT (investigation_id, clue_key) DO UPDATE SET
       state = EXCLUDED.state,
       surfaced_at = COALESCE(investigation_discovery_clue_states.surfaced_at, EXCLUDED.surfaced_at),
       research_started_at = COALESCE(investigation_discovery_clue_states.research_started_at, EXCLUDED.research_started_at),
       accepted_at = COALESCE(investigation_discovery_clue_states.accepted_at, EXCLUDED.accepted_at),
       last_submitted_at = COALESCE(EXCLUDED.last_submitted_at, investigation_discovery_clue_states.last_submitted_at),
       attempt_count = GREATEST(investigation_discovery_clue_states.attempt_count, EXCLUDED.attempt_count),
       source_context = CASE
         WHEN EXCLUDED.source_context = '{}'::jsonb THEN investigation_discovery_clue_states.source_context
         ELSE EXCLUDED.source_context END,
       updated_at = NOW()
     RETURNING ${DISCOVERY_CLUE_STATE_COLUMNS}`,
    [
      data.investigationId,
      data.userId,
      data.caseId,
      data.clueKey,
      data.state,
      data.surfacedAt ?? null,
      data.researchStartedAt ?? null,
      data.acceptedAt ?? null,
      data.lastSubmittedAt ?? null,
      Math.max(0, Math.floor(data.attemptCount ?? 0)),
      JSON.stringify(data.sourceContext ?? {}),
    ],
  );
  return mapRow<DiscoveryClueState>(result.rows[0]);
}

export interface DiscoverySubmission {
  id: string;
  investigationId: string;
  userId: string;
  clueKey: string;
  memoryItemId: string | null;
  explanation: string;
  subjectIdentification: string;
  connectionExplanation: string;
  uncertainty: string;
  sourceRefs: unknown;
  confidence: string | null;
  classification: string;
  accepted: boolean;
  score: number | string;
  llmUsed: boolean;
  createdAt: Date;
}

const DISCOVERY_SUBMISSION_COLUMNS = `id, investigation_id, user_id, clue_key, memory_item_id,
  explanation, subject_identification, connection_explanation, uncertainty, source_refs,
  confidence, classification, accepted, score, llm_used, created_at`;

export async function createDiscoverySubmission(data: {
  investigationId: string;
  userId: string;
  clueKey: string;
  memoryItemId?: string | null;
  explanation: string;
  subjectIdentification: string;
  connectionExplanation: string;
  uncertainty: string;
  sourceRefs: readonly string[];
  confidence: string | null;
  /** INTERNAL ONLY: reason codes / advisory data. Public DTOs never copy it. */
  evaluation: Record<string, unknown>;
  classification: string;
  accepted: boolean;
  score: number;
  llmUsed: boolean;
}): Promise<DiscoverySubmission> {
  const result = await query(
    `INSERT INTO discovery_submissions
       (investigation_id, user_id, clue_key, memory_item_id, explanation, subject_identification,
        connection_explanation, uncertainty, source_refs, confidence, evaluation, classification,
        accepted, score, llm_used)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::jsonb, $12, $13, $14, $15)
     RETURNING ${DISCOVERY_SUBMISSION_COLUMNS}`,
    [
      data.investigationId,
      data.userId,
      data.clueKey,
      data.memoryItemId ?? null,
      data.explanation,
      data.subjectIdentification,
      data.connectionExplanation,
      data.uncertainty,
      JSON.stringify(data.sourceRefs),
      data.confidence,
      JSON.stringify(data.evaluation),
      data.classification,
      data.accepted,
      data.score,
      data.llmUsed,
    ],
  );
  return mapRow<DiscoverySubmission>(result.rows[0]);
}

export async function listDiscoverySubmissions(
  investigationId: string,
  userId: string,
  clueKey?: string,
): Promise<DiscoverySubmission[]> {
  const params: any[] = [investigationId, userId];
  let filter = '';
  if (clueKey !== undefined) {
    params.push(clueKey);
    filter = ' AND clue_key = $3';
  }
  const result = await query(
    `SELECT ${DISCOVERY_SUBMISSION_COLUMNS} FROM discovery_submissions
      WHERE investigation_id = $1 AND user_id = $2${filter}
      ORDER BY created_at DESC, id DESC`,
    params,
  );
  return mapRows<DiscoverySubmission>(result.rows);
}

export interface KnowledgeMemoryItem {
  id: string;
  userId: string;
  subjectKey: string;
  subjectLabel: string;
  referenceCategory: string;
  knowledgeStatus: string;
  concepts: unknown;
  correctedUnderstanding: string;
  originalExplanation: string;
  latestExplanation: string;
  authoredSources: unknown;
  playerSources: unknown;
  firstCaseId: string | null;
  firstInvestigationId: string | null;
  firstClueKey: string | null;
  firstDiscoveredAt: Date;
  lastRecallAt: Date | null;
  lastSuccessfulRecallAt: Date | null;
  nextDueAt: Date | null;
  masteryStatus: string;
  successfulRecalls: number;
  failedRecalls: number;
  unresolvedQuestions: unknown;
  followUpApplications: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const KNOWLEDGE_MEMORY_ITEM_COLUMNS = `id, user_id, subject_key, subject_label, reference_category,
  knowledge_status, concepts, corrected_understanding, original_explanation, latest_explanation,
  authored_sources, player_sources, first_case_id, first_investigation_id, first_clue_key,
  first_discovered_at, last_recall_at, last_successful_recall_at, next_due_at, mastery_status,
  successful_recalls, failed_recalls, unresolved_questions, follow_up_applications, created_at, updated_at`;

export async function getKnowledgeMemoryItemBySubject(
  userId: string,
  subjectKey: string,
): Promise<KnowledgeMemoryItem | null> {
  const result = await query(
    `SELECT ${KNOWLEDGE_MEMORY_ITEM_COLUMNS} FROM knowledge_memory_items
      WHERE user_id = $1 AND subject_key = $2 LIMIT 1`,
    [userId, subjectKey],
  );
  return result.rows[0] ? mapRow<KnowledgeMemoryItem>(result.rows[0]) : null;
}

export async function getKnowledgeMemoryItemById(
  id: string,
  userId: string,
): Promise<KnowledgeMemoryItem | null> {
  const result = await query(
    `SELECT ${KNOWLEDGE_MEMORY_ITEM_COLUMNS} FROM knowledge_memory_items
      WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [id, userId],
  );
  return result.rows[0] ? mapRow<KnowledgeMemoryItem>(result.rows[0]) : null;
}

export async function listKnowledgeMemoryItems(userId: string): Promise<KnowledgeMemoryItem[]> {
  const result = await query(
    `SELECT ${KNOWLEDGE_MEMORY_ITEM_COLUMNS} FROM knowledge_memory_items
      WHERE user_id = $1
      ORDER BY next_due_at ASC NULLS FIRST, created_at DESC`,
    [userId],
  );
  return mapRows<KnowledgeMemoryItem>(result.rows);
}

/** Create on first acceptance; refresh safe descriptive fields thereafter. */
export async function upsertKnowledgeMemoryItem(data: {
  userId: string;
  subjectKey: string;
  subjectLabel: string;
  referenceCategory: string;
  knowledgeStatus: string;
  concepts: readonly string[];
  correctedUnderstanding: string;
  originalExplanation: string;
  latestExplanation: string;
  authoredSources: readonly string[];
  playerSources: readonly string[];
  caseId: string;
  investigationId: string;
  clueKey: string;
  nextDueAt: string | null;
}): Promise<KnowledgeMemoryItem> {
  const result = await query(
    `INSERT INTO knowledge_memory_items
       (user_id, subject_key, subject_label, reference_category, knowledge_status, concepts,
        corrected_understanding, original_explanation, latest_explanation, authored_sources,
        player_sources, first_case_id, first_investigation_id, first_clue_key, next_due_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14, $15)
     ON CONFLICT (user_id, subject_key) DO UPDATE SET
       subject_label = EXCLUDED.subject_label,
       reference_category = EXCLUDED.reference_category,
       knowledge_status = EXCLUDED.knowledge_status,
       concepts = EXCLUDED.concepts,
       corrected_understanding = EXCLUDED.corrected_understanding,
       latest_explanation = EXCLUDED.latest_explanation,
       authored_sources = EXCLUDED.authored_sources,
       player_sources = EXCLUDED.player_sources,
       follow_up_applications = CASE
         WHEN knowledge_memory_items.follow_up_applications @> to_jsonb(ARRAY[EXCLUDED.first_clue_key])
           THEN knowledge_memory_items.follow_up_applications
         ELSE knowledge_memory_items.follow_up_applications || to_jsonb(ARRAY[EXCLUDED.first_clue_key]) END,
       updated_at = NOW()
     RETURNING ${KNOWLEDGE_MEMORY_ITEM_COLUMNS}`,
    [
      data.userId,
      data.subjectKey,
      data.subjectLabel,
      data.referenceCategory,
      data.knowledgeStatus,
      JSON.stringify(data.concepts),
      data.correctedUnderstanding,
      data.originalExplanation,
      data.latestExplanation,
      JSON.stringify(data.authoredSources),
      JSON.stringify(data.playerSources),
      data.caseId,
      data.investigationId,
      data.clueKey,
      data.nextDueAt,
    ],
  );
  return mapRow<KnowledgeMemoryItem>(result.rows[0]);
}

export async function updateKnowledgeMemoryRecall(
  id: string,
  userId: string,
  data: {
    lastRecallAt: string;
    lastSuccessfulRecallAt: string | null;
    nextDueAt: string;
    masteryStatus: string;
    successfulRecalls: number;
    failedRecalls: number;
  },
): Promise<KnowledgeMemoryItem | null> {
  const result = await query(
    `UPDATE knowledge_memory_items SET
       last_recall_at = $3,
       last_successful_recall_at = COALESCE($4, last_successful_recall_at),
       next_due_at = $5,
       mastery_status = $6,
       successful_recalls = $7,
       failed_recalls = $8,
       updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING ${KNOWLEDGE_MEMORY_ITEM_COLUMNS}`,
    [
      id,
      userId,
      data.lastRecallAt,
      data.lastSuccessfulRecallAt,
      data.nextDueAt,
      data.masteryStatus,
      data.successfulRecalls,
      data.failedRecalls,
    ],
  );
  return result.rows[0] ? mapRow<KnowledgeMemoryItem>(result.rows[0]) : null;
}

export interface KnowledgeMemoryCase {
  id: string;
  memoryItemId: string;
  userId: string;
  investigationId: string;
  caseId: string;
  clueKey: string;
  applicationContext: string;
  createdAt: Date;
}

const KNOWLEDGE_MEMORY_CASE_COLUMNS = `id, memory_item_id, user_id, investigation_id, case_id,
  clue_key, application_context, created_at`;

export async function upsertKnowledgeMemoryCase(data: {
  memoryItemId: string;
  userId: string;
  investigationId: string;
  caseId: string;
  clueKey: string;
  applicationContext: string;
}): Promise<KnowledgeMemoryCase> {
  const result = await query(
    `INSERT INTO knowledge_memory_cases
       (memory_item_id, user_id, investigation_id, case_id, clue_key, application_context)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, investigation_id, clue_key) DO UPDATE SET
       memory_item_id = EXCLUDED.memory_item_id,
       application_context = EXCLUDED.application_context
     RETURNING ${KNOWLEDGE_MEMORY_CASE_COLUMNS}`,
    [
      data.memoryItemId,
      data.userId,
      data.investigationId,
      data.caseId,
      data.clueKey,
      data.applicationContext,
    ],
  );
  return mapRow<KnowledgeMemoryCase>(result.rows[0]);
}

export async function listKnowledgeMemoryCases(
  memoryItemId: string,
  userId: string,
): Promise<KnowledgeMemoryCase[]> {
  const result = await query(
    `SELECT ${KNOWLEDGE_MEMORY_CASE_COLUMNS} FROM knowledge_memory_cases
      WHERE memory_item_id = $1 AND user_id = $2
      ORDER BY created_at DESC`,
    [memoryItemId, userId],
  );
  return mapRows<KnowledgeMemoryCase>(result.rows);
}

export interface KnowledgeMemoryLink {
  id: string;
  userId: string;
  fromMemoryId: string;
  toMemoryId: string;
  fromSubjectKey: string;
  toSubjectKey: string;
  pairKey: string;
  relationship: string;
  rationale: string;
  createdAt: Date;
}

const KNOWLEDGE_MEMORY_LINK_COLUMNS = `id, user_id, from_memory_id, to_memory_id, from_subject_key,
  to_subject_key, pair_key, relationship, rationale, created_at`;

export async function upsertKnowledgeMemoryLink(data: {
  userId: string;
  fromMemoryId: string;
  toMemoryId: string;
  fromSubjectKey: string;
  toSubjectKey: string;
  pairKey: string;
  relationship: string;
  rationale: string;
}): Promise<KnowledgeMemoryLink> {
  const result = await query(
    `INSERT INTO knowledge_memory_links
       (user_id, from_memory_id, to_memory_id, from_subject_key, to_subject_key, pair_key, relationship, rationale)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, pair_key) DO UPDATE SET
       relationship = EXCLUDED.relationship,
       rationale = EXCLUDED.rationale,
       from_memory_id = EXCLUDED.from_memory_id,
       to_memory_id = EXCLUDED.to_memory_id
     RETURNING ${KNOWLEDGE_MEMORY_LINK_COLUMNS}`,
    [
      data.userId,
      data.fromMemoryId,
      data.toMemoryId,
      data.fromSubjectKey,
      data.toSubjectKey,
      data.pairKey,
      data.relationship,
      data.rationale,
    ],
  );
  return mapRow<KnowledgeMemoryLink>(result.rows[0]);
}

export async function listKnowledgeMemoryLinks(
  userId: string,
  memoryItemId?: string,
): Promise<KnowledgeMemoryLink[]> {
  const params: any[] = [userId];
  let filter = '';
  if (memoryItemId !== undefined) {
    params.push(memoryItemId);
    filter = ' AND (from_memory_id = $2 OR to_memory_id = $2)';
  }
  const result = await query(
    `SELECT ${KNOWLEDGE_MEMORY_LINK_COLUMNS} FROM knowledge_memory_links
      WHERE user_id = $1${filter}
      ORDER BY created_at DESC`,
    params,
  );
  return mapRows<KnowledgeMemoryLink>(result.rows);
}

export interface KnowledgeRecallEvent {
  id: string;
  userId: string;
  memoryItemId: string;
  investigationId: string | null;
  clueKey: string | null;
  recallKind: string;
  prompt: string;
  response: string;
  outcome: string;
  scheduledFor: Date | null;
  answeredAt: Date | null;
  intervalDays: number | null;
  nextDueAt: Date | null;
  createdAt: Date;
}

const KNOWLEDGE_RECALL_EVENT_COLUMNS = `id, user_id, memory_item_id, investigation_id, clue_key,
  recall_kind, prompt, response, outcome, scheduled_for, answered_at, interval_days,
  next_due_at, created_at`;

export async function createKnowledgeRecallEvent(data: {
  userId: string;
  memoryItemId: string;
  investigationId?: string | null;
  clueKey?: string | null;
  recallKind: string;
  prompt: string;
  response: string;
  outcome: 'success' | 'partial' | 'missed';
  scheduledFor?: string | null;
  answeredAt?: string | null;
  intervalDays: number;
  nextDueAt: string;
}): Promise<KnowledgeRecallEvent> {
  const result = await query(
    `INSERT INTO knowledge_recall_events
       (user_id, memory_item_id, investigation_id, clue_key, recall_kind, prompt, response,
        outcome, scheduled_for, answered_at, interval_days, next_due_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${KNOWLEDGE_RECALL_EVENT_COLUMNS}`,
    [
      data.userId,
      data.memoryItemId,
      data.investigationId ?? null,
      data.clueKey ?? null,
      data.recallKind,
      data.prompt,
      data.response,
      data.outcome,
      data.scheduledFor ?? null,
      data.answeredAt ?? null,
      data.intervalDays,
      data.nextDueAt,
    ],
  );
  return mapRow<KnowledgeRecallEvent>(result.rows[0]);
}

export async function listKnowledgeRecallEvents(
  memoryItemId: string,
  userId: string,
): Promise<KnowledgeRecallEvent[]> {
  const result = await query(
    `SELECT ${KNOWLEDGE_RECALL_EVENT_COLUMNS} FROM knowledge_recall_events
      WHERE memory_item_id = $1 AND user_id = $2
      ORDER BY created_at DESC, id DESC`,
    [memoryItemId, userId],
  );
  return mapRows<KnowledgeRecallEvent>(result.rows);
}

export interface DiscoveryUnlock {
  id: string;
  investigationId: string;
  userId: string;
  clueKey: string;
  unlockKey: string;
  kind: string;
  targetRef: string;
  payload: unknown;
  appliedAt: Date | null;
  createdAt: Date;
}

const DISCOVERY_UNLOCK_COLUMNS = `id, investigation_id, user_id, clue_key, unlock_key, kind,
  target_ref, payload, applied_at, created_at`;

export async function getDiscoveryUnlocks(
  investigationId: string,
  userId: string,
): Promise<DiscoveryUnlock[]> {
  const result = await query(
    `SELECT ${DISCOVERY_UNLOCK_COLUMNS} FROM investigation_discovery_unlocks
      WHERE investigation_id = $1 AND user_id = $2
      ORDER BY clue_key ASC, created_at ASC`,
    [investigationId, userId],
  );
  return mapRows<DiscoveryUnlock>(result.rows);
}

export async function getDiscoveryUnlock(
  investigationId: string,
  userId: string,
  unlockKey: string,
): Promise<DiscoveryUnlock | null> {
  const result = await query(
    `SELECT ${DISCOVERY_UNLOCK_COLUMNS} FROM investigation_discovery_unlocks
      WHERE investigation_id = $1 AND user_id = $2 AND unlock_key = $3 LIMIT 1`,
    [investigationId, userId, unlockKey],
  );
  return result.rows[0] ? mapRow<DiscoveryUnlock>(result.rows[0]) : null;
}

/** Idempotent: a repeated accepted submission never duplicates unlock rows. */
export async function createDiscoveryUnlockIfMissing(data: {
  investigationId: string;
  userId: string;
  clueKey: string;
  unlockKey: string;
  kind: string;
  targetRef: string;
  payload: Record<string, unknown>;
}): Promise<DiscoveryUnlock> {
  const inserted = await query(
    `INSERT INTO investigation_discovery_unlocks
       (investigation_id, user_id, clue_key, unlock_key, kind, target_ref, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (investigation_id, clue_key, unlock_key) DO NOTHING
     RETURNING ${DISCOVERY_UNLOCK_COLUMNS}`,
    [
      data.investigationId,
      data.userId,
      data.clueKey,
      data.unlockKey,
      data.kind,
      data.targetRef,
      JSON.stringify(data.payload),
    ],
  );
  if (inserted.rows[0]) return mapRow<DiscoveryUnlock>(inserted.rows[0]);
  const existing = await getDiscoveryUnlock(data.investigationId, data.userId, data.unlockKey);
  if (!existing) throw new Error('[M7] unlock insert succeeded without a readable row');
  return existing;
}

/** Conditional update makes action application idempotent and race-safe. */
export async function markDiscoveryActionUnlockApplied(
  id: string,
  investigationId: string,
  userId: string,
  appliedAt: string,
): Promise<boolean> {
  const result = await query(
    `UPDATE investigation_discovery_unlocks SET applied_at = $4
      WHERE id = $1 AND investigation_id = $2 AND user_id = $3 AND applied_at IS NULL
      RETURNING id`,
    [id, investigationId, userId, appliedAt],
  );
  return result.rows.length > 0;
}

// ---------------------------------------------------------------------------
// M8-6: personal progress aggregates (read-only, session-user scoped).
//
// These helpers are deliberately just COUNT/GROUP BY over data the player
// already owns. They never read canonical_truth, hidden evidence, evaluation
// reason codes, or another user's rows. The route/service owns the explicit
// allowlisted DTO; keeping the SQL here preserves the existing data-layer
// boundary (routes never build their own queries).
// ---------------------------------------------------------------------------

export interface InvestigationStatusCount {
  status: string;
  count: number;
  cases: number;
}

/** Per-status investigation counts + distinct cases played by this user. */
export async function getInvestigationStatusCounts(userId: string): Promise<InvestigationStatusCount[]> {
  const result = await query(
    `SELECT status,
            COUNT(*)::int AS count,
            COUNT(DISTINCT case_id)::int AS cases
       FROM investigations
      WHERE user_id = $1
      GROUP BY status`,
    [userId],
  );
  return result.rows.map((r: any) => ({
    status: String(r.status ?? 'unknown'),
    count: Number(r.count) || 0,
    cases: Number(r.cases) || 0,
  }));
}

/** Case ids this user has started (used only to exclude suggestions). */
export async function getPlayedCaseIds(userId: string): Promise<string[]> {
  const result = await query(
    `SELECT DISTINCT case_id
       FROM investigations
      WHERE user_id = $1 AND case_id IS NOT NULL`,
    [userId],
  );
  return result.rows.map((r: any) => String(r.case_id));
}

/** Server-awarded achievement counts, scoped through owned investigations. */
export async function getAchievementTypeCounts(userId: string): Promise<Array<{ type: string; count: number }>> {
  const result = await query(
    `SELECT ca.achievement_type AS type, COUNT(*)::int AS count
       FROM case_achievements ca
       JOIN investigations i ON i.id = ca.investigation_id
      WHERE i.user_id = $1
      GROUP BY ca.achievement_type`,
    [userId],
  );
  return result.rows.map((r: any) => ({
    type: String(r.type ?? 'unknown'),
    count: Number(r.count) || 0,
  }));
}

/** Discovery acceptance + cross-case knowledge reuse counts. */
export async function getDiscoveryProgressCounts(userId: string): Promise<{
  acceptedSubmissions: number;
  acceptedClues: number;
  crossCaseApplications: number;
  totalApplications: number;
}> {
  const result = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM discovery_submissions
          WHERE user_id = $1 AND accepted = true) AS accepted_submissions,
       (SELECT COUNT(DISTINCT clue_key)::int FROM discovery_submissions
          WHERE user_id = $1 AND accepted = true) AS accepted_clues,
       (SELECT COUNT(*)::int
          FROM knowledge_memory_cases kmc
          JOIN knowledge_memory_items kmi ON kmi.id = kmc.memory_item_id
         WHERE kmc.user_id = $1
           AND kmc.case_id IS DISTINCT FROM kmi.first_case_id) AS cross_case_applications,
       (SELECT COUNT(*)::int FROM knowledge_memory_cases
          WHERE user_id = $1) AS total_applications`,
    [userId],
  );
  const row = result.rows[0] ?? {};
  return {
    acceptedSubmissions: Number(row.accepted_submissions) || 0,
    acceptedClues: Number(row.accepted_clues) || 0,
    crossCaseApplications: Number(row.cross_case_applications) || 0,
    totalApplications: Number(row.total_applications) || 0,
  };
}

/** Honest "recent activity" window. No last-visit signal is assumed. */
export async function getRecentProgressActivity(userId: string): Promise<{
  newMemoryItems: number;
  completedCases: number;
  acceptedDiscoveries: number;
  newNotifications: number;
}> {
  const result = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM knowledge_memory_items
          WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days') AS new_memory_items,
       (SELECT COUNT(*)::int FROM investigations
          WHERE user_id = $1 AND status = 'completed'
            AND completion_timestamp >= NOW() - INTERVAL '7 days') AS completed_cases,
       (SELECT COUNT(*)::int FROM discovery_submissions
          WHERE user_id = $1 AND accepted = true
            AND created_at >= NOW() - INTERVAL '7 days') AS accepted_discoveries,
       (SELECT COUNT(*)::int FROM notifications
          WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days') AS new_notifications`,
    [userId],
  );
  const row = result.rows[0] ?? {};
  return {
    newMemoryItems: Number(row.new_memory_items) || 0,
    completedCases: Number(row.completed_cases) || 0,
    acceptedDiscoveries: Number(row.accepted_discoveries) || 0,
    newNotifications: Number(row.new_notifications) || 0,
  };
}

/** Deterministic case suggestions: unplayed published cases, safe fields only. */
export async function getUnplayedCaseSuggestions(
  excludeCaseIds: readonly string[],
  limit: number,
): Promise<Array<{ id: string; title: string; genre: string | null; difficulty: string | null; duration: string | null }>> {
  const result = await query(
    `SELECT id, title, genre, difficulty, duration
       FROM cases
      WHERE COALESCE(publication_status, 'published') = 'published'
        AND NOT (id = ANY($1::uuid[]))
      ORDER BY title ASC
      LIMIT $2`,
    [[...excludeCaseIds], Math.max(1, Math.min(6, limit))],
  );
  return result.rows.map((r: any) => ({
    id: String(r.id),
    title: String(r.title ?? ''),
    genre: r.genre === null || r.genre === undefined ? null : String(r.genre),
    difficulty: r.difficulty === null || r.difficulty === undefined ? null : String(r.difficulty),
    duration: r.duration === null || r.duration === undefined ? null : String(r.duration),
  }));
}
