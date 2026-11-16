/* ══════════════════════════════════════════════════════════════════════
   🧪🛡️ الجولة ١٥ — عقد الواجهة: وصف السعر الصادق + التغطية + حد الباقة
   ──────────────────────────────────────────────────────────────────────
   ⛔ المطلوب (ملاحظة المالك على تقرير الجولة ١٤):
      «وقت استلام البيانات» **مش** دليل على وقت آخر تداول.
      ⇒ التسمية ما بتقولش «الآن» إلا لو في `price_time_source='source'`.
      ⇒ مافيش توقيت ⇒ «المصدر مبيعطيش وقت السعر» + «وقت تحديث البيانات».

   📌 التشغيل:  node --test assets/tests/opp-contract14.test.js
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
  /* ⛔ الثوابت (نصوص مصدر البيانات) — لازم تُستخرج معاها */
  const consts = ['SRC_NO_PRICE_TIME', 'SRC_DATA_UPDATED', 'SRC_PRICE_TIME',
    'SRC_LAST_PRICE', 'SRC_STALE_PRICE', 'SRC_LAST_KNOWN_AT',
    /* ⛔ الجولة ١٦ — عمر السعر */
    'SRC_PRICE_AGE']
    .map((n) => {
      const m = OPPS.match(new RegExp('var\\s+' + n + '\\s*=\\s*[^;]+;'));
      assert.ok(m, 'ثابت ' + n + ' مش موجود');
      return m[0];
    }).join('\n');
  const fn = new Function('window', 'S', 'document', 'console', 'AR_MONTHS',
    consts + '\n' + src
    + '\nreturn { cardHTML: cardHTML, summaryHTML: summaryHTML,'
    + ' criteriaCardHTML: criteriaCardHTML, detailHTML: detailHTML };');
  return fn(sandbox.window, state, sandbox.document, sandbox.console,
    sandbox.AR_MONTHS);
}

function apiItem(extra) {
  return Object.assign({
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
    price_label: 'آخر سعر متاح',
    price_time_source: 'not_provided',
    data_received_at: '2026-11-17T10:00:00Z',
    price_as_of: null,
    criteria: [
      { key: 'trend', label_ar: 'الاتجاه الفني', ratio: 0.95, note_ar: '' }
    ]
  }, extra || {});
}

test('كارت السهم: بلا توقيت مصدر ⇒ التسمية ما بتدّعيش لحظية', () => {
  const S = { data: { summary: {} }, open: {}, strategies: [] };
  const api = makeOpp(S);
  const html = api.cardHTML(apiItem(), 0);
  assert.ok(html.includes('آخر سعر متاح'),
    'وصف السعر مش ظاهر (المتوقّع «آخر سعر متاح»)');
  assert.ok(!html.includes('الآن'),
    'الكارت ادّعى «الآن» وفيه مافيش توقيت من المصدر');
});

test('كارت السهم: مع توقيت مصدر ⇒ «سعر التداول الآن» (مش «سعر إغلاق»)', () => {
  const S = { data: { summary: {} }, open: {}, strategies: [] };
  const api = makeOpp(S);
  const html = api.cardHTML(apiItem({
    price_time_source: 'source',
    price_label: 'سعر التداول الآن',
    price_as_of: '2026-11-17T09:59:00Z'
  }), 0);
  assert.ok(html.includes('سعر التداول الآن'), 'وصف السعر مش ظاهر');
  assert.ok(!html.includes('سعر إغلاق'), 'سمّى سعر التداول «سعر إغلاق»');
});

test('كارت السهم: بلا توقيت ⇒ «وقت تحديث البيانات» مش «وقت السعر»', () => {
  const S = { data: { summary: {} }, open: {}, strategies: [] };
  const api = makeOpp(S);
  const html = api.cardHTML(apiItem(), 0);
  assert.ok(html.includes('وقت تحديث البيانات:'),
    'مافيش عرض وقت تحديث البيانات');
  assert.ok(!html.includes('وقت السعر:'),
    'عرضنا «وقت السعر» وفيه مافيش توقيت من المصدر');
  assert.ok(html.includes('المصدر مبيعطيش وقت السعر'),
    'مافيش إعلان إن وقت السعر مش متاح');
});

test('كارت السهم: مع توقيت ⇒ «وقت السعر» ومش «وقت تحديث البيانات»', () => {
  const S = { data: { summary: {} }, open: {}, strategies: [] };
  const api = makeOpp(S);
  const html = api.cardHTML(apiItem({
    price_time_source: 'source',
    price_as_of: '2026-11-17T09:59:00Z'
  }), 0);
  assert.ok(html.includes('وقت السعر:'), 'مافيش وقت السعر');
  assert.ok(!html.includes('وقت تحديث البيانات:'),
    'عرضنا وقت تحديث البيانات رغم وجود وقت سعر');
  assert.ok(!html.includes('المصدر مبيعطيش وقت السعر'),
    'إعلان كاذب — المصدر عطى الوقت');
});

test('كارت السهم: لو الـAPI بعت تسمية بتدّعي «الآن» ⇒ الواجهة تصحّحها', () => {
  const S = { data: { summary: {} }, open: {}, strategies: [] };
  const api = makeOpp(S);
  const html = api.cardHTML(apiItem({
    price_label: 'سعر التداول الآن',
    price_time_source: 'not_provided'
  }), 0);
  assert.ok(!html.includes('الآن'),
    'الواجهة عرضت ادعاء لحظية بلا توقيت من المصدر');
  assert.ok(html.includes('آخر سعر متاح'),
    'الواجهة ما صحّحتش التسمية');
});

test('كارت السهم: سعر قديم ⇒ وسم «سعر قديم» (مش معروض كأنه محدّث)', () => {
  const S = { data: { summary: {} }, open: {}, strategies: [] };
  const api = makeOpp(S);
  const html = api.cardHTML(apiItem({
    data_state: 'stale',
    price_label: 'آخر سعر معروف',
    source_as_of: '2026-11-15T09:00:00Z'
  }), 0);
  assert.ok(html.includes('سعر قديم'), 'مافيش وسم إن السعر قديم');
  assert.ok(html.includes('آخر سعر معروف:'),
    'مافيش وقت آخر سعر معروف');
});

test('كارت السهم: سعر محدّث ⇒ مافيش وسم «سعر قديم»', () => {
  const S = { data: { summary: {} }, open: {}, strategies: [] };
  const api = makeOpp(S);
  const html = api.cardHTML(apiItem(), 0);
  assert.ok(!html.includes('سعر قديم'),
    'وسعنا وسم «سعر قديم» على سعر محدّث');
});

test('حالة «تغطية جزئية» معروضة + الأرقام', () => {
  const st = { key: 'swing', name_ar: 'سوينج', criteria: [] };
  const S = {
    data: {
      summary: {},
      sources: [],
      market_phase: 'open',
      /* ⛔⛔⛔ الجولة ١٦ — العقد الجديد: الحداثة والتغطية **منفصلين**.
         `freshness` = fresh|stale|unavailable (عمر آخر جلب ناجح)
         `coverage_status` = complete|partial|unavailable (نسبة اللي اتجلب) */
      data_freshness: {
        freshness: 'fresh',
        coverage_status: 'partial',
        coverage_pct: 1.05,
        requested: 286,
        updated: 3,
        missing: 283
      },
      coverage_status: 'partial'
    },
    open: {}, strategies: [st]
  };
  const api = makeOpp(S);
  const html = api.criteriaCardHTML(st);
  assert.ok(html.includes('تغطية جزئية'), 'حالة التغطية الجزئية مش ظاهرة');
  assert.ok(html.includes('اتحدّث'), 'عدد الأسهم المحدثة مش ظاهر');
  assert.ok(html.includes('ناقص'), 'عدد الأسهم الناقص مش ظاهر');
  assert.ok(!html.includes('undefined'));
});

test('حد الباقة معروض «أفضل ٢٠» (مش «كل المؤهل»)', () => {
  const S = {
    data: {
      summary: { scanned: 286, eligible: 157, shown: 20 },
      limit_label_ar: 'أفضل 20 فرصة لكل استراتيجية'
    },
    open: {}, strategies: []
  };
  const api = makeOpp(S);
  const html = api.summaryHTML(S.data.summary);
  assert.ok(html.includes('أفضل 20'), 'حد الباقة مش ظاهر');
  assert.ok(!html.includes('كل المؤهل'), 'بنقول «كل المؤهل» — غلط');
  assert.ok(!html.includes('القائمة الكاملة'), 'بنقول «القائمة الكاملة» — غلط');
});

test('الواجهة ما بتقراش أسرار ولا «كل المؤهل» من الـpayload', () => {
  assert.ok(!/all_eligible/.test(OPPS), 'مافيش all_eligible');
  assert.ok(!/القائمة الكاملة/.test(OPPS), 'فيها «القائمة الكاملة»');
});
