import type { PublicArtifactSummary } from '../api';

interface KnowledgeArtifactCardProps {
  artifact: PublicArtifactSummary;
  onView: (artifact: PublicArtifactSummary) => void;
  onSave: (artifact: PublicArtifactSummary) => void;
  onAsk: (artifact: PublicArtifactSummary) => void;
  saving?: boolean;
}

function label(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function KnowledgeArtifactCard({ artifact, onView, onSave, onAsk, saving }: KnowledgeArtifactCardProps) {
  return (
    <article className="detail-card knowledge-artifact-card">
      <div className="badges">
        <span className="badge">{label(artifact.artifactType || 'artifact')}</span>
        <span className="badge">{label(artifact.knowledgeClass || 'reference')}</span>
        <span className="badge">{label(artifact.reliability || 'unrated')}</span>
        {artifact.isFictional && <span className="badge badge--fictional">Fictional in-world</span>}
        {artifact.sourceVerified ? (
          <span className="badge badge--confirmed">Source verified</span>
        ) : (
          <span className="badge badge--warning">Source unverified</span>
        )}
        <span className="badge badge--soft">Review: {artifact.verificationStatus?.replace(/_/g, ' ') ?? 'draft'}</span>
      </div>

      <h4>{artifact.title}</h4>
      <p className="muted">{artifact.description}</p>

      <div className="artifact-source-brief">
        <p className="muted">
          <strong>Author:</strong> {artifact.sourceAuthor || 'Unknown'}
          {artifact.publicationDate ? ` · ${artifact.publicationDate}` : ''}
        </p>
        <p className="muted">
          <strong>Bibliography:</strong> {artifact.bibliographyRef || 'Not provided'}
        </p>
      </div>

      {artifact.relatedConcepts.length > 0 && (
        <div className="badges" aria-label="Related concepts">
          {artifact.relatedConcepts.map((concept) => (
            <span key={concept} className="badge badge--soft">{concept}</span>
          ))}
        </div>
      )}

      <div className="button-row">
        <button type="button" className="small-button" onClick={() => onView(artifact)}>
          View details
        </button>
        <button type="button" className="small-button" onClick={() => onAsk(artifact)}>
          Ask specialist
        </button>
        <button type="button" className="link-button" onClick={() => onSave(artifact)} disabled={saving}>
          {saving ? 'Saving…' : 'Save to notebook'}
        </button>
      </div>
    </article>
  );
}
