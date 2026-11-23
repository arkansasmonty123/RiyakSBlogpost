import { useEffect, useMemo, useState } from 'react';
import type {
  ActivitySnapshot,
  LivingWorldResult,
  NotificationItem,
  NotificationsResponse,
  SafeActivityEvent,
} from '../../api';

interface ActivityPanelProps {
  snapshot: ActivitySnapshot | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refreshResult: LivingWorldResult | null;
  onRefresh: () => void;
  onRetry: () => void;
  onMarkSeen: () => void;
  onResponse: (event: SafeActivityEvent, kind: string) => void;
  onNarrate: (eventId: string) => Promise<{ narration: string; disclaimer: string; source: string } | null>;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function significanceLabel(value: 'high' | 'normal' | 'low'): string {
  if (value === 'high') return 'High priority';
  if (value === 'low') return 'Minor update';
  return 'Update';
}

function EventCard({
  event,
  onResponse,
  onNarrate,
}: {
  event: SafeActivityEvent;
  onResponse: (event: SafeActivityEvent, kind: string) => void;
  onNarrate: ActivityPanelProps['onNarrate'];
}) {
  const [narration, setNarration] = useState<{ text: string; disclaimer: string } | null>(null);
  const [narrating, setNarrating] = useState(false);
  const [narrationError, setNarrationError] = useState<string | null>(null);

  async function handleNarrate() {
    if (narrating) return;
    setNarrating(true);
    setNarrationError(null);
    try {
      const result = await onNarrate(event.id);
      if (result?.narration) {
        setNarration({ text: result.narration, disclaimer: result.disclaimer || 'Generated summary - verify against case facts.' });
      }
    } catch {
      setNarrationError('Could not load narration.');
    } finally {
      setNarrating(false);
    }
  }

  return (
    <article className={`activity-event activity-event--${event.significance}`} aria-label={event.title}>
      <div className="activity-event__header">
        <div className="badges">
          <span className={`badge ${event.significance === 'high' ? 'badge--warning' : event.significance === 'low' ? 'badge--soft' : ''}`}>
            {significanceLabel(event.significance)}
          </span>
          <span className="badge badge--soft">{event.category.replace(/[_-]+/g, ' ')}</span>
          {event.requiresResponse && <span className="badge badge--partial">Needs response</span>}
        </div>
        {event.occurredAt && <span className="muted small-note">{formatDate(event.occurredAt)}</span>}
      </div>

      <h4 className="activity-event__title">{event.title}</h4>
      <p className="activity-event__actor muted small-note">
        <strong>{event.actor.displayName}</strong>
        {event.actor.kind ? ` · ${event.actor.kind.replace(/[_-]+/g, ' ')}` : ''}
      </p>
      <p className="activity-event__summary">{event.summary}</p>
      {event.detail && event.detail !== event.summary && (
        <p className="activity-event__detail muted">{event.detail}</p>
      )}

      {event.whyItMatters && (
        <div className="activity-event__why">
          <span className="activity-event__why-label">Why it matters</span>
          <p>{event.whyItMatters}</p>
        </div>
      )}

      {event.changes.length > 0 && (
        <ul className="activity-event__changes" aria-label="What changed">
          {event.changes.map((change, idx) => (
            <li key={`${change.kind}-${idx}`}>
              <span className="badge badge--soft">{change.kind.replace(/[_-]+/g, ' ')}</span>{' '}
              <span>{change.label}</span>
            </li>
          ))}
        </ul>
      )}

      {event.responseOptions.length > 0 && (
        <div className="activity-event__responses" aria-label="Response options">
          {event.responseOptions.map((option, idx) => (
            <button
              key={`${option.kind}-${idx}`}
              type="button"
              className="small-button"
              onClick={() => onResponse(event, option.kind)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="activity-event__footer">
        <button type="button" className="link-button" onClick={() => void handleNarrate()} disabled={narrating}>
          {narrating ? 'Loading narration…' : narration ? 'Refresh narration' : 'Narrate'}
        </button>
        {event.provenanceLabel && <span className="muted small-note">Source: {event.provenanceLabel.replace(/[_-]+/g, ' ')}</span>}
      </div>

      {narrationError && <p className="error" role="status">{narrationError}</p>}
      {narration && (
        <div className="activity-event__narration" role="status">
          <p>{narration.text}</p>
          <p className="muted small-note">{narration.disclaimer}</p>
        </div>
      )}
    </article>
  );
}

export function ActivityPanel({
  snapshot,
  loading,
  error,
  refreshing,
  refreshResult,
  onRefresh,
  onRetry,
  onMarkSeen,
  onResponse,
  onNarrate,
}: ActivityPanelProps) {
  const [showMinor, setShowMinor] = useState(false);

  const { majorGroups, minorGroups, minorCount } = useMemo(() => {
    const groups = snapshot?.groups ?? [];
    const major = groups.filter((g) => g.significance !== 'low');
    const minor = groups.filter((g) => g.significance === 'low');
    return { majorGroups: major, minorGroups: minor, minorCount: minor.reduce((n, g) => n + g.items.length, 0) };
  }, [snapshot]);

  if (loading && !snapshot) {
    return <div className="page-state" role="status">Loading activity…</div>;
  }

  if (error && !snapshot) {
    return (
      <div className="activity-panel">
        <div className="error" role="alert">
          Unable to load activity: {error}
          <div className="button-row"><button type="button" className="small-button" onClick={onRetry}>Retry</button></div>
        </div>
      </div>
    );
  }

  const catchUp = snapshot?.sinceLastVisit;
  const hasCatchUp = catchUp && (catchUp.newCount > 0 || catchUp.highlights.length > 0 || catchUp.summary);

  return (
    <section className="activity-panel" aria-label="Investigation activity">
      <div className="section-heading">
        <div>
          <h3>Activity</h3>
          <p className="muted">Team developments, leads, disagreements, and events that unfolded while you were away.</p>
        </div>
        <div className="activity-panel__actions">
          <button type="button" className="small-button" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Checking…' : 'Check for developments'}
          </button>
          {snapshot && snapshot.counts.unread > 0 && (
            <button type="button" className="link-button" onClick={onMarkSeen}>Mark seen</button>
          )}
        </div>
      </div>

      {error && <div className="error" role="status">{error}</div>}
      {refreshResult && (refreshResult.counts.resolved > 0 || refreshResult.counts.expired > 0) && (
        <p className="muted" role="status">
          Checked developments: {refreshResult.counts.resolved} resolved, {refreshResult.counts.expired} expired.
        </p>
      )}

      {hasCatchUp && (
        <div className="activity-catchup detail-card" aria-live="polite">
          <div className="section-heading">
            <h4>Since your last visit</h4>
            <span className="muted small-note">{catchUp.newCount} new · {catchUp.unresolvedCount} unresolved</span>
          </div>
          {catchUp.summary && <p>{catchUp.summary}</p>}
          {catchUp.highlights.length > 0 && (
            <ul className="activity-catchup__highlights">
              {catchUp.highlights.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          )}
          {catchUp.from && <p className="muted small-note">Last visit: {formatDate(catchUp.from)}</p>}
        </div>
      )}

      {snapshot && snapshot.pendingResponse.length > 0 && (
        <div className="activity-section">
          <div className="section-heading">
            <h4>Needs your response</h4>
            <span className="badge badge--partial">{snapshot.pendingResponse.length}</span>
          </div>
          <div className="card-list">
            {snapshot.pendingResponse.map((event) => (
              <EventCard key={event.id} event={event} onResponse={onResponse} onNarrate={onNarrate} />
            ))}
          </div>
        </div>
      )}

      {snapshot && snapshot.outstandingDisagreements.length > 0 && (
        <div className="activity-section">
          <div className="section-heading">
            <h4>Outstanding team disagreements</h4>
            <span className="badge badge--warning">{snapshot.outstandingDisagreements.length}</span>
          </div>
          <div className="card-list">
            {snapshot.outstandingDisagreements.map((d) => (
              <article key={d.eventId} className="detail-card activity-disagreement">
                <h5>{d.topic}</h5>
                <p className="muted small-note">
                  <strong>{d.specialistAKey.replace(/[_-]+/g, ' ')}</strong>: {d.positionA}
                </p>
                <p className="muted small-note">
                  <strong>{d.specialistBKey.replace(/[_-]+/g, ' ')}</strong>: {d.positionB}
                </p>
                {d.uncertaintyNote && <p className="muted small-note"><strong>Uncertainty:</strong> {d.uncertaintyNote}</p>}
                {d.occurredAt && <p className="muted small-note">{formatDate(d.occurredAt)}</p>}
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="activity-section">
        <div className="section-heading">
          <h4>Recent activity</h4>
          {snapshot && <span className="muted small-note">{snapshot.counts.total} events</span>}
        </div>

        {!snapshot || snapshot.groups.length === 0 ? (
          <p className="empty-state">No team activity yet. As the investigation unfolds, specialist discoveries, leads, and developments will appear here.</p>
        ) : (
          <>
            {majorGroups.map((group) => (
              <div key={group.groupKey} className="activity-group">
                <div className="activity-group__header">
                  <h5>{group.title}</h5>
                  <span className="muted small-note">{group.items.length} item{group.items.length === 1 ? '' : 's'}</span>
                </div>
                <div className="card-list">
                  {group.items.map((event) => (
                    <EventCard key={event.id} event={event} onResponse={onResponse} onNarrate={onNarrate} />
                  ))}
                </div>
              </div>
            ))}

            {minorGroups.length > 0 && (
              <div className="activity-minor">
                <button type="button" className="link-button" onClick={() => setShowMinor((v) => !v)} aria-expanded={showMinor}>
                  {showMinor ? 'Hide' : 'Show'} minor updates ({minorCount})
                </button>
                {showMinor && minorGroups.map((group) => (
                  <div key={group.groupKey} className="activity-group">
                    <div className="activity-group__header">
                      <h5>{group.title}</h5>
                      <span className="muted small-note">{group.items.length} item{group.items.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="card-list">
                      {group.items.map((event) => (
                        <EventCard key={event.id} event={event} onResponse={onResponse} onNarrate={onNarrate} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {snapshot && snapshot.upcoming.length > 0 && (
        <div className="activity-section">
          <div className="section-heading">
            <h4>Upcoming developments</h4>
            <span className="muted small-note">Tentative</span>
          </div>
          <ul className="activity-upcoming">
            {snapshot.upcoming.map((u, i) => (
              <li key={`${u.title}-${i}`} className="activity-upcoming__item">
                <span className={`badge ${u.significance === 'high' ? 'badge--warning' : 'badge--soft'}`}>{u.certainty}</span>
                <span>{u.title}</span>
                <span className="muted small-note">{u.category.replace(/[_-]+/g, ' ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {snapshot?.hasMore && (
        <p className="muted small-note">More activity is available. Refresh later to check for updates.</p>
      )}
    </section>
  );
}

interface NotificationInboxProps {
  open: boolean;
  onClose: () => void;
  notifications: NotificationsResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onMarkRead: (ids?: string[]) => void;
  onMarkAllRead: () => void;
}

export function NotificationInbox({
  open,
  onClose,
  notifications,
  loading,
  error,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
}: NotificationInboxProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const items: NotificationItem[] = notifications?.items ?? [];
  return (
    <div className="notification-inbox" role="dialog" aria-label="Notifications" aria-modal="false">
      <div className="notification-inbox__header">
        <h4>Notifications</h4>
        <div className="notification-inbox__actions">
          <button type="button" className="link-button" onClick={onRefresh}>Refresh</button>
          <button type="button" className="link-button" onClick={onMarkAllRead} disabled={!items.some((i) => i.status === 'unread')}>
            Mark all read
          </button>
          <button type="button" className="link-button" onClick={onClose}>Close</button>
        </div>
      </div>
      {loading && <p className="muted" role="status">Loading notifications…</p>}
      {error && <p className="error" role="status">{error}</p>}
      {!loading && items.length === 0 ? (
        <p className="muted">No notifications right now.</p>
      ) : (
        <ul className="notification-inbox__list">
          {items.map((item) => (
            <li key={item.id} className={`notification-inbox__item ${item.status === 'unread' ? 'notification-inbox__item--unread' : ''}`}>
              <div className="notification-inbox__item-main">
                <div className="badges">
                  <span className={`badge ${item.priority === 'high' ? 'badge--warning' : 'badge--soft'}`}>{item.priority}</span>
                  <span className="badge badge--soft">{item.category.replace(/[_-]+/g, ' ')}</span>
                  {item.status === 'unread' && <span className="badge badge--partial">Unread</span>}
                </div>
                <p className="notification-inbox__title">{item.title}</p>
                {item.body && <p className="muted small-note">{item.body}</p>}
                {item.createdAt && <p className="muted small-note">{formatDate(item.createdAt)}</p>}
              </div>
              {item.status === 'unread' && (
                <button type="button" className="link-button" onClick={() => onMarkRead([item.id])}>Mark read</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
