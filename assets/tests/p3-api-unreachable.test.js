/* ═══════════════════════════════════════════════════════════════
   🧪 الجولة ١٨ (P3) · اختبارات وضوح خطأ «الـAPI مش موصل»
   ───────────────────────────────────────────────────────────────
   📌 العيب المقاس (تشخيص حيّ · ١٧ نوفمبر ٢٠٢٦):
      المعاينة كانت بترجّع **530** (Cloudflare 1016) على كل مسارات
      الـAPI ⇒ صفحة الدخول بتقول «الباسورد غلط» أو «الشبكة ضعيفة»
      ⇒ المستخدم بيتّهم بإيمه والسبب الحقيقي (البنية) مستخبي.

   📌 المطلوب بعد الإصلاح:
      ① أي فشل في جلب الـAPI (استثناء · timeout · 530 من الـedge)
         ⇒ رد **503** بصيغة JSON واضحة:
            {ok:false, error:'الخدمة مؤقتًا غير متاحة', why:'api_unreachable'}
      ② ⛔ ممنوع: عنوان الـAPI الداخلي · أي مفتاح · رسالة الاستثناء
         (في الرد أو في اللوج).
      ③ ⛔ المسارات السليمة ما تتغيّرش (٢٠٠ بيفضل ٢٠٠).

   📌 التشغيل: node --test assets/tests/p3-api-unreachable.test.js
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8');

/* ⛔ عنوان داخلي وهمي — لازم ما يظهرش في أي رد ⬇️ */
const INTERNAL_API = 'https://staging-internal.example.test';
const PROD_API = 'https://octa-prices-production-4ccb.up.railway.app';

/* ═══ بيئة تشغيل وهمية (نفس نمط worker.p0.test.js) ═══ */
function makeWorker(fetchMock) {
  const mod = { exports: {} };
  const halanSrc = fs.readFileSync(path.join(ROOT, 'halan-news.js'), 'utf8')
    .replace(/export\s+(function|const|let|var)\s+/g, '$1 ')
    .replace(/export\s*\{[^}]*\}\s*;?/g, '')
    .replace(/export\s+default\s+/g, '');
  const body = SRC
    .replace(/^\s*import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?\s*$/m, '')
    .replace('export default', 'module.exports =');
  const fn = new Function('module', 'exports', 'Request', 'Response',
    'Headers', 'URL', 'fetch', 'setTimeout', halanSrc + '\n' + body);
  fn(mod, mod.exports, Request, Response, Headers, URL,
    fetchMock || globalThis.fetch, globalThis.setTimeout);
  return mod.exports;
}

function req(url, opts) {
  const o = opts || {};
  const h = new Headers(o.headers || {});
  return new Request(url, {
    method: o.method || 'GET',
    headers: h,
    body: o.body,
  });
}

function makeAssets(files) {
  return {
    async fetch(request) {
      const u = new URL(request.url);
      const name = u.pathname.replace(/^\//, '') || 'index.html';
      const body = files[name];
      if (body === undefined) return new Response('not found', { status: 404 });
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': name.endsWith('.html')
          ? 'text/html; charset=utf-8' : 'application/octet-stream' },
      });
    },
  };
}

const FILES = {
  'index.html': '<html><head></head><body>التطبيق</body></html>',
  'gate.html': '<html>بوابة</html>',
};

function envFor(extra) {
  return Object.assign({
    ASSETS: makeAssets(FILES),
    OCTA_FAIL_CLOSED: 'on',
    OCTA_GATE: 'off',
    OCTA_API_URL: INTERNAL_API,
    OCTA_API_DIRECT: INTERNAL_API,
  }, extra || {});
}

/* ⛔ يجمع اللوج أثناء التنفيذ (لنتأكد إن العنوان الداخلي ما اتسجّلش) */
function captureLogs(fn) {
  const lines = [];
  const origLog = console.log, origWarn = console.warn, origErr = console.error;
  console.log = function () { lines.push(argsToStr(arguments)); };
  console.warn = function () { lines.push(argsToStr(arguments)); };
  console.error = function () { lines.push(argsToStr(arguments)); };
  return Promise.resolve()
    .then(fn)
    .then(function (v) { restore(); return { value: v, logs: lines.join('\n') }; },
      function (e) { restore(); throw e; });
  function argsToStr(a) {
    const out = [];
    for (let i = 0; i < a.length; i++) {
      try { out.push(typeof a[i] === 'string' ? a[i] : JSON.stringify(a[i])); }
      catch (e) { out.push(String(a[i])); }
    }
    return out.join(' ');
  }
  function restore() {
    console.log = origLog; console.warn = origWarn; console.error = origErr;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ①  الاستثناء — الـfetch بيرمي ⬇️
   ═══════════════════════════════════════════════════════════════ */
test('P3-01 · الـfetch بيرمي استثناء ⇒ 503 + why:api_unreachable', async () => {
  const w = makeWorker(async () => { throw new Error('network down'); });
  const r = await w.fetch(req('https://octa-preview.example.test/api/quotes'), envFor());
  assert.equal(r.status, 503, 'لازم 503 (مش 500 · مش 530)');
  const ct = r.headers.get('Content-Type') || '';
  assert.ok(/application\/json/i.test(ct), 'لازم JSON: ' + ct);
  const cc = r.headers.get('Cache-Control') || '';
  assert.ok(/no-store/i.test(cc), 'لازم no-store: ' + cc);
  const j = await r.json();
  assert.equal(j.ok, false);
  assert.equal(j.why, 'api_unreachable');
  assert.equal(j.error, 'الخدمة مؤقتًا غير متاحة');
});

test('P3-01 · الرد ما فيهوش عنوان الـAPI الداخلي (ولا كلمة سرّية)', async () => {
  const w = makeWorker(async () => { throw new Error('boom'); });
  const r = await w.fetch(req('https://octa-preview.example.test/api/quotes'), envFor());
  const t = await r.text();
  assert.ok(t.indexOf(INTERNAL_API) === -1, 'العنوان الداخلي اتسرّب في الرد: ' + t);
  assert.ok(t.indexOf('example.test') === -1, 'اسم المضيف اتسرّب: ' + t);
  assert.ok(t.indexOf('boom') === -1, 'رسالة الاستثناء اتسرّبت: ' + t);
  assert.ok(t.indexOf('http') === -1, 'أي رابط اتسرّب: ' + t);
  assert.ok(!/secret|token|password|key/i.test(t), 'كلمة سرّية اتسرّبت: ' + t);
});

/* ═══════════════════════════════════════════════════════════════
   ②  الـedge رجّع 530 (Cloudflare 1016) — الحالة المقاسة حيًّا ⬇️
   ═══════════════════════════════════════════════════════════════ */
test('P3-02 · رد 530 من الـedge ⇒ 503 صريح (مش 530 ولا صفحة إنجليزية)', async () => {
  const w = makeWorker(async () => new Response('error code: 1016', {
    status: 530, headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
  }));
  const r = await w.fetch(req('https://octa-preview.example.test/api/auth/me'), envFor());
  assert.equal(r.status, 503, 'لازم 503 — مش 530');
  const j = await r.json();
  assert.equal(j.ok, false);
  assert.equal(j.why, 'api_unreachable');
  const t = JSON.stringify(j);
  assert.ok(t.indexOf('1016') === -1, 'كود Cloudflare اتسرّب: ' + t);
  assert.ok(t.indexOf(INTERNAL_API) === -1, 'العنوان الداخلي اتسرّب: ' + t);
});

/* ═══════════════════════════════════════════════════════════════
   ③  اللوج — ممنوع العنوان الداخلي ⬇️
   ═══════════════════════════════════════════════════════════════ */
test('P3-03 · لوج الفشل ما فيهوش العنوان الداخلي (مفتاح بدل عنوان)', async () => {
  const w = makeWorker(async () => {
    throw new Error('Fetch API cannot resolve host: ' + INTERNAL_API);
  });
  const out = await captureLogs(async () => {
    const r = await w.fetch(req('https://octa-preview.example.test/api/quotes'), envFor());
    return r;
  });
  assert.equal(out.value.status, 503);
  assert.ok(out.logs.indexOf(INTERNAL_API) === -1,
    'العنوان الداخلي اتسجّل في اللوج: ' + out.logs);
  assert.ok(out.logs.indexOf('example.test') === -1,
    'اسم المضيف اتسجّل في اللوج: ' + out.logs);
});

/* ═══════════════════════════════════════════════════════════════
   ④  لا ارتجاع — المسار السليم بيفضل زي ما هو ⬇️
   ═══════════════════════════════════════════════════════════════ */
test('P3-04 · المسار السليم بيفضل ٢٠٠ (مفيش ارتجاع)', async () => {
  const w = makeWorker(async () => new Response('{"ok":true,"q":[]}', {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }));
  const r = await w.fetch(req('https://octa-preview.example.test/api/quotes'), envFor());
  assert.equal(r.status, 200, 'لازم ٢٠٠ زي ما هو');
  const t = await r.text();
  assert.ok(t.indexOf('"q":[]') > -1, 'جسم الرد اتغيّر: ' + t);
});

test('P3-05 · لا ارتجاع — طلب POST بيفضل بيوصل جسمه', async () => {
  let seen = null;
  const w = makeWorker(async (u, init) => {
    seen = { u: String(u), init: init };
    return new Response('{"ok":true}', {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  });
  const r = await w.fetch(req('https://octa-preview.example.test/api/auth/pin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '1234' }),
  }), envFor());
  assert.equal(r.status, 200);
  assert.ok(seen && String(seen.u).indexOf('/api/auth/pin/login') > -1,
    'الطلب موصلش للباك: ' + (seen && seen.u));
  assert.ok(seen.init && seen.init.body, 'جسم الطلب ضاع');
});

/* ═══════════════════════════════════════════════════════════════
   ⑤  ⛔ ممنوع الرجوع للإنتاج (العزل) ⬇️
   ═══════════════════════════════════════════════════════════════ */
test('P3-06 · فشل الـAPI ما بيطلبهوش من الإنتاج', async () => {
  const calls = [];
  const w = makeWorker(async (u) => {
    calls.push(String(u));
    throw new Error('down');
  });
  await w.fetch(req('https://octa-preview.example.test/api/quotes'), envFor());
  const prodHits = calls.filter(c => c.indexOf(PROD_API) === 0);
  assert.equal(prodHits.length, 0, 'في طلبات للإنتاج: ' + prodHits.join(','));
  calls.forEach(c => {
    assert.ok(c.indexOf(INTERNAL_API) === 0, 'الطلب راح لغير الوجهة الداخلية: ' + c);
  });
});
