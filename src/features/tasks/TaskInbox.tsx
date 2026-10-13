import { useNavigate } from 'react-router';
import { Button, Chip, Paper, Skeleton, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '@/api/endpoints';
import { ErrorState } from '@/shared/components/ErrorState';
import { PageHeader } from '@/shared/components/PageHeader';
import { formatDateTime } from '@/shared/format';

export default function TaskInbox() {
  const navigate = useNavigate();
  const tasks = useQuery({ queryKey: queryKeys.tasks(), queryFn: ({ signal }) => api.listTasks(signal) });

  return (
    <>
      <PageHeader title="Task inbox" subtitle="Workflow tasks assigned to you by the (simulated) process engine." />
      {tasks.error ? (
        <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : !tasks.data ? (
        <Skeleton variant="rectangular" height={200} />
      ) : (
        <Paper>
          <Table aria-label="Assigned tasks">
            <TableHead>
              <TableRow>
                <TableCell>Task</TableCell>
                <TableCell>Request</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Review level</TableCell>
                <TableCell>Created</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {tasks.data.map((t) => (
                <TableRow key={t.taskId} hover>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>{t.requestId}</TableCell>
                  <TableCell>{t.clientName}</TableCell>
                  <TableCell>
                    <Chip size="small" color={t.reviewLevel === 'SENIOR' ? 'warning' : 'default'} label={t.reviewLevel.toLowerCase()} />
                  </TableCell>
                  <TableCell>{formatDateTime(t.createdAt)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="contained" onClick={() => navigate(`/tasks/${t.taskId}`)} aria-label={`Open task ${t.taskId}`}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {tasks.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>No open tasks. Submit a request as the Client Advisor to create one.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
    </>
  );
}
