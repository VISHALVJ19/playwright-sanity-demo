// Turns Playwright's JSON report into a Markdown summary for the GitHub Actions job page.
// Usage: node scripts/ci-summary.js [reports/results.json] >> "$GITHUB_STEP_SUMMARY"
// Always exits 0: pass/fail is decided by the test step, this script only reports.
const { loadResults } = require('./results');

const file = process.argv[2] || 'reports/results.json';
const ICON = { expected: '✅', unexpected: '❌', flaky: '⚠️', skipped: '⏭️', notrun: '🚫' };
const out = [];
const r = loadResults(file);

if (!r) {
  out.push('## Sanity test summary', '');
  out.push(`:warning: No results file at \`${file}\`. The job failed before the tests produced results`);
  out.push('(check the install / browser setup step logs). All 17 mandatory scenarios are **Not run**.');
  console.log(out.join('\n'));
  process.exit(0);
}

const s = r.stats;
out.push('## Sanity test summary', '');
out.push('| Total | Passed | Failed | Flaky | Skipped | Duration |', '|---|---|---|---|---|---|');
out.push(`| ${s.total} | ${s.passed} | ${s.failed} | ${s.flaky} | ${s.skipped} | ${s.durationSec}s |`, '');

out.push('### Mandatory sanity scenarios (SAN-001..SAN-017)', '', '| ID | Scenario | Status |', '|---|---|---|');
for (const m of r.mandatory) out.push(`| ${m.id} | ${m.scenario} | ${ICON[m.status] || ''} ${m.label} |`);

if (r.failed.length) {
  out.push('', '### Failed tests', '');
  for (const t of r.failed) {
    out.push(`<details><summary><b>[${t.project}] ${t.title}</b> (${t.file})</summary>`, '', '```', t.message, '```', '</details>');
  }
}

if (r.errors.length) {
  out.push('', '### Run errors (outside individual tests)', '', '```', ...r.errors, '```');
}

out.push('', 'Full HTML report, screenshots and traces: see the **Artifacts** section at the bottom of this run page.');
console.log(out.join('\n'));
