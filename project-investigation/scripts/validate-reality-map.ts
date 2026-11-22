/**
 * M4 Reality Map — read-only validator.
 *
 * NEVER mutates the database or the filesystem. Checks:
 *   1. Question-only prompt packs exist for the three showcase cases and use
 *      valid claim-category hints.
 *   2. No canonical/character leakage terms appear in prompts or in tutorial
 *      scaffolding (these strings ship to the client).
 *   3. Tutorial templates are clearly labelled as placeholders.
 *   4. The pure module `src/reality-map.ts` never imports/reads canonical truth
 *      and never stores numeric probabilities.
 *   5. The subjective enum allowlists have the expected shape.
 *
 * Run: npm run reality-map:validate
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  REALITY_MAP_LIMITS,
  isClaimCategory,
  isConfidence,
  isHypothesisStatus,
  isRelationship,
  isLinkShapeValid,
} from '../src/reality-map';
import {
  getReasoningPrompts,
  getTutorialScaffold,
  REALITY_MAP_SHOWCASE_CASE_TITLES,
} from '../src/reality-map-prompts';

const issues: string[] = [];
const notes: string[] = [];

function check(condition: boolean, message: string): void {
  if (!condition) issues.push(message);
}

// Canonical/character terms that must never appear in shipped prompt text.
// Kept deliberately broad: these are the showcase cases' hidden solution terms.
const LEAK_TERMS = [
  'Victor Sterling', 'Sterling Holdings', 'hollow base', 'silver trophy', '20 million',
  'Paul Kent', 'Dr. Paul Kent', 'gambling debts', 'silenced Amy',
  'Victor Ames', 'embezzled from the bakery', 'audit the books',
  'culprit', 'canonical truth', 'hidden evidence', 'hidden_events',
];

function scanText(value: unknown, label: string): void {
  const serialized = JSON.stringify(value ?? '');
  for (const term of LEAK_TERMS) {
    check(!serialized.toLowerCase().includes(term.toLowerCase()), `${label} leaked term: ${term}`);
  }
}

// 1 + 2 + 3: prompt packs and tutorial scaffolding.
check(
  REALITY_MAP_SHOWCASE_CASE_TITLES.length === 3,
  `expected 3 showcase case titles, got ${REALITY_MAP_SHOWCASE_CASE_TITLES.length}`
);
let promptCount = 0;
for (const caseTitle of REALITY_MAP_SHOWCASE_CASE_TITLES) {
  const prompts = getReasoningPrompts(caseTitle);
  check(prompts.length >= 3, `${caseTitle}: expected >=3 prompts, got ${prompts.length}`);
  check(prompts.length <= 6, `${caseTitle}: expected <=6 prompts, got ${prompts.length}`);
  const hintSet = new Set<string>();
  for (const [i, prompt] of prompts.entries()) {
    promptCount += 1;
    check(typeof prompt.text === 'string' && prompt.text.trim().endsWith('?'), `${caseTitle} prompt ${i} is not a question`);
    check(isClaimCategory(prompt.claimCategoryHint), `${caseTitle} prompt ${i} has invalid claimCategoryHint`);
    hintSet.add(prompt.claimCategoryHint);
    scanText(prompt.text, `${caseTitle} prompt ${i}`);
  }
  check(hintSet.size >= 2, `${caseTitle}: prompts should span >=2 claim categories`);

  const scaffold = getTutorialScaffold(caseTitle);
  check(scaffold !== null, `${caseTitle}: tutorial scaffold missing`);
  if (scaffold) {
    check(scaffold.claims.length >= 1 && scaffold.hypotheses.length >= 1, `${caseTitle}: tutorial scaffold too small`);
    for (const [i, c] of scaffold.claims.entries()) {
      check(c.title.startsWith('Tutorial example'), `${caseTitle} tutorial claim ${i} is not labelled`);
      check(isClaimCategory(c.claimCategory), `${caseTitle} tutorial claim ${i} has invalid category`);
      check(c.confidence === 'insufficient_information', `${caseTitle} tutorial claim ${i} is not neutral-confidence`);
      scanText(c, `${caseTitle} tutorial claim ${i}`);
    }
    for (const [i, h] of scaffold.hypotheses.entries()) {
      check(h.name.startsWith('Tutorial example'), `${caseTitle} tutorial hypothesis ${i} is not labelled`);
      check(h.confidence === 'insufficient_information', `${caseTitle} tutorial hypothesis ${i} is not neutral-confidence`);
      check(h.status === 'active', `${caseTitle} tutorial hypothesis ${i} is not active`);
      scanText(h, `${caseTitle} tutorial hypothesis ${i}`);
    }
  }
}

// Prompts/tutorial must be unavailable for other cases.
for (const other of ['Some Other Case', '', 'The Midnight Heist: Special Edition']) {
  check(getReasoningPrompts(other).length === 0, `unexpected prompts for non-showcase case: ${other}`);
  check(getTutorialScaffold(other) === null, `unexpected tutorial for non-showcase case: ${other}`);
}

// 5: enum allowlist shape.
check(REALITY_MAP_LIMITS.claimCategories.length === 7, 'expected 7 claim categories');
check(REALITY_MAP_LIMITS.confidences.length === 4, 'confidence must be a 4-value subjective enum');
check(REALITY_MAP_LIMITS.hypothesisStatuses.length === 4, 'expected 4 hypothesis statuses');
check(REALITY_MAP_LIMITS.relationships.length === 6, 'expected 6 relationships');
check(REALITY_MAP_LIMITS.targetTypes.length === 8, 'expected 8 link target types');
check(REALITY_MAP_LIMITS.materialTargetTypes.length === 6, 'expected 6 material target types');
for (const c of REALITY_MAP_LIMITS.confidences) {
  check(isConfidence(c), `confidence guard rejected ${c}`);
}
for (const s of REALITY_MAP_LIMITS.hypothesisStatuses) {
  check(isHypothesisStatus(s), `status guard rejected ${s}`);
}
for (const r of REALITY_MAP_LIMITS.relationships) {
  check(isRelationship(r), `relationship guard rejected ${r}`);
}
check(isLinkShapeValid('claim', 'evidence', 'supports'), 'claim->evidence supports should be legal');
check(!isLinkShapeValid('claim', 'evidence', 'included'), 'claim->evidence included must be illegal');
check(isLinkShapeValid('hypothesis', 'claim', 'included'), 'hypothesis->claim included should be legal');
check(!isLinkShapeValid('hypothesis', 'claim', 'supports'), 'hypothesis->claim supports must be illegal');
check(isLinkShapeValid('hypothesis', 'evidence', 'contradicts'), 'hypothesis->evidence contradicts should be legal');

// 4: static purity guard on the domain module.
const root = process.cwd();
const modulePath = path.join(root, 'src', 'reality-map.ts');
let source = '';
try {
  source = fs.readFileSync(modulePath, 'utf8');
} catch {
  issues.push('cannot read src/reality-map.ts');
}
// Strip comments before static analysis: prose like "no canonical truth is
// read here" is documentation, not an import or a read.
const codeOnly = source
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
check(!/canonical_truth|getCanonicalTruth/i.test(codeOnly), 'src/reality-map.ts references canonical truth');
check(!/from\s+['"]\.\/db['"]/i.test(codeOnly), 'src/reality-map.ts imports the database module');
check(!/from\s+['"]\.\/server['"]/i.test(codeOnly), 'src/reality-map.ts imports the server module');
check(!/(probability|probabilities)\s*[:=]/i.test(codeOnly), 'src/reality-map.ts declares a numeric probability field');
check(!/confidenceScore|confidence_value/i.test(codeOnly), 'src/reality-map.ts declares a numeric confidence field');
notes.push('src/reality-map.ts contains no canonical_truth/getCanonicalTruth/db/server imports or numeric probability fields');

// Also guard the prompt module (it ships strings to the client).
const promptsPath = path.join(root, 'src', 'reality-map-prompts.ts');
let promptsSource = '';
try {
  promptsSource = fs.readFileSync(promptsPath, 'utf8');
} catch {
  issues.push('cannot read src/reality-map-prompts.ts');
}
check(!/canonical_truth|getCanonicalTruth/i.test(promptsSource), 'prompts module references canonical truth');
check(!/from\s+['"]\.\/db['"]/i.test(promptsSource), 'prompts module imports the database module');

console.log('M4 Reality Map validation (read-only)\n');
console.log(`  prompt packs: ${REALITY_MAP_SHOWCASE_CASE_TITLES.length}, prompts: ${promptCount}`);
for (const note of notes) console.log(`  - ${note}`);
if (issues.length === 0) {
  console.log('\nREALITY MAP VALIDATE: PASS');
} else {
  console.log('\nREALITY MAP VALIDATE: FAIL');
  for (const issue of issues) console.log(`  - ${issue}`);
  process.exitCode = 1;
}
