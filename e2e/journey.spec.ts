import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end journeys against the production build. MSW runs in the browser (simulated backend),
 * and every test gets a fresh browser context, so localStorage demo data starts from the seed.
 */

type Role = 'Client Advisor' | 'Operations Reviewer' | 'Administrator';

async function signIn(page: Page, role: Role, returnTo = '/') {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByRole('radio', { name: new RegExp(role) }).check();
  await page.getByRole('button', { name: /continue \(demo\)/i }).click();
}

async function setScenarios(page: Page, scenarios: Record<string, unknown>) {
  await page.waitForFunction(() => 'setScenarios' in ((window as unknown as { __cep?: object }).__cep ?? {}));
  await page.evaluate((s) => (window as unknown as { __cep: { setScenarios: (v: unknown) => void } }).__cep.setScenarios(s), scenarios);
}

const DRAFT = 'REQ-2026-000091';

// Uncaught errors in the page fail the test (simulated API failures are handled, so they never surface here).
test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('advisor edits a draft, autosave recovers from a transient failure, and submit lists errors', async ({ page }) => {
  await signIn(page, 'Client Advisor', `/workspace/${DRAFT}`);
  const legalName = page.getByLabel(/registered legal name/i);
  await expect(legalName).toBeVisible();

  await setScenarios(page, { saveFailure: 'transient' });
  await legalName.fill('Bluefin Orchards Holdings Ltd');
  const status = page.getByTestId('save-status');
  await expect(status).toHaveAttribute('data-status', 'unsaved');
  // Debounced autosave: the first attempt gets a simulated 503, the safe retry (same idempotency key) succeeds.
  await expect(status).toHaveAttribute('data-status', 'saved', { timeout: 15_000 });

  // Reload: the draft comes back from the (simulated) server.
  await page.reload();
  await expect(page.getByLabel(/registered legal name/i)).toHaveValue('Bluefin Orchards Holdings Ltd');

  await page.getByRole('button', { name: /^submit$/i }).click();
  const summary = page.getByRole('alert').filter({ hasText: 'There is a problem' });
  await expect(summary).toBeVisible();
  await expect(summary.getByRole('button', { name: /date of incorporation is required/i })).toBeVisible();
});

test('a revision conflict is shown instead of silently overwriting another editor', async ({ page }) => {
  await signIn(page, 'Client Advisor', `/workspace/${DRAFT}`);
  await expect(page.getByLabel(/registered legal name/i)).toBeVisible();
  await setScenarios(page, { conflictOnNextSave: true });
  await page.getByLabel(/registered legal name/i).fill('Edited in this tab');
  // The debounced autosave carries the old base revision; a simulated colleague saved in between.
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'conflict', { timeout: 15_000 });
  await expect(page.getByTestId('conflict-banner')).toBeVisible();
  await expect(page.getByLabel(/registered legal name/i)).toHaveValue('Edited in this tab');
});

test('reviewer sees the BPMN diagram with the current task highlighted and the DMN decision', async ({ page }) => {
  await signIn(page, 'Operations Reviewer', '/requests/REQ-2026-000092');
  await page.getByRole('tab', { name: /workflow & decision/i }).click();
  const diagram = page.getByRole('img', { name: /process diagram/i });
  await expect(diagram).toBeVisible();
  // bpmn-js is lazy-loaded; the backend-reported activity gets the `cep-current` marker.
  await expect(diagram.locator('.djs-element.cep-current')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByTestId('risk-tier')).toBeVisible();
});

test('a role without permission cannot reach admin pages', async ({ page }) => {
  await signIn(page, 'Client Advisor', '/admin');
  await expect(page.getByRole('heading', { name: /not available for your role/i })).toBeVisible();
});
