import type { AuditEvent, AuditEventType, GameClock, SaveGame } from './types';

/**
 * Lightweight, append-only audit/event log stored with the save. It records that a
 * player action happened (and when, in-game), never what canonical truth is. The cap
 * keeps localStorage small; migrations rebuild events from known fields only so an
 * old or tampered save cannot smuggle unknown/canonical fields into player state.
 */
export const MAX_AUDIT_EVENTS = 100;
export const MAX_AUDIT_SUMMARY_CHARS = 160;

export const AUDIT_EVENT_KINDS: readonly AuditEventType[] = [
  'save',
  'draft-submitted',
  'assignment-reviewed',
  'senior-review-submitted',
  'evidence-discovered',
  'evidence-reviewed',
  'evidence-challenged',
  'custody-recorded',
  'source-intake',
  'senior-review-ai',
  'final-brief',
  'day-advanced',
];

const SLOTS: readonly GameClock['slot'][] = ['morning', 'afternoon', 'evening'];

/** Defensive guard: never let canonical-truth field names appear in a log summary. */
const CANONICAL_TRUTH_MARKER =
  /canonicaltruth|actualevents|actualtimeline|responsibleparties|hiddenmotives|evidenceauthenticity|unresolvedambiguities/i;

function makeAuditId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Append one event (newest first). Existing entries are never rewritten; only the oldest is dropped over the cap. */
export function recordAudit(save: SaveGame, type: AuditEventType, summary: string): AuditEvent {
  const text = (summary ?? '').trim().slice(0, MAX_AUDIT_SUMMARY_CHARS);
  const event: AuditEvent = {
    id: makeAuditId(),
    day: save.clock.day,
    slot: save.clock.slot,
    type,
    summary: text || type,
  };
  save.auditLog.unshift(event);
  if (save.auditLog.length > MAX_AUDIT_EVENTS) {
    save.auditLog.length = MAX_AUDIT_EVENTS;
  }
  return event;
}

function isEventType(value: unknown): value is AuditEventType {
  return typeof value === 'string' && AUDIT_EVENT_KINDS.includes(value as AuditEventType);
}

function isSlot(value: unknown): value is GameClock['slot'] {
  return typeof value === 'string' && SLOTS.includes(value as GameClock['slot']);
}

/**
 * Sanitize untrusted stored data during save load/persist. Keeps only known fields,
 * bounds text and length, drops canonical-truth markers and invalid/malformed events.
 */
export function sanitizeAuditLog(value: unknown): AuditEvent[] {
  if (!Array.isArray(value)) return [];
  const clean: AuditEvent[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Partial<AuditEvent>;
    if (!isEventType(item.type) || !isSlot(item.slot)) continue;
    if (typeof item.day !== 'number' || !Number.isFinite(item.day) || item.day < 1) continue;
    if (typeof item.summary !== 'string') continue;
    const summary = item.summary.trim().slice(0, MAX_AUDIT_SUMMARY_CHARS);
    if (!summary || CANONICAL_TRUTH_MARKER.test(summary)) continue;
    clean.push({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 80) : makeAuditId(),
      day: Math.floor(item.day),
      slot: item.slot,
      type: item.type,
      summary,
    });
    if (clean.length >= MAX_AUDIT_EVENTS) break;
  }
  return clean;
}
