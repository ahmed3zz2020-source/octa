/**
 * ⛔ براهين المراجعة المستقلة للجولة ١٨ — R18-A01 .. R18-A07
 *
 * 📌 المصدر: OCTA_R18_INDEPENDENT_REVIEW_2026-11-17.md (مراجعة خارجية لحزمة الجولة ١٨).
 * 📌 القواعد: التأكيدات **كما هي** من المراجع المستقل — ممنوع تخفيف أي شرط.
 * 📌 كل اختبار لازم يفشل على الكود قبل الإصلاح (دليل سلبي) وينجح بعده.
 *
 * ⛔ ممنوع ذكر أسماء أدوات ذكاء اصطناعي في أي تعليق هنا (حارس النصوص بيرفض).
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');

function loadWorker() {
  const src = fs.readFileSync(path.join(ROOT, 'mgmt/worker.js'), 'utf8');
  // ⛔ نحمّل الـworker كدالة (نفس طريقة المراجع المستقل) ⇒ نتحكم في Response/Request/crypto
  return new Function('Response', 'Request', 'URL', 'crypto',
    src.replace('export default', 'return'))(Response, Request, URL, crypto);
}

function makeEnv(worker) {
  return {
    APP_PASSWORD: 'synthetic-password',
    SESSION_SECRET: 'synthetic-secret',
    OCTA_ADMIN_TOKEN: 'synthetic-token',
    ASSETS: {
      fetch: async () => new Response('synthetic protected shell', {
        headers: { 'Cache-Control': 'public, max-age=3600' },
      }),
    },
  };
}

function req(p, opts = {}) {
  return new Request('https://mgmt.invalid' + p, opts);
}

async function login(worker, env) {
  const res = await worker.fetch(req('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password: env.APP_PASSWORD }),
  }), env);
  assert.equal(res.status, 200);
  return res.headers.get('Set-Cookie').split(';')[0];
}

// ── R18-A01: إبطال الجلسة عند الخروج ────────────────────────────────────
test('R18-A01: جلسة الأدمن المنسوخة تُبطَل عند تسجيل الخروج', async () => {
  const worker = loadWorker();
  const env = makeEnv(worker);
  const cookie = await login(worker, env);
  const headers = { Cookie: cookie };
  assert.equal((await worker.fetch(req('/api/session', { headers }), env)).status, 200);
  assert.equal((await worker.fetch(req('/api/logout', { method: 'POST', headers }), env)).status, 200);
  assert.equal((await worker.fetch(req('/api/session', { headers }), env)).status, 401);
});

// ── R18-A02: الأصول المحمية ما تن caches confirma ──────────────────────
test('R18-A02: الأصل المحمي ما يحملش سياسة كاش عامة', async () => {
  const worker = loadWorker();
  const env = makeEnv(worker);
  const cookie = await login(worker, env);
  const r = await worker.fetch(req('/index.html', { headers: { Cookie: cookie } }), env);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('Cache-Control') || '', /no-store/);
});

// ── R18-A03: عامل الخدمة ما يخزّنش الهيكل المحمي ───────────────────────
test('R18-A03: عامل الخدمة ما يحفظش القشرة المحمية في الكاش', async () => {
  const worker = loadWorker();
  const env = makeEnv(worker);
  const handlers = {};
  const stored = [];
  const sw = fs.readFileSync(path.join(ROOT, 'mgmt/public/sw.js'), 'utf8');
  const sandbox = {
    self: {
      location: { origin: 'https://mgmt.invalid' },
      addEventListener: (k, fn) => { handlers[k] = fn; },
    },
    URL,
    Response,
    caches: {
      open: async () => ({ put: async (r) => stored.push(new URL(r.url).pathname) }),
      match: async () => undefined,
    },
    fetch: async () => new Response('synthetic protected shell'),
  };
  vm.runInNewContext(sw, sandbox);
  let pending;
  handlers.fetch({ request: req('/index.html'), respondWith: (p) => { pending = p; } });
  await pending;
  await new Promise((r) => setImmediate(r));
  assert.equal(stored.length, 0);
});

// ── R18-A04: كوكي تالف ⇒ ردّ مضبوط من غير خطأ سيرفر ────────────────────
test('R18-A04: كوكي بترميز غير صالح يرجّع 401 من غير خطأ سيرفر', async () => {
  const worker = loadWorker();
  const env = makeEnv(worker);
  const r = await worker.fetch(req('/api/session', {
    headers: { Cookie: 'octa_mgmt_sess=%ZZ' },
  }), env).catch(() => ({ status: 500 }));
  assert.equal(r.status, 401);
});

// ── R18-A05: مسار إداري مش موجود ⇒ نحافظ على حالة "غير موجود" ─────────
test('R18-A05: مسار إداري غير موجود بيحافظ على 404/204 من غير 502', async () => {
  const worker = loadWorker();
  const env = makeEnv(worker);
  const cookie = await login(worker, env);
  const orig = global.fetch;
  global.fetch = async () => new Response('{}', { status: 404 });
  const err = console.error;
  console.error = () => {};
  try {
    const r = await worker.fetch(req('/api/proxy?path=/api/admin/example', {
      headers: { Cookie: cookie },
    }), env);
    assert.notEqual(r.status, 502);
    assert.ok([404, 204].includes(r.status));
  } finally {
    global.fetch = orig;
    console.error = err;
  }
});

// ── R18-A06 / SEC-024: قيم المحرك من الـAPI تُعرَض كنص مش HTML خام ────
test('R18-A06: قرار المحرك ومستوى الخطورة من الـAPI يُعرضان كنص', () => {
  const source = fs.readFileSync(path.join(ROOT, 'assets/js/octa-core.js'), 'utf8');
  const section = source.slice(
    source.indexOf('function renderEngineBars('),
    source.indexOf('function injectEngineWidget('));
  const nodes = { engineBars: {}, engineDecision: {} };
  const render = new Function('document', 'setTimeout', 'octaEsc',
    section + ';return renderEngineBars')(
    { getElementById: (n) => nodes[n] }, () => {},
    (s) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  render([], 80, { d: { decision: '<b>synthetic-decision</b>', risk_level: '<b>synthetic-risk</b>', confidence: 80 } });
  assert.equal(nodes.engineDecision.innerHTML.includes('<b>synthetic-'), false);
});

// ── R18-A07: رفض 401 ⇒ ممنوع عرض بيانات إدارة مخزّنة محليًا ───────────
test('R18-A07: رفض الجلسة الصريح ما يرسمش بيانات إدارة مخزّنة', async () => {
  const source = fs.readFileSync(path.join(ROOT, 'mgmt/public/app.js'), 'utf8');
  const boot = source.slice(
    source.indexOf('  function boot() {'),
    source.indexOf("  document.addEventListener('DOMContentLoaded'"));
  const old = source.slice(
    source.indexOf('  function maybeOffline() {'),
    source.indexOf('  function boot2('));
  let rendered = 0;
  let prompt = 0;
  const noop = () => {};
  const sb = {
    LS_PREF: 'prefs',
    localStorage: { getItem: () => null },
    state: {},
    window: { addEventListener: noop },
    document: { addEventListener: noop },
    fetch: async () => new Response('{}', { status: 401 }),
    registerSW: noop,
    $: () => null,
    doLogin: noop,
    doInstall: noop,
    showInstallHelp: noop,
    openSettings: noop,
    closeSettings: noop,
    pull: noop,
    doLogout: noop,
    exportAll: noop,
    checkUpdate: noop,
    loadSnap: () => ({ data: { synthetic: 1 } }),
    boot2: () => { rendered++; },
    toast: noop,
    setStatus: noop,
    showLogin: () => { prompt++; },
  };
  vm.runInNewContext(old + '\n' + boot + '\nboot()', sb);
  await new Promise((r) => setImmediate(r));
  assert.equal(rendered, 0);
  assert.equal(prompt, 1);
});
