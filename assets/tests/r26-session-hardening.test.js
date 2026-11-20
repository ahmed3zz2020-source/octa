/* ═══════════════════════════════════════════════════════════════════════
   🛡️🛡️🛡️ الجولة ٢٦ (R26 · المرحلة ١) — ⭐ منظومة الجلسات كاملة ⭐
   ───────────────────────────────────────────────────────────────────────
   📌 العيوب المقاسة (من المراجع المستقل ⭐):
   ① غياب المخزن المشترك ⭐ ⇒ `sharedRevokeState` ترجع false ⭐ ⇒ ⭐ جلسة بتتقبل ⭐.
   ② `validSession` ⭐ ممكن تعتبر الجلسة صالحة رغم غياب التخزين المطلوب ⭐.
   ③ الحماية كانت على logout بس ⭐ ⭐ ⇒ ⭐ قبول الجلسة نفسه محميش ⭐.
   ④ KV من نسخة واحدة ⭐ ⭐ ⇒ ⭐ قراءة نجاح ⭐ ⭐ مش دليل إبطال فوري عبر النسخ ⭐.
   ⑤ تغيير كلمة المرور ⭐ ⭐ ما كانش بيبطل الجلسات القائمة ⭐.
   ⑥ مسار الخروج ⭐ (GET/POST ⭐) ⭐ ⭐ ما كانش فيه فحص أصل ⭐ ⇒ CSRF ⭐.
   ⑦ إعداد بيئة خاطئ ⭐ ⭐ كان بيعتبر غير إنتاج ⭐ ⇒ fail-open ⭐.

   📌 المطلوب ⭐: إصدار ⭐ قبول ⭐ تجديد ⭐ إبطال ⭐ خروج ⭐ تغيير كلمة المرور ⭐
      ⭐ تدوير SESSION_SECRET ⭐ — ⭐ كلهم fail-closed ⭐ في الإنتاج ⭐.

   📌 التشغيل: node --test assets/tests/r26-session-hardening.test.js
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');
const SECRET = 'synthetic-secret';
const PASSWORD = 'synthetic-password';

function loadWorker(file) {
  const src = fs.readFileSync(path.join(ROOT, file || 'mgmt/worker.js'), 'utf8')
    .replace(/^export\s*\{[^}]*\};?$/gm, '')
    .replace('export default', 'module.exports =');
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'Request', 'Response',
    'Headers', 'URL', 'crypto', src);
  fn(mod, mod.exports, Request, Response, Headers, URL, crypto);
  return mod.exports;
}

function loadFrontendWorker() {
  const src = fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8')
    .replace(/^import\s+\{[^}]*\}\s+from\s+'[^']*';?$/gm, '')
    .replace(/^export\s*\{[^}]*\};?$/gm, '')
    .replace('export default', 'module.exports =');
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'Request', 'Response',
    'Headers', 'URL', 'crypto', src);
  fn(mod, mod.exports, Request, Response, Headers, URL, crypto);
  return mod.exports;
}

/* ⭐ سجل نداءات ⭐ */
function makeCallLog(opts = {}) {
  const calls = [];
  const kv = {
    calls,
    store: new Map(),
    async get(k) {
      calls.push({ kind: 'kv-get', k });
      if (opts.kvReadFails) throw new Error('kv-read-down');
      return this.store.has(k) ? this.store.get(k) : null;
    },
    async put(k, v) {
      calls.push({ kind: 'kv-put', k });
      if (opts.kvWriteFails) throw new Error('kv-write-down');
      this.store.set(k, v);
    },
    async delete(k) { calls.push({ kind: 'kv-del', k }); this.store.delete(k); },
  };
  const doNs = {
    calls,
    /* ⭐⭐⭐ حالة إبطال مشتركة ⭐ (عادة المحاكم الواحد ⭐) ⭐ */
    state: { revoked: false },
    idFromName: (n) => ({ name: n }),
    get: (id) => ({
      async fetch(url, fopts) {
        const method = (fopts && fopts.method) || 'GET';
        calls.push({ kind: 'do-' + method.toLowerCase(), url: String(url), name: id.name });
        if (opts.doReadFails) return new Response('down', { status: 500 });
        /* ⭐⭐⭐ (R26) ⭐ حالة كلمة المرور ⭐ (نسخة واحدة ⭐ — panel_state ⭐)
           📌 اختياري ⭐: لو الاختبار صرّح بنسخة ⭐ ⇒ نرجّعها ⭐
           ⭐ (ده اللي بيثبّت إن تدويرها ⛔ يبطل الجلسات ⭐). */
        if (opts.pwdVer && String(id.name || '') === 'panel_state') {
          return new Response(JSON.stringify({ ok: true, pwd: { ver: String(opts.pwdVer) } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (method === 'POST') {
          if (opts.doWriteFails) return new Response('down', { status: 500 });
          /* ⭐⭐⭐ بعد كتابة ناجحة ⭐ ⇔ ⭐⭐⭐ الإبطال متثبت ⭐ (قراءة بعد كتابة ⭐ ⇔ تأكيد ⭐) ⭐
             ⭐ (R26) ⭐ الكتابة اللي تثبت الإبطال ⭐ هي اللي على namespace الإبطال ⭐
             (rev: ⭐ — نسخة لكل جلسة ⭐) ⭐ بس ⭐.
             ⛔ غيرها ⭐ (panel_state ⭐ = حالة كلمة المرور ⭐ · att: ⭐ = عدّاد المحاولات ⭐)
             ⛔⇒ ⛔ ما فيش علاقة بالإبطال ⭐ ⇒ ⛔ ما يبقّيش يثبّته ⭐. */
          if (String(id.name || '').indexOf('rev:') === 0) doNs.state.revoked = true;
          return new Response(JSON.stringify({ ok: true, revoked: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ revoked: !!doNs.state.revoked }),
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
    APP_PASSWORD: PASSWORD,
    SESSION_SECRET: SECRET,
    OCTA_ADMIN_TOKEN: 'synthetic-token',
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

function credentialTag(password, ver) {
  /* (R26) نفس قاعدة الكود في mgmt/worker.js ⭐:
     sha256(كلمة المرور + '|' + النسخة) مقصوص ١٦ hex.
     النسخة (ver) بتتغير مع تغيير كلمة المرور ⇒ الجلسة القديمة تموت. */
  const v = (ver === undefined || ver === null) ? '0' : String(ver);
  return nodeCrypto.createHash('sha256')
    .update(String(password) + '|' + v).digest('hex').slice(0, 16);
}

function mintCookie(expMs, secret, password, ver) {
  const exp = String(expMs);
  const payload = password ? (exp + '.' + credentialTag(password, ver)) : exp;
  const sig = nodeCrypto.createHmac('sha256', secret).update(payload).digest('hex');
  return 'octa_mgmt_sess=' + encodeURIComponent(exp + '.' + sig);
}

async function login(worker, env, opts = {}) {
  const res = await worker.fetch(req('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password: env.APP_PASSWORD }),
    headers: opts.headers || {},
  }), env);
  return res;
}

async function logout(worker, env, cookie, opts = {}) {
  const res = await worker.fetch(req('/api/logout', {
    method: opts.method || 'POST',
    headers: Object.assign({ Cookie: cookie }, opts.headers || {}),
  }), env);
  let body = null;
  try { body = await res.json(); } catch (e) { body = null; }
  return { status: res.status, body: body, res: res };
}

/* ═══════════════════════════════════════════════════════════════════════
   ① ⭐⭐⭐ الإصدار ⭐⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R26-S-01: in production with no Durable Object the login must fail closed', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log, { REVOKE_DO: null, REVOKE_KV: null, APP_ENV: 'production' });
  const res = await login(worker, env);
  assert.equal(res.status, 503,
    '⛔⛔⛔ مافيش مصدر إبطال ⇒ ⛔ ما نصدرش جلسة ⭐ — got ' + res.status);
  const sc = res.headers.get('Set-Cookie') || '';
  assert.ok(!/octa_mgmt_sess=[^;]/.test(sc),
    '⛔⛔⛔ اتصدر كوكي جلسة رغم غياب المصدر ⭐ — ' + sc);
});

test('R26-S-02: a KV alone must not be enough to issue or accept a session in production', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log, { REVOKE_DO: null, APP_ENV: 'production' });
  const res = await login(worker, env);
  assert.equal(res.status, 503,
    '⛔⛔⛔ الـKV وحده ⭐ (قراءة ممكن تكون قديمة ⭐) ⭐ ⇒ ⛔ مش مصدر قبول ⭐ — got ' + res.status);
});

test('R26-S-03: in production with the Durable Object the login succeeds', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const res = await login(worker, env);
  assert.equal(res.status, 200, '⛔ الدخول لازم ينجح ⭐ — got ' + res.status);
  assert.ok(/octa_mgmt_sess=/.test(res.headers.get('Set-Cookie') || ''),
    '⛔ لازم كوكي جلسة ⭐');
});

test('R26-S-04: an UNKNOWN environment must be treated as production (fail closed)', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  for (const bad of ['productionn', 'prodution', 'PRODUCTION ', 'live', 'banana', '0']) {
    const env = makeEnv(log, { REVOKE_DO: null, REVOKE_KV: null, APP_ENV: bad });
    const res = await login(worker, env);
    assert.equal(res.status, 503,
      '⛔⛔⛔ البيئة "' + bad + '" ⭐ ⇒ ⛔ لازم تُعتبر إنتاج ⭐ — got ' + res.status);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   ② ⭐⭐⭐ الإبطال والخروج ⭐⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R26-S-05: a failed Durable Object write is never masked by a KV success', async () => {
  const worker = loadWorker();
  const log = makeCallLog({ doWriteFails: true });
  const env = makeEnv(log);
  const cookie = (await login(worker, env)).headers.get('Set-Cookie').split(';')[0];
  const out = await logout(worker, env, cookie);
  assert.equal(out.status, 503, '⛔ لازم ٥٠٣ ⭐ — got ' + out.status);
  assert.equal(out.body.ok, false);
  assert.equal(out.body.revoked_shared, false);
});

test('R26-S-06: when the Durable Object confirms, the logout succeeds even if the KV fails', async () => {
  const worker = loadWorker();
  const log = makeCallLog({ kvWriteFails: true });
  const env = makeEnv(log);
  const cookie = (await login(worker, env)).headers.get('Set-Cookie').split(';')[0];
  const out = await logout(worker, env, cookie);
  assert.equal(out.status, 200, '⛔ لازم ٢٠٠ ⭐ — got ' + out.status);
  assert.equal(out.body.revocation, 'strong');
});

test('R26-S-07: with both stores missing in production the logout fails closed', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log, { REVOKE_DO: null, REVOKE_KV: null, APP_ENV: 'production' });
  const cookie = mintCookie(Date.now() + 3600000, env.SESSION_SECRET, env.APP_PASSWORD);
  const out = await logout(worker, env, cookie);
  assert.equal(out.status, 503, '⛔ لازم ٥٠٣ ⭐ — got ' + out.status);
  assert.equal(out.body.ok, false);
});

test('R26-S-08: a Durable Object READ failure must not accept the session', async () => {
  const worker = loadWorker();
  const log = makeCallLog({ doReadFails: true });
  const env = makeEnv(log);
  const cookie = (await login(worker, env)).headers.get('Set-Cookie').split(';')[0];
  const res = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env);
  assert.equal(res.status, 401,
    '⛔⛔⛔ تعذّر القراءة ⭐ ⇒ ⛔ لازم نرفض ⭐ (fail-closed ⭐) — got ' + res.status);
});

/* ═══════════════════════════════════════════════════════════════════════
   ③ ⭐⭐⭐ تغيير كلمة المرور ⭐ + ⭐ تدوير SESSION_SECRET ⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R26-S-09: changing the password invalidates the existing sessions', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const cookie = (await login(worker, env)).headers.get('Set-Cookie').split(';')[0];
  /* ⭐ نفس الكوكي ⭐ بس كلمة المرور اتغيرت ⭐ */
  const env2 = makeEnv(log, { APP_PASSWORD: 'synthetic-password-2' });
  const res = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env2);
  assert.equal(res.status, 401,
    '⛔⛔⛔ تغيير كلمة المرور ⭐ ⛔ لازم يبطل الجلسات القديمة ⭐ — got ' + res.status);
});

test('R26-S-10: rotating SESSION_SECRET invalidates the existing sessions', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const cookie = (await login(worker, env)).headers.get('Set-Cookie').split(';')[0];
  const env2 = makeEnv(log, { SESSION_SECRET: 'synthetic-secret-2' });
  const res = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env2);
  assert.equal(res.status, 401,
    '⛔⛔⛔ تدوير السر ⭐ ⛔ لازم يبطل الجلسات القديمة ⭐ — got ' + res.status);
});

/* ═══════════════════════════════════════════════════════════════════════
   ④ ⭐⭐⭐ النسخ \⭐⭐⭐ (إعادة تشغيل ⭐ · إبطال عبر النسخ ⭐ · تزامن ⭐)
   ═══════════════════════════════════════════════════════════════════════ */
test('R26-S-11: after a Worker restart the revocation is still visible (the DO is the reference)', async () => {
  const log = makeCallLog();
  const env = makeEnv(log);
  const w1 = loadWorker();
  const cookie = (await login(w1, env)).headers.get('Set-Cookie').split(';')[0];
  const out1 = await logout(w1, env, cookie);
  assert.equal(out1.status, 200, '⛔ الخروج الأول ⭐ — got ' + out1.status);

  /* ⭐ نسخة جديدة ⭐ (ذاكرة جديدة ⭐ ⇒ نفس الـDO ⭐) */
  const w2 = loadWorker();
  const res = await w2.fetch(req('/api/session', { headers: { Cookie: cookie } }), env);
  assert.equal(res.status, 401,
    '⛔⛔⛔ بعد إعادة تشغيل ⭐ ⇒ ⭐ الإبطال لازم يبقى شايف ⭐ — got ' + res.status);
});

test('R26-S-12: reusing an old session after the logout must fail', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const cookie = (await login(worker, env)).headers.get('Set-Cookie').split(';')[0];
  await logout(worker, env, cookie);
  const res = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env);
  assert.equal(res.status, 401, '⛔⛔⛔ إعادة استخدام جلسة قديمة ⭐ ⛔ مرفوضة ⭐ — got ' + res.status);
});

test('R26-S-13: concurrent session checks must agree (no mixed answers)', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const cookie = (await login(worker, env)).headers.get('Set-Cookie').split(';')[0];
  const results = await Promise.all(Array.from({ length: 10 }, () =>
    worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env)
      .then((r) => r.status)));
  const uniq = Array.from(new Set(results));
  assert.equal(uniq.length, 1,
    '⛔⛔⛔ ردود متعارضة ⭐ (٢٠٠ و٤٠١ مع بعض ⭐) ⭐ — ' + JSON.stringify(results));
  assert.equal(uniq[0], 200, '⛔ الجلسة السليمة ⭐ لازم ٢٠٠ ⭐ — got ' + uniq[0]);
});

test('R26-S-14: a logout during the renewal window must not resurrect the session', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const cookie = (await login(worker, env)).headers.get('Set-Cookie').split(';')[0];
  /* ⭐ بعد الإبطال ⭐ ⇒ ⭐ مافيش تجديد ⭐ */
  await logout(worker, env, cookie);
  const res = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env);
  assert.equal(res.status, 401, '⛔⛔⛔ جلسة متبطل ⭐ ⛔ ترجع بالتجديد ⭐ — got ' + res.status);
});

/* ═══════════════════════════════════════════════════════════════════════
   ⑤ ⭐⭐⭐ CSRF ⭐⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R26-S-15: a cross-site logout must be refused with zero storage calls', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const cookie = (await login(worker, env)).headers.get('Set-Cookie').split(';')[0];
  const before = log.calls.length;
  const out = await logout(worker, env, cookie, {
    headers: { 'Sec-Fetch-Site': 'cross-site' },
  });
  assert.equal(out.status, 403, '⛔⛔⛔ طلب من أصل خارجي ⭐ ⛔ ٤٠٣ ⭐ — got ' + out.status);
  assert.equal(log.calls.length, before,
    '⛔⛔⛔ الطلب المرفوض ⭐ ⛔ ما ينفعش يستهلك التخزين ⭐');
});

test('R26-S-16: a cross-site Origin on the logout must be refused', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const cookie = (await login(worker, env)).headers.get('Set-Cookie').split(';')[0];
  const out = await logout(worker, env, cookie, {
    headers: { Origin: 'https://evil.example' },
  });
  assert.equal(out.status, 403, '⛔⛔⛔ Origin خارجي ⭐ ⛔ ٤٠٣ ⭐ — got ' + out.status);
});

test('R26-S-17: a same-origin logout must still work', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const cookie = (await login(worker, env)).headers.get('Set-Cookie').split(';')[0];
  const out = await logout(worker, env, cookie, {
    headers: { 'Sec-Fetch-Site': 'same-origin' },
  });
  assert.equal(out.status, 200, '⛔ الخروج من نفس الأصل ⭐ لازم ينجح ⭐ — got ' + out.status);
});

test('R26-S-18: the interface worker logout must refuse a cross-site request', async () => {
  const worker = loadFrontendWorker();
  const res = await worker.fetch(new Request(
    'https://octa-preview.ahmed3zz2020.workers.dev/api/auth/logout',
    { method: 'GET', headers: { 'Sec-Fetch-Site': 'cross-site' } }),
  { OCTA_API_URL: '', ASSETS: { fetch: async () => new Response('x') } }, {});
  assert.equal(res.status, 403, '⛔⛔⛔ الخروج من أصل خارجي ⭐ ⛔ ٤٠٣ ⭐ — got ' + res.status);
});

/* ═══════════════════════════════════════════════════════════════════════
   ⑥ ⭐⭐⭐⭐⭐ وال⭐⭐ ⭐⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R26-S-19: a forged cookie must not reach the storage and must be refused', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const forged = 'octa_mgmt_sess=' + encodeURIComponent(
    String(Date.now() + 3600000) + '.' + 'f'.repeat(64));
  const out = await logout(worker, env, forged);
  assert.equal(out.status, 401, '⛔ كوكي مزوّر ⭐ ⇒ ٤٠١ ⭐ — got ' + out.status);
  assert.equal(sessionStoreCalls(log).length, 0, '⛔⛔⛔ الكوكي المزوّر استهلك التخزين ⭐');
  assert.ok(panelStateOnly(log), '\u26d4\u26d4\u26d4 اتصلح غير حالة اللوحة (panel_state) \u2b50 \u2014 ' + log.calls.map(function (c) { return c.kind + ':' + (c.name || c.k || ''); }).join(','));
});

test('R26-S-20: an expired cookie must not reach the storage', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log);
  const expired = mintCookie(Date.now() - 1000, env.SESSION_SECRET, env.APP_PASSWORD);
  const out = await logout(worker, env, expired);
  assert.equal(out.status, 200, '⛔ جلسة منتهية ⭐ ⇒ مفيش حاجة تتبطل ⭐ — got ' + out.status);
  assert.equal(sessionStoreCalls(log).length, 0, '⛔⛔⛔ جلسة منتهية استهلكت التخزين ⭐');
  assert.ok(panelStateOnly(log), '\u26d4\u26d4\u26d4 اتصلح غير حالة اللوحة (panel_state) \u2b50 \u2014 ' + log.calls.map(function (c) { return c.kind + ':' + (c.name || c.k || ''); }).join(','));
});

/* ═══════════════════════════════════════════════════════════════════════
   ⑦ ⭐⭐⭐ جاهزية المصدر ⭐⭐⭐ + مسار القبول ⭐⭐⭐
   ═══════════════════════════════════════════════════════════════════════ */
test('R26-S-21: /api/health reports revocation_ready=false in production without the Durable Object', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log, { REVOKE_DO: null, APP_ENV: 'production' });
  const res = await worker.fetch(req('/api/health'), env);
  assert.equal(res.status, 200);
  const b = await res.json();
  assert.equal(b.revocation_ready, false,
    '⛔⛔⛔ الإنتاج بلا DO ⇒ ⛔ لازم يعلن إنه **مش جاهز** ⭐ — got ' + b.revocation_ready);
  assert.equal(typeof b.revocation_ready, 'boolean',
    '⛔ لازم boolean ⭐');
});

test('R26-S-22: /api/health reports revocation_ready=true when the Durable Object is bound', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log, { APP_ENV: 'production' });
  const res = await worker.fetch(req('/api/health'), env);
  const b = await res.json();
  assert.equal(b.revocation_ready, true,
    '⛔⛔ مع الـDO ⇒ ⛔ لازم يعلن إنه **جاهز** ⭐');
  assert.equal(b.revoke_strong, true);
  assert.equal(b.revoke_shared, true);
});

test('R26-S-23: in production a KV-only session is REFUSED even though the KV says "not revoked"', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log, { REVOKE_DO: null, APP_ENV: 'production' });
  /* ⭐ كوكي صحيح ⭐ (توقيع سليم ⭐ + وسم اعتماد ⭐) ⭐ */
  const cookie = mintCookie(Date.now() + 3600000, env.SESSION_SECRET, env.APP_PASSWORD);
  const res = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env);
  assert.equal(res.status, 401,
    '⛔⛔⛔ الـKV وحده ⭐ ⇒ ⛔ لازم يرفض (مش يقبل ⭐) — got ' + res.status);
  assert.ok(log.calls.some(c => c.kind === 'kv-get'),
    '⛔ لازم يقرأ الـKV ⭐ (وإن كان النتيجة ⛔ تُرفض ⭐)');
});

test('R26-S-24: outside production the KV-only session is accepted (the preview mode is unchanged)', async () => {
  const worker = loadWorker();
  const log = makeCallLog();
  const env = makeEnv(log, { REVOKE_DO: null, APP_ENV: 'preview' });
  const cookie = mintCookie(Date.now() + 3600000, env.SESSION_SECRET, env.APP_PASSWORD);
  const res = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env);
  assert.equal(res.status, 200,
    '⛔⛔ خارج الإنتاج ⭐ ⇒ ⭐ سلوك المعاينة لازم يفضل زي ما هو ⭐ — got ' + res.status);
});

/* ⭐⭐⭐ (R26) ⭐⭐⭐ تدوير كلمة المرور ⭐⭐⭐
   📌 السبب ⭐: ⛔ تغيير كلمة المرور ⭐ كان **مش** بيبطل الجلسات القائمة ⭐
      ⇒ ⛔ مينفعش نخلي جلسة قديمة صالحة ⭐.
   ✅ الحل ⭐: ⭐ وسم الاعتماد (credentialTag ⭐) بقى فيه **نسخة** كلمة المرور ⭐
      ⇒ ⭐ تغييرها ⭐ ⛔ التوقيع كله يتغيّر ⭐ ⇒ ⛔ كل الجلسات تموت ⭐. */
test('R26-S-26: ⭐ تغيير كلمة المرور ⭐ ⛔ يبطل كل الجلسات القديمة ⭐', async () => {
  const worker = loadWorker();
  /* ⭐ نسخة ١ ⭐ */
  const log1 = makeCallLog({ pwdVer: '1' });
  const env1 = makeEnv(log1);
  const cookie = (await login(worker, env1)).headers.get('Set-Cookie').split(';')[0];
  const ok = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env1);
  assert.equal(ok.status, 200, '⛔ الجلسة لازم تكون صالحة قبل التدوير ⭐ — got ' + ok.status);

  /* ⭐ نسخة ٢ ⭐ (بعد تغيير كلمة المرور ⭐) ⇒ ⛔ نفس الكوكي لازم يترفض ⭐ */
  const log2 = makeCallLog({ pwdVer: '2' });
  const env2 = makeEnv(log2);
  const after = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env2);
  assert.equal(after.status, 401,
    '⛔⛔⛔ بعد تغيير كلمة المرور ⭐ ⛔ الجلسة القديمة لازم تموت ⭐ — got ' + after.status);
});

test('R26-S-27: ⭐ نفس النسخة ⭐ ⇒ نفس الكوكي يفضل صالح ⭐ (مافيش إبطال عشوائي)', async () => {
  const worker = loadWorker();
  const log1 = makeCallLog({ pwdVer: '7' });
  const env1 = makeEnv(log1);
  const cookie = (await login(worker, env1)).headers.get('Set-Cookie').split(';')[0];
  const log2 = makeCallLog({ pwdVer: '7' });
  const env2 = makeEnv(log2);
  const res = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env2);
  assert.equal(res.status, 200,
    '⛔ نفس النسخة ⭐ ⇒ ⭐ لازم تفضل صالحة ⭐ (وإلا ⇒ ⛔ إبطال عشوائي ⭐) — got ' + res.status);
});
