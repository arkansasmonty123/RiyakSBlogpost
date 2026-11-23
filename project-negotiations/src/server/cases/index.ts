import type { CaseBriefing, CaseDefinition, CaseSummary, ParticipantPublic } from '../../shared/types.js';
import { acquisitionCase } from './acquisition.js';
import { fragilePeaceCase } from './fragile-peace.js';
import { walkoutCase } from './walkout.js';

export { acquisitionCase } from './acquisition.js';
export { fragilePeaceCase } from './fragile-peace.js';
export { walkoutCase } from './walkout.js';

/** Code-defined case registry. No case table/seeding is required. */
export const CASES: CaseDefinition[] = [acquisitionCase, fragilePeaceCase, walkoutCase];

const CASE_MAP = new Map(CASES.map((c) => [c.id, c]));

export function getCase(id: string): CaseDefinition | undefined {
  return CASE_MAP.get(id);
}

export function listCaseSummaries(): CaseSummary[] {
  return CASES.map((c) => ({
    id: c.id,
    title: c.title,
    subtitle: c.subtitle,
    summary: c.summary,
    difficulty: c.difficulty,
    participantCount: c.participants.length,
    estimatedMinutes: c.estimatedMinutes,
    skills: [...c.skills],
  }));
}

/** Explicit allowlist projection: no secrets, outcome cut-offs or reveal rules. */
export function toBriefing(c: CaseDefinition): CaseBriefing {
  const participants: ParticipantPublic[] = c.participants.map((p) => ({ ...p }));
  return {
    caseId: c.id,
    title: c.title,
    context: c.context,
    playerRole: c.playerRole,
    playerObjective: c.playerObjective,
    playerConstraints: c.playerConstraints.map((i) => ({ ...i })),
    playerResources: c.playerResources.map((i) => ({ ...i })),
    playerPriorities: [...c.playerPriorities],
    playerPrivateInfo: c.playerPrivateInfo.map((i) => ({ ...i })),
    minimumAcceptableOutcome: c.minimumAcceptableOutcome,
    opposingDemands: c.opposingDemands.map((i) => ({ ...i })),
    knownInterests: c.knownInterests.map((i) => ({ ...i })),
    availableIntelligence: c.availableIntelligence.map((i) => ({ ...i })),
    apparentConstraints: c.apparentConstraints.map((i) => ({ ...i })),
    participants,
    relationships: [...c.relationships],
    issues: c.issues.map((issue) => ({
      id: issue.id,
      label: issue.label,
      description: issue.description,
      minValue: issue.minValue,
      maxValue: issue.maxValue,
      unit: issue.unit,
      playerIdeal: issue.playerIdeal,
      weight: issue.weight,
    })),
  };
}

export function toCaseSummary(c: CaseDefinition): CaseSummary {
  return {
    id: c.id,
    title: c.title,
    subtitle: c.subtitle,
    summary: c.summary,
    difficulty: c.difficulty,
    participantCount: c.participants.length,
    estimatedMinutes: c.estimatedMinutes,
    skills: [...c.skills],
  };
}
