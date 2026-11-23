/**
 * M6 Living Investigations Engine — deterministic, server-only catch-up.
 *
 * Invariants enforced here:
 *  - Canonical truth is never read; anchors resolve only from visible state.
 *  - Evidence release stays in mystery-engine.processProgression. No M6 code
 *    inserts into evidence_discoveries. `release_lead` only sets a flag and
 *    requests an idempotent post-commit progression rerun.
 *  - All timestamps come from `now` (injectable) or the server clock. Client
 *    timestamps are never accepted. Materialization is idempotent and bounded.
 *  - Player DTOs use explicit allowlists in dto.ts and are leakage-scanned.
 */

import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../db';
import { processProgression } from '../mystery-engine';
import { getPackageByCaseTitle } from '../case-events/registry';
import { anchorIsEligible, normalizeSourceRef, type AnchorContext } from './oracle';
import { assertNoInternalLeaks, clipText, scanForForbiddenTerms } from './safety';
import { buildActivitySnapshot, toSafeActivityEvent, toUpcomingTeaser } from './dto';
import {
  M6_EVENT_CATEGORIES,
  type ActivitySnapshot,
  type CaseEventDefinition,
  type CaseEventPackage,
  type CatchUpSummary,
  type ConsequenceDefinition,
  type EventCategory,
  type EventSignificance,
  type InvestigationEventRow,
  type LivingWorldResult,
  type NotificationIntent,
  type OutstandingDisagreement,
  type SafeActivityChange,
  type SafeActivityEvent,
} from './types';

const CATEGORY_SET = new Set<string>(M6_EVENT_CATEGORIES);
const MAX_EVENT_LIMIT = 50;
const DEFAULT_EVENT_LIMIT = 12;

interface InvestigationRow {
  id: string;
  userId: string | null;
  caseId: string;
  status: string;
  startTimestamp: string | Date;
  discoveredEvidenceIds: string[] | null;
  lastSeenAt: string | Date | null;
  lastEventTickAt: string | Date | null;
}

interface EvidenceMeta {
  id: string;
  source: string | null;
  playerVisible: boolean;
  hasDiscoveryConditions: boolean;
}

/** Everything eligibility and anchor resolution are allowed to look at. */
interface VisibleState {
  startMs: number;
  visibleIds: Set<string>;
  visibleSources: Set<string>;
  discoveredSourceAt: Map<string, number>;
  discoveredCount: number;
  checkpointAt: Map<string, number>;
  completedCheckpoints: Set<string>;
  actionAt: Map<string, number>;
  actions: Set<string>;
  flagAt: Map<string, number>;
  flags: Map<string, unknown>;
  evidenceBySource: Map<string, EvidenceMeta>;
}

interface Effect {
  changes: SafeActivityChange[];
  needsProgressionRerun: boolean;
  developmentMessage: string | null;
  notificationTitle: string | null;
  notificationBody: string | null;
  notificationPriority: EventSignificance;
}

const NOTIFICATION_CATEGORY: Record<EventCategory, string> = {
  specialist_discovery: 'development',
  witness_information: 'witness',
  evidence_development: 'evidence',
  contradiction: 'contradiction',
  suspect_behavior: 'suspect',
  team_disagreement: 'team',
  follow_up_lead: 'lead',
  investigative_setback: 'setback',
  external_development: 'external',
};

const EVENT_COLUMNS = `
  id, investigation_id AS "investigationId", case_id AS "caseId",
  event_key AS "eventKey", event_type AS "eventType",
  idempotency_key AS "idempotencyKey", status, significance,
  group_key AS "groupKey", actor_kind AS "actorKind", actor_key AS "actorKey",
  eligible_at AS "eligibleAt", expires_at AS "expiresAt", resolved_at AS "resolvedAt",
  supersedes_event_id AS "supersedesEventId", superseded_by_event_id AS "supersededByEventId",
  eligibility_conditions AS "eligibilityConditions", required_state AS "requiredState",
  consequence_definition AS "consequenceDefinition", presentation, outcome, provenance,
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

function emptyResult(): LivingWorldResult {
  return {
    resolved: [],
    expired: [],
    evidenceChanges: [],
    hasMore: false,
    nextEligibleAt: null,
    counts: { resolved: 0, expired: 0, materialized: 0, notifications: 0 },
  };
}

function toMs(value: string | Date | null | undefined, fallback: number): number {
  if (value === null || value === undefined) return fallback;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : fallback;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_EVENT_LIMIT;
  return Math.min(MAX_EVENT_LIMIT, Math.max(1, Math.floor(Number(value))));
}

/** All authored player-facing strings pass through here before persistence. */
function safeText(value: unknown, leakageTerms: string[], max = 400): string | null {
  const text = clipText(value, max);
  try {
    assertNoInternalLeaks(text, 'M6 authored text');
    if (scanForForbiddenTerms(text, leakageTerms)) return null;
    return text;
  } catch {
    return null;
  }
}

function actorDisplayName(def: CaseEventDefinition): string {
  return clipText(
    def.actor.displayName ?? def.actor.characterName ?? def.actor.specialistKey ?? 'Investigation Team',
    80,
  );
}

async function loadInvestigation(
  client: Pick<PoolClient, 'query'>,
  investigationId: string,
): Promise<InvestigationRow | null> {
  const result = await client.query(
    `SELECT id, user_id AS "userId", case_id AS "caseId", status,
            start_timestamp AS "startTimestamp", discovered_evidence_ids AS "discoveredEvidenceIds",
            last_seen_at AS "lastSeenAt", last_event_tick_at AS "lastEventTickAt"
       FROM investigations WHERE id = $1`,
    [investigationId],
  );
  const row = result.rows[0] as InvestigationRow | undefined;
  return row ?? null;
}

async function loadCaseTitle(client: Pick<PoolClient, 'query'>, caseId: string): Promise<string | null> {
  const result = await client.query('SELECT title FROM cases WHERE id = $1', [caseId]);
  const row = result.rows[0] as { title: string } | undefined;
  return row ? String(row.title) : null;
}

async function loadVisibleState(
  client: Pick<PoolClient, 'query'>,
  inv: InvestigationRow,
): Promise<VisibleState> {
  const fallback = Date.now();
  const startMs = toMs(inv.startTimestamp, fallback);
  const discoveredIds = new Set(asArray(inv.discoveredEvidenceIds).map((id) => String(id)));

  const evidenceRes = await client.query(
    `SELECT id, source, player_visible AS "playerVisible",
            (discovery_conditions IS NOT NULL AND discovery_conditions <> '{}'::jsonb) AS "hasDiscoveryConditions"
       FROM evidence WHERE case_id = $1`,
    [inv.caseId],
  );
  const discoveredRes = await client.query(
    'SELECT evidence_id AS "evidenceId", discovered_at AS "discoveredAt" FROM evidence_discoveries WHERE investigation_id = $1',
    [inv.id],
  );
  const discoveredAtById = new Map<string, number>();
  for (const row of discoveredRes.rows as Array<{ evidenceId: string; discoveredAt: string | Date }>) {
    discoveredAtById.set(String(row.evidenceId), toMs(row.discoveredAt, startMs));
  }

  const state: VisibleState = {
    startMs,
    visibleIds: new Set<string>(),
    visibleSources: new Set<string>(),
    discoveredSourceAt: new Map<string, number>(),
    discoveredCount: 0,
    checkpointAt: new Map<string, number>(),
    completedCheckpoints: new Set<string>(),
    actionAt: new Map<string, number>(),
    actions: new Set<string>(),
    flagAt: new Map<string, number>(),
    flags: new Map<string, unknown>(),
    evidenceBySource: new Map<string, EvidenceMeta>(),
  };

  for (const row of evidenceRes.rows as Array<{ id: string; source: string | null; playerVisible: boolean; hasDiscoveryConditions: boolean }>) {
    const id = String(row.id);
    const source = normalizeSourceRef(row.source ?? '');
    const meta: EvidenceMeta = {
      id,
      source,
      playerVisible: Boolean(row.playerVisible),
      hasDiscoveryConditions: Boolean(row.hasDiscoveryConditions),
    };
    if (source) state.evidenceBySource.set(source, meta);

    const discovered = discoveredIds.has(id) || discoveredAtById.has(id);
    if (meta.playerVisible || discovered) {
      state.visibleIds.add(id);
      if (source) state.visibleSources.add(source);
    }
    if (discovered) {
      state.discoveredCount += 1;
      if (source) state.discoveredSourceAt.set(source, discoveredAtById.get(id) ?? startMs);
    } else if (meta.playerVisible && source) {
      // Initial evidence is available from the investigation start; this makes
      // `evidence:` anchors on opening material deterministic and visible-only.
      state.discoveredSourceAt.set(source, startMs);
    }
  }

  const checkpointRes = await client.query(
    'SELECT checkpoint_id AS "checkpointId", created_at AS "createdAt" FROM deduction_checkpoints WHERE investigation_id = $1',
    [inv.id],
  );
  for (const row of checkpointRes.rows as Array<{ checkpointId: string; createdAt: string | Date }>) {
    const key = String(row.checkpointId);
    state.completedCheckpoints.add(key);
    if (!state.checkpointAt.has(key)) state.checkpointAt.set(key, toMs(row.createdAt, startMs));
  }

  const actionRes = await client.query(
    'SELECT action, created_at AS "createdAt" FROM investigation_actions WHERE investigation_id = $1',
    [inv.id],
  );
  for (const row of actionRes.rows as Array<{ action: string; createdAt: string | Date }>) {
    const key = String(row.action);
    state.actions.add(key);
    if (!state.actionAt.has(key)) state.actionAt.set(key, toMs(row.createdAt, startMs));
  }

  const flagRes = await client.query(
    'SELECT flag, value, created_at AS "createdAt" FROM investigation_flags WHERE investigation_id = $1',
    [inv.id],
  );
  for (const row of flagRes.rows as Array<{ flag: string; value: unknown; createdAt: string | Date }>) {
    const key = String(row.flag);
    state.flags.set(key, row.value);
    if (!state.flagAt.has(key)) state.flagAt.set(key, toMs(row.createdAt, startMs));
  }

  return state;
}

function anchorContext(state: VisibleState): AnchorContext {
  return {
    startMs: state.startMs,
    visibleSources: state.visibleSources,
    discoveredSourceAt: state.discoveredSourceAt,
    checkpointAt: state.checkpointAt,
    actionAt: state.actionAt,
    flagAt: state.flagAt,
  };
}

function preconditionsMet(def: CaseEventDefinition, state: VisibleState): boolean {
  const eligibility = def.eligibility ?? {};
  const required = def.requiredState ?? {};

  for (const ref of asArray(eligibility.requiresVisibleEvidence)) {
    const source = normalizeSourceRef(ref);
    if (!source || !state.visibleSources.has(source)) return false;
  }
  for (const ref of asArray(required.visibleEvidenceRefs)) {
    const source = normalizeSourceRef(ref);
    if (!source || !state.visibleSources.has(source)) return false;
  }
  for (const checkpoint of asArray(eligibility.completedCheckpoints)) {
    if (!state.completedCheckpoints.has(String(checkpoint))) return false;
  }
  for (const checkpoint of asArray(required.checkpoints)) {
    if (!state.completedCheckpoints.has(String(checkpoint))) return false;
  }
  for (const flag of asArray(eligibility.flagsAll)) {
    if (!state.flags.has(String(flag))) return false;
  }
  for (const flag of asArray(required.flagsAll)) {
    if (!state.flags.has(String(flag))) return false;
  }
  const anyFlags = asArray(eligibility.flagsAny).map(String);
  if (anyFlags.length > 0 && !anyFlags.some((flag) => state.flags.has(flag))) return false;
  for (const flag of asArray(eligibility.flagsNone)) {
    if (state.flags.has(String(flag))) return false;
  }
  if (
    typeof eligibility.minDiscoveredEvidence === 'number' &&
    state.discoveredCount < eligibility.minDiscoveredEvidence
  ) {
    return false;
  }
  return true;
}

function makeChange(
  kind: SafeActivityChange['kind'],
  label: string,
  extra?: { evidenceId?: string; action?: string; specialistKey?: string },
): SafeActivityChange {
  const change: SafeActivityChange = { kind, label };
  if (extra?.evidenceId) change.evidenceId = clipText(extra.evidenceId, 80);
  if (extra?.action) change.action = clipText(extra.action, 80);
  if (extra?.specialistKey) change.specialistKey = clipText(extra.specialistKey, 80);
  return change;
}

function emptyEffect(): Effect {
  return {
    changes: [],
    needsProgressionRerun: false,
    developmentMessage: null,
    notificationTitle: null,
    notificationBody: null,
    notificationPriority: 'normal',
  };
}

async function upsertFlag(
  client: Pick<PoolClient, 'query'>,
  invId: string,
  flag: string,
  value: Record<string, unknown>,
  sourceEventId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO investigation_flags (investigation_id, flag, value, source_event_id, created_at)
     VALUES ($1, $2, $3::jsonb, $4, NOW())
     ON CONFLICT (investigation_id, flag)
     DO UPDATE SET value = EXCLUDED.value, source_event_id = EXCLUDED.source_event_id`,
    [invId, clipText(flag, 120), JSON.stringify(value), sourceEventId],
  );
}

/** Apply a closed-union consequence. Unknown kinds are rejected (noop). */
async function applyConsequence(params: {
  client: Pick<PoolClient, 'query'>;
  invId: string;
  eventId: string;
  eventKey: string;
  def: CaseEventDefinition;
  consequence: ConsequenceDefinition;
  state: VisibleState;
  leakageTerms: string[];
  nowIso: string;
}): Promise<Effect> {
  const { client, invId, eventId, def, consequence, state, leakageTerms } = params;
  const effect = emptyEffect();
  effect.notificationPriority = def.significance;

  switch (consequence.kind) {
    case 'development': {
      const message = safeText(consequence.messageTemplate, leakageTerms, 400) ?? 'A case development was recorded.';
      effect.changes.push(makeChange('development', message));
      effect.developmentMessage = message;
      break;
    }
    case 'release_lead': {
      // Validate the target against authored, visible-state metadata only. The
      // hidden evidence id/source is NEVER written to flags, outcomes or DTOs.
      const source = normalizeSourceRef(consequence.evidenceRef);
      const target = source ? state.evidenceBySource.get(source) : undefined;
      const valid =
        target !== undefined &&
        target.source !== null &&
        !target.playerVisible &&
        target.hasDiscoveryConditions;
      if (!valid) break;
      const label = safeText(consequence.actionLabel ?? 'A new lead is available to follow.', leakageTerms, 160)
        ?? 'A new lead is available to follow.';
      await upsertFlag(client, invId, `lead:${def.key}`, { requested: true }, eventId);
      effect.changes.push(makeChange('lead', label, { action: def.key }));
      effect.developmentMessage = label;
      effect.needsProgressionRerun = true;
      break;
    }
    case 'new_action': {
      const label = safeText(consequence.label, leakageTerms, 160) ?? 'A new investigative action is available.';
      await upsertFlag(client, invId, `action_available:${consequence.action}`, { label }, eventId);
      effect.changes.push(makeChange('action', label, { action: consequence.action }));
      effect.developmentMessage = label;
      break;
    }
    case 'set_flag': {
      const value = (consequence.value && typeof consequence.value === 'object') ? consequence.value : {};
      if (safeText(JSON.stringify(value), leakageTerms, 600) === null) break;
      await upsertFlag(client, invId, consequence.flag, value, eventId);
      effect.changes.push(makeChange('flag', clipText(consequence.flag, 100)));
      break;
    }
    case 'team_disagreement': {
      const topic = safeText(consequence.topic, leakageTerms, 160) ?? 'Unresolved specialist disagreement';
      await upsertFlag(client, invId, `disagreement:${def.key}`, { topic }, eventId);
      effect.changes.push(makeChange('disagreement', topic, {
        specialistKey: consequence.specialistAKey,
      }));
      effect.developmentMessage = `The team recorded an unresolved disagreement: ${topic}.`;
      effect.notificationPriority = 'high';
      break;
    }
    case 'suspect_behavior': {
      const reason = safeText(consequence.publicReason, leakageTerms, 200) ?? 'Observable conduct was noted.';
      await upsertFlag(
        client,
        invId,
        `suspect_behavior:${consequence.characterName}`,
        { observable: consequence.observable, publicReason: reason },
        eventId,
      );
      effect.changes.push(makeChange('suspect_behavior', reason));
      effect.developmentMessage = reason;
      break;
    }
    case 'missed_opportunity': {
      const message = safeText(consequence.message, leakageTerms, 300) ?? 'An opportunity window has passed.';
      const value: Record<string, unknown> = { message };
      if (consequence.alternativeEventKey) value.alternativeEventKey = consequence.alternativeEventKey;
      if (consequence.nonEssential !== undefined) value.nonEssential = consequence.nonEssential;
      await upsertFlag(client, invId, consequence.flag, value, eventId);
      effect.changes.push(makeChange('opportunity_missed', message));
      effect.developmentMessage = message;
      break;
    }
    case 'noop':
      break;
    default:
      break;
  }

  if (effect.developmentMessage) {
    effect.notificationTitle = effect.notificationTitle ?? clipText(def.presentation?.title ?? def.key, 100);
    effect.notificationBody = effect.developmentMessage;
  }
  return effect;
}

async function insertDevelopment(params: {
  client: Pick<PoolClient, 'query'>;
  invId: string;
  eventId: string;
  actorKey: string | null;
  message: string;
}): Promise<void> {
  const { client, invId, eventId, actorKey, message } = params;
  await client.query(
    `INSERT INTO development_log (investigation_id, kind, message, source_event_id, actor_key, created_at)
     SELECT $1, 'event', $2, $3, $4, NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM development_log
         WHERE investigation_id = $1 AND source_event_id = $3 AND message = $2
      )`,
    [invId, clipText(message, 1000), eventId, actorKey],
  );
}

async function insertNotification(params: {
  client: Pick<PoolClient, 'query'>;
  intent: NotificationIntent;
}): Promise<boolean> {
  const { client, intent } = params;
  const title = safeText(intent.title, [], 100);
  const body = safeText(intent.body, [], 300);
  if (!title || !body) return false;
  const result = await client.query(
    `INSERT INTO notifications
       (user_id, investigation_id, event_id, category, priority, group_key, title, body, dedupe_key, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'unread', NOW())
     ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
    [
      intent.userId, intent.investigationId, intent.eventId,
      clipText(intent.category, 40), intent.priority,
      intent.groupKey ? clipText(intent.groupKey, 60) : null,
      title, body, clipText(intent.dedupeKey, 200),
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

async function markSuperseded(
  client: Pick<PoolClient, 'query'>,
  invId: string,
  row: InvestigationEventRow,
  keys: string[],
  nowIso: string,
): Promise<void> {
  if (keys.length === 0) return;
  const targets = await client.query(
    `SELECT id FROM investigation_events
      WHERE investigation_id = $1 AND event_key = ANY($2::text[])
        AND status IN ('scheduled', 'eligible')`,
    [invId, keys],
  );
  const ids = (targets.rows as Array<{ id: string }>).map((r) => String(r.id));
  if (ids.length === 0) return;
  await client.query(
    `UPDATE investigation_events
        SET status = 'superseded', superseded_by_event_id = $2, resolved_at = $3, updated_at = $3
      WHERE id = ANY($1::uuid[]) AND status IN ('scheduled', 'eligible')`,
    [ids, row.id, nowIso],
  );
  const first = ids[0];
  if (first && !row.supersedesEventId) {
    await client.query(
      'UPDATE investigation_events SET supersedes_event_id = $2, updated_at = $3 WHERE id = $1',
      [row.id, first, nowIso],
    );
  }
}

function safeEvent(row: InvestigationEventRow, leakageTerms: string[]): SafeActivityEvent {
  if (!CATEGORY_SET.has(String(row.eventType))) throw new Error('invalid-event-category');
  return toSafeActivityEvent(row, { leakageTerms });
}

/** Materialize anchor-resolvable instances. Idempotent by (investigation, idempotency_key). */
async function materializeEvents(
  client: Pick<PoolClient, 'query'>,
  inv: InvestigationRow,
  pkg: CaseEventPackage,
  state: VisibleState,
): Promise<number> {
  const ctx = anchorContext(state);
  let materialized = 0;

  for (const def of pkg.events) {
    // Authoring defense: drop a definition whose authored text is unsafe.
    const presentationText = safeText(JSON.stringify(def.presentation), pkg.leakageTerms, 4000);
    if (presentationText === null) continue;

    const resolution = anchorIsEligible(def.timing.anchor, ctx);
    if (!resolution.eligible || resolution.anchorMs === null) continue;

    const afterMinutes = Number.isFinite(def.timing.afterMinutes)
      ? Math.max(0, Math.floor(def.timing.afterMinutes))
      : 0;
    const eligibleMs = resolution.anchorMs + afterMinutes * 60_000;
    const expiresMs =
      def.expiresAfterMinutes !== undefined && Number.isFinite(def.expiresAfterMinutes)
        ? eligibleMs + Math.max(0, Math.floor(def.expiresAfterMinutes)) * 60_000
        : null;

    const idempotencyKey = `evt:${pkg.packageKey}:${def.key}:${resolution.anchorRef}`;
    const presentation = { ...def.presentation, actorDisplayName: actorDisplayName(def) };
    const provenance = {
      specialistKey: def.provenance.specialistKey ?? null,
      artifactKeys: asArray(def.provenance.artifactKeys).slice(0, 8),
      evidenceRefs: asArray(def.provenance.evidenceRefs).slice(0, 8),
      sourceRefs: asArray(def.provenance.sourceRefs).slice(0, 4),
    };
    const actorKey =
      def.actor.kind === 'specialist'
        ? def.actor.specialistKey ?? null
        : def.actor.kind === 'witness'
          ? def.actor.characterName ?? null
          : def.actor.kind === 'external'
            ? def.actor.displayName ?? null
            : null;

    const result = await client.query(
      `INSERT INTO investigation_events
         (investigation_id, case_id, event_key, event_type, idempotency_key, status,
          significance, group_key, actor_kind, actor_key, eligible_at, expires_at,
          eligibility_conditions, required_state, consequence_definition, presentation,
          outcome, provenance, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'scheduled',$6,$7,$8,$9,$10,$11,
               $12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,'{}'::jsonb,$16::jsonb,NOW(),NOW())
       ON CONFLICT (investigation_id, idempotency_key) DO NOTHING`,
      [
        inv.id, inv.caseId, clipText(def.key, 120), clipText(def.category, 60),
        clipText(idempotencyKey, 240), def.significance,
        def.groupKey ? clipText(def.groupKey, 60) : null,
        def.actor.kind, actorKey ? clipText(actorKey, 120) : null,
        iso(eligibleMs), expiresMs === null ? null : iso(expiresMs),
        JSON.stringify(def.eligibility ?? {}),
        JSON.stringify(def.requiredState ?? {}),
        JSON.stringify(def.consequence),
        JSON.stringify(presentation),
        JSON.stringify(provenance),
      ],
    );
    materialized += result.rowCount ?? 0;
  }
  return materialized;
}

/** Materialize due/anchor-eligible events without advancing their status. */
export async function initializeInvestigationEvents(
  investigationId: string,
  now?: Date,
): Promise<void> {
  const at = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  await withTransaction(async (client) => {
    const inv = await loadInvestigation(client, investigationId);
    if (!inv || inv.status !== 'active') return;
    const title = await loadCaseTitle(client, inv.caseId);
    if (!title) return;
    const pkg = getPackageByCaseTitle(title);
    if (!pkg) return;
    const state = await loadVisibleState(client, inv);
    await materializeEvents(client, inv, pkg, state);
    await client.query('UPDATE investigations SET last_event_tick_at = $2 WHERE id = $1', [inv.id, at]);
  });
}

/** Advance one investigation deterministically from server time only. */
export async function processLivingWorld(
  investigationId: string,
  opts?: { now?: Date; maxEvents?: number },
): Promise<LivingWorldResult> {
  const now = opts?.now instanceof Date && Number.isFinite(opts.now.getTime()) ? opts.now : new Date();
  const nowMs = now.getTime();
  const nowIso = iso(nowMs);
  const maxEvents = clampLimit(opts?.maxEvents);

  const outcome = await withTransaction(async (client) => {
    const result = emptyResult();
    const inv = await loadInvestigation(client, investigationId);
    if (!inv || inv.status !== 'active') return { result, needsProgressionRerun: false };

    const title = await loadCaseTitle(client, inv.caseId);
    const pkg = title ? getPackageByCaseTitle(title) : undefined;
    if (!pkg) {
      await client.query('UPDATE investigations SET last_event_tick_at = $2 WHERE id = $1', [inv.id, nowIso]);
      return { result, needsProgressionRerun: false };
    }

    let state = await loadVisibleState(client, inv);
    result.counts.materialized = await materializeEvents(client, inv, pkg, state);

    const dueRes = await client.query(
      `SELECT ${EVENT_COLUMNS} FROM investigation_events
        WHERE investigation_id = $1 AND status IN ('scheduled','eligible') AND eligible_at <= $2
        ORDER BY eligible_at ASC, event_key ASC, id ASC
        LIMIT $3`,
      [inv.id, nowIso, maxEvents + 1],
    );
    const dueRows = dueRes.rows as InvestigationEventRow[];
    result.hasMore = dueRows.length > maxEvents;
    const batch = dueRows.slice(0, maxEvents);

    let notifications = 0;
    let needsProgressionRerun = false;

    for (const row of batch) {
      state = await loadVisibleState(client, inv);
      const def = (pkg.events.find((candidate) => candidate.key === row.eventKey));
      if (!def) continue;

      const expiresMs = row.expiresAt ? toMs(row.expiresAt, Number.POSITIVE_INFINITY) : null;
      const isExpired = expiresMs !== null && expiresMs <= nowMs;

      if (isExpired) {
        const flipped = await client.query(
          `UPDATE investigation_events SET status='expired', resolved_at=$2, updated_at=$2
            WHERE id=$1 AND status IN ('scheduled','eligible') RETURNING id`,
          [row.id, nowIso],
        );
        if ((flipped.rowCount ?? 0) === 0) continue;

        let effect = emptyEffect();
        const onExpiry = def.onExpiry;
        if (
          onExpiry?.kind === 'missed_opportunity' &&
          (onExpiry.alternativeEventKey || onExpiry.nonEssential === true)
        ) {
          effect = await applyConsequence({
            client, invId: inv.id, eventId: row.id, eventKey: row.eventKey, def,
            consequence: onExpiry, state, leakageTerms: pkg.leakageTerms, nowIso,
          });
        }
        const message = effect.developmentMessage ?? 'An opportunity window has passed.';
        const outcome = { kind: 'expired', summary: clipText(message, 300), changes: effect.changes };
        await client.query(
          'UPDATE investigation_events SET outcome=$2::jsonb, updated_at=$3 WHERE id=$1',
          [row.id, JSON.stringify(outcome), nowIso],
        );
        await insertDevelopment({
          client, invId: inv.id, eventId: row.id, actorKey: row.actorKey, message,
        });
        if (inv.userId) {
          const inserted = await insertNotification({
            client,
            intent: {
              userId: inv.userId,
              investigationId: inv.id,
              eventId: row.id,
              category: NOTIFICATION_CATEGORY[row.eventType as EventCategory] ?? 'development',
              priority: 'normal',
              groupKey: row.groupKey,
              title: def.presentation.title,
              body: message,
              dedupeKey: `inv:${inv.id}:event:${row.id}`,
            },
          });
          notifications += inserted ? 1 : 0;
        }
        try {
          result.expired.push(safeEvent(
            { ...row, status: 'expired', resolvedAt: nowIso, outcome },
            pkg.leakageTerms,
          ));
        } catch {
          console.warn(`[M6] dropped unsafe expired event ${row.id}`);
        }
        result.counts.expired += 1;
        continue;
      }

      if (!preconditionsMet(def, state)) {
        if (row.status === 'scheduled') {
          await client.query(
            `UPDATE investigation_events SET status='eligible', updated_at=$2
              WHERE id=$1 AND status='scheduled'`,
            [row.id, nowIso],
          );
        }
        continue;
      }

      const effect = await applyConsequence({
        client, invId: inv.id, eventId: row.id, eventKey: row.eventKey, def,
        consequence: def.consequence, state, leakageTerms: pkg.leakageTerms, nowIso,
      });

      const resolved = await client.query(
        `UPDATE investigation_events SET status='resolved', resolved_at=$2, updated_at=$2
          WHERE id=$1 AND status IN ('scheduled','eligible') RETURNING id`,
        [row.id, nowIso],
      );
      if ((resolved.rowCount ?? 0) === 0) continue;

      const outcome = {
        kind: def.consequence.kind,
        summary: effect.developmentMessage ?? clipText(def.presentation.summary, 300),
        changes: effect.changes,
      };
      await client.query(
        'UPDATE investigation_events SET outcome=$2::jsonb, updated_at=$3 WHERE id=$1',
        [row.id, JSON.stringify(outcome), nowIso],
      );
      if (effect.developmentMessage) {
        await insertDevelopment({
          client, invId: inv.id, eventId: row.id, actorKey: row.actorKey,
          message: effect.developmentMessage,
        });
      }
      if (inv.userId && effect.notificationTitle && effect.notificationBody) {
        const inserted = await insertNotification({
          client,
          intent: {
            userId: inv.userId,
            investigationId: inv.id,
            eventId: row.id,
            category: NOTIFICATION_CATEGORY[row.eventType as EventCategory] ?? 'development',
            priority: effect.notificationPriority,
            groupKey: row.groupKey,
            title: effect.notificationTitle,
            body: effect.notificationBody,
            dedupeKey: `inv:${inv.id}:event:${row.id}`,
          },
        });
        notifications += inserted ? 1 : 0;
      }
      if (def.supersedes && def.supersedes.length > 0) {
        await markSuperseded(client, inv.id, row, def.supersedes, nowIso);
      }
      needsProgressionRerun = needsProgressionRerun || effect.needsProgressionRerun;

      try {
        result.resolved.push(safeEvent(
          { ...row, status: 'resolved', resolvedAt: nowIso, outcome },
          pkg.leakageTerms,
        ));
      } catch {
        console.warn(`[M6] dropped unsafe resolved event ${row.id}`);
      }
      result.counts.resolved += 1;
    }

    const nextRes = await client.query(
      `SELECT MIN(eligible_at) AS "nextEligibleAt" FROM investigation_events
        WHERE investigation_id=$1 AND status IN ('scheduled','eligible') AND eligible_at > $2`,
      [inv.id, nowIso],
    );
    const nextValue = (nextRes.rows[0] as { nextEligibleAt: string | Date | null } | undefined)?.nextEligibleAt;
    result.nextEligibleAt = nextValue ? new Date(nextValue).toISOString() : null;
    result.counts.notifications = notifications;

    await client.query('UPDATE investigations SET last_event_tick_at = $2 WHERE id = $1', [inv.id, nowIso]);
    return { result, needsProgressionRerun };
  });

  const result = outcome.result;
  if (outcome.needsProgressionRerun) {
    try {
      const progression = await processProgression(investigationId);
      result.evidenceChanges = progression.newlyReleased.map((release) => ({
        evidenceId: release.id,
        source: clipText(release.source, 120),
        description: clipText(release.description, 280),
        trigger: 'living_world.release_lead_rerun',
      }));
    } catch (error) {
      console.error(`[M6] progression rerun failed for investigation ${investigationId}`);
      void error;
    }
  }
  return result;
}

function emptySnapshot(nowMs: number): ActivitySnapshot {
  const to = iso(nowMs);
  return buildActivitySnapshot({
    events: [],
    upcoming: [],
    disagreements: [],
    unreadCount: 0,
    sinceLastVisit: {
      from: null,
      to,
      summary: 'No activity to catch up on yet.',
      highlights: [],
      unresolvedCount: 0,
      newCount: 0,
    },
    hasMore: false,
    nextEligibleAt: null,
  });
}

/** Player-facing activity snapshot. Ownership-scoped and leakage-scanned. */
export async function getActivitySnapshot(
  investigationId: string,
  userId: string,
  opts?: { limit?: number; cursor?: string; now?: Date },
): Promise<ActivitySnapshot> {
  const now = opts?.now instanceof Date && Number.isFinite(opts.now.getTime()) ? opts.now : new Date();
  const nowMs = now.getTime();
  const nowIso = iso(nowMs);
  const limit = clampLimit(opts?.limit);

  const invRes = await pool.query(
    `SELECT id, user_id AS "userId", case_id AS "caseId", status,
            start_timestamp AS "startTimestamp", last_seen_at AS "lastSeenAt"
       FROM investigations WHERE id=$1 AND user_id=$2`,
    [investigationId, userId],
  );
  const inv = invRes.rows[0] as InvestigationRow | undefined;
  if (!inv || inv.status !== 'active') return emptySnapshot(nowMs);

  const titleRes = await pool.query('SELECT title FROM cases WHERE id=$1', [inv.caseId]);
  const title = (titleRes.rows[0] as { title: string } | undefined)?.title ?? null;
  const pkg = title ? getPackageByCaseTitle(title) : undefined;
  const leakageTerms = pkg?.leakageTerms ?? [];

  const sinceMs = inv.lastSeenAt ? toMs(inv.lastSeenAt, nowMs) : toMs(inv.startTimestamp, nowMs);
  const sinceIso = iso(Math.min(sinceMs, nowMs));

  const cursor = opts?.cursor && Number.isFinite(new Date(opts.cursor).getTime()) ? opts.cursor : null;
  const eventsRes = await pool.query(
    `SELECT ${EVENT_COLUMNS} FROM investigation_events
      WHERE investigation_id=$1 AND status IN ('resolved','expired')
        AND ($2::timestamptz IS NULL OR resolved_at < $2::timestamptz)
      ORDER BY resolved_at DESC, id DESC
      LIMIT $3`,
    [inv.id, cursor, limit + 1],
  );
  const rawEvents = eventsRes.rows as InvestigationEventRow[];
  const hasMore = rawEvents.length > limit;
  const events: SafeActivityEvent[] = [];
  for (const row of rawEvents.slice(0, limit)) {
    try {
      events.push(safeEvent(row, leakageTerms));
    } catch {
      console.warn(`[M6] dropped unsafe activity event ${row.id}`);
    }
  }

  const unreadRes = await pool.query(
    `SELECT COUNT(*)::int AS count FROM notifications
      WHERE user_id=$1 AND investigation_id=$2 AND status='unread'`,
    [userId, inv.id],
  );
  const unreadCount = Number((unreadRes.rows[0] as { count: number } | undefined)?.count ?? 0);

  const newEvents = events.filter((event) => {
    const at = event.occurredAt ? new Date(event.occurredAt).getTime() : Number.NaN;
    return Number.isFinite(at) && at >= sinceMs;
  });
  const summary: CatchUpSummary = {
    from: inv.lastSeenAt ? sinceIso : null,
    to: nowIso,
    summary:
      newEvents.length > 0
        ? `${newEvents.length} development${newEvents.length === 1 ? '' : 's'} since your last visit.`
        : 'No new developments since your last visit.',
    highlights: newEvents
      .filter((event) => event.significance === 'high')
      .slice(0, 3)
      .map((event) => clipText(event.title, 120)),
    unresolvedCount: events.filter((event) => event.requiresResponse).length,
    newCount: newEvents.length,
  };

  const disagreementRes = await pool.query(
    `SELECT ${EVENT_COLUMNS} FROM investigation_events
      WHERE investigation_id=$1 AND event_type='team_disagreement' AND status='resolved'
      ORDER BY resolved_at DESC LIMIT 5`,
    [inv.id],
  );
  const disagreements: OutstandingDisagreement[] = [];
  const seenTopics = new Set<string>();
  for (const row of disagreementRes.rows as InvestigationEventRow[]) {
    const definition = (row.consequenceDefinition ?? {}) as Record<string, unknown>;
    if (definition.kind !== 'team_disagreement') continue;
    const topic = safeText(definition.topic, leakageTerms, 160);
    if (!topic || seenTopics.has(topic)) continue;
    const positionA = safeText(definition.positionA, leakageTerms, 300);
    const positionB = safeText(definition.positionB, leakageTerms, 300);
    const uncertaintyNote = safeText(definition.uncertaintyNote, leakageTerms, 300);
    if (!positionA || !positionB || !uncertaintyNote) continue;
    seenTopics.add(topic);
    disagreements.push({
      eventId: row.id,
      topic,
      specialistAKey: clipText(definition.specialistAKey, 80),
      specialistBKey: clipText(definition.specialistBKey, 80),
      positionA,
      positionB,
      uncertaintyNote,
      occurredAt: row.resolvedAt ? new Date(row.resolvedAt).toISOString() : null,
    });
  }

  const upcomingRes = await pool.query(
    `SELECT ${EVENT_COLUMNS} FROM investigation_events
      WHERE investigation_id=$1 AND status IN ('scheduled','eligible') AND eligible_at > $2
      ORDER BY eligible_at ASC LIMIT 6`,
    [inv.id, nowIso],
  );
  const upcoming = [];
  for (const row of upcomingRes.rows as InvestigationEventRow[]) {
    try {
      const teaser = toUpcomingTeaser(row, { leakageTerms });
      if (teaser) upcoming.push(teaser);
    } catch {
      console.warn(`[M6] dropped unsafe upcoming teaser ${row.id}`);
    }
  }

  const nextRes = await pool.query(
    `SELECT MIN(eligible_at) AS "nextEligibleAt" FROM investigation_events
      WHERE investigation_id=$1 AND status IN ('scheduled','eligible') AND eligible_at > $2`,
    [inv.id, nowIso],
  );
  const nextValue = (nextRes.rows[0] as { nextEligibleAt: string | Date | null } | undefined)?.nextEligibleAt;

  return buildActivitySnapshot({
    events,
    upcoming,
    disagreements,
    unreadCount,
    sinceLastVisit: summary,
    hasMore,
    nextEligibleAt: nextValue ? new Date(nextValue).toISOString() : null,
  });
}

/** Mark notifications seen and advance last_seen_at without accepting future times. */
export async function markActivitySeen(
  investigationId: string,
  userId: string,
  input: { eventIds?: string[]; through?: string },
): Promise<void> {
  const nowMs = Date.now();
  const requested = input.through ? new Date(input.through).getTime() : Number.NaN;
  const throughMs = Number.isFinite(requested) ? Math.min(requested, nowMs) : nowMs;
  const throughIso = iso(throughMs);

  await withTransaction(async (client) => {
    const owned = await client.query(
      'SELECT id FROM investigations WHERE id=$1 AND user_id=$2',
      [investigationId, userId],
    );
    if ((owned.rowCount ?? 0) === 0) return;

    const eventIds = asArray(input.eventIds)
      .map((id) => String(id))
      .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
      .slice(0, 100);

    if (eventIds.length > 0) {
      await client.query(
        `UPDATE notifications SET status='read', read_at=NOW()
          WHERE user_id=$1 AND investigation_id=$2 AND status='unread'
            AND event_id = ANY($3::uuid[])`,
        [userId, investigationId, eventIds],
      );
    } else {
      await client.query(
        `UPDATE notifications SET status='read', read_at=NOW()
          WHERE user_id=$1 AND investigation_id=$2 AND status='unread' AND created_at <= $3::timestamptz`,
        [userId, investigationId, throughIso],
      );
    }

    await client.query(
      `UPDATE investigations
          SET last_seen_at = GREATEST(
                COALESCE(last_seen_at, start_timestamp::timestamptz),
                LEAST($2::timestamptz, NOW())
              )
        WHERE id=$1 AND user_id=$3`,
      [investigationId, throughIso, userId],
    );
  });
}
