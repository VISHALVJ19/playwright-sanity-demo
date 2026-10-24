// Sends the sanity test result to email (SMTP) and Microsoft Teams (Workflows webhook).
// Usage: node scripts/notify.js [reports/results.json]
//
// All settings come from environment variables (GitHub Secrets in CI):
//   Email : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_TO, MAIL_FROM (optional)
//   Teams : TEAMS_WEBHOOK_URL
//   Run   : JOB_STATUS, RUN_URL, GITHUB_REPOSITORY, GITHUB_REF_NAME, GITHUB_SHA (set by the workflow)
//   NOTIFY_DRY_RUN=1 prints the email and Teams payloads instead of sending them.
//
// A channel whose settings are missing is skipped. Send errors are reported as warnings and
// never change the exit code: pass/fail of the job is decided by the test step only.
const fs = require('node:fs');
const nodemailer = require('nodemailer');
const { loadResults } = require('./results');

const file = process.argv[2] || 'reports/results.json';
const env = process.env;
const dryRun = env.NOTIFY_DRY_RUN === '1';
const REPORT_HTML = 'playwright-report/index.html';
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const results = loadResults(file);
const jobStatus = (env.JOB_STATUS || (results && results.stats.failed === 0 ? 'success' : 'failure')).toLowerCase();
const passed = jobStatus === 'success';
const runUrl = env.RUN_URL || '';
const repo = env.GITHUB_REPOSITORY || 'local run';
const branch = env.GITHUB_REF_NAME || '-';
const commit = (env.GITHUB_SHA || '').slice(0, 7) || '-';
const subject = `[${passed ? 'PASSED' : 'FAILED'}] Sanity tests - ${repo} (${branch})`;

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const warn = (msg) => console.log(`::warning::${msg}`);

// ---------- email ----------
function emailHtml() {
  const rows = (cells, tag = 'td') => `<tr>${cells.map((c) => `<${tag} style="border:1px solid #ccc;padding:4px 8px">${esc(c)}</${tag}>`).join('')}</tr>`;
  const parts = [
    `<h2 style="color:${passed ? '#0a6b2d' : '#b00020'}">Sanity tests ${passed ? 'PASSED' : 'FAILED'}</h2>`,
    `<p>Repository: <b>${esc(repo)}</b> | Branch: <b>${esc(branch)}</b> | Commit: <b>${esc(commit)}</b></p>`,
  ];
  if (!results) {
    parts.push('<p><b>No test results were produced.</b> The job failed before the tests ran (check install/setup logs). All 17 mandatory scenarios are Not run.</p>');
  } else {
    const s = results.stats;
    parts.push('<table style="border-collapse:collapse">',
      rows(['Total', 'Passed', 'Failed', 'Flaky', 'Skipped', 'Duration'], 'th'),
      rows([s.total, s.passed, s.failed, s.flaky, s.skipped, `${s.durationSec}s`]), '</table>',
      '<h3>Mandatory sanity scenarios</h3><table style="border-collapse:collapse">',
      rows(['ID', 'Scenario', 'Status'], 'th'), ...results.mandatory.map((m) => rows([m.id, m.scenario, m.label])), '</table>');
    if (results.failed.length) {
      parts.push('<h3>Failed tests</h3>', ...results.failed.map((t) =>
        `<p><b>[${esc(t.project)}] ${esc(t.title)}</b></p><pre style="background:#f6f6f6;padding:8px">${esc(t.message)}</pre>`));
    }
  }
  if (runUrl) parts.push(`<p><a href="${esc(runUrl)}">Open the GitHub Actions run</a> - full HTML report, screenshots and traces are under <b>Artifacts</b>.</p>`);
  parts.push('<p style="color:#666">The attached HTML report shows test results; screenshots and traces are in the run artifacts.</p>');
  return parts.join('\n');
}

async function sendEmail() {
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_TO'].filter((k) => !env[k]);
  if (missing.length && !dryRun) {
    console.log(`Email skipped: missing ${missing.join(', ')}`);
    return;
  }
  const port = Number(env.SMTP_PORT || 587);
  const transport = dryRun
    ? nodemailer.createTransport({ jsonTransport: true })
    // Port 465 uses TLS from the start; 587 upgrades with STARTTLS (requireTLS refuses plain text).
    : nodemailer.createTransport({ host: env.SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } });

  const attachments = [];
  if (fs.existsSync(REPORT_HTML) && fs.statSync(REPORT_HTML).size <= MAX_ATTACHMENT_BYTES) {
    attachments.push({ filename: 'playwright-report.html', path: REPORT_HTML });
  }
  const info = await transport.sendMail({
    from: env.MAIL_FROM || env.SMTP_USER || 'sanity-bot@example.test',
    to: env.MAIL_TO || 'dry-run@example.test',
    subject,
    html: emailHtml(),
    attachments,
  });
  if (dryRun) {
    const msg = JSON.parse(info.message);
    console.log('--- EMAIL (dry run) ---');
    console.log(JSON.stringify({ to: msg.to, subject: msg.subject, attachments: (msg.attachments || []).map((a) => a.filename) }, null, 2));
    console.log(msg.html);
  } else {
    console.log(`Email sent to ${env.MAIL_TO}`);
  }
}

// ---------- Teams ----------
function teamsPayload() {
  const body = [
    { type: 'TextBlock', size: 'Large', weight: 'Bolder', color: passed ? 'Good' : 'Attention', text: `Sanity tests ${passed ? 'PASSED' : 'FAILED'}` },
    { type: 'TextBlock', wrap: true, text: `${repo} | branch ${branch} | commit ${commit}` },
  ];
  if (!results) {
    body.push({ type: 'TextBlock', wrap: true, text: 'No test results were produced - the job failed before the tests ran. All 17 mandatory scenarios are Not run.' });
  } else {
    const s = results.stats;
    body.push({
      type: 'FactSet',
      facts: [
        { title: 'Total', value: String(s.total) }, { title: 'Passed', value: String(s.passed) },
        { title: 'Failed', value: String(s.failed) }, { title: 'Flaky', value: String(s.flaky) },
        { title: 'Skipped', value: String(s.skipped) }, { title: 'Duration', value: `${s.durationSec}s` },
      ],
    });
    const notPassed = results.mandatory.filter((m) => m.status !== 'expected');
    body.push({
      type: 'TextBlock', wrap: true,
      text: notPassed.length ? `Mandatory not passed: ${notPassed.map((m) => `${m.id} (${m.label})`).join(', ')}` : 'All 17 mandatory scenarios passed.',
    });
    for (const t of results.failed.slice(0, 5)) {
      body.push({ type: 'TextBlock', wrap: true, text: `❌ ${t.title}: ${t.message.split('\n')[0]}` });
    }
  }
  return {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.4',
        body,
        actions: runUrl ? [{ type: 'Action.OpenUrl', title: 'Open run and report', url: runUrl }] : [],
      },
    }],
  };
}

async function sendTeams() {
  if (dryRun) {
    console.log('--- TEAMS (dry run) ---');
    console.log(JSON.stringify(teamsPayload(), null, 2));
    return;
  }
  if (!env.TEAMS_WEBHOOK_URL) {
    console.log('Teams skipped: missing TEAMS_WEBHOOK_URL');
    return;
  }
  const res = await fetch(env.TEAMS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(teamsPayload()),
  });
  if (!res.ok) throw new Error(`Teams webhook returned HTTP ${res.status}`);
  console.log('Teams message posted');
}

(async () => {
  for (const [name, send] of [['Email', sendEmail], ['Teams', sendTeams]]) {
    try {
      await send();
    } catch (err) {
      warn(`${name} notification failed: ${err.message}`);
    }
  }
})();
