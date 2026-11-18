/* ═══════════════════════════════════════════════════════════════════════
   🧪🛡️ الجولة ٢٤ (R24 · المرحلة ٢) — R22-I05: مدة صلاحية التخزين
   ───────────────────────────────────────────────────────────────────────
   📌 المتطلب (R22-I05 ⭐):
      «مدة صلاحية التخزين (TTL) تغطي العمر المتبقي للجلسة بهامش» ⭐
      ⭐ «وأن الحالة القديمة تُبطل (fail-closed) لو لم نثبت الإبطال» ⭐.

   📌 العيب المقاس في الجولة ٢٤ ⭐:
      `expirationTtl` في الـKV **بالثواني** ⭐ ⇒ الكود القديم كان يحسب
      **بالدقائق** ⭐ ⇒ `Math.floor(SESSION_TTL / 60) + 1` = ٤٨١ ⭐
      ⇒ ⛔ العلامة كانت بتخلص بعد ~٨ دقايق ⭐ (وعمر الجلسة ٨ ساعات ⭐)
      ⇒ ⛔ بعد ٨ دقايق ⇒ ⛔ الجلسة المبتطللة بترجع **صالحة** ⭐ (fail-open ⭐).
      ⛔ وكمان: علامة الـDO كانت بتفضل **للأبد** ⭐ (تخزين بيزيد ⭐).

   📌 التشغيل:
      node --test assets/tests/r24-session-i05.test.js
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

/* ⭐ ساعة قابلة للتحكم ⭐ (بلا انتظار حقيقي ⭐) */
function makeClock() {
  let t = Date.now();
  return {
    now: () => t,
    advance: (ms) => { t += ms; return t; },
    set: (ms) => { t = ms; },
  };
}

/* ⭐⭐ KV يحترم `expirationTtl` ⭐⭐ (زي الكوش الحقيقي ⭐)
   📌 `expirationTtl` **بالثواني** ⭐ (الـKV بيحسب بالثواني ⭐). */
function kvWithTtl(clock) {
  const store = new Map();       /* k ⇒ {v, expMs} */
  const puts = [];
  return {
    store, puts,
    async get(k) {
      const e = store.get(k);
      if (!e) return null;
      if (e.expMs && clock.now() >= e.expMs) { store.delete(k); return null; }
      return e.v;
    },
    async put(k, v, opts) {
      const ttl = opts && Number(opts.expirationTtl || 0);
      puts.push({ k, v, expirationTtl: ttl });
      const expMs = ttl ? clock.now() + ttl * 1000 : 0;
      store.set(k, { v, expMs });
    },
    async delete(k) { store.delete(k); },
  };
}

/* ⭐ DO يقرأ ويكتب حالة ⭐ */
function doShared() {
  const store = new Map();
  const calls = [];
  const ns = {
    store, calls,
    idFromName: (n) => ({ name: n }),
    get: (id) => ({
      async fetch(url, opts) {
        calls.push({ url: String(url), method: (opts && opts.method) || 'GET' });
        if ((opts && opts.method) === 'POST') { store.set(id.name, true); }
        return new Response(JSON.stringify({ revoked: !!store.get(id.name) }),
          { headers: { 'Content-Type': 'application/json' } });
      },
    }),
  };
  return ns;
}

/* ⭐ تخزين DO وهمي ⭐ بيحفظ خيارات الكتابة ⭐ */
function fakeDoState() {
  const data = new Map();
  const puts = [];
  return {
    data, puts,
    storage: {
      async put(k, v, opts) { puts.push({ k, v, opts }); data.set(k, v); },
      async get(k) { return data.has(k) ? data.get(k) : null; },
      async delete(k) { data.delete(k); },
    },
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

async function sessionStatus(worker, env, cookie) {
  const res = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env);
  return res.status;
}

const SESSION_TTL_S = 8 * 60 * 60;     /* ٨ ساعات ⭐ */
const MARGIN_S = 5 * 60;              /* ٥ دقايق هامش ⭐ */

/* ═══════════════════════════════════════════════════════════════════════
   ① ⭐⭐ الاختبار السالب ⭐⭐ — TTL = العمر المتبقي + هامش ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I05-01: the KV marker TTL covers the remaining session lifetime + margin', async () => {
  const worker = loadWorker();
  const clock = makeClock();
  const kv = kvWithTtl(clock);
  const env = makeEnv(kv, null);
  const cookie = await login(worker, env);

  const res = await worker.fetch(req('/api/logout', {
    method: 'POST', headers: { Cookie: cookie },
  }), env);
  assert.equal(res.status, 200, '⛔ الخروج لازم ينجح ⭐');

  assert.equal(kv.puts.length, 1, '⛔ لازم تكون فيه كتابة واحدة في الـKV ⭐');
  const ttl = Number(kv.puts[0].expirationTtl || 0);
  /* ⭐ العمر المتبقي **الحقيقي** ⭐ (من الكوكي نفسه ⭐) */
  const expMs = Number(decodeURIComponent(cookie.split('=')[1]).split('.')[0]);
  const remaining = Math.floor((expMs - Date.now()) / 1000);

  /* ⛔⛔ الـTTL لازم يغطي العمر المتبقي + هامش ⭐ */
  assert.ok(ttl >= remaining + MARGIN_S,
    '⛔⛔ TTL (' + ttl + 'ث) أقل من العمر المتبقي + الهامش (' +
    (remaining + MARGIN_S) + 'ث) ⭐ ⇒ العلامة بتخلص والجلسة بترجع صالحة ⭐');
  /* ⛔ وبحد أقصى معقول ⭐ (مش عمر مفتوح ⭐) */
  assert.ok(ttl <= remaining + MARGIN_S + 60,
    '⛔ TTL أطول من اللازم ⭐ (' + ttl + 'ث) ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ② ⭐⭐⭐ البرهان الحاسم ⭐⭐⭐ — العلامة لازم تعيش طول عمر الجلسة ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I05-02: an hour later the marker must still be there (no fail-open)', async () => {
  const workerA = loadWorker();
  const workerB = loadWorker();
  const clock = makeClock();
  const kv = kvWithTtl(clock);
  const envA = makeEnv(kv, null);
  const envB = makeEnv(kv, null);
  const cookie = await login(workerA, envA);

  await workerA.fetch(req('/api/logout', {
    method: 'POST', headers: { Cookie: cookie },
  }), envA);

  /* ⭐⏰ ساعة بعد الإبطال ⭐ (العمر لسه ٧ ساعات ⭐) */
  clock.advance(60 * 60 * 1000);

  const st = await sessionStatus(workerB, envB, cookie);
  assert.equal(st, 401,
    '⛔⛔⛔ الجلسة المبتطللة رجعت صالحة بعد ساعة ⭐ ⭐ ' +
    '⇒ TTL قصير ⇒ قبول صامت (fail-open ⭐) ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ③ ⭐⭐ علامة الـDO لازم يكون لها صلاحية ⭐⭐ (تنظيف + أمان ⭐)
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I05-03: the Durable Object marker carries an expiration (session end + margin)', async () => {
  const worker = loadWorker();
  const DO = worker.RevokeDO;
  assert.ok(typeof DO === 'function',
    '⛔ لازم يكون فيه صنف RevokeDO مُصدَّر ⭐');

  const state = fakeDoState();
  const inst = new DO(state, {});
  const expiresAt = Date.now() + SESSION_TTL_S * 1000;

  const res = await inst.fetch(new Request('https://revoke.internal/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revoked: true, expiresAt }),
  }));
  assert.equal(res.status, 200, '⛔ لازم الكتابة تنجح ⭐');
  assert.equal(state.puts.length, 1, '⛔ لازم تكون فيه كتابة واحدة ⭐');

  const put = state.puts[0];
  assert.ok(put.opts && put.opts.expiration,
    '⛔⛔ العلامة اتكتبت **بلا صلاحية** ⭐ ⇒ هتفضل للأبد ⭐');
  assert.ok(Number(put.opts.expiration) >= Math.floor(expiresAt / 1000) + MARGIN_S,
    '⛔⛔ صلاحية علامة الـDO أقصر من (نهاية الجلسة + هامش) ⭐ ⇒ ' +
    'ممكن العلامة تموت والجلسة لسه صالحة ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ④ ⭐⭐ fail-closed ⭐⭐ — حالة مش معروفة ⇒ رفض ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I05-04: an unknown revocation state fails closed (the session is REFUSED)', async () => {
  const worker = loadWorker();
  const brokenKv = {
    async get() { throw new Error('KV unreachable'); },
    async put() { throw new Error('KV unreachable'); },
    async delete() { throw new Error('KV unreachable'); },
  };
  const env = makeEnv(brokenKv, null);
  const cookie = await login(worker, env);
  const st = await sessionStatus(worker, env, cookie);
  assert.equal(st, 401,
    '⛔⛔ مافيش دليل ⇒ لازم نرفض ⭐ (مش 200 ⭐) — fail-closed ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ⑤ ⭐⭐ العلامة القديمة ما بتقيّش الجلسات ⭐⭐ (العالم الحقيقي ⭐)
   ═══════════════════════════════════════════════════════════════════════ */
test('R24-I05-05: the DO path still revokes instantly across instances', async () => {
  const workerA = loadWorker();
  const workerB = loadWorker();
  const doNs = doShared();
  const envA = makeEnv(null, doNs);
  const envB = makeEnv(null, doNs);
  const cookie = await login(workerA, envA);
  await workerA.fetch(req('/api/logout', {
    method: 'POST', headers: { Cookie: cookie },
  }), envA);
  assert.equal(await sessionStatus(workerB, envB, cookie), 401,
    '⛔ لازم ترفض فوراً ⭐ (مافيش نافذة ⭐)');
});
