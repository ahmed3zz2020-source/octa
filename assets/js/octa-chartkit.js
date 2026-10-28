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

  /* ══════════ الرسم ══════════ */
  /* rows: [{time, open, high, low, close, volume?}] */
  function mount(box, rows, opts) {
    if (!box) return Promise.reject(new Error('no box'));
    opts = opts || {};
    return load().then(function (L) {
      var chart = L.createChart(box, {
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8b9eb0', fontSize: 10 },
        grid: { vertLines: { color: 'rgba(255,255,255,.05)' }, horzLines: { color: 'rgba(255,255,255,.05)' } },
        rightPriceScale: { borderColor: 'rgba(255,255,255,.12)' },
        timeScale: { borderColor: 'rgba(255,255,255,.12)', timeVisible: false },
        height: opts.height || 300
      });
      var cs = chart.addSeries(L.CandlestickSeries, {
        upColor: '#22c55e', downColor: '#ef4444',
        borderUpColor: '#22c55e', borderDownColor: '#ef4444',
        wickUpColor: '#22c55e', wickDownColor: '#ef4444'
      });
      cs.setData(rows.map(function (c) {
        return { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close };
      }));
      /* 📌 نحتفظ بالسلسلة ⇒ الـoverlay يقدر يحوّل سعر ⇒ إحداثي */
      chart.__octaSeries = cs;
      if (opts.volume) {
        var vs = chart.addSeries(L.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '' }, 1);
        vs.setData(rows.map(function (c) {
          return {
            time: c.time, value: c.volume,
            color: c.close >= c.open ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)'
          };
        }));
      }
      /* خطوط السعر */
      var lines = opts.lines || [];
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        if (!l || l.price == null || !isFinite(l.price)) continue;
        cs.createPriceLine({
          price: l.price,
          color: l.color || '#d4af37',
          lineWidth: l.width || 1,
          lineStyle: l.style || 2,
          title: l.title || ''
        });
      }
      /* 📌 تركيز على آخر ٦٠ شمعة (مش كل التاريخ) ⇒ المستويات واضحة
         والشارت مقروء على الموبايل. */
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
        /* ⛔ lightweight-charts v4: بنقرأ السعر من إحداثيات الماوس
           عبر subscribeClick على الـchart (متاح في v4.1+) */
        try {
          chart.subscribeClick(function (param) {
            if (!param || param.point == null) return;
            var v = param.point.value;
            if (v != null && isFinite(v)) opts.onPriceClick(v);
          });
        } catch (e) { }
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
     🎨 رسم النمط الاحترافي (منطقة + وقف/هدف + علامة الكسر)
     ══════════════════════════════════════════════════════════
     📌 كل الأرقام من الـAPI ⇒ مافيش رسم على الفاضي.
     📌 النطاق: من تاريخ تكوّن المنطقة (detected_at − age_days)
        لحد تاريخ التأكيد (detected_at).
     📌 ٣ إغلاقات التأكيد: آخر ٣ شموع لحد تاريخ التأكيد.
     ⛔ كل التسميات العربية من price lines (DOM) — الـcanvas أشكال فقط. */
  function mountPattern(box, rows, opts) {
    if (!box) return Promise.reject(new Error('no box'));
    opts = opts || {};
    var pat = opts.pattern || {};
    return mount(box, rows, opts).then(function (chart) {
      /* ⛔ لو الرسم foursed ⇒ الشارت يفضل شغال، بس نسجّل عشان نعرف */
      try { return paint(chart, box, rows, pat); }
      catch (e) {
        try { if (window.console) console.warn('[chartkit] تعذّر رسم النمط:', e); } catch (e2) { }
        return chart;
      }
    });
  }

  function paint(chart, box, rows, pat) {
    if (!chart || !rows || !rows.length) return chart;
    var cv = document.createElement('canvas');
    cv.className = 'octa-ovl';
    cv.style.position = 'absolute';
    cv.style.left = '0'; cv.style.top = '0';
    cv.style.pointerEvents = 'none';
    cv.style.zIndex = '9999';
    box.style.position = box.style.position || 'relative';
    box.appendChild(cv);

    var ts = chart.timeScale();

    function findIndex(dateStr) {
      if (!dateStr) return -1;
      for (var i = rows.length - 1; i >= 0; i--) {
        if (rows[i].time <= dateStr) return i;
      }
      /* ⛔ التاريخ قبل أول شمعة ظاهرة (مثلاً بداية النطاق أقدم من
         النافذة) ⇒ نبدأ من أول شمالة معروضة بدل ما نلغي الرسم. */
      return 0;
    }

    function shiftDate(dateStr, days) {
      if (!dateStr) return null;
      var p = String(dateStr).split('-');
      if (p.length !== 3) return null;
      var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
      d.setUTCDate(d.getUTCDate() - days);
      return d.toISOString().slice(0, 10);
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

      var psw = 0;
      try { psw = chart.priceScale('right').width() || 0; } catch (e) { }
      var right = Math.max(10, w - psw);

      /* ── ① نطاق الكسر (المنطقة) ── */
      if (pat.zone_low != null && pat.zone_high != null && pat.detect_at) {
        var from = pat.zone_from || shiftDate(pat.detect_at, pat.age_days || 0);
        var iFrom = findIndex(from);
        var iTo = findIndex(pat.detect_at);
        if (iFrom >= 0 && iTo >= iFrom) {
          var tFrom = rows[iFrom].time, tTo = rows[iTo].time;
          var x1 = ts.timeToCoordinate(tFrom);
          var x2 = ts.timeToCoordinate(tTo);
          var pHi = pat.zone_high, pLo = pat.zone_low;
          /* السعر → إحداثي عمودي: بنستخدم الدالة المدمجة في السلسلة */
          var yTop = priceY(pHi), yBot = priceY(pLo);
          if (x1 != null && x2 != null && yTop != null && yBot != null) {
            g.fillStyle = 'rgba(168,85,247,.13)';
            g.fillRect(Math.min(x1, x2), Math.min(yTop, yBot), Math.abs(x2 - x1), Math.abs(yBot - yTop));
            g.strokeStyle = 'rgba(168,85,247,.75)';
            g.lineWidth = 1;
            g.setLineDash([4, 3]);
            g.beginPath();
            g.moveTo(Math.min(x1, x2), yTop); g.lineTo(Math.max(x1, x2), yTop);
            g.stroke();
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
            g.fillStyle = 'rgba(34,197,94,.10)';
            g.fillRect(xa, Math.min(yE, yT), Math.max(1, xb - xa), Math.abs(yT - yE));
            g.fillStyle = 'rgba(239,68,68,.10)';
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
            g.strokeStyle = 'rgba(212,175,55,.65)';
            g.lineWidth = 1;
            g.setLineDash([3, 3]);
            g.beginPath(); g.moveTo(xDet, 0); g.lineTo(xDet, h); g.stroke();
            g.setLineDash([]);
            /* مثلثات تحت الإغلاقات الثلاثة */
            for (var k = Math.max(0, iDet - 2); k <= iDet; k++) {
              var xk = ts.timeToCoordinate(rows[k].time);
              var yl = priceY(rows[k].low);
              if (xk == null || yl == null) continue;
              g.fillStyle = '#d4af37';
              g.beginPath();
              g.moveTo(xk, yl + 4);
              g.lineTo(xk - 5, yl + 13);
              g.lineTo(xk + 5, yl + 13);
              g.closePath(); g.fill();
            }
          }
        }
      }
    }

    /* ⛔ السعر → إحداثي عمودي: بنجيب السلسلة من الشارت */
    function priceY(price) {
      if (price == null || !isFinite(price)) return null;
      try {
        var s = chartSeries();
        if (!s) return null;
        var y = s.priceToCoordinate(price);
        return (y == null || !isFinite(y)) ? null : y;
      } catch (e) { return null; }
    }
    function chartSeries() {
      try { return chart.__octaSeries || null; } catch (e) { return null; }
    }

    draw();
    try {
      ts.subscribeVisibleLogicalRangeChange(function () { draw(); });
    } catch (e) { }
    try {
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', function () { draw(); });
      }
    } catch (e) { }
    return chart;
  }

  window.OCTAChartKit = {
    load: load,
    mount: mount,
    mountPattern: mountPattern,
    rowsFromHistory: rowsFromHistory,
    tvWidgetUrl: tvWidgetUrl,
    tvOpenUrl: tvOpenUrl
  };
})();
