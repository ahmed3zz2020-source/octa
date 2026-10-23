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

  /* ══════════════════════════════════════════════════════════════
   🎯 تقريب حسب حجم السعر
   ──────────────────────────────────────────────────────────────
   ⛔⛔ باج ٢٣ أكتوبر ٢٠٢٦ — سهم زي ARAB بسعر ٠.٢٤٨:
   ⛌   round1 (خانة واحدة) كان بيحوّل ٠.٢٦٩ → ٠.٣ و ٠.٢٢ → ٠.٢
   ⛌   ⇒ «الهدف» بيطلع **تحت** سعر الدخول ⇒ المستخدم فاكر إن في خطأ.
   ⛌ ✅ الحل: عدد الخانات بيتحسب من حجم السعر نفسه.
   ══════════════════════════════════════════════════════════════ */
  function pxDec(price) {
    var a = Math.abs(Number(price) || 0);
    if (a >= 100) return 1;
    if (a >= 10) return 2;
    if (a >= 1) return 3;
    if (a >= 0.1) return 4;
    if (a >= 0.01) return 5;
    return 6;
  }
  function pxRound(v, price) {
    if (v == null || !isFinite(v)) return null;
    var d = pxDec(price);
    var p = Math.pow(10, d);
    return Math.round(v * p) / p;
  }
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
  /* 🛡️ رقم غير صالح (NaN / Infinity / نص) ⇒ null.
     ⛔ بدون ده: صف واحد malformed بيpoison كل درجة الفلاتر (score=NaN)
     ⛌   والصف بيتن-sort في غير ترتيبه. */
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : Number(v);
    return isFinite(n) ? n : null;
  }

  var NUM_FIELDS = ['price', 'change', 'volume', 'rsi', 'macd', 'macdSig', 'ma50', 'ma200',
    'ema20', 'ema50', 'ema200', 'adx', 'volD', 'beta', 'atr', 'mdd',
    'relvol', 'av30', 'mktCap', 'freeFloat', 'perf1w', 'perf1m', 'perf3m',
    'perf6m', 'perf1y', 'perfYtd', 'stochK', 'stochD', 'cci'];

  /* ⛔ أي رقم مش صالح ⇒ null (NaN / Infinity / نص / '').
     بتنادى على ٣ مصادر: merge + compute + fromCandles ⇒
     صف واحد malformed ما بيpoisonش الدرجة. */
  function sanitize(o) {
    if (!o || typeof o !== 'object') return o;
    for (var i = 0; i < NUM_FIELDS.length; i++) {
      var k = NUM_FIELDS[i];
      if (o[k] !== undefined) o[k] = num(o[k]);
    }
    return o;
  }

  function merge(row, tech, db) {
    row = row || {}; tech = tech || {}; db = db || {};
    sanitize(row); sanitize(tech); sanitize(db);
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
      /* ⚠️ المصدر بيطلع `stochK` (مش stoch_k) و `cci20` مش موجود أصلاً */
      stochK: pick(tech.stochK, tech.stoch_k, row.stochK, row.stoch_k),
      cci: pick(tech.cci20, tech.cci, row.cci20, row.cci),

      /* الاتجاه */
      /* ⚠️ ترتيب المصادر: **المصدر الحي الأول**. الـDB لقطة قديمة
         (data_full dated ٢٠٢٦-١٠-٠٩) ⇒ كان بيقدّم متوسط ٥٠ يوم قديم
         على الحي ⇒ درجة مختلفة ±٩ نقاط بين الجسر والباك. */
      ma50: pick(tech.ma50, row.ma50, row.sma50, db.ma50),
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
      tvRating: pick(row.tvRating, row.tv_rating, db.tvRating)
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
      /* ℹ️ تحت ٣٠ الـRSI بياخد **صفر** أصلاً (التعيين ٣٠⇒٠) ⇒ مفيش
         عقوبة تانية — «تشبع بيعي» = زخم ضعيف والدرجة بتقول كده ✓.
         (العقوبة فوق ٨٠ موجودة لأنها فوق النطاق المريح مش تحته.) */
      p.push({ k: 'rsi', w: 0.45, v: s / 100,
        txt: 'قوة نسبية ' + round1(rsi) + (rsi > 80 ? ' — تشبع شرائي' : (rsi < 30 ? ' — تشبع بيعي' : '')) });
    }
    if (m.macd != null && m.macdSig != null) {
      var diff = m.macd - m.macdSig;
      /* ⚠️ من غير سعر ⇒ محايد ٥٠ (مش ٧٥/٢٥) */
      var strength = (m.price && m.price > 0) ? clamp(Math.abs(diff) / (m.price * 0.02), 0, 1) : 0;
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
      p.push({ k: 'volD', w: 0.75, v: band(v, 0.8, 1.5, 4.5, 8) / 100,
        txt: 'تقلب يومي ' + round1(v) + '%' + bandNote(v, 1.5, 4.5) });
    }
    if (m.beta != null) {
      p.push({ k: 'beta', w: 0.25, v: band(m.beta, 0.4, 0.6, 1.4, 2.2) / 100,
        txt: 'بيتا ' + round1(m.beta) + ' — ' + (m.beta > 1.4 ? 'أعلى من السوق' : (m.beta < 0.6 ? 'أهدأ من السوق' : 'قريب من حركة السوق')) });
    }
    /* ⚠️ «أكبر تراجع» (mdd) مفيش له عمود في مسح TradingView ⇒ كان ناقص
       دايمًا ⇒ ١٥٪ من المحور بتضيع. بيتحسب من الشموع في **كارت السهم**. */
    return pack(p, 'التذبذب');
  }

  /* ④ الحجم — ضغط التدفق + السيولة */
  function axisVolume(m) {
    var p = [];
    /* ⛔⛔ سهم ما اتداولش (حجم = ٠) ⇒ «تدفق مع الشراء» (لأن التغير ٠)
       ⛌   + درجة سيولة ضعيفة = تفسير غلط. ⇒ المحور مستبعد بالكامل. */
    if (m.volume === 0) return pack([], 'الحجم');
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
    /* ⚠️ فوق vmax: هبوط **لوجاريتمي** — الأرضية المسطحة كانت بتدي
       نفس الدرجة (٥) لكل تقلب فوق ١٢٪ ⇒ تمييز ضعيف. */
    return clamp(45 - Math.log(1 + (v - vmax) / Math.max(1e-9, vmax)) * 28, 3, 45);
  }
  function bandNote(v, lo, hi) {
    if (v == null) return '';
    if (v < lo) return ' — تحت النطاق المريح';
    if (v > hi) return ' — أعلى من المريح';
    return ' — في النطاق المريح';
  }

  /* تجميع الأجزاء بأوزانها (بإعادة توزيع الوزن على الموجود بس) */
  /* ⚠️ محور فاضي ⇒ score = null (مش ٥٠).
     ⛔ الباج: المحور الفا��ض كان بياخد **٥٠** ⇒ بياخد نص وزنه
     ⛌   وبيعوّض النقص ⇒ سهم ناقص محور واحد بيوصل ٩٥/١٠٠، وسهم
     ⛌   بلا بيانات بيوصل ٦٠/١٠٠. ⛌ الـnull + الاستبعاد من الـbase
     ⛌   (تحت) يمنع التضخيم. */
  function pack(parts, label) {
    var wsum = 0, acc = 0;
    for (var i = 0; i < parts.length; i++) {
      wsum += parts[i].w;
      acc += parts[i].w * clamp(parts[i].v, 0, 1);
    }
    return {
      label: label,
      score: wsum > 0 ? clamp(acc / wsum * 100, 0, 100) : null,
      parts: parts,
      has: parts.length > 0,
      /* 📊 التغطية: كام وزن متاح من وزن المحور (المحور = ١.٠) */
      coverage: Math.min(1, wsum)
    };
  }

  /* ══════════════════════════════════════════════════════════════
   🏆 النتيجة النهائية
   ──────────────────────────────────────────────────────────────
   التجميع: اتجاه 30% · زخم 25% · حجم 25% · تذبذب 20%
   + مكافأة توافق (الأسهم اللي المحاور الأربعة بتتفق مع بعض)
   ══════════════════════════════════════════════════════════════ */
  var W = { trend: 0.30, momentum: 0.25, volume: 0.25, volatility: 0.20 };

  function compute(m) {
    m = sanitize(m || {});
    var t = axisTrend(m), mo = axisMomentum(m), v = axisVolatility(m), vo = axisVolume(m);

    /* ⛔⛔ الدرجة على **المحاور المتاحة بس** — الأوزان بتتوزّع تاني.
       ⛌   قبل كده المحور الفا��ض كان بيتحسب ٥٠ ⇒ بياخد نص وزنه ويعوّض
       ⛌   النقص (سهم ناقص محور ⇒ ٩٥/١٠٠). ⛌ دلوقتي: المحور الناقص
       ⛌   مستبعد خالص والوزن بيتقسم على الموجود. */
    var AX = [
      { a: t, w: W.trend }, { a: mo, w: W.momentum },
      { a: vo, w: W.volume }, { a: v, w: W.volatility }
    ];
    var wsum = 0, acc = 0, vals = [];
    for (var i = 0; i < AX.length; i++) {
      if (!AX[i].a.has || AX[i].a.score == null) continue;
      /* الوزن الفعال = وزن المحور × تغطيته (المحور الناقص = وزن أقل) */
      var ew = AX[i].w * (AX[i].a.coverage == null ? 1 : AX[i].a.coverage);
      if (ew <= 0) continue;
      wsum += ew;
      acc += ew * AX[i].a.score;
      vals.push(AX[i].a.score);
    }
    var base = wsum > 0 ? acc / wsum : 0;
    /* 📊 نسبة التغطية — ٤ محاور = ١.٠ · ٣ محاور = ٠.٧٥ */
    var coverage = Math.min(1, wsum);

    var spread = vals.length > 1 ? (Math.max.apply(null, vals) - Math.min.apply(null, vals)) : 0;
    var agreement = clamp(1 - spread / 100, 0, 1);
    var bonus = 10 * agreement;

    /* ⛔ الدرجة = (الأساس + المكافأة) × التغطية ⇒ محور ناقص = ثقة أقل */
    var score = clamp((base + bonus) * coverage, 0, 100);
    var minAxis = vals.length ? Math.min.apply(null, vals) : 0;

    /* ⛔ التغطية — السهم اللي مافيشلهوش بيانات لازم يتsays «ناقص»
       مش ياخد نتيجة وسيطة (٥٠) ويبقى في نص الترتيب. */
    var covered = (t.has ? 1 : 0) + (mo.has ? 1 : 0) + (v.has ? 1 : 0) + (vo.has ? 1 : 0);
    var weak = covered < 3;

    var badges = [];
    if (weak) badges.push({ id: 'weak', t: 'بيانات ناقصة', ok: 0 });
    /* ⛔ عتبة التوافق: ٥٠ (مش ٦٠).
       ⛌ بالقياس على ٢٦٤ سهماً مؤهّل: عتبة ٦٠ ⇒ ٣ أسهم بس (مش
       ⛌   نافعة كفلتر)، عتبة ٥٥ ⇒ ٨، عتبة ٥٠ ⇒ ١٥ (٥.٧٪).
       ⛌ يعني: الأربعة محاور **كلها** فوق المحايد — وده المقصود
       ⛌   من «الأسهم اللي بتتفق على ٤ محاور». */
    /* ⛔ شارة «توافق ٤ محاور» لازم تكون ٤ محاور **فعلاً** موجودة،
       ⛌   مش ٣ محاور + واحد ناقص (=٥٠). */
    if (!weak && covered === 4 && minAxis >= 50) badges.push({ id: 'agree', t: 'توافق ٤ محاور', ok: 1 });
    if (!weak && covered === 4 && minAxis >= 45 && minAxis < 50) badges.push({ id: 'near', t: 'تقارب كويس', ok: 1 });
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
      coverage: round1(coverage * 100),   /* % من الأوزان المتاحة */
      axesAvail: vals.length,
      badges: badges
    };
  }

  /* ترتيب كل الأسهم — الناقص البيانات بينزل تحت الكل (مش في نص الترتيب) */
  function rank(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      /* ⛔ السندات الحكومية (EGP) مش أسهم — مستبعدة من الفلتر */
      if (/-EGP$/i.test(String((list[i] && list[i].code) || ''))) continue;
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
  /* ⚠️ ATR بتاع **Wilder (RMA)** — مش EMA.
     ⛔ باج ٢٣ أكتوبر ٢٠٢٦ (تدقيق الأرقام): كان ema(tr) ⇒ القيمة أعلى
     ⛌   بـ ٦-٩٪ (COMI: ٢.٨ بدل ٢.٦٤ · ETEL: ٦.٦ بدل ٦.٠٧).
     ⛌   وبما إن وقّف الخسارة والهدف بيتحسبوا من الـATR ⇒ المسافة كانت
     ⛌   أوسع من الـATR اللي المستخدم شايفه في TradingView.
     ⛌ ✅ التحقق العددي: Wilder المطابق هنا = ٢.٦٤٠٠٤٠٩٢ (١٠ خانات)
     ⛌   = قيمة TradingView بالظبط (٢٠٢٦-١٠-٢٣). */
  /* 📉 أقصى تراجع من القمة للإرضي (بال%) على نافذة الشموع */
  function maxDrawdown(c) {
    if (!c || c.length < 10) return null;
    var peak = -Infinity, mdd = 0;
    for (var i = 0; i < c.length; i++) {
      var h = c[i].h != null ? c[i].h : c[i].c;
      if (h == null || !isFinite(h)) continue;
      if (h > peak) peak = h;
      var lo = c[i].l != null ? c[i].l : c[i].c;
      if (lo == null || !isFinite(lo) || peak <= 0) continue;
      var dd = (peak - lo) / peak * 100;
      if (dd > mdd) mdd = dd;
    }
    return round1(mdd);
  }

  function atr(c, len) {
    if (c.length < 2) return null;
    var tr = [];
    for (var i = 1; i < c.length; i++) {
      var pc = c[i - 1].c;
      tr.push(Math.max(c[i].h - c[i].l, Math.abs(c[i].h - pc), Math.abs(c[i].l - pc)));
    }
    if (!tr.length) return null;
    if (tr.length < len) {
      /* شموع أقل من الفترة ⇒ متوسط بسيط (مفيش RMA يكفي) */
      var s0 = 0;
      for (var j0 = 0; j0 < tr.length; j0++) s0 += tr[j0];
      return s0 / tr.length;
    }
    var a = 0;
    for (var j = 0; j < len; j++) a += tr[j];
    a = a / len;
    for (var k = len; k < tr.length; k++) a = (a * (len - 1) + tr[k]) / len;
    return a;
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
    var win = mf.slice(-40);
    var st = ema(win, 5), mt = ema(win, 20);
    if (st == null || mt == null) return null;
    /* ⚠️⚠️ المعايرة: كان القام (|st|+|mt|) ≈ صفر ⇒ النسبة ±١ ⇒
       ⛌   التشبّع (قيمة ٠ أو ١٠٠ بالظبط في ربع الأسهم).
       ⛌ ✅ دلوقتي: الفرق مقسوم على RMS السلسلة (مقياس حقيقي) و tanh
       ⛌   ⇒ التوزيع بين ٠ و١٠٠ بيتّسع من غير تشبّع قاسٍ. */
    var rms = 0;
    for (var q = 0; q < win.length; q++) rms += win[q] * win[q];
    rms = Math.sqrt(rms / (win.length || 1)) || 1e-9;
    var spread = (st - mt) / rms;
    var value = clamp(50 + 50 * Math.tanh(spread), 0, 100);
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
    /* ⚠️⚠️ المعايرة: كان القسمة على **٢ ثابتة** ⇒ الناتج محصور ٤٥-٥٨
       ⛌   والتأثير الحقيقي كان من الـ±8 بتاع تقاطع المتوسطات ⇒
       ⛌   «مؤسسات vs أفراد» عملياً نسخة من محور الاتجاه.
       ⛌ ✅ دلوقتي: z-score على RMS النافذة + tanh ⇒ التوزيع بين ٠ و١٠٠
       ⛌   بيعكس تدفق الفلوس فعلاً (مش المتوسطات). */
    var rms = 0;
    for (var q = 0; q < recent.length; q++) rms += recent[q] * recent[q];
    rms = Math.sqrt(rms / (recent.length || 1)) || 1e-9;
    var inst = clamp(50 + 50 * Math.tanh((acc / rms) * 0.8), 0, 100);

    var cross = 'none';
    if (m && m.ma50 != null && m.ma200 != null) {
      if (m.ma50 > m.ma200) { inst = clamp(inst + 4, 0, 100); cross = 'gc'; }
      else { inst = clamp(inst - 4, 0, 100); cross = 'dc'; }
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


  /* ══════════════════════════════════════════════════════════════
   🧱 Order Block — زون الشراء/البيع المؤسسي
   ──────────────────────────────────────────────────────────────
   📌 التعريف: آخر شمعة **معاكسة** قبل اندفاع قوي.
   ⛌ ده المكان اللي المؤسسات كانت بتجمع فيها الأوامر.
   📌 نسخنا OCTA: بنحسب ATR(14) وبنعتبر «اندفاع» أي شمعة جسمها
      أكبر من ١.٢×ATR. وبعدها نشوف هل السعر لسه داخل الزون.
   ══════════════════════════════════════════════════════════════ */
  function orderBlock(c) {
    if (!c || c.length < 30) return null;
    if (!atr(c, 14)) return null;
    var start = Math.max(3, c.length - 45);
    /* ⛌ ابدأ من آخر شمعة (مش ماقبلها) — الاندفاع ممكن يكون في الشمعة
       الجارية (لأنها اللي كسرت). */
    for (var i = c.length - 1; i >= start; i--) {
      /* ⚠️⚠️ بلا look-ahead: عتبة الاندفاع لازم ATR **لحد الشمعة i**،
         ⛌   مش ATR على السلسلة كلها (كان بيصنّف الاندفاعات القديمة
         ⛌   بمعرفة المستقبل). */
      var a = atr(c.slice(0, i + 1), 14);
      if (!a) continue;
      var body = Math.abs(c[i].c - c[i].o);
      if (body < a * 1.2) continue;
      var up = c[i].c > c[i].o;
      /* آخر شمعة معاكسة قبل الاندفاع */
      var j = i - 1, ob = null;
      while (j >= 1) {
        var dir = c[j].c > c[j].o;
        if (dir !== up) { ob = { i: j, h: c[j].h, l: c[j].l, c: c[j].c }; break; }
        j--;
      }
      if (!ob) continue;
      var price = c[c.length - 1].c;
      var inside = up ? (price >= ob.l && price <= ob.h) : (price <= ob.h && price >= ob.l);
      var broken = up ? (price < ob.l) : (price > ob.h);
      return {
        state: up ? 'bull' : 'bear',
        age: c.length - 1 - ob.i,
        hi: ob.h, lo: ob.l,
        inside: inside, broken: broken,
        dist: price >= ob.h ? (price - ob.h) / price * 100 : (price <= ob.l ? (ob.l - price) / price * 100 : 0),
        /* ⛌ الاتجاه صح: زون الشراء لو السعر فوقه ⇒ «تحت السعر»،
           وزون البيع لو السعر تحته ⇒ «فوق السعر». */
        label: up
          ? (inside ? 'زون شراء مؤسسي — السعر داخله' : (broken ? 'زون شراء اتكسر — الخطر' : 'زون شراء تحت السعر'))
          : (inside ? 'زون بيع مؤسسي — السعر داخله' : (broken ? 'زون بيع اتكسر — الخطر' : 'زون بيع فوق السعر'))
      };
    }
    return null;
  }

  /* ══════════════════════════════════════════════════════════════
   🕯️ نموذج رانيا — ٣ شموع
   ──────────────────────────────────────────────────────────────
   📌 النموذج الشهير في مصر:
   ⛌ الشمعة ١: شمعة قوية في اتجاه النموذج
   ⛌ الشمعة ٢: تصحيح صغير (-pullback) فوق/تحت الشمعة الأولى
   ⛌ الشمعة ٣: شمعة كسرت قمّة/قاع الشمعة الأولى ⇒ تأكيد
   📌 تأكيدات إضافية: حجم الشمعة ٣ > حجم الشمعة ١ · والسعر فوق EMA 50
   ══════════════════════════════════════════════════════════════ */
  function ranaPattern(c) {
    if (!c || c.length < 30) return null;
    var bodies = [], vs = [];
    for (var i = 0; i < c.length; i++) {
      bodies.push(Math.abs(c[i].c - c[i].o));
      vs.push(c[i].v || 0);
    }
    var ema50 = ema(c.map(function (x) { return x.c; }), 50);
    var price = c[c.length - 1].c;

    for (var k = c.length - 3; k >= Math.max(2, c.length - 7); k--) {
      /* ⚠️ بلا look-ahead: متوسط الجسم والحجم لحد الشمعة الثالثة بس */
      var avBody = sma(bodies.slice(0, k + 3), 20) || 1;
      var avVol = sma(vs.slice(0, k + 3), 20) || 1;
      var c1 = c[k], c2 = c[k + 1], c3 = c[k + 2];

      /* ── صاعد ── */
      if (c1.c > c1.o && (c1.c - c1.o) >= avBody * 1.1 &&
          c2.c < c1.c && Math.abs(c2.c - c2.o) <= Math.abs(c1.c - c1.o) * 0.7 &&
          c2.l >= c1.l &&
          c3.c > c1.h && c3.c > c3.o) {
        var bullVol = (c3.v || 0) > (c1.v || 0) * 0.9;
        var bullTrend = ema50 != null ? price > ema50 : true;
        return {
          state: 'bull', age: c.length - 1 - (k + 2),
          volOk: bullVol, trendOk: bullTrend,
          strength: Math.min(100, Math.round((c1.c - c1.o) / avBody * 30 + (c3.c - c1.h) / avBody * 30 + (bullVol ? 20 : 0) + (bullTrend ? 20 : 0))),
          label: 'نموذج رانيا الصاعد — ٣ شموع: قوية · تصحيح · كسر القمة'
        };
      }
      /* ── هابط ── */
      if (c1.c < c1.o && (c1.o - c1.c) >= avBody * 1.1 &&
          c2.c > c1.c && Math.abs(c2.c - c2.o) <= Math.abs(c1.c - c1.o) * 0.7 &&
          c2.h <= c1.h &&
          c3.c < c1.l && c3.c < c3.o) {
        var bearVol = (c3.v || 0) > (c1.v || 0) * 0.9;
        var bearTrend = ema50 != null ? price < ema50 : true;
        return {
          state: 'bear', age: c.length - 1 - (k + 2),
          volOk: bearVol, trendOk: bearTrend,
          strength: Math.min(100, Math.round((c1.o - c1.c) / avBody * 30 + (c1.l - c3.c) / avBody * 30 + (bearVol ? 20 : 0) + (bearTrend ? 20 : 0))),
          label: 'نموذج رانيا الهابط — ٣ شموع: قوية · تصحيح · كسر القاع'
        };
      }
    }
    return { state: 'none', label: 'مفيش نموذج ٣ شموع مكتمل دلوقتي' };
  }

  /* ══════════════════════════════════════════════════════════════
   📐 المتوسطات الأسّية (فيبوناتشي) + VWAP
   ──────────────────────────────────────────────────────────────
   📌 ٨ · ١٣ · ٢١ · ٣٤ · ٥٥ (فيبوناتشي) — الترتيب بيقول اتجاه
      مبني على «الترتيب الصاعد = ترند قوي» (الريبد).
   📌 VWAP — السعر العادل المرجّح بالحجم.
   ══════════════════════════════════════════════════════════════ */
  function fibEmas(c) {
    if (!c || c.length < 60) return null;
    var closes = c.map(function (x) { return x.c; });
    var e8 = ema(closes, 8), e13 = ema(closes, 13), e21 = ema(closes, 21),
      e34 = ema(closes, 34), e55 = ema(closes, 55);
    if (e8 == null || e13 == null || e21 == null || e34 == null || e55 == null) return null;
    var align = (e8 > e13 && e13 > e21 && e21 > e34 && e34 > e55) ? 'up'
      : ((e8 < e13 && e13 < e21 && e21 < e34 && e34 < e55) ? 'down' : 'mixed');
    /* VWAP على ٢٠ يوم */
    var pv = 0, vv = 0;
    var from = Math.max(0, c.length - 20);
    for (var i = from; i < c.length; i++) {
      var tp = (c[i].h + c[i].l + c[i].c) / 3;
      pv += tp * (c[i].v || 0); vv += (c[i].v || 0);
    }
    var vwap = vv > 0 ? pv / vv : null;
    var price = c[c.length - 1].c;
    /* ⚠️⛔ التقريب = pxRound (حسب حجم السعر) — مش round1.
       ⛌   round1 (خانة واحدة) كان بيحوّل متوسطات سهم ٠.٢٤٨ كلها لـ«٠.٣»
       ⛌   والـVWAP لـ«٠.٣» ⇒ التسمية («ترتيب صاعد») بتتناقض مع
       ⛌   الأرقام المعروضة. ✅ دلوقتي ٤ خانات للأسهم تحت ١. */
    return {
      e8: pxRound(e8, price), e13: pxRound(e13, price), e21: pxRound(e21, price),
      e34: pxRound(e34, price), e55: pxRound(e55, price),
      align: align,
      spread: round1(Math.abs(e8 - e55) / price * 100),
      vwap: vwap != null ? pxRound(vwap, price) : null,
      vwapSide: vwap == null ? null : (price > vwap ? 'above' : 'below'),
      label: align === 'up' ? 'ترتيب صاعد — ترند قوي' : (align === 'down' ? 'ترتيب هابط — ترند ضعيف' : 'متوسطات متشابكة — سوق عرض')
    };
  }

  /* كل التحليلات اللي محتاجة شموع */
  /* 📅 عمر الشموع بالأيام (من تاريخ آخر شمعة). null لو مفيش تاريخ. */
  function candleAgeDays(candles) {
    if (!candles || !candles.length) return null;
    var last = candles[candles.length - 1];
    var t = last && last.t;
    if (t == null) return null;
    var d = new Date(t);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }

  /* ⛔⛔ حارس البيانات القديمة (حرجة).
     ⛌   مثال حقيقي: TOUR آخر شمعة عنده ٢٠١٧-٠٤-٠٢ ⇒ الكارت كان
     ⛌   بيحسب ATR ومستويات وOrderBlock على بيانات ٩ سنين والسعر
     ⛌   الظاهر في القائمة ١٠.٠٠ ⇒ تعارض −٣١.٥٪ للمستخدم.
     ⛌ ✅ أي شموع أقدم من ١٠ أيام ⇒ مفيش مؤشرات (والواجهة بتقول السبب). */
  var MAX_CANDLE_AGE_DAYS = 10;

  function fromCandles(candles, m) {
    var c = (Array.isArray(candles) ? candles : []).filter(function (x) {
      return x && x.c != null && x.h != null && x.l != null &&
        isFinite(Number(x.c)) && isFinite(Number(x.h)) && isFinite(Number(x.l));
    });
    /* ⛔ ترتيب زمني — لو الـAPI رجّع الشموع مش مرتبة، كل المؤشرات
       ⛌   (EMA · ATR · VWAP · Order Block · نموذج رانيا) بتطلع غلط.
       ⛌ ⚠️ الترتيب بيتعمل **بس** لو `t` شكله تاريخ (ISO) أو رقم —
       ⛌   أي تسمية تانية (زي «d0», «d1») معناها ترتيب المصدر صح
       ⛌   والترتيب النصّي كان هيعبّط السلسلة. */
    if (c.length > 1) {
      var t0 = c[0].t;
      var allDates = c.every(function (x) { return typeof x.t === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x.t); });
      var allNums = c.every(function (x) { return typeof x.t === 'number' && isFinite(x.t); });
      if (allDates) {
        c = c.slice().sort(function (a, b) { return a.t < b.t ? -1 : (a.t > b.t ? 1 : 0); });
      } else if (allNums) {
        c = c.slice().sort(function (a, b) { return a.t - b.t; });
      } else if (t0 === undefined || t0 === null) {
        /* مفيش تاريخ خالص ⇒ ما نقدرش نرتب ⇒ نسيب ترتيب المصدر */
        c = c.slice();
      }
    }
    if (c.length < 25) return null;
    /* ⛔ البيانات القديمة ⇒ مفيش مؤشرات (الواجهة بتعرض سبب واضح) */
    var age = candleAgeDays(c);
    if (age != null && age > MAX_CANDLE_AGE_DAYS) return null;
    var a = atr(c, 14);
    var price = c[c.length - 1].c;
    var out = {
      n: c.length,
      gemini: gemini(c),
      lock: lock(c),
      mcdx: mcdx(c, m),
      structure: structure(c),
      orderBlock: orderBlock(c),
      rana: ranaPattern(c),
      fib: fibEmas(c),
      atr: a != null ? pxRound(a, price) : null,
      atrPct: (a != null && price) ? round1(a / price * 100) : null,
      /* 📉 أقصى تراجع خلال نافذة الشموع — مكمل لمحور التذبذب.
         ⛌ مسح TradingView مفيوش عمود «أقصى تراجع» ⇒ بيتحسب من الشموع. */
      mdd: maxDrawdown(c),
      levels: null
    };
    if (a != null && price) {
      /* ⛔⛔ قرار أحمد (٢٣ أكتوبر ٢٠٢٦): المستويات **دايمًا** لصفقة شراء:
         ⛌   الوقف **تحت** الدخول والهدف **فوق** الدخول.
         ⛌   قبل كده كان في وضع «بيع» بيحط الهدف تحت السعر ⇒ المستخدم
         ⛌   شايف «هدف ٠.٢٢٠ والسعر ٠.٢٤٨» وبيعتبره خطأ.
         ⛌ ✅ دلوقتي: entry < stop? لا — entry > stop و entry < target دايمًا.
         ⛌   ولو البنية هابطة بنقوله صراحةً إن ده سيناريو ارتداد. */
      var bear = !!(out.structure && out.structure.state === 'bear');
      /* 📌 الدخول يُقرَّب الأول وبعدين نشتقّ الباقي منه ⇒ النِسب
         المعروضة بتطابق الأرقام المعروضة بالظبط. */
      var ep = pxRound(price, price);
      var sp = pxRound(ep - 1.5 * a, price);
      var tp = pxRound(ep + 2 * a, price);
      /* ⚠️ لو الـATR أصغر من دقة العرض ⇒ الوقف = الدخول (صفر مخاطرة
         ⛌   على الشاشة). ⇒ نفرض فصل لا يقل عن وحدة واحدة. */
      var unit = Math.pow(10, -pxDec(price));
      if (ep - sp < unit) sp = pxRound(ep - unit, price);
      if (tp - ep < unit) tp = pxRound(ep + unit, price);
      out.levels = {
        entry: ep,
        stop: sp,
        target: tp,
        stopPct: round1((sp - ep) / ep * 100),
        targetPct: round1((tp - ep) / ep * 100),
        dir: 'up',
        dirLabel: 'سيناريو شراء — الوقف تحت والهدف فوق',
        /* ⚠️ البنية هابطة = لازم نقوله مينفعش نشتري من فوق */
        bear: bear,
        bearNote: bear
          ? '⚠️ البنية الحالية هابطة — المستويات دي لصفقة شراء على أساس ارتداد من الدعم، مش كسر صاعد.'
          : ''
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
    gemini: gemini, lock: lock, mcdx: mcdx, structure: structure, atr: atr,
    maxDrawdown: maxDrawdown, num: num,
    candleAgeDays: candleAgeDays, MAX_CANDLE_AGE_DAYS: MAX_CANDLE_AGE_DAYS,
    orderBlock: orderBlock, ranaPattern: ranaPattern, fibEmas: fibEmas
  };
});
