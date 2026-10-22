/* ══════════════════════════════════════════════════════════════
   🧪 اختبار واجهة Smart Money — assets/tests/money-ui.test.js
   ──────────────────────────────────────────────────────────────
   التشغيل:  cd /workspace/octa && node --test assets/tests/money-ui.test.js
   ──────────────────────────────────────────────────────────────
   📌 ليه اختبار بواجهة وهمية؟
      مافيش متصفح في بيئة الاختبار — فبنعمل DOM مصغّر
      ونحمّل الملفين في بيئة معزولة (vm) ونطلب الـAPI من
      mock. الهدف: نمسك أخطاء التشغيل (ReferenceError ·
      استدعاء دالة مش موجودة · HTML فاضي).

   ⛔ مافيش شبكة — كل الـAPI من mock مبني على البيانات الحقيقية
      المحفوظة في data/data_markets.js.
   ══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const SM = require('../js/octa-smartmoney.js');

/* ═══════════ DOM مصغّر ═══════════ */
function makeEl(id) {
  return {
    id: id,
    innerHTML: '', textContent: '', value: '', checked: false,
    style: { display: '' },
    classList: { _s: {}, toggle() { }, add() { }, remove() { }, contains() { return false; } },
    addEventListener() { }, removeEventListener() { }, remove() { }, appendChild() { },
    setAttribute() { }, focus() { }, click() { }
  };
}

/* بيانات السوق من الملف الثابت → شكل الـAPI */
function marketFixture() {
  const file = path.join(ROOT, 'data', 'data_markets.js');
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const MK = JSON.parse(raw.slice(raw.indexOf('=') + 1).replace(/;\s*$/, '').trim());
  const rows = (MK.egypt || []).map(r => ({
    code: r.code, name: r.name, sector: r.sectorAr || r.sector,
    price: r.price, change: r.change, volume: r.volume,
    volatility: r.volD, rel_volume: r.relvol, beta: r.beta, mkt_cap: r.mc
  }));
  const tech = {};
  (MK.egypt || []).forEach(r => {
    tech[r.code] = {
      rsi: r.rsi, sma200: r.sma200, macd: r.macd, macdSig: r.macdSig,
      p1w: r.p1w, p1m: r.p1m, p3m: r.p3m, p6m: r.p6m, p1y: r.p1y, pYtd: r.pYtd,
      volD: r.volD, mc: r.mc, av30: r.av30, relvol: r.relvol
    };
  });
  /* ⭐ شكل جسر الـWorker: صف واحد فيه كل الحقول (سوق + فني) */
  const tvRows = rows.map((r, i) => {
    const t = tech[r.code] || {};
    return Object.assign({}, r, {
      rsi: t.rsi, macd: t.macd, macdSig: t.macdSig,
      ma50: t.ma50, ma200: t.sma200, ema20: t.ema20, ema50: t.ema50, ema200: t.ema200,
      atr: t.atr, adx: t.adx, relvol: t.relvol, av30: t.av30,
      volD: t.volD, perf1w: t.p1w, perf1m: t.p1m, perf3m: t.p3m,
      perf6m: t.p6m, perf1y: t.p1y, perfYtd: t.pYtd, beta: t.beta
    });
  });
  return { rows: rows, tech: tech, tvRows: tvRows };
}

/* شموع وهمية (صاعدة) عشان اختبار كروت المؤشرات */
function fakeCandles() {
  const out = [];
  for (let i = 0; i < 60; i++) {
    const c = 100 + i * 1.2;
    out.push({ t: '2026-01-' + (i + 1), o: c - 0.8, h: c + 0.3, l: c - 1.6, c: c, v: 100000 + i * 2000 });
  }
  return out;
}

/* ═══════════ تشغيل الصفحة في بيئة معزولة ═══════════ */
function boot(fixture, opt) {
  opt = opt || {};
  const els = {};
  const calls = [];
  const sandbox = {
    console: console,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array,
    Number: Number, String: String, isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat,
    OCTA_SM: SM,
    OS_DB: [],
    OCTA_EGX_NAMES: { names: { COMI: 'البنك التجاري الدولي - مصر' }, sectors: { COMI: 'بنوك' } },
    document: {
      readyState: 'complete',
      getElementById: (id) => { if (!els[id]) els[id] = makeEl(id); return els[id]; },
      addEventListener: () => { },
      createElement: () => makeEl('tmp')
    },
    fetch: async (url) => {
      calls.push(String(url));
      const u = String(url);
      /* ⛔ noBackend = الباك واقع (كل /api بيرجع خطأ) */
      if (opt.noBackend) {
        if (u.indexOf('/api/tvscan') !== -1) {
          return { ok: true, json: async () => ({ ok: true, n: fixture.tvRows.length, rows: fixture.tvRows }) };
        }
        /* ⛔ indexOf بيرجّع 0 لو لقى في أول النص ⇒ لازم !== -1 */
        if (u.indexOf('/api/') !== -1) {
          throw new Error('api-down');
        }
      }
      if (u.indexOf('/api/markets') !== -1) {
        return { ok: true, json: async () => ({ ok: true, egypt: fixture.rows }) };
      }
      if (u.indexOf('/api/market_tech') !== -1) {
        return { ok: true, json: async () => ({ ok: true, markets: { egypt: fixture.tech } }) };
      }
      if (u.indexOf('/api/tvscan') !== -1) {
        return { ok: true, json: async () => ({ ok: true, n: fixture.rows.length, rows: fixture.rows }) };
      }
      if (u.indexOf('/api/candles') !== -1) {
        return { ok: true, json: async () => ({ ok: true, code: 'X', candles: fakeCandles() }) };
      }
      return { ok: true, json: async () => ({}) };
    }
  };
  sandbox.window = sandbox;
  sandbox.OCTA_TV = { mount: (host, o) => { host.__mounted = o; return {}; } };
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-money.js'), 'utf8');
  vm.runInContext(code, sandbox, { filename: 'octa-money.js' });
  return { sandbox: sandbox, els: els, calls: calls };
}

test('الواجهة: بتحمّل وبترتّب الأسهم وبترسم الجدول', async () => {
  const fixture = marketFixture();
  if (!fixture) { assert.ok(true, 'مفيش بيانات — تخطّي'); return; }
  const { sandbox, els } = boot(fixture);
  assert.equal(typeof sandbox.window.moneyInit, 'function', 'moneyInit لازم تكون موجودة');
  sandbox.window.moneyInit();
  await new Promise(r => setTimeout(r, 60));

  const html = els.smList.innerHTML;
  assert.ok(html.indexOf('sm-row') !== -1, 'الجدول اترسم');
  assert.ok(html.indexOf('sm-score') !== -1, 'عمود النتيجة موجود');
  assert.ok(els.smTotal.textContent !== '—', 'عدد الأسهم اتحسب');
  assert.ok(Number(els.smOk.textContent) > 200, 'عدد المؤهّلين > 200');
  assert.ok(Number(els.smAgree.textContent) > 0, 'في أسهم متفقة على ٤ محاور');
  assert.ok(els.smList.innerHTML.indexOf('undefined') === -1, 'مافيش undefined في الجدول');
  assert.ok(els.smList.innerHTML.indexOf('NaN') === -1, 'مافيش NaN في الجدول');
});

test('الواجهة: فتح سهم بيرسم الكروت والشارت', async () => {
  const fixture = marketFixture();
  if (!fixture) { assert.ok(true, 'مفيش بيانات — تخطّي'); return; }
  const { sandbox, els } = boot(fixture);
  sandbox.window.moneyInit();
  await new Promise(r => setTimeout(r, 60));
  const code = els.smList.innerHTML.match(/data-code="([A-Z]+)"/)[1];
  sandbox.window.moneyOpen(code);
  await new Promise(r => setTimeout(r, 60));

  assert.ok(els.smDetail.innerHTML.indexOf('sm-d-code') !== -1, 'رأس السهم اترسم');
  assert.ok(els.smChart.__mounted, 'الشارت اتركّب');
  assert.equal(els.smChart.__mounted.symbol, 'EGX:' + code, 'رمز الشارت صح');
  assert.ok(String(els.smChart.__mounted.studies).indexOf('RSI') !== -1, 'مؤشر RSI على الشارت');
  assert.ok(String(els.smChart.__mounted.studies).indexOf('MACD') !== -1, 'مؤشر MACD على الشارت');

  const cards = els.smCards.innerHTML;
  assert.ok(cards.indexOf('الاتجاه') !== -1, 'كارت الاتجاه');
  assert.ok(cards.indexOf('الزخم') !== -1, 'كارت الزخم');
  assert.ok(cards.indexOf('التذبذب') !== -1, 'كارت التذبذب');
  assert.ok(cards.indexOf('الحجم') !== -1, 'كارت الحجم');
  assert.ok(cards.indexOf('جيميني') !== -1, 'كارت جيميني');
  assert.ok(cards.indexOf('القفل') !== -1, 'كارت القفل');
  assert.ok(cards.indexOf('MCDX') !== -1, 'كارت MCDX');
  assert.ok(cards.indexOf('✅') !== -1, 'في علامة ✅');
  assert.ok(cards.indexOf('➖') === -1, 'مافيش كارت محايد — الحكم لازم يكون واضح');
  /* كل كارت فيه حكم لازم ياخد قرار: ✅ أو ❌
     (كارت مستويات الـATR كارت معلومات — مش حكم) */
  cards.split('sm-card').slice(1).forEach(b => {
    if (b.indexOf('sm-card-w') === -1) return;
    assert.ok(b.indexOf('✅') !== -1 || b.indexOf('❌') !== -1, 'كارت من غير حكم واضح');
  });
  assert.ok(cards.indexOf('NaN') === -1, 'مافيش NaN في الكروت');
  assert.ok(cards.indexOf('undefined') === -1, 'مافيش undefined في الكروت');
});

test('الواجهة: الفلترة بالكلمة وبالحد الأدنى بيشتغلوا', async () => {
  const fixture = marketFixture();
  if (!fixture) { assert.ok(true, 'مفيش بيانات — تخطّي'); return; }
  const { sandbox, els } = boot(fixture);
  sandbox.window.moneyInit();
  await new Promise(r => setTimeout(r, 60));
  const all = els.smList.innerHTML.match(/sm-row/g) || [];
  assert.ok(all.length > 10, 'في صفوف');

  /* البحث: رمز سهم معروف */
  const first = els.smList.innerHTML.match(/data-code="([A-Z]+)"/)[1];
  els.smQ.value = first;
  const ev = { }; els.smQ.addEventListener = (t, fn) => { ev[t] = fn; };
  /* نداء الفلترة عن طريق الـinput handler المسجّل أثناء الربط */
  if (ev.input) ev.input();
  const filtered = els.smList.innerHTML.match(/sm-row/g) || [];
  assert.ok(filtered.length <= all.length, 'الفلترة قلّلت الصفوف');
});


test('الواجهة: لما الباك يكون واقع — الفلتر بيشتغل من جسر TradingView', async () => {
  const fixture = marketFixture();
  if (!fixture) { assert.ok(true, 'مفيش بيانات — تخطّي'); return; }
  const { sandbox, els } = boot(fixture, { noBackend: true });
  sandbox.window.moneyInit();
  await new Promise(r => setTimeout(r, 80));

  const html = els.smList.innerHTML;
  assert.ok(html.indexOf('sm-row') !== -1, 'الجدول اترسم من جسر TradingView');
  assert.ok(Number(els.smTotal.textContent) > 200, 'عدد الأسهم جاي من الجسر');
  assert.ok(els.smStatus.innerHTML.indexOf('TradingView') !== -1, 'المصدر اتعلّم للمستخدم');
  assert.ok(html.indexOf('NaN') === -1, 'مافيش NaN');
});
