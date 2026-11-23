import { LEGAL_MIND_DIMENSION_IDS } from './types';
import type { LegalMindDimensionId, SaveGame } from './types';

/**
 * A "lite", formative Legal Mind Profile. It is computed on demand from actions the player
 * actually recorded through gameplay events (assignment reviews, senior reviews, case
 * conclusions, evidence discoveries and AI-review outcomes). There is deliberately no
 * aggregate/intelligence score: each of the ten dimensions is a separate qualitative rating,
 * explained by the concrete actions behind it plus one next step.
 *
 * Only player-legible state is read. The canonical case record, authenticity values, motives
 * and responsibility are never consulted, and no legal citation is ever generated here.
 */

export type LegalMindLevel = 'emerging' | 'developing' | 'consistent';

export const LEGAL_MIND_LEVEL_LABELS: Record<LegalMindLevel, string> = {
  emerging: 'Emerging',
  developing: 'Developing',
  consistent: 'Consistent',
};

export const LEGAL_MIND_LEVEL_RANK: Record<LegalMindLevel, number> = {
  emerging: 0,
  developing: 1,
  consistent: 2,
};

export interface LegalMindDimension {
  /** One of the ten stable, separately tracked dimension ids. */
  id: LegalMindDimensionId;
  label: string;
  level: LegalMindLevel;
  levelLabel: string;
  /** Why this rating was given, in terms of the recorded actions behind it. */
  rationale: string;
  /** The recorded actions that support this rating. */
  evidence: string[];
  /** One concrete, evidence-grounded way to strengthen this area next time. */
  nextStep: string;
}

export interface LegalMindProfile {
  intro: string;
  dimensions: LegalMindDimension[];
  closing: string;
}

interface Signal {
  present: boolean;
  /** Past-tense description of a recorded player action. */
  action: string;
  /** Guidance shown when the action was not recorded. */
  nextStep: string;
}

function assess(label: string, signals: Signal[]): Omit<LegalMindDimension, 'id'> {
  const present = signals.filter((s) => s.present);
  const level: LegalMindLevel = present.length >= 3 ? 'consistent' : present.length >= 1 ? 'developing' : 'emerging';
  const rationale =
    present.length > 0
      ? `Rated ${LEGAL_MIND_LEVEL_LABELS[level]} on the strength of ${present.length} recorded action${present.length === 1 ? '' : 's'}: ${present.map((s) => s.action).join(' ')}`
      : 'Rated emerging: no supporting actions were recorded in this area during the chapter.';
  return {
    label,
    level,
    levelLabel: LEGAL_MIND_LEVEL_LABELS[level],
    rationale,
    evidence: present.map((s) => s.action),
    nextStep:
      signals.find((s) => !s.present)?.nextStep ??
      'Keep grounding each point in the material you have actually reviewed.',
  };
}

function reviewedEvidence(save: SaveGame) {
  return save.caseFile.evidence.filter((e) => e.discovered && e.reviewed);
}

function assignmentReviewed(save: SaveGame, id: string): boolean {
  return save.assignments.some((a) => a.id === id && a.status === 'reviewed');
}

function acceptedStrength(save: SaveGame, fragment: string): boolean {
  return save.reviewRounds.some(
    (r) => r.status === 'accepted' && r.strengths.some((s) => s.toLowerCase().includes(fragment)),
  );
}

function revisionCompleted(save: SaveGame): boolean {
  return (
    save.reviewRounds.some((r) => r.status === 'needs_revision') &&
    save.reviewRounds.some((r) => r.status === 'accepted')
  );
}

function caseConcluded(save: SaveGame): boolean {
  return (
    save.flags.finalBriefSubmitted === true ||
    save.flags.chapterOneComplete === true ||
    save.caseFile.status === 'closed'
  );
}

function groundedTheoryClaim(save: SaveGame): boolean {
  const reviewedIds = new Set(reviewedEvidence(save).map((e) => e.id));
  return save.caseTheory.claims.some((c) => c.evidenceIds.some((id) => reviewedIds.has(id)));
}

function consultedOnLimits(save: SaveGame): boolean {
  return ['specialistConsulted', 'medicalConsulted', 'supervisorConsulted', 'juniorConsulted'].some(
    (flag) => save.flags[flag] === true,
  );
}

function verifiedJudgmentNote(save: SaveGame): boolean {
  return save.notebook.some(
    (n) =>
      !!n.sourceId &&
      save.legalSources.some(
        (s) => s.id === n.sourceId && s.sourceType === 'judgment' && s.verificationStatus === 'verified',
      ),
  );
}

/** Accepted structured feedback whose cited ids were checked is a recorded player action. */
function aiFeedbackChecked(save: SaveGame): boolean {
  return save.aiReviews.some((r) => r.gatewayStatus === 'accepted' && r.aiAssisted && r.citedSources.length > 0);
}

/** A rejected proposal is a recorded provenance event; deterministic review still stood. */
function aiFeedbackRejected(save: SaveGame): boolean {
  return save.aiReviews.some((r) => r.gatewayStatus === 'rejected');
}

/** Build the profile from player-visible state only. Safe to call at any point in the chapter. */
export function buildLegalMindProfile(save: SaveGame): LegalMindProfile {
  const reviewed = reviewedEvidence(save);
  // The pre-filled draft template contains the section headings; it is not evidence of work
  // until the player has actually submitted a draft for the case brief assignment.
  const draftEngaged = save.flags.assignment2Submitted === true;
  const hasVerifiedSourceNote = save.notebook.some(
    (n) =>
      n.verified === true &&
      !!n.sourceId &&
      save.legalSources.some((s) => s.id === n.sourceId && s.verificationStatus === 'verified'),
  );
  const keptFaultOutOfSubmissions =
    save.reviewRounds.length > 0 &&
    save.reviewRounds.every((r) => !r.gaps.some((g) => /at fault|guilty|culprit/i.test(g)));
  const contradictionNoted = save.notebook.some((n) => n.kind === 'contradiction' || !!n.relation);
  const aiCheckedToAcceptance =
    aiFeedbackChecked(save) && save.reviewRounds.some((r) => r.assignmentId === 'a7' && r.status === 'accepted');

  // A keyed record guarantees every one of the ten stable ids is built separately. TypeScript
  // fails the build if a dimension is missing, so a profile can never collapse to one score.
  const dimensionsById: Record<LegalMindDimensionId, Omit<LegalMindDimension, 'id'>> = {
    'issue-spotting': assess('Issue spotting', [
      {
        present: draftEngaged && /issue\s*:/i.test(save.draft.current),
        action: 'You framed a distinct issue in your case brief.',
        nextStep: 'Open the brief with a clear issue before moving into the facts.',
      },
      {
        present: assignmentReviewed(save, 'a1'),
        action: 'You completed the fact matrix that separates known facts, claims and unknowns.',
        nextStep: 'Complete the initial fact matrix to practise framing the question first.',
      },
      {
        present: acceptedStrength(save, 'states the issue'),
        action: 'Your senior confirmed your work summary stated the issue and the basis for your conclusions.',
        nextStep: 'In senior review, state the issue and your basis before the conclusion.',
      },
    ]),
    'fact-analysis': assess('Fact analysis', [
      {
        present: contradictionNoted,
        action: 'You recorded a contradiction or corroboration note tied to reviewed evidence.',
        nextStep: 'Record a note that ties a difference between accounts to the item you reviewed.',
      },
      {
        present: !!save.flags.clientInterviewDone,
        action: 'You took a client statement limited to what the client personally saw and heard.',
        nextStep: 'Take statements within what the speaker personally observed, not what they infer.',
      },
      {
        present: draftEngaged && /known|claimed|disputed/i.test(save.draft.current),
        action: 'You separated known, claimed and disputed points in your written work.',
        nextStep: 'Label facts as known, claimed or disputed in your brief.',
      },
    ]),
    'logical-consistency': assess('Logical consistency', [
      {
        present: save.notebook.some((n) => n.kind === 'contradiction' && !!n.evidenceId),
        action: 'You tied a difference between accounts to the specific item you reviewed.',
        nextStep: 'Link each contradiction or corroboration note to the evidence item behind it.',
      },
      {
        present: groundedTheoryClaim(save),
        action: 'You linked a point in your working theory to evidence you had actually reviewed.',
        nextStep: 'Link each theory claim to at least one item you have discovered and reviewed.',
      },
      {
        present: keptFaultOutOfSubmissions,
        action: 'You kept conclusions about fault out of your submitted work.',
        nextStep: 'Separate known, claimed and disputed points instead of asserting fault.',
      },
      {
        present: acceptedStrength(save, 'states the issue and the basis'),
        action: 'Your senior confirmed your work stated the issue and the basis for your conclusions.',
        nextStep: 'State both your conclusion and the basis for it before senior review.',
      },
    ]),
    'evidence-evaluation': assess('Evidence evaluation', [
      {
        present: reviewed.length >= 2,
        action: 'You reviewed items of evidence before relying on them.',
        nextStep: 'Discover and review the listed items before relying on them in a brief.',
      },
      {
        present: reviewed.some((e) => e.assessment.rationale.trim().length > 0),
        action: 'You wrote your own provisional assessment with a stated rationale.',
        nextStep: 'Record a short rationale for your own provisional assessment of an item.',
      },
      {
        present: save.custodyLog.length > 0,
        action: 'You logged a chain-of-custody observation about how an item was handled.',
        nextStep: 'Log how an item was handled rather than treating its status as settled.',
      },
      {
        present: save.challenges.length > 0,
        action: 'You tested how an item could be relied on and stated a legitimate ground.',
        nextStep: 'Challenge reliance on a reviewed item with a stated, legitimate ground.',
      },
    ]),
    'legal-interpretation': assess('Legal interpretation & citation discipline', [
      {
        present: hasVerifiedSourceNote,
        action: 'You relied on a verified, clearly labelled educational source in your research.',
        nextStep: 'Attach a verified, labelled source note before treating material as authority.',
      },
      {
        present: acceptedStrength(save, 'verified source notes attached'),
        action: 'Your senior confirmed that verified source notes were attached to your work.',
        nextStep: 'Attach the required verified source notes before senior review.',
      },
      {
        present: draftEngaged && /verified|source note/i.test(save.draft.current),
        action: 'You referred to verified law and source notes in your brief.',
        nextStep: 'Refer only to verified, labelled sources in the written brief.',
      },
      {
        // Derived from a recorded action, never from an AI assertion: the player opted into a
        // structured review, checked its cited sources and brought the assignment to acceptance.
        present: aiCheckedToAcceptance,
        action:
          'You sought structured senior feedback on a research note, checked its cited sources and revised the work to acceptance.',
        nextStep: 'Request structured feedback on a research note and verify every cited source before resubmitting.',
      },
    ]),
    'precedent-analysis': assess('Precedent analysis', [
      {
        present: verifiedJudgmentNote(save),
        action: 'You consulted a verified judgment source and kept it clearly labelled in your research.',
        nextStep: 'Attach a note from a verified judgment source before reasoning from it.',
      },
      {
        present: draftEngaged && /judgment|precedent|case law/i.test(save.draft.current),
        action: 'You referred to verified judgments or case law in your brief.',
        nextStep: 'Refer to verified judgments only, and keep them clearly labelled in the brief.',
      },
      {
        present: acceptedStrength(save, 'verified source notes attached'),
        action: 'Your senior confirmed that your verified source notes were attached to the work.',
        nextStep: 'Attach the required verified source notes before senior review.',
      },
      {
        present: aiFeedbackChecked(save),
        action: 'You checked the cited sources in structured feedback before relying on it.',
        nextStep: 'Check every cited source in structured feedback before relying on it.',
      },
    ]),
    strategy: assess('Strategy', [
      {
        present: consultedOnLimits(save),
        action:
          'You consulted specialists about the limits of what material could establish before building your theory.',
        nextStep: 'Ask what material can and cannot show before choosing how to use it.',
      },
      {
        present: save.challenges.length > 0,
        action: 'You chose how to test reliance on an item and stated a legitimate ground.',
        nextStep: 'Choose a legitimate ground and state it when testing how material is relied on.',
      },
      {
        present: revisionCompleted(save),
        action: 'You revised your work after senior feedback before it was accepted.',
        nextStep: 'Read senior feedback, revise the work and resubmit before acceptance.',
      },
      {
        present: caseConcluded(save),
        action: 'You carried an evidence-grounded brief through to the final submission.',
        nextStep: 'Bring the earlier milestones together in a final, evidence-grounded brief.',
      },
    ]),
    'counterargument-anticipation': assess('Counterargument anticipation', [
      {
        present: contradictionNoted,
        action: 'You recorded a difference between accounts tied to the item you reviewed.',
        nextStep: 'Record a note that acknowledges a difference between accounts in the file.',
      },
      {
        present: save.caseTheory.claims.some((c) => c.status === 'disputed'),
        action: 'You marked a point in your working theory as disputed rather than settled.',
        nextStep: 'Mark contested points as disputed rather than presenting them as settled.',
      },
      {
        present: save.challenges.length > 0,
        action: 'You tested how an item could be relied on with a stated ground.',
        nextStep: 'Challenge reliance on a reviewed item with a stated, legitimate ground.',
      },
      {
        present: revisionCompleted(save),
        action: 'You addressed senior feedback and resubmitted your work.',
        nextStep: 'Use the revision round to address the gaps the senior pointed out.',
      },
      {
        // The rejection is recorded by deterministic gates; only the opt-in is the player's act.
        present: aiFeedbackRejected(save),
        action:
          'You sought independent structured feedback; when the proposal failed the provenance gates, the deterministic review stood.',
        nextStep: 'Seek independent feedback and let provenance checks decide what may be relied on.',
      },
    ]),
    drafting: assess('Drafting & advocacy', [
      {
        present: assignmentReviewed(save, 'a2'),
        action: 'You completed the case-brief draft assignment.',
        nextStep: 'Complete the case-brief draft before the final brief.',
      },
      {
        present: draftEngaged && /analysis|conclusion/i.test(save.draft.current),
        action: 'You structured your brief with analysis and a conclusion.',
        nextStep: 'Give your brief a reasoned analysis and a clear conclusion.',
      },
      {
        present: revisionCompleted(save),
        action: 'You revised and resubmitted your work after senior feedback.',
        nextStep: 'Revise in response to feedback and resubmit before acceptance.',
      },
      {
        present: caseConcluded(save),
        action: 'You brought the final brief to submission.',
        nextStep: 'Submit the final brief once the earlier milestones are complete.',
      },
    ]),
    'ethical-reasoning': assess('Ethical reasoning & professionalism', [
      {
        present: !!save.flags.clientInterviewDone,
        action: 'You kept the client statement inside what they could personally know.',
        nextStep: 'Ask only for what a witness or client personally observed.',
      },
      {
        present: keptFaultOutOfSubmissions,
        action: 'You kept conclusions about fault out of your submitted work.',
        nextStep: 'Separate known, claimed and disputed points instead of asserting fault.',
      },
      {
        present: save.challenges.length > 0,
        action: 'You tested reliance on the record instead of asserting what it could not show.',
        nextStep: 'Question how material may be relied on rather than overstating it.',
      },
      {
        present: save.player.reputation.integrity > 10 || !!save.flags.peerIntegrityChoice,
        action: 'You chose accuracy over advantage in a professional judgement call.',
        nextStep: 'Record gaps and credit colleagues honestly, even when it is inconvenient.',
      },
    ]),
  };

  const dimensions: LegalMindDimension[] = LEGAL_MIND_DIMENSION_IDS.map((id) => ({ id, ...dimensionsById[id] }));

  return {
    intro:
      'A formative snapshot of the habits you demonstrated in this chapter, drawn only from work you recorded. This is not an aptitude test and there is no single score: each area shows what you did and one concrete way to build on it.',
    dimensions,
    closing:
      'These ratings describe habits shown in one short chapter, not a finding about your ability or about the matter. They change only when the work you record changes.',
  };
}
