/* ══════════════════════════════════════════════════════════════════════
   🧪🛡️ مراجعة الجولة ١٧ (R17-P1) — حالة «unknown» في الواجهة
   ──────────────────────────────────────────────────────────────────────
   ⛔ المطلوب: الباك بقى بيحتمل حالة `data_state="unknown"` (مافيش دليل
      حداثة ⇒ ممنوع «live» و ممنوع «قديم»). الواجهة لازم:
         · «unknown»  ⇒ وسم صريح «حالة البيانات غير معروفة»
         · «stale»    ⇒ وسم «سعر قديم» (زي ما هو)
         · «live»     ⇒ مفيش وسم تحذير

   📌 التشغيل:  node --test assets/tests/opp-contract18.test.js
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
      /* ⛔ ثابت مش موجود ⇒ نص فاضي (مش assert) ⇒ الاختبار يفشل
         على **سببه الحقيقي** مش على فشل التهيئة. */
      return m ? m[0] : ('var ' + n + " = '';");
    }).join('\n');
  const fn = new Function('window', 'S', 'document', 'console', 'AR_MONTHS',
    consts + '\n' + src
    + '\nreturn { cardHTML: cardHTML, criteriaCardHTML: criteriaCardHTML };');
  return fn(sandbox.window, state, sandbox.document, sandbox.console,
    sandbox.AR_MONTHS);
}

function baseState() {
  return {
    data: {
      summary: {},
      sources: [],
      market_phase: 'open',
      data_freshness: { freshness: 'fresh', coverage_status: 'complete' },
      coverage_status: 'complete'
    },
    open: {},
    strategies: []
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

test('صف بحالة unknown ⇒ وسم «حالة البيانات غير معروفة» ظاهر', () => {
  const S = baseState();
  const html = makeOpp(S).cardHTML(baseItem({ data_state: 'unknown' }), 0);
  assert.ok(html.includes('حالة البيانات غير معروفة'),
    'الواجهة مخفتش حالة «unknown» ⇒ المستخدم مش هيعرف إن الدلّة ناقصة');
  assert.ok(!html.includes('سعر قديم'),
    'الواجهة قالت «سعر قديم» وهي مش قديمة (unknown مش stale)');
});

test('صف قديم ⇒ وسم «سعر قديم» (مفيش ارتجاع)', () => {
  const S = baseState();
  const html = makeOpp(S).cardHTML(baseItem({
    data_state: 'stale',
    source_as_of: '2026-11-15T22:00:00Z'
  }), 0);
  assert.ok(html.includes('سعر قديم'), 'وسم «سعر قديم» اختفى');
  assert.ok(!html.includes('حالة البيانات غير معروفة'),
    '«unknown» ظهرت مع صف قديم');
});

test('صف حيّ ⇒ مفيش وسم تحذير', () => {
  const S = baseState();
  const html = makeOpp(S).cardHTML(baseItem({ data_state: 'live' }), 0);
  assert.ok(!html.includes('حالة البيانات غير معروفة'),
    '«unknown» ظهرت مع صف حيّ');
  assert.ok(!html.includes('سعر قديم'), '«سعر قديم» ظهر مع صف حيّ');
});
