// Shared reader for Playwright's JSON report (reports/results.json).
// Used by ci-summary.js (GitHub job summary) and notify.js (email / Teams).
const fs = require('node:fs');

const MANDATORY_IDS = Array.from({ length: 17 }, (_, i) => `SAN-${String(i + 1).padStart(3, '0')}`);
const STATUS_LABEL = {
  expected: 'Passed',
  unexpected: 'Failed',
  flaky: 'Flaky (passed on retry)',
  skipped: 'Skipped',
};

const stripAnsi = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '');
const firstLines = (s, n = 6) => stripAnsi(s).split('\n').slice(0, n).join('\n');

// Returns null when the file is missing (the job failed before tests produced results).
function loadResults(file) {
  if (!fs.existsSync(file)) return null;
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));

  const tests = [];
  (function walk(suite) {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests) tests.push({ title: spec.title, file: spec.file, project: t.projectName, status: t.status, results: t.results });
    }
    for (const child of suite.suites || []) walk(child);
  })({ suites: report.suites });

  const s = report.stats;
  const mandatory = MANDATORY_IDS.map((id) => {
    const t = tests.find((x) => x.title.startsWith(`${id} `));
    return t
      ? { id, scenario: t.title.slice(id.length + 1), status: t.status, label: STATUS_LABEL[t.status] || t.status }
      : { id, scenario: '-', status: 'notrun', label: 'Not run' };
  });
  const failed = tests.filter((t) => t.status === 'unexpected').map((t) => {
    const last = t.results[t.results.length - 1] || {};
    return { ...t, message: firstLines((last.error && last.error.message) || 'No error message') };
  });

  return {
    stats: {
      total: s.expected + s.unexpected + s.flaky + s.skipped,
      passed: s.expected,
      failed: s.unexpected,
      flaky: s.flaky,
      skipped: s.skipped,
      durationSec: (s.duration / 1000).toFixed(1),
    },
    mandatory,
    failed,
    errors: (report.errors || []).map((e) => firstLines(e.message)),
  };
}

module.exports = { loadResults };
