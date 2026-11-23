// M5-CONTENT 12/12: Collective memory.
// Sociological reasoning about how groups select and transmit accounts of the past.

import type { ExperienceDefinition } from '../types';
import { bibliographicSource } from './source-helpers';

export const collectiveMemory: ExperienceDefinition = {
  experienceKey: 'collective-memory',
  title: 'Collective memory',
  frameworkKey: 'sociological_reasoning',
  format: 'historical_episode',
  knowledgeClass: 'contested_scientific',
  perspectiveClass: 'case_bridge',
  scopeNote:
    'A sociological and historical theory about how groups frame the past. It concerns the social selection and transmission of meaning, not the claim that shared memories are false.',
  traditionScope:
    'Halbwachsian and later memory-studies traditions, Pierre Nora’s work on sites of memory, and Benedict Anderson’s account of imagined communities; mechanisms and politics of memory remain debated.',
  intellectualPurpose:
    'To examine how institutions, rituals and narratives select what a group remembers, and how individual recollections are shaped by social frameworks without being reducible to them.',
  primaryQuestion: 'How does a group decide, often without deciding explicitly, which past events remain meaningful?',
  introduction:
    'A community can remember an event vividly while nearby events disappear from its stories. Monuments, anniversaries, archives, school lessons and family narratives all participate in this selection. The study of collective memory asks how social frameworks shape what is retained, how versions of the past change, and whose interests are served by one version becoming dominant. It is not the claim that everything a group remembers is inaccurate.',
  intellectualBackground:
    'Maurice Halbwachs argued in the early twentieth century that memory is framed by social groups: what a person remembers, and how, depends on the groups to which they belong and the frameworks those groups supply. Pierre Nora later studied "sites of memory" — institutions, places and objects in which a society deposits meaning as lived memory recedes. Benedict Anderson’s Imagined Communities examined how shared narratives make large collectivities feel like communities. These works are influential but contested: scholars disagree about mechanisms, about how much agency individuals retain, and about the politics of which memories are official.',
  mainIdea:
    'Collective memory is a social process of selection, transmission and reinterpretation. It helps explain why accounts of the past change with the needs of the present, while leaving open the question of what actually happened — a question that still requires ordinary historical inquiry.',
  detailedExplanation:
    'Start with a distinction that is often lost. Collective memory is not a single giant mind, nor a set of false beliefs imposed on individuals. It refers to the ways shared frameworks — institutions, commemorations, language, education and family practice — shape what individuals recall and how they interpret it. An anniversary can make one event salient for a whole community; an archive can preserve some records and lose others; a national narrative can present a sequence as inevitable. These are social facts about the conditions of remembering, not assertions that every participant holds the same belief or that the remembered account is wrong.\n\nHalbwachs’s central claim was that memory depends on social frameworks. A person recalls a past event by placing it within a scheme supplied by a group: family, religious community, profession, nation. When the group changes, the framework changes, and so does what can be recalled and how. This is not simple determinism; individuals can remember against their group and can belong to several groups with competing frameworks. Later researchers have extended the account to media, museums, law and education, and have asked how digital archives change both preservation and forgetting. The mechanism is nevertheless debated: some accounts emphasise institutions, others everyday interaction, and others the power relations that decide which version is publicly recognised.\n\nNora’s notion of a site of memory captures a different aspect. He argued that modern societies no longer transmit memory in the same continuous, lived way, and so create deliberate deposits — archives, monuments, museums, rituals — that stand in for it. A site of memory is not simply a true record; it is an object in which a society invests meaning and whose meaning changes over time. This is useful for thinking about why a document or object can be treated as authoritative long after its original context has passed. It also warns against treating a commemoration as neutral evidence about the event it commemorates: it is evidence about the later society that created it.\n\nAnderson’s account of imagined communities adds the question of scale. Large groups cannot know one another personally, yet members often feel a strong shared identity. Print, language, maps and shared narratives make that possible. Applied to memory, this suggests that a community’s account of its past is part of what holds the community together, which explains why challenges to that account can be experienced as threats rather than as ordinary disputes about evidence. At the same time, a critical analysis should not assume that all shared narratives are oppressive or false; the politics of memory includes struggles by groups whose experiences were excluded from official accounts.\n\nFor an investigation, the useful move is to ask how a story became the story. Which institution repeats it, which records support it, and which voices are absent? Is a widely held account the result of independent evidence or of repeated transmission from a single origin? What would counting as a "site of memory" do to an object — would it make later commemoration look like evidence about earlier events? These questions concern the social life of an account, not its accuracy. The theory offers no method for deciding what happened, and it must not be used to dismiss a claim merely because it is widely shared or socially framed.',
  sections: [
    {
      heading: 'Memory is socially framed, not socially dictated',
      body: 'Halbwachs’s insight is that groups supply frameworks for recall: categories, rituals and shared reference points that make remembering possible. Individuals can remember against a group and belong to several frameworks at once. The claim is about conditions of memory, not about the falsity of remembered content.',
    },
    {
      heading: 'Sites of memory and imagined communities',
      body: 'Nora examined deliberate deposits of meaning — archives, monuments, museums — as substitutes for continuous lived memory. Anderson showed how shared narratives make large communities feel real. Both approaches treat the form of an account as evidence about the society that sustains it, not automatically as evidence about the events it narrates.',
    },
    {
      heading: 'Limits and responsible use',
      body: 'Theories of collective memory differ about mechanisms and about the politics of official accounts. They do not tell us what happened, and calling an account "socially constructed" does not settle whether it is accurate. The right use is to ask how an account became dominant and which voices it excludes.',
    },
  ],
  historicalContext:
    'Halbwachs’s work on collective memory appeared in the early twentieth century and was later edited and translated for English-language readers. Pierre Nora’s multi-volume Les Lieux de mémoire appeared in the 1980s and 1990s, and Benedict Anderson’s Imagined Communities was first published in 1983. The field of memory studies has since grown across history, sociology, literature and media studies, with sustained debate about the relationship between memory, history and power.',
  epistemicBreakdown: {
    'Established knowledge':
      'Halbwachs, Nora and Anderson are influential published sources for the study of social memory, commemoration and imagined community.',
    'Interpretation':
      'Researchers read these works differently: some emphasise institutions, others everyday practice, and others the politics of whose memory becomes official.',
    'Contested arguments':
      'The mechanisms of collective memory, its relation to individual cognition and the extent to which it is determined by power remain debated.',
    'Tradition perspective':
      'Theories of collective memory come from particular intellectual traditions; treating them as universal laws of all societies would be an overstatement.',
    'Use in an investigation':
      'Ask how an account is transmitted and what it excludes. Do not use the theory to declare a shared account false or to replace inquiry into what occurred.',
  },
  keyConcepts: [
    'social frameworks of memory', 'sites of memory', 'imagined community',
    'selection and transmission', 'official narrative', 'commemoration',
    'archive silence', 'politics of memory',
  ],
  supportingSources: [
    bibliographicSource({
      label: 'Halbwachs, M., On Collective Memory (ed. and tr. L. A. Coser, University of Chicago Press, 1992) — selections from earlier French works',
      author: 'Maurice Halbwachs',
      title: 'On Collective Memory',
      sourceType: 'textbook',
      verificationNotes: 'Modern edition is copyrighted; summary only. Exact contents and any URL require human verification.',
    }),
    bibliographicSource({
      label: 'Nora, P. (ed.), Realms of Memory: Rethinking the French Past (French original 1984–1992; English 1996–1998)',
      author: 'Pierre Nora (editor)',
      title: 'Realms of Memory: Rethinking the French Past',
      sourceType: 'textbook',
      verificationNotes: 'Bibliographic citation only; translation details and URL pending verification.',
    }),
    bibliographicSource({
      label: 'Anderson, B., Imagined Communities (1983; revised editions)',
      author: 'Benedict Anderson',
      title: 'Imagined Communities',
      sourceType: 'textbook',
      verificationNotes: 'Modern editions are copyrighted; summary only, no excerpt. Link pending verification.',
    }),
  ],
  limitations: [
    'Theories of collective memory do not establish the accuracy of any particular remembered account.',
    'The mechanisms proposed differ between authors and traditions, so a single general theory is unavailable.',
    'An emphasis on social framing can understate individual agency and disagreement within a group.',
  ],
  counterarguments: [
    'A psychologist may argue that individual memory processes explain more than social frameworks alone.',
    'A historian may argue that the theory tells us about later commemoration but not about the events being commemorated.',
    'A critic may argue that the concept is too broad to be useful unless the transmitting institution is specified.',
  ],
  commonMisconceptions: [
    'That collective memory means a group is remembering something false.',
    'That all members of a community hold the same view of its past.',
    'That a monument or archive is neutral evidence about the events it commemorates.',
  ],
  reflectionQuestions: [
    'Which institution or ritual most shapes the way your community tells this story?',
    'Whose account is missing from the shared version, and what would including it change?',
    'How would you distinguish a widely repeated account from one supported by independent material?',
  ],
  activities: [
    'Trace one familiar story about the past back to the places and institutions that keep repeating it.',
  ],
  recommendationTags: [
    'sociology', 'memory', 'narrative', 'institutions', 'perspective',
    'case-bridge', 'reflection', 'historical',
  ],
  relatedExperienceKeys: ['historical-source-reliability', 'blind-men-and-the-elephant', 'dependent-origination'],
  relatedSpecialistKeys: ['insurance-analyst-miriam', 'fire-investigator-delgado'],
  relatedArtifactKeys: ['insurance-fraud-red-flags-vs-proof', 'bakery-closing-safety-checklist'],
  relatedCaseTitles: ['The Midnight Heist', 'Blaze at Dawn Bakery', 'Murder at Harbor Lights'],
  estimatedMinutes: 13,
  difficulty: 'intermediate',
  displayOrder: 12,
  status: 'published',
};
