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
      structure_label: 'كسر مقاومة', source: 'startamarkets', bars_used: 320
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
  assert.ok(fakeSeries.lines && fakeSeries.lines.length === 1, 'خط السعر اتعمل');
  assert.equal(fakeSeries.lines[0].title, 'مستوى الكسر', 'التسمية العربية');
});
