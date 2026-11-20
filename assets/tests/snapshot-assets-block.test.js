/* ══════════════════════════════════════════════════════════════════════
   🧪🛡️ الجولة ١٤ — منع تحميل لقطات المحرّك مباشرة (أصول النشر)
   ──────────────────────────────────────────────────────────────────────
   ⛔ العيب المقاس (١٦ نوفمبر ٢٠٢٦):
      https://octashares.com/data/opp_snapshot.json ⇒ HTTP 200 · ١,٤٦٠,١٦٤ بايت
      https://octashares.com/data/alpha_snapshot.json ⇒ HTTP 200 · ١٦٢,٨٨٤ بايت
      ⇒ تعطيل الـfallback داخل الـWorker **مش كفاية** — الملف نفسه
        كان بينزل من الموقع.

   📌 المطلوب:
      ① المسار المباشر بيرجّع 404 (من غير استثناء).
      ② النسخة القديمة (اللي فيها الملف) بتفضل محمية بعد النشر.
      ③ المسارات التانية بتفضل شغالة.

   📌 التشغيل:  node --test assets/tests/snapshot-assets-block.test.js
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

function req(url, opts = {}) {
  const h = new Headers(opts.headers || {});
  if (!h.get('Cookie')) h.set('Cookie', 'octa_token=test-session-token');
  return new Request(url, {
    method: opts.method || 'GET',
    headers: h,
    body: opts.body
  });
}

/* أصول فيها الملفان (سيناريو الإصدار القديم) */
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
          ? 'application/json' : 'text/html; charset=utf-8' }
      });
    }
  };
}

const OLD_BUNDLE = {
  'index.html': '<html><head></head><body>ok</body></html>',
  'data/opp_snapshot.json': JSON.stringify({
    ok: true, generated_at: '2026-11-10T03:22:36Z', strategies: [],
    lists: { swing: { summary: {}, items: [{ code: 'OLDTICKER' }] } }
  }),
  'data/alpha_snapshot.json': JSON.stringify({ ok: true, alpha: [] })
};

function env(extra) {
  return Object.assign({
    OCTA_API_URL: 'https://staging.example.test',
    OCTA_OPP_SNAPSHOT: 'on',
    OCTA_ALPHA_SNAPSHOT: 'on',
    ASSETS: makeAssets(OLD_BUNDLE)
  }, extra || {});
}

test('مسار لقطة الفرص ⇒ 404 (مش 200)', async () => {
  const w = makeWorker(async () => new Response('x', { status: 500 }));
  const res = await w.fetch(req('https://preview.example.test/data/opp_snapshot.json'),
    env(), {});
  assert.equal(res.status, 404, 'الملف لسه بينزل من الموقع!');
  const body = await res.json();
  assert.equal(body.why, 'snapshot_assets_blocked');
});

test('مسار لقطة Alpha ⇒ 404 (مش 200)', async () => {
  const w = makeWorker(async () => new Response('x', { status: 500 }));
  const res = await w.fetch(req('https://preview.example.test/data/alpha_snapshot.json'),
    env(), {});
  assert.equal(res.status, 404, 'الملف لسه بينزل من الموقع!');
});

test('حتى مع fallback=on (سلوك قديم متاح) ⇒ الملف ما ينزلش', async () => {
  const w = makeWorker(async () => new Response('x', { status: 500 }));
  const res = await w.fetch(req('https://preview.example.test/data/opp_snapshot.json'),
    env({ OCTA_SNAPSHOT_FALLBACK: 'on' }), {});
  assert.equal(res.status, 404,
    'الرجوع للقطة القديمة جوّه الـWorker مسموح — بس الملف نفسه ما ينزلش');
});

test('المسارات العادية بتفضل شغالة (مافيش بلوك عام)', async () => {
  const w = makeWorker(async () => new Response('x', { status: 500 }));
  const res = await w.fetch(req('https://preview.example.test/index.html'), env(), {});
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes('ok'));
});

test('البلوك موجود في المصدر (مافيش رجوع للكاش غيره)', () => {
  assert.ok(SRC.includes('snapshot_assets_blocked'),
    'البلوك مش موجود في المصدر');
  assert.ok(SRC.includes('/data/opp_snapshot.json'));
  assert.ok(SRC.includes('/data/alpha_snapshot.json'));
});
