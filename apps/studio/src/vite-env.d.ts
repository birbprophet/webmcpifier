/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN: string;
  readonly VITE_DEMO_ORIGIN: string;
  readonly VITE_WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
