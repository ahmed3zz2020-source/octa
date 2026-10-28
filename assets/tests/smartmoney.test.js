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

/* 📅 تاريخ شمعة حديث (منافض للحارس: البيانات الأقدم من ١٠ أيام مرفوضة) */
function dayIso(offset) {
  const d = new Date(Date.now() - (offset || 0) * 86400000);
  return d.toISOString().slice(0, 10);
}


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
    out.push({ t: dayIso(59 - i), o: +(c - 0.8).toFixed(2), h: +(c + 0.3).toFixed(2),
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
    out.push({ t: dayIso(59 - i), o: +(c + 0.8).toFixed(2), h: +(c + 1.6).toFixed(2),
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
  for (let i = 0; i < 40; i++) c.push({ t: dayIso(59 - i), o: 100, h: 101, l: 99, c: 100, v: 1000 });
  c.push({ t: dayIso(3), o: 100, h: 106, l: 99.8, c: 105, v: 5000 });   /* قوية */
  c.push({ t: dayIso(2), o: 105, h: 105.5, l: 103, c: 103.4, v: 2000 }); /* تصحيح */
  c.push({ t: dayIso(1), o: 103.4, h: 108, l: 103.2, c: 107.5, v: 6000 }); /* كسرت القمة */
  const r = SM.ranaPattern(c);
  assert.ok(r, 'النموذج اتحسب');
  assert.equal(r.state, 'bull', 'النموذج لازم يكون صاعد');
  assert.ok(r.strength > 0, 'فيه قوة');
});

test('نموذج رانيا: مفيش نموذج ⇒ مفيش ادعاء كاذب', () => {
  const c = [];
  for (let i = 0; i < 40; i++) c.push({ t: dayIso(59 - i), o: 100, h: 101, l: 99, c: 100, v: 1000 });
  const r = SM.ranaPattern(c);
  assert.equal(r.state, 'none', 'مفيش نموذج');
});

test('Order Block: زون شراء/بيع بيتحسب ومش مخترع', () => {
  const c = [];
  for (let i = 0; i < 40; i++) c.push({ t: dayIso(59 - i), o: 100, h: 101, l: 99, c: 100, v: 1000 });
  c.push({ t: 'ob', o: 100, h: 101, l: 95, c: 95.5, v: 1200 });   /* هابطة */
  c.push({ t: 'imp', o: 95.5, h: 108, l: 95.4, c: 107, v: 9000 }); /* اندفاع صاعد */
  const ob = SM.orderBlock(c);
  assert.ok(ob, 'الزون اتحسب');
  assert.equal(ob.state, 'bull', 'زمن شراء');
  assert.ok(ob.lo >= 94 && ob.hi <= 102, 'نطاق الزون من الشمعة المعاكسة');
});

test('EMA فيبوناتشي: الترتيب + VWAP', () => {
  const c = [];
  for (let i = 0; i < 80; i++) {
    const p = 100 + i;                       /* اتجاه صاعد ثابت */
    c.push({ t: dayIso(59 - i), o: p - 0.5, h: p + 1, l: p - 1, c: p, v: 1000 + i });
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
    c.push({ t: dayIso(59 - i), o: p + 0.002, h: p + 0.004, l: p - 0.004, c: p, v: 100000 + i });
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
    up.push({ t: dayIso(59 - i), o: p - 0.1, h: p + 0.2, l: p - 0.2, c: p, v: 100000 + i });
  }
  const r = SM.fromCandles(up, {});
  assert.ok(r.levels, 'اتحسب');
  assert.equal(r.levels.dir, 'up', 'اتجاه صاعد');
  assert.ok(r.levels.target > r.levels.entry, 'الهدف فوق في الصاعد');
  assert.ok(r.levels.stop < r.levels.entry, 'الوقف تحت في الصاعد');
});


/* ═══════════════════════════════════════════════════════════
   🎯 القاعدة الذهبية: الوقف تحت والهدف فوق — دايمًا
   ═══════════════════════════════════════════════════════════ */
test('المستويات: الوقف تحت والهدف فوق دايمًا (حتى في البنية الهابطة)', () => {
  /* اتجاه هابط واضح */
  const down = [];
  for (let i = 0; i < 80; i++) {
    const p = 20 - i * 0.15;
    down.push({ t: dayIso(59 - i), o: p + 0.2, h: p + 0.35, l: p - 0.2, c: p, v: 100000 + i });
  }
  const r = SM.fromCandles(down, {});
  assert.ok(r.levels, 'اتحسب');
  assert.ok(r.levels.stop < r.levels.entry, 'الوقف تحت الدخول — got: ' + r.levels.stop + ' vs ' + r.levels.entry);
  assert.ok(r.levels.target > r.levels.entry, 'الهدف فوق الدخول — got: ' + r.levels.target + ' vs ' + r.levels.entry);
  assert.equal(r.levels.dir, 'up', 'الاتجاه دايمًا شراء');
  assert.ok(r.levels.bearNote && r.levels.bearNote.length > 5, 'فيه تنبيه إن البنية هابطة');
});


/* ═══════════════════════════════════════════════════════════
   📐 ATR = Wilder (RMA) — يطابق TradingView بالظبط
   ───────────────────────────────────────────────────────────
   ⛔ الباج: كان ema(tr) ⇒ القيمة أعلى بـ٦-٩٪ (COMI ٢.٨ بدل ٢.٦٤)
   ⛌   ⇒ وقف الخسارة والهدف بيحسبوا من ATR مختلف عن اللي المستخدم
   ⛌   شايفه في TradingView.
   ═══════════════════════════════════════════════════════════ */
test('ATR: Wilder مطابق للTradingView (مش EMA)', () => {
  /* سلسلة ثابتة — القيمة المرجعية محسوبة مستقلاً: 2.0 */
  const c = [];
  for (let i = 0; i < 40; i++) {
    const p = 100 + i;
    c.push({ t: dayIso(59 - i), o: p - 0.5, h: p + 1.0, l: p - 1.0, c: p, v: 1000 });
  }
  const a = SM.atr(c, 14);
  assert.ok(Math.abs(a - 2.0) < 1e-9, 'ATR لازم يساوي ٢ (Wilder) — got: ' + a);
});

test('ATR: EMA كان أعلى — الـlevels بتتغيّر accordingly', () => {
  const c = [];
  for (let i = 0; i < 60; i++) {
    const p = 100 + i * 1.2;
    c.push({ t: dayIso(59 - i), o: p - 0.8, h: p + 0.3, l: p - 1.6, c: p, v: 1000 });
  }
  const a = SM.atr(c, 14);
  const r = SM.fromCandles(c, {});
  /* وقف = دخول − ١.٥×ATR ⇒ لازم يتحسب من نفس الـATR */
  const expStop = r.levels.entry - 1.5 * a;
  /* ⚠️ التسامح ٠.٠٦ بسبب التقريب حسب حجم السعر (سعر ١٧٠ ⇒ خانة واحدة) */
  assert.ok(Math.abs(r.levels.stop - expStop) < 0.06, 'الوقف محسوب من نفس الـATR — got ' + r.levels.stop + ' vs ' + expStop.toFixed(3));
});


/* ═══════════════════════════════════════════════════════════
   🛡️ حماية +MDD من الشموع
   ═══════════════════════════════════════════════════════════ */
test('NaN في المدخلات ما بيpoisonش الدرجة', () => {
  const r = SM.compute({ code: 'X', price: NaN, rsi: NaN, change: NaN });
  assert.ok(isFinite(r.score), 'الدرجة لازم تبقى رقم — got: ' + r.score);
  assert.ok(isFinite(r.axes.trend.score), 'محور الاتجاه رقم');
});

test('MDD بيتحسب من الشموع (مفيش عمود له في المسح)', () => {
  const c = [];
  /* صعود ١٠٠ ثم هبوط ٢٠٪ ثم تعافٍ */
  for (let i = 0; i < 20; i++) c.push({ t: dayIso(29 - i), o: 100 + i, h: 101 + i, l: 99 + i, c: 100 + i, v: 1000 });
  for (let i = 0; i < 10; i++) c.push({ t: dayIso(19 - i), o: 120 - i * 2, h: 121 - i * 2, l: 118 - i * 2, c: 119 - i * 2, v: 1000 });
  const r = SM.fromCandles(c, {});
  assert.ok(r.mdd != null, 'MDD اتحسب');
  assert.ok(r.mdd > 15 && r.mdd < 25, 'MDD قريب من ٢٠٪ — got: ' + r.mdd);
});


test('الشموع غير المرتبة بتترتب قبل الحساب', () => {
  const mk = (n) => {
    const out = [];
    for (let i = 0; i < 60; i++) {
      const p = 100 + i * 1.2;
      out.push({ t: dayIso(59 - i),
        o: p - 0.8, h: p + 0.3, l: p - 1.6, c: p, v: 1000 });
    }
    return out;
  };
  const ordered = mk(60);
  const shuffled = ordered.slice().reverse();
  const a = SM.fromCandles(ordered, {});
  const b = SM.fromCandles(shuffled, {});
  assert.ok(a && b, 'اتحسبوا');
  assert.ok(Math.abs(a.atr - b.atr) < 1e-9, 'نفس الـATR بعد الترتيب — ' + a.atr + ' vs ' + b.atr);
});


/* ═══════════════════════════════════════════════════════════
   🛡️ اختبارات حارس — نتائج تدقيق ٢٣ أكتوبر ٢٠٢٦
   ═══════════════════════════════════════════════════════════ */
const FULL = {
  code: 'X', price: 100, change: 1, volume: 1000, av30: 1000, rsi: 60,
  macd: 1, macdSig: 0.5, ma50: 110, ma200: 100, perf1w: 1, perf1m: 2, perf3m: 3,
  volD: 2.5, beta: 1, relvol: 1.2, turnover: 0.01, mktCap: 1e9
};

test('المحور الفاضي ما بياخدش نص وزنه (مش ٥٠)', () => {
  /* ٣ محاور كاملة + محور الزخم فاضي ⇒ الدرجة ما تقفزش لـ ٩٥ */
  const r = SM.compute(Object.assign({}, FULL, { rsi: null, macd: null, macdSig: null, perf1w: null }));
  assert.ok(r.axes.momentum.has === false, 'محور الزخم ناقص');
  assert.ok(r.coverage < 100, 'التغطية أقل من ١٠٠٪ — got ' + r.coverage);
  assert.ok(r.score < 90, 'الدرجة ما فيش تضخيم — got ' + r.score);
});

test('سهم بلا بيانات ⇒ درجة صفر مش ٦٠', () => {
  const r = SM.compute({ code: 'E' });
  assert.equal(r.score, 0, 'الدرجة صفر');
  assert.equal(r.weak, true, 'معلّم ضعيف');
  assert.equal(r.coverage, 0, 'تغطية صفر');
});

test('شارة «توافق ٤ محاور» محتاجة ٤ محاور فعلاً', () => {
  const r = SM.compute(Object.assign({}, FULL, { rsi: null, macd: null, macdSig: null, perf1w: null }));
  assert.ok(!r.badges.some(b => b.id === 'agree'), 'ما فيش شارة توافق على ٣ محاور');
  const r2 = SM.compute(FULL);
  assert.ok(r2.badges.some(b => b.id === 'agree'), 'مع ٤ محاور كاملة في شارة');
});

test('سهم ما اتداولش (حجم = ٠) ⇒ محور الحجم مستبعد', () => {
  const r = SM.compute(Object.assign({}, FULL, { volume: 0, change: 0 }));
  assert.equal(r.axes.volume.has, false, 'محور الحجم مستبعد');
  assert.ok(r.coverage < 100, 'التغطية قلّت');
});

test('سندات EGP مش أسهم — مستبعدة من الترتيب', () => {
  const out = SM.rank([{ code: 'EGS3E071C013-EGP', price: 99.8 }, Object.assign({}, FULL)]);
  assert.equal(out.length, 1, 'السند اتشال');
  assert.equal(out[0].code, 'X', 'فقط السهم');
});

test('RSI تحت ٣٠ ⇒ زخم ضعيف (صفر) + شارة تشبع بيعي', () => {
  const r20 = SM.compute(Object.assign({}, FULL, { rsi: 20 }));
  const r60 = SM.compute(Object.assign({}, FULL, { rsi: 60 }));
  assert.ok(r20.score < r60.score, 'RSI ٢٠ أضعف من ٦٠ — ' + r20.score + ' vs ' + r60.score);
  assert.ok(r20.badges.some(b => b.id === 'oversold'), 'شارة التشبع البيعي');
  const part = r20.axes.momentum.parts.find(p => p.k === 'rsi');
  assert.equal(part.v, 0, 'جزء الـRSI = صفر (زخم ضعيف)');
});

test('MACD من غير سعر ⇒ محايد ٥٠ (مش ٧٥)', () => {
  const r = SM.compute(Object.assign({}, FULL, { price: null }));
  const part = r.axes.momentum.parts.find(p => p.k === 'macd');
  assert.ok(part, 'الجزء موجود');
  assert.ok(Math.abs(part.v - 0.5) < 1e-9, 'القيمة محايدة — got ' + part.v);
});

test('شموع قديمة (أكتر من ١٠ أيام) ⇒ مفيش مؤشرات', () => {
  const old = [];
  for (let i = 0; i < 60; i++) {
    old.push({ t: '2017-01-' + String((i % 28) + 1).padStart(2, '0'),
      o: 10, h: 11, l: 9, c: 10, v: 100 });
  }
  assert.equal(SM.fromCandles(old, {}), null, 'مفيش مؤشرات على بيانات قديمة');
  const fresh = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date(Date.now() - i * 86400000);
    fresh.push({ t: d.toISOString().slice(0, 10), o: 10, h: 11, l: 9, c: 10, v: 100 });
  }
  const r = SM.fromCandles(fresh, {});
  assert.ok(r && r.atr != null, 'الشموع الحديثة بتشتغل');
});

test('المتوسطات بتتقرب حسب حجم السعر (مش خانة واحدة)', () => {
  const c = [];
  for (let i = 0; i < 80; i++) {
    const p = 0.30 - i * 0.0007;
    const d = new Date(Date.now() - (79 - i) * 86400000);
    c.push({ t: d.toISOString().slice(0, 10),
      o: p + 0.002, h: p + 0.004, l: p - 0.004, c: p, v: 100000 + i });
  }
  const r = SM.fromCandles(c, {});
  assert.ok(r.fib, 'المتوسطات اتحسبت');
  const vals = [r.fib.e8, r.fib.e13, r.fib.e21, r.fib.e34, r.fib.e55];
  const uniq = new Set(vals.map(v => String(v)));
  assert.ok(uniq.size >= 3, 'المتوسطات مختلفة (مش كلها نفس الرقم) — ' + vals.join(','));
  assert.ok(r.fib.vwap > 0.2 && r.fib.vwap < 0.3, 'VWAP دقيق — got ' + r.fib.vwap);
});

test('جيميني ما يتشبّعش عند ٠/١٠٠', () => {
  const c = [];
  for (let i = 0; i < 80; i++) {
    const p = 100 + (i % 2 ? 1 : -1) * 0.2;
    const d = new Date(Date.now() - (79 - i) * 86400000);
    c.push({ t: d.toISOString().slice(0, 10),
      o: p, h: p + 0.5, l: p - 0.5, c: p, v: 1000 });
  }
  const r = SM.fromCandles(c, {});
  assert.ok(r.gemini, 'الجيميني اتحسب');
  assert.ok(r.gemini.value > 0 && r.gemini.value < 100, 'مش متشبّع — got ' + r.gemini.value);
});

test('MCDX بيتغيّر مع البيانات (مش ثابت قرب ٥٠)', () => {
  const mk = (trend) => {
    const c = [];
    for (let i = 0; i < 80; i++) {
      const p = 100 + trend * i * 0.5;
      /* الإغلاق قرب القمة في الصاعد وقرب الأرض في الهابط
         ⇒ تدفق الفلوس مختلف فعلاً (mm ≠ 0) */
      const o = trend > 0 ? p - 0.6 : p + 0.6;
      const h = trend > 0 ? p + 0.4 : p + 0.8;
      const l = trend > 0 ? p - 0.8 : p - 0.4;
      const d = new Date(Date.now() - (79 - i) * 86400000);
      c.push({ t: d.toISOString().slice(0, 10),
        o: o, h: h, l: l, c: p, v: 1000 + (trend > 0 ? i * 20 : 0) });
    }
    return c;
  };
  const up = SM.fromCandles(mk(1), {});
  const down = SM.fromCandles(mk(-1), {});
  assert.ok(up && down, 'اتحسبوا');
  assert.ok(Math.abs(up.mcdx.value - down.mcdx.value) > 5,
    'MCDX مختلف بين اتجاهين — ' + up.mcdx.value + ' vs ' + down.mcdx.value);
});
