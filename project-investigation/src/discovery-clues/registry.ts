// M7 discovery-clue registry. Add new authored packages here after validation.

import type { DiscoveryClue, DiscoveryClueRegistry } from './types';
import { midnightHeistDiscoveries } from './midnight-heist';
import { codeBlueClinicDiscoveries } from './code-blue-clinic';
import { blazeDawnBakeryDiscoveries } from './blaze-dawn-bakery';

export const DISCOVERY_CLUE_PACKAGES = [
  midnightHeistDiscoveries,
  codeBlueClinicDiscoveries,
  blazeDawnBakeryDiscoveries,
] as const;

export const DISCOVERY_CLUE_REGISTRY: DiscoveryClueRegistry = {
  packages: DISCOVERY_CLUE_PACKAGES,
  getByCaseTitle(caseTitle: string) {
    return DISCOVERY_CLUE_PACKAGES.find((pkg) => pkg.caseTitle === caseTitle);
  },
  getByKey(packageKey: string) {
    return DISCOVERY_CLUE_PACKAGES.find((pkg) => pkg.packageKey === packageKey);
  },
  getClueByKey(clueKey: string) {
    return findDiscoveryClue(clueKey);
  },
};

export function getDiscoveryPackages(): readonly (typeof DISCOVERY_CLUE_PACKAGES)[number][] {
  return DISCOVERY_CLUE_PACKAGES;
}

export function getPackageByCaseTitle(caseTitle: string) {
  return DISCOVERY_CLUE_REGISTRY.getByCaseTitle(caseTitle);
}

export function getPackageByKey(packageKey: string) {
  return DISCOVERY_CLUE_REGISTRY.getByKey(packageKey);
}

export function findDiscoveryClue(clueKey: string): DiscoveryClue | undefined {
  for (const pkg of DISCOVERY_CLUE_PACKAGES) {
    const clue = pkg.clues.find((entry) => entry.key === clueKey);
    if (clue) return clue;
  }
  return undefined;
}
