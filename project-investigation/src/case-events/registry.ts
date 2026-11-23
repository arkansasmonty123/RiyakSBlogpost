// M6 case-event registry. Add new authored packages here once validated.

import type { CaseEventPackage } from '../living-world/types';
import type { CaseEventRegistry } from './types';
import { midnightHeistEvents } from './midnight-heist';
import { codeBlueClinicEvents } from './code-blue-clinic';
import { blazeDawnBakeryEvents } from './blaze-dawn-bakery';

export const CASE_EVENT_PACKAGES: readonly CaseEventPackage[] = [
  midnightHeistEvents,
  codeBlueClinicEvents,
  blazeDawnBakeryEvents,
];

export const CASE_EVENT_REGISTRY: CaseEventRegistry = {
  packages: CASE_EVENT_PACKAGES,
  getByCaseTitle(caseTitle: string): CaseEventPackage | undefined {
    return CASE_EVENT_PACKAGES.find((pkg) => pkg.caseTitle === caseTitle);
  },
  getByKey(packageKey: string): CaseEventPackage | undefined {
    return CASE_EVENT_PACKAGES.find((pkg) => pkg.packageKey === packageKey);
  },
};

/** Convenience alias used by the engine's deterministic materialization. */
export function getPackageByCaseTitle(caseTitle: string): CaseEventPackage | undefined {
  return CASE_EVENT_REGISTRY.getByCaseTitle(caseTitle);
}

export function getPackageByKey(packageKey: string): CaseEventPackage | undefined {
  return CASE_EVENT_REGISTRY.getByKey(packageKey);
}

export function getCaseEventPackages(): readonly CaseEventPackage[] {
  return CASE_EVENT_PACKAGES;
}
