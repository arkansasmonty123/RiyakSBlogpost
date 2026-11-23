// M5: single public import surface for the Perspective Engine foundation.
// ---------------------------------------------------------------------------
// Future server routes (M5-API) should import from here rather than reaching
// into individual modules. Everything exported here is pure: no DB, no server,
// no canonical truth, no mutable state beyond the authored registries.

export * from './types';
export {
  FRAMEWORKS,
  FRAMEWORK_KEYS,
  getFrameworkByKey,
} from './frameworks';
export {
  PERSPECTIVE_EXPERIENCES,
  EXPERIENCE_KEYS,
  getExperienceDefinitionByKey,
} from './experiences/index';
export {
  GENRE_BRIDGES,
  CASE_BRIDGES,
  bridgesForCase,
  bridgesForGenre,
  frameworkKeysForContext,
  reasonCodesForContext,
} from './case-bridges';
export {
  listFrameworks,
  findFramework,
  listExperiences,
  findExperience,
  experiencesForFramework,
  listRecommendationTags,
  listPerspectiveCategories,
  curatedOpeningQuestions,
  type ExperienceFilters,
} from './discovery';
export { recommendExperiences } from './recommendations';
export {
  toPublicFramework,
  toPublicExperienceSummary,
  toPublicExperienceDetail,
  toPublicSources,
  toPublicReflection,
  toPublicSuggestionState,
} from './dto';
export {
  buildPerspectiveSpecialistContext,
  type PerspectiveSpecialistContextParams,
} from './specialist-context';
