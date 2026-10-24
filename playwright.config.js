// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PRACTICE_URL = `http://localhost:${process.env.PRACTICE_PORT || 3100}`;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // json feeds the GitHub Actions job summary (scripts/ci-summary.js).
  reporter: [['html', { open: 'never' }], ['list'], ['json', { outputFile: 'reports/results.json' }]],

  use: {
    baseURL: process.env.BASE_URL || 'https://www.saucedemo.com',
    testIdAttribute: 'data-test',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Local practice app used by the SAN-001..SAN-017 mandatory tests (tests/san).
  webServer: {
    command: 'node practice-app/server.js',
    url: `${PRACTICE_URL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  projects: [
    { name: 'chromium', testIgnore: 'san/**', use: { ...devices['Desktop Chrome'] } },
    { name: 'practice-app', testDir: './tests/san', use: { ...devices['Desktop Chrome'], baseURL: PRACTICE_URL } },
  ],
});