import { describe, expect, it } from 'vitest';
import { createInitialSave } from '@/domain/seed';
import { assertNoCanonicalTruthLeak, toPlayerCaseView } from '@/domain/caseAccess';
import { advanceClock } from '@/domain/progression';
import { applyDialogueChoice, availableDialogueScenes } from '@/domain/dialogue';
import { addEvidenceNote, discoverEvidenceItem, reviewEvidence, setEvidenceAssessment } from '@/domain/evidence';
import { loadDraftVersion, MAX_DRAFT_CHARS, MAX_DRAFT_VERSIONS, saveDraftVersion } from '@/domain/draft';
import type { SaveGame } from '@/domain/types';

describe('character dialogue consequences', () => {
  it('updates multiple relationship dimensions and records a specific memory once', () => {
    const save = createInitialSave();
    const seniorBefore = save.relationships.find((r) => r.toId === 'senior')!;
    expect(availableDialogueScenes(save).map((s) => s.id)).toEqual(['d-senior-intro']);

    const result = applyDialogueChoice(save, 'd-senior-intro', 'separate-facts');
    expect(result.ok).toBe(true);
    expect(result.reply).toContain('Facts, claims and unknowns');
    expect(seniorBefore.trust).toBe(40);
    expect(seniorBefore.respect).toBe(45);
    expect(save.memories[0].summary).toBe(result.memory);
    expect(save.memories[0].participants).toEqual(['player', 'senior']);
    expect(save.usedDialogueSceneIds).toContain('d-senior-intro');

    expect(applyDialogueChoice(save, 'd-senior-intro', 'cite-from-memory').ok).toBe(false);
    expect(availableDialogueScenes(save).map((s) => s.id)).not.toContain('d-senior-intro');
  });

  it('negative choices move rivalry/resentment and respect knowledge boundaries', () => {
    const save = createInitialSave();
    advanceClock(save); // Day 1 afternoon
    advanceClock(save); // evening
    advanceClock(save); // Day 2 morning
    const peerBefore = save.relationships.find((r) => r.toId === 'peer')!;
    const clerkBefore = save.relationships.find((r) => r.toId === 'clerk')!;
    const peerResult = applyDialogueChoice(save, 'd-peer-day2', 'decline-help');
    expect(peerResult.ok).toBe(true);
    expect(peerBefore.trust).toBe(43);
    expect(peerBefore.affection).toBe(17);
    expect(peerBefore.rivalry).toBe(13);

    // The clerk has no legal conclusions to give; his reply refuses rather than leaking truth.
    for (let i = 0; i < 6; i += 1) advanceClock(save);
    expect(save.clock.day).toBe(4);
    const clerkResult = applyDialogueChoice(save, 'd-clerk-day4', 'ask-fault');
    expect(clerkResult.ok).toBe(true);
    expect(clerkResult.reply).toContain('not for me to say');
    expect(clerkBefore.respect).toBe(25);
    expect(clerkBefore.resentment).toBe(4);

    const playerFacing = JSON.stringify([peerResult.reply, peerResult.memory, clerkResult.reply, clerkResult.memory]);
    expect(() => assertNoCanonicalTruthLeak({ dialogue: playerFacing })).not.toThrow();
    // No canonical-only details appear in authored dialogue content.
    expect(playerFacing).not.toContain('prior dispute');
    expect(playerFacing).not.toContain('18:12');
    expect(playerFacing).not.toContain('hidden motive');
  });
});

describe('evidence interactions and truth boundaries', () => {
  it('gates review and assessment behind discovery, then keeps authenticity hidden', () => {
    const save = createInitialSave();
    expect(reviewEvidence(save, 'ev-1')).toBe(false);
    expect(setEvidenceAssessment(save, 'ev-1', { admissibility: 'admissible' })).toBe(false);
    expect(addEvidenceNote(save, 'ev-1', 'contradiction', 'note')).toBeNull();

    let view = toPlayerCaseView(save.caseFile);
    expect(view.evidence[0].assessment).toBeNull();
    expect(JSON.stringify(view)).not.toContain('authenticity');

    discoverEvidenceItem(save, 'ev-1');
    view = toPlayerCaseView(save.caseFile);
    expect(view.evidence[0].assessment).toBeNull(); // discovered but not reviewed
    expect(view.evidence[0].admissibility).toBe('questionable');

    expect(reviewEvidence(save, 'ev-1')).toBe(true);
    expect(reviewEvidence(save, 'ev-1')).toBe(false);
    expect(setEvidenceAssessment(save, 'ev-1', {
      admissibility: 'questionable', reliability: 'medium', rationale: 'Timing disputed in the report.',
    })).toBe(true);

    view = toPlayerCaseView(save.caseFile);
    expect(view.evidence[0].assessment?.rationale).toBe('Timing disputed in the report.');
    expect(view.evidence[0].reviewed).toBe(true);
    expect(JSON.stringify(view)).not.toContain('authenticity');
    expect(() => assertNoCanonicalTruthLeak(view)).not.toThrow();

    const note = addEvidenceNote(save, 'ev-1', 'contradiction', 'Report timing conflicts with the clip timeline.');
    expect(note?.kind).toBe('contradiction');
    expect(note?.evidenceId).toBe('ev-1');
    expect(note?.relation).toBe('contradiction');
    const noteJson = JSON.stringify(note);
    expect(noteJson).not.toContain('authenticity');
    expect(noteJson).not.toContain('evidenceAuthenticity');
    expect(noteJson).not.toContain('"ev-1":true');
    expect(addEvidenceNote(save, 'ev-1', 'contradiction', '   ')).toBeNull();
  });

  it('never exposes canonical authenticity through review of the fabricated-evidence item', () => {
    const save: SaveGame = createInitialSave();
    // ev-3 has canonical authenticity false; the player side must not learn this.
    expect(save.caseFile.canonicalTruth.evidenceAuthenticity['ev-3']).toBe(false);
    discoverEvidenceItem(save, 'ev-3');
    reviewEvidence(save, 'ev-3');
    addEvidenceNote(save, 'ev-3', 'corroboration', 'Statement is consistent with the medical timing.');

    const playerFacing = { view: toPlayerCaseView(save.caseFile), notebook: save.notebook, memories: save.memories };
    const json = JSON.stringify(playerFacing).toLowerCase();
    expect(() => assertNoCanonicalTruthLeak(playerFacing)).not.toThrow();
    expect(json).not.toContain('evidenceauthenticity');
    expect(json).not.toContain('"ev-3":false');
    expect(json).not.toContain('"ev-3": false');
    expect(json).not.toContain('prior dispute');
  });
});

describe('draft version history', () => {
  it('snapshots day/slot/timestamp, loads a prior version and bounds history size', () => {
    const save = createInitialSave();
    const first = saveDraftVersion(save, 'Issue: first version')!;
    expect(first.day).toBe(1);
    expect(first.slot).toBe('morning');
    expect(Number.isNaN(Date.parse(first.savedAt))).toBe(false);
    expect(save.draft.current).toBe('Issue: first version');

    advanceClock(save);
    advanceClock(save);
    advanceClock(save);
    const second = saveDraftVersion(save, 'Issue: second version')!;
    expect(second.day).toBe(2);
    expect(loadDraftVersion(save, first.id)).toBe('Issue: first version');
    expect(save.draft.current).toBe('Issue: first version');
    expect(loadDraftVersion(save, 'missing')).toBeNull();

    for (let i = 0; i < MAX_DRAFT_VERSIONS + 5; i += 1) saveDraftVersion(save, `text ${i}`);
    expect(save.draft.versions).toHaveLength(MAX_DRAFT_VERSIONS);
    expect(save.draft.versions[0].text).toBe(`text ${MAX_DRAFT_VERSIONS + 4}`);

    const huge = 'x'.repeat(MAX_DRAFT_CHARS + 100);
    const capped = saveDraftVersion(save, huge)!;
    expect(capped.text).toHaveLength(MAX_DRAFT_CHARS);
  });
});
