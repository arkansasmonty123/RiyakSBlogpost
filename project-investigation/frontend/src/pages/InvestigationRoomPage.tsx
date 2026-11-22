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

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Case,
  ChatMessage,
  CheckpointState,
  Development,
  Evidence,
  Investigation,
  InvestigationStats,
  JournalEntry,
  NotificationSettings,
  ScheduledEvent,
  Solution,
  Suspect,
  VerdictOutcome,
  VerdictResult,
} from '../api';
import { SolutionPanel } from '../components/SolutionPanel';
import { AchievementsPanel } from '../components/AchievementsPanel';

type Tab =
  | 'chat'
  | 'evidence'
  | 'suspects'
  | 'timeline'
  | 'journal'
  | 'deductions'
  | 'accuse'
  | 'achievements';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'chat', label: 'Group Chat' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'suspects', label: 'Suspect Board' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'journal', label: 'Journal' },
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
      setSuspects([]);
      setOpenQuestions([]);
      setTheoryFeedback([]);
      setSelectedCheckpoint('');
      setSelectedTheoryEvidence([]);
      setTheoryText('');

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

        const [evidenceData, suspectBoardData, conversation, journalData, eventData, accusationData, checkpointData, developmentData, notificationSettingsData] =
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
        const firstOpen = checkpointData?.checkpoints.find((cp) => !cp.completed);
        setSelectedCheckpoint(firstOpen?.id ?? checkpointData?.checkpoints[0]?.id ?? '');

        // GAP-13: load server-awarded achievements for this investigation.
        if (cancelled) return;
        await loadAchievements(inv.id);
        // P2-POLISH: load the compact stats summary for the room header card.
        if (cancelled) return;
        await loadStats(inv.id);

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
  }, [caseId, investigationParam, loadSolution, loadAchievements, loadStats]);

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

      {actionError && <div className="error">{actionError}</div>}

      {stats && <StatsPanel stats={stats} />}

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

      <nav className="tabs" aria-label="Investigation sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'tab tab--active' : 'tab'}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="tab-panel" key={activeTab}>
        {activeTab === 'chat' && (
          <section>
            <h3>Group Chat</h3>
            <div className="chat-area" id="chat-area" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation">
              {messages.length === 0 && !chatError && (
                <p className="chat-empty">No messages yet. Ask the team a question to begin.</p>
              )}
              {messages.map((message, index) => (
                <div
                  key={`${message.timestamp}-${index}`}
                  className={`chat-message chat-message--${message.role}`}
                >
                  <span className="chat-message__role">
                    {message.role === 'player'
                      ? 'You'
                      : (message.responderLabel ?? 'Investigator')}:{' '}
                  </span>
                  <span className="chat-message__content">{displayChatContent(message)}</span>
                </div>
              ))}
            </div>
            {chatError && <div className="error">{chatError}</div>}
            <form className="chat-input" onSubmit={sendMessage}>
              <input
                type="text"
                placeholder={caseClosed ? 'This case is closed.' : 'Message the investigative team...'}
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

        {activeTab === 'evidence' && (
          <section>
            <div className="section-heading">
              <h3>Evidence Room</h3>
              <span className="muted">
                {discoveredIds.size} examined · {evidence.length} visible
              </span>
            </div>
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
          <SuspectBoardPanel suspects={suspects} openQuestions={openQuestions} />
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
                  </article>
                ))}
              </div>
            )}
          </section>
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
                      disabled={actionBusy !== null || caseClosed}
                      onClick={() => void performAction(action.action)}
                    >
                      {actionBusy === action.action ? 'Working...' : action.label}
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
      {abandonDialog}
    </div>
  );

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

    setSending(true);
    setChatError(null);
    setMessageInput('');

    const optimistic: ChatMessage = {
      role: 'player',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((previous) => [...previous, optimistic]);

    try {
      const reply = await api.sendChat(investigation.id, text);
      setMessages((previous) => [...previous, reply]);
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

function formatElapsed(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  const remainder = seconds % 60;
  return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

// P2-POLISH: compact, read-only stats card. Every value arrives from the
// server's allowlisted stats DTO; nothing here derives data from canonical
// truth or hidden evidence, and no value is editable by the client.
function StatsPanel({ stats }: { stats: InvestigationStats }) {
  const statusLabel = stats.status
    ? stats.status.charAt(0).toUpperCase() + stats.status.slice(1).replace(/_/g, ' ')
    : 'Unknown';
  const items: Array<{ label: string; value: string }> = [
    { label: 'Progress', value: `${Math.min(100, Math.max(0, stats.progress))}%` },
    {
      label: 'Evidence',
      value: `${stats.evidence.discovered} / ${stats.evidence.total}`,
    },
    {
      label: 'Checkpoints',
      value: `${stats.checkpoints.answered} / ${stats.checkpoints.total}`,
    },
    { label: 'Accusations', value: String(stats.accusations) },
    { label: 'Achievements', value: String(stats.achievements) },
    { label: 'Time elapsed', value: formatElapsed(stats.elapsedSeconds) },
  ];

  return (
    <section className="stats-panel" aria-label="Investigation statistics">
      <div className="section-heading">
        <h3>Case statistics</h3>
        <span className="badge">{statusLabel}</span>
      </div>
      <dl className="stats-grid">
        {items.map((item) => (
          <div className="stats-grid__item" key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

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
