/* ═══════════════════════════════════════════════════════════════════════
   🧪🛡️ الجولة ٢٤ (R24 · المرحلة ٢) — R22-I06: ترتيب التحقق قبل التخزين
   ───────────────────────────────────────────────────────────────────────
   📌 المتطلب (R22-I06 ⭐):
      «التحقق من التوقيع وانتهاء الصلاحية يسبق أي نداء إلى DO/KV» ⭐
      ⭐ «وأن نداءاً غير مصرّح به لا يذهب للتخزين أصلاً» ⭐.

   📌 العيب المقاس في الجولة ٢٤ ⭐:
      في `validSession` ⭐ كان ترتيب الخطوات **معكوس** ⭐:
      ① نداء الـDO/الـKV ⭐ ⇐ ② التحقق من التوقيع ⭐ ⇐ ③ تاريخ الانتهاء ⭐
      ⇒ ⛔ أي كوكي **مزوّر** أو **منتهٍ** كان بيوصل للمخزن ⭐
        (استنزاف ⭐ + تسريب ⭐ + نافذة ⭐).
      ⛔ بل Kod نفسه كان فيه تعليق بيقول إن التحقق بيحصل **بعده** ⭐.

   📌 طريقة الإثبات ⭐: **سجل نداءات** ⭐ (call log ⭐)
      ⭐ نداء غير مصرّح به ⇒ السجل يبقى **فاضي** ⭐.

   📌 التشغيل:
      node --test assets/tests/r24-session-i06.test.js
      ⭐ ولتشغيله على الكود القديم ⭐:
      OCTA_FE_ROOT=<مجلد فيه mgmt/worker.js القديم> node --test ...
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');
const SECRET = 'synthetic-secret';

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

/* ⭐⭐ سجل النداءات المشترك ⭐⭐ (DO ⭐ + KV ⭐ في نفس السجل ⭐) */
function makeCallLog() {
  const calls = [];
  const kv = {
    calls,
    store: new Map(),
    async get(k) { calls.push({ kind: 'kv-get', k }); return this.store.has(k) ? this.store.get(k) : null; },
    async put(k, v) { calls.push({ kind: 'kv-put', k }); this.store.set(k, v); },
    async delete(k) { calls.push({ kind: 'kv-del', k }); this.store.delete(k); },
  };
  const doNs = {
    calls,
    idFromName: (n) => ({ name: n }),
    get: (id) => ({
      async fetch(url, opts) {
        const method = (opts && opts.method) || 'GET';
        calls.push({ kind: 'do-' + method.toLowerCase(), url: String(url), name: id.name });
        if (method === 'POST') return new Response(JSON.stringify({ ok: true, revoked: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify({ revoked: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    }),
  };
  return { calls, kv, doNs };
}

function makeEnv(kv, doNs) {
  return {
    APP_PASSWORD: 'synthetic-password',
    SESSION_SECRET: SECRET,
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

/* ⭐ كوكي صحيح ⭐ (exp بالمللي + توقيع HMAC ⭐) */
function mintCookie(expMs, secret) {
  const exp = String(expMs);
  const sig = nodeCrypto.createHmac('sha256', secret).update(exp).digest('hex');
  return 'octa_mgmt_sess=' + encodeURIComponent(exp + '.' + sig);
}

async function sessionStatus(worker, env, cookie) {
  const res = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env);
  return res.status;
}

/* ═══════════════════════════════════════════════════════════════════════
   ① ⭐⭐⭐ الكوكي المزوّر ⭐⭐⭐ ⇒ صفر نداءات ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I06-01: a FORGED cookie never reaches the storage (zero calls)', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log.kv, log.doNs);

  /* ⛔ كوكي بشكل صحيح ⭐ بس التوقيع **غلط** ⭐ */
  const forged = 'octa_mgmt_sess=' + encodeURIComponent(
    String(Date.now() + 3600000) + '.' + 'f'.repeat(64));

  const st = await sessionStatus(worker, env, forged);
  assert.equal(st, 401, '⛔ لازم ترفض ⭐');
  assert.equal(log.calls.length, 0,
    '⛔⛔⛔ كوكي مزوّر وصل التخزين ⭐ ⭐ (' +
    log.calls.map(c => c.kind).join(',') + ') ⭐ لازم صفر نداءات ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ② ⭐⭐⭐ الكوكي المنتهي ⭐⭐⭐ ⇒ صفر نداءات ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I06-02: an EXPIRED cookie never reaches the storage (zero calls)', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log.kv, log.doNs);

  /* ⛔ توقيع صحيح ⭐ بس الوقت خلص ⭐ */
  const expired = mintCookie(Date.now() - 1000, SECRET);

  const st = await sessionStatus(worker, env, expired);
  assert.equal(st, 401, '⛔ لازم ترفض ⭐');
  assert.equal(log.calls.length, 0,
    '⛔⛔⛔ كوكي منتهي وصل التخزين ⭐ ⭐ (' +
    log.calls.map(c => c.kind).join(',') + ') ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ③ ⭐⭐⭐ كوكي مشوّه ⭐⭐⭐ ⇒ صفر نداءات ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I06-03: a MALFORMED cookie never reaches the storage (zero calls)', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log.kv, log.doNs);

  const st = await sessionStatus(worker, env, 'octa_mgmt_sess=not-a-session');
  assert.equal(st, 401, '⛔ لازم ترفض ⭐');
  assert.equal(log.calls.length, 0,
    '⛔⛔⛔ كوكي مشوّه وصل التخزين ⭐ ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ④ ⭐⭐ الترتيب ⭐⭐ — الكوكي الصحيح ⭐ ⇒ الـDO الأول ⭐ ثم الـKV ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I06-04: a valid cookie hits the DO first, then the KV witness', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log.kv, log.doNs);
  const cookie = mintCookie(Date.now() + 3600000, SECRET);

  const st = await sessionStatus(worker, env, cookie);
  assert.equal(st, 200, '⛔ جلسة صحيحة ⇒ ٢٠٠ ⭐');
  assert.ok(log.calls.length >= 2,
    '⛔ لازم يكون فيه نداء للـDO والـKV ⭐');
  assert.equal(log.calls[0].kind, 'do-get',
    '⛔⛔ المصدر القوي (الـDO) لازم يبقى **أول** نداء ⭐ — ' +
    'ترتيب: ' + log.calls.map(c => c.kind).join(',') + ' ⭐');
  assert.ok(log.calls.some(c => c.kind === 'kv-get'),
    '⛔ لازم الشاهد (الـKV) يتشال ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ⑤ ⭐⭐ مافيش DO ⭐⭐ ⇒ الـKV بس ⭐ (fallback ⭐)
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I06-05: without the DO the KV witness is the only call', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log.kv, null);
  const cookie = mintCookie(Date.now() + 3600000, SECRET);

  const st = await sessionStatus(worker, env, cookie);
  assert.equal(st, 200, '⛔ جلسة صحيحة ⇒ ٢٠٠ ⭐');
  assert.deepEqual(log.calls.map(c => c.kind), ['kv-get'],
    '⛔ لازم نداء واحد للـKV بس ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ⑥ ⭐⭐ المسارات المحمية ⭐⭐ — كوكي مزوّر ⭐ ⇒ ٤٠١ ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I06-06: a forged cookie is refused on a protected API too', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log.kv, log.doNs);
  const forged = 'octa_mgmt_sess=' + encodeURIComponent(
    String(Date.now() + 3600000) + '.' + 'a'.repeat(64));

  const res = await worker.fetch(req('/api/prefs', {
    headers: { Cookie: forged },
  }), env);
  assert.equal(res.status, 401, '⛔ لازم ٤٠١ ⭐');
  assert.equal(log.calls.length, 0,
    '⛔⛔⛔ كوكي مزوّر وصل التخزين من مسار محمي ⭐ ⭐');
});
