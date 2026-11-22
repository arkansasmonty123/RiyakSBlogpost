/**
 * Main Application Component
 * Routes between case list and investigation room.
 * Unauthenticated visitors get a minimal login/register form backed by the
 * real POST /api/login and POST /api/register endpoints.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { CaseListPage } from './pages/CaseListPage';
import { InvestigationRoomPage } from './pages/InvestigationRoomPage';
import { ArchivePage } from './pages/ArchivePage';
import { useSession } from './hooks/useSession';

type AuthAction = (email: string, password: string) => Promise<unknown>;

interface AuthFormProps {
  login: AuthAction;
  register: AuthAction;
}

const AuthForm = ({ login, register }: AuthFormProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
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
                <Link to="/archive">Archive</Link>
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
          {session.status === 'loading' ? (
            <div className="page-state" role="status">Loading session…</div>
          ) : session.status === 'unauthenticated' ? (
            <AuthForm login={login} register={register} />
          ) : (
            <Routes>
              <Route path="/" element={<CaseListPage />} />
              <Route path="/investigation/:caseId" element={<InvestigationRoomPage />} />
              <Route path="/archive" element={<ArchivePage />} />
            </Routes>
          )}
        </main>
      </div>
    </Router>
  );
};

export default App;