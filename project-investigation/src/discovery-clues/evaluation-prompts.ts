/**
 * M7 optional, bounded LLM assessment. The deterministic evaluator remains
 * authoritative. Prompts contain only public clue fields and player text —
 * never aliases, thresholds, misconception lists, correctedUnderstanding,
 * canonical truth, or hidden evidence.
 *
 * The parse/merge helpers can never set `accepted = true` or change the
 * deterministic classification; they only attach advisory notes.
 */

import { clipText } from './safety';
import {
  DISCOVERY_CLASSIFICATIONS, type DiscoveryClassification, type DiscoveryClue,
  type DiscoverySubmissionInput, type EvaluationResult,
} from './types';

export const LLM_PROMPT_LIMITS = {
  maxClueChars: 900,
  maxSubmissionChars: 2_400,
  maxAdvisoryItems: 8,
  maxAdvisoryItemChars: 200,
  maxNoteChars: 600,
} as const;

export interface LlmAssessment {
  conceptsAddressed: string[];
  concerns: string[];
  classificationHint: DiscoveryClassification | null;
  notes: string;
}

export interface MergedEvaluation extends EvaluationResult {
  llmAdvisory: LlmAssessment | null;
}

/** Build a bounded, answer-free prompt for an optional advisory model call. */
export function buildEvaluationPrompt(
  clue: DiscoveryClue,
  submission: DiscoverySubmissionInput,
): string {
  const lines = [
    'You are an advisory reader for a research journal, not a grader.',
    'Do not decide whether the answer is accepted. Do not infer any hidden case solution.',
    'Return a single JSON object with keys: conceptsAddressed (array of short strings), concerns (array of short strings), classificationHint (one of ' +
      DISCOVERY_CLASSIFICATIONS.join(', ') + ' or null), notes (short string).',
    '',
    `Subject: ${clipText(clue.subjectLabel, 120)}`,
    `Reference category: ${clue.referenceCategory}`,
    `Question: ${clipText(clue.prompt, LLM_PROMPT_LIMITS.maxClueChars)}`,
    `Context: ${clipText(clue.context, LLM_PROMPT_LIMITS.maxClueChars)}`,
    '',
    `Player subject identification: ${clipText(submission.subjectIdentification, LLM_PROMPT_LIMITS.maxSubmissionChars)}`,
    `Player explanation: ${clipText(submission.explanation, LLM_PROMPT_LIMITS.maxSubmissionChars)}`,
    `Player connection to the case: ${clipText(submission.connectionExplanation, LLM_PROMPT_LIMITS.maxSubmissionChars)}`,
    `Player uncertainty: ${clipText(submission.uncertainty, 400)}`,
    '',
    'Be conservative: flag unsupported confidence and missing links to the case.',
  ];
  return lines.join('\n');
}

function boundedStrings(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => clipText(item, maxChars))
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Parse a bounded advisory JSON object. Returns null for anything malformed. */
export function parseLlmAssessment(raw: string): LlmAssessment | null {
  try {
    const start = String(raw ?? '').indexOf('{');
    const end = String(raw ?? '').lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    const parsed: unknown = JSON.parse(String(raw).slice(start, end + 1));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const hint = typeof record.classificationHint === 'string' &&
      (DISCOVERY_CLASSIFICATIONS as readonly string[]).includes(record.classificationHint)
      ? record.classificationHint as DiscoveryClassification
      : null;
    return {
      conceptsAddressed: boundedStrings(
        record.conceptsAddressed,
        LLM_PROMPT_LIMITS.maxAdvisoryItems,
        LLM_PROMPT_LIMITS.maxAdvisoryItemChars,
      ),
      concerns: boundedStrings(
        record.concerns,
        LLM_PROMPT_LIMITS.maxAdvisoryItems,
        LLM_PROMPT_LIMITS.maxAdvisoryItemChars,
      ),
      classificationHint: hint,
      notes: typeof record.notes === 'string'
        ? clipText(record.notes, LLM_PROMPT_LIMITS.maxNoteChars)
        : '',
    };
  } catch {
    return null;
  }
}

/**
 * Attach advisory data without altering authoritative decision fields.
 * The returned object always keeps deterministic `accepted` and `classification`.
 */
export function mergeLlmAssessment(
  deterministic: EvaluationResult,
  advisory: LlmAssessment | null,
): MergedEvaluation {
  return {
    ...deterministic,
    accepted: deterministic.accepted,
    classification: deterministic.classification,
    llmAdvisory: advisory === null ? null : {
      conceptsAddressed: [...advisory.conceptsAddressed],
      concerns: [...advisory.concerns],
      classificationHint: advisory.classificationHint,
      notes: advisory.notes,
    },
  };
}
