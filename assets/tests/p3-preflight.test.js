/* ═══════════════════════════════════════════════════════════════
   🧪 الجولة ١٨ (P3) · اختبار فحص الجاهزية (/api/preflight)
   ───────────────────────────────────────────────────────────────
   📌 الغرض: نقطة تشخيص واحدة بتقول للمالك: الـAPI شغّال؟ والإيميل
      مضبوط؟ — بدل ما ي|Open الـconsole ويقرا 530.
   ⛔ قراءة بس · مافيش كتابة · مافيش بيانات مستخدمين · مافيش أسرار.
   ⛔ الرد: ٤ حقول بالظبط:
        {ok:true, api:'up'|'down', mail:'on'|'off'|'unknown', checked_at:<ISO>}
   ⛔ متاح بلا تسجيل دخول (تشخيص).

   📌 التشغيل: node --test assets/tests/p3-preflight.test.js
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8');

/* ⛔ عنوان داخلي وهمي + ⛔ سر وهمي — لازم ما يظهروش في الرد ⬇️ */
const INTERNAL_API = 'https://staging-internal.example.test';
const FAKE_SECRET = 'super-secret-proxy-value';

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
  return new Request(url, { method: o.method || 'GET', headers: h, body: o.body });
}

function makeAssets(files) {
  return {
    async fetch(request) {
      const u = new URL(request.url);
      const name = u.pathname.replace(/^\//, '') || 'index.html';
      const body = files[name];
      if (body === undefined) return new Response('not found', { status: 404 });
      return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
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

const P = 'https://octa-preview.example.test/api/preflight';

/* ⛔ فحص مشترك — الرد لازم يكون JSON بالحقول المطلوبة وبس ⬇️ */
async function readPreflight(w, env) {
  const r = await w.fetch(req(P), env);
  const text = await r.text();
  return { r: r, text: text, j: JSON.parse(text) };
}

function assertShape(j, text) {
  assert.equal(j.ok, true, 'لازم ok:true');
  assert.ok(j.api === 'up' || j.api === 'down', 'api لازم up|down: ' + j.api);
  assert.ok(j.mail === 'on' || j.mail === 'off' || j.mail === 'unknown',
    'mail لازم on|off|unknown: ' + j.mail);
  assert.ok(typeof j.checked_at === 'string' && j.checked_at.length > 10,
    'checked_at لازم ISO: ' + j.checked_at);
  assert.ok(!isNaN(Date.parse(j.checked_at)), 'checked_at لازم تاريخ صالح');
  /* ⛔ الحقول المطلوبة بس — مافيش زيادة ⬇️ */
  const keys = Object.keys(j).sort().join(',');
  assert.equal(keys, 'api,checked_at,mail,ok', 'الحقول زيادة/ناقصة: ' + keys);
  /* ⛔ مافيش عنوان داخلي ولا سر في السلسلة كلها ⬇️ */
  assert.ok(text.indexOf(INTERNAL_API) === -1, 'العنوان الداخلي اتسرّب: ' + text);
  assert.ok(text.indexOf('example.test') === -1, 'اسم المضيف اتسرّب: ' + text);
  assert.ok(text.indexOf('http') === -1, 'أي رابط اتسرّب: ' + text);
  assert.ok(text.indexOf(FAKE_SECRET) === -1, 'السر اتسرّب: ' + text);
  assert.ok(!/secret|token|password|api[_-]?key|url|host/i.test(text),
    'اسم حقل حسّاس في الرد: ' + text);
}

/* ═══════════════════════════════════════════════════════════════
   ①  الـAPI شغّال والإيميل مضبوط ⬇️
   ═══════════════════════════════════════════════════════════════ */
test('P3-P1 · health 200 + mail_configured:true ⇒ api:up · mail:on', async () => {
  const w = makeWorker(async () => new Response(
    JSON.stringify({ ok: true, mail_configured: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
  const { r, text, j } = await readPreflight(w, envFor());
  assert.equal(r.status, 200, 'لازم ٢٠٠');
  assertShape(j, text);
  assert.equal(j.api, 'up');
  assert.equal(j.mail, 'on');
});

test('P3-P1 · mail_configured:false ⇒ mail:off', async () => {
  const w = makeWorker(async () => new Response(
    JSON.stringify({ ok: true, mail_configured: false }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
  const { text, j } = await readPreflight(w, envFor());
  assertShape(j, text);
  assert.equal(j.mail, 'off');
});

test('P3-P1 · من غير mail_configured ⇒ mail:unknown (مش تخمين)', async () => {
  const w = makeWorker(async () => new Response(
    JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
  const { text, j } = await readPreflight(w, envFor());
  assertShape(j, text);
  assert.equal(j.mail, 'unknown');
});

/* ═══════════════════════════════════════════════════════════════
   ②  الباك شغّال بس محمي (401/403) ⬇️
   ═══════════════════════════════════════════════════════════════ */
test('P3-P2 · health 403 ⇒ api:up · mail:unknown', async () => {
  const w = makeWorker(async () => new Response('{"error":"forbidden"}', {
    status: 403, headers: { 'Content-Type': 'application/json' },
  }));
  const { text, j } = await readPreflight(w, envFor());
  assertShape(j, text);
  assert.equal(j.api, 'up', 'الخادم شغّال (403 = محمي)');
  assert.equal(j.mail, 'unknown');
});

test('P3-P2 · health 401 ⇒ api:up · mail:unknown', async () => {
  const w = makeWorker(async () => new Response('{"error":"unauthorized"}', {
    status: 401, headers: { 'Content-Type': 'application/json' },
  }));
  const { text, j } = await readPreflight(w, envFor());
  assertShape(j, text);
  assert.equal(j.api, 'up');
  assert.equal(j.mail, 'unknown');
});

/* ═══════════════════════════════════════════════════════════════
   ③  الباك مش موصل ⬇️
   ═══════════════════════════════════════════════════════════════ */
test('P3-P3 · الـfetch بيرمي ⇒ api:down · mail:unknown (ومفيش 530)', async () => {
  const w = makeWorker(async () => { throw new Error('network down'); });
  const { r, text, j } = await readPreflight(w, envFor());
  assert.equal(r.status, 200, 'الفحص نفسه لازم يردّ ٢٠٠ (هو التشخيص)');
  assertShape(j, text);
  assert.equal(j.api, 'down');
  assert.equal(j.mail, 'unknown');
});

test('P3-P3 · رد 530 من الـedge ⇒ api:down', async () => {
  const w = makeWorker(async () => new Response('error code: 1016', {
    status: 530, headers: { 'Content-Type': 'text/plain' },
  }));
  const { text, j } = await readPreflight(w, envFor());
  assertShape(j, text);
  assert.equal(j.api, 'down');
});

test('P3-P3 · من غير وجهة API (fail-closed) ⇒ api:down', async () => {
  const w = makeWorker(async () => new Response('{}', { status: 200 }));
  const env = envFor();
  delete env.OCTA_API_URL;
  delete env.OCTA_API_DIRECT;
  const { text, j } = await readPreflight(w, env);
  assertShape(j, text);
  assert.equal(j.api, 'down');
});

test('P3-P3 · الـAPI بياكل الوقت ⇒ timeout واضح ⇒ api:down', async () => {
  /* ⛔ الـfetch بيعلّق لحد ما الإشارة تقطع (٣ ثواني) ⬇️
     ⛌ المؤقّت الحارس (٦ ثواني) بيخلي الـevent loop مستني
        (مؤقّت AbortSignal نفسه مش بيحرّك الـloop). */
  const w = makeWorker((u, init) => new Promise((resolve, reject) => {
    const keep = setTimeout(function () { reject(new Error('timeout-guard')); }, 6000);
    if (init && init.signal && init.signal.addEventListener) {
      init.signal.addEventListener('abort', function () {
        clearTimeout(keep);
        reject(new Error('aborted'));
      });
    }
  }));
  const { r, text, j } = await readPreflight(w, envFor());
  assert.equal(r.status, 200, 'الفحص نفسه بيردّ ٢٠٠');
  assertShape(j, text);
  assert.equal(j.api, 'down', 'المهلة ⇒ down (مش تعليق)');
  assert.equal(j.mail, 'unknown');
});

/* ═══════════════════════════════════════════════════════════════
   ④  ⛔ قراءة بس + متاح بلا تسجيل دخول ⬇️
   ═══════════════════════════════════════════════════════════════ */
test('P3-P4 · متاح بلا تسجيل دخول (من غير كوكي)', async () => {
  const w = makeWorker(async () => new Response('{"ok":true}', {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }));
  const r = await w.fetch(req(P), envFor());
  assert.equal(r.status, 200, 'لازم مفتوح للتشخيص');
  const j = await r.json();
  assert.equal(j.ok, true);
});

test('P3-P4 · مافيش كتابة — الطلب المرسل GET على /api/health بس', async () => {
  const calls = [];
  const w = makeWorker(async (u, init) => {
    calls.push({ u: String(u), method: (init && init.method) || 'GET' });
    return new Response('{"ok":true,"mail_configured":true}', {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  });
  await w.fetch(req(P), envFor());
  assert.equal(calls.length, 1, 'لازم نداء واحد بس: ' + JSON.stringify(calls));
  assert.equal(calls[0].method, 'GET', 'الفحص قراءة بس — مافيش كتابة');
  assert.ok(calls[0].u.indexOf('/api/health') > -1,
    'الفحص لازم يقرا /api/health بس: ' + calls[0].u);
});

test('P3-P4 · مافيش بيانات مستخدمين في الرد', async () => {
  const w = makeWorker(async () => new Response(
    JSON.stringify({ ok: true, mail_configured: true, users: [{ id: 7 }] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
  const { text, j } = await readPreflight(w, envFor());
  assertShape(j, text);
  assert.ok(text.indexOf('users') === -1, 'في بيانات مستخدمين في الرد: ' + text);
  assert.ok(text.indexOf('"id"') === -1, 'في معرّف مستخدم في الرد: ' + text);
});

test('P3-P5 · السر الداخلي ما يوصلش للمتصفح من غير سبب', async () => {
  const w = makeWorker(async () => new Response('{"ok":true}', {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }));
  const { text } = await readPreflight(w, envFor({
    OCTA_PROXY_SECRET: FAKE_SECRET,
  }));
  assert.ok(text.indexOf(FAKE_SECRET) === -1, 'السر اتسرّب في الرد: ' + text);
});
