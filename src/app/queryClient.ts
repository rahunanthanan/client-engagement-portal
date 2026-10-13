import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/api/httpClient';

/**
 * Server-state cache. Client errors (4xx) are never retried; transient failures get one retry at
 * the query layer (the HTTP client already retries 502/503/504 for safe calls).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && failureCount < 1,
      },
      mutations: { retry: false },
    },
  });
}
