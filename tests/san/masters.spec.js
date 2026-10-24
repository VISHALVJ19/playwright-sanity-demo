const { test, expect } = require('@playwright/test');
const { MANDATORY, login } = require('./helpers');

test.describe('Masters', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('SAN-003 View account and associated locations', MANDATORY, async ({ page }) => {
    await page.getByTestId('nav-accounts').click();
    await page.getByTestId('search-input').fill('Demo School');
    await page.getByTestId('search-button').click();
    await expect(page.getByTestId('account-row')).toHaveCount(1);

    await page.getByTestId('open-ACC-100').click();
    await expect(page.getByTestId('account-name')).toHaveText('Demo School District');
    await expect(page.getByTestId('location-row')).toHaveCount(2);
    const location = page.getByTestId('location-row').filter({ hasText: 'LOC-1' });
    await expect(location).toContainText('North Campus Kitchen');
    await expect(location).toContainText('ACC-100');
  });

  test('SAN-004 View vendor and account/location relationship', MANDATORY, async ({ page }) => {
    await page.getByTestId('nav-vendors').click();
    await page.getByTestId('search-input').fill('Fresh Farms');
    await page.getByTestId('search-button').click();
    await page.getByTestId('open-VEN-10').click();

    await expect(page.getByTestId('vendor-name')).toHaveText('Fresh Farms Supply');
    await expect(page.getByTestId('vendor-status')).toHaveText('Active');
    await expect(page.getByTestId('vendor-product-line')).toHaveText(['Produce', 'Dairy']);
    const association = page.getByTestId('vendor-association-row').filter({ hasText: 'LOC-1' });
    await expect(association).toContainText('Demo School District');
    await expect(association).toContainText('North Campus Kitchen');
  });

  test('SAN-005 Open a product and verify required menu/purchase setup', MANDATORY, async ({ page }) => {
    await page.getByTestId('nav-products').click();
    await page.getByTestId('search-input').fill('Whole Milk');
    await page.getByTestId('search-button').click();
    await page.getByTestId('open-PRD-501').click();

    for (const field of ['type', 'category', 'product-line', 'purchase-unit', 'inventory-unit', 'location-types', 'meal-types']) {
      await expect(page.getByTestId(`product-${field}`), `${field} must be filled`).not.toBeEmpty();
    }
    // Menu Unit must be selected when Can Be Menued is enabled.
    await expect(page.getByTestId('product-can-be-menued')).toHaveText('Yes');
    await expect(page.getByTestId('product-menu-unit')).toHaveText('Carton');
  });
});
