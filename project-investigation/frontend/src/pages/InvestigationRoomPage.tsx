/**
 * Investigation Room Page
 *
 * Primary gameplay screen. Contains:
 * - Case overview + active-case conflict handling (one active case at a time)
 * - Group chat (AI investigator)
 * - Evidence room (player-visible evidence only) with discovery actions
 * - Timeline (evidence references + scheduled events)
 * - Detective's journal (list + add note)
 * - Final accusation form, deterministic verdict, and resolution state
 *
 * The client never receives canonical truth; every verdict comes from the
 * server's evaluate-accusation endpoint.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ApiError,
  api,
  errorMessage,
} from '../api';
import type {
  Accusation,
  Achievement,
  ActivitySnapshot,
  Case,
  ChatMessage,
  CheckpointState,
  Development,
  Evidence,
  Investigation,
  InvestigationStats,
  JournalEntry,
  KnowledgeDepth,
  KnowledgeIntent,
  LivingWorldResult,
  DiscoverySnapshotDTO,
  KnowledgeRecallResultDTO,
  NotificationSettings,
  NotificationsResponse,
  PerspectiveConnections,
  PerspectiveExperienceDetail,
  PerspectiveReflection,
  PerspectiveReflectionKind,
  PerspectiveSuggestion,
  PublicArtifactDetail,
  PublicArtifactSummary,
  PublicCaseKnowledgePack,
  PublicDisagreement,
  PublicNotebookEntry,
  PublicSpecialist,
  SafeActivityEvent,
  ScheduledEvent,
  Solution,
  Suspect,
  VerdictOutcome,
  VerdictResult,
} from '../api';
import { SolutionPanel } from '../components/SolutionPanel';
import { AchievementsPanel } from '../components/AchievementsPanel';
import { ExpertsPanel } from '../components/ExpertsPanel';
import { KnowledgeArtifactCard } from '../components/KnowledgeArtifactCard';
import { KnowledgeArtifactDrawer } from '../components/KnowledgeArtifactDrawer';
import { KnowledgeNotebook } from '../components/KnowledgeNotebook';
import { RealityMapPanel } from '../components/realitymap/RealityMapPanel';
import type { RealityMapPrefill } from '../components/realitymap/RealityMapPanel';
import { ActivityPanel, NotificationInbox } from '../components/activity/ActivityPanel';
import { DiscoveryPanel } from '../components/discovery/DiscoveryPanel';
import { InvestigationHQ } from '../components/InvestigationHQ';
import { TabIntroTip } from '../components/TabIntroTip';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import { useOnboarding } from '../hooks/useOnboarding';

type Tab =
  | 'chat'
  | 'activity'
  | 'discoveries'
  | 'evidence'
  | 'suspects'
  | 'reality'
  | 'perspectives'
  | 'experts'
  | 'timeline'
  | 'journal'
  | 'notebook'
  | 'deductions'
  | 'accuse'
  | 'achievements';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'chat', label: 'Group Chat' },
  { id: 'activity', label: 'Activity' },
  { id: 'discoveries', label: 'Field Research' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'suspects', label: 'Suspect Board' },
  { id: 'reality', label: 'Reality Map' },
  { id: 'perspectives', label: 'Perspectives' },
  { id: 'experts', label: 'Experts' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'journal', label: 'Journal' },
  { id: 'notebook', label: 'Notebook' },
  { id: 'deductions', label: 'Deductions' },
  { id: 'accuse', label: 'Accusation' },
  { id: 'achievements', label: 'Achievements' },
];

function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

// PROD-014: the responder voice is shown in the role column, so drop the
// matching prefix from the message body to avoid "Lead investigator: Lead
// investigator: ...". Older stored replies without metadata render unchanged.
function displayChatContent(message: ChatMessage): string {
  const label = message.responderLabel;
  if (label && message.content.startsWith(`${label}:`)) {
    return message.content.slice(label.length + 1).trimStart();
  }
  return message.content;
}

function verdictFromAccusation(accusation: Accusation): VerdictResult | null {
  const result = accusation.evaluationResult;
  if (result !== 'correct' && result !== 'incorrect' && result !== 'partial') return null;
  return {
    valid: true,
    evaluationResult: result,
    message:
      result === 'correct'
        ? 'Correct verdict. The investigation is complete.'
        : 'Your previous accusation was not correct. Review the evidence and try again.',
  };
}

// GAP-14 (P2): "seen" state for development notifications is deliberately
// client-side (localStorage), keyed per investigation. Development entries are
// player-safe server-authored messages; only their opaque ids are stored here,
// never canonical/hidden content. Storage failures degrade to an in-memory
// empty set so private browsing or a full quota can never break the room.
const SEEN_DEVELOPMENTS_KEY = 'investigation:seen-developments';

function seenDevelopmentsKey(investigationId: string): string {
  return `${SEEN_DEVELOPMENTS_KEY}:${investigationId}`;
}

function loadSeenDevelopmentIds(investigationId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(seenDevelopmentsKey(investigationId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? new Set(parsed.filter((id): id is string => typeof id === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenDevelopmentIds(investigationId: string, ids: Set<string>): void {
  try {
    window.localStorage.setItem(seenDevelopmentsKey(investigationId), JSON.stringify([...ids]));
  } catch {
    // Best-effort only: the UI still marks them seen for this session.
  }
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
  const [discoveredIds, setDiscoveredIds] = useState<Set<string>>(new Set());
  const [verdict, setVerdict] = useState<VerdictResult | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [solutionLoading, setSolutionLoading] = useState(false);
  const [solutionError, setSolutionError] = useState<string | null>(null);
  // GAP-13: server-awarded achievements for this investigation (read-only).
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  // P2-POLISH: compact, owner-scoped stats summary. Cosmetic - failures never
  // break the room (the panel is simply omitted until data is available).
  const [stats, setStats] = useState<InvestigationStats | null>(null);

  // M2 knowledge system (case-scoped experts/artifacts/disagreements + notebook).
  // All data is player-safe; canonical truth is never returned by these endpoints.
  const [specialists, setSpecialists] = useState<PublicSpecialist[]>([]);
  const [artifacts, setArtifacts] = useState<PublicArtifactSummary[]>([]);
  const [disagreements, setDisagreements] = useState<PublicDisagreement[]>([]);
  // M3: per-case knowledge-pack metadata (null when the case has no pack).
  const [knowledgePack, setKnowledgePack] = useState<PublicCaseKnowledgePack | null>(null);
  const [notebookEntries, setNotebookEntries] = useState<PublicNotebookEntry[]>([]);
  const [selectedSpecialistKey, setSelectedSpecialistKey] = useState<string | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<KnowledgeIntent>('explain');
  const [selectedDepth, setSelectedDepth] = useState<KnowledgeDepth>('working');
  const [targetSpecialistKey, setTargetSpecialistKey] = useState<string | null>(null);
  const [artifactDrawer, setArtifactDrawer] = useState<PublicArtifactSummary | null>(null);
  const [notebookBusy, setNotebookBusy] = useState(false);
  const [notebookError, setNotebookError] = useState<string | null>(null);
  const [realityPrefill, setRealityPrefill] = useState<RealityMapPrefill | null>(null);

  // M5 Perspective Engine (advisory; never evidence/verdict/canonical truth)
  const [perspectiveSuggestions, setPerspectiveSuggestions] = useState<PerspectiveSuggestion[]>([]);
  const [perspectiveEngagement, setPerspectiveEngagement] = useState<'none' | 'active'>('none');
  const [perspectiveSuggestionsLoading, setPerspectiveSuggestionsLoading] = useState(false);
  const [perspectiveSuggestionsError, setPerspectiveSuggestionsError] = useState<string | null>(null);
  const [perspectiveSuggestionNotice, setPerspectiveSuggestionNotice] = useState<string | null>(null);
  const [activePerspectiveKey, setActivePerspectiveKey] = useState<string | null>(null);
  const [activePerspectiveDetail, setActivePerspectiveDetail] = useState<PerspectiveExperienceDetail | null>(null);
  const [activePerspectiveConnections, setActivePerspectiveConnections] = useState<PerspectiveConnections | null>(null);
  const [perspectiveDetailLoading, setPerspectiveDetailLoading] = useState(false);
  const [perspectiveDetailError, setPerspectiveDetailError] = useState<string | null>(null);
  const [perspectiveReflections, setPerspectiveReflections] = useState<PerspectiveReflection[]>([]);
  const [perspectiveReflectionText, setPerspectiveReflectionText] = useState('');
  const [perspectiveReflectionKind, setPerspectiveReflectionKind] = useState<PerspectiveReflectionKind>('reflection');
  const [perspectiveReflectionPromptIndex, setPerspectiveReflectionPromptIndex] = useState<number | ''>('');
  const [perspectiveReflectionBusy, setPerspectiveReflectionBusy] = useState(false);
  const [perspectiveReflectionError, setPerspectiveReflectionError] = useState<string | null>(null);
  const [chatPerspectiveKey, setChatPerspectiveKey] = useState<string | null>(null);

  // Async progression (PROD-008)
  const [checkpointState, setCheckpointState] = useState<CheckpointState | null>(null);
  const [developments, setDevelopments] = useState<Development[]>([]);
  // GAP-14: notification indicator + preferences (settings come from the
  // server; seen ids are local to this browser and keyed by investigation).
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    developments: true,
  });
  const [seenDevelopmentIds, setSeenDevelopmentIds] = useState<Set<string>>(new Set());
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // M6 Living Investigations: activity feed + notification inbox.
  const [activitySnapshot, setActivitySnapshot] = useState<ActivitySnapshot | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityRefreshing, setActivityRefreshing] = useState(false);
  const [activityRefreshResult, setActivityRefreshResult] = useState<LivingWorldResult | null>(null);
  const [notifications, setNotifications] = useState<NotificationsResponse | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const lastSeenActivityRef = useRef<string | null>(null);

  // M7 Real-World Discovery & Knowledge Retention.
  const [discoverySnapshot, setDiscoverySnapshot] = useState<DiscoverySnapshotDTO | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoveryBusyClueKey, setDiscoveryBusyClueKey] = useState<string | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState('');
  const [selectedTheoryEvidence, setSelectedTheoryEvidence] = useState<string[]>([]);
  const [theoryText, setTheoryText] = useState('');
  const [theoryFeedback, setTheoryFeedback] = useState<string[]>([]);
  const [theoryBusy, setTheoryBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [actionError, setActionError] = useState<string | null>(null);

  // M8 Wave 1: contextual first-time helper text for a few tabs. Dismissals are
  // persisted in the player's onboarding tutorial state (best-effort only).
  const { state: onboarding, loading: onboardingLoading, patch: patchOnboarding } = useOnboarding();
  type TipKey = 'reality' | 'perspectives' | 'fieldResearch' | 'evidenceTip' | 'suspectsTip' | 'chatTip';
  const tipVisible = (key: TipKey): boolean =>
    !onboardingLoading && onboarding?.tutorialState?.[key] !== true;
  const dismissTip = (key: TipKey): void => {
    void patchOnboarding({ tutorialState: { [key]: true } });
  };

  // PROD-012: abandon confirmation flow. The target may be the case shown in
  // this room or the *other* active case that blocked it (conflict panel).
  const [abandonTarget, setAbandonTarget] = useState<Investigation | null>(null);
  const [abandoning, setAbandoning] = useState(false);
  const [abandonError, setAbandonError] = useState<string | null>(null);

  // Chat state
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Journal state
  const [journalType, setJournalType] = useState('observation');
  const [journalContent, setJournalContent] = useState('');
  const [journalConfirmed, setJournalConfirmed] = useState(false);
  const [journalSaving, setJournalSaving] = useState(false);

  // Accusation state
  const [culprit, setCulprit] = useState('');
  const [motive, setMotive] = useState('');
  const [method, setMethod] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [accusing, setAccusing] = useState(false);
  const [accusationError, setAccusationError] = useState<string | null>(null);
  // PROD-010: a ticking clock so the server-enforced accusation cooldown can be
  // shown as a live countdown. The authoritative value is always on the server.
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Tick once per second only while an accusation cooldown is active.
  useEffect(() => {
    const until = investigation?.accusationCooldownUntil;
    if (!until) return;
    const target = new Date(until).getTime();
    if (Number.isNaN(target) || target <= Date.now()) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [investigation?.accusationCooldownUntil]);

  // Fetch the post-resolution solution. The server only returns it for
  // completed, owned investigations; any failure is surfaced as a soft error
  // so the rest of the (already solved) case view stays usable.
  const loadSolution = useCallback(async (investigationId: string) => {
    setSolutionLoading(true);
    setSolutionError(null);
    try {
      setSolution(await api.getSolution(investigationId));
    } catch (err) {
      setSolution(null);
      setSolutionError(errorMessage(err));
    } finally {
      setSolutionLoading(false);
    }
  }, []);

  // GAP-13: achievements are cosmetic. A failed read must never break the
  // investigation room, so it is swallowed and simply shows the empty state.
  const loadAchievements = useCallback(async (investigationId: string) => {
    try {
      const data = await api.getAchievements(investigationId);
      setAchievements(Array.isArray(data) ? data : []);
    } catch {
      setAchievements([]);
    }
  }, []);

  // P2-POLISH: stats are cosmetic, so a failed read is swallowed and simply
  // leaves the compact panel hidden. No canonical/hidden data is involved.
  const loadStats = useCallback(async (investigationId: string) => {
    try {
      setStats(await api.getStats(investigationId));
    } catch {
      setStats(null);
    }
  }, []);

  const loadActivity = useCallback(async (investigationId: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setActivityLoading(true);
    setActivityError(null);
    try {
      const snapshot = await api.getActivity(investigationId, { limit: 30 });
      setActivitySnapshot(snapshot);
    } catch (err) {
      setActivityError(errorMessage(err));
    } finally {
      if (!opts?.silent) setActivityLoading(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const data = await api.getNotifications({ status: 'all', limit: 20 });
      setNotifications(data);
    } catch (err) {
      setNotificationsError(errorMessage(err));
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const loadDiscoveries = useCallback(async (investigationId: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setDiscoveryLoading(true);
    setDiscoveryError(null);
    try {
      const snapshot = await api.getDiscoveries(investigationId);
      setDiscoverySnapshot(snapshot);
    } catch (err) {
      setDiscoveryError(errorMessage(err));
    } finally {
      if (!opts?.silent) setDiscoveryLoading(false);
    }
  }, []);

  const handleDiscoveryStart = useCallback(async (clueKey: string) => {
    if (!investigation) return;
    setDiscoveryBusyClueKey(clueKey);
    setDiscoveryError(null);
    try {
      await api.startDiscovery(investigation.id, clueKey);
      await loadDiscoveries(investigation.id, { silent: true });
    } catch (err) {
      setDiscoveryError(errorMessage(err));
      throw err;
    } finally {
      setDiscoveryBusyClueKey(null);
    }
  }, [investigation, loadDiscoveries]);

  const handleDiscoverySubmit = useCallback(async (
    clueKey: string,
    body: { explanation: string; subjectIdentification?: string; connectionExplanation?: string; uncertainty?: string; sourceRefs?: string[]; confidence?: string }
  ) => {
    if (!investigation) throw new Error('No investigation loaded.');
    setDiscoveryBusyClueKey(clueKey);
    setDiscoveryError(null);
    try {
      const result = await api.submitDiscovery(investigation.id, clueKey, body);
      await loadDiscoveries(investigation.id, { silent: true });
      return result;
    } catch (err) {
      setDiscoveryError(errorMessage(err));
      throw err;
    } finally {
      setDiscoveryBusyClueKey(null);
    }
  }, [investigation, loadDiscoveries]);

  const handleDiscoveryApplyUnlock = useCallback(async (clueKey: string, unlockKey: string) => {
    if (!investigation) return;
    setDiscoveryBusyClueKey(clueKey);
    setDiscoveryError(null);
    try {
      const result = await api.applyDiscoveryUnlock(investigation.id, clueKey, unlockKey);
      await loadDiscoveries(investigation.id, { silent: true });
      // Action unlocks can affect progression/evidence; refresh when applied.
      if (result.unlock?.kind === 'action' || result.applied || result.alreadyApplied) {
        await refreshProgression(investigation.id).catch(() => {});
      }
    } catch (err) {
      setDiscoveryError(errorMessage(err));
      throw err;
    } finally {
      setDiscoveryBusyClueKey(null);
    }
  }, [investigation, loadDiscoveries]);

  const handleDiscoveryRecall = useCallback(async (memoryId: string, response: string): Promise<KnowledgeRecallResultDTO> => {
    const result = await api.submitKnowledgeRecall(memoryId, {
      response,
      investigationId: investigation?.id,
    });
    if (investigation) await loadDiscoveries(investigation.id, { silent: true });
    return result;
  }, [investigation, loadDiscoveries]);

  const getDiscoveryClueDetail = useCallback(async (clueKey: string) => {
    if (!investigation) throw new Error('No investigation loaded.');
    return api.getDiscoveryClue(investigation.id, clueKey);
  }, [investigation]);

  // -------------------------------------------------------------------------
  // Bootstrap: resolve which investigation to show, then load scoped data.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setIsLoading(true);
      setLoadError(null);
      setActionError(null);
      setConflict(null);
      setVerdict(null);
      setAccusation(null);
      setSolution(null);
      setSolutionError(null);
      setAchievements([]);
      setStats(null);
      setInvestigation(null);
      setCheckpointState(null);
      setDevelopments([]);
      setNotificationSettings({ developments: true });
      setSeenDevelopmentIds(new Set());
      setSettingsError(null);
      setActivitySnapshot(null);
      setActivityError(null);
      setActivityRefreshResult(null);
      setActivityRefreshing(false);
      setNotifications(null);
      setNotificationsError(null);
      setInboxOpen(false);
      setDiscoverySnapshot(null);
      setDiscoveryLoading(false);
      setDiscoveryError(null);
      setDiscoveryBusyClueKey(null);
      setSuspects([]);
      setOpenQuestions([]);
      setTheoryFeedback([]);
      setSelectedCheckpoint('');
      setSelectedTheoryEvidence([]);
      setTheoryText('');
      setSpecialists([]);
      setArtifacts([]);
      setDisagreements([]);
      setNotebookEntries([]);
      setSelectedSpecialistKey(null);
      setSelectedIntent('explain');
      setSelectedDepth('working');
      setTargetSpecialistKey(null);
      setArtifactDrawer(null);
      setNotebookError(null);
      setPerspectiveSuggestions([]);
      setPerspectiveEngagement('none');
      setPerspectiveSuggestionsError(null);
      setPerspectiveSuggestionNotice(null);
      setActivePerspectiveKey(null);
      setActivePerspectiveDetail(null);
      setActivePerspectiveConnections(null);
      setPerspectiveDetailError(null);
      setPerspectiveReflections([]);
      setPerspectiveReflectionText('');
      setPerspectiveReflectionKind('reflection');
      setPerspectiveReflectionPromptIndex('');
      setPerspectiveReflectionError(null);
      setChatPerspectiveKey(null);

      if (!caseId) {
        setLoadError('No case selected.');
        setIsLoading(false);
        return;
      }

      try {
        const caseData = await api.getCase(caseId).catch(() => null);
        if (cancelled) return;
        setCaseInfo(caseData);

        let inv: Investigation;

        if (investigationParam) {
          // Revisiting a specific (usually completed) investigation, e.g. from
          // the archive. Load it directly by id; ownership is checked server-side.
          inv = await api.getInvestigation(investigationParam);
          if (inv.caseId !== caseId) {
            throw new Error('This investigation belongs to a different case.');
          }
          // A finished case can be viewed read-only at any time, but reopening
          // a paused case must respect the one-active-investigation rule.
          if (inv.status !== 'completed') {
            const active = await api.getActiveInvestigation().catch((err: unknown) => {
              if (isNotFound(err)) return null;
              throw err;
            });
            if (active && active.id !== inv.id) {
              if (!cancelled) setConflict(active);
              return;
            }
          }
        } else {
          const active = await api.getActiveInvestigation().catch((err: unknown) => {
            if (isNotFound(err)) return null;
            throw err;
          });

          if (active && active.caseId !== caseId) {
            // One active case at a time: do not silently switch investigations.
            if (!cancelled) setConflict(active);
            return;
          }

          if (active) {
            inv = active;
          } else {
            try {
              inv = await api.createInvestigation(caseId);
            } catch (err) {
              // Another tab / StrictMode may have created it first.
              if (err instanceof ApiError && err.status === 409) {
                inv = await api.getActiveInvestigation();
              } else {
                throw err;
              }
            }
          }
        }

        if (cancelled) return;
        setInvestigation(inv);
        setDiscoveredIds(new Set(inv.discoveredEvidenceIds ?? []));
        setSeenDevelopmentIds(loadSeenDevelopmentIds(inv.id));

        const [evidenceData, suspectBoardData, conversation, journalData, eventData, accusationData, checkpointData, developmentData, notificationSettingsData, specialistsData, artifactsData, disagreementsData, notebookData, knowledgePackData] =
          await Promise.all([
            api.getEvidence(caseId),
            api.getSuspectBoard(inv.id),
            api.getConversation(inv.id).catch((err: unknown) => {
              if (isNotFound(err)) return { messageHistory: [] };
              throw err;
            }),
            api.getJournal(inv.id),
            api.getEvents(inv.id),
            api.getAccusation(inv.id).catch((err: unknown) => {
              if (isNotFound(err)) return null;
              throw err;
            }),
            api.getCheckpoints(inv.id),
            api.getDevelopments(inv.id),
            api.getNotificationSettings().catch(() => ({ developments: true })),
            api.getSpecialists(caseId).catch(() => []),
            api.getArtifacts(caseId).catch(() => []),
            api.getDisagreements(caseId).catch(() => []),
            api.getNotebook(inv.id).catch(() => []),
            api.getCaseKnowledgePack(caseId).catch(() => null),
          ]);

        if (cancelled) return;
        setEvidence(Array.isArray(evidenceData) ? evidenceData : []);
        setSuspects(Array.isArray(suspectBoardData?.suspects) ? suspectBoardData.suspects : []);
        setOpenQuestions(Array.isArray(suspectBoardData?.openQuestions) ? suspectBoardData.openQuestions : []);
        setMessages(Array.isArray(conversation.messageHistory) ? conversation.messageHistory : []);
        setJournal(Array.isArray(journalData) ? journalData : []);
        setEvents(Array.isArray(eventData) ? eventData : []);
        setAccusation(accusationData);
        setVerdict(accusationData ? verdictFromAccusation(accusationData) : null);
        setCheckpointState(checkpointData);
        setDevelopments(Array.isArray(developmentData) ? developmentData : []);
        setNotificationSettings(notificationSettingsData ?? { developments: true });
        setSpecialists(Array.isArray(specialistsData) ? specialistsData : []);
        setArtifacts(Array.isArray(artifactsData) ? artifactsData : []);
        setDisagreements(Array.isArray(disagreementsData) ? disagreementsData : []);
        setKnowledgePack(knowledgePackData ?? null);
        setNotebookEntries(Array.isArray(notebookData) ? notebookData : []);
        const firstOpen = checkpointData?.checkpoints.find((cp) => !cp.completed);
        setSelectedCheckpoint(firstOpen?.id ?? checkpointData?.checkpoints[0]?.id ?? '');

        // GAP-13: load server-awarded achievements for this investigation.
        if (cancelled) return;
        await loadAchievements(inv.id);
        // P2-POLISH: load the compact stats summary for the room header card.
        if (cancelled) return;
        await loadStats(inv.id);

        // M6: load living-activity snapshot and notification inbox (best-effort).
        if (cancelled) return;
        await loadActivity(inv.id).catch(() => {});
        if (cancelled) return;
        void loadNotifications();
        // M7: load field research discoveries (best-effort).
        void loadDiscoveries(inv.id);

        // A completed case (including one reopened from the archive via
        // ?investigation=) gets its full solution from the server.
        if (cancelled) return;
        if (inv.status === 'completed') await loadSolution(inv.id);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [caseId, investigationParam, loadSolution, loadAchievements, loadStats, loadActivity, loadNotifications, loadDiscoveries]);

  const timeline = useMemo(() => {
    const items = [
      ...evidence
        .filter((ev) => !!ev.timelineReference)
        .map((ev) => ({
          key: `ev-${ev.id}`,
          time: String(ev.timelineReference),
          label: `${ev.category}: ${ev.description}`,
          kind: 'Evidence',
        })),
      ...events.map((ev) => ({
        key: `event-${ev.id}`,
        time: ev.scheduledTimestamp ? String(ev.scheduledTimestamp) : '',
        label: ev.eventType,
        kind: 'Scheduled development',
      })),
    ];
    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [evidence, events]);

  // GAP-14: unread = development ids this browser has not marked seen. The
  // preference only controls the visual indicator, never the underlying feed.
  const notificationsEnabled = notificationSettings.developments !== false;
  const unreadDevelopments = useMemo(
    () => developments.filter((entry) => !seenDevelopmentIds.has(entry.id)),
    [developments, seenDevelopmentIds]
  );
  const unreadCount = notificationsEnabled ? unreadDevelopments.length : 0;

  const caseClosed = verdict?.evaluationResult === 'correct';

  const loadPerspectiveSuggestions = useCallback(async (investigationId: string) => {
    setPerspectiveSuggestionsLoading(true);
    setPerspectiveSuggestionsError(null);
    try {
      const res = await api.getPerspectiveSuggestions(investigationId);
      setPerspectiveSuggestions(Array.isArray(res.suggestions) ? res.suggestions : []);
      setPerspectiveEngagement(res.engagement === 'active' ? 'active' : 'none');
    } catch (err) {
      setPerspectiveSuggestionsError(errorMessage(err));
    } finally {
      setPerspectiveSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'perspectives' || !investigation) return;
    void loadPerspectiveSuggestions(investigation.id);
  }, [activeTab, investigation, loadPerspectiveSuggestions]);

  useEffect(() => {
    if (activeTab !== 'activity' || !investigation) return;
    if (!activitySnapshot) void loadActivity(investigation.id);
  }, [activeTab, investigation, activitySnapshot, loadActivity]);

  useEffect(() => {
    if (activeTab !== 'discoveries' || !investigation) return;
    void loadDiscoveries(investigation.id, { silent: !!discoverySnapshot });
    // Intentionally omit discoverySnapshot - we refresh on tab entry, not on every snapshot update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, investigation, loadDiscoveries]);

  useEffect(() => {
    if (activeTab !== 'activity' || !investigation || !activitySnapshot) return;
    if (activitySnapshot.counts.unread <= 0) return;
    const key = `${investigation.id}:${activitySnapshot.counts.unread}:${activitySnapshot.counts.total}`;
    if (lastSeenActivityRef.current === key) return;
    lastSeenActivityRef.current = key;
    void api.markActivitySeen(investigation.id, { through: new Date().toISOString() })
      .then(() => loadActivity(investigation.id, { silent: true }))
      .catch(() => {});
  }, [activeTab, investigation, activitySnapshot, loadActivity]);

  useEffect(() => {
    if (inboxOpen) void loadNotifications();
  }, [inboxOpen, loadNotifications]);

  // PROD-010: mirror the server-authoritative integrity state in the UI.
  // Readiness comes from completed deduction checkpoints (the same data the
  // server gates on); attempts/cooldown come from the investigation DTO.
  const completedDeductions = checkpointState?.completedCheckpoints?.length ?? 0;
  const accusationReady = completedDeductions > 0;
  const accusationAttempts = investigation?.accusationAttempts ?? 0;
  const cooldownEndMs = investigation?.accusationCooldownUntil
    ? new Date(investigation.accusationCooldownUntil).getTime()
    : Number.NaN;
  const cooldownRemainingMs = Number.isFinite(cooldownEndMs)
    ? Math.max(0, cooldownEndMs - nowMs)
    : 0;

  // Shared confirmation dialog element so it can be rendered from both the
  // normal room view and the "another case is active" early-return view.
  const abandonDialog = abandonTarget ? (
    <AbandonDialog
      investigation={abandonTarget}
      busy={abandoning}
      error={abandonError}
      onCancel={() => {
        setAbandonTarget(null);
        setAbandonError(null);
      }}
      onConfirm={() => void confirmAbandon()}
    />
  ) : null;

  // -------------------------------------------------------------------------
  // M5 Perspective Engine handlers
  // -------------------------------------------------------------------------
  const PERSPECTIVE_REFLECTION_KINDS: Array<{ value: PerspectiveReflectionKind; label: string }> = [
    { value: 'reflection', label: 'Reflection' },
    { value: 'argument_for', label: 'Argument for' },
    { value: 'argument_against', label: 'Argument against' },
    { value: 'assumption', label: 'Assumption' },
    { value: 'open_question', label: 'Open question' },
    { value: 'alternative_interpretation', label: 'Alternative interpretation' },
    { value: 'disagreement', label: 'Disagreement' },
    { value: 'hypothesis_reconsideration', label: 'Hypothesis reconsideration' },
  ];

  function humanizePerspective(value: string): string {
    return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  async function openPerspectiveInContext(experienceKey: string) {
    setActivePerspectiveKey(experienceKey);
    setPerspectiveDetailLoading(true);
    setPerspectiveDetailError(null);
    setPerspectiveReflectionError(null);
    setPerspectiveSuggestionNotice(null);
    try {
      const [detail, conn, refl] = await Promise.all([
        api.getPerspective(experienceKey),
        api.getPerspectiveConnections(experienceKey).catch(() => null),
        api.getPerspectiveReflections({ experienceKey, investigationId: investigation?.id }).catch(() => ({ reflections: [] })),
      ]);
      setActivePerspectiveDetail(detail);
      setActivePerspectiveConnections(conn);
      setPerspectiveReflections(Array.isArray(refl.reflections) ? refl.reflections : []);
    } catch (err) {
      setPerspectiveDetailError(errorMessage(err));
      setActivePerspectiveDetail(null);
      setActivePerspectiveConnections(null);
    } finally {
      setPerspectiveDetailLoading(false);
    }
  }

  async function dismissPerspectiveSuggestionCard(suggestion: PerspectiveSuggestion) {
    if (!investigation) return;
    setPerspectiveSuggestionNotice(null);
    try {
      await api.dismissPerspectiveSuggestion(investigation.id, suggestion.experienceKey, {
        reasonCode: suggestion.reasonCodes[0],
        fingerprint: suggestion.stateFingerprint,
      });
      setPerspectiveSuggestions((prev) => prev.filter((s) => s.experienceKey !== suggestion.experienceKey));
      setPerspectiveSuggestionNotice('Suggestion dismissed. You can continue exploring on your own terms.');
    } catch (err) {
      setPerspectiveSuggestionsError(errorMessage(err));
    }
  }

  async function submitPerspectiveReflection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!investigation || !activePerspectiveKey || !perspectiveReflectionText.trim() || perspectiveReflectionBusy) return;
    setPerspectiveReflectionBusy(true);
    setPerspectiveReflectionError(null);
    try {
      const promptIndex = perspectiveReflectionPromptIndex === '' ? null : perspectiveReflectionPromptIndex;
      const prompt = promptIndex !== null ? activePerspectiveDetail?.reflectionQuestions[promptIndex] : undefined;
      const res = await api.createPerspectiveReflection(activePerspectiveKey, {
        response: perspectiveReflectionText.trim(),
        promptIndex,
        prompt,
        reflectionKind: perspectiveReflectionKind,
        investigationId: investigation.id,
      });
      setPerspectiveReflections((prev) => [res.reflection, ...prev]);
      setPerspectiveReflectionText('');
      setPerspectiveReflectionPromptIndex('');
      setPerspectiveReflectionKind('reflection');
    } catch (err) {
      setPerspectiveReflectionError(errorMessage(err));
    } finally {
      setPerspectiveReflectionBusy(false);
    }
  }

  async function deletePerspectiveReflection(id: string) {
    if (!window.confirm('Delete this reflection?')) return;
    try {
      await api.deletePerspectiveReflection(id);
      setPerspectiveReflections((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setPerspectiveReflectionError(errorMessage(err));
    }
  }

  function perspectiveToClaimPrefill(opts: {
    title: string;
    description: string;
    claimCategory: 'factual_observation' | 'interpretation' | 'assumption' | 'causal_explanation' | 'motive' | 'timeline_assertion' | 'unresolved_question';
    confidence?: 'high_confidence' | 'moderate_confidence' | 'low_confidence' | 'insufficient_information';
    notes?: string;
    sourcePerspectiveReflectionId?: string | null;
  }) {
    if (!activePerspectiveKey) return;
    setRealityPrefill({
      sourcePerspectiveExperienceKey: activePerspectiveKey,
      sourcePerspectiveReflectionId: opts.sourcePerspectiveReflectionId ?? null,
      title: opts.title.slice(0, 160),
      description: opts.description,
      claimCategory: opts.claimCategory,
      confidence: opts.confidence ?? 'insufficient_information',
      notes: opts.notes ?? `Perspective: ${activePerspectiveDetail?.title || activePerspectiveKey}`,
    });
    setActiveTab('reality');
  }

  function perspectiveToHypothesisPrefill(reflection?: PerspectiveReflection) {
    if (!activePerspectiveKey) return;
    const detail = activePerspectiveDetail;
    setRealityPrefill({
      target: 'hypothesis',
      sourcePerspectiveExperienceKey: activePerspectiveKey,
      sourcePerspectiveReflectionId: reflection?.id ?? null,
      hypothesisName: (reflection?.response || detail?.primaryQuestion || 'Reconsidered hypothesis').slice(0, 160),
      hypothesisExplanation: reflection?.response || detail?.mainIdea || '',
      hypothesisPlayerNotes: `Reconsidered after perspective "${detail?.title || activePerspectiveKey}". This is player reasoning, not evidence.`,
      hypothesisMissingInformation: 'What evidence would support or challenge this reframing?',
      hypothesisAlternativeExplanations: 'What alternative explanations remain plausible?',
    });
    setActiveTab('reality');
  }

  async function savePerspectiveReflectionToNotebook(reflection: PerspectiveReflection) {
    if (!investigation || !activePerspectiveKey) return;
    setNotebookBusy(true);
    setNotebookError(null);
    try {
      await api.createNotebookEntry(investigation.id, {
        entryType: reflection.reflectionKind === 'open_question' ? 'question' : reflection.reflectionKind === 'assumption' ? 'suspicion' : 'note',
        title: `Perspective reflection — ${activePerspectiveDetail?.title || activePerspectiveKey}`.slice(0, 160),
        content: reflection.response,
        concept: humanizePerspective(reflection.reflectionKind),
        perspectiveKey: activePerspectiveKey,
        perspectiveExperienceId: reflection.experienceId || null,
      });
      await refreshNotebook();
      setActiveTab('notebook');
    } catch (err) {
      setNotebookError(errorMessage(err));
    } finally {
      setNotebookBusy(false);
    }
  }

  function discussPerspectiveWithSpecialist(specialistKey?: string) {
    if (!activePerspectiveKey) return;
    const caseKeys = new Set(specialists.map((s) => s.specialistKey));
    const related = (activePerspectiveDetail?.relatedSpecialistKeys ?? []).filter((k) => caseKeys.has(k));
    const chosen = (specialistKey && caseKeys.has(specialistKey))
      ? specialistKey
      : related[0] || specialists[0]?.specialistKey || null;
    setSelectedSpecialistKey(chosen);
    setSelectedIntent('explain');
    setChatPerspectiveKey(activePerspectiveKey);
    setTargetSpecialistKey(null);
    setActiveTab('chat');
    setMessageInput((current) => current.trim() ? current : `How might the perspective "${activePerspectiveDetail?.title || activePerspectiveKey}" help me think about this case?`);
    window.setTimeout(() => document.querySelector<HTMLInputElement>('.chat-input input')?.focus(), 0);
  }

  // -------------------------------------------------------------------------
  // M6 Living Investigations handlers
  // -------------------------------------------------------------------------
  const activityUnreadCount = activitySnapshot?.counts.unread ?? 0;
  const notificationUnreadCount = notifications?.unreadCount ?? 0;
  const discoveryNewCount = discoverySnapshot?.available ? (discoverySnapshot.newClueKeys?.length ?? 0) : 0;

  async function refreshLivingActivity() {
    if (!investigation || activityRefreshing) return;
    setActivityRefreshing(true);
    setActivityError(null);
    setActivityRefreshResult(null);
    try {
      const result = await api.refreshActivity(investigation.id, { max: 6 });
      setActivityRefreshResult(result);
      await loadActivity(investigation.id, { silent: true });
      void loadNotifications();
      // Refresh evidence/developments in case activity materialized changes.
      if (result.counts.resolved > 0 || result.counts.expired > 0 || result.evidenceChanges.length > 0) {
        await refreshProgression(investigation.id).catch(() => {});
      }
    } catch (err) {
      setActivityError(errorMessage(err));
    } finally {
      setActivityRefreshing(false);
    }
  }

  async function markActivitySeenNow() {
    if (!investigation) return;
    try {
      await api.markActivitySeen(investigation.id, { through: new Date().toISOString() });
      await loadActivity(investigation.id, { silent: true });
      void loadNotifications();
    } catch (err) {
      setActivityError(errorMessage(err));
    }
  }

  async function narrateActivityEvent(eventId: string) {
    if (!investigation) return null;
    try {
      return await api.narrateActivityEvent(investigation.id, eventId);
    } catch {
      return null;
    }
  }

  function handleActivityResponse(event: SafeActivityEvent, kind: string) {
    switch (kind) {
      case 'open_evidence':
        setActiveTab('evidence');
        break;
      case 'reply_to_specialist':
        if (event.actor.specialistKey) {
          setSelectedSpecialistKey(event.actor.specialistKey);
          setTargetSpecialistKey(null);
        }
        setActiveTab('chat');
        setMessageInput((current) => current.trim() ? current : `Regarding "${event.title}": `);
        window.setTimeout(() => document.querySelector<HTMLInputElement>('.chat-input input')?.focus(), 0);
        break;
      case 'verify_lead':
        setActiveTab('deductions');
        break;
      case 'rebuild_hypothesis':
        setActiveTab('reality');
        break;
      case 'open_activity':
      default:
        setActiveTab('activity');
        break;
    }
  }

  async function handleMarkNotificationsRead(ids?: string[]) {
    try {
      const res = ids && ids.length > 0
        ? await api.markNotificationsRead({ ids })
        : await api.markNotificationsRead({ all: true });
      setNotifications((prev) => prev ? {
        unreadCount: res.unreadCount,
        items: prev.items.map((item) => (ids && ids.length > 0 ? (ids.includes(item.id) ? { ...item, status: 'read' as const } : item) : { ...item, status: 'read' as const })),
      } : prev);
      void loadNotifications();
    } catch (err) {
      setNotificationsError(errorMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // Render states
  // -------------------------------------------------------------------------
  if (isLoading) return <div className="page-state">Loading investigation room...</div>;

  if (loadError) {
    return (
      <div className="investigation-room page-enter">
        <div className="error">Unable to open the investigation: {loadError}</div>
        <Link className="text-link" to="/">Back to case library</Link>
      </div>
    );
  }

  if (conflict) {
    return (
      <div className="investigation-room page-enter">
        <div className="conflict-panel">
          <h2>Another case is already active</h2>
          <p>
            You are currently investigating <strong>Case {conflict.caseId}</strong>. Only one
            investigation can be active at a time, so this case was not started. Continue or
            abandon your active case before switching.
          </p>
          <div className="button-row">
            <Link className="button-link" to={`/investigation/${conflict.caseId}`}>
              Continue active case
            </Link>
            <button
              type="button"
              className="small-button small-button--danger"
              onClick={() => {
                setAbandonError(null);
                setAbandonTarget(conflict);
              }}
            >
              Abandon that case
            </button>
            <Link className="text-link" to="/archive">View archive</Link>
            <Link className="text-link" to="/">Back to case library</Link>
          </div>
        </div>
        {abandonDialog}
      </div>
    );
  }

  if (!investigation) {
    return <div className="error">No investigation available for this case.</div>;
  }

  return (
    <div className="investigation-room page-enter">
      <div className="page-heading">
        <div>
          <h2>{caseInfo?.title ?? 'Investigation Room'}</h2>
          <p className="muted">
            Case {investigation.caseId} · Stage: {investigation.currentStage ?? 'available'} ·
            Progress: {investigation.progress ?? 0}%
          </p>
        </div>
        <div className="heading-actions">
          <div className="notification-bell-wrap">
            <button
              type="button"
              className="notification-bell"
              aria-label={notificationUnreadCount > 0 ? `Notifications, ${notificationUnreadCount} unread` : 'Notifications'}
              aria-haspopup="dialog"
              aria-expanded={inboxOpen}
              onClick={() => setInboxOpen((v) => !v)}
            >
              <svg className="notification-bell__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"/><path d="M9 17a3 3 0 0 0 6 0"/></svg>
              {notificationUnreadCount > 0 && (
                <span className="notification-bell__count" aria-hidden="true">
                  {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                </span>
              )}
            </button>
            <NotificationInbox
              open={inboxOpen}
              onClose={() => setInboxOpen(false)}
              notifications={notifications}
              loading={notificationsLoading}
              error={notificationsError}
              onRefresh={() => void loadNotifications()}
              onMarkRead={(ids) => void handleMarkNotificationsRead(ids)}
              onMarkAllRead={() => void handleMarkNotificationsRead()}
            />
          </div>
          {investigation.status !== 'completed' && investigation.status !== 'abandoned' && (
            <button
              type="button"
              className="small-button small-button--danger"
              onClick={() => {
                setAbandonError(null);
                setAbandonTarget(investigation);
              }}
            >
              Abandon case
            </button>
          )}
          <Link className="text-link" to="/">Back to case library</Link>
        </div>
      </div>

      {caseInfo?.briefing && (
        <details className="briefing">
          <summary>Case briefing</summary>
          <p>{caseInfo.briefing}</p>
        </details>
      )}

      {!!onboarding && !onboarding.tutorialState?.guideCompleted && (
        <OnboardingChecklist tutorialState={onboarding.tutorialState} onPatch={patchOnboarding} />
      )}

      {actionError && <div className="error">{actionError}</div>}

      <InvestigationHQ
        investigation={investigation}
        stats={stats}
        evidenceDiscovered={stats?.evidence.discovered ?? discoveredIds.size}
        evidenceTotal={stats?.evidence.total ?? evidence.length}
        checkpointsAnswered={stats?.checkpoints.answered ?? checkpointState?.completedCheckpoints.length ?? 0}
        checkpointsTotal={stats?.checkpoints.total ?? checkpointState?.checkpoints.length ?? 0}
        accusationCount={stats?.accusations ?? investigation.accusationAttempts ?? 0}
        achievementCount={stats?.achievements ?? achievements.length}
        activityUnread={activityUnreadCount}
        fieldResearchNew={discoveryNewCount}
        recallDue={discoverySnapshot?.recallPrompts?.length ?? 0}
        developmentsUnread={unreadCount}
        notificationUnread={notificationUnreadCount}
        caseClosed={caseClosed}
        onNavigate={(tab) => setActiveTab(tab as Tab)}
      />

      {(!caseClosed || developments.length > 0) && (
        <section className="developments-panel" aria-label="Recent developments">
          <div className="section-heading">
            <h3>
              Recent developments
              {unreadCount > 0 && (
                <span className="notification-badge" aria-live="polite">
                  {unreadCount} new
                </span>
              )}
            </h3>
            <div className="developments-actions">
              {unreadCount > 0 && (
                <button type="button" className="link-button" onClick={markDevelopmentsSeen}>
                  Mark all as read
                </button>
              )}
              {developments.length > 0 && (
                <span className="muted">Caught up while you were away</span>
              )}
            </div>
          </div>
          {developments.length > 0 ? (
            <ul className="development-list">
              {developments.slice(0, 5).map((entry) => {
                const isUnread = notificationsEnabled && !seenDevelopmentIds.has(entry.id);
                return (
                  <li
                    key={entry.id}
                    className={isUnread ? 'development-list__item development-list__item--unread' : 'development-list__item'}
                  >
                    <span className="development-message">
                      {isUnread && <span className="development-new">New</span>}
                      {entry.message}
                    </span>
                    <span className="muted">{formatDate(entry.createdAt)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">No new developments yet. Check back as the investigation unfolds.</p>
          )}
          <details className="notification-settings">
            <summary>Notification settings</summary>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                disabled={settingsSaving}
                onChange={(event) => void toggleDevelopmentNotifications(event.target.checked)}
              />
              Highlight new developments in this investigation
            </label>
            <p className="muted">In-app only — no email or push notifications are sent.</p>
            {settingsError && <p className="error">{settingsError}</p>}
          </details>
        </section>
      )}

      {verdict && (
        <VerdictPanel
          verdict={verdict}
          accusation={accusation}
          onContinue={() => {
            setVerdict(null);
            setActiveTab('evidence');
          }}
          onShowAccusation={() => setActiveTab('accuse')}
          closed={caseClosed}
        />
      )}

      {caseClosed && (
        <div className="solution-reveal">
          {solutionLoading && <div className="page-state">Loading solution...</div>}
          {solutionError && <div className="error">Unable to load solution: {solutionError}</div>}
          {solution && <SolutionPanel solution={solution} />}
        </div>
      )}

      {caseClosed && <AchievementsPanel achievements={achievements} />}

      {activitySnapshot && (activitySnapshot.sinceLastVisit.newCount > 0 || activitySnapshot.sinceLastVisit.highlights.length > 0) && (
        <div className="activity-visit-strip" aria-live="polite">
          <div className="activity-visit-strip__content">
            <strong>Since your last visit:</strong>{' '}
            <span>{activitySnapshot.sinceLastVisit.summary || `${activitySnapshot.sinceLastVisit.newCount} new development${activitySnapshot.sinceLastVisit.newCount === 1 ? '' : 's'}.`}</span>
          </div>
          <button type="button" className="link-button" onClick={() => setActiveTab('activity')}>
            View activity
          </button>
        </div>
      )}

      <nav className="tabs" aria-label="Investigation sections">
        {TABS.map((tab) => {
          const badgeCount =
            tab.id === 'activity' ? activityUnreadCount
            : tab.id === 'discoveries' ? discoveryNewCount
            : 0;
          const badgeLabel = tab.id === 'discoveries' ? `${badgeCount} new` : `${badgeCount} unread`;
          return (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'tab tab--active' : 'tab'}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab__label">{tab.label}</span>
              {badgeCount > 0 && <span className="tab-badge" aria-label={badgeLabel}>{badgeCount > 99 ? '99+' : badgeCount}</span>}
            </button>
          );
        })}
      </nav>

      <div className="tab-panel" key={activeTab}>
        {activeTab === 'chat' && (
          <section>
            <div className="section-heading">
              <h3>Group Chat</h3>
              <div className="badges">
                {selectedSpecialistKey && (
                  <span className="badge badge--soft">
                    Speaking with {specialists.find((s) => s.specialistKey === selectedSpecialistKey)?.name ?? 'specialist'}
                  </span>
                )}
                {chatPerspectiveKey && (
                  <span className="badge badge--warning">Perspective context: {chatPerspectiveKey}</span>
                )}
              </div>
            </div>
            {tipVisible('chatTip') && (
              <TabIntroTip title="Group Chat" onDismiss={() => dismissTip('chatTip')}>
                Ask the investigation team, or switch the responder to a specialist for a second opinion. Their answers help you think — they are not evidence and never reveal the verdict.
              </TabIntroTip>
            )}

            {chatPerspectiveKey && (
              <div className="perspective-engagement-banner" role="note">
                <strong>Epistemic note:</strong> This conversation uses the selected perspective as an advisory lens. It is not evidence, does not affect the verdict, and does not reveal the solution.
                {' '}
                <button type="button" className="link-button" onClick={() => setChatPerspectiveKey(null)}>Clear perspective context</button>
              </div>
            )}

            {specialists.length > 0 && (
              <div className="chat-controls" aria-label="Specialist chat controls">
                <label className="chat-controls__field">
                  <span>Responder</span>
                  <select
                    value={selectedSpecialistKey ?? ''}
                    onChange={(e) => {
                      setSelectedSpecialistKey(e.target.value || null);
                      setTargetSpecialistKey(null);
                    }}
                    disabled={caseClosed}
                  >
                    <option value="">Investigation team</option>
                    {specialists.map((s) => (
                      <option key={s.specialistKey} value={s.specialistKey}>
                        {s.name} — {s.discipline}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="chat-controls__field">
                  <span>Depth</span>
                  <select value={selectedDepth} onChange={(e) => setSelectedDepth(e.target.value as KnowledgeDepth)} disabled={caseClosed || !selectedSpecialistKey}>
                    <option value="plain">Plain</option>
                    <option value="working">Working</option>
                    <option value="technical">Technical</option>
                  </select>
                </label>
                <label className="chat-controls__field">
                  <span>Intent</span>
                  <select value={selectedIntent} onChange={(e) => setSelectedIntent(e.target.value as KnowledgeIntent)} disabled={caseClosed || !selectedSpecialistKey}>
                    <option value="explain">Explain</option>
                    <option value="deeper">Go deeper</option>
                    <option value="relevance">Relevance</option>
                    <option value="challenge">Challenge</option>
                    <option value="alternatives">Alternatives</option>
                    <option value="discriminate">Discriminate</option>
                    <option value="sources">Sources</option>
                    <option value="simpler">Simpler</option>
                    <option value="critique">Critique</option>
                  </select>
                </label>
                {targetSpecialistKey && (
                  <div className="chat-controls__target">
                    <span className="badge badge--warning">
                      Critiquing {specialists.find((s) => s.specialistKey === targetSpecialistKey)?.name ?? 'target specialist'}
                    </span>
                    <button type="button" className="link-button" onClick={() => setTargetSpecialistKey(null)}>Clear</button>
                  </div>
                )}
              </div>
            )}

            <div className="chat-area" id="chat-area" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation">
              {messages.length === 0 && !chatError && (
                <p className="chat-empty">No messages yet. Ask the team a question to begin.</p>
              )}
              {messages.map((message, index) => {
                // M8-2: small identity + continuity cues for specialist replies.
                // Both derive from data already in the room (the loaded public
                // specialists and the messages array) - no new API calls, no
                // hidden/canonical data, no change to the message contract.
                const messageSpecialist = message.role === 'investigator' && message.specialistKey
                  ? specialists.find((s) => s.specialistKey === message.specialistKey)
                  : undefined;
                const priorConsultations = message.role === 'investigator' && message.specialistKey
                  ? messages.slice(0, index).filter(
                    (m) => m.role === 'investigator' && m.specialistKey === message.specialistKey,
                  ).length
                  : 0;
                return (
                  <div
                    key={`${message.timestamp}-${index}`}
                    className={`chat-message chat-message--${message.role}`}
                  >
                    <div className="chat-message__meta">
                      <span className="chat-message__role">
                        {message.role === 'player'
                          ? 'You'
                          : (message.specialistName || message.responderLabel || 'Investigator')}
                        :
                      </span>
                      {message.role === 'investigator' && message.specialistKey && (
                        <span className="chat-message__badges">
                          <span className="badge badge--soft">Specialist</span>
                          {messageSpecialist?.discipline && (
                            <span className="badge badge--soft">{messageSpecialist.discipline}</span>
                          )}
                          {messageSpecialist && (
                            <span className="badge badge--soft">
                              {messageSpecialist.isFictional ? 'Fictional persona' : 'Real discipline'}
                            </span>
                          )}
                          {priorConsultations > 0 && (
                            <span
                              className="badge badge--soft"
                              title={`${priorConsultations} earlier exchange${priorConsultations === 1 ? '' : 's'} with this specialist in this case`}
                            >
                              Continuing
                            </span>
                          )}
                          {message.intent && <span className="badge badge--soft">{labelIntent(message.intent as KnowledgeIntent)}</span>}
                          {message.depth && <span className="badge badge--soft">{message.depth}</span>}
                        </span>
                      )}
                    </div>
                    <span className="chat-message__content">{displayChatContent(message)}</span>
                    {message.role === 'investigator' && investigation && (
                      <div className="chat-message__actions">
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => void saveExplanationToNotebook(message)}
                          disabled={notebookBusy}
                        >
                          Save to notebook
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {chatError && <div className="error">{chatError}</div>}
            {notebookError && <div className="error">{notebookError}</div>}
            <form className="chat-input" onSubmit={sendMessage}>
              <input
                type="text"
                placeholder={caseClosed ? 'This case is closed.' : selectedSpecialistKey ? 'Ask the selected specialist...' : 'Message the investigative team...'}
                aria-label="Message the investigative team"
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                disabled={sending || caseClosed}
              />
              <button type="submit" disabled={sending || caseClosed || !messageInput.trim()}>
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </section>
        )}

        {activeTab === 'activity' && investigation && (
          <ActivityPanel
            snapshot={activitySnapshot}
            loading={activityLoading}
            error={activityError}
            refreshing={activityRefreshing}
            refreshResult={activityRefreshResult}
            onRefresh={() => void refreshLivingActivity()}
            onRetry={() => void loadActivity(investigation.id)}
            onMarkSeen={() => void markActivitySeenNow()}
            onResponse={handleActivityResponse}
            onNarrate={narrateActivityEvent}
          />
        )}

        {activeTab === 'discoveries' && investigation && (
          <>
            {tipVisible('fieldResearch') && (
              <TabIntroTip title="Field Research" onDismiss={() => dismissTip('fieldResearch')}>
                Investigate real-world sources and bring what you find back. Submitting knowledge builds your memory for later recall and can unlock new leads — it is guidance, not case evidence, and never a shortcut to the verdict.
              </TabIntroTip>
            )}
            <DiscoveryPanel
              snapshot={discoverySnapshot}
              loading={discoveryLoading}
              error={discoveryError}
              onRefresh={() => loadDiscoveries(investigation.id)}
              onStart={handleDiscoveryStart}
              onSubmit={handleDiscoverySubmit}
              onApplyUnlock={handleDiscoveryApplyUnlock}
              onRecall={handleDiscoveryRecall}
              getClueDetail={getDiscoveryClueDetail}
              busyClueKey={discoveryBusyClueKey}
            />
          </>
        )}

        {activeTab === 'evidence' && (
          <section>
            <div className="section-heading">
              <h3>Evidence Room</h3>
              <span className="muted">
                {discoveredIds.size} examined · {evidence.length} visible
              </span>
            </div>
            {tipVisible('evidenceTip') && (
              <TabIntroTip title="Evidence Room" onDismiss={() => dismissTip('evidenceTip')}>
                Read each item and mark it as examined when you have looked it over. Examined items become available to support claims in your Reality Map and your final verdict.
              </TabIntroTip>
            )}
            {evidence.length === 0 ? (
              <p className="empty-state">No evidence is available for this case yet.</p>
            ) : (
              <div className="card-list">
                {evidence.map((ev) => {
                  const examined = discoveredIds.has(ev.id);
                  return (
                    <article key={ev.id} className="detail-card">
                      <div className="badges">
                        <span className="badge">{ev.category}</span>
                        {ev.timelineReference && (
                          <span className="badge">{ev.timelineReference}</span>
                        )}
                      </div>
                      <h4>{ev.description}</h4>
                      <p className="muted">Source: {ev.source || 'Unknown'}</p>
                      <p className="muted">Reliability: {ev.reliability || 'Unverified'}</p>
                      <button
                        type="button"
                        className="small-button"
                        disabled={examined}
                        onClick={() => void discover(ev.id)}
                      >
                        {examined ? 'Examined' : 'Mark as examined'}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'suspects' && (
          <section>
            {tipVisible('suspectsTip') && (
              <TabIntroTip title="Suspect Board" onDismiss={() => dismissTip('suspectsTip')}>
                Get to know the people involved — their motives, relationships, and what links them to discovered evidence. Follow your questions; first impressions can be wrong.
              </TabIntroTip>
            )}
            <SuspectBoardPanel suspects={suspects} openQuestions={openQuestions} />
          </section>
        )}

        {activeTab === 'reality' && investigation && (
          <>
            {tipVisible('reality') && (
              <TabIntroTip title="Reality Map" onDismiss={() => dismissTip('reality')}>
                Turn what you find into claims and competing hypotheses, then link them to show what supports or contradicts each idea. This is your reasoning workspace, not evidence.
              </TabIntroTip>
            )}
            <RealityMapPanel
              investigationId={investigation.id}
              caseClosed={caseClosed}
              specialists={specialists}
              prefill={realityPrefill}
              onPrefillConsumed={() => setRealityPrefill(null)}
            />
          </>
        )}

        {activeTab === 'perspectives' && investigation && (
          <section className="perspectives-tab" aria-label="Perspective suggestions and exploration">
            {tipVisible('perspectives') && (
              <TabIntroTip title="Perspectives" onDismiss={() => dismissTip('perspectives')}>
                Optional lenses for thinking about the case. They are advisory, never evidence, and do not affect the verdict - explore them whenever you like.
              </TabIntroTip>
            )}
            <div className="section-heading">
              <div>
                <h3>Perspectives</h3>
                <p className="muted">Advisory lenses for thinking. They are not evidence, do not affect the verdict, and do not reveal the solution.</p>
              </div>
              <div className="badges">
                <span className="badge badge--soft">Advisory</span>
                <span className="badge badge--soft">Not evidence</span>
              </div>
            </div>

            <div className="perspective-disclaimer detail-card" role="note">
              <strong>How to use perspectives.</strong>{' '}
              <span className="muted">Suggestions are optional and based on your current investigation state. You can dismiss them, explore freely, or ignore them entirely.</span>
            </div>

            {perspectiveSuggestionNotice && <p className="muted" role="status">{perspectiveSuggestionNotice}</p>}
            {perspectiveSuggestionsError && <div className="error">{perspectiveSuggestionsError}</div>}

            <div className="detail-card">
              <div className="section-heading">
                <h4>Suggestions for this investigation</h4>
                <span className="muted">{perspectiveSuggestionsLoading ? 'Loading…' : `${perspectiveSuggestions.length} suggestion${perspectiveSuggestions.length === 1 ? '' : 's'}`}</span>
              </div>
              {perspectiveEngagement === 'none' && !perspectiveSuggestionsLoading && (
                <div className="perspective-engagement-banner">
                  Fresh investigation — perspectives are available when you want them. You can open the <Link to="/perspectives">Perspectives library</Link> anytime, or use the suggestions below as optional starting points.
                </div>
              )}
              {perspectiveSuggestionsLoading ? (
                <p className="muted">Loading suggestions…</p>
              ) : perspectiveSuggestions.length === 0 ? (
                <p className="empty-state">No advisory suggestions right now. You can still explore the <Link to="/perspectives">Perspectives library</Link>.</p>
              ) : (
                <div className="perspective-suggestions">
                  {perspectiveSuggestions.map((s) => (
                    <article key={s.experienceKey} className="detail-card perspective-suggestion-card">
                      <div className="badges">
                        <span className="badge">{humanizePerspective(s.frameworkKey)}</span>
                        <span className="badge badge--soft">Advisory</span>
                      </div>
                      <h4>{s.title}</h4>
                      <p className="muted"><strong>Why this appeared:</strong> {s.reasonText || 'A perspective that may help you reflect on your current investigation state.'}</p>
                      {s.reasonCodes.length > 0 && (
                        <ul className="perspective-suggestion-reasons" aria-label="Suggestion reasons">
                          {s.reasonCodes.map((code) => <li key={code}>{humanizePerspective(code)}</li>)}
                        </ul>
                      )}
                      <div className="button-row">
                        <button type="button" className="small-button" onClick={() => void openPerspectiveInContext(s.experienceKey)}>Open perspective</button>
                        <button type="button" className="link-button" onClick={() => void dismissPerspectiveSuggestionCard(s)}>Dismiss</button>
                        <Link className="link-button" to={`/perspectives/${encodeURIComponent(s.experienceKey)}`}>Full page</Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {(activePerspectiveKey || perspectiveDetailLoading || perspectiveDetailError) && (
              <div className="detail-card perspective-inline-detail" aria-label="Perspective detail">
                <div className="perspective-inline-detail__header">
                  <div>
                    <h4>{activePerspectiveDetail?.title || 'Perspective detail'}</h4>
                    <p className="muted small-note">In-context view. Reflections can be saved to Reality Map or Notebook; nothing is auto-applied.</p>
                  </div>
                  <button type="button" className="link-button" onClick={() => { setActivePerspectiveKey(null); setActivePerspectiveDetail(null); setActivePerspectiveConnections(null); setPerspectiveReflections([]); setPerspectiveDetailError(null); }}>Close</button>
                </div>

                {perspectiveDetailLoading && <p className="muted">Loading perspective…</p>}
                {perspectiveDetailError && <div className="error">{perspectiveDetailError}</div>}

                {activePerspectiveDetail && !perspectiveDetailLoading && (
                  <>
                    <div className="perspective-disclaimer detail-card" role="note">
                      <strong>Advisory only.</strong> <span className="muted">{activePerspectiveDetail.disclaimer}</span>
                    </div>

                    <div className="badges">
                      <span className="badge">{activePerspectiveDetail.framework?.name || humanizePerspective(activePerspectiveDetail.frameworkKey)}</span>
                      <span className="badge badge--soft">{humanizePerspective(activePerspectiveDetail.format)}</span>
                      <span className="badge badge--soft">{humanizePerspective(activePerspectiveDetail.difficulty)}</span>
                      <span className="badge badge--soft">~{activePerspectiveDetail.estimatedMinutes} min</span>
                    </div>

                    <p><strong>Primary question:</strong> {activePerspectiveDetail.primaryQuestion}</p>
                    {activePerspectiveDetail.scopeNote && <p className="muted"><strong>Scope:</strong> {activePerspectiveDetail.scopeNote}</p>}
                    {activePerspectiveDetail.mainIdea && <p className="solution-prose"><strong>Main idea:</strong> {activePerspectiveDetail.mainIdea}</p>}
                    {activePerspectiveDetail.detailedExplanation && (
                      <details className="detail-card">
                        <summary>Detailed explanation</summary>
                        <p className="solution-prose">{activePerspectiveDetail.detailedExplanation}</p>
                      </details>
                    )}
                    {activePerspectiveDetail.sections?.length > 0 && (
                      <details className="detail-card">
                        <summary>Sections ({activePerspectiveDetail.sections.length})</summary>
                        <div className="card-list">
                          {activePerspectiveDetail.sections.map((sec, i) => (
                            <article key={`${sec.heading}-${i}`} className="detail-card">
                              <h4>{sec.heading}</h4>
                              <p className="solution-prose">{sec.body}</p>
                            </article>
                          ))}
                        </div>
                      </details>
                    )}

                    {activePerspectiveDetail.limitations.length > 0 && (
                      <div className="detail-card">
                        <h4>Limitations</h4>
                        <ul className="specialist-list">{activePerspectiveDetail.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
                      </div>
                    )}
                    {activePerspectiveDetail.counterarguments.length > 0 && (
                      <div className="detail-card">
                        <h4>Counterarguments</h4>
                        <ul className="specialist-list">{activePerspectiveDetail.counterarguments.map((c, i) => <li key={i}>{c}</li>)}</ul>
                      </div>
                    )}

                    <div className="detail-card">
                      <h4>Reality Map bridges</h4>
                      <p className="muted small-note">These actions prefill Reality Map items for your review. Nothing is auto-applied and confidence is never changed automatically.</p>
                      <div className="perspective-bridge-actions">
                        <button type="button" className="small-button" onClick={() => perspectiveToClaimPrefill({ title: activePerspectiveDetail.primaryQuestion, description: activePerspectiveDetail.mainIdea || activePerspectiveDetail.introduction, claimCategory: 'interpretation', confidence: 'low_confidence', notes: `Perspective lens: ${activePerspectiveDetail.title}` })}>Save as claim</button>
                        <button type="button" className="small-button" onClick={() => perspectiveToClaimPrefill({ title: `Assumption: ${activePerspectiveDetail.primaryQuestion}`.slice(0, 160), description: activePerspectiveDetail.mainIdea || '', claimCategory: 'assumption', confidence: 'insufficient_information', notes: `Assumption surfaced while reflecting on ${activePerspectiveDetail.title}.` })}>Record assumption</button>
                        <button type="button" className="small-button" onClick={() => perspectiveToClaimPrefill({ title: activePerspectiveDetail.reflectionQuestions[0] || activePerspectiveDetail.primaryQuestion, description: 'Open question from perspective reflection.', claimCategory: 'unresolved_question', confidence: 'insufficient_information', notes: `Open question from ${activePerspectiveDetail.title}.` })}>Add open question</button>
                        <button type="button" className="small-button" onClick={() => perspectiveToClaimPrefill({ title: `Argument for: ${activePerspectiveDetail.title}`.slice(0, 160), description: activePerspectiveDetail.mainIdea || activePerspectiveDetail.detailedExplanation.slice(0, 800), claimCategory: 'causal_explanation', confidence: 'low_confidence', notes: 'Argument-for perspective note; review before treating as case reasoning.' })}>Save argument</button>
                        <button type="button" className="small-button" onClick={() => perspectiveToClaimPrefill({ title: `Counterargument: ${activePerspectiveDetail.title}`.slice(0, 160), description: (activePerspectiveDetail.counterarguments[0] || activePerspectiveDetail.limitations[0] || 'Counterargument from perspective.'), claimCategory: 'interpretation', confidence: 'low_confidence', notes: 'Counterargument from perspective; review before using in case reasoning.' })}>Save counterargument</button>
                        <button type="button" className="small-button" onClick={() => perspectiveToHypothesisPrefill()}>Reconsider hypothesis</button>
                      </div>
                    </div>

                    <div className="detail-card">
                      <h4>Specialist bridge</h4>
                      <p className="muted small-note">Discuss this perspective with a specialist. Specialist responses remain advisory and must not be treated as evidence or case truth.</p>
                      <div className="button-row">
                        {(() => {
                          const caseKeys = new Set(specialists.map((s) => s.specialistKey));
                          const related = (activePerspectiveDetail.relatedSpecialistKeys ?? []).filter((k) => caseKeys.has(k));
                          const keys = related.length > 0 ? related : specialists.slice(0, 3).map((s) => s.specialistKey);
                          if (keys.length === 0) return <p className="muted">No specialists available for this case.</p>;
                          return keys.map((key) => {
                            const spec = specialists.find((s) => s.specialistKey === key);
                            return (
                              <button key={key} type="button" className="small-button" onClick={() => discussPerspectiveWithSpecialist(key)}>
                                Discuss with {spec?.name || humanizePerspective(key)}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    <div className="detail-card">
                      <h4>Reflection</h4>
                      <p className="muted small-note">Save a reflection linked to this investigation. You can then send it to Reality Map or Notebook.</p>
                      <form className="perspective-reflection-form" onSubmit={submitPerspectiveReflection}>
                        <label className="field-label">Reflection kind
                          <select value={perspectiveReflectionKind} onChange={(e) => setPerspectiveReflectionKind(e.target.value as PerspectiveReflectionKind)}>
                            {PERSPECTIVE_REFLECTION_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                          </select>
                        </label>
                        <label className="field-label">Prompt (optional)
                          <select value={perspectiveReflectionPromptIndex} onChange={(e) => setPerspectiveReflectionPromptIndex(e.target.value === '' ? '' : Number(e.target.value))}>
                            <option value="">No specific prompt</option>
                            {activePerspectiveDetail.reflectionQuestions.map((q, i) => <option key={i} value={i}>{q.slice(0, 90)}{q.length > 90 ? '…' : ''}</option>)}
                          </select>
                        </label>
                        <label className="field-label">Your response
                          <textarea value={perspectiveReflectionText} onChange={(e) => setPerspectiveReflectionText(e.target.value)} rows={4} maxLength={4000} required />
                        </label>
                        {perspectiveReflectionError && <div className="error">{perspectiveReflectionError}</div>}
                        <button type="submit" className="small-button" disabled={perspectiveReflectionBusy || !perspectiveReflectionText.trim()}>
                          {perspectiveReflectionBusy ? 'Saving…' : 'Save reflection'}
                        </button>
                      </form>

                      <div className="perspective-reflection-list" aria-label="Saved reflections">
                        {perspectiveReflections.filter(Boolean).length === 0 ? (
                          <p className="muted">No reflections saved for this perspective in this investigation.</p>
                        ) : perspectiveReflections.filter(Boolean).map((r) => {
                          const kind = r.reflectionKind || 'reflection';
                          return (
                          <article key={r.id} className="detail-card">
                            <div className="badges">
                              <span className="badge badge--soft">{humanizePerspective(kind)}</span>
                              {r.investigationId && <span className="badge badge--soft">Case-linked</span>}
                            </div>
                            {r.prompt && <p className="muted small-note"><strong>Prompt:</strong> {r.prompt}</p>}
                            <p>{r.response}</p>
                            <div className="perspective-bridge-actions">
                              <button type="button" className="small-button" onClick={() => perspectiveToClaimPrefill({ title: (r.response || '').slice(0, 160), description: r.response || '', claimCategory: kind === 'assumption' ? 'assumption' : kind === 'open_question' ? 'unresolved_question' : 'interpretation', confidence: 'insufficient_information', notes: `From perspective reflection (${humanizePerspective(kind)}).`, sourcePerspectiveReflectionId: r.id })}>Save as claim</button>
                              <button type="button" className="small-button" onClick={() => perspectiveToClaimPrefill({ title: `Assumption: ${(r.response || '').slice(0, 140)}`, description: r.response || '', claimCategory: 'assumption', confidence: 'insufficient_information', notes: 'Recorded as assumption from perspective reflection.', sourcePerspectiveReflectionId: r.id })}>Record assumption</button>
                              <button type="button" className="small-button" onClick={() => perspectiveToClaimPrefill({ title: (r.response || '').slice(0, 160), description: r.response || '', claimCategory: 'unresolved_question', confidence: 'insufficient_information', notes: 'Open question from perspective reflection.', sourcePerspectiveReflectionId: r.id })}>Add open question</button>
                              <button type="button" className="small-button" onClick={() => perspectiveToHypothesisPrefill(r)}>Reconsider hypothesis</button>
                              <button type="button" className="small-button" onClick={() => void savePerspectiveReflectionToNotebook(r)} disabled={notebookBusy}>Save to notebook</button>
                              <button type="button" className="link-button link-button--danger" onClick={() => void deletePerspectiveReflection(r.id)}>Delete</button>
                            </div>
                          </article>
                          );
                        })}
                      </div>
                    </div>

                    {activePerspectiveConnections && activePerspectiveConnections.relatedExperiences.length > 0 && (
                      <div className="detail-card">
                        <h4>Related experiences</h4>
                        <div className="card-list">
                          {activePerspectiveConnections.relatedExperiences.map((r) => (
                            <article key={r.experienceKey} className="detail-card">
                              <div className="badges">
                                <span className="badge badge--soft">{humanizePerspective(r.frameworkKey)}</span>
                                <span className="badge badge--soft">{humanizePerspective(r.format)}</span>
                              </div>
                              <h5><Link to={`/perspectives/${encodeURIComponent(r.experienceKey)}`}>{r.title}</Link></h5>
                              <p className="muted small-note">{r.primaryQuestion}</p>
                              <div className="button-row">
                                <button type="button" className="small-button" onClick={() => void openPerspectiveInContext(r.experienceKey)}>Open here</button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === 'experts' && (
          <div className="experts-tab">
            <ExpertsPanel
              pack={knowledgePack}
              specialists={specialists}
              disagreements={disagreements}
              selectedSpecialistKey={selectedSpecialistKey}
              selectedIntent={selectedIntent}
              selectedDepth={selectedDepth}
              onSelectSpecialist={(key) => { setSelectedSpecialistKey(key); setTargetSpecialistKey(null); }}
              onSelectIntent={setSelectedIntent}
              onSelectDepth={setSelectedDepth}
              onAskSpecialist={(specialistKey, intent, depth) => {
                setSelectedSpecialistKey(specialistKey);
                setSelectedIntent(intent);
                setSelectedDepth(depth);
                setTargetSpecialistKey(null);
                focusChat();
              }}
              onAskCritique={askCritique}
              onFocusChat={focusChat}
            />

            <section className="artifacts-section" aria-label="Knowledge artifacts">
              <div className="section-heading">
                <h3>Knowledge Artifacts</h3>
                <span className="muted">{artifacts.length} reference{artifacts.length === 1 ? '' : 's'}</span>
              </div>
              <p className="muted">
                Reference materials for this case. Real-world sources show verification status and
                bibliography; fictional in-world documents are explicitly labeled.
              </p>
              {artifacts.length === 0 ? (
                <p className="empty-state">No knowledge artifacts are available for this case.</p>
              ) : (
                <div className="card-list">
                  {artifacts.map((artifact) => (
                    <KnowledgeArtifactCard
                      key={artifact.id}
                      artifact={artifact}
                      onView={(a) => setArtifactDrawer(a)}
                      onSave={(a) => void saveArtifactToNotebook(a)}
                      onAsk={askSpecialistFromArtifact}
                      saving={notebookBusy}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'achievements' && (
          <div>
            <p className="muted">
              Achievements are awarded by the server for real investigative milestones. You cannot
              unlock them by choice.
            </p>
            <AchievementsPanel achievements={achievements} />
          </div>
        )}

        {activeTab === 'timeline' && (
          <section>
            <h3>Timeline</h3>
            {timeline.length === 0 ? (
              <p className="empty-state">
                No dated events yet. Examine evidence or check back for scheduled developments.
              </p>
            ) : (
              <ol className="timeline-list">
                {timeline.map((item) => (
                  <li key={item.key}>
                    <span className="timeline-time">{item.time || 'Date unknown'}</span>
                    <span className="timeline-kind">{item.kind}</span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {activeTab === 'journal' && (
          <section>
            <h3>Detective's Journal</h3>
            <form className="journal-form" onSubmit={addJournalNote}>
              <div className="form-row">
                <label>
                  Type
                  <select
                    value={journalType}
                    onChange={(e) => setJournalType(e.target.value)}
                  >
                    <option value="observation">Observation</option>
                    <option value="theory">Theory</option>
                    <option value="question">Question</option>
                    <option value="fact">Fact</option>
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={journalConfirmed}
                    onChange={(e) => setJournalConfirmed(e.target.checked)}
                  />
                  Confirmed fact
                </label>
              </div>
              <textarea
                aria-label="Journal note"
                placeholder="Record an observation, theory, or question..."
                value={journalContent}
                onChange={(e) => setJournalContent(e.target.value)}
                rows={3}
                required
              />
              <button type="submit" disabled={journalSaving || !journalContent.trim()}>
                {journalSaving ? 'Saving...' : 'Add note'}
              </button>
            </form>

            {journal.length === 0 ? (
              <p className="empty-state">No journal entries yet.</p>
            ) : (
              <div className="card-list">
                {journal.map((entry) => (
                  <article key={entry.id} className="detail-card">
                    <div className="badges">
                      <span className="badge">{entry.entryType}</span>
                      {entry.isConfirmed && <span className="badge badge--confirmed">Confirmed</span>}
                    </div>
                    <p>{entry.content}</p>
                    {entry.creationTimestamp && (
                      <p className="muted">{formatDate(entry.creationTimestamp)}</p>
                    )}
                    <div className="button-row">
                      <button type="button" className="link-button" onClick={() => turnJournalIntoClaim(entry)}>
                        Turn into claim
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'notebook' && (
          <div className="notebook-tab">
            {notebookError && <div className="error">{notebookError}</div>}
            <KnowledgeNotebook
              entries={notebookEntries}
              specialists={specialists}
              onCreateNote={handleNotebookCreate}
              onUpdate={handleNotebookUpdate}
              onDelete={handleNotebookDelete}
              onExport={handleNotebookExport}
              onTurnIntoClaim={turnNotebookIntoClaim}
              busy={notebookBusy}
            />
          </div>
        )}

        {activeTab === 'deductions' && (
          <section>
            <div className="section-heading">
              <h3>Deduction Checkpoints</h3>
              <span className="muted">
                {checkpointState?.completedCheckpoints.length ?? 0} of{' '}
                {checkpointState?.checkpoints.length ?? 0} reasoned through
              </span>
            </div>
            <p className="muted">
              Share your reasoning. The investigator evaluates it only against what you have
              already discovered - a strong deduction may unlock new evidence.
            </p>

            {!checkpointState || checkpointState.checkpoints.length === 0 ? (
              <p className="empty-state">No deduction checkpoints are open for this case.</p>
            ) : (
              <div className="card-list">
                {checkpointState.checkpoints.map((cp) => (
                  <article key={cp.id} className="detail-card">
                    <div className="badges">
                      <span className="badge">Checkpoint</span>
                      {cp.completed && <span className="badge badge--confirmed">Reasoned through</span>}
                    </div>
                    <p>{cp.prompt}</p>
                    <button
                      type="button"
                      className="small-button"
                      onClick={() => {
                        setSelectedCheckpoint(cp.id);
                        setTheoryFeedback([]);
                      }}
                    >
                      {selectedCheckpoint === cp.id ? 'Selected' : 'Address this point'}
                    </button>
                  </article>
                ))}
              </div>
            )}

            <form className="theory-form" onSubmit={submitTheory}>
              <label>
                Checkpoint
                <select
                  value={selectedCheckpoint}
                  onChange={(e) => {
                    setSelectedCheckpoint(e.target.value);
                    setTheoryFeedback([]);
                  }}
                  required
                  disabled={caseClosed}
                >
                  {(checkpointState?.checkpoints ?? []).map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.prompt}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Supporting evidence
                <select
                  multiple
                  value={selectedTheoryEvidence}
                  onChange={(e) =>
                    setSelectedTheoryEvidence(
                      Array.from(e.target.selectedOptions, (option) => option.value)
                    )
                  }
                  disabled={caseClosed}
                >
                  {evidence.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.source || ev.category}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                aria-label="Your theory"
                placeholder="Explain what you think is happening and why..."
                value={theoryText}
                onChange={(e) => setTheoryText(e.target.value)}
                rows={3}
                required
                disabled={caseClosed}
              />
              {theoryFeedback.length > 0 && (
                <div className="theory-feedback" role="status">
                  {theoryFeedback.map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              )}
              <button type="submit" disabled={theoryBusy || caseClosed || !selectedCheckpoint || !theoryText.trim()}>
                {theoryBusy ? 'Submitting...' : 'Submit theory'}
              </button>
            </form>

            {checkpointState && checkpointState.actions.length > 0 && (
              <div className="investigative-actions">
                <h3>Investigative Actions</h3>
                <div className="button-row">
                  {checkpointState.actions.map((action) => (
                    <button
                      key={action.action}
                      type="button"
                      className="small-button"
                      disabled={actionBusy !== null || caseClosed || action.performed}
                      onClick={() => void performAction(action.action)}
                    >
                      {actionBusy === action.action ? 'Working...' : action.performed ? `${action.label} (done)` : action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'accuse' && (
          <section>
            <h3>Final Accusation</h3>
            <p className="muted">
              Name the person responsible, explain the motive and method, and select the evidence
              that supports your conclusion. The verdict is evaluated against the case's canonical
              solution on the server.
            </p>

            <div className="accusation-status" role="status">
              <div>
                <strong>Readiness:</strong>{' '}
                {accusationReady
                  ? 'A deduction is complete — you may submit a final accusation.'
                  : 'Complete at least one deduction checkpoint before accusing.'}
              </div>
              <div><strong>Attempts made:</strong> {accusationAttempts}</div>
              {cooldownRemainingMs > 0 && (
                <div className="cooldown-notice">
                  <strong>Next attempt available in:</strong>{' '}
                  {Math.ceil(cooldownRemainingMs / 1000)}s
                </div>
              )}
            </div>

            {accusation && (
              <div className="previous-accusation">
                <strong>Last accusation:</strong> {accusation.submittedCulprit} —{' '}
                {accusation.motive} / {accusation.method}
                {accusation.evaluationResult && <span> ({accusation.evaluationResult})</span>}
              </div>
            )}

            <form className="accusation-form" onSubmit={submitAccusation}>
              <label>
                Culprit
                <input
                  type="text"
                  list="suspect-names"
                  placeholder="Name of the person responsible"
                  value={culprit}
                  onChange={(e) => setCulprit(e.target.value)}
                  required
                  disabled={caseClosed}
                />
                <datalist id="suspect-names">
                  {suspects.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </label>
              <label>
                Motive
                <textarea
                  value={motive}
                  onChange={(e) => setMotive(e.target.value)}
                  rows={2}
                  required
                  disabled={caseClosed}
                />
              </label>
              <label>
                Method
                <textarea
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  rows={2}
                  required
                  disabled={caseClosed}
                />
              </label>

              <fieldset className="evidence-select">
                <legend>Supporting evidence</legend>
                {evidence.length === 0 ? (
                  <p className="muted">No evidence available to select.</p>
                ) : (
                  evidence.map((ev) => (
                    <label key={ev.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedEvidence.includes(ev.id)}
                        onChange={(e) =>
                          setSelectedEvidence((current) =>
                            e.target.checked
                              ? [...current, ev.id]
                              : current.filter((id) => id !== ev.id)
                          )
                        }
                        disabled={caseClosed}
                      />
                      {ev.category}: {ev.description}
                    </label>
                  ))
                )}
              </fieldset>

              {accusationError && <div className="error">{accusationError}</div>}

              {caseClosed ? (
                <div className="resolved-note">
                  This case is solved. View your completed cases in the{' '}
                  <Link className="text-link" to="/archive">archive</Link>.
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={accusing || (!accusationReady && checkpointState !== null) || cooldownRemainingMs > 0}
                >
                  {accusing
                    ? 'Evaluating...'
                    : cooldownRemainingMs > 0
                      ? `Cooldown (${Math.ceil(cooldownRemainingMs / 1000)}s)`
                      : 'Submit accusation'}
                </button>
              )}
            </form>

          </section>
        )}
      </div>
      {artifactDrawer && caseId && (
        <KnowledgeArtifactDrawer
          caseId={caseId}
          artifact={artifactDrawer}
          onClose={() => setArtifactDrawer(null)}
          onSave={(a) => void saveArtifactToNotebook(a)}
          onAsk={askSpecialistFromArtifact}
          saving={notebookBusy}
        />
      )}
      {abandonDialog}
    </div>
  );

  // -------------------------------------------------------------------------
  // M2 knowledge helpers
  // -------------------------------------------------------------------------

  function labelIntent(intent: KnowledgeIntent): string {
    return intent.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function focusChat() {
    setActiveTab('chat');
    // Allow the tab panel to render before focusing the input.
    window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('.chat-input input');
      input?.focus();
    }, 0);
  }

  function turnJournalIntoClaim(entry: JournalEntry) {
    setRealityPrefill({
      sourceJournalEntryId: entry.id,
      title: entry.content.slice(0, 160),
      description: entry.content,
      claimCategory: entry.isConfirmed ? 'factual_observation' : 'interpretation',
      confidence: entry.isConfirmed ? 'moderate_confidence' : 'insufficient_information',
    });
    setActiveTab('reality');
  }

  function turnNotebookIntoClaim(entry: PublicNotebookEntry) {
    setRealityPrefill({
      sourceNotebookEntryId: entry.id,
      title: (entry.title || entry.concept || entry.content || 'Notebook claim').slice(0, 160),
      description: entry.content || entry.title || '',
      claimCategory: entry.entryType === 'fact' ? 'factual_observation' : entry.entryType === 'question' ? 'unresolved_question' : 'interpretation',
      confidence: 'insufficient_information',
    });
    setActiveTab('reality');
  }

  async function refreshNotebook() {
    if (!investigation) return;
    try {
      const entries = await api.getNotebook(investigation.id);
      setNotebookEntries(Array.isArray(entries) ? entries : []);
    } catch {
      // Keep existing notebook view; save actions report their own errors.
    }
  }

  async function saveExplanationToNotebook(message: ChatMessage) {
    if (!investigation || message.role !== 'investigator') return;
    setNotebookBusy(true);
    setNotebookError(null);
    try {
      const specialist = specialists.find((s) => s.specialistKey === message.specialistKey);
      await api.createNotebookEntry(investigation.id, {
        entryType: 'note',
        title: specialist ? `Explanation — ${specialist.name}` : 'Investigation note',
        concept: message.intent ? labelIntent(message.intent) : 'Explanation',
        content: message.content,
        specialistId: specialist?.id ?? null,
      });
      await refreshNotebook();
      setActiveTab('notebook');
    } catch (err) {
      setNotebookError(errorMessage(err));
    } finally {
      setNotebookBusy(false);
    }
  }

  async function saveArtifactToNotebook(artifact: PublicArtifactSummary | PublicArtifactDetail) {
    if (!investigation) return;
    setNotebookBusy(true);
    setNotebookError(null);
    try {
      await api.createNotebookEntry(investigation.id, {
        entryType: 'fact',
        title: artifact.title,
        concept: artifact.relatedConcepts[0] ?? artifact.artifactType ?? 'Knowledge artifact',
        content: artifact.description || '',
        artifactId: artifact.id,
      });
      await refreshNotebook();
      setActiveTab('notebook');
    } catch (err) {
      setNotebookError(errorMessage(err));
    } finally {
      setNotebookBusy(false);
    }
  }

  async function handleNotebookExport(format: 'json' | 'markdown') {
    if (!investigation) return;
    setNotebookError(null);
    try {
      const content = format === 'json'
        ? JSON.stringify(await api.exportNotebookJson(investigation.id), null, 2)
        : await api.exportNotebookMarkdown(investigation.id);
      const mime = format === 'json' ? 'application/json' : 'text/markdown';
      const ext = format === 'json' ? 'json' : 'md';
      const blob = new Blob([content], { type: `${mime};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const slug = (caseInfo?.title || 'case')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `notebook-${slug || 'case'}.${ext}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setNotebookError(errorMessage(err));
      throw err;
    }
  }

  function askSpecialistFromArtifact(artifact: PublicArtifactSummary | PublicArtifactDetail) {
    const specialistKey = artifact.specialistKey || specialists[0]?.specialistKey || null;
    setSelectedSpecialistKey(specialistKey);
    setSelectedIntent('relevance');
    setTargetSpecialistKey(null);
    setArtifactDrawer(null);
    setActiveTab('chat');
    setMessageInput((current) =>
      current.trim()
        ? current
        : `How is "${artifact.title}" relevant to what I've found so far?`
    );
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>('.chat-input input')?.focus();
    }, 0);
  }

  function askCritique(specialistKey: string, targetKey: string) {
    setSelectedSpecialistKey(specialistKey);
    setSelectedIntent('critique');
    setTargetSpecialistKey(targetKey);
    setActiveTab('chat');
    setMessageInput((current) =>
      current.trim() ? current : 'Please critique the contrasting position and explain what evidence would distinguish them.'
    );
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>('.chat-input input')?.focus();
    }, 0);
  }

  async function handleNotebookCreate(input: { entryType: string; title: string; content: string; concept: string }) {
    if (!investigation) return;
    setNotebookBusy(true);
    setNotebookError(null);
    try {
      await api.createNotebookEntry(investigation.id, {
        entryType: input.entryType,
        title: input.title || undefined,
        content: input.content,
        concept: input.concept || undefined,
      });
      await refreshNotebook();
    } catch (err) {
      const message = errorMessage(err);
      setNotebookError(message);
      throw new Error(message);
    } finally {
      setNotebookBusy(false);
    }
  }

  async function handleNotebookUpdate(entryId: string, patch: { title?: string; content?: string; concept?: string; entryType?: string }) {
    if (!investigation) return;
    setNotebookBusy(true);
    setNotebookError(null);
    try {
      await api.updateNotebookEntry(investigation.id, entryId, patch);
      await refreshNotebook();
    } catch (err) {
      const message = errorMessage(err);
      setNotebookError(message);
      throw new Error(message);
    } finally {
      setNotebookBusy(false);
    }
  }

  async function handleNotebookDelete(entryId: string) {
    if (!investigation) return;
    setNotebookBusy(true);
    setNotebookError(null);
    try {
      await api.deleteNotebookEntry(investigation.id, entryId);
      await refreshNotebook();
    } catch (err) {
      const message = errorMessage(err);
      setNotebookError(message);
      throw new Error(message);
    } finally {
      setNotebookBusy(false);
    }
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  // PROD-012: abandon only after the in-app confirmation dialog. On success
  // the server releases the active-case lock, so send the player back to the
  // library (with a one-time success banner) where a fresh case can be chosen.
  async function confirmAbandon() {
    if (!abandonTarget || abandoning) return;
    setAbandoning(true);
    setAbandonError(null);
    try {
      await api.abandonInvestigation(abandonTarget.id);
      setAbandonTarget(null);
      navigate('/?abandoned=1', { replace: true });
    } catch (err) {
      setAbandonError(errorMessage(err));
    } finally {
      setAbandoning(false);
    }
  }

  // GAP-14: mark all currently loaded developments as seen in this browser.
  // Only opaque ids are persisted; the development messages themselves still
  // come from the player-safe server feed on every load.
  function markDevelopmentsSeen() {
    if (!investigation) return;
    const allIds = new Set(developments.map((entry) => entry.id));
    saveSeenDevelopmentIds(investigation.id, allIds);
    setSeenDevelopmentIds(allIds);
  }

  async function toggleDevelopmentNotifications(enabled: boolean) {
    setSettingsSaving(true);
    setSettingsError(null);
    // Optimistic update; roll back to the previous value if the save fails.
    setNotificationSettings((current) => ({ ...current, developments: enabled }));
    try {
      const saved = await api.updateNotificationSettings({ developments: enabled });
      setNotificationSettings(saved);
    } catch (err) {
      setNotificationSettings((current) => ({ ...current, developments: !enabled }));
      setSettingsError(errorMessage(err));
    } finally {
      setSettingsSaving(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = messageInput.trim();
    if (!text || !investigation || sending || caseClosed) return;

    const opts = selectedSpecialistKey
      ? {
          specialistKey: selectedSpecialistKey,
          intent: selectedIntent,
          depth: selectedDepth,
          ...(targetSpecialistKey ? { targetSpecialistKey } : {}),
          ...(chatPerspectiveKey ? { perspectiveKey: chatPerspectiveKey } : {}),
        }
      : chatPerspectiveKey
        ? { perspectiveKey: chatPerspectiveKey }
        : undefined;

    setSending(true);
    setChatError(null);
    setMessageInput('');

    const specialistOpts = opts && 'specialistKey' in opts ? opts : null;
    const optimistic: ChatMessage = {
      role: 'player',
      content: text,
      timestamp: new Date().toISOString(),
      ...(specialistOpts?.specialistKey
        ? { specialistKey: specialistOpts.specialistKey, intent: specialistOpts.intent, depth: specialistOpts.depth }
        : {}),
    };
    setMessages((previous) => [...previous, optimistic]);

    try {
      const reply = await api.sendChat(investigation.id, text, opts);
      setMessages((previous) => [...previous, reply]);
      setTargetSpecialistKey(null);
    } catch (err) {
      setMessages((previous) => previous.filter((message) => message !== optimistic));
      setMessageInput(text);
      setChatError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function discover(evidenceId: string) {
    if (!investigation) return;
    setActionError(null);
    try {
      const updated = await api.discoverEvidence(investigation.id, evidenceId);
      setInvestigation(updated);
      setDiscoveredIds(new Set(updated.discoveredEvidenceIds ?? []));
      // The server may have just awarded first_evidence on this first find.
      await loadAchievements(investigation.id);
      await loadStats(investigation.id);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  // Re-read authoritative state after a release so the evidence room, progress
  // and development feed all reflect what the server actually unlocked.
  async function refreshProgression(investigationId: string) {
    const [updated, evidenceData, suspectBoardData, checkpointData, developmentData] = await Promise.all([
      api.getInvestigation(investigationId),
      api.getEvidence(caseId ?? ''),
      api.getSuspectBoard(investigationId),
      api.getCheckpoints(investigationId),
      api.getDevelopments(investigationId),
    ]);
    setInvestigation(updated);
    setDiscoveredIds(new Set(updated.discoveredEvidenceIds ?? []));
    setEvidence(Array.isArray(evidenceData) ? evidenceData : []);
    setSuspects(Array.isArray(suspectBoardData?.suspects) ? suspectBoardData.suspects : []);
    setOpenQuestions(Array.isArray(suspectBoardData?.openQuestions) ? suspectBoardData.openQuestions : []);
    setCheckpointState(checkpointData);
    setDevelopments(Array.isArray(developmentData) ? developmentData : []);
    await loadStats(investigationId);
  }

  async function submitTheory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!investigation || theoryBusy || caseClosed || !selectedCheckpoint) return;

    setTheoryBusy(true);
    setActionError(null);
    setTheoryFeedback([]);
    try {
      const result = await api.submitTheory(investigation.id, {
        checkpointId: selectedCheckpoint,
        theory: theoryText.trim(),
        supportingEvidence: selectedTheoryEvidence,
      });
      setTheoryFeedback(result.feedback);
      setTheoryText('');
      await refreshProgression(investigation.id);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setTheoryBusy(false);
    }
  }

  async function performAction(action: string) {
    if (!investigation || caseClosed) return;
    setActionBusy(action);
    setActionError(null);
    try {
      const result = await api.performAction(investigation.id, action);
      const messages = result.developments.map((d) => d.message);
      if (messages.length > 0) setTheoryFeedback(messages);
      await refreshProgression(investigation.id);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActionBusy(null);
    }
  }

  async function addJournalNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = journalContent.trim();
    if (!content || !investigation || journalSaving) return;

    setJournalSaving(true);
    setActionError(null);
    try {
      const entry = await api.addJournal(investigation.id, {
        entryType: journalType,
        content,
        isConfirmed: journalConfirmed,
      });
      setJournal((previous) => [...previous, entry]);
      setJournalContent('');
      setJournalConfirmed(false);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setJournalSaving(false);
    }
  }

  async function submitAccusation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!investigation || accusing || caseClosed) return;

    const submittedCulprit = culprit.trim();
    const submittedMotive = motive.trim();
    const submittedMethod = method.trim();

    if (!submittedCulprit || !submittedMotive || !submittedMethod) {
      setAccusationError('Culprit, motive, and method are all required.');
      return;
    }

    setAccusing(true);
    setAccusationError(null);
    setActionError(null);

    try {
      await api.submitAccusation(investigation.id, {
        submittedCulprit,
        motive: submittedMotive,
        method: submittedMethod,
        supportingEvidence: selectedEvidence,
      });

      const result = await api.evaluateAccusation(investigation.id, {
        culprit: submittedCulprit,
        motive: submittedMotive,
        method: submittedMethod,
        supportingEvidence: selectedEvidence,
      });
      setVerdict(result);

      const latest = await api.getAccusation(investigation.id).catch(() => null);
      setAccusation(latest);

      if (result.evaluationResult === 'correct') {
        setInvestigation(await api.getInvestigation(investigation.id));
        // The server awards case_solved alongside the correct verdict.
        await loadAchievements(investigation.id);
        await loadStats(investigation.id);
        // Reveal the full solution now that the server has completed the case.
        await loadSolution(investigation.id);
        // Pin the resolved case in the URL so a reload shows this verdict
        // instead of creating a brand-new investigation for the same case.
        setSearchParams({ investigation: investigation.id }, { replace: true });
      } else {
        // A failed/partial verdict leaves the investigation active on the
        // server, so the player can keep chatting, gathering evidence and
        // retrying. Refresh authoritative state instead of PATCHing status.
        setInvestigation(await api.getInvestigation(investigation.id));
        await loadStats(investigation.id);
      }
    } catch (err) {
      // A 409 (not ready) or 429 (cooldown) is expected gameplay feedback, not
      // a crash. Re-read authoritative state so the attempt counter, cooldown
      // and readiness indicators shown above stay in sync with the server.
      setAccusationError(errorMessage(err));
      try {
        setInvestigation(await api.getInvestigation(investigation.id));
        setCheckpointState(await api.getCheckpoints(investigation.id));
        setNowMs(Date.now());
      } catch {
        // Non-fatal: the original error message is already displayed.
      }
    } finally {
      setAccusing(false);
    }
  }
};

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

// Legacy StatsPanel removed - replaced by InvestigationHQ (M8-3).

// PROD-013: renders the server's safe suspect projection. Nothing here is
// computed on the client from canonical data - all fields arrive pre-filtered.
function SuspectBoardPanel({
  suspects,
  openQuestions,
}: {
  suspects: Suspect[];
  openQuestions: string[];
}) {
  return (
    <section className="suspect-board">
      <div className="section-heading">
        <h3>Suspect Board</h3>
        <span className="muted">
          {suspects.length} {suspects.length === 1 ? 'person' : 'persons'} of interest
        </span>
      </div>
      <p className="muted">
        These profiles contain publicly known information only. Comparing them will never tell you
        who is responsible.
      </p>

      {openQuestions.length > 0 && (
        <div className="suspect-open-questions">
          <h4>Open questions</h4>
          <ul>
            {openQuestions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </div>
      )}

      {suspects.length === 0 ? (
        <p className="empty-state">No suspect profiles available.</p>
      ) : (
        <div className="card-list">
          {suspects.map((suspect) => (
            <article key={suspect.id} className="detail-card suspect-card">
              <div className="suspect-card__header">
                <h4>{suspect.name}</h4>
                <span className="badge">{suspect.role || 'person of interest'}</span>
              </div>
              {suspect.playerSuspicion && (
                <p className="muted">
                  Your suspicion: <strong>{suspect.playerSuspicion}</strong>
                </p>
              )}
              {suspect.personality && <p className="muted">{suspect.personality}</p>}
              {suspect.background && <p>{suspect.background}</p>}

              <dl className="suspect-facts">
                <dt>Known motive</dt>
                <dd>{suspect.motive || 'Not established'}</dd>
                <dt>Alibi</dt>
                <dd>{suspect.alibi || 'Not provided'}</dd>
                {suspect.confirmedAlibi && (
                  <>
                    <dt>Alibi status</dt>
                    <dd>{suspect.confirmedAlibi}</dd>
                  </>
                )}
              </dl>

              {suspect.relationships.length > 0 && (
                <div className="suspect-section">
                  <h5>Known relationships</h5>
                  <ul className="suspect-relationships">
                    {suspect.relationships.map((rel) => (
                      <li key={`${rel.name}-${rel.label}`}>
                        <strong>{rel.name}</strong> — {rel.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="suspect-section">
                <h5>Linked evidence ({suspect.linkedEvidenceCount})</h5>
                {suspect.linkedEvidence.length === 0 ? (
                  <p className="muted">No visible evidence is linked to this person yet.</p>
                ) : (
                  <ul className="suspect-evidence">
                    {suspect.linkedEvidence.map((ev) => (
                      <li key={ev.id}>
                        <span className="badge">{ev.category}</span> {ev.source || 'Unnamed item'}
                        {ev.timelineReference && (
                          <span className="muted"> · {ev.timelineReference}</span>
                        )}
                        <span className="muted">
                          {' '}
                          · {ev.examined ? 'Examined' : 'Not examined yet'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {suspect.unansweredQuestions.length > 0 && (
                <div className="suspect-section">
                  <h5>Questions to investigate</h5>
                  <ul className="suspect-questions">
                    {suspect.unansweredQuestions.map((question, index) => (
                      <li key={index}>{question}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

interface VerdictPanelProps {
  verdict: VerdictResult;
  accusation: Accusation | null;
  onContinue: () => void;
  onShowAccusation: () => void;
  closed: boolean;
}

function VerdictPanel({
  verdict,
  accusation,
  onContinue,
  onShowAccusation,
  closed,
}: VerdictPanelProps) {
  const outcome: VerdictOutcome = verdict.evaluationResult;
  const badgeClass =
    outcome === 'correct' ? 'badge--correct' : outcome === 'partial' ? 'badge--partial' : 'badge--incorrect';

  return (
    <div className={`verdict-panel verdict-panel--${outcome}`} role="status">
      <div className="verdict-heading">
        <h3>Verdict</h3>
        <span className={`badge ${badgeClass}`}>{outcome.toUpperCase()}</span>
      </div>
      <p>{verdict.message}</p>
      {accusation && (
        <p className="muted">
          Submitted: <strong>{accusation.submittedCulprit}</strong> — {accusation.motive} /{' '}
          {accusation.method}
        </p>
      )}
      {outcome !== 'correct' && typeof verdict.attempts === 'number' && (
        <p className="muted">
          Attempts made: <strong>{verdict.attempts}</strong>. A failed accusation starts a short
          cooldown; you can keep investigating and try again afterwards.
        </p>
      )}

      <div className="button-row">
        {outcome === 'correct' ? (
          <>
            <Link className="button-link" to="/archive">View archive</Link>
            <Link className="text-link" to="/">Back to case library</Link>
          </>
        ) : (
          <>
            <button type="button" className="small-button" onClick={onContinue}>
              Continue investigating
            </button>
            <button type="button" className="link-button" onClick={onShowAccusation}>
              Review accusation
            </button>
            {!closed && <span className="muted">You can submit a new accusation when ready.</span>}
          </>
        )}
      </div>
    </div>
  );
}

// PROD-012: explicit, accessible confirmation for the destructive abandon
// action. The API independently requires { confirm: true }, so an accidental
// click alone can never release the active-case lock.
interface AbandonDialogProps {
  investigation: Investigation;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function AbandonDialog({ investigation, busy, error, onCancel, onConfirm }: AbandonDialogProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  return (
    <div className="dialog-backdrop" onClick={busy ? undefined : onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="abandon-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="abandon-dialog-title">Abandon this investigation?</h3>
        <p>
          Case <strong>{investigation.caseId}</strong> will be closed and you will be able to start
          a different case. This cannot be undone from the investigation room.
        </p>
        <p className="muted">
          Your discovered evidence, journal notes and case history are kept in the archive and are
          not deleted.
        </p>
        {error && <div className="error">{error}</div>}
        <div className="button-row">
          <button type="button" className="small-button" onClick={onCancel} disabled={busy} autoFocus>
            Keep investigating
          </button>
          <button
            type="button"
            className="small-button small-button--danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Abandoning...' : 'Yes, abandon case'}
          </button>
        </div>
      </div>
    </div>
  );
}
