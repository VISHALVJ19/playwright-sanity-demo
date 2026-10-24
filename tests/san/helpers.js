const { expect } = require('@playwright/test');
const seed = require('../../practice-app/seed-data');

// Tags used by every mandatory sanity test (picked up by `--grep @sanity` / `--grep @mandatory`).
const MANDATORY = { tag: ['@sanity', '@mandatory'] };

// Main test user comes from env (GitHub Secrets in CI) and falls back to the practice seed user.
function credentials(userKey) {
  const user = seed.users.find((u) => u.key === userKey);
  if (userKey === 'qa') {
    return { username: process.env.SAN_USER || user.username, password: process.env.SAN_PASS || user.password };
  }
  return { username: user.username, password: user.password };
}

async function login(page, userKey = 'qa') {
  const { username, password } = credentials(userKey);
  await page.goto('/login');
  await page.getByTestId('username').fill(username);
  await page.getByTestId('password').fill(password);
  await page.getByTestId('login-button').click();
  await expect(page.getByTestId('landing-heading')).toBeVisible();
}

// Reads every row of a table locator as [[cell, cell, ...], ...].
const tableCells = (rows) => rows.evaluateAll((trs) =>
  trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())));

module.exports = { MANDATORY, login, seed, tableCells };
