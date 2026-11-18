/* ══════════════════════════════════════════════════════════════════════
   🧪🛡️ الجولة ٢٣ (R23) — تطبيع مسار الأصول قبل بلوك اللقطات
   ──────────────────────────────────────────────────────────────────────
   📌 العيب المقاس **حيًّا** (١٨ نوفمبر ٢٠٢٦ ⭐):
      https://octashares.com/data/opp_snapshot.json    ⇒ 200 (1,460,164 B ⭐)
      https://octashares.com/data/./opp_snapshot.json   ⇒ 200 (1,460,164 B ⭐)
      https://octashares.com/data/%6fpp_snapshot.json  ⇒ 307 ⇒ 200 (1,460,164 B ⭐)
   📌 ⛔ السبب: `isSnapshotPath` كانت مطابقة **تامة** على `pathname.toLowerCase()`
      ⇒ `./` و`//` والمُرمَّز كلّها بتتجاوز الحارس ⭐.

   📌 المطلوب:
      ① كل صيغ المسار المقاسة ⇒ 404 ⭐ (من غير استثناء ⭐).
      ② ⭐⭐ **البرهان السالب** ⭐: نفس الصيغ على الدالة القديمة (مطابقة تامة ⭐)
         ⇒ لازم **تتجاوز** ⇒ يثبت إن الاختبار بيكشف العيب ⭐ (مش بيمشي وخلاص ⭐).
      ③ المسارات السليمة تفضل شغالة ⭐ (بلوك أضيق ⭐ مش بلوك عام ⭐).

   📌 التشغيل:  node --test assets/tests/r23-snapshot-path-normalization.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8');

/* ⭐ نفس تطبيع سيرفر الأصول الحقيقي ⭐
   (Cloudflare Assets بيحلّ `./` و`..` و`//` ⭐ ⇒ لازم الـmock يحلّها كمان ⭐
    ⇒ وإلا الاختبار هيخفي العيب ⭐ ⭐). */
function resolveAssetKey(pathname) {
  const parts = [];
  for (const seg of String(pathname).split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { parts.pop(); continue; }
    parts.push(seg);
  }
  return parts.join('/');
}

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

function req(url) {
  const h = new Headers();
  h.set('Cookie', 'octa_token=test-session-token');
  return new Request(url, { method: 'GET', headers: h });
}

/* أصول فيها الملفان (سيناريو الإصدار القديم ⭐) */
function makeAssets(files) {
  return {
    async fetch(request) {
      const u = new URL(request.url);
      const name = resolveAssetKey(u.pathname.replace(/^\//, '')) || 'index.html';
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
  'data/alpha_snapshot.json': JSON.stringify({ ok: true, alpha: [] }),
  'data/egx30_history.json': JSON.stringify({ ok: true, rows: [] })
};

function env(extra) {
  return Object.assign({
    OCTA_API_URL: 'https://staging.example.test',
    OCTA_OPP_SNAPSHOT: 'on',
    OCTA_ALPHA_SNAPSHOT: 'on',
    ASSETS: makeAssets(OLD_BUNDLE)
  }, extra || {});
}

/* ⭐⭐ الصيغ المقاسة حيًّا ⭐⭐ ⇒ كل واحدة كانت بتتجاوز الحارس ⭐ */
const LEAK_VARIANTS = [
  '/data/opp_snapshot.json',
  '/data/./opp_snapshot.json',
  '/data//opp_snapshot.json',
  '/data/%6fpp_snapshot.json',
  '/data/opp_snapshot.json/',
  '/data/x/../opp_snapshot.json',
  '/data/OPP_SNAPSHOT.JSON',
  '/data/Alpha_Snapshot.json'
];

test('R23-01: كل صيغ مسار لقطة الفرص ⇒ 404 (المقاسة حيًّا ⭐)', async () => {
  const w = makeWorker(async () => new Response('x', { status: 500 }));
  for (const p of LEAK_VARIANTS) {
    const res = await w.fetch(req('https://preview.example.test' + p), env(), {});
    assert.equal(res.status, 404, `المسار ${p} لسه بينزل ⭐ (المتوقّع 404 ⭐)`);
  }
});

test('R23-02: كل صيغ مسار لقطة Alpha ⇒ 404', async () => {
  const w = makeWorker(async () => new Response('x', { status: 500 }));
  for (const p of LEAK_VARIANTS.map(x => x.replace('opp', 'alpha'))) {
    const res = await w.fetch(req('https://preview.example.test' + p), env(), {});
    assert.equal(res.status, 404, `المسار ${p} لسه بينزل ⭐ (المتوقّع 404 ⭐)`);
  }
});

test('R23-03: ⭐⭐ برهان سالب ⭐⭐ — الدالة القديمة (مطابقة تامة) بتتجاوز ⭐',
  async () => {
    /* ⭐⭐ الدالة القديمة ⭐⭐ (قبل R23 ⭐): مطابقة تامة على toLowerCase ⭐ */
    const OLD_PATHS = ['/data/opp_snapshot.json', '/data/alpha_snapshot.json'];
    const oldIsSnapshotPath = (pathname) => {
      const p = String(pathname || '').toLowerCase();
      return OLD_PATHS.indexOf(p) !== -1;
    };
    /* ⭐ لازم نجيب الصيغ اللي بتتجاوز ⭐ (وإلا الاختبار مالهوش معنى ⭐) */
    const bypassed = LEAK_VARIANTS.filter(p => !oldIsSnapshotPath(p));
    assert.ok(bypassed.length >= 5,
      `الدالة القديمة كانت بتتجاوز ${bypassed.length} صيغة بس ⭐ — لازم 5+ ⭐`);
    /* ⭐⭐ والدالة الجديدة لازم تسدّها كلها ⭐⭐ */
    const w = makeWorker(async () => new Response('x', { status: 500 }));
    for (const p of bypassed) {
      const res = await w.fetch(req('https://preview.example.test' + p), env(), {});
      assert.equal(res.status, 404,
        `الحارس الجديد ما سدّش ${p} ⭐ (يعني الاختبار مش بيكشف العيب ⭐)`);
    }
  });

test('R23-04: المسارات السليمة تفضل شغالة ⭐ (بلوك أضيق ⭐ مش بلوك عام ⭐)',
  async () => {
    const w = makeWorker(async () => new Response('x', { status: 500 }));
    const okPaths = ['/index.html', '/data/egx30_history.json'];
    for (const p of okPaths) {
      const res = await w.fetch(req('https://preview.example.test' + p), env(), {});
      assert.ok(res.status < 400,
        `المسار السليم ${p} اتقفل ⭐ (الحالة ${res.status} ⭐)`);
    }
  });
