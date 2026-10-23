/* ══════════════════════════════════════════════════════════════
   🧪 اختبارات محرك الرادار — assets/tests/radar.test.js
   ──────────────────────────────────────────────────────────────
   التشغيل:  cd /workspace/octa && node --test assets/tests/radar.test.js
   ⛔ مافيش framework تاني — node:test + node:assert/strict بس
   ⛔ مافيش شبكة — كل الأرقام هنا محسوبة جوه الملف

   📌 المبدأ:
      · كل قيمة مرجعية مكتوبة بخط اليد (مش مستعارة من المحرك)
        فالمقارنة حقيقية مش circular.
      · المقارنة الحسابية بت tolerância 1e-9.
      · لازم كل النتيجة تبقى أرقام منتهية — مافيش NaN ولا Infinity.
      · ⛔ المؤشر الناقص لازم يبقى null — مش ٠ ومش ٥٠.
   ══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const R = require('../js/octa-radar.js');

const EPS = 1e-9;
function closeTo(actual, expected, msg) {
  assert.equal(typeof actual, 'number', (msg || '') + ' — لازم رقم');
  assert.ok(Math.abs(actual - expected) <= EPS,
    (msg || '') + ' — المتوقع ' + expected + ' والفعلي ' + actual);
}
/* ⛔ قيم مرجعية مكتوبة بـ٤ خانات ⇒ تسريب أكبر (مش 1e-9) */
function closeToLoose(actual, expected, msg) {
  assert.equal(typeof actual, 'number', (msg || '') + ' — لازم رقم');
  assert.ok(Math.abs(actual - expected) <= 5e-5,
    (msg || '') + ' — المتوقع ' + expected + ' والفعلي ' + actual);
}
function inRange(v, lo, hi, msg) {
  assert.equal(typeof v, 'number', (msg || '') + ' — لازم رقم');
  assert.ok(v >= lo - EPS && v <= hi + EPS, (msg || '') + ' — خارج النطاق: ' + v);
}
function finite(v, msg) {
  assert.ok(typeof v === 'number' && isFinite(v), (msg || '') + ' — قيمة مش منتهية: ' + v);
}

/* 📅 تاريخ شمعة حديث (منافض للحارس: البيانات الأقدم من ١٠ أيام مرفوضة) */
function dayIso(offset) {
  const d = new Date(Date.now() - (offset || 0) * 86400000);
  return d.toISOString().slice(0, 10);
}

/* ═══════════════════════════════════════════════════════════
   🛠 باني شموع
   ═══════════════════════════════════════════════════════════ */
/**
 * يبني شموع: اتجاه + تذبذب + حجم
 * trend:  +1 صاعد · -1 هابط · 0 عرضي
 * n: عدد الجلسات
 */
function mkCandles(opts) {
  opts = opts || {};
  const n = opts.n || 120;
  const trend = opts.trend == null ? 1 : opts.trend;
  const start = opts.start == null ? 100 : opts.start;
  const vol = opts.vol == null ? 1000 : opts.vol;
  const volGrow = opts.volGrow == null ? 0 : opts.volGrow;
  const wob = opts.wob == null ? 0.4 : opts.wob;
  const out = [];
  for (let i = 0; i < n; i++) {
    const base = start + trend * i * 0.8;
    const w = Math.sin(i / 3) * wob;
    const c = base + w;
    const h = Math.max(c, base) + 0.5;
    const l = Math.min(c, base) - 0.5;
    out.push({
      t: dayIso(n - 1 - i),
      o: base, h: h, l: l, c: c,
      v: vol + volGrow * i
    });
  }
  return out;
}

/* 🔥 شمعة بحجم استثنائي (نشاط) — آخر جلسة */
function withSpike(candles, mult) {
  const c = candles.slice();
  const last = c[c.length - 1];
  last.v = Math.round(last.v * (mult || 3));
  return c;
}

/* 📉 شموع فيها ارتدادات حقيقية (قمم وأرض) — موجة بطيئة وعميقة
   ⛔ لازم الموجة تكون أعمق من انجراف الاتجاه في ٣ جلسات
      (٠.٨ × ٣ = ٢.٤) وإلا مافيش قمم خالص. */
function mkWavy(o) {
  o = o || {};
  const n = o.n || 150, trend = o.trend == null ? 1 : o.trend;
  const amp = o.amp == null ? 5 : o.amp;
  const per = o.period == null ? 12 : o.period;   /* الدورة بالشموع */
  const out = [];
  for (let i = 0; i < n; i++) {
    const base = 100 + trend * i * 0.8;
    const c = base + Math.sin(2 * Math.PI * i / per) * amp;
    const h = Math.max(c, base) + 0.5;
    const l = Math.min(c, base) - 0.5;
    out.push({ t: dayIso(n - 1 - i), o: base, h: h, l: l, c: c, v: 1000 + (i % 7) * 100 });
  }
  return out;
}

/* 🌊 شموع واقعية: اتجاه + ضوضاء نسبية (مش خط مستقيم) */
function mkReal(o) {
  o = o || {};
  const n = o.n || 150, trend = o.trend == null ? 1 : o.trend;
  const noise = o.noise == null ? 0.012 : o.noise;
  let seed = o.seed == null ? 7 : o.seed;
  function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
  const out = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    p = p * (1 + trend * 0.004 + (rnd() - 0.5) * noise);
    const c = p, h = p * 1.006, l = p * 0.994;
    out.push({ t: dayIso(n - 1 - i), o: p, h: h, l: l, c: c, v: 1000 + Math.floor(rnd() * 3000) });
  }
  return out;
}

/* شموع بأسعار ثابتة (بيانات وهمية) */
function mkFlat(n) {
  const out = [];
  for (let i = 0; i < (n || 60); i++) {
    out.push({ t: dayIso((n || 60) - 1 - i), o: 10, h: 10, l: 10, c: 10, v: 500 });
  }
  return out;
}

/* شموع عشوائية ثابتة البذرة (reproducible) */
function mkRandom(n, seed) {
  let s = seed == null ? 42 : seed;
  function rnd() { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }
  const out = [];
  let p = 100;
  for (let i = 0; i < (n || 120); i++) {
    p = Math.max(1, p * (1 + (rnd() - 0.5) * 0.05));
    const o = p, c = Math.max(1, p * (1 + (rnd() - 0.5) * 0.03));
    const h = Math.max(o, c) * 1.01, l = Math.min(o, c) * 0.99;
    out.push({ t: dayIso((n || 120) - 1 - i), o: o, h: h, l: l, c: c, v: Math.floor(1000 + rnd() * 5000) });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════
   📊 1) المؤشرات — قيم مرجعية مكتوبة بخط اليد
   ═══════════════════════════════════════════════════════════ */

test('SMA — متوسط متحرك بسيط', () => {
  closeTo(R.sma([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5), 8, 'SMA(5) من 1..10');
  closeTo(R.sma([1, 2, 3, 4, 5], 5), 3, 'SMA(5) من 1..5');
  assert.equal(R.sma([1, 2, 3], 5), null, '⛔ بيانات مش كفاية ⇒ null مش NaN');
});

test('EMA — البذرة متوسط بسيط (مش أول قيمة)', () => {
  /* EMA(3) على 1..10: البذرة = SMA(1,2,3) = 2 ، k = 0.5
     2 → 3 → 4 → 5 → 6 → 7 → 8 → 9  (بعد ٧ قراءات) */
  closeTo(R.ema([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3), 9, 'EMA(3) من 1..10');
  assert.equal(R.ema([1, 2], 5), null, '⛔ بيانات مش كفاية ⇒ null');
});

test('RSI (Wilder) — القيمة المرجعية الشهيرة', () => {
  /* 33 سعر من مثال StockCharts الشهير
     أول RSI = 70.53 · آخر RSI = 37.77 */
  const closes = [44.3389, 44.0902, 44.1497, 43.6122, 44.3278, 44.8264, 45.0955,
    45.4245, 45.8433, 46.0826, 45.8931, 46.0328, 45.6140, 46.2820, 46.2820,
    46.0028, 46.0328, 46.4116, 46.2222, 45.6439, 46.2122, 46.2521, 45.7137,
    46.4515, 45.7835, 45.3548, 44.0288, 44.1783, 44.2181, 44.5672, 43.4205,
    42.6628, 43.1314];
  const s = R.rsiSeries(closes, 14);
  assert.ok(s, 'السلسلة اتحسبت');
  closeToLoose(s[0], 70.5311, 'أول RSI');
  closeToLoose(s[s.length - 1], 37.7731, 'آخر RSI');
});

test('RSI — صاعد بالكامل ⇒ ١٠٠ · هابط بالكامل ⇒ صفر', () => {
  const up = []; for (let i = 1; i <= 40; i++) up.push(i);
  closeTo(R.rsi(up, 14), 100, 'صاعد بالكامل');
  const dn = []; for (let i = 40; i >= 1; i--) dn.push(i);
  closeTo(R.rsi(dn, 14), 0, 'هابط بالكامل');
});

test('MACD — الإشارة = EMA(9) من خط MACD', () => {
  const c = mkCandles({ n: 120, trend: 1 });
  const m = R.macd(c.map(x => x.c));
  assert.ok(m.macd !== null && m.signal !== null, 'اتحسب');
  /* ⛔ في اتجاه صاعد سالب الـhistogram معقول (macd تحت signal بعد التصاعد) */
  finite(m.macd, 'macd'); finite(m.signal, 'signal'); finite(m.hist, 'hist');
  closeTo(m.hist, m.macd - m.signal, 'hist = macd - signal');
});

test('ATR (Wilder) — موجب وأكبر من صفر', () => {
  const c = mkCandles({ n: 120, trend: 1 });
  const a = R.atr(c, 14);
  assert.ok(a > 0, 'ATR موجب — ' + a);
  assert.equal(R.atr(c.slice(0, 5), 14), null, '⛔ بيانات مش كفاية ⇒ null');
});

test('ATR% = ATR ÷ السعر × ١٠٠', () => {
  const c = mkCandles({ n: 120, trend: 1, start: 50 });
  const a = R.atr(c, 14), px = c[c.length - 1].c;
  closeTo(R.atrPct(c, 14), a / px * 100, 'ATR%');
});

test('ADX — اتجاه قوي ⇒ ADX عالي', () => {
  const up = R.adx(mkCandles({ n: 150, trend: 1 }), 14);
  const dn = R.adx(mkCandles({ n: 150, trend: -1 }), 14);
  assert.ok(up && dn, 'اتحسبوا');
  assert.ok(up.adx > 25, 'ADX الصاعد > ٢٥ — ' + up.adx);
  assert.ok(dn.adx > 25, 'ADX الهابط > ٢٥ — ' + dn.adx);
  assert.ok(up.pdi > up.ndi, '+DI > -DI في الصاعد');
  assert.ok(dn.ndi > dn.pdi, '-DI > +DI في الهابط');
});

test('RVOL — الحجم النسبي', () => {
  const c = mkCandles({ n: 60, vol: 1000, volGrow: 0 });
  /* آخر جلسة حجمها = المتوسط ⇒ RVOL ≈ 1 */
  const r = R.rvol(c, 20);
  closeTo(r, 1, 'RVOL مع حجم ثابت');
  const c2 = withSpike(mkCandles({ n: 60, vol: 1000 }), 3);
  assert.ok(R.rvol(c2, 20) > 2.5, 'حجم × ٣ ⇒ RVOL > ٢.٥ — ' + R.rvol(c2, 20));
});

test('متوسط النطاق اليومي', () => {
  const c = mkCandles({ n: 60 });
  const ar = R.avgRange(c, 20);
  assert.ok(ar > 0, 'نطاق موجب');
});

/* ═══════════════════════════════════════════════════════════
   🧪 2) جودة البيانات
   ═══════════════════════════════════════════════════════════ */

test('جلسة غير صالحة (H < L) بتتشال', () => {
  const c = mkCandles({ n: 60 });
  c[10].h = c[10].l - 1;      /* H أقل من L ⇒ مستحيل */
  const dq = R.dataQuality(c);
  assert.equal(dq.badRows, 1, 'صف واحد مستحيل اتشال');
  assert.equal(dq.sessions, 59, 'الباقي اتحسب');
});

test('⛔ بيانات ناقصة ⇒ المحور null مش صفر', () => {
  const c = mkCandles({ n: 20 });   /* أقل من MIN_TREND */
  const t = R.trendEngine(c, R.dataQuality(c), {});
  assert.equal(t.state, R.TREND.NONE, 'الاتجاه: بيانات ناقصة');
  assert.equal(t.score, null, '⛔ الدرجة null — مش ٠');
  const m = R.momentumEngine(c, R.dataQuality(c), {});
  assert.equal(m.score, null, '⛔ زخم null');
  const v = R.volumeEngine(c, R.dataQuality(c), {});
  assert.equal(v.score, null, '⛔ حجم null');
});

test('أسعار ثابتة ⇒ مش بيانات حقيقية', () => {
  const dq = R.dataQuality(mkFlat(60));
  assert.equal(dq.real, false, 'حركة صفرية ⇒ مش حقيقي');
  assert.equal(dq.usable, false, '⇒ مش صالح للتحليل');
});

test('بيانات قديمة (أقدم من أسبوع) ⇒ stale', () => {
  const c = mkCandles({ n: 60 });
  c.forEach((x, i) => { x.t = dayIso(60 - i + 30); });  /* ٣٠ يوم قديم */
  const dq = R.dataQuality(c);
  assert.equal(dq.stale, true, 'قديم');
});

test('الجلسات الصفرية الحجم بتتحمل (مش NaN)', () => {
  const c = mkCandles({ n: 60 });
  c.forEach(x => { x.v = 0; });
  const v = R.volumeEngine(c, R.dataQuality(c), {});
  assert.ok(v, 'المحرك رجّع نتيجة');
  assert.ok(v.score === null || (v.score >= 0 && v.score <= 100), 'درجة سليمة');
});

/* ═══════════════════════════════════════════════════════════
   🧭 3) تصنيف الاتجاه
   ═══════════════════════════════════════════════════════════ */

test('اتجاه صاعد ⇒ UPTREND', () => {
  const c = mkCandles({ n: 150, trend: 1 });
  const t = R.trendEngine(c, R.dataQuality(c), {});
  assert.equal(t.state, R.TREND.UP, 'اتجاه صاعد');
  inRange(t.score, 0, 100, 'الدرجة');
  assert.ok(t.score > 55, 'الدرجة عالية في الصاعد — ' + t.score);
});

test('اتجاه هابط ⇒ DOWNTREND', () => {
  const c = mkCandles({ n: 150, trend: -1 });
  const t = R.trendEngine(c, R.dataQuality(c), {});
  assert.equal(t.state, R.TREND.DOWN, 'اتجاه هابط');
  assert.ok(t.score < 45, '⛔ الدرجة منخفضة في الهابط — ' + t.score);
  assert.ok(t.score < 50, '⛔ الاتجاه الهابط القوي لازم يكون تحت المحايد');
});

test('⛔ema200 ناقص بيتسجل كـnull مش بيخلي الدرجة NaN', () => {
  const c = mkCandles({ n: 100, trend: 1 });   /* أقل من ٢٠٠ جلسة */
  const t = R.trendEngine(c, R.dataQuality(c), {});
  assert.equal(t.ema200, null, 'EMA200 null');
  finite(t.score, 'الدرجة');
});

test('البنية: قمم وأرض صاعدة (في شموع فيها ارتدادات)', () => {
  const c = mkWavy({ n: 150, trend: 1 });
  const st = R.structureBias(c);
  assert.equal(st.bias, 'up', 'بنية صاعدة');
  assert.equal(st.hh, true, 'قمم صاعدة');
  assert.equal(st.hl, true, 'أرض صاعدة');
});

test('⛔ اتجاه قوي بلا قمم ⇒ البنية null (مش مخترعة)', () => {
  const c = mkCandles({ n: 150, trend: 1, wob: 0.05 });
  const st = R.structureBias(c);
  assert.equal(st.bias, null, 'مافيش ارتدادات ⇒ مافيش قمم ⇒ null');
  const t = R.trendEngine(c, R.dataQuality(c), {});
  assert.ok(t.score !== null, '⛔ الاتجاه لسه اتحسب بالاحتياطي (ميل EMA20)');
  assert.ok(t.parts.some(p => p.k === 'ema_slope'), 'الاحتياطي اتسجّل كدليل');
});

test('المستويات: مقاومة فوق/support تحت السعر الحالي', () => {
  const c = mkCandles({ n: 150, trend: 1 });
  const L = R.levels(c);
  const px = c[c.length - 1].c;
  if (L.resistance !== null) assert.ok(L.resistance > px, 'المقاومة فوق السعر');
  if (L.support !== null) assert.ok(L.support < px, 'الدعم تحت السعر');
});

/* ═══════════════════════════════════════════════════════════
   ⚡ 4) تصنيف الزخم
   ═══════════════════════════════════════════════════════════ */

test('زخم صاعد قوي ⇒ STRONG POSITIVE', () => {
  const c = mkReal({ n: 150, trend: 1, noise: 0.04, seed: 3 });
  const m = R.momentumEngine(c, R.dataQuality(c), {});
  assert.equal(m.dirState, R.MOM.STRONG_POS, 'زخم قوي — ' + m.dirState);
  inRange(m.score, 0, 100, 'الدرجة');
  assert.ok(m.rsi > 50, 'RSI فوق ٥٠ — ' + m.rsi);
});

test('زخم هابط قوي ⇒ STRONG NEGATIVE', () => {
  const c = mkReal({ n: 150, trend: -1, noise: 0.03, seed: 11 });
  const m = R.momentumEngine(c, R.dataQuality(c), {});
  assert.equal(m.dirState, R.MOM.STRONG_NEG, 'زخم هابط — ' + m.dirState);
  assert.ok(m.rsi < 50, 'RSI تحت ٥٠ — ' + m.rsi);
});

test('⛔ التشبع محفوظ كحالة مستقلة (مش يمسح الاتجاه)', () => {
  const c = mkReal({ n: 150, trend: 1, noise: 0.04, seed: 3 });
  const m = R.momentumEngine(c, R.dataQuality(c), {});
  if (m.rsi >= 70) {
    assert.equal(m.state, R.MOM.OVERBOUGHT, 'الحالة النهائية: تشبع شرائي');
    assert.ok(m.dirState.indexOf('POSITIVE') >= 0, '⛔ الاتجاه محفوظ — ' + m.dirState);
    assert.equal(m.zone, 'overbought', 'المنطقة');
  }
});

test('⛔ RSI فوق ٧٠ ⇒ OVERBOUGHT (مش bearish تلقائي)', () => {
  const c = mkCandles({ n: 120, trend: 1, wob: 0.1 });
  const m = R.momentumEngine(c, R.dataQuality(c), {});
  if (m.rsi >= 70) {
    assert.equal(m.state, R.MOM.OVERBOUGHT, 'تشبع شرائي');
    assert.equal(m.zone, 'overbought', 'المنطقة');
  }
});

test('⛔ RSI تحت ٣٠ ⇒ OVERSOLD (مش bullish تلقائي)', () => {
  const c = mkCandles({ n: 120, trend: -1, wob: 0.1 });
  const m = R.momentumEngine(c, R.dataQuality(c), {});
  if (m.rsi <= 30) {
    assert.equal(m.state, R.MOM.OVERSOLD, 'تشبع بيعي');
    assert.equal(m.zone, 'oversold', 'المنطقة');
  }
});

/* ═══════════════════════════════════════════════════════════
   🌊 5) الحجم والسيولة
   ═══════════════════════════════════════════════════════════ */

test('حجم × ٣ ⇒ HIGH أو UNUSUAL', () => {
  const c = withSpike(mkCandles({ n: 60, vol: 1000 }), 3);
  const v = R.volumeEngine(c, R.dataQuality(c), {});
  assert.ok(v.state === R.VOL.HIGH || v.state === R.VOL.UNUSUAL, 'حجم عالي — ' + v.state);
  assert.ok(v.rvol > 2.5, 'RVOL > 2.5');
});

test('⛔ حجم عالي + سعر هابط = توزيع (درجة منخفضة)', () => {
  const c = withSpike(mkCandles({ n: 60, vol: 1000, trend: -1 }), 4);
  const v = R.volumeEngine(c, R.dataQuality(c), {});
  assert.ok(v.move5 < 0, 'السعر هابط — ' + v.move5);
  assert.ok(v.score < 45, '⛔ الدرجة منخفضة (توزيع) — ' + v.score);
  assert.ok(v.parts.some(p => p.k === 'distribution'), 'علامة التوزيع اتسجّلت');
});

test('⛔ حجم عالي + سعر صاعد = تأكيد (درجة عالية)', () => {
  const c = withSpike(mkCandles({ n: 60, vol: 1000, trend: 1 }), 3);
  const v = R.volumeEngine(c, R.dataQuality(c), {});
  assert.ok(v.move5 > 0, 'السعر صاعد — ' + v.move5);
  assert.ok(v.score > 55, 'الدرجة عالية (تأكيد) — ' + v.score);
});

test('حجم ضعيف ⇒ LOW', () => {
  const c = mkCandles({ n: 60, vol: 1000, volGrow: 0 });
  const v = R.volumeEngine(c, R.dataQuality(c), {});
  assert.equal(v.state, R.VOL.NORMAL, 'حجم ثابت = طبيعي');
  const c2 = mkCandles({ n: 60, vol: 3000, volGrow: -40 });
  const v2 = R.volumeEngine(c2, R.dataQuality(c2), {});
  assert.equal(v2.state, R.VOL.LOW, 'حجم متناقص = ضعيف — ' + v2.state);
});

test('السيولة: نسبة turnover من mc ÷ السعر', () => {
  const c = mkCandles({ n: 60, vol: 100000, start: 50 });
  const px = c[c.length - 1].c;
  /* ١٠٠ ألف سهم متداو�� على ١٠ ملايين سهم ⇒ turnover = ١٪ ⇒ DEEP */
  const mc = px * 10000000;
  const v = R.volumeEngine(c, R.dataQuality(c), { marketCap: mc, price: px });
  assert.equal(v.liq, R.LIQ.DEEP, 'سيولة عالية — ' + v.liq);
  closeTo(v.turnover, 1, 'نسبة الدوران');
});

test('السيولة: نسبة دوران واقعية للمصري ⇒ MODERATE', () => {
  const c = mkCandles({ n: 60, vol: 100000, start: 50 });
  const px = c[c.length - 1].c;
  const mc = px * 50000000;   /* ٥٠ مليون سهم ⇒ turnover = ٠.٢٪ */
  const v = R.volumeEngine(c, R.dataQuality(c), { marketCap: mc, price: px });
  assert.equal(v.liq, R.LIQ.MODERATE, 'سيولة متوسطة — ' + v.liq);
});

test('⛔ من غير mc ⇒ السيولة غير متاحة (مش مخترعة)', () => {
  const c = mkCandles({ n: 60 });
  const v = R.volumeEngine(c, R.dataQuality(c), {});
  assert.equal(v.liq, R.LIQ.NONE, 'سيولة ناقصة');
  assert.equal(v.turnover, null, '⛔ turnover null');
});

/* ═══════════════════════════════════════════════════════════
   🌡️ 6) التذبذب
   ═══════════════════════════════════════════════════════════ */

test('⛔ التذبذب العالي = مخاطرة ⇒ الدرجة أقل', () => {
  const calm = mkCandles({ n: 120, trend: 1, wob: 0.05 });
  const wild = mkCandles({ n: 120, trend: 1, wob: 3.0 });
  const a = R.volatilityEngine(calm, R.dataQuality(calm), {});
  const b = R.volatilityEngine(wild, R.dataQuality(wild), {});
  assert.ok(a.atrPct < b.atrPct, 'التذبذب أكتر فيWild — ' + a.atrPct + ' vs ' + b.atrPct);
  assert.ok(a.score > b.score, 'الدرجة العكسية (منخفضة المخاطرة = درجة أعلى)');
});

test('التذبذب: التصنيف نسبي لتاريخ السهم نفسه', () => {
  const c = mkCandles({ n: 120, trend: 1 });
  const v = R.volatilityEngine(c, R.dataQuality(c), {});
  assert.ok(v.state !== R.VOLAT.NONE, 'اتصنف');
  assert.ok(v.rel !== null, 'النسبة النسبية متاحة');
  inRange(v.rel, 0.3, 3, 'النسبة النسبية مقارنة بمتوسط السهم التاريخي');
});

/* ═══════════════════════════════════════════════════════════
   🧿 7) صفر NaN / Infinity — مسح شامل
   ═══════════════════════════════════════════════════════════ */

test('⛔ مافيش NaN ولا Infinity في أي محرك', () => {
  const fixtures = [
    mkCandles({ n: 300, trend: 1 }),
    mkCandles({ n: 300, trend: -1 }),
    mkCandles({ n: 300, trend: 0 }),
    mkRandom(200, 7),
    mkRandom(200, 99),
    mkFlat(120)
  ];
  for (const c of fixtures) {
    const dq = R.dataQuality(c);
    const res = [
      R.trendEngine(c, dq, {}),
      R.momentumEngine(c, dq, {}),
      R.volumeEngine(c, dq, { marketCap: 1e9, price: c[c.length - 1].c }),
      R.volatilityEngine(c, dq, {})
    ];
    for (const r of res) {
      for (const k of Object.keys(r)) {
        const v = r[k];
        if (typeof v === 'number') {
          assert.ok(isFinite(v), 'NaN/Infinity في ' + k + ' (' + v + ')');
        }
        if (v && typeof v === 'object' && !Array.isArray(v) && k === 'parts') {
          for (const p of v) {
            if (typeof p.v === 'number') {
              assert.ok(isFinite(p.v), 'NaN/Infinity في parts — ' + p.v);
            }
          }
        }
      }
    }
  }
});

test('⛔ محرك بدون شموع ⇒ null مش crash', () => {
  const dq = R.dataQuality(null);
  assert.equal(dq.sessions, 0);
  assert.equal(R.trendEngine([], dq, {}).score, null);
  assert.equal(R.momentumEngine([], dq, {}).score, null);
  assert.equal(R.volumeEngine([], dq, {}).score, null);
  assert.equal(R.volatilityEngine([], dq, {}).score, null);
});

/* ═══════════════════════════════════════════════════════════
   📦 8) الملف موجود وشكله صح
   ═══════════════════════════════════════════════════════════ */

test('ملف المحرك موجود وبيصدّر الـAPI المتوقعة', () => {
  const p = path.join(__dirname, '../js/octa-radar.js');
  assert.ok(fs.existsSync(p), 'الملف موجود');
  for (const fn of ['dataQuality', 'trendEngine', 'momentumEngine',
    'volumeEngine', 'volatilityEngine', 'rsi', 'ema', 'macd', 'atr', 'adx', 'rvol']) {
    assert.equal(typeof R[fn], 'function', 'الدالة ' + fn + ' موجودة');
  }
});

/* ═══════════════════════════════════════════════════════════
   🎯 9) خطة الدخول / الوقف / الهدف
   ═══════════════════════════════════════════════════════════ */

test('خطة دخول على كسر مقاومة + وقف ATR + هدف + نسبة عائد', () => {
  const c = mkWavy({ n: 150, trend: 1, period: 12 });
  const dq = R.dataQuality(c);
  const tr = R.trendEngine(c, dq, {});
  const vola = R.volatilityEngine(c, dq, {});
  const plan = R.planEngine(c, tr, null, vola, {});
  assert.ok(plan.status !== R.PLAN.NONE, 'في خطة — ' + plan.status);
  assert.ok(plan.entry != null, 'في سعر دخول');
  assert.ok(plan.stop != null, 'في وقف');
  assert.ok(plan.stop < plan.entry, '⛔ الوقف لازم تحت الدخول');
  assert.ok(plan.target1 == null || plan.target1 > plan.entry, '⛔ الهدف فوق الدخول');
  assert.ok(plan.rr == null || plan.rr > 0, '⛔ نسبة عائد موجبة');
  assert.ok(plan.confirm && plan.confirm.length > 5, 'في شرط تأكيد');
});

test('⛔ وقف عند أو فوق الدخول ⇒ مفيش نسبة عائد', () => {
  const c = mkWavy({ n: 150, trend: 1, period: 12 });
  const dq = R.dataQuality(c);
  const tr = R.trendEngine(c, dq, {});
  const vola = R.volatilityEngine(c, dq, {});
  const plan = R.planEngine(c, tr, null, vola, { atrStopMult: 0.0001 });
  if (plan.entry != null && plan.stop != null) {
    assert.ok(plan.rr == null || plan.rr > 0, '⛔ مفيش نسبة عائد سالبة');
  }
});

test('⛔ مفيش ATR ⇒ خطة غير متاحة (مش أرقام مصنوعة)', () => {
  const c = mkWavy({ n: 150, trend: 1, period: 12 });
  const tr = R.trendEngine(c, R.dataQuality(c), {});
  const plan = R.planEngine(c, tr, null, { atr: null, atrPct: null }, {});
  assert.equal(plan.status, R.PLAN.NONE, 'خطة غير متاحة');
  assert.equal(plan.stop, null, '⛔ مفيش وقف مخترع');
  assert.equal(plan.rr, null, '⛔ مفيش نسبة عائد');
});

test('⛔ شموع أقل من ٢٠ ⇒ خطة غير متاحة', () => {
  const c = mkCandles({ n: 10 });
  const plan = R.planEngine(c, null, null, null, {});
  assert.equal(plan.status, R.PLAN.NONE);
  assert.equal(plan.entry, null);
});

test('⛔ اتجاه هابط ⇒ الخطة غير صالحة', () => {
  const c = mkWavy({ n: 150, trend: -1, period: 12 });
  const dq = R.dataQuality(c);
  const tr = R.trendEngine(c, dq, {});
  const vola = R.volatilityEngine(c, dq, {});
  const plan = R.planEngine(c, tr, null, vola, {});
  if (plan.status !== R.PLAN.NONE && tr.state === R.TREND.DOWN) {
    assert.equal(plan.status, R.PLAN.INVALID, 'الخطة غير صالحة في هبوط');
  }
});

/* ═══════════════════════════════════════════════════════════
   💰 10) إدارة رأس المال
   ═══════════════════════════════════════════════════════════ */

test('حجم المركز = المخاطرة ÷ المخاطرة لكل سهم', () => {
  const plan = { entry: 100, stop: 95, target1: 115 };
  const s = R.sizingEngine(plan, { capital: 100000, riskPct: 1, maxAllocPct: 100 });
  assert.equal(s.riskAmount, 1000, 'مبلغ المخاطرة');
  assert.equal(s.qty, 200, 'الكمية = ١٠٠٠ ÷ ٥');
  assert.equal(s.positionValue, 20000, 'قيمة المركز');
  assert.equal(s.estLoss, 1000, 'الخسارة المتوقعة عند الوقف');
  assert.equal(s.estProfit, 3000, 'الربح المتوقع عند الهدف');
  assert.equal(s.costsIncluded, false, '⛔ تكاليف المعاملة غير مشمولة');
});

test('⛔ تجاوز سقف التخصيص ⇒ الكمية تقلّ (مش تتعدى)', () => {
  const plan = { entry: 100, stop: 95, target1: 115 };
  const s = R.sizingEngine(plan, { capital: 100000, riskPct: 5, maxAllocPct: 10 });
  assert.equal(s.capped, true, 'اتقلّل');
  assert.ok(s.allocationPct <= 10.0001, '⛔ التخصيص ما تجاوزش ١٠٪ — ' + s.allocationPct);
});

test('⛔ مخاطرة صفر (دخول = وقف) ⇒ مفيش كمية', () => {
  const s = R.sizingEngine({ entry: 100, stop: 100, target1: 110 }, { capital: 100000, riskPct: 1 });
  assert.equal(s.qty, null, '⛔ مفيش كمية');
  assert.equal(s.estLoss, null);
});

test('⛔ مفيش خطة ⇒ مفيش حجم مركز', () => {
  const s = R.sizingEngine({ entry: null, stop: null }, { capital: 100000, riskPct: 1 });
  assert.equal(s.qty, null);
  assert.equal(s.riskAmount, 1000, 'مبلغ المخاطرة لسه بيتحسب');
});

test('⛔ بدون رأس مال ⇒ مفيش أرقام', () => {
  const s = R.sizingEngine({ entry: 100, stop: 95 }, { capital: 0, riskPct: 1 });
  assert.equal(s.qty, null);
  assert.equal(s.riskAmount, null);
});

/* ═══════════════════════════════════════════════════════════
   🛡️ 11) إدارة المخاطر
   ═══════════════════════════════════════════════════════════ */

test('المخاطرة: سيولة ضعيفة + تذبذب عالي ⇒ HIGH على الأقل', () => {
  const r = R.riskEngine({
    dq: { stale: false, sessions: 200 },
    plan: { status: R.PLAN.ZONE, rr: 2.0, conflict: false },
    volat: { atrPct: 6.0 },
    volume: { liq: R.LIQ.ILLIQUID },
    momentum: { dirState: R.MOM.POS },
    trend: { state: R.TREND.UP },
    sizing: {},
    profile: { minLiquidity: 'LIQUID', minRR: 1.5 }
  });
  assert.ok(r.state === R.RISK.HIGH || r.state === R.RISK.VERY_HIGH, 'مخاطرة عالية — ' + r.state);
  assert.ok(r.warnings.some(w => w.k === 'atr_high'), 'تحذير التذبذب');
  assert.ok(r.warnings.some(w => w.k === 'liquidity_low'), 'تحذير السيولة');
});

test('⛔ بيانات قديمة ⇒ المخاطرة غير قابلة للتقييم', () => {
  const r = R.riskEngine({
    dq: { stale: true, sessions: 200 },
    plan: { status: R.PLAN.ZONE, rr: 2.0 },
    volat: { atrPct: 1 }, volume: { liq: R.LIQ.DEEP },
    momentum: {}, trend: {}, sizing: {}, profile: {}
  });
  assert.equal(r.state, R.RISK.NA, 'غير قابلة للتقييم');
  assert.ok(r.warnings.some(w => w.k === 'stale'), 'تحذير البيانات القديمة');
});

test('⛔ تنبيه بيانات المؤسسات موجود دايماً (وهمي غير موجود)', () => {
  const r = R.riskEngine({
    dq: { stale: false, sessions: 200 },
    plan: { status: R.PLAN.ZONE, rr: 2.0 },
    volat: { atrPct: 1 }, volume: { liq: R.LIQ.DEEP },
    momentum: {}, trend: {}, sizing: {}, profile: {}
  });
  assert.ok(r.warnings.some(w => w.k === 'institutional_na'), 'تنبيه المؤسسات موجود');
  assert.ok(!r.warnings.some(w => w.k === 'institutional_fake'), '⛔ مفيش أدلة مؤسسات مصنوعة');
});

test('⛔ مفيش أي سهم بيتقصد «آمن»', () => {
  const r = R.riskEngine({
    dq: { stale: false, sessions: 200 },
    plan: { status: R.PLAN.ZONE, rr: 3.0 },
    volat: { atrPct: 0.5 }, volume: { liq: R.LIQ.DEEP },
    momentum: {}, trend: {}, sizing: {}, profile: {}
  });
  assert.notEqual(r.state, 'SAFE', '⛔ مفيش تصنيف SAFE');
  assert.ok(r.state.indexOf('RISK') >= 0 || r.state.indexOf('RELATIVE RISK') >= 0, r.state);
});
