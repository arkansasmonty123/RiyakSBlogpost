import { DEFAULT_GAME_SLOT, type GameRepository } from './gameRepository';
import { hydrateSave, toPersistedSave, type PersistResult } from './save';
import { createInitialSave } from '@/domain/seed';
import type { SaveGame } from '@/domain/types';

export interface FetchLike {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface MigrationSource {
  hasLocalSave(slotId: string): boolean;
  loadLocalSave(slotId: string): SaveGame;
}

export class SqliteApiGameRepository implements GameRepository {
  constructor(
    private readonly baseUrl = '',
    private readonly fetchImpl: FetchLike = fetch,
    private readonly migration?: MigrationSource,
  ) {}

  private slotUrl(slotId: string): string {
    return `${this.baseUrl}/api/saves/${encodeURIComponent(slotId)}`;
  }

  async loadGame(slotId: string = DEFAULT_GAME_SLOT): Promise<SaveGame> {
    try {
      const res = await this.fetchImpl(this.slotUrl(slotId), { method: 'GET' });
      if (res.status === 404) {
        if (this.migration?.hasLocalSave(slotId)) {
          const imported = this.migration.loadLocalSave(slotId);
          // Best-effort import into server slot; do not fail load if import write fails.
          await this.saveGame(slotId, imported);
          return imported;
        }
        return createInitialSave();
      }
      if (!res.ok) throw new Error(`LOAD_FAILED:${res.status}`);
      const data = (await res.json()) as { ok?: boolean; slot?: { payload?: unknown } };
      return hydrateSave(data?.slot?.payload);
    } catch {
      // Fail closed to a fresh, safe in-memory save; caller may choose fallback policy.
      return createInitialSave();
    }
  }

  async saveGame(slotId: string, state: SaveGame): Promise<PersistResult> {
    try {
      const res = await this.fetchImpl(this.slotUrl(slotId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: toPersistedSave(state) }),
      });
      if (!res.ok) return { ok: false, reason: `HTTP_${res.status}` };
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  async resetGame(slotId: string = DEFAULT_GAME_SLOT): Promise<SaveGame> {
    try {
      const res = await this.fetchImpl(this.slotUrl(slotId), { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(`RESET_FAILED:${res.status}`);
    } catch {
      // Fall through: always return a fresh in-memory save.
    }
    return createInitialSave();
  }
}
