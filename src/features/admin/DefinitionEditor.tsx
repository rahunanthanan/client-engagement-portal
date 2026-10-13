import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Alert, AlertTitle, Box, Button, Chip, List, ListItem, Paper, Skeleton, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DefinitionKind, DefinitionRecord } from '@/api/contracts';
import { api, queryKeys } from '@/api/endpoints';
import { describeError, newCorrelationId } from '@/api/httpClient';
import { useAppDispatch } from '@/app/store';
import { usePermission } from '@/auth/usePermission';
import { DynamicForm } from '@/forms/components/DynamicForm';
import { SUPPORTED_FIELD_TYPES } from '@/forms/components/fieldRegistry';
import { buildInitialValues } from '@/forms/engine/formModel';
import { formInitialized } from '@/forms/engine/formsSlice';
import { toFormJsSchema } from '@/forms/schema/toFormJsSchema';
import type { FormSchema } from '@/forms/schema/types';
import { validateSchema } from '@/forms/schema/validateSchema';
import { LazyDecisionTable, LazyFormJsEditor, LazyFormJsViewer, LazyProcessModeler } from '@/features/workflow/lazy';
import { ErrorState } from '@/shared/components/ErrorState';
import { PageHeader } from '@/shared/components/PageHeader';
import { KIND_LABELS } from './kindLabels';

export default function DefinitionEditor() {
  const { kind = 'form', definitionId = '' } = useParams<{ kind: DefinitionKind; definitionId: string }>();
  const def = useQuery({
    queryKey: queryKeys.definition(kind, definitionId),
    queryFn: ({ signal }) => api.getDefinition(kind, definitionId, signal),
    staleTime: 0,
  });
  if (def.error) return <ErrorState error={def.error} onRetry={() => void def.refetch()} />;
  if (!def.data) return <Skeleton variant="rectangular" height={400} />;
  return <Editor key={`${def.data.definitionId}-${def.data.version}`} definition={def.data} />;
}

function Editor({ definition }: { definition: DefinitionRecord }) {
  const queryClient = useQueryClient();
  const canEdit = usePermission('definition:edit');
  const canApprove = usePermission('definition:approve');
  const [draft, setDraft] = useState(definition.content);
  const dirty = draft !== definition.content;

  const onSaved = (record: DefinitionRecord) => {
    queryClient.setQueryData(queryKeys.definition(record.kind, record.definitionId), record);
    void queryClient.invalidateQueries({ queryKey: queryKeys.definitions() });
  };
  const save = useMutation({ mutationFn: () => api.saveDefinitionDraft(definition.kind, definition.definitionId, draft, definition.version), onSuccess: onSaved });
  const approve = useMutation({ mutationFn: () => api.approveDefinition(definition.kind, definition.definitionId, `approve-${newCorrelationId()}`), onSuccess: onSaved });

  return (
    <>
      <PageHeader
        title={definition.name}
        subtitle={
          <span>
            {KIND_LABELS[definition.kind]} · {definition.definitionId} · v{definition.version}{' '}
            <Chip size="small" color={definition.status === 'APPROVED' ? 'success' : 'warning'} label={definition.status.toLowerCase()} />
          </span>
        }
        actions={
          <>
            {canEdit && (
              <Button variant="outlined" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                Save draft
              </Button>
            )}
            {canApprove && (
              <Button variant="contained" disabled={definition.status !== 'DRAFT' || dirty || approve.isPending} onClick={() => approve.mutate()}>
                Approve
              </Button>
            )}
          </>
        }
      />
      {(save.error || approve.error) && (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {describeError(save.error ?? approve.error)}
        </Alert>
      )}
      <Alert severity="info" sx={{ mb: 2 }}>
        Simulated governance: saving creates a draft; approval (by an administrator) publishes a new version. Requests already in flight keep the version they
        started with.
      </Alert>
      <Suspense fallback={<Skeleton variant="rectangular" height={480} />}>
        {definition.kind === 'process' && <LazyProcessModeler xml={definition.content} onChange={setDraft} />}
        {definition.kind === 'decision' && <LazyDecisionTable xml={definition.content} mode="edit" onChange={setDraft} />}
        {definition.kind === 'formjs' && <FormJsDefinition content={definition.content} onChange={setDraft} />}
        {definition.kind === 'form' && <CustomSchemaDefinition content={draft} onChange={setDraft} />}
      </Suspense>
    </>
  );
}

function FormJsDefinition({ content, onChange }: { content: string; onChange: (c: string) => void }) {
  const [tab, setTab] = useState(0);
  const initial = useMemo(() => JSON.parse(content) as Record<string, unknown>, [content]);
  const [current, setCurrent] = useState(initial);
  return (
    <>
      <Tabs value={tab} onChange={(_e, v: number) => setTab(v)} sx={{ mb: 1 }}>
        <Tab label="Visual editor (form-js)" />
        <Tab label="Preview (form-js viewer)" />
      </Tabs>
      {tab === 0 ? (
        <LazyFormJsEditor
          schema={current}
          onChange={(s) => {
            setCurrent(s);
            onChange(JSON.stringify(s, null, 2));
          }}
        />
      ) : (
        <LazyFormJsViewer schema={current} />
      )}
    </>
  );
}

/** JSON editing for the custom typed schema, with live structural validation and a rendered preview. */
function CustomSchemaDefinition({ content, onChange }: { content: string; onChange: (c: string) => void }) {
  const dispatch = useAppDispatch();
  const parsed = useMemo(() => {
    try {
      return { schema: JSON.parse(content) as FormSchema, error: null };
    } catch (e) {
      return { schema: null, error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [content]);
  const check = useMemo(() => (parsed.schema ? validateSchema(parsed.schema, SUPPORTED_FIELD_TYPES) : null), [parsed.schema]);
  const exported = useMemo(() => (parsed.schema && check?.valid ? toFormJsSchema(parsed.schema) : null), [parsed.schema, check]);
  const previewId = 'preview:definition';

  useEffect(() => {
    if (parsed.schema && check?.valid) {
      dispatch(formInitialized({ formId: previewId, schemaRef: { schemaId: parsed.schema.schemaId, version: parsed.schema.version }, values: buildInitialValues(parsed.schema), context: { clientName: 'Preview client (fictional)', clientId: 'CL-PREVIEW' } }));
    }
  }, [parsed.schema, check, dispatch]);

  return (
    <Stack spacing={2}>
      <TextField label="Schema JSON" multiline minRows={14} maxRows={24} value={content} onChange={(e) => onChange(e.target.value)} slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: 'monospace', fontSize: 12 } } }} />
      {parsed.error && <Alert severity="error">JSON error: {parsed.error}</Alert>}
      {check && !check.valid && (
        <Alert severity="error">
          <AlertTitle>Schema problems</AlertTitle>
          <List dense>
            {check.issues.map((i) => (
              <ListItem key={`${i.code}-${i.fieldId}`}>{i.message}</ListItem>
            ))}
          </List>
        </Alert>
      )}
      {parsed.schema && check?.valid && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h3" gutterBottom>
            Preview
          </Typography>
          <DynamicForm formId={previewId} schema={parsed.schema} context={{ clientName: 'Preview client (fictional)', clientId: 'CL-PREVIEW' }} />
        </Paper>
      )}
      {exported && (
        <Box>
          <Typography variant="h3" gutterBottom>
            form-js boundary check
          </Typography>
          <Typography variant="body2">
            {exported.schema.components.length} components map to form-js; {exported.unsupported.length} fields stay custom-only:
          </Typography>
          <List dense>
            {exported.unsupported.map((u) => (
              <ListItem key={u.fieldId}>
                {u.fieldId}: {u.reason}
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Stack>
  );
}
