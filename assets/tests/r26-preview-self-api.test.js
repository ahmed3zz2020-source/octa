/* ═══════════════════════════════════════════════════════════════════════
   🧪 (R26) ⭐⭐⭐ عقد المعاينة المعزولة الجديد ⭐⭐⭐
   ───────────────────────────────────────────────────────────────────────
   📌 العقد ⭐: ⭐ المعاينة تقدّم الـAPI **بنفسها** ⭐ (نفس الأصل ⭐)
      ⛔⇒ ⛔ صفر اتصال بالإنتاج ⭐ ⛔⇒ ⛔ مافيش proxy ⭐.
   📌 لماذا الملف ده ⭐:
      الاختبارات القديمة ⭐ (p3-* ⭐ · worker.p0 ⭐ · sec001 ⭐) ⭐ بتفحص
      **وضع الـproxy** ⭐ (الـworker بيمرّر للباك ⭐) ⭐ — وده لسه شغّال ⭐
      في الإنتاج ⭐. ⭐ المعاينة ⭐ (OCTA_PREVIEW_SELF_API=on ⭐) ⭐ سارت
      بتخدم نفسها ⭐ ⇒ ⭐ لازم تغطية **صريحة** للعقد الجديد ⭐ ⭐.
   📌 الأسلوب ⭐: ⛔ مافيش شبكة ⭐ ⛔ مافيش سر ⭐ — الـKV مُصطنع ⭐
      ⭐ والـfetch الخارجي لو اتنادى ⭐ = **فشل فورًا** ⭐ (مش صامت ⭐).
   📌 التشغيل ⭐: node --test assets/tests/r26-preview-self-api.test.js
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..', '..');
/* ⭐ (R28) ⭐ صنف الل​★DO الحقيقي ⭐ (مش نسخة مقلّدة ⭐) */
const { PreviewStore } = require('../../preview-store.js');

/* ⭐ KV مُصطنع ⭐ للمعاينة ⭐ (مفيش أي اتصال خارجي ⭐) */
function fakeKV() {
  const store = new Map();
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    async list(opts) {
      const prefix = (opts && opts.prefix) || '';
      const keys = [];
      for (const k of store.keys()) if (k.indexOf(prefix) === 0) keys.push(k);
      return { keys, list_complete: true };
    },
  };
}

/* ⭐ ⛔ أي نداء خارجي ⭐ = فشل صريح ⭐ (مش صامت ⭐) */
/* ⭐⭐⭐ (R28) ⭐ مخزن المعاينة ⭐ (Durable Object ⭐) — الكود الحقيقي ⭐ */
function fakeDO() {
  const map = new Map();
  const storage = {
    async get(k) { return map.has(k) ? map.get(k) : undefined; },
    async put(k, v) { map.set(k, v); },
    async delete(k) { map.delete(k); },
    async list(opts) {
      const prefix = (opts && opts.prefix) || '';
      const keys = [];
      for (const k of map.keys()) if (k.indexOf(prefix) === 0) keys.push({ name: k });
      return { keys: keys };
    },
  };
  const instance = new PreviewStore({ storage: storage }, {});
  return {
    map: map,
    idFromName: (n) => ({ name: String(n) }),
    get: (id) => ({ async fetch(url, opts) { return instance.fetch(new Request(url, opts)); } }),
  };
}

function makeWorker(outbound) {
  const calls = outbound || [];
  const mod = { exports: {} };
  /* ⭐ نبني العامل ⭐ ب(fetch ⭐) بتاعنا ⭐ (⛔ أي نداء خارجي = فشل ⭐) */
  const halanSrc = fs.readFileSync(path.join(ROOT, 'halan-news.js'), 'utf8')
    .replace(/export\s+(function|const|let|var)\s+/g, '$1 ')
    .replace(/export\s*\{[^}]*\}\s*;?/g, '')
    .replace(/export\s+default\s+/g, '');
  const previewSrc = fs.readFileSync(path.join(ROOT, 'preview-api.js'), 'utf8')
    .replace(/export\s+(function|const|let|var)\s+/g, '$1 ')
    .replace(/export\s*\{[^}]*\}\s*;?/g, '')
    .replace(/export\s+default\s+/g, '');
  const previewMod = '(function(){\n' + previewSrc
    + '\nreturn { handlePreviewApi: handlePreviewApi };\n})()';
  const src = fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8')
    .replace(/^\s*import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace('export default', 'module.exports =');
  const fn = new Function('module', 'exports', 'Request', 'Response',
    'Headers', 'URL', 'fetch', 'setTimeout',
    'const handlePreviewApi = ' + previewMod + '.handlePreviewApi;\n'
      + halanSrc + '\n' + src);
  const fetchMock = async (u) => {
    calls.push(String(u));
    throw new Error('outbound call is forbidden in the isolated preview: ' + String(u));
  };
  fn(mod, mod.exports, Request, Response, Headers, URL, fetchMock, globalThis.setTimeout);
  return mod.exports;
}

function previewEnv(extra) {
  const kv = fakeKV();
  /* ⭐ لقطة الأسعار ⭐ (المعاينة بتخدم من لقطة المعاينة ⭐ — مش من الباك ⭐) */
  kv.store.set('snap:quotes', JSON.stringify({
    updated: Math.floor(Date.now() / 1000),
    ttl: 120,
    egx: { 'COMI.CA': { price: 100, change: 1.5 } },
    markets: { egx: { 'COMI.CA': { price: 100, change: 1.5 } } },
  }));
  return Object.assign({
    OCTA_PREVIEW_SELF_API: 'on',
    OCTA_FAIL_CLOSED: 'on',
    PREVIEW_KV: kv,
    /* ⭐⭐⭐ (R28) ⭐ مخزن المعاينة ⭐ (Durable Object ⭐) ⭐ + مفتاح الصندوق ⭐ */
    PREVIEW_STORE: fakeDO(),
    PREVIEW_SESSION_SECRET: 'synthetic-preview-secret',
    PREVIEW_CONSOLE_KEY: 'synthetic-preview-console-key',
    ASSETS: {
      fetch: async () => {
        throw new Error('ASSETS must not be needed for the API routes');
      },
    },
  }, extra || {});
}

function req(url, opts) {
  const o = opts || {};
  return new Request(url, {
    method: o.method || 'GET',
    headers: new Headers(o.headers || {}),
    body: o.body,
  });
}

const ORIGIN = 'https://octa-preview.ahmed3zz2020.workers.dev';

/* ═══════════════════════════════════════════════════════════════════════
   ① ⭐ المعاينة بتقدّم الـAPI بنفسها ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R26-SA-01 · ⭐ /api/auth/me في المعاينة ⭐ بيتخدم محلي ⭐ (صفر اتصال خارجي ⭐)', async () => {
  const calls = [];
  const w = makeWorker(calls);
  const res = await w.fetch(req(ORIGIN + '/api/auth/me'), previewEnv());
  const j = await res.json();
  assert.equal(res.status, 401, '⛔ من غير جلسة ⭐ ⇒ 401 ⭐ (مش نجاح وهمي ⭐) — got ' + res.status);
  assert.equal(j.ok, false);
  assert.equal(calls.length, 0,
    '⛔⛔⛔ المعاينة لازم ما تعملش أي اتصال خارجي ⭐ — ' + calls.join(',') + ' ⭐');
});

test('R26-SA-02 · ⭐ تسجيل المعاينة ⭐ بيتخدم محلي ⭐ (مش من الباك ⭐)', async () => {
  const calls = [];
  const w = makeWorker(calls);
  /* ⭐ (R28) ⭐ نفس البيئة ⭐ (الـDO ⭐ واحد ⭐) ⭐ لا يكسر تقرير الصندوق في ثاني آخر ⭐ */
  const env = previewEnv();
  const res = await w.fetch(req(ORIGIN + '/api/auth/signup/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'probe@example.test', name: 'probe' }),
  }), env);
  const j = await res.json();
  assert.equal(res.status, 200, '⛔ لازم ٢٠٠ ⭐ — got ' + res.status);
  assert.equal(j.ok, true);
  assert.ok(!j.preview_code, '⛔⛔⛔ الكود ميبيشرش في الرد ⭐ (الاستحواذ إلى الصندوق ⭐)');
  assert.equal(j.preview_mailbox, true, '⛔ لازم يلف الصندوق ⭐');
  /* ⭐ الكود بييجي من الصندوق ⭐ (بمفتاح المعاينة ⭐) ⭐ */
  const mb = await w.fetch(req(ORIGIN + '/api/preview/mailbox?email=probe@example.test', {
    headers: { 'X-Preview-Key': 'synthetic-preview-console-key' },
  }), env);
  const mbj = await mb.json();
  assert.equal(mbj.ok, true, '⛔ الصندوق مافتح⭐');
  assert.ok(mbj.code && /^[0-9]{6}$/.test(mbj.code), '⛔ كود غلط ⭐');
  assert.equal(calls.length, 0,
    '⛔⛔⛔ المعاينة لازم ما تعملش أي اتصال خارجي ⭐ — ' + calls.join(',') + ' ⭐');
});

test('R26-SA-03 · ⭐ أسعار المعاينة ⭐ من ذاكرتها الخاصة ⭐', async () => {
  const calls = [];
  const w = makeWorker(calls);
  const env = previewEnv();
  const res = await w.fetch(req(ORIGIN + '/api/quotes'), env);
  const j = await res.json();
  assert.equal(res.status, 200, '⛔ لازم ٢٠٠ ⭐ — got ' + res.status);
  assert.equal(j.ok, true);
  assert.equal(calls.length, 0,
    '⛔⛔⛔ المعاينة لازم ما تعملش أي اتصال خارجي ⭐ — ' + calls.join(',') + ' ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ② ⛔ العزل ⭐ — مافيش اتصال بالإنتاج ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R26-SA-04 · ⛔ المعاينة ⭐ ما تلمسش الإنتاج ⭐ (مافيش عنوان إنتاج ⭐ في الرد ⭐)', async () => {
  const calls = [];
  const w = makeWorker(calls);
  const res = await w.fetch(req(ORIGIN + '/api/auth/me'), previewEnv());
  const t = await res.text();
  assert.ok(t.indexOf('octashares.com') === -1, '⛔ عنوان الإنتاج اتسرّب ⭐: ' + t);
  assert.ok(t.indexOf('railway.app') === -1, '⛔ عنوان الباك اتسرّب ⭐: ' + t);
  assert.ok(t.indexOf('up.railway') === -1, '⛔ عنوان الباك اتسرّب ⭐: ' + t);
});

test('R26-SA-05 · ⛔ طلب من أصل خارجي ⭐ ⛔ يترفض ⭐ (CSRF ⭐)', async () => {
  const calls = [];
  const w = makeWorker(calls);
  const res = await w.fetch(req(ORIGIN + '/api/auth/signup/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://evil.example.test' },
    body: JSON.stringify({ email: 'probe@example.test' }),
  }), previewEnv());
  assert.equal(res.status, 403, '⛔ لازم ٤٠٣ ⭐ — got ' + res.status);
  assert.equal(calls.length, 0, '⛔⛔⛔ مافيش اتصال خارجي ⭐ — ' + calls.join(',') + ' ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ③ ⛔ fail-closed ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R26-SA-06 · ⛔ المعاينة من غير تخزينها الخاص ⭐ ⇒ 503 ⭐ (مافيش نجاح وهمي ⭐)', async () => {
  const calls = [];
  const w = makeWorker(calls);
  const env = previewEnv();
  delete env.PREVIEW_KV;
  const res = await w.fetch(req(ORIGIN + '/api/auth/me'), env);
  const j = await res.json();
  assert.equal(res.status, 503, '⛔ لازم ٥٠٣ ⭐ — got ' + res.status);
  assert.equal(j.ok, false);
  assert.equal(j.error, 'preview_backend_misconfigured');
  assert.equal(calls.length, 0, '⛔⛔⛔ مافيش اتصال خارجي ⭐ — ' + calls.join(',') + ' ⭐');
});

test('R26-SA-07 · ⛔ المعاينة من غير سر جلساتها ⭐ ⇒ 503 ⭐', async () => {
  const calls = [];
  const w = makeWorker(calls);
  const env = previewEnv();
  delete env.PREVIEW_SESSION_SECRET;
  const res = await w.fetch(req(ORIGIN + '/api/quotes'), env);
  assert.equal(res.status, 503, '⛔ لازم ٥٠٣ ⭐ — got ' + res.status);
  const j = await res.json();
  assert.equal(j.error, 'preview_backend_misconfigured');
});

/* ═══════════════════════════════════════════════════════════════════════
   ④ ⭐⛔ بدون ارتجاع ⭐ — الإنتاج لسه بيمرّر ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R26-SA-08 · ⭐⛔ وضع الإنتاج ⭐ ⛔ ما يتأثرش ⭐ (الـworker لسه بيمرّر ⭐)', async () => {
  const calls = [];
  const w = makeWorker(calls);
  const res = await w.fetch(req('https://octa-prices-production-4ccb.up.railway.app/api/quotes', {
    headers: { Authorization: 'Bearer synthetic' },
  }), {
    OCTA_FAIL_CLOSED: 'on',
    OCTA_API_URL: 'https://octa-prices-production-4ccb.up.railway.app',
    ASSETS: { fetch: async () => new Response('x') },
  });
  assert.equal(calls.length, 3, '⛔ لازم ٣ محاولات ⭐ (مش indefinite ⭐) — ' + calls.length + ' ⭐');
  calls.forEach((c) => {
    assert.ok(String(c).indexOf('/api/quotes') > -1,
      '⛔ الطلب لازم يروح للمسار الصح ⭐: ' + c);
  });
  assert.equal(res.status, 503,
    '⛔ الـfetch المرفوض ⭐ ⇒ 503 ⭐ (مش نجاح وهمي ⭐) — got ' + res.status);
});

/* ═══════════════════════════════════════════════════════════════════════
   ⑤ ⭐ البرهان السالب ⭐ — shut down the self-API ⇒ سلوك الإنتاج يرجع ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R26-SA-09 · ⭐⭐ برهان سالب ⭐⭐: شيل علم «المعاينة بتخدم نفسها» ⭐ ⇒ مافيش خدمة محلية ⭐', async () => {
  const calls = [];
  const w = makeWorker(calls);
  /* ⭐ نفس الكود ⭐ بس ⭐ العلم اتقفل ⭐ ⇒ ⭐ لازم يرجع يمرّر ⭐ */
  const env = previewEnv({
    OCTA_PREVIEW_SELF_API: 'off',
    OCTA_API_URL: 'https://octa-prices-production-4ccb.up.railway.app',
  });
  const res = await w.fetch(req(ORIGIN + '/api/quotes'), env);
  assert.ok(calls.length >= 1,
    '⛔⛔⛔ من غير العلم ⭐ ⛔ لازم يمرّر ⭐ (يعني الاختبار بيلمس السلوك فعلاً ⭐) ⭐');
  calls.forEach((c) => {
    assert.ok(String(c).indexOf('/api/quotes') > -1,
      '⛔ الطلب لازم يروح للمسار الصح ⭐: ' + c);
  });
  assert.equal(res.status, 503,
    '⛔ الـfetch المرفوض ⭐ ⇒ 503 ⭐ (مش نجاح وهمي ⭐) — got ' + res.status);
});
