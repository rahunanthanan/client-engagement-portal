import { act, screen, waitFor, within } from '@testing-library/react';
import { api } from '@/api/endpoints';
import { getDb } from '@/mocks/db';
import { setScenarios } from '@/mocks/scenarios';
import { makeDraftSubmittable } from '@/test/completeDraft';
import { renderApp } from '@/test/renderApp';

jest.setTimeout(40_000);

const DRAFT = 'REQ-2026-000091';
const RETURNED = 'REQ-2026-000093';

const waitForForm = () => screen.findByRole('form', {}, { timeout: 8000 });

describe('Client Advisor journey', () => {
  it('searches for a client and creates a request that opens in a workspace tab', async () => {
    const { user, router } = await renderApp('/');
    await user.type(await screen.findByLabelText(/search by name or client id/i), 'Bluefin');
    await user.click(await screen.findByRole('button', { name: /create request for bluefin orchards ltd/i }));

    await screen.findByRole('heading', { name: 'Create request' });
    await screen.findByRole('option', { name: 'Client onboarding' });
    await user.selectOptions(screen.getByLabelText(/request category/i), 'ONBOARDING');
    await user.selectOptions(screen.getByLabelText(/request type/i), 'CORPORATE_ENTITY');
    expect(screen.getByText(/onboarding.corporate-entity/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /start request/i }));

    await waitForForm();
    expect(router.state.location.pathname).toMatch(/^\/workspace\/REQ-2026-\d{6}$/);
    expect(screen.getByRole('tab', { name: /bluefin orchards ltd/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/registered legal name/i)).toBeInTheDocument();
  });

  it('saves an incomplete draft and lists validation errors on submit', async () => {
    const { user } = await renderApp(`/workspace/${DRAFT}`);
    await waitForForm();
    await user.type(screen.getByLabelText(/registered legal name/i), 'Bluefin Orchards Ltd');
    expect(screen.getByTestId('save-status')).toHaveAttribute('data-status', 'unsaved');
    await user.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveAttribute('data-status', 'saved'));

    await user.click(screen.getByRole('button', { name: /^submit$/i }));
    const summary = await screen.findByRole('alert', { name: /there is a problem/i });
    expect(within(summary).getByRole('button', { name: /date of incorporation is required/i })).toBeInTheDocument();
    expect(getDb().requests[DRAFT]!.status).toBe('DRAFT');
  });

  it('submits a complete request; the backend evaluates the decision and creates a review task', async () => {
    makeDraftSubmittable();
    const { user } = await renderApp(`/workspace/${DRAFT}`);
    await waitForForm();
    await user.click(screen.getByRole('button', { name: /^submit$/i }));
    expect(await screen.findByText(/submitted req-2026-000091\. risk tier medium/i, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByText('In review')).toBeInTheDocument();
    expect(getDb().requests[DRAFT]!.status).toBe('IN_REVIEW');
    expect(Object.values(getDb().tasks).some((t) => t.requestId === DRAFT && t.status === 'OPEN')).toBe(true);
  });

  it('maps server-side validation errors (422) onto fields', async () => {
    makeDraftSubmittable();
    setScenarios({ rejectNextSubmission: true });
    const { user } = await renderApp(`/workspace/${DRAFT}`);
    await waitForForm();
    await user.click(screen.getByRole('button', { name: /^submit$/i }));
    const summary = await screen.findByRole('alert', { name: /there is a problem/i });
    expect(within(summary).getByText(/failed the external verification check/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^tax identification number/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps tabs isolated: edits in one request never leak into another', async () => {
    const { user, router } = await renderApp(`/workspace/${DRAFT}`);
    await waitForForm();
    const legalNameBefore = (screen.getByLabelText(/registered legal name/i) as HTMLInputElement).value;

    await act(() => router.navigate(`/workspace/${RETURNED}`));
    await waitFor(() => expect(screen.getByLabelText(/full legal name/i)).toBeInTheDocument(), { timeout: 8000 });
    await user.type(screen.getByLabelText(/occupation/i), 'Orchard manager');

    await user.click(screen.getByRole('tab', { name: /bluefin orchards ltd/i }));
    await waitFor(() => expect(screen.getByLabelText(/registered legal name/i)).toHaveValue(legalNameBefore));
    expect(screen.queryByLabelText(/occupation/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /ama okafor-lind/i }));
    await waitFor(() => expect(screen.getByLabelText(/occupation/i)).toHaveValue('Orchard manager'));
    expect(within(screen.getByRole('tab', { name: /ama okafor-lind/i })).getByLabelText('unsaved changes')).toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /bluefin orchards ltd/i })).queryByLabelText('unsaved changes')).not.toBeInTheDocument();
  });

  it('asks before closing a tab with unsaved changes', async () => {
    const { user } = await renderApp(`/workspace/${DRAFT}`);
    await waitForForm();
    await user.type(screen.getByLabelText(/registered legal name/i), 'x');
    await user.click(screen.getByRole('button', { name: /close bluefin orchards ltd/i }));
    const dialog = await screen.findByRole('dialog', { name: /close tab with unsaved changes/i });
    await user.click(within(dialog).getByRole('button', { name: /save draft and close/i }));
    await waitFor(() => expect(screen.queryByRole('tab', { name: /bluefin/i })).not.toBeInTheDocument());
    expect(getDb().requests[DRAFT]!.values.legalName).toMatch(/x$/);
  });

  it('renders reviewer comments as text, never as HTML', async () => {
    await renderApp(`/workspace/${RETURNED}`);
    const comment = await screen.findByTestId('reviewer-comment', {}, { timeout: 8000 });
    expect(comment).toHaveTextContent('<img src=x onerror="alert(1)">');
    expect(comment.querySelector('img')).toBeNull();
  });
});

describe('Session and authorization', () => {
  it('shows the expiry dialog when the server reports an expired session, then returns to sign-in', async () => {
    setScenarios({ expireSessionOnNextCall: true });
    const { user, router } = await renderApp('/');
    const dialog = await screen.findByRole('dialog', { name: /your session has expired/i }, { timeout: 8000 });
    await user.click(within(dialog).getByRole('button', { name: /sign in again/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toContain('reason=expired');
    expect(await screen.findByText(/your session expired/i)).toBeInTheDocument();
  });

  it('hides pages a role may not use, and the backend refuses the call anyway', async () => {
    await renderApp('/admin');
    expect(await screen.findByRole('heading', { name: /not available for your role/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /definitions/i })).not.toBeInTheDocument();
    await expect(api.listDefinitions()).rejects.toMatchObject({ status: 403 });
  });
});

describe('Operations Reviewer journey', () => {
  it('requires a comment for senior review, then approves the task', async () => {
    const { user, router } = await renderApp('/tasks/TASK-0007', 'OPERATIONS_REVIEWER');
    await user.click(await screen.findByRole('button', { name: /^approve$/i }, { timeout: 8000 }));
    expect(await screen.findByText(/senior approval needs a comment/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/comment/i), 'Docs verified');
    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/tasks'));
    expect(await screen.findByText(/no open tasks/i)).toBeInTheDocument();
    expect(getDb().requests['REQ-2026-000092']!.status).toBe('APPROVED');
  });

  it('shows a clear message when the backend denies a task action (403)', async () => {
    setScenarios({ denyNextTaskAction: true });
    const { user } = await renderApp('/tasks/TASK-0007', 'OPERATIONS_REVIEWER');
    await user.type(await screen.findByLabelText(/comment/i, {}, { timeout: 8000 }), 'Need more info');
    await user.click(screen.getByRole('button', { name: /return to advisor/i }));
    expect(await screen.findByText(/reassigned to another reviewer/i)).toBeInTheDocument();
    expect(getDb().requests['REQ-2026-000092']!.status).toBe('IN_REVIEW');
  });
});
