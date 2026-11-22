import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '@/app/App';

/**
 * Lightweight UI smoke check: renders the real component tree in Node so a runtime
 * crash or accidental canonical-truth projection fails CI. (No browser binary here.)
 */
describe('App render smoke test', () => {
  // React SSR inserts `<!-- -->` separators between adjacent text nodes.
  const html = renderToString(<App />).replace(/<!-- -->/g, '');

  it('renders the prototype shell, day clock and current objective', () => {
    expect(html).toContain('THE BAR');
    expect(html).toContain('Current objective');
    expect(html).toContain('Initial fact matrix');
    expect(html).toContain('Day 1');
    expect(html).toContain('Advance time');
    expect(html).toContain('Senior Chamber');
  });

  it('does not render canonical case truth in the initial HTML', () => {
    const lower = html.toLowerCase();
    for (const forbidden of ['canonicaltruth', 'actualevents', 'hiddenmotives', 'evidenceauthenticity', 'prior dispute', '18:12']) {
      expect(lower).not.toContain(forbidden);
    }
  });
});
