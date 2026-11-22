import { DIALOGUE_SCENES } from './seed';
import { makeId } from './progression';
import type { DialogueScene, NotebookEntry, SaveGame } from './types';

export function availableDialogueScenes(save: SaveGame): DialogueScene[] {
  return DIALOGUE_SCENES.filter(
    (scene) => save.clock.day >= scene.minDay && !save.usedDialogueSceneIds.includes(scene.id),
  );
}

export interface DialogueResult {
  ok: boolean;
  reason?: string;
  reply?: string;
  memory?: string;
  characterId?: string;
  characterName?: string;
  /** Player-knowledge facts learned from this exchange, if any. */
  reveals?: string[];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Apply a deterministic dialogue consequence: relationship dimensions change by
 * bounded amounts and a specific memory event is recorded. Replies/memories are static
 * authored content and never read canonical case truth. Mutates the given save on success.
 */
export function applyDialogueChoice(save: SaveGame, sceneId: string, choiceId: string): DialogueResult {
  const scene = DIALOGUE_SCENES.find((s) => s.id === sceneId);
  if (!scene) return { ok: false, reason: 'Dialogue scene not found.' };
  if (save.clock.day < scene.minDay) return { ok: false, reason: 'Not available yet.' };
  if (scene.once && save.usedDialogueSceneIds.includes(scene.id)) {
    return { ok: false, reason: 'Already resolved.' };
  }
  const choice = scene.choices.find((c) => c.id === choiceId);
  if (!choice) return { ok: false, reason: 'Choice not found.' };

  for (const effect of choice.effects) {
    const relationship = save.relationships.find(
      (r) => r.fromId === 'player' && r.toId === effect.characterId,
    );
    if (relationship) relationship[effect.dimension] = clamp(relationship[effect.dimension] + effect.amount);
  }

  save.memories.unshift({
    id: makeId('m'),
    day: save.clock.day,
    summary: choice.memory,
    participants: ['player', scene.characterId],
  });
  // Interviews (and other scenes) may legitimately add player-knowledge facts. These are
  // authored, player-legible statements — never canonical truth — and are surfaced in the notebook.
  for (const fact of choice.reveals ?? []) {
    save.caseFile.playerKnowledge.push(fact);
    const entry: NotebookEntry = {
      id: makeId('n'),
      day: save.clock.day,
      kind: 'fact',
      title: 'Client interview — fact stated',
      content: fact,
      verified: false,
    };
    save.notebook.unshift(entry);
  }
  if (choice.setsFlag) save.flags[choice.setsFlag] = true;

  if (scene.once) save.usedDialogueSceneIds.push(scene.id);

  return {
    ok: true,
    reply: choice.reply,
    memory: choice.memory,
    characterId: scene.characterId,
    characterName: save.characters.find((c) => c.id === scene.characterId)?.name,
    reveals: choice.reveals ? [...choice.reveals] : undefined,
  };
}
