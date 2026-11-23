// M5: the seven intellectual frameworks (reasoning lenses).
// ---------------------------------------------------------------------------
// These are authored, general-education descriptions of real disciplines. They
// are deliberately quote-free and URL-free: nothing here is a canonical case
// fact, an answer to a case, or a hidden detail. Each entry names its own
// limitations and the genuine disagreements WITHIN the tradition, so no lens
// is presented as the single correct way to think.
//
// The seven lens keys are fixed by the M5 specification. Experiences may take
// formats that cross lens boundaries (a Stoic practice can be taught under
// philosophical_reasoning while carrying religious/spiritual relevance); the
// cross-links live in the experience registry, not in these definitions.

import type { FrameworkDefinition } from './types';

export const FRAMEWORKS: FrameworkDefinition[] = [
  {
    frameworkKey: 'scientific_reasoning',
    name: 'Scientific reasoning',
    intellectualDomain: 'Empirical science, statistics and philosophy of science',
    summary:
      'A way of reasoning that treats claims as testable models: it asks what a hypothesis predicts, looks for observations that could break it, and holds conclusions provisionally in proportion to the evidence that supports them.',
    coreQuestions: [
      'What observable result would this prediction lead me to expect, and what observation would count against it?',
      'How were the data collected, measured and recorded, and what could have gone wrong in that process?',
      'Which competing hypothesis would explain these observations equally well or better?',
      'Is an association being read as a cause, and could a common cause or a selection effect explain it?',
      'Have I looked for cases that would undermine my preferred account, not only cases that support it?',
    ],
    keyConcepts: [
      'falsifiability', 'operational definition', 'control and confounding', 'replication',
      'base rate', 'measurement error', 'underdetermination', 'Bayesian updating',
    ],
    methodOfReasoning:
      'Frame more than one hypothesis, derive observable predictions that differ between them, then look for the test most likely to eliminate a wrong one rather than the one most likely to flatter a favourite. Attend to how data were collected: sampling, measurement instruments, recording procedures and missing observations all constrain what a result can mean. Report conclusions with the uncertainty the method warrants, distinguish statistical from practical significance, and treat successful predictions as provisional support rather than proof. Where controlled tests are impossible, say plainly which causal claims the observational evidence cannot carry.',
    limitations: [
      'Controlled experiments are impossible for unique past events, so causal claims there rest on observational evidence and careful elimination of alternatives.',
      'A failed prediction underdetermines which auxiliary assumption is at fault: the core hypothesis, the measurement, or a background theory.',
      'Demarcation rules such as falsifiability are themselves contested, and probabilistic or historical sciences do not fit a simple one-test model.',
      'Replication and base-rate information are often unavailable in the moment a decision is needed.',
    ],
    commonMisconceptions: [
      'That a hypothesis becomes proven once it survives a single supportive test.',
      'That correlation, however strong, establishes causation.',
      'That a p-value is the probability that the hypothesis is true.',
      'That "scientific" names a fixed recipe that applies identically in every field.',
    ],
    internalDifferences: [
      'Popperian falsificationism versus Bayesian confirmation theory and other accounts of how evidence supports a hypothesis.',
      'Frequentist versus Bayesian treatments of uncertainty and the legitimacy of prior information.',
      'Duhem–Quine underdetermination and Kuhnian accounts of paradigm change versus more recent descriptions of everyday scientific practice.',
    ],
    relevantDisciplines: ['natural sciences', 'statistics', 'philosophy of science', 'epidemiology', 'research methodology'],
    displayOrder: 1,
    status: 'published',
  },
  {
    frameworkKey: 'psychological_reasoning',
    name: 'Psychological reasoning',
    intellectualDomain: 'Cognitive psychology, social psychology and human factors',
    summary:
      'A lens on how attention, memory, motivation and social pressure shape what people notice, recall and conclude — including the investigator reasoning about a case at this very moment.',
    coreQuestions: [
      'Which feature of this situation might be steering attention toward one explanation too early?',
      'What would I expect to see if my first impression were wrong, and have I looked for that?',
      'How might memory for this detail have changed between the event and the account I now have?',
      'Could agreement in a group reflect shared pressure rather than independent confirmation?',
      'Which part of this judgement is a property of the reasoning process rather than of the world being studied?',
    ],
    keyConcepts: [
      'confirmation bias', 'anchoring', 'availability', 'memory reconstruction',
      'groupthink', 'fundamental attribution error', 'dual-process models', 'debiasing',
    ],
    methodOfReasoning:
      'Identify the specific step where a judgement could be distorted, then design a check rather than merely naming the distortion. Seek cases that would disconfirm the first explanation, delay commitment until independent accounts have been compared, separate an observation from the interpretation placed on it, and ask what a differently motivated person would have noticed. Treat biases as predictable tendencies of ordinary cognition under particular conditions, not as character flaws, and treat any debiasing claim as something that must itself be tested.',
    limitations: [
      'Naming a bias does not remove it; reliable debiasing usually needs structured procedures, not just good intentions.',
      'Many classic findings are context-dependent and some do not replicate at their original strength.',
      'A bias label can be misused to dismiss a claim without engaging with the evidence offered for it.',
      'Laboratory demonstrations of a tendency do not, on their own, tell us its size in a particular real-world setting.',
    ],
    commonMisconceptions: [
      'That bias affects other people but not oneself.',
      'That a confident recollection is necessarily an accurate one.',
      'That a single explanation in terms of bias exhausts the causes of a decision.',
      'That a classic demonstration transfers unchanged to every culture and situation.',
    ],
    internalDifferences: [
      'The heuristics-and-biases tradition versus ecological-rationality accounts of when intuitions are well adapted.',
      'Dual-process models and continuing debate about where their boundaries actually lie.',
      'Individual-cognition accounts versus situated and socially distributed accounts of reasoning.',
    ],
    relevantDisciplines: ['psychology', 'cognitive science', 'behavioral economics', 'human factors', 'social psychology'],
    displayOrder: 2,
    status: 'published',
  },
  {
    frameworkKey: 'philosophical_reasoning',
    name: 'Philosophical reasoning',
    intellectualDomain: 'Philosophy: logic, epistemology and metaphysics',
    summary:
      'Reasoning that examines the concepts and premises an argument rests on, using clarification, counterexamples and thought experiments to test whether a claim is coherent and whether its consequences can be accepted.',
    coreQuestions: [
      'What exactly is being asked, and which terms are doing unexamined work?',
      'What follows if I accept this premise, and does it lead somewhere I would reject?',
      'What imagined case would reveal whether my concept is coherent?',
      'Which assumptions about identity, knowledge or agency am I taking for granted?',
      'Where would a reasonable opponent accept my starting point, and where would they depart from it?',
    ],
    keyConcepts: [
      'conceptual analysis', 'thought experiment', 'necessary and sufficient conditions',
      'reductio ad absurdum', 'epistemic justification', 'personal identity',
      'skepticism', 'philosophical parable',
    ],
    methodOfReasoning:
      'State the claim in a form that can be examined, expose the premises needed to support it, and test them by looking for counterexamples or by following them to unwelcome consequences. Distinguish conceptual questions about what a word means from empirical questions about what happens to exist. Use imagined cases to make hidden assumptions visible, but check afterwards whether the intuition the case elicits is shared, stable and relevant. When a disagreement persists, identify the precise premise at which the two sides part company instead of treating the dispute as a clash of slogans.',
    limitations: [
      'Conceptual arguments rarely produce a decisive experiment; well-reasoned opponents can remain unconvinced.',
      'Thought experiments rely on intuitions that vary between people and cultures, and an intuition is not data about the world.',
      'An argument can expose an inconsistency without telling us which premise should be abandoned.',
      'Ancient and medieval texts were written for different questions than ours, so "what the author meant" is itself interpretive.',
    ],
    commonMisconceptions: [
      'That philosophy is merely the expression of personal opinion.',
      'That a thought experiment establishes an empirical fact about the world.',
      'That a parable or dialogue has one fixed meaning that the author plainly intended.',
      'That producing a counterexample ends a debate rather than refining the question.',
    ],
    internalDifferences: [
      'Analytic approaches focused on argument and concept versus continental approaches focused on interpretation and context.',
      'Rationalist and empiricist accounts of the sources of knowledge, and contemporary disputes about whether a priori knowledge exists.',
      'Traditional reliance on considered intuitions versus experimental philosophy that tests whether those intuitions are widely shared.',
    ],
    relevantDisciplines: ['philosophy', 'logic', 'epistemology', 'metaphysics', 'classical studies'],
    displayOrder: 3,
    status: 'published',
  },
  {
    frameworkKey: 'historical_interpretation',
    name: 'Historical interpretation',
    intellectualDomain: 'Historiography, archival science and source criticism',
    summary:
      'Reading every account as a product of a particular author, audience and purpose, then building the most defensible reconstruction that the surviving, fragmentary and interested records can support.',
    coreQuestions: [
      'Who produced this account, when, for whom and with what purpose?',
      'What can be corroborated by an account independent of this one?',
      'Which voices are missing from the surviving record, and why might that be?',
      'Am I reading a later concept back into an earlier context?',
      'How much of this is a report of an event and how much is an interpretation added afterwards?',
    ],
    keyConcepts: [
      'provenance', 'corroboration', 'external and internal criticism', 'contextualization',
      'anachronism', 'silences in the archive', 'source genre', 'narrative construction',
    ],
    methodOfReasoning:
      'Place each source in its context, classify it by genre and by distance from the events, and compare it with accounts that do not share its origin. External criticism asks whether a document is what it claims to be; internal criticism asks what its content can be trusted to report. Reconcile conflicts by considering motive, memory, copying and transmission rather than simply choosing the more convenient account. State where the record is silent instead of filling gaps with invention, and make explicit the interpretive judgements that turn sources into a narrative.',
    limitations: [
      'Surviving records are biased toward the literate, the powerful and the preservable, so absence from the archive is weak evidence of absence from life.',
      'Sources that appear independent may derive from a single original report, so corroboration must be checked rather than assumed.',
      'Historical conclusions are revisable when new material appears or questions change.',
      'Source criticism manages uncertainty; it does not deliver the past exactly as it happened.',
    ],
    commonMisconceptions: [
      'That the earliest surviving account is automatically the most accurate.',
      'That no record of an event proves the event did not occur.',
      'That a historian can reproduce the past exactly as it was experienced.',
      'That a document can be accepted at face value once its author is known.',
    ],
    internalDifferences: [
      'Positivist-style verification of facts versus interpretive and narrative accounts of historical meaning.',
      'History as a corpus of facts versus history as a constructed argument addressed to present questions.',
      'Microhistory and attention to individual experience versus long-duration structural or economic explanations.',
      'Debates over how oral tradition, material remains and documentary records should be weighted against one another.',
    ],
    relevantDisciplines: ['history', 'archival science', 'philology', 'archaeology', 'memory studies'],
    displayOrder: 4,
    status: 'published',
  },
  {
    frameworkKey: 'ethical_reasoning',
    name: 'Ethical reasoning',
    intellectualDomain: 'Moral philosophy, applied ethics and political theory',
    summary:
      'Structured reflection on duties, rights, character and consequences: it makes values explicit, tests whether principles can be applied consistently, and separates claims about what happened from claims about what ought to be done.',
    coreQuestions: [
      'Which duties, rights or values pull in different directions here?',
      'What would a fair observer who does not know which position they will occupy choose?',
      'Am I evaluating an outcome, an intention, a character, or a relationship of care?',
      'Could I will the principle I am using as a rule for everyone in a similar position?',
      'Am I confusing a description of what happened with a judgement about what ought to have happened?',
    ],
    keyConcepts: [
      'consequentialism', 'deontology', 'virtue ethics', 'care ethics',
      'justice as fairness', 'moral luck', 'the is–ought distinction', 'double effect',
    ],
    methodOfReasoning:
      'Make the relevant values and stakeholders explicit, then examine the same situation from more than one ethical standpoint: consequences for those affected, duties and rights that constrain the action, the character and intentions of the agent, and relationships of dependency or care. Test candidate principles for consistency and for whether they could be adopted impartially. Separate descriptive claims from normative ones, note where reasonable people give different weight to the same value, and resist the temptation to let a vivid outcome settle the whole question.',
    limitations: [
      'Ethical reflection rarely yields a single mechanically correct answer, and sincere people can weigh the same values differently.',
      'General principles underdetermine particular cases and may conflict with one another.',
      'Abstract reasoning can obscure the concrete effects on specific people and on relationships.',
      'Moral judgement is vulnerable to the same reasoning biases as any other judgement.',
    ],
    commonMisconceptions: [
      'That reasoning about ethics is merely expressing a private preference.',
      'That a good outcome automatically makes an action right.',
      'That moral reflection can substitute for factual investigation.',
      'That a famous dilemma has a single answer that every ethical theory must reach.',
    ],
    internalDifferences: [
      'Consequentialist, deontological and virtue-ethical approaches to the same action.',
      'Care ethics and justice ethics as different accounts of what moral attention is for.',
      'Universalist claims about moral principles versus particularist attention to context.',
      'Moral realism, expressivism and constructivism about what moral statements mean.',
    ],
    relevantDisciplines: ['philosophy', 'ethics', 'political theory', 'applied ethics', 'bioethics'],
    displayOrder: 5,
    status: 'published',
  },
  {
    frameworkKey: 'sociological_reasoning',
    name: 'Sociological reasoning',
    intellectualDomain: 'Sociology, social theory and collective memory studies',
    summary:
      'A lens that looks for structure rather than isolated acts: roles, institutions, incentives and shared narratives shape what a group notices, remembers and treats as obvious.',
    coreQuestions: [
      'Which social structures, roles or incentives make this pattern more likely?',
      'How do groups transmit and select accounts of the past?',
      'Whose interests are served by one version of events becoming dominant?',
      'Am I treating a group category as though it were a single person with one intention?',
      'What observation would count against my account of this social mechanism?',
    ],
    keyConcepts: [
      'social construction', 'collective memory', 'institutions', 'roles and norms',
      'incentive structures', 'social stratification', 'public narrative', 'imagined community',
    ],
    methodOfReasoning:
      'Move between the level of individuals and the level of groups: describe the pattern, identify the roles and institutions that produce the repeated behaviour, and ask which incentives or norms sustain it. Examine how accounts are selected and transmitted, whose voices are amplified, and what a competing social explanation would predict. Avoid treating a category as a unified agent, and specify what evidence would weaken the proposed mechanism. Where the data are thin, prefer qualified statements about tendency over claims about what every member of a group believes.',
    limitations: [
      'Group-level explanations can erase individual agency and responsibility if applied carelessly.',
      'Social mechanisms are difficult to test with small or non-representative samples.',
      'Categories used in analysis can reify boundaries that are fluid in practice.',
      'The researcher’s own social position shapes which patterns are noticed and how they are described.',
    ],
    commonMisconceptions: [
      'That collective memory means collectively false memory.',
      'That a society is nothing more than the sum of independent individuals.',
      'That noticing a pattern is the same as identifying its mechanism.',
      'That a social explanation removes the relevance of individual choices.',
    ],
    internalDifferences: [
      'Structural functionalism, conflict theory and symbolic interactionism as different accounts of social order.',
      'Methodological individualism versus holist accounts of what explains social facts.',
      'Halbwachsian accounts of memory framed by social groups versus approaches centred on sites and institutions of memory.',
      'Quantitative, variable-centred sociology versus interpretive and ethnographic traditions.',
    ],
    relevantDisciplines: ['sociology', 'social theory', 'memory studies', 'anthropology', 'political sociology'],
    displayOrder: 6,
    status: 'published',
  },
  {
    frameworkKey: 'religious_spiritual_traditions',
    name: 'Religious and spiritual traditions',
    intellectualDomain: 'Comparative religion, religious studies and philosophy of religion',
    summary:
      'A family of reasoning practices that takes seriously how traditions transmit teachings, how schools within one tradition disagree, and what it means to reason from received texts or practices without flattening them into a single doctrine.',
    coreQuestions: [
      'Which tradition, period and context does this teaching come from?',
      'How do different schools within the same tradition read this text or practice?',
      'Am I treating a devotional or symbolic claim as though it were a laboratory hypothesis?',
      'What is lost when a practice is reduced to a self-help technique or a moral slogan?',
      'What does the tradition itself say about the limits of its own concepts?',
    ],
    keyConcepts: [
      'scriptural interpretation', 'tradition and reform', 'skillful means',
      'dependent origination', 'doctrinal diversity', 'practice and realization',
      'comparative religion', 'secular adaptation',
    ],
    methodOfReasoning:
      'Identify the specific tradition and, where possible, the school within it before generalising. Read a teaching alongside its commentaries and its practical setting, and ask what problem it was answering. Present devotional, ritual and metaphysical claims as claims made within a tradition rather than as empirically established results; where a comparison is offered, specify both the similarity and the difference that matters. Attend to modern secular reinterpretations as a distinct layer, not as the original meaning, and allow that sincere practitioners may disagree about what a teaching requires.',
    limitations: [
      'Every living tradition contains internal disagreement, so a single "belief of Buddhism" or "the Stoic view" is usually an oversimplification.',
      'Insider and outsider descriptions answer different questions and should not be treated as interchangeable.',
      'Devotional or metaphysical claims are not settled by ordinary empirical tests, and preferring a naturalistic reading is itself a stance.',
      'Modern self-help adaptations often detach practices from the commitments that gave them meaning.',
    ],
    commonMisconceptions: [
      'That all traditions ultimately teach the same thing.',
      'That a parable proves that every interpretation is equally valid.',
      'That Stoic practice means suppressing all emotion or accepting injustice passively.',
      'That Buddhism is one uniform doctrine rather than a set of traditions with distinct readings.',
    ],
    internalDifferences: [
      'Theravada, Mahayana, Tibetan and Zen readings of dependent origination and of what liberation involves.',
      'Buddhist, Jain and Hindu retellings of the elephant parable with different emphases and conclusions.',
      'Early, middle and late Stoicism, and modern secular adaptations that reinterpret its physics and theology.',
      'Devotional, monastic and lay forms of practice, and disagreements about whether a teaching is literal, symbolic or provisional.',
    ],
    relevantDisciplines: ['religious studies', 'philosophy of religion', 'comparative religion', 'Buddhist studies', 'classical philosophy'],
    displayOrder: 7,
    status: 'published',
  },
];

export function getFrameworkByKey(key: string): FrameworkDefinition | undefined {
  return FRAMEWORKS.find((f) => f.frameworkKey === key);
}

export const FRAMEWORK_KEYS: string[] = FRAMEWORKS.map((f) => f.frameworkKey);
