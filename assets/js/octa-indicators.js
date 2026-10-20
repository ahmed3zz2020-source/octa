/* ══════════════════════════════════════════════════════════════
   📐 OCTA — مكتبة المؤشرات الفنية (Phase 1 · T2)
   ------------------------------------------------------------
   دوال نقية 100% · مافيش حالة داخلية · مافيش I/O · مافيش DOM.
   كل دالة بترجّع مصفوفة بنفس طول_INPUT_ بالظبط،
   والقيم قبل نضج المؤشر (warmup) = null.

   ⛔ أي قيمة مش موجودة في الـinput بتطلع null — مافيش أي رقم مخترع،
      ومافيش تقريب (rounding) على المخرجات: دقة كاملة (full precision).

   📌 اصطلاح الـinput:
      c = مصفوفة الإغلاق (close) · h = مصفوفة الأعلى (high) · l = مصفوفة الأدنى (low) · v = الحجم (volume)
      المصفوفات بترتيب زمني تصاعدي (الأقدم أولاً) والفهرس = فهرس الشمعة.
      لو المصفوفة فيها قيمة مش رقمية (null/undefined/NaN) → ناتج الدالة عندها = null،
      وفي المؤشرات التكرارية (EMA/ATR/ADX/RSI) الشمعة دي بتتخطى من التنعيم
      (مش بتتحسب ولا بتتلخبط) والسلسلة بيكمل من آخر حالة صحيحة.

   📌 التعريفات المختارة (موثّقة بالكامل في الكومنتات تحت):
      · EMA  : تهيئة بـ SMA أول period (مش بيلف من أول قيمة) · معامل k = 2/(p+1)
      · RSI  : تنعيم ويلدر · متوسط بسيط للتربح/الخسارة الأول · RSI ثابت = 50 (مش 100)
      · MACD : hist = macd - signal
      · ADX  : تنعيم ويلدر لـ TR/+DM/-DM → DI → DX → ADX (أول ADX عند 2p-1)
      · ATR  : TR = max(h-l, |h-prevC|, |l-prevC|) + تنعيم ويلدر · التهيئة ATR[0] = TR[0]
      · %K   : (C - LL)/(HH - LL)*100 ، و%D = SMA3 من %K · HH==LL → 50
      · CCI  : (TP - SMA(TP)) / (0.015 * MeanDeviation)
      · %R   : (HH - C)/(HH - LL) * -100 · HH==LL → -50
      · BB   : الانحراف المعياري population (قسمة على N) مش sample
      · SAR  : AF تصاعدي 0.02 → 0.2 (حد أقصى) · قلب الاتجاه عند اختراق SAR
      · Ichimoku : 9-26-52 · Senkou متقدم 26 · Chikou متأخر 26
      · HMA  : WMA(2*WMA(n/2) - WMA(n), round(sqrt(n)))
      · DEMA : 2*EMA - EMA(EMA) · TEMA : 3*EMA - 3*EMA(EMA) + EMA(EMA(EMA))
   ══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.OCTAChart = root.OCTAChart || {};
  root.OCTAChart.ind = api;
  /* للاختبارات في Node */
  if (typeof module === 'object' && module.exports) { module.exports = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ═══════════════ أدوات داخلية ═══════════════ */

  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function filled(n) { return new Array(n > 0 ? n : 0).fill(null); }

  /* SMA عام: أي نافذة فيها قيمة مش رقمية → null */
  function smaSeries(v, p) {
    v = arr(v);
    const n = v.length, out = filled(n);
    p = Math.floor(p);
    if (!(p > 0) || n < p) return out;
    for (let i = p - 1; i < n; i++) {
      let s = 0, ok = true;
      for (let j = i - p + 1; j <= i; j++) {
        if (!isNum(v[j])) { ok = false; break; }
        s += v[j];
      }
      if (ok) out[i] = s / p;
    }
    return out;
  }

  /* EMA عام: تهيئة بـ SMA أول p قيم متتالية صحيحة، بعدين EMA عادي.
     ك = 2/(p+1) · القيمة.nan = null · شمعة مش صالحة بتتخطى (مش بتلخبط التنعيم) */
  function emaSeries(v, p) {
    v = arr(v);
    const n = v.length, out = filled(n);
    p = Math.floor(p);
    if (!(p > 0) || n < p) return out;
    const k = 2 / (p + 1);
    let sum = 0, count = 0, prev = null, started = false;
    for (let i = 0; i < n; i++) {
      const x = v[i];
      if (!isNum(x)) { sum = 0; count = 0; continue; }   /* الشمعة دي مش صالحة → تخطّي */
      if (!started) {
        sum += x; count++;
        if (count === p) {
          prev = sum / p;          /* ← التهيئة: SMA أول period */
          out[i] = prev;
          started = true;
          sum = 0; count = 0;
        }
      } else {
        prev = x * k + prev * (1 - k);
        out[i] = prev;
      }
    }
    return out;
  }

  /* WMA عام: الأقدم وزن 1 والأحدث وزن p · المجموع = p(p+1)/2 */
  function wmaSeries(v, p) {
    v = arr(v);
    const n = v.length, out = filled(n);
    p = Math.floor(p);
    if (!(p > 0) || n < p) return out;
    const denom = (p * (p + 1)) / 2;
    for (let i = p - 1; i < n; i++) {
      let s = 0, ok = true, w = 1;
      for (let j = i - p + 1; j <= i; j++) {
        if (!isNum(v[j])) { ok = false; break; }
        s += v[j] * w; w++;
      }
      if (ok) out[i] = s / denom;
    }
    return out;
  }

  /* أعلى/أدنى في نافذة */
  function windowMax(v, i, p) {
    let m = -Infinity;
    for (let j = i - p + 1; j <= i; j++) { if (v[j] > m) m = v[j]; }
    return m;
  }
  function windowMin(v, i, p) {
    let m = Infinity;
    for (let j = i - p + 1; j <= i; j++) { if (v[j] < m) m = v[j]; }
    return m;
  }

  /* ═══════════════ المتوسطات المتحركة ═══════════════ */

  /* SMA — المتوسط البسيط · أول قيمة عند الفهرس p-1 */
  function sma(v, p) { return smaSeries(v, p); }

  /* EMA — التهيئة بـ SMA أول period (مفيش EMA يبدأ من أول قيمة) */
  function ema(v, p) { return emaSeries(v, p); }

  /* WMA — مرجّح خطي: الأحدث وزن p */
  function wma(v, p) { return wmaSeries(v, p); }

  /* HMA — WMA(2*WMA(n/2) - WMA(n), round(sqrt(n)))
     n/2 = floor(p/2) · sqrt = round(sqrt(p))
     أول قيمة صالحة عند p + round(sqrt(p)) - 2 */
  function hma(v, p) {
    v = arr(v);
    const n = v.length, out = filled(n);
    p = Math.floor(p);
    if (!(p > 1) || n === 0) return out;
    const half = Math.floor(p / 2);
    const sq = Math.round(Math.sqrt(p));
    const w1 = wmaSeries(v, half);
    const w2 = wmaSeries(v, p);
    const raw = filled(n);
    for (let i = 0; i < n; i++) {
      if (isNum(w1[i]) && isNum(w2[i])) raw[i] = 2 * w1[i] - w2[i];
    }
    const res = wmaSeries(raw, sq);
    for (let i = 0; i < n; i++) out[i] = res[i];
    return out;
  }

  /* DEMA — 2*EMA - EMA(EMA) · أول قيمة صالحة عند 2p-2 */
  function dema(v, p) {
    v = arr(v);
    const n = v.length, out = filled(n);
    const e1 = emaSeries(v, p);
    const e2 = emaSeries(e1, p);
    for (let i = 0; i < n; i++) {
      if (isNum(e1[i]) && isNum(e2[i])) out[i] = 2 * e1[i] - e2[i];
    }
    return out;
  }

  /* TEMA — 3*EMA - 3*EMA(EMA) + EMA(EMA(EMA)) · أول قيمة صالحة عند 3p-3 */
  function tema(v, p) {
    v = arr(v);
    const n = v.length, out = filled(n);
    const e1 = emaSeries(v, p);
    const e2 = emaSeries(e1, p);
    const e3 = emaSeries(e2, p);
    for (let i = 0; i < n; i++) {
      if (isNum(e1[i]) && isNum(e2[i]) && isNum(e3[i])) {
        out[i] = 3 * e1[i] - 3 * e2[i] + e3[i];
      }
    }
    return out;
  }

  /* VWMA — متوسط متحرك مرجّح بالحجم.
     ‼️ Volume-Weighted بيتحسب بالحجم، فهو محتاج الحجم:
        · مدخلات مدعومة:
            1) مصفوفة شموع/كائنات: [{c, v}] أو [{close, volume}] أو [[close, vol], ...]
            2) (close[], volume[], p)  ← بارامتر تالت اختياري
        · لو مدخلات مصفوفة أرقام من غير حجم → النتيجة كلها null (مفيش حجم = VWMA غير معرّفة،
          وبنرجّع SMA كان هيدلّي على إن في حجم وهو مش موجود).
        · لو الحجم = 0 لكل الفترات → النتيجة null (مفيش وزن حقيقي). */
  function vwma(c, p, vol) {
    let closes = [], volumes = [];
    const first = Array.isArray(c) && c.length ? c[0] : null;
    const isObj = first !== null && typeof first === 'object';
    if (isObj && Array.isArray(first)) {
      /* [ [close, vol], ... ] */
      for (let i = 0; i < c.length; i++) {
        const row = c[i];
        closes.push(isNum(row[0]) ? row[0] : null);
        volumes.push(isNum(row[1]) ? row[1] : null);
      }
    } else if (isObj) {
      for (let i = 0; i < c.length; i++) {
        const o = c[i] || {};
        const cl = isNum(o.c) ? o.c : (isNum(o.close) ? o.close : null);
        const vo = isNum(o.v) ? o.v : (isNum(o.volume) ? o.volume : null);
        closes.push(cl); volumes.push(vo);
      }
    } else {
      closes = arr(c).slice();
      volumes = arr(vol).slice();
    }
    const n = closes.length, out = filled(n);
    p = Math.floor(p);
    if (!(p > 0) || n < p) return out;
    for (let i = p - 1; i < n; i++) {
      let num = 0, den = 0, ok = true;
      for (let j = i - p + 1; j <= i; j++) {
        if (!isNum(closes[j]) || !isNum(volumes[j])) { ok = false; break; }
        num += closes[j] * volumes[j];
        den += volumes[j];
      }
      if (ok && den > 0) out[i] = num / den;
    }
    return out;
  }

  /* ═══════════════ بولنجر ═══════════════ */

  /* Bollinger: mid = SMA(p) · std = انحراف معياري population (قسمة على N)
     upper = mid + k*std · lower = mid - k*std */
  function bollinger(c, p, k) {
    c = arr(c);
    p = (p == null ? 20 : Math.floor(p));
    k = (k == null ? 2 : k);
    const n = c.length;
    const mid = smaSeries(c, p);
    const upper = filled(n), lower = filled(n);
    if (!(p > 0) || n < p) return { mid: mid, upper: upper, lower: lower };
    for (let i = p - 1; i < n; i++) {
      if (!isNum(mid[i])) continue;
      /* تتبّع دقيق: متوسط ثم مجموع مربعات الانحراف (أكثر استقراراً من s2/N - mean^2) */
      let s2 = 0, ok = true;
      for (let j = i - p + 1; j <= i; j++) {
        if (!isNum(c[j])) { ok = false; break; }
        const d = c[j] - mid[i];
        s2 += d * d;
      }
      if (!ok) continue;
      const std = Math.sqrt(s2 / p);          /* ← population (N) مش sample (N-1) */
      upper[i] = mid[i] + k * std;
      lower[i] = mid[i] - k * std;
    }
    return { mid: mid, upper: upper, lower: lower };
  }

  /* ═══════════════ RSI ═══════════════ */

  function rsiValue(avgGain, avgLoss) {
    /* ⛔ التعريف المختار: لو مافيش ربح ومافيش خسارة (سوق ثابت) → RSI = 50
       (مش 100) — زي ما العقد §4.2 طلب: "RSI لـ close ثابتة = 50" */
    if (avgGain === 0 && avgLoss === 0) return 50;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /* RSI — تنعيم ويلدر:
     أول period متوسط بسيط للربح والخسارة (من التغييرات 1..p) → أول RSI عند الفهرس p،
     بعدين avgGain = (avgGain*(p-1) + gain)/p … نفس الشيء للخسارة.
     RSI دايماً في [0,100]. */
  function rsi(c, p) {
    c = arr(c);
    p = (p == null ? 14 : Math.floor(p));
    const n = c.length, out = filled(n);
    if (!(p > 0) || n <= p) return out;
    let gain = 0, loss = 0, count = 0, started = false, avgGain = 0, avgLoss = 0;
    for (let i = 1; i < n; i++) {
      const cur = c[i], prev = c[i - 1];
      if (!isNum(cur) || !isNum(prev)) { gain = 0; loss = 0; count = 0; continue; }
      const d = cur - prev;
      const g = d > 0 ? d : 0;
      const l = d < 0 ? -d : 0;
      if (!started) {
        gain += g; loss += l; count++;
        if (count === p) {
          avgGain = gain / p; avgLoss = loss / p;
          started = true;
          out[i] = rsiValue(avgGain, avgLoss);
          gain = 0; loss = 0; count = 0;
        }
      } else {
        avgGain = (avgGain * (p - 1) + g) / p;
        avgLoss = (avgLoss * (p - 1) + l) / p;
        out[i] = rsiValue(avgGain, avgLoss);
      }
    }
    return out;
  }

  /* ═══════════════ MACD ═══════════════ */

  /* MACD: line = EMA(f) - EMA(s) · signal = EMA(line, sig) · hist = line - signal
     (f=12,s=26 → الخط من الفهرس 25 · الإشارة من 33 · Histogram من 33) */
  function macd(c, f, s, sig) {
    c = arr(c);
    f = (f == null ? 12 : Math.floor(f));
    s = (s == null ? 26 : Math.floor(s));
    sig = (sig == null ? 9 : Math.floor(sig));
    const n = c.length;
    const line = filled(n), signal = filled(n), hist = filled(n);
    const emaF = emaSeries(c, f), emaS = emaSeries(c, s);
    for (let i = 0; i < n; i++) {
      if (isNum(emaF[i]) && isNum(emaS[i])) line[i] = emaF[i] - emaS[i];
    }
    const sigSeries = emaSeries(line, sig);
    for (let i = 0; i < n; i++) {
      signal[i] = sigSeries[i];
      if (isNum(line[i]) && isNum(sigSeries[i])) hist[i] = line[i] - sigSeries[i];
    }
    return { macd: line, signal: signal, hist: hist };
  }

  /* ═══════════════ ADX / DMI ═══════════════ */

  /* ADX — ويلدر:
     TR[0] = h-l ؛ TR[i] = max(h-l, |h-c[i-1]|, |l-c[i-1]|)
     +DM = (upMove > downMove && upMove > 0) ? upMove : 0 ؛ -DM = (downMove > upMove && downMove > 0) ? downMove : 0
     تنعيم ويلدر يبدأ عند الفهرس p (مجموع 1..p) → +DI/-DI عند p → DX عند p → ADX عند 2p-1 */
  function adx(c, h, l, p) {
    c = arr(c); h = arr(h); l = arr(l);
    p = (p == null ? 14 : Math.floor(p));
    const n = c.length;
    const adxOut = filled(n), plusDI = filled(n), minusDI = filled(n);
    if (!(p > 0) || n < p + 1) return { adx: adxOut, plusDI: plusDI, minusDI: minusDI };

    const tr = filled(n), pdm = filled(n), mdm = filled(n);
    for (let i = 0; i < n; i++) {
      const hi = h[i], lo = l[i], cl = c[i];
      if (!isNum(hi) || !isNum(lo) || !isNum(cl)) continue;
      if (i === 0) { tr[i] = hi - lo; pdm[i] = 0; mdm[i] = 0; continue; }
      const pc = c[i - 1], ph = h[i - 1], pl = l[i - 1];
      if (!isNum(pc) || !isNum(ph) || !isNum(pl)) { tr[i] = hi - lo; pdm[i] = 0; mdm[i] = 0; continue; }
      tr[i] = Math.max(hi - lo, Math.abs(hi - pc), Math.abs(lo - pc));
      const up = hi - ph, dn = pl - lo;
      pdm[i] = (up > dn && up > 0) ? up : 0;
      mdm[i] = (dn > up && dn > 0) ? dn : 0;
    }
    /* لو أي شمعة في نافذة التهيئة ناقصة → مافيش ADX (بدل ما نخترع أرقام) */
    for (let i = 1; i <= p; i++) {
      if (!isNum(tr[i]) || !isNum(pdm[i]) || !isNum(mdm[i])) {
        return { adx: adxOut, plusDI: plusDI, minusDI: minusDI };
      }
    }

    let sTR = 0, sP = 0, sM = 0;
    for (let i = 1; i <= p; i++) { sTR += tr[i]; sP += pdm[i]; sM += mdm[i]; }

    const dx = filled(n);
    for (let i = p; i < n; i++) {
      if (i > p) {
        sTR = sTR - sTR / p + tr[i];
        sP = sP - sP / p + pdm[i];
        sM = sM - sM / p + mdm[i];
      }
      const pdiV = sTR > 0 ? (100 * sP) / sTR : 0;
      const mdiV = sTR > 0 ? (100 * sM) / sTR : 0;
      plusDI[i] = pdiV;
      minusDI[i] = mdiV;
      const sum = pdiV + mdiV;
      dx[i] = sum > 0 ? (100 * Math.abs(pdiV - mdiV)) / sum : 0;
    }

    /* ADX = تنعيم ويلدر لـ DX: أول ADX = متوسط أول p قيم DX (عند الفهرس 2p-1) */
    let acc = 0, count = 0, prev = null;
    for (let i = p; i < n; i++) {
      if (!isNum(dx[i])) continue;
      if (prev === null) {
        acc += dx[i]; count++;
        if (count === p) { prev = acc / p; adxOut[i] = prev; acc = 0; count = 0; }
      } else {
        prev = (prev * (p - 1) + dx[i]) / p;
        adxOut[i] = prev;
      }
    }
    return { adx: adxOut, plusDI: plusDI, minusDI: minusDI };
  }

  /* ═══════════════ ستوكاستك ═══════════════ */

  /* Stochastic %K الخام: (C - LL_p)/(HH_p - LL_p)*100 · HH==LL → 50
     (مفيش قسمة على صفر) · أول قيمة عند p-1 */
  function stochasticRaw(c, h, l, p) {
    c = arr(c); h = arr(h); l = arr(l);
    p = (p == null ? 14 : Math.floor(p));
    const n = c.length, out = filled(n);
    if (!(p > 0) || n < p) return out;
    for (let i = p - 1; i < n; i++) {
      let ok = true;
      for (let j = i - p + 1; j <= i; j++) {
        if (!isNum(c[j]) || !isNum(h[j]) || !isNum(l[j])) { ok = false; break; }
      }
      if (!ok) continue;
      const hh = windowMax(h, i, p), ll = windowMin(l, i, p);
      out[i] = (hh === ll) ? 50 : ((c[i] - ll) / (hh - ll)) * 100;
    }
    return out;
  }

  /* Stochastic: %K = SMA(raw %K, k) · %D = SMA(%K, d)
     (افتراضي p=14, k=3, d=3) · القيم في [0,100] */
  function stochastic(c, h, l, p, k, d) {
    p = (p == null ? 14 : Math.floor(p));
    k = (k == null ? 3 : Math.floor(k));
    d = (d == null ? 3 : Math.floor(d));
    const n = arr(c).length;
    const raw = stochasticRaw(c, h, l, p);
    const kLine = smaSeries(raw, k);
    const dLine = smaSeries(kLine, d);
    return { k: kLine, d: dLine };
  }

  /* ═══════════════ CCI ═══════════════ */

  /* CCI: TP = (h+l+c)/3 · CCI = (TP - SMA(TP,p)) / (0.015 * MeanDeviation)
     MeanDeviation = متوسط |TP - SMA_TP| على نفس النافذة (انحراف متوسط مطلق)
     MeanDeviation = 0 → CCI = 0 (مفيش قسمة على صفر) */
  function cci(c, h, l, p) {
    c = arr(c); h = arr(h); l = arr(l);
    p = (p == null ? 20 : Math.floor(p));
    const n = c.length, out = filled(n);
    if (!(p > 0) || n < p) return out;
    const tp = filled(n);
    for (let i = 0; i < n; i++) {
      if (isNum(c[i]) && isNum(h[i]) && isNum(l[i])) tp[i] = (h[i] + l[i] + c[i]) / 3;
    }
    const tpSma = smaSeries(tp, p);
    for (let i = p - 1; i < n; i++) {
      if (!isNum(tp[i]) || !isNum(tpSma[i])) continue;
      let dev = 0, ok = true;
      for (let j = i - p + 1; j <= i; j++) {
        if (!isNum(tp[j])) { ok = false; break; }
        dev += Math.abs(tp[j] - tpSma[i]);
      }
      if (!ok) continue;
      const md = dev / p;
      out[i] = md === 0 ? 0 : (tp[i] - tpSma[i]) / (0.015 * md);
    }
    return out;
  }

  /* ═══════════════ Williams %R ═══════════════ */

  /* Williams %R = (HH - C)/(HH - LL) * -100 · بين [-100, 0] · HH==LL → -50 */
  function williamsR(c, h, l, p) {
    c = arr(c); h = arr(h); l = arr(l);
    p = (p == null ? 14 : Math.floor(p));
    const n = c.length, out = filled(n);
    if (!(p > 0) || n < p) return out;
    for (let i = p - 1; i < n; i++) {
      let ok = true;
      for (let j = i - p + 1; j <= i; j++) {
        if (!isNum(c[j]) || !isNum(h[j]) || !isNum(l[j])) { ok = false; break; }
      }
      if (!ok) continue;
      const hh = windowMax(h, i, p), ll = windowMin(l, i, p);
      out[i] = (hh === ll) ? -50 : ((hh - c[i]) / (hh - ll)) * -100;
    }
    return out;
  }

  /* ═══════════════ ATR ═══════════════ */

  /* ATR — تنعيم ويلدر:
     TR[0] = h-l · TR[i] = max(h-l, |h-c[i-1]|, |l-c[i-1]|)
     ⛔ التهيئة: ATR[0] = TR[0] (زي ما العقد §4.2: "ATR أول قيمة = TR")
     بعدين ATR[i] = (ATR[i-1]*(p-1) + TR[i])/p
     ATR موجب دايماً (TR >= 0) */
  function atr(c, h, l, p) {
    c = arr(c); h = arr(h); l = arr(l);
    p = (p == null ? 14 : Math.floor(p));
    const n = c.length, out = filled(n);
    if (!(p > 0) || n === 0) return out;
    let prevClose = null, prevAtr = null;
    for (let i = 0; i < n; i++) {
      const hi = h[i], lo = l[i], cl = c[i];
      if (!isNum(hi) || !isNum(lo)) { out[i] = null; continue; }
      let tr;
      if (i === 0 || !isNum(prevClose)) tr = hi - lo;
      else tr = Math.max(hi - lo, Math.abs(hi - prevClose), Math.abs(lo - prevClose));
      if (i === 0) {
        out[i] = tr;                 /* ← أول قيمة = أول True Range */
        prevAtr = tr;
      } else {
        prevAtr = (prevAtr * (p - 1) + tr) / p;
        out[i] = prevAtr;
      }
      if (isNum(cl)) prevClose = cl;
    }
    return out;
  }

  /* ═══════════════ OBV ═══════════════ */

  /* OBV: OBV[0] = 0 · بعدين +v لو الإغلاق طلع · -v لو نزل · 0 لو ثابت */
  function obv(c, v) {
    c = arr(c); v = arr(v);
    const n = c.length, out = filled(n);
    let acc = 0, prev = null, has = false;
    for (let i = 0; i < n; i++) {
      const cl = c[i], vo = v[i];
      if (!isNum(cl) || !isNum(vo)) { out[i] = has ? acc : null; continue; }
      if (!has) { prev = cl; has = true; out[i] = 0; continue; }
      if (cl > prev) acc += vo;
      else if (cl < prev) acc -= vo;
      prev = cl;
      out[i] = acc;
    }
    return out;
  }

  /* ═══════════════ Parabolic SAR ═══════════════ */

  /* SAR — Parabolic Stop And Reverse (ويلدر):
     التهيئة: اتجاه أول شمعتين (h[1] >= h[0] ⇒ صاعد) · SAR[0] = l[0] للصاعد و h[0] للنازل
     · EP = أعلى نقطة (صاعد) أو أدنى نقطة (نازل)
     · SAR[i] = SAR[i-1] + AF*(EP - SAR[i-1])
     · في الصاعد: SAR ما ينزلش تحت أدنى قاع في الشمعتين السابقتين
       وفي النازل: ما يعديش فوق أعلى قمة في الشمعتين السابقتين
     · قلب الاتجاه: لو السعر اخترق SAR ⇒ SAR الجديد = EP القديم والـ EP الجديد = النقطة القصوى الجديدة
       والـ AF يرجع لـ af (البداية)
     · AF بيزيد 0.02 كل ما الـEP يتجدد، وحد أقصى 0.2 */
  function sar(c, h, l, af, max) {
    c = arr(c); h = arr(h); l = arr(l);
    af = (af == null ? 0.02 : af);
    const maxAf = (max == null ? 0.2 : max);
    const n = c.length, out = filled(n);
    if (n < 2) return out;
    let up = h[1] >= h[0];
    if (!isNum(h[0]) || !isNum(l[0])) return out;
    let cur = up ? l[0] : h[0];
    let ep = up ? h[0] : l[0];
    let acc = af;
    out[0] = cur;
    for (let i = 1; i < n; i++) {
      const hi = h[i], lo = l[i];
      if (!isNum(hi) || !isNum(lo)) { out[i] = cur; continue; }
      let next = cur + acc * (ep - cur);
      if (up) {
        const cap = Math.min(l[i - 1], i >= 2 ? l[i - 2] : l[i - 1]);
        if (isNum(cap)) next = Math.min(next, cap);
        if (lo < next) {                 /* ← قلب اتجاه هابط */
          next = ep;
          up = false;
          ep = lo;
          acc = af;
        } else {
          if (hi > ep) { ep = hi; acc = Math.min(acc + af, maxAf); }
        }
      } else {
        const floor = Math.max(h[i - 1], i >= 2 ? h[i - 2] : h[i - 1]);
        if (isNum(floor)) next = Math.max(next, floor);
        if (hi > next) {                 /* ← قلب اتجاه صاعد */
          next = ep;
          up = true;
          ep = hi;
          acc = af;
        } else {
          if (lo < ep) { ep = lo; acc = Math.min(acc + af, maxAf); }
        }
      }
      cur = next;
      out[i] = cur;
    }
    return out;
  }

  /* ═══════════════ Ichimoku ═══════════════ */

  /* Ichimoku (9-26-52):
     tenkan  = (max(h,9) + min(l,9))/2        → من الفهرس 8
     kijun   = (max(h,26) + min(l,26))/2      → من الفهرس 25
     senkouA = (tenkan + kijun)/2 متقدم 26    → من الفهرس 51
     senkouB = (max(h,52) + min(l,52))/2 متقدم 26 → من الفهرس 77
     chikou  = الإغلاق متأخر 26 (chikou[i] = c[i+26]) */
  function ichimoku(c, h, l) {
    c = arr(c); h = arr(h); l = arr(l);
    const n = c.length;
    const tenkan = filled(n), kijun = filled(n);
    const senkouA = filled(n), senkouB = filled(n), chikou = filled(n);

    for (let i = 8; i < n; i++) {
      let ok = true;
      for (let j = i - 8; j <= i; j++) if (!isNum(h[j]) || !isNum(l[j])) { ok = false; break; }
      if (!ok) continue;
      tenkan[i] = (windowMax(h, i, 9) + windowMin(l, i, 9)) / 2;
    }
    for (let i = 25; i < n; i++) {
      let ok = true;
      for (let j = i - 25; j <= i; j++) if (!isNum(h[j]) || !isNum(l[j])) { ok = false; break; }
      if (!ok) continue;
      kijun[i] = (windowMax(h, i, 26) + windowMin(l, i, 26)) / 2;
    }
    /* SenkouA: (tenkan[i-26] + kijun[i-26])/2 */
    for (let i = 26; i < n; i++) {
      const j = i - 26;
      if (isNum(tenkan[j]) && isNum(kijun[j])) senkouA[i] = (tenkan[j] + kijun[j]) / 2;
    }
    /* SenkouB: (max(h[i-26-51..i-26]) + min(l[i-26-51..i-26]))/2 */
    for (let i = 26; i < n; i++) {
      const j = i - 26;
      if (j < 51) continue;
      let ok = true;
      for (let m = j - 51; m <= j; m++) if (!isNum(h[m]) || !isNum(l[m])) { ok = false; break; }
      if (!ok) continue;
      senkouB[i] = (windowMax(h, j, 52) + windowMin(l, j, 52)) / 2;
    }
    /* Chikou: الإغلاق متأخر 26 */
    for (let i = 0; i < n; i++) {
      const j = i + 26;
      if (j < n && isNum(c[j])) chikou[i] = c[j];
    }
    return { tenkan: tenkan, kijun: kijun, senkouA: senkouA, senkouB: senkouB, chikou: chikou };
  }

  /* ═══════════════ فيبوناتشي ═══════════════ */

  const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

  /* fibLevels(high, low) → مصفوفة 7 مستويات مرتبة تصاعدياً من القاع للقمة.
     ‼️ يقبلNumbers (قمّة/قاع مختار) أو مصفوفات (igl الأعلى = أعلى قيمة · أقل قيمة).
     لو القمة = القاع → كل المستويات متساوية. */
  function fibLevels(high, low) {
    let hi, lo;
    if (typeof high === 'number' && typeof low === 'number') {
      hi = high; lo = low;
    } else {
      const hs = arr(high).filter(isNum);
      const ls = arr(low).filter(isNum);
      if (!hs.length || !ls.length) return [];
      hi = Math.max.apply(null, hs);
      lo = Math.min.apply(null, ls);
    }
    if (!isNum(hi) || !isNum(lo)) return [];
    const diff = hi - lo;
    return FIB_RATIOS.map(function (r) { return lo + r * diff; });
  }

  /* ═══════════════ Volume Profile ═══════════════ */

  /* volumeProfile(candles, bins) → مصفوفة number[] (الحجم في كل شريحة سعرية)
     ‼️(Method: توزيع متساوي) — حجم كل شمعة يتوزّع بالتساوي على كل الشرائح اللي الشمعة غطّتها
     (من l إلى h). الشريحة base = أدنى low والنهاية = أعلى high.
     المدخلات: مصفوفة شموع [{c,h,l,v}] أو [{close,high,low,volume}] أو كائن {c:[],h:[],l:[],v:[]}
     volumeProfileBins(...) بترجع نفس الحساب بالتفاصيل (أسعار الشرائح + نصيب كل شريحة). */
  function extractOhlcv(src) {
    const c = [], h = [], l = [], v = [];
    if (Array.isArray(src)) {
      for (let i = 0; i < src.length; i++) {
        const o = src[i] || {};
        const cl = isNum(o.c) ? o.c : (isNum(o.close) ? o.close : null);
        const hi = isNum(o.h) ? o.h : (isNum(o.high) ? o.high : null);
        const lo = isNum(o.l) ? o.l : (isNum(o.low) ? o.low : null);
        const vo = isNum(o.v) ? o.v : (isNum(o.volume) ? o.volume : null);
        c.push(cl); h.push(hi); l.push(lo); v.push(vo);
      }
    } else if (src && typeof src === 'object') {
      const cc = arr(src.c || src.close);
      const hh = arr(src.h || src.high);
      const ll = arr(src.l || src.low);
      const vv = arr(src.v || src.volume);
      for (let i = 0; i < cc.length; i++) {
        c.push(isNum(cc[i]) ? cc[i] : null);
        h.push(isNum(hh[i]) ? hh[i] : null);
        l.push(isNum(ll[i]) ? ll[i] : null);
        v.push(isNum(vv[i]) ? vv[i] : null);
      }
    }
    return { c: c, h: h, l: l, v: v };
  }

  function volumeProfileBins(src, bins) {
    bins = Math.floor(bins == null ? 20 : bins);
    const o = extractOhlcv(src);
    const n = o.c.length;
    if (!(bins > 0) || n === 0) return [];
    let lo = Infinity, hi = -Infinity, any = false;
    for (let i = 0; i < n; i++) {
      if (!isNum(o.l[i]) || !isNum(o.h[i])) continue;
      any = true;
      if (o.l[i] < lo) lo = o.l[i];
      if (o.h[i] > hi) hi = o.h[i];
    }
    if (!any || !isFinite(lo) || !isFinite(hi)) return [];
    const width = (hi - lo) / bins;
    const vol = new Array(bins).fill(0);
    const count = new Array(bins).fill(0);
    if (width <= 0) {
      /* كل الأسعار واحدة → شريحة واحدة */
      vol[0] = o.v.filter(isNum).reduce(function (a, b) { return a + b; }, 0);
      count[0] = n;
    } else {
      for (let i = 0; i < n; i++) {
        const bl = o.l[i], bh = o.h[i], bv = o.v[i];
        if (!isNum(bl) || !isNum(bh) || !isNum(bv)) continue;
        let s = Math.floor((bl - lo) / width);
        let e = Math.ceil((bh - lo) / width) - 1;
        if (s < 0) s = 0;
        if (e > bins - 1) e = bins - 1;
        if (e < s) e = s;
        if (s > bins - 1) continue;
        const share = bv / (e - s + 1);
        for (let b = s; b <= e; b++) { vol[b] += share; count[b]++; }
      }
    }
    const total = vol.reduce(function (a, b) { return a + b; }, 0);
    const out = [];
    for (let b = 0; b < bins; b++) {
      out.push({
        index: b,
        priceLow: lo + b * width,
        priceHigh: lo + (b + 1) * width,
        priceMid: lo + (b + 0.5) * width,
        volume: vol[b],
        bars: count[b],
        share: total > 0 ? vol[b] / total : 0
      });
    }
    return out;
  }

  function volumeProfile(src, bins) {
    const rows = volumeProfileBins(src, bins);
    return rows.map(function (r) { return r.volume; });
  }

  /* ═══════════════ الدايفرجنس ═══════════════ */

  /* قاع/قمة محلية: القيمة هي الأصغر/الأكبر صراحة في نافذة ±lookback
     (ولازم تكون كل قيم النافذة أرقام) */
  function findPivots(series, lookback) {
    const lows = [], highs = [];
    const n = series.length;
    for (let i = lookback; i < n - lookback; i++) {
      const v = series[i];
      if (!isNum(v)) continue;
      let isLow = true, isHigh = true, ok = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (!isNum(series[j])) { ok = false; break; }
        if (series[j] < v) isLow = false;
        if (series[j] > v) isHigh = false;
      }
      if (!ok) continue;
      if (isLow) lows.push({ idx: i, value: v });
      if (isHigh) highs.push({ idx: i, value: v });
    }
    return { lows: lows, highs: highs };
  }

  /* divergence(c, osc) → [{type:'bullish'|'bearish', idx, priceIdx, note}]
     ‼️ التعريف: قاع سعري أدنى (lower low) مع قاع أعلى في المؤشر (higher low) ⇒ صاعد
                وقمة سعرية أعلى (higher high) مع قمة أدنى في المؤشر (lower high) ⇒ هابط
     · القمم/القاعات محسوبة على الإغلاق (c) وعلى المؤشر (osc) بنافذة ±lookback (افتراضي 5)
     · المطابقة: القاع해진 السعر يقابلون قاعين المؤشر بالترتيب (الأول مع الأول …)
     · idx = فهرس قاع/قمة المؤشر · priceIdx = فهرس قاع/قمة السعر */
  function divergence(c, osc, opts) {
    c = arr(c); osc = arr(osc);
    const lookback = Math.floor((opts && opts.lookback) ? opts.lookback : 5);
    const minGap = Math.floor((opts && opts.minGap) ? opts.minGap : 2);
    const out = [];
    if (!c.length || !osc.length) return out;
    const pp = findPivots(c, lookback);
    const op = findPivots(osc, lookback);

    /* دايفرجنس صاعد: قاعان في السعر + قاعان في المؤشر */
    const priceLows = pp.lows, oscLows = op.lows;
    const pairs = Math.min(priceLows.length, oscLows.length);
    for (let k = 1; k < pairs; k++) {
      const p1 = priceLows[k - 1], p2 = priceLows[k];
      const o1 = oscLows[k - 1], o2 = oscLows[k];
      if (p2.idx - p1.idx < minGap || o2.idx - o1.idx < minGap) continue;
      if (p2.value < p1.value && o2.value > o1.value) {
        out.push({
          type: 'bullish',
          idx: o2.idx,
          priceIdx: p2.idx,
          note: 'قاع سعري أدنى (' + p2.value + ') مع قاع أعلى في المؤشر (' + o2.value + ') — دايفرجنس صاعد محتمل'
        });
      }
    }
    /* دايفرجنس هابط: قمّتان في السعر + قمّتان في المؤشر */
    const priceHighs = pp.highs, oscHighs = op.highs;
    const pairs2 = Math.min(priceHighs.length, oscHighs.length);
    for (let k = 1; k < pairs2; k++) {
      const p1 = priceHighs[k - 1], p2 = priceHighs[k];
      const o1 = oscHighs[k - 1], o2 = oscHighs[k];
      if (p2.idx - p1.idx < minGap || o2.idx - o1.idx < minGap) continue;
      if (p2.value > p1.value && o2.value < o1.value) {
        out.push({
          type: 'bearish',
          idx: o2.idx,
          priceIdx: p2.idx,
          note: 'قمة سعرية أعلى (' + p2.value + ') مع قمة أدنى في المؤشر (' + o2.value + ') — دايفرجنس هابط محتمل'
        });
      }
    }
    out.sort(function (a, b) { return a.idx - b.idx; });
    return out;
  }

  /* ═══════════════ التصدير ═══════════════ */
  return {
    /* المتوسطات */
    sma: sma,
    ema: ema,
    wma: wma,
    hma: hma,
    dema: dema,
    tema: tema,
    vwma: vwma,
    /* المؤشرات */
    bollinger: bollinger,
    rsi: rsi,
    macd: macd,
    adx: adx,
    stochastic: stochastic,
    stochasticRaw: stochasticRaw,
    cci: cci,
    williamsR: williamsR,
    atr: atr,
    obv: obv,
    sar: sar,
    ichimoku: ichimoku,
    /* أدوات */
    volumeProfile: volumeProfile,
    volumeProfileBins: volumeProfileBins,
    fibLevels: fibLevels,
    divergence: divergence,
    /* ثوابت مساعدة */
    FIB_RATIOS: FIB_RATIOS
  };
});
