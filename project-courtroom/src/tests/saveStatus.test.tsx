import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DraftStatusMessage,
  SaveConflictNotice,
  SaveNoticeMessage,
  SaveStatusMessage,
  saveStatusFromResult,
} from '@/app/App';
import { isSaveConflict, SAVE_CONFLICT_REASON } from '@/storage/save';

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

  it('stays silent for a conflict because the conflict notice carries its own actions', () => {
    expect(renderToString(<SaveStatusMessage status="conflict" />)).toBe('');
  });
});

describe('save conflict status mapping', () => {
  it('recognises only explicit conflict results', () => {
    expect(isSaveConflict({ ok: false, reason: SAVE_CONFLICT_REASON, conflict: true })).toBe(true);
    expect(isSaveConflict({ ok: false, reason: SAVE_CONFLICT_REASON })).toBe(true);
    expect(isSaveConflict({ ok: false, reason: 'HTTP_409' })).toBe(false);
    expect(isSaveConflict({ ok: false, reason: 'SAVE_FAILED' })).toBe(false);
    expect(isSaveConflict({ ok: true })).toBe(false);
  });

  it('maps conflicts to the action prompt on the async path only', () => {
    const conflict = { ok: false, reason: SAVE_CONFLICT_REASON, conflict: true };
    expect(saveStatusFromResult(conflict, false)).toEqual({ status: 'conflict', conflict: true });
    expect(saveStatusFromResult(conflict, true)).toEqual({ status: 'error', conflict: false });
    expect(saveStatusFromResult({ ok: true }, false)).toEqual({ status: 'saved', conflict: false });
    expect(saveStatusFromResult({ ok: false, reason: 'SAVE_FAILED' }, false)).toEqual({
      status: 'error',
      conflict: false,
    });
  });
});

describe('save conflict notice', () => {
  it('offers non-destructive reload/overwrite actions in an assertive live region', () => {
    const html = renderToString(<SaveConflictNotice onReload={() => {}} onOverwrite={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('Another copy of this case file was saved');
    expect(html).toContain('Nothing has been overwritten');
    expect(html).toContain('>Reload from server</button>');
    expect(html).toContain('>Overwrite server save</button>');
    expect(html).toContain('aria-label="Resolve save conflict"');
    expect(html.toLowerCase()).not.toContain('canonicaltruth');
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
