/* ══════════════════════════════════════════════════════════════════════
   🛡️ الجولة ١٩ — AZ35-MGMT-PII-PUBLIC (برهان بديل، **أقوى** من شرط الجولة ١٨)
   ──────────────────────────────────────────────────────────────────────
   📌 شرط الجولة ١٨ كان: `mgmt.index.html` فيه رمز `@` **و** الـworker بيقدّم
      `env.ASSETS.fetch(request)` ⇒ ⛔ إنذار كاذب بعد الجولة ١٨:
      • الـ9 علامات `@` كلها CSS (@media/@keyframes) + رابط خط + مثال Flask
        ⇒ **مافيش بريد حقيقي** ⇒ العدّ بـ`@` مش فاحص.
      • و`env.ASSETS.fetch(request)` بقى جوّه **بوابة جلسة** ⇒ الأصول محمية.

   📌 البرهان الصح (الجولة ١٩) — شروط **أقوى**:
      ① من غير جلسة ⇒ مافيش 200 فيه محتوى لوحة (302/401 بس).
      ② الملف العام الوحيد = صفحة الدخول ⇒ مافيش بيانات إدارة فيه.
      ③ مافيش **بريد حقيقي** (regex) في الأصول العامة.
      ④ الأصول المحمية ⇒ `Cache-Control: no-store, private` (R18-A02).
      ⑤ نسخة من كوكي الجلسة بعد الخروج ⇒ 401 (إبطال من جهة السيرفر · R18-A01).

   ⛔ مافيش شبكة · مافيش نشر · ⛔ مافيش تنفيذ كود.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const MGMT = path.join(ROOT, 'mgmt');

/* ⛔ بريد حقيقي — مش أي رمز @ */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function loadWorker() {
  const src = fs.readFileSync(path.join(MGMT, 'worker.js'), 'utf8');
  return new Function('Response', 'Request', 'URL', 'crypto',
    src.replace(/^export\s*\{[^}]*\};?$/gm, '').replace('export default', 'return'))(Response, Request, URL, crypto);
}

function makeEnv() {
  return {
    APP_PASSWORD: 'synthetic-password',
    SESSION_SECRET: 'synthetic-secret',
    OCTA_ADMIN_TOKEN: 'synthetic-token',
    ASSETS: {
      fetch: async (req) => {
        const p = new URL(req.url).pathname;
        if (p === '/login.html') {
          return new Response('<!doctype html><html><body>login</body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        return new Response('<!doctype html><html><body>SYNTHETIC ADMIN PANEL</body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      },
    },
  };
}

function req(p, opts = {}) {
  return new Request('https://mgmt.invalid' + p, opts);
}

async function login(worker, env) {
  const res = await worker.fetch(req('/api/login', {
    method: 'POST', body: JSON.stringify({ password: env.APP_PASSWORD }),
  }), env);
  assert.equal(res.status, 200);
  return res.headers.get('Set-Cookie').split(';')[0];
}

test('AZ35: من غير جلسة ⇒ مافيش 200 فيه محتوى لوحة', async () => {
  const worker = loadWorker();
  const env = makeEnv();
  for (const p of ['/', '/index.html', '/app.js', '/panel.js', '/panel.css']) {
    const res = await worker.fetch(req(p), env);
    assert.ok(res.status === 401 || res.status === 302 || res.status === 307,
      p + ': لازم 401/302 بدون جلسة — got ' + res.status);
    const body = await res.text();
    assert.equal(body.includes('SYNTHETIC ADMIN PANEL'), false,
      p + ': جسم الرد فيه محتوى اللوحة');
  }
});

test('AZ35: الملف العام الوحيد = صفحة الدخول (مافيش بيانات إدارة)', async () => {
  const worker = loadWorker();
  const env = makeEnv();
  const res = await worker.fetch(req('/login.html'), env);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.equal(body.includes('SYNTHETIC ADMIN PANEL'), false, 'صفحة الدخول فيها محتوى اللوحة');
  const emails = body.match(EMAIL) || [];
  assert.equal(emails.length, 0, 'في بريد حقيقي في الأصل العام: ' + emails.slice(0, 3).join(','));
});

test('AZ35: مافيش بريد حقيقي في أي أصل عام من الـmgmt', () => {
  const pub = path.join(MGMT, 'public');
  const files = fs.readdirSync(pub).filter((f) => /\.(html|js|css|webmanifest)$/.test(f));
  const hits = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(pub, f), 'utf8');
    const m = text.match(EMAIL) || [];
    if (m.length) hits.push(f + ' → ' + m.slice(0, 3).join(','));
  }
  assert.equal(hits.length, 0, 'بريد حقيقي في الأصول العامة: ' + hits.join(' | '));
});

test('AZ35: الأصل المحمي ⇒ no-store/private (مافيش كاش مشترك)', async () => {
  const worker = loadWorker();
  const env = makeEnv();
  const cookie = await login(worker, env);
  const res = await worker.fetch(req('/index.html', { headers: { Cookie: cookie } }), env);
  assert.equal(res.status, 200);
  const cc = res.headers.get('Cache-Control') || '';
  assert.match(cc, /no-store/, 'Cache-Control لازم no-store — got ' + cc);
  assert.match(cc, /private/, 'Cache-Control لازم private — got ' + cc);
});

test('AZ35: نسخة الكوكي بعد الخروج ⇒ 401 (إبطال من جهة السيرفر)', async () => {
  const worker = loadWorker();
  const env = makeEnv();
  const cookie = await login(worker, env);
  const headers = { Cookie: cookie };
  assert.equal((await worker.fetch(req('/api/session', { headers }), env)).status, 200);
  assert.equal((await worker.fetch(req('/api/logout', { method: 'POST', headers }), env)).status, 200);
  assert.equal((await worker.fetch(req('/api/session', { headers }), env)).status, 401);
});
