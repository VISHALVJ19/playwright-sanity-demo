const { test, expect } = require('@playwright/test');

const USER = process.env.APP_USER || 'standard_user';
const PASS = process.env.APP_PASS || 'secret_sauce';

test.describe('Sanity Suite @sanity', () => {

  // Har test se pehle login karo
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('username').fill(USER);
    await page.getByTestId('password').fill(PASS);
    await page.getByTestId('login-button').click();
  });

  test('TC01 - User login successful', async ({ page }) => {
    await expect(page).toHaveURL(/inventory/);
    await expect(page.getByTestId('inventory-list')).toBeVisible();
  });

  test('TC02 - Add product to cart', async ({ page }) => {
    await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
    await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
  });

  test('TC03 - Logout works', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Menu' }).click();
    await page.getByTestId('logout-sidebar-link').click();
    await expect(page.getByTestId('login-button')).toBeVisible();
  });

});