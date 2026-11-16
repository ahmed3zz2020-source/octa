/* ══════════════════════════════════════════════════════════════════════
   🧪🛡️ الجولة ١٤ — عقد الواجهة: وصف السعر + التغطية الجزئية + حد الباقة
   ──────────────────────────────────────────────────────────────────────
   ⛔ العيوب المقاسة (١٧ نوفمبر ٢٠٢٦):
      · كارت السهم كان يعرض السعر بلا وصف (ولا يعرف إن ده سعر
        التداول ولا سعر الإغلاق).
      · حالة «تغطية جزئية» (جلب ناقص) ماكانش ليها تمثيل.
      · حد الباقة (أفضل ٥ / أفضل ٢٠) ماكانش معروض ⇒ المستخدم يظن
        إن القائمة «كل المؤهل».

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
  const fn = new Function('window', 'S', 'document', 'console', 'AR_MONTHS',
    src + '\nreturn { cardHTML: cardHTML, summaryHTML: summaryHTML,'
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
    price_label: 'سعر التداول الآن',
    price_time_source: 'not_provided',
    data_received_at: '2026-11-17T10:00:00Z',
    price_as_of: null,
    criteria: [
      { key: 'trend', label_ar: 'الاتجاه الفني', ratio: 0.95, note_ar: '' }
    ]
  }, extra || {});
}

test('كارت السهم: وصف السعر ظاهر (سعر التداول مش «سعر إغلاق»)', () => {
  const S = { data: { summary: {} }, open: {}, strategies: [] };
  const api = makeOpp(S);
  const html = api.cardHTML(apiItem(), 0);
  assert.ok(html.includes('سعر التداول الآن'), 'وصف السعر مش ظاهر');
  assert.ok(!html.includes('سعر إغلاق'), 'سمّى سعر التداول «سعر إغلاق»');
});

test('كارت السهم: المصدر مابيعطيش وقت السعر ⇒ بنعلن ده', () => {
  const S = { data: { summary: {} }, open: {}, strategies: [] };
  const api = makeOpp(S);
  const html = api.cardHTML(apiItem(), 0);
  assert.ok(html.includes('المصدر مابيعطيش وقت السعر'),
    'مافيش إعلان إن وقت السعر مش متاح');
});

test('كارت السهم: لو المصدر بدي وقت السعر ⇒ ما نقولش الكلام ده', () => {
  const S = { data: { summary: {} }, open: {}, strategies: [] };
  const api = makeOpp(S);
  const html = api.cardHTML(
    apiItem({ price_time_source: 'source', price_as_of: '2026-11-17T09:59:00Z' }), 0);
  assert.ok(!html.includes('المصدر مابيعطيش وقت السعر'),
    '-announcement-خطأ-لما-المصدر-عطى-الوقت');
});

test('حالة «تغطية جزئية» معروضة + الأرقام', () => {
  const st = { key: 'swing', name_ar: 'سوينج', criteria: [] };
  const S = {
    data: {
      summary: {},
      sources: [],
      market_phase: 'open',
      data_freshness: {
        freshness: 'partial',
        coverage_pct: 1.05,
        requested: 286,
        updated: 3,
        missing: 283
      }
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
