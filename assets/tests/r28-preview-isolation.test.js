/* ═══════════════════════════════════════════════════════════════════════
   🛡️🛡️🛡️ الجولة ٢٨ (R28) — ⭐ إغلاق ملاحظات الجولة ٢٦ على المعاينة ⭐
   ───────────────────────────────────────────────────────────────────────
   📌 العيوب المقاسة (من المراجع المستقل ⭐):
   R26-I01 ⭐ أكواد التأكيد **مكشوفة** ⭐ ⇒ ⭐ استحواذ على الحسابات ⭐.
   R26-I02 ⭐ إبطال الجلسات بالـKV **غير متسق فوراً** ⭐ (KV مؤجل ⭐).
   R26-I03 ⭐ تخمين PIN ⭐ ⇒ ⭐ القفل **مش بيتطبّق** ⭐.
   R26-I04 ⭐ الكتابات المتزامنة (المحفظة ⭐ / التنبيهات ⭐) **بتضيع** ⭐.
   R26-I05 ⭐ المعاينة والإنتاج **بيشاركوا** مساحة HALAN_KV ⭐.

   📌 المطلوب من المالك ⭐: إصلاحات **فعلية** ⭐ (مش تغيير اختبارات ⭐)
      + برهان قبل / بعد ⭐.

   📌 التشغيل: node --test assets/tests/r28-preview-isolation.test.js
   📌 البرهان السالب ⭐:
      OCTA_FE_ROOT=<كود R27> node --test assets/tests/r28-preview-isolation.test.js
      ⇒ ⭐ لازم تفشل ⭐ (العيوب موجودة ⭐).
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const TARGET = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');

/* ⭐ تحميل المعاينة من الهدف ⭐ (الافتراضي = الشجرة الحالية ⭐) */
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

/* ⭐ صنف الـDO الحقيقي ⭐ (لو موجود ⭐) — وإلا موك بسيط ⭐ (للبرهان السالب ⭐) */
let PreviewStore = null;
try {
  PreviewStore = require(path.join(TARGET, 'preview-store.js')).PreviewStore;
} catch (e) { PreviewStore = null; }

function fakeDO() {
  const map = new Map();
  if (PreviewStore) {
    const storage = {
      async get(k) { return map.has(k) ? map.get(k) : undefined; },
      async put(k, v) { map.set(k, v); },
      async delete(k) { map.delete(k); },
      async list(opts) {
        /* ⭐⭐⭐ (R28 · FINDING-01) ⭐⭐⭐ عقد Cloudflare Durable Objects ⭐⭐⭐
           ⑈ `list()` ⭐ بترجّع **Map** ⭐ (مفتاح ← قيمة) ⭐ مش {keys, cursor} ⭐ */
        const prefix = (opts && opts.prefix) || '';
        const out = new Map();
        for (const k of map.keys()) {
          if (k.indexOf(prefix) === 0) out.set(k, map.get(k));
        }
        return out;
      },
    };
    const instance = new PreviewStore({ storage: storage }, {});
    return {
      map: map,
      idFromName: (n) => ({ name: String(n) }),
      get: (id) => ({ async fetch(url, opts) { return instance.fetch(new Request(url, opts)); } }),
    };
  }
  /* ⭐ موك احتياطي ⭐ (للكود القديم ⭐ اللي بيستخدم الـKV ⭐) ⭐ */
  return {
    map: map,
    idFromName: (n) => ({ name: String(n) }),
    get: (id) => ({
      async fetch(url, opts) {
        const cmd = JSON.parse(opts.body || '{}');
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

function cookieOf(res) {
  const sc = res.headers.get('Set-Cookie') || '';
  return sc.split(';')[0];
}

async function mailboxCode(env, email, key) {
  const r = await call(env, '/api/preview/mailbox?email=' + encodeURIComponent(email), {
    headers: key ? { 'X-Preview-Key': key } : {},
  });
  return r;
}

async function signup(env, email, pin, device) {
  const start = await call(env, '/api/auth/signup/start', {
    method: 'POST', json: { name: 'اختبار', email: email },
  });
  const mb = await mailboxCode(env, email, CONSOLE_KEY);
  const code = (mb.body && mb.body.code) ? mb.body.code : '000000';
  const ver = await call(env, '/api/auth/signup/verify', {
    method: 'POST', json: { email: email, code: code },
  });
  const unlock = (ver.body && ver.body.unlock) ? ver.body.unlock : '';
  const mk = await call(env, '/api/auth/signup/newpin', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + unlock },
    json: { new_pin: pin, device: device },
  });
  return { start: start, mailbox: mb, verify: ver, mk: mk, code: code };
}

/* ═══════════════════════════════════════════════════════════════════════
   ① ⭐⭐⭐ R26-I01 ⭐⭐⭐ — الأكواد المكشوفة ⭐ ⇒ ⭐ استحواذ ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R28-PR-01: the signup response must NOT contain the confirmation code', async () => {
  const env = makeEnv();
  const start = await call(env, '/api/auth/signup/start', {
    method: 'POST', json: { name: 'x', email: 'i01@example.com' },
  });
  assert.equal(start.status, 200);
  assert.equal(start.body.preview_code, undefined,
    '⛔⛔⛔ الكود ظاهر في الرد ⭐ ⇒ ⛔ استحواذ ⭐');
  assert.ok(JSON.stringify(start.body).indexOf('preview_code') < 0,
    '⛔⛔⛔ أي ذكر للكود في الرد ⭐');
});

test('R28-PR-02: the PIN challenge response must NOT contain the code either', async () => {
  const env = makeEnv();
  const r = await call(env, '/api/auth/pin/challenge/send', {
    method: 'POST', json: { email: 'i01b@example.com' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.preview_code, undefined,
    '⛔⛔⛔ كود الاسترجاع ظاهر ⭐ ⇒ ⛔ استحواذ ⭐');
});

test('R28-PR-03: the mailbox must refuse to open without the console key', async () => {
  const env = makeEnv();
  await call(env, '/api/auth/signup/start', {
    method: 'POST', json: { name: 'x', email: 'i01c@example.com' },
  });
  const noKey = await mailboxCode(env, 'i01c@example.com', null);
  assert.equal(noKey.status, 401, '⛔⛔⛔ الصندوق فتح من غير المفتاح ⭐');
  const wrongKey = await mailboxCode(env, 'i01c@example.com', 'wrong-key');
  assert.equal(wrongKey.status, 401, '⛔⛔⛔ الصندوق فتح بمفتاح غلط ⭐');
  const good = await mailboxCode(env, 'i01c@example.com', CONSOLE_KEY);
  assert.equal(good.status, 200, '⛔ الصندوق ما فتحش بالمفتاح الصح ⭐');
  assert.ok(/^[0-9]{6}$/.test(String(good.body.code)), '⛔ كود مش صالح ⭐');
});

test('R28-PR-04: an attacker without the console key cannot take over an account', async () => {
  const env = makeEnv();
  const email = 'victim@example.com';
  const setup = await signup(env, email, '4321', 'device-victim-001');
  assert.equal(setup.mk.status, 200, '⛔ تجهيز الحساب فشل ⭐');
  /* ⛔ المهاجم ⭐: يبدأ استرجاع للإيميل ⭐ (من غير مفتاح ⭐) ⭐ */
  const atk = await call(env, '/api/auth/pin/challenge/send', {
    method: 'POST', json: { email: email },
  });
  assert.equal(atk.status, 200);
  assert.equal(atk.body.preview_code, undefined, '⛔ الكود مكشوف ⭐');
  const stolen = await mailboxCode(env, email, null);
  assert.equal(stolen.status, 401, '⛔⛔⛔Codes يمكن قراءتها ⭐');
  /* ⛔⇒ يقدر يطلب استرجاع ⭐ بس ⭐ مافيش كود ⭐ ⇒ ⛔ ما يقدرش ⭐ */
  const reset = await call(env, '/api/auth/pin/challenge/newpin', {
    method: 'POST', json: { new_pin: '9999' },
  });
  assert.notEqual(reset.status, 200, 'reset without unlock must fail');
  const reset2 = await call(env, '/api/auth/pin/challenge/newpin', {
    method: 'POST', json: { email: email, code: '123456', new_pin: '9999' },
  });
  assert.notEqual(reset2.status, 200,
    'reset with email+code but no unlock must fail');
});

test('R28-PR-05: the signup flow must NOT overwrite an existing account', async () => {
  const env = makeEnv();
  const email = 'exists@example.com';
  const first = await signup(env, email, '4321', 'device-first-001');
  assert.equal(first.mk.status, 200);
  /* ⛔ محاولة تانية ⭐ بنفس الإيميل ⭐ */
  const start2 = await call(env, '/api/auth/signup/start', {
    method: 'POST', json: { name: 'x', email: email },
  });
  const mb = await mailboxCode(env, email, CONSOLE_KEY);
  const ver2 = await call(env, '/api/auth/signup/verify', {
    method: 'POST', json: { email: email, code: mb.body.code },
  });
  const again = await call(env, '/api/auth/signup/newpin', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + ((ver2.body && ver2.body.unlock) || '') },
    json: { new_pin: '9999', device: 'device-second-002' },
  });
  assert.notEqual(again.status, 200,
    '⛔⛔⛔ الحساب اتكتب تاني ⭐ ⇒ ⛔ استحواذ ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ② ⭐⭐⭐ R26-I02 ⭐⭐⭐ — إبطال الجلسات غير متسق فوراً ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R28-PR-06: a logout on one copy must be visible on another copy immediately', async () => {
  /* ⭐ نسختان ⭐ = ذاكرتان مختلفان ⭐ + نفس المخزن القوي ⭐ */
  const shared = fakeDO();
  const envA = makeEnv({ PREVIEW_STORE: shared, PREVIEW_KV: fakeKV() });
  const envB = makeEnv({ PREVIEW_STORE: shared, PREVIEW_KV: fakeKV() });
  const setup = await signup(envA, 'i02@example.com', '4321', 'device-i02-00001');
  assert.equal(setup.mk.status, 200);
  const cookie = cookieOf(setup.mk.res);
  const before = await call(envB, '/api/auth/me', { headers: { Cookie: cookie } });
  assert.equal(before.status, 200, '⛔ الجلسة لازم تكون صالحة قبل الخروج ⭐');
  const out = await call(envA, '/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(out.status, 200, '⛔ الخروج فشل ⭐');
  const after = await call(envB, '/api/auth/me', { headers: { Cookie: cookie } });
  assert.equal(after.status, 401,
    '⛔⛔⛔ الجلسة فضلت صالحة على نسخة تانية ⭐ ⇒ ⛔ إبطال غير فوري ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ③ ⭐⭐⭐ R26-I03 ⭐⭐⭐ — تخمين PIN ⭐ ⇒ ⭐ القفل مش بيتطبّق ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R28-PR-07: after 5 wrong PINs the correct PIN must be locked out', async () => {
  const env = makeEnv();
  const email = 'i03@example.com';
  const device = 'device-i03-00001';
  const setup = await signup(env, email, '4321', device);
  assert.equal(setup.mk.status, 200);
  for (let i = 0; i < 5; i++) {
    const bad = await call(env, '/api/auth/pin/login', {
      method: 'POST', json: { pin: '0000', device: device },
    });
    assert.equal(bad.status, 401, '⛔ المحاولة الغلط لازم ترجع 401 ⭐');
  }
  const locked = await call(env, '/api/auth/pin/login', {
    method: 'POST', json: { pin: '4321', device: device },
  });
  assert.equal(locked.status, 429,
    '⛔⛔⛔ القفل مش متطبّق ⭐ ⇒ ⛔ تخمين مفتوح ⭐ — got ' + locked.status);
});

test('R28-PR-08: the lock must not be bypassed by changing the device', async () => {
  const env = makeEnv();
  const email = 'i03b@example.com';
  const device = 'device-i03-00002';
  const setup = await signup(env, email, '4321', device);
  assert.equal(setup.mk.status, 200);
  for (let i = 0; i < 5; i++) {
    await call(env, '/api/auth/pin/login', {
      method: 'POST', json: { pin: '0000', device: device },
    });
  }
  const other = await call(env, '/api/auth/pin/login', {
    method: 'POST', json: { pin: '4321', device: 'device-other-9999' },
  });
  assert.equal(other.status, 429,
    '⛔⛔⛔ تغيير الجهاز فتح القفل ⭐ ⇒ ⛔ تخمين مفتوح ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ④ ⭐⭐⭐ R26-I04 ⭐⭐⭐ — الكتابات المتزامنة بتضيع ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R28-PR-09: concurrent alert writes must not lose any alert', async () => {
  const env = makeEnv();
  const email = 'i04@example.com';
  const setup = await signup(env, email, '4321', 'device-i04-00001');
  assert.equal(setup.mk.status, 200);
  const cookie = cookieOf(setup.mk.res);
  const writes = [];
  for (let i = 0; i < 8; i++) {
    writes.push(call(env, '/api/alerts', {
      method: 'POST', headers: { Cookie: cookie },
      json: { alert: { id: 'al_' + i, symbol: 'COMI', kind: 'price' } },
    }));
  }
  await Promise.all(writes);
  const list = await call(env, '/api/alerts', { headers: { Cookie: cookie } });
  const ids = (list.body.alerts || []).map(a => a.id).sort();
  assert.equal(ids.length, 8,
    '⛔⛔⛔ الكتابات المتزامنة ضاعت ⭐ ⇒ ⛔ R26-I04 مفتوح ⭐ — ' + ids.length);
});

test('R28-PR-10: concurrent portfolio writes must not lose the last state', async () => {
  const env = makeEnv();
  const email = 'i04b@example.com';
  const setup = await signup(env, email, '4321', 'device-i04-00002');
  assert.equal(setup.mk.status, 200);
  const cookie = cookieOf(setup.mk.res);
  await Promise.all([
    call(env, '/api/portfolio', {
      method: 'POST', headers: { Cookie: cookie },
      json: { cash: 100, positions: { A: 1 } },
    }),
    call(env, '/api/portfolio', {
      method: 'POST', headers: { Cookie: cookie },
      json: { cash: 200, positions: { B: 2 } },
    }),
  ]);
  const pf = await call(env, '/api/portfolio', { headers: { Cookie: cookie } });
  assert.ok(pf.body.portfolio, '⛔ مافيش محفظة ⭐');
  assert.ok(pf.body.portfolio.cash === 100 || pf.body.portfolio.cash === 200,
    '⛔ قيمة المحفظة غلط ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ⑤ ⭐⭐⭐ R26-I05 ⭐⭐⭐ — المعاينة والإنتاج بيشاركوا HALAN_KV ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R28-PR-11: the preview must NOT bind the production HALAN_KV namespace', async () => {
  const read = (file) => {
    const raw = fs.readFileSync(path.join(TARGET, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    return JSON.parse(raw);
  };
  const preview = read('wrangler.jsonc');
  const prod = read('wrangler-prod.jsonc');
  const nsOf = (cfg) => {
    const list = cfg.kv_namespaces || [];
    const halan = list.find(x => x.binding === 'HALAN_KV');
    return halan ? halan.id : '';
  };
  assert.ok(nsOf(preview), '⛔ مافيش HALAN_KV في المعاينة ⭐');
  assert.notEqual(nsOf(preview), nsOf(prod),
    '⛔⛔⛔ المعاينة والإنتاج على نفس مساحة هالان ⭐ ⇒ ⛔ R26-I05 مفتوح ⭐');
});

test('R28-PR-12: the preview state must live in the strong store, not the KV', async () => {
  const env = makeEnv();
  const setup = await signup(env, 'i05@example.com', '4321', 'device-i05-00001');
  assert.equal(setup.mk.status, 200);
  const kvRaw = JSON.stringify([...env.PREVIEW_KV.store.entries()]);
  assert.ok(kvRaw.indexOf('pin_hash') < 0,
    '⛔⛔⛔ الحساب لسه في الـKV ⭐ ⇒ ⛔ الإبطال مش فوري ⭐');
  const doRaw = JSON.stringify([...env.PREVIEW_STORE.map.entries()]);
  assert.ok(doRaw.indexOf('pin_hash') >= 0,
    '⛔⛔⛔ الحساب مش في المخزن القوي ⭐');
});

test('R28-PR-13: the preview must fail closed without the strong store', async () => {
  const env = makeEnv({ PREVIEW_STORE: null });
  const r = await call(env, '/api/auth/me');
  assert.equal(r.status, 503, '⛔ لازم 503 صريح ⭐ — got ' + r.status);
  assert.equal(r.body.error, 'preview_backend_misconfigured');
});
