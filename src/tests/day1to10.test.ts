import { describe, expect, it } from 'vitest';
import { createInitialSave } from '@/domain/seed';
import { assertNoCanonicalTruthLeak, toPlayerCaseView } from '@/domain/caseAccess';
import { advanceClock, currentObjective, MAX_DAY, reviewAssignment } from '@/domain/progression';
import { applyDialogueChoice, availableDialogueScenes } from '@/domain/dialogue';
import { addEvidenceNote, discoverEvidenceItem, reviewEvidence } from '@/domain/evidence';
import {
  challengeEvidenceAdmissibility,
  recordCustodyObservation,
  submitFinalBrief,
  submitSeniorReview,
} from '@/domain/casework';
import type { SaveGame } from '@/domain/types';

const GOOD_SUMMARY =
  'Issue: what happened outside the canteen. I reviewed the medical report, the partial clip and the witness note, attached the verified educational summary, and kept known facts separate from claims and disputed points.';

function advanceToDay(save: SaveGame, day: number): void {
  while (save.clock.day < day) advanceClock(save);
}

function addSourceNote(save: SaveGame): void {
  save.notebook.unshift({
    id: 'n-source',
    day: save.clock.day,
    kind: 'research',
    title: 'Source: verified educational summary',
    content: 'Verified educational summary on evidence handling.',
    sourceId: 'ls-4',
    source: 'Educational summary',
    verified: true,
  });
}

function discoverAndReview(save: SaveGame, id: string): void {
  if (!discoverEvidenceItem(save, id)) throw new Error(`missing ${id}`);
  reviewEvidence(save, id);
}

function reviewFirstThreeAssignments(save: SaveGame): void {
  discoverAndReview(save, 'ev-1');
  addSourceNote(save);
  expect(reviewAssignment(save, 'a1').ok).toBe(true);

  advanceToDay(save, 3);
  discoverAndReview(save, 'ev-2');
  expect(reviewAssignment(save, 'a2').ok).toBe(true);

  advanceToDay(save, 5);
  discoverAndReview(save, 'ev-3');
  addEvidenceNote(save, 'ev-3', 'contradiction', 'The witness account does not address the gap in the clip.');
  expect(reviewAssignment(save, 'a3').ok).toBe(true);
}

describe('Day 1–10 chapter flow', () => {
  it('defines an ordered assignment chain covering Days 1 through 10', () => {
    const save = createInitialSave();
    expect(save.assignments.map((a) => a.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']);
    expect(save.assignments.map((a) => a.day)).toEqual([1, 3, 5, 6, 7, 8, 9, 10]);
    expect(MAX_DAY).toBe(10);
    expect(save.assignments.slice(1).every((a) => a.unlockAfter)).toBe(true);
  });

  it('unlocks each milestone only by day plus reviewed prerequisite work', () => {
    const save = createInitialSave();
    const a4 = save.assignments.find((a) => a.id === 'a4')!;
    const a8 = save.assignments.find((a) => a.id === 'a8')!;

    // Day 5: a4 has the day reached but its prerequisite a3 is not reviewed yet.
    advanceToDay(save, 5);
    expect(a4.status).toBe('locked');
    expect(a8.status).toBe('locked');

    reviewFirstThreeAssignments(save); // still Day 5: prerequisite met, but Day 6 not reached
    expect(a4.status).toBe('locked');
    expect(a8.status).toBe('locked');

    advanceToDay(save, 6);
    expect(a4.status).toBe('active');
    expect(currentObjective(save)?.assignmentId).toBe('a4');
  });

  it('caps the in-game clock at the final chapter day', () => {
    const save = createInitialSave();
    advanceToDay(save, MAX_DAY);
    expect(save.clock.day).toBe(10);
    for (let i = 0; i < 6; i += 1) advanceClock(save);
    expect(save.clock.day).toBe(10);
  });

  it('plays a full Day 1–10 path through to a closed case and no remaining objective', () => {
    const save = createInitialSave();

    // Day 2 client interview (a legitimate player-knowledge milestone).
    advanceToDay(save, 2);
    expect(availableDialogueScenes(save).map((s) => s.id)).toContain('d-client-interview');
    expect(applyDialogueChoice(save, 'd-client-interview', 'ask-personal-observation').ok).toBe(true);
    expect(save.flags.clientInterviewDone).toBe(true);

    reviewFirstThreeAssignments(save);

    // Day 6 — interview record.
    advanceToDay(save, 6);
    expect(reviewAssignment(save, 'a4').ok).toBe(true);

    // Day 7 — chain of custody.
    advanceToDay(save, 7);
    expect(recordCustodyObservation(save, 'ev-2', 'The clip export has no sealing record; note the gap.').ok).toBe(
      true,
    );
    expect(reviewAssignment(save, 'a5').ok).toBe(true);

    // Day 8 — admissibility challenge.
    advanceToDay(save, 8);
    expect(
      challengeEvidenceAdmissibility(
        save,
        'ev-3',
        'reliability',
        'The consistency of the account was never tested against the recording.',
      ).ok,
    ).toBe(true);
    expect(reviewAssignment(save, 'a6').ok).toBe(true);

    // Day 9 — senior review loop.
    advanceToDay(save, 9);
    const first = submitSeniorReview(save, 'a7', GOOD_SUMMARY);
    expect(first.ok).toBe(true);
    expect(first.status).toBe('needs_revision');
    expect(save.flags.reviewAccepted).toBe(false);
    const second = submitSeniorReview(save, 'a7', `${GOOD_SUMMARY} Revised to address the senior's notes.`);
    expect(second.status).toBe('accepted');
    expect(save.flags.reviewAccepted).toBe(true);
    expect(save.assignments.find((a) => a.id === 'a7')!.status).toBe('reviewed');

    // Day 10 — final brief.
    advanceToDay(save, 10);
    const final = submitFinalBrief(save, GOOD_SUMMARY);
    expect(final.ok).toBe(true);
    expect(['strong', 'solid', 'shaky']).toContain(final.tier);
    expect(save.flags.chapterOneComplete).toBe(true);
    expect(save.flags.finalBriefSubmitted).toBe(true);
    expect(save.caseFile.status).toBe('closed');
    expect(currentObjective(save)).toBeNull();
  });
});

describe('client interview knowledge boundaries', () => {
  it('reveals only player-knowledge facts and respects what the client can know', () => {
    const save = createInitialSave();
    advanceToDay(save, 2);
    const trustBefore = save.relationships.find((r) => r.toId === 'client')!.trust;
    const knowledgeBefore = save.caseFile.playerKnowledge.length;

    const result = applyDialogueChoice(save, 'd-client-interview', 'ask-personal-observation');
    expect(result.ok).toBe(true);
    expect(result.characterId).toBe('client');
    expect(save.relationships.find((r) => r.toId === 'client')!.trust).toBe(trustBefore + 6);
    expect(save.caseFile.playerKnowledge.length).toBeGreaterThan(knowledgeBefore + 1);
    expect(save.notebook.some((n) => n.title === 'Client interview — fact stated')).toBe(true);
    // Revealed facts are the client's account, not canonical timeline/culprit details.
    expect(JSON.stringify(result.reveals)).not.toContain('18:12');
    expect(JSON.stringify(result.reveals)).not.toContain('prior dispute');
  });

  it('a fault probe is refused, reveals nothing and damages trust; the scene resolves once', () => {
    const save = createInitialSave();
    advanceToDay(save, 2);
    const client = save.relationships.find((r) => r.toId === 'client')!;
    const knowledgeBefore = save.caseFile.playerKnowledge.length;
    const result = applyDialogueChoice(save, 'd-client-interview', 'ask-who-is-at-fault');

    expect(result.ok).toBe(true);
    expect(result.reply).toContain('I cannot tell you that');
    expect(client.trust).toBe(20); // 25 - 5
    expect(client.resentment).toBe(3);
    expect(save.caseFile.playerKnowledge.length).toBe(knowledgeBefore);
    expect(save.flags.clientInterviewDone).toBe(true);
    expect(applyDialogueChoice(save, 'd-client-interview', 'ask-personal-observation').ok).toBe(false);
    expect(save.caseFile.playerKnowledge.length).toBe(knowledgeBefore);
  });
});

describe('evidence custody and admissibility decisions', () => {
  it('requires discovery and review before custody or a challenge can be recorded', () => {
    const save = createInitialSave();
    expect(recordCustodyObservation(save, 'ev-2', 'sealed?').ok).toBe(false);
    expect(challengeEvidenceAdmissibility(save, 'ev-3', 'custody', 'no record').ok).toBe(false);
    expect(save.flags.custodyLogged).toBe(false);
    expect(save.flags.admissibilityChallenged).toBe(false);

    discoverEvidenceItem(save, 'ev-2');
    expect(recordCustodyObservation(save, 'ev-2', 'still unhandled').ok).toBe(false);
    discoverEvidenceItem(save, 'ev-3');
    expect(challengeEvidenceAdmissibility(save, 'ev-3', 'custody', 'still unhandled').ok).toBe(false);

    reviewEvidence(save, 'ev-2');
    reviewEvidence(save, 'ev-3');
    expect(recordCustodyObservation(save, 'ev-2', '   ').ok).toBe(false);
    expect(challengeEvidenceAdmissibility(save, 'ev-3', 'custody', '   ').ok).toBe(false);
  });

  it('records deterministic consequences in notebook, memory and reputation only', () => {
    const save = createInitialSave();
    discoverAndReview(save, 'ev-2');
    discoverAndReview(save, 'ev-3');
    const reliabilityBefore = save.player.reputation.reliability;
    const senior = save.relationships.find((r) => r.toId === 'senior')!;
    const respectBefore = senior.respect;

    const custody = recordCustodyObservation(save, 'ev-2', 'No documented seal on the export; the gap is unverified.');
    expect(custody.ok).toBe(true);
    expect(save.custodyLog[0].evidenceId).toBe('ev-2');
    expect(save.flags.custodyLogged).toBe(true);
    expect(save.player.reputation.reliability).toBe(reliabilityBefore + 1);
    expect(save.memories[0].summary).toContain('chain-of-custody observation');
    expect(save.notebook.some((n) => n.title.startsWith('Chain-of-custody observation'))).toBe(true);

    const challenge = challengeEvidenceAdmissibility(
      save,
      'ev-3',
      'reliability',
      'The witness account was never tested against the available recording.',
    );
    expect(challenge.ok).toBe(true);
    expect(save.challenges[0].ground).toBe('reliability');
    expect(save.flags.admissibilityChallenged).toBe(true);
    expect(senior.respect).toBe(respectBefore + 2);
    expect(challenge.feedback).toContain('authenticity has not been determined');
    expect(save.notebook.some((n) => n.title.startsWith('Admissibility challenge'))).toBe(true);

    // No canonical authenticity value is written into any player-facing field.
    const playerFacing = JSON.stringify({
      view: toPlayerCaseView(save.caseFile),
      notebook: save.notebook,
      memories: save.memories,
      custodyLog: save.custodyLog,
      challenges: save.challenges,
    }).toLowerCase();
    expect(playerFacing).not.toContain('evidenceauthenticity');
    expect(playerFacing).not.toContain('"ev-3":false');
    expect(playerFacing).not.toContain('prior dispute');
    expect(() =>
      assertNoCanonicalTruthLeak({ custodyLog: save.custodyLog, challenges: save.challenges }),
    ).not.toThrow();
  });
});

describe('senior review loop and final consequence', () => {
  function readyForReview(): SaveGame {
    const save = createInitialSave();
    advanceToDay(save, 2);
    applyDialogueChoice(save, 'd-client-interview', 'ask-personal-observation');
    reviewFirstThreeAssignments(save);
    advanceToDay(save, 6);
    expect(reviewAssignment(save, 'a4').ok).toBe(true);
    advanceToDay(save, 7);
    recordCustodyObservation(save, 'ev-2', 'No sealing record; gap noted.');
    expect(reviewAssignment(save, 'a5').ok).toBe(true);
    advanceToDay(save, 8);
    challengeEvidenceAdmissibility(save, 'ev-3', 'provenance', 'Origin and integrity of the note are not documented.');
    expect(reviewAssignment(save, 'a6').ok).toBe(true);
    advanceToDay(save, 9);
    return save;
  }

  it('cannot accept on the first submission and requires a revision', () => {
    const save = readyForReview();
    const competenceBefore = save.player.reputation.competence;
    const first = submitSeniorReview(save, 'a7', GOOD_SUMMARY);
    expect(first.status).toBe('needs_revision');
    expect(first.gaps.some((g) => g.includes('Revise'))).toBe(true);
    expect(save.reviewRounds).toHaveLength(1);
    expect(save.reviewRounds[0].round).toBe(1);
    expect(save.assignments.find((a) => a.id === 'a7')!.status).toBe('submitted');
    expect(save.player.reputation.competence).toBe(competenceBefore);
    expect(save.flags.reviewAccepted).toBe(false);
  });

  it('accepts a revised resubmission and updates reputation, relationship, memory and notebook', () => {
    const save = readyForReview();
    submitSeniorReview(save, 'a7', GOOD_SUMMARY);
    const competenceBefore = save.player.reputation.competence;
    const senior = save.relationships.find((r) => r.toId === 'senior')!;
    const trustBefore = senior.trust;

    const second = submitSeniorReview(save, 'a7', `${GOOD_SUMMARY} Revised and resubmitted with the gap addressed.`);
    expect(second.status).toBe('accepted');
    expect(second.round?.round).toBe(2);
    expect(save.reviewRounds).toHaveLength(2);
    expect(save.player.reputation.competence).toBe(competenceBefore + 2);
    expect(senior.trust).toBe(trustBefore + 4);
    expect(save.memories.some((m) => m.summary.includes('Senior review') && m.summary.includes('accepted'))).toBe(true);
    expect(save.notebook.some((n) => n.title.includes('Senior feedback'))).toBe(true);
    expect(save.flags.reviewAccepted).toBe(true);
  });

  it('blocks an unfocused summary that asserts fault or omits a basis', () => {
    const save = readyForReview();
    submitSeniorReview(save, 'a7', GOOD_SUMMARY);
    const faulted = submitSeniorReview(save, 'a7', 'The accused is guilty and at fault; believe the witness.');
    expect(faulted.status).toBe('needs_revision');
    expect(faulted.gaps.some((g) => g.toLowerCase().includes('at fault'))).toBe(true);
    const vague = submitSeniorReview(save, 'a7', 'short');
    expect(vague.status).toBe('needs_revision');
    expect(vague.gaps.some((g) => g.includes('at least 40 characters'))).toBe(true);
  });

  it('gates the final brief on all milestones and closes the chapter with a deterministic consequence', () => {
    const save = readyForReview();
    submitSeniorReview(save, 'a7', GOOD_SUMMARY);
    expect(submitSeniorReview(save, 'a7', `${GOOD_SUMMARY} Revised.`).status).toBe('accepted');
    advanceToDay(save, 10);

    // Too-short summary is blocked.
    expect(submitFinalBrief(save, 'too short').ok).toBe(false);

    // Missing a milestone flag is blocked.
    const missingFlag = structuredClone(save);
    missingFlag.flags.admissibilityChallenged = false;
    expect(submitFinalBrief(missingFlag, GOOD_SUMMARY).ok).toBe(false);

    const result = submitFinalBrief(save, GOOD_SUMMARY);
    expect(result.ok).toBe(true);
    expect(result.consequence).toBeTruthy();
    expect(save.flags.chapterOneComplete).toBe(true);
    expect(save.caseFile.status).toBe('closed');
    expect(save.memories.some((m) => m.summary.includes('Final brief submitted'))).toBe(true);
    expect(submitFinalBrief(save, GOOD_SUMMARY).ok).toBe(false); // idempotent
  });
});

describe('Day 1–10 no-leak guardrails', () => {
  it('never exposes canonical truth or hidden motives in any new player-facing state', () => {
    const save = createInitialSave();
    advanceToDay(save, 2);
    applyDialogueChoice(save, 'd-client-interview', 'ask-about-recording');
    reviewFirstThreeAssignments(save);
    recordCustodyObservation(save, 'ev-2', 'Export handling is undocumented.');
    challengeEvidenceAdmissibility(save, 'ev-3', 'custody', 'Custody record for the note is missing.');
    submitSeniorReview(save, 'a7', GOOD_SUMMARY);
    submitFinalBrief(save, GOOD_SUMMARY);

    const playerFacing = {
      view: toPlayerCaseView(save.caseFile),
      notebook: save.notebook,
      memories: save.memories,
      custodyLog: save.custodyLog,
      challenges: save.challenges,
      reviewRounds: save.reviewRounds,
      feedback: save.assignments.map((a) => a.feedback),
    };
    const json = JSON.stringify(playerFacing).toLowerCase();
    expect(() => assertNoCanonicalTruthLeak(playerFacing)).not.toThrow();
    for (const forbidden of [
      'canonicaltruth',
      'actualevents',
      'actualtimeline',
      'responsibleparties',
      'hiddenmotives',
      'evidenceauthenticity',
      'prior dispute',
      '18:12',
      '"ev-3":false',
    ]) {
      expect(json).not.toContain(forbidden);
    }
  });
});
