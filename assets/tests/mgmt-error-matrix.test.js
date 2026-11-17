/* ══════════════════════════════════════════════════════════════════════
   🛡️ الجولة ١٩ (المرحلة ٢) — مصفوفة أخطاء لوحة الإدارة
   ──────────────────────────────────────────────────────────────────────
   📌 المطلوب: «اختبر حالات 429 و401 و403 و503 وانقطاع الاتصال
      والاستجابات غير الصالحة» + «⛔ لا تمسح جلسة المستخدم بسبب فشل الشبكة».

   📌 القاعدة:
      • رفض صريح (401) ⇒ ⛔ الجلسة اتقفلت ⇒ تنظيف + صفحة دخول.
      • 429 / 403 / 503 ⇒ ⛔ الجلسة سليمة ⇒ رسالة خطأ + إعادة محاولة.
      • انقطاع الشبكة ⇒ ⛔ ⛔ ممنوع logout ⛔ ممنوع مسح بيانات.
      • رد مش JSON ⇒ ⛔ خطأ واضح + ⛔ مافيش logout.

   ⛔ مافيش شبكة · مافيش نشر.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'mgmt/public/app.js'), 'utf8');

function slice(from, to, optional) {
  const i = SRC.indexOf(from);
  if (i === -1) {
    if (optional) return '';
    assert.fail('مش لاقي ' + from);
  }
  const j = SRC.indexOf(to, i);
  if (j === -1) {
    if (optional) return '';
    assert.fail('مش لاقي نهاية ' + from);
  }
  return SRC.slice(i, j);
}

/**
 * ⭐ يشغّل pullRemote + checkSession في بيئة معزولة ويبعت رد معيّن.
 */
function harness(status, opts = {}) {
  const calls = { login: 0, toast: [], status: [], rendered: 0, cleared: 0, removed: [] };
  const localStorage = {
    getItem: () => null,
    setItem: (k) => { calls.removed.push(k); },
    removeItem: (k) => { calls.cleared++; calls.removed.push(k); },
  };
  const sb = {
    LS_SNAP: 'octa_mgmt_snapshot',
    LS_PREF: 'octa_mgmt_prefs',
    API: '/api/proxy?path=',
    SW_URL: '/sw.js',
    state: { ready: false, offline: false, interval: 300000, countdown: 0, lastSync: 0, lastError: '' },
    localStorage,
    window: { addEventListener() { }, D: null },
    document: { addEventListener() { }, getElementById: () => null, body: { classList: { add() { } } } },
    navigator: { onLine: true },
    fetch: async (url) => {
      calls.lastUrl = String(url);
      if (opts.networkDown) throw new Error('network down');
      if (opts.badJson) return new Response('<html>مش JSON', { status: 200 });
      return new Response(JSON.stringify({ ok: true }), { status });
    },
    showLogin: () => { calls.login++; },
    clearSensitive: () => { calls.cleared++; },
    toast: (m, k) => { calls.toast.push([m, k]); },
    setStatus: (m, k) => { calls.status.push([m, k]); },
    boot2: () => { calls.rendered++; },
    console,
    setTimeout: () => { },   /* ⛔ مافيش إعادة محاولة في الاختبار */
    clearInterval: () => { },
    setInterval: () => { },
    startTimer: () => { },
    paintLive: () => { },
    pull: () => { },
    registerSW: () => { },
    window_addEventListener: () => { },
    /* ⛔ أزرار الإقلاع (bind) — لازم نوفّرها عشان الشريحة تتنفّذ */
    doLogin: () => { },
    doInstall: () => { },
    showInstallHelp: () => { },
    openSettings: () => { },
    closeSettings: () => { },
    doLogout: () => { },
    exportAll: () => { },
    checkUpdate: () => { },
    loadSnap: () => null,
    $: () => null,
  };
  sb.window.Panel = { setData() { }, render() { } };
  const body = slice('  function pullRemote(path) {', '  function pull(');
  /* ⛔ الدالة **الحقيقية** (مش stub) ⇒ القياس بيبصّ السلوك الفعلي */
  const offlineFn = slice('  function maybeOffline() {', '  function boot2(', true);
  const clearFn = slice('  function clearSensitive() {', '  function saveSnap() {', true);
  const bootFn = slice('  function boot() {', "  document.addEventListener('DOMContentLoaded'");
  vm.runInNewContext(clearFn + '\n' + body + '\n' + offlineFn + '\n' + bootFn, sb);
  return { sb, calls };
}

test('المرحلة ٢ — 429: رسالة خطأ + ⛔ الجلسة سليمة (مافيش logout)', async () => {
  const { sb, calls } = harness(429);
  let err = null;
  await sb.pullRemote('/api/admin/users').catch((e) => { err = e; });
  assert.ok(err, 'لازم يبقى فيه خطأ');
  assert.equal(calls.login, 0, '⛔ 429 مش رفض جلسة ⇒ ممنوع نوري اللوحة تاني');
  assert.equal(calls.cleared, 0, '⛔ ممنوع نمسح بيانات محلية');
});

test('المرحلة ٢ — 403: نفس القاعدة (الجلسة سليمة)', async () => {
  const { sb, calls } = harness(403);
  let err = null;
  await sb.pullRemote('/api/admin/users').catch((e) => { err = e; });
  assert.ok(err, 'لازم يبقى فيه خطأ');
  assert.equal(calls.login, 0, '⛔ 403 مش رفض جلسة');
  assert.equal(calls.cleared, 0, '⛔ ممنوع نمسح بيانات محلية');
});

test('المرحلة ٢ — 503: نفس القاعدة (الجلسة سليمة)', async () => {
  const { sb, calls } = harness(503);
  let err = null;
  await sb.pullRemote('/api/admin/users').catch((e) => { err = e; });
  assert.ok(err, 'لازم يبقى فيه خطأ');
  assert.equal(calls.login, 0, '⛔ 503 مش رفض جلسة');
  assert.equal(calls.cleared, 0, '⛔ ممنوع نمسح بيانات محلية');
});

test('المرحلة ٢ — 401: رفض صريح ⇒ تنظيف + صفحة دخول (ومفيش عرض بيانات)', async () => {
  const { sb, calls } = harness(401);
  let err = null;
  await sb.pullRemote('/api/admin/users').catch((e) => { err = e; });
  assert.ok(err, 'لازم يبقى فيه خطأ');
  assert.equal(calls.login, 1, '401 ⇒ صفحة الدخول');
  assert.ok(calls.cleared >= 1, '401 ⇒ لازم نمسح البيانات المحلية الحسّاسة');
});

test('المرحلة ٢ — انقطاع الشبكة: ⛔⛔ ممنوع يمسح جلسة المستخدم', async () => {
  const { sb, calls } = harness(0, { networkDown: true });
  let err = null;
  await sb.pullRemote('/api/admin/users').catch((e) => { err = e; });
  assert.ok(err, 'لازم يبقى فيه خطأ');
  assert.equal(calls.login, 0, '⛔⛔ انقطاع شبكة ≠ رفض جلسة ⇒ ممنوع logout');
  assert.equal(calls.cleared, 0, '⛔⛔ ممنوع نمسح بيانات المستخدم');
});

test('المرحلة ٢ — رد غير صالح (مش JSON): خطأ واضح + ⛔ مافيش logout', async () => {
  const { sb, calls } = harness(200, { badJson: true });
  let err = null;
  await sb.pullRemote('/api/admin/users').catch((e) => { err = e; });
  assert.ok(err, 'لازم يبقى فيه خطأ');
  assert.match(String(err && err.message), /رد غير صالح/);
  assert.equal(calls.login, 0, '⛔ رد غير صالح مش رفض جلسة');
  assert.equal(calls.cleared, 0, '⛔ ممنوع نمسح بيانات محلية');
});

test('المرحلة ٢ — فحص الجلسة: انقطاع الشبكة ⇒ ⛔ مافيش صفحة دخول + ⛔ مافيش مسح', async () => {
  const { sb, calls } = harness(0, { networkDown: true });
  sb.boot();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.login, 0, '⛔⛔ انقطاع شبكة ⇒ ممنوع نوري صفحة الدخول');
  assert.equal(calls.cleared, 0, '⛔⛔ ممنوع نمسح بيانات المستخدم');
  assert.equal(calls.rendered, 0, 'مافيش بيانات من غير جلسة');
  assert.ok(calls.status.length > 0, 'لازم رسالة حالة للمستخدم');
});

test('المرحلة ٢ — فحص الجلسة: 401 ⇒ تنظيف + صفحة دخول + ⛔ مافيش عرض', async () => {
  const { sb, calls } = harness(401);
  sb.boot();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.login, 1, '401 ⇒ صفحة الدخول');
  assert.ok(calls.cleared >= 1, '401 ⇒ تنظيف البيانات المحلية');
  assert.equal(calls.rendered, 0, '⛔ ممنوع نعرض بيانات إدارة بعد الرفض');
});
