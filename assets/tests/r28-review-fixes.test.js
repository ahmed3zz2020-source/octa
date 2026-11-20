/* ══════════════════════════════════════════════════════════════════════
   🛡️ الجولة ٢٨ — ⭐ إغلاق ملاحظات المراجع المستقل (FINDING-01/02/03) ⭐
   ───────────────────────────────────────────────────────────────────────
   📌 FINDING-01 ⭐ مخزن المعاينة ⭐:
   `preview-store.js` ⭐ كان بيقرأ `storage.list()` ⭐ على إنه `{keys, cursor}` ⭐
   ⭐ ⇒ ⭐ لكن عقد Cloudflare Durable Objects الحقيقي ⭐ بيرجّع **Map** ⭐
   ⭐ ⇒ ⭐ كل استدعاء للعدّ كان بيفشل ⭐ ⇒ ⭐ المسارات المعتمدة عليه كانت ميتة ⭐.
   ✅ المعيار ⭐: `storage.list()` ⭐ ⇒ Map ⭐ (مفتاح ← قيمة) ⭐.

   📌 FINDING-02 ⭐ إبطال جلسات المعاينة ⭐:
   `preview-api.js` ⭐ كان بيرد `revoked:true` ⭐ **حتى لو** الإبطال فشل ⭐
   ⭐ ⇒ ⭐ ⛔ نجاح كاذب ⭐. والتجديد ⭐ كان بيلغي القديم ⭐ وبعدين يصدر الجديد ⭐
   ⭐ ⇒ ⭐ ⛔ لو الإصدار فشل ⭐ ⇒ ⭐ ⛔ جلسة بديلة بلا إبطال ⭐.

   📌 FINDING-03 ⭐ اعتماد جلسة الإدارة ⭐:
   `mgmt/worker.js` ⭐ ⛔ كان بيصدر جلسة بوسم "مستحيل" ⭐ (تعذّر قراءة الحالة ⭐)
   ⭐ ⇒ ⭐ المقارنة بين مستحيل ومستحيل ⭐ ⇒ ⭐ ⛔ الجلسة كانت مقبولة ⭐.
   ⭐ ⛔ وكمان ⭐: التحقق والوسم ⭐ قراءتين منفصلتين ⭐ ⇒ ⭐ نافذة سباق ⭐.

   📌 التشغيل ⭐: node --test assets/tests/r28-review-fixes.test.js
   📌 البرهان السالب ⭐:
      OCTA_FE_ROOT=<كود قبل الإصلاح> node --test assets/tests/r28-review-fixes.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');

const TARGET = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');

/* ══════════ تحميل المعاينة ══════════ */
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

/* ══════════ تحميل عامل الإدارة ══════════ */
function loadMgmtWorker() {
  const src = fs.readFileSync(path.join(TARGET, 'mgmt/worker.js'), 'utf8')
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

/* ══════════════════════════════════════════════════════════════════════
   ⭐ مخزن محلي **متوافق مع Cloudflare Durable Objects** ⭐
   📌 العقد الحقيقي ⭐:
      · `list({prefix})` ⭐ ⇒ **Map** ⭐ (مفتاح ← قيمة) ⭐ ⛔ مش {keys,cursor} ⭐
      · `put(key, value, {expirationTtl})` ⭐ ⇒ TTL بالثواني ⭐ (الحد الأدنى ٦٠ ⭐)
      · `delete(key)` ⭐ · `get(key)` ⭐ ⇒ undefined لو مش موجود ⭐
   📌 مهم ⭐: ⛔ شكل {keys:[{name}]} ⭐ (Workers KV ⭐) ⛔ **مش** عقد DO ⭐.
   ══════════════════════════════════════════════════════════════════════ */
function cloudflareStorage() {
  const map = new Map();
  const exps = new Map();
  const now = () => Date.now();
  function alive(k) {
    const e = exps.get(k);
    if (e === undefined) return true;
    if (e <= now()) { map.delete(k); exps.delete(k); return false; }
    return true;
  }
  return {
    map: map,
    async get(k) { return alive(k) ? map.get(k) : undefined; },
    async put(k, v, opts) {
      const ttl = opts && Number(opts.expirationTtl || 0);
      if (ttl > 0 && ttl < 60) throw new Error('expirationTtl must be at least 60 seconds');
      map.set(k, v);
      if (ttl > 0) exps.set(k, now() + ttl * 1000); else exps.delete(k);
    },
    async delete(k) { map.delete(k); exps.delete(k); },
    async list(opts) {
      const prefix = (opts && opts.prefix) || '';
      const out = new Map();
      for (const k of Array.from(map.keys())) {
        if (!alive(k)) continue;
        if (k.indexOf(prefix) === 0) out.set(k, map.get(k));
      }
      return out;                       /* ⭐ عقد DO الحقيقي ⭐ Map ⭐ */
    },
  };
}

/* ⭐ غلاف DO حقيقي (preview-store.js) فوق المخزن المتوافق ⭐ */
function makePreviewDO(opts = {}) {
  const storage = opts.storage || cloudflareStorage();
  let PreviewStore = null;
  try {
    PreviewStore = require(path.join(TARGET, 'preview-store.js')).PreviewStore;
  } catch (e) { PreviewStore = null; }
  assert.ok(PreviewStore, 'preview-store.js لازم يكون موجود وناقص ⭐');
  const instance = new PreviewStore({ storage: storage }, {});
  const calls = [];
  return {
    storage: storage,
    calls: calls,
    idFromName: (n) => ({ name: String(n) }),
    get: () => ({
      async fetch(url, fopts) {
        calls.push({ url: String(url), method: (fopts && fopts.method) || 'GET' });
        return instance.fetch(new Request(url, fopts));
      },
    }),
  };
}

function makePreviewEnv(extra) {
  const doNs = makePreviewDO();
  const env = Object.assign({
    OCTA_PREVIEW_SELF_API: 'on',
    PREVIEW_SESSION_SECRET: 'synthetic-preview-session-secret',
    PREVIEW_CONSOLE_KEY: 'synthetic-preview-console-key',
    PREVIEW_STORE: doNs,
    PREVIEW_KV: {
      async get() { return null; },
      async put() { },
    },
  }, extra || {});
  return { env: env, doNs: doNs };
}

async function callApi(env, path, method, body, headers) {
  const init = { method: method || 'GET', headers: Object.assign({}, headers || {}) };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  }
  const req = new Request('https://preview.invalid' + path, init);
  const res = await handlePreviewApi({
    request: req, env: env, url: new URL(req.url),
  });
  assert.ok(res, 'المعاينة لازم ترد على ' + path + ' ⭐');
  const txt = await res.text();
  let data = null;
  try { data = JSON.parse(txt); } catch (e) { data = null; }
  return { status: res.status, data: data, raw: txt, headers: res.headers };
}

function b64u(buf) {
  return Buffer.from(buf).toString('base64url');
}
/* ⭐ نفس دالة الباك ⭐: PBKDF2-SHA256 ⭐ ٦٠٠٠٠ جولة ⭐ + base64url ⭐ */
async function pinHashOf(pin, saltB64) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2', salt: Buffer.from(String(saltB64), 'base64url'),
    iterations: 60000, hash: 'SHA-256',
  }, key, 256);
  return b64u(new Uint8Array(bits));
}

/* ══════════════════════════════════════════════════════════════════════
   ⭐ FINDING-01 ⭐ — عقد Durable Objects الحقيقي ⭐
   ══════════════════════════════════════════════════════════════════════ */
test('FINDING-01 · list بترجّع Map (عقد DO الحقيقي) مش {keys,cursor}', async () => {
  const { doNs } = makePreviewEnv();
  const stub = doNs.get(doNs.idFromName('preview_state'));
  const res = await stub.fetch('https://store.internal/cmd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'put', key: 'acct:1', value: { uid: 'u1' } }),
  });
  assert.equal(res.status, 200);
  const res2 = await stub.fetch('https://store.internal/cmd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'list', prefix: 'acct:' }),
  });
  const body = await res2.json();
  assert.equal(body.ok, true, 'list لازم تنجح ⭐');
  assert.ok(Array.isArray(body.keys), 'المفاتيح لازم ترجع مصفوفة أسماء ⭐');
  assert.deepEqual(body.keys, ['acct:1'], 'المفتاح المتوقع ⭐');
  assert.equal(body.count, 1, 'العدّ ⭐');
});

test('FINDING-01 · العدّ بيرجّع المفاتيح المتوقعة على بيانات صناعية', async () => {
  const { doNs } = makePreviewEnv();
  const stub = doNs.get(doNs.idFromName('preview_state'));
  const wanted = ['acct:a', 'acct:b', 'acct:c'];
  for (const k of wanted) {
    await stub.fetch('https://store.internal/cmd', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'put', key: k, value: { k: k } }),
    });
  }
  await stub.fetch('https://store.internal/cmd', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'put', key: 'other:x', value: {} }),
  });
  const res = await stub.fetch('https://store.internal/cmd', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'list', prefix: 'acct:' }),
  });
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.keys.slice().sort(), wanted.slice().sort());
  assert.equal(body.count, 3);
  assert.equal(body.keys.indexOf('other:x'), -1, 'الفلتر بالـprefix ⭐');
});

test('FINDING-01 · المسار المعتمد على العدّ (الدخول بدون فهرس) بيشتغل', async () => {
  const { env, doNs } = makePreviewEnv();
  const stub = doNs.get(doNs.idFromName('preview_state'));
  /* ⭐ حساب صناعي ⭐ من غير فهرس PIN ⭐ ⇒ الدخول لازم يلقى الحساب بالعدّ ⭐ */
  const pin = '4829';
  const pinSalt = b64u(nodeCrypto.createHash('sha256').update('pin-salt').digest());
  const pinHash2 = await pinHashOf(pin, pinSalt);
  await stub.fetch('https://store.internal/cmd', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      op: 'put', key: 'acct:uid1',
      value: {
        uid: 'uid1', email: 'x@example.test', pin_salt: pinSalt,
        pin_hash: pinHash2, devices: ['device-0000000000000001'], epoch: 1,
      },
    }),
  });
  assert.ok(pinHash2 && pinSalt, 'محتوى صناعي ⭐');
  const res = await callApi(env, '/api/auth/pin/login', 'POST', {
    email: 'x@example.test', pin: pin, device: 'device-0000000000000001',
  });
  assert.equal(res.status, 200, 'الدخول بالعدّ لازم ينجح ⭐ — الرد: ' + res.raw.slice(0, 200));
  assert.ok(res.data && res.data.token, 'لازم يطلع توكن ⭐');
});

test('FINDING-01 · السجلات المنتهية بتتحذف عند القراءة', async () => {
  const { doNs } = makePreviewEnv();
  const stub = doNs.get(doNs.idFromName('preview_state'));
  await stub.fetch('https://store.internal/cmd', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      op: 'put', key: 'chal:old',
      value: { code: '111111', exp: Math.floor(Date.now() / 1000) - 10 },
    }),
  });
  assert.ok(doNs.storage.map.has('chal:old'), 'السجل اتكتب ⭐');
  const res = await stub.fetch('https://store.internal/cmd', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'get', key: 'chal:old' }),
  });
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.value, null, 'القيمة المنتهية لازم ترجع null ⭐');
  assert.equal(body.expired, true);
  assert.equal(doNs.storage.map.has('chal:old'), false, 'السجل لازم يتحذف ⭐');
});

test('FINDING-01 · TTL أقل من ٦٠ ثانية مرفوض بصيغة صريحة', async () => {
  const { doNs } = makePreviewEnv();
  const stub = doNs.get(doNs.idFromName('preview_state'));
  const res = await stub.fetch('https://store.internal/cmd', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'put', key: 'k', value: 1, ttl: 5 }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, 'ttl_too_short');
});

/* ⭐ حساب صناعي صالح ⭐ (باسورد ٤ أرقام ⭐ + بصمة جهاز ⭐) ⭐ */
async function putAccount(doNs, opts) {
  const o = opts || {};
  const pin = o.pin || '1111';
  const device = o.device || 'device-0000000000000001';
  const pinSalt = o.pinSalt || b64u(nodeCrypto.createHash('sha256').update('salt-' + pin).digest());
  const pinHash = await pinHashOf(pin, pinSalt);
  const stub = doNs.get(doNs.idFromName('preview_state'));
  await stub.fetch('https://store.internal/cmd', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      op: 'put', key: 'acct:' + (o.uid || 'uid1'),
      value: {
        uid: o.uid || 'uid1', email: o.email || 'x@example.test',
        pin_salt: pinSalt, pin_hash: pinHash, devices: [device], epoch: 1,
      },
    }),
  });
  return { pin: pin, device: device };
}

/* ══════════════════════════════════════════════════════════════════════
   ⭐ FINDING-02 ⭐ — إبطال جلسات المعاينة ⭐
   ══════════════════════════════════════════════════════════════════════ */
async function makeSessionInStore(env, doNs) {
  const stub = doNs.get(doNs.idFromName('preview_state'));
  await stub.fetch('https://store.internal/cmd', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      op: 'put', key: 'acct:uid1',
      value: { uid: 'uid1', email: 'x@example.test', devices: ['device-0000000000000001'], epoch: 1 },
    }),
  });
  const res = await callApi(env, '/api/auth/pin/login', 'POST', {
    email: 'x@example.test', pin: '000000', device: 'device-0000000000000001',
  });
  return res;
}

test('FINDING-02 · الخروج بدون جلسة ⇒ رفض (مش نجاح كاذب)', async () => {
  const { env } = makePreviewEnv();
  const res = await callApi(env, '/api/auth/logout', 'POST', {});
  assert.equal(res.status, 401);
  assert.equal(res.data.ok, false);
  assert.equal(res.data.revoked, undefined, 'مافيش ادعاء إبطال ⭐');
});

test('FINDING-02 · فشل الإبطال ⇒ 503 وما فيش revoked:true', async () => {
  const { env, doNs } = makePreviewEnv();
  const acc = await putAccount(doNs);
  /* ⭐ جلسة مشروعة ⭐ عبر الـAPI ⭐ */
  const login = await callApi(env, '/api/auth/pin/login', 'POST', {
    email: 'x@example.test', pin: acc.pin, device: acc.device,
  });
  assert.equal(login.status, 200, 'تحضير جلسة ⭐: ' + login.raw.slice(0, 160));
  const cookie = (login.headers.get('Set-Cookie') || '').split(';')[0];
  assert.ok(cookie, 'كوكي ⭐');
  /* ⭐ نكسر الحذف ⭐ */
  const origDelete = doNs.storage.delete.bind(doNs.storage);
  doNs.storage.delete = async () => { throw new Error('storage down ⭐'); };
  const out = await callApi(env, '/api/auth/logout', 'POST', {}, { Cookie: cookie });
  doNs.storage.delete = origDelete;
  assert.equal(out.status, 503, 'لازم 503 ⭐');
  assert.equal(out.data.ok, false);
  assert.equal(out.data.revoked, undefined, 'مافيش revoked:true ⭐');
});

test('FINDING-02 · التجديد: تعذّر الإبطال ⇒ مفيش جلسة بديلة', async () => {
  const { env, doNs } = makePreviewEnv();
  const acc = await putAccount(doNs);
  const login = await callApi(env, '/api/auth/pin/login', 'POST', {
    email: 'x@example.test', pin: acc.pin, device: acc.device,
  });
  assert.equal(login.status, 200, 'تحضير جلسة ⭐: ' + login.raw.slice(0, 160));
  const cookie = (login.headers.get('Set-Cookie') || '').split(';')[0];
  const origDelete = doNs.storage.delete.bind(doNs.storage);
  doNs.storage.delete = async () => { throw new Error('storage down ⭐'); };
  const out = await callApi(env, '/api/auth/refresh', 'POST', {}, { Cookie: cookie });
  doNs.storage.delete = origDelete;
  assert.equal(out.status, 503, 'لازم 503 ⭐');
  assert.equal(out.data.ok, false);
  assert.equal(out.data.token, undefined, 'مافيش توكن بديل ⭐');
});

test('FINDING-02 · التجديد الناجح: القديم يموت والجديد بيتصدر', async () => {
  const { env, doNs } = makePreviewEnv();
  const acc = await putAccount(doNs);
  const login = await callApi(env, '/api/auth/pin/login', 'POST', {
    email: 'x@example.test', pin: acc.pin, device: acc.device,
  });
  assert.equal(login.status, 200, 'تحضير جلسة ⭐: ' + login.raw.slice(0, 160));
  const cookie = (login.headers.get('Set-Cookie') || '').split(';')[0];
  const before = doNs.storage.map.size;
  const out = await callApi(env, '/api/auth/refresh', 'POST', {}, { Cookie: cookie });
  assert.equal(out.status, 200, 'التجديد لازم ينجح ⭐: ' + out.raw.slice(0, 160));
  assert.ok(out.data.token, 'توكن جديد ⭐');
  assert.ok(out.data.token !== login.data.token, 'توكن مختلف ⭐');
  assert.equal(doNs.storage.map.size, before, 'عدد السجلات ثابت ⭐ (قديم مات + جديد اتكتب) ⭐');
});

/* ══════════════════════════════════════════════════════════════════════
   ⭐ FINDING-03 ⭐ — اعتماد جلسة الإدارة ⭐
   ══════════════════════════════════════════════════════════════════════ */
function makeMgmtEnv(opts = {}) {
  const state = { salt: null, hash: null, ver: null, has: false };
  const revoked = new Set();
  const calls = [];
  const doNs = {
    idFromName: (n) => ({ name: String(n) }),
    get: (id) => ({
      async fetch(url, fopts) {
        const method = (fopts && fopts.method) || 'GET';
        const name = String(id.name || '');
        calls.push({ name: name, method: method });
        if (opts.readFails && name === 'panel_state') {
          /* ⭐ الفشل يقتصر على **قراءة حالة كلمة المرور** ⭐
             ⇒ ⭐ قراءة الإبطال سليمة ⭐ ⇒ ⭐ الاختبار يعزل عيب الوسم ⭐. */
          return new Response(JSON.stringify({ ok: false }), { status: 500 });
        }
        if (name === 'panel_state') {
          if (method === 'GET') {
            if (!state.has) {
              return new Response(JSON.stringify({ ok: true, pwd: null }), { status: 200 });
            }
            return new Response(JSON.stringify({
              ok: true, pwd: { salt: state.salt, hash: state.hash, ver: state.ver },
            }), { status: 200 });
          }
          if (method === 'POST') {
            let body = {};
            try { body = JSON.parse((fopts && fopts.body) || '{}'); } catch (e) { body = {}; }
            state.salt = String(body.salt || '');
            state.hash = String(body.hash || '');
            state.ver = String(body.ver || '');
            state.has = true;
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
          }
        }
        if (name.indexOf('rev:') === 0) {
          if (method === 'POST') {
            revoked.add(name);
            return new Response(JSON.stringify({ ok: true, revoked: true }), { status: 200 });
          }
          return new Response(JSON.stringify({ revoked: revoked.has(name) }), { status: 200 });
        }
        return new Response(JSON.stringify({ ok: true, n: 0, locked: false }), { status: 200 });
      },
    }),
  };
  const env = {
    APP_PASSWORD: 'synthetic-secret',
    SESSION_SECRET: 'synthetic-session-secret',
    OCTA_ADMIN_TOKEN: 'synthetic-admin-token',
    APP_ENV: 'production',
    REVOKE_DO: doNs,
    REVOKE_KV: {
      async get() { return null; },
      async put() { },
      async delete() { },
    },
    ASSETS: {
      fetch: async () => new Response('<html></html>', { status: 200 }),
    },
  };
  Object.assign(env, opts.env || {});
  return { env: env, state: state, calls: calls };
}

function mgmtReq(path, opts = {}) {
  return new Request('https://mgmt.invalid' + path, opts);
}
async function mgmtPost(worker, env, path, body, opts = {}) {
  return worker.fetch(mgmtReq(path, {
    method: 'POST',
    body: JSON.stringify(body || {}),
    headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
  }), env);
}
function cookieOf(res) {
  const m = (res.headers.get('Set-Cookie') || '').match(/octa_mgmt_sess=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

test('FINDING-03 · تعذّر قراءة الحالة ⇒ الدخول مرفوض وما فيش جلسة', async () => {
  const worker = loadMgmtWorker();
  const { env } = makeMgmtEnv({ readFails: true });
  const res = await mgmtPost(worker, env, '/api/login', { password: 'synthetic-secret' });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.why, 'state_unknown');
  assert.equal(cookieOf(res), '', 'مافيش كوكي ⭐');
});

test('FINDING-03 · جلسة بوسم مستحيل تُرفض (ما بتعدّاش بالمقارنة)', async () => {
  const worker = loadMgmtWorker();
  /* ⭐ القراءة فاشلة ⭐ ⇒ ⭐ النسخة الحالية = **مستحيل** ⭐
     ⇒ ⭐ في الكود القديم ⭐: المقارنة بين مستحيل ومستحيل ⭐ ⇒ ⭐ بتتساوى ⭐
        ⇒ ⭐ ⛔ الجلسة كانت مقبولة ⭐.
     ⇒ ⭐ في الكود الجديد ⭐: ⛔ الوسم المستحيل ⭐ ⇒ ⛔ رفض فوري ⭐. */
  const { env } = makeMgmtEnv({ readFails: true });
  const exp = String(Date.now() + 3600 * 1000);
  const tag = '__unverified__';
  const sig = hmacHex(exp + '.' + tag, 'synthetic-session-secret');
  const forged = 'octa_mgmt_sess=' + encodeURIComponent(exp + '.' + tag + '.' + sig);
  const res = await worker.fetch(mgmtReq('/api/session', { headers: { Cookie: forged } }), env);
  assert.notEqual(res.status, 200, 'الجلسة المستحيلة لازم تُرفض ⭐');
});

test('FINDING-03 · الجلسة مربوطة بنسخة الاعتماد اللي اتحقق منها', async () => {
  const worker = loadMgmtWorker();
  const { env, state } = makeMgmtEnv();
  /* ⭐ دخول ⭐ (الحالة لسه ما فيش ⇒ الـsecret هو كلمة المرور) ⭐ */
  const login = await mgmtPost(worker, env, '/api/login', { password: 'synthetic-secret' });
  assert.equal(login.status, 200, 'دخول ⭐: ' + (await login.clone().text()).slice(0, 160));
  const cookie = cookieOf(login);
  assert.ok(cookie, 'كوكي ⭐');
  const parts = cookie.split('.');
  assert.equal(parts.length, 3, 'الشكل exp.tag.sig ⭐');
  /* ⭐ ضابط ⭐: قبل أي تغيير ⭐ ⇒ ⭐ الجلسة لازم تكون **مقبولة** ⭐ */
  const ok0 = await worker.fetch(mgmtReq('/api/session',
    { headers: { Cookie: 'octa_mgmt_sess=' + encodeURIComponent(cookie) } }), env);
  assert.equal(ok0.status, 200, 'الجلسة السليمة لازم تُقبل ⭐');
  /* ⭐ بعد أول تغيير ⭐: النسخة اتغيّرت ⭐ ⇒ ⭐ الجلسة القديمة لازم تموت ⭐ */
  const salt = sha256hex('new-pass|1').slice(0, 24);
  const hash = sha256hex(salt + '|new-panel-password-2026');
  state.salt = salt; state.hash = hash; state.ver = 'v1'; state.has = true;
  const res = await worker.fetch(mgmtReq('/api/session',
    { headers: { Cookie: 'octa_mgmt_sess=' + encodeURIComponent(cookie) } }), env);
  assert.notEqual(res.status, 200, 'الجلسة القديمة لازم ترفض ⭐');
});

test('FINDING-03 · لا إحياء لجلسة قديمة بعد ضياع حالة كلمة المرور', async () => {
  const worker = loadMgmtWorker();
  const { env, state } = makeMgmtEnv();
  /* ⭐ الحالة موجودة ⭐ (كلمة مرور مضبوطة ⭐ والنسخة "0" ⭐) ⇒ ⭐ دخول ⭐ */
  const salt = sha256hex('panel-pass|0').slice(0, 24);
  state.salt = salt;
  state.hash = sha256hex(salt + '|panel-pass-2026');
  state.ver = '0';
  state.has = true;
  const login = await mgmtPost(worker, env, '/api/login', { password: 'panel-pass-2026' });
  assert.equal(login.status, 200, 'دخول ⭐: ' + (await login.clone().text()).slice(0, 160));
  const cookie = cookieOf(login);
  const parts = cookie.split('.');
  assert.equal(parts[1], sha256hex('synthetic-secret|0').slice(0, 16),
    'وسم النسخة "0" ⭐');
  /* ⭐ الآن الحالة تضيع ⭐ (الـDO رجع لحالة "ما فيش حالة" ⭐)
     ⇒ ⭐ في الكود القديم ⭐: الوسم بيرجع sha256(secret|"0") ⭐ ⇒ ⭐ نفس الوسم ⭐
        ⇒ ⭐ ⛔ الجلسة القديمة **بتعيش تاني** ⭐ (إحياء ⭐).
     ⇒ ⭐ في الكود الجديد ⭐: ⛔ وسم "ما فيش حالة" ⭐ مختلف ⭐ ⇒ ⛔ ترفض ⭐. */
  state.has = false;
  const res = await worker.fetch(mgmtReq('/api/session',
    { headers: { Cookie: 'octa_mgmt_sess=' + encodeURIComponent(cookie) } }), env);
  assert.notEqual(res.status, 200, 'الجلسة القديمة لازم ترفض بعد ضياع الحالة ⭐');
});

/* ══════════════════════════════════════════════════════════════════════
   ⭐ FINDING-07 ⭐ — مسارات القراءة تروح للـbackend ⭐ (والحالة معزولة ⭐)
   ══════════════════════════════════════════════════════════════════════ */
test('FINDING-07 · مسار قراءة ⇒ يستمر للـbackend (مش 501)', async () => {
  const { env } = makePreviewEnv();
  const res = await handlePreviewApi({
    request: new Request('https://preview.invalid/api/radar/universe'),
    env: env, url: new URL('https://preview.invalid/api/radar/universe'),
  });
  assert.equal(res, null, 'لازم يستمر للـworker (⇒ للـbackend) ⭐');
});

test('FINDING-07 · مسارات الحالة تبقى في المعاينة (مافيش مرور)', async () => {
  const { env } = makePreviewEnv();
  for (const p of ['/api/portfolio', '/api/alerts/state', '/api/auth/me']) {
    const res = await handlePreviewApi({
      request: new Request('https://preview.invalid' + p),
      env: env, url: new URL('https://preview.invalid' + p),
    });
    assert.ok(res !== null, 'المسار ' + p + ' لازم يبقى في المعاينة ⭐');
  }
});

test('FINDING-07 · مسار كتابة/إدارة غير مصرَّح ⇒ 501 (مافيش إنترنت)', async () => {
  const { env } = makePreviewEnv();
  for (const p of ['/api/admin/users', '/api/billing/subscribe', '/api/auth/delete']) {
    const res = await handlePreviewApi({
      request: new Request('https://preview.invalid' + p, { method: 'POST' }),
      env: env, url: new URL('https://preview.invalid' + p),
    });
    assert.ok(res, 'المسار ' + p + ' لازم يبقى مرفوض ⭐');
    assert.equal(res.status, 501, 'المسار ' + p + ' ⇒ 501 ⭐');
  }
});
