/**
 * Model-independent role contracts for the AI gateway (Track C skeleton).
 *
 * A role is a contract — purpose, knowledge boundary, allowed input projection and required
 * output schema — NOT a model or a server. Adding a role here must never add a model
 * dependency. These contracts are deliberately small, hand-validated (no schema-library
 * dependency), player-visible-only, and non-authoritative by construction.
 *
 * Canonical case truth is never an accepted context field or output field: context keys are
 * whitelisted per role and every string is scanned for canonical-truth markers. No output may
 * assert legal authority: free prose is scanned for unsafe claims and citation-looking text,
 * and every `sourceId`/`citedSources` value must resolve to a caller-supplied *verified*
 * registry id. Runtime AI is opt-in at the gateway; nothing here calls a model on its own.
 */
import {
  AI_NON_AUTHORITATIVE_NOTICE,
  containsCanonicalTruth,
  containsKnowledgeBoundaryBypass,
  containsUnsafeClaim,
  guardPrompt,
  MAX_AI_RESPONSE_CHARS,
} from '@/domain/ai/guards';
import { looksLikeSpecificCitation } from '@/domain/legalSources';

/* ------------------------------------------------------------------ ids & caps */

export const ROLE_IDS = ['senior-mentor', 'legal-researcher'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const TASK_TYPES = ['review-research', 'explain-source'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const SCHEMA_IDS = ['review-feedback.v1', 'research-answer.v1'] as const;
export type SchemaId = (typeof SCHEMA_IDS)[number];

export const MAX_CONTEXT_FIELDS = 16;
export const MAX_CONTEXT_VALUE_CHARS = 600;
export const MAX_CONTEXT_IDS = 20;
export const MAX_CONTEXT_ID_CHARS = 120;
export const MAX_REF_IDS = 20;
export const MAX_OUTPUT_ITEMS = 12;
export const MAX_TEXT_FIELD_CHARS = 400;
export const MAX_SUMMARY_CHARS = 400;
/** Total serialized proposal size is bounded by the same cap as the response text. */
export const MAX_SERIALIZED_OUTPUT_CHARS = MAX_AI_RESPONSE_CHARS;
const MAX_REQUEST_ID_CHARS = 80;

/* -------------------------------------------------------------- context envelopes */

/** Allowed context values: bounded prose or a list of player-visible ids. */
export type ContextValue = string | readonly string[];

/** Only these fields may be projected into a role, and only from player-visible state. */
export const SENIOR_MENTOR_CONTEXT_FIELDS = [
  'assignmentId',
  'assignmentTitle',
  'assignmentRequirements',
  'submittedWork',
  'visibleEvidenceIds',
  'visibleSourceIds',
  'visibleNotebookKinds',
] as const;

export const LEGAL_RESEARCHER_CONTEXT_FIELDS = [
  'topic',
  'approvedSourceIds',
  'sourceTitles',
  'sourceProvenance',
  'visibleEvidenceIds',
] as const;

export interface ReviewResearchContext {
  readonly assignmentId?: string;
  readonly assignmentTitle?: string;
  readonly assignmentRequirements?: string;
  readonly submittedWork?: string;
  readonly visibleEvidenceIds?: readonly string[];
  readonly visibleSourceIds?: readonly string[];
  readonly visibleNotebookKinds?: readonly string[];
}

export interface SourceExplanationContext {
  readonly topic?: string;
  readonly approvedSourceIds?: readonly string[];
  readonly sourceTitles?: readonly string[];
  readonly sourceProvenance?: readonly string[];
  readonly visibleEvidenceIds?: readonly string[];
}

export type RoleContext = ReviewResearchContext | SourceExplanationContext;

/* ------------------------------------------------------------------ role registry */

export interface RoleDefinition {
  readonly roleId: RoleId;
  /** Explicit, opt-in event. The gateway is passive: it never invokes a model on a click. */
  readonly taskType: TaskType;
  readonly purpose: string;
  /** Plain-language description of what this role is allowed to know. */
  readonly knowledgeBoundary: string;
  /** Whitelist of context field names; any other field is rejected at runtime. */
  readonly allowedContextFields: readonly string[];
  readonly responseSchemaId: SchemaId;
  /** Deterministic domain function that is the only writer for this role. */
  readonly deterministicConsumer: string;
}

export const ROLE_REGISTRY: Readonly<Record<RoleId, RoleDefinition>> = {
  'senior-mentor': {
    roleId: 'senior-mentor',
    taskType: 'review-research',
    purpose: 'Critique a research note / draft, name gaps and ask for revision. Proposal only.',
    knowledgeBoundary:
      'Assignment requirements, the player’s own submitted text, and ids of evidence/sources the player has actually seen. No canonical truth, no authenticity findings, no hidden responsibility.',
    allowedContextFields: SENIOR_MENTOR_CONTEXT_FIELDS,
    responseSchemaId: 'review-feedback.v1',
    deterministicConsumer: 'submitSeniorReview',
  },
  'legal-researcher': {
    roleId: 'legal-researcher',
    taskType: 'explain-source',
    purpose: 'Explain approved, provenance-tracked internal summaries; every claim bound to a verified source id.',
    knowledgeBoundary:
      'The player’s query plus ids/titles/provenance of approved internal summaries only. No canonical truth, no provision text, no unverified or placeholder sources.',
    allowedContextFields: LEGAL_RESEARCHER_CONTEXT_FIELDS,
    responseSchemaId: 'research-answer.v1',
    deterministicConsumer: 'retrieveApprovedInternalSummaries',
  },
};

/* -------------------------------------------------------------------- requests */

export interface RoleRequestBase {
  /** Caller-supplied correlation id; a deterministic fingerprint is used when omitted. */
  readonly requestId?: string;
  /** Player-authored prompt only (the submitted work or the research query). */
  readonly prompt: string;
  readonly responseSchemaId: SchemaId;
}

export interface SeniorMentorRequest extends RoleRequestBase {
  readonly roleId: 'senior-mentor';
  readonly taskType: 'review-research';
  readonly responseSchemaId: 'review-feedback.v1';
  readonly context: ReviewResearchContext;
}

export interface LegalResearcherRequest extends RoleRequestBase {
  readonly roleId: 'legal-researcher';
  readonly taskType: 'explain-source';
  readonly responseSchemaId: 'research-answer.v1';
  readonly context: SourceExplanationContext;
}

/** Discriminated union on both `roleId` and `responseSchemaId`. */
export type RoleRequest = SeniorMentorRequest | LegalResearcherRequest;

/* -------------------------------------------------------------------- outputs */

export type FeedbackBasis = 'evidence' | 'source' | 'reasoning';

export interface FeedbackPoint {
  readonly point: string;
  readonly basis: FeedbackBasis;
  /** Player-visible evidence/source ids this point rests on. */
  readonly refs: readonly string[];
}

export interface FeedbackGap {
  readonly point: string;
  readonly fix: string;
  readonly refs: readonly string[];
}

export interface ReviewFeedback {
  readonly schemaId: 'review-feedback.v1';
  readonly roleId: 'senior-mentor';
  readonly requestId: string;
  readonly status: 'ok' | 'refused';
  readonly summary: string;
  readonly strengths: readonly FeedbackPoint[];
  readonly gaps: readonly FeedbackGap[];
  /** Must resolve to verified registry ids supplied by the caller. */
  readonly citedSources: readonly string[];
  readonly requiresRevision: boolean;
  readonly refusalReason: string | null;
}

export interface ResearchClaim {
  readonly claim: string;
  /** Verified registry id; a claim without one is rejected (no fabricated authority). */
  readonly sourceId: string;
  /** Non-authoritative qualifier describing what the summary does and does not say. */
  readonly note: string;
}

export interface ResearchAnswer {
  readonly schemaId: 'research-answer.v1';
  readonly roleId: 'legal-researcher';
  readonly requestId: string;
  readonly status: 'ok' | 'refused';
  readonly summary: string;
  readonly claims: readonly ResearchClaim[];
  readonly citedSources: readonly string[];
  readonly refusalReason: string | null;
}

export type RoleOutput = ReviewFeedback | ResearchAnswer;

/* --------------------------------------------------------- validation result types */

export type RequestValidationCode =
  | 'invalid-shape'
  | 'unknown-field'
  | 'unknown-role'
  | 'schema-mismatch'
  | 'invalid-prompt'
  | 'unsafe-context'
  | 'size-limit';

export type OutputValidationCode =
  | 'invalid-shape'
  | 'unknown-field'
  | 'size-limit'
  | 'unsafe-output'
  | 'unbound-claim'
  | 'unbound-reference'
  | 'unverified-source'
  | 'schema-mismatch';

export type RequestValidation =
  | { readonly ok: true; readonly value: RoleRequest; readonly warnings: string[] }
  | { readonly ok: false; readonly code: RequestValidationCode; readonly reason: string };

export type OutputValidation<T extends RoleOutput = RoleOutput> =
  | { readonly ok: true; readonly value: T; readonly warnings: string[] }
  | { readonly ok: false; readonly code: OutputValidationCode; readonly reason: string };

export interface OutputValidationOptions {
  /** The proposal must echo the gateway's request id; prevents cross-request replay. */
  readonly expectedRequestId: string;
  /** Player-visible ids from the request context that a `refs` entry may use. */
  readonly allowedRefIds: ReadonlySet<string>;
  /** Verified registry ids; nothing else may appear in `citedSources`/`sourceId`. */
  readonly verifiedSourceIds: ReadonlySet<string>;
}

/* -------------------------------------------------------------- internal helpers */

class ContractViolation extends Error {
  constructor(
    readonly code: RequestValidationCode | OutputValidationCode,
    message: string,
  ) {
    super(message);
    this.name = 'ContractViolation';
  }
}

function fail(code: RequestValidationCode | OutputValidationCode, message: string): never {
  throw new ContractViolation(code, message);
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('invalid-shape', `${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertOnlyKeys(obj: Record<string, unknown>, allowed: readonly string[], field: string): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) fail('unknown-field', `${field} has unknown field '${key}'.`);
  }
}

function readBoundedStringValue(value: unknown, field: string, max: number, allowEmpty = false): string {
  if (typeof value !== 'string') fail('invalid-shape', `${field} must be a string.`);
  const text = value.trim();
  if (!text && !allowEmpty) fail('invalid-shape', `${field} must not be empty.`);
  if (text.length > max) fail('size-limit', `${field} exceeds ${max} characters.`);
  return text;
}

function readBoundedString(obj: Record<string, unknown>, key: string, max: number, allowEmpty = false): string {
  return readBoundedStringValue(obj[key], key, max, allowEmpty);
}

function readNullableString(obj: Record<string, unknown>, key: string, max: number): string | null {
  if (obj[key] === null) return null;
  return readBoundedString(obj, key, max);
}

function readLiteral<T extends string>(obj: Record<string, unknown>, key: string, expected: T): T {
  if (obj[key] !== expected) fail('schema-mismatch', `${key} must be '${expected}'.`);
  return expected;
}

function readEnum<T extends string>(obj: Record<string, unknown>, key: string, values: readonly T[]): T {
  const value = obj[key];
  if (typeof value !== 'string' || !values.includes(value as T)) {
    fail('invalid-shape', `${key} must be one of: ${values.join(', ')}.`);
  }
  return value as T;
}

function readArray(obj: Record<string, unknown>, key: string, maxItems: number): unknown[] {
  const value = obj[key];
  if (!Array.isArray(value)) fail('invalid-shape', `${key} must be an array.`);
  if (value.length > maxItems) fail('size-limit', `${key} exceeds ${maxItems} items.`);
  return value as unknown[];
}

function readStringArray(obj: Record<string, unknown>, key: string, maxItems: number, itemMax: number): string[] {
  return readArray(obj, key, maxItems).map((item, index) => readBoundedStringValue(item, `${key}[${index}]`, itemMax));
}

function readBoolean(obj: Record<string, unknown>, key: string): boolean {
  const value = obj[key];
  if (typeof value !== 'boolean') fail('invalid-shape', `${key} must be a boolean.`);
  return value;
}

function assertContextTextSafe(text: string, field: string): void {
  if (containsCanonicalTruth(text)) {
    fail('unsafe-context', `${field} contains canonical-truth markers and was rejected.`);
  }
  if (containsKnowledgeBoundaryBypass(text)) {
    fail('unsafe-context', `${field} attempts to bypass the knowledge boundary.`);
  }
}

function assertRefs(refs: readonly string[], options: OutputValidationOptions, field: string): void {
  for (const ref of refs) {
    if (!options.allowedRefIds.has(ref)) {
      fail('unbound-reference', `${field} references '${ref}', which is not player-visible in this request.`);
    }
  }
}

function assertVerifiedSources(ids: readonly string[], options: OutputValidationOptions, field: string): void {
  for (const id of ids) {
    if (!options.verifiedSourceIds.has(id)) {
      fail('unverified-source', `${field} cites '${id}', which is not a verified source in this request.`);
    }
  }
}

/** Literal/enum keys are never treated as legal prose; everything else is scanned. */
const NON_PROSE_KEYS = new Set([
  'schemaId',
  'roleId',
  'requestId',
  'status',
  'basis',
  'refs',
  'citedSources',
  'requiresRevision',
  'sourceId',
]);

function collectProse(value: unknown, key: string, out: string[]): void {
  if (typeof value === 'string') {
    if (!NON_PROSE_KEYS.has(key)) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectProse(item, key, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) collectProse(child, childKey, out);
  }
}

function assertProseSafety(value: RoleOutput): void {
  const prose: string[] = [];
  collectProse(value, 'output', prose);
  for (const text of prose) {
    if (containsCanonicalTruth(text) || containsUnsafeClaim(text)) {
      fail('unsafe-output', 'Output contains hidden case truth or an authoritative legal claim.');
    }
    if (looksLikeSpecificCitation(text)) {
      fail('unbound-claim', 'Output contains citation-looking prose with no verified source binding.');
    }
  }
}

function assertSerializedSize(value: RoleOutput): void {
  if (JSON.stringify(value).length > MAX_SERIALIZED_OUTPUT_CHARS) {
    fail('size-limit', 'Serialized output exceeds the safe size limit.');
  }
}

function assertStatusConsistency(
  status: 'ok' | 'refused',
  refusalReason: string | null,
  collections: readonly unknown[][],
): void {
  if (status === 'refused') {
    if (!refusalReason) fail('invalid-shape', 'A refused result must give a refusalReason.');
    if (collections.some((items) => items.length > 0)) {
      fail('invalid-shape', 'A refused result must not contain claims, points or citations.');
    }
  } else if (refusalReason !== null) {
    fail('invalid-shape', 'An ok result must not set a refusalReason.');
  }
}

const REQUEST_KEYS = ['requestId', 'prompt', 'responseSchemaId', 'roleId', 'taskType', 'context'] as const;
const REVIEW_FEEDBACK_KEYS = [
  'schemaId',
  'roleId',
  'requestId',
  'status',
  'summary',
  'strengths',
  'gaps',
  'citedSources',
  'requiresRevision',
  'refusalReason',
] as const;
const RESEARCH_ANSWER_KEYS = [
  'schemaId',
  'roleId',
  'requestId',
  'status',
  'summary',
  'claims',
  'citedSources',
  'refusalReason',
] as const;
const POINT_KEYS = ['point', 'basis', 'refs'] as const;
const GAP_KEYS = ['point', 'fix', 'refs'] as const;
const CLAIM_KEYS = ['claim', 'sourceId', 'note'] as const;

/* ------------------------------------------------------------ request validators */

function validateContext(raw: unknown, allowedFields: readonly string[]): Record<string, string | readonly string[]> {
  const ctx = asRecord(raw, 'context');
  const keys = Object.keys(ctx);
  if (keys.length > MAX_CONTEXT_FIELDS) fail('size-limit', `context exceeds ${MAX_CONTEXT_FIELDS} fields.`);
  const result: Record<string, string | readonly string[]> = {};
  for (const key of keys) {
    if (!allowedFields.includes(key)) fail('unknown-field', `context has unknown field '${key}'.`);
    const value = ctx[key];
    if (typeof value === 'string') {
      if (value.length > MAX_CONTEXT_VALUE_CHARS) fail('size-limit', `context.${key} is too long.`);
      assertContextTextSafe(value, `context.${key}`);
      result[key] = value.trim();
    } else if (Array.isArray(value)) {
      if (value.length > MAX_CONTEXT_IDS) fail('size-limit', `context.${key} has too many ids.`);
      const ids: string[] = [];
      for (const item of value) {
        if (typeof item !== 'string') fail('invalid-shape', `context.${key} must contain only strings.`);
        if (item.length > MAX_CONTEXT_ID_CHARS) fail('size-limit', `context.${key} has an overlong id.`);
        assertContextTextSafe(item, `context.${key}`);
        ids.push(item.trim());
      }
      result[key] = ids;
    } else {
      fail('invalid-shape', `context.${key} must be a string or an array of strings.`);
    }
  }
  return result;
}

/** Validate an untrusted caller request before any provider call. */
export function validateRoleRequest(raw: unknown): RequestValidation {
  try {
    const obj = asRecord(raw, 'request');
    assertOnlyKeys(obj, REQUEST_KEYS, 'request');
    const roleIdValue = obj.roleId;
    if (typeof roleIdValue !== 'string' || !(ROLE_IDS as readonly string[]).includes(roleIdValue)) {
      fail('unknown-role', 'Unknown role id.');
    }
    const roleId = roleIdValue as RoleId;
    const definition = ROLE_REGISTRY[roleId];
    const taskType = readLiteral(obj, 'taskType', definition.taskType);
    const schemaId = readLiteral(obj, 'responseSchemaId', definition.responseSchemaId);
    const prompt: unknown = obj.prompt;
    if (typeof prompt !== 'string') fail('invalid-prompt', 'prompt must be a string.');
    const guarded = guardPrompt(prompt);
    if (!guarded.ok) fail('invalid-prompt', guarded.reason ?? 'Invalid prompt.');
    const context = validateContext(obj.context, definition.allowedContextFields);
    const requestId =
      obj.requestId === undefined ? undefined : readBoundedString(obj, 'requestId', MAX_REQUEST_ID_CHARS);
    if (roleId === 'senior-mentor') {
      return {
        ok: true,
        warnings: guarded.warnings,
        value: {
          roleId,
          taskType,
          responseSchemaId: schemaId,
          prompt: guarded.prompt,
          context,
          ...(requestId ? { requestId } : {}),
        } as SeniorMentorRequest,
      };
    }
    return {
      ok: true,
      warnings: guarded.warnings,
      value: {
        roleId,
        taskType,
        responseSchemaId: schemaId,
        prompt: guarded.prompt,
        context,
        ...(requestId ? { requestId } : {}),
      } as LegalResearcherRequest,
    };
  } catch (error) {
    if (error instanceof ContractViolation) {
      return { ok: false, code: error.code as RequestValidationCode, reason: error.message };
    }
    return { ok: false, code: 'invalid-shape', reason: 'Request could not be validated.' };
  }
}

/** Stable, dependency-free correlation id for identical requests (event idempotency). */
export function requestFingerprint(request: RoleRequest): string {
  const parts: string[] = [request.roleId, request.taskType, request.prompt];
  const context = request.context as Record<string, unknown>;
  for (const key of Object.keys(context).sort()) {
    const value = context[key];
    const normalized = Array.isArray(value) ? [...value].sort().join(',') : String(value);
    parts.push(`${key}=${normalized}`);
  }
  let hash = 5381;
  const input = parts.join('|');
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return `req_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/* ------------------------------------------------------------ output validators */

function validatePoint(raw: unknown, field: string, options: OutputValidationOptions): FeedbackPoint {
  const obj = asRecord(raw, field);
  assertOnlyKeys(obj, POINT_KEYS, field);
  const point = readBoundedString(obj, 'point', MAX_TEXT_FIELD_CHARS);
  const basis = readEnum(obj, 'basis', ['evidence', 'source', 'reasoning'] as const);
  const refs = readStringArray(obj, 'refs', MAX_REF_IDS, MAX_CONTEXT_ID_CHARS);
  assertRefs(refs, options, field);
  if (basis !== 'reasoning' && refs.length === 0) {
    fail('unbound-reference', `${field} must bind an evidence/source ref for a ${basis} point.`);
  }
  return { point, basis, refs };
}

function validateGap(raw: unknown, field: string, options: OutputValidationOptions): FeedbackGap {
  const obj = asRecord(raw, field);
  assertOnlyKeys(obj, GAP_KEYS, field);
  const point = readBoundedString(obj, 'point', MAX_TEXT_FIELD_CHARS);
  const fix = readBoundedString(obj, 'fix', MAX_TEXT_FIELD_CHARS);
  const refs = readStringArray(obj, 'refs', MAX_REF_IDS, MAX_CONTEXT_ID_CHARS);
  assertRefs(refs, options, field);
  return { point, fix, refs };
}

function validateClaim(raw: unknown, field: string, options: OutputValidationOptions): ResearchClaim {
  const obj = asRecord(raw, field);
  assertOnlyKeys(obj, CLAIM_KEYS, field);
  const claim = readBoundedString(obj, 'claim', MAX_TEXT_FIELD_CHARS);
  const sourceId = readBoundedString(obj, 'sourceId', MAX_CONTEXT_ID_CHARS);
  assertVerifiedSources([sourceId], options, field);
  const note = readBoundedString(obj, 'note', MAX_TEXT_FIELD_CHARS);
  return { claim, sourceId, note };
}

export function validateReviewFeedback(
  raw: unknown,
  options: OutputValidationOptions,
): OutputValidation<ReviewFeedback> {
  try {
    const obj = asRecord(raw, 'output');
    assertOnlyKeys(obj, REVIEW_FEEDBACK_KEYS, 'output');
    const schemaId = readLiteral(obj, 'schemaId', 'review-feedback.v1' as const);
    const roleId = readLiteral(obj, 'roleId', 'senior-mentor' as const);
    const requestId = readBoundedString(obj, 'requestId', MAX_REQUEST_ID_CHARS);
    if (requestId !== options.expectedRequestId) {
      fail('schema-mismatch', 'Output requestId does not match the gateway request.');
    }
    const status = readEnum(obj, 'status', ['ok', 'refused'] as const);
    const summary = readBoundedString(obj, 'summary', MAX_SUMMARY_CHARS, status === 'refused');
    const strengths = readArray(obj, 'strengths', MAX_OUTPUT_ITEMS).map((item, i) =>
      validatePoint(item, `strengths[${i}]`, options),
    );
    const gaps = readArray(obj, 'gaps', MAX_OUTPUT_ITEMS).map((item, i) => validateGap(item, `gaps[${i}]`, options));
    const citedSources = readStringArray(obj, 'citedSources', MAX_REF_IDS, MAX_CONTEXT_ID_CHARS);
    const requiresRevision = readBoolean(obj, 'requiresRevision');
    const refusalReason = readNullableString(obj, 'refusalReason', MAX_TEXT_FIELD_CHARS);
    assertVerifiedSources(citedSources, options, 'citedSources');
    assertStatusConsistency(status, refusalReason, [strengths, gaps, citedSources]);
    const value: ReviewFeedback = {
      schemaId,
      roleId,
      requestId,
      status,
      summary,
      strengths,
      gaps,
      citedSources,
      requiresRevision,
      refusalReason,
    };
    assertProseSafety(value);
    assertSerializedSize(value);
    return { ok: true, value, warnings: [AI_NON_AUTHORITATIVE_NOTICE] };
  } catch (error) {
    return outputFailure(error);
  }
}

export function validateResearchAnswer(
  raw: unknown,
  options: OutputValidationOptions,
): OutputValidation<ResearchAnswer> {
  try {
    const obj = asRecord(raw, 'output');
    assertOnlyKeys(obj, RESEARCH_ANSWER_KEYS, 'output');
    const schemaId = readLiteral(obj, 'schemaId', 'research-answer.v1' as const);
    const roleId = readLiteral(obj, 'roleId', 'legal-researcher' as const);
    const requestId = readBoundedString(obj, 'requestId', MAX_REQUEST_ID_CHARS);
    if (requestId !== options.expectedRequestId) {
      fail('schema-mismatch', 'Output requestId does not match the gateway request.');
    }
    const status = readEnum(obj, 'status', ['ok', 'refused'] as const);
    const summary = readBoundedString(obj, 'summary', MAX_SUMMARY_CHARS, status === 'refused');
    const claims = readArray(obj, 'claims', MAX_OUTPUT_ITEMS).map((item, i) =>
      validateClaim(item, `claims[${i}]`, options),
    );
    const citedSources = readStringArray(obj, 'citedSources', MAX_REF_IDS, MAX_CONTEXT_ID_CHARS);
    const refusalReason = readNullableString(obj, 'refusalReason', MAX_TEXT_FIELD_CHARS);
    assertVerifiedSources(citedSources, options, 'citedSources');
    assertStatusConsistency(status, refusalReason, [claims, citedSources]);
    const value: ResearchAnswer = { schemaId, roleId, requestId, status, summary, claims, citedSources, refusalReason };
    assertProseSafety(value);
    assertSerializedSize(value);
    return { ok: true, value, warnings: [AI_NON_AUTHORITATIVE_NOTICE] };
  } catch (error) {
    return outputFailure(error);
  }
}

function outputFailure(error: unknown): OutputValidation<never> {
  if (error instanceof ContractViolation) {
    return { ok: false, code: error.code as OutputValidationCode, reason: error.message };
  }
  return { ok: false, code: 'invalid-shape', reason: 'Output could not be validated.' };
}

/** Dispatch output validation from the role id; the schema id is checked inside. */
export function validateRoleOutput(roleId: RoleId, raw: unknown, options: OutputValidationOptions): OutputValidation {
  if (roleId === 'senior-mentor') return validateReviewFeedback(raw, options);
  return validateResearchAnswer(raw, options);
}
