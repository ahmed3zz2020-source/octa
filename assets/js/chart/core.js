/* ══════════════════════════════════════════════════════════════
   🕯️ OCTA — محرك الرسم (Phase 1 · T3)
   ──────────────────────────────────────────────────────────────
   🎯 lightweight-charts v5.2.1 (محلي، مافيش CDN)
      v5: chart.addSeries(LightweightCharts.CandlestickSeries, {...})
      مافيش addCandlestickSeries (دي v4).
   ──────────────────────────────────────────────────────────────
   📌 العقد (§4.3):
      OCTAChart.core.create(container, opts) -> instance
      instance.setCandles(candles, tf)
      instance.setType('candles'|'bars'|'line'|'area'|'baseline'|'heikin')
      instance.addIndicator(id, params)
      instance.removeIndicator(id)
      instance.getState()   -> {symbol, tf, type, indicators, drawings}
      instance.applyState(state)
      instance.on(evt, cb)  // 'crosshair'|'timeframe'|'type'|'error'
      instance.exportPNG()   // Promise<Blob>
      instance.destroy()
   ──────────────────────────────────────────────────────────────
   ⛔ مافيش رقم مخترع: كل الأسعار بتجي من setCandles (من الـAPI).
   ⛔ الوضع الأبيض فقط — مافيش dark theme.
   ⛔ المؤشرات بتستخدم دوال indicators.js (مش بنكرّر منطقها).
   ══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';

  var api = factory(root);

  /* 🌐 المتصفح: window.OCTAChart.core */
  root.OCTAChart = root.OCTAChart || {};
  root.OCTAChart.core = api;

  /* 🧪 Node: للاختبارات */
  if (typeof module === 'object' && module.exports) { module.exports = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     🎨 الثيم — أبيض فقط (نفس ألوان TradingView)
     ═══════════════════════════════════════════════════════════ */
  var THEME = {
    background: '#ffffff',
    text: '#131722',
    grid: '#e0e3eb',
    up: '#26a69a',
    down: '#ef5350',
    border: '#d1d4dc',
    crosshair: '#9598a1'
  };

  /* ألوان المؤشرات (خطوط التمييز) */
  var IND_COLORS = ['#2962ff', '#f57c00', '#9c27b0', '#00897b', '#c2185b', '#5d4037', '#455a64'];
  var BB_COLORS = { mid: '#2962ff', upper: '#ef5350', lower: '#26a69a' };

  /* ═══════════════════════════════════════════════════════════
     🗺 أنواع الرسم
     ═══════════════════════════════════════════════════════════ */
  var TYPES = {
    candles: 'CandlestickSeries',
    bars: 'BarSeries',
    line: 'LineSeries',
    area: 'AreaSeries',
    baseline: 'BaselineSeries',
    heikin: 'CandlestickSeries'
  };

  var TYPE_LABELS = {
    candles: 'شموع',
    bars: 'أعمدة',
    line: 'خط',
    area: 'مساحة',
    baseline: 'خط أساسي',
    heikin: 'شموع كاكي'
  };

  /* ═══════════════════════════════════════════════════════════
     📊 تعريفات المؤشرات — بتتربط بدوال indicators.js
     kind: 'overlay' (على نفس المحور) | 'pane' (لوحة سفلية)
     ═══════════════════════════════════════════════════════════ */
  var INDICATORS = {
    sma: { label: 'متوسط متحرك بسيط', kind: 'overlay', kind2: 'line', period: 20 },
    ema: { label: 'متوسط متحرك أسّي', kind: 'overlay', kind2: 'line', period: 21 },
    wma: { label: 'متوسط متحرك مرجّح', kind: 'overlay', kind2: 'line', period: 20 },
    hma: { label: 'متوسط هولدر', kind: 'overlay', kind2: 'line', period: 20 },
    dema: { label: 'متوسط مزدوج', kind: 'overlay', kind2: 'line', period: 20 },
    tema: { label: 'متوسط ثلاثي', kind: 'overlay', kind2: 'line', period: 20 },
    vwma: { label: 'متوسط مرجّح بالحجم', kind: 'overlay', kind2: 'line', period: 20 },
    bollinger: { label: 'نطاقات بولنجر', kind: 'overlay', kind2: 'bb', period: 20, stdDev: 2 },
    rsi: { label: 'مؤشر القوة النسبية', kind: 'pane', kind2: 'line', period: 14 },
    macd: { label: 'الماكد', kind: 'pane', kind2: 'macd', fast: 12, slow: 26, signal: 9 },
    atr: { label: 'المدى الحقيقي المتوسط', kind: 'pane', kind2: 'line', period: 14 },
    stochastic: { label: 'ستوكاستيك', kind: 'pane', kind2: 'stoch', period: 14 },
    cci: { label: 'مؤشر CCI', kind: 'pane', kind2: 'line', period: 20 },
    williamsR: { label: 'ويليامز %R', kind: 'pane', kind2: 'line', period: 14 },
    adx: { label: 'ADX / DMI', kind: 'pane', kind2: 'adx', period: 14 },
    obv: { label: 'OBV', kind: 'pane', kind2: 'line', period: 0 },
    sar: { label: 'البارابوليك (SAR)', kind: 'overlay', kind2: 'line', period: 0 },
    ichimoku: { label: 'إيشيموكو', kind: 'overlay', kind2: 'ichimoku', period: 0 }
  };

  /* ═══════════════════════════════════════════════════════════
     🔧 أدوات مساعدة
     ═══════════════════════════════════════════════════════════ */
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* 'YYYY-MM-DD' → 'YYYY/MM/DD' (شكل محور الوقت المطلوب) */
  function fmtDay(t) {
    if (typeof t !== 'string') return '';
    var p = t.split('-');
    if (p.length !== 3) return t;
    return p[0] + '/' + p[1] + '/' + p[2];
  }

  /* رقم بفواصل الآلاف */
  function fmtNum(x, d) {
    if (!isNum(x)) return '—';
    if (d == null) d = 2;
    var neg = x < 0;
    var s = Math.abs(x).toFixed(d);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + parts.join('.');
  }

  /* نسبة التغير % من الفتح للإغلاق — null لو مافيش فتح صالح */
  function changePct(o, c) {
    if (!isNum(o) || !isNum(c) || o === 0) return null;
    return ((c - o) / Math.abs(o)) * 100;
  }

  /* الوقت بتاع الـcrosshair → مفتاح 'YYYY-MM-DD' */
  function timeKey(t) {
    if (t == null) return '';
    if (typeof t === 'string') return t.slice(0, 10);
    if (typeof t === 'number') {
      var d = new Date(t * 1000);
      return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
    }
    if (typeof t === 'object' && t.year) {
      return t.year + '-' + pad2(t.month) + '-' + pad2(t.day);
    }
    return '';
  }

  /* ═══════════════════════════════════════════════════════════
     🕯️ شموع كاكي (Heikin Ashi)
     ───────────────────────────────────────────────────────────
     o = (prevO + prevC) / 2
     c = (o + h + l + c) / 4
     h = max(h, o, c)
     l = min(l, o, c)
     الشمعة الأولى: o = h = l = c = (o+h+l+c)/4
     ═══════════════════════════════════════════════════════════ */
  function toHeikin(candles) {
    var out = [];
    if (!Array.isArray(candles)) return out;

    for (var i = 0; i < candles.length; i++) {
      var c = candles[i];
      if (!c) { out.push(c); continue; }

      var ok = isNum(c.o) && isNum(c.h) && isNum(c.l) && isNum(c.c);
      if (!ok) { out.push({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v }); continue; }

      if (i === 0) {
        var avg = (c.o + c.h + c.l + c.c) / 4;
        out.push({ t: c.t, o: avg, h: avg, l: avg, c: avg, v: c.v });
        continue;
      }

      var p = out[i - 1];
      var o2 = (p.o + p.c) / 2;
      var c2 = (c.o + c.h + c.l + c.c) / 4;
      var h2 = Math.max(c.h, o2, c2);
      var l2 = Math.min(c.l, o2, c2);
      out.push({ t: c.t, o: o2, h: h2, l: l2, c: c2, v: c.v });
    }
    return out;
  }

  /* ═══════════════════════════════════════════════════════════
     🏭 إنشاء الـinstance
     ═══════════════════════════════════════════════════════════ */
  function create(container, opts) {
    opts = opts || {};

    if (!container) throw new Error('الحاوية مطلوبة');
    if (typeof container.appendChild !== 'function') throw new Error('الحاوية مش DOM');

    var LWC = (typeof globalThis !== 'undefined' && globalThis.LightweightCharts) || null;
    if (!LWC) throw new Error('مكتبة lightweight-charts مش محمّلة');

    /* حصة الـindicators.js (اختيارية — لو مش موجودة نوقف) */
    var IND = (root.OCTAChart && root.OCTAChart.ind) || null;
    var DATA = (root.OCTAChart && root.OCTAChart.data) || null;

    /* الجهة: شمال افتراضياً (mirror للـRTL) */
    var side = (opts.priceScaleSide === 'right') ? 'right' : 'left';
    var otherSide = (side === 'left') ? 'right' : 'left';

    var state = {
      symbol: opts.symbol || '',
      tf: opts.tf || '1D',
      type: (TYPES[opts.type] ? opts.type : 'candles'),
      indicators: [],
      drawings: []
    };

    var rawCandles = [];        /* الشموع الفعلية (بعد التجميع) */
    var shownCandles = [];      /* اللي بيتعرض (كاكي أو خام) */
    var byTime = {};            /* 'YYYY-MM-DD' → الشمعة */
    var seriesMap = {};         /* id → record */
    var indOrder = [];          /* ترتيب المؤشرات */
    var priceLines = [];
    var timeLines = [];
    var listeners = {};
    var mainSeries = null;
    var chart = null;
    var destroyed = false;
    var activeDrag = null;
    var indSeq = 0;

    /* ─────────────────────────────────────────────────────────
       🖼️ الـchart
       ───────────────────────────────────────────────────────── */
    chart = LWC.createChart(container, {
      autoSize: true,
      layout: {
        background: { type: 'solid', color: THEME.background },
        textColor: THEME.text,
        fontFamily: "'Segoe UI', Tahoma, 'Noto Naskh Arabic', Arial, sans-serif",
        fontSize: 12,
        attributionLogo: false,
        panes: {
          separatorColor: THEME.grid,
          separatorHoverColor: '#c8ccd8',
          enableResize: true
        }
      },
      grid: {
        vertLines: { color: THEME.grid, style: 0 },
        horzLines: { color: THEME.grid, style: 0 }
      },
      crosshair: {
        mode: (LWC.CrosshairMode && LWC.CrosshairMode.Normal != null) ? LWC.CrosshairMode.Normal : 0,
        vertLine: {
          color: THEME.crosshair,
          width: 1,
          style: (LWC.LineStyle && LWC.LineStyle.Dashed != null) ? LWC.LineStyle.Dashed : 2,
          labelBackgroundColor: THEME.text
        },
        horzLine: {
          color: THEME.crosshair,
          width: 1,
          style: (LWC.LineStyle && LWC.LineStyle.Dashed != null) ? LWC.LineStyle.Dashed : 2,
          labelBackgroundColor: THEME.text
        }
      },
      leftPriceScale: {
        visible: side === 'left',
        borderColor: THEME.grid,
        scaleMargins: { top: 0.12, bottom: 0.12 }
      },
      rightPriceScale: {
        visible: side === 'right',
        borderColor: THEME.grid,
        scaleMargins: { top: 0.12, bottom: 0.12 }
      },
      timeScale: {
        borderColor: THEME.grid,
        rightOffset: 4,
        barSpacing: 8,
        minBarSpacing: 0.4,
        fixLeftEdge: false,
        lockVisibleTimeRangeOnResize: true,
        timeVisible: false,
        secondsVisible: false
      },
      localization: {
        locale: 'ar',
        dateFormat: 'yyyy/MM/dd',
        priceFormatter: function (p) { return fmtNum(p, 2); }
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true }
      }
    });

    /* ─────────────────────────────────────────────────────────
       🧱 طبقة الـHTML (tooltip + خطوط الوقت)
       ───────────────────────────────────────────────────────── */
    var overlay = document.createElement('div');
    overlay.className = 'octa-chart-overlay';
    overlay.setAttribute('dir', 'rtl');
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.overflow = 'hidden';
    container.appendChild(overlay);

    var tip = document.createElement('div');
    tip.className = 'octa-chart-tip';
    tip.setAttribute('dir', 'rtl');
    tip.style.position = 'absolute';
    tip.style.display = 'none';
    tip.style.pointerEvents = 'none';
    tip.style.zIndex = '6';
    overlay.appendChild(tip);

    /* ─────────────────────────────────────────────────────────
       🔔 الأحداث
       ───────────────────────────────────────────────────────── */
    function emit(evt, payload) {
      var list = listeners[evt];
      if (!list || !list.length) return;
      for (var i = 0; i < list.length; i++) {
        try { list[i](payload); } catch (e) { /* مافيش خطأ يكسر الشارت */ }
      }
    }

    function on(evt, cb) {
      if (typeof cb !== 'function') return function () { };
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(cb);
      return function () { removeIndicatorListener(evt, cb); };
    }

    function removeIndicatorListener(evt, cb) {
      var list = listeners[evt];
      if (!list) return;
      var i = list.indexOf(cb);
      if (i !== -1) list.splice(i, 1);
    }

    /* ─────────────────────────────────────────────────────────
       📦 بناء بيانات السلسلة
       ───────────────────────────────────────────────────────── */
    function toSeriesData(list, type) {
      var out = [];
      /* ⚠️ الشكل لازم يطابق نوع السلسلة بالظبط:
         - شموع/أعمدة/كاكي → {time, open, high, low, close}
         - خط/مساحة/خط أساسي → {time, value}
         لو راحلنا بيانات الشمع لسلسلة خط، الـv5 بيرفضها (Assertion)
         والشارت بيطلع فاضي. */
      var isLine = (type === 'line' || type === 'area' || type === 'baseline');
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (!c) continue;
        if (!isNum(c.o) || !isNum(c.h) || !isNum(c.l) || !isNum(c.c)) continue;
        if (typeof c.t !== 'string' || c.t.length < 10) continue;
        var t = c.t.slice(0, 10);
        if (isLine) {
          out.push({ time: t, value: c.c });
        } else {
          out.push({
            time: t,
            open: c.o,
            high: c.h,
            low: c.l,
            close: c.c,
            volume: isNum(c.v) ? c.v : 0
          });
        }
      }
      return out;
    }

    /* أول سعر إغلاق متاح (من أي شكل بيانات) */
    function firstCloseOf(data) {
      if (!data || !data.length) return null;
      var d = data[0];
      if (isNum(d.close)) return d.close;
      if (isNum(d.value)) return d.value;
      return null;
    }

    /* خريطة الوقت → الشمعة */
    function indexByTime(list) {
      byTime = {};
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c && typeof c.t === 'string') byTime[c.t.slice(0, 10)] = c;
      }
    }

    /* ─────────────────────────────────────────────────────────
       🎨 خيارات السلسلة حسب النوع
       ───────────────────────────────────────────────────────── */
    function seriesOptions(type) {
      var common = {
        priceScaleId: side,
        priceLineVisible: true,
        lastValueVisible: true,
        title: ''
      };

      if (type === 'candles' || type === 'heikin') {
        return Object.assign({}, common, {
          upColor: THEME.up,
          downColor: THEME.down,
          borderUpColor: THEME.up,
          borderDownColor: THEME.down,
          wickUpColor: THEME.up,
          wickDownColor: THEME.down
        });
      }
      if (type === 'bars') {
        return Object.assign({}, common, {
          upColor: THEME.up,
          downColor: THEME.down,
          openVisible: true,
          thinBars: false
        });
      }
      if (type === 'line') {
        return Object.assign({}, common, {
          color: THEME.text,
          lineWidth: 2
        });
      }
      if (type === 'area') {
        return Object.assign({}, common, {
          lineColor: THEME.text,
          topColor: 'rgba(19,23,34,0.18)',
          bottomColor: 'rgba(19,23,34,0.02)',
          lineWidth: 2
        });
      }
      if (type === 'baseline') {
        return Object.assign({}, common, {
          baseValue: { type: 'price', price: 0 },
          topLineColor: THEME.up,
          bottomLineColor: THEME.down,
          topFillColor1: 'rgba(38,166,154,0.28)',
          topFillColor2: 'rgba(38,166,154,0.02)',
          bottomFillColor1: 'rgba(239,83,80,0.28)',
          bottomFillColor2: 'rgba(239,83,80,0.02)',
          lineWidth: 2
        });
      }
      return common;
    }

    function makeSeries(type) {
      var defName = TYPES[type] || TYPES.candles;
      var def = LWC[defName];
      if (!def) def = LWC.CandlestickSeries;
      var opts = seriesOptions(type);
      return chart.addSeries(def, opts);
    }

    /* ═══════════════════════════════════════════════════════════
       🔁 setCandles
       ═══════════════════════════════════════════════════════════ */
    function setCandles(candles, tf) {
      if (destroyed) return null;

      var list = Array.isArray(candles) ? candles : [];

      /* التجميع — لو data.js موجود بنستخدم resample بتاعه (مش بنكرّر المنطق) */
      if (DATA && typeof DATA.resample === 'function' && tf) {
        try { list = DATA.resample(list, tf); } catch (e) { /* fallback: القائمة زي ما هي */ }
      }

      rawCandles = list;
      var tfChanged = (tf && tf !== state.tf);
      state.tf = tf || state.tf;
      rebuildShown();
      indexByTime(shownCandles);

      if (!mainSeries) {
        mainSeries = makeSeries(state.type);
      }
      var data = toSeriesData(shownCandles, state.type);
      try { mainSeries.setData(data); } catch (e) { emit('error', { message: 'تعذّر رسم الشموع', detail: e && e.message }); }

      /* خط الأساس (baseline) = أول سعر إغلاق حقيقي */
      if (state.type === 'baseline') {
        var first = firstCloseOf(data);
        if (first != null) {
          try { mainSeries.applyOptions({ baseValue: { type: 'price', price: first } }); } catch (e) { }
        }
      }

      refreshIndicators();
      try { chart.timeScale().fitContent(); } catch (e) { }
      if (tfChanged) emit('timeframe', state.tf);
      emit('candles', rawCandles);
      return list;
    }

    /* الشموع المعروضة (كاكي أو خام) */
    function rebuildShown() {
      shownCandles = (state.type === 'heikin') ? toHeikin(rawCandles) : rawCandles.slice();
    }

    /* ═══════════════════════════════════════════════════════════
       🔁 setType
       ═══════════════════════════════════════════════════════════ */
    function setType(type) {
      if (destroyed) return null;
      if (!TYPES[type]) {
        emit('error', { message: 'نوع رسم غير معروف: ' + type });
        return null;
      }
      if (state.type === type && mainSeries) return state.type;

      state.type = type;
      rebuildShown();

      var old = mainSeries;
      /* نضيف الجديد الأول عشان اللوحة ما تفضيش فاضية */
      mainSeries = makeSeries(type);
      var data = toSeriesData(shownCandles, state.type);
      try { mainSeries.setData(data); } catch (e) { }

      if (state.type === 'baseline' && data.length) {
        var _bv = firstCloseOf(data);
        if (_bv != null) {
          try { mainSeries.applyOptions({ baseValue: { type: 'price', price: _bv } }); } catch (e) { }
        }
      }

      if (old) {
        try { chart.removeSeries(old); } catch (e) { }
      }

      /* خطوط السعر مرتبطة بالسلسلة القديمة → نحدّثها */
      for (var i = 0; i < priceLines.length; i++) { priceLines[i].series = mainSeries; }

      refreshIndicators();
      emit('type', type);
      return type;
    }

    /* ═══════════════════════════════════════════════════════════
       📈 المؤشرات
       ───────────────────────────────────────────────────────────
       addIndicator(id, params) — params: {period} أو {period,stdDev}
       أو {fast,slow,signal}
       ═══════════════════════════════════════════════════════════ */
    function addIndicator(id, params) {
      if (destroyed) return null;
      var def = INDICATORS[id];
      if (!def) {
        emit('error', { message: 'مؤشر غير معروف: ' + id });
        return null;
      }
      if (!IND) {
        emit('error', { message: 'مكتبة المؤشرات غير محمّلة' });
        return null;
      }
      if (seriesMap[id]) { removeIndicator(id); }

      var p = Object.assign({}, def, params || {});
      if (!isNum(p.period) || p.period < 1) p.period = def.period;
      p.period = Math.floor(p.period);
      if (p.kind === 'pane') {
        if (!isNum(p.fast)) p.fast = def.fast;
        if (!isNum(p.slow)) p.slow = def.slow;
        if (!isNum(p.signal)) p.signal = def.signal;
      }
      if (!isNum(p.stdDev)) p.stdDev = def.stdDev || 2;

      var color = IND_COLORS[indSeq % IND_COLORS.length];
      indSeq++;

      var rec = { id: id, params: p, color: color, series: [], paneIndex: 0, kind: def.kind };

      if (def.kind === 'pane') {
        try {
          var pane = chart.addPane();
          rec.paneIndex = (typeof pane.paneIndex === 'function') ? pane.paneIndex() : 1;
          try { pane.setHeight(Math.round(chart.height() * 0.25)); } catch (e) { }
        } catch (e) {
          rec.paneIndex = 0;
        }
      }

      if (def.kind2 === 'bb') {
        rec.series.push(addLineSeries(rec, BB_COLORS.mid, 2, def.label));
        rec.series.push(addLineSeries(rec, BB_COLORS.upper, 1, def.label + ' أعلى'));
        rec.series.push(addLineSeries(rec, BB_COLORS.lower, 1, def.label + ' أدنى'));
      } else if (def.kind2 === 'macd') {
        rec.series.push(addHistSeries(rec, THEME.text, 'الماكد (الهيستوجرام)'));
        rec.series.push(addLineSeries(rec, IND_COLORS[0], 2, def.label));
        rec.series.push(addLineSeries(rec, IND_COLORS[1], 2, def.label + ' إشارة'));
      } else if (def.kind2 === 'stoch') {
        rec.series.push(addLineSeries(rec, IND_COLORS[0], 2, def.label + ' %K'));
        rec.series.push(addLineSeries(rec, IND_COLORS[1], 2, def.label + ' %D'));
      } else if (def.kind2 === 'adx') {
        rec.series.push(addLineSeries(rec, IND_COLORS[0], 2, def.label));
        rec.series.push(addLineSeries(rec, IND_COLORS[2], 2, '+DI'));
        rec.series.push(addLineSeries(rec, IND_COLORS[3], 2, '-DI'));
      } else if (def.kind2 === 'ichimoku') {
        rec.series.push(addLineSeries(rec, IND_COLORS[0], 2, 'تنكان'));
        rec.series.push(addLineSeries(rec, IND_COLORS[1], 2, 'كيجون'));
        rec.series.push(addLineSeries(rec, IND_COLORS[2], 1, 'سينكو A'));
        rec.series.push(addLineSeries(rec, IND_COLORS[3], 1, 'سينكو B'));
        rec.series.push(addLineSeries(rec, IND_COLORS[4], 1, 'تشيكو'));
      } else {
        rec.series.push(addLineSeries(rec, color, 2, def.label));
      }

      seriesMap[id] = rec;
      indOrder.push(id);
      state.indicators = readIndicatorState();
      applyIndicatorData(rec);
      return rec;
    }

    function addLineSeries(rec, color, width, title) {
      var def = LWC.LineSeries;
      if (!def) return null;
      var opts = {
        color: color,
        lineWidth: width || 2,
        priceScaleId: side,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        /* المؤشرات اللي فوق السعر ما بتاخدش عنوان على محور السعر */
        title: (rec.kind === 'overlay') ? '' : (title || '')
      };
      if (rec.kind === 'overlay') {
        /* المؤشر فوق السعر ما يمدّدش محور السعر */
        opts.autoscaleInfoProvider = function () { return null; };
      }
      var s = null;
      try {
        s = (rec.paneIndex > 0) ? chart.addSeries(def, opts, rec.paneIndex) : chart.addSeries(def, opts);
      } catch (e) {
        try { s = chart.addSeries(def, opts); } catch (e2) { emit('error', { message: 'تعذّر إضافة المؤشر' }); }
      }
      return s;
    }

    function addHistSeries(rec, color, title) {
      var def = LWC.HistogramSeries;
      if (!def) return null;
      var opts = {
        color: color,
        priceScaleId: side,
        priceLineVisible: false,
        lastValueVisible: false,
        title: title || ''
      };
      if (rec.kind === 'overlay') {
        opts.autoscaleInfoProvider = function () { return null; };
      }
      var s = null;
      try {
        s = (rec.paneIndex > 0) ? chart.addSeries(def, opts, rec.paneIndex) : chart.addSeries(def, opts);
      } catch (e) {
        try { s = chart.addSeries(def, opts); } catch (e2) { }
      }
      return s;
    }

    function removeIndicator(id) {
      var rec = seriesMap[id];
      if (!rec) return false;
      for (var i = 0; i < rec.series.length; i++) {
        var s = rec.series[i];
        if (!s) continue;
        try { chart.removeSeries(s); } catch (e) { }
      }
      rec.series = [];
      delete seriesMap[id];
      var k = indOrder.indexOf(id);
      if (k !== -1) indOrder.splice(k, 1);
      state.indicators = readIndicatorState();
      return true;
    }

    function readIndicatorState() {
      var out = [];
      for (var i = 0; i < indOrder.length; i++) {
        var rec = seriesMap[indOrder[i]];
        if (!rec) continue;
        var p = { period: rec.params.period };
        if (rec.params.stdDev != null) p.stdDev = rec.params.stdDev;
        if (rec.params.fast != null) p.fast = rec.params.fast;
        if (rec.params.slow != null) p.slow = rec.params.slow;
        if (rec.params.signal != null) p.signal = rec.params.signal;
        out.push({ id: rec.id, params: p });
      }
      return out;
    }

    /* حساب بيانات المؤشرات من الشموع الخام */
    function applyIndicatorData(rec) {
      if (!rec || !IND) return;
      var cs = rawCandles;
      var n = cs.length;
      var closes = [], highs = [], lows = [], vols = [], times = [];
      for (var i = 0; i < n; i++) {
        var c = cs[i] || {};
        closes.push(isNum(c.c) ? c.c : null);
        highs.push(isNum(c.h) ? c.h : null);
        lows.push(isNum(c.l) ? c.l : null);
        vols.push(isNum(c.v) ? c.v : 0);
        times.push(typeof c.t === 'string' ? c.t.slice(0, 10) : null);
      }

      var id = rec.id;
      var p = rec.params;
      var series = [];
      var values = [];

      if (id === 'bollinger') {
        var bb = IND.bollinger(closes, p.period, p.stdDev);
        series = [bb.mid, bb.upper, bb.lower];
      } else if (id === 'rsi') {
        series = [IND.rsi(closes, p.period)];
      } else if (id === 'macd') {
        var mm = IND.macd(closes, p.fast, p.slow, p.signal);
        series = [mm.hist, mm.macd, mm.signal];
      } else if (id === 'atr') {        series = [IND.atr(closes, highs, lows, p.period)];
      } else if (id === 'vwma') {
        series = [IND.vwma(cs, p.period)];
      } else if (id === 'stochastic') {
        var st = IND.stochastic(closes, highs, lows, p.period);
        series = [st.k, st.d];
      } else if (id === 'cci') {
        series = [IND.cci(closes, highs, lows, p.period)];
      } else if (id === 'williamsR') {
        series = [IND.williamsR(closes, highs, lows, p.period)];
      } else if (id === 'adx') {
        var ax = IND.adx(closes, highs, lows, p.period);
        series = [ax.adx, ax.plusDI, ax.minusDI];
      } else if (id === 'obv') {
        series = [IND.obv(closes, vols)];
      } else if (id === 'sar') {
        series = [IND.sar(closes, highs, lows)];
      } else if (id === 'ichimoku') {
        var ic = IND.ichimoku(closes, highs, lows);
        series = [ic.tenkan, ic.kijun, ic.senkouA, ic.senkouB, ic.chikou];
      } else if (IND[id]) {
        series = [IND[id](closes, p.period)];
      } else {
        return;
      }

      for (var si = 0; si < rec.series.length && si < series.length; si++) {
        var s = rec.series[si];
        if (!s) continue;
        var arr = series[si] || [];
        var data = [];
        var isHist = (id === 'macd' && si === 0);
        for (var k = 0; k < n; k++) {
          var v = arr[k];
          if (v == null || !isNum(v)) continue;
          if (!times[k]) continue;
          var point = { time: times[k], value: v };
          /* الهيستوجرام: أخضر فوق الصفر · أحمر تحت الصفر */
          if (isHist) point.color = (v >= 0) ? THEME.up : THEME.down;
          data.push(point);
        }
        try { s.setData(data); } catch (e) { }
      }
    }

    function refreshIndicators() {
      for (var i = 0; i < indOrder.length; i++) {
        applyIndicatorData(seriesMap[indOrder[i]]);
      }
    }

    /* ═══════════════════════════════════════════════════════════
       💾 getState / applyState
       ═══════════════════════════════════════════════════════════ */
    function currentDrawings() {
      /* الرسومات Living في draw.js — نقرأها منه مباشرة عشان الحفظ يطلع صحيح */
      try {
        var D = root.OCTAChart && root.OCTAChart.draw;
        if (D && typeof D.getDrawings === 'function') {
          var d = D.getDrawings();
          if (Array.isArray(d)) return d;
        }
      } catch (e) { }
      return state.drawings.slice();
    }

    function getState() {
      return {
        symbol: state.symbol,
        tf: state.tf,
        type: state.type,
        indicators: readIndicatorState(),
        drawings: currentDrawings(),
        priceLines: priceLines.map(function (p) { return { price: p.price, color: p.color, title: p.title }; }),
        timeLines: timeLines.map(function (t) { return { time: t.time, color: t.color, title: t.title }; })
      };
    }

    function applyState(st) {
      if (!st || typeof st !== 'object') return null;

      if (st.symbol) state.symbol = String(st.symbol);
      if (st.tf) state.tf = String(st.tf);
      if (st.type && TYPES[st.type]) setType(st.type);

      var ids = indOrder.slice();
      for (var i = 0; i < ids.length; i++) removeIndicator(ids[i]);

      if (Array.isArray(st.indicators)) {
        for (var j = 0; j < st.indicators.length; j++) {
          var it = st.indicators[j];
          if (!it || !it.id) continue;
          addIndicator(it.id, it.params || {});
        }
      }

      if (Array.isArray(st.drawings)) {
        state.drawings = st.drawings.slice();
        var draw = root.OCTAChart && root.OCTAChart.draw;
        if (draw && typeof draw.setDrawings === 'function') {
          try { draw.setDrawings(state.drawings); } catch (e) { }
        }
      }

      return getState();
    }

    /* ═══════════════════════════════════════════════════════════
       ✏️ crosshair + tooltip
       ═══════════════════════════════════════════════════════════ */
    function hideTip() {
      tip.style.display = 'none';
    }

    function tipRow(label, value, cls) {
      var row = document.createElement('div');
      row.className = 'octa-chart-tip-row' + (cls ? ' ' + cls : '');
      var s = document.createElement('span');
      s.className = 'octa-chart-tip-label';
      s.textContent = label;
      var v = document.createElement('b');
      v.className = 'octa-chart-tip-value';
      v.textContent = value;
      row.appendChild(s);
      row.appendChild(v);
      return row;
    }

    function buildTip(candle) {
      tip.textContent = '';
      var head = document.createElement('div');
      head.className = 'octa-chart-tip-head';
      head.textContent = fmtDay(candle.t);
      tip.appendChild(head);

      tip.appendChild(tipRow('افتتاح', fmtNum(candle.o, 2)));
      tip.appendChild(tipRow('أعلى', fmtNum(candle.h, 2)));
      tip.appendChild(tipRow('أدنى', fmtNum(candle.l, 2)));
      tip.appendChild(tipRow('إغلاق', fmtNum(candle.c, 2)));

      var ch = changePct(candle.o, candle.c);
      if (ch == null) {
        tip.appendChild(tipRow('التغير', '—'));
      } else {
        var sign = ch > 0 ? '+' : '';
        tip.appendChild(tipRow('التغير', sign + fmtNum(ch, 2) + '%', (ch >= 0 ? 'is-up' : 'is-down')));
      }

      tip.appendChild(tipRow('الحجم', fmtNum(candle.v, 0)));
    }

    function placeTip(point) {
      var w = container.clientWidth;
      var h = container.clientHeight;
      var tw = tip.offsetWidth || 170;
      var th = tip.offsetHeight || 160;
      var left = point.x + 16;
      var top = point.y + 16;
      if (left + tw > w - 8) left = point.x - tw - 16;
      if (left < 8) left = 8;
      if (top + th > h - 8) top = point.y - th - 16;
      if (top < 8) top = 8;
      tip.style.left = Math.round(left) + 'px';
      tip.style.top = Math.round(top) + 'px';
    }

    function onCrosshairMove(param) {
      if (!param || !param.point) {
        hideTip();
        emit('crosshair', null);
        return;
      }
      var key = timeKey(param.time);
      var candle = byTime[key];
      if (!candle) {
        hideTip();
        emit('crosshair', { time: key, candle: null, point: param.point });
        return;
      }
      buildTip(candle);
      tip.style.display = 'block';
      placeTip(param.point);
      emit('crosshair', { time: key, candle: candle, point: param.point });
    }

    try { chart.subscribeCrosshairMove(onCrosshairMove); } catch (e) { }

    /* ═══════════════════════════════════════════════════════════
       📏 خطوط السعر وخطوط الوقت (قابلة للسحب + بتتحدّث)
       ═══════════════════════════════════════════════════════════ */
    function addPriceLine(o) {
      o = o || {};
      if (!mainSeries) return null;
      if (!isNum(o.price)) return null;
      var line = null;
      try {
        line = mainSeries.createPriceLine({
          price: o.price,
          color: o.color || THEME.text,
          lineWidth: o.width || 1,
          lineStyle: (o.dashed && LWC.LineStyle) ? LWC.LineStyle.Dashed : (LWC.LineStyle ? LWC.LineStyle.Solid : 0),
          axisLabelVisible: o.axisLabelVisible !== false,
          title: o.title || ''
        });
      } catch (e) {
        emit('error', { message: 'تعذّر إضافة خط السعر' });
        return null;
      }
      var rec = { line: line, price: o.price, color: o.color || THEME.text, title: o.title || '', series: mainSeries };
      priceLines.push(rec);
      return {
        update: function (p) {
          if (!isNum(p)) return false;
          rec.price = p;
          try { rec.line.applyOptions({ price: p }); } catch (e) { }
          return true;
        },
        remove: function () {
          try { rec.line.applyOptions({ color: 'rgba(0,0,0,0)' }); } catch (e) { }
          try { rec.series.removePriceLine(rec.line); } catch (e) { }
          var i = priceLines.indexOf(rec);
          if (i !== -1) priceLines.splice(i, 1);
        },
        get: function () { return { price: rec.price, color: rec.color, title: rec.title }; }
      };
    }

    function addTimeLine(o) {
      o = o || {};
      if (!o.time) return null;
      var el = document.createElement('div');
      el.className = 'octa-chart-time-line';
      el.style.position = 'absolute';
      el.style.top = '0';
      el.style.bottom = '0';
      el.style.width = '1px';
      el.style.background = o.color || THEME.crosshair;
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'ew-resize';
      el.style.zIndex = '4';
      el.title = o.title || '';
      overlay.appendChild(el);

      var rec = { el: el, time: o.time, color: o.color || THEME.crosshair, title: o.title || '' };
      timeLines.push(rec);
      positionTimeLines();

      el.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
        e.preventDefault();
        startDrag({ kind: 'time', rec: rec }, e);
      });

      return {
        update: function (t) {
          if (!t) return false;
          rec.time = t;
          positionTimeLines();
          return true;
        },
        remove: function () {
          if (el.parentNode) el.parentNode.removeChild(el);
          var i = timeLines.indexOf(rec);
          if (i !== -1) timeLines.splice(i, 1);
        },
        get: function () { return { time: rec.time, color: rec.color, title: rec.title }; }
      };
    }

    function positionTimeLines() {
      if (!timeLines.length) return;
      var ts = chart.timeScale();
      for (var i = 0; i < timeLines.length; i++) {
        var rec = timeLines[i];
        var x = null;
        try { x = ts.timeToCoordinate(rec.time); } catch (e) { }
        if (x == null || !isNum(x)) {
          rec.el.style.display = 'none';
          continue;
        }
        rec.el.style.display = 'block';
        rec.el.style.left = Math.round(x) + 'px';
      }
    }

    /* ── السحب ── */
    function startDrag(drag, e) {
      activeDrag = drag;
      try { container.setPointerCapture(e.pointerId); } catch (err) { }
      window.addEventListener('pointermove', onDragMove, true);
      window.addEventListener('pointerup', onDragEnd, true);
      window.addEventListener('pointercancel', onDragEnd, true);
    }

    function onDragMove(e) {
      if (!activeDrag) return;
      var rect = container.getBoundingClientRect();
      var y = e.clientY - rect.top;
      var x = e.clientX - rect.left;

      if (activeDrag.kind === 'price') {
        var s = activeDrag.rec.series || mainSeries;
        if (!s || typeof s.coordinateToPrice !== 'function') return;
        var p = null;
        try { p = s.coordinateToPrice(y); } catch (err) { }
        if (!isNum(p)) return;
        activeDrag.rec.price = p;
        try { activeDrag.rec.line.applyOptions({ price: p }); } catch (err) { }
        emit('crosshair', { time: '', candle: null, point: { x: x, y: y }, price: p });
        return;
      }

      if (activeDrag.kind === 'time') {
        var ts = chart.timeScale();
        if (typeof ts.coordinateToTime !== 'function') return;
        var t = null;
        try { t = ts.coordinateToTime(x); } catch (err) { }
        if (t == null) return;
        activeDrag.rec.time = t;
        positionTimeLines();
        emit('crosshair', { time: timeKey(t), candle: byTime[timeKey(t)] || null, point: { x: x, y: y } });
      }
    }

    function onDragEnd() {
      activeDrag = null;
      window.removeEventListener('pointermove', onDragMove, true);
      window.removeEventListener('pointerup', onDragEnd, true);
      window.removeEventListener('pointercancel', onDragEnd, true);
    }

    /* التقاط pointerdown على الحاوية (capture) عشان نمنع سحب الشارت
       لما المستخدم ماسك خط سعر أو خط وقت */
    function onPointerDownCapture(e) {
      if (destroyed) return;
      if (e.button != null && e.button !== 0) return;

      /* خط وقت (الـdiv نفسه بيبلّغ) */
      if (e.target && e.target.classList && e.target.classList.contains('octa-chart-time-line')) return;

      if (!priceLines.length || !mainSeries) return;
      var rect = container.getBoundingClientRect();
      var y = e.clientY - rect.top;
      for (var i = 0; i < priceLines.length; i++) {
        var rec = priceLines[i];
        var s = rec.series || mainSeries;
        if (!s || typeof s.priceToCoordinate !== 'function') continue;
        var py = null;
        try { py = s.priceToCoordinate(rec.price); } catch (err) { }
        if (py == null) continue;
        if (Math.abs(py - y) <= 6) {
          e.stopPropagation();
          e.preventDefault();
          startDrag({ kind: 'price', rec: rec }, e);
          return;
        }
      }
    }
    container.addEventListener('pointerdown', onPointerDownCapture, true);

    /* ═══════════════════════════════════════════════════════════
       🖱️ دبل كليك = رجوع للوضع الافتراضي
       ═══════════════════════════════════════════════════════════ */
    function onDblClick(e) {
      if (e && e.target && e.target.classList && e.target.classList.contains('octa-chart-time-line')) return;
      resetView();
    }

    function resetView() {
      try { chart.timeScale().fitContent(); } catch (e) { }
      try { chart.priceScale(side, 0).applyOptions({ autoScale: true }); } catch (e) { }
      try { if (mainSeries) mainSeries.applyOptions({ priceScaleId: side }); } catch (e) { }
      emit('crosshair', null);
    }

    container.addEventListener('dblclick', onDblClick);

    /* ═══════════════════════════════════════════════════════════
       🖼️ exportPNG
       ═══════════════════════════════════════════════════════════ */
    function dataUrlToBlob(url) {
      try {
        var parts = url.split(',');
        var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/png';
        var bin = atob(parts[1]);
        var len = bin.length;
        var arr = new Uint8Array(len);
        for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: mime });
      } catch (e) { return null; }
    }

    function exportPNG(cb) {
      var promise;
      try {
        var canvas = chart.takeScreenshot();
        if (canvas && typeof canvas.toBlob === 'function') {
          promise = new Promise(function (resolve) {
            canvas.toBlob(function (blob) { resolve(blob); }, 'image/png');
          });
        } else if (canvas && typeof canvas.toDataURL === 'function') {
          promise = Promise.resolve(dataUrlToBlob(canvas.toDataURL('image/png')));
        } else {
          promise = Promise.reject(new Error('المتصفح مش داعم تصدير الصورة'));
        }
      } catch (e) {
        promise = Promise.reject(e);
      }
      if (typeof cb === 'function') promise.then(cb);
      return promise;
    }

    /* ═══════════════════════════════════════════════════════════
       💣 destroy
       ═══════════════════════════════════════════════════════════ */
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      onDragEnd();
      try { container.removeEventListener('pointerdown', onPointerDownCapture, true); } catch (e) { }
      try { container.removeEventListener('dblclick', onDblClick); } catch (e) { }
      for (var i = 0; i < timeLines.length; i++) {
        var el = timeLines[i].el;
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
      timeLines = [];
      priceLines = [];
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      try { chart.remove(); } catch (e) { }
      chart = null;
      mainSeries = null;
      seriesMap = {};
      indOrder = [];
      rawCandles = [];
      shownCandles = [];
      byTime = {};
      listeners = {};
    }

    /* ═══════════════════════════════════════════════════════════
       🔌 ت conversions بين الشاشة والبيانات (.draw.js بيستخدمهم)
       ═══════════════════════════════════════════════════════════ */
    function coordToPoint(x, y) {
      var t = null, p = null;
      try { t = timeKey(chart.timeScale().coordinateToTime(x)); } catch (e) { t = null; }
      try { if (mainSeries) p = mainSeries.coordinateToPrice(y); } catch (e) { p = null; }
      if (t === null && p === null) return null;
      return { t: t, p: isNum(p) ? p : null };
    }

    function pointToCoord(pt) {
      if (!pt) return null;
      var x = null, y = null;
      try { if (pt.t != null) x = chart.timeScale().timeToCoordinate(pt.t); } catch (e) { x = null; }
      try { if (isNum(pt.p) && mainSeries) y = mainSeries.priceToCoordinate(pt.p); } catch (e) { y = null; }
      if (x == null && y == null) return null;
      return { x: x, y: y };
    }

    /* ═══════════════════════════════════════════════════════════
       📤 الواجهة العامة
       ═══════════════════════════════════════════════════════════ */
    var instance = {
      setCandles: setCandles,
      setType: setType,
      addIndicator: addIndicator,
      removeIndicator: removeIndicator,
      getState: getState,
      applyState: applyState,
      on: on,
      exportPNG: exportPNG,
      destroy: destroy,
      /* إضافات عملية */
      addPriceLine: addPriceLine,
      addTimeLine: addTimeLine,
      resetView: resetView,
      getType: function () { return state.type; },
      getTimeframe: function () { return state.tf; },
      getSymbol: function () { return state.symbol; },
      setSymbol: function (s) { state.symbol = String(s || ''); return state.symbol; },
      getChart: function () { return chart; },
      getSeries: function () { return mainSeries; },
      getCandles: function () { return rawCandles.slice(); },
      getIndicators: function () { return readIndicatorState(); },
      getTheme: function () { return Object.assign({}, THEME); },
      getPriceScaleSide: function () { return side; },
      /* روابط تشترك فيها draw.js / storage.js */
      chart: chart,
      container: container,
      opts: Object.assign({}, opts, { priceScaleSide: side }),
      priceScaleSide: side,
      coordToPoint: coordToPoint,
      pointToCoord: pointToCoord
    };

    return instance;
  }

  /* ═══════════════════════════════════════════════════════════
     📦 التصدير
     ═══════════════════════════════════════════════════════════ */
  return {
    create: create,
    toHeikin: toHeikin,
    THEME: THEME,
    TYPES: TYPES,
    TYPE_LABELS: TYPE_LABELS,
    INDICATORS: INDICATORS,
    fmtDay: fmtDay,
    fmtNum: fmtNum,
    changePct: changePct,
    timeKey: timeKey
  };
});
