import type { DatabaseSync } from 'node:sqlite';
import { withTransaction } from './database';

export interface SaveSlotRecord {
  slotId: string;
  schemaVersion: number;
  savedAt: string;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEventRecord {
  id: number;
  slotId: string | null;
  eventType: string;
  day: number | null;
  actor: string | null;
  detail: unknown;
  createdAt: string;
}

function stripCanonicalTruth(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const obj = payload as Record<string, unknown>;
  const caseFile = obj.caseFile;
  if (!caseFile || typeof caseFile !== 'object' || Array.isArray(caseFile)) return obj;
  const safeCaseFile = { ...(caseFile as Record<string, unknown>) };
  delete safeCaseFile.canonicalTruth;
  return { ...obj, caseFile: safeCaseFile };
}

export class SaveConflictError extends Error {
  constructor(message = 'SAVE_CONFLICT') {
    super(message);
    this.name = 'SaveConflictError';
  }
}

export function upsertSaveSlot(
  db: DatabaseSync,
  slotId: string,
  payload: unknown,
  options?: { expectedSavedAt?: string },
): SaveSlotRecord {
  const safePayload = stripCanonicalTruth(payload);
  const obj = safePayload && typeof safePayload === 'object' ? (safePayload as Record<string, unknown>) : null;
  const savedAt = typeof obj?.savedAt === 'string' ? obj.savedAt : new Date().toISOString();
  const schemaVersion = typeof obj?.version === 'number' ? obj.version : 2;

  return withTransaction(db, () => {
    if (options?.expectedSavedAt) {
      const current = db.prepare('SELECT saved_at FROM save_slots WHERE slot_id = ?').get(slotId) as
        { saved_at: string } | undefined;
      if (current && current.saved_at !== options.expectedSavedAt) {
        throw new SaveConflictError();
      }
    }

    db.prepare(
      `
      INSERT INTO save_slots (slot_id, schema_version, saved_at, payload_json, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(slot_id) DO UPDATE SET
        schema_version = excluded.schema_version,
        saved_at = excluded.saved_at,
        payload_json = excluded.payload_json,
        updated_at = datetime('now')
    `,
    ).run(slotId, schemaVersion, savedAt, JSON.stringify(safePayload));

    db.prepare(`INSERT INTO audit_events (slot_id, event_type, day, detail_json) VALUES (?, ?, ?, ?)`).run(
      slotId,
      'save.upsert',
      null,
      JSON.stringify({ schemaVersion, savedAt }),
    );

    return getSaveSlot(db, slotId)!;
  });
}

export function getSaveSlot(db: DatabaseSync, slotId: string): SaveSlotRecord | null {
  const row = db
    .prepare(
      'SELECT slot_id, schema_version, saved_at, payload_json, created_at, updated_at FROM save_slots WHERE slot_id = ?',
    )
    .get(slotId) as
    | {
        slot_id: string;
        schema_version: number;
        saved_at: string;
        payload_json: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    slotId: row.slot_id,
    schemaVersion: row.schema_version,
    savedAt: row.saved_at,
    payload: JSON.parse(row.payload_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listSaveSlots(db: DatabaseSync): Array<Omit<SaveSlotRecord, 'payload'>> {
  const rows = db
    .prepare(
      'SELECT slot_id, schema_version, saved_at, created_at, updated_at FROM save_slots ORDER BY updated_at DESC',
    )
    .all() as Array<{
    slot_id: string;
    schema_version: number;
    saved_at: string;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((row) => ({
    slotId: row.slot_id,
    schemaVersion: row.schema_version,
    savedAt: row.saved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function deleteSaveSlot(db: DatabaseSync, slotId: string): boolean {
  return withTransaction(db, () => {
    const result = db.prepare('DELETE FROM save_slots WHERE slot_id = ?').run(slotId);
    db.prepare(`INSERT INTO audit_events (slot_id, event_type, detail_json) VALUES (?, ?, ?)`).run(
      slotId,
      'save.delete',
      JSON.stringify({ deleted: result.changes > 0 }),
    );
    return result.changes > 0;
  });
}

export function listAuditEvents(db: DatabaseSync, slotId?: string, limit = 100): AuditEventRecord[] {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const rows = (
    slotId
      ? db
          .prepare(
            'SELECT id, slot_id, event_type, day, actor, detail_json, created_at FROM audit_events WHERE slot_id = ? ORDER BY id DESC LIMIT ?',
          )
          .all(slotId, safeLimit)
      : db
          .prepare(
            'SELECT id, slot_id, event_type, day, actor, detail_json, created_at FROM audit_events ORDER BY id DESC LIMIT ?',
          )
          .all(safeLimit)
  ) as Array<{
    id: number;
    slot_id: string | null;
    event_type: string;
    day: number | null;
    actor: string | null;
    detail_json: string | null;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    slotId: row.slot_id,
    eventType: row.event_type,
    day: row.day,
    actor: row.actor,
    detail: row.detail_json ? JSON.parse(row.detail_json) : null,
    createdAt: row.created_at,
  }));
}
