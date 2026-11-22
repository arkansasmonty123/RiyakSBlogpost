import { isAssignmentUnlocked, makeId, refreshAssignmentUnlocks } from './progression';
import type {
  AdmissibilityChallenge,
  ChallengeGround,
  CustodyObservation,
  ReviewRound,
  SaveGame,
} from './types';

const MAX_TEXT = 1000;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Only an item the player actually discovered and reviewed can support casework. */
function reviewedItem(save: SaveGame, evidenceId: string) {
  return save.caseFile.evidence.find(
    (e) => e.id === evidenceId && e.discovered && e.reviewed,
  );
}

function seniorRelationship(save: SaveGame) {
  return save.relationships.find((r) => r.fromId === 'player' && r.toId === 'senior');
}

export interface CustodyResult {
  ok: boolean;
  reason?: string;
  observation?: CustodyObservation;
}

/**
 * Record a player-legible chain-of-custody observation. Deterministic consequences only:
 * reliability rises slightly and a specific memory is written. Authenticity is never touched.
 */
export function recordCustodyObservation(
  save: SaveGame,
  evidenceId: string,
  observation: string,
): CustodyResult {
  const item = reviewedItem(save, evidenceId);
  if (!item) return { ok: false, reason: 'Discover and review the item before logging custody.' };
  const text = observation.trim().slice(0, MAX_TEXT);
  if (!text) return { ok: false, reason: 'Observation cannot be empty.' };

  const record: CustodyObservation = {
    id: makeId('c'),
    day: save.clock.day,
    evidenceId,
    observation: text,
  };
  save.custodyLog.unshift(record);
  save.notebook.unshift({
    id: makeId('n'),
    day: save.clock.day,
    kind: 'note',
    title: `Chain-of-custody observation: ${item.title}`,
    content: text,
    source: item.provenance,
    verified: false,
    evidenceId: item.id,
  });
  save.memories.unshift({
    id: makeId('m'),
    day: save.clock.day,
    summary: `Logged a chain-of-custody observation for ${item.title}.`,
    participants: ['player'],
  });
  save.flags.custodyLogged = true;
  save.player.reputation.reliability = clamp(save.player.reputation.reliability + 1);
  return { ok: true, observation: record };
}

export interface ChallengeResult {
  ok: boolean;
  reason?: string;
  challenge?: AdmissibilityChallenge;
  feedback?: string;
}

const GROUND_FEEDBACK: Record<ChallengeGround, string> = {
  relevance: 'Relevance addresses whether the item helps prove a fact in issue.',
  reliability: 'Reliability addresses whether the item is what it appears to be and how it was produced.',
  custody: 'Custody addresses who handled the item and whether that handling is documented.',
  provenance: 'Provenance addresses the recorded origin and integrity of the item.',
};

/**
 * Challenge how a reviewed item may be relied upon. The ground and rationale are the player's
 * own reasoning; the deterministic consequence rewards specificity, not any claimed "truth".
 */
export function challengeEvidenceAdmissibility(
  save: SaveGame,
  evidenceId: string,
  ground: ChallengeGround,
  rationale: string,
): ChallengeResult {
  const item = reviewedItem(save, evidenceId);
  if (!item) return { ok: false, reason: 'Discover and review the item before challenging it.' };
  const text = rationale.trim().slice(0, MAX_TEXT);
  if (!text) return { ok: false, reason: 'Rationale cannot be empty.' };

  const challenge: AdmissibilityChallenge = {
    id: makeId('ch'),
    day: save.clock.day,
    evidenceId,
    ground,
    rationale: text,
  };
  save.challenges.unshift(challenge);
  save.notebook.unshift({
    id: makeId('n'),
    day: save.clock.day,
    kind: 'note',
    title: `Admissibility challenge (${ground}): ${item.title}`,
    content: text,
    source: item.provenance,
    verified: false,
    evidenceId: item.id,
  });
  save.memories.unshift({
    id: makeId('m'),
    day: save.clock.day,
    summary: `Challenged reliance on ${item.title} on ${ground} grounds.`,
    participants: ['player', 'senior'],
  });
  save.flags.admissibilityChallenged = true;

  const specific = text.length >= 20;
  const senior = seniorRelationship(save);
  if (senior) senior.respect = clamp(senior.respect + (specific ? 2 : -1));
  if (!specific) save.player.reputation.competence = clamp(save.player.reputation.competence - 1);

  return {
    ok: true,
    challenge,
    feedback: `${GROUND_FEEDBACK[ground]} The item’s authenticity has not been determined.`,
  };
}

export interface SeniorReviewResult {
  ok: boolean;
  reason?: string;
  round?: ReviewRound;
  status?: ReviewRound['status'];
  feedback: string;
  strengths: string[];
  gaps: string[];
}

const NOT_FOUND: SeniorReviewResult = {
  ok: false,
  reason: 'Assignment not found.',
  feedback: '',
  strengths: [],
  gaps: [],
};

/**
 * One deterministic senior-review submission. Produces a submit → feedback → revise →
 * resubmit loop: assignments marked `requiresRevisionLoop` cannot be accepted on round one.
 * All assessment is computed from player-visible state only.
 */
export function submitSeniorReview(
  save: SaveGame,
  assignmentId: string,
  workSummary: string,
): SeniorReviewResult {
  const assignment = save.assignments.find((a) => a.id === assignmentId);
  if (!assignment) return NOT_FOUND;
  if (assignment.status === 'reviewed') {
    return { ...NOT_FOUND, reason: 'Assignment already accepted.' };
  }
  if (!isAssignmentUnlocked(assignment, save)) {
    return { ...NOT_FOUND, reason: `Locked: unlocks on Day ${assignment.day} after prior work is reviewed.` };
  }

  const summary = (workSummary ?? '').trim();
  const strengths: string[] = [];
  const gaps: string[] = [];

  const evidenceDone = assignment.requiredEvidenceIds.filter((id) =>
    save.caseFile.evidence.some((e) => e.id === id && e.discovered && e.reviewed),
  ).length;
  if (evidenceDone === assignment.requiredEvidenceIds.length) {
    strengths.push('Required evidence discovered and reviewed.');
  } else {
    gaps.push('Review all required evidence before the senior accepts.');
  }

  const sourcesDone = assignment.requiredSourceIds.filter((id) =>
    save.notebook.some((n) => n.sourceId === id),
  ).length;
  if (sourcesDone === assignment.requiredSourceIds.length) {
    strengths.push('Verified source notes attached.');
  } else {
    gaps.push('Attach the required verified source notes.');
  }

  // `reviewAccepted` is earned by this very action, so it is not a pre-submission gap.
  const milestoneFlags = (assignment.requiredFlags ?? []).filter((f) => f !== 'reviewAccepted');
  const flagsDone = milestoneFlags.filter((f) => save.flags[f]).length;
  if (flagsDone === milestoneFlags.length) {
    strengths.push('Casework milestones recorded.');
  } else {
    gaps.push('Complete the casework milestone for this assignment.');
  }

  if (summary.length >= 40) {
    strengths.push('Work summary states the issue and the basis for conclusions.');
  } else {
    gaps.push('Expand the work summary (at least 40 characters) so the senior can follow your reasoning.');
  }
  if (/\b(guilty|at fault|culprit)\b/i.test(summary)) {
    gaps.push('Do not assert who was at fault; separate known, claimed and disputed points.');
  }

  const priorRounds = save.reviewRounds.filter((r) => r.assignmentId === assignmentId);
  const roundNo = priorRounds.length + 1;
  if (assignment.requiresRevisionLoop && !priorRounds.some((r) => r.status === 'needs_revision')) {
    gaps.push('Revise the brief in response to feedback and resubmit before acceptance.');
  }

  const accepted = gaps.length === 0;
  const round: ReviewRound = {
    id: makeId('r'),
    day: save.clock.day,
    assignmentId,
    round: roundNo,
    status: accepted ? 'accepted' : 'needs_revision',
    feedback: '',
    strengths,
    gaps,
  };
  round.feedback = accepted
    ? `Senior review accepted after ${roundNo} submission${roundNo > 1 ? 's' : ''}. ${strengths.join(' ')}`
    : `Senior review round ${roundNo}: revise and resubmit. ${gaps.join(' ')}`;

  save.reviewRounds.unshift(round);
  save.memories.unshift({
    id: makeId('m'),
    day: save.clock.day,
    summary: `Senior review (${assignment.title}, round ${roundNo}): ${round.status}.`,
    participants: ['player', 'senior'],
  });
  const senior = seniorRelationship(save);

  if (accepted) {
    assignment.status = 'reviewed';
    assignment.feedback = round.feedback;
    save.flags.reviewAccepted = true;
    save.flags[`assignment${assignmentId.slice(1)}Submitted`] = true;
    save.player.reputation.competence = clamp(save.player.reputation.competence + 2);
    save.player.reputation.reliability = clamp(save.player.reputation.reliability + 2);
    if (senior) {
      senior.trust = clamp(senior.trust + 4);
      senior.respect = clamp(senior.respect + 4);
    }
  } else {
    assignment.status = 'submitted';
    if (senior && roundNo > 1) senior.respect = clamp(senior.respect + 1);
  }

  save.notebook.unshift({
    id: makeId('n'),
    day: save.clock.day,
    kind: 'feedback',
    title: `Senior feedback — ${assignment.title} (round ${roundNo})`,
    content: round.feedback,
    verified: true,
  });
  refreshAssignmentUnlocks(save);
  return {
    ok: true,
    round,
    status: round.status,
    feedback: round.feedback,
    strengths,
    gaps,
  };
}

export interface FinalBriefResult {
  ok: boolean;
  reason?: string;
  tier?: 'strong' | 'solid' | 'shaky';
  consequence?: string;
}

const FINAL_CONSEQUENCE: Record<'strong' | 'solid' | 'shaky', string> = {
  strong: 'The senior commends a careful, evidence-grounded file. Your standing for competence and reliability rises, and the firm trusts you with greater responsibility.',
  solid: 'The file is accepted with minor notes. Your careful habits are recognised and your standing improves steadily.',
  shaky: 'The file is accepted with reservations. Gaps in the record were noted; your standing changes only slightly and the senior asks for closer work next time.',
};

/**
 * Final Day-10 submission. Consequence is a deterministic function of player-visible
 * reputation and review history — never canonical truth. Closes the chapter on success.
 */
export function submitFinalBrief(save: SaveGame, workSummary: string): FinalBriefResult {
  const assignment = save.assignments.find((a) => a.id === 'a8');
  if (!assignment) return { ok: false, reason: 'Final brief assignment not found.' };
  if (assignment.status === 'reviewed') return { ok: false, reason: 'Final brief already submitted.' };
  if (!isAssignmentUnlocked(assignment, save)) {
    return { ok: false, reason: `Locked: unlocks on Day ${assignment.day} after prior work is reviewed.` };
  }
  if ((workSummary ?? '').trim().length < 40) {
    return { ok: false, reason: 'Write a final brief summary of at least 40 characters before submitting.' };
  }
  const needed = ['clientInterviewDone', 'custodyLogged', 'admissibilityChallenged', 'reviewAccepted'];
  if (needed.some((flag) => !save.flags[flag])) {
    return { ok: false, reason: 'Complete the interview, custody log, admissibility challenge and senior review before the final brief.' };
  }

  const rep = save.player.reputation;
  const acceptedRounds = save.reviewRounds.filter((r) => r.status === 'accepted').length;
  const score = rep.competence + rep.integrity + rep.reliability + acceptedRounds * 2;
  const tier: 'strong' | 'solid' | 'shaky' = score >= 60 ? 'strong' : score >= 40 ? 'solid' : 'shaky';
  const consequence = FINAL_CONSEQUENCE[tier];

  assignment.status = 'reviewed';
  assignment.feedback = consequence;
  save.flags.finalBriefSubmitted = true;
  save.flags.chapterOneComplete = true;
  save.caseFile.status = 'closed';
  save.player.reputation.competence = clamp(rep.competence + 2);
  save.player.reputation.reliability = clamp(rep.reliability + 1);
  const senior = seniorRelationship(save);
  if (senior) {
    senior.trust = clamp(senior.trust + 6);
    senior.respect = clamp(senior.respect + 6);
    senior.loyalty = clamp(senior.loyalty + 4);
  }
  save.memories.unshift({
    id: makeId('m'),
    day: save.clock.day,
    summary: `Final brief submitted on Day ${save.clock.day}. Consequence: ${tier}.`,
    participants: ['player', 'senior'],
  });
  save.notebook.unshift({
    id: makeId('n'),
    day: save.clock.day,
    kind: 'feedback',
    title: 'Final brief consequence (deterministic)',
    content: consequence,
    verified: true,
  });
  refreshAssignmentUnlocks(save);
  return { ok: true, tier, consequence };
}
