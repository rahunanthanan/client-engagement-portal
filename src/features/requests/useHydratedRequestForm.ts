import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RequestRecord } from '@/api/contracts';
import { api, queryKeys } from '@/api/endpoints';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { formInitialized } from '@/forms/engine/formsSlice';
import { hydrateFormWithDependencies } from '@/forms/engine/hydrateFormWithDependencies';
import type { FormSchema } from '@/forms/schema/types';

/**
 * Loads a request and the exact schema version it was created with, then hydrates the form
 * (defaults + stored values + dependent dropdown options) into the store under `formId`.
 *
 * Schema versions are immutable, so the schema query never goes stale.
 */
export function useHydratedRequestForm(requestId: string, formId: string, onHydrated?: (request: RequestRecord) => void) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const initialised = useAppSelector((s) => formId in s.forms);
  const [hydrationError, setHydrationError] = useState<unknown>(null);

  const request = useQuery({
    queryKey: queryKeys.request(requestId),
    queryFn: ({ signal }) => api.getRequest(requestId, signal),
  });
  const schemaId = request.data?.schemaId;
  const version = request.data?.schemaVersion;
  const schema = useQuery({
    queryKey: queryKeys.schema(schemaId ?? '', version ?? 0),
    queryFn: ({ signal }) => api.getFormSchema(schemaId!, version!, signal),
    enabled: !!schemaId && !!version,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  useEffect(() => {
    if (initialised || !request.data || !schema.data) return undefined;
    let cancelled = false;
    const record = request.data;
    const loadOptions = (lookup: string, parent: string | undefined) =>
      queryClient.fetchQuery({
        queryKey: queryKeys.lookup(lookup, parent),
        queryFn: ({ signal }) => api.getLookup(lookup, parent, signal),
        staleTime: 5 * 60_000,
      });
    hydrateFormWithDependencies(schema.data, record.values, loadOptions)
      .then((result) => {
        if (cancelled) return;
        dispatch(
          formInitialized({
            formId,
            schemaRef: { schemaId: record.schemaId, version: record.schemaVersion },
            values: result.values,
            warnings: result.warnings,
            context: {
              requestId: record.requestId,
              clientId: record.clientId,
              clientName: record.clientName,
              category: record.category,
              requestType: record.requestTypeLabel,
            },
          }),
        );
        onHydrated?.(record);
      })
      .catch((error: unknown) => {
        if (!cancelled) setHydrationError(error);
      });
    return () => {
      cancelled = true;
    };
    // onHydrated is intentionally excluded: it is a callback, not an input to hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialised, request.data, schema.data, formId, dispatch, queryClient]);

  return {
    request: request.data,
    schema: schema.data as FormSchema | undefined,
    initialised,
    isLoading: request.isPending || (!!request.data && schema.isPending) || (!initialised && !hydrationError && !request.error && !schema.error),
    error: request.error ?? schema.error ?? hydrationError,
    refetch: () => {
      void request.refetch();
      void schema.refetch();
      setHydrationError(null);
    },
  };
}
