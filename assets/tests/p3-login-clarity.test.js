/* ═══════════════════════════════════════════════════════════════
   🧪 الجولة ١٨ (P3) · وضوح رسالة «الخدمة مش متاحة» في شاشة الدخول
   ───────────────────────────────────────────────────────────────
   📌 العيب المقاس (تشخيص حيّ · ١٧ نوفمبر ٢٠٢٦):
      المعاينة كانت بترجّع 530 (Cloudflare 1016) على /api/auth/pin/login
      ⇒ الرد مش JSON ⇒ الواجهة وقعت في «كل حاجة تانية = الباسورد غلط»
      ⇒ **المستخدم بيتّهم بإيمه** + العدّاد بيتحرق (وقفل ٣٠ دقيقة).
      ⛔ وكمان: «مقدرناش نبعت الكود» (إيميل) بدل حقيقة إن البنية ميتة.

   📌 المطلوب بعد الإصلاح:
      ① الرد {why:'api_unreachable'} ⇒ رسالة عربية **محدّدة**
         («الخدمة مؤقتًا غير متاحة — جرّب بعد قليل» + «افحص حالة الخدمة»).
      ② ⛔ مافيش خصم من عدّاد المحاولات (مش خطأ باسورد).
      ③ ⛔ باقي الرسائل (شبكة · باسورد غلط · إيميل مكرر · mail_down)
         **ما تتغيّرش**.

   📌 التشغيل: node --test assets/tests/p3-login-clarity.test.js
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const GATE = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-gate.js'), 'utf8');
const AUTH = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-auth.js'), 'utf8');

/* ⛔ لازم يعنينا الكود العربي المحدد (مش أي رسالة) ⬇️ */
const MSG_MAINT = 'مؤقتًا غير متاحة';
const MSG_CHECK = 'افحص حالة الخدمة';

/* ⛔ يستخرج قاموس كائن من المصدر (مطابقة الأقواس) ⬇️ */
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

/* ⛔ يستخرج جسم دالة من المصدر (مطابقة الأقواس) ⬇️ */
function extractBody(src, anchor, fnMarker) {  const i = src.indexOf(anchor);
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

/* ⛔ يستخرج دالة باسم لاتيني من المصدر (نصها كامل) ⬇️ */
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

/* ═══════════════════════════════════════════════════════════════
   ①  الدالة المساعدة — سلوكها الحقيقي (منفّذة · مش نص) ⬇️
   ═══════════════════════════════════════════════════════════════ */
test('P3-L1 · isApiDown بتفرّق بين عطل البنية وعطل المستخدم', () => {
  const fnSrc = extractFn(GATE, 'isApiDown');
  const isApiDown = new Function('return (' + fnSrc + ')')();
  assert.equal(isApiDown({ why: 'api_unreachable' }), true, 'لازم true');
  assert.equal(isApiDown({ why: 'bad_pin' }), false, 'الباسورد الغلط مش بنية');
  assert.equal(isApiDown({ why: 'mail_down' }), false, 'عطل الإيميل مش بنية');
  assert.equal(isApiDown({ why: 'need_code' }), false);
  assert.equal(isApiDown({}), false);
  assert.equal(isApiDown(null), false);
  assert.equal(isApiDown(undefined), false);
});

/* ═══════════════════════════════════════════════════════════════
   ②  سلوك الدخول بالـPIN — **منفّذ** ⬇️
   ═══════════════════════════════════════════════════════════════ */
function runGateLogin(o) {
  const body = extractBody(GATE, "post('/api/auth/pin/login'", 'function (o)');
  const isApiDownSrc = extractFn(GATE, 'isApiDown');
  const isApiDown = new Function('return (' + isApiDownSrc + ')')();
  /* 🛡️ الجولة ٢٣ (R23) — دالة خطأ الوجهة (نفس قاموس البوابة) */
  const FAULTS = new Function('return (' + extractObj(GATE, 'var ORIGIN_FAULTS = {') + ')')();
  const originFault = new Function('ORIGIN_FAULTS',
    'return (' + extractFn(GATE, 'originFault') + ')')(FAULTS);
  const originMsg = new Function('ORIGIN_FAULTS',
    'return (' + extractFn(GATE, 'originMsg') + ')')(FAULTS);
  const calls = { said: [], strikePush: 0, strikeReset: 0, recordTriedPin: 0, badPin: 0, locked: 0, askCode: 0 };
  const state = { tries: 0 };
  const fn = new Function(
    'o', 'p', 'state', 'isApiDown', 'API_DOWN_MSG', 'API_DOWN_HINT',
    'strikeReset', 'say', 'paintPad', 'locked', 'askCode', 'needCode',
    'recordTriedPin', 'strikePush', 'badPin', 'winLeft', 'STRIKE_LIMIT',
    'originFault', 'originMsg',
    body);
  fn(o, '1234', state, isApiDown, 'الخدمة مؤقتًا غير متاحة — جرّب بعد قليل', MSG_CHECK,
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
    originFault, originMsg);
  return { calls: calls, state: state };
}

test('P3-L2 · رد api_unreachable ⇒ رسالة محدّدة (مش «باسورد غلط»)', () => {
  const out = runGateLogin({
    s: 503,
    d: { ok: false, error: 'الخدمة مؤقتًا غير متاحة', why: 'api_unreachable' },
  });
  assert.equal(out.calls.said.length, 1, 'لازم رسالة واحدة: ' + JSON.stringify(out.calls.said));
  const m = out.calls.said[0];
  assert.ok(m.indexOf(MSG_MAINT) > -1, 'الرسالة مفيهاش «مؤقتًا غير متاحة»: ' + m);
  assert.ok(m.indexOf(MSG_CHECK) > -1, 'الرسالة مفيهاش «افحص حالة الخدمة»: ' + m);
  assert.ok(m.indexOf('الباسورد غلط') === -1, 'قالت «الباسورد غلط»: ' + m);
  assert.ok(m.indexOf('السيرفر بطيء') === -1, 'قالت «السيرفر بطيء»: ' + m);
});

test('P3-L2 · رد api_unreachable ⇒ مافيش خصم من عدّاد المحاولات', () => {
  const out = runGateLogin({
    s: 503,
    d: { ok: false, error: 'الخدمة مؤقتًا غير متاحة', why: 'api_unreachable' },
  });
  assert.equal(out.calls.strikePush, 0, 'المحاولة اتحسبت على المستخدم (غلط)');
  assert.equal(out.calls.recordTriedPin, 0, 'الرقم اتسجّل كتجربة غلط (غلط)');
  assert.equal(out.calls.badPin, 0, 'اتعرضت شاشة «باسورد غلط» (غلط)');
  assert.equal(out.calls.locked, 0, 'اتقفل الحساب بسبب عطل بنية (غلط)');
  assert.equal(out.calls.strikeReset, 1, 'العدّاد المفروض يرجع صفر');
  assert.equal(out.state.tries, 0, 'العدّاد المحلي فضل يزيد');
});

test('P3-L3 · ⛔ لا ارتجاع — الباسورد الغلط بيفضل زي ما هو', () => {
  const out = runGateLogin({ s: 401, d: { ok: false, why: 'bad_pin' } });
  assert.equal(out.calls.badPin, 1, 'شاشة «الباسورد غلط» لازم تفضل موجودة');
  assert.equal(out.calls.strikePush, 1, 'المحاولة الغلط لازم تتحسب زي ما هي');
  assert.equal(out.calls.said.length, 0, 'مفيش رسالة مخصوصة للباسورد الغلط');
});

test('P3-L3 · ⛔ لا ارتجاع — فشل الشبكة بيفضل «الشبكة ضعيفة»', () => {
  const out = runGateLogin({ s: 0, d: {} });
  assert.equal(out.calls.said.length, 1);
  assert.ok(out.calls.said[0].indexOf('الشبكة ضعيفة') > -1,
    'رسالة الشبكة اتغيّرت: ' + out.calls.said[0]);
  assert.equal(out.calls.strikePush, 0, 'الشبكة مش محاولات');
});

/* ═══════════════════════════════════════════════════════════════
   ③  المودال (octa-auth.js) — سلوك منفّذ ⬇️
   ═══════════════════════════════════════════════════════════════ */
function runAuthModal(o) {
  const body = extractBody(AUTH, "fetch(apiBase() + '/api/auth/register'", 'function (o)');
  const calls = { said: [], setUser: 0 };
  const go = { disabled: true, textContent: '' };
  const h = { remove: function () { } };
  const fn = new Function(
    'o', 'msg', 'setUser', 'octaTrack', 'h', 'OCTAAuth', 'go', 'isLogin',
    'API_DOWN_MSG', 'API_DOWN_HINT', body);
  fn(o,
    function (t, ok) { calls.said.push(String(t)); },
    function () { calls.setUser++; },
    function () { },
    h,
    { refresh: function () { } },
    go,
    true,
    'الخدمة مؤقتًا غير متاحة — جرّب بعد قليل', MSG_CHECK);
  return { calls: calls, go: go };
}

test('P3-L4 · المودال: api_unreachable ⇒ رسالة محدّدة', () => {
  const out = runAuthModal({
    s: 503,
    d: { ok: false, error: 'الخدمة مؤقتًا غير متاحة', why: 'api_unreachable' },
  });
  assert.equal(out.calls.said.length, 1, 'لازم رسالة واحدة: ' + JSON.stringify(out.calls.said));
  const m = out.calls.said[0];
  assert.ok(m.indexOf(MSG_MAINT) > -1, 'الرسالة مفيهاش «مؤقتًا غير متاحة»: ' + m);
  assert.ok(m.indexOf(MSG_CHECK) > -1, 'الرسالة مفيهاش «افحص حالة الخدمة»: ' + m);
  assert.equal(out.calls.setUser, 0, 'ما دخلناش باسم');
});

test('P3-L5 · ⛔ لا ارتجاع — المودال: خطأ تاني بيفضل «حصل خطأ»', () => {
  const out = runAuthModal({ s: 400, d: { ok: false, error: 'الكود قصير' } });
  assert.equal(out.calls.said.length, 1);
  assert.ok(out.calls.said[0].indexOf('الكود قصير') > -1,
    'رسالة الخطأ العادي اتغيّرت: ' + out.calls.said[0]);
});

/* ═══════════════════════════════════════════════════════════════
   ④  ⛔ ممنوع تغيير سلوك الرسائل التانية ⬇️
   ═══════════════════════════════════════════════════════════════ */
test('P3-L6 · ⛔ رسالة «الباسورد غلط» موجودة (ما اتمسحتش)', () => {
  assert.ok(/الباسورد غلط/.test(GATE), 'رسالة الباسورد الغلط اتمسحت');
});

test('P3-L6 · ⛔ رسالة «مقدرناش نبعت الكود» موجودة (الإيميل زي ما هو)', () => {
  assert.ok(/مقدرناش نبعت الكود/.test(GATE), 'رسالة الإيميل اتغيّرت');
  assert.ok(/مقدرناش نبعت كود جديد/.test(GATE), 'رسالة إعادة الإرسال اتغيّرت');
});

test('P3-L6 · ⛔ «السيرفر بطيء» ما اتحوّلش لرسالة البنية', () => {
  const n = (GATE.match(/السيرفر بطيء/g) || []).length;
  assert.ok(n >= 1, 'رسالة «السيرفر بطيء» اختفت بالكامل (سلوك تاني اتغيّر)');
  /* ⛔ رسالة عطل البنية نفسها ما فيها «السيرفر بطيء» ولا «حصل خطأ» ⬇️ */
  const m = GATE.match(/var\s+API_DOWN_MSG\s*=\s*'([^']*)'/);
  assert.ok(m, 'مألقاش رسالة عطل البنية');
  assert.ok(m[1].indexOf('السيرفر بطيء') === -1, 'رسالة البنية بقت «السيرفر بطيء»: ' + m[1]);
  assert.ok(m[1].indexOf('حصل خطأ') === -1, 'رسالة البنية بقت عامة: ' + m[1]);
  assert.ok(m[1].indexOf('الباسورد غلط') === -1, 'رسالة البنية اتلخبطت بالباسورد: ' + m[1]);
  const h = GATE.match(/var\s+API_DOWN_HINT\s*=\s*'([^']*)'/);
  assert.ok(h, 'مألقاش تلميح «افحص حالة الخدمة»');
  assert.equal(h[1], MSG_CHECK, 'التلميح غلط: ' + h[1]);
});

test('P3-L7 · ⛔ مافيش عنوان داخلي ولا سر في ملفات الواجهة الجديدة', () => {
  const files = [
    ['assets/js/octa-gate.js', GATE],
    ['assets/js/octa-auth.js', AUTH],
  ];
  for (const f of files) {
    assert.ok(f[1].indexOf('trycloudflare') === -1, f[0] + ': فيه عنوان نفق داخلي');
    assert.ok(f[1].indexOf('railway.app') === -1, f[0] + ': فيه عنوان إنتاج');
    assert.ok(f[1].indexOf('OCTA_PROXY_SECRET') === -1, f[0] + ': فيه اسم سر');
  }
});
