/* ══════════════════════════════════════════════════════════════════════
   🐞🛡️ SEC-001 (الجولة ١٨ · P1) — بوابة الـWorker تتحقق من الجلسة
   ──────────────────────────────────────────────────────────────────────
   📌 العيب (من نص المراجعة):
      بوابة الـWorker كانت بتكتفي بوجود «كوكي غير فارغ» ⇒ أي كوكي
      عشوائي كان يعدّي البوابة (وكتخدم مسارات الـAPI).

   📌 المطلوب: الباب يتحقق فعليًا (توقيع/صلاحية الجلسة) — والتحقق
      يكون **قبل** الخدمة + **fail-closed**.

   📌 الحقيقة (مُثبتة في الباك — update_prices.py):
      التوكن موقّع HMAC والسر عند الباك ⇒ صاحب الصلاحية = الباك
      ⇒ البوابة تطلبه الحكم بدل ما تعتمد على «وجود» الكوكي.

   ⛔ مافيش شبكة · مافيش نشر · مافيش اتصال بالإنتاج (fetch مزوّر).
   📌 التشغيل:  node --test assets/tests/sec001-worker-session-gate.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8');
const STAGING = 'https://staging.example.test';

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
  'index.html': '<html>التطبيق الكامل</html>',
  'market.html': '<html>صفحة السوق العامة</html>',
  'gate.html': '<html>صفحة البوابة</html>',
};

/* ═══ موك الباك (صاحب الصلاحية) ═══
   📌 `validTokens` = التوكنات اللي الباك بيقبلها.
   📌 أي حاجة تانية ⇒ 401 (كوكي مزيّف).
   📌 `backendDown` = الباك كله واقع (التحقق + البيانات) — وده
      السيناريو الواقعي لما صاحب الصلاحية يبقى مش متاح.
   📌 بنسجّل كل النداءات عشان نثبت إن الفحص happened **قبل** الخدمة. */
function makeBackend(validTokens, opts) {
  const o = opts || {};
  const calls = [];
  const fetchMock = async (target, init) => {
    const u = String(target);
    calls.push({ url: u, init: init });
    if (o.backendDown) throw new Error('backend unreachable');
    if (u.indexOf('/api/auth/me') > -1) {
      const h = new Headers(init && init.headers ? init.headers : {});
      const auth = h.get('Authorization') || '';
      const ck = h.get('Cookie') || '';
      let tok = '';
      if (/^bearer\s+/i.test(auth)) tok = auth.slice(7).trim();
      else if (ck.indexOf('octa_token=') === 0) tok = ck.slice('octa_token='.length);
      if (validTokens.indexOf(tok) !== -1) {
        return new Response(JSON.stringify({ ok: true, user: { id: 'u1' } }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, data: 'real-data' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
  return { calls: calls, fetchMock: fetchMock };
}

function env(extra) {
  return Object.assign({
    ASSETS: makeAssets(FILES),
    OCTA_API_URL: STAGING,
    OCTA_GATE: 'on',
  }, extra || {});
}

/* ══════════════════════════════════════════════════════════════════════
   ① كوكي عشوائي ⇒ ما يعدّي البوابة (مسار API)
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-001 · كوكي عشوائي ⇒ 401 والطلب مابيوصلش للبيانات', async () => {
  const be = makeBackend(['tok-valid']);
  const w = makeWorker(be.fetchMock);
  const r = await w.fetch(req('https://octashares.com/api/portfolio', {
    headers: { 'Cookie': 'octa_token=deadbeefdeadbeef' },
  }), env());
  assert.equal(r.status, 401, 'لازم 401 — الرد: ' + r.status);
  const body = await r.text();
  assert.ok(body.indexOf('auth_required') > -1, body.slice(0, 120));
  const dataCalls = be.calls.filter((c) => c.url.indexOf('/api/portfolio') > -1);
  assert.equal(dataCalls.length, 0,
    'الطلب لازم ما يوصلش للـAPI الخلفية: ' + JSON.stringify(dataCalls));
});

/* ══════════════════════════════════════════════════════════════════════
   ② كوكي عشوائي ⇒ صفحة التطبيق مش بتتخدم (الزائر بيفضل على العام)
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-001 · كوكي عشوائي ⇒ صفحة التطبيق مش بتتخدم', async () => {
  const be = makeBackend(['tok-valid']);
  const w = makeWorker(be.fetchMock);
  const r = await w.fetch(req('https://octashares.com/', {
    headers: { 'Cookie': 'octa_token=deadbeefdeadbeef' },
  }), env());
  const t = await r.text();
  assert.ok(t.indexOf('التطبيق الكامل') === -1,
    'التطبيق اتخدم لكوكي عشوائي: ' + t.slice(0, 120));
});

/* ══════════════════════════════════════════════════════════════════════
   ③ كوكي صحيح ⇒ يعدّي (مسار API + صفحة التطبيق)
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-001 · كوكي صحيح ⇒ يعدّي البوابة ويوصل للبيانات', async () => {
  const be = makeBackend(['tok-valid']);
  const w = makeWorker(be.fetchMock);
  const r = await w.fetch(req('https://octashares.com/api/portfolio', {
    headers: { 'Cookie': 'octa_token=tok-valid' },
  }), env());
  assert.equal(r.status, 200, 'لازم 200 — الرد: ' + r.status);
  const t = await r.text();
  assert.ok(t.indexOf('real-data') > -1, t.slice(0, 120));
  const dataCalls = be.calls.filter((c) => c.url.indexOf('/api/portfolio') > -1);
  assert.equal(dataCalls.length, 1, 'الطلب لازم يوصل مرة واحدة للـAPI');
});

test('SEC-001 · كوكي صحيح ⇒ صفحة التطبيق بتتخدم', async () => {
  const be = makeBackend(['tok-valid']);
  const w = makeWorker(be.fetchMock);
  const r = await w.fetch(req('https://octashares.com/', {
    headers: { 'Cookie': 'octa_token=tok-valid' },
  }), env());
  const t = await r.text();
  assert.ok(t.indexOf('التطبيق الكامل') > -1, t.slice(0, 120));
});

/* ══════════════════════════════════════════════════════════════════════
   ④ الفحص **قبل** الخدمة (مش بعد تحميل البيانات)
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-001 · التحقق من الجلسة بيحصل قبل الخدمة', async () => {
  const be = makeBackend(['tok-valid']);
  const w = makeWorker(be.fetchMock);
  await w.fetch(req('https://octashares.com/api/portfolio', {
    headers: { 'Cookie': 'octa_token=tok-valid' },
  }), env());
  const first = be.calls[0];
  assert.ok(first, 'مافيش نداءات خالص');
  assert.ok(first.url.indexOf('/api/auth/me') > -1,
    'أول نداء لازم يكون التحقق من الجلسة: ' + first.url);
  const authIdx = be.calls.findIndex((c) => c.url.indexOf('/api/auth/me') > -1);
  const dataIdx = be.calls.findIndex((c) => c.url.indexOf('/api/portfolio') > -1);
  assert.ok(authIdx < dataIdx, 'التحقق لازم يسبق الخدمة');
});

/* ══════════════════════════════════════════════════════════════════════
   ⑤ fail-closed — صاحب الصلاحية مش متاح
   ──────────────────────────────────────────────────────────────────────
   📌 الـworker **مش** بيمنح وصول من تلقاء نفسه: لما الحكم مش
      متاح ⇒ الباك هو اللي بيحكم (وهو واقع ⇒ ٥٠٢ · مفيش بيانات).
      وصفحة التطبيق (اللي الـworker بيخدمها بنفسه) ⇒ بتتقفل.
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-001 · صاحب الصلاحية واقع ⇒ ما فيش بيانات بتتخدم', async () => {
  const be = makeBackend(['tok-valid'], { backendDown: true });
  const w = makeWorker(be.fetchMock);
  const r = await w.fetch(req('https://octashares.com/api/portfolio', {
    headers: { 'Cookie': 'octa_token=tok-valid' },
  }), env());
  /* ⛔ مفيش بيانات بتتخدم — الرد خطأ (مش 200 فيه بيانات) */
  assert.notEqual(r.status, 200, 'ما ينفعش يرد 200 وهو مش متأكد');
  const t = await r.text();
  assert.ok(t.indexOf('real-data') === -1,
    'بيانات اتخدمت من غير جلسة متأكَّد منها: ' + t.slice(0, 120));
});

test('SEC-001 · صاحب الصلاحية واقع ⇒ صفحة التطبيق مش بتتخدم', async () => {
  const be = makeBackend(['tok-valid'], { backendDown: true });
  const w = makeWorker(be.fetchMock);
  const r = await w.fetch(req('https://octashares.com/', {
    headers: { 'Cookie': 'octa_token=tok-valid' },
  }), env());
  const t = await r.text();
  assert.ok(t.indexOf('التطبيق الكامل') === -1,
    'التطبيق اتخدم من غير تحقق: ' + t.slice(0, 120));
});

/* ══════════════════════════════════════════════════════════════════════
   ⑥ مافيش اعتماد على «وجود الكوكي» في الكود
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-001 · مافيش دالة «hasSession» (وجود الكوكي بس) في الـworker', () => {
  assert.ok(SRC.indexOf('function hasSession') === -1,
    'دالة hasSession لسه موجودة — البوابة رجعت تعتمد على وجود الكوكي');
  assert.ok(/function sessionCredential/.test(SRC), 'sessionCredential مش موجودة');
  assert.ok(/function verifySession/.test(SRC), 'verifySession مش موجودة');
  assert.ok(/askSessionAuthority/.test(SRC), 'الاستعلام عن صاحب الصلاحية مش موجود');
});
