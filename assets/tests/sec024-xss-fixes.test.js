/* ══════════════════════════════════════════════════════════════════════
   🐞🛡️ SEC-024 (الجولة ١٨ · P1) — إصلاح أعلى ٨ مواضع إدراج HTML
   ──────────────────────────────────────────────────────────────────────
   📌 العيب: حقول الـAPI (أسماء · أوصاف · أسباب · رسائل خطأ) كانت
      بتترکّب في innerHTML **خام** ⇒ HTML من الـAPI = إدراج مباشر (XSS).

   📌 المطلوب: إصلاح أعلى ٨ مواضع خطورة بـ esc()/textContent + اختبار
      لكل إصلاح (يفشل قبل الإصلاح ⇒ ينجح بعده).

   📌 المواضع الثمانية (كلها من الـAPI ⇒ إدراج HTML):
      ① octa-pages.js · armNews        — جدول الأحداث المعلنة
      ② octa-pages.js · renderStrategies — اسم الاستراتيجية + التركيز + الملاحظات
      ③ octa-pages.js · renderIntel    — اسم السهم + الأسباب + المخاطر
      ④ octa-pages.js · loadEarlyOpps  — بطاقات الفرص المبكرة
      ⑤ octa-pages.js · dvTabs         — أقرب استحقاق (رمز + اسم)
      ⑥ octa-pages.js · openTradingView— مودال TradingView (رمز + اسم)
      ⑦ octa-core.js  · searchStock    — نص البحث (reflected) + اسم السهم
      ⑧ octa-core.js  · renderAiError  — رسالة الخطأ من الـAPI

   ⛔ مافيش شبكة · مافيش نشر · مافيش تنفيذ كود (payload ساذج).
   📌 التشغيل:  node --test assets/tests/sec024-xss-fixes.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

/* ⛔ payload ساذج (مش بيأذي) — بيتحقّق إن الـHTML اترمَّز */
const XSS = '<img src=x onerror="window.__xss=1">';
const RAW = XSS;

/* ═══ DOM مصغّر ═══ */
function makeEl(id) {
  const el = {
    id: id, dataset: {}, innerHTML: '', textContent: '', value: '', checked: false,
    disabled: false, style: { display: '' }, _l: {}, children: [],
    parentNode: null,
    classList: {
      _s: new Set(),
      toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) { this._s.add(c); } else { this._s.delete(c); } },
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    addEventListener(t, fn) { (el._l[t] = el._l[t] || []).push(fn); },
    removeEventListener() { }, remove() { },
    appendChild(c) { el.children.push(c); c.parentNode = el; return c; },
    insertBefore(c) { el.children.push(c); return c; },
    contains() { return false; },
    setAttribute() { }, getAttribute() { return null; }, focus() { },
    querySelector() { return makeEl('q'); }, querySelectorAll() { return []; },
    scrollIntoView() { }, click() { }
  };
  return el;
}

const parentStub = { insertBefore() { }, appendChild() { } };

/* ═══ بيئة تشغيل ═══ */
function mkSandbox(o) {
  const opt = o || {};
  const els = {};
  const doc = {
    addEventListener() { }, removeEventListener() { },
    createElement: (t) => makeEl('new-' + t),
    getElementById: (id) => {
      if (!els[id]) { els[id] = makeEl(id); els[id].parentNode = parentStub; }
      return els[id];
    },
    querySelector: () => makeEl('q'), querySelectorAll: () => [],
    body: makeEl('body'), head: makeEl('head'), documentElement: makeEl('html')
  };
  const win = {
    document: doc,
    OCTA_API: '',
    location: { protocol: 'https:', host: 'octashares.com', href: 'https://octashares.com/', hash: '', search: '' },
    addEventListener() { }, removeEventListener() { },
    setTimeout: (f) => { try { f(); } catch (e) { } },
    clearTimeout() { }, setInterval: () => 0, clearInterval() { },
    fetch: opt.fetchImpl || (() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })),
    AbortController: function () { this.abort = () => { }; },
    localStorage: {
      getItem: (k) => (opt.token ? 'octa_token' : null),
      setItem: () => { }, removeItem: () => { }
    },
    console: console,
    requestAnimationFrame: (f) => { try { f(); } catch (e) { } },
    matchMedia: () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } }),
    navigator: { userAgent: 'node-test' },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    innerWidth: 1200, innerHeight: 800, scrollTo() { }, scrollY: 0, pageYOffset: 0,
    /* globals بتتحمّل من ملفات تانية — بنوفّرها هنا */
    CFG: { weights: { intel: {} }, engineWeights: {} },
    AXIS_LABELS: { technical: 'فني', fundamental: 'أساسي' },
    EGX_STOCKS: [], EGX_SEARCH_INDEX: [],
    OS_DB: []
  };
  win.octaFetch = function (u, oo) { return win.fetch(u, oo); };
  win.window = win; win.self = win; win.top = win;
  const ctx = vm.createContext(win);
  for (const f of (opt.files || ['octa-pages.js', 'octa-core.js'])) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8'), ctx,
      { filename: f });
  }
  return { ctx: ctx, win: win, els: els, doc: doc };
}

/* ⛔ لازم النص الحرّ **ما يظهرش خام** في الـHTML
   📌 الفحص: مافيش وسم `<img` خام (يعني مافيش HTML اتركّب)،
      ومافيش `onerror="` خام (يعني مافيش كسر لخاصية).
   📌 ⛔ حسّاس لحالة الأحرف (بعض الكود بيعمل toUpperCase على المدخل). */
function assertNoRawHtml(html, where) {
  const low = String(html || '').toLowerCase();
  assert.ok(low.indexOf('<img') === -1,
    where + ': HTML خام اتركّب في الـDOM ⇒ XSS: ' + html.slice(0, 200));
  assert.ok(low.indexOf('onerror="') === -1,
    where + ': معالج حدث خام اتركّب ⇒ XSS: ' + html.slice(0, 200));
}

/* ══════════════════════════════════════════════════════════════════════
   ① armNews — جدول الأحداث المعلنة (octa-pages.js)
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-024-① · armNews: اسم الشركة من الـAPI بيترمَّز', async () => {
  const payload = {
    actions: [{
      code: 'XSSS', nameAr: RAW, kindAr: 'نقدي', value: '10',
      date: '2026-01-01', status: 'upcoming'
    }]
  };
  const sb = mkSandbox({
    fetchImpl: () => Promise.resolve({ ok: true, json: () => Promise.resolve(payload) })
  });
  const box = sb.doc.getElementById('newsBox');
  await sb.win.armNews(box);
  const html = box.innerHTML;
  assert.ok(html.indexOf('XSSS') > -1, 'الرمز المفروض يفضل ظاهر: ' + html.slice(0, 200));
  assertNoRawHtml(html, 'armNews');
  assert.ok(html.indexOf('&lt;img') > -1, 'المفروض النص متحوّل لـHTML مشفّر: ' + html.slice(0, 200));
});

/* ══════════════════════════════════════════════════════════════════════
   ② renderStrategies — اسم الاستراتيجية + التركيز + الملاحظات
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-024-② · renderStrategies: اسم الاستراتيجية والتركيز بيترمَّزوا', async () => {
  const strategies = { strategies: [{ key: 'balanced', name: RAW }] };
  const strategy = {
    strategy: {
      strategy_name: RAW, timeframe: RAW, focus: RAW, score: RAW,
      decision: RAW, confidence: 90, base: 80, axes: {}, filter_notes: [RAW]
    }
  };
  const sb = mkSandbox({
    fetchImpl: (u) => {
      const s = String(u);
      if (s.indexOf('/api/strategies') > -1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(strategies) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(strategy) });
    }
  });
  await sb.win.renderStrategies('COMI');
  const html = sb.doc.getElementById('stratBox').innerHTML;
  assert.ok(html.indexOf('COMI') === -1 && html.length > 0, 'الصفحة اتبنت');
  assertNoRawHtml(html, 'renderStrategies');
});

/* ══════════════════════════════════════════════════════════════════════
   ③ renderIntel — اسم السهم + الأسباب + أوصاف المخاطر
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-024-③ · renderIntel: اسم السهم والأسباب بيترمَّزوا', async () => {
  const sb = mkSandbox();
  const d = {
    code: 'COMI', name: RAW, sector: RAW, price: 100, change: 1.5,
    confidence: 80, final_score: 70, decision: RAW,
    fundamental: { fair_value: 120, positives: [RAW], negatives: [RAW] },
    technical: { score: 60, signal: RAW, positives: [RAW], negatives: [RAW] },
    liquidity: { score: 50, risk_level: RAW },
    risk_engine: {
      safety_score: 70, risk_level: RAW,
      breakdown: { 'سوق': 5 },
      top_risks: [{ 'الوصف': RAW }]
    },
    data_ts: '2026-01-01T00:00:00'
  };
  sb.win.renderIntel(d);
  const html = sb.doc.getElementById('intelBody').innerHTML;
  assert.ok(html.indexOf('COMI') > -1, 'الرمز المفروض يفضل ظاهر');
  assertNoRawHtml(html, 'renderIntel');
});

/* ══════════════════════════════════════════════════════════════════════
   ④ loadEarlyOpps — بطاقات الفرص المبكرة
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-024-④ · loadEarlyOpps: اسم السهم ومرحلته بيترمَّزوا', async () => {
  const payload = {
    early_opportunities: [{ code: 'COMI', name: RAW, stage: RAW, score: 80, technical_score: 70, final_score: 75 }]
  };
  const sb = mkSandbox({
    token: true,
    fetchImpl: () => Promise.resolve({ ok: true, json: () => Promise.resolve(payload) })
  });
  await sb.win.loadEarlyOpps(true);
  const html = sb.doc.getElementById('earlyOpps').innerHTML;
  assert.ok(html.indexOf('COMI') > -1, 'الرمز المفروض يفضل ظاهر: ' + html.slice(0, 200));
  assertNoRawHtml(html, 'loadEarlyOpps');
});

/* ══════════════════════════════════════════════════════════════════════
   ⑤ dvTabs — أقرب استحقاق (رمز + اسم)
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-024-⑤ · dvTabs: اسم الشركة القريب بيترمَّز', () => {
  const sb = mkSandbox();
  vm.runInContext(
    'DV_DATA = { actions: [{ status:"upcoming", recordDate:"2027-01-01",'
    + ' distributionDate:"2027-02-01", code:"COMI", nameAr:' + JSON.stringify(RAW)
    + ', kind:"cash_dividend", value:5 }] };', sb.ctx);
  sb.win.dvTabs();
  const html = sb.doc.getElementById('dvTabs').innerHTML;
  assert.ok(html.indexOf('COMI') > -1, 'الرمز المفروض يفضل ظاهر: ' + html.slice(0, 200));
  assertNoRawHtml(html, 'dvTabs');
});

/* ══════════════════════════════════════════════════════════════════════
   ⑥ openTradingView — مودال TradingView
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-024-⑥ · openTradingView: الرمز والاسم بيترمَّزوا', () => {
  const sb = mkSandbox();
  sb.win.openTradingView(RAW, RAW);
  const modal = sb.doc.body.children[0];
  assert.ok(modal, 'المودال اتعمل');
  const html = modal.innerHTML;
  assertNoRawHtml(html, 'openTradingView');
});

/* ══════════════════════════════════════════════════════════════════════
   ⑦ searchStock — نص البحث (reflected) + اسم السهم
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-024-⑦ · searchStock: نص البحث بيترمَّز (reflected XSS)', () => {
  const sb = mkSandbox();
  sb.win.searchStock(RAW);
  const html = sb.doc.getElementById('search-result').innerHTML;
  assertNoRawHtml(html, 'searchStock');
});

/* ══════════════════════════════════════════════════════════════════════
   ⑧ renderAiError — رسالة الخطأ من الـAPI
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-024-⑧ · renderAiError: رسالة الخطأ من الـAPI بتترمَّز', () => {
  const sb = mkSandbox();
  sb.win.renderAiError(RAW, RAW);
  const html = sb.doc.getElementById('engineBars').innerHTML;
  assertNoRawHtml(html, 'renderAiError');
});

/* ══════════════════════════════════════════════════════════════════════
   ⑨ renderStockPage — صفحة السهم (اسم + قطاع + تفسير + إفصاحات)
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-024-⑨ · renderStockPage: حقول صفحة السهم من الـAPI بتترمَّز', () => {
  const sb = mkSandbox();
  vm.runInContext(
    'SI_CODE = "COMI";'
    + 'SI_DATA = { intel: { name:' + JSON.stringify(RAW) + ', sector:' + JSON.stringify(RAW)
    + ', price: 100, change: 1, confidence: 70, final_score: 60, decision:'
    + JSON.stringify(RAW) + ', data_ts: "2026-01-01T10:00:00", axes: {},'
    + ' fundamental: { valuation_status:' + JSON.stringify(RAW) + ', fair_value: 120 },'
    + ' technical: {}, liquidity: {} },'
    + ' explain: { explanation: { what_could_change_score: [' + JSON.stringify(RAW) + '],'
    + ' missing_data: [' + JSON.stringify(RAW) + '], top_positives: [] } },'
    + ' news: { actions: [{ code: "COMI", kindAr:' + JSON.stringify(RAW) + ', value: 5,'
    + ' distributionDate: "2026-02-01", status: "upcoming" }] } };', sb.ctx);
  sb.win.renderStockPage();
  const html = sb.doc.getElementById('siContent').innerHTML;
  assert.ok(html.length > 0, 'الصفحة اتبنت');
  assertNoRawHtml(html, 'renderStockPage');
});

/* ══════════════════════════════════════════════════════════════════════
   حارس ثابت: المواضع الثمانية بقالها ترميز
   ══════════════════════════════════════════════════════════════════════ */
test('SEC-024 · المواضع الثمانية بقالها ترميز في الكود', () => {
  const pages = fs.readFileSync(path.join(ROOT, 'assets/js/octa-pages.js'), 'utf8');
  const core = fs.readFileSync(path.join(ROOT, 'assets/js/octa-core.js'), 'utf8');
  const must = [
    ['pages', pages, 'ssEsc((e.nameAr||e.company||\'—\')'],
    ['pages', pages, 'ssEsc(e.code||\'—\')'],
    ['pages', pages, 'ssEsc(s.strategy_name)'],
    ['pages', pages, 'ssEsc(d.code)'],
    ['pages', pages, 'ssEsc(s.stage || \'فرصة مبكرة\')'],
    ['pages', pages, 'ssEsc(topUp.code)'],
    ['pages', pages, 'ssEsc(code)'],
    ['core', core, 'octaEsc(displayName)'],
    ['core', core, 'octaEsc(String(msg).slice(0, 80))'],
    ['pages', pages, 'ssEsc(intel.name || \'\')']
  ];
  for (const [name, src, needle] of must) {
    assert.ok(src.indexOf(needle) > -1, name + ': مافيش ترميز لـ «' + needle + '»');
  }
});
