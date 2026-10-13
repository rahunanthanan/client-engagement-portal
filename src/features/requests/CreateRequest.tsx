import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Alert, Autocomplete, Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientSummary, RequestRecord } from '@/api/contracts';
import { api, queryKeys } from '@/api/endpoints';
import { describeError, newCorrelationId } from '@/api/httpClient';
import { ErrorState } from '@/shared/components/ErrorState';
import { PageHeader } from '@/shared/components/PageHeader';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

/**
 * Step 1 of the journey: choose client, request category and request type. The type determines the
 * versioned schema. Creating the request returns a stable server id that names the workspace tab.
 */
export default function CreateRequest() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const presetClientId = params.get('clientId');

  const [client, setClient] = useState<ClientSummary | null>(null);
  const [clientInput, setClientInput] = useState('');
  const [category, setCategory] = useState('');
  const [requestType, setRequestType] = useState('');
  // One idempotency key per creation intent: a double click or retry can never create two requests.
  const [idempotencyKey, setIdempotencyKey] = useState(() => `create-${newCorrelationId()}`);

  const preset = useQuery({
    queryKey: queryKeys.client(presetClientId ?? ''),
    queryFn: ({ signal }) => api.getClient(presetClientId!, signal),
    enabled: !!presetClientId,
  });
  const selectedClient = client ?? preset.data ?? null;

  const q = useDebouncedValue(clientInput.trim(), 300);
  const clientOptions = useQuery({
    queryKey: queryKeys.clients(q, 1),
    queryFn: ({ signal }) => api.searchClients(q, 1, 10, signal),
    enabled: q.length >= 2,
  });
  const catalog = useQuery({ queryKey: queryKeys.catalog(), queryFn: ({ signal }) => api.getCatalog(signal), staleTime: 10 * 60_000 });

  const types = useMemo(
    () => catalog.data?.find((c) => c.category === category)?.types.filter((t) => !selectedClient || t.clientTypes.includes(selectedClient.clientType)) ?? [],
    [catalog.data, category, selectedClient],
  );
  const selectedType = types.find((t) => t.requestType === requestType);

  const create = useMutation({
    mutationFn: () => api.createRequest({ clientId: selectedClient!.clientId, category, requestType }, idempotencyKey),
    onSuccess: (record) => {
      queryClient.setQueryData<RequestRecord>(queryKeys.request(record.requestId), record);
      void queryClient.invalidateQueries({ queryKey: ['requests', 'list'] });
      navigate(`/workspace/${record.requestId}`);
    },
  });

  const changeSelection = (fn: () => void) => {
    fn();
    setIdempotencyKey(`create-${newCorrelationId()}`);
  };

  if (catalog.error) return <ErrorState error={catalog.error} title="Request types could not be loaded" onRetry={() => void catalog.refetch()} />;

  return (
    <Box sx={{ maxWidth: 720 }}>
      <PageHeader title="Create request" subtitle="Choose the client and what they need. The form loads after the request is created." />
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Autocomplete
            options={clientOptions.data?.items ?? []}
            value={selectedClient}
            onChange={(_e, value) => changeSelection(() => {
              setClient(value);
              setRequestType('');
            })}
            inputValue={clientInput}
            onInputChange={(_e, value) => setClientInput(value)}
            getOptionLabel={(o) => `${o.displayName} (${o.clientId})`}
            isOptionEqualToValue={(a, b) => a.clientId === b.clientId}
            filterOptions={(x) => x}
            loading={clientOptions.isFetching}
            noOptionsText={q.length < 2 ? 'Type at least 2 characters' : 'No clients found'}
            renderInput={(p) => <TextField {...p} label="Client" required size="small" />}
          />
          {selectedClient && (
            <Stack direction="row" spacing={1}>
              <Chip label={selectedClient.clientType === 'CORPORATE' ? 'Corporate' : 'Individual'} size="small" />
              <Chip label={selectedClient.segment} size="small" variant="outlined" />
              <Chip label={`RM: ${selectedClient.relationshipManager}`} size="small" variant="outlined" />
            </Stack>
          )}
          <TextField
            select
            label="Request category"
            value={category}
            onChange={(e) => changeSelection(() => {
              setCategory(e.target.value);
              setRequestType('');
            })}
            required
            size="small"
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          >
            <option value="">Select…</option>
            {catalog.data?.map((c) => (
              <option key={c.category} value={c.category}>
                {c.label}
              </option>
            ))}
          </TextField>
          <TextField
            select
            label="Request type"
            value={requestType}
            onChange={(e) => changeSelection(() => setRequestType(e.target.value))}
            required
            disabled={!category}
            helperText={category && types.length === 0 ? 'No request types in this category apply to the selected client.' : 'Only types valid for the client type are listed.'}
            size="small"
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          >
            <option value="">Select…</option>
            {types.map((t) => (
              <option key={t.requestType} value={t.requestType}>
                {t.label}
              </option>
            ))}
          </TextField>
          {selectedType && (
            <Typography variant="body2" color="text.secondary">
              Uses form schema <strong>{selectedType.schemaId}</strong> version {selectedType.latestVersion}.
            </Typography>
          )}
          {create.error && <Alert severity="error" role="alert">{describeError(create.error)}</Alert>}
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={!selectedClient || !selectedType || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Creating…' : 'Start request'}
            </Button>
            <Button onClick={() => navigate(-1)}>Cancel</Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
