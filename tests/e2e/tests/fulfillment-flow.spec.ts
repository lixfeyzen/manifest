import { expect, test } from '@playwright/test';

/**
 * Critical user journey: create an order, pay it via the simulated webhook,
 * watch it reach FULFILLED, then send a duplicate webhook and confirm it is
 * ignored without creating a second invoice.
 */
test('create -> pay -> fulfilled -> duplicate ignored', async ({ page }) => {
  // 1. Create an order.
  await page.goto('/orders/new');
  await expect(page.getByRole('heading', { name: 'New order' })).toBeVisible();

  await page.getByLabel('Customer email').fill('noah.carter@gmail.com');
  await page.getByLabel('Product').selectOption('SKU-STICKER');
  await page.getByLabel('Quantity').fill('2');
  await page.getByRole('button', { name: 'Create order' }).click();

  // 2. Land on the order detail page, status PENDING.
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
  await expect(page.getByText('Pending', { exact: true })).toBeVisible();

  // 3. Simulate the payment webhook.
  await page.getByRole('button', { name: 'Simulate Payment Webhook' }).click();

  // 4. The worker fulfills asynchronously; the page refreshes itself. The invoice
  //    number only exists once the order reaches FULFILLED, so wait on that.
  await expect(page.getByText(/INV-\d{8}-/)).toBeVisible({ timeout: 20_000 });

  // 5. Capture the invoice number, then send a duplicate webhook.
  const invoiceText = await page
    .getByText(/INV-\d{8}-/)
    .first()
    .textContent();

  await page.getByRole('button', { name: 'Simulate Duplicate Webhook' }).click();
  await expect(page.getByText(/ignored/i)).toBeVisible({ timeout: 10_000 });

  // 6. Still exactly one invoice with the same number: no duplicate created.
  await expect(page.getByText(/INV-\d{8}-/)).toHaveCount(1);
  expect(
    await page
      .getByText(/INV-\d{8}-/)
      .first()
      .textContent(),
  ).toBe(invoiceText);
});

test('dashboard loads with metrics', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Total orders')).toBeVisible();
});
