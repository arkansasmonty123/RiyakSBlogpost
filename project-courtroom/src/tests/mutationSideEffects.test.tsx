import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { commitSaveMutation } from '@/app/App';
import { addEvidenceNote, discoverEvidenceItem, reviewEvidence } from '@/domain/evidence';
import { createInitialSave } from '@/domain/seed';
import type { SaveGame } from '@/domain/types';

/**
 * React queues functional state updaters until render, so a domain result assigned inside a
 * `setSave(prev => ...)` updater is still undefined on the handler's very next line. Every
 * side-effect gated on that result was therefore silently skipped while the mutation itself
 * still persisted. The handlers now run the mutation through commitSaveMutation, which returns
 * the result synchronously. These tests pin that contract and the wiring of every affected
 * handler (the vitest environment is node-only, so the handler wiring is checked structurally).
 */

const APP_PATH = fileURLToPath(new URL('../app/App.tsx', import.meta.url));
const appSource = readFileSync(APP_PATH, { encoding: 'utf8' });

/** Extract a named function's body by brace matching, so the guard survives line-number shifts. */
function functionBody(name: string): string {
  const start = appSource.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Handler ${name} was not found in App.tsx`);
  const open = appSource.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < appSource.length; i += 1) {
    if (appSource[i] === '{') depth += 1;
    if (appSource[i] === '}') {
      depth -= 1;
      if (depth === 0) return appSource.slice(open, i + 1);
    }
  }
  throw new Error(`Handler ${name} has no closing brace in App.tsx`);
}

describe('commitSaveMutation', () => {
  it('runs the mutator once on a clone, returns its result, and commits that exact clone once', () => {
    const save = createInitialSave();
    discoverEvidenceItem(save, 'ev-2');
    reviewEvidence(save, 'ev-2');
    const before = save.notebook.length;
    const committed: SaveGame[] = [];
    let mutatorCalls = 0;

    const entry = commitSaveMutation(
      save,
      (working) => {
        mutatorCalls += 1;
        // addEvidenceNote generates its own id — it must run exactly once.
        return addEvidenceNote(working, 'ev-2', 'contradiction', 'My note');
      },
      (next) => {
        committed.push(next);
      },
    );

    expect(mutatorCalls).toBe(1);
    expect(committed).toHaveLength(1);
    expect(entry).not.toBeNull();
    expect(save.notebook).toHaveLength(before);
    expect(committed[0]).not.toBe(save);
    expect(committed[0].notebook).toHaveLength(before + 1);
    expect(committed[0].notebook[0].id).toBe(entry?.id);
    expect(committed[0].notebook[0].content).toBe('My note');
  });
});

describe('mutation-result handlers', () => {
  it('save note clears the form, announces success and switches to the notebook with one entry', () => {
    const body = functionBody('doSaveNote');
    expect(body).toContain('mutateWithResult');
    expect(body).toContain('setNoteTarget(null)');
    expect(body).toContain("setNoteText('')");
    expect(body).toContain('Note recorded in your notebook');
    expect(body).toContain("setPanel('notebook')");
    expect(body).not.toContain('const outcome');
    expect(body).not.toContain('update((s) =>');
  });

  const handlers = [
    'doSaveKnowledgeConnection',
    'doRecordCustody',
    'doChallenge',
    'doSaveClaimLinks',
    'doAddTheory',
    'doSeniorReview',
    'doFinalBrief',
    'doAdvanceTime',
    'submitAssignment',
    'submitDraft',
    'doSaveDraftVersion',
    'doLoadDraftVersion',
  ];

  it.each(handlers)('%s reads its domain result synchronously instead of from a queued updater', (name) => {
    const body = functionBody(name);
    expect(body).toContain('mutateWithResult');
    expect(body).not.toContain('const outcome');
    expect(body).not.toContain('update((s) =>');
  });
});
