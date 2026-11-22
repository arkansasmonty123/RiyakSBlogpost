import { canCiteAsAuthoritative } from './legalSources';
import type { LegalSource } from './types';

export interface CitationCheckResult {
  ok: boolean;
  warnings: string[];
  blocked: string[];
}

const CITATION_PATTERNS = [
  /\bsection\s+\d+[a-z]?\b/i,
  /\barticle\s+\d+[a-z]?\b/i,
  /\b[A-Z][A-Za-z. ]+ v\.? [A-Z][A-Za-z. ]+\b/,
  /\bAIR\s+\d{4}\b/i,
  /\b\d{4}\s+SCC\b/i,
  /\bBNS\b/i,
  /\bBNSS\b/i,
  /\bBSA\b/i,
  /\bIPC\b/i,
  /\bCrPC\b/i,
  /\bEvidence Act\b/i,
];

export function checkDraftCitations(draft: string, sources: LegalSource[]): CitationCheckResult {
  const warnings: string[] = [];
  const blocked: string[] = [];
  const text = draft || '';

  const hasCitationLike = CITATION_PATTERNS.some((p) => p.test(text));
  if (!hasCitationLike) return { ok: true, warnings, blocked };

  // Status alone is not enough: a `verified` flag without traceable provenance, or a
  // placeholder that was forged into `verified`, must not count as authority.
  const verified = sources.filter(canCiteAsAuthoritative);
  const notAuthoritative = sources.filter((s) => !canCiteAsAuthoritative(s));

  if (verified.length === 0) {
    blocked.push('Citation-like legal references detected, but no verified sources are registered. Add/verify sources before citing.');
  }

  for (const s of notAuthoritative) {
    const token = s.citation.split('(')[0].trim();
    if (token && text.toLowerCase().includes(token.toLowerCase())) {
      blocked.push(`Unverified/placeholder source referenced: "${s.title}". Verify before citing.`);
    }
  }

  // Block specific-looking section/article citations unless the exact citation appears in a verified source.
  const sectionMatches = text.match(/\b(section\s+\d+[a-z]?|article\s+\d+[a-z]?)\b/gi) || [];
  for (const m of sectionMatches) {
    const allowed = verified.some((s) => s.citation.toLowerCase().includes(m.toLowerCase()));
    if (!allowed) blocked.push(`Specific citation "${m}" is not in verified source registry. Do not fabricate or cite unverified provisions.`);
  }

  const caseMatches = text.match(/\b[A-Z][A-Za-z. ]+ v\.? [A-Z][A-Za-z. ]+\b/g) || [];
  for (const m of caseMatches) {
    const allowed = verified.some((s) => s.citation.toLowerCase().includes(m.toLowerCase()));
    if (!allowed) blocked.push(`Case citation "${m}" is not in verified source registry. Do not fabricate judgments.`);
  }

  if (/BNS|BNSS|BSA|IPC|CrPC|Evidence Act/i.test(text) && verified.filter((s) => s.sourceType === 'statute').length === 0) {
    warnings.push('Statute name detected. Use only verified provision citations with provenance/effective date.');
  }

  const uniqueBlocked = [...new Set(blocked)];
  const uniqueWarnings = [...new Set(warnings)];
  return { ok: uniqueBlocked.length === 0, warnings: uniqueWarnings, blocked: uniqueBlocked };
}
