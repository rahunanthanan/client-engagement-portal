import { expect, test } from '@playwright/test';

/** Visits each main page per role and fails on uncaught errors or React/console errors. */
const PAGES: Array<[string, string[]]> = [
  ['Client Advisor', ['/', '/requests/new', '/workspace/REQ-2026-000091', '/requests/REQ-2026-000088']],
  ['Operations Reviewer', ['/tasks', '/tasks/TASK-0007']],
  ['Administrator', ['/admin', '/admin/process/client-request-process', '/admin/decision/risk-tier', '/admin/formjs/supplementary-questionnaire', '/admin/form/onboarding.corporate-entity']],
];

for (const [role, paths] of PAGES) {
  test(`${role}: main pages render without console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${m.text()} ${m.location().url}`));
    await page.goto('/login');
    await page.getByRole('radio', { name: new RegExp(role) }).check();
    await page.getByRole('button', { name: /continue \(demo\)/i }).click();
    await expect(page.getByRole('navigation').first()).toBeVisible();
    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator('h1, h2').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
    }
    expect(errors).toEqual([]);
  });
}
