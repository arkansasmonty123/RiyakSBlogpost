// M3: typed authoring schema for case knowledge packs.
// ---------------------------------------------------------------------------
// Packs are source-of-truth content files. They are loaded by the registry and
// seeded by scripts/seed-knowledge.ts. Packs NEVER store canonical truth,
// evidence UUIDs or hidden character data. Evidence references are stable,
// human-readable source/title strings, never volatile database IDs.

export type PackStatus = 'draft' | 'pending_review' | 'verified' | 'needs_reverification';

export type VerificationStatus =
  | 'draft'
  | 'pending_review'
  | 'verified'
  | 'rejected'
  | 'needs_reverification';

export type KnowledgeClass =
  | 'established_scientific'
  | 'contested_scientific'
  | 'historical'
  | 'legal'
  | 'philosophical'
  | 'religious_spiritual'
  | 'fictional_in_world';

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

export interface SpecialistPackEntry {
  key: string;
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
  depthGuidance: { plain: string; working: string; technical: string };
  realDisciplineBasis: string;
  caseRelevance: string;
  displayOrder: number;
}

export interface ArtifactPackEntry {
  key: string;
  title: string;
  artifactType: string;
  description: string;
  content: string;
  specialistKey: string | null;
  sourceAuthor: string;
  /** Always null unless a real, verified external URL has been recorded. */
  sourceUrl: string | null;
  sourceVerified: boolean;
  bibliographyRef: string;
  publicationDate: string;
  knowledgeClass: KnowledgeClass;
  reliability: string;
  relatedConcepts: string[];
  isFictional: boolean;
  usageNote: string;

  // --- M3 provenance / pedagogy fields ---
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
  verificationNotes: string;
  lastVerifiedAt?: string | null;
  claimsSupported: string[];
  learningObjectives: string[];
  relatedEvidenceRefs: string[];
  suggestedConversations: string[];
  depthContent?: { plain?: string; working?: string; technical?: string };
}

export interface DisagreementPackEntry {
  key: string;
  topic: string;
  specialistAKey: string;
  specialistBKey: string;
  positionA: string;
  positionB: string;
  disciplinaryBasis: string;
  uncertaintyNote: string;
  distinguishingEvidence: string;
  relatedArtifactKeys: string[];
}

export interface CaseKnowledgePack {
  /** Stable registry key, not a database ID. */
  key: string;
  /** Exact case title used to resolve the case ID at seed time. */
  caseTitle: string;
  version: string;
  packStatus: PackStatus;
  summary: string;
  learningObjectives: string[];
  /** Canonical-sensitive strings for this case's leakage guard (never logged). */
  leakageTerms: string[];
  specialists: SpecialistPackEntry[];
  artifacts: ArtifactPackEntry[];
  disagreements: DisagreementPackEntry[];
}
