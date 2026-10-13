import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Box, IconButton, Tab, Tabs, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { formRemoved } from '@/forms/engine/formsSlice';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { saveDraft } from './draftSave';
import { hasUnsavedChanges, tabClosed } from './workspaceSlice';

/**
 * Multi-request workspace tabs. Each tab is keyed by the server's stable request id, so its form
 * state, errors and save bookkeeping are independent of every other tab.
 */
export function WorkspaceTabs() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { order, tabs, activeId } = useAppSelector((s) => s.workspace);
  const [closing, setClosing] = useState<string | null>(null);

  const close = (requestId: string) => {
    const position = order.indexOf(requestId);
    const remaining = order.filter((id) => id !== requestId);
    dispatch(tabClosed({ requestId }));
    dispatch(formRemoved({ formId: requestId }));
    setClosing(null);
    if (activeId === requestId) {
      const next = remaining[Math.max(0, position - 1)];
      navigate(next ? `/workspace/${next}` : '/', { replace: true });
    }
  };

  const requestClose = (requestId: string) => {
    const tab = tabs[requestId];
    if (tab && hasUnsavedChanges(tab)) setClosing(requestId);
    else close(requestId);
  };

  if (order.length === 0) return null;
  const closingTab = closing ? tabs[closing] : undefined;

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, bgcolor: 'background.paper' }}>
      <Tabs value={activeId && order.includes(activeId) ? activeId : false} variant="scrollable" scrollButtons="auto" aria-label="Open requests">
        {order.map((id) => {
          const tab = tabs[id]!;
          const unsaved = hasUnsavedChanges(tab);
          return (
            <Tab
              key={id}
              value={id}
              onClick={() => navigate(`/workspace/${id}`)}
              id={`workspace-tab-${id}`}
              aria-controls="workspace-panel"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {unsaved && (
                    <Tooltip title="Unsaved changes">
                      <FiberManualRecordIcon sx={{ fontSize: 10 }} color="warning" aria-label="unsaved changes" />
                    </Tooltip>
                  )}
                  <span>{tab.title}</span>
                  <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>
                    {id}
                  </Box>
                  <IconButton
                    component="span"
                    size="small"
                    aria-label={`Close ${tab.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      requestClose(id);
                    }}
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </Box>
              }
            />
          );
        })}
      </Tabs>
      <ConfirmDialog
        open={!!closingTab}
        title="Close tab with unsaved changes?"
        onClose={() => setClosing(null)}
        actions={[
          { label: 'Cancel', onClick: () => setClosing(null), autoFocus: true },
          { label: 'Discard changes', onClick: () => closing && close(closing), color: 'error' },
          {
            label: 'Save draft and close',
            variant: 'contained',
            onClick: async () => {
              if (!closing) return;
              const ok = await dispatch(saveDraft(closing, 'before-close'));
              if (ok) close(closing);
              else setClosing(null);
            },
          },
        ]}
      >
        {closingTab?.title} ({closingTab?.requestId}) has changes that are not saved to the server yet.
      </ConfirmDialog>
    </Box>
  );
}
