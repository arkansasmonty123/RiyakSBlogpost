import { describe, expect, it } from 'vitest';
import { checkDraftCitations } from '@/domain/guards';
import { createInitialSave } from '@/domain/seed';

describe('citation guardrails', () => {
  it('allows draft without citation-like references', () => {
    const save = createInitialSave();
    const result = checkDraftCitations('Issue: what happened?\nFacts: unknown.', save.legalSources);
    expect(result.ok).toBe(true);
    expect(result.blocked).toHaveLength(0);
  });

  it('blocks unverified placeholder statute references', () => {
    const save = createInitialSave();
    const result = checkDraftCitations('As per BNS (placeholder - verify exact provision before use), accused is liable.', save.legalSources);
    expect(result.ok).toBe(false);
    expect(result.blocked.some((b) => b.toLowerCase().includes('unverified/placeholder'))).toBe(true);
  });

  it('blocks fabricated specific section citation', () => {
    const save = createInitialSave();
    const result = checkDraftCitations('The act falls under Section 101 of BNS.', save.legalSources);
    expect(result.ok).toBe(false);
    expect(result.blocked.some((b) => b.includes('Section 101'))).toBe(true);
  });

  it('blocks fabricated case citation', () => {
    const save = createInitialSave();
    const result = checkDraftCitations('In Foo v. Bar, the court held...', save.legalSources);
    expect(result.ok).toBe(false);
    expect(result.blocked.some((b) => b.includes('Foo v. Bar'))).toBe(true);
  });
});
