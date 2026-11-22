// M3 knowledge-pack registry.
// ---------------------------------------------------------------------------
// Add new packs here once their sources have been verified and authored.

import type { CaseKnowledgePack } from './types';
import { midnightHeistPack } from './midnight-heist';
import { codeBlueClinicPack } from './code-blue-clinic';
import { blazeDawnBakeryPack } from './blaze-dawn-bakery';

export const KNOWLEDGE_PACKS: CaseKnowledgePack[] = [
  midnightHeistPack,
  codeBlueClinicPack,
  blazeDawnBakeryPack,
];

export function findPackByCaseTitle(caseTitle: string): CaseKnowledgePack | undefined {
  return KNOWLEDGE_PACKS.find((pack) => pack.caseTitle === caseTitle);
}

export type { CaseKnowledgePack } from './types';
