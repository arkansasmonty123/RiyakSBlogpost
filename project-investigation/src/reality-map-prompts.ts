// M4 case-specific reasoning prompts and tutorial scaffolding.
// ---------------------------------------------------------------------------
// These are QUESTION-ONLY, domain-flavoured thinking prompts. They deliberately
// contain no character names, no culprit, no evidence titles, no canonical
// strings and no answer hints. Their purpose is to help a player ask better
// questions of their own notes — never to tell them what to conclude.
//
// Only the three showcase cases have prompts/tutorials. All other cases return
// an empty prompt list and no tutorial (tutorialAvailable=false in the API).

import type { ClaimCategory, Confidence, HypothesisStatus } from './reality-map';

export interface ReasoningPrompt {
  /** Always a question (ends with '?'). */
  text: string;
  /** Suggested category if the player records the answer as a claim. */
  claimCategoryHint: ClaimCategory;
}

export interface TutorialClaimScaffold {
  title: string;
  description: string;
  claimCategory: ClaimCategory;
  confidence: Confidence;
}

export interface TutorialHypothesisScaffold {
  name: string;
  explanation: string;
  status: HypothesisStatus;
  confidence: Confidence;
  missingInformation: string;
  alternativeExplanations: string;
}

export interface TutorialScaffold {
  claims: TutorialClaimScaffold[];
  hypotheses: TutorialHypothesisScaffold[];
}

const SHOWCASE_TITLES = [
  'The Midnight Heist',
  'Code Blue at the Clinic',
  'Blaze at Dawn Bakery',
] as const;

type ShowcaseTitle = (typeof SHOWCASE_TITLES)[number];

const PROMPT_PACKS: Record<ShowcaseTitle, ReasoningPrompt[]> = {
  'The Midnight Heist': [
    { text: 'What records would establish who had access to the gallery after closing time?', claimCategoryHint: 'factual_observation' },
    { text: 'What would the timing of the alarm tell you about the order of events?', claimCategoryHint: 'timeline_assertion' },
    { text: 'If an entry was made without force, what does that invite you to assume — and how would you test it?', claimCategoryHint: 'assumption' },
    { text: 'What are two different readings of the same mark or trace at the scene?', claimCategoryHint: 'interpretation' },
    { text: 'What information is still missing before any route out of the building can be argued?', claimCategoryHint: 'unresolved_question' },
  ],
  'Code Blue at the Clinic': [
    { text: 'Which observations would distinguish an accidental exposure from a deliberate one?', claimCategoryHint: 'interpretation' },
    { text: 'What does the timing of the incident relative to the shift change actually establish?', claimCategoryHint: 'timeline_assertion' },
    { text: 'What are you assuming about who could reach the medication cabinet?', claimCategoryHint: 'assumption' },
    { text: 'What record would corroborate or contradict the reported time of the call?', claimCategoryHint: 'factual_observation' },
    { text: 'What else would you need before ruling out a natural cause?', claimCategoryHint: 'unresolved_question' },
  ],
  'Blaze at Dawn Bakery': [
    { text: 'What would independently corroborate the reported time the fire began?', claimCategoryHint: 'timeline_assertion' },
    { text: 'Which observations point toward an accidental cause, and which point elsewhere?', claimCategoryHint: 'interpretation' },
    { text: 'What assumption underlies the claim that the back entrance was secured?', claimCategoryHint: 'assumption' },
    { text: 'Which maintenance or access records would be relevant, and who could reach them?', claimCategoryHint: 'factual_observation' },
    { text: 'What is still unknown before a cause can be argued either way?', claimCategoryHint: 'unresolved_question' },
  ],
};

function isShowcaseTitle(title: string): title is ShowcaseTitle {
  return (SHOWCASE_TITLES as readonly string[]).includes(title);
}

/** Question-only prompts for a case title. Empty for non-showcase cases. */
export function getReasoningPrompts(caseTitle: string): ReasoningPrompt[] {
  if (!isShowcaseTitle(caseTitle)) return [];
  const prompts = PROMPT_PACKS[caseTitle];
  // Return a defensive copy so callers cannot mutate the shared pack.
  return prompts.map((p) => ({ text: p.text, claimCategoryHint: p.claimCategoryHint }));
}

/**
 * Labelled, blank tutorial scaffolding. Every label starts with
 * 'Tutorial example' so it is unmistakably a placeholder the player should
 * replace — never a claim about the case. Null for non-showcase cases.
 */
export function getTutorialScaffold(caseTitle: string): TutorialScaffold | null {
  if (!isShowcaseTitle(caseTitle)) return null;
  return {
    claims: [
      {
        title: 'Tutorial example — an observation to verify',
        description: 'Replace this with something you actually noticed in the visible material.',
        claimCategory: 'factual_observation',
        confidence: 'insufficient_information',
      },
      {
        title: 'Tutorial example — a question still open',
        description: 'Replace this with a question the visible material does not yet answer.',
        claimCategory: 'unresolved_question',
        confidence: 'insufficient_information',
      },
    ],
    hypotheses: [
      {
        name: 'Tutorial example — a hypothesis to test',
        explanation: 'Replace this with your own working explanation. Nothing here is a conclusion.',
        status: 'active',
        confidence: 'insufficient_information',
        missingInformation: 'What would you need to know next?',
        alternativeExplanations: 'What else could explain the same material?',
      },
    ],
  };
}

export function isRealityMapTutorialAvailable(caseTitle: string): boolean {
  return isShowcaseTitle(caseTitle);
}

/** Export the case titles for validators/tests without duplicating literals. */
export const REALITY_MAP_SHOWCASE_CASE_TITLES: readonly string[] = SHOWCASE_TITLES;
