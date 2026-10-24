const { test, expect } = require('@playwright/test');
const { MANDATORY, login } = require('./helpers');

test.describe('Purchase', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('SAN-012 Open order guide and verify products', MANDATORY, async ({ page }) => {
    await page.getByTestId('nav-order-guide').click();
    await page.getByTestId('og-account').selectOption('ACC-100');
    await page.getByTestId('open-order-guide').click();

    await expect(page.getByTestId('og-name')).toHaveText('Demo School Weekly Guide');
    await expect(page.getByTestId('og-product-row')).toHaveCount(2);
    await expect(page.getByTestId('og-product-row').first()).toContainText('Whole Milk 1L');
    // Only active templates may be offered for import.
    await expect(page.getByTestId('og-template').locator('option')).toHaveText(['Weekly Dairy Template']);
  });

  test('SAN-013 Create or review a test purchase order', MANDATORY, async ({ page }) => {
    await page.getByTestId('nav-purchase').click();
    await page.getByTestId('po-location').selectOption('LOC-1');
    await page.getByTestId('po-vendor').selectOption('VEN-10');
    await page.getByTestId('po-product').selectOption('PRD-501');
    await page.getByTestId('po-qty').fill('3');
    await page.getByTestId('po-delivery-date').fill('2030-01-20');
    await page.getByTestId('review-po').click();

    await expect(page.getByTestId('po-error')).toHaveCount(0);
    await expect(page.getByTestId('review-vendor')).toHaveText('Fresh Farms Supply');
    await expect(page.getByTestId('review-location')).toHaveText('North Campus Kitchen');
    await expect(page.getByTestId('review-product')).toHaveText('Whole Milk 1L');
    await expect(page.getByTestId('review-qty')).toHaveText('3');
    await expect(page.getByTestId('review-unit')).toHaveText('Case (12)');
    await expect(page.getByTestId('review-delivery')).toHaveText('2030-01-20');
    await expect(page.getByTestId('po-status')).toHaveText('Draft (not submitted)');
    // Review only: submission is not authorized, so the test never submits.
    await expect(page.getByTestId('submit-po')).toBeDisabled();
  });
});
