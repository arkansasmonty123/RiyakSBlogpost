import { makeId } from './progression';
import type { Admissibility, EvidenceItem, NotebookEntry, Reliability, SaveGame } from './types';

export interface AssessmentPatch {
  admissibility?: Admissibility;
  reliability?: Reliability;
  rationale?: string;
}

/**
 * Discover an item and reveal its non-authoritative baseline assessment. Deterministic
 * stub only: this is NOT a statement about canonical authenticity. Mutates on success.
 */
export function discoverEvidenceItem(save: SaveGame, evidenceId: string): EvidenceItem | null {
  const item = save.caseFile.evidence.find((e: EvidenceItem) => e.id === evidenceId);
  if (!item || item.discovered) return null;
  item.discovered = true;
  item.admissibility = 'questionable';
  item.reliability = item.type === 'testimony' ? 'low' : 'medium';
  return item;
}

/** Mark an item as actually inspected. Discovery is a prerequisite. Mutates on success. */
export function reviewEvidence(save: SaveGame, evidenceId: string): boolean {
  const item = save.caseFile.evidence.find((e: EvidenceItem) => e.id === evidenceId);
  if (!item || !item.discovered || item.reviewed) return false;
  item.reviewed = true;
  save.memories.unshift({
    id: makeId('m'),
    day: save.clock.day,
    summary: `Reviewed evidence: ${item.title}.`,
    participants: ['player'],
  });
  return true;
}

/** The player's provisional assessment can only be edited after discovery + review. */
export function setEvidenceAssessment(
  save: SaveGame,
  evidenceId: string,
  patch: AssessmentPatch,
): boolean {
  const item = save.caseFile.evidence.find((e: EvidenceItem) => e.id === evidenceId);
  if (!item || !item.discovered || !item.reviewed) return false;
  if (patch.admissibility) item.assessment.admissibility = patch.admissibility;
  if (patch.reliability) item.assessment.reliability = patch.reliability;
  if (patch.rationale !== undefined) item.assessment.rationale = patch.rationale.slice(0, 1000);
  return true;
}

/** Record a contradiction/corroboration note. Writes only player-legible fields. */
export function addEvidenceNote(
  save: SaveGame,
  evidenceId: string,
  relation: 'contradiction' | 'corroboration',
  text: string,
): NotebookEntry | null {
  const item = save.caseFile.evidence.find((e: EvidenceItem) => e.id === evidenceId);
  if (!item || !item.discovered || !item.reviewed) return null;
  const content = text.trim().slice(0, 1000);
  if (!content) return null;

  const entry: NotebookEntry = {
    id: makeId('n'),
    day: save.clock.day,
    kind: 'contradiction',
    title: `${relation === 'contradiction' ? 'Contradiction' : 'Corroboration'} note: ${item.title}`,
    content,
    source: item.provenance,
    verified: false,
    evidenceId: item.id,
    relation,
  };
  save.notebook.unshift(entry);
  return entry;
}
