import { describe, expect, it } from 'vitest';
import { createResetUiState, EXPLICIT_SAVE_NOTICE, RESET_CONFIRMATION, WELCOME_MESSAGE } from '@/app/sessionUi';
import { createInitialSave } from '@/domain/seed';
import { markHelpSeen } from '@/domain/onboarding';
import { resetSave } from '@/storage/save';
import type { StorageLike } from '@/storage/save';

function memoryStorage(): StorageLike {
  const data: Record<string, string> = {};
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe('session reset', () => {
  it('uses one explicit, irreversible-confirmation copy everywhere', () => {
    expect(RESET_CONFIRMATION).toBe('Start over? This erases the local save and cannot be undone.');
    expect(EXPLICIT_SAVE_NOTICE).toBe('Saved locally.');
    expect(WELCOME_MESSAGE).toContain('Welcome.');
  });

  it('returns a fully clean UI blueprint with no stale ids, filters or forms', () => {
    const clean = createResetUiState(createInitialSave());

    expect(clean.panel).toBe('case');
    // The editor mirrors the save, so a fresh session never shows a false unsaved indicator.
    expect(clean.draft).toBe(createInitialSave().draft.current);
    expect(clean.dialogue).toBe(WELCOME_MESSAGE);
    // Every id-bearing selection is cleared, so no stale reference survives a reset.
    expect(clean.noteTarget).toBeNull();
    expect(clean.caseTarget).toBe('');
    expect(clean.editingClaimId).toBeNull();
    expect(clean.editingLinks).toEqual([]);
    expect(clean.theoryEvidenceIds).toEqual([]);
    expect(clean.noteText).toBe('');
    expect(clean.custodyText).toBe('');
    expect(clean.challengeText).toBe('');
    expect(clean.reviewSummary).toBe('');
    expect(clean.finalSummary).toBe('');
    expect(clean.theoryText).toBe('');
    // Filters, forms and notices return to their defaults.
    expect(clean.notebookFilter).toBe('all');
    expect(clean.journalFilter).toBe('all');
    expect(clean.showSourceIntake).toBe(false);
    expect(clean.sourceForm.title).toBe('');
    expect(clean.intakeError).toBe('');
    expect(clean.intakeNotice).toBe('');
    expect(clean.saveStatus).toBe('idle');
    expect(clean.saveNotice).toBe('');
  });

  it('reopens first-day help after reset even if the player had dismissed it', () => {
    const played = createInitialSave();
    markHelpSeen(played);
    expect(createResetUiState(played).showHelp).toBe(false);

    // resetSave returns a fresh save with no helpSeen flag, so the blueprint reopens help.
    const fresh = resetSave(memoryStorage());
    const clean = createResetUiState(fresh);
    expect(clean.showHelp).toBe(true);
    expect(clean.draft).toBe(fresh.draft.current);
  });
});
