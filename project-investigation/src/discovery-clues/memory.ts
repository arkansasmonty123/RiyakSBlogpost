/**
 * M7 pure spaced-retrieval helpers. No DB, no LLM, no canonical truth.
 *
 * Rules: new items start at +2 days; success grows the interval/ease up to a
 * 60-day cap; partial grows slightly; a missed recall resets to 1 day but
 * NEVER downgrades mastery. Mastery advances only through successful recalls
 * in multiple distinct application contexts.
 */

import type {
  MasteryStatus, MemoryRecallInput, MemoryScheduleDecision, RecallKind,
} from './types';

export const MEMORY_SCHEDULING = {
  initialIntervalDays: 2,
  missedIntervalDays: 1,
  maxIntervalDays: 60,
  successMultiplier: 2,
  partialMultiplier: 1.25,
  proficientSuccesses: 3,
  proficientContexts: 2,
  masteredSuccesses: 6,
  masteredContexts: 3,
  masteredMaxFailures: 2,
} as const;

function isoAfterDays(now: Date, days: number): string {
  const safeDays = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0;
  return new Date(now.getTime() + safeDays * 86_400_000).toISOString();
}

function nextMastery(
  status: MasteryStatus,
  successfulRecalls: number,
  distinctContexts: number,
  failedRecalls: number,
): MasteryStatus {
  if (status === 'mastered') return 'mastered';
  if (status === 'new') return successfulRecalls >= 1 ? 'developing' : 'new';
  if (status === 'developing') {
    return successfulRecalls >= MEMORY_SCHEDULING.proficientSuccesses &&
      distinctContexts >= MEMORY_SCHEDULING.proficientContexts
      ? 'proficient'
      : 'developing';
  }
  return successfulRecalls >= MEMORY_SCHEDULING.masteredSuccesses &&
    distinctContexts >= MEMORY_SCHEDULING.masteredContexts &&
    failedRecalls <= MEMORY_SCHEDULING.masteredMaxFailures
    ? 'mastered'
    : 'proficient';
}

/** Initial schedule for an item created from an accepted discovery. */
export function initialSchedule(now: Date): MemoryScheduleDecision {
  return {
    intervalDays: MEMORY_SCHEDULING.initialIntervalDays,
    nextDueAt: isoAfterDays(now, MEMORY_SCHEDULING.initialIntervalDays),
    masteryStatus: 'new',
  };
}

/**
 * Compute the next due date and mastery status after a recall outcome.
 * Counts passed in are POST-event totals (successfulRecalls/failedRecalls).
 */
export function applyRecallOutcome(
  input: MemoryRecallInput,
  outcome: 'success' | 'partial' | 'missed',
  now: Date,
): MemoryScheduleDecision {
  const current = Number.isFinite(input.intervalDays) ? Math.max(0, input.intervalDays) : 0;
  let intervalDays: number;
  if (outcome === 'missed') {
    intervalDays = MEMORY_SCHEDULING.missedIntervalDays;
  } else if (outcome === 'partial') {
    intervalDays = Math.min(
      MEMORY_SCHEDULING.maxIntervalDays,
      Math.max(MEMORY_SCHEDULING.initialIntervalDays, Math.ceil(current * MEMORY_SCHEDULING.partialMultiplier)),
    );
  } else {
    intervalDays = Math.min(
      MEMORY_SCHEDULING.maxIntervalDays,
      Math.max(MEMORY_SCHEDULING.initialIntervalDays, Math.ceil(current * MEMORY_SCHEDULING.successMultiplier)),
    );
  }

  return {
    intervalDays,
    nextDueAt: isoAfterDays(now, intervalDays),
    masteryStatus: nextMastery(
      input.masteryStatus,
      Math.max(0, input.successfulRecalls),
      Math.max(0, input.distinctContexts),
      Math.max(0, input.failedRecalls),
    ),
  };
}

/** True when a due date has arrived (or no schedule has been set). */
export function isDue(nextDueAt: string | Date | null | undefined, now: Date): boolean {
  if (!nextDueAt) return true;
  const time = new Date(nextDueAt).getTime();
  return !Number.isFinite(time) || time <= now.getTime();
}

/** Deterministic recall kind based on whether this is a new case/clue context. */
export function recallKindForContext(context: {
  isInitial: boolean;
  sameCase: boolean;
  sameClue: boolean;
}): RecallKind {
  if (context.isInitial) return 'initial_check';
  if (!context.sameCase) return 'cross_case_application';
  if (!context.sameClue) return 'delayed_recall';
  return 'reinforcement';
}
