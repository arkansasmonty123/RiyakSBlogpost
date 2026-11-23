import { afterEach, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App, RetrievedSourcesNotice } from '@/app/App';
import { createResetUiState } from '@/app/sessionUi';
import type { RetrievedSource } from '@/domain/ai/retrieval';
import { isLocalAiPanelEnabled } from '@/config/env';
import { createInitialSave } from '@/domain/seed';

const globals = globalThis as { window?: unknown };
const previousWindow = globals.window;

afterEach(() => {
  globals.window = previousWindow;
});

/** Browser-free SSR render of the experimental panel with an isolated memory save. */
function renderAiPanel(): string {
  const data: Record<string, string> = {};
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
  return renderToString(<App initialPanel="ai" />).replace(/<!-- -->/g, '');
}

describe('Local AI Lab panel', () => {
  it('renders clear non-authoritative / local-only disclaimers', () => {
    const html = renderAiPanel();
    expect(html).toContain('Local AI Lab');
    expect(html).toContain('Experimental');
    expect(html).toContain('not legal advice');
    expect(html).toContain('may be unavailable');
    expect(html).toContain('/tmp');
    expect(html).toContain('hidden case truth is never provided');
  });

  it('disables the ask button for an empty prompt and bounds the textarea', () => {
    const html = renderAiPanel();
    expect(html).toContain('id="local-ai-prompt"');
    expect(html).toMatch(/max[Ll]ength="2000"/);
    expect(html).toMatch(/<button[^>]*\bdisabled\b[^>]*>Ask local model<\/button>/);
  });

  it('never renders canonical truth, hidden motives or authenticity in the panel markup', () => {
    const html = renderAiPanel().toLowerCase();
    for (const marker of [
      'canonicaltruth',
      'hiddenmotives',
      'actualtimeline',
      'evidenceauthenticity',
      'responsibleparties',
      'a portion of the phone recording was removed',
      'witness had prior dispute',
    ]) {
      expect(html).not.toContain(marker);
    }
  });

  it('starts with all local-AI state blank on reset', () => {
    const fresh = createResetUiState(createInitialSave());
    expect(fresh.aiPrompt).toBe('');
    expect(fresh.aiResponse).toBe('');
    expect(fresh.aiWarnings).toEqual([]);
    expect(fresh.aiError).toBe('');
    expect(fresh.aiIncludeInternalSummaries).toBe(false);
    expect(fresh.aiSources).toEqual([]);
    expect(fresh.aiAssistSeniorReview).toBe(false);
    expect(fresh.aiReviewNotice).toBe('');
    expect(fresh.aiReviewSources).toEqual([]);
  });

  it('shows the local provider, request status and the opt-in summaries toggle', () => {
    const html = renderAiPanel();
    expect(html).toContain('Provider: ');
    expect(html).toContain('Local llama-server (llama.cpp)');
    expect(html).toContain('/api/local-llm');
    expect(html).toContain('Status: idle');
    expect(html).toContain('Include approved internal legal summaries (non-authoritative)');
    expect(html).toContain('type="checkbox"');
  });

  it('renders retrieved source provenance with a non-authoritative label', () => {
    const sources: RetrievedSource[] = [
      {
        id: 'ls-4',
        title: 'Evidence handling principle (educational summary)',
        provenance: 'Internal educational summary for prototype gameplay; not legal advice.',
        context: 'NON-AUTHORITATIVE internal summary',
      },
    ];
    const html = renderToString(<RetrievedSourcesNotice sources={sources} />);
    expect(html).toContain('Retrieved internal sources (non-authoritative)');
    expect(html).toContain('ls-4');
    expect(html).toContain('Internal educational summary for prototype gameplay');
    expect(html).toContain('not legal authority');
    expect(renderToString(<RetrievedSourcesNotice sources={[]} />)).toBe('');
  });

  it('honours the env-aware feature flag', () => {
    expect(isLocalAiPanelEnabled({})).toBe(true);
    expect(isLocalAiPanelEnabled({ VITE_ENABLE_LOCAL_AI: 'true' })).toBe(true);
    expect(isLocalAiPanelEnabled({ VITE_ENABLE_LOCAL_AI: 'false' })).toBe(false);
    expect(isLocalAiPanelEnabled({ VITE_ENABLE_LOCAL_AI: 'FALSE' })).toBe(false);
  });
});
