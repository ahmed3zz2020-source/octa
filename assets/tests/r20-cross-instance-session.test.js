/**
 * 🛡️ براهين الجولة ٢٠ — R20-F01: إبطال الجلسة عبر أكتر من نسخة من الـWorker
 *
 * 📌 المشكلة (مثبتة): كان الإبطال في **ذاكرة** الـWorker ⇒ نسخة تانية
 *   من الـWorker كانت بتقبل نفس الجلسة بعد الخروج ⭐
 * ✅ الحل: مخزن مشترك (KV) — المفتاح هاش موقّع (مش الكوكي نفسه).
 *
 * ⛔ كل اختبار لازم يفشل على الكود قبل الإصلاح وينجح بعده.
 * ⛔ ممنوع ذكر أسماء أدوات ذكاء اصطناعي في أي تعليق هنا.
 */
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');

function loadWorker() {
  const src = fs.readFileSync(path.join(ROOT, 'mgmt/worker.js'), 'utf8');
  return new Function('Response', 'Request', 'URL', 'crypto',
    src.replace('export default', 'return'))(Response, Request, URL, crypto);
}

/* ⛔ محاكاة KV مشترك بين "نسختين" من الـWorker ⭐
   ⛔ مافيش شبكة ⭐ مافيش حساب ⭐ */
function fakeKV() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
  };
}

function makeEnv(worker, kv) {
  return {
    APP_PASSWORD: 'synthetic-password',
    SESSION_SECRET: 'synthetic-secret',
    OCTA_ADMIN_TOKEN: 'synthetic-token',
    REVOKE_KV: kv || null,
    ASSETS: {
      fetch: async () => new Response('synthetic protected shell', {
        headers: { 'Cache-Control': 'public, max-age=3600' },
      }),
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
  assert.equal(res.status, 200);
  return res.headers.get('Set-Cookie').split(';')[0];
}

test('R20-F01: logout on instance A revokes the session on instance B', async () => {
  /* ⭐⭐ لازم **نسختين مستقلتين** من الـworker ⭐
     ⛔ لو نسختين من نفس الـmodule ⇒ جدول الإبطال في الذاكرة مشترك
        ⇒ الاختبار يمشي حتى مع العيب ⭐ (برهان كاذب!) ⭐
     ⭐ loadWorker() مرتين ⇒ كل واحدة في scope مستقل ⇒ جدولان منفصلان ⭐ */
  const workerA = loadWorker();
  const workerB = loadWorker();
  const kv = fakeKV();
  const envA = makeEnv(workerA, kv);
  const envB = makeEnv(workerB, kv);   // ⭐ نسخة تانية — نفس الـKV

  const cookie = await login(workerA, envA);

  /* ⭐ قبل الخروج: النسخة B بتقبل الجلسة ⬇️ */
  const before = await workerB.fetch(req('/api/session', {
    headers: { Cookie: cookie },
  }), envB);
  assert.equal(before.status, 200, 'الجلسة لازم تكون صالحة قبل الخروج');

  /* ⭐ الخروج من النسخة A ⬇️ */
  const out = await workerA.fetch(req('/api/logout', {
    method: 'POST',
    headers: { Cookie: cookie },
  }), envA);
  assert.equal(out.status, 200);

  /* ⭐⭐ بعد الخروج: النسخة B لازم ترفض ⬇️ — ده هو البرهان */
  const after = await workerB.fetch(req('/api/session', {
    headers: { Cookie: cookie },
  }), envB);
  assert.equal(after.status, 401,
    '⛔ النسخة B قبلت جلسة اتبطلت في النسخة A — الإبطال مش منتشر');

  /* ⭐ والنسخة A نفسها ترفض ⭐ */
  const afterA = await workerA.fetch(req('/api/session', {
    headers: { Cookie: cookie },
  }), envA);
  assert.equal(afterA.status, 401);
});

test('R20-F02: the revocation key is a signed hash, never the raw cookie', async () => {
  const worker = loadWorker();
  const kv = fakeKV();
  const envA = makeEnv(worker, kv);
  const cookie = await login(worker, envA);
  await worker.fetch(req('/api/logout', {
    method: 'POST',
    headers: { Cookie: cookie },
  }), envA);

  const keys = [...kv.store.keys()];
  assert.ok(keys.length > 0, 'لازم يتكتب مفتاح إبطال');
  for (const k of keys) {
    assert.ok(k.startsWith('rev:'), 'المفتاح لازم يبقى تحت بادئة rev:');
    assert.ok(!k.includes(cookie), '⛔ الكوكي الخام لازم ما يتكتبش في KV');
    assert.ok(!k.includes(cookie.split('=')[1] || '___'), '⛔ مافيش توكن في المفتاح');
  }
  /* ⭐ والمفتاح ما يكونش نص صريح (hex) ⇒ هاش موقّع ⭐ */
  assert.match(keys[0], /^rev:[0-9a-f]{64}$/, 'المفتاح لازم يكون هاش hex');
});

test('R20-F03: without KV the worker still works (single instance fallback)', async () => {
  const worker = loadWorker();
  const env = makeEnv(worker, null);
  const cookie = await login(worker, env);
  const res = await worker.fetch(req('/api/session', {
    headers: { Cookie: cookie },
  }), env);
  assert.equal(res.status, 200);

  const out = await worker.fetch(req('/api/logout', {
    method: 'POST',
    headers: { Cookie: cookie },
  }), env);
  assert.equal(out.status, 200);
  const after = await worker.fetch(req('/api/session', {
    headers: { Cookie: cookie },
  }), env);
  assert.equal(after.status, 401, 'الإبطال في الذاكرة لازم يشتغل');
});

test('R20-F04: /api/health reports whether revocation is shared (booleans only)', async () => {
  const worker = loadWorker();
  const kv = fakeKV();
  const res = await worker.fetch(req('/api/health'), makeEnv(worker, kv));
  assert.equal(res.status, 200);
  const b = await res.json();
  assert.equal(b.revoke_shared, true, 'مع KV ⇒ الإedal مشترك');
  // ⭐ الجولة ٢١: زاد `revoke_strong` ⭐ (هل الإطلاع اتساق قوي ⭐)
  // ⭐ النية (booleans بس ⭐ مافيش أي اسم متغيّر ⭐) محفوظة ⭐
  assert.deepEqual(Object.keys(b).sort(),
    ['has_admin', 'has_password', 'ok', 'revoke_shared', 'revoke_strong'],
    '⛔ health لازم يبقى booleans بس — مافيش أي اسم متغيّر');
  for (const [k, v] of Object.entries(b)) {
    assert.equal(typeof v, 'boolean', '⛔ الحقل ' + k + ' لازم boolean ⭐');
  }
});
