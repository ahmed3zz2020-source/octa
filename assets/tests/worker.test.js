/* ═══════════════════════════════════════════════════════════════
   🧪 اختبار بوابة الـWorker — assets/tests/worker.test.js
   ───────────────────────────────────────────────────────────────
   التشغيل:  cd /workspace/octa && node --test assets/tests/worker.test.js
   ⛔ مافيش framework تاني — node:test + node:assert/strict بس

   📌 ليه الملف ده؟
      الـWorker بقى بيقدّم صفحة البوابة للزائر المجهول
      (٥٠ ك.ب بدل ١٫٨ ميجا)، وبيـproxy للـAPI بترويسة
      Authorization + جسم الطلب + Set-Cookie.

      الأخطاء في الـWorker مش بتظهر في الكود — بتظهر كـ404
      أو ٥٠١ في المتصفح. فلازم نختبره وهو stand-alone.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8');

/* ═══════════════════════════════════════════════════════════
   🛠运行环境 — بنعمل بيئة Worker وهمية
   ═══════════════════════════════════════════════════════════ */
function makeWorker() {
  /* بنصدّر الـdefault عن طريق eval — عشان الـworker موديل ESM
     و مفيش package type: module في المشروع.
     ⛔ بنحوّل `export default` لـ `module.exports` عشان new Function
        يقبلها. */
  const mod = { exports: {} };
  const body = SRC.replace('export default', 'module.exports =');
  const fn = new Function('module', 'exports', 'Request', 'Response',
    'Headers', 'URL', 'fetch', 'setTimeout', body);
  fn(mod, mod.exports, Request, Response, Headers, URL,
    globalThis.fetch, globalThis.setTimeout);
  return mod.exports;
}

/* طلب وهمية */
function req(url, opts = {}) {
  const h = new Headers(opts.headers || {});
  return new Request(url, {
    method: opts.method || 'GET',
    headers: h,
    body: opts.body,
  });
}

/* Serve وهمية للـassets */
function makeAssets(files) {
  return {
    async fetch(request) {
      const u = new URL(request.url);
      const name = u.pathname.replace(/^\//, '') || 'index.html';
      const body = files[name];
      if (body === undefined) {
        return new Response('not found', { status: 404 });
      }
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
  'gate.html': '<html>صفحة البوابة</html>',
  'assets/js/octa-gate.js': '/* gate */',
};

/* ═══════════════════════════════════════════════════════════
   🚪 ① البوابة
   ═══════════════════════════════════════════════════════════ */
test('زائر مجهول (مفيش كوكي) → صفحة البوابة', async () => {
  const w = makeWorker();
  const env = { ASSETS: makeAssets(FILES) };
  const r = await w.fetch(req('https://octashares.com/'), env);
  assert.equal(r.status, 200);
  const t = await r.text();
  assert.ok(t.includes('صفحة البوابة'), 'مش صفحة البوابة: ' + t.slice(0, 80));
  assert.ok(!t.includes('التطبيق الكامل'));
});

test('زائر عنده كوكي → التطبيق', async () => {
  const w = makeWorker();
  const env = { ASSETS: makeAssets(FILES) };
  const r = await w.fetch(req('https://octashares.com/', {
    headers: { 'Cookie': 'octa_token=abc.def; other=1' },
  }), env);
  const t = await r.text();
  assert.ok(t.includes('التطبيق الكامل'), 'مش التطبيق: ' + t.slice(0, 80));
});

test('كوكي فاضي (-octa_token=) →treated كأن مفيش جلسة', async () => {
  const w = makeWorker();
  const env = { ASSETS: makeAssets(FILES) };
  const r = await w.fetch(req('https://octashares.com/', {
    headers: { 'Cookie': 'octa_token=; x=1' },
  }), env);
  const t = await r.text();
  assert.ok(t.includes('صفحة البوابة'));
});

test('الكوكي في middle مش أول واحد → بيتعرف عليه', async () => {
  const w = makeWorker();
  const env = { ASSETS: makeAssets(FILES) };
  const r = await w.fetch(req('https://octashares.com/', {
    headers: { 'Cookie': 'a=1; octa_token=xyz; b=2' },
  }), env);
  const t = await r.text();
  assert.ok(t.includes('التطبيق الكامل'));
});

test('صفحة الشارت كمان بتتقفل', async () => {
  const w = makeWorker();
  const env = { ASSETS: makeAssets(FILES) };
  const r = await w.fetch(req('https://octashares.com/chart'), env);
  const t = await r.text();
  assert.ok(t.includes('صفحة البوابة'));
});

test('OCTA_GATE=off ⇐ البوابة مقفولة (المعاينة قبل نشر الـAPI)', async () => {
  const w = makeWorker();
  const env = { ASSETS: makeAssets(FILES), OCTA_GATE: 'off' };
  const r = await w.fetch(req('https://octashares.com/'), env);
  const t = await r.text();
  assert.ok(t.includes('التطبيق الكامل'),
    'البوابة لسه مقفولة رغم OCTA_GATE=off: ' + t.slice(0, 80));
});

test('صفحة البوابة (/gate.html) متاحة دايماً حتى والبوابة مقفولة', async () => {
  const w = makeWorker();
  const env = { ASSETS: makeAssets(FILES), OCTA_GATE: 'off' };
  const r = await w.fetch(req('https://octashares.com/gate.html'), env);
  assert.equal(r.status, 200);
  assert.ok((await r.text()).includes('صفحة البوابة'));
});

test('الـassets (js/css) بتتنفع من غير جلسة', async () => {
  const w = makeWorker();
  const env = { ASSETS: makeAssets(FILES) };
  const r = await w.fetch(req('https://octashares.com/assets/js/octa-gate.js'), env);
  assert.equal(r.status, 200);
  assert.ok((await r.text()).includes('gate'));
});

/* ═══════════════════════════════════════════════════════════
   🔌 ② الـproxy
   ═══════════════════════════════════════════════════════════ */
test('الـproxy بيبعت Authorization والكوكي وجسم الطلب', async () => {
  /* ⛔ الـmock لازم يتبعت *قبل* عمل الـworker — عشان الـworker
     ياخد دالة fetch وقت الإنشاء. */
  let seen = null;
  globalThis.fetch = async (target, init) => {
    seen = { target, init };
    return new Response('{"ok":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const w = makeWorker();
  const env = { ASSETS: makeAssets(FILES) };
  const r = await w.fetch(req('https://octashares.com/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer TOK',
      'Cookie': 'octa_token=COOKIE',
      'Content-Type': 'application/json',
    },
    body: '{"q":"hi"}',
  }), env);
  assert.equal(r.status, 200);
  assert.ok(seen.target.includes('/api/chat'), seen.target);
  assert.equal(seen.init.headers.get('Authorization'), 'Bearer TOK');
  assert.equal(seen.init.headers.get('Cookie'), 'octa_token=COOKIE');
  assert.equal(seen.init.headers.get('Content-Type'), 'application/json');
  assert.ok(seen.init.body, 'مافيش جسم للطلب!');
  const bodyText = Buffer.from(seen.init.body).toString('utf8');
  assert.ok(bodyText.includes('"q":"hi"'), 'الجسم غلط: ' + bodyText);
});

test('Set-Cookie بيرجع للصفحة (كوكي الجلسة)', async () => {
  globalThis.fetch = async () => new Response('{"ok":true}', {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'octa_token=abc; HttpOnly; Secure; SameSite=Lax; Path=/',
    },
  });
  const w = makeWorker();
  const env = { ASSETS: makeAssets(FILES) };
  const r = await w.fetch(req('https://octashares.com/api/auth/pin/login', {
    method: 'POST', body: '{"pin":"1234"}',
  }), env);
  const sc = r.headers.get('Set-Cookie');
  assert.ok(sc, 'مافيش Set-Cookie في الرد!');
  assert.ok(sc.includes('octa_token='), sc);
  assert.ok(sc.includes('HttpOnly'), sc);
});

test('الـproxy بيرجّع حالة الـAPI زي ما هي', async () => {
  globalThis.fetch = async () => new Response('{"why":"unauthorized"}', {
    status: 401, headers: { 'Content-Type': 'application/json' },
  });
  const w = makeWorker();
  const env = { ASSETS: makeAssets(FILES) };
  const r = await w.fetch(req('https://octashares.com/api/prices'), env);
  assert.equal(r.status, 401);
});

test('الـquery string بيوصل للـAPI زي ما هو', async () => {
  let seen = null;
  globalThis.fetch = async (target) => {
    seen = target;
    return new Response('{}', { status: 200,
      headers: { 'Content-Type': 'application/json' } });
  };
  const w = makeWorker();
  const env = { ASSETS: makeAssets(FILES) };
  await w.fetch(req('https://octashares.com/api/markets?market=egypt'), env);
  assert.ok(seen.includes('market=egypt'), seen);
});

/* ═══════════════════════════════════════════════════════════
   📄 ③ ملفات الحزمة
   ═══════════════════════════════════════════════════════════ */
test('gate.html موجود في المستودع', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'gate.html')));
});
test('ستايل البوابة مستقل موجود', () => {
  const f = path.join(ROOT, 'assets/css-gate.css');
  assert.ok(fs.existsSync(f));
  const s = fs.readFileSync(f, 'utf8');
  assert.ok(s.includes('.gt-wrap'), 'ستايل البوابة ناقص');
  assert.ok(s.includes('.gt-pad'), 'لوحة الأرقام ناقصة');
});
test('الواجهة بتبعت التوكن على كل مسارات الـAPI', () => {
  const s = fs.readFileSync(path.join(ROOT, 'assets/js/octa-api.js'), 'utf8');
  assert.ok(s.includes("o.headers = h"), 'مافيش الحقن');
  assert.ok(s.includes('same-origin'), 'مافيش credentials');
});
test('مافيش اسم أداة ذكاء اصطناعي في ملفات الواجهة الجديدة', () => {
  for (const f of ['gate.html', 'assets/css-gate.css', 'assets/js/octa-api.js',
                   'worker.js']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!/gemini|claude|chatgpt|copilot/i.test(s), f);
  }
});
