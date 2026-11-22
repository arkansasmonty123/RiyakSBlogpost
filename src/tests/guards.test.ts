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
    const result = checkDraftCitations(
      'As per BNS (placeholder - verify exact provision before use), accused is liable.',
      save.legalSources,
    );
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

  it('still blocks fabricated citations on the v2 save shape while allowing sourced prose', () => {
    const save = createInitialSave();
    expect(save.version).toBe(2);
    const fabricated = checkDraftCitations(
      'As per Section 302 of IPC and State v. Imaginary, the accused is guilty. BNSS applies.',
      save.legalSources,
    );
    expect(fabricated.ok).toBe(false);
    expect(fabricated.blocked.length).toBeGreaterThan(0);

    const sourced = checkDraftCitations(
      'Issue: what happened? Facts are disputed. The verified educational summary on authenticity and reliability is noted.',
      save.legalSources,
    );
    expect(sourced.ok).toBe(true);
  });
});
