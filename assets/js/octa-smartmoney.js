/* ══════════════════════════════════════════════════════════════
   🐙 OCTA — محرك Smart Money (المحاور الأربعة + المؤشرات الثلاثة)
   ──────────────────────────────────────────────────────────────
   الملف ده **منطق نقي**: مافيش DOM · مافيش شبكة · مافيش عرض.
   كل الأرقام بتتحسب بقواعد ثابتة (مش تخمين) عشان النتيجة
   تتكرّر نفس الشيء كل مرة.

   📌 ليه منفصل عن الملف التاني (octa-money.js)؟
      عشان يتشغّل في Node والاختبارات تعدّل الأرقام لوحدها
      من غير متصفح.

   📐 المحاور الأربعة (الأساس):
      ① الاتجاه   — السعر فوق المتوسطات · الأداء
      ② الزخم     — RSI · MACD · أدائه قصير المدى
      ③ التذبذب   — سرعة التغيّر (الجودة مش الكمية)
      ④ الحجم     — ضغط التدفق والسيولة

   📌 القسمة: 0 → 100 لكل محور، والنتيجة = تجميع مرجّح + مكافأة توافق.

   ⛔ ممنوع: أي اسم أداة ذكاء اصطناعي في الكود أو في التعليقات.
      الاسم العام: «محرك OCTA».
   ══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OCTA_SM = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ══════════ أدوات صغيرة ══════════ */
  function n(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var x = Number(v);
    return isFinite(x) ? x : null;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function round0(v) { return Math.round(v); }

  /* أول قيمة موجودة من القايمة (لأن أسماء الحقول بتختلف من مصدر لمصدر) */
  function pick() {
    for (var i = 0; i < arguments.length; i++) {
      var v = n(arguments[i]);
      if (v != null) return v;
    }
    return null;
  }

  /* ══════════════════════════════════════════════════════════════
   🧩 دمج المصادر — صف واحد جاهز للمحرك
   ──────────────────────────────────────────────────────────────
   المصادر الثلاثة (كل واحد بيكمل التاني):
     ① /api/markets?market=egypt   → سعر · حجم · تقلب · سيولة
     ② /api/market_tech?market=egypt → RSI · MACD · SMA200 · حجم نسبي
     ③ OS_DB (من /api/data_full)    → احتياطي: RSI · متوسطات · أداء
   ══════════════════════════════════════════════════════════════ */
  function merge(row, tech, db) {
    row = row || {}; tech = tech || {}; db = db || {};
    var m = {
      code: row.code || db.code || tech.code || '',
      name: row.name || db.name || '',
      sector: row.sector || db.sectorAr || db.sector || '',

      price: pick(row.price, db.price, tech.p),
      change: pick(row.change, db.change),
      volume: pick(row.volume, db.volume),

      /* الزخم */
      rsi: pick(tech.rsi, db.rsi, row.rsi),
      macd: pick(tech.macd, db.macd, row.macd),
      macdSig: pick(tech.macdSig, db.macdSignal, row.macdSig, row.macd_signal),
      stochK: pick(tech.stoch_k, row.stoch_k),
      cci: pick(tech.cci20, row.cci20),

      /* الاتجاه */
      ma50: pick(db.ma50, tech.ma50, row.ma50, row.sma50),
      ma200: pick(tech.sma200, db.ma200, row.ma200, row.sma200),
      ema20: pick(row.ema20, tech.ema20),
      ema50: pick(row.ema50, tech.ema50),
      adx: pick(row.adx, tech.adx),

      /* التذبذب */
      volD: pick(tech.volD, row.volD, row.volatility, db.volatility),
      beta: pick(row.beta, db.beta, tech.beta),
      atr: pick(row.atr, tech.atr),
      mdd: pick(db.mdd, row.mdd),

      /* الحجم والسيولة */
      relvol: pick(tech.relvol, db.relvol, row.rel_volume, row.relvol),
      av30: pick(tech.av30, db.av30, row.av30),
      mktCap: pick(row.mkt_cap, row.mktCap, db.mcap, tech.mc),
      freeFloat: pick(db.freeFloat, row.float),
      turnover: null,

      /* الأداء */
      perf1w: pick(tech.p1w, row.perf_w, row.perf1w, db.perf1w),
      perf1m: pick(tech.p1m, row.perf_1m, row.perf1m, db.perf1m),
      perf3m: pick(tech.p3m, row.perf_3m, row.perf3m, db.perf3m),
      perf6m: pick(tech.p6m, row.perf_6m, row.perf6m, db.perf6mV),
      perf1y: pick(tech.p1y, row.perf_y, row.perf1y, db.perf1yV),
      perfYtd: pick(tech.pYtd, row.perf_YTD, row.perfYtd, db.perfYtd),

      /* تقييم المصدر الفني */
      tvRating: pick(row.tv_rating, db.tvRating)
    };

    /* دوران السهم = (حجم × سعر) ÷ القيمة السوقية */
    if (m.volume != null && m.price != null && m.mktCap) {
      m.turnover = (m.volume * m.price) / m.mktCap;
    }
    return m;
  }

  /* ══════════════════════════════════════════════════════════════
   📐 دوال المحاور — كل واحدة بترجع {score, parts}
      parts = تفصيل عشان الكارت يقدر explains ليه الرقم كده
   ══════════════════════════════════════════════════════════════ */

  /* ① الاتجاه — السوق صاعد ولا هابط */
  function axisTrend(m) {
    var p = [];
    var ma200 = m.ma200, ma50 = m.ma50, price = m.price;

    if (ma200 != null && price != null) {
      p.push({ k: 'pos200', w: 0.25, v: price > ma200 ? 1 : (price < ma200 ? 0 : 0.5),
        txt: price > ma200 ? 'السعر فوق متوسط 200 يوم' : 'السعر تحت متوسط 200 يوم' });
    }
    if (ma50 != null && ma200 != null) {
      p.push({ k: 'gc', w: 0.20, v: ma50 > ma200 ? 1 : 0,
        txt: ma50 > ma200 ? 'متوسط 50 فوق 200 — تقاطع ذهبي' : 'متوسط 50 تحت 200 — تقاطع مميت' });
    }
    if (ma50 != null && price != null) {
      p.push({ k: 'pos50', w: 0.15, v: price > ma50 ? 1 : 0,
        txt: price > ma50 ? 'السعر فوق متوسط 50 يوم' : 'السعر تحت متوسط 50 يوم' });
    }
    if (m.perf1m != null) {
      p.push({ k: 'p1m', w: 0.20, v: clamp((m.perf1m + 15) / 30, 0, 1),
        txt: 'أداء شهر ' + round1(m.perf1m) + '%' });
    }
    if (m.perf3m != null) {
      p.push({ k: 'p3m', w: 0.20, v: clamp((m.perf3m + 30) / 60, 0, 1),
        txt: 'أداء 3 شهور ' + round1(m.perf3m) + '%' });
    }
    return pack(p, 'الاتجاه');
  }

  /* ② الزخم — قوة الحركة مع عقوبة التشبع */
  function axisMomentum(m) {
    var p = [];
    var rsi = m.rsi;
    if (rsi != null) {
      /* 30 → 0 · 70 → 100 · فوق 80 عقوبة (تشبع شرائي) */
      var s = clamp((rsi - 30) / 40, 0, 1) * 100;
      if (rsi > 80) s = clamp(s - (rsi - 80) * 2, 0, 100);
      p.push({ k: 'rsi', w: 0.45, v: s / 100,
        txt: 'قوة نسبية ' + round1(rsi) + (rsi > 80 ? ' — تشبع شرائي' : (rsi < 30 ? ' — تشبع بيعي' : '')) });
    }
    if (m.macd != null && m.macdSig != null) {
      var diff = m.macd - m.macdSig;
      var strength = (m.price && m.price > 0) ? clamp(Math.abs(diff) / (m.price * 0.02), 0, 1) : 0.5;
      var v = diff > 0 ? (50 + 50 * strength) : (diff < 0 ? (50 - 50 * strength) : 50);
      p.push({ k: 'macd', w: 0.30, v: v / 100,
        txt: diff > 0 ? 'الـMACD فوق خط الإشارة — صاعد' : (diff < 0 ? 'الـMACD تحت خط الإشارة — هابط' : 'الـMACD على خط الإشارة') });
    }
    if (m.macd != null) {
      p.push({ k: 'macd0', w: 0.10, v: m.macd > 0 ? 1 : 0,
        txt: m.macd > 0 ? 'الـMACD فوق الصفر' : 'الـMACD تحت الصفر' });
    }
    if (m.perf1w != null) {
      p.push({ k: 'p1w', w: 0.15, v: clamp((m.perf1w + 8) / 16, 0, 1),
        txt: 'أداء أسبوع ' + round1(m.perf1w) + '%' });
    }
    return pack(p, 'الزخم');
  }

  /* ③ التذبذب — السرعة الكبيرة مشمتلش · والصغير مافيهوش حركة */
  function axisVolatility(m) {
    var p = [];
    var v = m.volD;
    if (v != null) {
      p.push({ k: 'volD', w: 0.60, v: band(v, 0.8, 1.5, 4.5, 8) / 100,
        txt: 'تقلب يومي ' + round1(v) + '%' + bandNote(v, 1.5, 4.5) });
    }
    if (m.beta != null) {
      p.push({ k: 'beta', w: 0.25, v: band(m.beta, 0.4, 0.6, 1.4, 2.2) / 100,
        txt: 'بيتا ' + round1(m.beta) + ' — ' + (m.beta > 1.4 ? 'أعلى من السوق' : (m.beta < 0.6 ? 'أهدأ من السوق' : 'قريب من حركة السوق')) });
    }
    if (m.mdd != null) {
      p.push({ k: 'mdd', w: 0.15, v: clamp((70 - m.mdd) / 30, 0, 1),
        txt: 'أكبر تراجع سنة ' + round1(m.mdd) + '%' });
    }
    return pack(p, 'التذبذب');
  }

  /* ④ الحجم — ضغط التدفق + السيولة */
  function axisVolume(m) {
    var p = [];
    var r = m.relvol;
    if (r != null) {
      p.push({ k: 'relvol', w: 0.35, v: band(r, 0.5, 0.9, 2.5, 4) / 100,
        txt: 'حجم نسبي ' + round1(r) + '×' + bandNote(r, 0.9, 2.5) });
    }
    if (m.change != null && r != null) {
      var flow = clamp(m.change / 2.5, -1, 1) * clamp(r / 2, 0, 1);
      p.push({ k: 'flow', w: 0.35, v: (50 + 50 * flow) / 100,
        txt: m.change >= 0 ? 'تدفق مع الشراء' : 'تدفق مع البيع' });
    }
    if (m.turnover != null) {
      p.push({ k: 'turn', w: 0.20, v: band(m.turnover, 0.001, 0.005, 0.05, 0.15) / 100,
        txt: 'دوران يومي ' + round1(m.turnover * 100) + '% من القيمة السوقية' });
    }
    if (m.volume != null && m.av30) {
      var vr = m.volume / m.av30;
      p.push({ k: 'vr', w: 0.10, v: band(vr, 0.5, 0.9, 2.2, 4) / 100,
        txt: 'حجم اليوم مقابل متوسط 30 يوم' });
    }
    return pack(p, 'الحجم');
  }

  /* نطاقات: تحت الحد الأدنى → ضعيف · في النطاق المثالي → 100 · فوق → خطر */
  function band(v, vmin, idealLo, idealHi, vmax) {
    if (v == null) return 0;
    if (v <= vmin) return clamp(v / (vmin || 1e-9) * 40, 0, 40);
    if (v < idealLo) return 40 + (v - vmin) / (idealLo - vmin) * 60;
    if (v <= idealHi) return 100;
    if (v < vmax) return 100 - (v - idealHi) / (vmax - idealHi) * 55;
    return clamp(45 - (v - vmax) * 12, 5, 45);
  }
  function bandNote(v, lo, hi) {
    if (v == null) return '';
    if (v < lo) return ' — تحت النطاق المريح';
    if (v > hi) return ' — أعلى من المريح';
    return ' — في النطاق المريح';
  }

  /* تجميع الأجزاء بأوزانها (بإعادة توزيع الوزن على الموجود بس) */
  function pack(parts, label) {
    var wsum = 0, acc = 0;
    for (var i = 0; i < parts.length; i++) {
      wsum += parts[i].w;
      acc += parts[i].w * clamp(parts[i].v, 0, 1);
    }
    return { label: label, score: wsum > 0 ? clamp(acc / wsum * 100, 0, 100) : 50, parts: parts, has: parts.length > 0 };
  }

  /* ══════════════════════════════════════════════════════════════
   🏆 النتيجة النهائية
   ──────────────────────────────────────────────────────────────
   التجميع: اتجاه 30% · زخم 25% · حجم 25% · تذبذب 20%
   + مكافأة توافق (الأسهم اللي المحاور الأربعة بتتفق مع بعض)
   ══════════════════════════════════════════════════════════════ */
  var W = { trend: 0.30, momentum: 0.25, volume: 0.25, volatility: 0.20 };

  function compute(m) {
    var t = axisTrend(m), mo = axisMomentum(m), v = axisVolatility(m), vo = axisVolume(m);
    var base = t.score * W.trend + mo.score * W.momentum + vo.score * W.volume + v.score * W.volatility;

    var vals = [t.score, mo.score, v.score, vo.score];
    var spread = Math.max.apply(null, vals) - Math.min.apply(null, vals);
    var agreement = clamp(1 - spread / 100, 0, 1);
    var bonus = 10 * agreement;

    var score = clamp(base + bonus, 0, 100);
    var minAxis = Math.min.apply(null, vals);

    /* ⛔ التغطية — السهم اللي مافيشلهوش بيانات لازم يتsays «ناقص»
       مش ياخد نتيجة وسيطة (٥٠) ويبقى في نص الترتيب. */
    var covered = (t.has ? 1 : 0) + (mo.has ? 1 : 0) + (v.has ? 1 : 0) + (vo.has ? 1 : 0);
    var weak = covered < 3;

    var badges = [];
    if (weak) badges.push({ id: 'weak', t: 'بيانات ناقصة', ok: 0 });
    if (!weak && minAxis >= 60) badges.push({ id: 'agree', t: 'توافق ٤ محاور', ok: 1 });
    if (!weak && minAxis >= 50 && minAxis < 60) badges.push({ id: 'near', t: 'تقارب كويس', ok: 1 });
    if (m.rsi != null && m.rsi < 30) badges.push({ id: 'oversold', t: 'تشبع بيعي', ok: 0 });
    if (m.rsi != null && m.rsi > 80) badges.push({ id: 'overbought', t: 'تشبع شرائي', ok: 0 });
    var flowPart = vo.parts.filter(function (x) { return x.k === 'flow'; })[0];
    if (flowPart && flowPart.v >= 0.8) badges.push({ id: 'accum', t: 'تجميع مؤسسي', ok: 1 });
    if (flowPart && flowPart.v <= 0.2) badges.push({ id: 'dist', t: 'تصريف مؤسسي', ok: 0 });
    if (m.ma50 != null && m.ma200 != null) {
      if (m.ma50 > m.ma200) badges.push({ id: 'gc', t: 'تقاطع ذهبي', ok: 1 });
      else badges.push({ id: 'dc', t: 'تقاطع مميت', ok: 0 });
    }
    if (m.price != null && m.ma200 != null && m.price < m.ma200) badges.push({ id: 'below200', t: 'تحت متوسط 200', ok: 0 });

    return {
      code: m.code, name: m.name, sector: m.sector,
      price: m.price, change: m.change, m: m,
      axes: { trend: t, momentum: mo, volatility: v, volume: vo },
      base: round1(base), bonus: round1(bonus), agreement: round1(agreement * 100),
      score: round1(score), minAxis: round1(minAxis), spread: round1(spread),
      covered: covered, weak: weak,
      badges: badges
    };
  }

  /* ترتيب كل الأسهم — الناقص البيانات بينزل تحت الكل (مش في نص الترتيب) */
  function rank(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var r = compute(list[i]);
      if (r.code) out.push(r);
    }
    out.sort(function (a, b) {
      if (a.weak !== b.weak) return a.weak ? 1 : -1;
      return b.score - a.score;
    });
    return out;
  }

  /* ══════════════════════════════════════════════════════════════
   🔬 المؤشرات الثلاثة — من الشموع اليومية (محتاج تاريخ)
   ──────────────────────────────────────────────────────────────
   ⛔ دي نسخ OCTA من مؤشرات TradingView المدفوعة/المغلقة
      (مش متاحة في الـscreener العام). الحساب كله قواعد ثابتة
      على بيانات OHLCV حقيقية.
   ══════════════════════════════════════════════════════════════ */

  function ema(arr, len) {
    if (!arr.length) return null;
    var k = 2 / (len + 1), e = arr[0];
    for (var i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
    return e;
  }
  function sma(arr, len) {
    if (!arr.length) return null;
    var s = 0, c = 0;
    for (var i = Math.max(0, arr.length - len); i < arr.length; i++) { s += arr[i]; c++; }
    return c ? s / c : null;
  }

  /* متوسط متحرك لمصوفة */
  function ma(arr, len) {
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      if (i < len - 1) { out.push(null); continue; }
      var s = 0;
      for (var j = i - len + 1; j <= i; j++) s += arr[j];
      out.push(s / len);
    }
    return out;
  }

  /* متوسط المدى الحقيقي */
  function atr(c, len) {
    if (c.length < 2) return null;
    var tr = [];
    for (var i = 1; i < c.length; i++) {
      var pc = c[i - 1].c;
      tr.push(Math.max(c[i].h - c[i].l, Math.abs(c[i].h - pc), Math.abs(c[i].l - pc)));
    }
    return ema(tr, len);
  }

  /* ① LS3 Gemini — Banker Fund Oscillator (نسخة OCTA)
     تقاطع بين تدفق الأموال قصير المدى (٥) ومتوسط المدى (٢٠)
     القيمة 0..100 · تحت ٢٠ تشبع بيعي · فوق ٨٠ تشبع شرائي */
  function gemini(c) {
    if (!c || c.length < 25) return null;
    var mf = [], vs = [];
    for (var i = 0; i < c.length; i++) vs.push(c[i].v || 0);
    var av = sma(vs, 20) || 1;
    for (i = 0; i < c.length; i++) {
      var rng = (c[i].h - c[i].l);
      var m = rng > 0 ? ((c[i].c - c[i].l) - (c[i].h - c[i].c)) / rng : 0;
      mf.push(m * (c[i].v || 0) / av);
    }
    var st = ema(mf.slice(-40), 5), mt = ema(mf.slice(-40), 20);
    if (st == null || mt == null) return null;
    var spread = (st - mt) / (Math.abs(st) + Math.abs(mt) + 1e-9);
    var value = clamp(50 + 50 * spread, 0, 100);
    var state = value >= 80 ? 'overbought' : (value <= 20 ? 'oversold' : (st > mt ? 'bull' : 'bear'));
    return { value: round1(value), state: state, short: st, mid: mt, spread: round1(spread * 100) };
  }

  /* ② The Lock — حجم-money (نسخة OCTA)
     الأعمدة: موجب = مؤسسية دخلت · سالب = مؤسسية خرجت
     مفيش أعمدة = المؤسسات بتسحب */
  function lock(c) {
    if (!c || c.length < 25) return null;
    var vs = [], svs = [];
    for (var i = 0; i < c.length; i++) vs.push(c[i].v || 0);
    var av = sma(vs, 20) || 1;
    for (i = 1; i < c.length; i++) {
      var d = c[i].c - c[i - 1].c;
      svs.push((d > 0 ? 1 : (d < 0 ? -1 : 0)) * (c[i].v || 0) / av);
    }
    var last5 = svs.slice(-5), last3 = svs.slice(-3);
    var sum5 = last5.reduce(function (a, b) { return a + b; }, 0);
    var sum3 = last3.reduce(function (a, b) { return a + b; }, 0);
    var state = 'flat';
    if (sum5 > 0.3) state = 'in';
    else if (sum5 < -0.3) state = 'out';
    if (sum3 <= 0 && sum5 <= 0) state = 'out';
    var strength = round1(clamp(50 + 50 * (sum5 / 5), 0, 100));
    var bars = svs.slice(-12).map(function (v) { return round1(v); });
    return { state: state, strength: strength, sum5: round1(sum5), bars: bars };
  }

  /* ③ MCDX — Control of the market (نسخة OCTA)
     0..50 الأفراد مسيطرة · 50..100 المؤسسات مسيطرة
     التقاطع الذهبي = إشارة دخول · التقاطع المميت = المؤسسات بتسحب */
  function mcdx(c, m) {
    if (!c || c.length < 25) return null;
    var vs = [], mf = [];
    for (var i = 0; i < c.length; i++) vs.push(c[i].v || 0);
    var av = sma(vs, 20) || 1;
    for (i = 0; i < c.length; i++) {
      var rng = (c[i].h - c[i].l);
      var mm = rng > 0 ? ((c[i].c - c[i].l) - (c[i].h - c[i].c)) / rng : 0;
      mf.push(mm * (c[i].v || 0) / av);
    }
    var recent = mf.slice(-20);
    var acc = recent.reduce(function (a, b) { return a + b; }, 0) / (recent.length || 1);
    var inst = clamp(50 + 50 * (acc / 2), 0, 100);

    var cross = 'none';
    if (m && m.ma50 != null && m.ma200 != null) {
      if (m.ma50 > m.ma200) { inst = clamp(inst + 8, 0, 100); cross = 'gc'; }
      else { inst = clamp(inst - 8, 0, 100); cross = 'dc'; }
    }
    var gap = round1(Math.abs(inst - 50));
    var state = inst >= 60 ? 'inst' : (inst <= 40 ? 'retail' : 'mixed');
    return { value: round1(inst), gap: gap, state: state, cross: cross };
  }

  /* 🏗️ البنية — BOS و CHoC
     كسر السقف = BOS · كسر عكس الاتجاه = تغيّر الطابع
     ⛔ في الاتجاه القوي مفيش قمم ولا أرض (كل شمعة أعلى من اللي قبلها)
        ⇒ لازم يكون عندنا احتياطي، وإلا البنية بترجع null والكارت يبقى فاضي. */
  function structure(c) {
    if (!c || c.length < 30) return null;
    var swingHi = [], swingLo = [];
    for (var i = 2; i < c.length - 2; i++) {
      if (c[i].h > c[i - 1].h && c[i].h > c[i + 1].h && c[i].h > c[i - 2].h && c[i].h > c[i + 2].h) swingHi.push({ i: i, v: c[i].h });
      if (c[i].l < c[i - 1].l && c[i].l < c[i + 1].l && c[i].l < c[i - 2].l && c[i].l < c[i + 2].l) swingLo.push({ i: i, v: c[i].l });
    }

    var price = c[c.length - 1].c;
    var win = c.slice(-20);
    var hi20 = Math.max.apply(null, win.map(function (x) { return x.h; }));
    var lo20 = Math.min.apply(null, win.map(function (x) { return x.l; }));

    /* الاتجاه: من القمم/الأرض لو موجودة · وإلا من مقارنة المتوسطات */
    var up;
    if (swingHi.length >= 2 && swingLo.length >= 2) {
      var lastHi = swingHi[swingHi.length - 1], prevHi = swingHi[swingHi.length - 2];
      var lastLo = swingLo[swingLo.length - 1], prevLo = swingLo[swingLo.length - 2];
      up = (lastHi.v > prevHi.v) || (lastLo.v > prevLo.v);
    } else {
      var recent = sma(c.slice(-10).map(function (x) { return x.c; }), 10);
      var older = sma(c.slice(-30, -10).map(function (x) { return x.c; }), 20);
      up = recent != null && older != null ? (recent > older) : (price > (hi20 + lo20) / 2);
    }

    /* المستويات: آخر قمة/أرض · لو مفيش → حدود آخر 20 يوم */
    var resLevel = null, supLevel = null;
    for (i = swingHi.length - 1; i >= 0; i--) { if (swingHi[i].v > price) { resLevel = swingHi[i].v; break; } }
    for (i = swingLo.length - 1; i >= 0; i--) { if (swingLo[i].v < price) { supLevel = swingLo[i].v; break; } }
    if (resLevel == null) resLevel = hi20 > price ? hi20 : null;
    if (supLevel == null) supLevel = lo20 < price ? lo20 : null;
    var lastSwingHi = swingHi.length ? swingHi[swingHi.length - 1].v : hi20;
    var lastSwingLo = swingLo.length ? swingLo[swingLo.length - 1].v : lo20;

    var state = 'range', bos = null, choc = null;
    if (up) {
      if (price > lastSwingHi) { state = 'bull'; bos = 'up'; }
      else if (price < lastSwingLo) { state = 'bear'; choc = 'down'; }
      else state = 'bull';
    } else {
      if (price < lastSwingLo) { state = 'bear'; bos = 'down'; }
      else if (price > lastSwingHi) { state = 'bull'; choc = 'up'; }
      else state = 'bear';
    }
    return {
      state: state, bos: bos, choc: choc,
      support: supLevel, resistance: resLevel,
      label: bos === 'up' ? 'كسر السقف — اتجاه صاعد' :
             bos === 'down' ? 'كسر الأرض — اتجاه هابط' :
             choc === 'up' ? 'تغيّر الطابع — ارتداد صاعد' :
             choc === 'down' ? 'تغيّر الطابع — ارتداد هابط' :
             up ? 'اتجاه صاعد — لسه مكسرش' : 'اتجاه هابط — لسه مكسرش'
    };
  }

  /* كل التحليلات اللي محتاجة شموع */
  function fromCandles(candles, m) {
    var c = (candles || []).filter(function (x) { return x && x.c != null && x.h != null && x.l != null; });
    if (c.length < 25) return null;
    var a = atr(c, 14);
    var price = c[c.length - 1].c;
    var out = {
      n: c.length,
      gemini: gemini(c),
      lock: lock(c),
      mcdx: mcdx(c, m),
      structure: structure(c),
      atr: a != null ? round1(a) : null,
      atrPct: (a != null && price) ? round1(a / price * 100) : null,
      levels: null
    };
    if (a != null && price) {
      var up = !(out.structure && out.structure.state === 'bear');
      out.levels = {
        entry: round1(price),
        stop: round1(up ? price - 1.5 * a : price + 1.5 * a),
        target: round1(up ? price + 2 * a : price - 2 * a),
        stopPct: round1((up ? -1 : 1) * 1.5 * a / price * 100),
        targetPct: round1((up ? 1 : -1) * 2 * a / price * 100)
      };
    }
    return out;
  }

  /* ══════════════════════════════════════════════════════════════
   🧪 واجهة المحرك
   ══════════════════════════════════════════════════════════════ */
  return {
    W: W,
    n: n, clamp: clamp,
    merge: merge,
    axes: { trend: axisTrend, momentum: axisMomentum, volatility: axisVolatility, volume: axisVolume },
    compute: compute,
    rank: rank,
    fromCandles: fromCandles,
    gemini: gemini, lock: lock, mcdx: mcdx, structure: structure, atr: atr
  };
});
