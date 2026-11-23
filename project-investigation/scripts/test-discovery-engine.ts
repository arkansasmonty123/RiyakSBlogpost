// M7 deterministic discovery-engine tests (pure, no DB).
//
//   npm run test:discovery
//
// Covers eligibility, deterministic evaluation classifications, misconception
// and confident-misinformation handling, bounded LLM advisory safety, memory
// scheduling/mastery, and DTO leakage guards. No canonical truth; no writes.

import { buildEvaluationPrompt, mergeLlmAssessment, parseLlmAssessment } from '../src/discovery-clues/evaluation-prompts';
import { checkClueEligibility, isClueEligible, nextSurfacedClues, orderByDifficulty } from '../src/discovery-clues/eligibility';
import { evaluateSubmission, normalizeText } from '../src/discovery-clues/evaluation';
import { toSafeCitationDTO, toSafeDiscoveryClueDTO } from '../src/discovery-clues/dto';
import { applyRecallOutcome, initialSchedule, isDue, recallKindForContext } from '../src/discovery-clues/memory';
import { sourceUrlForCitation } from '../src/discovery-clues/safety';
import { findDiscoveryClue } from '../src/discovery-clues/registry';
import type {
  DiscoveryClue, DiscoverySubmissionInput, VisibleDiscoveryState,
} from '../src/discovery-clues/types';

let passed = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  passed += 1;
}

function clue(key: string): DiscoveryClue {
  const found = findDiscoveryClue(key);
  if (!found) throw new Error(`Missing authored clue: ${key}`);
  return found;
}

function submission(overrides: Partial<DiscoverySubmissionInput> = {}): DiscoverySubmissionInput {
  return {
    explanation: '',
    subjectIdentification: '',
    connectionExplanation: '',
    uncertainty: '',
    sourceRefs: [],
    confidence: null,
    ...overrides,
  };
}

function baseState(): VisibleDiscoveryState {
  return {
    visibleEvidenceSources: ['fingerprint analysis'],
    completedCheckpoints: [],
    actionsPerformed: ['examine_diamond_case'],
    artifactKeys: ['trace-transfer-and-secondary-transfer'],
    discoveredEvidenceCount: 5,
    acceptedClueKeys: [],
    surfacedClueKeys: [],
  };
}

function testEligibility(): void {
  const target = clue('mh-locard-trace-transfer');
  assert(isClueEligible(target, baseState()), 'clue eligible when all triggers are satisfied');

  const noEvidence: VisibleDiscoveryState = { ...baseState(), visibleEvidenceSources: [] };
  assert(!isClueEligible(target, noEvidence), 'missing visible evidence blocks surfacing');
  const noAction: VisibleDiscoveryState = { ...baseState(), actionsPerformed: [] };
  assert(!isClueEligible(target, noAction), 'missing performed action blocks surfacing');
  const tooFew: VisibleDiscoveryState = { ...baseState(), discoveredEvidenceCount: 1 };
  assert(!isClueEligible(target, tooFew), 'discovered-count floor blocks surfacing');

  const report = checkClueEligibility(target, noEvidence);
  assert(!report.eligible && report.missingEvidence.includes('fingerprint analysis'), 'eligibility report names missing evidence');

  const dependent: DiscoveryClue = {
    ...target,
    key: 'synthetic-dependent',
    triggers: { acceptedDependencies: ['mh-locard-trace-transfer'] },
  };
  assert(!isClueEligible(dependent, baseState()), 'unmet accepted dependency blocks surfacing');
  assert(
    isClueEligible(dependent, { ...baseState(), acceptedClueKeys: ['mh-locard-trace-transfer'] }),
    'accepted dependency unlocks surfacing',
  );

  const second = { ...target, key: 'synthetic-second' };
  const surfaced = nextSurfacedClues([target, second], baseState(), 1);
  assert(surfaced.length === 1 && surfaced[0]?.key === target.key, 'nextSurfacedClues respects the limit');
  assert(
    nextSurfacedClues([target], { ...baseState(), surfacedClueKeys: [target.key] }, 2).length === 0,
    'already surfaced clues are not repeated',
  );

  const ordered = orderByDifficulty([
    { ...target, key: 'advanced', difficulty: 'advanced' },
    { ...target, key: 'foundational', difficulty: 'foundational' },
  ]);
  assert(ordered[0]?.key === 'foundational', 'orderByDifficulty is deterministic');
}

function testEvaluation(): void {
  const target = clue('mh-locard-trace-transfer');

  const correct = evaluateSubmission(target, submission({
    subjectIdentification: "Locard's exchange principle",
    explanation:
      'When people and surfaces come into contact, trace material is transferred in both directions: something is left behind and something is carried away.',
    connectionExplanation:
      'In this case the fingerprint analysis can show contact with the display, but it cannot establish when that contact happened or how long it lasted.',
    confidence: 'high',
  }));
  assert(correct.classification === 'established', 'complete concept answer classifies as established');
  assert(correct.accepted && correct.score > 0.7, 'complete concept answer is accepted with a high score');
  assert(correct.matchedEssential.length >= 3, 'all essential concepts matched');

  const partial = evaluateSubmission(target, submission({
    subjectIdentification: 'the exchange principle',
    explanation: 'It is relevant to thinking about the display case and the evidence record in this investigation.',
  }));
  assert(partial.classification === 'partial', 'subject-only answer classifies as partial');
  assert(!partial.accepted, 'partial answer is not accepted');

  const alternative = evaluateSubmission(target, submission({
    subjectIdentification: 'the exchange principle',
    explanation: 'An alternative reading could also fit the record here, as another explanation of the trace.',
    connectionExplanation: 'in this case',
  }));
  assert(alternative.classification === 'alternative_interpretation', 'alternative reading is classified distinctly');
  assert(!alternative.accepted, 'alternative reading is not accepted');

  const misconception = evaluateSubmission(target, submission({
    subjectIdentification: "Locard's exchange principle",
    explanation: 'Trace proves guilt, so the contact alone proves it in this case.',
    connectionExplanation: 'the fingerprint analysis shows this',
  }));
  assert(misconception.classification === 'misconception', 'misconception is detected');
  assert(!misconception.accepted && misconception.misconceptions.length > 0, 'misconception blocks acceptance');

  const confident = evaluateSubmission(target, submission({
    subjectIdentification: "Locard's exchange principle",
    explanation: 'Trace proves guilt, definitely, and contact alone proves it in this case without a doubt.',
    connectionExplanation: 'the fingerprint analysis shows this',
  }));
  assert(confident.classification === 'confident_misinformation', 'confident misinformation is classified distinctly');
  assert(confident.confidentMisinformation && !confident.accepted, 'confident misinformation blocks acceptance');

  const negated = evaluateSubmission(target, submission({
    subjectIdentification: "Locard's exchange principle",
    explanation:
      'It is not true that trace proves guilt by itself. Contact transfers material both ways, and the trace cannot establish when it happened.',
    connectionExplanation: 'this case needs the display record',
  }));
  assert(negated.misconceptions.length === 0, 'negated misconception mention does not count against the answer');
  assert(negated.accepted, 'negated misconception can still reach acceptance');

  const hedged = evaluateSubmission(target, submission({
    subjectIdentification: "Locard's exchange principle",
    explanation:
      'Contact transfers material both ways and the trace cannot establish when it happened in this case.',
    uncertainty: 'trace proves guilt',
  }));
  assert(hedged.accepted, 'uncertainty text is excluded from assertion matching');

  assert(normalizeText("Locard's  EXCHANGE—principle!") === 'locard s exchange principle', 'normalization is stable');
}

function testPrompts(): void {
  const target = clue('mh-locard-trace-transfer');
  const candidate = submission({
    subjectIdentification: "Locard's exchange principle",
    explanation: 'Contact transfers material both ways and the trace cannot establish when it happened in this case.',
  });
  const prompt = buildEvaluationPrompt(target, candidate);
  assert(prompt.includes(candidate.explanation), 'prompt contains bounded player text');
  assert(!prompt.includes('minEssentialMatches') && !prompt.includes('misconceptionTerms'), 'prompt omits answer criteria');
  assert(!prompt.includes(target.correctedUnderstanding), 'prompt omits corrected understanding');
  assert(!prompt.includes('without a doubt'), 'prompt omits internal confident-marker vocabulary');

  const advisory = parseLlmAssessment(
    '{"classificationHint":"established","accepted":true,"conceptsAddressed":["contact"],"concerns":["timing"],"notes":"advisory"}',
  );
  assert(advisory !== null && advisory.classificationHint === 'established', 'advisory JSON parses');
  assert(parseLlmAssessment('not json') === null, 'malformed advisory JSON is rejected');

  const deterministic = evaluateSubmission(target, submission({
    subjectIdentification: 'the exchange principle',
    explanation: 'It is relevant to thinking about the display case and the evidence record in this investigation.',
  }));
  const merged = mergeLlmAssessment(deterministic, advisory);
  assert(!merged.accepted, 'LLM advisory can never grant acceptance');
  assert(merged.classification === deterministic.classification, 'LLM advisory cannot change classification');
  assert(merged.llmAdvisory?.notes === 'advisory', 'advisory notes are retained for display');
}

function testMemory(): void {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const initial = initialSchedule(now);
  assert(initial.intervalDays === 2 && initial.masteryStatus === 'new', 'new items start at +2 days');
  assert(initial.nextDueAt === '2026-01-03T00:00:00.000Z', 'initial due date is exact');

  const success = applyRecallOutcome(
    { intervalDays: 2, masteryStatus: 'new', successfulRecalls: 1, failedRecalls: 0, distinctContexts: 1 },
    'success', now,
  );
  assert(success.intervalDays === 4 && success.masteryStatus === 'developing', 'success grows interval and mastery');

  const capped = applyRecallOutcome(
    { intervalDays: 50, masteryStatus: 'proficient', successfulRecalls: 5, failedRecalls: 0, distinctContexts: 3 },
    'success', now,
  );
  assert(capped.intervalDays === 60, 'success interval is capped at 60 days');

  const partial = applyRecallOutcome(
    { intervalDays: 10, masteryStatus: 'developing', successfulRecalls: 2, failedRecalls: 0, distinctContexts: 1 },
    'partial', now,
  );
  assert(partial.intervalDays === 13, 'partial recall increases the interval slightly');

  const missed = applyRecallOutcome(
    { intervalDays: 30, masteryStatus: 'proficient', successfulRecalls: 4, failedRecalls: 1, distinctContexts: 2 },
    'missed', now,
  );
  assert(missed.intervalDays === 1, 'missed recall resets the interval to one day');
  assert(missed.masteryStatus === 'proficient', 'missed recall does not downgrade mastery');

  const proficient = applyRecallOutcome(
    { intervalDays: 4, masteryStatus: 'developing', successfulRecalls: 3, failedRecalls: 0, distinctContexts: 2 },
    'success', now,
  );
  assert(proficient.masteryStatus === 'proficient', 'mastery needs successes across distinct contexts');

  const mastered = applyRecallOutcome(
    { intervalDays: 30, masteryStatus: 'proficient', successfulRecalls: 6, failedRecalls: 2, distinctContexts: 3 },
    'success', now,
  );
  assert(mastered.masteryStatus === 'mastered', 'sustained cross-case success reaches mastery');

  assert(isDue(null, now), 'unscheduled memory items are due');
  assert(!isDue('2026-02-01T00:00:00.000Z', now), 'future due dates are not due');
  assert(recallKindForContext({ isInitial: true, sameCase: true, sameClue: true }) === 'initial_check', 'initial recall kind');
  assert(recallKindForContext({ isInitial: false, sameCase: false, sameClue: false }) === 'cross_case_application', 'cross-case recall kind');
  assert(recallKindForContext({ isInitial: false, sameCase: true, sameClue: false }) === 'delayed_recall', 'delayed recall kind');
}

function testDtoSafety(): void {
  const target = clue('mh-locard-trace-transfer');
  const before = toSafeDiscoveryClueDTO(target, { accepted: false, leakageTerms: ['Victor Sterling'] });
  assert(before.correctedUnderstanding === null, 'DTO hides corrected understanding before acceptance');
  const serialized = JSON.stringify(before);
  assert(!serialized.includes('minEssentialMatches'), 'DTO hides acceptance thresholds');
  assert(!serialized.includes('confidentMarkers'), 'DTO hides misconception vocabulary');
  assert(!serialized.includes('leakageTerms'), 'DTO hides leakage guard list');
  assert(!serialized.includes('Victor Sterling'), 'DTO hides the case leakage term');

  const after = toSafeDiscoveryClueDTO(target, { accepted: true, leakageTerms: ['Victor Sterling'] });
  assert(after.correctedUnderstanding === target.correctedUnderstanding, 'accepted DTO exposes pedagogic correction');
  assert(!JSON.stringify(after).includes('Victor Sterling'), 'accepted DTO still hides leakage terms');

  const unverified = toSafeCitationDTO(target.citations[0]!);
  assert(unverified.sourceUrl === null && !unverified.sourceVerified, 'unverified citation exposes no URL');

  const verifiedSource = {
    ...target.citations[0]!,
    sourceUrl: 'https://example.org/reference',
    sourceVerified: true,
    verificationStatus: 'verified' as const,
  };
  assert(sourceUrlForCitation(verifiedSource) === 'https://example.org/reference', 'verified source may expose URL');
  assert(
    sourceUrlForCitation({ ...verifiedSource, verificationStatus: 'pending_review' }) === null,
    'verification status gate suppresses URL',
  );
  assert(
    sourceUrlForCitation({ ...verifiedSource, sourceUrl: 'javascript:alert(1)' }) === null,
    'non-http URL is suppressed',
  );
}

function main(): void {
  console.log('M7 Discovery engine deterministic tests\n');
  testEligibility();
  console.log('  eligibility: PASS');
  testEvaluation();
  console.log('  evaluation: PASS');
  testPrompts();
  console.log('  evaluation prompts: PASS');
  testMemory();
  console.log('  memory scheduling: PASS');
  testDtoSafety();
  console.log('  DTO safety: PASS');
  console.log(`\nTEST DISCOVERY: PASS (${passed} assertions)`);
}

try {
  main();
} catch (error) {
  console.error('TEST DISCOVERY: FAIL');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
