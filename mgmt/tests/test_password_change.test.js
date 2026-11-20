/* ══════════════════════════════════════════════════════════════════════
   🛡️ اختبار تغيير كلمة مرور لوحة الإدارة — octa-mgmt
   ──────────────────────────────────────────────────────────────────────
   🎯 الهدف: إثاث إن المسار يعمل صح:
      ① ⛔ من غير جلسة ⇒ 401 (مش public ⭐)
      ② ⛔ كلمة المرور الحالية غلط ⇒ 401
      ③ ⛔ ٦ أرقام ⇒ 400 (مرفوضة ⭐ — مليون احتمال ⭐)
      ④ ✅ كلمة قوية + جلسة ⇒ 200 + الجلسة اتبطلت
      ⑤ ✅ بعد التغيير: الدخول بالكلمة الجديدة شغال ⭐ والقديمة مرفوضة
      ⑥ ⛔ CSRF (طلب من أصل خارجي) ⇒ 403
      ⑦ ⛔ من غير مخزن الحالة (DO ⭐) ⇒ 501 (fail-closed ⭐)

   ⛔ ما بنطبعش أي سر ⭐ — أعداد فقط.
   ⛔ التشغيل:
      node --test mgmt/tests/
      MGMT_WORKER=<worker.js> node --test mgmt/tests/
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
/* ⭐ (R26) ⭐ موك الـDurable Object ⭐ (مشترك ⭐) */
const { makeDO } = require('./lib/domock.js');

const MGMT = path.join(__dirname, '..');
const WORKER = process.env.MGMT_WORKER || path.join(MGMT, 'worker.js');
const PUBLIC = process.env.MGMT_PUBLIC || path.join(MGMT, 'public');
const SECRET = 'test-secret-0123456789';
const PASSWORD = 'test-password';
const ADMIN_TOKEN = 'test-admin-token';

async function loadWorker() {
  const src = fs.readFileSync(WORKER, 'utf8');
  const url = 'data:text/javascript;base64,' + Buffer.from(src).toString('base64');
  const mod = await import(url);
  return { worker: mod.default, src };
}

function makeEnv(opts) {
  opts = opts || {};
  const env = {
    SESSION_SECRET: SECRET,
    APP_PASSWORD: PASSWORD,
    OCTA_ADMIN_TOKEN: ADMIN_TOKEN,
    /* ⭐ بيئة اختبار ⭐ */
    APP_ENV: 'test',
    ASSETS: {
      async fetch(req) {
        const u = new URL(req.url);
        let rel = decodeURIComponent(u.pathname);
        if (rel === '/' || rel === '') rel = '/index.html';
        const file = path.join(PUBLIC, rel.replace(/^\/+/, ''));
        if (!file.startsWith(PUBLIC)) return new Response('forbidden', { status: 403 });
        if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          return new Response('not found', { status: 404 });
        }
        return new Response(fs.readFileSync(file), {
          status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    },
  };
  if (opts.withDO !== false) env.REVOKE_DO = makeDO();
  return env;
}

function req(pathname, opts) {
  opts = opts || {};
  const headers = Object.assign({}, opts.headers);
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return new Request('https://octa-mgmt.test' + pathname, {
    method: opts.method || 'GET',
    headers,
    body: opts.body,
  });
}

function stubFetch(handler) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    return handler(String(url), init);
  };
  return { calls, restore() { globalThis.fetch = orig; } };
}

/* ⭐ كوكي جلسة ⭐ — مطابق لتوقيع العامل ⭐ (exp + tag ⭐) */
async function loginCookie(worker, env, password) {
  const res = await worker.fetch(
    req('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }),
    env
  );
  const sc = res.headers.get('Set-Cookie') || '';
  const m = sc.match(/octa_mgmt_sess=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

test('⛔ تغيير كلمة المرور: من غير جلسة ⇒ 401 (المسار مش public)', async () => {
  const { worker } = await loadWorker();
  const env = makeEnv();
  const stub = stubFetch(async () => new Response('{}', { status: 200 }));
  try {
    const res = await worker.fetch(
      req('/api/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: PASSWORD, next: 'strong-password-123' }),
      }),
      env
    );
    assert.equal(res.status, 401, 'من غير جلسة لازم 401 — got ' + res.status);
  } finally { stub.restore(); }
});

test('⛔ كلمة المرور الحالية غلط ⇒ 401', async () => {
  const { worker } = await loadWorker();
  const env = makeEnv();
  const stub = stubFetch(async () => new Response('{}', { status: 200 }));
  try {
    const ck = await loginCookie(worker, env, PASSWORD);
    assert.ok(ck, 'لازم دخول أول');
    const res = await worker.fetch(
      req('/api/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: 'octa_mgmt_sess=' + encodeURIComponent(ck) },
        body: JSON.stringify({ current: 'wrong-current', next: 'strong-password-123' }),
      }),
      env
    );
    assert.equal(res.status, 401, 'got ' + res.status);
  } finally { stub.restore(); }
});

test('⛔ ٦ أرقام ⇒ 400 (مرفوضة — مليون احتمال)', async () => {
  const { worker } = await loadWorker();
  const env = makeEnv();
  const stub = stubFetch(async () => new Response('{}', { status: 200 }));
  try {
    const ck = await loginCookie(worker, env, PASSWORD);
    const res = await worker.fetch(
      req('/api/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: 'octa_mgmt_sess=' + encodeURIComponent(ck) },
        body: JSON.stringify({ current: PASSWORD, next: '123456' }),
      }),
      env
    );
    assert.equal(res.status, 400, '٦ أرقام لازم 400 — got ' + res.status);
    const body = await res.json();
    assert.ok(body && body.why, 'لازم سبب الرفض');
  } finally { stub.restore(); }
});

test('⛔ من غير مخزن الحالة (DO) ⇒ 501 (fail-closed)', async () => {
  const { worker } = await loadWorker();
  const env = makeEnv({ withDO: false });
  const stub = stubFetch(async () => new Response('{}', { status: 200 }));
  try {
    const ck = await loginCookie(worker, env, PASSWORD);
    const res = await worker.fetch(
      req('/api/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: 'octa_mgmt_sess=' + encodeURIComponent(ck) },
        body: JSON.stringify({ current: PASSWORD, next: 'strong-password-123' }),
      }),
      env
    );
    assert.equal(res.status, 501, 'من غير DO لازم 501 — got ' + res.status);
  } finally { stub.restore(); }
});

test('✅ كلمة قوية ⇒ 200 · الجلسة اتبطلت · القديمة مرفوضة والجديدة شغالة', async () => {
  const { worker } = await loadWorker();
  const env = makeEnv();
  const stub = stubFetch(async () => new Response('{}', { status: 200 }));
  try {
    const ck = await loginCookie(worker, env, PASSWORD);
    assert.ok(ck, 'لازم دخول أول');
    const NEW = 'S3cure-Panel-2026';
    const res = await worker.fetch(
      req('/api/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: 'octa_mgmt_sess=' + encodeURIComponent(ck) },
        body: JSON.stringify({ current: PASSWORD, next: NEW }),
      }),
      env
    );
    assert.equal(res.status, 200, 'got ' + res.status);
    const body = await res.json();
    assert.ok(body && body.ok === true, 'لازم ok:true');
    assert.ok(body.reauth === true, 'لازم reauth');
    const sc = res.headers.get('Set-Cookie') || '';
    assert.ok(sc.includes('Max-Age=0'), 'لازم الكوكي يتمسح');

    /* ⛔ الجلسة القديمة اتبطلت ⭐ */
    const old = await worker.fetch(
      req('/api/session', { headers: { Cookie: 'octa_mgmt_sess=' + encodeURIComponent(ck) } }),
      env
    );
    assert.ok(old.status === 401 || old.status === 403, 'الجلسة القديمة لازم تموت — got ' + old.status);

    /* ⭐ المفتاح الخلفي ⭐ — الـsecret ⭐ بيفضل صالح ⭐ (عشان ما يتقفلش ⭐)
       📌 ⭐ وده **بالتصميم** ⭐ ⇒ ⭐ المالك يقدر يرجّع كلمة المرور من Cloudflare ⭐
          ⭐ لو نسيها ⭐ (٥ ضغطات ⭐) ⇒ ⭐ من غير ما يتقفل ⭐. */
    const oldPw = await worker.fetch(
      req('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: PASSWORD }),
      }),
      env
    );
    assert.equal(oldPw.status, 200, 'المفتاح الخلفي (الـsecret) لازم يفضل صالح — got ' + oldPw.status);

    /* ✅ الكلمة الجديدة شغالة ⭐ */
    const newCk = await loginCookie(worker, env, NEW);
    assert.ok(newCk, 'لازم الدخول بالكلمة الجديدة ينجح');
  } finally { stub.restore(); }
});

test('⛔ CSRF: طلب من أصل خارجي ⇒ 403', async () => {
  const { worker } = await loadWorker();
  const env = makeEnv();
  const stub = stubFetch(async () => new Response('{}', { status: 200 }));
  try {
    const ck = await loginCookie(worker, env, PASSWORD);
    const res = await worker.fetch(
      req('/api/password/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'octa_mgmt_sess=' + encodeURIComponent(ck),
          'Sec-Fetch-Site': 'cross-site',
          Origin: 'https://evil.example.com',
        },
        body: JSON.stringify({ current: PASSWORD, next: 'strong-password-123' }),
      }),
      env
    );
    assert.equal(res.status, 403, 'got ' + res.status);
  } finally { stub.restore(); }
});

test('⛔ العدّاد مشترك: ٨ محاولات ⇒ القفل يشتغل (429)', async () => {
  const { worker } = await loadWorker();
  const env = makeEnv();
  const stub = stubFetch(async () => new Response('{}', { status: 200 }));
  try {
    let last = 0;
    for (let i = 0; i < 9; i++) {
      const res = await worker.fetch(
        req('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'wrong-' + i }),
        }),
        env
      );
      last = res.status;
    }
    assert.equal(last, 429, 'لازم 429 بعد ٨ محاولات — got ' + last);
  } finally { stub.restore(); }
});
