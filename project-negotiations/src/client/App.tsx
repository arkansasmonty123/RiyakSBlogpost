import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CaseSummary, DebriefReport, SessionView } from '@shared/types';
import { api } from './api';
import { BriefingView } from './components/BriefingView';
import { CaseSelectView } from './components/CaseSelectView';
import { DebriefView } from './components/DebriefView';
import { PreparationView } from './components/PreparationView';
import { RoomView } from './components/RoomView';
import { SkillsView } from './components/SkillsView';

type Screen = 'cases' | 'briefing' | 'preparation' | 'room' | 'debrief' | 'skills';

const SESSION_KEY = 'tnt.activeSessionId';

function screenForSession(session: SessionView): Screen {
  if (session.status === 'completed' || session.status === 'abandoned') return 'debrief';
  if (session.status === 'active') return 'room';
  if (session.status === 'preparation') return 'preparation';
  return 'briefing';
}

export function App() {
  const [screen, setScreen] = useState<Screen>('cases');
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [session, setSession] = useState<SessionView | null>(null);
  const [debrief, setDebrief] = useState<DebriefReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeCase = session?.case ?? null;

  const clearNotice = useCallback(() => setNotice(null), []);

  const loadCases = useCallback(async () => {
    const data = await api.listCases();
    setCases(data.cases);
    return data.cases;
  }, []);

  const openSession = useCallback(async (sessionId: string) => {
    const data = await api.getSession(sessionId);
    setSession(data.session);
    localStorage.setItem(SESSION_KEY, data.session.id);
    const next = screenForSession(data.session);
    if (next === 'debrief') {
      try {
        const d = await api.getDebrief(data.session.id);
        setDebrief(d.debrief);
      } catch {
        setDebrief(null);
      }
    } else {
      setDebrief(null);
    }
    setScreen(next);
    return data.session;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadCases();
        const stored = localStorage.getItem(SESSION_KEY);
        if (stored && !cancelled) {
          try {
            await openSession(stored);
          } catch {
            localStorage.removeItem(SESSION_KEY);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load.');
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCases, openSession]);

  const run = useCallback(async <T,>(fn: () => Promise<T>, okNotice?: string): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      if (okNotice) setNotice(okNotice);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const handleStartCase = useCallback(async (caseId: string) => {
    const result = await run(() => api.createSession(caseId));
    if (!result) return;
    setSession(result.session);
    setDebrief(null);
    localStorage.setItem(SESSION_KEY, result.session.id);
    setScreen('briefing');
  }, [run]);

  const handlePreparationSaved = useCallback(async (sessionId: string, preparation: Parameters<typeof api.savePreparation>[1], enterRoom: boolean) => {
    const result = await run(() => api.savePreparation(sessionId, preparation), enterRoom ? undefined : 'Preparation saved.');
    if (!result) return;
    setSession(result.session);
    if (enterRoom) setScreen('room');
  }, [run]);

  const handleSendMessage = useCallback(async (sessionId: string, input: Parameters<typeof api.sendMessage>[1]) => {
    const result = await run(() => api.sendMessage(sessionId, input));
    if (!result) return;
    setSession(result.session);
    if (result.session.status === 'completed' || result.session.status === 'abandoned') {
      try {
        const d = await api.getDebrief(result.session.id);
        setDebrief(d.debrief);
      } catch {
        setDebrief(null);
      }
      setScreen('debrief');
    }
    return result;
  }, [run]);

  const handleWalkAway = useCallback(async (sessionId: string) => {
    const result = await run(() => api.walkAway(sessionId));
    if (!result) return;
    setSession(result.session);
    try {
      const d = await api.finalize(sessionId);
      setSession(d.session);
      setDebrief(d.debrief);
    } catch {
      // debrief may be fetched later
    }
    setScreen('debrief');
  }, [run]);

  const handleFinalize = useCallback(async (sessionId: string) => {
    const result = await run(() => api.finalize(sessionId));
    if (!result) return;
    setSession(result.session);
    setDebrief(result.debrief);
    setScreen('debrief');
  }, [run]);

  const handleOpenDebrief = useCallback(async (sessionId: string) => {
    const result = await run<{ session?: SessionView; debrief: DebriefReport }>(async () => {
      try {
        return await api.getDebrief(sessionId);
      } catch {
        return await api.finalize(sessionId);
      }
    });
    if (!result) return;
    if (result.session) setSession(result.session);
    setDebrief(result.debrief);
    setScreen('debrief');
  }, [run]);

  const handleNewSessionSameCase = useCallback(async () => {
    if (!session) return;
    const caseId = session.caseId;
    localStorage.removeItem(SESSION_KEY);
    setDebrief(null);
    setSession(null);
    await handleStartCase(caseId);
  }, [session, handleStartCase]);

  const handleLeaveToCases = useCallback(() => {
    setScreen('cases');
    setError(null);
  }, []);

  const handleReset = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setDebrief(null);
    setError(null);
    setNotice(null);
    setScreen('cases');
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [screen, session?.id]);

  const title = useMemo(() => {
    switch (screen) {
      case 'cases': return 'Case Select';
      case 'briefing': return 'Two-Sided Briefing';
      case 'preparation': return 'Preparation';
      case 'room': return 'Negotiation Room';
      case 'debrief': return 'Debrief';
      case 'skills': return 'Skills';
    }
  }, [screen]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="topbar">
        <div className="brand" role="banner">
          <button type="button" className="brand-mark" onClick={handleLeaveToCases} aria-label="Go to case select">
            <span className="brand-kicker">Simulation</span>
            <span className="brand-title">The Negotiation Table</span>
          </button>
          {activeCase && <span className="brand-case">{activeCase.title}</span>}
        </div>
        <nav className="topnav" aria-label="Primary">
          <button type="button" className={screen === 'cases' ? 'nav-btn active' : 'nav-btn'} onClick={handleLeaveToCases}>Cases</button>
          <button type="button" className={screen === 'skills' ? 'nav-btn active' : 'nav-btn'} onClick={() => setScreen('skills')}>Skills</button>
          {session && (session.status === 'completed' || session.status === 'abandoned') && (
            <button type="button" className={screen === 'debrief' ? 'nav-btn active' : 'nav-btn'} onClick={() => void handleOpenDebrief(session.id)}>Debrief</button>
          )}
          {session && session.status !== 'completed' && session.status !== 'abandoned' && (
            <button type="button" className="nav-btn" onClick={() => setScreen(screenForSession(session))}>Resume</button>
          )}
          <button type="button" className="nav-btn nav-btn-muted" onClick={handleReset}>New session</button>
        </nav>
      </header>

      <div className="subbar">
        <div>
          <p className="eyebrow">{title}</p>
          {session && <p className="subbar-meta">Session <code>{session.id.slice(0, 8)}</code> · <span className={`status-pill status-${session.status}`}>{session.status}</span></p>}
        </div>
        {busy && <div className="busy-indicator" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" />Working…</div>}
      </div>

      {error && (
        <div className="banner banner-error" role="alert">
          <div>{error}</div>
          <button type="button" className="banner-close" onClick={() => setError(null)} aria-label="Dismiss error">×</button>
        </div>
      )}
      {notice && (
        <div className="banner banner-notice" role="status">
          <div>{notice}</div>
          <button type="button" className="banner-close" onClick={clearNotice} aria-label="Dismiss notice">×</button>
        </div>
      )}

      <main id="main-content" className="main-content">
        {booting ? (
          <div className="panel loading-panel" role="status" aria-live="polite">Loading negotiation table…</div>
        ) : screen === 'cases' ? (
          <CaseSelectView
            cases={cases}
            activeSession={session}
            busy={busy}
            onStart={handleStartCase}
            onResume={(s) => void openSession(s.id)}
            onRefresh={() => void run(loadCases)}
          />
        ) : screen === 'skills' ? (
          <SkillsView />
        ) : !session ? (
          <div className="panel empty-panel">
            <h2>No active session</h2>
            <p>Select a case to begin a negotiation.</p>
            <button type="button" className="btn btn-primary" onClick={() => setScreen('cases')}>Go to cases</button>
          </div>
        ) : screen === 'briefing' ? (
          <BriefingView session={session} onContinue={() => setScreen('preparation')} />
        ) : screen === 'preparation' ? (
          <PreparationView
            session={session}
            busy={busy}
            onSave={(prep, enterRoom) => void handlePreparationSaved(session.id, prep, enterRoom)}
            onBack={() => setScreen('briefing')}
          />
        ) : screen === 'room' ? (
          <RoomView
            session={session}
            busy={busy}
            onSend={(input) => handleSendMessage(session.id, input)}
            onWalkAway={() => void handleWalkAway(session.id)}
            onFinalize={() => void handleFinalize(session.id)}
            onViewDebrief={() => void handleOpenDebrief(session.id)}
          />
        ) : screen === 'debrief' ? (
          <DebriefView
            session={session}
            debrief={debrief}
            busy={busy}
            onLoad={() => void handleOpenDebrief(session.id)}
            onNewCase={handleLeaveToCases}
            onRetryCase={() => void handleNewSessionSameCase()}
          />
        ) : null}
      </main>
    </div>
  );
}
