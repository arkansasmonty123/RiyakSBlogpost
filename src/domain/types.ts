export type CareerStage =
  | 'newcomer'
  | 'intern'
  | 'junior_advocate'
  | 'independent_advocate'
  | 'established_practitioner'
  | 'senior';

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

export interface Character {
  id: string;
  name: string;
  role: string;
  portrait: 'neutral' | 'thinking' | 'smiling' | 'disappointed' | 'angry' | 'surprised';
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
}
