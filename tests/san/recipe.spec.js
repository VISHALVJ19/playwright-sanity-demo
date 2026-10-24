const { test, expect } = require('@playwright/test');
const { MANDATORY, login, seed } = require('./helpers');

test.describe('Recipe', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('SAN-006 Open and save a recipe', MANDATORY, async ({ page }) => {
    await page.getByTestId('nav-recipes').click();
    await page.getByTestId('search-input').fill('Veg Pasta');
    await page.getByTestId('search-button').click();
    await page.getByTestId('open-RCP-701').click();
    await expect(page.getByTestId('recipe-name')).toHaveText('Veg Pasta');

    for (const tab of ['components', 'nutrition', 'details']) {
      await page.getByTestId(`tab-${tab}`).click();
      await expect(page.getByTestId(`section-${tab}`)).toBeVisible();
    }
    await page.getByTestId('tab-components').click();
    await expect(page.getByTestId('component-row')).toHaveCount(2);

    // Approved test change: only the free-text notes field of the practice recipe.
    const note = `Sanity check ${Date.now()}`;
    await page.getByTestId('tab-details').click();
    await page.getByTestId('recipe-notes').fill(note);
    await page.getByTestId('save-recipe').click();
    await expect(page.getByTestId('save-message')).toHaveText('Recipe saved');
    await page.reload();
    await expect(page.getByTestId('recipe-notes')).toHaveValue(note);
  });

  test('SAN-007 Verify finished-meal mandatory meal type and workflow', MANDATORY, async ({ page }) => {
    await page.goto('/recipes/RCP-702');
    await expect(page.getByTestId('recipe-type')).toHaveText('Finished Meal');
    await page.getByTestId('open-workflow').click();

    const mealType = page.getByTestId('meal-type');
    const complete = page.getByTestId('complete-workflow');
    await expect(mealType).toHaveValue('Breakfast');

    await mealType.selectOption('');
    await expect(complete).toBeDisabled();
    await expect(page.getByTestId('meal-type-error')).toBeVisible();

    await mealType.selectOption('Breakfast');
    await expect(complete).toBeEnabled();
    await expect(page.getByTestId('meal-type-error')).toBeHidden();
    await complete.click();
    await expect(page.getByTestId('workflow-status')).toHaveText('Completed');
  });

  test('SAN-008 Verify recipe calculations and print output', MANDATORY, async ({ page }) => {
    const expected = seed.recipes.find((r) => r.id === 'RCP-701').nutrition;

    await page.goto('/recipes/RCP-701?tab=nutrition');
    for (const [key, value] of Object.entries(expected)) {
      await expect(page.getByTestId(`nutrition-${key}`)).toHaveText(String(value));
    }

    await page.getByTestId('print-recipe').click();
    await expect(page).toHaveURL(/\/recipes\/RCP-701\/print$/);
    for (const [key, value] of Object.entries(expected)) {
      await expect(page.getByTestId(`print-${key}`)).toHaveText(String(value));
    }
  });
});
