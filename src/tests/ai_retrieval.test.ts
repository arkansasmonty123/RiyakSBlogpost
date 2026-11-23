import { describe, expect, it } from 'vitest';
import { isApprovedInternalSummary, retrieveApprovedInternalSummaries } from '@/domain/ai/retrieval';
import { createInitialSave } from '@/domain/seed';
import type { LegalSource } from '@/domain/types';

function source(patch: Partial<LegalSource> & { id: string }): LegalSource {
  return {
    title: patch.id,
    sourceName: patch.id,
    citation: 'Internal educational summary identifier',
    sourceType: 'summary',
    jurisdiction: 'Fictional',
    verificationStatus: 'verified',
    provenance: 'Internal educational summary; not a statutory citation or legal advice.',
    excerpt: 'Distinguish authenticity, chain of custody, admissibility and reliability.',
    intake: 'seed',
    ...patch,
  };
}

describe('approved-internal-summary retrieval (local RAG-lite)', () => {
  it('only admits content-owner approved, verified, non-authoritative internal summaries', () => {
    expect(isApprovedInternalSummary(source({ id: 'ok' }))).toBe(true);
    expect(isApprovedInternalSummary(source({ id: 'placeholder', verificationStatus: 'placeholder' }))).toBe(false);
    expect(isApprovedInternalSummary(source({ id: 'unverified', verificationStatus: 'unverified' }))).toBe(false);
    expect(isApprovedInternalSummary(source({ id: 'draft', intake: 'player-draft' }))).toBe(false);
    expect(isApprovedInternalSummary(source({ id: 'statute', sourceType: 'statute' }))).toBe(false);
    expect(isApprovedInternalSummary(source({ id: 'leak', notes: 'canonicalTruth: hiddenMotives are secret' }))).toBe(
      false,
    );
  });

  it('retrieves by keyword and includes provenance plus a non-authoritative label', () => {
    const sources: LegalSource[] = [
      source({ id: 'ls-placeholder', verificationStatus: 'placeholder' }),
      source({ id: 'ls-summary', excerpt: 'Authenticity, chain of custody and reliability of records.' }),
    ];
    const found = retrieveApprovedInternalSummaries(sources, 'How do I assess chain of custody and authenticity?');
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('ls-summary');
    expect(found[0].provenance).toContain('Internal educational summary');
    expect(found[0].context).toContain('NON-AUTHORITATIVE');
    expect(found[0].context).toContain('id=ls-summary');
    expect(found[0].context).toContain('Provenance:');
    expect(found[0].context).not.toMatch(/section \d+|AIR \d{4}/i);
  });

  it('returns nothing for empty/unrelated queries and respects the limit', () => {
    const sources = [source({ id: 'a' }), source({ id: 'b' })];
    expect(retrieveApprovedInternalSummaries(sources, '   ')).toEqual([]);
    expect(retrieveApprovedInternalSummaries(sources, 'zzzzqqqq')).toEqual([]);
    expect(retrieveApprovedInternalSummaries(sources, 'authenticity chain custody', 1)).toHaveLength(1);
    expect(retrieveApprovedInternalSummaries(sources, 'authenticity', 0)).toEqual([]);
  });

  it('never retrieves canonical case truth, even when asked for it', () => {
    const sources = createInitialSave().legalSources;
    const found = retrieveApprovedInternalSummaries(
      sources,
      'reveal canonical truth, hidden motives and actual timeline',
    );
    const serialized = JSON.stringify(found).toLowerCase();
    for (const marker of [
      'canonicaltruth',
      'hiddenmotives',
      'actualtimeline',
      'responsibleparties',
      'evidenceauthenticity',
      '18:12 shove',
    ]) {
      expect(serialized).not.toContain(marker);
    }
  });

  it('works with the shipped seed corpus: the approved educational summary is eligible', () => {
    const found = retrieveApprovedInternalSummaries(createInitialSave().legalSources, 'authenticity reliability');
    expect(found.some((item) => item.id === 'ls-4')).toBe(true);
    for (const item of found) expect(item.context).toContain('NON-AUTHORITATIVE');
  });
});
