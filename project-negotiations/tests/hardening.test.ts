import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import type { PreparationInput } from '../src/shared/types.js';
import { acquisitionCase } from '../src/server/cases/acquisition.js';
import {
  activateSession, applyPlayerMessage, applyParticipantResponses, createSessionState,
  finalizeSession, recordTurnMetadata, savePreparation, skillRecordsFromDebrief,
} from '../src/server/engine/index.js';
import { closeDb, getDb, getSchemaVersion, saveSessionState, loadSessionState } from '../src/server/db/index.js';

const DB_FILE = `/tmp/opencode/neg-hardening-${process.pid}-${Date.now()}.db`;

const prep: PreparationInput = {
  objectives: 'o', batna: 'b', reservationPoint: 'r', openingPosition: 'p',
  leverage: 'l', concessions: 'c', questions: 'q', predictions: 'd', strategy: 's',
};

function deps() {
  let n = 0;
  const prefix = `h${Math.random().toString(36).slice(2, 8)}`;
  return { id: () => `${prefix}-${++n}`, now: () => '2026-01-01T00:00:00.000Z' };
}

beforeAll(() => {
  process.env.NEGOTIATION_DB_PATH = DB_FILE;
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${DB_FILE}${suffix}`, { force: true });
  closeDb();
  getDb();
});

afterAll(() => {
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${DB_FILE}${suffix}`, { force: true });
});

describe('versioned SQLite migrations', () => {
  it('applies version 1 and creates the control columns', () => {
    expect(getSchemaVersion()).toBe(1);
    const columns = getDb().prepare('PRAGMA table_info(sessions)').all() as { name: string }[];
    const names = columns.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['turn_count', 'llm_calls', 'state_version']));
  });

  it('is idempotent when reopened', () => {
    closeDb();
    getDb();
    expect(getSchemaVersion()).toBe(1);
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM sessions').get()).toEqual({ n: 0 });
  });
});

describe('session counters and persistence', () => {
  it('persists and hydrates turn/llm/state counters', () => {
    const d = deps();
    const state = createSessionState(acquisitionCase, 'counts', d);
    const messaged = applyPlayerMessage(state, acquisitionCase, { content: 'Let us discuss terms.' }, d);
    const metered = recordTurnMetadata(messaged.state, {
      turn: 1, responders: ['corp-dev-vp'], source: 'llm', llmCalls: 2,
      fallbackUsed: false, latencyMs: 12,
    }, d);
    expect(metered.state.turnCount).toBe(1);
    expect(metered.state.llmCalls).toBe(2);
    saveSessionState(metered.state);
    const loaded = loadSessionState('counts')!;
    expect(loaded.turnCount).toBe(1);
    expect(loaded.llmCalls).toBe(2);
    expect(loaded.stateVersion).toBe(metered.state.stateVersion);
    expect(loaded.events.map((e) => e.type)).toContain('turn_completed');
  });

  it('logs llm_degraded exactly once', () => {
    const d = deps();
    const state = createSessionState(acquisitionCase, 'degrade', d);
    const meta = {
      turn: 1, responders: ['corp-dev-vp'], source: 'deterministic_fallback' as const,
      llmCalls: 0, fallbackUsed: true, latencyMs: 1,
    };
    const first = recordTurnMetadata(state, meta, d);
    const second = recordTurnMetadata(first.state, meta, d);
    expect(second.state.events.filter((e) => e.type === 'llm_degraded')).toHaveLength(1);
  });

  it('survives a connection restart with the full session intact', () => {
    const d = deps();
    const created = createSessionState(acquisitionCase, 'restart', d);
    const prepared = savePreparation(created, prep, d);
    const messaged = applyPlayerMessage(prepared.state, acquisitionCase, {
      content: 'What justifies the asking price?', target: 'group',
    }, d);
    const metered = recordTurnMetadata(messaged.state, {
      turn: 1, responders: ['corp-dev-vp'], source: 'deterministic_fallback',
      llmCalls: 0, fallbackUsed: true, latencyMs: 3,
    }, d);
    saveSessionState(metered.state);

    // Simulate a server restart: drop the process-wide DB handle and reopen the same file.
    closeDb();
    getDb();

    const loaded = loadSessionState('restart')!;
    expect(loaded).toBeDefined();
    expect(loaded.status).toBe('active');
    expect(loaded.turnCount).toBe(1);
    expect(loaded.llmCalls).toBe(0);
    expect(loaded.stateVersion).toBe(metered.state.stateVersion);
    expect(loaded.preparation).toEqual(prep);
    expect((loaded.messages ?? []).map((m) => m.content)).toEqual((metered.state.messages ?? []).map((m) => m.content));
    expect(loaded.events.map((e) => e.type)).toEqual(metered.state.events.map((e) => e.type));
  });
});

describe('state machine guards', () => {
  it('requires preparation or an explicit skip to activate', () => {
    const d = deps();
    const state = createSessionState(acquisitionCase, 'guard', d);
    expect(() => activateSession(state, {}, d)).toThrow(/Save a preparation/);
    const prepared = savePreparation(state, prep, d);
    expect(activateSession(prepared.state, {}, d).state.status).toBe('active');
    expect(activateSession(createSessionState(acquisitionCase, 'skip', d), { skipPreparation: true }, d).state.status)
      .toBe('active');
  });

  it('locks preparation after activation and blocks turns after completion', () => {
    const d = deps();
    const prepared = savePreparation(createSessionState(acquisitionCase, 'locked', d), prep, d);
    const active = activateSession(prepared.state, {}, d).state;
    expect(() => savePreparation(active, prep, d)).toThrow(/locked/);
    const done = finalizeSession(active, acquisitionCase, d);
    expect(() => applyPlayerMessage(done.state, acquisitionCase, { content: 'still here?' }, d)).toThrow(/closed/);
    expect(() => applyParticipantResponses(done.state, acquisitionCase, [], d)).toThrow(/closed/);
  });

  it('blocks a second walk-away and produces stable skill ids', () => {
    const d = deps();
    const state = createSessionState(acquisitionCase, 'walk', d);
    const away = applyPlayerMessage(state, acquisitionCase, { content: 'We are done.', type: 'walk_away' }, d);
    expect(() => applyPlayerMessage(away.state, acquisitionCase, { content: 'Done again.', type: 'walk_away' }, d))
      .toThrow(/already ended/);
    const debrief = finalizeSession(away.state, acquisitionCase, d).debrief;
    const first = skillRecordsFromDebrief(debrief, d);
    const second = skillRecordsFromDebrief(debrief, d);
    expect(first).toHaveLength(10);
    expect(first.map((s) => s.id)).toEqual(second.map((s) => s.id));
  });
});
