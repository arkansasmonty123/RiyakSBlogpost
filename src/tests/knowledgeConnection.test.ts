import { describe, expect, it } from 'vitest';
import { addKnowledgeConnectionEntry } from '@/domain/notebook';
import { submitSeniorReview } from '@/domain/casework';
import { createInitialSave } from '@/domain/seed';
import { discoverEvidenceItem, reviewEvidence } from '@/domain/evidence';

describe('knowledge connection slice', () => {
  it('adds a player-authored interdisciplinary notebook entry', () => {
    const save = createInitialSave();
    const ev = save.caseFile.evidence[0];
    discoverEvidenceItem(save, ev.id);
    reviewEvidence(save, ev.id);
    const entry = addKnowledgeConnectionEntry(
      save,
      {
        evidenceId: ev.id,
        legalTopic: ev.title,
        domain: 'forensic',
        relatedConcept: 'timestamp metadata',
        description: 'Timing can be compared with independent records.',
      },
      'kn-test',
    );
    expect(entry.kind).toBe('knowledge-connection');
    expect(entry.connection?.domain).toBe('forensic');
    expect(save.notebook[0].id).toBe('kn-test');
  });

  it('senior review gives deterministic feedback when a relevant connection exists', () => {
    const save = createInitialSave();
    // set up minimal conditions for an assignment review path is complex; use submitSeniorReview directly after satisfying required fields.
    const assignment = save.assignments.find((a) => a.id === 'a7');
    expect(assignment).toBeDefined();
    // Unlock/satisfy prerequisites crudely for a deterministic unit check by forcing flags/requirements.
    save.clock.day = 10;
    for (const a of save.assignments) {
      if (['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].includes(a.id)) a.status = 'reviewed';
    }
    assignment!.status = 'active';
    for (const id of assignment!.requiredEvidenceIds) {
      const ev = save.caseFile.evidence.find((e) => e.id === id);
      if (ev) {
        ev.discovered = true;
        ev.reviewed = true;
      }
    }
    for (const sid of assignment!.requiredSourceIds) {
      save.notebook.unshift({
        id: `src-${sid}`,
        day: 1,
        kind: 'research',
        title: 's',
        content: 'c',
        sourceId: sid,
        verified: true,
      });
    }
    for (const f of assignment!.requiredFlags ?? []) (save.flags as any)[f] = true;
    save.flags.reviewAccepted = false;
    const reviewedId = assignment!.requiredEvidenceIds[0];
    addKnowledgeConnectionEntry(
      save,
      {
        evidenceId: reviewedId,
        legalTopic: 'Evidence',
        domain: 'technology',
        relatedConcept: 'metadata',
        description: 'test',
      },
      'kn-a7',
    );
    const result = submitSeniorReview(
      save,
      'a7',
      'This is a sufficiently long summary to pass the minimum length requirement for the senior review workflow and mentions evidence and sources.',
    );
    expect(result.ok).toBe(true);
    expect(result.strengths.join(' ')).toMatch(/Interdisciplinary reasoning/i);
  });
});
