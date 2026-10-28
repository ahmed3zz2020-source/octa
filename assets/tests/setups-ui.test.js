/* ══════════════════════════════════════════════════════════════
   🧪 اختبار واجهة «نماذجي» — assets/tests/setups-ui.test.js
   ──────────────────────────────────────────────────────────────
   التشغيل:  cd /workspace/repos/octa && node --test assets/tests/setups-ui.test.js
   📌 مافيش متصفح ⇒ DOM مصغّر + تحميل الملف في بيئة معزولة (vm).
   ⛔ مافيش شبكة — كل الأرقام من mock مبني على شكل الإشارة الحقيقي
      من /api/setups.
   ══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

/* ═══════════ DOM مصغّر ═══════════ */
function makeEl(id) {
  const el = {
    id: id, innerHTML: '', textContent: '', value: '', checked: false,
    style: { display: '' }, _l: {}, children: [],
    classList: {
      _s: new Set(),
      toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) { this._s.add(c); } else { this._s.delete(c); } },
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    addEventListener(t, fn) { (el._l[t] = el._l[t] || []).push(fn); },
    removeEventListener() { }, remove() { },
    appendChild(c) { el.children.push(c); return c; },
    setAttribute() { }, getAttribute() { return null; }, focus() { },
    /* ⛔ الـDOM المصغّر: querySelector بيرجّع عنصر وهمي (عشان الربط
       يقدر يشتغل في الاختبار) — مفيش معنى لاختيار عنصر حقيقي. */
    querySelector() { return makeEl('q'); }, querySelectorAll() { return []; },
    scrollIntoView() { }
  };
  return el;
}

function mkSandbox(fetchImpl) {
  const els = {};
  const doc = {
    createElement: (t) => makeEl('new-' + t),
    getElementById: (id) => (els[id] = els[id] || makeEl(id)),
    querySelectorAll: () => [],
    body: makeEl('body'),
    head: makeEl('head')
  };
  const win = {
    document: doc,
    OCTA_API: '',
    location: { protocol: 'https:', host: 'octashares.com', href: 'https://octashares.com/#setups', hash: '#setups' },
    addEventListener() { },
    setTimeout: (f) => { try { f(); } catch (e) { } },
    clearTimeout() { },
    fetch: fetchImpl || (() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })),
    /* octaFetch من octa-api.js — في الاختبار بيبعت على fetch مباشرة */
    octaFetch: function (u) { return win.fetch(u); },
    AbortController: function () { this.abort = () => { }; },
    localStorage: (function () {
      const st = {};
      return {
        getItem: (k) => (k in st ? st[k] : null),
        setItem: (k, v) => { st[k] = String(v); },
        removeItem: (k) => { delete st[k]; }
      };
    })(),
    console: console
  };
  win.window = win;
  win.self = win;
  const ctx = vm.createContext(win);
  return { ctx: ctx, win: win, els: els, doc: doc };
}

function loadUI(fetchImpl) {
  const sb = mkSandbox(fetchImpl);
  const code = fs.readFileSync(path.join(ROOT, 'assets/js/octa-setups.js'), 'utf8');
  vm.runInContext(code, sb.ctx, { filename: 'octa-setups.js' });
  return sb;
}

/* ═══════════ موك يطابق /api/setups الحقيقي ═══════════ */
function mkItem(o) {
  o = o || {};
  return {
    code: o.code || 'COMI',
    name: o.name || 'الcommercial',
    sector: 'بنوك',
    kind: 'BREAKOUT',
    direction: o.direction || 'up',
    level: o.level || 52.5,
    zone_low: 51.0, zone_high: 52.0,
    entry: o.entry || 52.4,
    stop: o.stop || 50.9,
    target: o.target || 55.4,
    rr: o.rr || 2.0,
    timeframe: '1D',
    detected_at: o.detected_at || '2026-10-27',
    confirmed: true,
    volume_confirmed: o.volume_confirmed !== false,
    trend: 'up',
    bars_since: 2,
    evidence: {
      touches: 3, reactions: 2, atr: 1.4, atr_pct: o.atr_pct || 2.6,
      distance_pct: 0.8, zone_score: 72, vol_ratio: 1.6, vol_avg20: 900000,
      close_beyond_pct: 0.8, measured_move: 1.0, target_method: 'measured_move',
      structure_label: 'كسر مقاومة', source: 'startamarkets', bars_used: 320,
      last_test: '2026-08-05', age_days: 77
    },
    why: 'كسر مقاومة 51.0 — 52.0 بثلاث إغلاقات وتأكيد حجم.'
  };
}

function mockApi(payload, status) {
  return function (url) {
    return Promise.resolve({
      ok: (status || 200) < 400,
      status: status || 200,
      json: () => Promise.resolve(payload)
    });
  };
}


/* ═══════════ loader لمكتبة الرسم (اختبار التحويل) ═══════════ */
function loadKit() {
  const sb = mkSandbox();
  const code = fs.readFileSync(path.join(ROOT, 'assets/js/octa-chartkit.js'), 'utf8');
  vm.runInContext(code, sb.ctx, { filename: 'octa-chartkit.js' });
  return sb.win.OCTAChartKit;
}

/* ═══════════ 1) التحمّل ═══════════ */
test('الواجهة بتتحمّل من غير crash', () => {
  const sb = loadUI();
  assert.ok(sb.win.OCTASetups, 'الـAPI متاحة');
  assert.equal(typeof sb.win.OCTASetups._test.renderTable, 'function');
});

/* ═══════════ 2) الجدول ═══════════ */
test('الجدول بيعرض الأنماط من الـAPI كما هي', async () => {
  const items = [mkItem({ code: 'COMI', name: 'تجاري' }), mkItem({ code: 'ETEL', name: 'اتصالات', direction: 'down' })];
  const sb = loadUI(mockApi({ ok: true, items: items, asof: '2026-10-27' }));
  sb.win.OCTASetups.state.items = items;
  sb.win.OCTASetups.state.loaded = true;
  sb.win.OCTASetups._test.render();
  const html = sb.els['suTableBox'].innerHTML;
  assert.ok(html.indexOf('COMI') >= 0, 'الرمز ظاهر');
  assert.ok(html.indexOf('تجاري') >= 0, 'الاسم ظاهر');
  assert.ok(html.indexOf('▲ كسر صعودي') >= 0, 'الاتجاه');
  assert.ok(html.indexOf('52.4') >= 0, 'سعر الدخول');
  assert.ok(html.indexOf('50.9') >= 0, 'الوقف');
  assert.ok(html.indexOf('55.4') >= 0, 'الهدف');
  assert.ok(html.indexOf('2') >= 0, 'العائد/المخاطرة');
});

test('⛔ مفيش undefined ولا NaN في الجدول', async () => {
  const items = [mkItem({})];
  const sb = loadUI(mockApi({ ok: true, items: items }));
  sb.win.OCTASetups.state.items = items;
  sb.win.OCTASetups.state.loaded = true;
  sb.win.OCTASetups._test.render();
  const html = sb.els['suTableBox'].innerHTML;
  assert.ok(html.indexOf('undefined') < 0, 'مفيش undefined');
  assert.ok(html.indexOf('NaN') < 0, 'مفيش NaN');
});

/* ═══════════ 3) الفلاتر ═══════════ */
test('فلتر البحث والاتجاه والعائد يشتغلوا', async () => {
  const items = [
    mkItem({ code: 'COMI', name: 'تجاري', direction: 'up', rr: 2.5 }),
    mkItem({ code: 'ETEL', name: 'اتصالات', direction: 'down', rr: 1.2 })
  ];
  const sb = loadUI(mockApi({ ok: true, items: items }));
  const S = sb.win.OCTASetups.state;
  S.items = items; S.loaded = true;
  sb.win.OCTASetups._test.render();

  assert.equal(S.filtered.length, 2, 'الكل');

  S.q = 'اتصالات';
  sb.win.OCTASetups._test.applyFilters();
  assert.equal(S.filtered.length, 1, 'البحث بالاسم');
  assert.equal(S.filtered[0].code, 'ETEL');

  S.q = '';
  S.dir = 'up';
  sb.win.OCTASetups._test.applyFilters();
  assert.equal(S.filtered.length, 1, 'فلتر الاتجاه');
  assert.equal(S.filtered[0].code, 'COMI');

  S.dir = 'all';
  S.rr = 2;
  sb.win.OCTASetups._test.applyFilters();
  assert.equal(S.filtered.length, 1, 'فلتر العائد/المخاطرة');

  S.rr = 0;
  S.volOnly = true;
  sb.win.OCTASetups._test.applyFilters();
  assert.equal(S.filtered.length, 2, 'كلهم تأكيد حجم');
});

/* ═══════════ 4) الباقة المقفولة ═══════════ */
test('لما الباقة مقفولة (403) ⇒ لوحة الباقة مش جدول فاضي', () => {
  const sb = loadUI(mockApi({ ok: false, locked: true }, 403));
  sb.win.OCTASetups.state.locked = true;
  sb.win.OCTASetups.state.loaded = true;
  sb.win.OCTASetups._test.render();
  const html = sb.els['suBody'].innerHTML;
  assert.ok(html.indexOf('باقة') >= 0, 'لوحة الباقة');
  assert.ok(html.indexOf('نماذجي') >= 0, 'اسم الباقة');
  assert.ok(html.indexOf('مش توصية') >= 0, 'تنويه عدم نصيحة');
});

/* ═══════════ 5) المودال ═══════════ */
test('مودال التفاصيل فيه الدخول والوقف والهدف وزر صفحة السهم', () => {
  const items = [mkItem({})];
  const sb = loadUI(mockApi({ ok: true, items: items }));
  sb.win.OCTASetups.state.items = items;
  sb.win.OCTASetups.state.loaded = true;
  sb.win.OCTASetups._test.render();
  sb.win.OCTASetups._test.openDetail('COMI');
  const ov = sb.doc.body.children[0];
  assert.ok(ov, 'المودال اتضاف');
  const html = ov.innerHTML;
  assert.ok(html.indexOf('52.4') >= 0, 'الدخول');
  assert.ok(html.indexOf('50.9') >= 0, 'الوقف');
  assert.ok(html.indexOf('55.4') >= 0, 'الهدف');
  assert.ok(html.indexOf('افتح صفحة السهم') >= 0, 'زر صفحة السهم');
  assert.ok(html.indexOf('tradingview.com') >= 0, 'زر TradingView');
  assert.ok(html.indexOf('كسر مقاومة') >= 0, 'سبب النمط');
});

/* ═══════════ 6) الأرقام ═══════════ */
test('تنسيق الأرقام: الأسعار والأرقام الفارغة', () => {
  const sb = loadUI();
  const T = sb.win.OCTASetups._test;
  assert.equal(T.fmtPrice(52.4), '52.4');
  assert.equal(T.fmtPrice(120), '120');
  assert.equal(T.num(null, '—'), '—');
  assert.equal(T.num(undefined, '—'), '—');
  assert.equal(T.num(0, '—'), 0, '⛔ الصفر رقم مش naN');
});


/* ═══════════ 8) كروت الأسهم بدل الجدول ═══════════ */
test('الجدول اتحول لكروت — مفيش سحب أفقي', async () => {
  const items = [mkItem({ code: 'COMI', name: 'تجاري' }), mkItem({ code: 'ETEL', name: 'اتصالات' })];
  const sb = loadUI(mockApi({ ok: true, items: items }));
  sb.win.OCTASetups.state.items = items;
  sb.win.OCTASetups.state.loaded = true;
  sb.win.OCTASetups._test.render();
  const html = sb.els['suTableBox'].innerHTML;
  assert.ok(html.indexOf('su-card') >= 0, 'الكارت موجود');
  assert.ok(html.indexOf('su-cards') >= 0, 'حاوية الكروت');
  assert.ok(html.indexOf('<table') < 0, 'مفيش جدول');
  assert.ok(html.indexOf('su-tablewrap') < 0, 'مفيش سحب أفقي');
  assert.ok(html.indexOf('COMI') >= 0 && html.indexOf('ETEL') >= 0, 'الأسهم كلها');
});

test('الكارت فيه كل المعلومات (مستويات + ع/م + تذبذب + تاريخ)', async () => {
  const items = [mkItem({ code: 'COMI', name: 'تجاري' })];
  const sb = loadUI(mockApi({ ok: true, items: items }));
  sb.win.OCTASetups.state.items = items;
  sb.win.OCTASetups.state.loaded = true;
  sb.win.OCTASetups._test.render();
  const html = sb.els['suTableBox'].innerHTML;
  ['المستوى', 'الدخول', 'الوقف', 'الهدف'].forEach(function (k) {
    assert.ok(html.indexOf(k) >= 0, 'الحقل ' + k);
  });
  assert.ok(html.indexOf('ع/م') >= 0, 'العائد/المخاطرة');
  assert.ok(html.indexOf('تذبذب') >= 0, 'التذبذب');
  assert.ok(html.indexOf('يوم الكسر') >= 0, 'يوم الكسر');
  assert.ok(html.indexOf('2026-10-27') >= 0, 'تاريخ الكسر');
  assert.ok(html.indexOf('لمسات') >= 0, 'لمسات النطاق');
});

/* ═══════════ 9) تبويب TradingView ═══════════ */
test('تبويب TradingView بيطلّع iframe بالرمز الصح', async () => {
  const items = [mkItem({ code: 'COMI' })];
  const sb = loadUI(mockApi({ ok: true, items: items }));
  sb.win.OCTASetups.state.items = items;
  sb.win.OCTASetups.state.loaded = true;
  sb.win.OCTASetups._test.render();
  const html = sb.win.OCTASetups._test.tvBoxHtml('COMI');
  assert.ok(html.indexOf('tradingview.com/widgetembed') >= 0, 'الـwidget');
  assert.ok(html.indexOf('EGX%3ACOMI') >= 0, 'الرمز EGX:COMI');
  assert.ok(html.indexOf('tradingview.com/chart') >= 0, 'زرار فتح TradingView');
});

/* ═══════════ 10) خطوط السعر (رسم النمط) ═══════════ */
test('خطوط السعر: مستوى ودخول ووقف وهدف', () => {
  const sb = loadUI();
  const lines = sb.win.OCTASetups._test.priceLines({
    code: 'COMI', level: 52.0, entry: 52.4, stop: 50.9, target: 55.4,
    setup: { level: 52.0, entry_ref: 52.4, stop: 50.9, target: 55.4, rr: 2 }
  });
  const titles = lines.map(function (l) { return l.title; }).join('|');
  assert.ok(titles.indexOf('مستوى الكسر') >= 0, 'المستوى');
  assert.ok(titles.indexOf('الدخول') >= 0, 'الدخول');
  assert.ok(titles.indexOf('الوقف') >= 0, 'الوقف');
  assert.ok(titles.indexOf('الهدف') >= 0, 'الهدف');
});

/* ═══════════ 11) ⛔ إصلاح باج الشارت الفاضي ═══════════ */
test('⛔ تحويل الأعمدة (t/o/h/l/c/v) لصفوف — الباج القديم', () => {
  const sb = loadUI();
  const kit = loadKit();
  const json = {
    cached: true,
    codes: {
      COMI: {
        t: ['2026-10-01', '2026-10-02', '2026-10-05'],
        o: [10, 11, 12], h: [12, 13, 14], l: [9, 10, 11],
        c: [11, 12, 13], v: [100, 200, 300]
      }
    }
  };
  const rows = kit.rowsFromHistory(json, 'COMI');
  assert.equal(rows.length, 3, '3 صفوف');
  assert.equal(rows[0].time, '2026-10-01', 'التاريخ');
  assert.equal(rows[0].close, 11, 'الإغلاق');
  assert.equal(rows[2].high, 14, 'الأعلى');
  assert.equal(rows[2].volume, 300, 'الحجم');
  assert.equal(kit.rowsFromHistory(json, 'NOPE').length, 0, 'رمز مش موجود ⇒ فاضي');
  assert.equal(kit.rowsFromHistory(null, 'COMI').length, 0, 'مافيش بيانات');
});

test('⛔ تحويل الشكل القديم (مصفوفة كائنات) لسماوات', () => {
  const kit = loadKit();
  const rows = kit.rowsFromHistory(
    { candles: [{ t: '2026-10-01', o: 1, h: 2, l: 0.5, c: 1.5, v: 9 }] }, 'COMI');
  assert.equal(rows.length, 1, 'صف واحد');
  assert.equal(rows[0].close, 1.5, 'الإغلاق');
});

test('⛔ شموع ناقصة (سعر صفري) بتتتشال — عشان مقياس السعر يفضل صح', () => {
  const kit = loadKit();
  const rows = kit.rowsFromHistory({
    codes: { C: { t: ['2026-10-01', '2026-10-02'], o: [1, 0], h: [2, 0], l: [0.5, 0], c: [1.5, 0], v: [1, 1] } }
  }, 'C');
  assert.equal(rows.length, 1, 'اتشالت الشمعة الفاضية');
});

/* ═══════════ 12) 🎨 الرسم الاحترافي — المسار كامل (canvas stub) ═══════════ */
test('🎨 mountPattern بيرسم من غير exception (canvas + إحداثيات وهمية)', async () => {
  const sb = mkSandbox();
  /* 🖌️ stub للرسم: بنسجّل كل نداء */
  const calls = { fillRect: 0, moveTo: 0, fill: 0, stroke: 0, setLineDash: 0 };
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k === 'canvas') return { width: 400, height: 300 };
      if (typeof k === 'string' && k in calls) return function () { calls[k]++; };
      if (k === 'measureText') return function () { return { width: 10 }; };
      /* 🖌️ أي دالة تانية ⇒ no-op (زي الـcanvas الحقيقي) */
      if (typeof k === 'string') return function () { };
      return undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });

  const fakeSeries = {
    setData() { }, createPriceLine(o) { (fakeSeries.lines = fakeSeries.lines || []).push(o); },
    priceToCoordinate(p) { return 150 - p; }
  };
  const fakeChart = {
    __octaSeries: fakeSeries,
    addSeries() { return fakeSeries; },
    timeScale() {
      return {
        fitContent() { },
        timeToCoordinate(t) { return 10 + String(t).length * 3; },
        subscribeVisibleLogicalRangeChange(fn) { fakeChart._onRange = fn; }
      };
    },
    priceScale() { return { width: () => 60 }; },
    subscribeClick() { }
  };

  sb.win.LightweightCharts = {
    createChart: () => fakeChart,
    CandlestickSeries: 'candle',
    HistogramSeries: 'hist'
  };
  sb.win.devicePixelRatio = 2;
  /* 🖌️ canvas stub */
  const origCreate = sb.doc.createElement;
  sb.doc.createElement = function (tag) {
    const el = origCreate(tag);
    if (String(tag).toLowerCase() === 'canvas') {
      el.getContext = () => ctx;
      el.width = 0; el.height = 0;
      el.style = {};
    }
    return el;
  };
  sb.win.innerWidth = 400;

  const code = fs.readFileSync(path.join(ROOT, 'assets/js/octa-chartkit.js'), 'utf8');
  vm.runInContext(code, sb.ctx, { filename: 'octa-chartkit.js' });
  const kit = sb.win.OCTAChartKit;

  const rows = kit.rowsFromHistory({
    codes: {
      COMI: {
        t: ['2026-08-01', '2026-09-01', '2026-10-01', '2026-10-14', '2026-10-27'],
        o: [50, 51, 52, 53, 55], h: [52, 53, 54, 55, 57],
        l: [49, 50, 51, 52, 54], c: [51, 52, 53, 54, 56], v: [1, 2, 3, 4, 5]
      }
    }
  }, 'COMI');

  const box = makeEl('chartbox');
  box.clientWidth = 400; box.clientHeight = 320;
  box.style = {};

  const chart = await kit.mountPattern(box, rows, {
    lines: [{ price: 52, color: '#a855f7', title: 'مستوى الكسر' }],
    volume: true, height: 320,
    pattern: {
      zone_low: 50, zone_high: 52, detect_at: '2026-10-14', age_days: 77,
      entry: 53, stop: 49, target: 61
    }
  });
  assert.ok(chart, 'الشارت اتعمل');
  assert.ok(calls.fillRect >= 3, 'اترسمت المستطيلات (نطاق + عائد + مخاطرة) · ' + calls.fillRect);
  assert.ok(calls.fill >= 3, 'اترسمت علامات الكسر · ' + calls.fill);
  assert.ok(calls.moveTo >= 2, 'اترسمت الخطوط');
  /* ⛔⛔ مافيش price lines: كانت بتلخبط محور السعر (ملصق لكل مستوى)
     وبتموّد المقياس ⇒ المستويات على canvas والتسميات في الـlegend. */
  assert.ok(!fakeSeries.lines || fakeSeries.lines.length === 0,
    'مافيش price lines على محور السعر');
  /* ⭐ الـlegend: HTML فيه التسميات العربية والأرقام */
  const lg = kit.legendHTML([
    { label: 'مستوى الكسر', price: '52', color: '#a855f7' },
    { label: 'الدخول', price: '53', color: '#d4af37', tag: 'مُقاس' }
  ]);
  assert.ok(lg.indexOf('مستوى الكسر') >= 0, 'التسمية العربية في الـlegend');
  assert.ok(lg.indexOf('مُقاس') >= 0, 'وسم المقاس في الـlegend');
  assert.ok(lg.indexOf('52') >= 0, 'الرقم في الـlegend');
});

/* ═══════════ 16.5) 🛡️ حمايات الشارت (باجات ٢٨ أكتوبر ٢٠٢٦) ═══════════ */
test('🛡️ الحجم pane لوحده + الارتفاع متزامن + الـlegend بره الشارت + إشعار الرخصة', async () => {
  const sb = mkSandbox();
  const calls = { addSeries: [] };
  const fakeSeries = {
    setData() { }, createPriceLine(o) { (fakeSeries.lines = fakeSeries.lines || []).push(o); },
    priceToCoordinate(p) { return 150 - p; }
  };
  const fakePanes = [
    { getHeight: () => 240, setStretchFactor(f) { calls.pane0Stretch = f; } },
    { getHeight: () => 80, setStretchFactor(f) { calls.pane1Stretch = f; } }
  ];
  const fakeChart = {
    __octaSeries: fakeSeries,
    addSeries(def, opts, paneIdx) { calls.addSeries.push({ def, opts, paneIdx }); return fakeSeries; },
    panes() { return fakePanes; },
    timeScale() {
      return {
        fitContent() { }, setVisibleLogicalRange() { },
        timeToCoordinate(t) { return 10 + String(t).length * 3; },
        subscribeVisibleLogicalRangeChange(fn) { fakeChart._onRange = fn; },
        height: () => 28
      };
    },
    priceScale() { return { width: () => 60 }; },
    subscribeClick() { },
    applyOptions() { }
  };
  sb.win.LightweightCharts = {
    createChart: (el, o) => { calls.createOpts = o; return fakeChart; },
    CandlestickSeries: 'candle', HistogramSeries: 'hist', LineSeries: 'line'
  };
  sb.win.devicePixelRatio = 2;
  const origCreate = sb.doc.createElement;
  sb.doc.createElement = function (tag) {
    const el = origCreate(tag);
    if (String(tag).toLowerCase() === 'canvas') {
      el.getContext = () => new Proxy({}, {
        get(t, k) {
          if (k === 'canvas') return { width: 400, height: 300 };
          if (typeof k === 'string') return function () { };
          return undefined;
        },
        set(t, k, v) { t[k] = v; return true; }
      });
    }
    return el;
  };

  const code = fs.readFileSync(path.join(ROOT, 'assets/js/octa-chartkit.js'), 'utf8');
  vm.runInContext(code, sb.ctx, { filename: 'octa-chartkit.js' });
  const kit = sb.win.OCTAChartKit;

  const rows = kit.rowsFromHistory({
    codes: { COMI: { t: ['2026-10-01', '2026-10-14', '2026-10-27'],
      o: [50, 51, 52], h: [52, 53, 54], l: [49, 50, 51], c: [51, 52, 53], v: [1, 2, 3] } }
  }, 'COMI');

  const box = makeEl('chartbox');
  box.clientWidth = 400; box.clientHeight = 300;
  box.style = {};
  const parent = makeEl('parent');
  parent.appendChild = function (el) { parent._child = el; };
  box.parentNode = parent;

  const legendBox = makeEl('legendbox');
  legendBox.innerHTML = ''; legendBox.style = {};

  await kit.mountPattern(box, rows, {
    lines: [{ price: 52, color: '#a855f7' }],
    volume: true, height: 320,
    legend: [{ label: 'مستوى الكسر', price: '52', color: '#a855f7' }],
    legendBox: legendBox,
    pattern: { zone_low: 50, zone_high: 52, detect_at: '2026-10-14', age_days: 30,
      entry: 53, stop: 49, target: 61 }
  });

  /* ① ⛔ الحجم في pane لوحده (مش overlay) */
  const vol = calls.addSeries.find(a => a.def === 'hist');
  assert.ok(vol, 'سلسلة الحجم اتعملت');
  assert.equal(vol.paneIdx, 1, '⛔ الحجم في pane 1 (مش overlay على pane السعر)');
  assert.notEqual(vol.opts.priceScaleId, '', '⛔ الحجم مش overlay scale');
  assert.equal(vol.opts.lastValueVisible, false, '⛔ مافيش ملصق آخر قيمة للحجم');
  assert.ok(calls.pane1Stretch > 0, '⛔ pane الحجم له طول (stretch factor)');
  /* ② ⛔ مافيش price lines */
  assert.ok(!fakeSeries.lines || fakeSeries.lines.length === 0, '⛔ مافيش price lines');
  /* ③ ⛔ الارتفاع متزامن (مافيش سرّب فوق الكروت) */
  assert.equal(calls.createOpts.height, 320, '⛔ ارتفاع الشارت = الارتفاع المطلوب');
  assert.equal(box.style.height, '320px', '⛔ البوكسtook نفس ارتفاع الشارت');
  assert.equal(box.style.overflow, 'hidden', '⛔ البوكس بيقص أي تسرّب');
  /* ④ ⛔ الـlegend بره الشارت */
  assert.ok(legendBox.innerHTML.indexOf('مستوى الكسر') >= 0, '⛔ الـlegend اتحط في الحاوية');
  assert.ok(!box._child || box._child.className !== 'octa-legend',
    '⛔ الـlegend مش جوه صندوق الشارت');
  /* ⑤ ⚖️ إشعار الرخصة (شرط شيل لوجو TradingView) */
  assert.equal(calls.createOpts.layout.attributionLogo, false, '⛔ لوجو TradingView مش داخل الشارت');
  assert.ok(legendBox.innerHTML.indexOf('tradingview.com') >= 0,
    '⛔ إشعار الرخصة + رابط tradingview.com موجود');
});

/* ═══════════ 17) 📐 التحليل الفني الكامل ═══════════ */
test('📐 نافذة «التحليل الكامل» فيها الشارت + التحليل + levels', async () => {
  const sb = loadUI(mockApi({ ok: true, items: [mkItem({})] }));
  const it = mkItem({});
  it.setup = { level: 52.0, entry_ref: 52.4, stop: 50.9, target: 55.4, rr: 3.2,
    stop_atr: 1, target_atr: 4, entry_deep: 51.5, target_partial: 53.9 };
  it.zone_low = 51.0; it.zone_high = 52.0; it.trend = 'up'; it.market_above_ema200 = true;
  sb.win.OCTASetups._test.openAnalysis(it);
  /* 📌 الـDOM المصغّر: المودال بيتضاف في body.children */
  const modal = sb.win.document.body.children[0];
  const html = modal.innerHTML;
  assert.ok(html.indexOf('suAnChart') >= 0, 'الشارت موجود');
  assert.ok(html.indexOf('suAnTv') >= 0, 'تبويب TradingView موجود');
  assert.ok(html.indexOf('التحليل الفني') >= 0, 'بلوك التحليل الفني');
  assert.ok(html.indexOf('مُقاس') >= 0, 'المستويات المُقاسة متعلّمة');
  assert.ok(html.indexOf('إدارة — مش مقاس') >= 0, 'مستويات الإدارة متعلّمة إنها مش مقاسة');
  assert.ok(html.indexOf('البنية') >= 0, 'البنية');
  assert.ok(html.indexOf('الحجم') >= 0, 'الحجم');
  assert.ok(html.indexOf('عائد/مخاطرة') >= 0, 'ع/م');
  assert.ok(html.indexOf('undefined') < 0, 'مفيش undefined');
  assert.ok(html.indexOf('NaN') < 0, 'مفيش NaN');
});

test('📐 الكارت فيه زرار «التحليل الكامل»', async () => {
  const sb = loadUI(mockApi({ ok: true, items: [mkItem({})] }));
  sb.win.OCTASetups.state.items = [mkItem({})];
  sb.win.OCTASetups.state.loaded = true;
  sb.win.OCTASetups._test.render();
  const html = sb.els['suTableBox'].innerHTML;
  assert.ok(html.indexOf('التحليل الكامل') >= 0, 'الزرار موجود');
  assert.ok(html.indexOf('data-act="analysis"') >= 0, 'الزرار مربوط');
});

test('📐 أرقام التحليل كلها من الـAPI (مفيش مخترع)', async () => {
  const sb = loadUI(mockApi({ ok: true, items: [mkItem({})] }));
  const it = mkItem({});
  const html = sb.win.OCTASetups._test.analysisHTML(it);
  assert.ok(html.indexOf('كسر مقاومة') >= 0, 'البنية من الـevidence');
  assert.ok(html.indexOf('×1.60') >= 0, 'نسبة الحجم من الـevidence');
  assert.ok(html.indexOf('2.6%') >= 0, 'ATR% من الـevidence');
  assert.ok(html.indexOf(String(it.evidence.last_test)) >= 0, 'آخر اختبار من الـevidence');
  assert.ok(html.indexOf('undefined') < 0, 'مفيش undefined');
  assert.ok(html.indexOf('NaN') < 0, 'مفيش NaN');
});

/* ═══════════ 19) ⭐ نطاق مؤشر EGX30 ═══════════ */
test('⭐ القائمة بتفتح على نطاق EGX30 + بتعرض النطاق من الخادم', () => {
  const sb = loadUI(mockApi({ ok: true, items: [mkItem({})], scope: 'egx30',
    scope_label: 'أسهم مؤشر EGX30', scope_count: 1, scope_total: 9,
    scope_codes: ['COMI', 'EAST'] }));
  const S = sb.win.OCTASetups.state;
  S.items = [mkItem({})];
  S.loaded = true;
  S.scopeInfo = { scope: 'egx30', scope_label: 'أسهم مؤشر EGX30',
                  scope_count: 1, scope_total: 9, scope_codes: ['COMI', 'EAST'] };
  sb.win.OCTASetups._test.render();
  assert.equal(S.scope, 'egx30', 'النطاق الافتراضي = مؤشر EGX30');
  assert.ok(S.scopeInfo && S.scopeInfo.scope_label === 'أسهم مؤشر EGX30',
            'النطاق جاي من الـAPI');
});

test('⭐ زر النطاق بيبدّل بين EGX30 وكل الأسهم', () => {
  const sb = loadUI(mockApi({ ok: true, items: [] }));
  const btn = sb.els['suScope'];
  assert.ok(btn, 'زرار النطاق موجود');
  const before = sb.win.OCTASetups.state.scope;
  btn._l['click'][0]();
  const after = sb.win.OCTASetups.state.scope;
  assert.notEqual(before, after, 'النطاق اتبدّل');
  assert.ok(after === 'all' || after === 'egx30', 'القيمة صح');
});

test('⭐ الـlegend بيلوّن المستويات (نطاق · دخول · هدف · وقف)', () => {
  const sb = loadUI(mockApi({ ok: true, items: [] }));
  const it = mkItem({});
  it.setup = { level: 52.0, entry_ref: 52.4, stop: 50.9, target: 55.4, rr: 3.2,
    entry_deep: 51.5, target_partial: 53.9 };
  it.zone_low = 51.0; it.zone_high = 52.0;
  const lg = sb.win.OCTASetups._test.legendOf(it);
  const labels = lg.map(function (x) { return x.label; }).join('|');
  assert.ok(labels.indexOf('نطاق الكسر') >= 0, 'النطاق');
  assert.ok(labels.indexOf('الدخول') >= 0, 'الدخول');
  assert.ok(labels.indexOf('الهدف') >= 0, 'الهدف');
  assert.ok(labels.indexOf('الوقف') >= 0, 'الوقف');
  assert.ok(labels.indexOf('دخول أعمق') >= 0, 'دخول أعمق');
  assert.ok(lg.every(function (x) { return x.price != null && x.price !== 'undefined'; }),
            'كل صف في الـlegend له سعر');
});

/* ═══════════ 📋 نقل المستويات لـTradingView (٢٨ أكتوبر ٢٠٢٦) ═══════════ */

function mkTvItem(o) {
  o = o || {};
  const it = mkItem(o);
  it.code = o.code || 'EAST';
  it.name = o.name || 'الشرقية للدخان';
  it.direction = o.direction || 'up';
  it.detected_at = o.detected_at || '2026-10-25';
  it.entry = o.entry || 29.634;
  it.stop = o.stop || 28.692;
  it.target = o.target || 32.1459;
  it.level = o.level || 29.32;
  it.rr = o.rr || 2.67;
  it.setup = o.setup || {
    entry_ref: 29.634, stop: 28.064, target: 34.658, level: 29.32,
    entry_deep: 29.32, target_partial: 32.146, rr: 3.2,
    stop_atr: 1.0, target_atr: 4.0
  };
  return it;
}

test('⭐ سكربت TradingView بيتولّد: نسخة 6 + مؤشر + المستويات الأربعة', () => {
  const sb = loadUI(mockApi({ ok: true, items: [] }));
  const pine = sb.win.OCTASetups._test.pineFor(mkTvItem({}));
  assert.ok(pine.indexOf('//@version=6') === 0, 'نسخة Pine 6');
  assert.ok(pine.indexOf('indicator(') >= 0, 'مؤشر');
  assert.ok(pine.indexOf('overlay=true') >= 0, 'overlay');
  assert.ok(pine.indexOf('iEntry  = input.float(29.634') >= 0, 'الدخول');
  assert.ok(pine.indexOf('iStop   = input.float(28.064') >= 0, 'الوقف');
  assert.ok(pine.indexOf('iTarget = input.float(34.658') >= 0, 'الهدف');
  assert.ok(pine.indexOf('iBreak  = input.float(29.320') >= 0, 'مستوى الكسر');
});

test('⭐ شروط الإنذار بتتظبط حسب اتجاه الكسر', () => {
  const sb = loadUI(mockApi({ ok: true, items: [] }));
  const up = sb.win.OCTASetups._test.pineFor(mkTvItem({ direction: 'up' }));
  assert.ok(up.indexOf('alertcondition(close >= iTarget') >= 0, 'صعودي: الهدف فوق');
  assert.ok(up.indexOf('alertcondition(close <= iStop') >= 0, 'صعودي: الوقف تحت');
  const dn = sb.win.OCTASetups._test.pineFor(mkTvItem({
    direction: 'down',
    setup: { entry_ref: 10.5, stop: 11.2, target: 8.9, level: 10.8 }
  }));
  assert.ok(dn.indexOf('alertcondition(close <= iTarget') >= 0, 'هبوطي: الهدف تحت');
  assert.ok(dn.indexOf('alertcondition(close >= iStop') >= 0, 'هبوطي: الوقف فوق');
});

test('⭐ مستويات الإدارة متداخلة جوه if showAdmin (مش على نفس المسافة)', () => {
  const sb = loadUI(mockApi({ ok: true, items: [] }));
  const pine = sb.win.OCTASetups._test.pineFor(mkTvItem({}));
  const lines = pine.split('\n');
  const ifIdx = lines.findIndex(function (l) { return l.trim() === 'if showAdmin'; });
  assert.ok(ifIdx >= 0, 'الكتلة موجودة');
  const body = lines.slice(ifIdx + 1).filter(function (l) { return l.trim() && l.indexOf('iDeep') >= 0 || l.indexOf('iPart') >= 0; });
  assert.ok(body.length >= 2, 'فيه سطور الإدارة');
  body.forEach(function (l) {
    const ind = l.match(/^\s*/)[0].length;
    const ifInd = lines[ifIdx].match(/^\s*/)[0].length;
    assert.ok(ind > ifInd, 'السطر متداخل جوه الـif (Pine بيرفض غير كده): ' + l.trim());
  });
});

test('⭐ السكربت ما فيهوش نقاط ناقصة + فيه تنويه «مش توصية»', () => {
  const sb = loadUI(mockApi({ ok: true, items: [] }));
  const pine = sb.win.OCTASetups._test.pineFor(mkTvItem({}));
  assert.equal(pine.indexOf('...'), -1, 'مفيش ... (قاعدة المشروع)');
  assert.ok(pine.indexOf('مش توصية شراء أو بيع') >= 0, 'التنويه موجود');
});

test('⭐ «انسخ الأرقام» بيطلع المستويات + التنويه', () => {
  const sb = loadUI(mockApi({ ok: true, items: [] }));
  const txt = sb.win.OCTASetups._test.levelsFor(mkTvItem({}));
  assert.ok(txt.indexOf('EGX:EAST') >= 0, 'رمز TradingView');
  assert.ok(txt.indexOf('الدخول: 29.634') >= 0, 'الدخول');
  assert.ok(txt.indexOf('الوقف: 28.064') >= 0, 'الوقف');
  assert.ok(txt.indexOf('الهدف: 34.658') >= 0, 'الهدف');
  assert.ok(txt.indexOf('مش توصية') >= 0, 'التنويه');
});

test('⭐ بلوك «نقل لـTradingView» فيه الخطوات والزراير', () => {
  const sb = loadUI(mockApi({ ok: true, items: [] }));
  const html = sb.win.OCTASetups._test.codeBoxHTML(mkTvItem({}));
  assert.ok(html.indexOf('Pine Editor') >= 0, 'الخطوات');
  assert.ok(html.indexOf('id="suCopyPine"') >= 0, 'زر السكربت');
  assert.ok(html.indexOf('id="suCopyLv"') >= 0, 'زر الأرقام');
  assert.ok(html.indexOf('su-code') >= 0, 'بلوك الكود');
  assert.equal(html.indexOf('...'), -1, 'مفيش ...');
});
