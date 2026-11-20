/* ══════════════════════════════════════════════════════════════════════
   🛡️ اختبار بوابة لوحة الإدارة — octa-mgmt
   ──────────────────────────────────────────────────────────────────────
   🎯 الهدف: إثبات إن أي ملف/صفحة ثابتة (خصوصاً index.html) **مش** بتتقدّم
      لزائر من غير جلسة صالحة، وإن الاستجابات ما بتسرّبش بيانات شخصية ولا
      تفاصيل داخلية.

   ⛔ ما بنطبعش أي بيانات مستخدمين — أعداد فقط.
   ⛔ التشغيل:
      node --test mgmt/tests/
      MGMT_WORKER=<worker.js> MGMT_PUBLIC=<public dir> node --test mgmt/tests/
      (المتغيّرات عشان نقدر نشغّل نفس الاختبار على «الأساس» كدليل سالب)
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { scan } = require('./lib/leakscan.js');
/* ⭐ (R26) ⭐ موك الـDurable Object ⭐ (لازم ⭐ — العامل fail-closed ⭐) */
const { makeDO, sessionCookie: buildSessionCookie } = require('./lib/domock.js');

const MGMT = path.join(__dirname, '..');
const WORKER = process.env.MGMT_WORKER || path.join(MGMT, 'worker.js');
const PUBLIC = process.env.MGMT_PUBLIC || path.join(MGMT, 'public');
const SECRET = 'test-secret-0123456789';
const PASSWORD = 'test-password';
const ADMIN_TOKEN = 'test-admin-token';

/* ⛔ عنوان الـbackend — من الكود نفسه (مش مكتوب يدوي) */
function upstreamOrigin(src) {
  const m = src.match(/const\s+ORIGIN\s*=\s*"([^"]+)"/);
  return m ? m[1] : 'https://unknown.invalid';
}

async function loadWorker() {
  const src = fs.readFileSync(WORKER, 'utf8');
  const url = 'data:text/javascript;base64,' + Buffer.from(src).toString('base64');
  const mod = await import(url);
  return { worker: mod.default, src };
}

/* ⛔ سيرفر ملفات ثابت بسيط (يحاكي env.ASSETS) */
function makeEnv() {
  return {
    SESSION_SECRET: SECRET,
    APP_PASSWORD: PASSWORD,
    OCTA_ADMIN_TOKEN: ADMIN_TOKEN,
    /* ⭐ (R26) ⭐ الـDO ⭐ — العامل ⭐ fail-closed ⭐ ⇒ ⛔ من غيره ⛔ 503 ⭐ */
    REVOKE_DO: makeDO(),
    /* ⭐ بيئة اختبار ⭐ (مش إنتاج ⭐ ⇒ ⛔ ما فيش قفل على مصدر الإبطال ⭐) */
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
        const body = fs.readFileSync(file);
        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    },
  };
}

/* ⭐⭐⭐ (R26) ⭐ التوقيع بقى يشمل **بصمة الاعتماد** ⭐
   📌 ⛔ قبل ⭐: التوقيع على `exp` بس ⭐ ⇒ ⛔ البصمة ما كانتش متحققة ⭐.
   ✅ دلوقتي ⭐: `exp + "." + tag` ⭐ ⇒ ⭐ تغيير كلمة المرور ⭐ ⛔ يبطل الكل ⭐. */
function sessionCookie(nowMs) {
  return buildSessionCookie(SECRET, PASSWORD, nowMs, '0');
}

function req(pathname, opts) {
  opts = opts || {};
  return new Request('https://octa-mgmt.test' + pathname, {
    method: opts.method || 'GET',
    headers: Object.assign({}, opts.headers),
    body: opts.body,
  });
}

/* ⛔ اعتراض الـfetch العالمي عشان نمنع أي شبكة ونسجّل الطلبات */
function stubFetch(handler) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    calls.push(u);
    return handler(u, init);
  };
  return {
    calls,
    restore() { globalThis.fetch = orig; },
  };
}

test('الملفات الثابتة محجوبة بغير جلسة — مافيش 200 فيه بيانات', async () => {
  const { worker } = await loadWorker();
  const env = makeEnv();
  const stub = stubFetch(async () => new Response('{}', { status: 200 }));
  try {
    for (const p of ['/', '/index.html', '/app.js', '/sw.js', '/manifest.webmanifest']) {
      const res = await worker.fetch(req(p), env);
      assert.ok(
        res.status === 401 || res.status === 302 || res.status === 307,
        p + ': لازم 401/302 بدون جلسة — got ' + res.status
      );
      const body = await res.text();
      const s = scan(body);
      assert.equal(s.emails, 0, p + ': جسم الرد فيه ' + s.emails + ' إيميل');
      assert.equal(s.ips, 0, p + ': جسم الرد فيه ' + s.ips + ' عنوان IP');
      assert.ok(
        !body.includes('up.railway.app'),
        p + ': جسم الرد فيه عنوان الـbackend'
      );
    }
  } finally { stub.restore(); }
});

test('بجلسة صالحة ⇒ الصفحة الثابتة تُقدّم (200)', async () => {
  const { worker } = await loadWorker();
  const env = makeEnv();
  const stub = stubFetch(async () => new Response('{}', { status: 200 }));
  try {
    const res = await worker.fetch(
      req('/index.html', { headers: { Cookie: sessionCookie(Date.now()) } }),
      env
    );
    assert.equal(res.status, 200, 'بجلسة صالحة لازم 200 — got ' + res.status);
    const body = await res.text();
    assert.ok(body.length > 100, 'الصفحة لازم تطلع');
  } finally { stub.restore(); }
});

test('/api/proxy محجوب بغير جلسة + مافيش طلب للباك قبل التحقق', async () => {
  const { worker } = await loadWorker();
  const env = makeEnv();
  const stub = stubFetch(async () => new Response('{"ok":true}', { status: 200 }));
  try {
    const res = await worker.fetch(req('/api/proxy?path=/api/admin/users'), env);
    assert.equal(res.status, 401, 'لازم 401 — got ' + res.status);
    assert.equal(stub.calls.length, 0, 'مافيش طلب للباك قبل التحقق من الجلسة');
  } finally { stub.restore(); }
});

test('/api/health ما بيكشفش عنوان الـbackend ولا أسماء متغيّرات', async () => {
  const { worker, src } = await loadWorker();
  const env = makeEnv();
  const stub = stubFetch(async () => new Response('{}', { status: 200 }));
  try {
    const res = await worker.fetch(req('/api/health'), env);
    assert.equal(res.status, 200);
    const body = await res.text();
    const origin = upstreamOrigin(src);
    assert.ok(!body.includes(origin), '/api/health فيه عنوان الـbackend');
    assert.ok(!body.includes('up.railway.app'), '/api/health فيه عنوان الـbackend');
    const j = JSON.parse(body);
    assert.equal(typeof j.has_admin, 'boolean', 'has_admin لازم boolean');
    assert.equal(typeof j.has_password, 'boolean', 'has_password لازم boolean');
    const forbidden = ['upstream', 'ORIGIN', 'origin', 'backend', 'api_base', 'token', 'session_secret'];
    forbidden.forEach((k) => {
      assert.ok(!(k in j), '/api/health فيه مفتاح ' + k);
    });
  } finally { stub.restore(); }
});

test('رسالة الخطأ ما بتسرّبش تفاصيل داخلية', async () => {
  const { worker, src } = await loadWorker();
  const env = makeEnv();
  const origin = upstreamOrigin(src);
  const stub = stubFetch(async () => { throw new Error('boom-secret-internal-detail'); });
  try {
    const res = await worker.fetch(
      req('/api/proxy?path=/api/admin/users', {
        headers: { Cookie: sessionCookie(Date.now()) },
      }),
      env
    );
    assert.ok(res.status >= 400, 'لازم خطأ — got ' + res.status);
    const body = await res.text();
    assert.ok(!body.includes('boom-secret-internal-detail'), 'التفاصيل الداخلية اتسرّبت');
    assert.ok(!body.includes(origin), 'عنوان الـbackend اتسرّب');
    assert.ok(!body.includes('up.railway.app'), 'عنوان الـbackend اتسرّب');
  } finally { stub.restore(); }
});

test('تسجيل الدخول: غلط ⇒ 401 · صح ⇒ كوكي جلسة', async () => {
  const { worker } = await loadWorker();
  const env = makeEnv();
  const stub = stubFetch(async () => new Response('{}', { status: 200 }));
  try {
    const bad = await worker.fetch(
      req('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-password' }),
      }),
      env
    );
    assert.equal(bad.status, 401);

    const good = await worker.fetch(
      req('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: PASSWORD }),
      }),
      env
    );
    assert.equal(good.status, 200);
    const setCookie = good.headers.get('Set-Cookie') || '';
    assert.ok(setCookie.includes('HttpOnly'), 'الكوكي لازم HttpOnly');
    assert.ok(setCookie.includes('SameSite=Strict'), 'الكوكي لازم SameSite=Strict');
  } finally { stub.restore(); }
});

test('الأفعال المسموحة: المسار الغريب ⇒ 400 (منع SSRF) والمسار المسموح يمرّ', async () => {
  const { worker } = await loadWorker();
  const env = makeEnv();
  const stub = stubFetch(async () => new Response('{"ok":true}', { status: 200 }));
  try {
    const cookie = sessionCookie(Date.now());
    const evil = await worker.fetch(
      req('/api/proxy?path=https://evil.example.com/steal', {
        headers: { Cookie: cookie },
      }),
      env
    );
    assert.ok(evil.status === 400 || evil.status === 404, 'لازم رفض — got ' + evil.status);
    assert.equal(stub.calls.length, 0, 'مافيش طلب خارجي for مسار غريب');

    const ok = await worker.fetch(
      req('/api/proxy?path=/api/admin/users', { headers: { Cookie: cookie } }),
      env
    );
    assert.equal(ok.status, 200, 'المسار المسموح لازم يعدّي — got ' + ok.status);
    assert.equal(stub.calls.length, 1, 'لازم طلب واحد للباك');
  } finally { stub.restore(); }
});
