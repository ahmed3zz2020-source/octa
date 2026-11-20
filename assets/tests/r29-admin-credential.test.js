/* ═══════════════════════════════════════════════════════════════════════
   🛡️🛡️🛡️ الجولة ٢٩ (R29) — ⭐⭐⭐ فصل التهيئة الأولى عن الاعتماد الناقص ⭐
   ───────────────────────────────────────────────────────────────────────
   📌 الملاحظة (من المراجع المستقل ⭐):
   FINDING-13 ⭐ حالة اعتماد إدارة **موجودة وناقصة** ⭐ كانت بتتحسب
   «أول تشغيل» ⭐ ⇒ ⛔ الـsecret (APP_PASSWORD ⭐) كان بيتقبل ⭐
   ⇒ ⛔ ⭐ استحواذ على اللوحة ⭐ ⭐.

   📌 المطلوب ⭐:
   ① ⛔ فصل «التهيئة الأولى» (مافيش حالة ⭐) عن «حالة ناقصة» ⭐ ⇒ ⛔ رفض ⭐.
   ② ⭐ ربط الإصدار بنفس نسخة الاعتماد التي تحقق منها الدخول ⭐.
   ③ ⭐ حفظ وصول المالك ⭐ (السر ⭐) ⭐ ومسار الاسترداد المعتمد ⭐.

   📌 التشغيل: node --test assets/tests/r29-admin-credential.test.js
   📌 البرهان السالب ⭐:
      OCTA_FE_ROOT=<كود R28> node --test assets/tests/r29-admin-credential.test.js
      ⇒ ⭐ لازم يفشل ⭐.
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');
const SECRET = 'synthetic-secret';
const APP_SECRET = 'the-break-glass-secret';

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

/* ⭐ موك الـDO ⭐ — كلمة المرور (salt/hash/ver ⭐) + الإبطال + العدّاد ⭐ */
function makeEnv(opts) {
  const o = opts || {};
  const pwdState = o.incomplete
    ? { salt: 'salt-only', hash: '', ver: '' }     /* ⭐ حالة ناقصة ⭐ */
    : (o.hasState
      ? { salt: 'salt-1', hash: sha256hex('salt-1|panel-pass'), ver: 'v1' }
      : { salt: null, hash: null, ver: null });
  const revoked = new Set();
  const attempts = new Map();
  const doNs = {
    idFromName: (n) => ({ name: String(n) }),
    get: (id) => ({
      async fetch(url, fopts) {
        const method = (fopts && fopts.method) || 'GET';
        const name = String(id.name || '');
        if (name === 'panel_state') {
          if (method === 'GET') {
            const empty = !pwdState.salt && !pwdState.hash && !pwdState.ver;
            return new Response(JSON.stringify({ ok: true, pwd: empty ? null : pwdState }),
              { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (method === 'POST') {
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
    async get() { return null; },
    async put() { },
    async delete() { },
  };
  const env = {
    APP_PASSWORD: APP_SECRET,
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
  return { env: env, pwdState: pwdState };
}

function req(p, opts) {
  return new Request('https://mgmt.invalid' + p, opts || {});
}

async function postJson(worker, env, path, body) {
  return worker.fetch(req(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }), env);
}

async function getJson(worker, env, path) {
  return worker.fetch(req(path), env);
}

function sessionCookie(res) {
  const sc = res.headers.get('Set-Cookie') || '';
  const m = sc.match(/octa_mgmt_sess=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/* ═══════════════════════════════════════════════════════════════════════
   ① ⭐⭐⭐FINDING-13 ⭐⭐⭐ — الحالة الناقصة ⇒ ⛔ رفض ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R29-AC-01: an incomplete credential state must be refused (not treated as first run)', async () => {
  const worker = loadWorker();
  const { env } = makeEnv({ incomplete: true });
  /* ⛔⛔⛔ السر (break-glass ⭐) ما يتقبلش ⭐ في مسار الدخول ⭐ */
  const res = await postJson(worker, env, '/api/login', { password: APP_SECRET });
  assert.equal(res.status, 503,
    '⛔⛔⛔ الحالة الناقصة اتقبلت ⭐ ⇒ ⛔ التهيئة الأولى مش مفصولة ⭐');
  const body = await res.json();
  assert.equal(body.why, 'state_unknown');
  assert.ok(!sessionCookie(res), '⛔⛔⛔ صدرت جلسة رغم الرفض ⭐');
});

test('R29-AC-02: the first-run state must still accept the secret (owner access kept)', async () => {
  const worker = loadWorker();
  const { env } = makeEnv({});          /* ⭐ مافيش حالة ⭐ ⇒ تهيئة أولى ⭐ */
  const res = await postJson(worker, env, '/api/login', { password: APP_SECRET });
  assert.equal(res.status, 200,
    '⛔⛔⛔ التهيئة الأولى اتقفلت ⭐ ⇒ ⛔ المالك فقد الوصول ⭐');
  assert.ok(sessionCookie(res), '⛔⛔⛔ مفيش كوكي ⭐');
});

test('R29-AC-03: the complete state must accept the panel password and refuse the secret', async () => {
  const worker = loadWorker();
  const { env } = makeEnv({ hasState: true });
  const okRes = await postJson(worker, env, '/api/login', { password: 'panel-pass' });
  assert.equal(okRes.status, 200, '⛔ كلمة مرور اللوحة لازم تنجح ⭐');
  const token = sessionCookie(okRes);
  assert.ok(token, '⛔ مفيش جلسة ⭐');
  /* ⛔ السر لازم يبقى مرفوض ⭐ */
  const badRes = await postJson(worker, env, '/api/login', { password: APP_SECRET });
  assert.equal(badRes.status, 401,
    '⛔⛔⛔ السر اتقبل بعد تغيير كلمة المرور ⭐');
});

/* ⭐⭐⭐ (R29) ⭐ ربط الإصدار بنفس نسخة الاعتماد ⭐ */
test('R29-AC-04: the issued session must carry the credential version tag', async () => {
  const worker = loadWorker();
  const { env } = makeEnv({ hasState: true });
  const res = await postJson(worker, env, '/api/login', { password: 'panel-pass' });
  assert.equal(res.status, 200);
  const token = sessionCookie(res);
  const parts = token.split('.');
  assert.equal(parts.length, 3, '⛔ شكل التوكن ⭐');
  const wantTag = sha256hex(APP_SECRET + '|v1').slice(0, 16);
  assert.equal(parts[1], wantTag,
    '⛔⛔⛔ الجلسة مش مربوطة بنسخة الاعتماد المتحقَّقة ⭐');
});

/* ⭐⭐⭐ (R29) ⭐ مسار الاسترداد المعتمد ⭐ */
test('R29-AC-05: the break-glass recovery must still work on an incomplete state', async () => {
  const worker = loadWorker();
  const { env, pwdState } = makeEnv({ incomplete: true });
  const res = await postJson(worker, env, '/api/password/recover', {
    secret: APP_SECRET, new_password: 'recovered-panel-password-2026',
  });
  assert.equal(res.status, 200,
    '⛔⛔⛔ مسار الاسترداد اتقفل ⭐ ⇒ ⛔ المالك فقد الطريق المعتمد ⭐');
  assert.ok(pwdState.salt && pwdState.hash && pwdState.ver,
    '⛔⛔⛔ الحالة الجديدة ناقصة ⭐');
  assert.ok(!sessionCookie(res), '⛔⛔⛔ الاسترداد-issue جلسة ⭐');
  /* ⭐ بعد الاسترداد ⭐ ⇒ ⭐ الدخول بالكلمة الجديدة ⭐ */
  const login = await postJson(worker, env, '/api/login', { password: 'recovered-panel-password-2026' });
  assert.equal(login.status, 200, '⛔⛔⛔ الدخول بالكلمة الجديدة فشل ⭐');
});
