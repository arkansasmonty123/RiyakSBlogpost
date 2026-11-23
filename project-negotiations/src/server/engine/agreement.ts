import type { CaseDefinition, NegotiationSession, Offer } from '../../shared/types.js';
import { termLabel } from './utils.js';

export interface AgreementValidation {
  valid: boolean;
  reason: string;
  offerId: string | null;
  missingParties: string[];
  missingIssues: string[];
  violations: string[];
}

const EMPTY = (offerId: string | null): AgreementValidation => ({
  valid: false,
  reason: '',
  offerId,
  missingParties: [],
  missingIssues: [],
  violations: [],
});

function playerAccepts(value: number, reservation: number, direction: 'maximize' | 'minimize'): boolean {
  return direction === 'maximize' ? value >= reservation : value <= reservation;
}

function opposingAccepts(value: number, reservation: number, direction: 'maximize' | 'minimize'): boolean {
  return direction === 'maximize' ? value <= reservation : value >= reservation;
}

/**
 * The engine is the sole authority on agreement. Intent text such as "I accept"
 * never creates a binding agreement by itself: every required party must have
 * explicitly accepted a specific offer, every required issue must be covered,
 * and every term must sit inside the case's numeric constraints and ZOPA.
 */
export function validateAgreement(
  state: NegotiationSession,
  caseDef: CaseDefinition,
  offerId?: string,
): AgreementValidation {
  const offer: Offer | undefined = offerId
    ? state.offers.find((o) => o.id === offerId)
    : state.agreementOfferId
      ? state.offers.find((o) => o.id === state.agreementOfferId)
      : [...state.offers].reverse().find((o) => o.status === 'accepted' || o.status === 'proposed');

  if (!offer) {
    const result = EMPTY(offerId ?? null);
    result.reason = 'No offer is available to validate.';
    return result;
  }

  const result = EMPTY(offer.id);
  const acceptances = new Set(offer.acceptances ?? []);

  const covered = new Set(offer.terms.map((t) => t.issueId));
  for (const issue of caseDef.issues) {
    if (issue.required && !covered.has(issue.id)) result.missingIssues.push(issue.id);
  }
  result.missingIssues.forEach((id) => {
    result.violations.push(`Required issue not covered: ${caseDef.issues.find((i) => i.id === id)?.label ?? id}.`);
  });

  for (const term of offer.terms) {
    const issue = caseDef.issues.find((i) => i.id === term.issueId);
    if (!issue) {
      result.violations.push(`Unknown issue in offer: ${term.issueId}.`);
      continue;
    }
    if (term.value < issue.minValue || term.value > issue.maxValue) {
      result.violations.push(`${issue.label} is outside the allowed range.`);
    }
    if (!playerAccepts(term.value, issue.playerReservation, issue.direction)) {
      result.violations.push(`${issue.label} (${term.value}${issue.unit}) is outside your reservation point.`);
    }
    if (!opposingAccepts(term.value, issue.opposingReservation, issue.direction)) {
      result.violations.push(`${issue.label} (${term.value}${issue.unit}) is outside the opposing side's reservation point.`);
    }
  }

  for (const p of caseDef.participants) {
    const priv = caseDef.participantPrivate[p.id];
    if (!priv?.requiredForAgreement) continue;
    const limits = priv.issueLimits ?? {};
    for (const term of offer.terms) {
      const limit = limits[term.issueId];
      if (!limit) continue;
      if (limit.min !== undefined && term.value < limit.min) {
        result.violations.push(`${p.name} cannot accept ${termLabel(caseDef, term)}.`);
      }
      if (limit.max !== undefined && term.value > limit.max) {
        result.violations.push(`${p.name} cannot accept ${termLabel(caseDef, term)}.`);
      }
    }
  }

  if (!acceptances.has('player')) result.missingParties.push('player');
  for (const p of caseDef.participants) {
    if (caseDef.participantPrivate[p.id]?.requiredForAgreement && !acceptances.has(p.id)) {
      result.missingParties.push(p.name);
    }
  }
  if (result.missingParties.length > 0) {
    result.violations.push(`Acceptance missing from: ${result.missingParties.join(', ')}.`);
  }

  result.valid = result.violations.length === 0;
  result.reason = result.valid
    ? 'All required parties accepted; all terms cover required issues and sit within constraints.'
    : result.violations.join(' ');
  return result;
}

export function isOpenOffer(offer: Offer): boolean {
  return offer.status === 'proposed' || offer.status === 'countered';
}

export function latestOpenOffer(state: NegotiationSession): Offer | undefined {
  return [...state.offers].reverse().find(isOpenOffer);
}
