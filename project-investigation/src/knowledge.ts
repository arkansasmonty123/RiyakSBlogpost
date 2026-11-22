// M2 (Milestone 2): knowledge-system DTOs and bounded chat helpers.
// ---------------------------------------------------------------------------
// This module is deliberately kept free of any import from db.ts beyond plain
// row shapes, and NEVER imports canonical_truth. It only transforms safe rows
// that db.ts already selected from the additive M2 tables, and builds bounded
// text from those safe values. Its deterministic responder can therefore never
// reveal the culprit, the hidden location, or unreleased evidence.
//
// DTO allowlists are the single source of truth for what the M2 routes expose:
//   * artifact `content` appears ONLY in the detail DTO;
//   * `sourceUrl` is reported as null unless `sourceVerified === true`;
//   * bibliography/author/publication/verified are always exposed.

export type AnyRow = Record<string, any>;

// ---------------------------------------------------------------------------
// Bounded limits
// ---------------------------------------------------------------------------

export const KNOWLEDGE_LIMITS = {
  intents: [
    'explain',
    'deeper',
    'relevance',
    'challenge',
    'alternatives',
    'discriminate',
    'sources',
    'simpler',
    'critique',
  ],
  depths: ['plain', 'working', 'technical'],
  notebookEntryTypes: ['observation', 'fact', 'suspicion', 'theory', 'question', 'rejected', 'contradiction', 'note'],
  maxMessageChars: 4_000,
  maxConceptChars: 120,
  maxTitleChars: 160,
  maxContentChars: 4_000,
  maxArtifacts: 2,
  maxContextChars: 3_500,
  maxReplyChars: 2_000,
  maxSourceSnapshotChars: 2_500,
  maxPersonaChars: 1_000,
  maxDisagreementChars: 800,
  maxArtifactSnippetChars: 320,
} as const;

export type KnowledgeIntent = (typeof KNOWLEDGE_LIMITS.intents)[number];
export type KnowledgeDepth = (typeof KNOWLEDGE_LIMITS.depths)[number];
export type NotebookEntryType = (typeof KNOWLEDGE_LIMITS.notebookEntryTypes)[number];

export function isKnowledgeIntent(value: unknown): value is KnowledgeIntent {
  return typeof value === 'string' && (KNOWLEDGE_LIMITS.intents as readonly string[]).includes(value);
}

export function isKnowledgeDepth(value: unknown): value is KnowledgeDepth {
  return typeof value === 'string' && (KNOWLEDGE_LIMITS.depths as readonly string[]).includes(value);
}

export function isNotebookEntryType(value: unknown): value is NotebookEntryType {
  return typeof value === 'string' && (KNOWLEDGE_LIMITS.notebookEntryTypes as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Small coercion helpers (tolerate both mapRow camelCase and raw snake_case).
// ---------------------------------------------------------------------------

export function clip(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.length <= max ? value : `${value.slice(0, max).trimEnd()}…`;
}

function pick(row: AnyRow, camel: string, snake: string): any {
  if (row[camel] !== undefined) return row[camel];
  return row[snake];
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

// A non-verified source URL is never exposed. This is the only place the API
// surfaces source_url, so the rule cannot be bypassed by a route.
function safeSourceUrl(row: AnyRow): string | null {
  const verified = bool(pick(row, 'sourceVerified', 'source_verified'));
  const url = pick(row, 'sourceUrl', 'source_url');
  return verified && typeof url === 'string' && url.trim().length > 0 ? url : null;
}

// ---------------------------------------------------------------------------
// Public DTO allowlists
// ---------------------------------------------------------------------------

export function toPublicSpecialist(row: AnyRow) {
  return {
    id: str(pick(row, 'id', 'id')),
    specialistKey: str(pick(row, 'specialistKey', 'specialist_key')),
    name: str(pick(row, 'name', 'name')),
    title: str(pick(row, 'title', 'title')),
    specialization: str(pick(row, 'specialization', 'specialization')),
    discipline: str(pick(row, 'discipline', 'discipline')),
    knowledgeDomains: asStringArray(pick(row, 'knowledgeDomains', 'knowledge_domains')),
    personality: str(pick(row, 'personality', 'personality')),
    communicationStyle: str(pick(row, 'communicationStyle', 'communication_style')),
    reasoningApproach: str(pick(row, 'reasoningApproach', 'reasoning_approach')),
    expertiseSummary: str(pick(row, 'expertiseSummary', 'expertise_summary')),
    limitations: asStringArray(pick(row, 'limitations', 'limitations')),
    depthGuidance: asRecord(pick(row, 'depthGuidance', 'depth_guidance')),
    isFictional: bool(pick(row, 'isFictional', 'is_fictional')),
    realDisciplineBasis: str(pick(row, 'realDisciplineBasis', 'real_discipline_basis')),
    caseRelevance: str(pick(row, 'caseRelevance', 'case_relevance')),
    displayOrder: Number(pick(row, 'displayOrder', 'display_order') ?? 0),
  };
}

export function toPublicArtifactSummary(row: AnyRow) {
  return {
    id: str(pick(row, 'id', 'id')),
    artifactKey: str(pick(row, 'artifactKey', 'artifact_key')),
    title: str(pick(row, 'title', 'title')),
    artifactType: str(pick(row, 'artifactType', 'artifact_type')),
    description: str(pick(row, 'description', 'description')),
    specialistKey: str(pick(row, 'specialistKey', 'specialist_key')),
    knowledgeClass: str(pick(row, 'knowledgeClass', 'knowledge_class')),
    reliability: str(pick(row, 'reliability', 'reliability')),
    sourceAuthor: str(pick(row, 'sourceAuthor', 'source_author')),
    // Exposed only when verified; otherwise explicitly null.
    sourceUrl: safeSourceUrl(row),
    bibliographyRef: str(pick(row, 'bibliographyRef', 'bibliography_ref')),
    publicationDate: str(pick(row, 'publicationDate', 'publication_date')),
    sourceVerified: bool(pick(row, 'sourceVerified', 'source_verified')),
    isFictional: bool(pick(row, 'isFictional', 'is_fictional')),
    relatedConcepts: asStringArray(pick(row, 'relatedConcepts', 'related_concepts')),
  };
}

export function toPublicArtifactDetail(row: AnyRow) {
  return {
    ...toPublicArtifactSummary(row),
    // content and usageNote appear ONLY here, never in the summary/list DTO.
    content: str(pick(row, 'content', 'content')),
    usageNote: str(pick(row, 'usageNote', 'usage_note')),
  };
}

export function toPublicDisagreement(row: AnyRow) {
  return {
    id: str(pick(row, 'id', 'id')),
    disagreementKey: str(pick(row, 'disagreementKey', 'disagreement_key')),
    topic: str(pick(row, 'topic', 'topic')),
    specialistAKey: str(pick(row, 'specialistAKey', 'specialist_a_key')),
    specialistBKey: str(pick(row, 'specialistBKey', 'specialist_b_key')),
    specialistAName: str(pick(row, 'specialistAName', 'specialist_a_name')),
    specialistBName: str(pick(row, 'specialistBName', 'specialist_b_name')),
    positionA: str(pick(row, 'positionA', 'position_a')),
    positionB: str(pick(row, 'positionB', 'position_b')),
    disciplinaryBasis: str(pick(row, 'disciplinaryBasis', 'disciplinary_basis')),
    uncertaintyNote: str(pick(row, 'uncertaintyNote', 'uncertainty_note')),
    distinguishingEvidence: str(pick(row, 'distinguishingEvidence', 'distinguishing_evidence')),
    relatedArtifactKeys: asStringArray(pick(row, 'relatedArtifactKeys', 'related_artifact_keys')),
  };
}

export function toPublicNotebookEntry(row: AnyRow) {
  return {
    id: str(pick(row, 'id', 'id')),
    investigationId: str(pick(row, 'investigationId', 'investigation_id')),
    entryType: str(pick(row, 'entryType', 'entry_type')),
    artifactId: pick(row, 'artifactId', 'artifact_id') ?? null,
    specialistId: pick(row, 'specialistId', 'specialist_id') ?? null,
    concept: str(pick(row, 'concept', 'concept')),
    title: str(pick(row, 'title', 'title')),
    content: str(pick(row, 'content', 'content')),
    sourceSnapshot: asRecord(pick(row, 'sourceSnapshot', 'source_snapshot')),
    createdAt: pick(row, 'createdAt', 'created_at'),
    updatedAt: pick(row, 'updatedAt', 'updated_at'),
  };
}

// ---------------------------------------------------------------------------
// Token-overlap artifact retrieval (bounded to <= 2 artifacts)
// ---------------------------------------------------------------------------

function queryTokens(message: string, extra: string): string[] {
  const noise = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'what', 'how', 'why', 'are', 'was', 'were',
    'can', 'could', 'would', 'should', 'tell', 'about', 'from', 'have', 'has', 'into', 'does',
    'please', 'someone', 'thing', 'explain', 'really', 'just', 'does', 'did', 'you', 'your',
  ]);
  return `${message} ${extra}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !noise.has(token));
}

export function retrieveRelevantArtifacts(
  artifacts: AnyRow[],
  message: string,
  extra = '',
  max: number = KNOWLEDGE_LIMITS.maxArtifacts,
): AnyRow[] {
  if (!Array.isArray(artifacts) || artifacts.length === 0) return [];
  const tokens = queryTokens(message, extra);
  if (tokens.length === 0) return [];

  const scored = artifacts.map((artifact, index) => {
    const haystack = [
      artifact.title,
      artifact.description,
      artifact.artifactType,
      artifact.knowledgeClass,
      artifact.content,
      ...asStringArray(artifact.relatedConcepts),
    ].join(' ').toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += 1;
    }
    return { artifact, index, score };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, Math.min(max, KNOWLEDGE_LIMITS.maxArtifacts)))
    .map((entry) => entry.artifact);
}

// ---------------------------------------------------------------------------
// Bounded context builder for a specialist responder
// ---------------------------------------------------------------------------

export interface SpecialistContextParams {
  specialist: AnyRow; // already a public specialist DTO
  intent: KnowledgeIntent;
  depth: KnowledgeDepth;
  message: string;
  artifacts: AnyRow[]; // public artifact summaries (safe)
  disagreements: AnyRow[]; // public disagreement DTOs (safe)
}

export function buildSpecialistContext(p: SpecialistContextParams): string {
  const s = p.specialist;
  const lines: string[] = [];
  lines.push('GROUNDING RULES: Use ONLY the safe reference material below. Never reveal unreleased evidence, character secrets, the culprit, or the canonical solution. Never invent a source, quote or URL. Treat player theories as unconfirmed. Reply in at most ~90 words.');
  lines.push(`RESPONDING AS: ${clip(s.name, 80)} — ${clip(s.title, 80)} (${clip(s.discipline, 80)})`);
  lines.push(`SPECIALIZATION: ${clip(s.specialization, 160)}`);
  lines.push(`EXPERTISE: ${clip(s.expertiseSummary, KNOWLEDGE_LIMITS.maxPersonaChars)}`);
  lines.push(`PERSONA / STYLE: ${clip(s.personality, 200)} ${clip(s.communicationStyle, 200)}`);
  lines.push(`REASONING APPROACH: ${clip(s.reasoningApproach, 240)}`);
  const limitations = asStringArray(s.limitations).map((l) => clip(l, 200));
  if (limitations.length > 0) {
    lines.push('RESPECT THESE LIMITATIONS (do not conclude beyond them):');
    for (const limitation of limitations) lines.push(`- ${limitation}`);
  }
  const guidance = asRecord(s.depthGuidance)[p.depth];
  if (typeof guidance === 'string' && guidance.length > 0) {
    lines.push(`DEPTH (${p.depth}): ${clip(guidance, 240)}`);
  }
  lines.push(`DISCUSSION INTENT: ${p.intent}`);

  if (p.artifacts.length > 0) {
    lines.push('RELEVANT REFERENCE ARTIFACTS (safe excerpts only):');
    p.artifacts.slice(0, KNOWLEDGE_LIMITS.maxArtifacts).forEach((a, i) => {
      lines.push(
        `${i + 1}. [${clip(a.artifactType, 40)}] ${clip(a.title, 120)} ` +
        `(class: ${clip(a.knowledgeClass, 30)}; reliability: ${clip(a.reliability, 30)}; fictional: ${a.isFictional === true}) — ` +
        `${clip(a.description || a.content, KNOWLEDGE_LIMITS.maxArtifactSnippetChars)}`,
      );
    });
  }

  const disagreements = p.disagreements.slice(0, 2);
  if (disagreements.length > 0) {
    lines.push('CONTESTED POINTS (present both sides, keep the uncertainty):');
    for (const d of disagreements) {
      lines.push(
        `- ${clip(d.topic, 140)} | ${clip(d.specialistAName, 40)}: ${clip(d.positionA, 160)} ` +
        `vs ${clip(d.specialistBName, 40)}: ${clip(d.positionB, 160)} | ` +
        `distinguishing evidence: ${clip(d.distinguishingEvidence, 160)} | uncertainty: ${clip(d.uncertaintyNote, 160)}`,
      );
    }
  }

  let context = lines.join('\n');
  if (context.length > KNOWLEDGE_LIMITS.maxContextChars) {
    context = `${context.slice(0, KNOWLEDGE_LIMITS.maxContextChars - 60)}…\n[specialist context truncated for length]`;
  }
  return context;
}

// ---------------------------------------------------------------------------
// Deterministic, discipline/limitation/intent/depth-aware specialist responder
// ---------------------------------------------------------------------------

const INTENT_FRAMES: Record<KnowledgeIntent, string> = {
  explain: 'Here is how I would frame this from my discipline:',
  deeper: 'Going a level deeper on the mechanism:',
  relevance: 'What matters for the investigation is:',
  challenge: 'I would resist a quick conclusion here:',
  alternatives: 'The alternatives I would keep open are:',
  discriminate: 'The way to tell these apart is to look for:',
  sources: 'The kind of established reference I would reach for is:',
  simpler: 'In plain terms, the core idea is:',
  critique: 'My critical read of that line of reasoning is:',
};

const LENS_RULES: Array<{ re: RegExp; text: string; detail: string }> = [
  {
    re: /forensic|trace|fingerprint|material|lab/i,
    text: 'physical traces are only as strong as their collection and chain of custody, and a match says nothing by itself about when contact occurred.',
    detail: 'A partial mark may support only a qualified association; secondary transfer and contamination are the usual sources of overreach.',
  },
  {
    re: /security|access|sensor|alarm|badge|log|cctv/i,
    text: 'logs record what a system was told, not what physically happened, so scheduled maintenance, overrides and blind spots have to be read into the sequence.',
    detail: 'Absence of footage or a clean sensor log is not proof that nothing occurred in that window.',
  },
  {
    re: /gem|diamond|mineral|simulant|optic/i,
    text: 'appearance is not identity: simulants and treatments can imitate a stone, so instrument readings matter more than a visual impression.',
    detail: 'A grading report describes a stone at a point in time; it says nothing about custody or who handled it.',
  },
  {
    re: /insurance|account|financ|fraud|policy|document/i,
    text: 'motive is a documentary question — ownership, beneficiaries, dates and financial pressure are checked against paperwork rather than inferred.',
    detail: 'A holding structure or financial pressure is a possible motive, not evidence that a particular person acted.',
  },
];

function disciplineLens(specialist: AnyRow, depth: KnowledgeDepth): string {
  const haystack = [specialist.discipline, specialist.specialization, ...asStringArray(specialist.knowledgeDomains)]
    .join(' ')
    .toLowerCase();
  const rule = LENS_RULES.find((r) => r.re.test(haystack));
  if (!rule) {
    return str(specialist.expertiseSummary) ||
      'I keep the claim tied to what the available evidence can actually support, and I state the uncertainty openly.';
  }
  return depth === 'technical' ? `${rule.text} ${rule.detail}` : rule.text;
}

export function deterministicSpecialistReply(
  message: string,
  specialist: AnyRow,
  intent: KnowledgeIntent,
  depth: KnowledgeDepth,
  artifacts: AnyRow[],
  disagreements: AnyRow[],
): string {
  // `message` is intentionally NOT echoed verbatim: player text can contain
  // canonical spoilers, and even a safe responder must not replay them.
  const askedAQuestion = typeof message === 'string' && message.includes('?');
  const name = str(specialist.name) || 'Specialist';
  const title = str(specialist.title);
  const label = title ? `${name} — ${title}` : name;

  const parts: string[] = [];
  parts.push(INTENT_FRAMES[intent]);

  parts.push(clip(disciplineLens(specialist, depth), 420));

  if (depth === 'plain') {
    parts.push('Put simply: separate what is directly observed from what is only inferred, and do not let a plausible story harden into a fact.');
  } else if (depth === 'technical') {
    const domains = asStringArray(specialist.knowledgeDomains).slice(0, 4).join(', ');
    parts.push(domains
      ? `The relevant axes here are ${domains}; I would qualify any conclusion against those.`
      : 'I would qualify any conclusion against the method, the sample quality and known error sources.');
  }

  const retrieved = artifacts.slice(0, KNOWLEDGE_LIMITS.maxArtifacts);
  if (retrieved.length > 0) {
    const names = retrieved.map((a) => clip(a.title, 90)).join('; ');
    parts.push(`In the case file, the relevant reference material is ${names}. ${clip(retrieved[0]?.description || retrieved[0]?.content, KNOWLEDGE_LIMITS.maxArtifactSnippetChars)}`);
    if (intent === 'sources') {
      const refs = retrieved
        .map((a) => str(a.bibliographyRef || a.sourceAuthor))
        .filter(Boolean)
        .map((r) => clip(r, 140));
      parts.push(refs.length > 0 ? `Established references include: ${refs.join(' | ')}.` : 'I would ground this in established discipline literature rather than a specific unverified link.');
    }
  } else if (intent === 'sources') {
    parts.push('I would ground this in established discipline literature rather than cite a specific unverified link.');
  }

  const d = disagreements[0];
  if (['critique', 'challenge', 'discriminate', 'alternatives'].includes(intent) && d) {
    parts.push(
      `There is a genuine disagreement: ${clip(d.topic, 140)}. ${clip(d.specialistAName, 40)} holds that ${clip(d.positionA, 180)}; ` +
      `${clip(d.specialistBName, 40)} counters that ${clip(d.positionB, 180)}. ` +
      `The distinguishing evidence is ${clip(d.distinguishingEvidence, 180)}, and ${clip(d.uncertaintyNote, 180)}`,
    );
  }

  const limitations = asStringArray(specialist.limitations);
  if (limitations.length > 0) {
    parts.push(`Even so, I have to flag what I cannot conclude: ${clip(limitations[0], 240)}${limitations.length > 1 ? ' ' + clip(limitations[1], 200) : ''}.`);
  }

  parts.push(askedAQuestion
    ? 'Which of these points would you like to test against what we have actually found?'
    : 'Tell me which angle you want to press and I will stay within what the evidence supports.');

  // Field values are seed-authored and quote-free; strip any stray quotes so
  // the single pair we add around the body keeps the voice well-formed.
  const body = parts.filter(Boolean).join(' ').replace(/"/g, '');
  return clip(`${label}: "${body}"`, KNOWLEDGE_LIMITS.maxReplyChars);
}
