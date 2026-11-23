import { recordAudit } from './audit';
import { setCurrentDraft } from './draft';
import { checkDraftCitations } from './guards';
import { assignmentLockReason, makeId, reviewAssignment } from './progression';
import type { Assignment, NotebookEntry, SaveGame } from './types';

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

function notebookEntry(save: SaveGame, entry: Omit<NotebookEntry, 'id' | 'day'>): NotebookEntry {
  return { id: makeId('n'), day: save.clock.day, ...entry };
}

/**
 * Plain-language gaps for A2, mirroring reviewAssignment's checks so the player is told
 * what is actually missing rather than a generic "incomplete" reason.
 */
function missingA2Requirements(save: SaveGame, assignment: Assignment | undefined): string[] {
  if (!assignment) return ['the case brief draft assignment to be available'];
  const missing: string[] = [];
  const lockReason = assignmentLockReason(assignment, save);
  if (lockReason === 'day') missing.push(`reach Day ${assignment.day}`);
  if (lockReason === 'prerequisite') missing.push('have the prior assignment reviewed');

  for (const id of assignment.requiredEvidenceIds) {
    const item = save.caseFile.evidence.find((e) => e.id === id);
    if (!item || !item.discovered || !item.reviewed) {
      missing.push(item ? `review the evidence item "${item.title}"` : 'review the required evidence');
    }
  }
  for (const sourceId of assignment.requiredSourceIds) {
    if (!save.notebook.some((n) => n.sourceId === sourceId)) {
      missing.push('add the verified source note to your notebook');
    }
  }
  for (const kind of assignment.requiredNotebookKinds ?? []) {
    if (!save.notebook.some((n) => n.kind === kind)) {
      missing.push(`record a ${kind} note in your notebook`);
    }
  }
  for (const flag of assignment.requiredFlags ?? []) {
    if (!save.flags[flag]) missing.push(`complete the ${flag} milestone`);
  }
  return missing;
}

export interface DraftSubmissionResult {
  /** False only when the citation guardrail blocked the submission. */
  ok: boolean;
  blocked: string[];
  warnings: string[];
  /** Feedback content written to the notebook, beginning with the outcome message. */
  feedback: string;
  /** True when the draft submission also reviewed Assignment 2. */
  a2Reviewed: boolean;
  /** Plain-language list of what A2 still needs; empty once A2 is reviewed. */
  missingRequirements: string[];
  /** Clear player-facing outcome, surfaced in dialogue and at the top of the notebook entry. */
  message: string;
}

/**
 * Deterministic evaluation of a submitted draft. Applies the citation guardrail, grounded
 * feedback and standing changes, then reviews Assignment 2 when its requirements are met.
 * Mutates the given save; the Assignments-panel review path remains independent.
 */
export function submitDraftForFeedback(save: SaveGame, text: string): DraftSubmissionResult {
  const citationCheck = checkDraftCitations(text, save.legalSources);
  if (!citationCheck.ok) {
    const blocked = citationCheck.blocked;
    const content = [
      'Submission blocked.',
      ...blocked.map((b) => `- ${b}`),
      '',
      'Rule: never fabricate or cite unverified legal provisions/judgments.',
    ].join('\n');
    save.notebook.unshift(
      notebookEntry(save, {
        kind: 'feedback',
        title: 'Draft blocked: citation guardrail',
        content,
        verified: true,
      }),
    );
    return {
      ok: false,
      blocked,
      warnings: citationCheck.warnings,
      feedback: content,
      a2Reviewed: false,
      missingRequirements: [],
      message: 'Draft submission blocked — verify the citation before resubmitting.',
    };
  }

  const hasIssue = /issue\s*:/i.test(text) && text.length > 60;
  const hasEvidenceRefs =
    save.caseFile.evidence.some((e) => e.discovered) && /evidence|medical|cctv|witness|report/i.test(text);
  const warnings = citationCheck.warnings;

  recordAudit(save, 'draft-submitted', 'Submitted case brief draft for senior review');
  save.flags.assignment2Submitted = true;

  const rep = save.player.reputation;
  rep.reliability = clamp(rep.reliability + (hasIssue ? 2 : -1));
  rep.competence = clamp(rep.competence + (hasIssue && hasEvidenceRefs ? 2 : hasIssue ? 1 : 0));
  rep.integrity = clamp(rep.integrity + (warnings.length ? 0 : 1));

  const a2 = save.assignments.find((a) => a.id === 'a2');
  if (a2 && a2.status !== 'reviewed') {
    a2.feedback = hasIssue ? 'Structure acceptable; continue evidence-grounded analysis.' : 'Incomplete structure.';
  }
  setCurrentDraft(save, text);
  save.memories.unshift({
    id: makeId('m'),
    day: save.clock.day,
    summary: 'Submitted case brief draft for senior review.',
    participants: ['player', 'senior'],
  });

  let a2Reviewed = false;
  let missingRequirements: string[] = [];
  let message: string;
  if (a2?.status === 'reviewed') {
    a2Reviewed = true;
    message = 'Draft submitted — A2 reviewed.';
  } else {
    missingRequirements = missingA2Requirements(save, a2);
    if (missingRequirements.length === 0) {
      const review = reviewAssignment(save, 'a2');
      if (review.ok) {
        a2Reviewed = true;
        message = 'Draft submitted — A2 reviewed.';
        save.notebook.unshift(
          notebookEntry(save, {
            kind: 'feedback',
            title: `Assignment reviewed: ${a2?.title ?? 'Case brief draft'}`,
            content: review.feedback,
            verified: true,
          }),
        );
      } else {
        missingRequirements = [review.reason ?? 'A2 review could not be completed.'];
        message = `Draft submitted for feedback — A2 still needs: ${missingRequirements.join('; ')}.`;
      }
    } else {
      message = `Draft submitted for feedback — A2 still needs: ${missingRequirements.join('; ')}.`;
    }
  }

  // reviewAssignment also adjusts standing; bound the whole action, not just the draft deltas.
  rep.competence = clamp(rep.competence);
  rep.integrity = clamp(rep.integrity);
  rep.reliability = clamp(rep.reliability);

  const feedback = [
    message,
    hasIssue
      ? 'Structure: acceptable.'
      : 'Structure: incomplete - include Issue, Facts (known/claimed/disputed), Verified Law/Source Notes, Analysis, Conclusion.',
    hasEvidenceRefs ? 'Evidence grounding: present.' : 'Evidence grounding: weak - tie claims to discovered evidence.',
    warnings.length ? `Warnings: ${warnings.join(' ')}` : 'Citation guard: no blocked issues detected.',
    'Reminder: canonical truth is not known; distinguish known/claimed/disputed/unknown.',
  ].join('\n');

  save.notebook.unshift(
    notebookEntry(save, {
      kind: 'feedback',
      title: 'Senior feedback (deterministic)',
      content: feedback,
      verified: true,
    }),
  );

  return { ok: true, blocked: [], warnings, feedback, a2Reviewed, missingRequirements, message };
}
