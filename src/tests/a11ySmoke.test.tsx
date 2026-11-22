import { afterEach, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '@/app/App';

/**
 * Deterministic, browser-free accessibility smoke checks.
 *
 * These render the real component tree with React SSR (no browser binary, no
 * axe, no screen reader) and assert the structural a11y basics that can be
 * verified from markup alone: landmarks/headings, accessible names on controls
 * and form fields, and that every ARIA reference resolves to a real element.
 * Dynamic interaction states (e.g. the Source Intake form, expanded panels)
 * need a real browser and are tracked in docs/QA_CHECKLIST.md.
 */

type Panel =
  | 'case'
  | 'assignments'
  | 'evidence'
  | 'casework'
  | 'theory'
  | 'research'
  | 'draft'
  | 'notebook'
  | 'journal'
  | 'dialogue'
  | 'completion';

const PANELS: Panel[] = [
  'case',
  'assignments',
  'evidence',
  'casework',
  'theory',
  'research',
  'draft',
  'notebook',
  'journal',
  'dialogue',
  'completion',
];

const globals = globalThis as { window?: unknown };
const previousWindow = globals.window;

afterEach(() => {
  globals.window = previousWindow;
});

function renderPanel(panel?: Panel): string {
  const data: Record<string, string> = {};
  globals.window = {
    localStorage: {
      getItem: (key: string) => data[key] ?? null,
      setItem: (key: string, value: string) => { data[key] = value; },
      removeItem: (key: string) => { delete data[key]; },
    },
  };
  return renderToString(panel ? <App initialPanel={panel} /> : <App />).replace(/<!-- -->/g, '');
}

/** Every id present in a rendered fragment. */
function collectIds(html: string): Set<string> {
  const ids = new Set<string>();
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) ids.add(match[1]);
  return ids;
}

/** aria-labelledby / aria-controls tokens that point at a missing id. */
function unresolvedAriaReferences(html: string): string[] {
  const ids = collectIds(html);
  const problems: string[] = [];
  for (const match of html.matchAll(/aria-(labelledby|controls)="([^"]+)"/g)) {
    for (const token of match[2].split(/\s+/).filter(Boolean)) {
      if (!ids.has(token)) problems.push(`aria-${match[1]} -> missing id "${token}"`);
    }
  }
  return problems;
}

/**
 * Form controls with no accessible name: no aria-label/aria-labelledby, no
 * <label for> match and not wrapped in a <label>. `input[type=hidden]` needs no name.
 */
function unlabelledControls(html: string): string[] {
  const problems: string[] = [];
  for (const match of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const [tag, attrs] = [match[1], match[2]];
    if (/\btype="hidden"/.test(attrs)) continue;
    if (/\baria-label=/.test(attrs) || /\baria-labelledby=/.test(attrs)) continue;

    const forId = attrs.match(/\bid="([^"]+)"/);
    if (forId && new RegExp(`<label[^>]*\\bfor="${forId[1]}"`).test(html)) continue;

    const before = html.slice(0, match.index);
    if (before.lastIndexOf('<label') > before.lastIndexOf('</label>')) continue;

    problems.push(`<${tag}> without accessible name`);
  }
  return problems;
}

/** Links and buttons with neither an ARIA name nor visible text content. */
function unnamedInteractive(html: string): string[] {
  const problems: string[] = [];
  for (const match of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const [tag, attrs, inner] = [match[1], match[2], match[3]];
    if (/\baria-label=/.test(attrs) || /\baria-labelledby=/.test(attrs)) continue;
    const text = inner
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]*>/g, '')
      .trim();
    if (!text) problems.push(`<${tag}> without accessible name`);
  }
  return problems;
}

describe('a11y structural smoke checks (SSR, no browser)', () => {
  const html = renderPanel();
  const dialogueHtml = renderPanel('dialogue');

  it('exposes a skip link, a main landmark, header/nav landmarks and one h1', () => {
    expect(html).toContain('<a href="#main-content" class="skip-link">');
    expect(html).toContain('<main id="main-content"');
    expect(html).toContain('<header');
    expect(html).toContain('<nav aria-label="Work panels"');
    expect(html.match(/<h1\b/g) ?? []).toHaveLength(1);
    expect(collectIds(html).has('main-content')).toBe(true);
  });

  it('provides a polite live region for action feedback', () => {
    const feedback = dialogueHtml.match(/<div[^>]*\bclass="whitespace-pre-wrap[^"]*"[^>]*>/);
    expect(feedback).not.toBeNull();
    expect(feedback![0]).toContain('role="status"');
    expect(feedback![0]).toContain('aria-live="polite"');
  });

  it('resolves every aria-labelledby and aria-controls target in every panel', () => {
    for (const panel of [undefined, ...PANELS]) {
      expect(unresolvedAriaReferences(renderPanel(panel))).toEqual([]);
    }
  });

  it('gives every form control an accessible name in every panel', () => {
    for (const panel of [undefined, ...PANELS]) {
      expect(unlabelledControls(renderPanel(panel))).toEqual([]);
    }
  });

  it('gives every link and button an accessible name in every panel', () => {
    for (const panel of [undefined, ...PANELS]) {
      expect(unnamedInteractive(renderPanel(panel))).toEqual([]);
    }
  });
});
