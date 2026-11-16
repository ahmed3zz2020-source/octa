/* ══════════════════════════════════════════════════════════════════════
   🧪🛡️ عقد الواجهة مع محرّك الفرص الحي (الجولة ١٣ — ١٦ نوفمبر ٢٠٢٦)
   ──────────────────────────────────────────────────────────────────────
   ⛔ العيوب المقاسة:
      · بطاقة المعايير كانت تطبع cr.weight / cr.points_max ⇒ undefined
        مع الـAPI الجديد (الأسرار مستبعدة عمدًا).
      · بطاقة السهم كانت تطبع c.points / c.points_max ⇒ undefined.
      · جملة الحد الأدنى كانت تطبع st.min_coverage ⇒ undefined.
      · كتلة المصادر كانت تقرأ S.data.summary.sources ⇒ مافيش مصدر.

   📌 التشغيل:  node --test assets/tests/opp-contract13.test.js
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

/* ═══ بيئة مصغّرة للواجهة ═══ */
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
    'criteriaCardHTML', 'detailHTML'];
  const src = names.map((n) => extract(OPPS, n).toString()).join('\n');
  const fn = new Function(
    'window', 'S', 'document', 'console', 'AR_MONTHS',
    src + '\nreturn { criteriaCardHTML: criteriaCardHTML, detailHTML: detailHTML };'
  );
  return fn(sandbox.window, state, sandbox.document, sandbox.console,
    sandbox.AR_MONTHS);
}

/* ═══ بيانات.paylod من الـAPI الجديد (بلا أسرار) ═══ */
function apiStrategy() {
  return {
    key: 'swing',
    name_ar: 'مضاربة',
    definition_ar: 'صفقات قصيرة على الحركة',
    horizon_ar: '٣ إلى ١٥ جلسة',
    looks_for_ar: 'أسهم تقنية نشطة',
    accept_ar: ['زخم'],
    reject_ar: ['مخاطرة ناقصة'],
    risk_ar: ['تذبذب'],
    criteria: [
      { key: 'trend', label_ar: 'الاتجاه الفني', hint_ar: 'ميل السعر', not_ar: '' },
      { key: 'momentum', label_ar: 'الزخم السعري', hint_ar: 'حركة السعر', not_ar: '' }
    ]
    /* ⛔ مافيش weight · points_max · min_coverage — زي ما الـAPI الجديد */
  };
}

function apiItem() {
  return {
    code: 'AAA',
    name: 'سهم اختبار',
    sector: 'صناعة',
    price: 50,
    change: 1.2,
    score: 78.4,
    coverage: 100,
    grade_ar: 'مطابقة جيدة',
    risk_level_ar: 'متوسط',
    risk_score: 67,
    state: 'watch',
    reasons: ['الاتجاه الفني: مطابقة قوية (٩٥٪).'],
    data_state: 'live',
    source_as_of: '2026-11-16T10:00:00Z',
    criteria: [
      { key: 'trend', label_ar: 'الاتجاه الفني', ratio: 0.95, note_ar: '' },
      { key: 'momentum', label_ar: 'الزخم السعري', ratio: 0.77, note_ar: '' },
      { key: 'volume', label_ar: 'نشاط التداول', ratio: null, note_ar: '' }
    ]
  };
}

test('بطاقة المعايير: مافيش undefined ولا أسرار (أوزان/نقاط/عتبة)', () => {
  const st = apiStrategy();
  const S = { data: { summary: {}, sources: [] }, open: {}, strategies: [st] };
  const api = makeOpp(S);
  const html = api.criteriaCardHTML(st);
  assert.ok(html.length > 200, 'الكارت فاضي');
  assert.ok(!html.includes('undefined'), 'فيه undefined في كارت المعايير');
  assert.ok(!html.includes('NaN'), 'فيه NaN في كارت المعايير');
  assert.ok(!/الوزن|الحد الأقصى/.test(html), 'لسه بيعرض الأوزان');
});

test('بطاقة السهم: النسبة بس (مافيش نقاط ولا وزن)', () => {
  const S = { data: { summary: {} }, open: {}, strategies: [apiStrategy()] };
  const api = makeOpp(S);
  const html = api.detailHTML(apiItem());
  assert.ok(!html.includes('undefined'), 'فيه undefined في كارت السهم');
  assert.ok(html.includes('٩٥'), 'مش باين نسبة المطابقة');
  assert.ok(html.includes('غير متاح'), 'المعيار الناقص لازم يبقى معلن');
});

test('كتلة المصادر + حالة الحداثة من الـpayload الجديد', () => {
  const st = apiStrategy();
  const S = {
    data: {
      summary: {},
      sources: [{ source: 'TradingView Scanner', as_of: '2026-11-16T09:59:00Z' }],
      market_phase: 'closed',
      data_freshness: { freshness: 'fresh', age_seconds: 300 }
    },
    open: {}, strategies: [st]
  };
  const api = makeOpp(S);
  const html = api.criteriaCardHTML(st);
  assert.ok(html.includes('TradingView Scanner'), 'المصدر مش ظاهر');
  assert.ok(html.includes('السوق مغلق'), 'حالة السوق مش ظاهرة');
  assert.ok(html.includes('بيانات حديثة'), 'حالة الحداثة مش ظاهرة');
  assert.ok(!html.includes('undefined'), 'فيه undefined');
});

test('السوق مفتوح + بيانات قديمة ⇒ اتنين ظاهرين منفصلين', () => {
  const st = apiStrategy();
  const S = {
    data: {
      summary: {}, sources: [],
      market_phase: 'open',
      data_freshness: { freshness: 'stale', age_seconds: 7200 }
    },
    open: {}, strategies: [st]
  };
  const api = makeOpp(S);
  const html = api.criteriaCardHTML(st);
  assert.ok(html.includes('السوق مفتوح'), 'حالة السوق مش ظاهرة');
  assert.ok(html.includes('بيانات قديمة'), 'حالة الحداثة مش ظاهرة');
});

test('الواجهة ما تقراش أسرار من الـpayload', () => {
  /* ⛔ حماية: لو الـpayload رجع وزن ⇒ الواجهة ما تعرضهوش */
  const src = OPPS;
  assert.ok(!/cr\.weight/.test(src), 'لسه بيقرأ cr.weight');
  assert.ok(!/cr\.points_max/.test(src), 'لسه بيقرأ cr.points_max');
  assert.ok(!/st\.min_coverage/.test(src), 'لسه بيقرأ st.min_coverage');
  assert.ok(!/c\.points_max/.test(src), 'لسه بيقرأ c.points_max');
});
