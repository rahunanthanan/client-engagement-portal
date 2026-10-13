import { useNavigate } from 'react-router';
import { Button, Chip, Paper, Skeleton, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '@/api/endpoints';
import { ErrorState } from '@/shared/components/ErrorState';
import { PageHeader } from '@/shared/components/PageHeader';
import { formatDateTime } from '@/shared/format';
import { KIND_LABELS } from './kindLabels';


export default function DefinitionsAdmin() {
  const navigate = useNavigate();
  const defs = useQuery({ queryKey: queryKeys.definitions(), queryFn: ({ signal }) => api.listDefinitions(signal) });

  return (
    <>
      <PageHeader title="Definitions" subtitle="Approved definitions drive forms, workflow and decisions. Edits stay drafts until approved." />
      {defs.error ? (
        <ErrorState error={defs.error} onRetry={() => void defs.refetch()} />
      ) : !defs.data ? (
        <Skeleton variant="rectangular" height={240} />
      ) : (
        <Paper>
          <Table aria-label="Definitions">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Kind</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {defs.data.map((d) => (
                <TableRow key={`${d.kind}-${d.definitionId}`} hover>
                  <TableCell>
                    {d.name}
                    <br />
                    <small>{d.definitionId}</small>
                  </TableCell>
                  <TableCell>{KIND_LABELS[d.kind]}</TableCell>
                  <TableCell>v{d.version}</TableCell>
                  <TableCell>
                    <Chip size="small" color={d.status === 'APPROVED' ? 'success' : 'warning'} label={d.status.toLowerCase()} />
                  </TableCell>
                  <TableCell>
                    {formatDateTime(d.updatedAt)} · {d.updatedBy}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => navigate(`/admin/${d.kind}/${encodeURIComponent(d.definitionId)}`)}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </>
  );
}
