/**
 * M6 safety guards. These are defense-in-depth; authoring validators and
 * DTO allowlists are the primary controls. Never log raw payloads here.
 */

const INTERNAL_TERMS = [
  'canonical_truth', 'hidden_events', 'hidden_interpretation',
  'discovery_conditions', 'release_conditions', 'supported_hypotheses',
  'contradicted_hypotheses', 'source_verified=true',
];

export function containsInternalLeakTerm(value: unknown): string | null {
  const serialized = JSON.stringify(value ?? '').toLowerCase();
  for (const term of INTERNAL_TERMS) {
    if (serialized.includes(term.toLowerCase())) return term;
  }
  return null;
}

export function scanForForbiddenTerms(value: unknown, terms: string[]): string | null {
  const serialized = JSON.stringify(value ?? '').toLowerCase();
  for (const term of terms) {
    const t = String(term ?? '').toLowerCase().trim();
    if (!t) continue;
    if (serialized.includes(t)) return term;
  }
  return null;
}

export function assertNoInternalLeaks(value: unknown, label: string): void {
  const hit = containsInternalLeakTerm(value);
  if (hit) {
    throw new Error(`[M6 SAFETY] ${label} contained internal term: ${hit}`);
  }
}

export function clipText(input: unknown, max: number): string {
  const s = String(input ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}
