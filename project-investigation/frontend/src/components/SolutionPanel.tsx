/**
 * SolutionPanel
 *
 * Renders the complete, server-projected solution for a COMPLETED investigation.
 * This component never receives canonical truth directly - the API only returns
 * this narrow, safe DTO after a correct verdict has been evaluated server-side.
 * Reused by the investigation room's resolution view (also reached from the
 * archive's "View resolution" link).
 */

import type {
  Solution,
  SolutionTimelineEntry,
} from '../api';

interface SolutionPanelProps {
  solution: Solution;
}

export const SolutionPanel = ({ solution }: SolutionPanelProps) => {
  return (
    <section className="solution-panel" aria-label="Case solution">
      <div className="solution-heading">
        <h3>The Complete Solution</h3>
        <span className="badge badge--correct">CASE CLOSED</span>
      </div>
      <p className="muted">
        The case is solved. Below is the full account of what actually happened.
      </p>

      <div className="solution-verdict">
        <h4>Verdict</h4>
        <p><strong>Culprit:</strong> {solution.culprit || '—'}</p>
        <p><strong>Motive:</strong> {solution.motive || '—'}</p>
        <p><strong>Method:</strong> {solution.method || '—'}</p>
      </div>

      {solution.solutionExplanation && (
        <div className="solution-section">
          <h4>How the crime was committed</h4>
          <p className="solution-prose">{solution.solutionExplanation}</p>
        </div>
      )}

      {solution.actualTimeline.length > 0 && (
        <div className="solution-section">
          <h4>What actually happened</h4>
          <ol className="timeline-list">
            {solution.actualTimeline.map((entry: SolutionTimelineEntry, index) => (
              <li key={index}>
                <span className="timeline-time">{entry.time || `Step ${entry.seq ?? index + 1}`}</span>
                <span className="timeline-kind">Confirmed</span>
                <span>
                  {entry.event || '—'}
                  {Array.isArray(entry.evidence) && entry.evidence.length > 0 && (
                    <> — evidence: {entry.evidence.join(', ')}</>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {solution.redHerrings.length > 0 && (
        <div className="solution-section">
          <h4>Red herrings</h4>
          <div className="card-list">
            {solution.redHerrings.map((rh, index) => (
              <article key={index} className="detail-card">
                <h4>{rh.label}</h4>
                {rh.apparentMeaning && <p><strong>Seemed to mean:</strong> {rh.apparentMeaning}</p>}
                {rh.actualExplanation && <p><strong>In reality:</strong> {rh.actualExplanation}</p>}
                {rh.resolvedBy && <p className="muted">Resolved by: {rh.resolvedBy}</p>}
              </article>
            ))}
          </div>
        </div>
      )}

      {solution.alternativeTheories.length > 0 && (
        <div className="solution-section">
          <h4>Alternative theories &amp; why they were eliminated</h4>
          <div className="card-list">
            {solution.alternativeTheories.map((theory, index) => (
              <article key={index} className="detail-card">
                <h4>{theory.title}</h4>
                <p>{theory.summary}</p>
                {theory.whyPlausible && <p><strong>Why it seemed plausible:</strong> {theory.whyPlausible}</p>}
                {Array.isArray(theory.disprovenBy) && theory.disprovenBy.length > 0 && (
                  <p><strong>Disproven by:</strong> {theory.disprovenBy.join(', ')}</p>
                )}
                {theory.resolution && <p><strong>Resolution:</strong> {theory.resolution}</p>}
              </article>
            ))}
          </div>
        </div>
      )}

      {solution.clueResolutions.length > 0 && (
        <div className="solution-section">
          <h4>Clue resolutions</h4>
          <div className="card-list">
            {solution.clueResolutions.map((cr, index) => (
              <article key={index} className="detail-card">
                <h4>{cr.clue}</h4>
                <p>{cr.resolution}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
