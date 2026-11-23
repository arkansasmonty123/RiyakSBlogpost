import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDb, getDb } from './database';
import {
  deleteSaveSlot,
  getSaveSlot,
  listAuditEvents,
  listSaveSlots,
  SaveConflictError,
  upsertSaveSlot,
} from './repository';

const tempDirs: string[] = [];

function makeDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'the-bar-db-'));
  tempDirs.push(dir);
  closeDb();
  return getDb({ filename: path.join(dir, 'test.sqlite') });
}

afterEach(() => {
  closeDb();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('sqlite save repository (ADR-001 infra start)', () => {
  it('upserts, reads, lists, and deletes save slots transactionally', () => {
    const db = makeDb();
    const payload = {
      version: 2,
      savedAt: '2026-11-23T00:00:00.000Z',
      caseFile: { id: 'c1', canonicalTruth: { secret: true } },
    };
    const saved = upsertSaveSlot(db, 'slot-1', payload);

    expect(saved.slotId).toBe('slot-1');
    expect(saved.schemaVersion).toBe(2);
    expect((saved.payload as any).caseFile.canonicalTruth).toBeUndefined();

    const loaded = getSaveSlot(db, 'slot-1');
    expect(loaded?.slotId).toBe('slot-1');
    expect(listSaveSlots(db)).toHaveLength(1);

    expect(deleteSaveSlot(db, 'slot-1')).toBe(true);
    expect(getSaveSlot(db, 'slot-1')).toBeNull();
  });

  it('records audit events for save operations', () => {
    const db = makeDb();
    upsertSaveSlot(db, 'slot-a', { version: 2, savedAt: '2026-11-23T00:00:00.000Z' });
    deleteSaveSlot(db, 'slot-a');
    const events = listAuditEvents(db, 'slot-a');
    expect(events.some((e) => e.eventType === 'save.upsert')).toBe(true);
    expect(events.some((e) => e.eventType === 'save.delete')).toBe(true);
  });

  it('rejects stale writes when expectedSavedAt does not match (concurrency guard)', () => {
    const db = makeDb();
    upsertSaveSlot(db, 'slot-c', { version: 2, savedAt: '2026-11-23T00:00:00.000Z' });
    expect(() =>
      upsertSaveSlot(db, 'slot-c', { version: 2, savedAt: '2026-11-23T00:00:01.000Z' }, { expectedSavedAt: 'stale' }),
    ).toThrow(SaveConflictError);
    const loaded = getSaveSlot(db, 'slot-c');
    expect(loaded?.savedAt).toBe('2026-11-23T00:00:00.000Z');
  });

  it('persists across restart/reopen and keeps canonicalTruth stripped', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'the-bar-db-restart-'));
    tempDirs.push(dir);
    const filename = path.join(dir, 'restart.sqlite');
    closeDb();
    const db1 = getDb({ filename });
    upsertSaveSlot(db1, 'slot-r', {
      version: 2,
      savedAt: '2026-11-23T00:00:00.000Z',
      player: { name: 'Persisted' },
      caseFile: { id: 'c1', canonicalTruth: { secret: true } },
    });
    closeDb();
    const db2 = getDb({ filename });
    const loaded = getSaveSlot(db2, 'slot-r');
    expect((loaded?.payload as any).player.name).toBe('Persisted');
    expect((loaded?.payload as any).caseFile.canonicalTruth).toBeUndefined();
  });
});
