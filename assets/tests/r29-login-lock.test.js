/* ═══════════════════════════════════════════════════════════════════════
   🛡️🛡️🛡️ الجولة ٢٩ (R29) — ⭐ قفل الدخول ⭐
   ───────────────────────────────────────────────────────────────────────
   📌 الملاحظة الجديدة (اكتُشفت أثناء القياس ⭐):
   FINDING-20 ⭐ ⭐⭐ الدخول **الناجح** بيـ**يزوّد** عدّاد القفل ⭐⭐⭐
                بدل ما يصفّره ⭐ ⇒ ⭐ بعد ٥ محاولات ناجحة ⭐
                ⭐ القفل بيتفعّل ⭐ (١٥ دقيقة ⭐) ⭐
                ⇒ ⭐ ⭐ مستخدم شرعي ⭐ بيقفل نفسه ⭐ ⭐.
   📌 السبب ⭐: `preview-api.js` ⭐ ⭐ في سطر ~731 ⭐ ⭐:
        «كلمة المرور صح ⇒ ⭐ العدّاد يتصفّر ⭐»
        ⭐ بس الكود ⭐ ⭐ نداء ⭐ `bumpAttempts(...)` ⭐ ⭐ ⭐
        ⭐ ⇒ ⭐ ⭐ **يزوّد** ⭐ ⭐ (مش بيفسّر ⭐) ⭐ ⭐.
   📌 المطلوب ⭐:
      ① الدخول الناجح ⭐ ⭐ يصفّر ⭐ ⭐ عدّاد الباسورد ⭐ ⭐ (مش يزيد ⭐).
      ② ⭐ الفشل ⭐ ⭐ لسه ⭐ ⭐ يزيد ⭐ ⭐ العدّاد ⭐ ⭐ ويقفل ⭐ ⭐ (زي قبل ⭐).
      ③ ⭐ ٥ محاولات ناجحة ⭐ ⭐ متتالية ⭐ ⭐ ⇒ ⭐ ⭐ مافيش قفل ⭐ ⭐.

   📌 التشغيل ⭐: node --test assets/tests/r29-login-lock.test.js
   📌 البرهان السالب ⭐:
      OCTA_FE_ROOT=<كود R28> node --test assets/tests/r29-login-lock.test.js
      ⇒ ⭐ لازم يفشل ⭐ (النجاح بيزوّد العدّاد ⭐).
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const TARGET = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');

/* ⭐ تحميل المعاينة من الهدف ⭐ */
const previewSrc = fs.readFileSync(path.join(TARGET, 'preview-api.js'), 'utf8')
  .replace(/^export\s+(function|const|let|var)\s+/gm, '$1 ')
  .replace(/^export\s*\{[^}]*\}\s*;?$/gm, '')
  .replace(/^export\s+default\s+/gm, '');
const previewMod = { exports: {} };
{
  const fn = new Function('module', 'exports', 'Request', 'Response', 'Headers',
    'URL', 'crypto', 'atob', 'btoa',
    previewSrc + '\nmodule.exports = { handlePreviewApi: handlePreviewApi };');
  fn(previewMod, previewMod.exports, Request, Response, Headers, URL, crypto, atob, btoa);
}
const handlePreviewApi = previewMod.exports.handlePreviewApi;

const CONSOLE_KEY = 'synthetic-preview-console-key';

/* ⭐⭐⭐ موك المخزن القوي ⭐ (DO ⭐) ⭐
   📌 لازم يكون **صنف preview-store.js الحقيقي** ⭐
      ⇒ ⛔ الموك السسيط ⭐ ⭐ ما يعرفش ⭐ ⭐ `chal_make` ⭐ ⭐
      ⇒ ⛔ ولا `acct_set_pin` ⭐ ⭐ ⇒ ⛔ الكود مش بيتخزّن ⭐ ⭐
      ⇒ ⛔ والفحص بيقفل ⭐ ⭐ ⇒ ⭐ ⭐ نتيجة كاذبة ⭐ ⭐.
   ✅ دلوقتي ⭐: بنستخدم الصنف الحقيقي ⭐ (نفس طريقة اختبار الذرّية ⭐). */
let PreviewStore = null;
try {
  PreviewStore = require(path.join(TARGET, 'preview-store.js')).PreviewStore;
} catch (e) { PreviewStore = null; }

function fakeDO(opts) {
  const o = opts || {};
  const map = new Map();
  const alarms = { at: null };
  if (PreviewStore) {
    const storage = {
      async get(k) { return map.has(k) ? map.get(k) : undefined; },
      async put(k, v) { map.set(k, v); },
      async delete(k) { map.delete(k); },
      async list(ls) {
        const prefix = (ls && ls.prefix) || '';
        const out = new Map();
        for (const k of map.keys()) if (k.indexOf(prefix) === 0) out.set(k, map.get(k));
        return out;
      },
      async getAlarm() { return alarms.at; },
      async setAlarm(t) { alarms.at = t; },
    };
    const instance = new PreviewStore({ storage: storage }, {});
    return {
      map: map, alarms: alarms, instance: instance,
      idFromName: (n) => ({ name: String(n) }),
      get: (id) => ({
        async fetch(url, opt) {
          return instance.fetch(new Request(url, opt));
        },
      }),
    };
  }
  return {
    map: map, alarms: alarms,
    idFromName: (n) => ({ name: String(n) }),
    get: (id) => ({
      async fetch(url, opt) {
        const cmd = JSON.parse((opt && opt.body) || '{}');
        const op = String(cmd.op || '');
        if (op === 'get') {
          return new Response(JSON.stringify({ ok: true, value: map.has(cmd.key) ? map.get(cmd.key) : null }),
            { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (op === 'put') { map.set(cmd.key, cmd.value); return new Response(JSON.stringify({ ok: true }), { status: 200 }); }
        if (op === 'del') { map.delete(cmd.key); return new Response(JSON.stringify({ ok: true }), { status: 200 }); }
        if (op === 'list') {
          const keys = [];
          for (const k of map.keys()) if (k.indexOf(String(cmd.prefix || '')) === 0) keys.push(k);
          return new Response(JSON.stringify({ ok: true, keys: keys }), { status: 200 });
        }
        return new Response(JSON.stringify({ ok: false }), { status: 400 });
      },
    }),
  };
}

function fakeKV() {
  const store = new Map();
  return {
    store: store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    async list(opts) {
      const prefix = (opts && opts.prefix) || '';
      const keys = [];
      for (const k of store.keys()) if (k.indexOf(String(prefix || '')) === 0) keys.push({ name: k });
      return { keys: keys, list_complete: true };
    },
  };
}

function makeEnv() {
  return {
    OCTA_PREVIEW_SELF_API: 'on',
    PREVIEW_KV: fakeKV(),
    PREVIEW_STORE: fakeDO(),
    PREVIEW_SESSION_SECRET: 'synthetic-preview-secret',
    PREVIEW_CONSOLE_KEY: CONSOLE_KEY,
  };
}

function req(pathname, opts) {
  const o = opts || {};
  const headers = new Headers(o.headers || {});
  if (o.json !== undefined) headers.set('Content-Type', 'application/json');
  return new Request('https://octa-preview.example' + pathname, {
    method: o.method || 'GET',
    headers: headers,
    body: o.json !== undefined ? JSON.stringify(o.json) : undefined,
  });
}

async function call(env, pathname, opts) {
  const request = req(pathname, opts);
  const url = new URL(request.url);
  const res = await handlePreviewApi({ request: request, env: env, url: url });
  let body = null;
  try { body = await res.clone().json(); } catch (e) { body = null; }
  return { status: res.status, body: body };
}

async function mailboxCode(env, email) {
  const r = await call(env, '/api/preview/mailbox?email=' + encodeURIComponent(email), {
    headers: { 'X-Preview-Key': CONSOLE_KEY },
  });
  return (r.body && r.body.code) ? r.body.code : '';
}

/* ⭐ تسجيل كامل ⭐ ⇒ ⭐ الحساب جاهز ⭐ (+باسورد ⭐) */
async function register(env, email, pin, device) {
  await call(env, '/api/auth/signup/start', { method: 'POST', json: { name: 'x', email: email } });
  const code = await mailboxCode(env, email);
  const ver = await call(env, '/api/auth/signup/verify', { method: 'POST', json: { email: email, code: code } });
  const unlock = (ver.body && ver.body.unlock) ? ver.body.unlock : '';
  await call(env, '/api/auth/signup/newpin', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + unlock },
    json: { new_pin: pin, device: device },
  });
  return unlock;
}

const EMAIL = 'lock.test@example.test';
const PIN = '2468';
const DEVICE = 'a'.repeat(64);

test('FINDING-20 · ٦ محاولات دخول ناجحة ⭐ متتالية ⭐ ⇒ ⭐ مافيش قفل ⭐', async () => {
  const env = makeEnv();
  await register(env, EMAIL, PIN, DEVICE);
  const statuses = [];
  /* ⭐ ٦ محاولات ⭐ ⭐ ⇒ ⭐ القفل (لو شغال ⭐ ⭐) ⭐ ⭐ بيظهر في السادسة ⭐ ⭐ */
  for (let i = 0; i < 6; i++) {
    const r = await call(env, '/api/auth/pin/login', {
      method: 'POST', json: { email: EMAIL, pin: PIN, device: DEVICE },
    });
    statuses.push(r.status);
  }
  /* ⭐ لازم الستة كلهم 200 ⭐ — ⛔ قفل بعد محاولات **ناجحة** ⭐ ⭐ = عيب ⭐ */
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200],
    'دخول ناجح متكرر ⭐ ⇒ لازم كلهم 200 ⭐ (مافيش قفل ⭐ على مستخدم شرعي ⭐) ⭐ '
    + 'القيم: ' + JSON.stringify(statuses));
});

test('FINDING-20 · حسابان ⭐ بنفس الباسورد ⭐ ⇒ ⭐ مافيش قفل مشترك ⭐', async () => {
  const env = makeEnv();
  const EMAIL2 = 'lock.test2@example.test';
  const DEVICE2 = 'b'.repeat(64);
  await register(env, EMAIL, PIN, DEVICE);
  await register(env, EMAIL2, PIN, DEVICE2);
  const statuses = [];
  /* ⭐ ٤ لكل حساب ⭐ ⭐ ⇒ ⭐ المجموع ٨ ⭐ ⭐ ⇒ ⭐ لو العدّاد مشترك ⭐ ⭐
     ⭐ ⭐ بيقفل في المحاولة الخامسة ⭐ ⭐. ⭐ */
  for (let i = 0; i < 4; i++) {
    statuses.push((await call(env, '/api/auth/pin/login', {
      method: 'POST', json: { email: EMAIL, pin: PIN, device: DEVICE },
    })).status);
  }
  for (let i = 0; i < 4; i++) {
    statuses.push((await call(env, '/api/auth/pin/login', {
      method: 'POST', json: { email: EMAIL2, pin: PIN, device: DEVICE2 },
    })).status);
  }
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200, 200, 200],
    'حسابين بنفس الباسورد ⭐ ⇒ ⭐ مافيش قفل ⭐ (العدّاد لازم يكون للحساب ⭐ ⭐) ⭐ '
    + 'القيم: ' + JSON.stringify(statuses));
});

test('FINDING-20 · الدخول الفاشل ⭐ لسه ⭐ يزيد العدّاد ⭐ ويقفل ⭐', async () => {
  const env = makeEnv();
  await register(env, EMAIL, PIN, DEVICE);
  const wrong = [];
  /* ⭐ ٦ محاولات ⭐ ⭐ ⇒ ⭐ الخمسة الأولى 401 ⭐ ⭐ والسادسة 429 ⭐ ⭐
     📌 السبب ⭐: ⛔ القفل بيتفحص **قبل** المحاولة ⭐ ⭐ ⇒ ⭐ المحاولة
        ⭐ ⭐ رقم ٦ ⭐ ⭐ هي اللي **بتقفل** ⭐ ⭐ (بعد ٥ فشل ⭐ ⭐). ⭐ */
  for (let i = 0; i < 6; i++) {
    const r = await call(env, '/api/auth/pin/login', {
      method: 'POST', json: { email: EMAIL, pin: '9999', device: DEVICE },
    });
    wrong.push(r.status);
  }
  /* ⭐ المحاولات الفاشلة ⭐ لازم ترجع 401 ⭐ وبعدين ⭐ تقفل ⭐ (429 ⭐) ⭐ */
  assert.deepEqual(wrong.slice(0, 5), [401, 401, 401, 401, 401],
    '٥ محاولات فاشلة ⭐ ⇒ 401 ⭐ القيم: ' + JSON.stringify(wrong));
  assert.equal(wrong[5], 429,
    'بعد ٥ محاولات فاشلة ⭐ ⇒ المحاولة السادسة تقفل ⭐ (429 ⭐) ⭐ القيم: ' + JSON.stringify(wrong));
});

test('FINDING-20 · العدّاد بيزيد **فقط** مع الفشل ⭐ ⇒ ⭐ والتخمين محمي ⭐', async () => {
  const env = makeEnv();
  await register(env, EMAIL, PIN, DEVICE);
  /* ⭐ ٥ محاولات فاشلة ⭐ ⇒ ⭐ المحاولة السادسة تقفل ⭐ (429 ⭐) ⭐ */
  const wrong = [];
  for (let i = 0; i < 6; i++) {
    wrong.push((await call(env, '/api/auth/pin/login', {
      method: 'POST', json: { email: EMAIL, pin: '9999', device: DEVICE },
    })).status);
  }
  assert.deepEqual(wrong.slice(0, 5), [401, 401, 401, 401, 401],
    '٥ محاولات فاشلة ⭐ ⇒ 401 ⭐ القيم: ' + JSON.stringify(wrong));
  assert.equal(wrong[5], 429,
    'بعد ٥ محاولات فاشلة ⭐ ⇒ المحاولة السادسة تقفل ⭐ (429 ⭐) ⭐ القيم: ' + JSON.stringify(wrong));
});
