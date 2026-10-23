/* ══════════════════════════════════════════════════════════════
   🛰️ OCTA Smart Money Radar — محرك المؤشرات والتصنيف
   ──────────────────────────────────────────────────────────────
   الملف ده **منطق نقي**: مافيش DOM · مافيش شبكة · مافيش عرض.
   كل رقم بيتحسب بقاعدة ثابتة (مش تخمين) عشان النتيجة تتكرّر
   نفس الشيء كل مرة.

   📐 الترتيب المنطقي:
      جودة البيانات → الاتجاه → الزخم → الحجم → التذبذب
      → الدليل الذكي → الخطة → المخاطرة → التصنيف

   🛡️ القاعدة الذهبية:
      مفيش مؤشر ناقص بيبقى صفر ولا ٥٠. الناقص = null.
      والمحور الناقص بيتشال من الوزن (مع إعادة توزيع شفافة).

   ⛔ ممنوع: أي اسم أداة ذكاء اصطناعي في الكود أو التعليقات.
      الاسم العام: «محرك OCTA».
   ══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OCTA_RADAR = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ══════════ أدوات صغيرة ══════════ */
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : Number(v);
    return isFinite(n) ? n : null;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function round1(v) { return v == null ? null : Math.round(v * 10) / 10; }
  function round2(v) { return v == null ? null : Math.round(v * 100) / 100; }

  /* 🎯 تقريب حسب حجم السعر — زي محرك Smart Money بالظبط
     ⛔ بدون ده: هدف ٠.٢٦٩ على سهم سعره ٠.٢٤٨ بيطلع ٠.٣
        ⇒ «الهدف» تحت سعر الدخول والمستخدم شايف إن في خطأ. */
  function pxDec(price) {
    var a = Math.abs(num(price) || 0);
    if (a >= 100) return 1;
    if (a >= 10) return 2;
    if (a >= 1) return 3;
    if (a >= 0.1) return 4;
    if (a >= 0.01) return 5;
    return 6;
  }
  function pxRound(v, price) {
    if (v == null || !isFinite(v)) return null;
    var p = Math.pow(10, pxDec(price));
    return Math.round(v * p) / p;
  }

  /* ══════════════════════════════════════════════════════════════
   🧪 1) جودة البيانات — قبل أي مؤشر
   ──────────────────────────────────────────────────────────────
   ⛔ لازم نعرف: السهم ده يتتحلّل ولا لأ، قبل ما نحسب.
   ⛔ القاعدة: «بيانات ناقصة» مش «سهم ضعيف».
   ══════════════════════════════════════════════════════════════ */
  var DQ = {
    MIN_TREND: 60,      /* أقل عدد جلسات لِحكم الاتجاه */
    MIN_MOMENTUM: 35,   /* RSI/MACD */
    MIN_VOLUME: 21,     /* حجم نسبي — ٢٠ جلسة سابقة + جلسة اليوم */
    MIN_ATR: 20,        /* ATR + تذبذب */
    MIN_LONG: 200       /* EMA200 */
  };

  /* ⛔ يفحص جلسات الشموع: يحذف غير الصالح ويرجّع تقرير جودة */
  function cleanCandles(raw) {
    var out = [];
    if (!raw || !raw.length) return { candles: [], bad: 0, zeroVol: 0, gaps: 0 };
    var bad = 0, zeroVol = 0, prevT = null, gaps = 0;
    for (var i = 0; i < raw.length; i++) {
      var c = raw[i] || {};
      var t = c.t, o = num(c.o), h = num(c.h), l = num(c.l), cl = num(c.c), v = num(c.v);
      /* ⛔ جلسة غير صالحة: سعر مش رقم · سعر سالب · H<L */
      if (t == null || cl == null || h == null || l == null || !isFinite(cl) ||
          cl <= 0 || h <= 0 || l <= 0 || h < l) { bad++; continue; }
      if (v == null || v < 0) v = 0;
      if (v === 0) zeroVol++;
      /* فجوة زمنية (يوم مفقود) — بتأثر دقة المؤشرات */
      if (prevT) {
        var d = (new Date(t) - new Date(prevT)) / 86400000;
        if (d > 5) gaps++;      /* أكتر من ٥ أيام ⇒ فيه انقطاع */
      }
      prevT = t;
      out.push({ t: t, o: num(o) == null ? cl : num(o), h: h, l: l, c: cl, v: v });
    }
    return { candles: out, bad: bad, zeroVol: zeroVol, gaps: gaps };
  }

  /* ⛔ شموع بدون حركة (كل الأسعار متطابقة) = بيانات وهمية */
  function hasRealMovement(candles) {
    if (!candles || candles.length < 5) return false;
    var mn = candles[0].c, mx = candles[0].c;
    for (var i = 1; i < candles.length; i++) {
      if (candles[i].c < mn) mn = candles[i].c;
      if (candles[i].c > mx) mx = candles[i].c;
    }
    return (mx - mn) / (mx || 1) > 0.005;   /* أقل من ٠.٥٪ حركة ⇒ مش حقيقي */
  }

  function dataQuality(raw) {
    var cl = cleanCandles(raw);
    var c = cl.candles;
    var last = c.length ? c[c.length - 1].t : null;
    var days = null;
    if (last) {
      days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
    }
    var q = {
      sessions: c.length,
      badRows: cl.bad,
      zeroVol: cl.zeroVol,
      gaps: cl.gaps,
      lastDate: last,
      ageDays: days,
      stale: days != null && days > 7,
      real: hasRealMovement(c),
      /* نصاب كل مؤشر — null أو number */
      canTrend: c.length >= DQ.MIN_TREND,
      canMomentum: c.length >= DQ.MIN_MOMENTUM,
      canVolume: c.length >= DQ.MIN_VOLUME,
      canVolatility: c.length >= DQ.MIN_ATR,
      canLong: c.length >= DQ.MIN_LONG,
      /* ⛔ نسبة تغطية الجلسات الصحيحة من الإجمالي */
      integrity: 0
    };
    var tot = (raw && raw.length) ? raw.length : c.length;
    q.integrity = tot ? Math.round(c.length / tot * 100) : 0;
    /* ⛔ بيانات ناقصة = مش قادر نحلّل بوثق */
    q.usable = c.length >= DQ.MIN_VOLUME && q.real && !q.stale;
    return q;
  }

  /* ══════════════════════════════════════════════════════════════
   📈 2) المؤشرات الأساسية — كل واحد دالة نقية
   ──────────────────────────────────────────────────────────────
   كل دالة بترجع {v: number|null, n: عدد الجلسات المستخدمة}
   أو null لو البيانات مش كفاية — ⛔ مفيش ٠ ولا ٥٠ مكانها.
   ══════════════════════════════════════════════════════════════ */

  function closes(c) { return c.map(function (x) { return x.c; }); }
  function highs(c) { return c.map(function (x) { return x.h; }); }
  function lows(c) { return c.map(function (x) { return x.l; }); }
  function volumes(c) { return c.map(function (x) { return x.v; }); }

  /* 📊 SMA — متوسط متحرك بسيط */
  function sma(arr, len) {
    if (!arr || arr.length < len || len <= 0) return null;
    var s = 0;
    for (var i = arr.length - len; i < arr.length; i++) s += arr[i];
    return s / len;
  }

  /* 📈 EMA — بمتوسط متحرك بسيطة للبداية (Wilder-compatible) */
  function emaSeries(arr, len) {
    if (!arr || arr.length < len || len <= 0) return null;
    var k = 2 / (len + 1), e = null, out = [];
    /* بذرة = SMA أول len */
    var s = 0;
    for (var i = 0; i < len; i++) s += arr[i];
    e = s / len;
    out.push(e);
    for (var j = len; j < arr.length; j++) {
      e = arr[j] * k + e * (1 - k);
      out.push(e);
    }
    return out;
  }
  function ema(arr, len) {
    var s = emaSeries(arr, len);
    return s ? s[s.length - 1] : null;
  }

  /* 📉 RSI — Wilder (14) */
  function rsiSeries(closesArr, len) {
    if (!closesArr || closesArr.length < len + 1) return null;
    var gains = [], losses = [];
    for (var i = 1; i < closesArr.length; i++) {
      var d = closesArr[i] - closesArr[i - 1];
      gains.push(d > 0 ? d : 0);
      losses.push(d < 0 ? -d : 0);
    }
    if (gains.length < len) return null;
    var ag = 0, al = 0;
    for (var j = 0; j < len; j++) { ag += gains[j]; al += losses[j]; }
    ag /= len; al /= len;
    var out = [];
    /* ⛔ لو مفيش خسائر ⇒ RSI = 100 (السعر طالع بالظبط) */
    out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
    for (var k = len; k < gains.length; k++) {
      ag = (ag * (len - 1) + gains[k]) / len;
      al = (al * (len - 1) + losses[k]) / len;
      out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
    }
    return out;
  }
  function rsi(closesArr, len) {
    var s = rsiSeries(closesArr, len || 14);
    return s ? s[s.length - 1] : null;
  }

  /* 📊 MACD (12, 26, 9) */
  function macd(closesArr) {
    var fast = emaSeries(closesArr, 12);
    var slow = emaSeries(closesArr, 26);
    if (!fast || !slow) return { macd: null, signal: null, hist: null };
    /* ⛔ المحاذاة: السلسلة السريعة أطول — ناخد آخر slow.length عنصر */
    var off = fast.length - slow.length;
    var line = [];
    for (var i = 0; i < slow.length; i++) line.push(fast[off + i] - slow[i]);
    var sig = emaSeries(line, 9);
    if (!sig) return { macd: line[line.length - 1], signal: null, hist: null };
    return {
      macd: line[line.length - 1],
      signal: sig[sig.length - 1],
      hist: line[line.length - 1] - sig[sig.length - 1]
    };
  }

  /* 📉 ATR — Wilder (14) + ATR% */
  function atrSeries(c, len) {
    if (!c || c.length < len + 1) return null;
    var trs = [];
    for (var i = 1; i < c.length; i++) {
      var pc = c[i - 1].c;
      var tr = Math.max(c[i].h - c[i].l, Math.abs(c[i].h - pc), Math.abs(c[i].l - pc));
      trs.push(tr);
    }
    if (trs.length < len) return null;
    var a = 0;
    for (var j = 0; j < len; j++) a += trs[j];
    a /= len;
    var out = [a];
    for (var k = len; k < trs.length; k++) {
      a = (a * (len - 1) + trs[k]) / len;
      out.push(a);
    }
    return out;
  }
  function atr(c, len) {
    var s = atrSeries(c, len || 14);
    return s ? s[s.length - 1] : null;
  }
  function atrPct(c, len) {
    var a = atr(c, len || 14);
    if (a == null || !c.length) return null;
    var px = c[c.length - 1].c;
    if (!px) return null;
    return a / px * 100;
  }

  /* 📐 ADX — Wilder (14) مع +DI/-DI */
  function adx(c, len) {
    len = len || 14;
    if (!c || c.length < len * 2 + 1) return null;
    var trs = [], pDMs = [], nDMs = [];
    for (var i = 1; i < c.length; i++) {
      var up = c[i].h - c[i - 1].h;
      var dn = c[i - 1].l - c[i].l;
      var pc = c[i - 1].c;
      trs.push(Math.max(c[i].h - c[i].l, Math.abs(c[i].h - pc), Math.abs(c[i].l - pc)));
      pDMs.push((up > dn && up > 0) ? up : 0);
      nDMs.push((dn > up && dn > 0) ? dn : 0);
    }
    if (trs.length < len * 2) return null;
    function smooth(arr) {
      var s = 0;
      for (var j = 0; j < len; j++) s += arr[j];
      var v = s, out = [v];
      for (var k = len; k < arr.length; k++) {
        v = v - v / len + arr[k];
        out.push(v);
      }
      return out;
    }
    var sTR = smooth(trs), sP = smooth(pDMs), sN = smooth(nDMs);
    var dxs = [], pdi = [], ndi = [];
    for (var m = 0; m < sTR.length; m++) {
      if (m < len - 1) { pdi.push(null); ndi.push(null); continue; }
      var p = sTR[m] ? 100 * sP[m] / sTR[m] : 0;
      var nn = sTR[m] ? 100 * sN[m] / sTR[m] : 0;
      pdi.push(p); ndi.push(nn);
      dxs.push((p + nn) ? 100 * Math.abs(p - nn) / (p + nn) : 0);
    }
    if (dxs.length < len) return null;
    var a = 0;
    for (var q = 0; q < len; q++) a += dxs[q];
    a /= len;
    var adxv = a;
    for (var r = len; r < dxs.length; r++) {
      adxv = (adxv * (len - 1) + dxs[r]) / len;
    }
    var lastP = pdi[pdi.length - 1], lastN = ndi[ndi.length - 1];
    if (lastP == null) return null;
    return { adx: adxv, pdi: lastP, ndi: lastN };
  }

  /* 📊 حجم نسبي — الحجم الحالي ÷ متوسط ٢٠ جلسة */
  function rvol(c, len) {
    len = len || 20;
    if (!c || c.length < len + 1) return null;
    var v = volumes(c);
    var avg = sma(v.slice(0, v.length - 1), len);
    if (avg == null || avg <= 0) return null;
    return v[v.length - 1] / avg;
  }
  /* ⛔ حجمSession اليوم ÷ متوسط ٢٠ جلسة *سابقة* — التعريف القياسي.
     ⛔ ماينفعش نقارن حجم اليوم بمتوسط فيه اليوم نفسه. */

  /* 📊 متوسط الحجم (٢٠) + التغيّر */
  function volumeStats(c, len) {
    len = len || 20;
    /* ⛔ لازم ٢٠ جلسة *سابقة* + جلسة اليوم — عشان المتوسط
       يبقى «الجلسات القابلة للمقارنة» مش متوسّط فيه اليوم نفسه. */
    if (!c || c.length < len + 1) return null;
    var v = volumes(c);
    var prior = v.slice(0, v.length - 1);
    var avg = sma(prior, len);
    if (avg == null) return null;
    var cur = v[v.length - 1];
    var chg = avg > 0 ? (cur - avg) / avg * 100 : null;
    /* ⛔ نفس تعريف rvol() بالظبط — مفيش تعريفين مختلفين */
    return { cur: cur, avg: avg, changePct: chg, rvol: avg > 0 ? cur / avg : null };
  }

  /* 📐 متوسط النطاق اليومي */
  function avgRange(c, len) {
    len = len || 20;
    if (!c || c.length < len) return null;
    var s = 0;
    for (var i = c.length - len; i < c.length; i++) s += (c[i].h - c[i].l);
    return s / len;
  }

  /* ══════════════════════════════════════════════════════════════
   🏔️ 3) بنية السوق — قمم وأرض (Structure)
   ──────────────────────────────────────────────────────────────
   القمة: شمعة أعلى من ±k شمعة. الأرض:Inverse.
   ⛔ محور الاتجاه القوي مافيشش قمم ⇒ لازم احتياطي وإلا رجعت null
   ══════════════════════════════════════════════════════════════ */
  function swings(c, k) {
    k = k || 3;
    var hi = [], lo = [];
    if (!c || c.length < k * 2 + 1) return { highs: hi, lows: lo };
    for (var i = k; i < c.length - k; i++) {
      var isH = true, isL = true;
      for (var j = i - k; j <= i + k; j++) {
        if (j === i) continue;
        if (c[j].h >= c[i].h) isH = false;
        if (c[j].l <= c[i].l) isL = false;
      }
      if (isH) hi.push({ i: i, t: c[i].t, p: c[i].h });
      if (isL) lo.push({ i: i, t: c[i].t, p: c[i].l });
    }
    return { highs: hi, lows: lo };
  }

  /* 📐 اتجاه البنية: قمم صاعدة + أرض صاعدة */
  function structureBias(c) {
    var sw = swings(c, 3);
    var hh = sw.highs.length >= 2 && sw.highs[sw.highs.length - 1].p > sw.highs[sw.highs.length - 2].p;
    var hl = sw.lows.length >= 2 && sw.lows[sw.lows.length - 1].p > sw.lows[sw.lows.length - 2].p;
    var lh = sw.highs.length >= 2 && sw.highs[sw.highs.length - 1].p < sw.highs[sw.highs.length - 2].p;
    var ll = sw.lows.length >= 2 && sw.lows[sw.lows.length - 1].p < sw.lows[sw.lows.length - 2].p;
    var up = (hh ? 1 : 0) + (hl ? 1 : 0);
    var dn = (lh ? 1 : 0) + (ll ? 1 : 0);
    var bias;
    if (up >= 2) bias = 'up';
    else if (dn >= 2) bias = 'down';
    else if (up === 1 || dn === 1) bias = 'mixed';
    else bias = null;           /* ⛔ مفيش بنية ⇒ null مش تInterpretation */
    return {
      bias: bias, hh: hh, hl: hl, lh: lh, ll: ll,
      highs: sw.highs, lows: sw.lows
    };
  }

  /* 📐 أقرب مقاومة فوق / دعم تحت (من القمم والأرض الحقيقية) */
  function levels(c) {
    var sw = swings(c, 3);
    var px = c && c.length ? c[c.length - 1].c : null;
    if (px == null) return { resistance: null, support: null, highs: sw.highs, lows: sw.lows };
    var res = null, sup = null;
    for (var i = 0; i < sw.highs.length; i++) {
      var p = sw.highs[i].p;
      if (p > px && (res == null || p < res)) res = p;
    }
    for (var j = 0; j < sw.lows.length; j++) {
      var q = sw.lows[j].p;
      if (q < px && (sup == null || q > sup)) sup = q;
    }
    return { resistance: res, support: sup, highs: sw.highs, lows: sw.lows };
  }

  /* ══════════════════════════════════════════════════════════════
   🧭 4) تصنيف الاتجاه (TREND)
   ──────────────────────────────────────────────────────────────
   القواعد:
     UPTREND   → EMA20>EMA50 و EMA50>EMA200 (لو متاح) والبنية صاعدة
     DOWNTREND → عكس
     SIDEWAYS  → متوسطات قريبة من بعض / تقاطعات متكررة
     TRANSITION→ إشارات متعارضة
   ══════════════════════════════════════════════════════════════ */
  var TREND = {
    UP: 'UPTREND', DOWN: 'DOWNTREND', SIDE: 'SIDEWAYS',
    TRANS: 'TREND TRANSITION', NONE: 'INSUFFICIENT DATA'
  };

  function trendEngine(c, dq, opts) {
    opts = opts || {};
    if (!c || c.length < DQ.MIN_TREND) {
      return { state: TREND.NONE, score: null, parts: [], why: 'insufficient' };
    }
    var cl = closes(c);
    var e20 = ema(cl, 20), e50 = ema(cl, 50);
    var e200 = c.length >= DQ.MIN_LONG ? ema(cl, 200) : null;
    var st = structureBias(c);
    var ax = adx(c, 14);
    var adxV = ax ? ax.adx : null;
    var px = cl[cl.length - 1];
    var parts = [];

    /* ⛔ EMA200 ناقص ⇒ مش بنستخدمه في الحكم ولا في الدرجة
       📌 الإ votes بـ«أوزان» مش عدّ:
          كل دليل له وزن مختلف، والاتنين المتوسطات أقوى من السعر.
          ⛔TRANSITION معناها «أدلة متعارضة» مش «أدلة قليلة». */
    var wUp = 0, wDn = 0;

    if (e20 != null && e50 != null) {
      var d2050 = e20 - e50;
      if (d2050 > 0) wUp += 2; else if (d2050 < 0) wDn += 2;
      parts.push({ k: 'ema_stack', label: 'EMA20 مقابل EMA50',
        detail: e20 > e50 ? 'EMA20 فوق EMA50' : 'EMA20 تحت EMA50',
        ok: e20 > e50, v: round2(d2050), w: 2 });
    }
    if (e200 != null && e50 != null) {
      var d50200 = e50 - e200;
      if (d50200 > 0) wUp += 2; else if (d50200 < 0) wDn += 2;
      parts.push({ k: 'ema_long', label: 'EMA50 مقابل EMA200',
        detail: e50 > e200 ? 'EMA50 فوق EMA200' : 'EMA50 تحت EMA200',
        ok: e50 > e200, v: round2(d50200), w: 2 });
    }
    if (px != null && e50 != null) {
      var above = px > e50;
      if (above) wUp += 1; else wDn += 1;
      parts.push({ k: 'price_ema50', label: 'السعر مقابل EMA50',
        detail: above ? 'السعر فوق EMA50' : 'السعر تحت EMA50',
        ok: above, v: round2(px - e50), w: 1 });
    }
    if (st.bias === 'up') wUp += 2;
    else if (st.bias === 'down') wDn += 2;
    if (st.bias) {
      parts.push({ k: 'structure', label: 'بنية السوق',
        detail: st.bias === 'up' ? 'قمم وأرض صاعدة' : (st.bias === 'down' ? 'قمم وأرض هابطة' : 'إشارات متعارضة'),
        ok: st.bias === 'up', v: null, w: 2 });
    } else {
      /* ⛔ اتجاه قوي = مافيشش قمم وأرض (كل يوم نقطة جديدة).
         ⇒ لازم احتياطي وإلا رجعنا null وخدعنا السهم.
         📌 الاحتياطي: ميل EMA20 على ١٠ جلسات (وزن ١ — أضعف). */
      var es = emaSeries(cl, 20);
      if (es && es.length >= 11) {
        var slope = es[es.length - 1] - es[es.length - 11];
        var up = slope > 0;
        if (up) wUp += 1; else wDn += 1;
        parts.push({ k: 'ema_slope', label: 'ميل EMA20 (بديل البنية)',
          detail: up ? 'المتوسط المتحرك القصير صاعد' : 'المتوسط المتحرك القصير هابط',
          ok: up, v: round2(slope), w: 1 });
      }
    }

    var wTot = wUp + wDn;
    var state;
    if (wTot === 0) state = TREND.NONE;
    else if (wUp > 0 && wDn === 0) state = TREND.UP;
    else if (wDn > 0 && wUp === 0) state = TREND.DOWN;
    else {
      /* ⛔ أدلة على الجهتين ⇒ نحسب قوة الهيمنة */
      var dom = Math.max(wUp, wDn) / wTot;
      if (dom < 0.6) state = TREND.TRANS;   /* متعارضة ⇒ انتقال محتمل */
      else if (wUp > wDn) state = TREND.UP;
      else if (wDn > wUp) state = TREND.DOWN;
      else state = TREND.SIDE;
    }

    /* 📊 الدرجة: اتجاه + قوة + ثبات
       الاتجاه ٦٠ · قوة ADX ٢٥ · ثبات البنية ١٥ */
    var score = null, sTrend = null, sAdx = null, sStruct = null;
    if (wTot > 0) {
      /* 📊 اتجاه محسوب بالوزن: نسبة القوة الصاعدة من كل الأدلة */
      sTrend = (wUp / wTot) * 100;
      if (state === TREND.UP) sTrend = 60 + sTrend * 0.4;
      else if (state === TREND.DOWN) sTrend = 40 - sTrend * 0.4;
      else if (state === TREND.SIDE) sTrend = 50;
      else sTrend = 50 + (sTrend - 50) * 0.5;

      if (adxV != null) {
        /* ⛔ ADX < 20 = اتجاه ضعيف · > 40 = قوي
           ⛔⛔ الدرجة بتقيس **جودة الاتجاه الصاعد** — فقوة الاتجاه
              الهابط لازم تنقص الدرجة مش ترفعها. (باج: اتجاه هابط
              قوي كان بياخد ٥٧.٦ — أعلى من المحايد!) */
        var q = clamp((adxV - 10) / 35 * 100, 0, 100);
        if (state === TREND.DOWN) q = 100 - q;
        else if (state === TREND.SIDE || state === TREND.TRANS) q = 50;
        sAdx = q;
      }
      if (st.bias) {
        /* ⛔ نفس المنطق: بنية هابطة = ٠ في جودة الاتجاه الصاعد */
        var bull = (st.hh ? 1 : 0) + (st.hl ? 1 : 0);
        sStruct = bull * 50;
      } else {
        /* ⛔ البنية ناقصة ⇒ ثبات البنية ما يتحسبش (إلا احتياطي الميل) */
        sStruct = null;
      }
      var wsum = 60, acc = sTrend * 60;
      if (sAdx != null) { wsum += 25; acc += sAdx * 25; }
      if (sStruct != null) { wsum += 15; acc += sStruct * 15; }
      score = clamp(acc / wsum, 0, 100);
    }

    var strength = null;
    if (adxV != null) {
      strength = adxV >= 40 ? 'STRONG' : (adxV >= 25 ? 'MODERATE' : (adxV >= 20 ? 'WEAK' : 'ABSENT'));
    }

    return {
      state: state, score: score == null ? null : round1(score),
      ema20: round2(e20), ema50: round2(e50), ema200: round2(e200),
      adx: adxV == null ? null : round1(adxV),
      pdi: ax ? round1(ax.pdi) : null, ndi: ax ? round1(ax.ndi) : null,
      strength: strength, structure: st, parts: parts,
      wUp: wUp, wDn: wDn, wTotal: wTot,
      px: px
    };
  }

  /* ══════════════════════════════════════════════════════════════
   ⚡ 5) تصنيف الزخم (MOMENTUM)
   ──────────────────────────────────────────────────────────────
   RSI + MACD + اتجاه الزخم (هل بيتقوى ولا بيضعف)
   ⛔ التشبع مش bearish/bullish تلقائي — حالة بس.
   ══════════════════════════════════════════════════════════════ */
  var MOM = {
    STRONG_POS: 'STRONG POSITIVE MOMENTUM', POS: 'POSITIVE MOMENTUM',
    NEUTRAL: 'NEUTRAL MOMENTUM', NEG: 'NEGATIVE MOMENTUM',
    STRONG_NEG: 'STRONG NEGATIVE MOMENTUM',
    OVERBOUGHT: 'OVERBOUGHT', OVERSOLD: 'OVERSOLD', NONE: 'INSUFFICIENT DATA'
  };

  function momentumEngine(c, dq, opts) {
    opts = opts || {};
    var hi = opts.rsiHigh == null ? 70 : opts.rsiHigh;
    var lo = opts.rsiLow == null ? 30 : opts.rsiLow;
    if (!c || c.length < DQ.MIN_MOMENTUM) {
      return { state: MOM.NONE, score: null, parts: [], why: 'insufficient' };
    }
    var cl = closes(c);
    var rs = rsiSeries(cl, 14);
    var rsiV = rs ? rs[rs.length - 1] : null;
    var rsiPrev = rs && rs.length > 1 ? rs[rs.length - 2] : null;
    var rsiSlope = (rsiV != null && rsiPrev != null) ? (rsiV - rsiPrev) : null;
    var m = macd(cl);
    var parts = [];

    var rsiScore = null;
    if (rsiV != null) {
      /* ⛔ ٥٠ = محايد · ٧٠ = قوة · ٣٠ = ضعف. التشبع بيلف الدايرة بحد أقصى ٢٥ */
      rsiScore = clamp(rsiV, 0, 100);
      parts.push({ k: 'rsi', label: 'RSI (14)', detail: 'RSI = ' + round1(rsiV), ok: rsiV >= 50, v: round1(rsiV) });
    }
    var macdScore = null;
    if (m.macd != null) {
      /* ⛔ تطبيع MACD: نقاربه على ATR عشان apples-to-apples */
      var a = atr(c, 14);
      var norm = (a && a > 0 && m.macd != null) ? m.macd / a : null;
      if (norm != null) macdScore = clamp(50 + norm * 50, 0, 100);
      parts.push({
        k: 'macd', label: 'MACD (12/26/9)',
        detail: m.signal == null ? 'MACD غير مكتمل'
          : (m.macd > m.signal ? 'MACD فوق خط الإشارة' : 'MACD تحت خط الإشارة'),
        ok: m.macd > m.signal, v: m.macd == null ? null : round2(m.macd)
      });
    }
    var slopeScore = null;
    if (rsiSlope != null) {
      slopeScore = clamp(50 + rsiSlope * 2.5, 0, 100);
      parts.push({
        k: 'rsi_slope', label: 'ميل RSI',
        detail: rsiSlope > 0 ? 'الزخم بيتقوى' : (rsiSlope < 0 ? 'الزخم بيضعف' : 'الزخم ثابت'),
        ok: rsiSlope >= 0, v: round1(rsiSlope)
      });
    }

    var state = MOM.NONE, dirState = null, score = null;
    if (rsiV == null && m.macd == null) {
      state = MOM.NONE;
    } else {
      var bull = (rsiV != null && rsiV >= 50) ? 1 : 0;
      var bear = (rsiV != null && rsiV < 50) ? 1 : 0;
      if (m.macd != null && m.signal != null) {
        if (m.macd > m.signal) { bull++; } else { bear++; }
      }
      if (rsiSlope != null) {
        if (rsiSlope > 0) { bull++; } else if (rsiSlope < 0) { bear++; }
      }
      if (bull === 0 && bear === 0) state = MOM.NEUTRAL;
      else if (bull >= 3) state = MOM.STRONG_POS;
      else if (bear >= 3) state = MOM.STRONG_NEG;
      else if (bull > bear) state = MOM.POS;
      else if (bear > bull) state = MOM.NEG;
      else state = MOM.NEUTRAL;

      /* 📌 dirState = الاتجاه نفسه، و state = الحالة النهائية.
         ⛔ التشبع حالة **مش** bearish/bullish تلقائي — فبنخلي
         الاتجاه محفوظ في dirState ونقول في الشرح إن ده تشبع. */
      var dirState = state;
      if (rsiV != null && rsiV >= hi) state = MOM.OVERBOUGHT;
      else if (rsiV != null && rsiV <= lo) state = MOM.OVERSOLD;

      var w = 0, acc = 0;
      if (rsiScore != null) { acc += rsiScore * 45; w += 45; }
      if (macdScore != null) { acc += macdScore * 35; w += 35; }
      if (slopeScore != null) { acc += slopeScore * 20; w += 20; }
      if (w > 0) score = round1(clamp(acc / w, 0, 100));
    }

    var zone = null;
    if (rsiV != null) {
      zone = rsiV >= hi ? 'overbought' : (rsiV <= lo ? 'oversold' : (rsiV >= 50 ? 'bullish' : 'bearish'));
    }
    return {
      state: state, dirState: dirState == null ? null : dirState,
      score: score, rsi: rsiV == null ? null : round1(rsiV),
      rsiSlope: rsiSlope == null ? null : round1(rsiSlope), zone: zone,
      macd: m.macd == null ? null : round2(m.macd),
      signal: m.signal == null ? null : round2(m.signal),
      hist: m.hist == null ? null : round2(m.hist),
      parts: parts
    };
  }

  /* ══════════════════════════════════════════════════════════════
   🌊 6) تصنيف الحجم والسيولة (VOLUME)
   ──────────────────────────────────────────────────────────────
   ⛔ حجم عالي ≠ شراء مؤسسات. ممكن يكون بيع أو توزيع أو ذعر.
      عشان كده ببنقول «نشاط» مش «شراءPressure» إلا لمؤشر صح.
   ══════════════════════════════════════════════════════════════ */
  var VOL = {
    LOW: 'LOW VOLUME', NORMAL: 'NORMAL VOLUME', HIGH: 'HIGH VOLUME',
    UNUSUAL: 'UNUSUAL VOLUME', NONE: 'INSUFFICIENT DATA'
  };
  var LIQ = {
    ILLIQUID: 'ILLIQUID', THIN: 'THIN', MODERATE: 'MODERATE',
    LIQUID: 'LIQUID', DEEP: 'DEEP', NONE: 'INSUFFICIENT DATA'
  };

  function volumeEngine(c, dq, opts) {
    opts = opts || {};
    if (!c || c.length < DQ.MIN_VOLUME) {
      return { state: VOL.NONE, score: null, liq: LIQ.NONE, parts: [], why: 'insufficient' };
    }
    var vs = volumeStats(c, 20);
    if (!vs) return { state: VOL.NONE, score: null, liq: LIQ.NONE, parts: [], why: 'insufficient' };
    var r = vs.rvol;
    var parts = [];
    var state, score;

    /* 📐 اتجاه الحركة آخر ٥ جلسات — عشان نعرف الحجم بيأكّد إيه */
    var move5 = null;
    if (c.length >= 6) {
      var p0 = c[c.length - 6].c, p1 = c[c.length - 1].c;
      if (p0 > 0) move5 = (p1 - p0) / p0 * 100;
    }

    if (r == null) { state = VOL.NONE; score = null; }
    else {
      /* 📊 عتبات معايَرة على التوزيع الحقيقي للبورصة المصرية
         (عيّنة ١١٦ سهم · ٢٣ أكتوبر ٢٠٢٦):
         وسيط RVOL = ٠.٧٠ · ربع ١ = ٠.٤٦ · ربع ٣ = ١.٠١
         ⇒ «ضعيف» تحت ٠.٦ (٣٠٪ من السوق) · «مرتفع» ١.٣+ */
      if (r >= 2.5) state = VOL.UNUSUAL;
      else if (r >= 1.3) state = VOL.HIGH;
      else if (r >= 0.6) state = VOL.NORMAL;
      else state = VOL.LOW;

      /* 📊 الدرجة = هل الحجم **أكّد** الحركة ولا ناقضها؟
         ⛔ حجم عالي + سعر هابط = توزيع (سلوك بيع) ⇒ درجة منخفضة.
         ⛔ حجم عالي + سعر صاعد = تأكيد ⇒ درجة عالية.
         📌 ده هو الفرق بين «نشاط» و«جودة نشاط». */
      var up = move5 != null && move5 > 0.15;
      var dn = move5 != null && move5 < -0.15;
      if (up && r >= 1.2) {
        score = 55 + (r - 1) * 18 + Math.min(move5, 8) * 1.5;
      } else if (up) {
        score = 50 + Math.min(move5, 5) * 1.5;          /* صعود بلا مشاركة */
      } else if (dn && r >= 1.5) {
        score = 35 - (r - 1.5) * 14 - Math.min(-move5, 8) * 1.2;  /* ⛔ توزيع */
      } else if (dn) {
        score = 45 + Math.min(-move5, 5) * 1.2;
      } else {
        score = 50 + (r - 1) * 20;
      }
      score = round1(clamp(score, 0, 100));
      parts.push({ k: 'rvol', label: 'الحجم النسبي (RVOL)',
        detail: 'حجم اليوم = ' + round2(r) + ' × متوسط ٢٠ جلسة سابقة',
        ok: r >= 1, v: round2(r) });
      if (move5 != null) {
        parts.push({ k: 'move5', label: 'حركة السعر (٥ جلسات)',
          detail: (move5 >= 0 ? '+' : '') + round1(move5) + '%',
          ok: move5 > 0, v: round1(move5) });
      }
      if (dn && r >= 1.5) {
        parts.push({ k: 'distribution', label: 'علامة توزيع',
          detail: 'حجم عالي مع سعر هابط — سلوك بيع لا شراء',
          ok: false, v: null });
      }
      if (vs.changePct != null) {
        parts.push({ k: 'vol_change', label: 'تغيّر الحجم',
          detail: (vs.changePct >= 0 ? '+' : '') + round1(vs.changePct) + '% مقارنة بالمتوسط',
          ok: vs.changePct >= 0, v: round1(vs.changePct) });
      }
    }

    /* 💧 السيولة: حجم التداول ÷ القيمة السوقية (نسبة turnover يومية)
       ⛔ mc من market_tech بالجنيه المصري و close بالجنيه ⇒ نسبة صحيحة */
    var mc = opts.marketCap, px = opts.price;
    var liq = LIQ.NONE, turnover = null, tradedValue = null;
    if (vs.cur != null && px) tradedValue = vs.cur * px;
    if (mc && mc > 0 && px && px > 0) {
      var floatShares = mc / px;
      if (floatShares > 0) {
        turnover = vs.cur / floatShares * 100;
        /* ⛔ العتبات مقاسة على البورصة المصرية (نسبة دوران يومي):
           COMI ≈ ٠.١٥٪ · MFSC ≈ ٠.٣١٪ ⇒ ١٪ يعني نشاط استثنائي. */
        if (turnover >= 1) liq = LIQ.DEEP;
        else if (turnover >= 0.5) liq = LIQ.LIQUID;
        else if (turnover >= 0.2) liq = LIQ.MODERATE;
        else if (turnover >= 0.05) liq = LIQ.THIN;
        else liq = LIQ.ILLIQUID;
      }
    }
    if (liq !== LIQ.NONE) {
      parts.push({ k: 'liquidity', label: 'سيولة السوق',
        detail: 'حجم التداول = ' + round2(turnover) + '% من حجم السهمOutstanding',
        ok: liq === LIQ.DEEP || liq === LIQ.LIQUID, v: round2(turnover) });
    }

    return {
      state: state, score: score, liq: liq,
      move5: move5 == null ? null : round1(move5),
      rvol: r == null ? null : round2(r),
      cur: vs.cur, avg: round1(vs.avg),
      changePct: vs.changePct == null ? null : round1(vs.changePct),
      tradedValue: tradedValue == null ? null : round1(tradedValue),
      turnover: turnover == null ? null : round2(turnover),
      parts: parts
    };
  }

  /* ══════════════════════════════════════════════════════════════
   🌡️ 7) التذبذب (VOLATILITY)
   ──────────────────────────────────────────────────────────────
   ⛔⛔ العتبات **نسبية للسهم نفسه** مش مطلقة لكل البورصة.
      سهم سعره ٠.٢٥ تذبذبه ٥٪ عادي، وسهم ٥٠٠ تذبذبه ٥٪ عادي برضه.
      ⛔ التذبذب العالي **مش إشارة إيجابية** — ده مخاطرة.
   ══════════════════════════════════════════════════════════════ */
  var VOLAT = {
    LOW: 'LOW VOLATILITY', NORMAL: 'NORMAL VOLATILITY',
    HIGH: 'HIGH VOLATILITY', EXTREME: 'EXTREME VOLATILITY', NONE: 'INSUFFICIENT DATA'
  };

  /* 📊 تطبيع نسبي: ATR% ÷ متوسط ATR% التاريخي (٦٠ جلسة) */
  function volatilityEngine(c, dq, opts) {
    opts = opts || {};
    if (!c || c.length < DQ.MIN_ATR) {
      return { state: VOLAT.NONE, score: null, parts: [], why: 'insufficient' };
    }
    var a = atr(c, 14);
    var ap = atrPct(c, 14);
    var ar = avgRange(c, 20);
    var parts = [];
    if (a == null || ap == null) {
      return { state: VOLAT.NONE, score: null, parts: [], why: 'insufficient' };
    }

    /* 📊 النسبة النسبية: ATR% الحالي ÷ متوسط ATR% آخر ٦٠ جلسة */
    var rel = null;
    if (c.length >= 60) {
      var pcts = [];
      for (var i = c.length - 60; i < c.length; i++) {
        var w = c.slice(Math.max(0, i - 15), i);
        if (w.length < 15) continue;
        var aa = atr(w, 14);
        if (aa != null && w[w.length - 1].c > 0) pcts.push(aa / w[w.length - 1].c * 100);
      }
      if (pcts.length >= 10) {
        var m = 0;
        for (var j = 0; j < pcts.length; j++) m += pcts[j];
        m /= pcts.length;
        if (m > 0) rel = ap / m;
      }
    }

    var state, score;
    if (rel == null) {
      /* ⛔ مفيش مرجع تاريخي ⇒ نستخدم ATR% المطلق كبديل ونقول كده */
      if (ap < 1.5) state = VOLAT.LOW;
      else if (ap < 3.5) state = VOLAT.NORMAL;
      else if (ap < 6) state = VOLAT.HIGH;
      else state = VOLAT.EXTREME;
      score = round1(clamp(100 - ap * 12, 0, 100));
      parts.push({ k: 'atr_abs', label: 'ATR% (بدون مرجع تاريخي)',
        detail: 'ATR = ' + round2(ap) + '% من السعر', ok: ap < 3.5, v: round2(ap) });
    } else {
      if (rel < 0.8) state = VOLAT.LOW;
      else if (rel < 1.35) state = VOLAT.NORMAL;
      else if (rel < 2) state = VOLAT.HIGH;
      else state = VOLAT.EXTREME;
      /* 📊 الدرجة: كل ما التذبذب أعلى ⇒ الدرجة أقل (دي مخاطرة مش ميزة) */
      score = round1(clamp(100 - (rel - 0.8) / 1.2 * 60, 0, 100));
      parts.push({ k: 'atr_rel', label: 'ATR% نسبي لتاريخ السهم',
        detail: 'التذبذب الحالي = ' + round2(rel) + ' × متوسطه التاريخي',
        ok: rel < 1.35, v: round2(rel) });
      parts.push({ k: 'atr_abs', label: 'ATR% من السعر',
        detail: 'ATR = ' + round2(ap) + '% من السعر', ok: ap < 3.5, v: round2(ap) });
    }
    parts.push({ k: 'avg_range', label: 'متوسط النطاق اليومي',
      detail: ar == null ? 'غير متاح' : round2(ar) + ' وحدة سعرية',
      ok: true, v: ar == null ? null : round2(ar) });

    return {
      state: state, score: score, atr: round2(a), atrPct: round2(ap),
      avgRange: ar == null ? null : round2(ar), rel: rel == null ? null : round2(rel),
      parts: parts
    };
  }

  /* ══════════════════════════════════════════════════════════════
   🎯 9) خطة الدخول / الوقف / الهدف  (PLAN)
   ──────────────────────────────────────────────────────────────
   📌 القاعدة: **مافيش** دخول تلقائي بسعر السوق الحالي.
      الدخول له شرط: كسر مقاومة (بتأكيد حجم) أو ارتداد من دعم.

   📌 الوقف: ATR × مضاعِف (قابل للضبط) — ومقابل بالهيكل.
      ⛔ لو الهيكل والـATR مختلفين كتير ⇒ «يحتاج مراجعة»،
         مش بنختار الأنضف الشكل.

   ⛔ كل المستويات **افتراضية** — مش أوامر.
   ══════════════════════════════════════════════════════════════ */
  var PLAN = {
    WAIT: 'WAITING FOR CONFIRMATION',
    ZONE: 'POTENTIAL ENTRY ZONE',
    CONFIRMED: 'CONFIRMED ANALYTICAL SETUP',
    INVALID: 'SETUP INVALIDATED',
    NONE: 'PLAN UNAVAILABLE',
    TARGET_NA: 'TARGET UNAVAILABLE'
  };

  var RISK = {
    LOWER: 'LOWER RELATIVE RISK', MODERATE: 'MODERATE RISK',
    HIGH: 'HIGH RISK', VERY_HIGH: 'VERY HIGH RISK', NA: 'RISK NOT ASSESSABLE'
  };

  /* 🔧 الإعدادات — بتتخزّن في كائن واحد (مش متفرقة في الكود) */
  function defaultPlanCfg(o) {
    o = o || {};
    return {
      atrStopMult: o.atrStopMult == null ? 2.0 : o.atrStopMult,   /* مسافة الوقف */
      atrTargetMult: o.atrTargetMult == null ? 3.0 : o.atrTargetMult, /* الهدف الأول */
      atrTarget2Mult: o.atrTarget2Mult == null ? 5.0 : o.atrTarget2Mult,
      entryBufferPct: o.entryBufferPct == null ? 1.0 : o.entryBufferPct, /* ⛔ منطقة الدخول */
      requireVolumeConfirm: o.requireVolumeConfirm == null ? 1.2 : o.requireVolumeConfirm,
      maxStructStopAtr: o.maxStructStopAtr == null ? 2.5 : o.maxStructStopAtr
    };
  }

  function planEngine(c, trend, vol, vola, cfg) {
    cfg = defaultPlanCfg(cfg);
    if (!c || c.length < 20) {
      return { status: PLAN.NONE, reason: 'insufficient', entry: null, stop: null,
        target1: null, target2: null, rr: null, notes: [] };
    }
    var px = c[c.length - 1].c;
    var a = vola && vola.atr;
    var lv = R_levels(c);
    var res = lv.resistance, sup = lv.support;
    var notes = [];
    var entry = null, entryLo = null, entryHi = null, confirm = null;
    var kind = null;

    /* ── تحديد أسلوب الدخول ───────────────────────────────────
       ① كسر مقاومة: السعر تحت المقاومة closest
       ② ارتداد من دعم: السعر قريب من الدعم
       ⛔ لو مفيش ⇒ ما في��ش خطة (مش نفترض السعر الحالي دخول) */
    var distRes = res ? (res - px) / px * 100 : null;
    var distSup = sup ? (px - sup) / px * 100 : null;

    if (res && distRes != null && distRes > 0.1 && distRes < 12) {
      kind = 'BREAKOUT';
      entry = res;
      entryLo = pxRound(res * (1 - cfg.entryBufferPct / 100), px);
      entryHi = pxRound(res * (1 + cfg.entryBufferPct / 100), px);
      confirm = 'إغلاق يومي فوق المقاومة ' + pxRound(res, px) +
        ' مع حجم ≥ ' + cfg.requireVolumeConfirm + '× متوسط ٢٠ جلسة';
    } else if (sup && distSup != null && distSup > 0 && distSup < 8) {
      kind = 'PULLBACK';
      entry = sup;
      entryLo = pxRound(sup, px);
      entryHi = pxRound(sup * (1 + cfg.entryBufferPct / 100), px);
      confirm = 'ارتداد من الدعم ' + pxRound(sup, px) + ' مع ثبات السعر فوقه';
    } else {
      return {
        status: PLAN.NONE, reason: res ? 'no_setup_near' : 'no_levels',
        entry: null, stop: null, target1: null, target2: null, rr: null,
        current: px, notes: notes,
        message: res ? 'السعر بعيد عن أقرب مقاومة/دعم — مفيش خطة دخول واضحة'
          : 'مفيش مستويات تاريخية كافية لتحديد خطة دخول'
      };
    }

    /* ── وقف الخسارة: ATR + الهيكل ─────────────────────────── */
    var atrStop = null, structStop = null, stop = null, stopKind = null, conflict = false;
    if (a && a > 0) {
      atrStop = entry - a * cfg.atrStopMult;
      /* ⛔ وقف الهيكل = تحت آخر أرض (أو تحت السعر لو مفيش أرض) */
      var lastLow = null;
      var sw = swings(c, 3);
      if (sw.lows.length) lastLow = sw.lows[sw.lows.length - 1].p;
      if (lastLow != null && lastLow < entry) structStop = lastLow;
      /* ⛔ نختار الأضيق المعقول — بس لو الفرق كبير ⇒ مراجعة */
      if (structStop != null && atrStop != null) {
        var diffAtr = Math.abs(atrStop - structStop) / a;
        if (diffAtr > cfg.maxStructStopAtr) {
          conflict = true;
          stop = atrStop;            /* ⛔ ATR هو الأساس (أقرب للمنطق) */
          stopKind = 'ATR';
          notes.push('تعارض: وقف ATR (' + pxRound(atrStop, px) + ') ووقف الهيكل (' +
            pxRound(structStop, px) + ') بعيدين عن بعض ⇒ الخطة محتاجة مراجعة');
        } else {
          stop = Math.max(atrStop, structStop);  /* الأضيق = أقرب للدخول */
          stopKind = 'ATR+STRUCT';
        }
      } else {
        stop = atrStop; stopKind = 'ATR';
      }
    }
    if (stop == null) {
      return { status: PLAN.NONE, reason: 'no_atr', entry: entry, stop: null,
        target1: null, target2: null, rr: null, current: px, notes: notes,
        message: 'مفيش ATR — مش قادر نحسب وقف الخسارة' };
    }

    /* ── الأهداف ───────────────────────────────────────────── */
    var t1 = null, t2 = null, tKind = null;
    var nextRes = null, nextRes2 = null;
    if (res) {
      /* المقاومة اللي فوق الدخول (لو الدخول عند المقاومة ⇒ نلاقي اللي بعدها) */
      var all = lv.highs || [];
      for (var i = 0; i < all.length; i++) {
        var p = all[i].p;
        if (p > entry + (a || 0) * 0.3) {
          if (nextRes == null) nextRes = p; else if (nextRes2 == null) nextRes2 = p;
        }
      }
    }
    if (a && a > 0) {
      var atrT1 = entry + a * cfg.atrTargetMult;
      var atrT2 = entry + a * cfg.atrTarget2Mult;
      if (nextRes && nextRes > entry) {
        t1 = nextRes; tKind = 'RESISTANCE';
        t2 = nextRes2 && nextRes2 > t1 ? nextRes2 : atrT2;
      } else {
        t1 = atrT1; t2 = atrT2; tKind = 'ATR';
      }
    }

    /* ⛔ هدف لازم يكون أعلى من الدخول */
    if (t1 != null && t1 <= entry) { t1 = null; tKind = null; }
    if (t2 != null && (t1 == null || t2 <= t1)) { t2 = null; }

    /* ── نسبة العائد للمخاطرة ──────────────────────────────── */
    var riskPerShare = entry - stop;
    var rr = null;
    if (t1 != null && riskPerShare > 0) rr = (t1 - entry) / riskPerShare;

    /* ── حالة الخطة ────────────────────────────────────────── */
    var status;
    if (kind === 'PULLBACK' && distSup <= 2) status = PLAN.ZONE;
    else if (kind === 'BREAKOUT' && distRes <= 1.5) status = PLAN.ZONE;
    else status = PLAN.WAIT;
    /* ⛔ اتجاه هابط ⇒ الخطة مش قائمة (مش بنبني خطأ على هبوط) */
    if (trend && trend.state === TREND.DOWN) {
      status = PLAN.INVALID;
      notes.push('الاتجاه هابط — الخطة دي مش قائمة');
    }

    return {
      status: status, kind: kind,
      current: px,
      entry: pxRound(entry, px), entryLo: pxRound(entryLo, px), entryHi: pxRound(entryHi, px),
      confirm: confirm,
      stop: pxRound(stop, px), stopKind: stopKind,
      stopAtr: atrStop == null ? null : pxRound(atrStop, px),
      stopStruct: structStop == null ? null : pxRound(structStop, px),
      conflict: conflict,
      target1: t1 == null ? null : pxRound(t1, px),
      target2: t2 == null ? null : pxRound(t2, px),
      targetKind: tKind,
      targetAvailable: t1 != null,
      riskPerShare: riskPerShare == null ? null : pxRound(riskPerShare, px),
      rewardPerShare: (t1 != null && riskPerShare != null) ? pxRound(t1 - entry, px) : null,
      rr: rr == null ? null : Math.round(rr * 100) / 100,
      notes: notes
    };
  }

  /* ── مساعدات ─────────────────────────────────────────────── */
  function R_levels(c) { return levels(c); }

  /* ══════════════════════════════════════════════════════════════
   💰 10) إدارة رأس المال (POSITION SIZING)
   ──────────────────────────────────────────────────────────────
   ⛔ كل الأرقام **افتراضية** — مش توصية.
   ⛔ تكاليف المعاملة غير متاحة ⇒ بنقول كده صراحة.
   ══════════════════════════════════════════════════════════════ */
  function sizingEngine(plan, cfg) {
    cfg = cfg || {};
    var capital = num(cfg.capital);
    var riskPct = num(cfg.riskPct);
    var maxAllocPct = num(cfg.maxAllocPct);
    var out = {
      capital: capital, riskPct: riskPct, maxAllocPct: maxAllocPct,
      riskAmount: null, qty: null, positionValue: null, allocationPct: null,
      estLoss: null, estProfit: null, capped: false,
      costsIncluded: false,
      costsNote: 'TRANSACTION COSTS NOT INCLUDED'
    };
    if (!capital || capital <= 0 || riskPct == null || riskPct <= 0) return out;
    out.riskAmount = capital * riskPct / 100;
    if (!plan || plan.entry == null || plan.stop == null) return out;
    var perShare = plan.entry - plan.stop;
    if (perShare <= 0) return out;          /* ⛔ مخاطرة صفر/سالبة */
    var qty = Math.floor(out.riskAmount / perShare);
    if (!isFinite(qty) || qty <= 0) { out.qty = 0; return out; }
    /* ⛔ ما نتجاوزش سقف التخصيص */
    if (maxAllocPct != null && maxAllocPct > 0) {
      var maxValue = capital * maxAllocPct / 100;
      var maxQty = Math.floor(maxValue / plan.entry);
      if (qty > maxQty) { qty = maxQty; out.capped = true; }
    }
    if (qty <= 0) { out.qty = 0; return out; }
    out.qty = qty;
    out.positionValue = qty * plan.entry;
    out.allocationPct = out.positionValue / capital * 100;
    out.estLoss = qty * perShare;
    out.estProfit = plan.target1 == null ? null : qty * (plan.target1 - plan.entry);
    return out;
  }

  /* ══════════════════════════════════════════════════════════════
   🛡️ 11) إدارة المخاطر (RISK MANAGEMENT)
   ──────────────────────────────────────────────────────────────
   ⛔ مفيش سهم «آمن». التصنيف **نسبي** ضمن الإطار المختار.
   ⛔ التحذيرات بتتولّد من شروط حقيقية — مش قوالب عامة.
   ══════════════════════════════════════════════════════════════ */
  function riskEngine(opts) {
    opts = opts || {};
    var warns = [];
    var flags = {};
    var dq = opts.dq || {};
    var plan = opts.plan || {};
    var vola = opts.volat || {};
    var vol = opts.volume || {};
    var mom = opts.momentum || {};
    var trend = opts.trend || {};
    var sizing = opts.sizing || {};
    var profile = opts.profile || {};

    /* ── الفحوصات ─────────────────────────────────────────── */
    var atrPct = vola.atrPct;
    /* 📊 العتبة معايَرة على السوق: وسيط ATR% في البورصة المصرية ≈ ٥.٤٤٪
       (عيّنة ١١٢ سهم) ⇒ ٨٪ هو الحدّ_HIGH فعلاً، مش ٤.٥٪. */
    if (atrPct != null && atrPct > 8) {
      warns.push({ k: 'atr_high', t: 'ar', msg: 'السهم شديد التذبذب (ATR = ' + round2(atrPct) + '% من السعر)' });
      flags.highAtr = true;
    }
    var liqRank = { 'DEEP': 5, 'LIQUID': 4, 'MODERATE': 3, 'THIN': 2, 'ILLIQUID': 1 };
    var minLiq = profile.minLiquidity || 'MODERATE';
    if (vol.liq && vol.liq !== 'NONE') {
      if ((liqRank[vol.liq] || 0) < (liqRank[minLiq] || 0)) {
        warns.push({ k: 'liquidity_low', t: 'ar', msg: 'السيولة أقل من المستوى المطلوب (' + vol.liq + ')' });
        flags.lowLiquidity = true;
      }
    } else {
      warns.push({ k: 'liquidity_na', t: 'ar', msg: 'السيولة غير قابلة للقياس (مفيش قيمة سوقية)' });
      flags.liquidityUnknown = true;
    }
    if (plan.status === PLAN.NONE) {
      warns.push({ k: 'no_plan', t: 'ar', msg: 'مفيش خطة دخول قابلة للبناء' });
      flags.noPlan = true;
    }
    if (plan.status === PLAN.INVALID) {
      warns.push({ k: 'plan_invalid', t: 'ar', msg: 'الخطة غير صالحة في الاتجاه الحالي' });
      flags.planInvalid = true;
      /* ⛔⛔ «الخطة غير صالحة» مش بنزود بيه نقاط المخاطرة:
         هو حكم على **الإعداد** مش على المخاطرة. (باج: كل سهم
         في هبوط كان بيتصنّف «مخاطرة عالية» لمجرد إن الاتجاه هابط.) */
    }
    if (plan.conflict) {
      warns.push({ k: 'stop_conflict', t: 'ar', msg: 'وقف الخسارة بالـATR وبالهيكل مختلفين — محتاج مراجعة' });
      flags.stopConflict = true;
    }
    if (plan.rr != null && profile.minRR != null && plan.rr < profile.minRR) {
      warns.push({ k: 'rr_low', t: 'ar', msg: 'نسبة العائد إلى المخاطرة غير مناسبة (' + plan.rr + ')' });
      flags.lowRR = true;
    }
    if (plan.rr == null) {
      warns.push({ k: 'rr_na', t: 'ar', msg: 'مفيش هدف متاح ⇒ نسبة العائد للمخاطرة غير محسوبة' });
      flags.noTarget = true;
    }
    if (dq.stale) {
      warns.push({ k: 'stale', t: 'ar', msg: 'البيانات قديمة' });
      flags.stale = true;
    }
    if (opts.suspended) {
      warns.push({ k: 'suspended', t: 'ar', msg: 'السهم متوقف عن التداول' });
      flags.suspended = true;
    }
    /* ⛔ تعارض بين المؤشرات */
    if (trend.state === TREND.UP && mom.dirState && mom.dirState.indexOf('NEGATIVE') >= 0) {
      warns.push({ k: 'trend_mom_conflict', t: 'ar', msg: 'الاتجاه والزخم متعارضان' });
      flags.conflict = true;
    }
    if (vol.score != null && vol.score < 40 && vol.rvol != null && vol.rvol >= 1.5) {
      warns.push({ k: 'distribution', t: 'ar', msg: 'حجم عالي مع هبوط في السعر — سلوك توزيع محتمل' });
      flags.distribution = true;
    }
    if (sizing.capped) {
      warns.push({ k: 'alloc_capped', t: 'ar', msg: 'حجم الصفقة اتقلّل عشان ما يتعداش سقف التخصيص' });
      flags.capped = true;
    }
    if (opts.missingCount && opts.missingCount > 0) {
      warns.push({ k: 'missing', t: 'ar', msg: 'في مؤشرات ناقصة (' + opts.missingCount + ') — النتيجة أقل ثقة' });
      flags.missing = true;
    }
    /* ⛔ بيانات المؤسسات غير متاحة — تنبيه ثابت (دايماً) */
    warns.push({ k: 'institutional_na', t: 'ar',
      msg: 'بيانات نشاط المؤسسات غير متاحة — الأدلة المتاحة من السعر والحجم فقط' });

    /* ── التصنيف ───────────────────────────────────────────── */
    var score = 0;
    if (flags.highAtr) score += 2;
    if (flags.lowLiquidity) score += 2;
    if (flags.liquidityUnknown) score += 1;
    if (flags.noPlan) score += 2;   /* مفيش خطة ⇒ المخاطرة مش متقاسة */
    if (flags.stopConflict) score += 1;
    if (flags.lowRR) score += 2;
    if (flags.noTarget) score += 1;
    if (flags.stale) score += 2;
    if (flags.suspended) score += 3;
    if (flags.conflict) score += 1;
    if (flags.distribution) score += 2;
    if (flags.capped) score += 1;
    if (flags.missing) score += 1;

    var state;
    if (flags.suspended || flags.stale || (dq.sessions != null && dq.sessions < 20)) state = RISK.NA;
    else if (score >= 6) state = RISK.VERY_HIGH;
    else if (score >= 3) state = RISK.HIGH;
    else if (score >= 1) state = RISK.MODERATE;
    else state = RISK.LOWER;

    return { state: state, flags: flags, warnings: warns, riskScore: score };
  }

  /* ══════════════════════════════════════════════════════════════
   🕵️ 12) الدليل الذكي (SMART MONEY EVIDENCE)
   ──────────────────────────────────────────────────────────────
   ⛔⛔⛔ ده **طبقة أدلة** — مش كاشف مؤسسات.
      مفيش عندنا بيانات ملكية مؤسسية ولا تدفق أوامر.
      ⛔ بنقول «نشاط» مش «شراء مؤسسات».
      ⛔ كل مكوّن ليه مصدر + مستوى ثقة — والدرجة محسوبة بثقة مرجّحة.

   📌 درجتها **مش** جزء من الدرجة المركّبة (عشان ما نضاعفش الحجم).
      هي طبقة **تأكيد** مستقلة.
   ══════════════════════════════════════════════════════════════ */
  var SM = {
    STRONG: 'STRONG SUPPORTING EVIDENCE', MODERATE: 'MODERATE SUPPORTING EVIDENCE',
    MIXED: 'MIXED EVIDENCE', WEAK: 'WEAK EVIDENCE', NONE: 'INSUFFICIENT DATA'
  };
  var CONF = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW', NONE: 'NONE' };

  /* 📡 توصية المحللين (TradingView) من -1 (بيع) لـ +1 (شراء) */
  function recToScore(rec) {
    var r = num(rec);
    if (r == null) return null;
    return clamp((r + 1) * 50, 0, 100);
  }

  function smartMoneyEngine(c, opts) {
    opts = opts || {};
    var comps = [];
    var notes = [];

    /* ① توسيع الحجم — من الشموع */
    /* ⛔ الاسم لازم يبقى rv مش rvol — عشان rvol() هي الدالة نفسها
       (لو سمّيناه rvol المتغيّر بيغطّي الدالة وبيطلع TypeError). */
    var rv = c && c.length >= 21 ? rvol(c, 20) : null;
    if (rv != null) {
      var s1 = clamp(50 + (rv - 1) * 30, 0, 100);
      comps.push({ k: 'volume_expansion', label: 'توسّع الحجم',
        src: 'الشموع اليومية · حجم ٢٠ جلسة سابقة',
        conf: 0.6, score: round1(s1),
        detail: 'حجم اليوم ' + round2(rv) + '× متوسط ٢٠ جلسة' });
    }

    /* ② تأكيد السعر بالحجم — السعر صاعد والحجم كبر */
    var move5 = null;
    if (c && c.length >= 6) {
      var p0 = c[c.length - 6].c, p1 = c[c.length - 1].c;
      if (p0 > 0) move5 = (p1 - p0) / p0 * 100;
    }
    if (move5 != null && rv != null) {
      var s2 = (move5 > 0 && rv >= 1.1) ? clamp(60 + Math.min(move5, 10) * 2 + (rv - 1) * 10, 0, 100)
        : (move5 < 0 && rv >= 1.5) ? clamp(30 - Math.min(-move5, 10), 0, 100)
        : clamp(45 + move5, 0, 100);
      comps.push({ k: 'price_volume_confirm', label: 'تأكيد السعر بالحجم',
        src: 'الشموع اليومية · ٥ جلسات',
        conf: 0.6, score: round1(s2),
        detail: (move5 >= 0 ? 'السعر +' : 'السهم −') + round1(Math.abs(move5)) + '% مع حجم ' + round2(rv) + '×' });
    }

    /* ③ توصية المحللين — مصدر مستقل (مش الحجم) */
    var recS = recToScore(opts.rec);
    if (recS != null) {
      var s3 = recS;
      var divBonus = 0;
      /* ⛔⛔ الانفصال: المحللين إيجابيين والسعر واقف ⇒ تموضع قبل الحركة */
      if (recS >= 60 && move5 != null && move5 <= 0.2) { s3 = clamp(s3 + 12, 0, 100); divBonus = 12; }
      comps.push({ k: 'analyst_alignment', label: 'اتفاق المحللين',
        src: 'توصية المحللين · TradingView',
        conf: 0.4, score: round1(s3),
        detail: (opts.rec >= 0.15 ? 'توصية إيجابية' : (opts.rec <= -0.15 ? 'توصية سلبية' : 'توصية محايدة')) +
          (divBonus ? ' · مع انفصال عن السعر (تموضع قبل الحركة)' : '') });
    }

    /* ④ شذوذ الدوران — حجم التداول ÷ حجم السهمOutstanding مقابل متوسطه */
    var mc = num(opts.marketCap), px = num(opts.price) || (c && c.length ? c[c.length - 1].c : null);
    if (mc && mc > 0 && px && px > 0 && c && c.length >= 21) {
      var shares = mc / px;
      var v = volumes(c);
      var avgV = sma(v.slice(0, v.length - 1), 20);
      if (avgV && avgV > 0) {
        var toAvg = (avgV / shares) * 100;
        var toNow = (v[v.length - 1] / shares) * 100;
        var ratio = toAvg > 0 ? toNow / toAvg : null;
        if (ratio != null) {
          var s4 = clamp(50 + (ratio - 1) * 35, 0, 100);
          comps.push({ k: 'turnover_anomaly', label: 'شذوذ الدوران',
            src: 'الحجم + القيمة السوقية · TradingView',
            conf: 0.5, score: round1(s4),
            detail: 'دوران اليوم ' + round2(toNow) + '% مقابل متوسط ' + round2(toAvg) + '%' });
        }
      }
    }

    /* ⑤ بيانات المؤسسات — غير متاحة ⛔ */
    var institutional = null;
    notes.push('INSTITUTIONAL DATA UNAVAILABLE');

    /* ── الدرجة بثقة مرجّحة ───────────────────────────────── */
    var wsum = 0, acc = 0;
    for (var i = 0; i < comps.length; i++) {
      wsum += comps[i].conf;
      acc += comps[i].score * comps[i].conf;
    }
    var score = wsum > 0 ? round1(clamp(acc / wsum, 0, 100)) : null;
    var confLevel = CONF.NONE;
    if (wsum >= 1.2) confLevel = CONF.HIGH;
    else if (wsum >= 0.6) confLevel = CONF.MEDIUM;
    else if (wsum > 0) confLevel = CONF.LOW;

    var state;
    if (score == null) state = SM.NONE;
    else if (score >= 70) state = SM.STRONG;
    else if (score >= 55) state = SM.MODERATE;
    else if (score >= 40) state = SM.MIXED;
    else state = SM.WEAK;

    return {
      state: state, score: score, confidence: confLevel,
      components: comps, institutional: institutional,
      institutionalAvailable: false,
      notes: notes,
      /* ⛔ تنبيه ثابت: الحجم العالي مش إثبات شراء مؤسسات */
      disclaimer: 'حجم عالي ≠ شراء مؤسسات. الأدلة المتاحة من السعر والحجم وتوصية المحللين فقط.'
    };
  }

  /* ══════════════════════════════════════════════════════════════
   🎚️ 13) بروفايلات الاستراتيجية
   ──────────────────────────────────────────────────────────────
   📌 كل قاعدة موثّقة. ⛔ مفيش بروفايل «الأفضل» — دي أدوات مختلفة.
   📌 الأوزان **بتتخزّن هنا** مش متفرقة في الكود.
   ══════════════════════════════════════════════════════════════ */
  var STRATEGY_VERSION = '1.0.0';

  var PROFILES = {
    conservative: {
      key: 'conservative', name: 'محافظ', nameEn: 'Conservative',
      desc: 'تأكيد أقوى للاتجاه · سيولة أعلى · مخاطرة أقل',
      descEn: 'Stronger trend confirmation, higher liquidity, lower risk',
      trendAllowed: ['UPTREND'],
      minTrendScore: 62, minMomentumScore: 58, minVolumeScore: 48,
      maxAtrPct: 6.0, minRvol: 1.1, minLiquidity: 'LIQUID', minRR: 2.0,
      requireVolumeConfirm: 1.3, requirePlan: true, maxRisk: 'MODERATE RISK',
      minComposite: 66,
      weights: { trend: 40, momentum: 25, volume: 20, risk: 15 }
    },
    balanced: {
      key: 'balanced', name: 'متوازن', nameEn: 'Balanced',
      desc: 'توازن بين التأكيد والمخاطرة',
      descEn: 'Balanced confirmation and risk criteria',
      trendAllowed: ['UPTREND', 'TREND TRANSITION'],
      minTrendScore: 48, minMomentumScore: 45, minVolumeScore: 40,
      maxAtrPct: 8.0, minRvol: 1.0, minLiquidity: 'MODERATE', minRR: 1.5,
      requireVolumeConfirm: 1.2, requirePlan: true, maxRisk: 'MODERATE RISK',
      minComposite: 58,
      weights: { trend: 35, momentum: 25, volume: 20, risk: 20 }
    },
    trend: {
      key: 'trend', name: 'اتجاه', nameEn: 'Trend Following',
      desc: 'الاتجاه هو المحور · الزخم والحجم يأكّدوا · الوقف على ATR',
      descEn: 'Directional trend is central; momentum and volume confirm',
      trendAllowed: ['UPTREND', 'TREND TRANSITION'],
      minTrendScore: 55, minMomentumScore: 50, minVolumeScore: 38,
      maxAtrPct: 10.0, minRvol: 0.9, minLiquidity: 'MODERATE', minRR: 1.5,
      requireVolumeConfirm: 1.1, requirePlan: true, maxRisk: 'HIGH RISK',
      minComposite: 60,
      weights: { trend: 45, momentum: 20, volume: 15, risk: 20 }
    }
  };

  function getProfile(key) {
    return PROFILES[key] || PROFILES.balanced;
  }

  /* ══════════════════════════════════════════════════════════════
   🧮 14) الدرجة المركّبة + إعادة توزيع الأوزان
   ──────────────────────────────────────────────────────────────
   ⛔ المؤشر الناقص **مش** صفر — بيتشال، والوزن بيتوزّع على الباقي.
   ⛔ لو الباقي مش كفاية ⇒ مفيش درجة مركّبة (مش درجة ناقصة).
   ══════════════════════════════════════════════════════════════ */
  var COMPONENTS = ['trend', 'momentum', 'volume', 'risk'];

  function compositeScore(scores, profile, available) {
    profile = profile || PROFILES.balanced;
    var w = profile.weights || {};
    var used = {}, missing = [], wsum = 0, acc = 0, adjW = {};
    for (var i = 0; i < COMPONENTS.length; i++) {
      var k = COMPONENTS[i];
      var v = scores ? scores[k] : null;
      var base = w[k] || 0;
      if (v == null || !isFinite(v)) {
        missing.push(k);
        continue;
      }
      used[k] = v;
      wsum += base;
    }
    /* ⛔ مفيش حد أدنى من المؤشرات ⇒ مفيش درجة */
    var minNeeded = 3;
    if (wsum <= 0 || Object.keys(used).length < minNeeded) {
      return {
        total: null, used: used, missing: missing, weights: {}, adjusted: {},
        completeness: available && available.total ? Math.round(Object.keys(used).length / available.total * 100) : 0,
        insufficient: true, reason: Object.keys(used).length < minNeeded ? 'insufficient_indicators' : 'no_weights'
      };
    }
    /* 📊 إعادة التوزيع متناسبة */
    for (var j = 0; j < COMPONENTS.length; j++) {
      var kk = COMPONENTS[j];
      if (used[kk] == null) continue;
      var nw = (w[kk] || 0) / wsum * 100;   /* وزن موزّع بالـ% */
      adjW[kk] = Math.round(nw * 10) / 10;
      /* ⛔⛔ لازم نقسم على ١٠٠ — nw percentage مش كسر.
         (باج: الدرجة كانت ٨٤٥٠ بدل ٨٤.٥) */
      acc += used[kk] * nw / 100;
    }
    var total = Math.round(acc * 10) / 10;
    return {
      total: total, used: used, missing: missing,
      weights: w, adjusted: adjW,
      completeness: available && available.total ? Math.round(Object.keys(used).length / available.total * 100) : 0,
      insufficient: false, reason: null
    };
  }

  /* ══════════════════════════════════════════════════════════════
   🏷️ 15) التصنيف النهائي
   ──────────────────────────────────────────────────────────────
   ⛔ مش بنجبر أي سهم يدخل صفقة.
   A مرشح قوي · B محتاج تأكيد · C مخاطرة عالية
   D مفيش_SETUP حالياً · E بيانات ناقصة
   ══════════════════════════════════════════════════════════════ */
  var CLASS = {
    A: 'STRONG ANALYTICAL CANDIDATE',
    B: 'CANDIDATE — NEEDS CONFIRMATION',
    C: 'HIGH RISK',
    D: 'NO CURRENT SETUP',
    E: 'INSUFFICIENT DATA'
  };

  function classify(r, profile) {
    profile = profile || PROFILES.balanced;
    var reasons = [], missing = [];

    /* ── E: بيانات ناقصة ─────────────────────────────────── */
    var dq = r.dq || {};
    if (!dq.usable || (dq.sessions != null && dq.sessions < DQ.MIN_TREND)) {
      return { code: 'E', state: CLASS.E, reasons: [], failed: [], missing: missing };
    }
    if (r.score && r.score.insufficient) {
      return { code: 'E', state: CLASS.E, reasons: [], failed: [],
        missing: ['عدد المؤشرات المتاحة أقل من الحد الأدنى (' + r.score.reason + ')'] };
    }

    var tr = r.trend || {}, mom = r.momentum || {}, vol = r.volume || {}, vola = r.volatility || {};
    var plan = r.plan || {}, risk = r.risk || {}, sm = r.smart || {};

    /* ── الشروط المطلوبة ──────────────────────────────────── */
    var ok = [];
    var fail = [];

    /* 📌 كل شرط متصنّف:
       core    = أساس التحليل (اتجاه/زخم/حجم/درجة) — ٥ شروط
       confirm = شروط التأكيد (تذبذب/حجم نسبي/سيولة/عائد/خطة) — ٥ شروط
       risk    = شرط المخاطرة — ١
       ⛔ التصنيف بيتبني على المجموعات دي مش على عدد الفاشل. */
    var groups = { core: [], confirm: [], risk: [] };
    function check(name, cond, whyFail, group) {
      if (cond) { ok.push(name); groups[group].push(true); }
      else {
        fail.push(name); missing.push(whyFail || name); groups[group].push(false);
      }
    }
    function corePass() { return groups.core.filter(Boolean).length; }
    function confirmPass() { return groups.confirm.filter(Boolean).length; }

    check('الاتجاه ' + (profile.trendAllowed.join(' أو ')),
      profile.trendAllowed.indexOf(tr.state) >= 0,
      'الاتجاه الحالي «' + (tr.state || 'غير متاح') + '» مش ضمن شروط البروفايل', 'core');
    check('درجة الاتجاه ≥ ' + profile.minTrendScore,
      tr.score != null && tr.score >= profile.minTrendScore,
      'درجة الاتجاه ' + (tr.score == null ? 'غير متاحة' : tr.score) + ' أقل من ' + profile.minTrendScore, 'core');
    check('درجة الزخم ≥ ' + profile.minMomentumScore,
      mom.score != null && mom.score >= profile.minMomentumScore,
      'درجة الزخم ' + (mom.score == null ? 'غير متاحة' : mom.score) + ' أقل من ' + profile.minMomentumScore, 'core');
    check('درجة الحجم ≥ ' + profile.minVolumeScore,
      vol.score != null && vol.score >= profile.minVolumeScore,
      'درجة الحجم ' + (vol.score == null ? 'غير متاحة' : vol.score) + ' أقل من ' + profile.minVolumeScore, 'core');
    check('التذبذب ≤ ' + profile.maxAtrPct + '%',
      vola.atrPct != null && vola.atrPct <= profile.maxAtrPct,
      'التذبذب ' + (vola.atrPct == null ? 'غير متاح' : vola.atrPct + '%') + ' أعلى من المسموح', 'confirm');
    check('الحجم النسبي ≥ ' + profile.minRvol,
      vol.rvol != null && vol.rvol >= profile.minRvol,
      'الحجم النسبي ' + (vol.rvol == null ? 'غير متاح' : vol.rvol) + ' أقل من ' + profile.minRvol, 'confirm');
    var liqRank = { 'DEEP': 5, 'LIQUID': 4, 'MODERATE': 3, 'THIN': 2, 'ILLIQUID': 1 };
    check('السيولة ≥ ' + profile.minLiquidity,
      vol.liq && vol.liq !== 'NONE' && (liqRank[vol.liq] || 0) >= (liqRank[profile.minLiquidity] || 0),
      'السيولة ' + (vol.liq || 'غير متاحة') + ' أقل من ' + profile.minLiquidity, 'confirm');
    check('نسبة العائد ≥ ' + profile.minRR,
      plan.rr != null && plan.rr >= profile.minRR,
      plan.rr == null ? 'مفيش هدف ⇒ نسبة العائد غير محسوبة' : 'نسبة العائد ' + plan.rr + ' أقل من ' + profile.minRR, 'confirm');
    if (profile.requirePlan) {
      /* ⛔⛔ المطلوب: خطة **موجودة ومش ملغاة** — مش إن شرط الدخول اشتغل.
         (باج: «في انتظار تأكيد» كان بيخلي التصنيف A مستحيل —
          لأن السعر لازم يكون داخل منطقة الدخول *دلوقتي*، وده
          شرط توقيت مش شرط تحليلي.)
         ⛔ بس «الخطة ملغاة» (اتجاه هابط) أو «مفيش خطة» ⇒ بتفشل. */
      var planOk = plan.status && plan.status !== PLAN.NONE && plan.status !== PLAN.INVALID;
      check('خطة دخول صالحة', planOk,
        plan.status === PLAN.INVALID ? 'الخطة ملغاة (الاتجاه الحالي لا يسمح)'
          : (plan.status === PLAN.NONE ? 'مفيش خطة دخول قابلة للبناء' : 'الخطة: ' + plan.status), 'confirm');
    }
    var riskOrder = { 'LOWER RELATIVE RISK': 0, 'MODERATE RISK': 1, 'HIGH RISK': 2, 'VERY HIGH RISK': 3, 'RISK NOT ASSESSABLE': 4 };
    var maxRisk = riskOrder[profile.maxRisk] == null ? 2 : riskOrder[profile.maxRisk];
    check('المخاطرة ≤ ' + profile.maxRisk,
      risk.state && riskOrder[risk.state] != null && riskOrder[risk.state] <= maxRisk,
      'المخاطرة: ' + (risk.state || 'غير متاحة'), 'risk');
    check('الدرجة المركّبة ≥ ' + profile.minComposite,
      r.score && r.score.total != null && r.score.total >= profile.minComposite,
      'الدرجة المركّبة ' + (r.score && r.score.total != null ? r.score.total : 'غير متاحة') + ' أقل من ' + profile.minComposite, 'core');

    /* ── A: كل الشروط مستوفاة ────────────────────────────── */
    if (fail.length === 0) {
      return { code: 'A', state: CLASS.A, reasons: ok, failed: [], missing: [] };
    }
    /* ── C: «يبدو كويس بس خطور» ────────────────────────────
       ⛔ لازم الأساس التحليلي كله يمر (اتجاه+زخم+حجم+درجة)
          وإلا السهم مش «مرشح بجهد مخاطرة» — ده «مفيش_setup». */
    var risky = risk.state === RISK.VERY_HIGH || risk.state === RISK.HIGH;
    if (corePass() === groups.core.length && risky) {
      return { code: 'C', state: CLASS.C, reasons: ok, failed: fail, missing: missing };
    }
    /* ── B: أساس جيد + ناقص تأكيد ───────────────────────── */
    if (corePass() >= groups.core.length - 1 && confirmPass() >= 3) {
      return { code: 'B', state: CLASS.B, reasons: ok, failed: fail, missing: missing };
    }
    /* ── D: مفيش_SETUP حالياً ─────────────────────────────── */
    return { code: 'D', state: CLASS.D, reasons: ok, failed: fail, missing: missing };
  }

  /* ══════════════════════════════════════════════════════════════
   🛰️ 16) المنسّق (ORCHESTRATOR) — المسار الكامل
   ──────────────────────────────────────────────────────────────
   📌 الترتيب المنطقي (ثابت):
      جودة البيانات → الاتجاه → الزخم → الحجم → التذبذب
      → الدليل الذكي → الخطة → المخاطرة → الدرجة → التصنيف

   ⛔ لو أي مرحلة رجّعت «ناقص» ⇒ بتنتقل زي ما هي.
      مافيش أي مرحلة بتخترع رقم.
   ══════════════════════════════════════════════════════════════ */
  function analyze(candles, meta) {
    meta = meta || {};
    var profile = getProfile(meta.profile);
    var dq = dataQuality(candles);
    var c = cleanCandles(candles).candles;

    var trend = trendEngine(c, dq, {});
    var momentum = momentumEngine(c, dq, {});
    var volume = volumeEngine(c, dq, { marketCap: meta.marketCap, price: meta.price });
    var volatility = volatilityEngine(c, dq, {});
    var smart = smartMoneyEngine(c, {
      rec: meta.rec, marketCap: meta.marketCap, price: meta.price
    });

    var planCfg = defaultPlanCfg(meta.planCfg || {});
    planCfg.requireVolumeConfirm = profile.requireVolumeConfirm;
    var plan = planEngine(c, trend, volume, volatility, planCfg);

    var money = meta.money || {};
    var sizing = sizingEngine(plan, money);

    var risk = riskEngine({
      dq: dq, plan: plan, volat: volatility, volume: volume,
      momentum: momentum, trend: trend, sizing: sizing,
      profile: profile, suspended: !!meta.suspended,
      missingCount: [trend.score, momentum.score, volume.score, volatility.score]
        .filter(function (x) { return x == null; }).length
    });

    var scores = {
      trend: trend.score, momentum: momentum.score,
      volume: volume.score, risk: volatility.score
    };
    var score = compositeScore(scores, profile, { total: COMPONENTS.length });

    /* ⛔⛔ بيانات قديمة ⇒ مفيش درجة إطلاقاً.
       (باج: سهام شمعته من ٣ أشهر كانت بتتصدّر الترتيب بدرجة ٨٤.٥
       — والمؤشرات بتتكلم عن زمن فات.) */
    if (dq.stale) {
      score = {
        total: null, used: score.used, missing: score.missing,
        weights: score.weights, adjusted: score.adjusted,
        completeness: score.completeness, insufficient: true,
        reason: 'stale_data'
      };
    }

    var cls = classify({
      dq: dq, trend: trend, momentum: momentum, volume: volume,
      volatility: volatility, plan: plan, risk: risk, score: score, smart: smart
    }, profile);

    return {
      code: meta.code || '',
      name: meta.name || '',
      sector: meta.sector || '',
      price: meta.price != null ? meta.price : (c.length ? c[c.length - 1].c : null),
      change: meta.change != null ? meta.change : null,
      rec: meta.rec != null ? meta.rec : null,
      dq: dq, trend: trend, momentum: momentum, volume: volume,
      volatility: volatility, smart: smart, plan: plan, sizing: sizing,
      risk: risk, score: score, classification: cls,
      profile: profile, strategyVersion: STRATEGY_VERSION,
      dataTimestamp: dq.lastDate
    };
  }

  /* ══════════════════════════════════════════════════════════════
   🔬 8) جودة البيانات — ناقصة أم متاحة
   ══════════════════════════════════════════════════════════════ */

  return {
    /* أدوات */
    num: num, clamp: clamp, round1: round1, round2: round2, pxRound: pxRound, pxDec: pxDec,
    /* جود�� البيانات */
    DQ: DQ, cleanCandles: cleanCandles, dataQuality: dataQuality, hasRealMovement: hasRealMovement,
    /* مؤشرات */
    sma: sma, ema: ema, emaSeries: emaSeries, rsi: rsi, rsiSeries: rsiSeries,
    macd: macd, atr: atr, atrSeries: atrSeries, atrPct: atrPct, adx: adx,
    rvol: rvol, volumeStats: volumeStats, avgRange: avgRange,
    /* بنية */
    swings: swings, structureBias: structureBias, levels: levels,
    /* محركات التصنيف */
    TREND: TREND, MOM: MOM, VOL: VOL, VOLAT: VOLAT, LIQ: LIQ,
    PLAN: PLAN, RISK: RISK,
    trendEngine: trendEngine, momentumEngine: momentumEngine,
    volumeEngine: volumeEngine, volatilityEngine: volatilityEngine,
    /* الخطة والمخاطرة */
    defaultPlanCfg: defaultPlanCfg, planEngine: planEngine,
    sizingEngine: sizingEngine, riskEngine: riskEngine,
    /* الدليل الذكي + البروفايلات + الدرجة + التصنيف */
    SM: SM, CONF: CONF, recToScore: recToScore, smartMoneyEngine: smartMoneyEngine,
    PROFILES: PROFILES, getProfile: getProfile, STRATEGY_VERSION: STRATEGY_VERSION,
    COMPONENTS: COMPONENTS, compositeScore: compositeScore,
    CLASS: CLASS, classify: classify,
    /* المنسّق */
    analyze: analyze
  };
});
