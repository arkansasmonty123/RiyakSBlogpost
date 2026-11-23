/**
 * M7 deterministic discovery submission evaluator.
 *
 * Concept-based, explainable-by-reason-code, and deliberately conservative.
 * No LLM call, no DB access, no canonical truth. The evaluator NEVER returns
 * correctedUnderstanding; that is a DTO concern gated on `accepted`.
 */

import type {
  DiscoveryClassification, DiscoveryClue, DiscoverySubmissionInput, EvaluationResult,
} from './types';

const NEGATIONS = new Set([
  'not', 'never', 'cannot', 'cant', 'doesnt', 'dont', 'isnt', 'arent', 'wasnt',
  'werent', 'wont', 'no', 'without',
]);

const ALTERNATIVE_MARKERS = [
  'alternative', 'could also', 'another explanation', 'another possibility',
  'might instead', 'may instead', 'other reading', 'equally possible',
];

/** Lowercase, strip accents/punctuation, collapse whitespace. */
export function normalizeText(input: unknown): string {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Index of an unnegated phrase in already-normalized text, or -1.
 * A nearby negator ("not", "cannot", ...) prevents a phrase from counting as
 * an assertion — important for misconception terms such as "visual inspection
 * alone is enough" which often appear inside a correct denial.
 */
function findUnnegated(haystack: string, phrase: string): number {
  const needle = normalizeText(phrase);
  if (!needle) return -1;
  let from = 0;
  while (from <= haystack.length) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) return -1;
    const preceding = haystack.slice(Math.max(0, index - 60), index);
    const recentWords = preceding.split(' ').filter(Boolean).slice(-5);
    if (!recentWords.some((word) => NEGATIONS.has(word))) return index;
    from = index + needle.length;
  }
  return -1;
}

function anyPhrase(text: string, phrases: readonly string[]): string | null {
  for (const phrase of phrases) {
    if (findUnnegated(text, phrase) !== -1) return phrase;
  }
  return null;
}

function countTo4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(1, Math.max(0, value)) * 10000) / 10000;
}

/**
 * Evaluate a submission against an authored clue. Deterministic and pure.
 * `accepted` is true only for classification 'established'.
 */
export function evaluateSubmission(
  clue: DiscoveryClue,
  submission: DiscoverySubmissionInput,
): EvaluationResult {
  const criteria = clue.criteria;
  // Uncertainty is intentionally excluded from assertion matching: hedging must
  // not accidentally satisfy acceptance criteria.
  const assertion = normalizeText([
    submission.explanation,
    submission.subjectIdentification,
    submission.connectionExplanation,
  ].filter(Boolean).join(' '));

  const subjectMatch = anyPhrase(assertion, criteria.subjectAliases);
  const subjectMatched = subjectMatch !== null;

  const matchedEssential: string[] = [];
  const missingEssential: string[] = [];
  for (const concept of criteria.essentialConcepts) {
    if (anyPhrase(assertion, concept.aliases) !== null) matchedEssential.push(concept.key);
    else missingEssential.push(concept.key);
  }

  const matchedOptional: string[] = [];
  for (const concept of criteria.optionalConcepts) {
    if (anyPhrase(assertion, concept.aliases) !== null) matchedOptional.push(concept.key);
  }

  const connectionMarker = anyPhrase(assertion, criteria.connectionMarkers);
  const matchedConnection = connectionMarker !== null;

  const misconceptions: string[] = [];
  for (const term of criteria.misconceptionTerms) {
    if (findUnnegated(assertion, term) !== -1) misconceptions.push(term);
  }
  const confidentMarker = misconceptions.length > 0
    ? anyPhrase(assertion, criteria.confidentMarkers)
    : null;
  const confidentMisinformation = confidentMarker !== null;

  const longEnough = assertion.length >= Math.max(0, criteria.minAssertionChars);
  const enoughEssential = matchedEssential.length >= Math.max(1, criteria.minEssentialMatches);
  const connectionOk = !criteria.requireConnection || matchedConnection;
  const hasAlternative = anyPhrase(assertion, ALTERNATIVE_MARKERS) !== null;

  const accepted =
    longEnough && subjectMatched && enoughEssential && connectionOk &&
    misconceptions.length === 0 && !confidentMisinformation;

  let classification: DiscoveryClassification;
  if (accepted) classification = 'established';
  else if (confidentMisinformation) classification = 'confident_misinformation';
  else if (misconceptions.length > 0) classification = 'misconception';
  else if (hasAlternative && !enoughEssential) classification = 'alternative_interpretation';
  else if (subjectMatched || matchedEssential.length > 0 || matchedConnection) classification = 'partial';
  else classification = 'unsupported';

  const essentialTotal = Math.max(1, criteria.essentialConcepts.length);
  const optionalTotal = Math.max(1, criteria.optionalConcepts.length);
  let score =
    (matchedEssential.length / essentialTotal) * 0.55 +
    (matchedOptional.length / optionalTotal) * 0.10 +
    (subjectMatched ? 0.15 : 0) +
    (matchedConnection ? 0.10 : 0) +
    (longEnough ? 0.10 : 0);
  if (misconceptions.length > 0) score -= 0.25;
  if (confidentMisinformation) score -= 0.15;

  const reasons: string[] = [];
  if (!subjectMatched) reasons.push('subject-alias-missing');
  if (!enoughEssential) reasons.push('essential-below-threshold');
  if (!connectionOk) reasons.push('connection-missing');
  if (!longEnough) reasons.push('assertion-too-short');
  if (misconceptions.length > 0) reasons.push('misconception-present');
  if (confidentMisinformation) reasons.push('confident-marker-present');
  if (accepted) reasons.push('deterministic-accept');

  return {
    classification,
    accepted,
    score: countTo4(score),
    matchedEssential,
    matchedOptional,
    missingEssential,
    matchedConnection,
    subjectMatched,
    misconceptions,
    confidentMisinformation,
    reasons,
  };
}
