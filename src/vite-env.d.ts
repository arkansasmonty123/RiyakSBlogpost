/// <reference types="vite/client" />

/** Known optional build-time variables (see src/config/env.ts and .env.example). */
interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_RUNTIME_AI_PROVIDER?: string;
  readonly VITE_RUNTIME_AI_ENDPOINT?: string;
  readonly VITE_RUNTIME_AI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
