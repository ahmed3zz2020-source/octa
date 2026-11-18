/* ═══════════════════════════════════════════════════════════════════════
   🧪🛡️ الجولة ٢٤ (R24 · المرحلة ٢) — R22-I04: فشل كتابة الإبطال
   ───────────────────────────────────────────────────────────────────────
   📌 المتطلب (R22-I04 ⭐):
      «فشل كتابة الإبطال (الـKV أو الـDO) لا ينتج نجاحاً وهمياً» ⭐
      ⭐ لازم يبقى فيه **اختبار سالب** ⭐ يكسر الكتابة **فعلاً** ⭐
        (مزوّد وهمي معزول ⭐) ⭐ ويأكد:
        ① إن الرد **ليس نجاحاً** ⭐.
        ② وإن الجلسة **تُرفض** ⭐.

   📌 العيب المقاس في الجولة ٢٤ ⭐:
      في `POST /api/logout` ⭐ كانت نتيجتَي `doRevoke` و `kvRevoke`
      **مُهمَلتين** ⭐ ⇒ ⛔ الرد كان `{ok:true}` و ٢٠٠ **دايماً** ⭐
      ⇒ ⛔ فشل الكتابة = «إبطال مش مثبت» ⭐ بس العميل بيقول «تمام» ⭐ ⭐.

   📌 التشغيل:
      node --test assets/tests/r24-session-i04.test.js
      ⭐ ولتشغيله على الكود القديم ⭐:
      OCTA_FE_ROOT=<مجلد فيه mgmt/worker.js القديم> node --test ...
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');

function loadWorker() {
  const src = fs.readFileSync(path.join(ROOT, 'mgmt/worker.js'), 'utf8')
    .replace(/^export\s*\{[^}]*\};?$/gm, '')
    .replace('export default', 'module.exports =');
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'Request', 'Response',
    'Headers', 'URL', 'crypto',
    src + '\ntry { module.exports.RevokeDO = RevokeDO; } catch (e) { }\n');
  fn(mod, mod.exports, Request, Response, Headers, URL, crypto);
  return mod.exports;
}

/* ═══════════════════════════════════════════════════════════════════════
   ⭐⭐ المزوّد الوهمي **المعزول** ⭐⭐
   📌 مافيش شبكة ⭐ · مافيش حساب ⭐ · مافيش مورد ⭐.
   📌 كل حالة: كتابة مكسورة فعلياً ⭐ (مش مجرد «مافيش binding» ⭐).
   ═══════════════════════════════════════════════════════════════════════ */

/* ⭐ KV: كل عمليات الكتابة **ترمي** ⭐ (كتابة مكسورة فعلياً ⭐) */
function kvWriteBroken() {
  const state = { puts: 0, gets: 0 };
  return {
    state,
    async get() { state.gets++; throw new Error('KV write/read broken'); },
    async put() { state.puts++; throw new Error('KV write broken'); },
    async delete() { throw new Error('KV broken'); },
  };
}

/* ⭐ KV: كتابة بتنجح بس القراءة **بترجّع غلط** ⭐ (فشل صامت ⭐) */
function kvWriteSilent() {
  const store = new Map();
  const state = { puts: 0, gets: 0 };
  return {
    state, store,
    async get(k) { state.gets++; return store.has(k) ? store.get(k) : null; },
    async put(k, v) { state.puts++; /* ⛔ مافيش حفظ ⭐ ⇒ فشل صامت ⭐ */ },
    async delete(k) { store.delete(k); },
  };
}

/* ⭐ KV سليم ⭐ */
function kvOk() {
  const store = new Map();
  const state = { puts: 0 };
  return {
    state, store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { state.puts++; store.set(k, v); },
    async delete(k) { store.delete(k); },
  };
}

/* ⭐ DO: الرد على الكتابة **فشل** (٥٠٠) ⭐ */
function doWriteBroken() {
  const calls = [];
  return {
    calls,
    idFromName: (n) => ({ name: n }),
    get: () => ({
      async fetch(url, opts) {
        calls.push({ url: String(url), method: (opts && opts.method) || 'GET' });
        return new Response(JSON.stringify({ ok: false, error: 'storage-write-failed' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } });
      },
    }),
  };
}

/* ⭐ DO: الكتابة **بتتنادى** بس مش بتتخزّن ⭐ (فشل صامت ⭐)
   ⇒ ⛔ لازم يتكشف بالقراءة ⭐ (read-after-write ⭐) ⭐ */
function doWriteSilent() {
  const calls = [];
  const ns = {
    calls,
    idFromName: (n) => ({ name: n }),
    get: () => ({
      async fetch(url, opts) {
        calls.push({ url: String(url), method: (opts && opts.method) || 'GET' });
        if ((opts && opts.method) === 'POST') {
          return new Response(JSON.stringify({ ok: true, revoked: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        /* ⛔ القراءة بترجّع «مش متبطل» ⭐ ⇒ مافيش دليل ⭐ */
        return new Response(JSON.stringify({ revoked: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    }),
  };
  return ns;
}

function makeEnv(kv, doNs) {
  return {
    APP_PASSWORD: 'synthetic-password',
    SESSION_SECRET: 'synthetic-secret',
    OCTA_ADMIN_TOKEN: 'synthetic-token',
    REVOKE_KV: kv || null,
    REVOKE_DO: doNs || null,
    ASSETS: {
      fetch: async () => new Response('<html><body>panel</body></html>',
        { status: 200, headers: { 'Content-Type': 'text/html' } }),
    },
  };
}

function req(p, opts = {}) {
  return new Request('https://mgmt.invalid' + p, opts);
}

async function login(worker, env) {
  const res = await worker.fetch(req('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password: env.APP_PASSWORD }),
  }), env);
  assert.equal(res.status, 200, '⛔ لازم الدخول ينجح ⭐');
  return res.headers.get('Set-Cookie').split(';')[0];
}

async function logout(worker, env, cookie) {
  const res = await worker.fetch(req('/api/logout', {
    method: 'POST', headers: { Cookie: cookie },
  }), env);
  let body = null;
  try { body = await res.json(); } catch (e) { body = null; }
  return { res, body };
}

async function sessionStatus(worker, env, cookie) {
  const res = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env);
  return res.status;
}

/* ═══════════════════════════════════════════════════════════════════════
   ① ⭐⭐ الاختبار السالب الأساسي ⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I04-01: a broken revocation write must NOT produce a false success', async () => {
  const worker = loadWorker();
  /* ⭐ الكتابة مكسورة فعلياً في المصدرين ⭐ */
  const env = makeEnv(kvWriteBroken(), doWriteBroken());
  const cookie = await login(worker, env);

  const { res, body } = await logout(worker, env, cookie);

  /* ⛔ الرد **مش** نجاح ⭐ */
  assert.notEqual(res.status, 200,
    '⛔⛔ فشل كتابة الإبطال رجّع ٢٠٠ ⭐ — ده نجاح وهمي ⭐');
  assert.equal(res.status, 503,
    '⛔ لازم يبقى ٥٠٣ (تعذّر الإبطال على كل النسخ ⭐)');
  assert.ok(body && typeof body === 'object', '⛔ لازم يبقى فيه رد JSON ⭐');
  assert.equal(body.ok, false,
    '⛔⛔ الرد said «تم» ⭐ — ده نجاح وهمي ⭐ (لازم ok=false ⭐)');
  assert.equal(body.revoked_shared, false,
    '⛔ لازم يعلن إن الإبطال المشترك ما اتثبتش ⭐');
  /* ⛔ بس الكوكي لازم يتمسح برضو ⭐ (الجلسة محلية اتبطلت ⭐) */
  assert.ok(res.headers.get('Set-Cookie'),
    '⛔ الكوكي لازم يتمسح ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ② ⭐⭐ نفس الحالة ⭐⭐ ⇒ الجلسة تُرفض ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I04-02: after a failed revocation write the session is REFUSED anyway', async () => {
  const worker = loadWorker();
  const env = makeEnv(kvWriteBroken(), doWriteBroken());
  const cookie = await login(worker, env);
  await logout(worker, env, cookie);
  const st = await sessionStatus(worker, env, cookie);
  assert.equal(st, 401,
    '⛔⛔ الجلسة اتبطلت في الذاكرة ⇒ لازم ترفض ⭐ (مش 200 ⭐)');
});

/* ═══════════════════════════════════════════════════════════════════════
   ③ ⭐⭐ فشل **صامت** ⭐⭐ (الـDO بيقبل بس مش بيخزّن ⭐)
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I04-03: a SILENT revocation write failure is also not a success', async () => {
  const worker = loadWorker();
  /* ⭐ الـDO بيقول «تمام» ⭐ بس القراءة بعدها بتقول «مش متبطل» ⭐ */
  const env = makeEnv(kvWriteBroken(), doWriteSilent());
  const cookie = await login(worker, env);

  const { res, body } = await logout(worker, env, cookie);
  assert.notEqual(res.status, 200,
    '⛔⛔ فشل صامت في الإبطال رجّع ٢٠٠ ⭐ — نجاح وهمي ⭐');
  assert.equal(res.status, 503, '⛔ لازم ٥٠٣ ⭐');
  assert.equal(body.ok, false, '⛔ لازم ok=false ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ④ ⭐⭐ شاهد واحد كافي ⭐⭐ ⇒ يبقى نجاح ⭐ (مش فشل وهمي ⭐)
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I04-04: when the KV witness succeeds the logout is a real success', async () => {
  const worker = loadWorker();
  /* ⭐ الـDO واقف ⭐ بس الـKV اشتغل ⭐ ⇒ الإبطال **مثبت** ⭐ */
  const env = makeEnv(kvOk(), doWriteBroken());
  const cookie = await login(worker, env);
  const { res, body } = await logout(worker, env, cookie);
  assert.equal(res.status, 200, '⛔ الشاهد في الـKV كفى ⭐ ⇒ ٢٠٠ ⭐');
  assert.equal(body.ok, true, '⛔ لازم ok=true ⭐');
  assert.equal(env.REVOKE_KV.state.puts, 1,
    '⛔ لازم يكون فيه كتابة واحدة في الـKV ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ⑤ ⭐⭐ المسار القوي ⭐⭐ ⇒ نجاح ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I04-05: a successful DO revocation is a real success', async () => {
  const worker = loadWorker();
  const doNs = {
    calls: [],
    idFromName: (n) => ({ name: n }),
    get: () => ({
      async fetch(url, opts) {
        doNs.calls.push({ url: String(url), method: (opts && opts.method) || 'GET' });
        const isPost = (opts && opts.method) === 'POST';
        return new Response(JSON.stringify(isPost
          ? { ok: true, revoked: true } : { revoked: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    }),
  };
  const env = makeEnv(null, doNs);
  const cookie = await login(worker, env);
  const { res, body } = await logout(worker, env, cookie);
  assert.equal(res.status, 200, '⛔ لازم ٢٠٠ ⭐');
  assert.equal(body.ok, true, '⛔ لازم ok=true ⭐');
  assert.ok(doNs.calls.some(c => c.method === 'POST'),
    '⛔ لازم يكون فيه نداء كتابة للـDO ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ⑥ ⭐⭐ مافيش جلسة ⭐⭐ ⇒ مافيش فشل وهمي ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I04-06: a logout without a session is not a false failure', async () => {
  const worker = loadWorker();
  const env = makeEnv(kvWriteBroken(), doWriteBroken());
  const { res, body } = await logout(worker, env, null);
  assert.equal(res.status, 200,
    '⛔⛔ مافيش جلسة ⇒ مافيش إبطال يثبت ⭐ ⇒ ممنوع نرجع ٥٠٣ ⭐');
  assert.equal(body.ok, true, '⛔ لازم ok=true ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ⑦ ⭐⭐ وضع الذاكرة وحدها ⭐⭐ ⇒ سلوك قديم متحافظ ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I04-07: without a shared store the logout keeps working (memory mode)', async () => {
  const worker = loadWorker();
  const env = makeEnv(null, null);
  const cookie = await login(worker, env);
  const { res, body } = await logout(worker, env, cookie);
  assert.equal(res.status, 200, '⛔ وضع الذاكرة ⇒ ٢٠٠ ⭐');
  assert.equal(body.ok, true, '⛔ لازم ok=true ⭐');
  assert.equal(await sessionStatus(worker, env, cookie), 401,
    '⛔ الإبطال في الذاكرة لازم يشتغل ⭐');
});
