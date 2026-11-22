import type { Assignment, GameClock, NotebookEntry, SaveGame } from './types';

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function nextSlot(slot: GameClock['slot']): GameClock['slot'] {
  if (slot === 'morning') return 'afternoon';
  if (slot === 'afternoon') return 'evening';
  return 'morning';
}

/** An assignment unlocks only by in-game day AND by reviewed prerequisite work. */
export function isAssignmentUnlocked(assignment: Assignment, save: SaveGame): boolean {
  if (save.clock.day < assignment.day) return false;
  if (assignment.unlockAfter) {
    const prerequisite = save.assignments.find((a) => a.id === assignment.unlockAfter);
    if (!prerequisite || prerequisite.status !== 'reviewed') return false;
  }
  return true;
}

/** Promote locked assignments whose day/prerequisites are now satisfied. Mutates the given save. */
export function refreshAssignmentUnlocks(save: SaveGame): SaveGame {
  for (const assignment of save.assignments) {
    if (assignment.status === 'locked' && isAssignmentUnlocked(assignment, save)) {
      assignment.status = 'active';
    }
  }
  return save;
}

export interface Objective {
  assignmentId: string;
  title: string;
  description: string;
  unlockDay: number;
  evidenceProgress: string;
  sourceProgress: string;
  noteProgress: string;
  status: Assignment['status'];
}

/** The first unfinished assignment, with progress counted from player-visible state only. */
export function currentObjective(save: SaveGame): Objective | null {
  const assignment =
    save.assignments.find((a) => a.status === 'active' || a.status === 'submitted') ??
    save.assignments.find((a) => a.status === 'locked' || a.status === 'pending');
  if (!assignment) return null;

  const evidenceDone = assignment.requiredEvidenceIds.filter((id) =>
    save.caseFile.evidence.some((e) => e.id === id && e.discovered),
  ).length;
  const sourcesDone = assignment.requiredSourceIds.filter((id) =>
    save.notebook.some((n) => n.sourceId === id),
  ).length;
  const requiredKinds = assignment.requiredNotebookKinds ?? [];
  const notesDone = requiredKinds.filter((kind) =>
    save.notebook.some((n: NotebookEntry) => n.kind === kind),
  ).length;

  return {
    assignmentId: assignment.id,
    title: assignment.title,
    description: assignment.description,
    unlockDay: assignment.day,
    evidenceProgress: `${evidenceDone}/${assignment.requiredEvidenceIds.length}`,
    sourceProgress: `${sourcesDone}/${assignment.requiredSourceIds.length}`,
    noteProgress: `${notesDone}/${requiredKinds.length}`,
    status: assignment.status,
  };
}

/**
 * Advance the in-game clock. Rolling into a new day processes unlocks and writes a
 * world memory, so time advance moves the loop forward rather than only changing a label.
 * Mutates the given save.
 */
export function advanceClock(save: SaveGame): { dayChanged: boolean } {
  const rolledOver = save.clock.slot === 'evening';
  save.clock.slot = nextSlot(save.clock.slot);
  if (rolledOver) {
    save.clock.day += 1;
    save.memories.unshift({
      id: makeId('m'),
      day: save.clock.day,
      summary: `Day ${save.clock.day} begins. New office work may be assigned.`,
      participants: ['player'],
    });
  }
  refreshAssignmentUnlocks(save);
  return { dayChanged: rolledOver };
}

export interface AssignmentReviewResult {
  ok: boolean;
  reason?: string;
  feedback: string;
}

const REVIEW_FEEDBACK: Record<string, string> = {
  a1: 'Good start. Facts, allegations, and unknowns separated. Continue with an evidence-grounded brief.',
  a2: 'Structure and sources acceptable. Keep every claim tied to reviewed evidence.',
  a3: 'Contradiction note tied to reviewed evidence recorded. Sound, careful analysis.',
};

/** Deterministic senior review. Mutates the given save on success. */
export function reviewAssignment(save: SaveGame, assignmentId: string): AssignmentReviewResult {
  const assignment = save.assignments.find((a) => a.id === assignmentId);
  if (!assignment) return { ok: false, reason: 'Assignment not found.', feedback: '' };
  if (assignment.status === 'reviewed' || assignment.status === 'submitted') {
    return { ok: false, reason: 'Already submitted for review.', feedback: '' };
  }
  if (!isAssignmentUnlocked(assignment, save)) {
    return { ok: false, reason: `Locked: unlocks on Day ${assignment.day} after prior work is reviewed.`, feedback: '' };
  }

  const evidenceOk = assignment.requiredEvidenceIds.every((id) =>
    save.caseFile.evidence.some((e) => e.id === id && e.discovered && e.reviewed),
  );
  const sourcesOk = assignment.requiredSourceIds.every((id) =>
    save.notebook.some((n) => n.sourceId === id),
  );
  const notesOk = (assignment.requiredNotebookKinds ?? []).every((kind) =>
    save.notebook.some((n) => n.kind === kind),
  );

  if (!evidenceOk || !sourcesOk || !notesOk) {
    return {
      ok: false,
      reason: 'Incomplete: discover and review required evidence, add required sources, and record required notes.',
      feedback: '',
    };
  }

  assignment.status = 'reviewed';
  assignment.feedback = REVIEW_FEEDBACK[assignment.id] ?? 'Reviewed. Continue with evidence-grounded work.';
  save.flags[`assignment${assignment.id.slice(1)}Submitted`] = true;
  save.player.reputation.reliability += 2;
  save.player.reputation.competence += 1;
  save.memories.unshift({
    id: makeId('m'),
    day: save.clock.day,
    summary: `Assignment "${assignment.title}" reviewed by senior with positive feedback.`,
    participants: ['player', 'senior'],
  });
  refreshAssignmentUnlocks(save);
  return { ok: true, feedback: assignment.feedback };
}
