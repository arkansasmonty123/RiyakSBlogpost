import { toPlayerCaseView } from './caseAccess';
import { getTheorySupport } from './theory';
import type { SaveGame } from './types';

/**
 * A player-legible synthesis of the material already on the player's own file: evidence-linked
 * contradiction/corroboration notes, evidence-linked theory claims and the player-facing open
 * questions. It is computed on demand from player-visible state only. Canonical truth — actual
 * events, timeline, responsibility, authenticity and hidden motives — is never read here, and
 * no legal citation is ever generated.
 */

export interface EvidenceLink {
  id: string;
  day: number;
  evidenceId: string;
  evidenceTitle: string;
  relation: 'contradiction' | 'corroboration';
  note: string;
}

export interface TheoryGrounding {
  claimId: string;
  claimText: string;
  status: string;
  reviewedEvidenceTitles: string[];
  hasReviewedEvidence: boolean;
}

export interface EvidenceSynthesis {
  contradictions: EvidenceLink[];
  corroborations: EvidenceLink[];
  /** Every evidence-linked note, in notebook order. */
  links: EvidenceLink[];
  theoryGrounding: TheoryGrounding[];
  groundedClaimsCount: number;
  totalClaims: number;
  /** The player-facing open-question list only — never the canonical ambiguity record. */
  openQuestions: string[];
  overview: string;
  ambiguityNote: string;
}

/** Plain pluralisation for deterministic, player-legible feedback sentences. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Build the synthesis from player-visible state only. Safe to call at any point. */
export function buildEvidenceSynthesis(save: SaveGame): EvidenceSynthesis {
  const view = toPlayerCaseView(save.caseFile);
  const titleById = new Map(view.evidence.map((e) => [e.id, e.title]));
  const titleFor = (id: string) => titleById.get(id) ?? id;

  const links: EvidenceLink[] = save.notebook
    .filter((n) => n.evidenceId && (n.relation === 'contradiction' || n.relation === 'corroboration'))
    .map((n) => ({
      id: n.id,
      day: n.day,
      evidenceId: n.evidenceId as string,
      evidenceTitle: titleFor(n.evidenceId as string),
      relation: n.relation as 'contradiction' | 'corroboration',
      note: n.content,
    }));
  const contradictions = links.filter((link) => link.relation === 'contradiction');
  const corroborations = links.filter((link) => link.relation === 'corroboration');

  const supportById = new Map(getTheorySupport(save).map((support) => [support.claimId, support]));
  const theoryGrounding: TheoryGrounding[] = (save.caseTheory?.claims ?? []).map((claim) => {
    const support = supportById.get(claim.id);
    return {
      claimId: claim.id,
      claimText: claim.text,
      status: claim.status,
      reviewedEvidenceTitles: (support?.reviewedEvidenceIds ?? []).map(titleFor),
      hasReviewedEvidence: support?.hasReviewedEvidence ?? false,
    };
  });
  const groundedClaimsCount = theoryGrounding.filter((claim) => claim.hasReviewedEvidence).length;
  const openQuestions = [...view.unresolvedAmbiguity];

  const noteCount = contradictions.length + corroborations.length;
  const overview = noteCount > 0
    ? `Your file keeps ${pluralize(contradictions.length, 'contradiction note')} and ${pluralize(corroborations.length, 'corroboration note')} tied to items you reviewed. Differences between accounts stay on the record instead of being smoothed over.`
    : 'No contradiction or corroboration notes are tied to reviewed items yet. Record one to keep differences between accounts visible on the file.';

  const ambiguityNote = openQuestions.length > 0
    ? `The file leaves ${pluralize(openQuestions.length, 'player-visible open question')} unresolved. Nothing here determines what actually happened; the case closes on your documented work, not on certainty.`
    : 'The file records no open questions; conclusions still stay within what was actually reviewed.';

  return {
    contradictions,
    corroborations,
    links,
    theoryGrounding,
    groundedClaimsCount,
    totalClaims: theoryGrounding.length,
    openQuestions,
    overview,
    ambiguityNote,
  };
}

/** Compact counts for deterministic review feedback and tests. */
export interface ReviewSynthesis {
  contradictions: number;
  corroborations: number;
  groundedClaims: number;
  totalClaims: number;
  openQuestions: number;
}

export function reviewSynthesis(save: SaveGame): ReviewSynthesis {
  const synthesis = buildEvidenceSynthesis(save);
  return {
    contradictions: synthesis.contradictions.length,
    corroborations: synthesis.corroborations.length,
    groundedClaims: synthesis.groundedClaimsCount,
    totalClaims: synthesis.totalClaims,
    openQuestions: synthesis.openQuestions.length,
  };
}
