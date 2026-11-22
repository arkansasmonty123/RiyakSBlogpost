import { makeId } from './progression';
import type { NotebookEntry, SaveGame, TheoryClaim, TheoryStatus } from './types';

export const THEORY_STATUSES: readonly TheoryStatus[] = ['known', 'claimed', 'disputed'];

export interface TheoryResult {
  ok: boolean;
  reason?: string;
  claim?: TheoryClaim;
  notebookEntry?: NotebookEntry;
}

/**
 * Record a player-authored case-theory claim. Claims are the player's own provisional
 * organisation of the file — never a finding. A claim may only link evidence the player
 * actually discovered and reviewed, so the theory cannot imply knowledge it lacks.
 */
export function addTheoryClaim(
  save: SaveGame,
  text: string,
  status: TheoryStatus,
  evidenceIds: string[],
): TheoryResult {
  const content = (text ?? '').trim().slice(0, 1000);
  if (!content) return { ok: false, reason: 'A case-theory claim cannot be empty.' };
  if (!THEORY_STATUSES.includes(status)) {
    return { ok: false, reason: 'Select a valid status (known, claimed or disputed).' };
  }

  const reviewed = new Set(
    save.caseFile.evidence.filter((e) => e.discovered && e.reviewed).map((e) => e.id),
  );
  const links = [...new Set(evidenceIds)];
  if (links.some((id) => !reviewed.has(id))) {
    return { ok: false, reason: 'Link only evidence you have discovered and reviewed.' };
  }

  // Keep the theory within the same epistemic guardrail as senior review: no conclusions
  // about responsibility. This is deterministic and never reads canonical truth.
  if (/\b(guilty|at fault|culprit)\b/i.test(content)) {
    return { ok: false, reason: 'Do not assert who is at fault; record what is known, claimed or disputed.' };
  }

  const claim: TheoryClaim = {
    id: makeId('t'),
    day: save.clock.day,
    text: content,
    status,
    evidenceIds: links,
  };
  save.caseTheory.claims.unshift(claim);

  const notebookEntry: NotebookEntry = {
    id: makeId('n'),
    day: save.clock.day,
    kind: 'theory',
    title: `Case theory (${status}): ${content.slice(0, 60)}${content.length > 60 ? '…' : ''}`,
    content: content + (links.length ? `\nLinked evidence: ${links.join(', ')}` : ''),
    verified: false,
  };
  save.notebook.unshift(notebookEntry);
  save.memories.unshift({
    id: makeId('m'),
    day: save.clock.day,
    summary: `Added a ${status} case-theory claim to your file.`,
    participants: ['player'],
  });
  return { ok: true, claim, notebookEntry };
}

/** Group claims by status for an accessible, organised theory view. */
export function groupTheoryClaims(save: SaveGame): Record<TheoryStatus, TheoryClaim[]> {
  return {
    known: save.caseTheory.claims.filter((c) => c.status === 'known'),
    claimed: save.caseTheory.claims.filter((c) => c.status === 'claimed'),
    disputed: save.caseTheory.claims.filter((c) => c.status === 'disputed'),
  };
}
