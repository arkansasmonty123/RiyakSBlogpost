/**
 * Case List Page
 * Spoiler-free case library with search/filters, an active-investigation
 * banner (one active case at a time), and a link to the archive.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api';
import type { Case, Investigation } from '../api';

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [caseData, activeData] = await Promise.all([
          api.getCases(),
          api.getActiveInvestigation().catch((err: unknown) => {
            // 404 simply means no active investigation - not an error state.
            if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
              return null;
            }
            throw err;
          }),
        ]);
        if (!cancelled) {
          setCases(Array.isArray(caseData) ? caseData : []);
          setActive(activeData);
        }
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
    [cases]
  );
  const difficulties = useMemo(
    () => Array.from(new Set(cases.map((c) => c.difficulty).filter((d): d is string => !!d))).sort(),
    [cases]
  );

  const visibleCases = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return cases.filter((c) => {
      if (genre && c.genre !== genre) return false;
      if (difficulty && c.difficulty !== difficulty) return false;
      if (needle && !`${c.title} ${c.description ?? ''}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [cases, search, genre, difficulty]);

  if (isLoading) return <div className="page-state">Loading case library...</div>;
  if (error) return <div className="error">Error loading cases: {error}</div>;

  return (
    <div className="case-list page-enter">
      <div className="page-heading">
        <div>
          <h2>Case Library</h2>
          <p className="muted">Choose a mystery. You can only investigate one case at a time.</p>
        </div>
        <Link className="text-link" to="/archive">View archive</Link>
      </div>

      {justAbandoned && (
        <div className="success-banner" role="status">
          Investigation abandoned. Your notes and evidence history are preserved in the archive,
          and you can now start a new case.
        </div>
      )}

      {active && (
        <div className="active-banner" role="status">
          <div>
            <strong>Active investigation</strong>
            <p>Case {active.caseId} · {active.currentStage ?? 'In progress'}</p>
          </div>
          <Link className="button-link" to={`/investigation/${active.caseId}`}>
            Continue investigation
          </Link>
        </div>
      )}

      <div className="filters" role="search">
        <input
          type="search"
          placeholder="Search cases..."
          aria-label="Search cases"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Filter by genre" value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">All genres</option>
          {genres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          aria-label="Filter by difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">All difficulties</option>
          {difficulties.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        {(search || genre || difficulty) && (
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setSearch('');
              setGenre('');
              setDifficulty('');
            }}
          >
            Clear
          </button>
        )}
      </div>

      <p className="muted">Showing {visibleCases.length} of {cases.length} cases</p>

      {visibleCases.length === 0 ? (
        <div className="empty-state">No cases match your filters.</div>
      ) : (
        <div className="case-grid">
          {visibleCases.map((c) => {
            const isActive = active?.caseId === c.id;
            return (
              <div key={c.id} className="case-card">
                <div className="badges">
                  {c.genre && <span className="badge">{c.genre}</span>}
                  {c.difficulty && <span className="badge">{c.difficulty}</span>}
                  {c.duration && <span className="badge">{c.duration}</span>}
                </div>
                <h3>{c.title}</h3>
                <p>{c.briefing || c.description || 'No briefing available.'}</p>
                <Link className="button-link" to={`/investigation/${c.id}`}>
                  {isActive ? 'Continue investigation' : 'Start investigation'}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
