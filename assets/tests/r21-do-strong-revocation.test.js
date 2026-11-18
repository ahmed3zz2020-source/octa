/**
 * 🛡️ الجولة ٢٢ (R22) — إبطال الجلسات بـDurable Object (اتساق قوي ⭐)
 *
 * 📌 القيد المعروف (موثّق ⭐): الـKV **اتساقه متأخر** (حتى ~٦٠ ثانية ⭐)
 *   ⇒ بعد الخروج، نسخة تانية من الـWorker ممكن تقبل جلسة اتبطلت ⭐
 *   ⇒ الحل = مصدر واحد **strongly-consistent** ⭐ = Durable Object ⭐
 *
 * 📌 المطلوب (برهان ⭐):
 *   ① نسختين مستقلتين من الـWorker + **نفس** الـDO ⇒ الرفض **فوراً** ⭐
 *   ② المسار القوي (الـDO) هو المستخدم لما الـbinding موجود ⭐
 *      (والـKV هو الـfallback لما الـbinding مش موجود ⭐)
 *   ③ ⛔ خطأ في الـDO ⇒ **fail-closed** ⭐ ⇒ الجلسة تُرفض (مش 200 ⭐)
 *   ④ /api/health ⇒ `revoke_shared` + `revoke_strong` booleans ⭐
 *
 * ⛔ كل اختبار بيشتغل على **مُحاكي DO محلي** ⭐ (مافيش شبكة ⭐ مافيش حساب ⭐)
 * ⛔ المuck على شكل Map واحد في الذاكرة ⭐ (مشترك بين كل النسخ ⭐)
 *   ⇒ ده بالظبط معنى **strong consistency** ⭐ (مافيش تأخير ⭐)
 * ⛔ ممنوع ذكر أسماء أدوات ذكاء اصطناعي في أي تعليق هنا ⭐
 */
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');

/* ⭐ نفس أسلوب تحميل ر20 ⭐ (نفس الملف ⭐ نفس الـsandbox ⭐) ⭐ */
function loadWorker() {
  const src = fs.readFileSync(path.join(ROOT, 'mgmt/worker.js'), 'utf8');
  /* ⭐ الجولة ٢٢: mgmt/worker.js بقى يصدّر صنف الـDurable Object باسم مُسمّى ⭐
     ⇒ السطر ده بيتشال قبل التقييم (وإلا الـparser هيرفض الملف ⭐). */
  return new Function('Response', 'Request', 'URL', 'crypto',
    src.replace(/^export\s*\{[^}]*\};?$/gm, '').replace('export default', 'return'))(Response, Request, URL, crypto);
}

/* ⭐ تحميل **صنف** الـDurable Object من نفس الملف ⭐
   (بنستخدم الصنف الحقيقي في المُحاكي ⭐ ⇒ الاختبار بيلمس الكود الحقيقي ⭐) */
function loadRevokeDO() {
  const src = fs.readFileSync(path.join(ROOT, 'mgmt/worker.js'), 'utf8');
  const body = src
    .replace(/^export\s+default/m, 'const __worker =')
    .replace(/^export\s*\{([^}]*)\};?$/m, 'return { $1 };');
  return new Function('Response', 'Request', 'URL', 'crypto', body)(
    Response, Request, URL, crypto).RevokeDO;
}

/* ⭐⭐ state بتاع الـDO ⭐ — الـstorage متسق بقوة ⭐ (Map ⭐)
   ⭐ `store` = Map واحد مشترك ⭐ متقسّم على الـids ⭐ */
function makeState(store, id) {
  const rec = () => {
    if (!store.has(id)) store.set(id, new Map());
    return store.get(id);
  };
  return {
    storage: {
      async get(k) { const r = rec(); return r.has(k) ? r.get(k) : undefined; },
      async put(k, v) { rec().set(k, v); },
      async delete(k) { rec().delete(k); },
    },
  };
}

/* ⭐⭐ مُحاكي Durable Object ⭐ — **shared in-memory Map keyed by id** ⭐
   ⭐ كل `id` = instance واحد ⭐ (زي الـDO الحقيقي ⭐)
   ⭐ ⛔ مافيش تأخير ⭐ ⛔ مافيش شبكة ⭐ مافيش حساب ⭐
   📌 `fail`: 'throw' | '500' | 'garbage' | 'write' ⭐ (أعطال متعمّدة ⭐) */
function mockDo(RevokeDOClass, opts = {}) {
  const store = new Map();          // ⭐ Map واحد مشترك ⭐
  const instances = new Map();      // ⭐ instance واحد لكل id ⭐
  const calls = [];
  const ns = {
    store,
    calls,
    idFromName: (name) => ({ name: String(name) }),
    get: (id) => {
      let inst = instances.get(id.name);
      if (!inst) {
        inst = new RevokeDOClass(makeState(store, id.name), {});
        instances.set(id.name, inst);
      }
      return {
        async fetch(url, init) {
          const method = (init && init.method) || 'GET';
          calls.push({ id: id.name, url: String(url), method });
          /* ⛔ أعطال متعمّدة ⭐ */
          if (opts.fail === 'throw') throw new Error('DO unreachable');
          if (opts.fail === '500') return new Response('boom', { status: 500 });
          if (opts.fail === 'garbage') return new Response('not-json', { status: 200 });
          /* ⛔ فشل **الكتابة** بس ⭐ (القراءة شغالة ⭐) */
          if (opts.fail === 'write' && method === 'POST') {
            return new Response('write failed', { status: 500 });
          }
          return inst.fetch(new Request(url, init));
        },
      };
    },
  };
  return ns;
}

/* ⭐ KV كامل ⭐ (fallback ⭐ + شاهد احتياطي ⭐) */
function fakeKV() {
  const store = new Map();
  const reads = [];
  return {
    store,
    reads,
    async get(k) { reads.push(k); return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
  };
}

function makeEnv(kv, doNs) {
  return {
    APP_PASSWORD: 'synthetic-password',
    SESSION_SECRET: 'synthetic-secret',
    OCTA_ADMIN_TOKEN: 'synthetic-token',
    REVOKE_KV: kv || null,
    REVOKE_DO: doNs || null,
    ASSETS: {
      fetch: async () => new Response('synthetic shell',
        { headers: { 'Cache-Control': 'public, max-age=3600' } }),
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

async function logout(worker, env, cookie) {
  const res = await worker.fetch(req('/api/logout', {
    method: 'POST', headers: { Cookie: cookie },
  }), env);
  return res.status;
}

async function sessionStatus(worker, env, cookie) {
  const res = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env);
  return res.status;
}

/* ── ①) الرفض الفوري عبر نسختين ───────────────────────────────────────── */
test('R22-DO-01: logout on instance A revokes the session on instance B immediately (no propagation window)', async () => {
  /* ⭐⭐ لازم **نسختين مستقلتين** من الـworker ⭐
     ⛔ لو نسختين من نفس الـmodule ⇒ جدول الإبطال في الذاكرة مشترك ⭐ */
  const workerA = loadWorker();
  const workerB = loadWorker();
  const RevokeDO = loadRevokeDO();
  const doNs = mockDo(RevokeDO);
  const envA = makeEnv(fakeKV(), doNs);
  const envB = makeEnv(fakeKV(), doNs);   // ⭐ نسخة تانية — **نفس** الـDO ⭐

  const cookie = await login(workerA, envA);

  /* ⭐ قبل الخروج: النسخة B بتقبل الجلسة ⬇️ */
  assert.equal(await sessionStatus(workerB, envB, cookie), 200,
    'الجلسة لازم تكون صالحة قبل الخروج');

  /* ⭐ الخروج من النسخة A ⬇️ */
  assert.equal(await logout(workerA, envA, cookie), 200);

  /* ⭐⭐ بعد الخروج: النسخة B لازم ترفض **فوراً** ⬇️ — ده هو البرهان
     ⭐ (مافيش نافذة انتشار ⭐ = اتساق قوي ⭐) ⭐ */
  assert.equal(await sessionStatus(workerB, envB, cookie), 401,
    '⛔ النسخة B قبلت جلسة اتبطلت في النسخة A — الـDO مش متسق بقوة ⭐');
  assert.equal(await sessionStatus(workerA, envA, cookie), 401);
});

/* ── ②) المسار القوي (DO) المستخدم، والـKV fallback ───────────────────── */
test('R22-DO-02: the DO path is used when REVOKE_DO is bound (and the KV is the fallback when it is not)', async () => {
  /* ⭐ مع الـbinding: الـDO هو اللي بيتكلم ⭐ */
  const worker = loadWorker();
  const RevokeDO = loadRevokeDO();
  const doNs = mockDo(RevokeDO);
  const kv = fakeKV();
  const env = makeEnv(kv, doNs);
  const cookie = await login(worker, env);

  assert.equal(await logout(worker, env, cookie), 200);
  assert.ok(doNs.calls.length > 0, '⛔ لازم الـDO يكون هو اللي اتكلم ⭐');
  assert.ok(doNs.calls.some(c => c.method === 'POST' && c.url.endsWith('/revoke')),
    '⛔ لازم الـDO ياخد POST /revoke ⭐');
  assert.ok(doNs.calls.some(c => c.method === 'GET' && c.url.endsWith('/check')),
    '⛔ لازم الـDO ياخد GET /check ⭐');

  const before = doNs.calls.length;
  /* ⭐⭐ لازم **نسخة تانية** ⭐ — النسخة اللي عملت الخروج عندها إبطال
     في الذاكرة ⭐ ⇒ الفحص بيرجع قبل ما يوصل للـDO ⭐ (وده صح ⭐). ⭐ */
  const workerB = loadWorker();
  const envB = makeEnv(fakeKV(), doNs);
  assert.equal(await sessionStatus(workerB, envB, cookie), 401);
  assert.ok(doNs.calls.length > before, '⛔ فحص الجلسة لازم يروح للـDO ⭐');

  /* ⭐ من غير الـbinding: الـKV هو المصدر ⭐ والـDO مش موجود أصلاً ⭐ */
  const worker2 = loadWorker();
  const kv2 = fakeKV();
  const env2 = makeEnv(kv2, null);
  const cookie2 = await login(worker2, env2);
  assert.equal(await logout(worker2, env2, cookie2), 200);
  assert.ok([...kv2.store.keys()].length > 0, '⛔ لازم يتكتب مفتاح إبطال في الـKV ⭐');
  /* ⭐ نسخة تانية ⭐ ⇒ الفحص بيروح للـKV ⭐ (مش للإبطال في الذاكرة ⭐) ⭐ */
  const worker3 = loadWorker();
  const env3 = makeEnv(kv2, null);
  assert.equal(await sessionStatus(worker3, env3, cookie2), 401);
  assert.ok(kv2.reads.length > 0, '⛔ من غير DO ⇒ لازم الـKV هي المصدر ⭐');
});

/* ── ③) fail-closed: خطأ الـDO ⇒ رفض ─────────────────────────────────── */
test('R22-DO-03: a DO error fails closed (the session is REFUSED, never 200)', async () => {
  for (const mode of ['throw', '500', 'garbage']) {
    const worker = loadWorker();
    const RevokeDO = loadRevokeDO();
    const doNs = mockDo(RevokeDO, { fail: mode });
    const env = makeEnv(fakeKV(), doNs);
    const cookie = await login(worker, env);

    const st = await sessionStatus(worker, env, cookie);
    assert.notEqual(st, 200,
      '⛔ خطأ في الـDO (' + mode + ') ما ينفعش يقبل الجلسة ⭐');
    assert.equal(st, 401,
      '⛔ خطأ في الـDO (' + mode + ') ⇒ لازم يرفض (fail-closed) ⭐');
  }
});

/* ── ④) صحة الـworker: booleans بس ────────────────────────────────────── */
test('R22-DO-04: /api/health reports revoke_shared=true and revoke_strong=true when REVOKE_DO is bound', async () => {
  const worker = loadWorker();
  const RevokeDO = loadRevokeDO();
  const res = await worker.fetch(req('/api/health'), makeEnv(fakeKV(), mockDo(RevokeDO)));
  assert.equal(res.status, 200);
  const b = await res.json();
  assert.equal(b.revoke_shared, true, '⛔ لازم يعلن إن الإبطال مشترك ⭐');
  assert.equal(b.revoke_strong, true, '⛔ لازم يعلن إن الإبطال قوي ⭐');
  for (const [k, v] of Object.entries(b)) {
    assert.equal(typeof v, 'boolean', '⛔ الحقل ' + k + ' لازم boolean ⭐');
  }

  /* ⭐ من غير الـDO: مشترك (KV ⭐) بس مش قوي ⭐ */
  const res2 = await worker.fetch(req('/api/health'), makeEnv(fakeKV(), null));
  const b2 = await res2.json();
  assert.equal(b2.revoke_shared, true);
  assert.equal(b2.revoke_strong, false);
});

/* ── ⑤) الصنف نفسه: كتابة / قراءة / مسح ─────────────────────────────── */
test('R22-DO-05: RevokeDO stores the flag on POST /revoke and reports it on GET /check', async () => {
  const RevokeDO = loadRevokeDO();
  const store = new Map();          // ⭐ Map واحد ⭐
  const inst = new RevokeDO(makeState(store, 'id-a'), {});

  const before = await inst.fetch(new Request('https://revoke.internal/check'));
  assert.equal(before.status, 200);
  assert.deepEqual(await before.json(), { revoked: false },
    '⛔ جلسة جديدة ⇒ مش مبطلة ⭐');

  const w = await inst.fetch(new Request('https://revoke.internal/revoke', { method: 'POST' }));
  assert.equal(w.status, 200);

  const after = await inst.fetch(new Request('https://revoke.internal/check'));
  assert.deepEqual(await after.json(), { revoked: true },
    '⛔ لازم الشاهدة تتسجل فوراً ⭐ (مافيش تأخير ⭐)');

  /* ⭐ id تاني ⇒ مش مبطلة ⭐ (العزل بين الجلسات ⭐) */
  const other = new RevokeDO(makeState(store, 'id-b'), {});
  const o = await other.fetch(new Request('https://revoke.internal/check'));
  assert.deepEqual(await o.json(), { revoked: false });

  /* ⭐ مسار المسح (اختياري ⭐) */
  const c = await inst.fetch(new Request('https://revoke.internal/clear', { method: 'POST' }));
  assert.equal(c.status, 200);
  const cleared = await inst.fetch(new Request('https://revoke.internal/check'));
  assert.deepEqual(await cleared.json(), { revoked: false });

  /* ⭐ مسار مجهول ⇒ 404 ⭐ */
  const bad = await inst.fetch(new Request('https://revoke.internal/nope'));
  assert.equal(bad.status, 404);
});

/* ── ⑥) witness أمان: فشل كتابة الـDO ⇒ الـKV بيمنع القبول الصامت ────── */
test('R22-DO-06: the KV safety net still refuses the session when the DO write failed', async () => {
  /* ⛔ الـDO شغالة في القراءة ⭐ بس **الكتابة** بتفشل ⭐
     ⛔ ⇒ من غير شاهد الـKV كانت النسخة التانية هتقبل ⭐ (قبول صامت ⭐) ⭐ */
  const worker = loadWorker();
  const RevokeDO = loadRevokeDO();
  const doNs = mockDo(RevokeDO, { fail: 'write' });
  const kv = fakeKV();
  const env = makeEnv(kv, doNs);
  const cookie = await login(worker, env);

  /* 🛡️🛡️ R25 (R24-I09) ⭐ — عقد الجولة ٢٥ ⭐:
     ⭐ «المصدر المتسق (الـDO) هو المرجع الأساسي» ⭐
     ⭐ ⇒ فشل كتابة الـDO ⛔ **مش نجاح** ⭐ (٥٠٣ ⭐)
     ⭐ ⭐ والـKV بيفضل **شاهد** ⭐ ⇒ بيسجّل ⭐ وبيمنع القبول الصامت ⭐. */
  assert.equal(await logout(worker, env, cookie), 503,
    '⛔⛔⛔ فشل كتابة الـDO ⇒ ⛔ الخرج ما ينفعش يعلن نجاح ⭐');
  assert.ok([...kv.store.keys()].length > 0,
    '⛔ فشل كتابة الـDO ⇒ لازم الشاهد يتكتب في الـKV ⭐');

  const st = await sessionStatus(worker, env, cookie);
  assert.notEqual(st, 200, '⛔ مافيش قبول صامت ⭐');
  assert.equal(st, 401, '⛔ لازم ترفض ⭐');
});

/* ── ⑦) أمان: اسم الـDO هاش موقّع (مش الكوكي الخام) ───────────────────── */
test('R22-DO-07: the DO id is a signed hash — never the raw cookie', async () => {
  const worker = loadWorker();
  const RevokeDO = loadRevokeDO();
  const doNs = mockDo(RevokeDO);
  const env = makeEnv(fakeKV(), doNs);
  const cookie = await login(worker, env);
  await logout(worker, env, cookie);
  await sessionStatus(worker, env, cookie);

  assert.ok(doNs.calls.length > 0, '⛔ لازم الـDO يكون هو اللي اتكلم ⭐');
  const raw = cookie.split('=')[1] || '';
  for (const c of doNs.calls) {
    assert.ok(c.id.startsWith('rev:'), '⛔ اسم الـDO لازم يبقى تحت بادئة rev: ⭐');
    assert.match(c.id, /^rev:[0-9a-f]{64}$/, '⛔ اسم الـDO لازم يبقى هاش hex ⭐');
    assert.ok(!c.id.includes(raw), '⛔ مافيش توكن خام في اسم الـDO ⭐');
  }
});
