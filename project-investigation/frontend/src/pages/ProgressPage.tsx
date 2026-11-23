/**
 * Progress Page (M8-6)
 *
 * A calm, private "case file" summary of the signed-in investigator's own
 * activity. It deliberately contains no XP, levels, streaks or leaderboards:
 * the milestones are derived from real investigations, discoveries and recall
 * practice, and the return summary is an honest fixed-window activity count
 * (there is no reliable last-visit signal to claim "since last visit" from).
 * All data arrives through the auth-gated, allowlisted /api/me/progress DTO.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import type { ProgressDTO } from '../api';
import { useSession } from '../hooks/useSession';

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="progress-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {hint && <p className="progress-stat__hint">{hint}</p>}
    </div>
  );
}

const MASTERY_LABELS: Record<string, string> = {
  new: 'New',
  developing: 'Developing',
  proficient: 'Proficient',
  mastered: 'Mastered',
};

export const ProgressPage = () => {
  const { refresh } = useSession();
  const [data, setData] = useState<ProgressDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // M8-W7: self-service export/deletion. Both are explicit user actions.
  const [dataBusy, setDataBusy] = useState<'export' | 'delete' | null>(null);
  const [dataActionError, setDataActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');

  const downloadExport = async (): Promise<void> => {
    setDataBusy('export');
    setDataActionError(null);
    try {
      const exportData = await api.exportAccountData();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `investigation-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDataActionError(errorMessage(err));
    } finally {
      setDataBusy(null);
    }
  };

  const removeAccount = async (): Promise<void> => {
    if (deletePhrase !== 'DELETE') return;
    setDataBusy('delete');
    setDataActionError(null);
    try {
      await api.deleteAccount();
      await refresh();
    } catch (err) {
      setDataActionError(errorMessage(err));
      setDataBusy(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.getProgress();
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const isEmpty = !!data &&
    data.investigations.total === 0 &&
    data.knowledge.memoryItems === 0 &&
    !data.milestones.some((milestone) => milestone.achieved);

  const achievedCount = data
    ? data.milestones.filter((milestone) => milestone.achieved).length
    : 0;

  return (
    <div className="progress-page page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Investigator record</p>
          <h2>Your Case File</h2>
          <p className="muted">
            A private record of the work you have done. {data?.disclaimer}
          </p>
        </div>
        <Link className="text-link" to="/">Back to case library</Link>
      </div>

      {isLoading && <div className="page-state" role="status">Opening your case file…</div>}
      {error && <div className="error" role="alert">Could not load your case file: {error}</div>}

      {data && !error && (
        <>
          {isEmpty && (
            <section className="detail-card progress-intro" aria-label="Getting started">
              <p>
                Your file is open, but there is not much in it yet. Every investigation,
                accepted discovery and recall you record will appear here over time.
              </p>
              <Link className="button-link" to="/">Browse the case library</Link>
            </section>
          )}

          {/* Return summary. Honest label: no last-visit signal is assumed. */}
          <section className="detail-card progress-section" aria-labelledby="progress-recent">
            <div className="section-heading">
              <h3 id="progress-recent">Recent activity</h3>
              <span className="badge badge--soft">Last {data.recentActivity.windowDays} days</span>
            </div>
            <p className="muted">
              A fixed-window snapshot, not a measure of intelligence or a streak.
            </p>
            <dl className="progress-stats progress-stats--compact">
              <Stat label="Cases completed" value={data.recentActivity.completedCases} />
              <Stat label="Discoveries accepted" value={data.recentActivity.acceptedDiscoveries} />
              <Stat label="Ideas retained" value={data.recentActivity.newMemoryItems} />
              <Stat label="New developments" value={data.recentActivity.newNotifications} />
            </dl>
            <p className="progress-updated muted">
              Record generated {formatDate(data.generatedAt)}.
            </p>
          </section>

          <section className="detail-card progress-section" aria-labelledby="progress-investigations">
            <h3 id="progress-investigations">Investigation history</h3>
            <p className="muted">Your investigations, by their current state.</p>
            <dl className="progress-stats">
              <Stat label="Active" value={data.investigations.active} hint="Currently in progress" />
              <Stat label="Completed" value={data.investigations.completed} hint="A verdict was reached" />
              <Stat label="Paused" value={data.investigations.paused} hint="Accusation unsuccessful" />
              <Stat label="Abandoned" value={data.investigations.abandoned} hint="Kept for the record" />
              <Stat label="Investigations" value={data.investigations.total} />
              <Stat label="Distinct cases" value={data.investigations.distinctCasesPlayed} />
            </dl>
            <Link className="text-link" to="/archive">Open the case archive →</Link>
          </section>

          <section className="detail-card progress-section" aria-labelledby="progress-knowledge">
            <h3 id="progress-knowledge">Knowledge &amp; memory</h3>
            <p className="muted">
              Retained ideas are pedagogical context, not evidence and never a case solution.
            </p>
            <dl className="progress-stats">
              <Stat label="Discoveries accepted" value={data.knowledge.discoveriesAccepted} />
              <Stat label="Ideas retained" value={data.knowledge.memoryItems} />
              <Stat label="Ready to recall" value={data.knowledge.dueRecall} hint="Due prompts in your journal" />
              <Stat label="Cross-case uses" value={data.knowledge.crossCaseApplications} hint="An idea reused in another case" />
              <Stat label="Successful recalls" value={data.knowledge.successfulRecalls} />
            </dl>

            <h4 className="progress-subheading">Mastery distribution</h4>
            <ul className="progress-mastery">
              {Object.entries(data.knowledge.mastery).map(([key, count]) => (
                <li key={key}>
                  <span>{MASTERY_LABELS[key] ?? key}</span>
                  <span className="progress-mastery__bar" aria-hidden="true">
                    <span
                      className="progress-mastery__fill"
                      style={{
                        width: data.knowledge.memoryItems > 0
                          ? `${Math.round((count / data.knowledge.memoryItems) * 100)}%`
                          : '0%',
                      }}
                    />
                  </span>
                  <span className="progress-mastery__count">{count}</span>
                </li>
              ))}
            </ul>

            {(data.openThreads.unresolvedQuestions > 0 || data.openThreads.followUpApplications > 0) && (
              <div className="progress-threads">
                <h4 className="progress-subheading">Open threads</h4>
                <p className="muted">
                  {data.openThreads.unresolvedQuestions} unresolved question(s) ·{' '}
                  {data.openThreads.followUpApplications} follow-up application(s).
                </p>
                {data.openThreads.samples.length > 0 && (
                  <ul className="progress-samples">
                    {data.openThreads.samples.map((sample, index) => (
                      <li key={`${sample}-${index}`}>{sample}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <Link className="text-link" to="/knowledge">Open your knowledge journal →</Link>
          </section>

          <section className="detail-card progress-section" aria-labelledby="progress-milestones">
            <div className="section-heading">
              <h3 id="progress-milestones">Reasoning milestones</h3>
              <span className="badge badge--soft">
                {achievedCount} of {data.milestones.length} reached
              </span>
            </div>
            <p className="muted">
              Milestones mark real activity. They are not scores, ranks or rewards.
            </p>
            <ul className="progress-milestones">
              {data.milestones.map((milestone) => (
                <li
                  key={milestone.key}
                  className={milestone.achieved ? 'is-achieved' : ''}
                >
                  <span className="progress-milestone__mark" aria-hidden="true">
                    {milestone.achieved ? '✓' : '○'}
                  </span>
                  <span className="progress-milestone__body">
                    <strong>{milestone.label}</strong>
                    <span className="muted">{milestone.description}</span>
                  </span>
                  <span className="progress-milestone__status">
                    {milestone.achieved ? 'Reached' : 'Not yet'}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="detail-card progress-section" aria-labelledby="progress-next">
            <h3 id="progress-next">What&apos;s next</h3>
            <p className="muted">
              A simple, deterministic suggestion: cases you have not started yet.
            </p>
            {data.suggestions.length === 0 ? (
              <p className="muted">
                You have started every published case. Revisit the archive or try a
                perspective lens for a different angle on your reasoning.
              </p>
            ) : (
              <ul className="progress-suggestions">
                {data.suggestions.map((candidate) => (
                  <li key={candidate.caseId}>
                    <Link to={`/investigation/${encodeURIComponent(candidate.caseId)}`}>
                      {candidate.title}
                    </Link>
                    <span className="muted">
                      {[candidate.genre, candidate.difficulty, candidate.duration]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="button-row">
              <Link className="button-link" to="/perspectives">Explore perspectives</Link>
            </div>
          </section>

          {/* M8-W7: GDPR-style beta minimum - export and explicit deletion. */}
          <section className="detail-card progress-section" aria-labelledby="progress-data">
            <div className="section-heading">
              <h3 id="progress-data">Your data</h3>
              <span className="badge badge--soft"> Beta</span>
            </div>
            <p className="muted">
              Download a JSON copy of your own notes and progress, or permanently delete
              your account and personal data. Shared case content is never touched.
              See the <Link to="/privacy">privacy notice</Link> for details.
            </p>
            {dataActionError && <p className="error" role="alert">{dataActionError}</p>}
            <div className="button-row">
              <button type="button" onClick={() => void downloadExport()} disabled={dataBusy !== null}>
                {dataBusy === 'export' ? 'Preparing…' : 'Download my data (JSON)'}
              </button>
            </div>
            <div className="account-delete">
              <button
                type="button"
                className="button-danger"
                onClick={() => setConfirmDelete((open) => !open)}
                disabled={dataBusy !== null}
              >
                Delete my account…
              </button>
              {confirmDelete && (
                <div className="account-delete__confirm">
                  <p>
                    This is permanent and cannot be undone. Type <strong>DELETE</strong> to confirm.
                  </p>
                  <label htmlFor="delete-confirm">Confirmation phrase</label>
                  <input
                    id="delete-confirm"
                    type="text"
                    autoComplete="off"
                    value={deletePhrase}
                    onChange={(event) => setDeletePhrase(event.target.value)}
                  />
                  <div className="button-row">
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() => void removeAccount()}
                      disabled={deletePhrase !== 'DELETE' || dataBusy !== null}
                    >
                      {dataBusy === 'delete' ? 'Deleting…' : 'Permanently delete my account'}
                    </button>
                    <button type="button" onClick={() => { setConfirmDelete(false); setDeletePhrase(''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
