import type { RevisionConflictDetails } from '@/api/contracts';
import { api } from '@/api/endpoints';
import { describeError, isApiError } from '@/api/httpClient';
import type { AppThunk } from '@/app/store';
import { editorSessionId } from './editorSession';
import { saveConflicted, saveFailed, saveStarted, saveSucceeded } from './workspaceSlice';

export type SaveTrigger = 'autosave' | 'manual' | 'before-close' | 'before-submit';

/**
 * Saves the current values of one tab as a draft. No submission validation runs here, so an
 * incomplete request can always be saved.
 *
 * Several saves may be in flight for the same tab (e.g. autosave + manual save). Each carries the
 * edit sequence it snapshotted, and the reducer only advances `savedSeq` monotonically.
 * Returns true when the save covered every edit made before it started.
 */
export function saveDraft(requestId: string, trigger: SaveTrigger): AppThunk<Promise<boolean>> {
  return async (dispatch, getState, { queryClient }) => {
    const { workspace, forms } = getState();
    const tab = workspace.tabs[requestId];
    const form = forms[requestId];
    if (!tab || !form || tab.mode !== 'edit' || !tab.hydrated || tab.conflict) return false;
    if (trigger === 'autosave' && tab.editSeq <= tab.savedSeq) return true;

    const seq = tab.editSeq;
    dispatch(saveStarted({ requestId, seq }));
    try {
      const result = await api.saveDraft(requestId, {
        baseRevision: tab.serverRevision,
        clientSeq: seq,
        editorSessionId,
        values: form.values,
      });
      dispatch(saveSucceeded({ requestId, seq, revision: result.revision, savedAt: result.savedAt }));
      void queryClient.invalidateQueries({ queryKey: ['requests', 'list'] });
      return true;
    } catch (error) {
      if (isApiError(error) && error.status === 409 && error.details) {
        dispatch(saveConflicted({ requestId, seq, conflict: toConflict(error.details) }));
      } else {
        dispatch(saveFailed({ requestId, seq, message: describeError(error) }));
      }
      return false;
    }
  };
}

function toConflict(details: Record<string, unknown>) {
  const d = details as unknown as RevisionConflictDetails;
  return { serverRevision: d.currentRevision, serverValues: d.serverValues, updatedBy: d.updatedBy, updatedAt: d.updatedAt };
}
