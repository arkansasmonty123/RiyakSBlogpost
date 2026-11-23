// M5-CONTENT 4/12: Confirmation bias.
// Psychological demonstration of a common reasoning tendency, with countermeasures.

import type { ExperienceDefinition } from '../types';
import { bibliographicSource } from './source-helpers';

export const confirmationBias: ExperienceDefinition = {
  experienceKey: 'confirmation-bias',
  title: 'Confirmation bias',
  frameworkKey: 'psychological_reasoning',
  format: 'psychological_demonstration',
  knowledgeClass: 'established_scientific',
  perspectiveClass: 'framework_primer',
  scopeNote:
    'A laboratory-supported tendency in how people seek and interpret information. It describes a normal feature of reasoning under conditions, not a character defect and not a diagnosis of any individual.',
  traditionScope:
    'Experimental and social psychology since the mid-twentieth century; mechanisms, size and generality are actively debated.',
  intellectualPurpose:
    'To turn a familiar label into a concrete set of checks: what you searched for, what you counted as supporting evidence, and what would have counted against your first explanation.',
  primaryQuestion: 'How would your inquiry change if you deliberately searched for evidence that your leading explanation is wrong?',
  introduction:
    'A classic experiment asked participants to test a rule governing a sequence of numbers. Most people proposed sequences that would confirm their guess rather than sequences that could rule it out; the decisive tests were the ones that could have shown them wrong. The finding is not that people cannot reason. It is that, in ordinary conditions, the search for confirmation is easier and more natural than the search for refutation — and that this tends to happen without anyone noticing.',
  intellectualBackground:
    'Peter Wason’s 1960s work on hypothesis testing in concept-identification tasks gave the effect its experimental form, and his later "2-4-6" task made it a standard demonstration. Raymond Nickerson’s review in the late 1990s brought together a wide range of settings in which similar patterns appear, from reasoning about rules to the evaluation of scientific claims. Since then, researchers have mapped boundaries: the effect is stronger under some task structures and weaker when people are prompted to consider alternatives, when the cost of being wrong is salient, or when they are accountable to others. Some classic effects in psychology have been re-examined for replication strength, so it is better to speak of a family of related tendencies than of one fixed, universal magnitude.',
  mainIdea:
    'Confirmation bias operates through selection and interpretation as much as through outright belief: the evidence we gather, the questions we ask and the standard we apply to a claim can all tilt toward what we already suspect. The practical response is structural — design a check that does not depend on wanting the answer to come out a particular way.',
  detailedExplanation:
    'It is useful to separate three stages at which the tendency can enter. First, there is biased search: we choose which files to open, which people to ask and which records to examine in a way that favours our current theory. Second, there is biased interpretation: the same ambiguous observation is read as support for a favoured account and as neutral or explicable under a rival one. Third, there is biased memory and reporting: details that fit the emerging story are retained and retold more readily than details that do not. These stages can operate together, so a person can end up with a body of "supporting" material that was never a fair test of anything.\n\nThe original demonstration is worth understanding because its structure is so clean. Participants were told that a hidden rule governed sequences of three numbers, and that they could propose sequences to which an experimenter would answer yes or no. The obvious strategy is to propose triples that satisfy your current guess. The informative strategy is to propose triples that your guess predicts should be rejected, because a "no" can eliminate a wrong rule in a way a "yes" rarely can. Most participants used the first strategy, even when they were aware in principle that falsification was more informative. This is not a failure of intelligence; it reflects how naturally a hypothesis draws attention to instances of itself.\n\nA related phenomenon appears when people evaluate evidence. A claim that fits an existing expectation tends to be accepted with a lower threshold, while a claim that conflicts with it is scrutinised harder. This asymmetry can look like even-handedness from the inside, because the extra scrutiny feels like careful reasoning applied to a suspicious claim. The same pattern shapes memory: once a narrative is formed, details consistent with it are more likely to be recalled, and inconsistent details can be forgotten or reinterpreted. In social settings, agreement from like-minded people amplifies the effect because the group supplies confirmation and shares the same blind spots.\n\nThe countermeasures are therefore procedural rather than motivational. Write the leading explanation down, and alongside it write at least one serious rival. For each, specify what you would expect to find if it were true and what you would expect if it were false. Then seek the observations that would distinguish them, giving priority to those that could eliminate the explanation you prefer. Ask someone who does not share your commitment to review the material, and make them responsible for finding the strongest objection rather than for agreeing with you. Keep a written record of disconfirming observations so they cannot quietly disappear. Finally, separate the strength of your confidence from the quality of the evidence: a coherent story that fits everything you have selected is not yet a tested story.\n\nIt is important not to overgeneralise. Recognising the bias in others is easy; recognising it in oneself requires the structural checks above. And a claim is not discredited merely because someone could be biased in its favour — the right response is to examine the evidence and the procedure. Nor does the existence of the tendency mean all first impressions are wrong. Fast, experience-based judgements are often appropriate; the problem arises when a first impression is treated as settled before alternatives have been fairly considered.',
  sections: [
    {
      heading: 'Three places the bias enters',
      body: 'Biased search chooses material that fits; biased interpretation treats the same observation differently depending on the theory; biased retention keeps fitting details and loses the others. Naming the stage helps, because each stage needs a different check. A search problem is addressed by deliberately sampling against the hypothesis; an interpretation problem by writing down rival predictions in advance.',
    },
    {
      heading: 'What the demonstrations show and do not show',
      body: 'Laboratory tasks show that people often test a guess with confirming instances when disconfirming tests are more informative. They do not show that people are incapable of good reasoning, that the effect has the same size everywhere, or that a particular individual is biased. Context, incentives, task design and accountability all matter, and some findings require careful replication before strong general claims are made.',
    },
    {
      heading: 'Structural countermeasures',
      body: 'State a rival explanation, write down differential predictions, seek the observation that could eliminate your favourite, keep a record of disconfirming material, and invite an independent reviewer whose job is to object. These steps work because they change what is examined rather than relying on a resolve to be unbiased.',
    },
  ],
  historicalContext:
    'Peter Wason published "On the failure to eliminate hypotheses in a conceptual task" in 1960 and "Reasoning about a rule" in 1968. Raymond Nickerson’s 1998 review, "Confirmation Bias: A Ubiquitous Phenomenon in Many Guises", synthesised a broad literature. Later work has examined boundary conditions, debiasing techniques and replication. The demonstration is now standard teaching material in psychology, decision science and critical thinking.',
  epistemicBreakdown: {
    'Established knowledge':
      'Controlled studies show that people preferentially test hypotheses with confirming cases in several task settings, and that similar selection effects appear in other reasoning tasks.',
    'Interpretation':
      'Researchers explain the pattern through hypothesis-focused search, asymmetric evidential standards and memory effects; different studies emphasise different mechanisms.',
    'Contested arguments':
      'The size and generality of the effect, the relative contribution of mechanisms, and the durability of debiasing interventions remain debated.',
    'Personal perspective note':
      'Recognising a bias in oneself is difficult, so any claim of having "corrected" for it should be treated as provisional and checked against procedure.',
    'Use in an investigation':
      'Apply the label to a process — search, interpretation or retention — and then design a specific check. Do not use it as a reason to dismiss a claim you dislike.',
  },
  keyConcepts: [
    'hypothesis testing', 'disconfirming evidence', 'biased search', 'biased interpretation',
    'memory reconstruction', 'accountability', 'debiasing procedures', 'replication',
  ],
  supportingSources: [
    bibliographicSource({
      label: 'Wason, P. C., "On the failure to eliminate hypotheses in a conceptual task", Quarterly Journal of Experimental Psychology 12(3), 129–140 (1960)',
      author: 'Peter C. Wason',
      title: 'On the failure to eliminate hypotheses in a conceptual task',
      sourceType: 'peer_reviewed',
      verificationNotes: 'Bibliographic citation from working notes; page range and link require human verification before exposure.',
    }),
    bibliographicSource({
      label: 'Wason, P. C., "Reasoning about a rule", Quarterly Journal of Experimental Psychology 20(3), 273–281 (1968)',
      author: 'Peter C. Wason',
      title: 'Reasoning about a rule',
      sourceType: 'peer_reviewed',
      verificationNotes: 'Bibliographic citation only; edition and URL pending verification.',
    }),
    bibliographicSource({
      label: 'Nickerson, R. S., "Confirmation Bias: A Ubiquitous Phenomenon in Many Guises", Review of General Psychology 2(2), 175–220 (1998)',
      author: 'Raymond S. Nickerson',
      title: 'Confirmation Bias: A Ubiquitous Phenomenon in Many Guises',
      sourceType: 'peer_reviewed',
      verificationNotes: 'Review article citation; exact details and any link pending verification. Summary only.',
    }),
  ],
  limitations: [
    'A bias label can be used to dismiss a well-supported claim without engaging with it.',
    'The size of the effect varies with task design, incentives and context; a classroom demonstration is not a prediction about a specific inquiry.',
    'Being told about the bias does not reliably remove it from one’s own reasoning.',
  ],
  counterarguments: [
    'Some researchers argue that people reason well when a task is framed in familiar, realistic terms, so the laboratory effect is narrower than often claimed.',
    'Others argue that what looks like confirmation bias can be a rational response to limited search costs or to a genuinely informative confirming observation.',
    'A further objection holds that focusing on individual bias neglects the institutional structures that shape which evidence is available at all.',
  ],
  commonMisconceptions: [
    'That confirmation bias means people only notice evidence they want to see, with no other influences.',
    'That it is a defect confined to other people.',
    'That pointing out a possible bias settles whether a claim is true.',
  ],
  reflectionQuestions: [
    'What would you have to find in order to give up your current leading explanation?',
    'Which sources have you consulted so far, and which would most likely challenge what you think?',
    'Are you applying the same standard of proof to your preferred account and to its rivals?',
  ],
  activities: [
    'Write your leading explanation and one rival, then list one observation that would favour each and go looking for it.',
  ],
  recommendationTags: [
    'psychology', 'bias', 'method', 'evidence', 'hypothesis', 'memory', 'reflection',
    'reasoning', 'case-bridge',
  ],
  relatedExperienceKeys: ['problem-of-induction', 'scientific-method-and-falsifiability', 'collective-memory'],
  relatedSpecialistKeys: ['emergency-docs-owen', 'insurance-analyst-miriam'],
  relatedArtifactKeys: ['record-gap-vs-diversion-signal', 'trace-vs-log-timing'],
  relatedCaseTitles: ['Code Blue at the Clinic', 'The Midnight Heist', 'Blaze at Dawn Bakery'],
  estimatedMinutes: 10,
  difficulty: 'introductory',
  displayOrder: 4,
  status: 'published',
};
