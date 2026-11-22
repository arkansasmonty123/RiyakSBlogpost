import { useMemo, useState } from 'react';
import { loadSave, persistSave, resetSave } from '@/storage/save';
import type { SaveGame, EvidenceItem, NotebookEntry } from '@/domain/types';

const VIEWPOINTS: Record<string, { label: string; description: string; hotspots: Array<{ id: string; label: string; action: string }> }> = {
  entrance: {
    label: 'Entrance',
    description: 'The chamber door opens into a quiet, book-lined office. The day begins here.',
    hotspots: [
      { id: 'door', label: 'Door', action: 'view:bookshelf' },
      { id: 'senior', label: 'Senior Mentor', action: 'dialogue:senior' },
      { id: 'desk', label: 'Desk', action: 'view:desk' },
    ],
  },
  desk: {
    label: 'Desk',
    description: 'Case files, drafts, and notes are spread across the desk.',
    hotspots: [
      { id: 'casefile', label: 'Case File', action: 'panel:case' },
      { id: 'draft', label: 'Draft Pad', action: 'panel:draft' },
      { id: 'back', label: 'Back to Entrance', action: 'view:entrance' },
    ],
  },
  bookshelf: {
    label: 'Bookshelf',
    description: 'Legal texts and reference materials line the wall. Only verified sources should be cited.',
    hotspots: [
      { id: 'research', label: 'Legal Research', action: 'panel:research' },
      { id: 'notebook', label: 'Notebook', action: 'panel:notebook' },
      { id: 'back', label: 'Back to Entrance', action: 'view:entrance' },
    ],
  },
  window: {
    label: 'Window',
    description: 'Outside, the district moves on its own schedule. The world does not wait for the player.',
    hotspots: [
      { id: 'clock', label: 'Advance Time', action: 'time:advance' },
      { id: 'back', label: 'Back to Entrance', action: 'view:entrance' },
    ],
  },
};

function nextSlot(slot: SaveGame['clock']['slot']): SaveGame['clock']['slot'] {
  if (slot === 'morning') return 'afternoon';
  if (slot === 'afternoon') return 'evening';
  return 'morning';
}

export function App() {
  const [save, setSave] = useState<SaveGame>(() => loadSave());
  const [panel, setPanel] = useState<string>('case');
  const [dialogue, setDialogue] = useState<string>('Adv. Meera Kulkarni: "Welcome. Read the facts carefully. Separate what is known, claimed, disputed, and unknown."');
  const [draft, setDraft] = useState<string>('Issue:\nFacts (known/claimed/disputed):\nRelevant law (verified sources only):\nAnalysis:\nConclusion:');

  const viewpoint = VIEWPOINTS[save.selectedViewpoint] ?? VIEWPOINTS.entrance;
  const discoveredEvidence = useMemo(() => save.caseFile.evidence.filter((e) => e.discovered), [save.caseFile.evidence]);

  function update(mutator: (s: SaveGame) => SaveGame) {
    setSave((prev) => {
      const next = mutator(structuredClone(prev));
      persistSave(next);
      return next;
    });
  }

  function addNotebook(entry: Omit<NotebookEntry, 'id' | 'day'>) {
    update((s) => {
      s.notebook.unshift({ id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, day: s.clock.day, ...entry });
      return s;
    });
  }

  function discoverEvidence(id: string) {
    update((s) => {
      const ev = s.caseFile.evidence.find((e) => e.id === id);
      if (!ev || ev.discovered) return s;
      ev.discovered = true;
      ev.admissibility = 'questionable';
      ev.reliability = ev.id === 'ev-3' ? 'low' : 'medium';
      s.caseFile.playerKnowledge.push(`Discovered: ${ev.title}`);
      s.memories.unshift({ id: `m-${Date.now()}`, day: s.clock.day, summary: `Discovered evidence: ${ev.title}`, participants: ['player'] });
      return s;
    });
    const ev = save.caseFile.evidence.find((e) => e.id === id);
    if (ev && !ev.discovered) addNotebook({ kind: 'fact', title: `Evidence: ${ev.title}`, content: ev.description, source: ev.provenance, verified: false });
  }

  function advanceTime() {
    update((s) => {
      const prevSlot = s.clock.slot;
      s.clock.slot = nextSlot(s.clock.slot);
      if (prevSlot === 'evening') s.clock.day += 1;
      s.memories.unshift({ id: `m-${Date.now()}`, day: s.clock.day, summary: `Time advanced to Day ${s.clock.day}, ${s.clock.slot}.`, participants: ['player'] });
      return s;
    });
  }

  function onHotspot(action: string) {
    const [kind, value] = action.split(':');
    if (kind === 'view') update((s) => ({ ...s, selectedViewpoint: value }));
    if (kind === 'panel') setPanel(value);
    if (kind === 'time') advanceTime();
    if (kind === 'dialogue' && value === 'senior') {
      setPanel('dialogue');
      setDialogue(save.flags.caseAccepted
        ? 'Adv. Meera Kulkarni: "Good. Now test every claim against evidence and verified law. Do not guess citations."'
        : 'Adv. Meera Kulkarni: "A fictional altercation case has arrived. Interview carefully, collect evidence, and draft a brief. I will review it."');
      update((s) => { s.flags.caseAccepted = true; return s; });
    }
  }

  function submitDraft() {
    const hasIssue = /issue\s*:/i.test(draft) && draft.length > 60;
    const hasCitationWarning = /section|article|bns|bnss|bsa/i.test(draft) && !/verified|source/i.test(draft.toLowerCase());
    update((s) => {
      s.flags.draftSubmitted = true;
      s.player.reputation.reliability += hasIssue ? 2 : -1;
      s.player.reputation.competence += hasIssue ? 1 : 0;
      s.memories.unshift({ id: `m-${Date.now()}`, day: s.clock.day, summary: 'Submitted draft for senior review.', participants: ['player', 'senior'] });
      return s;
    });
    addNotebook({
      kind: 'feedback',
      title: 'Senior feedback (deterministic stub)',
      content: hasIssue
        ? `Draft structure detected. ${hasCitationWarning ? 'Warning: legal references appear without verified source notes. ' : ''}Next: tie each claim to discovered evidence and mark unknowns.`
        : 'Draft is too thin. Include Issue, Facts (known/claimed/disputed), Verified Law, Analysis, Conclusion.',
      verified: true,
    });
    setPanel('notebook');
  }

  return (
    <div className="min-h-screen bg-bar-bg text-bar-text">
      <header className="border-b border-bar-gold/20 px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-bar-gold tracking-wide">THE BAR</h1>
          <p className="text-xs text-bar-muted">Educational simulation — not legal advice. No fabricated citations.</p>
        </div>
        <div className="text-sm text-bar-muted flex gap-3 flex-wrap">
          <span>Day {save.clock.day}</span><span>{save.clock.slot}</span><span>{save.player.careerStage}</span>
          <button className="px-2 py-1 border border-bar-gold/30 rounded" onClick={() => { persistSave(save); setDialogue('Saved locally.'); setPanel('dialogue'); }}>Save</button>
          <button className="px-2 py-1 border border-red-400/30 rounded text-red-200" onClick={() => { if (confirm('Reset local save?')) setSave(resetSave()); }}>Reset</button>
        </div>
      </header>

      <main className="grid md:grid-cols-[1.4fr_1fr] gap-4 p-4">
        <section className="bg-bar-panel rounded-lg border border-bar-gold/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg text-bar-gold">Senior Chamber — {viewpoint.label}</h2>
            <div className="flex gap-2 text-xs">
              {Object.entries(VIEWPOINTS).map(([k, v]) => (
                <button key={k} onClick={() => onHotspot(`view:${k}`)} className={`px-2 py-1 rounded border ${save.selectedViewpoint===k?'border-bar-gold text-bar-gold':'border-white/10 text-bar-muted'}`}>{v.label}</button>
              ))}
            </div>
          </div>
          <div className="bg-bar-panel2 rounded-md p-4 min-h-52 border border-white/5">
            <p className="text-sm text-bar-muted mb-4">{viewpoint.description}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {viewpoint.hotspots.map((h) => (
                <button key={h.id} onClick={() => onHotspot(h.action)} className="text-left p-3 rounded border border-bar-gold/20 hover:bg-white/5">
                  <div className="text-bar-gold text-sm">{h.label}</div>
                  <div className="text-xs text-bar-muted">{h.action}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid sm:grid-cols-3 gap-2 text-xs text-bar-muted">
            <div className="bg-bar-panel2 p-2 rounded">Competence: {save.player.reputation.competence}</div>
            <div className="bg-bar-panel2 p-2 rounded">Integrity: {save.player.reputation.integrity}</div>
            <div className="bg-bar-panel2 p-2 rounded">Reliability: {save.player.reputation.reliability}</div>
          </div>
        </section>

        <section className="bg-bar-panel rounded-lg border border-bar-gold/10 p-4">
          <div className="flex gap-2 flex-wrap mb-3 text-sm">
            {['case','evidence','draft','notebook','dialogue'].map((p) => (
              <button key={p} onClick={() => setPanel(p)} className={`px-2 py-1 rounded border ${panel===p?'border-bar-gold text-bar-gold':'border-white/10 text-bar-muted'}`}>{p}</button>
            ))}
          </div>

          {panel === 'dialogue' && <div className="text-sm whitespace-pre-wrap bg-bar-panel2 p-3 rounded">{dialogue}</div>}

          {panel === 'case' && (
            <div className="space-y-2 text-sm">
              <div className="text-bar-gold font-medium">{save.caseFile.title}</div>
              <div className="text-bar-muted">Status: {save.caseFile.status} • Player knowledge only (canonical truth hidden)</div>
              <div><div className="text-bar-gold text-xs">Known/Player knowledge</div><ul className="list-disc ml-5">{save.caseFile.playerKnowledge.map((k,i)=><li key={i}>{k}</li>)}</ul></div>
              <div><div className="text-bar-gold text-xs">Allegations</div><ul className="list-disc ml-5">{save.caseFile.allegations.map((k,i)=><li key={i}>{k}</li>)}</ul></div>
              <div><div className="text-bar-gold text-xs">Unresolved ambiguity</div><div>{save.caseFile.unresolvedAmbiguity}</div></div>
            </div>
          )}

          {panel === 'evidence' && (
            <div className="space-y-2 text-sm">
              {save.caseFile.evidence.map((ev: EvidenceItem) => (
                <div key={ev.id} className="bg-bar-panel2 p-2 rounded border border-white/5">
                  <div className="flex justify-between gap-2"><span className="text-bar-gold">{ev.title}</span><span className="text-xs text-bar-muted">{ev.type}</span></div>
                  <div className="text-xs text-bar-muted">{ev.provenance}</div>
                  {ev.discovered ? (
                    <div className="mt-1"><div>{ev.description}</div><div className="text-xs text-bar-muted">Admissibility: {ev.admissibility} • Reliability: {ev.reliability}</div></div>
                  ) : (
                    <button className="mt-2 px-2 py-1 border border-bar-gold/30 rounded text-xs" onClick={() => discoverEvidence(ev.id)}>Inspect / Discover</button>
                  )}
                </div>
              ))}
              <div className="text-xs text-bar-muted">Discovered: {discoveredEvidence.length}/{save.caseFile.evidence.length}</div>
            </div>
          )}

          {panel === 'draft' && (
            <div className="space-y-2">
              <textarea className="w-full min-h-52 bg-bar-panel2 border border-white/10 rounded p-2 text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div className="flex gap-2">
                <button className="px-3 py-1 border border-bar-gold/30 rounded text-sm" onClick={submitDraft}>Submit for senior review</button>
                <button className="px-3 py-1 border border-white/10 rounded text-sm text-bar-muted" onClick={() => addNotebook({ kind:'note', title:'Draft snapshot', content:draft, verified:false })}>Save draft note</button>
              </div>
              <p className="text-xs text-bar-muted">Deterministic feedback only in P0. Any legal references must be verified; no fabricated citations.</p>
            </div>
          )}

          {panel === 'notebook' && (
            <div className="space-y-2 text-sm max-h-[60vh] overflow-auto">
              {save.notebook.map((n) => (
                <div key={n.id} className="bg-bar-panel2 p-2 rounded border border-white/5">
                  <div className="flex justify-between"><span className="text-bar-gold">{n.title}</span><span className="text-xs text-bar-muted">Day {n.day} • {n.kind}</span></div>
                  <div className="whitespace-pre-wrap text-sm mt-1">{n.content}</div>
                  {n.source && <div className="text-xs text-bar-muted mt-1">Source: {n.source} {n.verified ? '(verified)' : '(unverified)'}</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
