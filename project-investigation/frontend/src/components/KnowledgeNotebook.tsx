import { useMemo, useState } from 'react';
import type { PublicNotebookEntry, PublicSpecialist } from '../api';

interface KnowledgeNotebookProps {
  entries: PublicNotebookEntry[];
  specialists: PublicSpecialist[];
  onCreateNote: (input: { entryType: string; title: string; content: string; concept: string }) => Promise<void>;
  onUpdate: (entryId: string, patch: { title?: string; content?: string; concept?: string; entryType?: string }) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
  onExport: (format: 'json' | 'markdown') => Promise<void>;
  busy?: boolean;
}

const ENTRY_TYPES = ['observation', 'fact', 'suspicion', 'theory', 'question', 'rejected', 'contradiction', 'note'] as const;

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function label(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function KnowledgeNotebook({ entries, specialists, onCreateNote, onUpdate, onDelete, onExport, busy }: KnowledgeNotebookProps) {
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState<'json' | 'markdown' | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [draftType, setDraftType] = useState<string>('note');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftConcept, setDraftConcept] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; content: string; concept: string; entryType: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const specialistNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of specialists) map.set(s.id, s.name);
    return map;
  }, [specialists]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (typeFilter !== 'all' && entry.entryType !== typeFilter) return false;
      if (!q) return true;
      const snapshot = entry.sourceSnapshot || {};
      const haystack = [
        entry.title, entry.content, entry.concept, entry.entryType,
        snapshot.title, snapshot.artifactKey, snapshot.sourceAuthor, snapshot.bibliographyRef,
        ...(Array.isArray(snapshot.relatedConcepts) ? snapshot.relatedConcepts : []),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, search, typeFilter]);

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const content = draftContent.trim();
    if (!content) { setLocalError('Note content is required.'); return; }
    try {
      await onCreateNote({
        entryType: draftType,
        title: draftTitle.trim(),
        concept: draftConcept.trim(),
        content,
      });
      setDraftTitle('');
      setDraftConcept('');
      setDraftContent('');
      setDraftType('note');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to save note.');
    }
  }

  function startEdit(entry: PublicNotebookEntry) {
    setEditingId(entry.id);
    setEditDraft({
      title: entry.title || '',
      content: entry.content || '',
      concept: entry.concept || '',
      entryType: entry.entryType || 'note',
    });
    setConfirmDeleteId(null);
  }

  async function saveEdit(entryId: string) {
    if (!editDraft) return;
    setLocalError(null);
    try {
      await onUpdate(entryId, {
        title: editDraft.title.trim(),
        content: editDraft.content,
        concept: editDraft.concept.trim(),
        entryType: editDraft.entryType,
      });
      setEditingId(null);
      setEditDraft(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update note.');
    }
  }

  async function handleDelete(entryId: string) {
    if (confirmDeleteId !== entryId) { setConfirmDeleteId(entryId); return; }
    setLocalError(null);
    try {
      await onDelete(entryId);
      setConfirmDeleteId(null);
      if (editingId === entryId) { setEditingId(null); setEditDraft(null); }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to remove note.');
    }
  }

  async function handleExport(format: 'json' | 'markdown') {
    setLocalError(null);
    setExporting(format);
    try {
      await onExport(format);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to export notebook.');
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className="knowledge-notebook" aria-label="Knowledge notebook">
      <div className="section-heading">
        <h3>Knowledge Notebook</h3>
        <div className="button-row">
          <span className="muted">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</span>
          <button
            type="button"
            className="small-button"
            onClick={() => void handleExport('json')}
            disabled={entries.length === 0 || exporting !== null}
            title="Download your notebook as JSON"
          >
            {exporting === 'json' ? 'Preparing…' : 'Export JSON'}
          </button>
          <button
            type="button"
            className="small-button"
            onClick={() => void handleExport('markdown')}
            disabled={entries.length === 0 || exporting !== null}
            title="Download your notebook as Markdown"
          >
            {exporting === 'markdown' ? 'Preparing…' : 'Export Markdown'}
          </button>
        </div>
      </div>
      <p className="muted">
        Your personal case notebook. Saved artifacts include source provenance; explanation and note
        entries capture your understanding. Nothing here is shared or treated as canonical proof.
      </p>

      <form className="notebook-form" onSubmit={submitNote}>
        <h4>Add a note</h4>
        <div className="form-row">
          <label>
            Type
            <select value={draftType} onChange={(e) => setDraftType(e.target.value)}>
              {ENTRY_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
            </select>
          </label>
          <label>
            Concept (optional)
            <input type="text" value={draftConcept} onChange={(e) => setDraftConcept(e.target.value)} maxLength={120} />
          </label>
        </div>
        <label className="field-label">
          Title (optional)
          <input type="text" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} maxLength={160} />
        </label>
        <label className="field-label">
          Content
          <textarea value={draftContent} onChange={(e) => setDraftContent(e.target.value)} rows={3} maxLength={4000} required />
        </label>
        <button type="submit" className="small-button" disabled={busy || !draftContent.trim()}>
          {busy ? 'Saving…' : 'Add to notebook'}
        </button>
      </form>

      <div className="notebook-filters">
        <label className="field-label">
          Search
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes, concepts, sources..." />
        </label>
        <label className="field-label">
          Type
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {ENTRY_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
        </label>
      </div>

      {localError && <div className="error">{localError}</div>}

      {filtered.length === 0 ? (
        <p className="empty-state">
          {entries.length === 0 ? 'No notebook entries yet. Save an artifact or specialist explanation to start building your reference notebook.' : 'No notebook entries match your filter.'}
        </p>
      ) : (
        <div className="card-list">
          {filtered.map((entry) => {
            const isEditing = editingId === entry.id && editDraft;
            const specialistName = entry.specialistId ? specialistNameById.get(entry.specialistId) : null;
            const snapshot = entry.sourceSnapshot || {};
            const hasSource = !!(snapshot.artifactKey || snapshot.title || snapshot.bibliographyRef || snapshot.sourceAuthor);
            return (
              <article key={entry.id} className="detail-card notebook-entry">
                <div className="badges">
                  <span className="badge">{label(entry.entryType)}</span>
                  {entry.artifactId && <span className="badge badge--soft">Artifact</span>}
                  {specialistName && <span className="badge badge--soft">Specialist: {specialistName}</span>}
                  {entry.concept && <span className="badge badge--soft">Concept: {entry.concept}</span>}
                </div>

                {isEditing ? (
                  <div className="notebook-edit">
                    <label className="field-label">Type
                      <select value={editDraft.entryType} onChange={(e) => setEditDraft({ ...editDraft, entryType: e.target.value })}>
                        {ENTRY_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
                      </select>
                    </label>
                    <label className="field-label">Title
                      <input type="text" value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
                    </label>
                    <label className="field-label">Concept
                      <input type="text" value={editDraft.concept} onChange={(e) => setEditDraft({ ...editDraft, concept: e.target.value })} />
                    </label>
                    <label className="field-label">Content
                      <textarea value={editDraft.content} onChange={(e) => setEditDraft({ ...editDraft, content: e.target.value })} rows={4} />
                    </label>
                    <div className="button-row">
                      <button type="button" className="small-button" disabled={busy} onClick={() => void saveEdit(entry.id)}>Save</button>
                      <button type="button" className="link-button" onClick={() => { setEditingId(null); setEditDraft(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {entry.title && <h4>{entry.title}</h4>}
                    {entry.content && <p className="solution-prose">{entry.content}</p>}
                  </>
                )}

                {hasSource && (
                  <div className="notebook-source">
                    <h5>Source provenance</h5>
                    <p className="muted">
                      <strong>{String(snapshot.title || snapshot.artifactKey || 'Artifact')}</strong>
                      {snapshot.sourceAuthor ? ` — ${String(snapshot.sourceAuthor)}` : ''}
                      {snapshot.publicationDate ? ` (${String(snapshot.publicationDate)})` : ''}
                    </p>
                    {snapshot.bibliographyRef && <p className="muted"><strong>Bibliography:</strong> {String(snapshot.bibliographyRef)}</p>}
                    <p className="muted">
                      <strong>Verified:</strong> {snapshot.sourceVerified ? 'Yes' : 'No'}
                      {snapshot.verificationStatus ? ` · Review: ${label(String(snapshot.verificationStatus))}` : ''}
                      {snapshot.sourceType ? ` · ${label(String(snapshot.sourceType))}` : ''}
                      {snapshot.knowledgeClass ? ` · ${label(String(snapshot.knowledgeClass))}` : ''}
                      {snapshot.reliability ? ` · ${label(String(snapshot.reliability))}` : ''}
                    </p>
                    {snapshot.verificationNotes && (
                      <p className="muted"><strong>Verification notes:</strong> {String(snapshot.verificationNotes)}</p>
                    )}
                    {Array.isArray(snapshot.claimsSupported) && snapshot.claimsSupported.length > 0 && (
                      <p className="muted"><strong>Claims:</strong> {snapshot.claimsSupported.map(String).join('; ')}</p>
                    )}
                    {Array.isArray(snapshot.relatedEvidenceRefs) && snapshot.relatedEvidenceRefs.length > 0 && (
                      <p className="muted"><strong>Related material:</strong> {snapshot.relatedEvidenceRefs.map(String).join('; ')}</p>
                    )}
                    {snapshot.sourceVerified && snapshot.sourceUrl ? (
                      <p className="muted"><a href={String(snapshot.sourceUrl)} target="_blank" rel="noopener noreferrer">Verified source</a></p>
                    ) : null}
                    {snapshot.contentExcerpt && <p className="muted"><strong>Excerpt:</strong> {String(snapshot.contentExcerpt)}</p>}
                  </div>
                )}

                <div className="notebook-entry__footer">
                  <span className="muted">Updated {formatDate(entry.updatedAt || entry.createdAt)}</span>
                  {!isEditing && (
                    <div className="button-row">
                      <button type="button" className="link-button" onClick={() => startEdit(entry)}>Edit</button>
                      <button type="button" className="link-button link-button--danger" onClick={() => void handleDelete(entry.id)}>
                        {confirmDeleteId === entry.id ? 'Confirm remove' : 'Remove'}
                      </button>
                      {confirmDeleteId === entry.id && (
                        <button type="button" className="link-button" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
