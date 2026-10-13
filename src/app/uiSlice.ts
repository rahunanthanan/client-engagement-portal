import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Notice {
  id: string;
  severity: 'success' | 'info' | 'warning' | 'error';
  message: string;
}

export interface UiState {
  showRenderCounts: boolean;
  simulationPanelOpen: boolean;
  notices: Notice[];
}

const initialState: UiState = { showRenderCounts: false, simulationPanelOpen: false, notices: [] };

let noticeId = 0;

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    renderCountsToggled(state) {
      state.showRenderCounts = !state.showRenderCounts;
    },
    simulationPanelToggled(state, action: PayloadAction<boolean | undefined>) {
      state.simulationPanelOpen = action.payload ?? !state.simulationPanelOpen;
    },
    noticeShown: {
      reducer(state, action: PayloadAction<Notice>) {
        state.notices.push(action.payload);
      },
      prepare(notice: Omit<Notice, 'id'>) {
        noticeId += 1;
        return { payload: { ...notice, id: `notice-${noticeId}` } };
      },
    },
    noticeDismissed(state, action: PayloadAction<string>) {
      state.notices = state.notices.filter((n) => n.id !== action.payload);
    },
  },
});

export const { renderCountsToggled, simulationPanelToggled, noticeShown, noticeDismissed } = uiSlice.actions;
