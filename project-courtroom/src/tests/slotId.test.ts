import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_SLOT } from '@/storage/gameRepository';
import { isValidSlotId, normalizeSlotId } from '@/storage/slotId';

describe('save slot ID validation (ADR-003 risk #5)', () => {
  it('accepts safe IDs of 1-64 chars', () => {
    for (const id of ['default', 'a', 'A', '0', 'slot-1', 'slot_1', '_', 'x'.repeat(64)]) {
      expect(isValidSlotId(id)).toBe(true);
      expect(normalizeSlotId(id)).toBe(id);
    }
  });

  it.each([
    ['empty', ''],
    ['slash', 'a/b'],
    ['leading slash', '/default'],
    ['space', 'a b'],
    ['newline', 'a\nb'],
    ['unicode', 'slöt'],
    ['emoji', 'slot-🎲'],
    ['too long', 'x'.repeat(65)],
    ['dot', 'a.b'],
    ['percent-encoded slash', 'a%2Fb'],
  ])('rejects %s and falls back to the default slot', (_label, id) => {
    expect(isValidSlotId(id)).toBe(false);
    expect(normalizeSlotId(id)).toBe(DEFAULT_GAME_SLOT);
  });

  it('treats non-string values as invalid', () => {
    for (const value of [undefined, null, 42, {}, []]) {
      expect(isValidSlotId(value)).toBe(false);
      expect(normalizeSlotId(value)).toBe(DEFAULT_GAME_SLOT);
    }
  });
});
