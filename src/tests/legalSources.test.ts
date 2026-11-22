import { describe, expect, it } from 'vitest';
import {
  canCiteAsAuthoritative,
  intakeSource,
  looksLikeSpecificCitation,
  markSourceVerified,
  validateSourceProvenance,
} from '@/domain/legalSources';
import type { SourceDraftInput } from '@/domain/legalSources';
import { checkDraftCitations } from '@/domain/guards';
import { createInitialSave } from '@/domain/seed';
import type { LegalSource } from '@/domain/types';

const VALID_DRAFT: SourceDraftInput = {
  title: 'Library notebook reference',
  sourceName: 'Uncertain library text',
  citation: 'Notebook ref 12 (no provision verified)',
  sourceType: 'commentary',
  jurisdiction: 'India',
  provenance: 'Copied from your own notebook; exact text not yet checked.',
};

function makeSource(overrides: Partial<LegalSource> = {}): LegalSource {
  return {
    id: 't-1',
    title: 'Test source',
    sourceName: 'Test source official name',
    citation: 'Test identifier',
    sourceType: 'summary',
    jurisdiction: 'Fictional',
    verificationStatus: 'verified',
    provenance: 'Internal note describing origin.',
    ...overrides,
  };
}

describe('provenance validation', () => {
  it('requires a citation/identifier and a traceable provenance note or URL', () => {
    expect(validateSourceProvenance(makeSource({ citation: '   ' })).ok).toBe(false);
    const noTrace = makeSource({ provenance: '  ', sourceUrl: undefined });
    expect(validateSourceProvenance(noTrace).ok).toBe(false);
    expect(canCiteAsAuthoritative(noTrace)).toBe(false);
    expect(validateSourceProvenance(makeSource({ provenance: '', sourceUrl: 'https://example.invalid/official' })).ok).toBe(true);
  });

  it('requires verified status in addition to provenance before a source is authoritative', () => {
    expect(canCiteAsAuthoritative(makeSource())).toBe(true);
    expect(canCiteAsAuthoritative(makeSource({ verificationStatus: 'unverified' }))).toBe(false);
    expect(canCiteAsAuthoritative(makeSource({ verificationStatus: 'placeholder' }))).toBe(false);
  });

  it('never lets a placeholder-labeled record become authoritative', () => {
    const forged = makeSource({ citation: 'BNS (placeholder - not checked)', verificationStatus: 'verified' });
    expect(validateSourceProvenance(forged).ok).toBe(false);
    expect(canCiteAsAuthoritative(forged)).toBe(false);
  });

  it('requires an official URL for a specific-looking citation before it can be verified', () => {
    const specific = makeSource({ citation: 'Section 302 IPC' });
    expect(looksLikeSpecificCitation(specific.citation)).toBe(true);
    expect(validateSourceProvenance(specific).ok).toBe(false);
    expect(canCiteAsAuthoritative(specific)).toBe(false);
    const withUrl = makeSource({ citation: 'Section 302 IPC', sourceUrl: 'https://example.invalid/official-text' });
    expect(validateSourceProvenance(withUrl).ok).toBe(true);
    expect(canCiteAsAuthoritative(withUrl)).toBe(true);
  });

  it('keeps the seed free of verified statutory or judgment citations', () => {
    const sources = createInitialSave().legalSources;
    for (const s of sources) {
      expect(looksLikeSpecificCitation(s.citation)).toBe(false);
      if (s.sourceType === 'statute' || s.sourceType === 'judgment') {
        expect(s.verificationStatus).toBe('placeholder');
        expect(canCiteAsAuthoritative(s)).toBe(false);
      }
    }
    expect(sources.filter(canCiteAsAuthoritative).map((s) => s.id)).toEqual(['ls-4']);
  });
});

describe('Source Intake (player draft ingestion)', () => {
  it('defaults a valid draft to unverified and never to verified', () => {
    const result = intakeSource(VALID_DRAFT, 'ls-draft-1');
    expect(result.ok).toBe(true);
    expect(result.source?.verificationStatus).toBe('unverified');
    expect(result.source?.intake).toBe('player-draft');
    expect(result.source?.sourceName).toBe(VALID_DRAFT.sourceName);
    expect(result.source?.provenance).toBe(VALID_DRAFT.provenance);
    expect(canCiteAsAuthoritative(result.source!)).toBe(false);
    expect(result.warnings.join(' ')).toMatch(/unverified/i);
  });

  it('forces a placeholder when the citation looks like a specific provision or judgment', () => {
    const section = intakeSource({ ...VALID_DRAFT, citation: 'Section 302 IPC' }, 'ls-draft-2');
    expect(section.ok).toBe(true);
    expect(section.source?.verificationStatus).toBe('placeholder');
    expect(canCiteAsAuthoritative(section.source!)).toBe(false);
    expect(section.warnings.join(' ')).toMatch(/placeholder/i);

    const judgment = intakeSource({ ...VALID_DRAFT, citation: 'State v. Sharma' }, 'ls-draft-3');
    expect(judgment.source?.verificationStatus).toBe('placeholder');
  });

  it('honours an explicit placeholder request but still never allows verified', () => {
    const placeholder = intakeSource({ ...VALID_DRAFT, requestPlaceholder: true }, 'ls-draft-4');
    expect(placeholder.source?.verificationStatus).toBe('placeholder');
    const rejected = intakeSource({ ...VALID_DRAFT, requestedStatus: 'verified' }, 'ls-draft-5');
    expect(rejected.ok).toBe(false);
    expect(rejected.reason).toMatch(/cannot create a verified source/i);
    expect(rejected.source).toBeUndefined();
  });

  it('blocks empty required fields, invalid enums and malformed effective dates', () => {
    const cases: Array<[string, Partial<SourceDraftInput>]> = [
      ['title', { title: '   ' }],
      ['sourceName', { sourceName: '' }],
      ['citation', { citation: '' }],
      ['provenance', { provenance: '' }],
      ['sourceType', { sourceType: 'fiction' }],
      ['jurisdiction', { jurisdiction: 'Mars' }],
      ['effectiveDate', { effectiveDate: '01-01-2024' }],
    ];
    for (const [, patch] of cases) {
      const result = intakeSource({ ...VALID_DRAFT, ...patch }, 'ls-bad');
      expect(result.ok, JSON.stringify(patch)).toBe(false);
      expect(result.reason).toBeTruthy();
      expect(result.source).toBeUndefined();
    }
  });

  it('stores excerpts as non-authoritative and preserves optional provenance metadata', () => {
    const result = intakeSource({
      ...VALID_DRAFT,
      excerpt: 'My paraphrase of the topic.',
      sourceUrl: 'https://example.invalid/catalogue',
      effectiveDate: '2024-07-01',
      notes: 'Follow up with senior.',
    }, 'ls-draft-6');
    expect(result.ok).toBe(true);
    expect(result.source?.excerpt).toBe('My paraphrase of the topic.');
    expect(result.source?.sourceUrl).toBe('https://example.invalid/catalogue');
    expect(result.source?.effectiveDate).toBe('2024-07-01');
    expect(canCiteAsAuthoritative(result.source!)).toBe(false);
  });
});

describe('human verification step (not part of player intake)', () => {
  it('requires a named reviewer and traceable provenance', () => {
    const draft = intakeSource(VALID_DRAFT, 'ls-verify-1').source!;
    expect(markSourceVerified(draft, '   ').ok).toBe(false);
    const noTrace = { ...draft, provenance: '', sourceUrl: undefined };
    expect(markSourceVerified(noTrace, 'Legal content owner').ok).toBe(false);
  });

  it('never promotes a placeholder and records reviewer/date on success', () => {
    const placeholder = intakeSource({ ...VALID_DRAFT, citation: 'Section 302 IPC' }, 'ls-verify-2').source!;
    expect(markSourceVerified(placeholder, 'Legal content owner', '2026-11-22').ok).toBe(false);

    const verified = markSourceVerified(
      intakeSource(VALID_DRAFT, 'ls-verify-3').source!,
      'Legal content owner',
      '2026-11-22',
    );
    expect(verified.ok).toBe(true);
    expect(verified.source?.verificationStatus).toBe('verified');
    expect(verified.source?.verifiedBy).toBe('Legal content owner');
    expect(verified.source?.verificationDate).toBe('2026-11-22');
    expect(canCiteAsAuthoritative(verified.source!)).toBe(true);
  });
});

describe('citation guard with provenance-aware sources', () => {
  it('ignores a forged verified flag when provenance is missing', () => {
    const forged = makeSource({
      id: 'forged',
      title: 'Forged record',
      verificationStatus: 'verified',
      provenance: '',
      sourceUrl: undefined,
      citation: 'Section 404',
    });
    const result = checkDraftCitations('Section 404 applies under the Forged record.', [
      ...createInitialSave().legalSources,
      forged,
    ]);
    expect(result.ok).toBe(false);
    expect(result.blocked.some((b) => b.includes('Unverified/placeholder source referenced'))).toBe(true);
  });

  it('still blocks specific citations that only exist in player-draft placeholders', () => {
    const draft = intakeSource({ ...VALID_DRAFT, citation: 'Section 302 IPC' }, 'ls-guard-1').source!;
    const result = checkDraftCitations('Section 302 IPC applies here.', [
      ...createInitialSave().legalSources,
      draft,
    ]);
    expect(result.ok).toBe(false);
    expect(result.blocked.length).toBeGreaterThan(0);
  });

  it('keeps blocking fabricated section and case citations with the seed registry', () => {
    const sources = createInitialSave().legalSources;
    expect(checkDraftCitations('Section 101 of BNS applies.', sources).ok).toBe(false);
    expect(checkDraftCitations('In Foo v. Bar the court held otherwise.', sources).ok).toBe(false);
    expect(checkDraftCitations('Issue: disputed facts. Educational summary noted.', sources).ok).toBe(true);
  });
});
