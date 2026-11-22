// === MYSTERY ENGINE / PROGRESSION ENGINE ===
// PROD-008 (GAP-01, MVP 11-13).
//
// Deterministic, SERVER-ONLY progression for THE INVESTIGATION. It never reads
// canonical_truth and never invents evidence: it only authorizes releases that
// are already authored into each evidence item's discovery_conditions /
// release_conditions. Every mutation runs in one transaction and is idempotent.
//
// Three release mechanisms are supported:
//   1. deduction  - player completed a referenced checkpoint (theory submission)
//   2. investigation_action - player performed a referenced investigative action
//   3. time       - a due scheduled event and/or an elapsed after_minutes window
//
// Offline progression is handled by re-running `processProgression` on every
// investigation read (catch-up) and by an in-process sweep in server.ts.

import type { PoolClient } from 'pg';
import { pool, withTransaction } from './db';
import { computeEvidenceProgress } from './progress';

// ---------------------------------------------------------------------------
// Public (player-safe) DTOs
// ---------------------------------------------------------------------------

/** A released evidence item. Never includes hidden interpretation/hypotheses. */
export interface SafeEvidenceRelease {
  id: string;
  source: string;
  category: string;
  description: string;
  reliability: string;
  playerVisible: boolean;
  timelineReference?: string;
}

/** A single entry in the player-facing development feed. */
export interface DevelopmentEntry {
  id: string;
  kind: string;
  message: string;
  evidenceId: string | null;
  createdAt: string;
}

export interface ProgressionResult {
  newlyReleased: SafeEvidenceRelease[];
  developments: DevelopmentEntry[];
  processedEvents: string[];
  pendingCount: number;
}

export interface CheckpointView {
  id: string;
  prompt: string;
  completed: boolean;
}

export interface ActionView {
  action: string;
  label: string;
}

export interface CheckpointState {
  checkpoints: CheckpointView[];
  actions: ActionView[];
  completedCheckpoints: string[];
  pendingDevelopments: number;
}

export interface TheoryResult extends ProgressionResult {
  checkpointId: string;
  result: 'plausible' | 'unsupported';
  feedback: string[];
  completedCheckpoints: string[];
}

// ---------------------------------------------------------------------------
// Internal row shapes (server-only - never returned as-is)
// ---------------------------------------------------------------------------

interface CaseEvidenceRow {
  id: string;
  source: string;
  category: string;
  description: string;
  reliability: string;
  timeline_reference: string | null;
  player_visible: boolean;
  discovery_conditions: any;
  release_conditions: any;
}

interface StoredEvidenceRow {
  id: string;
  source: string;
  category: string;
  description: string;
  reliability: string;
  timeline_reference: string | null;
  player_visible: boolean;
}

// Human-readable prompts for the deduction checkpoints authored in seed.sql.
// Unknown checkpoint ids (future cases) fall back to a generic, spoiler-free
// prompt derived from the id - never from hidden evidence or canonical truth.
const KNOWN_CHECKPOINTS: Record<string, { prompt: string; relevantSources: string[] }> = {
  'alarm-window-identified': {
    prompt: 'The sensors went offline for exactly twelve minutes. What does that precise timing tell you about whoever planned this?',
    relevantSources: ['alarm system log', 'night guard log'],
  },
  'silver-cane-identified': {
    prompt: 'The corridor footage shows a figure gripping something and moving with a limp. What detail could identify that person?',
    relevantSources: ['security footage', 'witness statement'],
  },
  'motive-question-raised': {
    prompt: 'Who would actually profit from the diamond disappearing? Follow the money before naming a culprit.',
    relevantSources: ['alarm system log', 'witness statement', 'night guard log'],
  },
};

const EMPTY_RESULT: ProgressionResult = {
  newlyReleased: [],
  developments: [],
  processedEvents: [],
  pendingCount: 0,
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function safeEvidence(row: StoredEvidenceRow): SafeEvidenceRelease {
  const base: SafeEvidenceRelease = {
    id: String(row.id),
    source: String(row.source ?? ''),
    category: String(row.category ?? ''),
    description: String(row.description ?? ''),
    reliability: String(row.reliability ?? ''),
    playerVisible: !!row.player_visible,
  };
  if (typeof row.timeline_reference === 'string') {
    return { ...base, timelineReference: row.timeline_reference };
  }
  return base;
}

function toDevelopment(row: any): DevelopmentEntry {
  return {
    id: String(row.id),
    kind: String(row.kind),
    message: String(row.message),
    evidenceId: row.evidence_id ? String(row.evidence_id) : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function developmentMessage(payload: unknown, fallback: string): string {
  const obj = asObject(payload);
  return typeof obj.message === 'string' && obj.message.trim() ? obj.message : fallback;
}

async function countPending(client: PoolClient, investigationId: string): Promise<number> {
  const res = await client.query(
    `SELECT COUNT(*)::int AS count FROM scheduled_events
      WHERE investigation_id = $1 AND release_status = 'pending'`,
    [investigationId]
  );
  return Number(res.rows[0]?.count ?? 0);
}

/** Load evidence metadata for a case. Server-only columns never leave this file. */
async function loadCaseEvidence(client: PoolClient, caseId: string): Promise<CaseEvidenceRow[]> {
  const res = await client.query(
    `SELECT id, source, category, description, reliability, timeline_reference,
            player_visible, discovery_conditions, release_conditions
       FROM evidence WHERE case_id = $1 ORDER BY discovery_order ASC NULLS LAST`,
    [caseId]
  );
  return res.rows as CaseEvidenceRow[];
}

function collectCheckpointDefs(rows: CaseEvidenceRow[]): Array<{
  id: string;
  prompt: string;
  relevantSources: string[];
}> {
  const found = new Map<string, { id: string; prompt: string; relevantSources: string[] }>();
  for (const row of rows) {
    const cond = asObject(row.discovery_conditions);
    if (String(cond.type ?? '') !== 'deduction') continue;
    for (const raw of asArray(cond.requires)) {
      const id = String(raw ?? '');
      if (!id || found.has(id)) continue;
      const known = KNOWN_CHECKPOINTS[id];
      found.set(id, {
        id,
        prompt: known?.prompt ?? `Share your reasoning about: ${id.replace(/-/g, ' ')}.`,
        relevantSources: known?.relevantSources ?? [],
      });
    }
  }
  return Array.from(found.values());
}

// ---------------------------------------------------------------------------
// Initialization: seed time-triggered scheduled events for a new investigation
// ---------------------------------------------------------------------------

/**
 * Create scheduled events authored by the case's time-based evidence. Called
 * once when an investigation is created. Idempotent: a UNIQUE guard prevents
 * duplicates if initialization is retried.
 *
 * The stored narrative is deliberately generic - it never contains the hidden
 * evidence description or any canonical truth.
 */
export async function initializeProgression(investigationId: string): Promise<void> {
  await withTransaction(async (client) => {
    const invRes = await client.query(
      'SELECT id, case_id FROM investigations WHERE id = $1',
      [investigationId]
    );
    const inv = invRes.rows[0] as { id: string; case_id: string } | undefined;
    if (!inv) return;

    const rows = await loadCaseEvidence(client, String(inv.case_id));
    for (const row of rows) {
      const cond = asObject(row.discovery_conditions);
      if (String(cond.type ?? '') !== 'time') continue;
      const minutes = toNumber(cond.after_minutes);
      if (minutes <= 0) continue;

      await client.query(
        `INSERT INTO scheduled_events
           (investigation_id, event_type, trigger_condition, scheduled_timestamp,
            release_status, associated_evidence, narrative_payload, created_at, updated_at)
         SELECT $1, 'evidence_release', '{}'::jsonb, NOW() + ($2::int * INTERVAL '1 minute'),
                'pending', $3, $4::jsonb, NOW(), NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM scheduled_events
            WHERE investigation_id = $1 AND associated_evidence = $3
              AND event_type = 'evidence_release'
         )`,
        [
          investigationId,
          minutes,
          row.id,
          JSON.stringify({
            title: 'Scheduled development',
            message: 'A new development is expected as the investigation continues.',
          }),
        ]
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Core catch-up / release engine
// ---------------------------------------------------------------------------

/**
 * Apply all progressions currently due for one investigation.
 *
 * Safe to call repeatedly (idempotent) and from any request context. This is
 * both the offline catch-up entry point and the engine used by the in-process
 * scheduler. Completed/archived investigations are never modified.
 */
export async function processProgression(investigationId: string): Promise<ProgressionResult> {
  return withTransaction(async (client) => {
    const invRes = await client.query('SELECT * FROM investigations WHERE id = $1', [investigationId]);
    const inv = invRes.rows[0] as any;
    if (!inv || String(inv.status) !== 'active') return EMPTY_RESULT;

    const rows = await loadCaseEvidence(client, String(inv.case_id));
    const byId = new Map<string, CaseEvidenceRow>();
    const bySource = new Map<string, CaseEvidenceRow>();
    for (const row of rows) {
      byId.set(row.id, row);
      if (row.source) bySource.set(row.source, row);
    }

    // Evidence is "available" when it is in the opening briefing or has been
    // discovered/released. Initially visible evidence is treated as available
    // from the investigation start time (needed for min_minutes calculations).
    const available = new Set<string>();
    for (const row of rows) if (row.player_visible) available.add(row.id);
    const storedIds: unknown = inv.discovered_evidence_ids;
    if (Array.isArray(storedIds)) {
      for (const id of storedIds) available.add(String(id));
    }

    const discRes = await client.query(
      'SELECT evidence_id, discovered_at FROM evidence_discoveries WHERE investigation_id = $1',
      [investigationId]
    );
    const discoveredAt = new Map<string, number>();
    for (const d of discRes.rows) {
      const t = new Date(d.discovered_at).getTime();
      if (!Number.isNaN(t)) discoveredAt.set(String(d.evidence_id), t);
    }

    const startMsRaw = inv.start_timestamp
      ? new Date(inv.start_timestamp).getTime()
      : Number.NaN;
    const startMs = Number.isNaN(startMsRaw) ? Date.now() : startMsRaw;

    function availableAtMs(id: string): number | null {
      const explicit = discoveredAt.get(id);
      if (explicit !== undefined) return explicit;
      const row = byId.get(id);
      if (row?.player_visible || available.has(id)) return startMs;
      return null;
    }

    const cpRes = await client.query(
      'SELECT checkpoint_id FROM deduction_checkpoints WHERE investigation_id = $1',
      [investigationId]
    );
    const completedCheckpoints = new Set(cpRes.rows.map((r) => String(r.checkpoint_id)));

    const actionRes = await client.query(
      'SELECT action FROM investigation_actions WHERE investigation_id = $1',
      [investigationId]
    );
    const actions = new Set(actionRes.rows.map((r) => String(r.action)));

    const dueRes = await client.query(
      `SELECT * FROM scheduled_events
        WHERE investigation_id = $1
          AND release_status = 'pending'
          AND scheduled_timestamp <= NOW()
        ORDER BY scheduled_timestamp ASC`,
      [investigationId]
    );
    const dueEvents = dueRes.rows as any[];
    const eventByEvidence = new Map<string, any>();
    for (const evt of dueEvents) {
      if (evt.associated_evidence) eventByEvidence.set(String(evt.associated_evidence), evt);
    }

    const newlyReleased: SafeEvidenceRelease[] = [];
    const developments: DevelopmentEntry[] = [];
    const processedEvents = new Set<string>();
    const nowMs = Date.now();

    async function logDevelopment(kind: string, message: string, evidenceId: string | null) {
      const res = await client.query(
        `INSERT INTO development_log (investigation_id, kind, message, evidence_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, kind, message, evidence_id, created_at`,
        [investigationId, kind, message, evidenceId]
      );
      return toDevelopment(res.rows[0]);
    }

    // Fixed point: releasing one item may satisfy another item's prerequisites
    // in the same sweep. Bound the loop so malformed cyclic rules cannot hang.
    let changed = true;
    let iterations = 0;
    while (changed && iterations++ < rows.length + 2) {
      changed = false;

      for (const row of rows) {
        if (row.player_visible || available.has(row.id)) continue;

        const cond = asObject(row.discovery_conditions);
        const rel = asObject(row.release_conditions);
        const type = String(cond.type ?? '');
        const evt = eventByEvidence.get(row.id);

        // 1. Is any trigger satisfied?
        let trigger = false;
        if (type === 'deduction') {
          trigger = asArray(cond.requires).some((cp: unknown) =>
            completedCheckpoints.has(String(cp ?? ''))
          );
        } else if (type === 'investigation_action') {
          trigger = actions.has(String(cond.action ?? ''));
        } else if (type === 'time' || type === 'initial') {
          trigger = true;
        }
        if (evt) trigger = true; // due scheduled event associated with this item

        if (!trigger) continue;

        // 2. Are all authored prerequisites already available?
        let prerequisitesMet = true;
        const prereqTimes: number[] = [];
        for (const raw of asArray(rel.after)) {
          const key = String(raw ?? '');
          const prereq = byId.get(key) ?? bySource.get(key);
          if (!prereq) continue; // unknown prereq authored in content: ignore
          if (!available.has(prereq.id)) {
            prerequisitesMet = false;
            break;
          }
          const t = availableAtMs(prereq.id);
          if (t !== null) prereqTimes.push(t);
        }
        if (!prerequisitesMet) continue;

        // 3. Have the authored delays elapsed?
        const baseMs = prereqTimes.length > 0 ? Math.max(...prereqTimes) : startMs;
        const minMinutes = toNumber(rel.min_minutes);
        if (nowMs - baseMs < minMinutes * 60_000) continue;
        if (type === 'time') {
          const afterMinutes = toNumber(cond.after_minutes);
          if (nowMs - baseMs < afterMinutes * 60_000) continue;
        }

        // 4. Release: insert the idempotency record + append to discovered ids.
        await client.query(
          `INSERT INTO evidence_discoveries (investigation_id, evidence_id, trigger, discovered_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (investigation_id, evidence_id) DO NOTHING`,
          [investigationId, row.id, evt ? 'time_event' : type || 'progression']
        );

        available.add(row.id);
        discoveredAt.set(row.id, nowMs);
        newlyReleased.push(safeEvidence(row));

        const message = evt
          ? developmentMessage(evt.narrative_payload, `New development: ${row.source}.`)
          : `New evidence available: ${row.source}.`;
        developments.push(
          await logDevelopment(evt ? 'scheduled_release' : 'evidence_released', message, row.id)
        );

        if (evt) {
          await client.query(
            `UPDATE scheduled_events SET release_status = 'released', updated_at = NOW() WHERE id = $1`,
            [evt.id]
          );
          processedEvents.add(String(evt.id));
        }
        changed = true;
      }
    }

    // Due events without an associated evidence item still need acknowledging
    // so they are not reprocessed every sweep. Events whose evidence has not
    // satisfied its conditions remain pending and can trigger later.
    for (const evt of dueEvents) {
      const eventId = String(evt.id);
      if (processedEvents.has(eventId)) continue;
      const associated = evt.associated_evidence ? String(evt.associated_evidence) : null;
      if (associated) {
        if (available.has(associated)) {
          await client.query(
            `UPDATE scheduled_events SET release_status = 'processed', updated_at = NOW() WHERE id = $1`,
            [eventId]
          );
          processedEvents.add(eventId);
        }
        continue;
      }
      await client.query(
        `UPDATE scheduled_events SET release_status = 'processed', updated_at = NOW() WHERE id = $1`,
        [eventId]
      );
      processedEvents.add(eventId);
      developments.push(
        await logDevelopment(
          'scheduled_event',
          developmentMessage(evt.narrative_payload, 'A scheduled development has been noted.'),
          null
        )
      );
    }

    // Only discovered/released ids are persisted. Briefing-visible evidence is
    // available but not "examined", so it must not inflate progress or appear
    // in discoveredEvidenceIds (preserves the existing discover-action UX).
    const finalIds = Array.from(new Set([
      ...storedIdsArray(storedIds),
      ...newlyReleased.map((ev) => ev.id),
    ]));
    // `rows` is every authored evidence item for this case (loadCaseEvidence
    // does not filter by player_visible), so it is the correct denominator.
    // GAP-12: share the formula with db.ts instead of a hardcoded 20.
    const progress = computeEvidenceProgress(finalIds.length, rows.length);
    await client.query(
      `UPDATE investigations
          SET discovered_evidence_ids = $1::uuid[], progress = $2, updated_at = NOW()
        WHERE id = $3`,
      [finalIds, progress, investigationId]
    );

    return {
      newlyReleased,
      developments,
      processedEvents: Array.from(processedEvents),
      pendingCount: await countPending(client, investigationId),
    };
  });
}

function storedIdsArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

// ---------------------------------------------------------------------------
// Checkpoint views, theory submission and investigative actions
// ---------------------------------------------------------------------------

/** Spoiler-free checkpoint/action state for the investigation room UI. */
export async function getCheckpointState(investigationId: string): Promise<CheckpointState> {
  return withTransaction(async (client) => {
    const invRes = await client.query(
      'SELECT id, case_id, status FROM investigations WHERE id = $1',
      [investigationId]
    );
    const inv = invRes.rows[0] as any;
    if (!inv) {
      return { checkpoints: [], actions: [], completedCheckpoints: [], pendingDevelopments: 0 };
    }

    const rows = await loadCaseEvidence(client, String(inv.case_id));
    const defs = collectCheckpointDefs(rows);

    const cpRes = await client.query(
      'SELECT checkpoint_id FROM deduction_checkpoints WHERE investigation_id = $1',
      [investigationId]
    );
    const completed = new Set(cpRes.rows.map((r) => String(r.checkpoint_id)));

    const actions: ActionView[] = [];
    const seenActions = new Set<string>();
    for (const row of rows) {
      const cond = asObject(row.discovery_conditions);
      if (String(cond.type ?? '') !== 'investigation_action') continue;
      const action = String(cond.action ?? '');
      if (!action || seenActions.has(action)) continue;
      seenActions.add(action);
      const label = typeof cond.description === 'string' && cond.description.trim()
        ? cond.description
        : `Investigate: ${action.replace(/_/g, ' ')}`;
      actions.push({ action, label });
    }

    return {
      checkpoints: defs.map((def) => ({ ...def, completed: completed.has(def.id) })),
      actions,
      completedCheckpoints: Array.from(completed),
      pendingDevelopments: await countPending(client, investigationId),
    };
  });
}

/**
 * Evaluate and store a player theory for a checkpoint. Evaluation uses ONLY
 * evidence currently available to the player - canonical truth, hidden
 * interpretations and hypothesis tags are never consulted or returned.
 */
export async function submitDeductionTheory(
  investigationId: string,
  input: { checkpointId: string; theory: string; supportingEvidence: string[]; confidence?: string }
): Promise<TheoryResult | null> {
  const checkpointId = String(input.checkpointId ?? '');
  const theory = String(input.theory ?? '').trim();
  if (!checkpointId || theory.length < 8) return null;

  // Validate the checkpoint and evaluate against player-visible evidence only.
  const evaluation = await withTransaction(async (client) => {
    const invRes = await client.query(
      'SELECT id, case_id, status FROM investigations WHERE id = $1',
      [investigationId]
    );
    const inv = invRes.rows[0] as any;
    if (!inv || String(inv.status) !== 'active') return null;

    const rows = await loadCaseEvidence(client, String(inv.case_id));
    const def = collectCheckpointDefs(rows).find((d) => d.id === checkpointId);
    if (!def) return null;

    const available = new Set<string>();
    for (const row of rows) if (row.player_visible) available.add(row.id);
    if (Array.isArray(inv.discovered_evidence_ids)) {
      for (const id of inv.discovered_evidence_ids) available.add(String(id));
    }
    const byId = new Map(rows.map((r) => [r.id, r]));

    const cited = asArray(input.supportingEvidence)
      .map(String)
      .filter((id) => available.has(id));
    const relevantSources = new Set(def.relevantSources.map((s) => s.toLowerCase()));
    const caseHasRelevant = relevantSources.size === 0 || rows.some((r) => relevantSources.has(String(r.source ?? '').toLowerCase()));
    const relevantCited = cited.filter((id) => {
      const source = String(byId.get(id)?.source ?? '').toLowerCase();
      return relevantSources.size === 0 || !caseHasRelevant || relevantSources.has(source);
    });

    const result: 'plausible' | 'unsupported' =
      relevantCited.length > 0 ? 'plausible' : 'unsupported';

    const feedback: string[] = [];
    if (cited.length > 0) {
      feedback.push(`Your theory draws on ${cited.length} piece${cited.length === 1 ? '' : 's'} of available evidence.`);
    } else {
      feedback.push('Cite at least one piece of evidence you can currently see to ground your theory.');
    }
    if (result === 'plausible') {
      feedback.push('This line of reasoning is consistent with what you know so far. The investigation advances.');
    } else {
      feedback.push('That reasoning is not yet supported by the evidence available to you. You may revise it at any time.');
    }

    if (result === 'plausible') {
      await client.query(
        `INSERT INTO deduction_checkpoints
           (investigation_id, checkpoint_id, submitted_theory, supporting_evidence, result, created_at, updated_at)
         VALUES ($1, $2, $3, $4::uuid[], $5, NOW(), NOW())
         ON CONFLICT (investigation_id, checkpoint_id)
         DO UPDATE SET submitted_theory = EXCLUDED.submitted_theory,
                       supporting_evidence = EXCLUDED.supporting_evidence,
                       result = EXCLUDED.result,
                       updated_at = NOW()`,
        [investigationId, checkpointId, theory, cited, result]
      );
    }

    return { result, feedback };
  });

  if (!evaluation) return null;

  // Re-evaluate releases in a separate transaction to keep lock scopes small.
  const progression = await processProgression(investigationId);
  const state = await getCheckpointState(investigationId);

  return {
    checkpointId,
    result: evaluation.result,
    feedback: evaluation.feedback,
    completedCheckpoints: state.completedCheckpoints,
    ...progression,
  };
}

/** Record an investigative action, then release anything it unlocks. */
export async function recordInvestigationAction(
  investigationId: string,
  action: string
): Promise<ProgressionResult | null> {
  const normalized = String(action ?? '').trim();
  if (!normalized) return null;

  const known = await withTransaction(async (client) => {
    const invRes = await client.query('SELECT case_id, status FROM investigations WHERE id = $1', [investigationId]);
    const inv = invRes.rows[0] as any;
    if (!inv || String(inv.status) !== 'active') return false;
    const rows = await loadCaseEvidence(client, String(inv.case_id));
    const exists = rows.some((row) => {
      const cond = asObject(row.discovery_conditions);
      return String(cond.type ?? '') === 'investigation_action' && String(cond.action ?? '') === normalized;
    });
    if (!exists) return false;
    await client.query(
      `INSERT INTO investigation_actions (investigation_id, action, created_at)
       VALUES ($1, $2, NOW()) ON CONFLICT (investigation_id, action) DO NOTHING`,
      [investigationId, normalized]
    );
    return true;
  });

  if (!known) return null;
  return processProgression(investigationId);
}

/** Player-safe development feed (catch-up), newest first. */
export async function getDevelopments(investigationId: string, limit = 30): Promise<DevelopmentEntry[]> {
  const res = await pool.query(
    `SELECT id, kind, message, evidence_id, created_at
       FROM development_log
      WHERE investigation_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    [investigationId, Math.min(100, Math.max(1, limit))]
  );
  return res.rows.map(toDevelopment);
}

// ---------------------------------------------------------------------------
// In-process scheduler support
// ---------------------------------------------------------------------------

/**
 * Sweep every active investigation with due work. Used by the server's
 * setInterval. MVP limitation: single-process only; durability across restarts
 * is provided by persisted scheduled events + catch-up on read, not by a
 * distributed worker queue.
 */
export async function runSchedulerSweep(): Promise<{ investigations: number; releases: number }> {
  const res = await pool.query(
    `SELECT DISTINCT i.id
       FROM investigations i
       JOIN scheduled_events e ON e.investigation_id = i.id
      WHERE i.status = 'active'
        AND e.release_status = 'pending'
        AND e.scheduled_timestamp <= NOW()`
  );
  let releases = 0;
  for (const row of res.rows) {
    const result = await processProgression(String(row.id));
    releases += result.newlyReleased.length;
  }
  return { investigations: res.rows.length, releases };
}
