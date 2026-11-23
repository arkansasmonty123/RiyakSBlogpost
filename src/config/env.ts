/**
 * Typed, validated configuration for the P0 prototype.
 *
 * Only VITE_* build-time values are read. They are optional: the app boots with safe
 * defaults and no secrets. Runtime AI is intentionally disabled in P0, so provider,
 * endpoint and key values can never enable a network/model path here. The separate
 * experimental local-AI lab (Phase 6 foundations) is opt-out via VITE_ENABLE_LOCAL_AI
 * and is handled by `isLocalAiPanelEnabled` below, not by the runtime provider config.
 */

export type RuntimeAiProvider = 'disabled';

export interface AppConfig {
  appName: string;
  /** The only supported value in P0; anything else is rejected with a warning. */
  runtimeAiProvider: RuntimeAiProvider;
  /** Always empty while runtime AI is disabled; reserved for a future Phase 6 adapter. */
  runtimeAiEndpoint: string;
}

export interface ConfigResult {
  config: AppConfig;
  warnings: string[];
}

/** The subset of Vite's `import.meta.env` this module reads (all values are strings). */
export type StorageMode = 'local' | 'sqlite-api';

export interface EnvSource {
  VITE_APP_NAME?: string;
  VITE_RUNTIME_AI_PROVIDER?: string;
  VITE_RUNTIME_AI_ENDPOINT?: string;
  VITE_RUNTIME_AI_API_KEY?: string;
  /** Experimental local-AI lab: set to "false" to hide the panel. Never a secret. */
  VITE_ENABLE_LOCAL_AI?: string;
  /** Persistence adapter: "local" (default) or "sqlite-api" (ADR-001, requires db server). */
  VITE_STORAGE_MODE?: string;
}

export const DEFAULT_APP_NAME = 'THE BAR';
export const MAX_APP_NAME_CHARS = 80;

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function defaultEnvSource(): EnvSource {
  // Non-Vite contexts (e.g. a plain Node script) simply use all defaults.
  const env = (import.meta as { env?: EnvSource }).env;
  return env ?? {};
}

/**
 * Validate known values with safe defaults; never throws on malformed env input.
 *
 * A VITE_RUNTIME_AI_API_KEY is deliberately NOT copied into the config object: P0 has
 * no provider to use it, and keeping it out of config avoids it reaching logs/saves.
 * Only a generic warning is emitted, without echoing the value.
 */
export function loadConfig(source: EnvSource = defaultEnvSource()): ConfigResult {
  const warnings: string[] = [];

  const rawName = readString(source.VITE_APP_NAME);
  const appName = rawName ? rawName.slice(0, MAX_APP_NAME_CHARS) : DEFAULT_APP_NAME;
  if (rawName.length > MAX_APP_NAME_CHARS) {
    warnings.push(`VITE_APP_NAME was truncated to ${MAX_APP_NAME_CHARS} characters.`);
  }

  const rawProvider = readString(source.VITE_RUNTIME_AI_PROVIDER);
  if (rawProvider && rawProvider !== 'disabled') {
    warnings.push(`VITE_RUNTIME_AI_PROVIDER="${rawProvider}" is unsupported in P0; using "disabled".`);
  }
  const runtimeAiProvider: RuntimeAiProvider = 'disabled';

  if (readString(source.VITE_RUNTIME_AI_ENDPOINT)) {
    warnings.push('VITE_RUNTIME_AI_ENDPOINT is ignored because runtime AI is disabled.');
  }
  if (readString(source.VITE_RUNTIME_AI_API_KEY)) {
    warnings.push('VITE_RUNTIME_AI_API_KEY is ignored because runtime AI is disabled.');
  }

  return {
    config: { appName, runtimeAiProvider, runtimeAiEndpoint: '' },
    warnings,
  };
}

/** App-wide validated config; uses defaults when no env vars are provided. */
export const config: AppConfig = loadConfig().config;

/**
 * Phase 6 foundation: feature flag for the experimental Local AI Lab panel.
 *
 * Enabled by default (pragmatic for an opt-in-by-use lab in dev/preview); set
 * `VITE_ENABLE_LOCAL_AI=false` to hide it entirely. Kept out of `loadConfig` so the
 * P0 "runtime AI disabled" contract/obj shape stays unchanged. This flag never enables a
 * hosted provider or bundles a model: the panel only targets the local llama-server proxy.
 */
export function isLocalAiPanelEnabled(source: EnvSource = defaultEnvSource()): boolean {
  return readString(source.VITE_ENABLE_LOCAL_AI).toLowerCase() !== 'false';
}

/**
 * ADR-001: storage adapter selection. Defaults to localStorage for stability.
 * SQLite API mode requires the DB server/proxy and is opt-in until fully integrated.
 */
export function getStorageMode(source: EnvSource = defaultEnvSource()): StorageMode {
  return readString(source.VITE_STORAGE_MODE).toLowerCase() === 'sqlite-api' ? 'sqlite-api' : 'local';
}
