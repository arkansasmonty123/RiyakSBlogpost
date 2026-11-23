// M6 read-only validator for authored case-event packages.
//
//   npm run case-events:validate
//
// Checks package/case resolution, closed-union shape, evidence/checkpoint/action
// grounding, leakage safety, expiry/supersession rules, coverage minimums, a
// static no-canonical-truth-import scan, and a DTO safety smoke test.
// This script never writes to the database.

import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../src/db';
import { getCaseEventPackages } from '../src/case-events/registry';
import { normalizeSourceRef, parseAnchor } from '../src/living-world/oracle';
import { containsInternalLeakTerm, scanForForbiddenTerms } from '../src/living-world/safety';
import { toSafeActivityEvent } from '../src/living-world/dto';
import { M6_EVENT_CATEGORIES } from '../src/living-world/types';
import type {
  CaseEventDefinition, CaseEventPackage, ConsequenceDefinition, InvestigationEventRow,
} from '../src/living-world/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KNOWN_CHECKPOINTS = new Set([
  'alarm-window-identified', 'silver-cane-identified', 'motive-question-raised',
  'timeline-established-17', 'contradiction-found-17', 'motive-question-raised-17',
  'timeline-established-6', 'contradiction-found-6', 'motive-question-raised-6',
]);
const CATEGORIES = new Set<string>(M6_EVENT_CATEGORIES);
const REQUIRED_COVERAGE = [
  'team_disagreement', 'investigative_setback', 'follow_up_lead', 'external_development',
];

const failures: string[] = [];
function check(condition: boolean, message: string): void {
  if (!condition) failures.push(message);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Server-authoring text surfaces that must never contain leakage terms. */
function presentationStrings(def: CaseEventDefinition): string[] {
  const p = def.presentation;
  const values: unknown[] = [
    p.title, p.summary, p.detail, p.whyItMatters,
    p.upcomingTeaser?.title,
  ];
  for (const option of asArray(p.responseOptions)) {
    values.push((option as { label?: unknown })?.label);
  }
  return values.filter((value): value is string => typeof value === 'string');
}

function consequenceStrings(consequence: ConsequenceDefinition | undefined): string[] {
  if (!consequence) return [];
  switch (consequence.kind) {
    case 'development': return [consequence.messageTemplate];
    case 'release_lead': return [consequence.actionLabel ?? ''];
    case 'new_action': return [consequence.label, consequence.action];
    case 'set_flag': return [consequence.flag, JSON.stringify(consequence.value ?? {})];
    case 'team_disagreement': return [
      consequence.topic, consequence.positionA, consequence.positionB,
      consequence.uncertaintyNote, consequence.specialistAKey, consequence.specialistBKey,
    ];
    case 'suspect_behavior': return [consequence.characterName, consequence.publicReason];
    case 'missed_opportunity': return [consequence.flag, consequence.message, consequence.alternativeEventKey ?? ''];
    case 'noop': return [];
  }
}

function scanStrings(strings: string[], leakageTerms: string[], label: string): void {
  for (const value of strings) {
    if (!value) continue;
    check(containsInternalLeakTerm(value) === null, `${label}: internal term in "${value.slice(0, 40)}"`);
    check(scanForForbiddenTerms(value, leakageTerms) === null, `${label}: leakage term in "${value.slice(0, 40)}"`);
  }
}

function hasCycle(edges: Map<string, string[]>): boolean {
  const state = new Map<string, number>();
  function visit(node: string): boolean {
    const current = state.get(node) ?? 0;
    if (current === 1) return true;
    if (current === 2) return false;
    state.set(node, 1);
    for (const next of edges.get(node) ?? []) {
      if (visit(next)) return true;
    }
    state.set(node, 2);
    return false;
  }
  for (const node of edges.keys()) {
    if (visit(node)) return true;
  }
  return false;
}

interface CaseGrounding {
  sources: Set<string>;
  hiddenWithConditions: Set<string>;
  checkpoints: Set<string>;
  actions: Set<string>;
}

async function loadGrounding(caseId: string): Promise<CaseGrounding> {
  const result = await pool.query(
    `SELECT source, player_visible AS "playerVisible", discovery_conditions AS "discoveryConditions"
       FROM evidence WHERE case_id=$1`,
    [caseId],
  );
  const grounding: CaseGrounding = {
    sources: new Set<string>(),
    hiddenWithConditions: new Set<string>(),
    checkpoints: new Set<string>(KNOWN_CHECKPOINTS),
    actions: new Set<string>(),
  };
  for (const row of result.rows as Array<{ source: string | null; playerVisible: boolean; discoveryConditions: unknown }>) {
    const source = normalizeSourceRef(row.source ?? '');
    if (!source) continue;
    grounding.sources.add(source);
    const conditions = (row.discoveryConditions && typeof row.discoveryConditions === 'object')
      ? row.discoveryConditions as Record<string, unknown>
      : {};
    if (!row.playerVisible && Object.keys(conditions).length > 0) {
      grounding.hiddenWithConditions.add(source);
    }
    if (typeof conditions.action === 'string' && conditions.action) grounding.actions.add(conditions.action);
    for (const value of asArray(conditions.requires)) {
      if (typeof value === 'string' && value) grounding.checkpoints.add(value);
    }
  }
  return grounding;
}

function validateAnchor(ref: string, defKey: string, grounding: CaseGrounding): void {
  const parsed = parseAnchor(ref);
  check(parsed !== null, `${defKey}: invalid anchor ${ref}`);
  if (!parsed) return;
  if (parsed.kind === 'evidence') {
    check(grounding.sources.has(parsed.ref), `${defKey}: evidence anchor does not resolve: ${parsed.ref}`);
  } else if (parsed.kind === 'checkpoint') {
    check(grounding.checkpoints.has(parsed.ref), `${defKey}: checkpoint anchor does not resolve: ${parsed.ref}`);
  } else if (parsed.kind === 'action') {
    check(grounding.actions.has(parsed.ref), `${defKey}: action anchor does not resolve: ${parsed.ref}`);
  } else if (parsed.kind === 'flag') {
    check(!UUID_RE.test(parsed.ref), `${defKey}: flag anchor looks like a UUID: ${parsed.ref}`);
  }
}

function validateEvent(def: CaseEventDefinition, pkg: CaseEventPackage, grounding: CaseGrounding): void {
  const label = `${pkg.packageKey}/${def.key}`;
  check(CATEGORIES.has(def.category), `${label}: invalid category ${def.category}`);
  check(def.timing.afterMinutes >= 0 && Number.isFinite(def.timing.afterMinutes), `${label}: invalid afterMinutes`);
  validateAnchor(String(def.timing.anchor), label, grounding);

  const evidenceRefs: unknown[] = [
    ...asArray(def.eligibility.requiresVisibleEvidence),
    ...asArray(def.requiredState?.visibleEvidenceRefs),
    ...asArray(def.provenance.evidenceRefs),
  ];
  for (const raw of evidenceRefs) {
    const source = normalizeSourceRef(raw);
    check(source !== null, `${label}: evidence ref must be a source string, got ${String(raw).slice(0, 40)}`);
    if (source) check(grounding.sources.has(source), `${label}: evidence ref does not resolve: ${source}`);
  }

  for (const cp of asArray(def.eligibility.completedCheckpoints)) {
    check(grounding.checkpoints.has(String(cp)), `${label}: checkpoint does not resolve: ${String(cp)}`);
  }
  for (const action of asArray(def.provenance.artifactKeys)) {
    check(!UUID_RE.test(String(action)), `${label}: artifact key looks like a UUID`);
  }

  const consequence = def.consequence;
  if (consequence.kind === 'release_lead') {
    const source = normalizeSourceRef(consequence.evidenceRef);
    check(source !== null, `${label}: release_lead evidenceRef must be a source string`);
    if (source) {
      check(grounding.sources.has(source), `${label}: release_lead target does not resolve: ${source}`);
      check(grounding.hiddenWithConditions.has(source), `${label}: release_lead target must be hidden with discovery_conditions: ${source}`);
    }
  }
  if (consequence.kind === 'missed_opportunity') {
    check(
      Boolean(consequence.alternativeEventKey) || consequence.nonEssential === true,
      `${label}: missed_opportunity needs alternativeEventKey or nonEssential`,
    );
  }
  const expiry = def.onExpiry;
  if (expiry?.kind === 'missed_opportunity') {
    check(
      Boolean(expiry.alternativeEventKey) || expiry.nonEssential === true,
      `${label}: onExpiry missed_opportunity needs alternativeEventKey or nonEssential`,
    );
  }
  for (const alternative of asArray(def.alternatives)) {
    const branch = alternative as { consequence?: ConsequenceDefinition };
    scanStrings(consequenceStrings(branch.consequence), pkg.leakageTerms, `${label}/alternative`);
  }

  scanStrings(presentationStrings(def), pkg.leakageTerms, `${label}/presentation`);
  scanStrings(consequenceStrings(consequence), pkg.leakageTerms, `${label}/consequence`);
  scanStrings(consequenceStrings(expiry), pkg.leakageTerms, `${label}/onExpiry`);
}

function validateStaticSources(): void {
  const roots = [
    path.resolve(process.cwd(), 'src', 'living-world'),
    path.resolve(process.cwd(), 'src', 'case-events'),
  ];
  const forbidden = /\bcanonical_truth\b|\bhidden_events\b/i;
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name === 'safety.ts') continue;
      const contents = fs.readFileSync(path.join(root, entry.name), 'utf8');
      const codeLines = contents
        .split(/\r?\n/)
        .filter((line) => {
          const trimmed = line.trim();
          return !trimmed.startsWith('//') && !trimmed.startsWith('*') &&
            !trimmed.startsWith('/*') && !trimmed.startsWith('*/');
        });
      check(!forbidden.test(codeLines.join('\n')), `${entry.name}: forbidden canonical-truth reference in code`);
    }
  }
}

function validateDtoSafety(): void {
  const row = {
    id: 'test-event',
    eventType: 'specialist_discovery',
    status: 'resolved',
    significance: 'normal',
    groupKey: null,
    actorKind: 'team',
    actorKey: null,
    eligibleAt: new Date().toISOString(),
    resolvedAt: new Date().toISOString(),
    presentation: {
      title: 'Report contains canonical_truth details',
      summary: 'ok', detail: 'ok', whyItMatters: 'ok', requiresResponse: false,
    },
    outcome: { changes: [] },
    provenance: {},
  } as unknown as InvestigationEventRow;
  let rejected = false;
  try {
    toSafeActivityEvent(row, { leakageTerms: [] });
  } catch {
    rejected = true;
  }
  check(rejected, 'DTO smoke: toSafeActivityEvent must reject an internal leak term');

  const leaky = {
    ...row,
    presentation: { title: 'A note about the suspect', summary: 'ok', detail: 'ok', whyItMatters: 'ok', requiresResponse: false },
  } as unknown as InvestigationEventRow;
  let rejectedLeak = false;
  try {
    toSafeActivityEvent(leaky, { leakageTerms: ['suspect'] });
  } catch {
    rejectedLeak = true;
  }
  check(rejectedLeak, 'DTO smoke: toSafeActivityEvent must reject a case leakage term');
}

async function main(): Promise<void> {
  console.log('M6 Case-event package validator (read-only)\n');
  const packages = getCaseEventPackages();
  check(packages.length >= 3, `expected at least 3 authored packages, found ${packages.length}`);

  const packageKeys = new Set<string>();
  const allCategories = new Set<string>();

  for (const pkg of packages) {
    console.log(`  ${pkg.packageKey} (${pkg.caseTitle})`);
    check(!packageKeys.has(pkg.packageKey), `${pkg.packageKey}: duplicate package key`);
    packageKeys.add(pkg.packageKey);

    const caseRes = await pool.query('SELECT id FROM cases WHERE title=$1 LIMIT 1', [pkg.caseTitle]);
    const caseRow = caseRes.rows[0] as { id: string } | undefined;
    if (!caseRow) {
      failures.push(`${pkg.packageKey}: case title does not resolve: ${pkg.caseTitle}`);
      continue;
    }
    const grounding = await loadGrounding(caseRow.id);

    const eventKeys = new Set<string>();
    const edges = new Map<string, string[]>();
    let expiryCount = 0;
    let supersessionCount = 0;

    for (const def of pkg.events) {
      check(!eventKeys.has(def.key), `${pkg.packageKey}: duplicate event key ${def.key}`);
      eventKeys.add(def.key);
      edges.set(def.key, []);
      allCategories.add(def.category);
      if (def.expiresAfterMinutes !== undefined || def.onExpiry) expiryCount += 1;
      if ((def.supersedes?.length ?? 0) > 0) supersessionCount += 1;
      validateEvent(def, pkg, grounding);
    }
    for (const def of pkg.events) {
      for (const target of asArray(def.supersedes)) {
        check(eventKeys.has(String(target)), `${pkg.packageKey}/${def.key}: supersedes unknown event ${String(target)}`);
        const list = edges.get(def.key) ?? [];
        list.push(String(target));
        edges.set(def.key, list);
      }
      for (const source of asArray(def.supersededBy)) {
        check(eventKeys.has(String(source)), `${pkg.packageKey}/${def.key}: supersededBy unknown event ${String(source)}`);
      }
    }
    check(!hasCycle(edges), `${pkg.packageKey}: supersession graph contains a cycle`);

    check(pkg.events.length >= 8, `${pkg.packageKey}: needs >= 8 events (found ${pkg.events.length})`);
    const categories = new Set<string>(pkg.events.map((event) => event.category));
    check(categories.size >= 6, `${pkg.packageKey}: needs >= 6 categories (found ${categories.size})`);
    for (const required of REQUIRED_COVERAGE) {
      check(categories.has(required), `${pkg.packageKey}: missing required category ${required}`);
    }
    check(expiryCount > 0, `${pkg.packageKey}: missing expiry + alternative coverage`);
    check(supersessionCount > 0, `${pkg.packageKey}: missing supersession coverage`);
    check(pkg.leakageTerms.length > 0, `${pkg.packageKey}: leakageTerms guard list must not be empty`);
  }

  for (const category of M6_EVENT_CATEGORIES) {
    check(allCategories.has(category), `cross-package coverage missing category ${category}`);
  }

  validateStaticSources();
  validateDtoSafety();
}

main()
  .then(() => {
    if (failures.length > 0) {
      console.error(`\nCASE EVENTS VALIDATE: FAIL (${failures.length})`);
      for (const failure of failures) console.error(`  - ${failure}`);
      process.exitCode = 1;
      return;
    }
    console.log('\nCASE EVENTS VALIDATE: PASS');
  })
  .catch((err: Error) => {
    console.error('CASE EVENTS VALIDATE: FAIL');
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
