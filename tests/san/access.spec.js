const { test, expect } = require('@playwright/test');
const { MANDATORY, login } = require('./helpers');

test.describe('Application access', () => {
  test('SAN-001 Open application and log in', MANDATORY, async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByTestId('landing-heading')).toHaveText('Welcome, QA User');
    await expect(page.getByTestId('app-error')).toHaveCount(0);
  });

  test('SAN-002 Verify user profile and module access', MANDATORY, async ({ page }) => {
    await login(page, 'limited');

    await page.getByTestId('nav-profile').click();
    await expect(page.getByTestId('profile-name')).toHaveText('Inventory Clerk');
    await expect(page.getByTestId('role-item')).toHaveText(['Counter']);
    await expect(page.getByTestId('module-item')).toHaveText(['Inventory', 'Workflow']);

    // Assigned module opens, unassigned module is hidden and blocked.
    await page.getByTestId('nav-inventory').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inventory');
    await expect(page.getByTestId('nav-revenue')).toHaveCount(0);

    const response = await page.goto('/revenue');
    expect(response.status()).toBe(403);
    await expect(page.getByTestId('access-denied')).toBeVisible();
  });
});
