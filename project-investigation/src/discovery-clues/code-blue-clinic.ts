// M7 showcase discovery package: Code Blue at the Clinic.
// SERVER AUTHORING ONLY. Refs are seeded evidence source strings, real case
// actions and M3 artifact/specialist keys. `leakageTerms` is a server-only
// guard list and is never exposed by a DTO. Unlocks are pre-authored;
// evidence release remains exclusively in mystery-engine.processProgression.

import type { DiscoveryCluePackage } from './types';

export const codeBlueClinicDiscoveries: DiscoveryCluePackage = {
  caseTitle: 'Code Blue at the Clinic',
  packageKey: 'code-blue-clinic-discovery-v1',
  version: '1.0.0',
  status: 'pending_review',
  summary:
    'Two research threads on naloxone pharmacology and controlled-substance documentation, grounded in the clinic records.',
  leakageTerms: ['Dr. Paul Kent'],
  clues: [
    {
      key: 'cb-naloxone-antagonism',
      subjectKey: 'naloxone-opioid-antagonism',
      subjectLabel: 'Naloxone and opioid antagonism',
      referenceCategory: 'scientific_principle',
      difficulty: 'foundational',
      knowledgeStatus: 'established',
      title: 'What a response to naloxone can show',
      prompt:
        'The clinical record mentions a response after naloxone. Explain what naloxone does in the body and what a response to it does and does not establish about the substance involved.',
      context:
        'Use the clinical reference. The question concerns pharmacology, not the identity of any person in the case.',
      triggers: {
        visibleEvidence: ['scene report 17', 'witness account 17'],
        completedCheckpoints: ['motive-question-raised'],
        artifactKeys: ['sedative-overdose-naloxone-limits'],
        minDiscoveredEvidence: 3,
      },
      criteria: {
        subjectAliases: [
          'naloxone', 'opioid antagonist', 'opioid reversal', 'antagonist', 'opioid antidote',
        ],
        essentialConcepts: [
          {
            key: 'mechanism',
            aliases: [
              'opioid receptor', 'receptor antagonist', 'blocks receptors', 'displaces',
              'competes', 'reverses opioid', 'antagonizes', 'antidote',
            ],
          },
          {
            key: 'observed-response',
            aliases: [
              'response', 'reversal', 'improvement', 'breathing improves', 'sedation reverses',
              'reversed', 'wakes',
            ],
          },
          {
            key: 'interpretation-limits',
            aliases: [
              'does not identify', 'cannot identify', 'not identify the drug', 'not proof of',
              'does not prove', 'other sedatives', 'not all sedatives', 'partial response',
              'short acting', 'not a diagnosis', 'supportive care', 'co-ingestant',
            ],
          },
        ],
        optionalConcepts: [
          { key: 'clinical-context', aliases: ['respiratory depression', 'emergency care', 'opioid', 'sedative'] },
        ],
        connectionMarkers: ['case', 'clinical', 'record', 'patient', 'clinic', 'witness', 'evidence'],
        misconceptionTerms: [
          'naloxone proves the exact drug', 'response proves an opioid overdose and nothing else',
          'naloxone is a general antidote for all sedatives', 'if there is no response it was not an opioid',
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
        'Naloxone is an opioid receptor antagonist: it can rapidly reverse opioid effects such as respiratory depression. A response supports opioid involvement, but it does not identify the exact substance, dose, or intent. Other sedatives and co-ingestants can complicate the picture, the effect can be short-lived, and supportive clinical care remains essential.',
      citations: [
        {
          label: 'Opioid overdose response — clinical guidance reference',
          bibliographyRef:
            'Public-health and clinical guidance on naloxone use and its limits (edition, section and URL pending human verification)',
          sourceUrl: null,
          sourceVerified: false,
          verificationStatus: 'pending_review',
          sourceType: 'government_guidance',
          verificationNotes: 'Conservative reference only. No URL recorded; human verification required before publication.',
        },
        {
          label: 'Sedative overdose — differential caution',
          bibliographyRef:
            'Clinical toxicology literature on opioid antagonism and mixed sedative overdoses (edition and page pending human verification)',
          sourceUrl: null,
          sourceVerified: false,
          verificationStatus: 'pending_review',
          sourceType: 'peer_reviewed',
          verificationNotes: 'Conservative reference only. No URL recorded; human verification required before publication.',
        },
      ],
      unlocks: [
        {
          key: 'cb-naloxone-insight',
          kind: 'insight',
          targetRef: 'scene report 17',
          insight: 'A response narrows the pharmacology; it does not name a substance or a person.',
          followUp: 'Which record in this case could speak to what was actually administered?',
        },
        {
          key: 'cb-naloxone-question',
          kind: 'question',
          targetRef: 'sedative-overdose-naloxone-limits',
          question: 'Could another sedative have contributed even if naloxone helped?',
          whyItMatters: 'Mixed exposures are a standard caution in clinical interpretation.',
        },
        {
          key: 'cb-clinical-record-seed',
          kind: 'reality_map_seed',
          targetRef: 'witness account 17',
          title: 'Claim: the clinical response has a limited meaning',
          description: 'Open a Reality Map claim separating observed response from substance identification.',
        },
        {
          key: 'cb-rhee-review',
          kind: 'specialist_response',
          targetRef: 'clinical-toxicologist-rhee',
          specialistKey: 'clinical-toxicologist-rhee',
          prompt: 'Ask the clinical toxicologist how much weight the observed response can carry.',
        },
      ],
      evidenceRefs: ['scene report 17', 'witness account 17'],
      specialistKeys: ['clinical-toxicologist-rhee'],
    },
    {
      key: 'cb-controlled-substance-chain-of-custody',
      subjectKey: 'controlled-substance-chain-of-custody',
      subjectLabel: 'Controlled-substance chain of custody',
      referenceCategory: 'professional_standard',
      difficulty: 'intermediate',
      knowledgeStatus: 'established',
      title: 'A gap in a record is not a conclusion',
      prompt:
        'The access and medication records contain gaps. Explain what a controlled-substance chain of custody requires and why a discrepancy is a lead rather than proof of diversion.',
      context:
        'Use the compliance reference. Address the documentation standard itself, not the conduct of any named person.',
      triggers: {
        visibleEvidence: ['access log 17', 'forensic trace 17'],
        actionsPerformed: ['examine_scene_17'],
        artifactKeys: ['controlled-substance-chain-of-custody'],
        minDiscoveredEvidence: 4,
      },
      criteria: {
        subjectAliases: [
          'chain of custody', 'controlled substance', 'controlled-substance',
          'documentation trail', 'audit trail', 'medication administration record', 'mar',
        ],
        essentialConcepts: [
          {
            key: 'continuity',
            aliases: [
              'continuous record', 'continuity', 'every transfer', 'signed', 'signature',
              'who handled', 'accountability', 'handoff', 'timestamp', 'time stamp', 'date and time',
            ],
          },
          {
            key: 'reconciliation',
            aliases: [
              'count', 'inventory', 'reconcile', 'discrepancy', 'gap', 'missing entry',
              'audit', 'verify', 'cross-check', 'cross check',
            ],
          },
          {
            key: 'lead-not-proof',
            aliases: [
              'not proof', 'does not prove', 'lead', 'investigate further', 'could be clerical',
              'error', 'legitimate explanation', 'not conclude', 'need corroboration',
            ],
          },
        ],
        optionalConcepts: [
          { key: 'corroboration', aliases: ['witness', 'camera', 'pharmacy', 'regulatory', 'reporting duty'] },
        ],
        connectionMarkers: ['case', 'clinic', 'record', 'log', 'shift', 'evidence', 'patient'],
        misconceptionTerms: [
          'a gap proves diversion', 'a missing signature means theft',
          'documentation errors are always fraud', 'the record alone identifies who did it',
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
        'Controlled-substance chain of custody requires continuous, attributable documentation of handling, transfers and counts. A discrepancy, missing signature or unexplained gap is a lead to investigate and corroborate with other records; on its own it proves neither diversion nor the identity of any person.',
      citations: [
        {
          label: 'Controlled-substance documentation — professional guidance',
          bibliographyRef:
            'Healthcare guidance on controlled-substance handling, records and reconciliation (edition and URL pending human verification)',
          sourceUrl: null,
          sourceVerified: false,
          verificationStatus: 'pending_review',
          sourceType: 'government_guidance',
          verificationNotes: 'Conservative reference only. No URL recorded; human verification required before publication.',
        },
        {
          label: 'Record integrity — methodology caution',
          bibliographyRef:
            'Healthcare compliance literature on medication administration records and documentation integrity (edition and page pending human verification)',
          sourceUrl: null,
          sourceVerified: false,
          verificationStatus: 'pending_review',
          sourceType: 'reputable_org',
          verificationNotes: 'Conservative reference only. No URL recorded; human verification required before publication.',
        },
      ],
      unlocks: [
        {
          key: 'cb-custody-insight',
          kind: 'insight',
          targetRef: 'access log 17',
          insight: 'An inconsistency in a log is a question to pursue, not a verdict.',
          followUp: 'Which independent record could confirm or explain the gap?',
        },
        {
          key: 'cb-custody-question',
          kind: 'question',
          targetRef: 'controlled-substance-chain-of-custody',
          question: 'Could a routine handoff or clerical delay account for the missing entry?',
          whyItMatters: 'Alternative explanations should be tested before drawing conclusions.',
        },
        {
          key: 'cb-custody-record-seed',
          kind: 'reality_map_seed',
          targetRef: 'access log 17',
          title: 'Claim: documentation gap identified',
          description: 'Open a Reality Map claim about the gap, with its meaning explicitly left open.',
        },
        {
          key: 'cb-santos-review',
          kind: 'specialist_response',
          targetRef: 'diversion-compliance-santos',
          specialistKey: 'diversion-compliance-santos',
          prompt: 'Ask the compliance specialist which independent checks would resolve the record gap.',
        },
        {
          key: 'cb-review-medication-record',
          kind: 'action',
          targetRef: 'examine_scene_17',
          action: 'examine_scene_17',
          label: 'Review the medication record chain',
        },
      ],
      evidenceRefs: ['access log 17', 'forensic trace 17'],
      specialistKeys: ['diversion-compliance-santos'],
    },
  ],
};
