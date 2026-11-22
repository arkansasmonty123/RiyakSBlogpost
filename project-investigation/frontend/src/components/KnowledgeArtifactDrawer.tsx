import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import type { PublicArtifactDetail, PublicArtifactSummary } from '../api';

interface KnowledgeArtifactDrawerProps {
  caseId: string;
  artifact: PublicArtifactSummary;
  onClose: () => void;
  onSave: (artifact: PublicArtifactSummary | PublicArtifactDetail) => void;
  onAsk: (artifact: PublicArtifactSummary | PublicArtifactDetail) => void;
  saving?: boolean;
}

function label(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function badgeClassForStatus(status: string): string {
  switch (status) {
    case 'verified': return 'badge badge--confirmed';
    case 'rejected': return 'badge badge--incorrect';
    case 'pending_review':
    case 'needs_reverification': return 'badge badge--warning';
    default: return 'badge badge--soft';
  }
}

export function KnowledgeArtifactDrawer({
  caseId,
  artifact,
  onClose,
  onSave,
  onAsk,
  saving,
}: KnowledgeArtifactDrawerProps) {
  const [detail, setDetail] = useState<PublicArtifactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [depthTab, setDepthTab] = useState<'plain' | 'working' | 'technical'>('working');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    api
      .getArtifactDetail(caseId, artifact.id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, artifact.id]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const current = detail ?? artifact;
  const verifiedUrl = current.sourceVerified ? current.sourceUrl : null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog dialog--drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="artifact-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <p className="auth-form__eyebrow">Knowledge artifact</p>
            <h3 id="artifact-drawer-title">{current.title}</h3>
          </div>
          <button type="button" className="small-button" onClick={onClose} aria-label="Close artifact details">
            Close
          </button>
        </div>

        <div className="badges">
          <span className="badge">{label(current.artifactType || 'artifact')}</span>
          <span className="badge">{label(current.knowledgeClass || 'reference')}</span>
          <span className="badge">{label(current.reliability || 'unrated')}</span>
          {current.isFictional && <span className="badge badge--fictional">Fictional in-world</span>}
          {current.sourceVerified ? (
            <span className="badge badge--confirmed">Source verified</span>
          ) : (
            <span className="badge badge--warning">Source unverified</span>
          )}
          <span className={`badge ${badgeClassForStatus(current.verificationStatus)}`}>
            Review: {label(current.verificationStatus || 'draft')}
          </span>
        </div>

        <p>{current.description}</p>

        <div className="artifact-source-block">
          <h4>Source &amp; provenance</h4>
          <dl className="suspect-facts">
            <dt>Author</dt>
            <dd>{current.sourceAuthor || 'Unknown'}</dd>
            <dt>Publication</dt>
            <dd>{current.publicationDate || 'Not provided'}</dd>
            <dt>Bibliography</dt>
            <dd>{current.bibliographyRef || 'Not provided'}</dd>
            <dt>Source type</dt>
            <dd>{current.sourceType ? label(current.sourceType) : 'Not specified'}</dd>
            <dt>Review status</dt>
            <dd>{label(current.verificationStatus || 'draft')}</dd>
            {current.verificationNotes && (
              <>
                <dt>Verification notes</dt>
                <dd>{current.verificationNotes}</dd>
              </>
            )}
            {current.lastVerifiedAt && (
              <>
                <dt>Last verified</dt>
                <dd>{current.lastVerifiedAt}</dd>
              </>
            )}
            <dt>Source verified</dt>
            <dd>{current.sourceVerified ? 'Yes — link verified by the case file' : 'No — no verified external link is provided'}</dd>
            <dt>External link</dt>
            <dd>
              {verifiedUrl ? (
                <a href={verifiedUrl} target="_blank" rel="noopener noreferrer">{verifiedUrl}</a>
              ) : (
                <span className="muted">No verified external link available.</span>
              )}
            </dd>
          </dl>
        </div>

        {loading && <div className="page-state">Loading artifact details...</div>}
        {loadError && <div className="error">Unable to load artifact details: {loadError}</div>}

        {detail && (
          <>
            {detail.content && (
              <div className="artifact-detail-section">
                <h4>Content</h4>
                <p className="solution-prose">{detail.content}</p>
              </div>
            )}
            {detail.usageNote && (
              <div className="artifact-detail-section">
                <h4>How to use this reference</h4>
                <p>{detail.usageNote}</p>
              </div>
            )}
          </>
        )}

        {current.learningObjectives.length > 0 && (
          <div className="artifact-detail-section">
            <h4>What you can learn</h4>
            <ul className="specialist-list">
              {current.learningObjectives.map((objective) => <li key={objective}>{objective}</li>)}
            </ul>
          </div>
        )}

        {current.claimsSupported.length > 0 && (
          <div className="artifact-detail-section">
            <h4>Claims this supports</h4>
            <ul className="specialist-list">
              {current.claimsSupported.map((claim) => <li key={claim}>{claim}</li>)}
            </ul>
          </div>
        )}

        {current.relatedEvidenceRefs.length > 0 && (
          <div className="artifact-detail-section">
            <h4>Related case material</h4>
            <p className="muted">
              Cross-references by stable source label (not by hidden evidence):
            </p>
            <div className="badges">
              {current.relatedEvidenceRefs.map((ref) => (
                <span key={ref} className="badge badge--soft">{ref}</span>
              ))}
            </div>
          </div>
        )}

        {current.suggestedConversations.length > 0 && (
          <div className="artifact-detail-section">
            <h4>Ask a specialist about</h4>
            <ul className="specialist-list">
              {current.suggestedConversations.map((prompt) => <li key={prompt}>{prompt}</li>)}
            </ul>
          </div>
        )}

        {Object.keys(current.depthContent ?? {}).length > 0 && (
          <div className="artifact-detail-section">
            <h4>Explanation depth</h4>
            <div className="chip-row" role="tablist" aria-label="Explanation depth">
              {(['plain', 'working', 'technical'] as const).map((level) => {
                if (!current.depthContent?.[level]) return null;
                return (
                  <button
                    key={level}
                    type="button"
                    role="tab"
                    aria-selected={depthTab === level}
                    className={depthTab === level ? 'chip chip--active' : 'chip'}
                    onClick={() => setDepthTab(level)}
                  >
                    {label(level)}
                  </button>
                );
              })}
            </div>
            <p>{current.depthContent?.[depthTab] ?? current.depthContent?.plain ?? current.depthContent?.working ?? current.depthContent?.technical}</p>
          </div>
        )}

        {current.relatedConcepts.length > 0 && (
          <div className="artifact-detail-section">
            <h4>Related concepts</h4>
            <div className="badges">
              {current.relatedConcepts.map((concept) => (
                <span key={concept} className="badge badge--soft">{concept}</span>
              ))}
            </div>
          </div>
        )}

        <div className="button-row">
          <button type="button" className="small-button" onClick={() => onAsk(current)} disabled={loading}>
            Ask specialist
          </button>
          <button type="button" className="small-button" onClick={() => onSave(current)} disabled={saving}>
            {saving ? 'Saving…' : 'Save to notebook'}
          </button>
          <button type="button" className="link-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
