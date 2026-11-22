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
    }
  ) =>
    post<ChatMessage>(`/api/investigations/${encodeURIComponent(id)}/chat`, {
      message,
      ...(opts?.specialistKey ? { specialistKey: opts.specialistKey } : {}),
      ...(opts?.intent ? { intent: opts.intent } : {}),
      ...(opts?.depth ? { depth: opts.depth } : {}),
      ...(opts?.targetSpecialistKey ? { targetSpecialistKey: opts.targetSpecialistKey } : {}),
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
};

/** Convert an unknown error into a short, user-facing message. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}
