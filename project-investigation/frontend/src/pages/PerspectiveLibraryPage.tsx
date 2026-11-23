import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import type {
  PerspectiveDiscovery,
  PerspectiveExperienceSummary,
  PerspectiveFramework,
} from '../api';
import '../features/support/support.css';

function humanize(value: string | undefined | null): string {
  if (!value) return '';

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

  if (loading) return <div className="support-page page-enter"><div className="page-state" role="status" aria-live="polite">Loading perspectives…</div></div>;
  if (error) return <div className="support-page page-enter"><div className="error" role="alert">Error loading perspectives: {error}</div></div>;

  return (
    <div className="perspectives-page support-page page-enter">
      <div className="page-heading">
        <div>
          <h2>Ways of seeing</h2>
          <p className="muted perspectives-page__lede">
            {discovery?.summary || 'Philosophical, psychological, historical, and scientific lenses for reflection. They are advisory — not evidence, not verdict inputs, and never the case solution.'}
          </p>
        </div>
        <Link className="text-link" to="/">Back to case library</Link>
      </div>

      <div className="perspective-disclaimer detail-card" role="note" aria-label="Perspective advisory">
        <strong>Advisory only.</strong>{' '}
        <span className="muted">
          {discovery?.disclaimer || 'Perspectives are for reflection and learning. They are not evidence, do not affect verdicts, and do not reveal the correct solution. You may disagree.'}
        </span>
      </div>

      {discovery && discovery.openingQuestions.length > 0 && (
        <section className="perspective-section" aria-labelledby="perspectives-opening">
          <div className="section-heading">
            <h3 id="perspectives-opening">Opening questions</h3>
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
                <span className="seal seal--accent">{q.frameworkName || frameworkName(frameworks, q.frameworkKey)}</span>
                <p>{q.question}</p>
                <span className="muted small-note">Explore this framework →</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="perspective-section" aria-labelledby="perspectives-frameworks">
        <div className="section-heading">
          <h3 id="perspectives-frameworks">Frameworks</h3>
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
        <section className="perspective-section" aria-labelledby="perspectives-featured">
          <div className="section-heading">
            <h3 id="perspectives-featured">Featured experiences</h3>
            <span className="muted">Curated entry points</span>
          </div>
          <div className="case-grid">
            {discovery.featured.map((item) => (
              <article key={item.experienceKey} className="case-card perspective-card">
                <span className="seal seal--accent">{frameworkName(frameworks, item.frameworkKey)}</span>
                <h3>{item.title}</h3>
                <p>{item.primaryQuestion}</p>
                <p className="perspective-catalog-card__meta">
                  {humanize(item.perspectiveClass)} · ~{item.estimatedMinutes} min
                </p>
                {item.scopeNote && <p className="muted small-note">{item.scopeNote}</p>}
                <div className="button-row">
                  <Link className="button-link" to={`/perspectives/${encodeURIComponent(item.experienceKey)}`}>Enter experience</Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="perspective-section" aria-labelledby="perspectives-catalog">
        <div className="section-heading">
          <h3 id="perspectives-catalog">All experiences</h3>
          <span className="muted">{filtered.length} of {experiences.length}</span>
        </div>

        <div className="filters" role="search" aria-label="Filter perspectives">
          <label className="field-label">
            Search
            <input
              type="search"
              placeholder="Questions, concepts, cases…"
              aria-label="Search perspectives"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="field-label">
            Framework
            <select aria-label="Filter by framework" value={frameworkFilter} onChange={(e) => setFrameworkFilter(e.target.value)}>
              <option value="">All frameworks</option>
              {frameworks.map((fw) => (
                <option key={fw.frameworkKey} value={fw.frameworkKey}>{fw.name}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Format
            <select aria-label="Filter by format" value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
              <option value="">All formats</option>
              {formats.map((f) => (
                <option key={f} value={f}>{humanize(f)}</option>
              ))}
            </select>
          </label>
          {hasActiveFilters && (
            <div className="button-row" style={{ alignSelf: 'end' }}>
              <button type="button" className="small-button" onClick={() => { setSearch(''); setFrameworkFilter(''); setFormatFilter(''); }}>
                Clear filters
              </button>
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No experiences match your filters</h3>
            <p className="muted">Try clearing a filter or searching for a broader concept.</p>
          </div>
        ) : (
          <div className="card-list">
            {filtered.map((e) => (
              <article key={e.experienceKey} className="detail-card perspective-catalog-card">
                <div className="perspective-catalog-card__main">
                  <span className="seal seal--accent">{frameworkName(frameworks, e.frameworkKey)}</span>
                  <h4><Link to={`/perspectives/${encodeURIComponent(e.experienceKey)}`}>{e.title}</Link></h4>
                  <p>{e.primaryQuestion}</p>
                  <p className="perspective-catalog-card__meta">
                    {humanize(e.format)} · {humanize(e.difficulty)} · ~{e.estimatedMinutes} min
                  </p>
                  {e.scopeNote && <p className="muted small-note">{e.scopeNote}</p>}
                  {e.keyConcepts.length > 0 && (
                    <div className="badges" aria-label="Key concepts">
                      {e.keyConcepts.slice(0, 3).map((c) => <span key={c} className="badge badge--soft">{c}</span>)}
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
        <section className="perspective-section" aria-labelledby="perspectives-connections">
          <div className="section-heading">
            <h3 id="perspectives-connections">Connections between ideas</h3>
            <span className="muted">Move across frameworks</span>
          </div>
          <div className="card-list">
            {discovery.connections.map((c: any, idx: number) => {
              const bridgeKey = String(c.bridgeKey ?? c.experienceKey ?? `conn-${idx}`);
              const kind = c.kind ? humanize(c.kind) : 'Connection';
              const label = String(c.label ?? c.title ?? 'Related perspective');
              const note = String(c.note ?? '');
              const frameworkKeys: string[] = Array.isArray(c.frameworkKeys)
                ? c.frameworkKeys
                : c.frameworkKey ? [String(c.frameworkKey)] : [];
              const experienceKey = typeof c.experienceKey === 'string' ? c.experienceKey : null;
              return (
                <article key={bridgeKey} className="detail-card">
                  <span className="seal seal--accent">{kind}</span>
                  {frameworkKeys.length > 0 && (
                    <p className="muted small-note">
                      {frameworkKeys.map((fk) => frameworkName(frameworks, fk)).join(' · ')}
                    </p>
                  )}
                  <h4>{label}</h4>
                  {note ? <p className="muted">{note}</p> : null}
                  <div className="button-row">
                    {experienceKey ? (
                      <Link className="small-button" to={`/perspectives/${encodeURIComponent(experienceKey)}`}>Open</Link>
                    ) : null}
                    {frameworkKeys.map((fk) => (
                      <button
                        key={fk}
                        type="button"
                        className="small-button"
                        onClick={() => {
                          setFrameworkFilter(fk);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        View {frameworkName(frameworks, fk)}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
