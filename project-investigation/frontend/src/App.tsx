/**
 * Main Application Component
 * Routes between case list and investigation room.
 * Unauthenticated visitors get a minimal login/register form backed by the
 * real POST /api/login and POST /api/register endpoints.
 */

import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { CaseListPage } from './pages/CaseListPage';
import { InvestigationRoomPage } from './pages/InvestigationRoomPage';
import { ArchivePage } from './pages/ArchivePage';
import { PerspectiveLibraryPage } from './pages/PerspectiveLibraryPage';
import { PerspectiveExperiencePage } from './pages/PerspectiveExperiencePage';
import { KnowledgeJournalPage } from './pages/KnowledgeJournalPage';
import { ProgressPage } from './pages/ProgressPage';
import { useSession } from './hooks/useSession';
import { useOnboarding } from './hooks/useOnboarding';
import { OnboardingOverlay } from './components/OnboardingOverlay';
import { LegalPage } from './pages/LegalPage';
import { api } from './api';

type AuthAction = (email: string, password: string, betaAccessCode?: string) => Promise<unknown>;

interface AuthFormProps {
  login: AuthAction;
  register: AuthAction;
  betaAccessRequired: boolean;
}

const AuthForm = ({ login, register, betaAccessRequired }: AuthFormProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [betaAccessCode, setBetaAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, betaAccessCode.trim() || undefined);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page page-enter">
      <div className="auth-form">
        <p className="auth-form__eyebrow">THE INVESTIGATION</p>
        <h2>{mode === 'login' ? 'Return to the case' : 'Begin your investigation'}</h2>
        <p className="auth-form__intro">
          {mode === 'login'
            ? 'Sign in to continue where you left off.'
            : 'Create an account to track evidence, theories, and verdicts.'}
        </p>
        <form onSubmit={handleSubmit} noValidate={false}>
          <label htmlFor="auth-email">
            Email
            <input
              id="auth-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="investigator@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label htmlFor="auth-password">
            Password
            <input
              id="auth-password"
              type="password"
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {mode === 'register' && betaAccessRequired && (
            <label htmlFor="auth-beta-code">
              Beta access code
              <input
                id="auth-beta-code"
                type="text"
                name="betaAccessCode"
                autoComplete="off"
                placeholder="Enter your invitation code"
                value={betaAccessCode}
                onChange={(e) => setBetaAccessCode(e.target.value)}
                required
              />
            </label>
          )}
          <button type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setMode((current) => (current === 'login' ? 'register' : 'login'));
            setError(null);
          }}
        >
          {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  );
};

const App = () => {
  const { session, login, register, logout } = useSession();
  // M8 Wave 1: first-run guide. Onboarding is cosmetic and best-effort - a
  // failed load simply means no guide is shown, and the user is never blocked.
  const { state: onboarding, loading: onboardingLoading, patch: patchOnboarding } =
    useOnboarding(session.status === 'authenticated');
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // M8-W7: public runtime config (feedback destination + optional beta gate).
  // Best-effort and never blocking: defaults keep the footer usable offline.
  const [feedbackUrl, setFeedbackUrl] = useState('mailto:feedback@example.com');
  const [betaAccessRequired, setBetaAccessRequired] = useState(false);
  useEffect(() => {
    let active = true;
    void api.getPublicConfig()
      .then((config) => {
        if (!active) return;
        setFeedbackUrl(config.feedbackUrl || 'mailto:feedback@example.com');
        setBetaAccessRequired(!!config.betaAccessRequired);
      })
      .catch(() => { /* non-critical: keep safe defaults */ });
    return () => { active = false; };
  }, []);

  // A new session (different signed-in user) gets a fresh chance to see the
  // guide; progress itself is remembered server-side via `lastStep`.
  useEffect(() => {
    setOnboardingDismissed(false);
  }, [session.user?.id]);

  const showOnboarding =
    session.status === 'authenticated' &&
    !onboardingLoading &&
    !!onboarding &&
    !onboarding.completed &&
    !onboardingDismissed;

  // Replay the first-experience guide. This only resets cosmetic UI state via
  // the existing PATCH API (no destructive confirmation, no gameplay impact).
  const replayGuide = async (): Promise<void> => {
    setOnboardingDismissed(false);
    await patchOnboarding({
      welcomeSeen: false,
      introCompleted: false,
      skipped: false,
      lastStep: null,
      tutorialState: { guideCompleted: false },
    });
  };

  // Legal pages are public; every other page requires a resolved session.
  const protectedPage = (node: ReactNode): ReactNode => {
    if (session.status === 'loading') {
      return <div className="page-state" role="status">Loading session…</div>;
    }
    if (session.status === 'unauthenticated') {
      return <AuthForm login={login} register={register} betaAccessRequired={betaAccessRequired} />;
    }
    return node;
  };

  return (
    <Router>
      <div className="app-shell">
        <div className="ambient-scene" aria-hidden="true">
          <div className="ambient-scene__wash" />
          <div className="ambient-scene__orb ambient-scene__orb--a" />
          <div className="ambient-scene__orb ambient-scene__orb--b" />
          <div className="ambient-scene__orb ambient-scene__orb--c" />
          <div className="ambient-scene__grain" />
        </div>
        <nav className="app-nav" aria-label="Primary">
          <div className="nav-left">
            <Link className="nav-brand" to="/" aria-label="THE INVESTIGATION home">
              <span className="nav-brand__mark" aria-hidden="true">TI</span>
              <span>
                <span className="nav-brand__name">THE INVESTIGATION</span>
                <span className="nav-brand__tag">Case files</span>
              </span>
            </Link>
          </div>
          <div className="nav-right">
            {session.status === 'authenticated' ? (
              <>
                <Link to="/">Case Library</Link>
                <Link to="/perspectives">Perspectives</Link>
                <Link to="/knowledge">Knowledge</Link>
                <Link to="/progress">Progress</Link>
                <Link to="/archive">Archive</Link>
                <button
                  type="button"
                  className="nav-guide-link"
                  onClick={() => void replayGuide()}
                  title="Replay the first-experience field guide"
                >
                  Replay guide
                </button>
                <div className="nav-user">
                  <span className="nav-user__email" title={session.user?.email}>
                    {session.user?.email}
                  </span>
                  <button type="button" onClick={() => void logout()}>Sign out</button>
                </div>
              </>
            ) : (
              <span className="muted">Not signed in</span>
            )}
          </div>
        </nav>

        <main className="app-main">
          <Routes>
            <Route path="/privacy" element={<LegalPage kind="privacy" feedbackUrl={feedbackUrl} />} />
            <Route path="/terms" element={<LegalPage kind="terms" feedbackUrl={feedbackUrl} />} />
            <Route path="/" element={protectedPage(<CaseListPage />)} />
            <Route path="/perspectives" element={protectedPage(<PerspectiveLibraryPage />)} />
            <Route path="/perspectives/:experienceKey" element={protectedPage(<PerspectiveExperiencePage />)} />
            <Route path="/knowledge" element={protectedPage(<KnowledgeJournalPage />)} />
            <Route path="/progress" element={protectedPage(<ProgressPage />)} />
            <Route path="/investigation/:caseId" element={protectedPage(<InvestigationRoomPage />)} />
            <Route path="/archive" element={protectedPage(<ArchivePage />)} />
          </Routes>
        </main>

        <footer className="app-footer" aria-label="Site information">
          <span>© {new Date().getFullYear()} THE INVESTIGATION · Beta</span>
          <nav className="app-footer__links" aria-label="Legal and feedback">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <a href={feedbackUrl} target="_blank" rel="noreferrer">Feedback</a>
          </nav>
        </footer>

        {showOnboarding && (
          <OnboardingOverlay
            state={onboarding}
            onPatch={patchOnboarding}
            onDismiss={() => setOnboardingDismissed(true)}
          />
        )}
      </div>
    </Router>
  );
};

export default App;