/**
 * GAP-15 — seeded case content validation (READ-ONLY; no DB writes).
 *
 * Validates the *seeded* case data against the PRD/MVP integrity rules that
 * the runtime (src/db.ts, src/mystery-engine.ts, src/server.ts) relies on but
 * does not enforce itself. This is a content linter, not a runtime test: it
 * answers "is this case actually solvable and self-consistent?" and "does a
 * future refactor risk leaking private fields through a safe DTO?".
 *
 * Checks (per seeded case):
 *   - culprit exists as a character (and is a suspect, not the witness)
 *   - canonical_truth has every required field with the right shape
 *   - every gated evidence item has a valid trigger and resolvable prereqs,
 *     and is actually reachable from the opening briefing (fixed point)
 *   - deduction checkpoints referenced by conditions are authored; time-based
 *     evidence has an authorable delay
 *   - evidence is not orphaned / ambiguous (source, case id, timeline ref)
 *   - solution references (clue keys, timeline/theory evidence, hidden-event
 *     participants) resolve to real evidence/characters
 *   - static DTO allowlists still exclude private fields
 *
 * Run: npm run case:validate
 * Connection mirrors src/db.ts: DATABASE_URL when set, otherwise the local
 * Postgres socket (/var/run/postgresql, database `investigation`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

type Obj = Record<string, any>;

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const asObject = (value: unknown): Obj =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : {};
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const norm = (value: unknown): string => text(value).toLowerCase();
const isNonNegNumber = (value: unknown): boolean =>
  typeof value === 'number' ? Number.isFinite(value) && value >= 0 : false;
const isPositiveNumber = (value: unknown): boolean =>
  typeof value === 'number' ? Number.isFinite(value) && value > 0 : false;
const hasYear = (value: unknown): boolean => /\d{4}/.test(text(value));

/** Mirrors KNOWN_CHECKPOINTS in src/mystery-engine.ts (spoiler-free prompts). */
const KNOWN_CHECKPOINTS: Record<string, string[]> = {
  'alarm-window-identified': ['alarm system log', 'night guard log'],
  'silver-cane-identified': ['security footage', 'witness statement'],
  'motive-question-raised': ['alarm system log', 'witness statement', 'night guard log'],
};

const ALLOWED_DISCOVERY_TYPES = new Set(['initial', 'deduction', 'investigation_action', 'time']);
const FORBIDDEN_EVIDENCE_FIELDS = [
  'hidden_interpretation', 'hiddenInterpretation',
  'discovery_conditions', 'discoveryConditions',
  'release_conditions', 'releaseConditions',
  'supported_hypotheses', 'supportedHypotheses',
  'contradicted_hypotheses', 'contradictedHypotheses',
  'hiddenEvents', 'hidden_events',
];
const FORBIDDEN_CHARACTER_FIELDS = [
  'secrets', 'knowledge', 'beliefs', 'relationships',
  'canonicalTruth', 'hiddenEvents', 'hidden_events',
];

// ---------------------------------------------------------------------------
// Report plumbing
// ---------------------------------------------------------------------------

interface Section {
  name: string;
  issues: string[];
  details: string[];
}

const section = (name: string): Section => ({ name, issues: [], details: [] });
const fail = (s: Section, message: string): void => { s.issues.push(message); };
const note = (s: Section, message: string): void => { s.details.push(message); };

function printSection(s: Section): void {
  if (s.issues.length > 0) {
    console.log(`${s.name} FAIL`);
    for (const issue of s.issues) console.log(`  - ${issue}`);
  } else {
    const suffix = s.details.length > 0 ? ` — ${s.details.join('; ')}` : '';
    console.log(`${s.name} PASS${suffix}`);
  }
}

// ---------------------------------------------------------------------------
// Row shapes (read-only projections)
// ---------------------------------------------------------------------------

interface CaseRow { id: string; title: string; publication_status: string | null }
interface CharRow { case_id: string; name: string; role: string | null }
interface EvidenceRow {
  id: string;
  case_id: string;
  source: string | null;
  description: string;
  discovery_conditions: unknown;
  release_conditions: unknown;
  timeline_reference: string | null;
  player_visible: boolean;
  discovery_order: number | null;
}
interface TruthRow {
  case_id: string;
  culprit: string;
  motive: string;
  method: string;
  timeline: unknown;
  hidden_events: unknown;
  solution_explanation: string | null;
  red_herrings: unknown;
  alternative_theories: unknown;
  clue_resolutions: unknown;
  actual_timeline: unknown;
}

interface CaseData {
  cases: CaseRow[];
  chars: CharRow[];
  evidence: EvidenceRow[];
  truths: TruthRow[];
}

async function loadData(pool: Pool): Promise<CaseData> {
  const casesRes = await pool.query(
    `SELECT id, title, publication_status FROM cases ORDER BY title`
  );
  const charsRes = await pool.query(
    `SELECT case_id, name, role FROM characters`
  );
  const evidenceRes = await pool.query(
    `SELECT id, case_id, source, description, discovery_conditions, release_conditions,
            timeline_reference, player_visible, discovery_order
       FROM evidence ORDER BY case_id, discovery_order`
  );
  const truthRes = await pool.query(
    `SELECT case_id, culprit, motive, method, timeline, hidden_events,
            solution_explanation, red_herrings, alternative_theories,
            clue_resolutions, actual_timeline
       FROM canonical_truth`
  );
  return {
    cases: casesRes.rows as CaseRow[],
    chars: charsRes.rows as CharRow[],
    evidence: evidenceRes.rows as EvidenceRow[],
    truths: truthRes.rows as TruthRow[],
  };
}

function connectionConfig(): Record<string, unknown> {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  const config: Record<string, unknown> = {
    host: process.env.PGHOST || '/var/run/postgresql',
    database: process.env.PGDATABASE || 'investigation',
  };
  if (process.env.PGUSER) config.user = process.env.PGUSER;
  if (process.env.PGPASSWORD) config.password = process.env.PGPASSWORD;
  if (process.env.PGPORT) config.port = Number(process.env.PGPORT);
  return config;
}

// ---------------------------------------------------------------------------
// Per-case validation
// ---------------------------------------------------------------------------

interface EvidenceIndex {
  byId: Map<string, EvidenceRow>;
  bySource: Map<string, EvidenceRow>;
  duplicateSources: string[];
  /** checkpoint id -> relevant (lowercased) evidence sources from the engine. */
  checkpointSources: Map<string, Set<string>>;
}

function indexEvidence(evidence: EvidenceRow[]): EvidenceIndex {
  const byId = new Map<string, EvidenceRow>();
  const bySource = new Map<string, EvidenceRow>();
  const duplicateSources: string[] = [];
  const checkpointSources = new Map<string, Set<string>>();

  for (const row of evidence) {
    byId.set(row.id, row);
    const source = norm(row.source);
    if (source) {
      if (bySource.has(source)) duplicateSources.push(source);
      else bySource.set(source, row);
    }
  }

  // Checkpoints are authored wherever a deduction condition requires them
  // (this is exactly how mystery-engine.collectCheckpointDefs works).
  for (const row of evidence) {
    const cond = asObject(row.discovery_conditions);
    if (text(cond.type) !== 'deduction') continue;
    for (const raw of asArray(cond.requires)) {
      const id = text(raw);
      if (id && !checkpointSources.has(id)) {
        checkpointSources.set(id, new Set((KNOWN_CHECKPOINTS[id] ?? []).map(norm)));
      }
    }
  }

  return { byId, bySource, duplicateSources, checkpointSources };
}

function resolvePrereq(
  key: string,
  index: EvidenceIndex
): EvidenceRow | undefined {
  return index.byId.get(key) ?? index.bySource.get(norm(key));
}

function findUnreachable(evidence: EvidenceRow[], index: EvidenceIndex): string[] {
  const reachable = new Set<string>();
  for (const row of evidence) if (row.player_visible) reachable.add(row.id);

  let changed = true;
  let guard = 0;
  while (changed && guard++ < evidence.length + 2) {
    changed = false;
    for (const row of evidence) {
      if (reachable.has(row.id)) continue;
      const cond = asObject(row.discovery_conditions);
      const rel = asObject(row.release_conditions);
      const type = text(cond.type);

      // 1. Is the trigger satisfiable with what the player can currently see?
      let trigger = false;
      if (type === 'initial' || type === 'investigation_action' || type === 'time') {
        // Actions are always performable; time events are seeded by the engine.
        trigger = true;
      } else if (type === 'deduction') {
        const required = asArray(cond.requires).map(text).filter(Boolean);
        trigger = required.some((cpId) => {
          const sources = index.checkpointSources.get(cpId);
          if (!sources) return false; // checkpoint is not authored anywhere
          // If known relevant sources don't exist in this case, fall back to generic "any reachable evidence".
          const caseHasRelevant = sources.size === 0 || [...sources].some((s) => index.bySource.has(s));
          if (!caseHasRelevant) return reachable.size > 0;
          if (sources.size === 0) return reachable.size > 0;
          for (const id of reachable) {
            if (sources.has(norm(index.byId.get(id)?.source))) return true;
          }
          return false;
        });
      }
      if (!trigger) continue;

      // 2. Are all authored prerequisites available? (id or source reference)
      let prereqsMet = true;
      for (const raw of asArray(rel.after)) {
        const key = text(raw);
        if (!key) continue;
        const prereq = resolvePrereq(key, index);
        if (!prereq || !reachable.has(prereq.id)) {
          prereqsMet = false;
          break;
        }
      }
      if (!prereqsMet) continue;

      reachable.add(row.id);
      changed = true;
    }
  }

  return evidence
    .filter((row) => !row.player_visible && !reachable.has(row.id))
    .map((row) => text(row.source) || row.id);
}

function validateCase(
  c: CaseRow,
  chars: CharRow[],
  evidence: EvidenceRow[],
  truth: TruthRow | undefined,
  allCaseIds: Set<string>
): Section[] {
  const sections: Section[] = [];
  const index = indexEvidence(evidence);
  const sourceSet = new Set(index.bySource.keys());
  const charNames = new Set(chars.map((ch) => norm(ch.name)));

  // --- Evidence shape / gating -------------------------------------------
  const evSection = section(`  [${c.title}] Evidence shape & gating`);
  const visibleCount = evidence.filter((e) => e.player_visible).length;

  if (evidence.length === 0) fail(evSection, 'case has no evidence rows');
  if (!allCaseIds.has(c.id)) fail(evSection, 'case row is missing from the cases table');

  for (const duplicate of index.duplicateSources) {
    fail(evSection, `duplicate evidence source '${duplicate}' — release 'after' references are ambiguous`);
  }

  for (const row of evidence) {
    const label = text(row.source) || row.id;
    if (row.case_id !== c.id) fail(evSection, `evidence '${label}' belongs to a different case (${row.case_id})`);
    if (!text(row.source)) fail(evSection, `evidence ${row.id} has no source label`);
    if (!text(row.description)) fail(evSection, `evidence '${label}' has no description`);

    const cond = asObject(row.discovery_conditions);
    const type = text(cond.type);
    if (!type) {
      fail(evSection, `evidence '${label}' has no discovery_conditions.type`);
    } else if (!ALLOWED_DISCOVERY_TYPES.has(type)) {
      fail(evSection, `evidence '${label}' uses unknown discovery type '${type}'`);
    }

    if (type === 'deduction' && asArray(cond.requires).map(text).filter(Boolean).length === 0) {
      fail(evSection, `deduction-gated evidence '${label}' references no checkpoint id`);
    }
    if (type === 'investigation_action' && !text(cond.action)) {
      fail(evSection, `action-gated evidence '${label}' has no action name`);
    }
    if (type === 'time' && !isPositiveNumber(cond.after_minutes)) {
      fail(evSection, `time-gated evidence '${label}' has no positive after_minutes delay`);
    }

    const rel = asObject(row.release_conditions);
    if (rel.after !== undefined && !Array.isArray(rel.after)) {
      fail(evSection, `evidence '${label}' has a non-array release_conditions.after`);
    }
    for (const raw of asArray(rel.after)) {
      const key = text(raw);
      if (!key) {
        fail(evSection, `evidence '${label}' has an empty release prerequisite`);
        continue;
      }
      const prereq = resolvePrereq(key, index);
      if (!prereq) {
        fail(evSection, `evidence '${label}' requires unknown evidence '${key}' (impossible prereq)`);
      } else if (prereq.id === row.id) {
        fail(evSection, `evidence '${label}' requires itself (cyclic prereq)`);
      }
    }
    if (rel.min_minutes !== undefined && !isNonNegNumber(rel.min_minutes)) {
      fail(evSection, `evidence '${label}' has an invalid min_minutes delay`);
    }

    if (!hasYear(row.timeline_reference)) {
      fail(evSection, `evidence '${label}' has an insane timeline_reference (expected a year): '${text(row.timeline_reference)}'`);
    }
  }
  note(evSection, `${evidence.length} evidence (${visibleCount} initially visible, ${evidence.length - visibleCount} gated)`);
  sections.push(evSection);

  // --- Checkpoints & actions --------------------------------------------
  const cpSection = section(`  [${c.title}] Checkpoints & actions`);
  const checkpointRefs = new Map<string, string[]>(); // id -> labels that reference it
  const releaseCheckpointRefs = new Map<string, string[]>(); // refs from release_conditions
  const actionSet = new Set<string>();
  for (const row of evidence) {
    const label = text(row.source) || row.id;
    const holders: Array<[Obj, Map<string, string[]>]> = [
      [asObject(row.discovery_conditions), checkpointRefs],
      [asObject(row.release_conditions), releaseCheckpointRefs],
    ];
    for (const [holder, target] of holders) {
      for (const key of ['requires', 'checkpoint', 'checkpointId', 'checkpoints']) {
        const raw = holder[key];
        const ids = Array.isArray(raw) ? raw : [raw];
        for (const value of ids) {
          const id = text(value);
          if (!id) continue;
          const maps = target === checkpointRefs ? [checkpointRefs] : [checkpointRefs, target];
          for (const map of maps) {
            const refs = map.get(id) ?? [];
            refs.push(label);
            map.set(id, refs);
          }
        }
      }
    }
    const cond = asObject(row.discovery_conditions);
    if (text(cond.type) === 'investigation_action') {
      const action = text(cond.action);
      if (action) actionSet.add(action);
    }
  }
  for (const [id, refs] of checkpointRefs) {
    if (!(id in KNOWN_CHECKPOINTS)) {
      note(cpSection, `checkpoint '${id}' referenced by ${[...new Set(refs)].join(', ')} is not in validator KNOWN_CHECKPOINTS (engine allows generic fallback)`);
    }
  }
  for (const [id, refs] of releaseCheckpointRefs) {
    if (!index.checkpointSources.has(id)) {
      fail(cpSection, `release condition on ${[...new Set(refs)].join(', ')} references checkpoint '${id}' that no deduction condition authors`);
    }
  }
  note(cpSection, `checkpoints authored: ${[...index.checkpointSources.keys()].join(', ') || '(none)'}`);
  note(cpSection, `actions authored: ${[...actionSet].join(', ') || '(none)'}`);
  sections.push(cpSection);

  // --- Reachability ------------------------------------------------------
  const reachSection = section(`  [${c.title}] Gated evidence reachability`);
  const unreachable = findUnreachable(evidence, index);
  for (const label of unreachable) {
    fail(reachSection, `gated evidence '${label}' is unreachable from the opening briefing (trigger or prereq cannot be satisfied)`);
  }
  note(reachSection, `${evidence.length - visibleCount - unreachable.length}/${evidence.length - visibleCount} gated items reachable`);
  sections.push(reachSection);

  // --- Culprit -----------------------------------------------------------
  const culpritSection = section(`  [${c.title}] Culprit`);
  if (truth) {
    const culprit = text(truth.culprit);
    const match = chars.find((ch) => norm(ch.name) === norm(culprit));
    if (!culprit) {
      fail(culpritSection, 'canonical truth has no culprit');
    } else if (!match) {
      fail(culpritSection, `culprit '${culprit}' is not a character in this case`);
    } else if (norm(match.role) !== 'suspect') {
      fail(culpritSection, `culprit '${culprit}' has role '${text(match.role)}' (expected a suspect, not a witness)`);
    } else {
      note(culpritSection, `'${culprit}' is an authored suspect`);
    }
  } else {
    note(culpritSection, 'no canonical truth row — skipped');
  }
  sections.push(culpritSection);

  // --- Canonical truth required fields ----------------------------------
  const truthSection = section(`  [${c.title}] Canonical truth fields`);
  if (!truth) {
    if (c.publication_status === 'published') {
      fail(truthSection, 'published case has no canonical_truth row');
    } else {
      note(truthSection, 'no canonical_truth row (case is not published) — skipped');
    }
  } else {
    for (const field of ['culprit', 'motive', 'method', 'solution_explanation'] as const) {
      if (!text(truth[field])) fail(truthSection, `required field '${field}' is empty`);
    }
    for (const field of ['timeline', 'red_herrings', 'alternative_theories', 'actual_timeline'] as const) {
      if (!Array.isArray(truth[field])) fail(truthSection, `required field '${field}' must be an array`);
    }
    const rawClues = truth.clue_resolutions;
    if (!rawClues || typeof rawClues !== 'object' || Array.isArray(rawClues)) {
      fail(truthSection, "required field 'clue_resolutions' must be an object");
    }
    if (!Array.isArray(truth.hidden_events)) note(truthSection, 'hidden_events is not an array (server-only field)');
    note(truthSection, `timeline: ${asArray(truth.timeline).length}, actual: ${asArray(truth.actual_timeline).length}, red herrings: ${asArray(truth.red_herrings).length}`);
  }
  sections.push(truthSection);

  // --- Timeline sanity ---------------------------------------------------
  const timeSection = section(`  [${c.title}] Timeline sanity`);
  if (truth) {
    const timeline = asArray(truth.timeline);
    const actual = asArray(truth.actual_timeline);
    for (const [i, entry] of timeline.entries()) {
      const e = asObject(entry);
      if (!text(e.time) || !text(e.event)) fail(timeSection, `timeline[${i}] is missing time or event`);
    }
    const seqs = new Set<number>();
    for (const [i, entry] of actual.entries()) {
      const e = asObject(entry);
      if (!text(e.time) || !text(e.event)) fail(timeSection, `actual_timeline[${i}] is missing time or event`);
      if (typeof e.seq === 'number') {
        if (seqs.has(e.seq)) fail(timeSection, `actual_timeline has a duplicate seq (${e.seq})`);
        seqs.add(e.seq);
      }
    }
    note(timeSection, `${timeline.length} narrative + ${actual.length} authoritative events`);
  }
  sections.push(timeSection);

  // --- Solution references resolve --------------------------------------
  const solutionSection = section(`  [${c.title}] Solution references`);
  if (truth) {
    const clues = asObject(truth.clue_resolutions);
    for (const [clue, resolution] of Object.entries(clues)) {
      if (!sourceSet.has(norm(clue))) {
        fail(solutionSection, `clue_resolutions key '${clue}' does not match any evidence source in this case`);
      }
      if (!text(resolution)) fail(solutionSection, `clue_resolutions['${clue}'] has an empty resolution`);
    }

    for (const [i, entry] of asArray(truth.actual_timeline).entries()) {
      for (const source of asArray(asObject(entry).evidence)) {
        if (!sourceSet.has(norm(source))) {
          fail(solutionSection, `actual_timeline[${i}] cites unknown evidence '${text(source)}'`);
        }
      }
    }

    for (const [i, theory] of asArray(truth.alternative_theories).entries()) {
      const t = asObject(theory);
      if (!text(t.title) || !text(t.summary)) {
        fail(solutionSection, `alternative_theories[${i}] is missing title or summary`);
      }
      for (const source of asArray(t.disproven_by)) {
        if (!sourceSet.has(norm(source))) {
          fail(solutionSection, `alternative_theories[${i}] cites unknown evidence '${text(source)}'`);
        }
      }
    }

    for (const [i, herring] of asArray(truth.red_herrings).entries()) {
      const rh = asObject(herring);
      if (!text(rh.label)) fail(solutionSection, `red_herrings[${i}] is missing a label`);
      if (rh.resolved_by !== undefined && !text(rh.resolved_by)) {
        fail(solutionSection, `red_herrings[${i}] has an empty resolved_by`);
      }
    }

    for (const [i, event] of asArray(truth.hidden_events).entries()) {
      for (const participant of asArray(asObject(event).known_by)) {
        const name = text(participant);
        if (!charNames.has(norm(name))) {
          fail(solutionSection, `hidden_events[${i}] names unknown character '${name}'`);
        }
      }
    }
    note(solutionSection, `${Object.keys(clues).length} clue keys, ${asArray(truth.alternative_theories).length} alternative theories checked against case evidence`);
  }
  sections.push(solutionSection);

  return sections;
}

// ---------------------------------------------------------------------------
// Static DTO allowlist checks (read-only source inspection)
// ---------------------------------------------------------------------------

function sliceBetween(source: string, start: string, end: string): string {
  const i = source.indexOf(start);
  if (i < 0) return '';
  const j = end ? source.indexOf(end, i + start.length) : -1;
  return j < 0 ? source.slice(i) : source.slice(i, j);
}

function staticChecks(projectRoot: string): Section[] {
  const serverSrc = fs.readFileSync(path.join(projectRoot, 'src/server.ts'), 'utf8');
  const dbSrc = fs.readFileSync(path.join(projectRoot, 'src/db.ts'), 'utf8');
  const sections: Section[] = [];

  const evDto = section('  [DTO] toSafeEvidence allowlist');
  const evBody = sliceBetween(dbSrc, 'function toSafeEvidence', 'export async function getCaseById');
  if (!evBody) {
    fail(evDto, 'marker "function toSafeEvidence" not found in src/db.ts — update this check');
  } else {
    for (const field of FORBIDDEN_EVIDENCE_FIELDS) {
      if (evBody.includes(field)) fail(evDto, `safe evidence DTO exposes private field '${field}'`);
    }
    note(evDto, 'no hidden interpretation / condition / hypothesis fields');
  }
  sections.push(evDto);

  const charDto = section('  [DTO] toPublicCharacter allowlist');
  const charBody = sliceBetween(serverSrc, 'function toPublicCharacter', '\n}');
  if (!charBody) {
    fail(charDto, 'marker "function toPublicCharacter" not found in src/server.ts — update this check');
  } else {
    for (const field of FORBIDDEN_CHARACTER_FIELDS) {
      if (charBody.includes(field)) fail(charDto, `public character DTO exposes private field '${field}'`);
    }
    note(charDto, 'no secrets / knowledge / beliefs / relationships');
  }
  sections.push(charDto);

  const solutionDto = section('  [DTO] solution reveal allowlist');
  const iface = sliceBetween(serverSrc, 'interface PublicSolution {', '\n}');
  const builder = sliceBetween(serverSrc, 'function toPublicSolution', "investigationRouter.get('/solution'");
  const route = sliceBetween(serverSrc, "investigationRouter.get('/solution'", 'investigationRouter.post(\'/chat\'');
  if (!iface || !builder || !route) {
    fail(solutionDto, 'solution reveal markers not found in src/server.ts — update this check');
  } else {
    for (const field of ['hiddenEvents', 'hidden_events', 'hidden events']) {
      if (iface.includes(field) || builder.includes(field) || route.includes(field)) {
        fail(solutionDto, `solution DTO exposes private field '${field}'`);
      }
    }
    if (!route.includes('res.json(toPublicSolution(canonical))')) {
      fail(solutionDto, 'solution route no longer returns the vetted toPublicSolution allowlist');
    }
    note(solutionDto, 'hidden_events excluded; route uses toPublicSolution');
  }
  sections.push(solutionDto);

  const selectDto = section('  [DTO] player-facing evidence SELECTs');
  const caseSelect = sliceBetween(dbSrc, 'export async function getCaseById', 'export interface GetCaseByIdResult');
  const evidenceSelect = sliceBetween(dbSrc, 'export async function getEvidenceByCase', '/**\n * PROD-013');
  if (!caseSelect || !evidenceSelect) {
    fail(selectDto, 'getCaseById / getEvidenceByCase markers not found in src/db.ts — update this check');
  } else {
    for (const field of FORBIDDEN_EVIDENCE_FIELDS) {
      if (caseSelect.includes(field) || evidenceSelect.includes(field)) {
        fail(selectDto, `player-facing evidence SELECT includes private field '${field}'`);
      }
    }
    note(selectDto, 'only safe evidence columns selected');
  }
  sections.push(selectDto);

  return sections;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('CASE CONTENT VALIDATION (read-only; no DB writes)\n');

  const staticSections = staticChecks(process.cwd());
  for (const s of staticSections) printSection(s);
  console.log('');

  const allSections: Section[] = [...staticSections];
  const pool = new Pool(connectionConfig() as any);
  try {
    console.log('  [Database] connecting...');
    const data = await loadData(pool);
    const allCaseIds = new Set(data.cases.map((c) => c.id));

    if (data.cases.length === 0) {
      const s = section('  [Database] Seeded cases');
      fail(s, 'no cases are seeded in the database');
      allSections.push(s);
    }

    for (const c of data.cases) {
      const truth = data.truths.find((t) => t.case_id === c.id);
      const chars = data.chars.filter((ch) => ch.case_id === c.id);
      const evidence = data.evidence.filter((e) => e.case_id === c.id);
      allSections.push(...validateCase(c, chars, evidence, truth, allCaseIds));
    }

    const orphanEvidence = data.evidence.filter((e) => !allCaseIds.has(e.case_id));
    const orphanSection = section('  [Database] Orphan rows');
    for (const e of orphanEvidence) {
      fail(orphanSection, `evidence '${text(e.source) || e.id}' references missing case ${e.case_id}`);
    }
    const orphanTruths = data.truths.filter((t) => !allCaseIds.has(t.case_id));
    for (const t of orphanTruths) {
      fail(orphanSection, `canonical_truth references missing case ${t.case_id}`);
    }
    note(orphanSection, `${data.cases.length} case(s), ${data.evidence.length} evidence, ${data.truths.length} canonical truth row(s)`);
    allSections.push(orphanSection);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const s = section('  [Database] Connection & content load');
    fail(s, `could not read the database: ${message}`);
    fail(s, 'hint: start Postgres and ensure DB `investigation` is seeded, or set DATABASE_URL');
    allSections.push(s);
  } finally {
    await pool.end();
  }

  for (const s of allSections.slice(staticSections.length)) printSection(s);

  const failures = allSections.reduce((sum, s) => sum + s.issues.length, 0);
  console.log(`\nCASE VALIDATION: ${failures === 0 ? 'PASS' : `FAIL (${failures} issue(s))`}`);
  if (failures > 0) process.exitCode = 1;
}

void main();
