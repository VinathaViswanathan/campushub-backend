/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute API base URL. Defaults to "/api/v1" (proxied to the backend by Vite). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
