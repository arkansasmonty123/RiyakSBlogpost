/**
 * Thin, typed client for the THE INVESTIGATION API.
 *
 * All requests use the httpOnly cookie session (credentials: 'include').
 * This module never receives canonical truth data - the server only ever
 * returns player-visible projections, which is what these types describe.
 */

export class ApiError extends Error {
  readonly status: number;
  /** Structured error body (e.g. readiness / cooldown details from PROD-010). */
  readonly details: Record<string, unknown> | null;
  /** Retry-After response header, in seconds, when present. */
  readonly retryAfterSeconds: number | null;

  constructor(
    status: number,
    message: string,
    details: Record<string, unknown> | null = null,
    retryAfterSeconds: number | null = null
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
    res = await fetch(path, { credentials: 'include', ...init, headers });
  } catch {
    throw new ApiError(0, 'Network error. Please check your connection.');
  }

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const details =
      data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : null;
    const message =
      details && 'error' in details
        ? String(details.error)
        : `Request failed (${res.status})`;
    const retryRaw = res.headers.get('Retry-After');
    const retryAfterSeconds = retryRaw && Number.isFinite(Number(retryRaw))
      ? Number(retryRaw)
      : null;
    throw new ApiError(res.status, message, details, retryAfterSeconds);
  }
  return data as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

/** Fetch a text response (used by the Markdown notebook export). */
async function requestText(path: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: 'include' });
  } catch {
    throw new ApiError(0, 'Network error. Please check your connection.');
  }
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    const details = data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
    const message = details && 'error' in details ? String(details.error) : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, details);
  }
  return res.text();
}

// --- Player-facing domain types ------------------------------------------------

export interface Case {
  id: string;
  title: string;
  description?: string;
  genre?: string;
  difficulty?: string;
  duration?: string;
  briefing?: string;
  objectives?: string;
  initialCharacters?: unknown;
  initialFacts?: unknown;
}

export interface Evidence {
  id: string;
  caseId: string;
  category: string;
  source: string;
  description: string;
  reliability: string;
  associatedCharacters?: string[];
  timelineReference?: string;
  playerVisible: boolean;
  discoveryOrder?: number;
}

// PROD-013 (GAP-08): server-projected suspect profile. Contains only public
// character data plus investigation context the player is entitled to see.
// Internal fields (knowledge/beliefs/secrets/hidden interpretation, AI
// direction, canonical truth) are never part of this DTO.
export interface SuspectRelationship {
  name: string;
  label: string;
}

export interface SuspectLinkedEvidence {
  id: string;
  source: string;
  category: string;
  timelineReference?: string;
  examined: boolean;
}

export interface Suspect {
  id: string;
  caseId: string;
  name: string;
  role: string;
  personality?: string;
  background?: string;
  alibi?: string;
  confirmedAlibi?: string;
  motive: string;
  relationships: SuspectRelationship[];
  linkedEvidence: SuspectLinkedEvidence[];
  linkedEvidenceCount: number;
  playerSuspicion: string | null;
  unansweredQuestions: string[];
}

export interface SuspectBoard {
  caseId: string;
  openQuestions: string[];
  suspects: Suspect[];
}

export interface Investigation {
  id: string;
  userId?: string;
  caseId: string;
  status?: string;
  progress?: number;
  currentStage?: string;
  currentTheory?: string;
  suspicionLevel?: string;
  discoveredEvidenceIds?: string[];
  completionTimestamp?: string;
  startTimestamp?: string;
  updatedAt?: string;
  // PROD-010: server-owned verdict integrity state (read-only for the client).
  accusationAttempts?: number;
  lastAccusationAt?: string;
  accusationCooldownUntil?: string;
}

// --- M2 Knowledge system (player-safe projections; no canonical data) -------

export type KnowledgeIntent =
  | 'explain'
  | 'deeper'
  | 'relevance'
  | 'challenge'
  | 'alternatives'
  | 'discriminate'
  | 'sources'
  | 'simpler'
  | 'critique';

export type KnowledgeDepth = 'plain' | 'working' | 'technical';

export interface DepthGuidance {
  plain?: string;
  working?: string;
  technical?: string;
  [key: string]: unknown;
}

export interface PublicSpecialist {
  id: string;
  specialistKey: string;
  name: string;
  title: string;
  specialization: string;
  discipline: string;
  knowledgeDomains: string[];
  personality: string;
  communicationStyle: string;
  reasoningApproach: string;
  expertiseSummary: string;
  limitations: string[];
  depthGuidance: DepthGuidance;
  isFictional: boolean;
  realDisciplineBasis: string;
  caseRelevance: string;
  displayOrder: number;
}

export type VerificationStatus =
  | 'draft'
  | 'pending_review'
  | 'verified'
  | 'rejected'
  | 'needs_reverification';

export type SourceType =
  | 'government_guidance'
  | 'standards_body'
  | 'peer_reviewed'
  | 'reputable_org'
  | 'textbook'
  | 'news'
  | 'legal_reference'
  | 'in_world_document'
  | 'other';

export interface ArtifactDepthContent {
  plain?: string;
  working?: string;
  technical?: string;
}

export interface PublicArtifactSummary {
  id: string;
  artifactKey: string;
  title: string;
  artifactType: string;
  description: string;
  specialistKey: string;
  knowledgeClass: string;
  reliability: string;
  sourceAuthor: string;
  /** Null unless sourceVerified AND verificationStatus === 'verified'. */
  sourceUrl: string | null;
  bibliographyRef: string;
  publicationDate: string;
  sourceVerified: boolean;
  isFictional: boolean;
  relatedConcepts: string[];
  // M3 provenance / pedagogy fields.
  sourceType: SourceType | null;
  verificationStatus: VerificationStatus;
  verificationNotes: string;
  lastVerifiedAt: string | null;
  claimsSupported: string[];
  learningObjectives: string[];
  relatedEvidenceRefs: string[];
  suggestedConversations: string[];
  depthContent: ArtifactDepthContent;
}

/** M3 per-case pack metadata with simple content counts (no canonical data). */
export interface PublicCaseKnowledgePack {
  id: string;
  caseId: string;
  version: string;
  packStatus: 'draft' | 'pending_review' | 'verified' | 'needs_reverification';
  learningObjectives: string[];
  summary: string;
  createdAt?: string;
  updatedAt?: string;
  counts: {
    specialists: number;
    artifacts: number;
    disagreements: number;
  };
}

export interface NotebookExport {
  caseTitle: string;
  investigationId: string;
  exportedAt: string;
  entries: PublicNotebookEntry[];
}

export interface PublicArtifactDetail extends PublicArtifactSummary {
  content: string;
  usageNote: string;
}

export interface PublicDisagreement {
  id: string;
  disagreementKey: string;
  topic: string;
  specialistAKey: string;
  specialistBKey: string;
  specialistAName: string;
  specialistBName: string;
  positionA: string;
  positionB: string;
  disciplinaryBasis: string;
  uncertaintyNote: string;
  distinguishingEvidence: string;
  relatedArtifactKeys: string[];
}

export type NotebookEntryType =
  | 'observation'
  | 'fact'
  | 'suspicion'
  | 'theory'
  | 'question'
  | 'rejected'
  | 'contradiction'
  | 'note';

export interface NotebookSourceSnapshot {
  id?: string;
  artifactKey?: string;
  title?: string;
  artifactType?: string;
  description?: string;
  specialistKey?: string;
  knowledgeClass?: string;
  reliability?: string;
  sourceAuthor?: string;
  sourceUrl?: string | null;
  bibliographyRef?: string;
  publicationDate?: string;
  sourceVerified?: boolean;
  verificationStatus?: VerificationStatus;
  verificationNotes?: string;
  sourceType?: SourceType | null;
  claimsSupported?: string[];
  relatedEvidenceRefs?: string[];
  isFictional?: boolean;
  relatedConcepts?: string[];
  contentExcerpt?: string;
  usageNote?: string;
  [key: string]: unknown;
}

export interface PublicNotebookEntry {
  id: string;
  investigationId: string;
  entryType: NotebookEntryType | string;
  artifactId: string | null;
  specialistId: string | null;
  concept: string;
  title: string;
  content: string;
  sourceSnapshot: NotebookSourceSnapshot;
  // M7 discovery provenance (present when saved from a discovery/memory context).
  discoveryMemoryId?: string | null;
  discoveryClueKey?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatMessage {
  role: string;
  content: string;
  timestamp: string;
  // PROD-014: the server-selected team voice for investigator replies.
  teamRole?: string;
  responderLabel?: string;
  // M2: present when the reply came from a specialist persona.
  specialistKey?: string;
  specialistName?: string;
  intent?: KnowledgeIntent;
  depth?: KnowledgeDepth;
}

export interface JournalEntry {
  id: string;
  investigationId?: string;
  entryType: string;
  content: string;
  relatedEvidenceIds?: string[];
  isConfirmed?: boolean;
  creationTimestamp?: string;
}

export interface ScheduledEvent {
  id: string;
  investigationId?: string;
  eventType: string;
  scheduledTimestamp?: string;
  releaseStatus?: string;
  associatedEvidence?: string;
  narrativePayload?: unknown;
}

export interface Accusation {
  id: string;
  investigationId?: string;
  submittedCulprit: string;
  motive: string;
  method: string;
  supportingEvidence?: string[];
  evaluationResult?: string;
  submissionTimestamp?: string;
}

// --- Async progression (PROD-008) --------------------------------------------
// All fields below are player-safe projections. Canonical truth, hidden
// interpretations and hypothesis tags are never part of these DTOs.

export interface Checkpoint {
  id: string;
  prompt: string;
  completed: boolean;
}

export interface InvestigationActionView {
  action: string;
  label: string;
  performed?: boolean;
}

export interface CheckpointState {
  checkpoints: Checkpoint[];
  actions: InvestigationActionView[];
  completedCheckpoints: string[];
  pendingDevelopments: number;
}

export interface Development {
  id: string;
  kind: string;
  message: string;
  evidenceId: string | null;
  createdAt: string;
}

// GAP-14 (P2): MVP in-app notification preference. Stored server-side in the
// user's notification_settings column; no push/email and no hidden/canonical
// data is ever part of this DTO.
export interface NotificationSettings {
  developments: boolean;
}

export interface ReleasedEvidence {
  id: string;
  source: string;
  category: string;
  description: string;
  reliability: string;
  playerVisible: boolean;
  timelineReference?: string;
}

export interface ProgressionResult {
  newlyReleased: ReleasedEvidence[];
  developments: Development[];
  processedEvents: string[];
  pendingCount: number;
}

export interface TheoryResult extends ProgressionResult {
  checkpointId: string;
  result: 'plausible' | 'unsupported';
  feedback: string[];
  completedCheckpoints: string[];
}

export type VerdictOutcome = 'correct' | 'incorrect' | 'partial';

export interface VerdictResult {
  valid: boolean;
  evaluationResult: VerdictOutcome;
  message: string;
  caseId?: string;
  culprit?: string;
  motive?: string;
  method?: string;
  submittedCulprit?: string;
  submittedMotive?: string;
  submittedMethod?: string;
  supportingEvidenceCount?: number;
  canonicalTruthConfigured?: boolean;
  // PROD-010: integrity status. Feedback is intentionally generic and never
  // contains canonical motive/method text.
  status?: 'evaluated' | 'not_ready' | 'cooldown' | 'completed';
  attempts?: number;
  cooldownUntil?: string | null;
  retryAfterSeconds?: number;
  readiness?: {
    ready: boolean;
    completedCheckpoints: number;
    requiredCheckpoints: number;
  };
}

export interface ArchiveItem {
  id: string;
  caseId: string;
  caseTitle?: string;
  status: string;
  progress?: number;
  startTimestamp?: string;
  completionTimestamp?: string;
  updatedAt?: string;
  evaluationResult?: string;
}

// --- Investigation stats (P2-POLISH) ----------------------------------------
// Compact, player-safe summary for an owned investigation. All fields are
// counts, percentages, status labels or timestamps derived from this player's
// own data; the server never reads canonical truth to build this DTO.
export interface InvestigationStats {
  evidence: { discovered: number; total: number };
  accusations: number;
  checkpoints: { answered: number; total: number };
  achievements: number;
  progress: number;
  status: string | null;
  elapsedSeconds: number;
  startedAt: string | null;
  completedAt: string | null;
}

// --- Achievements (GAP-13) ----------------------------------------------------
// Read-only projection of a server-awarded achievement. The client never picks
// or awards an achievement type - that is enforced server-side - and this DTO
// carries no canonical/hidden data.
export interface Achievement {
  id: string;
  investigationId?: string;
  achievementType: string;
  unlockedAt?: string;
}

// --- M8-6 personal progress ------------------------------------------------
// Private, player-safe summary derived from the signed-in user's own activity.
// No XP/levels/streaks/leaderboards and no canonical or hidden case data.

export interface ProgressMilestone {
  key: string;
  label: string;
  description: string;
  achieved: boolean;
}

export interface ProgressSuggestion {
  caseId: string;
  title: string;
  genre: string | null;
  difficulty: string | null;
  duration: string | null;
  reason: string;
}

export interface ProgressDTO {
  generatedAt: string;
  disclaimer: string;
  investigations: {
    completed: number;
    abandoned: number;
    active: number;
    paused: number;
    total: number;
    distinctCasesPlayed: number;
  };
  knowledge: {
    discoveriesAccepted: number;
    memoryItems: number;
    mastery: { new: number; developing: number; proficient: number; mastered: number };
    dueRecall: number;
    crossCaseApplications: number;
    successfulRecalls: number;
  };
  openThreads: {
    unresolvedQuestions: number;
    followUpApplications: number;
    samples: string[];
  };
  milestones: ProgressMilestone[];
  recentActivity: {
    windowDays: number;
    newMemoryItems: number;
    completedCases: number;
    acceptedDiscoveries: number;
    newNotifications: number;
  };
  suggestions: ProgressSuggestion[];
}

// --- Reality Map (M4) --------------------------------------------------------
// Player-owned reasoning workspace. All data is scoped to the player's own
// investigation and contains no canonical truth or hidden evidence.

export type RealityClaimCategory =
  | 'factual_observation'
  | 'interpretation'
  | 'assumption'
  | 'causal_explanation'
  | 'motive'
  | 'timeline_assertion'
  | 'unresolved_question';

export type RealityConfidence =
  | 'high_confidence'
  | 'moderate_confidence'
  | 'low_confidence'
  | 'insufficient_information';

export type RealityHypothesisStatus = 'active' | 'weakened' | 'strengthened' | 'archived';

export type RealityRelationship =
  | 'supports'
  | 'contradicts'
  | 'contextualizes'
  | 'weakens'
  | 'unrelated_inconclusive'
  | 'included';

export type RealityMaterialType =
  | 'evidence'
  | 'artifact'
  | 'journal_entry'
  | 'notebook_entry'
  | 'specialist'
  | 'character';

export type RealityLinkTargetType = RealityMaterialType | 'claim' | 'hypothesis';
export type RealityLinkOwnerType = 'claim' | 'hypothesis';

export type RealityReviewFocus = 'assumptions' | 'discriminate' | 'alternatives' | 'falsify' | 'critique';
export type RealityProvenance =
  | 'established_fact'
  | 'player_interpretation'
  | 'specialist_opinion'
  | 'unverified_assumption'
  | 'ai_suggestion';

export interface RealityClaim {
  id: string;
  investigationId: string;
  title: string;
  description: string;
  claimCategory: RealityClaimCategory;
  confidence: RealityConfidence;
  notes: string;
  sourceJournalEntryId: string | null;
  sourceNotebookEntryId: string | null;
  isTutorial: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RealityHypothesis {
  id: string;
  investigationId: string;
  name: string;
  explanation: string;
  status: RealityHypothesisStatus;
  confidence: RealityConfidence;
  missingInformation: string;
  alternativeExplanations: string;
  playerNotes: string;
  isTutorial: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RealityLink {
  id: string;
  investigationId: string;
  ownerType: RealityLinkOwnerType;
  ownerId: string;
  targetType: RealityLinkTargetType;
  targetId: string;
  relationship: RealityRelationship;
  rationale: string;
  ownerLabel: string;
  targetLabel: string;
  targetSubLabel: string;
  isTutorial: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RealityMaterialItem {
  id: string;
  type: RealityLinkTargetType;
  label: string;
  subLabel: string;
}

export interface RealityMaterials {
  evidence: RealityMaterialItem[];
  artifacts: RealityMaterialItem[];
  specialists: RealityMaterialItem[];
  characters: RealityMaterialItem[];
  journalEntries: RealityMaterialItem[];
  notebookEntries: RealityMaterialItem[];
}

export interface RealityTension {
  id: string;
  kind: 'material_conflict' | 'claim_conflict' | 'hypothesis_conflict';
  label: string;
  description: string;
  claimIds: string[];
  hypothesisIds: string[];
  materialRef: string;
}

export interface RealityPrompt {
  text: string;
  claimCategoryHint?: string;
}

export interface RealityMapLimits {
  claims: { used: number; max: number };
  hypotheses: { used: number; max: number };
  links: { used: number; max: number };
}

export interface RealityMapSnapshot {
  caseId: string;
  investigationId: string;
  investigationStatus: string;
  claims: RealityClaim[];
  hypotheses: RealityHypothesis[];
  links: RealityLink[];
  tensions: RealityTension[];
  materials: RealityMaterials;
  reasoningPrompts: RealityPrompt[];
  tutorialAvailable: boolean;
  tutorialPresent: boolean;
  limits: RealityMapLimits;
}

export interface RealityAuditSource {
  claimId?: string;
  hypothesisId?: string;
  materialRef?: string;
}

export interface RealityAuditItem {
  id: string;
  text: string;
  provenance: RealityProvenance;
  sources: RealityAuditSource;
}

export interface RealityAuditSection {
  key: string;
  title: string;
  items: RealityAuditItem[];
}

export interface RealityReasoningAudit {
  sections: RealityAuditSection[];
  provenanceLegend: Record<string, string>;
  disclaimer: string;
  counts: Record<string, number>;
  aiSummary: string;
}

export interface RealityHypothesisComparison {
  hypotheses: Array<{
    id: string;
    name: string;
    status: RealityHypothesisStatus;
    confidence: RealityConfidence;
    includedClaimIds: string[];
  }>;
  sharedClaimIds: string[];
  divergences: Array<{ claimId: string; presentIn: string[]; absentIn: string[] }>;
  questions: string[];
  disclaimer: string;
}

export interface RealitySpecialistReview {
  content: string;
  specialistKey: string;
  specialistName: string;
  focus: RealityReviewFocus;
  limitations: string[];
  provenance: 'specialist_opinion';
  disclaimer: string;
  compareWithHypothesisId?: string;
  targetSpecialistKey?: string;
}

export interface RealityTutorialResponse {
  claims: RealityClaim[];
  hypotheses: RealityHypothesis[];
  links: RealityLink[];
}

// --- Perspective Engine (M5) -------------------------------------------------
// Advisory, player-owned perspective content. Perspectives are never evidence,
// never affect verdicts, never reveal canonical truth, and never auto-modify
// Reality Map claims/confidence. All endpoints are auth-gated.

export type PerspectiveFormat =
  | 'philosophical_parable'
  | 'thought_experiment'
  | 'ethical_dilemma'
  | 'psychological_demonstration'
  | 'historical_episode'
  | 'scientific_controversy'
  | 'spiritual_teaching'
  | 'competing_arguments'
  | 'mistaken_assumption'
  | 'real_world_case';

export type PerspectiveClass =
  | 'framework_primer'
  | 'case_bridge'
  | 'challenge'
  | 'reflection'
  | 'counterexample'
  | 'comparison';

export type PerspectiveKnowledgeClass =
  | 'established_scientific'
  | 'contested_scientific'
  | 'historical'
  | 'legal'
  | 'philosophical'
  | 'religious_spiritual'
  | 'fictional_in_world';

export type PerspectiveDifficulty = 'introductory' | 'intermediate' | 'advanced';

export type PerspectiveReflectionKind =
  | 'reflection'
  | 'argument_for'
  | 'argument_against'
  | 'assumption'
  | 'open_question'
  | 'alternative_interpretation'
  | 'disagreement'
  | 'hypothesis_reconsideration';

export type PerspectiveSuggestionState = 'dismissed' | 'opened' | 'saved';

export interface PerspectiveFramework {
  id: string;
  frameworkKey: string;
  name: string;
  intellectualDomain: string;
  summary: string;
  coreQuestions: string[];
  keyConcepts: string[];
  methodOfReasoning: string;
  limitations: string[];
  commonMisconceptions: string[];
  internalDifferences: string[];
  relevantDisciplines: string[];
  displayOrder: number;
  status: string;
}

export interface PerspectiveSource {
  label: string;
  author?: string;
  title?: string;
  url?: string | null;
  sourceType?: SourceType | null;
  verificationStatus?: VerificationStatus | string;
  sourceVerified?: boolean;
  notes?: string;
  verificationNotes?: string;
  quote?: string;
}

export interface PerspectiveExperienceSummary {
  experienceKey: string;
  title: string;
  frameworkKey: string;
  format: PerspectiveFormat | string;
  knowledgeClass: PerspectiveKnowledgeClass | string;
  perspectiveClass: PerspectiveClass | string;
  scopeNote: string;
  traditionScope: string;
  intellectualPurpose: string;
  primaryQuestion: string;
  keyConcepts: string[];
  estimatedMinutes: number;
  difficulty: PerspectiveDifficulty | string;
  displayOrder: number;
  status: string;
  relatedExperienceKeys: string[];
  relatedCaseTitles: string[];
}

export interface PerspectiveExperienceDetail extends PerspectiveExperienceSummary {
  introduction: string;
  intellectualBackground: string;
  mainIdea: string;
  detailedExplanation: string;
  sections: Array<{ heading: string; body: string }>;
  historicalContext: string;
  epistemicBreakdown: Record<string, string>;
  supportingSources: PerspectiveSource[];
  limitations: string[];
  counterarguments: string[];
  commonMisconceptions: string[];
  reflectionQuestions: string[];
  activities: string[];
  recommendationTags: string[];
  relatedSpecialistKeys: string[];
  relatedArtifactKeys: string[];
  framework: PerspectiveFramework | null;
  advisory: true;
  isEvidence: false;
  affectsVerdict: false;
  disclaimer: string;
}

export interface PerspectiveDiscovery {
  advisory: true;
  disclaimer: string;
  summary: string;
  openingQuestions: Array<{ frameworkKey: string; frameworkName: string; question: string }>;
  featured: Array<{
    experienceKey: string;
    title: string;
    frameworkKey: string;
    perspectiveClass: PerspectiveClass | string;
    primaryQuestion: string;
    scopeNote: string;
    estimatedMinutes: number;
  }>;
  connections: Array<{
    bridgeKey: string;
    kind: string;
    label: string;
    note: string;
    frameworkKeys: string[];
  }>;
  frameworkCount: number;
  experienceCount: number;
}

export interface PerspectiveConnections {
  advisory: true;
  disclaimer: string;
  experienceKey: string;
  relatedExperiences: PerspectiveExperienceSummary[];
  sharedConcepts: string[];
  bridges: PerspectiveDiscovery['connections'];
}

export interface PerspectiveReflection {
  id: string;
  experienceId: string;
  experienceKey: string;
  userId: string;
  investigationId: string | null;
  promptIndex: number | null;
  prompt: string;
  reflectionKind: PerspectiveReflectionKind | string;
  response: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PerspectiveSuggestion {
  experienceKey: string;
  title: string;
  frameworkKey: string;
  reasonCodes: string[];
  reasonText: string;
  stateFingerprint: string;
  state: PerspectiveSuggestionState | string | null;
  advisory: true;
  isEvidence: false;
  affectsVerdict: false;
}

// --- Living Investigations / Activity (M6) ------------------------------------
// Player-safe activity feed. All fields are server-projected DTOs; no canonical
// truth, hidden evidence conditions, or future secret triggers are exposed.

export interface SafeActivityChange {
  kind: 'development' | 'flag' | 'lead' | 'action' | 'disagreement' | 'suspect_behavior' | 'opportunity_missed';
  label: string;
  evidenceId?: string;
  action?: string;
  specialistKey?: string;
}

export interface SafeActivityEvent {
  id: string;
  eventKey: string;
  category: string;
  status: string;
  significance: 'high' | 'normal' | 'low';
  groupKey: string | null;
  title: string;
  summary: string;
  detail: string;
  whyItMatters: string;
  requiresResponse: boolean;
  responseOptions: Array<{ kind: string; label: string }>;
  actor: { kind: string; displayName: string; specialistKey?: string | null };
  occurredAt: string | null;
  eligibleAt?: string | null;
  changes: SafeActivityChange[];
  relatedArtifactKeys: string[];
  provenanceLabel: string;
}

export interface ActivityGroup {
  groupKey: string;
  title: string;
  significance: 'high' | 'normal' | 'low';
  items: SafeActivityEvent[];
}

export interface CatchUpSummary {
  from: string | null;
  to: string;
  summary: string;
  highlights: string[];
  unresolvedCount: number;
  newCount: number;
}

export interface UpcomingTeaser {
  title: string;
  certainty: 'tentative';
  category: string;
  significance: 'high' | 'normal' | 'low';
}

export interface OutstandingDisagreement {
  eventId: string;
  topic: string;
  specialistAKey: string;
  specialistBKey: string;
  positionA: string;
  positionB: string;
  uncertaintyNote: string;
  occurredAt: string | null;
}

export interface ActivitySnapshot {
  sinceLastVisit: CatchUpSummary;
  groups: ActivityGroup[];
  counts: { total: number; unread: number; high: number; byCategory: Record<string, number> };
  outstandingDisagreements: OutstandingDisagreement[];
  pendingResponse: SafeActivityEvent[];
  upcoming: UpcomingTeaser[];
  hasMore: boolean;
  nextEligibleAt: string | null;
}

export interface LivingWorldResult {
  resolved: SafeActivityEvent[];
  expired: SafeActivityEvent[];
  evidenceChanges: Array<{ evidenceId: string; source: string; description: string; trigger: string }>;
  hasMore: boolean;
  nextEligibleAt: string | null;
  counts: { resolved: number; expired: number; materialized: number; notifications: number };
}

export interface NotificationItem {
  id: string;
  investigationId: string | null;
  eventId: string | null;
  category: string;
  priority: 'high' | 'normal' | 'low';
  groupKey: string | null;
  title: string;
  body: string;
  status: 'unread' | 'read' | 'archived';
  createdAt: string | null;
  readAt: string | null;
}

export interface NotificationsResponse {
  unreadCount: number;
  items: NotificationItem[];
}

// --- Real-World Discovery & Knowledge Retention (M7) -------------------------
// Player-safe discovery/research DTOs. No canonical truth, no hidden evidence,
// no scoring internals beyond the safe evaluation summary returned by the server.

export interface SafeCitationDTO {
  label: string;
  bibliographyRef: string;
  sourceUrl: string | null;
  sourceVerified: boolean;
  verificationStatus: string;
}

export interface SafeUnlockDTO {
  key: string;
  kind: string;
  targetRef: string;
  label: string;
  detail: string;
}

export interface SafeDiscoveryClueDTO {
  key: string;
  subjectKey: string;
  subjectLabel: string;
  referenceCategory: string;
  difficulty: string;
  knowledgeStatus: string;
  title: string;
  prompt: string;
  context: string;
  citations: SafeCitationDTO[];
  unlocks: SafeUnlockDTO[];
  evidenceRefs: string[];
  specialistKeys: string[];
  accepted: boolean;
  correctedUnderstanding: string | null;
}

export interface SafeEvaluationDTO {
  classification: string;
  accepted: boolean;
  score: number;
  confidence: string | null;
  llmUsed: boolean;
  memoryItemId: string | null;
}

export interface SafeSubmissionDTO {
  id: string;
  clueKey: string;
  explanation: string;
  subjectIdentification: string;
  connectionExplanation: string;
  uncertainty: string;
  sourceRefs: string[];
  evaluation: SafeEvaluationDTO;
  createdAt: string | null;
}

export interface SafeMemoryItemDTO {
  id: string;
  subjectKey: string;
  subjectLabel: string;
  referenceCategory: string;
  knowledgeStatus: string;
  concepts: string[];
  correctedUnderstanding: string;
  latestExplanation: string;
  firstClueKey: string | null;
  firstDiscoveredAt: string | null;
  lastRecallAt: string | null;
  nextDueAt: string | null;
  masteryStatus: string;
  successfulRecalls: number;
  failedRecalls: number;
  unresolvedQuestions: string[];
  followUpApplications: string[];
  authoredSources: SafeCitationDTO[];
}

export interface SafeDiscoveryStateDTO {
  clueKey: string;
  state: string;
  attemptCount: number;
  surfacedAt: string | null;
  researchStartedAt: string | null;
  acceptedAt: string | null;
  lastSubmittedAt: string | null;
}

export interface SafeDiscoveryUnlockRowDTO {
  id: string;
  clueKey: string;
  unlockKey: string;
  kind: string;
  targetRef: string;
  label: string;
  detail: string;
  applied: boolean;
  action: string | null;
}

export interface DiscoveryRecallPromptDTO {
  memoryId: string;
  subjectLabel: string;
  kind: string;
  prompt: string;
  nextDueAt: string | null;
}

export interface DiscoverySpecialistNoticeDTO {
  clueKey: string;
  unlockKey: string;
  specialistKey: string;
  prompt: string;
}

export interface DiscoverySnapshotDTO {
  available: boolean;
  packageKey: string | null;
  version: string | null;
  summary: string | null;
  caseTitle: string | null;
  disclaimer: string;
  clues: SafeDiscoveryClueDTO[];
  newClueKeys: string[];
  states: SafeDiscoveryStateDTO[];
  memories: SafeMemoryItemDTO[];
  unlocks: SafeDiscoveryUnlockRowDTO[];
  recallPrompts: DiscoveryRecallPromptDTO[];
  specialistNotices: DiscoverySpecialistNoticeDTO[];
}

export interface DiscoveryClueDetailDTO {
  clue: SafeDiscoveryClueDTO;
  state: SafeDiscoveryStateDTO | null;
  submissions: SafeSubmissionDTO[];
  unlocks: SafeDiscoveryUnlockRowDTO[];
  memory: SafeMemoryItemDTO | null;
  disclaimer: string;
}

export interface DiscoverySubmitResultDTO {
  submission: SafeSubmissionDTO | null;
  accepted: boolean;
  classification: string;
  correctedUnderstanding: string | null;
  memoryItemId: string | null;
  unlocks: SafeDiscoveryUnlockRowDTO[];
  duplicate: boolean;
  state: SafeDiscoveryStateDTO;
  disclaimer: string;
}

export interface DiscoveryUnlockApplyResultDTO {
  unlock: SafeDiscoveryUnlockRowDTO;
  applied: boolean;
  alreadyApplied: boolean;
  progression: unknown | null;
  disclaimer: string;
}

export interface KnowledgeJournalDTO {
  items: SafeMemoryItemDTO[];
  duePrompts: DiscoveryRecallPromptDTO[];
  disclaimer: string;
}

export interface KnowledgeJournalSubjectDTO {
  memory: SafeMemoryItemDTO;
  applications: Array<{ investigationId: string; caseId: string; clueKey: string; applicationContext: string; createdAt: string | null }>;
  links: Array<{ fromSubjectKey: string; toSubjectKey: string; relationship: string; rationale: string }>;
  recallHistory: Array<{ id: string; recallKind: string; outcome: string; answeredAt: string | null; nextDueAt: string | null; intervalDays: number | null }>;
  disclaimer: string;
}

export interface KnowledgeRecallResultDTO {
  memory: SafeMemoryItemDTO;
  recall: { id: string; recallKind: string; outcome: string; answeredAt: string | null; nextDueAt: string | null; intervalDays: number | null };
  disclaimer: string;
}

// --- Post-resolution solution (PROD-009) -------------------------------------
// This is the safe, server-projected DTO returned only for COMPLETED, owned
// investigations. It deliberately contains no hidden_events/internal fields.

export interface SolutionRedHerring {
  label: string;
  apparentMeaning?: string;
  actualExplanation?: string;
  resolvedBy?: string;
}

export interface SolutionTheory {
  title: string;
  summary: string;
  whyPlausible?: string;
  disprovenBy?: string[];
  resolution?: string;
}

export interface SolutionTimelineEntry {
  seq?: number;
  time?: string;
  event?: string;
  participants?: string[];
  evidence?: string[];
}

export interface ClueResolution {
  clue: string;
  resolution: string;
}

export interface Solution {
  culprit: string;
  motive: string;
  method: string;
  solutionExplanation: string;
  redHerrings: SolutionRedHerring[];
  alternativeTheories: SolutionTheory[];
  clueResolutions: ClueResolution[];
  actualTimeline: SolutionTimelineEntry[];
}

export interface AccusationInput {
  submittedCulprit: string;
  motive: string;
  method: string;
  supportingEvidence: string[];
}

export interface EvaluationInput {
  culprit: string;
  motive: string;
  method: string;
  supportingEvidence: string[];
}

export interface JournalInput {
  entryType: string;
  content: string;
  relatedEvidenceIds?: string[];
  isConfirmed?: boolean;
}

// --- Onboarding (M8 Wave 1) -----------------------------------------------------
// Player-owned first-experience progress. Auth-gated; the server derives the
// user from the session and never returns canonical/hidden data here.
export interface OnboardingTutorialState {
  // Contextual tab tips (slice 1).
  reality?: boolean;
  perspectives?: boolean;
  fieldResearch?: boolean;
  // Contextual tab tips (slice 2).
  evidenceTip?: boolean;
  suspectsTip?: boolean;
  chatTip?: boolean;
  // First-investigation interactive checklist (slice 2).
  guideCompleted?: boolean;
  stepBriefing?: boolean;
  stepEvidence?: boolean;
  stepChat?: boolean;
  stepClaims?: boolean;
  stepFieldResearch?: boolean;
  stepVerdict?: boolean;
}

export interface OnboardingState {
  welcomeSeen: boolean;
  introCompleted: boolean;
  skipped: boolean;
  lastStep: string | null;
  tutorialState: OnboardingTutorialState;
  /** True when the intro was finished OR skipped; the overlay stays hidden. */
  completed: boolean;
}

export interface OnboardingPatch {
  welcomeSeen?: boolean;
  introCompleted?: boolean;
  skipped?: boolean;
  lastStep?: string | null;
  tutorialState?: OnboardingTutorialState;
}

// --- M8-W7 beta readiness (config, export, deletion) ----------------------------

/** Public, non-sensitive runtime config exposed by GET /api/config. */
export interface PublicConfig {
  feedbackUrl: string;
  betaAccessRequired: boolean;
  version: string;
}

/** Shape of the player-data export. Player-authored fields only. */
export interface AccountExportDTO {
  exportedAt: string;
  formatVersion: number;
  notice: string;
  profile: { id: string; email: string; createdAt: string | null; updatedAt: string | null };
  onboarding: Record<string, unknown> | null;
  investigations: Array<Record<string, unknown>>;
  notebook: Array<Record<string, unknown>>;
  knowledge: Record<string, Array<Record<string, unknown>>>;
  notifications: Array<Record<string, unknown>>;
}

// --- Endpoints ------------------------------------------------------------------

export const api = {
  getCases: () => request<Case[]>('/api/cases'),

  getCase: (caseId: string) =>
    request<Case & { visibleEvidence?: Evidence[] }>(`/api/cases/${encodeURIComponent(caseId)}`),

  getCharacters: (caseId: string) =>
    request<Suspect[]>(`/api/cases/${encodeURIComponent(caseId)}/characters`),

  // PROD-013: enriched, investigation-scoped suspect board. Auth/ownership and
  // evidence visibility are enforced by the server; this client only renders
  // the safe projection.
  getSuspectBoard: (investigationId: string) =>
    request<SuspectBoard>(
      `/api/investigations/${encodeURIComponent(investigationId)}/suspects`
    ),

  getEvidence: (caseId: string) =>
    request<Evidence[]>(`/api/cases/${encodeURIComponent(caseId)}/evidence`),

  // M2 knowledge system (case-scoped, player-safe projections)
  getSpecialists: (caseId: string) =>
    request<PublicSpecialist[]>(`/api/cases/${encodeURIComponent(caseId)}/specialists`),

  getArtifacts: (caseId: string) =>
    request<PublicArtifactSummary[]>(`/api/cases/${encodeURIComponent(caseId)}/artifacts`),

  getArtifactDetail: (caseId: string, artifactId: string) =>
    request<PublicArtifactDetail>(
      `/api/cases/${encodeURIComponent(caseId)}/artifacts/${encodeURIComponent(artifactId)}`
    ),

  getDisagreements: (caseId: string) =>
    request<PublicDisagreement[]>(`/api/cases/${encodeURIComponent(caseId)}/disagreements`),

  // M3: case knowledge-pack metadata. A 404 means the case has no pack.
  getCaseKnowledgePack: (caseId: string) =>
    request<PublicCaseKnowledgePack>(`/api/cases/${encodeURIComponent(caseId)}/knowledge-pack`),

  getNotificationSettings: () =>
    request<NotificationSettings>('/api/me/notification-settings'),

  updateNotificationSettings: (patch: Partial<NotificationSettings>) =>
    request<NotificationSettings>('/api/me/notification-settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  // M8 Wave 1: per-user onboarding progress (auth-gated, safe DTO).
  getOnboarding: () => request<OnboardingState>('/api/me/onboarding'),

  updateOnboarding: (patch: OnboardingPatch) =>
    request<OnboardingState>('/api/me/onboarding', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  getActiveInvestigation: () => request<Investigation>('/api/investigations/active'),

  getInvestigation: (id: string) =>
    request<Investigation>(`/api/investigations/${encodeURIComponent(id)}`),

  // P2-POLISH: compact, owner-scoped stats summary. Auth/ownership are enforced
  // server-side; this DTO contains only counts/percentages/status/timestamps.
  getStats: (id: string) =>
    request<InvestigationStats>(`/api/investigations/${encodeURIComponent(id)}/stats`),

  createInvestigation: (caseId: string) =>
    post<Investigation>('/api/investigations', { caseId }),

  // PROD-012: releases the one-active-case lock. The server requires this
  // explicit confirmation flag; nothing is deleted, the case is marked
  // 'abandoned' and stays available in the archive as history.
  abandonInvestigation: (id: string) =>
    post<Investigation>(`/api/investigations/${encodeURIComponent(id)}/abandon`, { confirm: true }),

  // Only player-authored notes are client-writable; status/progress/stage are
  // owned by the server state machine.
  updateInvestigation: (
    id: string,
    patch: Pick<Investigation, 'currentTheory' | 'suspicionLevel'>
  ) =>
    request<Investigation>(`/api/investigations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  getArchive: () => request<ArchiveItem[]>('/api/investigations/archive'),

  // M8-6: private progress/return summary. Auth-gated, session-scoped and
  // derived only from this player's own activity (no canonical/hidden data).
  getProgress: () => request<ProgressDTO>('/api/me/progress'),

  discoverEvidence: (id: string, evidenceId: string) =>
    post<Investigation>(`/api/investigations/${encodeURIComponent(id)}/discover-evidence`, {
      evidenceId,
    }),

  getConversation: (id: string) =>
    request<{ messageHistory?: ChatMessage[] }>(
      `/api/investigations/${encodeURIComponent(id)}/conversation`
    ),

  sendChat: (
    id: string,
    message: string,
    opts?: {
      specialistKey?: string;
      intent?: KnowledgeIntent;
      depth?: KnowledgeDepth;
      targetSpecialistKey?: string;
      perspectiveKey?: string;
    }
  ) =>
    post<ChatMessage>(`/api/investigations/${encodeURIComponent(id)}/chat`, {
      message,
      ...(opts?.specialistKey ? { specialistKey: opts.specialistKey } : {}),
      ...(opts?.intent ? { intent: opts.intent } : {}),
      ...(opts?.depth ? { depth: opts.depth } : {}),
      ...(opts?.targetSpecialistKey ? { targetSpecialistKey: opts.targetSpecialistKey } : {}),
      ...(opts?.perspectiveKey ? { perspectiveKey: opts.perspectiveKey } : {}),
    }),

  getJournal: (id: string) =>
    request<JournalEntry[]>(`/api/investigations/${encodeURIComponent(id)}/journal`),

  addJournal: (id: string, entry: JournalInput) =>
    post<JournalEntry>(`/api/investigations/${encodeURIComponent(id)}/journal`, entry),

  getEvents: (id: string) =>
    request<ScheduledEvent[]>(`/api/investigations/${encodeURIComponent(id)}/scheduled-events`),

  getAccusation: (id: string) =>
    request<Accusation>(`/api/investigations/${encodeURIComponent(id)}/accusation`),

  submitAccusation: (id: string, accusation: AccusationInput) =>
    post<Accusation>(`/api/investigations/${encodeURIComponent(id)}/accusation`, accusation),

  evaluateAccusation: (id: string, evaluation: EvaluationInput) =>
    post<VerdictResult>(`/api/investigations/${encodeURIComponent(id)}/evaluate-accusation`, evaluation),

  // Async progression (checkpoints, deductions, time-triggered releases).
  getCheckpoints: (id: string) =>
    request<CheckpointState>(`/api/investigations/${encodeURIComponent(id)}/checkpoints`),

  getDevelopments: (id: string) =>
    request<Development[]>(`/api/investigations/${encodeURIComponent(id)}/developments`),

  submitTheory: (
    id: string,
    input: { checkpointId: string; theory: string; supportingEvidence: string[]; confidence?: string }
  ) => post<TheoryResult>(`/api/investigations/${encodeURIComponent(id)}/theory`, input),

  performAction: (id: string, action: string) =>
    post<ProgressionResult>(`/api/investigations/${encodeURIComponent(id)}/investigate`, { action }),

  // Only available once the server has marked the investigation completed.
  getSolution: (id: string) =>
    request<Solution>(`/api/investigations/${encodeURIComponent(id)}/solution`),

  // GAP-13: read the server-awarded achievements for an investigation. Auth and
  // ownership are enforced server-side by the shared investigation middleware.
  getAchievements: (id: string) =>
    request<Achievement[]>(
      `/api/investigations/${encodeURIComponent(id)}/achievements`
    ),

  // M2 knowledge notebook (investigation-scoped, owner-checked server-side).
  getNotebook: (id: string) =>
    request<PublicNotebookEntry[]>(`/api/investigations/${encodeURIComponent(id)}/notebook`),

  createNotebookEntry: (
    id: string,
    entry: {
      entryType: NotebookEntryType | string;
      concept?: string;
      title?: string;
      content?: string;
      artifactId?: string | null;
      specialistId?: string | null;
      perspectiveExperienceId?: string | null;
      perspectiveKey?: string | null;
    }
  ) => post<PublicNotebookEntry>(`/api/investigations/${encodeURIComponent(id)}/notebook`, entry),

  updateNotebookEntry: (
    id: string,
    entryId: string,
    patch: {
      entryType?: NotebookEntryType | string;
      concept?: string;
      title?: string;
      content?: string;
      artifactId?: string | null;
      specialistId?: string | null;
    }
  ) =>
    request<PublicNotebookEntry>(
      `/api/investigations/${encodeURIComponent(id)}/notebook/${encodeURIComponent(entryId)}`,
      { method: 'PATCH', body: JSON.stringify(patch) }
    ),

  deleteNotebookEntry: (id: string, entryId: string) =>
    request<{ success: boolean }>(
      `/api/investigations/${encodeURIComponent(id)}/notebook/${encodeURIComponent(entryId)}`,
      { method: 'DELETE' }
    ),

  // M3: owner-scoped notebook export. JSON returns a typed envelope; Markdown
  // returns a formatted document. Both are built from safe notebook DTOs.
  exportNotebookJson: (id: string) =>
    request<NotebookExport>(
      `/api/investigations/${encodeURIComponent(id)}/notebook/export?format=json`
    ),

  exportNotebookMarkdown: (id: string) =>
    requestText(`/api/investigations/${encodeURIComponent(id)}/notebook/export?format=markdown`),

  // --- Reality Map (M4) -----------------------------------------------------
  // Player-owned reasoning workspace. All endpoints are investigation-scoped;
  // the server enforces auth, ownership, and visible-material boundaries.

  getRealityMap: (investigationId: string) =>
    request<RealityMapSnapshot>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map`
    ),

  createRealityClaim: (
    investigationId: string,
    body: {
      title: string;
      description?: string;
      claimCategory: RealityClaimCategory;
      confidence?: RealityConfidence;
      notes?: string;
      sourceJournalEntryId?: string | null;
      sourceNotebookEntryId?: string | null;
      sourcePerspectiveExperienceKey?: string | null;
      sourcePerspectiveReflectionId?: string | null;
    }
  ) =>
    post<RealityClaim>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map/claims`,
      body
    ),

  updateRealityClaim: (
    investigationId: string,
    claimId: string,
    patch: Partial<Pick<RealityClaim, 'title' | 'description' | 'claimCategory' | 'confidence' | 'notes'>>
  ) =>
    request<RealityClaim>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map/claims/${encodeURIComponent(claimId)}`,
      { method: 'PATCH', body: JSON.stringify(patch) }
    ),

  deleteRealityClaim: (investigationId: string, claimId: string) =>
    request<{ deleted: boolean; removedLinks: number }>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map/claims/${encodeURIComponent(claimId)}`,
      { method: 'DELETE' }
    ),

  createRealityHypothesis: (
    investigationId: string,
    body: {
      name: string;
      explanation?: string;
      confidence?: RealityConfidence;
      missingInformation?: string;
      alternativeExplanations?: string;
      playerNotes?: string;
    }
  ) =>
    post<RealityHypothesis>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map/hypotheses`,
      body
    ),

  updateRealityHypothesis: (
    investigationId: string,
    hypothesisId: string,
    patch: Partial<Pick<RealityHypothesis, 'name' | 'explanation' | 'status' | 'confidence' | 'missingInformation' | 'alternativeExplanations' | 'playerNotes'>>
  ) =>
    request<RealityHypothesis>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map/hypotheses/${encodeURIComponent(hypothesisId)}`,
      { method: 'PATCH', body: JSON.stringify(patch) }
    ),

  deleteRealityHypothesis: (investigationId: string, hypothesisId: string) =>
    request<{ deleted: boolean; removedLinks: number }>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map/hypotheses/${encodeURIComponent(hypothesisId)}`,
      { method: 'DELETE' }
    ),

  createRealityLink: (
    investigationId: string,
    body: {
      ownerType: RealityLinkOwnerType;
      ownerId: string;
      targetType: RealityLinkTargetType;
      targetId: string;
      relationship: RealityRelationship;
      rationale?: string;
    }
  ) =>
    post<RealityLink>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map/links`,
      body
    ),

  updateRealityLink: (
    investigationId: string,
    linkId: string,
    patch: Partial<Pick<RealityLink, 'relationship' | 'rationale'>>
  ) =>
    request<RealityLink>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map/links/${encodeURIComponent(linkId)}`,
      { method: 'PATCH', body: JSON.stringify(patch) }
    ),

  deleteRealityLink: (investigationId: string, linkId: string) =>
    request<{ deleted: boolean }>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map/links/${encodeURIComponent(linkId)}`,
      { method: 'DELETE' }
    ),

  compareRealityHypotheses: (investigationId: string, hypothesisIds: string[]) =>
    request<RealityHypothesisComparison>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map/compare?hypothesisIds=${encodeURIComponent(hypothesisIds.join(','))}`
    ),

  realityReasoningReview: (investigationId: string) =>
    post<RealityReasoningAudit>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map/reasoning-review`,
      {}
    ),

  realitySpecialistReview: (
    investigationId: string,
    hypothesisId: string,
    body: {
      specialistKey: string;
      focus: RealityReviewFocus;
      compareWithHypothesisId?: string;
      targetSpecialistKey?: string;
    }
  ) =>
    post<RealitySpecialistReview>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map/hypotheses/${encodeURIComponent(hypothesisId)}/specialist-review`,
      body
    ),

  addRealityTutorialExamples: (investigationId: string) =>
    post<RealityTutorialResponse>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map/tutorial-examples`,
      { confirm: true }
    ),

  removeRealityTutorialExamples: (investigationId: string) =>
    request<{ deleted: boolean; claims?: number; hypotheses?: number; links?: number }>(
      `/api/investigations/${encodeURIComponent(investigationId)}/reality-map/tutorial-examples`,
      { method: 'DELETE' }
    ),

  // --- Perspective Engine (M5) -----------------------------------------------
  // Advisory exploration content. Never evidence, never affects verdict, never
  // reveals canonical truth. The server enforces auth and ownership.

  getPerspectiveFrameworks: () =>
    request<{
      advisory: true;
      isEvidence: false;
      affectsVerdict: false;
      disclaimer: string;
      count: number;
      frameworks: PerspectiveFramework[];
    }>('/api/perspectives/frameworks'),

  discoverPerspectives: () =>
    request<PerspectiveDiscovery>('/api/perspectives/discover'),

  getPerspectives: (params?: { framework?: string; format?: string; q?: string }) => {
    const search = new URLSearchParams();
    if (params?.framework) search.set('framework', params.framework);
    if (params?.format) search.set('format', params.format);
    if (params?.q) search.set('q', params.q);
    const qs = search.toString();
    return request<{
      advisory: true;
      disclaimer: string;
      count: number;
      experiences: PerspectiveExperienceSummary[];
    }>(`/api/perspectives${qs ? `?${qs}` : ''}`);
  },

  getPerspective: (experienceKey: string) =>
    request<PerspectiveExperienceDetail>(
      `/api/perspectives/${encodeURIComponent(experienceKey)}`
    ),

  getPerspectiveConnections: (experienceKey: string) =>
    request<PerspectiveConnections>(
      `/api/perspectives/${encodeURIComponent(experienceKey)}/connections`
    ),

  getPerspectiveReflections: (params?: { experienceKey?: string; investigationId?: string }) => {
    const search = new URLSearchParams();
    if (params?.experienceKey) search.set('experienceKey', params.experienceKey);
    if (params?.investigationId) search.set('investigationId', params.investigationId);
    const qs = search.toString();
    return request<{
      advisory: true;
      disclaimer: string;
      count: number;
      reflections: PerspectiveReflection[];
    }>(`/api/perspectives/reflections${qs ? `?${qs}` : ''}`);
  },

  createPerspectiveReflection: (
    experienceKey: string,
    body: {
      response: string;
      promptIndex?: number | null;
      prompt?: string;
      reflectionKind?: PerspectiveReflectionKind | string;
      investigationId?: string | null;
    }
  ) =>
    post<{ advisory: true; disclaimer: string; reflection: PerspectiveReflection }>(
      `/api/perspectives/${encodeURIComponent(experienceKey)}/reflections`,
      body
    ),

  updatePerspectiveReflection: (
    id: string,
    patch: { response?: string; reflectionKind?: PerspectiveReflectionKind | string }
  ) =>
    request<{ advisory: true; disclaimer: string; reflection: PerspectiveReflection }>(
      `/api/perspectives/reflections/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) }
    ),

  deletePerspectiveReflection: (id: string) =>
    request<{ ok: boolean }>(`/api/perspectives/reflections/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getPerspectiveSuggestions: (investigationId: string) =>
    request<{
      advisory: true;
      isEvidence: false;
      affectsVerdict: false;
      disclaimer: string;
      engagement: 'none' | 'active';
      count: number;
      suggestions: PerspectiveSuggestion[];
    }>(`/api/investigations/${encodeURIComponent(investigationId)}/perspectives/suggestions`),

  dismissPerspectiveSuggestion: (
    investigationId: string,
    experienceKey: string,
    body?: { reasonCode?: string; fingerprint?: string }
  ) =>
    post<{ ok: boolean; state: unknown }>(
      `/api/investigations/${encodeURIComponent(investigationId)}/perspectives/suggestions/${encodeURIComponent(experienceKey)}/dismiss`,
      body ?? {}
    ),

  // --- Living Investigations / Activity (M6) ---------------------------------
  getActivity: (investigationId: string, opts?: { limit?: number; cursor?: string }) => {
    const search = new URLSearchParams();
    if (typeof opts?.limit === 'number') search.set('limit', String(opts.limit));
    if (opts?.cursor) search.set('cursor', opts.cursor);
    const qs = search.toString();
    return request<ActivitySnapshot>(
      `/api/investigations/${encodeURIComponent(investigationId)}/activity${qs ? `?${qs}` : ''}`
    );
  },

  refreshActivity: (investigationId: string, body?: { max?: number }) =>
    post<LivingWorldResult>(
      `/api/investigations/${encodeURIComponent(investigationId)}/activity/refresh`,
      body ?? {}
    ),

  markActivitySeen: (
    investigationId: string,
    body: { eventIds?: string[]; through?: string }
  ) =>
    post<{ ok: true; unreadCount: number }>(
      `/api/investigations/${encodeURIComponent(investigationId)}/activity/seen`,
      body
    ),

  getActivityEvent: (investigationId: string, eventId: string) =>
    request<{ event: SafeActivityEvent }>(
      `/api/investigations/${encodeURIComponent(investigationId)}/activity/events/${encodeURIComponent(eventId)}`
    ),

  narrateActivityEvent: (investigationId: string, eventId: string) =>
    post<{ narration: string; disclaimer: string; source: string }>(
      `/api/investigations/${encodeURIComponent(investigationId)}/activity/events/${encodeURIComponent(eventId)}/narrate`,
      {}
    ),

  getNotifications: (opts?: { status?: 'unread' | 'all'; limit?: number }) => {
    const search = new URLSearchParams();
    if (opts?.status) search.set('status', opts.status);
    if (typeof opts?.limit === 'number') search.set('limit', String(opts.limit));
    const qs = search.toString();
    return request<NotificationsResponse>(`/api/notifications${qs ? `?${qs}` : ''}`);
  },

  markNotificationsRead: (body: { ids?: string[] } | { all: true; investigationId?: string }) =>
    post<{ ok: true; unreadCount: number }>('/api/notifications/read', body),

  // --- Real-World Discovery & Knowledge Retention (M7) -----------------------
  getDiscoveries: (investigationId: string) =>
    request<DiscoverySnapshotDTO>(
      `/api/investigations/${encodeURIComponent(investigationId)}/discoveries`
    ),

  getDiscoveryClue: (investigationId: string, clueKey: string) =>
    request<DiscoveryClueDetailDTO>(
      `/api/investigations/${encodeURIComponent(investigationId)}/discoveries/${encodeURIComponent(clueKey)}`
    ),

  startDiscovery: (investigationId: string, clueKey: string) =>
    post<SafeDiscoveryStateDTO | { state?: string }>(
      `/api/investigations/${encodeURIComponent(investigationId)}/discoveries/${encodeURIComponent(clueKey)}/start`,
      {}
    ),

  submitDiscovery: (
    investigationId: string,
    clueKey: string,
    body: {
      explanation: string;
      subjectIdentification?: string;
      connectionExplanation?: string;
      uncertainty?: string;
      sourceRefs?: string[];
      confidence?: string;
    }
  ) =>
    post<DiscoverySubmitResultDTO>(
      `/api/investigations/${encodeURIComponent(investigationId)}/discoveries/${encodeURIComponent(clueKey)}/submissions`,
      body
    ),

  applyDiscoveryUnlock: (investigationId: string, clueKey: string, unlockKey: string) =>
    post<DiscoveryUnlockApplyResultDTO>(
      `/api/investigations/${encodeURIComponent(investigationId)}/discoveries/${encodeURIComponent(clueKey)}/unlocks/${encodeURIComponent(unlockKey)}/apply`,
      {}
    ),

  getKnowledgeJournal: () =>
    request<KnowledgeJournalDTO>('/api/knowledge/journal'),

  getKnowledgeJournalSubject: (subjectKey: string) =>
    request<KnowledgeJournalSubjectDTO>(
      `/api/knowledge/journal/${encodeURIComponent(subjectKey)}`
    ),

  submitKnowledgeRecall: (
    memoryId: string,
    body: { response: string; recallKind?: string; investigationId?: string; clueKey?: string }
  ) =>
    post<KnowledgeRecallResultDTO>(
      `/api/knowledge/recall/${encodeURIComponent(memoryId)}`,
      body
    ),

  // --- M8-W7 beta readiness ----------------------------------------------------
  getPublicConfig: () => request<PublicConfig>('/api/config'),

  exportAccountData: () => request<AccountExportDTO>('/api/me/export'),

  deleteAccount: () => post<{ ok: boolean; message: string }>('/api/me/delete', { confirm: 'DELETE' }),
};

/** Convert an unknown error into a short, user-facing message. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}
