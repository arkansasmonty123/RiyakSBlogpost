// M5-CONTENT 10/12: Historical source reliability.
// Source criticism illustrated by a documented forgery episode.

import type { ExperienceDefinition } from '../types';
import { bibliographicSource } from './source-helpers';

export const historicalSourceReliability: ExperienceDefinition = {
  experienceKey: 'historical-source-reliability',
  title: 'Historical source reliability',
  frameworkKey: 'historical_interpretation',
  format: 'historical_episode',
  knowledgeClass: 'historical',
  perspectiveClass: 'case_bridge',
  scopeNote:
    'An episode in the history of source criticism used to show how documents are authenticated and contextualised. The method manages uncertainty; it does not guarantee certainty.',
  traditionScope:
    'Western historiography and archival practice from early modern philology to modern source criticism, with principles that travel across archival traditions.',
  intellectualPurpose:
    'To practise classifying a source by genre, provenance and purpose, and to distinguish what a document literally records from what a reader infers from it.',
  primaryQuestion: 'What has to be established about a source before it can be used as evidence for a claim?',
  introduction:
    'In the fifteenth century, Lorenzo Valla argued that a document granting broad temporal authority to a bishopric was a forgery, using linguistic and historical evidence. The episode is a classic illustration of source criticism: a document can be impressive, authoritative and useful to powerful institutions, yet still fail the tests that historians apply. The lesson is not that documents are generally false, but that trust must be earned by checking provenance, context and corroboration.',
  intellectualBackground:
    'Valla’s declamation on the alleged Donation of Constantine was written in 1440 and argued from language, anachronism and internal consistency. The humanist philological tools he helped develop became part of a broader tradition of diplomatic and archival criticism. In the twentieth century, historians such as Marc Bloch reflected explicitly on the craft of the historian, and modern manuals such as Howell and Prevenier’s work on reliable sources systematised questions of provenance, genre and corroboration. The principles are general — who produced this, when, for whom, with what means and to what end — even if particular conclusions about particular documents remain revisable.',
  mainIdea:
    'A source is evidence only relative to a question. External criticism asks whether a document is what it purports to be; internal criticism asks what its content can be trusted to report. Both require context and, where possible, comparison with independent accounts.',
  detailedExplanation:
    'Historians commonly distinguish two tasks. External criticism establishes the identity and circumstances of a document: when it was made, by whom, in what form, and through what chain of transmission it reached the present. A copy made centuries later can preserve valuable material, but its distance from the original matters, as do the interests of the copyist and the conditions of preservation. Internal criticism then asks about the content: what the author could have known, what their purpose and audience were, which parts are observation and which are judgement, and where the language reflects a later period than the events described. Anachronism — a word, institution or practice that belongs to a later time — can be a strong signal, though it requires careful knowledge of the period.\n\nThe Donation of Constantine is useful because the case combines several kinds of check. The document purported to record an imperial grant made in the fourth century. Valla argued that its Latin and its legal and historical details did not fit that period; later scholars added further philological and diplomatic arguments. The document’s acceptance over centuries also illustrates an important point: long-standing institutional use is not evidence of authenticity. A source can be cited, copied and relied upon for generations and still be later than it claims. Conversely, a document shown to be a forgery can remain historically valuable — as evidence of the concerns of the period in which it was produced and of the uses to which it was put.\n\nCorroboration is the next step, and it is easy to overstate. An account is strengthened when an independent source agrees, but "independent" must be checked: two chronicles may draw on the same lost original, and two officials may repeat the same rumour. Agreement can be derivative rather than confirmatory. Conversely, conflict between sources is not a defect to be erased; it can reveal differing standpoints, purposes or access. The historian’s job is to explain the conflict where possible and to mark it where it cannot be resolved. A reconstruction that smooths away every discrepancy is usually less trustworthy than one that says plainly where the record is divided.\n\nSilences in the archive matter as much as present records. Surviving documents disproportionately represent the literate, the institutional and the powerful. A missing mention is therefore weak evidence that an event did not occur, and a single surviving account may be all that remains of a life that was never recorded in its own words. Modern historians also attend to the genre of a source: a legal plea, a private letter, a chronicle and a retrospective memoir make different kinds of claims and require different readings. Treating all documents as if they were neutral reports is a category error.\n\nThe transfer to an investigation is direct but bounded. For any record, ask who made it, when, for what purpose, and through what hands it passed. Ask what the author was positioned to know and what they were motivated to emphasise. Compare with material that does not share the same origin, and check whether apparent agreement is independent. State plainly what the record does not settle. These practices help manage uncertainty; they do not turn a fragmentary record into certainty, and they do not by themselves establish what occurred. Source criticism is a discipline of warranted caution, not a machine for producing facts.',
  sections: [
    {
      heading: 'External and internal criticism',
      body: 'External criticism establishes a document’s identity, date, author and transmission. Internal criticism asks what its content can be trusted to report: the author’s access, purpose and audience, and the difference between observation and interpretation. Both are needed; a perfectly authenticated document can still be a poor report of the events it describes.',
    },
    {
      heading: 'The forgery episode and its lesson',
      body: 'Valla’s challenge to the Donation of Constantine used linguistic and historical anachronism to question authenticity. The document’s long institutional acceptance shows that repeated citation is not verification. A text shown to be later than it claims can still be valuable evidence about the time and purposes of its actual production.',
    },
    {
      heading: 'Corroboration, conflict and silence',
      body: 'Independent agreement strengthens an account; derivative agreement does not. Conflict between sources can be informative and should not be smoothed over. Absence from the record is weak evidence of absence from events, because archives preserve some voices far better than others.',
    },
  ],
  historicalContext:
    'Lorenzo Valla’s De falso credita et ementita Constantini Donatione declamatio was composed in 1440 and is a landmark in textual criticism. The humanist recovery and scrutiny of ancient texts shaped later archival and diplomatic methods. Marc Bloch’s The Historian’s Craft, written in the 1940s and published posthumously, reflected on the historian’s practical reasoning, and Howell and Prevenier’s From Reliable Sources (2001) is a modern teaching reference. The general principles — provenance, context, corroboration and attention to genre — are widely shared in historical practice.',
  epistemicBreakdown: {
    'Established knowledge':
      'Valla composed a critical declamation on the Donation of Constantine in 1440. Historiographic method uses provenance, context, genre and corroboration as standard checks.',
    'Interpretation':
      'The relative weight of philological, diplomatic and contextual arguments is interpreted differently by different scholars, and the episode is used to teach different methodological lessons.',
    'Contested arguments':
      'Some conclusions about particular documents remain debated, and historians disagree about how far source criticism can reconstruct past events.',
    'Tradition perspective':
      'Archival traditions differ in how they classify documents and in what they treat as sufficient corroboration; the principles here are a general introduction, not a single school’s ruling.',
    'Use in an investigation':
      'Apply provenance and corroboration questions to records you have already encountered. Do not treat a method as evidence for a particular account of a case.',
  },
  keyConcepts: [
    'provenance', 'external criticism', 'internal criticism', 'anachronism',
    'corroboration', 'source genre', 'archive silences', 'contextualization',
  ],
  supportingSources: [
    bibliographicSource({
      label: 'Valla, L., De falso credita et ementita Constantini Donatione declamatio (1440)',
      author: 'Lorenzo Valla',
      title: 'De falso credita et ementita Constantini Donatione declamatio',
      sourceType: 'other',
      verificationNotes: 'Historical citation from working notes; exact edition, translation and URL pending verification.',
    }),
    bibliographicSource({
      label: 'Bloch, M., The Historian’s Craft (French original 1941; English 1949)',
      author: 'Marc Bloch',
      title: 'The Historian’s Craft',
      sourceType: 'textbook',
      verificationNotes: 'Bibliographic citation only; edition and link require human verification.',
    }),
    bibliographicSource({
      label: 'Howell, M. & Prevenier, W., From Reliable Sources (2001) — modern teaching reference',
      author: 'Martha Howell and Walter Prevenier',
      title: 'From Reliable Sources',
      sourceType: 'textbook',
      verificationNotes: 'Modern copyrighted work; summary only, no excerpt. Citation details and URL pending verification.',
    }),
  ],
  limitations: [
    'Source criticism manages uncertainty; it cannot guarantee that a reconstruction is complete or exact.',
    'Applying it well requires period knowledge that may not be available in the moment.',
    'A focus on documents can undervalue oral, material and other non-textual records.',
  ],
  counterarguments: [
    'Some historians argue that literary and narrative qualities of a source are themselves evidence about meaning, not merely obstacles to verification.',
    'Others hold that rigorous source criticism can still be combined with a realist claim about recovering past events.',
    'A further objection notes that archival silences can make confident conclusions about absence particularly unsafe.',
  ],
  commonMisconceptions: [
    'That an early or officially stored document is automatically more reliable.',
    'That when two sources agree, the agreement is necessarily independent confirmation.',
    'That proving a document false makes it historically worthless.',
  ],
  reflectionQuestions: [
    'For a record you have encountered, who made it and what were they positioned to know?',
    'Which parts of the record are observation and which are interpretation after the fact?',
    'What voice is absent from the surviving material, and how does that affect your conclusion?',
  ],
  activities: [
    'Choose a document, write its provenance and purpose in three lines, then list one claim it cannot support.',
  ],
  recommendationTags: [
    'historical', 'source-criticism', 'provenance', 'documents', 'corroboration',
    'case-bridge', 'evidence', 'method',
  ],
  relatedExperienceKeys: ['ship-of-theseus', 'collective-memory', 'problem-of-induction'],
  relatedSpecialistKeys: ['insurance-analyst-miriam', 'emergency-docs-owen'],
  relatedArtifactKeys: ['gala-loan-inventory-condition-report', 'medication-administration-record-integrity'],
  relatedCaseTitles: ['The Midnight Heist', 'Fire in the Archive', 'The Clocktower Alibi'],
  estimatedMinutes: 14,
  difficulty: 'intermediate',
  displayOrder: 10,
  status: 'published',
};
