// M5-CONTENT 3/12: The problem of induction.
// Scientific controversy about the justification of inductive inference.

import type { ExperienceDefinition } from '../types';
import { bibliographicSource } from './source-helpers';

export const problemOfInduction: ExperienceDefinition = {
  experienceKey: 'problem-of-induction',
  title: 'The problem of induction',
  frameworkKey: 'scientific_reasoning',
  format: 'scientific_controversy',
  knowledgeClass: 'contested_scientific',
  perspectiveClass: 'framework_primer',
  scopeNote:
    'A philosophical problem about what justifies extrapolating from observed cases to unobserved ones. It concerns the warrant for inference, not whether ordinary inductive reasoning is useful.',
  traditionScope:
    'Enlightenment empiricism through contemporary philosophy of science; falsificationist, Bayesian, pragmatist and reliabilist responses disagree.',
  intellectualPurpose:
    'To distinguish the practical success of an inference from the justification offered for it, and to compare rival accounts of why predictions from past observations are reasonable.',
  primaryQuestion: 'What justifies expecting that what has happened in observed cases will also happen in unobserved ones?',
  introduction:
    'Every day we infer from what we have seen to what we have not: that a door will open as it did yesterday, that a measurement method will behave as before. Hume pressed a simple question — what reason do we have for such expectations? The answer "because it has always worked" itself relies on the assumption that the future will resemble the past, which is precisely what needs justification. The problem is not a reason to stop making predictions; it is a reason to be precise about what licenses them.',
  intellectualBackground:
    'Hume argued in the eighteenth century that inductive conclusions are not justified by pure reason, since their denial is conceivable without contradiction, nor by past experience, since that would presuppose the very uniformity it is meant to establish. He offered custom and habit as the psychological explanation of why we nevertheless expect continuity. Popper later attempted to avoid induction altogether by framing science as conjecture and refutation, though critics argue that selecting and applying theories still relies on inductive considerations. Bayesian approaches treat induction as updating degrees of belief given a prior and evidence; pragmatist and reliabilist approaches defend induction by its role in successful practices or by the reliability of the processes producing it. None of these responses is universally accepted.',
  mainIdea:
    'A prediction can be well-supported in practice while its philosophical justification remains contested. The useful consequence for reasoning is to ask what an inference assumes, what would defeat it, and which competing account of the inference better explains its successes.',
  detailedExplanation:
    'The classic formulation distinguishes two kinds of claim. A deductive argument is one where, if the premises are true, the conclusion cannot be false. An inductive inference is different: the premises describe observed cases, and the conclusion says something about cases not yet observed. The move from "all observed swans have been white" to "the next swan will be white" is not deductively valid, because nothing in the premises makes a non-white swan impossible. Hume’s challenge is to find a premise that would make the inference valid without circularity. Appealing to the observed regularity will not do, because that appeal assumes that observed regularities persist. Appealing to a principle of uniformity of nature faces the same difficulty: how is that principle itself known? If by experience, the argument is circular; if by reason alone, we need an account of why reason requires it.\n\nOne response is to deny that science needs induction in the form Hume described. Popper’s falsificationist picture presents theories as bold conjectures that are tested by attempts at refutation; a theory that survives is not thereby proved, only not yet eliminated. This is attractive because it explains how a single counterinstance can overturn a universal claim without needing any premise about the future. The difficulty is that actual scientific practice uses confirmation, model selection and prediction, all of which appear to involve more than failure to refute. Choosing between two theories that both survived the same tests seems to require judging which one is better supported — an inductive-sounding judgement.\n\nBayesian accounts reinterpret the inference as a rational update. An agent begins with prior degrees of belief, observes evidence, and updates according to a rule that makes belief strength track the likelihood of the evidence under competing hypotheses. On this view the "problem" becomes a question about the justification of priors and the choice of a likelihood model, which are substantive and sometimes contentious assumptions rather than an outright defect. Critics reply that the framework presupposes that past frequencies are relevant to future expectations and that priors cannot be chosen without extra-evidential commitments. The Bayesian response is that those commitments can be made explicit and their consequences examined, which is an improvement over leaving them implicit.\n\nPragmatist and reliabilist responses take a different route. A pragmatist may argue that the justification of induction is internal to the practice of inquiry: the rules that work in guiding successful action are the rules we are warranted in using, and asking for a non-circular proof demands something no inquiry can provide. A reliabilist may argue that a belief is justified when it is produced by a process that is in fact reliable, so induction is justified if the cognitive process of generalising from experience reliably yields true conclusions in the relevant environment. Both responses shift the question from "can we prove uniformity?" to "what makes a method of inference trustworthy?" — and both must answer objections about how reliability or practical success is known without circularity.\n\nFor an investigation, the practical lesson is not that generalisation is forbidden. It is that every generalisation carries an implicit premise about continuity or representativeness, and that premise can be examined. Ask whether the cases you have observed are a fair sample of the cases you are extrapolating to, whether conditions have changed, and what would count as a breakdown of the pattern. Different responses to the problem recommend different checks: falsificationist habits look for the decisive counterinstance, Bayesian habits make priors and likelihoods explicit, and reliabilist habits examine the track record of the method that produced the belief. These are complementary disciplines rather than mutually exclusive answers.',
  sections: [
    {
      heading: 'Why the puzzle is not a verdict on induction',
      body: 'Hume’s argument challenges a certain kind of justification, not the usefulness of the practice. Saying that an inference cannot be deductively certified does not make it irrational or useless. The constructive question is what standard of support is appropriate for an inference from observed to unobserved cases, and how that standard can be applied honestly.',
    },
    {
      heading: 'Rival responses compared',
      body: 'Falsificationism emphasises elimination and refuses to treat survival as proof. Bayesianism makes priors, likelihoods and updating explicit. Pragmatism grounds warrant in the role inference plays in successful inquiry. Reliabilism asks whether the process producing the belief is trustworthy. Each response clarifies part of the practice and each leaves a further question unanswered.',
    },
    {
      heading: 'Practical checks that follow',
      body: 'Check the representativeness of the observed cases, look explicitly for changed conditions, ask what observation would break the pattern, and state the assumption of continuity you are relying on. These checks do not solve the philosophical problem, but they make an ordinary inference answerable to reasons rather than habit alone.',
    },
  ],
  historicalContext:
    'Hume’s Enquiry Concerning Human Understanding (1748) gave the classic statement of the problem. Kant subsequently described the challenge as awakening him from dogmatic sleep and proposed a transcendental account of the conditions of experience. Popper’s The Logic of Scientific Discovery advanced falsificationism as an alternative, and twentieth-century debates about confirmation, probability and scientific method produced the Bayesian and pragmatist responses. The dispute remains active in philosophy of science and statistics.',
  epistemicBreakdown: {
    'Established about the problem':
      'Hume formulated a challenge to the justification of inferences from observed to unobserved cases. The challenge is discussed throughout modern epistemology and philosophy of science.',
    'Interpretation':
      'The same problem has been read as a sceptical argument, as a request for a naturalised account of inference, and as a prompt to reform scientific method.',
    'Contested arguments':
      'Falsificationist, Bayesian, pragmatist and reliabilist responses each claim to answer the challenge; none is generally accepted as decisive.',
    'Personal or tradition perspective':
      'Choosing a response involves commitments about rationality, probability and the aims of inquiry that are themselves philosophically defended rather than empirically measured.',
    'Use in an investigation':
      'Use the problem to surface the continuity assumptions behind a generalisation and to look for what would defeat it. Do not treat it as a claim that prediction is impossible.',
  },
  keyConcepts: [
    'inductive inference', 'uniformity of nature', 'scepticism', 'falsificationism',
    'Bayesian updating', 'priors and likelihoods', 'reliabilism', 'pragmatist justification',
  ],
  supportingSources: [
    bibliographicSource({
      label: 'Hume, D., An Enquiry Concerning Human Understanding, Section IV (1748)',
      author: 'David Hume',
      title: 'An Enquiry Concerning Human Understanding',
      sourceType: 'other',
      verificationStatus: 'verified',
      sourceVerified: true,
      url: 'https://www.gutenberg.org/ebooks/9662',
      verificationNotes: 'Verified as public-domain text (Project Gutenberg eBook #9662). Section IV presents Hume’s sceptical doubts concerning induction. Summary only; no direct quotation relied on.',
    }),
    bibliographicSource({
      label: 'Popper, K., The Logic of Scientific Discovery (German original 1934; English 1959)',
      author: 'Karl Popper',
      title: 'The Logic of Scientific Discovery',
      sourceType: 'textbook',
      verificationNotes: 'Modern editions are copyrighted; summary only. Exact citation and link require human verification.',
    }),
  ],
  limitations: [
    'The philosophical debate does not yield a single rule that tells an investigator which generalisation to accept.',
    'Formal treatments presuppose a probability framework that may not fit every kind of case reasoning.',
    'Emphasising the problem can encourage indiscriminate doubt about well-supported regularities.',
  ],
  counterarguments: [
    'A falsificationist may argue that science does not rely on induction at all, only on conjectures and attempted refutations.',
    'A Bayesian may argue that the problem dissolves once beliefs and evidence are represented probabilistically and priors are made explicit.',
    'A pragmatist may argue that asking for a non-circular justification misunderstands how the practice of inquiry warrants its own rules.',
  ],
  commonMisconceptions: [
    'That Hume showed induction is invalid and therefore useless.',
    'That a large number of confirming observations closes the problem of justification.',
    'That falsifiability is itself an uncontested and complete solution to the problem.',
  ],
  reflectionQuestions: [
    'Which unstated assumption of continuity does one of your current generalisations depend on?',
    'What observation would make you abandon a pattern you currently treat as stable?',
    'How would you explain your prior expectations to someone who does not share them?',
  ],
  activities: [
    'Take a pattern you treat as reliable and write down the conditions under which you believe it would fail.',
  ],
  recommendationTags: [
    'scientific-method', 'probability', 'generalisation', 'method', 'evidence',
    'reasoning', 'contested', 'reflection',
  ],
  relatedExperienceKeys: ['scientific-method-and-falsifiability', 'confirmation-bias', 'historical-source-reliability'],
  relatedSpecialistKeys: ['forensic-scientist-priya', 'clinical-toxicologist-rhee'],
  relatedArtifactKeys: ['trace-transfer-and-secondary-transfer'],
  relatedCaseTitles: ['Code Blue at the Clinic', 'The Midnight Heist', 'Fire in the Archive'],
  estimatedMinutes: 16,
  difficulty: 'advanced',
  displayOrder: 3,
  status: 'published',
};
