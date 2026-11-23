import { DEFAULT_GAME_SLOT } from './gameRepository';

/**
 * The set of slot IDs accepted by the save API. Keep in sync with
 * `slotIdFromPath` in `server/api.ts` (ADR-003, known gap #5).
 */
export const SLOT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** True only for slot IDs that are safe as a single URL path segment. */
export function isValidSlotId(slotId: unknown): slotId is string {
  return typeof slotId === 'string' && SLOT_ID_PATTERN.test(slotId);
}

/**
 * Coerce an untrusted slot ID into one the save API accepts. Invalid IDs
 * (empty, longer than 64 chars, or containing anything outside
 * `[A-Za-z0-9_-]`) fall back to `DEFAULT_GAME_SLOT` so callers never issue
 * malformed requests or hit unexpected 404s.
 */
export function normalizeSlotId(slotId: unknown): string {
  return isValidSlotId(slotId) ? slotId : DEFAULT_GAME_SLOT;
}
