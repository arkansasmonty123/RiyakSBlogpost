/**
 * M7 public DTO allowlists. Nothing from src/discovery-clues internals reaches
 * a client except through these functions.
 *
 * Stripped: criteria/aliases, thresholds, leakageTerms, matched concept keys,
 * reason codes, internal evaluation JSON, all DB ids other than the safe
 * record id, and correctedUnderstanding for unaccepted clues.
 */

import { assertNoInternalLeaks, scanForForbiddenTerms, sourceUrlForCitation } from './safety';
import {
  DISCOVERY_CLASSIFICATIONS, type DiscoveryCitation, type DiscoveryClassification,
  type DiscoveryClue, type DiscoveryUnlock, type KnowledgeStatus, type MasteryStatus,
  type UnlockKind,
} from './types';

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function asDateString(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------

export interface SafeCitationDTO {
  label: string;
  bibliographyRef: string;
  sourceUrl: string | null;
  sourceVerified: boolean;
  verificationStatus: string;
}

export interface SafeUnlockDTO {
  key: string;
  kind: UnlockKind;
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
  knowledgeStatus: KnowledgeStatus;
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
  classification: DiscoveryClassification;
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
  knowledgeStatus: KnowledgeStatus;
  concepts: string[];
  correctedUnderstanding: string;
  latestExplanation: string;
  firstClueKey: string | null;
  firstDiscoveredAt: string | null;
  lastRecallAt: string | null;
  nextDueAt: string | null;
  masteryStatus: MasteryStatus;
  successfulRecalls: number;
  failedRecalls: number;
  unresolvedQuestions: string[];
  followUpApplications: string[];
  authoredSources: SafeCitationDTO[];
}

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

export function toSafeCitationDTO(citation: DiscoveryCitation): SafeCitationDTO {
  const dto: SafeCitationDTO = {
    label: String(citation.label ?? ''),
    bibliographyRef: String(citation.bibliographyRef ?? ''),
    sourceUrl: sourceUrlForCitation(citation),
    sourceVerified: citation.sourceVerified === true,
    verificationStatus: String(citation.verificationStatus ?? 'pending_review'),
  };
  assertNoInternalLeaks(dto, 'citation DTO');
  return dto;
}

export function toSafeUnlockDTO(unlock: DiscoveryUnlock): SafeUnlockDTO {
  const base = { key: unlock.key, kind: unlock.kind, targetRef: unlock.targetRef };
  let dto: SafeUnlockDTO;
  switch (unlock.kind) {
    case 'insight':
      dto = { ...base, label: unlock.insight, detail: unlock.followUp };
      break;
    case 'question':
      dto = { ...base, label: unlock.question, detail: unlock.whyItMatters };
      break;
    case 'specialist_response':
      dto = { ...base, label: `Ask ${unlock.specialistKey}`, detail: unlock.prompt };
      break;
    case 'reinterpretation':
      dto = { ...base, label: 'Re-read the record', detail: `${unlock.fromReading} → ${unlock.toReading}` };
      break;
    case 'reality_map_seed':
      dto = { ...base, label: unlock.title, detail: unlock.description };
      break;
    case 'action':
      dto = { ...base, label: unlock.label, detail: 'Investigative action recorded by the server.' };
      break;
  }
  assertNoInternalLeaks(dto, 'unlock DTO');
  return dto;
}

export interface SafeClueOptions {
  accepted?: boolean;
  /** Package-level leakage guard terms, merged with clue-level terms. */
  leakageTerms?: readonly string[];
}

/** Public clue projection. correctedUnderstanding is gated on acceptance. */
export function toSafeDiscoveryClueDTO(clue: DiscoveryClue, options: SafeClueOptions = {}): SafeDiscoveryClueDTO {
  const accepted = options.accepted === true;
  const leakageTerms = [
    ...(options.leakageTerms ?? []),
    ...(clue.leakageTerms ?? []),
  ];
  const dto: SafeDiscoveryClueDTO = {
    key: clue.key,
    subjectKey: clue.subjectKey,
    subjectLabel: clue.subjectLabel,
    referenceCategory: clue.referenceCategory,
    difficulty: clue.difficulty,
    knowledgeStatus: clue.knowledgeStatus,
    title: clue.title,
    prompt: clue.prompt,
    context: clue.context,
    citations: clue.citations.map(toSafeCitationDTO),
    unlocks: clue.unlocks.map(toSafeUnlockDTO),
    evidenceRefs: [...clue.evidenceRefs],
    specialistKeys: [...clue.specialistKeys],
    accepted,
    correctedUnderstanding: accepted ? clue.correctedUnderstanding : null,
  };
  const publicText = JSON.stringify(dto);
  assertNoInternalLeaks(publicText, 'clue DTO');
  const leak = scanForForbiddenTerms(publicText, leakageTerms);
  if (leak) throw new Error(`[M7 SAFETY] clue DTO contained leakage term: ${String(leak)}`);
  return dto;
}

export interface DiscoverySubmissionRowLike {
  id: string;
  clueKey: string;
  memoryItemId: string | null;
  explanation: string;
  subjectIdentification: string;
  connectionExplanation: string;
  uncertainty: string;
  sourceRefs: unknown;
  confidence: string | null;
  classification: string;
  accepted: boolean;
  score: number | string;
  llmUsed: boolean;
  createdAt: string | Date | null;
}

/** Public submission projection. Internal evaluation JSON is never copied. */
export function toSafeSubmissionDTO(row: DiscoverySubmissionRowLike): SafeSubmissionDTO {
  const classification = (DISCOVERY_CLASSIFICATIONS as readonly string[]).includes(row.classification)
    ? row.classification as DiscoveryClassification
    : 'unsupported';
  const dto: SafeSubmissionDTO = {
    id: row.id,
    clueKey: row.clueKey,
    explanation: String(row.explanation ?? ''),
    subjectIdentification: String(row.subjectIdentification ?? ''),
    connectionExplanation: String(row.connectionExplanation ?? ''),
    uncertainty: String(row.uncertainty ?? ''),
    sourceRefs: asStringArray(row.sourceRefs),
    evaluation: {
      classification,
      accepted: row.accepted === true,
      score: Number(row.score) || 0,
      confidence: row.confidence,
      llmUsed: row.llmUsed === true,
      memoryItemId: row.memoryItemId,
    },
    createdAt: asDateString(row.createdAt),
  };
  assertNoInternalLeaks(dto, 'submission DTO');
  return dto;
}

export interface MemoryItemRowLike {
  id: string;
  subjectKey: string;
  subjectLabel: string;
  referenceCategory: string;
  knowledgeStatus: string;
  concepts: unknown;
  correctedUnderstanding: string;
  latestExplanation: string;
  firstClueKey: string | null;
  firstDiscoveredAt: string | Date | null;
  lastRecallAt: string | Date | null;
  nextDueAt: string | Date | null;
  masteryStatus: string;
  successfulRecalls: number;
  failedRecalls: number;
  unresolvedQuestions: unknown;
  followUpApplications: unknown;
  authoredSources: unknown;
}

/** Owner-scoped memory DTO. Caller must enforce ownership before projection. */
export function toSafeMemoryItemDTO(row: MemoryItemRowLike): SafeMemoryItemDTO {
  const knowledgeStatus: KnowledgeStatus =
    row.knowledgeStatus === 'contested' || row.knowledgeStatus === 'debated' || row.knowledgeStatus === 'uncertain'
      ? row.knowledgeStatus
      : 'established';
  const masteryStatus: MasteryStatus =
    row.masteryStatus === 'developing' || row.masteryStatus === 'proficient' || row.masteryStatus === 'mastered'
      ? row.masteryStatus
      : 'new';
  const authoredSources = asStringArray(row.authoredSources).map((label) => ({
    label,
    bibliographyRef: label,
    sourceUrl: null,
    sourceVerified: false,
    verificationStatus: 'pending_review',
  }));
  const dto: SafeMemoryItemDTO = {
    id: row.id,
    subjectKey: row.subjectKey,
    subjectLabel: row.subjectLabel,
    referenceCategory: row.referenceCategory,
    knowledgeStatus,
    concepts: asStringArray(row.concepts),
    correctedUnderstanding: String(row.correctedUnderstanding ?? ''),
    latestExplanation: String(row.latestExplanation ?? ''),
    firstClueKey: row.firstClueKey,
    firstDiscoveredAt: asDateString(row.firstDiscoveredAt),
    lastRecallAt: asDateString(row.lastRecallAt),
    nextDueAt: asDateString(row.nextDueAt),
    masteryStatus,
    successfulRecalls: Number(row.successfulRecalls) || 0,
    failedRecalls: Number(row.failedRecalls) || 0,
    unresolvedQuestions: asStringArray(row.unresolvedQuestions),
    followUpApplications: asStringArray(row.followUpApplications),
    authoredSources,
  };
  assertNoInternalLeaks(dto, 'memory item DTO');
  return dto;
}
