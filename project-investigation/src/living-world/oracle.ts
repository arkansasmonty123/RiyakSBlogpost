/**
 * M6 pure "oracle" helpers — visible-state checks only.
 *
 * This module never touches the database and never imports canonical truth.
 * Every function accepts plain data so it can be unit-tested in isolation and
 * reused by both the engine and the authoring validators.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True only when `evidenceId` is part of the explicit visible set. */
export function isEvidenceVisible(evidenceId: string, visibleSet: ReadonlySet<string>): boolean {
  return typeof evidenceId === 'string' && evidenceId.length > 0 && visibleSet.has(evidenceId);
}

/**
 * Normalize a human-authored evidence `source` reference. UUIDs are rejected:
 * authoring must use stable source strings, never volatile database IDs.
 */
export function normalizeSourceRef(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const ref = value.trim().toLowerCase();
  if (!ref || ref.length > 160) return null;
  if (UUID_RE.test(ref)) return null;
  return ref;
}

export type ParsedAnchor =
  | { kind: 'start'; ref: 'start' }
  | { kind: 'evidence'; ref: string }
  | { kind: 'checkpoint'; ref: string }
  | { kind: 'action'; ref: string }
  | { kind: 'flag'; ref: string };

/** Parse a closed-union event anchor. Unknown shapes are rejected. */
export function parseAnchor(anchor: unknown): ParsedAnchor | null {
  if (typeof anchor !== 'string') return null;
  const value = anchor.trim();
  if (value === 'investigation_start') return { kind: 'start', ref: 'start' };
  const split = value.indexOf(':');
  if (split <= 0) return null;
  const prefix = value.slice(0, split);
  const rest = value.slice(split + 1).trim();
  if (!rest) return null;
  if (prefix === 'evidence') {
    const ref = normalizeSourceRef(rest);
    return ref ? { kind: 'evidence', ref } : null;
  }
  if (prefix === 'checkpoint') return { kind: 'checkpoint', ref: rest.slice(0, 120) };
  if (prefix === 'action') return { kind: 'action', ref: rest.slice(0, 120) };
  if (prefix === 'flag') return { kind: 'flag', ref: rest.slice(0, 120) };
  return null;
}

/** All state needed to resolve an anchor, derived only from visible state. */
export interface AnchorContext {
  startMs: number;
  /** Normalized sources of evidence currently visible to the player. */
  visibleSources: ReadonlySet<string>;
  /** Normalized source -> discovery time (ms); initial evidence uses startMs. */
  discoveredSourceAt: ReadonlyMap<string, number>;
  checkpointAt: ReadonlyMap<string, number>;
  actionAt: ReadonlyMap<string, number>;
  flagAt: ReadonlyMap<string, number> | null;
}

export interface AnchorResolution {
  eligible: boolean;
  anchorRef: string;
  anchorMs: number | null;
  reason?: string;
}

/**
 * Resolve an anchor to a server timestamp using visible state only.
 * An `evidence:` anchor is eligible only when the evidence is BOTH currently
 * visible to the player and actually discovered — never from secret state.
 */
export function anchorIsEligible(anchor: unknown, ctx: AnchorContext): AnchorResolution {
  const parsed = parseAnchor(anchor);
  if (!parsed) return { eligible: false, anchorRef: 'invalid', anchorMs: null, reason: 'invalid-anchor' };

  switch (parsed.kind) {
    case 'start':
      return Number.isFinite(ctx.startMs)
        ? { eligible: true, anchorRef: 'start', anchorMs: ctx.startMs }
        : { eligible: false, anchorRef: 'start', anchorMs: null, reason: 'no-start-time' };
    case 'evidence': {
      const anchorRef = `evidence:${parsed.ref}`;
      if (!ctx.visibleSources.has(parsed.ref)) {
        return { eligible: false, anchorRef, anchorMs: null, reason: 'evidence-not-visible' };
      }
      const at = ctx.discoveredSourceAt.get(parsed.ref);
      if (at === undefined || !Number.isFinite(at)) {
        return { eligible: false, anchorRef, anchorMs: null, reason: 'evidence-not-discovered' };
      }
      return { eligible: true, anchorRef, anchorMs: at };
    }
    case 'checkpoint': {
      const anchorRef = `checkpoint:${parsed.ref}`;
      const at = ctx.checkpointAt.get(parsed.ref);
      return at === undefined || !Number.isFinite(at)
        ? { eligible: false, anchorRef, anchorMs: null, reason: 'checkpoint-not-reached' }
        : { eligible: true, anchorRef, anchorMs: at };
    }
    case 'action': {
      const anchorRef = `action:${parsed.ref}`;
      const at = ctx.actionAt.get(parsed.ref);
      return at === undefined || !Number.isFinite(at)
        ? { eligible: false, anchorRef, anchorMs: null, reason: 'action-not-performed' }
        : { eligible: true, anchorRef, anchorMs: at };
    }
    case 'flag': {
      const anchorRef = `flag:${parsed.ref}`;
      const at = ctx.flagAt?.get(parsed.ref);
      return at === undefined || !Number.isFinite(at)
        ? { eligible: false, anchorRef, anchorMs: null, reason: 'flag-not-set' }
        : { eligible: true, anchorRef, anchorMs: at };
    }
  }
}
