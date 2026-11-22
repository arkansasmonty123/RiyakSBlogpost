// === INVESTIGATION PROGRESS MATH (GAP-12) ===
//
// Single source of truth for turning "how much evidence has been discovered"
// into the `progress` percentage persisted on an investigation. It is shared
// by db.ts (the player discover action) and mystery-engine.ts (the progression
// engine) so the formula cannot drift between the two write paths.
//
// Pure and dependency-free, so it is safe to call before any data has loaded
// and trivial to unit test.

/**
 * Compute investigation progress (0-100) from the number of discovered
 * evidence items and the total number of evidence items authored for the case.
 *
 * - A missing/zero/non-finite `totalEvidence` yields 0, so an empty or
 *   unknown case never produces NaN/Infinity or a misleading non-zero value.
 * - The result is rounded to the nearest integer and clamped to [0, 100],
 *   keeping progress monotonic and sane even if a discovered id no longer
 *   belongs to the case.
 */
export function computeEvidenceProgress(
  discoveredCount: number,
  totalEvidence: number
): number {
  if (!Number.isFinite(totalEvidence) || totalEvidence <= 0) return 0;
  if (!Number.isFinite(discoveredCount) || discoveredCount <= 0) return 0;

  const percentage = Math.round((discoveredCount / totalEvidence) * 100);
  if (!Number.isFinite(percentage)) return 0;
  return Math.min(100, Math.max(0, percentage));
}
