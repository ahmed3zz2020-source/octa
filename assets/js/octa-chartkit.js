/* ══════════════════════════════════════════════════════════════
   📈 OCTA ChartKit — تحميل lightweight-charts + رسم الشموع
   ──────────────────────────────────────────────────────────────
   📌 مشترك بين «نماذجي» و«الاستوديو» — نسخة واحدة من الكود.
   ⛔ مافيش تخمين: لو مكتبة الرسم مش متاحة ⇒ بنبلغ بوضوح
      (ومفيش crash).
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
      chart.timeScale().fitContent();
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

  window.OCTAChartKit = { load: load, mount: mount };
})();
