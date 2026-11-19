/* ═══════════════════════════════════════════════════════════════════════
   🛡️🛡️ الجولة ٢٥ (R25 · المرحلة ٣) — صفحة دخول لوحة الإدارة ما تبقاش
   في حلقة إعادة توجيه ⭐ (الإصدار المرشح لازم يخلّي المالك يدخل ⭐).

   📌 القصة ⭐: نشر لوحة الإدارة بالـWorker الجديد ⭐ ⇒ راوتر الأصول
      (`html_handling: auto-trailing-slash`) بيعيد توجيه `/login.html` ⭐
      ⇒ `/login.html/` ⭐ ⇒ ⛔ والعامل مش بيعدّه public ⭐ ⇒ ⛔ حلقة ⭐
      ⇒ ⛔ المالك مش بيقدر يدخل اللوحة ⭐ ⇒ ⛔ ده **تعطّل إنتاج** ⭐.

   📌 المطلوب ⭐:
      ① كل صيغ مسار الدخول public ⭐ (من غير جلسة ⭐).
      ② المسار اللي العامل بيعيد التوجيه عليه لازم يكون public ⭐.
      ③ إعدادات الأصول ما تعيدش التوجيه ⭐ (`html_handling: none` ⭐).

   📌 التشغيل: node --test assets/tests/r25-login-path.test.js
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
    'Headers', 'URL', 'crypto', src);
  fn(mod, mod.exports, Request, Response, Headers, URL, crypto);
  return mod.exports;
}

function makeEnv() {
  return {
    APP_PASSWORD: 'synthetic-password',
    SESSION_SECRET: 'synthetic-secret',
    OCTA_ADMIN_TOKEN: 'synthetic-token',
    APP_ENV: 'production',
    ASSETS: {
      fetch: async (req) => {
        const p = new URL(req.url).pathname;
        if (p.includes('login')) {
          return new Response('<!doctype html><html><body>login</body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        return new Response('<!doctype html><html><body>panel</body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      },
    },
  };
}

function req(p, opts = {}) {
  return new Request('https://mgmt.invalid' + p, opts);
}

const HTML = { headers: { Accept: 'text/html,application/xhtml+xml' } };

/* ① كل صيغ مسار الدخول public ⭐ */
test('R25-LOGIN-01: every login path is served without a session', async () => {
  const worker = loadWorker();
  const env = makeEnv();
  for (const p of ['/login.html', '/login.html/']) {
    const res = await worker.fetch(req(p, HTML), env);
    assert.equal(res.status, 200,
      '⛔⛔⛔ مسار الدخول «' + p + '» مش public ⭐ (المالك مش هيقدر يدخل ⭐) — status ' + res.status);
  }
  /* ⛔⛔⛔ غير صفحات الدخول ⇒ ⛔ **مش** public ⭐ (قاعدة R18 ⭐)
     ⛔ (لوحة الإدارة HTML ما يتفتحش لزائر ⭐). */
  for (const p of ['/login', '/login/', '/index.html']) {
    const res = await worker.fetch(req(p, HTML), env);
    assert.notEqual(res.status, 200,
      '⛔⛔⛔ «' + p + '» رجّع ٢٠٠ من غير جلسة ⭐ ⇒ صفحة محمية اتكشفت ⭐');
  }
});

/* ② المسار المحمي بيرجّع 302 لصفحة الدخول ⭐ — وصفحة الدخول public ⭐ */
test('R25-LOGIN-02: the redirect target of a protected page is itself public', async () => {
  const worker = loadWorker();
  const env = makeEnv();
  const res = await worker.fetch(req('/', HTML), env);
  assert.equal(res.status, 302, '⛔ صفحة محمية ⇒ لازم 302 لصفحة الدخول ⭐');
  const loc = new URL(res.headers.get('Location'));
  const follow = await worker.fetch(req(loc.pathname + loc.search, HTML), env);
  assert.equal(follow.status, 200,
    '⛔⛔⛔ وجهة التحويل مش public ⭐ ⇒ حلقة ⭐ — status ' + follow.status);
});

/* ③ الأصول ما تعيدش التوجيه ⭐ */
test('R25-LOGIN-03: the assets config must not redirect the login page', async () => {
  const cfg = fs.readFileSync(path.join(ROOT, 'mgmt', 'wrangler.jsonc'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
  const parsed = JSON.parse(cfg);
  const assets = parsed.assets || {};
  assert.notEqual(assets.html_handling, 'auto-trailing-slash',
    '⛔⛔⛔ `auto-trailing-slash` بيعيد توجيه `/login.html` ⭐ ⇒ حلقة ⭐ — لازم `none` ⭐');
  assert.equal(assets.html_handling, 'none',
    '⛔ لازم `html_handling: none` ⭐');
  assert.equal(assets.run_worker_first, true,
    '⛔ لازم `run_worker_first` ⭐ (العامل لازم يشوف كل طلب ⭐)');
});
