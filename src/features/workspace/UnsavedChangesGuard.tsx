import { useEffect } from 'react';
import { useBlocker } from 'react-router';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { saveDraft } from './draftSave';
import { selectUnsavedTabs } from './selectors';

/**
 * Two layers of unsaved-change protection:
 * 1. `beforeunload` for reload / closing the browser tab / leaving the SPA.
 * 2. React Router `useBlocker` for in-app navigation away from the workspace.
 */
export function UnsavedChangesGuard() {
  const dispatch = useAppDispatch();
  const unsaved = useAppSelector(selectUnsavedTabs);
  const hasUnsaved = unsaved.length > 0;

  useEffect(() => {
    if (!hasUnsaved) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsaved]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsaved && currentLocation.pathname.startsWith('/workspace') && !nextLocation.pathname.startsWith('/workspace') && nextLocation.pathname !== '/login',
  );

  if (blocker.state !== 'blocked') return null;
  return (
    <ConfirmDialog
      open
      title="Leave with unsaved changes?"
      onClose={() => blocker.reset()}
      actions={[
        { label: 'Stay', onClick: () => blocker.reset(), autoFocus: true },
        { label: 'Leave without saving', onClick: () => blocker.proceed(), color: 'error' },
        {
          label: 'Save drafts and leave',
          variant: 'contained',
          onClick: async () => {
            const results = await Promise.all(unsaved.map((t) => dispatch(saveDraft(t.requestId, 'before-close'))));
            if (results.every(Boolean)) blocker.proceed();
            else blocker.reset();
          },
        },
      ]}
    >
      {unsaved.length === 1 ? '1 open request has' : `${unsaved.length} open requests have`} changes that are not saved to the server yet. They stay
      open in your workspace, but colleagues will not see them until they are saved.
    </ConfirmDialog>
  );
}
