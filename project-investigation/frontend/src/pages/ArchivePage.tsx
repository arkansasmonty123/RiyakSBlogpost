/**
 * Archive Page
 * Lists the current user's completed, abandoned and paused investigations.
 * Completed/paused cases link back to the investigation room in read-only or
 * reopened view via the ?investigation=<id> parameter. Abandoned cases (PROD-012)
 * are history-only: clearly labelled, not reopenable, but never deleted.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import type { ArchiveItem } from '../api';

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusLabel(item: ArchiveItem): string {
  if (item.status === 'completed') {
    return item.evaluationResult === 'correct' ? 'Solved' : 'Completed';
  }
  if (item.status === 'abandoned') return 'Abandoned';
  return 'Paused (accusation unsuccessful)';
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
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="archive-page">
      <div className="page-heading">
        <div>
          <h2>Case Archive</h2>
          <p className="muted">Revisit your solved and paused investigations.</p>
        </div>
        <Link className="text-link" to="/">Back to case library</Link>
      </div>

      {isLoading && <div className="page-state">Loading archive...</div>}
      {error && <div className="error">Error loading archive: {error}</div>}

      {!isLoading && !error && items.length === 0 && (
        <div className="empty-state">
          <p>No archived cases yet.</p>
          <Link className="button-link" to="/">Browse the case library</Link>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="card-list">
          {items.map((item) => (
            <article key={item.id} className="detail-card archive-card">
              <div className="badges">
                <span
                  className={
                    item.status === 'completed'
                      ? 'badge badge--correct'
                      : item.status === 'abandoned'
                        ? 'badge badge--abandoned'
                        : 'badge badge--partial'
                  }
                >
                  {statusLabel(item)}
                </span>
                {item.evaluationResult && <span className="badge">{item.evaluationResult}</span>}
              </div>
              <h3>{item.caseTitle ?? `Case ${item.caseId}`}</h3>
              <p className="muted">Case {item.caseId}</p>
              <p>Progress: {item.progress ?? 0}%</p>
              <p className="muted">
                {item.status === 'completed'
                  ? 'Completed'
                  : item.status === 'abandoned'
                    ? 'Abandoned'
                    : 'Updated'}
                : {formatDate(item.completionTimestamp ?? item.updatedAt)}
              </p>
              {item.status === 'abandoned' ? (
                <span className="muted">History retained — not reopenable</span>
              ) : (
                <Link
                  className="button-link"
                  to={`/investigation/${item.caseId}?investigation=${item.id}`}
                >
                  {item.status === 'completed' ? 'View resolution' : 'Reopen investigation'}
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
