import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import { hasUnsavedChanges } from './workspaceSlice';

export const selectTab = (requestId: string) => (s: RootState) => s.workspace.tabs[requestId];

export const selectUnsavedTabs = createSelector([(s: RootState) => s.workspace.tabs], (tabs) =>
  Object.values(tabs).filter(hasUnsavedChanges),
);
