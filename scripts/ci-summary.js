// Turns Playwright's JSON report into a Markdown summary for the GitHub Actions job page.
// Usage: node scripts/ci-summary.js [reports/results.json] >> "$GITHUB_STEP_SUMMARY"
// Always exits 0: pass/fail is decided by the test step, this script only reports.
const fs = require('node:fs');

const file = process.argv[2] || 'reports/results.json';
const MANDATORY_IDS = Array.from({ length: 17 }, (_, i) => `SAN-${String(i + 1).padStart(3, '0')}`);
const STATUS = {
  expected: '✅ Passed',
  unexpected: '❌ Failed',
  flaky: '⚠️ Flaky (passed on retry)',
  skipped: '⏭️ Skipped',
};
const out = [];
const stripAnsi = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '');

if (!fs.existsSync(file)) {
  out.push('## Sanity test summary', '');
  out.push(`:warning: No results file at \`${file}\`. The job failed before the tests produced results`);
  out.push('(check the install / browser setup step logs). All 17 mandatory scenarios are **Not run**.');
  console.log(out.join('\n'));
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const tests = [];
(function walk(suite) {
  for (const spec of suite.specs || []) {
    for (const t of spec.tests) tests.push({ title: spec.title, file: spec.file, project: t.projectName, status: t.status, results: t.results });
  }
  for (const child of suite.suites || []) walk(child);
})({ suites: report.suites });

const s = report.stats;
const total = s.expected + s.unexpected + s.flaky + s.skipped;
out.push('## Sanity test summary', '');
out.push('| Total | Passed | Failed | Flaky | Skipped | Duration |', '|---|---|---|---|---|---|');
out.push(`| ${total} | ${s.expected} | ${s.unexpected} | ${s.flaky} | ${s.skipped} | ${(s.duration / 1000).toFixed(1)}s |`, '');

out.push('### Mandatory sanity scenarios (SAN-001..SAN-017)', '', '| ID | Scenario | Status |', '|---|---|---|');
for (const id of MANDATORY_IDS) {
  const t = tests.find((x) => x.title.startsWith(`${id} `));
  out.push(t ? `| ${id} | ${t.title.slice(id.length + 1)} | ${STATUS[t.status] || t.status} |` : `| ${id} | - | 🚫 Not run |`);
}

const failed = tests.filter((t) => t.status === 'unexpected');
if (failed.length) {
  out.push('', '### Failed tests', '');
  for (const t of failed) {
    const last = t.results[t.results.length - 1] || {};
    const message = stripAnsi((last.error && last.error.message) || 'No error message').split('\n').slice(0, 6).join('\n');
    out.push(`<details><summary><b>[${t.project}] ${t.title}</b> (${t.file})</summary>`, '', '```', message, '```', '</details>');
  }
}

if (report.errors && report.errors.length) {
  out.push('', '### Run errors (outside individual tests)', '', '```');
  for (const e of report.errors) out.push(stripAnsi(e.message).split('\n').slice(0, 6).join('\n'));
  out.push('```');
}

out.push('', 'Full HTML report, screenshots and traces: see the **Artifacts** section at the bottom of this run page.');
console.log(out.join('\n'));
