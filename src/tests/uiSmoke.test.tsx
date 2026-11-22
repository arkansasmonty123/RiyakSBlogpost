import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '@/app/App';

/**
 * Lightweight UI smoke checks: render the real component tree in Node so a runtime
 * crash or accidental canonical-truth projection fails CI. (No browser binary here.)
 */
describe('App render smoke test', () => {
  // React SSR inserts `<!-- -->` separators between adjacent text nodes.
  const html = renderToString(<App />).replace(/<!-- -->/g, '');
  const researchHtml = renderToString(<App initialPanel="research" />).replace(/<!-- -->/g, '');

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

  it('renders source provenance, verification badges and the Source Intake workflow', () => {
    expect(researchHtml).toContain('Source Intake');
    expect(researchHtml).toContain('Add Source / Source Intake');
    expect(researchHtml).toContain('PLACEHOLDER — NOT AUTHORITATIVE');
    expect(researchHtml).toContain('VERIFIED');
    expect(researchHtml).toContain('Provenance (non-authoritative note)');
    expect(researchHtml).toContain('Warning: not verified. Do not cite this source as law.');
    expect(researchHtml).toContain('NON-AUTHORITATIVE EXCERPT/SUMMARY');
    expect(researchHtml).toContain('Source Intake creates drafts only');
    expect(researchHtml).toContain('Citation / identifier:');
  });

  it('never presents fabricated provisions or judgments as verified in the research panel', () => {
    const lower = researchHtml.toLowerCase();
    for (const forbidden of ['section 302', 'section 101', 'air 19', ' v. ', 'verified judgment']) {
      expect(lower).not.toContain(forbidden);
    }
    for (const forbidden of ['canonicaltruth', 'actualevents', 'hiddenmotives', 'evidenceauthenticity', 'prior dispute', '18:12']) {
      expect(lower).not.toContain(forbidden);
    }
  });
});
