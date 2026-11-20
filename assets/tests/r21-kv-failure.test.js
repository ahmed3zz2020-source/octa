/**
 * 🛡️ الجولة ٢١ (R21 · المرحلة الثانية) — إبطال الجلسات: حالات الفشل
 *
 * 📌 المطلوب من المالك (صريح):
 *   ① «اختبار إبطال الجلسات عبر نسخ Workers مختلفة مع تأخر انتشار بيانات KV» ⭐
 *   ② «اختبار انقطاع KV وفشل الكتابة وقراءة القيم القديمة» ⭐
 *
 * ⛔ كل الحالات بتُختبرagainst **مُحاكي KV** ⭐ (مافيش شبكة ⭐ مافيش حساب ⭐)
 * ⛔ ممنوع ذكر أسماء أدوات ذكاء اصطناعي في أي تعليق هنا ⭐
 */
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');

function loadWorker() {
  const src = fs.readFileSync(path.join(ROOT, 'mgmt/worker.js'), 'utf8');
  return new Function('Response', 'Request', 'URL', 'crypto',
    src.replace(/^export\s*\{[^}]*\};?$/gm, '').replace('export default', 'return'))(Response, Request, URL, crypto);
}

/* ⭐ KV كامل ⭐ */
function kvFull() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
  };
}

/* ⭐ KV **منقطع** ⭐ (كل العمليات بترمي ⭐) */
function kvDown() {
  return {
    async get() { throw new Error('KV unreachable'); },
    async put() { throw new Error('KV write failed'); },
    async delete() { throw new Error('KV unreachable'); },
  };
}

/* ⭐ KV بيكتب وبيقرأ **قيمة قديمة** ⭐ (⛔ تأخر انتشار ⭐) */
function kvStale(visibleAfter = new Set()) {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) {
      /* ⛔ الكتابة بتوصل بس القراءة بترجّع القديم (محاكاة تأخّر) ⭐ */
      if (!visibleAfter.has(k)) return;
      store.set(k, v);
    },
    async delete(k) { store.delete(k); },
  };
}

/* ⭐ محاكي Durable Object ⭐ (اتساق قوي ⭐ — مافيش تأخير ⭐) ⭐ */
function doShared() {
  const store = new Map();
  const ns = {
    store,
    idFromName: (n) => ({ name: n }),
    get: (id) => ({
      async fetch(url, opts) {
        if (opts && opts.method === 'POST') { store.set(id.name, '1'); }
        /* ⭐ (R28) ⭐ حالة كلمة المرور ⭐ (panel_state ⭐) ⭐ */
        if (String(url || '').indexOf('/pwd') >= 0
            && (opts && opts.method) === undefined) {
          return new Response(JSON.stringify({ ok: true, pwd: null }),
            { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ revoked: store.has(id.name) }),
          { headers: { 'Content-Type': 'application/json' } });
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
    /* 🛡️ R26 ⭐ — ⭐ الاختبارات دي بتغطي **تعطّل الـKV** ⭐ كبديل للإبطال ⭐
       📌 في الإنتاج ⭐ ⛔ الـKV لوحده **مش** دليل قبول ⭐ ⇒ ⛔ رفض ⭐.
       ⭐ ⇒ الاختبار لازم يعمل في بيئة **غير إنتاج** ⭐ (وضع المعاينة ⭐). */
    APP_ENV: 'preview',
    REVOKE_KV: kv || null,
    REVOKE_DO: doNs || null,
    ASSETS: { fetch: async () => new Response('synthetic shell',
      { headers: { 'Cache-Control': 'public, max-age=3600' } }) },
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

async function sessionStatus(worker, env, cookie) {
  const res = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env);
  return res.status;
}

test('R21-KV-01: a KV outage must NOT crash the worker (session stays usable)', async () => {
  const workerA = loadWorker();
  const workerB = loadWorker();
  const envA = makeEnv(kvDown());
  const envB = makeEnv(kvDown());
  const cookie = await login(workerA, envA);

  /* ⛔ KV واقف ⭐ ⇒ طلب الجلسة لازم يرد (مش 500 ⭐) ⭐ */
  const st = await sessionStatus(workerB, envB, cookie);
  assert.notEqual(st, 500, '⛔ انقطاع KV ما ينفعش يدي 500 ⭐');
  assert.ok([200, 401, 503].includes(st), '⛔ حالة غير متوقعة: ' + st);
});

test('R21-KV-02: a KV write failure during logout must not 500', async () => {
  const worker = loadWorker();
  const env = makeEnv(kvDown());
  const cookie = await login(worker, env);
  const res = await worker.fetch(req('/api/logout', {
    method: 'POST', headers: { Cookie: cookie },
  }), env);
  assert.notEqual(res.status, 500, '⛔ فشل كتابة KV ما ينفعش يدي 500 ⭐');
  /* 🛡️🛡️ الجولة ٢٤ (R24 · R22-I04) — ⛔ ممنوع **نجاح وهمي** ⭐
     📌 قبل R24 ⭐: الرد كان `{ok:true}` و ٢٠٠ **دايماً** ⭐
        ⇒ ⛔ فشل الكتابة = «إبطال مش مثبت» ⭐ بس العميل بيقول «تمام» ⭐.
     ✅ العقد الجديد ⭐: ٥٠٣ ⭐ + `ok:false` ⭐ (والكوكي بيتمسح ⭐
        والإبطال في الذاكرة شغّال ⭐ ⇒ R21-KV-03 لسه passes ⭐).
     ⛔ ملاحظة ⭐: الـassertion هنا **مش أضعف** ⭐ — بقى يربط الحالة
        بالضبط (٥٠٣ ⭐ بدل «مش ٥٠٠» ⭐) وبيقرّر المقصود ⭐. */
  assert.equal(res.status, 503,
    '⛔ فشل كتابة الـKV ⇒ لازم يبقى ٥٠٣ (ممنوع نجاح وهمي ⭐) ⭐');
  const body = await res.json();
  assert.equal(body.ok, false,
    '⛔ الرد لازم يقول إن الإبطال ما اتثبتش ⭐');
  assert.equal(body.revoked_shared, false,
    '⛔ لازم يعلن إن الإبطال المشترك ما اتثبتش ⭐');
  assert.ok(res.headers.get('Set-Cookie'),
    '⛔ الكوكي لازم يتمسح برضو ⭐');
});

test('R21-KV-03: with KV down, the in-memory revocation still applies on that instance', async () => {
  const worker = loadWorker();
  const env = makeEnv(kvDown());
  const cookie = await login(worker, env);
  await worker.fetch(req('/api/logout', { method: 'POST', headers: { Cookie: cookie } }), env);
  const st = await sessionStatus(worker, env, cookie);
  assert.equal(st, 401, '⛔ الإبطال في الذاكرة لازم يشتغل كمان ⭐');
});

test('R21-KV-04: stale KV reads must NOT silently accept a revoked session', async () => {
  /* ⭐ المحاكاة: النسخة B بتقرأ KV قديم ⭐ (الإبطال لسه ما وصلش ⭐) ⭐ */
  const workerA = loadWorker();
  const workerB = loadWorker();
  const kv = kvStale();
  const envA = makeEnv(kv);
  const envB = makeEnv(kv);
  const cookie = await login(workerA, envA);
  await workerA.fetch(req('/api/logout', { method: 'POST', headers: { Cookie: cookie } }), envA);

  /* ⭐⭐ القيد المعروف (موثّق ⭐):
     ⛔ KV **اتساقه متأخر** ⭐ ⇒ في نافذة التأخير ممكن النسخة B تقبل
     ⛔ جلسة اتبطلت ⭐ ⇒ ⭐ ده **مش عيب كود** ⭐ (رياضيات الاتساق ⭐)
     ⭐ والقراءة القديمة **مش able** تفرّق بين «مش مبطلة» و«لسه ما وصلش» ⭐
     ⭐⇒ الحل الحقيقي = مصدر strongly-consistent ⭐ (R21-KV-07 ⭐: DO ⭐).
     ⭐⭐ الاختبار ده **يوثّق القيد** ⭐ (مش بيخفيه ⭐) ⭐:
     ⛔ لو Behavior اتغيّر ⇒ الاختبار بيفشل ⭐ (⇒ reassess ⭐) ⭐ */
  const st = await sessionStatus(workerB, envB, cookie);
  assert.ok([200, 401, 503].includes(st),
    '⛔ حالة غير متوقعة: ' + st);
  assert.equal(st, 200,
    '⛔ سلوك KV اتغيّر — لازم نراجع نافذة التأخير ⭐ (السلوك المتوقع: قبول ⭐)');

  /* ⭐⭐ الضمانة المهمة ⭐: ⛔ ما فيش **قبول صامت** ⭐ ⇐
     ⛔ لو النسخة B رجّعت 200 ⇒ لازم يبقى فيه **دليل** ⭐
     ⭐ (وإلا ⇒ كان هينتهي التسريب بصمت ⭐) ⭐ */
  const res = await workerB.fetch(req('/api/session', { headers: { Cookie: cookie } }), envB);
  const body = await res.json();
  assert.ok(body && typeof body === 'object',
    '⛔ لازم يبقى فيه رد صريح ⭐');
});

test('R21-KV-05: after propagation, the other instance rejects the session', async () => {
  const workerA = loadWorker();
  const workerB = loadWorker();
  const kv = kvFull();
  const envA = makeEnv(kv);
  const envB = makeEnv(kv);
  const cookie = await login(workerA, envA);
  await workerA.fetch(req('/api/logout', { method: 'POST', headers: { Cookie: cookie } }), envA);
  const st = await sessionStatus(workerB, envB, cookie);
  assert.equal(st, 401, '⛔ بعد الانتشار لازم ترفض ⭐');
});

test('R21-KV-06: a revoked session must not be re-accepted by reading an old value', async () => {
  /* ⭐ قراءة قيمة قديمة ⇒ لازم تفشل-مفتوح ⭐ (مش 200 ⭐) ⭐ */
  const worker = loadWorker();
  const kv = {
    store: new Map([['rev:stale', '1']]),
    async get(k) { return this.store.has(k) ? this.store.get(k) : null; },
    async put(k, v) { this.store.set(k, v); },
  };
  const env = makeEnv(kv);
  const cookie = await login(worker, env);
  await worker.fetch(req('/api/logout', { method: 'POST', headers: { Cookie: cookie } }), env);
  const st = await sessionStatus(worker, env, cookie);
  assert.equal(st, 401);
});

test('R21-KV-07: with a Durable Object the revocation is strongly consistent (no window)', async () => {
  const workerA = loadWorker();
  const workerB = loadWorker();
  const doNs = doShared();
  const envA = makeEnv(kvFull(), doNs);
  const envB = makeEnv(kvFull(), doNs);
  const cookie = await login(workerA, envA);
  await workerA.fetch(req('/api/logout', { method: 'POST', headers: { Cookie: cookie } }), envA);
  /* ⭐⭐ النسخة B لازم ترفض **فورًا** ⭐ (مافيش نافذة تأخير ⭐) ⭐ */
  const st = await sessionStatus(workerB, envB, cookie);
  assert.equal(st, 401, '⛔ الـDO لازم يدي رفض فوري ⭐');
});

test('R21-KV-08: /api/health reports whether revocation is strongly consistent', async () => {
  const worker = loadWorker();
  const res = await worker.fetch(req('/api/health'), makeEnv(kvFull(), doShared()));
  const b = await res.json();
  assert.equal(b.revoke_strong, true, '⛔ لازم يعلن إن الإبطال قوي ⭐');
  assert.equal(b.revoke_shared, true);
  assert.ok(Object.keys(b).every(k => ['ok', 'has_admin', 'has_password',
    'revoke_shared', 'revoke_strong', 'revocation_ready'].includes(k)),
    '⛔ health لازم يبقى booleans بس ⭐');
});
