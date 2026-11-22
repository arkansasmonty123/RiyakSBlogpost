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

export interface MemoryEvent {
  id: string;
  day: number;
  summary: string;
  participants: string[];
}

export interface EvidenceItem {
  id: string;
  title: string;
  type: 'physical' | 'digital' | 'medical' | 'testimony' | 'documentary' | 'expert';
  description: string;
  discovered: boolean;
  admissibility: 'unknown' | 'admissible' | 'questionable' | 'inadmissible';
  reliability: 'unknown' | 'high' | 'medium' | 'low';
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
  kind: 'note' | 'provision' | 'fact' | 'mistake' | 'feedback' | 'research';
  title: string;
  content: string;
  sourceId?: string;
  source?: string;
  verified?: boolean;
}

export interface Assignment {
  id: string;
  day: number;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'submitted' | 'reviewed';
  requiredEvidenceIds: string[];
  requiredSourceIds: string[];
  feedback?: string;
}

export interface SaveGame {
  version: 1;
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
}
