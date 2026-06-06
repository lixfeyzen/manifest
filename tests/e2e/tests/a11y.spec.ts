import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Accessibility regression guard. Runs axe-core against the redesigned pages and
 * fails on any serious/critical WCAG 2 A/AA violation. Runs in the authenticated
 * `chromium` project (storageState from the auth setup), so the dashboard loads.
 */
const tags = ['wcag2a', 'wcag2aa'];

function serious(violations: { impact?: string | null; id: string }[]) {
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

test('login page has no serious accessibility violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  const found = serious(results.violations);
  expect(found.map((v) => v.id)).toEqual([]);
});

test('dashboard has no serious accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  const found = serious(results.violations);
  expect(found.map((v) => v.id)).toEqual([]);
});

test('orders page has no serious accessibility violations', async ({ page }) => {
  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  const found = serious(results.violations);
  expect(found.map((v) => v.id)).toEqual([]);
});
