import { useMemo } from 'react';
import { Alert, AlertTitle, Button, Stack } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { indexSchema } from '@/forms/engine/formModel';
import { formReset } from '@/forms/engine/formsSlice';
import type { FormSchema } from '@/forms/schema/types';
import { formatDateTime } from '@/shared/format';
import { saveDraft } from './draftSave';
import { conflictKeptMine, conflictTookServer } from './workspaceSlice';

/** Shown when the server rejected a save because someone else changed the draft (HTTP 409). */
export function ConflictBanner({ requestId, schema }: { requestId: string; schema: FormSchema }) {
  const dispatch = useAppDispatch();
  const conflict = useAppSelector((s) => s.workspace.tabs[requestId]?.conflict);
  const localValues = useAppSelector((s) => s.forms[requestId]?.values);

  const differing = useMemo(() => {
    if (!conflict || !localValues) return [];
    const index = indexSchema(schema);
    const keys = new Set([...Object.keys(conflict.serverValues), ...Object.keys(localValues)]);
    return [...keys]
      .filter((k) => JSON.stringify(conflict.serverValues[k]) !== JSON.stringify(localValues[k]))
      .map((k) => index.fieldsById.get(k)?.label ?? k);
  }, [conflict, localValues, schema]);

  if (!conflict) return null;
  return (
    <Alert severity="error" role="alert" sx={{ mb: 2 }} data-testid="conflict-banner">
      <AlertTitle>Someone else changed this draft</AlertTitle>
      {conflict.updatedBy} saved revision {conflict.serverRevision} at {formatDateTime(conflict.updatedAt)}. Autosave is paused until you choose.
      {differing.length > 0 && <div>Fields that differ: {differing.join(', ')}.</div>}
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button
          variant="contained"
          size="small"
          onClick={() => {
            dispatch(conflictKeptMine({ requestId }));
            void dispatch(saveDraft(requestId, 'manual'));
          }}
        >
          Keep my version
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            dispatch(conflictTookServer({ requestId }));
            dispatch(formReset({ formId: requestId, values: conflict.serverValues }));
          }}
        >
          Use their version
        </Button>
      </Stack>
    </Alert>
  );
}
