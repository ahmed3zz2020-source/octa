/* ══════════════════════════════════════════════════════════════════
   🐙 OCTA · octa-gold-egy.js — الذهب المصري + مقارنة الأصول (١٤ نوفمبر ٢٠٢٦)
   ══════════════════════════════════════════════════════════════════
   📌 الهدف: كارت «الذهب المصري» في مؤشرات السوق المصري + مودال فيه
      مقارنة حقيقية بين ٤ أصول على نفس التواريخ:
         ① الذهب المصري (جرام عيار ٢٤ بالجنيه)
         ② مؤشر EGX30
         ③ الدولار مقابل الجنيه
         ④ شهادات الادخار (البنك المركزي المصري)
      + مؤشر التضخم (البنك الدولي) + DXY (سياق).

   ⛔⛔ قواعد المحتوى:
      · مفيش أي رقم مخترع — اللي مش موجود بيتكتب «غير متاح».
      · كل رقم ليه مصدر مكتوب تحت.
      · مقارنة على **نفس تاريخ البداية والنهاية** لكل الأصول (مقارنة apples-to-apples).
      · العائد الحقيقي = العائد الاسمي ÷ التضخم.
      · مفيش أي اسم أداة ذكاء اصطناعي في النص.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── أدوات ───────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(v, d) {
    if (v == null || isNaN(Number(v))) return '—';
    try {
      return Number(v).toLocaleString('en-US', {
        minimumFractionDigits: d == null ? 0 : d,
        maximumFractionDigits: d == null ? 0 : d
      });
    } catch (e) { return String(v); }
  }
  /* ⛔⛔ الإشارات لازم dir="ltr" — من غيرها «+٥٫٤٪» بتطلع «٥٫٤٪+» في RTL */
  function sgn(v, d) {
    if (v == null || isNaN(Number(v))) return '—';
    var x = Number(v);
    var txt = (x > 0 ? '+' : x < 0 ? '−' : '') + num(Math.abs(x), d == null ? 1 : d) + '%';
    return '<bdi dir="ltr">' + txt + '</bdi>';
  }
  function sgnCls(v) {
    if (v == null || isNaN(Number(v))) return 'gflat';
    return Number(v) > 0 ? 'gup' : Number(v) < 0 ? 'gdown' : 'gflat';
  }
  function dtxt(s) {
    return String(s == null ? '' : s).replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g,
      function (m, y, mo, d) { return d + '/' + mo + '/' + y; });
  }
  function apiBase() { return (window.OCTA_API || ''); }
  function jf(path) {
    var f = (typeof window.octaFetch === 'function') ? window.octaFetch : window.fetch;
    return f(apiBase() + path, { credentials: 'include' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  /* ── الكاش ───────────────────────────────────────────── */
  var CACHE = { data: null, at: 0 };
  var TTL = 5 * 60 * 1000;

  /* ══════════════════════════════════════════════════════════
     ① تحميل البيانات
     ══════════════════════════════════════════════════════════ */
  function load(force) {
    if (!force && CACHE.data && (Date.now() - CACHE.at) < TTL) {
      return Promise.resolve(CACHE.data);
    }
    var certP = fetch('assets/data/cbe-cert-rates.json?v=1')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });

    return Promise.all([
      jf('/api/gold/history'),
      jf('/api/indices/EGX30/analysis'),
      jf('/api/gold/factors'),
      jf('/api/gold/scenarios'),
      certP
    ]).then(function (r) {
      var hist = r[0], idx = r[1], fac = r[2], sav = r[3], cert = r[4];
      if (!hist || !hist.ok || !(hist.series || []).length) {
        throw new Error((hist && hist.error) || 'تاريخ الذهب غير متاح');
      }
      var D = {
        gold: [],      // {t, gram, fx, ounce}
        egx: [],       // {t, v}
        factors: (fac && fac.ok && fac.factors) || {},
        savings: (sav && sav.ok && sav.savings) || null,
        caveats: (sav && sav.caveats) || [],
        cert: cert,
        snapshot: hist.snapshot_id || (sav && sav.snapshot_id) || null
      };
      /* الذهب + الدولار (نفس السلسلة ⇒ نفس المصدر) */
      (hist.series || []).forEach(function (p) {
        if (p.gram == null && p.egp_per_usd == null) return;
        var t = Date.parse(p.d + 'T00:00:00Z');
        if (isNaN(t)) return;
        D.gold.push({ t: t, d: p.d, gram: p.gram, fx: p.egp_per_usd, ounce: p.ounce_egp });
      });
      D.gold.sort(function (a, b) { return a.t - b.t; });
      /* EGX30 */
      var vals = (idx && idx.ok && idx.series && idx.series.values) || [];
      vals.forEach(function (p) {
        var t = (p[0] || 0) * 1000, v = p[1];
        if (!t || v == null) return;
        D.egx.push({ t: t, v: Number(v) });
      });
      D.egx.sort(function (a, b) { return a.t - b.t; });
      D.egxMeta = (idx && idx.ok) ? {
        name: (idx.index && idx.index.name_ar) || 'مؤشر البورصة المصرية',
        coverage: idx.coverage || null, source: idx.source || null
      } : null;
      /* حدود سلسلة الذهب (أقدم و/أحدث) */
      D.goldFrom = D.gold.length ? D.gold[0].d : null;
      D.goldTo = D.gold.length ? D.gold[D.gold.length - 1].d : null;
      /* آخر القراءات */
      var last = D.gold[D.gold.length - 1] || {};
      D.last = {
        gram: last.gram, fx: last.fx, ounce: last.ounce, date: last.d,
        egx: D.egx.length ? D.egx[D.egx.length - 1].v : null,
        dxy: (D.factors.dxy && D.factors.dxy.value) || null,
        infl: (D.factors.cbe_inflation && D.factors.cbe_inflation.value) || null,
        inflDate: (D.factors.cbe_inflation && D.factors.cbe_inflation.date) || null,
        policy: (D.factors.cbe_policy && D.factors.cbe_policy.value) || null,
        xau: (D.factors.xau && D.factors.xau.value) || null,
        usdEgpCbe: (D.factors.usd_egp && D.factors.usd_egp.value) || null
      };
      /* العائد اليومي (لحساب التغير اليومي للجرام) */
      var prev = null, yday = null;
      for (var i = D.gold.length - 1; i >= 0 && i > D.gold.length - 12; i--) {
        var g = D.gold[i];
        if (g.gram == null) continue;
        if (prev == null) { prev = g.gram; continue; }
        if (yday == null) {
          yday = (prev != null && g.gram != null) ? ((g.gram / prev - 1) * 100) : null;
          break;
        }
      }
      D.last.gramChangePct = yday;
      CACHE.data = D; CACHE.at = Date.now();
      return D;
    });
  }

  /* ══════════════════════════════════════════════════════════
     ② الفترات — نفس تواريخ الباك (مقارنة على نفس النافذة)
     ══════════════════════════════════════════════════════════ */
  function buildPeriods(D) {
    var out = [];
    var rows = (D.savings && D.savings.rows) || [];
    var byYears = {};
    rows.forEach(function (r) { byYears[Math.round(Number(r.years))] = r; });
    /* ⭐⭐⭐ نافذة المقارنة لازم تكون **واحدة** لكل الأصول.
       📌 سلسلة المؤشر (index_history) بتقف قبل سلسلة الذهب ⇒ لو كل أصل
       خد «آخر تاريخ عنده» كانت المقارنة مش apples-to-apples.
       ✅ الحل: ناخد **أقدم** تاريخ نهاية متاح بين الأصول ⇒ كلهم نفس النافذة. */
    var goldTo = D.goldTo;
    var egxTo = D.egx.length ? new Date(D.egx[D.egx.length - 1].t).toISOString().slice(0, 10) : null;
    var commonTo = goldTo;
    if (egxTo && goldTo && egxTo < goldTo) commonTo = egxTo;
    D.commonTo = commonTo;
    var anchor = commonTo ? Date.parse(commonTo + 'T00:00:00Z') : Date.now();
    function back(days) {
      return new Date(anchor - days * 86400000).toISOString().slice(0, 10);
    }
    function ytd() {
      return String(new Date(anchor).getUTCFullYear()) + '-01-01';
    }
    /* الفترات القصيرة: من آخر يوم في السلسلة */
    out.push({ key: '1M', label: 'شهر', from: back(30), to: commonTo, short: 'شهر' });
    out.push({ key: '3M', label: '٣ شهور', from: back(91), to: commonTo, short: '٣ شهور' });
    out.push({ key: '6M', label: '٦ شهور', from: back(182), to: commonTo, short: '٦ شهور' });
    out.push({ key: 'YTD', label: 'من بداية السنة', from: ytd(), to: commonTo, short: 'سنة' });
    /* الفترات الطويلة: نفس تواريخ الـsavings (١ و٣ و٥ و١٠ و٢٠ سنة) */
    [[1, 'سنة'], [3, '٣ سنين'], [5, '٥ سنين'], [10, '١٠ سنين'], [20, '٢٠ سنة']].forEach(function (p) {
      var r = byYears[p[0]];
      if (!r) return;
      /* ⛔ نفس تاريخ البداية (من الباك) بس النهاية الموحّدة (أقدم تاريخ متاح) */
      out.push({ key: p[0] + 'Y', label: p[1], from: r.from, to: commonTo, short: p[1], row: r, savTo: r.to });
    });
    /* حساب المدة بالسنوات */
    out.forEach(function (p) {
      var a = Date.parse(p.from + 'T00:00:00Z'), b = Date.parse(p.to + 'T00:00:00Z');
      p.days = Math.max(1, Math.round((b - a) / 86400000));
      p.years = p.days / 365.25;
      p.cagr = null;
    });
    return out;
  }

  /* ══════════════════════════════════════════════════════════
     ③ حساب العائد لكل أصل
     ══════════════════════════════════════════════════════════ */
  /* أقرب نقطة عند/بعد t ⇒ آخر نقطة عند/قبل t */
  function valueAt(series, t, field) {
    if (!series || !series.length) return null;
    var lo = 0, hi = series.length - 1, best = null;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (series[mid].t <= t) { best = series[mid]; lo = mid + 1; }
      else hi = mid - 1;
    }
    if (!best) return null;
    return field ? best[field] : best.v;
  }
  function retPct(series, from, to, field) {
    var a = Date.parse(from + 'T00:00:00Z'), b = Date.parse(to + 'T00:00:00Z');
    var v1 = valueAt(series, a, field), v2 = valueAt(series, b, field);
    if (v1 == null || v2 == null || !v1) return null;
    return { start: v1, end: v2, pct: (v2 / v1 - 1) * 100 };
  }
  /* شهادات الادخار: مركّب شهري من معدّلات البنك المركزي */
  function certReturn(D, from, to) {
    var rates = (D.cert && D.cert.rates) || null;
    if (!rates) return null;
    var keys = Object.keys(rates).sort();
    if (!keys.length) return null;
    var a = Date.parse(from + 'T00:00:00Z'), b = Date.parse(to + 'T00:00:00Z');
    var used = 0, missed = 0, prod = 1, lastKey = null;
    var y = new Date(a).getUTCFullYear(), m = new Date(a).getUTCMonth() + 1;
    var endY = new Date(b).getUTCFullYear(), endM = new Date(b).getUTCMonth() + 1;
    var guard = 0;
    while ((y * 12 + m) <= (endY * 12 + endM) && guard < 400) {
      guard++;
      var key = y + '-' + String(m).padStart(2, '0');
      var r = rates[key];
      if (r && r.dep_3m != null) {
        /* عائد شهري مركّب من المعدّل السنوي */
        prod *= Math.pow(1 + Number(r.dep_3m) / 100, 1 / 12);
        used++; lastKey = key;
      } else {
        missed++;
      }
      m++; if (m > 12) { m = 1; y++; }
    }
    if (!used) return null;
    /* ⛔⛔⛔ لو الفترة بتبدأ **قبل** أول شهر في مصدر البنك المركزي
       ⇒ النتيجة مش هتكون صادقة (هتحسب جزء من العائد بس) ⇒ «غير متاح».
       📌 لو فيه شهور ناقصة جوه الفترة ⇒ بنحسبها ونقول كام شهر محسوب. */
    var firstKey = keys[0];
    var fy = parseInt(firstKey.slice(0, 4), 10), fm = parseInt(firstKey.slice(5, 7), 10);
    var sy = new Date(a).getUTCFullYear(), sm = new Date(a).getUTCMonth() + 1;
    if (sy * 12 + sm < fy * 12 + fm) {
      return { unavailable: true, from: firstKey, monthsUsed: used, monthsMissed: missed };
    }
    return {
      pct: (prod - 1) * 100,
      monthsUsed: used, monthsMissed: missed, lastKey: lastKey,
      partial: missed > 0
    };
  }
  /* التضخم: من الـsavings لو الفترة موجودة، وإلا المعدّل السنوي الحالي */
  function inflationFor(D, p) {
    if (p.row && p.row.real && p.row.real.inflation_pct != null) {
      return {
        pct: Number(p.row.real.inflation_pct),
        label: 'البنك الدولي — CPI مصر · ' + (p.row.real.inflation_window || '')
      };
    }
    if (D.last.infl != null) {
      var yrs = Math.max(p.years, 1 / 365);
      return {
        pct: (Math.pow(1 + Number(D.last.infl) / 100, yrs) - 1) * 100,
        label: 'معدل التضخم السنوي الحالي (البنك المركزي) ' + num(D.last.infl, 1) + '٪'
      };
    }
    return null;
  }
  /* العائد الحقيقي = الاسمي بعد التضخم */
  function realOf(nomPct, inflPct) {
    if (nomPct == null || inflPct == null) return null;
    return ((1 + nomPct / 100) / (1 + inflPct / 100) - 1) * 100;
  }

  /* ══════════════════════════════════════════════════════════
     ④ المقارنة الكاملة لفترة واحدة
     ══════════════════════════════════════════════════════════ */
  var ASSETS = [
    { key: 'gold', name: 'الذهب المصري', unit: 'جرام عيار ٢٤ (ج.م)', color: '#d4af37', icon: '🥇' },
    { key: 'egx', name: 'مؤشر EGX30', unit: 'نقطة', color: '#38bdf8', icon: '📊' },
    { key: 'usd', name: 'الدولار/الجنيه', unit: 'ج.م للدولار', color: '#a78bfa', icon: '💵' },
    { key: 'cert', name: 'شهادات الادخار', unit: 'مركّب شهري (البنك المركزي)', color: '#22c55e', icon: '🏦' }
  ];

  function compare(D, p) {
    var g = retPct(D.gold, p.from, p.to, 'gram');
    var fxv = retPct(D.gold, p.from, p.to, 'fx');
    var e = retPct(D.egx, p.from, p.to, 'v');
    var c = certReturn(D, p.from, p.to);
    var infl = inflationFor(D, p);
    var rows = [];
    rows.push(mk('gold', ASSETS[0], g, infl, p));
    rows.push(mk('egx', ASSETS[1], e, infl, p));
    rows.push(mk('usd', ASSETS[2], fxv, infl, p));
    rows.push(mk('cert', ASSETS[3], c ? { pct: c.pct, start: null, end: null } : null, infl, p, c));
    return { period: p, rows: rows, infl: infl };
  }
  function mk(key, meta, r, infl, p, extra) {
    var nominal = (r && !r.unavailable && r.pct != null) ? r.pct : null;
    var real = realOf(nominal, infl && infl.pct != null ? infl.pct : null);
    var cagr = null;
    if (nominal != null && p.years > 0.35) {
      cagr = (Math.pow(1 + nominal / 100, 1 / p.years) - 1) * 100;
    }
    return {
      key: key, meta: meta, nominal: nominal, real: real, cagr: cagr,
      start: r ? r.start : null, end: r ? r.end : null,
      extra: extra || null
    };
  }

  /* ══════════════════════════════════════════════════════════
     ⑤ الرسم — الأصول الأربعة مطبّعة على 100
     ══════════════════════════════════════════════════════════ */
  var libP = null;
  function loadLib() {
    if (libP) return libP;
    libP = new Promise(function (res, rej) {
      if (window.LightweightCharts) { res(window.LightweightCharts); return; }
      var s = document.createElement('script');
      s.src = 'assets/js/vendor/lightweight-charts.standalone.production.js?v=1';
      s.onload = function () { res(window.LightweightCharts); };
      s.onerror = function () { rej(new Error('lib')); };
      document.head.appendChild(s);
    });
    return libP;
  }
  /* سلسلة مطبّعة (100 عند بداية الفترة) */
  function normSeries(series, tFrom, field, step) {
    var v0 = valueAt(series, tFrom, field);
    if (v0 == null || !v0) return [];
    var out = [], last = -1e9;
    for (var i = 0; i < series.length; i++) {
      var s = series[i];
      if (s.t < tFrom) continue;
      if (step && (s.t - last) < step * 86400000) continue;
      var v = field ? s[field] : s.v;
      if (v == null || !v) continue;
      out.push({ t: s.t, v: (v / v0) * 100 });
      last = s.t;
    }
    return out;
  }
  function certIndex(D, tFrom) {
    var rates = (D.cert && D.cert.rates) || {};
    var keys = Object.keys(rates).sort();
    var out = [], prod = 1, started = false;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var t = Date.parse(k + '-15T00:00:00Z');
      if (t < tFrom) { prod *= Math.pow(1 + Number(rates[k].dep_3m) / 100, 1 / 12); continue; }
      started = true;
      prod *= Math.pow(1 + Number(rates[k].dep_3m) / 100, 1 / 12);
      out.push({ t: t, v: prod * 100 });
    }
    return started ? out : [];
  }

  function drawCompare(host, D, p, cmp) {
    if (!host) return;
    var tFrom = Date.parse(p.from + 'T00:00:00Z');
    var step = p.days > 900 ? 7 : (p.days > 200 ? 3 : 1);
    var series = [
      { name: 'الذهب المصري', color: '#d4af37', data: normSeries(D.gold, tFrom, 'gram', step) },
      { name: 'EGX30', color: '#38bdf8', data: normSeries(D.egx, tFrom, 'v', step) },
      { name: 'الدولار/الجنيه', color: '#a78bfa', data: normSeries(D.gold, tFrom, 'fx', step) },
      { name: 'شهادات الادخار', color: '#22c55e', data: certIndex(D, tFrom) }
    ].filter(function (s) { return s.data && s.data.length > 1; });
    if (!series.length) { host.innerHTML = '<div class="gmute">مفيش بيانات كافية للرسم.</div>'; return; }
    loadLib().then(function (lib) {
      try {
        host.innerHTML = '';
        var chart = lib.createChart(host, {
          localization: { locale: 'ar' },
          layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8b9eb0', fontSize: 10, locale: 'ar' },
          grid: { vertLines: { color: 'rgba(255,255,255,.05)' }, horzLines: { color: 'rgba(255,255,255,.05)' } },
          rightPriceScale: { borderColor: 'rgba(255,255,255,.12)' },
          timeScale: { borderColor: 'rgba(255,255,255,.12)', timeVisible: false },
          height: Math.max(210, Math.min(320, Math.round(window.innerHeight * 0.32)))
        });
        series.forEach(function (s) {
          var line = chart.addSeries(lib.LineSeries, { color: s.color, lineWidth: 2 });
          line.setData(s.data.map(function (q) {
            return { time: Math.floor(q.t / 1000), value: Math.round(q.v * 100) / 100 };
          }));
        });
        chart.timeScale().fitContent();
        host.__chart = chart;
        window.addEventListener('resize', function () {
          try { chart.applyOptions({ width: host.clientWidth }); } catch (e) { }
        });
      } catch (e) {
        host.innerHTML = '<div class="gmute">تعذّر رسم الشارت — الأرقام في الجدول تحت.</div>';
      }
    }).catch(function () {
      host.innerHTML = '<div class="gmute">تعذّر تحميل مكتبة الرسم — الأرقام في الجدول تحت.</div>';
    });
  }

  /* ══════════════════════════════════════════════════════════
     ⑥ الميزان — المقارنة المرئية
     ══════════════════════════════════════════════════════════ */
  function balanceHtml(cmp) {
    var rows = cmp.rows.filter(function (r) { return r.real != null; });
    if (rows.length < 2) {
      return '<div class="gbal-empty">مفيش أصول قابلة للمقارنة في الفترة دي.</div>';
    }
    rows.sort(function (a, b) { return b.real - a.real; });
    var best = rows[0], worst = rows[rows.length - 1];
    /* ⭐ زاوية الميزان: الفرق بين الأعلى والأدنى (0 ⇒ مستوية)
       📌 الفائز **دايمًا** على اليمين (يمين فيزيائي) ⇒ الميل ثابت الاتجاه
          (مش متبدّل حسب مين الفائز) ⇒ العين بتفهم immediatly. */
    var diff = Math.abs(best.real - worst.real);
    var tilt = Math.max(2, Math.min(9, diff / 3));
    return '<div class="gbal" role="img" aria-label="مقارنة الأصول">' +
      '<div class="gbal-beam">' +
      '<div class="gbal-pivot" style="transform:rotate(-' + tilt.toFixed(2) + 'deg)">' +
      '<div class="gbal-stick"></div>' +
      '</div>' +
      /* ⭐ الشريطينبرا من الـpivot (عرضه 2px) ⇒ لازم يكونوا أبناء الـbeam */
      '<div class="gbal-scale gbal-scale-l">' +
      '<span class="gbal-sname">' + esc(worst.meta.icon + ' ' + worst.meta.name) + '</span>' +
      '<span class="gbal-sval ' + sgnCls(worst.real) + '">' + sgn(worst.real, 1) + '</span>' +
      '</div>' +
      '<div class="gbal-scale gbal-scale-r">' +
      '<span class="gbal-sname">' + esc(best.meta.icon + ' ' + best.meta.name) + '</span>' +
      '<span class="gbal-sval ' + sgnCls(best.real) + '">' + sgn(best.real, 1) + '</span>' +
      '</div>' +
      '<div class="gbal-base"></div>' +
      '</div>' +
      /* ⭐ كارت الفائز — **تحت** الميزان (مش فوقيه) ⇒ مفيش تداخل */
      '<div class="gbal-winner ' + (best.key === 'gold' ? 'is-gold' : '') + '">' +
      '<span class="gbal-winner-n">' + best.meta.icon + ' ' + esc(best.meta.name) + '</span>' +
      '<span class="gbal-winner-v ' + sgnCls(best.real) + '">' + sgn(best.real, 1) + '</span>' +
      '<span class="gbal-winner-s">الأعلى عائداً حقيقياً (بعد التضخم) في الفترة دي</span>' +
      '</div>' +
      '<div class="gbal-bars">' + cmp.rows.map(function (r) {
        if (r.real == null) {
          return '<div class="gbar gbar-na"><span class="gbar-n">' + esc(r.meta.icon + ' ' + r.meta.name) +
            '</span><span class="gbar-v">غير متاح</span></div>';
        }
        var max = Math.max.apply(null, cmp.rows.map(function (x) { return x.real == null ? 0 : Math.abs(x.real); }));
        var w = max > 0 ? Math.max(3, Math.round(Math.abs(r.real) / max * 100)) : 0;
        return '<div class="gbar"><span class="gbar-n">' + esc(r.meta.icon + ' ' + r.meta.name) + '</span>' +
          '<span class="gbar-track"><span class="gbar-fill ' + sgnCls(r.real) + '" style="width:' + w + '%"></span></span>' +
          '<span class="gbar-v ' + sgnCls(r.real) + '">' + sgn(r.real, 1) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="gbal-note">⚖️ الميزان يقارن العائد الحقيقي (بعد التضخم) — لأن ده العائد اللي بيفرق في جيبك فعلاً. والأرقام الاسمية تحت.</div>';
  }

  /* ══════════════════════════════════════════════════════════
     ⑦ الجدول + مثال ١٠٠ ألف جنيه
     ══════════════════════════════════════════════════════════ */
  function tableHtml(cmp) {
    var infl = cmp.infl;
    var head = '<tr><th>الفترة</th><th>الذهب المصري</th><th>EGX30</th><th>الدولار/الجنيه</th><th>شهادات الادخار</th><th>التضخم في الفترة</th><th>الأعلى (اسمي)</th></tr>';
    var body = cmp.allRows.map(function (r) {
      var best = null;
      r.cmp.rows.forEach(function (x) {
        if (x.nominal == null) return;
        if (!best || x.nominal > best.nominal) best = x;
      });
      return '<tr class="gtr' + (r.cmp.period.key === cmp.period.key ? ' is-on' : '') + '">' +
        '<td class="gtl">' + esc(r.cmp.period.label) +
        '<small>' + dtxt(r.cmp.period.from) + ' ← ' + dtxt(r.cmp.period.to) + '</small></td>' +
        r.cmp.rows.map(function (x) {
          if (x.nominal == null) return '<td class="gtc gt-na">غير متاح</td>';
          var ex = '';
          if (x.extra && x.extra.partial && x.extra.monthsUsed) {
            ex = '<small class="gt-part">محسوب على ' + num(x.extra.monthsUsed, 0) + ' شهر</small>';
          }
          return '<td class="gtc ' + sgnCls(x.nominal) + '">' + sgn(x.nominal, 1) +
            (x.real != null ? '<small>حقيقي ' + sgn(x.real, 1) + '</small>' : '') + ex + '</td>';
        }).join('') +
        '<td class="gtc gt-infl">' + (infl && infl.pct != null ? sgn(infl.pct, 1) : '—') + '</td>' +
        '<td class="gtc gt-win">' + (best ? esc(best.meta.icon + ' ' + best.meta.name.split(' ')[0]) : '—') + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="gtbl-wrap"><table class="gtbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  function exampleHtml(cmp) {
    var AMOUNT = 100000;
    var infl = cmp.infl;
    var cards = cmp.rows.map(function (r) {
      if (r.nominal == null) {
        return '<div class="gex gex-na"><div class="gex-n">' + esc(r.meta.icon + ' ' + r.meta.name) +
          '</div><div class="gex-v">غير متاح</div><div class="gex-s">المصدر مش متاح للفترة دي</div></div>';
      }
      var nom = AMOUNT * (1 + r.nominal / 100);
      var real = r.real == null ? null : AMOUNT * (1 + r.real / 100);
      var exn = (r.extra && r.extra.partial && r.extra.monthsUsed)
        ? '<div class="gex-s">محسوب على ' + num(r.extra.monthsUsed, 0) + ' شهر من المصدر</div>' : '';
      return '<div class="gex">' +
        '<div class="gex-n">' + esc(r.meta.icon + ' ' + r.meta.name) + '</div>' +
        '<div class="gex-v">' + num(nom, 0) + ' <small>ج.م</small></div>' +
        '<div class="gex-s">من ' + num(AMOUNT, 0) + ' ج.م · ' + sgn(r.nominal, 1) + ' اسمي</div>' +
                  exn +
          (real != null ? '<div class="gex-r">بعد التضخم: ' + num(real, 0) + ' ج.م <small>(' + sgn(r.real, 1) + ')</small></div>' : '') +
        '</div>';
    }).join('');
    return '<div class="gex-wrap">' + cards + '</div>' +
      '<div class="gex-note">💰 المثال: ' + num(AMOUNT, 0) + ' جنيه في بداية الفترة (' + dtxt(cmp.period.from) +
      ') · قيمة اليوم (' + dtxt(cmp.period.to) + ') بالأسعار الفعلية — قبل أي رسوم أو ضرائب.</div>';
  }

  /* ══════════════════════════════════════════════════════════
     ⑧ المودال
     ══════════════════════════════════════════════════════════ */
  var MODAL_ID = 'egy-gold-modal';
  function closeEgy() {
    var w = document.getElementById(MODAL_ID);
    if (!w) return;
    try { if (w.__chart) w.__chart.remove(); } catch (e) { }
    w.remove();
    document.body.style.overflow = '';
    document.body.classList.remove('eg-lock');
  }
  function escKey(e) { if (e.key === 'Escape') closeEgy(); }

  function openEgy(tab) {
    var old = document.getElementById(MODAL_ID);
    if (old) old.remove();
    var w = document.createElement('div');
    w.id = MODAL_ID;
    w.className = 'gmodal egmodal';
    w.innerHTML =
      '<div class="gback" data-close></div>' +
      '<div class="gpanel egpanel" role="dialog" aria-modal="true" aria-label="الذهب المصري">' +
      '<div class="ghead">' +
      '<div class="ocm-row1"><div class="ghead-t">🥇 الذهب المصري</div>' +
      '<span class="egprice" id="egp-price">…</span></div>' +
      '<div class="ocm-row2">' +
      /* ⛔⛔⛔ أحمد طلب: بلا مستطيل سيرش · بلا علامة كاميرا · بلا علامة تكبير */
      '<span class="egchg" id="egp-chg"></span>' +
      '<button class="gclose ocm-close" data-close aria-label="اقفل">✕</button>' +
      '</div></div>' +
      '<div class="gtabs" id="egtabs" role="tablist">' +
      '<button class="gtab is-on" type="button" role="tab" data-tab="cmp" aria-selected="true">المقارنة</button>' +
      '<button class="gtab" type="button" role="tab" data-tab="deep" aria-selected="false">السرد</button>' +
      '<button class="gtab" type="button" role="tab" data-tab="save" aria-selected="false">الادخار</button>' +
      '</div>' +
      '<div class="gbody" id="egbody"><div class="gload">🔄 بنجيب بيانات الذهب المصري…</div></div>' +
      '</div>';
    document.body.appendChild(w);
    document.body.style.overflow = 'hidden';
    document.body.classList.add('eg-lock');
    w.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close')) closeEgy();
    });
    document.addEventListener('keydown', escKey);

    var TAB = (tab === 'save') ? 'save' : (tab === 'deep' ? 'deep' : 'cmp');
    function paintTabs() {
      var bs = w.querySelectorAll('#egtabs .gtab');
      for (var i = 0; i < bs.length; i++) {
        var on = bs[i].getAttribute('data-tab') === TAB;
        bs[i].classList.toggle('is-on', on);
        bs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      }
    }
    function showTab(t) {
      TAB = t; paintTabs();
      var b = w.querySelector('#egbody');
      if (!b) return;
      if (t === 'save') {
        try { if (w.__chart) { w.__chart.remove(); w.__chart = null; } } catch (e) { }
        if (window.OCTA_GOLD_SAVINGS && window.OCTA_GOLD_SAVINGS.render) {
          window.OCTA_GOLD_SAVINGS.render(b);
        } else { b.innerHTML = '<div class="gmute">قسم الادخار غير متاح.</div>'; }
        return;
      }
      if (t === 'deep') { renderDeep(b, D); return; }
      renderCompare(b, D, w);
    }
    paintTabs();
    /* ⭐⭐⭐ ربط التبويبات — من غيرها الضغط ما بيعملش حاجة */
    (function () {
      var btns = w.querySelectorAll('#egtabs .gtab');
      for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function (e) {
          showTab(e.currentTarget.getAttribute('data-tab'));
        });
      }
    })();

    var D = null;
    load(false).then(function (d) {
      D = d;
      var p = document.getElementById('egp-price');
      var c = document.getElementById('egp-chg');
      if (p) p.innerHTML = num(d.last.gram, 0) + ' <small>ج.م / جرام</small>';
      if (c) c.innerHTML = (d.last.gramChangePct == null ? '' :
        '<span class="' + sgnCls(d.last.gramChangePct) + '">' + sgn(d.last.gramChangePct, 2) + '</span>') +
        '<span class="egchg-d">الدولار ' + num(d.last.fx, 3) + ' · DXY ' + num(d.last.dxy, 2) + '</span>';
      showTab(TAB);
    }).catch(function (e) {
      var b = w.querySelector('#egbody');
      if (b) b.innerHTML = '<div class="gmute">تعذّر تحميل البيانات: ' + esc(e.message || e) + '</div>';
    });
  }

  /* ── تبويب المقارنة ───────────────────────────────────── */
  function renderCompare(body, D, w) {
    var periods = buildPeriods(D);
    var cmp = compare(D, periods[0]);
    cmp.allRows = periods.map(function (p) { return { cmp: compare(D, p) }; });
    body.innerHTML =
      '<div class="egsec"><div class="egsec-h">⚖️ الميزان — مين كسب؟</div>' +
      '<div class="egperiods" id="egperiods">' + periods.map(function (p, i) {
        return '<button class="egper' + (i === 0 ? ' is-on' : '') + '" data-p="' + p.key + '">' + esc(p.label) + '</button>';
      }).join('') + '</div>' +
      '<div id="egbal"></div></div>' +
      '<div class="egsec"><div class="egsec-h">📈 المقارنة — كل الأصول على ١٠٠</div>' +
      '<div class="egchart" id="egchart"></div>' +
      '<div class="eglegend" id="eglegend"></div></div>' +
      '<div class="egsec"><div class="egsec-h">📋 الأرقام — اسمي وحقيقي</div>' +
      '<div id="egtable"></div></div>' +
      '<div class="egsec"><div class="egsec-h">💰 لو حطيت ١٠٠٬٠٠٠ جنيه…</div>' +
      '<div id="egex"></div></div>' +
      '<div class="egsec eg-src" id="egsrc"></div>';

    var sources = [
      ['سعر الجرام والدولار', 'TradingView (نفس رمز الماسح) — ' + (D.goldFrom || '—') + ' → ' + (D.goldTo || '—') + ' (' + (D.gold.length) + ' يوم)'],
      ['مؤشر EGX30', (D.egxMeta && D.egxMeta.source && D.egxMeta.source.history) ? D.egxMeta.source.history : 'TradingView websocket — إغلاقات يومية'],
      ['شهادات الادخار', 'البنك المركزي المصري — نشرة الإحصاء الشهري + Economic Review (2/5/1)'],
      ['التضخم', 'البنك الدولي — CPI مصر' + (D.last.inflDate ? ' · آخر تحديث ' + D.last.inflDate : '')],
      ['DXY', 'TradingView — TVC:DXY']
    ];
    document.getElementById('egsrc').innerHTML = '<div class="egsec-h">📎 المصادر</div>' +
      sources.map(function (s) {
        return '<div class="egsrc-i"><b>' + esc(s[0]) + ':</b> ' + esc(s[1]) + '</div>';
      }).join('') +
      '<div class="egnote">⛔ المقارنة على نفس تاريخ البداية والنهاية لكل الأصول (النهاية ' + dtxt(D.commonTo || '') + ' — أقدم تاريخ متاح في كل المصادر). ' +
      'العائد الحقيقي = العائد الاسمي ÷ التضخم.<br>' +
      '🏦 الشهادات: مركّب شهري من معدّل البنك المركزي (شهادة ٣ شهور). لو المصدر ناقص جزء من الفترة، ' +
      'النسبة بتتحسب على الشهور المتاحة بس وبتبان مكتوب جنبها.</div>';


    function paint(periodKey) {
      var p = periods.filter(function (x) { return x.key === periodKey; })[0] || periods[0];
      var c = compare(D, p);
      document.getElementById('egbal').innerHTML = balanceHtml(c);
      document.getElementById('egtable').innerHTML = tableHtml({ period: p, rows: c.rows, allRows: cmp.allRows, infl: c.infl });
      document.getElementById('egex').innerHTML = exampleHtml(c);
      drawCompare(document.getElementById('egchart'), D, p, c);
      /* الليجند */
      document.getElementById('eglegend').innerHTML = ASSETS.map(function (a) {
        return '<span class="eglg"><i style="background:' + a.color + '"></i>' + esc(a.icon + ' ' + a.name) + '</span>';
      }).join('');
      var btns = body.querySelectorAll('#egperiods .egper');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('is-on', btns[i].getAttribute('data-p') === periodKey);
      }
    }
    var bar = body.querySelector('#egperiods');
    if (bar) {
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('.egper');
        if (b) paint(b.getAttribute('data-p'));
      });
    }
    paint(periods[0].key);
  }

  /* ── تبويب السرد ─────────────────────────────────────── */
  function renderDeep(body, D) {
    var f = D.factors || {};
    var rows = [
      ['الجرام عيار ٢٤', num(D.last.gram, 0) + ' ج.م', 'محسوب من الأونصة × الدولار'],
      ['الأونصة (عالمي)', num(D.last.xau, 2) + ' دولار', 'TradingView'],
      ['الدولار/الجنيه', num(D.last.fx, 3) + ' ج.م', 'TradingView FX_IDC:USDEGP'],
      ['مؤشر الدولار DXY', num(D.last.dxy, 2), 'TradingView TVC:DXY'],
      ['التضخم المصري', D.last.infl == null ? 'غير متاح' : num(D.last.infl, 1) + '٪', 'البنك المركزي (CAPMAS)'],
      ['فائدة الإيداع الليلي', D.last.policy == null ? 'غير متاح' : num(D.last.policy, 2) + '٪', 'البنك المركزي المصري'],
      ['سلسلة الذهب', (D.goldFrom || '—') + ' → ' + (D.goldTo || '—'), (D.gold.length) + ' يوم']
    ];
    body.innerHTML = '<div class="egsec"><div class="egsec-h">📌 حالة الذهب المصري</div>' +
      '<div class="egkv">' + rows.map(function (r) {
        return '<div class="egkv-r"><span class="egkv-l">' + esc(r[0]) + '</span>' +
          '<span class="egkv-v">' + r[1] + '</span>' +
          '<span class="egkv-s">' + esc(r[2]) + '</span></div>';
      }).join('') + '</div></div>' +
      '<div class="egsec"><div class="egsec-h">💡 ليه الذهب المصري مش الذهب العالمي؟</div>' +
      '<div class="egtxt">سعر الجرام بالجنيه = سعر الأونصة بالدولار × سعر الدولار بالجنيه ÷ ٣١٫١٠٣٥ جرام. ' +
      '<b>يعني أي جزء من مكسب الذهب المصري جه من الدولار نفسه</b> — وده بالظبط اللي بيشيله الميزان جواه: ' +
      'لما الدولار يطلع، الذهب المصري بيكسب مرتين (من الذهب + من سعر الصرف).</div></div>';
  }

  /* ══════════════════════════════════════════════════════════
     ⑨ الكارت — «الذهب المصري» في مؤشرات السوق المصري
     ══════════════════════════════════════════════════════════ */
  function tileHtml() {
    /* ⛔⛔ ممنوع onclick inline (قاعدة المشروع) ⇒ بنربط بـaddEventListener */
    return '<div class="mini eg-tile" data-eg-open="1" ' +
      'style="cursor:pointer" title="اضغط لتحليل الذهب المصري ومقارنة الأصول" role="button" tabindex="0">' +
      '<div class="mini-n">🥇 الذهب المصري</div>' +
      '<div class="mini-v" id="egtile-v">…</div>' +
      '<div class="mini-c" id="egtile-c">—</div>' +
      '<div class="egtile-bal" id="egtile-bal"><span class="egtile-bal-t">⚖️ …</span></div>' +
      '<div class="mini-sub">اضغط للمقارنة</div>' +
      '</div>';
  }
  function paintTile() {
    var v = document.getElementById('egtile-v');
    if (!v) return;
    /* ⭐ ربط النقر (مرة واحدة) */
    var tile = v.closest('[data-eg-open]');
    if (tile && !tile.__wired) {
      tile.__wired = true;
      tile.addEventListener('click', function () { openEgy('cmp'); });
      tile.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openEgy('cmp'); }
      });
    }
    load(false).then(function (D) {
      /* ⛔⛔⛔ الداشبورد بيت rebuilding ⇒ العنصر اللي grabbed ممكن يكون
         اتفصل عن الـDOM ⇒ لازم نرجع نسأل تاني وقت الرسم. */
      var v = document.getElementById('egtile-v');
      if (!v) return;
      v.textContent = num(D.last.gram, 0);
      var c = document.getElementById('egtile-c');
      if (c) {
        var ch = D.last.gramChangePct;
        c.className = 'mini-c ' + sgnCls(ch);
        c.innerHTML = ch == null ? '—' : (ch >= 0 ? '▲ +' : '▼ ') + num(Math.abs(ch), 2) + '%';
      }
      /* ⭐ الميزان المصغّر: الذهب مقابل EGX30 على آخر سنة */
      var bal = document.getElementById('egtile-bal');
      if (!bal) return;
      var p = buildPeriods(D);
      var one = p.filter(function (x) { return x.key === '1Y'; })[0] || p[0];
      var c2 = compare(D, one);
      var g = c2.rows[0], e = c2.rows[1];
      if (g.nominal == null || e.nominal == null) { bal.innerHTML = '<span class="egtile-bal-t">⚖️ غير متاح</span>'; return; }
      var win = g.nominal >= e.nominal;
      bal.innerHTML = '<span class="egtile-bal-t">⚖️ ' +
        (win ? 'الذهب' : 'EGX30') + ' أعلى على ' + esc(one.label) +
        ' (<bdi dir="ltr">' + num(Math.max(g.nominal, e.nominal), 1) + '%</bdi>)</span>';
    }).catch(function () {
      var v2 = document.getElementById('egtile-v');
      if (v2) v2.textContent = 'غير متاح';
    });
  }

  /* ⭐⭐⭐ مراقب إعادة البناء — الداشبورد بيعيد رسم الكروت ⇒ الكارت الجديد
     بيبدأ فاضي ⇒ لازم نرسمه تاني أول ما يظهر. */
  function watchTile() {
    if (watchTile.__on) return;
    watchTile.__on = true;
    var t = null;
    function check() {
      var el = document.getElementById('egtile-v');
      if (el && el.textContent === '…') paintTile();
    }
    try {
      var mo = new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(check, 250);
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) { }
  }

  /* ── التصدير ─────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchTile);
  } else { watchTile(); }

  window.OCTAGoldEgy = {
    load: load,
    open: openEgy,
    close: closeEgy,
    tile: tileHtml,
    paintTile: paintTile,
    compare: compare,
    buildPeriods: buildPeriods
  };
  window.openEgyGold = openEgy;
})();
