/**
 * The only module that reads `import.meta.env` (Vite). Jest maps this module to
 * `src/test/env.jest.ts`, so the rest of the code base stays bundler-agnostic.
 */
export const env = {
  apiMode: (import.meta.env.VITE_API_MODE ?? 'mock') as 'mock' | 'http',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  demoLocalPersistence: (import.meta.env.VITE_DEMO_LOCAL_PERSISTENCE ?? 'true') === 'true',
  demoSessionMinutes: Number(import.meta.env.VITE_DEMO_SESSION_MINUTES ?? '20'),
  isDev: import.meta.env.DEV,
  baseUrl: import.meta.env.BASE_URL,
};
