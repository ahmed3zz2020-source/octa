/* ══════════════════════════════════════════════════════════════════════
   🐞🛡️ SEC-025 (الجولة ١٨ · P1) — كاش الردود مربوط بهوية المستخدم
   ──────────────────────────────────────────────────────────────────────
   📌 العيب (من نص المراجعة):
      مفتاح الكاش في الواجهة (octa-api.js) كان = **المسار** بس
      ⇒ نفس المسار بيرجّع ردّ المستخدم الأول لأي مستخدم تاني على
        نفس الجهاز (خصوصاً مسارات حالة المستخدم / الاستوديو).

   📌 المطلوب: مفتاح الكاش يـincludes هوية المستخدم (أو رد لكل مستخدم)
      لكل المسارات اللي بترجع بيانات مستخدم.

   📌 الاختبار: مستخدمان ⇒ نفس المسار ⇒ ردّان مختلفين بدون تسرّب.

   ⛔ مافيش شبكة · مافيش نشر (fetch مزوّر داخل sandbox).
   📌 التشغيل:  node --test assets/tests/sec025-cache-user-scope.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'assets/js/octa-api.js');

/* ═══ بيئة متصفح وهمية + localStorage قابل للتبديل ═══ */
function loadApi() {
  const store = {};
  const calls = [];
  const win = {};

  const rawFetch = async (url, init) => {
    calls.push({ url: String(url), init: init });
    const h = new Headers(init && init.headers ? init.headers : {});
    const auth = h.get('Authorization') || '';
    let who = 'anon';
    if (auth.indexOf('token-A') > -1) who = 'A';
    else if (auth.indexOf('token-B') > -1) who = 'B';
    const payload = JSON.stringify({ ok: true, user: who, secret: 'data-of-' + who });
    return new Response(payload, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  win.fetch = rawFetch;
  win.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const sandbox = {
    window: win,
    console: console,
    location: { origin: 'https://octashares.example.test', href: 'https://octashares.example.test/' },
    localStorage: win.localStorage,
    Headers: globalThis.Headers,
    AbortController: globalThis.AbortController,
    Response: globalThis.Response,
    Request: globalThis.Request,
    URL: globalThis.URL,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    navigator: { userAgent: 'node-test' }
  };
  sandbox.globalThis = sandbox;
  sandbox.self = win;

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SRC, 'utf8'), sandbox, { filename: 'octa-api.js' });

  return { win: win, store: store, calls: calls };
}

/* ══════════════════════════════════════════════════════════════════════
   ① مستخدمان ⇒ نفس المسار ⇒ ردّان مختلفين (مفيش تسرّب)
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-025 · نفس المسار لمستخدمين ⇒ ردّين مختلفين (من غير تسرّب)', async () => {
  const { win, store } = loadApi();
  store.octa_token = 'token-A';
  const a = await (await win.octaFetch('/api/analyze?code=COMI')).json();
  store.octa_token = 'token-B';
  const b = await (await win.octaFetch('/api/analyze?code=COMI')).json();
  assert.equal(a.user, 'A', 'ردّ المستخدم الأول مش A: ' + JSON.stringify(a));
  assert.equal(b.user, 'B',
    '⛔ مستخدم B شاف ردّ المستخدم A — تسريب عبر الكاش: ' + JSON.stringify(b));
});

/* ══════════════════════════════════════════════════════════════════════
   ② مسارات حالة المستخدم (لوحة) ⇒ مفيش ردّ قديم من حساب تاني
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-025 · /api/dashboard ⇒ كل مستخدم يشوف ردّه هو', async () => {
  const { win, store } = loadApi();
  store.octa_token = 'token-A';
  const a = await (await win.octaFetch('/api/dashboard')).json();
  store.octa_token = 'token-B';
  const b = await (await win.octaFetch('/api/dashboard')).json();
  assert.equal(a.user, 'A', JSON.stringify(a));
  assert.equal(b.user, 'B',
    '⛔ /api/dashboard رجّع بيانات حساب تاني: ' + JSON.stringify(b));
});

/* ══════════════════════════════════════════════════════════════════════
   ③ الاستوديو (رسومات المستخدم) ⇒ مفيش تسرّب
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-025 · /api/studio/list ⇒ رسومات كل مستخدم لوحده', async () => {
  const { win, store } = loadApi();
  store.octa_token = 'token-A';
  const a = await (await win.octaFetch('/api/studio/list?scope=mine&code=COMI')).json();
  store.octa_token = 'token-B';
  const b = await (await win.octaFetch('/api/studio/list?scope=mine&code=COMI')).json();
  assert.equal(a.user, 'A', JSON.stringify(a));
  assert.equal(b.user, 'B',
    '⛔ رسومات مستخدم A اتسرّبت لمستخدم B: ' + JSON.stringify(b));
});

/* ══════════════════════════════════════════════════════════════════════
   ④ الكاش لسه شغّال لنفس المستخدم (مفيش بطء زائد)
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-025 · نفس المستخدم + نفس المسار ⇒ طلب واحد (الكاش شغّال)', async () => {
  const { win, store, calls } = loadApi();
  store.octa_token = 'token-A';
  const a = await (await win.octaFetch('/api/analyze?code=COMI')).json();
  const before = calls.length;
  const a2 = await (await win.octaFetch('/api/analyze?code=COMI')).json();
  assert.equal(a.user, 'A');
  assert.equal(a2.user, 'A');
  assert.equal(calls.length, before,
    '⛔ الطلب اتكرر — الكاش بقى مكسور: ' + calls.length);
});

/* ══════════════════════════════════════════════════════════════════════
   ⑤ من غير توكن (معرّف مجهول) ⇒ مسارات حالة المستخدم بره الكاش
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-025 · من غير توكن ⇒ مافيش كاش لمسارات حالة المستخدم', async () => {
  const { win, calls } = loadApi();
  await win.octaFetch('/api/dashboard');
  const before = calls.length;
  await win.octaFetch('/api/dashboard');
  assert.ok(calls.length > before,
    '⛔ مسار حالة المستخدم اتخدّ من الكاش من غير هوية معروفة');
});

/* ══════════════════════════════════════════════════════════════════════
   ⑥ حارس ثابت: المفتاح فيه هوية المستخدم
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-025 · كود الكاش فيه هوية المستخدم (هاش) في المفتاح', () => {
  const s = fs.readFileSync(SRC, 'utf8');
  assert.ok(/_octaUserScope/.test(s), 'دالة _octaUserScope مش موجودة');
  assert.ok(/_octaUserScope\(headers\)\s*\+\s*'\|'/.test(s) ||
             /_octaUserScope\(headers\)\s*\+\s*"\|"/.test(s),
    'مفتاح الكاش مافيهوش هوية المستخدم');
  assert.ok(/_isUserState/.test(s), 'فحص مسارات حالة المستخدم اتشال');
  assert.ok(/'\/api\/studio\/list'/.test(s),
    '/api/studio/list مش في قائمة مسارات حالة المستخدم');
});
