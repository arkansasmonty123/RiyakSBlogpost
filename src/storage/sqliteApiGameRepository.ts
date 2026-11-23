import { DEFAULT_GAME_SLOT, type GameRepository, type SaveOptions } from './gameRepository';
import { normalizeSlotId } from './slotId';
import { hydrateSave, SAVE_CONFLICT_REASON, toPersistedSave, type PersistResult } from './save';
import { createInitialSave } from '@/domain/seed';
import type { SaveGame } from '@/domain/types';

export interface FetchLike {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface MigrationSource {
  hasLocalSave(slotId: string): boolean;
  loadLocalSave(slotId: string): SaveGame;
}

/** Server save-slot shape we care about for optimistic concurrency (never the payload contents). */
interface SlotStamp {
  savedAt?: unknown;
  payload?: { savedAt?: unknown };
}

export class SqliteApiGameRepository implements GameRepository {
  /**
   * Last savedAt observed from the server, keyed by opaque slot id. Used as the
   * `expectedSavedAt` guard so a stale client cannot silently overwrite another copy.
   * Missing entry means "unknown" — in that case no guard is sent.
   */
  private readonly knownSavedAt = new Map<string, string>();

  constructor(
    private readonly baseUrl = '',
    private readonly fetchImpl: FetchLike = fetch,
    private readonly migration?: MigrationSource,
  ) {}

  private slotUrl(slotId: string): string {
    return `${this.baseUrl}/api/saves/${encodeURIComponent(slotId)}`;
  }

  private static savedAtFromSlot(slot: unknown): string | undefined {
    if (!slot || typeof slot !== 'object') return undefined;
    const stamp = slot as SlotStamp;
    if (typeof stamp.savedAt === 'string') return stamp.savedAt;
    if (stamp.payload && typeof stamp.payload.savedAt === 'string') return stamp.payload.savedAt;
    return undefined;
  }

  /** Remember the server's stamp, falling back to the stamp we wrote when the ack omits it. */
  private rememberSavedAt(slotId: string, slot: unknown, fallback?: string): void {
    const savedAt = SqliteApiGameRepository.savedAtFromSlot(slot) ?? fallback;
    if (savedAt === undefined) this.knownSavedAt.delete(slotId);
    else this.knownSavedAt.set(slotId, savedAt);
  }

  async loadGame(slotId: string = DEFAULT_GAME_SLOT): Promise<SaveGame> {
    const slot = normalizeSlotId(slotId);
    // A fresh load makes the previous stamp untrusted until this response confirms it.
    this.knownSavedAt.delete(slot);
    try {
      const res = await this.fetchImpl(this.slotUrl(slot), { method: 'GET' });
      if (res.status === 404) {
        if (this.migration?.hasLocalSave(slot)) {
          const imported = this.migration.loadLocalSave(slot);
          // Best-effort import into server slot; do not fail load if import write fails.
          // The slot stamp is still unknown here, so the import never sends a stale guard.
          await this.saveGame(slot, imported);
          return imported;
        }
        return createInitialSave();
      }
      if (!res.ok) throw new Error(`LOAD_FAILED:${res.status}`);
      const data = (await res.json()) as { ok?: boolean; slot?: { payload?: unknown } };
      this.rememberSavedAt(slot, data?.slot);
      return hydrateSave(data?.slot?.payload);
    } catch {
      // Fail closed to a fresh, safe in-memory save; caller may choose fallback policy.
      this.knownSavedAt.delete(slot);
      return createInitialSave();
    }
  }

  async saveGame(slotId: string, state: SaveGame, options?: SaveOptions): Promise<PersistResult> {
    const slot = normalizeSlotId(slotId);
    const persisted = toPersistedSave(state);
    const expectedSavedAt = options?.force ? undefined : this.knownSavedAt.get(slot);
    const body: Record<string, unknown> = { payload: persisted };
    if (expectedSavedAt !== undefined) body.expectedSavedAt = expectedSavedAt;

    try {
      const res = await this.fetchImpl(this.slotUrl(slot), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        // Keep the old stamp: the server copy stays authoritative until a reload or an
        // explicit overwrite. Never disable the guard silently after a conflict.
        return { ok: false, reason: SAVE_CONFLICT_REASON, conflict: true };
      }
      if (!res.ok) return { ok: false, reason: `HTTP_${res.status}` };
      const ack = (await res.json().catch(() => null)) as { slot?: unknown } | null;
      this.rememberSavedAt(slot, ack?.slot, persisted.savedAt);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  async resetGame(slotId: string = DEFAULT_GAME_SLOT): Promise<SaveGame> {
    const slot = normalizeSlotId(slotId);
    try {
      const res = await this.fetchImpl(this.slotUrl(slot), { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(`RESET_FAILED:${res.status}`);
    } catch {
      // Fall through: always return a fresh in-memory save.
    }
    // The slot no longer exists (or we could not confirm it): forget any stale stamp.
    this.knownSavedAt.delete(slot);
    return createInitialSave();
  }
}
