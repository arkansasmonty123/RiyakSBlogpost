import type {
  AIProvider,
  GenerateStructuredRequest,
  GenerateStructuredResult,
} from '../../shared/ai.js';

/** Explicit fallback: never pretends to be an LLM. */
export class DeterministicProvider implements AIProvider {
  readonly name = 'deterministic-fallback';
  readonly usesLLM = false;

  async generateStructured<T>(_request: GenerateStructuredRequest): Promise<GenerateStructuredResult<T>> {
    return {
      data: null,
      source: 'deterministic_fallback',
      error: 'No LLM provider configured; deterministic simulation is used.',
    };
  }
}

interface OpenAICompatibleConfig {
  url: string;
  apiKey: string;
  model: string;
}

/** OpenAI-compatible chat-completions provider (also works with local servers). */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string;
  readonly usesLLM = true;

  constructor(private readonly config: OpenAICompatibleConfig) {
    this.name = `openai-compatible:${config.model}`;
  }

  async generateStructured<T>(request: GenerateStructuredRequest): Promise<GenerateStructuredResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? 8000);
    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.2,
          think: false,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.prompt },
          ],
        }),
      });
      if (!response.ok) return { data: null, source: 'llm', error: `LLM HTTP ${response.status}` };
      const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        return { data: null, source: 'llm', error: 'LLM returned no content' };
      }
      try {
        return { data: JSON.parse(content) as T, source: 'llm' };
      } catch {
        return { data: null, source: 'llm', error: 'LLM returned malformed JSON' };
      }
    } catch (error) {
      return { data: null, source: 'llm', error: `LLM request failed: ${(error as Error).message}` };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** No key => labelled deterministic fallback. Gemini/local use OpenAI-compatible shape. */
export function createProvider(env: NodeJS.ProcessEnv = process.env): AIProvider {
  const provider = (env.LLM_PROVIDER ?? 'openai').toLowerCase();
  const apiKey =
    env.LLM_API_KEY ??
    env.OPENAI_API_KEY ??
    env.GEMINI_API_KEY ??
    env.GOOGLE_API_KEY ??
    (provider === 'local' || provider === 'ollama' ? 'ollama' : undefined);
  if (!apiKey) return new DeterministicProvider();
  const url =
    env.LLM_URL ??
    (provider === 'gemini'
      ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      : provider === 'local' || provider === 'ollama'
        ? 'http://127.0.0.1:11434/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions');
  const model =
    env.LLM_MODEL ??
    (provider === 'gemini'
      ? 'gemini-2.0-flash'
      : provider === 'local' || provider === 'ollama'
        ? 'qwen3.5:2b'
        : 'gpt-4o-mini');
  return new OpenAICompatibleProvider({ url, apiKey, model });
}
