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
}

export interface DialogueScene {
  id: string;
  characterId: string;
  prompt: string;
  minDay: number;
  once: boolean;
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

export type SourceVerificationStatus = 'verified' | 'unverified' | 'placeholder';

export interface LegalSource {
  id: string;
  title: string;
  citation: string;
  sourceType: 'statute' | 'judgment' | 'rule' | 'commentary' | 'summary';
  jurisdiction: 'India' | 'Fictional';
  verificationStatus: SourceVerificationStatus;
  provenance: string;
  effectiveDate?: string;
  notes?: string;
}

export interface NotebookEntry {
  id: string;
  day: number;
  kind: 'note' | 'provision' | 'fact' | 'mistake' | 'feedback' | 'research' | 'contradiction';
  title: string;
  content: string;
  sourceId?: string;
  source?: string;
  verified?: boolean;
  /** Set on contradiction/corroboration notes so the source item is traceable. */
  evidenceId?: string;
  relation?: 'contradiction' | 'corroboration';
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
}
