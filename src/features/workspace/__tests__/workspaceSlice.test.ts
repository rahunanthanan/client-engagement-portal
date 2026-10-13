import { formValuesChanged } from '@/forms/engine/formsSlice';
import {
  conflictKeptMine,
  initialWorkspaceState,
  saveConflicted,
  saveFailed,
  saveStarted,
  saveSucceeded,
  tabClosed,
  tabHydrated,
  tabOpened,
  workspaceSlice,
  type WorkspaceState,
} from '../workspaceSlice';

const reduce = (state: WorkspaceState, ...actions: Parameters<typeof workspaceSlice.reducer>[1][]) => actions.reduce(workspaceSlice.reducer, state);
const edit = (id: string) => formValuesChanged({ formId: id, values: {}, changedPath: 'x' });

const twoTabs = () =>
  reduce(
    initialWorkspaceState,
    tabOpened({ requestId: 'REQ-A', title: 'A', subtitle: '', mode: 'edit' }),
    tabHydrated({ requestId: 'REQ-A', revision: 1, mode: 'edit' }),
    tabOpened({ requestId: 'REQ-B', title: 'B', subtitle: '', mode: 'edit' }),
    tabHydrated({ requestId: 'REQ-B', revision: 7, mode: 'edit' }),
  );

describe('workspace tabs', () => {
  it('keeps edit sequence, revision and status independent per tab', () => {
    const state = reduce(twoTabs(), edit('REQ-A'), edit('REQ-A'), edit('REQ-B'));
    expect(state.tabs['REQ-A']).toMatchObject({ editSeq: 2, serverRevision: 1, status: 'unsaved' });
    expect(state.tabs['REQ-B']).toMatchObject({ editSeq: 1, serverRevision: 7, status: 'unsaved' });
  });

  it('activates the previous tab when the active one closes', () => {
    const state = reduce(twoTabs(), tabClosed({ requestId: 'REQ-B' }));
    expect(state.order).toEqual(['REQ-A']);
    expect(state.activeId).toBe('REQ-A');
  });
});

describe('save ordering', () => {
  it('an older response arriving last never marks newer edits as saved', () => {
    let state = reduce(twoTabs(), edit('REQ-A'), saveStarted({ requestId: 'REQ-A', seq: 1 })); // save #1 (slow)
    state = reduce(state, edit('REQ-A'), edit('REQ-A'), saveStarted({ requestId: 'REQ-A', seq: 3 })); // save #2 (fast)
    state = reduce(state, saveSucceeded({ requestId: 'REQ-A', seq: 3, revision: 3, savedAt: 't2' }));
    expect(state.tabs['REQ-A']).toMatchObject({ savedSeq: 3, serverRevision: 3, status: 'saving' });
    state = reduce(state, saveSucceeded({ requestId: 'REQ-A', seq: 1, revision: 2, savedAt: 't1' })); // late, older response
    expect(state.tabs['REQ-A']).toMatchObject({ savedSeq: 3, serverRevision: 3, lastSavedAt: 't2', status: 'saved' });
  });

  it('stays "unsaved" when edits happen while a save is in flight', () => {
    let state = reduce(twoTabs(), edit('REQ-A'), saveStarted({ requestId: 'REQ-A', seq: 1 }), edit('REQ-A'));
    state = reduce(state, saveSucceeded({ requestId: 'REQ-A', seq: 1, revision: 2, savedAt: 't' }));
    expect(state.tabs['REQ-A']).toMatchObject({ savedSeq: 1, editSeq: 2, status: 'unsaved' });
  });

  it('ignores a failure for edits that a newer save already covered', () => {
    let state = reduce(twoTabs(), edit('REQ-A'), saveStarted({ requestId: 'REQ-A', seq: 1 }), edit('REQ-A'), saveStarted({ requestId: 'REQ-A', seq: 2 }));
    state = reduce(state, saveSucceeded({ requestId: 'REQ-A', seq: 2, revision: 2, savedAt: 't' }), saveFailed({ requestId: 'REQ-A', seq: 1, message: 'boom' }));
    expect(state.tabs['REQ-A']).toMatchObject({ status: 'saved', lastError: null });
  });

  it('records a conflict and adopts the server revision when the user keeps their version', () => {
    let state = reduce(twoTabs(), edit('REQ-A'), saveStarted({ requestId: 'REQ-A', seq: 1 }));
    state = reduce(state, saveConflicted({ requestId: 'REQ-A', seq: 1, conflict: { serverRevision: 5, serverValues: {}, updatedBy: 'X', updatedAt: 't' } }));
    expect(state.tabs['REQ-A']!.status).toBe('conflict');
    state = reduce(state, conflictKeptMine({ requestId: 'REQ-A' }));
    expect(state.tabs['REQ-A']).toMatchObject({ conflict: null, serverRevision: 5, status: 'unsaved' });
  });
});
