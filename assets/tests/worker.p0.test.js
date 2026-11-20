/* ═══════════════════════════════════════════════════════════════
   🧪🛡️ اختبارات P0 للـWorker — assets/tests/worker.p0.test.js
   ───────────────────────────────────────────────────────────────
   التشغيل:  cd /workspace/repos/octa && node --test assets/tests/worker.p0.test.js

   📌 التغطية:
      P0-01 · عزل المعاينة (fail-closed) — مافيش رجوع للإنتاج أبداً
      P0-02 · الخروج — منتظر + بيتحقق من الإبطال + مافيش «نجاح» كاذب
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8');
const PROD_API = 'https://octa-prices-production-4ccb.up.railway.app';

/* ═══ بيئة تشغيل وهمية (نفس نمط worker.test.js) ═══ */
function makeWorker(fetchMock) {
  const mod = { exports: {} };
  const halanSrc = fs.readFileSync(path.join(ROOT, 'halan-news.js'), 'utf8')
    .replace(/export\s+(function|const|let|var)\s+/g, '$1 ')
    .replace(/export\s*\{[^}]*\}\s*;?/g, '')
    .replace(/export\s+default\s+/g, '');
  /* (R26) preview-api.js بقى اعتماد تاني للواجهة.
     الملف بيتحمّل في نطاق منفصل (IIFE) عشان مافيش تعارض أسماء
     مع العامل (sessionCookie موجود في الملفين).
     بدون التحميل ده: المرجع مش معرّف والـworker بيرجع 500. */
  const previewSrc = fs.readFileSync(path.join(ROOT, 'preview-api.js'), 'utf8')
    .replace(/export\s+(function|const|let|var)\s+/g, '$1 ')
    .replace(/export\s*\{[^}]*\}\s*;?/g, '')
    .replace(/export\s+default\s+/g, '');
  const previewMod = '(function(){\n' + previewSrc
    + '\nreturn { handlePreviewApi: handlePreviewApi };\n})()';
  const body = SRC
    .replace(/^\s*import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace('export default', 'module.exports =');
  const fn = new Function('module', 'exports', 'Request', 'Response',
    'Headers', 'URL', 'fetch', 'setTimeout',
    'const handlePreviewApi = ' + previewMod + '.handlePreviewApi;\n'
      + halanSrc + '\n' + body);
  fn(mod, mod.exports, Request, Response, Headers, URL,
    fetchMock || globalThis.fetch, globalThis.setTimeout);
  return mod.exports;
}

function req(url, opts = {}) {
  const h = new Headers(opts.headers || {});
  return new Request(url, {
    method: opts.method || 'GET',
    headers: h,
    body: opts.body,
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

/* ═══════════════════════════════════════════════════════════
   🚫 P0-01 · عزل المعاينة — fail-closed
   ═══════════════════════════════════════════════════════════ */
test('P0-01 · معاينة من غير OCTA_API_URL ⇒ مافيش طلب للإنتاج', async () => {
  const calls = [];
  const w = makeWorker(async (u) => {
    calls.push(String(u));
    return new Response('{}', { status: 200 });
  });
  const env = {
    ASSETS: makeAssets(FILES),
    OCTA_FAIL_CLOSED: 'on',
    OCTA_GATE: 'off',
  };
  const r = await w.fetch(req('https://octa-preview.ahmed3zz2020.workers.dev/api/quotes'), env);
  assert.equal(r.status, 503, 'لازم 503 (مافيش وجهة)');
  const t = await r.text();
  assert.ok(/fail|closed|مش جاهزة/i.test(t), 'الرسالة لازم تكون واضحة: ' + t.slice(0, 120));
  const prodHits = calls.filter(c => c.indexOf(PROD_API) === 0);
  assert.equal(prodHits.length, 0, 'في طلبات للإنتاج: ' + prodHits.join(','));
  assert.equal(calls.length, 0, 'مافيش أي طلب خارجي: ' + calls.join(','));
});

test('P0-01 · المعاينة بتستهدف الـstaging بس (مافيش إنتاج)', async () => {
  const calls = [];
  const w = makeWorker(async (u) => {
    calls.push(String(u));
    return new Response('{"ok":true}', { status: 200 });
  });
  const env = {
    ASSETS: makeAssets(FILES),
    OCTA_FAIL_CLOSED: 'on',
    OCTA_GATE: 'off',
    OCTA_API_URL: 'https://staging.example.test',
    OCTA_API_DIRECT: 'https://staging.example.test',
  };
  const r = await w.fetch(req('https://octa-preview.ahmed3zz2020.workers.dev/api/quotes'), env);
  assert.equal(r.status, 200);
  const prodHits = calls.filter(c => c.indexOf(PROD_API) === 0);
  assert.equal(prodHits.length, 0, 'في طلبات للإنتاج: ' + prodHits.join(','));
  assert.ok(calls.length > 0 && calls.every(c => c.indexOf('staging.example.test') > -1),
    'كل الطلبات للتجريبي: ' + calls.join(','));
});

test('P0-01 · HTML المعاينة من غير وجهة ⇒ مافيش رابط الإنتاج', async () => {
  const w = makeWorker(async () => new Response('{}', { status: 200 }));
  const env = {
    ASSETS: makeAssets({
      'index.html': '<html><head></head><body>'
        + '<script>var API="https://octa-prices-production-4ccb.up.railway.app";</script>'
        + '</body></html>',
    }),
    OCTA_FAIL_CLOSED: 'on',
    OCTA_GATE: 'off',
  };
  const r = await w.fetch(req('https://octa-preview.ahmed3zz2020.workers.dev/index.html'), env);
  const t = await r.text();
  assert.ok(t.indexOf(PROD_API) === -1, 'رابط الإنتاج لسه في الصفحة');
  assert.ok(t.indexOf('OCTA_FAIL_CLOSED') > -1, 'ما فيش marker الفشل المغلق');
});

test('P0-01 · HTML المعاينة بتستبدل الإنتاج بالتجريبي', async () => {
  const w = makeWorker(async () => new Response('{}', { status: 200 }));
  const env = {
    ASSETS: makeAssets({
      'index.html': '<html><head></head><body>'
        + '<script>var API="https://octa-prices-production-4ccb.up.railway.app";</script>'
        + '</body></html>',
    }),
    OCTA_FAIL_CLOSED: 'on',
    OCTA_GATE: 'off',
    OCTA_API_DIRECT: 'https://staging.example.test',
  };
  const r = await w.fetch(req('https://octa-preview.ahmed3zz2020.workers.dev/index.html'), env);
  const t = await r.text();
  assert.ok(t.indexOf(PROD_API) === -1, 'رابط الإنتاج لسه في الصفحة');
  assert.ok(t.indexOf('staging.example.test') > -1, 'العنوان مش متبدّل');
  assert.ok(t.indexOf('OCTA_DIRECT_LIST') > -1, 'مافيش قائمة اتصال محقونة');
});

/* ═══════════════════════════════════════════════════════════
   🚪 P0-02 · الخروج
   ═══════════════════════════════════════════════════════════ */
test('P0-02 · logout ⇒ بينتظر الباك وبيتحقق من الإبطال', async () => {
  let called = 0;
  const w = makeWorker(async (u, init) => {
    if (String(u).indexOf('/api/auth/logout') > -1) {
      called++;
      assert.equal(init.method, 'POST', 'لازم POST للباك');
      return new Response(JSON.stringify({ ok: true, revoked: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('{}', { status: 200 });
  });
  const env = {
    ASSETS: makeAssets(FILES),
    OCTA_FAIL_CLOSED: 'on',
    OCTA_GATE: 'off',
    OCTA_API_URL: 'https://staging.example.test',
  };
  const r = await w.fetch(req(
    'https://octa-preview.ahmed3zz2020.workers.dev/api/auth/logout',
    { method: 'POST', headers: { 'Cookie': 'octa_token=abc.def' } }), env);
  assert.equal(r.status, 200);
  assert.equal(called, 1, 'لازم نداء واحد للباك');
  const j = await r.json();
  assert.equal(j.revoked, true);
  const sc = r.headers.get('Set-Cookie') || '';
  assert.ok(sc.indexOf('Max-Age=0') > -1, 'الكوكي لازم يتمسح: ' + sc);
});

test('P0-02 · logout والباك واقع ⇒ 502 (مافيش «نجاح» كاذب)', async () => {
  const w = makeWorker(async (u) => {
    if (String(u).indexOf('/api/auth/logout') > -1) {
      throw new Error('backend down');
    }
    return new Response('{}', { status: 200 });
  });
  const env = {
    ASSETS: makeAssets(FILES),
    OCTA_FAIL_CLOSED: 'on',
    OCTA_GATE: 'off',
    OCTA_API_URL: 'https://staging.example.test',
  };
  const r = await w.fetch(req(
    'https://octa-preview.ahmed3zz2020.workers.dev/api/auth/logout',
    { method: 'POST', headers: { 'Cookie': 'octa_token=abc.def' } }), env);
  assert.equal(r.status, 502, 'لازم 502');
  const j = await r.json();
  assert.equal(j.ok, false);
  assert.equal(j.revoked, false);
  const sc = r.headers.get('Set-Cookie') || '';
  assert.ok(sc.indexOf('Max-Age=0') === -1, 'الكوكي ما يتمسحش لو فشل الإبطال');
});

test('P0-02 · logout مكرر (already) ⇒ نجاح', async () => {
  const w = makeWorker(async (u) => {
    if (String(u).indexOf('/api/auth/logout') > -1) {
      return new Response(JSON.stringify({ ok: true, revoked: false, already: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('{}', { status: 200 });
  });
  const env = {
    ASSETS: makeAssets(FILES),
    OCTA_FAIL_CLOSED: 'on',
    OCTA_GATE: 'off',
    OCTA_API_URL: 'https://staging.example.test',
  };
  const r = await w.fetch(req(
    'https://octa-preview.ahmed3zz2020.workers.dev/api/auth/logout',
    { method: 'POST', headers: { 'Cookie': 'octa_token=abc.def' } }), env);
  assert.equal(r.status, 200, 'الخروج المكرر لازم ينجح');
  const j = await r.json();
  assert.equal(j.revoked, true);
});

test('P0-02 · logout من غير وجهة ⇒ 503 (مش اتصال بالإنتاج)', async () => {
  const calls = [];
  const w = makeWorker(async (u) => { calls.push(String(u)); return new Response('{}'); });
  const env = {
    ASSETS: makeAssets(FILES),
    OCTA_FAIL_CLOSED: 'on',
    OCTA_GATE: 'off',
  };
  const r = await w.fetch(req(
    'https://octa-preview.ahmed3zz2020.workers.dev/api/auth/logout',
    { method: 'POST', headers: { 'Cookie': 'octa_token=abc.def' } }), env);
  assert.equal(r.status, 503);
  assert.equal(calls.filter(c => c.indexOf(PROD_API) === 0).length, 0,
    'مافيش طلب للإنتاج');
});
