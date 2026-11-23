import type { DebriefReport, SessionView } from '@shared/types';
import { formatInfoClass, qualityLabel, ratingLabel, timeAgo } from '../utils';

interface Props {
  session: SessionView;
  debrief: DebriefReport | null;
  busy: boolean;
  onLoad: () => void;
  onNewCase: () => void;
  onRetryCase: () => void;
}

function QualityCard({ title, quality, rationale }: { title: string; quality: string; rationale: string }) {
  return (
    <article className={`panel quality-card quality-${quality}`}>
      <p className="eyebrow">{title}</p>
      <h3>{qualityLabel(quality as 'strong' | 'mixed' | 'weak')}</h3>
      <p>{rationale}</p>
    </article>
  );
}

export function DebriefView({ session, debrief, busy, onLoad, onNewCase, onRetryCase }: Props) {
  if (!debrief) {
    return (
      <div className="panel empty-panel">
        <p className="eyebrow">Debrief</p>
        <h1 className="page-title">Debrief not loaded</h1>
        <p className="muted">Finalize the session to compute an evidence-based debrief.</p>
        <div className="actions-row">
          <button type="button" className="btn btn-primary" onClick={onLoad} disabled={busy}>Load / finalize debrief</button>
          <button type="button" className="btn btn-ghost" onClick={onNewCase}>Back to cases</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <section className="panel">
        <p className="eyebrow">Debrief</p>
        <h1 className="page-title">{session.case.title} — Outcome review</h1>
        <p className="lede">
          Decision quality and outcome quality are reported separately. A good decision can lead to a poor outcome, and a poor decision can sometimes get lucky.
        </p>
        <div className="stat-grid">
          <div className="stat"><span className="stat-label">Agreement</span><strong>{debrief.agreementStatus.replaceAll('_', ' ')}</strong></div>
          <div className="stat"><span className="stat-label">Outcome</span><strong>{debrief.outcome.title}</strong></div>
          <div className="stat"><span className="stat-label">Player score</span><strong>{debrief.outcome.playerScore}/100</strong></div>
        </div>
        <p><strong>Agreement summary:</strong> {debrief.agreementSummary ?? 'No agreement summary available.'}</p>
        <p className="muted">{debrief.outcome.description}</p>
        <p className="small muted">{debrief.outcome.rationale}</p>
      </section>

      <div className="two-col">
        <QualityCard title="Decision quality" quality={debrief.decisionQuality} rationale={debrief.decisionQualityRationale} />
        <QualityCard title="Outcome quality" quality={debrief.outcomeQuality} rationale={debrief.outcomeQualityRationale} />
      </div>

      <section className="panel">
        <p className="eyebrow">Objectives</p>
        <h2>Objectives met</h2>
        <div className="stack-sm">
          {debrief.objectivesMet.map((o, i) => (
            <article key={i} className={`objective-row ${o.met ? 'is-met' : 'is-missed'}`}>
              <div className="objective-head">
                <strong>{o.objective}</strong>
                <span className={`status-pill ${o.met ? 'status-completed' : 'status-failed'}`}>{o.met ? 'Met' : 'Not met'}</span>
              </div>
              <p className="small muted">{o.evidence}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="two-col">
        <section className="panel">
          <p className="eyebrow">Movement</p>
          <h2>Concessions</h2>
          {debrief.concessions.length === 0 ? <p className="muted">No concessions recorded.</p> : (
            <ul className="bullet-list">{debrief.concessions.map((c, i) => <li key={i}><strong>{c.by}:</strong> {c.description}</li>)}</ul>
          )}
          <h3>Unresolved issues</h3>
          {debrief.unresolvedIssues.length === 0 ? <p className="muted">No unresolved required issues.</p> : (
            <ul className="bullet-list">{debrief.unresolvedIssues.map((u, i) => <li key={i}>{u}</li>)}</ul>
          )}
        </section>

        <section className="panel">
          <p className="eyebrow">Trust</p>
          <h2>Trust / credibility changes</h2>
          {debrief.trustChanges.length === 0 ? <p className="muted">No trust changes recorded.</p> : (
            <div className="stack-sm">
              {debrief.trustChanges.map((t, i) => (
                <div key={i} className="trust-change">
                  <div className="objective-head"><strong>{t.participant}</strong><span className="muted small">{t.from} → {t.to}</span></div>
                  <p className="small muted">{t.reason}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel">
        <p className="eyebrow">Timeline</p>
        <h2>Key moments</h2>
        {debrief.keyMoments.length === 0 ? <p className="muted">No key moments recorded.</p> : (
          <div className="moment-list">
            {debrief.keyMoments.map((m, i) => (
              <article key={i} className="moment">
                <div className="moment-time">{timeAgo(m.timestamp)}</div>
                <div>
                  <strong>{m.description}</strong>
                  <p className="small muted">{m.impact}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="two-col">
        <section className="panel">
          <p className="eyebrow">Reflection</p>
          <h2>Mistakes</h2>
          {debrief.mistakes.length === 0 ? <p className="muted">No major mistakes flagged.</p> : (
            <ul className="bullet-list">{debrief.mistakes.map((m, i) => <li key={i}>{m}</li>)}</ul>
          )}
          <h3>Missed opportunities</h3>
          {debrief.missedOpportunities.length === 0 ? <p className="muted">No missed opportunities flagged.</p> : (
            <ul className="bullet-list">{debrief.missedOpportunities.map((m, i) => <li key={i}>{m}</li>)}</ul>
          )}
        </section>
        <section className="panel">
          <p className="eyebrow">Alternatives</p>
          <h2>Alternative approaches</h2>
          {debrief.alternativeApproaches.length === 0 ? <p className="muted">No alternative approaches listed.</p> : (
            <ul className="bullet-list">{debrief.alternativeApproaches.map((a, i) => <li key={i}>{a}</li>)}</ul>
          )}
        </section>
      </div>

      <section className="panel">
        <p className="eyebrow">Prediction calibration</p>
        <h2>Your predictions vs. what happened</h2>
        <p className="muted">Preparation assumptions are compared to recorded outcomes. This is evidence for calibration, not a score.</p>
        <div className="prediction-grid">
          <article className="prediction-card">
            <h3>What you predicted</h3>
            {session.preparation?.predictions?.trim() ? (
              <p>{session.preparation.predictions}</p>
            ) : (
              <p className="muted">No predictions were recorded in preparation. Next time, write what you expect the other side to want, fear, or bluff about.</p>
            )}
          </article>
          <article className="prediction-card">
            <h3>What actually happened</h3>
            <ul className="bullet-list">
              <li><strong>Agreement:</strong> {debrief.agreementStatus.replaceAll('_', ' ')}</li>
              <li><strong>Outcome:</strong> {debrief.outcome.title} ({debrief.outcomeQuality} outcome quality)</li>
              <li><strong>Decision quality:</strong> {qualityLabel(debrief.decisionQuality)}</li>
              <li><strong>Key trust movement:</strong> {debrief.trustChanges.length === 0 ? 'No recorded trust changes.' : `${debrief.trustChanges.length} recorded change(s); net ${debrief.trustChanges.reduce((s, t) => s + (t.to - t.from), 0)}.`}</li>
              <li><strong>Objectives met:</strong> {debrief.objectivesMet.filter((o) => o.met).length}/{debrief.objectivesMet.length}</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Hidden reveals</p>
        <h2>What was hidden during negotiation</h2>
        <p className="muted">These are debrief-only reveals returned by the engine after the session. They were not exposed in the briefing.</p>
        {debrief.hiddenReveals.length === 0 ? <p className="muted">No hidden reveals for this case.</p> : (
          <div className="stack-sm">
            {debrief.hiddenReveals.map((r, i) => (
              <article key={i} className="reveal-card">
                <div className="objective-head">
                  <strong>{r.participant}</strong>
                  <span className={`info-badge info-${r.infoClass}`}>{formatInfoClass(r.infoClass)}</span>
                </div>
                <p>{r.reveal}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Skills</p>
        <h2>Skill assessment</h2>
        <p className="muted">Every rating is grounded in recorded actions from this session.</p>
        <div className="skills-grid">
          {debrief.skillAssessment.map((s) => (
            <article key={s.skill} className={`skill-card rating-${s.rating}`}>
              <div className="objective-head">
                <strong>{s.skill.replaceAll('_', ' ')}</strong>
                <span className={`status-pill rating-pill-${s.rating}`}>{ratingLabel(s.rating)}</span>
              </div>
              <p className="small muted">{s.evidence}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Concepts</p>
        <h2>Concept lessons from this negotiation</h2>
        <p className="muted">Contextual lessons grounded in what happened in this session - not generic advice.</p>
        <div className="stack-sm">
          {debrief.conceptLessons.map((c, i) => (
            <article key={i} className="reveal-card">
              <div className="objective-head">
                <strong>{c.concept}</strong>
              </div>
              <p>{c.lesson}</p>
              <p className="small muted"><strong>Evidence:</strong> {c.evidence}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="actions-row">
        <button type="button" className="btn btn-primary" onClick={onRetryCase} disabled={busy}>Try same case again</button>
        <button type="button" className="btn btn-secondary" onClick={onNewCase} disabled={busy}>Choose another case</button>
      </div>
    </div>
  );
}
