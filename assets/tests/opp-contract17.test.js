/* ══════════════════════════════════════════════════════════════════════
   🧪🛡️ الجولة ١٧ — عقد الواجهة الجديد (رد على مراجعة مستقلة)
   ──────────────────────────────────────────────────────────────────────
   ⛔ المطلوب (مراجعة الجولة ١٦ · R16-N1 · R16-N2 · R16-N4):
      ① (R16-N2) «تغطية مقبولة» (فوق عتبة ٩٠٪) **مش** «تغطية كاملة»
         ⇒ الواجهة بتقول «مقبولة» لما `coverage_acceptable=true`
         و«جزئية» لما أقل من العتبة.
      ② (R16-N1) صف `data_state='stale'` ⇒ وسم «سعر قديم» (مفيش
         ادعاء لحظي على صف من دفعة قديمة).
      ③ (R16-N4) وصف السعر «الآن» ما ينفعش يظهر من غير دليل جلسات
         ⇒ الواجهة ما تصحّحش الكذبة، بس بتعرض اللي الباك قاله.

   📌 التشغيل:  node --test assets/tests/opp-contract17.test.js
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
    'SRC_PRICE_AGE']
    .map((n) => {
      const m = OPPS.match(new RegExp('var\\s+' + n + '\\s*=\\s*[^;]+;'));
      return m ? m[0] : ('var ' + n + " = '';");
    }).join('\n');
  const fn = new Function('window', 'S', 'document', 'console', 'AR_MONTHS',
    consts + '\n' + src
    + '\nreturn { cardHTML: cardHTML, summaryHTML: summaryHTML,'
    + ' criteriaCardHTML: criteriaCardHTML, detailHTML: detailHTML };');
  return fn(sandbox.window, state, sandbox.document, sandbox.console,
    sandbox.AR_MONTHS);
}

const STRAT = { key: 'swing', name_ar: 'سوينج', criteria: [] };

function baseState(dataExtra) {
  return {
    data: Object.assign({
      summary: {},
      sources: [],
      market_phase: 'open',
      data_freshness: { freshness: 'fresh', coverage_status: 'complete' },
      coverage_status: 'complete'
    }, dataExtra || {}),
    open: {},
    strategies: [STRAT]
  };
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

/* ═══ ① (R16-N2) — «مقبولة» ≠ «كاملة» ═══ */

test('تغطية ناقصة بس مقبولة ⇒ «تغطية مقبولة» (مش «جزئية»)', () => {
  const S = baseState({
    coverage_status: 'partial',
    coverage_acceptable: true,
    data_freshness: { freshness: 'fresh', coverage_status: 'partial',
      coverage_acceptable: true, coverage_pct: 90, requested: 100, updated: 90,
      missing: 10 }
  });
  const html = makeOpp(S).criteriaCardHTML(STRAT);
  assert.ok(html.includes('تغطية مقبولة'),
    'الواجهة ماقالتش «مقبولة» مع إن التغطية فوق العتبة');
  assert.ok(!html.includes('تغطية جزئية'),
    'الواجهة قالت «جزئية» مع إن التغطية مقبولة');
});

test('تغطية ناقصة تحت العتبة ⇒ «تغطية جزئية»', () => {
  const S = baseState({
    coverage_status: 'partial',
    coverage_acceptable: false,
    data_freshness: { freshness: 'fresh', coverage_status: 'partial',
      coverage_acceptable: false, coverage_pct: 55.9, requested: 286,
      updated: 160, missing: 126 }
  });
  const html = makeOpp(S).criteriaCardHTML(STRAT);
  assert.ok(html.includes('تغطية جزئية'),
    'الواجهة ماقالتش «جزئية» مع إن التغطية تحت العتبة');
  assert.ok(!html.includes('تغطية مقبولة'),
    'الواجهة قالت «مقبولة» مع إن التغطية تحت العتبة');
});

test('تغطية كاملة ⇒ مفيش كلمة «جزئية» ولا «مقبولة»', () => {
  const S = baseState({
    coverage_status: 'complete',
    coverage_acceptable: true,
    data_freshness: { freshness: 'fresh', coverage_status: 'complete',
      coverage_acceptable: true, coverage_pct: 100, requested: 286,
      updated: 286, missing: 0 }
  });
  const html = makeOpp(S).criteriaCardHTML(STRAT);
  assert.ok(!html.includes('تغطية جزئية'), 'ظهر «جزئية» مع تغطية كاملة');
  assert.ok(!html.includes('تغطية مقبولة'), 'ظهر «مقبولة» مع تغطية كاملة');
});

test('من غير coverage_acceptable (عقد قديم) ⇒ «جزئية» (الافتراضي الآمن)', () => {
  const S = baseState({
    coverage_status: 'partial',
    data_freshness: { freshness: 'fresh', coverage_status: 'partial',
      coverage_pct: 1.05, requested: 286, updated: 3, missing: 283 }
  });
  const html = makeOpp(S).criteriaCardHTML(STRAT);
  assert.ok(html.includes('تغطية جزئية'),
    'من غير الحقل الجديد لازم يفضل الافتراضي «جزئية»');
});

/* ═══ ② (R16-N1) — صف قديم ⇒ وسم «سعر قديم» ═══ */

test('صف من دفعة قديمة (data_state=stale) ⇒ وسم «سعر قديم» ظاهر', () => {
  const S = baseState();
  const html = makeOpp(S).cardHTML(baseItem({
    data_state: 'stale',
    source_as_of: '2026-11-15T22:00:00Z'
  }), 0);
  assert.ok(html.includes('سعر قديم'),
    'صف قديم اتعرض من غير وسم ⇒ ادعاء حداثة كاذب');
});

test('صف حيّ ⇒ مفيش وسم «سعر قديم»', () => {
  const S = baseState();
  const html = makeOpp(S).cardHTML(baseItem({ data_state: 'live' }), 0);
  assert.ok(!html.includes('سعر قديم'), 'صف حيّ اتسمّ قديم');
});

/* ═══ ③ (R16-N4) — الواجهة ما تصحّحش كذبة ولا بتخفيها ═══ */

test('وصف «آخر سعر معروف» (من غير دليل جلسات) بيتعرض زي ما هو', () => {
  const S = baseState();
  const html = makeOpp(S).cardHTML(baseItem({
    price_label: 'آخر سعر معروف',
    price_session_date: null,
    current_session_date: null
  }), 0);
  assert.ok(html.includes('آخر سعر معروف'),
    'الوصف الصادق من الباك مش ظاهر');
  assert.ok(!html.includes('سعر التداول الآن'),
    'الواجهة زوّدت ادعاء «الآن» من غير دليل');
});
