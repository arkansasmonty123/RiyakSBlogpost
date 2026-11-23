import { useEffect, useState } from 'react';
import type { SkillSummary } from '@shared/types';
import { api } from '../api';
import { ratingLabel, timeAgo } from '../utils';

export function SkillsView() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getSkills();
        if (!cancelled) setSkills(data.skills);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load skills.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="stack-lg">
      <section className="panel">
        <p className="eyebrow">Cross-case skills</p>
        <h1 className="page-title">Track how you negotiate over time.</h1>
        <p className="lede">Skill summaries are based on recorded session evidence. Ratings are not arbitrary scores.</p>
      </section>

      {loading ? (
        <div className="panel loading-panel" role="status">Loading skills…</div>
      ) : error ? (
        <div className="banner banner-error" role="alert">{error}</div>
      ) : skills.length === 0 ? (
        <div className="panel empty-panel">
          <h2>No skill data yet</h2>
          <p className="muted">Complete a negotiation and finalize the debrief to start building cross-case skill evidence.</p>
        </div>
      ) : (
        <div className="skills-grid">
          {skills.map((s) => (
            <article key={s.skill} className={`panel skill-card rating-${s.lastRating}`}>
              <div className="objective-head">
                <h2 className="skill-name">{s.skill.replaceAll('_', ' ')}</h2>
                <span className={`status-pill rating-pill-${s.lastRating}`}>{ratingLabel(s.lastRating)}</span>
              </div>
              <dl className="case-meta">
                <div><dt>Sessions</dt><dd>{s.sessions}</dd></div>
                <div><dt>Last case</dt><dd>{s.lastCaseId}</dd></div>
              </dl>
              <p className="small muted"><strong>Last assessed:</strong> {timeAgo(s.lastAssessedAt)}</p>
              <p className="small">{s.lastEvidence}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
