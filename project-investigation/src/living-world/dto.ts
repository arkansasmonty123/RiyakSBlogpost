import type {
  ActivityGroup, ActivitySnapshot, CatchUpSummary, EventCategory, EventSignificance,
  InvestigationEventRow, OutstandingDisagreement, SafeActivityChange, SafeActivityEvent, UpcomingTeaser,
} from './types';
import { assertNoInternalLeaks, clipText, scanForForbiddenTerms } from './safety';

const ALLOWED_RESPONSE_KINDS = new Set(['open_evidence', 'reply_to_specialist', 'verify_lead', 'rebuild_hypothesis', 'open_activity']);

export function toSafeActivityEvent(row: InvestigationEventRow, opts?: { leakageTerms?: string[] }): SafeActivityEvent {
  const presentation = (row.presentation && typeof row.presentation === 'object') ? row.presentation : {};
  const outcome = (row.outcome && typeof row.outcome === 'object') ? row.outcome : {};
  const provenance = (row.provenance && typeof row.provenance === 'object') ? row.provenance : {};
  const actorDisplay = String(presentation.actorDisplayName ?? row.actorKey ?? row.actorKind ?? 'Team').trim() || 'Team';
  const responseOptions = Array.isArray(presentation.responseOptions)
    ? presentation.responseOptions
        .filter((o: any) => o && ALLOWED_RESPONSE_KINDS.has(String(o.kind)))
        .slice(0, 3)
        .map((o: any) => ({ kind: o.kind, label: clipText(o.label, 80) }))
    : [];
  const changesRaw = Array.isArray(outcome.changes) ? outcome.changes : [];
  const changes: SafeActivityChange[] = changesRaw
    .filter((c: any) => c && typeof c === 'object')
    .slice(0, 6)
    .map((c: any) => {
      const change: SafeActivityChange = {
        kind: String(c.kind ?? 'development') as SafeActivityChange['kind'],
        label: clipText(c.label ?? 'Development recorded', 140),
      };
      if (typeof c.evidenceId === 'string' && c.evidenceId) change.evidenceId = c.evidenceId;
      if (typeof c.action === 'string' && c.action) change.action = clipText(c.action, 80);
      if (typeof c.specialistKey === 'string' && c.specialistKey) change.specialistKey = clipText(c.specialistKey, 80);
      return change;
    });

  const safe: SafeActivityEvent = {
    id: String(row.id),
    eventKey: String(row.eventKey),
    category: String(row.eventType) as EventCategory,
    status: row.status,
    significance: row.significance,
    groupKey: row.groupKey ? clipText(row.groupKey, 60) : null,
    title: clipText(presentation.title ?? row.eventKey, 120),
    summary: clipText(presentation.summary ?? '', 280),
    detail: clipText(presentation.detail ?? presentation.summary ?? '', 700),
    whyItMatters: clipText(presentation.whyItMatters ?? '', 280),
    requiresResponse: Boolean(presentation.requiresResponse),
    responseOptions,
    actor: {
      kind: row.actorKind,
      displayName: clipText(actorDisplay, 80),
      specialistKey: row.actorKind === 'specialist' ? (row.actorKey ?? null) : null,
    },
    occurredAt: row.resolvedAt ? new Date(row.resolvedAt).toISOString() : null,
    eligibleAt: row.eligibleAt ? new Date(row.eligibleAt).toISOString() : null,
    changes,
    relatedArtifactKeys: Array.isArray(provenance.artifactKeys)
      ? provenance.artifactKeys.filter((k: any) => typeof k === 'string').slice(0, 8).map((k: string) => clipText(k, 80))
      : [],
    provenanceLabel: 'case-package',
  };

  assertNoInternalLeaks(safe, `activity event ${safe.id}`);
  const leak = scanForForbiddenTerms(safe, opts?.leakageTerms ?? []);
  if (leak) {
    throw new Error(`[M6 SAFETY] activity event ${safe.id} leaked forbidden term`);
  }
  return safe;
}

export function toUpcomingTeaser(row: InvestigationEventRow, opts?: { leakageTerms?: string[] }): UpcomingTeaser | null {
  const presentation = (row.presentation && typeof row.presentation === 'object') ? row.presentation : {};
  const teaser = presentation.upcomingTeaser;
  if (!teaser || typeof teaser !== 'object' || !teaser.title) return null;
  const safe: UpcomingTeaser = {
    title: clipText(teaser.title, 120),
    certainty: 'tentative',
    category: String(row.eventType) as EventCategory,
    significance: row.significance,
  };
  assertNoInternalLeaks(safe, `upcoming teaser ${row.id}`);
  const leak = scanForForbiddenTerms(safe, opts?.leakageTerms ?? []);
  if (leak) return null;
  return safe;
}

export function buildActivitySnapshot(params: {
  events: SafeActivityEvent[];
  upcoming: UpcomingTeaser[];
  disagreements: OutstandingDisagreement[];
  unreadCount: number;
  sinceLastVisit: CatchUpSummary;
  hasMore: boolean;
  nextEligibleAt: string | null;
}): ActivitySnapshot {
  const byGroup = new Map<string, SafeActivityEvent[]>();
  for (const ev of params.events) {
    const key = ev.groupKey || ev.category;
    const arr = byGroup.get(key) ?? [];
    arr.push(ev);
    byGroup.set(key, arr);
  }
  const groups: ActivityGroup[] = Array.from(byGroup.entries()).map(([groupKey, items]) => ({
    groupKey,
    title: groupKey.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    significance: items.some(i => i.significance === 'high') ? 'high' : items.some(i => i.significance === 'normal') ? 'normal' : 'low',
    items,
  }));
  const byCategory: Record<string, number> = {};
  for (const ev of params.events) byCategory[ev.category] = (byCategory[ev.category] ?? 0) + 1;
  return {
    sinceLastVisit: params.sinceLastVisit,
    groups,
    counts: {
      total: params.events.length,
      unread: params.unreadCount,
      high: params.events.filter(e => e.significance === 'high').length,
      byCategory,
    },
    outstandingDisagreements: params.disagreements,
    pendingResponse: params.events.filter(e => e.requiresResponse),
    upcoming: params.upcoming,
    hasMore: params.hasMore,
    nextEligibleAt: params.nextEligibleAt,
  };
}
