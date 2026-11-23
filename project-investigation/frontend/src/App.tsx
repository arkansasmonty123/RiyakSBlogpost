import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from './api';
import { CaseListPage } from './pages/CaseListPage';
import { InvestigationRoomPage } from './pages/InvestigationRoomPage';
import { ArchivePage } from './pages/ArchivePage';
import { PerspectiveLibraryPage } from './pages/PerspectiveLibraryPage';
import { PerspectiveExperiencePage } from './pages/PerspectiveExperiencePage';
import { KnowledgeJournalPage } from './pages/KnowledgeJournalPage';
import { ProgressPage } from './pages/ProgressPage';
import { LegalPage } from './pages/LegalPage';
import { SessionProvider, useSession } from './ui/session';
import { useOnboarding } from './ui/useOnboarding';
import { OnboardingOverlay } from './ui/OnboardingOverlay';

type AuthAction = (email: string, password: string, betaAccessCode?: string) => Promise<unknown>;

interface AuthFormProps {
  login: AuthAction;
  register: AuthAction;
  betaAccessRequired: boolean;
}

function AuthForm({ login, register, betaAccessRequired }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [betaAccessCode, setBetaAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const errorId = 'auth-error';

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
      setError(err instanceof Error ? err.message : 'We could not complete that request.');
      emailRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <div className="auth-page page-enter">
      <section className="auth-form" aria-labelledby="auth-title">
        <h1 id="auth-title">{isRegister ? 'Open your case desk' : 'Welcome back'}</h1>
        <p className="auth-form__intro">
          {isRegister
            ? 'An account keeps your briefings, notes, and verdicts together, so you can leave a case and pick it up later.'
            : 'Sign in to pick up your notes and the investigation you left open.'}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="auth-email">Email address</label>
            <input
              ref={emailRef}
              id="auth-email"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              name="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              spellCheck={false}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              required
            />
          </div>
          {isRegister && betaAccessRequired && (
            <div className="field">
              <label htmlFor="auth-beta-code">Invitation code</label>
              <input
                id="auth-beta-code"
                type="text"
                name="betaAccessCode"
                autoComplete="off"
                spellCheck={false}
                placeholder="The code in your invitation"
                value={betaAccessCode}
                onChange={(e) => setBetaAccessCode(e.target.value)}
                required
              />
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy
              ? isRegister ? 'Creating account…' : 'Signing in…'
              : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>
        {error && <p className="error" id={errorId} role="alert">{error}</p>}
        <p className="auth-form__switch">
          {isRegister ? 'Already have a desk? ' : 'New here? '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode(isRegister ? 'login' : 'register');
              setError(null);
            }}
          >
            {isRegister ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </section>
    </div>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link is-active' : 'nav-link';
}

function Protected({ children }: { children: ReactNode }) {
  const { session, login, register } = useSession();
  const [betaAccessRequired, setBetaAccessRequired] = useState(false);

  useEffect(() => {
    let active = true;
    void api.getPublicConfig()
      .then((config) => { if (active) setBetaAccessRequired(!!config.betaAccessRequired); })
      .catch(() => { /* safe default */ });
    return () => { active = false; };
  }, []);

  if (session.status === 'loading') {
    return <div className="page-state" role="status" aria-live="polite">Opening your desk…</div>;
  }
  if (session.status === 'unauthenticated') {
    return <AuthForm login={login} register={register} betaAccessRequired={betaAccessRequired} />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { session, logout } = useSession();
  const { state: onboarding, loading: onboardingLoading, patch: patchOnboarding } =
    useOnboarding(session.status === 'authenticated');
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [feedbackUrl, setFeedbackUrl] = useState('mailto:feedback@example.com');

  useEffect(() => {
    let active = true;
    void api.getPublicConfig()
      .then((config) => { if (active) setFeedbackUrl(config.feedbackUrl || 'mailto:feedback@example.com'); })
      .catch(() => { /* keep default */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setOnboardingDismissed(false);
  }, [session.user?.id]);

  const showOnboarding =
    session.status === 'authenticated' &&
    !onboardingLoading &&
    !!onboarding &&
    !onboarding.completed &&
    !onboardingDismissed;

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

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" to="/" aria-label="The Investigation, case library">
            <span className="brand__name">The Investigation</span>
          </Link>

          <nav className="site-nav" aria-label="Primary">
            {session.status === 'authenticated' ? (
              <>
                <NavLink to="/" end className={navClass}>Cases</NavLink>
                <NavLink to="/perspectives" className={navClass}>Perspectives</NavLink>
                <NavLink to="/knowledge" className={navClass}>Knowledge</NavLink>
                <NavLink to="/progress" className={navClass}>Progress</NavLink>
                <NavLink to="/archive" className={navClass}>Archive</NavLink>
                <button
                  type="button"
                  className="nav-guide-link"
                  onClick={() => void replayGuide()}
                >
                  Field guide
                </button>
                <span className="nav-user">
                  <span className="nav-user__email" title={session.user?.email ?? ''}>
                    {session.user?.email}
                  </span>
                  <button type="button" className="nav-signout" onClick={() => void logout()}>
                    Sign out
                  </button>
                </span>
              </>
            ) : null}
          </nav>
        </div>
      </header>

      <main id="main-content" className="app-main" tabIndex={-1}>
        <Routes>
          <Route path="/privacy" element={<LegalPage kind="privacy" feedbackUrl={feedbackUrl} />} />
          <Route path="/terms" element={<LegalPage kind="terms" feedbackUrl={feedbackUrl} />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="/" element={<Protected><CaseListPage /></Protected>} />
          <Route path="/perspectives" element={<Protected><PerspectiveLibraryPage /></Protected>} />
          <Route path="/perspectives/:experienceKey" element={<Protected><PerspectiveExperiencePage /></Protected>} />
          <Route path="/knowledge" element={<Protected><KnowledgeJournalPage /></Protected>} />
          <Route path="/progress" element={<Protected><ProgressPage /></Protected>} />
          <Route path="/investigation/:caseId" element={<Protected><InvestigationRoomPage /></Protected>} />
          <Route path="/archive" element={<Protected><ArchivePage /></Protected>} />
        </Routes>
      </main>

      <footer className="site-footer" aria-label="Site information">
        <div className="site-footer__inner">
          <span>The Investigation <span className="site-footer__beta">private beta</span></span>
          <nav className="site-footer__links" aria-label="Legal and feedback">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <a href={feedbackUrl} target="_blank" rel="noreferrer noopener">Send feedback</a>
          </nav>
        </div>
      </footer>

      {showOnboarding && (
        <OnboardingOverlay
          state={onboarding}
          onPatch={patchOnboarding}
          onDismiss={() => setOnboardingDismissed(true)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionProvider>
  );
}
