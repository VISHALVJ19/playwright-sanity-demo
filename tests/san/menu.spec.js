const { test, expect } = require('@playwright/test');
const { MANDATORY, login, tableCells } = require('./helpers');

test.describe('Menu', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('SAN-009 Open menu planning and verify prerequisites', MANDATORY, async ({ page }) => {
    await page.getByTestId('nav-menu').click();
    await page.getByTestId('plan-account').selectOption('ACC-100');
    await page.getByTestId('plan-location').selectOption('LOC-1');
    // Non-production practice date, separate from the menu SAN-010 reads.
    await page.getByTestId('plan-date').fill('2030-01-15');
    await page.getByTestId('open-planning').click();

    await expect(page.getByTestId('meal-period')).toHaveText('Lunch');
    await expect(page.getByTestId('location-type')).toHaveText('School');

    // A product that is not menu-eligible must not be offered.
    await page.getByTestId('item-search').fill('Carrots');
    await page.getByTestId('item-search-button').click();
    await expect(page.getByTestId('menu-search-result')).toHaveCount(0);

    await page.getByTestId('item-search').fill('Pasta');
    await page.getByTestId('item-search-button').click();
    await expect(page.getByTestId('menu-search-result')).toHaveCount(1);
    await page.getByTestId('add-RCP-701').click();

    await expect(page.getByTestId('menu-save-message')).toHaveText('Menu saved');
    await expect(page.getByTestId('planned-item')).toContainText(['Veg Pasta']);
  });

  test('SAN-010 Verify menu save and core menu item display', MANDATORY, async ({ page }) => {
    await page.goto('/menu/month?location=LOC-1&month=2030-01');
    const day = page.getByTestId('day-2030-01-10');
    await expect(day.getByTestId('menu-item')).toHaveText(['Whole Milk 1L', 'Veg Pasta']);
    await expect(page.getByTestId('day-2030-01-11').getByTestId('menu-item')).toHaveCount(0);

    await page.reload();
    await expect(day.getByTestId('menu-item')).toHaveText(['Whole Milk 1L', 'Veg Pasta']);
  });

  test('SAN-011 Verify recipe ingredient quantities and menu print', MANDATORY, async ({ page }) => {
    await page.goto('/recipes/RCP-701?tab=components');
    const recipeIngredients = await tableCells(page.getByTestId('component-row'));
    expect(recipeIngredients.length).toBeGreaterThan(0);

    await page.goto('/menu/print?location=LOC-1&date=2030-01-10');
    const printed = await tableCells(page.getByTestId('print-recipe-RCP-701').getByTestId('print-ingredient'));
    expect(printed, 'menu print must match recipe name/quantity/unit').toEqual(recipeIngredients);
  });
});
