import type { QueryClient } from '@tanstack/react-query';
import { configureAuth } from '@/api/httpClient';
import { sessionExpired } from '@/auth/authSlice';
import type { IdentityAdapter } from '@/auth/IdentityAdapter';
import { createQueryClient } from './queryClient';
import { createAppStore, type AppStore, type RootState } from './store';

export interface AppServices {
  store: AppStore;
  queryClient: QueryClient;
  identity: IdentityAdapter;
}

/**
 * Composition root: creates the store and query client and connects the HTTP client to the
 * identity adapter. Used by main.tsx and by tests, so both run the same wiring.
 */
export function createAppServices(options: {
  identity: IdentityAdapter;
  persistWorkspace?: boolean;
  autosaveDelayMs?: number;
  preloadedState?: Partial<RootState>;
}): AppServices {
  const queryClient = createQueryClient();
  const store = createAppStore({
    queryClient,
    persistWorkspace: options.persistWorkspace,
    autosaveDelayMs: options.autosaveDelayMs,
    preloadedState: options.preloadedState,
  });
  configureAuth({
    getAuthHeaders: () => options.identity.getAuthHeaders(),
    onUnauthorized: () => {
      const returnTo = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/';
      store.dispatch(sessionExpired({ returnTo }));
    },
  });
  return { store, queryClient, identity: options.identity };
}
