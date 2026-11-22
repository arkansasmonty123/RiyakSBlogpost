import { toPlayerCaseView } from './caseAccess';
import type { SaveGame } from './types';

/**
 * Deterministic, player-visible review prompts. Each prompt is a question about how to
 * analyse material the player has already discovered and reviewed; it is never an assertion
 * about what actually happened. Prompts are derived only from the sanitized player view, so
 * they cannot reveal canonical truth, authenticity, responsibility or hidden motives, and
 * they deliberately contain no legal citations.
 */
export interface ReviewPrompt {
  id: string;
  /** The reviewed item this prompt is tied to. */
  evidenceId: string;
  evidenceTitle: string;
  focus: string;
  prompt: string;
}

interface ReviewPromptDefinition {
  id: string;
  evidenceId: string;
  focus: string;
  prompt: string;
}

/**
 * Added as optional depth. A prompt only becomes visible once its item is discovered AND
 * reviewed, so it never points a player at material they have not legitimately seen.
 */
const REVIEW_PROMPT_CATALOG: readonly ReviewPromptDefinition[] = [
  {
    id: 'rp-clock-register',
    evidenceId: 'ev-7',
    focus: 'Timing & records',
    prompt:
      'The camera clock note records that the clock was not checked against a common time reference that day. Before treating the clip’s timing as settled, consider how it lines up with the clinic register extract, and record the limit in a note tied to an item you reviewed.',
  },
  {
    id: 'rp-earlier-later-account',
    evidenceId: 'ev-9',
    focus: 'Account consistency',
    prompt:
      'The earlier account differs in emphasis from the later interview note, and neither fixes the exact order. Consider noting what differs and whether it has been put to the witness, without treating either version as conclusive.',
  },
];

/** Prompts whose evidence the player has legitimately discovered and reviewed. */
export function reviewPromptsFor(save: SaveGame): ReviewPrompt[] {
  const view = toPlayerCaseView(save.caseFile);
  const reviewed = new Map(view.evidence.filter((e) => e.discovered && e.reviewed).map((e) => [e.id, e.title]));
  return REVIEW_PROMPT_CATALOG.filter((definition) => reviewed.has(definition.evidenceId)).map((definition) => ({
    id: definition.id,
    evidenceId: definition.evidenceId,
    evidenceTitle: reviewed.get(definition.evidenceId) as string,
    focus: definition.focus,
    prompt: definition.prompt,
  }));
}

/** All prompt text in a stable, testable form (used to check for leaks and citations). */
export const ALL_REVIEW_PROMPT_TEXT: readonly string[] = REVIEW_PROMPT_CATALOG.flatMap((definition) => [
  definition.focus,
  definition.prompt,
]);
