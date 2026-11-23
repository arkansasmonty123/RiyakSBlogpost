// M7 showcase discovery package: The Midnight Heist.
// ---------------------------------------------------------------------------
// SERVER AUTHORING ONLY. All refs are stable human-readable source strings,
// existing case actions, and real M3 artifact/specialist keys — never database
// UUIDs and never canonical-truth fields. `leakageTerms` holds the canonical
// culprit name strictly as a server-side guard and is NEVER sent to clients.
//
// Unlocks are PRE-AUTHORED presentations. They never release evidence:
// mystery-engine.processProgression remains the only evidence-release authority.

import type { DiscoveryCluePackage } from './types';

export const midnightHeistDiscoveries: DiscoveryCluePackage = {
  caseTitle: 'The Midnight Heist',
  packageKey: 'midnight-heist-discovery-v1',
  version: '1.0.0',
  status: 'pending_review',
  summary:
    'Two real-world research threads grounded in the gallery trace record and the gemstone identification problem.',
  leakageTerms: ['Victor Sterling'],
  clues: [
    {
      key: 'mh-locard-trace-transfer',
      subjectKey: 'locard-exchange-principle',
      subjectLabel: "Locard's exchange principle",
      referenceCategory: 'scientific_principle',
      difficulty: 'foundational',
      knowledgeStatus: 'established',
      title: 'What a trace can and cannot tell you',
      prompt:
        'The case file records trace material from the display area. Explain the real-world principle that makes such traces meaningful, and say clearly what it cannot establish on its own.',
      context:
        'The forensic specialist has flagged the trace record. This question concerns the general forensic principle, not the identity of any person in the case.',
      triggers: {
        visibleEvidence: ['fingerprint analysis'],
        actionsPerformed: ['examine_diamond_case'],
        artifactKeys: ['trace-transfer-and-secondary-transfer'],
        minDiscoveredEvidence: 4,
      },
      criteria: {
        subjectAliases: [
          'locard', 'exchange principle', 'every contact leaves a trace',
          'trace transfer', 'transfer of trace material', 'contact trace',
        ],
        essentialConcepts: [
          {
            key: 'contact',
            aliases: ['contact', 'touched', 'physical interaction', 'came into contact', 'physical contact'],
          },
          {
            key: 'mutual-transfer',
            aliases: [
              'transfer', 'transferred', 'exchanged', 'exchange', 'carried away',
              'picked up', 'left behind', 'residue', 'fibers', 'fibres', 'trace material',
            ],
          },
          {
            key: 'interpretation-limits',
            aliases: [
              'cannot establish when', 'does not establish when', 'cannot determine when',
              'does not show when', 'no time information', 'cannot date', 'timing is limited',
              'cannot identify', 'alone does not prove', 'not proof of guilt',
              'sequence of events', 'duration of contact',
            ],
          },
        ],
        optionalConcepts: [
          { key: 'secondary-transfer', aliases: ['secondary transfer', 'moved twice', 'indirect transfer', 'two-step transfer'] },
          { key: 'corroboration', aliases: ['context', 'scene', 'circumstances', 'corroborate', 'other evidence'] },
        ],
        connectionMarkers: ['case', 'display', 'gallery', 'fingerprint', 'scene', 'trace record', 'evidence', 'diamond'],
        misconceptionTerms: [
          'trace proves guilt', 'contact alone proves', 'a fingerprint proves the suspect',
          'presence at the scene proves guilt', 'trace alone identifies the culprit',
        ],
        confidentMarkers: [
          'definitely', 'without a doubt', 'obviously', 'clearly the', 'i am certain',
          'proof positive', 'no question',
        ],
        minEssentialMatches: 3,
        requireConnection: true,
        minAssertionChars: 30,
      },
      correctedUnderstanding:
        'Trace transfer describes the exchange of material when people and surfaces come into contact: a person can leave something behind and carry something away. It supports an inference of contact, but by itself it does not establish when contact happened, how long it lasted, or who was responsible. Secondary transfer means material can move more than once, so trace findings need context and corroboration.',
      citations: [
        {
          label: 'Exchange principle — general forensic reference',
          bibliographyRef:
            'Standard forensic-science textbook treatment of trace evidence and the exchange principle (exact edition and page pending human verification)',
          sourceUrl: null,
          sourceVerified: false,
          verificationStatus: 'pending_review',
          sourceType: 'textbook',
          verificationNotes: 'Conservative reference only. No URL recorded; human verification required before publication.',
        },
        {
          label: 'Secondary transfer — interpretation caution',
          bibliographyRef:
            'Forensic science literature on trace persistence and secondary transfer (edition and page pending human verification)',
          sourceUrl: null,
          sourceVerified: false,
          verificationStatus: 'pending_review',
          sourceType: 'peer_reviewed',
          verificationNotes: 'Conservative reference only. No URL recorded; human verification required before publication.',
        },
      ],
      unlocks: [
        {
          key: 'mh-locard-insight',
          kind: 'insight',
          targetRef: 'fingerprint analysis',
          insight: 'A trace speaks to contact; timing needs a separate record.',
          followUp: 'Which other record in this case could constrain when that contact happened?',
        },
        {
          key: 'mh-secondary-transfer-question',
          kind: 'question',
          targetRef: 'trace-transfer-and-secondary-transfer',
          question: 'Could the trace have been carried to the display area on something else?',
          whyItMatters: 'Secondary transfer is a standard caution in trace interpretation.',
        },
        {
          key: 'mh-trace-claim-seed',
          kind: 'reality_map_seed',
          targetRef: 'fingerprint analysis',
          title: 'Claim: contact occurred',
          description: 'Open a Reality Map claim about contact and keep timing as a separate, currently unsupported question.',
        },
        {
          key: 'mh-priya-trace-review',
          kind: 'specialist_response',
          targetRef: 'forensic-scientist-priya',
          specialistKey: 'forensic-scientist-priya',
          prompt: 'Ask the forensic scientist what the trace record supports and what it does not.',
        },
      ],
      evidenceRefs: ['fingerprint analysis', 'security footage'],
      specialistKeys: ['forensic-scientist-priya'],
    },
    {
      key: 'mh-diamond-simulant-identification',
      subjectKey: 'diamond-vs-simulant-identification',
      subjectLabel: 'Diamond identification and simulants',
      referenceCategory: 'methodology_caution',
      difficulty: 'intermediate',
      knowledgeStatus: 'established',
      title: 'Clear does not mean diamond',
      prompt:
        'The recovered stone and the debris record raise a question about identification. Explain how a laboratory distinguishes a diamond from a simulant, and why appearance alone is not enough.',
      context:
        'The gemology reference is available. Focus on the general identification problem rather than on any individual in the case.',
      triggers: {
        visibleEvidence: ['laser cutter debris'],
        actionsPerformed: ['examine_case_debris'],
        artifactKeys: ['diamond-vs-simulant-identification'],
        minDiscoveredEvidence: 5,
      },
      criteria: {
        subjectAliases: [
          'diamond', 'simulant', 'moissanite', 'cubic zirconia',
          'gemstone identification', 'refractive index', 'thermal conductivity', 'specific gravity',
        ],
        essentialConcepts: [
          {
            key: 'appearance-insufficient',
            aliases: [
              'visual appearance', 'looks like', 'clear stone', 'colourless', 'colorless',
              'appearance alone', 'visually similar', 'naked eye',
            ],
          },
          {
            key: 'instrumental-testing',
            aliases: [
              'refractive index', 'thermal conductivity', 'specific gravity', 'spectroscope',
              'loupe', 'microscope', 'instrument', 'laboratory test', 'density measurement',
              'thermal tester', 'reflectance',
            ],
          },
          {
            key: 'simulant-category',
            aliases: [
              'simulant', 'moissanite', 'cubic zirconia', 'imitation', 'synthetic',
              'fake', 'lookalike', 'substitute',
            ],
          },
        ],
        optionalConcepts: [
          { key: 'provenance', aliases: ['provenance', 'documentation', 'certificate', 'grading report', 'chain of custody'] },
          { key: 'synthetic-distinction', aliases: ['synthetic diamond', 'lab grown', 'lab-grown', 'grown diamond', 'treated stone'] },
        ],
        connectionMarkers: ['stone', 'debris', 'case', 'display', 'gem', 'valuable', 'evidence', 'insurance'],
        misconceptionTerms: [
          'a clear stone is a diamond', 'visual inspection is enough', 'appearance proves it is a diamond',
          'all diamonds are identical', 'simulants cannot look like diamonds',
        ],
        confidentMarkers: [
          'definitely', 'without a doubt', 'obviously', 'clearly the', 'i am certain',
          'proof positive', 'no question',
        ],
        minEssentialMatches: 3,
        requireConnection: true,
        minAssertionChars: 30,
      },
      correctedUnderstanding:
        'Materials that look alike to the eye can be physically different. Gemological laboratories distinguish diamond from simulants using measured properties such as refractive index, thermal conductivity and specific gravity, together with documentation of provenance. Visual appearance alone cannot establish what a stone is, and synthetic diamonds are a separate category from simulants.',
      citations: [
        {
          label: 'Gemstone identification — general reference',
          bibliographyRef:
            'Standard gemology reference on diamond properties and simulant identification (edition and page pending human verification)',
          sourceUrl: null,
          sourceVerified: false,
          verificationStatus: 'pending_review',
          sourceType: 'textbook',
          verificationNotes: 'Conservative reference only. No URL recorded; human verification required before publication.',
        },
        {
          label: 'Identification limits — methodology caution',
          bibliographyRef:
            'Gemological literature on visual identification limits and instrumental testing (edition and page pending human verification)',
          sourceUrl: null,
          sourceVerified: false,
          verificationStatus: 'pending_review',
          sourceType: 'reputable_org',
          verificationNotes: 'Conservative reference only. No URL recorded; human verification required before publication.',
        },
      ],
      unlocks: [
        {
          key: 'mh-debris-reinterpretation',
          kind: 'reinterpretation',
          targetRef: 'laser cutter debris',
          fromReading: 'The debris identifies how the entry was made and by whom.',
          toReading: 'The debris constrains a method; it does not identify a person.',
        },
        {
          key: 'mh-valuation-question',
          kind: 'question',
          targetRef: 'diamond-vs-simulant-identification',
          question: 'Would the valuation record change if the stone were not what it appeared to be?',
          whyItMatters: 'Identification and valuation are separate questions that can be cross-checked.',
        },
        {
          key: 'mh-gemologist-review',
          kind: 'specialist_response',
          targetRef: 'gemologist-adaeze',
          specialistKey: 'gemologist-adaeze',
          prompt: 'Ask the gemologist which tests would settle the identification question.',
        },
        {
          key: 'mh-reexamine-display-case',
          kind: 'action',
          targetRef: 'examine_diamond_case',
          action: 'examine_diamond_case',
          label: 'Re-examine the display case record',
        },
      ],
      evidenceRefs: ['laser cutter debris', 'fingerprint analysis'],
      specialistKeys: ['gemologist-adaeze'],
    },
  ],
};
