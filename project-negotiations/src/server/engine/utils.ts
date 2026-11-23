import { randomUUID } from 'node:crypto';
import type { CaseDefinition, OfferTerm, ResponseIntent } from '../../shared/types.js';
import { EngineError } from './errors.js';

export interface EngineDeps {
  now?: () => string;
  id?: () => string;
}

export interface ResolvedDeps {
  now: () => string;
  id: () => string;
}

export function resolveDeps(deps?: EngineDeps): ResolvedDeps {
  return {
    now: deps?.now ?? (() => new Date().toISOString()),
    id: deps?.id ?? (() => randomUUID()),
  };
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Validate and normalize structured offer terms. The engine never infers
 * numeric terms from free text - that would let a phrasing accident become
 * a binding agreement.
 */
export function validateTerms(caseDef: CaseDefinition, raw: unknown): OfferTerm[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new EngineError('An offer requires at least one term.');
  }
  const seen = new Set<string>();
  const terms: OfferTerm[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') throw new EngineError('Malformed offer term.');
    const { issueId, value } = item as Record<string, unknown>;
    if (typeof issueId !== 'string' || !issueId) throw new EngineError('Each offer term needs an issueId.');
    const issue = caseDef.issues.find((i) => i.id === issueId);
    if (!issue) throw new EngineError(`Unknown issue "${issueId}" for this case.`);
    if (seen.has(issueId)) throw new EngineError(`Duplicate term for issue "${issueId}".`);
    seen.add(issueId);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new EngineError(`Term "${issue.id}" must be a finite number.`);
    }
    if (value < issue.minValue || value > issue.maxValue) {
      throw new EngineError(
        `Term "${issue.id}" must be between ${issue.minValue} and ${issue.maxValue} ${issue.unit}.`,
      );
    }
    terms.push({ issueId, value });
  }
  return terms;
}

/** Deterministic intent heuristic. Only used when no explicit structured intent is supplied. */
export function detectIntent(text: string): ResponseIntent {
  const t = text.toLowerCase().trim();
  if (!t) return 'message';
  if (/\b(?:walk away|walk out|no deal|we.re done|stop here|i.m out)\b/.test(t)) return 'walk_away';
  if (/\b(?:i accept|we accept|accepted|agreed|that works|deal[.!]?$|i.ll take it)\b/.test(t)) return 'accept';
  if (/\b(?:counter|instead|how about|alternative|i.d propose|revised offer|my offer is)\b/.test(t)) return 'counteroffer';
  if (/\b(?:offer|propose|i can offer|we can do)\b/.test(t)) return 'offer';
  if (/\b(?:reject|can.t accept|no thanks|not acceptable|decline)\b/.test(t)) return 'reject';
  if (/\b(?:prove|evidence|source|bluff|claim|how do you know|really\?|back that up)\b/.test(t)) return 'challenge';
  if (t.endsWith('?') || /^(who|what|why|how|when|where|can you|could you|do you|is it|are you|will you)\b/.test(t)) {
    return 'question';
  }
  return 'message';
}

export function detectConcessions(
  caseDef: CaseDefinition,
  previous: OfferTerm[],
  next: OfferTerm[],
): OfferTerm[] {
  const concessions: OfferTerm[] = [];
  for (const term of next) {
    const before = previous.find((p) => p.issueId === term.issueId);
    if (!before) continue;
    const issue = caseDef.issues.find((i) => i.id === term.issueId);
    if (!issue) continue;
    const movedTowardOpponent =
      issue.direction === 'maximize' ? term.value < before.value : term.value > before.value;
    if (movedTowardOpponent) concessions.push({ issueId: term.issueId, value: term.value });
  }
  return concessions;
}

export function termLabel(caseDef: CaseDefinition, term: OfferTerm): string {
  const issue = caseDef.issues.find((i) => i.id === term.issueId);
  return issue ? `${issue.label} ${term.value}${issue.unit}` : `${term.issueId} ${term.value}`;
}
