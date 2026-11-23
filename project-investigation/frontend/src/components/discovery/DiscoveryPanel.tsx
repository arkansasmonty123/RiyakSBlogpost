import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  DiscoveryClueDetailDTO,
  DiscoveryRecallPromptDTO,
  DiscoverySnapshotDTO,
  DiscoverySubmitResultDTO,
  KnowledgeRecallResultDTO,
  SafeCitationDTO,
  SafeDiscoveryClueDTO,
  SafeDiscoveryStateDTO,
  SafeDiscoveryUnlockRowDTO,
  SafeMemoryItemDTO,
} from '../../api';
import { errorMessage } from '../../api';

interface DiscoveryPanelProps {
  snapshot: DiscoverySnapshotDTO | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onStart: (clueKey: string) => Promise<void>;
  onSubmit: (
    clueKey: string,
    body: {
      explanation: string;
      subjectIdentification?: string;
      connectionExplanation?: string;
      uncertainty?: string;
      sourceRefs?: string[];
      confidence?: string;
    }
  ) => Promise<DiscoverySubmitResultDTO>;
  onApplyUnlock: (clueKey: string, unlockKey: string) => Promise<void>;
  onRecall: (memoryId: string, response: string) => Promise<KnowledgeRecallResultDTO>;
  getClueDetail: (clueKey: string) => Promise<DiscoveryClueDetailDTO>;
  busyClueKey: string | null;
}

function humanize(value: string | null | undefined): string {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function stateLabel(state: string | undefined): string {
  switch (state) {
    case 'noticed': return 'Noticed';
    case 'researching': return 'Researching';
    case 'submitted': return 'Submitted';
    case 'accepted': return 'Accepted';
    case 'dormant': return 'Dormant';
    default: return humanize(state || 'unknown');
  }
}

function Citations({ citations }: { citations: SafeCitationDTO[] }) {
  if (!citations.length) return null;
  return (
    <div className="discovery-citations">
      <h5>Sources &amp; citations</h5>
      <ul className="discovery-citation-list">
        {citations.map((c, i) => (
          <li key={`${c.bibliographyRef}-${i}`} className="discovery-citation">
            <span className="discovery-citation__label">{c.label}</span>
            <span className="muted small-note">{c.bibliographyRef}</span>
            <div className="badges">
              <span className={`badge ${c.sourceVerified ? 'badge--correct' : 'badge--soft'}`}>
                {c.sourceVerified ? 'Source verified' : 'Verification pending'}
              </span>
              {c.verificationStatus && (
                <span className="badge badge--soft">{humanize(c.verificationStatus)}</span>
              )}
            </div>
            {c.sourceUrl ? (
              <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link">
                Open source
              </a>
            ) : (
              <span className="muted small-note">No external URL provided.</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Unlocks({
  unlocks,
  clueKey,
  onApply,
  busy,
}: {
  unlocks: SafeDiscoveryUnlockRowDTO[];
  clueKey: string;
  onApply: (clueKey: string, unlockKey: string) => Promise<void>;
  busy: boolean;
}) {
  if (!unlocks.length) return null;
  return (
    <div className="discovery-unlocks">
      <h5>Unlocked insights</h5>
      <ul className="discovery-unlock-list">
        {unlocks.map((u) => (
          <li key={u.id || u.unlockKey} className="discovery-unlock">
            <div className="badges">
              <span className="badge badge--soft">{humanize(u.kind)}</span>
              {u.applied ? <span className="badge badge--correct">Applied</span> : <span className="badge badge--warning">Ready</span>}
            </div>
            <p><strong>{u.label}</strong></p>
            {u.detail && <p className="muted small-note">{u.detail}</p>}
            {u.kind === 'action' && !u.applied && (
              <button
                type="button"
                className="small-button"
                disabled={busy}
                onClick={() => void onApply(clueKey, u.unlockKey)}
              >
                {busy ? 'Applying…' : 'Apply insight'}
              </button>
            )}
            {u.kind === 'action' && u.applied && (
              <p className="muted small-note">This action insight has been applied to the investigation.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecallCard({
  prompt,
  onRecall,
}: {
  prompt: DiscoveryRecallPromptDTO;
  onRecall: (memoryId: string, response: string) => Promise<KnowledgeRecallResultDTO>;
}) {
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<KnowledgeRecallResultDTO | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!response.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await onRecall(prompt.memoryId, response.trim());
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
        <span className="badge badge--warning">Recall check</span>
        <span className="badge badge--soft">{humanize(prompt.kind)}</span>
      </div>
      <h4>{prompt.subjectLabel}</h4>
      <p>{prompt.prompt}</p>
      {prompt.nextDueAt && <p className="muted small-note">Due: {formatDate(prompt.nextDueAt)}</p>}
      {!open && !result && (
        <button type="button" className="small-button" onClick={() => setOpen(true)}>Try recall</button>
      )}
      {open && !result && (
        <form className="discovery-form" onSubmit={submit}>
          <label className="field-label">
            Your recall
            <textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={3} maxLength={2000} required />
          </label>
          {error && <div className="error">{error}</div>}
          <div className="button-row">
            <button type="submit" className="small-button" disabled={busy || !response.trim()}>
              {busy ? 'Checking…' : 'Submit recall'}
            </button>
            <button type="button" className="link-button" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
      {result && (
        <div className="discovery-eval discovery-eval--neutral" role="status" aria-live="polite">
          <p><strong>Recall outcome:</strong> {humanize(result.recall.outcome)}</p>
          <p className="muted small-note">{result.memory.correctedUnderstanding}</p>
          {result.recall.nextDueAt && <p className="muted small-note">Next review: {formatDate(result.recall.nextDueAt)}</p>}
          <p className="muted small-note">Recall is for learning reinforcement, not punishment.</p>
        </div>
      )}
    </article>
  );
}

function ClueCard({
  clue,
  state,
  isNew,
  unlocks,
  memory,
  busy,
  onStart,
  onSubmit,
  onApplyUnlock,
  getClueDetail,
}: {
  clue: SafeDiscoveryClueDTO;
  state: SafeDiscoveryStateDTO | undefined;
  isNew: boolean;
  unlocks: SafeDiscoveryUnlockRowDTO[];
  memory: SafeMemoryItemDTO | null;
  busy: boolean;
  onStart: (clueKey: string) => Promise<void>;
  onSubmit: DiscoveryPanelProps['onSubmit'];
  onApplyUnlock: DiscoveryPanelProps['onApplyUnlock'];
  getClueDetail: DiscoveryPanelProps['getClueDetail'];
}) {
  const [expanded, setExpanded] = useState(isNew || state?.state === 'researching' || state?.state === 'submitted');
  const [detail, setDetail] = useState<DiscoveryClueDetailDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitResult, setSubmitResult] = useState<DiscoverySubmitResultDTO | null>(null);
  const [explanation, setExplanation] = useState('');
  const [subjectIdentification, setSubjectIdentification] = useState('');
  const [connectionExplanation, setConnectionExplanation] = useState('');
  const [sourceRefs, setSourceRefs] = useState('');
  const [uncertainty, setUncertainty] = useState('');
  const [confidence, setConfidence] = useState('');

  const clueState = submitResult?.state?.state || state?.state || 'noticed';
  const effectiveUnlocks = submitResult?.unlocks?.length ? submitResult.unlocks : unlocks;
  const submissions = detail?.submissions ?? [];

  async function loadDetail() {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const d = await getClueDetail(clue.key);
      setDetail(d);
    } catch (err) {
      setDetailError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && !detail && !detailLoading) void loadDetail();
  }

  async function handleStart() {
    try {
      await onStart(clue.key);
      if (!detail) await loadDetail();
    } catch (err) {
      setDetailError(errorMessage(err));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!explanation.trim() || submitBusy) return;
    setSubmitBusy(true);
    setSubmitError(null);
    try {
      const refs = sourceRefs.split('\n').map((s) => s.trim()).filter(Boolean);
      const result = await onSubmit(clue.key, {
        explanation: explanation.trim(),
        subjectIdentification: subjectIdentification.trim() || undefined,
        connectionExplanation: connectionExplanation.trim() || undefined,
        uncertainty: uncertainty.trim() || undefined,
        sourceRefs: refs.length ? refs : undefined,
        confidence: confidence.trim() || undefined,
      });
      setSubmitResult(result);
      if (result.accepted) {
        setExplanation('');
        setSubjectIdentification('');
        setConnectionExplanation('');
        setSourceRefs('');
        setUncertainty('');
        setConfidence('');
      }
      await loadDetail();
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSubmitBusy(false);
    }
  }

  const accepted = clue.accepted || submitResult?.accepted || clueState === 'accepted';

  return (
    <article className={`detail-card discovery-clue ${isNew ? 'discovery-clue--new' : ''}`}>
      <div className="discovery-clue__header">
        <div className="discovery-clue__heading">
          <div className="badges">
            <span className={`badge ${accepted ? 'badge--correct' : clueState === 'researching' ? 'badge--warning' : 'badge--soft'}`}>{stateLabel(clueState)}</span>
            <span className="badge badge--soft">{humanize(clue.referenceCategory)}</span>
            <span className="badge badge--soft">{humanize(clue.difficulty)}</span>
            <span className="badge badge--soft">{humanize(clue.knowledgeStatus)}</span>
            {isNew && <span className="badge badge--warning">New</span>}
          </div>
          <h4>{clue.title}</h4>
          <p className="muted small-note">Subject: {clue.subjectLabel}</p>
        </div>
        <button type="button" className="small-button" onClick={() => void handleExpand()} aria-expanded={expanded}>
          {expanded ? 'Hide' : 'Open'}
        </button>
      </div>

      <p className="discovery-clue__prompt"><strong>Research question:</strong> {clue.prompt}</p>

      {expanded && (
        <div className="discovery-clue__body">
          <div className="discovery-disclaimer detail-card" role="note">
            <strong>Field research, not case evidence.</strong> This is external knowledge for learning and investigation context. It does not replace case evidence, does not reveal the solution, and is never added to the evidence locker.
          </div>

          <p><strong>What to look for:</strong> {clue.context}</p>

          {clue.evidenceRefs.length > 0 && (
            <p className="muted small-note"><strong>Related case material:</strong> {clue.evidenceRefs.join(', ')}</p>
          )}
          {clue.specialistKeys.length > 0 && (
            <p className="muted small-note"><strong>Relevant specialists:</strong> {clue.specialistKeys.map(humanize).join(', ')}</p>
          )}

          <Citations citations={clue.citations} />

          {clueState === 'noticed' && (
            <div className="button-row">
              <button type="button" className="small-button" disabled={busy} onClick={() => void handleStart()}>
                {busy ? 'Starting…' : 'Start research'}
              </button>
            </div>
          )}

          {(clueState === 'researching' || clueState === 'submitted' || clueState === 'accepted' || clueState === 'dormant') && (
            <form className="discovery-form" onSubmit={handleSubmit}>
              <h5>{accepted ? 'Refine or revisit your explanation' : 'Submit your findings'}</h5>
              <p className="muted small-note">Explain in your own words. You can leave and return later; your state is saved.</p>
              <label className="field-label">
                Explanation <span aria-hidden="true">*</span>
                <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={4} maxLength={4000} required placeholder="What did you learn, and how does it connect to the case?" />
              </label>
              <label className="field-label">
                Subject identification (optional)
                <input type="text" value={subjectIdentification} onChange={(e) => setSubjectIdentification(e.target.value)} maxLength={500} placeholder="What is the core concept or subject?" />
              </label>
              <label className="field-label">
                Connection to case (optional)
                <textarea value={connectionExplanation} onChange={(e) => setConnectionExplanation(e.target.value)} rows={2} maxLength={2000} placeholder="How does this knowledge apply here?" />
              </label>
              <label className="field-label">
                Source references (optional, one per line)
                <textarea value={sourceRefs} onChange={(e) => setSourceRefs(e.target.value)} rows={2} maxLength={1000} placeholder="Book/article/site you used (optional)" />
              </label>
              <label className="field-label">
                Uncertainty / open questions (optional)
                <textarea value={uncertainty} onChange={(e) => setUncertainty(e.target.value)} rows={2} maxLength={1000} placeholder="What are you still unsure about?" />
              </label>
              <label className="field-label">
                Confidence (optional)
                <select value={confidence} onChange={(e) => setConfidence(e.target.value)}>
                  <option value="">Select confidence</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              {submitError && <div className="error">{submitError}</div>}
              <div className="button-row">
                <button type="submit" className="small-button" disabled={submitBusy || !explanation.trim()}>
                  {submitBusy ? 'Evaluating…' : accepted ? 'Submit another explanation' : 'Submit findings'}
                </button>
              </div>
            </form>
          )}

          {submitResult && (
            <div className={`discovery-eval ${submitResult.accepted ? 'discovery-eval--accepted' : 'discovery-eval--pending'}`} role="status" aria-live="polite">
              <h5>Evaluation</h5>
              <div className="badges">
                <span className={`badge ${submitResult.accepted ? 'badge--correct' : 'badge--partial'}`}>{humanize(submitResult.classification)}</span>
                <span className="badge badge--soft">{submitResult.accepted ? 'Accepted' : 'Not yet accepted'}</span>
                {submitResult.duplicate && <span className="badge badge--soft">Duplicate</span>}
              </div>
              {submitResult.submission?.evaluation && (
                <p className="muted small-note">
                  Score: {Math.round(submitResult.submission.evaluation.score * 100)}% · Confidence: {humanize(submitResult.submission.evaluation.confidence || 'unknown')} · {submitResult.submission.evaluation.llmUsed ? 'LLM-assisted review' : 'Deterministic review'}
                </p>
              )}
              {submitResult.accepted && submitResult.correctedUnderstanding && (
                <div className="discovery-correction">
                  <strong>Refined understanding</strong>
                  <p>{submitResult.correctedUnderstanding}</p>
                </div>
              )}
              {!submitResult.accepted && (
                <p className="muted">
                  Not accepted yet. Refine your explanation by being more specific about the concept and its case connection. You can retry anytime.
                </p>
              )}
              {submitResult.disclaimer && <p className="muted small-note">{submitResult.disclaimer}</p>}
            </div>
          )}

          <Unlocks unlocks={effectiveUnlocks} clueKey={clue.key} onApply={onApplyUnlock} busy={busy} />

          {memory && (
            <div className="discovery-memory detail-card">
              <h5>Knowledge memory</h5>
              <div className="badges">
                <span className="badge badge--soft">{humanize(memory.masteryStatus)}</span>
                <span className="badge badge--soft">{humanize(memory.knowledgeStatus)}</span>
              </div>
              <p className="muted small-note">{memory.correctedUnderstanding}</p>
              {memory.concepts.length > 0 && <p className="muted small-note"><strong>Concepts:</strong> {memory.concepts.join(', ')}</p>}
            </div>
          )}

          {submissions.length > 0 && (
            <details className="detail-card discovery-history">
              <summary>Previous submissions ({submissions.length})</summary>
              <div className="card-list">
                {submissions.slice(0, 5).map((s) => (
                  <article key={s.id} className="detail-card">
                    <div className="badges">
                      <span className={`badge ${s.evaluation.accepted ? 'badge--correct' : 'badge--soft'}`}>{humanize(s.evaluation.classification)}</span>
                      {s.createdAt && <span className="badge badge--soft">{formatDate(s.createdAt)}</span>}
                    </div>
                    <p className="muted small-note">{s.explanation}</p>
                  </article>
                ))}
              </div>
            </details>
          )}

          {detailLoading && <p className="muted" role="status">Loading discovery detail…</p>}
          {detailError && <div className="error">{detailError}</div>}
        </div>
      )}
    </article>
  );
}

export function DiscoveryPanel({
  snapshot,
  loading,
  error,
  onRefresh,
  onStart,
  onSubmit,
  onApplyUnlock,
  onRecall,
  getClueDetail,
  busyClueKey,
}: DiscoveryPanelProps) {

  const clues = snapshot?.clues ?? [];
  const statesByKey = useMemo(() => {
    const map = new Map<string, SafeDiscoveryStateDTO>();
    for (const s of snapshot?.states ?? []) map.set(s.clueKey, s);
    return map;
  }, [snapshot?.states]);
  const unlocksByClue = useMemo(() => {
    const map = new Map<string, SafeDiscoveryUnlockRowDTO[]>();
    for (const u of snapshot?.unlocks ?? []) {
      const arr = map.get(u.clueKey) ?? [];
      arr.push(u);
      map.set(u.clueKey, arr);
    }
    return map;
  }, [snapshot?.unlocks]);
  const memoriesBySubject = useMemo(() => {
    const map = new Map<string, SafeMemoryItemDTO>();
    for (const m of snapshot?.memories ?? []) map.set(m.subjectKey, m);
    return map;
  }, [snapshot?.memories]);
  const newKeys = useMemo(() => new Set(snapshot?.newClueKeys ?? []), [snapshot?.newClueKeys]);

  if (loading && !snapshot) {
    return <div className="page-state" role="status">Loading field research…</div>;
  }

  if (error && !snapshot) {
    return (
      <div className="detail-card">
        <div className="error" role="alert">{error}</div>
        <div className="button-row"><button type="button" className="small-button" onClick={() => void onRefresh()}>Retry</button></div>
      </div>
    );
  }

  if (!snapshot?.available) {
    return (
      <section className="detail-card">
        <h3>Field Research</h3>
        <p className="muted">No field research package is available for this case yet. As new discovery packages are authored, they will appear here.</p>
      </section>
    );
  }

  return (
    <section className="discovery-panel" aria-label="Field research discoveries">
      <div className="section-heading">
        <div>
          <h3>Field Research</h3>
          <p className="muted">Investigate real-world concepts connected to this case. These discoveries build knowledge — they are not case evidence and never reveal the solution.</p>
        </div>
        <div className="button-row">
          <button type="button" className="small-button" onClick={() => void onRefresh()} disabled={loading}>Refresh</button>
        </div>
      </div>

      <div className="discovery-disclaimer detail-card" role="note">
        <strong>External knowledge disclaimer.</strong>{' '}
        <span className="muted">{snapshot.disclaimer || 'External knowledge is for learning and investigation context. It does not replace case evidence and does not reveal the case solution.'}</span>
      </div>

      {error && <div className="error" role="status">{error}</div>}

      {snapshot.specialistNotices.length > 0 && (
        <div className="detail-card discovery-notices">
          <h4>Specialist notices</h4>
          <ul className="specialist-list">
            {snapshot.specialistNotices.map((n, i) => (
              <li key={`${n.clueKey}-${n.unlockKey}-${i}`}>
                <strong>{humanize(n.specialistKey)}:</strong> {n.prompt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {snapshot.recallPrompts.length > 0 && (
        <div className="discovery-recalls">
          <div className="section-heading">
            <h4>Recall prompts</h4>
            <span className="muted small-note">Optional reinforcement — no punishment</span>
          </div>
          <div className="card-list">
            {snapshot.recallPrompts.map((p) => (
              <RecallCard key={`${p.memoryId}-${p.kind}`} prompt={p} onRecall={onRecall} />
            ))}
          </div>
        </div>
      )}

      <div className="discovery-clues">
        <div className="section-heading">
          <h4>Discovery clues</h4>
          <span className="muted small-note">{clues.length} clue{clues.length === 1 ? '' : 's'}</span>
        </div>
        {clues.length === 0 ? (
          <p className="empty-state">No discovery clues surfaced yet. Check back as the investigation progresses.</p>
        ) : (
          <div className="card-list">
            {clues.map((clue) => (
              <ClueCard
                key={clue.key}
                clue={clue}
                state={statesByKey.get(clue.key)}
                isNew={newKeys.has(clue.key)}
                unlocks={unlocksByClue.get(clue.key) ?? []}
                memory={memoriesBySubject.get(clue.subjectKey) ?? null}
                busy={busyClueKey === clue.key}
                onStart={onStart}
                onSubmit={onSubmit}
                onApplyUnlock={onApplyUnlock}
                getClueDetail={getClueDetail}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}