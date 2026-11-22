import { describe, expect, it } from 'vitest';
import { config, DEFAULT_APP_NAME, loadConfig, MAX_APP_NAME_CHARS } from '@/config/env';

describe('typed env/config', () => {
  it('uses safe defaults with no env vars and no warnings', () => {
    const result = loadConfig({});
    expect(result.config).toEqual({
      appName: DEFAULT_APP_NAME,
      runtimeAiProvider: 'disabled',
      runtimeAiEndpoint: '',
    });
    expect(result.warnings).toEqual([]);
    expect(config).toEqual(result.config);
  });

  it('reads a valid app name and ignores blank/whitespace-only values', () => {
    expect(loadConfig({ VITE_APP_NAME: '  The Bar  ' }).config.appName).toBe('The Bar');
    const blank = loadConfig({ VITE_APP_NAME: '   ' });
    expect(blank.config.appName).toBe(DEFAULT_APP_NAME);
    expect(blank.warnings).toEqual([]);
  });

  it('caps an overlong app name with a warning', () => {
    const result = loadConfig({ VITE_APP_NAME: 'x'.repeat(MAX_APP_NAME_CHARS + 20) });
    expect(result.config.appName).toHaveLength(MAX_APP_NAME_CHARS);
    expect(result.warnings.some((w) => w.includes('truncated'))).toBe(true);
  });

  it('falls back to disabled for an unknown provider, without enabling AI', () => {
    const result = loadConfig({ VITE_RUNTIME_AI_PROVIDER: 'hosted' });
    expect(result.config.runtimeAiProvider).toBe('disabled');
    expect(result.config.runtimeAiEndpoint).toBe('');
    expect(result.warnings.some((w) => w.includes('unsupported'))).toBe(true);
  });

  it('never copies an API key into config or echoes it in warnings', () => {
    const secret = 'sk-super-secret-do-not-log';
    const result = loadConfig({
      VITE_RUNTIME_AI_PROVIDER: 'hosted',
      VITE_RUNTIME_AI_ENDPOINT: 'https://example.invalid/v1',
      VITE_RUNTIME_AI_API_KEY: secret,
    });
    expect(JSON.stringify(result.config)).not.toContain(secret);
    expect(JSON.stringify(result.warnings)).not.toContain(secret);
    expect(JSON.stringify(result.warnings)).not.toContain('example.invalid');
    expect(result.warnings.some((w) => w.includes('API_KEY'))).toBe(true);
  });
});
