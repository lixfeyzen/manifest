import { expect, test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

// Logs in the seeded demo user once and saves the authenticated storage state
// (including the httpOnly session cookie) for the main test project to reuse.
setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('demo@manifest.dev');
  await page.getByLabel('Password').fill('demo12345');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 20_000 });
  await page.context().storageState({ path: authFile });
});
