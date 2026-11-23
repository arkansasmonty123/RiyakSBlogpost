import { Fragment, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api';
import type {
  PerspectiveConnections,
  PerspectiveExperienceDetail,
  PerspectiveReflection,
  PerspectiveReflectionKind,
} from '../api';

function humanize(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const REFLECTION_KINDS: Array<{ value: PerspectiveReflectionKind; label: string }> = [
  { value: 'reflection', label: 'Reflection' },
  { value: 'argument_for', label: 'Argument for' },
  { value: 'argument_against', label: 'Argument against' },
  { value: 'assumption', label: 'Assumption' },
  { value: 'open_question', label: 'Open question' },
  { value: 'alternative_interpretation', label: 'Alternative interpretation' },
  { value: 'disagreement', label: 'Disagreement' },
  { value: 'hypothesis_reconsideration', label: 'Hypothesis reconsideration' },
];

function formatDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export const PerspectiveExperiencePage = () => {
  const { experienceKey } = useParams<{ experienceKey: string }>();
  const [experience, setExperience] = useState<PerspectiveExperienceDetail | null>(null);
  const [connections, setConnections] = useState<PerspectiveConnections | null>(null);
  const [reflections, setReflections] = useState<PerspectiveReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [reflectionKind, setReflectionKind] = useState<PerspectiveReflectionKind>('reflection');
  const [reflectionPromptIndex, setReflectionPromptIndex] = useState<number | ''>('');
  const [savingReflection, setSavingReflection] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [reflectionNotice, setReflectionNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!experienceKey) return;
      setLoading(true);
      setError(null);
      try {
        const [detail, conn, refl] = await Promise.all([
          api.getPerspective(experienceKey),
          api.getPerspectiveConnections(experienceKey).catch(() => null),
          api.getPerspectiveReflections({ experienceKey }).catch(() => ({ reflections: [] })),
        ]);
        if (cancelled) return;
        setExperience(detail);
        setConnections(conn);
        setReflections(Array.isArray(refl.reflections) ? refl.reflections : []);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [experienceKey]);

  const epistemicEntries = useMemo(() => {
    if (!experience?.epistemicBreakdown) return [];
    return Object.entries(experience.epistemicBreakdown).filter(([, v]) => typeof v === 'string' && v.trim());
  }, [experience]);

  async function submitReflection(e: FormEvent) {
    e.preventDefault();
    if (!experienceKey || !reflectionText.trim() || savingReflection) return;
    setSavingReflection(true);
    setReflectionError(null);
    setReflectionNotice(null);
    try {
      const promptIndex = reflectionPromptIndex === '' ? null : reflectionPromptIndex;
      const prompt = promptIndex !== null ? experience?.reflectionQuestions[promptIndex] : undefined;
      const res = await api.createPerspectiveReflection(experienceKey, {
        response: reflectionText.trim(),
        promptIndex,
        prompt,
        reflectionKind,
      });
      setReflections((prev) => [res.reflection, ...prev]);
      setReflectionText('');
      setReflectionPromptIndex('');
      setReflectionKind('reflection');
      setReflectionNotice('Reflection saved to your perspective notes.');
    } catch (err) {
      setReflectionError(errorMessage(err));
    } finally {
      setSavingReflection(false);
    }
  }

  async function removeReflection(id: string) {
    if (!window.confirm('Delete this reflection?')) return;
    try {
      await api.deletePerspectiveReflection(id);
      setReflections((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setReflectionError(errorMessage(err));
    }
  }

  if (loading) return <div className="page-state">Loading perspective…</div>;
  if (error) return <div className="error">Error loading perspective: {error}</div>;
  if (!experience) return <div className="error">Perspective not found.</div>;

  return (
    <div className="perspective-detail page-enter">
      <div className="page-heading">
        <div>
          <p className="auth-form__eyebrow">Perspective Experience</p>
          <h2>{experience.title}</h2>
          <p className="muted">{experience.primaryQuestion}</p>
        </div>
        <Link className="text-link" to="/perspectives">Back to perspectives</Link>
      </div>

      <div className="perspective-disclaimer detail-card" role="note" aria-label="Perspective advisory">
        <strong>Advisory only.</strong>{' '}
        <span className="muted">
          {experience.disclaimer || 'This perspective is not evidence, does not affect verdicts, and does not reveal the correct solution. You may disagree.'}
        </span>
      </div>

      <div className="perspective-detail__layout">
        <article className="perspective-detail__main">
          <section className="detail-card perspective-reading-section">
            <div className="badges">
              <span className="badge">{experience.framework?.name || humanize(experience.frameworkKey)}</span>
              <span className="badge badge--soft">{humanize(experience.format)}</span>
              <span className="badge badge--soft">{humanize(experience.difficulty)}</span>
              <span className="badge badge--soft">~{experience.estimatedMinutes} min</span>
              <span className="badge badge--soft">{humanize(experience.knowledgeClass)}</span>
            </div>
            {experience.scopeNote && <p className="muted"><strong>Scope:</strong> {experience.scopeNote}</p>}
            {experience.traditionScope && <p className="muted"><strong>Tradition/scope:</strong> {experience.traditionScope}</p>}
            {experience.intellectualPurpose && <p><strong>Why this matters:</strong> {experience.intellectualPurpose}</p>}
          </section>

          {experience.introduction && (
            <section className="detail-card perspective-reading-section">
              <h3>Introduction</h3>
              <p className="solution-prose">{experience.introduction}</p>
            </section>
          )}

          {experience.intellectualBackground && (
            <section className="detail-card perspective-reading-section">
              <h3>Intellectual background</h3>
              <p className="solution-prose">{experience.intellectualBackground}</p>
            </section>
          )}

          {experience.mainIdea && (
            <section className="detail-card perspective-reading-section">
              <h3>Main idea</h3>
              <p className="solution-prose">{experience.mainIdea}</p>
            </section>
          )}

          {experience.detailedExplanation && (
            <section className="detail-card perspective-reading-section">
              <h3>Detailed explanation</h3>
              <p className="solution-prose">{experience.detailedExplanation}</p>
            </section>
          )}

          {experience.sections?.length > 0 && experience.sections.map((section, i) => (
            <section key={`${section.heading}-${i}`} className="detail-card perspective-reading-section">
              <h3>{section.heading}</h3>
              <p className="solution-prose">{section.body}</p>
            </section>
          ))}

          {experience.historicalContext && (
            <section className="detail-card perspective-reading-section">
              <h3>Historical context</h3>
              <p className="solution-prose">{experience.historicalContext}</p>
            </section>
          )}

          {epistemicEntries.length > 0 && (
            <section className="detail-card perspective-reading-section" aria-label="Epistemic breakdown">
              <h3>Epistemic breakdown</h3>
              <p className="muted">What is established, interpreted, contested, or personally held in this perspective.</p>
              <dl className="disagreement-meta">
                {epistemicEntries.map(([key, value]) => (
                  <Fragment key={key}>
                    <dt>{humanize(key)}</dt>
                    <dd>{String(value)}</dd>
                  </Fragment>
                ))}
              </dl>
            </section>
          )}

          {(experience.limitations.length > 0 || experience.counterarguments.length > 0 || experience.commonMisconceptions.length > 0) && (
            <section className="detail-card perspective-reading-section">
              <h3>Limits and counterpoints</h3>
              {experience.limitations.length > 0 && (
                <>
                  <h4>Limitations</h4>
                  <ul className="specialist-list">{experience.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </>
              )}
              {experience.counterarguments.length > 0 && (
                <>
                  <h4>Counterarguments</h4>
                  <ul className="specialist-list">{experience.counterarguments.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </>
              )}
              {experience.commonMisconceptions.length > 0 && (
                <>
                  <h4>Common misconceptions</h4>
                  <ul className="specialist-list">{experience.commonMisconceptions.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </>
              )}
            </section>
          )}

          {experience.reflectionQuestions.length > 0 && (
            <section className="detail-card perspective-reading-section">
              <h3>Reflection questions</h3>
              <ol className="specialist-list">
                {experience.reflectionQuestions.map((q, i) => <li key={i}>{q}</li>)}
              </ol>
            </section>
          )}

          {experience.activities.length > 0 && (
            <section className="detail-card perspective-reading-section">
              <h3>Activities</h3>
              <p className="muted">Optional exercises. They are for reflection only and do not affect case progress.</p>
              <div className="card-list">
                {experience.activities.map((activity, i) => (
                  <details key={i} className="detail-card perspective-activity">
                    <summary>Activity {i + 1}</summary>
                    <p className="solution-prose">{activity}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {experience.supportingSources.length > 0 && (
            <section className="detail-card perspective-reading-section" aria-label="Supporting sources">
              <h3>Supporting sources</h3>
              <p className="muted">Sources are shown with verification status. Unverified URLs are never linked.</p>
              <div className="card-list">
                {experience.supportingSources.map((source, i) => {
                  const verifiedLink = Boolean(source.sourceVerified && source.url);
                  return (
                    <article key={`${source.label}-${i}`} className="detail-card">
                      <div className="badges">
                        <span className="badge">{humanize(source.sourceType || 'source')}</span>
                        <span className={source.sourceVerified ? 'badge badge--confirmed' : 'badge badge--warning'}>
                          {source.sourceVerified ? 'Verified' : 'Unverified'}
                        </span>
                        {source.verificationStatus && <span className="badge badge--soft">{humanize(String(source.verificationStatus))}</span>}
                      </div>
                      <h4>{source.label}</h4>
                      <p className="muted">
                        {[source.author, source.title].filter(Boolean).join(' — ') || 'Bibliographic information as provided.'}
                      </p>
                      {(source.verificationNotes || source.notes) && (
                        <p className="muted small-note"><strong>Provenance note:</strong> {source.verificationNotes || source.notes}</p>
                      )}
                      {source.quote && <p className="muted"><strong>Short excerpt:</strong> “{source.quote}”</p>}
                      {verifiedLink ? (
                        <p><a href={String(source.url)} target="_blank" rel="noopener noreferrer">Open verified source</a></p>
                      ) : source.url ? (
                        <p className="muted small-note">URL withheld until verification is complete.</p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </article>

        <aside className="perspective-detail__aside" aria-label="Reflection and connections">
          <section className="detail-card reality-form">
            <h3>Save a reflection</h3>
            <p className="muted small-note">
              Reflections are personal and advisory. They are not evidence and do not affect case verdicts.
            </p>
            <form onSubmit={submitReflection} className="perspective-reflection-form">
              <label className="field-label">Reflection kind
                <select value={reflectionKind} onChange={(e) => setReflectionKind(e.target.value as PerspectiveReflectionKind)}>
                  {REFLECTION_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </label>
              <label className="field-label">Prompt (optional)
                <select value={reflectionPromptIndex} onChange={(e) => setReflectionPromptIndex(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">No specific prompt</option>
                  {experience.reflectionQuestions.map((q, i) => <option key={i} value={i}>{q.slice(0, 90)}{q.length > 90 ? '…' : ''}</option>)}
                </select>
              </label>
              <label className="field-label">Your response
                <textarea value={reflectionText} onChange={(e) => setReflectionText(e.target.value)} rows={5} maxLength={4000} required />
              </label>
              {reflectionError && <div className="error">{reflectionError}</div>}
              {reflectionNotice && <p className="muted" role="status">{reflectionNotice}</p>}
              <button type="submit" className="small-button" disabled={savingReflection || !reflectionText.trim()}>
                {savingReflection ? 'Saving…' : 'Save reflection'}
              </button>
            </form>
          </section>

          <section className="detail-card">
            <div className="section-heading">
              <h3>Your reflections</h3>
              <span className="muted">{reflections.length}</span>
            </div>
            {reflections.length === 0 ? (
              <p className="muted">No reflections saved yet.</p>
            ) : (
              <div className="card-list">
                {reflections.map((r) => (
                  <article key={r.id} className="detail-card">
                    <div className="badges">
                      <span className="badge badge--soft">{humanize(r.reflectionKind)}</span>
                      {r.investigationId && <span className="badge badge--soft">Case-linked</span>}
                    </div>
                    {r.prompt && <p className="muted small-note"><strong>Prompt:</strong> {r.prompt}</p>}
                    <p>{r.response}</p>
                    <div className="button-row">
                      <span className="muted small-note">{formatDate(r.updatedAt || r.createdAt)}</span>
                      <button type="button" className="link-button link-button--danger" onClick={() => void removeReflection(r.id)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {experience.keyConcepts.length > 0 && (
            <section className="detail-card">
              <h3>Key concepts</h3>
              <div className="badges">{experience.keyConcepts.map((c) => <span key={c} className="badge badge--soft">{c}</span>)}</div>
            </section>
          )}

          {connections && connections.relatedExperiences.length > 0 && (
            <section className="detail-card">
              <h3>Related experiences</h3>
              <div className="card-list">
                {connections.relatedExperiences.map((r) => (
                  <article key={r.experienceKey} className="detail-card">
                    <div className="badges">
                      <span className="badge badge--soft">{humanize(r.frameworkKey)}</span>
                      <span className="badge badge--soft">{humanize(r.format)}</span>
                    </div>
                    <h4><Link to={`/perspectives/${encodeURIComponent(r.experienceKey)}`}>{r.title}</Link></h4>
                    <p className="muted small-note">{r.primaryQuestion}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {connections && connections.sharedConcepts.length > 0 && (
            <section className="detail-card">
              <h3>Shared concepts</h3>
              <div className="badges">{connections.sharedConcepts.map((c) => <span key={c} className="badge badge--soft">{c}</span>)}</div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};