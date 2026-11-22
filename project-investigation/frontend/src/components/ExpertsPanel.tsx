import { useState } from 'react';
import type {
  KnowledgeDepth,
  KnowledgeIntent,
  PublicCaseKnowledgePack,
  PublicDisagreement,
  PublicSpecialist,
} from '../api';

interface ExpertsPanelProps {
  pack?: PublicCaseKnowledgePack | null;
  specialists: PublicSpecialist[];
  disagreements: PublicDisagreement[];
  selectedSpecialistKey: string | null;
  selectedIntent: KnowledgeIntent;
  selectedDepth: KnowledgeDepth;
  onSelectSpecialist: (key: string | null) => void;
  onSelectIntent: (intent: KnowledgeIntent) => void;
  onSelectDepth: (depth: KnowledgeDepth) => void;
  onAskSpecialist: (specialistKey: string, intent: KnowledgeIntent, depth: KnowledgeDepth) => void;
  onAskCritique: (specialistKey: string, targetSpecialistKey: string) => void;
  onFocusChat: () => void;
}

const INTENTS: Array<{ id: KnowledgeIntent; label: string; hint: string }> = [
  { id: 'explain', label: 'Explain', hint: 'Frame the core concept' },
  { id: 'deeper', label: 'Go deeper', hint: 'Mechanism and detail' },
  { id: 'relevance', label: 'Relevance', hint: 'What matters for the case' },
  { id: 'challenge', label: 'Challenge', hint: 'Pressure a quick conclusion' },
  { id: 'alternatives', label: 'Alternatives', hint: 'Keep other readings open' },
  { id: 'discriminate', label: 'Discriminate', hint: 'How to tell possibilities apart' },
  { id: 'sources', label: 'Sources', hint: 'Established references' },
  { id: 'simpler', label: 'Simpler', hint: 'Plain-language explanation' },
  { id: 'critique', label: 'Critique', hint: 'Critical read of reasoning' },
];

const DEPTHS: Array<{ id: KnowledgeDepth; label: string }> = [
  { id: 'plain', label: 'Plain' },
  { id: 'working', label: 'Working' },
  { id: 'technical', label: 'Technical' },
];

export function ExpertsPanel({
  pack,
  specialists,
  disagreements,
  selectedSpecialistKey,
  selectedIntent,
  selectedDepth,
  onSelectSpecialist,
  onSelectIntent,
  onSelectDepth,
  onAskSpecialist,
  onAskCritique,
  onFocusChat,
}: ExpertsPanelProps) {
  const [openDisagreement, setOpenDisagreement] = useState<string | null>(null);

  return (
    <section className="experts-panel" aria-label="Expert specialists">
      <div className="section-heading">
        <h3>Case Experts</h3>
        <span className="muted">{specialists.length} specialist{specialists.length === 1 ? '' : 's'} available</span>
      </div>
      <p className="muted">
        Specialists offer discipline-grounded perspectives on evidence and methods. Their views can
        disagree, and disagreement is informative — not a verdict.
      </p>

      {pack && (
        <section className="detail-card knowledge-pack-summary" aria-label="Case knowledge pack">
          <div className="badges">
            <span className="badge">Knowledge pack v{pack.version}</span>
            <span className="badge badge--soft">Review: {pack.packStatus.replace(/_/g, ' ')}</span>
          </div>
          {pack.summary && <p className="muted">{pack.summary}</p>}
          {pack.learningObjectives.length > 0 && (
            <>
              <h4>Learning objectives for this case</h4>
              <ul className="specialist-list">
                {pack.learningObjectives.map((objective) => <li key={objective}>{objective}</li>)}
              </ul>
            </>
          )}
          <p className="muted small-note">
            Reference material: {pack.counts.specialists} specialists · {pack.counts.artifacts} artifacts · {pack.counts.disagreements} disagreements
          </p>
        </section>
      )}

      {specialists.length === 0 ? (
        <p className="empty-state">No specialists are assigned to this case.</p>
      ) : (
        <div className="experts-layout">
          <div className="specialist-grid">
            {specialists.map((specialist) => {
              const active = selectedSpecialistKey === specialist.specialistKey;
              return (
                <article
                  key={specialist.id}
                  className={active ? 'detail-card specialist-card specialist-card--active' : 'detail-card specialist-card'}
                >
                  <div className="specialist-card__header">
                    <div>
                      <h4>{specialist.name}</h4>
                      <p className="muted specialist-card__title">{specialist.title}</p>
                    </div>
                    {active && <span className="badge badge--confirmed">Selected</span>}
                  </div>

                  <div className="badges">
                    <span className="badge">{specialist.discipline}</span>
                    {specialist.isFictional ? (
                      <span className="badge badge--fictional">Fictional persona</span>
                    ) : (
                      <span className="badge">Real discipline</span>
                    )}
                  </div>

                  <p className="specialist-card__summary">{specialist.expertiseSummary}</p>

                  {specialist.knowledgeDomains.length > 0 && (
                    <div className="specialist-meta">
                      <span className="specialist-meta__label">Domains</span>
                      <div className="badges">
                        {specialist.knowledgeDomains.map((domain) => (
                          <span key={domain} className="badge badge--soft">{domain}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {specialist.caseRelevance && (
                    <p className="muted"><strong>Case relevance:</strong> {specialist.caseRelevance}</p>
                  )}

                  {specialist.limitations.length > 0 && (
                    <div className="specialist-meta">
                      <span className="specialist-meta__label">Limitations</span>
                      <ul className="specialist-list">
                        {specialist.limitations.map((limit, i) => (
                          <li key={i}>{limit}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="specialist-meta">
                    <span className="specialist-meta__label">Depth guidance</span>
                    <dl className="depth-guidance">
                      {(['plain', 'working', 'technical'] as KnowledgeDepth[]).map((depth) => {
                        const text = specialist.depthGuidance?.[depth];
                        if (!text) return null;
                        return (
                          <div key={depth} className="depth-guidance__row">
                            <dt>{depth}</dt>
                            <dd>{text}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>

                  <details className="specialist-details">
                    <summary>Persona &amp; method</summary>
                    <p><strong>Personality:</strong> {specialist.personality}</p>
                    <p><strong>Communication:</strong> {specialist.communicationStyle}</p>
                    <p><strong>Reasoning:</strong> {specialist.reasoningApproach}</p>
                    <p className="muted"><strong>Real discipline basis:</strong> {specialist.realDisciplineBasis}</p>
                  </details>

                  <div className="button-row">
                    <button
                      type="button"
                      className="small-button"
                      onClick={() => {
                        onSelectSpecialist(specialist.specialistKey);
                        onFocusChat();
                      }}
                    >
                      {active ? 'Selected for chat' : 'Ask in chat'}
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => onAskSpecialist(specialist.specialistKey, 'explain', selectedDepth)}
                    >
                      Quick explain
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="experts-controls" aria-label="Specialist chat controls">
            <div className="detail-card">
              <h4>Ask a specialist</h4>
              <p className="muted">Choose who to address, how deep to go, and what kind of response you need.</p>

              <label className="field-label">
                Specialist
                <select
                  value={selectedSpecialistKey ?? ''}
                  onChange={(e) => onSelectSpecialist(e.target.value || null)}
                >
                  <option value="">Investigation team (default)</option>
                  {specialists.map((s) => (
                    <option key={s.specialistKey} value={s.specialistKey}>{s.name} — {s.discipline}</option>
                  ))}
                </select>
              </label>

              <div className="field-label">
                <span>Depth</span>
                <div className="chip-row" role="radiogroup" aria-label="Response depth">
                  {DEPTHS.map((depth) => (
                    <button
                      key={depth.id}
                      type="button"
                      className={selectedDepth === depth.id ? 'chip chip--active' : 'chip'}
                      aria-pressed={selectedDepth === depth.id}
                      onClick={() => onSelectDepth(depth.id)}
                    >
                      {depth.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-label">
                <span>Intent preset</span>
                <div className="intent-grid">
                  {INTENTS.map((intent) => (
                    <button
                      key={intent.id}
                      type="button"
                      className={selectedIntent === intent.id ? 'intent-button intent-button--active' : 'intent-button'}
                      aria-pressed={selectedIntent === intent.id}
                      onClick={() => onSelectIntent(intent.id)}
                      title={intent.hint}
                    >
                      <span className="intent-button__label">{intent.label}</span>
                      <span className="intent-button__hint">{intent.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="muted small-note">
                Selected intent is sent with your next specialist chat message. Use “Critique” from a
                disagreement to ask one specialist to respond to another.
              </p>
            </div>
          </aside>
        </div>
      )}

      <div className="disagreements-section">
        <div className="section-heading">
          <h4>Disagreements</h4>
          <span className="muted">{disagreements.length} recorded</span>
        </div>
        <p className="muted">
          These are disciplined disagreements between experts. They highlight uncertainty and what
          evidence would discriminate between positions — they do not identify a culprit or solution.
        </p>

        {disagreements.length === 0 ? (
          <p className="empty-state">No specialist disagreements recorded for this case.</p>
        ) : (
          <div className="card-list">
            {disagreements.map((d) => {
              const open = openDisagreement === d.id;
              return (
                <article key={d.id} className="detail-card disagreement-card">
                  <button
                    type="button"
                    className="disagreement-card__toggle"
                    aria-expanded={open}
                    onClick={() => setOpenDisagreement(open ? null : d.id)}
                  >
                    <span>
                      <span className="badge">Disagreement</span>
                      <h5 className="disagreement-card__topic">{d.topic}</h5>
                    </span>
                    <span className="disagreement-card__chevron" aria-hidden="true">{open ? '−' : '+'}</span>
                  </button>

                  {open && (
                    <div className="disagreement-card__body">
                      <div className="disagreement-positions">
                        <div className="disagreement-position">
                          <p className="disagreement-position__name">{d.specialistAName}</p>
                          <p>{d.positionA}</p>
                          <button
                            type="button"
                            className="small-button"
                            onClick={() => onAskCritique(d.specialistAKey, d.specialistBKey)}
                          >
                            Ask {d.specialistAName.split(' ')[0]} to critique {d.specialistBName.split(' ')[0]}
                          </button>
                        </div>
                        <div className="disagreement-position">
                          <p className="disagreement-position__name">{d.specialistBName}</p>
                          <p>{d.positionB}</p>
                          <button
                            type="button"
                            className="small-button"
                            onClick={() => onAskCritique(d.specialistBKey, d.specialistAKey)}
                          >
                            Ask {d.specialistBName.split(' ')[0]} to critique {d.specialistAName.split(' ')[0]}
                          </button>
                        </div>
                      </div>

                      <dl className="disagreement-meta">
                        <dt>Disciplinary basis</dt>
                        <dd>{d.disciplinaryBasis}</dd>
                        <dt>Uncertainty</dt>
                        <dd>{d.uncertaintyNote}</dd>
                        <dt>Distinguishing evidence</dt>
                        <dd>{d.distinguishingEvidence}</dd>
                      </dl>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
