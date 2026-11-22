// PROD-014 (GAP-09): AI grounding & context discipline for the group chat.
// ---------------------------------------------------------------------------
// Every function in this module operates ONLY on player-safe inputs:
//   - the public case briefing,
//   - evidence DTOs already filtered by db.getEvidenceByCase (hidden
//     interpretation/hypothesis fields are never present),
//   - the PROD-013 safe suspect board (no knowledge/beliefs/secrets/dialogue
//     constraints and no canonical truth),
//   - player-authored journal / conversation text.
//
// This module never imports or reads canonical_truth. It cannot reveal the
// hidden solution because it is never given the solution. Its job is to pick a
// response role, project only the addressed suspect's public knowledge, keep a
// bounded rolling summary, retrieve a small relevant evidence window, and cap
// everything that would otherwise grow without limit.

// ---------------------------------------------------------------------------
// Bounded limits (kept in one place so the chat route can report them too).
// ---------------------------------------------------------------------------

export const GROUNDING_LIMITS = {
  recentWindow: 6,
  maxContextChars: 6000,
  maxRetrievedEvidence: 3,
  maxSummaryChars: 1200,
  maxResponseChars: 2000,
} as const;

// ---------------------------------------------------------------------------
// Investigative team roles (one shared inference architecture, many voices)
// ---------------------------------------------------------------------------

export type TeamRole = 'lead' | 'forensic' | 'field' | 'digital';

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  lead: 'Lead investigator',
  forensic: 'Forensic specialist',
  field: 'Field investigator',
  digital: 'Digital investigation specialist',
};

const ROLE_SYSTEM_HINTS: Record<TeamRole, string> = {
  lead: 'You set case strategy, weigh the overall theory and decide the next steps.',
  forensic: 'You interpret physical evidence, lab reports, fingerprints, traces and medical findings.',
  field: 'You interview witnesses and suspects and evaluate alibis and locations.',
  digital: 'You interpret CCTV, sensors, alarms, badges, access logs and the timeline.',
};

export function responderLabel(role: TeamRole): string {
  return TEAM_ROLE_LABELS[role];
}

export function roleSystemHint(role: TeamRole): string {
  return ROLE_SYSTEM_HINTS[role];
}

// Priority: forensic (physical traces) > digital (logs/timeline) > field
// (people) > lead (default). Deterministic and side-effect free.
const INTENT_PATTERNS: ReadonlyArray<{ role: TeamRole; pattern: RegExp }> = [
  {
    role: 'forensic',
    pattern: /\b(evidence|fingerprint|forensic|physical|lab|report|dna|trace|weapon|tool|cutter|residue|medical|fibre|fiber|glass|trophy|stun)\b/i,
  },
  {
    role: 'digital',
    pattern: /\b(cctv|footage|camera|digital|blackout|sensors?|alarms?|logs?|badge|keycard|timeline|timestamps?|maintenance|security|system|minute|seconds?)\b/i,
  },
  {
    role: 'field',
    pattern: /\b(suspects?|witness(es)?|alibis?|interviews?|persons?|people|who|where|question|asked|spoke|talked|martha|victor|jasper|daphne|mills|rhodes|guard|broker|curator)\b/i,
  },
];

export function detectTeamRole(message: string): TeamRole {
  for (const { role, pattern } of INTENT_PATTERNS) {
    if (pattern.test(message)) return role;
  }
  return 'lead';
}

// ---------------------------------------------------------------------------
// Suspect addressing + safe public knowledge projection
// ---------------------------------------------------------------------------

function matchesFullName(message: string, name: string): boolean {
  const lower = message.toLowerCase();
  const full = name.trim().toLowerCase();
  return full.length > 0 && lower.includes(full);
}

function matchesNamePart(message: string, name: string): boolean {
  const lower = message.toLowerCase();
  return name.trim().toLowerCase().split(/\s+/).some(
    (part) => part.length >= 4 && lower.includes(part),
  );
}

// A full name ("Victor Sterling") wins over a shared surname so we project
// only the person actually named. If no full name is present, distinct first
// or last names ("Victor", "the curator") may address a suspect; an ambiguous
// surname ("Sterling") addresses both, still with safe projections only.
export function findAddressedSuspectNames(message: string, suspectNames: readonly string[]): string[] {
  const exact = suspectNames.filter((name) => matchesFullName(message, name));
  if (exact.length > 0) return exact;
  return suspectNames.filter((name) => matchesNamePart(message, name));
}

// Structural shape of the PROD-013 safe suspect board entry. The real
// PublicSuspect DTO satisfies this shape; the chat route passes that vetted DTO
// straight through, so this module never touches a raw character row.
export interface SuspectContextInput {
  id: string;
  name: string;
  role: string;
  motive: string;
  background?: string;
  alibi?: string;
  confirmedAlibi?: string;
  relationships: Array<{ name: string; label: string }>;
  linkedEvidence: Array<{ id: string; source: string; category: string; examined: boolean }>;
  unansweredQuestions: string[];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function clip(value: unknown, max: number): string {
  const t = text(value).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

// Build a compact, player-safe snippet for ONE addressed suspect. Every field
// comes from the safe board DTO; nothing from knowledge/beliefs/secrets or the
// canonical truth can reach this string.
export function buildSuspectSnippet(s: SuspectContextInput): string {
  const lines: string[] = [`- ${s.name} (${s.role || 'person of interest'})`];
  const background = clip(s.background, 220);
  if (background) lines.push(`  Public background: ${background}`);
  if (s.motive) lines.push(`  Apparent motive (public): ${clip(s.motive, 160)}`);
  const alibi = clip(s.alibi, 160);
  if (alibi) lines.push(`  Stated alibi: ${alibi}`);
  const confirmed = clip(s.confirmedAlibi, 140);
  if (confirmed) lines.push(`  Alibi status: ${confirmed}`);
  if (s.relationships.length > 0) {
    lines.push(`  Known relationships: ${s.relationships.slice(0, 4).map((r) => `${r.label}: ${r.name}`).join('; ')}`);
  }
  if (s.linkedEvidence.length > 0) {
    const examined = s.linkedEvidence.filter((e) => e.examined).length;
    const sources = s.linkedEvidence.slice(0, 3).map((e) => clip(e.source, 40)).join(', ');
    lines.push(`  Linked visible evidence: ${examined} examined of ${s.linkedEvidence.length}; sources: ${sources}`);
  }
  const questions = s.unansweredQuestions.slice(0, 2).map((q) => clip(q, 110));
  if (questions.length > 0) lines.push(`  Open questions: ${questions.join(' ')}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Rolling, bounded conversation summary
// ---------------------------------------------------------------------------

export interface ChatTurn {
  role: string;
  content: string;
}

function summarizeTurn(turn: ChatTurn): string {
  const speaker = turn.role === 'player' ? 'Player' : 'Investigator';
  return `${speaker}: ${clip(turn.content, 180)}`;
}

// Append only the turns that have not been summarized yet, then keep the most
// recent GROUNDING_LIMITS.maxSummaryChars characters. Deterministic (no LLM
// call) so it is cheap and cannot invent or leak facts.
export function updateRollingSummary(
  previous: string,
  newTurns: readonly ChatTurn[],
  maxChars: number = GROUNDING_LIMITS.maxSummaryChars,
): string {
  const parts: string[] = [];
  const prev = clip(previous, maxChars);
  if (prev) parts.push(prev);
  for (const turn of newTurns) parts.push(summarizeTurn(turn));
  let result = parts.join(' | ');
  if (result.length > maxChars) {
    result = result.slice(result.length - maxChars);
    const separator = result.indexOf(' | ');
    if (separator >= 0) result = result.slice(separator + 3);
  }
  return result.trim();
}

// ---------------------------------------------------------------------------
// Bounded, retrieved context assembly
// ---------------------------------------------------------------------------

function queryTokens(message: string, extra: string): string[] {
  return Array.from(new Set(
    `${message} ${extra}`.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4),
  ));
}

function rankEvidence(
  evidence: ReadonlyArray<{ source?: unknown; category?: unknown; description?: unknown; reliability?: unknown }>,
  tokens: readonly string[],
  limit: number,
): Array<{ source?: unknown; category?: unknown; description?: unknown; reliability?: unknown }> {
  const scored = evidence.map((ev, index) => {
    const haystack = `${text(ev.source)} ${text(ev.category)} ${text(ev.description)}`.toLowerCase();
    let score = 0;
    for (const token of tokens) if (haystack.includes(token)) score += 1;
    return { ev, index, score };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const relevant = scored.filter((s) => s.score > 0).slice(0, limit).map((s) => s.ev);
  if (relevant.length > 0) return relevant;
  // No keyword overlap: fall back to the most recently discovered items rather
  // than dumping the entire evidence list into the prompt.
  return evidence.slice(-limit);
}

export interface GroundedContextParams {
  caseTitle: string;
  caseBriefing: string;
  message: string;
  messageHistory: ChatTurn[];
  previousSummary: string;
  alreadySummarizedCount: number;
  visibleEvidence: Array<{ source?: unknown; category?: unknown; description?: unknown; reliability?: unknown }>;
  journalEntries: Array<{ entryType?: unknown; content?: unknown; isConfirmed?: unknown }>;
  suspects: SuspectContextInput[];
  addressedSuspectNames: string[];
  teamRole: TeamRole;
  currentTheory?: string;
  suspicionLevel?: string;
}

export interface GroundedContextResult {
  context: string;
  summary: string;
  summarizedMessageCount: number;
  teamRole: TeamRole;
  addressedSuspects: string[];
  recentMessageCount: number;
  retrievedEvidenceCount: number;
  charCount: number;
}

export function buildGroundedContext(p: GroundedContextParams): GroundedContextResult {
  const window = GROUNDING_LIMITS.recentWindow;
  const total = p.messageHistory.length;
  const cutoff = Math.max(0, total - window);
  const already = Math.max(0, Math.min(p.alreadySummarizedCount, cutoff));
  const newlySummarized = p.messageHistory.slice(already, cutoff);
  const summary = updateRollingSummary(p.previousSummary, newlySummarized);
  const recent = p.messageHistory.slice(cutoff);

  const addressedNames = p.addressedSuspectNames.slice(0, 2);
  const addressedSuspects = p.suspects.filter((s) => addressedNames.includes(s.name)).slice(0, 2);
  const retrieved = rankEvidence(
    p.visibleEvidence,
    queryTokens(p.message, p.currentTheory ?? ''),
    GROUNDING_LIMITS.maxRetrievedEvidence,
  );

  const lines: string[] = [];
  lines.push(`CASE: ${clip(p.caseTitle, 120)}`);
  lines.push(clip(p.caseBriefing, 900));
  lines.push('');
  lines.push('GROUNDING RULES: Use only the facts below. Never reveal unreleased evidence, character secrets, the culprit, or the canonical solution. Treat unconfirmed player theories as theories, not facts. Reply in at most ~80 words.');
  lines.push(`RESPONDING AS: ${TEAM_ROLE_LABELS[p.teamRole]} (${roleSystemHint(p.teamRole)})`);
  lines.push('');

  if (summary) {
    lines.push('ROLLING CONVERSATION SUMMARY:');
    lines.push(summary);
    lines.push('');
  }
  if (recent.length > 0) {
    lines.push('RECENT MESSAGES (oldest first):');
    for (const turn of recent) {
      lines.push(`[${turn.role === 'player' ? 'PLAYER' : 'INVESTIGATOR'}]: ${clip(turn.content, 400)}`);
    }
    lines.push('');
  }
  if (p.currentTheory) lines.push(`PLAYER THEORY (unconfirmed): ${clip(p.currentTheory, 300)}`);
  if (p.suspicionLevel) lines.push(`PLAYER SUSPICION NOTE: ${clip(p.suspicionLevel, 200)}`);
  if (p.currentTheory || p.suspicionLevel) lines.push('');

  if (retrieved.length > 0) {
    lines.push('RELEVANT DISCOVERED EVIDENCE (safe descriptions only):');
    retrieved.forEach((ev, i) => {
      lines.push(`${i + 1}. [${text(ev.category) || 'item'}] ${clip(ev.description, 300)} (source: ${clip(ev.source, 80)}; reliability: ${clip(ev.reliability, 40)})`);
    });
    lines.push('');
  }
  if (addressedSuspects.length > 0) {
    lines.push('ADDRESSED SUSPECTS (public projection only - no hidden knowledge, beliefs or secrets):');
    for (const s of addressedSuspects) lines.push(buildSuspectSnippet(s));
    lines.push('');
  }
  const journal = p.journalEntries.slice(-2);
  if (journal.length > 0) {
    lines.push("PLAYER JOURNAL (the player's own notes):");
    journal.forEach((entry, i) => {
      const confirmed = entry.isConfirmed === true ? '[CONFIRMED] ' : '';
      lines.push(`${i + 1}. ${confirmed}${clip(entry.content, 260)}`);
    });
  }

  let context = lines.join('\n');
  if (context.length > GROUNDING_LIMITS.maxContextChars) {
    context = `${context.slice(0, GROUNDING_LIMITS.maxContextChars - 60)}…\n[context truncated for length]`;
  }

  return {
    context,
    summary,
    summarizedMessageCount: cutoff,
    teamRole: p.teamRole,
    addressedSuspects: addressedSuspects.map((s) => s.name),
    recentMessageCount: recent.length,
    retrievedEvidenceCount: retrieved.length,
    charCount: context.length,
  };
}

// ---------------------------------------------------------------------------
// Deterministic, role-aware fallback (preserved and strengthened).
// Uses only the safe addressed-suspect projection - never canonical values.
// ---------------------------------------------------------------------------

const DEFAULT_ANSWER = 'Let us test that against what we have already discovered. Which piece of evidence would you like to examine next?';

export function deterministicReply(
  message: string,
  teamRole: TeamRole,
  addressed: readonly SuspectContextInput[],
): string {
  const label = TEAM_ROLE_LABELS[teamRole];
  const lower = message.toLowerCase();

  if (/\b(hello|hi|hey|good (morning|evening)|who are you)\b/.test(lower)) {
    return `${label}: "I'm on the case. Tell me what you've found, or who you want to focus on, and we'll work through it."`;
  }

  const suspect = addressed[0];
  if (suspect) {
    const focus = suspect.motive ? ` The public record says: ${clip(suspect.motive, 120)}.` : '';
    return `${label}: "Let's look at ${suspect.name}.${focus} What do you want to test - the alibi, the timeline, or the evidence connected to them?"`;
  }

  if (/\b(evidence|fingerprint|forensic|lab|physical|trace|report)\b/.test(lower)) {
    const hint = teamRole === 'forensic'
      ? 'I can walk you through the physical findings.'
      : teamRole === 'digital'
        ? 'I can cross-check the physical findings against the logs and footage.'
        : 'Let us compare the physical findings with the rest of the case.';
    return `${label}: "Several items are on the evidence board. ${hint} Tell me which one stands out to you."`;
  }
  if (/\b(cctv|footage|camera|timeline|when|time|blackout|sensor|alarm|badge|keycard)\b/.test(lower)) {
    return `${label}: "Let's reconstruct the sequence carefully. Which time window looks inconsistent once we line up the logs and the footage?"`;
  }
  if (/\b(suspect|witness|alibi|person|people|interview|who)\b/.test(lower)) {
    return `${label}: "There are several people of interest, each with an alibi and a reason to be here. Name one and I'll walk you through what we know publicly about them."`;
  }
  if (/\b(theory|think|hypothesis|contradiction|conflict|inconsistent|why)\b/.test(lower)) {
    return `${label}: "Interesting. What evidence supports that, and what might contradict it? Test it against the facts we have actually uncovered."`;
  }
  return `${label}: "${DEFAULT_ANSWER}"`;
}

// Safety net for any responder path: cap the persisted/returned content length.
export function capResponse(content: string): string {
  return content.length <= GROUNDING_LIMITS.maxResponseChars
    ? content
    : `${content.slice(0, GROUNDING_LIMITS.maxResponseChars).trimEnd()}…`;
}
