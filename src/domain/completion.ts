import { toPlayerCaseView } from './caseAccess';
import { buildEvidenceSynthesis } from './evidenceSynthesis';
import type { EvidenceSynthesis } from './evidenceSynthesis';
import { buildLegalMindProfile } from './legalMindProfile';
import type { LegalMindProfile } from './legalMindProfile';
import type { SaveGame } from './types';

/**
 * A player-legible end-of-chapter summary. Every field is derived from state the player
 * can already see in the UI (reputation, relationships, memories, reviewed assignments,
 * discovered evidence and the *player-facing* unresolved ambiguity list). Canonical case
 * truth — actual events, timeline, responsibility, authenticity and hidden motives — is
 * deliberately never read here.
 */
export interface RelationshipHighlight {
  characterId: string;
  name: string;
  role: string;
  trust: number;
  respect: number;
  loyalty: number;
}

export interface CompletedAssignmentHighlight {
  id: string;
  title: string;
}

export interface DiscoveredEvidenceHighlight {
  id: string;
  title: string;
  type: string;
  reviewed: boolean;
}

export interface ChapterCompletionSummary {
  isComplete: boolean;
  title: string;
  day: number;
  finalDay: number;
  caseStatus: string;
  outcome: string;
  careerStage: string;
  reputation: { competence: number; integrity: number; reliability: number };
  relationships: RelationshipHighlight[];
  memoryHighlights: string[];
  assignmentsCompleted: CompletedAssignmentHighlight[];
  assignmentsCompletedCount: number;
  assignmentsTotal: number;
  evidenceDiscovered: DiscoveredEvidenceHighlight[];
  /** Player-visible open questions only — never the canonical ambiguity record. */
  openQuestions: string[];
  closingNote: string;
  /** Formative, deterministic skill feedback derived from recorded player actions only. */
  legalMindProfile: LegalMindProfile;
  /** Contradiction/corroboration and theory synthesis from the player's own file. */
  synthesis: EvidenceSynthesis;
}

const MAX_MEMORY_HIGHLIGHTS = 5;

/** A chapter is complete only after the final brief closed the case. */
export function isChapterComplete(save: SaveGame): boolean {
  return save.flags.chapterOneComplete === true && save.caseFile.status === 'closed';
}

/**
 * Build the completion summary from player-visible state only. Safe to call before the
 * chapter ends; `isComplete` simply reports the current state in that case.
 */
export function buildChapterCompletionSummary(save: SaveGame): ChapterCompletionSummary {
  const playerCase = toPlayerCaseView(save.caseFile);
  const finalAssignment = save.assignments.find((a) => a.id === 'a8');
  const assignmentsCompleted = save.assignments
    .filter((a) => a.status === 'reviewed')
    .map((a) => ({ id: a.id, title: a.title }));
  const relationships = save.relationships
    .filter((r) => r.fromId === 'player')
    .map((r) => {
      const character = save.characters.find((c) => c.id === r.toId);
      return {
        characterId: r.toId,
        name: character?.name ?? r.toId,
        role: character?.role ?? '',
        trust: r.trust,
        respect: r.respect,
        loyalty: r.loyalty,
      };
    });
  const evidenceDiscovered = playerCase.evidence
    .filter((e) => e.discovered)
    .map((e) => ({ id: e.id, title: e.title, type: e.type, reviewed: e.reviewed }));

  return {
    isComplete: isChapterComplete(save),
    title: 'The First Brief — Chapter Complete',
    day: save.clock.day,
    finalDay: 10,
    caseStatus: playerCase.status,
    outcome: finalAssignment?.feedback ?? '',
    careerStage: save.player.careerStage,
    reputation: { ...save.player.reputation },
    relationships,
    memoryHighlights: save.memories.slice(0, MAX_MEMORY_HIGHLIGHTS).map((m) => m.summary),
    assignmentsCompleted,
    assignmentsCompletedCount: assignmentsCompleted.length,
    assignmentsTotal: save.assignments.length,
    evidenceDiscovered,
    openQuestions: [...playerCase.unresolvedAmbiguity],
    closingNote:
      'Case closed on the evidence and reasoning you recorded — not on certainty. First chapter complete: your careful work earns a promotion to junior advocate and the next chapter lies ahead. Authenticity, hidden motives and responsibility were never determined; the open questions above remain unanswered.',
    legalMindProfile: buildLegalMindProfile(save),
    synthesis: buildEvidenceSynthesis(save),
  };
}
