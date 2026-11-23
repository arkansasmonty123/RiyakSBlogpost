// M5-CONTENT 9/12: The scientific method and falsifiability.
// Competing arguments in philosophy of science — demarcation remains contested.

import type { ExperienceDefinition } from '../types';
import { bibliographicSource } from './source-helpers';

export const scientificMethodAndFalsifiability: ExperienceDefinition = {
  experienceKey: 'scientific-method-and-falsifiability',
  title: 'Scientific method and falsifiability',
  frameworkKey: 'scientific_reasoning',
  format: 'competing_arguments',
  knowledgeClass: 'contested_scientific',
  perspectiveClass: 'comparison',
  scopeNote:
    'A comparison of accounts of what makes a claim scientific and how theories are tested. It is a philosophy-of-science debate, not a recipe with a settled boundary.',
  traditionScope:
    'Logical positivism and Popperian falsificationism, Kuhnian historical accounts, Duhem–Quine underdetermination and later pluralist approaches.',
  intellectualPurpose:
    'To compare rival criteria for scientific claims and to see how each handles auxiliary assumptions, probabilistic theories and theory change, rather than memorising a single demarcation rule.',
  primaryQuestion: 'What distinguishes a testable scientific claim from an assertion that can accommodate any outcome?',
  introduction:
    'A useful hypothesis forbids some possible observations. If a claim is compatible with every conceivable result, it cannot be tested, and it tells us nothing about which possibilities are real. Karl Popper made this the centre of his account of science. But the obvious difficulties start quickly: a prediction rarely tests one hypothesis alone, and many scientific claims are probabilistic rather than universal. The debate about how to draw the line is still alive.',
  intellectualBackground:
    'Logical positivists sought a verification criterion of meaning; Popper replaced verification with falsifiability, arguing that theories are conjectures that can be refuted but never finally confirmed. Thomas Kuhn challenged the picture of science as a steady sequence of tests by emphasising paradigms and periods of normal science in which anomalies are routinely set aside. Pierre Duhem and later W. V. O. Quine argued that a failed test implicates a whole network of hypotheses and auxiliary assumptions, so no single statement faces experience alone. Later philosophers have offered Bayesian, realist, instrumentalist and pluralist accounts. None has ended the demarcation debate.',
  mainIdea:
    'Falsifiability is a valuable check against unfalsifiable claims, but it is not a complete account of scientific practice. Comparing it with underdetermination and historical accounts produces a more realistic set of checks: state what a claim rules out, identify the auxiliary assumptions in a test, and describe how a community actually handles anomalous results.',
  detailedExplanation:
    'Popper’s idea is compact. A universal claim has consequences that can conflict with observation; if the observation goes against the prediction, the claim is refuted. Confirming instances never prove a universal claim, because however many white swans are observed, a non-white one remains possible. This gives science an asymmetric logic: theories can be eliminated but not certified. It also gives a criterion of demarcation — a claim is scientific to the extent that it forbids observable outcomes and can therefore be tested. The strength of the account is that it explains why ad hoc adjustments that make a theory compatible with everything are scientifically suspect.\n\nThe Duhem–Quine objection is the most important complication. In practice, a prediction is derived from a hypothesis plus background assumptions about instruments, initial conditions, measurement procedures and auxiliary theories. When the prediction fails, something in that bundle is wrong, but the test by itself does not say which item. A scientist can always protect a favoured core claim by revising an auxiliary assumption, and sometimes that is the correct move, as when an instrument is later found to have been miscalibrated. So falsification is a rational practice only when there is some discipline about which assumptions may be revised and why. This is not a objection that destroys Popper’s insight; it is a reminder that a test bears on a network rather than an isolated sentence.\n\nKuhn’s historical account adds a different challenge. In periods of normal science, practitioners work within a shared framework of assumptions, standards and exemplars; anomalies are usually set aside as errors or as puzzles for later, not treated as immediate refutations. When enough anomalies accumulate and an alternative framework becomes available, a period of crisis and possible theory change follows. Kuhn’s work suggests that the simple picture of scientists constantly trying to falsify their theories does not describe most actual research. His account has been criticised for sliding toward relativism and for understating the evidential reasons that can make one theory better than another; later work has attempted to preserve the historical insight while allowing rational comparison.\n\nA further complication is probabilistic claims. A statement such as "this treatment reduces the risk by a given amount" is not refuted by a single contrary case; it is assessed through distributions, sample sizes, study design and statistical models. Falsifiability in the simple universal sense is not the right standard here. Similarly, a claim may be testable in principle but not testable with the resources available, and a claim may be framed so vaguely that it is unclear what would count against it. These cases favour a pluralist picture in which falsifiability, predictive accuracy, explanatory scope, coherence with other well-supported claims and practical testability all play a role. The criteria can conflict, and the history of science contains episodes where a theory was abandoned for reasons that were not a single decisive refutation.\n\nThe practical takeaway is a set of questions rather than a formula. Ask what observation the claim would rule out. Ask which auxiliary assumptions the test depends on and whether they have independent support. Ask whether a community would treat a contrary result as a refutation or as a puzzle, and why. Ask how the claim compares with rivals in predictive and explanatory reach. These questions are usefully applied to any reasoning context, including an investigation, provided they are not smuggled in as a claim that one side has already been scientifically established. The philosophical debate supplies discipline, not a verdict.',
  sections: [
    {
      heading: 'The falsifiability criterion and its appeal',
      body: 'A scientific claim should forbid some possible observations; a claim compatible with every outcome cannot be tested. This is a powerful check against ad hoc protection of a theory and against assertions that explain everything after the fact. It is not, however, a mechanical test that sorts all claims cleanly.',
    },
    {
      heading: 'Underdetermination and auxiliary assumptions',
      body: 'Duhem and Quine showed that a failed prediction implicates a bundle of hypotheses and background assumptions. Deciding which item to revise requires independent reasons, not just the failed test. Good scientific practice includes an account of why an auxiliary assumption is being changed.',
    },
    {
      heading: 'Historical and pluralist challenges',
      body: 'Kuhn argued that normal science is puzzle-solving within a framework rather than continuous falsification. Probabilistic theories and debates about demarcation further weaken any single criterion. Contemporary accounts often combine predictive success, explanatory power, coherence and testability.',
    },
  ],
  historicalContext:
    'Popper’s The Logic of Scientific Discovery appeared in German in 1934 and in English in 1959. Duhem’s work on physical theory appeared in the early twentieth century, and Quine’s later formulation of underdetermination is associated with mid-century empiricism. Kuhn’s The Structure of Scientific Revolutions (1962) reshaped the discussion by adding a historical dimension. Subsequent decades produced Bayesian and pluralist accounts, and the question of demarcation remains contested.',
  epistemicBreakdown: {
    'Established about the debate':
      'Popper proposed falsifiability as a demarcation criterion; Duhem and Quine raised the problem of auxiliary assumptions; Kuhn emphasised historical paradigms. These are well-documented positions.',
    'Interpretation':
      'Authors differ on whether falsifiability is a criterion of meaning, of scientific status, or simply a useful methodological norm.',
    'Contested arguments':
      'Whether a satisfactory demarcation criterion exists at all, and how to weigh predictive success against explanatory virtues, remain disputed.',
    'Personal or school perspective':
      'Choosing among Popperian, Kuhnian, Bayesian and pluralist accounts involves commitments about rationality and about what scientific inquiry is for.',
    'Use in an investigation':
      'Ask what a claim would rule out and which assumptions a test depends on. Do not present a philosophical position as settled science about a case.',
  },
  keyConcepts: [
    'falsifiability', 'demarcation', 'auxiliary hypotheses', 'underdetermination',
    'paradigm', 'normal science', 'probabilistic testing', 'pluralist criteria',
  ],
  supportingSources: [
    bibliographicSource({
      label: 'Popper, K., The Logic of Scientific Discovery (German original 1934; English 1959)',
      author: 'Karl Popper',
      title: 'The Logic of Scientific Discovery',
      sourceType: 'textbook',
      verificationNotes: 'Modern editions are copyrighted; summary only. Exact citation and URL pending verification.',
    }),
    bibliographicSource({
      label: 'Kuhn, T. S., The Structure of Scientific Revolutions (1962)',
      author: 'Thomas S. Kuhn',
      title: 'The Structure of Scientific Revolutions',
      sourceType: 'textbook',
      verificationNotes: 'Bibliographic citation only; edition and link require human verification before exposure.',
    }),
    bibliographicSource({
      label: 'Duhem, P., The Aim and Structure of Physical Theory (French 1906; English 1954)',
      author: 'Pierre Duhem',
      title: 'The Aim and Structure of Physical Theory',
      sourceType: 'textbook',
      verificationNotes: 'Citation from working notes; translation details and URL pending confirmation.',
    }),
  ],
  limitations: [
    'Falsifiability alone does not handle probabilistic claims or the role of auxiliary assumptions.',
    'A historical account of science describes practice but does not by itself tell us which theory is better supported.',
    'Demarcation criteria can be applied rhetorically to exclude views without engaging with their content.',
  ],
  counterarguments: [
    'A Popperian may argue that the complications are refinements of falsificationism rather than refutations of it.',
    'A Kuhnian may argue that no formal criterion captures the actual rationality of theory choice.',
    'A Bayesian may argue that confirmation and falsification are both special cases of rational belief updating.',
  ],
  commonMisconceptions: [
    'That falsifiability is a simple rule that settles which claims are scientific.',
    'That a single failed observation refutes a theory outright.',
    'That Kuhn’s account means scientific theory choice is arbitrary.',
  ],
  reflectionQuestions: [
    'What observation would this claim rule out, and is that observation actually possible?',
    'Which auxiliary assumptions does your test rely on, and what independent support do they have?',
    'How would you explain a case where a community kept a theory despite contrary results?',
  ],
  activities: [
    'Take a claim you accept, state what it forbids, and list the background assumptions a test of it would require.',
  ],
  recommendationTags: [
    'scientific-method', 'falsifiability', 'method', 'theory-choice', 'evidence',
    'competing-arguments', 'reasoning', 'contested',
  ],
  relatedExperienceKeys: ['problem-of-induction', 'confirmation-bias', 'historical-source-reliability'],
  relatedSpecialistKeys: ['forensic-scientist-priya', 'fire-investigator-delgado'],
  relatedArtifactKeys: ['nfpa-921-origin-cause-method', 'accelerant-detection-limits'],
  relatedCaseTitles: ['Blaze at Dawn Bakery', 'Fire in the Archive', 'Code Blue at the Clinic'],
  estimatedMinutes: 16,
  difficulty: 'advanced',
  displayOrder: 9,
  status: 'published',
};
