/* ══════════════════════════════════════════════════════════════
   🧪 اختبار «المُصفّي الفني» — assets/tests/techfilter.test.js
   ──────────────────────────────────────────────────────────────
   التشغيل:  cd octa && node --test assets/tests/techfilter.test.js
   📌 مافيش متصفح ⇒ DOM مصغّر + تحميل الملف في بيئة معزولة (vm).
   ⛔ مافيش شبكة — الداتا الحية من mock على شكل /api/markets الحقيقي.
   ⛔ الاختبار بيتأكد من القواعد الحمرا:
      ① الرقم المعروض = المحور الفني (m) نفسه — مش درجة جديدة.
      ② المؤشر الناقص = «—» + تغطية — مش صفر.
      ③ مفيش NaN ولا undefined في أي رقم ظاهر.
      ④ الداتا المعروضة **حيّة** — مش سجل ٩ أكتوبر.
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
    isConnected: true,
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
    OCTA_API: 'https://api.test',
    location: { protocol: 'https:', host: 'octashares.com', href: 'https://octashares.com/' },
    addEventListener() { }, removeEventListener() { },
    setTimeout: (f) => { try { f(); } catch (e) { } },
    clearTimeout() { }, setInterval() { return 0; }, clearInterval() { },
    fetch: fetchImpl || (() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })),
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

function loadUI(fetchImpl, db) {
  const sb = mkSandbox(fetchImpl);
  sb.win.OS_DB = db || [];
  sb.win.octaLoadDB = function () { return Promise.resolve(sb.win.OS_DB); };
  const code = fs.readFileSync(path.join(ROOT, 'assets/js/octa-techfilter.js'), 'utf8');
  vm.runInContext(code, sb.ctx, { filename: 'octa-techfilter.js' });
  return sb;
}

/* ═══════════ موك OS_DB (السجل) ═══════════ */
function mkStock(o) {
  o = o || {};
  return {
    code: o.code || 'COMI',
    name: o.name || 'البنك التجاري الدولي',
    sectorAr: o.sectorAr || 'بنوك',
    price: o.price === undefined ? 100 : o.price,
    p: o.price === undefined ? 100 : o.price,
    score: 60, decision: 'إشارة إيجابية', scoreConf: 90,
    sect: { q: 60, v: 50, m: o.m === undefined ? 50 : o.m, sf: 55, lq: 60 },
    rsi: o.rsi, ma50: o.ma50, ma200: o.ma200,
    macd: o.macd, macdSignal: o.macdSignal,
    relvol: o.relvol, frm52hi: o.frm52hi, perf3m: o.perf3m
  };
}

/* ═══════════ موك الداتا الحية (شكل /api/markets) ═══════════ */
function mkLive(o) {
  o = o || {};
  return {
    code: o.code, name: o.name || 'سهم حي', sector: o.sector || 'بنوك',
    price: o.price, rsi: o.rsi,
    sma50: o.sma50, sma200: o.sma200,
    ema20: o.ema20, ema50: o.ema50, ema200: o.ema200,
    atr: o.atr, bb_basis: o.bb, bb_upper: o.bbU, bb_lower: o.bbL,
    rel_volume: o.relvol,
    perf_3m: o.perf3m, perf_y: o.perfY,
    volatility: o.vol, data_confidence: o.conf === undefined ? 90 : o.conf,
    ts: '2026-11-14T03:00:00Z',
    all_axes: { technical: o.m, fundamental: 60, liquidity: 60, risk: 60 }
  };
}

/* السهم القوي — حيّ: عدّى كل المعايير الثمانية */
const LIVE_STRG = mkLive({
  code: 'STRG', m: 82, price: 120, sma50: 110, sma200: 100, ema20: 115,
  ema50: 112, ema200: 101, rsi: 60, relvol: 1.6, bb: 110, perf3m: 25, perfY: 40, atr: 2.4
});
/* السهم الضعيف — حيّ */
const LIVE_WEK = mkLive({
  code: 'WEK', m: 18, price: 90, sma50: 100, sma200: 110, ema20: 95,
  ema50: 99, ema200: 109, rsi: 28, relvol: 0.5, bb: 96, perf3m: -30, perfY: -20, atr: 5
});
/* السهم الناقص — حيّ بس ناقصه EMA20 وبولنجر */
const LIVE_THIN = mkLive({
  code: 'THIN', m: 50, price: 50, sma50: 45, sma200: 40, ema50: 46, ema200: 41,
  rsi: 55, relvol: 1.0, perf3m: 5, atr: null
});
const LIVE_MAP = { STRG: LIVE_STRG, WEK: LIVE_WEK, THIN: LIVE_THIN };

/* نفس الأسهم في السجل (٩ أكتوبر) — القيم مختلفة عمداً */
const OLD_STRG = mkStock({
  code: 'STRG', m: 100, price: 120, ma50: 110, ma200: 100, rsi: 60,
  macd: 2, macdSignal: 1, relvol: 1.6, frm52hi: -3, perf3m: 25
});
const OLD_WEK = mkStock({
  code: 'WEK', m: 18, price: 90, ma50: 100, ma200: 110, rsi: 28,
  macd: -2, macdSignal: -1, relvol: 0.5, frm52hi: -45, perf3m: -30
});
const OLD_THIN = mkStock({ code: 'THIN', m: 50, price: 50 });
const DB = [OLD_STRG, OLD_WEK, OLD_THIN];

/* ══════════════════════════════════════════════════════════════
   ① الرقم المعروض = المحور الفني نفسه
   ══════════════════════════════════════════════════════════════ */
test('① المحور الفني بيتقرأ من all_axes.technical (الحي) — مش درجة جديدة', () => {
  const sb = loadUI(null, DB);
  const T = sb.win.OCTATech._t;
  T.setLive(LIVE_MAP);
  const v = T.view(OLD_STRG);
  assert.equal(v.src, 'live');
  assert.equal(v.data.m, 82, 'لازم يبقى المحور الفني الحي (82) مش السجل (100)');
  /* ⛔ سهم من غير محور فني = مش في الفلتر (مش صفر) */
  const noAx = mkLive({ code: 'NOAX' });
  noAx.all_axes = { fundamental: 50 };
  T.setLive({ NOAX: noAx });
  assert.equal(T.view(mkStock({ code: 'NOAX' })).data.m, null);
});

test('② من غير داتا حية ⇒ نرجع للسجل ونقول إنه قديم', () => {
  const sb = loadUI(null, DB);
  const T = sb.win.OCTATech._t;
  T.clearLive();
  const v = T.view(OLD_STRG);
  assert.equal(v.src, 'old');
  assert.equal(v.data.m, 100, 'من السجل: المحور الفني كما هو');
});

/* ══════════════════════════════════════════════════════════════
   ③ المعايير: الناقص بيتشال من المقام — مش صفر
   ══════════════════════════════════════════════════════════════ */
test('③ المعايير الناقصة بتتشال من المقام (مش صفر)', () => {
  const sb = loadUI(null, DB);
  const T = sb.win.OCTATech._t;
  T.setLive(LIVE_MAP);
  const full = T.critOf(T.view(OLD_STRG).data);
  assert.equal(full.have, 8, 'السهم الكامل لازم كل المعايير الثمانية تكون متاحة');
  assert.equal(full.pass, 8, 'السهم القوي عدّى كل المعايير');

  const thin = T.critOf(T.view(OLD_THIN).data);
  assert.ok(thin.have < 8, 'المعايير الناقصة لازم تتشال');
  assert.ok(thin.pass <= thin.have, 'المجموع-pass مايزيدش عن المتاح');
  assert.equal(thin.items.filter(function (i) { return i.ok === null; }).length, 8 - thin.have);
});

/* ══════════════════════════════════════════════════════════════
   ④ مفيش NaN ولا undefined
   ══════════════════════════════════════════════════════════════ */
test('④ مفيش NaN/undefined في أي رقم ظاهر', () => {
  const sb = loadUI(null, DB);
  const T = sb.win.OCTATech._t;
  T.setLive(LIVE_MAP);
  [OLD_STRG, OLD_WEK, OLD_THIN].forEach(function (s) {
    const w = T.why(T.view(s).data);
    assert.ok(!/NaN|undefined|Infinity/.test(w), 'سطر «ليه» فيه رقم مش صالح: ' + w);
    assert.ok(w.length > 0);
  });
  T.clearLive();
  assert.match(T.why(T.view(OLD_THIN).data), /مفيش بيانات فنية كافية/);
});

/* ══════════════════════════════════════════════════════════════
   ⑤ الفلترة بالشرائح
   ══════════════════════════════════════════════════════════════ */
test('⑤ شرائح الفلترة بتعمل صح', () => {
  const sb = loadUI(null, DB);
  const T = sb.win.OCTATech._t;
  T.setLive(LIVE_MAP);
  const codes = function () { return T.rows().map(function (r) { return r.v.code; }).join(','); };

  T.TS.view = 'best';
  assert.equal(codes(), 'STRG,THIN,WEK');
  T.TS.view = 'above200';
  assert.equal(codes(), 'STRG,THIN');
  T.TS.view = 'rsi';
  assert.equal(codes(), 'STRG,THIN');
  T.TS.view = 'vol';
  assert.equal(codes(), 'STRG');
  T.TS.view = 'bb';
  assert.equal(codes(), 'STRG');
  T.TS.view = 'best';
});

/* ══════════════════════════════════════════════════════════════
   ⑥ المقارنة بالقطاع
   ══════════════════════════════════════════════════════════════ */
test('⑥ المقارنة بالقطاع: الفرق عن وسيط القطاع بيتحسب', () => {
  const sb = loadUI(null, DB);
  const T = sb.win.OCTATech._t;
  T.setLive(LIVE_MAP);
  const med = T.sectorMed();
  assert.ok(med['بنوك'] !== undefined, 'لازم يكون وسيط لكل قطاع');
  const rows = T.rows();
  const strong = rows.find(function (r) { return r.v.code === 'STRG'; });
  const weak = rows.find(function (r) { return r.v.code === 'WEK'; });
  assert.ok(strong.rel > weak.rel, 'القوي لازم يكون فرقه عن وسيط القطاع أكبر');
  assert.equal(strong.m, 82, 'الرقم المطلق = المحور الفني نفسه');
});

/* ══════════════════════════════════════════════════════════════
   ⑦ الرسم — الجدول فيه الأرقام الصح ومفيش NaN
   ══════════════════════════════════════════════════════════════ */
test('⑦ الجدول بيترسّم بالأرقام الحية ومفيش NaN', async () => {
  const sb = loadUI(function () {
    return Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve({ ok: true, egypt: [LIVE_STRG, LIVE_WEK, LIVE_THIN] })
    });
  }, DB);
  const box = sb.doc.getElementById('armBody');
  sb.win.OCTATech.render(box);
  await sb.win.OCTATech.boot();
  const html = box.innerHTML;
  assert.ok(html.length > 200, 'الجدول مالهوش HTML');
  assert.ok(!/NaN|undefined|Infinity/.test(html), 'فيه رقم مش صالح في الجدول');
  assert.match(html, /الفلتر الفني/);
  assert.match(html, /STRG/);
  /* ⛔ الرقم الحي (82) هو اللي ظاهر في الجدول — مش رقم السجل (100) */
  const tbl = html.split('<table')[1] || '';
  assert.match(tbl, />82</, 'المحور الفني الحي (82) لازم يظهر في الجدول');
  assert.ok(!/>100</.test(tbl), 'رقم السجل القديم (100) مينفعش يظهر في الجدول');
});

/* ══════════════════════════════════════════════════════════════
   ⑧ الداتا الحية بتيجي من /api/markets (مش من السجل)
   ══════════════════════════════════════════════════════════════ */
test('⑧ الداتا الحية بتتحمّل من /api/markets', async () => {
  let asked = '';
  const sb = loadUI(function (url) {
    asked = url;
    return Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve({ ok: true, egypt: [LIVE_STRG, LIVE_WEK, LIVE_THIN] })
    });
  }, DB);
  const box = sb.doc.getElementById('armBody');
  sb.win.OCTATech.render(box);
  await sb.win.OCTATech.boot();
  assert.match(asked, /\/api\/markets\?market=egypt/);
  const html = box.innerHTML;
  assert.match(html, /داتا لحظية/);
  assert.match(html, />82</);
});

/* ══════════════════════════════════════════════════════════════
   ⑨ فشل الداتا الحية ⇒ رسالة صريحة (مش أرقام قديمة بلا تنبيه)
   ══════════════════════════════════════════════════════════════ */
test('⑨ لو الداتا الحية فشل ⇒ تنبيه صريح للمستخدم', async () => {
  const sb = loadUI(function () {
    return Promise.reject(new Error('network down'));
  }, DB);
  const box = sb.doc.getElementById('armBody');
  sb.win.OCTATech.render(box);
  await sb.win.OCTATech.boot();
  const html = box.innerHTML;
  assert.match(html, /مقدرتش أجيب الداتا الحية/);
  assert.match(html, /٩ أكتوبر/);
  /* ⛔ بس الأرقام بتفضل موجودة ( Fallback ) */
  assert.match(html, /STRG/);
});

/* ══════════════════════════════════════════════════════════════
   ⑩ تفصيل السهم — من محرك الـAPI نفسه
   ══════════════════════════════════════════════════════════════ */
test('⑩ التفصيل بيجيب تحليل المحرك ويعرض المحاور والمستويات', async () => {
  const payload = {
    ok: true, code: 'COMI', name: 'البنك التجاري الدولي', price: 128.75,
    indicators: { ema20: 124.8, ema50: 131.7, ema200: 120.1, rsi: 57.7, atr: 1.74, bb_upper: 131.1, bb_lower: 118.6 },
    technical: {
      score: 72, signal: 'إيجابي قوي', confidence: 58.3, atr_pct: 1.35,
      breakdown: { 'الاتجاه': 30, 'الزخم': 15, 'الموقع من النطاق': 12, 'الحجم': 10, 'تقييم المصدر': 5 },
      levels: { 'دعم_1': 127.008, 'مقاومة_1': 130.492, 'نقطة_محايدة': 128.75 },
      positives: ['السعر فوق EMA20 (124.88)'], negatives: ['السعر تحت EMA50 (131.76)'], neutral: ['المتوسطات متشابكة']
    }
  };
  const sb = loadUI(function () {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
  }, DB);
  const box = sb.doc.getElementById('armBody');
  sb.win.OCTATech.render(box);
  await sb.win.OCTATech.boot();
  sb.win.techDetail('COMI');
  await new Promise(function (r) { setImmediate(r); });
  await new Promise(function (r) { setImmediate(r); });
  const host = sb.doc.getElementById('techDetailHost');
  const html = host.innerHTML;
  assert.ok(html.length > 100, 'التفصيل مالهوش محتوى');
  assert.ok(!/NaN|undefined/.test(html), 'فيه رقم مش صالح في التفصيل');
  assert.match(html, /الاتجاه/);
  assert.match(html, /127\.0/);        /* مستوى الدعم */
  assert.match(html, /فوق EMA20/);      /* سبب من المحرك */
});

/* ══════════════════════════════════════════════════════════════
   ⑪ ⛔ شرط أحمد: ترتيب الـ8 وأسماؤها وأيقوناتها ما تتغيرش
   ══════════════════════════════════════════════════════════════ */
test('⑪ تبويبات الفلاتر: الـ8 الأول ما اتغيروش + الفني اتضاف في صف ٢', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/octa-filters.js'), 'utf8');
  const m = src.match(/const FZ_TABS = \[([\s\S]*?)\n\];/);
  assert.ok(m, 'مالقيناش FZ_TABS');
  const block = m[1];
  const inline = [...block.matchAll(/\{ id:\s*'([^']+)',\s*i:\s*'([^']+)',\s*n:\s*'([^']+)'/g)]
    .map(x => ({ id: x[1], i: x[2], n: x[3] }));
  const EXPECT = [
    { id: 'safety', i: '🛡️', n: 'الأمان' },
    { id: 'income', i: '💰', n: 'التوزيعات' },
    { id: 'moment', i: '⚡', n: 'الزخم' },
    { id: 'value', i: '💎', n: 'القيمة' },
    { id: 'qual', i: '🎯', n: 'الجودة' },
    { id: 'liquid', i: '💵', n: 'السيولة' },
    { id: 'growth', i: '📈', n: 'النمو' },
    { id: 'cash', i: '🏦', n: 'التدفق' }
  ];
  assert.equal(inline.length, 8, 'عدد التابات الأصلية اتغيّر: ' + inline.length);
  EXPECT.forEach(function (e, i) {
    assert.equal(inline[i].id, e.id, 'ترتيب التاب ' + (i + 1) + ' اتغيّر');
    assert.equal(inline[i].n, e.n, 'اسم التاب ' + e.id + ' اتغيّر');
    assert.equal(inline[i].i, e.i, 'أيقونة التاب ' + e.id + ' اتغيّرت');
  });
  assert.match(block, /FZ_TAB_TECH/);
  assert.match(src, /const FZ_TAB_TECH = \{ id:'tech'[\s\S]{0,120}row:2 \}/);
});

/* ══════════════════════════════════════════════════════════════
   ⑫ ⛔ كل حركة من حركات الميزة لازم موجودة (منع الموت الصامت)
   ══════════════════════════════════════════════════════════════ */
test('⑫ حركات الفلتر الفني موجودة (ما فيش موت صامت)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/octa-filters.js'), 'utf8');
  assert.match(src, /FZ_TAB_TECH/);
  assert.match(src, /function fzTechRender\(\)/);
  assert.match(src, /function fzTechRows\(\)/);
  assert.match(src, /function fzTechInit\(\)/);
  assert.match(src, /function nzMountTech\(\)/);
  assert.match(src, /nzMountTech\(\);/);
  assert.match(src, /t\.id==='tech'\) \? fzTechRows\(\)\.length/);
  const pages = fs.readFileSync(path.join(ROOT, 'assets/js/octa-pages.js'), 'utf8');
  assert.match(pages, /window\.OCTATech/);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /assets\/js\/octa-techfilter\.js\?v=/);
});

/* ══════════════════════════════════════════════════════════════
   ⑬ 🗂️ في الذراع: كروت مش جدول (مفيش سحب أفقي على الموبايل)
   ══════════════════════════════════════════════════════════════ */
test('⑬ الذراع بيعرض كروت (مش جدولwide) — نفس الأرقام', async () => {
  const sb = loadUI(function () {
    return Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve({ ok: true, egypt: [LIVE_STRG, LIVE_WEK, LIVE_THIN] })
    });
  }, DB);
  const box = sb.doc.getElementById('armBody');
  sb.win.OCTATech.render(box, { compact: true });
  await sb.win.OCTATech.boot();
  const html = box.innerHTML;
  assert.match(html, /tf-cards/, 'لازم الكروت موجودة');
  assert.ok(html.indexOf('<table') < 0, 'مفيش جدول — مفيش سحب أفقي');
  assert.match(html, /STRG/);
  assert.match(html, />82</, 'المحور الفني الحي (82) ظاهر');
  assert.ok(!/NaN|undefined/.test(html), 'مفيش رقم مش صالح');
});

/* ══════════════════════════════════════════════════════════════
   ⑭ 🎨 كلاس الـCSS لازم يكون موجود في ملف الـCSS
   ══════════════════════════════════════════════════════════════ */
test('⑭ كلاسات CSS الجديدة موجودة في assets/octa.css', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets/octa.css'), 'utf8');
  ['.tf-cards', '.tf-card', '.tf-metrics', '.tf-metric', '.tf-why', '.flt-chips', '.flt-tune']
    .forEach(function (c) {
      assert.ok(css.indexOf(c) >= 0, '⛔ كلاس CSS ناقص: ' + c);
    });
});
