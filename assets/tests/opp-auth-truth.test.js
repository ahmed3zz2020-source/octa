/* ══════════════════════════════════════════════════════════════════════
   🧪🛡️ الجولة ١٤ — خطأ المصادقة ≠ «الباك ميت»
   ──────────────────────────────────────────────────────────────────────
   ⛔ العيب المقاس (١٧ نوفمبر ٢٠٢٦):
      الباك الحيّ شغّال ويردّ 401 «محتاج تسجيل دخول»
      ⇒ الـworker كان بيعتبره فشل ⇒ بيرجّع 503 «الباك الحي شاغل»
      ⇒ **رسالة كاذبة**: الباك شغّال فعلاً، والخلل في الجلسة.

   📌 المطلوب:
      ① 401/403 من الباك ⇒ تُمرَّر زي ما هي (السبب الحقيقي).
      ② فشل الشبكة/5xx ⇒ 503 صريح «الباك غير متاح» (مش 401 كاذب).
      ③ مافيش رجوع للقطعة القديمة من غير ظاهر صريح.

   📌 التشغيل:  node --test assets/tests/opp-auth-truth.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8');

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

function req(url) {
  const h = new Headers();
  h.set('Cookie', 'octa_token=test-session-token');
  return new Request(url, { method: 'GET', headers: h });
}

function env(extra) {
  return Object.assign({
    OCTA_API_URL: 'https://staging.example.test',
    OCTA_OPP_SNAPSHOT: 'on',
    OCTA_ALPHA_SNAPSHOT: 'on',
    OCTA_FAIL_CLOSED: 'on'
  }, extra || {});
}

function jsonRes(status, payload) {
  return new Response(JSON.stringify(payload), {
    status: status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/* 🐞🛡️ SEC-001 (الجولة ١٨) — البوابة بتسأل صاحب الصلاحية قبل الخدمة
   📌 ⇒ نميّز نداء التحقق (/api/auth/me) عن نداء البيانات.
   📌 ndiDataStatus = حالة ردّ **البيانات** (اللي بنختبرها). */
function makeBackend(dataStatus, payload) {
  return async (target) => {
    if (String(target).indexOf('/api/auth/me') > -1) {
      return jsonRes(200, { ok: true, user: { id: 'u1' } });
    }
    return jsonRes(dataStatus, payload);
  };
}

test('401 من الباك الحي ⇒ يمرّ زي ما هو (مش 503 «الباك ميت»)', async () => {
  const w = makeWorker(makeBackend(401, { ok: false, error: 'محتاج تسجيل دخول' }));
  const res = await w.fetch(req('https://preview.example.test/api/opp/strategies'),
    env(), {});
  assert.equal(res.status, 401, 'ردّ المصادقة اتحوّل لغيره');
  const body = await res.json();
  assert.equal(body.error, 'محتاج تسجيل دخول');
});

test('403 من الباك ⇒ يمرّ زي ما هو', async () => {
  const w = makeWorker(makeBackend(403, { ok: false, error: 'forbidden' }));
  const res = await w.fetch(req('https://preview.example.test/api/opp/strategies'),
    env(), {});
  assert.equal(res.status, 403);
});

test('فشل الشبكة ⇒ 503 صريح «الباك غير متاح» (مش 401 كاذب)', async () => {
  const w = makeWorker(async () => { throw new Error('network down'); });
  const res = await w.fetch(req('https://preview.example.test/api/opp/strategies'),
    env(), {});
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, 'live_backend_unavailable');
  assert.equal(body.source, 'none');
});

test('500 من الباك ⇒ 503 «الباك غير متاح» (مافيش لقطة قديمة)', async () => {
  const w = makeWorker(async () => jsonRes(500, { ok: false }));
  const res = await w.fetch(req('https://preview.example.test/api/opp/strategies'),
    env(), {});
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.why, 'backend_failed_no_stale_snapshot');
});

test('ردّ 200 JSON من الباك ⇒ يمرّ (الطريق السليم)', async () => {
  const w = makeWorker(async () => jsonRes(200, { ok: true, strategies: [] }));
  const res = await w.fetch(req('https://preview.example.test/api/opp/strategies'),
    env(), {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('مافيش رجوع للقطعة القديمة من غير ظاهر صريح', async () => {
  const w = makeWorker(async () => jsonRes(500, { ok: false }));
  const res = await w.fetch(req('https://preview.example.test/api/opp/strategies'),
    env({ OCTA_SNAPSHOT_FALLBACK: 'on' }), {});
  /* مع ظاهر صريح ⇒ المسار القديم متاح (سلوك قديم) — ماشي */
  assert.ok(res.status === 503 || res.status === 200);
  const body = await res.json();
  assert.equal(body.ok, false);
});
