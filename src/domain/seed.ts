import type { DialogueScene, SaveGame } from './types';

export const DEFAULT_DRAFT =
  'Issue:\nFacts (known/claimed/disputed):\nRelevant law (verified sources only):\nAnalysis:\nConclusion:';

/**
 * Static, deterministic dialogue content. Replies and memories contain only what the
 * player / participating character could legitimately know. No canonical case truth.
 */
export const DIALOGUE_SCENES: DialogueScene[] = [
  {
    id: 'd-senior-intro',
    characterId: 'senior',
    minDay: 1,
    once: true,
    prompt: 'Adv. Meera Kulkarni asks how you will approach your first assignment.',
    choices: [
      {
        id: 'separate-facts',
        label: 'Separate known facts, claims and unknowns; verify sources before citing.',
        reply: 'Adv. Meera Kulkarni: "Good. Facts, claims and unknowns — never blur them, and never cite what you have not verified."',
        effects: [
          { characterId: 'senior', dimension: 'trust', amount: 5 },
          { characterId: 'senior', dimension: 'respect', amount: 5 },
        ],
        memory: 'Told Adv. Meera Kulkarni you would separate known facts, claims and unknowns before citing law.',
      },
      {
        id: 'cite-from-memory',
        label: 'Draft fast and cite statutes from memory to save time.',
        reply: 'Adv. Meera Kulkarni: "No. Unverified citations harm the client and this firm. Verify first, then write."',
        effects: [
          { characterId: 'senior', dimension: 'trust', amount: -6 },
          { characterId: 'senior', dimension: 'respect', amount: -4 },
          { characterId: 'senior', dimension: 'resentment', amount: 3 },
        ],
        memory: 'Suggested citing statutes from memory; Adv. Meera Kulkarni corrected you on verification.',
      },
    ],
  },
  {
    id: 'd-peer-day2',
    characterId: 'peer',
    minDay: 2,
    once: true,
    prompt: 'Arjun asks how your first fact matrix is coming along.',
    choices: [
      {
        id: 'ask-review',
        label: 'Ask Arjun to review your matrix for claim-vs-fact errors.',
        reply: 'Arjun: "Sure. Send it over and I will mark what is claim and what is fact."',
        effects: [
          { characterId: 'peer', dimension: 'trust', amount: 4 },
          { characterId: 'peer', dimension: 'affection', amount: 3 },
          { characterId: 'peer', dimension: 'professionalDependence', amount: -2 },
        ],
        memory: 'Asked Arjun to review your fact matrix; he agreed.',
      },
      {
        id: 'decline-help',
        label: 'Say it is fine; you do not need help.',
        reply: 'Arjun: "Suit yourself."',
        effects: [
          { characterId: 'peer', dimension: 'trust', amount: -2 },
          { characterId: 'peer', dimension: 'affection', amount: -3 },
          { characterId: 'peer', dimension: 'rivalry', amount: 3 },
        ],
        memory: 'Declined Arjun’s offer to review your fact matrix.',
      },
    ],
  },
  {
    id: 'd-clerk-day4',
    characterId: 'clerk',
    minDay: 4,
    once: true,
    prompt: 'Rao offers to show you the filing register for the altercation matter.',
    choices: [
      {
        id: 'inspect-register',
        label: 'Ask to see the register entries and their dates.',
        reply: 'Rao: "Here. Entries and dates — procedure and records, not legal conclusions."',
        effects: [
          { characterId: 'clerk', dimension: 'trust', amount: 5 },
          { characterId: 'clerk', dimension: 'respect', amount: 3 },
        ],
        memory: 'Reviewed filing register dates with Rao.',
      },
      {
        id: 'ask-fault',
        label: 'Ask Rao who is really at fault.',
        reply: 'Rao: "That is not in my register, and it is not for me to say."',
        effects: [
          { characterId: 'clerk', dimension: 'respect', amount: -5 },
          { characterId: 'clerk', dimension: 'trust', amount: -4 },
          { characterId: 'clerk', dimension: 'resentment', amount: 4 },
        ],
        memory: 'Asked Rao for a conclusion outside his knowledge; he declined.',
      },
    ],
  },
  {
    id: 'd-senior-evidence',
    characterId: 'senior',
    minDay: 5,
    once: true,
    prompt: 'Adv. Meera Kulkarni asks where your evidence review stands.',
    choices: [
      {
        id: 'report-review',
        label: 'Report what you reviewed and note the gap in the recording.',
        reply: 'Adv. Meera Kulkarni: "Good. Tie every note to the item you actually reviewed."',
        effects: [
          { characterId: 'senior', dimension: 'trust', amount: 6 },
          { characterId: 'senior', dimension: 'respect', amount: 5 },
          { characterId: 'senior', dimension: 'loyalty', amount: 3 },
        ],
        memory: 'Reported completed evidence review and a contradiction note to Adv. Meera Kulkarni.',
      },
      {
        id: 'admit-behind',
        label: 'Admit you have not reviewed the items yet.',
        reply: 'Adv. Meera Kulkarni: "Then draw no conclusions. Review first."',
        effects: [
          { characterId: 'senior', dimension: 'trust', amount: -4 },
          { characterId: 'senior', dimension: 'respect', amount: -3 },
        ],
        memory: 'Admitted to Adv. Meera Kulkarni that evidence review was incomplete.',
      },
    ],
  },
];

export function createInitialSave(): SaveGame {
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    player: {
      id: 'player',
      name: 'Newcomer',
      careerStage: 'intern',
      reputation: { competence: 10, integrity: 10, reliability: 10 },
    },
    clock: { day: 1, slot: 'morning' },
    selectedViewpoint: 'entrance',
    flags: { introSeen: false, caseAccepted: false, assignment1Submitted: false, assignment2Submitted: false, assignment3Submitted: false },
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
    legalSources: [
      {
        id: 'ls-1',
        title: 'Bharatiya Nyaya Sanhita (BNS) — placeholder reference',
        citation: 'BNS (placeholder - verify exact provision before use)',
        sourceType: 'statute',
        jurisdiction: 'India',
        verificationStatus: 'placeholder',
        provenance: 'Placeholder only. Do not treat as authoritative citation. Verify against official enacted text and effective date before production use.',
        notes: 'Use for workflow testing; real provision/citation must be verified.',
      },
      {
        id: 'ls-2',
        title: 'Bharatiya Nagarik Suraksha Sanhita (BNSS) — placeholder reference',
        citation: 'BNSS (placeholder - verify exact provision before use)',
        sourceType: 'statute',
        jurisdiction: 'India',
        verificationStatus: 'placeholder',
        provenance: 'Placeholder only. Verify against official enacted text before production use.',
      },
      {
        id: 'ls-3',
        title: 'Bharatiya Sakshya Adhiniyam (BSA) — placeholder reference',
        citation: 'BSA (placeholder - verify exact provision before use)',
        sourceType: 'statute',
        jurisdiction: 'India',
        verificationStatus: 'placeholder',
        provenance: 'Placeholder only. Verify against official enacted text before production use.',
      },
      {
        id: 'ls-4',
        title: 'Evidence handling principle (educational summary)',
        citation: 'Educational summary: authenticity, chain of custody, admissibility, reliability',
        sourceType: 'summary',
        jurisdiction: 'Fictional',
        verificationStatus: 'verified',
        provenance: 'Internal educational summary for prototype gameplay; not a statutory citation or legal advice.',
        notes: 'Safe to show in prototype as labeled summary.',
      },
    ],
    assignments: [
      {
        id: 'a1',
        day: 1,
        title: 'Initial fact matrix',
        description: 'Identify known facts, allegations, disputed points, and unknowns. Discover and review at least one piece of evidence.',
        status: 'active',
        requiredEvidenceIds: ['ev-1'],
        requiredSourceIds: ['ls-4'],
      },
      {
        id: 'a2',
        day: 3,
        unlockAfter: 'a1',
        title: 'Case brief draft',
        description: 'Draft a short case brief with Issue, Facts, Verified Law/Source Notes, Analysis, and Conclusion. Do not fabricate citations.',
        status: 'locked',
        requiredEvidenceIds: ['ev-1', 'ev-2'],
        requiredSourceIds: ['ls-4'],
      },
      {
        id: 'a3',
        day: 5,
        unlockAfter: 'a2',
        title: 'Evidence contradiction note',
        description: 'Review the evidence items and record a contradiction or corroboration note tied to an item in your notebook.',
        status: 'locked',
        requiredEvidenceIds: ['ev-1', 'ev-2', 'ev-3'],
        requiredSourceIds: ['ls-4'],
        requiredNotebookKinds: ['contradiction'],
      },
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
        responsibleParties: ['Canonical party responsibility withheld from player view'],
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
        {
          id: 'ev-1', title: 'Medical report summary', type: 'medical', description: 'Minor injury noted; timing disputed.',
          discovered: false, reviewed: false, admissibility: 'unknown', reliability: 'unknown',
          assessment: { admissibility: 'unknown', reliability: 'unknown', rationale: '' },
          provenance: 'Clinic record (fictional seed)',
        },
        {
          id: 'ev-2', title: 'Canteen CCTV clip', type: 'digital', description: 'Partial footage; missing segment before shove.',
          discovered: false, reviewed: false, admissibility: 'unknown', reliability: 'unknown',
          assessment: { admissibility: 'unknown', reliability: 'unknown', rationale: '' },
          provenance: 'Canteen camera export (fictional seed)',
        },
        {
          id: 'ev-3', title: 'Witness statement', type: 'testimony', description: 'Eyewitness claims to have seen full incident; consistency untested.',
          discovered: false, reviewed: false, admissibility: 'unknown', reliability: 'unknown',
          assessment: { admissibility: 'unknown', reliability: 'unknown', rationale: '' },
          provenance: 'Interview note (fictional seed)',
        },
      ],
    },
    usedDialogueSceneIds: [],
    draft: { current: DEFAULT_DRAFT, versions: [] },
  };
}
