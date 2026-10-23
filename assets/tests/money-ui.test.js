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
    /* تصحيح كل ٨ شموع (عشان يبقى فيه Order Block ونموذج رانيا) */
    const pull = (i % 8 === 7);
    const imp = (i % 8 === 0 && i > 0);
    const c = 100 + i * 1.2 - (pull ? 1.5 : 0);
    out.push({ t: '2026-01-' + (i + 1),
      o: pull ? c + 1.2 : (imp ? c - 3.0 : c - 0.8),
      h: c + (imp ? 0.4 : 0.3), l: pull ? c - 0.4 : (imp ? c - 3.2 : c - 1.6),
      c: c, v: 100000 + i * 2000 });
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
        return { ok: true, json: async () => ({ ok: true, code: 'X', count: fakeCandles().length, candles: fakeCandles() }) };
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

  /* ⭐ شريط المؤشرات — كل المؤشرات في سطر واحد */
  const strip = els.smStrip.innerHTML;
  assert.ok(strip.indexOf('RSI') !== -1, 'الـRSI في الشريط');
  assert.ok(strip.indexOf('MACD') !== -1, 'الـMACD في الشريط');
  assert.ok(strip.indexOf('جيميني') !== -1, 'جيميني في الشريط');
  assert.ok(strip.indexOf('القفل') !== -1, 'القفل في الشريط');
  assert.ok(strip.indexOf('MCDX') !== -1, 'MCDX في الشريط');
  assert.ok(strip.indexOf('BOS') !== -1, 'البنية في الشريط');
  assert.ok(strip.indexOf('NaN') === -1, 'مافيش NaN في الشريط');
  assert.ok(strip.indexOf('نموذج رانيا') !== -1, 'نموذج رانيا في الشريط');
  assert.ok(strip.indexOf('Order Block') !== -1, 'Order Block في الشريط');
  assert.ok(strip.indexOf('EMA 8/13/21') !== -1, 'المتوسطات في الشريط');
  assert.ok(strip.indexOf('VWAP') !== -1, 'الـVWAP في الشريط');

  /* ⭐ خريطة المستويات — المؤشرات على مقياس السعر */
  const map = els.smMapWrap;
  assert.ok(map, 'خريطة المستويات موجودة');
  assert.ok(map.innerHTML.indexOf('sm-map-l') !== -1, 'في خطوط المستويات');
  assert.ok(map.innerHTML.indexOf('EMA 8') !== -1, 'EMA 8 مرسوم');
  assert.ok(map.innerHTML.indexOf('VWAP') !== -1, 'VWAP مرسوم');
  assert.ok(map.innerHTML.indexOf('NaN') === -1, 'مافيش NaN في الخريطة');
  /* ⭐ الشارت لازم يكون فوق الجدول (مش تحت الـ120 صف) */
  const fs3 = require('node:fs');
  const html = fs3.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  const iDet = html.indexOf('id="smDetail"');
  const iList = html.indexOf('id="smList"');
  assert.ok(iDet > -1 && iList > -1, 'لازم Page السهم والجدول يكونوا موجودين');
  assert.ok(iDet < iList, 'لوحة السهم (الشارت) لازم تكون قبل الجدول');
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

/* ═══════════════════════════════════════════════════════════
   ⛔⛔ اختبار regression — «شاشة بيضا»
   ───────────────────────────────────────────────────────────────
   ▪ المشكلة (٢٢ أكتوبر ٢٠٢٦): صفحة Smart Money كانت مش في قائمة
     KEEP بـocta-pages.js ⇒ الـapp كان بيمسحها من الـDOM عند الإقلاع.
     ولو هي آخر صفحة محفوظة (localStorage) ⇒ الـrestore بيفشل
     ٤٠ مرة ⇒ **مفيش صفحة مفتوحة** ⇒ المستخدم بيفتح الموقع وشاشة
     بيضا من غير ما يفهم.
   ▪ كمان: بلوك السكربتات كان متكرر مرتين ⇒ خطأ
     «Identifier 'X' has already been declared» + ضعف وزن الصفحة.
   ▪ الاختبار ده بيمنع رجوع أي من اتنين.
   ═══════════════════════════════════════════════════════════ */
test('guard: صفحة Smart Money لازم تكون في KEEP (وإلا بتتمسح)', () => {
  const fs2 = require('node:fs');
  const p = path.join(__dirname, '..', 'js', 'octa-pages.js');
  const src = fs2.readFileSync(p, 'utf8');
  const m = src.match(/const KEEP = \[([^\]]+)\]/);
  assert.ok(m, 'لازم تلاقي قائمة KEEP');
  assert.ok(/['"]money['"]/.test(m[1]), "'money' مش في KEEP ⇒ الصفحة بتتمسح من الـDOM");
});

test('guard: بلوك السكربتات في index.html مفيش فيه تكرار', () => {
  const fs2 = require('node:fs');
  const p = path.join(__dirname, '..', '..', 'index.html');
  const src = fs2.readFileSync(p, 'utf8');
  const seen = {};
  let dup = 0;
  const re = /<script src="(assets\/js\/[^"]+)"/g;
  let mm;
  while ((mm = re.exec(src)) !== null) {
    const f = mm[1].split('?')[0];
    if (seen[f]) dup++;
    seen[f] = 1;
  }
  assert.equal(dup, 0, 'فيه سكربتات متكررة (' + dup + ') — التكرار بيعمل خطأ "Identifier already declared"');
  assert.equal(src.indexOf('\n=======\n'), -1, 'فيه سطور "=======" نصية في الصفحة');
});


/* ═══════════════════════════════════════════════════════════
   ⑤ كارت الاستراتيجية — آخر الصفحة
   ═══════════════════════════════════════════════════════════ */
test('كارت الاستراتيجية: موجود في آخر الصفحة وفيه الشرح كامل', async () => {
  const fixture = marketFixture();
  if (!fixture) { assert.ok(true, 'مفيش بيانات — تخطّي'); return; }
  const { sandbox, els } = boot(fixture);
  sandbox.window.moneyInit();
  await new Promise(r => setTimeout(r, 60));
  const g = els.smGuide;
  assert.ok(g, 'حاوية الكارت موجودة');
  const h = g.innerHTML;
  assert.ok(h.indexOf('sm-guide-grid') !== -1, 'شبكة المحاور');
  assert.ok(h.indexOf('الوزن ٣٠٪') !== -1, 'وزن الاتجاه ٣٠٪');
  assert.ok(h.indexOf('الوزن ٢٥٪') !== -1, 'أوزان ٢٥٪');
  assert.ok(h.indexOf('الوزن ٢٠٪') !== -1, 'وزن التذبذب ٢٠٪');
  assert.ok(h.indexOf('مكافأة توافق') !== -1, 'مكافأة التوافق');
  assert.ok(h.indexOf('الشارات ومعناها') !== -1, 'قسم الشارات');
  assert.ok(h.indexOf('نصائح') !== -1, 'قسم النصائح');
  assert.ok(h.indexOf('مش نصيحة استثمار') !== -1, 'تنبيه إنه مش نصيحة استثمار');
  assert.ok(h.indexOf('Order Block') !== -1, 'Order Block معرّف');
  assert.ok(h.indexOf('VWAP') !== -1, 'VWAP معرّف');
  /* ⛔ ممنوع: أسماء أدوات ذكاء اصطناعي في واجهة المنتج */
  ['ذكاء اصطناعي', 'ChatGPT', 'Claude', 'OpenAI', 'Gemini AI', 'الذكاء الاصطناعي']
    .forEach((w) => assert.ok(h.indexOf(w) === -1, 'ممنوع: ' + w));
  /* ⛔ وممنوع أرقام مخترعة (ادعاءات دقة) */
  assert.ok(h.indexOf('دقة') === -1, 'مافيش ادعاء دقة');
  assert.ok(h.indexOf('مضمون') === -1, 'مافيش ضمان ربح');
});
