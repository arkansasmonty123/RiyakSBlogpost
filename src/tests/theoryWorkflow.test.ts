import { describe, expect, it } from 'vitest';
import { createInitialSave } from '@/domain/seed';
import { discoverEvidenceItem, reviewEvidence } from '@/domain/evidence';
import {
  addTheoryClaim,
  getTheorySupport,
  linkReviewedEvidence,
  setClaimEvidenceLinks,
  unlinkReviewedEvidence,
} from '@/domain/theory';
import { assertNoCanonicalTruthLeak } from '@/domain/caseAccess';
import type { SaveGame } from '@/domain/types';

function withEvidence(): SaveGame {
  const save = createInitialSave();
  discoverEvidenceItem(save, 'ev-1');
  reviewEvidence(save, 'ev-1');
  discoverEvidenceItem(save, 'ev-2'); // discovered, not reviewed — not linkable
  return save;
}

describe('theory ↔ reviewed evidence workflow', () => {
  it('reports a claim as unsupported until reviewed evidence is linked', () => {
    const save = withEvidence();
    const added = addTheoryClaim(save, 'The report records a minor injury.', 'known', []);
    expect(added.ok).toBe(true);
    const claimId = added.claim!.id;

    expect(getTheorySupport(save)[0]).toMatchObject({
      claimId,
      reviewedEvidenceIds: [],
      hasReviewedEvidence: false,
    });

    expect(linkReviewedEvidence(save, claimId, ['ev-1']).ok).toBe(true);
    expect(getTheorySupport(save)[0]).toMatchObject({
      reviewedEvidenceIds: ['ev-1'],
      unavailableEvidenceIds: [],
      hasReviewedEvidence: true,
    });

    expect(unlinkReviewedEvidence(save, claimId, 'ev-1').ok).toBe(true);
    expect(getTheorySupport(save)[0].hasReviewedEvidence).toBe(false);
  });

  it('rejects unreviewed or unknown links and keeps stored links deduplicated', () => {
    const save = withEvidence();
    const added = addTheoryClaim(save, 'Timing is disputed.', 'disputed', ['ev-1']);
    const claimId = added.claim!.id;

    expect(linkReviewedEvidence(save, claimId, ['ev-2']).ok).toBe(false);
    expect(linkReviewedEvidence(save, claimId, ['ev-missing']).ok).toBe(false);
    expect(setClaimEvidenceLinks(save, claimId, ['ev-1', 'ev-missing']).ok).toBe(false);
    expect(save.caseTheory.claims[0].evidenceIds).toEqual(['ev-1']);

    expect(setClaimEvidenceLinks(save, claimId, ['ev-1', 'ev-1']).ok).toBe(true);
    expect(save.caseTheory.claims[0].evidenceIds).toEqual(['ev-1']);
    expect(unlinkReviewedEvidence(save, claimId, 'ev-2').ok).toBe(false);
  });

  it('flags stale links and never records fault assertions or canonical truth', () => {
    const save = withEvidence();
    save.caseTheory.claims.push({
      id: 'stale', day: save.clock.day, text: 'The clip may be incomplete.',
      status: 'claimed', evidenceIds: ['ev-2'],
    });

    const support = getTheorySupport(save);
    expect(support[0]).toMatchObject({
      unavailableEvidenceIds: ['ev-2'],
      hasReviewedEvidence: false,
    });
    expect(addTheoryClaim(save, 'The accused is at fault.', 'known', []).ok).toBe(false);

    const json = JSON.stringify(support).toLowerCase();
    expect(() => assertNoCanonicalTruthLeak(support)).not.toThrow();
    for (const marker of ['canonicaltruth', 'evidenceauthenticity', 'hiddenmotives', 'guilty', 'at fault']) {
      expect(json).not.toContain(marker);
    }
  });
});
