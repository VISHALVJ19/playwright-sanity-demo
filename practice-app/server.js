// Local practice app: a small in-memory mock of the modules covered by the
// mandatory sanity workbook (SAN-001..SAN-017). It gives the Playwright suite a
// safe target - no real data, no real emails, no real purchase orders.
// Data resets every time the server restarts. No npm dependencies needed.
const http = require('node:http');
const crypto = require('node:crypto');
const seed = require('./seed-data');

const PORT = Number(process.env.PRACTICE_PORT || 3100);
const db = structuredClone(seed);
db.outbox = [];
const sessions = new Map();

const MODULE_LINKS = [
  ['accounts', 'accounts', 'Accounts', '/accounts'],
  ['vendors', 'vendors', 'Vendors', '/vendors'],
  ['products', 'products', 'Products', '/products'],
  ['recipes', 'recipes', 'Recipes', '/recipes'],
  ['menu', 'menu', 'Menu Planning', '/menu/planning'],
  ['purchase', 'order-guide', 'Order Guide', '/order-guide'],
  ['purchase', 'purchase', 'Purchase', '/purchase/new'],
  ['inventory', 'inventory', 'Inventory', '/inventory'],
  ['workflow', 'workflow', 'Workflow', '/workflow'],
  ['notifications', 'notifications', 'Notifications', '/notifications'],
  ['revenue', 'revenue', 'Revenue', '/revenue'],
];

// ---------- helpers ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = (list, id) => list.find((x) => x.id === id);
const itemName = (id) => (byId(db.products, id) || byId(db.recipes, id) || {}).name || id;
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function layout(user, title, body) {
  const nav = user
    ? MODULE_LINKS.filter(([mod]) => user.modules.includes(mod))
      .map(([, key, label, href]) => `<a data-test="nav-${key}" href="${href}">${label}</a>`).join(' ')
      + ` | <a data-test="nav-profile" href="/profile">Profile</a> <a data-test="logout" href="/logout">Logout</a>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)} | Practice App</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;margin:0}header{background:#1f3a5f;color:#fff;padding:8px 16px}
header a{color:#fff;margin-right:8px}main{padding:16px}table{border-collapse:collapse;margin:8px 0}
td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}.msg{color:#0a6b2d}.error{color:#b00020}
.cal td{vertical-align:top;width:110px;height:60px}label{display:block;margin:6px 0}</style></head><body>
<header><strong>Practice App</strong> ${user ? `(<span data-test="current-user">${esc(user.displayName)}</span>)` : ''} ${nav}</header>
<main><h1>${esc(title)}</h1>${body}</main></body></html>`;
}

const table = (headers, rows) =>
  `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;

const searchForm = (action, q) =>
  `<form method="get" action="${action}"><input name="q" data-test="search-input" value="${esc(q)}" placeholder="Search">
<button data-test="search-button">Search</button></form>`;

const options = (list, selected, valueKey = 'id', labelKey = 'name') =>
  list.map((x) => `<option value="${esc(x[valueKey])}"${x[valueKey] === selected ? ' selected' : ''}>${esc(x[labelKey])}</option>`).join('');

const userLocations = (user) => db.locations.filter((l) => user.locations.includes(l.id));
const userAccounts = (user) => db.accounts.filter((a) => user.accounts.includes(a.id));

function requireLocation(user, locationId, accountId) {
  const loc = byId(db.locations, locationId);
  if (!loc || !user.locations.includes(loc.id)) throw new HttpError(403, 'You do not have access to this location.');
  if (accountId && loc.accountId !== accountId) throw new HttpError(400, 'Location does not belong to the selected account.');
  return loc;
}

function matches(item, q) {
  q = q.toLowerCase();
  return !q || item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
}

// ---------- routes ----------
// Each route: [method, pattern, module (or null), handler(ctx) -> html string | {redirect}]
const routes = [];
const route = (method, pattern, module, handler) => routes.push({ method, pattern, module, handler });

route('GET', /^\/login$/, null, ({ url }) => layout(null, 'Sign in', `
${url.searchParams.get('error') ? '<p class="error" data-test="login-error">Invalid username or password.</p>' : ''}
<form method="post" action="/login">
<label>Username <input name="username" data-test="username" autocomplete="username"></label>
<label>Password <input name="password" type="password" data-test="password" autocomplete="current-password"></label>
<button data-test="login-button">Sign in</button></form>`));

route('GET', /^\/home$/, null, ({ user }) => layout(user, 'Home', `
<h2 data-test="landing-heading">Welcome, ${esc(user.displayName)}</h2><p>Select a module from the menu above.</p>`));

route('GET', /^\/profile$/, null, ({ user }) => layout(user, 'My Profile', `
<p>User: <span data-test="profile-user">${esc(user.username)}</span></p>
<p>Profile: <span data-test="profile-name">${esc(user.profile)}</span></p>
<h3>Roles</h3><ul>${user.roles.map((r) => `<li data-test="role-item">${esc(r)}</li>`).join('')}</ul>
<h3>Modules</h3><ul>${user.modules.map((m) => `<li data-test="module-item">${esc(capitalize(m))}</li>`).join('')}</ul>`));

// SAN-003 accounts / locations
route('GET', /^\/accounts$/, 'accounts', ({ user, url }) => {
  const q = url.searchParams.get('q') || '';
  const rows = userAccounts(user).filter((a) => matches(a, q)).map((a) =>
    `<tr data-test="account-row"><td>${a.id}</td><td>${esc(a.name)}</td><td><a data-test="open-${a.id}" href="/accounts/${a.id}">Open</a></td></tr>`);
  return layout(user, 'Accounts', searchForm('/accounts', q) + table(['ID', 'Name', ''], rows));
});

route('GET', /^\/accounts\/([\w-]+)$/, 'accounts', ({ user, params }) => {
  const acc = byId(db.accounts, params[0]);
  if (!acc || !user.accounts.includes(acc.id)) throw new HttpError(404, 'Account not found.');
  const rows = db.locations.filter((l) => l.accountId === acc.id).map((l) =>
    `<tr data-test="location-row"><td>${l.id}</td><td>${esc(l.name)}</td><td>${esc(l.type)}</td><td>${acc.id}</td></tr>`);
  return layout(user, 'Account', `<p>Name: <span data-test="account-name">${esc(acc.name)}</span></p>
<h3>Locations</h3>${table(['Location ID', 'Name', 'Type', 'Account'], rows)}`);
});

// SAN-004 vendors
route('GET', /^\/vendors$/, 'vendors', ({ user, url }) => {
  const q = url.searchParams.get('q') || '';
  const rows = db.vendors.filter((v) => matches(v, q)).map((v) =>
    `<tr data-test="vendor-row"><td>${v.id}</td><td>${esc(v.name)}</td><td><a data-test="open-${v.id}" href="/vendors/${v.id}">Open</a></td></tr>`);
  return layout(user, 'Vendors', searchForm('/vendors', q) + table(['ID', 'Name', ''], rows));
});

route('GET', /^\/vendors\/([\w-]+)$/, 'vendors', ({ user, params }) => {
  const v = byId(db.vendors, params[0]);
  if (!v) throw new HttpError(404, 'Vendor not found.');
  const rows = v.locations.map((id) => byId(db.locations, id)).map((l) =>
    `<tr data-test="vendor-association-row"><td>${esc(byId(db.accounts, l.accountId).name)}</td><td>${l.id}</td><td>${esc(l.name)}</td></tr>`);
  return layout(user, 'Vendor', `<p>Name: <span data-test="vendor-name">${esc(v.name)}</span></p>
<p>Status: <span data-test="vendor-status">${esc(v.status)}</span></p>
<h3>Product lines</h3><ul>${v.productLines.map((p) => `<li data-test="vendor-product-line">${esc(p)}</li>`).join('')}</ul>
<h3>Account / location associations</h3>${table(['Account', 'Location ID', 'Location'], rows)}`);
});

// SAN-005 products
route('GET', /^\/products$/, 'products', ({ user, url }) => {
  const q = url.searchParams.get('q') || '';
  const rows = db.products.filter((p) => matches(p, q)).map((p) =>
    `<tr data-test="product-row"><td>${p.id}</td><td>${esc(p.name)}</td><td><a data-test="open-${p.id}" href="/products/${p.id}">Open</a></td></tr>`);
  return layout(user, 'Product Summary', searchForm('/products', q) + table(['ID', 'Name', ''], rows));
});

route('GET', /^\/products\/([\w-]+)$/, 'products', ({ user, params }) => {
  const p = byId(db.products, params[0]);
  if (!p) throw new HttpError(404, 'Product not found.');
  const fields = [
    ['name', 'Name', p.name], ['type', 'Product type', p.type], ['category', 'Category', p.category],
    ['product-line', 'Product line', p.productLine], ['purchase-unit', 'Purchase unit', p.purchaseUnit],
    ['inventory-unit', 'Inventory unit', p.inventoryUnit], ['location-types', 'Location types', p.locationTypes.join(', ')],
    ['meal-types', 'Meal types', p.mealTypes.join(', ')], ['can-be-menued', 'Can be menued', p.canBeMenued ? 'Yes' : 'No'],
    ['menu-unit', 'Menu unit', p.menuUnit],
  ];
  return layout(user, 'Product', `<dl>${fields.map(([k, label, val]) =>
    `<dt>${label}</dt><dd data-test="product-${k}">${esc(val)}</dd>`).join('')}</dl>`);
});

// SAN-006/007/008 recipes
route('GET', /^\/recipes$/, 'recipes', ({ user, url }) => {
  const q = url.searchParams.get('q') || '';
  const rows = db.recipes.filter((r) => matches(r, q)).map((r) =>
    `<tr data-test="recipe-row"><td>${r.id}</td><td>${esc(r.name)}</td><td><a data-test="open-${r.id}" href="/recipes/${r.id}">Open</a></td></tr>`);
  return layout(user, 'Recipe Summary', searchForm('/recipes', q) + table(['ID', 'Name', ''], rows));
});

const componentRows = (r, testId) => r.components.map((c) =>
  `<tr data-test="${testId}"><td>${esc(c.name)}</td><td>${c.qty}</td><td>${esc(c.unit)}</td></tr>`);

route('GET', /^\/recipes\/([\w-]+)$/, 'recipes', ({ user, params, url }) => {
  const r = byId(db.recipes, params[0]);
  if (!r) throw new HttpError(404, 'Recipe not found.');
  const tab = url.searchParams.get('tab') || 'details';
  const tabs = ['details', 'components', 'nutrition'].map((t) =>
    `<a data-test="tab-${t}" href="/recipes/${r.id}?tab=${t}">${capitalize(t)}</a>`).join(' | ');
  let section;
  if (tab === 'components') {
    section = table(['Ingredient', 'Quantity', 'Unit'], componentRows(r, 'component-row'));
  } else if (tab === 'nutrition') {
    section = `<dl>${Object.entries(r.nutrition).map(([k, v]) => `<dt>${esc(k)}</dt><dd data-test="nutrition-${k}">${v}</dd>`).join('')}</dl>
<a data-test="print-recipe" href="/recipes/${r.id}/print">Print / PDF preview</a>`;
  } else {
    section = `${url.searchParams.get('saved') ? '<p class="msg" data-test="save-message">Recipe saved</p>' : ''}
<p>Type: <span data-test="recipe-type">${esc(r.type)}</span></p>
<p>Meal type: <span data-test="recipe-meal-type">${esc(r.mealType)}</span></p>
<p>Yield: <span data-test="recipe-yield">${r.yield}</span></p>
<p>Workflow: <span data-test="recipe-workflow-status">${esc(r.workflowStatus)}</span>
${r.type === 'Finished Meal' ? ` <a data-test="open-workflow" href="/recipes/${r.id}/workflow">Open workflow</a>` : ''}</p>
<form method="post" action="/recipes/${r.id}"><label>Notes <textarea name="notes" data-test="recipe-notes">${esc(r.notes)}</textarea></label>
<button data-test="save-recipe">Save</button></form>`;
  }
  return layout(user, 'Recipe', `<p>Name: <span data-test="recipe-name">${esc(r.name)}</span></p><nav>${tabs}</nav>
<section data-test="section-${tab}">${section}</section>`);
});

route('POST', /^\/recipes\/([\w-]+)$/, 'recipes', ({ params, body }) => {
  const r = byId(db.recipes, params[0]);
  if (!r) throw new HttpError(404, 'Recipe not found.');
  r.notes = body.get('notes') || '';
  return { redirect: `/recipes/${r.id}?tab=details&saved=1` };
});

route('GET', /^\/recipes\/([\w-]+)\/print$/, 'recipes', ({ user, params }) => {
  const r = byId(db.recipes, params[0]);
  if (!r) throw new HttpError(404, 'Recipe not found.');
  return layout(user, `Recipe print - ${r.name}`, `
<dl>${Object.entries(r.nutrition).map(([k, v]) => `<dt>${esc(k)}</dt><dd data-test="print-${k}">${v}</dd>`).join('')}</dl>
${table(['Ingredient', 'Quantity', 'Unit'], componentRows(r, 'print-component-row'))}`);
});

route('GET', /^\/recipes\/([\w-]+)\/workflow$/, 'recipes', ({ user, params }) => {
  const r = byId(db.recipes, params[0]);
  if (!r || r.type !== 'Finished Meal') throw new HttpError(404, 'Finished-meal recipe not found.');
  const meal = ['Breakfast', 'Lunch', 'Dinner'].map((m) => `<option${m === r.mealType ? ' selected' : ''}>${m}</option>`).join('');
  return layout(user, `Workflow - ${r.name}`, `
<form method="post" action="/recipes/${r.id}/workflow">
<label>Meal Type (required) <select name="mealType" data-test="meal-type"><option value="">-- select --</option>${meal}</select></label>
<p class="error" data-test="meal-type-error" hidden>Meal Type is required for finished meals.</p>
<button data-test="complete-workflow">Complete workflow</button></form>
<script>
const s = document.querySelector('[data-test=meal-type]');
const b = document.querySelector('[data-test=complete-workflow]');
const e = document.querySelector('[data-test=meal-type-error]');
function sync() { b.disabled = !s.value; e.hidden = !!s.value; }
s.addEventListener('change', sync); sync();
</script>`);
});

route('POST', /^\/recipes\/([\w-]+)\/workflow$/, 'recipes', ({ user, params, body }) => {
  const r = byId(db.recipes, params[0]);
  if (!r || r.type !== 'Finished Meal') throw new HttpError(404, 'Finished-meal recipe not found.');
  const mealType = body.get('mealType');
  if (!mealType) throw new HttpError(400, 'Meal Type is required for finished meals.');
  r.mealType = mealType;
  r.workflowStatus = 'Completed';
  return layout(user, `Workflow - ${r.name}`, `<p>Status: <span data-test="workflow-status">${r.workflowStatus}</span></p>`);
});

// SAN-009/010/011 menu
route('GET', /^\/menu\/planning$/, 'menu', ({ user, url }) => {
  const account = url.searchParams.get('account') || '';
  const location = url.searchParams.get('location') || '';
  const date = url.searchParams.get('date') || '';
  const q = url.searchParams.get('q') || '';
  let body = `<form method="get" action="/menu/planning">
<label>Account <select name="account" data-test="plan-account">${options(userAccounts(user), account)}</select></label>
<label>Location <select name="location" data-test="plan-location">${options(userLocations(user), location)}</select></label>
<label>Date <input type="date" name="date" data-test="plan-date" value="${esc(date)}"></label>
<button data-test="open-planning">Open</button></form>`;
  if (location && date) {
    const loc = requireLocation(user, location, account);
    const hidden = `<input type="hidden" name="account" value="${esc(account)}"><input type="hidden" name="location" value="${loc.id}"><input type="hidden" name="date" value="${esc(date)}">`;
    const eligible = [...db.recipes, ...db.products.filter((p) => p.canBeMenued)];
    const results = q ? eligible.filter((i) => matches(i, q)) : [];
    const planned = db.menus[`${loc.id}|${date}`] || [];
    body += `<p>Meal period: <span data-test="meal-period">${esc(loc.mealPeriod)}</span>,
location type: <span data-test="location-type">${esc(loc.type)}</span></p>
${url.searchParams.get('saved') ? '<p class="msg" data-test="menu-save-message">Menu saved</p>' : ''}
<form method="get" action="/menu/planning">${hidden}<input name="q" data-test="item-search" value="${esc(q)}" placeholder="Search eligible items">
<button data-test="item-search-button">Search</button></form>
${table(['Eligible item', ''], results.map((i) => `<tr data-test="menu-search-result"><td>${esc(i.name)}</td><td>
<form method="post" action="/menu/planning/add">${hidden}<input type="hidden" name="item" value="${i.id}"><button data-test="add-${i.id}">Add &amp; save</button></form></td></tr>`))}
<h3>Planned items</h3><ul>${planned.map((id) => `<li data-test="planned-item">${esc(itemName(id))}</li>`).join('')}</ul>`;
  }
  return layout(user, 'Menu Planning', body);
});

route('POST', /^\/menu\/planning\/add$/, 'menu', ({ user, body }) => {
  const loc = requireLocation(user, body.get('location'), body.get('account'));
  const date = body.get('date');
  const item = body.get('item');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new HttpError(400, 'A valid menu date is required.');
  const eligible = byId(db.recipes, item) || db.products.find((p) => p.id === item && p.canBeMenued);
  if (!eligible) throw new HttpError(400, 'Item is not eligible for menus.');
  const key = `${loc.id}|${date}`;
  db.menus[key] = db.menus[key] || [];
  if (!db.menus[key].includes(item)) db.menus[key].push(item);
  const qs = new URLSearchParams({ account: loc.accountId, location: loc.id, date, saved: '1' });
  return { redirect: `/menu/planning?${qs}` };
});

route('GET', /^\/menu\/month$/, 'menu', ({ user, url }) => {
  const loc = requireLocation(user, url.searchParams.get('location'));
  const month = url.searchParams.get('month') || '';
  if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, 'month must be YYYY-MM.');
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [];
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const items = (db.menus[`${loc.id}|${date}`] || []).map((id) => `<div data-test="menu-item">${esc(itemName(id))}</div>`).join('');
    cells.push(`<td data-test="day-${date}"><strong>${d}</strong>${items}</td>`);
  }
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
  return layout(user, `Menu - ${loc.name} - ${month}`, `<table class="cal">${rows.join('')}</table>`);
});

route('GET', /^\/menu\/print$/, 'menu', ({ user, url }) => {
  const loc = requireLocation(user, url.searchParams.get('location'));
  const date = url.searchParams.get('date') || '';
  const recipes = (db.menus[`${loc.id}|${date}`] || []).map((id) => byId(db.recipes, id)).filter(Boolean);
  return layout(user, `Menu print - ${loc.name} - ${date}`, recipes.map((r) =>
    `<section data-test="print-recipe-${r.id}"><h3>${esc(r.name)}</h3>${table(['Ingredient', 'Quantity', 'Unit'], componentRows(r, 'print-ingredient'))}</section>`).join(''));
});

// SAN-012/013 purchase
route('GET', /^\/order-guide$/, 'purchase', ({ user, url }) => {
  const account = url.searchParams.get('account') || '';
  let body = `<form method="get" action="/order-guide"><label>Account <select name="account" data-test="og-account">${options(userAccounts(user), account)}</select></label>
<button data-test="open-order-guide">Open</button></form>`;
  if (account) {
    if (!user.accounts.includes(account)) throw new HttpError(403, 'You do not have access to this account.');
    const og = db.orderGuides.find((g) => g.accountId === account);
    if (!og) throw new HttpError(404, 'No order guide for this account.');
    body += `<p>Order guide: <span data-test="og-name">${esc(og.name)}</span></p>
${table(['Product ID', 'Product', 'Purchase unit'], og.products.map((id) => byId(db.products, id)).map((p) =>
    `<tr data-test="og-product-row"><td>${p.id}</td><td>${esc(p.name)}</td><td>${esc(p.purchaseUnit)}</td></tr>`))}
<label>Import template <select data-test="og-template">${options(db.orderGuideTemplates.filter((t) => t.active), '')}</select></label>`;
  }
  return layout(user, 'Order Guide', body);
});

route('GET', /^\/purchase\/new$/, 'purchase', ({ user }) => layout(user, 'New Vendor Order', `
<form method="get" action="/purchase/review">
<label>Location <select name="location" data-test="po-location">${options(userLocations(user), '')}</select></label>
<label>Vendor <select name="vendor" data-test="po-vendor">${options(db.vendors, '')}</select></label>
<label>Product <select name="product" data-test="po-product">${options(db.products, '')}</select></label>
<label>Quantity <input name="qty" type="number" min="1" data-test="po-qty"></label>
<label>Delivery date <input name="deliveryDate" type="date" data-test="po-delivery-date"></label>
<button data-test="review-po">Review</button></form>`));

route('GET', /^\/purchase\/review$/, 'purchase', ({ user, url }) => {
  const sp = url.searchParams;
  const loc = requireLocation(user, sp.get('location'));
  const vendor = byId(db.vendors, sp.get('vendor'));
  const product = byId(db.products, sp.get('product'));
  const qty = Number(sp.get('qty'));
  const errors = [];
  if (!vendor || !vendor.locations.includes(loc.id)) errors.push('Vendor is not associated with this location.');
  if (!product || !vendor || !vendor.productLines.includes(product.productLine)) errors.push('Product is not eligible for this vendor.');
  if (!Number.isInteger(qty) || qty < 1) errors.push('Quantity must be a whole number of at least 1.');
  if (!sp.get('deliveryDate')) errors.push('Delivery date is required.');
  if (errors.length) {
    return layout(user, 'Review Vendor Order', errors.map((e) => `<p class="error" data-test="po-error">${esc(e)}</p>`).join(''));
  }
  return layout(user, 'Review Vendor Order', `
<p>Vendor: <span data-test="review-vendor">${esc(vendor.name)}</span></p>
<p>Location: <span data-test="review-location">${esc(loc.name)}</span></p>
<p>Product: <span data-test="review-product">${esc(product.name)}</span></p>
<p>Quantity: <span data-test="review-qty">${qty}</span> <span data-test="review-unit">${esc(product.purchaseUnit)}</span></p>
<p>Delivery date: <span data-test="review-delivery">${esc(sp.get('deliveryDate'))}</span></p>
<p>Status: <span data-test="po-status">Draft (not submitted)</span></p>
<button data-test="submit-po" disabled>Submit PO</button>
<p data-test="submit-disabled-note">PO submission is disabled in this practice sandbox, so no order can reach a vendor.</p>`);
});

// SAN-014 inventory
route('GET', /^\/inventory$/, 'inventory', ({ user, url }) => {
  const location = url.searchParams.get('location') || '';
  let body = `<form method="get" action="/inventory"><label>Location <select name="location" data-test="inv-location">${options(userLocations(user), location)}</select></label>
<button data-test="open-inventory">Open</button></form>`;
  if (location) {
    const loc = requireLocation(user, location);
    const inv = db.inventory[loc.id];
    body += `<h3>Storage areas</h3><ul>${inv.storageAreas.map((s) => `<li data-test="storage-area">${esc(s)}</li>`).join('')}</ul>
<h3>Inventory count</h3>${table(['Product', 'Quantity'], inv.counts.map((c) =>
    `<tr data-test="count-product-row"><td>${esc(itemName(c.productId))}</td><td>${c.qty}</td></tr>`))}`;
  }
  return layout(user, 'Inventory', body);
});

// SAN-015 workflow
route('GET', /^\/workflow$/, 'workflow', ({ user, url }) => {
  const tab = url.searchParams.get('tab') || 'todo';
  const labels = { todo: 'To Do', active: 'Active', completed: 'Completed' };
  if (!labels[tab]) throw new HttpError(400, 'Unknown tab.');
  const tabs = Object.entries(labels).map(([k, l]) => `<a data-test="wf-tab-${k}" href="/workflow?tab=${k}">${l}</a>`).join(' | ');
  const rows = db.transactions.filter((t) => t.assignee === user.key && t.state === tab).map((t) =>
    `<tr data-test="txn-row"><td>${t.id}</td><td>${esc(t.type)}</td><td>${esc(t.status)}</td><td><a data-test="open-${t.id}" href="/workflow/${t.id}">Open</a></td></tr>`);
  return layout(user, 'User Transactions', `<nav>${tabs}</nav><p>Showing: <span data-test="wf-current-tab">${labels[tab]}</span></p>
${table(['ID', 'Type', 'Status', ''], rows)}`);
});

route('GET', /^\/workflow\/([\w-]+)$/, 'workflow', ({ user, params }) => {
  const t = byId(db.transactions, params[0]);
  if (!t || t.assignee !== user.key) throw new HttpError(403, 'This transaction is not assigned to you.');
  const actions = t.state === 'todo' && user.roles.includes('Approver')
    ? ['Approve', 'Reject'].map((a) => `<button type="button" data-test="txn-action">${a}</button>`).join(' ') : '';
  return layout(user, 'Transaction', `<p>ID: <span data-test="txn-id">${t.id}</span></p>
<p>Type: <span data-test="txn-type">${esc(t.type)}</span></p><p>Reference: <span data-test="txn-reference">${esc(t.reference)}</span></p>
<p>Status: <span data-test="txn-status">${esc(t.status)}</span></p><div>${actions}</div>`);
});

// SAN-016 notifications (mock outbox only - nothing is ever emailed)
route('GET', /^\/notifications$/, 'notifications', ({ user, url }) => {
  const config = table(['Event', 'Recipient', 'Channel', 'State'], db.notificationConfig.map((c) =>
    `<tr data-test="notif-config-row"><td>${esc(c.event)}</td><td>${esc(c.recipient)}</td><td>${esc(c.channel)}</td><td>${c.enabled ? 'Enabled' : 'Disabled'}</td></tr>`));
  const enabled = db.notificationConfig.filter((c) => c.enabled);
  return layout(user, 'Notifications', `<h3>Configuration</h3>${config}
${url.searchParams.get('sent') ? '<p class="msg" data-test="trigger-message">Notification generated in the mock outbox - no email was sent.</p>' : ''}
<h3>Trigger a test event</h3><form method="post" action="/notifications/trigger">
<label>Event <select name="event" data-test="trigger-event-type">${options(enabled, '', 'event', 'event')}</select></label>
<label>Test reference <input name="reference" data-test="trigger-reference"></label>
<button data-test="trigger-event">Trigger</button></form>
<h3>Outbox</h3>${table(['Event', 'Recipient', 'Reference'], db.outbox.map((o) =>
    `<tr data-test="outbox-row"><td>${esc(o.event)}</td><td>${esc(o.recipient)}</td><td>${esc(o.reference)}</td></tr>`))}`);
});

route('POST', /^\/notifications\/trigger$/, 'notifications', ({ body }) => {
  const cfg = db.notificationConfig.find((c) => c.event === body.get('event') && c.enabled);
  if (!cfg) throw new HttpError(400, 'Event is not configured or is disabled.');
  db.outbox.unshift({ event: cfg.event, recipient: cfg.recipient, reference: body.get('reference') || '' });
  return { redirect: '/notifications?sent=1' };
});

// SAN-017 revenue
route('GET', /^\/revenue$/, 'revenue', ({ user, url }) => {
  const account = url.searchParams.get('account') || '';
  const location = url.searchParams.get('location') || '';
  let body = `<form method="get" action="/revenue">
<label>Account <select name="account" data-test="rev-account">${options(userAccounts(user), account)}</select></label>
<label>Location <select name="location" data-test="rev-location">${options(userLocations(user), location)}</select></label>
<button data-test="open-revenue">Open</button></form>`;
  if (location) {
    const loc = requireLocation(user, location, account);
    const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    body += `<p>Month: <span data-test="revenue-month">${month}</span></p>
<p>Account: <span data-test="revenue-account">${esc(byId(db.accounts, loc.accountId).name)}</span>,
location: <span data-test="revenue-location">${esc(loc.name)}</span></p>
${table(['Category', 'Amount'], db.revenueCategories.map((c) =>
    `<tr><td data-test="revenue-category">${esc(c)}</td><td><input type="number" aria-label="${esc(c)} amount"></td></tr>`))}`;
  }
  return layout(user, 'Revenue Data Entry', body);
});

// ---------- server ----------
function currentUser(req) {
  const sid = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
  return sid ? sessions.get(sid[1]) : undefined;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e5) reject(new HttpError(413, 'Request too large.'));
    });
    req.on('end', () => resolve(new URLSearchParams(data)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const send = (status, html, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
    res.end(html);
  };
  const redirect = (location, headers = {}) => { res.writeHead(303, { Location: location, ...headers }); res.end(); };
  const user = currentUser(req);

  try {
    if (url.pathname === '/health') return send(200, 'ok', { 'Content-Type': 'text/plain' });
    if (url.pathname === '/') return redirect(user ? '/home' : '/login');

    if (url.pathname === '/login' && req.method === 'POST') {
      const body = await readBody(req);
      const found = db.users.find((u) => u.username === body.get('username') && u.password === body.get('password'));
      if (!found) return redirect('/login?error=1');
      const sid = crypto.randomBytes(16).toString('hex');
      sessions.set(sid, found);
      return redirect('/home', { 'Set-Cookie': `sid=${sid}; HttpOnly; SameSite=Lax; Path=/` });
    }
    if (url.pathname === '/logout') {
      const sid = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
      if (sid) sessions.delete(sid[1]);
      return redirect('/login', { 'Set-Cookie': 'sid=; Max-Age=0; Path=/' });
    }

    for (const r of routes) {
      const m = r.pattern.exec(url.pathname);
      if (!m || r.method !== req.method) continue;
      if (!user && url.pathname !== '/login') return redirect('/login');
      if (r.module && !user.modules.includes(r.module)) {
        return send(403, layout(user, 'Access denied', `<p class="error" data-test="access-denied">Your profile does not include the ${esc(capitalize(r.module))} module.</p>`));
      }
      const body = req.method === 'POST' ? await readBody(req) : new URLSearchParams();
      const out = r.handler({ req, url, user, body, params: m.slice(1) });
      return out && out.redirect ? redirect(out.redirect) : send(200, out);
    }
    return send(404, layout(user, 'Not found', '<p data-test="not-found">Page not found.</p>'));
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    const title = status === 403 ? 'Access denied' : 'Error';
    const testId = status === 403 ? 'access-denied' : 'app-error';
    return send(status, layout(user, title, `<p class="error" data-test="${testId}">${esc(status === 500 ? 'Unexpected error.' : err.message)}</p>`));
  }
});

server.listen(PORT, () => console.log(`Practice app running at http://localhost:${PORT}`));
