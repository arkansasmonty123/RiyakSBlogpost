import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '@/app/App';
import { addEvidenceNote, discoverEvidenceItem, reviewEvidence } from '@/domain/evidence';
import { ALL_VIEWPOINT_IDS } from '@/domain/scenes';
import { createInitialSave } from '@/domain/seed';
import type { SaveGame } from '@/domain/types';
import { SAVE_KEY } from '@/storage/save';

const FORBIDDEN = ['canonicaltruth', 'actualevents', 'hiddenmotives', 'evidenceauthenticity', 'prior dispute', '18:12'];

type RenderOptions = {
  viewpoint?: string;
  panel?: 'case' | 'evidence' | 'journal';
  save?: SaveGame;
};

/** Render the real component tree with a controlled save, restoring globals afterwards. */
function renderApp({ viewpoint, panel, save = createInitialSave() }: RenderOptions = {}): string {
  if (viewpoint) save.selectedViewpoint = viewpoint;
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

/** Extract just the decorative SVG so assertions cannot accidentally match page chrome. */
function sceneSvg(html: string): string {
  const start = html.indexOf('<svg class="scene-art"');
  expect(start).toBeGreaterThanOrEqual(0);
  return html.slice(start, html.indexOf('</svg>', start) + '</svg>'.length);
}

describe('static scene presentation', () => {
  it('renders a distinct, purely-vector stage set for every viewpoint', () => {
    const svgByViewpoint = new Map<string, string>();
    for (const viewpoint of ALL_VIEWPOINT_IDS) {
      const svg = sceneSvg(renderApp({ viewpoint }));
      expect(svg).toContain('viewBox="0 0 800 450"');
      expect(svg.length).toBeGreaterThan(2000);
      // No raster images, remote assets or heavy payloads — composition is SVG/CSS only.
      expect(svg).not.toContain('<image');
      expect(svg).not.toContain('data:image');
      expect(svg).not.toContain('http://');
      expect(svg).not.toContain('https://');
      expect(svg).not.toContain('<animate');
      svgByViewpoint.set(viewpoint, svg);
    }
    expect(svgByViewpoint.size).toBe(ALL_VIEWPOINT_IDS.length);
    expect(new Set(svgByViewpoint.values()).size).toBe(ALL_VIEWPOINT_IDS.length);
  });

  it('keeps the illustration decorative while hotspots remain labelled controls', () => {
    const html = renderApp({ viewpoint: 'entrance' });
    const svg = sceneSvg(html);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
    expect(html).toContain('aria-label="Entrance hotspots"');
    expect(html).toContain('Senior Mentor');
    expect(html).toContain('Door to Reception');
    for (const forbidden of FORBIDDEN) expect(html.toLowerCase()).not.toContain(forbidden);
  });

  it('renders the added decorative art inline, local and non-interactive', () => {
    const entrance = sceneSvg(renderApp({ viewpoint: 'entrance' }));
    const waiting = sceneSvg(renderApp({ viewpoint: 'waiting-area' }));
    const bookshelf = sceneSvg(renderApp({ viewpoint: 'bookshelf' }));
    const corridor = sceneSvg(renderApp({ viewpoint: 'corridor' }));

    expect(entrance).toContain('data-art="portrait-frame"');
    expect(waiting).toContain('data-art="portrait-frame"');
    expect(bookshelf).toContain('data-art="file-cabinet"');
    expect(corridor).toContain('data-art="file-cabinet"');

    for (const svg of [entrance, waiting, bookshelf, corridor]) {
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).not.toContain('<image');
      expect(svg).not.toContain('data:image');
      expect(svg).not.toContain('http://');
      expect(svg).not.toContain('https://');
      expect(svg).not.toContain('<button');
      expect(svg).not.toContain('<animate');
    }
  });

  it('explains that the scene art is illustrative and every action has a control', () => {
    const html = renderApp({ viewpoint: 'corridor' });
    expect(html).toContain('the illustration is decorative; every action is a labelled control below');
    expect(html).toContain('aria-label="Corridor hotspots"');
  });
});

describe('case board clarity and cross-links', () => {
  it('presents a scannable case file with player-only framing', () => {
    const html = renderApp({ panel: 'case' });
    expect(html).toContain('Case file · working record');
    expect(html).toContain('known notes');
    expect(html).toContain('allegations');
    expect(html).toContain('open questions');
    expect(html).toContain('This file holds only what you have legitimately learned');
    expect(html).toContain('See how the record developed in the timeline');
    expect(html).toContain('Keep known facts, claims and open questions separate');
    for (const forbidden of FORBIDDEN) expect(html.toLowerCase()).not.toContain(forbidden);
  });

  it('links a reviewed evidence item to its journal entry and back', () => {
    const save = createInitialSave();
    discoverEvidenceItem(save, 'ev-1');
    reviewEvidence(save, 'ev-1');
    addEvidenceNote(save, 'ev-1', 'contradiction', 'The note does not address the clip gap.');

    const evidenceHtml = renderApp({ panel: 'evidence', save });
    expect(evidenceHtml).toContain('Evidence board');
    expect(evidenceHtml).toContain('Open timeline');
    expect(evidenceHtml).toContain('View in journal');

    const journalHtml = renderApp({ panel: 'journal', save });
    expect(journalHtml).toContain('In evidence board');
    expect(journalHtml).toContain('Entries linked to an evidence item');
    for (const forbidden of FORBIDDEN) expect(journalHtml.toLowerCase()).not.toContain(forbidden);
  });

  it('gives plain-language next-step guidance with milestone context', () => {
    const html = renderApp({ panel: 'case' });
    expect(html).toContain('Next step');
    expect(html).toContain('Milestone 1/8');
    expect(html).toMatch(
      /Open (case file|assignments|evidence board|casework|case theory|research|draft editor|notebook|timeline|conversations)/,
    );
  });
});
