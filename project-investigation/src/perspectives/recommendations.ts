// M5: pure, advisory perspective-experience recommendations.
// ---------------------------------------------------------------------------
// SAFETY / NON-MUTATION CONTRACT:
//   * No import from db.ts, server.ts or anything that reads canonical truth.
//   * Does not read or write any mutable module state.
//   * Does not mutate its arguments (all filters use non-mutating methods).
//   * Produces ADVISORY suggestions only: reasons talk about lenses and
//     questions to consider, never about which theory or culprit is correct.
//   * A deterministic state_fingerprint is derived from the context and reason
//     codes so the API can track dismissed/opened/saved without storing state
//     here.

import {
  fingerprint,
  PERSPECTIVE_LIMITS,
  type ExperienceDefinition,
  type ExperienceRecommendation,
  type RecommendationContext,
  type SuggestionReasonCode,
} from './types';
import { getFrameworkByKey } from './frameworks';
import { PERSPECTIVE_EXPERIENCES } from './experiences/index';
import { frameworkKeysForContext, reasonCodesForContext } from './case-bridges';

// Advisory basis text only. Every string describes a lens or a question to
// consider; none asserts a conclusion, a finding, or a judgement about a case.
const REASON_TEXT: Record<SuggestionReasonCode, string> = {
  framework_primer: 'A short introduction to a reasoning lens — a way of thinking, not a conclusion.',
  matches_case_genre: 'A lens that pairs naturally with this kind of situation; offered as an angle to consider.',
  matches_discovered_evidence: 'Connects to material you have already seen; offered for reflection, not as a finding.',
  challenges_active_hypothesis: 'Offers questions that can stress-test a current theory without asserting a rival.',
  addresses_open_question: 'May help frame an open question rather than answer it.',
  recommended_by_specialist: 'Suggested as a perspective worth considering, not as an endorsement of a claim.',
  broadens_perspective: 'A different angle from the one you have been using.',
  related_bridge: 'Connects to a lens already highlighted for this context.',
};

function lowerUnique(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((v): v is string => typeof v === 'string').map((v) => v.toLowerCase()))];
}

function clampLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return PERSPECTIVE_LIMITS.maxSuggestions;
  return Math.max(0, Math.min(Math.trunc(value), PERSPECTIVE_LIMITS.maxSuggestions));
}

interface ScoringContext extends RecommendationContext {
  frameworkKeys: string[];
  contextReasons: SuggestionReasonCode[];
}

function scoreExperience(
  experience: ExperienceDefinition,
  ctx: ScoringContext,
): { score: number; reasons: SuggestionReasonCode[] } {
  const reasons = new Set<SuggestionReasonCode>();
  let score = 0;

  const tags = lowerUnique(experience.recommendationTags);
  const framework = getFrameworkByKey(experience.frameworkKey);
  const contextText = [
    framework?.name ?? '',
    framework?.intellectualDomain ?? '',
    experience.title,
    experience.intellectualPurpose,
    experience.primaryQuestion,
    experience.scopeNote,
  ].join(' ').toLowerCase();

  if (experience.perspectiveClass === 'framework_primer') {
    reasons.add('framework_primer');
    score += 2;
  }

  for (const key of ctx.frameworkKeys) {
    if (experience.frameworkKey === key) {
      reasons.add('related_bridge');
      score += 3;
    } else if (framework?.relevantDisciplines.some((d) => d.toLowerCase().includes(key.toLowerCase()))) {
      score += 1;
    }
  }

  for (const reason of ctx.contextReasons) {
    if (reason === 'matches_case_genre') {
      reasons.add('matches_case_genre');
      score += 2;
    } else if (reason === 'broadens_perspective') {
      reasons.add('broadens_perspective');
      score += 1;
    }
  }

  for (const category of lowerUnique(ctx.discoveredEvidenceCategories)) {
    if (tags.includes(category) || contextText.includes(category)) {
      reasons.add('matches_discovered_evidence');
      score += 2;
      break;
    }
  }

  for (const category of lowerUnique(ctx.activeHypothesisCategories)) {
    if (tags.includes(category) || contextText.includes(category)) {
      reasons.add('challenges_active_hypothesis');
      score += 2;
      break;
    }
  }

  if ((ctx.openQuestionCount ?? 0) > 0 && (tags.includes('open_question') || tags.includes('reflection'))) {
    reasons.add('addresses_open_question');
    score += 1;
  }

  // Stable tie-breaker: shorter experiences are marginally preferred, then key.
  score += Math.max(0, 5 - Math.trunc(experience.estimatedMinutes / 5)) / 100;
  score += (1000 - Math.min(999, experience.experienceKey.length)) / 100000;

  return { score, reasons: [...reasons] };
}

/**
 * Return bounded, advisory experience suggestions. Never mutates input; the
 * returned objects are freshly constructed and safe to pass to a DTO layer.
 */
export function recommendExperiences(context: RecommendationContext): ExperienceRecommendation[] {
  const dismissed = new Set(lowerUnique(context.dismissedExperienceKeys));
  const saved = new Set(lowerUnique(context.savedExperienceKeys));
  const frameworkKeys = frameworkKeysForContext(context.caseTitle, context.genre);
  const contextReasons = reasonCodesForContext(context.caseTitle, context.genre);
  const available = (context.availableExperiences ?? PERSPECTIVE_EXPERIENCES).filter(
    (e) => e.status === 'published' && !dismissed.has(e.experienceKey.toLowerCase()),
  );

  const scored = available.map((experience) => {
    const { score, reasons } = scoreExperience(experience, { ...context, frameworkKeys, contextReasons });
    const finalReasons = saved.has(experience.experienceKey.toLowerCase()) && !reasons.includes('related_bridge')
      ? [...reasons, 'related_bridge' as SuggestionReasonCode]
      : reasons;
    const reasonText = finalReasons.map((code) => REASON_TEXT[code]).filter(Boolean).slice(0, 2).join(' ');
    return {
      experienceKey: experience.experienceKey,
      title: experience.title,
      frameworkKey: experience.frameworkKey,
      reasonCodes: finalReasons,
      reasonText: reasonText.slice(0, PERSPECTIVE_LIMITS.maxReasonTextChars),
      score,
      stateFingerprint: fingerprint([experience.experienceKey, ...frameworkKeys, ...finalReasons]),
    };
  });

  return scored
    .sort((a, b) => b.score - a.score || a.experienceKey.localeCompare(b.experienceKey))
    .slice(0, clampLimit(context.limit));
}
