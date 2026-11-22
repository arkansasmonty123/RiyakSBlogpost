import { useMemo, useState } from 'react';
import { SceneArt } from '@/app/SceneArt';
import { config } from '@/config/env';
import { loadSave, persistSave, resetSave } from '@/storage/save';
import { recordAudit } from '@/domain/audit';
import { checkDraftCitations } from '@/domain/guards';
import { buildChapterCompletionSummary, isChapterComplete } from '@/domain/completion';
import { markHelpSeen, shouldShowHelp } from '@/domain/onboarding';
import { canCiteAsAuthoritative, intakeSource, MAX_SOURCE_FIELDS, SOURCE_JURISDICTIONS, SOURCE_TYPES } from '@/domain/legalSources';
import { describeHotspotAction, getLocationForViewpoint, getViewpoint, LOCATIONS, viewpointsForLocation } from '@/domain/scenes';
import { assertNoCanonicalTruthLeak, toPlayerCaseView } from '@/domain/caseAccess';
import { buildCaseJournal, groupJournalByDay, JOURNAL_KINDS } from '@/domain/journal';
import type { JournalKind } from '@/domain/journal';
import { buildCaseSummary } from '@/domain/caseSummary';
import { pluralize } from '@/domain/evidenceSynthesis';
import { advanceClock, currentObjective, isAssignmentUnlocked, makeId, MAX_DAY, reviewAssignment } from '@/domain/progression';
import { applyDialogueChoice, availableDialogueScenes } from '@/domain/dialogue';
import { addEvidenceNote, discoverEvidenceItem, reviewEvidence, setEvidenceAssessment } from '@/domain/evidence';
import {
  challengeEvidenceAdmissibility,
  CHALLENGE_GROUNDS,
  GROUND_FEEDBACK,
  recordCustodyObservation,
  submitFinalBrief,
  submitSeniorReview,
} from '@/domain/casework';
import { loadDraftVersion, MAX_DRAFT_CHARS, saveDraftVersion, setCurrentDraft } from '@/domain/draft';
import {
  addTheoryClaim,
  getTheorySupport,
  groupTheoryClaims,
  setClaimEvidenceLinks,
  THEORY_STATUSES,
} from '@/domain/theory';
import type {
  Admissibility,
  Assignment,
  ChallengeGround,
  NotebookEntry,
  Reliability,
  SaveGame,
  SourceJurisdiction,
  SourceType,
  TheoryStatus,
} from '@/domain/types';

const PANELS = ['case', 'assignments', 'evidence', 'casework', 'theory', 'research', 'draft', 'notebook', 'journal', 'dialogue'] as const;

/** Plain-language names so guidance reads like an action, not an internal panel id. */
const PANEL_LABELS: Record<Panel, string> = {
  case: 'case file',
  assignments: 'assignments',
  evidence: 'evidence board',
  casework: 'casework',
  theory: 'case theory',
  research: 'research',
  draft: 'draft editor',
  notebook: 'notebook',
  journal: 'timeline',
  dialogue: 'conversations',
  completion: 'chapter summary',
};

/** Static greetings shown when a character hotspot opens the dialogue panel. No canonical truth. */
const DIALOGUE_GREETINGS: Record<string, string> = {
  receptionist: 'Deepa: "I keep the diary and the visitor log. I can tell you who signed in and when — not what was said in private."',
  opposing: 'Adv. Vikram Rathore: "I argue from the material that has been disclosed. Let us keep it that way."',
  junior: 'Priya Nair: "I work from the record and the disclosed material. Ask me what I actually know."',
  medical: 'Dr. Kavita Iyer: "I can explain what the clinic record shows. I cannot tell you who caused the injury."',
  rival: 'Adv. Nisha Deshmukh: "I argue from the disclosed record too. I will not treat a hunch as a fact — and I expect the same from you."',
  supervisor: 'Iqbal Sheikh: "I can explain what the duty roster records and what I personally saw. I cannot say who moved first."',
};

type WorkPanel = (typeof PANELS)[number];
/** `completion` is reached only after the final brief closes the chapter. */
type Panel = WorkPanel | 'completion';

function makeNotebookEntry(entry: Omit<NotebookEntry, 'id' | 'day'>, save: SaveGame): NotebookEntry {
  return { id: makeId('n'), day: save.clock.day, ...entry };
}

/** A labelled block of the case-file board; counts make the record easy to scan. */
function FileSection({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="bg-bar-panel2 p-3 rounded border border-white/5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs uppercase tracking-wide text-bar-gold">{title}</h3>
        <span className="text-[11px] text-bar-muted" aria-hidden="true">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-bar-muted mt-2">{empty}</p>
      ) : (
        <ul className="list-disc ml-5 mt-2 space-y-1 text-xs text-bar-text/90">
          {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )}
    </section>
  );
}

interface SourceFormState {
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

function emptySourceForm(): SourceFormState {
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

export function App({ initialPanel = 'case' }: { initialPanel?: Panel }) {
  const [save, setSave] = useState<SaveGame>(() => loadSave());
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [draft, setDraft] = useState<string>(() => save.draft.current);
  const [dialogue, setDialogue] = useState<string>(
    'Adv. Meera Kulkarni: "Welcome. Read the facts carefully. Separate what is known, claimed, disputed, and unknown."',
  );
  const [noteTarget, setNoteTarget] = useState<string | null>(null);
  const [noteRelation, setNoteRelation] = useState<'contradiction' | 'corroboration'>('contradiction');
  const [noteText, setNoteText] = useState('');
  const [caseTarget, setCaseTarget] = useState('');
  const [custodyText, setCustodyText] = useState('');
  const [challengeGround, setChallengeGround] = useState<ChallengeGround>('relevance');
  const [challengeText, setChallengeText] = useState('');
  const [reviewSummary, setReviewSummary] = useState('');
  const [finalSummary, setFinalSummary] = useState('');
  const [showSourceIntake, setShowSourceIntake] = useState(false);
  const [sourceForm, setSourceForm] = useState<SourceFormState>(emptySourceForm);
  const [intakeError, setIntakeError] = useState('');
  const [intakeNotice, setIntakeNotice] = useState('');
  const [theoryText, setTheoryText] = useState('');
  const [theoryStatus, setTheoryStatus] = useState<TheoryStatus>('known');
  const [theoryEvidenceIds, setTheoryEvidenceIds] = useState<string[]>([]);
  const [notebookFilter, setNotebookFilter] = useState<'all' | NotebookEntry['kind']>('all');
  const [journalFilter, setJournalFilter] = useState<'all' | JournalKind>('all');
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [editingLinks, setEditingLinks] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(() => shouldShowHelp(save));

  const viewpoint = getViewpoint(save.selectedViewpoint);
  const location = getLocationForViewpoint(save.selectedViewpoint);
  const locationViewpoints = viewpointsForLocation(location.id);
  // The UI only ever reads the sanitized player view, never the canonical case file.
  const playerCase = useMemo(() => toPlayerCaseView(save.caseFile), [save.caseFile]);
  const objective = useMemo(() => currentObjective(save), [save]);
  const dialogueScenes = useMemo(() => availableDialogueScenes(save), [save]);
  const discoveredCount = playerCase.evidence.filter((e) => e.discovered).length;
  const reviewedEvidence = playerCase.evidence.filter((e) => e.reviewed);
  const groupedTheory = useMemo(() => groupTheoryClaims(save), [save]);
  const evidenceTitleById = useMemo(
    () => new Map(playerCase.evidence.map((e) => [e.id, e.title])),
    [playerCase.evidence],
  );
  const notebookKinds = useMemo(
    () => [...new Set(save.notebook.map((n) => n.kind))],
    [save.notebook],
  );
  const journal = useMemo(() => buildCaseJournal(save), [save]);
  /** Evidence ids already written into the journal, used to link the two boards. */
  const journalEvidenceIds = useMemo(
    () => new Set(journal.filter((e) => e.evidenceId).map((e) => e.evidenceId as string)),
    [journal],
  );
  const chapterPhase = save.clock.day <= 5 ? 'Foundations · Days 1–5' : 'First case · Days 6–10';
  const caseSummary = useMemo(() => buildCaseSummary(save), [save]);
  const objectiveIndex = objective
    ? save.assignments.findIndex((a) => a.id === objective.assignmentId) + 1
    : save.assignments.length;
  const journalCounts = useMemo(() => {
    const counts: Record<JournalKind, number> = { event: 0, evidence: 0, note: 0, casework: 0, theory: 0 };
    for (const entry of journal) counts[entry.kind] += 1;
    return counts;
  }, [journal]);
  const theorySupport = useMemo(() => getTheorySupport(save), [save]);
  const supportByClaimId = useMemo(
    () => new Map(theorySupport.map((s) => [s.claimId, s])),
    [theorySupport],
  );
  const unsupportedClaimCount = theorySupport.filter((s) => !s.hasReviewedEvidence).length;
  const chapterComplete = isChapterComplete(save);
  const completion = useMemo(() => buildChapterCompletionSummary(save), [save]);
  const caseTargetId = caseTarget || reviewedEvidence[0]?.id || '';
  const a7 = save.assignments.find((a) => a.id === 'a7');
  const a8 = save.assignments.find((a) => a.id === 'a8');
  const reviewedAssignmentCount = save.assignments.filter((a) => a.status === 'reviewed').length;
  const chapterProgress = Math.round((reviewedAssignmentCount / save.assignments.length) * 100);
  const nextStep = useMemo(() => {
    if (chapterComplete) {
      return { panel: 'completion' as Panel, text: 'Chapter complete. Open the chapter summary to review what you achieved.' };
    }
    if (!objective) {
      return { panel: 'case' as Panel, text: 'Review your case file and notebook for what remains.' };
    }
    if (objective.status === 'locked') {
      return {
        panel: 'assignments' as Panel,
        text: `Locked until Day ${objective.unlockDay}. Advance time from the chamber window or header when ready.`,
      };
    }
    if (objective.assignmentId === 'a7') {
      return { panel: 'casework' as Panel, text: 'Open Casework to submit your brief for senior review, then revise if requested.' };
    }
    if (objective.assignmentId === 'a8') {
      return { panel: 'casework' as Panel, text: 'Open Casework to submit the final brief. Keep it evidence-grounded and verified.' };
    }
    const isComplete = (progress: string) => {
      const [done, total] = progress.split('/').map(Number);
      return total === 0 || done >= total;
    };
    const evidenceNeeded = !isComplete(objective.evidenceProgress);
    const sourcesNeeded = !isComplete(objective.sourceProgress);
    const notesNeeded = !isComplete(objective.noteProgress);
    const flagsNeeded = !isComplete(objective.flagProgress);
    if (evidenceNeeded) return { panel: 'evidence' as Panel, text: 'Inspect and review the required evidence items before submitting this assignment.' };
    if (sourcesNeeded) return { panel: 'research' as Panel, text: 'Add the required verified source note to your notebook from the Research panel.' };
    if (notesNeeded) return { panel: 'evidence' as Panel, text: 'Record the required contradiction/corroboration note tied to reviewed evidence.' };
    if (flagsNeeded) return { panel: objective.assignmentId === 'a4' ? 'dialogue' as Panel : 'casework' as Panel, text: 'Complete the required casework milestone, then return to Assignments.' };
    return { panel: 'assignments' as Panel, text: 'Requirements met. Open Assignments and submit for senior evaluation.' };
  }, [objective, chapterComplete]);
  // Dev-time guard: fail loudly if any future UI change starts projecting canonical truth.
  if (import.meta.env.DEV) {
    assertNoCanonicalTruthLeak(playerCase);
    assertNoCanonicalTruthLeak(completion);
    assertNoCanonicalTruthLeak(journal);
    assertNoCanonicalTruthLeak(theorySupport);
    assertNoCanonicalTruthLeak(caseSummary);
  }

  function update(mutator: (s: SaveGame) => SaveGame) {
    setSave((prev) => {
      const next = mutator(structuredClone(prev));
      persistSave(next);
      return next;
    });
  }

  function addNotebook(entry: Omit<NotebookEntry, 'id' | 'day'>) {
    update((s) => {
      s.notebook.unshift(makeNotebookEntry(entry, s));
      return s;
    });
  }

  /** Explicit Save action. Automatic saves from other mutations are not logged separately. */
  function doSave() {
    update((s) => {
      recordAudit(s, 'save', 'Saved progress locally');
      return s;
    });
    setDialogue('Saved locally.');
    setPanel('dialogue');
  }

  /** Dismiss first-day guidance and remember the choice across saves. */
  function dismissHelp() {
    setShowHelp(false);
    update(markHelpSeen);
  }

  function setSourceField<K extends keyof SourceFormState>(key: K, value: SourceFormState[K]) {
    setSourceForm((prev) => ({ ...prev, [key]: value }));
  }

  function doAddSource() {
    setIntakeError('');
    setIntakeNotice('');
    const result = intakeSource(sourceForm, makeId('ls'));
    if (!result.ok || !result.source) {
      setIntakeError(result.reason ?? 'Unable to add source.');
      return;
    }
    const added = result.source;
    update((s) => {
      s.legalSources.unshift(added);
      recordAudit(s, 'source-intake', `Source intake saved: ${added.title} (${added.verificationStatus})`);
      return s;
    });
    setSourceForm(emptySourceForm());
    setShowSourceIntake(false);
    setIntakeNotice(`Saved "${added.title}" as ${added.verificationStatus}. ${result.warnings.join(' ')}`);
    setDialogue(`System: Source intake saved as ${added.verificationStatus}. ${result.warnings.join(' ')}`);
  }

  function discoverEvidence(id: string) {
    const item = save.caseFile.evidence.find((e) => e.id === id);
    if (!item || item.discovered) return;
    update((s) => {
      const ev = discoverEvidenceItem(s, id);
      if (!ev) return s;
      s.caseFile.playerKnowledge.push(`Discovered: ${ev.title}`);
      s.memories.unshift({ id: makeId('m'), day: s.clock.day, summary: `Discovered evidence: ${ev.title}`, participants: ['player'] });
      s.notebook.unshift(makeNotebookEntry({
        kind: 'fact', title: `Evidence: ${ev.title}`, content: ev.description,
        source: ev.provenance, verified: false, evidenceId: ev.id,
      }, s));
      return s;
    });
    setDialogue(`System: Discovered ${item.title}. Inspect it to mark it reviewed and record your own assessment.`);
  }

  function doReviewEvidence(id: string) {
    update((s) => {
      if (!reviewEvidence(s, id)) return s;
      const ev = s.caseFile.evidence.find((e) => e.id === id);
      if (ev) s.notebook.unshift(makeNotebookEntry({
        kind: 'fact', title: `Reviewed: ${ev.title}`,
        content: 'Reviewed the item and recorded a provisional admissibility/reliability assessment. Authenticity has not been determined.',
        source: ev.provenance, verified: false, evidenceId: ev.id,
      }, s));
      return s;
    });
  }

  function doSetAssessment(id: string, patch: Parameters<typeof setEvidenceAssessment>[2]) {
    update((s) => {
      setEvidenceAssessment(s, id, patch);
      return s;
    });
  }

  function doSaveNote() {
    if (!noteTarget || !noteText.trim()) return;
    const target = noteTarget;
    const outcome: { entry?: NotebookEntry | null } = {};
    update((s) => {
      outcome.entry = addEvidenceNote(s, target, noteRelation, noteText);
      return s;
    });
    if (outcome.entry) {
      setNoteTarget(null);
      setNoteText('');
      setDialogue('System: Note recorded in your notebook, tied to the reviewed evidence item.');
      setPanel('notebook');
    }
  }

  function doRecordCustody() {
    const outcome: { result?: ReturnType<typeof recordCustodyObservation> } = {};
    update((s) => { outcome.result = recordCustodyObservation(s, caseTargetId, custodyText); return s; });
    if (outcome.result?.ok) {
      setCustodyText('');
      setDialogue('System: Chain-of-custody observation logged in your notebook. Authenticity is still undetermined.');
    } else {
      setDialogue(`System: ${outcome.result?.reason ?? 'Unable to log custody.'}`);
    }
  }

  function doChallenge() {
    const outcome: { result?: ReturnType<typeof challengeEvidenceAdmissibility> } = {};
    update((s) => { outcome.result = challengeEvidenceAdmissibility(s, caseTargetId, challengeGround, challengeText); return s; });
    if (outcome.result?.ok) {
      setChallengeText('');
      setDialogue(`${outcome.result.feedback}\n\nRemembered: Challenge recorded on ${challengeGround} grounds.`);
    } else {
      setDialogue(`System: ${outcome.result?.reason ?? 'Unable to record challenge.'}`);
    }
  }

  function toggleTheoryEvidence(id: string) {
    setTheoryEvidenceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /** Carry a reviewed item straight from the Evidence panel into a new theory claim. */
  function useEvidenceInTheory(id: string) {
    setTheoryEvidenceIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setPanel('theory');
  }

  function openLinkEditor(claimId: string) {
    const claim = save.caseTheory.claims.find((c) => c.id === claimId);
    if (!claim) return;
    const available = new Set(reviewedEvidence.map((e) => e.id));
    setEditingLinks(claim.evidenceIds.filter((id) => available.has(id)));
    setEditingClaimId(claimId);
  }

  function toggleEditingLink(id: string) {
    setEditingLinks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function doSaveClaimLinks(claimId: string) {
    const outcome: { result?: ReturnType<typeof setClaimEvidenceLinks> } = {};
    update((s) => { outcome.result = setClaimEvidenceLinks(s, claimId, editingLinks); return s; });
    if (outcome.result?.ok) {
      setEditingClaimId(null);
      setDialogue('System: Evidence links updated. This records what you relied on, not a finding on authenticity or responsibility.');
    } else {
      setDialogue(`System: ${outcome.result?.reason ?? 'Unable to update evidence links.'}`);
    }
  }

  function doAddTheory() {
    const outcome: { result?: ReturnType<typeof addTheoryClaim> } = {};
    update((s) => { outcome.result = addTheoryClaim(s, theoryText, theoryStatus, theoryEvidenceIds); return s; });
    if (outcome.result?.ok) {
      setTheoryText('');
      setTheoryEvidenceIds([]);
      setDialogue('System: Case-theory claim added to your file and notebook. It is your working theory, not a finding on authenticity or responsibility.');
    } else {
      setDialogue(`System: ${outcome.result?.reason ?? 'Unable to record theory claim.'}`);
    }
  }

  function doSeniorReview() {
    const outcome: { result?: ReturnType<typeof submitSeniorReview> } = {};
    update((s) => { outcome.result = submitSeniorReview(s, 'a7', reviewSummary); return s; });
    const result = outcome.result;
    if (!result?.ok) {
      setDialogue(`System: ${result?.reason ?? 'Unable to submit for review.'}`);
      return;
    }
    setDialogue(`Adv. Meera Kulkarni: "${result.feedback}"`);
    if (result.status === 'accepted') setPanel('notebook');
  }

  function doFinalBrief() {
    const outcome: { result?: ReturnType<typeof submitFinalBrief> } = {};
    update((s) => { outcome.result = submitFinalBrief(s, finalSummary); return s; });
    const result = outcome.result;
    if (!result?.ok) {
      setDialogue(`System: ${result?.reason ?? 'Unable to submit final brief.'}`);
      return;
    }
    setDialogue(`Adv. Meera Kulkarni: "${result.consequence}"`);
    setPanel('completion');
  }

  function doAdvanceTime() {
    const outcome: { day?: number; slot?: string } = {};
    update((s) => {
      advanceClock(s);
      outcome.day = s.clock.day;
      outcome.slot = s.clock.slot;
      return s;
    });
    if (outcome.day !== undefined) {
      setDialogue(`System: Time advanced to Day ${outcome.day} (${outcome.slot}). Check your current objective.`);
    }
  }

  function onHotspot(action: string) {
    const [kind, value] = action.split(':');
    if (kind === 'view') update((s) => ({ ...s, selectedViewpoint: value }));
    if (kind === 'panel') setPanel(value as Panel);
    if (kind === 'time') doAdvanceTime();
    if (kind === 'dialogue' && value === 'senior') {
      setPanel('dialogue');
      setDialogue(save.flags.caseAccepted
        ? 'Adv. Meera Kulkarni: "Good. Now test every claim against evidence and verified law. Do not guess citations."'
        : 'Adv. Meera Kulkarni: "A fictional altercation case has arrived. Interview carefully, collect evidence, and draft a brief. I will review it."');
      update((s) => { s.flags.caseAccepted = true; return s; });
    }
    if (kind === 'dialogue' && Object.prototype.hasOwnProperty.call(DIALOGUE_GREETINGS, value)) {
      setPanel('dialogue');
      setDialogue(DIALOGUE_GREETINGS[value]);
    }
  }

  function doDialogueChoice(sceneId: string, choiceId: string) {
    const working = structuredClone(save);
    const result = applyDialogueChoice(working, sceneId, choiceId);
    if (!result.ok) {
      setDialogue(`System: ${result.reason ?? 'Unavailable.'}`);
      return;
    }
    const standing = result.reputationEffects?.length
      ? `\n\nStanding change: ${result.reputationEffects.map((e) => `${e.dimension} ${e.amount > 0 ? '+' : ''}${e.amount}`).join(', ')}.`
      : '';
    working.notebook.unshift(makeNotebookEntry({
      kind: 'note',
      title: `Interaction: ${result.characterName ?? 'Colleague'}`,
      content: `${result.reply}\n\nRemembered: ${result.memory}${standing}`,
      verified: false,
    }, working));
    update(() => working);
    setDialogue(`${result.reply}\n\nRemembered: ${result.memory}${standing}`);
  }

  function submitAssignment(id: string) {
    const outcome: { result?: ReturnType<typeof reviewAssignment> } = {};
    update((s) => {
      outcome.result = reviewAssignment(s, id);
      if (outcome.result.ok) {
        s.notebook.unshift(makeNotebookEntry({
          kind: 'feedback', title: `Assignment reviewed: ${s.assignments.find((a) => a.id === id)?.title ?? id}`,
          content: outcome.result.feedback, verified: true,
        }, s));
      }
      return s;
    });
    if (outcome.result && !outcome.result.ok) {
      setDialogue(`System: ${outcome.result.reason}`);
      setPanel('dialogue');
    } else if (outcome.result?.ok) {
      setDialogue('Adv. Meera Kulkarni: "Good. Keep the work grounded in reviewed evidence and verified sources."');
      setPanel('notebook');
    }
  }

  function submitDraft() {
    const citationCheck = checkDraftCitations(draft, save.legalSources);
    if (!citationCheck.ok) {
      addNotebook({
        kind: 'feedback',
        title: 'Draft blocked: citation guardrail',
        content: `Submission blocked.\n${citationCheck.blocked.map((b) => `- ${b}`).join('\n')}\n\nRule: never fabricate or cite unverified legal provisions/judgments.`,
        verified: true,
      });
      setDialogue('Adv. Meera Kulkarni: "Stop. I see an unverified or fabricated citation. Verify the source first, or remove it."');
      setPanel('notebook');
      return;
    }

    const hasIssue = /issue\s*:/i.test(draft) && draft.length > 60;
    const hasEvidenceRefs = discoveredCount > 0 && /evidence|medical|cctv|witness|report/i.test(draft);
    const warnings = citationCheck.warnings;
    update((s) => {
      recordAudit(s, 'draft-submitted', 'Submitted case brief draft for senior review');
      s.flags.assignment2Submitted = true;
      s.player.reputation.reliability += hasIssue ? 2 : -1;
      s.player.reputation.competence += hasIssue && hasEvidenceRefs ? 2 : hasIssue ? 1 : 0;
      s.player.reputation.integrity += warnings.length ? 0 : 1;
      const a2 = s.assignments.find((a) => a.id === 'a2');
      if (a2 && a2.status !== 'reviewed') { a2.feedback = hasIssue ? 'Structure acceptable; continue evidence-grounded analysis.' : 'Incomplete structure.'; }
      setCurrentDraft(s, draft);
      s.memories.unshift({ id: makeId('m'), day: s.clock.day, summary: 'Submitted case brief draft for senior review.', participants: ['player', 'senior'] });
      return s;
    });
    addNotebook({
      kind: 'feedback',
      title: 'Senior feedback (deterministic)',
      content: [
        hasIssue ? 'Structure: acceptable.' : 'Structure: incomplete - include Issue, Facts (known/claimed/disputed), Verified Law/Source Notes, Analysis, Conclusion.',
        hasEvidenceRefs ? 'Evidence grounding: present.' : 'Evidence grounding: weak - tie claims to discovered evidence.',
        warnings.length ? `Warnings: ${warnings.join(' ')}` : 'Citation guard: no blocked issues detected.',
        'Reminder: canonical truth is not known; distinguish known/claimed/disputed/unknown.'
      ].join('\n'),
      verified: true,
    });
    setPanel('notebook');
  }

  function doSaveDraftVersion() {
    const outcome: { version?: ReturnType<typeof saveDraftVersion> } = {};
    update((s) => { outcome.version = saveDraftVersion(s, draft); return s; });
    if (outcome.version) setDialogue(`System: Draft version saved (Day ${outcome.version.day}, ${outcome.version.slot}).`);
  }

  function doLoadDraftVersion(versionId: string) {
    const outcome: { text?: string | null } = {};
    update((s) => { outcome.text = loadDraftVersion(s, versionId); return s; });
    if (outcome.text !== undefined && outcome.text !== null) {
      setDraft(outcome.text);
      setDialogue('System: Prior draft version loaded into the editor.');
    }
  }

  return (
    <div className="min-h-screen bg-bar-bg text-bar-text">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="border-b border-bar-gold/20 px-4 py-3 bg-gradient-to-b from-bar-panel/80 to-transparent">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-bar-muted">The First Brief · Office Prototype</p>
            <h1 className="text-xl sm:text-2xl font-semibold text-bar-gold tracking-wide">{config.appName}</h1>
            <p className="text-xs text-bar-muted">Educational simulation — not legal advice. No fabricated citations.</p>
          </div>
          <div className="text-sm text-bar-muted flex gap-2 flex-wrap items-center" aria-label="Session status">
            <span className="px-2 py-1 rounded border border-bar-gold/20 bg-bar-panel2/70 text-bar-text">Day {save.clock.day} / {MAX_DAY}</span>
            <span className="px-2 py-1 rounded border border-white/10 bg-bar-panel2/70">{chapterPhase}</span>
            <span className="px-2 py-1 rounded border border-white/10 bg-bar-panel2/70 capitalize">{save.clock.slot}</span>
            <span className="px-2 py-1 rounded border border-white/10 bg-bar-panel2/70 capitalize">{save.player.careerStage.replace('_', ' ')}</span>
            <button type="button" className="px-2 py-1 border border-bar-gold/30 rounded hover:bg-white/5" onClick={doAdvanceTime}>Advance time</button>
            <button
              type="button"
              className="px-2 py-1 border border-bar-gold/30 rounded hover:bg-white/5"
              aria-expanded={showHelp}
              aria-controls="how-to-play"
              onClick={() => setShowHelp((v) => !v)}
            >
              How to play
            </button>
            {chapterComplete && (
              <button
                type="button"
                className="px-2 py-1 border border-green-400/40 rounded text-green-200 hover:bg-green-400/10"
                onClick={() => setPanel('completion')}
                aria-current={panel === 'completion' ? 'page' : undefined}
              >
                Chapter summary
              </button>
            )}
            <button type="button" className="px-2 py-1 border border-bar-gold/30 rounded hover:bg-white/5" onClick={doSave}>Save</button>
            <button type="button" className="px-2 py-1 border border-red-400/30 rounded text-red-200 hover:bg-red-400/10" onClick={() => { if (confirm('Reset local save?')) { setSave(resetSave()); setDraft(''); } }}>Reset</button>
          </div>
        </div>
      </header>

      {showHelp && (
        <section id="how-to-play" role="region" aria-labelledby="help-heading" className="px-4 pt-4">
          <div className="bg-bar-panel2/60 border border-bar-gold/30 rounded-lg p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-bar-muted">First-day guidance</p>
                <h2 id="help-heading" className="text-base text-bar-gold">How to play</h2>
              </div>
              <button
                type="button"
                className="px-2 py-1 border border-white/10 rounded text-xs text-bar-muted self-start hover:bg-white/5"
                onClick={dismissHelp}
              >
                Got it — dismiss
              </button>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-xs uppercase tracking-wide text-bar-muted">Core loop</h3>
                <ol className="list-decimal ml-5 mt-1 space-y-1 text-xs sm:text-sm text-bar-muted">
                  <li>Read the case file. Separate known facts from claims and unknowns.</li>
                  <li>Discover and review evidence, then record your own provisional assessment.</li>
                  <li>Add only verified sources to your notebook; unverified material is never authoritative.</li>
                  <li>Complete each assignment, then advance time from the window or header to unlock the next day.</li>
                  <li>Submit the brief for senior review, revise if asked, then submit the final brief on Day 10.</li>
                </ol>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-wide text-bar-muted">Guardrails</h3>
                <ul className="list-disc ml-5 mt-1 space-y-1 text-xs sm:text-sm text-bar-muted">
                  <li>Never fabricate a statute, judgment, citation or procedural rule.</li>
                  <li>Only verified sources may be cited as law; Source Intake creates drafts, never verified authority.</li>
                  <li>The true sequence of events, responsibility and authenticity are never revealed — record what you can support, not guesses.</li>
                  <li>Your notebook, memories and standing change with careful work; the case closes on Day 10.</li>
                </ul>
              </div>
            </div>
            <p className="text-[11px] text-bar-muted mt-3">You can reopen this guide any time with “How to play” in the header.</p>
          </div>
        </section>
      )}

      <div className="px-4 pt-4">
        <div className="bg-bar-panel border border-bar-gold/20 rounded-lg p-4 shadow-sm" role="status" aria-live="polite">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1 min-w-0">
              <div className="text-xs uppercase tracking-wide text-bar-muted">Current objective</div>
              {objective ? (
                <>
                  <div className="text-sm sm:text-base text-bar-gold font-medium">
                    {objective.title}{' '}
                    <span className="text-bar-muted font-normal">— Day {objective.unlockDay} · {objective.status}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-bar-muted">{objective.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs mt-1">
                    <span className="px-2 py-0.5 rounded border border-white/10 bg-bar-panel2">Evidence {objective.evidenceProgress}</span>
                    <span className="px-2 py-0.5 rounded border border-white/10 bg-bar-panel2">Sources {objective.sourceProgress}</span>
                    {objective.noteProgress !== '0/0' && <span className="px-2 py-0.5 rounded border border-white/10 bg-bar-panel2">Notes {objective.noteProgress}</span>}
                    {objective.flagProgress !== '0/0' && <span className="px-2 py-0.5 rounded border border-white/10 bg-bar-panel2">Casework {objective.flagProgress}</span>}
                    {objective.status === 'locked' && <span className="px-2 py-0.5 rounded border border-yellow-400/30 text-yellow-200 bg-yellow-400/5">Locked until Day {objective.unlockDay}</span>}
                  </div>
                </>
              ) : (
                <div className="text-sm text-bar-muted">{save.flags.chapterOneComplete ? 'Chapter one complete — final brief submitted.' : 'All assignments reviewed.'}</div>
              )}
            </div>
            <div className="lg:w-80 shrink-0 bg-bar-panel2/70 border border-bar-gold/20 rounded-md p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-wide text-bar-muted">Next step</div>
                <span className="text-[11px] text-bar-muted">
                  {chapterComplete ? 'Complete' : `Milestone ${objectiveIndex}/${save.assignments.length}`}
                </span>
              </div>
              <p className="text-sm mt-1">{nextStep.text}</p>
              <button
                type="button"
                className="mt-2 px-2 py-1 text-xs border border-bar-gold/40 rounded text-bar-gold hover:bg-bar-gold/10"
                onClick={() => setPanel(nextStep.panel)}
              >
                Open {PANEL_LABELS[nextStep.panel]} <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-bar-muted mb-1">
              <span>Chapter progress: Day 1–{MAX_DAY}</span>
              <span>{reviewedAssignmentCount}/{save.assignments.length} assignments reviewed</span>
            </div>
            <div className="h-2 rounded bg-white/10 overflow-hidden" aria-hidden="true">
              <div className="h-full bg-bar-gold/80" style={{ width: `${chapterProgress}%` }} />
            </div>
            <div className="sr-only">Chapter progress {chapterProgress} percent.</div>
            <ol className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2" aria-label="Day 1 to 10 assignment progress">
              {save.assignments.map((a) => {
                const active = objective?.assignmentId === a.id;
                const statusClass = a.status === 'reviewed'
                  ? 'border-green-400/40 text-green-200 bg-green-400/5'
                  : a.status === 'active' || a.status === 'submitted' || a.status === 'pending'
                    ? 'border-bar-gold/40 text-bar-gold bg-bar-gold/5'
                    : 'border-white/10 text-bar-muted bg-bar-panel2/40';
                return (
                  <li
                    key={a.id}
                    aria-current={active ? 'step' : undefined}
                    className={`rounded border p-2 text-[11px] leading-tight ${statusClass} ${active ? 'ring-1 ring-bar-gold/60' : ''}`}
                  >
                    <div className="font-medium flex items-center justify-between gap-1">
                      <span>Day {a.day}</span>
                      {active && <span className="text-[9px] uppercase tracking-wide text-bar-gold">Current</span>}
                    </div>
                    <div className="mt-0.5 line-clamp-2">{a.title}</div>
                    <div className="mt-1 uppercase tracking-wide opacity-80">{a.status}</div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      <main id="main-content" className="grid lg:grid-cols-[1.35fr_1fr] gap-4 p-4">
        <section className="bg-bar-panel rounded-lg border border-bar-gold/10 p-4" aria-labelledby="chamber-heading">
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-bar-muted">Static scene · viewpoint</p>
                <h2 id="chamber-heading" className="text-lg text-bar-gold">{location.label} — {viewpoint.label}</h2>
              </div>
              <div className="flex gap-2 text-xs flex-wrap" role="group" aria-label="Locations">
                {Object.values(LOCATIONS).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onHotspot(`view:${l.viewpointIds[0]}`)}
                    aria-pressed={location.id === l.id}
                    className={`px-2 py-1 rounded border transition-colors ${location.id === l.id ? 'border-bar-gold text-bar-gold bg-bar-gold/10' : 'border-white/10 text-bar-muted hover:bg-white/5'}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 text-xs flex-wrap" role="group" aria-label="Viewpoints">
              {locationViewpoints.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onHotspot(`view:${v.id}`)}
                  aria-pressed={save.selectedViewpoint === v.id}
                  className={`px-2 py-1 rounded border transition-colors ${save.selectedViewpoint === v.id ? 'border-bar-gold text-bar-gold bg-bar-gold/10' : 'border-white/10 text-bar-muted hover:bg-white/5'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="scene-frame">
            <div className="scene-art-wrap">
              <SceneArt viewpointId={save.selectedViewpoint} />
              <div className="scene-vignette" aria-hidden="true" />
              <span className="scene-tag" aria-hidden="true">{viewpoint.label}</span>
            </div>
            <div className="p-3 sm:p-4 bg-bar-panel/95">
              <p className="text-xs text-bar-muted">{location.description}</p>
              <p className="text-sm text-bar-muted mt-1">{viewpoint.description}</p>
              <div className="scene-rule my-3" aria-hidden="true" />
              <p className="text-[11px] uppercase tracking-wide text-bar-muted mb-2">
                Interact here <span className="normal-case tracking-normal">— the illustration is decorative; every action is a labelled control below.</span>
              </p>
              <div className="grid sm:grid-cols-2 gap-2" role="group" aria-label={`${viewpoint.label} hotspots`}>
                {viewpoint.hotspots.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => onHotspot(h.action)}
                    className="text-left p-3 rounded border border-bar-gold/20 bg-bar-panel2/40 hover:bg-white/5 hover:border-bar-gold/40 transition-colors"
                  >
                    <div className="text-bar-gold text-sm font-medium">{h.label}</div>
                    <div className="text-xs text-bar-muted mt-0.5">{describeHotspotAction(h.action)}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 grid sm:grid-cols-3 gap-2 text-xs">
            <div className="bg-bar-panel2 p-2 rounded border border-white/5"><span className="text-bar-muted">Competence</span> <span className="text-bar-text font-medium">{save.player.reputation.competence}</span></div>
            <div className="bg-bar-panel2 p-2 rounded border border-white/5"><span className="text-bar-muted">Integrity</span> <span className="text-bar-text font-medium">{save.player.reputation.integrity}</span></div>
            <div className="bg-bar-panel2 p-2 rounded border border-white/5"><span className="text-bar-muted">Reliability</span> <span className="text-bar-text font-medium">{save.player.reputation.reliability}</span></div>
          </div>
        </section>

        <section className="bg-bar-panel rounded-lg border border-bar-gold/10 p-4" aria-labelledby="workspace-heading">
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 id="workspace-heading" className="text-lg text-bar-gold">Workspace</h2>
              <span className="text-xs text-bar-muted">Panel: <span className="text-bar-text capitalize">{panel}</span></span>
            </div>
            <p className="text-xs text-bar-muted">Use panels to review the case, evidence, sources, draft, and casework. The recommended next panel is highlighted.</p>
          </div>
          <nav aria-label="Work panels" className="flex gap-2 flex-wrap mb-4 text-sm">
            {PANELS.map((p) => {
              const recommended = nextStep.panel === p && panel !== p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPanel(p)}
                  aria-current={panel === p ? 'page' : undefined}
                  className={`px-2.5 py-1.5 rounded border capitalize transition-colors ${panel === p ? 'border-bar-gold text-bar-gold bg-bar-gold/10' : 'border-white/10 text-bar-muted hover:bg-white/5'} ${recommended ? 'ring-1 ring-bar-gold/30' : ''}`}
                >
                  {p}{recommended ? ' •' : ''}
                </button>
              );
            })}
          </nav>

          {panel === 'completion' && (
            <div className="space-y-4 text-sm">
              {!chapterComplete ? (
                <div className="bg-bar-panel2 p-4 rounded border border-yellow-400/30">
                  <p className="text-sm">The chapter is not complete yet. Submit the final brief on Day 10 to unlock this summary.</p>
                  <button type="button" className="mt-2 px-2 py-1 border border-bar-gold/30 rounded text-xs" onClick={() => setPanel('case')}>Back to case file</button>
                </div>
              ) : (
                <>
                  <div className="bg-bar-panel2 p-4 rounded border border-green-400/30">
                    <p className="text-[11px] uppercase tracking-wide text-green-200/80">End of chapter · Day {completion.day} / {completion.finalDay}</p>
                    <h3 className="text-lg text-bar-gold mt-1">{completion.title}</h3>
                    <p className="text-sm mt-2">{completion.outcome}</p>
                    <p className="text-xs text-bar-muted mt-2">Case {completion.caseStatus}. {completion.closingNote}</p>
                  </div>

                  <section aria-labelledby="completion-achievements-heading" className="bg-bar-panel2 p-3 rounded border border-white/5">
                    <h3 id="completion-achievements-heading" className="text-xs uppercase tracking-wide text-bar-gold">What you achieved</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-xs">
                      <div className="bg-bar-bg/40 p-2 rounded">Competence <span className="text-bar-text font-medium">{completion.reputation.competence}</span></div>
                      <div className="bg-bar-bg/40 p-2 rounded">Integrity <span className="text-bar-text font-medium">{completion.reputation.integrity}</span></div>
                      <div className="bg-bar-bg/40 p-2 rounded">Reliability <span className="text-bar-text font-medium">{completion.reputation.reliability}</span></div>
                    </div>
                    <p className="text-xs text-bar-muted mt-2">
                      Career stage: <span className="capitalize">{completion.careerStage.replace('_', ' ')}</span> · Assignments reviewed: {completion.assignmentsCompletedCount}/{completion.assignmentsTotal}
                    </p>
                    <ul className="list-disc ml-5 mt-1 text-xs text-bar-muted">
                      {completion.assignmentsCompleted.map((a) => <li key={a.id}>{a.title}</li>)}
                    </ul>
                  </section>

                  <section aria-labelledby="completion-synthesis-heading" className="bg-bar-panel2 p-3 rounded border border-white/5">
                    <h3 id="completion-synthesis-heading" className="text-xs uppercase tracking-wide text-bar-gold">Evidence synthesis &amp; open questions</h3>
                    <p className="text-xs text-bar-muted mt-2">{completion.synthesis.overview}</p>
                    {completion.synthesis.links.length > 0 && (
                      <ul className="list-disc ml-5 mt-2 space-y-1 text-xs text-bar-text/90">
                        {completion.synthesis.links.map((link) => (
                          <li key={link.id}>
                            <span className="capitalize text-bar-gold">{link.relation}</span> · Day {link.day} · {link.evidenceTitle}: {link.note}
                          </li>
                        ))}
                      </ul>
                    )}
                    {completion.synthesis.totalClaims > 0 && (
                      <div className="mt-3">
                        <h4 className="text-xs uppercase tracking-wide text-bar-gold">How your theory was grounded</h4>
                        <ul className="list-disc ml-5 mt-2 space-y-1 text-xs text-bar-muted">
                          {completion.synthesis.theoryGrounding.map((claim) => (
                            <li key={claim.claimId}>
                              {claim.claimText} — {claim.hasReviewedEvidence
                                ? `linked to ${claim.reviewedEvidenceTitles.join(', ')}`
                                : 'not yet linked to reviewed evidence'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs text-bar-muted mt-3">{completion.synthesis.ambiguityNote}</p>
                  </section>

                  <section aria-labelledby="completion-legal-mind-heading" className="bg-bar-panel2 p-3 rounded border border-white/5">
                    <h3 id="completion-legal-mind-heading" className="text-xs uppercase tracking-wide text-bar-gold">Legal Mind Profile (lite)</h3>
                    <p className="text-xs text-bar-muted mt-1">{completion.legalMindProfile.intro}</p>
                    <ul className="mt-3 space-y-3">
                      {completion.legalMindProfile.dimensions.map((d) => (
                        <li key={d.id} className="bg-bar-bg/40 p-2 rounded border border-white/5">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm text-bar-text font-medium">{d.label}</span>
                            <span className="text-[11px] uppercase tracking-wide text-bar-gold">{d.levelLabel}</span>
                          </div>
                          <p className="text-xs text-bar-muted mt-1">{d.rationale}</p>
                          {d.evidence.length > 0 && (
                            <ul className="list-disc ml-5 mt-1 text-xs text-bar-muted">
                              {d.evidence.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                          )}
                          <p className="text-xs text-bar-muted mt-1">
                            <span className="text-bar-gold/80">Next step: </span>{d.nextStep}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-bar-muted mt-3">{completion.legalMindProfile.closing}</p>
                  </section>

                  <section aria-labelledby="completion-relationships-heading" className="bg-bar-panel2 p-3 rounded border border-white/5">
                    <h3 id="completion-relationships-heading" className="text-xs uppercase tracking-wide text-bar-gold">Relationship highlights</h3>
                    <ul className="grid gap-1 mt-2 text-xs text-bar-muted sm:grid-cols-2">
                      {completion.relationships.map((r) => (
                        <li key={r.characterId}>{r.name} ({r.role}): trust {r.trust} · respect {r.respect} · loyalty {r.loyalty}</li>
                      ))}
                    </ul>
                  </section>

                  <section aria-labelledby="completion-evidence-heading" className="bg-bar-panel2 p-3 rounded border border-white/5">
                    <h3 id="completion-evidence-heading" className="text-xs uppercase tracking-wide text-bar-gold">Key evidence discovered ({completion.evidenceDiscovered.length})</h3>
                    {completion.evidenceDiscovered.length === 0 ? (
                      <p className="text-xs text-bar-muted mt-1">No evidence was discovered.</p>
                    ) : (
                      <ul className="list-disc ml-5 mt-1 text-xs text-bar-muted">
                        {completion.evidenceDiscovered.map((e) => <li key={e.id}>{e.title} · {e.type}{e.reviewed ? ' · reviewed' : ''}</li>)}
                      </ul>
                    )}
                  </section>

                  <section aria-labelledby="completion-memory-heading" className="bg-bar-panel2 p-3 rounded border border-white/5">
                    <h3 id="completion-memory-heading" className="text-xs uppercase tracking-wide text-bar-gold">Memory highlights</h3>
                    <ul className="list-disc ml-5 mt-1 text-xs text-bar-muted">
                      {completion.memoryHighlights.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </section>

                  <section aria-labelledby="completion-questions-heading" className="bg-bar-panel2 p-3 rounded border border-white/5">
                    <h3 id="completion-questions-heading" className="text-xs uppercase tracking-wide text-bar-gold">Unresolved ambiguities</h3>
                    <p className="text-xs text-bar-muted mt-1">The file records open questions; the case is closed on your work, not on certainty.</p>
                    <ul className="list-disc ml-5 mt-1 text-xs text-bar-muted">
                      {completion.openQuestions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </section>

                  <button type="button" className="px-3 py-1 border border-bar-gold/40 rounded text-xs" onClick={() => setPanel('notebook')}>Review the full notebook →</button>
                </>
              )}
            </div>
          )}

          {panel === 'dialogue' && (
            <div className="space-y-3 text-sm">
              <div className="whitespace-pre-wrap bg-bar-panel2 p-3 rounded">{dialogue}</div>
              <div className="bg-bar-panel2 p-3 rounded">
                <div className="text-xs text-bar-gold mb-2">Relationships (player → character)</div>
                <div className="grid gap-1 text-xs text-bar-muted">
                  {save.relationships.map((r) => {
                    const name = save.characters.find((c) => c.id === r.toId)?.name ?? r.toId;
                    return <div key={r.toId}>{name}: trust {r.trust} · respect {r.respect} · loyalty {r.loyalty} · rivalry {r.rivalry} · resentment {r.resentment}</div>;
                  })}
                </div>
              </div>
              {dialogueScenes.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-bar-gold">Available conversations &amp; events (Day {save.clock.day})</div>
                  {dialogueScenes.map((scene) => (
                    <div key={scene.id} className="bg-bar-panel2 p-3 rounded border border-white/5">
                      {scene.kind === 'event' && (
                        <span className="inline-block mb-1 px-2 py-0.5 rounded border border-bar-gold/40 bg-bar-gold/10 text-[11px] uppercase tracking-wide text-bar-gold">World event</span>
                      )}
                      <div className="text-sm">{scene.prompt}</div>
                      <div className="grid gap-2 mt-2">
                        {scene.choices.map((choice) => (
                          <button key={choice.id} onClick={() => doDialogueChoice(scene.id, choice.id)} className="text-left px-2 py-2 rounded border border-bar-gold/20 text-xs hover:bg-white/5">
                            {choice.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {dialogueScenes.length === 0 && <p className="text-xs text-bar-muted">No new conversations today. Advance time to unlock more.</p>}
            </div>
          )}

          {panel === 'case' && (
            <div className="space-y-3 text-sm">
              <section className="bg-bar-panel2 p-3 rounded border border-bar-gold/25">
                <p className="text-[11px] uppercase tracking-wide text-bar-muted">Case file · working record</p>
                <h3 className="text-base text-bar-gold mt-0.5">{playerCase.title}</h3>
                <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded border border-white/10 bg-bar-bg/40">Status: {playerCase.status}</span>
                  <span className="px-2 py-0.5 rounded border border-white/10 bg-bar-bg/40">{playerCase.playerKnowledge.length} known notes</span>
                  <span className="px-2 py-0.5 rounded border border-white/10 bg-bar-bg/40">{playerCase.allegations.length} allegations</span>
                  <span className="px-2 py-0.5 rounded border border-white/10 bg-bar-bg/40">{playerCase.unresolvedAmbiguity.length} open questions</span>
                </div>
                <p className="text-xs text-bar-muted mt-2">
                  This file holds only what you have legitimately learned. It is not a finding about what happened, who was responsible, or whether any item is authentic.
                </p>
              </section>

              <section className="bg-bar-panel2 p-3 rounded border border-white/5" aria-labelledby="case-at-a-glance-heading">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <h3 id="case-at-a-glance-heading" className="text-xs uppercase tracking-wide text-bar-gold">Case at a glance</h3>
                  <span className="text-[11px] text-bar-muted">{caseSummary.phase}</span>
                </div>
                <p className="text-xs text-bar-muted mt-2">{caseSummary.framing}</p>
                <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded border border-white/10 bg-bar-bg/40">Evidence {caseSummary.discoveredCount}/{caseSummary.evidenceTotal} discovered</span>
                  <span className="px-2 py-0.5 rounded border border-white/10 bg-bar-bg/40">{caseSummary.reviewedCount} reviewed</span>
                  <span className="px-2 py-0.5 rounded border border-white/10 bg-bar-bg/40">{caseSummary.evidenceNoteCount} evidence-linked notes</span>
                  <span className="px-2 py-0.5 rounded border border-white/10 bg-bar-bg/40">{pluralize(caseSummary.corroborationLinks.filter((l) => l.relation === 'contradiction').length, 'contradiction')} · {pluralize(caseSummary.corroborationLinks.filter((l) => l.relation === 'corroboration').length, 'corroboration')}</span>
                </div>
                {caseSummary.corroborationLinks.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs uppercase tracking-wide text-bar-gold">Corroboration &amp; contradiction notes</h4>
                    <ul className="list-disc ml-5 mt-2 space-y-1 text-xs text-bar-text/90">
                      {caseSummary.corroborationLinks.map((link) => (
                        <li key={link.id}>
                          <span className="capitalize text-bar-gold">{link.relation}</span> · Day {link.day} · {link.evidenceTitle}: {link.note}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="mt-2 px-2 py-1 border border-bar-gold/30 rounded text-xs"
                      onClick={() => { setJournalFilter('evidence'); setPanel('journal'); }}
                    >
                      See these notes in the timeline →
                    </button>
                  </div>
                )}
                {caseSummary.reviewPrompts.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs uppercase tracking-wide text-bar-gold">Review prompts for reviewed items</h4>
                    <ul className="space-y-2 mt-2 text-xs text-bar-text/90">
                      {caseSummary.reviewPrompts.map((prompt) => (
                        <li key={prompt.id} className="bg-bar-bg/40 p-2 rounded border border-white/5">
                          <div className="text-bar-gold">{prompt.focus} · {prompt.evidenceTitle}</div>
                          <p className="text-bar-muted mt-1">{prompt.prompt}</p>
                          <button
                            type="button"
                            className="mt-2 px-2 py-1 border border-bar-gold/30 rounded text-xs"
                            onClick={() => { setNoteRelation('contradiction'); setNoteTarget(prompt.evidenceId); setNoteText(''); setPanel('evidence'); }}
                          >
                            Record a note →
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              <FileSection
                title="Known / player knowledge"
                items={playerCase.playerKnowledge}
                empty="No notes recorded yet. Review evidence and speak with people to add to this record."
              />
              <FileSection
                title="Allegations"
                items={playerCase.allegations}
                empty="No allegations have been recorded."
              />
              <FileSection
                title="Unresolved ambiguity"
                items={playerCase.unresolvedAmbiguity}
                empty="No open questions recorded."
              />

              <section className="bg-bar-panel2 p-3 rounded border border-white/5">
                <h3 className="text-xs uppercase tracking-wide text-bar-gold">Admissible material</h3>
                <p className="text-xs text-bar-muted mt-2">
                  {playerCase.admissibleMaterial.length ? playerCase.admissibleMaterial.join(' · ') : 'Not yet determined.'}
                </p>
                <button
                  type="button"
                  className="mt-2 px-2 py-1 border border-bar-gold/30 rounded text-xs hover:bg-white/5"
                  onClick={() => { setJournalFilter('all'); setPanel('journal'); }}
                >
                  See how the record developed in the timeline →
                </button>
              </section>

              <p role="note" className="text-xs text-bar-muted border-l-2 border-bar-gold/30 pl-2">
                Keep known facts, claims and open questions separate. Careful work adds to this file; nothing here is resolved for you.
              </p>
            </div>
          )}

          {panel === 'assignments' && (
            <div className="space-y-3 text-sm">
              <p className="text-xs text-bar-muted">Track Day 1–10 assignments. Complete requirements, then submit for deterministic senior evaluation.</p>
              {save.assignments.map((a: Assignment) => {
                const unlocked = isAssignmentUnlocked(a, save);
                const isCurrent = objective?.assignmentId === a.id;
                const statusClass = a.status === 'reviewed'
                  ? 'text-green-200 border-green-400/30 bg-green-400/5'
                  : a.status === 'active' || a.status === 'submitted' || a.status === 'pending'
                    ? 'text-bar-gold border-bar-gold/30 bg-bar-gold/5'
                    : 'text-bar-muted border-white/10 bg-white/5';
                return (
                  <article key={a.id} className={`bg-bar-panel2 p-3 rounded border ${isCurrent ? 'border-bar-gold/30' : 'border-white/5'}`}>
                    <div className="flex justify-between gap-2 flex-wrap items-start">
                      <div>
                        <div className="text-bar-gold font-medium">{a.title}</div>
                        <div className="text-xs text-bar-muted">Day {a.day}{a.unlockAfter ? ` · after ${a.unlockAfter.toUpperCase()}` : ''}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded border capitalize ${statusClass}`}>{a.status}</span>
                    </div>
                    <p className="text-sm mt-2">{a.description}</p>
                    <div className="text-xs text-bar-muted mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      <span>Evidence: {a.requiredEvidenceIds.join(', ') || 'none'}</span>
                      <span>Sources: {a.requiredSourceIds.join(', ') || 'none'}</span>
                      {a.requiredNotebookKinds?.length ? <span>Notes: {a.requiredNotebookKinds.join(', ')}</span> : null}
                      {a.requiredFlags?.length ? <span>Milestones: {a.requiredFlags.join(', ')}</span> : null}
                    </div>
                    {!unlocked && a.status === 'locked' && <p className="text-xs text-yellow-200 mt-2">Locks until Day {a.day} and prior work is reviewed.</p>}
                    {a.feedback && <div className="text-xs mt-2 text-bar-text border-l-2 border-bar-gold/30 pl-2">Feedback: {a.feedback}</div>}
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {(a.status === 'active' || a.status === 'submitted' || a.status === 'pending') && unlocked && a.id === 'a7' && (
                        <button type="button" className="px-2 py-1 border border-bar-gold/30 rounded text-xs hover:bg-white/5" onClick={() => setPanel('casework')}>Senior review &amp; revision →</button>
                      )}
                      {(a.status === 'active' || a.status === 'pending') && unlocked && a.id === 'a8' && (
                        <button type="button" className="px-2 py-1 border border-bar-gold/30 rounded text-xs hover:bg-white/5" onClick={() => setPanel('casework')}>Final brief submission →</button>
                      )}
                      {(a.status === 'active' || a.status === 'pending') && unlocked && a.id !== 'a7' && a.id !== 'a8' && (
                        <button type="button" className="px-2 py-1 border border-bar-gold/30 rounded text-xs hover:bg-white/5" onClick={() => submitAssignment(a.id)}>Submit / Evaluate</button>
                      )}
                      {isCurrent && <span className="text-xs text-bar-muted self-center">Current objective</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {panel === 'evidence' && (
            <div className="space-y-2 text-sm">
              <div className="bg-bar-panel2 p-3 rounded border border-bar-gold/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-bar-gold">Evidence board</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-bar-muted">{discoveredCount}/{playerCase.evidence.length} discovered · {reviewedEvidence.length} reviewed</span>
                    <button
                      type="button"
                      className="px-2 py-1 border border-bar-gold/30 rounded text-xs hover:bg-white/5"
                      onClick={() => { setJournalFilter('evidence'); setPanel('journal'); }}
                    >
                      Open timeline →
                    </button>
                  </div>
                </div>
                <p className="text-xs text-bar-muted mt-2">Inspect an item to discover it, then mark it reviewed before recording your own assessment. The baseline labels below are non-authoritative practice values, not findings; authenticity is never determined in this panel.</p>
                <p className="text-xs text-bar-muted mt-1">Admissibility: unknown · admissible · questionable · inadmissible. Reliability: unknown · high · medium · low.</p>
                <p className="text-xs text-bar-muted mt-1">Reviewed items also appear in your timeline. Use “View in journal” on an item to see when you recorded it.</p>
              </div>
              {playerCase.evidence.map((ev) => (
                <div key={ev.id} className="bg-bar-panel2 p-2 rounded border border-white/5">
                  <div className="flex justify-between gap-2"><span className="text-bar-gold">{ev.title}</span><span className="text-xs text-bar-muted">{ev.type}</span></div>
                  <div className="text-xs text-bar-muted">{ev.provenance}</div>
                  {ev.discovered ? (
                    <div className="mt-1">
                      <div>{ev.description}</div>
                      <div className="text-xs text-bar-muted">Baseline after discovery — Admissibility: {ev.admissibility} • Reliability: {ev.reliability}</div>
                      {!ev.reviewed ? (
                        <button className="mt-2 px-2 py-1 border border-bar-gold/30 rounded text-xs" onClick={() => doReviewEvidence(ev.id)}>Mark reviewed</button>
                      ) : ev.assessment ? (
                        <div className="mt-2 grid gap-2">
                          <div className="text-xs text-bar-gold">Your provisional assessment (not a finding on authenticity)</div>
                          <label className="text-xs flex flex-col gap-1">Admissibility view
                            <select className="bg-bar-bg border border-white/10 rounded p-1" value={ev.assessment.admissibility} onChange={(e) => doSetAssessment(ev.id, { admissibility: e.target.value as Admissibility })}>
                              {['unknown','admissible','questionable','inadmissible'].map((v) => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </label>
                          <label className="text-xs flex flex-col gap-1">Reliability view
                            <select className="bg-bar-bg border border-white/10 rounded p-1" value={ev.assessment.reliability} onChange={(e) => doSetAssessment(ev.id, { reliability: e.target.value as Reliability })}>
                              {['unknown','high','medium','low'].map((v) => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </label>
                          <label className="text-xs flex flex-col gap-1">Rationale
                            <textarea className="bg-bar-bg border border-white/10 rounded p-2 min-h-16" value={ev.assessment.rationale} maxLength={1000} onChange={(e) => doSetAssessment(ev.id, { rationale: e.target.value })} />
                          </label>
                          <div className="flex gap-2 flex-wrap">
                            <button className="px-2 py-1 border border-bar-gold/30 rounded text-xs" onClick={() => { setNoteTarget(ev.id); setNoteRelation('contradiction'); setNoteText(''); }}>Note contradiction</button>
                            <button className="px-2 py-1 border border-bar-gold/30 rounded text-xs" onClick={() => { setNoteTarget(ev.id); setNoteRelation('corroboration'); setNoteText(''); }}>Note corroboration</button>
                            <button className="px-2 py-1 border border-bar-gold/30 rounded text-xs" onClick={() => useEvidenceInTheory(ev.id)}>Use in theory →</button>
                            {journalEvidenceIds.has(ev.id) && (
                              <button
                                type="button"
                                className="px-2 py-1 border border-white/10 rounded text-xs text-bar-muted hover:bg-white/5"
                                onClick={() => { setJournalFilter('evidence'); setPanel('journal'); }}
                              >
                                View in journal →
                              </button>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <button className="mt-2 px-2 py-1 border border-bar-gold/30 rounded text-xs" onClick={() => discoverEvidence(ev.id)}>Inspect / Discover</button>
                  )}
                </div>
              ))}
              {noteTarget && (
                <div className="bg-bar-panel2 p-3 rounded border border-bar-gold/30">
                  <div className="text-xs text-bar-gold mb-2">New {noteRelation} note for {playerCase.evidence.find((e) => e.id === noteTarget)?.title}</div>
                  <label className="text-xs flex flex-col gap-1">Note
                    <textarea className="bg-bar-bg border border-white/10 rounded p-2 min-h-20" value={noteText} maxLength={1000} onChange={(e) => setNoteText(e.target.value)} placeholder="What conflicts with or supports what, and why?" />
                  </label>
                  <div className="flex gap-2 mt-2">
                    <button className="px-2 py-1 border border-bar-gold/30 rounded text-xs" onClick={doSaveNote}>Save note</button>
                    <button className="px-2 py-1 border border-white/10 rounded text-xs text-bar-muted" onClick={() => { setNoteTarget(null); setNoteText(''); }}>Cancel</button>
                  </div>
                </div>
              )}
              <div className="text-xs text-bar-muted">Discovered: {discoveredCount}/{playerCase.evidence.length}</div>
            </div>
          )}

          {panel === 'casework' && (
            <div className="space-y-3 text-sm">
              <p className="text-xs text-bar-muted">Everything here is your own recorded observation and reasoning. Authenticity, hidden motives and canonical outcomes are never determined in this panel.</p>

              <div className="bg-bar-panel2 p-3 rounded border border-white/5">
                <div className="text-bar-gold text-xs mb-2">Working order (each step unlocks the next)</div>
                <ol className="list-decimal ml-5 text-xs text-bar-muted space-y-1">
                  <li>Review evidence in the Evidence panel.</li>
                  <li>Log a chain-of-custody observation for a reviewed item.</li>
                  <li>Challenge how a reviewed item may be relied upon, stating a ground and rationale.</li>
                  <li>Organise your theory in the Case Theory panel.</li>
                  <li>Complete senior review, then submit the final brief.</li>
                </ol>
                <p className="text-xs text-bar-muted mt-2">A custody note records how an item was handled; a challenge tests how it may be relied upon. Neither establishes authenticity.</p>
              </div>

              <div className="bg-bar-panel2 p-3 rounded border border-white/5">
                <div className="text-bar-gold text-xs mb-2">Chain of custody — log an observation</div>
                {reviewedEvidence.length === 0 ? (
                  <p className="text-xs text-bar-muted">Review an evidence item in the Evidence panel first.</p>
                ) : (
                  <div className="grid gap-2">
                    <label className="text-xs flex flex-col gap-1">Reviewed item
                      <select className="bg-bar-bg border border-white/10 rounded p-1" value={caseTargetId} onChange={(e) => setCaseTarget(e.target.value)}>
                        {reviewedEvidence.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
                      </select>
                    </label>
                    <label className="text-xs flex flex-col gap-1">What did you observe about who handled it, and what is documented?
                      <textarea className="bg-bar-bg border border-white/10 rounded p-2 min-h-16" maxLength={1000} value={custodyText} onChange={(e) => setCustodyText(e.target.value)} placeholder="e.g. The export has no sealing record; note the gap rather than guessing." />
                    </label>
                    <button className="px-2 py-1 border border-bar-gold/30 rounded text-xs w-fit" onClick={doRecordCustody}>Log custody observation</button>
                  </div>
                )}
              </div>

              <div className="bg-bar-panel2 p-3 rounded border border-white/5">
                <div className="text-bar-gold text-xs mb-2">Admissibility — question how an item may be relied upon</div>
                <p role="note" className="text-xs text-bar-muted mb-2">{GROUND_FEEDBACK[challengeGround]} Authenticity remains undetermined.</p>
                {reviewedEvidence.length === 0 ? (
                  <p className="text-xs text-bar-muted">Review an evidence item in the Evidence panel first.</p>
                ) : (
                  <div className="grid gap-2">
                    <label className="text-xs flex flex-col gap-1">Reviewed item
                      <select className="bg-bar-bg border border-white/10 rounded p-1" value={caseTargetId} onChange={(e) => setCaseTarget(e.target.value)}>
                        {reviewedEvidence.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
                      </select>
                    </label>
                    <label className="text-xs flex flex-col gap-1">Ground
                      <select className="bg-bar-bg border border-white/10 rounded p-1" value={challengeGround} onChange={(e) => setChallengeGround(e.target.value as ChallengeGround)}>
                        {CHALLENGE_GROUNDS.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </label>
                    <label className="text-xs flex flex-col gap-1">Rationale
                      <textarea className="bg-bar-bg border border-white/10 rounded p-2 min-h-16" maxLength={1000} value={challengeText} onChange={(e) => setChallengeText(e.target.value)} placeholder="State why this ground matters, tied to what you reviewed." />
                    </label>
                    <button className="px-2 py-1 border border-bar-gold/30 rounded text-xs w-fit" onClick={doChallenge}>Record challenge</button>
                  </div>
                )}
              </div>

              <div className="bg-bar-panel2 p-3 rounded border border-white/5">
                <div className="text-bar-gold text-xs mb-2">Recorded casework</div>
                {save.custodyLog.length === 0 && save.challenges.length === 0 ? (
                  <p className="text-xs text-bar-muted">No custody observations or challenges recorded yet.</p>
                ) : (
                  <div className="grid gap-2">
                    {save.custodyLog.map((c) => (
                      <div key={c.id} className="text-xs"><span className="text-bar-gold">Custody (Day {c.day}, {c.evidenceId}):</span> {c.observation}</div>
                    ))}
                    {save.challenges.map((c) => (
                      <div key={c.id} className="text-xs"><span className="text-bar-gold">Challenge (Day {c.day}, {c.ground}, {c.evidenceId}):</span> {c.rationale}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-bar-panel2 p-3 rounded border border-white/5">
                <div className="text-bar-gold text-xs mb-2">Senior review & revision (Day 9)</div>
                {a7?.status === 'reviewed' ? (
                  <p className="text-xs">{a7.feedback}</p>
                ) : a7 && isAssignmentUnlocked(a7, save) ? (
                  <div className="grid gap-2">
                    <textarea aria-label="Work summary for senior review" className="bg-bar-bg border border-white/10 rounded p-2 min-h-20 text-sm" value={reviewSummary} onChange={(e) => setReviewSummary(e.target.value)} placeholder="Summarise the issue, evidence reviewed, sources used and your conclusion (at least 40 characters)." />
                    <button className="px-2 py-1 border border-bar-gold/30 rounded text-xs w-fit" onClick={doSeniorReview}>
                      {save.reviewRounds.some((r) => r.assignmentId === 'a7' && r.status === 'needs_revision') ? 'Revise & resubmit' : 'Submit to senior'}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-bar-muted">Unlocks on Day 9 after prior work is reviewed.</p>
                )}
                {save.reviewRounds.filter((r) => r.assignmentId === 'a7').map((r) => (
                  <div key={r.id} className="text-xs mt-2 border-t border-white/5 pt-2">
                    <span className="text-bar-gold">Round {r.round} — {r.status}:</span> {r.feedback}
                  </div>
                ))}
              </div>

              <div className="bg-bar-panel2 p-3 rounded border border-white/5">
                <div className="text-bar-gold text-xs mb-2">Final brief submission (Day 10)</div>
                {a8?.status === 'reviewed' ? (
                  <p className="text-xs">{a8.feedback}</p>
                ) : a8 && isAssignmentUnlocked(a8, save) ? (
                  <div className="grid gap-2">
                    <textarea aria-label="Final brief summary" className="bg-bar-bg border border-white/10 rounded p-2 min-h-20 text-sm" value={finalSummary} onChange={(e) => setFinalSummary(e.target.value)} placeholder="State your issue, evidence and conclusion without claiming unverified truth (at least 40 characters)." />
                    <button className="px-2 py-1 border border-bar-gold/30 rounded text-xs w-fit" onClick={doFinalBrief}>Submit final brief</button>
                  </div>
                ) : (
                  <p className="text-xs text-bar-muted">Unlocks on Day 10 after the senior accepts your revision.</p>
                )}
              </div>
            </div>
          )}

          {panel === 'theory' && (
            <div className="space-y-3 text-sm">
              <div className="bg-bar-panel2 p-3 rounded border border-white/5">
                <div className="text-bar-gold text-xs mb-1">Case theory — organise your working file</div>
                <p className="text-xs text-bar-muted">Record what you know, what is merely claimed, and what remains disputed. Every claim is your own working note; link only evidence you have discovered and reviewed. This panel never determines authenticity or responsibility.</p>
              </div>

              <div className="bg-bar-panel2 p-3 rounded border border-white/5">
                <div className="text-bar-gold text-xs mb-1">Evidence link summary</div>
                <p className="text-xs text-bar-muted">
                  {save.caseTheory.claims.length === 0
                    ? 'No claims recorded yet.'
                    : `${theorySupport.filter((s) => s.hasReviewedEvidence).length} of ${save.caseTheory.claims.length} claims are linked to reviewed evidence.`}
                </p>
                {unsupportedClaimCount > 0 && (
                  <p className="text-xs text-yellow-200 mt-1">
                    {unsupportedClaimCount} claim(s) have no reviewed evidence linked. Edit a claim below to link the items you relied on.
                  </p>
                )}
                <p role="note" className="text-xs text-bar-muted mt-2">A link only records which reviewed items you relied on. It is not a finding that the claim is true or that any item is authentic.</p>
              </div>

              <div className="bg-bar-panel2 p-3 rounded border border-bar-gold/30 grid gap-2">
                <label className="text-xs flex flex-col gap-1">Your claim
                  <textarea aria-label="Case theory claim" className="bg-bar-bg border border-white/10 rounded p-2 min-h-20" maxLength={1000} value={theoryText} onChange={(e) => setTheoryText(e.target.value)} placeholder="e.g. The medical report notes a minor injury, but its timing is not established." />
                </label>
                <label className="text-xs flex flex-col gap-1">Status
                  <select className="bg-bar-bg border border-white/10 rounded p-1" value={theoryStatus} onChange={(e) => setTheoryStatus(e.target.value as TheoryStatus)}>
                    {THEORY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <fieldset className="text-xs">
                  <legend className="text-bar-gold mb-1">Link reviewed evidence</legend>
                  {reviewedEvidence.length === 0 ? (
                    <p className="text-bar-muted">Review an evidence item in the Evidence panel first.</p>
                  ) : (
                    <div className="grid gap-1">
                      {reviewedEvidence.map((e) => (
                        <label key={e.id} className="flex items-center gap-2">
                          <input type="checkbox" checked={theoryEvidenceIds.includes(e.id)} onChange={() => toggleTheoryEvidence(e.id)} />
                          {e.title}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
                <button className="px-2 py-1 border border-bar-gold/30 rounded text-xs w-fit" onClick={doAddTheory}>Add claim</button>
              </div>

              {THEORY_STATUSES.map((status) => (
                <section key={status} aria-label={`${status} claims`} className="bg-bar-panel2 p-3 rounded border border-white/5">
                  <div className="text-bar-gold text-xs mb-2 uppercase tracking-wide">{status} ({groupedTheory[status].length})</div>
                  {groupedTheory[status].length === 0 ? (
                    <p className="text-xs text-bar-muted">No {status} claims yet.</p>
                  ) : (
                    <ul className="grid gap-2">
                      {groupedTheory[status].map((c) => {
                        const support = supportByClaimId.get(c.id);
                        const linkedIds = support?.reviewedEvidenceIds ?? [];
                        const linkedNotes = completion.synthesis.links.filter((link) => linkedIds.includes(link.evidenceId));
                        return (
                          <li key={c.id} className="text-xs border-l-2 border-bar-gold/30 pl-2">
                            <div>{c.text}</div>
                            <div className="text-bar-muted mt-1">Day {c.day}{linkedIds.length ? ` · Linked: ${linkedIds.map((id) => evidenceTitleById.get(id) ?? id).join(', ')}` : ''}</div>
                            <div className={`mt-1 ${support?.hasReviewedEvidence ? 'text-green-200' : 'text-yellow-200'}`}>
                              {support?.hasReviewedEvidence
                                ? `Supported by reviewed evidence: ${linkedIds.length} item(s).`
                                : 'Unsupported — no reviewed evidence linked.'}
                            </div>
                            {linkedNotes.length > 0 && (
                              <div className="text-bar-muted mt-1">
                                Notes on linked items: {linkedNotes.map((link) => `${link.relation} · ${link.note.slice(0, 120)}`).join(' | ')}
                              </div>
                            )}
                            {!!support?.unavailableEvidenceIds.length && (
                              <div className="text-yellow-200 mt-1">
                                Unavailable links (not reviewed): {support.unavailableEvidenceIds.map((id) => evidenceTitleById.get(id) ?? id).join(', ')}
                              </div>
                            )}
                            <button
                              type="button"
                              className="mt-2 px-2 py-1 border border-bar-gold/30 rounded text-xs"
                              aria-expanded={editingClaimId === c.id}
                              onClick={() => (editingClaimId === c.id ? setEditingClaimId(null) : openLinkEditor(c.id))}
                            >
                              {editingClaimId === c.id ? 'Close evidence links' : 'Edit evidence links'}
                            </button>
                            {editingClaimId === c.id && (
                              <fieldset className="mt-2 text-xs">
                                <legend className="text-bar-gold mb-1">Link reviewed evidence to this claim</legend>
                                {reviewedEvidence.length === 0 ? (
                                  <p className="text-bar-muted">Review an evidence item in the Evidence panel first.</p>
                                ) : (
                                  <div className="grid gap-1">
                                    {reviewedEvidence.map((e) => (
                                      <label key={e.id} className="flex items-center gap-2">
                                        <input type="checkbox" checked={editingLinks.includes(e.id)} onChange={() => toggleEditingLink(e.id)} />
                                        {e.title}
                                      </label>
                                    ))}
                                  </div>
                                )}
                                <div className="flex gap-2 mt-2">
                                  <button type="button" className="px-2 py-1 border border-bar-gold/30 rounded text-xs" onClick={() => doSaveClaimLinks(c.id)}>Save links</button>
                                  <button type="button" className="px-2 py-1 border border-white/10 rounded text-xs text-bar-muted" onClick={() => setEditingClaimId(null)}>Cancel</button>
                                </div>
                              </fieldset>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}

          {panel === 'research' && (
            <div className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <p className="text-xs text-bar-muted flex-1 min-w-48">Verified legal sources only. Unverified/placeholder entries cannot be cited as authoritative. Source Intake creates drafts only — the game never auto-verifies a citation.</p>
                <button
                  type="button"
                  className="px-2 py-1 border border-bar-gold/40 rounded text-xs"
                  aria-expanded={showSourceIntake}
                  aria-controls="source-intake-form"
                  onClick={() => { setShowSourceIntake((v) => !v); setIntakeError(''); }}
                >
                  {showSourceIntake ? 'Close intake' : 'Add Source / Source Intake'}
                </button>
              </div>

              {showSourceIntake && (
                <form
                  id="source-intake-form"
                  className="bg-bar-panel2 p-3 rounded border border-bar-gold/30 grid gap-2"
                  onSubmit={(e) => { e.preventDefault(); doAddSource(); }}
                >
                  <p className="text-xs text-yellow-200">New records enter as unverified or placeholder. Nothing here is a verified legal authority, and no citation is created for you.</p>
                  <label className="text-xs flex flex-col gap-1">Source title (required)
                    <input className="bg-bar-bg border border-white/10 rounded p-2" value={sourceForm.title} maxLength={MAX_SOURCE_FIELDS.title} onChange={(e) => setSourceField('title', e.target.value)} />
                  </label>
                  <label className="text-xs flex flex-col gap-1">Official source name (required)
                    <input className="bg-bar-bg border border-white/10 rounded p-2" value={sourceForm.sourceName} maxLength={MAX_SOURCE_FIELDS.sourceName} onChange={(e) => setSourceField('sourceName', e.target.value)} placeholder="Name as published — leave uncertain parts unspecified" />
                  </label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <label className="text-xs flex flex-col gap-1">Citation / identifier (required)
                      <input className="bg-bar-bg border border-white/10 rounded p-2" value={sourceForm.citation} maxLength={MAX_SOURCE_FIELDS.citation} onChange={(e) => setSourceField('citation', e.target.value)} placeholder="Leave blank if unknown — never guess a provision" />
                    </label>
                    <label className="text-xs flex flex-col gap-1">Source type (required)
                      <select className="bg-bar-bg border border-white/10 rounded p-2" value={sourceForm.sourceType} onChange={(e) => setSourceField('sourceType', e.target.value as SourceType)}>
                        {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <label className="text-xs flex flex-col gap-1">Jurisdiction (required)
                      <select className="bg-bar-bg border border-white/10 rounded p-2" value={sourceForm.jurisdiction} onChange={(e) => setSourceField('jurisdiction', e.target.value as SourceJurisdiction)}>
                        {SOURCE_JURISDICTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
                      </select>
                    </label>
                    <label className="text-xs flex flex-col gap-1">Effective date (optional, YYYY-MM-DD)
                      <input className="bg-bar-bg border border-white/10 rounded p-2" value={sourceForm.effectiveDate} maxLength={10} onChange={(e) => setSourceField('effectiveDate', e.target.value)} placeholder="YYYY-MM-DD" />
                    </label>
                  </div>
                  <label className="text-xs flex flex-col gap-1">Provenance note — where did this come from? (required)
                    <textarea className="bg-bar-bg border border-white/10 rounded p-2 min-h-16" value={sourceForm.provenance} maxLength={MAX_SOURCE_FIELDS.provenance} onChange={(e) => setSourceField('provenance', e.target.value)} placeholder="e.g. Notebook reference from the library shelf; exact text not yet checked" />
                  </label>
                  <label className="text-xs flex flex-col gap-1">Official source URL (optional)
                    <input className="bg-bar-bg border border-white/10 rounded p-2" value={sourceForm.sourceUrl} maxLength={MAX_SOURCE_FIELDS.sourceUrl} onChange={(e) => setSourceField('sourceUrl', e.target.value)} placeholder="Link to the publisher, if known" />
                  </label>
                  <label className="text-xs flex flex-col gap-1">Excerpt / summary — NON-AUTHORITATIVE (optional)
                    <textarea className="bg-bar-bg border border-white/10 rounded p-2 min-h-16" value={sourceForm.excerpt} maxLength={MAX_SOURCE_FIELDS.excerpt} onChange={(e) => setSourceField('excerpt', e.target.value)} placeholder="Your own note or summary; never treated as the text of the law" />
                  </label>
                  <label className="text-xs flex items-center gap-2">
                    <input type="checkbox" checked={sourceForm.requestPlaceholder} onChange={(e) => setSourceField('requestPlaceholder', e.target.checked)} />
                    Mark explicitly as a placeholder (stand-in; never authoritative)
                  </label>
                  {intakeError && <p role="alert" className="text-xs text-red-200 border border-red-400/30 rounded p-2">{intakeError}</p>}
                  {intakeNotice && <p role="status" className="text-xs text-green-200 border border-green-400/30 rounded p-2">{intakeNotice}</p>}
                  <div className="flex gap-2 flex-wrap">
                    <button type="submit" className="px-3 py-1 border border-bar-gold/40 rounded text-xs">Save draft source</button>
                    <button type="button" className="px-3 py-1 border border-white/10 rounded text-xs text-bar-muted" onClick={() => { setShowSourceIntake(false); setIntakeError(''); }}>Cancel</button>
                  </div>
                </form>
              )}

              {save.legalSources.map((s) => {
                const authoritative = canCiteAsAuthoritative(s);
                const badgeClass = authoritative
                  ? 'text-green-300 border-green-400/30'
                  : s.verificationStatus === 'placeholder'
                    ? 'text-red-200 border-red-400/40'
                    : 'text-yellow-300 border-yellow-400/40';
                const badgeText = authoritative
                  ? 'VERIFIED'
                  : s.verificationStatus === 'placeholder'
                    ? 'PLACEHOLDER — NOT AUTHORITATIVE'
                    : 'UNVERIFIED — NOT AUTHORITATIVE';
                return (
                  <article key={s.id} className="bg-bar-panel2 p-3 rounded border border-white/5 space-y-1">
                    <div className="flex justify-between gap-2 flex-wrap items-start">
                      <span className="text-bar-gold font-medium">{s.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${badgeClass}`}>{badgeText}</span>
                    </div>
                    <div className="text-xs text-bar-muted">Source name: {s.sourceName}</div>
                    <div className="text-xs text-bar-muted">Citation / identifier: {s.citation}</div>
                    <div className="text-xs text-bar-muted">Type: {s.sourceType} · Jurisdiction: {s.jurisdiction}{s.intake === 'player-draft' ? ' · Player draft' : ''}</div>
                    {s.effectiveDate && <div className="text-xs text-bar-muted">Effective date: {s.effectiveDate}</div>}
                    {s.verificationDate && <div className="text-xs text-bar-muted">Verified on {s.verificationDate}{s.verifiedBy ? ` by ${s.verifiedBy}` : ''}</div>}
                    <div className="text-xs text-bar-muted">Provenance (non-authoritative note): {s.provenance}</div>
                    {s.sourceUrl && <div className="text-xs text-bar-muted break-words">Official source URL: {s.sourceUrl}</div>}
                    {s.excerpt && <div className="text-xs text-yellow-200 border-l-2 border-yellow-400/40 pl-2">NON-AUTHORITATIVE EXCERPT/SUMMARY — not the text of the law: {s.excerpt}</div>}
                    {!authoritative && <p role="note" className="text-xs text-red-200">Warning: not verified. Do not cite this source as law.</p>}
                    {s.notes && <div className="text-xs">{s.notes}</div>}
                    <button
                      type="button"
                      className="mt-1 px-2 py-1 border border-bar-gold/30 rounded text-xs"
                      onClick={() => addNotebook({
                        kind: 'research',
                        title: `${authoritative ? 'Source' : 'UNVERIFIED SOURCE — do not cite'}: ${s.title}`,
                        content: `${authoritative ? '' : 'NOT AUTHORITATIVE — do not cite as law.\n'}${s.citation}\nProvenance: ${s.provenance}${s.excerpt ? `\nNON-AUTHORITATIVE EXCERPT: ${s.excerpt}` : ''}`,
                        sourceId: s.id,
                        source: s.citation,
                        verified: authoritative,
                      })}
                    >
                      Add to notebook{authoritative ? '' : ' (unverified reference)'}
                    </button>
                  </article>
                );
              })}
            </div>
          )}

          {panel === 'draft' && (
            <div className="space-y-2">
              <label htmlFor="draft-editor" className="text-xs text-bar-muted block">Draft editor — structure your issue, facts, verified sources, analysis, and conclusion.</label>
              <textarea id="draft-editor" aria-label="Draft editor" className="w-full min-h-52 bg-bar-panel2 border border-white/10 rounded p-2 text-sm" value={draft} maxLength={MAX_DRAFT_CHARS} onChange={(e) => setDraft(e.target.value)} />
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-bar-muted">
                <span>{draft.length}/{MAX_DRAFT_CHARS} characters</span>
                <span>Use only verified sources; no fabricated citations.</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button type="button" className="px-3 py-1 border border-bar-gold/30 rounded text-sm hover:bg-white/5" onClick={submitDraft}>Submit for senior review</button>
                <button type="button" className="px-3 py-1 border border-white/10 rounded text-sm text-bar-muted hover:bg-white/5" onClick={doSaveDraftVersion}>Save version</button>
                <button type="button" className="px-3 py-1 border border-white/10 rounded text-sm text-bar-muted hover:bg-white/5" onClick={() => addNotebook({ kind:'note', title:'Draft snapshot', content:draft, verified:false })}>Save draft note</button>
              </div>
              <div>
                <div className="text-xs text-bar-gold mb-1">Version history (max 8, newest first)</div>
                {save.draft.versions.length === 0 ? (
                  <p className="text-xs text-bar-muted">No versions yet. Use “Save version” to snapshot the draft with its day and time slot.</p>
                ) : (
                  <ul className="space-y-1">
                    {save.draft.versions.map((v) => (
                      <li key={v.id} className="bg-bar-panel2 p-2 rounded border border-white/5 flex items-center justify-between gap-2">
                        <div className="text-xs text-bar-muted">Day {v.day} · {v.slot} · {new Date(v.savedAt).toLocaleString()}</div>
                        <button className="px-2 py-1 border border-bar-gold/30 rounded text-xs" onClick={() => doLoadDraftVersion(v.id)}>Load</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-xs text-bar-muted">Deterministic feedback only in P0. Any legal references must be verified; no fabricated citations.</p>
            </div>
          )}

          {panel === 'journal' && (
            <div className="space-y-3 text-sm">
              <div className="bg-bar-panel2 p-3 rounded border border-white/5">
                <div className="text-bar-gold text-xs mb-1">Case timeline / journal</div>
                <p className="text-xs text-bar-muted">A chronological record of what you have legitimately learned and written. It contains only player-visible information: the true sequence of events, responsibility and authenticity are never recorded here.</p>
                <p className="text-xs text-bar-muted mt-1">Entries linked to an evidence item can be opened in the evidence board using “In evidence board” below.</p>
                <p className="text-xs text-bar-muted mt-1">
                  {caseSummary.phase} · {caseSummary.discoveredCount}/{caseSummary.evidenceTotal} evidence items discovered · {caseSummary.reviewedCount} reviewed. The case summary and this timeline draw on the same player-visible record.
                </p>
              </div>

              <div className="bg-bar-panel2 p-3 rounded border border-white/5">
                <div className="text-bar-gold text-xs mb-1">Current case-file knowledge (undated notes)</div>
                {playerCase.playerKnowledge.length === 0 ? (
                  <p className="text-xs text-bar-muted">No case-file notes recorded.</p>
                ) : (
                  <ul className="list-disc ml-5 text-xs text-bar-muted">
                    {playerCase.playerKnowledge.map((k, i) => <li key={i}>{k}</li>)}
                  </ul>
                )}
              </div>

              <div role="group" aria-label="Filter journal by kind" className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={journalFilter === 'all'}
                  onClick={() => setJournalFilter('all')}
                  className={`px-2 py-1 rounded border text-xs ${journalFilter === 'all' ? 'border-bar-gold text-bar-gold' : 'border-white/10 text-bar-muted'}`}
                >
                  All ({journal.length})
                </button>
                {JOURNAL_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={journalFilter === kind}
                    onClick={() => setJournalFilter(kind)}
                    className={`px-2 py-1 rounded border text-xs ${journalFilter === kind ? 'border-bar-gold text-bar-gold' : 'border-white/10 text-bar-muted'}`}
                  >
                    {kind} ({journalCounts[kind]})
                  </button>
                ))}
              </div>

              {(() => {
                const visible = journalFilter === 'all' ? journal : journal.filter((e) => e.kind === journalFilter);
                const days = groupJournalByDay(visible);
                if (days.length === 0) {
                  return <p className="text-xs text-bar-muted bg-bar-panel2 p-3 rounded border border-white/5">No journal entries for this filter yet.</p>;
                }
                return (
                  <ol aria-label="Case timeline" className="space-y-3">
                    {days.map((group) => (
                      <li key={group.day} className="bg-bar-panel2 p-3 rounded border border-white/5">
                        <h3 className="text-bar-gold text-xs uppercase tracking-wide mb-2">Day {group.day}</h3>
                        <ol className="grid gap-2">
                          {group.entries.map((entry) => (
                            <li key={entry.id} className="border-l-2 border-bar-gold/30 pl-2">
                              <div className="flex justify-between gap-2 flex-wrap">
                                <span className="text-bar-gold">{entry.title}</span>
                                <span className="text-[11px] uppercase tracking-wide text-bar-muted">{entry.kind}{entry.relation ? ` · ${entry.relation}` : ''}</span>
                              </div>
                              <p className="text-xs mt-1 whitespace-pre-wrap">{entry.detail}</p>
                              {entry.source && <p className="text-xs text-bar-muted mt-1">Provenance: {entry.source}</p>}
                              {entry.evidenceId && (
                                <button
                                  type="button"
                                  className="mt-1 px-2 py-1 border border-white/10 rounded text-xs text-bar-gold hover:bg-white/5"
                                  onClick={() => setPanel('evidence')}
                                >
                                  In evidence board: {evidenceTitleById.get(entry.evidenceId) ?? entry.evidenceId} →
                                </button>
                              )}
                            </li>
                          ))}
                        </ol>
                      </li>
                    ))}
                  </ol>
                );
              })()}
            </div>
          )}

          {panel === 'notebook' && (
            <div className="space-y-2 text-sm">
              <div role="group" aria-label="Filter notebook by kind" className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={notebookFilter === 'all'}
                  onClick={() => setNotebookFilter('all')}
                  className={`px-2 py-1 rounded border text-xs ${notebookFilter === 'all' ? 'border-bar-gold text-bar-gold' : 'border-white/10 text-bar-muted'}`}
                >
                  All ({save.notebook.length})
                </button>
                {notebookKinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={notebookFilter === kind}
                    onClick={() => setNotebookFilter(kind)}
                    className={`px-2 py-1 rounded border text-xs ${notebookFilter === kind ? 'border-bar-gold text-bar-gold' : 'border-white/10 text-bar-muted'}`}
                  >
                    {kind} ({save.notebook.filter((n) => n.kind === kind).length})
                  </button>
                ))}
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-auto">
                {(() => {
                  const filtered = save.notebook.filter((n) => notebookFilter === 'all' || n.kind === notebookFilter);
                  if (filtered.length === 0) return <p className="text-xs text-bar-muted bg-bar-panel2 p-3 rounded border border-white/5">No notebook entries for this filter.</p>;
                  return filtered.map((n) => (
                    <div key={n.id} className="bg-bar-panel2 p-2 rounded border border-white/5">
                      <div className="flex justify-between gap-2"><span className="text-bar-gold">{n.title}</span><span className="text-xs text-bar-muted">Day {n.day} • {n.kind}</span></div>
                      <div className="whitespace-pre-wrap text-sm mt-1">{n.content}</div>
                      {n.source && <div className="text-xs text-bar-muted mt-1">Source: {n.source} {n.verified ? '(verified)' : '(unverified)'}</div>}
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
