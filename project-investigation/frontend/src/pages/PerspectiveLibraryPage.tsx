import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import type {
  PerspectiveDiscovery,
  PerspectiveExperienceSummary,
  PerspectiveFramework,
} from '../api';

function humanize(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function frameworkName(frameworks: PerspectiveFramework[], key: string): string {
  return frameworks.find((f) => f.frameworkKey === key)?.name ?? humanize(key);
}

export const PerspectiveLibraryPage = () => {
  const [frameworks, setFrameworks] = useState<PerspectiveFramework[]>([]);
  const [discovery, setDiscovery] = useState<PerspectiveDiscovery | null>(null);
  const [experiences, setExperiences] = useState<PerspectiveExperienceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [frameworkFilter, setFrameworkFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [fwRes, discRes, expRes] = await Promise.all([
          api.getPerspectiveFrameworks(),
          api.discoverPerspectives(),
          api.getPerspectives(),
        ]);
        if (cancelled) return;
        setFrameworks(Array.isArray(fwRes.frameworks) ? fwRes.frameworks : []);
        setDiscovery(discRes);
        setExperiences(Array.isArray(expRes.experiences) ? expRes.experiences : []);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const formats = useMemo(
    () => Array.from(new Set(experiences.map((e) => e.format).filter(Boolean))).sort(),
    [experiences]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return experiences.filter((e) => {
      if (frameworkFilter && e.frameworkKey !== frameworkFilter) return false;
      if (formatFilter && e.format !== formatFilter) return false;
      if (needle) {
        const haystack = [
          e.title, e.primaryQuestion, e.scopeNote, e.intellectualPurpose,
          e.frameworkKey, ...e.keyConcepts, ...e.relatedCaseTitles,
        ].join(' ').toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [experiences, frameworkFilter, formatFilter, search]);

  const hasActiveFilters = Boolean(search.trim() || frameworkFilter || formatFilter);

  if (loading) return <div className="page-state">Loading perspectives…</div>;
  if (error) return <div className="error">Error loading perspectives: {error}</div>;

  return (
    <div className="perspectives-page page-enter">
      <div className="page-heading">
        <div>
          <p className="auth-form__eyebrow">Perspective Engine</p>
          <h2>Ways of seeing</h2>
          <p className="muted perspectives-page__lede">
            {discovery?.summary || 'Explore philosophical, psychological, historical, and scientific lenses. These perspectives are advisory — they never serve as evidence, never affect verdicts, and never reveal case truth.'}
          </p>
        </div>
      </div>

      <div className="perspective-disclaimer detail-card" role="note" aria-label="Perspective advisory">
        <strong>Advisory only.</strong>{' '}
        <span className="muted">
          {discovery?.disclaimer || 'Perspectives are for reflection and learning. They are not evidence, do not affect verdicts, and do not reveal the correct solution. You may disagree.'}
        </span>
      </div>

      {discovery && discovery.openingQuestions.length > 0 && (
        <section className="perspective-section" aria-label="Opening questions">
          <div className="section-heading">
            <h3>Opening questions</h3>
            <span className="muted">A place to begin, not a syllabus</span>
          </div>
          <div className="perspective-question-grid">
            {discovery.openingQuestions.map((q, i) => (
              <button
                key={`${q.frameworkKey}-${i}`}
                type="button"
                className="perspective-question-card"
                onClick={() => setFrameworkFilter(q.frameworkKey)}
              >
                <span className="badge badge--soft">{q.frameworkName || frameworkName(frameworks, q.frameworkKey)}</span>
                <p>{q.question}</p>
                <span className="muted small-note">Explore this framework →</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="perspective-section" aria-label="Frameworks">
        <div className="section-heading">
          <h3>Frameworks</h3>
          <span className="muted">{frameworks.length} lens{frameworks.length === 1 ? '' : 'es'}</span>
        </div>
        <div className="perspective-framework-grid">
          <button
            type="button"
            className={!frameworkFilter ? 'perspective-framework-chip perspective-framework-chip--active' : 'perspective-framework-chip'}
            aria-pressed={!frameworkFilter}
            onClick={() => setFrameworkFilter('')}
          >
            <span className="perspective-framework-chip__name">All frameworks</span>
            <span className="muted small-note">{experiences.length} experiences</span>
          </button>
          {frameworks.map((fw) => {
            const count = experiences.filter((e) => e.frameworkKey === fw.frameworkKey).length;
            const active = frameworkFilter === fw.frameworkKey;
            return (
              <button
                key={fw.frameworkKey}
                type="button"
                className={active ? 'perspective-framework-chip perspective-framework-chip--active' : 'perspective-framework-chip'}
                aria-pressed={active}
                onClick={() => setFrameworkFilter(active ? '' : fw.frameworkKey)}
                title={fw.summary}
              >
                <span className="perspective-framework-chip__name">{fw.name}</span>
                <span className="muted small-note">{fw.intellectualDomain} · {count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {discovery && discovery.featured.length > 0 && !hasActiveFilters && (
        <section className="perspective-section" aria-label="Featured experiences">
          <div className="section-heading">
            <h3>Featured experiences</h3>
            <span className="muted">Curated entry points</span>
          </div>
          <div className="case-grid">
            {discovery.featured.map((item) => (
              <article key={item.experienceKey} className="case-card perspective-card">
                <div className="badges">
                  <span className="badge">{frameworkName(frameworks, item.frameworkKey)}</span>
                  <span className="badge badge--soft">{humanize(item.perspectiveClass)}</span>
                  <span className="badge badge--soft">~{item.estimatedMinutes} min</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.primaryQuestion}</p>
                {item.scopeNote && <p className="muted small-note">{item.scopeNote}</p>}
                <Link className="button-link" to={`/perspectives/${encodeURIComponent(item.experienceKey)}`}>
                  Enter experience
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="perspective-section" aria-label="Experience catalog">
        <div className="section-heading">
          <h3>All experiences</h3>
          <span className="muted">{filtered.length} of {experiences.length}</span>
        </div>

        <div className="filters" role="search" aria-label="Filter perspectives">
          <input
            type="search"
            placeholder="Search questions, concepts, cases..."
            aria-label="Search perspectives"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select aria-label="Filter by framework" value={frameworkFilter} onChange={(e) => setFrameworkFilter(e.target.value)}>
            <option value="">All frameworks</option>
            {frameworks.map((fw) => (
              <option key={fw.frameworkKey} value={fw.frameworkKey}>{fw.name}</option>
            ))}
          </select>
          <select aria-label="Filter by format" value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
            <option value="">All formats</option>
            {formats.map((f) => (
              <option key={f} value={f}>{humanize(f)}</option>
            ))}
          </select>
          {hasActiveFilters && (
            <button type="button" className="link-button" onClick={() => { setSearch(''); setFrameworkFilter(''); setFormatFilter(''); }}>
              Clear
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">No experiences match your filters.</div>
        ) : (
          <div className="card-list">
            {filtered.map((e) => (
              <article key={e.experienceKey} className="detail-card perspective-catalog-card">
                <div className="perspective-catalog-card__main">
                  <div className="badges">
                    <span className="badge">{frameworkName(frameworks, e.frameworkKey)}</span>
                    <span className="badge badge--soft">{humanize(e.format)}</span>
                    <span className="badge badge--soft">{humanize(e.difficulty)}</span>
                    <span className="badge badge--soft">~{e.estimatedMinutes} min</span>
                  </div>
                  <h4><Link to={`/perspectives/${encodeURIComponent(e.experienceKey)}`}>{e.title}</Link></h4>
                  <p>{e.primaryQuestion}</p>
                  <p className="muted small-note">{e.scopeNote}</p>
                  {e.keyConcepts.length > 0 && (
                    <div className="badges" aria-label="Key concepts">
                      {e.keyConcepts.slice(0, 5).map((c) => <span key={c} className="badge badge--soft">{c}</span>)}
                    </div>
                  )}
                </div>
                <div className="perspective-catalog-card__action">
                  <Link className="small-button" to={`/perspectives/${encodeURIComponent(e.experienceKey)}`}>Open</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {discovery && discovery.connections.length > 0 && (
        <section className="perspective-section" aria-label="Connections">
          <div className="section-heading">
            <h3>Connections between ideas</h3>
            <span className="muted">Move across frameworks</span>
          </div>
          <div className="card-list">
            {discovery.connections.map((c) => (
              <article key={c.bridgeKey} className="detail-card">
                <div className="badges">
                  <span className="badge">{humanize(c.kind)}</span>
                  {c.frameworkKeys.map((fk) => <span key={fk} className="badge badge--soft">{frameworkName(frameworks, fk)}</span>)}
                </div>
                <h4>{c.label}</h4>
                <p className="muted">{c.note}</p>
                {c.frameworkKeys.length > 0 && (
                  <div className="button-row">
                    {c.frameworkKeys.map((fk) => (
                      <button key={fk} type="button" className="link-button" onClick={() => { setFrameworkFilter(fk); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                        View {frameworkName(frameworks, fk)}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};