/* ═══════════════════════════════════════════════════════════════════════
   🛡️🛡️🛡️ الجولة ٢٩ (R29) — ⭐ العمليات الذرّية في مخزن المعاينة ⭐
   ───────────────────────────────────────────────────────────────────────
   📌 الملاحظات المقاسة (من المراجع المستقل ⭐):
   FINDING-11 ⭐ استهلاك توكن الفتح + تحديث الحساب **كعملية ذرّية** ⭐
                (التسجيل + الاسترداد ⭐).
   FINDING-12 ⭐ تجديد الجلسة = **تأكيد استهلاك القديمة + إصدار بديل واحد** ⭐
                ⇒ ⛔ عند تعذّر الإبطال ⭐ ⇒ ⛔ مافيش جلسة بديلة ⭐.
   FINDING-19 ⭐ انتهاء الصلاحية والتنظيف **بآلية مدعومة** في الـDO ⭐
                ⇒ ⭐ السجلات المنتهية بتتنضف **حتى لو ما اتقرتش** ⭐.

   📌 المطلوب ⭐: إصلاحات **فعلية** ⭐ (مش تغيير اختبارات ⭐) + برهان ⭐.
   📌 التشغيل: node --test assets/tests/r29-preview-atomic.test.js
   📌 البرهان السالب ⭐:
      OCTA_FE_ROOT=<كود R28> node --test assets/tests/r29-preview-atomic.test.js
      ⇒ ⭐ لازم يفشل ⭐ (العمليات الذرّية مفيش ⭐).
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

let PreviewStore = null;
try {
  PreviewStore = require(path.join(TARGET, 'preview-store.js')).PreviewStore;
} catch (e) { PreviewStore = null; }

/* ⭐ موك الـDO ⭐ — بينادي الصنف الحقيقي ⭐ لو موجود ⭐ */
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
        for (const k of map.keys()) {
          if (k.indexOf(prefix) === 0) out.set(k, map.get(k));
        }
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
          if (o.failOps && o.failOps.indexOf(String((opt && opt.body || ''))) >= 0) {
            return new Response(JSON.stringify({ ok: false, error: 'storage_failed' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
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
      for (const k of store.keys()) if (k.indexOf(prefix) === 0) keys.push({ name: k });
      return { keys: keys, list_complete: true };
    },
  };
}

const CONSOLE_KEY = 'synthetic-preview-console-key';

function makeEnv(extra) {
  return Object.assign({
    OCTA_PREVIEW_SELF_API: 'on',
    PREVIEW_KV: fakeKV(),
    PREVIEW_STORE: fakeDO(),
    PREVIEW_SESSION_SECRET: 'synthetic-preview-secret',
    PREVIEW_CONSOLE_KEY: CONSOLE_KEY,
  }, extra || {});
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
  return { status: res.status, body: body, res: res };
}

async function mailboxCode(env, email) {
  const r = await call(env, '/api/preview/mailbox?email=' + encodeURIComponent(email), {
    headers: { 'X-Preview-Key': CONSOLE_KEY },
  });
  return (r.body && r.body.code) ? r.body.code : '';
}

async function signup(env, email, pin, device) {
  await call(env, '/api/auth/signup/start', {
    method: 'POST', json: { name: 'x', email: email },
  });
  const code = await mailboxCode(env, email);
  const ver = await call(env, '/api/auth/signup/verify', {
    method: 'POST', json: { email: email, code: code },
  });
  const unlock = (ver.body && ver.body.unlock) ? ver.body.unlock : '';
  return { unlock: unlock, code: code };
}

/* ═══════════════════════════════════════════════════════════════════════
   ① ⭐⭐⭐ FINDING-11 ⭐⭐⭐ — استهلاك توكن الفتح ذرّي ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R29-PA-01: the unlock token must be consumable exactly once', async () => {
  const env = makeEnv();
  const s = await signup(env, 'f11@example.com', '1234', 'dev-f11-0123456789abcdef');
  assert.ok(s.unlock, '⛔ مفيش توكن فتح ⭐');
  const first = await call(env, '/api/auth/signup/newpin', {
    method: 'POST', headers: { Authorization: 'Bearer ' + s.unlock },
    json: { new_pin: '1234', device: 'dev-f11-0123456789abcdef' },
  });
  assert.equal(first.status, 200, '⛔ أول استهلاك لازم ينجح ⭐');
  assert.ok(first.body.token, '⛔ مفيش جلسة ⭐');
  /* ⛔ الاستهلاك التاني ⭐ ⇒ ⛔ لازم يفشل ⭐ (التوكن اتUsed ⭐) */
  const second = await call(env, '/api/auth/signup/newpin', {
    method: 'POST', headers: { Authorization: 'Bearer ' + s.unlock },
    json: { new_pin: '5678', device: 'dev-f11-0123456789abcdef' },
  });
  assert.equal(second.status, 401,
    '⛔⛔⛔ التوكن اتUsed مرتين ⭐ ⇒ ⛔ مفيش استهلاك ذرّي ⭐');
  assert.equal(second.body.why, 'unlock_expired');
});

test('R29-PA-02: the account must not be overwritten by a second signup', async () => {
  const env = makeEnv();
  const s1 = await signup(env, 'f11b@example.com', '1234', 'dev-f11b-0123456789abcdef');
  const first = await call(env, '/api/auth/signup/newpin', {
    method: 'POST', headers: { Authorization: 'Bearer ' + s1.unlock },
    json: { new_pin: '1234', device: 'dev-f11b-0123456789abcdef' },
  });
  assert.equal(first.status, 200);
  /* ⭐ توكن فتح تاني ⭐ لنفس الإيميل ⭐ (كود تأكيد جديد ⭐) */
  const s2 = await signup(env, 'f11b@example.com', '4321', 'dev-f11b-0123456789abcdef');
  const second = await call(env, '/api/auth/signup/newpin', {
    method: 'POST', headers: { Authorization: 'Bearer ' + s2.unlock },
    json: { new_pin: '4321', device: 'dev-f11b-0123456789abcdef' },
  });
  assert.equal(second.status, 409,
    '⛔⛔⛔ الحساب اتكتب فوق حساب موجود ⭐ ⇒ ⛔ مفيش إنشاء ذرّي ⭐');
  assert.equal(second.body.why, 'account_exists');
});

test('R29-PA-03: the recovery pin update must raise the epoch (kill all sessions)', async () => {
  const env = makeEnv();
  const s = await signup(env, 'f11c@example.com', '1234', 'dev-f11c-0123456789abcdef');
  const mk = await call(env, '/api/auth/signup/newpin', {
    method: 'POST', headers: { Authorization: 'Bearer ' + s.unlock },
    json: { new_pin: '1234', device: 'dev-f11c-0123456789abcdef' },
  });
  assert.equal(mk.status, 200);
  /* ⭐ استرداع ⭐ */
  await call(env, '/api/auth/pin/challenge/send', {
    method: 'POST', json: { email: 'f11c@example.com' },
  });
  const code = await mailboxCode(env, 'f11c@example.com');
  const ver = await call(env, '/api/auth/pin/challenge/verify', {
    method: 'POST', json: { email: 'f11c@example.com', code: code },
  });
  const unlock = (ver.body && ver.body.unlock) ? ver.body.unlock : '';
  assert.ok(unlock, '⛔ مفيش توكن فتح ⭐');
  const ch = await call(env, '/api/auth/pin/challenge/newpin', {
    method: 'POST', headers: { Authorization: 'Bearer ' + unlock },
    json: { new_pin: '4321' },
  });
  assert.equal(ch.status, 200);
  /* ⛔ الجلسة القديمة لازم تموت ⭐ (النسخة اتغيرت ⭐) */
  const me = await call(env, '/api/auth/me', {
    headers: { Authorization: 'Bearer ' + mk.body.token },
  });
  assert.equal(me.status, 401,
    '⛔⛔⛔ الجلسة القديمة لسه شغالة ⭐ ⇒ ⛔ التحديث مش ذرّي ⭐');
  /* ⛔ توكن الفتح ما يتUsedش مرتين ⭐ */
  const again = await call(env, '/api/auth/pin/challenge/newpin', {
    method: 'POST', headers: { Authorization: 'Bearer ' + unlock },
    json: { new_pin: '1111' },
  });
  assert.equal(again.status, 401, '⛔⛔⛔ توكن الفتح اتUsed مرتين ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ② ⭐⭐⭐ FINDING-12 ⭐⭐⭐ — التجديد ذرّي ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R29-PA-04: the refresh must replace the session with exactly one new one', async () => {
  const env = makeEnv();
  const s = await signup(env, 'f12@example.com', '1234', 'dev-f12-0123456789abcdef');
  const mk = await call(env, '/api/auth/signup/newpin', {
    method: 'POST', headers: { Authorization: 'Bearer ' + s.unlock },
    json: { new_pin: '1234', device: 'dev-f12-0123456789abcdef' },
  });
  assert.equal(mk.status, 200);
  const old = mk.body.token;
  const ref = await call(env, '/api/auth/refresh', {
    method: 'POST', headers: { Authorization: 'Bearer ' + old },
  });
  assert.equal(ref.status, 200, '⛔ التجديد لازم ينجح ⭐');
  assert.ok(ref.body.token, '⛔ مفيش جلسة جديدة ⭐');
  assert.notEqual(ref.body.token, old, '⛔⛔⛔ التوكن الجديد هو القديم ⭐');
  /* ⛔ القديم مات ⭐ */
  const meOld = await call(env, '/api/auth/me', {
    headers: { Authorization: 'Bearer ' + old },
  });
  assert.equal(meOld.status, 401, '⛔⛔⛔ الجلسة القديمة لسه شغالة ⭐');
  /* ⭐ الجديد شغّال ⭐ */
  const meNew = await call(env, '/api/auth/me', {
    headers: { Authorization: 'Bearer ' + ref.body.token },
  });
  assert.equal(meNew.status, 200, '⛔⛔⛔ الجلسة الجديدة مش شغالة ⭐');
});

test('R29-PA-05: when the storage fails there must be NO replacement session', async () => {
  /* ⭐ نكسر المخزن ⭐ ⇒ ⛔ لازم 503 ⭐ ⭐ ومافيش توكن ⭐ */
  const env = makeEnv();
  const s = await signup(env, 'f12b@example.com', '1234', 'dev-f12b-0123456789abcdef');
  const mk = await call(env, '/api/auth/signup/newpin', {
    method: 'POST', headers: { Authorization: 'Bearer ' + s.unlock },
    json: { new_pin: '1234', device: 'dev-f12b-0123456789abcdef' },
  });
  assert.equal(mk.status, 200);
  const old = mk.body.token;
  /* ⭐ نخلي عملية التدوير **هي بس** تفشل ⭐ (القراءة لازم تفضل شغالة ⭐
     ⇒ ⛔ من غيرها ⭐ الاختبار هيفشل بسبب 401 ⭐ مش بسبب الفشل ⭐) ⭐ */
  const realStore = env.PREVIEW_STORE;
  const broken = {
    OCTA_PREVIEW_SELF_API: 'on',
    PREVIEW_KV: fakeKV(),
    PREVIEW_STORE: {
      idFromName: (n) => realStore.idFromName(n),
      get: (id) => ({
        async fetch(url, opt) {
          let cmd = {};
          try { cmd = JSON.parse((opt && opt.body) || '{}'); } catch (e) { cmd = {}; }
          if (cmd.op === 'session_rotate') {
            return new Response(JSON.stringify({ ok: false, error: 'storage_failed' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
          return realStore.get(id).fetch(url, opt);
        },
      }),
    },
    PREVIEW_SESSION_SECRET: 'synthetic-preview-secret',
    PREVIEW_CONSOLE_KEY: CONSOLE_KEY,
  };
  const ref = await call(broken, '/api/auth/refresh', {
    method: 'POST', headers: { Authorization: 'Bearer ' + old },
  });
  assert.equal(ref.status, 503, '⛔⛔⛔ لازم 503 ⭐ (مافيش نجاح وهمي ⭐)');
  assert.equal(ref.body.why, 'revoke_failed');
  assert.ok(!ref.body.token, '⛔⛔⛔ صدر توكن بديل رغم الفشل ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ③ ⭐⭐⭐ FINDING-19 ⭐⭐⭐ — التنظيف والانتهاء ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R29-PA-06: the store must expose a cleanup that removes expired records', async () => {
  const env = makeEnv();
  const doStub = env.PREVIEW_STORE;
  /* ⭐ سجل منتهي ⭐ (exp في الماضي ⭐ + ttl=0 ⭐ ⇒ مافيش reliance على TTL ⭐) */
  const cmd = {
    op: 'put', key: 'sess:expired', value: { uid: 'u', sid: 's', exp: Math.floor(Date.now() / 1000) - 10 },
  };
  const res = await doStub.get(doStub.idFromName('preview_state'))
    .fetch('https://store.internal/cmd', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
  assert.ok(res.ok, '⛔ الكتابة لازم تنجح ⭐');
  /* ⭐ مافيش قراءة ⭐ ⇒ ⭐ التنظيف لازم يشيله ⭐ */
  const clean = await doStub.get(doStub.idFromName('preview_state'))
    .fetch('https://store.internal/cmd', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'cleanup' }),
    });
  const body = await clean.json();
  assert.equal(body.ok, true, '⛔⛔⛔ عملية التنظيف لازم تنجح ⭐');
  assert.ok(body.removed >= 1, '⛔⛔⛔ السجل المنتهي ما اتنضفش ⭐');
  assert.equal(doStub.map.has('sess:expired'), false,
    '⛔⛔⛔ السجل المنتهي لسه في المخزن ⭐');
});

test('R29-PA-07: the store must schedule the cleanup alarm (supported mechanism)', async () => {
  const env = makeEnv();
  const doStub = env.PREVIEW_STORE;
  await doStub.get(doStub.idFromName('preview_state'))
    .fetch('https://store.internal/cmd', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'put', key: 'k1', value: { v: 1 }, ttl: 120 }),
    });
  assert.ok(doStub.alarms.at, '⛔⛔⛔ مفيش جدولة للتنظيف ⭐');
  assert.ok(doStub.alarms.at > Date.now(), '⛔⛔⛔ وقت التنظيف في الماضي ⭐');
});

test('R29-PA-08: the list count must stay correct after the cleanup (Map contract)', async () => {
  const env = makeEnv();
  const doStub = env.PREVIEW_STORE;
  const now = Math.floor(Date.now() / 1000);
  await doStub.get(doStub.idFromName('preview_state'))
    .fetch('https://store.internal/cmd', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'put', key: 'acct:a', value: { uid: 'a', exp: 0 } }),
    });
  await doStub.get(doStub.idFromName('preview_state'))
    .fetch('https://store.internal/cmd', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'put', key: 'acct:b', value: { uid: 'b', exp: now - 5 } }),
    });
  const res = await doStub.get(doStub.idFromName('preview_state'))
    .fetch('https://store.internal/cmd', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'list', prefix: 'acct:' }),
    });
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.count, 1, '⛔⛔⛔ العدّ غلط ⭐ (السجل المنتهي اتحسب ⭐)');
  assert.deepEqual(body.keys, ['acct:a']);
});
