import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DraftStatusMessage, SaveNoticeMessage, SaveStatusMessage } from '@/app/App';

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

describe('draft and explicit-save status messages', () => {
  it('announces unsaved draft edits in a polite live region', () => {
    const html = renderToString(<DraftStatusMessage dirty />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Unsaved changes');
    expect(html).not.toContain('>Saved</span>');
  });

  it('shows Saved once the draft matches what was persisted', () => {
    const html = renderToString(<DraftStatusMessage dirty={false} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('>Saved</span>');
    expect(html).not.toContain('Unsaved changes');
  });

  it('stays silent until an explicit save, then confirms in place', () => {
    expect(renderToString(<SaveNoticeMessage notice="" />)).toBe('');
    const html = renderToString(<SaveNoticeMessage notice="Saved locally." />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Saved locally.');
  });
});
