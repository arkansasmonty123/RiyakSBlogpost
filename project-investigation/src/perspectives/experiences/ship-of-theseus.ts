// M5-CONTENT 2/12: The Ship of Theseus.
// Thought experiment about identity over time — no case facts, no empirical answer.

import type { ExperienceDefinition } from '../types';
import { bibliographicSource } from './source-helpers';

export const shipOfTheseus: ExperienceDefinition = {
  experienceKey: 'ship-of-theseus',
  title: 'The Ship of Theseus',
  frameworkKey: 'philosophical_reasoning',
  format: 'thought_experiment',
  knowledgeClass: 'philosophical',
  perspectiveClass: 'challenge',
  scopeNote:
    'An imagined case used to test criteria of identity over time. It is a conceptual tool, not a claim about any real vessel and not a puzzle with a settled empirical solution.',
  traditionScope:
    'Ancient Greek and Roman sources, early-modern philosophy of identity, and contemporary analytic metaphysics; no single authoritative answer.',
  intellectualPurpose:
    'To expose the criteria hidden in a claim that something is "the same" over time, and to show how different, defensible criteria can yield different answers to the same question.',
  primaryQuestion: 'What, if anything, makes a thing the same thing after all of its parts have changed?',
  introduction:
    'A ship is preserved over many years. As each plank rots it is replaced, until eventually none of the original timbers remain. A later writer adds a twist: suppose the discarded original planks were gathered and reassembled into a ship. Which vessel, if either, is the original? The question is not about ships. It is a controlled way of asking what we mean when we say that something has persisted.',
  intellectualBackground:
    'Plutarch reports that the Athenians kept a vessel associated with Theseus by replacing decayed timber, and that philosophers thereafter disagreed about whether it remained the same ship. Hobbes later used a similar example to discuss identity, and later philosophers have used variants for persons, organisations and objects. The puzzle survives because it isolates a real feature of ordinary thought: we speak of identity over time while our practical criteria for it are multiple and context-sensitive. Answers have been offered in terms of matter, form, spatiotemporal continuity, function, psychological continuity and social recognition; each captures something and each has counterexamples.',
  mainIdea:
    'Identity claims depend on criteria, and criteria are chosen for a purpose. The thought experiment forces those criteria into the open by describing a case where they come apart: matter points one way, continuity of use another, and history a third. Recognising this does not require giving up on identity talk; it requires saying which criterion is being used and why.',
  detailedExplanation:
    'Start with the simplest version. A ship has planks; over time every plank is replaced one at a time, and at each step the change seems minor. The puzzle arises from a feature of gradual change: there is no single moment at which the ship obviously ceases to be itself. If you say it remains the same because each replacement preserved its structure and function, you are using a continuity criterion. If you say it is a different ship because its matter is entirely new, you are using a material criterion. If neither answer feels forced, that is because ordinary identity talk typically combines several criteria that usually agree and here do not.\n\nThe reassembled-planks variant sharpens the problem. Now there are two candidates: the continuously repaired ship, which has the history, name and working shape, and the reassembled ship, which has the original matter. A material criterion favours the second; a continuity-of-history criterion favours the first. A strict criterion might say neither is the original, because identity cannot survive such a split. A tolerant criterion might say both are, in different respects — one is continuous with the original in use and location, the other in constituent material. Notice that each answer is internally coherent; the disagreement is about what the question is really asking.\n\nOne important response is to deny that the puzzle demands a single correct answer. On this view, "same ship" is context-sensitive: a harbor authority tracking a vessel’s registration may care about continuity, a timber merchant may care about material, and a historian may care about documented provenance. Each is answering a different practical question with a different criterion. This is not mere relativism, because a criterion can be assessed for whether it does the job it was chosen for. A registry that reassigned a vessel’s identity every time a plank changed would be useless; a claim about "original timbers" that ignored replacement history would be equally unhelpful for that purpose.\n\nA second response insists that there is a fact of the matter about identity independent of our interests, and that one of the competing criteria is the correct analysis. Defenders of spatiotemporal continuity argue that gradual, connected change preserves a thing through time in a way that mere material similarity does not. Defenders of a constitution view distinguish the ship from the matter composing it, allowing that the ship persists while its constitution changes completely. Critics of each view produce further imagined cases — sudden replacement, duplication, fission — where the favoured criterion again appears arbitrary. The history of the debate is therefore not a sequence of solved problems but a refining of the questions.\n\nThe transferable lesson is about how claims are made. Whenever someone says that two descriptions refer to the same enduring thing, ask what is being held fixed: composition, continuity, function, origin, or a social record of recognition. In an investigation, the objects of interest are often records, testimonies and descriptions rather than ships; asking what makes two accounts "the same account", or whether an item has been substituted, is a practical version of the same conceptual exercise. The thought experiment does not supply an answer to such questions. It supplies a discipline for making the criteria explicit before applying them.',
  sections: [
    {
      heading: 'The two cases and the split criterion',
      body: 'The repaired ship has continuous history, name and function but entirely new matter. The reassembled ship has the original matter but a discontinuous recent history. Material, continuity and function criteria now point in different directions. The case is designed so that no answer is available without saying which criterion you are using and what it is for.',
    },
    {
      heading: 'What the main responses claim',
      body: 'Material accounts emphasize composition. Continuity accounts emphasize connected spatiotemporal history and function. Constitution accounts distinguish an object from the stuff composing it. Context-sensitive accounts hold that "same" is a practical notion whose criterion varies with the question being asked. Each response can explain the basic case and each faces a further imagined counterexample.',
    },
    {
      heading: 'Why no experiment settles it',
      body: 'No observation of a real ship decides which criterion is correct, because the dispute is about the meaning and use of an identity claim rather than about a fact discoverable by inspection. Empirical details can make a case more or less intuitively compelling, but they cannot remove the need to choose a criterion. That is why the example remains a philosophical tool rather than a scientific result.',
    },
  ],
  historicalContext:
    'The report about the Athenians’ vessel comes from Plutarch’s Life of Theseus, written centuries after the events it describes. Thomas Hobbes used a related example in De Corpore in the seventeenth century to argue about identity, and the puzzle has since appeared in discussions of personal identity, legal personality, organisations and artefacts. Each era has used it for its own problems, which is another reason to resist the idea that the story has one canonical moral.',
  epistemicBreakdown: {
    'Established about the source':
      'An ancient source reports that a vessel associated with Theseus was maintained by replacing decayed timber. The precise wording depends on translation and manuscript.',
    'Interpretation':
      'Later authors have treated the example as a puzzle about material composition, about spatiotemporal continuity, about constitution, and about the practical context of identity claims.',
    'Contested argument':
      'Whether there is a determinate fact of the matter about identity in such cases, or whether identity claims are context-sensitive, remains disputed.',
    'Thought experiment only':
      'The case is imagined. It establishes no fact about any real vessel and no fact about any situation outside the example.',
    'Transferable use':
      'Ask which criterion of sameness a claim relies on: matter, continuity, function, origin or recorded recognition.',
  },
  keyConcepts: [
    'identity over time', 'material composition', 'spatiotemporal continuity',
    'constitution', 'gradual change', 'duplication', 'criterion choice', 'context sensitivity',
  ],
  supportingSources: [
    bibliographicSource({
      label: 'Plutarch, Life of Theseus, 23 — ancient source for the preserved vessel',
      author: 'Plutarch',
      title: 'Life of Theseus',
      sourceType: 'other',
      verificationNotes: 'Original text is ancient and public domain; translations vary. Summary only, pending confirmation of edition and wording.',
    }),
    bibliographicSource({
      label: 'Hobbes, T., De Corpore, Part II, Chapter 11 (1655) — later use of the puzzle',
      author: 'Thomas Hobbes',
      title: 'De Corpore',
      sourceType: 'other',
      verificationNotes: 'Bibliographic citation only. Exact passage and any verified link require human confirmation.',
    }),
  ],
  limitations: [
    'The scenario is deliberately artificial; real objects rarely undergo complete replacement in a single transparent sequence.',
    'Intuitions about the case differ across readers, so it cannot function as a neutral test of a theory.',
    'A focus on artefacts can obscure the different issues raised by identity claims about people and institutions.',
  ],
  counterarguments: [
    'One may argue that ordinary practice settles the question: we would keep using the same name and registration for the continuously repaired ship.',
    'One may argue that identity is not the interesting notion here and that continuity or historical connectedness is what we actually care about.',
    'One may argue that the reassembled ship inherits the original’s identity because matter is what identity tracks.',
  ],
  commonMisconceptions: [
    'That the puzzle has a single correct answer that philosophers have simply failed to notice.',
    'That the example shows that identity is an illusion.',
    'That the original planks obviously settle which ship is which.',
  ],
  reflectionQuestions: [
    'When you say something is "the same" after changes, what are you actually holding fixed?',
    'Which criterion would matter for a ship registry, and which for a historian of materials?',
    'Can two different descriptions both be correct about identity without contradicting each other?',
  ],
  activities: [
    'List three everyday identity claims you made this week and name the criterion each one relied on.',
  ],
  recommendationTags: [
    'philosophy', 'identity', 'criteria', 'continuity', 'substitution', 'assumptions',
    'reflection', 'records',
  ],
  relatedExperienceKeys: ['platos-allegory-of-the-cave', 'historical-source-reliability', 'moral-responsibility'],
  relatedSpecialistKeys: ['security-systems-tomas'],
  relatedArtifactKeys: ['access-control-and-maintenance-windows'],
  relatedCaseTitles: ['The Midnight Heist', 'The Clocktower Alibi', 'Final Cut'],
  estimatedMinutes: 14,
  difficulty: 'intermediate',
  displayOrder: 2,
  status: 'published',
};
