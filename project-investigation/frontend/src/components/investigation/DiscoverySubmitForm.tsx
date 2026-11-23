import { useState } from 'react';
import type { FormEvent } from 'react';

interface DiscoverySubmitPayload {
  explanation: string;
  subjectIdentification: string;
  connectionExplanation: string;
  uncertainty: string;
  sourceRefs: string[];
}

export function DiscoverySubmitForm({
  disabled,
  onSubmit,
}: {
  disabled?: boolean;
  onSubmit: (payload: DiscoverySubmitPayload) => Promise<void> | void;
}) {
  const [subjectIdentification, setSubjectIdentification] = useState('');
  const [explanation, setExplanation] = useState('');
  const [connectionExplanation, setConnectionExplanation] = useState('');
  const [uncertainty, setUncertainty] = useState('');
  const [sourceRefs, setSourceRefs] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit({
      subjectIdentification: subjectIdentification.trim(),
      explanation: explanation.trim(),
      connectionExplanation: connectionExplanation.trim(),
      uncertainty: uncertainty.trim(),
      sourceRefs: sourceRefs.split(',').map((s) => s.trim()).filter(Boolean),
    });
  };

  return (
    <form className="cd-form" onSubmit={handleSubmit}>
      <label className="cd-field">
        <span className="cd-field__label">What did you identify?</span>
        <input
          value={subjectIdentification}
          onChange={(e) => setSubjectIdentification(e.target.value)}
          placeholder="Name the subject, source, or finding"
          required
          disabled={disabled}
          aria-label="Identified subject"
        />
      </label>
      <label className="cd-field">
        <span className="cd-field__label">Explanation</span>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Explain what you found and why it matters"
          required
          disabled={disabled}
          aria-label="Explanation"
        />
      </label>
      <label className="cd-field">
        <span className="cd-field__label">Connection to the case</span>
        <textarea
          value={connectionExplanation}
          onChange={(e) => setConnectionExplanation(e.target.value)}
          placeholder="How does this connect to the investigation?"
          disabled={disabled}
          aria-label="Connection to the case"
        />
      </label>
      <label className="cd-field">
        <span className="cd-field__label">Uncertainty or open questions</span>
        <textarea
          value={uncertainty}
          onChange={(e) => setUncertainty(e.target.value)}
          placeholder="What are you still unsure about?"
          disabled={disabled}
          aria-label="Uncertainty"
        />
      </label>
      <label className="cd-field">
        <span className="cd-field__label">Source references</span>
        <input
          value={sourceRefs}
          onChange={(e) => setSourceRefs(e.target.value)}
          placeholder="Comma-separated URLs, titles, or citations"
          disabled={disabled}
          aria-label="Source references"
        />
        <span className="cd-field__hint">Separate multiple references with commas.</span>
      </label>
      <div className="cd-form__actions">
        <button type="submit" disabled={disabled}>{disabled ? 'Submitting…' : 'Submit research'}</button>
      </div>
    </form>
  );
}
