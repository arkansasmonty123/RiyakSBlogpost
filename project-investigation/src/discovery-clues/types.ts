/**
 * M7 Real-World Discovery & Knowledge Retention Engine — shared authoring types.
 *
 * HARD INVARIANTS:
 * - No canonical_truth import/read. No culprit, hidden evidence, canonical
 *   solution, or secret release condition lives in this module.
 * - Authoring definitions are SERVER-ONLY. Acceptance criteria (aliases,
 *   thresholds, misconceptions) and correctedUnderstanding must never be
 *   exposed by a public DTO before acceptance.
 * - Source URLs are allowed only for human-verified sources. Showcase content
 *   ships with sourceUrl: null, sourceVerified: false, pending_review.
 * - Accepted unlocks are pre-authored. They never release evidence directly:
 *   evidence_discoveries and mystery-engine.processProgression remain the only
 *   evidence-release authority.
 */

export const DISCOVERY_REFERENCE_CATEGORIES = [
  'scientific_principle',
  'methodology_caution',
  'professional_standard',
  'legal_procedure',
  'historical_context',
  'in_world_document',
] as const;
export type DiscoveryReferenceCategory = typeof DISCOVERY_REFERENCE_CATEGORIES[number];

export const DISCOVERY_SOURCE_TYPES = [
  'government_guidance',
  'standards_body',
  'peer_reviewed',
  'reputable_org',
  'textbook',
  'legal_reference',
  'in_world_document',
  'other',
] as const;
export type DiscoverySourceType = typeof DISCOVERY_SOURCE_TYPES[number];

/** Closed union of deterministic submission classifications. */
export const DISCOVERY_CLASSIFICATIONS = [
  'established',
  'partial',
  'alternative_interpretation',
  'unsupported',
  'misconception',
  'confident_misinformation',
] as const;
export type DiscoveryClassification = typeof DISCOVERY_CLASSIFICATIONS[number];

export const DIFFICULTIES = ['foundational', 'intermediate', 'advanced'] as const;
export type Difficulty = typeof DIFFICULTIES[number];

/** Epistemic status of the authored real-world subject (not verification). */
export const KNOWLEDGE_STATUSES = ['established', 'contested', 'debated', 'uncertain'] as const;
export type KnowledgeStatus = typeof KNOWLEDGE_STATUSES[number];

export const MASTERY_STATUSES = ['new', 'developing', 'proficient', 'mastered'] as const;
export type MasteryStatus = typeof MASTERY_STATUSES[number];

export const VERIFICATION_STATUSES = [
  'draft', 'pending_review', 'verified', 'rejected', 'needs_reverification',
] as const;
export type VerificationStatus = typeof VERIFICATION_STATUSES[number];

export const PACK_STATUSES = ['draft', 'pending_review', 'verified', 'needs_reverification'] as const;
export type PackStatus = typeof PACK_STATUSES[number];

export const UNLOCK_KINDS = [
  'insight', 'question', 'specialist_response', 'reinterpretation',
  'reality_map_seed', 'action',
] as const;
export type UnlockKind = typeof UNLOCK_KINDS[number];

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number];

export const RECALL_KINDS = [
  'initial_check', 'delayed_recall', 'cross_case_application', 'reinforcement',
] as const;
export type RecallKind = typeof RECALL_KINDS[number];

// ---------------------------------------------------------------------------
// Authoring shapes
// ---------------------------------------------------------------------------

/** A real-world (or in-world) reference. Never a fabricated URL. */
export interface DiscoveryCitation {
  label: string;
  bibliographyRef: string;
  /** Always null until a human records a real, verified URL. */
  sourceUrl: string | null;
  sourceVerified: boolean;
  verificationStatus: VerificationStatus;
  sourceType: DiscoverySourceType;
  verificationNotes: string;
}

/** Server-only acceptance vocabulary. Never sent to clients. */
export interface ConceptCriterion {
  key: string;
  aliases: readonly string[];
}

export interface ConceptCriteria {
  /** Identifier phrases for the subject itself (e.g. "Locard", "exchange principle"). */
  subjectAliases: readonly string[];
  essentialConcepts: readonly ConceptCriterion[];
  optionalConcepts: readonly ConceptCriterion[];
  /** Phrases showing the player connected the idea to this case. */
  connectionMarkers: readonly string[];
  /** Blocking misconceptions; negated mentions are ignored by the evaluator. */
  misconceptionTerms: readonly string[];
  /** Certainty phrases that upgrade a misconception to confident misinformation. */
  confidentMarkers: readonly string[];
  minEssentialMatches: number;
  requireConnection: boolean;
  minAssertionChars: number;
}

/** All refs are stable human-readable strings, never database UUIDs. */
export interface DiscoveryTrigger {
  visibleEvidence?: readonly string[];   // evidence.source refs
  completedCheckpoints?: readonly string[];
  actionsPerformed?: readonly string[];
  artifactKeys?: readonly string[];
  minDiscoveredEvidence?: number;
  acceptedDependencies?: readonly string[]; // clue keys within the same package
}

interface UnlockBase {
  key: string;
  /** Evidence source, specialist key, or authored case action — never a UUID. */
  targetRef: string;
}

/** Closed union of pre-authored unlock payloads. */
export type DiscoveryUnlock =
  | (UnlockBase & { kind: 'insight'; insight: string; followUp: string })
  | (UnlockBase & { kind: 'question'; question: string; whyItMatters: string })
  | (UnlockBase & { kind: 'specialist_response'; specialistKey: string; prompt: string })
  | (UnlockBase & { kind: 'reinterpretation'; fromReading: string; toReading: string })
  | (UnlockBase & { kind: 'reality_map_seed'; title: string; description: string })
  | (UnlockBase & { kind: 'action'; action: string; label: string });

export interface DiscoveryClue {
  key: string;
  /** Stable memory subject key reused across cases. */
  subjectKey: string;
  subjectLabel: string;
  referenceCategory: DiscoveryReferenceCategory;
  difficulty: Difficulty;
  knowledgeStatus: KnowledgeStatus;
  title: string;
  prompt: string;
  context: string;
  triggers: DiscoveryTrigger;
  /** SERVER-ONLY. Contains aliases, thresholds and misconception terms. */
  criteria: ConceptCriteria;
  /** SERVER-ONLY until acceptance. Pedagogic correction, never a case solution. */
  correctedUnderstanding: string;
  citations: readonly DiscoveryCitation[];
  unlocks: readonly DiscoveryUnlock[];
  evidenceRefs: readonly string[];
  specialistKeys: readonly string[];
  /** Server-only leakage guard terms (e.g. canonical culprit name). */
  leakageTerms?: readonly string[];
}

export interface DiscoveryCluePackage {
  caseTitle: string;
  packageKey: string;
  version: string;
  status: PackStatus;
  summary: string;
  /** Server-only leakage guard list; NEVER exposed in a DTO. */
  leakageTerms: readonly string[];
  clues: readonly DiscoveryClue[];
}

/** Registry surface consumed by seeder, validator, tests and future engine. */
export interface DiscoveryClueRegistry {
  packages: readonly DiscoveryCluePackage[];
  getByCaseTitle(caseTitle: string): DiscoveryCluePackage | undefined;
  getByKey(packageKey: string): DiscoveryCluePackage | undefined;
  getClueByKey(clueKey: string): DiscoveryClue | undefined;
}

/** Node in a user's cross-case knowledge graph (relationship is pedagogic). */
export interface MemoryLink {
  fromSubjectKey: string;
  toSubjectKey: string;
  relationship: string;
  rationale: string;
}

// ---------------------------------------------------------------------------
// Engine input/output shapes (pure modules; no DB rows)
// ---------------------------------------------------------------------------

/** Read-only snapshot of everything eligibility is allowed to consider. */
export interface VisibleDiscoveryState {
  visibleEvidenceSources: readonly string[];
  completedCheckpoints: readonly string[];
  actionsPerformed: readonly string[];
  artifactKeys: readonly string[];
  discoveredEvidenceCount: number;
  acceptedClueKeys: readonly string[];
  surfacedClueKeys: readonly string[];
}

export interface DiscoverySubmissionInput {
  explanation: string;
  subjectIdentification: string;
  connectionExplanation: string;
  uncertainty: string;
  sourceRefs: readonly string[];
  confidence: ConfidenceLevel | null;
}

export interface EvaluationResult {
  classification: DiscoveryClassification;
  /** Set only by deterministic evaluation; LLM advisory output cannot change it. */
  accepted: boolean;
  score: number;
  matchedEssential: readonly string[];
  matchedOptional: readonly string[];
  missingEssential: readonly string[];
  matchedConnection: boolean;
  subjectMatched: boolean;
  misconceptions: readonly string[];
  confidentMisinformation: boolean;
  /** Internal reason codes; public DTOs strip these. */
  reasons: readonly string[];
}

export interface MemoryRecallInput {
  intervalDays: number;
  masteryStatus: MasteryStatus;
  successfulRecalls: number;
  failedRecalls: number;
  distinctContexts: number;
}

export interface MemoryScheduleDecision {
  intervalDays: number;
  nextDueAt: string;
  masteryStatus: MasteryStatus;
}
