/* ══════════════════════════════════════════════════════════════
   📈 OCTA ChartKit — lightweight-charts + رسم النمط الاحترافي
   ──────────────────────────────────────────────────────────────
   📌 مشترك بين «نماذجي» و«الاستوديو» — نسخة واحدة من الكود.
   ⛔ مافيش تخمين: لو مكتبة الرسم مش متاحة ⇒ بنبلغ بوضوح
      (ومفيش crash).
   ⛔ مافيش نص عربي على الـcanvas (مش فيه تشكيل RTL) ⇒ كل
      التسميات العربية بتتدخل من price lines (DOM) مش من الرسم.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var lib = null;
  var loading = null;

  function load() {
    if (lib) return Promise.resolve(lib);
    if (window.LightweightCharts) { lib = window.LightweightCharts; return Promise.resolve(lib); }
    if (loading) return loading;
    loading = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'assets/js/vendor/lightweight-charts.standalone.production.js';
      s.onload = function () { lib = window.LightweightCharts; res(lib); };
      s.onerror = function () { rej(new Error('chart lib failed')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function n(v) {
    var x = Number(v);
    return isFinite(x) ? x : 0;
  }

  /* ⛔ ترتيب زمني: التواريخ 'YYYY-MM-DD' ⇒ المقارنة النصية صح */
  function byTime(a, b) {
    return a.time < b.time ? -1 : (a.time > b.time ? 1 : 0);
  }

  /* ══════════ تطبيع شكل بيانات الشموع ══════════
     📌 الـAPI بيرجّع شموع بالأعمدة: {codes:{CODE:{t:[],o:[],h:[],l:[],c:[],v:[]}}}
     📌 وقبلها كان بيرجّع مصفوفة كائنات ⇒ بندعم الشكلين. */
  function rowsFromHistory(json, code) {
    if (!json) return [];
    var src = null;
    if (json.codes && code && json.codes[code]) src = json.codes[code];
    else if (json.candles) src = json.candles;
    else if (json.data) src = json.data;
    else if (code && json[code]) src = json[code];
    if (!src) return [];
    var rows = [];
    if (Object.prototype.toString.call(src) === '[object Array]') {
      for (var i = 0; i < src.length; i++) {
        var c = src[i] || {};
        var t = (c.t != null ? c.t : (c.time != null ? c.time : c.d));
        if (t == null) continue;
        rows.push({
          time: typeof t === 'string' ? t : String(t),
          open: n(c.o != null ? c.o : c.open), high: n(c.h != null ? c.h : c.high),
          low: n(c.l != null ? c.l : c.low), close: n(c.c != null ? c.c : c.close),
          volume: n(c.v != null ? c.v : c.volume)
        });
      }
    } else if (src.t && src.c) {
      for (var k = 0; k < src.t.length; k++) {
        var tt = src.t[k];
        if (tt == null) continue;
        rows.push({
          time: typeof tt === 'string' ? tt : String(tt),
          open: n(src.o && src.o[k]), high: n(src.h && src.h[k]),
          low: n(src.l && src.l[k]), close: n(src.c && src.c[k]),
          volume: n(src.v && src.v[k])
        });
      }
    }
    rows.sort(byTime);
    /* ⛔ شموع ناقصة (سعر صفري) ⇒ مش بنرسمها (بتكسر مقياس السعر) */
    return rows.filter(function (r) {
      return r.close > 0 && r.high > 0 && r.low > 0 && r.open > 0;
    });
  }

  /* ══════════ EMA (للسياق الفني) ══════════ */
  function ema(values, period) {
    var out = [];
    var k = 2 / (period + 1);
    var prev = null;
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (v == null || !isFinite(v)) { out.push({ time: null, value: null }); continue; }
      prev = (prev == null) ? v : (v * k + prev * (1 - k));
      out.push({ time: null, value: prev });
    }
    return out;
  }

  /* ══════════ شارت TradingView الرسمي ══════════
     📌 الـwidget المجاني (s.tradingview.com/widgetembed) مش بيسمح
        برسم أشكال مخصوصة ⇒ الرسم الاحترافي للنمط بيتم على شارتنا
        بالأرقام الحقيقية، والتVj widget بيتبقى جنبه. */
  function tvWidgetUrl(code) {
    var sym = encodeURIComponent('EGX:' + String(code || ''));
    return 'https://s.tradingview.com/widgetembed/?frameElementId=octa-tv-' +
      encodeURIComponent(String(code || 'x')) +
      '&symbol=' + sym +
      '&interval=1D&range=180&timezone=Africa%2FCairo' +
      '&theme=dark&style=1&locale=ar' +
      '&hide_side_toolbar=0&allow_symbol_change=1&save_image=0&calendar=0&support_host=1';
  }
  function tvOpenUrl(code) {
    return 'https://www.tradingview.com/chart/?symbol=' +
      encodeURIComponent('EGX:' + String(code || ''));
  }

  /* ⛔ ترتيب زمني + تواريخ: أدوات مشتركة */
  function shiftDate(dateStr, days) {
    if (!dateStr) return null;
    var p = String(dateStr).split('-');
    if (p.length !== 3) return null;
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  }

  function findIndexIn(rows, dateStr) {
    if (!dateStr) return -1;
    for (var i = rows.length - 1; i >= 0; i--) {
      if (rows[i].time <= dateStr) return i;
    }
    return 0;
  }

  /* ══════════ الرسم ══════════ */
  /* rows: [{time, open, high, close, volume?}] */
  function mount(box, rows, opts) {
    if (!box) return Promise.reject(new Error('no box'));
    opts = opts || {};
    return load().then(function (L) {
      /* ⛔⛔ البوكس هو المرجع: ارتفاعه = ارتفاع الشارت بالظبط.
         قبل كده كان الشارت أطول من البوكس ⇒ الـpane بتاع الحجم كان
         يسرّب فوق الكروت اللي تحته (الشكل مش متناسق). */
      var H = Math.max(200, Math.round(opts.height || box.clientHeight || 300));
      box.style.height = H + 'px';
      box.style.overflow = 'hidden';
      box.style.position = box.style.position || 'relative';

      var chart = L.createChart(box, {
        /* ⛔ اللوجو اللي بيظهر جوه الشارت ( TradingView ) كان بيغطي
           الشموع وVolume pane ⇒ شِيلناه. ⚖️ حسب رخصة المكتبة: مسموح
           تشيله بس لو حطيت إشعار NOTICE + رابط tradingview.com على
           الصفحة ⇒ بنعملها تحت الشارت (octa-attr). */
        layout: {
          background: { type: 'solid', color: 'transparent' },
          textColor: '#8b9eb0', fontSize: 10,
          attributionLogo: false
        },
        grid: { vertLines: { color: 'rgba(255,255,255,.05)' }, horzLines: { color: 'rgba(255,255,255,.05)' } },
        rightPriceScale: { borderColor: 'rgba(255,255,255,.12)' },
        leftPriceScale: { visible: false },
        timeScale: { borderColor: 'rgba(255,255,255,.12)', timeVisible: false },
        height: H
      });
      var cs = chart.addSeries(L.CandlestickSeries, {
        upColor: '#22c55e', downColor: '#ef4444',
        borderUpColor: '#22c55e', borderDownColor: '#ef4444',
        wickUpColor: '#22c55e', wickDownColor: '#ef4444',
        priceLineVisible: false
      });
      cs.setData(rows.map(function (c) {
        return { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close };
      }));
      chart.__octaSeries = cs;
      /* ⭐ المتوسطات المتحركة (السياق الفني) — ٢٠ و٥٠ */
      chart.__octaEma = [];
      if (opts.emas && opts.emas.length && L.LineSeries) {
        var closes = rows.map(function (c) { return c.close; });
        for (var ei = 0; ei < opts.emas.length; ei++) {
          var em = opts.emas[ei];
          try {
            var ls = chart.addSeries(L.LineSeries, {
              color: em.color || '#64748b', lineWidth: 1,
              priceLineVisible: false, lastValueVisible: false,
              crosshairMarkerVisible: false
            });
            var eSeries = ema(closes, em.period);
            var pts = [];
            for (var pi = 0; pi < rows.length; pi++) {
              if (eSeries[pi].value == null) continue;
              pts.push({ time: rows[pi].time, value: eSeries[pi].value });
            }
            ls.setData(pts);
            chart.__octaEma.push({ period: em.period, series: ls, title: em.title });
          } catch (e) { }
        }
      }
      if (opts.volume) {
        /* ⛔⛔ الحجم في **pane مستقل** (مش overlay على pane السعر):
           overlay كان بيطلع جوه مربعات الشارت. الـpane الجديد طوله
           صفر افتراضياً ⇒ لازم نحدّد له نسبة، ونخفي محوره. */
        var vs = chart.addSeries(L.HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'left',
          lastValueVisible: false,
          priceLineVisible: false
        }, 1);
        vs.setData(rows.map(function (c) {
          return {
            time: c.time, value: c.volume,
            color: c.close >= c.open ? 'rgba(34,197,94,.40)' : 'rgba(239,68,68,.40)'
          };
        }));
        try {
          var panes = chart.panes();
          if (panes && panes[1] && panes[1].setStretchFactor) panes[1].setStretchFactor(0.7);
        } catch (e) { }
      }
      /* ⛔⛔ مافيش price lines: كانت بتلخبط محور السعر (ملصق لكل مستوى)
         وبتمدّد المقياس وبتخفي الشموع. المستويات بتترسم على الـcanvas
         والأسماء العربية في الـlegend تحت الشارت. */
      /* 📌 تركيز على آخر ٦٠ شمعة (مش كل التاريخ) ⇒ المستويات واضحة */
      try {
        if (opts.focusBars && rows.length > opts.focusBars) {
          chart.timeScale().setVisibleLogicalRange({
            from: rows.length - opts.focusBars, to: rows.length + 2
          });
        } else {
          chart.timeScale().fitContent();
        }
      } catch (e) {
        try { chart.timeScale().fitContent(); } catch (e2) { }
      }
      if (typeof opts.onPriceClick === 'function') {
        try {
          chart.subscribeClick(function (param) {
            if (!param || param.point == null) return;
            var v = param.point.value;
            if (v != null && isFinite(v)) opts.onPriceClick(v);
          });
        } catch (e) { }
      }
      /* 🎨 الـoverlay: خطوط المستويات (+ رسمة النمط لو موجودة) */
      try { createOverlay(chart, box, rows, opts); }
      catch (e) {
        try { if (window.console) console.warn('[chartkit] تعذّر الرسم:', e); } catch (e2) { }
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', function () {
          try { chart.applyOptions({ width: box.clientWidth }); } catch (e) { }
        });
      }
      return chart;
    });
  }

  /* ══════════════════════════════════════════════════════════
     🎨 رسمة النمط الاحترافي (منطقة + وقف/هدف + علامة الكسر)
     ══════════════════════════════════════════════════════════
     📌 كل الأرقام من الـAPI ⇒ مافيش رسم على الفاضي.
     📌 النطاق: من تاريخ تكوّن المنطقة (detected_at − age_days)
        لحد تاريخ التأكيد (detected_at).
     📌 ٣ إغلاقات التأكيد: آخر ٣ شموع لحد تاريخ التأكيد.
     ⛔ كل التسميات العربية في الـlegend (DOM) — الـcanvas أشكال فقط. */
  function mountPattern(box, rows, opts) {
    if (!box) return Promise.reject(new Error('no box'));
    opts = opts || {};
    var pat = opts.pattern || {};
    /* ⛔ لو الرسم فشل ⇒ الشارت يفضل شغال، بس نسجّل عشان نعرف */
    opts.extraDraw = function (g, ctx) {
      try { drawPattern(g, ctx, rows, pat); }
      catch (e) {
        try { if (window.console) console.warn('[chartkit] تعذّر رسم النمط:', e); } catch (e2) { }
      }
    };
    /* ⭐ refocus: نركّز على **فترة النمط** (من بداية تكوّن المنطقة
       لحد آخر شمعة) بدل عدد ثابت من الشموع ⇒ الشموع تبقى كبيرة
       والنمط باين. مافيش look-ahead: كل التواريخ ≤ تاريخ التأكيد. */
    if (pat && pat.detect_at && rows && rows.length) {
      var from = pat.zone_from || shiftDate(pat.detect_at, (pat.age_days || 0) + 12);
      var iFrom = findIndexIn(rows, from);
      if (iFrom >= 0) {
        var want = rows.length - iFrom + 2;
        if (want >= 18 && want <= rows.length) opts.focusBars = want;
      }
    }
    return mount(box, rows, opts);
  }

  /* ⭐ الـlegend: HTML جاهز (DOM ⇒ تشكيل عربي صح) */
  function legendHTML(items) {
    var out = '';
    var lg = items || [];
    for (var li = 0; li < lg.length; li++) {
      var it2 = lg[li];
      if (!it2) continue;
      out += '<div class="lg-row' + (it2.soft ? ' soft' : '') + '">' +
        '<i style="background:' + (it2.color || '#d4af37') + '"></i>' +
        '<span>' + (it2.label || '') + '</span>' +
        (it2.price != null ? ('<b dir="ltr">' + it2.price + '</b>') : '') +
        (it2.tag ? '<u>' + it2.tag + '</u>' : '') +
        '</div>';
    }
    return out;
  }

  /* 🎨 الـoverlay: كانفس فوق الشارت — خطوط المستويات + رسمة النمط */
  function createOverlay(chart, box, rows, opts) {
    var cv = document.createElement('canvas');
    cv.className = 'octa-ovl';
    cv.style.position = 'absolute';
    cv.style.left = '0'; cv.style.top = '0';
    cv.style.pointerEvents = 'none';
    cv.style.zIndex = '9999';
    box.appendChild(cv);

    var ts = chart.timeScale();

    function priceY(price) {
      if (price == null || !isFinite(price)) return null;
      try {
        var s = chart.__octaSeries || null;
        if (!s) return null;
        var y = s.priceToCoordinate(price);
        return (y == null || !isFinite(y)) ? null : y;
      } catch (e) { return null; }
    }

    function dashFor(style) {
      if (style === 0) return [];
      if (style === 1) return [2, 3];
      return [6, 4];
    }

    function draw() {
      var w = box.clientWidth, h = box.clientHeight;
      if (!w || !h) return;
      var dpr = (window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      var g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      /* ⛔ ارتفاع pane السعر فقط (فوق pane الحجم) ⇒ الرسم ما يسرّبش */
      var paneH = h;
      try {
        var panes = chart.panes();
        if (panes && panes[0] && panes[0].getHeight) paneH = panes[0].getHeight();
      } catch (e) { }
      if (!paneH || paneH > h) paneH = h;

      var psw = 0;
      try { psw = chart.priceScale('right').width() || 0; } catch (e) { }
      if (!psw) psw = 56;
      var right = Math.max(20, w - psw);

      /* ── ① خطوط المستويات (المقاسة + الإدارة) ── */
      var lines = (opts && opts.lines) || [];
      for (var li = 0; li < lines.length; li++) {
        var l = lines[li];
        if (!l || l.price == null || !isFinite(l.price)) continue;
        var y = priceY(l.price);
        if (y == null || y < -2 || y > paneH + 2) continue;
        g.strokeStyle = l.color || '#d4af37';
        g.globalAlpha = l.soft ? 0.7 : 0.95;
        g.lineWidth = l.width || 1;
        g.setLineDash(dashFor(l.style));
        g.beginPath();
        g.moveTo(0, Math.round(y) + 0.5);
        g.lineTo(right, Math.round(y) + 0.5);
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;
      }

      /* ── ② رسمة النمط (منطقة + عائد/مخاطرة + علامة الكسر) ── */
      if (typeof opts.extraDraw === 'function') {
        opts.extraDraw(g, { w: w, h: h, paneH: paneH, right: right, priceY: priceY, ts: ts });
      }
    }

    /* ⭐ الـlegend: **تحت الشارت** (مش فوقه) ⇒ الشارت يفضل واضح
       والأسماء العربية (DOM) سليمة. */
    /* ⚖️ إشعار رخصة الرسوم: NOTICE + رابط tradingview.com
       (شرط قانوني لشيل لوجو TradingView اللي كان جوه الشارت). */
    var ATTR = '<div class="octa-attr">الرسوم: <a href="https://www.tradingview.com/" ' +
      'target="_blank" rel="noopener noreferrer">TradingView Lightweight Charts&#8482;</a> ' +
      '&middot; Copyright &copy; 2025 TradingView, Inc.</div>';
    try {
      var lg = (opts || {}).legend;
      var host = (opts || {}).legendBox;
      var html = (lg && lg.length) ? legendHTML(lg) : '';
      if (host) {
        host.innerHTML = html + ATTR;
        host.style.display = '';
      } else {
        var legendEl = null;
        if (html && box.parentNode) {
          var box2 = document.createElement('div');
          box2.className = 'octa-legend';
          box2.innerHTML = html;
          box.parentNode.insertBefore(box2, box.nextSibling);
          legendEl = box2;
        }
        var attr = document.createElement('div');
        attr.className = 'octa-attr';
        attr.innerHTML = ATTR;
        if (legendEl && legendEl.parentNode) legendEl.parentNode.insertBefore(attr, legendEl.nextSibling);
        else if (box.parentNode) box.parentNode.insertBefore(attr, box.nextSibling);
      }
    } catch (e) { }

    draw();
    /* ⛔ تاني فريم: محور السعر بيتحسب بعد أول رسم ⇒ نعيد الرسم */
    try {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(draw);
      setTimeout(draw, 120);
    } catch (e) { }
    try {
      ts.subscribeVisibleLogicalRangeChange(function () { draw(); });
    } catch (e) { }
    try {
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', function () { draw(); });
      }
    } catch (e) { }
    return cv;
  }

  /* 🎨 رسمة النمط: المنطقة + عائد/مخاطرة + علامة الكسر (٣ إغلاقات) */
  function drawPattern(g, ctx, rows, pat) {
    if (!pat || !rows || !rows.length) return;
    var ts = ctx.ts, priceY = ctx.priceY, paneH = ctx.paneH, right = ctx.right;

    var findIndex = function (d) { return findIndexIn(rows, d); };

    /* ── ① نطاق الكسر (المنطقة) ── */
    if (pat.zone_low != null && pat.zone_high != null && pat.detect_at) {
      var from = pat.zone_from || shiftDate(pat.detect_at, pat.age_days || 0);
      var iFrom = findIndex(from);
      var iTo = findIndex(pat.detect_at);
      if (iFrom >= 0 && iTo >= iFrom) {
        var x1 = ts.timeToCoordinate(rows[iFrom].time);
        var x2 = ts.timeToCoordinate(rows[iTo].time);
        var yTop = priceY(pat.zone_high), yBot = priceY(pat.zone_low);
        if (x1 != null && x2 != null && yTop != null && yBot != null) {
          var bx = Math.min(x1, x2), bw = Math.abs(x2 - x1);
          var by = Math.min(yTop, yBot), bh = Math.abs(yBot - yTop);
          /* ⛔ منطقة رقيقة (ارتفاع ≈ صفر) ⇒ نرسمها كخط سميك بدل
             مستطيل معدوم. الأرقام الحقيقية في الـlegend. */
          if (bh < 3) { by = by - 1.5; bh = 3; }
          g.fillStyle = 'rgba(168,85,247,.18)';
          g.fillRect(bx, by, Math.max(2, bw), bh);
          g.strokeStyle = 'rgba(168,85,247,.85)';
          g.lineWidth = 1;
          g.setLineDash([5, 3]);
          g.strokeRect(bx, by, Math.max(2, bw), bh);
          g.setLineDash([]);
        }
      }
    }

    /* ── ② مناطق العائد/المخاطرة (من التأكيد لآخر شمعة) ── */
    if (pat.entry != null && pat.stop != null && pat.target != null && pat.detect_at) {
      var iD = findIndex(pat.detect_at);
      if (iD >= 0) {
        var xD = ts.timeToCoordinate(rows[iD].time);
        var xLast = ts.timeToCoordinate(rows[rows.length - 1].time);
        var yE = priceY(pat.entry), yS = priceY(pat.stop), yT = priceY(pat.target);
        if (xD != null && xLast != null && yE != null && yS != null && yT != null) {
          var xa = Math.min(xD, xLast), xb = Math.max(xD, xLast);
          g.fillStyle = 'rgba(34,197,94,.13)';
          g.fillRect(xa, Math.min(yE, yT), Math.max(1, xb - xa), Math.abs(yT - yE));
          g.fillStyle = 'rgba(239,68,68,.13)';
          g.fillRect(xa, Math.min(yE, yS), Math.max(1, xb - xa), Math.abs(yS - yE));
        }
      }
    }

    /* ── ③ علامة الكسر: ٣ إغلاقات + خط التأكيد ── */
    if (pat.detect_at) {
      var iDet = findIndex(pat.detect_at);
      if (iDet >= 0) {
        var xDet = ts.timeToCoordinate(rows[iDet].time);
        if (xDet != null) {
          g.strokeStyle = 'rgba(212,175,55,.75)';
          g.lineWidth = 1;
          g.setLineDash([4, 3]);
          g.beginPath(); g.moveTo(xDet, 0); g.lineTo(xDet, paneH); g.stroke();
          g.setLineDash([]);
          for (var k = Math.max(0, iDet - 2); k <= iDet; k++) {
            var xk = ts.timeToCoordinate(rows[k].time);
            var yl = priceY(rows[k].low);
            if (xk == null || yl == null || yl > paneH) continue;
            g.fillStyle = '#d4af37';
            g.beginPath();
            g.moveTo(xk, yl + 3);
            g.lineTo(xk - 6, yl + 15);
            g.lineTo(xk + 6, yl + 15);
            g.closePath(); g.fill();
          }
        }
      }
    }
  }

  window.OCTAChartKit = {
    load: load,
    mount: mount,
    mountPattern: mountPattern,
    rowsFromHistory: rowsFromHistory,
    ema: ema,
    legendHTML: legendHTML,
    tvWidgetUrl: tvWidgetUrl,
    tvOpenUrl: tvOpenUrl
  };
})();
