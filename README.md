# Playwright Sanity Demo

A personal practice project for running a Playwright sanity suite in GitHub Actions.
It holds two groups of tests:

| Group | Folder | Target | Playwright project |
|---|---|---|---|
| Demo tests TC01-TC03 | `tests/sanity.spec.js` | Public demo site https://www.saucedemo.com | `chromium` |
| Mandatory sanity SAN-001 to SAN-017 | `tests/san/` | Local **practice app** (`practice-app/`) | `practice-app` |

> **Important:** The practice app is a small mock built for learning. It copies the
> *structure* of the 17 scenarios in the sanity workbook (login, masters, recipe, menu,
> purchase, inventory, workflow, notifications, revenue). It is **not** the company
> application. Passing tests here do **not** mean the company scenarios pass. To use this
> in the company repo, the selectors, URLs and test data must be swapped for approved
> values from the QA environment.

## Prerequisites

- Node.js 24 (`node -v`) and npm (`npm -v`)
- Git (`git --version`)

## Run locally (Windows PowerShell)

```powershell
npm ci                                   # install exact versions from package-lock.json
npx playwright install chromium          # download the browser once
npm run test:sanity                      # all @sanity tests (TC01-03 + SAN-001..017)
npm run test:mandatory                   # only the 17 mandatory SAN tests
npm run report                           # open the HTML report
```

Playwright starts the practice app automatically (`webServer` in `playwright.config.js`).
To look at the app in a browser yourself, run `npm run start:practice-app` and open
http://localhost:3100 (practice users are in `practice-app/seed-data.js`).

## Run in CI (GitHub Actions)

Workflow: `.github/workflows/playwright.yml`

- Triggers: push to `main`, pull request to `main`, manual run (`workflow_dispatch`), and a daily schedule.
- Steps: checkout → Node 24 → `npm ci` → install Chromium → `npm run test:sanity` → job summary → upload artifacts.
- If any test fails, the job is **red**. The summary and artifacts are still published (`if: always()`).

Where to find the results after a run (**Actions** tab → open the run):

| What | Where |
|---|---|
| Total / passed / failed / flaky / skipped, duration, the SAN-001..017 status table, failed test errors | Run page → **Summary** |
| HTML report | **Artifacts** → `playwright-report-<run number>` → download zip → extract → open `index.html` (or run `npx playwright show-report <folder>`) |
| Screenshots, videos, traces, `results.json` | **Artifacts** → `playwright-evidence-<run number>` |
| Raw step logs | Run page → job `sanity-tests` → expand a step |

Open a trace with `npx playwright show-trace path\to\trace.zip`.

## Secrets and environment variables

| Variable | Used by | Default when not set |
|---|---|---|
| `BASE_URL` | demo tests | `https://www.saucedemo.com` |
| `APP_USER` / `APP_PASS` | demo tests | saucedemo public demo user |
| `SAN_USER` / `SAN_PASS` | SAN tests (main test user) | practice seed user |
| `PRACTICE_PORT` | practice app | `3100` |

In CI, add values under **Settings → Secrets and variables → Actions → New repository secret**.
Never write real passwords, tokens or company URLs in YAML or source files.

## Mandatory scenario mapping

| ID | Scenario | Test file | Safety note |
|---|---|---|---|
| SAN-001 | Open application and log in | `tests/san/access.spec.js` | read-only |
| SAN-002 | User profile and module access | `tests/san/access.spec.js` | read-only (uses `limited_user`) |
| SAN-003 | Account and locations | `tests/san/masters.spec.js` | read-only |
| SAN-004 | Vendor and account/location relationship | `tests/san/masters.spec.js` | read-only |
| SAN-005 | Product menu/purchase setup | `tests/san/masters.spec.js` | read-only |
| SAN-006 | Open and save a recipe | `tests/san/recipe.spec.js` | saves notes in the practice app only |
| SAN-007 | Finished-meal meal type and workflow | `tests/san/recipe.spec.js` | changes practice data only |
| SAN-008 | Recipe calculations and print | `tests/san/recipe.spec.js` | read-only |
| SAN-009 | Menu planning prerequisites | `tests/san/menu.spec.js` | adds an item to a 2030 practice menu |
| SAN-010 | Menu save and display | `tests/san/menu.spec.js` | read-only |
| SAN-011 | Recipe quantities vs menu print | `tests/san/menu.spec.js` | read-only |
| SAN-012 | Order guide products | `tests/san/purchase.spec.js` | read-only |
| SAN-013 | Review a test purchase order | `tests/san/purchase.spec.js` | review only, submit is disabled |
| SAN-014 | Inventory account/location access | `tests/san/operations.spec.js` | read-only |
| SAN-015 | Pending workflow transaction | `tests/san/operations.spec.js` | read-only, actions not clicked |
| SAN-016 | Notification trigger | `tests/san/operations.spec.js` | mock outbox, no email is sent |
| SAN-017 | Revenue data entry | `tests/san/operations.spec.js` | read-only |

Optional regression cases (REG-xxx) and rollout/DB checklist items are intentionally not part of this suite.
