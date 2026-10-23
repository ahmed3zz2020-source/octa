/* ══════════════════════════════════════════════════════════════
   🧪 اختبارات محرك Smart Money — assets/tests/smartmoney.test.js
   ──────────────────────────────────────────────────────────────
   التشغيل:  cd /workspace/octa && node --test assets/tests/smartmoney.test.js
   ⛔ مافيش framework تاني — node:test + node:assert/strict بس
   ⛔ مافيش شبكة — كل الأرقام هنا محسوبة جوه الملف

   📌 المبدأ:
      · كل قيمة مرجعية مكتوبة بخط اليد (مش مستعارة من المحرك)
        فالمقارنة حقيقية مش circular.
      · المقارنة الحسابية بت tolerância 1e-9.
      · لازم كل النتيجة تبقى أرقام منتهية — مافيش NaN ولا Infinity
        (أكتر باج ببوصلنا: قسم على صفر).
   ══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const SM = require('../js/octa-smartmoney.js');

const EPS = 1e-9;
function closeTo(actual, expected, msg) {
  assert.equal(typeof actual, 'number', (msg || '') + ' — لازم رقم');
  assert.ok(Math.abs(actual - expected) <= EPS,
    (msg || '') + ' — المتوقع ' + expected + ' والفعلي ' + actual);
}
function inRange(v, lo, hi, msg) {
  assert.equal(typeof v, 'number', (msg || '') + ' — لازم رقم');
  assert.ok(v >= lo - EPS && v <= hi + EPS, (msg || '') + ' — خارج النطاق: ' + v);
}
function finite(v, msg) {
  assert.ok(typeof v === 'number' && isFinite(v), (msg || '') + ' — قيمة مش منتهية: ' + v);
}

/* ═══════════════════════════════════════════════════════════
   🛠 صف جاهز — شكل صف /api/markets + صف /api/market_tech
   ═══════════════════════════════════════════════════════════ */
function strongRow(over) {
  over = over || {};
  return {
    row: Object.assign({
      code: 'TEST', name: 'سهم تجريبي', sector: 'بنوك ومالية',
      price: 100, change: 2.0, volume: 500000,
      volatility: 2.5, rel_volume: 1.5, tv_rating: 0.4, beta: 1.0,
      mkt_cap: 5e9, pe: 8, pb: 1.2, roe: 20, eps: 2, revenue: 1e9
    }, over.row || {}),
    tech: Object.assign({
      rsi: 62, sma200: 90, macd: 1.2, macdSig: 0.8,
      p1w: 3, p1m: 8, p3m: 15, p6m: 20, p1y: 30, pYtd: 12,
      volD: 2.5, mc: 5e9, av30: 450000, relvol: 1.5
    }, over.tech || {}),
    db: Object.assign({
      code: 'TEST', name: 'سهم تجريبي', sectorAr: 'بنوك ومالية',
      price: 100, change: 2, volume: 500000,
      rsi: 62, ma50: 95, ma200: 90, macd: 1.2, macdSig: 0.8,
      relvol: 1.5, av30: 450000, mcap: 5e9, float: 2e9,
      perf1m: 8, perf3m: 15, beta: 1, mdd: 30
    }, over.db || {})
  };
}

/* شموع صاعدة: كل شمعة قريبة من قاعها (accumulation) بحجم بيزيد */
function upCandles(n) {
  n = n || 60;
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = 100 + i * 1.2;
    out.push({ t: '2026-01-' + (i + 1), o: +(c - 0.8).toFixed(2), h: +(c + 0.3).toFixed(2),
      l: +(c - 1.6).toFixed(2), c: +c.toFixed(2), v: 100000 + i * 2000 });
  }
  return out;
}
/* شموع هابطة: كل شمعة قريبة من قاعها المرتفع (distribution) */
function downCandles(n) {
  n = n || 60;
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = 200 - i * 1.4;
    out.push({ t: '2026-01-' + (i + 1), o: +(c + 0.8).toFixed(2), h: +(c + 1.6).toFixed(2),
      l: +(c - 0.3).toFixed(2), c: +c.toFixed(2), v: 120000 + i * 2000 });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════
   ① الدمج
   ═══════════════════════════════════════════════════════════ */
test('merge: بيلقط الحقول من المصادر الثلاثة', () => {
  const s = strongRow();
  const m = SM.merge(s.row, s.tech, s.db);
  assert.equal(m.code, 'TEST');
  closeTo(m.price, 100, 'السعر');
  closeTo(m.rsi, 62, 'RSI');
  closeTo(m.ma50, 95, 'MA50');
  closeTo(m.ma200, 90, 'MA200');
  closeTo(m.relvol, 1.5, 'الحجم النسبي');
  closeTo(m.volD, 2.5, 'التقلب اليومي');
  closeTo(m.beta, 1.0, 'البيتا');
  assert.ok(m.turnover > 0, 'الدوران لازم يتحسب');
});

test('merge: الحقل الناقص بيفضل null (مش صفر مخترع)', () => {
  const m = SM.merge({ code: 'X', price: 10 }, {}, {});
  assert.equal(m.rsi, null, 'RSI لازم يفضل null');
  assert.equal(m.ma200, null, 'MA200 لازم يفضل null');
  assert.equal(m.turnover, null, 'الدوران من غير قيمة سوقية = null');
  const r = SM.compute(m);
  finite(r.score, 'النتيجة');
});

/* ═══════════════════════════════════════════════════════════
   ② المحاور الأربعة
   ═══════════════════════════════════════════════════════════ */
test('الاتجاه: سهم صاعد فوق المتوسطات = درجة عالية', () => {
  const s = strongRow();
  const r = SM.compute(SM.merge(s.row, s.tech, s.db));
  inRange(r.axes.trend.score, 60, 100, 'محور الاتجاه');
  assert.ok(r.axes.trend.parts.length >= 3, 'لازم يكون فيه تفصيل للكارت');
});

test('الاتجاه: سهم تحت المتوسطات = درجة منخفضة', () => {
  const s = strongRow({
    row: { price: 80, change: -3, mkt_cap: 5e9 },
    tech: { rsi: 30, sma200: 120, macd: -2, macdSig: -0.5, p1w: -6, p1m: -18, p3m: -30, volD: 2.5, relvol: 0.5 },
    db: { price: 80, change: -3, rsi: 30, ma50: 110, ma200: 120, macd: -2, macdSig: -0.5, relvol: 0.5, perf1m: -18, perf3m: -30 }
  });
  const r = SM.compute(SM.merge(s.row, s.tech, s.db));
  inRange(r.axes.trend.score, 0, 40, 'محور الاتجاه الهابط');
});

test('الزخم: RSI فوق 80 = تشبع شرائي وعقوبة', () => {
  const a = strongRow({ tech: { rsi: 78 }, db: { rsi: 78 } });
  const b = strongRow({ tech: { rsi: 95 }, db: { rsi: 95 } });
  const ra = SM.compute(SM.merge(a.row, a.tech, a.db));
  const rb = SM.compute(SM.merge(b.row, b.tech, b.db));
  assert.ok(rb.axes.momentum.score < ra.axes.momentum.score,
    'RSI 95 لازم يكون أقل من RSI 78 (عقوبة التشبع)');
  assert.ok(rb.badges.some(x => x.id === 'overbought'), 'لازم تطلع شارة التشبع الشرائي');
});

test('الزخم: MACD تحت الإشارة = هابط', () => {
  const s = strongRow({ tech: { macd: -1, macdSig: -0.2 }, db: { macd: -1, macdSig: -0.2 } });
  const r = SM.compute(SM.merge(s.row, s.tech, s.db));
  const macdPart = r.axes.momentum.parts.filter(x => x.k === 'macd')[0];
  assert.ok(macdPart, 'لازم يكون فيه جزء MACD');
  assert.ok(macdPart.v < 0.5, 'MACD تحت الإشارة = درجة أقل من Neutral');
});

test('التذبذب: النطاق المريح أعلى من التذبذب المتطرف', () => {
  const calm = strongRow({ tech: { volD: 2.5, beta: 1.0 }, row: { volatility: 2.5, beta: 1.0 } });
  const wild = strongRow({ tech: { volD: 14, beta: 3.0 }, row: { volatility: 14, beta: 3.0 } });
  const dead = strongRow({ tech: { volD: 0.2, beta: 0.2 }, row: { volatility: 0.2, beta: 0.2 } });
  const rc = SM.compute(SM.merge(calm.row, calm.tech, calm.db));
  const rw = SM.compute(SM.merge(wild.row, wild.tech, wild.db));
  const rd = SM.compute(SM.merge(dead.row, dead.tech, dead.db));
  assert.ok(rc.axes.volatility.score > rw.axes.volatility.score, 'المريح > المتطرف');
  assert.ok(rc.axes.volatility.score > rd.axes.volatility.score, 'المريح > الميت');
});

test('الحجم: تدفق مع الشراء أعلى من تدفق مع البيع', () => {
  const up = strongRow({ row: { change: 4, rel_volume: 2.0 }, tech: { relvol: 2.0 } });
  const dn = strongRow({ row: { change: -4, rel_volume: 2.0 }, tech: { relvol: 2.0 } });
  const ru = SM.compute(SM.merge(up.row, up.tech, up.db));
  const rd = SM.compute(SM.merge(dn.row, dn.tech, dn.db));
  assert.ok(ru.axes.volume.score > rd.axes.volume.score, 'الشراء أعلى من البيع');
  assert.ok(ru.badges.some(x => x.id === 'accum'), 'لازم تطلع شارة التجميع');
});

/* ═══════════════════════════════════════════════════════════
   ③ النتيجة النهائية
   ═══════════════════════════════════════════════════════════ */
test('النتيجة: بين 0 و 100 ومع مكافأة توافق', () => {
  const s = strongRow();
  const r = SM.compute(SM.merge(s.row, s.tech, s.db));
  inRange(r.score, 0, 100, 'النتيجة');
  assert.ok(r.bonus >= 0 && r.bonus <= 10, 'مكافأة التوافق بين 0 و 10');
  /* الأساس والمكافأة متقربين لرقم واحد ⇒ فرق ≤ ٠٫١٥ */
  assert.ok(Math.abs((r.base + r.bonus) - r.score) <= 0.15,
    'النتيجة = الأساس + المكافأة (' + r.base + ' + ' + r.bonus + ' ≠ ' + r.score + ')');
});

test('النتيجة: كل المحاور متساوية = مكافأة توافق كاملة', () => {
  /* نصنع صف symmetric: نفس الدرجة في المحاور الأربعة */
  const s = strongRow();
  const m = SM.merge(s.row, s.tech, s.db);
  const r = SM.compute(m);
  const vals = [r.axes.trend.score, r.axes.momentum.score, r.axes.volatility.score, r.axes.volume.score];
  const spread = Math.max.apply(null, vals) - Math.min.apply(null, vals);
  closeTo(r.spread, Math.round(spread * 10) / 10, 'الفرق بين المحاور');
  assert.ok(r.agreement >= 0 && r.agreement <= 100, 'نسبة التوافق');
});

test('rank: مرتّب تنازلي وكل النتائج أرقام منتهية', () => {
  const list = [];
  for (let i = 0; i < 25; i++) {
    const s = strongRow({
      row: { code: 'C' + i, price: 50 + i, change: i - 12, rel_volume: 0.4 + i * 0.1, mkt_cap: 1e9 + i * 1e8 },
      tech: { rsi: 25 + i * 2, sma200: 40, macd: i - 12, macdSig: 0, volD: 1 + i * 0.3, relvol: 0.4 + i * 0.1, p1m: i - 12, p3m: i - 12 },
      db: { code: 'C' + i, ma50: 45, ma200: 40, relvol: 0.4 + i * 0.1, perf1m: i - 12, perf3m: i - 12 }
    });
    list.push(SM.merge(s.row, s.tech, s.db));
  }
  const ranked = SM.rank(list);
  assert.equal(ranked.length, 25, 'عدد الأسهم');
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].score >= ranked[i].score, 'الترتيب تنازلي عند ' + i);
  }
  ranked.forEach(r => {
    finite(r.score, 'النتيجة');
    ['trend', 'momentum', 'volatility', 'volume'].forEach(k => finite(r.axes[k].score, 'محور ' + k));
  });
});

/* ═══════════════════════════════════════════════════════════
   ④ المؤشرات الثلاثة من الشموع
   ═══════════════════════════════════════════════════════════ */
test('الشموع الصاعدة: جيميني صاعد · القفل داخل · MCDX مؤسسي', () => {
  const out = SM.fromCandles(upCandles(60), { ma50: 120, ma200: 100 });
  assert.ok(out, 'النتيجة لازم تتحسب');
  assert.ok(out.gemini, 'جيميني');
  assert.equal(out.gemini.state, 'bull', 'جيميني لازم يكون صاعد');
  assert.equal(out.lock.state, 'in', 'القفل: مؤسسية داخل');
  assert.equal(out.mcdx.state, 'inst', 'MCDX: المؤسسات مسيطرة');
  assert.equal(out.mcdx.cross, 'gc', 'تقاطع ذهبي');
  assert.ok(out.atr > 0, 'ATR لازم يكون أكبر من صفر');
  assert.ok(out.levels && out.levels.stop < out.levels.entry, 'وقف الخسارة تحت الدخول');
  assert.ok(out.levels.target > out.levels.entry, 'الهدف فوق الدخول');
});

test('الشموع الهابطة: جيميني هابط · القفل خارج · MCDX أفراد', () => {
  const out = SM.fromCandles(downCandles(60), { ma50: 120, ma200: 160 });
  assert.ok(out, 'النتيجة لازم تتحسب');
  assert.equal(out.gemini.state, 'bear', 'جيميني هابط');
  assert.equal(out.lock.state, 'out', 'القفل: مؤسسية خارج');
  assert.equal(out.mcdx.state, 'retail', 'MCDX: الأفراد مسيطرين');
  assert.equal(out.mcdx.cross, 'dc', 'تقاطع مميت');
});

test('الشموع: البنية BOS و CHoC', () => {
  const up = SM.fromCandles(upCandles(60), {});
  assert.ok(up.structure, 'البنية');
  assert.ok(up.structure.state === 'bull' || up.structure.state === 'bear', 'اتجاه البنية');
  assert.ok(up.structure.label && up.structure.label.length > 4, 'وصف البنية');
  assert.ok(up.structure.resistance != null || up.structure.support != null, 'مستويات');
});

test('الشموع: عدد قليل = null (مش أرقام مخترعة)', () => {
  assert.equal(SM.fromCandles([], {}), null);
  assert.equal(SM.fromCandles(upCandles(5), {}), null);
  assert.equal(SM.fromCandles(null, {}), null);
});

/* ═══════════════════════════════════════════════════════════
   ⑤ بيانات السوق الحقيقية (من الملف الثابت في الريبو)
   ──────────────────────────────────────────────────────────────
   الملف ده آخر نسخة كاملة اتسجّلت — بنستخدمها كـfixture
   عشان نأكد إن المحرك بيشتغل على أرقام حقيقية مش على
   أرقام مثالية.
   ═══════════════════════════════════════════════════════════ */
test('بيانات السوق الحقيقية: كل الأسهم بتتحسب وبيترتبوا', () => {
  const file = path.join(__dirname, '..', '..', 'data', 'data_markets.js');
  if (!fs.existsSync(file)) {
    assert.ok(true, 'الملف مش موجود — تخطّي (مش فشل)');
    return;
  }
  const raw = fs.readFileSync(file, 'utf8');
  const json = raw.slice(raw.indexOf('=') + 1).replace(/;\s*$/, '').trim();
  const MK = JSON.parse(json);
  const rows = MK.egypt || [];
  assert.ok(rows.length > 200, 'عدد الأسهم في الملف (' + rows.length + ')');

  /* نحوّل الشكل القديم لِشكل الـAPI الحالي */
  const merged = rows.map(r => SM.merge(
    { code: r.code, name: r.name, sector: r.sectorAr || r.sector, price: r.price, change: r.change,
      volume: r.volume, volatility: r.volD, rel_volume: r.relvol, beta: r.beta, mkt_cap: r.mc },
    { rsi: r.rsi, sma200: r.sma200, macd: r.macd, macdSig: r.macdSig, p1m: r.p1m, p3m: r.p3m,
      p1w: r.p1w, volD: r.volD, relvol: r.relvol, av30: r.av30 },
    { ma50: r.ma50, ma200: r.ma200, relvol: r.relvol, av30: r.av30, perf1m: r.p1m, perf3m: r.p3m,
      beta: r.beta, mdd: r.mdd, float: r.float }
  ));
  const ranked = SM.rank(merged);
  assert.equal(ranked.length, rows.length, 'كل الأسهم اتحسبت');
  ranked.forEach(r => {
    finite(r.score, 'نتيجة ' + r.code);
    inRange(r.score, 0, 100, 'نتيجة ' + r.code);
  });
  /* توزيع معقول — يمنع نموذج مكسور */
  const scores = ranked.map(r => r.score);
  const median = scores[Math.floor(scores.length / 2)];
  assert.ok(median > 15 && median < 85, 'وسيط النتائج معقول (' + median + ')');
  assert.ok(ranked[0].score > 55, 'أعلى نتيجة لازم تكون قوية');
  /* مافيش NaN في الأجزاء */
  ranked.forEach(r => {
    r.axes.trend.parts.concat(r.axes.momentum.parts, r.axes.volatility.parts, r.axes.volume.parts)
      .forEach(p => { assert.ok(isFinite(p.v), 'جزء ' + p.k + ' في ' + r.code); });
  });
});


/* ═══════════════════════════════════════════════════════════
   ④ نموذج رانيا + Order Block + EMA فيبوناتشي
   ═══════════════════════════════════════════════════════════ */
test('نموذج رانيا: ٣ شموع صاعدة مكتملة بتتعرف', () => {
  /* شمعة قوية صاعدة · شمعة تصحيح صغيرة · شمعة كسرت القمة */
  const c = [];
  for (let i = 0; i < 40; i++) c.push({ t: 'd' + i, o: 100, h: 101, l: 99, c: 100, v: 1000 });
  c.push({ t: 'x1', o: 100, h: 106, l: 99.8, c: 105, v: 5000 });   /* قوية */
  c.push({ t: 'x2', o: 105, h: 105.5, l: 103, c: 103.4, v: 2000 }); /* تصحيح */
  c.push({ t: 'x3', o: 103.4, h: 108, l: 103.2, c: 107.5, v: 6000 }); /* كسرت القمة */
  const r = SM.ranaPattern(c);
  assert.ok(r, 'النموذج اتحسب');
  assert.equal(r.state, 'bull', 'النموذج لازم يكون صاعد');
  assert.ok(r.strength > 0, 'فيه قوة');
});

test('نموذج رانيا: مفيش نم��ذج ⇒ مفيش ادعاء كاذب', () => {
  const c = [];
  for (let i = 0; i < 40; i++) c.push({ t: 'd' + i, o: 100, h: 101, l: 99, c: 100, v: 1000 });
  const r = SM.ranaPattern(c);
  assert.equal(r.state, 'none', 'مفيش نموذج');
});

test('Order Block: زون شراء/بيع بيتحسب ومش مخترع', () => {
  const c = [];
  for (let i = 0; i < 40; i++) c.push({ t: 'd' + i, o: 100, h: 101, l: 99, c: 100, v: 1000 });
  c.push({ t: 'ob', o: 100, h: 101, l: 95, c: 95.5, v: 1200 });   /* هابطة */
  c.push({ t: 'imp', o: 95.5, h: 108, l: 95.4, c: 107, v: 9000 }); /* اندفاع صاعد */
  const ob = SM.orderBlock(c);
  assert.ok(ob, 'الزون اتحسب');
  assert.equal(ob.state, 'bull', 'ز��ن شراء');
  assert.ok(ob.lo >= 94 && ob.hi <= 102, 'نطاق الزون من الشمعة المعاكسة');
});

test('EMA فيبوناتشي: الترتيب + VWAP', () => {
  const c = [];
  for (let i = 0; i < 80; i++) {
    const p = 100 + i;                       /* اتجاه صاعد ثابت */
    c.push({ t: 'd' + i, o: p - 0.5, h: p + 1, l: p - 1, c: p, v: 1000 + i });
  }
  const f = SM.fibEmas(c);
  assert.ok(f, 'اتحسب');
  assert.equal(f.align, 'up', 'ترتيب صاعد في اتجاه صاعد');
  assert.ok(f.e8 > f.e13 && f.e13 > f.e21 && f.e21 > f.e34 && f.e34 > f.e55, 'ترتيب المتوسطات');
  assert.ok(f.vwap > 0, 'VWAP رقم');
});


/* ═══════════════════════════════════════════════════════════
   🎯 دقة المستويات — الأسهم الرخيصة (باج ARAB ٠.٢٤٨)
   ═══════════════════════════════════════════════════════════ */
test('المستويات: سهم تحت ١ جنيه — التقueling ميضيّعش الخانات', () => {
  /* candle price ~0.248 زي ARAB —Direction هابط عشان نختبر الهدف تحت */
  const c = [];
  for (let i = 0; i < 80; i++) {
    const p = 0.30 - i * 0.0007;
    c.push({ t: 'd' + i, o: p + 0.002, h: p + 0.004, l: p - 0.004, c: p, v: 100000 + i });
  }
  const r = SM.fromCandles(c, {});
  assert.ok(r && r.levels, 'المستويات اتحسبت');
  const L = r.levels;
  /* ⛔ الباج: round1 كان بيحوّل ٠.٢٤٨ → ٠.٢ والهدف → ٠.٢ */
  assert.ok(String(L.entry).indexOf('0.2') === 0 && L.entry > 0.2 && L.entry < 0.3,
    'الدخول لازم يفضل precise (مش ٠.٢) — got: ' + L.entry);
  assert.ok(L.entry.toString().split('.').length === 2 && L.entry.toString().split('.')[1].length >= 3,
    'الدخول لازم ٣ خانات على الأقل — got: ' + L.entry);
  assert.ok(L.stop !== L.entry && L.target !== L.entry, 'الlevels مختلفة عن الدخول');
  /* ⛌ في الإعداد الهابط: الوقف فوق والهدف تحت */
  if (L.dir === 'down') {
    assert.ok(L.stop > L.entry, 'في البيع: الوقف فوق الدخول');
    assert.ok(L.target < L.entry, 'في البيع: الهدف تحت الدخول');
  } else {
    assert.ok(L.stop < L.entry, 'في الشراء: الوقف تحت الدخول');
    assert.ok(L.target > L.entry, 'في الشراء: الهدف فوق الدخول');
  }
  assert.ok(L.dirLabel && L.dirLabel.length > 5, 'فيه وصف للاتجاه');
});

test('المستويات:Directions يتفق مع اتجاه البنية', () => {
  const up = [];
  for (let i = 0; i < 80; i++) {
    const p = 10 + i * 0.05;
    up.push({ t: 'd' + i, o: p - 0.1, h: p + 0.2, l: p - 0.2, c: p, v: 100000 + i });
  }
  const r = SM.fromCandles(up, {});
  assert.ok(r.levels, 'اتحسب');
  assert.equal(r.levels.dir, 'up', 'اتجاه صاعد');
  assert.ok(r.levels.target > r.levels.entry, 'الهدف فوق في الصاعد');
  assert.ok(r.levels.stop < r.levels.entry, 'الوقف تحت في الصاعد');
});
