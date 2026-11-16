/* ══════════════════════════════════════════════════════════════════════
   🧪🛡️ الجولة ١٦ — عقد الواجهة الجديد: فصل التغطية عن الحداثة + عمر السعر
   ──────────────────────────────────────────────────────────────────────
   ⛔ المطلوب (مراجعة المالك المستقلة · الجولة ١٦):
      ① الحداثة (freshness) والتغطية (coverage_status) **منفصلين**:
         `freshness` = fresh | stale | unavailable  (عمر آخر جلب ناجح)
         `coverage_status` = complete | partial | unavailable (نسبة اللي اتجلب)
         ⇒ «تغطية جزئية» لازم تتبان من `coverage_status` مش من `freshness`.
      ② **عمر السعر نفسه** لازم يبان للمستخدم:
         «آخر سعر معروف» من غير «منذ قد إيه» ⇒ الكلام ناقص.

   📌 التشغيل:  node --test assets/tests/opp-contract16.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const OPPS = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-opps.js'), 'utf8');

/* ═══ استخراج دالة من المصدر وتقييمها في معزل ═══ */
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
    'SRC_PRICE_AGE']
    .map((n) => {
      const m = OPPS.match(new RegExp('var\\s+' + n + '\\s*=\\s*[^;]+;'));
      /* ⛔ ثابت مش موجود ⇒ نص فاضي (مش assert) ⇒ الاختبار يفشل
         على **سببه الحقيقي** مش على فشل التهيئة. */
      return m ? m[0] : ('var ' + n + " = '';");
    }).join('\n');
  const fn = new Function('window', 'S', 'document', 'console', 'AR_MONTHS',
    consts + '\n' + src
    + '\nreturn { cardHTML: cardHTML, summaryHTML: summaryHTML,'
    + ' criteriaCardHTML: criteriaCardHTML, detailHTML: detailHTML };');
  return fn(sandbox.window, state, sandbox.document, sandbox.console,
    sandbox.AR_MONTHS);
}

function baseItem(extra) {
  return Object.assign({
    code: 'S00',
    name: 'سهم تجريبي',
    sector: 'البنوك',
    price: 100.5,
    price_label: 'آخر سعر معروف',
    price_time_source: 'source',
    price_as_of: '2026-11-17T10:30:00Z',
    data_received_at: '2026-11-17T10:31:00Z',
    change: 1.2,
    data_state: 'live',
    coverage: 100,
    score: 72,
    grade_ar: 'جيد',
    risk_level_ar: 'متوسط',
    hold_days: 20,
    state: 'hold',
    reasons: [],
    missing: [],
    eligible: true
  }, extra || {});
}

function baseState(dataExtra, strategies) {
  return {
    data: Object.assign({
      summary: {},
      sources: [],
      market_phase: 'open',
      data_freshness: { freshness: 'fresh', coverage_status: 'complete' },
      coverage_status: 'complete'
    }, dataExtra || {}),
    open: {},
    strategies: strategies || []
  };
}

/* ══════════════════════════════════════════════════════════════════════
   ① فصل التغطية عن الحداثة
   ══════════════════════════════════════════════════════════════════════ */

test('«تغطية جزئية» بتظهر من coverage_status (مش من freshness)', () => {
  const st = { key: 'swing', name_ar: 'سوينج', criteria: [] };
  const S = baseState({
    coverage_status: 'partial',
    data_freshness: { freshness: 'fresh', coverage_status: 'partial',
      coverage_pct: 1.05, requested: 286, updated: 3, missing: 283 }
  }, [st]);
  const html = makeOpp(S).criteriaCardHTML(st);
  assert.ok(html.includes('تغطية جزئية'),
    'التغطية الجزئية مش ظاهرة ⇒ الواجهة لسه بتقرا freshness غلط');
});

test('الحداثة «قديمة» بتظهر لوحدها من freshness', () => {
  const st = { key: 'swing', name_ar: 'سوينج', criteria: [] };
  const S = baseState({
    coverage_status: 'complete',
    data_freshness: { freshness: 'stale', coverage_status: 'complete',
      coverage_pct: 100, requested: 286, updated: 286, missing: 0 }
  }, [st]);
  const html = makeOpp(S).criteriaCardHTML(st);
  assert.ok(html.includes('بيانات قديمة'), 'حالة «بيانات قديمة» مش ظاهرة');
  assert.ok(!html.includes('تغطية جزئية'),
    'التغطية الجزئية ظهرت مع حداثة كاملة ⇒ خلط بين المفهومين');
});

test('الحداثة «غير متاحة» بتظهر لوحدها', () => {
  const st = { key: 'swing', name_ar: 'سوينج', criteria: [] };
  const S = baseState({
    coverage_status: 'unavailable',
    data_freshness: { freshness: 'unavailable', coverage_status: 'unavailable' }
  }, [st]);
  const html = makeOpp(S).criteriaCardHTML(st);
  assert.ok(html.includes('غير متاحة'), 'حالة «البيانات غير متاحة» مش ظاهرة');
});

test('«قديمة» + «تغطية جزئية» بيبانوا **مع بعض** (مش واحد hides التاني)', () => {
  const st = { key: 'swing', name_ar: 'سوينج', criteria: [] };
  const S = baseState({
    coverage_status: 'partial',
    data_freshness: { freshness: 'stale', coverage_status: 'partial',
      coverage_pct: 55.9, requested: 286, updated: 160, missing: 126 }
  }, [st]);
  const html = makeOpp(S).criteriaCardHTML(st);
  assert.ok(html.includes('بيانات قديمة'), 'الحداثة القديمة مخفية');
  assert.ok(html.includes('تغطية جزئية'), 'التغطية الجزئية مخفية');
});

/* ══════════════════════════════════════════════════════════════════════
   ② عمر السعر يبان للمستخدم
   ══════════════════════════════════════════════════════════════════════ */

test('عمر السعر معروض جنب الوصف', () => {
  const S = baseState();
  const html = makeOpp(S).cardHTML(baseItem({
    price_age_seconds: 70800,
    price_age_minutes: 1180,
    price_age_label_ar: 'منذ 19 ساعة'
  }), 0);
  assert.ok(html.includes('عمر السعر'), 'عنوان «عمر السعر» مش ظاهر');
  assert.ok(html.includes('منذ 19 ساعة'), 'قيمة العمر مش ظاهرة');
});

test('مافيش عمر سعر ⇒ مافيش «عمر السعر» (مافيش كذب)', () => {
  const S = baseState();
  const html = makeOpp(S).cardHTML(baseItem({
    price_age_seconds: null, price_age_label_ar: 'غير معروف'
  }), 0);
  assert.ok(!html.includes('عمر السعر'),
    'بنعرض «عمر السعر» من غير رقم ⇒ ادعاء غير مسنود');
});

test('«عمر السعر: غير معروف» ما تظهرش (المصدر ميعطيش توقيت)', () => {
  const S = baseState();
  const html = makeOpp(S).cardHTML(baseItem({
    price_time_source: 'not_provided',
    price_as_of: null,
    price_age_seconds: null,
    price_age_label_ar: 'غير معروف'
  }), 0);
  assert.ok(!html.includes('غير معروف'), 'بنعرض «غير معروف» كأنه رقم');
});

/* ══════════════════════════════════════════════════════════════════════
   ③ الصدق: «الآن» ما تظهرش إلا بتوقيت من المصدر
   ══════════════════════════════════════════════════════════════════════ */

test('«سعر التداول الآن» ما تظهرش من غير توقيت من المصدر', () => {
  const S = baseState();
  const html = makeOpp(S).cardHTML(baseItem({
    price_label: 'سعر التداول الآن',
    price_time_source: 'not_provided',
    price_as_of: null,
    price_age_seconds: null
  }), 0);
  assert.ok(!html.includes('سعر التداول الآن'),
    'الواجهة صدّقت ادعاءً كاذباً من الـAPI');
  assert.ok(html.includes('آخر سعر متاح'), 'الوصف البديل مش ظاهر');
});

test('«آخر سعر معروف» بتظهر مع توقيت من المصدر (لما السعر قديم)', () => {
  const S = baseState();
  const html = makeOpp(S).cardHTML(baseItem({
    price_label: 'آخر سعر معروف',
    price_time_source: 'source',
    price_age_seconds: 70800,
    price_age_label_ar: 'منذ 19 ساعة'
  }), 0);
  assert.ok(html.includes('آخر سعر معروف'), 'وصف «آخر سعر معروف» مش ظاهر');
  assert.ok(html.includes('منذ 19 ساعة'), 'العمر مش ظاهر');
  assert.ok(!html.includes('الآن'), 'ظهر «الآن» وسعره من ١٩ ساعة ⇒ كذب');
});

/* ══════════════════════════════════════════════════════════════════════
   ④ نقاء: مافيش أسرار ولا ارتجاع للعقد القديم
   ══════════════════════════════════════════════════════════════════════ */

test('الواجهة ما بتقراش أسرار', () => {
  /* ⛔ الفحص على **الكود** بس (التعليقات بتشرح التاريخ) ⇒
     بنشيل التعليقات قبل الفحص عشان كلمة اسم حقل في شرح
     متكلّمة ما consideredش تسريب. */
  const code = OPPS.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.ok(!/available_weight/.test(code), 'مافيش available_weight');
  assert.ok(!/\bweights\b/.test(code), 'فيها weights');
  assert.ok(!/all_eligible/.test(code), 'مافيش all_eligible');
});

test('مافيش ارتجاع لقراءة «partial» من freshness', () => {
  const m = OPPS.match(/freshness\s*===\s*['"]partial['"]/);
  assert.ok(!m, 'الواجهة لسه بتقرا freshness==="partial" ⇒ العقد القديم');
});
