import type { SessionView, BriefingItem } from '@shared/types';
import { formatInfoClass } from '../utils';

function InfoList({ items, empty }: { items: BriefingItem[]; empty: string }) {
  if (items.length === 0) return <p className="muted">{empty}</p>;
  return (
    <ul className="info-list">
      {items.map((item, i) => (
        <li key={`${item.label}-${i}`} className="info-item">
          <div className="info-item-head">
            <span className="info-label">{item.label}</span>
            <span className={`info-badge info-${item.infoClass}`}>{formatInfoClass(item.infoClass)}</span>
          </div>
          <p className="info-value">{item.value}</p>
        </li>
      ))}
    </ul>
  );
}

export function BriefingView({ session, onContinue }: { session: SessionView; onContinue: () => void }) {
  const b = session.briefing;
  return (
    <div className="stack-lg">
      <section className="panel">
        <p className="eyebrow">Case briefing</p>
        <h1 className="page-title">{b.title}</h1>
        <p className="lede">{b.context}</p>
        <div className="callout callout-warn" role="note">
          <strong>Briefing boundary:</strong> This view shows only information the briefing provides. It does not reveal hidden secrets, private reservations, or undisclosed motivations. Hidden reveals, where applicable, appear only in the debrief returned by the engine.
        </div>
      </section>

      <div className="two-col">
        <section className="panel">
          <p className="eyebrow">Your side</p>
          <h2>Your role</h2>
          <p>{b.playerRole}</p>
          <h3>Objective</h3>
          <p>{b.playerObjective}</p>
          <h3>Minimum acceptable outcome</h3>
          <p>{b.minimumAcceptableOutcome}</p>
          <h3>Priorities</h3>
          <ol className="priority-list">
            {b.playerPriorities.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
          <h3>Constraints</h3>
          <InfoList items={b.playerConstraints} empty="No constraints listed." />
          <h3>Resources / leverage</h3>
          <InfoList items={b.playerResources} empty="No resources listed." />
          <h3>Private information</h3>
          <InfoList items={b.playerPrivateInfo} empty="No private information listed." />
        </section>

        <section className="panel">
          <p className="eyebrow">Opposing side</p>
          <h2>What you know</h2>
          <p className="muted">Intelligence is classified by confidence. Treat reported and unknown items with caution.</p>
          <h3>Stated demands</h3>
          <InfoList items={b.opposingDemands} empty="No demands listed." />
          <h3>Known interests</h3>
          <InfoList items={b.knownInterests} empty="No interests listed." />
          <h3>Available intelligence</h3>
          <InfoList items={b.availableIntelligence} empty="No intelligence listed." />
          <h3>Apparent constraints</h3>
          <InfoList items={b.apparentConstraints} empty="No apparent constraints listed." />
        </section>
      </div>

      <section className="panel">
        <p className="eyebrow">People at the table</p>
        <h2>Participants and relationships</h2>
        <div className="participant-grid">
          {b.participants.map((p) => (
            <article key={p.id} className="participant-card">
              <div className="avatar" style={{ background: p.avatarColor }} aria-hidden="true">
                {p.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </div>
              <div>
                <h3 className="participant-name">{p.name}</h3>
                <p className="muted small">{p.role} · {p.organization}</p>
                <p className="small">{p.bio}</p>
                <p className="small muted"><strong>Style:</strong> {p.personality}</p>
              </div>
            </article>
          ))}
        </div>
        <h3>Known relationships / power structures</h3>
        {b.relationships.length === 0 ? <p className="muted">No relationship intel available.</p> : (
          <ul className="bullet-list">
            {b.relationships.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Issues on the table</p>
        <h2>Negotiable issues</h2>
        <p className="muted">Ranges and your ideal positions are shown. Opposing reservations are not shown in the briefing.</p>
        <div className="issues-table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Issue</th><th>Range</th><th>Your ideal</th><th>Weight</th><th>Description</th></tr>
            </thead>
            <tbody>
              {b.issues.map((issue) => (
                <tr key={issue.id}>
                  <td>{issue.label}</td>
                  <td>{issue.minValue}{issue.unit} – {issue.maxValue}{issue.unit}</td>
                  <td>{issue.playerIdeal}{issue.unit}</td>
                  <td>{issue.weight}</td>
                  <td>{issue.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="actions-row">
        <button type="button" className="btn btn-primary" onClick={onContinue}>Continue to preparation</button>
      </div>
    </div>
  );
}
