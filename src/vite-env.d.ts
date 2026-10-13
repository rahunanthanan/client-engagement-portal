/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEMO_LOCAL_PERSISTENCE?: string;
  readonly VITE_DEMO_SESSION_MINUTES?: string;
}
