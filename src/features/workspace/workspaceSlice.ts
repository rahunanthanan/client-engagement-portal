import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { FormValues } from '@/forms/schema/types';
import { allFormsCleared, formRemoved, formReset, formValuesChanged } from '@/forms/engine/formsSlice';

/**
 * Workspace = the set of open request tabs and their save bookkeeping.
 *
 * Save ordering model (per tab):
 *  - `editSeq`   increments on every user edit (local edit sequence).
 *  - `savedSeq`  highest edit sequence the server has confirmed.
 *  - `serverRevision` highest revision the server has returned (never decreases).
 *
 * A save captures `seq = editSeq` when it starts. When its response arrives, `savedSeq`
 * becomes `max(savedSeq, seq)`. So a slow, older response can never mark newer edits as
 * saved, and an out-of-order response can never roll the revision back.
 */

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error' | 'conflict';

export interface ConflictInfo {
  serverRevision: number;
  serverValues: FormValues;
  updatedBy: string;
  updatedAt: string;
}

export interface TabState {
  requestId: string;
  title: string;
  subtitle: string;
  mode: 'edit' | 'view';
  hydrated: boolean;
  editSeq: number;
  savedSeq: number;
  serverRevision: number;
  inFlightSaves: number;
  lastSavedAt: string | null;
  lastError: string | null;
  conflict: ConflictInfo | null;
  status: SaveStatus;
  /** Idempotency key reused for every retry of the same submission intent. */
  submitKey: string | null;
  submitting: boolean;
}

export interface WorkspaceState {
  tabs: Record<string, TabState>;
  order: string[];
  activeId: string | null;
}

export const initialWorkspaceState: WorkspaceState = { tabs: {}, order: [], activeId: null };

export function deriveStatus(tab: TabState): SaveStatus {
  if (tab.conflict) return 'conflict';
  if (tab.inFlightSaves > 0) return 'saving';
  if (tab.editSeq > tab.savedSeq) return tab.lastError ? 'error' : 'unsaved';
  return tab.lastSavedAt ? 'saved' : 'idle';
}

export function hasUnsavedChanges(tab: TabState): boolean {
  return tab.mode === 'edit' && (tab.editSeq > tab.savedSeq || tab.inFlightSaves > 0 || tab.conflict !== null);
}

const withStatus = (tab: TabState) => {
  tab.status = deriveStatus(tab);
};

export const workspaceSlice = createSlice({
  name: 'workspace',
  initialState: initialWorkspaceState,
  reducers: {
    tabOpened(state, action: PayloadAction<{ requestId: string; title: string; subtitle: string; mode: 'edit' | 'view' }>) {
      const { requestId } = action.payload;
      if (!state.tabs[requestId]) {
        state.tabs[requestId] = {
          ...action.payload,
          hydrated: false,
          editSeq: 0,
          savedSeq: 0,
          serverRevision: 0,
          inFlightSaves: 0,
          lastSavedAt: null,
          lastError: null,
          conflict: null,
          status: 'idle',
          submitKey: null,
          submitting: false,
        };
        state.order.push(requestId);
      }
      state.activeId = requestId;
    },
    tabActivated(state, action: PayloadAction<{ requestId: string }>) {
      if (state.tabs[action.payload.requestId]) state.activeId = action.payload.requestId;
    },
    tabClosed(state, action: PayloadAction<{ requestId: string }>) {
      const { requestId } = action.payload;
      const position = state.order.indexOf(requestId);
      delete state.tabs[requestId];
      state.order = state.order.filter((id) => id !== requestId);
      if (state.activeId === requestId) state.activeId = state.order[Math.max(0, position - 1)] ?? null;
    },
    tabHydrated(state, action: PayloadAction<{ requestId: string; revision: number; mode: 'edit' | 'view'; title?: string; subtitle?: string }>) {
      const tab = state.tabs[action.payload.requestId];
      if (!tab) return;
      tab.hydrated = true;
      tab.mode = action.payload.mode;
      tab.serverRevision = Math.max(tab.serverRevision, action.payload.revision);
      if (action.payload.title) tab.title = action.payload.title;
      if (action.payload.subtitle) tab.subtitle = action.payload.subtitle;
      withStatus(tab);
    },
    saveStarted(state, action: PayloadAction<{ requestId: string; seq: number }>) {
      const tab = state.tabs[action.payload.requestId];
      if (!tab) return;
      tab.inFlightSaves += 1;
      withStatus(tab);
    },
    saveSucceeded(state, action: PayloadAction<{ requestId: string; seq: number; revision: number; savedAt: string }>) {
      const tab = state.tabs[action.payload.requestId];
      if (!tab) return;
      tab.inFlightSaves = Math.max(0, tab.inFlightSaves - 1);
      if (action.payload.seq >= tab.savedSeq) {
        tab.savedSeq = action.payload.seq;
        tab.lastSavedAt = action.payload.savedAt;
        tab.lastError = null;
      }
      tab.serverRevision = Math.max(tab.serverRevision, action.payload.revision);
      withStatus(tab);
    },
    saveFailed(state, action: PayloadAction<{ requestId: string; seq: number; message: string }>) {
      const tab = state.tabs[action.payload.requestId];
      if (!tab) return;
      tab.inFlightSaves = Math.max(0, tab.inFlightSaves - 1);
      // A failure for an edit that a newer save already covered is irrelevant.
      if (action.payload.seq > tab.savedSeq) tab.lastError = action.payload.message;
      withStatus(tab);
    },
    saveConflicted(state, action: PayloadAction<{ requestId: string; seq: number; conflict: ConflictInfo }>) {
      const tab = state.tabs[action.payload.requestId];
      if (!tab) return;
      tab.inFlightSaves = Math.max(0, tab.inFlightSaves - 1);
      if (action.payload.seq > tab.savedSeq) tab.conflict = action.payload.conflict;
      withStatus(tab);
    },
    /** "Keep mine": adopt the server revision as the new base; the next save overwrites with local values. */
    conflictKeptMine(state, action: PayloadAction<{ requestId: string }>) {
      const tab = state.tabs[action.payload.requestId];
      if (!tab?.conflict) return;
      tab.serverRevision = Math.max(tab.serverRevision, tab.conflict.serverRevision);
      tab.conflict = null;
      tab.lastError = null;
      withStatus(tab);
    },
    /** "Use theirs": the form is reset to server values (see `formReset` handling below). */
    conflictTookServer(state, action: PayloadAction<{ requestId: string }>) {
      const tab = state.tabs[action.payload.requestId];
      if (!tab?.conflict) return;
      tab.serverRevision = Math.max(tab.serverRevision, tab.conflict.serverRevision);
      tab.conflict = null;
      tab.lastError = null;
      tab.savedSeq = tab.editSeq;
      withStatus(tab);
    },
    submitStarted(state, action: PayloadAction<{ requestId: string; idempotencyKey: string }>) {
      const tab = state.tabs[action.payload.requestId];
      if (!tab) return;
      tab.submitting = true;
      tab.submitKey = tab.submitKey ?? action.payload.idempotencyKey;
    },
    submitFinished(state, action: PayloadAction<{ requestId: string; outcome: 'submitted' | 'rejected' | 'failed'; revision?: number }>) {
      const tab = state.tabs[action.payload.requestId];
      if (!tab) return;
      tab.submitting = false;
      if (action.payload.outcome === 'submitted') {
        tab.mode = 'view';
        tab.savedSeq = tab.editSeq;
        tab.submitKey = null;
        if (action.payload.revision) tab.serverRevision = Math.max(tab.serverRevision, action.payload.revision);
      }
      // A rejected (422) submission needs edits, so a new intent gets a new key. A network failure keeps the key.
      if (action.payload.outcome === 'rejected') tab.submitKey = null;
      withStatus(tab);
    },
    workspaceCleared() {
      return initialWorkspaceState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(formValuesChanged, (state, action) => {
        const tab = state.tabs[action.payload.formId];
        if (!tab) return;
        tab.editSeq += 1;
        withStatus(tab);
      })
      .addCase(formReset, (state, action) => {
        const tab = state.tabs[action.payload.formId];
        if (!tab) return;
        tab.savedSeq = tab.editSeq;
        withStatus(tab);
      })
      .addCase(formRemoved, (state, action) => {
        const tab = state.tabs[action.payload.formId];
        if (tab) tab.hydrated = false;
      })
      .addCase(allFormsCleared, () => initialWorkspaceState);
  },
});

export const {
  tabOpened,
  tabActivated,
  tabClosed,
  tabHydrated,
  saveStarted,
  saveSucceeded,
  saveFailed,
  saveConflicted,
  conflictKeptMine,
  conflictTookServer,
  submitStarted,
  submitFinished,
  workspaceCleared,
} = workspaceSlice.actions;
