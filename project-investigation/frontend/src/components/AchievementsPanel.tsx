/**
 * Achievements Panel (GAP-13)
 *
 * Read-only view of the achievements the SERVER has awarded for an
 * investigation. The client never awards or chooses an achievement type - it
 * only renders what GET /api/investigations/:id/achievements returns. Unknown
 * achievement types get a humanized fallback label so the panel stays useful
 * if new server-side types are added later. No canonical data is involved.
 */

import type { Achievement } from '../api';

const ACHIEVEMENT_LABELS: Record<string, { title: string; description: string }> = {
  first_evidence: {
    title: 'First Evidence',
    description: 'Examined your first piece of evidence.',
  },
  case_solved: {
    title: 'Case Solved',
    description: 'Reached the correct verdict and closed the case.',
  },
};

function humanize(type: string): string {
  return type
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function AchievementsPanel({ achievements }: { achievements: Achievement[] }) {
  const list = Array.isArray(achievements) ? achievements : [];

  return (
    <section className="achievements-panel" aria-label="Achievements">
      <div className="section-heading">
        <h3>Achievements</h3>
        <span className="muted">{list.length} unlocked</span>
      </div>

      {list.length === 0 ? (
        <p className="empty-state">
          No achievements unlocked yet. Examine evidence or solve a case to earn one.
        </p>
      ) : (
        <ul className="achievement-list">
          {list.map((achievement) => {
            const meta = ACHIEVEMENT_LABELS[achievement.achievementType];
            const title = meta?.title ?? humanize(achievement.achievementType);
            return (
              <li key={achievement.id ?? achievement.achievementType} className="achievement-entry">
                <span className="badge badge--confirmed">{title}</span>
                {meta?.description && (
                  <span className="achievement-description">{meta.description}</span>
                )}
                <span className="muted achievement-time">{formatDate(achievement.unlockedAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
