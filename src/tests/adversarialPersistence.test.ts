import { describe, expect, it } from 'vitest';
import { createInitialSave } from '@/domain/seed';
import { hydrateSave, toPersistedSave } from '@/storage/save';
import { isValidSlotId, normalizeSlotId } from '@/storage/slotId';

describe('adversarial persistence hardening', () => {
  it('hydrateSave fails closed for invalid versions and non-objects', () => {
    for (const bad of [null, undefined, 0, '', 'save', [], { version: 3 }, { version: 0 }, { noVersion: true }]) {
      const save = hydrateSave(bad);
      expect(save.version).toBe(2);
      expect(save.caseFile.canonicalTruth.actualEvents.length).toBeGreaterThan(0);
    }
  });

  it('hydrateSave never trusts stored canonical truth (including nested tampering)', () => {
    const base = createInitialSave();
    const tampered = {
      ...base,
      caseFile: {
        ...base.caseFile,
        canonicalTruth: {
          actualEvents: ['TAMPERED'],
          hiddenMotives: ['TAMPERED'],
          evidenceAuthenticity: { 'ev-1': 'forged' },
        },
      },
    };
    const loaded = hydrateSave(tampered);
    expect(loaded.caseFile.canonicalTruth.actualEvents).not.toContain('TAMPERED');
    expect(loaded.caseFile.canonicalTruth.hiddenMotives).not.toContain('TAMPERED');
    expect(loaded.caseFile.canonicalTruth.evidenceAuthenticity['ev-1']).not.toBe('forged');
  });

  it('toPersistedSave never includes canonical truth or internal truth markers', () => {
    const save = createInitialSave();
    (save.caseFile as any).canonicalTruth = { actualEvents: ['SECRET'] };
    const persisted = toPersistedSave(save);
    const json = JSON.stringify(persisted).toLowerCase();
    expect(json).not.toContain('canonicaltruth');
    expect(json).not.toContain('actualevents');
    expect(json).not.toContain('hiddenmotives');
    expect(json).not.toContain('evidenceauthenticity');
    expect(json).not.toContain('secret');
  });

  it('hydrateSave ignores prototype pollution keys', () => {
    const payload = JSON.parse(
      '{"version":2,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}',
    );
    const save = hydrateSave(payload);
    expect(({} as any).polluted).toBeUndefined();
    expect(save.version).toBe(2);
  });

  it('hydrateSave sanitizes malformed caseTheory/audit/dialogue fields', () => {
    const save = hydrateSave({
      version: 2,
      caseTheory: {
        claims: [
          { id: 'ok', text: 'Claim', day: 1, status: 'known', evidenceIds: ['e1'] },
          { id: 1, text: 'bad', day: '1', status: 'nope', evidenceIds: 'x' },
          null,
        ],
      },
      auditLog: [{ id: 'a', day: 1, time: '10:00', action: 'save', detail: 'ok' }, { bad: true }, 'x'],
      usedDialogueSceneIds: ['scene-a', 1, null, 'scene-b'],
    });
    expect(save.caseTheory.claims).toHaveLength(1);
    expect(save.caseTheory.claims[0].id).toBe('ok');
    expect(save.auditLog.every((e) => typeof e.id === 'string')).toBe(true);
    expect(save.usedDialogueSceneIds).toEqual(['scene-a', 'scene-b']);
  });

  it('slotId normalization rejects traversal/encoded/overlong inputs', () => {
    const bad = ['', ' ', '../x', 'a/b', 'a\\b', 'a%2F', 'a.b', 'a:b', 'a\0b', 'x'.repeat(65), '🔥'];
    for (const id of bad) {
      expect(isValidSlotId(id)).toBe(false);
      expect(normalizeSlotId(id)).toBe('default');
    }
    expect(isValidSlotId('case_01-A')).toBe(true);
    expect(normalizeSlotId('case_01-A')).toBe('case_01-A');
  });
});
