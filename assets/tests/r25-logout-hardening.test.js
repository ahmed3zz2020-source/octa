/* ═══════════════════════════════════════════════════════════════════════
   🛡️🛡️ الجولة ٢٥ (R25 · المرحلة ٢) — R24-I09 / I10 / I11
   ───────────────────────────────────────────────────────────────────────
   📌 I09 (نجاح وهمي) ⭐:
      «إصلاح النجاح الوهمي لتسجيل الخروج عند فشل Durable Object ونجاح KV» ⭐
      ⭐ «اعتماد مصدر الإبطال المتسق باعتباره المرجع الأساسي» ⭐
      ⭐ «عدم اعتبار نجاح KV وحده دليلًا على الإبطال الفوري» ⭐.

   📌 I10 (غياب التخزين المشترك) ⭐:
      «ممنوع الاعتماد على الذاكرة المحلية باعتبارها حماية كافية عبر نسخ Worker» ⭐
      ⭐ «تنفيذ fail-closed في بيئة الإنتاج عند غياب مصدر الإبطال المطلوب» ⭐.

   📌 I11 (مسار logout) ⭐:
      «التحقق من التوقيع والانتهاء قبل استدعاء التخزين» ⭐
      ⭐ «منع الكوكي المزور من استهلاك موارد Durable Object أو KV» ⭐
      ⭐ «التحقق من صحة الإبطال قبل إعلان النجاح» ⭐.

   📌 طريقة الإثبات ⭐: سجل نداءات ⭐ + مقارنة بالأساس ⭐
      ⭐ والتشغيل على الكود القديم ⭐:
      OCTA_FE_ROOT=<مجلد فيه mgmt/worker.js القديم> node --test ...

   📌 التشغيل: node --test assets/tests/r25-logout-hardening.test.js
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
    src + '\ntry { module.exports.RevokeDO = RevokeDO; } catch (e) { }');
  fn(mod, mod.exports, Request, Response, Headers, URL, crypto);
  return mod.exports;
}

/* ⭐ سجل النداءات ⭐ (DO ⭐ + KV ⭐ في نفس السجل ⭐) */
function makeCallLog(opts = {}) {
  const calls = [];
  const kv = {
    calls,
    store: new Map(),
    async get(k) { calls.push({ kind: 'kv-get', k }); return this.store.has(k) ? this.store.get(k) : null; },
    async put(k, v) {
      calls.push({ kind: 'kv-put', k });
      if (opts.kvWriteFails) throw new Error('kv-write-down');
      this.store.set(k, v);
    },
    async delete(k) { calls.push({ kind: 'kv-del', k }); this.store.delete(k); },
  };
  const doNs = {
    calls,
    idFromName: (n) => ({ name: n }),
    get: (id) => ({
      async fetch(url, fopts) {
        const method = (fopts && fopts.method) || 'GET';
        calls.push({ kind: 'do-' + method.toLowerCase(), url: String(url), name: id.name });
        /* ⭐⭐⭐ (R28) ⭐ حالة كلمة المرور ⭐ (panel_state ⭐) ⭐
           ⭐ الشكل الحقيقي ⭐: {ok:true, pwd:null} ⭐ (لما يكن تغير) ⭐. */
        if (String(id.name || '') === 'panel_state' && method === 'GET') {
          if (opts.doReadFails) return new Response('down', { status: 500 });
          const pwd = opts.pwdVer ? { ver: String(opts.pwdVer) } : null;
          return new Response(JSON.stringify({ ok: true, pwd: pwd }),
            { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (method === 'POST') {
          if (opts.doWriteFails) return new Response('down', { status: 500 });
          return new Response(JSON.stringify({ ok: true, revoked: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        /* ⭐ القراءة ⭐ — لو الكتابة فشلت ⭐ ⇒ مافيش إبطال ⭐ */
        const revoked = !!opts.doWriteFails ? false : true;
        return new Response(JSON.stringify({ revoked }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    }),
  };
  return { calls, kv, doNs };
}

/* ⭐⭐ (R26) ⭐ فصل namespaces ⭐⭐
   📌 قاعدة الاعتماد بقت تعتمد على **نسخة كلمة المرور** ⭐ ⇒ ⭐ لازم نقرأ
      حالة اللوحة (panel_state ⭐ — نسخة واحدة مشتركة ⭐) عشان نحسب الوسم ⭐.
   ⛔ ده **مش** نداء الإبطال ⭐ (rev: ⭐ — نسخة لكل جلسة ⭐) ⭐
      ⛔⇒ الكوكي المزوّر/المنتهي لازم ما يوصلش namespace الإبطال ⭐
      ⛔⇒ وده بالظبط حاجب استنزاف الموارد ⭐. */
function sessionStoreCalls(log) {
  return log.calls.filter(function (c) {
    if (c.kind === 'kv-get' || c.kind === 'kv-put' || c.kind === 'kv-del') return true;
    if (c.kind === 'do-get' || c.kind === 'do-post') {
      const n = String(c.name || '');
      return n.indexOf('rev:') === 0 || n.indexOf('att:') === 0;
    }
    return false;
  });
}

function panelStateOnly(log) {
  return log.calls.every(function (c) {
    return c.kind === 'do-get' && c.name === 'panel_state';
  });
}

function makeEnv(log, extra = {}) {
  return Object.assign({
    APP_PASSWORD: 'synthetic-password',
    SESSION_SECRET: SECRET,
    OCTA_ADMIN_TOKEN: 'synthetic-token',
    /* ⭐⭐⭐ الجولة ٢٦ (R26) ⭐ — ⭐ البيئة معلنة صراحة ⭐
       ⭐ (⭐ الافتراضي في الكود = إنتاج ⭐ ⇒ fail-closed ⭐ ⇒ ⭐ الاختبار يعلن ⭐). */
    APP_ENV: 'production',
    REVOKE_KV: log && log.kv ? log.kv : null,
    REVOKE_DO: log && log.doNs ? log.doNs : null,
    ASSETS: {
      fetch: async () => new Response('<html><body>panel</body></html>',
        { status: 200, headers: { 'Content-Type': 'text/html' } }),
    },
  }, extra);
}

function req(p, opts = {}) {
  return new Request('https://mgmt.invalid' + p, opts);
}

/* ⭐⭐⭐ الجولة ٢٦ (R26) — ⭐ التوقيع بقى يشمل **وسم الاعتماد** ⭐
   📌 السبب ⭐: ⛔ تغيير كلمة المرور ⭐ كان **مش** بيبطل الجلسات القائمة ⭐.
   📌 فاصيل: ⭐ نفس قاعدة الكود ⭐ (sign(exp + "." + tag) ⭐) ⭐. */
function credentialTag(password, ver) {
  /* (R26) نفس قاعدة الكود في mgmt/worker.js ⭐:
     sha256(كلمة المرور + '|' + النسخة) مقصوص ١٦ hex.
     النسخة (ver) بتتغير مع تغيير كلمة المرور ⇒ الجلسة القديمة تموت. */
  const v = (ver === undefined || ver === null) ? '0' : String(ver);
  return nodeCrypto.createHash('sha256')
    .update(String(password) + '|' + v).digest('hex').slice(0, 16);
}

function mintCookie(expMs, secret, password, ver) {
  /* ⭐⭐⭐ (R28) ⭐ الشكل الجديد ⭐ `exp.tag.sig` ⭐
     ⭐ الوسم بالنسخة داخل التوكن ⭐ (مافيش نداءات خزاءية) ⭐. */
  const exp = String(expMs);
  const tag = credentialTag(password, ver);
  const payload = exp + '.' + tag;
  const sig = nodeCrypto.createHmac('sha256', secret).update(payload).digest('hex');
  return 'octa_mgmt_sess=' + encodeURIComponent(exp + '.' + tag + '.' + sig);
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
  return { status: res.status, body, res };
}

/* ═══════════════════════════════════════════════════════════════════════
   ① ⭐⭐⭐ R24-I09 — فشل الـDO + نجاح الـKV ⭐⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R25-I09-01: a failed Durable Object write must NOT be masked by a KV success', async () => {
  const worker = loadWorker();
  const log = makeCallLog({ doWriteFails: true });
  const env = makeEnv(log);
  const cookie = await login(worker, env);

  const out = await logout(worker, env, cookie);
  assert.notEqual(out.status, 200,
    '⛔⛔⛔ نجاح وهمي ⭐ — فشل الـDO + نجاح الـKV ⇒ ما ينفعش 200 ok:true ⭐');
  assert.equal(out.status, 503,
    '⛔ لازم ٥٠٣ ⭐ (المصدر المتسق هو المرجع ⭐) — got ' + out.status);
  assert.equal(out.body.ok, false,
    '⛔ الرد لازم يقول إن الإiplash ما اتثبتش ⭐');
  assert.equal(out.body.revoked_shared, false,
    '⛔ لازم يعلن إن الإبطال المشترك ما اتثبتش ⭐');
});

test('R25-I09-02: when the authoritative source confirms, the logout succeeds', async () => {
  const worker = loadWorker();
  const log = makeCallLog({ kvWriteFails: true });
  const env = makeEnv(log);
  const cookie = await login(worker, env);

  const out = await logout(worker, env, cookie);
  assert.equal(out.status, 200,
    '⛔ الـDOأكّد ⇒ الخروج ناجح ⭐ — got ' + out.status);
  assert.equal(out.body.ok, true);
  assert.equal(out.body.revocation, 'strong',
    '⛔ لازم يعلن إبطال فوري ⭐');
});

test('R25-I09-03: a KV-only success must never claim immediate revocation', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  /* ⭐⭐⭐ الجولة ٢٦ (R26) ⭐ — ⭐ في الإنتاج ⭐ ⛔ الـKV لوحده مش مصدر قبول ⭐
     ⭐ ⇒ ⭐ الاختبار ده بقى في **بيئة غير إنتاج** ⭐ (الوضع الوحيد اللي الـKV
     ⭐   يقدر فيهما يثبت ⭐) ⭐ — ⭐ والقاعدة نفسها (مش إبطال فوري ⭐) بتفضل ⭐. */
  const env = makeEnv(log, { REVOKE_DO: null, APP_ENV: 'preview' });
  const cookie = await login(worker, env);

  const out = await logout(worker, env, cookie);
  assert.equal(out.status, 200,
    '⛔ الـKV اشتغل ⇒ الخروج بنجاح ⭐ — got ' + out.status);
  assert.ok(out.body.immediate === false || out.body.revocation !== 'strong',
    '⛔⛔⛔ مينفعش إعلان إبطال **فوري** من نجاح الـKV لوحده ⭐ — ' +
    JSON.stringify(out.body) + ' ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ② ⭐⭐⭐ R24-I10 — غياب المخزن المشترك ⭐⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R25-I10-01: in production with no shared revocation source it must fail closed', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log, { REVOKE_KV: null, REVOKE_DO: null, APP_ENV: 'production' });
  /* ⭐⭐⭐ الجولة ٢٦ (R26) ⭐ — ⭐ ⛔ الدخول نفسه مقفول ⭐
     📌 السبب ⭐: ⛔ جلسة من غير مصدر إبطال ⇒ ⭐ ما تتبطلش عبر النسخ ⭐
        ⇒ ⭐ ⭐ فجوة أمنية ⭐ ⭐ ⇒ ⭐ ⛔ ما نصدرهاش أصلاً ⭐.
     📌 ده **أقوى** من العقد القديم ⭐ (القديم: الدخول ينجح ⭐ والخروج يفشل ⭐). */
  const loginRes = await worker.fetch(req('/api/login', {
    method: 'POST', body: JSON.stringify({ password: env.APP_PASSWORD }),
  }), env);
  assert.equal(loginRes.status, 503,
    '⛔⛔⛔ لازم الدخول يفشل مغلق ⭐ (مافيش مصدر إبطال ⭐) — got ' + loginRes.status);
  const setCookie = loginRes.headers.get('Set-Cookie') || '';
  assert.ok(setCookie.indexOf('Max-Age=0') === -1 && !/octa_mgmt_sess=[^;]+/.test(setCookie),
    '⛔⛔⛔ مينفعش نصدر كوكي جلسة ⭐ — ' + setCookie + ' ⭐');
  /* ⭐⭐⭐ الجولة ۲۶ (R26) ⭐ — ⭐ كوكي **سليم التوقيع** ⭐
     ⭐ (مش مزوّر ⭐) ⭐ ⇒ ⭐ عشان نختبر مسار ⭐“مافيش مصدر” ⭐
     ⭐ ولا مسار ⭐“كوكي زائف” ⭐. */
  const cookie = mintCookie(Date.now() + 3600000, env.SESSION_SECRET, env.APP_PASSWORD);

  const out = await logout(worker, env, cookie);
  assert.notEqual(out.status, 200,
    '⛔⛔⛔ مافيش مصدر إبطال مشترك ⇒ ⛔ مينفعش إعلان نجاح ⭐ (الذاكرة المحلية مش حماية ⭐)');
  assert.equal(out.status, 503, '⛔ لازم ٥٠٣ ⭐ — got ' + out.status);
  assert.equal(out.body.ok, false);
  assert.equal(out.body.revoked_shared, false);
});

test('R25-I10-02: outside production the single-instance behaviour is kept and documented', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log, { REVOKE_KV: null, REVOKE_DO: null, APP_ENV: 'preview' });
  const cookie = await login(worker, env);

  const out = await logout(worker, env, cookie);
  assert.equal(out.status, 200,
    '⛔ بيئة غير إنتاج ⇒ السلوك القديم (ذاكرة واحدة ⭐) ⭐ — got ' + out.status);
  assert.equal(out.body.revoked_shared, false,
    '⛔ لازم يعلن إن الإبطال مش مشترك ⭐');
  assert.ok(out.body.scope === 'single-instance',
    '⛔ لازم يوثّق إن الإبطال محلي ⭐ — ' + JSON.stringify(out.body) + ' ⭐');
});

test('R25-I10-03: the production config must declare APP_ENV=production (fail-closed guard)', async () => {
  const cfgPath = path.join(ROOT, 'mgmt', 'wrangler.jsonc');
  const cfg = fs.readFileSync(cfgPath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
  const parsed = JSON.parse(cfg);
  assert.equal(parsed.vars && parsed.vars.APP_ENV, 'production',
    '⛔⛔⛔ إعدادات الإنتاج لازم تصرّح APP_ENV=production ⭐ (وإلا ⇒ مافيش fail-closed ⭐)');
  assert.ok((parsed.kv_namespaces || []).some(k => k.binding === 'REVOKE_KV'),
    '⛔ لازم ربط REVOKE_KV ⭐');
  assert.ok((parsed.durable_objects || {}).bindings &&
    parsed.durable_objects.bindings.some(b => b.name === 'REVOKE_DO'),
    '⛔ لازم ربط REVOKE_DO ⭐');
  assert.ok((parsed.migrations || []).some(m => (m.new_sqlite_classes || []).includes('RevokeDO')),
    '⛔ لازم migration الـDO ⭐');
});

/* ═══════════════════════════════════════════════════════════════════════
   ③ ⭐⭐⭐ R24-I11 — التحقق قبل التخزين ⭐⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R25-I11-01: a FORGED cookie must never reach the Durable Object or the KV', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const forged = 'octa_mgmt_sess=' + encodeURIComponent(
    String(Date.now() + 3600000) + '.' + 'f'.repeat(64));

  const out = await logout(worker, env, forged);
  assert.equal(out.status, 401,
    '⛔ كوكي مزوّر ⇒ ٤٠١ ⭐ — got ' + out.status);
  assert.equal(sessionStoreCalls(log).length, 0, '⛔⛔⛔ كوكي مزوّر استهلك موارد الـDO/الـKV ⭐ (' +
    log.calls.map(c => c.kind).join(',') + ') ⭐ لازم صفر نداءات ⭐');
  assert.ok(panelStateOnly(log), '⛔⛔⛔ اتصلح غير حالة اللوحة (panel_state) ⭐ — ' + log.calls.map(function (c) { return c.kind + ':' + (c.name || c.k || ''); }).join(','));
});

test('R25-I11-02: an EXPIRED cookie must not consume Durable Object or KV resources', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const expired = mintCookie(Date.now() - 1000, SECRET, env.APP_PASSWORD);

  const out = await logout(worker, env, expired);
  assert.equal(out.status, 200,
    '⛔ جلسة منتهية ⇒ مفيش حاجة تتبطل ⭐ — got ' + out.status);
  assert.equal(sessionStoreCalls(log).length, 0, '⛔⛔⛔ جلسة منتهية استهلكت التخزين ⭐ (' +
    log.calls.map(c => c.kind).join(',') + ') ⭐');
  assert.ok(panelStateOnly(log), '⛔⛔⛔ اتصلح غير حالة اللوحة (panel_state) ⭐ — ' + log.calls.map(function (c) { return c.kind + ':' + (c.name || c.k || ''); }).join(','));
  assert.equal(out.body.revocation, 'not-needed',
    '⛔ لازم يعلن إن مفيش إبطال محتاج ⭐');
});

test('R25-I11-03: a MALFORMED cookie must not reach the storage', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);

  const out = await logout(worker, env, 'octa_mgmt_sess=not-a-session');
  assert.equal(out.status, 401, '⛔ لازم ٤٠١ ⭐ — got ' + out.status);
  assert.equal(sessionStoreCalls(log).length, 0, '⛔⛔⛔ كوكي مشوّه وصل التخزين ⭐');
  assert.ok(panelStateOnly(log), '⛔⛔⛔ اتصلح غير حالة اللوحة (panel_state) ⭐ — ' + log.calls.map(function (c) { return c.kind + ':' + (c.name || c.k || ''); }).join(','));
});

test('R25-I11-04: a VALID cookie still revokes through the shared store', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const cookie = await login(worker, env);

  const out = await logout(worker, env, cookie);
  assert.equal(out.status, 200, '⛔ الخروج لازم ينجح ⭐ — got ' + out.status);
  assert.ok(log.calls.some(c => c.kind === 'do-post'),
    '⛔ لازم الكتابة في الـDO ⭐');
  assert.ok(log.calls.some(c => c.kind === 'kv-put'),
    '⛔ لازم الكتابة في الـKV ⭐');
  /* ⭐ التحقق قبل إعلان النجاح ⭐ ⇒ قراءة تأكيد ⭐ */
  assert.ok(log.calls.some(c => c.kind === 'do-get'),
    '⛔⛔⛔ لازم قراءة تأكيد بعد الكتابة ⭐ (قراءة بعد كتابة ⭐)');
  assert.equal(out.body.revocation, 'strong');
});

test('R25-I11-05: the cookie must always be cleared, even on a rejected one', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const forged = 'octa_mgmt_sess=' + encodeURIComponent(
    String(Date.now() + 3600000) + '.' + 'a'.repeat(64));

  const out = await logout(worker, env, forged);
  assert.ok(out.res.headers.get('Set-Cookie'),
    '⛔ الكوكي لازم يتمسح ⭐');
});
