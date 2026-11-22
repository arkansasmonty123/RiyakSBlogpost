import { useMemo, useState } from 'react';
import { loadSave, persistSave, resetSave } from '@/storage/save';
import { checkDraftCitations } from '@/domain/guards';
import { canCiteAsAuthoritative, intakeSource, MAX_SOURCE_FIELDS, SOURCE_JURISDICTIONS, SOURCE_TYPES } from '@/domain/legalSources';
import { assertNoCanonicalTruthLeak, toPlayerCaseView } from '@/domain/caseAccess';
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
import { addTheoryClaim, groupTheoryClaims, THEORY_STATUSES } from '@/domain/theory';
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

const VIEWPOINTS: Record<string, { label: string; description: string; hotspots: Array<{ id: string; label: string; action: string }> }> = {
  entrance: {
    label: 'Entrance',
    description: 'The chamber door opens into a quiet, book-lined office. The day begins here.',
    hotspots: [
      { id: 'door', label: 'Door', action: 'view:bookshelf' },
      { id: 'senior', label: 'Senior Mentor', action: 'dialogue:senior' },
      { id: 'desk', label: 'Desk', action: 'view:desk' },
      { id: 'window', label: 'Window', action: 'view:window' },
    ],
  },
  desk: {
    label: 'Desk',
    description: 'Case files, drafts, and notes are spread across the desk.',
    hotspots: [
      { id: 'casefile', label: 'Case File', action: 'panel:case' },
      { id: 'assignments', label: 'Assignments', action: 'panel:assignments' },
      { id: 'draft', label: 'Draft Pad', action: 'panel:draft' },
      { id: 'back', label: 'Back to Entrance', action: 'view:entrance' },
    ],
  },
  bookshelf: {
    label: 'Bookshelf',
    description: 'Legal texts and reference materials line the wall. Only verified sources should be cited.',
    hotspots: [
      { id: 'research', label: 'Legal Research', action: 'panel:research' },
      { id: 'notebook', label: 'Notebook', action: 'panel:notebook' },
      { id: 'evidence', label: 'Evidence', action: 'panel:evidence' },
      { id: 'casework', label: 'Casework', action: 'panel:casework' },
      { id: 'back', label: 'Back to Entrance', action: 'view:entrance' },
    ],
  },
  window: {
    label: 'Window',
    description: 'Outside, the district moves on its own schedule. The world does not wait for the player.',
    hotspots: [
      { id: 'clock', label: 'Advance Time', action: 'time:advance' },
      { id: 'back', label: 'Back to Entrance', action: 'view:entrance' },
    ],
  },
};

const PANELS = ['case', 'assignments', 'evidence', 'casework', 'theory', 'research', 'draft', 'notebook', 'dialogue'] as const;
type Panel = (typeof PANELS)[number];

function makeNotebookEntry(entry: Omit<NotebookEntry, 'id' | 'day'>, save: SaveGame): NotebookEntry {
  return { id: makeId('n'), day: save.clock.day, ...entry };
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

  const viewpoint = VIEWPOINTS[save.selectedViewpoint] ?? VIEWPOINTS.entrance;
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
  const caseTargetId = caseTarget || reviewedEvidence[0]?.id || '';
  const a7 = save.assignments.find((a) => a.id === 'a7');
  const a8 = save.assignments.find((a) => a.id === 'a8');
  // Dev-time guard: fail loudly if any future UI change starts projecting canonical truth.
  if (import.meta.env.DEV) assertNoCanonicalTruthLeak(playerCase);

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
        source: ev.provenance, verified: false,
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
    setPanel('notebook');
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
      <header className="border-b border-bar-gold/20 px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-bar-gold tracking-wide">THE BAR</h1>
          <p className="text-xs text-bar-muted">Educational simulation — not legal advice. No fabricated citations.</p>
        </div>
        <div className="text-sm text-bar-muted flex gap-3 flex-wrap items-center">
          <span>Day {save.clock.day} / {MAX_DAY}</span><span>{save.clock.slot}</span><span>{save.player.careerStage}</span>
          <button className="px-2 py-1 border border-bar-gold/30 rounded" onClick={doAdvanceTime}>Advance time</button>
          <button className="px-2 py-1 border border-bar-gold/30 rounded" onClick={() => { persistSave(save); setDialogue('Saved locally.'); setPanel('dialogue'); }}>Save</button>
          <button className="px-2 py-1 border border-red-400/30 rounded text-red-200" onClick={() => { if (confirm('Reset local save?')) { setSave(resetSave()); setDraft(''); } }}>Reset</button>
        </div>
      </header>

      <div className="px-4 pt-3">
        <div className="bg-bar-panel border border-bar-gold/20 rounded-lg p-3" role="status" aria-live="polite">
          <div className="text-xs uppercase tracking-wide text-bar-muted">Current objective</div>
          {objective ? (
            <>
              <div className="text-sm text-bar-gold">{objective.title} <span className="text-bar-muted">— Day {objective.unlockDay} · {objective.status}</span></div>
              <div className="text-xs text-bar-muted mt-1">{objective.description}</div>
              <div className="flex flex-wrap gap-3 text-xs mt-1">
                <span>Progress: evidence {objective.evidenceProgress} · sources {objective.sourceProgress}{objective.noteProgress !== '0/0' ? ` · notes ${objective.noteProgress}` : ''}{objective.flagProgress !== '0/0' ? ` · casework ${objective.flagProgress}` : ''}</span>
                {objective.status === 'locked' && <span>Locked until Day {objective.unlockDay} and prior work reviewed.</span>}
              </div>
            </>
          ) : <div className="text-sm text-bar-muted">{save.flags.chapterOneComplete ? 'Chapter one complete — final brief submitted.' : 'All assignments reviewed.'}</div>}
        </div>
      </div>

      <main className="grid md:grid-cols-[1.4fr_1fr] gap-4 p-4">
        <section className="bg-bar-panel rounded-lg border border-bar-gold/10 p-4">
          <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg text-bar-gold">Senior Chamber — {viewpoint.label}</h2>
            <div className="flex gap-2 text-xs">
              {Object.entries(VIEWPOINTS).map(([k, v]) => (
                <button key={k} onClick={() => onHotspot(`view:${k}`)} className={`px-2 py-1 rounded border ${save.selectedViewpoint===k?'border-bar-gold text-bar-gold':'border-white/10 text-bar-muted'}`}>{v.label}</button>
              ))}
            </div>
          </div>
          <div className="bg-bar-panel2 rounded-md p-4 min-h-52 border border-white/5">
            <p className="text-sm text-bar-muted mb-4">{viewpoint.description}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {viewpoint.hotspots.map((h) => (
                <button key={h.id} onClick={() => onHotspot(h.action)} className="text-left p-3 rounded border border-bar-gold/20 hover:bg-white/5">
                  <div className="text-bar-gold text-sm">{h.label}</div>
                  <div className="text-xs text-bar-muted">{h.action}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid sm:grid-cols-3 gap-2 text-xs text-bar-muted">
            <div className="bg-bar-panel2 p-2 rounded">Competence: {save.player.reputation.competence}</div>
            <div className="bg-bar-panel2 p-2 rounded">Integrity: {save.player.reputation.integrity}</div>
            <div className="bg-bar-panel2 p-2 rounded">Reliability: {save.player.reputation.reliability}</div>
          </div>
        </section>

        <section className="bg-bar-panel rounded-lg border border-bar-gold/10 p-4">
          <nav aria-label="Work panels" className="flex gap-2 flex-wrap mb-3 text-sm">
            {PANELS.map((p) => (
              <button key={p} onClick={() => setPanel(p)} aria-current={panel===p ? 'page' : undefined} className={`px-2 py-1 rounded border ${panel===p?'border-bar-gold text-bar-gold':'border-white/10 text-bar-muted'}`}>{p}</button>
            ))}
          </nav>

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
                  <div className="text-xs text-bar-gold">Available conversations (Day {save.clock.day})</div>
                  {dialogueScenes.map((scene) => (
                    <div key={scene.id} className="bg-bar-panel2 p-3 rounded border border-white/5">
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
            <div className="space-y-2 text-sm">
              <div className="text-bar-gold font-medium">{playerCase.title}</div>
              <div className="text-bar-muted">Status: {playerCase.status} • Player knowledge only (canonical truth hidden)</div>
              <div><div className="text-bar-gold text-xs">Known/Player knowledge</div><ul className="list-disc ml-5">{playerCase.playerKnowledge.map((k,i)=><li key={i}>{k}</li>)}</ul></div>
              <div><div className="text-bar-gold text-xs">Allegations</div><ul className="list-disc ml-5">{playerCase.allegations.map((k,i)=><li key={i}>{k}</li>)}</ul></div>
              <div><div className="text-bar-gold text-xs">Unresolved ambiguity</div><ul className="list-disc ml-5">{playerCase.unresolvedAmbiguity.map((k,i)=><li key={i}>{k}</li>)}</ul></div>
              <div><div className="text-bar-gold text-xs">Admissible material</div><div>{playerCase.admissibleMaterial.length ? playerCase.admissibleMaterial.join(' · ') : 'Not yet determined.'}</div></div>
            </div>
          )}

          {panel === 'assignments' && (
            <div className="space-y-2 text-sm">
              {save.assignments.map((a: Assignment) => {
                const unlocked = isAssignmentUnlocked(a, save);
                return (
                  <div key={a.id} className="bg-bar-panel2 p-2 rounded border border-white/5">
                    <div className="flex justify-between"><span className="text-bar-gold">{a.title}</span><span className="text-xs text-bar-muted">Day {a.day} • {a.status}</span></div>
                    <div className="text-sm mt-1">{a.description}</div>
                    <div className="text-xs text-bar-muted mt-1">Required evidence: {a.requiredEvidenceIds.join(', ') || 'none'} • Sources: {a.requiredSourceIds.join(', ') || 'none'}{a.requiredNotebookKinds?.length ? ` • Notes: ${a.requiredNotebookKinds.join(', ')}` : ''}</div>
                    {!unlocked && a.status === 'locked' && <div className="text-xs text-yellow-300 mt-1">Locks until Day {a.day} and prior work is reviewed.</div>}
                    {a.feedback && <div className="text-xs mt-1 text-bar-text">Feedback: {a.feedback}</div>}
                    {(a.status === 'active' || a.status === 'submitted' || a.status === 'pending') && unlocked && a.id === 'a7' && (
                      <button className="mt-2 px-2 py-1 border border-bar-gold/30 rounded text-xs" onClick={() => setPanel('casework')}>Senior review & revision →</button>
                    )}
                    {(a.status === 'active' || a.status === 'pending') && unlocked && a.id === 'a8' && (
                      <button className="mt-2 px-2 py-1 border border-bar-gold/30 rounded text-xs" onClick={() => setPanel('casework')}>Final brief submission →</button>
                    )}
                    {(a.status === 'active' || a.status === 'pending') && unlocked && a.id !== 'a7' && a.id !== 'a8' && (
                      <button className="mt-2 px-2 py-1 border border-bar-gold/30 rounded text-xs" onClick={() => submitAssignment(a.id)}>Submit / Evaluate</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {panel === 'evidence' && (
            <div className="space-y-2 text-sm">
              <div className="bg-bar-panel2 p-2 rounded border border-white/5">
                <div className="text-xs text-bar-gold">How to read this list</div>
                <p className="text-xs text-bar-muted mt-1">Inspect an item to discover it, then mark it reviewed before recording your own assessment. The baseline labels below are non-authoritative practice values, not findings; authenticity is never determined in this panel.</p>
                <p className="text-xs text-bar-muted mt-1">Admissibility: unknown · admissible · questionable · inadmissible. Reliability: unknown · high · medium · low.</p>
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
                      {groupedTheory[status].map((c) => (
                        <li key={c.id} className="text-xs border-l-2 border-bar-gold/30 pl-2">
                          <div>{c.text}</div>
                          <div className="text-bar-muted mt-1">Day {c.day}{c.evidenceIds.length ? ` · Linked: ${c.evidenceIds.map((id) => evidenceTitleById.get(id) ?? id).join(', ')}` : ''}</div>
                        </li>
                      ))}
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
              <textarea aria-label="Draft editor" className="w-full min-h-52 bg-bar-panel2 border border-white/10 rounded p-2 text-sm" value={draft} maxLength={MAX_DRAFT_CHARS} onChange={(e) => setDraft(e.target.value)} />
              <div className="flex gap-2 flex-wrap">
                <button className="px-3 py-1 border border-bar-gold/30 rounded text-sm" onClick={submitDraft}>Submit for senior review</button>
                <button className="px-3 py-1 border border-white/10 rounded text-sm text-bar-muted" onClick={doSaveDraftVersion}>Save version</button>
                <button className="px-3 py-1 border border-white/10 rounded text-sm text-bar-muted" onClick={() => addNotebook({ kind:'note', title:'Draft snapshot', content:draft, verified:false })}>Save draft note</button>
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

          {panel === 'notebook' && (
            <div className="space-y-2 text-sm">
              <div role="group" aria-label="Filter notebook by kind" className="flex flex-wrap gap-2">
                <button
                  aria-pressed={notebookFilter === 'all'}
                  onClick={() => setNotebookFilter('all')}
                  className={`px-2 py-1 rounded border text-xs ${notebookFilter === 'all' ? 'border-bar-gold text-bar-gold' : 'border-white/10 text-bar-muted'}`}
                >
                  All ({save.notebook.length})
                </button>
                {notebookKinds.map((kind) => (
                  <button
                    key={kind}
                    aria-pressed={notebookFilter === kind}
                    onClick={() => setNotebookFilter(kind)}
                    className={`px-2 py-1 rounded border text-xs ${notebookFilter === kind ? 'border-bar-gold text-bar-gold' : 'border-white/10 text-bar-muted'}`}
                  >
                    {kind} ({save.notebook.filter((n) => n.kind === kind).length})
                  </button>
                ))}
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-auto">
                {save.notebook.filter((n) => notebookFilter === 'all' || n.kind === notebookFilter).map((n) => (
                  <div key={n.id} className="bg-bar-panel2 p-2 rounded border border-white/5">
                    <div className="flex justify-between gap-2"><span className="text-bar-gold">{n.title}</span><span className="text-xs text-bar-muted">Day {n.day} • {n.kind}</span></div>
                    <div className="whitespace-pre-wrap text-sm mt-1">{n.content}</div>
                    {n.source && <div className="text-xs text-bar-muted mt-1">Source: {n.source} {n.verified ? '(verified)' : '(unverified)'}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
