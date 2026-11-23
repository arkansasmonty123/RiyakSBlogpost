import { shouldShowHelp } from '@/domain/onboarding';
import type { SaveGame, SourceJurisdiction, SourceType } from '@/domain/types';

/** Welcome text used on first load and after a full session reset. No canonical truth. */
export const WELCOME_MESSAGE =
  'Adv. Meera Kulkarni: "Welcome. Read the facts carefully. Separate what is known, claimed, disputed, and unknown."';

/** Single, explicit copy for every "start over" confirmation in the UI. */
export const RESET_CONFIRMATION = 'Start over? This erases the local save and cannot be undone.';

/** Confirmation text for the explicit Save button; shown in place, never navigates away. */
export const EXPLICIT_SAVE_NOTICE = 'Saved locally.';

/** Polite, in-header feedback about local persistence; never exposes storage internals. */
export type SaveStatus = 'idle' | 'saved' | 'error';

export interface SourceFormState {
  title: string;
  sourceName: string;
  citation: string;
  sourceType: SourceType;
  jurisdiction: SourceJurisdiction;
  provenance: string;
  sourceUrl: string;
  effectiveDate: string;
  excerpt: string;
  notes: string;
  requestPlaceholder: boolean;
}

export function emptySourceForm(): SourceFormState {
  return {
    title: '',
    sourceName: '',
    citation: '',
    sourceType: 'statute',
    jurisdiction: 'India',
    provenance: '',
    sourceUrl: '',
    effectiveDate: '',
    excerpt: '',
    notes: '',
    requestPlaceholder: false,
  };
}

/**
 * Every transient (non-persisted) UI value for a brand-new session. Literal types keep the
 * blueprint honest: reset always lands on the case panel with blank ids and default filters.
 */
export interface ResetUiState {
  panel: 'case';
  draft: string;
  dialogue: string;
  noteTarget: null;
  noteRelation: 'contradiction';
  noteText: string;
  caseTarget: string;
  custodyText: string;
  challengeGround: 'relevance';
  challengeText: string;
  reviewSummary: string;
  finalSummary: string;
  showSourceIntake: boolean;
  sourceForm: SourceFormState;
  intakeError: string;
  intakeNotice: string;
  theoryText: string;
  theoryStatus: 'known';
  theoryEvidenceIds: string[];
  notebookFilter: 'all';
  journalFilter: 'all';
  editingClaimId: null;
  editingLinks: string[];
  showHelp: boolean;
  saveStatus: SaveStatus;
  saveNotice: string;
}

/**
 * Pure blueprint shared by the first render and by `resetSession`, so the two cannot drift.
 * No id from a previous session survives: every selection, filter and editor is blanked.
 */
export function createResetUiState(save: SaveGame): ResetUiState {
  return {
    panel: 'case',
    // Mirror the save's draft so a fresh session never shows a false "Unsaved changes".
    draft: save.draft.current,
    dialogue: WELCOME_MESSAGE,
    noteTarget: null,
    noteRelation: 'contradiction',
    noteText: '',
    caseTarget: '',
    custodyText: '',
    challengeGround: 'relevance',
    challengeText: '',
    reviewSummary: '',
    finalSummary: '',
    showSourceIntake: false,
    sourceForm: emptySourceForm(),
    intakeError: '',
    intakeNotice: '',
    theoryText: '',
    theoryStatus: 'known',
    theoryEvidenceIds: [],
    notebookFilter: 'all',
    journalFilter: 'all',
    editingClaimId: null,
    editingLinks: [],
    showHelp: shouldShowHelp(save),
    saveStatus: 'idle',
    saveNotice: '',
  };
}
