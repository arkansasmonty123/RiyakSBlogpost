import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export interface DbOptions {
  filename?: string;
}

const DEFAULT_DB_DIR = path.join(process.cwd(), 'data');
const DEFAULT_DB_PATH = path.join(DEFAULT_DB_DIR, 'the-bar.sqlite');

let db: DatabaseSync | null = null;

export function getDb(options: DbOptions = {}): DatabaseSync {
  if (db) return db;
  const filename = options.filename ?? process.env.THE_BAR_DB_PATH ?? DEFAULT_DB_PATH;
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}

export function closeDb(): void {
  if (!db) return;
  db.close();
  db = null;
}

export function migrate(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS save_slots (
      slot_id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      saved_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_id TEXT,
      event_type TEXT NOT NULL,
      day INTEGER,
      actor TEXT,
      detail_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_events_slot_id ON audit_events(slot_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
  `);

  const insertMigration = database.prepare('INSERT OR IGNORE INTO migrations (name) VALUES (?)');
  insertMigration.run('001_initial_schema');
}

export function withTransaction<T>(database: DatabaseSync, fn: () => T): T {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
