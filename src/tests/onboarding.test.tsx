import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '@/app/App';
import { HELP_SEEN_FLAG, markHelpSeen, shouldShowHelp } from '@/domain/onboarding';
import { createInitialSave } from '@/domain/seed';
import { LEGACY_KEY, loadSave, persistSave, SAVE_KEY } from '@/storage/save';
import type { StorageLike } from '@/storage/save';
import type { SaveGame } from '@/domain/types';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

function renderApp(save: SaveGame): string {
  const storage = memoryStorage();
  persistSave(save, storage);
  const globalAny = globalThis as { window?: unknown };
  const previousWindow = globalAny.window;
  globalAny.window = { localStorage: storage };
  try {
    return renderToString(<App />).replace(/<!-- -->/g, '');
  } finally {
    if (previousWindow === undefined) delete globalAny.window;
    else globalAny.window = previousWindow;
  }
}

describe('first-day onboarding flag', () => {
  it('shows guidance on a fresh save and stays hidden once dismissed', () => {
    const save = createInitialSave();
    expect(save.flags[HELP_SEEN_FLAG]).toBe(false);
    expect(shouldShowHelp(save)).toBe(true);

    markHelpSeen(save);
    expect(save.flags[HELP_SEEN_FLAG]).toBe(true);
    expect(shouldShowHelp(save)).toBe(false);
    // Dismissing again is harmless and does not re-show the guide.
    markHelpSeen(save);
    expect(shouldShowHelp(save)).toBe(false);
  });

  it('backfills the flag in older saves and preserves a stored dismissal', () => {
    const oldSave = JSON.parse(JSON.stringify(createInitialSave())) as Record<string, any>;
    oldSave.version = 1;
    delete oldSave.flags[HELP_SEEN_FLAG];
    const loadedOld = loadSave(memoryStorage({ [LEGACY_KEY]: JSON.stringify(oldSave) }));
    expect(loadedOld.flags[HELP_SEEN_FLAG]).toBe(false);
    expect(shouldShowHelp(loadedOld)).toBe(true);

    const seenSave = createInitialSave();
    markHelpSeen(seenSave);
    const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify(seenSave) });
    const loadedSeen = loadSave(storage);
    expect(loadedSeen.flags[HELP_SEEN_FLAG]).toBe(true);
    expect(shouldShowHelp(loadedSeen)).toBe(false);

    persistSave(loadedSeen, storage);
    expect(JSON.parse(storage.data[SAVE_KEY]).flags[HELP_SEEN_FLAG]).toBe(true);
  });

  it('renders a dismissible guide with the core loop and guardrails on day one', () => {
    const html = renderApp(createInitialSave());
    expect(html).toContain('id="how-to-play"');
    expect(html).toContain('How to play');
    expect(html).toContain('Core loop');
    expect(html).toContain('Guardrails');
    expect(html).toContain('Got it — dismiss');
    expect(html).toContain('Never fabricate a statute');
    expect(html).toContain('aria-expanded="true"');
  });

  it('does not auto-open the guide after dismissal, but keeps a header control to reopen it', () => {
    const save = createInitialSave();
    markHelpSeen(save);
    const html = renderApp(save);
    expect(html).not.toContain('id="how-to-play"');
    expect(html).toContain('How to play');
    expect(html).toContain('aria-expanded="false"');
  });
});
