/* ══════════════════════════════════════════════════════════════════════
   🧪🛡️ اختبار تكامل تجريبي — الـWorker لا يرجع للقطة القديمة (الجولة ١٣)
   ──────────────────────────────────────────────────────────────────────
   ⛔ الهدف: إثبات أن الـWorker **مش** بيرجّع Snapshot قديم لما الباك الحيّ
      يفشل في إعداد الإنتاج المستهدف — بدل رد صريح 503.
   ⛔ مافيش شبكة · مافيش نشر · مافيشProduction (fetch مزوّر).
   📌 التشغيل:  node --test assets/tests/worker-snapshot-failclosed.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8');

/* ═══ بيئة تشغيل وهمية (نفس نمط worker.p0.test.js) ═══ */
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
  /* ⛔ العامل محمي ⇒ كوكي جلسة (الواجم يفحص وجوده بالوجود من الكوكي)
     ⇒ مافيش تسريب. */
  const h = new Headers(opts.headers || {});
  if (!h.get('Cookie')) h.set('Cookie', 'octa_token=test-session-token');
  return new Request(url, {
    method: opts.method || 'GET',
    headers: h,
    body: opts.body,
  });
}

/* ═══ الأصول: فيها لقطة قديمة بمحتوى مميّز ═══ */
const SNAP = {
  generated_at: '2026-11-10T03:22:36Z',
  model_version: 'old',
  note_ar: 'لقطة قديمة',
  strategies: [{ key: 'swing', name_ar: 'سوينج' }],
  lists: {
    swing: {
      summary: { total: 177, eligible: 20, returned: 20 },
      items: [{ code: 'OLDTICKER', name: 'سهم من لقطة قديمة', score: 99.9 }],
    }
  }
};

function makeAssets(files) {
  return {
    async fetch(request) {
      const u = new URL(request.url);
      const name = u.pathname.replace(/^\//, '') || 'index.html';
      const body = files[name];
      if (body === undefined) return new Response('not found', { status: 404 });
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': name.endsWith('.json')
          ? 'application/json' : 'text/html; charset=utf-8' },
      });
    },
  };
}

/* ═══ env المعاينة/الإنتاج المستهدف ═══ */
function env(extra) {
  return Object.assign({
    OCTA_API_URL: 'https://staging.example.test',
    OCTA_OPP_SNAPSHOT: 'on',
    OCTA_ALPHA_SNAPSHOT: 'on',
    ASSETS: makeAssets({
      'index.html': '<html><head></head><body>ok</body></html>',
      'data/opp_snapshot.json': JSON.stringify(SNAP),
      'data/alpha_snapshot.json': JSON.stringify({ ok: true, alpha: [] }),
    }),
  }, extra || {});
}

/* ═══ اختبار ١: الباك الحيّ رجّع JSON ⇒ الرد هو الحيّ مش اللقطة ═══ */
test('الباك الحيّ شغّال ⇒ الرد=live (مش اللقطة)', async () => {
  const fetchMock = async (url) => {
    if (String(url).includes('staging.example.test')) {
      return new Response(JSON.stringify({ ok: true, strategies: [], source: 'live' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('nope', { status: 404 });
  };
  const w = makeWorker(fetchMock);
  const res = await w.fetch(req('https://preview.example.test/api/opp/strategies'), env(), {});
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.source, 'live');
  assert.ok(!JSON.stringify(body).includes('OLDTICKER'),
    'رد اللقطةOld ظهر مع رد حيّ');
});

/* ═══ اختبار ٢ (الأساسي): الباك فشل ⇒ مافيش رجوع للقطة القديمة ═══ */
test('الباك الحيّ فشل (502) ⇒ رد صريح 503 ومافيش لقطة قديمة', async () => {
  const fetchMock = async (url) => {
    if (String(url).includes('staging.example.test')) {
      return new Response('upstream down', { status: 502 });
    }
    return new Response('nope', { status: 404 });
  };
  const w = makeWorker(fetchMock);
  const res = await w.fetch(req('https://preview.example.test/api/opp/list/swing'), env(), {});
  const raw = await res.text();
  assert.equal(res.status, 503, 'لازم يبقى 503 صريح');
  assert.ok(!raw.includes('OLDTICKER'), 'رجّع اللقطة القديمة رغم فشل الباك!');
  assert.ok(!raw.includes('سهم من لقطة قديمة'), 'رجّع محتوى اللقطة القديمة!');
  const body = JSON.parse(raw);
  assert.equal(body.ok, false);
  assert.equal(body.why, 'backend_failed_no_stale_snapshot');
});

/* ═══ اختبار ٣: الباك رجّع HTML/محتوى مش JSON ⇒ برضو مافيش لقطة ═══ */
test('الباك رجّع محتوى مش JSON ⇒ 503 ومافيش لقطة', async () => {
  const fetchMock = async (url) => {
    if (String(url).includes('staging.example.test')) {
      return new Response('<html>oops</html>',
        { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    return new Response('nope', { status: 404 });
  };
  const w = makeWorker(fetchMock);
  const res = await w.fetch(req('https://preview.example.test/api/opp/list/swing'), env(), {});
  const raw = await res.text();
  assert.equal(res.status, 503);
  assert.ok(!raw.includes('OLDTICKER'));
});

/* ═══ اختبار ٤: استثناء الشبكة ⇒ 503 (مافيش لقطة) ═══ */
test('استثناء الشبكة ⇒ 503 ومافيش لقطة', async () => {
  const fetchMock = async (url) => {
    if (String(url).includes('staging.example.test')) {
      throw new Error('network down');
    }
    return new Response('nope', { status: 404 });
  };
  const w = makeWorker(fetchMock);
  const res = await w.fetch(req('https://preview.example.test/api/opp/list/swing'), env(), {});
  const raw = await res.text();
  assert.equal(res.status, 503);
  assert.ok(!raw.includes('OLDTICKER'));
});

/* ═══ اختبار ٥: السلوك القديم متاح بس صريح (fallback=on) ═══ */
test('fallback=on الصريح ⇒ يرجع اللقطة (للتوافق، والقرار للمالك)', async () => {
  const fetchMock = async (url) => {
    if (String(url).includes('staging.example.test')) {
      return new Response('down', { status: 502 });
    }
    return new Response('nope', { status: 404 });
  };
  const w = makeWorker(fetchMock);
  const res = await w.fetch(req('https://preview.example.test/api/opp/list/swing'),
    env({ OCTA_SNAPSHOT_FALLBACK: 'on' }), {});
  const raw = await res.text();
  assert.equal(res.status, 200);
  assert.ok(raw.includes('OLDTICKER'), 'الرجوع للقطة لازم يشتغل مع fallback=on');
});

/* ═══ اختبار ٦: مسار Alpha نفس السياسة ═══ */
test('مسار Alpha: الباك فشل ⇒ 503 ومافيش لقطة', async () => {
  const fetchMock = async (url) => {
    if (String(url).includes('staging.example.test')) {
      return new Response('down', { status: 502 });
    }
    return new Response('nope', { status: 404 });
  };
  const w = makeWorker(fetchMock);
  const res = await w.fetch(req('https://preview.example.test/api/alpha/list'), env(), {});
  const raw = await res.text();
  assert.equal(res.status, 503);
  assert.ok(!raw.includes('OLDTICKER'));
});
