import { toPlayerCaseView } from './caseAccess';
import type { SaveGame } from './types';

/**
 * A player-legible "case at a glance" built only from what the player can already see:
 * the sanitized case view, their own dated notes and the chapter phase. It deliberately
 * never reads canonical truth, so it cannot reveal the real sequence, responsibility,
 * authenticity or hidden motives.
 */
export interface CorroborationLink {
  id: string;
  day: number;
  evidenceId: string;
  evidenceTitle: string;
  relation: 'contradiction' | 'corroboration';
  note: string;
}

export interface CaseSummary {
  phase: string;
  framing: string;
  discoveredCount: number;
  reviewedCount: number;
  evidenceTotal: number;
  evidenceNoteCount: number;
  corroborationLinks: CorroborationLink[];
  openQuestions: string[];
}

const FRAMING =
  'This is a working record of the reported canteen altercation. It keeps what you have learned separate from what others allege and from the questions still open. Nothing here is a finding about what happened, who was responsible, or whether any item is authentic.';

export function buildCaseSummary(save: SaveGame): CaseSummary {
  const view = toPlayerCaseView(save.caseFile);
  const evidenceTitleById = new Map(view.evidence.map((e) => [e.id, e.title]));
  const corroborationLinks: CorroborationLink[] = save.notebook
    .filter((n) => n.evidenceId && (n.relation === 'contradiction' || n.relation === 'corroboration'))
    .map((n) => ({
      id: n.id,
      day: n.day,
      evidenceId: n.evidenceId as string,
      evidenceTitle: evidenceTitleById.get(n.evidenceId as string) ?? (n.evidenceId as string),
      relation: n.relation as 'contradiction' | 'corroboration',
      note: n.content,
    }));

  return {
    phase: save.clock.day <= 5 ? 'Foundations · Days 1–5' : 'First case · Days 6–10',
    framing: FRAMING,
    discoveredCount: view.evidence.filter((e) => e.discovered).length,
    reviewedCount: view.evidence.filter((e) => e.reviewed).length,
    evidenceTotal: view.evidence.length,
    evidenceNoteCount: save.notebook.filter((n) => n.evidenceId).length,
    corroborationLinks,
    openQuestions: [...view.unresolvedAmbiguity],
  };
}
