import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import type { Case, Investigation } from '../api';
import { useOnboarding } from '../hooks/useOnboarding';

const GUIDANCE_DISMISSED_KEY = 'investigation:onboarding-guidance-dismissed';

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong while loading the case library.';
}

function stageLabel(stage?: string): string {
  const value = String(stage ?? 'in_progress').replace(/_/g, ' ').trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'In progress';
}

function DocketSkeleton() {
  return (
    <div className="case-list page-enter" aria-busy="true" aria-live="polite">
      <div className="page-heading">
        <div>
          <h2>Case library</h2>
          <p className="muted">Opening the case desk…</p>
        </div>
      </div>
      <div className="docket" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="docket-row docket-row--skeleton">
            <span className="skeleton" style={{ width: 28, height: 12 }} />
            <span className="docket-row__main">
              <span className="skeleton" style={{ width: '52%', height: 24 }} />
              <span className="skeleton" style={{ width: '84%', height: 13, marginTop: 10 }} />
              <span className="skeleton" style={{ width: '68%', height: 13, marginTop: 6 }} />
            </span>
            <span className="skeleton" style={{ width: 150, height: 13 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const CaseListPage = () => {
  const [searchParams] = useSearchParams();
  const justAbandoned = searchParams.get('abandoned') === '1';
  const [cases, setCases] = useState<Case[]>([]);
  const [active, setActive] = useState<Investigation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const { state: onboarding } = useOnboarding();
  const [guidanceDismissed, setGuidanceDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(GUIDANCE_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const uid = useId();

  const isNewUser = !!onboarding && !onboarding.completed;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [caseData, activeData] = await Promise.all([
          api.getCases(),
          api.getActiveInvestigation().catch((err: unknown) => {
            if (err instanceof ApiError && err.status === 404) return null;
            throw err;
          }),
        ]);
        if (cancelled) return;
        setCases(Array.isArray(caseData) ? caseData : []);
        setActive(activeData);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const genres = useMemo(
    () => Array.from(new Set(cases.map((c) => c.genre).filter((g): g is string => !!g))).sort(),
    [cases],
  );
  const difficulties = useMemo(
    () => Array.from(new Set(cases.map((c) => c.difficulty).filter((d): d is string => !!d))).sort(),
    [cases],
  );
  const recommendedCase = useMemo(
    () => cases.find((c) => c.title === 'The Midnight Heist') ?? cases[0] ?? null,
    [cases],
  );
  const visibleCases = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return cases.filter((c) => {
      if (genre && c.genre !== genre) return false;
      if (difficulty && c.difficulty !== difficulty) return false;
      if (needle && !`${c.title} ${c.description ?? ''} ${c.briefing ?? ''}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [cases, search, genre, difficulty]);

  const dismissGuidance = () => {
    setGuidanceDismissed(true);
    try {
      window.localStorage.setItem(GUIDANCE_DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const clearFilters = () => {
    setSearch('');
    setGenre('');
    setDifficulty('');
  };

  if (isLoading) return <DocketSkeleton />;
  if (error) {
    return (
      <div className="case-list page-enter">
        <div className="page-heading">
          <div><h2>Case library</h2></div>
        </div>
        <div className="error" role="alert">
          <p>We couldn’t open the case desk. {error}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const activeCase = active ? cases.find((c) => c.id === active.caseId) : null;
  const hasFilters = Boolean(search || genre || difficulty);

  return (
    <div className="case-list page-enter">
      <div className="page-heading">
        <div>
          <h2>Case library</h2>
          <p className="muted">
            Each file is self-contained. Read the briefing, follow the evidence, and decide what you can prove. Only one investigation stays open at a time.
          </p>
        </div>
        <Link className="quiet-link case-archive-link" to="/archive">Closed cases</Link>
      </div>

      {justAbandoned && (
        <div className="success-banner" role="status">
          Investigation left open. Your notes and evidence are preserved in the archive, and you can start a new case.
        </div>
      )}

      {active && (
        <section className="active-banner" aria-label="Active investigation">
          <span className="active-banner__marker" aria-hidden="true" />
          <div className="active-banner__body">
            <span className="active-banner__label">On your desk</span>
            <strong className="active-banner__title">{activeCase?.title ?? 'Current case'}</strong>
            <span className="active-banner__detail">
              <span>{stageLabel(active.currentStage)}</span>
              {typeof active.progress === 'number' && (
                <span className="active-banner__progress">{Math.round(active.progress)}% complete</span>
              )}
            </span>
          </div>
          <Link
            className="btn btn-primary"
            to={`/investigation/${active.caseId}?investigation=${encodeURIComponent(active.id)}`}
          >
            Continue investigation
          </Link>
        </section>
      )}

      {isNewUser && !active && !guidanceDismissed && (
        <aside className="begin-guide" aria-label="How to begin">
          <div className="begin-guide__copy">
            <h3 className="begin-guide__title">Start here</h3>
            <p>
              Open a file, read the briefing, and examine the leads. Question people, test what they say against the evidence, and submit a verdict when your theory holds. Nothing is timed.
            </p>
          </div>
          <div className="begin-guide__actions">
            {recommendedCase && (
              <Link className="btn btn-primary" to={`/investigation/${recommendedCase.id}`}>
                Start with {recommendedCase.title}
              </Link>
            )}
            <button type="button" className="btn btn-ghost" onClick={dismissGuidance}>
              Not now
            </button>
          </div>
        </aside>
      )}

      <section className="case-controls" aria-labelledby={`${uid}-filters-title`}>
        <div className="case-controls__header">
          <h3 id={`${uid}-filters-title`} className="case-controls__title">Find a file</h3>
          <p className="case-count" aria-live="polite">
            {visibleCases.length} of {cases.length} {cases.length === 1 ? 'case' : 'cases'}
          </p>
        </div>

        <div className="filters" role="search" aria-label="Filter cases">
          <div className="filter-field">
            <label htmlFor={`${uid}-search`}>Search</label>
            <input
              id={`${uid}-search`}
              type="search"
              placeholder="Title, briefing, or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-field">
            <label htmlFor={`${uid}-genre`}>Genre</label>
            <select id={`${uid}-genre`} value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">All genres</option>
              {genres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor={`${uid}-difficulty`}>Difficulty</label>
            <select id={`${uid}-difficulty`} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">All difficulties</option>
              {difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {hasFilters && (
          <div className="case-controls__footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}
      </section>

      {visibleCases.length === 0 ? (
        <div className="empty-state" role="status">
          <h3>No files match those filters</h3>
          <p>Try a broader search, or clear a filter to see the full case library.</p>
          {hasFilters && (
            <button type="button" className="btn btn-secondary" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="docket" aria-label="Available cases">
          <div className="docket-head" aria-hidden="true">
            <span>No.</span>
            <span>Case file</span>
            <span>Details</span>
          </div>
          {visibleCases.map((c, index) => {
            const isActive = active?.caseId === c.id;
            const isRecommended = isNewUser && !active && recommendedCase?.id === c.id;
            const brief = c.briefing || c.description || 'No briefing has been filed for this case yet.';
            const href = `/investigation/${c.id}${isActive && active ? `?investigation=${encodeURIComponent(active.id)}` : ''}`;
            const rowClass = [
              'docket-row',
              isActive ? 'docket-row--active' : '',
              isRecommended ? 'docket-row--suggested' : '',
            ].filter(Boolean).join(' ');
            return (
              <Link key={c.id} className={rowClass} to={href}>
                <span className="docket-row__number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="docket-row__main">
                  <h3 className="docket-row__title">{c.title}</h3>
                  <span className="docket-row__brief" aria-hidden="true">{brief}</span>
                </span>
                <span className="docket-row__meta" aria-hidden="true">
                  {c.genre && <span>{c.genre}</span>}
                  {c.difficulty && <span>{c.difficulty}</span>}
                  {c.duration && <span>{c.duration}</span>}
                  {isActive && <span className="docket-row__flag">On your desk</span>}
                  {isRecommended && !isActive && <span className="docket-row__flag">Suggested first case</span>}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
