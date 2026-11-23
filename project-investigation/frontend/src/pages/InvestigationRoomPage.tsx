import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import type {
  Accusation,
  AccusationInput,
  ActivitySnapshot,
  Case,
  ChatMessage,
  CheckpointState,
  Development,
  DiscoverySnapshotDTO,
  DiscoveryClueDetailDTO,
  Evidence,
  Investigation,
  InvestigationStats,
  JournalEntry,
  KnowledgeDepth,
  KnowledgeIntent,
  NotebookEntryType,
  NotificationItem,
  PerspectiveConnections,
  PerspectiveExperienceDetail,
  PerspectiveSuggestion,
  PublicArtifactSummary,
  PublicCaseKnowledgePack,
  PublicDisagreement,
  PublicNotebookEntry,
  PublicSpecialist,
  RealityClaim,
  RealityConfidence,
  RealityHypothesis,
  RealityHypothesisStatus,
  RealityMapSnapshot,
  ScheduledEvent,
  Suspect,
  SuspectBoard,
  Solution,
  VerdictResult,
} from '../api';
import '../components/investigation/investigation.css';
import { DiscoverySubmitForm } from '../components/investigation/DiscoverySubmitForm';

type TabId = 'evidence' | 'suspects' | 'chat' | 'journal' | 'reality' | 'perspectives' | 'discoveries' | 'activity' | 'accusation';
type TabDef = { id: TabId; label: string; group: string; hint: string };

const TABS: TabDef[] = [
  { id: 'evidence', label: 'Evidence', group: 'Investigate', hint: 'Examine leads, file what you find, and run any available case actions.' },
  { id: 'suspects', label: 'Suspects', group: 'Investigate', hint: 'Profiles, alibis, relationships, and questions still unanswered.' },
  { id: 'chat', label: 'Interviews', group: 'Investigate', hint: 'Choose a voice, ask a question, and keep the thread in view.' },
  { id: 'journal', label: 'Journal', group: 'Reason', hint: 'A running record of what you noticed and what still needs checking.' },
  { id: 'reality', label: 'Reality Map', group: 'Reason', hint: 'Turn observations into claims, test explanations, and note contradictions.' },
  { id: 'perspectives', label: 'Perspectives', group: 'Reason', hint: 'Advisory ways of thinking. They do not add evidence or change the verdict.' },
  { id: 'discoveries', label: 'Field Research', group: 'Field', hint: 'Follow external leads and connect what you find back to the case.' },
  { id: 'activity', label: 'Activity', group: 'Field', hint: 'What changed while you were away, and what needs a response.' },
  { id: 'accusation', label: 'Accusation', group: 'Resolve', hint: 'State your conclusion when the file supports it.' },
];

const TAB_GROUPS: Array<{ group: string; tabs: TabDef[] }> = [];
for (const tab of TABS) {
  const existing = TAB_GROUPS.find((g) => g.group === tab.group);
  if (existing) existing.tabs.push(tab);
  else TAB_GROUPS.push({ group: tab.group, tabs: [tab] });
}

const INTENTS: Array<{ value: KnowledgeIntent; label: string }> = [
  { value: 'explain', label: 'Explain' },
  { value: 'deeper', label: 'Go deeper' },
  { value: 'relevance', label: 'Why it matters' },
  { value: 'challenge', label: 'Challenge this' },
  { value: 'alternatives', label: 'Alternatives' },
  { value: 'discriminate', label: 'Distinguish evidence' },
  { value: 'sources', label: 'Sources' },
  { value: 'simpler', label: 'Simpler explanation' },
  { value: 'critique', label: 'Critique' },
];
const DEPTHS: Array<{ value: KnowledgeDepth; label: string }> = [
  { value: 'plain', label: 'Plain language' },
  { value: 'working', label: 'Working detail' },
  { value: 'technical', label: 'Technical' },
];
const JOURNAL_TYPES = ['observation', 'hypothesis', 'question', 'timeline', 'contradiction', 'note'] as const;
const NOTEBOOK_TYPES: NotebookEntryType[] = ['observation', 'fact', 'suspicion', 'theory', 'question', 'rejected', 'contradiction', 'note'];
const CLAIM_CATEGORIES: Array<{ value: RealityClaim['claimCategory']; label: string }> = [
  { value: 'factual_observation', label: 'Factual observation' },
  { value: 'interpretation', label: 'Interpretation' },
  { value: 'assumption', label: 'Assumption' },
  { value: 'causal_explanation', label: 'Causal explanation' },
  { value: 'motive', label: 'Motive' },
  { value: 'timeline_assertion', label: 'Timeline assertion' },
  { value: 'unresolved_question', label: 'Unresolved question' },
];
const CONFIDENCE_LEVELS: Array<{ value: RealityConfidence; label: string }> = [
  { value: 'high_confidence', label: 'High confidence' },
  { value: 'moderate_confidence', label: 'Moderate confidence' },
  { value: 'low_confidence', label: 'Low confidence' },
  { value: 'insufficient_information', label: 'Insufficient information' },
];
const HYPOTHESIS_STATUSES: Array<{ value: RealityHypothesisStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'strengthened', label: 'Strengthened' },
  { value: 'weakened', label: 'Weakened' },
  { value: 'archived', label: 'Archived' },
];

function humanize(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}
function labelFor<T extends string>(options: Array<{ value: T; label: string }>, value: T | string | null | undefined): string {
  if (!value) return '';
  return options.find((o) => o.value === value)?.label ?? humanize(value);
}
function errMsg(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}
function isNotFound(err: unknown): boolean { return err instanceof ApiError && err.status === 404; }
function fmtDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
function clamp(n: number, min = 0, max = 100): number { return Math.max(min, Math.min(max, n)); }

type StatusTone = 'neutral' | 'good' | 'warn' | 'danger' | 'info';

/** A quiet status marker: word first, colour as reinforcement, never colour alone. */
function StatusMark({ tone = 'neutral', children }: { tone?: StatusTone; children: ReactNode }) {
  return (
    <span className={`cd-status cd-status--${tone}`}>
      <span className="cd-status__dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/** A note left in the file when a section has nothing in it yet. */
function EmptyNote({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="cd-empty">
      <p className="cd-empty__title">{title}</p>
      <p className="cd-empty__detail">{detail}</p>
    </div>
  );
}

/** Shared section header. Counts are plain text, not decorative chips. */
function SectionHead({ title, description, count, actions, id }: {
  title: string;
  description?: string;
  count?: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <div className="cd-section__head">
      <div className="cd-section__titles">
        <h3 id={id}>{title}</h3>
        {description ? <p className="cd-section__desc">{description}</p> : null}
      </div>
      {(count !== undefined && count !== null) || actions ? (
        <div className="cd-section__aside">
          {count !== undefined && count !== null ? <span className="cd-count">{count}</span> : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export const InvestigationRoomPage = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const investigationParam = searchParams.get('investigation');

  const [caseInfo, setCaseInfo] = useState<Case | null>(null);
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [conflict, setConflict] = useState<Investigation | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [openQuestions, setOpenQuestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [accusation, setAccusation] = useState<Accusation | null>(null);
  const [verdict, setVerdict] = useState<VerdictResult | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [solutionLoading, setSolutionLoading] = useState(false);
  const [stats, setStats] = useState<InvestigationStats | null>(null);
  const [checkpointState, setCheckpointState] = useState<CheckpointState | null>(null);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [specialists, setSpecialists] = useState<PublicSpecialist[]>([]);
  const [artifacts, setArtifacts] = useState<PublicArtifactSummary[]>([]);
  const [disagreements, setDisagreements] = useState<PublicDisagreement[]>([]);
  const [knowledgePack, setKnowledgePack] = useState<PublicCaseKnowledgePack | null>(null);
  const [notebookEntries, setNotebookEntries] = useState<PublicNotebookEntry[]>([]);
  const [realityMap, setRealityMap] = useState<RealityMapSnapshot | null>(null);
  const [perspectiveSuggestions, setPerspectiveSuggestions] = useState<PerspectiveSuggestion[]>([]);
  const [perspectiveEngagement, setPerspectiveEngagement] = useState<'none' | 'active'>('none');
  const [activePerspectiveKey, setActivePerspectiveKey] = useState<string | null>(null);
  const [activePerspectiveDetail, setActivePerspectiveDetail] = useState<PerspectiveExperienceDetail | null>(null);
  const [activePerspectiveConnections, setActivePerspectiveConnections] = useState<PerspectiveConnections | null>(null);
  const [discoverySnapshot, setDiscoverySnapshot] = useState<DiscoverySnapshotDTO | null>(null);
  const [selectedClueKey, setSelectedClueKey] = useState<string | null>(null);
  const [clueDetail, setClueDetail] = useState<DiscoveryClueDetailDTO | null>(null);
  const [activity, setActivity] = useState<ActivitySnapshot | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [activeTab, setActiveTab] = useState<TabId>('evidence');
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [selectedSpecialist, setSelectedSpecialist] = useState<string>('');
  const [chatIntent, setChatIntent] = useState<KnowledgeIntent>('explain');
  const [chatDepth, setChatDepth] = useState<KnowledgeDepth>('working');
  const [chatTarget, setChatTarget] = useState<string>('');
  const chatLogRef = useRef<HTMLDivElement | null>(null);

  const [journalType, setJournalType] = useState('observation');
  const [journalContent, setJournalContent] = useState('');
  const [journalEvidenceIds, setJournalEvidenceIds] = useState<string[]>([]);

  const [notebookType, setNotebookType] = useState<NotebookEntryType>('observation');
  const [notebookConcept, setNotebookConcept] = useState('');
  const [notebookTitle, setNotebookTitle] = useState('');
  const [notebookContent, setNotebookContent] = useState('');

  const [accuseCulprit, setAccuseCulprit] = useState('');
  const [accuseMotive, setAccuseMotive] = useState('');
  const [accuseMethod, setAccuseMethod] = useState('');
  const [accuseEvidence, setAccuseEvidence] = useState<string[]>([]);

  const [claimTitle, setClaimTitle] = useState('');
  const [claimDesc, setClaimDesc] = useState('');
  const [claimCategory, setClaimCategory] = useState<RealityClaim['claimCategory']>('factual_observation');
  const [claimConfidence, setClaimConfidence] = useState<RealityConfidence>('moderate_confidence');
  const [hypName, setHypName] = useState('');
  const [hypExplanation, setHypExplanation] = useState('');

  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    evidence: null, suspects: null, chat: null, journal: null, reality: null, perspectives: null, discoveries: null, activity: null, accusation: null,
  });

  const isCompleted = investigation?.status === 'completed';
  const discoveredIds = useMemo(() => new Set(investigation?.discoveredEvidenceIds ?? []), [investigation?.discoveredEvidenceIds]);
  const discoveredEvidence = useMemo(() => evidence.filter((e) => discoveredIds.has(e.id)), [evidence, discoveredIds]);
  const undiscoveredEvidence = useMemo(() => evidence.filter((e) => !discoveredIds.has(e.id)), [evidence, discoveredIds]);

  const setTab = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setError(null);
    setNotice(null);
  }, []);

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, current: TabId) => {
    const idx = TABS.findIndex((t) => t.id === current);
    if (idx < 0) return;
    let nextIdx = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = TABS.length - 1;
    else return;
    e.preventDefault();
    const next = TABS[nextIdx];
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const refreshInvestigation = useCallback(async (invId: string) => {
    const inv = await api.getInvestigation(invId);
    setInvestigation(inv);
    return inv;
  }, []);

  const loadAll = useCallback(async (inv: Investigation, caseData: Case) => {
    const invId = inv.id;
    const cId = caseData.id;
    const [ev, board, conv, jrnl, evts, acc, chk, dev, specs, arts, disag, pack, nb, rm, ds, act, notifs, st] = await Promise.all([
      api.getEvidence(cId).catch(() => []),
      api.getSuspectBoard(invId).catch(() => null as SuspectBoard | null),
      api.getConversation(invId).catch(() => ({ messageHistory: [] })),
      api.getJournal(invId).catch(() => []),
      api.getEvents(invId).catch(() => []),
      api.getAccusation(invId).catch(() => null),
      api.getCheckpoints(invId).catch(() => null),
      api.getDevelopments(invId).catch(() => []),
      api.getSpecialists(cId).catch(() => []),
      api.getArtifacts(cId).catch(() => []),
      api.getDisagreements(cId).catch(() => []),
      api.getCaseKnowledgePack(cId).catch(() => null),
      api.getNotebook(invId).catch(() => []),
      api.getRealityMap(invId).catch(() => null),
      api.getDiscoveries(invId).catch(() => null),
      api.getActivity(invId).catch(() => null),
      api.getNotifications({ status: 'all', limit: 20 }).catch(() => ({ unreadCount: 0, items: [] })),
      api.getStats(invId).catch(() => null),
    ]);
    setEvidence(Array.isArray(ev) ? ev : []);
    setSuspects(board?.suspects ?? []);
    setOpenQuestions(board?.openQuestions ?? []);
    setMessages(Array.isArray(conv?.messageHistory) ? conv.messageHistory! : []);
    setJournal(Array.isArray(jrnl) ? jrnl : []);
    setEvents(Array.isArray(evts) ? evts : []);
    setAccusation(acc);
    if (acc?.evaluationResult) {
      setVerdict({ valid: true, evaluationResult: acc.evaluationResult as any, message: '' } as VerdictResult);
    }
    setCheckpointState(chk);
    setDevelopments(Array.isArray(dev) ? dev : []);
    setSpecialists(Array.isArray(specs) ? specs : []);
    setArtifacts(Array.isArray(arts) ? arts : []);
    setDisagreements(Array.isArray(disag) ? disag : []);
    setKnowledgePack(pack);
    setNotebookEntries(Array.isArray(nb) ? nb : []);
    setRealityMap(rm);
    setDiscoverySnapshot(ds);
    setActivity(act);
    setNotifications(notifs?.items ?? []);
    setStats(st);
    if (inv.status === 'completed') {
      setSolutionLoading(true);
      api.getSolution(invId).then(setSolution).catch(() => setSolution(null)).finally(() => setSolutionLoading(false));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!caseId) { setFatalError('Missing case ID.'); setLoading(false); return; }
      setLoading(true);
      setFatalError(null);
      setConflict(null);
      try {
        const c = await api.getCase(caseId);
        if (cancelled) return;
        setCaseInfo(c);

        let inv: Investigation | null = null;
        if (investigationParam) {
          try { inv = await api.getInvestigation(investigationParam); } catch (e) { if (!isNotFound(e)) throw e; }
        }
        if (!inv) {
          try { inv = await api.getActiveInvestigation(); } catch (e) { if (!isNotFound(e)) throw e; }
        }
        if (inv && inv.caseId !== caseId) {
          if (!cancelled) { setConflict(inv); setLoading(false); }
          return;
        }
        if (!inv) {
          try {
            inv = await api.createInvestigation(caseId);
          } catch (e) {
            if (e instanceof ApiError && e.status === 409) {
              const active = await api.getActiveInvestigation().catch(() => null);
              if (!cancelled) { setConflict(active); setLoading(false); }
              return;
            }
            throw e;
          }
        }
        if (cancelled || !inv) return;
        setInvestigation(inv);
        setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('investigation', inv!.id); return n; }, { replace: true });
        await loadAll(inv, c);
      } catch (e) {
        if (!cancelled) setFatalError(errMsg(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => { cancelled = true; };
  }, [caseId, investigationParam, loadAll, setSearchParams]);

  useEffect(() => { chatLogRef.current?.scrollTo({ top: chatLogRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, activeTab]);

  const withBusy = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError(null); setNotice(null);
    try { await fn(); } catch (e) { setError(errMsg(e)); } finally { setBusy(null); }
  };

  const reloadSuspects = async () => { if (!investigation) return; const b = await api.getSuspectBoard(investigation.id).catch(() => null); setSuspects(b?.suspects ?? []); setOpenQuestions(b?.openQuestions ?? []); };
  const reloadJournal = async () => { if (!investigation) return; setJournal(await api.getJournal(investigation.id).catch(() => [])); };
  const reloadNotebook = async () => { if (!investigation) return; setNotebookEntries(await api.getNotebook(investigation.id).catch(() => [])); };
  const reloadReality = async () => { if (!investigation) return; setRealityMap(await api.getRealityMap(investigation.id).catch(() => null)); };
  const reloadActivity = async () => { if (!investigation) return; setActivity(await api.getActivity(investigation.id).catch(() => null)); };
  const reloadDiscoveries = async () => { if (!investigation) return; setDiscoverySnapshot(await api.getDiscoveries(investigation.id).catch(() => null)); };
  const reloadStats = async () => { if (!investigation) return; setStats(await api.getStats(investigation.id).catch(() => null)); };

  const handleDiscover = async (evidenceId: string) => {
    if (!investigation) return;
    await withBusy(`discover:${evidenceId}`, async () => {
      const updated = await api.discoverEvidence(investigation.id, evidenceId);
      setInvestigation(updated);
      await Promise.all([reloadSuspects(), reloadStats(), reloadReality()]);
      setNotice('Evidence added to your case file.');
    });
  };

  const handleAction = async (action: string) => {
    if (!investigation) return;
    await withBusy(`action:${action}`, async () => {
      const res = await api.performAction(investigation.id, action);
      setNotice(res.developments?.[0]?.message || 'Action recorded.');
      await Promise.all([refreshInvestigation(investigation.id), reloadSuspects(), reloadActivity(), reloadStats(), reloadJournal(), reloadReality()]);
      if (res.newlyReleased?.length) setEvidence((prev) => prev.map((ev) => res.newlyReleased!.find((n) => n.id === ev.id) ? { ...ev, playerVisible: true } : ev));
    });
  };

  const handleSendChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!investigation) return;
    const msg = chatInput.trim();
    if (!msg) return;
    await withBusy('chat', async () => {
      const res = await api.sendChat(investigation.id, msg, {
        specialistKey: selectedSpecialist || undefined,
        intent: selectedSpecialist ? chatIntent : undefined,
        depth: selectedSpecialist ? chatDepth : undefined,
        targetSpecialistKey: selectedSpecialist && chatTarget ? chatTarget : undefined,
      });
      setMessages((prev) => [...prev, { role: 'player', content: msg, timestamp: new Date().toISOString() } as ChatMessage, res]);
      setChatInput('');
      await Promise.all([reloadSuspects(), reloadActivity(), reloadReality(), reloadStats()]);
    });
  };

  const handleAddJournal = async (e: FormEvent) => {
    e.preventDefault();
    if (!investigation || !journalContent.trim()) return;
    await withBusy('journal', async () => {
      await api.addJournal(investigation.id, { entryType: journalType, content: journalContent.trim(), relatedEvidenceIds: journalEvidenceIds });
      setJournalContent(''); setJournalEvidenceIds([]);
      await reloadJournal();
      setNotice('Journal entry saved.');
    });
  };

  const handleCreateNotebook = async (e: FormEvent) => {
    e.preventDefault();
    if (!investigation) return;
    await withBusy('notebook', async () => {
      await api.createNotebookEntry(investigation.id, { entryType: notebookType, concept: notebookConcept.trim() || undefined, title: notebookTitle.trim() || undefined, content: notebookContent.trim() || undefined });
      setNotebookConcept(''); setNotebookTitle(''); setNotebookContent('');
      await reloadNotebook();
      setNotice('Notebook entry created.');
    });
  };

  const handleDeleteNotebook = async (entryId: string) => {
    if (!investigation) return;
    await withBusy(`nb-del:${entryId}`, async () => { await api.deleteNotebookEntry(investigation.id, entryId); await reloadNotebook(); });
  };

  const handleExportNotebook = async (format: 'json' | 'markdown') => {
    if (!investigation) return;
    await withBusy(`nb-export:${format}`, async () => {
      if (format === 'json') {
        const data = await api.exportNotebookJson(investigation.id);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `notebook-${investigation.id}.json`; a.click(); URL.revokeObjectURL(url);
      } else {
        const text = await api.exportNotebookMarkdown(investigation.id);
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `notebook-${investigation.id}.md`; a.click(); URL.revokeObjectURL(url);
      }
    });
  };

  const handleCreateClaim = async (e: FormEvent) => {
    e.preventDefault();
    if (!investigation || !claimTitle.trim()) return;
    await withBusy('create-claim', async () => {
      await api.createRealityClaim(investigation.id, { title: claimTitle.trim(), description: claimDesc.trim(), claimCategory, confidence: claimConfidence });
      setClaimTitle(''); setClaimDesc('');
      await reloadReality();
    });
  };
  const handleDeleteClaim = async (claimId: string) => { if (!investigation) return; await withBusy(`del-claim:${claimId}`, async () => { await api.deleteRealityClaim(investigation.id, claimId); await reloadReality(); }); };
  const handleCreateHypothesis = async (e: FormEvent) => {
    e.preventDefault();
    if (!investigation || !hypName.trim()) return;
    await withBusy('create-hyp', async () => {
      await api.createRealityHypothesis(investigation.id, { name: hypName.trim(), explanation: hypExplanation.trim() });
      setHypName(''); setHypExplanation('');
      await reloadReality();
    });
  };
  const handleDeleteHypothesis = async (id: string) => { if (!investigation) return; await withBusy(`del-hyp:${id}`, async () => { await api.deleteRealityHypothesis(investigation.id, id); await reloadReality(); }); };
  const handleHypStatus = async (hyp: RealityHypothesis, status: RealityHypothesisStatus) => {
    if (!investigation) return;
    await withBusy(`hyp-status:${hyp.id}`, async () => { await api.updateRealityHypothesis(investigation.id, hyp.id, { status }); await reloadReality(); });
  };

  const loadPerspectiveSuggestions = useCallback(async () => {
    if (!investigation) return;
    try {
      const res = await api.getPerspectiveSuggestions(investigation.id);
      setPerspectiveSuggestions(res.suggestions ?? []);
      setPerspectiveEngagement(res.engagement ?? 'none');
    } catch { /* non-blocking */ }
  }, [investigation]);
  useEffect(() => { void loadPerspectiveSuggestions(); }, [loadPerspectiveSuggestions]);

  const openPerspective = async (key: string) => {
    await withBusy(`perspective:${key}`, async () => {
      const [detail, connections] = await Promise.all([api.getPerspective(key), api.getPerspectiveConnections(key).catch(() => null)]);
      setActivePerspectiveKey(key);
      setActivePerspectiveDetail(detail);
      setActivePerspectiveConnections(connections);
      if (investigation) await api.dismissPerspectiveSuggestion(investigation.id, key, { reasonCode: 'opened' }).catch(() => null);
      await loadPerspectiveSuggestions();
    });
  };

  const openClue = async (clueKey: string) => {
    if (!investigation) return;
    setSelectedClueKey(clueKey);
    await withBusy(`clue:${clueKey}`, async () => { setClueDetail(await api.getDiscoveryClue(investigation.id, clueKey)); });
  };
  const submitDiscovery = async (clueKey: string, payload: { explanation: string; subjectIdentification: string; connectionExplanation: string; uncertainty: string; sourceRefs: string[] }) => {
    if (!investigation) return;
    await withBusy(`submit-discovery:${clueKey}`, async () => {
      await api.submitDiscovery(investigation.id, clueKey, payload);
      await Promise.all([reloadDiscoveries(), openClue(clueKey), reloadStats(), reloadActivity(), reloadNotebook()]);
      setNotice('Discovery submission evaluated.');
    });
  };
  const applyUnlock = async (clueKey: string, unlockKey: string) => {
    if (!investigation) return;
    await withBusy(`unlock:${unlockKey}`, async () => {
      await api.applyDiscoveryUnlock(investigation.id, clueKey, unlockKey);
      await Promise.all([reloadDiscoveries(), selectedClueKey ? openClue(selectedClueKey) : Promise.resolve(), reloadActivity(), reloadSuspects()]);
      setNotice('Unlock applied.');
    });
  };

  const refreshActivity = async () => {
    if (!investigation) return;
    await withBusy('activity-refresh', async () => {
      await api.refreshActivity(investigation.id, { max: 20 });
      await Promise.all([reloadActivity(), refreshInvestigation(investigation.id), reloadSuspects(), reloadStats()]);
    });
  };
  const markActivitySeen = async () => {
    if (!investigation) return;
    await withBusy('activity-seen', async () => { await api.markActivitySeen(investigation.id, { through: new Date().toISOString() }); await reloadActivity(); });
  };

  const handleSubmitAccusation = async (e: FormEvent) => {
    e.preventDefault();
    if (!investigation) return;
    const input: AccusationInput = { submittedCulprit: accuseCulprit.trim(), motive: accuseMotive.trim(), method: accuseMethod.trim(), supportingEvidence: accuseEvidence };
    if (!input.submittedCulprit || !input.motive || !input.method) { setError('Culprit, motive, and method are required.'); return; }
    await withBusy('accuse', async () => {
      await api.submitAccusation(investigation.id, input);
      const v = await api.evaluateAccusation(investigation.id, { culprit: input.submittedCulprit, motive: input.motive, method: input.method, supportingEvidence: input.supportingEvidence });
      setVerdict(v);
      await Promise.all([refreshInvestigation(investigation.id), reloadStats(), reloadActivity()]);
      if (v.status === 'evaluated' || v.evaluationResult) {
        try { setSolution(await api.getSolution(investigation.id)); } catch { /* may not be completed */ }
      }
    });
  };

  const handleAbandon = async () => {
    if (!investigation) return;
    if (!window.confirm('Abandon this investigation? Your notes and evidence history will be preserved in the archive.')) return;
    await withBusy('abandon', async () => { await api.abandonInvestigation(investigation.id); navigate('/?abandoned=1'); });
  };

  const progressPct = clamp(Math.round(investigation?.progress ?? stats?.progress ?? 0));
  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const nextStep = useMemo(() => {
    if (isCompleted) return { title: 'Case complete', detail: 'Review the verdict, solution, and timeline in the Accusation tab.' };
    if (discoveredEvidence.length === 0 && undiscoveredEvidence.length > 0) return { title: 'Examine your first lead', detail: 'Open Evidence and examine an available lead to start building the case file.' };
    if (openQuestions.length > 0) return { title: 'Follow an open question', detail: openQuestions[0] };
    if (undiscoveredEvidence.length > 0) return { title: 'Keep gathering evidence', detail: `${undiscoveredEvidence.length} lead${undiscoveredEvidence.length === 1 ? '' : 's'} still available to examine.` };
    if ((realityMap?.claims.length ?? 0) === 0) return { title: 'Organize your reasoning', detail: 'Use the Reality Map to turn observations into claims and test hypotheses.' };
    return { title: 'Assess your case', detail: 'When motive, method, and culprit are supported by evidence, submit an accusation.' };
  }, [isCompleted, discoveredEvidence.length, undiscoveredEvidence.length, openQuestions, realityMap?.claims.length]);

  if (loading) {
    return (
      <div className="page-state" role="status" aria-live="polite">
        Opening case file…
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="error" role="alert">
        <p>{fatalError}</p>
        <Link to="/" className="button-link">Back to cases</Link>
      </div>
    );
  }

  if (conflict) {
    return (
      <div className="cd-room page-enter">
        <div className="cd-callout cd-callout--warn" role="alert">
          <h2>Another investigation is open</h2>
          <p>There is already an active investigation for <strong>{conflict.caseId}</strong>. Only one case can be open at a time.</p>
          <div className="cd-actions">
            <Link className="button-link" to={`/investigation/${conflict.caseId}?investigation=${encodeURIComponent(conflict.id)}`}>Continue active investigation</Link>
            <Link className="cd-textlink" to="/">Back to case library</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!caseInfo || !investigation) {
    return <div className="error" role="alert">Investigation unavailable.</div>;
  }

  const tabCount = (tab: TabId): number | null => {
    if (tab === 'activity') return activity?.counts?.unread ?? null;
    if (tab === 'discoveries') return discoverySnapshot?.newClueKeys?.length ?? null;
    return null;
  };

  return (
    <div className="investigation-room inv-room cd-room page-enter">
      <header className="cd-masthead">
        <div className="cd-masthead__top">
          <div className="cd-identity">
            <p className="cd-case-type">
              <span>{caseInfo.genre || 'Case file'}</span>
              {caseInfo.difficulty ? <span>{humanize(caseInfo.difficulty)}</span> : null}
            </p>
            <h2 className="cd-case-title">{caseInfo.title}</h2>
            <div className="cd-briefing">
              {(caseInfo.briefing || caseInfo.description || '').split(/\n\n+/).filter(Boolean).map((para, i) => <p key={i}>{para}</p>)}
            </div>
          </div>
          <nav className="cd-case-links" aria-label="Case navigation">
            <Link className="cd-textlink" to="/">Case library</Link>
            <Link className="cd-textlink" to="/archive">Archive</Link>
            {!isCompleted && (
              <button type="button" className="cd-textlink cd-textlink--danger" onClick={() => void handleAbandon()} disabled={busy === 'abandon'}>
                Abandon case
              </button>
            )}
          </nav>
        </div>

        <div className="cd-statusline" aria-label="Investigation status">
          <span className={`cd-state ${isCompleted ? 'cd-state--complete' : 'cd-state--active'}`}>
            <span className="cd-state__dot" aria-hidden="true" />
            {humanize(investigation.status ?? 'active')}
          </span>
          <span className="cd-statusline__item">{humanize(investigation.currentStage ?? 'investigating')}</span>
          <span className="cd-statusline__item">{progressPct}% examined</span>
          {stats ? <span className="cd-statusline__item">{stats.evidence.discovered} of {stats.evidence.total} evidence items</span> : null}
          {stats ? <span className="cd-statusline__item">{stats.checkpoints.answered} of {stats.checkpoints.total} checkpoints</span> : null}
          {knowledgePack ? <span className="cd-statusline__item">Knowledge base v{knowledgePack.version}</span> : null}
        </div>

        <div className="cd-progress">
          <span className="cd-progress__label" id="cd-progress-label">Case file progress</span>
          <div className="cd-progress__track" role="progressbar" aria-labelledby="cd-progress-label" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
            <span style={{ width: `${progressPct}%` }} />
          </div>
          <span className="cd-progress__value">{progressPct}%</span>
        </div>

        <p className="cd-next">
          <span className="cd-next__label">Next</span>
          <span><strong>{nextStep.title}.</strong> {nextStep.detail}</span>
        </p>
      </header>

      {error ? <div className="error" role="alert">{error}</div> : null}
      {notice ? <div className="cd-callout cd-callout--success" role="status" aria-live="polite">{notice}</div> : null}
      {isCompleted ? (
        <div className="cd-callout cd-callout--success" role="status">This case is closed. The verdict and solution are in the Accusation section.</div>
      ) : null}

      <div className="cd-tabsbar">
        <div className="cd-tabs" role="tablist" aria-label="Investigation sections">
          {TAB_GROUPS.map((group) => (
            <div key={group.group} className="cd-tabgroup" role="presentation">
              <span className="cd-group-label" aria-hidden="true">{group.group}</span>
              {group.tabs.map((tab) => {
                const count = tabCount(tab.id);
                const label = count ? `${tab.label} (${count})` : tab.label;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => { tabRefs.current[tab.id] = el; }}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={activeTab === tab.id}
                    aria-controls={`panel-${tab.id}`}
                    aria-label={label}
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    className={`cd-tab ${activeTab === tab.id ? 'cd-tab--active' : ''}`}
                    onClick={() => setTab(tab.id)}
                    onKeyDown={(e) => onTabKeyDown(e, tab.id)}
                  >
                    <span>{tab.label}</span>
                    {count ? <span className="cd-tab__count" aria-hidden="true">{count}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <p className="cd-hint" id="cd-tab-hint">{activeTabDef.hint}</p>
      </div>

      <section
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        aria-describedby="cd-tab-hint"
        className="cd-panel"
        tabIndex={0}
      >
        {activeTab === 'evidence' && (
          <div className="cd-workspace">
            <div className="cd-workspace__main">
              <div className="cd-section">
                <SectionHead
                  title="In the case file"
                  description="What you have examined and filed."
                  count={`${discoveredEvidence.length} filed`}
                />
                {discoveredEvidence.length === 0 ? (
                  <EmptyNote title="Nothing filed yet." detail="Examine a lead to add it to the case file." />
                ) : (
                  <ol className="cd-entries">
                    {discoveredEvidence.map((ev, i) => (
                      <li className="cd-entry cd-entry--filed" key={ev.id}>
                        <span className="cd-entry__index" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                        <div className="cd-entry__body">
                          <h4 className="cd-entry__title">{ev.source || 'Evidence item'}</h4>
                          <p className="cd-entry__meta">
                            <span>{humanize(ev.category)}</span>
                            {ev.timelineReference ? <span>{ev.timelineReference}</span> : null}
                          </p>
                          <p className="cd-entry__text">{ev.description}</p>
                          <p className="cd-entry__note">
                            <span>Reliability: {humanize(String(ev.reliability ?? 'unknown'))}</span>
                            {ev.associatedCharacters?.length ? <span>People: {ev.associatedCharacters.join(', ')}</span> : null}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            <aside className="cd-workspace__aside" aria-label="Leads and case actions">
              <div className="cd-section">
                <SectionHead
                  title="Available leads"
                  description="Visible in this case, not yet examined."
                  count={undiscoveredEvidence.length}
                />
                {undiscoveredEvidence.length === 0 ? (
                  <EmptyNote title="All visible leads examined." detail="New items may appear as the case develops." />
                ) : (
                  <ol className="cd-entries">
                    {undiscoveredEvidence.map((ev, i) => (
                      <li className="cd-entry cd-entry--lead" key={ev.id}>
                        <span className="cd-entry__index" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                        <div className="cd-entry__body">
                          <h4 className="cd-entry__title">{ev.source || 'Lead'}</h4>
                          <p className="cd-entry__meta"><span>{humanize(ev.category)}</span></p>
                          <p className="cd-entry__text cd-entry__text--quiet">Examine to reveal what it contains.</p>
                        </div>
                        <button
                          type="button"
                          className="cd-inline-action"
                          onClick={() => void handleDiscover(ev.id)}
                          disabled={busy === `discover:${ev.id}` || isCompleted}
                          aria-label={`Examine lead: ${ev.source || humanize(ev.category) || ev.id}`}
                        >
                          {busy === `discover:${ev.id}` ? 'Examining…' : 'Examine'}
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {checkpointState?.actions?.length ? (
                <div className="cd-section">
                  <SectionHead title="Case actions" description="Actions available in this case." />
                  <ol className="cd-entries">
                    {checkpointState.actions.map((a) => (
                      <li className="cd-entry" key={a.action}>
                        <div className="cd-entry__body">
                          <h4 className="cd-entry__title">{a.label || humanize(a.action)}</h4>
                          <p className="cd-entry__meta"><span>{humanize(a.action)}</span></p>
                        </div>
                        {a.performed ? (
                          <StatusMark tone="good">Done</StatusMark>
                        ) : (
                          <button
                            type="button"
                            className="cd-inline-action"
                            onClick={() => void handleAction(a.action)}
                            disabled={!!busy || isCompleted}
                            aria-label={`Run action: ${a.label || humanize(a.action)}`}
                          >
                            {busy === `action:${a.action}` ? 'Running…' : 'Run'}
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </aside>
          </div>
        )}

        {activeTab === 'suspects' && (
          <div className="cd-section">
            <SectionHead
              title="People of interest"
              description="Profiles, alibis, connections, and what remains unanswered."
              count={`${suspects.length} profiles`}
            />
            {openQuestions.length > 0 ? (
              <div className="cd-callout cd-callout--warn" role="status">
                <p className="cd-callout__title">Open questions</p>
                <ul className="cd-list cd-list--bulleted">
                  {openQuestions.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
              </div>
            ) : null}
            {suspects.length === 0 ? (
              <EmptyNote title="No profiles in this case file." detail="Profiles appear here when the case provides them." />
            ) : (
              <div className="cd-folds">
                {suspects.map((s) => (
                  <details className="cd-fold" key={s.id}>
                    <summary>
                      <span className="cd-fold__heading">
                        <span className="cd-fold__title">{s.name}</span>
                        <span className="cd-fold__meta">
                          <span>{s.role || 'Person of interest'}</span>
                          {s.playerSuspicion ? <span>Suspicion: {humanize(String(s.playerSuspicion))}</span> : null}
                          <span>{s.linkedEvidenceCount ?? s.linkedEvidence?.length ?? 0} links</span>
                        </span>
                      </span>
                      <span className="cd-fold__marker" aria-hidden="true" />
                    </summary>
                    <div className="cd-fold__body">
                      <dl className="cd-kv">
                        {s.personality ? <><dt>Personality</dt><dd>{s.personality}</dd></> : null}
                        {s.background ? <><dt>Background</dt><dd>{s.background}</dd></> : null}
                        {s.motive ? <><dt>Possible motive</dt><dd>{s.motive}</dd></> : null}
                        {s.alibi ? <><dt>Alibi</dt><dd>{s.alibi}</dd></> : null}
                        {s.confirmedAlibi ? <><dt>Confirmed alibi</dt><dd>{s.confirmedAlibi}</dd></> : null}
                      </dl>
                      {s.relationships?.length ? (
                        <div className="cd-subsection">
                          <h4>Relationships</h4>
                          <ul className="cd-list">
                            {s.relationships.map((r, i) => <li key={i}><strong>{r.name}</strong> <span className="cd-muted">{r.label}</span></li>)}
                          </ul>
                        </div>
                      ) : null}
                      {s.linkedEvidence?.length ? (
                        <div className="cd-subsection">
                          <h4>Linked evidence</h4>
                          <ul className="cd-list">
                            {s.linkedEvidence.map((le) => (
                              <li key={le.id}>
                                <span className="cd-muted">{le.examined ? 'Filed' : 'Not examined'}</span>
                                <span><strong>{le.source}</strong> <span className="cd-muted">{humanize(le.category)}{le.timelineReference ? `, ${le.timelineReference}` : ''}</span></span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {s.unansweredQuestions?.length ? (
                        <div className="cd-subsection">
                          <h4>Unanswered questions</h4>
                          <ul className="cd-list cd-list--bulleted">{s.unansweredQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                        </div>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="cd-workspace">
            <div className="cd-workspace__main">
              <div className="cd-section">
                <SectionHead
                  title="Interviews"
                  description="Ask the team or consult a specialist. Answers are guidance, not a verdict."
                  count={`${messages.length} messages`}
                />
                <div className="cd-toolbar" role="group" aria-label="Conversation settings">
                  <label className="cd-field cd-field--compact">
                    <span className="cd-field__label">Voice</span>
                    <select value={selectedSpecialist} onChange={(e) => setSelectedSpecialist(e.target.value)} aria-label="Select conversation voice">
                      <option value="">Investigation team</option>
                      {specialists.map((sp) => <option key={sp.id} value={sp.specialistKey}>{sp.name} — {sp.title}</option>)}
                    </select>
                  </label>
                  <label className="cd-field cd-field--compact">
                    <span className="cd-field__label">Intent</span>
                    <select value={chatIntent} onChange={(e) => setChatIntent(e.target.value as KnowledgeIntent)} disabled={!selectedSpecialist} aria-label="Question intent">
                      {INTENTS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                    </select>
                  </label>
                  <label className="cd-field cd-field--compact">
                    <span className="cd-field__label">Depth</span>
                    <select value={chatDepth} onChange={(e) => setChatDepth(e.target.value as KnowledgeDepth)} disabled={!selectedSpecialist} aria-label="Answer depth">
                      {DEPTHS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </label>
                  <label className="cd-field cd-field--compact">
                    <span className="cd-field__label">Compare with</span>
                    <select value={chatTarget} onChange={(e) => setChatTarget(e.target.value)} disabled={!selectedSpecialist} aria-label="Compare with specialist">
                      <option value="">No comparison</option>
                      {specialists.filter((s) => s.specialistKey !== selectedSpecialist).map((sp) => <option key={sp.id} value={sp.specialistKey}>{sp.name}</option>)}
                    </select>
                  </label>
                </div>

                <div className="cd-transcript" ref={chatLogRef} role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation history">
                  {messages.length === 0 ? (
                    <EmptyNote title="No conversation yet." detail="Ask about the timeline, the evidence, or what doesn't add up." />
                  ) : messages.map((m, idx) => {
                    const isPlayer = m.role === 'player';
                    const speaker = isPlayer ? 'You' : (m.responderLabel || m.specialistName || 'Investigation team');
                    return (
                      <div key={idx} className={`cd-msg ${isPlayer ? 'cd-msg--player' : ''}`}>
                        <div className="cd-msg__head">
                          <span className="cd-msg__speaker">{speaker}</span>
                          {m.specialistKey ? <span className="cd-msg__meta">{humanize(m.specialistKey)}</span> : null}
                          {m.intent ? <span className="cd-msg__meta">{labelFor(INTENTS, m.intent)}</span> : null}
                          {m.depth ? <span className="cd-msg__meta">{labelFor(DEPTHS, m.depth)}</span> : null}
                          {m.timestamp ? <time className="cd-msg__time" dateTime={m.timestamp}>{fmtDate(m.timestamp)}</time> : null}
                        </div>
                        <p className="cd-msg__body">{m.content}</p>
                      </div>
                    );
                  })}
                </div>

                <form className="cd-compose" onSubmit={handleSendChat}>
                  <label className="cd-field">
                    <span className="cd-field__label">Message</span>
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={selectedSpecialist ? `Ask ${specialists.find((s) => s.specialistKey === selectedSpecialist)?.name ?? 'the specialist'} a question…` : 'Ask about evidence, motives, timelines, or contradictions…'}
                      rows={3}
                      disabled={isCompleted}
                      aria-label="Message"
                    />
                  </label>
                  <button type="submit" disabled={busy === 'chat' || !chatInput.trim() || isCompleted}>
                    {busy === 'chat' ? 'Sending…' : 'Send'}
                  </button>
                </form>
                {isCompleted ? <p className="cd-note">The case is closed. This transcript is read-only.</p> : null}
              </div>
            </div>

            <aside className="cd-workspace__aside" aria-label="Reference material">
              <div className="cd-section">
                <SectionHead
                  title="Specialists"
                  description="Domain experts available for this case."
                  count={specialists.length}
                />
                {specialists.length === 0 ? (
                  <EmptyNote title="No specialists configured." detail="This case does not have specialist profiles." />
                ) : (
                  <div className="cd-folds">
                    {specialists.map((sp) => (
                      <details className="cd-fold" key={sp.id}>
                        <summary>
                          <span className="cd-fold__heading">
                            <span className="cd-fold__title">{sp.name}</span>
                            <span className="cd-fold__meta"><span>{sp.title}</span><span>{humanize(sp.discipline)}</span></span>
                          </span>
                          <span className="cd-fold__marker" aria-hidden="true" />
                        </summary>
                        <div className="cd-fold__body">
                          <p>{sp.expertiseSummary}</p>
                          <dl className="cd-kv">
                            <dt>Specialization</dt><dd>{sp.specialization}</dd>
                            <dt>Reasoning</dt><dd>{sp.reasoningApproach}</dd>
                            <dt>Communication</dt><dd>{sp.communicationStyle}</dd>
                            <dt>Case relevance</dt><dd>{sp.caseRelevance}</dd>
                          </dl>
                          {sp.limitations?.length ? (
                            <div className="cd-subsection">
                              <h4>Limits of this view</h4>
                              <ul className="cd-list cd-list--bulleted">{sp.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
                            </div>
                          ) : null}
                          <button type="button" className="cd-inline-action" onClick={() => { setSelectedSpecialist(sp.specialistKey); setTab('chat'); }}>
                            Consult {sp.name}
                          </button>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </div>

              {disagreements.length > 0 ? (
                <div className="cd-section">
                  <SectionHead title="Specialist disagreements" description="Where the expert views diverge." />
                  <div className="cd-stack">
                    {disagreements.map((d) => (
                      <div key={d.id} className="cd-callout cd-callout--warn">
                        <p className="cd-callout__title">{d.topic}</p>
                        <p><strong>{d.specialistAName}:</strong> {d.positionA}</p>
                        <p><strong>{d.specialistBName}:</strong> {d.positionB}</p>
                        {d.uncertaintyNote ? <p className="cd-muted">{d.uncertaintyNote}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {artifacts.length > 0 ? (
                <div className="cd-section">
                  <SectionHead title="Knowledge artifacts" description="Reference material attached to this case." count={artifacts.length} />
                  <div className="cd-stack">
                    {artifacts.slice(0, 8).map((a) => (
                      <article key={a.id} className="cd-entry">
                        <div className="cd-entry__body">
                          <h4 className="cd-entry__title">{a.title}</h4>
                          <p className="cd-entry__meta"><span>{humanize(a.artifactType)}</span><span>Reliability: {humanize(a.reliability)}</span></p>
                          {a.sourceVerified ? <StatusMark tone="good">Source verified</StatusMark> : null}
                          <p className="cd-entry__text cd-muted">{a.description}</p>
                        </div>
                      </article>
                    ))}
                    {artifacts.length > 8 ? <p className="cd-note">{artifacts.length - 8} more artifacts are available in the case knowledge base.</p> : null}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        )}

        {activeTab === 'journal' && (
          <div className="cd-workspace">
            <div className="cd-workspace__main">
              <div className="cd-section">
                <SectionHead
                  title="Investigation journal"
                  description="A running record of what you noticed and what needs checking."
                  count={`${journal.length} entries`}
                />
                <form className="cd-form" onSubmit={handleAddJournal}>
                  <label className="cd-field">
                    <span className="cd-field__label">Entry type</span>
                    <select value={journalType} onChange={(e) => setJournalType(e.target.value)}>
                      {JOURNAL_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                    </select>
                  </label>
                  <label className="cd-field">
                    <span className="cd-field__label">Notes</span>
                    <textarea value={journalContent} onChange={(e) => setJournalContent(e.target.value)} placeholder="What did you notice? What needs checking?" disabled={isCompleted} aria-label="Journal notes" />
                  </label>
                  <label className="cd-field">
                    <span className="cd-field__label">Related evidence</span>
                    <select
                      multiple
                      value={journalEvidenceIds}
                      onChange={(e) => setJournalEvidenceIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                      size={Math.min(6, Math.max(3, discoveredEvidence.length || 3))}
                      aria-label="Related evidence"
                      disabled={isCompleted}
                    >
                      {discoveredEvidence.length === 0 ? <option value="" disabled>No filed evidence yet</option> : discoveredEvidence.map((ev) => <option key={ev.id} value={ev.id}>{ev.source} — {humanize(ev.category)}</option>)}
                    </select>
                    <span className="cd-field__hint">Hold Ctrl or Cmd to select more than one.</span>
                  </label>
                  <div className="cd-form__actions">
                    <button type="submit" disabled={busy === 'journal' || !journalContent.trim() || isCompleted}>
                      {busy === 'journal' ? 'Saving…' : 'Add entry'}
                    </button>
                  </div>
                </form>

                <div className="cd-subsection">
                  <h4>Recent entries</h4>
                  {journal.length === 0 ? (
                    <EmptyNote title="No entries yet." detail="Write down what you know, what you suspect, and what needs checking." />
                  ) : (
                    <ol className="cd-entries">
                      {journal.map((j) => (
                        <li className="cd-entry" key={j.id}>
                          <div className="cd-entry__body">
                            <h4 className="cd-entry__title">{humanize(j.entryType)}</h4>
                            <p className="cd-entry__meta"><time dateTime={j.creationTimestamp}>{fmtDate(j.creationTimestamp)}</time></p>
                            <p className="cd-entry__text">{j.content}</p>
                            {j.relatedEvidenceIds?.length ? <p className="cd-entry__note">{j.relatedEvidenceIds.length} linked item{j.relatedEvidenceIds.length === 1 ? '' : 's'}</p> : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </div>

            <aside className="cd-workspace__aside" aria-label="Knowledge notebook">
              <div className="cd-section">
                <SectionHead
                  title="Knowledge notebook"
                  description="Concepts and sources worth keeping for later."
                  count={notebookEntries.length}
                  actions={
                    <div className="cd-actions">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => void handleExportNotebook('json')} disabled={!!busy?.startsWith('nb-export') || notebookEntries.length === 0}>JSON</button>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => void handleExportNotebook('markdown')} disabled={!!busy?.startsWith('nb-export') || notebookEntries.length === 0}>Markdown</button>
                    </div>
                  }
                />
                <form className="cd-form cd-form--inset" onSubmit={handleCreateNotebook}>
                  <label className="cd-field">
                    <span className="cd-field__label">Type</span>
                    <select value={notebookType} onChange={(e) => setNotebookType(e.target.value as NotebookEntryType)} disabled={isCompleted}>
                      {NOTEBOOK_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                    </select>
                  </label>
                  <label className="cd-field">
                    <span className="cd-field__label">Title</span>
                    <input value={notebookTitle} onChange={(e) => setNotebookTitle(e.target.value)} placeholder="Short title" disabled={isCompleted} aria-label="Notebook title" />
                  </label>
                  <label className="cd-field">
                    <span className="cd-field__label">Concept</span>
                    <input value={notebookConcept} onChange={(e) => setNotebookConcept(e.target.value)} placeholder="Concept or topic" disabled={isCompleted} aria-label="Notebook concept" />
                  </label>
                  <label className="cd-field">
                    <span className="cd-field__label">Content</span>
                    <textarea value={notebookContent} onChange={(e) => setNotebookContent(e.target.value)} placeholder="What do you want to remember?" disabled={isCompleted} aria-label="Notebook content" />
                  </label>
                  <div className="cd-form__actions">
                    <button type="submit" disabled={busy === 'notebook' || isCompleted}>{busy === 'notebook' ? 'Saving…' : 'Add to notebook'}</button>
                  </div>
                </form>

                <div className="cd-subsection">
                  <h4>Saved entries</h4>
                  {notebookEntries.length === 0 ? (
                    <EmptyNote title="No notebook entries." detail="Save concepts, sources, or reasoning you want to revisit." />
                  ) : (
                    <ol className="cd-entries">
                      {notebookEntries.map((n) => (
                        <li className="cd-entry" key={n.id}>
                          <div className="cd-entry__body">
                            <h4 className="cd-entry__title">{n.title || n.concept || humanize(n.entryType)}</h4>
                            <p className="cd-entry__meta"><span>{humanize(n.entryType)}</span>{n.concept ? <span>{n.concept}</span> : null}</p>
                            {n.content ? <p className="cd-entry__text">{n.content}</p> : null}
                            {n.sourceSnapshot?.bibliographyRef ? <p className="cd-entry__note">Source: {n.sourceSnapshot.bibliographyRef}</p> : null}
                          </div>
                          <button type="button" className="cd-inline-action cd-inline-action--danger" onClick={() => void handleDeleteNotebook(n.id)} disabled={busy === `nb-del:${n.id}`} aria-label={`Delete notebook entry ${n.title || n.concept || humanize(n.entryType)}`}>
                            Delete
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'reality' && (
          <div className="cd-workspace">
            <div className="cd-workspace__main">
              <div className="cd-section">
                <SectionHead
                  title="Claims"
                  description="Make observations explicit, and mark how much confidence you have in each."
                  count={realityMap?.claims.length ?? 0}
                />
                <form className="cd-form cd-form--inset" onSubmit={handleCreateClaim}>
                  <label className="cd-field">
                    <span className="cd-field__label">Claim</span>
                    <input value={claimTitle} onChange={(e) => setClaimTitle(e.target.value)} placeholder="What are you claiming?" required disabled={isCompleted} aria-label="Claim title" />
                  </label>
                  <label className="cd-field">
                    <span className="cd-field__label">Basis</span>
                    <textarea value={claimDesc} onChange={(e) => setClaimDesc(e.target.value)} placeholder="What supports or explains this claim?" disabled={isCompleted} aria-label="Claim basis" />
                  </label>
                  <div className="cd-toolbar">
                    <label className="cd-field cd-field--compact">
                      <span className="cd-field__label">Category</span>
                      <select value={claimCategory} onChange={(e) => setClaimCategory(e.target.value as RealityClaim['claimCategory'])} disabled={isCompleted} aria-label="Claim category">
                        {CLAIM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </label>
                    <label className="cd-field cd-field--compact">
                      <span className="cd-field__label">Confidence</span>
                      <select value={claimConfidence} onChange={(e) => setClaimConfidence(e.target.value as RealityConfidence)} disabled={isCompleted} aria-label="Claim confidence">
                        {CONFIDENCE_LEVELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="cd-form__actions">
                    <button type="submit" disabled={busy === 'create-claim' || !claimTitle.trim() || isCompleted}>{busy === 'create-claim' ? 'Adding…' : 'Add claim'}</button>
                  </div>
                </form>

                <div className="cd-subsection">
                  <h4>Current claims</h4>
                  {(realityMap?.claims ?? []).length === 0 ? (
                    <EmptyNote title="No claims yet." detail="Turn an observation into a claim before you test it against the file." />
                  ) : (
                    <ol className="cd-entries">
                      {realityMap!.claims.map((c) => (
                        <li className="cd-entry" key={c.id}>
                          <div className="cd-entry__body">
                            <h4 className="cd-entry__title">{c.title}</h4>
                            <p className="cd-entry__meta"><span>{labelFor(CLAIM_CATEGORIES, c.claimCategory)}</span><span>{labelFor(CONFIDENCE_LEVELS, c.confidence)}</span></p>
                            {c.description ? <p className="cd-entry__text">{c.description}</p> : null}
                            {c.notes ? <p className="cd-entry__note">Note: {c.notes}</p> : null}
                          </div>
                          <button type="button" className="cd-inline-action cd-inline-action--danger" onClick={() => void handleDeleteClaim(c.id)} disabled={busy === `del-claim:${c.id}`} aria-label={`Delete claim ${c.title}`}>Delete</button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </div>

            <aside className="cd-workspace__aside" aria-label="Hypotheses and tensions">
              <div className="cd-section">
                <SectionHead
                  title="Hypotheses"
                  description="Competing explanations, revised as the file grows."
                  count={realityMap?.hypotheses.length ?? 0}
                />
                <form className="cd-form cd-form--inset" onSubmit={handleCreateHypothesis}>
                  <label className="cd-field">
                    <span className="cd-field__label">Name</span>
                    <input value={hypName} onChange={(e) => setHypName(e.target.value)} placeholder="Name this explanation" required disabled={isCompleted} aria-label="Hypothesis name" />
                  </label>
                  <label className="cd-field">
                    <span className="cd-field__label">Explanation</span>
                    <textarea value={hypExplanation} onChange={(e) => setHypExplanation(e.target.value)} placeholder="How would this explain the case?" disabled={isCompleted} aria-label="Hypothesis explanation" />
                  </label>
                  <div className="cd-form__actions">
                    <button type="submit" disabled={busy === 'create-hyp' || !hypName.trim() || isCompleted}>{busy === 'create-hyp' ? 'Adding…' : 'Add hypothesis'}</button>
                  </div>
                </form>

                <div className="cd-subsection">
                  <h4>Current hypotheses</h4>
                  {(realityMap?.hypotheses ?? []).length === 0 ? (
                    <EmptyNote title="No hypotheses yet." detail="Set out competing explanations and update them as you learn more." />
                  ) : (
                    <ol className="cd-entries">
                      {realityMap!.hypotheses.map((h) => (
                        <li className="cd-entry" key={h.id}>
                          <div className="cd-entry__body">
                            <h4 className="cd-entry__title">{h.name}</h4>
                            <p className="cd-entry__meta"><span>{labelFor(HYPOTHESIS_STATUSES, h.status)}</span><span>{labelFor(CONFIDENCE_LEVELS, h.confidence)}</span></p>
                            {h.explanation ? <p className="cd-entry__text">{h.explanation}</p> : null}
                            <div className="cd-actions cd-actions--wrap" role="group" aria-label={`Set status for hypothesis ${h.name}`}>
                              {HYPOTHESIS_STATUSES.map((s) => (
                                <button
                                  key={s.value}
                                  type="button"
                                  className={h.status === s.value ? 'btn-secondary btn-sm' : 'btn-ghost btn-sm'}
                                  onClick={() => void handleHypStatus(h, s.value)}
                                  disabled={busy === `hyp-status:${h.id}` || isCompleted}
                                  aria-pressed={h.status === s.value}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <button type="button" className="cd-inline-action cd-inline-action--danger" onClick={() => void handleDeleteHypothesis(h.id)} disabled={busy === `del-hyp:${h.id}`} aria-label={`Delete hypothesis ${h.name}`}>Delete</button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>

              {realityMap?.tensions?.length ? (
                <div className="cd-section">
                  <SectionHead title="Tensions" description="Points that do not sit comfortably together." />
                  <div className="cd-stack">
                    {realityMap.tensions.map((t) => (
                      <div key={t.id} className="cd-callout cd-callout--warn">
                        <p className="cd-callout__title">{t.label}</p>
                        <p className="cd-muted">{t.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        )}

        {activeTab === 'perspectives' && (
          <div className="cd-workspace">
            <div className="cd-workspace__main">
              <div className="cd-section">
                <SectionHead
                  title="Perspective suggestions"
                  description="Advisory ways of thinking. They do not add evidence or change the verdict."
                  count={humanize(perspectiveEngagement)}
                />
                {perspectiveSuggestions.length === 0 ? (
                  <EmptyNote title="Nothing suggested right now." detail="Keep investigating, or browse the perspective library for a useful framework." />
                ) : (
                  <ol className="cd-entries">
                    {perspectiveSuggestions.map((s) => (
                      <li className="cd-entry" key={s.experienceKey}>
                        <div className="cd-entry__body">
                          <h4 className="cd-entry__title">{s.title}</h4>
                          <p className="cd-entry__meta"><span>{humanize(s.frameworkKey)}</span><span>Advisory only</span></p>
                          <p className="cd-entry__text">{s.reasonText}</p>
                        </div>
                        <button type="button" className="cd-inline-action" onClick={() => void openPerspective(s.experienceKey)} disabled={busy === `perspective:${s.experienceKey}`}>
                          {busy === `perspective:${s.experienceKey}` ? 'Opening…' : 'Open'}
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="cd-subsection">
                  <Link className="cd-textlink" to="/perspectives">Browse the perspective library</Link>
                </div>
              </div>
            </div>

            <aside className="cd-workspace__aside" aria-label="Perspective detail">
              <div className="cd-section">
                <SectionHead
                  title="Perspective detail"
                  description="The framework, its limits, and questions worth asking."
                  count={activePerspectiveKey ? humanize(activePerspectiveKey) : undefined}
                />
                {!activePerspectiveDetail ? (
                  <EmptyNote title="No perspective selected." detail="Open a suggestion to read its question, explanation, and limits." />
                ) : (
                  <div className="cd-stack">
                    <div className="cd-callout">
                      <p className="cd-callout__title">Advisory</p>
                      <p className="cd-muted">{activePerspectiveDetail.disclaimer}</p>
                    </div>
                    <div>
                      <h4 className="cd-entry__title">{activePerspectiveDetail.title}</h4>
                      <p className="cd-entry__meta"><span>{activePerspectiveDetail.primaryQuestion}</span></p>
                    </div>
                    <p>{activePerspectiveDetail.introduction}</p>
                    <p>{activePerspectiveDetail.mainIdea}</p>
                    {activePerspectiveDetail.detailedExplanation ? <p>{activePerspectiveDetail.detailedExplanation}</p> : null}
                    {activePerspectiveDetail.reflectionQuestions?.length ? (
                      <div className="cd-subsection">
                        <h4>Questions to ask</h4>
                        <ul className="cd-list cd-list--bulleted">{activePerspectiveDetail.reflectionQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                      </div>
                    ) : null}
                    {activePerspectiveDetail.limitations?.length ? (
                      <div className="cd-subsection">
                        <h4>Limits</h4>
                        <ul className="cd-list cd-list--bulleted">{activePerspectiveDetail.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
                      </div>
                    ) : null}
                    {activePerspectiveConnections?.relatedExperiences?.length ? (
                      <div className="cd-subsection">
                        <h4>Related perspectives</h4>
                        <ul className="cd-list">
                          {activePerspectiveConnections.relatedExperiences.map((r) => (
                            <li key={r.experienceKey}>
                              <button type="button" className="cd-inline-action" onClick={() => void openPerspective(r.experienceKey)}>{r.title}</button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'discoveries' && (
          <div className="cd-workspace">
            <div className="cd-workspace__main">
              <div className="cd-section">
                <SectionHead
                  title="Field research"
                  description="External leads, and what you find when you follow them."
                  count={discoverySnapshot?.clues.length ?? 0}
                />
                {!discoverySnapshot?.available ? (
                  <EmptyNote title="No field research configured." detail="This case does not currently have a discovery package." />
                ) : (
                  <div className="cd-stack">
                    <div className="cd-callout"><p className="cd-muted">{discoverySnapshot.disclaimer}</p></div>
                    <ol className="cd-entries">
                      {discoverySnapshot.clues.map((clue) => (
                        <li className="cd-entry" key={clue.key}>
                          <div className="cd-entry__body">
                            <h4 className="cd-entry__title">{clue.title}</h4>
                            <p className="cd-entry__meta"><span>{clue.subjectLabel}</span><span>{humanize(clue.difficulty)}</span></p>
                            <p className="cd-entry__text">{clue.prompt}</p>
                            <div className="cd-entry__statuses">
                              {clue.accepted ? <StatusMark tone="good">Accepted</StatusMark> : <StatusMark>Open</StatusMark>}
                              {discoverySnapshot.newClueKeys.includes(clue.key) ? <StatusMark tone="info">New</StatusMark> : null}
                            </div>
                          </div>
                          <button type="button" className="cd-inline-action" onClick={() => void openClue(clue.key)} disabled={busy === `clue:${clue.key}`}>
                            {busy === `clue:${clue.key}` ? 'Opening…' : 'Open'}
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>

            <aside className="cd-workspace__aside" aria-label="Clue detail">
              <div className="cd-section">
                <SectionHead
                  title="Clue detail"
                  description="Context, citations, previous submissions, and unlocks."
                  count={selectedClueKey ? humanize(selectedClueKey) : undefined}
                />
                {!clueDetail ? (
                  <EmptyNote title="No clue selected." detail="Open a clue to see its context and submit what you find." />
                ) : (
                  <div className="cd-stack">
                    <div>
                      <h4 className="cd-entry__title">{clueDetail.clue.title}</h4>
                      <p className="cd-entry__meta"><span>{clueDetail.clue.subjectLabel}</span><span>{humanize(clueDetail.clue.difficulty)}</span></p>
                    </div>
                    <p>{clueDetail.clue.context}</p>
                    <div className="cd-callout"><p className="cd-muted">{clueDetail.disclaimer}</p></div>
                    <div className="cd-subsection">
                      <h4>Research prompt</h4>
                      <p>{clueDetail.clue.prompt}</p>
                    </div>
                    {clueDetail.clue.citations?.length ? (
                      <div className="cd-subsection">
                        <h4>Citations</h4>
                        <ul className="cd-list">
                          {clueDetail.clue.citations.map((c, i) => <li key={i}>{c.label} <span className="cd-muted">{humanize(c.verificationStatus)}</span></li>)}
                        </ul>
                      </div>
                    ) : null}
                    {clueDetail.submissions?.length ? (
                      <div className="cd-subsection">
                        <h4>Previous submissions</h4>
                        <ul className="cd-list">
                          {clueDetail.submissions.map((s) => (
                            <li key={s.id}>
                              <p className="cd-entry__meta">
                                <StatusMark tone={s.evaluation.accepted ? 'good' : 'warn'}>{humanize(s.evaluation.classification)}</StatusMark>
                                <time dateTime={s.createdAt ?? undefined}>{fmtDate(s.createdAt)}</time>
                              </p>
                              <p>{s.explanation}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {clueDetail.unlocks?.length ? (
                      <div className="cd-subsection">
                        <h4>Unlocks</h4>
                        <ol className="cd-entries">
                          {clueDetail.unlocks.map((u) => (
                            <li className="cd-entry" key={u.id}>
                              <div className="cd-entry__body">
                                <h4 className="cd-entry__title">{u.label}</h4>
                                <p className="cd-entry__text cd-muted">{u.detail}</p>
                              </div>
                              <button type="button" className="cd-inline-action" onClick={() => void applyUnlock(u.clueKey, u.unlockKey)} disabled={u.applied || busy === `unlock:${u.unlockKey}`}>
                                {u.applied ? 'Applied' : busy === `unlock:${u.unlockKey}` ? 'Applying…' : 'Apply'}
                              </button>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    {!clueDetail.clue.accepted ? (
                      <div className="cd-subsection">
                        <h4>Submit research</h4>
                        <DiscoverySubmitForm
                          disabled={busy === `submit-discovery:${clueDetail.clue.key}` || isCompleted}
                          onSubmit={async (payload) => { await submitDiscovery(clueDetail.clue.key, payload); }}
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="cd-workspace">
            <div className="cd-workspace__main">
              <div className="cd-section">
                <SectionHead
                  title="Case activity"
                  description="What changed while you were away, and what needs a response."
                  actions={
                    <div className="cd-actions">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => void refreshActivity()} disabled={busy === 'activity-refresh'}>
                        {busy === 'activity-refresh' ? 'Refreshing…' : 'Refresh'}
                      </button>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => void markActivitySeen()} disabled={busy === 'activity-seen'}>Mark seen</button>
                    </div>
                  }
                />
                {!activity ? (
                  <EmptyNote title="No activity data available." detail="Activity appears here as the case develops." />
                ) : (
                  <div className="cd-stack">
                    <div className="cd-callout">
                      <p className="cd-callout__title">Since your last visit</p>
                      <p className="cd-muted">{activity.sinceLastVisit.summary}</p>
                    </div>
                    {activity.groups.length === 0 ? (
                      <EmptyNote title="Nothing new to review." detail="New developments and changes will be listed here." />
                    ) : activity.groups.map((g) => (
                      <section key={g.groupKey} className="cd-subsection" aria-label={g.title}>
                        <h4>{g.title} <span className="cd-count">{g.items.length}</span></h4>
                        <ol className="cd-entries">
                          {g.items.map((item) => (
                            <li className="cd-entry" key={item.id}>
                              <div className="cd-entry__body">
                                <h4 className="cd-entry__title">{item.title}</h4>
                                <p className="cd-entry__meta"><span>{humanize(item.category)}</span><span>{humanize(item.significance)}</span>{item.occurredAt ? <time dateTime={item.occurredAt}>{fmtDate(item.occurredAt)}</time> : null}</p>
                                <p className="cd-entry__text">{item.summary}</p>
                                {item.detail ? <p className="cd-entry__text cd-muted">{item.detail}</p> : null}
                                {item.whyItMatters ? <p className="cd-entry__note"><strong>Why it matters:</strong> {item.whyItMatters}</p> : null}
                              </div>
                              {item.requiresResponse ? <StatusMark tone="warn">Needs response</StatusMark> : null}
                            </li>
                          ))}
                        </ol>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside className="cd-workspace__aside" aria-label="Notifications and developments">
              <div className="cd-section">
                <SectionHead title="Notifications" count={notifications.length} />
                {notifications.length === 0 ? (
                  <EmptyNote title="You're up to date." detail="New case notifications will appear here." />
                ) : (
                  <ol className="cd-entries">
                    {notifications.map((n) => (
                      <li className="cd-entry" key={n.id}>
                        <div className="cd-entry__body">
                          <h4 className="cd-entry__title">{n.title}</h4>
                          <p className="cd-entry__meta"><span>{humanize(n.category)}</span><time dateTime={n.createdAt ?? undefined}>{fmtDate(n.createdAt)}</time></p>
                          <p className="cd-entry__text">{n.body}</p>
                        </div>
                        {n.status === 'unread' ? <StatusMark tone="info">Unread</StatusMark> : null}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {activity?.outstandingDisagreements?.length ? (
                <div className="cd-section">
                  <SectionHead title="Outstanding disagreements" />
                  <div className="cd-stack">
                    {activity.outstandingDisagreements.map((d) => (
                      <div key={d.eventId} className="cd-callout cd-callout--warn">
                        <p className="cd-callout__title">{d.topic}</p>
                        <p className="cd-muted">{d.positionA}</p>
                        <p className="cd-muted">{d.positionB}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {developments.length > 0 ? (
                <div className="cd-section">
                  <SectionHead title="Recent developments" />
                  <ol className="cd-entries">
                    {developments.slice(0, 8).map((d) => (
                      <li className="cd-entry" key={d.id}>
                        <div className="cd-entry__body">
                          <h4 className="cd-entry__title">{humanize(d.kind)}</h4>
                          <p className="cd-entry__meta"><time dateTime={d.createdAt}>{fmtDate(d.createdAt)}</time></p>
                          <p className="cd-entry__text">{d.message}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {events.length > 0 ? (
                <div className="cd-section">
                  <SectionHead title="Scheduled events" />
                  <ol className="cd-entries">
                    {events.slice(0, 8).map((ev) => (
                      <li className="cd-entry" key={ev.id}>
                        <div className="cd-entry__body">
                          <h4 className="cd-entry__title">{humanize(String(ev.eventType || 'Event'))}</h4>
                          <p className="cd-entry__meta"><span>{humanize(String(ev.releaseStatus || 'scheduled'))}</span>{ev.scheduledTimestamp ? <time dateTime={ev.scheduledTimestamp}>{fmtDate(ev.scheduledTimestamp)}</time> : null}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </aside>
          </div>
        )}

        {activeTab === 'accusation' && (
          <div className="cd-workspace">
            <div className="cd-workspace__main">
              <div className="cd-section">
                <SectionHead
                  title="Your conclusion"
                  description="State who you believe is responsible, why, and how. The file is evaluated when you submit."
                  count={isCompleted ? 'Case closed' : 'Final decision'}
                />
                {!isCompleted ? (
                  <div className="cd-callout cd-callout--warn">
                    <p className="cd-callout__title">Before you submit</p>
                    <p>Make sure the culprit, motive, and method are supported by what you have filed. You can cite specific evidence below.</p>
                  </div>
                ) : null}

                <form className="cd-form cd-form--statement" onSubmit={handleSubmitAccusation}>
                  <label className="cd-field">
                    <span className="cd-field__label">Who is responsible?</span>
                    <input value={accuseCulprit} onChange={(e) => setAccuseCulprit(e.target.value)} placeholder="Name the culprit" required disabled={isCompleted} aria-label="Culprit" />
                  </label>
                  <label className="cd-field">
                    <span className="cd-field__label">Motive</span>
                    <textarea value={accuseMotive} onChange={(e) => setAccuseMotive(e.target.value)} placeholder="Why did they do it?" required disabled={isCompleted} aria-label="Motive" />
                  </label>
                  <label className="cd-field">
                    <span className="cd-field__label">Method</span>
                    <textarea value={accuseMethod} onChange={(e) => setAccuseMethod(e.target.value)} placeholder="How was it done?" required disabled={isCompleted} aria-label="Method" />
                  </label>
                  <label className="cd-field">
                    <span className="cd-field__label">Supporting evidence</span>
                    <select
                      multiple
                      value={accuseEvidence}
                      onChange={(e) => setAccuseEvidence(Array.from(e.target.selectedOptions).map((o) => o.value))}
                      size={Math.min(8, Math.max(4, discoveredEvidence.length || 4))}
                      disabled={isCompleted}
                      aria-label="Supporting evidence"
                    >
                      {discoveredEvidence.length === 0 ? <option value="" disabled>File evidence before submitting</option> : discoveredEvidence.map((ev) => <option key={ev.id} value={ev.id}>{ev.source} — {humanize(ev.category)}</option>)}
                    </select>
                    <span className="cd-field__hint">Hold Ctrl or Cmd to select more than one.</span>
                  </label>
                  <div className="cd-form__actions">
                    <button type="submit" disabled={busy === 'accuse' || isCompleted}>{busy === 'accuse' ? 'Submitting…' : 'Submit accusation'}</button>
                  </div>
                </form>

                {accusation ? (
                  <div className="cd-subsection">
                    <h4>Last submission</h4>
                    <div className="cd-callout">
                      <p><strong>Culprit:</strong> {accusation.submittedCulprit}</p>
                      <p><strong>Result:</strong> {humanize(String(accusation.evaluationResult || 'submitted'))}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="cd-workspace__aside" aria-label="Verdict and solution">
              <div className="cd-section">
                <SectionHead title="Verdict" description="The result of your submission." />
                {verdict ? (
                  <div
                    className={`cd-verdict cd-verdict--${verdict.evaluationResult === 'correct' ? 'good' : verdict.evaluationResult === 'partial' ? 'warn' : 'danger'}`}
                    role="status"
                  >
                    <p className="cd-verdict__title">
                      <StatusMark tone={verdict.evaluationResult === 'correct' ? 'good' : verdict.evaluationResult === 'partial' ? 'warn' : 'danger'}>
                        {humanize(String(verdict.evaluationResult ?? verdict.status ?? 'submitted'))}
                      </StatusMark>
                    </p>
                    {verdict.message ? <p className="cd-verdict__detail">{verdict.message}</p> : null}
                    {typeof verdict.attempts === 'number' ? <p className="cd-entry__note">Attempts: {verdict.attempts}</p> : null}
                    {verdict.retryAfterSeconds ? <p className="cd-entry__note">Try again in {verdict.retryAfterSeconds}s</p> : null}
                  </div>
                ) : (
                  <EmptyNote title="No verdict yet." detail="Submit your conclusion when you are ready." />
                )}
              </div>

              {solutionLoading ? <p className="cd-note" role="status" aria-live="polite">Loading solution…</p> : null}

              {solution ? (
                <div className="cd-section">
                  <SectionHead title="Case solution" description="What actually happened." />
                  <div className="cd-stack">
                    <div className="cd-callout cd-callout--success">
                      <p><strong>Culprit:</strong> {solution.culprit}</p>
                      <p><strong>Motive:</strong> {solution.motive}</p>
                      <p><strong>Method:</strong> {solution.method}</p>
                    </div>
                    <div className="cd-subsection">
                      <h4>Explanation</h4>
                      <p className="cd-prose">{solution.solutionExplanation}</p>
                    </div>
                    {solution.actualTimeline?.length ? (
                      <div className="cd-subsection">
                        <h4>Actual timeline</h4>
                        <ul className="cd-list">
                          {solution.actualTimeline.map((t, i) => <li key={i}><strong>{t.time || `Step ${t.seq ?? i + 1}`}</strong> <span className="cd-muted">{t.event}</span></li>)}
                        </ul>
                      </div>
                    ) : null}
                    {solution.redHerrings?.length ? (
                      <div className="cd-subsection">
                        <h4>Red herrings</h4>
                        <ul className="cd-list cd-list--bulleted">
                          {solution.redHerrings.map((r, i) => <li key={i}><strong>{r.label}</strong>{r.actualExplanation ? ` — ${r.actualExplanation}` : ''}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    {solution.alternativeTheories?.length ? (
                      <div className="cd-subsection">
                        <h4>Alternative theories</h4>
                        <ul className="cd-list">
                          {solution.alternativeTheories.map((t, i) => <li key={i}><strong>{t.title}</strong>: {t.summary}{t.resolution ? ` (${t.resolution})` : ''}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    {solution.clueResolutions?.length ? (
                      <div className="cd-subsection">
                        <h4>Clue resolutions</h4>
                        <ul className="cd-list">
                          {solution.clueResolutions.map((c, i) => <li key={i}><strong>{c.clue}:</strong> {c.resolution}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        )}
      </section>
    </div>
  );
};
