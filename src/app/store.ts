import {
  combineReducers,
  configureStore,
  createListenerMiddleware,
  type ThunkAction,
  type ThunkDispatch,
  type UnknownAction,
} from '@reduxjs/toolkit';
import type { QueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { authSlice } from '@/auth/authSlice';
import { formsSlice } from '@/forms/engine/formsSlice';
import { workspaceSlice } from '@/features/workspace/workspaceSlice';
import { registerAutosave } from '@/features/workspace/autosaveListener';
import { loadPersistedWorkspace, registerWorkspacePersistence } from '@/features/workspace/workspacePersistence';
import { uiSlice } from './uiSlice';

/**
 * Redux owns CLIENT state: open tabs, per-tab form values and save bookkeeping, session and UI flags.
 * TanStack Query owns SERVER state: clients, schemas, requests, tasks, lookups, definitions.
 */
export const rootReducer = combineReducers({
  auth: authSlice.reducer,
  forms: formsSlice.reducer,
  workspace: workspaceSlice.reducer,
  ui: uiSlice.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export interface ThunkExtra {
  queryClient: QueryClient;
}

export type AppDispatch = ThunkDispatch<RootState, ThunkExtra, UnknownAction>;

export interface CreateStoreOptions {
  queryClient: QueryClient;
  preloadedState?: Partial<RootState>;
  autosaveDelayMs?: number;
  persistWorkspace?: boolean;
}

export function createAppStore({ queryClient, preloadedState, autosaveDelayMs = 1500, persistWorkspace = false }: CreateStoreOptions) {
  const listener = createListenerMiddleware<RootState, AppDispatch, ThunkExtra>({ extra: { queryClient } });

  const store = configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState ?? (persistWorkspace ? loadPersistedWorkspace() : undefined),
    middleware: (getDefault) =>
      getDefault({ thunk: { extraArgument: { queryClient } satisfies ThunkExtra } }).prepend(listener.middleware),
  });

  registerAutosave(listener.startListening, autosaveDelayMs);
  if (persistWorkspace) registerWorkspacePersistence(listener.startListening);
  return store;
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppThunk<R = void> = ThunkAction<R, RootState, ThunkExtra, UnknownAction>;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
