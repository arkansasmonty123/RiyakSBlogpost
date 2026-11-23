import { describe, expect, it, vi } from 'vitest';
import { LOCAL_AI_PROVIDER_ID, LOCAL_AI_PROVIDER_META } from '@/domain/ai/provider';
import {
  createLlamaServerProvider,
  DEFAULT_LOCAL_LLM_TIMEOUT_MS,
  LOCAL_LLM_ENDPOINT,
} from '@/services/ai/llamaServerProvider';
import type { ProviderMessage, ProviderRequest } from '@/domain/ai/provider';

interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

function jsonResponse(data: unknown, opts: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: async () => data,
  } as unknown as Response;
}

function request(messages: ProviderMessage[], init: Partial<ProviderRequest> = {}): ProviderRequest {
  return { messages, maxTokens: 64, temperature: 0.2, ...init };
}

const USER = (content: string): ProviderMessage => ({ role: 'user', content });

describe('local provider abstraction', () => {
  it('exposes stable local-only metadata and a bounded default timeout', () => {
    expect(LOCAL_AI_PROVIDER_ID).toBe('local-llama-server');
    expect(LOCAL_AI_PROVIDER_META.endpoint).toBe('/api/local-llm');
    expect(LOCAL_LLM_ENDPOINT).toBe(LOCAL_AI_PROVIDER_META.endpoint);
    expect(DEFAULT_LOCAL_LLM_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('sends a bounded chat-completions envelope to the proxy and returns the text', async () => {
    const calls: Array<{ url: string; init: FetchInit }> = [];
    const fetchFn = vi.fn(async (url: string, init: FetchInit) => {
      calls.push({ url, init });
      return jsonResponse({ choices: [{ message: { content: 'A neutral answer.' } }] });
    }) as unknown as typeof fetch;

    const provider = createLlamaServerProvider({ fetchFn });
    expect(provider.id).toBe(LOCAL_AI_PROVIDER_ID);
    expect(provider.label).toBe(LOCAL_AI_PROVIDER_META.label);
    const result = await provider.generate(request([USER('Draft a neutral question.')]));

    expect(result).toEqual({ ok: true, text: 'A neutral answer.' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/local-llm');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body ?? '{}')).toEqual({
      messages: [{ role: 'user', content: 'Draft a neutral question.' }],
      max_tokens: 64,
      temperature: 0.2,
    });
  });

  it('passes through multiple system context messages in order', async () => {
    let body = '';
    const fetchFn = vi.fn(async (_url: string, init: FetchInit) => {
      body = init.body ?? '';
      return jsonResponse({ choices: [{ message: { content: 'ok' } }] });
    }) as unknown as typeof fetch;

    await createLlamaServerProvider({ fetchFn }).generate(
      request([
        { role: 'system', content: 'base rules' },
        { role: 'system', content: 'NON-AUTHORITATIVE internal summary' },
        USER('question'),
      ]),
    );
    const messages = (JSON.parse(body) as { messages: ProviderMessage[] }).messages;
    expect(messages.map((m) => m.role)).toEqual(['system', 'system', 'user']);
    expect(messages[1].content).toContain('NON-AUTHORITATIVE');
  });

  it('maps transport and shape failures to stable codes without throwing', async () => {
    const http = createLlamaServerProvider({
      fetchFn: vi.fn(async () => jsonResponse({}, { ok: false, status: 503 })) as unknown as typeof fetch,
    });
    expect(await http.generate(request([USER('hi')]))).toMatchObject({ ok: false, code: 'http' });

    const malformedJson = {
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad json');
      },
    } as unknown as Response;
    const badJson = createLlamaServerProvider({
      fetchFn: vi.fn(async () => malformedJson) as unknown as typeof fetch,
    });
    expect(await badJson.generate(request([USER('hi')]))).toMatchObject({ ok: false, code: 'invalid-response' });

    const badShape = createLlamaServerProvider({
      fetchFn: vi.fn(async () => jsonResponse({ nope: true })) as unknown as typeof fetch,
    });
    expect(await badShape.generate(request([USER('hi')]))).toMatchObject({ ok: false, code: 'invalid-response' });

    const empty = createLlamaServerProvider({
      fetchFn: vi.fn(async () =>
        jsonResponse({ choices: [{ message: { content: '  ' } }] }),
      ) as unknown as typeof fetch,
    });
    expect(await empty.generate(request([USER('hi')]))).toMatchObject({ ok: false, code: 'empty-response' });

    const offline = createLlamaServerProvider({
      fetchFn: vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
    });
    expect(await offline.generate(request([USER('hi')]))).toMatchObject({ ok: false, code: 'unavailable' });
  });

  it('aborts on timeout and on external cancellation', async () => {
    const hang = ((_url: string, init: FetchInit) => {
      if (init.signal?.aborted) return Promise.reject(new Error('aborted'));
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    }) as unknown as typeof fetch;

    expect(
      await createLlamaServerProvider({ fetchFn: hang, timeoutMs: 5 }).generate(request([USER('hi')])),
    ).toMatchObject({
      ok: false,
      code: 'timeout',
    });

    const controller = new AbortController();
    controller.abort();
    expect(
      await createLlamaServerProvider({ fetchFn: hang, timeoutMs: 1000 }).generate(
        request([USER('hi')], { signal: controller.signal }),
      ),
    ).toMatchObject({ ok: false, code: 'unavailable' });
  });
});
