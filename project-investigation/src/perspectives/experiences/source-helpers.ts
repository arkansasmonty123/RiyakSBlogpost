// M5-CONTENT: conservative provenance helper for authored experiences.
// ---------------------------------------------------------------------------
// Every real-world reference in this registry is bibliographic only unless
// explicitly verified. Pending/unverified sources must not expose URLs. A
// human reviewer may promote a source to `verified` with a real, stable URL;
// only then does the DTO expose it.

import type { SourceType, VerificationStatus } from '../../knowledge';
import type { PerspectiveSource } from '../types';

const DEFAULT_NOTE =
  'Bibliographic reference authored from general knowledge for educational use. Exact edition, page and URL not independently verified; pending_review.';

export interface BibliographicSourceInput {
  label: string;
  author?: string | undefined;
  title?: string | undefined;
  sourceType?: SourceType | undefined;
  verificationStatus?: VerificationStatus | undefined;
  sourceVerified?: boolean | undefined;
  url?: string | null | undefined;
  verificationNotes?: string | undefined;
  quote?: string | undefined;
}

/** Build a conservative source record. Defaults to pending_review with no URL. */
export function bibliographicSource(input: BibliographicSourceInput): PerspectiveSource {
  const verificationStatus = input.verificationStatus ?? 'pending_review';
  const sourceVerified = input.sourceVerified ?? false;
  // Safety: only verified+sourceVerified sources may carry a URL.
  const safeUrl =
    sourceVerified && verificationStatus === 'verified' && typeof input.url === 'string' && /^https?:\/\//i.test(input.url)
      ? input.url
      : null;
  return {
    label: input.label,
    author: input.author,
    title: input.title,
    sourceType: input.sourceType ?? 'other',
    verificationStatus,
    sourceVerified: sourceVerified && verificationStatus === 'verified',
    url: safeUrl,
    verificationNotes: input.verificationNotes ?? DEFAULT_NOTE,
    quote: input.quote ?? '',
  };
}
