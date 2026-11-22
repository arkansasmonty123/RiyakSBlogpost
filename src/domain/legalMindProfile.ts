import type { SaveGame } from './types';

/**
 * A "lite", formative Legal Mind Profile. It is computed on demand from actions the player
 * actually recorded (assignments, notebook, evidence review, casework, reviews and reputation).
 * There is deliberately no aggregate/intelligence score: each dimension is qualitative, and
 * every rating is explained by the concrete actions behind it plus one next step.
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
  id: string;
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

function assess(id: string, label: string, signals: Signal[]): LegalMindDimension {
  const present = signals.filter((s) => s.present);
  const level: LegalMindLevel = present.length >= 3 ? 'consistent' : present.length >= 1 ? 'developing' : 'emerging';
  const rationale =
    present.length > 0
      ? `Rated ${LEGAL_MIND_LEVEL_LABELS[level]} on the strength of ${present.length} recorded action${present.length === 1 ? '' : 's'}: ${present.map((s) => s.action).join(' ')}`
      : 'Rated emerging: no supporting actions were recorded in this area during the chapter.';
  return {
    id,
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

function acceptedWithStrength(save: SaveGame, assignmentId: string, fragment: string): boolean {
  return save.reviewRounds.some(
    (r) =>
      r.assignmentId === assignmentId &&
      r.status === 'accepted' &&
      r.strengths.some((s) => s.toLowerCase().includes(fragment)),
  );
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

  const dimensions: LegalMindDimension[] = [
    assess('issue-spotting', 'Issue spotting', [
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
        present: acceptedWithStrength(save, 'a7', 'states the issue'),
        action: 'Your senior confirmed your work summary stated the issue and the basis for your conclusions.',
        nextStep: 'In senior review, state the issue and your basis before the conclusion.',
      },
    ]),
    assess('fact-analysis', 'Fact analysis', [
      {
        present: save.notebook.some((n) => n.kind === 'contradiction' || !!n.relation),
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
    assess('evidence-evaluation', 'Evidence evaluation', [
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
    assess('legal-interpretation', 'Legal interpretation & citation discipline', [
      {
        present: hasVerifiedSourceNote,
        action: 'You relied on a verified, clearly labelled educational source in your research.',
        nextStep: 'Attach a verified, labelled source note before treating material as authority.',
      },
      {
        present: acceptedWithStrength(save, 'a7', 'verified source notes attached'),
        action: 'Your senior confirmed that verified source notes were attached to your work.',
        nextStep: 'Attach the required verified source notes before senior review.',
      },
      {
        present: draftEngaged && /verified|source note/i.test(save.draft.current),
        action: 'You referred to verified law and source notes in your brief.',
        nextStep: 'Refer only to verified, labelled sources in the written brief.',
      },
    ]),
    assess('procedure', 'Procedure', [
      {
        present: save.custodyLog.length > 0,
        action: 'You recorded a chain-of-custody observation on the file.',
        nextStep: 'Record a custody observation so the handling of an item is on the file.',
      },
      {
        present: assignmentReviewed(save, 'a5'),
        action: 'You completed the custody-log assignment on the record.',
        nextStep: 'Complete the custody-log assignment before the final brief.',
      },
      {
        present: assignmentReviewed(save, 'a6'),
        action: 'You completed the admissibility-challenge assignment with a stated ground.',
        nextStep: 'Complete the admissibility-challenge assignment with a stated ground.',
      },
      {
        present: !!save.flags.finalBriefSubmitted,
        action: 'You brought the matter to a final, evidence-grounded brief on the last day.',
        nextStep: 'Submit the final brief once the earlier milestones are complete.',
      },
    ]),
    assess('ethics', 'Ethics & professionalism', [
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
  ];

  return {
    intro:
      'A formative snapshot of the habits you demonstrated in this chapter, drawn only from work you recorded. This is not an aptitude test and there is no single score: each area shows what you did and one concrete way to build on it.',
    dimensions,
    closing:
      'These ratings describe habits shown in one short chapter, not a finding about your ability or about the matter. They change only when the work you record changes.',
  };
}
