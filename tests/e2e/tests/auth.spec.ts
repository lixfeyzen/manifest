import { expect, test } from '@playwright/test';

// These run WITHOUT the shared authenticated state (see the 'auth' project).
test('unauthenticated visitor is redirected to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Operator sign-in' })).toBeVisible();
});

test('demo user can sign in and reach the dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('demo@manifest.dev');
  await page.getByLabel('Password').fill('fulfillment');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Total orders')).toBeVisible();
});
