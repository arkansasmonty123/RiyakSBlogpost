import { useEffect, useState } from 'react';
import type { PreparationInput, SessionView } from '@shared/types';

const EMPTY: PreparationInput = {
  objectives: '',
  batna: '',
  reservationPoint: '',
  openingPosition: '',
  leverage: '',
  concessions: '',
  questions: '',
  predictions: '',
  strategy: '',
};

const FIELDS: Array<{ key: keyof PreparationInput; label: string; hint: string; rows?: number }> = [
  { key: 'objectives', label: 'Objectives', hint: 'What does a good outcome look like? What must you achieve?', rows: 3 },
  { key: 'batna', label: 'BATNA', hint: 'Best alternative to a negotiated agreement if this fails.', rows: 3 },
  { key: 'reservationPoint', label: 'Reservation point', hint: 'The least acceptable package before you walk away.', rows: 2 },
  { key: 'openingPosition', label: 'Opening position', hint: 'Where you plan to open and why it is defensible.', rows: 3 },
  { key: 'leverage', label: 'Leverage', hint: 'What gives you influence? What gives them influence?', rows: 3 },
  { key: 'concessions', label: 'Potential concessions', hint: 'What can you trade, and what should you protect?', rows: 3 },
  { key: 'questions', label: 'Questions to investigate', hint: 'What claims, constraints, or interests will you test?', rows: 3 },
  { key: 'predictions', label: 'Predictions about the opposing side', hint: 'What do you expect them to want, fear, or bluff about?', rows: 3 },
  { key: 'strategy', label: 'Initial strategy', hint: 'How will you sequence the conversation and offers?', rows: 4 },
];

export function PreparationView({
  session,
  busy,
  onSave,
  onBack,
}: {
  session: SessionView;
  busy: boolean;
  onSave: (prep: PreparationInput, enterRoom: boolean) => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState<PreparationInput>(EMPTY);

  useEffect(() => {
    setForm({ ...EMPTY, ...(session.preparation ?? {}) });
  }, [session.preparation, session.id]);

  const update = (key: keyof PreparationInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="stack-lg">
      <section className="panel">
        <p className="eyebrow">Preparation</p>
        <h1 className="page-title">Plan before you speak.</h1>
        <p className="lede">
          Record your assumptions and strategy. The debrief will evaluate decision quality based on what happened in the negotiation - preparation helps you think clearly, not guarantee an outcome.
        </p>
      </section>

      <section className="panel">
        <div className="prep-grid">
          {FIELDS.map((field) => (
            <label key={field.key} className="field">
              <span className="field-label">{field.label}</span>
              <span className="field-hint">{field.hint}</span>
              <textarea
                className="input textarea"
                id={`prep-${field.key}`}
                name={field.key}
                rows={field.rows ?? 3}
                value={form[field.key]}
                onChange={(e) => update(field.key, e.target.value)}
                maxLength={4000}
                autoComplete="off"
              />
            </label>
          ))}
        </div>
        <div className="actions-row">
          <button type="button" className="btn btn-ghost" onClick={onBack} disabled={busy}>Back to briefing</button>
          <button type="button" className="btn btn-secondary" onClick={() => onSave(form, false)} disabled={busy}>Save draft</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(form, true)} disabled={busy}>Save & enter room</button>
        </div>
      </section>
    </div>
  );
}
