import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  api,
  errorMessage,
} from '../../api';
import type {
  PublicSpecialist,
  RealityAuditItem,
  RealityClaim,
  RealityClaimCategory,
  RealityConfidence,
  RealityHypothesis,
  RealityHypothesisStatus,
  RealityLink,
  RealityLinkOwnerType,
  RealityLinkTargetType,
  RealityMaterialItem,
  RealityMapSnapshot,
  RealityProvenance,
  RealityReasoningAudit,
  RealityRelationship,
  RealityReviewFocus,
  RealitySpecialistReview,
  RealityTension,
} from '../../api';

export interface RealityMapPrefill {
  target?: 'claim' | 'hypothesis';
  sourceJournalEntryId?: string | null;
  sourceNotebookEntryId?: string | null;
  sourcePerspectiveExperienceKey?: string | null;
  sourcePerspectiveReflectionId?: string | null;
  title?: string;
  description?: string;
  claimCategory?: RealityClaimCategory;
  confidence?: RealityConfidence;
  notes?: string;
  // Hypothesis-prefill fields (used when target === 'hypothesis')
  hypothesisName?: string;
  hypothesisExplanation?: string;
  hypothesisMissingInformation?: string;
  hypothesisAlternativeExplanations?: string;
  hypothesisPlayerNotes?: string;
}

interface RealityMapPanelProps {
  investigationId: string;
  caseClosed: boolean;
  specialists: PublicSpecialist[];
  prefill: RealityMapPrefill | null;
  onPrefillConsumed: () => void;
}

type RealityView = 'hypotheses' | 'claims' | 'links' | 'tensions' | 'assumptions' | 'review' | 'specialist';

const VIEWS: Array<{ id: RealityView; label: string }> = [
  { id: 'hypotheses', label: 'Hypotheses' },
  { id: 'claims', label: 'Claims' },
  { id: 'links', label: 'Evidence & Links' },
  { id: 'tensions', label: 'Contradictions' },
  { id: 'assumptions', label: 'Assumptions & Questions' },
  { id: 'review', label: 'Reasoning Assistant' },
  { id: 'specialist', label: 'Specialist Review' },
];

const CLAIM_CATEGORIES: Array<{ value: RealityClaimCategory; label: string }> = [
  { value: 'factual_observation', label: 'Factual observation' },
  { value: 'interpretation', label: 'Interpretation' },
  { value: 'assumption', label: 'Assumption' },
  { value: 'causal_explanation', label: 'Causal explanation' },
  { value: 'motive', label: 'Motive' },
  { value: 'timeline_assertion', label: 'Timeline assertion' },
  { value: 'unresolved_question', label: 'Unresolved question' },
];

const CONFIDENCES: Array<{ value: RealityConfidence; label: string }> = [
  { value: 'high_confidence', label: 'High confidence' },
  { value: 'moderate_confidence', label: 'Moderate confidence' },
  { value: 'low_confidence', label: 'Low confidence' },
  { value: 'insufficient_information', label: 'Insufficient information' },
];

const HYPOTHESIS_STATUSES: Array<{ value: RealityHypothesisStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'strengthened', label: 'Strengthened' },
  { value: 'weakened', label: 'Weakened' },
  { value: 'archived', label: 'Archived' },
];

const RELATIONSHIPS: Array<{ value: RealityRelationship; label: string; hint: string }> = [
  { value: 'supports', label: 'Supports', hint: 'The material gives reason to think this claim/hypothesis holds.' },
  { value: 'contradicts', label: 'Contradicts', hint: 'The material points against this claim/hypothesis.' },
  { value: 'contextualizes', label: 'Contextualizes', hint: 'The material adds context without clearly supporting or contradicting.' },
  { value: 'weakens', label: 'Weakens', hint: 'The material reduces confidence without fully contradicting.' },
  { value: 'unrelated_inconclusive', label: 'Unrelated / inconclusive', hint: 'The material was examined but does not bear on this claim/hypothesis.' },
  { value: 'included', label: 'Included in hypothesis', hint: 'This claim is part of the hypothesis (hypothesis → claim only).' },
];

const REVIEW_FOCUSES: Array<{ value: RealityReviewFocus; label: string; hint: string }> = [
  { value: 'assumptions', label: 'Assumptions', hint: 'What assumptions are least supported?' },
  { value: 'discriminate', label: 'Discriminate', hint: 'What would distinguish this from alternatives?' },
  { value: 'alternatives', label: 'Alternatives', hint: 'What other explanations fit the same material?' },
  { value: 'falsify', label: 'Falsify', hint: 'What would weaken or falsify this hypothesis?' },
  { value: 'critique', label: 'Critique', hint: 'Critique another specialist’s reasoning (needs target specialist).' },
];

function labelFor<T extends string>(items: Array<{ value: T; label: string }>, value: T): string {
  return items.find((item) => item.value === value)?.label ?? value.replace(/_/g, ' ');
}

function provenanceLabel(kind: RealityProvenance | string): string {
  switch (kind) {
    case 'established_fact': return 'Established fact';
    case 'player_interpretation': return 'Player interpretation';
    case 'specialist_opinion': return 'Specialist opinion';
    case 'unverified_assumption': return 'Unverified assumption';
    case 'ai_suggestion': return 'AI suggestion';
    default: return String(kind).replace(/_/g, ' ');
  }
}

function provenanceClass(kind: RealityProvenance | string): string {
  switch (kind) {
    case 'established_fact': return 'badge--confirmed';
    case 'player_interpretation': return 'badge--soft';
    case 'specialist_opinion': return 'badge--soft';
    case 'unverified_assumption': return 'badge--warning';
    case 'ai_suggestion': return 'badge--soft';
    default: return 'badge--soft';
  }
}

function materialTypeLabel(type: RealityLinkTargetType): string {
  switch (type) {
    case 'evidence': return 'Evidence';
    case 'artifact': return 'Artifact';
    case 'journal_entry': return 'Journal';
    case 'notebook_entry': return 'Notebook';
    case 'specialist': return 'Specialist';
    case 'character': return 'Character';
    case 'claim': return 'Claim';
    case 'hypothesis': return 'Hypothesis';
    default: return type;
  }
}

function materialsForType(materials: RealityMapSnapshot['materials'] | undefined, type: RealityLinkTargetType): RealityMaterialItem[] {
  if (!materials) return [];
  switch (type) {
    case 'evidence': return materials.evidence;
    case 'artifact': return materials.artifacts;
    case 'journal_entry': return materials.journalEntries;
    case 'notebook_entry': return materials.notebookEntries;
    case 'specialist': return materials.specialists;
    case 'character': return materials.characters;
    default: return [];
  }
}

function relationshipOptionsFor(ownerType: RealityLinkOwnerType, targetType: RealityLinkTargetType) {
  if (ownerType === 'hypothesis' && targetType === 'claim') {
    return RELATIONSHIPS.filter((r) => r.value === 'included');
  }
  return RELATIONSHIPS.filter((r) => r.value !== 'included');
}

interface ClaimDraft {
  title: string;
  description: string;
  claimCategory: RealityClaimCategory;
  confidence: RealityConfidence;
  notes: string;
  sourceJournalEntryId: string | null;
  sourceNotebookEntryId: string | null;
  sourcePerspectiveExperienceKey: string | null;
  sourcePerspectiveReflectionId: string | null;
}

const EMPTY_CLAIM: ClaimDraft = {
  title: '',
  description: '',
  claimCategory: 'factual_observation',
  confidence: 'insufficient_information',
  notes: '',
  sourceJournalEntryId: null,
  sourceNotebookEntryId: null,
  sourcePerspectiveExperienceKey: null,
  sourcePerspectiveReflectionId: null,
};

interface HypothesisDraft {
  name: string;
  explanation: string;
  status: RealityHypothesisStatus;
  confidence: RealityConfidence;
  missingInformation: string;
  alternativeExplanations: string;
  playerNotes: string;
}

const EMPTY_HYPOTHESIS: HypothesisDraft = {
  name: '',
  explanation: '',
  status: 'active',
  confidence: 'insufficient_information',
  missingInformation: '',
  alternativeExplanations: '',
  playerNotes: '',
};

export function RealityMapPanel({ investigationId, caseClosed, specialists, prefill, onPrefillConsumed }: RealityMapPanelProps) {
  const [snapshot, setSnapshot] = useState<RealityMapSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<RealityView>('hypotheses');

  // Claim editor
  const [claimDraft, setClaimDraft] = useState<ClaimDraft>(EMPTY_CLAIM);
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [claimFilterCategory, setClaimFilterCategory] = useState<string>('all');
  const [claimFilterConfidence, setClaimFilterConfidence] = useState<string>('all');

  // Hypothesis editor
  const [hypothesisDraft, setHypothesisDraft] = useState<HypothesisDraft>(EMPTY_HYPOTHESIS);
  const [editingHypothesisId, setEditingHypothesisId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<import('../../api').RealityHypothesisComparison | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Link editor
  const [linkOwnerType, setLinkOwnerType] = useState<RealityLinkOwnerType>('claim');
  const [linkOwnerId, setLinkOwnerId] = useState('');
  const [linkTargetType, setLinkTargetType] = useState<RealityLinkTargetType>('evidence');
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkRelationship, setLinkRelationship] = useState<RealityRelationship>('supports');
  const [linkRationale, setLinkRationale] = useState('');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  // Reasoning assistant / specialist review
  const [audit, setAudit] = useState<RealityReasoningAudit | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [specialistReview, setSpecialistReview] = useState<RealitySpecialistReview | null>(null);
  const [specialistReviewBusy, setSpecialistReviewBusy] = useState(false);
  const [reviewHypothesisId, setReviewHypothesisId] = useState('');
  const [reviewSpecialistKey, setReviewSpecialistKey] = useState('');
  const [reviewFocus, setReviewFocus] = useState<RealityReviewFocus>('assumptions');
  const [reviewCompareId, setReviewCompareId] = useState('');
  const [reviewTargetSpecialistKey, setReviewTargetSpecialistKey] = useState('');
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getRealityMap(investigationId);
      setSnapshot(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [investigationId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.target === 'hypothesis') {
      setView('hypotheses');
      setEditingHypothesisId(null);
      setHypothesisDraft({
        ...EMPTY_HYPOTHESIS,
        name: prefill.hypothesisName ?? prefill.title ?? '',
        explanation: prefill.hypothesisExplanation ?? prefill.description ?? '',
        missingInformation: prefill.hypothesisMissingInformation ?? '',
        alternativeExplanations: prefill.hypothesisAlternativeExplanations ?? '',
        playerNotes: prefill.hypothesisPlayerNotes ?? prefill.notes ?? '',
      });
      onPrefillConsumed();
      return;
    }
    setView('claims');
    setEditingClaimId(null);
    setClaimDraft({
      ...EMPTY_CLAIM,
      title: prefill.title ?? '',
      description: prefill.description ?? '',
      claimCategory: prefill.claimCategory ?? 'factual_observation',
      confidence: prefill.confidence ?? 'insufficient_information',
      notes: prefill.notes ?? '',
      sourceJournalEntryId: prefill.sourceJournalEntryId ?? null,
      sourceNotebookEntryId: prefill.sourceNotebookEntryId ?? null,
      sourcePerspectiveExperienceKey: prefill.sourcePerspectiveExperienceKey ?? null,
      sourcePerspectiveReflectionId: prefill.sourcePerspectiveReflectionId ?? null,
    });
    onPrefillConsumed();
  }, [prefill, onPrefillConsumed]);

  const claims = snapshot?.claims ?? [];
  const hypotheses = snapshot?.hypotheses ?? [];
  const links = snapshot?.links ?? [];
  const tensions = snapshot?.tensions ?? [];
  const materials = snapshot?.materials;

  const ownerOptions = useMemo(() => {
    if (linkOwnerType === 'claim') {
      return claims.map((c) => ({ id: c.id, label: c.title || 'Untitled claim' }));
    }
    return hypotheses.map((h) => ({ id: h.id, label: h.name || 'Untitled hypothesis' }));
  }, [linkOwnerType, claims, hypotheses]);

  const allowedTargetTypes = useMemo<RealityLinkTargetType[]>(() => {
    if (linkOwnerType === 'claim') {
      return ['evidence', 'artifact', 'journal_entry', 'notebook_entry', 'specialist', 'character'];
    }
    return ['claim', 'evidence', 'artifact', 'journal_entry', 'notebook_entry', 'specialist', 'character'];
  }, [linkOwnerType]);

  const targetOptions = useMemo(() => {
    if (linkOwnerType === 'hypothesis' && linkTargetType === 'claim') {
      return claims.map((c) => ({ id: c.id, label: c.title || 'Untitled claim', subLabel: 'claim' }));
    }
    if (linkTargetType === 'claim' || linkTargetType === 'hypothesis') return [];
    return materialsForType(materials, linkTargetType).map((m) => ({ id: m.id, label: m.label, subLabel: m.subLabel }));
  }, [linkOwnerType, linkTargetType, claims, materials]);

  useEffect(() => {
    if (!ownerOptions.some((o) => o.id === linkOwnerId)) setLinkOwnerId(ownerOptions[0]?.id ?? '');
  }, [ownerOptions, linkOwnerId]);

  useEffect(() => {
    if (!allowedTargetTypes.includes(linkTargetType)) {
      setLinkTargetType(allowedTargetTypes[0] ?? 'evidence');
    }
  }, [allowedTargetTypes, linkTargetType]);

  useEffect(() => {
    const allowed = relationshipOptionsFor(linkOwnerType, linkTargetType);
    if (!allowed.some((r) => r.value === linkRelationship)) {
      setLinkRelationship(allowed[0]?.value ?? 'supports');
    }
  }, [linkOwnerType, linkTargetType, linkRelationship]);

  useEffect(() => {
    if (!targetOptions.some((o) => o.id === linkTargetId)) setLinkTargetId(targetOptions[0]?.id ?? '');
  }, [targetOptions, linkTargetId]);

  useEffect(() => {
    if (!reviewHypothesisId && hypotheses.length > 0) setReviewHypothesisId(hypotheses[0].id);
  }, [hypotheses, reviewHypothesisId]);

  useEffect(() => {
    if (!reviewSpecialistKey && specialists.length > 0) setReviewSpecialistKey(specialists[0].specialistKey);
  }, [specialists, reviewSpecialistKey]);

  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      if (claimFilterCategory !== 'all' && claim.claimCategory !== claimFilterCategory) return false;
      if (claimFilterConfidence !== 'all' && claim.confidence !== claimFilterConfidence) return false;
      return true;
    });
  }, [claims, claimFilterCategory, claimFilterConfidence]);

  const assumptionClaims = claims.filter((c) => c.claimCategory === 'assumption' || c.claimCategory === 'unresolved_question');

  async function withBusy<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
    setBusy(key);
    setError(null);
    try {
      const result = await fn();
      await refresh();
      return result;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function submitClaim(e: FormEvent) {
    e.preventDefault();
    const title = claimDraft.title.trim();
    if (!title) { setError('Claim title is required.'); return; }
    const payload = {
      title,
      description: claimDraft.description,
      claimCategory: claimDraft.claimCategory,
      confidence: claimDraft.confidence,
      notes: claimDraft.notes,
      ...(claimDraft.sourceJournalEntryId ? { sourceJournalEntryId: claimDraft.sourceJournalEntryId } : {}),
      ...(claimDraft.sourceNotebookEntryId ? { sourceNotebookEntryId: claimDraft.sourceNotebookEntryId } : {}),
      ...(claimDraft.sourcePerspectiveExperienceKey ? { sourcePerspectiveExperienceKey: claimDraft.sourcePerspectiveExperienceKey } : {}),
      ...(claimDraft.sourcePerspectiveReflectionId ? { sourcePerspectiveReflectionId: claimDraft.sourcePerspectiveReflectionId } : {}),
    };
    const ok = await withBusy(editingClaimId ? `claim-save-${editingClaimId}` : 'claim-create', async () => {
      if (editingClaimId) await api.updateRealityClaim(investigationId, editingClaimId, payload);
      else await api.createRealityClaim(investigationId, payload);
    });
    if (ok !== null) {
      setClaimDraft(EMPTY_CLAIM);
      setEditingClaimId(null);
    }
  }

  function editClaim(claim: RealityClaim) {
    setView('claims');
    setEditingClaimId(claim.id);
    setClaimDraft({
      title: claim.title,
      description: claim.description || '',
      claimCategory: claim.claimCategory,
      confidence: claim.confidence,
      notes: claim.notes || '',
      sourceJournalEntryId: claim.sourceJournalEntryId ?? null,
      sourceNotebookEntryId: claim.sourceNotebookEntryId ?? null,
      sourcePerspectiveExperienceKey: null,
      sourcePerspectiveReflectionId: null,
    });
  }

  async function removeClaim(claimId: string) {
    if (!window.confirm('Delete this claim? Links attached to it will also be removed.')) return;
    await withBusy(`claim-delete-${claimId}`, () => api.deleteRealityClaim(investigationId, claimId));
    if (editingClaimId === claimId) { setEditingClaimId(null); setClaimDraft(EMPTY_CLAIM); }
  }

  async function submitHypothesis(e: FormEvent) {
    e.preventDefault();
    const name = hypothesisDraft.name.trim();
    if (!name) { setError('Hypothesis name is required.'); return; }
    const payload = {
      name,
      explanation: hypothesisDraft.explanation,
      confidence: hypothesisDraft.confidence,
      missingInformation: hypothesisDraft.missingInformation,
      alternativeExplanations: hypothesisDraft.alternativeExplanations,
      playerNotes: hypothesisDraft.playerNotes,
    };
    const ok = await withBusy(editingHypothesisId ? `hyp-save-${editingHypothesisId}` : 'hyp-create', async () => {
      if (editingHypothesisId) {
        await api.updateRealityHypothesis(investigationId, editingHypothesisId, {
          ...payload,
          status: hypothesisDraft.status,
        });
      } else {
        await api.createRealityHypothesis(investigationId, payload);
      }
    });
    if (ok !== null) {
      setEditingHypothesisId(null);
      setHypothesisDraft(EMPTY_HYPOTHESIS);
    }
  }

  function editHypothesis(h: RealityHypothesis) {
    setView('hypotheses');
    setEditingHypothesisId(h.id);
    setHypothesisDraft({
      name: h.name,
      explanation: h.explanation || '',
      status: h.status,
      confidence: h.confidence,
      missingInformation: h.missingInformation || '',
      alternativeExplanations: h.alternativeExplanations || '',
      playerNotes: h.playerNotes || '',
    });
  }

  async function removeHypothesis(hypothesisId: string) {
    if (!window.confirm('Delete this hypothesis? Links attached to it will also be removed.')) return;
    await withBusy(`hyp-delete-${hypothesisId}`, () => api.deleteRealityHypothesis(investigationId, hypothesisId));
    if (editingHypothesisId === hypothesisId) { setEditingHypothesisId(null); setHypothesisDraft(EMPTY_HYPOTHESIS); }
    setCompareIds((ids) => ids.filter((id) => id !== hypothesisId));
  }

  async function setHypothesisStatus(h: RealityHypothesis, status: RealityHypothesisStatus) {
    await withBusy(`hyp-status-${h.id}`, () => api.updateRealityHypothesis(investigationId, h.id, { status }));
  }

  async function submitLink(e: FormEvent) {
    e.preventDefault();
    if (!linkOwnerId || !linkTargetId) { setError('Select both an owner and a target.'); return; }
    const payload = {
      ownerType: linkOwnerType,
      ownerId: linkOwnerId,
      targetType: linkTargetType,
      targetId: linkTargetId,
      relationship: linkRelationship,
      rationale: linkRationale,
    };
    const ok = await withBusy(editingLinkId ? `link-save-${editingLinkId}` : 'link-create', async () => {
      if (editingLinkId) {
        await api.updateRealityLink(investigationId, editingLinkId, {
          relationship: linkRelationship,
          rationale: linkRationale,
        });
      } else {
        await api.createRealityLink(investigationId, payload);
      }
    });
    if (ok !== null) {
      setEditingLinkId(null);
      setLinkRationale('');
    }
  }

  function editLink(link: RealityLink) {
    setView('links');
    setEditingLinkId(link.id);
    setLinkOwnerType(link.ownerType);
    setLinkOwnerId(link.ownerId);
    setLinkTargetType(link.targetType);
    setLinkTargetId(link.targetId);
    setLinkRelationship(link.relationship);
    setLinkRationale(link.rationale || '');
  }

  async function removeLink(linkId: string) {
    if (!window.confirm('Remove this relationship?')) return;
    await withBusy(`link-delete-${linkId}`, () => api.deleteRealityLink(investigationId, linkId));
    if (editingLinkId === linkId) setEditingLinkId(null);
  }

  async function runCompare() {
    setCompareError(null);
    setComparison(null);
    if (compareIds.length < 2) { setCompareError('Select at least two hypotheses to compare.'); return; }
    setBusy('compare');
    try {
      setComparison(await api.compareRealityHypotheses(investigationId, compareIds));
    } catch (err) {
      setCompareError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function runAudit() {
    setReviewBusy(true);
    setError(null);
    try {
      setAudit(await api.realityReasoningReview(investigationId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setReviewBusy(false);
    }
  }

  async function runSpecialistReview() {
    if (!reviewHypothesisId) { setError('Select a hypothesis to review.'); return; }
    if (!reviewSpecialistKey) { setError('Select a specialist.'); return; }
    if (reviewFocus === 'critique' && !reviewTargetSpecialistKey) {
      setError('Select a target specialist for critique.');
      return;
    }
    setSpecialistReviewBusy(true);
    setError(null);
    try {
      setSpecialistReview(await api.realitySpecialistReview(investigationId, reviewHypothesisId, {
        specialistKey: reviewSpecialistKey,
        focus: reviewFocus,
        ...(reviewCompareId ? { compareWithHypothesisId: reviewCompareId } : {}),
        ...(reviewFocus === 'critique' && reviewTargetSpecialistKey ? { targetSpecialistKey: reviewTargetSpecialistKey } : {}),
      }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSpecialistReviewBusy(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice('Copied to clipboard.');
    } catch {
      setCopyNotice('Copy failed - you can select and copy the text manually.');
    }
    window.setTimeout(() => setCopyNotice(null), 2500);
  }

  function saveAuditItemAsClaim(item: RealityAuditItem) {
    const category: RealityClaimCategory = item.provenance === 'unverified_assumption' ? 'assumption' : 'unresolved_question';
    setClaimDraft({
      ...EMPTY_CLAIM,
      title: item.text.slice(0, 160),
      description: `From reasoning assistant (${provenanceLabel(item.provenance)}): ${item.text}`,
      claimCategory: category,
      confidence: 'insufficient_information',
    });
    setEditingClaimId(null);
    setView('claims');
  }

  async function addTutorial() {
    if (!window.confirm('Add labelled tutorial scaffolding? This creates example claims and a hypothesis you can edit or remove.')) return;
    await withBusy('tutorial-add', () => api.addRealityTutorialExamples(investigationId));
  }

  async function clearTutorial() {
    if (!window.confirm('Remove all tutorial example items from the Reality Map?')) return;
    await withBusy('tutorial-clear', () => api.removeRealityTutorialExamples(investigationId));
  }

  if (loading) return <div className="page-state">Loading Reality Map…</div>;
  if (error && !snapshot) {
    return (
      <div className="error">
        Unable to load Reality Map: {error}{' '}
        <button type="button" className="link-button" onClick={() => { setLoading(true); void refresh(); }}>Retry</button>
      </div>
    );
  }
  if (!snapshot) return <div className="empty-state">Reality Map unavailable.</div>;

  return (
    <section className="reality-map" aria-label="Reality Map">
      <div className="section-heading">
        <div>
          <h3>Reality Map</h3>
          <p className="muted">
            A player-owned reasoning workspace. Claims, hypotheses, links and tensions are your notes — not facts, not verdicts, and not shared with the case solution.
          </p>
        </div>
        <div className="reality-map__meta">
          <span className="badge badge--soft">Claims {snapshot.limits.claims.used}/{snapshot.limits.claims.max}</span>
          <span className="badge badge--soft">Hypotheses {snapshot.limits.hypotheses.used}/{snapshot.limits.hypotheses.max}</span>
          <span className="badge badge--soft">Links {snapshot.limits.links.used}/{snapshot.limits.links.max}</span>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {busy && <p className="muted" role="status">Working…</p>}

      {snapshot.tutorialAvailable && (
        <div className="reality-tutorial-bar detail-card">
          <div>
            <strong>Tutorial scaffolding</strong>
            <p className="muted">Optional labelled example items for learning the workspace. They are never case facts.</p>
          </div>
          <div className="button-row">
            {!snapshot.tutorialPresent ? (
              <button type="button" className="small-button" onClick={() => void addTutorial()} disabled={busy !== null || caseClosed}>
                Add labelled tutorial scaffolding
              </button>
            ) : (
              <button type="button" className="small-button small-button--danger" onClick={() => void clearTutorial()} disabled={busy !== null || caseClosed}>
                Clear tutorial examples
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="reality-subnav" aria-label="Reality Map views">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? 'chip chip--active' : 'chip'}
            aria-pressed={view === item.id}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {view === 'hypotheses' && (
        <div className="reality-grid">
          <div className="reality-main">
            <div className="section-heading">
              <h4>Hypotheses overview</h4>
              <span className="muted">{hypotheses.length} total</span>
            </div>
            {hypotheses.length === 0 ? (
              <p className="empty-state">No hypotheses yet. Create one to track a working explanation.</p>
            ) : (
              <div className="card-list">
                {hypotheses.map((h) => {
                  const included = links.filter((l) => l.ownerType === 'hypothesis' && l.ownerId === h.id && l.targetType === 'claim' && l.relationship === 'included');
                  const materialLinks = links.filter((l) => l.ownerType === 'hypothesis' && l.ownerId === h.id && l.targetType !== 'claim');
                  const selectedForCompare = compareIds.includes(h.id);
                  return (
                    <article key={h.id} className="detail-card reality-card">
                      <div className="badges">
                        <span className="badge">{labelFor(HYPOTHESIS_STATUSES, h.status)}</span>
                        <span className="badge badge--soft">{labelFor(CONFIDENCES, h.confidence)}</span>
                        {h.isTutorial && <span className="badge badge--warning">Tutorial example</span>}
                      </div>
                      <h4>{h.name}</h4>
                      {h.explanation && <p>{h.explanation}</p>}
                      {h.missingInformation && <p className="muted"><strong>Missing information:</strong> {h.missingInformation}</p>}
                      {h.alternativeExplanations && <p className="muted"><strong>Alternative explanations:</strong> {h.alternativeExplanations}</p>}
                      {h.playerNotes && <p className="muted"><strong>Your notes:</strong> {h.playerNotes}</p>}
                      <p className="muted">{included.length} included claim{included.length === 1 ? '' : 's'} · {materialLinks.length} material link{materialLinks.length === 1 ? '' : 's'}</p>
                      <div className="button-row">
                        <button type="button" className="small-button" onClick={() => editHypothesis(h)}>Edit</button>
                        <button type="button" className="small-button" onClick={() => void setHypothesisStatus(h, 'strengthened')} disabled={busy !== null || caseClosed}>Strengthen</button>
                        <button type="button" className="small-button" onClick={() => void setHypothesisStatus(h, 'weakened')} disabled={busy !== null || caseClosed}>Weaken</button>
                        <button type="button" className="small-button" onClick={() => void setHypothesisStatus(h, h.status === 'archived' ? 'active' : 'archived')} disabled={busy !== null || caseClosed}>{h.status === 'archived' ? 'Reopen' : 'Archive'}</button>
                        <button
                          type="button"
                          className={selectedForCompare ? 'small-button' : 'small-button'}
                          aria-pressed={selectedForCompare}
                          onClick={() => setCompareIds((ids) => selectedForCompare ? ids.filter((id) => id !== h.id) : ids.length >= 4 ? ids : [...ids, h.id])}
                        >
                          {selectedForCompare ? 'Selected for compare' : 'Compare'}
                        </button>
                        <button type="button" className="link-button link-button--danger" onClick={() => void removeHypothesis(h.id)} disabled={busy !== null || caseClosed}>Delete</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="detail-card reality-compare">
              <div className="section-heading">
                <h4>Compare hypotheses</h4>
                <span className="muted">{compareIds.length}/4 selected</span>
              </div>
              <p className="muted">Compare 2–4 hypotheses. Comparison highlights shared/divergent claims and questions — it never picks a correct hypothesis.</p>
              <div className="button-row">
                <button type="button" className="small-button" onClick={() => void runCompare()} disabled={busy === 'compare' || compareIds.length < 2}>Compare selected</button>
                <button type="button" className="link-button" onClick={() => { setCompareIds([]); setComparison(null); setCompareError(null); }}>Clear</button>
              </div>
              {compareError && <div className="error">{compareError}</div>}
              {comparison && (
                <div className="reality-compare__result">
                  <p className="muted"><strong>Disclaimer:</strong> {comparison.disclaimer}</p>
                  <div className="card-list">
                    {comparison.hypotheses.map((h) => (
                      <div key={h.id} className="detail-card">
                        <h4>{h.name}</h4>
                        <p className="muted">{labelFor(HYPOTHESIS_STATUSES, h.status)} · {labelFor(CONFIDENCES, h.confidence)}</p>
                        <p className="muted">Included claims: {h.includedClaimIds.length}</p>
                      </div>
                    ))}
                  </div>
                  <p><strong>Shared claims:</strong> {comparison.sharedClaimIds.length || 'None'}</p>
                  <p><strong>Divergences:</strong> {comparison.divergences.length || 'None'}</p>
                  {comparison.questions.length > 0 && (
                    <ul className="specialist-list">
                      {comparison.questions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <aside className="reality-aside">
            <form className="detail-card reality-form" onSubmit={submitHypothesis}>
              <h4>{editingHypothesisId ? 'Edit hypothesis' : 'Create hypothesis'}</h4>
              <label className="field-label">Name
                <input value={hypothesisDraft.name} onChange={(e) => setHypothesisDraft({ ...hypothesisDraft, name: e.target.value })} maxLength={160} required />
              </label>
              <label className="field-label">Explanation
                <textarea value={hypothesisDraft.explanation} onChange={(e) => setHypothesisDraft({ ...hypothesisDraft, explanation: e.target.value })} rows={3} maxLength={2000} />
              </label>
              <label className="field-label">Confidence
                <select value={hypothesisDraft.confidence} onChange={(e) => setHypothesisDraft({ ...hypothesisDraft, confidence: e.target.value as RealityConfidence })}>
                  {CONFIDENCES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              {editingHypothesisId && (
                <label className="field-label">Status
                  <select value={hypothesisDraft.status} onChange={(e) => setHypothesisDraft({ ...hypothesisDraft, status: e.target.value as RealityHypothesisStatus })}>
                    {HYPOTHESIS_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              )}
              <label className="field-label">Missing information
                <textarea value={hypothesisDraft.missingInformation} onChange={(e) => setHypothesisDraft({ ...hypothesisDraft, missingInformation: e.target.value })} rows={2} maxLength={2000} />
              </label>
              <label className="field-label">Alternative explanations
                <textarea value={hypothesisDraft.alternativeExplanations} onChange={(e) => setHypothesisDraft({ ...hypothesisDraft, alternativeExplanations: e.target.value })} rows={2} maxLength={2000} />
              </label>
              <label className="field-label">Your notes
                <textarea value={hypothesisDraft.playerNotes} onChange={(e) => setHypothesisDraft({ ...hypothesisDraft, playerNotes: e.target.value })} rows={2} maxLength={2000} />
              </label>
              <div className="button-row">
                <button type="submit" className="small-button" disabled={busy !== null || caseClosed}>{editingHypothesisId ? 'Save hypothesis' : 'Create hypothesis'}</button>
                {editingHypothesisId && <button type="button" className="link-button" onClick={() => { setEditingHypothesisId(null); setHypothesisDraft(EMPTY_HYPOTHESIS); }}>Cancel</button>}
              </div>
            </form>
          </aside>
        </div>
      )}

      {view === 'claims' && (
        <div className="reality-grid">
          <div className="reality-main">
            <div className="section-heading">
              <h4>Claims</h4>
              <span className="muted">{filteredClaims.length} shown / {claims.length} total</span>
            </div>
            <div className="reality-filters">
              <label className="field-label">Category
                <select value={claimFilterCategory} onChange={(e) => setClaimFilterCategory(e.target.value)}>
                  <option value="all">All categories</option>
                  {CLAIM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="field-label">Confidence
                <select value={claimFilterConfidence} onChange={(e) => setClaimFilterConfidence(e.target.value)}>
                  <option value="all">All confidence levels</option>
                  {CONFIDENCES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
            </div>
            {filteredClaims.length === 0 ? (
              <p className="empty-state">No claims match the current filters.</p>
            ) : (
              <div className="card-list">
                {filteredClaims.map((claim) => (
                  <article key={claim.id} className="detail-card reality-card">
                    <div className="badges">
                      <span className="badge">{labelFor(CLAIM_CATEGORIES, claim.claimCategory)}</span>
                      <span className="badge badge--soft">{labelFor(CONFIDENCES, claim.confidence)}</span>
                      {claim.isTutorial && <span className="badge badge--warning">Tutorial example</span>}
                      {claim.sourceJournalEntryId && <span className="badge badge--soft">From journal</span>}
                      {claim.sourceNotebookEntryId && <span className="badge badge--soft">From notebook</span>}
                    </div>
                    <h4>{claim.title}</h4>
                    {claim.description && <p>{claim.description}</p>}
                    {claim.notes && <p className="muted"><strong>Notes:</strong> {claim.notes}</p>}
                    <div className="button-row">
                      <button type="button" className="small-button" onClick={() => editClaim(claim)}>Edit</button>
                      <button type="button" className="link-button link-button--danger" onClick={() => void removeClaim(claim.id)} disabled={busy !== null || caseClosed}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="reality-aside">
            <form className="detail-card reality-form" onSubmit={submitClaim}>
              <h4>{editingClaimId ? 'Edit claim' : 'Create claim'}</h4>
              {(claimDraft.sourceJournalEntryId || claimDraft.sourceNotebookEntryId) && (
                <p className="muted small-note">
                  Source: {claimDraft.sourceJournalEntryId ? 'Journal entry' : 'Notebook entry'} (kept as provenance, not proof).
                </p>
              )}
              <label className="field-label">Title
                <input value={claimDraft.title} onChange={(e) => setClaimDraft({ ...claimDraft, title: e.target.value })} maxLength={160} required />
              </label>
              <label className="field-label">Category
                <select value={claimDraft.claimCategory} onChange={(e) => setClaimDraft({ ...claimDraft, claimCategory: e.target.value as RealityClaimCategory })}>
                  {CLAIM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <fieldset className="reality-fieldset">
                <legend>Confidence (subjective)</legend>
                <div className="chip-row" role="radiogroup" aria-label="Claim confidence">
                  {CONFIDENCES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className={claimDraft.confidence === c.value ? 'chip chip--active' : 'chip'}
                      aria-pressed={claimDraft.confidence === c.value}
                      onClick={() => setClaimDraft({ ...claimDraft, confidence: c.value })}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="field-label">Description
                <textarea value={claimDraft.description} onChange={(e) => setClaimDraft({ ...claimDraft, description: e.target.value })} rows={3} maxLength={2000} />
              </label>
              <label className="field-label">Notes
                <textarea value={claimDraft.notes} onChange={(e) => setClaimDraft({ ...claimDraft, notes: e.target.value })} rows={2} maxLength={2000} />
              </label>
              <div className="button-row">
                <button type="submit" className="small-button" disabled={busy !== null || caseClosed}>{editingClaimId ? 'Save claim' : 'Create claim'}</button>
                {editingClaimId && <button type="button" className="link-button" onClick={() => { setEditingClaimId(null); setClaimDraft(EMPTY_CLAIM); }}>Cancel</button>}
              </div>
            </form>
          </aside>
        </div>
      )}

      {view === 'links' && (
        <div className="reality-grid">
          <div className="reality-main">
            <div className="section-heading">
              <h4>Evidence & links</h4>
              <span className="muted">{links.length} relationship{links.length === 1 ? '' : 's'}</span>
            </div>
            <p className="muted">Links express your interpretation of how material relates to claims or hypotheses. They are not case facts.</p>
            {links.length === 0 ? (
              <p className="empty-state">No links yet. Create a relationship to connect visible material to your reasoning.</p>
            ) : (
              <div className="card-list">
                {links.map((link) => (
                  <article key={link.id} className="detail-card reality-card">
                    <div className="badges">
                      <span className="badge">{materialTypeLabel(link.ownerType)}</span>
                      <span className="badge badge--soft">{labelFor(RELATIONSHIPS, link.relationship)}</span>
                      <span className="badge">{materialTypeLabel(link.targetType)}</span>
                      {link.isTutorial && <span className="badge badge--warning">Tutorial example</span>}
                    </div>
                    <p><strong>{link.ownerLabel}</strong> <span className="muted">→ {labelFor(RELATIONSHIPS, link.relationship).toLowerCase()} →</span> <strong>{link.targetLabel}</strong></p>
                    {link.targetSubLabel && <p className="muted">{link.targetSubLabel}</p>}
                    {link.rationale && <p className="muted"><strong>Rationale:</strong> {link.rationale}</p>}
                    <div className="button-row">
                      <button type="button" className="small-button" onClick={() => editLink(link)}>Edit</button>
                      <button type="button" className="link-button link-button--danger" onClick={() => void removeLink(link.id)} disabled={busy !== null || caseClosed}>Remove</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="reality-aside">
            <form className="detail-card reality-form" onSubmit={submitLink}>
              <h4>{editingLinkId ? 'Edit link' : 'Create link'}</h4>
              <p className="muted small-note">Allowed shapes: claim→material, hypothesis→claim (included), hypothesis→material.</p>
              <label className="field-label">Owner type
                <select value={linkOwnerType} onChange={(e) => setLinkOwnerType(e.target.value as RealityLinkOwnerType)} disabled={!!editingLinkId}>
                  <option value="claim">Claim</option>
                  <option value="hypothesis">Hypothesis</option>
                </select>
              </label>
              <label className="field-label">Owner
                <select value={linkOwnerId} onChange={(e) => setLinkOwnerId(e.target.value)} disabled={!!editingLinkId}>
                  {ownerOptions.length === 0 ? <option value="">No {linkOwnerType}s available</option> : ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
              <label className="field-label">Target type
                <select value={linkTargetType} onChange={(e) => setLinkTargetType(e.target.value as RealityLinkTargetType)} disabled={!!editingLinkId}>
                  {allowedTargetTypes.map((t) => <option key={t} value={t}>{materialTypeLabel(t)}</option>)}
                </select>
              </label>
              <label className="field-label">Target
                <select value={linkTargetId} onChange={(e) => setLinkTargetId(e.target.value)} disabled={!!editingLinkId}>
                  {targetOptions.length === 0 ? <option value="">No targets available</option> : targetOptions.map((o) => <option key={o.id} value={o.id}>{o.label}{o.subLabel ? ` (${o.subLabel})` : ''}</option>)}
                </select>
              </label>
              <label className="field-label">Relationship
                <select value={linkRelationship} onChange={(e) => setLinkRelationship(e.target.value as RealityRelationship)}>
                  {relationshipOptionsFor(linkOwnerType, linkTargetType).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
              <p className="muted small-note">{RELATIONSHIPS.find((r) => r.value === linkRelationship)?.hint}</p>
              <label className="field-label">Rationale (optional)
                <textarea value={linkRationale} onChange={(e) => setLinkRationale(e.target.value)} rows={2} maxLength={800} />
              </label>
              <div className="button-row">
                <button type="submit" className="small-button" disabled={busy !== null || caseClosed || !linkOwnerId || !linkTargetId}>{editingLinkId ? 'Save link' : 'Create link'}</button>
                {editingLinkId && <button type="button" className="link-button" onClick={() => { setEditingLinkId(null); setLinkRationale(''); }}>Cancel</button>}
              </div>
            </form>
          </aside>
        </div>
      )}

      {view === 'tensions' && (
        <div className="reality-single">
          <div className="section-heading">
            <h4>Contradictions & tensions</h4>
            <span className="muted">{tensions.length} derived</span>
          </div>
          <p className="muted">Tensions are derived from your own links and claims. They surface conflicts for you to examine — they are never automatically resolved.</p>
          {tensions.length === 0 ? (
            <p className="empty-state">No tensions detected in your current map. Add claims and links to surface conflicts.</p>
          ) : (
            <div className="card-list">
              {tensions.map((tension: RealityTension) => (
                <article key={tension.id} className="detail-card reality-card">
                  <div className="badges">
                    <span className="badge badge--warning">{tension.kind.replace(/_/g, ' ')}</span>
                  </div>
                  <h4>{tension.label}</h4>
                  <p>{tension.description}</p>
                  {(tension.claimIds.length > 0 || tension.hypothesisIds.length > 0) && (
                    <p className="muted">
                      {tension.claimIds.length > 0 ? `Claims: ${tension.claimIds.length}` : ''}
                      {tension.claimIds.length > 0 && tension.hypothesisIds.length > 0 ? ' · ' : ''}
                      {tension.hypothesisIds.length > 0 ? `Hypotheses: ${tension.hypothesisIds.length}` : ''}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'assumptions' && (
        <div className="reality-single">
          <div className="section-heading">
            <h4>Assumptions & Open Questions</h4>
            <span className="muted">{assumptionClaims.length} item{assumptionClaims.length === 1 ? '' : 's'}</span>
          </div>
          <p className="muted">Claims categorized as assumptions or unresolved questions. Treat them as prompts for investigation, not conclusions.</p>
          {assumptionClaims.length === 0 ? (
            <p className="empty-state">No assumption or unresolved-question claims yet.</p>
          ) : (
            <div className="card-list">
              {assumptionClaims.map((claim) => (
                <article key={claim.id} className="detail-card reality-card">
                  <div className="badges">
                    <span className="badge">{labelFor(CLAIM_CATEGORIES, claim.claimCategory)}</span>
                    <span className="badge badge--soft">{labelFor(CONFIDENCES, claim.confidence)}</span>
                  </div>
                  <h4>{claim.title}</h4>
                  {claim.description && <p>{claim.description}</p>}
                  <div className="button-row">
                    <button type="button" className="small-button" onClick={() => editClaim(claim)}>Edit in Claims</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'review' && (
        <div className="reality-single">
          <div className="section-heading">
            <h4>Reasoning Assistant</h4>
            <button type="button" className="small-button" onClick={() => void runAudit()} disabled={reviewBusy}>
              {reviewBusy ? 'Running audit…' : 'Run reasoning audit'}
            </button>
          </div>
          <p className="muted">
            The audit is a thinking aid built from your own notes and visible material. It does not know the solution and may be incomplete. Suggestions are never applied automatically.
          </p>
          {audit ? (
            <div className="reality-audit">
              <div className="detail-card">
                <p><strong>Summary:</strong> {audit.aiSummary}</p>
                <p className="muted small-note"><strong>Disclaimer:</strong> {audit.disclaimer}</p>
              </div>
              <div className="detail-card">
                <h4>Provenance legend</h4>
                <div className="reality-provenance-legend">
                  {Object.entries(audit.provenanceLegend).map(([key, value]) => (
                    <div key={key} className="reality-provenance-legend__item">
                      <span className={`badge ${provenanceClass(key)}`}>{provenanceLabel(key)}</span>
                      <span className="muted">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {audit.sections.map((section) => (
                <section key={section.key} className="detail-card reality-audit__section" aria-label={section.title}>
                  <h4>{section.title}</h4>
                  {section.items.length === 0 ? (
                    <p className="muted">Nothing flagged in this section.</p>
                  ) : (
                    <ul className="reality-audit__items">
                      {section.items.map((item) => (
                        <li key={item.id} className="reality-audit__item">
                          <div className="reality-audit__item-body">
                            <span className={`badge ${provenanceClass(item.provenance)}`}>{provenanceLabel(item.provenance)}</span>
                            <p>{item.text}</p>
                          </div>
                          <div className="button-row">
                            <button type="button" className="link-button" onClick={() => saveAuditItemAsClaim(item)}>Save as claim</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <p className="empty-state">Run an audit to get structured, question-oriented feedback on your current map.</p>
          )}
        </div>
      )}

      {view === 'specialist' && (
        <div className="reality-single">
          <div className="section-heading">
            <h4>Specialist review</h4>
          </div>
          <p className="muted">
            Ask a specialist for a bounded review of a hypothesis. Responses are specialist opinions, not facts or solutions. Reviews are not saved to chat or the map.
          </p>
          <div className="detail-card reality-form">
            <label className="field-label">Hypothesis
              <select value={reviewHypothesisId} onChange={(e) => setReviewHypothesisId(e.target.value)}>
                {hypotheses.length === 0 ? <option value="">No hypotheses available</option> : hypotheses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </label>
            <label className="field-label">Specialist
              <select value={reviewSpecialistKey} onChange={(e) => setReviewSpecialistKey(e.target.value)}>
                {specialists.length === 0 ? <option value="">No specialists available</option> : specialists.map((s) => <option key={s.specialistKey} value={s.specialistKey}>{s.name} — {s.discipline}</option>)}
              </select>
            </label>
            <label className="field-label">Focus
              <select value={reviewFocus} onChange={(e) => setReviewFocus(e.target.value as RealityReviewFocus)}>
                {REVIEW_FOCUSES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </label>
            <p className="muted small-note">{REVIEW_FOCUSES.find((f) => f.value === reviewFocus)?.hint}</p>
            <label className="field-label">Compare with hypothesis (optional)
              <select value={reviewCompareId} onChange={(e) => setReviewCompareId(e.target.value)}>
                <option value="">None</option>
                {hypotheses.filter((h) => h.id !== reviewHypothesisId).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </label>
            {reviewFocus === 'critique' && (
              <label className="field-label">Target specialist (required for critique)
                <select value={reviewTargetSpecialistKey} onChange={(e) => setReviewTargetSpecialistKey(e.target.value)}>
                  <option value="">Select target specialist</option>
                  {specialists.filter((s) => s.specialistKey !== reviewSpecialistKey).map((s) => <option key={s.specialistKey} value={s.specialistKey}>{s.name} — {s.discipline}</option>)}
                </select>
              </label>
            )}
            <div className="button-row">
              <button type="button" className="small-button" onClick={() => void runSpecialistReview()} disabled={specialistReviewBusy || !reviewHypothesisId || !reviewSpecialistKey}>
                {specialistReviewBusy ? 'Reviewing…' : 'Get specialist review'}
              </button>
            </div>
          </div>

          {copyNotice && <p className="muted" role="status">{copyNotice}</p>}

          {specialistReview && (
            <article className="detail-card reality-card">
              <div className="badges">
                <span className="badge badge--soft">Specialist opinion</span>
                <span className="badge">{specialistReview.specialistName}</span>
                <span className="badge badge--soft">{labelFor(REVIEW_FOCUSES, specialistReview.focus)}</span>
              </div>
              <p>{specialistReview.content}</p>
              {specialistReview.limitations.length > 0 && (
                <p className="muted"><strong>Limitations:</strong> {specialistReview.limitations.join(' ')}</p>
              )}
              <p className="muted small-note"><strong>Disclaimer:</strong> {specialistReview.disclaimer}</p>
              <div className="button-row">
                <button type="button" className="small-button" onClick={() => void copyToClipboard(specialistReview.content)}>Copy to notes</button>
              </div>
            </article>
          )}
        </div>
      )}
    </section>
  );
}