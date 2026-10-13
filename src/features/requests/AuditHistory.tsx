import { useState } from 'react';
import { Box, Pagination, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '@/api/endpoints';
import { ErrorState } from '@/shared/components/ErrorState';
import { UserText } from '@/shared/components/UserText';
import { formatDateTime } from '@/shared/format';

const PAGE_SIZE = 5;

/** Audit history, loaded through the illustrative RPC adapter, paginated on the server. */
export function AuditHistory({ requestId }: { requestId: string }) {
  const [page, setPage] = useState(1);
  const audit = useQuery({
    queryKey: queryKeys.audit(requestId, page),
    queryFn: ({ signal }) => api.listAudit(requestId, page, PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
  });

  if (audit.error) return <ErrorState error={audit.error} title="Audit history unavailable" onRetry={() => void audit.refetch()} />;
  if (!audit.data) return <Skeleton variant="rectangular" height={160} />;

  const pages = Math.max(1, Math.ceil(audit.data.total / PAGE_SIZE));
  return (
    <Box sx={{ opacity: audit.isPlaceholderData ? 0.6 : 1 }}>
      <Table size="small" aria-label="Audit history">
        <TableHead>
          <TableRow>
            <TableCell>When</TableCell>
            <TableCell>Who</TableCell>
            <TableCell>What</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {audit.data.items.map((e) => (
            <TableRow key={e.eventId}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.at)}</TableCell>
              <TableCell>{e.actor}</TableCell>
              <TableCell>
                <UserText text={e.summary} variant="body2" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {audit.data.total} events · via RPC adapter
        </Typography>
        {pages > 1 && <Pagination size="small" count={pages} page={page} onChange={(_e, p) => setPage(p)} aria-label="Audit pages" />}
      </Box>
    </Box>
  );
}
