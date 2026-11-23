// M5-CONTENT 5/12: The trolley problem.
// Ethical dilemma for examining competing values — no correct answer supplied.

import type { ExperienceDefinition } from '../types';
import { bibliographicSource } from './source-helpers';

export const theTrolleyProblem: ExperienceDefinition = {
  experienceKey: 'the-trolley-problem',
  title: 'The trolley problem',
  frameworkKey: 'ethical_reasoning',
  format: 'ethical_dilemma',
  knowledgeClass: 'philosophical',
  perspectiveClass: 'reflection',
  scopeNote:
    'An imagined dilemma used to test how different ethical principles weigh intention, consequence, rights and responsibility. It is not a real incident and not a test with a correct answer.',
  traditionScope:
    'Anglophone analytic moral philosophy, with related discussions in other ethical traditions; responses vary across individuals and cultures.',
  intellectualPurpose:
    'To make conflicting moral principles visible by applying them to the same case, and to practise giving reasons for a judgement rather than reporting a preference.',
  primaryQuestion: 'When a choice cannot avoid harm, which considerations legitimately determine what one ought to do?',
  introduction:
    'A runaway trolley is heading toward several people who cannot get out of its path. You stand by a lever that can divert it onto a side track where one person is present. You are asked what you ought to do. The scenario is deliberately compressed: the numbers, the people and the outcomes are stipulated so that attention falls on the structure of the choice rather than on practical details. Different answers reveal different ethical commitments, not different levels of moral worth.',
  intellectualBackground:
    'The dilemma is associated with Philippa Foot’s discussion of the doctrine of double effect and with Judith Jarvis Thomson’s later variations, including the case of a person standing on a bridge whose body could stop the trolley. In Foot’s framing, a distinction between intended and merely foreseen consequences matters; Thomson used the variations to probe whether the difference between the cases is morally relevant. Subsequent work by moral philosophers, psychologists and cognitive scientists has used the scenario to examine how people weigh outcomes, intentions and physical contact. Empirical studies report patterns of response across populations, but those patterns describe what people judge, not what they ought to judge.',
  mainIdea:
    'The dilemma is a device for isolating principles. A utilitarian calculation focuses on the number of lives saved; a deontological objection focuses on whether one may intentionally bring about harm to a person as a means; virtue and care approaches ask what a good person or a caring relationship would do in the situation. Holding all these readings at once is the point of the exercise.',
  detailedExplanation:
    'In the standard lever case, diverting the trolley saves several people and results in the death of one person on the side track. A straightforward consequentialist analysis says that the action that produces the better overall outcome is required, provided all consequences are counted and no other options exist. On this view, refusing to pull the lever because the death is foreseen is a failure to take the lives of the several people seriously. The calculation is not callousness; it is a claim about equal consideration of each person’s interests.\n\nA deontological objection does not deny the badness of the larger loss. It holds that there is a constraint against intentionally killing an innocent person as a means, and that this constraint is not overridden simply by a favourable tally. On this view, the lever case is disputed: some argue that the death of the person on the side track is a foreseen side effect of saving the others, while others argue that diverting the trolley uses that person’s position as the mechanism of rescue. Thomson’s bridge variant is designed to sharpen this: if pushing a person would physically stop the trolley, the person’s body is more clearly being used as the means. Many people who pull the lever refuse to push, and the ethical question is whether that difference in judgement tracks a morally relevant distinction or a psychological reaction to direct contact.\n\nThe doctrine of double effect, which Foot discussed, tries to articulate such a distinction. It permits an action with a harmful side effect under conditions that typically include: the action itself is good or neutral, the bad effect is not intended as an end or a means, the good effect is not achieved by means of the bad effect, and the good effect is proportionate to the harm. Applying the doctrine is not mechanical. Whether a consequence is "intended" in the relevant sense depends on how the action is described, and two people can describe the same physical act differently. Critics argue that the doctrine smuggles in a moral judgement through the description; defenders reply that intention is genuinely part of what makes an action the action it is.\n\nVirtue-ethical and care-oriented approaches shift the question again. Instead of asking which rule or tally settles the case, they ask what a person of practical wisdom would do, what emotions and motives would be appropriate, and what the scenario reveals about how we regard vulnerability and responsibility. These approaches can agree with either of the other answers while giving a different reason. They also warn that a stylised dilemma omits features that matter in actual situations: relationships, prior obligations, uncertainty about the outcomes, the availability of other options, and the fact that real people are not interchangeable units in a calculation.\n\nFinally, empirical work on responses to the dilemma should be kept in its place. Surveys can establish that certain response patterns are common, that wording and framing affect answers, and that cultural and individual differences exist. They cannot establish which answer is morally justified. Likewise, the absence of a consensus among philosophers is not evidence that all answers are equally defensible: disagreements in ethics are often about which premise should be rejected, and a reasoned argument can still be better or worse than another. The value of the exercise is that it forces a person to say which principle they are relying on and to face the objections to it.',
  sections: [
    {
      heading: 'The lever and the bridge',
      body: 'The lever version makes harm a foreseen consequence of diverting a threat. The bridge version makes a person’s body the mechanism that stops the threat. Comparing them tests whether the distinction between intended and merely foreseen harm, or between indirect and direct agency, is morally relevant. Reasonable people draw that line in different places.',
    },
    {
      heading: 'Three readings of the same case',
      body: 'A consequentialist reading asks which outcome is better. A rights-based or deontological reading asks whether a constraint against using a person as a means is violated. A virtue or care reading asks what a wise and caring response would express. The readings can reach different conclusions while taking the seriousness of every person equally seriously.',
    },
    {
      heading: 'What the dilemma cannot do',
      body: 'It cannot settle a real decision, because it stipulates away uncertainty, relationships and alternatives. It cannot show that one demographic group is more moral than another. And it cannot replace factual inquiry: deciding what happened and deciding what ought to be done are different questions, even when they concern the same people.',
    },
  ],
  historicalContext:
    'Philippa Foot’s "The Problem of Abortion and the Doctrine of the Double Effect" (1967) placed the trolley-style case in a discussion of consequences, intentions and moral constraints. Judith Jarvis Thomson’s "Killing, Letting Die, and the Trolley Problem" (1976) introduced influential variants and analysed the distinction between killing and letting die. The scenario then spread into applied ethics and empirical moral psychology, where it is used as a probe of judgement rather than as a real-world guide.',
  epistemicBreakdown: {
    'Established about the literature':
      'The dilemma and its variations are well established in moral philosophy; Foot and Thomson are central published sources for its modern discussion.',
    'Interpretation':
      'Authors disagree about which feature of the cases does the moral work: intentions, means, rights, consequences, or the agent’s character.',
    'Contested argument':
      'Whether the distinction between doing and allowing, or between intended and foreseen harm, can bear the weight placed on it is disputed.',
    'Personal or belief perspective':
      'Responses reflect commitments about the relative importance of outcomes and constraints; a survey response is a report of judgement, not a proof of a principle.',
    'Use in an investigation':
      'Use the dilemma to clarify which ethical principle a person is applying. Do not treat any answer as evidence about what happened or about anyone’s guilt.',
  },
  keyConcepts: [
    'consequentialism', 'deontology', 'double effect', 'intention versus foresight',
    'killing versus letting die', 'means and side effects', 'virtue ethics', 'care ethics',
  ],
  supportingSources: [
    bibliographicSource({
      label: 'Foot, P., "The Problem of Abortion and the Doctrine of the Double Effect", Oxford Review 5 (1967)',
      author: 'Philippa Foot',
      title: 'The Problem of Abortion and the Doctrine of the Double Effect',
      sourceType: 'peer_reviewed',
      verificationNotes: 'Bibliographic citation only; publication details and any link pending human verification.',
    }),
    bibliographicSource({
      label: 'Thomson, J. J., "Killing, Letting Die, and the Trolley Problem", The Monist 59(2), 204–217 (1976)',
      author: 'Judith Jarvis Thomson',
      title: 'Killing, Letting Die, and the Trolley Problem',
      sourceType: 'peer_reviewed',
      verificationNotes: 'Bibliographic citation only; exact pages and URL require verification before exposure.',
    }),
  ],
  limitations: [
    'The stipulations remove uncertainty and alternatives that matter in real decisions.',
    'It can encourage a search for a single correct answer when the exercise is really about comparing principles.',
    'Empirical response patterns describe judgements but cannot settle normative questions.',
  ],
  counterarguments: [
    'A consequentialist may argue that any reluctance to reduce the total harm is a failure of impartiality.',
    'A deontologist may argue that some constraints on harming a person cannot be traded against better outcomes.',
    'A virtue theorist may argue that the scenario’s artificiality makes the "right action" question less important than the question of what the response reveals about character.',
  ],
  commonMisconceptions: [
    'That the trolley problem has one answer that all serious ethicists accept.',
    'That people who answer differently are simply less caring.',
    'That the dilemma can be used to decide a real case without further factual investigation.',
  ],
  reflectionQuestions: [
    'Which principle are you relying on when you say the lever should or should not be pulled?',
    'Do you draw a moral difference between the lever case and the bridge case, and can you say why?',
    'What factual uncertainties would make the dilemma look different in a real situation?',
  ],
  activities: [
    'Give one reason for each of two opposing answers, then say which premise you would have to reject to change your mind.',
  ],
  recommendationTags: [
    'ethics', 'dilemma', 'values', 'reasoning', 'responsibility', 'reflection',
    'competing-arguments', 'method',
  ],
  relatedExperienceKeys: ['moral-responsibility', 'stoic-dichotomy-of-control', 'scientific-method-and-falsifiability'],
  relatedSpecialistKeys: ['emergency-docs-owen', 'clinical-toxicologist-rhee'],
  relatedArtifactKeys: ['healthcare-reporting-duty-general'],
  relatedCaseTitles: ['Code Blue at the Clinic', 'Fall from the Rooftop', 'Dead Air at the Radio Station'],
  estimatedMinutes: 12,
  difficulty: 'intermediate',
  displayOrder: 5,
  status: 'published',
};
