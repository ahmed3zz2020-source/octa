/* ══════════════════════════════════════════════════════════════════════
   🧪🛡️ الجولة ١٧ (R17-V2-02) — تحذير تناقض أرقام التغطية في لوحة المعايير
   ──────────────────────────────────────────────────────────────────────
   ⛔ العيب: الباك بينشر `data_freshness.coverage_consistent=false` وبيحطّ
      «أرقام التغطية غير متسقة» جوه `freshness_summary_ar` — بس الواجهة
      بترسم حالتها بنفسها ⇒ **التنبيه كان بيضيع** والمستخدم بيشوف
      «تغطية جزئية» بس (مش عارف إن الأرقام نفسها متناقضة).

   📌 العقد المطلوب:
      · `coverage_consistent === false` ⇒ تحذير **ظاهر** فيه النص
        «أرقام التغطية غير متسقة» **مع الأرقام** المنشورة.
      · التحذير **مكمّل** لوسم «تغطية جزئية» (مش بديل عنه) ⇒ الاتنين يبانوا.
      · `coverage_consistent === true`  ⇒ مافيش تحذير.
      · `coverage_consistent` غايب      ⇒ مافيش تحذير (مافيش تحذير كاذب).

   📌 التشغيل:  node --test assets/tests/opp-contract19.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const OPPS = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-opps.js'), 'utf8');

function extract(src, name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\([\\s\\S]*?\\n  \\}');
  const m = src.match(re);
  assert.ok(m, 'دالة ' + name + ' مش موجودة');
  const fn = new Function(m[0] + '\nreturn ' + name + ';');
  return fn();
}

function makeOpp(state) {
  const sandbox = {
    window: { OPS_COPY: {} },
    S: state,
    document: { querySelector: () => null },
    console: console,
    AR_MONTHS: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
  };
  const names = ['esc', 'num', 'pct', 'has', 'copyFor', 'stateAr',
    'badge', 'sec', 'kv', 'arText', 'grid', 'arNum', 'fmtDateAr',
    'fmtTime', 'sumItem', 'summaryHTML', 'scoreClass', 'cardHTML',
    'detailHTML', 'criteriaCardHTML'];
  const src = names.map((n) => extract(OPPS, n).toString()).join('\n');
  const consts = ['SRC_NO_PRICE_TIME', 'SRC_DATA_UPDATED', 'SRC_PRICE_TIME',
    'SRC_LAST_PRICE', 'SRC_STALE_PRICE', 'SRC_LAST_KNOWN_AT',
    'SRC_PRICE_AGE', 'SRC_UNKNOWN_STATE']
    .map((n) => {
      const m = OPPS.match(new RegExp('var\\s+' + n + '\\s*=\\s*[^;]+;'));
      return m ? m[0] : ('var ' + n + " = '';");
    }).join('\n');
  const fn = new Function('window', 'S', 'document', 'console', 'AR_MONTHS',
    consts + '\n' + src
    + '\nreturn { criteriaCardHTML: criteriaCardHTML };');
  return fn(sandbox.window, state, sandbox.document, sandbox.console,
    sandbox.AR_MONTHS);
}

const ST = { key: 'swing', name_ar: 'سوينج', criteria: [] };

/* 🛡️ نفس تنسيق `num()` في الواجهة (أرقام عربية-هندية) — عشان نتحقق
   على الشكل المعروض فعلاً مش على الشكل المبدئي. */
function arN(v) {
  return Number(v).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
}

function baseState(freshExtra, dataExtra) {
  return {
    data: Object.assign({
      summary: {},
      sources: [],
      market_phase: 'open',
      data_freshness: Object.assign({
        freshness: 'fresh',
        coverage_status: 'partial'
      }, freshExtra || {}),
      coverage_status: 'partial'
    }, dataExtra || {}),
    open: {},
    strategies: [ST]
  };
}

/* ⛔ كتل التحذير لوحده (مش النص كله) ⇒ رقم ناقص جوّه التحذير ما يتحسبش
   برقم موجود في جزء «تغطية الجلب». */
function warnBlock(html) {
  const i = html.indexOf('opps-cov-warn');
  if (i === -1) return '';
  const start = html.lastIndexOf('<div', i);
  const end = html.indexOf('</div>', i);
  if (start === -1 || end === -1) return '';
  return html.slice(start, end);
}

/* ══════════════════════════════════════════════════════════════════════
   ① التناقض ⇒ تحذير ظاهر + الأرقام + «تغطية جزئية» لسه موجودة
   ══════════════════════════════════════════════════════════════════════ */

test('تناقض الأرقام ⇒ تحذير «أرقام التغطية غير متسقة» ظاهر', () => {
  const S = baseState({
    coverage_consistent: false,
    coverage_pct: 90,
    requested: 100,
    updated: 100,
    missing: 0,
    coverage_implied_pct: 100
  });
  const html = makeOpp(S).criteriaCardHTML(ST);
  assert.ok(html.includes('أرقام التغطية غير متسقة'),
    'تحذير تناقض التغطية مش ظاهر ⇒ المستخدم مش هيعرف إن الأرقام متناقضة');
});

test('التحذير فيه الأرقام المنشورة كلّها (مش نص فاضي)', () => {
  const S = baseState({
    coverage_consistent: false,
    coverage_pct: 90,
    requested: 100,
    updated: 100,
    missing: 0,
    coverage_implied_pct: 100
  });
  const html = makeOpp(S).criteriaCardHTML(ST);
  const w = warnBlock(html);
  assert.ok(w, 'مافيش بلوك تحذير في اللوحة');
  assert.ok(w.includes('التغطية المعلنة ' + arN(90) + '٪'),
    'النسبة المعلنة مش في التحذير');
  assert.ok(w.includes('المطلوب ' + arN(100)),
    'عدد المطلوب مش في التحذير');
  assert.ok(w.includes('اتحدّث ' + arN(100)),
    'عدد المحدَّث مش في التحذير');
  assert.ok(w.includes('ناقص ' + arN(0)),
    'عدد الناقص مش في التحذير');
  assert.ok(w.includes(arN(100) + '٪'),
    'النسبة المحسوبة من الأعداد مش في التحذير');
});

test('التحذير **مكمّل** لوسم «تغطية جزئية» (الاتنين يبانوا)', () => {
  const S = baseState({
    coverage_consistent: false,
    coverage_pct: 90,
    requested: 100,
    updated: 100,
    missing: 0,
    coverage_implied_pct: 100
  });
  const html = makeOpp(S).criteriaCardHTML(ST);
  assert.ok(html.includes('تغطية جزئية'),
    '«تغطية جزئية» اختفت ⇒ التحذير بدّلها (الممنوع)');
  assert.ok(html.includes('أرقام التغطية غير متسقة'),
    'تحذير التناقض اختفى');
});

test('تناقض + ادّعاء «كاملة» ⇒ ممنوع (تناقض «جزئية» + تحذير)', () => {
  const S = baseState({
    coverage_consistent: false,
    coverage_status: 'complete',
    coverage_pct: 90,
    requested: 100,
    updated: 100,
    missing: 0,
    coverage_implied_pct: 100
  }, { coverage_status: 'complete', coverage_acceptable: true });
  const html = makeOpp(S).criteriaCardHTML(ST);
  assert.ok(html.includes('أرقام التغطية غير متسقة'),
    'تحذير التناقض مش ظاهر');
  assert.ok(html.includes('تغطية جزئية'),
    'الواجهة زاالت «تغطية جزئية» وناّلت تناقض الأرقام');
  assert.ok(!html.includes('تغطية مقبولة'),
    'الواجهة قالت «تغطية مقبولة» وفيه تناقض أرقام');
});

/* ══════════════════════════════════════════════════════════════════════
   ② الافتراضي الآمن — مافيش تحذير كاذب
   ══════════════════════════════════════════════════════════════════════ */

test('أرقام متسقة ⇒ مافيش تحذير تناقض', () => {
  const S = baseState({
    coverage_consistent: true,
    coverage_pct: 100,
    requested: 100,
    updated: 100,
    missing: 0,
    coverage_implied_pct: 100
  });
  const html = makeOpp(S).criteriaCardHTML(ST);
  assert.ok(!html.includes('أرقام التغطية غير متسقة'),
    'تحذير كاذب على أرقام متسقة');
  assert.ok(!warnBlock(html), 'بلوك تحذير ظاهر على أرقام متسقة');
});

test('من غير `coverage_consistent` ⇒ مافيش تحذير (الافتراضي الآمن)', () => {
  const S = baseState({
    coverage_pct: 90,
    requested: 100,
    updated: 100,
    missing: 0
  });
  const html = makeOpp(S).criteriaCardHTML(ST);
  assert.ok(!html.includes('أرقام التغطية غير متسقة'),
    'تحذير كاذب من غير دليل (مافيش سبب)');
  assert.ok(!warnBlock(html), 'بلوك تحذير ظاهر من غير دليل');
});

test('تناقض من غير أرقام منشودة ⇒ التحذير بيبان (من غير أرقام مختلقة)', () => {
  const S = baseState({ coverage_consistent: false });
  const html = makeOpp(S).criteriaCardHTML(ST);
  assert.ok(html.includes('أرقام التغطية غير متسقة'),
    'التحذير مش ظاهر');
  assert.ok(!html.includes('undefined'),
    'الواجهة نشرت «undefined» في التحذير');
  const w = warnBlock(html);
  assert.ok(!w.includes('undefined') && !w.includes('NaN'),
    'التحذير فيه قيمة مختلقة');
});
