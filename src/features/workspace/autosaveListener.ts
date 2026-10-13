import type { TypedStartListening } from '@reduxjs/toolkit';
import type { AppDispatch, RootState, ThunkExtra } from '@/app/store';
import { formValuesChanged } from '@/forms/engine/formsSlice';
import { saveDraft } from './draftSave';
import { tabClosed } from './workspaceSlice';

/**
 * Debounced autosave, implemented as listener middleware rather than a component effect so it
 * keeps working when the user switches to another tab before the debounce fires.
 * One timer per request: edits in tab A never delay or trigger saves of tab B.
 */
export function registerAutosave(startListening: TypedStartListening<RootState, AppDispatch, ThunkExtra>, delayMs: number) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  startListening({
    actionCreator: formValuesChanged,
    effect: (action, api) => {
      const requestId = action.payload.formId;
      const tab = api.getState().workspace.tabs[requestId];
      if (!tab || tab.mode !== 'edit') return;
      clearTimeout(timers.get(requestId));
      timers.set(
        requestId,
        setTimeout(() => {
          timers.delete(requestId);
          void api.dispatch(saveDraft(requestId, 'autosave'));
        }, delayMs),
      );
    },
  });

  startListening({
    actionCreator: tabClosed,
    effect: (action) => {
      clearTimeout(timers.get(action.payload.requestId));
      timers.delete(action.payload.requestId);
    },
  });
}
