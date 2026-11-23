import { describe, expect, it } from 'vitest';
import { isAiSeniorReviewEnabled } from '@/config/env';
import { citableSourceIds, projectSeniorReview, submitSeniorReviewWithAi } from '@/domain/ai/seniorReview';
import type { LocalAiProvider, ProviderRequest, ProviderResult } from '@/domain/ai/provider';
import { submitSeniorReview } from '@/domain/casework';
import { reviewEvidence, discoverEvidenceItem } from '@/domain/evidence';
import { buildLegalMindProfile } from '@/domain/legalMindProfile';
import { advanceClock, reviewAssignment } from '@/domain/progression';
import { challengeEvidenceAdmissibility, recordCustodyObservation } from '@/domain/casework';
import { createInitialSave } from '@/domain/seed';
import { hydrateSave, sanitizeAiReviews, toPersistedSave } from '@/storage/save';
import type { SaveGame } from '@/domain/types';

const GOOD_SUMMARY =
  'Issue: what happened outside the canteen. I reviewed the medical report, the partial clip and the witness note, attached the verified educational summary, and kept known facts separate from claims and disputed points.';
const REQUEST_ID = 'req_senior_test';

interface MockProvider extends LocalAiProvider {
  calls: ProviderRequest[];
}

function mockProvider(result: ProviderResult): MockProvider {
  const calls: ProviderRequest[] = [];
  return {
    id: 'test-provider',
    label: 'Test provider',
    calls,
    async generate(request: ProviderRequest): Promise<ProviderResult> {
      calls.push(request);
      return result;
    },
  };
}

function okText(payload: Record<string, unknown>): ProviderResult {
  return { ok: true, text: JSON.stringify(payload) };
}

/** makeId() is time/random based; compare behaviour with generated ids removed. */
function withoutIds<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (key, item) => (key === 'id' || key === 'savedAt' ? undefined : item)));
}

function validFeedback(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaId: 'review-feedback.v1',
    roleId: 'senior-mentor',
    requestId: REQUEST_ID,
    status: 'ok',
    summary: 'The note identifies disputed points but needs clearer source links.',
    strengths: [{ point: 'Required evidence was reviewed.', basis: 'evidence', refs: ['ev-1'] }],
    gaps: [{ point: 'Source notes are missing.', fix: 'Attach the verified source note.', refs: ['ls-4'] }],
    citedSources: ['ls-4'],
    requiresRevision: false, // deliberately contrary to the deterministic first-round loop
    refusalReason: null,
    ...overrides,
  };
}

/** Play the deterministic path up to an unlocked Assignment 7 on Day 9. */
function readySave(): SaveGame {
  const save = createInitialSave();
  for (const id of ['ev-1', 'ev-2', 'ev-3']) {
    if (!discoverEvidenceItem(save, id)) throw new Error(`missing evidence ${id}`);
    reviewEvidence(save, id);
  }
  save.notebook.unshift({
    id: 'n-src',
    day: 1,
    kind: 'research',
    title: 'Verified educational summary',
    content: 'A labelled internal summary on evidence handling.',
    sourceId: 'ls-4',
    verified: true,
  });
  save.notebook.unshift({
    id: 'n-contra',
    day: 1,
    kind: 'contradiction',
    title: 'Account difference',
    content: 'The accounts differ on emphasis.',
    evidenceId: 'ev-3',
    relation: 'contradiction',
    verified: false,
  });
  save.notebook.unshift({
    id: 'n-fact',
    day: 1,
    kind: 'fact',
    title: 'Client observation',
    content: 'The client described what they personally saw.',
    verified: false,
  });
  save.flags.clientInterviewDone = true;
  if (!recordCustodyObservation(save, 'ev-2', 'No sealing record on the export.').ok) throw new Error('custody');
  if (
    !challengeEvidenceAdmissibility(
      save,
      'ev-3',
      'reliability',
      'The consistency of the account was not tested against the recording.',
    ).ok
  ) {
    throw new Error('challenge');
  }
  while (save.clock.day < 9) advanceClock(save);
  for (const id of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']) {
    const result = reviewAssignment(save, id);
    if (!result.ok) throw new Error(`assignment ${id}: ${result.reason}`);
  }
  expect(save.assignments.find((a) => a.id === 'a7')?.status).toBe('active');
  return save;
}

describe('AI-assisted senior review — projection and retrieval', () => {
  it('projects only player-visible state and retrieves approved internal summaries', () => {
    const save = readySave();
    const projection = projectSeniorReview(save, 'a7', GOOD_SUMMARY);
    expect(projection.request).not.toBeNull();
    expect(projection.retrievedSources.map((source) => source.id)).toContain('ls-4');
    expect(projection.verifiedSourceIds).toContain('ls-4');
    expect(citableSourceIds(save)).toContain('ls-4');

    const request = projection.request!;
    expect(request.roleId).toBe('senior-mentor');
    expect(request.responseSchemaId).toBe('review-feedback.v1');
    expect(request.prompt).toBe(GOOD_SUMMARY);
    expect(request.context.visibleSourceIds).toContain('ls-4');
    expect(request.context.visibleEvidenceIds).toEqual(expect.arrayContaining(['ev-1', 'ev-2', 'ev-3']));
    expect(request.context.submittedWork!.length).toBeLessThanOrEqual(600);
    const serialized = JSON.stringify(request).toLowerCase();
    for (const marker of ['canonicaltruth', 'hiddenmotives', 'actualtimeline', 'evidenceauthenticity']) {
      expect(serialized).not.toContain(marker);
    }
  });

  it('bounds an oversized research note and refuses a missing assignment', () => {
    const save = readySave();
    const longNote = 'Issue: disputed points and reviewed sources. '.repeat(80);
    const projection = projectSeniorReview(save, 'a7', longNote);
    expect(projection.request!.prompt).toHaveLength(2000);
    expect(projection.request!.context.submittedWork!.length).toBeLessThanOrEqual(600);
    expect(projectSeniorReview(save, 'missing', GOOD_SUMMARY).request).toBeNull();
  });
});

describe('AI-assisted senior review — gates and deterministic fallback', () => {
  it('is disabled by default: no provider call, no record, identical gameplay', async () => {
    const provider = mockProvider(okText(validFeedback()));
    const save = readySave();
    const outcome = await submitSeniorReviewWithAi(save, 'a7', GOOD_SUMMARY, { provider });

    expect(outcome.gateway?.status).toBe('degraded');
    expect(provider.calls).toHaveLength(0);
    expect(outcome.record).toBeNull();
    expect(outcome.aiAssisted).toBe(false);
    expect(outcome.deterministic.status).toBe('needs_revision');
    expect(outcome.dialogue).not.toContain('AI-assisted');

    const plain = readySave();
    submitSeniorReview(plain, 'a7', GOOD_SUMMARY);
    expect(withoutIds(save.reviewRounds)).toEqual(withoutIds(plain.reviewRounds));
    expect(save.assignments).toEqual(plain.assignments);
    expect(save.player).toEqual(plain.player);
    expect(save.flags).toEqual(plain.flags);
    expect(withoutIds(save.memories)).toEqual(withoutIds(plain.memories));
    expect(save.aiReviews).toEqual([]);
  });

  it('keeps the deterministic gate authoritative even when the AI says "no revision needed"', async () => {
    const provider = mockProvider(okText(validFeedback()));
    const save = readySave();
    const outcome = await submitSeniorReviewWithAi(save, 'a7', GOOD_SUMMARY, {
      provider,
      enabled: true,
      requestId: REQUEST_ID,
    });

    expect(outcome.gateway?.status).toBe('accepted');
    expect(outcome.aiAssisted).toBe(true);
    expect(outcome.deterministic.status).toBe('needs_revision');
    expect(save.assignments.find((a) => a.id === 'a7')?.status).toBe('submitted');
    expect(save.flags.reviewAccepted).toBe(false);
    expect(save.aiReviews).toHaveLength(1);
    expect(save.aiReviews[0]).toMatchObject({
      aiAssisted: true,
      gatewayStatus: 'accepted',
      deterministicStatus: 'needs_revision',
      citedSources: ['ls-4'],
    });
    expect(outcome.dialogue).toContain('AI-assisted, unverified, non-authoritative');
    expect(outcome.dialogue).toContain('disputed points');
    expect(save.auditLog.some((event) => event.type === 'senior-review-ai')).toBe(true);

    // A revision is still required; a second, revised submission can be accepted normally.
    const revised = await submitSeniorReviewWithAi(save, 'a7', `${GOOD_SUMMARY} Revised to address the notes.`, {
      provider,
      enabled: true,
      requestId: REQUEST_ID,
    });
    expect(revised.deterministic.status).toBe('accepted');
    expect(save.flags.reviewAccepted).toBe(true);
    expect(save.aiReviews).toHaveLength(2);
  });

  it('rejects fabricated citations, canonical truth, unsafe claims and unverified sources', async () => {
    const cases: Array<{ payload: Record<string, unknown>; code: string; rawText: string }> = [
      {
        payload: validFeedback({ summary: 'A portion of the phone recording was removed before it was shared.' }),
        code: 'unsafe-output',
        rawText: 'A portion of the phone recording was removed before it was shared.',
      },
      {
        payload: validFeedback({ summary: 'The court held that the record is inadmissible.' }),
        code: 'unsafe-output',
        rawText: 'The court held that the record is inadmissible.',
      },
      {
        payload: validFeedback({ summary: 'You should cite section 302 of the Code in your brief.' }),
        code: 'unbound-claim',
        rawText: 'section 302 of the Code',
      },
      {
        payload: validFeedback({ citedSources: ['ls-fabricated'] }),
        code: 'unverified-source',
        rawText: 'ls-fabricated',
      },
    ];

    for (const testCase of cases) {
      const save = readySave();
      const outcome = await submitSeniorReviewWithAi(save, 'a7', GOOD_SUMMARY, {
        provider: mockProvider(okText(testCase.payload)),
        enabled: true,
        requestId: REQUEST_ID,
      });
      expect(outcome.gateway?.status).toBe('rejected');
      if (outcome.gateway?.status === 'rejected') expect(outcome.gateway.code).toBe(testCase.code);
      expect(outcome.aiAssisted).toBe(false);
      expect(outcome.deterministic.status).toBe('needs_revision');
      expect(outcome.dialogue).not.toContain(testCase.rawText);
      expect(save.aiReviews).toHaveLength(1);
      expect(save.aiReviews[0]).toMatchObject({ aiAssisted: false, gatewayStatus: 'rejected' });
      expect(save.aiReviews[0].summary).toBe('');
      expect(JSON.stringify(save)).not.toContain(testCase.rawText);
    }
  });

  it('degrades on provider failure and does not persist an AI record', async () => {
    const save = readySave();
    const outcome = await submitSeniorReviewWithAi(save, 'a7', GOOD_SUMMARY, {
      provider: mockProvider({ ok: false, code: 'unavailable', error: 'llama-server offline' }),
      enabled: true,
      requestId: REQUEST_ID,
    });
    expect(outcome.gateway?.status).toBe('degraded');
    expect(outcome.record).toBeNull();
    expect(outcome.aiAssisted).toBe(false);
    expect(outcome.deterministic.status).toBe('needs_revision');
    expect(save.aiReviews).toEqual([]);
    expect(save.auditLog.some((event) => event.type === 'senior-review-ai')).toBe(false);
  });

  it('does not call a model or double-apply once an assignment is already accepted', async () => {
    const provider = mockProvider(okText(validFeedback()));
    const save = readySave();
    submitSeniorReview(save, 'a7', GOOD_SUMMARY);
    submitSeniorReview(save, 'a7', `${GOOD_SUMMARY} Revised.`);
    const roundsBefore = save.reviewRounds.length;

    const outcome = await submitSeniorReviewWithAi(save, 'a7', GOOD_SUMMARY, {
      provider,
      enabled: true,
      requestId: REQUEST_ID,
    });
    expect(outcome.deterministic.ok).toBe(false);
    expect(outcome.gateway).toBeNull();
    expect(provider.calls).toHaveLength(0);
    expect(save.reviewRounds).toHaveLength(roundsBefore);
    expect(save.aiReviews).toEqual([]);
  });
});

describe('AI-assisted senior review — persistence and profile', () => {
  it('stores a bounded, player-safe evaluation that survives save round-trips', async () => {
    const save = readySave();
    await submitSeniorReviewWithAi(save, 'a7', GOOD_SUMMARY, {
      provider: mockProvider(okText(validFeedback())),
      enabled: true,
      requestId: REQUEST_ID,
    });
    const persisted = JSON.parse(JSON.stringify(toPersistedSave(save))) as Record<string, unknown>;
    expect(Array.isArray(persisted.aiReviews)).toBe(true);
    expect(JSON.stringify(persisted)).not.toContain('canonicalTruth');

    const loaded = hydrateSave(persisted);
    expect(loaded.aiReviews).toEqual(save.aiReviews);

    const legacy = { ...persisted } as Record<string, unknown>;
    delete legacy.aiReviews;
    expect(hydrateSave(legacy).aiReviews).toEqual([]);
  });

  it('sanitizes untrusted stored review records instead of trusting them', () => {
    const clean = sanitizeAiReviews([
      {
        id: 'ai-1',
        day: 9,
        assignmentId: 'a7',
        round: 1,
        requestId: 'req',
        deterministicStatus: 'accepted',
        aiAssisted: true,
        gatewayStatus: 'accepted',
        summary: 'Player-visible feedback summary.',
        citedSources: ['ls-4'],
        warnings: [],
      },
      {
        id: 'ai-bad',
        day: 9,
        assignmentId: 'a7',
        round: 1,
        requestId: 'req',
        deterministicStatus: 'accepted',
        aiAssisted: true,
        gatewayStatus: 'accepted',
        summary: 'A portion of the phone recording was removed before it was shared.',
        citedSources: [],
        warnings: [],
      },
    ]);
    expect(clean).toHaveLength(1);
    expect(clean[0].summary).toBe('Player-visible feedback summary.');
  });

  it('updates the Legal Mind Profile only from the recorded review action', async () => {
    const save = readySave();
    const withoutAi = buildLegalMindProfile(save).dimensions.find((d) => d.id === 'legal-interpretation')!;
    expect(withoutAi.evidence.join(' ')).not.toContain('structured senior feedback');

    await submitSeniorReviewWithAi(save, 'a7', GOOD_SUMMARY, {
      provider: mockProvider(okText(validFeedback())),
      enabled: true,
      requestId: REQUEST_ID,
    });
    submitSeniorReview(save, 'a7', `${GOOD_SUMMARY} Revised to address the notes.`);
    const withAi = buildLegalMindProfile(save).dimensions.find((d) => d.id === 'legal-interpretation')!;
    expect(withAi.evidence.join(' ')).toContain('structured senior feedback');
    expect(withAi.level).toBe('consistent');
  });
});

describe('AI-assisted senior review — feature flag', () => {
  it('is off by default and only enabled by an explicit opt-in', () => {
    expect(isAiSeniorReviewEnabled({})).toBe(false);
    expect(isAiSeniorReviewEnabled({ VITE_ENABLE_LOCAL_AI: 'true' })).toBe(false);
    expect(isAiSeniorReviewEnabled({ VITE_ENABLE_AI_SENIOR_REVIEW: 'false' })).toBe(false);
    expect(isAiSeniorReviewEnabled({ VITE_ENABLE_AI_SENIOR_REVIEW: 'true' })).toBe(true);
    expect(isAiSeniorReviewEnabled({ VITE_ENABLE_AI_SENIOR_REVIEW: 'TRUE' })).toBe(true);
  });
});
