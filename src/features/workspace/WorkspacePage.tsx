import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router';
import { Alert, Box } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { RequestDetails } from '@/features/requests/RequestDetails';
import { PageHeader } from '@/shared/components/PageHeader';
import { tabActivated, tabOpened } from './workspaceSlice';
import { WorkspaceTabs } from './WorkspaceTabs';

const REQUEST_ID = /^REQ-\d{4}-\d{6}$/;

/** `/workspace/:requestId` — opens (or focuses) a tab and renders the active request. */
export default function WorkspacePage() {
  const { requestId } = useParams();
  const dispatch = useAppDispatch();
  const activeId = useAppSelector((s) => s.workspace.activeId);
  const exists = useAppSelector((s) => (requestId ? !!s.workspace.tabs[requestId] : false));
  const valid = !!requestId && REQUEST_ID.test(requestId);

  useEffect(() => {
    if (!valid || !requestId) return;
    if (exists) dispatch(tabActivated({ requestId }));
    else dispatch(tabOpened({ requestId, title: requestId, subtitle: '', mode: 'edit' }));
  }, [valid, requestId, exists, dispatch]);

  if (!requestId) return activeId ? <Navigate to={`/workspace/${activeId}`} replace /> : <Navigate to="/" replace />;
  if (!valid) return <Alert severity="error">“{requestId}” is not a valid request reference.</Alert>;

  return (
    <Box>
      <PageHeader title="Workspace" subtitle="Each tab is an independent request with its own form state and save status." />
      <WorkspaceTabs />
      <Box id="workspace-panel" role="tabpanel" aria-labelledby={`workspace-tab-${requestId}`}>
        {/* key: switching tabs mounts a fresh component tree; state lives in the store, not in components */}
        {exists && <RequestDetails key={requestId} requestId={requestId} />}
      </Box>
    </Box>
  );
}
