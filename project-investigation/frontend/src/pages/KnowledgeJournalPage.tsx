import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import type {
  DiscoveryRecallPromptDTO,
  KnowledgeJournalSubjectDTO,
  KnowledgeRecallResultDTO,
  SafeMemoryItemDTO,
} from '../api';

function humanize(value: string | null | undefined): string {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function RecallPrompt({
  prompt,
  onSubmit,
}: {
  prompt: DiscoveryRecallPromptDTO;
  onSubmit: (memoryId: string, response: string) => Promise<KnowledgeRecallResultDTO>;
}) {
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<KnowledgeRecallResultDTO | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!response.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await onSubmit(prompt.memoryId, response.trim());
      setResult(res);
      setResponse('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="detail-card discovery-recall-card">
      <div className="badges">
        <span className="badge badge--warning">Due recall</span>
        <span className="badge badge--soft">{humanize(prompt.kind)}</span>
      </div>
      <h4>{prompt.subjectLabel}</h4>
      <p>{prompt.prompt}</p>
      {prompt.nextDueAt && <p className="muted small-note">Due: {formatDate(prompt.nextDueAt)}</p>}
      {!result ? (
        <form className="discovery-form" onSubmit={handleSubmit}>
          <label className="field-label">
            Your recall
            <textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={3} maxLength={2000} required />
          </label>
          {error && <div className="error">{error}</div>}
          <button type="submit" className="small-button" disabled={busy || !response.trim()}>
            {busy ? 'Checking…' : 'Submit recall'}
          </button>
        </form>
      ) : (
        <div className="discovery-eval discovery-eval--neutral" role="status" aria-live="polite">
          <p><strong>Outcome:</strong> {humanize(result.recall.outcome)}</p>
          <p className="muted small-note">{result.memory.correctedUnderstanding}</p>
          {result.recall.nextDueAt && <p className="muted small-note">Next review: {formatDate(result.recall.nextDueAt)}</p>}
        </div>
      )}
    </article>
  );
}

function MemoryCard({
  item,
  detail,
  detailLoading,
  expanded,
  onToggle,
  onRecall,
}: {
  item: SafeMemoryItemDTO;
  detail: KnowledgeJournalSubjectDTO | null;
  detailLoading: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRecall: (memoryId: string, response: string) => Promise<KnowledgeRecallResultDTO>;
}) {
  const [recallResponse, setRecallResponse] = useState('');
  const [recallBusy, setRecallBusy] = useState(false);
  const [recallError, setRecallError] = useState<string | null>(null);
  const [recallResult, setRecallResult] = useState<KnowledgeRecallResultDTO | null>(null);

  async function submitRecall(e: FormEvent) {
    e.preventDefault();
    if (!recallResponse.trim() || recallBusy) return;
    setRecallBusy(true);
    setRecallError(null);
    try {
      const res = await onRecall(item.id, recallResponse.trim());
      setRecallResult(res);
      setRecallResponse('');
    } catch (err) {
      setRecallError(errorMessage(err));
    } finally {
      setRecallBusy(false);
    }
  }

  return (
    <article className="detail-card knowledge-memory-card">
      <div className="discovery-clue__header">
        <div>
          <div className="badges">
            <span className="badge badge--soft">{humanize(item.masteryStatus)}</span>
            <span className="badge badge--soft">{humanize(item.knowledgeStatus)}</span>
            <span className="badge badge--soft">{humanize(item.referenceCategory)}</span>
          </div>
          <h3>{item.subjectLabel}</h3>
          <p className="muted small-note">{item.correctedUnderstanding}</p>
        </div>
        <button type="button" className="small-button" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? 'Hide details' : 'View details'}
        </button>
      </div>

      <div className="knowledge-memory-meta">
        <p className="muted small-note"><strong>Concepts:</strong> {item.concepts.length ? item.concepts.join(', ') : '—'}</p>
        <p className="muted small-note"><strong>Successful recalls:</strong> {item.successfulRecalls} · <strong>Failed:</strong> {item.failedRecalls}</p>
        <p className="muted small-note"><strong>Last recall:</strong> {formatDate(item.lastRecallAt)} · <strong>Next review:</strong> {formatDate(item.nextDueAt)}</p>
      </div>

      {item.unresolvedQuestions.length > 0 && (
        <div className="detail-card">
          <h4>Unresolved questions</h4>
          <ul className="specialist-list">
            {item.unresolvedQuestions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}

      {expanded && (
        <div className="knowledge-memory-detail">
          {detailLoading && <p className="muted" role="status">Loading subject detail…</p>}
          {detail && (
            <>
              <div className="detail-card">
                <h4>Sources</h4>
                {detail.memory.authoredSources.length === 0 ? (
                  <p className="muted small-note">No authored sources recorded.</p>
                ) : (
                  <ul className="discovery-citation-list">
                    {detail.memory.authoredSources.map((c, i) => (
                      <li key={`${c.bibliographyRef}-${i}`} className="discovery-citation">
                        <span className="discovery-citation__label">{c.label}</span>
                        <span className="muted small-note">{c.bibliographyRef}</span>
                        <div className="badges">
                          <span className={`badge ${c.sourceVerified ? 'badge--correct' : 'badge--soft'}`}>
                            {c.sourceVerified ? 'Source verified' : 'Verification pending'}
                          </span>
                          <span className="badge badge--soft">{humanize(c.verificationStatus)}</span>
                        </div>
                        {c.sourceUrl ? <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link">Open source</a> : <span className="muted small-note">No external URL provided.</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="detail-card">
                <h4>Applied in cases</h4>
                {detail.applications.length === 0 ? (
                  <p className="muted small-note">No case applications recorded yet.</p>
                ) : (
                  <ul className="specialist-list">
                    {detail.applications.map((a, i) => (
                      <li key={`${a.investigationId}-${a.clueKey}-${i}`}>
                        <strong>{a.caseId}</strong> — {a.applicationContext || a.clueKey} {a.createdAt ? `(${formatDate(a.createdAt)})` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {detail.links.length > 0 && (
                <div className="detail-card">
                  <h4>Related concepts</h4>
                  <ul className="specialist-list">
                    {detail.links.map((l, i) => (
                      <li key={`${l.fromSubjectKey}-${l.toSubjectKey}-${i}`}>
                        <strong>{humanize(l.relationship)}:</strong> {l.fromSubjectKey} → {l.toSubjectKey}
                        {l.rationale ? <span className="muted"> — {l.rationale}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="detail-card">
                <h4>Recall history</h4>
                {detail.recallHistory.length === 0 ? (
                  <p className="muted small-note">No recall history yet.</p>
                ) : (
                  <ul className="specialist-list">
                    {detail.recallHistory.map((r) => (
                      <li key={r.id}>
                        <strong>{humanize(r.recallKind)}</strong>: {humanize(r.outcome)} {r.answeredAt ? `· ${formatDate(r.answeredAt)}` : ''}
                        {r.nextDueAt ? <span className="muted"> · next {formatDate(r.nextDueAt)}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="detail-card">
                <h4>Practice recall now</h4>
                <p className="muted small-note">Optional reinforcement. No punishment for missed recalls.</p>
                <form className="discovery-form" onSubmit={submitRecall}>
                  <label className="field-label">
                    Recall response
                    <textarea value={recallResponse} onChange={(e) => setRecallResponse(e.target.value)} rows={3} maxLength={2000} />
                  </label>
                  {recallError && <div className="error">{recallError}</div>}
                  <button type="submit" className="small-button" disabled={recallBusy || !recallResponse.trim()}>
                    {recallBusy ? 'Checking…' : 'Submit recall'}
                  </button>
                </form>
                {recallResult && (
                  <div className="discovery-eval discovery-eval--neutral" role="status" aria-live="polite">
                    <p><strong>Outcome:</strong> {humanize(recallResult.recall.outcome)}</p>
                    <p className="muted small-note">Next review: {formatDate(recallResult.recall.nextDueAt)}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export const KnowledgeJournalPage = () => {
  const [items, setItems] = useState<SafeMemoryItemDTO[]>([]);
  const [duePrompts, setDuePrompts] = useState<DiscoveryRecallPromptDTO[]>([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, KnowledgeJournalSubjectDTO | null>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getKnowledgeJournal();
      setItems(Array.isArray(data.items) ? data.items : []);
      setDuePrompts(Array.isArray(data.duePrompts) ? data.duePrompts : []);
      setDisclaimer(data.disclaimer || '');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggleSubject(subjectKey: string) {
    if (expandedKey === subjectKey) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(subjectKey);
    if (!details[subjectKey]) {
      setDetailLoading(subjectKey);
      try {
        const detail = await api.getKnowledgeJournalSubject(subjectKey);
        setDetails((prev) => ({ ...prev, [subjectKey]: detail }));
      } catch {
        setDetails((prev) => ({ ...prev, [subjectKey]: null }));
      } finally {
        setDetailLoading(null);
      }
    }
  }

  async function handleRecall(memoryId: string, response: string) {
    const result = await api.submitKnowledgeRecall(memoryId, { response });
    await load();
    if (expandedKey) {
      try {
        const detail = await api.getKnowledgeJournalSubject(expandedKey);
        setDetails((prev) => ({ ...prev, [expandedKey]: detail }));
      } catch { /* ignore */ }
    }
    return result;
  }

  return (
    <div className="archive-page page-enter">
      <div className="page-heading">
        <div>
          <h2>Knowledge Journal</h2>
          <p className="muted">What you&apos;ve learned from field research across investigations. External knowledge supports your reasoning; it never replaces case evidence.</p>
        </div>
        <Link className="text-link" to="/">Back to case library</Link>
      </div>

      {disclaimer && (
        <div className="discovery-disclaimer detail-card" role="note">
          <strong>Knowledge disclaimer.</strong> <span className="muted">{disclaimer}</span>
        </div>
      )}

      {loading && <div className="page-state" role="status">Loading knowledge journal…</div>}
      {error && <div className="error" role="alert">{error}</div>}

      {!loading && !error && duePrompts.length > 0 && (
        <section className="discovery-recalls" aria-label="Due recall prompts">
          <div className="section-heading">
            <h3>Due recalls</h3>
            <span className="muted small-note">Optional reinforcement</span>
          </div>
          <div className="card-list">
            {duePrompts.map((p) => (
              <RecallPrompt key={`${p.memoryId}-${p.kind}`} prompt={p} onSubmit={handleRecall} />
            ))}
          </div>
        </section>
      )}

      {!loading && !error && (
        <section aria-label="Knowledge memories">
          <div className="section-heading">
            <h3>Learned subjects</h3>
            <span className="muted small-note">{items.length} item{items.length === 1 ? '' : 's'}</span>
          </div>
          {items.length === 0 ? (
            <div className="empty-state">
              <p>No knowledge memories yet. Complete field research discoveries during investigations to build your journal.</p>
              <Link className="button-link" to="/">Browse cases</Link>
            </div>
          ) : (
            <div className="card-list">
              {items.map((item) => (
                <MemoryCard
                  key={item.id}
                  item={item}
                  detail={details[item.subjectKey] ?? null}
                  detailLoading={detailLoading === item.subjectKey}
                  expanded={expandedKey === item.subjectKey}
                  onToggle={() => void toggleSubject(item.subjectKey)}
                  onRecall={handleRecall}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};