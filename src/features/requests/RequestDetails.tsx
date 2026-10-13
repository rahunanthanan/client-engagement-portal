import { useMemo, useRef } from 'react';
import { Alert, AlertTitle, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from 'react-redux';
import type { RequestRecord, RevisionConflictDetails } from '@/api/contracts';
import { api, queryKeys } from '@/api/endpoints';
import { describeError, isApiError, newCorrelationId } from '@/api/httpClient';
import { noticeShown } from '@/app/uiSlice';
import { useAppDispatch, useAppSelector, type RootState } from '@/app/store';
import { usePermission } from '@/auth/usePermission';
import { DynamicForm } from '@/forms/components/DynamicForm';
import { visibleValuesOnly } from '@/forms/engine/formModel';
import { warningsDismissed } from '@/forms/engine/formsSlice';
import type { FormApi } from '@/forms/engine/useFormStateManager';
import { ErrorState } from '@/shared/components/ErrorState';
import { UserText } from '@/shared/components/UserText';
import { ConflictBanner } from '@/features/workspace/ConflictBanner';
import { saveDraft } from '@/features/workspace/draftSave';
import { editorSessionId } from '@/features/workspace/editorSession';
import { SaveStatusIndicator } from '@/features/workspace/SaveStatusIndicator';
import { saveConflicted, submitFinished, submitStarted, tabHydrated } from '@/features/workspace/workspaceSlice';
import { RequestViewer } from './RequestViewer';
import { useHydratedRequestForm } from './useHydratedRequestForm';

const EDITABLE = new Set(['DRAFT', 'RETURNED']);

/**
 * Editable request inside a workspace tab: dynamic form + save/validate/submit.
 * Submitted requests switch the tab to the read-only RequestViewer.
 */
export function RequestDetails({ requestId }: { requestId: string }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const store = useStore<RootState>();
  const formApi = useRef<FormApi>(null);
  const tab = useAppSelector((s) => s.workspace.tabs[requestId]);
  const warnings = useAppSelector((s) => s.forms[requestId]?.warnings);
  const canSubmit = usePermission('request:submit');

  const { request, schema, initialised, isLoading, error, refetch } = useHydratedRequestForm(requestId, requestId, (record) =>
    dispatch(
      tabHydrated({
        requestId,
        revision: record.revision,
        mode: EDITABLE.has(record.status) ? 'edit' : 'view',
        title: record.clientName,
        subtitle: record.requestTypeLabel,
      }),
    ),
  );

  // Stable context object: DynamicForm is memoised, so re-renders of this header (save status etc.)
  // do not re-render the form.
  const formContext = useMemo(() => (request ? contextFor(request) : {}), [request]);

  if (error) return <ErrorState error={error} title="The request could not be opened" onRetry={refetch} />;
  if (isLoading || !request || !schema || !initialised || !tab) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress aria-label="Loading request" />
      </Box>
    );
  }

  if (tab.mode === 'view') return <RequestViewer requestId={requestId} />;

  const submit = async () => {
    const formApiCurrent = formApi.current;
    if (!formApiCurrent || tab.submitting) return;
    const result = formApiCurrent.validate('submit');
    if (!result.valid) {
      requestAnimationFrame(() => document.getElementById('error-summary')?.focus());
      return;
    }
    dispatch(submitStarted({ requestId, idempotencyKey: `submit-${newCorrelationId()}` }));
    try {
      const updated = await api.submitRequest(
        requestId,
        { baseRevision: tab.serverRevision, editorSessionId, values: visibleValuesOnly(schema, formApiCurrent.getValues()) },
        // Same key for every retry of this submission intent (duplicate-submission protection).
        store.getState().workspace.tabs[requestId]?.submitKey ?? `submit-${newCorrelationId()}`,
      );
      queryClient.setQueryData<RequestRecord>(queryKeys.request(requestId), updated);
      void queryClient.invalidateQueries({ queryKey: ['requests', 'list'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
      dispatch(submitFinished({ requestId, outcome: 'submitted', revision: updated.revision }));
      dispatch(
        noticeShown({
          severity: 'success',
          message: `Submitted ${requestId}. Risk tier ${updated.decision?.outputs.riskTier ?? '—'}, ${updated.decision?.outputs.reviewLevel.toLowerCase() ?? ''} review.`,
        }),
      );
    } catch (e) {
      if (isApiError(e) && e.status === 422) {
        const formErrors = (e.details?.formErrors as string[] | undefined) ?? [];
        formApiCurrent.setServerErrors(e.fieldErrors ?? {}, formErrors.length ? formErrors : [e.message]);
        dispatch(submitFinished({ requestId, outcome: 'rejected' }));
        requestAnimationFrame(() => document.getElementById('error-summary')?.focus());
      } else if (isApiError(e) && e.status === 409 && e.details) {
        const d = e.details as unknown as RevisionConflictDetails;
        dispatch(submitFinished({ requestId, outcome: 'rejected' }));
        dispatch(saveConflicted({ requestId, seq: tab.editSeq + 1, conflict: { serverRevision: d.currentRevision, serverValues: d.serverValues, updatedBy: d.updatedBy, updatedAt: d.updatedAt } }));
      } else {
        dispatch(submitFinished({ requestId, outcome: 'failed' }));
        dispatch(noticeShown({ severity: 'error', message: describeError(e) }));
      }
    }
  };

  const blocked = tab.status === 'conflict';
  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
          <Box>
            <Typography variant="h2">
              {request.clientName} · {request.requestTypeLabel}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {requestId} · form {schema.schemaId} v{schema.version} · revision {tab.serverRevision}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <SaveStatusIndicator requestId={requestId} />
            <Button startIcon={<SaveIcon />} onClick={() => void dispatch(saveDraft(requestId, 'manual'))} disabled={blocked || tab.inFlightSaves > 0}>
              Save draft
            </Button>
            <Button onClick={() => formApi.current?.validate('submit')}>Check for errors</Button>
            {canSubmit && (
              <Button variant="contained" startIcon={<SendIcon />} onClick={submit} disabled={blocked || tab.submitting}>
                {tab.submitting ? 'Submitting…' : 'Submit'}
              </Button>
            )}
          </Stack>
        </Stack>
        {tab.lastError && tab.status === 'error' && (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            role="alert"
            action={
              <Button color="inherit" size="small" onClick={() => void dispatch(saveDraft(requestId, 'manual'))}>
                Retry
              </Button>
            }
          >
            Draft not saved: {tab.lastError} Your changes are kept in this tab.
          </Alert>
        )}
      </Paper>

      {request.status === 'RETURNED' && request.reviewerComment && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>Returned by operations</AlertTitle>
          <UserText text={request.reviewerComment} variant="body2" data-testid="reviewer-comment" />
        </Alert>
      )}
      {!!warnings?.length && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => dispatch(warningsDismissed({ formId: requestId }))}>
          {warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </Alert>
      )}
      <ConflictBanner requestId={requestId} schema={schema} />
      <DynamicForm ref={formApi} formId={requestId} schema={schema} context={formContext} />
    </Box>
  );
}

function contextFor(request: RequestRecord) {
  return {
    requestId: request.requestId,
    clientId: request.clientId,
    clientName: request.clientName,
    category: request.category,
    requestType: request.requestTypeLabel,
  };
}
