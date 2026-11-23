// M4 Reality Map — pure domain logic (no database, no network, no canonical
// truth). Every function here is deterministic and operates only on values the
// caller passes in. The module never imports `db`, `canonical_truth` or any
// module that reads them, so its output cannot carry solution data.
//
// Hard invariants:
//   * Confidence is a four-value SUBJECTIVE enum. No numeric probabilities.
//   * Tensions/audits/reviews never RESOLVE a dispute or assert which
//     hypothesis is correct. They only surface questions for the player.
//   * Provenance is attached to every audit item, with an explicit disclaimer.

// ---------------------------------------------------------------------------
// Bounded limits + allowlists
// ---------------------------------------------------------------------------

export const REALITY_MAP_LIMITS = {
  claimCategories: [
    'factual_observation', 'interpretation', 'assumption',
    'causal_explanation', 'motive', 'timeline_assertion', 'unresolved_question',
  ],
  confidences: [
    'high_confidence', 'moderate_confidence', 'low_confidence', 'insufficient_information',
  ],
  hypothesisStatuses: ['active', 'weakened', 'strengthened', 'archived'],
  relationships: [
    'supports', 'contradicts', 'contextualizes', 'weakens',
    'unrelated_inconclusive', 'included',
  ],
  // All legal link target types (material + player-owned graph nodes).
  targetTypes: [
    'evidence', 'artifact', 'journal_entry', 'notebook_entry',
    'specialist', 'character', 'claim', 'hypothesis',
  ],
  ownerTypes: ['claim', 'hypothesis'],
  // Material targets are case material that is already player-visible.
  materialTargetTypes: [
    'evidence', 'artifact', 'journal_entry', 'notebook_entry', 'specialist', 'character',
  ],
  reviewFocuses: ['assumptions', 'discriminate', 'alternatives', 'falsify', 'critique'],
  provenanceKinds: [
    'established_fact', 'player_interpretation', 'specialist_opinion',
    'unverified_assumption', 'ai_suggestion',
  ],
  maxClaims: 60,
  maxHypotheses: 20,
  maxLinks: 300,
  maxTitleChars: 160,
  maxNameChars: 160,
  maxTextChars: 2_000,
  maxRationaleChars: 800,
  maxCompareHypotheses: 4,
  maxAuditItemsPerSection: 8,
  maxTensions: 20,
  maxReviewChars: 2_000,
  maxReviewContextChars: 6_000,
} as const;

export type ClaimCategory = (typeof REALITY_MAP_LIMITS.claimCategories)[number];
export type Confidence = (typeof REALITY_MAP_LIMITS.confidences)[number];
export type HypothesisStatus = (typeof REALITY_MAP_LIMITS.hypothesisStatuses)[number];
export type Relationship = (typeof REALITY_MAP_LIMITS.relationships)[number];
export type LinkTargetType = (typeof REALITY_MAP_LIMITS.targetTypes)[number];
export type LinkOwnerType = (typeof REALITY_MAP_LIMITS.ownerTypes)[number];
export type MaterialTargetType = (typeof REALITY_MAP_LIMITS.materialTargetTypes)[number];
export type ReviewFocus = (typeof REALITY_MAP_LIMITS.reviewFocuses)[number];
export type Provenance = (typeof REALITY_MAP_LIMITS.provenanceKinds)[number];

export type AnyRow = Record<string, any>;

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

function inList(list: readonly string[], value: unknown): boolean {
  return typeof value === 'string' && list.includes(value);
}

export function isClaimCategory(value: unknown): value is ClaimCategory {
  return inList(REALITY_MAP_LIMITS.claimCategories, value);
}
export function isConfidence(value: unknown): value is Confidence {
  return inList(REALITY_MAP_LIMITS.confidences, value);
}
export function isHypothesisStatus(value: unknown): value is HypothesisStatus {
  return inList(REALITY_MAP_LIMITS.hypothesisStatuses, value);
}
export function isRelationship(value: unknown): value is Relationship {
  return inList(REALITY_MAP_LIMITS.relationships, value);
}
export function isLinkTargetType(value: unknown): value is LinkTargetType {
  return inList(REALITY_MAP_LIMITS.targetTypes, value);
}
export function isRealityMapOwnerType(value: unknown): value is LinkOwnerType {
  return inList(REALITY_MAP_LIMITS.ownerTypes, value);
}
export function isMaterialTargetType(value: unknown): value is MaterialTargetType {
  return inList(REALITY_MAP_LIMITS.materialTargetTypes, value);
}
export function isReviewFocus(value: unknown): value is ReviewFocus {
  return inList(REALITY_MAP_LIMITS.reviewFocuses, value);
}
export function isProvenance(value: unknown): value is Provenance {
  return inList(REALITY_MAP_LIMITS.provenanceKinds, value);
}

/**
 * The three legal link shapes:
 *   claim     -> material            (relationship != included)
 *   hypothesis -> claim              (relationship == included, membership)
 *   hypothesis -> material           (relationship != included)
 * Anything else is rejected at write time by the API and at the DB by the
 * shape CHECK constraint in migration 008.
 */
export function isLinkShapeValid(
  ownerType: unknown,
  targetType: unknown,
  relationship: unknown,
): boolean {
  if (!isRealityMapOwnerType(ownerType) || !isLinkTargetType(targetType) || !isRelationship(relationship)) {
    return false;
  }
  if (ownerType === 'claim') {
    return isMaterialTargetType(targetType) && relationship !== 'included';
  }
  // hypothesis owner
  if (targetType === 'claim') return relationship === 'included';
  return isMaterialTargetType(targetType) && relationship !== 'included';
}

// ---------------------------------------------------------------------------
// Small local coercion helpers (tolerate raw snake_case or mapped camelCase).
// Deliberately local so this module stays fully self-contained and pure.
// ---------------------------------------------------------------------------

function pick(row: AnyRow, camel: string, snake: string): any {
  if (row && row[camel] !== undefined) return row[camel];
  return row ? row[snake] : undefined;
}
function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}
function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}
export function clip(value: unknown, max: number): string {
  const text = str(value);
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}
function prefer<T extends string>(value: unknown, fallback: T, guard: (v: unknown) => v is T): T {
  return guard(value) ? value : fallback;
}

// ---------------------------------------------------------------------------
// Public DTO allowlists
// ---------------------------------------------------------------------------

export interface PublicClaim {
  id: string;
  investigationId: string;
  title: string;
  description: string;
  claimCategory: ClaimCategory;
  confidence: Confidence;
  notes: string;
  sourceJournalEntryId: string | null;
  sourceNotebookEntryId: string | null;
  sourcePerspectiveExperienceId: string | null;
  sourcePerspectiveReflectionId: string | null;
  isTutorial: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface PublicHypothesis {
  id: string;
  investigationId: string;
  name: string;
  explanation: string;
  status: HypothesisStatus;
  confidence: Confidence;
  missingInformation: string;
  alternativeExplanations: string;
  playerNotes: string;
  isTutorial: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface PublicLink {
  id: string;
  investigationId: string;
  ownerType: LinkOwnerType;
  ownerId: string;
  targetType: LinkTargetType;
  targetId: string;
  relationship: Relationship;
  rationale: string;
  ownerLabel: string;
  targetLabel: string;
  targetSubLabel: string;
  isTutorial: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export function toPublicClaim(row: AnyRow): PublicClaim {
  return {
    id: str(pick(row, 'id', 'id')),
    investigationId: str(pick(row, 'investigationId', 'investigation_id')),
    title: clip(pick(row, 'title', 'title'), REALITY_MAP_LIMITS.maxTitleChars),
    description: clip(pick(row, 'description', 'description'), REALITY_MAP_LIMITS.maxTextChars),
    claimCategory: prefer(pick(row, 'claimCategory', 'claim_category'), 'factual_observation' as ClaimCategory, isClaimCategory),
    confidence: prefer(pick(row, 'confidence', 'confidence'), 'insufficient_information' as Confidence, isConfidence),
    notes: clip(pick(row, 'notes', 'notes'), REALITY_MAP_LIMITS.maxTextChars),
    sourceJournalEntryId: pick(row, 'sourceJournalEntryId', 'source_journal_entry_id') ?? null,
    sourceNotebookEntryId: pick(row, 'sourceNotebookEntryId', 'source_notebook_entry_id') ?? null,
    sourcePerspectiveExperienceId: pick(row, 'sourcePerspectiveExperienceId', 'source_perspective_experience_id') ?? null,
    sourcePerspectiveReflectionId: pick(row, 'sourcePerspectiveReflectionId', 'source_perspective_reflection_id') ?? null,
    isTutorial: bool(pick(row, 'isTutorial', 'is_tutorial')),
    createdAt: pick(row, 'createdAt', 'created_at'),
    updatedAt: pick(row, 'updatedAt', 'updated_at'),
  };
}

export function toPublicHypothesis(row: AnyRow): PublicHypothesis {
  return {
    id: str(pick(row, 'id', 'id')),
    investigationId: str(pick(row, 'investigationId', 'investigation_id')),
    name: clip(pick(row, 'name', 'name'), REALITY_MAP_LIMITS.maxNameChars),
    explanation: clip(pick(row, 'explanation', 'explanation'), REALITY_MAP_LIMITS.maxTextChars),
    status: prefer(pick(row, 'status', 'status'), 'active' as HypothesisStatus, isHypothesisStatus),
    confidence: prefer(pick(row, 'confidence', 'confidence'), 'insufficient_information' as Confidence, isConfidence),
    missingInformation: clip(pick(row, 'missingInformation', 'missing_information'), REALITY_MAP_LIMITS.maxTextChars),
    alternativeExplanations: clip(pick(row, 'alternativeExplanations', 'alternative_explanations'), REALITY_MAP_LIMITS.maxTextChars),
    playerNotes: clip(pick(row, 'playerNotes', 'player_notes'), REALITY_MAP_LIMITS.maxTextChars),
    isTutorial: bool(pick(row, 'isTutorial', 'is_tutorial')),
    createdAt: pick(row, 'createdAt', 'created_at'),
    updatedAt: pick(row, 'updatedAt', 'updated_at'),
  };
}

// ---------------------------------------------------------------------------
// Material index — labels for every resolvable link endpoint
// ---------------------------------------------------------------------------

export interface MaterialItem {
  id: string;
  type: LinkTargetType;
  label: string;
  subLabel: string;
}

export interface MaterialIndex {
  byKey: Record<string, MaterialItem>;
  items: MaterialItem[];
  byType: Partial<Record<LinkTargetType, MaterialItem[]>>;
}

export interface MaterialIndexInput {
  evidence?: AnyRow[];
  artifacts?: AnyRow[];
  specialists?: AnyRow[];
  characters?: AnyRow[];
  journalEntries?: AnyRow[];
  notebookEntries?: AnyRow[];
  claims?: AnyRow[];
  hypotheses?: AnyRow[];
}

export function materialKey(type: LinkTargetType, id: string): string {
  return `${type}:${id}`;
}

/**
 * Build a label lookup for every material the player may link to. All inputs
 * are already-safe DTOs supplied by the caller (visible evidence, safe artifact
 * summaries, public specialists, public character names, the player's own
 * journal/notebook and the player's own claims/hypotheses).
 */
export function buildMaterialIndex(input: MaterialIndexInput): MaterialIndex {
  const items: MaterialItem[] = [];
  const add = (type: LinkTargetType, id: unknown, label: unknown, subLabel: unknown): void => {
    const idText = str(id);
    if (!idText) return;
    items.push({
      id: idText,
      type,
      label: clip(label, 160) || `${type} ${idText.slice(0, 8)}`,
      subLabel: clip(subLabel, 120),
    });
  };

  for (const row of input.evidence ?? []) {
    add('evidence', pick(row, 'id', 'id'), pick(row, 'source', 'source') || pick(row, 'description', 'description'), pick(row, 'category', 'category'));
  }
  for (const row of input.artifacts ?? []) {
    add('artifact', pick(row, 'id', 'id'), pick(row, 'title', 'title'), pick(row, 'artifactType', 'artifact_type'));
  }
  for (const row of input.specialists ?? []) {
    add('specialist', pick(row, 'id', 'id'), pick(row, 'name', 'name') || pick(row, 'specialistKey', 'specialist_key'), pick(row, 'title', 'title'));
  }
  for (const row of input.characters ?? []) {
    add('character', pick(row, 'id', 'id'), pick(row, 'name', 'name'), pick(row, 'role', 'role'));
  }
  for (const row of input.journalEntries ?? []) {
    add('journal_entry', pick(row, 'id', 'id'), `Journal: ${clip(pick(row, 'entryType', 'entry_type'), 80)}`, pick(row, 'content', 'content'));
  }
  for (const row of input.notebookEntries ?? []) {
    add('notebook_entry', pick(row, 'id', 'id'), pick(row, 'title', 'title') || pick(row, 'concept', 'concept'), pick(row, 'entryType', 'entry_type'));
  }
  for (const row of input.claims ?? []) {
    add('claim', pick(row, 'id', 'id'), pick(row, 'title', 'title'), 'your claim');
  }
  for (const row of input.hypotheses ?? []) {
    add('hypothesis', pick(row, 'id', 'id'), pick(row, 'name', 'name'), 'your hypothesis');
  }

  const byKey: Record<string, MaterialItem> = {};
  const byType: Partial<Record<LinkTargetType, MaterialItem[]>> = {};
  for (const item of items) {
    byKey[materialKey(item.type, item.id)] = item;
    const bucket = byType[item.type] ?? [];
    bucket.push(item);
    byType[item.type] = bucket;
  }
  return { byKey, items, byType };
}

export function findMaterial(index: MaterialIndex, type: LinkTargetType, id: string): MaterialItem | undefined {
  return index.byKey[materialKey(type, id)];
}

/**
 * Build a link DTO with labels resolved from the index. Returns null when the
 * owner or the target no longer resolves — the server drops such links from
 * snapshots (defence in depth against stale links to deleted/hidden material).
 */
export function toPublicLink(row: AnyRow, index: MaterialIndex): PublicLink | null {
  const ownerType = pick(row, 'ownerType', 'owner_type');
  const targetType = pick(row, 'targetType', 'target_type');
  const ownerId = str(pick(row, 'ownerId', 'owner_id'));
  const targetId = str(pick(row, 'targetId', 'target_id'));
  if (!isRealityMapOwnerType(ownerType) || !isLinkTargetType(targetType)) return null;
  const owner = findMaterial(index, ownerType, ownerId);
  const target = findMaterial(index, targetType, targetId);
  if (!owner || !target) return null;
  return {
    id: str(pick(row, 'id', 'id')),
    investigationId: str(pick(row, 'investigationId', 'investigation_id')),
    ownerType,
    ownerId,
    targetType,
    targetId,
    relationship: prefer(pick(row, 'relationship', 'relationship'), 'contextualizes' as Relationship, isRelationship),
    rationale: clip(pick(row, 'rationale', 'rationale'), REALITY_MAP_LIMITS.maxRationaleChars),
    ownerLabel: owner.label,
    targetLabel: target.label,
    targetSubLabel: target.subLabel,
    isTutorial: bool(pick(row, 'isTutorial', 'is_tutorial')),
    createdAt: pick(row, 'createdAt', 'created_at'),
    updatedAt: pick(row, 'updatedAt', 'updated_at'),
  };
}

// ---------------------------------------------------------------------------
// Deterministic tension derivation (surfaces conflicts; never resolves them)
// ---------------------------------------------------------------------------

export interface Tension {
  id: string;
  kind: 'material_conflict' | 'claim_conflict' | 'hypothesis_conflict';
  label: string;
  description: string;
  claimIds: string[];
  hypothesisIds: string[];
  materialRef: string;
}

export interface TensionInput {
  claims?: PublicClaim[];
  hypotheses?: PublicHypothesis[];
  links?: PublicLink[];
}

function stableId(parts: string[]): string {
  return `t-${parts.join('-').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120)}`;
}

/**
 * Derive conflicts purely from the player's own graph. Opposing `supports` vs
 * `contradicts`/`weakens` relationships on the same material produce tensions.
 * The result is deterministic, capped, and explicitly framed as unresolved
 * questions — it never picks a winner or touches canonical truth.
 */
export function deriveTensions(input: TensionInput): Tension[] {
  const claims = input.claims ?? [];
  const hypotheses = input.hypotheses ?? [];
  const links = input.links ?? [];
  const claimById = new Map(claims.map((c) => [c.id, c]));
  const hypothesisById = new Map(hypotheses.map((h) => [h.id, h]));
  const tensions: Tension[] = [];
  const seen = new Set<string>();

  // Group material links by target so opposing relationships can be compared.
  const byMaterial = new Map<string, PublicLink[]>();
  for (const link of links) {
    if (!isMaterialTargetType(link.targetType)) continue;
    const key = materialKey(link.targetType, link.targetId);
    const bucket = byMaterial.get(key) ?? [];
    bucket.push(link);
    byMaterial.set(key, bucket);
  }

  for (const [materialRef, group] of byMaterial) {
    const supporting = group.filter((l) => l.relationship === 'supports');
    const opposing = group.filter((l) => l.relationship === 'contradicts' || l.relationship === 'weakens');
    if (supporting.length === 0 || opposing.length === 0) continue;

    // material_conflict: at least one claim both supports and contradicts the material.
    const supportingClaimIds = supporting.filter((l) => l.ownerType === 'claim').map((l) => l.ownerId);
    const opposingClaimIds = opposing.filter((l) => l.ownerType === 'claim').map((l) => l.ownerId);
    const materialLabel = supporting[0]?.targetLabel || materialRef;

    if (supportingClaimIds.length > 0 && opposingClaimIds.length > 0) {
      const id = stableId(['material', materialRef]);
      if (!seen.has(id)) {
        seen.add(id);
        tensions.push({
          id,
          kind: 'material_conflict',
          label: 'Conflicting readings of the same material',
          description: `Some of your claims treat ${materialLabel} as supporting a view while others treat it as weakening or contradicting it. Both readings are left open.`,
          claimIds: [...new Set([...supportingClaimIds, ...opposingClaimIds])],
          hypothesisIds: [],
          materialRef,
        });
      }
    }

    // claim_conflict: distinct claims on the same material with opposing stances.
    for (const supportId of supportingClaimIds) {
      for (const opposeId of opposingClaimIds) {
        if (supportId === opposeId) continue;
        const a = claimById.get(supportId);
        const b = claimById.get(opposeId);
        if (!a || !b) continue;
        const id = stableId(['claims', supportId, opposeId]);
        if (seen.has(id)) continue;
        seen.add(id);
        tensions.push({
          id,
          kind: 'claim_conflict',
          label: 'Two claims point in opposite directions',
          description: `"${clip(a.title, 90)}" and "${clip(b.title, 90)}" take opposing stances toward ${materialLabel}. Neither is marked correct.`,
          claimIds: [supportId, opposeId],
          hypothesisIds: [],
          materialRef,
        });
      }
    }

    // hypothesis_conflict: two hypotheses (via their included claims) rely on
    // opposing readings of the same material.
    const stanceByHypothesis = new Map<string, 'supports' | 'opposes'>();
    const hypothesisOfClaim = new Map<string, string>();
    for (const link of links) {
      if (link.ownerType === 'hypothesis' && link.targetType === 'claim' && link.relationship === 'included') {
        hypothesisOfClaim.set(link.targetId, link.ownerId);
      }
    }
    for (const link of [...supporting, ...opposing]) {
      if (link.ownerType !== 'claim') continue;
      const hid = hypothesisOfClaim.get(link.ownerId);
      if (!hid || !hypothesisById.has(hid)) continue;
      const stance = link.relationship === 'supports' ? 'supports' : 'opposes';
      const prior = stanceByHypothesis.get(hid);
      if (prior && prior !== stance) {
        const id = stableId(['hypotheses', materialRef, hid]);
        if (!seen.has(id)) {
          seen.add(id);
          tensions.push({
            id,
            kind: 'hypothesis_conflict',
            label: 'A hypothesis rests on mixed signals',
            description: `The claims included in "${clip(hypothesisById.get(hid)?.name || hid, 90)}" read ${materialLabel} in two different ways. This is left for you to examine.`,
            claimIds: [],
            hypothesisIds: [hid],
            materialRef,
          });
        }
      } else {
        stanceByHypothesis.set(hid, stance);
      }
    }
  }

  return tensions.slice(0, REALITY_MAP_LIMITS.maxTensions);
}

// ---------------------------------------------------------------------------
// Reasoning audit
// ---------------------------------------------------------------------------

export interface AuditSource {
  claimId?: string | undefined;
  hypothesisId?: string | undefined;
  materialRef?: string | undefined;
}

export interface AuditItem {
  id: string;
  text: string;
  provenance: Provenance;
  sources: AuditSource;
}

export interface AuditSection {
  key: string;
  title: string;
  items: AuditItem[];
}

export interface ReasoningAudit {
  sections: AuditSection[];
  provenanceLegend: Record<Provenance, string>;
  disclaimer: string;
  counts: Record<string, number>;
  aiSummary: string;
}

export interface ReasoningAuditInput {
  claims?: PublicClaim[];
  hypotheses?: PublicHypothesis[];
  links?: PublicLink[];
  tensions?: Tension[];
  prompts?: Array<{ text: string; claimCategoryHint?: string }>;
}

export const REASONING_AUDIT_SECTION_KEYS = [
  'unsupported_assumptions',
  'conclusions_beyond_evidence',
  'overlooked_contradictions',
  'missing_information',
  'alternative_explanations',
  'suggested_questions',
] as const;

const AUDIT_TITLES: Record<string, string> = {
  unsupported_assumptions: 'Unsupported assumptions',
  conclusions_beyond_evidence: 'Conclusions beyond the evidence',
  overlooked_contradictions: 'Overlooked contradictions',
  missing_information: 'Missing information',
  alternative_explanations: 'Alternative explanations',
  suggested_questions: 'Questions worth asking',
};

const PROVENANCE_LEGEND: Record<Provenance, string> = {
  established_fact: 'A player-visible fact recorded in this case (not a claim about the outcome).',
  player_interpretation: 'Your own reading of the material; it is not established as true.',
  specialist_opinion: 'A bounded opinion from a specialist; it may be uncertain or contested.',
  unverified_assumption: 'Something you have assumed without support in the visible material.',
  ai_suggestion: 'A question generated from your current notes to guide your own thinking.',
};

const AUDIT_DISCLAIMER =
  'This audit is a thinking aid built only from your own notes and player-visible material. ' +
  'It does not know the solution, does not rank hypotheses as correct, and may itself be incomplete or wrong.';

/** Shared disclaimer exported so API responses can tag AI-assisted output. */
export const REASONING_DISCLAIMER = AUDIT_DISCLAIMER;

function item(id: string, text: string, provenance: Provenance, sources: AuditSource = {}): AuditItem {
  return { id, text: clip(text, REALITY_MAP_LIMITS.maxReviewChars), provenance, sources };
}

/**
 * Build a six-section reasoning audit. Every item carries provenance and the
 * whole audit carries a disclaimer. `aiSummary` is ALWAYS deterministic and
 * derived from counts of the player's own state — it never calls a model and
 * never consults canonical truth.
 */
export function buildReasoningAudit(input: ReasoningAuditInput): ReasoningAudit {
  const claims = input.claims ?? [];
  const hypotheses = input.hypotheses ?? [];
  const links = input.links ?? [];
  const tensions = input.tensions ?? [];
  const prompts = input.prompts ?? [];
  const limit = REALITY_MAP_LIMITS.maxAuditItemsPerSection;

  const supportingLinksByClaim = new Map<string, PublicLink[]>();
  for (const link of links) {
    if (link.relationship !== 'supports') continue;
    const bucket = supportingLinksByClaim.get(link.ownerId) ?? [];
    bucket.push(link);
    supportingLinksByClaim.set(link.ownerId, bucket);
  }

  const unsupported = claims
    .filter((c) => c.claimCategory === 'assumption' || c.confidence === 'insufficient_information' || c.confidence === 'low_confidence')
    .slice(0, limit)
    .map((c) => item(`as-${c.id}`, `Your claim "${clip(c.title, 100)}" rests on an assumption or low confidence. What would confirm or drop it?`,
      c.claimCategory === 'assumption' ? 'unverified_assumption' : 'player_interpretation', { claimId: c.id }));

  const beyond = claims
    .filter((c) => (c.claimCategory === 'causal_explanation' || c.claimCategory === 'motive' || c.claimCategory === 'timeline_assertion')
      && (c.confidence === 'high_confidence' || c.confidence === 'moderate_confidence')
      && (supportingLinksByClaim.get(c.id) ?? []).length === 0)
    .slice(0, limit)
    .map((c) => item(`be-${c.id}`, `"${clip(c.title, 100)}" is stated with confidence but is not yet linked to any material you have examined.`,
      'player_interpretation', { claimId: c.id }));

  const overlooked = tensions
    .filter((t) => t.kind !== 'hypothesis_conflict')
    .slice(0, limit)
    .map((t) => item(`oc-${t.id}`, `Unresolved: ${t.description}`, 'player_interpretation', {
      claimId: t.claimIds[0], hypothesisId: t.hypothesisIds[0], materialRef: t.materialRef,
    }));

  const missing: AuditItem[] = [];
  for (const c of claims.filter((c) => c.claimCategory === 'unresolved_question').slice(0, limit)) {
    missing.push(item(`mi-c-${c.id}`, `Open question in your notes: ${clip(c.title, 120)}`, 'player_interpretation', { claimId: c.id }));
  }
  for (const h of hypotheses.filter((h) => h.missingInformation.trim().length > 0).slice(0, limit)) {
    missing.push(item(`mi-h-${h.id}`, `For "${clip(h.name, 80)}" you still need: ${clip(h.missingInformation, 140)}`, 'player_interpretation', { hypothesisId: h.id }));
  }

  const alternatives: AuditItem[] = [];
  for (const h of hypotheses.filter((h) => h.alternativeExplanations.trim().length > 0).slice(0, limit)) {
    alternatives.push(item(`al-h-${h.id}`, `"${clip(h.name, 80)}" also admits: ${clip(h.alternativeExplanations, 140)}`, 'player_interpretation', { hypothesisId: h.id }));
  }
  for (const link of links.filter((l) => l.relationship === 'contextualizes').slice(0, limit)) {
    alternatives.push(item(`al-l-${link.id}`, `${clip(link.ownerLabel, 70)} could alternatively be read through ${clip(link.targetLabel, 80)}.`,
      link.targetType === 'specialist' ? 'specialist_opinion' : 'player_interpretation', {
        claimId: link.ownerType === 'claim' ? link.ownerId : undefined,
        materialRef: materialKey(link.targetType, link.targetId),
      }));
  }

  const questions: AuditItem[] = prompts
    .filter((p) => typeof p.text === 'string' && p.text.trim().length > 0)
    .slice(0, limit)
    .map((p, i) => item(`sq-${i}`, p.text.trim().endsWith('?') ? p.text.trim() : `${p.text.trim()}?`, 'ai_suggestion'));
  if (questions.length === 0) {
    questions.push(item('sq-default', 'What observation would most change how you weigh your current hypotheses?', 'ai_suggestion'));
  }

  const sections: AuditSection[] = REASONING_AUDIT_SECTION_KEYS.map((key) => ({
    key,
    title: AUDIT_TITLES[key] ?? key,
    items: key === 'unsupported_assumptions' ? unsupported
      : key === 'conclusions_beyond_evidence' ? beyond
      : key === 'overlooked_contradictions' ? overlooked
      : key === 'missing_information' ? missing.slice(0, limit)
      : key === 'alternative_explanations' ? alternatives.slice(0, limit)
      : questions,
  }));

  const counts: Record<string, number> = {
    claims: claims.length,
    hypotheses: hypotheses.length,
    links: links.length,
    tensions: tensions.length,
    unsupportedAssumptions: unsupported.length,
    conclusionsBeyondEvidence: beyond.length,
    overlookedContradictions: overlooked.length,
    missingInformation: Math.min(missing.length, limit),
    alternativeExplanations: Math.min(alternatives.length, limit),
    suggestedQuestions: questions.length,
  };

  const active = hypotheses.filter((h) => h.status === 'active').length;
  const aiSummary = `Based only on your notes: ${claims.length} claim${claims.length === 1 ? '' : 's'}, `
    + `${active} active hypothesis${active === 1 ? '' : 'es'}, ${links.length} link${links.length === 1 ? '' : 's'} and `
    + `${tensions.length} unresolved tension${tensions.length === 1 ? '' : 's'}. `
    + `The largest gaps are ${unsupported.length} unsupported assumption${unsupported.length === 1 ? '' : 's'}, `
    + `${beyond.length} conclusion${beyond.length === 1 ? '' : 's'} beyond the examined material and `
    + `${Math.min(missing.length, limit)} open information need${Math.min(missing.length, limit) === 1 ? '' : 's'}. `
    + `This summary does not identify a solution or endorse any hypothesis.`;

  return {
    sections,
    provenanceLegend: PROVENANCE_LEGEND,
    disclaimer: AUDIT_DISCLAIMER,
    counts,
    aiSummary: clip(aiSummary, REALITY_MAP_LIMITS.maxReviewChars),
  };
}

// ---------------------------------------------------------------------------
// Specialist hypothesis review (question-only, grounded context)
// ---------------------------------------------------------------------------

export interface HypothesisReviewInput {
  specialistName: string;
  focus: ReviewFocus;
  hypothesis: PublicHypothesis;
  claims?: PublicClaim[];
  hypotheses?: PublicHypothesis[];
  links?: PublicLink[];
  tensions?: Tension[];
  comparisonHypothesis?: PublicHypothesis | null;
  materialIndex?: MaterialIndex;
}

const REVIEW_INSTRUCTION =
  'Ground every sentence in the context below. Do not assert facts outside this context. ' +
  'Do not state which hypothesis is correct. Ask questions rather than conclude the case. ' +
  'Never mention a culprit, canonical solution, hidden evidence or hidden character details.';

const FOCUS_QUESTIONS: Record<ReviewFocus, string> = {
  assumptions: 'Which assumptions in this hypothesis are least supported by the listed material?',
  discriminate: 'Which single observation would best distinguish this hypothesis from the alternative?',
  alternatives: 'What alternative explanations remain compatible with the same material?',
  falsify: 'What evidence, if found, would weaken or falsify this hypothesis?',
  critique: 'Critique the target specialist reasoning using only the listed material.',
};

function reviewSourceLines(input: HypothesisReviewInput): string[] {
  const lines: string[] = [];
  const h = input.hypothesis;
  lines.push(`HYPOTHESIS: ${clip(h.name, 120)} (status: ${h.status}, confidence: ${h.confidence})`);
  lines.push(`Explanation: ${clip(h.explanation, 360) || 'none given'}`);
  if (h.missingInformation) lines.push(`Missing information: ${clip(h.missingInformation, 300)}`);
  if (h.alternativeExplanations) lines.push(`Alternatives noted: ${clip(h.alternativeExplanations, 300)}`);
  const includedIds = new Set(
    (input.links ?? [])
      .filter((l) => l.ownerType === 'hypothesis' && l.ownerId === h.id && l.targetType === 'claim' && l.relationship === 'included')
      .map((l) => l.targetId),
  );
  const claims = input.claims ?? [];
  const included = claims.filter((c) => includedIds.has(c.id));
  if (included.length > 0) {
    lines.push('INCLUDED CLAIMS:');
    for (const c of included.slice(0, 8)) {
      lines.push(`- ${clip(c.title, 140)} [${c.claimCategory}, ${c.confidence}]`);
    }
  }
  const materialLinks = (input.links ?? []).filter(
    (l) => l.ownerType === 'hypothesis' && l.ownerId === h.id && isMaterialTargetType(l.targetType),
  );
  if (materialLinks.length > 0) {
    lines.push('LINKED VISIBLE MATERIAL:');
    for (const l of materialLinks.slice(0, 8)) {
      lines.push(`- ${clip(l.targetLabel, 120)} (${l.targetType}, ${l.relationship})`);
    }
  }
  if (input.comparisonHypothesis) {
    const c = input.comparisonHypothesis;
    lines.push(`COMPARISON HYPOTHESIS: ${clip(c.name, 120)} (status: ${c.status}, confidence: ${c.confidence})`);
    lines.push(`Comparison explanation: ${clip(c.explanation, 300) || 'none given'}`);
  }
  const relevantTensions = (input.tensions ?? [])
    .filter((t) => t.hypothesisIds.includes(h.id) || t.claimIds.some((id) => includedIds.has(id)))
    .slice(0, 4);
  for (const t of relevantTensions) lines.push(`UNRESOLVED TENSION: ${clip(t.description, 220)}`);
  return lines;
}

/**
 * Build a bounded (<= 6000 chars) prompt context for a specialist review of a
 * hypothesis. Contains only player-owned notes and visible material labels,
 * plus an explicit instruction not to assert outside facts or pick a winner.
 */
export function buildHypothesisReviewContext(input: HypothesisReviewInput): string {
  const lines = [
    REVIEW_INSTRUCTION,
    `SPECIALIST VOICE: ${clip(input.specialistName, 80)} (a fictional, bounded persona)`,
    `REVIEW FOCUS: ${input.focus}`,
    `FOCUS QUESTION: ${FOCUS_QUESTIONS[input.focus]}`,
    ...reviewSourceLines(input),
    'Your reply must be a short set of questions and cautions (max ~150 words). Do not score or resolve the hypothesis.',
  ];
  let context = lines.join('\n');
  if (context.length > REALITY_MAP_LIMITS.maxReviewContextChars) {
    context = `${context.slice(0, REALITY_MAP_LIMITS.maxReviewContextChars - 40)}…\n[context truncated for length]`;
  }
  return context;
}

/**
 * Deterministic specialist-review fallback. Grounded, question-first, capped,
 * and always accompanied by the same limitation disclaimer used by the audit.
 */
export function deterministicHypothesisReview(input: HypothesisReviewInput): string {
  const name = clip(input.specialistName, 80) || 'Specialist';
  const hypothesisName = clip(input.hypothesis.name, 100) || 'this hypothesis';
  const focusLine = FOCUS_QUESTIONS[input.focus];
  const details: string[] = [];
  if (input.hypothesis.missingInformation) {
    details.push(`You noted missing information (${clip(input.hypothesis.missingInformation, 120)}); what would fill that gap?`);
  }
  if (input.hypothesis.alternativeExplanations) {
    details.push(`You listed alternatives (${clip(input.hypothesis.alternativeExplanations, 120)}); how would you tell them apart?`);
  }
  if (input.comparisonHypothesis) {
    details.push(`How does "${clip(input.comparisonHypothesis.name, 80)}" compare against the same material?`);
  }
  if (details.length === 0) {
    details.push('Which single visible observation would most change how strongly you hold this view?');
  }
  const body = [
    `${name} (bounded review — ${input.focus}): I can only work from the notes in front of me.`,
    `${focusLine}`,
    `On "${hypothesisName}": ${details.join(' ')}`,
    input.hypothesis.status === 'archived'
      ? 'You have archived this hypothesis; revisit it only if new material appears.'
      : `You currently mark this hypothesis as ${input.hypothesis.status} with ${input.hypothesis.confidence.replace(/_/g, ' ')} confidence.`,
    AUDIT_DISCLAIMER,
  ].join(' ');
  return clip(body, REALITY_MAP_LIMITS.maxReviewChars);
}

// ---------------------------------------------------------------------------
// Hypothesis comparison helper (compare endpoint)
// ---------------------------------------------------------------------------

export interface HypothesisComparison {
  hypotheses: Array<{
    id: string;
    name: string;
    status: HypothesisStatus;
    confidence: Confidence;
    includedClaimIds: string[];
  }>;
  sharedClaimIds: string[];
  divergences: Array<{ claimId: string; presentIn: string[]; absentIn: string[] }>;
  questions: string[];
  disclaimer: string;
}

export function buildHypothesisComparison(params: {
  hypotheses: PublicHypothesis[];
  claims?: PublicClaim[];
  links?: PublicLink[];
}): HypothesisComparison {
  const links = params.links ?? [];
  const byHypothesis = params.hypotheses.map((h) => {
    const includedClaimIds = links
      .filter((l) => l.ownerType === 'hypothesis' && l.ownerId === h.id && l.targetType === 'claim' && l.relationship === 'included')
      .map((l) => l.targetId);
    return {
      id: h.id,
      name: clip(h.name, 120),
      status: h.status,
      confidence: h.confidence,
      includedClaimIds: [...new Set(includedClaimIds)],
    };
  });

  const allClaimIds = [...new Set(byHypothesis.flatMap((h) => h.includedClaimIds))];
  const sharedClaimIds = allClaimIds.filter((claimId) =>
    byHypothesis.every((h) => h.includedClaimIds.includes(claimId)));
  const divergences = allClaimIds
    .filter((claimId) => !sharedClaimIds.includes(claimId))
    .slice(0, REALITY_MAP_LIMITS.maxTensions)
    .map((claimId) => ({
      claimId,
      presentIn: byHypothesis.filter((h) => h.includedClaimIds.includes(claimId)).map((h) => h.id),
      absentIn: byHypothesis.filter((h) => !h.includedClaimIds.includes(claimId)).map((h) => h.id),
    }));

  const questions = [
    'Which material would let you decide between these hypotheses?',
    'Do any of them rely on the same untested assumption?',
    'What would you expect to see if each hypothesis were right?',
  ];

  return {
    hypotheses: byHypothesis,
    sharedClaimIds,
    divergences,
    questions,
    disclaimer: AUDIT_DISCLAIMER + ' Comparison never selects a correct hypothesis.',
  };
}
