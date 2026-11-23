// M6 case-event authoring types. Authoring definitions live here and in the
// three package files; they are server-only metadata and never contain
// canonical truth, hidden evidence IDs, or secret release conditions.

import type { CaseEventPackage } from '../living-world/types';

export type {
  ActorRef,
  AlternativeBranch,
  CaseEventDefinition,
  CaseEventPackage,
  ConsequenceDefinition,
  EventAnchor,
  EventCategory,
  EventEligibility,
  EventPresentation,
  EventProvenance,
  EventRequiredState,
  EventSignificance,
  EventTiming,
  ResponseOption,
} from '../living-world/types';

/** Registry surface consumed by the engine, seeder, validator and tests. */
export interface CaseEventRegistry {
  packages: readonly CaseEventPackage[];
  getByCaseTitle(caseTitle: string): CaseEventPackage | undefined;
  getByKey(packageKey: string): CaseEventPackage | undefined;
}
