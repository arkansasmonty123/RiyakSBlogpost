import type { SaveGame } from './types';

export function createInitialSave(): SaveGame {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    player: {
      id: 'player',
      name: 'Newcomer',
      careerStage: 'intern',
      reputation: { competence: 10, integrity: 10, reliability: 10 },
    },
    clock: { day: 1, slot: 'morning' },
    selectedViewpoint: 'entrance',
    flags: { introSeen: false, caseAccepted: false, draftSubmitted: false },
    characters: [
      {
        id: 'senior',
        name: 'Adv. Meera Kulkarni',
        role: 'Senior Mentor',
        portrait: 'neutral',
        knowledgeBoundaries: ['Knows office records, not player private thoughts', 'Does not know canonical hidden culprit before evidence'],
        goals: ['Train the intern', 'Protect firm reputation', 'Prepare a defensible case theory'],
      },
      {
        id: 'peer',
        name: 'Arjun',
        role: 'Peer / Friend',
        portrait: 'smiling',
        knowledgeBoundaries: ['Knows shared office gossip', 'No access to confidential client admissions unless shared'],
        goals: ['Learn quickly', 'Get recognized'],
      },
      {
        id: 'clerk',
        name: 'Rao',
        role: 'Office Clerk',
        portrait: 'neutral',
        knowledgeBoundaries: ['Knows filing/procedure logistics', 'No legal conclusions'],
        goals: ['Keep records accurate'],
      },
    ],
    relationships: [
      { fromId: 'player', toId: 'senior', trust: 35, respect: 40, loyalty: 30, rivalry: 0, resentment: 0, affection: 10, professionalDependence: 60 },
      { fromId: 'player', toId: 'peer', trust: 45, respect: 35, loyalty: 35, rivalry: 10, resentment: 0, affection: 20, professionalDependence: 20 },
      { fromId: 'player', toId: 'clerk', trust: 30, respect: 30, loyalty: 20, rivalry: 0, resentment: 0, affection: 5, professionalDependence: 25 },
    ],
    memories: [
      { id: 'm1', day: 1, summary: 'Joined the firm as an intern under Adv. Meera Kulkarni.', participants: ['player', 'senior'] },
    ],
    notebook: [
      {
        id: 'n1',
        day: 1,
        kind: 'note',
        title: 'First day',
        content: 'Observe carefully. Separate facts, claims, and unknowns. Never fabricate legal citations.',
        verified: true,
      },
    ],
    caseFile: {
      id: 'case-001',
      title: 'The Canteen Altercation (Fictional)',
      status: 'active',
      canonicalTruth: {
        actualEvents: ['A shove occurred after an argument.', 'A phone recording is incomplete and may be misleading.', 'Medical report confirms minor injury but timing is disputed.'],
        responsibleParties: ['To be determined by evidence - canonical truth withheld from player UI'],
        actualTimeline: ['18:10 argument', '18:12 shove', '18:20 clinic visit'],
        evidenceAuthenticity: { 'ev-1': true, 'ev-2': true, 'ev-3': false },
        hiddenMotives: ['Witness had prior dispute with complainant'],
        unresolvedAmbiguities: ['Exact first physical contact'],
      },
      playerKnowledge: ['An altercation was reported outside a canteen.'],
      allegations: ['Complainant alleges intentional assault.', 'Accused alleges self-defense.'],
      admissibleMaterial: [],
      unresolvedAmbiguity: ['What happened in the missing 20 seconds of video?'],
      evidence: [
        { id: 'ev-1', title: 'Medical report summary', type: 'medical', description: 'Minor injury noted; timing disputed.', discovered: false, admissibility: 'unknown', reliability: 'unknown', provenance: 'Clinic record (fictional seed)' },
        { id: 'ev-2', title: 'Canteen CCTV clip', type: 'digital', description: 'Partial footage; missing segment before shove.', discovered: false, admissibility: 'unknown', reliability: 'unknown', provenance: 'Canteen camera export (fictional seed)' },
        { id: 'ev-3', title: 'Witness statement', type: 'testimony', description: 'Eyewitness claims to have seen full incident; consistency untested.', discovered: false, admissibility: 'unknown', reliability: 'unknown', provenance: 'Interview note (fictional seed)' },
      ],
    },
  };
}
