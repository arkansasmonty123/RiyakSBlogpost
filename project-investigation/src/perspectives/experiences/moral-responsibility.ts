// M5-CONTENT 11/12: Moral responsibility.
// Competing arguments about agency, voluntariness and luck — no case application asserted.

import type { ExperienceDefinition } from '../types';
import { bibliographicSource } from './source-helpers';

export const moralResponsibility: ExperienceDefinition = {
  experienceKey: 'moral-responsibility',
  title: 'Moral responsibility',
  frameworkKey: 'ethical_reasoning',
  format: 'competing_arguments',
  knowledgeClass: 'philosophical',
  perspectiveClass: 'comparison',
  scopeNote:
    'A comparison of philosophical accounts of when a person is an appropriate target of praise or blame. It distinguishes causal, legal and moral responsibility without applying them to any case.',
  traditionScope:
    'Aristotelian virtue ethics, modern deontological and consequentialist accounts, and contemporary debates about moral luck; other traditions frame agency differently.',
  intellectualPurpose:
    'To separate the conditions of responsible agency from causal contribution and from legal liability, and to examine how luck and circumstance complicate each account.',
  primaryQuestion: 'Under what conditions is a person an appropriate subject of moral praise or blame?',
  introduction:
    'If a harmful outcome occurs, several questions can be asked. Who causally contributed to it? Who is legally liable for it? And who is morally responsible for it? These questions are related but not identical. A person can cause an outcome without being blameworthy, and can be blameworthy for an attempt that failed. Philosophical accounts of responsibility try to say what makes the third question distinct.',
  intellectualBackground:
    'Aristotle discussed voluntary and involuntary action in the Nicomachean Ethics, distinguishing acting by force, acting through ignorance and acting with knowledge in a chosen act. Later accounts emphasised rational control, the capacity to do otherwise, or the expression of one’s character. Thomas Nagel’s discussion of moral luck argued that our judgements of a person often depend on factors outside their control, such as whether a careless act happened to produce harm. Judea Pearl and others have since discussed responsibility in causal terms, while legal theory distinguishes standards of liability from moral evaluation. The debate remains open, and no philosophical account settles a legal finding.',
  mainIdea:
    'Responsibility judgements depend on a background account of agency: what capacities a person had, what they knew, what they chose and how much of the outcome was within their control. Different theories privilege different elements, and moral luck exposes the tension between control and the judgements we actually make.',
  detailedExplanation:
    'Begin with the control condition. Many accounts hold that a person is morally responsible for an act only if it was within their control — they could have done otherwise, or at least the act issued from their own rational agency in a way that makes it theirs. Aristotle’s treatment of voluntariness is an early and influential version: an act done under compulsion or through ignorance that the agent could not overcome is treated differently from one done knowingly and by choice. The detail matters, because ignorance is not always exculpatory; if a person ignored an obvious risk because they did not want to know, the ignorance may itself be part of what is being assessed.\n\nA character-based account shifts the emphasis. On a virtue-ethical reading, an action matters because it expresses the agent’s character, dispositions and practical wisdom. A person who acts from honesty or courage is praiseworthy not merely because the act had good consequences, but because of what the act reveals about how they perceive and respond to the world. This account handles failed attempts well: a person can show the same commitment in an unsuccessful act. It also raises difficulties: character is shaped by upbringing and circumstance, so it is unclear how much of it is "up to" the person in the relevant sense.\n\nThe problem of moral luck, associated with Nagel and Bernard Williams, presses on the control condition. We judge a reckless driver who injures someone more harshly than one who drives the same way without consequence, even though the difference may be a matter of timing and whether a pedestrian happened to be present. This is "result luck". "Circumstantial luck" concerns the situations a person faces, and "constitutive luck" concerns the dispositions and capacities they have. If responsibility requires control, these kinds of luck seem to undermine many of our judgements; if it does not, the control condition looks too weak to explain why blame is justified. Responses include rejecting the control condition, accepting that responsibility comes in degrees, or distinguishing what a person is responsible for from how much they can be blamed.\n\nCausal and legal responsibility must be kept distinct. A causal account asks whether an act or omission made a difference to an outcome under a suitable counterfactual or structural model. Legal liability adds rules about duties, standards of proof and admissible evidence, and it is designed for social decisions under uncertainty. Moral responsibility adds an evaluation of the agent’s agency, knowledge and character. A philosophical argument can clarify these distinctions, but it cannot determine a legal finding, and a legal finding does not settle the moral question. Conflating them is a common source of error when people reason about harmful events.\n\nIn an investigative context the appropriate use is conceptual hygiene. When someone says a person is "responsible", ask which sense is intended: causal contribution, legal liability, or moral evaluation. Ask what the person knew, what options were available, and which features of the outcome were due to circumstances beyond their control. Keep the moral question separate from the factual question of what happened, and keep both separate from a decision about what ought to be done now. Theoretical accounts of responsibility offer frameworks for asking; they do not supply answers about any particular situation.',
  sections: [
    {
      heading: 'Three senses of responsibility',
      body: 'Causal responsibility concerns contribution to an outcome. Legal responsibility concerns liability under a rule and a standard of proof. Moral responsibility concerns whether a person is an appropriate target of praise or blame given what they knew, chose and could control. Distinguishing them prevents a finding in one domain from being treated as an answer in another.',
    },
    {
      heading: 'Control, character and luck',
      body: 'Control accounts emphasise choice and the capacity to do otherwise. Character accounts emphasise what an action expresses about a person’s dispositions. Moral luck cases show that outcomes and circumstances often depend on factors no one controls, which puts pressure on both accounts and explains why responsibility judgements can be unstable.',
    },
    {
      heading: 'What philosophy cannot settle',
      body: 'No theory of responsibility determines a legal verdict or establishes what occurred in a particular situation. The theories clarify the questions and the assumptions behind a judgement; the factual and normative work still has to be done with the material available.',
    },
  ],
  historicalContext:
    'Aristotle’s Nicomachean Ethics, Book III, discusses voluntariness, choice and ignorance. Early modern and Kantian accounts emphasised rational agency and the will. Nagel’s "Moral Luck" (1976), later reprinted in Mortal Questions (1979), brought the role of luck to the centre of contemporary debate, building on related work by Bernard Williams. Legal theory and causal modelling have since contributed distinct analyses. The discussion is a live philosophical debate rather than a settled doctrine.',
  epistemicBreakdown: {
    'Established about the literature':
      'Aristotle discusses voluntary and involuntary action in Book III of the Nicomachean Ethics, and moral luck is a well-established topic in contemporary ethics.',
    'Interpretation':
      'Readers of Aristotle disagree about how to classify acts done through ignorance, and later theories reinterpret his distinctions in different terms.',
    'Contested argument':
      'Whether moral responsibility requires control, whether it admits of degrees, and how luck affects blame are all disputed.',
    'Personal or tradition perspective':
      'Accounts of responsibility express different commitments about agency, character and fairness; none is a neutral definition that all traditions accept.',
    'Use in an investigation':
      'Use the distinctions to ask which sense of responsibility is at issue. Do not use a philosophical position to assert a finding about any person or event.',
  },
  keyConcepts: [
    'voluntariness', 'causal responsibility', 'legal liability', 'moral luck',
    'control condition', 'character', 'agency', 'degrees of blame',
  ],
  supportingSources: [
    bibliographicSource({
      label: 'Aristotle, Nicomachean Ethics, Book III — ancient text on voluntariness and choice',
      author: 'Aristotle',
      title: 'Nicomachean Ethics, Book III',
      sourceType: 'other',
      verificationStatus: 'verified',
      sourceVerified: true,
      url: 'https://www.gutenberg.org/ebooks/8438',
      verificationNotes: 'Verified as public-domain text (Project Gutenberg eBook #8438). Book III discusses voluntariness and choice. Translations vary; summary only, no direct quotation relied on.',
    }),
    bibliographicSource({
      label: 'Nagel, T., "Moral Luck", Proceedings of the Aristotelian Society, Supplementary Volume 50 (1976); reprinted in Mortal Questions (1979)',
      author: 'Thomas Nagel',
      title: 'Moral Luck',
      sourceType: 'peer_reviewed',
      verificationNotes: 'Citation from working notes; exact pagination and any link require human verification before exposure.',
    }),
  ],
  limitations: [
    'Philosophical accounts of responsibility do not settle legal questions or factual disputes.',
    'Judgements about character and control are themselves vulnerable to bias and incomplete information.',
    'The traditions that emphasise character, duty or consequence answer the question differently and cannot simply be merged.',
  ],
  counterarguments: [
    'A control theorist may argue that blame without control is unfair regardless of how serious the outcome.',
    'A character theorist may argue that what an act reveals about a person matters more than whether they could have done otherwise.',
    'A critic of moral luck may argue that the phenomenon shows our ordinary judgements need revision rather than that control is irrelevant.',
  ],
  commonMisconceptions: [
    'That causal contribution and moral blame are the same thing.',
    'That a philosophical argument about responsibility determines a legal outcome.',
    'That luck, if it plays any role, removes the possibility of moral evaluation altogether.',
  ],
  reflectionQuestions: [
    'Which sense of responsibility is being used when someone says a person is responsible?',
    'What did the person know, and what alternatives were actually available to them?',
    'Which part of the outcome depended on circumstances no one could control?',
  ],
  activities: [
    'Write the same event under three descriptions: causal contribution, legal liability and moral evaluation; note where they diverge.',
  ],
  recommendationTags: [
    'ethics', 'responsibility', 'agency', 'competing-arguments', 'judgement',
    'reflection', 'values', 'distinctions',
  ],
  relatedExperienceKeys: ['the-trolley-problem', 'stoic-dichotomy-of-control', 'ship-of-theseus'],
  relatedSpecialistKeys: ['diversion-compliance-santos', 'safety-compliance-hale'],
  relatedArtifactKeys: ['controlled-substance-chain-of-custody', 'fire-safety-records-and-compliance'],
  relatedCaseTitles: ['Code Blue at the Clinic', 'Blaze at Dawn Bakery', 'Fall from the Rooftop'],
  estimatedMinutes: 15,
  difficulty: 'advanced',
  displayOrder: 11,
  status: 'published',
};
