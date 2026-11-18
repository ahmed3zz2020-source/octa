/* =============================================================================
 * P0-01 · عزل المعاينة — اختبار «الاتصال المباشر للإنتاج»
 * ============================================================================
 * 🎯 العيب اللي المراجعة كشفته (١٥ نوفمبر ٢٠٢٦):
 *    octa-api.js كان فيه اتصال احتياطي مباشر لـ Railway الإنتاج.
 *    في المعاينة (وضع الإغلاق الآمن) ده كان بيلغي العزل كله:
 *    لو متغيرات الـstaging ناقصة ⇒ الواجهة بترجع للإنتاج.
 *
 * ✅ السلوك المطلوب بعد الإصلاح:
 *    ① وضع الإغلاق الآمن + من غير قائمة محقونة ⇒ صفر سيرفرات ⇒ صفر اتصال بالإنتاج
 *    ② وضع الإغلاق الآمن + قائمة المحقونة (staging) ⇒ السيرفر التجريبي هو المستخدم
 *    ③ من غير علامة الإغلاق (الإنتاج) ⇒ السلوك القديم ما يتغيّرش
 *    ④ فشل الطلب ⇒ مسار إعادة المحاولة ما يروحش للإنتاج
 * ========================================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'js', 'octa-api.js');
const PROD = 'https://octa-prices-production-4ccb.up.railway.app';
const STAGING = 'https://staging.example.test';

/* يحمّل octa-api.js داخل بيئة متصفح وهمية */
function loadApi(opts) {
  const o = opts || {};
  const captured = [];
  const win = {};

  const rawFetch = function (url) {
    captured.push(String(url));
    if (o.failFetch) return Promise.reject(new Error('network down'));
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json', forEach: () => { } },
      text: () => Promise.resolve('{}'),
      clone: function () { return this; }
    });
  };

  win.fetch = rawFetch;
  if (o.failClosed) win.OCTA_FAIL_CLOSED = 1;
  if (o.list) win.OCTA_DIRECT_LIST = o.list;

  const sandbox = {
    window: win,
    console: console,
    /* 📌 الجولة ٢٣ (R23) — الـhostname مهم دلوقتي:
       ⛔ المعاينة (أي دومين غير الإنتاج) ⇒ ممنوعة من الإنتاج
       ⇒ من غير fail-closed ⇒ مافيش اتصال مباشر بالإنتاج.
       📌 فمحاكاة الإنتاج لازم يكون الـhostname بتاع الإنتاج. */
    location: {
      origin: o.origin || 'https://octa-preview.example.test',
      hostname: o.hostname || 'octa-preview.example.test'
    },
    localStorage: { getItem: () => null, setItem: () => { }, removeItem: () => { } },
    Headers: globalThis.Headers,
    AbortController: globalThis.AbortController,
    Response: globalThis.Response,
    Request: globalThis.Request,
    URL: globalThis.URL,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    navigator: { userAgent: 'node-test' }
  };
  sandbox.globalThis = sandbox;
  sandbox.self = win;

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SRC, 'utf8'), sandbox, { filename: 'octa-api.js' });

  return { win: win, captured: captured, sandbox: sandbox };
}

/* ========================================================================== */
test('P0-01 · وضع الإغلاق الآمن + من غير قائمة ⇒ مافيش سيرفرات ولا اتصال بالإنتاج', () => {
  const { win } = loadApi({ failClosed: true });
  assert.strictEqual(win.OCTA_DIRECT, '', 'OCTA_DIRECT لازم يكون فاضي');
  assert.strictEqual(win.OCTAServer.list.length, 0, 'مافيش لازم يكون أي سيرفر');
  assert.strictEqual(win.OCTAServer.current().url, '', 'السيرفر النشط لازم يكون فاضي');
  assert.ok(
    JSON.stringify(win.OCTAServer.list).indexOf('railway.app') === -1,
    'القائمة ما تحتويش أي عنوان إنتاج'
  );
});

test('P0-01 · وضع الإغلاق الآمن + قائمة محقونة ⇒ السيرفر التجريبي هو المستخدم', () => {
  const list = [{ name: 'staging', url: STAGING, on: true }];
  const { win } = loadApi({ failClosed: true, list: list });
  assert.strictEqual(win.OCTA_DIRECT, STAGING, 'لازم يستخدم السيرفر المحقون');
  assert.strictEqual(win.OCTAServer.current().name, 'staging');
  assert.ok(
    JSON.stringify(win.OCTAServer.list).indexOf('railway.app') === -1,
    'مافيش عنوان إنتاج في القائمة'
  );
});

test('P0-01 · من غير علامة الإغلاق (الإنتاج) ⇒ السلوك القديم ما يتغيّرش', () => {
  /* 📌 الجولة ٢٣ (R23) — محاكاة الإنتاج لازم بدومين الإنتاج
     ⛔ (من غير ده: أي دومين تاني = معاينة ⇒ ممنوعة من الإنتاج). */
  const { win } = loadApi({
    hostname: 'octashares.com',
    origin: 'https://octashares.com'
  });
  assert.strictEqual(win.OCTA_DIRECT, PROD, 'الإنتاج لازم يفضل على الاتصال المباشر');
  assert.strictEqual(win.OCTAServer.current().name, 'railway');
});

test('P0-01 · ⛔ الجولة ٢٣ (R23) · من غير علامة الإغلاق (معاينة) ⇒ مافيش ارتجاع للإنتاج', () => {
  /* 📌 العيب اللي التكليف سمّاه: «مفيش رجوع صامت للإنتاج».
     ⛔ المعاينة (دومين غير الإنتاج) + من غير fail-closed
     ⇒ القائمة الافتراضية (إنتاج) تُمنع ⇒ مافيش عنوان مباشر. */
  const { win } = loadApi({ hostname: 'octa-preview.example.test' });
  assert.strictEqual(win.OCTA_DIRECT, '', 'المعاينة اترجعت للإنتاج');
  assert.notStrictEqual(win.OCTAServer.current().url, PROD, 'السيرفر الحالي للإنتاج');
});

test('P0-01 · فشل الطلب في وضع الإغلاق الآمن ⇒ إعادة المحاولة ما تروحش للإنتاج', async () => {
  const { win, captured } = loadApi({ failClosed: true, failFetch: true });
  let threw = false;
  try {
    await win.fetch('/api/health');
  } catch (e) {
    threw = true;
  }
  assert.ok(captured.length > 0, 'لازم يكون فيه نداء مسجّل');
  for (const u of captured) {
    assert.ok(
      u.indexOf('railway.app') === -1,
      'النداء ما يروحش للإنتاج: ' + u
    );
    assert.ok(
      u.charAt(0) === '/' || u.indexOf('octa-preview.example.test') === 0,
      'النداء لازم يفضل على نفس الأصل: ' + u
    );
  }
  assert.ok(threw, 'الطلب لازم يفشل صراحةً (مافيش نجاح كاذب)');
});
