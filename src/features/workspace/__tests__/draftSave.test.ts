import { waitFor } from '@testing-library/react';
import { formInitialized, formValuesChanged } from '@/forms/engine/formsSlice';
import { getDb } from '@/mocks/db';
import { setScenarios } from '@/mocks/scenarios';
import { createSignedInServices } from '@/test/renderApp';
import { saveDraft } from '../draftSave';
import { conflictKeptMine, tabHydrated, tabOpened } from '../workspaceSlice';

const DRAFT = 'REQ-2026-000091'; // seeded fictional draft, revision 3
const OTHER = 'REQ-2026-000093'; // seeded fictional returned request, revision 5

async function setup(autosaveDelayMs = 60_000) {
  const services = await createSignedInServices('CLIENT_ADVISOR', { autosaveDelayMs });
  const { store } = services;
  for (const [id, revision] of [[DRAFT, 3], [OTHER, 5]] as const) {
    store.dispatch(tabOpened({ requestId: id, title: id, subtitle: '', mode: 'edit' }));
    store.dispatch(formInitialized({ formId: id, schemaRef: { schemaId: 's', version: 1 }, values: { ...getDb().requests[id]!.values }, context: {} }));
    store.dispatch(tabHydrated({ requestId: id, revision, mode: 'edit' }));
  }
  const edit = (id: string, legalName: string) =>
    store.dispatch(formValuesChanged({ formId: id, values: { ...store.getState().forms[id]!.values, legalName }, changedPath: 'legalName' }));
  const tab = (id: string) => store.getState().workspace.tabs[id]!;
  return { ...services, edit, tab };
}

describe('draft saving', () => {
  it('saves an incomplete draft without submission validation', async () => {
    const { store, edit, tab } = await setup();
    edit(DRAFT, ''); // a required field emptied
    await expect(store.dispatch(saveDraft(DRAFT, 'manual'))).resolves.toBe(true);
    expect(tab(DRAFT)).toMatchObject({ status: 'saved', serverRevision: 4, savedSeq: 1 });
  });

  it('handles out-of-order responses: the slower, older save never wins', async () => {
    const { store, edit, tab } = await setup();
    setScenarios({ delayNextSaveResponseMs: 300 });
    edit(DRAFT, 'First edit');
    const slow = store.dispatch(saveDraft(DRAFT, 'autosave'));
    edit(DRAFT, 'Second edit');
    const fast = store.dispatch(saveDraft(DRAFT, 'manual'));

    await fast;
    expect(tab(DRAFT)).toMatchObject({ savedSeq: 2, serverRevision: 5, status: 'saving' }); // slow one still in flight
    await slow;
    expect(tab(DRAFT)).toMatchObject({ savedSeq: 2, serverRevision: 5, status: 'saved' });
    expect(getDb().requests[DRAFT]!.values.legalName).toBe('Second edit');
  });

  it('surfaces a revision conflict, pauses, and lets the user keep their version', async () => {
    const { store, edit, tab } = await setup();
    setScenarios({ conflictOnNextSave: true });
    edit(DRAFT, 'Mine');
    await store.dispatch(saveDraft(DRAFT, 'manual'));
    expect(tab(DRAFT).status).toBe('conflict');
    expect(tab(DRAFT).conflict?.updatedBy).toMatch(/colleague/);
    // While in conflict, autosave/manual save do nothing.
    await expect(store.dispatch(saveDraft(DRAFT, 'manual'))).resolves.toBe(false);

    store.dispatch(conflictKeptMine({ requestId: DRAFT }));
    await store.dispatch(saveDraft(DRAFT, 'manual'));
    expect(tab(DRAFT).status).toBe('saved');
    expect(getDb().requests[DRAFT]!.values.legalName).toBe('Mine');
  });

  it('retries a transient failure safely (idempotent save) and reports a persistent one', async () => {
    const { store, edit, tab } = await setup();
    setScenarios({ saveFailure: 'transient' });
    edit(DRAFT, 'Retry me');
    await store.dispatch(saveDraft(DRAFT, 'manual'));
    expect(tab(DRAFT).status).toBe('saved');

    setScenarios({ saveFailure: 'persistent' });
    edit(DRAFT, 'Will fail');
    await store.dispatch(saveDraft(DRAFT, 'manual'));
    expect(tab(DRAFT)).toMatchObject({ status: 'error' });
    expect(tab(DRAFT).lastError).toMatch(/unavailable/i);
  });

  it('autosaves after the debounce, per tab, without touching other tabs', async () => {
    const { edit, tab } = await setup(50);
    edit(DRAFT, 'a');
    edit(DRAFT, 'ab');
    edit(DRAFT, 'abc');
    expect(tab(DRAFT).status).toBe('unsaved');
    await waitFor(() => expect(tab(DRAFT).status).toBe('saved'));
    expect(tab(DRAFT).serverRevision).toBe(4); // three edits, one debounced save
    expect(tab(OTHER)).toMatchObject({ status: 'idle', serverRevision: 5, editSeq: 0 });
  });
});
