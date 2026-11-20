/* ═══════════════════════════════════════════════════════════════════════
   🛡️🛡️🛡️ الجولة ٢٨ (R28) — ⭐ إغلاق ثغرة كلمة مرور الإدارة ⭐
   ───────────────────────────────────────────────────────────────────────
   📌 العيب (من المراجع المستقل ⭐):
   `verifyPassword` ⭐ كان بيقبل الـsecret (APP_PASSWORD ⭐) ⭐ حتى بعد تغيير
   ⭐ كلمة المرور من اللوحة ⭐ ⇒ ⭐ ⛔ كلمة المرور القديمة بتفضل صالحة ⭐ ⭐.
   ⭐ وكمان ⭐: ⛔ لو قراءة حالة الـDO فشلت ⭐ ⇒ ⭐ ⭐ الـsecret كان بيتقبل ⭐ ⭐.
   ⭐ وكمان ⭐: ⛔ بنسخة كلمة المرور غير معروفة ⭐ ⇒ ⭐ ⛔ جلسة قديمة بتعدّي ⭐ ⭐.

   📌 المطلوب من المالك (R28 · أولوية صفر ⭐):
   ① إلغاء قبول كلمة المرور القديمة بعد تغييرها.
   ② فصل آلية الاسترداد الطارئ عن تسجيل الدخول المعتاد.
   ③ ⛔ ممنوع ⭐: فشل قراءة panel_state ⭐ يكون سبب ⭐ لقبول كلمة المرور القديمة ⭐.
   ④ ⛔ منع قبول جلسة قديمة ⭐ عند تعذّر التحقق من إصدار كلمة المرور ⭐.
   ⑤ اختبار فشل التخزين ⭐ وتغيير كلمة المرور ⭐ عبر **نسخ Worker مستقلة** ⭐.

   📌 التشغيل: node --test assets/tests/r28-admin-password.test.js
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');
const SECRET = 'synthetic-secret';
const OLD_SECRET_PASSWORD = 'old-secret-password';
const NEW_PANEL_PASSWORD = 'new-panel-password-2026';

function loadWorker() {
  const src = fs.readFileSync(path.join(ROOT, 'mgmt/worker.js'), 'utf8')
    .replace(/^export\s*\{[^}]*\};?$/gm, '')
    .replace('export default', 'module.exports =');
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'Request', 'Response',
    'Headers', 'URL', 'crypto', src);
  fn(mod, mod.exports, Request, Response, Headers, URL, crypto);
  return mod.exports;
}

function sha256hex(text) {
  return nodeCrypto.createHash('sha256').update(String(text)).digest('hex');
}

function hmacHex(payload, secret) {
  return nodeCrypto.createHmac('sha256', secret).update(String(payload)).digest('hex');
}

/* ⭐⭐⭐ (R28) ⭐ نسخة الـDurable Object ⭐ (مشتركة بين نسخ الـWorker ⭐)
   📌 `panel_state` ⭐ = حالة كلمة المرور (salt/hash/ver ⭐).
   📌 `rev:<id>` ⭐ = إبطال الجلسات (نسخة لكل جلسة ⭐).
   📌 `att:<ip>` ⭐ = عدّاد المحاولات ⭐.
   📌 الفشل ⭐: `doReadFails` ⭐ (تعذّر القراءة ⭐) · `doWriteFails` ⭐ (فشل التخزين ⭐). */
function makeEnv(log, opts = {}) {
  const calls = log.calls;
  const pwdState = { salt: null, hash: null, ver: null };
  const revoked = new Set();
  const attempts = new Map();

  const doNs = {
    idFromName: (n) => ({ name: String(n) }),
    get: (id) => ({
      async fetch(url, fopts) {
        const method = (fopts && fopts.method) || 'GET';
        const name = String(id.name || '');
        calls.push({ kind: 'do-' + method.toLowerCase(), name: name });
        if (opts.doReadFails) {
          return new Response(JSON.stringify({ ok: false, error: 'storage-read-failed' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
        if (name === 'panel_state') {
          if (method === 'GET') {
            if (!pwdState.ver) {
              return new Response(JSON.stringify({ ok: true, pwd: null }),
                { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            return new Response(JSON.stringify({ ok: true, pwd: pwdState }),
              { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (method === 'POST') {
            if (opts.doWriteFails) {
              return new Response(JSON.stringify({ ok: false, error: 'storage-write-failed' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
            let body = {};
            try { body = JSON.parse((fopts && fopts.body) || '{}'); } catch (e) { body = {}; }
            pwdState.salt = String(body.salt || '');
            pwdState.hash = String(body.hash || '');
            pwdState.ver = String(body.ver || '');
            return new Response(JSON.stringify({ ok: true }),
              { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
        }
        if (name.indexOf('rev:') === 0) {
          if (method === 'POST') {
            revoked.add(name);
            return new Response(JSON.stringify({ ok: true, revoked: true }),
              { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify({ revoked: revoked.has(name) }),
            { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (name.indexOf('att:') === 0) {
          if (method === 'POST') {
            let body = {};
            try { body = JSON.parse((fopts && fopts.body) || '{}'); } catch (e) { body = {}; }
            const ip = String(body.ip || '');
            const action = String(body.action || 'fail');
            const rec = attempts.get(ip) || { n: 0, locked: false };
            if (action === 'ok') { rec.n = 0; rec.locked = false; }
            else {
              rec.n = (rec.n || 0) + 1;
              if (rec.n >= 8) { rec.n = 0; rec.locked = true; }
            }
            attempts.set(ip, rec);
            return new Response(JSON.stringify({ ok: true, n: rec.n, locked: rec.locked }),
              { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          const rec = attempts.get(String(id.name).slice(4)) || { n: 0, locked: false };
          return new Response(JSON.stringify({ n: rec.n, locked: rec.locked }),
            { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ ok: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    }),
  };

  const kv = {
    async get(k) { calls.push({ kind: 'kv-get', k: String(k) }); return null; },
    async put(k, v) { calls.push({ kind: 'kv-put', k: String(k) }); },
    async delete(k) { calls.push({ kind: 'kv-del', k: String(k) }); },
  };

  const env = {
    APP_PASSWORD: OLD_SECRET_PASSWORD,
    SESSION_SECRET: SECRET,
    OCTA_ADMIN_TOKEN: 'synthetic-token',
    APP_ENV: 'production',
    REVOKE_KV: kv,
    REVOKE_DO: doNs,
    ASSETS: {
      fetch: async () => new Response('<html><body>panel</body></html>',
        { status: 200, headers: { 'Content-Type': 'text/html' } }),
    },
  };
  Object.assign(env, opts.env || {});
  return { env, pwdState };
}

function req(p, opts = {}) {
  return new Request('https://mgmt.invalid' + p, opts);
}

async function postJson(worker, env, path, body, opts = {}) {
  return worker.fetch(req(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
  }), env);
}

async function getJson(worker, env, path, opts = {}) {
  return worker.fetch(req(path, { headers: opts.headers || {} }), env);
}

function sessionCookie(res) {
  const sc = res.headers.get('Set-Cookie') || '';
  const m = sc.match(/octa_mgmt_sess=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/* ⭐⭐⭐ (R28) ⭐ التوكن الجديد ⭐ `exp.tag.sig` ⭐
   📌 tag = sha256(secret + '|' + ver) مقصوص ١٦ hex ⭐ (نفس قاعدة الكود ⭐).
   📌 sig = HMAC(secret, exp + '.' + tag) ⭐. */
function mintCookie(expMs, secret, password, ver) {
  const exp = String(expMs);
  const v = (ver === undefined || ver === null) ? '0' : String(ver);
  const tag = sha256hex(String(password) + '|' + v).slice(0, 16);
  const sig = hmacHex(exp + '.' + tag, secret);
  return 'octa_mgmt_sess=' + encodeURIComponent(exp + '.' + tag + '.' + sig);
}

/* ⭐⭐⭐ (R28) ⭐ تغيير كلمة المرور ⭐ — المسار **يحتاج جلسة** ⭐ ⇒ ⭐ دخول أول ⭐ */
async function changePassword(worker, env, current, next) {
  const login = await postJson(worker, env, '/api/login', { password: current });
  if (login.status !== 200) return login;
  const cookie = sessionCookie(login);
  return worker.fetch(req('/api/password/change', {
    method: 'POST',
    body: JSON.stringify({ current: current, next: next }),
    headers: { 'Content-Type': 'application/json', Cookie: cookieValue(cookie) },
  }), env);
}

function cookieValue(raw) {
  return 'octa_mgmt_sess=' + encodeURIComponent(raw);
}

/* ═══════════════════════════════════════════════════════════════════════
   ① ⭐⭐⭐ ثغرة كلمة المرور القديمة ⭐⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R28-P-01: after a password change the OLD secret must NOT log in', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  /* ⭐ الحالة ⭐ = كلمة مرور لوحة اتغيّرت ⭐ (salt/hash/ver ⭐) */
  const salt = 'synthetic-salt-123456';
  const hash = sha256hex(salt + '|' + NEW_PANEL_PASSWORD);
  await changePassword(worker, env, OLD_SECRET_PASSWORD, NEW_PANEL_PASSWORD);
  log.calls.length = 0;
  const res = await postJson(worker, env, '/api/login', { password: OLD_SECRET_PASSWORD });
  assert.notEqual(res.status, 200,
    '⛔⛔⛔ الكلمة القديمة (الـsecret ⭐) دخلت بعد تغيير كلمة المرور ⭐ — ' + res.status);
  assert.equal(res.status, 401, '⛔ المتوقع 401 ⭐ — got ' + res.status);
  assert.ok(!sessionCookie(res), '⛔⛔⛔ اتصدر كوكي جلسة ⭐ رغم رفض الكلمة ⭐');
});

test('R28-P-02: after a password change the NEW panel password must log in', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  await changePassword(worker, env, OLD_SECRET_PASSWORD, NEW_PANEL_PASSWORD);
  const res = await postJson(worker, env, '/api/login', { password: NEW_PANEL_PASSWORD });
  assert.equal(res.status, 200, '⛔⛔⛔ كلمة المرور الجديدة مرفوضة ⭐ — ' + res.status);
  assert.ok(sessionCookie(res), '⛔⛔⛔ مافيش كوكي جلسة ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ② ⭐⭐⭐ تعذّر قراءة التخزين ⭐⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R28-P-03: a storage read failure must NOT accept the old secret', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log, { doReadFails: true });
  const res = await postJson(worker, env, '/api/login', { password: OLD_SECRET_PASSWORD });
  assert.notEqual(res.status, 200,
    '⛔⛔⛔ الكلمة القديمة اتقبلت مع تعذّر قراءة الحالة ⭐ — ' + res.status);
  assert.equal(res.status, 503, '⛔ المتوقع 503 (تعذّر التحقق ⭐) — got ' + res.status);
  assert.ok(!sessionCookie(res), '⛔⛔⛔ اتصدر كوكي جلسة ⭐');
});

test('R28-P-04: a storage read failure must NOT accept an old session', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  /* ⭐ جلسة صحيحة ⭐ بتونكن موقّع ⭐ (النسخة '0' ⭐ — مافيش تغيير بعد ⭐) */
  const cookie = mintCookie(Date.now() + 3600000, SECRET, OLD_SECRET_PASSWORD, '0');
  /* ⭐ بعدين ⭐ التخزين بيقع ⭐ */
  env.REVOKE_DO.get = (id) => ({
    async fetch() {
      log.calls.push({ kind: 'do-get', name: String(id.name || '') });
      return new Response(JSON.stringify({ ok: false, error: 'storage-read-failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } });
    },
  });
  const res = await getJson(worker, env, '/api/session', {
    headers: { Cookie: cookie },
  });
  assert.notEqual(res.status, 200,
    '⛔⛔⛔ جلسة قديمة اتقبلت مع تعذّر التحقق من النسخة ⭐ — ' + res.status);
});

test('R28-P-05: a storage read failure must NOT let the password change fall back to the secret', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env, pwdState } = makeEnv(log, { doReadFails: true });
  const res = await postJson(worker, env, '/api/password/change', {
    current: OLD_SECRET_PASSWORD, next: NEW_PANEL_PASSWORD,
  });
  assert.notEqual(res.status, 200,
    '\u26d4\u26d4\u26d4 \u0627\u0644\u062a\u063a\u064a\u0631 \u062a\u0645 \u0628\u0627\u0644\u0641\u0648\u0644-\u0628\u0627\u0643 \u0644\u0644\u0633\u0643\u0631\u062a \u2b50 \u2014 ' + res.status);
  assert.ok(!pwdState.ver, '\u26d4\u26d4\u26d4 \u0627\u0644\u062d\u0627\u0644\u0629 \u0627\u062a\u0643\u062a\u0628\u062a \u0648\u0644\u0627 \u064a\u0642\u0628\u0644 \u0627\u0644\u0633\u0643\u0631\u062a \u2b50');
});

test('R28-P-05b: with a valid session but a failing read the change must be refused', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  const cookie = mintCookie(Date.now() + 3600000, SECRET, OLD_SECRET_PASSWORD, '0');
  env.REVOKE_DO.get = (id) => ({
    async fetch(url, fopts) {
      const method = (fopts && fopts.method) || 'GET';
      if (method === 'POST') {
        return new Response(JSON.stringify({ ok: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ ok: false, error: 'storage-read-failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } });
    },
  });
  const res = await worker.fetch(req('/api/password/change', {
    method: 'POST',
    body: JSON.stringify({ current: OLD_SECRET_PASSWORD, next: NEW_PANEL_PASSWORD }),
    headers: { 'Content-Type': 'application/json', Cookie: cookieValue(cookie) },
  }), env);
  assert.notEqual(res.status, 200,
    '\u26d4\u26d4\u26d4 \u0627\u0644\u062a\u063a\u064a\u0631 \u062a\u0645 \u0648\u0641\u0642\u0647 \u0627\u0644\u0633\u0643\u0631\u062a \u2b50 \u2014 ' + res.status);
});

/* ═══════════════════════════════════════════════════════════════════════
   ③ ⭐⭐⭐ الاسترداد الطارئ (مسار منفصل ⭐ — مش دخول ⭐) ⭐⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R28-P-06: the recovery route resets the password and issues NO session', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env, pwdState } = makeEnv(log);
  const res = await postJson(worker, env, '/api/password/recover', {
    secret: OLD_SECRET_PASSWORD,
    new_password: NEW_PANEL_PASSWORD,
  });
  assert.equal(res.status, 200, '⛔⛔⛔ الاسترداد فشل ⭐ — ' + res.status);
  assert.ok(pwdState.ver, '⛔⛔⛔ الحالة ما اتكتبتش ⭐');
  assert.ok(!sessionCookie(res),
    '⛔⛔⛔ الاسترداد أصدر جلسة ⭐ ⇒ ⭐ لازم يكون إعادة تعيين بس ⭐');
});

test('R28-P-07: after recovery the old secret must NOT log in but the new password must', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  await postJson(worker, env, '/api/password/recover', {
    secret: OLD_SECRET_PASSWORD, new_password: NEW_PANEL_PASSWORD,
  });
  const oldRes = await postJson(worker, env, '/api/login', { password: OLD_SECRET_PASSWORD });
  assert.equal(oldRes.status, 401,
    '⛔⛔⛔ الـsecret لسه بيعمل دخول بعد الاسترداد ⭐ — ' + oldRes.status);
  const newRes = await postJson(worker, env, '/api/login', { password: NEW_PANEL_PASSWORD });
  assert.equal(newRes.status, 200, '⛔⛔⛔ الكلمة الجديدة مرفوضة ⭐ — ' + newRes.status);
});

test('R28-P-08: the recovery route with a wrong secret must fail and count the attempt', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  const res = await postJson(worker, env, '/api/password/recover', { secret: 'wrong-secret' });
  assert.equal(res.status, 401, '⛔⛔⛔ مفتاح غلط اتقبل ⭐ — ' + res.status);
  assert.ok(!sessionCookie(res), '⛔⛔⛔ اتصدر كوكي ⭐');
  const attCalls = log.calls.filter((c) => c.kind === 'do-post' && String(c.name).indexOf('att:') === 0);
  assert.ok(attCalls.length > 0, '⛔⛔⛔ المحاولة الغلط ما اتسجلتش ⭐');
});

test('R28-P-09: the recovery route must be refused from a cross-site origin', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  const res = await postJson(worker, env, '/api/password/recover',
    { secret: OLD_SECRET_PASSWORD, new_password: NEW_PANEL_PASSWORD },
    { headers: { Origin: 'https://evil.invalid' } });
  assert.equal(res.status, 403, '⛔⛔⛔ طلب من أصل خارجي اتقبل ⭐ — ' + res.status);
});

/* ═══════════════════════════════════════════════════════════════════════
   ④ ⭐⭐⭐ نسخ Worker مستقلة ⭐⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R28-P-10: a password change on copy A must kill the session and the old password on copy B', async () => {
  const workerA = loadWorker();
  const workerB = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  /* ⭐ دخول على النسخة A ⭐ */
  const loginA = await postJson(workerA, env, '/api/login', { password: OLD_SECRET_PASSWORD });
  assert.equal(loginA.status, 200, '⛔ الدخول على A فشل ⭐');
  const cookieA = sessionCookie(loginA);
  assert.ok(cookieA, '⛔ مافيش كوكي ⭐');
  /* ⭐ الجلسة شغالة على النسخة B ⭐ (قبل التغيير ⭐) */
  const before = await getJson(workerB, env, '/api/session', {
    headers: { Cookie: cookieValue(cookieA) },
  });
  assert.equal(before.status, 200, '⛔⛔⛔ الجلسة لازم تكون صالحة قبل التغيير ⭐ — ' + before.status);
  /* ⭐ تغيير كلمة المرور على النسخة A ⭐ */
  const chg = await changePassword(workerA, env, OLD_SECRET_PASSWORD, NEW_PANEL_PASSWORD);
  assert.equal(chg.status, 200, '⛔⛔⛔ تغيير كلمة المرور فشل ⭐ — ' + chg.status);
  /* ⭐ النسخة B ⭐: ⛔ الجلسة القديمة مرفوضة ⭐ */
  const after = await getJson(workerB, env, '/api/session', {
    headers: { Cookie: cookieValue(cookieA) },
  });
  assert.equal(after.status, 401,
    '⛔⛔⛔ الجلسة القديمة فضلت صالحة على نسخة تانية ⭐ — ' + after.status);
  /* ⭐ النسخة B ⭐: ⛔ الكلمة القديمة مرفوضة ⭐ */
  const oldLogin = await postJson(workerB, env, '/api/login', { password: OLD_SECRET_PASSWORD });
  assert.equal(oldLogin.status, 401, '⛔⛔⛔ الكلمة القديمة اتقبلت على B ⭐ — ' + oldLogin.status);
  /* ⭐ النسخة B ⭐: ⭐ الكلمة الجديدة مقبولة ⭐ */
  const newLogin = await postJson(workerB, env, '/api/login', { password: NEW_PANEL_PASSWORD });
  assert.equal(newLogin.status, 200, '⛔⛔⛔ الكلمة الجديدة مرفوضة على B ⭐ — ' + newLogin.status);
});

/* ═══════════════════════════════════════════════════════════════════════
   ⑤ ⭐⭐⭐ استنزاف panel_state بالكوكي المزوّر ⭐⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R28-P-11: a forged cookie must cause ZERO storage calls (no panel_state exhaustion)', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  const forged = cookieValue('9999999999999.00112233445566778899aabbccddeeff');
  const res = await getJson(worker, env, '/api/session', { headers: { Cookie: forged } });
  assert.notEqual(res.status, 200, '⛔⛔⛔ كوكي مزوّر اتقبل ⭐ — ' + res.status);
  assert.equal(log.calls.length, 0,
    '⛔⛔⛔ الكوكي المزوّر سبّب نداءات تخزين ⭐ ⇒ ⛔ استنزاف ⭐ — ' +
    JSON.stringify(log.calls));
});

test('R28-P-12: a forged cookie on a protected route must cause ZERO storage calls', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  const forged = cookieValue('9999999999999.00112233445566778899aabbccddeeff');
  const res = await worker.fetch(req('/api/proxy?path=/api/health', {
    headers: { Cookie: forged },
  }), env);
  assert.notEqual(res.status, 200, '⛔⛔⛔ كوكي مزوّر عدّى ⭐ — ' + res.status);
  assert.equal(log.calls.length, 0,
    '⛔⛔⛔ الكوكي المزوّر سبّب نداءات تخزين ⭐ — ' + JSON.stringify(log.calls));
});

test('R28-P-11b: a shape-valid forged cookie must also cause ZERO storage calls', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  /* \u2b50 \u0643\u0648\u0643\u064a \u0632\u0648\u0651\u0631 \u0628\u0627\u0644\u0634\u0643\u0644 \u0627\u0644\u0633\u0631\u064a\u062d \u2b50 (exp \u0631\u0642\u0645\u064a \u2b50 + tag \u2b50 + sig \u2b50) */
  const forged = cookieValue('9999999999999.abc123def456abc7.00112233445566778899aabbccddeeff');
  const res = await getJson(worker, env, '/api/session', { headers: { Cookie: forged } });
  assert.notEqual(res.status, 200, '\u26d4\u26d4\u26d4 \u0643\u0648\u0643\u064a \u0645\u0632\u0648\u0651\u0631 \u0627\u062a\u0642\u0628\u0644 \u2b50 \u2014 ' + res.status);
  assert.equal(log.calls.length, 0,
    '\u26d4\u26d4\u26d4 \u0627\u0644\u0643\u0648\u0643\u064a \u0627\u0644\u0645\u0632\u0648\u0651\u0631 \u0633\u0628\u0628 \u0646\u062f\u0627\u0621\u0627\u062a \u062a\u062e\u0632\u064a\u0646 \u2b50 \u2014 ' + JSON.stringify(log.calls));
});

test('R28-P-13: a legacy two-part session cookie must be refused', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  const exp = String(Date.now() + 3600000);
  const legacy = cookieValue(exp + '.' + hmacHex(exp, SECRET));
  const res = await getJson(worker, env, '/api/session', { headers: { Cookie: legacy } });
  assert.notEqual(res.status, 200, '⛔⛔⛔ كوكي بالشكل القديم اتقبل ⭐ — ' + res.status);
});

test('R28-P-14: logout with a forged cookie must cause ZERO storage calls', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  const forged = cookieValue('9999999999999.00112233445566778899aabbccddeeff');
  const res = await worker.fetch(req('/api/logout', {
    method: 'POST', headers: { Cookie: forged },
  }), env);
  assert.notEqual(res.status, 200, '⛔⛔⛔ كوكي مزوّر عدّى في الخروج ⭐ — ' + res.status);
  assert.equal(log.calls.length, 0,
    '⛔⛔⛔ الخروج بكوكي مزوّر سبّب نداءات تخزين ⭐ — ' + JSON.stringify(log.calls));
});

/* ═══════════════════════════════════════════════════════════════════════
   ⑥ ⭐⭐⭐ وصول المالك محفوظ ⭐⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R28-P-15: before any change the secret still logs in (bootstrap)', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  const res = await postJson(worker, env, '/api/login', { password: OLD_SECRET_PASSWORD });
  assert.equal(res.status, 200, '⛔⛔⛔ المالك اتقفل من أول تشغيل ⭐ — ' + res.status);
  assert.ok(sessionCookie(res), '⛔⛔⛔ مافيش كوكي ⭐');
});

test('R28-P-16: a real session must work on a normal protected route', async () => {
  const worker = loadWorker();
  const log = { calls: [] };
  const { env } = makeEnv(log);
  const res = await postJson(worker, env, '/api/login', { password: OLD_SECRET_PASSWORD });
  const cookie = sessionCookie(res);
  assert.ok(cookie, '⛔ مافيش كوكي ⭐');
  const sess = await getJson(worker, env, '/api/session', {
    headers: { Cookie: cookieValue(cookie) },
  });
  assert.equal(sess.status, 200, '⛔⛔⛔ الجلسة مش صالحة ⭐ — ' + sess.status);
});
