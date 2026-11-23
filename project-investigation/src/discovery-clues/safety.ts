/**
 * M7 safety guards. Defense in depth: authoring validators, deterministic
 * evaluation and DTO allowlists are the primary controls. Never log raw
 * player submissions or answer criteria here.
 */

import type { DiscoveryCitation } from './types';

const INTERNAL_TERMS = [
  'canonical_truth', 'hidden_events', 'hidden_interpretation',
  'discovery_conditions', 'release_conditions', 'supported_hypotheses',
  'contradicted_hypotheses', 'conceptcriteria', 'concept_criteria',
  'leakageterms', 'leakage_terms', 'subjectaliases', 'subject_aliases',
  'minessentialmatches', 'min_essential_matches', 'misconceptionterms',
  'confidentmarkers', 'acceptancethreshold', 'acceptance_threshold',
];

/** Returns the first forbidden internal term found, or null. */
export function containsInternalLeakTerm(value: unknown): string | null {
  const serialized = JSON.stringify(value ?? '').toLowerCase();
  for (const term of INTERNAL_TERMS) {
    if (serialized.includes(term.toLowerCase())) return term;
  }
  return null;
}

/** Returns the first authored leakage term found in a public string, or null. */
export function scanForForbiddenTerms(value: unknown, terms: readonly string[]): string | null {
  const serialized = JSON.stringify(value ?? '').toLowerCase();
  for (const term of terms) {
    const normalized = String(term ?? '').toLowerCase().trim();
    if (!normalized) continue;
    if (serialized.includes(normalized)) return term;
  }
  return null;
}

export function assertNoInternalLeaks(value: unknown, label: string): void {
  const hit = containsInternalLeakTerm(value);
  if (hit) throw new Error(`[M7 SAFETY] ${label} contained internal term: ${hit}`);
}

/**
 * Source URL policy: a URL is public only for a human-verified source whose
 * verification status is `verified`. Unverified authored content always
 * reports null, even if a URL was accidentally recorded.
 */
export function sourceUrlForCitation(
  citation: Pick<DiscoveryCitation, 'sourceUrl' | 'sourceVerified' | 'verificationStatus'>,
): string | null {
  if (!citation.sourceVerified || citation.verificationStatus !== 'verified') return null;
  const url = String(citation.sourceUrl ?? '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

export function clipText(input: unknown, max: number): string {
  const s = String(input ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}
