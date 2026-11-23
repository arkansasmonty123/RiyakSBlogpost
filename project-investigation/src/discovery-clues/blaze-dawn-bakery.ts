// M7 showcase discovery package: Blaze at Dawn Bakery.
// SERVER AUTHORING ONLY. Refs are seeded evidence source strings, real case
// actions and M3 artifact/specialist keys. `leakageTerms` is a server-only
// guard list and is never exposed by a DTO. Unlocks are pre-authored;
// evidence release remains exclusively in mystery-engine.processProgression.

import type { DiscoveryCluePackage } from './types';

export const blazeDawnBakeryDiscoveries: DiscoveryCluePackage = {
  caseTitle: 'Blaze at Dawn Bakery',
  packageKey: 'blaze-dawn-bakery-discovery-v1',
  version: '1.0.0',
  status: 'pending_review',
  summary:
    'Two research threads on fire-scene methodology and accelerant testing, grounded in the bakery scene and laboratory records.',
  leakageTerms: ['Victor Ames'],
  clues: [
    {
      key: 'bz-fire-origin-vs-cause',
      subjectKey: 'fire-origin-vs-cause',
      subjectLabel: 'Fire origin versus cause',
      referenceCategory: 'scientific_principle',
      difficulty: 'foundational',
      knowledgeStatus: 'established',
      title: 'Where a fire starts is not why it starts',
      prompt:
        "The scene report describes burn patterns. Explain the difference between a fire's origin and its cause, and how a systematic fire investigation uses evidence to test hypotheses.",
      context:
        'Use the fire-investigation reference. Focus on method and reasoning rather than on naming anyone in the case.',
      triggers: {
        visibleEvidence: ['scene report 6', 'witness account 6'],
        artifactKeys: ['nfpa-921-origin-cause-method'],
        minDiscoveredEvidence: 3,
      },
      criteria: {
        subjectAliases: [
          'fire origin', 'origin and cause', 'origin versus cause', 'burn pattern',
          'fire investigation', 'cause of the fire',
        ],
        essentialConcepts: [
          {
            key: 'origin',
            aliases: [
              'origin', 'where the fire started', 'point of origin', 'area of origin',
              'where it began', 'starting point',
            ],
          },
          {
            key: 'cause',
            aliases: [
              'cause', 'ignition source', 'ignited', 'fuel', 'heat', 'oxygen',
              'what started', 'accidental', 'incendiary',
            ],
          },
          {
            key: 'method',
            aliases: [
              'systematic', 'hypothesis', 'test', 'evidence based', 'evidence-based',
              'collect data', 'analyze', 'analyse', 'reconstruct', 'inductive',
              'nfpa 921', 'collect and analyze',
            ],
          },
        ],
        optionalConcepts: [
          { key: 'scene-evidence', aliases: ['burn pattern', 'witness', 'physical evidence', 'documentation'] },
        ],
        connectionMarkers: ['scene', 'bakery', 'case', 'evidence', 'report', 'fire', 'record'],
        misconceptionTerms: [
          'burn pattern alone proves arson', 'a fire always burns upward from the lowest point',
          'the origin proves the cause', 'charred area is always where the fire began',
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
        'Origin is where a fire began; cause is what ignited it. A systematic fire investigation tests hypotheses using fire patterns, witness information and physical evidence together. Burn patterns alone cannot establish cause or responsibility, because ventilation, fuel and geometry can produce misleading appearances.',
      citations: [
        {
          label: 'Systematic fire origin and cause methodology',
          bibliographyRef:
            'NFPA 921-style systematic fire investigation methodology (edition and section pending human verification)',
          sourceUrl: null,
          sourceVerified: false,
          verificationStatus: 'pending_review',
          sourceType: 'standards_body',
          verificationNotes: 'Conservative reference only. No URL recorded; human verification required before publication.',
        },
        {
          label: 'Fire pattern interpretation — methodology caution',
          bibliographyRef:
            'Fire investigation literature on pattern interpretation limits (edition and page pending human verification)',
          sourceUrl: null,
          sourceVerified: false,
          verificationStatus: 'pending_review',
          sourceType: 'peer_reviewed',
          verificationNotes: 'Conservative reference only. No URL recorded; human verification required before publication.',
        },
      ],
      unlocks: [
        {
          key: 'bz-origin-reinterpretation',
          kind: 'reinterpretation',
          targetRef: 'scene report 6',
          fromReading: 'The burn pattern identifies the cause and who was responsible.',
          toReading: 'The pattern narrows where to look; the cause remains a hypothesis to test.',
        },
        {
          key: 'bz-origin-question',
          kind: 'question',
          targetRef: 'nfpa-921-origin-cause-method',
          question: 'What independent records would distinguish origin from cause here?',
          whyItMatters: 'Separating the two questions keeps the investigation testable.',
        },
        {
          key: 'bz-origin-record-seed',
          kind: 'reality_map_seed',
          targetRef: 'scene report 6',
          title: 'Claim: tentative origin area',
          description: 'Open a Reality Map claim for the origin area and keep the cause explicitly open.',
        },
        {
          key: 'bz-delgado-review',
          kind: 'specialist_response',
          targetRef: 'fire-investigator-delgado',
          specialistKey: 'fire-investigator-delgado',
          prompt: 'Ask the fire investigator which hypotheses the current scene evidence can distinguish.',
        },
      ],
      evidenceRefs: ['scene report 6', 'witness account 6'],
      specialistKeys: ['fire-investigator-delgado'],
    },
    {
      key: 'bz-accelerant-detection-limits',
      subjectKey: 'accelerant-detection-limits',
      subjectLabel: 'Accelerant detection and its limits',
      referenceCategory: 'methodology_caution',
      difficulty: 'advanced',
      knowledgeStatus: 'established',
      title: 'A negative swab is not the end of the question',
      prompt:
        'The forensic trace record reports on accelerant testing. Explain how accelerants are detected and why both positive and negative results need careful interpretation.',
      context:
        'Use the laboratory-methods reference. Address the analytical method and its limits, not any person in the case.',
      triggers: {
        visibleEvidence: ['forensic trace 6'],
        actionsPerformed: ['examine_scene_6'],
        artifactKeys: ['accelerant-detection-limits'],
        minDiscoveredEvidence: 4,
      },
      criteria: {
        subjectAliases: [
          'accelerant', 'ignitable liquid', 'gas chromatography', 'gc ms', 'gc-ms',
          'fire debris analysis', 'petroleum distillate',
        ],
        essentialConcepts: [
          {
            key: 'collection-and-analysis',
            aliases: [
              'sample', 'swab', 'container', 'headspace', 'collection', 'fire debris',
              'sealed', 'laboratory', 'gas chromatography', 'gc-ms', 'gc ms', 'mass spectrometry',
            ],
          },
          {
            key: 'interpretation-limits',
            aliases: [
              'false positive', 'false negative', 'background', 'contamination',
              'legitimate product', 'evaporation', 'degradation', 'weathering', 'mixture',
              'not proof', 'cannot rule out', 'not conclusive',
            ],
          },
          {
            key: 'corroboration',
            aliases: ['other evidence', 'scene', 'context', 'corroborate', 'pattern', 'witness', 'combine'],
          },
        ],
        optionalConcepts: [
          { key: 'screening-tools', aliases: ['canine', 'accelerant detection dog', 'hydrocarbon', 'sniffer dog'] },
        ],
        connectionMarkers: ['case', 'bakery', 'scene', 'trace', 'fire', 'evidence', 'report'],
        misconceptionTerms: [
          'a negative test proves no accelerant was used', 'a positive test proves arson',
          'any accelerant detection proves arson', 'a dog alert alone is conclusive',
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
        'Fire debris is collected in suitable containers and commonly analyzed by headspace gas chromatography–mass spectrometry. Results require interpretation: legitimate products, background contamination and mixtures can complicate a positive finding, while evaporation, degradation and sampling limits mean a negative result does not rule out an ignitable liquid. Laboratory findings must be corroborated with the scene evidence.',
      citations: [
        {
          label: 'Fire debris analysis — laboratory methods',
          bibliographyRef:
            'Analytical methods for ignitable liquids in fire debris (headspace GC-MS; edition and page pending human verification)',
          sourceUrl: null,
          sourceVerified: false,
          verificationStatus: 'pending_review',
          sourceType: 'peer_reviewed',
          verificationNotes: 'Conservative reference only. No URL recorded; human verification required before publication.',
        },
        {
          label: 'Accelerant interpretation — caution',
          bibliographyRef:
            'Fire investigation literature on false positives, background products and degradation of ignitable liquids (edition and page pending human verification)',
          sourceUrl: null,
          sourceVerified: false,
          verificationStatus: 'pending_review',
          sourceType: 'standards_body',
          verificationNotes: 'Conservative reference only. No URL recorded; human verification required before publication.',
        },
      ],
      unlocks: [
        {
          key: 'bz-accelerant-insight',
          kind: 'insight',
          targetRef: 'forensic trace 6',
          insight: 'A laboratory result is one line of evidence, not a verdict.',
          followUp: 'Which scene observation could corroborate or complicate the result?',
        },
        {
          key: 'bz-accelerant-question',
          kind: 'question',
          targetRef: 'accelerant-detection-limits',
          question: 'Could common bakery products or cleaning agents produce a similar signal?',
          whyItMatters: 'Background sources are a standard consideration in fire debris interpretation.',
        },
        {
          key: 'bz-hale-review',
          kind: 'specialist_response',
          targetRef: 'safety-compliance-hale',
          specialistKey: 'safety-compliance-hale',
          prompt: 'Ask the safety specialist which routine site products could matter for interpretation.',
        },
        {
          key: 'bz-reexamine-scene',
          kind: 'action',
          targetRef: 'examine_scene_6',
          action: 'examine_scene_6',
          label: 'Re-examine the scene collection record',
        },
      ],
      evidenceRefs: ['forensic trace 6', 'scene report 6'],
      specialistKeys: ['fire-investigator-delgado', 'safety-compliance-hale'],
    },
  ],
};
