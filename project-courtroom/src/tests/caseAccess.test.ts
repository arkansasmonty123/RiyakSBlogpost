import { describe, expect, it } from 'vitest';
import { createInitialSave } from '@/domain/seed';
import { assertNoCanonicalTruthLeak, toPlayerCaseView } from '@/domain/caseAccess';

describe('case truth separation', () => {
  it('player view does not expose canonical truth fields', () => {
    const save = createInitialSave();
    const view = toPlayerCaseView(save.caseFile);
    expect(() => assertNoCanonicalTruthLeak(view)).not.toThrow();
    expect((view as any).canonicalTruth).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain('hiddenMotives');
  });

  it('undiscovered evidence description is hidden', () => {
    const save = createInitialSave();
    const view = toPlayerCaseView(save.caseFile);
    expect(view.evidence.every((e) => e.description === 'Not yet discovered.')).toBe(true);
  });
});
