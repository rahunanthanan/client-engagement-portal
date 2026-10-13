import { useOptimistic, useState, useTransition } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Alert, Box, Button, Chip, Paper, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RequestRecord, TaskAction, TaskRecord } from '@/api/contracts';
import { api, queryKeys } from '@/api/endpoints';
import { describeError, isApiError, newCorrelationId } from '@/api/httpClient';
import { noticeShown } from '@/app/uiSlice';
import { useAppDispatch } from '@/app/store';
import { usePermission } from '@/auth/usePermission';
import { RequestViewer } from '@/features/requests/RequestViewer';
import { ErrorState } from '@/shared/components/ErrorState';
import { PageHeader } from '@/shared/components/PageHeader';

const ACTION_LABELS: Record<TaskAction, string> = { APPROVE: 'Approve', RETURN: 'Return to advisor', REJECT: 'Reject' };

export default function TaskDetail() {
  const { taskId = '' } = useParams();
  const task = useQuery({ queryKey: queryKeys.task(taskId), queryFn: ({ signal }) => api.getTask(taskId, signal) });

  if (task.error) return <ErrorState error={task.error} title="Task could not be loaded" onRetry={() => void task.refetch()} />;
  if (!task.data) return <Skeleton variant="rectangular" height={300} />;
  return (
    <>
      <PageHeader title={task.data.name} subtitle={`${task.data.taskId} · ${task.data.requestId} · ${task.data.clientName}`} />
      {task.data.status === 'OPEN' ? <TaskActions task={task.data} /> : <Alert severity="success" sx={{ mb: 2 }}>This task is completed.</Alert>}
      <RequestViewer requestId={task.data.requestId} />
    </>
  );
}

/**
 * Task completion. NEW LEARNING (React 19): `useOptimistic` shows the pending outcome immediately
 * while the transition runs; it reverts automatically if the server rejects the action.
 */
function TaskActions({ task }: { task: TaskRecord }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canAct = usePermission('task:act');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useOptimistic<string | null>(null);
  const [intentKey, setIntentKey] = useState(() => newCorrelationId());

  const act = (action: TaskAction) => {
    setError(null);
    startTransition(async () => {
      setOptimisticStatus(`${ACTION_LABELS[action]}…`);
      try {
        const updated = await api.completeTask(task.taskId, { action, comment, taskVersion: task.version }, `task-${action}-${intentKey}`);
        queryClient.setQueryData<RequestRecord>(queryKeys.request(updated.requestId), updated);
        await queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
        dispatch(noticeShown({ severity: 'success', message: `${task.requestId}: ${ACTION_LABELS[action].toLowerCase()} recorded.` }));
        navigate('/tasks');
      } catch (e) {
        setIntentKey(newCorrelationId());
        if (isApiError(e) && e.status === 403) void queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
        setError({ message: isApiError(e) && (e.status === 403 || e.status === 409 || e.status === 422) ? e.message : describeError(e), field: e && isApiError(e) ? Object.keys(e.fieldErrors ?? {})[0] : undefined });
      }
    });
  };

  if (!canAct) return <Alert severity="info">You can view this task but not complete it.</Alert>;
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
        <Typography variant="h3">Decision</Typography>
        <Chip size="small" color={task.reviewLevel === 'SENIOR' ? 'warning' : 'default'} label={`${task.reviewLevel.toLowerCase()} review`} />
        {optimisticStatus && <Chip size="small" color="info" label={optimisticStatus} data-testid="optimistic-status" />}
      </Stack>
      <TextField
        label="Comment"
        multiline
        minRows={2}
        fullWidth
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        error={error?.field === 'comment'}
        helperText={task.reviewLevel === 'SENIOR' ? 'Senior review: a comment (10+ characters) is required for every outcome.' : 'Required when returning or rejecting.'}
        slotProps={{ htmlInput: { maxLength: 2000 } }}
      />
      {error && (
        <Alert severity="error" role="alert" sx={{ mt: 1 }}>
          {error.message}
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" color="success" disabled={isPending} onClick={() => act('APPROVE')}>
          Approve
        </Button>
        <Button variant="outlined" disabled={isPending} onClick={() => act('RETURN')}>
          Return to advisor
        </Button>
        <Button variant="outlined" color="error" disabled={isPending} onClick={() => act('REJECT')}>
          Reject
        </Button>
      </Box>
    </Paper>
  );
}
