/* ══════════════════════════════════════════════════════════════
   🗺️ OCTA SR — محرك «خريطة البنية السعرية» (دعم ومقاومة)
   ──────────────────────────────────────────────────────────────
   📌 كل رقم هنا محسوب من الشموع الحقيقية — مافيش تخمين ولا أرقام
      جاهزة. نفس المصدر لكل الأسهم (مصر/الخليج/أمريكا).
   📌 الطريقة (زي المحترفين):
      ① ATR(14) ⇒ وحدة القياس (حجم الحركة).
      ② قمم/قيعان (pivot بأسلوب الـfractal) ⇒ كل قاع/قمة مؤكد.
      ③ تجميع المستويات القريبة من بعض (ضمن 0.45×ATR) ⇒ مستوى واحد.
      ④ قوّة المستوى = عدد اللمسات + الحداثة.
      ⑤ التصنيف: فوق السعر ⇒ مقاومة · تحت السعر ⇒ دعم.
   📌 المخرجات: مستويات + بنية السوق (صاعد/هابط/عرضي) + فيبوناتشي.
   ⛔ مافيش توصية شراء أو بيع — أداة قراءة بنية سعرية فقط.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function num(v) { return (v == null || !isFinite(v)) ? null : Number(v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function median(arr) {
    if (!arr || !arr.length) return null;
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(a.length / 2);
    return (a.length % 2) ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  /* ══════════ ① ATR ══════════ */
  function atr(rows, period) {
    period = period || 14;
    if (!rows || rows.length < 4) return null;
    var trs = [];
    for (var i = 1; i < rows.length; i++) {
      var h = num(rows[i].high), l = num(rows[i].low), pc = num(rows[i - 1].close);
      if (h == null || l == null || pc == null) continue;
      trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    if (!trs.length) return null;
    var p = Math.min(period, trs.length), s = 0;
    for (var j = trs.length - p; j < trs.length; j++) s += trs[j];
    return s / p;
  }

  /* ══════════ ② قمم وقيعان (fractal) ══════════ */
  function pivots(rows, k) {
    k = k || 2;
    var highs = [], lows = [];
    if (!rows || rows.length < (k * 2 + 1)) return { highs: highs, lows: lows };
    for (var i = k; i < rows.length - k; i++) {
      var hi = num(rows[i].high), lo = num(rows[i].low);
      if (hi == null || lo == null) continue;
      var isH = true, isL = true;
      for (var j = i - k; j <= i + k; j++) {
        if (j === i) continue;
        var h2 = num(rows[j].high), l2 = num(rows[j].low);
        if (h2 == null || l2 == null) continue;
        if (h2 >= hi) isH = false;
        if (l2 <= lo) isL = false;
        if (!isH && !isL) break;
      }
      if (isH) highs.push({ i: i, price: hi, time: rows[i].time });
      if (isL) lows.push({ i: i, price: lo, time: rows[i].time });
    }
    return { highs: highs, lows: lows };
  }

  /* ══════════ ③ تجميع المستويات القريبة ══════════ */
  function cluster(list, tol) {
    var out = [];
    var sorted = list.slice().sort(function (a, b) { return a.price - b.price; });
    var cur = null;
    for (var i = 0; i < sorted.length; i++) {
      var p = sorted[i];
      if (!cur || (p.price - cur.max) > tol) {
        cur = { prices: [], idx: [], times: [], max: p.price, min: p.price };
        out.push(cur);
      }
      cur.prices.push(p.price); cur.idx.push(p.i);
      if (p.time != null) cur.times.push(p.time);
      if (p.price > cur.max) cur.max = p.price;
      if (p.price < cur.min) cur.min = p.price;
    }
    return out;
  }

  /* ══════════ ④ بنية السوق (قمم/قيعان صاعدة ولا هابطة) ══════════ */
  function structure(pv) {
    var hh = pv.highs.slice(-2), ll = pv.lows.slice(-2);
    if (hh.length < 2 || ll.length < 2) {
      return { trend: 'unknown', label: 'بنية غير محسومة', short: '—' };
    }
    var upH = hh[1].price > hh[0].price;
    var upL = ll[1].price > ll[0].price;
    if (upH && upL) return { trend: 'up', label: 'بنية صاعدة — قمم وقيعان صاعدة', short: 'صاعد' };
    if (!upH && !upL) return { trend: 'down', label: 'بنية هابطة — قمم وقيعان هابطة', short: 'هابط' };
    if (upH && !upL) return { trend: 'range', label: 'اتساع — قمم صاعدة وقيعان هابطة', short: 'اتساع' };
    return { trend: 'range', label: 'انضغاط — قمم هابطة وقيعان صاعدة', short: 'انضغاط' };
  }

  /* ══════════ ⑤ الفيبوناتشي (أهم حركة في النافذة) ══════════ */
  function fibonacci(rows, lookback) {
    lookback = lookback || 160;
    if (!rows || rows.length < 20) return null;
    var start = Math.max(0, rows.length - lookback);
    var hi = null, lo = null, hiI = start, loI = start;
    for (var i = start; i < rows.length; i++) {
      var h = num(rows[i].high), l = num(rows[i].low);
      if (h != null && (hi == null || h > hi)) { hi = h; hiI = i; }
      if (l != null && (lo == null || l < lo)) { lo = l; loI = i; }
    }
    if (hi == null || lo == null || hi === lo) return null;
    var up = hiI > loI;                 /* الحركة من القاع للقمة */
    var a = up ? lo : hi, b = up ? hi : lo;
    var diff = b - a;
    if (diff <= 0) return null;
    var ratios = [0.236, 0.382, 0.5, 0.618, 0.786];
    var levels = ratios.map(function (r) {
      return { ratio: r, price: up ? (b - diff * r) : (a + diff * r) };
    });
    return {
      from: a, to: b, up: up, diff: diff,
      high: hi, low: lo, highIndex: hiI, lowIndex: loI,
      levels: levels,
      label: up ? 'ارتفاع' : 'هبوط'
    };
  }

  /* ══════════ التحليل الكامل ══════════ */
  /* opts: { atrPeriod, pivot, lookback, maxLevels, minScore } */
  function analyze(rows, opts) {
    opts = opts || {};
    var out = {
      ok: false, rows: (rows && rows.length) || 0, atr: null, last: null,
      levels: [], supports: [], resistances: [], structure: null, fib: null,
      pivotHigh: null, pivotLow: null, pivotHighIndex: -1, pivotLowIndex: -1
    };
    if (!rows || !rows.length) return out;
    var lastRow = rows[rows.length - 1];
    var last = num(lastRow.close);
    if (last == null) last = num(lastRow.high);
    out.last = last;
    out.atr = atr(rows, opts.atrPeriod || 14);
    var pv = pivots(rows, opts.pivot == null ? 2 : opts.pivot);
    out.pivotHigh = pv.highs.length ? pv.highs[pv.highs.length - 1].price : null;
    out.pivotLow = pv.lows.length ? pv.lows[pv.lows.length - 1].price : null;
    if (pv.highs.length) out.pivotHighIndex = pv.highs[pv.highs.length - 1].i;
    if (pv.lows.length) out.pivotLowIndex = pv.lows[pv.lows.length - 1].i;
    out.structure = structure(pv);
    out.fib = fibonacci(rows, opts.lookback || 160);
    if (last == null) return out;

    var n = rows.length;
    /* ⭐ التجميع: القممCandidate والقيعانCandidate كل واحد لوحده
       (لو جمعناهم مع بعض كانت قمة قريبة من قاع هتدمج معاه). */
    var tol = Math.max((out.atr || 0) * 0.45, last * 0.0012);
    var groups = cluster(pv.highs, tol).concat(cluster(pv.lows, tol));
    var levels = [];
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var touches = g.idx.length;
      var lastIdx = Math.max.apply(null, g.idx);
      var barsAgo = n - 1 - lastIdx;
      var recency = 1 / (1 + barsAgo / 25);          /* ١ = طازج */
      var price = median(g.prices);
      if (price == null || !isFinite(price)) continue;
      var score = Math.min(100, Math.round(touches * 16 + recency * 34));
      var dist = ((price - last) / last) * 100;
      var dead = (out.atr || 0) * 0.15;
      var kind = 'قريب';
      if (price > last + dead) kind = 'مقاومة';
      else if (price < last - dead) kind = 'دعم';
      levels.push({
        price: price, kind: kind, touches: touches, score: score,
        barsAgo: barsAgo, distancePct: dist,
        lastIndex: lastIdx,
        lastTime: g.times.length ? g.times[g.times.length - 1] : null,
        low: g.min, high: g.max
      });
    }
    /* ⭐ ترتيب: الأقرب للسعر الأول (المهم للمستخدم) */
    levels.sort(function (a, b) { return Math.abs(a.distancePct) - Math.abs(b.distancePct); });
    /* ⭐ فلترة: نشيل المستويات الضعيفة (score < minScore) بس
       بنسيب أقرب دعم ومقاومة دائماً (المهمين). */
    var minScore = opts.minScore == null ? 26 : opts.minScore;
    var kept = [], nearestS = null, nearestR = null;
    for (var k = 0; k < levels.length; k++) {
      var L = levels[k];
      if (L.kind === 'دعم' && !nearestS) nearestS = L;
      if (L.kind === 'مقاومة' && !nearestR) nearestR = L;
    }
    for (var k2 = 0; k2 < levels.length; k2++) {
      var L2 = levels[k2];
      if (L2.score >= minScore || L2 === nearestS || L2 === nearestR) kept.push(L2);
    }
    var maxLevels = opts.maxLevels || 8;
    if (kept.length > maxLevels) {
      kept.sort(function (a, b) { return b.score - a.score; });
      kept = kept.slice(0, maxLevels);
      kept.sort(function (a, b) { return Math.abs(a.distancePct) - Math.abs(b.distancePct); });
    }
    out.levels = kept;
    for (var s = 0; s < kept.length; s++) {
      if (kept[s].kind === 'دعم') out.supports.push(kept[s]);
      else if (kept[s].kind === 'مقاومة') out.resistances.push(kept[s]);
    }
    out.ok = true;
    return out;
  }

  /* ══════════ الرسم على الشارت ══════════ */
  /* ⭐ مستويات ⇒ خطوط: العرض حسب القوّة · اللون حسب النوع */
  var COL = {
    'دعم': '#22c55e', 'مقاومة': '#ef4444', 'قريب': '#d4af37'
  };
  function lineStyle(style) {
    if (style === 0) return 0;      /* solid */
    if (style === 1) return 1;      /* dotted */
    return 2;                        /* dashed */
  }
  function toLines(an, opts) {
    opts = opts || {};
    var out = [];
    if (!an || !an.ok) return out;
    var i, L;
    for (i = 0; i < an.levels.length; i++) {
      L = an.levels[i];
      if (L.price == null || !isFinite(L.price)) continue;
      var w = L.score >= 70 ? 2 : (L.score >= 45 ? 1.5 : 1);
      out.push({
        price: L.price,
        color: COL[L.kind] || '#d4af37',
        style: lineStyle(L.score >= 70 ? 2 : 1),
        width: w,
        soft: L.score < 45,
        title: (L.kind === 'دعم' ? 'دعم ' : (L.kind === 'مقاومة' ? 'مقاومة ' : 'مستوى ')) + L.price
      });
    }
    if (opts.fib && an.fib) {
      var fc = opts.fibColor || 'rgba(147,197,253,.75)';
      for (i = 0; i < an.fib.levels.length; i++) {
        out.push({
          price: an.fib.levels[i].price, color: fc, style: 1, width: 1, soft: true,
          title: 'فيبوناتشي ' + Math.round(an.fib.levels[i].ratio * 100) + '%'
        });
      }
    }
    return out;
  }

  /* ⭐ المناطق: شريط شفاف حول المستوى القوي (أعرض =Areas) */
  function zoneDraw(an, rows, opts) {
    opts = opts || {};
    var width = opts.width || 0.45;      /* بالمضاعف من ATR */
    var minScore = opts.minScore == null ? 45 : opts.minScore;
    return function (g, ctx) {
      try {
        if (!an || !an.ok || !an.atr) return;
        var half = an.atr * width / 2;
        for (var i = 0; i < an.levels.length; i++) {
          var L = an.levels[i];
          if (L.score < minScore || L.price == null) continue;
          var yTop = ctx.priceY(L.price + half);
          var yBot = ctx.priceY(L.price - half);
          if (yTop == null || yBot == null) continue;
          var y1 = Math.min(yTop, yBot), h = Math.abs(yBot - yTop);
          if (h < 2) { y1 = y1 - 1; h = 2; }
          if (y1 > ctx.paneH || y1 + h < 0) continue;
          g.fillStyle = (L.kind === 'مقاومة')
            ? 'rgba(239,68,68,.10)' : 'rgba(34,197,94,.10)';
          g.fillRect(0, y1, ctx.right, h);
          g.strokeStyle = (L.kind === 'مقاومة')
            ? 'rgba(239,68,68,.35)' : 'rgba(34,197,94,.35)';
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(0, Math.round(y1 + h / 2) + 0.5);
          g.lineTo(ctx.right, Math.round(y1 + h / 2) + 0.5);
          g.stroke();
        }
      } catch (e) { }
    };
  }

  /* ══════════ الجدول الاحترافي ══════════ */
  function stars(n) {
    var s = '';
    for (var i = 0; i < 5; i++) s += (i < n) ? '★' : '☆';
    return s;
  }
  function fmt(v, digits) {
    if (v == null || !isFinite(v)) return '—';
    var d = digits == null ? 2 : digits;
    var a = Math.abs(v);
    if (a >= 1000) return v.toFixed(1);
    if (a >= 100) return v.toFixed(d);
    if (a >= 1) return v.toFixed(Math.max(2, d));
    return v.toFixed(Math.max(3, d + 1));
  }
  function tableHTML(an, opts) {
    opts = opts || {};
    if (!an || !an.ok) {
      return '<div class="sr-empty">مفيش بيانات كفاية نحسب منها بنية سعرية.</div>';
    }
    var rows = an.levels.slice().sort(function (a, b) {
      if (a.kind !== b.kind) return a.kind === 'مقاومة' ? -1 : 1;
      return b.price - a.price;
    });
    var h = '';
    if (an.structure) {
      var badge = { 'up': 'up', 'down': 'dn', 'range': 'fl', 'unknown': '' }[an.structure.trend] || '';
      h += '<div class="sr-struct ' + badge + '">' +
        '<b>' + (an.structure.label || '') + '</b>' +
        '<span>ATR ' + fmt(an.atr, 2) + ' · السعر ' + fmt(an.last, 2) + '</span>' +
        '</div>';
    }
    if (!rows.length) {
      h += '<div class="sr-empty">مفيش مستويات واضحة في البيانات دي.</div>';
      return h;
    }
    h += '<div class="sr-tabs"><span>المستوى</span><span>النوع</span><span>القوّة</span>' +
      '<span>اللمسات</span><span>البُعد</span></div>';
    for (var i = 0; i < rows.length; i++) {
      var L = rows[i];
      var cls = L.kind === 'مقاومة' ? 'dn' : (L.kind === 'دعم' ? 'up' : 'fl');
      var st = stars(Math.max(1, Math.min(5, Math.round(L.score / 20))));
      h += '<div class="sr-row ' + cls + '">' +
        '<b dir="ltr">' + fmt(L.price, 2) + '</b>' +
        '<span class="sr-kind">' + (L.kind === 'مقاومة' ? '▼ مقاومة' : (L.kind === 'دعم' ? '▲ دعم' : '◆ قريب')) + '</span>' +
        '<span class="sr-stars">' + st + '</span>' +
        '<span>' + (L.touches || 1) + '</span>' +
        '<span dir="ltr">' + (L.distancePct >= 0 ? '+' : '') + fmt(L.distancePct, 2) + '%</span>' +
        '</div>';
    }
    if (an.fib) {
      h += '<div class="sr-fib">فيبوناتشي ' + an.fib.label + ' من ' + fmt(an.fib.from, 2) +
        ' لحد ' + fmt(an.fib.to, 2) + '</div>';
    }
    h += '<div class="sr-note">⛔ قراءة بنية سعرية — مافيش توصية شراء أو بيع.</div>';
    return h;
  }

  window.OCTASR = {
    analyze: analyze,
    toLines: toLines,
    zoneDraw: zoneDraw,
    tableHTML: tableHTML,
    atr: atr,
    pivots: pivots,
    fibonacci: fibonacci,
    COL: COL
  };
})();
