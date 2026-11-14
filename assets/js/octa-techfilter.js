/* ══════════════════════════════════════════════════════════════
   📈 المُصفّي الفني — الفلتر الفني (الذراع الثاني من الثمانية)
   ══════════════════════════════════════════════════════════════
   ⛔ القاعدة الذهبية (نفس قاعدة ذراع الأذرع):
      الرقم اللي بنعرضه = المحور الفني (m) نفسه — نفس الرقم اللي دخل
      في 20٪ من مجموع OCTA. مفيش درجة ثانية بتتنافس معاه.
   ⛔ المؤشر الناقص = «—» + تغطية. مش صفر. (الناقص مش دليل ضد السهم)
   ⛔ كل رقم على الشاشة = رقم موجود في رد الـAPI أو في سجل الموقع.
   ⛔ مفيش كلام بيوعد بالربح.

   📌⭐ ١٤ نوفمبر ٢٠٢٦ — مصدر البيانات: **الداتا الحية** مش السجل.
   📌 السبب المقيس: /api/data_full (اللي الموقع بيقرأ منه) وعه ٩ أكتوبر —
      أي بعد 5 أسابيع. النتيجة: المؤشرات الفنية كلها (RSI · المتوسطات ·
      الحجم · القمة) قديمة. ومثال مقيس: AIH — المحور الفني في السجل = 100
      (٩ أكتوبر) · وفي المحرك الحي = 72 (١٤ نوفمبر) ⇒ فرق 28 نقطة.
   ⛔ القاعدة: «الفني» ما ينفعش ينفع من رسم قديم.
   ✅ الحل: نقرأ /api/markets?market=egypt (حي · ٢٨٧ سهم · ١٥٣ ك.ب مضغوط)
      ⇒ نفس اللحظة اللي بتتقدّم فيها الدرجة النهائية، فمفيش تعارض.
      ولو الطلب فشل ⇒ نرجع للسجل ونقول للمستخدم إن البيانات قديمة.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────── الحالة ─────────── */
  var TS = {
    view: 'best',       /* best | above200 | rsi | vol | high | sector */
    minM: 0,            /* أقل نتيجة فنية */
    rsiMin: 0, rsiMax: 100,
    minCrit: 0,         /* أقل عدد معايير متبقية */
    sector: 'all',
    help: false
  };

  /* 📦 الداتا الحية — code → صف */
  var LIVE = null;
  var LIVE_TS = '';
  var LIVE_STATE = 'idle';   /* idle | loading | ok | error */
  var LIVE_ERR = '';

  /* ─────────── أدوات صغيرة ─────────── */
  function db() {
    return (typeof OS_DB !== 'undefined' && OS_DB && OS_DB.length) ? OS_DB : [];
  }
  function num(v) {
    if (v === null || v === undefined || v === '' || v !== v) return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  function firstNum() {
    for (var i = 0; i < arguments.length; i++) {
      var n = num(arguments[i]);
      if (n !== null) return n;
    }
    return null;
  }
  function tEsc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function tNum(v, dec) {
    var n = num(v);
    return n === null ? '—' : n.toFixed(dec === undefined ? 1 : dec);
  }

  /* ─────────── قراءة الداتا الحية ─────────── */
  function loadLive() {
    if (LIVE) return Promise.resolve(LIVE);
    if (LIVE_STATE === 'loading') return Promise.resolve(null);
    LIVE_STATE = 'loading';
    var api = (typeof OCTA_API !== 'undefined') ? OCTA_API : '';
    var f = (typeof octaFetch === 'function')
      ? octaFetch(api + '/api/markets?market=egypt')
      : fetch(api + '/api/markets?market=egypt', { credentials: 'include' });
    return f.then(function (r) { return r.json(); }).then(function (j) {
      var rows = (j && (j.egypt || (j.markets && j.markets.egypt))) || (j && j.rows) || [];
      var map = {};
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (!r || !r.code) continue;
        map[r.code] = r;
        if (!LIVE_TS && r.ts) LIVE_TS = String(r.ts);
      }
      LIVE = map;
      LIVE_STATE = 'ok';
      return LIVE;
    }).catch(function (e) {
      LIVE_STATE = 'error';
      LIVE_ERR = (e && e.message) ? String(e.message) : 'الطلب فشل';
      LIVE = null;
      return null;
    });
  }

  /* ⭐ المشهد الموحّد للسهم — من الداتا الحية، ولو مفيش ⇒ من السجل */
  function view(s) {
    var L = LIVE ? LIVE[s.code] : null;
    var old = {
      price: firstNum(s.price, s.p),
      rsi: num(s.rsi),
      ma50: num(s.ma50),
      ma200: num(s.ma200),
      ema20: null, ema50: null, ema200: null,
      bb: null,
      macd: num(s.macd),
      macdSig: firstNum(s.macdSignal, s.macdSig),
      relvol: firstNum(s.relvol, s.relVolume),
      atr: null,
      perf3m: num(s.perf3m),
      perfY: firstNum(s.perf1yV, s.perfYtd),
      frm52hi: null,
      m: (function () {
        var sc = s.sect || s.sections || {};
        return num(sc.m !== null && sc.m !== undefined ? sc.m : s.m);
      })(),
      conf: num(s.scoreConf),
      ts: ''
    };
    if (!L) {
      return {
        code: s.code, name: s.name || s.code,
        sector: s.sectorAr || s.sector || 'عام',
        src: 'old', data: old
      };
    }
    var ax = L.all_axes || {};
    var live = {
      price: num(L.price),
      rsi: num(L.rsi),
      ma50: firstNum(L.sma50, L.ema50),
      ma200: firstNum(L.sma200, L.ema200),
      ema20: num(L.ema20),
      ema50: num(L.ema50),
      ema200: num(L.ema200),
      bb: num(L.bb_basis),
      macd: null, macdSig: null,          /* ⛔ الماكد مش موجود في الداتا الحية */
      relvol: num(L.rel_volume),
      atr: num(L.atr),
      perf3m: num(L.perf_3m),
      perfY: num(L.perf_y),
      frm52hi: null,
      m: num(ax.technical),
      conf: num(L.data_confidence),
      ts: L.ts || ''
    };
    return {
      code: s.code,
      name: L.name || s.name || s.code,
      sector: L.sector || s.sectorAr || s.sector || 'عام',
      src: 'live', data: live
    };
  }

  /* ─────────── المعايير الثمانية ───────────
     ⛔ كل معيار: 1 = عدّى · 0 = ما عدّاش · null = البيانات ناقصة (مش «فشل»).
     ⛔ الناقص بيتشال من المقام — مش بيتحسب صفر. */
  var T_CRIT = [
    { k: 'c50', n: 'فوق متوسط 50 يوم',
      tip: 'السعر أكبر من متوسط آخر 50 يوم — اتجاه متوسط المدى صاعد',
      v: function (v) { var p = v.price, m = v.ma50; return (p === null || m === null) ? null : (p > m ? 1 : 0); } },
    { k: 'c200', n: 'فوق متوسط 200 يوم',
      tip: 'السعر أكبر من متوسط آخر 200 يوم — الاتجاه طويل المدى صاعد',
      v: function (v) { var p = v.price, m = v.ma200; return (p === null || m === null) ? null : (p > m ? 1 : 0); } },
    { k: 'stack', n: 'المتوسط 50 فوق 200',
      tip: 'البنية صاعدة: متوسط 50 يوم أعلى من متوسط 200 يوم',
      v: function (v) { var a = v.ma50, b = v.ma200; return (a === null || b === null) ? null : (a > b ? 1 : 0); } },
    { k: 'ema20', n: 'فوق EMA 20',
      tip: 'السعر فوق المتوسط المتحرك الأسّي لـ20 يوم — الزخم قصير المدى',
      v: function (v) { var p = v.price, m = v.ema20; return (p === null || m === null) ? null : (p > m ? 1 : 0); } },
    { k: 'rsi', n: 'قوة 52 — 70',
      tip: 'مؤشر القوة في منطقة الصعود من غير تشبع. فوق 70 = تشبع شرائي · تحت 30 = تشبع بيعي',
      v: function (v) { var r = v.rsi; return r === null ? null : ((r >= 52 && r <= 70) ? 1 : 0); } },
    { k: 'vol', n: 'حجم مؤكّد (1.2×+)',
      tip: 'حجم اليوم أكبر من 1.2 مرة متوسط 30 يوم — في طلب حقيقي على السهم',
      v: function (v) { var x = v.relvol; return x === null ? null : (x >= 1.2 ? 1 : 0); } },
    { k: 'bb', n: 'فوق خط بولنجر الأوسط',
      tip: 'السعر في النصف العلوي من نطاقه — الموقع قوي مش في النص',
      v: function (v) { var p = v.price, b = v.bb; return (p === null || b === null) ? null : (p > b ? 1 : 0); } },
    { k: 'p3', n: 'أداء 3 شهور موجب',
      tip: 'السهم زاد في آخر 3 شهور',
      v: function (v) { var p = v.perf3m; return p === null ? null : (p > 0 ? 1 : 0); } }
  ];

  /* 🧮 نتيجة المعايير: كم عدّى / كام متاح أصلاً */
  function critOf(v) {
    var pass = 0, have = 0, items = [];
    for (var i = 0; i < T_CRIT.length; i++) {
      var c = T_CRIT[i], val = null;
      try { val = c.v(v); } catch (e) { val = null; }
      val = (val === null || val === undefined) ? null : (val ? 1 : 0);
      if (val !== null) { have++; if (val) pass++; }
      items.push({ k: c.k, n: c.n, tip: c.tip, ok: val });
    }
    return { pass: pass, have: have, items: items };
  }

  /* 🗣️ سطر «ليه ده مختار؟» — أرقام حقيقية جوه جملة عربي */
  function why(v) {
    var bits = [], p = v.price, m50 = v.ma50, m200 = v.ma200;
    if (p !== null && m50 !== null) {
      var g50 = (p - m50) / p * 100;
      bits.push((p > m50 ? 'فوق' : 'تحت') + ' متوسط 50 بـ ' + Math.abs(g50).toFixed(1) + '٪');
    }
    if (p !== null && m200 !== null) {
      var g200 = (p - m200) / p * 100;
      bits.push((p > m200 ? 'فوق' : 'تحت') + ' متوسط 200 بـ ' + Math.abs(g200).toFixed(1) + '٪');
    }
    var r = v.rsi;
    if (r !== null) {
      bits.push('قوة ' + r.toFixed(0) +
        (r > 70 ? ' (تشبع شرائي)' : r >= 52 ? ' (زخم صاعد)' : r < 30 ? ' (تشبع بيعي)' : ''));
    }
    var x = v.relvol;
    if (x !== null) bits.push('حجم اليوم ' + x.toFixed(1) + '× متوسط');
    var p3 = v.perf3m;
    if (p3 !== null) bits.push((p3 >= 0 ? '+' : '') + p3.toFixed(0) + '٪ في 3 شهور');
    if (!bits.length) return 'مفيش بيانات فنية كافية';
    return bits.slice(0, 4).join(' · ');
  }

  /* 🕐 وقت التحديث: 2026-11-14T02:57:… ⇒ «14/11 · 02:57» */
  function fmtTs(ts){
    var t = String(ts || '');
    var m = t.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return t ? t.slice(0, 16).replace('T', ' ') : '—';
    return m[3] + '/' + m[2] + ' · ' + m[4] + ':' + m[5];
  }

  /* 📊 وسيط النتيجة الفنية لكل قطاع — للمقارنة النسبية */
  var MED_CACHE = null;
  function sectorMed() {
    if (MED_CACHE) return MED_CACHE;
    var by = {};
    var all = db();
    for (var i = 0; i < all.length; i++) {
      var v = view(all[i]);
      if (v.data.m === null) continue;
      var k = v.sector;
      (by[k] = by[k] || []).push(v.data.m);
    }
    var out = {};
    for (var k2 in by) {
      var arr = by[k2].slice().sort(function (a, b) { return a - b; });
      out[k2] = arr.length ? arr[Math.floor(arr.length / 2)] : null;
    }
    MED_CACHE = out;
    return out;
  }

  /* 🎯 الاختصارات الستة */
  var T_VIEWS = [
    { id: 'best', ic: '📈', n: 'الأقوى فنياً' },
    { id: 'above200', ic: '⛰️', n: 'فوق متوسط 200' },
    { id: 'rsi', ic: '💪', n: 'قوة 52-70' },
    { id: 'vol', ic: '🔊', n: 'حجم مؤكّد' },
    { id: 'bb', ic: '📊', n: 'فوق بولنجر' },
    { id: 'sector', ic: '🏆', n: 'الأقوى في قطاعه' }
  ];

  /* 🧮 الصفوف بعد الفلترة */
  function rows() {
    var all = db(), out = [], med = sectorMed();
    for (var i = 0; i < all.length; i++) {
      var v = view(all[i]), d = v.data, m = d.m;
      if (m === null) continue;                 /* مفيش محور فني = مش في الفلتر */
      var p = d.price, m200 = d.ma200, r = d.rsi, x = d.relvol, b = d.bb;

      if (TS.minM && m < TS.minM) continue;
      if (r !== null && (r < TS.rsiMin || r > TS.rsiMax)) continue;
      if (TS.sector !== 'all' && v.sector !== TS.sector) continue;
      if (TS.view === 'above200' && !(p !== null && m200 !== null && p > m200)) continue;
      if (TS.view === 'rsi' && !(r !== null && r >= 52 && r <= 70)) continue;
      if (TS.view === 'vol' && !(x !== null && x >= 1.2)) continue;
      if (TS.view === 'bb' && !(p !== null && b !== null && p > b)) continue;

      var c = critOf(d);
      if (TS.minCrit && c.pass < TS.minCrit) continue;

      var smed = med[v.sector];
      out.push({
        v: v, m: m, crit: c, why: why(d),
        rel: (smed !== null && smed !== undefined) ? (m - smed) : null,
        smed: (smed !== null && smed !== undefined) ? smed : null
      });
    }
    if (TS.view === 'sector') {
      out.sort(function (a, b) {
        var x1 = (a.rel === null ? -999 : a.rel), y1 = (b.rel === null ? -999 : b.rel);
        return y1 - x1 || b.m - a.m;
      });
    } else {
      /* ⛔ ترتيبCompetition: المحور الفني (المحرك) أولاً.
         ⛔ كاسر التعادل = المعايير المبقية ثم قوة البنية (مسافة فوق 200).
         (المحور الفني مربوط بمدى واسع ⇒ ناس كتير بنفس الدرجة.) */
      out.sort(function (a, b) {
        if (b.m !== a.m) return b.m - a.m;
        if (b.crit.pass !== a.crit.pass) return b.crit.pass - a.crit.pass;
        var ga = (a.v.data.price && a.v.data.ma200) ? ((a.v.data.price - a.v.data.ma200) / a.v.data.price * 100) : -999;
        var gb = (b.v.data.price && b.v.data.ma200) ? ((b.v.data.price - b.v.data.ma200) / b.v.data.price * 100) : -999;
        return gb - ga;
      });
    }
    return out;
  }

  /* ═══════════ الشرح (❓) ═══════════ */
  function helpBox() {
    var on = TS.help;
    var h = '<div class="flt-help">';
    h += '<button class="flt-help-h' + (on ? ' open' : '') + '" onclick="techHelpToggle()">'
      + '<span>❓ إيه الفلتر الفني بالظبط؟ وليه بيقولك «ليه» على كل سهم؟</span><i>' + (on ? '✕' : '؟') + '</i></button>';
    h += '<div class="flt-help-b" style="display:' + (on ? 'block' : 'none') + '">';

    h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🎯</span> الفكرة في سطر</div>'
      + '<p class="flt-h-p"><b>الفلتر الفني بيرتّب كل سهم في السوق حسب قوة شكله — من غير كلام.</b></p>'
      + '<p class="flt-h-p">السهم اللي شكله صح (فوق متوسطاته · قوته في مكانها · في ناس بتشتريه) '
      + 'بيبقى فوق. والسهم اللي شكله ضعيف بيحتار تحت.</p>'
      + '<p class="flt-h-p">⛔ وده <b>مش توصية شراء</b>. الشكل الفني بيقولك السهم بيتحرك إزاي — '
      + 'مش بيقولك الشركة كويسة ولا السعر مناسب.</p></div>';

    h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📊</span> الرقم المعروض منين؟</div>'
      + '<p class="flt-h-p">الرقم اللي جنب كل سهم (<b>النتيجة الفنية</b>) هو '
      + '<b>نفس المحور الفني</b> اللي دخل في <b>20٪</b> من مجموع درجة OCTA. '
      + 'مش رقم جديد ولا تقدير.</p>'
      + '<p class="flt-h-note">📌 الأرقام كلها **لحظية** — من نفس الردة اللي طلعت منها الدرجة النهائية، '
      + 'فلو غيرت الترتيب والنتيجة اتغيّرت يبقى في خلل.</p></div>';

    h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">✅</span> المعايير الثمانية</div>'
      + '<p class="flt-h-p">كل سهم بيتقيّم على 8 معايير فنية. المعيار الناقص بيتشال من الحساب '
      + '(مش صفر) — عشان السهم مايتظلمش عشان بياناته ناقصة.</p>';
    var marks = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
    for (var i = 0; i < T_CRIT.length; i++) {
      h += '<div class="flt-h-metric"><b>' + marks[i] + ' ' + T_CRIT[i].n + '</b>'
        + '<p>' + T_CRIT[i].tip + '</p></div>';
    }
    h += '</div>';

    h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🏅</span> الأرقام ومعناها البسيط</div>'
      + '<div class="flt-h-metric"><b>متوسط 50 و 200 يوم</b>'
      + '<p>السعر فوق المتوسط = الاتجاه صاعد. متوسط 50 فوق 200 = البنية صاعدة.</p></div>'
      + '<div class="flt-h-metric"><b>مؤشر القوة (RSI)</b>'
      + '<p>يقيس قوة الشراء من 100. 52-70 = صاعد من غير تشبع. فوق 70 = الناس اشترت كله (خطر). '
      + 'تحت 30 = السوق زهق منه.</p></div>'
      + '<div class="flt-h-metric"><b>الحجم النسبي</b>'
      + '<p>حجم اليوم ÷ متوسط 30 يوم. 1 = عادي · 1.2+ = في طلب حقيقي · تحت 0.6 = مفيش حد بيشتري.</p></div>'
      + '<div class="flt-h-metric"><b>بولنجر</b>'
      + '<p>نطاق السعر المتوقّع. فوق خط الوسط = السهم في النصف العلوي من نطاقه.</p></div></div>';

    h += '<div class="flt-h-warn">⚠️ <b>مهم:</b> قوة فنية عالية مش معناها سهم كويس. '
      + 'استخدم الفلتر الفني مع فلتر الأساسيات — عشان تتجنب سهم شكله حلو بس شركته ضعيفة. '
      + 'العائد الماضي مش ضمان للمستقبل.</div>';

    h += '</div></div>';
    return h;
  }

  /* ═══════════ الجدول ═══════════ */
  function gapCell(v, key) {
    var p = v.price, m = v[key];
    if (p === null || m === null || p <= 0) return '<span class="flt-na">—</span>';
    var g = (p - m) / p * 100;
    return '<span class="flt-b ' + (g >= 0 ? 'ok' : 'bad') + '">' + (g >= 0 ? '+' : '') + g.toFixed(1) + '٪</span>';
  }

  function renderTable(list) {
    var h = '<div class="flt-tbl-wrap"><table class="flt-tbl"><thead><tr>'
      + '<th>السهم</th><th>📈 الفني</th><th>المعايير</th><th>قوة</th>'
      + '<th>مقابل 50</th><th>مقابل 200</th><th>تذبذب</th><th>الحجم</th>'
      + '<th>3 شهور</th><th>سنة</th><th>القطاع</th><th>لييه؟</th><th>التفاصيل</th>'
      + '</tr></thead><tbody>';
    var CAP = 60;
    list.slice(0, CAP).forEach(function (r) {
      var v = r.v, d = v.data, c = r.crit;
      var rsi = d.rsi, x = d.relvol, p3 = d.perf3m, py = d.perfY;
      var atrPct = (d.atr !== null && d.price) ? (d.atr / d.price * 100) : null;
      var med = '';
      if (r.smed !== null) {
        med = '<small>وسيط القطاع ' + r.smed.toFixed(0) + ' · ' + (r.rel >= 0 ? '+' : '') + r.rel.toFixed(0) + '</small>';
      }
      var critTxt = c.have === 0
        ? '<span class="flt-na">—</span><small>📌 مفيش بيانات فنية</small>'
        : '<span class="flt-b ' + (c.pass >= 5 ? 'ok' : c.pass >= 3 ? 'mid' : 'bad') + '">'
          + c.pass + '/' + c.have + '</span>'
          + (c.have < c.items.length ? '<small>📌 ناقص ' + (c.items.length - c.have) + '</small>' : '');
      h += '<tr>'
        + '<td><b class="flt-c" onclick="openStock(\'' + v.code + '\')" style="cursor:pointer">' + v.code + '</b>'
        + '<small>' + tEsc((v.name || '').slice(0, 20)) + '</small></td>'
        + '<td><span class="flt-safe s' + (r.m >= 65 ? 'hi' : r.m >= 45 ? 'md' : 'lo') + '">' + r.m.toFixed(0) + '</span>'
        + med + '</td>'
        + '<td>' + critTxt + '</td>'
        + '<td>' + (rsi !== null ? '<span class="flt-b ' + (rsi >= 52 && rsi <= 70 ? 'ok' : rsi > 70 ? 'mid' : 'bad') + '">'
          + rsi.toFixed(0) + '</span>' : '<span class="flt-na">—</span>') + '</td>'
        + '<td>' + gapCell(d, 'ma50') + '</td>'
        + '<td>' + gapCell(d, 'ma200') + '</td>'
        + '<td>' + (atrPct !== null ? '<span class="flt-b ' + (atrPct <= 2 ? 'ok' : atrPct <= 4 ? 'mid' : 'bad') + '">'
          + atrPct.toFixed(1) + '٪</span>' : '<span class="flt-na">—</span>') + '</td>'
        + '<td>' + (x !== null ? '<span class="flt-b ' + (x >= 1.2 ? 'ok' : x >= 0.8 ? 'mid' : 'bad') + '">'
          + x.toFixed(1) + '×</span>' : '<span class="flt-na">—</span>') + '</td>'
        + '<td>' + (p3 !== null ? '<span class="flt-b ' + (p3 > 0 ? 'ok' : 'bad') + '">' + (p3 >= 0 ? '+' : '') + p3.toFixed(0) + '٪</span>' : '<span class="flt-na">—</span>') + '</td>'
        + '<td>' + (py !== null ? '<span class="flt-b ' + (py > 0 ? 'ok' : 'bad') + '">' + (py >= 0 ? '+' : '') + py.toFixed(0) + '٪</span>' : '<span class="flt-na">—</span>') + '</td>'
        + '<td class="flt-sect">' + tEsc(v.sector) + '</td>'
        + '<td style="font-size:.7rem;max-width:230px">' + tEsc(r.why) + '</td>'
        + '<td><button class="flt-add" onclick="techDetail(\'' + v.code + '\')" title="التحليل الفني الكامل">🔎</button></td>'
        + '</tr>';
    });
    h += '</tbody></table></div>';
    if (list.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>' + CAP + '</b> من <b>' + list.length + '</b></div>';
    return h;
  }

  /* 🗂️ كروت بدل جدول (عشان الموبايل) — نفس الأرقام بالظبط */
  function renderCards(list) {
    var h = '<div class="tf-cards">';
    var CAP = 40;
    list.slice(0, CAP).forEach(function (r) {
      var v = r.v, d = v.data, c = r.crit;
      var rsi = d.rsi, x = d.relvol, p3 = d.perf3m, py = d.perfY;
      var atrPct = (d.atr !== null && d.price) ? (d.atr / d.price * 100) : null;
      var g50 = (d.price !== null && d.ma50 !== null && d.price) ? ((d.price - d.ma50) / d.price * 100) : null;
      var g200 = (d.price !== null && d.ma200 !== null && d.price) ? ((d.price - d.ma200) / d.price * 100) : null;
      /* ⛔ علامة النسبة جوه <i> — زي باقي الموقع (عشان الـbidi ميعكسش الرقم) */
      var pct = function (v, d) { return (v >= 0 ? '+' : '') + v.toFixed(d === undefined ? 1 : d) + '٪'; };
      var m = '';
      if (rsi !== null) {
        m += '<span class="tf-metric ' + (rsi >= 52 && rsi <= 70 ? 'ok' : rsi > 70 ? '' : 'bad') + '">قوة <b>' + rsi.toFixed(0) + '</b></span>';
      }
      if (g50 !== null) {
        m += '<span class="tf-metric ' + (g50 >= 0 ? 'ok' : 'bad') + '">مقابل 50 <b class="flt-ltr">' + pct(g50) + '</b></span>';
      }
      if (g200 !== null) {
        m += '<span class="tf-metric ' + (g200 >= 0 ? 'ok' : 'bad') + '">مقابل 200 <b class="flt-ltr">' + pct(g200) + '</b></span>';
      }
      if (atrPct !== null) {
        m += '<span class="tf-metric ' + (atrPct <= 4 ? 'ok' : 'bad') + '">تذبذب <b class="flt-ltr">' + atrPct.toFixed(1) + '٪</b></span>';
      }
      if (x !== null) {
        m += '<span class="tf-metric ' + (x >= 1.2 ? 'ok' : x < 0.8 ? 'bad' : '') + '">حجم <b class="flt-ltr">' + x.toFixed(1) + '×</b></span>';
      }
      if (p3 !== null) {
        m += '<span class="tf-metric ' + (p3 > 0 ? 'ok' : 'bad') + '">3 شهور <b class="flt-ltr">' + pct(p3, 0) + '</b></span>';
      }
      if (py !== null) {
        m += '<span class="tf-metric ' + (py > 0 ? 'ok' : 'bad') + '">سنة <b class="flt-ltr">' + pct(py, 0) + '</b></span>';
      }
      var med = r.smed !== null
        ? '<div class="tf-card-med">وسيط القطاع ' + r.smed.toFixed(0) + ' · ' + (r.rel >= 0 ? '+' : '') + r.rel.toFixed(0) + '</div>'
        : '';
      var crit = c.have === 0
        ? '<div class="tf-card-crit">📌 مفيش بيانات فنية</div>'
        : '<div class="tf-card-crit">' + (c.pass >= 5 ? '✅' : c.pass >= 3 ? '🟡' : '⛔') + ' عدّى '
          + c.pass + ' من ' + c.have + ' معيار'
          + (c.have < c.items.length ? ' · 📌 ناقص ' + (c.items.length - c.have) : '') + '</div>';
      h += '<div class="tf-card">'
        + '<div class="tf-card-top">'
        + '<div><b class="tf-card-code" onclick="openStock(\'' + v.code + '\')">' + v.code + '</b>'
        + '<div class="tf-card-name">' + tEsc((v.name || '').slice(0, 26)) + ' · ' + tEsc(v.sector) + '</div></div>'
        + '<div class="tf-card-score"><span class="flt-safe s' + (r.m >= 65 ? 'hi' : r.m >= 45 ? 'md' : 'lo') + '">'
        + r.m.toFixed(0) + '</span>' + med + '</div>'
        + '</div>'
        + '<div class="tf-metrics">' + m + '</div>'
        + crit
        + '<div class="tf-why">' + tEsc(r.why) + '</div>'
        + '<button class="tf-btn" onclick="techDetail(\'' + v.code + '\')">🔎 التحليل الفني الكامل</button>'
        + '</div>';
    });
    h += '</div>';
    if (list.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>' + CAP + '</b> من <b>' + list.length + '</b></div>';
    return h;
  }

  /* ═══════════ اللوحة كاملة ═══════════ */
  function renderPanel(box, compact) {
    if (!box) return;
    /* ⛔ وسيط القطاعات بيتحسب وقت الرسم — عشان لو الداتا وصلت بعد أول
       رسم، الأرقام تتحدّث (مش تفضل فاضية). */
    MED_CACHE = null;
    var list = rows();
    var all = db();
    var secs = [];
    for (var i = 0; i < all.length; i++) {
      var k = view(all[i]).sector;
      if (secs.indexOf(k) < 0) secs.push(k);
    }
    secs.sort();

    var avg = 0;
    if (list.length) {
      var sum = 0;
      for (var j = 0; j < list.length; j++) sum += list[j].m;
      avg = sum / list.length;
    }
    var above200 = 0, above50 = 0;
    for (var q = 0; q < list.length; q++) {
      var d = list[q].v.data;
      if (d.price !== null && d.ma200 !== null && d.price > d.ma200) above200++;
      if (d.price !== null && d.ma50 !== null && d.price > d.ma50) above50++;
    }

    var h = '';
    h += '<div class="flt-head"><div><h2>📈 الفلتر الفني</h2>'
      + '<p class="flt-sub">شكل السعر دلوقتي: اتجاه · زخم · حجم · موقع من النطاق</p></div>'
      + '<span class="flt-d" style="font-size:.7rem">النتيجة = المحور الفني نفسه (20٪ من درجة OCTA)</span></div>';

    /* 📦 حالة البيانات — دي مهمة: المستخدم لازم يعرف الأرقام لحظية ولا قديمة */
    if (LIVE_STATE === 'loading') {
      h += '<div class="flt-alert">⏳ بنجيب <b>الداتا الحية</b> (المؤشرات الفنية بتتحدّث كل)…</div>';
    } else if (LIVE_STATE === 'error') {
      h += '<div class="flt-alert">⚠️ <b>مقدرتش أجيب الداتا الحية</b> — الأرقام اللي تحت من '
        + 'سجل ٩ أكتوبر (مش لحظية). '
        + '<span class="flt-alert-s">سبب الطلب: ' + tEsc(LIVE_ERR || '—') + '</span></div>';
    } else if (LIVE_STATE === 'ok') {
      h += '<div class="flt-alert">📊 <b>داتا لحظية</b> — آخر تحديث '
        + tEsc(fmtTs(LIVE_TS))
        + ' · ' + Object.keys(LIVE || {}).length + ' سهم'
        + '<span class="flt-alert-s">نفس الردة اللي طلعت منها الدرجة النهائية ⇒ مفيش تعارض بين الأرقام.</span></div>';
    }

    /* شرائح الاختيار السريع */
    h += '<div class="flt-chips">';
    for (var v2 = 0; v2 < T_VIEWS.length; v2++) {
      var vv = T_VIEWS[v2];
      h += '<button class="dv-tab' + (TS.view === vv.id ? ' on' : '') + '" onclick="techSetView(\'' + vv.id + '\')">'
        + vv.ic + ' ' + vv.n + '</button>';
    }
    h += '</div>';

    /* المؤشرات — في الذراع: مطوية (عشان الجدول يبان فوراً)
       وفي صفحة الفلاتر: مفتوحة زي باقي الفلاتر. */
    var sliders = '<div class="flt-filters">'
      + '<div class="flt-sl"><label>أقل نتيجة فنية <b>' + TS.minM + '</b></label>'
      + '<input type="range" min="0" max="90" step="5" value="' + TS.minM + '" oninput="techSet(\'minM\',this.value)"></div>'
      + '<div class="flt-sl"><label>أقل معايير متبقية <b>' + TS.minCrit + '</b>/8</label>'
      + '<input type="range" min="0" max="8" step="1" value="' + TS.minCrit + '" oninput="techSet(\'minCrit\',this.value)"></div>'
      + '<div class="flt-sl"><label>أقل قوة <b>' + TS.rsiMin + '</b></label>'
      + '<input type="range" min="0" max="70" step="1" value="' + TS.rsiMin + '" oninput="techSet(\'rsiMin\',this.value)"></div>'
      + '<div class="flt-sl"><label>أعلى قوة <b>' + TS.rsiMax + '</b></label>'
      + '<input type="range" min="30" max="100" step="1" value="' + TS.rsiMax + '" oninput="techSet(\'rsiMax\',this.value)"></div>'
      + '<div class="flt-sl"><label>القطاع <b>' + (TS.sector === 'all' ? 'كل القطاعات' : tEsc(TS.sector)) + '</b></label>'
      + '<select class="fli-sel" onchange="techSet(\'sector\',this.value)">'
      + '<option value="all">كل القطاعات</option>'
      + secs.map(function (x) { return '<option value="' + tEsc(x) + '"' + (TS.sector === x ? ' selected' : '') + '>' + tEsc(x) + '</option>'; }).join('')
      + '</select></div>'
      + '<button class="flt-rst" onclick="techReset()">↺ إعادة</button>'
      + '</div>';
    h += compact
      ? '<details class="flt-tune"><summary>🎚️ ضبّط الفلاتر (النتيجة · المعايير · القوة · القطاع)</summary>' + sliders + '</details>'
      : sliders;

    h += helpBox();

    /* ⚠️ السهم اللي مافيش عنده بيانات فنية: المحور الفني بيتحسب «محايد 50»
       (مش ضعيف) — لازم المستخدم يعرف ده. */
    var noData = 0, partData = 0;
    for (var z = 0; z < list.length; z++) {
      if (list[z].crit.have === 0) noData++;
      else if (list[z].crit.have < list[z].crit.items.length) partData++;
    }
    if (noData) {
      h += '<div class="flt-alert">📊 <b>محتاج بيانات:</b> ' + noData
        + ' سهم مافيش عندهم مؤشرات فنية كاملة — نتيجتهم محايدة (مش ضعيفة). '
        + '<span class="flt-alert-s">المحرك بيحط 50 نقطة لما يبقى مش عارف — وده مفيش تفسير تاني.</span></div>';
    } else if (partData) {
      h += '<div class="flt-alert">📊 <b>بيانات ناقصة:</b> ' + partData
        + ' سهم ناقصهم بعض المؤشرات الفنية — المعايير الناقصة اتشالت من الحساب '
        + '(مش صفر).</div>';
    }

    h += '<div class="flt-stats">'
      + '<div><b>' + list.length + '</b><span>سهم مطابق</span></div>'
      + '<div><b>' + (list.length ? avg.toFixed(0) : '—') + '</b><span>متوسط النتيجة الفنية</span></div>'
      + '<div><b>' + (list.length ? Math.round(above50 / list.length * 100) : '—') + '٪</b><span>فوق متوسط 50</span></div>'
      + '<div><b>' + (list.length ? Math.round(above200 / list.length * 100) : '—') + '٪</b><span>فوق متوسط 200</span></div>'
      + '</div>';

    if (!list.length) {
      box.innerHTML = h + '<div class="flt-empty">⛔ مفيش أسهم بتستوفي الشروط<br>'
        + '<button class="dv-tab" onclick="techReset()">وسّع الفلاتر</button></div>';
      return;
    }

    h += compact ? renderCards(list) : renderTable(list);
    h += '<div id="techDetailHost"></div>';
    box.innerHTML = h;
    if (TS.detail) loadDetail(TS.detail);
  }

  /* ═══════════ تفصيل السهم (من محرك الـAPI نفسه) ═══════════ */
  function loadDetail(code) {
    var host = document.getElementById('techDetailHost');
    if (!host) return;
    TS.detail = code;
    host.innerHTML = '<div class="flt-loading" style="padding:14px;text-align:center;color:var(--muted)">⏳ بنجيب التحليل الفني الكامل…</div>';
    var url = (typeof OCTA_API !== 'undefined' ? OCTA_API : '') + '/api/technical/' + encodeURIComponent(code);
    var p = (typeof octaFetch === 'function') ? octaFetch(url) : fetch(url, { credentials: 'include' });
    p.then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.technical) {
        host.innerHTML = '<div class="flt-empty">⛔ التحليل الفني غير متاح لهذا السهم</div>';
        return;
      }
      var t = j.technical, b = t.breakdown || {};
      var ind = j.indicators || {};
      var lv = t.levels || {};
      var h = '<div class="flt-alert" style="margin-top:10px"><b>🔎 التحليل الفني الكامل — '
        + tEsc(j.name || code) + '</b> '
        + '<span class="flt-alert-s">النتيجة <b>' + tNum(t.score, 1) + '</b>/100 · '
        + 'التقييم <b>' + tEsc(t.signal || '—') + '</b> · '
        + 'ثقة البيانات <b>' + tNum(t.confidence, 0) + '٪</b>'
        + (t.atr_pct != null ? ' · تذبذب يومي <b>' + tNum(t.atr_pct, 1) + '٪</b>' : '')
        + '</span></div>';

      /* شرائط المحاور الخمسة */
      h += '<div class="flt-stats" style="margin-top:8px">';
      var AX = ['الاتجاه', 'الزخم', 'الموقع من النطاق', 'الحجم', 'تقييم المصدر'];
      for (var a = 0; a < AX.length; a++) {
        h += '<div><b>' + tNum(b[AX[a]], 0) + '</b><span>' + AX[a] + '</span></div>';
      }
      h += '</div>';

      /* المؤشرات */
      h += '<div class="flt-h-ul" style="margin-top:8px">'
        + '<li>متوسط 20: <b>' + tNum(ind.ema20, 2) + '</b> · متوسط 50: <b>' + tNum(ind.ema50, 2) + '</b> · متوسط 200: <b>' + tNum(ind.ema200, 2) + '</b></li>'
        + '<li>قوة RSI: <b>' + tNum(ind.rsi, 0) + '</b> · المدى الحقيقي ATR: <b>' + tNum(ind.atr, 2) + '</b></li>'
        + '<li>الحد الأعلى ل Bollinger: <b>' + tNum(ind.bb_upper, 2) + '</b> · الحد الأدنى: <b>' + tNum(ind.bb_lower, 2) + '</b></li>'
        + '</div>';

      /* المستويات */
      h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🎯</span> المستويات القريبة</div>'
        + '<div class="flt-h-tbl" style="font-size:.73rem">'
        + '<div style="display:grid;grid-template-columns:110px 1fr 1fr;gap:2px;padding:8px 0;border-bottom:1px solid var(--line);font-weight:800">'
        + '<span>المستوى</span><span>السعر</span><span>المسافة</span></div>';
      var p0 = num(j.price);
      var LV = [['دعم أول', lv['دعم_1']], ['مقاومة أول', lv['مقاومة_1']], ['نقطة محايدة', lv['نقطة_محايدة']]];
      for (var l = 0; l < LV.length; l++) {
        var val = num(LV[l][1]);
        if (val === null) continue;
        var dist = p0 ? ((val - p0) / p0 * 100) : null;
        h += '<div style="display:grid;grid-template-columns:110px 1fr 1fr;gap:2px;padding:7px 0;border-bottom:1px solid var(--line-soft)">'
          + '<span style="color:var(--muted)">' + LV[l][0] + '</span>'
          + '<span>' + val.toFixed(2) + '</span>'
          + '<span>' + (dist === null ? '—' : (dist >= 0 ? '+' : '') + dist.toFixed(1) + '٪') + '</span></div>';
      }
      h += '</div></div>';

      /* الأسباب */
      var SEC = [['positives', '✅', 'نقاط القوة'], ['negatives', '⛔', 'نقاط الضعف'], ['neutral', '📌', 'محايد']];
      for (var s2 = 0; s2 < SEC.length; s2++) {
        var arr = t[SEC[s2][0]] || [];
        if (!arr.length) continue;
        h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">' + SEC[s2][1] + '</span> ' + SEC[s2][2] + '</div><ul class="flt-h-ul">'
          + arr.map(function (x) { return '<li>' + tEsc(x) + '</li>'; }).join('') + '</ul></div>';
      }
      h += '<div class="flt-h-warn">⛔ التحليل الفني بيقولك السهم بيتحرك إزاي — مش بيقولك اشتري. '
        + 'القرار قرارك.</div>';
      host.innerHTML = h;
    }).catch(function (e) {
      host.innerHTML = '<div class="flt-empty">⛔ تعذر تحميل التحليل (' + tEsc(e && e.message ? e.message : 'خطأ') + ')</div>';
    });
  }

  /* ═══════════ الأفعال ═══════════ */
  function set(k, v) {
    TS[k] = (typeof v === 'string') ? v : Number(v);
    renderAll();
  }
  function setView(v) {
    TS.view = v;
    renderAll();
  }
  function reset() {
    TS.view = 'best'; TS.minM = 0; TS.rsiMin = 0; TS.rsiMax = 100;
    TS.minCrit = 0; TS.sector = 'all'; TS.detail = null;
    renderAll();
  }
  function helpToggle() { TS.help = !TS.help; renderAll(); }
  function detail(code) { loadDetail(code); }

  /* 🎯 كل الحاويات المعروضة (الذراع + تبويب الفلاتر) */
  var HOSTS = [];
  function registerHost(box, compact) {
    for (var i = 0; i < HOSTS.length; i++){
      if (HOSTS[i].box === box){ if (compact !== undefined) HOSTS[i].compact = !!compact; return; }
    }
    if (box) HOSTS.push({ box: box, compact: !!compact });
  }
  function renderAll() {
    if (!HOSTS.length) return;
    MED_CACHE = null;
    for (var i = 0; i < HOSTS.length; i++) {
      var h = HOSTS[i];
      if (!h || !h.box || !h.box.isConnected) { HOSTS.splice(i, 1); i--; continue; }
      try { renderPanel(h.box, h.compact); } catch (e) { console.warn('tech filter:', e && e.message); }
    }
  }

  /* 🚀 الإقلاع: السجل الأول (فوري) وبعدين الداتا الحية */
  async function boot() {
    try { if (typeof octaLoadDB === 'function') await octaLoadDB(); } catch (e) { }
    renderAll();
    if (!LIVE) { await loadLive(); renderAll(); }
  }

  window.OCTATech = {
    render: function (box, opts) {
      var compact = !!(opts && opts.compact);
      registerHost(box, compact);
      renderPanel(box, compact);
    },
    count: function () { try { return rows().length; } catch (e) { return 0; } },
    boot: boot,
    loadLive: loadLive,
    /* 🧪 Hooks للاختبار */
    _t: {
      TS: TS, rows: rows, critOf: critOf, why: why, view: view,
      T_CRIT: T_CRIT, sectorMed: sectorMed,
      setLive: function (map, ts) { LIVE = map; LIVE_TS = ts || ''; LIVE_STATE = 'ok'; },
      clearLive: function () { LIVE = null; LIVE_STATE = 'idle'; }
    }
  };

  /* 🌍 الأفعال العامة (الزرار في الـHTML) */
  window.techSet = set;
  window.techSetView = setView;
  window.techReset = reset;
  window.techHelpToggle = helpToggle;
  window.techDetail = detail;
})();
