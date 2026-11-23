/**
 * M7 pure eligibility engine. Given a read-only snapshot of player-visible
 * state, decide which authored clues may be surfaced. No DB access, no
 * canonical truth, no hidden evidence, no randomness.
 */

import type { DiscoveryClue, VisibleDiscoveryState } from './types';

export function normalizeRef(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizedSet(values: readonly string[] | undefined): Set<string> {
  const set = new Set<string>();
  for (const value of values ?? []) {
    const ref = normalizeRef(value);
    if (ref) set.add(ref);
  }
  return set;
}

export interface TriggerReport {
  eligible: boolean;
  missingEvidence: string[];
  missingCheckpoints: string[];
  missingActions: string[];
  missingArtifacts: string[];
  unmetDependencies: string[];
  discoveredCountShortfall: number;
}

/** Detailed, deterministic evaluation of one clue's surfacing conditions. */
export function checkClueEligibility(
  clue: DiscoveryClue,
  state: VisibleDiscoveryState,
): TriggerReport {
  const visible = normalizedSet(state.visibleEvidenceSources);
  const checkpoints = normalizedSet(state.completedCheckpoints);
  const actions = normalizedSet(state.actionsPerformed);
  const artifacts = normalizedSet(state.artifactKeys);
  const accepted = normalizedSet(state.acceptedClueKeys);

  const missingEvidence = (clue.triggers.visibleEvidence ?? [])
    .map(normalizeRef)
    .filter((ref) => ref && !visible.has(ref));
  const missingCheckpoints = (clue.triggers.completedCheckpoints ?? [])
    .map(normalizeRef)
    .filter((ref) => ref && !checkpoints.has(ref));
  const missingActions = (clue.triggers.actionsPerformed ?? [])
    .map(normalizeRef)
    .filter((ref) => ref && !actions.has(ref));
  const missingArtifacts = (clue.triggers.artifactKeys ?? [])
    .map(normalizeRef)
    .filter((ref) => ref && !artifacts.has(ref));
  const unmetDependencies = (clue.triggers.acceptedDependencies ?? [])
    .map(normalizeRef)
    .filter((ref) => ref && !accepted.has(ref));
  const requiredCount = clue.triggers.minDiscoveredEvidence ?? 0;
  const discoveredCountShortfall = Math.max(0, requiredCount - Math.max(0, state.discoveredEvidenceCount));

  const eligible =
    missingEvidence.length === 0 &&
    missingCheckpoints.length === 0 &&
    missingActions.length === 0 &&
    missingArtifacts.length === 0 &&
    unmetDependencies.length === 0 &&
    discoveredCountShortfall === 0;

  return {
    eligible,
    missingEvidence,
    missingCheckpoints,
    missingActions,
    missingArtifacts,
    unmetDependencies,
    discoveredCountShortfall,
  };
}

/** True when every visible-state trigger is satisfied. */
export function isClueEligible(clue: DiscoveryClue, state: VisibleDiscoveryState): boolean {
  return checkClueEligibility(clue, state).eligible;
}

/**
 * Eligible clues that have not been surfaced yet, in stable authored order.
 * `limit` is a bounded safety parameter for the caller (default 2).
 */
export function nextSurfacedClues(
  clues: readonly DiscoveryClue[],
  state: VisibleDiscoveryState,
  limit = 2,
): DiscoveryClue[] {
  const surfaced = normalizedSet(state.surfacedClueKeys);
  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 2;
  return clues
    .filter((clue) => !surfaced.has(normalizeRef(clue.key)))
    .filter((clue) => isClueEligible(clue, state))
    .slice(0, max);
}

/** Stable difficulty ordering so surfacing does not depend on array order. */
export function orderByDifficulty(clues: readonly DiscoveryClue[]): DiscoveryClue[] {
  const rank: Record<string, number> = { foundational: 0, intermediate: 1, advanced: 2 };
  return [...clues].sort((a, b) => {
    const byRank = (rank[a.difficulty] ?? 9) - (rank[b.difficulty] ?? 9);
    return byRank !== 0 ? byRank : a.key.localeCompare(b.key);
  });
}
