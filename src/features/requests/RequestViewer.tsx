import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertTitle, Box, CircularProgress, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useAppDispatch } from '@/app/store';
import { DynamicForm } from '@/forms/components/DynamicForm';
import { formRemoved } from '@/forms/engine/formsSlice';
import { ErrorState } from '@/shared/components/ErrorState';
import { StatusChip } from '@/shared/components/StatusChip';
import { UserText } from '@/shared/components/UserText';
import { formatDateTime } from '@/shared/format';
import { AuditHistory } from './AuditHistory';
import { useHydratedRequestForm } from './useHydratedRequestForm';
import { WorkflowPanel } from './WorkflowPanel';

/**
 * Read-only view of a request: answers (same DynamicForm in read-only mode), workflow position,
 * decision outcome and audit history. Used for submitted requests and by the reviewer's task screen.
 */
export function RequestViewer({ requestId, revisionHint }: { requestId: string; revisionHint?: number }) {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState(0);
  // A separate form id per revision so the read-only copy never shares state with an editable tab.
  const formId = `view:${requestId}:${revisionHint ?? 'latest'}`;
  const { request, schema, initialised, isLoading, error, refetch } = useHydratedRequestForm(requestId, formId);

  useEffect(() => () => void dispatch(formRemoved({ formId })), [dispatch, formId]);

  const context = useMemo(
    () => (request ? { requestId: request.requestId, clientId: request.clientId, clientName: request.clientName, category: request.category, requestType: request.requestTypeLabel } : {}),
    [request],
  );

  if (error) return <ErrorState error={error} title="The request could not be loaded" onRetry={refetch} />;
  if (isLoading || !request || !schema) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress aria-label="Loading request" />
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h2">
              {request.clientName} · {request.requestTypeLabel}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {request.requestId} · form {request.schemaId} v{request.schemaVersion} · revision {request.revision} · updated {formatDateTime(request.updatedAt)} by{' '}
              {request.updatedBy}
            </Typography>
          </Box>
          <Box>
            <StatusChip status={request.status} />
          </Box>
        </Stack>
        {request.reviewerComment && (
          <Alert severity={request.status === 'REJECTED' ? 'error' : 'info'} sx={{ mt: 2 }}>
            <AlertTitle>Reviewer comment</AlertTitle>
            <UserText text={request.reviewerComment} variant="body2" data-testid="reviewer-comment" />
          </Alert>
        )}
      </Paper>
      <Tabs value={tab} onChange={(_e, v: number) => setTab(v)} aria-label="Request sections" sx={{ mb: 2 }}>
        <Tab label="Answers" id="viewer-tab-0" aria-controls="viewer-panel-0" />
        <Tab label="Workflow & decision" id="viewer-tab-1" aria-controls="viewer-panel-1" />
        <Tab label="Audit history" id="viewer-tab-2" aria-controls="viewer-panel-2" />
      </Tabs>
      <div role="tabpanel" id={`viewer-panel-${tab}`} aria-labelledby={`viewer-tab-${tab}`}>
        {tab === 0 && initialised && <DynamicForm formId={formId} schema={schema} context={context} readOnly />}
        {tab === 1 && <WorkflowPanel request={request} />}
        {tab === 2 && <AuditHistory requestId={requestId} />}
      </div>
    </Box>
  );
}
