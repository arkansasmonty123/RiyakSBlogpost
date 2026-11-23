// Shared domain model for The Negotiation Table.
// IMPORTANT: anything in this file may be imported by the client. Server-only
// data (hidden participant facts, outcome cut-offs, reveal rules) must never be
// placed in a *Briefing / *View / public DTO type.

export type InfoClass = 'verified' | 'reported' | 'unknown';

export type Difficulty = 'intro' | 'intermediate' | 'advanced';
export type SessionStatus = 'briefing' | 'preparation' | 'active' | 'completed' | 'abandoned';
export type SenderType = 'player' | 'participant' | 'system';
export type MessageTarget = 'group' | string;
export type OfferStatus = 'proposed' | 'countered' | 'accepted' | 'rejected' | 'withdrawn' | 'superseded';
export type AgreementStatus = 'none' | 'partial' | 'full' | 'failed' | 'walked_away';
export type RatingLevel = 'strong' | 'developing' | 'needs_work';
/** Outcome/decision quality uses a different scale from skill ratings. */
export type QualityLevel = 'strong' | 'mixed' | 'weak';

export type SkillId =
  | 'negotiation'
  | 'questioning'
  | 'bluff_detection'
  | 'strategic_communication'
  | 'information_management'
  | 'incentive_reading'
  | 'emotional_control'
  | 'concessions'
  | 'critical_thinking'
  | 'decision_quality';

/** Intents the engine understands. The AI layer may emit them; the engine validates. */
export type ResponseIntent =
  | 'message'
  | 'question'
  | 'offer'
  | 'counteroffer'
  | 'accept'
  | 'reject'
  | 'withdraw'
  | 'concession'
  | 'challenge'
  | 'walk_away'
  | 'silence';

export type EventType =
  | 'session_started'
  | 'session_activated'
  | 'preparation_saved'
  | 'message_sent'
  | 'offer_made'
  | 'offer_countered'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'offer_withdrawn'
  | 'agreement_reached'
  | 'agreement_failed'
  | 'walk_away'
  | 'trust_changed'
  | 'concession_made'
  | 'turn_completed'
  | 'llm_degraded'
  | 'debrief_generated';

export interface CaseSummary {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  difficulty: Difficulty;
  participantCount: number;
  estimatedMinutes: number;
  skills: string[];
}

export interface BriefingItem {
  label: string;
  value: string;
  infoClass: InfoClass;
}

export interface ParticipantPublic {
  id: string;
  name: string;
  role: string;
  organization: string;
  avatarColor: string;
  bio: string;
  personality: string;
  isPlayerProxy?: boolean;
}

/** SERVER ONLY. Never serialize into a briefing or session view. */
export interface ParticipantPrivate {
  id: string;
  trueInterests: string[];
  goals: string[];
  secrets: string[];
  constraints: string[];
  reservationPoint: string;
  batna: string;
  /** Per-issue hard limits for agreement validation: { issueId: { min?, max? } }. */
  issueLimits?: Record<string, { min?: number; max?: number }>;
  /** Who this participant trusts/distrusts and why (participantId -> description). */
  relationships?: Record<string, string>;
  /** Facts this participant knows that others may not (context for AI only). */
  knownFacts?: string[];
  /** What this participant will say publicly; may be a bluff. */
  publicStance?: string;
  bluffTendency: 'low' | 'medium' | 'high';
  cooperativeness: 'low' | 'medium' | 'high';
  influence: 'low' | 'medium' | 'high';
  requiredForAgreement: boolean;
}

export interface CaseIssue {
  id: string;
  label: string;
  description: string;
  minValue: number;
  maxValue: number;
  unit: string;
  playerIdeal: number;
  opposingIdeal: number;
  /** Numeric walk-away thresholds used by the deterministic engine. */
  playerReservation: number;
  opposingReservation: number;
  /** Player's direction on this issue: maximize (e.g. price) or minimize (e.g. months). */
  direction: 'maximize' | 'minimize';
  /** Weight (positive) used for outcome scoring. */
  weight: number;
  /** Must be covered by a valid agreement. */
  required: boolean;
}

/** Safe subset of CaseIssue exposed in briefings - no opposing cut-offs. */
export interface BriefingIssue {
  id: string;
  label: string;
  description: string;
  minValue: number;
  maxValue: number;
  unit: string;
  playerIdeal: number;
  weight: number;
}

/** SERVER ONLY: outcome tiers selected by the engine from final terms. */
export interface OutcomeDefinition {
  id: string;
  title: string;
  description: string;
  minScore: number;
  maxScore: number;
  walkAway?: boolean;
}

/** SERVER ONLY: hidden information revealed in the debrief. */
export interface HiddenReveal {
  participantId: string;
  reveal: string;
  infoClass: InfoClass;
}

export interface CaseDefinition {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  skills: SkillId[];
  context: string;
  playerRole: string;
  playerObjective: string;
  playerConstraints: BriefingItem[];
  playerResources: BriefingItem[];
  playerPriorities: string[];
  playerPrivateInfo: BriefingItem[];
  minimumAcceptableOutcome: string;
  opposingDemands: BriefingItem[];
  knownInterests: BriefingItem[];
  availableIntelligence: BriefingItem[];
  apparentConstraints: BriefingItem[];
  relationships: string[];
  participants: ParticipantPublic[];
  participantPrivate: Record<string, ParticipantPrivate>;
  issues: CaseIssue[];
  possibleOutcomes: string[];
  outcomeDefinitions: OutcomeDefinition[];
  hiddenReveals: HiddenReveal[];
  debriefNotes: string[];
}

/** Client-safe briefing. Contains no participant secrets or numeric opponent cut-offs. */
export interface CaseBriefing {
  caseId: string;
  title: string;
  context: string;
  playerRole: string;
  playerObjective: string;
  playerConstraints: BriefingItem[];
  playerResources: BriefingItem[];
  playerPriorities: string[];
  playerPrivateInfo: BriefingItem[];
  minimumAcceptableOutcome: string;
  opposingDemands: BriefingItem[];
  knownInterests: BriefingItem[];
  availableIntelligence: BriefingItem[];
  apparentConstraints: BriefingItem[];
  participants: ParticipantPublic[];
  relationships: string[];
  issues: BriefingIssue[];
}

export interface PreparationInput {
  objectives: string;
  batna: string;
  reservationPoint: string;
  openingPosition: string;
  leverage: string;
  concessions: string;
  questions: string;
  predictions: string;
  strategy: string;
}

export interface OfferTerm {
  issueId: string;
  value: number;
}

export interface Offer {
  id: string;
  sessionId: string;
  proposerType: SenderType;
  proposerId: string | null;
  proposerName: string;
  terms: OfferTerm[];
  message: string;
  status: OfferStatus;
  createdAt: string;
  respondedAt?: string;
  respondedBy?: string;
  parentOfferId?: string;
  /** 'player' or participant ids that explicitly accepted this offer. */
  acceptances?: string[];
  /** Set when the engine validated this offer as the final agreement. */
  validated?: boolean;
}

export interface TrustState {
  participantId: string;
  score: number;
  notes: string[];
}

export interface NegotiationEvent {
  id: string;
  sessionId: string;
  type: EventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderType: SenderType;
  senderId: string | null;
  senderName: string;
  target: MessageTarget;
  content: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface NegotiationSession {
  id: string;
  caseId: string;
  status: SessionStatus;
  preparation: PreparationInput | null;
  offers: Offer[];
  trust: TrustState[];
  agreementStatus: AgreementStatus;
  agreementOfferId: string | null;
  /** Number of player message turns processed. */
  turnCount: number;
  /** Number of real LLM calls made (fallback calls do not count). */
  llmCalls: number;
  /** Monotonic drift/optimistic-lock counter; incremented on every committed mutation. */
  stateVersion: number;
  events: NegotiationEvent[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** Populated by the persistence layer when a session is loaded. */
  messages?: ChatMessage[];
}

export interface SessionView extends NegotiationSession {
  case: CaseSummary;
  briefing: CaseBriefing;
  messages: ChatMessage[];
}

export interface OutcomeResult {
  id: string;
  title: string;
  description: string;
  playerScore: number;
  rationale: string;
}

export interface ConceptLesson {
  concept: string;
  lesson: string;
  evidence: string;
}

export interface DebriefReport {
  sessionId: string;
  caseId: string;
  agreementStatus: AgreementStatus;
  agreementSummary: string | null;
  outcome: OutcomeResult;
  objectivesMet: { objective: string; met: boolean; evidence: string }[];
  concessions: { by: string; description: string }[];
  unresolvedIssues: string[];
  trustChanges: { participant: string; from: number; to: number; reason: string }[];
  keyMoments: { timestamp: string; description: string; impact: string }[];
  mistakes: string[];
  missedOpportunities: string[];
  alternativeApproaches: string[];
  hiddenReveals: { participant: string; reveal: string; infoClass: InfoClass }[];
  skillAssessment: { skill: SkillId; rating: RatingLevel; evidence: string }[];
  conceptLessons: ConceptLesson[];
  decisionQuality: QualityLevel;
  decisionQualityRationale: string;
  outcomeQuality: QualityLevel;
  outcomeQualityRationale: string;
}

export interface DebriefResponse {
  session: NegotiationSession;
  debrief: DebriefReport;
}

export interface CreateSessionRequest {
  caseId: string;
}

export interface SavePreparationRequest {
  preparation: PreparationInput;
}

export interface SendMessageRequest {
  content: string;
  target: MessageTarget;
  type?: 'message' | 'offer' | 'counteroffer' | 'accept' | 'reject' | 'withdraw' | 'walk_away';
  offerTerms?: OfferTerm[];
  offerId?: string;
  /** Optional optimistic-concurrency guard: reject if the session has moved on. */
  expectedStateVersion?: number;
}

export interface SendMessageResponse {
  session: NegotiationSession;
  messages: ChatMessage[];
  events: NegotiationEvent[];
}

export interface SkillScoreRecord {
  id: string;
  sessionId: string;
  caseId: string;
  skill: SkillId;
  rating: RatingLevel;
  score: number;
  evidence: string;
  createdAt: string;
}

export interface SkillSummary {
  skill: SkillId;
  sessions: number;
  lastRating: RatingLevel;
  lastEvidence: string;
  lastCaseId: string;
  lastAssessedAt: string;
}

export interface ApiError {
  error: string;
}
