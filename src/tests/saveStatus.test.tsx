import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SaveStatusMessage } from '@/app/App';

describe('save status message', () => {
  it('stays silent until a save is attempted', () => {
    expect(renderToString(<SaveStatusMessage status="idle" />)).toBe('');
  });

  it('announces successful saves with a polite live region', () => {
    const html = renderToString(<SaveStatusMessage status="saved" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Progress saved locally.');
  });

  it('announces persistence failure without exposing storage internals', () => {
    const html = renderToString(<SaveStatusMessage status="error" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Progress is in memory but could not be saved locally.');
    expect(html.toLowerCase()).not.toContain('quotaexceeded');
  });
});
