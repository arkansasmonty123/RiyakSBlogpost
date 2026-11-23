/**
 * M6 Living Investigations Engine — shared domain types.
 *
 * HARD INVARIANTS:
 * - No canonical truth, hidden evidence, culprit, or solution data lives here.
 * - Consequences are a closed union; unknown kinds must be rejected.
 * - LLM output never mutates state. Narration is optional/presentational only.
 * - Evidence release authority remains in mystery-engine/processProgression.
 */

export const M6_EVENT_CATEGORIES = [
  'specialist_discovery',
  'witness_information',
  'evidence_development',
  'contradiction',
  'suspect_behavior',
  'team_disagreement',
  'follow_up_lead',
  'investigative_setback',
  'external_development',
] as const;
export type EventCategory = typeof M6_EVENT_CATEGORIES[number];

export const M6_EVENT_STATUSES = [
  'scheduled', 'eligible', 'resolved', 'expired', 'superseded', 'cancelled',
] as const;
export type EventStatus = typeof M6_EVENT_STATUSES[number];

export const M6_SIGNIFICANCE = ['high', 'normal', 'low'] as const;
export type EventSignificance = typeof M6_SIGNIFICANCE[number];

export const M6_ACTOR_KINDS = ['specialist', 'team', 'witness', 'external', 'system'] as const;
export type ActorKind = typeof M6_ACTOR_KINDS[number];

export type EventAnchor =
  | 'investigation_start'
  | `evidence:${string}`
  | `checkpoint:${string}`
  | `action:${string}`
  | `flag:${string}`;

export interface ActorRef {
  kind: ActorKind;
  specialistKey?: string;
  characterName?: string;
  displayName?: string;
}

export interface EventTiming {
  anchor: EventAnchor;
  afterMinutes: number;
}

export interface EventEligibility {
  requiresVisibleEvidence?: string[];   // evidence.source refs
  completedCheckpoints?: string[];
  flagsAll?: string[];
  flagsAny?: string[];
  flagsNone?: string[];
  minDiscoveredEvidence?: number;
}

export interface EventRequiredState {
  visibleEvidenceRefs?: string[];
  checkpoints?: string[];
  flagsAll?: string[];
}

export interface ResponseOption {
  kind: 'open_evidence' | 'reply_to_specialist' | 'verify_lead' | 'rebuild_hypothesis' | 'open_activity';
  label: string;
}

export interface EventPresentation {
  title: string;
  summary: string;
  detail: string;
  whyItMatters: string;
  requiresResponse: boolean;
  responseOptions?: ResponseOption[];
  upcomingTeaser?: { title: string; certainty: 'tentative' };
}

export interface EventProvenance {
  packageKey: string;
  version: string;
  specialistKey?: string;
  artifactKeys?: string[];
  evidenceRefs?: string[];
  sourceRefs?: Array<{ label: string; ref: string }>;
}

/** Closed consequence union. Anything outside this is rejected. */
export type ConsequenceDefinition =
  | { kind: 'development'; messageTemplate: string }
  | { kind: 'release_lead'; evidenceRef: string; actionLabel?: string }
  | { kind: 'new_action'; action: string; label: string }
  | { kind: 'set_flag'; flag: string; value?: Record<string, unknown> }
  | {
      kind: 'team_disagreement';
      topic: string;
      specialistAKey: string;
      specialistBKey: string;
      positionA: string;
      positionB: string;
      uncertaintyNote: string;
      targetHypothesis?: 'most_recent_open';
    }
  | {
      kind: 'suspect_behavior';
      characterName: string;
      observable: 'unavailable' | 'cooperative' | 'defensive' | 'requested_break';
      publicReason: string;
    }
  | {
      kind: 'missed_opportunity';
      flag: string;
      message: string;
      alternativeEventKey?: string;
      nonEssential?: boolean;
    }
  | { kind: 'noop' };

export interface AlternativeBranch {
  key: string;
  when: { flagsAll?: string[]; completedCheckpoints?: string[] };
  consequence: ConsequenceDefinition;
  presentation: EventPresentation;
}

export interface CaseEventDefinition {
  key: string;
  category: EventCategory;
  actor: ActorRef;
  significance: EventSignificance;
  groupKey?: string;
  timing: EventTiming;
  eligibility: EventEligibility;
  requiredState?: EventRequiredState;
  presentation: EventPresentation;
  consequence: ConsequenceDefinition;
  expiresAfterMinutes?: number;
  onExpiry?: ConsequenceDefinition;
  supersedes?: string[];
  supersededBy?: string[];
  alternatives?: AlternativeBranch[];
  provenance: Omit<EventProvenance, 'packageKey' | 'version'>;
  narration: 'template' | 'llm_optional';
}

export interface CaseEventPackage {
  caseTitle: string;
  packageKey: string;
  version: string;
  status: 'draft' | 'pending_review' | 'verified' | 'needs_reverification';
  summary: string;
  leakageTerms: string[];
  events: CaseEventDefinition[];
}

export interface InvestigationEventRow {
  id: string;
  investigationId: string;
  caseId: string;
  eventKey: string;
  eventType: EventCategory;
  idempotencyKey: string;
  status: EventStatus;
  significance: EventSignificance;
  groupKey: string | null;
  actorKind: ActorKind;
  actorKey: string | null;
  eligibleAt: string | Date;
  expiresAt: string | Date | null;
  resolvedAt: string | Date | null;
  supersedesEventId: string | null;
  supersededByEventId: string | null;
  eligibilityConditions: any;
  requiredState: any;
  consequenceDefinition: ConsequenceDefinition | any;
  presentation: EventPresentation | any;
  outcome: any;
  provenance: any;
  createdAt: string | Date;
  updatedAt: string | Date;
}

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
  category: EventCategory;
  status: EventStatus;
  significance: EventSignificance;
  groupKey: string | null;
  title: string;
  summary: string;
  detail: string;
  whyItMatters: string;
  requiresResponse: boolean;
  responseOptions: ResponseOption[];
  actor: { kind: ActorKind; displayName: string; specialistKey?: string | null };
  occurredAt: string | null;
  eligibleAt?: string | null;
  changes: SafeActivityChange[];
  relatedArtifactKeys: string[];
  provenanceLabel: 'case-package' | 'team-activity';
}

export interface ActivityGroup {
  groupKey: string;
  title: string;
  significance: EventSignificance;
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
  category: EventCategory;
  significance: EventSignificance;
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
  counts: {
    total: number;
    unread: number;
    high: number;
    byCategory: Record<string, number>;
  };
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

export interface NotificationIntent {
  userId: string;
  investigationId: string;
  eventId: string;
  category: string;
  priority: EventSignificance;
  groupKey: string | null;
  title: string;
  body: string;
  dedupeKey: string;
}
