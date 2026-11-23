import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ChatMessage,
  DebriefReport,
  NegotiationEvent,
  NegotiationSession,
  Offer,
  SkillScoreRecord,
  SkillSummary,
} from '../../shared/types.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  status TEXT NOT NULL,
  agreement_status TEXT NOT NULL,
  agreement_offer_id TEXT,
  trust TEXT NOT NULL DEFAULT '[]',
  turn_count INTEGER NOT NULL DEFAULT 0,
  llm_calls INTEGER NOT NULL DEFAULT 0,
  state_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS preparations (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_id TEXT,
  sender_name TEXT NOT NULL,
  target TEXT NOT NULL,
  content TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, created_at);
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  proposer_type TEXT NOT NULL,
  proposer_id TEXT,
  proposer_name TEXT NOT NULL,
  parent_offer_id TEXT,
  terms TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  acceptances TEXT NOT NULL DEFAULT '[]',
  validated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  responded_at TEXT,
  responded_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_offers_session ON offers(session_id, created_at);
CREATE TABLE IF NOT EXISTS debriefs (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  report TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS skill_scores (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL,
  skill TEXT NOT NULL,
  rating TEXT NOT NULL,
  score INTEGER NOT NULL,
  evidence TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_skill_scores_skill ON skill_scores(skill, created_at);
`;

type Row = Record<string, unknown>;

function asString(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function ensureColumn(db: DatabaseSync, table: string, column: string, declaration: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Row[];
  if (!columns.some((c) => asString(c.name) === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration};`);
  }
}

/** Version 1 is the initial schema. Append entries for every future change. */
const MIGRATIONS: { version: number; sql: string; after?: (db: DatabaseSync) => void }[] = [
  {
    version: 1,
    sql: SCHEMA,
    // Also upgrades a legacy (user_version = 0) DB that already had tables but
    // not the session control columns.
    after: (db) => {
      ensureColumn(db, 'sessions', 'turn_count', 'INTEGER NOT NULL DEFAULT 0');
      ensureColumn(db, 'sessions', 'llm_calls', 'INTEGER NOT NULL DEFAULT 0');
      ensureColumn(db, 'sessions', 'state_version', 'INTEGER NOT NULL DEFAULT 1');
    },
  },
];

let database: DatabaseSync | null = null;

function dbPath(): string {
  return process.env.NEGOTIATION_DB_PATH ?? path.join(process.cwd(), 'data', 'negotiation.db');
}

function runMigrations(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version;').get() as Row | undefined;
  const current = Number(row?.user_version ?? 0);
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      migration.after?.(db);
      db.exec(`PRAGMA user_version = ${migration.version};`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

/** Applied migration version (0 means an un-versioned legacy DB). */
export function getSchemaVersion(): number {
  const row = getDb().prepare('PRAGMA user_version;').get() as Row | undefined;
  return Number(row?.user_version ?? 0);
}

export function getDb(): DatabaseSync {
  if (database) return database;
  const file = dbPath();
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') {
    try {
      db.exec('PRAGMA journal_mode = WAL;');
    } catch {
      // WAL is an optimization; ignore unsupported filesystems.
    }
  }
  runMigrations(db);
  database = db;
  return db;
}

/** Test-only: close and forget the singleton so a fresh path/schema can be used. */
export function closeDb(): void {
  database?.close();
  database = null;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function transaction(db: DatabaseSync, fn: () => void): void {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Persist a whole session snapshot. Ids are stable, so re-inserts are idempotent. */
export function saveSessionState(state: NegotiationSession): void {
  const db = getDb();
  transaction(db, () => {
    db.prepare(`
      INSERT INTO sessions (id, case_id, status, agreement_status, agreement_offer_id, trust,
        turn_count, llm_calls, state_version, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        case_id = excluded.case_id,
        status = excluded.status,
        agreement_status = excluded.agreement_status,
        agreement_offer_id = excluded.agreement_offer_id,
        trust = excluded.trust,
        turn_count = excluded.turn_count,
        llm_calls = excluded.llm_calls,
        state_version = excluded.state_version,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at
    `).run(
      state.id, state.caseId, state.status, state.agreementStatus, state.agreementOfferId,
      JSON.stringify(state.trust), state.turnCount ?? 0, state.llmCalls ?? 0,
      state.stateVersion ?? 1, state.createdAt, state.updatedAt, state.completedAt,
    );

    if (state.preparation) {
      db.prepare(`
        INSERT INTO preparations (session_id, payload) VALUES (?, ?)
        ON CONFLICT(session_id) DO UPDATE SET payload = excluded.payload
      `).run(state.id, JSON.stringify(state.preparation));
    }

    const insertMessage = db.prepare(`
      INSERT INTO messages (id, session_id, sender_type, sender_id, sender_name, target, content, meta, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        sender_type = excluded.sender_type, sender_id = excluded.sender_id,
        sender_name = excluded.sender_name, target = excluded.target,
        content = excluded.content, meta = excluded.meta, created_at = excluded.created_at
    `);
    for (const m of state.messages ?? []) {
      insertMessage.run(m.id, state.id, m.senderType, m.senderId, m.senderName, m.target, m.content,
        JSON.stringify(m.meta ?? {}), m.createdAt);
    }

    const insertEvent = db.prepare(`
      INSERT INTO events (id, session_id, type, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET type = excluded.type, payload = excluded.payload, created_at = excluded.created_at
    `);
    for (const e of state.events) {
      insertEvent.run(e.id, state.id, e.type, JSON.stringify(e.payload), e.createdAt);
    }

    const insertOffer = db.prepare(`
      INSERT INTO offers (id, session_id, proposer_type, proposer_id, proposer_name, parent_offer_id,
        terms, message, status, acceptances, validated, created_at, responded_at, responded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        proposer_type = excluded.proposer_type, proposer_id = excluded.proposer_id,
        proposer_name = excluded.proposer_name, parent_offer_id = excluded.parent_offer_id,
        terms = excluded.terms, message = excluded.message, status = excluded.status,
        acceptances = excluded.acceptances, validated = excluded.validated,
        responded_at = excluded.responded_at, responded_by = excluded.responded_by
    `);
    for (const o of state.offers) {
      insertOffer.run(o.id, state.id, o.proposerType, o.proposerId, o.proposerName, o.parentOfferId ?? null,
        JSON.stringify(o.terms), o.message, o.status, JSON.stringify(o.acceptances ?? []), o.validated ? 1 : 0,
        o.createdAt, o.respondedAt ?? null, o.respondedBy ?? null);
    }
  });
}

export function loadSessionState(id: string): NegotiationSession | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Row | undefined;
  if (!row) return undefined;

  const prepRow = db.prepare('SELECT payload FROM preparations WHERE session_id = ?').get(id) as Row | undefined;
  const messageRows = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(id) as Row[];
  const eventRows = db.prepare('SELECT * FROM events WHERE session_id = ? ORDER BY created_at ASC').all(id) as Row[];
  const offerRows = db.prepare('SELECT * FROM offers WHERE session_id = ? ORDER BY created_at ASC').all(id) as Row[];

  const messages: ChatMessage[] = messageRows.map((m) => ({
    id: asString(m.id),
    sessionId: asString(m.session_id),
    senderType: asString(m.sender_type) as ChatMessage['senderType'],
    senderId: nullableString(m.sender_id),
    senderName: asString(m.sender_name),
    target: asString(m.target),
    content: asString(m.content),
    createdAt: asString(m.created_at),
    meta: parseJson(m.meta, {}),
  }));

  const events: NegotiationEvent[] = eventRows.map((e) => ({
    id: asString(e.id),
    sessionId: asString(e.session_id),
    type: asString(e.type) as NegotiationEvent['type'],
    payload: parseJson(e.payload, {}),
    createdAt: asString(e.created_at),
  }));

  const offers: Offer[] = offerRows.map((o) => {
    const offer: Offer = {
      id: asString(o.id),
      sessionId: asString(o.session_id),
      proposerType: asString(o.proposer_type) as Offer['proposerType'],
      proposerId: nullableString(o.proposer_id),
      proposerName: asString(o.proposer_name),
      terms: parseJson(o.terms, []),
      message: asString(o.message),
      status: asString(o.status) as Offer['status'],
      createdAt: asString(o.created_at),
      acceptances: parseJson(o.acceptances, []),
      validated: Number(o.validated ?? 0) === 1,
    };
    if (o.parent_offer_id) offer.parentOfferId = asString(o.parent_offer_id);
    if (o.responded_at) offer.respondedAt = asString(o.responded_at);
    if (o.responded_by) offer.respondedBy = asString(o.responded_by);
    return offer;
  });

  return {
    id: asString(row.id),
    caseId: asString(row.case_id),
    status: asString(row.status) as NegotiationSession['status'],
    preparation: prepRow ? parseJson(prepRow.payload, null) : null,
    offers,
    trust: parseJson(row.trust, []),
    agreementStatus: asString(row.agreement_status) as NegotiationSession['agreementStatus'],
    agreementOfferId: nullableString(row.agreement_offer_id),
    turnCount: Number(row.turn_count ?? 0),
    llmCalls: Number(row.llm_calls ?? 0),
    stateVersion: Number(row.state_version ?? 1),
    events,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    completedAt: nullableString(row.completed_at),
    messages,
  };
}

export function sessionExists(id: string): boolean {
  return getDb().prepare('SELECT 1 FROM sessions WHERE id = ?').get(id) !== undefined;
}

export function saveDebrief(debrief: DebriefReport, skills: SkillScoreRecord[]): void {
  const db = getDb();
  transaction(db, () => {
    db.prepare(`
      INSERT INTO debriefs (session_id, report, created_at) VALUES (?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET report = excluded.report, created_at = excluded.created_at
    `).run(debrief.sessionId, JSON.stringify(debrief), new Date().toISOString());
    const insert = db.prepare(`
      INSERT INTO skill_scores (id, session_id, case_id, skill, rating, score, evidence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET rating = excluded.rating, score = excluded.score, evidence = excluded.evidence
    `);
    for (const s of skills) {
      insert.run(s.id, s.sessionId, s.caseId, s.skill, s.rating, s.score, s.evidence, s.createdAt);
    }
  });
}

export function getDebrief(sessionId: string): DebriefReport | undefined {
  const row = getDb().prepare('SELECT report FROM debriefs WHERE session_id = ?').get(sessionId) as Row | undefined;
  return row ? parseJson<DebriefReport | undefined>(row.report, undefined) : undefined;
}

export function getSkillSummaries(): SkillSummary[] {
  const rows = getDb().prepare('SELECT * FROM skill_scores ORDER BY created_at ASC').all() as Row[];
  const bySkill = new Map<string, SkillSummary>();
  for (const row of rows) {
    const skill = asString(row.skill);
    const summary: SkillSummary = {
      skill: skill as SkillSummary['skill'],
      sessions: (bySkill.get(skill)?.sessions ?? 0) + 1,
      lastRating: asString(row.rating) as SkillSummary['lastRating'],
      lastEvidence: asString(row.evidence),
      lastCaseId: asString(row.case_id),
      lastAssessedAt: asString(row.created_at),
    };
    bySkill.set(skill, summary);
  }
  return [...bySkill.values()];
}
