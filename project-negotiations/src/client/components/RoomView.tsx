import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, Offer, OfferTerm, SendMessageRequest, SessionView } from '@shared/types';
import { clamp, timeAgo } from '../utils';

interface Props {
  session: SessionView;
  busy: boolean;
  onSend: (input: SendMessageRequest) => Promise<unknown> | void;
  onWalkAway: () => void;
  onFinalize: () => void;
  onViewDebrief: () => void;
}

function isOpenOffer(offer: Offer): boolean {
  return offer.status === 'proposed' || offer.status === 'countered';
}

function senderClass(msg: ChatMessage): string {
  if (msg.senderType === 'player') return 'msg msg-player';
  if (msg.senderType === 'system') return 'msg msg-system';
  return 'msg msg-participant';
}

function offerStatusLabel(status: Offer['status']): string {
  return status.replaceAll('_', ' ');
}

const SUGGESTED_OPENERS = [
  'What is your top priority here, and where do you have room to move?',
  'Before we discuss terms, can you walk me through what a fair outcome looks like to you?',
  'I would like to understand your constraints. What is hardest for you to concede?',
];

function formatTerms(offer: Offer, issues: SessionView['briefing']['issues']): string {
  return offer.terms
    .map((t) => {
      const issue = issues.find((i) => i.id === t.issueId);
      return issue ? `${issue.label}: ${t.value}${issue.unit}` : `${t.issueId}: ${t.value}`;
    })
    .join(' · ');
}

function idealAlignment(terms: OfferTerm[], issues: SessionView['briefing']['issues']): number | null {
  if (terms.length === 0) return null;
  let weighted = 0;
  let total = 0;
  for (const term of terms) {
    const issue = issues.find((i) => i.id === term.issueId);
    if (!issue) continue;
    const range = issue.maxValue - issue.minValue || 1;
    const closeness = 1 - Math.abs(term.value - issue.playerIdeal) / range;
    const w = issue.weight > 0 ? issue.weight : 1;
    weighted += clamp(closeness, 0, 1) * w;
    total += w;
  }
  if (total === 0) return null;
  return Math.round((weighted / total) * 100);
}

export function RoomView({ session, busy, onSend, onWalkAway, onFinalize, onViewDebrief }: Props) {
  const [text, setText] = useState('');
  const [target, setTarget] = useState('group');
  const [offerMode, setOfferMode] = useState<'offer' | 'counteroffer'>('offer');
  const [offerValues, setOfferValues] = useState<Record<string, number>>({});
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [confirmWalkAway, setConfirmWalkAway] = useState(false);
  const [sceneExpanded, setSceneExpanded] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const prevCount = useRef<number>(session.messages.length);

  const issues = session.briefing.issues;
  const participants = session.briefing.participants.filter((p) => !p.isPlayerProxy);

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const issue of issues) next[issue.id] = issue.playerIdeal;
    setOfferValues(next);
  }, [session.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const count = session.messages.length;
    if (count !== prevCount.current) {
      prevCount.current = count;
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
      const last = session.messages[session.messages.length - 1];
      if (last && liveRef.current) {
        liveRef.current.textContent = `New message from ${last.senderName}: ${last.content.slice(0, 120)}`;
      }
    }
  }, [session.messages]);

  const openOffers = useMemo(() => session.offers.filter(isOpenOffer), [session.offers]);
  const latestOpen = openOffers[openOffers.length - 1];

  useEffect(() => {
    if (!selectedOfferId && latestOpen) setSelectedOfferId(latestOpen.id);
    if (selectedOfferId && !session.offers.some((o) => o.id === selectedOfferId)) {
      setSelectedOfferId(latestOpen?.id ?? '');
    }
  }, [selectedOfferId, latestOpen, session.offers]);

  const currentOfferTerms: OfferTerm[] = useMemo(
    () => issues.map((i) => ({ issueId: i.id, value: Number(offerValues[i.id] ?? i.playerIdeal) })),
    [issues, offerValues],
  );
  const alignment = useMemo(() => idealAlignment(currentOfferTerms, issues), [currentOfferTerms, issues]);

  const selectedOffer = session.offers.find((o) => o.id === selectedOfferId);
  const closed = session.status === 'completed' || session.status === 'abandoned';

  const jumpToComposer = () => {
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submitText = async () => {
    const content = text.trim();
    if (!content || busy || closed) return;
    const result = await onSend({ content, target });
    if (result) setText('');
  };

  const submitOffer = async () => {
    if (busy || closed) return;
    const type = offerMode;
    const content =
      text.trim() ||
      (type === 'counteroffer'
        ? `I propose a counteroffer: ${formatTerms({ terms: currentOfferTerms } as Offer, issues)}.`
        : `I propose an offer: ${formatTerms({ terms: currentOfferTerms } as Offer, issues)}.`);
    const payload: SendMessageRequest = {
      content,
      target,
      type,
      offerTerms: currentOfferTerms,
    };
    if (type === 'counteroffer' && selectedOfferId) payload.offerId = selectedOfferId;
    await onSend(payload);
    setText('');
  };

  const respondToOffer = async (offer: Offer, action: 'accept' | 'reject' | 'withdraw') => {
    if (busy || closed) return;
    const verb = action === 'accept' ? 'accept' : action === 'reject' ? 'reject' : 'withdraw';
    await onSend({
      content: `I ${verb} the offer from ${offer.proposerName}.`,
      target: 'group',
      type: action,
      offerId: offer.id,
    });
  };

  return (
    <div className="room-layout">
      <div className="sr-only" aria-live="polite" aria-atomic="true" ref={liveRef}></div>

      <section className="panel room-stage" aria-label="Meeting room">
        <div className="room-header">
          <div>
            <p className="eyebrow">Negotiation room</p>
            <h1 className="page-title">{session.case.title}</h1>
            <p className="muted small">
              Static simulation room. Messages are chat; commitments are tracked by the deterministic engine.
            </p>
          </div>
          <div className="room-status">
            <span className={`status-pill status-${session.status}`}>{session.status}</span>
            <span className={`status-pill status-${session.agreementStatus}`}>agreement: {session.agreementStatus.replaceAll('_', ' ')}</span>
          </div>
        </div>

        <div className="compact-participants" aria-label="At the table">
          {participants.map((p) => (
            <span key={p.id} className="compact-participant" title={`${p.role} · ${p.organization}`}>
              <span className="compact-participant-dot" style={{ background: p.avatarColor }} aria-hidden="true" />
              {p.name}
            </span>
          ))}
        </div>
        <div className="scene-toggle-row">
          <button type="button" className="btn btn-ghost btn-small" aria-expanded={sceneExpanded} onClick={() => setSceneExpanded((v) => !v)}>
            {sceneExpanded ? 'Hide room table & trust cues' : 'Show room table & trust cues'}
          </button>
        </div>

        <div className={`table-scene${sceneExpanded ? '' : ' is-collapsed'}`} aria-label="Meeting room">
          <div className="room-atmosphere" aria-hidden="true">
            <span className="room-lamp room-lamp-left" />
            <span className="room-lamp room-lamp-right" />
          </div>
          <div className="table-surface" aria-hidden="true">
            <div className="table-center">
              <span>The Table</span>
              <small>Structured offers validated by the engine</small>
            </div>
          </div>
          <div className="seat-grid">
            {participants.map((p) => {
              const trust = session.trust.find((t) => t.participantId === p.id);
              return (
                <article key={p.id} className="seat-card">
                  <div className="avatar" style={{ background: p.avatarColor }} aria-hidden="true">
                    {p.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div className="seat-body">
                    <div className="seat-name-row">
                      <h2 className="seat-name">{p.name}</h2>
                      {trust && <span className="trust-chip" title="Trust score tracked by engine">Trust {trust.score}</span>}
                    </div>
                    <p className="muted small">{p.role}</p>
                    <p className="muted small">{p.organization}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="transcript-shell">
          <div className="transcript-head">
            <div>
              <h2>Transcript</h2>
              <p className="muted small">Target a participant or address the whole group. New messages are announced to screen readers.</p>
            </div>
            <button type="button" className="btn btn-secondary btn-small transcript-jump" onClick={jumpToComposer}>Jump to composer</button>
          </div>
          <div className="transcript-log" ref={logRef} role="log" aria-label="Negotiation transcript" aria-live="off">
            {session.messages.length === 0 ? (
              <div className="empty-transcript">No messages yet. Open with a question, a position, or a structured offer.</div>
            ) : session.messages.map((msg) => {
              const isFallback = msg.meta?.source === 'deterministic_fallback';
              return (
                <article key={msg.id} className={senderClass(msg)}>
                  <div className="msg-meta">
                    <span className="msg-sender">{msg.senderName}</span>
                    <span className="msg-target">{msg.target === 'group' ? 'to group' : `to ${msg.target}`}</span>
                    <span className="msg-time">{timeAgo(msg.createdAt)}</span>
                    {isFallback && <span className="source-badge source-fallback" title="Generated deterministically, not by an LLM">Deterministic fallback</span>}
                    {msg.meta?.source === 'llm' && <span className="source-badge source-llm">LLM</span>}
                  </div>
                  <p className="msg-content">{msg.content}</p>
                </article>
              );
            })}
          </div>
        </div>

        <div className="composer-grid">
          <section className="composer panel-sub" aria-label="Message composer" ref={composerRef}>
            <h3>Send message</h3>
            <label className="field">
              <span className="field-label">Target</span>
              <select className="input" value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy || closed}>
                <option value="group">Whole group</option>
                {participants.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Message</span>
              <textarea
                className="input textarea"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ask a question, challenge a claim, state a position, or explain an offer…"
                maxLength={4000}
                autoComplete="off"
                disabled={busy || closed}
              />
            </label>
            {session.messages.length === 0 && !closed && (
              <div className="suggested-prompts" aria-label="Suggested opening lines">
                {SUGGESTED_OPENERS.map((opener) => (
                  <button
                    key={opener}
                    type="button"
                    className="suggested-prompt"
                    disabled={busy}
                    onClick={() => setText(opener)}
                  >
                    {opener}
                  </button>
                ))}
              </div>
            )}
            <div className="actions-row">
              <button type="button" className="btn btn-primary" onClick={() => void submitText()} disabled={busy || closed || !text.trim()}>
                {busy ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </section>

          <section className="composer panel-sub" aria-label="Structured offer panel">
            <h3>Structured offer</h3>
            <p className="muted small">Numeric terms are sent as structured data. Free text never creates offer terms.</p>
            <div className="field-row">
              <label className="field">
                <span className="field-label">Offer type</span>
                <select className="input" value={offerMode} onChange={(e) => setOfferMode(e.target.value as 'offer' | 'counteroffer')} disabled={busy || closed}>
                  <option value="offer">Offer</option>
                  <option value="counteroffer">Counteroffer</option>
                </select>
              </label>
              {offerMode === 'counteroffer' && (
                <label className="field">
                  <span className="field-label">Parent offer</span>
                  <select className="input" value={selectedOfferId} onChange={(e) => setSelectedOfferId(e.target.value)} disabled={busy || closed}>
                    <option value="">Latest open offer</option>
                    {openOffers.map((o) => (
                      <option key={o.id} value={o.id}>{o.proposerName} — {offerStatusLabel(o.status)}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="offer-issues">
              {issues.map((issue) => {
                const value = Number(offerValues[issue.id] ?? issue.playerIdeal);
                return (
                  <div key={issue.id} className="offer-issue">
                    <div className="offer-issue-head">
                      <label className="field-label" htmlFor={`issue-${issue.id}`}>{issue.label}</label>
                      <span className="muted small">{issue.minValue}{issue.unit}–{issue.maxValue}{issue.unit} · ideal {issue.playerIdeal}{issue.unit}</span>
                    </div>
                    <div className="offer-issue-controls">
                      <input
                        id={`issue-${issue.id}`}
                        className="input"
                        type="range"
                        min={issue.minValue}
                        max={issue.maxValue}
                        step="1"
                        value={value}
                        onChange={(e) => setOfferValues((prev) => ({ ...prev, [issue.id]: Number(e.target.value) }))}
                        disabled={busy || closed}
                      />
                      <input
                        className="input offer-number"
                        type="number"
                        min={issue.minValue}
                        max={issue.maxValue}
                        value={value}
                        onChange={(e) => setOfferValues((prev) => ({ ...prev, [issue.id]: clamp(Number(e.target.value), issue.minValue, issue.maxValue) }))}
                        disabled={busy || closed}
                        aria-label={`${issue.label} value`}
                      />
                      <span className="unit">{issue.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="alignment-meter" aria-label="Estimated alignment to your ideal">
              <div className="alignment-head">
                <span>Closeness to your ideal</span>
                <strong>{alignment ?? '—'}{alignment !== null ? '%' : ''}</strong>
              </div>
              <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={alignment ?? 0}>
                <div className="meter-fill" style={{ width: `${alignment ?? 0}%` }} />
              </div>
              <p className="muted small">Estimate based on issue weights and distance from your stated ideal. The engine determines actual outcome quality.</p>
            </div>

            <div className="actions-row">
              <button type="button" className="btn btn-primary" onClick={() => void submitOffer()} disabled={busy || closed}>
                {busy ? 'Sending…' : offerMode === 'counteroffer' ? 'Send counteroffer' : 'Send offer'}
              </button>
            </div>
          </section>
        </div>
      </section>

      <aside className="room-sidebar">
        <section className="panel">
          <p className="eyebrow">Open offers</p>
          <h2>Offer actions</h2>
          {openOffers.length === 0 ? <p className="muted">No open offers.</p> : (
            <div className="offer-list">
              {openOffers.map((offer) => {
                const mine = offer.proposerType === 'player';
                return (
                  <article key={offer.id} className="offer-card">
                    <div className="offer-card-head">
                      <strong>{offer.proposerName}</strong>
                      <span className={`status-pill status-${offer.status}`}>{offerStatusLabel(offer.status)}</span>
                    </div>
                    <p className="small muted">{timeAgo(offer.createdAt)}</p>
                    <p className="small">{formatTerms(offer, issues)}</p>
                    <p className="small muted">{offer.message}</p>
                    <div className="actions-row wrap">
                      {!mine && (
                        <>
                          <button type="button" className="btn btn-small btn-primary" disabled={busy || closed} onClick={() => void respondToOffer(offer, 'accept')}>Accept</button>
                          <button type="button" className="btn btn-small btn-secondary" disabled={busy || closed} onClick={() => void respondToOffer(offer, 'reject')}>Reject</button>
                        </>
                      )}
                      {mine && (
                        <button type="button" className="btn btn-small btn-secondary" disabled={busy || closed} onClick={() => void respondToOffer(offer, 'withdraw')}>Withdraw</button>
                      )}
                      {offerMode === 'counteroffer' && (
                        <button type="button" className="btn btn-small btn-ghost" disabled={busy || closed} onClick={() => setSelectedOfferId(offer.id)}>Use as parent</button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <p className="eyebrow">Session controls</p>
          <h2>End or review</h2>
          <p className="muted small">Walking away or finalizing ends the negotiation. The engine computes the debrief.</p>
          {closed ? (
            <div className="stack-sm">
              <p>This session is {session.status}.</p>
              <button type="button" className="btn btn-primary" onClick={onViewDebrief} disabled={busy}>View debrief</button>
            </div>
          ) : (
            <div className="stack-sm">
              {!confirmWalkAway ? (
                <button type="button" className="btn btn-danger" onClick={() => setConfirmWalkAway(true)} disabled={busy}>Walk away</button>
              ) : (
                <div className="callout callout-danger">
                  <p><strong>Walk away from this negotiation?</strong> This ends the session without a validated agreement.</p>
                  <div className="actions-row wrap">
                    <button type="button" className="btn btn-danger" onClick={onWalkAway} disabled={busy}>Confirm walk away</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setConfirmWalkAway(false)} disabled={busy}>Cancel</button>
                  </div>
                </div>
              )}
              <button type="button" className="btn btn-secondary" onClick={onFinalize} disabled={busy}>Finalize / compute debrief</button>
              <p className="muted small">Finalize is useful if negotiation has stalled. If there's no validated agreement, outcome will reflect that.</p>
            </div>
          )}
        </section>

        <section className="panel">
          <p className="eyebrow">Live trust</p>
          <h2>Trust signals</h2>
          <div className="trust-list">
            {session.trust.map((t) => {
              const p = session.briefing.participants.find((x) => x.id === t.participantId);
              return (
                <div key={t.participantId} className="trust-row">
                  <div className="trust-row-head"><span>{p?.name ?? t.participantId}</span><span>{t.score}</span></div>
                  <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={t.score} aria-label={`${p?.name ?? t.participantId} trust`}>
                    <div className="meter-fill" style={{ width: `${t.score}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </aside>
    </div>
  );
}
