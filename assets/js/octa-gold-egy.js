/* ══════════════════════════════════════════════════════════════════
   🐙 OCTA · octa-gold-egy.js — الذهب المصري: تحليل + مقارنة الأصول
   (١٤ → ١٥ نوفمبر ٢٠٢٦)
   ══════════════════════════════════════════════════════════════════
   📌 الهدف:
      ① الصفحة الرئيسية للمودال = **تحليل الذهب المصري** (الشارت +
         مناطق الدعم/المقاومة + العوامل المؤثرة + تفكيك السعر).
      ② زرار ⚖️ **جنب زرار الإغلاق** ⇒ يفتح المقارنة بين الأصول.
      ③ كارت «الذهب المصري» في مؤشرات السوق المصري.

   ⛔⛔ قواعد المحتوى:
      · مفيش أي رقم مخترع — اللي مش موجود بيتكتب «غير متاح».
      · كل رقم ليه مصدر مكتوب تحت.
      · مقارنة على **نفس تاريخ البداية والنهاية** لكل الأصول.
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
  function pctOf(a, b) { return b == null || a == null ? null : (b / a - 1) * 100; }

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
    var techP = jf('/api/gold/technical?instrument=gram')
      .catch(function () { return null; });
    /* ⭐⭐⭐ سعر السوق المصري (مرجع تجاري) + السعر الحيّ المحسوب */
    var localP = jf('/api/gold/local').catch(function () { return null; });
    var liveP = jf('/api/gold').catch(function () { return null; });

    return Promise.all([
      jf('/api/gold/history'),
      jf('/api/indices/EGX30/analysis'),
      jf('/api/gold/factors'),
      jf('/api/gold/scenarios'),
      certP, techP, localP, liveP
    ]).then(function (r) {
      var hist = r[0], idx = r[1], fac = r[2], sav = r[3], cert = r[4], tech = r[5];
      var local = r[6], live = r[7];
      if (!hist || !hist.ok || !(hist.series || []).length) {
        throw new Error((hist && hist.error) || 'تاريخ الذهب غير متاح');
      }
      var D = {
        gold: [],      // {t, d, gram, fx, ounce}
        egx: [],       // {t, v}
        factors: (fac && fac.ok && fac.factors) || {},
        savings: (sav && sav.ok && sav.savings) || null,
        caveats: (sav && sav.caveats) || [],
        cert: cert,
        tech: (tech && tech.ok) ? tech : null,
        /* ⭐ سوق الذهب المصري (مرجع تجاري) — للمقارنة بالسعر المرجعي المحسوب */
        local: (local && local.ok) ? local : null,
        /* ⭐ السعر المرجعي الحيّ (الذهب العالمي × سعر الصرف ÷ ٣١٫١٠٣٥) */
        live: (live && live.gram_egp != null) ? live : null,
        snapshot: hist.snapshot_id || (sav && sav.snapshot_id) || null
      };
      /* الذهب + الدولار (نفس السلسلة ⇒ نفس المصدر) */
      (hist.series || []).forEach(function (p) {
        if (p.gram == null && p.egp_per_usd == null) return;
        var t = Date.parse(p.d + 'T00:00:00Z');
        if (isNaN(t)) return;
        D.gold.push({ t: t, d: p.d, gram: p.gram, fx: p.egp_per_usd, ounce: p.ounce_egp });
      });
      /* ⛔⛔ السلسلة مش مرتبة في الباك ⇒ رتّب قبل أي بحث */
      D.gold.sort(function (a, b) { return a.t - b.t; });
      D.egx = [];
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
      D.goldFrom = D.gold.length ? D.gold[0].d : null;
      D.goldTo = D.gold.length ? D.gold[D.gold.length - 1].d : null;
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
      /* التغير اليومي للجرام */
      var prev = null, chg = null;
      for (var i = D.gold.length - 1; i >= 0 && i > D.gold.length - 12; i--) {
        var g = D.gold[i];
        if (g.gram == null) continue;
        if (prev == null) { prev = g.gram; continue; }
        chg = (prev != null) ? ((g.gram / prev - 1) * 100) : null;
        break;
      }
      D.last.gramChangePct = chg;
      /* ⭐ السعر المرجعي الحيّ (لو متاح ⇒ أدق من آخر نقطة في السلسلة) */
      if (D.live && D.live.gram_egp != null) {
        D.last.gramLive = Number(D.live.gram_egp);
        D.last.ounceUsdLive = D.live.ounce_usd != null ? Number(D.live.ounce_usd) : null;
        D.last.fxLive = D.live.egp_per_usd != null ? Number(D.live.egp_per_usd) : null;
        D.last.liveAt = D.live.updated || null;
      } else { D.last.gramLive = null; }
      /* ⭐ سعر السوق المصري */
      D.last.marketGram = (D.local && D.local.gram_24_reference != null)
        ? Number(D.local.gram_24_reference) : null;
      D.last.marketSource = D.local ? (D.local.source || '') : '';
      D.last.marketAt = D.local ? (D.local.updated_text || '') : '';
      D.last.marketFresh = D.local ? (D.local.freshness || null) : null;
      D.last.marketUrl = D.local ? (D.local.source_url || '') : '';
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
    /* ⭐⭐⭐ نافذة المقارنة لازم تكون واحدة لكل الأصول
       (سلسلة المؤشر بتقف قبل سلسلة الذهب ⇒ ناخد أقدم تاريخ). */
    var goldTo = D.goldTo;
    var egxTo = D.egx.length ? new Date(D.egx[D.egx.length - 1].t).toISOString().slice(0, 10) : null;
    var commonTo = goldTo;
    if (egxTo && goldTo && egxTo < goldTo) commonTo = egxTo;
    D.commonTo = commonTo;
    var anchor = commonTo ? Date.parse(commonTo + 'T00:00:00Z') : Date.now();
    function back(days) {
      return new Date(anchor - days * 86400000).toISOString().slice(0, 10);
    }
    function ytd() { return String(new Date(anchor).getUTCFullYear()) + '-01-01'; }
    out.push({ key: '1M', label: 'شهر', from: back(30), to: commonTo, short: 'شهر' });
    out.push({ key: '3M', label: '٣ شهور', from: back(91), to: commonTo, short: '٣ شهور' });
    out.push({ key: '6M', label: '٦ شهور', from: back(182), to: commonTo, short: '٦ شهور' });
    out.push({ key: 'YTD', label: 'من بداية السنة', from: ytd(), to: commonTo, short: 'سنة' });
    [[1, 'سنة'], [3, '٣ سنين'], [5, '٥ سنين'], [10, '١٠ سنين'], [20, '٢٠ سنة']].forEach(function (p) {
      var r = byYears[p[0]];
      if (!r) return;
      out.push({ key: p[0] + 'Y', label: p[1], from: r.from, to: commonTo, short: p[1], row: r, savTo: r.to });
    });
    out.forEach(function (p) {
      var a = Date.parse(p.from + 'T00:00:00Z'), b = Date.parse(p.to + 'T00:00:00Z');
      p.days = Math.max(1, Math.round((b - a) / 86400000));
      p.years = p.days / 365.25;
    });
    return out;
  }

  /* ══════════════════════════════════════════════════════════
     ③ حساب العائد لكل أصل
     ══════════════════════════════════════════════════════════ */
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
    var used = 0, missed = 0, prod = 1, lastKey = null, firstKeyUsed = null;
    var y = new Date(a).getUTCFullYear(), m = new Date(a).getUTCMonth() + 1;
    var endY = new Date(b).getUTCFullYear(), endM = new Date(b).getUTCMonth() + 1;
    var guard = 0;
    while ((y * 12 + m) <= (endY * 12 + endM) && guard < 400) {
      guard++;
      var key = y + '-' + String(m).padStart(2, '0');
      var r = rates[key];
      if (r && r.dep_3m != null) {
        prod *= Math.pow(1 + Number(r.dep_3m) / 100, 1 / 12);
        used++; lastKey = key;
        if (!firstKeyUsed) firstKeyUsed = key;
      } else { missed++; }
      m++; if (m > 12) { m = 1; y++; }
    }
    if (!used) return null;
    var firstKey = keys[0];
    var fy = parseInt(firstKey.slice(0, 4), 10), fm = parseInt(firstKey.slice(5, 7), 10);
    var sy = new Date(a).getUTCFullYear(), sm = new Date(a).getUTCMonth() + 1;
    if (sy * 12 + sm < fy * 12 + fm) {
      return { unavailable: true, from: firstKey, monthsUsed: used, monthsMissed: missed };
    }
    /* ⭐⭐⭐ التغطية: البنك المركزي بينشر بتأخير ⇒ آخر شهر متاح قبل نهاية الفترة.
       بنحسب العائد على الشهور المتاحة بس + مكافئ سنوي عشان المقارنة تبقى apple-to-apple. */
    var monthsInPeriod = Math.max(1, Math.round((b - a) / 86400000 / 30.44));
    var annual = (Math.pow(1 + (prod - 1), monthsInPeriod / used) - 1) * 100;
    return {
      pct: (prod - 1) * 100, annual: annual, monthsUsed: used, monthsMissed: missed,
      firstKey: firstKeyUsed, lastKey: lastKey, partial: missed > 0,
      monthsInPeriod: monthsInPeriod, lagMonths: Math.max(0, monthsInPeriod - used)
    };
  }
  function inflationFor(D, p) {
    if (p.row && p.row.real && p.row.real.inflation_pct != null) {
      return {
        pct: Number(p.row.real.inflation_pct),
        label: 'البنك الدولي — CPI مصر · ' + (p.row.real.inflation_window || '')
      };
    }
    /* ⭐⭐⭐ لو الباك عنده صف للفترة بس من غير تضخم (زي ٢٠ سنة) ⇒ مش بنخمّن
       ⛔ لأن الرقم الحقيقي لو معروف كان المفروض يبقى موجود ⇒ نسيبه «غير متاح». */
    if (p.row) return null;
    if (D.last.infl != null) {
      var yrs = Math.max(p.years, 1 / 365);
      return {
        pct: (Math.pow(1 + Number(D.last.infl) / 100, yrs) - 1) * 100,
        label: 'معدل التضخم السنوي الحالي (البنك المركزي) ' + num(D.last.infl, 1) + '٪'
      };
    }
    return null;
  }
  function realOf(nomPct, inflPct) {
    if (nomPct == null || inflPct == null) return null;
    return ((1 + nomPct / 100) / (1 + inflPct / 100) - 1) * 100;
  }
  /* ⭐⭐⭐ تحويل أي عائد لمعدّل مكافئ على عدد شهور معيّن
     (بنستخدمه للشهادات بس: مصدرها متأخر ⇒ بتغطّي شهور أقل من الفترة) */
  function scaleTo(pct, fromMonths, toMonths) {
    if (pct == null || !fromMonths || !toMonths) return null;
    return (Math.pow(1 + pct / 100, toMonths / fromMonths) - 1) * 100;
  }

  var ASSETS = [
    { key: 'gold', name: 'الذهب المصري', unit: 'جرام عيار ٢٤ (ج.م)', color: '#d4af37', icon: '🥇' },
    { key: 'egx', name: 'مؤشر EGX30', unit: 'نقطة', color: '#38bdf8', icon: '📊' },
    { key: 'usd', name: 'الدولار/الجنيه', unit: 'ج.م للدولار', color: '#a78bfa', icon: '💵' },
    { key: 'cert', name: 'شهادات الادخار', unit: 'مركّب شهري (البنك المركزي)', color: '#22c55e', icon: '🏦' }
  ];

  function mk(key, meta, r, infl, p, extra) {
    var nominal = (r && !r.unavailable && r.pct != null) ? r.pct : null;
    var months = p.days / 30.44;                 /* شهور الفترة */
    var covered = months;                        /* الشهور المغطاة فعليًا */
    var inflUsed = (infl && infl.pct != null) ? infl.pct : null;
    var display = nominal;                       /* الرقم المعروض للمقارنة */
    /* ⭐⭐⭐ الشهادات: البنك المركزي بينشر بتأخير ⇒ بتغطي شهور أقل من الفترة.
       بنسوّي الرقم لعدد شهور الفترة + بنقسّم التضخم على نفس الشهور
       ⇒ المقارنة تبقى صح (apples-to-apples) من غير ما نكبّر أرقام الفترات القصيرة. */
    if (extra && extra.monthsUsed) {
      covered = Math.max(1, extra.monthsUsed);
      display = scaleTo(nominal, covered, months);
      if (inflUsed != null && months > 0) {
        inflUsed = (Math.pow(1 + inflUsed / 100, covered / months) - 1) * 100;
      }
    }
    var real = realOf(display, inflUsed);
    var cagr = null;
    if (nominal != null && p.years > 0.35) {
      cagr = (Math.pow(1 + nominal / 100, 1 / p.years) - 1) * 100;
    }
    return {
      key: key, meta: meta, nominal: nominal, display: display, real: real,
      cagr: cagr, coveredMonths: covered, inflUsed: inflUsed,
      start: r ? r.start : null, end: r ? r.end : null, extra: extra || null
    };
  }
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
    rows.push(mk('cert', ASSETS[3], c ? { pct: c.pct } : null, infl, p, c));
    return { period: p, rows: rows, infl: infl, certLast: lastCertMonth(D) };
  }
  /* ⭐ آخر شهر متاح في سلسلة شهادات البنك المركزي (المصدر بيتأخر) */
  function lastCertMonth(D) {
    var rates = (D && D.cert && D.cert.rates) || {};
    var ks = Object.keys(rates).sort();
    return ks.length ? ks[ks.length - 1] : null;
  }

  /* ══════════════════════════════════════════════════════════
     ④ إحصاء المخاطر (احترافي) — للتعبئة عن الأصل
     ══════════════════════════════════════════════════════════ */
  function riskOf(series, field, from, to) {
    var a = Date.parse(from + 'T00:00:00Z'), b = Date.parse(to + 'T00:00:00Z');
    var pts = series.filter(function (s) {
      var v = field ? s[field] : s.v;
      return s.t >= a && s.t <= b && v != null && v > 0;
    });
    if (pts.length < 3) return null;
    var rets = [], peak = -Infinity, maxDD = 0;
    for (var i = 1; i < pts.length; i++) {
      var v1 = field ? pts[i - 1][field] : pts[i - 1].v;
      var v2 = field ? pts[i][field] : pts[i].v;
      if (!v1 || !v2) continue;
      rets.push(Math.log(v2 / v1));
      peak = Math.max(peak, v2);
      if (peak > 0) maxDD = Math.min(maxDD, (v2 / peak - 1) * 100);
    }
    if (rets.length < 2) return null;
    var mean = rets.reduce(function (a, b) { return a + b; }, 0) / rets.length;
    var va = rets.reduce(function (s, r) { return s + (r - mean) * (r - mean); }, 0) / (rets.length - 1);
    var vol = Math.sqrt(va) * Math.sqrt(365) * 100;
    var years = (pts[pts.length - 1].t - pts[0].t) / 86400000 / 365.25;
    var v0 = field ? pts[0][field] : pts[0].v;
    var vN = field ? pts[pts.length - 1][field] : pts[pts.length - 1].v;
    var total = (vN / v0 - 1) * 100;
    var cagr = years > 0.3 ? (Math.pow(vN / v0, 1 / years) - 1) * 100 : total;
    return {
      vol: vol, maxDD: maxDD, cagr: cagr, total: total, days: pts.length,
      calmar: (maxDD < 0) ? cagr / Math.abs(maxDD) : null
    };
  }
  /* العوائد السنوية (لكل أصل) */
  function yearlyReturns(series, field) {
    var byYear = {};
    series.forEach(function (s) {
      var v = field ? s[field] : s.v;
      if (v == null || !v) return;
      var y = new Date(s.t).getUTCFullYear();
      byYear[y] = v;                 /* آخر قيمة في السنة */
    });
    var years = Object.keys(byYear).map(Number).sort(function (a, b) { return a - b; });
    var out = [];
    for (var i = 1; i < years.length; i++) {
      var p0 = byYear[years[i - 1]], p1 = byYear[years[i]];
      if (!p0 || !p1) continue;
      out.push({ year: years[i], pct: (p1 / p0 - 1) * 100 });
    }
    return out;
  }
  function certYearly(D) {
    var rates = (D.cert && D.cert.rates) || {};
    var keys = Object.keys(rates).sort();
    var byYear = {};
    keys.forEach(function (k) {
      var y = parseInt(k.slice(0, 4), 10);
      if (!byYear[y]) byYear[y] = 1;
      byYear[y] *= Math.pow(1 + Number(rates[k].dep_3m) / 100, 1 / 12);
    });
    var years = Object.keys(byYear).map(Number).sort(function (a, b) { return a - b; });
    var out = [];
    for (var i = 1; i < years.length; i++) {
      out.push({ year: years[i], pct: (byYear[years[i]] / byYear[years[i - 1]] - 1) * 100 });
    }
    return out;
  }

  /* ══════════════════════════════════════════════════════════
     ⑤ الرسم — lightweight-charts
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
  function chartBase(host, height) {
    var lib = window.LightweightCharts;
    return lib.createChart(host, {
      localization: { locale: 'ar' },
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#8b9eb0', fontSize: 10, locale: 'ar'
      },
      grid: { vertLines: { color: 'rgba(255,255,255,.05)' }, horzLines: { color: 'rgba(255,255,255,.05)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,.12)', scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: {
        borderColor: 'rgba(255,255,255,.12)', timeVisible: false, rightOffset: 4,
        /* ⭐⭐⭐ تنسيق التواريخ بالعربي: DD/MM (من غيره التواريخ بتطلع
           زي «12 26» وتبقى ملتبطة على الموبايل) */
        tickMarkFormatter: function (time) {
          var d = new Date(time * 1000);
          if (!d || isNaN(d.getTime())) return '';
          var dd = String(d.getUTCDate()).padStart(2, '0');
          var mm = String(d.getUTCMonth() + 1).padStart(2, '0');
          var yy = String(d.getUTCFullYear()).slice(2);
          return dd + '/' + mm + '/' + yy;
        }
      },
      crosshair: {
        mode: lib.CrosshairMode.Normal,
        vertLine: { color: 'rgba(212,175,55,.45)', width: 1, style: 2, labelBackgroundColor: '#8a6d12' },
        horzLine: { color: 'rgba(212,175,55,.45)', width: 1, style: 2, labelBackgroundColor: '#8a6d12' }
      },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
      height: height
    });
  }
  function sma(pts, n) {
    /* ⛔⛔⛔ الحقل اسمه value مش v — كان بيسبّب NaN والخطّ مش بيظهر */
    var clean = [];
    for (var i = 0; i < pts.length; i++) {
      var v = (pts[i].value != null) ? pts[i].value : pts[i].v;
      if (v == null || isNaN(v)) continue;
      clean.push({ time: pts[i].time, value: v });
    }
    var out = [], sum = 0;
    for (var j = 0; j < clean.length; j++) {
      sum += clean[j].value;
      if (j >= n) sum -= clean[j - n].value;
      if (j >= n - 1) out.push({ time: clean[j].time, value: sum / n });
    }
    return out;
  }
  function segsFrom(rows, gapDays) {
    var segs = [], cur = [];
    rows.forEach(function (r, i) {
      if (i > 0) {
        var gap = (new Date(r.d) - new Date(rows[i - 1].d)) / 86400000;
        if (gap > gapDays) { if (cur.length) segs.push(cur); cur = []; }
      }
      cur.push({ time: Math.floor(new Date(r.d + 'T00:00:00Z').getTime() / 1000), value: r.gram });
    });
    if (cur.length) segs.push(cur);
    return segs.filter(function (s) { return s.length > 1; });
  }

  /* ── شارت الذهب المصري (احترافي: سعر + متوسطات + دعم/مقاومة) ── */
  function drawGoldChart(host, D, tech, p) {
    if (!host) return;
    var a = Date.parse(p.from + 'T00:00:00Z'), b = Date.parse(p.to + 'T00:00:00Z');
    var rows = D.gold.filter(function (r) { return r.t >= a && r.t <= b && r.gram != null; });
    if (rows.length < 5) { host.innerHTML = '<div class="gmute">مفيش بيانات كفاية للفترة دي.</div>'; return; }
    var pts = rows.map(function (r) {
      return { time: Math.floor(r.t / 1000), value: r.gram, d: r.d };
    });
    loadLib().then(function (lib) {
      try {
        host.innerHTML = '';
        var chart = chartBase(host, Math.max(250, Math.min(360, Math.round(window.innerHeight * 0.36))));
        var segs = segsFrom(rows, 5);
        var main = null;
        segs.forEach(function (sg) {
          var line = chart.addSeries(lib.LineSeries, {
            color: '#d4af37', lineWidth: 2,
            priceLineVisible: false, lastValueVisible: true
          });
          line.setData(sg);
          if (!main) main = line;
        });
        /* ⭐ المتوسطات المتحركة (20 / 50 / 200) — من الباك نفسه */
        var mas = (tech && tech.ma) || {};
        var maRows = rows.map(function (r) { return { time: Math.floor(r.t / 1000), value: r.gram }; });
        [['sma20', '#38bdf8', 'م20'], ['sma50', '#a78bfa', 'م50'], ['sma200', '#f59e0b', 'م200']].forEach(function (m) {
          if (mas[m[0]] == null) return;
          var data = sma(maRows, parseInt(m[0].slice(3), 10));
          if (!data.length) return;
          var s = chart.addSeries(lib.LineSeries, {
            color: m[1], lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false
          });
          s.setData(data);
        });
        /* ⭐ مناطق الدعم والمقاومة — خطان لكل منطقة + عنوان */
        var sr = (tech && tech.sr) || null;
        /* ⭐⭐⭐ فلتر القرب — مشترك بين الرسم والـautoscale */
        var curP = (sr && sr.current != null) ? sr.current : (D.last.gram || 0);
        function near(z) {
          if (!z) return false;
          var m = z.mid != null ? z.mid : z.center;
          if (m == null || !curP) return false;
          return Math.abs(m / curP - 1) <= 0.30;
        }
        if (sr && main) {
          /* ⭐⭐⭐⭐ على الشارت: **أقرب دعم + أقرب مقاومة بس** — أي منطقة أبعد
             بتمدّد النطاق مخلياً بالسعر appears مسطّح. الباقي موجود في الكارت. */
          var sup = sr.nearest_support ? [sr.nearest_support] : [];
          var res = sr.nearest_resistance ? [sr.nearest_resistance] : [];
          function zone(z, kind) {
            if (!z || z.low == null || z.high == null) return;
            var col = kind === 'support' ? 'rgba(34,197,94,.85)' : 'rgba(239,68,68,.85)';
            var title = (kind === 'support' ? 'دعم' : 'مقاومة') + ' ' + num(z.mid != null ? z.mid : z.center, 0);
            try {
              main.createPriceLine({
                price: z.high, color: col, lineWidth: 1, lineStyle: 3,
                axisLabelVisible: false, title: title
              });
              main.createPriceLine({
                price: z.low, color: col, lineWidth: 1, lineStyle: 3,
                axisLabelVisible: false, title: title
              });
            } catch (e) { }
          }
          sup.forEach(function (z) { zone(z, 'support'); });
          res.forEach(function (z) { zone(z, 'resistance'); });
        }
        /* خط السعر الحالي */
        try {
          main.createPriceLine({
            price: D.last.gram, color: '#d4af37', lineWidth: 1, lineStyle: 2,
            axisLabelVisible: true, title: 'السعر الآن'
          });
        } catch (e) { }
        /* ⭐⭐⭐⭐ لازم **مناطق الدعم والمقاومة تكون جوه نطاق الشارت** —
           من غير كده في الفترات القصيرة بيكونوا بره الشاشة والمستخدم
           مش هيشوف مناطق الشراء/البيع أصلاً.
           ✅ الحل: autoscaleInfoProvider يمدّد النطاق ليشمل أقرب دعم/مقاومة. */
        try {
          var lo = Infinity, hi = -Infinity;
          pts.forEach(function (q) { if (q.value < lo) lo = q.value; if (q.value > hi) hi = q.value; });
          /* ⭐ نفس فلتر القرب — عشان النطاق ما يتمددش لدرجة إن السعر يبقى مسطّح */
          var zones = [];
          if (sr && sr.nearest_support) zones.push(sr.nearest_support);
          if (sr && sr.nearest_resistance) zones.push(sr.nearest_resistance);
          zones.forEach(function (z) {
            var m = z.mid != null ? z.mid : z.center;
            if (m == null) return;
            lo = Math.min(lo, m); hi = Math.max(hi, m);
            if (z.low != null) lo = Math.min(lo, z.low);
            if (z.high != null) hi = Math.max(hi, z.high);
          });
          if (isFinite(lo) && isFinite(hi) && hi > lo) {
            var pad = (hi - lo) * 0.04;
            main.applyOptions({
              autoscaleInfoProvider: function () {
                return { priceRange: { minValue: lo - pad, maxValue: hi + pad } };
              }
            });
          }
        } catch (e) { }
        chart.timeScale().fitContent();
        host.__chart = chart;
        window.addEventListener('resize', function () {
          try { chart.applyOptions({ width: host.clientWidth }); } catch (e) { }
        });
      } catch (e) {
        host.innerHTML = '<div class="gmute">تعذّر رسم الشارت — الأرقام في الجداول تحت.</div>';
      }
    }).catch(function () {
      host.innerHTML = '<div class="gmute">تعذّر تحميل مكتبة الرسم.</div>';
    });
  }

  /* ── مقارنة الأصول (احترافي) ── */
  function normSeries(series, tFrom, tTo, field, step) {
    var v0 = valueAt(series, tFrom, field);
    if (v0 == null || !v0) return [];
    var out = [], last = -1e9;
    for (var i = 0; i < series.length; i++) {
      var s = series[i];
      if (s.t < tFrom) continue;
      if (tTo && s.t > tTo) break;          /* ⭐⭐⭐ يقف عند نهاية الفترة */
      if (step && (s.t - last) < step * 86400000) continue;
      var v = field ? s[field] : s.v;
      if (v == null || !v) continue;
      out.push({ t: s.t, v: (v / v0) * 100 });
      last = s.t;
    }
    return out;
  }
  /* ⭐⭐⭐ سلسلة الشهادات على أساس ١٠٠ من بداية النافذة
     ⛔ كانت بتتراكم من ٢٠٢١ (من غير إعادة ضبط) ⇒ الخط كان طاير فوق والرقم ١٧٨
     ⛔ كمان: لازم تقف عند نهاية الفترة (p.to) زي باقي الأصول */
  function certIndex(D, tFrom, tTo) {
    var rates = (D.cert && D.cert.rates) || {};
    var keys = Object.keys(rates).sort();
    var prod = 1, base = null, out = [];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var t = Date.parse(k + '-15T00:00:00Z');
      var f = Math.pow(1 + Number(rates[k].dep_3m) / 100, 1 / 12);
      if (base === null) {
        if (t < tFrom) { prod *= f; continue; }
        base = prod;                                   // ⭐ نقطة البداية
        out.push({ t: tFrom, v: 100 });
      }
      if (t > tTo) break;
      prod *= f;
      out.push({ t: t, v: (prod / base) * 100 });
    }
    return out;
  }
  /* ⭐ تحويل السلسلة لخط درج (الشهادة بتتراكم شهرياً مش خط مستقيم) */
  function toStep(pts) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      out.push({ t: pts[i].t, v: pts[i].v });
      if (i + 1 < pts.length) {
        out.push({ t: pts[i + 1].t - 1000, v: pts[i].v });   // يفضل ثابت لحد الشهر اللي بعده
      }
    }
    return out;
  }
  /* ⭐⭐⭐ تنسيق محور السعر كنسبة مئوية من نقطة البداية (١٠٠ = صفر٪) */
  function pctFormatter(v) {
    var d = (v - 100);
    var s = (d > 0 ? '+' : (d < 0 ? '−' : ''));
    return s + Math.abs(d).toFixed(Math.abs(d) < 10 ? 1 : 0) + '٪';
  }
  function drawCompareChart(host, D, p) {
    if (!host) return [];
    var tFrom = Date.parse(p.from + 'T00:00:00Z');
    var tTo = Date.parse(p.to + 'T00:00:00Z');
    var step = p.days > 900 ? 7 : (p.days > 200 ? 3 : 1);
    var series = [
      { key: 'gold', name: ASSETS[0].name, color: ASSETS[0].color, data: normSeries(D.gold, tFrom, tTo, 'gram', step) },
      { key: 'egx', name: ASSETS[1].name, color: ASSETS[1].color, data: normSeries(D.egx, tFrom, tTo, 'v', step) },
      { key: 'usd', name: ASSETS[2].name, color: ASSETS[2].color, data: normSeries(D.gold, tFrom, tTo, 'fx', step) },
      { key: 'cert', name: ASSETS[3].name, color: ASSETS[3].color, data: toStep(certIndex(D, tFrom, tTo)) }
    ].filter(function (s) { return s.data && s.data.length > 1; });
    if (!series.length) { host.innerHTML = '<div class="gmute">مفيش بيانات كافية للرسم.</div>'; return []; }
    loadLib().then(function (lib) {
      try {
        host.innerHTML = '';
        var chart = chartBase(host, Math.max(250, Math.min(340, Math.round(window.innerHeight * 0.32))));
        /* ⭐ خط الأساس: نقطة البداية = ١٠٠ (٠٪) */
        series.forEach(function (s) {
          var line = chart.addSeries(lib.LineSeries, {
            color: s.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
            priceFormat: { type: 'custom', formatter: pctFormatter, minMove: 0.01 }
          });
          line.setData(s.data.map(function (q) {
            return { time: Math.floor(q.t / 1000), value: Math.round(q.v * 100) / 100 };
          }));
        });
        chart.addSeries(lib.LineSeries, {
          color: 'rgba(139,158,176,.5)', lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
          priceFormat: { type: 'custom', formatter: pctFormatter, minMove: 0.01 }
        }).setData(series[0].data.map(function (q) {
          return { time: Math.floor(q.t / 1000), value: 100 };
        }));
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
    return series;
  }

  /* ⭐⭐⭐⭐ شارت لكل أصل لوحده (أوضح بكتير من ٤ خطوط في شارت واحد) */
  function drawMiniCharts(host, D, p, cmp) {
    if (!host) return;
    var tFrom = Date.parse(p.from + 'T00:00:00Z');
    var tTo = Date.parse(p.to + 'T00:00:00Z');
    var step = p.days > 900 ? 7 : (p.days > 200 ? 3 : 1);
    var defs = [
      { key: 'gold', name: ASSETS[0].name, icon: ASSETS[0].icon, color: ASSETS[0].color, data: normSeries(D.gold, tFrom, tTo, 'gram', step) },
      { key: 'egx', name: ASSETS[1].name, icon: ASSETS[1].icon, color: ASSETS[1].color, data: normSeries(D.egx, tFrom, tTo, 'v', step) },
      { key: 'usd', name: ASSETS[2].name, icon: ASSETS[2].icon, color: ASSETS[2].color, data: normSeries(D.gold, tFrom, tTo, 'fx', step) },
      { key: 'cert', name: ASSETS[3].name, icon: ASSETS[3].icon, color: ASSETS[3].color, data: toStep(certIndex(D, tFrom, tTo)) }
    ];
    var byKey = {};
    cmp.rows.forEach(function (r) { byKey[r.key] = r; });
    host.innerHTML = '<div class="egminis">' + defs.map(function (d, i) {
      var r = byKey[d.key] || {};
      var pct = r.real;
      var nom = (r.display != null) ? r.display : r.nominal;
      var cov = (r.extra && r.extra.monthsUsed) ? r.extra.monthsUsed : null;
      var sub = '';
      if (nom == null) {
        sub = '<div class="egmini-f">المصدر مش متاح للفترة دي</div>';
      } else {
        sub = '<div class="egmini-f">اسمي ' + sgn(nom, 1) +
          (r.real != null ? ' · بعد التضخم ' + sgn(r.real, 1) : '') +
          (cov ? ' · <span class="egmini-cov">' + num(cov, 0) + ' شهر من المصدر</span>' : '') + '</div>';
      }
      var badge = (pct == null) ? '<span class="egmini-v gt-na">غير متاح</span>'
        : '<span class="egmini-v ' + sgnCls(pct) + '">' + sgn(pct, 1) + '</span>';
      return '<div class="egmini">' +
        '<div class="egmini-h"><span class="egmini-n">' + d.icon + ' ' + esc(d.name) + '</span>' + badge + '</div>' +
        '<div class="egmini-c" id="egmini-' + d.key + '"></div>' + sub + '</div>';
    }).join('') + '</div>' +
      '<div class="egnote">📈 كل شارت لوحده بمقياسه (مش ده خطأ) — الرقم الكبير = العائد الحقيقي بعد التضخم. ' +
      'الأساس في كلهم = نقطة بداية الفترة (٠٪).</div>';
    loadLib().then(function (lib) {
      defs.forEach(function (d) {
        var el = document.getElementById('egmini-' + d.key);
        if (!el || !d.data || d.data.length < 2) {
          if (el) el.innerHTML = '<div class="gmute">مفيش بيانات للفترة دي.</div>';
          return;
        }
        try {
          var ch = chartBase(el, 132);
          var line = ch.addSeries(lib.LineSeries, {
            color: d.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
            priceFormat: { type: 'custom', formatter: pctFormatter, minMove: 0.01 }
          });
          line.setData(d.data.map(function (q) {
            return { time: Math.floor(q.t / 1000), value: Math.round(q.v * 100) / 100 };
          }));
          var base = ch.addSeries(lib.LineSeries, {
            color: 'rgba(139,158,176,.45)', lineWidth: 1, lineStyle: 2,
            priceLineVisible: false, lastValueVisible: false,
            priceFormat: { type: 'custom', formatter: pctFormatter, minMove: 0.01 }
          });
          base.setData(d.data.map(function (q) { return { time: Math.floor(q.t / 1000), value: 100 }; }));
          ch.timeScale().fitContent();
          ch.timeScale().applyOptions({ visible: false });
          el.__chart = ch;
        } catch (e) { el.innerHTML = '<div class="gmute">تعذّر الرسم.</div>'; }
      });
    }).catch(function () { });
  }

  /* ══════════════════════════════════════════════════════════
     ⑥ الميزان
     ══════════════════════════════════════════════════════════ */
  /* ⭐⭐⭐ الترتيب بالمعدّل السنوي المكافئ الحقيقي (مش نفسه) عشان المقارنة
     تكون على نفس المدة حتى لو مصدر أصل اقصر (زي الشهادات). */
  function scoreOf(r) { return r.real; }
  function balanceHtml(cmp) {
    var rows = cmp.rows.filter(function (r) { return scoreOf(r) != null; });
    if (rows.length < 2) {
      return '<div class="gbal-empty">مفيش أصول قابلة للمقارنة في الفترة دي.</div>';
    }
    rows.sort(function (a, b) { return scoreOf(b) - scoreOf(a); });
    var best = rows[0], worst = rows[rows.length - 1];
    var diff = Math.abs(scoreOf(best) - scoreOf(worst));
    var tilt = Math.max(2, Math.min(9, diff / 3));
    var maxAbs = Math.max.apply(null, cmp.rows.map(function (x) {
      var s = scoreOf(x); return s == null ? 0 : Math.abs(s);
    }));
    return '<div class="gbal" role="img" aria-label="مقارنة الأصول">' +
      '<div class="gbal-beam">' +
      '<div class="gbal-pivot" style="transform:rotate(-' + tilt.toFixed(2) + 'deg)">' +
      '<div class="gbal-stick"></div></div>' +
      '<div class="gbal-scale gbal-scale-l">' +
      '<span class="gbal-sname">' + esc(worst.meta.icon + ' ' + worst.meta.name) + '</span>' +
      '<span class="gbal-sval ' + sgnCls(scoreOf(worst)) + '">' + sgn(scoreOf(worst), 1) + '</span>' +
      '</div>' +
      '<div class="gbal-scale gbal-scale-r">' +
      '<span class="gbal-sname">' + esc(best.meta.icon + ' ' + best.meta.name) + '</span>' +
      '<span class="gbal-sval ' + sgnCls(scoreOf(best)) + '">' + sgn(scoreOf(best), 1) + '</span>' +
      '</div>' +
      '<div class="gbal-base"></div></div>' +
      '<div class="gbal-winner ' + (best.key === 'gold' ? 'is-gold' : '') + '">' +
      '<span class="gbal-winner-n">' + best.meta.icon + ' ' + esc(best.meta.name) + '</span>' +
      '<span class="gbal-winner-v ' + sgnCls(scoreOf(best)) + '">' + sgn(scoreOf(best), 1) + '</span>' +
      '<span class="gbal-winner-s">الأعلى عائداً حقيقياً (بعد التضخم) في نفس طول الفترة</span></div>' +
      '<div class="gbal-bars">' + cmp.rows.map(function (r) {
        var sc = scoreOf(r);
        if (sc == null) {
          return '<div class="gbar gbar-na"><span class="gbar-n">' + esc(r.meta.icon + ' ' + r.meta.name) +
            '</span><span class="gbar-v">غير متاح</span></div>';
        }
        var w = maxAbs > 0 ? Math.max(3, Math.round(Math.abs(sc) / maxAbs * 100)) : 0;
        var shown = (r.display != null) ? r.display : r.nominal;
        var sub = (shown != null) ? ('<small class="gbar-sub">اسمي ' + sgn(shown, 1) + '</small>') : '';
        var cov = (r.extra && r.extra.monthsUsed) ? ('<small class="gbar-sub gbar-cov">' + num(r.extra.monthsUsed, 0) + ' شهر متاح</small>') : '';
        return '<div class="gbar"><span class="gbar-n">' + esc(r.meta.icon + ' ' + r.meta.name) + '</span>' +
          '<span class="gbar-track"><span class="gbar-fill ' + sgnCls(sc) + '" style="width:' + w + '%"></span></span>' +
          '<span class="gbar-v ' + sgnCls(sc) + '">' + sgn(sc, 1) + sub + cov + '</span></div>';
      }).join('') + '</div>' +
      '<div class="gbal-note">⚖️ الميزان يقارن <b>العائد الحقيقي (بعد التضخم)</b> — لأن ده العائد اللي بيفرق في جيبك فعلاً. ' +
      'ولأن مصدر الشهادات بيتأخر، بنحطّ رقمه على طول الفترة نفسه قبل المقارنة. والرقم تحت = العائد الاسمي.</div>';
  }

  /* ══════════════════════════════════════════════════════════
     ⑦ مناطق الدعم والمقاومة + الحكم
     ══════════════════════════════════════════════════════════ */
  function zonesHtml(D, tech) {
    var sr = (tech && tech.sr) || null;
    if (!sr || !sr.ok) {
      return '<div class="gmute">مناطق الدعم والمقاومة غير متاحة دلوقتي.</div>';
    }
    var cur = sr.current != null ? sr.current : D.last.gram;
    var s = sr.nearest_support, r = sr.nearest_resistance;
    function zoneCard(z, kind) {
      if (!z) return '<div class="egzone egzone--none"><div class="egzone-t">' +
        (kind === 'support' ? '🟢 أقرب دعم' : '🔴 أقرب مقاومة') + '</div>' +
        '<div class="egzone-v">غير متاح</div></div>';
      var mid = z.mid != null ? z.mid : z.center;
      var dist = z.distance_pct != null ? z.distance_pct : (mid && cur ? (mid / cur - 1) * 100 : null);
      return '<div class="egzone egzone--' + kind + '">' +
        '<div class="egzone-t">' + (kind === 'support' ? '🟢 أقرب دعم (منطقة شراء)' : '🔴 أقرب مقاومة (منطقة بيع)') + '</div>' +
        '<div class="egzone-v">' + num(mid, 0) + ' <small>ج.م</small></div>' +
        '<div class="egzone-s">' + (dist == null ? '' : sgn(dist, 1) + ' من السعر الحالي') +
        (z.touches ? ' · ' + num(z.touches, 0) + ' اختبار' : '') +
        (z.reactions ? ' · ' + num(z.reactions, 0) + ' ارتداد' : '') +
        (z.age_days != null ? ' · من ' + num(z.age_days, 0) + ' يوم' : '') + '</div>' +
        '<div class="egzone-z">المنطقة: ' + num(z.low, 0) + ' — ' + num(z.high, 0) + ' ج.م</div>' +
        '</div>';
    }
    var verdict = '';
    var tr = (tech && tech.trend) || null;
    if (tr && tr.overall) {
      verdict = '<div class="egverdict"><span class="egverdict-k">الاتجاه العام</span>' +
        '<span class="egverdict-v">' + esc(tr.overall) + '</span>' +
        '<span class="egverdict-s">قصير: ' + esc((tr.short && tr.short.label) || '—') +
        ' · متوسط: ' + esc((tr.medium && tr.medium.label) || '—') +
        ' · طويل: ' + esc((tr.long && tr.long.label) || '—') + '</span></div>';
    }
    return '<div class="egzones">' + zoneCard(s, 'support') + zoneCard(r, 'resistance') + '</div>' + verdict +
      '<div class="egzone-note">⛔ المناطق محسوبة على آخر ٥٠٠ إغلاق يومي (أقرب القمم والقيعان الموثوقة). ' +
      'منطقة الدعم ما بتضمنش ارتداد، والمقاومة ما بتضمنش هبوط. دي مستويات تحليل — مش توصية شراء أو بيع.</div>';
  }

  /* ══════════════════════════════════════════════════════════
     ⑧ تفكيك السعر: الذهب العالمي × الدولار ÷ ٣١٫١٠٣٥
     ══════════════════════════════════════════════════════════ */
  function decompHtml(D, p) {
    var g = retPct(D.gold, p.from, p.to, 'gram');
    var f = retPct(D.gold, p.from, p.to, 'fx');
    /* ⛔⛔⛔ الأونصة في السلسلة **بالجنيه** (ounce_egp) ⇒ لو استخدمناها
       كأنها أونصة دولار ⇒ نسبة المساهمة بتطلع غلط (١٠٠٪ / ١٧٩٨٪).
       ✅ الصح: الأونصة بالدولار = الجرام × ٣١٫١٠٣٥ ÷ سعر الدولار. */
    var GRAMS_PER_OUNCE = 31.1035;
    var usdSeries = D.gold.map(function (r) {
      if (r.gram == null || r.fx == null || !r.fx) return null;
      return { t: r.t, d: r.d, v: (r.gram * GRAMS_PER_OUNCE) / r.fx };
    }).filter(Boolean);
    var o = retPct(usdSeries, p.from, p.to, 'v');
    if (!g || !o || !f) return '<div class="gmute">التفكيك غير متاح للفترة دي.</div>';
    var lg = Math.log(g.end / g.start);
    var lo = Math.log(o.end / o.start);
    var lf = Math.log(f.end / f.start);
    var shareG = lg ? (lo / lg) * 100 : null;
    var shareF = lg ? (lf / lg) * 100 : null;
    /* ⭐⭐⭐ لو تغيّر الجرام صغير ⇒ نسب المساهمة بتكون أرقام متوحشة
       (مئات/آلاف %) ⇒ بنخفيها ونكتفي بالتغير الإجمالي. */
    var showShare = Math.abs(g.pct) >= 1;
    function row(icon, name, val, share, color) {
      return '<div class="egdec-r">' +
        '<span class="egdec-n">' + icon + ' ' + esc(name) + '</span>' +
        '<span class="egdec-v ' + sgnCls(val) + '">' + sgn(val, 1) + '</span>' +
        '<span class="egdec-bar"><span class="egdec-fill" style="width:' +
        (share == null || !showShare ? 0 : Math.min(100, Math.abs(share))) + '%;background:' + color + '"></span></span>' +
        '<span class="egdec-s">' +
        (!showShare ? 'المساهمة تُحسب على التغيّر الكلي' :
          (share == null ? '' : '<bdi dir="ltr">' + (share > 0 ? '+' : '−') +
            num(Math.abs(share), 0) + '%</bdi> من تغيّر الجرام')) + '</span>' +
        '</div>';
    }
    return '<div class="egdec">' +
      row('🌍', 'الذهب العالمي (XAU/USD)', o.pct, shareG, 'linear-gradient(90deg,#d4af37,#f4d03f)') +
      row('💵', 'الدولار مقابل الجنيه', f.pct, shareF, 'linear-gradient(90deg,#a78bfa,#6366f1)') +
      '<div class="egdec-total"><span>نتيجة الجرام بالجنيه</span>' +
      '<span class="' + sgnCls(g.pct) + '">' + sgn(g.pct, 1) + '</span>' +
      '<small>الجرام = الأونصة × الدولار ÷ ٣١٫١٠٣٥ جرام — فلو الدولار نزل، الجرام نزل برضه.</small></div>' +
      '</div>';
  }

  /* ══════════════════════════════════════════════════════════
     ⑨ العوامل المؤثرة على سعر الذهب المصري
     ══════════════════════════════════════════════════════════ */
  var FACTOR_ORDER = [
    'dxy', 'xau', 'usd_egp', 'cbe_inflation', 'cbe_policy',
    'us10y', 'us10y_real', 'fed_funds', 'cpi_us', 'oil'
  ];
  function factorsHtml(D) {
    var f = D.factors || {};
    var keys = FACTOR_ORDER.filter(function (k) { return f[k]; });
    Object.keys(f).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    if (!keys.length) return '<div class="gmute">العوامل غير متاحة.</div>';
    var cards = keys.map(function (k) {
      var x = f[k] || {};
      var dir = x.direction || 'unknown';
      var arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•';
      var dirCls = dir === 'up' ? 'gup' : dir === 'down' ? 'gdown' : 'gflat';
      var val = x.value;
      var vTxt = (k === 'cpi_us' || k === 'cpi_eg') ? num(val, 1) : num(val, 2);
      return '<div class="egfact">' +
        '<div class="egfact-h"><span class="egfact-n">' + esc(x.name_ar || k) + '</span>' +
        '<span class="egfact-d ' + dirCls + '">' + arrow + '</span></div>' +
        '<div class="egfact-v">' + vTxt + '</div>' +
        (x.relation ? '<div class="egfact-r">' + esc(x.relation) + '</div>' : '') +
        '<div class="egfact-s">' + esc(x.source || '') +
        (x.date ? ' · ' + esc(x.date) : '') + '</div>' +
        '</div>';
    }).join('');
    return '<div class="egfacts">' + cards + '</div>' +
      '<div class="egnote">⛔ العوامل دي وصفية — مفيش أي عامل بنحسبله «تأثير %» من غير قياس. والقيم دي بتتغير مع الوقت، فكل رقم معروض بتاريخه.</div>';
  }

  /* ══════════════════════════════════════════════════════════
     ⑩ جدول المقارنة + مثال ١٠٠ ألف + مصفوفة العوائد السنوية
     ══════════════════════════════════════════════════════════ */
  function tableHtml(cmp, allRows) {
    var head = '<tr><th>الفترة</th><th>الذهب المصري</th><th>EGX30</th><th>الدولار/الجنيه</th>' +
      '<th>شهادات الادخار</th><th>التضخم في الفترة</th><th>الأعلى (اسمي)</th></tr>';
    var body = allRows.map(function (r) {
      var best = null;
      r.cmp.rows.forEach(function (x) {
        var a = (x.display != null) ? x.display : x.nominal;
        if (a == null) return;
        if (!best || a > best._a) { best = x; best._a = a; }
      });
      return '<tr class="gtr' + (r.cmp.period.key === cmp.period.key ? ' is-on' : '') + '">' +
        '<td class="gtl">' + esc(r.cmp.period.label) +
        '<small>' + dtxt(r.cmp.period.from) + ' ← ' + dtxt(r.cmp.period.to) + '</small></td>' +
        r.cmp.rows.map(function (x) {
          if (x.nominal == null) return '<td class="gtc gt-na">غير متاح</td>';
          /* ⭐ الشهادات: المصدر بيتأخر ⇒ بتغطي شهور أقل ⇒ بنعرض «مكافئ سنوي»
             جنب العائد الفعلي للشهور المتاحة (وغير كده المقارنة مش صح). */
          if (x.key === 'cert' && x.extra && x.extra.monthsUsed) {
            var ann = x.display != null ? x.display : x.nominal;
            return '<td class="gtc ' + sgnCls(ann) + '">' + sgn(ann, 1) +
              '<small class="gt-part">معدّل الفترة · على ' + num(x.extra.monthsUsed, 0) + ' شهر: ' + sgn(x.nominal, 1) + '</small>' +
              (x.real != null ? '<small>حقيقي ' + sgn(x.real, 1) + '</small>' : '') + '</td>';
          }
          var ex = '';
          if (x.extra && x.extra.partial && x.extra.monthsUsed) {
            ex = '<small class="gt-part">محسوب على ' + num(x.extra.monthsUsed, 0) + ' شهر</small>';
          }
          return '<td class="gtc ' + sgnCls(x.nominal) + '">' + sgn(x.nominal, 1) +
            (x.real != null ? '<small>حقيقي ' + sgn(x.real, 1) + '</small>' : '') + ex + '</td>';
        }).join('') +
        '<td class="gtc gt-infl">' + (r.cmp.infl && r.cmp.infl.pct != null ? sgn(r.cmp.infl.pct, 1) : '—') + '</td>' +
        '<td class="gtc gt-win">' + (best ? esc(best.meta.icon + ' ' + best.meta.name.split(' ')[0]) : '—') + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="gtbl-wrap"><table class="gtbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="egnote">📋 الأرقام = عائد الفترة (اسمي + الحقيقي بعد التضخم). ' +
      '🏦 شهادات الادخار: البنك المركزي بينشر بتأخير ⇒ آخر شهر متاح <b>' +
      esc(cmp.certLast || '—') + '</b> ⇒ بتغطّي شهور أقل من الفترة، ' +
      'فنعرض «سنوي مكافئ» + العائد الفعلي للشهور المتاحة.</div>';
  }
  function exampleHtml(cmp) {
    var AMOUNT = 100000;
    var cards = cmp.rows.map(function (r) {
      if (r.nominal == null) {
        return '<div class="gex gex-na"><div class="gex-n">' + esc(r.meta.icon + ' ' + r.meta.name) +
          '</div><div class="gex-v">غير متاح</div><div class="gex-s">المصدر مش متاح للفترة دي</div></div>';
      }
      /* ⭐ الشهادات: المصدر متأخر ⇒ نعرض المعدّل السنوي المكافئ (نفس المدة زي الباقي) */
      var useAnn = (r.key === 'cert' && r.display != null);
      var nomPct = useAnn ? r.display : r.nominal;
      var realPct = r.real;
      var nom = AMOUNT * (1 + nomPct / 100);
      var real = realPct == null ? null : AMOUNT * (1 + realPct / 100);
      var exn = '';
      if (r.extra && r.extra.monthsUsed) {
        exn = '<div class="gex-s">' + (useAnn ? 'معدّل الفترة · محسوب على' : 'محسوب على') + ' ' +
          num(r.extra.monthsUsed, 0) + ' شهر من المصدر</div>';
      }
      return '<div class="gex">' +
        '<div class="gex-n">' + esc(r.meta.icon + ' ' + r.meta.name) + '</div>' +
        '<div class="gex-v">' + num(nom, 0) + ' <small>ج.م</small></div>' +
        '<div class="gex-s">من ' + num(AMOUNT, 0) + ' ج.م · ' + sgn(nomPct, 1) + ' اسمي</div>' + exn +
        (real != null ? '<div class="gex-r">بعد التضخم: ' + num(real, 0) + ' ج.م <small>(' + sgn(realPct, 1) + ')</small></div>' : '') +
        '</div>';
    }).join('');
    return '<div class="gex-wrap">' + cards + '</div>' +
      '<div class="gex-note">💰 المثال: ' + num(AMOUNT, 0) + ' جنيه في بداية الفترة (' + dtxt(cmp.period.from) +
      ') · قيمة اليوم (' + dtxt(cmp.period.to) + ') بالأسعار الفعلية — قبل أي رسوم أو ضرائب.' +
      (cmp.certLast ? ' 🏦 رقم الشهادات معدّل على طول الفترة لأن آخر شهر متاح من البنك المركزي ' + esc(cmp.certLast) + '.' : '') +
      '</div>';
  }
  /* ⭐⭐⭐ مصفوفة العوائد السنوية (لكل أصل × كل سنة) */
  function yearlyMatrixHtml(D) {
    var sets = [
      { meta: ASSETS[0], rows: yearlyReturns(D.gold, 'gram') },
      { meta: ASSETS[1], rows: yearlyReturns(D.egx, 'v') },
      { meta: ASSETS[2], rows: yearlyReturns(D.gold, 'fx') },
      { meta: ASSETS[3], rows: certYearly(D) }
    ];
    var years = [];
    sets.forEach(function (s) {
      s.rows.forEach(function (r) { if (years.indexOf(r.year) < 0) years.push(r.year); });
    });
    years.sort(function (a, b) { return a - b; });
    if (!years.length) return '<div class="gmute">مفيش عوائد سنوية متاحة.</div>';
    /* ⭐⭐⭐ ٢٩ سنة ⇒ الجدول بيطلع بره الشاشة على الموبايل ⇒ ناخد آخر ١٢ سنة */
    var totalYears = years.length;
    if (years.length > 12) years = years.slice(-12);
    /* ⭐⭐⭐ RTL: أول خانة بترتيب القراءة هي اللي على اليمين ⇒ نخلي
       أحدث سنة هي الأولى (٢٠٢٦) عشان المستخدم يبدأ من الأحدث. */
    years.reverse();
    var head = '<tr><th>الأصل</th>' + years.map(function (y) {
      return '<th class="gym-y">' + String(y).slice(2) + '</th>';
    }).join('') + '</tr>';
    var body = sets.map(function (s) {
      var map = {};
      s.rows.forEach(function (r) { map[r.year] = r.pct; });
      return '<tr><td class="gtl">' + esc(s.meta.icon + ' ' + s.meta.name) + '</td>' +
        years.map(function (y) {
          var v = map[y];
          if (v == null) return '<td class="gym-c gt-na">—</td>';
          var a = Math.min(1, Math.abs(v) / 60);
          var bg = v >= 0 ? 'rgba(34,197,94,' + (0.12 + a * 0.55).toFixed(2) + ')'
            : 'rgba(239,68,68,' + (0.12 + a * 0.55).toFixed(2) + ')';
          return '<td class="gym-c" style="background:' + bg + '">' + sgn(v, 0) + '</td>';
        }).join('') + '</tr>';
    }).join('');
    return '<div class="gtbl-wrap"><table class="gtbl gym"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="egnote">🎨 كل خانة = عائد السنة دي. الأخضر = ربح · الأحمر = خسارة · والتشبع بيكبر مع حجم الحركة.' +
      (totalYears > years.length ? ' (آخر ' + years.length + ' سنة من ' + totalYears + ' — اسحب الجدول جنباً للباقي)' : '') + '</div>';
  }
  /* ⭐⭐⭐ جدول المخاطر (احترافي) */
  function riskHtml(D, p) {
    var rows = [
      { meta: ASSETS[0], r: riskOf(D.gold, 'gram', p.from, p.to) },
      { meta: ASSETS[1], r: riskOf(D.egx, 'v', p.from, p.to) },
      { meta: ASSETS[2], r: riskOf(D.gold, 'fx', p.from, p.to) },
      { meta: ASSETS[3], r: null }
    ];
    var body = rows.map(function (x) {
      var r = x.r;
      if (!r) {
        return '<tr><td class="gtl">' + esc(x.meta.icon + ' ' + x.meta.name) + '</td>' +
          '<td class="gtc gt-na">غير متاح</td><td class="gtc gt-na">—</td>' +
          '<td class="gtc gt-na">—</td><td class="gtc gt-na">—</td></tr>';
      }
      return '<tr><td class="gtl">' + esc(x.meta.icon + ' ' + x.meta.name) + '</td>' +
        '<td class="gtc ' + sgnCls(r.cagr) + '">' + sgn(r.cagr, 1) + '</td>' +
        '<td class="gtc">' + num(r.vol, 1) + '٪</td>' +
        '<td class="gtc gt-down">' + (r.maxDD > -0.05 ? '—' : sgn(r.maxDD, 1)) + '</td>' +
        '<td class="gtc">' + (r.calmar == null ? '—' : num(r.calmar, 2)) + '</td></tr>';
    }).join('');
    return '<div class="gtbl-wrap"><table class="gtbl"><thead><tr><th>الأصل</th>' +
      '<th>معدل النمو السنوي</th><th>التقلب السنوي</th><th>أقصى هبوط</th><th>العائد/الهبوط</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="egnote">📉 التقلب = انحراف معياري سنوي للعوائد اليومية في الفترة المختارة. أقصى هبوط = أكبر نزول من القمة. ' +
      'العائد/الهبوط = معدل النمو ÷ أقصى هبوط (رقم أعلى = عائد مقابل مخاطرة أحسن). ' +
      'الشهادات: مصدرها شهري ⇒ مؤشرات المخاطر غير متاحة لها.' +
      (p.days < 90 ? ' ⚠️ الفترة قصيرة ⇒ التقلب المحسوب تقلبته كبيرة — استخدم فترة أطول للحكم.' : '') + '</div>';
  }

  /* ══════════════════════════════════════════════════════════
     ⑪ المودال
     ══════════════════════════════════════════════════════════ */
  var MODAL_ID = 'egy-gold-modal';
  var VIEW = 'analysis';           /* analysis | compare */

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
    VIEW = (tab === 'compare') ? 'compare' : 'analysis';
    var w = document.createElement('div');
    w.id = MODAL_ID;
    w.className = 'gmodal egmodal';
    w.innerHTML =
      '<div class="gback" data-close></div>' +
      '<div class="gpanel egpanel" role="dialog" aria-modal="true" aria-label="الذهب المصري">' +
      '<div class="ghead">' +
      '<div class="ocm-row1"><div class="ghead-t">🥇 الذهب المصري</div>' +
      '<span class="egprice" id="egp-price">…</span></div>' +
      '<div class="egp-ref" id="egp-ref"></div>' +
      '<div class="ocm-row2">' +
      '<span class="egchg" id="egp-chg"></span>' +
      /* ⭐⭐⭐ زرار الميزان جنب زرار الإغلاق */
      '<button class="egbal-btn" id="egbal-btn" type="button" aria-label="المقارنة بين الأصول"' +
      ' title="المقارنة بين الأصول">⚖️</button>' +
      '<button class="gclose ocm-close" data-close aria-label="اقفل">✕</button>' +
      '</div></div>' +
      '<div class="gtabs" id="egtabs" role="tablist">' +
      '<button class="gtab is-on" type="button" role="tab" data-tab="analysis" aria-selected="true">تحليل الذهب</button>' +
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

    var D = null;
    var TAB = (tab === 'save') ? 'save' : 'analysis';

    function paintTabs() {
      var bs = w.querySelectorAll('#egtabs .gtab');
      for (var i = 0; i < bs.length; i++) {
        var on = bs[i].getAttribute('data-tab') === TAB;
        bs[i].classList.toggle('is-on', on);
        bs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      }
      /* ⭐⭐⭐ في عرض المقارنة التبويبات مخفية — عشان «تحليل الذهب» مايفضلش
         باين مفعّل والمحتوى مختلف (كان بيلخبط المستخدم). */
      var tr = w.querySelector('#egtabs');
      if (tr) tr.classList.toggle('is-hidden', VIEW === 'compare');
    }
    function paintHead() {
      var btn = document.getElementById('egbal-btn');
      if (!btn) return;
      if (VIEW === 'compare') {
        btn.classList.add('is-on');
        btn.title = 'رجوع للتحليل';
        btn.setAttribute('aria-label', 'رجوع لتحليل الذهب المصري');
      } else {
        btn.classList.remove('is-on');
        btn.title = 'المقارنة بين الأصول';
        btn.setAttribute('aria-label', 'المقارنة بين الأصول');
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
      if (VIEW === 'compare') { renderCompare(b, D, w); return; }
      renderAnalysis(b, D, w);
    }
    function setView(v) {
      VIEW = v; paintHead(); paintTabs();
      var b = w.querySelector('#egbody');
      if (!b) return;
      if (v === 'compare') { renderCompare(b, D, w); }
      else { renderAnalysis(b, D, w); }
    }

    paintTabs();
    (function () {
      var btns = w.querySelectorAll('#egtabs .gtab');
      for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function (e) {
          VIEW = 'analysis';
          showTab(e.currentTarget.getAttribute('data-tab'));
        });
      }
      var bb = document.getElementById('egbal-btn');
      if (bb) bb.addEventListener('click', function () {
        setView(VIEW === 'compare' ? 'analysis' : 'compare');
      });
    })();

    load(false).then(function (d) {
      D = d;
      var p = document.getElementById('egp-price');
      var c = document.getElementById('egp-chg');
      var _mk = d.last.marketGram, _ref = (d.last.gramLive != null) ? d.last.gramLive : d.last.gram;
      if (p) {
        p.innerHTML = num(_mk != null ? _mk : _ref, 0) + ' <small>ج.م / جرام' +
          (_mk != null ? ' · سعر السوق' : ' · مرجع محسوب') + '</small>';
        var pr = document.getElementById('egp-ref');
        if (pr && _mk != null && _ref) {
          var df = (_mk / _ref - 1) * 100;
          pr.innerHTML = 'المرجع المحسوب ' + num(_ref, 0) +
            ' · السوق ' + (df >= 0 ? '+' : '−') + num(Math.abs(df), 2) + '٪';
        }
      }
      if (c) c.innerHTML = (d.last.gramChangePct == null ? '' :
        '<span class="' + sgnCls(d.last.gramChangePct) + '">' + sgn(d.last.gramChangePct, 2) + '</span>') +
        '<span class="egchg-d">الدولار ' + num(d.last.fx, 3) + ' · DXY ' + num(d.last.dxy, 2) + '</span>';
      paintHead();
      showTab(TAB);
      if (VIEW === 'compare') setView('compare');
    }).catch(function (e) {
      var b = w.querySelector('#egbody');
      if (b) b.innerHTML = '<div class="gmute">تعذّر تحميل البيانات: ' + esc(e.message || e) + '</div>';
    });
  }

  /* ── تبويب التحليل (الصفحة الرئيسية) ─────────────────── */
  function renderAnalysis(body, D, w) {
    var periods = buildPeriods(D);
    var cur = periods[0];
    body.innerHTML =
      '<div class="egsec"><div class="egsec-h">🏪 سعر السوق المصري الآن</div><div id="egmarket"></div></div>' +
      '<div class="egsec"><div class="egsec-h">📊 سعر الجرام بالجنيه + مناطق الشراء والبيع</div>' +
      '<div class="egperiods" id="egperiods">' + periods.map(function (p, i) {
        return '<button class="egper' + (i === 0 ? ' is-on' : '') + '" data-p="' + p.key + '">' + esc(p.label) + '</button>';
      }).join('') + '</div>' +
      '<div class="egchart egchart--gold" id="egchart"></div>' +
      '<div class="eglegend eglegend--gold">' +
      '<span class="eglg"><i style="background:#d4af37"></i>سعر الجرام</span>' +
      '<span class="eglg"><i style="background:#38bdf8"></i>متوسط ٢٠</span>' +
      '<span class="eglg"><i style="background:#a78bfa"></i>متوسط ٥٠</span>' +
      '<span class="eglg"><i style="background:#f59e0b"></i>متوسط ٢٠٠</span>' +
      '<span class="eglg"><i style="background:#22c55e"></i>دعم (شراء)</span>' +
      '<span class="eglg"><i style="background:#ef4444"></i>مقاومة (بيع)</span>' +
      '</div></div>' +
      '<div class="egsec"><div class="egsec-h">🎯 مناطق الدعم والمقاومة</div><div id="egzones"></div></div>' +
      '<div class="egsec"><div class="egsec-h">🧮 جرام الذهب اتغيّر منين؟</div><div id="egdec"></div></div>' +
      '<div class="egsec"><div class="egsec-h">🌍 العوامل اللي بتأثر على سعر الذهب المصري</div><div id="egfac"></div></div>' +
      '<div class="egsec eg-src" id="egsrc"></div>';

    document.getElementById('egmarket').innerHTML = marketCardHtml(D);
    document.getElementById('egzones').innerHTML = zonesHtml(D, D.tech);
    document.getElementById('egfac').innerHTML = factorsHtml(D);
    document.getElementById('egsrc').innerHTML = '<div class="egsec-h">📎 المصادر</div>' +
      '<div class="egsrc-i"><b>السعر المرجعي (المستخدم في التحليل):</b> TradingView — XAU/USD (الذهب العالمي) ' +
      '× USD/EGP (سعر الصرف) ÷ ٣١٫١٠٣٥ جرام — ' + (D.goldFrom || '—') + ' → ' + (D.goldTo || '—') +
      ' (' + D.gold.length + ' يوم). ⚠️ سعر مرجعي — من غير مصنعية ولا دمغة.</div>' +
      '<div class="egsrc-i"><b>سعر السوق المصري:</b> ' + esc(D.last.marketSource || 'غير متاح') +
      ' — ' + esc(D.last.marketAt || '') + (D.last.marketUrl ? ' · ' + esc(D.last.marketUrl) : '') + '</div>' +
      '<div class="egsrc-i"><b>الدعم والمقاومة:</b> ' +
      ((D.tech && D.tech.sr && D.tech.sr.window_note) || 'محسوب على آخر ٥٠٠ شمعة') + '</div>' +
      '<div class="egsrc-i"><b>المؤشرات الفنية:</b> ' +
      ((D.tech && D.tech.source && D.tech.source.price_source) || 'TradingView') + '</div>' +
      '<div class="egsrc-i"><b>العوامل:</b> البنك المركزي المصري · البنك الدولي · FRED · TradingView</div>' +
      '<div class="egnote">⛔ كل الأرقام تحليل ومعلومة — مش نصيحة استثمارية. ' +
      'مناطق الدعم والمقاومة بتتقاطب مع الكسر ولا بتضمن ارتداد.</div>';

    function paint(periodKey) {
      var p = periods.filter(function (x) { return x.key === periodKey; })[0] || periods[0];
      cur = p;
      drawGoldChart(document.getElementById('egchart'), D, D.tech, p);
      document.getElementById('egdec').innerHTML = decompHtml(D, p);
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
    paint(cur.key);
  }

  /* ── تبويب المقارنة (خلف زرار الميزان) ───────────────── */
  function renderCompare(body, D, w) {
    var periods = buildPeriods(D);
    var allRows = periods.map(function (p) { return { cmp: compare(D, p) }; });
    var cmp = compare(D, periods[0]);

    body.innerHTML =
      '<div class="egsec"><div class="egsec-h">⚖️ الميزان — مين كسب؟</div>' +
      '<div class="egperiods" id="egperiods">' + periods.map(function (p, i) {
        return '<button class="egper' + (i === 0 ? ' is-on' : '') + '" data-p="' + p.key + '">' + esc(p.label) + '</button>';
      }).join('') + '</div>' +
      '<div id="egbal"></div></div>' +
      '<div class="egsec"><div class="egsec-h">📈 كل أصل لوحده — أوضح من ٤ خطوط في شارت واحد</div>' +
      '<div id="egminis"></div></div>' +
      '<div class="egsec"><div class="egsec-h">📊 الكل في شارت واحد (نفس البداية = ٠٪)</div>' +
      '<div class="egchart" id="egchartCmp"></div>' +
      '<div class="eglegend" id="eglegend"></div></div>' +
      '<div class="egsec"><div class="egsec-h">🎨 العوائد السنوية</div><div id="egym"></div></div>' +
      '<div class="egsec"><div class="egsec-h">📉 المخاطرة والعائد</div><div id="egrisk"></div></div>' +
      '<div class="egsec"><div class="egsec-h">📋 الأرقام — اسمي وحقيقي</div><div id="egtable"></div></div>' +
      '<div class="egsec"><div class="egsec-h">💰 لو حطيت ١٠٠٬٠٠٠ جنيه…</div><div id="egex"></div></div>' +
      '<div class="egsec eg-src" id="egsrc"></div>';

    document.getElementById('egym').innerHTML = yearlyMatrixHtml(D);
    document.getElementById('egsrc').innerHTML =
      '<div class="egsec-h">📎 المصادر</div>' +
      '<div class="egsrc-i"><b>الذهب والدولار:</b> TradingView — ' + (D.goldFrom || '—') + ' → ' + (D.goldTo || '—') + '</div>' +
      '<div class="egsrc-i"><b>مؤشر EGX30:</b> TradingView websocket — إغلاقات يومية</div>' +
      '<div class="egsrc-i"><b>شهادات الادخار:</b> البنك المركزي المصري — نشرة الإحصاء الشهري + Economic Review (2/5/1)</div>' +
      '<div class="egsrc-i"><b>التضخم:</b> البنك الدولي — CPI مصر</div>' +
      '<div class="egnote">⛔ المقارنة على نفس تاريخ البداية والنهاية لكل الأصول (النهاية ' +
      dtxt(D.commonTo || '') + ' — أقدم تاريخ متاح في كل المصادر). ' +
      '🏦 الشهادات: مركّب شهري من معدّل البنك المركزي (شهادة ٣ شهور)؛ لو المصدر ناقص جزء من الفترة، ' +
      'النسبة بتتحسب على الشهور المتاحة بس وبتبان مكتوب جنبها.</div>';

    function paint(periodKey) {
      var p = periods.filter(function (x) { return x.key === periodKey; })[0] || periods[0];
      var c = compare(D, p);
      document.getElementById('egbal').innerHTML = balanceHtml(c);
      document.getElementById('egtable').innerHTML = tableHtml(c, allRows);
      document.getElementById('egex').innerHTML = exampleHtml(c);
      document.getElementById('egrisk').innerHTML = riskHtml(D, p);
      drawMiniCharts(document.getElementById('egminis'), D, p, c);
      var drawn = drawCompareChart(document.getElementById('egchartCmp'), D, p);
      /* ⭐ الـlegend يعرض اللي اترسم فعلاً + العائد beside الاسم */
      var byKey = {};
      c.rows.forEach(function (x) { byKey[x.key] = x; });
      document.getElementById('eglegend').innerHTML = drawn.map(function (s) {
        var r = byKey[s.key] || {};
        var pct = (r.key === 'cert' && r.display != null) ? r.display : r.nominal;
        return '<span class="eglg"><i style="background:' + s.color + '"></i>' + esc(s.name) +
          (pct != null ? ' <b class="' + sgnCls(pct) + '">' + sgn(pct, 1) + '</b>' : '') + '</span>';
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

  /* ══════════════════════════════════════════════════════════
     ⑪-ب سعر السوق المصري + الفرق عن السعر المرجعي
     ══════════════════════════════════════════════════════════ */
  function marketCardHtml(D) {
    var mk = D.last.marketGram;
    var ref = (D.last.gramLive != null) ? D.last.gramLive : D.last.gram;
    if (mk == null || !ref) return '<div class="gmute">سعر السوق غير متاح دلوقتي.</div>';
    var diff = (mk / ref - 1) * 100;
    var K = (D.local && D.local.karats) || {}, G = (D.local && D.local.grams) || {};
    var rows = ['14', '18', '21'].map(function (kk) {
      var a = K[kk] || {}, g = G[kk] || {};
      return '<tr><td class="gtl">عيار ' + kk + '</td>' +
        '<td class="gtc">' + (a.buy != null ? num(a.buy, 0) : '—') + '</td>' +
        '<td class="gtc">' + (a.sell != null ? num(a.sell, 0) : '—') + '</td>' +
        '<td class="gtc gt-infl">' + (g.spread_pct != null ? num(g.spread_pct, 2) + '٪' : '—') + '</td></tr>';
    }).join('');
    var fresh = D.last.marketFresh || {};
    return '<div class="egmkt">' +
      '<div class="egmkt-top">' +
      '<div><div class="egmkt-l">🏪 سعر السوق المصري (عيار ٢٤)</div>' +
      '<div class="egmkt-v">' + num(mk, 2) + ' <small>ج.م / جرام</small></div></div>' +
      '<div><div class="egmkt-l">🧮 السعر المرجعي المحسوب</div>' +
      '<div class="egmkt-v2">' + num(ref, 2) + ' <small>ج.م</small></div>' +
      '<div class="egmkt-d ' + (diff >= 0 ? 'gup' : 'gdown') + '">' +
      (diff >= 0 ? '+' : '−') + num(Math.abs(diff), 2) + '٪ فوق المرجع</div></div>' +
      '</div>' +
      '<div class="gtbl-wrap"><table class="gtbl"><thead><tr><th>العيار</th><th>سعر الشراء</th>' +
      '<th>سعر البيع</th><th>الفرق بين الشراء والبيع</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="egnote">🧮 <b>السعر المرجعي</b> = سعر الأونصة العالمي (XAU/USD) × سعر الدولار ÷ ٣١٫١٠٣٥ جرام — ' +
      'يعني <b>من غير</b> مصنعية ولا دمغة ولا ربح التاجر. ' +
      '<b>سعر السوق أعلى</b> لأن سعر الدولار في السوق الموازي أعلى من الرسمي، ولأن التاجر بينشر بهامش شراء وبيع. ' +
      '⚠️ التحليل والشارت كله معمول على <b>السعر المرجعي</b> (سلسلة تاريخية متصلة) — سعر السوق نقطة لحظية بتتغير.' +
      '<br>📌 مصدر السوق: ' + esc(D.last.marketSource || '') + ' · ' + esc(D.last.marketAt || '') +
      (fresh.status ? ' (' + esc(fresh.status === 'delayed' ? 'متأخر' : fresh.status) + ')' : '') + '</div>' +
      '</div>';
  }

  /* ══════════════════════════════════════════════════════════
     ⑫ الكارت — «الذهب المصري» في مؤشرات السوق المصري
     ══════════════════════════════════════════════════════════ */
  function tileHtml() {
    /* ⛔⛔ ممنوع onclick inline (قاعدة المشروع) ⇒ بنربط بـaddEventListener */
    return '<div class="mini eg-tile" data-eg-open="1" ' +
      'style="cursor:pointer" title="اضغط لتحليل الذهب المصري ومقارنة الأصول" role="button" tabindex="0">' +
      '<div class="mini-n">🥇 الذهب المصري</div>' +
      '<div class="mini-v" id="egtile-v">…</div>' +
      '<div class="mini-c" id="egtile-c">—</div>' +
      '<div class="egtile-ref" id="egtile-ref"></div>' +
      '<div class="egtile-bal" id="egtile-bal"><span class="egtile-bal-t">⚖️ …</span></div>' +
      '<div class="mini-sub">اضغط للتحليل</div>' +
      '</div>';
  }
  /* ⭐⭐⭐ الكارت بيتقفل/بيتعمل من جديد كل ما الداشبورد يعيد الرسم
     ⇒ لازم نخزّن آخر الأرقام ونرسمها **فوراً** (مش مستنيين الشبكة)
     ⇒ وإلا الكارت يفضل «…» لثواني (صعب يتضايق منه). */
  var TILE_LAST = null;
  function paintTileNow() {
    var v = document.getElementById('egtile-v');
    if (!v) return false;
    var tile = v.closest('[data-eg-open]');
    if (tile && !tile.__wired) {
      tile.__wired = true;
      tile.addEventListener('click', function () { openEgy('analysis'); });
      tile.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openEgy('analysis'); }
      });
    }
    var L = TILE_LAST;
    if (!L) return false;
    v.textContent = num(L.v, 0);
    var rf = document.getElementById('egtile-ref');
    if (rf) rf.textContent = L.ref;
    var c = document.getElementById('egtile-c');
    if (c) {
      c.className = 'mini-c ' + sgnCls(L.ch);
      c.innerHTML = L.ch == null ? '—' : (L.ch >= 0 ? '▲ +' : '▼ ') + num(Math.abs(L.ch), 2) + '%';
    }
    var bal = document.getElementById('egtile-bal');
    if (bal) bal.innerHTML = L.bal;
    return true;
  }
  function paintTile() {
    var v = document.getElementById('egtile-v');
    if (!v) return;
    if (paintTileNow()) return;      /* ⭐ بيانات مخزّنة ⇒ رسم فوري */
    load(false).then(function (D) {
      var mk = D.last.marketGram;
      var ref = (D.last.gramLive != null) ? D.last.gramLive : D.last.gram;
      var refTxt = (mk != null && ref)
        ? ('سوق مصر · المرجع ' + num(ref, 0) + ' (' +
          (mk >= ref ? '+' : '−') + num(Math.abs((mk / ref - 1) * 100), 1) + '٪)')
        : 'السعر المرجعي المحسوب';
      var balTxt = '<span class="egtile-bal-t">⚖️ …</span>';
      var p = buildPeriods(D);
      var one = p.filter(function (x) { return x.key === '1Y'; })[0] || p[0];
      var c2 = compare(D, one);
      var g = c2.rows[0], e = c2.rows[1];
      if (g.nominal == null || e.nominal == null) { balTxt = '<span class="egtile-bal-t">⚖️ غير متاح</span>'; }
      else {
        var win = g.nominal >= e.nominal;
        balTxt = '<span class="egtile-bal-t">⚖️ ' +
          (win ? 'الذهب' : 'EGX30') + ' أعلى على ' + esc(one.label) +
          ' (<bdi dir="ltr">' + num(Math.max(g.nominal, e.nominal), 1) + '%</bdi>)</span>';
      }
      TILE_LAST = {
        v: (mk != null ? mk : ref), ref: refTxt, ch: D.last.gramChangePct, bal: balTxt
      };
      paintTileNow();
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
      if (!el) return;
      if (el.textContent === '…') { paintTileNow() || paintTile(); }
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
    buildPeriods: buildPeriods,
    riskOf: riskOf,
    yearlyReturns: yearlyReturns
  };
  window.openEgyGold = openEgy;
})();
