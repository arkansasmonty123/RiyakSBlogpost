// M7 read-only validator for authored discovery-clue packages.
//
//   npm run discovery-clues:validate
//
// Checks package/case resolution, key uniqueness, closed unions, dependency
// acyclicity, trigger and unlock grounding against seeded case data, leakage
// guards, source URL policy, corrected-understanding presence, a static
// canonical-truth/purity scan of src/discovery-clues, and DTO safety.
// This script NEVER writes to the database and never reads canonical_truth.

import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../src/db';
import { getDiscoveryPackages } from '../src/discovery-clues/registry';
import { containsInternalLeakTerm, scanForForbiddenTerms } from '../src/discovery-clues/safety';
import { toSafeDiscoveryClueDTO, toSafeUnlockDTO } from '../src/discovery-clues/dto';
import {
  DIFFICULTIES, DISCOVERY_CLASSIFICATIONS, DISCOVERY_REFERENCE_CATEGORIES,
  DISCOVERY_SOURCE_TYPES, KNOWLEDGE_STATUSES, PACK_STATUSES, UNLOCK_KINDS,
  VERIFICATION_STATUSES,
  type DiscoveryClue, type DiscoveryCluePackage,
} from '../src/discovery-clues/types';

const failures: string[] = [];
function check(condition: boolean, message: string): void {
  if (!condition) failures.push(message);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

interface Grounding {
  sources: Set<string>;
  artifacts: Set<string>;
  actions: Set<string>;
  checkpoints: Set<string>;
  specialists: Set<string>;
}

function addStrings(target: Set<string>, values: readonly string[]): void {
  for (const value of values) {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized) target.add(normalized);
  }
}

async function loadGrounding(caseId: string): Promise<Grounding> {
  const grounding: Grounding = {
    sources: new Set<string>(),
    artifacts: new Set<string>(),
    actions: new Set<string>(),
    checkpoints: new Set<string>(),
    specialists: new Set<string>(),
  };

  const evidence = await pool.query(
    `SELECT source, discovery_conditions AS "discoveryConditions"
       FROM evidence WHERE case_id = $1`,
    [caseId],
  );
  for (const row of evidence.rows as Array<{ source: string | null; discoveryConditions: unknown }>) {
    addStrings(grounding.sources, [String(row.source ?? '')]);
    const conditions = row.discoveryConditions && typeof row.discoveryConditions === 'object'
      ? row.discoveryConditions as Record<string, unknown>
      : {};
    if (typeof conditions.action === 'string') addStrings(grounding.actions, [conditions.action]);
    for (const value of asArray(conditions.requires)) {
      if (typeof value === 'string') addStrings(grounding.checkpoints, [value]);
    }
  }

  const artifacts = await pool.query('SELECT artifact_key FROM knowledge_artifacts WHERE case_id = $1', [caseId]);
  for (const row of artifacts.rows as Array<{ artifact_key: string }>) {
    addStrings(grounding.artifacts, [row.artifact_key]);
  }

  const specialists = await pool.query('SELECT specialist_key FROM specialists');
  for (const row of specialists.rows as Array<{ specialist_key: string }>) {
    addStrings(grounding.specialists, [row.specialist_key]);
  }

  return grounding;
}

function publicStrings(clue: DiscoveryClue, pkg: DiscoveryCluePackage): string[] {
  const values: unknown[] = [
    clue.subjectKey, clue.subjectLabel, clue.title, clue.prompt, clue.context,
    clue.correctedUnderstanding,
  ];
  for (const citation of clue.citations) {
    values.push(citation.label, citation.bibliographyRef, citation.verificationNotes);
  }
  for (const unlock of clue.unlocks) {
    const dto = toSafeUnlockDTO(unlock);
    values.push(dto.key, dto.kind, dto.targetRef, dto.label, dto.detail);
  }
  return values
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .concat([pkg.summary]);
}

function scanPublicStrings(clue: DiscoveryClue, pkg: DiscoveryCluePackage, label: string): void {
  const terms = [...pkg.leakageTerms, ...(clue.leakageTerms ?? [])];
  for (const value of publicStrings(clue, pkg)) {
    check(containsInternalLeakTerm(value) === null, `${label}: internal term in public string "${value.slice(0, 40)}"`);
    check(scanForForbiddenTerms(value, terms) === null, `${label}: leakage term in public string "${value.slice(0, 40)}"`);
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

function validateDtoSafety(clue: DiscoveryClue, pkg: DiscoveryCluePackage, label: string): void {
  const terms = [...pkg.leakageTerms, ...(clue.leakageTerms ?? [])];
  const before = toSafeDiscoveryClueDTO(clue, { accepted: false, leakageTerms: terms });
  check(before.correctedUnderstanding === null, `${label}: DTO must hide correctedUnderstanding before acceptance`);
  check(before.accepted === false, `${label}: DTO accepted flag must be false before acceptance`);
  const serialized = JSON.stringify(before);
  const internalMarkers = [
    'criteria', 'aliases', 'minEssentialMatches', 'misconceptionTerms',
    'confidentMarkers', 'leakageTerms', 'reasons', 'matchedEssential',
  ];
  for (const marker of internalMarkers) {
    check(!serialized.includes(marker), `${label}: DTO exposed internal field ${marker}`);
  }
  for (const citation of before.citations) {
    check(citation.sourceUrl === null, `${label}: unverified citation must not expose a URL`);
  }

  const after = toSafeDiscoveryClueDTO(clue, { accepted: true, leakageTerms: terms });
  check(after.correctedUnderstanding === clue.correctedUnderstanding, `${label}: accepted DTO must expose correctedUnderstanding`);
  check(scanForForbiddenTerms(JSON.stringify(after), terms) === null, `${label}: accepted DTO contained a leakage term`);
}

function validateStaticSources(): void {
  const root = path.resolve(process.cwd(), 'src', 'discovery-clues');
  if (!fs.existsSync(root)) {
    failures.push('src/discovery-clues directory is missing');
    return;
  }
  const forbidden = /\bcanonical_truth\b|\bhidden_events\b|\bhidden_interpretation\b|\bevidence_discoveries\b/i;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name === 'safety.ts') continue;
    const contents = fs.readFileSync(path.join(root, entry.name), 'utf8');
    const codeLines = contents.split(/\r?\n/).filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') &&
        !trimmed.startsWith('/*') && !trimmed.startsWith('*/');
    });
    const code = codeLines.join('\n');
    check(!forbidden.test(code), `${entry.name}: forbidden canonical/evidence-release reference in code`);
    check(!/from\s+['"]\.\.\/db['"]/.test(code), `${entry.name}: M7 modules must not import db.ts`);
    check(!/\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(code), `${entry.name}: M7 modules must not mutate the DB`);
  }
}

function validateClue(
  clue: DiscoveryClue,
  pkg: DiscoveryCluePackage,
  grounding: Grounding,
  packageClueKeys: Set<string>,
): void {
  const label = `${pkg.packageKey}/${clue.key}`;
  check(!packageClueKeys.has(clue.key), `${label}: duplicate clue key within package`);
  packageClueKeys.add(clue.key);

  check(nonEmpty(clue.subjectKey) && nonEmpty(clue.subjectLabel), `${label}: missing subject key/label`);
  check(DISCOVERY_REFERENCE_CATEGORIES.includes(clue.referenceCategory), `${label}: invalid reference category ${clue.referenceCategory}`);
  check(DIFFICULTIES.includes(clue.difficulty), `${label}: invalid difficulty ${clue.difficulty}`);
  check(KNOWLEDGE_STATUSES.includes(clue.knowledgeStatus), `${label}: invalid knowledge status ${clue.knowledgeStatus}`);
  check(nonEmpty(clue.title) && nonEmpty(clue.prompt) && nonEmpty(clue.context), `${label}: missing public text`);
  check(nonEmpty(clue.correctedUnderstanding), `${label}: correctedUnderstanding is required`);
  check(clue.evidenceRefs.length > 0, `${label}: at least one evidenceRef is required`);
  check(clue.specialistKeys.length > 0, `${label}: at least one specialistKey is required`);

  const criteria = clue.criteria;
  check(criteria.subjectAliases.length > 0, `${label}: subjectAliases must not be empty`);
  check(criteria.essentialConcepts.length >= 3, `${label}: need at least 3 essential concepts`);
  check(criteria.connectionMarkers.length > 0, `${label}: connectionMarkers must not be empty`);
  check(criteria.misconceptionTerms.length > 0, `${label}: misconceptionTerms must not be empty`);
  check(criteria.confidentMarkers.length > 0, `${label}: confidentMarkers must not be empty`);
  check(
    criteria.minEssentialMatches >= 1 && criteria.minEssentialMatches <= criteria.essentialConcepts.length,
    `${label}: invalid minEssentialMatches`,
  );
  check(criteria.minAssertionChars > 0, `${label}: minAssertionChars must be positive`);
  for (const concept of [...criteria.essentialConcepts, ...criteria.optionalConcepts]) {
    check(nonEmpty(concept.key) && concept.aliases.length > 0, `${label}: invalid concept criterion ${String(concept.key)}`);
  }

  check(clue.citations.length > 0, `${label}: at least one citation is required`);
  for (const citation of clue.citations) {
    const citationLabel = `${label}/citation:${citation.label}`;
    check(nonEmpty(citation.label) && nonEmpty(citation.bibliographyRef), `${citationLabel}: missing label/reference`);
    check(nonEmpty(citation.verificationNotes), `${citationLabel}: verificationNotes required`);
    check(DISCOVERY_SOURCE_TYPES.includes(citation.sourceType), `${citationLabel}: invalid sourceType`);
    check(VERIFICATION_STATUSES.includes(citation.verificationStatus), `${citationLabel}: invalid verificationStatus`);
    check(
      citation.sourceUrl === null && citation.sourceVerified === false && citation.verificationStatus === 'pending_review',
      `${citationLabel}: showcase citations must be pending_review with null URL and unverified flag`,
    );
  }

  const trigger = clue.triggers;
  const triggerCount =
    (trigger.visibleEvidence?.length ?? 0) + (trigger.completedCheckpoints?.length ?? 0) +
    (trigger.actionsPerformed?.length ?? 0) + (trigger.artifactKeys?.length ?? 0) +
    (trigger.minDiscoveredEvidence ?? 0) + (trigger.acceptedDependencies?.length ?? 0);
  check(triggerCount > 0, `${label}: at least one trigger is required`);

  const resolveRef = (value: string, set: Set<string>, kind: string): void => {
    check(set.has(String(value).trim().toLowerCase()), `${label}: ${kind} trigger does not resolve: ${value}`);
  };
  for (const ref of trigger.visibleEvidence ?? []) resolveRef(ref, grounding.sources, 'evidence source');
  for (const ref of trigger.completedCheckpoints ?? []) resolveRef(ref, grounding.checkpoints, 'checkpoint');
  for (const ref of trigger.actionsPerformed ?? []) resolveRef(ref, grounding.actions, 'action');
  for (const ref of trigger.artifactKeys ?? []) resolveRef(ref, grounding.artifacts, 'artifact key');
  for (const ref of clue.evidenceRefs) resolveRef(ref, grounding.sources, 'evidence ref');
  for (const ref of clue.specialistKeys) resolveRef(ref, grounding.specialists, 'specialist key');

  const unlockKeys = new Set<string>();
  for (const unlock of clue.unlocks) {
    const unlockLabel = `${label}/unlock:${unlock.key}`;
    check(nonEmpty(unlock.key), `${unlockLabel}: unlock key required`);
    check(!unlockKeys.has(unlock.key), `${unlockLabel}: duplicate unlock key`);
    unlockKeys.add(unlock.key);
    check(UNLOCK_KINDS.includes(unlock.kind), `${unlockLabel}: invalid unlock kind ${unlock.kind}`);
    check(nonEmpty(unlock.targetRef), `${unlockLabel}: targetRef required`);
    const target = String(unlock.targetRef).trim().toLowerCase();
    if (unlock.kind === 'action') {
      check(grounding.actions.has(target), `${unlockLabel}: action unlock does not resolve: ${unlock.targetRef}`);
      check(String(unlock.action).trim().toLowerCase() === target, `${unlockLabel}: action field must match targetRef`);
    } else if (unlock.kind === 'specialist_response') {
      check(grounding.specialists.has(target), `${unlockLabel}: specialist does not resolve: ${unlock.targetRef}`);
      check(String(unlock.specialistKey).trim().toLowerCase() === target, `${unlockLabel}: specialistKey must match targetRef`);
    } else {
      check(
        grounding.sources.has(target) || grounding.artifacts.has(target),
        `${unlockLabel}: targetRef does not resolve: ${unlock.targetRef}`,
      );
    }
  }

  scanPublicStrings(clue, pkg, label);
  validateDtoSafety(clue, pkg, label);
}

async function main(): Promise<void> {
  console.log('M7 Discovery-clue package validator (read-only)\n');
  const packages = getDiscoveryPackages();
  check(packages.length >= 3, `expected at least 3 authored packages, found ${packages.length}`);

  const packageKeys = new Set<string>();
  const subjectKeys = new Set<string>();
  const allClueKeys = new Set<string>();
  const allCategories = new Set<string>();

  for (const pkg of packages) {
    console.log(`  ${pkg.packageKey} (${pkg.caseTitle})`);
    check(!packageKeys.has(pkg.packageKey), `${pkg.packageKey}: duplicate package key`);
    packageKeys.add(pkg.packageKey);
    check(PACK_STATUSES.includes(pkg.status), `${pkg.packageKey}: invalid package status`);
    check(nonEmpty(pkg.version) && nonEmpty(pkg.summary), `${pkg.packageKey}: version/summary required`);
    check(pkg.leakageTerms.length > 0, `${pkg.packageKey}: leakageTerms guard list must not be empty`);
    check(pkg.clues.length >= 2, `${pkg.packageKey}: needs at least 2 authored clues`);

    const caseRes = await pool.query('SELECT id FROM cases WHERE title = $1 LIMIT 1', [pkg.caseTitle]);
    const caseRow = caseRes.rows[0] as { id: string } | undefined;
    if (!caseRow) {
      failures.push(`${pkg.packageKey}: case title does not resolve: ${pkg.caseTitle}`);
      continue;
    }
    const grounding = await loadGrounding(caseRow.id);

    const packageClueKeys = new Set<string>();
    const edges = new Map<string, string[]>();
    for (const clue of pkg.clues) {
      check(!allClueKeys.has(clue.key), `${pkg.packageKey}: duplicate global clue key ${clue.key}`);
      allClueKeys.add(clue.key);
      check(!subjectKeys.has(clue.subjectKey), `${pkg.packageKey}: duplicate subject key ${clue.subjectKey}`);
      subjectKeys.add(clue.subjectKey);
      allCategories.add(clue.referenceCategory);
      edges.set(clue.key, []);
      validateClue(clue, pkg, grounding, packageClueKeys);

      for (const dependency of clue.triggers.acceptedDependencies ?? []) {
        check(packageClueKeys.has(dependency) || pkg.clues.some((entry) => entry.key === dependency),
          `${pkg.packageKey}/${clue.key}: dependency does not resolve: ${dependency}`);
        edges.get(clue.key)?.push(dependency);
      }
    }
    check(!hasCycle(edges), `${pkg.packageKey}: dependency graph contains a cycle`);
  }

  check(allCategories.size >= 3, `expected at least 3 reference categories, found ${allCategories.size}`);
  check(DISCOVERY_CLASSIFICATIONS.length > 0, 'classification union is empty');
  validateStaticSources();
}

main()
  .then(() => {
    if (failures.length > 0) {
      console.error(`\nDISCOVERY CLUES VALIDATE: FAIL (${failures.length})`);
      for (const failure of failures) console.error(`  - ${failure}`);
      process.exitCode = 1;
      return;
    }
    console.log('\nDISCOVERY CLUES VALIDATE: PASS');
  })
  .catch((err: Error) => {
    console.error('DISCOVERY CLUES VALIDATE: FAIL');
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
