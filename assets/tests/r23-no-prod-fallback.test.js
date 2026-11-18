/* ═══════════════════════════════════════════════════════════════
 *  🧪 الجولة ٢٣ (R23) · المعاينة ما ترجعش للإنتاج بصمت
 *  ───────────────────────────────────────────────────────────────
 *  📌 المطلوب من المالك (صريح):
 *     «مفيش رجوع صامت لواجهة الإنتاج API لو وجهة المعاينة broke».
 *  📌 الاختبار ده **سلوكي**: بيشغّل octa-api.js جوّه بيئة معزولة
 *     (vm) وبيراقب كل URL بيطلع — مفيش شبكة خالص.
 *  📌 السيناريوهات:
 *     ① المعاينة + وجهة مقفولة ⇒ مافيش أي طلب بيخرج.
 *     ② المعاينة + قائمة مباشرة فيها الإنتاج ⇒ التطبيق ما بيستخدمهاش.
 *     ③ الـfailover ما بيحوّلش للإنتاج.
 *  📌 التشغيل: node --test assets/tests/r23-no-prod-fallback.test.js
 *  ═══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const API_JS = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-api.js'), 'utf8');

const PROD = 'https://octa-prices-production-4ccb.up.railway.app';
const PROD_HOST = 'octa-prices-production-4ccb.up.railway.app';
const PREVIEW_HOST = 'octa-preview.ahmed3zz2020.workers.dev';

/* ═══════════════════════════════════════════════════════════════
 *  🧰 بيئة معزولة (مفيش شبكة — fetch وهمية بتسجّل كل URL)
 *  ═══════════════════════════════════════════════════════════════ */
function makeEnv(opts) {
  const o = opts || {};
  const calls = [];
  const fakeFetch = function (url) {
    calls.push(String(url));
    return Promise.resolve(new Response('{"ok":true}', {
      status: 200, headers: { 'Content-Type': 'application/json' }
    }));
  };
  const store = {};
  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  const doc = {
    readyState: 'complete',
    createElement: () => ({ style: {}, setAttribute() { }, appendChild() { }, remove() { } }),
    head: { appendChild() { } },
    documentElement: { setAttribute() { }, removeAttribute() { } },
    getElementById: () => null,
    addEventListener() { },
    querySelector: () => null
  };
  const location = {
    hostname: o.hostname || PREVIEW_HOST,
    origin: 'https://' + (o.hostname || PREVIEW_HOST),
    protocol: 'https:',
    href: 'https://' + (o.hostname || PREVIEW_HOST) + '/'
  };
  const win = {
    fetch: fakeFetch,
    location,
    localStorage,
    document: doc,
    addEventListener() { },
    setTimeout, clearTimeout, setInterval, clearInterval,
    console: { log() { }, warn() { }, error() { } },
    Response, Headers, URL, AbortController
  };
  win.window = win;
  if (o.failClosed) win.OCTA_FAIL_CLOSED = 1;
  if (o.directList) win.OCTA_DIRECT_LIST = o.directList;

  const sandbox = {
    window: win,
    document: doc,
    localStorage,
    location,
    fetch: fakeFetch,
    console: win.console,
    Response, Headers, URL, AbortController,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Promise, JSON, Math, Date, Object, Array, String, Number, Boolean,
    isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    Error, TypeError, RegExp
  };
  vm.createContext(sandbox);
  vm.runInContext(API_JS, sandbox);
  return { sandbox: sandbox, win: win, calls: calls };
}

/* 📌 حارس «مكسور» (وجهة المعاينة مش شغّالة) */
function brokenGuard(code) {
  const c = code || 'origin_dns_error';
  return {
    mode: 'preview',
    state: () => ({ mode: 'preview', blocked: true, code: c, verdict: { ok: false, code: c } }),
    check: () => ({ ok: false, code: c, message: 'وجهة الخدمة مش موجودة (DNS) — النفق انتهى' }),
    checkHost: () => ({ ok: true, code: 'ok' }),
    allowOrigin: () => ({ ok: false, code: c }),
    showBanner: () => { },
    hideBanner: () => { },
    classify: () => c,
    messageFor: () => 'x'
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  ①  المعاينة المقفولة ⇒ مافيش طلب بيخرج
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-F1 · ⛔ المعاينة المقفولة ⇒ مافيش أي نداء API بيخرج', async () => {
  const env = makeEnv({ hostname: PREVIEW_HOST, failClosed: true });
  env.win.OCTA_ORIGIN_GUARD = brokenGuard('origin_dns_error');
  let err = null;
  await env.win.fetch('/api/auth/pin/login', { method: 'POST' }).catch((e) => { err = e; });
  assert.ok(err, 'الطلب لازم يترفض');
  assert.ok(err.octaGuard, 'الخطأ لازم يحمل سبب الحارس');
  assert.equal(err.octaGuard.code, 'origin_dns_error');
  assert.equal(env.calls.length, 0, 'مافيش طلب المفروض يطلع: ' + JSON.stringify(env.calls));
});

/* ═══════════════════════════════════════════════════════════════
 *  ②  ⛔ مفيش ارتجاع صامت للإنتاج
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-F2 · ⛔ المعاينة + قائمة فيها الإنتاج ⇒ التطبيق ما بيستخدمهاش', () => {
  const env = makeEnv({
    hostname: PREVIEW_HOST,
    directList: [{ name: 'production', url: PROD, on: true }]
  });
  assert.notEqual(env.win.OCTA_DIRECT, PROD, 'الوجهة المباشرة اتحوّلت للإنتاج');
  assert.equal(env.win.OCTA_DIRECT, '', 'في المعاينة لازم يبقى فاضي (fail closed)');
  assert.notEqual(env.win.OCTAServer.current().url, PROD, 'السيرفر الحالي للإنتاج');
});

test('R23-F2 · ⛔ الـfailover ما بيحوّلش للإنتاج', () => {
  const env = makeEnv({
    hostname: PREVIEW_HOST,
    directList: [
      { name: 'preview', url: 'https://octa-preview-api.up.railway.app', on: true },
      { name: 'production', url: PROD, on: true }
    ]
  });
  env.win.OCTAServer.failover();
  const cur = env.win.OCTAServer.current().url;
  assert.notEqual(cur, PROD, 'الـfailover حوّل للإنتاج');
});

test('R23-F2 · ⛔ حتى بدور Gateway ⇒ ما بيقدرش يعمل طلب للإنتاج', async () => {
  const env = makeEnv({ hostname: PREVIEW_HOST, failClosed: true });
  env.win.OCTA_ORIGIN_GUARD = brokenGuard('origin_dns_error');
  let err = null;
  await env.win.fetch(PROD + '/api/prices').catch((e) => { err = e; });
  assert.ok(err, 'الطلب للإنتاج لازم يترفض');
  assert.equal(env.calls.length, 0, 'مافيش طلب طلع للإنتاج');
});

test('R23-F2 · ⛔ من غير الحارس (لسه بيحمّل) ⇒ شبكة الأمان بتمنع الإنتاج', async () => {
  const env = makeEnv({ hostname: PREVIEW_HOST, failClosed: true });
  /* ⛔ مافيش OCTA_ORIGIN_GUARD — الحارس لسه بيحمّل
     ⛔ بس شبكة الأمان (المضيف) لازم تمنع الإنتاج فوراً */
  let err = null;
  await env.win.fetch(PROD + '/api/prices').catch((e) => { err = e; });
  assert.ok(err, 'الطلب للإنتاج لازم يترفض');
  assert.ok(err.octaGuard, 'لازم يكون فيه سبب');
  assert.equal(err.octaGuard.code, 'production_origin_in_preview');
  assert.equal(env.calls.length, 0, 'مافيش طلب طلع للإنتاج');
});

/* ═══════════════════════════════════════════════════════════════
 *  ③  ⛔ الإنتاج ما يستعملش وجهة المعاينة
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-F3 · ⛔ الإنتاج + failover لوجهة المعاينة ⇒ اتمنع', () => {
  const env = makeEnv({
    hostname: 'octashares.com',
    directList: [
      { name: 'production', url: PROD, on: true },
      { name: 'preview', url: 'https://octa-preview-api.up.railway.app', on: true }
    ]
  });
  const before = env.win.OCTAServer.current().url;
  assert.equal(before, PROD, 'الإنتاج لازم يبدأ على الإنتاج');
  env.win.OCTAServer.failover();
  const after = env.win.OCTAServer.current().url;
  assert.notEqual(after, 'https://octa-preview-api.up.railway.app',
    'الإنتاج اتحوّل لوجهة المعاينة');
});

test('R23-F3 · ⛔ الإنتاج: نداء مباشر لوجهة المعاينة ⇒ اتمنع', async () => {
  const env = makeEnv({ hostname: 'octashares.com' });
  env.win.OCTA_ORIGIN_GUARD = {
    mode: 'production',
    state: () => ({ mode: 'production', blocked: false, code: 'ok' }),
    check: (u) => {
      const h = String(u || '');
      if (h.indexOf('octa-preview-api.up.railway.app') > -1) {
        return { ok: false, code: 'preview_origin_in_production', message: 'الإنتاج ممنوع من المعاينة' };
      }
      return { ok: true, code: 'ok' };
    },
    checkHost: () => ({ ok: true, code: 'ok' }),
    allowOrigin: () => ({ ok: true, code: 'ok' }),
    showBanner: () => { }, hideBanner: () => { },
    classify: () => 'network', messageFor: () => 'x'
  };
  let err = null;
  await env.win.fetch('https://octa-preview-api.up.railway.app/api/prices').catch((e) => { err = e; });
  assert.ok(err, 'الطلب لازم يترفض');
  assert.equal(err.octaGuard.code, 'preview_origin_in_production');
});

/* ═══════════════════════════════════════════════════════════════
 *  ④  الإنتاج ما يتأثرش — نفس الأصل شغال زي ما هو
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-F4 · ⛔ الإنتاج: نداء عادي لنفس الأصل ⇒ يعدّي عادي', async () => {
  const env = makeEnv({ hostname: 'octashares.com', failClosed: true });
  env.win.OCTA_ORIGIN_GUARD = {
    mode: 'production',
    state: () => ({ mode: 'production', blocked: false, code: 'ok' }),
    check: () => ({ ok: true, code: 'ok' }),
    checkHost: () => ({ ok: true, code: 'ok' }),
    allowOrigin: () => ({ ok: true, code: 'ok' }),
    showBanner: () => { }, hideBanner: () => { },
    classify: () => 'network', messageFor: () => 'x'
  };
  const r = await env.win.fetch('/api/health');
  assert.equal(r.status, 200);
  assert.equal(env.calls.length, 1, 'الطلب المفروض يطلع مرة واحدة');
});

/* ═══════════════════════════════════════════════════════════════
 *  ⑤  الفحص الساكن — البنية فيها فعلاً الحارس
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-F5 · ⛔ الـfailover بيستشير الحارس قبل ما يبدّل', () => {
  assert.ok(/failover:[\s\S]{0,900}_guardAllow\(SERVERS\[i\]\.url\)/.test(API_JS),
    'الـfailover لازم يستشير الحارس');
});

test('R23-F5 · ⛔ اختيار السيرفر النشط بيستشير الحارس', () => {
  assert.ok(/function base\(\)[\s\S]{0,900}_guardAllow\(SERVERS\[i\]\.url\)/.test(API_JS),
    'base() لازم يستشير الحارس');
});

test('R23-F5 · ⛔ الـfailover المباشر (direct) بيستشير الحارس', () => {
  assert.ok(/function _directUrl\(s\)[\s\S]{0,600}_guardAllow\(window\.OCTA_DIRECT\)/.test(API_JS),
    '_directUrl() لازم يستشير الحارس');
});
