/* ═══════════════════════════════════════════════════════════════
 *  🧪 الجولة ٢٣ (R23) · حالات خطأ الدخول **محدّدة** ومختلفة
 *  ───────────────────────────────────────────────────────────────
 *  📌 المطلوب من المالك:
 *     «خطأ الشبكة» ≠ «PIN غلط» ≠ «الجلسة انتهت»
 *     + «فشل الشبكة ما يمسحش جلسة المستخدم».
 *  📌 الاختبارات **محدّدة** (deterministic) — مفيش شبكة.
 *  📌 التشغيل: node --test assets/tests/r23-login-error-states.test.js
 *  ═══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const GATE = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-gate.js'), 'utf8');

const API_DOWN_MSG = 'الخدمة مؤقتًا غير متاحة';
const API_DOWN_HINT = 'افحص حالة الخدمة';

/* ═══════════════════════════════════════════════════════════════
 *  🧰 أدوات استخراج من المصدر (نفس أسلوب اختبارات الجولة ١٨)
 *  ═══════════════════════════════════════════════════════════════ */
function extractFn(src, name) {
  const m = src.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
  assert.ok(m, 'مألقاش الدالة: ' + name);
  const start = src.indexOf('{', m.index);
  let depth = 0;
  for (let k = start; k < src.length; k++) {
    const c = src[k];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(m.index, k + 1);
    }
  }
  throw new Error('القوس مش مقفول: ' + name);
}

function extractBody(src, anchor, fnMarker) {
  const i = src.indexOf(anchor);
  assert.ok(i > -1, 'مألقاش الموضع: ' + anchor);
  const fi = src.indexOf(fnMarker, i);
  assert.ok(fi > -1, 'مألقاش الدالة: ' + fnMarker);
  const start = src.indexOf('{', fi);
  let depth = 0;
  for (let k = start; k < src.length; k++) {
    const c = src[k];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(start + 1, k);
    }
  }
  throw new Error('القوس مش مقفول: ' + anchor);
}

/* 📌 قاموس أخطاء الوجهة (من مصدر البوابة نفسه — مش نسخة hand-made) */
function extractObj(src, marker) {
  const i = src.indexOf(marker);
  assert.ok(i > -1, 'مألقاش: ' + marker);
  const start = src.indexOf('{', i + marker.length - 1);
  let depth = 0;
  for (let k = start; k < src.length; k++) {
    const c = src[k];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(start, k + 1);
    }
  }
  throw new Error('القوس مش مقفول: ' + marker);
}

/* ═══════════════════════════════════════════════════════════════
 *  🏃 تشغيل مسار الدخول (منفّذ · مش نص)
 *  ═══════════════════════════════════════════════════════════════ */
function runGateLogin(o) {
  const body = extractBody(GATE, "post('/api/auth/pin/login'", 'function (o)');
  const isApiDown = new Function('return (' + extractFn(GATE, 'isApiDown') + ')')();
  const FAULTS = new Function('return (' + extractObj(GATE, 'var ORIGIN_FAULTS = {') + ')')();
  const originFault = new Function('ORIGIN_FAULTS',
    'return (' + extractFn(GATE, 'originFault') + ')')(FAULTS);
  const originMsg = new Function('ORIGIN_FAULTS',
    'return (' + extractFn(GATE, 'originMsg') + ')')(FAULTS);
  const calls = {
    said: [], strikePush: 0, strikeReset: 0, recordTriedPin: 0,
    badPin: 0, locked: 0, askCode: 0, put: 0, shut: 0, logoutLocal: 0
  };
  const state = { tries: 1 };
  const flow = {};
  const fn = new Function(
    'o', 'p', 'state', 'isApiDown', 'API_DOWN_MSG', 'API_DOWN_HINT',
    'strikeReset', 'say', 'paintPad', 'locked', 'askCode', 'needCode',
    'recordTriedPin', 'strikePush', 'badPin', 'winLeft', 'STRIKE_LIMIT',
    'originFault', 'originMsg', 'flow', 'put', 'shut', 'logoutLocal', body);
  fn(o, '1234', state, isApiDown, API_DOWN_MSG, API_DOWN_HINT,
    function () { calls.strikeReset++; },
    function (t, ok) { calls.said.push(String(t)); },
    function () { },
    function () { calls.locked++; },
    function () { calls.askCode++; },
    function () { return false; },
    function () { calls.recordTriedPin++; },
    function () { calls.strikePush++; return 1; },
    function () { calls.badPin++; },
    function () { return 5; },
    5,
    originFault, originMsg, flow,
    function () { calls.put++; },
    function () { calls.shut++; },
    function () { calls.logoutLocal++; });
  return { calls: calls, state: state, flow: flow };
}

/* ═══════════════════════════════════════════════════════════════
 *  ①  حالات الخطأ **مختلفة** عن بعض
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-E1 · ⛔ فشل الشبكة ⇒ «الشبكة ضعيفة» (مش «الباسورد غلط»)', () => {
  const out = runGateLogin({ s: 0, d: {} });
  assert.equal(out.calls.said.length, 1, 'لازم رسالة واحدة');
  const m = out.calls.said[0];
  assert.ok(m.indexOf('الشبكة ضعيفة') > -1, 'الرسالة غلط: ' + m);
  assert.equal(out.calls.badPin, 0, 'اتعرضت شاشة «الباسورد غلط»');
  assert.equal(out.calls.strikePush, 0, 'المحاولة اتحسبت على المستخدم');
});

test('R23-E1 · ⛔ PIN غلط ⇒ شاشة «الباسورد غلط» (مش رسالة شبكة)', () => {
  const out = runGateLogin({ s: 401, d: { ok: false, why: 'bad_pin' } });
  assert.equal(out.calls.badPin, 1, 'لازم شاشة الباسورد الغلط');
  assert.equal(out.calls.said.length, 0, 'مفيش رسالة شبكة');
  assert.equal(out.calls.strikePush, 1, 'المحاولة الغلط تتحسب');
});

test('R23-E1 · ⛔ البنية نازلة (503) ⇒ رسالة محدّدة (مش «باسورد غلط»)', () => {
  const out = runGateLogin({
    s: 503, d: { ok: false, error: 'الخدمة مؤقتًا غير متاحة', why: 'api_unreachable' }
  });
  assert.equal(out.calls.said.length, 1);
  const m = out.calls.said[0];
  assert.ok(m.indexOf(API_DOWN_MSG) > -1, 'الرسالة غلط: ' + m);
  assert.ok(m.indexOf(API_DOWN_HINT) > -1, 'الرسالة غلط: ' + m);
  assert.equal(out.calls.badPin, 0);
  assert.equal(out.calls.strikePush, 0, 'المحاولة اتحسبت على المستخدم');
});

test('R23-E1 · ⛔ خطأ الوجهة (DNS) ⇒ رسالة **مختلفة** عن الشبكة', () => {
  const out = runGateLogin({ s: 0, d: {}, why: 'origin_dns_error' });
  assert.equal(out.calls.said.length, 1);
  const m = out.calls.said[0];
  assert.ok(m.indexOf('DNS') > -1, 'الرسالة لازم تذكر DNS: ' + m);
  assert.equal(m.indexOf('الشبكة ضعيفة'), -1, 'رسالة الشبكة اتلخبطت بالوجهة');
  assert.equal(out.calls.badPin, 0, 'اتعرضت شاشة «الباسورد غلط»');
});

test('R23-E1 · ⛔ خطأ الوجهة (مش رادّة) ⇒ رسالة **مختلفة** عن الشبكة', () => {
  const out = runGateLogin({ s: 0, d: {}, why: 'origin_unreachable' });
  assert.equal(out.calls.said.length, 1);
  const m = out.calls.said[0];
  assert.ok(m.indexOf('مش رادّة') > -1, 'الرسالة غلط: ' + m);
  assert.equal(m.indexOf('الشبكة ضعيفة'), -1, 'رسالة الشبكة اتلخبطت بالوجهة');
});

test('R23-E1 · ⛔ المعاينة المقفولة ⇒ رسالة **مختلفة** عن الشبكة', () => {
  const out = runGateLogin({ s: 0, d: {}, why: 'origin_missing' });
  assert.equal(out.calls.said.length, 1);
  const m = out.calls.said[0];
  assert.ok(m.indexOf('مقفولة') > -1, 'الرسالة غلط: ' + m);
  assert.equal(m.indexOf('الشبكة ضعيفة'), -1, 'رسالة الشبكة اتلخبطت');
});

test('R23-E1 · ⛔ الفصل بين كل الحالات: النصوص مختلفة تماماً', () => {
  const msgs = [
    runGateLogin({ s: 0, d: {} }).calls.said[0],
    runGateLogin({ s: 0, d: {}, why: 'origin_dns_error' }).calls.said[0],
    runGateLogin({ s: 0, d: {}, why: 'origin_unreachable' }).calls.said[0],
    runGateLogin({ s: 0, d: {}, why: 'origin_missing' }).calls.said[0],
    runGateLogin({
      s: 503, d: { why: 'api_unreachable' }
    }).calls.said[0]
  ];
  const uniq = new Set(msgs);
  assert.equal(uniq.size, msgs.length, 'في رسالتين متطابقتين: ' + JSON.stringify(msgs));
});

/* ═══════════════════════════════════════════════════════════════
 *  ②  ⛔ فشل الشبكة ما يمسحش جلسة المستخدم
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-E2 · ⛔ فشل الشبكة ⇒ مافيش مسح للجلسة (ولا خصم من المحاولات)', () => {
  const out = runGateLogin({ s: 0, d: {} });
  assert.equal(out.calls.logoutLocal, 0, 'الجلسة اتمسحت');
  assert.equal(out.calls.put, 0, 'حطّ توكن');
  assert.equal(out.calls.shut, 0, 'قفل البوابة');
  assert.equal(out.calls.strikeReset, 1, 'العدّاد المفروض يرجع صفر');
});

test('R23-E2 · ⛔ خطأ الوجهة ⇒ برضه مافيش مسح للجلسة', () => {
  const out = runGateLogin({ s: 0, d: {}, why: 'origin_dns_error' });
  assert.equal(out.calls.logoutLocal, 0, 'الجلسة اتمسحت');
  assert.equal(out.calls.strikePush, 0, 'المحاولة اتحسبت');
});

test('R23-E2 · ⛔ السيرفر نازل (5xx) ⇒ التوكن يفضل مكانه', () => {
  /* 📌 البوابة: 5xx = السيرفر واقع ⇒ تصفح بدون تسجيل + التوكن يفضل.
     ⛔ masحش ولا واحدة (401/403 بس هم اللي بيمسحوا). */
  const region = extractBody(GATE, 'if (r.status >= 500) {', 'function');
  assert.equal(region.indexOf('logoutLocal'), -1,
    'السيرفر النازل مسح الجلسة (لازم ما يحصلش)');
  assert.ok(region.indexOf('octa_allow_browse') > -1,
    'لازم يفتح التصفح بدون تسجيل');
});

test('R23-E2 · ⛔ مسار فشل الشبكة (catch) ⇒ مافيش logoutLocal', () => {
  const region = extractBody(GATE, '}).catch(function () {', 'function');
  assert.equal(region.indexOf('logoutLocal'), -1,
    'فشل الشبكة مسح الجلسة (لازم ما يحصلش)');
});

/* ═══════════════════════════════════════════════════════════════
 *  ③  ⛔ انتهاء الجلسة ⇒ حالة **مختلفة** (ومسح مقصود)
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-E3 · ⛔ انتهاء الجلسة ⇒ رسالة «انتهت جلستك» (مختلفة عن PIN غلط)', () => {
  const body = extractBody(GATE, 'window.OCTAAuthFail = function (path)', 'function (path)');
  const calls = { logoutLocal: 0, appended: [] };
  const fakeEl = { innerHTML: '', style: {}, setAttribute() { }, remove() { } };
  const doc = {
    getElementById: () => null,
    createElement: () => fakeEl,
    body: { appendChild: (el) => { calls.appended.push(el); } }
  };
  const win = { __octaAuthFailShown: false, document: doc };
  const fn = new Function('window', 'document', 'logoutLocal', 'welcome', 'open', body);
  fn(win, doc,
    function () { calls.logoutLocal++; },
    function () { },
    function () { });
  assert.equal(calls.logoutLocal, 1, 'انتهاء الجلسة ⇒ مسح مقصود');
  assert.ok(fakeEl.innerHTML.indexOf('انتهت جلستك') > -1,
    'مفيش رسالة انتهاء الجلسة: ' + fakeEl.innerHTML.slice(0, 120));
  assert.equal(fakeEl.innerHTML.indexOf('الباسورد غلط'), -1,
    'رسالة انتهاء الجلسة اتلخبطت برسالة الباسورد الغلط');
});

test('R23-E3 · ⛔ ثلاث حالات الخطأ نصوصها مختلفة (شبكة · PIN · انتهاء جلسة)', () => {
  const netMsg = runGateLogin({ s: 0, d: {} }).calls.said[0];
  const pinMsg = GATE.match(/say\('❌ الباسورد غلط[^']*'/);
  const expMsg = GATE.match(/>([^<]*انتهت جلستك[^<]*)</);
  assert.ok(pinMsg, 'مألقاش رسالة الباسورد الغلط');
  assert.ok(expMsg, 'مألقاش رسالة انتهاء الجلسة');
  const pin = pinMsg[0];
  const exp = expMsg[1];
  assert.notEqual(netMsg, pin, 'رسالة الشبكة = رسالة الباسورد الغلط');
  assert.notEqual(netMsg, exp, 'رسالة الشبكة = رسالة انتهاء الجلسة');
  assert.notEqual(pin, exp, 'رسالة الباسورد الغلط = رسالة انتهاء الجلسة');
});

/* ═══════════════════════════════════════════════════════════════
 *  ④  ⛔ المودال (octa-auth.js) — نفس المبدأ
 *  ═══════════════════════════════════════════════════════════════ */
test('R23-E4 · ⛔ المودال: خطأ الوجهة ⇒ رسالة محدّدة (مش «الاتصال فشل»)', () => {
  const AUTH = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-auth.js'), 'utf8');
  const body = extractBody(AUTH, "fetch(apiBase() + '/api/auth/register'", 'function (o)');
  const calls = { said: [], setUser: 0 };
  const go = { disabled: true, textContent: '' };
  const h = { remove: function () { } };
  const fn = new Function(
    'o', 'msg', 'setUser', 'octaTrack', 'h', 'OCTAAuth', 'go', 'isLogin',
    'API_DOWN_MSG', 'API_DOWN_HINT', body);
  fn({ s: 503, d: { ok: false, why: 'api_unreachable' } },
    function (t, ok) { calls.said.push(String(t)); },
    function () { calls.setUser++; },
    function () { },
    h,
    { refresh: function () { } },
    go,
    true,
    API_DOWN_MSG, API_DOWN_HINT);
  assert.equal(calls.said.length, 1);
  assert.ok(calls.said[0].indexOf(API_DOWN_MSG) > -1, 'الرسالة غلط: ' + calls.said[0]);
  assert.equal(calls.setUser, 0, 'ما دخلناش باسم');
});

test('R23-E4 · ⛔ المودال: الخطأ العادي بيفضل «حصل خطأ» (ما اتغيّرش)', () => {
  const AUTH = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-auth.js'), 'utf8');
  const body = extractBody(AUTH, "fetch(apiBase() + '/api/auth/register'", 'function (o)');
  const calls = { said: [] };
  const go = { disabled: true, textContent: '' };
  const h = { remove: function () { } };
  const fn = new Function(
    'o', 'msg', 'setUser', 'octaTrack', 'h', 'OCTAAuth', 'go', 'isLogin',
    'API_DOWN_MSG', 'API_DOWN_HINT', body);
  fn({ s: 400, d: { ok: false, error: 'الكود قصير' } },
    function (t, ok) { calls.said.push(String(t)); },
    function () { },
    function () { },
    h,
    { refresh: function () { } },
    go,
    true,
    API_DOWN_MSG, API_DOWN_HINT);
  assert.equal(calls.said.length, 1);
  assert.ok(calls.said[0].indexOf('الكود قصير') > -1, 'الرسالة اتغيّرت: ' + calls.said[0]);
});
