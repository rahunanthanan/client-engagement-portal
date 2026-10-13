import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  LinearProgress,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '@/api/endpoints';
import { usePermission } from '@/auth/usePermission';
import { ErrorState } from '@/shared/components/ErrorState';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

const PAGE_SIZE = 8;

/**
 * Smart client search: debounced input (no request per keystroke), one cache entry per
 * (query, page) so stale responses can never overwrite newer results, previous page kept visible
 * while the next loads, server-side pagination.
 */
export function ClientSearch() {
  const navigate = useNavigate();
  const canCreate = usePermission('request:create');
  const [input, setInput] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(input.trim(), 300);

  const results = useQuery({
    queryKey: queryKeys.clients(q, page),
    queryFn: ({ signal }) => api.searchClients(q, page, PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
  });

  const pages = results.data ? Math.max(1, Math.ceil(results.data.total / PAGE_SIZE)) : 1;
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h2" gutterBottom>
        Find a client
      </Typography>
      <TextField
        fullWidth
        size="small"
        label="Search by name or client ID"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setPage(1);
        }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
      />
      <Box sx={{ height: 4, mt: 1 }}>{results.isFetching && <LinearProgress aria-label="Searching" />}</Box>
      {results.error ? (
        <ErrorState error={results.error} title="Search failed" onRetry={() => void results.refetch()} />
      ) : (
        <>
          <Table size="small" aria-label="Client search results" data-testid="client-results" data-query={results.data ? q : ''}>
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Country</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.data?.items.map((c) => (
                <TableRow key={c.clientId} hover>
                  <TableCell>{c.displayName}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.clientId}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={c.clientType === 'CORPORATE' ? 'Corporate' : 'Individual'} />
                  </TableCell>
                  <TableCell>{c.countryCode}</TableCell>
                  <TableCell align="right">
                    {canCreate && (
                      <Button size="small" onClick={() => navigate(`/requests/new?clientId=${encodeURIComponent(c.clientId)}`)} aria-label={`Create request for ${c.displayName}`} sx={{ whiteSpace: 'nowrap' }}>
                        Create request
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {results.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>No clients match “{q}”.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
            <Typography variant="caption" color="text.secondary" role="status">
              {results.data ? `${results.data.total} fictional clients` : 'Loading…'}
            </Typography>
            {pages > 1 && <Pagination size="small" count={pages} page={page} onChange={(_e, p) => setPage(p)} aria-label="Client result pages" />}
          </Box>
        </>
      )}
    </Paper>
  );
}
