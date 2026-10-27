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
  assert.ok(html.indexOf('▲ صعود') >= 0, 'الاتجاه');
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
