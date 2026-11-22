import { describe, expect, it } from 'vitest';
import { AUDIT_EVENT_KINDS, MAX_AUDIT_EVENTS, MAX_AUDIT_SUMMARY_CHARS, recordAudit, sanitizeAuditLog } from '@/domain/audit';
import { assertNoCanonicalTruthLeak } from '@/domain/caseAccess';
import {
  challengeEvidenceAdmissibility,
  recordCustodyObservation,
  submitFinalBrief,
  submitSeniorReview,
} from '@/domain/casework';
import { applyDialogueChoice } from '@/domain/dialogue';
import { addEvidenceNote, discoverEvidenceItem, reviewEvidence } from '@/domain/evidence';
import { advanceClock, reviewAssignment } from '@/domain/progression';
import { createInitialSave } from '@/domain/seed';
import { LEGACY_KEY, loadSave, persistSave, SAVE_KEY } from '@/storage/save';
import type { StorageLike } from '@/storage/save';
import type { AuditEventType, SaveGame } from '@/domain/types';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

const GOOD_SUMMARY =
  'Issue: what happened outside the canteen. I reviewed the medical report, the partial clip and the witness note, attached the verified educational summary, and kept known facts separate from claims and disputed points.';

function advanceToDay(save: SaveGame, day: number): void {
  while (save.clock.day < day) advanceClock(save);
}

function discoverAndReview(save: SaveGame, id: string): void {
  if (!discoverEvidenceItem(save, id)) throw new Error(`missing evidence ${id}`);
  reviewEvidence(save, id);
}

function addSourceNote(save: SaveGame): void {
  save.notebook.unshift({
    id: 'n-source',
    day: save.clock.day,
    kind: 'research',
    title: 'Source: verified educational summary',
    content: 'Verified educational summary on evidence handling.',
    sourceId: 'ls-4',
    source: 'Educational summary',
    verified: true,
  });
}

function readyForReview(): SaveGame {
  const save = createInitialSave();
  advanceToDay(save, 2);
  applyDialogueChoice(save, 'd-client-interview', 'ask-personal-observation');
  discoverAndReview(save, 'ev-1');
  addSourceNote(save);
  reviewAssignment(save, 'a1');
  advanceToDay(save, 3);
  discoverAndReview(save, 'ev-2');
  reviewAssignment(save, 'a2');
  advanceToDay(save, 5);
  discoverAndReview(save, 'ev-3');
  addEvidenceNote(save, 'ev-3', 'contradiction', 'The witness account does not address the gap in the clip.');
  reviewAssignment(save, 'a3');
  advanceToDay(save, 6);
  reviewAssignment(save, 'a4');
  advanceToDay(save, 7);
  recordCustodyObservation(save, 'ev-2', 'No sealing record on the export; gap noted.');
  reviewAssignment(save, 'a5');
  advanceToDay(save, 8);
  challengeEvidenceAdmissibility(save, 'ev-3', 'provenance', 'Origin and integrity of the note are not documented.');
  reviewAssignment(save, 'a6');
  advanceToDay(save, 9);
  return save;
}

describe('bounded append-only audit log', () => {
  it('starts empty on a fresh save and appends newest-first with in-game time', () => {
    const save = createInitialSave();
    expect(save.auditLog).toEqual([]);
    save.clock = { day: 4, slot: 'evening' };

    const first = recordAudit(save, 'save', '  Saved progress locally  ');
    const second = recordAudit(save, 'evidence-reviewed', 'Reviewed Medical report summary');

    expect(save.auditLog.map((e) => e.type)).toEqual(['evidence-reviewed', 'save']);
    expect(second.id).not.toBe(first.id);
    expect(second.day).toBe(4);
    expect(second.slot).toBe('evening');
    expect(first.summary).toBe('Saved progress locally');
  });

  it('caps summary length and total size without rewriting earlier entries', () => {
    const save = createInitialSave();
    const first = recordAudit(save, 'save', 'first');
    const second = recordAudit(save, 'save', 'second');
    expect(save.auditLog[1]).toBe(first); // append-only: the earlier event is untouched
    for (let i = 0; i < MAX_AUDIT_EVENTS + 5; i += 1) {
      recordAudit(save, 'save', 'x'.repeat(MAX_AUDIT_SUMMARY_CHARS + 20));
    }
    expect(save.auditLog).toHaveLength(MAX_AUDIT_EVENTS);
    expect(save.auditLog).not.toContain(first); // only the oldest entries are dropped over the cap
    expect(save.auditLog[0].summary).toHaveLength(MAX_AUDIT_SUMMARY_CHARS);
    expect(second.summary).toBe('second');
  });

  it('rebuilds stored events from known fields only and drops unsafe or malformed entries', () => {
    const valid = {
      id: 'audit-old', day: 3, slot: 'afternoon', type: 'evidence-reviewed',
      summary: '  Reviewed Canteen CCTV clip  ',
      canonicalTruth: { responsibleParties: ['x'] }, // unknown field must be dropped
    };
    const events = [
      valid,
      null,
      { type: 'not-a-kind', day: 1, slot: 'morning', summary: 'bad kind' },
      { type: 'save', day: 1, slot: 'night', summary: 'bad slot' },
      { type: 'save', day: 0, slot: 'morning', summary: 'bad day' },
      { type: 'save', day: 1, slot: 'morning', summary: 42 },
      { type: 'save', day: 1, slot: 'morning', summary: 'canonicalTruth leak' },
      { type: 'save', day: 2, slot: 'evening', summary: 'kept' },
    ];
    const clean = sanitizeAuditLog(events);
    expect(clean).toHaveLength(2);
    expect(clean[0]).toEqual({
      id: 'audit-old', day: 3, slot: 'afternoon', type: 'evidence-reviewed',
      summary: 'Reviewed Canteen CCTV clip',
    });
    expect(JSON.stringify(clean)).not.toContain('canonicalTruth');
    expect(sanitizeAuditLog('not an array')).toEqual([]);
    expect(sanitizeAuditLog(Array.from({ length: MAX_AUDIT_EVENTS + 4 }, () => valid))).toHaveLength(MAX_AUDIT_EVENTS);
  });

  it('records evidence, custody, challenge and assignment-review actions', () => {
    const save = createInitialSave();
    discoverAndReview(save, 'ev-2');
    recordCustodyObservation(save, 'ev-2', 'No documented seal on the export; gap noted.');
    discoverAndReview(save, 'ev-3');
    challengeEvidenceAdmissibility(save, 'ev-3', 'custody', 'Custody record for the note is missing.');

    const types = save.auditLog.map((e) => e.type);
    expect(types).toContain('evidence-discovered');
    expect(types).toContain('evidence-reviewed');
    expect(types).toContain('custody-recorded');
    expect(types).toContain('evidence-challenged');
    expect(save.auditLog.some((e) => e.type === 'assignment-reviewed')).toBe(false);
    // A failed mutation must not add an event.
    const before = save.auditLog.length;
    discoverEvidenceItem(save, 'ev-2'); // already discovered
    expect(save.auditLog).toHaveLength(before);
  });

  it('logs senior-review submissions and the final brief on the full chapter path', () => {
    const save = readyForReview();
    expect(save.auditLog.filter((e) => e.type === 'assignment-reviewed')).toHaveLength(6);
    expect(save.auditLog.some((e) => e.type === 'senior-review-submitted')).toBe(false);

    expect(submitSeniorReview(save, 'a7', GOOD_SUMMARY).status).toBe('needs_revision');
    expect(submitSeniorReview(save, 'a7', `${GOOD_SUMMARY} Revised to address the notes.`).status).toBe('accepted');
    advanceToDay(save, 10);
    expect(submitFinalBrief(save, GOOD_SUMMARY).ok).toBe(true);

    const types = save.auditLog.map((e) => e.type);
    expect(types).toContain('senior-review-submitted');
    expect(types.filter((t) => t === 'senior-review-submitted')).toHaveLength(2);
    expect(types.filter((t) => t === 'final-brief')).toHaveLength(1);
    expect(types[0]).toBe('final-brief');

    // Player-safe: summaries never carry canonical truth or authenticity findings.
    expect(() => assertNoCanonicalTruthLeak(save.auditLog)).not.toThrow();
    const json = JSON.stringify(save.auditLog).toLowerCase();
    expect(json).not.toContain('evidenceauthenticity');
    expect(json).not.toContain('responsibleparties');
  });

  it('migrates old saves to an empty log and sanitizes/caps persisted events', () => {
    const v1 = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    v1.version = 1;
    delete v1.auditLog;
    const loadedOld = loadSave(memoryStorage({ [LEGACY_KEY]: JSON.stringify(v1) }));
    expect(loadedOld.version).toBe(2);
    expect(loadedOld.auditLog).toEqual([]);

    const save = createInitialSave();
    save.auditLog = [
      { id: 'x', day: 1, slot: 'morning', type: 'bad', summary: 'invalid', extra: true } as never,
      ...Array.from({ length: MAX_AUDIT_EVENTS + 3 }, (_, i) => ({
        id: `e${i}`, day: 2, slot: 'morning' as const, type: 'save' as AuditEventType,
        summary: `Saved ${i}`,
      })),
    ];
    const storage = memoryStorage();
    persistSave(save, storage);
    const persisted = JSON.parse(storage.data[SAVE_KEY]) as { auditLog: Array<{ type: string }> };
    expect(persisted.auditLog).toHaveLength(MAX_AUDIT_EVENTS);
    expect(persisted.auditLog.every((e) => AUDIT_EVENT_KINDS.includes(e.type as AuditEventType))).toBe(true);
    const reloaded = loadSave(storage);
    expect(reloaded.auditLog).toHaveLength(MAX_AUDIT_EVENTS);
    expect(JSON.stringify(reloaded.auditLog)).not.toContain('invalid');
  });
});
