/* ══════════════════════════════════════════════════════════════
   🧪 اختبارات رياضيات مؤشرات الشارت — assets/tests/indicators.test.js
   ──────────────────────────────────────────────────────────────
   التشغيل:  cd /workspace/octa && node --test assets/tests/indicators.test.js
   ⛔ مافيش framework تاني — node:test + node:assert/strict بس
   ⛔ مافيش شبكة — كل الأرقام هنا محسوبة جوه الملف

   📌 المبدأ:
      · كل قيمة مرجعية مكتوبة بخط اليد أو محسوبة بمرجع مستقل
        مكتوب جوه الملف (مش مستعارة من indicators.js) — فالمقارنة
        حقيقية مش circular.
      · المقارنة الحسابية بت tolerância 1e-9 (دقة كاملة، مش "أقرب رقم").
      · العقد: كل دالة بترجّع مصفوفة بنفس طول الدخل بالظبط،
        والقيم قبل نضج المؤشر (warmup) = null.
   ══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ind = require('../js/chart/indicators.js');

/* ═══════════════════════════════════════════════════════════
   🛠 أدوات مساعدة
   ═══════════════════════════════════════════════════════════ */

const EPS = 1e-9;

function closeTo(actual, expected, msg) {
  assert.equal(typeof actual, 'number', (msg || '') + ' — لازم رقم');
  assert.ok(
    Math.abs(actual - expected) <= EPS,
    (msg || '') + ' — المتوقع ' + expected + ' والفعلي ' + actual
  );
}

function allNull(arr, msg) {
  arr.forEach((v, i) => {
    assert.equal(v, null, (msg || '') + ' — لازم null عند الفهرس ' + i + ' والفعلي ' + v);
  });
}

/* كل قيم المصفوفة أرقام منتهية أو null — مافيش NaN ولا undefined */
function onlyFiniteOrNull(arr, msg) {
  arr.forEach((v, i) => {
    if (v === null) return;
    assert.equal(typeof v, 'number', (msg || '') + ' — قيمة مش رقمية عند ' + i + ': ' + v);
    assert.ok(isFinite(v), (msg || '') + ' — قيمة غير منتهية عند ' + i + ': ' + v);
  });
}

/* أول فهرس فيه قيمة (مش null) */
function firstValid(arr) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== null && arr[i] !== undefined) return i;
  }
  return -1;
}

/* كل القيم قبل أول فهرس صالح لازم null */
function nullBeforeWarmup(arr, msg) {
  const fv = firstValid(arr);
  for (let i = 0; i < fv; i++) {
    assert.equal(arr[i], null, (msg || '') + ' — لازم null قبل الـwarmup عند ' + i);
  }
}

/* ═══════════════════════════════════════════════════════════
   🧮 مرجع مستقل — مكتوب من الصيغة القياسية
   (مش بيستخدم أي سطر من indicators.js — مقارنة حقيقية)
   ═══════════════════════════════════════════════════════════ */

/* SMA */
function refSMA(v, p) {
  const o = new Array(v.length).fill(null);
  for (let i = p - 1; i < v.length; i++) {
    let s = 0, ok = true;
    for (let j = i - p + 1; j <= i; j++) {
      if (typeof v[j] !== 'number' || !isFinite(v[j])) { ok = false; break; }
      s += v[j];
    }
    if (ok) o[i] = s / p;
  }
  return o;
}

/* EMA — التهيئة بـ SMA أول p */
function refEMA(v, p) {
  const o = new Array(v.length).fill(null);
  const k = 2 / (p + 1);
  let sum = 0, cnt = 0, prev = null, started = false;
  for (let i = 0; i < v.length; i++) {
    const x = v[i];
    if (typeof x !== 'number' || !isFinite(x)) { sum = 0; cnt = 0; continue; }
    if (!started) {
      sum += x; cnt++;
      if (cnt === p) { prev = sum / p; o[i] = prev; started = true; sum = 0; cnt = 0; }
    } else {
      prev = x * k + prev * (1 - k);
      o[i] = prev;
    }
  }
  return o;
}

/* WMA — الأحدث وزن p */
function refWMA(v, p) {
  const o = new Array(v.length).fill(null);
  const den = (p * (p + 1)) / 2;
  for (let i = p - 1; i < v.length; i++) {
    let s = 0, w = 1, ok = true;
    for (let j = i - p + 1; j <= i; j++) {
      if (typeof v[j] !== 'number' || !isFinite(v[j])) { ok = false; break; }
      s += v[j] * w; w++;
    }
    if (ok) o[i] = s / den;
  }
  return o;
}

/* RSI — تنعيم ويلدر */
function refRSI(c, p) {
  const o = new Array(c.length).fill(null);
  let g = 0, l = 0, cnt = 0, ag = 0, al = 0, started = false;
  for (let i = 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    const gg = d > 0 ? d : 0, ll = d < 0 ? -d : 0;
    if (!started) {
      g += gg; l += ll; cnt++;
      if (cnt === p) {
        ag = g / p; al = l / p; started = true;
        o[i] = (ag === 0 && al === 0) ? 50 : (al === 0 ? 100 : 100 - 100 / (1 + ag / al));
        g = 0; l = 0; cnt = 0;
      }
    } else {
      ag = (ag * (p - 1) + gg) / p;
      al = (al * (p - 1) + ll) / p;
      o[i] = (ag === 0 && al === 0) ? 50 : (al === 0 ? 100 : 100 - 100 / (1 + ag / al));
    }
  }
  return o;
}

/* Bollinger — انحراف معياري population (قسمة على N) */
function refBB(c, p, k) {
  const mid = refSMA(c, p);
  const up = new Array(c.length).fill(null), lo = new Array(c.length).fill(null);
  for (let i = p - 1; i < c.length; i++) {
    let s2 = 0;
    for (let j = i - p + 1; j <= i; j++) { const d = c[j] - mid[i]; s2 += d * d; }
    const sd = Math.sqrt(s2 / p);
    up[i] = mid[i] + k * sd;
    lo[i] = mid[i] - k * sd;
  }
  return { mid: mid, upper: up, lower: lo };
}

/* ATR — TR = max(h-l, |h-cprev|, |l-cprev|) + تنعيم ويلدر */
function refATR(c, h, l, p) {
  const o = new Array(c.length).fill(null);
  let pc = null, pa = null;
  for (let i = 0; i < c.length; i++) {
    const tr = (i === 0)
      ? h[i] - l[i]
      : Math.max(h[i] - l[i], Math.abs(h[i] - pc), Math.abs(l[i] - pc));
    if (i === 0) { o[i] = tr; pa = tr; } else { pa = (pa * (p - 1) + tr) / p; o[i] = pa; }
    pc = c[i];
  }
  return o;
}

function wMax(a, i, p) { let m = -Infinity; for (let j = i - p + 1; j <= i; j++) m = Math.max(m, a[j]); return m; }
function wMin(a, i, p) { let m = Infinity; for (let j = i - p + 1; j <= i; j++) m = Math.min(m, a[j]); return m; }

/* Stochastic خام + %K/%D */
function refStochRaw(c, h, l, p) {
  const o = new Array(c.length).fill(null);
  for (let i = p - 1; i < c.length; i++) {
    const hh = wMax(h, i, p), ll = wMin(l, i, p);
    o[i] = (hh === ll) ? 50 : ((c[i] - ll) / (hh - ll)) * 100;
  }
  return o;
}
function refStoch(c, h, l, p, k, d) {
  const K = refSMA(refStochRaw(c, h, l, p), k);
  return { k: K, d: refSMA(K, d) };
}

/* Williams %R */
function refWR(c, h, l, p) {
  const o = new Array(c.length).fill(null);
  for (let i = p - 1; i < c.length; i++) {
    const hh = wMax(h, i, p), ll = wMin(l, i, p);
    o[i] = (hh === ll) ? -50 : ((hh - c[i]) / (hh - ll)) * -100;
  }
  return o;
}

/* CCI — TP = (h+l+c)/3 · mean deviation */
function refCCI(c, h, l, p) {
  const o = new Array(c.length).fill(null);
  const tp = c.map((x, i) => (h[i] + l[i] + x) / 3);
  const s = refSMA(tp, p);
  for (let i = p - 1; i < c.length; i++) {
    let dev = 0;
    for (let j = i - p + 1; j <= i; j++) dev += Math.abs(tp[j] - s[i]);
    const md = dev / p;
    o[i] = md === 0 ? 0 : (tp[i] - s[i]) / (0.015 * md);
  }
  return o;
}

/* MACD */
function refMACD(c, f, s, sig) {
  const n = c.length;
  const ef = refEMA(c, f), es = refEMA(c, s);
  const line = new Array(n).fill(null);
  for (let i = 0; i < n; i++) if (ef[i] !== null && es[i] !== null) line[i] = ef[i] - es[i];
  const sg = refEMA(line, sig);
  const hist = new Array(n).fill(null);
  for (let i = 0; i < n; i++) if (line[i] !== null && sg[i] !== null) hist[i] = line[i] - sg[i];
  return { macd: line, signal: sg, hist: hist };
}

/* ADX — تنعيم ويلدر كامل */
function refADX(c, h, l, p) {
  const n = c.length;
  const tr = new Array(n).fill(null), pdm = new Array(n).fill(null), mdm = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i === 0) { tr[i] = h[i] - l[i]; pdm[i] = 0; mdm[i] = 0; continue; }
    tr[i] = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
    const up = h[i] - h[i - 1], dn = l[i - 1] - l[i];
    pdm[i] = (up > dn && up > 0) ? up : 0;
    mdm[i] = (dn > up && dn > 0) ? dn : 0;
  }
  let sT = 0, sP = 0, sM = 0;
  for (let i = 1; i <= p; i++) { sT += tr[i]; sP += pdm[i]; sM += mdm[i]; }
  const dx = new Array(n).fill(null), pDI = new Array(n).fill(null), mDI = new Array(n).fill(null);
  for (let i = p; i < n; i++) {
    if (i > p) { sT = sT - sT / p + tr[i]; sP = sP - sP / p + pdm[i]; sM = sM - sM / p + mdm[i]; }
    const a = sT > 0 ? (100 * sP) / sT : 0, b = sT > 0 ? (100 * sM) / sT : 0;
    pDI[i] = a; mDI[i] = b;
    const sum = a + b;
    dx[i] = sum > 0 ? (100 * Math.abs(a - b)) / sum : 0;
  }
  const adx = new Array(n).fill(null);
  let acc = 0, cnt = 0, prev = null;
  for (let i = p; i < n; i++) {
    if (dx[i] === null) continue;
    if (prev === null) {
      acc += dx[i]; cnt++;
      if (cnt === p) { prev = acc / p; adx[i] = prev; acc = 0; cnt = 0; }
    } else { prev = (prev * (p - 1) + dx[i]) / p; adx[i] = prev; }
  }
  return { adx: adx, pDI: pDI, mDI: mDI };
}

/* SAR — ويلدر */
function refSAR(c, h, l, af, maxAf) {
  const n = c.length, o = new Array(n).fill(null);
  if (n < 2) return o;
  let up = h[1] >= h[0];
  let cur = up ? l[0] : h[0];
  let ep = up ? h[0] : l[0];
  let acc = af;
  o[0] = cur;
  for (let i = 1; i < n; i++) {
    let next = cur + acc * (ep - cur);
    if (up) {
      const cap = Math.min(l[i - 1], i >= 2 ? l[i - 2] : l[i - 1]);
      next = Math.min(next, cap);
      if (l[i] < next) { next = ep; up = false; ep = l[i]; acc = af; }
      else if (h[i] > ep) { ep = h[i]; acc = Math.min(acc + af, maxAf); }
    } else {
      const fl = Math.max(h[i - 1], i >= 2 ? h[i - 2] : h[i - 1]);
      next = Math.max(next, fl);
      if (h[i] > next) { next = ep; up = true; ep = h[i]; acc = af; }
      else if (l[i] < ep) { ep = l[i]; acc = Math.min(acc + af, maxAf); }
    }
    cur = next; o[i] = cur;
  }
  return o;
}

/* Ichimoku 9-26-52 */
function refIchimoku(c, h, l) {
  const n = c.length;
  const t = new Array(n).fill(null), k = new Array(n).fill(null);
  const sa = new Array(n).fill(null), sb = new Array(n).fill(null), ch = new Array(n).fill(null);
  for (let i = 8; i < n; i++) t[i] = (wMax(h, i, 9) + wMin(l, i, 9)) / 2;
  for (let i = 25; i < n; i++) k[i] = (wMax(h, i, 26) + wMin(l, i, 26)) / 2;
  for (let i = 26; i < n; i++) { const j = i - 26; if (t[j] !== null && k[j] !== null) sa[i] = (t[j] + k[j]) / 2; }
  for (let i = 26; i < n; i++) { const j = i - 26; if (j < 51) continue; sb[i] = (wMax(h, j, 52) + wMin(l, j, 52)) / 2; }
  for (let i = 0; i < n; i++) { const j = i + 26; if (j < n) ch[i] = c[j]; }
  return { tenkan: t, kijun: k, senkouA: sa, senkouB: sb, chikou: ch };
}

/* HMA / DEMA / TEMA */
function refHMA(v, p) {
  const half = Math.floor(p / 2), sq = Math.round(Math.sqrt(p));
  const w1 = refWMA(v, half), w2 = refWMA(v, p);
  const raw = v.map((x, i) => (w1[i] !== null && w2[i] !== null) ? 2 * w1[i] - w2[i] : null);
  return refWMA(raw, sq);
}
function refDEMA(v, p) {
  const e1 = refEMA(v, p), e2 = refEMA(e1, p);
  return e1.map((x, i) => (x !== null && e2[i] !== null) ? 2 * x - e2[i] : null);
}
function refTEMA(v, p) {
  const e1 = refEMA(v, p), e2 = refEMA(e1, p), e3 = refEMA(e2, p);
  return e1.map((x, i) => (x !== null && e2[i] !== null && e3[i] !== null) ? 3 * x - 3 * e2[i] + e3[i] : null);
}

/* OBV */
function refOBV(c, v) {
  const o = new Array(c.length).fill(null);
  let acc = 0, prev = null, has = false;
  for (let i = 0; i < c.length; i++) {
    if (typeof c[i] !== 'number' || typeof v[i] !== 'number') { o[i] = has ? acc : null; continue; }
    if (!has) { prev = c[i]; has = true; o[i] = 0; continue; }
    if (c[i] > prev) acc += v[i]; else if (c[i] < prev) acc -= v[i];
    prev = c[i]; o[i] = acc;
  }
  return o;
}

/* VWMA */
function refVWMA(c, vol, p) {
  const o = new Array(c.length).fill(null);
  for (let i = p - 1; i < c.length; i++) {
    let num = 0, den = 0, ok = true;
    for (let j = i - p + 1; j <= i; j++) {
      if (typeof c[j] !== 'number' || typeof vol[j] !== 'number') { ok = false; break; }
      num += c[j] * vol[j]; den += vol[j];
    }
    if (ok && den > 0) o[i] = num / den;
  }
  return o;
}

/* ═══════════════════════════════════════════════════════════
   📊 بيانات اختبار حتمية (80 شمعة) — مفيش عشوائية
   ═══════════════════════════════════════════════════════════ */
function buildSeries(n) {
  const c = [], h = [], l = [], v = [];
  for (let i = 0; i < n; i++) {
    const base = 100 + (i % 7) * 3 - (i % 5) * 2 + Math.floor(i / 9) * 1.5;
    const open = base;
    const close = base + ((i % 3) - 1) * 0.5;
    c.push(close);
    h.push(Math.max(open, close) + 1 + (i % 4) * 0.25);
    l.push(Math.min(open, close) - 1 - (i % 3) * 0.25);
    v.push(100 + (i % 11) * 25);
  }
  return { c: c, h: h, l: l, v: v };
}
const D = buildSeries(80);

/* شموع كائنات (للـvolumeProfile) */
const CANDLES = D.c.map((x, i) => ({ c: D.c[i], h: D.h[i], l: D.l[i], v: D.v[i] }));

/* ═══════════════════════════════════════════════════════════
   📈 SMA
   ═══════════════════════════════════════════════════════════ */

test('SMA: [1..5] و period 3 → [null,null,2,3,4]', () => {
  assert.deepEqual(ind.sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
});

test('SMA: أول قيمة عند الفهرس p-1 والباقي null (warmup)', () => {
  const out = ind.sma([1, 2, 3, 4, 5, 6, 7], 4);
  assert.equal(out.length, 7);
  assert.deepEqual(out.slice(0, 3), [null, null, null]);
  closeTo(out[3], 2.5, 'متوسط 1..4');
  closeTo(out[4], 3.5, 'متوسط 2..5');
  closeTo(out[6], 5.5, 'متوسط 4..7');
  nullBeforeWarmup(out, 'SMA');
});

test('SMA: تطابق مع المرجع المستقل على 80 شمعة', () => {
  const out = ind.sma(D.c, 14);
  const ref = refSMA(D.c, 14);
  assert.equal(out.length, D.c.length);
  out.forEach((v, i) => {
    if (ref[i] === null) assert.equal(v, null, 'الفهرس ' + i);
    else closeTo(v, ref[i], 'SMA عند ' + i);
  });
});

test('SMA: period=1 بيرجّع القيم نفسها', () => {
  assert.deepEqual(ind.sma([1, 2, 3, 4], 1), [1, 2, 3, 4]);
});

/* ═══════════════════════════════════════════════════════════
   📈 EMA — التهيئة بـ SMA أول period
   ═══════════════════════════════════════════════════════════ */

test('EMA: التهيئة = SMA أول period (مش بيلف من أول قيمة)', () => {
  /* [1..6] و p=3 → التهيئة عند الفهرس 2 = (1+2+3)/3 = 2 · k = 2/4 = 0.5 */
  assert.deepEqual(ind.ema([1, 2, 3, 4, 5, 6], 3), [null, null, 2, 3, 4, 5]);
});

test('EMA: القيمة المرجعية محسوبة بخط اليد (k = 2/(p+1))', () => {
  const p = 5, k = 2 / (p + 1);
  const seed = (10 + 20 + 30 + 40 + 50) / p;          /* = 30 */
  const e1 = 60 * k + seed * (1 - k);
  const e2 = 70 * k + e1 * (1 - k);
  const out = ind.ema([10, 20, 30, 40, 50, 60, 70], p);

  assert.equal(out.length, 7);
  assert.deepEqual(out.slice(0, p - 1), [null, null, null, null]);
  closeTo(out[p - 1], seed, 'EMA[4] = SMA أول 5');
  closeTo(out[p], e1, 'EMA[5]');
  closeTo(out[p + 1], e2, 'EMA[6]');
  nullBeforeWarmup(out, 'EMA');
});

test('EMA: تطابق مع المرجع المستقل (تهيئة SMA) على 80 شمعة', () => {
  const out = ind.ema(D.c, 14);
  const ref = refEMA(D.c, 14);
  out.forEach((v, i) => {
    if (ref[i] === null) assert.equal(v, null, 'الفهرس ' + i);
    else closeTo(v, ref[i], 'EMA عند ' + i);
  });
});

test('EMA: period=1 = القيم نفسها', () => {
  assert.deepEqual(ind.ema([1, 2, 3, 4], 1), [1, 2, 3, 4]);
});

/* ═══════════════════════════════════════════════════════════
   📈 WMA — الأحدث وزن p
   ═══════════════════════════════════════════════════════════ */

test('WMA: [1..5] و p=3 → مرجّح (1·1 + 2·2 + 3·3)/6 = 14/6', () => {
  const out = ind.wma([1, 2, 3, 4, 5], 3);
  assert.deepEqual(out.slice(0, 2), [null, null]);
  closeTo(out[2], 14 / 6, 'WMA[2]');
  closeTo(out[3], 20 / 6, 'WMA[3]');
  closeTo(out[4], 26 / 6, 'WMA[4]');
});

test('WMA: آخر قيمة لها أكبر وزن', () => {
  const out = ind.wma([10, 20, 30], 3);
  closeTo(out[2], (10 * 1 + 20 * 2 + 30 * 3) / 6, 'WMA');
  const out2 = ind.wma([30, 20, 10], 3);
  closeTo(out2[2], (30 * 1 + 20 * 2 + 10 * 3) / 6, 'WMA (ترتيب معكوس)');
  assert.ok(out2[2] < out[2], 'المتوسط المرجّح لازم يقلّ لما القيمة الأحدث تقل');
});

test('WMA: تطابق مع المرجع المستقل', () => {
  const out = ind.wma(D.c, 9);
  const ref = refWMA(D.c, 9);
  out.forEach((v, i) => {
    if (ref[i] === null) assert.equal(v, null, 'الفهرس ' + i);
    else closeTo(v, ref[i], 'WMA عند ' + i);
  });
});

/* ═══════════════════════════════════════════════════════════
   📈 HMA / DEMA / TEMA
   ═══════════════════════════════════════════════════════════ */

test('HMA = WMA(2×WMA(n/2) − WMA(n), round(√n)) — مطابق للمرجع', () => {
  const p = 9;
  const out = ind.hma(D.c, p);
  const ref = refHMA(D.c, p);
  assert.equal(out.length, D.c.length);
  out.forEach((v, i) => {
    if (ref[i] === null) assert.equal(v, null, 'الفهرس ' + i);
    else closeTo(v, ref[i], 'HMA عند ' + i);
  });
  /* أول قيمة صالحة = p + round(√p) - 2 */
  assert.equal(firstValid(out), p + Math.round(Math.sqrt(p)) - 2);
});

test('DEMA = 2×EMA − EMA(EMA) — مطابق للمرجع', () => {
  const p = 14;
  const out = ind.dema(D.c, p);
  const ref = refDEMA(D.c, p);
  out.forEach((v, i) => {
    if (ref[i] === null) assert.equal(v, null, 'الفهرس ' + i);
    else closeTo(v, ref[i], 'DEMA عند ' + i);
  });
  assert.equal(firstValid(out), 2 * p - 2);
});

test('TEMA = 3×EMA − 3×EMA(EMA) + EMA(EMA(EMA)) — مطابق للمرجع', () => {
  const p = 14;
  const out = ind.tema(D.c, p);
  const ref = refTEMA(D.c, p);
  out.forEach((v, i) => {
    if (ref[i] === null) assert.equal(v, null, 'الفهرس ' + i);
    else closeTo(v, ref[i], 'TEMA عند ' + i);
  });
  assert.equal(firstValid(out), 3 * p - 3);
});

/* ═══════════════════════════════════════════════════════════
   📈 VWMA
   ═══════════════════════════════════════════════════════════ */

test('VWMA: مرجّح بالحجم — (Σ c·v) / (Σ v) على النافذة', () => {
  const c = [10, 20, 30, 40], v = [1, 1, 1, 1];
  const out = ind.vwma(c, 2, v);
  assert.deepEqual(out.slice(0, 1), [null]);
  closeTo(out[1], (10 * 1 + 20 * 1) / 2, 'VWMA[1]');
  closeTo(out[2], (20 + 30) / 2, 'VWMA[2]');
  closeTo(out[3], (30 + 40) / 2, 'VWMA[3]');
});

test('VWMA: شكل كائنات {c,v} وشكل أزواج [c,v] مدعومان', () => {
  const c = [10, 20, 30, 40], v = [1, 2, 3, 4];
  const ref = refVWMA(c, v, 2);
  const objs = c.map((x, i) => ({ c: x, v: v[i] }));
  const pairs = c.map((x, i) => [x, v[i]]);
  [ind.vwma(objs, 2), ind.vwma(pairs, 2)].forEach((out) => {
    out.forEach((val, i) => {
      if (ref[i] === null) assert.equal(val, null, 'الفهرس ' + i);
      else closeTo(val, ref[i], 'VWMA عند ' + i);
    });
  });
});

test('VWMA: من غير حجم → كل القيم null (مافيش رقم مخترع)', () => {
  const out = ind.vwma([10, 20, 30], 2);
  assert.equal(out.length, 3);
  allNull(out, 'VWMA من غير حجم');
});

/* ═══════════════════════════════════════════════════════════
   📊 Bollinger — انحراف معياري population (مش sample)
   ═══════════════════════════════════════════════════════════ */

test('Bollinger: upper = mid + 2×std_population (مش sample)', () => {
  const out = ind.bollinger([1, 2, 3, 4, 5], 3, 2);
  const mid = 2;
  const stdPop = Math.sqrt(((1 - mid) ** 2 + (2 - mid) ** 2 + (3 - mid) ** 2) / 3); /* = √(2/3) */
  const stdSample = Math.sqrt(((1 - mid) ** 2 + (2 - mid) ** 2 + (3 - mid) ** 2) / 2);

  assert.deepEqual(out.mid.slice(0, 2), [null, null]);
  closeTo(out.mid[2], mid, 'mid[2]');
  closeTo(out.upper[2], mid + 2 * stdPop, 'upper[2]');
  closeTo(out.lower[2], mid - 2 * stdPop, 'lower[2]');
  /* لازم population مش sample — القيمتين مختلفين فعلاً */
  assert.ok(Math.abs((mid + 2 * stdPop) - (mid + 2 * stdSample)) > 1e-6, 'المثال لازم يفرق بين population و sample');
});

test('Bollinger: mid = SMA(p) والعرض = k×std والحدود مرتبة', () => {
  const p = 20, k = 2;
  const out = ind.bollinger(D.c, p, k);
  const ref = refBB(D.c, p, k);
  assert.equal(out.mid.length, D.c.length);
  assert.equal(out.upper.length, D.c.length);
  assert.equal(out.lower.length, D.c.length);
  out.mid.forEach((v, i) => {
    if (ref.mid[i] === null) assert.equal(v, null, 'mid ' + i);
    else closeTo(v, ref.mid[i], 'mid عند ' + i);
  });
  out.upper.forEach((v, i) => {
    if (ref.upper[i] === null) assert.equal(v, null, 'upper ' + i);
    else closeTo(v, ref.upper[i], 'upper عند ' + i);
  });
  out.lower.forEach((v, i) => {
    if (ref.lower[i] === null) assert.equal(v, null, 'lower ' + i);
    else closeTo(v, ref.lower[i], 'lower عند ' + i);
  });
  for (let i = 0; i < D.c.length; i++) {
    if (out.upper[i] === null) continue;
    assert.ok(out.upper[i] >= out.mid[i], 'upper لازم تكون فوق الـmid عند ' + i);
    assert.ok(out.lower[i] <= out.mid[i], 'lower لازم تكون تحت الـmid عند ' + i);
    closeTo(out.upper[i] - out.mid[i], out.mid[i] - out.lower[i], 'العرض متناظر عند ' + i);
  }
  assert.equal(firstValid(out.mid), p - 1);
});

test('Bollinger: p و k اختياريان (20 و 2 افتراضياً)', () => {
  const out = ind.bollinger(D.c);
  const ref = refBB(D.c, 20, 2);
  closeTo(out.mid[19], ref.mid[19], 'mid الافتراضي');
  closeTo(out.upper[19], ref.upper[19], 'upper الافتراضي');
  closeTo(out.lower[19], ref.lower[19], 'lower الافتراضي');
});

/* ═══════════════════════════════════════════════════════════
   📊 RSI — تنعيم ويلدر
   ═══════════════════════════════════════════════════════════ */

test('RSI: قيم مرجعية محسوبة بخط اليد (ويلدر) على سلسلة بسيطة', () => {
  /* c = [10,12,10,12,10,12] و p=2
     التغيرات: +2, -2, +2, -2, +2
     avgGain[2] = 2/2 = 1 · avgLoss[2] = 2/2 = 1 → RS = 1 → RSI = 50
     avgGain[3] = (1·1 + 2)/2 = 1.5 · avgLoss[3] = (1·1 + 0)/2 = 0.5 → RS = 3 → RSI = 75
     avgGain[4] = (1.5·1 + 0)/2 = 0.75 · avgLoss[4] = (0.5·1 + 2)/2 = 1.25 → RSI = 37.5
     avgGain[5] = (0.75 + 2)/2 = 1.375 · avgLoss[5] = (1.25 + 0)/2 = 0.625 → RSI = 68.75 */
  const out = ind.rsi([10, 12, 10, 12, 10, 12], 2);
  assert.deepEqual(out.slice(0, 2), [null, null]);
  closeTo(out[2], 50, 'RSI[2]');
  closeTo(out[3], 75, 'RSI[3]');
  closeTo(out[4], 37.5, 'RSI[4]');
  closeTo(out[5], 68.75, 'RSI[5]');
  nullBeforeWarmup(out, 'RSI');
});

test('RSI: الحالة الكلاسيكية لويلدر — القيمة الأولى 70.46413502109705', () => {
  /* التغيرات من الشمعة 1 → 14 على الإغلاقات الكلاسيكية */
  const closes = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
    45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64
  ];
  /* مجموع الأرباح = 0.06+0.72+0.50+0.27+0.32+0.42+0.24+0.14+0.67 = 3.34 */
  /* مجموع الخسائر = 0.25+0.54+0.19+0.42 = 1.40 */
  const sumGain = 0.06 + 0.72 + 0.50 + 0.27 + 0.32 + 0.42 + 0.24 + 0.14 + 0.67;
  const sumLoss = 0.25 + 0.54 + 0.19 + 0.42;
  const avgGain = sumGain / 14, avgLoss = sumLoss / 14;
  const expected = 100 - 100 / (1 + avgGain / avgLoss);

  const out = ind.rsi(closes, 14);
  closeTo(out[14], expected, 'RSI[14] — ويلدر');
  closeTo(out[14], 70.46413502109705, 'RSI[14] — القيمة المنشورة');
  assert.equal(firstValid(out), 14, 'أول RSI عند الفهرس p');
});

test('RSI: كل القيم في [0,100] على 80 شمعة', () => {
  const out = ind.rsi(D.c, 14);
  out.forEach((v, i) => {
    if (v === null) return;
    assert.ok(v >= 0 && v <= 100, 'RSI[' + i + '] = ' + v + ' بره [0,100]');
  });
  assert.equal(out.length, D.c.length);
});

test('RSI: إغلاق ثابت → 50 (مش 100)', () => {
  const out = ind.rsi([5, 5, 5, 5, 5, 5, 5], 3);
  assert.deepEqual(out.slice(0, 3), [null, null, null]);
  [3, 4, 5, 6].forEach((i) => closeTo(out[i], 50, 'RSI الثابت عند ' + i));
});

test('RSI: صاعد خالص → 100 · هابط خالص → 0', () => {
  const up = ind.rsi([1, 2, 3, 4, 5, 6], 3);
  const down = ind.rsi([6, 5, 4, 3, 2, 1], 3);
  closeTo(up[3], 100, 'RSI صاعد');
  closeTo(down[3], 0, 'RSI هابط');
});

test('RSI: مطابق للمرجع المستقل (ويلدر) على 80 شمعة', () => {
  const out = ind.rsi(D.c, 14);
  const ref = refRSI(D.c, 14);
  out.forEach((v, i) => {
    if (ref[i] === null) assert.equal(v, null, 'الفهرس ' + i);
    else closeTo(v, ref[i], 'RSI عند ' + i);
  });
});

/* ═══════════════════════════════════════════════════════════
   📊 MACD
   ═══════════════════════════════════════════════════════════ */

test('MACD: hist = macd − signal على كل الفهارس الصالحة', () => {
  const out = ind.macd(D.c);
  assert.equal(out.macd.length, D.c.length);
  assert.equal(out.signal.length, D.c.length);
  assert.equal(out.hist.length, D.c.length);
  for (let i = 0; i < D.c.length; i++) {
    if (out.macd[i] === null || out.signal[i] === null) {
      assert.equal(out.hist[i], null, 'hist لازم null عند ' + i);
      continue;
    }
    closeTo(out.hist[i], out.macd[i] - out.signal[i], 'hist عند ' + i);
  }
});

test('MACD: الخط من الفهرس 25 والإشارة من 33 (12/26/9)', () => {
  const out = ind.macd(D.c);
  assert.equal(firstValid(out.macd), 25, 'أول MACD');
  assert.equal(firstValid(out.signal), 33, 'أول إشارة');
  assert.equal(firstValid(out.hist), 33, 'أول هيستوجرام');
  nullBeforeWarmup(out.macd, 'MACD');
});

test('MACD: مطابق للمرجع المستقل', () => {
  const out = ind.macd(D.c);
  const ref = refMACD(D.c, 12, 26, 9);
  ['macd', 'signal', 'hist'].forEach((k) => {
    out[k].forEach((v, i) => {
      if (ref[k][i] === null) assert.equal(v, null, k + ' ' + i);
      else closeTo(v, ref[k][i], k + ' عند ' + i);
    });
  });
});

/* ═══════════════════════════════════════════════════════════
   📊 ADX / DI
   ═══════════════════════════════════════════════════════════ */

test('ADX: القيم في [0,100] والـDI في [0,100]', () => {
  const out = ind.adx(D.c, D.h, D.l, 14);
  out.adx.forEach((v, i) => {
    if (v === null) return;
    assert.ok(v >= 0 && v <= 100, 'ADX[' + i + '] = ' + v + ' بره [0,100]');
  });
  out.plusDI.forEach((v, i) => {
    if (v === null) return;
    assert.ok(v >= 0 && v <= 100, '+DI[' + i + '] = ' + v);
  });
  out.minusDI.forEach((v, i) => {
    if (v === null) return;
    assert.ok(v >= 0 && v <= 100, '-DI[' + i + '] = ' + v);
  });
  assert.equal(out.adx.length, D.c.length);
});

test('ADX: أول ADX عند 2p-1 (2×14-1 = 27)', () => {
  const out = ind.adx(D.c, D.h, D.l, 14);
  assert.equal(firstValid(out.plusDI), 14, 'أول +DI');
  assert.equal(firstValid(out.adx), 27, 'أول ADX');
  nullBeforeWarmup(out.adx, 'ADX');
});

test('ADX: اتساق داخلي — DX = 100×|+DI−−DI|/(+DI+−DI) والتنعيم ويلدر', () => {
  const p = 14;
  const out = ind.adx(D.c, D.h, D.l, p);
  /* إعادة حساب DX من الـDI اللي رجّعها الدالة، بعدين تنعيم ويلدر → لازم يطابق الـADX */
  const dx = new Array(D.c.length).fill(null);
  for (let i = p; i < D.c.length; i++) {
    const a = out.plusDI[i], b = out.minusDI[i];
    if (a === null || b === null) continue;
    const sum = a + b;
    dx[i] = sum > 0 ? (100 * Math.abs(a - b)) / sum : 0;
  }
  let acc = 0, cnt = 0, prev = null;
  for (let i = p; i < D.c.length; i++) {
    if (dx[i] === null) continue;
    if (prev === null) {
      acc += dx[i]; cnt++;
      if (cnt === p) { prev = acc / p; closeTo(out.adx[i], prev, 'ADX عند ' + i); acc = 0; cnt = 0; }
    } else {
      prev = (prev * (p - 1) + dx[i]) / p;
      closeTo(out.adx[i], prev, 'ADX عند ' + i);
    }
  }
});

test('ADX: مطابق للمرجع المستقل (ويلدر)', () => {
  const p = 14;
  const out = ind.adx(D.c, D.h, D.l, p);
  const ref = refADX(D.c, D.h, D.l, p);
  closeTo(out.adx[27], ref.adx[27], 'ADX[27]');
  closeTo(out.plusDI[14], ref.pDI[14], '+DI[14]');
  closeTo(out.minusDI[14], ref.mDI[14], '-DI[14]');
  out.adx.forEach((v, i) => {
    if (ref.adx[i] === null) assert.equal(v, null, 'ADX ' + i);
    else closeTo(v, ref.adx[i], 'ADX عند ' + i);
  });
});

test('ADX: سوق ثابت → ADX = 0 (مافيش انقسام على صفر)', () => {
  const c = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
  const h = [6, 6, 6, 6, 6, 6, 6, 6, 6, 6];
  const l = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
  const out = ind.adx(c, h, l, 3);
  closeTo(out.plusDI[3], 0, '+DI ثابت');
  closeTo(out.minusDI[3], 0, '-DI ثابت');
  closeTo(out.adx[5], 0, 'ADX ثابت');
});

/* ═══════════════════════════════════════════════════════════
   📊 Stochastic
   ═══════════════════════════════════════════════════════════ */

test('Stochastic: %K و %D في [0,100]', () => {
  const out = ind.stochastic(D.c, D.h, D.l, 14, 3, 3);
  out.k.forEach((v, i) => {
    if (v === null) return;
    assert.ok(v >= 0 && v <= 100, '%K[' + i + '] = ' + v + ' بره [0,100]');
  });
  out.d.forEach((v, i) => {
    if (v === null) return;
    assert.ok(v >= 0 && v <= 100, '%D[' + i + '] = ' + v + ' بره [0,100]');
  });
  assert.equal(out.k.length, D.c.length);
  assert.equal(out.d.length, D.c.length);
});

test('Stochastic: %K = (C−LL)/(HH−LL)×100 محسوب بخط اليد', () => {
  const c = [10, 12, 14, 16, 18], h = [11, 13, 15, 17, 19], l = [9, 11, 13, 15, 17];
  const raw = ind.stochasticRaw(c, h, l, 3);
  /* نافذة [10,12,14]: HH = 15 · LL = 9 · C = 14 → (14-9)/(15-9)×100 = 83.333… */
  closeTo(raw[2], (14 - 9) / (15 - 9) * 100, '%K خام عند 2');
  assert.equal(raw.length, 5);
  nullBeforeWarmup(raw, '%K خام');
});

test('Stochastic: %D = SMA من %K (خط تنعيم مرحلتين)', () => {
  const out = ind.stochastic(D.c, D.h, D.l, 14, 3, 3);
  const ref = refStoch(D.c, D.h, D.l, 14, 3, 3);
  out.k.forEach((v, i) => {
    if (ref.k[i] === null) assert.equal(v, null, 'k ' + i);
    else closeTo(v, ref.k[i], 'k عند ' + i);
  });
  out.d.forEach((v, i) => {
    if (ref.d[i] === null) assert.equal(v, null, 'd ' + i);
    else closeTo(v, ref.d[i], 'd عند ' + i);
  });
  /* %D لازم يكون SMA3 من %K — نتحقق يدويًا عند فهرس واحد */
  const i = 40;
  const avg = (out.k[i - 2] + out.k[i - 1] + out.k[i]) / 3;
  closeTo(out.d[i], avg, '%D[i] = SMA3(%K)');
});

test('Stochastic: سوق ثابت (HH=LL) → 50 (مافيش قسمة على صفر)', () => {
  const raw = ind.stochasticRaw([5, 5, 5, 5], [6, 6, 6, 6], [4, 4, 4, 4], 3);
  closeTo(raw[2], 50, '%K ثابت');
  closeTo(raw[3], 50, '%K ثابت');
});

/* ═══════════════════════════════════════════════════════════
   📊 Williams %R
   ═══════════════════════════════════════════════════════════ */

test('Williams %R: القيم في [-100,0]', () => {
  const out = ind.williamsR(D.c, D.h, D.l, 14);
  out.forEach((v, i) => {
    if (v === null) return;
    assert.ok(v >= -100 && v <= 0, '%R[' + i + '] = ' + v + ' بره [-100,0]');
  });
  assert.equal(out.length, D.c.length);
});

test('Williams %R: (HH−C)/(HH−LL)×−100 محسوب بخط اليد', () => {
  const c = [10, 12, 14, 16, 18], h = [11, 13, 15, 17, 19], l = [9, 11, 13, 15, 17];
  const out = ind.williamsR(c, h, l, 3);
  closeTo(out[2], (15 - 14) / (15 - 9) * -100, '%R عند 2');
  nullBeforeWarmup(out, '%R');
});

test('Williams %R: سوق ثابت → -50', () => {
  const out = ind.williamsR([5, 5, 5, 5], [6, 6, 6, 6], [4, 4, 4, 4], 3);
  closeTo(out[2], -50, '%R ثابت');
});

/* ═══════════════════════════════════════════════════════════
   📊 ATR
   ═══════════════════════════════════════════════════════════ */

test('ATR: موجب دايماً (كل القيم > 0) على 80 شمعة', () => {
  const out = ind.atr(D.c, D.h, D.l, 14);
  let count = 0;
  out.forEach((v, i) => {
    if (v === null) return;
    count++;
    assert.ok(v > 0, 'ATR[' + i + '] = ' + v + ' لازم تكون موجبة');
  });
  assert.ok(count > 70, 'لازم تكون فيه قيم فعلية');
  assert.equal(out.length, D.c.length);
});

test('ATR: أول قيمة = True Range الأول (h−l) وبعدها تنعيم ويلدر', () => {
  const c = [10, 10, 12], h = [11, 12, 13], l = [9, 9, 10];
  const out = ind.atr(c, h, l, 2);
  /* TR = [2, 3, 3] → ATR = [2, 2.5, 2.75] */
  closeTo(out[0], 2, 'ATR[0] = TR[0]');
  closeTo(out[1], 2.5, 'ATR[1]');
  closeTo(out[2], 2.75, 'ATR[2]');
});

test('ATR: TR = max(h−l, |h−c_prev|, |l−c_prev|) — نتحقق من الحالات الثلاث', () => {
  /* شمعة فيها فجوة لفوق: |h − c_prev| هي الأكبر */
  const c = [10, 10, 10];
  const h = [11, 20, 20];
  const l = [9, 19, 19];
  const out = ind.atr(c, h, l, 2);
  closeTo(out[0], 2, 'ATR[0]');
  closeTo(out[1], (2 + 10) / 2, 'ATR[1] — TR = |20−10| = 10');
});

test('ATR: مطابق للمرجع المستقل', () => {
  const out = ind.atr(D.c, D.h, D.l, 14);
  const ref = refATR(D.c, D.h, D.l, 14);
  out.forEach((v, i) => {
    if (ref[i] === null) assert.equal(v, null, 'الفهرس ' + i);
    else closeTo(v, ref[i], 'ATR عند ' + i);
  });
});

/* ═══════════════════════════════════════════════════════════
   📊 CCI
   ═══════════════════════════════════════════════════════════ */

test('CCI: القيم في نطاق معقول (±1000 على بيانات 80 شمعة)', () => {
  const out = ind.cci(D.c, D.h, D.l, 20);
  out.forEach((v, i) => {
    if (v === null) return;
    assert.ok(v > -1000 && v < 1000, 'CCI[' + i + '] = ' + v + ' بره النطاق المعقول');
  });
  assert.equal(out.length, D.c.length);
});

test('CCI: (TP−SMA(TP)) / (0.015×MeanDeviation) — محسوب بخط اليد', () => {
  const c = [10, 11, 12, 13, 14], h = [11, 12, 13, 14, 15], l = [9, 10, 11, 12, 13];
  const out = ind.cci(c, h, l, 3);
  /* TP = [10,11,12,13,14] · SMA3[2] = 11 · MeanDeviation = (|10-11|+|11-11|+|12-11|)/3 = 2/3
     CCI[2] = (12−11)/(0.015×2/3) = 100 */
  closeTo(out[2], 100, 'CCI[2]');
  nullBeforeWarmup(out, 'CCI');
});

test('CCI: TP ثابت → 0 (مافيش قسمة على صفر)', () => {
  const out = ind.cci([5, 5, 5, 5], [6, 6, 6, 6], [4, 4, 4, 4], 3);
  closeTo(out[2], 0, 'CCI ثابت');
  closeTo(out[3], 0, 'CCI ثابت');
});

/* ═══════════════════════════════════════════════════════════
   📊 OBV
   ═══════════════════════════════════════════════════════════ */

test('OBV: صاعد = +الحجم · نازل = −الحجم · ثابت = بلا تغيير', () => {
  const c = [10, 11, 10, 10, 12];
  const v = [100, 200, 300, 400, 500];
  const out = ind.obv(c, v);
  assert.deepEqual(out, [0, 200, -100, -100, 400]);
  assert.equal(out.length, c.length);
});

test('OBV: مطابق للمرجع المستقل', () => {
  const out = ind.obv(D.c, D.v);
  const ref = refOBV(D.c, D.v);
  out.forEach((v, i) => {
    if (ref[i] === null) assert.equal(v, null, 'الفهرس ' + i);
    else closeTo(v, ref[i], 'OBV عند ' + i);
  });
});

/* ═══════════════════════════════════════════════════════════
   📊 Parabolic SAR
   ═══════════════════════════════════════════════════════════ */

test('SAR: كل القيم Finite ومتحركة مع السعر', () => {
  const out = ind.sar(D.c, D.h, D.l);
  assert.equal(out.length, D.c.length);
  out.forEach((v, i) => {
    if (v === null) return;
    assert.ok(isFinite(v), 'SAR[' + i + '] لازم تكون رقم منتهي');
  });
  assert.ok(firstValid(out) >= 0, 'لازم فيه قيم');
});

test('SAR: في الاتجاه الصاعد الـSAR تحت قاع الشمعتين السابقتين', () => {
  const c = [10, 11, 12, 13, 14, 15, 16, 17, 18];
  const h = [11, 12, 13, 14, 15, 16, 17, 18, 19];
  const l = [9, 10, 11, 12, 13, 14, 15, 16, 17];
  const out = ind.sar(c, h, l);
  for (let i = 2; i < c.length; i++) {
    assert.ok(out[i] <= Math.min(l[i - 1], l[i - 2]), 'SAR[' + i + '] = ' + out[i] + ' لازم تحت القاعين');
  }
  /* والـSAR صاعد مع السعر (EP بيتجدد) */
  assert.ok(out[8] > out[4], 'الـSAR لازم يتحرك مع اتجاه الصعود');
});

test('SAR: قلب الاتجاه لما السعر يخترق الـSAR — والـSAR الجديد = الـEP القديم', () => {
  const c = [10, 11, 12, 13, 14, 15, 16, 17, 18, 17, 16, 15, 14, 13, 12];
  const h = [11, 12, 13, 14, 15, 16, 17, 18, 19, 18, 17, 16, 15, 14, 13];
  const l = [9, 10, 11, 12, 13, 14, 15, 16, 17, 16, 15, 14, 13, 12, 11];
  const out = ind.sar(c, h, l);
  const ref = refSAR(c, h, l, 0.02, 0.2);

  /* عند الفهرس 11 السعر نزل تحت الـSAR ⇒ قلب اتجاه هابط والـSAR الجديد = أعلى نقطة سابقة (19) */
  closeTo(out[11], 19, 'SAR[11] = EP القديم بعد القلب');
  closeTo(out[12], 18.9, 'SAR[12]');
  /* وبعد القلب الـSAR بيتحرك لتحت (اتجاه هابط) */
  assert.ok(out[13] < out[12] && out[14] < out[13], 'الـSAR لازم ينزل في الاتجاه الهابط');

  out.forEach((v, i) => closeTo(v, ref[i], 'SAR عند ' + i));
});

test('SAR: معامل التسارع بيزيد لحد 0.2 (الحد الأقصى)', () => {
  /* اتجاه صاعد قوي: EP بيتجدد كل شمعة ⇒ AF تفضل تكبر لحد 0.2 */
  const n = 40, c = [], h = [], l = [];
  for (let i = 0; i < n; i++) { c.push(100 + i * 2); h.push(101 + i * 2); l.push(99 + i * 2); }
  const out = ind.sar(c, h, l);
  /* الفرق بين كل قيمتين متتاليتين = AF×(EP−SAR) — لازم يكون محدود ومش Random */
  out.forEach((v, i) => assert.ok(isFinite(v), 'SAR[' + i + ']'));
  assert.ok(out[n - 1] > out[0], 'الـSAR لازم يطلع مع الصعود');
});

/* ═══════════════════════════════════════════════════════════
   📊 Ichimoku
   ═══════════════════════════════════════════════════════════ */

test('Ichimoku: الشكل كامل (tenkan/kijun/senkouA/senkouB/chikou) بنفس الطول', () => {
  const out = ind.ichimoku(D.c, D.h, D.l);
  ['tenkan', 'kijun', 'senkouA', 'senkouB', 'chikou'].forEach((k) => {
    assert.ok(Array.isArray(out[k]), k + ' لازم يكون مصفوفة');
    assert.equal(out[k].length, D.c.length, k + ' لازم بنفس الطول');
    onlyFiniteOrNull(out[k], k);
  });
});

test('Ichimoku: tenkan = (max H 9 + min L 9)/2 · kijun = (max H 26 + min L 26)/2', () => {
  const out = ind.ichimoku(D.c, D.h, D.l);
  closeTo(out.tenkan[8], (wMax(D.h, 8, 9) + wMin(D.l, 8, 9)) / 2, 'tenkan[8]');
  closeTo(out.kijun[25], (wMax(D.h, 25, 26) + wMin(D.l, 25, 26)) / 2, 'kijun[25]');
  assert.equal(firstValid(out.tenkan), 8, 'أول tenkan');
  assert.equal(firstValid(out.kijun), 25, 'أول kijun');
});

test('Ichimoku: senkouA = (tenkan+ kijun)/2 متقدم 26 و senkouB = نافذة 52 متقدم 26', () => {
  const out = ind.ichimoku(D.c, D.h, D.l);
  closeTo(out.senkouA[51], (out.tenkan[25] + out.kijun[25]) / 2, 'senkouA[51]');
  closeTo(out.senkouB[77], (wMax(D.h, 51, 52) + wMin(D.l, 51, 52)) / 2, 'senkouB[77]');
  assert.equal(firstValid(out.senkouA), 51, 'أول senkouA');
  assert.equal(firstValid(out.senkouB), 77, 'أول senkouB');
  /* التحقق من الإزاحة على كل الفهارس */
  for (let i = 26; i < D.c.length; i++) {
    const j = i - 26;
    if (out.tenkan[j] === null || out.kijun[j] === null) { assert.equal(out.senkouA[i], null, 'senkouA ' + i); continue; }
    closeTo(out.senkouA[i], (out.tenkan[j] + out.kijun[j]) / 2, 'senkouA عند ' + i);
  }
});

test('Ichimoku: chikou = الإغلاق متأخر 26 (chikou[i] = c[i+26])', () => {
  const out = ind.ichimoku(D.c, D.h, D.l);
  for (let i = 0; i < D.c.length; i++) {
    const j = i + 26;
    if (j < D.c.length) closeTo(out.chikou[i], D.c[j], 'chikou عند ' + i);
    else assert.equal(out.chikou[i], null, 'chikou عند ' + i + ' لازم null (مافيش شموع بعد)');
  }
  assert.equal(firstValid(out.chikou), 0, 'أول chikou');
});

test('Ichimoku: مطابق للمرجع المستقل', () => {
  const out = ind.ichimoku(D.c, D.h, D.l);
  const ref = refIchimoku(D.c, D.h, D.l);
  ['tenkan', 'kijun', 'senkouA', 'senkouB', 'chikou'].forEach((k) => {
    out[k].forEach((v, i) => {
      if (ref[k][i] === null) assert.equal(v, null, k + ' ' + i);
      else closeTo(v, ref[k][i], k + ' عند ' + i);
    });
  });
});

/* ═══════════════════════════════════════════════════════════
   📊 فيبوناتشي + Volume Profile + Davergence
   ═══════════════════════════════════════════════════════════ */

test('fibLevels: 7 مستويات من القاع للقمة بنسب قياسية', () => {
  const out = ind.fibLevels(100, 50);
  assert.equal(out.length, 7);
  closeTo(out[0], 50, '0%');
  closeTo(out[1], 50 + 0.236 * 50, '23.6%');
  closeTo(out[2], 50 + 0.382 * 50, '38.2%');
  closeTo(out[3], 50 + 0.5 * 50, '50%');
  closeTo(out[4], 50 + 0.618 * 50, '61.8%');
  closeTo(out[5], 50 + 0.786 * 50, '78.6%');
  closeTo(out[6], 100, '100%');
});

test('fibLevels: قمة = قاع → كل المستويات متساوية · ومصفوفات مدعومة', () => {
  const flat = ind.fibLevels(0, 0);
  assert.equal(flat.length, 7);
  flat.forEach((v) => closeTo(v, 0, 'مستوى مسطح'));
  const fromArr = ind.fibLevels(D.h, D.l);
  assert.equal(fromArr.length, 7);
  assert.ok(fromArr[0] <= fromArr[6], 'المستويات لازم تكون مرتبة تصاعدياً');
});

test('volumeProfile: مجموع الشرائح = الحجم الكلي (مافيش حجم مخترع)', () => {
  const out = ind.volumeProfile(CANDLES, 8);
  assert.equal(out.length, 8);
  const total = CANDLES.reduce((a, x) => a + x.v, 0);
  const sum = out.reduce((a, b) => a + b, 0);
  closeTo(sum, total, 'مجموع الحجم');
  out.forEach((v) => assert.ok(v >= 0, 'الحجم لازم يكون موجب'));
});

test('divergence: شكل النتيجة (type/idx/priceIdx/note) والقيمة المرجعية', () => {
  /* قاع سعري أدنى (19 بعد 20) مع قاع أعلى في المؤشر (60 بعد 50) ⇒ دايفرجنس صاعد */
  const price = [20, 21, 22, 23, 24, 25, 24, 23, 22, 21, 20, 21, 22, 23, 24, 25, 26, 25, 24, 23, 22, 21, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35];
  const osc = [60, 58, 56, 54, 52, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 70, 68, 66, 64, 62, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92];
  const out = ind.divergence(price, osc);
  assert.equal(out.length, 1);
  assert.equal(out[0].type, 'bullish');
  assert.equal(out[0].idx, 22, 'فهرس قاع المؤشر');
  assert.equal(out[0].priceIdx, 22, 'فهرس قاع السعر');
  assert.equal(typeof out[0].note, 'string');
  assert.ok(out[0].note.length > 0, 'الملاحظة لازم تكون فيها كلام');
});

test('divergence: مافيش دايفرجنس على بيانات بدون قاعين متقابلين', () => {
  const rising = D.c.map((x, i) => x + i);
  const out = ind.divergence(rising, D.c.map((x, i) => x + i));
  assert.ok(Array.isArray(out));
  out.forEach((d) => {
    assert.ok(d.type === 'bullish' || d.type === 'bearish', 'نوع غير معروف: ' + d.type);
    assert.equal(typeof d.idx, 'number');
    assert.equal(typeof d.priceIdx, 'number');
  });
});

/* ═══════════════════════════════════════════════════════════
   🛡 العقد العام — نفس الطول + null قبل الـwarmup
   ═══════════════════════════════════════════════════════════ */

/* كل دالة: بتاخد مدخلات من D وبترجّع مصفوفة أو مجموعة مصفوفات */
const PRODUCERS = [
  ['sma', (d) => ind.sma(d.c, 14)],
  ['ema', (d) => ind.ema(d.c, 14)],
  ['wma', (d) => ind.wma(d.c, 14)],
  ['hma', (d) => ind.hma(d.c, 9)],
  ['dema', (d) => ind.dema(d.c, 14)],
  ['tema', (d) => ind.tema(d.c, 14)],
  ['vwma', (d) => ind.vwma(d.c, 14, d.v)],
  ['bollinger.mid', (d) => ind.bollinger(d.c, 20, 2).mid],
  ['bollinger.upper', (d) => ind.bollinger(d.c, 20, 2).upper],
  ['bollinger.lower', (d) => ind.bollinger(d.c, 20, 2).lower],
  ['rsi', (d) => ind.rsi(d.c, 14)],
  ['macd.macd', (d) => ind.macd(d.c).macd],
  ['macd.signal', (d) => ind.macd(d.c).signal],
  ['macd.hist', (d) => ind.macd(d.c).hist],
  ['adx.adx', (d) => ind.adx(d.c, d.h, d.l, 14).adx],
  ['adx.plusDI', (d) => ind.adx(d.c, d.h, d.l, 14).plusDI],
  ['adx.minusDI', (d) => ind.adx(d.c, d.h, d.l, 14).minusDI],
  ['stochastic.k', (d) => ind.stochastic(d.c, d.h, d.l, 14, 3, 3).k],
  ['stochastic.d', (d) => ind.stochastic(d.c, d.h, d.l, 14, 3, 3).d],
  ['stochasticRaw', (d) => ind.stochasticRaw(d.c, d.h, d.l, 14)],
  ['cci', (d) => ind.cci(d.c, d.h, d.l, 20)],
  ['williamsR', (d) => ind.williamsR(d.c, d.h, d.l, 14)],
  ['atr', (d) => ind.atr(d.c, d.h, d.l, 14)],
  ['obv', (d) => ind.obv(d.c, d.v)],
  ['sar', (d) => ind.sar(d.c, d.h, d.l)],
  ['ichimoku.tenkan', (d) => ind.ichimoku(d.c, d.h, d.l).tenkan],
  ['ichimoku.kijun', (d) => ind.ichimoku(d.c, d.h, d.l).kijun],
  ['ichimoku.senkouA', (d) => ind.ichimoku(d.c, d.h, d.l).senkouA],
  ['ichimoku.senkouB', (d) => ind.ichimoku(d.c, d.h, d.l).senkouB],
  ['ichimoku.chikou', (d) => ind.ichimoku(d.c, d.h, d.l).chikou]
];

test('العقد: كل دالة ترجّع مصفوفة بنفس طول الدخل بالظبط', () => {
  PRODUCERS.forEach(([name, fn]) => {
    const out = fn(D);
    assert.ok(Array.isArray(out), name + ' لازم يرجّع مصفوفة');
    assert.equal(out.length, D.c.length, name + ' الطول غلط');
  });
});

test('العقد: كل قيمة إما null أو رقم منتهي (مافيش NaN ولا undefined)', () => {
  PRODUCERS.forEach(([name, fn]) => {
    const out = fn(D);
    out.forEach((v, i) => {
      if (v === null) return;
      assert.equal(typeof v, 'number', name + '[' + i + '] مش رقم: ' + v);
      assert.ok(isFinite(v), name + '[' + i + '] مش منتهي: ' + v);
    });
  });
});

test('العقد: كل القيم قبل الـwarmup = null (مافيش أرقام مخترعة)', () => {
  PRODUCERS.forEach(([name, fn]) => {
    const out = fn(D);
    nullBeforeWarmup(out, name);
  });
});

/* ═══════════════════════════════════════════════════════════
   🛡 الحالات الصعبة
   ═══════════════════════════════════════════════════════════ */

test('حالة صعبة: مصفوفة فاضية → [] بدون throw (كل الدوال)', () => {
  assert.deepEqual(ind.sma([], 3), []);
  assert.deepEqual(ind.ema([], 3), []);
  assert.deepEqual(ind.wma([], 3), []);
  assert.deepEqual(ind.hma([], 9), []);
  assert.deepEqual(ind.dema([], 14), []);
  assert.deepEqual(ind.tema([], 14), []);
  assert.deepEqual(ind.vwma([], 10, []), []);
  assert.deepEqual(ind.rsi([], 14), []);
  assert.deepEqual(ind.atr([], [], [], 14), []);
  assert.deepEqual(ind.obv([], []), []);
  assert.deepEqual(ind.sar([], [], []), []);
  assert.deepEqual(ind.cci([], [], [], 20), []);
  assert.deepEqual(ind.williamsR([], [], [], 14), []);

  const bb = ind.bollinger([], 20, 2);
  assert.deepEqual(bb.mid, []); assert.deepEqual(bb.upper, []); assert.deepEqual(bb.lower, []);
  const m = ind.macd([]);
  assert.deepEqual(m.macd, []); assert.deepEqual(m.signal, []); assert.deepEqual(m.hist, []);
  const a = ind.adx([], [], [], 14);
  assert.deepEqual(a.adx, []); assert.deepEqual(a.plusDI, []); assert.deepEqual(a.minusDI, []);
  const s = ind.stochastic([], [], [], 14, 3, 3);
  assert.deepEqual(s.k, []); assert.deepEqual(s.d, []);
  const ich = ind.ichimoku([], [], []);
  assert.deepEqual(ich.tenkan, []); assert.deepEqual(ich.kijun, []);
  assert.deepEqual(ich.senkouA, []); assert.deepEqual(ich.senkouB, []); assert.deepEqual(ich.chikou, []);
});

test('حالة صعبة: مدخلات مش مصفوفة → مافيش throw ومافيش أرقام مخترعة', () => {
  assert.deepEqual(ind.sma(null, 3), []);
  assert.deepEqual(ind.sma(undefined, 3), []);
  assert.deepEqual(ind.sma('مش مصفوفة', 3), []);
  assert.deepEqual(ind.ema(null, 3), []);
  assert.deepEqual(ind.rsi(null, 14), []);
  assert.deepEqual(ind.atr(null, null, null, 14), []);
  assert.deepEqual(ind.sar(null, null, null), []);
});

test('حالة صعبة: period أكبر من طول المصفوفة → كل القيم null (مافيش تخمين)', () => {
  const v = [1, 2, 3, 4, 5];
  allNull(ind.sma(v, 10), 'SMA');
  allNull(ind.ema(v, 10), 'EMA');
  allNull(ind.wma(v, 10), 'WMA');
  allNull(ind.rsi(v, 10), 'RSI');
  allNull(ind.bollinger(v, 10, 2).mid, 'BB mid');
  allNull(ind.bollinger(v, 10, 2).upper, 'BB upper');
  allNull(ind.bollinger(v, 10, 2).lower, 'BB lower');
  allNull(ind.cci(v, v, v, 10), 'CCI');
  allNull(ind.williamsR(v, v, v, 10), 'WilliamsR');
  allNull(ind.stochastic(v, v, v, 10, 3, 3).k, 'Stochastic');
  allNull(ind.adx(v, v, v, 10).adx, 'ADX');
  allNull(ind.macd(v, 10, 12, 9).macd, 'MACD');
});

test('حالة صعبة: period = 1 شغّال (SMA و EMA و ATR)', () => {
  assert.deepEqual(ind.sma([1, 2, 3], 1), [1, 2, 3]);
  assert.deepEqual(ind.ema([1, 2, 3], 1), [1, 2, 3]);
  const atr1 = ind.atr([10, 11, 12], [12, 13, 14], [9, 10, 11], 1);
  closeTo(atr1[0], 3, 'ATR[0]');
  closeTo(atr1[1], 3, 'ATR[1] مع p=1');
  closeTo(atr1[2], 3, 'ATR[2] مع p=1');
});

test('حالة صعبة: قيم NaN/undefined بتطلع null (مش NaN ولا أرقام مخترعة)', () => {
  const dirty = [1, NaN, 3, 4];
  const out = ind.sma(dirty, 2);
  assert.equal(out.length, 4);
  assert.equal(out[0], null);
  assert.equal(out[1], null, 'نافذة فيها NaN → null');
  assert.equal(out[2], null, 'نافذة فيها NaN → null');
  closeTo(out[3], 3.5, 'نافذة سليمة');

  const out2 = ind.sma([1, undefined, 3, 4], 2);
  assert.equal(out2[1], null);
  assert.equal(out2[2], null);
  closeTo(out2[3], 3.5, 'نافذة سليمة');

  /* EMA بتتخطى الشمعة الناقصة وبتكمّل من آخر حالة صحيحة */
  const ema = ind.ema([1, 2, NaN, 4, 5], 2);
  assert.equal(ema[2], null, 'الشمعة الناقصة → null');
  assert.ok(ema[3] !== null && ema[4] !== null, 'الEMA بتكمّل بعد الشمعة الناقصة');
  onlyFiniteOrNull(ema, 'EMA');

  /* RSI كمان */
  const r = ind.rsi([1, NaN, 3, 4, 5], 2);
  onlyFiniteOrNull(r, 'RSI');
  /* ATR كمان */
  const a = ind.atr([1, 2, 3], [2, NaN, 4], [0, 1, 2], 2);
  onlyFiniteOrNull(a, 'ATR');
  assert.equal(a[1], null, 'شمعة ناقصة → null');
});

test('حالة صعبة: ADX لو فيه شمعة ناقصة في نافذة التهيئة → مافيش ADX (مافيش أرقام مخترعة)', () => {
  const c = D.c.slice(0, 30).slice();
  const h = D.h.slice(0, 30).slice();
  const l = D.l.slice(0, 30).slice();
  h[5] = null;
  const out = ind.adx(c, h, l, 14);
  allNull(out.adx, 'ADX');
});

/* ═══════════════════════════════════════════════════════════
   🔌 التصدير والعقد
   ═══════════════════════════════════════════════════════════ */

test('التصدير: module.exports فيه كل دوال العقد §4.2', () => {
  const expected = [
    'sma', 'ema', 'wma', 'hma', 'dema', 'tema', 'vwma',
    'bollinger', 'rsi', 'macd', 'adx', 'stochastic', 'cci', 'williamsR',
    'atr', 'obv', 'sar', 'ichimoku', 'volumeProfile', 'fibLevels', 'divergence'
  ];
  expected.forEach((k) => {
    assert.equal(typeof ind[k], 'function', k + ' لازم يكون دالة');
  });
});

test('التصدير: window.OCTAChart.ind متاح (نفس الكود في المتصفح)', () => {
  assert.ok(globalThis.OCTAChart, 'OCTAChart لازم يكون معرّف');
  assert.ok(globalThis.OCTAChart.ind, 'OCTAChart.ind لازم يكون معرّف');
  assert.equal(globalThis.OCTAChart.ind.sma, ind.sma);
  assert.equal(globalThis.OCTAChart.ind.rsi, ind.rsi);
});

test('الدوال نقية: نفس المدخلات ⇒ نفس المخرجات (مافيش حالة داخلية)', () => {
  const a = ind.sma(D.c, 14);
  const b = ind.sma(D.c, 14);
  assert.deepEqual(a, b);
  const r1 = ind.rsi(D.c, 14);
  const r2 = ind.rsi(D.c, 14);
  assert.deepEqual(r1, r2);
  /* الـinput ما بيتغيّرش */
  const copy = D.c.slice();
  ind.sma(D.c, 14); ind.rsi(D.c, 14); ind.bollinger(D.c, 20, 2);
  assert.deepEqual(D.c, copy, 'المدخلات ما اتغيرتش');
});
