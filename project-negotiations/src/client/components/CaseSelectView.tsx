import { useMemo, useState } from 'react';
import type { CaseSummary, Difficulty, SessionView } from '@shared/types';
import { difficultyLabel } from '../utils';
import { SkeletonList } from './Skeleton';

interface Props {
  cases: CaseSummary[];
  activeSession: SessionView | null;
  busy: boolean;
  loading?: boolean;
  onStart: (caseId: string) => void;
  onResume: (session: SessionView) => void;
  onRefresh: () => void;
}

const ONBOARDING_KEY = 'tnt.onboarding.dismissed';

export function CaseSelectView({ cases, activeSession, busy, loading, onStart, onResume, onRefresh }: Props) {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_KEY) !== '1'; } catch { return true; }
  });
  const [search, setSearch] = useState('');
  const [difficulties, setDifficulties] = useState<Set<Difficulty>>(() => new Set());
  const [skills, setSkills] = useState<Set<string>>(() => new Set());

  const dismissOnboarding = () => {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* ignore */ }
    setShowOnboarding(false);
  };

  const difficultyOptions = useMemo(
    () => Array.from(new Set(cases.map((c) => c.difficulty))),
    [cases],
  );
  const skillOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const c of cases) for (const s of c.skills) seen.add(s);
    return Array.from(seen);
  }, [cases]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((c) => {
      if (q) {
        const haystack = `${c.title}\n${c.subtitle}\n${c.summary}\n${c.skills.join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (difficulties.size > 0 && !difficulties.has(c.difficulty)) return false;
      if (skills.size > 0 && !c.skills.some((s) => skills.has(s))) return false;
      return true;
    });
  }, [cases, search, difficulties, skills]);

  const showSkeletons = (busy || loading) && cases.length === 0;
  const noMatch = !showSkeletons && cases.length > 0 && visible.length === 0;
  const showFilters = cases.length > 0 && !showSkeletons;

  const clearFilters = () => {
    setSearch('');
    setDifficulties(new Set());
    setSkills(new Set());
  };

  const toggleDifficulty = (d: Difficulty) => {
    setDifficulties((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const toggleSkill = (s: string) => {
    setSkills((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  return (
    <div className="stack-lg">
      <section className="panel hero-panel">
        <p className="eyebrow">Choose your table</p>
        <h1 className="page-title">Every negotiation has a person on the other side.</h1>
        <p className="lede">
          Read both sides, prepare your strategy, and negotiate in a live room with distinct AI participants.
          The engine tracks commitments and outcomes - chat alone never creates an agreement.
        </p>
        <div className="hero-actions">
          <button type="button" className="btn btn-ghost" onClick={onRefresh} disabled={busy}>Refresh cases</button>
          {activeSession && (
            <button type="button" className="btn btn-primary" onClick={() => onResume(activeSession)} disabled={busy}>
              Resume active session
            </button>
          )}
        </div>
      </section>

      {showOnboarding && (
        <section className="panel onboarding-panel" aria-label="How to play">
          <div className="onboarding-head">
            <div>
              <p className="eyebrow">First time here</p>
              <h2>How a negotiation works</h2>
            </div>
            <button type="button" className="btn btn-ghost btn-small" onClick={dismissOnboarding}>Dismiss</button>
          </div>
          <ol className="onboarding-steps">
            <li><strong>Choose a case.</strong> Each case has different stakes, people, and pressure.</li>
            <li><strong>Read both briefings.</strong> You get your side and limited intelligence on theirs - secrets stay hidden until debrief.</li>
            <li><strong>Prepare.</strong> Set BATNA, reservation point, opening, questions, and predictions.</li>
            <li><strong>Negotiate.</strong> Speak naturally, target individuals or the group, and use structured offers for real commitments.</li>
            <li><strong>Review the debrief.</strong> See decision quality vs outcome quality, trust changes, hidden reveals, and evidence-based skill feedback.</li>
          </ol>
          <p className="small muted onboarding-note">Tip: Chat can persuade, but only engine-validated structured offers/acceptances create agreement.</p>
        </section>
      )}

      {activeSession && (
        <section className="panel resume-panel" aria-label="Active session">
          <div>
            <p className="eyebrow">Active session</p>
            <h2>{activeSession.case.title}</h2>
            <p className="muted">Status: {activeSession.status}. You can resume where you left off or start a different case.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => onResume(activeSession)} disabled={busy}>Resume</button>
        </section>
      )}

      {showFilters && (
        <section className="case-filters" aria-label="Case filters">
          <p className="filter-group-label">Search</p>
          <input
            className="input case-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, subtitle, summary, or skills…"
            aria-label="Search cases"
          />
          {difficultyOptions.length > 0 && (
            <>
              <p className="filter-group-label">Difficulty</p>
              <div className="chip-row" role="group" aria-label="Filter by difficulty">
                {difficultyOptions.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="chip"
                    aria-pressed={difficulties.has(d)}
                    onClick={() => toggleDifficulty(d)}
                  >
                    <span className="chip-dot" aria-hidden="true" />
                    {difficultyLabel(d)}
                  </button>
                ))}
              </div>
            </>
          )}
          {skillOptions.length > 0 && (
            <>
              <p className="filter-group-label">Skills</p>
              <div className="chip-row" role="group" aria-label="Filter by skill">
                {skillOptions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chip"
                    aria-pressed={skills.has(s)}
                    onClick={() => toggleSkill(s)}
                  >
                    {s.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {showSkeletons ? (
        <SkeletonList count={4} />
      ) : cases.length === 0 ? (
        <div className="panel empty-panel">No cases available.</div>
      ) : noMatch ? (
        <div className="panel empty-panel filters-empty" role="status">
          <h2>No cases match your filters</h2>
          <p className="muted">Try another search, or clear the filters to see every case.</p>
          <div className="actions-row">
            <button type="button" className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>
          </div>
        </div>
      ) : (
        <section aria-label="Available cases" className="case-grid">
          {visible.map((c) => (
            <article key={c.id} className="panel case-card">
              <div className="case-card-top">
                <span className={`difficulty-badge difficulty-${c.difficulty}`}>{difficultyLabel(c.difficulty)}</span>
                <span className="muted small">{c.estimatedMinutes} min</span>
              </div>
              <p className="eyebrow">{c.subtitle}</p>
              <h2 className="case-title">{c.title}</h2>
              <p className="muted">{c.summary}</p>
              <dl className="case-meta">
                <div><dt>Participants</dt><dd>{c.participantCount}</dd></div>
                <div><dt>Estimated time</dt><dd>{c.estimatedMinutes} min</dd></div>
              </dl>
              <div className="tag-row" aria-label="Skills">
                {c.skills.map((s) => <span key={s} className="tag">{s.replaceAll('_', ' ')}</span>)}
              </div>
              <div className="case-card-actions">
                <button type="button" className="btn btn-primary" onClick={() => onStart(c.id)} disabled={busy}>
                  Start negotiation
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
