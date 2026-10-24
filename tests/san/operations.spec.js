const { test, expect } = require('@playwright/test');
const { MANDATORY, login } = require('./helpers');

test.describe('Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('SAN-014 Open inventory screens and verify account/location access', MANDATORY, async ({ page }) => {
    await page.getByTestId('nav-inventory').click();
    // Only the user's own locations are offered.
    await expect(page.getByTestId('inv-location').locator('option')).toHaveText(['North Campus Kitchen', 'South Campus Cafe']);

    await page.getByTestId('inv-location').selectOption('LOC-1');
    await page.getByTestId('open-inventory').click();
    await expect(page.getByTestId('storage-area')).toHaveText(['Dry Store', 'Walk-in Cooler']);
    await expect(page.getByTestId('count-product-row')).toHaveCount(2);
    await expect(page.getByTestId('count-product-row').first()).toContainText('Whole Milk 1L');

    const response = await page.goto('/inventory?location=LOC-3');
    expect(response.status()).toBe(403);
    await expect(page.getByTestId('access-denied')).toBeVisible();
  });

  test('SAN-015 Verify pending user transaction opens', MANDATORY, async ({ page }) => {
    await page.getByTestId('nav-workflow').click();
    for (const [tab, label] of [['active', 'Active'], ['completed', 'Completed'], ['todo', 'To Do']]) {
      await page.getByTestId(`wf-tab-${tab}`).click();
      await expect(page.getByTestId('wf-current-tab')).toHaveText(label);
    }
    await expect(page.getByTestId('txn-row').filter({ hasText: 'TXN-9001' })).toBeVisible();

    await page.getByTestId('open-TXN-9001').click();
    await expect(page.getByTestId('txn-id')).toHaveText('TXN-9001');
    await expect(page.getByTestId('txn-type')).toHaveText('Recipe approval');
    await expect(page.getByTestId('txn-status')).toHaveText('Pending approval');
    await expect(page.getByTestId('txn-action')).toHaveText(['Approve', 'Reject']);
  });

  test('SAN-016 Verify a configured notification trigger', MANDATORY, async ({ page }) => {
    await page.getByTestId('nav-notifications').click();
    const config = page.getByTestId('notif-config-row').filter({ hasText: 'Order guide change request' });
    await expect(config).toContainText('qa-recipient@example.test');
    await expect(config).toContainText('Enabled');

    // The practice app only writes to a mock outbox; nothing is emailed.
    const reference = `SAN-016 ${Date.now()}`;
    await page.getByTestId('trigger-event-type').selectOption('Order guide change request');
    await page.getByTestId('trigger-reference').fill(reference);
    await page.getByTestId('trigger-event').click();

    await expect(page.getByTestId('trigger-message')).toContainText('mock outbox');
    const sent = page.getByTestId('outbox-row').filter({ hasText: reference });
    await expect(sent).toHaveCount(1);
    await expect(sent).toContainText('qa-recipient@example.test');
  });

  test('SAN-017 Open Revenue data-entry screen', MANDATORY, async ({ page }) => {
    await page.getByTestId('nav-revenue').click();
    await page.getByTestId('rev-account').selectOption('ACC-100');
    await page.getByTestId('rev-location').selectOption('LOC-1');
    await page.getByTestId('open-revenue').click();

    const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    await expect(page.getByTestId('revenue-month')).toHaveText(currentMonth);
    await expect(page.getByTestId('revenue-account')).toHaveText('Demo School District');
    await expect(page.getByTestId('revenue-location')).toHaveText('North Campus Kitchen');
    await expect(page.getByTestId('revenue-category')).toHaveText(['Breakfast', 'Lunch', 'A la carte']);
  });
});
