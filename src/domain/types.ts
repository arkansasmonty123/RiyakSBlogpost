/** Bounded AI-review history kept in a save; the domain owns the cap and storage reuses it. */
export const MAX_AI_REVIEW_RECORDS = 20;

export type CareerStage =
  'newcomer' | 'intern' | 'junior_advocate' | 'independent_advocate' | 'established_practitioner' | 'senior';

export type KnowledgeLabel = 'known' | 'claimed' | 'disputed' | 'unknown';

export interface PlayerProfile {
  id: string;
  name: string;
  careerStage: CareerStage;
  reputation: {
    competence: number;
    integrity: number;
    reliability: number;
  };
}

/** A bounded, deterministic change to one player reputation dimension. */
export type ReputationDimension = keyof PlayerProfile['reputation'];
export interface ReputationEffect {
  dimension: ReputationDimension;
  amount: number;
}

export interface GameClock {
  day: number; // in-game day, starts at 1
  slot: 'morning' | 'afternoon' | 'evening';
}

export type CharacterExpression =
  'neutral' | 'thinking' | 'smiling' | 'disappointed' | 'angry' | 'surprised' | 'speaking' | 'concerned' | 'approving';

export interface Character {
  id: string;
  name: string;
  role: string;
  portrait: CharacterExpression;
  knowledgeBoundaries: string[];
  goals: string[];
}

export interface Relationship {
  fromId: string;
  toId: string;
  trust: number;
  respect: number;
  loyalty: number;
  rivalry: number;
  resentment: number;
  affection: number;
  professionalDependence: number;
}

export type RelationshipDimension = keyof Omit<Relationship, 'fromId' | 'toId'>;

export interface RelationshipEffect {
  characterId: string;
  dimension: RelationshipDimension;
  amount: number;
}

/** A deterministic dialogue interaction. Content must respect character knowledge boundaries. */
export interface DialogueChoice {
  id: string;
  label: string;
  reply: string;
  effects: RelationshipEffect[];
  /** A specific, player-legible event that the character remembers. Never canonical truth. */
  memory: string;
  /** Player-knowledge facts legitimately learned from this exchange (never canonical truth). */
  reveals?: string[];
  /** Optional bounded, deterministic reputation consequence of this interaction. */
  reputationEffects?: ReputationEffect[];
  /** Optional milestone flag set when this choice is resolved. */
  setsFlag?: string;
}

export interface DialogueScene {
  id: string;
  characterId: string;
  prompt: string;
  minDay: number;
  once: boolean;
  /** `event` marks a day-gated world event with consequences; defaults to conversation. */
  kind?: 'conversation' | 'event';
  choices: DialogueChoice[];
}

export interface MemoryEvent {
  id: string;
  day: number;
  summary: string;
  participants: string[];
}

export type Admissibility = 'unknown' | 'admissible' | 'questionable' | 'inadmissible';
export type Reliability = 'unknown' | 'high' | 'medium' | 'low';

export interface EvidenceAssessment {
  admissibility: Admissibility;
  reliability: Reliability;
  rationale: string;
}

export interface EvidenceItem {
  id: string;
  title: string;
  type: 'physical' | 'digital' | 'medical' | 'testimony' | 'documentary' | 'expert';
  description: string;
  discovered: boolean;
  /** Whether the player has actually inspected the item. Assessment fields unlock only after this. */
  reviewed: boolean;
  /** Baseline values revealed after discovery (deterministic stub, NOT canonical authenticity). */
  admissibility: Admissibility;
  reliability: Reliability;
  /** The player's own provisional assessment; empty until reviewed. */
  assessment: EvidenceAssessment;
  provenance: string;
}

export interface CaseTruth {
  actualEvents: string[];
  responsibleParties: string[];
  actualTimeline: string[];
  evidenceAuthenticity: Record<string, boolean>;
  hiddenMotives: string[];
  unresolvedAmbiguities: string[];
}

export interface CaseFile {
  id: string;
  title: string;
  status: 'active' | 'closed';
  canonicalTruth: CaseTruth; // NEVER expose directly to player UI
  playerKnowledge: string[];
  allegations: string[];
  admissibleMaterial: string[];
  unresolvedAmbiguity: string[];
  evidence: EvidenceItem[];
}

/**
 * Verification is a human/content-owner act, never something the game infers.
 * - verified: traceable provenance confirmed by a reviewer; may be cited as authoritative.
 * - unverified: drafted/ingested but not yet confirmed; never authoritative.
 * - placeholder: explicitly a stand-in (often a citation-like string); never authoritative.
 */
export type SourceVerificationStatus = 'verified' | 'unverified' | 'placeholder';
export type SourceType = 'statute' | 'judgment' | 'rule' | 'commentary' | 'summary';
export type SourceJurisdiction = 'India' | 'Fictional';

/**
 * A provenance record for legal material. Every field describes WHERE a statement came
 * from and HOW it was checked; none of these fields is itself a legal assertion.
 * An excerpt/summary is non-authoritative by construction and is labeled as such in the UI.
 */
export interface LegalSource {
  id: string;
  /** Player-facing label for this record. */
  title: string;
  /** Official name of the source as published (e.g. the Act or judgment name). */
  sourceName: string;
  /** Citation or stable identifier. Never invent one; placeholders must be labeled. */
  citation: string;
  sourceType: SourceType;
  jurisdiction: SourceJurisdiction;
  verificationStatus: SourceVerificationStatus;
  /** Non-authoritative provenance note: where/how this record was obtained. */
  provenance: string;
  /** Optional stable URL pointing to the official publisher (never a fabricated citation). */
  sourceUrl?: string;
  /** ISO date (YYYY-MM-DD) on which a human reviewer verified the source. */
  verificationDate?: string;
  /** Identifier of the human/content owner who verified the source. */
  verifiedBy?: string;
  /** ISO date (YYYY-MM-DD) on which the provision/rule took effect. */
  effectiveDate?: string;
  /** Non-authoritative excerpt or summary; must be labeled as such wherever shown. */
  excerpt?: string;
  notes?: string;
  /** Set by the in-game Source Intake flow; seed records are content-owner supplied. */
  intake?: 'seed' | 'player-draft';
}

export interface NotebookEntry {
  id: string;
  day: number;
  kind: 'note' | 'provision' | 'fact' | 'mistake' | 'feedback' | 'research' | 'contradiction' | 'theory';
  title: string;
  content: string;
  sourceId?: string;
  source?: string;
  verified?: boolean;
  /** Set on contradiction/corroboration notes so the source item is traceable. */
  evidenceId?: string;
  relation?: 'contradiction' | 'corroboration';
  /** Knowledge graph link IDs connecting this note to interdisciplinary concepts. */
  knowledgeGraphIds?: string[];
}

/** A connection between a legal topic and a non-legal discipline. */
export type KnowledgeDomain =
  | 'forensic'
  | 'medical'
  | 'psychology'
  | 'economics'
  | 'accounting'
  | 'cybersecurity'
  | 'history'
  | 'philosophy'
  | 'sociology'
  | 'technology';

export interface KnowledgeConnection {
  id: string;
  legalTopic: string; // case element, evidence id, assignment title, etc.
  domain: KnowledgeDomain;
  relatedConcept: string;
  description: string; // player-legible summary of the connection
  strength: 'weak' | 'moderate' | 'strong'; // player-legible assessment
  sourceId?: string; // optional link to a LegalSource if the connection is verified
}

/** Player-legible interdisciplinary notes. */
export type InterdisciplinaryNote =
  | 'forensic-analysis'
  | 'medical-reasoning'
  | 'psychological-profile'
  | 'economic-analysis'
  | 'historical-context'
  | 'philosophical-implication'
  | 'technological-implication'
  | 'sociological-pattern';

export interface InterdisciplinaryNotebookEntry extends NotebookEntry {
  connection: KnowledgeConnection;
}

/** Grounds a player may legitimately question about an item's use in a case. */
export type ChallengeGround = 'relevance' | 'reliability' | 'custody' | 'provenance';

/** A player-authored observation about how an item was handled. Never canonical truth. */
export interface CustodyObservation {
  id: string;
  day: number;
  evidenceId: string;
  observation: string;
}

/** A player-authored challenge to how an item may be relied upon. */
export interface AdmissibilityChallenge {
  id: string;
  day: number;
  evidenceId: string;
  ground: ChallengeGround;
  rationale: string;
}

/** One deterministic senior-review submission, enabling a submit → revise → resubmit loop. */
export interface ReviewRound {
  id: string;
  day: number;
  assignmentId: string;
  round: number;
  status: 'needs_revision' | 'accepted';
  feedback: string;
  strengths: string[];
  gaps: string[];
}

export type AssignmentStatus = 'locked' | 'pending' | 'active' | 'submitted' | 'reviewed';

export interface Assignment {
  id: string;
  /** Earliest in-game day on which this assignment can unlock. */
  day: number;
  /** Another assignment that must be reviewed before this one unlocks. */
  unlockAfter?: string;
  title: string;
  description: string;
  status: AssignmentStatus;
  requiredEvidenceIds: string[];
  requiredSourceIds: string[];
  /** Notebook kinds the player must produce before this assignment can be reviewed. */
  requiredNotebookKinds?: NotebookEntry['kind'][];
  /** Milestone flags the player must have earned before this assignment can be reviewed. */
  requiredFlags?: string[];
  /** Senior review cannot accept the first submission; the player must revise and resubmit. */
  requiresRevisionLoop?: boolean;
  feedback?: string;
}

export interface DraftVersion {
  id: string;
  savedAt: string; // ISO timestamp
  day: number;
  slot: GameClock['slot'];
  text: string;
}

export interface DraftState {
  current: string;
  versions: DraftVersion[];
}

/** Fixed set of important, player-legible actions traced by the audit/event log. */
export type AuditEventType =
  | 'save'
  | 'draft-submitted'
  | 'assignment-reviewed'
  | 'senior-review-submitted'
  | 'evidence-discovered'
  | 'evidence-reviewed'
  | 'evidence-challenged'
  | 'custody-recorded'
  | 'source-intake'
  | 'senior-review-ai'
  | 'final-brief';

/**
 * A bounded, append-only record that an important action happened. It contains only
 * player-legible information: no canonical truth, no authenticity finding, no secrets.
 */
export interface AuditEvent {
  id: string;
  day: number;
  slot: GameClock['slot'];
  type: AuditEventType;
  summary: string;
}

/** How the player provisionally regards their own theory claim — never canonical truth. */
export type TheoryStatus = 'known' | 'claimed' | 'disputed';

/**
 * A player-authored case-theory claim. It may only link evidence the player has actually
 * discovered and reviewed, and it never records a finding on authenticity or responsibility.
 */
export interface TheoryClaim {
  id: string;
  day: number;
  text: string;
  status: TheoryStatus;
  evidenceIds: string[];
}

export interface CaseTheory {
  claims: TheoryClaim[];
}

export interface SaveGame {
  version: 2;
  savedAt: string;
  player: PlayerProfile;
  clock: GameClock;
  characters: Character[];
  relationships: Relationship[];
  memories: MemoryEvent[];
  caseFile: CaseFile;
  legalSources: LegalSource[];
  assignments: Assignment[];
  notebook: NotebookEntry[];
  selectedViewpoint: string;
  flags: Record<string, boolean>;
  /** Static dialogue scenes the player has already resolved (by scene id). */
  usedDialogueSceneIds: string[];
  draft: DraftState;
  /** Player-authored casework. All fields are player-legible; none touch canonical truth. */
  custodyLog: CustodyObservation[];
  challenges: AdmissibilityChallenge[];
  reviewRounds: ReviewRound[];
  /** Player-authored, evidence-linked case theory. Player-legible; never canonical truth. */
  caseTheory: CaseTheory;
  /** Bounded, append-only trail of important player actions. Never canonical truth. */
  auditLog: AuditEvent[];
  /**
   * Provenance-labelled records of opt-in AI-assisted senior reviews. Written only after the
   * structured proposal passed every deterministic gate; AI text here is feedback metadata,
   * never a game fact, legal authority or canonical truth.
   */
  aiReviews: AiReviewRecord[];
}

/**
 * A bounded record that an AI-assisted review was requested and what the deterministic gates
 * decided. `deterministicStatus` is written by `submitSeniorReview` and can never be changed
 * by a model proposal; `aiAssisted` is true only when an accepted proposal enriched feedback.
 */
export interface AiReviewRecord {
  id: string;
  day: number;
  assignmentId: string;
  round: number;
  requestId: string;
  deterministicStatus: ReviewRound['status'];
  aiAssisted: boolean;
  gatewayStatus: 'accepted' | 'rejected';
  summary: string;
  citedSources: string[];
  warnings: string[];
}

/** How a legal provision / rule takes effect. */
export type ApplicableLawSection =
  'statutory_provision' | 'case_precedent' | 'procedural_rule' | 'contract_principle' | 'other';

export interface ApplicableLaw {
  id: string;
  section: ApplicableLawSection;
  description: string;
  sourceId?: string; // links to a verified LegalSource
  effectiveFrom?: string; // ISO date
  effectiveTo?: string; // ISO date, if repealed
}

/** A strategic approach the player can adopt — player-legible, not canonical. */
export type StrategicApproach =
  'confrontational' | 'diplomatic' | 'technical' | 'investigative' | 'negotiatorial' | 'other';

export interface StrategicApproachRecord {
  id: string;
  approach: StrategicApproach;
  description: string;
  expectedOutcome: string;
  riskLevel: 'low' | 'medium' | 'high';
}

/** Possible case consequences — player-legible outcomes. */
export type ConsequenceType =
  'sentence_reduction' | 'client_loss' | 'reputation_gain' | 'network_expansion' | 'professional_discipline' | 'other';

export interface ConsequenceRecord {
  id: string;
  type: ConsequenceType;
  description: string;
  triggerConditions: string[];
  probability: number; // 0–100 player-legible
  alreadyTriggered: boolean;
}

/** Player-legible assessment of an item's authenticity — never canonical truth.
 *  The player can discover clues about authenticity through investigation,
 *  but the actual authenticity is determined by the deterministic case truth. */
export type EvidenceAuthenticity = 'authenticated' | 'unauthenticated' | 'disputed' | 'unknown';

export interface EvidenceAuthenticityRecord {
  id: string;
  authenticity: EvidenceAuthenticity;
  assessedBy?: string;
  assessedAt?: string;
  rationale?: string;
}

/** A player-legible hidden motive — separate from canonical truth. */
export type HiddenMotive =
  'financial_gain' | 'power_concealment' | 'personal_vengeance' | 'protect_another' | 'unknown';

export interface HiddenMotiveRecord {
  id: string;
  motive: HiddenMotive;
  associatedParty: string;
  plausibility: number; // 0–100 player-legible score, NOT canonical
  notes?: string;
}

/** Player-legible unresolved case ambiguity. */
export type AmbiguityType =
  'conflicting_statements' | 'open_interpretation' | 'missing_evidence' | 'procedural_gap' | 'unknown';

export interface UnresolvedAmbiguity {
  id: string;
  type: AmbiguityType;
  description: string;
  relatedEvidenceIds: string[];
  playerAssessment?: string;
}

/** Extended case file with player-legible intelligence layers.
 *  canonicalTruth remains authoritative game data, never written from storage. */
export interface ExtendedCaseFile {
  id: string;
  title: string;
  status: 'active' | 'closed';
  // canonical truth — rehydrated from deterministic seed on load, never from storage
  canonicalTruth: CaseTruth;
  // player-visible projections (never the canonical truth itself)
  playerKnowledge: string[];
  allegations: string[];
  admissibleMaterial: string[];
  unresolvedAmbiguities: UnresolvedAmbiguity[];
  // evidence with authenticity tracking
  evidence: EvidenceItemWithAuth[];
  // hidden motives per party (player-legible)
  hiddenMotives: HiddenMotiveRecord[];
  // applicable law framework
  applicableLaw: ApplicableLaw[];
  // strategic approaches available to the player
  strategicApproaches: StrategicApproachRecord[];
  // possible consequences (some may be triggered during gameplay)
  consequences: ConsequenceRecord[];
}

/** Evidence item with authenticity tracking — player can discover/authenticate,
 *  but actual authenticity is part of case truth, not directly settable. */
export interface EvidenceItemWithAuth extends EvidenceItem {
  authenticity: EvidenceAuthenticity;
  authenticityRationale?: string;
}

/** Extended assignment with intelligence-layer fields. */
export interface ExtendedAssignment {
  id: string;
  day: number;
  title: string;
  description: string;
  status: AssignmentStatus;
  requiredEvidenceIds: string[];
  requiredSourceIds: string[];
  requiredNotebookKinds?: NotebookEntry['kind'][];
  requiredFlags?: string[];
  requiresRevisionLoop?: boolean;
  feedback?: string;
  intelligence?: {
    hiddenMotiveHints: string[];
    anticipatedApproaches: StrategicApproach[];
    keyAmbiguities: string[];
  };
}

/** Player-legible case theory claim with intelligence links. */
export interface ExtendedTheoryClaim {
  id: string;
  day: number;
  text: string;
  status: TheoryStatus;
  evidenceIds: string[];
  authenticityNotes?: string; // player-legible, not canonical
  linkedHiddenMotiveIds: string[];
}

/** Player-legible review round with intelligence context. */
export interface ExtendedReviewRound {
  id: string;
  day: number;
  assignmentId: string;
  round: number;
  status: 'needs_revision' | 'accepted';
  feedback: string;
  strengths: string[];
  gaps: string[];
  intelligence?: {
    hiddenMotiveConsiderations: string[];
    approachEffectiveness: StrategicApproach;
    ambiguityGaps: string[];
  };
}
