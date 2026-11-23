import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '@/app/App';
import { discoverEvidenceItem, reviewEvidence } from '@/domain/evidence';
import { createInitialSave } from '@/domain/seed';
import { SAVE_KEY } from '@/storage/save';
import type { SaveGame } from '@/domain/types';

type Panel = 'case' | 'casework' | 'theory';

/** Render the real component tree against a save, using a minimal localStorage stub. */
function renderWithSave(save: SaveGame, panel: Panel): string {
  const data: Record<string, string> = { [SAVE_KEY]: JSON.stringify(save) };
  const globals = globalThis as Record<string, unknown>;
  const previousWindow = globals.window;
  globals.window = {
    localStorage: {
      getItem: (key: string) => data[key] ?? null,
      setItem: (key: string, value: string) => {
        data[key] = value;
      },
      removeItem: (key: string) => {
        delete data[key];
      },
    },
  };
  try {
    return renderToString(<App initialPanel={panel} />).replace(/<!-- -->/g, '');
  } finally {
    globals.window = previousWindow;
  }
}

function buttonMarkup(html: string, label: string): string {
  const match = html.match(new RegExp(`<button\\b[^>]*>${label}</button>`));
  if (!match) throw new Error(`Button "${label}" was not rendered`);
  return match[0];
}

describe('workspace panel polish', () => {
  it('disables empty custody and challenge actions and links their hints', () => {
    const save = createInitialSave();
    discoverEvidenceItem(save, 'ev-2');
    reviewEvidence(save, 'ev-2');
    const html = renderWithSave(save, 'casework');

    for (const label of ['Log custody observation', 'Record challenge']) {
      const button = buttonMarkup(html, label);
      expect(button).toContain('disabled=""');
      expect(button).toContain('aria-describedby=');
    }
    expect(html).toContain('id="custody-observation-hint"');
    expect(html).toContain('id="challenge-rationale-hint"');
  });

  it('disables an empty theory claim action and links its hint', () => {
    const html = renderWithSave(createInitialSave(), 'theory');
    expect(buttonMarkup(html, 'Add claim')).toContain('disabled=""');
    expect(html).toContain('id="theory-claim-hint"');
  });

  it('keeps the final brief usable but shows an accessible 40-character requirement', () => {
    const save = createInitialSave();
    save.clock.day = 10;
    save.assignments.find((a) => a.id === 'a7')!.status = 'reviewed';
    const html = renderWithSave(save, 'casework');

    const button = buttonMarkup(html, 'Submit final brief');
    expect(button).not.toContain('disabled');
    expect(button).toContain('aria-describedby="final-brief-hint"');
    expect(html).toContain('id="final-brief-hint"');
    expect(html).toContain('0/40 characters');
    expect(html).toContain('write at least 40 before submitting');
  });

  it('makes the workspace heading a focusable panel-change target', () => {
    const html = renderWithSave(createInitialSave(), 'case');
    expect(html).toMatch(/<h2\b[^>]*id="workspace-heading"[^>]*tabindex="-1"/);
    expect(html).toContain('<a href="#main-content" class="skip-link">');
  });
});
