/**
 * M7 Real-World Discovery & Knowledge Retention — server orchestration.
 *
 * HARD INVARIANTS (enforced here, not just in the pure modules):
 * - No canonical_truth read/write anywhere in this file. No hidden evidence,
 *   no canonical solution, no answer criteria in any returned object.
 * - Deterministic evaluation is the ONLY authority for `accepted`. The optional
 *   LLM is bounded, advisory, and can never grant acceptance or release
 *   evidence. There is no LLM call on GET/snapshot/detail paths.
 * - Unlocks are PRE-AUTHORED. Non-action unlocks expose safe authored content;
 *   action unlocks call recordInvestigationAction (the existing progression
 *   authority). Nothing here inserts into evidence_discoveries.
 * - Player source refs are stored verbatim as player-provided strings. They are
 *   never fetched, opened or scraped.
 *
 * All methods are scoped by userId as well as investigationId, and every
 * outgoing object passes through the public DTO allowlists and leak scanners.
 */

import {
  getInvestigationById,
  query,
  getCaseById,
  getEvidenceByCase,
  getKnowledgeArtifactsByCase,
  getDiscoveryClueStates,
  getDiscoveryClueState,
  upsertDiscoveryClueState,
  createDiscoverySubmission,
  listDiscoverySubmissions,
  getKnowledgeMemoryItemBySubject,
  getKnowledgeMemoryItemById,
  listKnowledgeMemoryItems,
  upsertKnowledgeMemoryItem,
  updateKnowledgeMemoryRecall,
  upsertKnowledgeMemoryCase,
  listKnowledgeMemoryCases,
  upsertKnowledgeMemoryLink,
  listKnowledgeMemoryLinks,
  createKnowledgeRecallEvent,
  listKnowledgeRecallEvents,
  getDiscoveryUnlocks,
  getDiscoveryUnlock,
  createDiscoveryUnlockIfMissing,
  markDiscoveryActionUnlockApplied,
  type DiscoveryClueState,
  type DiscoverySubmission,
  type KnowledgeMemoryItem,
  type DiscoveryUnlock as DiscoveryUnlockRow,
  type Investigation,
} from './db';
import {
  getCheckpointState,
  recordInvestigationAction,
  type ProgressionResult,
} from './mystery-engine';
import { getPackageByCaseTitle, findDiscoveryClue } from './discovery-clues/registry';
import { checkClueEligibility, isClueEligible, nextSurfacedClues, normalizeRef } from './discovery-clues/eligibility';
import { evaluateSubmission } from './discovery-clues/evaluation';
import {
  buildEvaluationPrompt,
  mergeLlmAssessment,
  parseLlmAssessment,
  type LlmAssessment,
} from './discovery-clues/evaluation-prompts';
import {
  applyRecallOutcome,
  initialSchedule,
  isDue,
  recallKindForContext,
  MEMORY_SCHEDULING,
} from './discovery-clues/memory';
import {
  toSafeCitationDTO,
  toSafeDiscoveryClueDTO,
  toSafeUnlockDTO,
  toSafeSubmissionDTO,
  toSafeMemoryItemDTO,
  type SafeDiscoveryClueDTO,
  type SafeSubmissionDTO,
  type SafeMemoryItemDTO,
} from './discovery-clues/dto';
import {
  assertNoInternalLeaks,
  clipText,
  containsInternalLeakTerm,
  scanForForbiddenTerms,
} from './discovery-clues/safety';
import { resolveLlmConfig, requestChatCompletion } from './llm-provider';
import {
  UNLOCK_KINDS,
  type DiscoveryClue,
  type DiscoveryCluePackage,
  type DiscoverySubmissionInput,
  type EvaluationResult,
  type VisibleDiscoveryState,
  type UnlockKind,
} from './discovery-clues/types';

// ---------------------------------------------------------------------------
// Limits, disclaimers and error type
// ---------------------------------------------------------------------------

export const DISCOVERY_LIMITS = {
  maxExplanationChars: 4_000,
  maxFieldChars: 2_000,
  maxUncertaintyChars: 1_000,
  maxSourceRefs: 10,
  maxSourceRefChars: 300,
  maxRecallResponseChars: 3_000,
  maxJournalDuePrompts: 2,
  maxContextualRecallPrompts: 1,
  maxRelatedLinks: 3,
  maxAttemptsForLlm: 3,
  llmTimeoutMs: 8_000,
} as const;

export const DISCOVERY_DISCLAIMER =
  'Discovery material is real-world or in-world context for study and reflection. ' +
  'It is not case evidence, does not affect your verdict, and never reveals hidden case truth. ' +
  'Accepting a discovery never releases evidence directly.';

/** Route-friendly error with an explicit HTTP status. */
export class DiscoveryError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'DiscoveryError';
    this.status = status;
  }
}

function asIso(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Public DTO shapes
// ---------------------------------------------------------------------------

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
  /** Only present for pre-authored `action` unlocks. */
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
  progression: ProgressionResult | null;
  disclaimer: string;
}

export interface KnowledgeJournalDTO {
  items: SafeMemoryItemDTO[];
  duePrompts: DiscoveryRecallPromptDTO[];
  disclaimer: string;
}

export interface KnowledgeJournalSubjectDTO {
  memory: SafeMemoryItemDTO;
  applications: Array<{
    investigationId: string;
    caseId: string;
    clueKey: string;
    applicationContext: string;
    createdAt: string | null;
  }>;
  links: Array<{
    fromSubjectKey: string;
    toSubjectKey: string;
    relationship: string;
    rationale: string;
  }>;
  recallHistory: Array<{
    id: string;
    recallKind: string;
    outcome: string;
    answeredAt: string | null;
    nextDueAt: string | null;
    intervalDays: number | null;
  }>;
  disclaimer: string;
}

export interface KnowledgeRecallResultDTO {
  memory: SafeMemoryItemDTO;
  recall: {
    id: string;
    recallKind: string;
    outcome: string;
    answeredAt: string | null;
    nextDueAt: string | null;
    intervalDays: number | null;
  };
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Internal projections
// ---------------------------------------------------------------------------

function toSafeStateDTO(row: DiscoveryClueState | null): SafeDiscoveryStateDTO | null {
  if (!row) return null;
  const dto: SafeDiscoveryStateDTO = {
    clueKey: String(row.clueKey),
    state: String(row.state),
    attemptCount: Math.max(0, Number(row.attemptCount) || 0),
    surfacedAt: asIso(row.surfacedAt),
    researchStartedAt: asIso(row.researchStartedAt),
    acceptedAt: asIso(row.acceptedAt),
    lastSubmittedAt: asIso(row.lastSubmittedAt),
  };
  assertNoInternalLeaks(dto, 'discovery state DTO');
  return dto;
}

function toSafeUnlockRowDTO(row: DiscoveryUnlockRow): SafeDiscoveryUnlockRowDTO {
  const payload = row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
    ? row.payload as Record<string, unknown>
    : {};
  const kind = (UNLOCK_KINDS as readonly string[]).includes(String(row.kind))
    ? String(row.kind) as UnlockKind
    : 'insight';
  const dto: SafeDiscoveryUnlockRowDTO = {
    id: String(row.id),
    clueKey: String(row.clueKey),
    unlockKey: String(row.unlockKey),
    kind,
    targetRef: String(row.targetRef ?? ''),
    label: clipText(payload.label, 400),
    detail: clipText(payload.detail, 700),
    applied: row.appliedAt !== null && row.appliedAt !== undefined,
    action: kind === 'action' && typeof payload.action === 'string' ? clipText(payload.action, 200) : null,
  };
  assertNoInternalLeaks(dto, 'discovery unlock DTO');
  return dto;
}

function toRecallPrompt(item: KnowledgeMemoryItem, kind: string): DiscoveryRecallPromptDTO {
  const safe = toSafeMemoryItemDTO(item);
  const dto: DiscoveryRecallPromptDTO = {
    memoryId: safe.id,
    subjectLabel: safe.subjectLabel,
    kind,
    prompt: clipText(
      `Without looking it up, recall the central idea of ${safe.subjectLabel} and one place it could apply.`,
      300,
    ),
    nextDueAt: safe.nextDueAt,
  };
  assertNoInternalLeaks(dto, 'recall prompt DTO');
  return dto;
}

function toSafeRecallEventDTO(row: {
  id: string; recallKind: string; outcome: string; answeredAt: Date | string | null;
  nextDueAt: Date | string | null; intervalDays: number | null;
}) {
  const dto = {
    id: String(row.id),
    recallKind: String(row.recallKind),
    outcome: String(row.outcome),
    answeredAt: asIso(row.answeredAt),
    nextDueAt: asIso(row.nextDueAt),
    intervalDays: row.intervalDays === null || row.intervalDays === undefined ? null : Number(row.intervalDays),
  };
  assertNoInternalLeaks(dto, 'recall event DTO');
  return dto;
}

function guardOutgoing(value: unknown, _pkg: DiscoveryCluePackage | null, label: string): void {
  // Internal field names must never appear in any response. Authored leakage
  // terms (culprit name, etc.) are scanned at the point where AUTHORED content
  // is projected (toSafeDiscoveryClueDTO / toSafeUnlockPayload). We deliberately
  // do NOT scan player-authored submission text here: a player may legitimately
  // name a suspect in their own explanation, and that is not a system leak.
  assertNoInternalLeaks(value, label);
}

// ---------------------------------------------------------------------------
// Visible-state + eligibility (read-only; no writes on GET)
// ---------------------------------------------------------------------------

export async function buildDiscoveryVisibleState(
  investigation: Investigation,
  userId: string,
): Promise<VisibleDiscoveryState> {
  const [evidence, checkpointState, artifacts, states] = await Promise.all([
    getEvidenceByCase(investigation.caseId, userId),
    getCheckpointState(investigation.id),
    getKnowledgeArtifactsByCase(investigation.caseId),
    getDiscoveryClueStates(investigation.id, userId),
  ]);

  const visibleEvidenceSources = evidence
    .map((entry) => String((entry as { source?: unknown }).source ?? ''))
    .map((source) => source.trim())
    .filter(Boolean);
  const artifactKeys = artifacts
    .map((entry) => String((entry as { artifactKey?: unknown }).artifactKey ?? ''))
    .map((key) => key.trim())
    .filter(Boolean);

  return {
    visibleEvidenceSources,
    completedCheckpoints: checkpointState.completedCheckpoints.map(String),
    actionsPerformed: checkpointState.actions.filter((a) => a.performed).map((a) => String(a.action)),
    artifactKeys,
    discoveredEvidenceCount: Array.isArray(investigation.discoveredEvidenceIds)
      ? investigation.discoveredEvidenceIds.length
      : 0,
    acceptedClueKeys: states.filter((s) => s.state === 'accepted').map((s) => String(s.clueKey)),
    surfacedClueKeys: states.map((s) => String(s.clueKey)),
  };
}

interface ResolvedContext {
  investigation: Investigation;
  pkg: DiscoveryCluePackage;
  caseTitle: string;
  visibleState: VisibleDiscoveryState;
  states: DiscoveryClueState[];
}

async function resolveContext(investigationId: string, userId: string): Promise<ResolvedContext | null> {
  const investigation = await getInvestigationById(investigationId);
  if (!investigation || investigation.userId !== userId) {
    throw new DiscoveryError(404, 'Investigation not found');
  }
  const caseData = await getCaseById(investigation.caseId);
  const caseTitle = String(caseData?.title ?? '');
  const pkg = caseTitle ? getPackageByCaseTitle(caseTitle) : undefined;
  if (!pkg) return null;
  const visibleState = await buildDiscoveryVisibleState(investigation, userId);
  return { investigation, pkg, caseTitle, visibleState, states: await getDiscoveryClueStates(investigationId, userId) };
}

async function requireActiveInvestigation(investigationId: string, userId: string): Promise<Investigation> {
  const investigation = await getInvestigationById(investigationId);
  if (!investigation || investigation.userId !== userId) {
    throw new DiscoveryError(404, 'Investigation not found');
  }
  if (String(investigation.status) !== 'active') {
    throw new DiscoveryError(409, 'Investigation is not active');
  }
  return investigation;
}

function requireClue(pkg: DiscoveryCluePackage, clueKey: string): DiscoveryClue {
  const clue = pkg.clues.find((entry) => entry.key === clueKey);
  if (!clue) throw new DiscoveryError(404, 'Discovery clue not found');
  return clue;
}

/** A clue is reachable if its triggers are met or the player already started it. */
function canAccessClue(clue: DiscoveryClue, ctx: ResolvedContext): boolean {
  if (isClueEligible(clue, ctx.visibleState)) return true;
  return ctx.states.some((s) => s.clueKey === clue.key && s.state !== 'dormant');
}

// ---------------------------------------------------------------------------
// Snapshot / detail (GET — strictly read-only, no LLM)
// ---------------------------------------------------------------------------

export async function getDiscoverySnapshot(
  investigationId: string,
  userId: string,
): Promise<DiscoverySnapshotDTO> {
  const ctx = await resolveContext(investigationId, userId);
  if (!ctx) {
    const empty: DiscoverySnapshotDTO = {
      available: false,
      packageKey: null,
      version: null,
      summary: null,
      caseTitle: null,
      disclaimer: DISCOVERY_DISCLAIMER,
      clues: [],
      newClueKeys: [],
      states: [],
      memories: [],
      unlocks: [],
      recallPrompts: [],
      specialistNotices: [],
    };
    guardOutgoing(empty, null, 'discovery snapshot');
    return empty;
  }

  const { pkg, visibleState, states } = ctx;
  const stateByKey = new Map(states.map((row) => [String(row.clueKey), row]));
  const clues: SafeDiscoveryClueDTO[] = [];
  const relevantSubjectKeys = new Set<string>();

  for (const clue of pkg.clues) {
    const state = stateByKey.get(clue.key) ?? null;
    if (!canAccessClue(clue, ctx)) continue;
    const accepted = state?.state === 'accepted';
    clues.push(toSafeDiscoveryClueDTO(clue, { accepted, leakageTerms: pkg.leakageTerms }));
    relevantSubjectKeys.add(clue.subjectKey);
  }

  const memories: SafeMemoryItemDTO[] = [];
  for (const subjectKey of relevantSubjectKeys) {
    const item = await getKnowledgeMemoryItemBySubject(userId, subjectKey);
    if (item) memories.push(toSafeMemoryItemDTO(item));
  }

  const unlockRows = await getDiscoveryUnlocks(investigationId, userId);
  const acceptedKeys = new Set(states.filter((s) => s.state === 'accepted').map((s) => String(s.clueKey)));
  const unlocks = unlockRows
    .filter((row) => acceptedKeys.has(String(row.clueKey)))
    .map(toSafeUnlockRowDTO);

  const specialistNotices: DiscoverySpecialistNoticeDTO[] = [];
  for (const row of unlocks) {
    if (row.kind !== 'specialist_response') continue;
    specialistNotices.push({
      clueKey: row.clueKey,
      unlockKey: row.unlockKey,
      specialistKey: clipText(row.targetRef, 160),
      prompt: clipText(row.detail, 400),
    });
  }

  const dueItems = (await listKnowledgeMemoryItems(userId))
    .filter((item) => isDue(item.nextDueAt, new Date()))
    .slice(0, DISCOVERY_LIMITS.maxContextualRecallPrompts)
    .map((item) => toRecallPrompt(item, 'delayed_recall'));

  const newClueKeys = nextSurfacedClues(pkg.clues, visibleState, 2)
    .map((clue) => clue.key)
    .filter((key) => clues.some((dto) => dto.key === key));

  const snapshot: DiscoverySnapshotDTO = {
    available: true,
    packageKey: pkg.packageKey,
    version: pkg.version,
    summary: pkg.summary,
    caseTitle: ctx.caseTitle,
    disclaimer: DISCOVERY_DISCLAIMER,
    clues,
    newClueKeys,
    states: states.map((row) => toSafeStateDTO(row)).filter((dto): dto is SafeDiscoveryStateDTO => dto !== null),
    memories,
    unlocks,
    recallPrompts: dueItems,
    specialistNotices,
  };
  guardOutgoing(snapshot, pkg, 'discovery snapshot');
  return snapshot;
}

export async function getDiscoveryClueDetail(
  investigationId: string,
  userId: string,
  clueKey: string,
): Promise<DiscoveryClueDetailDTO | null> {
  const ctx = await resolveContext(investigationId, userId);
  if (!ctx) return null;
  const clue = ctx.pkg.clues.find((entry) => entry.key === clueKey);
  if (!clue) return null;
  if (!canAccessClue(clue, ctx)) return null;

  const state = ctx.states.find((row) => row.clueKey === clue.key) ?? null;
  const accepted = state?.state === 'accepted';
  const submissions = (await listDiscoverySubmissions(investigationId, userId, clue.key))
    .map(toSafeSubmissionDTO);
  const unlockRows = accepted
    ? (await getDiscoveryUnlocks(investigationId, userId)).filter((row) => row.clueKey === clue.key)
    : [];
  let memory: SafeMemoryItemDTO | null = null;
  if (accepted) {
    const item = await getKnowledgeMemoryItemBySubject(userId, clue.subjectKey);
    memory = item ? toSafeMemoryItemDTO(item) : null;
  }

  const detail: DiscoveryClueDetailDTO = {
    clue: toSafeDiscoveryClueDTO(clue, { accepted, leakageTerms: ctx.pkg.leakageTerms }),
    state: toSafeStateDTO(state),
    submissions,
    unlocks: unlockRows.map(toSafeUnlockRowDTO),
    memory,
    disclaimer: DISCOVERY_DISCLAIMER,
  };
  guardOutgoing(detail, ctx.pkg, 'discovery clue detail');
  return detail;
}

// ---------------------------------------------------------------------------
// Research / submission
// ---------------------------------------------------------------------------

export async function startDiscoveryResearch(
  investigationId: string,
  userId: string,
  clueKey: string,
): Promise<SafeDiscoveryStateDTO> {
  await requireActiveInvestigation(investigationId, userId);
  const ctx = await resolveContext(investigationId, userId);
  if (!ctx) throw new DiscoveryError(404, 'Discovery package not found');
  const clue = requireClue(ctx.pkg, clueKey);
  if (!canAccessClue(clue, ctx)) throw new DiscoveryError(404, 'Discovery clue not found');

  const existing = ctx.states.find((row) => row.clueKey === clue.key) ?? null;
  if (existing && (existing.state === 'accepted' || existing.state === 'submitted')) {
    const dto = toSafeStateDTO(existing);
    if (!dto) throw new Error('[M7] missing state projection');
    guardOutgoing(dto, ctx.pkg, 'discovery research state');
    return dto;
  }

  const sourceContext: Record<string, unknown> = {
    visibleEvidenceSources: ctx.visibleState.visibleEvidenceSources.slice(0, 20),
    completedCheckpoints: ctx.visibleState.completedCheckpoints.slice(0, 20),
    actionsPerformed: ctx.visibleState.actionsPerformed.slice(0, 20),
    artifactKeys: ctx.visibleState.artifactKeys.slice(0, 20),
    discoveredEvidenceCount: ctx.visibleState.discoveredEvidenceCount,
  };
  const now = nowIso();
  const row = await upsertDiscoveryClueState({
    investigationId,
    userId,
    caseId: ctx.investigation.caseId,
    clueKey: clue.key,
    state: 'researching',
    surfacedAt: now,
    researchStartedAt: now,
    attemptCount: existing?.attemptCount ?? 0,
    sourceContext,
  });
  const dto = toSafeStateDTO(row);
  if (!dto) throw new Error('[M7] missing state projection');
  guardOutgoing(dto, ctx.pkg, 'discovery research state');
  return dto;
}

export interface DiscoverySubmissionPayload {
  explanation: string;
  subjectIdentification: string;
  connectionExplanation: string;
  uncertainty: string;
  sourceRefs: readonly string[];
  confidence: 'low' | 'medium' | 'high' | null;
}

function validateSubmissionPayload(value: unknown): DiscoverySubmissionPayload {
  const body = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const field = (key: string, max: number, required: boolean): string => {
    const raw = body[key];
    if (typeof raw !== 'string') {
      if (required) throw new DiscoveryError(400, `${key} is required`);
      return '';
    }
    const text = raw.trim();
    if (required && !text) throw new DiscoveryError(400, `${key} is required`);
    if (text.length > max) throw new DiscoveryError(400, `${key} is too long`);
    return text;
  };
  const sourceRefs = Array.isArray(body.sourceRefs)
    ? body.sourceRefs
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => clipText(entry, DISCOVERY_LIMITS.maxSourceRefChars))
      .filter(Boolean)
      .slice(0, DISCOVERY_LIMITS.maxSourceRefs)
    : [];
  const confidence = body.confidence === 'low' || body.confidence === 'medium' || body.confidence === 'high'
    ? body.confidence
    : null;
  return {
    explanation: field('explanation', DISCOVERY_LIMITS.maxExplanationChars, true),
    subjectIdentification: field('subjectIdentification', DISCOVERY_LIMITS.maxFieldChars, false),
    connectionExplanation: field('connectionExplanation', DISCOVERY_LIMITS.maxFieldChars, false),
    uncertainty: field('uncertainty', DISCOVERY_LIMITS.maxUncertaintyChars, false),
    sourceRefs,
    confidence,
  };
}

async function optionalAdvisory(
  clue: DiscoveryClue,
  submission: DiscoverySubmissionInput,
  deterministic: EvaluationResult,
  attemptCount: number,
): Promise<{ advisory: LlmAssessment | null; used: boolean }> {
  const cfg = resolveLlmConfig();
  const ambiguous = !deterministic.accepted && (
    deterministic.classification === 'partial' ||
    deterministic.classification === 'alternative_interpretation' ||
    deterministic.classification === 'unsupported'
  );
  if (!cfg.enabled || !ambiguous || attemptCount >= DISCOVERY_LIMITS.maxAttemptsForLlm) {
    return { advisory: null, used: false };
  }
  // Prompt contains only public clue text + player text (no criteria, no
  // correctedUnderstanding, no canonical truth). Timeout/failure -> null.
  const raw = await requestChatCompletion(
    buildEvaluationPrompt(clue, submission),
    'Return only the JSON assessment object.',
    { maxTokens: 320, timeoutMs: DISCOVERY_LIMITS.llmTimeoutMs },
  );
  if (!raw || containsInternalLeakTerm(raw)) return { advisory: null, used: false };
  const advisory = parseLlmAssessment(raw);
  return { advisory, used: advisory !== null };
}

/** Derive bounded, authored-data-only relationships for the memory graph. */
function deriveRelatedSubjects(
  clue: DiscoveryClue,
  pkg: DiscoveryCluePackage,
): Array<{ subjectKey: string; rationale: string }> {
  const authored = (clue as { relatedSubjectKeys?: unknown }).relatedSubjectKeys;
  if (Array.isArray(authored)) {
    return authored
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .slice(0, DISCOVERY_LIMITS.maxRelatedLinks)
      .map((subjectKey) => ({ subjectKey, rationale: 'Authored relationship between these subjects.' }));
  }
  const refs = new Set(clue.evidenceRefs.map(normalizeRef).filter(Boolean));
  return pkg.clues
    .filter((other) => other.key !== clue.key && other.subjectKey !== clue.subjectKey)
    .map((other) => {
      const shared = other.evidenceRefs.map(normalizeRef).filter((ref) => refs.has(ref));
      return { other, shared };
    })
    .filter((entry) => entry.shared.length > 0)
    .slice(0, DISCOVERY_LIMITS.maxRelatedLinks)
    .map((entry) => ({
      subjectKey: entry.other.subjectKey,
      rationale: clipText(`Both subjects are grounded in the case record: ${entry.shared[0] ?? 'shared context'}.`, 240),
    }));
}

export async function submitDiscovery(
  investigationId: string,
  userId: string,
  clueKey: string,
  rawInput: unknown,
): Promise<DiscoverySubmitResultDTO> {
  await requireActiveInvestigation(investigationId, userId);
  const ctx = await resolveContext(investigationId, userId);
  if (!ctx) throw new DiscoveryError(404, 'Discovery package not found');
  const clue = requireClue(ctx.pkg, clueKey);
  if (!canAccessClue(clue, ctx)) throw new DiscoveryError(404, 'Discovery clue not found');

  const input: DiscoverySubmissionInput = validateSubmissionPayload(rawInput);
  const existing = ctx.states.find((row) => row.clueKey === clue.key) ?? null;

  // Duplicate guard: an accepted clue is final for this investigation. Return
  // the existing safe result without inserting another submission or unlock.
  if (existing?.state === 'accepted') {
    const memory = await getKnowledgeMemoryItemBySubject(userId, clue.subjectKey);
    const unlockRows = (await getDiscoveryUnlocks(investigationId, userId))
      .filter((row) => row.clueKey === clue.key)
      .map(toSafeUnlockRowDTO);
    const stateDto = toSafeStateDTO(existing);
    if (!stateDto) throw new Error('[M7] missing state projection');
    const result: DiscoverySubmitResultDTO = {
      submission: null,
      accepted: true,
      classification: 'established',
      correctedUnderstanding: memory ? String(memory.correctedUnderstanding) : clue.correctedUnderstanding,
      memoryItemId: memory?.id ?? null,
      unlocks: unlockRows,
      duplicate: true,
      state: stateDto,
      disclaimer: DISCOVERY_DISCLAIMER,
    };
    guardOutgoing(result, ctx.pkg, 'duplicate discovery result');
    return result;
  }

  const deterministic = evaluateSubmission(clue, input);
  const { advisory, used } = await optionalAdvisory(clue, input, deterministic, existing?.attemptCount ?? 0);
  // mergeLlmAssessment CANNOT change accepted/classification. Deterministic wins.
  const merged = mergeLlmAssessment(deterministic, advisory);

  const submissionRow = await createDiscoverySubmission({
    investigationId,
    userId,
    clueKey: clue.key,
    explanation: input.explanation,
    subjectIdentification: input.subjectIdentification,
    connectionExplanation: input.connectionExplanation,
    uncertainty: input.uncertainty,
    sourceRefs: input.sourceRefs,
    confidence: input.confidence,
    evaluation: {
      reasons: merged.reasons,
      matchedEssential: merged.matchedEssential,
      matchedOptional: merged.matchedOptional,
      missingEssential: merged.missingEssential,
      misconceptions: merged.misconceptions,
      confidentMisinformation: merged.confidentMisinformation,
      subjectMatched: merged.subjectMatched,
      matchedConnection: merged.matchedConnection,
      llmAdvisory: merged.llmAdvisory,
    },
    classification: merged.classification,
    accepted: merged.accepted,
    score: merged.score,
    llmUsed: used,
  });

  const now = nowIso();
  let memoryItemId: string | null = null;
  let unlockRows: SafeDiscoveryUnlockRowDTO[] = [];
  let correctedUnderstanding: string | null = null;

  if (merged.accepted) {
    const schedule = initialSchedule(new Date());
    const memory = await upsertKnowledgeMemoryItem({
      userId,
      subjectKey: clue.subjectKey,
      subjectLabel: clue.subjectLabel,
      referenceCategory: clue.referenceCategory,
      knowledgeStatus: clue.knowledgeStatus,
      // Safe, human-readable tags only - never evaluator concept keys/aliases.
      concepts: [clue.subjectLabel, clue.referenceCategory],
      correctedUnderstanding: clue.correctedUnderstanding,
      originalExplanation: input.explanation,
      latestExplanation: input.explanation,
      authoredSources: clue.citations.map((citation) => toSafeCitationDTO(citation).bibliographyRef),
      playerSources: input.sourceRefs,
      caseId: ctx.investigation.caseId,
      investigationId,
      clueKey: clue.key,
      nextDueAt: schedule.nextDueAt,
    });
    memoryItemId = memory.id;
    correctedUnderstanding = clue.correctedUnderstanding;

    await upsertKnowledgeMemoryCase({
      memoryItemId: memory.id,
      userId,
      investigationId,
      caseId: ctx.investigation.caseId,
      clueKey: clue.key,
      applicationContext: clipText(clue.title, 200),
    });

    for (const related of deriveRelatedSubjects(clue, ctx.pkg)) {
      const target = await getKnowledgeMemoryItemBySubject(userId, related.subjectKey);
      if (!target || target.id === memory.id) continue;
      const pair = [memory.subjectKey, target.subjectKey].sort();
      await upsertKnowledgeMemoryLink({
        userId,
        fromMemoryId: memory.id,
        toMemoryId: target.id,
        fromSubjectKey: memory.subjectKey,
        toSubjectKey: target.subjectKey,
        pairKey: pair.join('|'),
        relationship: 'related',
        rationale: related.rationale,
      });
    }

    for (const unlock of clue.unlocks) {
      const safe = toSafeUnlockPayload(unlock, ctx.pkg.leakageTerms);
      const row = await createDiscoveryUnlockIfMissing({
        investigationId,
        userId,
        clueKey: clue.key,
        unlockKey: unlock.key,
        kind: unlock.kind,
        targetRef: unlock.targetRef,
        payload: safe,
      });
      unlockRows.push(toSafeUnlockRowDTO(row));
    }

    // Link the submission to its memory row for traceability (no extra write
    // surface beyond an explicit column update).
    await query(
      `UPDATE discovery_submissions SET memory_item_id = $2 WHERE id = $1 AND user_id = $3`,
      [submissionRow.id, memory.id, userId],
    );
  }

  const stateRow = await upsertDiscoveryClueState({
    investigationId,
    userId,
    caseId: ctx.investigation.caseId,
    clueKey: clue.key,
    state: merged.accepted ? 'accepted' : 'submitted',
    acceptedAt: merged.accepted ? now : null,
    lastSubmittedAt: now,
    attemptCount: (existing?.attemptCount ?? 0) + 1,
  });

  const result: DiscoverySubmitResultDTO = {
    submission: toSafeSubmissionDTO({ ...submissionRow, memoryItemId }),
    accepted: merged.accepted,
    classification: merged.classification,
    correctedUnderstanding,
    memoryItemId,
    unlocks: unlockRows,
    duplicate: false,
    state: toSafeStateDTO(stateRow) as SafeDiscoveryStateDTO,
    disclaimer: DISCOVERY_DISCLAIMER,
  };
  guardOutgoing(result, ctx.pkg, 'discovery submission result');
  return result;
}

/** Persist only the public unlock allowlist projection plus the authored action. */
function toSafeUnlockPayload(
  unlock: DiscoveryClue['unlocks'][number],
  leakageTerms: readonly string[],
): Record<string, unknown> {
  const safe = toSafeUnlockDTO(unlock);
  if (scanForForbiddenTerms(JSON.stringify(safe), leakageTerms)) {
    throw new Error('[M7 SAFETY] unlock payload contained a leakage term');
  }
  const payload: Record<string, unknown> = { ...safe };
  if (unlock.kind === 'action') payload.action = unlock.action;
  return payload;
}

// ---------------------------------------------------------------------------
// Unlock application
// ---------------------------------------------------------------------------

export async function applyDiscoveryUnlock(
  investigationId: string,
  userId: string,
  clueKey: string,
  unlockKey: string,
): Promise<DiscoveryUnlockApplyResultDTO> {
  await requireActiveInvestigation(investigationId, userId);
  const ctx = await resolveContext(investigationId, userId);
  if (!ctx) throw new DiscoveryError(404, 'Discovery package not found');
  const row = await getDiscoveryUnlock(investigationId, userId, unlockKey);
  if (!row || row.clueKey !== clueKey) throw new DiscoveryError(404, 'Unlock not found');
  const unlock = toSafeUnlockRowDTO(row);
  if (unlock.kind !== 'action' || !unlock.action) {
    throw new DiscoveryError(400, 'This unlock is informational and has no action to apply');
  }
  const clueState = ctx.states.find((s) => s.clueKey === row.clueKey);
  if (clueState?.state !== 'accepted') {
    throw new DiscoveryError(409, 'The discovery for this unlock has not been accepted');
  }
  if (unlock.applied) {
    const result: DiscoveryUnlockApplyResultDTO = {
      unlock,
      applied: false,
      alreadyApplied: true,
      progression: null,
      disclaimer: DISCOVERY_DISCLAIMER,
    };
    guardOutgoing(result, ctx.pkg, 'discovery unlock apply');
    return result;
  }

  // recordInvestigationAction is the ONLY evidence-release authority here. It
  // returns null for unknown actions / inactive investigations.
  const progression = await recordInvestigationAction(investigationId, unlock.action);
  if (!progression) {
    throw new DiscoveryError(409, 'The authored action could not be recorded');
  }
  const marked = await markDiscoveryActionUnlockApplied(row.id, investigationId, userId, nowIso());
  const result: DiscoveryUnlockApplyResultDTO = {
    unlock: { ...unlock, applied: true },
    applied: marked,
    alreadyApplied: !marked,
    progression,
    disclaimer: DISCOVERY_DISCLAIMER,
  };
  guardOutgoing(result, ctx.pkg, 'discovery unlock apply');
  return result;
}

// ---------------------------------------------------------------------------
// Knowledge journal / recall
// ---------------------------------------------------------------------------

export async function getKnowledgeJournal(userId: string): Promise<KnowledgeJournalDTO> {
  const items = await listKnowledgeMemoryItems(userId);
  const now = new Date();
  const duePrompts = items
    .filter((item) => isDue(item.nextDueAt, now))
    .slice(0, DISCOVERY_LIMITS.maxJournalDuePrompts)
    .map((item) => toRecallPrompt(item, 'delayed_recall'));
  const result: KnowledgeJournalDTO = {
    items: items.map(toSafeMemoryItemDTO),
    duePrompts,
    disclaimer: DISCOVERY_DISCLAIMER,
  };
  guardOutgoing(result, null, 'knowledge journal');
  return result;
}

export async function getKnowledgeJournalSubject(
  userId: string,
  subjectKey: string,
): Promise<KnowledgeJournalSubjectDTO | null> {
  const item = await getKnowledgeMemoryItemBySubject(userId, subjectKey);
  if (!item) return null;
  const [applications, links, events] = await Promise.all([
    listKnowledgeMemoryCases(item.id, userId),
    listKnowledgeMemoryLinks(userId, item.id),
    listKnowledgeRecallEvents(item.id, userId),
  ]);
  const result: KnowledgeJournalSubjectDTO = {
    memory: toSafeMemoryItemDTO(item),
    applications: applications.map((row) => ({
      investigationId: String(row.investigationId),
      caseId: String(row.caseId),
      clueKey: String(row.clueKey),
      applicationContext: clipText(row.applicationContext, 240),
      createdAt: asIso(row.createdAt),
    })),
    links: links.map((row) => ({
      fromSubjectKey: String(row.fromSubjectKey),
      toSubjectKey: String(row.toSubjectKey),
      relationship: String(row.relationship),
      rationale: clipText(row.rationale, 300),
    })),
    recallHistory: events.map(toSafeRecallEventDTO),
    disclaimer: DISCOVERY_DISCLAIMER,
  };
  guardOutgoing(result, null, 'knowledge journal subject');
  return result;
}

export interface RecallPayload {
  response: string;
  outcome: 'success' | 'partial' | 'missed';
  investigationId?: string | null;
  clueKey?: string | null;
}

function validateRecallPayload(value: unknown): RecallPayload {
  const body = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const outcome = body.outcome;
  if (outcome !== 'success' && outcome !== 'partial' && outcome !== 'missed') {
    throw new DiscoveryError(400, 'outcome must be success, partial or missed');
  }
  if (typeof body.response !== 'string' || !body.response.trim()) {
    throw new DiscoveryError(400, 'response is required');
  }
  if (body.response.length > DISCOVERY_LIMITS.maxRecallResponseChars) {
    throw new DiscoveryError(400, 'response is too long');
  }
  const investigationId = typeof body.investigationId === 'string' && body.investigationId
    ? clipText(body.investigationId, 80)
    : null;
  const clueKey = typeof body.clueKey === 'string' && body.clueKey
    ? clipText(body.clueKey, 160)
    : null;
  return {
    response: body.response.trim(),
    outcome,
    investigationId,
    clueKey,
  };
}

export async function submitRecall(
  userId: string,
  memoryId: string,
  rawInput: unknown,
): Promise<KnowledgeRecallResultDTO | null> {
  const item = await getKnowledgeMemoryItemById(memoryId, userId);
  if (!item) return null;
  const input = validateRecallPayload(rawInput);

  const [applications, events] = await Promise.all([
    listKnowledgeMemoryCases(item.id, userId),
    listKnowledgeRecallEvents(item.id, userId),
  ]);
  const distinctContexts = Math.max(1, applications.length);
  const successfulRecalls = Math.max(0, Number(item.successfulRecalls) || 0) +
    (input.outcome === 'success' || input.outcome === 'partial' ? 1 : 0);
  const failedRecalls = Math.max(0, Number(item.failedRecalls) || 0) + (input.outcome === 'missed' ? 1 : 0);
  const latestInterval = events.length > 0 && events[0]?.intervalDays !== null && events[0]?.intervalDays !== undefined
    ? Number(events[0].intervalDays)
    : MEMORY_SCHEDULING.initialIntervalDays;

  const now = new Date();
  // applyRecallOutcome never downgrades mastery on a missed recall.
  const decision = applyRecallOutcome({
    intervalDays: latestInterval,
    masteryStatus: (item.masteryStatus === 'developing' || item.masteryStatus === 'proficient' || item.masteryStatus === 'mastered'
      ? item.masteryStatus : 'new'),
    successfulRecalls,
    failedRecalls,
    distinctContexts,
  }, input.outcome, now);

  const recallKind = recallKindForContext({
    isInitial: events.length === 0,
    sameCase: input.investigationId
      ? applications.some((app) => app.investigationId === input.investigationId)
      : false,
    sameClue: input.clueKey
      ? applications.some((app) => app.clueKey === input.clueKey)
      : false,
  });

  const event = await createKnowledgeRecallEvent({
    userId,
    memoryItemId: item.id,
    investigationId: input.investigationId ?? null,
    clueKey: input.clueKey ?? null,
    recallKind,
    prompt: clipText(`Recall ${item.subjectLabel}`, 240),
    response: clipText(input.response, DISCOVERY_LIMITS.maxRecallResponseChars),
    outcome: input.outcome,
    scheduledFor: asIso(item.nextDueAt),
    answeredAt: now.toISOString(),
    intervalDays: decision.intervalDays,
    nextDueAt: decision.nextDueAt,
  });

  const updated = await updateKnowledgeMemoryRecall(item.id, userId, {
    lastRecallAt: now.toISOString(),
    lastSuccessfulRecallAt: input.outcome === 'missed' ? null : now.toISOString(),
    nextDueAt: decision.nextDueAt,
    masteryStatus: decision.masteryStatus,
    successfulRecalls,
    failedRecalls,
  });
  if (!updated) throw new DiscoveryError(404, 'Knowledge memory item not found');

  const result: KnowledgeRecallResultDTO = {
    memory: toSafeMemoryItemDTO(updated),
    recall: toSafeRecallEventDTO(event),
    disclaimer: DISCOVERY_DISCLAIMER,
  };
  guardOutgoing(result, null, 'knowledge recall result');
  return result;
}

// ---------------------------------------------------------------------------
// Notebook source snapshot (kind: discovery_memory)
// ---------------------------------------------------------------------------

/**
 * Build a compact, owner-scoped provenance snapshot for a notebook entry.
 * Caller must have already verified that `memoryId` belongs to `userId`.
 */
export async function toNotebookDiscoverySnapshot(
  userId: string,
  memoryId: string,
  clueKey?: string | null,
): Promise<Record<string, unknown> | null> {
  const item = await getKnowledgeMemoryItemById(memoryId, userId);
  if (!item) return null;
  const safe = toSafeMemoryItemDTO(item);
  const snapshot: Record<string, unknown> = {
    kind: 'discovery_memory',
    discoveryMemoryId: safe.id,
    discoveryClueKey: clueKey ?? safe.firstClueKey ?? null,
    subjectKey: safe.subjectKey,
    subjectLabel: safe.subjectLabel,
    correctedUnderstanding: clipText(safe.correctedUnderstanding, 600),
    concepts: safe.concepts.slice(0, 6),
    citations: safe.authoredSources.slice(0, 4).map((citation) => ({
      label: clipText(citation.label, 200),
      bibliographyRef: clipText(citation.bibliographyRef, 300),
      sourceUrl: citation.sourceUrl,
      sourceVerified: citation.sourceVerified,
      verificationStatus: citation.verificationStatus,
    })),
    disclaimer: DISCOVERY_DISCLAIMER,
  };
  assertNoInternalLeaks(snapshot, 'notebook discovery snapshot');
  return snapshot;
}
