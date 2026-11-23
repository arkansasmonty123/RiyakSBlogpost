// M5: pure discovery/lookup helpers over the authored registries.
// ---------------------------------------------------------------------------
// No database, no server, no canonical truth. All functions are deterministic
// and return new arrays; they never mutate their inputs or module state.

import { FRAMEWORKS, getFrameworkByKey } from './frameworks';
import { PERSPECTIVE_EXPERIENCES, getExperienceDefinitionByKey } from './experiences/index';
import { PERSPECTIVE_LIMITS, type ExperienceDefinition, type ExperienceStatus, type FrameworkDefinition } from './types';

export interface ExperienceFilters {
  frameworkKey?: string | undefined;
  format?: ExperienceDefinition['format'] | undefined;
  difficulty?: ExperienceDefinition['difficulty'] | undefined;
  perspectiveClass?: ExperienceDefinition['perspectiveClass'] | undefined;
  recommendationTag?: string | undefined;
  relatedCaseTitle?: string | undefined;
  status?: ExperienceStatus | undefined;
  limit?: number | undefined;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return PERSPECTIVE_LIMITS.maxSuggestions * 4;
  return Math.max(0, Math.min(Math.trunc(limit), PERSPECTIVE_LIMITS.maxSuggestions * 4));
}

/** Published frameworks in display order. */
export function listFrameworks(status?: ExperienceStatus): FrameworkDefinition[] {
  return FRAMEWORKS
    .filter((f) => (status === undefined ? f.status === 'published' : f.status === status))
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder || a.frameworkKey.localeCompare(b.frameworkKey));
}

export function findFramework(key: string): FrameworkDefinition | undefined {
  return getFrameworkByKey(key);
}

export function listExperiences(filters: ExperienceFilters = {}): ExperienceDefinition[] {
  const wantedStatus = filters.status ?? 'published';
  const tag = filters.recommendationTag?.toLowerCase();
  const caseTitle = filters.relatedCaseTitle?.toLowerCase();

  const matched = PERSPECTIVE_EXPERIENCES.filter((e) => {
    if (e.status !== wantedStatus) return false;
    if (filters.frameworkKey !== undefined && e.frameworkKey !== filters.frameworkKey) return false;
    if (filters.format !== undefined && e.format !== filters.format) return false;
    if (filters.difficulty !== undefined && e.difficulty !== filters.difficulty) return false;
    if (filters.perspectiveClass !== undefined && e.perspectiveClass !== filters.perspectiveClass) return false;
    if (tag !== undefined && !e.recommendationTags.some((t) => t.toLowerCase() === tag)) return false;
    if (caseTitle !== undefined && !e.relatedCaseTitles.some((t) => t.toLowerCase().includes(caseTitle))) return false;
    return true;
  });

  return matched
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder || a.experienceKey.localeCompare(b.experienceKey))
    .slice(0, clampLimit(filters.limit));
}

export function findExperience(key: string): ExperienceDefinition | undefined {
  return getExperienceDefinitionByKey(key);
}

export function experiencesForFramework(frameworkKey: string): ExperienceDefinition[] {
  return listExperiences({ frameworkKey });
}

/** Distinct recommendation tags in authored order (bounded, deterministic). */
export function listRecommendationTags(): string[] {
  const seen = new Set<string>();
  for (const experience of PERSPECTIVE_EXPERIENCES) {
    for (const tag of experience.recommendationTags) seen.add(tag);
  }
  return [...seen].sort();
}

/** Curated category labels drawn from the authored recommendation tags.
 *  This is a browsable library, not a short-form feed: no ranking, timing or
 *  state is involved and nothing is inferred about a player's case. */
export function listPerspectiveCategories(): string[] {
  return listRecommendationTags();
}

/**
 * Curated opening questions for the Perspectives tab. Derived from the
 * authored framework core questions, so they remain advisory prompts rather
 * than conclusions. `frameworkKey` restricts the result to one lens.
 */
export function curatedOpeningQuestions(frameworkKey?: string): Array<{
  frameworkKey: string;
  frameworkName: string;
  questions: string[];
}> {
  const frameworks = frameworkKey
    ? FRAMEWORKS.filter((f) => f.frameworkKey === frameworkKey && f.status === 'published')
    : listFrameworks();
  return frameworks.map((framework) => ({
    frameworkKey: framework.frameworkKey,
    frameworkName: framework.name,
    questions: framework.coreQuestions.slice(0, 3),
  }));
}
