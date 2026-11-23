/**
 * M8-4 — Case quality & content audit (READ-ONLY; no DB writes).
 *
 * Complements `case:validate` (which answers "is this case structurally
 * solvable / self-consistent / leak-free?"). This script answers the softer
 * question "how *good* is the authored content, and which cases are worth
 * polishing into publication-quality experiences?".
 *
 * Design principles
 * -----------------
 *  - READ-ONLY: only SELECTs against Postgres. No INSERT/UPDATE/DELETE, no
 *    canonical-truth access beyond computing non-spoiling metrics.
 *  - INFORMATIONAL: low scores NEVER fail the run. The process only exits
 *    non-zero on execution/DB errors. Warnings are printed to stdout.
 *  - DETERMINISTIC + CI-Runnable: fixed thresholds, stable ordering, no external
 *    calls, no randomness. Safe to run in CI as an informational step.
 *  - HONEST ABOUT METHOD: every dimension declares a `method`:
 *      * automated     - objective structural facts from the DB
 *      * heuristic     - threshold proxy; directionally useful, confirm by human
 *      * human_review  - cannot be reliably automated; score is a PLACEHOLDER
 *                        proxy and must be confirmed by a human reviewer.
 *  - SPOILER-SAFE OUTPUT: the Markdown/JSON reports contain counts, booleans and
 *    dimension scores only. Canonical culprit / motive / method / solution text
 *    is read internally for detection but is NEVER written to any report.
 *
 * Run: npm run case:quality
 * Connection mirrors src/db.ts / validate-case.ts: DATABASE_URL when set,
 * otherwise local Postgres socket (/var/run/postgresql, database `investigation`).
 *
 * Outputs (overwritten each run):
 *   ../project-management/M8-CASE-QUALITY-AUDIT.md
 *   ../project-management/M8-CASE-QUALITY-AUDIT.json
 * Override the directory with AUDIT_REPORT_DIR=<absolute path>.
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
const clamp3 = (n: number): number => Math.max(0, Math.min(3, Math.round(n)));
const bool2 = (b: boolean): number => (b ? 1 : 0);

/** Parse a jsonb-or-text column that may arrive as a string, array, or object. */
function parseMaybeJson(value: unknown): any {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  }
  return value ?? null;
}

// ---------------------------------------------------------------------------
// Row shapes (read-only projections)
// ---------------------------------------------------------------------------

interface CaseRow {
  id: string;
  title: string;
  genre: string | null;
  difficulty: string | null;
  description: string | null;
  briefing: string | null;
  objectives: unknown;
  initial_facts: unknown;
  publication_status: string | null;
}
interface CharRow {
  case_id: string;
  name: string;
  role: string | null;
  motive: string | null;
  alibi: string | null;
  confirmed_alibi: string | null;
  knowledge: unknown;
  beliefs: unknown;
  secrets: unknown;
}
interface EvidenceRow {
  id: string;
  case_id: string;
  category: string | null;
  source: string | null;
  description: string;
  hidden_interpretation: string | null;
  discovery_conditions: unknown;
  release_conditions: unknown;
  timeline_reference: string | null;
  player_visible: boolean;
  discovery_order: number | null;
  supported_hypotheses: unknown;
  contradicted_hypotheses: unknown;
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
interface PackRow {
  case_id: string;
  pack_status: string | null;
  learning_objectives: unknown;
  summary: string | null;
}
interface ArtifactRow {
  case_id: string;
  source_verified: boolean;
  verification_status: string | null;
}
interface SpecRow {
  case_id: string;
  case_relevance: string | null;
}
interface EventPkgRow {
  case_id: string;
  event_count: number;
  package_status: string | null;
}
interface DiscPkgRow {
  case_id: string;
  clue_count: number;
  package_status: string | null;
}
interface DisagreementRow { case_id: string }

interface DbData {
  cases: CaseRow[];
  chars: CharRow[];
  evidence: EvidenceRow[];
  truths: TruthRow[];
  packs: PackRow[];
  artifacts: ArtifactRow[];
  specialists: SpecRow[];
  eventPkgs: EventPkgRow[];
  discPkgs: DiscPkgRow[];
  disagreements: DisagreementRow[];
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

async function loadData(pool: Pool): Promise<DbData> {
  const queries = [
    `SELECT id, title, genre, difficulty, description, briefing, objectives,
            initial_facts, publication_status
       FROM cases WHERE publication_status = 'published' ORDER BY title`,
    `SELECT case_id, name, role, motive, alibi, confirmed_alibi, knowledge, beliefs, secrets
       FROM characters`,
    `SELECT id, case_id, category, source, description, hidden_interpretation,
            discovery_conditions, release_conditions, timeline_reference,
            player_visible, discovery_order, supported_hypotheses, contradicted_hypotheses
       FROM evidence ORDER BY case_id, discovery_order`,
    `SELECT case_id, culprit, motive, method, timeline, hidden_events,
            solution_explanation, red_herrings, alternative_theories,
            clue_resolutions, actual_timeline
       FROM canonical_truth`,
    `SELECT case_id, pack_status, learning_objectives, summary FROM case_knowledge_packs`,
    `SELECT case_id, source_verified, verification_status FROM knowledge_artifacts`,
    `SELECT case_id, case_relevance FROM case_specialists`,
    `SELECT case_id, event_count, package_status FROM case_event_packages`,
    `SELECT case_id, clue_count, package_status FROM discovery_clue_packages`,
    `SELECT case_id FROM knowledge_disagreements`,
  ];
  const results = await Promise.all(queries.map((q) => pool.query(q)));
  const rows = results.map((r) => r.rows);
  return {
    cases: rows[0] as CaseRow[],
    chars: rows[1] as CharRow[],
    evidence: rows[2] as EvidenceRow[],
    truths: rows[3] as TruthRow[],
    packs: rows[4] as PackRow[],
    artifacts: rows[5] as ArtifactRow[],
    specialists: rows[6] as SpecRow[],
    eventPkgs: rows[7] as EventPkgRow[],
    discPkgs: rows[8] as DiscPkgRow[],
    disagreements: rows[9] as DisagreementRow[],
  };
}

// ---------------------------------------------------------------------------
// Scoring framework
// ---------------------------------------------------------------------------

type Method = 'automated' | 'heuristic' | 'human_review';
type Rating = 'publication_ready' | 'needs_refinement' | 'draft';

interface DimensionMeta {
  key: string;
  label: string;
  method: Method;
  criterion: string; // max-3 rubric, spoiler-free
}
interface DimResult {
  score: number;
  rationale: string;
  signals: string[];
}

const DIMENSIONS: DimensionMeta[] = [
  {
    key: 'premise_quality',
    label: 'Premise quality',
    method: 'heuristic',
    criterion:
      '3 = distinct, specific description + non-templated briefing + >=3 objectives & >=2 initial facts; 2 = most of those; 1 = generic/templated; 0 = missing core text.',
  },
  {
    key: 'narrative_coherence',
    label: 'Narrative coherence',
    method: 'human_review',
    criterion:
      'Proxy only: 3 = authored narrative timeline, hidden events, and a distinct briefing; lower when templated. A human must read the prose to confirm.',
  },
  {
    key: 'canonical_truth_integrity',
    label: 'Canonical truth integrity',
    method: 'automated',
    criterion:
      '3 = culprit is an authored suspect, all solution fields present, timelines/clues valid; 1 point deducted per missing structural pillar.',
  },
  {
    key: 'suspect_motivations',
    label: 'Suspect motivations',
    method: 'heuristic',
    criterion:
      '3 = distinct motive per suspect (+alibi); 2 = mostly distinct; 1 = reused/generic motives; 0 = missing.',
  },
  {
    key: 'evidence_quality',
    label: 'Evidence quality',
    method: 'automated',
    criterion:
      '3 = >=8 evidence, >=4 categories, timeline refs + several trigger types; scaled down for thinner sets.',
  },
  {
    key: 'deduction_difficulty',
    label: 'Deduction difficulty / fair challenge',
    method: 'heuristic',
    criterion:
      '3 = gated evidence, multiple trigger types, and NO culprit name leaked into player-facing text; leak costs 1 point.',
  },
  {
    key: 'alternative_hypotheses',
    label: 'Alternative hypotheses / red herrings',
    method: 'automated',
    criterion:
      '3 = >=2 red herrings and >=2 alternative theories with hidden events; 1 = only a token of each.',
  },
  {
    key: 'evidence_traceability',
    label: 'Evidence-to-conclusion traceability',
    method: 'automated',
    criterion:
      '3 = clue resolutions cover evidence, timeline events cite evidence, evidence carries hypothesis links.',
  },
  {
    key: 'specialist_relevance',
    label: 'Specialist relevance',
    method: 'automated',
    criterion:
      '3 = >=3 assigned specialists with case-specific relevance and a knowledge pack; scaled down when absent.',
  },
  {
    key: 'knowledge_opportunities',
    label: 'Knowledge opportunities',
    method: 'automated',
    criterion:
      '3 = knowledge pack + >=3 artifacts + learning objectives + >=1 disagreement; scaled down when absent.',
  },
  {
    key: 'perspective_relevance',
    label: 'Perspective relevance',
    method: 'human_review',
    criterion:
      'Proxy only: reasoning-rich content (competing theories, red herrings) invites perspective lenses; confirm applicability by human.',
  },
  {
    key: 'discovery_clue_relevance',
    label: 'Discovery clue relevance',
    method: 'automated',
    criterion:
      '3 = an authored discovery-clue package with >=3 clues; 1 = none / empty.',
  },
  {
    key: 'ending_quality',
    label: 'Ending quality',
    method: 'heuristic',
    criterion:
      '3 = substantial solution explanation + authored actual timeline + no spoiler leak into objectives/briefing.',
  },
  {
    key: 'replayability',
    label: 'Replayability',
    method: 'heuristic',
    criterion:
      '3 = multiple alternative theories, multiple red herrings, multiple gated evidence paths.',
  },
];

interface Ctx {
  c: CaseRow;
  chars: CharRow[];
  evidence: EvidenceRow[];
  truth: TruthRow | undefined;
  pack: PackRow | undefined;
  artifacts: ArtifactRow[];
  specialists: SpecRow[];
  eventPkg: EventPkgRow | undefined;
  discPkg: DiscPkgRow | undefined;
  disagreements: DisagreementRow[];
  objectivesText: string;
  culpritNameInPlayerText: boolean;
  templatedBriefing: boolean;
  descriptionLength: number;
  briefingLength: number;
  objectivesCount: number;
  initialFactsCount: number;
  suspectCount: number;
  distinctMotiveCount: number;
  evidenceCount: number;
  visibleCount: number;
  categoryCount: number;
  timelineRefCount: number;
  discoveryTypeCount: number;
  richHiddenCount: number;
  hypothesisLinkCount: number;
  altsCount: number;
  herringsCount: number;
  actualTlCount: number;
  narrativeTlCount: number;
  clueCount: number;
  hiddenEventsCount: number;
  solutionLength: number;
  truthComplete: boolean;
  culpritIsSuspect: boolean;
  timelineValid: boolean;
}

const dim = (score: number, rationale: string, signals: string[] = []): DimResult => ({
  score: clamp3(score),
  rationale,
  signals,
});

function buildContext(c: CaseRow, data: DbData): Ctx {
  const caseId = c.id;
  const chars = data.chars.filter((r) => r.case_id === caseId);
  const evidence = data.evidence.filter((r) => r.case_id === caseId);
  const truth = data.truths.find((r) => r.case_id === caseId);
  const pack = data.packs.find((r) => r.case_id === caseId);
  const artifacts = data.artifacts.filter((r) => r.case_id === caseId);
  const specialists = data.specialists.filter((r) => r.case_id === caseId);
  const eventPkg = data.eventPkgs.find((r) => r.case_id === caseId);
  const discPkg = data.discPkgs.find((r) => r.case_id === caseId);
  const disagreements = data.disagreements.filter((r) => r.case_id === caseId);

  const objectives = parseMaybeJson(c.objectives);
  const objectivesList = asArray(objectives).map(text).filter(Boolean);
  const objectivesText = objectivesList.join(' ');
  const briefing = text(c.briefing);

  const suspects = chars.filter((ch) => norm(ch.role) === 'suspect');
  const distinctMotives = new Set(suspects.map((ch) => norm(ch.motive)).filter(Boolean));

  const culprit = text(truth?.culprit);
  const nameParts = culprit.split(/\s+/).filter((p) => p.length > 2);
  const playerText = `${objectivesText} ${briefing}`.toLowerCase();
  const culpritNameInPlayerText =
    nameParts.length > 1 && nameParts.every((p) => playerText.includes(p.toLowerCase()));

  const templatedBriefing =
    /was involved in an incident at/i.test(briefing) &&
    /investigate the timeline/i.test(briefing);

  const clueResolutions = asObject(truth?.clue_resolutions);
  const actualTl = asArray(truth?.actual_timeline);

  const culpritIsSuspect = Boolean(
    culprit && suspects.some((ch) => norm(ch.name) === norm(culprit))
  );
  const truthComplete = Boolean(
    truth &&
      text(truth.culprit) && text(truth.motive) && text(truth.method) &&
      text(truth.solution_explanation) &&
      Array.isArray(truth.timeline) && Array.isArray(truth.red_herrings) &&
      Array.isArray(truth.alternative_theories) && Array.isArray(truth.actual_timeline) &&
      clueResolutions && !Array.isArray(truth.clue_resolutions)
  );
  const timelineValid = Boolean(
    truth && Array.isArray(truth.actual_timeline) &&
      actualTl.every((e) => text(asObject(e).time) && text(asObject(e).event)) &&
      (() => {
        const seqs = actualTl.map((e) => asObject(e).seq).filter((s) => typeof s === 'number');
        return new Set(seqs).size === seqs.length;
      })()
  );

  return {
    c, chars, evidence, truth, pack, artifacts, specialists, eventPkg, discPkg, disagreements,
    objectivesText,
    culpritNameInPlayerText,
    templatedBriefing,
    descriptionLength: text(c.description).length,
    briefingLength: briefing.length,
    objectivesCount: objectivesList.length,
    initialFactsCount: asArray(parseMaybeJson(c.initial_facts)).length,
    suspectCount: suspects.length,
    distinctMotiveCount: distinctMotives.size,
    evidenceCount: evidence.length,
    visibleCount: evidence.filter((e) => e.player_visible).length,
    categoryCount: new Set(evidence.map((e) => norm(e.category)).filter(Boolean)).size,
    timelineRefCount: evidence.filter((e) => text(e.timeline_reference)).length,
    discoveryTypeCount: new Set(
      evidence.map((e) => norm(asObject(e.discovery_conditions).type)).filter(Boolean)
    ).size,
    richHiddenCount: evidence.filter((e) => text(e.hidden_interpretation).length > 40).length,
    hypothesisLinkCount: evidence.filter(
      (e) => asArray(e.supported_hypotheses).length || asArray(e.contradicted_hypotheses).length
    ).length,
    altsCount: asArray(truth?.alternative_theories).length,
    herringsCount: asArray(truth?.red_herrings).length,
    actualTlCount: actualTl.length,
    narrativeTlCount: asArray(truth?.timeline).length,
    clueCount: Object.keys(clueResolutions).length,
    hiddenEventsCount: asArray(truth?.hidden_events).length,
    solutionLength: text(truth?.solution_explanation).length,
    truthComplete,
    culpritIsSuspect,
    timelineValid,
  };
}

function scoreCase(ctx: Ctx): Record<string, DimResult> {
  const s: Record<string, DimResult> = {};

  // 1. Premise quality (heuristic)
  {
    const specific = ctx.descriptionLength >= 40;
    const distinct = !ctx.templatedBriefing && ctx.briefingLength >= 60;
    const scaffold = ctx.objectivesCount >= 3 && ctx.initialFactsCount >= 2;
    const score = bool2(specific) + bool2(distinct) + bool2(scaffold);
    s.premise_quality = dim(
      score,
      score === 3 ? 'Specific premise, distinct briefing, full objective scaffold.'
        : ctx.templatedBriefing ? 'Templated briefing / generic premise lowers quality.'
        : 'Partially specified premise.',
      [`description=${ctx.descriptionLength} chars`, `objectives=${ctx.objectivesCount}`, `templated=${ctx.templatedBriefing}`]
    );
  }

  // 2. Narrative coherence (human_review proxy)
  {
    const narrative = ctx.narrativeTlCount >= 5 && ctx.actualTlCount >= 5;
    const hidden = ctx.hiddenEventsCount >= 2;
    const distinct = !ctx.templatedBriefing;
    const score = bool2(narrative) + bool2(hidden) + bool2(distinct);
    s.narrative_coherence = dim(
      score,
      'Proxy score only; a human must read the prose to confirm coherence.',
      [`narrativeTl=${ctx.narrativeTlCount}`, `actualTl=${ctx.actualTlCount}`, `hidden=${ctx.hiddenEventsCount}`]
    );
  }

  // 3. Canonical truth integrity (automated)
  {
    const score = bool2(ctx.culpritIsSuspect) + bool2(ctx.truthComplete) + bool2(ctx.timelineValid);
    s.canonical_truth_integrity = dim(
      score,
      score === 3 ? 'Culprit is an authored suspect; all solution fields and timelines valid.'
        : 'One or more structural truth pillars missing/invalid.',
      [`culpritIsSuspect=${ctx.culpritIsSuspect}`, `truthComplete=${ctx.truthComplete}`, `timelineValid=${ctx.timelineValid}`]
    );
  }

  // 4. Suspect motivations (heuristic)
  {
    const suspectsHaveMotive = ctx.chars
      .filter((ch) => norm(ch.role) === 'suspect')
      .every((ch) => text(ch.motive).length > 0);
    const distinct = ctx.suspectCount > 0 && ctx.distinctMotiveCount >= ctx.suspectCount * 0.8;
    const alibis = ctx.chars
      .filter((ch) => norm(ch.role) === 'suspect')
      .filter((ch) => text(ch.alibi) && text(ch.confirmed_alibi)).length;
    const score = bool2(suspectsHaveMotive) + bool2(distinct) + bool2(alibis >= ctx.suspectCount * 0.8);
    s.suspect_motivations = dim(
      score,
      distinct ? 'Suspect motives are largely distinct and plausible.'
        : 'Motives are reused/generic across suspects (needs human review).',
      [`suspects=${ctx.suspectCount}`, `distinctMotives=${ctx.distinctMotiveCount}`, `alibis=${alibis}`]
    );
  }

  // 5. Evidence quality (automated)
  {
    const enough = ctx.evidenceCount >= 8;
    const diverse = ctx.categoryCount >= 4;
    const refs = ctx.timelineRefCount >= ctx.evidenceCount * 0.75 && ctx.discoveryTypeCount >= 3;
    const score = bool2(enough) + bool2(diverse) + bool2(refs);
    s.evidence_quality = dim(
      score,
      score === 3 ? '>=8 evidence across diverse categories with timeline + trigger diversity.'
        : 'Thinner or less diverse evidence set.',
      [`evidence=${ctx.evidenceCount}`, `visible=${ctx.visibleCount}`, `categories=${ctx.categoryCount}`, `discoveryTypes=${ctx.discoveryTypeCount}`]
    );
  }

  // 6. Deduction difficulty / fair challenge (heuristic)
  {
    const gated = ctx.visibleCount < ctx.evidenceCount && ctx.evidenceCount - ctx.visibleCount >= 3;
    const triggers = ctx.discoveryTypeCount >= 3;
    const fair = !ctx.culpritNameInPlayerText;
    const score = bool2(gated) + bool2(triggers) + bool2(fair);
    s.deduction_difficulty = dim(
      score,
      fair ? 'Gating/triggers present and no culprit name leaked to the player.'
        : 'Culprit name appears in player-facing objectives/briefing — fairness impaired.',
      [`gated=${ctx.evidenceCount - ctx.visibleCount}`, `discoveryTypes=${ctx.discoveryTypeCount}`, `culpritNameInPlayerText=${ctx.culpritNameInPlayerText}`]
    );
  }

  // 7. Alternative hypotheses / red herrings (automated)
  {
    const herrings = ctx.herringsCount >= 2;
    const alts = ctx.altsCount >= 2;
    const depth = ctx.hiddenEventsCount >= 2 && ctx.clueCount >= 8;
    const score = bool2(herrings) + bool2(alts) + bool2(depth);
    s.alternative_hypotheses = dim(
      score,
      score === 3 ? 'Multiple red herrings and alternative theories with hidden-event depth.'
        : 'Only token alternative theories / red herrings authored.',
      [`redHerrings=${ctx.herringsCount}`, `alternativeTheories=${ctx.altsCount}`, `hidden=${ctx.hiddenEventsCount}`]
    );
  }

  // 8. Evidence-to-conclusion traceability (automated)
  {
    const clues = ctx.clueCount >= ctx.evidenceCount * 0.8;
    const cited = ctx.actualTlCount > 0 &&
      asArray(ctx.truth?.actual_timeline).some((e) => asArray(asObject(e).evidence).length > 0);
    const links = ctx.hypothesisLinkCount >= ctx.evidenceCount * 0.75;
    const score = bool2(clues) + bool2(cited) + bool2(links);
    s.evidence_traceability = dim(
      score,
      score === 3 ? 'Clue resolutions, timeline citations and hypothesis links all present.'
        : 'Partial evidence-to-conclusion linkage.',
      [`clueResolutions=${ctx.clueCount}`, `evidence=${ctx.evidenceCount}`, `hypothesisLinks=${ctx.hypothesisLinkCount}`]
    );
  }

  // 9. Specialist relevance (automated)
  {
    const count = ctx.specialists.length;
    const relevant = ctx.specialists.filter((sp) => text(sp.case_relevance).length > 0).length;
    const score = bool2(count >= 3) + bool2(relevant >= 3) + bool2(Boolean(ctx.pack));
    s.specialist_relevance = dim(
      score,
      count === 0 ? 'No specialists assigned to this case.' : `${count} specialists assigned.`,
      [`specialists=${count}`, `withRelevance=${relevant}`, `knowledgePack=${Boolean(ctx.pack)}`]
    );
  }

  // 10. Knowledge opportunities (automated)
  {
    const artifacts = ctx.artifacts.length >= 3;
    const objectives = Boolean(ctx.pack && asArray(ctx.pack.learning_objectives).length >= 2);
    const disagreements = ctx.disagreements.length >= 1;
    const score = bool2(artifacts) + bool2(objectives) + bool2(disagreements);
    s.knowledge_opportunities = dim(
      score,
      score === 3 ? 'Knowledge pack with objectives, artifacts and a disagreement authored.'
        : 'Limited knowledge/teaching material for this case.',
      [`artifacts=${ctx.artifacts.length}`, `learningObjectives=${ctx.pack ? asArray(ctx.pack.learning_objectives).length : 0}`, `disagreements=${ctx.disagreements.length}`]
    );
  }

  // 11. Perspective relevance (human_review proxy)
  {
    const reasoningRich = ctx.altsCount >= 2 || ctx.herringsCount >= 2;
    const biasPotential = ctx.hiddenEventsCount >= 2 && ctx.hypothesisLinkCount >= 6;
    const genreCue = Boolean(ctx.c.genre) && !ctx.templatedBriefing;
    const score = bool2(reasoningRich) + bool2(biasPotential) + bool2(genreCue);
    s.perspective_relevance = dim(
      score,
      'Proxy only; perspective-framework applicability must be judged by a human.',
      [`alternatives=${ctx.altsCount}`, `hidden=${ctx.hiddenEventsCount}`, `genre=${text(ctx.c.genre) || 'none'}`]
    );
  }

  // 12. Discovery clue relevance (automated)
  {
    const present = Boolean(ctx.discPkg);
    const enough = present && ctx.discPkg!.clue_count >= 3;
    const status = present && ['verified', 'pending_review'].includes(norm(ctx.discPkg!.package_status));
    const score = bool2(present) + bool2(enough) + bool2(status);
    s.discovery_clue_relevance = dim(
      score,
      present ? `Discovery package with ${ctx.discPkg!.clue_count} clue(s).` : 'No discovery-clue package for this case.',
      [`clues=${ctx.discPkg?.clue_count ?? 0}`, `status=${ctx.discPkg?.package_status ?? 'none'}`]
    );
  }

  // 13. Ending quality (heuristic, no spoilers in output)
  {
    const explanation = ctx.solutionLength >= 250;
    const timeline = ctx.actualTlCount >= 5;
    const noSpoiler = !ctx.culpritNameInPlayerText;
    const score = bool2(explanation) + bool2(timeline) + bool2(noSpoiler);
    s.ending_quality = dim(
      score,
      noSpoiler ? 'Substantive resolution with no player-facing spoiler (heuristic).'
        : 'Culprit name leaks into objectives/briefing, undermining the ending.',
      [`solutionLength=${ctx.solutionLength}`, `actualTl=${ctx.actualTlCount}`, `noSpoiler=${noSpoiler}`]
    );
  }

  // 14. Replayability (heuristic)
  {
    const alts = ctx.altsCount >= 2;
    const herrings = ctx.herringsCount >= 2;
    const paths = ctx.discoveryTypeCount >= 3 && ctx.evidenceCount - ctx.visibleCount >= 3;
    const score = bool2(alts) + bool2(herrings) + bool2(paths);
    s.replayability = dim(
      score,
      score === 3 ? 'Multiple theories, red herrings and gated paths support replay.'
        : 'Linear / single-path structure limits replay value.',
      [`alternatives=${ctx.altsCount}`, `redHerrings=${ctx.herringsCount}`, `gated=${ctx.evidenceCount - ctx.visibleCount}`]
    );
  }

  return s;
}

// ---------------------------------------------------------------------------
// Report model
// ---------------------------------------------------------------------------

const MAX_SCORE = DIMENSIONS.length * 3; // 42

interface CaseResult {
  id: string;
  title: string;
  genre: string;
  difficulty: string;
  scores: Record<string, DimResult>;
  total: number;
  maxScore: number;
  rating: Rating;
  flags: string[];
  refinementPriority: number;
  // Non-spoiling signals used to differentiate refinement candidates.
  solutionLength: number;
  descriptionLength: number;
  distinctMotiveCount: number;
  evidenceCount: number;
  specialistCount: number;
  hasKnowledgePack: boolean;
}

function rate(total: number): Rating {
  if (total >= Math.ceil(MAX_SCORE * 0.81)) return 'publication_ready';
  if (total >= Math.ceil(MAX_SCORE * 0.58)) return 'needs_refinement';
  return 'draft';
}

function evaluate(data: DbData): CaseResult[] {
  return data.cases.map((c) => {
    const ctx = buildContext(c, data);
    const scores = scoreCase(ctx);
    const total = DIMENSIONS.reduce((sum, d) => sum + (scores[d.key]?.score ?? 0), 0);
    const flags: string[] = [];
    if (ctx.culpritNameInPlayerText) flags.push('culprit-name-in-player-text');
    if (ctx.templatedBriefing) flags.push('templated-briefing');
    if (ctx.distinctMotiveCount < ctx.suspectCount * 0.6) flags.push('reused-suspect-motives');
    if (!ctx.pack) flags.push('no-knowledge-pack');
    if (!ctx.eventPkg) flags.push('no-living-events');
    if (!ctx.discPkg) flags.push('no-discovery-clues');
    if (ctx.specialists.length === 0) flags.push('no-specialists');
    if (ctx.herringsCount < 2 || ctx.altsCount < 2) flags.push('thin-alternatives');

    // Refinement priority: strong existing foundations are cheaper to polish.
    // Infra bonuses dominate; solution/description richness differentiates the
    // otherwise-identical generated cases.
    const priority =
      total +
      (ctx.pack ? 4 : 0) +
      (ctx.eventPkg ? 2 : 0) +
      (ctx.discPkg ? 2 : 0) +
      (ctx.artifacts.length >= 3 ? 2 : 0) +
      Math.min(3, Math.floor(ctx.solutionLength / 60)) +
      Math.min(2, Math.floor(ctx.descriptionLength / 35)) +
      (ctx.distinctMotiveCount >= 3 ? 1 : 0) +
      (!ctx.templatedBriefing ? 1 : 0);

    return {
      id: c.id,
      title: text(c.title),
      genre: text(c.genre) || 'Unspecified',
      difficulty: text(c.difficulty) || 'Unspecified',
      scores,
      total,
      maxScore: MAX_SCORE,
      rating: rate(total),
      flags,
      refinementPriority: priority,
      solutionLength: ctx.solutionLength,
      descriptionLength: ctx.descriptionLength,
      distinctMotiveCount: ctx.distinctMotiveCount,
      evidenceCount: ctx.evidenceCount,
      specialistCount: ctx.specialists.length,
      hasKnowledgePack: Boolean(ctx.pack),
    };
  });
}

function selectCandidates(results: CaseResult[], count = 6): CaseResult[] {
  // Publication-ready cases are benchmarks, not refinement targets.
  return [...results]
    .filter((r) => r.rating !== 'publication_ready')
    .sort(
      (a, b) =>
        b.refinementPriority - a.refinementPriority ||
        b.solutionLength - a.solutionLength ||
        b.descriptionLength - a.descriptionLength ||
        a.title.localeCompare(b.title)
    )
    .slice(0, count);
}

function selectExemplars(results: CaseResult[]): CaseResult[] {
  return results.filter((r) => r.rating === 'publication_ready');
}

// ---------------------------------------------------------------------------
// Output (spoiler-free)
// ---------------------------------------------------------------------------

function ratingLabel(r: Rating): string {
  return r === 'publication_ready' ? 'Publication-ready'
    : r === 'needs_refinement' ? 'Needs refinement' : 'Draft / substantial work';
}

function buildMarkdown(
  results: CaseResult[],
  candidates: CaseResult[],
  exemplars: CaseResult[],
  generatedAt: string
): string {
  const lines: string[] = [];
  lines.push('# M8 Case Quality & Content Audit');
  lines.push('');
  lines.push(`> Generated by \`npm run case:quality\` (read-only; informational). ${generatedAt}.`);
  lines.push('> **Spoiler-safe:** this report contains scores, counts and flags only — no culprit names, motives, methods or solution text.');
  lines.push('');
  lines.push('## Method & honesty note');
  lines.push('');
  lines.push('Each of the 14 M8-4 dimensions is scored 0–3 (max total **42**). Every dimension declares a method:');
  lines.push('');
  lines.push('- **automated** — objective structural facts read from the DB.');
  lines.push('- **heuristic** — deterministic threshold proxy; directionally useful, confirm with a human.');
  lines.push('- **human_review** — cannot be reliably automated; the number is a PLACEHOLDER proxy and must be confirmed by a human reviewer.');
  lines.push('');
  lines.push('Ratings: **Publication-ready** ≥34 · **Needs refinement** ≥25 · **Draft / substantial work** <25.');
  lines.push('Low scores are warnings only — this script never fails on quality.');
  lines.push('');
  lines.push('| # | Dimension | Method | Max rubric (abridged) |');
  lines.push('|---|---|---|---|');
  DIMENSIONS.forEach((d, i) => lines.push(`| ${i + 1} | ${d.label} | ${d.method} | ${d.criterion} |`));
  lines.push('');

  const counts: Record<Rating, number> = { publication_ready: 0, needs_refinement: 0, draft: 0 };
  results.forEach((r) => counts[r.rating]++);
  const avg = results.length
    ? (results.reduce((s, r) => s + r.total, 0) / results.length).toFixed(1)
    : '0.0';
  lines.push('## Score distribution');
  lines.push('');
  lines.push(`- Cases audited: **${results.length}**`);
  lines.push(`- Average total: **${avg} / ${MAX_SCORE}**`);
  lines.push(`- Publication-ready (≥34): **${counts.publication_ready}**`);
  lines.push(`- Needs refinement (25–33): **${counts.needs_refinement}**`);
  lines.push(`- Draft / substantial work (<25): **${counts.draft}**`);
  lines.push('');
  lines.push('### Systemic findings (affect most cases)');
  lines.push('');
  const leakCount = results.filter((r) => r.flags.includes('culprit-name-in-player-text')).length;
  const tmplCount = results.filter((r) => r.flags.includes('templated-briefing')).length;
  const motiveCount = results.filter((r) => r.flags.includes('reused-suspect-motives')).length;
  const noPack = results.filter((r) => r.flags.includes('no-knowledge-pack')).length;
  const noDisc = results.filter((r) => r.flags.includes('no-discovery-clues')).length;
  lines.push(`- Culprit name appears in player-facing objectives/briefing: **${leakCount}/${results.length}** (fair-challenge defect).`);
  lines.push(`- Templated briefing text: **${tmplCount}/${results.length}**.`);
  lines.push(`- Reused/generic suspect motives: **${motiveCount}/${results.length}**.`);
  lines.push(`- No knowledge pack: **${noPack}/${results.length}**; no discovery-clue package: **${noDisc}/${results.length}**.`);
  lines.push('');

  lines.push('## Per-case scorecards');
  lines.push('');
  lines.push('`P`=premise · `N`=narrative · `T`=truth · `M`=motives · `E`=evidence · `D`=deduction · `A`=alternatives · `X`=traceability · `S`=specialists · `K`=knowledge · `V`=perspectives · `C`=discovery · `L`=ending · `R`=replay');
  lines.push('');
  for (const r of results) {
    const abbr: Record<string, string> = {
      premise_quality: 'P', narrative_coherence: 'N', canonical_truth_integrity: 'T',
      suspect_motivations: 'M', evidence_quality: 'E', deduction_difficulty: 'D',
      alternative_hypotheses: 'A', evidence_traceability: 'X', specialist_relevance: 'S',
      knowledge_opportunities: 'K', perspective_relevance: 'V', discovery_clue_relevance: 'C',
      ending_quality: 'L', replayability: 'R',
    };
    const cell = DIMENSIONS.map((d) => `${abbr[d.key]}${r.scores[d.key]?.score ?? 0}`).join(' ');
    lines.push(`### ${r.title}`);
    lines.push('');
    lines.push(`- **Total ${r.total}/${MAX_SCORE}** · ${ratingLabel(r.rating)} · ${r.genre} · ${r.difficulty}`);
    lines.push(`- Scores: ${cell}`);
    if (r.flags.length) lines.push(`- Flags: ${r.flags.map((f) => `\`${f}\``).join(', ')}`);
    else lines.push('- Flags: none');
    const weak = DIMENSIONS.filter((d) => (r.scores[d.key]?.score ?? 0) <= 1).map((d) => d.label);
    if (weak.length) lines.push(`- Weakest dimensions: ${weak.join(', ')}`);
    lines.push('');
  }

  if (exemplars.length) {
    lines.push('## Benchmarks (already publication-ready)');
    lines.push('');
    lines.push('These cases already meet the publication bar and serve as the reference quality target for refinement; they are **not** listed as refinement candidates.');
    lines.push('');
    exemplars.forEach((r) => {
      lines.push(`- **${r.title}** — ${r.total}/${MAX_SCORE}. Strongest content, specialist/knowledge/discovery infrastructure, and fair player-facing text; use as the quality benchmark.`);
    });
    lines.push('');
  }

  lines.push('## Selected publication-quality refinement candidates');
  lines.push('');
  lines.push('Chosen by a deterministic *refinement-priority* score that favours cases with the strongest existing content foundations and authoring infrastructure (cheapest to lift to publication quality), with solution/description richness as tie-breakers. These are **candidates for the next refinement slice**, not assertions that the case is currently publication-ready. Publication-ready cases are excluded (listed as benchmarks above).');
  lines.push('');
  lines.push('| Rank | Case | Current total | Rating | Why selected |');
  lines.push('|---|---|---|---|---|');
  candidates.forEach((r, i) => {
    const reasons: string[] = [];
    if (r.hasKnowledgePack && r.specialistCount >= 3) reasons.push('full specialist/knowledge setup already present');
    if ((r.scores.discovery_clue_relevance?.score ?? 0) > 0) reasons.push('discovery-clue package present');
    if ((r.scores.alternative_hypotheses?.score ?? 0) >= 2) reasons.push('multiple alternatives/red herrings');
    if ((r.scores.canonical_truth_integrity?.score ?? 0) === 3) reasons.push('intact canonical truth');
    if ((r.scores.evidence_quality?.score ?? 0) === 3) reasons.push('rich evidence set');
    if (r.solutionLength >= 185) reasons.push(`substantive solution explanation (${r.solutionLength} chars)`);
    if (r.flags.includes('culprit-name-in-player-text')) reasons.push('fixable fairness leak (high ROI)');
    if (!reasons.length) reasons.push('strongest remaining foundation');
    lines.push(`| ${i + 1} | ${r.title} | ${r.total}/${MAX_SCORE} | ${ratingLabel(r.rating)} | ${reasons.join('; ')} |`);
  });
  lines.push('');
  lines.push('## Gaps in automated scoring / human review needed');
  lines.push('');
  lines.push('- **Narrative coherence** and **perspective relevance** are marked `human_review`; their scores are proxies only and must be confirmed by reading the prose and mapping reasoning lenses.');
  lines.push('- Intent-based dimensions (premise originality, motive plausibility, fair difficulty, ending satisfaction, replay value) cannot be fully judged from structural counts.');
  lines.push('- The culprit-name-in-player-text check is a keyword heuristic (full name in objectives/briefing); it can miss indirect spoilers and should be human-confirmed.');
  lines.push('- No spoilers are emitted: canonical solution details are deliberately excluded from all outputs.');
  lines.push('');
  return lines.join('\n');
}

function writeOutputs(
  results: CaseResult[],
  candidates: CaseResult[],
  exemplars: CaseResult[]
): { mdPath: string; jsonPath: string } {
  const projectRoot = process.cwd();
  const reportDir = process.env.AUDIT_REPORT_DIR
    ? path.resolve(process.env.AUDIT_REPORT_DIR)
    : path.resolve(projectRoot, '..', 'project-management');
  fs.mkdirSync(reportDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const mdPath = path.join(reportDir, 'M8-CASE-QUALITY-AUDIT.md');
  const jsonPath = path.join(reportDir, 'M8-CASE-QUALITY-AUDIT.json');

  const json = {
    generatedAt,
    maxScore: MAX_SCORE,
    dimensions: DIMENSIONS,
    summary: {
      casesAudited: results.length,
      averageTotal: results.length
        ? Number((results.reduce((s, r) => s + r.total, 0) / results.length).toFixed(2))
        : 0,
      counts: {
        publication_ready: results.filter((r) => r.rating === 'publication_ready').length,
        needs_refinement: results.filter((r) => r.rating === 'needs_refinement').length,
        draft: results.filter((r) => r.rating === 'draft').length,
      },
    },
    cases: results,
    exemplars: exemplars.map((r) => ({ title: r.title, total: r.total, rating: r.rating })),
    refinementCandidates: candidates.map((r) => ({
      title: r.title,
      total: r.total,
      rating: r.rating,
      refinementPriority: r.refinementPriority,
      solutionLength: r.solutionLength,
      descriptionLength: r.descriptionLength,
      hasKnowledgePack: r.hasKnowledgePack,
      specialistCount: r.specialistCount,
    })),
  };

  fs.writeFileSync(mdPath, buildMarkdown(results, candidates, exemplars, generatedAt), 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2), 'utf8');
  return { mdPath, jsonPath };
}

function printStdout(
  results: CaseResult[],
  candidates: CaseResult[],
  exemplars: CaseResult[],
  paths: { mdPath: string; jsonPath: string }
): void {
  console.log('M8 CASE QUALITY AUDIT (read-only; informational — low scores never fail the run)\n');
  console.log('Title'.padEnd(30), 'Total', 'Rating');
  console.log('-'.repeat(56));
  for (const r of results) {
    console.log(r.title.slice(0, 29).padEnd(30), String(r.total).padStart(3) + '/' + MAX_SCORE, ' ', ratingLabel(r.rating));
  }
  const avg = results.length
    ? (results.reduce((s, r) => s + r.total, 0) / results.length).toFixed(1) : '0.0';
  console.log('-'.repeat(56));
  console.log(`Cases: ${results.length} | Average: ${avg}/${MAX_SCORE}`);
  console.log(`Publication-ready: ${results.filter((r) => r.rating === 'publication_ready').length} | Needs refinement: ${results.filter((r) => r.rating === 'needs_refinement').length} | Draft: ${results.filter((r) => r.rating === 'draft').length}`);
  console.log(`\nWarnings: ${results.filter((r) => r.flags.includes('culprit-name-in-player-text')).length}/${results.length} cases leak the culprit name into player-facing text.`);
  if (exemplars.length) console.log(`\nBenchmarks (publication-ready): ${exemplars.map((r) => r.title).join(', ')}`);
  console.log('\nRefinement candidates:');
  candidates.forEach((r, i) => console.log(`  ${i + 1}. ${r.title} (${r.total}/${MAX_SCORE}, priority ${r.refinementPriority})`));
  console.log(`\nReport: ${paths.mdPath}`);
  console.log(`JSON:   ${paths.jsonPath}`);
}

// ---------------------------------------------------------------------------
// Entry point — non-zero ONLY on execution/DB errors
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const pool = new Pool(connectionConfig() as any);
  try {
    const data = await loadData(pool);
    if (data.cases.length === 0) {
      console.error('ERROR: no published cases found in the database.');
      process.exitCode = 1;
      return;
    }
    const results = evaluate(data);
    const candidates = selectCandidates(results, 6);
    const exemplars = selectExemplars(results);
    const paths = writeOutputs(results, candidates, exemplars);
    printStdout(results, candidates, exemplars, paths);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('CASE QUALITY AUDIT FAILED (execution/DB error):', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
