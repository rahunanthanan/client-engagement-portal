import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Box, Button, Pagination, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { RequestStatus } from '@/api/contracts';
import { api, queryKeys } from '@/api/endpoints';
import { usePermission } from '@/auth/usePermission';
import { ErrorState } from '@/shared/components/ErrorState';
import { StatusChip } from '@/shared/components/StatusChip';
import { formatDateTime } from '@/shared/format';

const PAGE_SIZE = 5;

export function RequestList({ title, status }: { title: string; status?: RequestStatus | 'OPEN_DRAFTS' }) {
  const navigate = useNavigate();
  const canEdit = usePermission('request:edit');
  const [page, setPage] = useState(1);
  const params = { page, pageSize: PAGE_SIZE, status, mine: true };
  const list = useQuery({
    queryKey: queryKeys.requests(params),
    queryFn: ({ signal }) => api.listRequests(params, signal),
    placeholderData: keepPreviousData,
  });

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h2" gutterBottom>
        {title}
      </Typography>
      {list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <Table size="small" aria-label={title}>
          <TableHead>
            <TableRow>
              <TableCell>Request</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.data?.items.map((r) => {
              const editable = canEdit && (r.status === 'DRAFT' || r.status === 'RETURNED');
              return (
                <TableRow key={r.requestId} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.requestId}</TableCell>
                  <TableCell>{r.clientName}</TableCell>
                  <TableCell>{r.requestTypeLabel}</TableCell>
                  <TableCell>
                    <StatusChip status={r.status} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.updatedAt)}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => navigate(editable ? `/workspace/${r.requestId}` : `/requests/${r.requestId}`)}
                      aria-label={`${editable ? 'Open draft' : 'View'} ${r.requestId}`}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      {editable ? 'Open draft' : 'View'}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {list.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>Nothing here yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      {pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Pagination size="small" count={pages} page={page} onChange={(_e, p) => setPage(p)} aria-label={`${title} pages`} />
        </Box>
      )}
    </Paper>
  );
}
