/**
 * Model-independent AI gateway (Track C skeleton).
 *
 * The gateway is a passive facade: it calls a provider ONLY when a caller explicitly invokes
 * a role for a discrete event. It owns no timers, listeners or background work, so no model
 * is ever called on a click, movement, clock tick or database lookup. Runtime AI is disabled
 * by default; a missing/failed/disabled provider yields a deterministic fallback, never a
 * blocked game action and never raw model text.
 *
 * Guards stay outside the provider (see `guards.ts`): every provider, present or future,
 * inherits the same prompt/context/output checks. The gateway adds role dispatch, schema
 * validation, provenance binding and a bounded envelope. It never mutates game state; the
 * deterministic consumer named in the role registry remains the only writer.
 */
import { AI_NON_AUTHORITATIVE_NOTICE } from '@/domain/ai/guards';
import type { LocalAiProvider, ProviderErrorCode, ProviderRequest, ProviderResult } from '@/domain/ai/provider';
import {
  requestFingerprint,
  ROLE_IDS,
  ROLE_REGISTRY,
  TASK_TYPES,
  validateRoleOutput,
  validateRoleRequest,
  type OutputValidationOptions,
  type OutputValidationCode,
  type RequestValidationCode,
  type RoleId,
  type RoleOutput,
  type RoleRequest,
  type TaskType,
} from '@/domain/ai/roles';

/** Bounded serialized provider envelope (prompt + context), matching the architecture caps. */
export const MAX_GATEWAY_ENVELOPE_CHARS = 16000;

/** Model + parameters are resolved here, never in caller/UI code. */
export interface ModelProfile {
  readonly id: string;
  readonly maxTokens: number;
  readonly temperature: number;
  /** 0 (default) or 1; bounded so a role can never loop inference. */
  readonly maxRetries: 0 | 1;
}

export const DEFAULT_MODEL_PROFILE: ModelProfile = {
  id: 'local-small-fast',
  maxTokens: 256,
  temperature: 0.2,
  maxRetries: 0,
};

export type GatewayRejectionCode = RequestValidationCode | OutputValidationCode | 'invalid-output';
export type GatewayDegradedCode =
  'disabled' | 'no-provider' | 'unavailable' | 'timeout' | 'provider-error' | 'cancelled' | 'budget-exceeded';

/** Deterministic, non-authoritative hand-off. Contains no AI text and no legal assertion. */
export interface DeterministicFallback {
  readonly kind: 'deterministic-fallback';
  readonly roleId: RoleId | 'unknown';
  readonly taskType: TaskType | 'unknown';
  readonly requestId: string;
  /** The deterministic domain function that remains the only writer for this role. */
  readonly consumer: string;
  readonly notice: string;
}

interface GatewayResultBase {
  readonly requestId: string;
  readonly roleId: RoleId | 'unknown';
  readonly warnings: readonly string[];
}

export type AiGatewayResult =
  | (GatewayResultBase & { readonly status: 'accepted'; readonly output: RoleOutput })
  | (GatewayResultBase & {
      readonly status: 'rejected';
      readonly code: GatewayRejectionCode;
      readonly reason: string;
      readonly fallback: DeterministicFallback;
    })
  | (GatewayResultBase & {
      readonly status: 'degraded';
      readonly code: GatewayDegradedCode;
      readonly reason: string;
      readonly fallback: DeterministicFallback;
    });

export interface GatewayInvokeOptions {
  /** Caller cancellation (unmount / new request), forwarded to the transport. */
  readonly signal?: AbortSignal;
  /** Overrides the deterministic fingerprint when the caller already has a correlation id. */
  readonly requestId?: string;
  /** Verified registry ids visible to this event; unverified citations are always rejected. */
  readonly verifiedSourceIds?: readonly string[];
}

export interface AiGatewayOptions {
  readonly provider?: LocalAiProvider;
  /** Default false: no provider call happens until a caller opts in explicitly. */
  readonly enabled?: boolean;
  readonly profile?: ModelProfile;
  readonly verifiedSourceIds?: readonly string[];
}

/** One seam for every role; callers depend on this interface, not on a model. */
export interface AiGateway {
  invoke(request: RoleRequest, options?: GatewayInvokeOptions): Promise<AiGatewayResult>;
}

/* ------------------------------------------------------------------ internals */

const ROLE_SYSTEM_PROMPTS: Readonly<Record<RoleId, string>> = {
  'senior-mentor':
    'You are the senior-mentor role in a legal-training simulator. Review the player’s own work, ' +
    'name concrete gaps and ask for revision. Return only a JSON object matching the required schema. ' +
    'You have no access to hidden case truth and must not decide who is at fault.',
  'legal-researcher':
    'You are the legal-researcher role in a legal-training simulator. Explain only approved internal ' +
    'summaries supplied as context, and bind every claim to a verified source id. Return only a JSON ' +
    'object matching the required schema. Never invent a statute, judgment or citation.',
};

function isRoleId(value: unknown): value is RoleId {
  return typeof value === 'string' && (ROLE_IDS as readonly string[]).includes(value);
}

function isTaskType(value: unknown): value is TaskType {
  return typeof value === 'string' && (TASK_TYPES as readonly string[]).includes(value);
}

function fallbackFor(
  roleId: RoleId | 'unknown',
  taskType: TaskType | 'unknown',
  requestId: string,
): DeterministicFallback {
  return {
    kind: 'deterministic-fallback',
    roleId,
    taskType,
    requestId,
    consumer: roleId === 'unknown' ? 'deterministic-domain-rules' : ROLE_REGISTRY[roleId].deterministicConsumer,
    notice: `${AI_NON_AUTHORITATIVE_NOTICE} No AI output was accepted or available; use the deterministic domain path. No AI text was applied.`,
  };
}

function rejected(
  requestId: string,
  roleId: RoleId | 'unknown',
  warnings: readonly string[],
  code: GatewayRejectionCode,
  reason: string,
  fallback: DeterministicFallback,
): AiGatewayResult {
  return { status: 'rejected', requestId, roleId, warnings: [...warnings], code, reason, fallback };
}

function degraded(
  requestId: string,
  roleId: RoleId | 'unknown',
  warnings: readonly string[],
  code: GatewayDegradedCode,
  reason: string,
  fallback: DeterministicFallback,
): AiGatewayResult {
  return { status: 'degraded', requestId, roleId, warnings: [...warnings], code, reason, fallback };
}

function mapProviderError(code: ProviderErrorCode): GatewayDegradedCode {
  if (code === 'unavailable') return 'unavailable';
  if (code === 'timeout') return 'timeout';
  return 'provider-error';
}

function safeMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') return 'Request was cancelled.';
  return error instanceof Error ? error.message : 'Provider call failed.';
}

/** Player-visible ids from the context envelope: the only ids a `refs` entry may use. */
function collectRefIds(request: RoleRequest): Set<string> {
  const ids = new Set<string>();
  const context = request.context as Record<string, unknown>;
  for (const [key, value] of Object.entries(context)) {
    if (!/Ids?$/.test(key)) continue;
    if (typeof value === 'string') ids.add(value);
    else if (Array.isArray(value)) {
      for (const item of value) if (typeof item === 'string') ids.add(item);
    }
  }
  return ids;
}

/** Guard context blocks again here (defence in depth) and build a bounded provider request. */
function buildProviderRequest(request: RoleRequest, profile: ModelProfile, signal?: AbortSignal): ProviderRequest {
  const definition = ROLE_REGISTRY[request.roleId];
  const context = request.context as Record<string, unknown>;
  const contextLines = Object.keys(context)
    .sort()
    .map((key) => {
      const value = context[key];
      const text = Array.isArray(value) ? value.join(', ') : String(value);
      return { role: 'system' as const, content: `NON-AUTHORITATIVE context — [${key}] ${text}` };
    });
  const system = [
    ROLE_SYSTEM_PROMPTS[request.roleId],
    `Knowledge boundary: ${definition.knowledgeBoundary}`,
    `Required response: one JSON object matching ${definition.responseSchemaId}, echoing requestId exactly.`,
    'Mark every statement non-authoritative. If you cannot comply, return a refused result.',
  ].join('\n');
  return {
    messages: [{ role: 'system', content: system }, ...contextLines, { role: 'user', content: request.prompt }],
    maxTokens: profile.maxTokens,
    temperature: profile.temperature,
    ...(signal ? { signal } : {}),
  };
}

/**
 * Build a gateway over any `LocalAiProvider`. Passing no provider (or `enabled: false`, the
 * default) produces a gateway that always returns the deterministic fallback offline.
 */
export function createAiGateway(options: AiGatewayOptions = {}): AiGateway {
  const profile = options.profile ?? DEFAULT_MODEL_PROFILE;
  const defaultVerifiedSourceIds = options.verifiedSourceIds ?? [];

  return {
    async invoke(request: RoleRequest, invokeOptions: GatewayInvokeOptions = {}): Promise<AiGatewayResult> {
      const checked = validateRoleRequest(request);
      const raw = request as { roleId?: unknown; taskType?: unknown; requestId?: unknown } | null;
      const rawRoleId = raw?.roleId;
      const rawTaskType = raw?.taskType;
      const errorRoleId = isRoleId(rawRoleId) ? rawRoleId : 'unknown';
      const errorTaskType = isTaskType(rawTaskType) ? rawTaskType : 'unknown';
      const errorRequestId =
        invokeOptions.requestId ?? (typeof raw?.requestId === 'string' ? raw.requestId : 'req_invalid');

      if (!checked.ok) {
        return rejected(
          errorRequestId,
          errorRoleId,
          [],
          checked.code,
          checked.reason,
          fallbackFor(errorRoleId, errorTaskType, errorRequestId),
        );
      }

      const validRequest = checked.value;
      const requestId = invokeOptions.requestId ?? requestFingerprint(validRequest);
      const fallback = fallbackFor(validRequest.roleId, validRequest.taskType, requestId);
      const provider = options.provider;
      const warnings = checked.warnings;

      if (options.enabled !== true) {
        return degraded(
          requestId,
          validRequest.roleId,
          warnings,
          'disabled',
          'Runtime AI is disabled; the deterministic domain path is used.',
          fallback,
        );
      }
      if (!provider) {
        return degraded(
          requestId,
          validRequest.roleId,
          warnings,
          'no-provider',
          'No AI provider is configured; the deterministic domain path is used.',
          fallback,
        );
      }
      if (invokeOptions.signal?.aborted) {
        return degraded(
          requestId,
          validRequest.roleId,
          warnings,
          'cancelled',
          'Request was cancelled before the provider call.',
          fallback,
        );
      }

      const providerRequest = buildProviderRequest(validRequest, profile, invokeOptions.signal);
      if (JSON.stringify(providerRequest.messages).length > MAX_GATEWAY_ENVELOPE_CHARS) {
        return degraded(
          requestId,
          validRequest.roleId,
          warnings,
          'budget-exceeded',
          'Provider envelope exceeds the safe size limit.',
          fallback,
        );
      }

      const validationOptions: OutputValidationOptions = {
        expectedRequestId: requestId,
        allowedRefIds: collectRefIds(validRequest),
        verifiedSourceIds: new Set(invokeOptions.verifiedSourceIds ?? defaultVerifiedSourceIds),
      };

      let result: ProviderResult;
      try {
        result = await provider.generate(providerRequest);
      } catch (error) {
        const code = error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'provider-error';
        return degraded(requestId, validRequest.roleId, warnings, code, safeMessage(error), fallback);
      }
      if (!result.ok) {
        return degraded(
          requestId,
          validRequest.roleId,
          warnings,
          mapProviderError(result.code),
          result.error,
          fallback,
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.text);
      } catch {
        return rejected(
          requestId,
          validRequest.roleId,
          warnings,
          'invalid-output',
          'Provider output was not valid JSON.',
          fallback,
        );
      }

      const validated = validateRoleOutput(validRequest.roleId, parsed, validationOptions);
      if (!validated.ok) {
        return rejected(requestId, validRequest.roleId, warnings, validated.code, validated.reason, fallback);
      }
      return {
        status: 'accepted',
        requestId,
        roleId: validRequest.roleId,
        warnings: [...warnings, ...validated.warnings],
        output: validated.value,
      };
    },
  };
}

/** Disabled-by-default gateway: safe to construct at import time, never touches the network. */
export const disabledAiGateway: AiGateway = createAiGateway();
