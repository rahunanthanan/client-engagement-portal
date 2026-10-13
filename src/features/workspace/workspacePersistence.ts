import type { TypedStartListening } from '@reduxjs/toolkit';
import type { AppDispatch, RootState, ThunkExtra } from '@/app/store';
import type { FormsState } from '@/forms/engine/formsSlice';
import { deriveStatus, type WorkspaceState } from './workspaceSlice';

/**
 * DEMO ONLY: keeps open tabs and unsaved values in localStorage so a page reload during a
 * demo does not lose work. Every value here is fictional sample data.
 *
 * Production: client data must not be written to browser storage. Unsaved work is protected by
 * frequent server-side draft saves (already implemented), and only non-sensitive UI preferences
 * (e.g. which tabs were open, by request id) would be kept locally, if approved.
 */
const KEY = 'cep.demo.workspace.v1';

interface Persisted {
  workspace: WorkspaceState;
  forms: FormsState;
}

export function loadPersistedWorkspace(): Partial<RootState> | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Persisted;
    // In-flight saves and conflicts do not survive a reload.
    for (const tab of Object.values(parsed.workspace.tabs)) {
      tab.inFlightSaves = 0;
      tab.submitting = false;
      tab.conflict = null;
      tab.status = deriveStatus(tab);
    }
    return { workspace: parsed.workspace, forms: parsed.forms };
  } catch {
    return undefined;
  }
}

export function clearPersistedWorkspace(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function registerWorkspacePersistence(startListening: TypedStartListening<RootState, AppDispatch, ThunkExtra>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  startListening({
    predicate: (action) => action.type.startsWith('forms/') || action.type.startsWith('workspace/'),
    effect: (_action, api) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const { workspace, forms } = api.getState();
        try {
          localStorage.setItem(KEY, JSON.stringify({ workspace, forms } satisfies Persisted));
        } catch {
          /* storage full or unavailable: the server draft is the source of truth anyway */
        }
      }, 400);
    },
  });
}
