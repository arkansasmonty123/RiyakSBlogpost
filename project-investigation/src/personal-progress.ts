/**
 * M8-6: personal progress / long-term engagement summary.
 *
 * This service aggregates ONLY data the signed-in player already owns, using
 * existing read-only DB helpers. It is intentionally cheap and deterministic:
 * a handful of COUNT/GROUP BY queries plus the already-safe knowledge journal
 * items. No XP, levels, streaks, leaderboards or new gimmick tables - the
 * milestones below are derived from real investigation/discovery/recall
 * activity. No canonical truth, hidden evidence or internal evaluation data is
 * ever read or returned, and every field is built through an explicit
 * allowlist so a future schema change cannot leak a private column.
 */

import {
  getAchievementTypeCounts,
  getDiscoveryProgressCounts,
  getInvestigationStatusCounts,
  getPlayedCaseIds,
  getRecentProgressActivity,
  getUnplayedCaseSuggestions,
  listKnowledgeMemoryItems,
} from './db';
import { isDue } from './discovery-clues/memory';

export const PROGRESS_DISCLAIMER =
  'This is a private summary of your own investigative activity. It is not a ' +
  'measure of intelligence or skill, and it does not reveal any hidden case truth.';

export interface ProgressMilestone {
  key: string;
  label: string;
  description: string;
  achieved: boolean;
}

export interface ProgressSuggestion {
  caseId: string;
  title: string;
  genre: string | null;
  difficulty: string | null;
  duration: string | null;
  reason: string;
}

export interface ProgressDTO {
  generatedAt: string;
  disclaimer: string;
  investigations: {
    completed: number;
    abandoned: number;
    active: number;
    paused: number;
    total: number;
    distinctCasesPlayed: number;
  };
  knowledge: {
    discoveriesAccepted: number;
    memoryItems: number;
    mastery: { new: number; developing: number; proficient: number; mastered: number };
    dueRecall: number;
    crossCaseApplications: number;
    successfulRecalls: number;
  };
  openThreads: {
    unresolvedQuestions: number;
    followUpApplications: number;
    samples: string[];
  };
  milestones: ProgressMilestone[];
  recentActivity: {
    windowDays: number;
    newMemoryItems: number;
    completedCases: number;
    acceptedDiscoveries: number;
    newNotifications: number;
  };
  suggestions: ProgressSuggestion[];
}

function countByStatus(rows: Array<{ status: string; count: number }>, ...statuses: string[]): number {
  const wanted = new Set(statuses);
  return rows
    .filter((row) => wanted.has(row.status))
    .reduce((sum, row) => sum + row.count, 0);
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Build the player-safe progress DTO for one authenticated user.
 * `userId` must come from the session (never the request body).
 */
export async function buildProgressDTO(userId: string): Promise<ProgressDTO> {
  const now = new Date();

  const [statusRows, achievementRows, discovery, memoryItems, recent, playedCaseIds] = await Promise.all([
    getInvestigationStatusCounts(userId),
    getAchievementTypeCounts(userId),
    getDiscoveryProgressCounts(userId),
    listKnowledgeMemoryItems(userId),
    getRecentProgressActivity(userId),
    getPlayedCaseIds(userId),
  ]);

  const achievementCount = (type: string): number =>
    achievementRows.find((row) => row.type === type)?.count ?? 0;

  // Mastery distribution + due recalls, derived from the already-safe journal
  // projection (no new SQL, no canonical fields).
  const mastery: ProgressDTO['knowledge']['mastery'] = {
    new: 0,
    developing: 0,
    proficient: 0,
    mastered: 0,
  };
  let dueRecall = 0;
  let successfulRecalls = 0;
  let unresolvedQuestions = 0;
  let followUpApplications = 0;
  const openSamples: string[] = [];
  for (const item of memoryItems) {
    if (item.masteryStatus === 'new' || item.masteryStatus === 'developing' ||
        item.masteryStatus === 'proficient' || item.masteryStatus === 'mastered') {
      mastery[item.masteryStatus] += 1;
    }
    if (isDue(item.nextDueAt, now)) dueRecall += 1;
    successfulRecalls += Math.max(0, Number(item.successfulRecalls) || 0);

    const questions = Array.isArray(item.unresolvedQuestions) ? item.unresolvedQuestions : [];
    const followUps = Array.isArray(item.followUpApplications) ? item.followUpApplications : [];
    unresolvedQuestions += questions.length;
    followUpApplications += followUps.length;
    if (openSamples.length < 3) {
      for (const question of questions) {
        const text = clip(question, 140);
        if (text) openSamples.push(text);
        if (openSamples.length >= 3) break;
      }
    }
  }

  const completed = countByStatus(statusRows, 'completed');
  const abandoned = countByStatus(statusRows, 'abandoned');
  const active = countByStatus(statusRows, 'active');
  const other = statusRows
    .filter((row) => !['completed', 'abandoned', 'active'].includes(row.status))
    .reduce((sum, row) => sum + row.count, 0);
  const total = statusRows.reduce((sum, row) => sum + row.count, 0);

  // True global distinct count (the per-status `cases` values could overlap
  // when the same case was played more than once).
  const distinctCasesPlayed = playedCaseIds.length;

  // Suggestions are a deterministic, spoiler-free rule: unplayed published
  // cases, alphabetically, projected to library-safe fields only.
  const rawSuggestions = playedCaseIds.length > 0
    ? await getUnplayedCaseSuggestions(playedCaseIds, 3)
    : await getUnplayedCaseSuggestions([], 3);
  const suggestions: ProgressSuggestion[] = rawSuggestions.map((candidate) => ({
    caseId: candidate.id,
    title: candidate.title,
    genre: candidate.genre,
    difficulty: candidate.difficulty,
    duration: candidate.duration,
    reason: 'An unplayed case in the library',
  }));

  const milestones: ProgressMilestone[] = [
    {
      key: 'first_case_completed',
      label: 'First case closed',
      description: 'Complete an investigation and record a verdict.',
      achieved: completed >= 1,
    },
    {
      key: 'first_discovery_accepted',
      label: 'First discovery accepted',
      description: 'Have a research explanation accepted as a grounded discovery.',
      achieved: discovery.acceptedClues >= 1,
    },
    {
      key: 'cross_case_knowledge',
      label: 'Knowledge applied across cases',
      description: 'Reuse a retained idea in a different case from where it began.',
      achieved: discovery.crossCaseApplications >= 1,
    },
    {
      key: 'evidence_examiner',
      label: 'Evidence examiner',
      description: 'Examine evidence during an investigation.',
      achieved: achievementCount('first_evidence') >= 1,
    },
    {
      key: 'case_solved',
      label: 'Reasoned to a solution',
      description: 'Earn the server-awarded solution achievement.',
      achieved: achievementCount('case_solved') >= 1,
    },
    {
      key: 'recall_practice',
      label: 'Recall practiced',
      description: 'Revisit a retained idea through a recall prompt.',
      achieved: successfulRecalls >= 1,
    },
    {
      key: 'subject_mastered',
      label: 'Subject mastered',
      description: 'Bring a knowledge subject to the mastered stage.',
      achieved: mastery.mastered >= 1,
    },
  ];

  return {
    generatedAt: now.toISOString(),
    disclaimer: PROGRESS_DISCLAIMER,
    investigations: {
      completed,
      abandoned,
      active,
      paused: other,
      total,
      distinctCasesPlayed,
    },
    knowledge: {
      discoveriesAccepted: discovery.acceptedClues,
      memoryItems: memoryItems.length,
      mastery,
      dueRecall,
      crossCaseApplications: discovery.crossCaseApplications,
      successfulRecalls,
    },
    openThreads: {
      unresolvedQuestions,
      followUpApplications,
      samples: openSamples,
    },
    milestones,
    recentActivity: {
      windowDays: 7,
      ...recent,
    },
    suggestions,
  };
}
