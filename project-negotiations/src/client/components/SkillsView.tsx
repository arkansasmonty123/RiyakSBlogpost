import { useEffect, useState } from 'react';
import type { CaseSummary, RatingLevel, SkillSummary } from '@shared/types';
import { api } from '../api';
import { ratingLabel, timeAgo } from '../utils';
import { SkeletonList } from './Skeleton';

const RATING_PROGRESS: Record<RatingLevel, number> = { strong: 100, developing: 60, needs_work: 25 };

const GRADE_BANDS: Array<[number, string]> = [
  [96, 'A+'], [93, 'A'], [90, 'A-'], [87, 'B+'], [83, 'B'], [80, 'B-'],
  [77, 'C+'], [73, 'C'], [70, 'C-'], [65, 'D+'], [60, 'D'],
];

function gradeInfo(average: number): { letter: string; cls: string } {
  for (const [threshold, letter] of GRADE_BANDS) {
    if (average >= threshold) {
      const cls = letter.startsWith('A') ? 'grade-strong' : letter.startsWith('B') ? 'grade-mixed' : 'grade-weak';
      return { letter, cls };
    }
  }
  return { letter: 'F', cls: 'grade-weak' };
}

function aggregateGrade(skills: SkillSummary[]): { letter: string; cls: string } | null {
  if (skills.length === 0) return null;
  const avg = skills.reduce((sum, s) => sum + RATING_PROGRESS[s.lastRating], 0) / skills.length;
  return gradeInfo(avg);
}

function weakestGuidance(skills: SkillSummary[]): { name: string; text: string } | null {
  if (skills.length === 0) return null;
  const sorted = [...skills].sort((a, b) => RATING_PROGRESS[a.lastRating] - RATING_PROGRESS[b.lastRating]);
  const weakest = sorted[0];
  const name = weakest.skill.replaceAll('_', ' ');
  if (weakest.lastRating === 'needs_work') {
    return { name, text: `Keep improving ${name}: review the offers you lost, the evidence behind your positions, and what the other side valued.` };
  }
  if (weakest.lastRating === 'developing') {
    return { name, text: `Push on ${name} in your next case — ask one focused question and adjust after the session.` };
  }
  return { name, text: `Maintain your strength in ${name} by applying it to harder cases.` };
}

interface Props {
  cases: CaseSummary[];
  onBrowseCases?: () => void;
}

function formatCaseLabel(caseId: string, cases: CaseSummary[]): string {
  const found = cases.find((c) => c.id === caseId);
  if (found) return found.title;
  return caseId
    .replace(/^case-\d+-/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function SkillsView({ cases, onBrowseCases }: Props) {
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

  const grade = aggregateGrade(skills);
  const guidance = weakestGuidance(skills);

  if (loading) {
    return (
      <div className="stack-lg">
        <section className="panel skills-overview">
          <p className="eyebrow">Cross-case skills</p>
          <h1 className="page-title">Track how you negotiate over time.</h1>
          <p className="lede">Skill summaries are based on recorded session evidence. Ratings are not arbitrary scores.</p>
        </section>
        <SkeletonList count={4} />
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <section className="panel skills-overview">
        <p className="eyebrow">Cross-case skills</p>
        <h1 className="page-title">Track how you negotiate over time.</h1>
        <p className="lede">Skill summaries are based on recorded session evidence. Ratings are not arbitrary scores.</p>
        {skills.length > 0 && (
          <>
            <div className="skills-overview-grade">
              <span className="grade-label">Overall trend</span>
              <strong className={`grade-value ${grade?.cls ?? 'grade-weak'}`}>{grade?.letter ?? '—'}</strong>
            </div>
            {guidance && <p className="small muted skills-guidance">{guidance.text}</p>}
          </>
        )}
      </section>

      {error ? (
        <div className="banner banner-error" role="alert">{error}</div>
      ) : skills.length === 0 ? (
        <div className="panel empty-panel">
          <h2>No skill data yet</h2>
          <p className="muted">Complete a negotiation and finalize the debrief to start building cross-case skill evidence.</p>
        </div>
      ) : (
        <div className="skills-grid">
          {skills.map((s) => {
            const name = s.skill.replaceAll('_', ' ');
            const progress = RATING_PROGRESS[s.lastRating];
            return (
              <article key={s.skill} className={`panel skill-card rating-${s.lastRating}`}>
                <div className="objective-head">
                  <h2 className="skill-name">{name}</h2>
                  <span className={`status-pill rating-pill-${s.lastRating}`}>{ratingLabel(s.lastRating)}</span>
                </div>
                <dl className="case-meta">
                  <div><dt>Sessions</dt><dd>{s.sessions}</dd></div>
                  <div><dt>Last case</dt><dd>{formatCaseLabel(s.lastCaseId, cases)}</dd></div>
                </dl>
                <p className="small muted"><strong>Last assessed:</strong> {timeAgo(s.lastAssessedAt)}</p>
                <p className="small">{s.lastEvidence}</p>
                <div className="skills-progress">
                  <div className="progress-head">
                    <span>Practice progress</span>
                    <strong>{progress}%</strong>
                  </div>
                  <div className="meter" role="progressbar" aria-label={`Practice progress for ${name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                    <div className="meter-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                {onBrowseCases && (
                  <div className="actions-row wrap">
                    <button type="button" className="btn btn-secondary btn-small" onClick={onBrowseCases}>Browse cases that practice this</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
