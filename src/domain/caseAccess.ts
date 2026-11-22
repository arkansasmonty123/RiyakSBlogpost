import type { CaseFile } from './types';

export interface PlayerCaseView {
  id: string;
  title: string;
  status: CaseFile['status'];
  playerKnowledge: string[];
  allegations: string[];
  admissibleMaterial: string[];
  unresolvedAmbiguity: string[];
  evidence: Array<{
    id: string;
    title: string;
    type: string;
    description: string;
    discovered: boolean;
    admissibility: string;
    reliability: string;
    provenance: string;
  }>;
}

export function toPlayerCaseView(caseFile: CaseFile): PlayerCaseView {
  return {
    id: caseFile.id,
    title: caseFile.title,
    status: caseFile.status,
    playerKnowledge: [...caseFile.playerKnowledge],
    allegations: [...caseFile.allegations],
    admissibleMaterial: [...caseFile.admissibleMaterial],
    unresolvedAmbiguity: caseFile.unresolvedAmbiguity,
    evidence: caseFile.evidence.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      description: e.discovered ? e.description : 'Not yet discovered.',
      discovered: e.discovered,
      admissibility: e.discovered ? e.admissibility : 'unknown',
      reliability: e.discovered ? e.reliability : 'unknown',
      provenance: e.provenance,
    })),
  };
}

export function assertNoCanonicalTruthLeak(view: unknown): void {
  const text = JSON.stringify(view).toLowerCase();
  const forbidden = ['canonicaltruth', 'actualevents', 'responsibleparties', 'hiddenmotives', 'evidenceauthenticity'];
  for (const key of forbidden) {
    if (text.includes(key)) throw new Error(`Canonical truth leak detected: ${key}`);
  }
}
