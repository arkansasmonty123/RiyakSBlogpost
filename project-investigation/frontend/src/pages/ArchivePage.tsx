import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import type { ArchiveItem } from '../api';
import '../features/support/support.css';

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusSeal(item: ArchiveItem): { text: string; variant: string } {
  if (item.status === 'completed') {
    return item.evaluationResult === 'correct'
      ? { text: 'Solved', variant: 'success' }
      : { text: 'Rejected', variant: 'warning' };
  }
  if (item.status === 'abandoned') return { text: 'Abandoned', variant: 'muted' };
  return { text: 'Paused', variant: 'accent' };
}

function statusDescription(item: ArchiveItem): string {
  if (item.status === 'completed') {
    return item.evaluationResult === 'correct'
      ? 'Verdict submitted and case closed.'
      : 'Verdict recorded. Case finished and archived.';
  }
  if (item.status === 'abandoned') return 'Archived as history. This investigation cannot be reopened.';
  return 'Accusation was unsuccessful. You can reopen the investigation and continue working the case.';
}

export const ArchivePage = () => {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.getArchive();
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="archive-page support-page page-enter">
      <div className="page-heading">
        <div>
          <h2>Archive</h2>
          <p className="muted">
            Completed, paused, and abandoned investigations. Reopen active work or review how a case ended.
          </p>
        </div>
        <Link className="text-link" to="/">Back to case library</Link>
      </div>

      {isLoading && <div className="page-state" role="status" aria-live="polite">Loading archive…</div>}
      {error && <div className="error" role="alert">Could not load archive: {error}</div>}

      {!isLoading && !error && items.length === 0 && (
        <div className="empty-state">
          <h3>No archived cases yet</h3>
          <p className="muted">When you complete, pause, or abandon an investigation, its record will appear here.</p>
          <Link className="button-link" to="/">Browse the case library</Link>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="card-list" aria-label="Archived investigations">
          {items.map((item) => {
            const seal = statusSeal(item);
            return (
              <article key={item.id} className="detail-card archive-card">
                <span className={`seal seal--${seal.variant}`}>{seal.text}</span>

                <h3>{item.caseTitle ?? `Case ${item.caseId}`}</h3>
                <p className="muted">{statusDescription(item)}</p>

                <dl className="progress-stats progress-stats--compact" aria-label="Archive details">
                  <div className="progress-stat">
                    <dt>Progress</dt>
                    <dd>{item.progress ?? 0}%</dd>
                  </div>
                  <div className="progress-stat">
                    <dt>Recorded</dt>
                    <dd>{formatDate(item.completionTimestamp ?? item.updatedAt)}</dd>
                  </div>
                </dl>

                {item.status === 'abandoned' ? (
                  <p className="muted small-note">History retained — not reopenable.</p>
                ) : (
                  <div className="button-row">
                    <Link className="button-link" to={`/investigation/${item.caseId}?investigation=${item.id}`}>
                      {item.status === 'completed' ? 'View resolution' : 'Reopen investigation'}
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
