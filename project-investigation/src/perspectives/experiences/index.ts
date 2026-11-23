// M5-CONTENT: authored perspective experiences registry (12 published entries).
// ---------------------------------------------------------------------------
// The seed script reads this array, so adding an entry is the only step needed
// to make a new experience seedable. The validator applies the full content,
// provenance, no-leakage and cross-reference rules to every entry.
//
// Each entry is a teaching module. Nothing here is evidence, nothing feeds a
// verdict or progression, and no canonical solution content appears. Sources
// are bibliographic proxies with verification_status 'pending_review'; URLs are
// withheld by the DTO until a human verifies them.

import type { ExperienceDefinition } from '../types';
import { platosAllegoryOfTheCave } from './platos-allegory-of-the-cave';
import { shipOfTheseus } from './ship-of-theseus';
import { problemOfInduction } from './problem-of-induction';
import { confirmationBias } from './confirmation-bias';
import { theTrolleyProblem } from './the-trolley-problem';
import { blindMenAndTheElephant } from './blind-men-and-the-elephant';
import { stoicDichotomyOfControl } from './stoic-dichotomy-of-control';
import { dependentOrigination } from './dependent-origination';
import { scientificMethodAndFalsifiability } from './scientific-method-and-falsifiability';
import { historicalSourceReliability } from './historical-source-reliability';
import { moralResponsibility } from './moral-responsibility';
import { collectiveMemory } from './collective-memory';

export const PERSPECTIVE_EXPERIENCES: ExperienceDefinition[] = [
  platosAllegoryOfTheCave,
  shipOfTheseus,
  problemOfInduction,
  confirmationBias,
  theTrolleyProblem,
  blindMenAndTheElephant,
  stoicDichotomyOfControl,
  dependentOrigination,
  scientificMethodAndFalsifiability,
  historicalSourceReliability,
  moralResponsibility,
  collectiveMemory,
];

export function getExperienceDefinitionByKey(key: string): ExperienceDefinition | undefined {
  return PERSPECTIVE_EXPERIENCES.find((e) => e.experienceKey === key);
}

export const EXPERIENCE_KEYS: string[] = PERSPECTIVE_EXPERIENCES.map((e) => e.experienceKey);
