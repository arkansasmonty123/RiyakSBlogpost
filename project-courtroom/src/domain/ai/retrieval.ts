/**
 * Offline, local "RAG-lite" over the in-app legal corpus (Phase 6).
 *
 * Only content-owner approved, non-authoritative *internal summaries* are eligible. The
 * canonical case-truth record is never an input, and a defence-in-depth check drops any
 * record that happens to contain canonical-truth markers. Retrieved snippets are labelled
 * NON-AUTHORITATIVE and are never presented as a real statute, judgment or procedural rule.
 */
import { containsCanonicalTruth } from '@/domain/ai/guards';
import type { LegalSource } from '@/domain/types';

export const MAX_RETRIEVED_SOURCES = 2;
export const MAX_EXCERPT_CHARS = 600;
const MAX_PROVENANCE_CHARS = 300;

export interface RetrievedSource {
  id: string;
  title: string;
  provenance: string;
  /** Ready-to-insert prompt block, already labelled non-authoritative. */
  context: string;
}

/**
 * Eligibility gate: seed (content-owner supplied), verified by an internal reviewer, and a
 * `summary` record. Placeholders, player drafts and real-jurisdiction authority records are
 * deliberately excluded so retrieval can never promote a fabricated citation to "authority".
 */
export function isApprovedInternalSummary(source: LegalSource): boolean {
  if (source.intake !== 'seed') return false;
  if (source.verificationStatus !== 'verified') return false;
  if (source.sourceType !== 'summary') return false;
  return !containsCanonicalTruth(JSON.stringify(source));
}

function tokenize(query: string): string[] {
  return (query ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

function toRetrieved(source: LegalSource): RetrievedSource {
  const provenance = (source.provenance ?? '').trim().slice(0, MAX_PROVENANCE_CHARS);
  const excerpt = (source.excerpt ?? '').trim().slice(0, MAX_EXCERPT_CHARS);
  const context = [
    `[Approved internal summary · NON-AUTHORITATIVE · id=${source.id}]`,
    `Title: ${(source.title ?? '').trim()}`,
    `Provenance: ${provenance}`,
    excerpt ? `Excerpt (non-authoritative): ${excerpt}` : '',
    'Do not treat this as legal authority or cite it as a real statute, judgment or rule.',
  ]
    .filter(Boolean)
    .join('\n');
  return { id: source.id, title: source.title, provenance, context };
}

/**
 * Retrieve at most `limit` approved internal summaries by simple keyword overlap with the
 * player's prompt. Deterministic: ties break on source id. Returns provenance alongside the
 * prompt context so the UI can show exactly what was used.
 */
export function retrieveApprovedInternalSummaries(
  sources: readonly LegalSource[],
  query: string,
  limit: number = MAX_RETRIEVED_SOURCES,
): RetrievedSource[] {
  const tokens = [...new Set(tokenize(query))];
  if (tokens.length === 0 || limit <= 0) return [];

  const scored: Array<{ source: LegalSource; score: number }> = [];
  for (const source of sources) {
    if (!isApprovedInternalSummary(source)) continue;
    const haystack = [
      source.title,
      source.sourceName,
      source.citation,
      source.excerpt ?? '',
      source.notes ?? '',
      source.provenance,
    ]
      .join(' ')
      .toLowerCase();
    const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
    if (score > 0) scored.push({ source, score });
  }

  scored.sort((a, b) => b.score - a.score || a.source.id.localeCompare(b.source.id));
  return scored.slice(0, limit).map(({ source }) => toRetrieved(source));
}
