/* ══════════════════════════════════════════════════════════════
   ✏️ طبقة أدوات الرسم — assets/js/chart/draw.js
   ──────────────────────────────────────────────────────────────
   🎯 الأدوات: cursor · trendline · hline · vline · rect · fib
              measure · brush · text · arrow · flag · priceline
              timeline · magnet
   📌 النقاط بتتخزَّن بالـt (وقت) و/أو الـp (سعر) — مش بالبكسل
      → الرسم يفضل ثابت مع التقريب/التمرير.
   ⛔ مافيش رقم مخترع: كل price بييجي من تحويل الـcore
      (أو من شموع حقيقية) — مافيش قيم افتراضية.
   ⛔ الملف ده مالوش أي علاقة بـcore.js — بيربط عن طريق العقد
      (§4.3/§4.4) عن طريق الـadapter المكتشف أدناه.
   ══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';

  var api = factory();

  /* 🌐 المتصفح: window.OCTAChart.draw */
  root.OCTAChart = root.OCTAChart || {};
  root.OCTAChart.draw = api;

  /* 🧪 Node: للاختبارات — require('.../chart/draw.js') */
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     🧰 قائمة الأدوات
     ───────────────────────────────────────────────────────────
     📌 'magnet' أداة مُعدِّل (toggle) — بتشتغل كوضع
        مستقل: بتقفل snapping لأقرب open/close.
     ═══════════════════════════════════════════════════════════ */
  var TOOLS = [
    'cursor', 'trendline', 'hline', 'vline', 'rect', 'fib',
    'measure', 'brush', 'text', 'arrow', 'flag', 'priceline',
    'timeline', 'magnet'
  ];

  /* أدوات بترسم رسمة فعلاً (اللي بتعمل object في drawings) */
  var DRAWING_TOOLS = [
    'trendline', 'hline', 'vline', 'rect', 'fib', 'measure',
    'brush', 'text', 'arrow', 'flag', 'priceline', 'timeline'
  ];

  var TOOL_LABEL = {
    cursor: 'المؤشر', trendline: 'خط اتجاه', hline: 'خط أفقي',
    vline: 'خط رأسي', rect: 'مستطيل', fib: 'فيبوناتشي',
    measure: 'مسطرة', brush: 'فرشاة', text: 'نص', arrow: 'سهم',
    flag: 'علامة', priceline: 'خط سعر', timeline: 'شريط زمني',
    magnet: 'المغناطيس'
  };

  var TOOL_HINT = {
    cursor: 'اختر رسمة واسحبها لتعديلها · Delete للحذف',
    trendline: 'اسحب من نقطة لنقطة',
    hline: 'اسحب أفقياً — خط عند سعر معيّن',
    vline: 'اسحب عمودياً — خط عند تاريخ معيّن',
    rect: 'اسحب من ركن لركن',
    fib: 'اسحب من نقطة لنقطة — 7 مستويات',
    measure: 'اسحب من نقطة لنقطة — المسافة والشموع',
    brush: 'اسحب بCurve حرة',
    text: 'اضغط في مكان — اكتب النص',
    arrow: 'اسحب من نقطة لنقطة',
    flag: 'اضغط في مكان — علامة',
    priceline: 'اسحب أفقياً — خط سعر على المحور',
    timeline: 'اسحب عرضياً — شريط زمني',
    magnet: 'يلزق بأقرب سعر فتح/إغلاق'
  };

  /* مستويات فيبوناتشي القياسية */
  var FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

  var MAX_HISTORY = 50;      /* آخر 50 خطوة */
  var MAX_POINTS = 300;      /* حد الباك لكل رسمة */
  var HIT = 9;               /* نصف قطر إصابة القلم (بكسل) */
  var HANDLE = 4;            /* نصف قطر مقبض التحديد (بكسل) */
  var BAND_H = 26;           /* ارتفاع شريط الـtimeline */
  var COLORS = ['#131722', '#2962ff', '#f23645', '#089981', '#ff9800', '#9c27b0', '#00bcd4'];
  var FONT = '12px system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif';

  /* ═══════════════════════════════════════════════════════════
     📦 الحالة
     ═══════════════════════════════════════════════════════════ */
  var inst = null;             /* core instance */
  var container = null;        /* HTMLElement */
  var overlay = null;          /* canvas الطبقة */
  var octx = null;
  var paneCanvas = null;       /* canvas منطقة السعر */
  var tool = 'cursor';
  var lastDrawTool = 'trendline';
  var magnetOn = false;
  var color = COLORS[0];
  var lineWidth = 2;
  var drawings = [];
  var selectedId = null;
  var hoverId = null;
  var locked = false;
  var draft = null;            /* الرسمة اللي بتتكوّن دلوقتي */
  var drag = null;             /* حالة السحب */
  var candles = [];            /* شموع حقيقية (magnet + عدّ الشموع) */
  var candleMap = {};          /* t -> candle (من crosshair event) */
  var hist = { past: [], future: [] };
  var raf = null;
  var sig = '';
  var syncTick = 0;
  var opts = {};
  var listeners = {};
  var seq = 0;

  /* ═══════════════════════════════════════════════════════════
     🔧 أدوات مساعدة
     ═══════════════════════════════════════════════════════════ */
  function isEl(v) {
    return !!v && typeof v === 'object' && v.nodeType === 1 &&
      typeof v.getBoundingClientRect === 'function';
  }

  function clone(o) {
    if (o === null || o === undefined) return o;
    return JSON.parse(JSON.stringify(o));
  }

  function uid() {
    seq += 1;
    return 'd' + Date.now().toString(36) + '_' + seq.toString(36) +
      Math.random().toString(36).slice(2, 7);
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'string' && v.trim() !== '') {
      var n = Number(v);
      return isFinite(n) ? n : null;
    }
    return null;
  }

  function on(evt, cb) {
    if (typeof cb !== 'function') return;
    (listeners[evt] = listeners[evt] || []).push(cb);
  }

  function emit(evt, payload) {
    var arr = listeners[evt];
    if (!arr) return;
    for (var i = 0; i < arr.length; i++) {
      try { arr[i](payload); } catch (e) { /* نتجاهل خطأ المستمع */ }
    }
  }

  /* تاريخ 'YYYY-MM-DD' → milliseconds UTC (null لو غلط) */
  var RE_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
  function dayMs(t) {
    if (typeof t !== 'string') return null;
    var m = RE_DAY.exec(t);
    if (!m) return null;
    var dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (dt.getUTCFullYear() !== +m[1]) return null;
    return dt.getTime();
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* BusinessDay / UTCTimestamp / string → 'YYYY-MM-DD' أو رقم */
  function normTime(t) {
    if (t == null) return null;
    if (typeof t === 'string') return t;
    if (typeof t === 'number') return isFinite(t) ? t : null;
    if (typeof t === 'object' && t.year && t.month && t.day) {
      return t.year + '-' + pad2(t.month) + '-' + pad2(t.day);
    }
    return null;
  }

  /* 'YYYY-MM-DD' أو رقم → الشكل اللي lightweight-charts بيفهمه */
  function chartTime(t) {
    if (t == null) return null;
    if (typeof t === 'string') return t;
    if (typeof t === 'number') return t;
    return null;
  }

  /* ═══════════════════════════════════════════════════════════
     🔌 العقد مع الـcore
     ───────────────────────────────────────────────────────────
     ⛔ إحنا بنكتشف الـadapter تلقائياً — مافيش تعديل على core.js
     ▸ 1) instance.coordToPoint(x, y)  → {t?, p?}
             instance.pointToCoord(pt)   → {x, y}
        (x/y نسبةً لـcanvas منطقة السعر)
     ▸ 2) instance.chart = lightweight-charts IChartApi
     ▸ 3) instance.container = HTMLElement
     ▸ 4) instance.getCandles() → [{t,o,h,l,c,v}]  (magnet + عدّ الشموع)
     ═══════════════════════════════════════════════════════════ */
  function lwcChart() {
    if (!inst) return null;
    var c = inst.chart || inst.lwc || inst.chartApi || inst._chart || null;
    return (c && typeof c.timeScale === 'function') ? c : null;
  }

  function findMethod(names) {
    if (!inst) return null;
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      if (typeof inst[n] === 'function') return n;
    }
    /* جرب كمان على objects جوّه الـinstance */
    var keys = ['adapter', 'coord', 'coords', 'draw', 'drawing'];
    for (var k = 0; k < keys.length; k++) {
      var o = inst[keys[k]];
      if (!o || typeof o !== 'object') continue;
      for (var j = 0; j < names.length; j++) {
        if (typeof o[names[j]] === 'function') return keys[k] + '.' + names[j];
      }
    }
    return null;
  }

  function callMethod(path, args) {
    try {
      if (path.indexOf('.') !== -1) {
        var parts = path.split('.');
        var o = inst[parts[0]];
        return o[parts[1]].apply(o, args);
      }
      return inst[path].apply(inst, args);
    } catch (e) { return null; }
  }

  function priceScale() {
    var ch = lwcChart();
    if (!ch) return null;
    var sides = [];
    var want = (inst && inst.opts && inst.opts.priceScaleSide) || inst.priceScaleSide;
    if (want) sides.push(want);
    sides.push('right', 'left');
    for (var i = 0; i < sides.length; i++) {
      try {
        var ps = ch.priceScale(sides[i]);
        if (ps && typeof ps.coordinateToPrice === 'function') return ps;
      } catch (e) { /* مفيشprice scale على الناحية دي */ }
    }
    return null;
  }

  /* العنصر الحاوي — بندور عليه بين احتمالات كتير */
  function resolveContainer(instance) {
    if (!instance) return null;
    var names = ['container', 'el', 'element', 'root', 'host', 'wrap',
      'chartContainer', 'chartEl', 'pane', 'parent', 'holder', 'box'];
    for (var i = 0; i < names.length; i++) {
      if (isEl(instance[names[i]])) return instance[names[i]];
    }
    /* بحث عام: أي خاصية فيها عنصر DOM */
    var seen = [], obj = instance, depth = 0;
    while (obj && depth < 4) {
      var keys = Object.getOwnPropertyNames(obj);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        if (key === 'constructor' || seen.indexOf(key) !== -1) continue;
        seen.push(key);
        var v;
        try { v = instance[key]; } catch (e) { continue; }
        if (isEl(v) && v.nodeName !== 'CANVAS') return v;
      }
      obj = Object.getPrototypeOf(obj);
      depth += 1;
    }
    return null;
  }

  /* canvas منطقة السعر (أكبر canvas جوه الحاوية) */
  function resolvePaneCanvas() {
    if (!container || !container.querySelectorAll) return null;
    var list = container.querySelectorAll('canvas');
    var best = null, bestArea = -1;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c === overlay) continue;
      var area = (c.clientWidth || 0) * (c.clientHeight || 0);
      if (area > bestArea) { bestArea = area; best = c; }
    }
    return best;
  }

  /* ═══════════════════════════════════════════════════════════
     🧭 تحويل الإحداثيات (بكسل ↔ وقت/سعر)
     ═══════════════════════════════════════════════════════════ */
  function paneRect() {
    var c = paneCanvas || resolvePaneCanvas();
    if (!c) return null;
    var r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height, canvas: c };
  }

  /* (clientX, clientY) → {t, p, x, y} */
  function toData(clientX, clientY) {
    var r = paneRect();
    if (!r) return null;
    var x = clientX - r.left;
    var y = clientY - r.top;

    var m = findMethod(['coordToPoint', 'screenToPoint', 'toDataPoint', 'pointFromXY']);
    if (m) {
      var p = callMethod(m, [x, y]);
      if (p && typeof p === 'object') {
        return { t: normTime(p.t), p: num(p.p), x: x, y: y };
      }
    }

    var ch = lwcChart();
    if (!ch) return null;

    var ts = ch.timeScale();
    var ps = priceScale();
    var t = null, price = null;

    if (ts && typeof ts.coordinateToTime === 'function') {
      try { t = normTime(ts.coordinateToTime(x)); } catch (e) { t = null; }
    }
    if (ps && typeof ps.coordinateToPrice === 'function') {
      try { price = num(ps.coordinateToPrice(y)); } catch (e) { price = null; }
    }
    if (t === null && price === null) return null;
    return { t: t, p: price, x: x, y: y };
  }

  /* {t?, p?} → {x, y} (بكسل جوه canvas السعر) */
  function toScreen(pt) {
    if (!pt) return null;

    var m = findMethod(['pointToCoord', 'pointToScreen', 'toChartPoint']);
    if (m) {
      var s = callMethod(m, [pt]);
      if (s && isNum(s.x) && isNum(s.y)) return { x: s.x, y: s.y };
    }

    var ch = lwcChart();
    if (!ch) return null;
    var x = null, y = null;

    if (pt.t != null) {
      try {
        var ts = ch.timeScale();
        if (ts && typeof ts.timeToCoordinate === 'function') {
          var c = ts.timeToCoordinate(chartTime(pt.t));
          if (isNum(c)) x = c;
        }
      } catch (e) { x = null; }
    }
    if (pt.p != null) {
      try {
        var ps = priceScale();
        if (ps && typeof ps.priceToCoordinate === 'function') {
          var c2 = ps.priceToCoordinate(pt.p);
          if (isNum(c2)) y = c2;
        }
      } catch (e) { y = null; }
    }
    if (x === null && y === null) return null;
    return { x: (x === null ? 0 : x), y: (y === null ? 0 : y) };
  }

  /* ═══════════════════════════════════════════════════════════
     🧲 الـMagnet — snapping لأقرب open/close
     ───────────────────────────────────────────────────────────
     ⛔ لو مافيش شموع حقيقية → مافيش snapping (مافيش تخمين)
     ═══════════════════════════════════════════════════════════ */
  function allCandles() {
    if (candles && candles.length) return candles;
    var m = findMethod(['getCandles', 'candles', 'getData', 'getSeriesData']);
    if (m) {
      var v = callMethod(m, []);
      if (Array.isArray(v) && v.length) {
        candles = v;
        return candles;
      }
    }
    var list = [];
    for (var k in candleMap) if (Object.prototype.hasOwnProperty.call(candleMap, k)) list.push(candleMap[k]);
    return list;
  }

  function candleAt(t) {
    if (t == null) return null;
    var list = allCandles();
    if (!list.length) return null;
    var key = String(t);
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c && String(c.t) === key) return c;
    }
    /* أقرب شمعة زمنياً */
    var ms = dayMs(t);
    if (ms === null) return null;
    var best = null, bestDiff = Infinity;
    for (var j = 0; j < list.length; j++) {
      var c2 = list[j];
      var m2 = c2 && dayMs(c2.t);
      if (m2 === null) continue;
      var d = Math.abs(m2 - ms);
      if (d < bestDiff) { bestDiff = d; best = c2; }
    }
    return best;
  }

  function snapMagnet(pt) {
    if (!magnetOn || !pt) return pt;
    var c = candleAt(pt.t);
    if (!c) return pt;
    var o = num(c.o), cl = num(c.c);
    var out = { t: pt.t != null ? c.t : pt.t, p: pt.p };
    if (pt.p != null && o !== null && cl !== null) {
      out.p = (Math.abs(pt.p - o) <= Math.abs(pt.p - cl)) ? o : cl;
    }
    return out;
  }

  /* ═══════════════════════════════════════════════════════════
     📊 الشموع — للـmagnet ولعدّ الشموع في المسطرة
     ═══════════════════════════════════════════════════════════ */
  function candleIndex(t) {
    if (t == null) return -1;
    var list = allCandles();
    var key = String(t);
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].t) === key) return i;
    }
    var ms = dayMs(t);
    if (ms === null) return -1;
    for (var j = 0; j < list.length; j++) {
      var m = dayMs(list[j] && list[j].t);
      if (m === null) continue;
      if (m === ms) return j;
    }
    return -1;
  }

  function countCandles(t1, t2) {
    var i1 = candleIndex(t1), i2 = candleIndex(t2);
    if (i1 < 0 || i2 < 0) return null;
    return Math.abs(i2 - i1) + 1;
  }

  /* ═══════════════════════════════════════════════════════════
     📜 السجل (undo / redo)
     ═══════════════════════════════════════════════════════════ */
  function pushHistory() {
    hist.past.push(JSON.stringify(drawings));
    if (hist.past.length > MAX_HISTORY) hist.past.shift();
    hist.future.length = 0;
  }

  function undo() {
    if (locked) return false;
    if (!hist.past.length) return false;
    hist.future.push(JSON.stringify(drawings));
    if (hist.future.length > MAX_HISTORY) hist.future.shift();
    drawings = JSON.parse(hist.past.pop());
    selectedId = null;
    emit('change', { type: 'undo' });
    return true;
  }

  function redo() {
    if (locked) return false;
    if (!hist.future.length) return false;
    hist.past.push(JSON.stringify(drawings));
    if (hist.past.length > MAX_HISTORY) hist.past.shift();
    drawings = JSON.parse(hist.future.pop());
    selectedId = null;
    emit('change', { type: 'redo' });
    return true;
  }

  function clear() {
    if (locked) return false;
    if (!drawings.length) return false;
    pushHistory();
    drawings = [];
    selectedId = null;
    emit('change', { type: 'clear' });
    return true;
  }

  /* ═══════════════════════════════════════════════════════════
     🖌 إدارة الرسومات
     ═══════════════════════════════════════════════════════════ */
  function normalizePoint(pt) {
    if (!pt || typeof pt !== 'object') return null;
    var out = {};
    var t = normTime(pt.t);
    var p = num(pt.p);
    if (t !== null && t !== undefined) out.t = t;
    if (p !== null) out.p = p;
    if (out.t === undefined && out.p === undefined) return null;
    return out;
  }

  function normalizeDrawing(d) {
    if (!d || typeof d !== 'object') return null;
    var type = String(d.type || '');
    if (DRAWING_TOOLS.indexOf(type) === -1) return null;
    var pts = [];
    var src = Array.isArray(d.points) ? d.points : [];
    for (var i = 0; i < src.length && pts.length < MAX_POINTS; i++) {
      var p = normalizePoint(src[i]);
      if (p) pts.push(p);
    }
    if (!pts.length) return null;
    return {
      id: d.id ? String(d.id) : uid(),
      type: type,
      points: pts,
      color: (typeof d.color === 'string' && d.color) ? d.color : color,
      width: (isNum(d.width) && d.width > 0) ? d.width : lineWidth,
      text: (typeof d.text === 'string') ? d.text : '',
      locked: !!d.locked
    };
  }

  function getDrawing(id) {
    for (var i = 0; i < drawings.length; i++) if (drawings[i].id === id) return drawings[i];
    return null;
  }

  function getDrawings() { return clone(drawings); }

  function setDrawings(list) {
    var out = [];
    if (Array.isArray(list)) {
      for (var i = 0; i < list.length; i++) {
        var d = normalizeDrawing(list[i]);
        if (d) out.push(d);
      }
    }
    if (!locked) pushHistory();
    drawings = out;
    selectedId = null;
    emit('change', { type: 'set' });
    return true;
  }

  function addDrawing(d) {
    if (locked) return null;
    var n = normalizeDrawing(d);
    if (!n) return null;
    pushHistory();
    drawings.push(n);
    selectedId = n.id;
    emit('change', { type: 'add', id: n.id });
    return n;
  }

  function removeDrawing(id) {
    if (locked) return false;
    for (var i = 0; i < drawings.length; i++) {
      if (drawings[i].id === id) {
        pushHistory();
        drawings.splice(i, 1);
        if (selectedId === id) selectedId = null;
        emit('change', { type: 'remove', id: id });
        return true;
      }
    }
    return false;
  }

  function removeSelected() {
    if (!selectedId) return false;
    return removeDrawing(selectedId);
  }

  /* ═══════════════════════════════════════════════════════════
     🎯 رسم كل رسمة
     ═══════════════════════════════════════════════════════════ */
  function drawText(ctx, text, x, y, color, align) {
    if (!text) return;
    ctx.save();
    ctx.font = FONT;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color || '#131722';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fmtNum(v, dec) {
    if (!isNum(v)) return '—';
    var d = (dec == null) ? 2 : dec;
    return v.toFixed(d);
  }

  function drawOne(ctx, d, W, H) {
    var pts = [];
    for (var i = 0; i < d.points.length; i++) {
      var s = toScreen(d.points[i]);
      if (s) pts.push(s);
    }
    if (!pts.length) return;

    ctx.save();
    ctx.lineWidth = d.width || 2;
    ctx.strokeStyle = d.color;
    ctx.fillStyle = d.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var a = pts[0], b = pts[1] || pts[0];

    switch (d.type) {
      case 'trendline':
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;

      case 'arrow': {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        var ang = Math.atan2(b.y - a.y, b.x - a.x);
        var len = 12 + (d.width || 2) * 2;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - len * Math.cos(ang - 0.42), b.y - len * Math.sin(ang - 0.42));
        ctx.lineTo(b.x - len * Math.cos(ang + 0.42), b.y - len * Math.sin(ang + 0.42));
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'hline':
      case 'priceline': {
        ctx.beginPath();
        ctx.moveTo(0, a.y);
        ctx.lineTo(W, a.y);
        if (d.type === 'priceline') ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        /* شارة السعر على المحور */
        if (d.points[0].p != null) {
          var label = fmtNum(d.points[0].p);
          ctx.font = FONT;
          var tw = ctx.measureText(label).width;
          var bx = W - tw - 12, by = a.y - 9;
          roundRect(ctx, bx, by, tw + 10, 18, 4);
          ctx.fillStyle = d.color;
          ctx.fill();
          drawText(ctx, label, bx + 5, by + 9, '#ffffff', 'left');
        }
        break;
      }

      case 'vline': {
        ctx.beginPath();
        ctx.moveTo(a.x, 0);
        ctx.lineTo(a.x, H);
        ctx.stroke();
        if (d.points[0].t) {
          var lbl = String(d.points[0].t).slice(0, 10);
          ctx.font = FONT;
          var w2 = ctx.measureText(lbl).width;
          roundRect(ctx, a.x - w2 / 2 - 5, H - BAND_H - 2, w2 + 10, 18, 4);
          ctx.fillStyle = d.color;
          ctx.fill();
          drawText(ctx, lbl, a.x, H - BAND_H + 7, '#ffffff', 'center');
        }
        break;
      }

      case 'rect': {
        var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        var w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = d.color;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeRect(x, y, w, h);
        break;
      }

      case 'fib': {
        var p0 = d.points[0].p, p1 = d.points[1] ? d.points[1].p : d.points[0].p;
        if (p0 == null || p1 == null) break;
        var ratios = (Array.isArray(d.levels) && d.levels.length) ? d.levels : FIB_RATIOS;
        for (var r = 0; r < ratios.length; r++) {
          var price = p0 + (p1 - p0) * ratios[r];
          var yy = toScreen({ p: price });
          if (!yy) continue;
          ctx.beginPath();
          ctx.moveTo(0, yy.y);
          ctx.lineTo(W, yy.y);
          ctx.stroke();
          /* التسميات على يمين الشارت */
          var t2 = (ratios[r] * 100).toFixed(ratios[r] === 0 || ratios[r] === 1 ? 0 : 1) + '%';
          var pl = fmtNum(price);
          ctx.font = FONT;
          var tww = ctx.measureText(t2 + ' ' + pl).width;
          roundRect(ctx, W - tww - 12, yy.y - 9, tww + 10, 18, 4);
          ctx.fillStyle = d.color;
          ctx.fill();
          drawText(ctx, t2 + ' ' + pl, W - tww - 7, yy.y, '#ffffff', 'left');
        }
        /* خط الوصل بين النقطتين */
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }

      case 'measure': {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        var pA = d.points[0].p, pB = d.points[1] ? d.points[1].p : d.points[0].p;
        var parts = [];
        if (isNum(pA) && isNum(pB)) {
          var diff = pB - pA;
          var pct = pA !== 0 ? (diff / Math.abs(pA)) * 100 : null;
          parts.push((diff >= 0 ? '▲ ' : '▼ ') + fmtNum(Math.abs(pct)) + '%');
          parts.push((diff >= 0 ? '+' : '−') + fmtNum(Math.abs(diff)));
        }
        var n = countCandles(d.points[0].t, d.points[1] ? d.points[1].t : d.points[0].t);
        parts.push(n === null ? 'الشموع: غير متاح' : ('الشموع: ' + n));
        var txt = parts.join(' · ');
        ctx.font = FONT;
        var tw3 = ctx.measureText(txt).width;
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        roundRect(ctx, mx - tw3 / 2 - 6, my - 22, tw3 + 12, 20, 4);
        ctx.fillStyle = d.color;
        ctx.fill();
        drawText(ctx, txt, mx, my - 12, '#ffffff', 'center');
        break;
      }

      case 'brush': {
        if (pts.length < 2) {
          if (pts.length === 1) { ctx.beginPath(); ctx.arc(a.x, a.y, 1.5, 0, 6.284); ctx.fill(); }
          break;
        }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (var bp = 1; bp < pts.length; bp++) ctx.lineTo(pts[bp].x, pts[bp].y);
        ctx.stroke();
        break;
      }

      case 'text': {
        var t3 = d.text || 'نص';
        ctx.font = FONT;
        var tw4 = ctx.measureText(t3).width;
        roundRect(ctx, a.x, a.y - 10, tw4 + 10, 20, 4);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = d.color;
        ctx.stroke();
        drawText(ctx, t3, a.x + 5, a.y, d.color, 'left');
        break;
      }

      case 'flag': {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x, a.y - 20);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - 20);
        ctx.lineTo(a.x + 14, a.y - 15);
        ctx.lineTo(a.x, a.y - 10);
        ctx.closePath();
        ctx.fill();
        if (d.text) drawText(ctx, d.text, a.x + 18, a.y - 15, d.color, 'left');
        break;
      }

      case 'timeline': {
        var t1 = d.points[0].t, t2 = d.points[1] ? d.points[1].t : d.points[0].t;
        var s1 = toScreen({ t: t1 }), s2 = toScreen({ t: t2 });
        if (!s1 || !s2) break;
        var x1 = Math.min(s1.x, s2.x), w4 = Math.abs(s2.x - s1.x);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = d.color;
        ctx.fillRect(x1, H - BAND_H, w4, BAND_H);
        ctx.globalAlpha = 1;
        drawText(ctx, String(t1 || '').slice(0, 10), x1 + 4, H - BAND_H / 2, '#ffffff', 'left');
        drawText(ctx, String(t2 || '').slice(0, 10), x1 + w4 - 4, H - BAND_H / 2, '#ffffff', 'right');
        break;
      }
    }
    ctx.restore();
  }

  function drawHandles(ctx, d) {
    var ctxSave = ctx;
    for (var i = 0; i < d.points.length; i++) {
      var s = toScreen(d.points[i]);
      if (!s) continue;
      ctxSave.save();
      ctxSave.fillStyle = '#ffffff';
      ctxSave.strokeStyle = d.color;
      ctxSave.lineWidth = 2;
      ctxSave.beginPath();
      ctxSave.rect(s.x - HANDLE, s.y - HANDLE, HANDLE * 2, HANDLE * 2);
      ctxSave.fill();
      ctxSave.stroke();
      ctxSave.restore();
    }
  }

  function renderTo(ctx, W, H) {
    if (!ctx) return;
    for (var i = 0; i < drawings.length; i++) {
      try { drawOne(ctx, drawings[i], W, H); } catch (e) { /* رسمة واحدة مش بتوقّف الباقي */ }
    }
    var sel = selectedId ? getDrawing(selectedId) : null;
    if (sel) {
      try { drawHandles(ctx, sel); } catch (e) { }
    }
  }

  function render() {
    if (!octx || !overlay) return;
    var W = overlay.clientWidth, H = overlay.clientHeight;
    var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    var w = Math.max(1, Math.round(W * dpr)), h = Math.max(1, Math.round(H * dpr));
    if (overlay.width !== w || overlay.height !== h) { overlay.width = w; overlay.height = h; }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, W, H);
    renderTo(octx, W, H);
  }

  /* بصمة الـview — لو اتغيّرت نعيد الرسم */
  function viewSig() {
    var r = paneRect();
    if (!r) return 'x';
    var ch = lwcChart();
    var s = r.width + 'x' + r.height;
    if (ch) {
      try {
        var ts = ch.timeScale();
        if (ts && typeof ts.getVisibleLogicalRange === 'function') {
          var vr = ts.getVisibleLogicalRange();
          if (vr) s += '|' + vr.from + '|' + vr.to;
        }
      } catch (e) { }
      try {
        var ps = priceScale();
        var list = allCandles();
        if (ps && list && list.length) {
          var last = list[list.length - 1];
          var pv = num(last.c);
          if (pv !== null) {
            var yy = ps.priceToCoordinate(pv);
            if (isNum(yy)) s += '|' + yy.toFixed(3);
          }
        }
      } catch (e) { }
    }
    return s;
  }

  function loop() {
    raf = null;
    if (!overlay) return;
    /* كل 30 frame بنعيد مزامنة الطبقة (الـcore ممكن يغيّر الـcanvas) */
    syncTick = (syncTick + 1) % 30;
    if (syncTick === 0) syncOverlay();
    var s = viewSig();
    if (s !== sig) { sig = s; render(); }
    raf = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame(loop)
      : setTimeout(loop, 80);
  }

  function startLoop() {
    if (raf) return;
    raf = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame(loop)
      : setTimeout(loop, 80);
  }

  function stopLoop() {
    if (!raf) return;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    else clearTimeout(raf);
    raf = null;
  }

  /* ═══════════════════════════════════════════════════════════
     🎯 إصابة الرسومات (hit test)
     ═══════════════════════════════════════════════════════════ */
  function distToSeg(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    var tt = ((px - x1) * dx + (py - y1) * dy) / len2;
    tt = clamp(tt, 0, 1);
    return Math.hypot(px - (x1 + tt * dx), py - (y1 + tt * dy));
  }

  function hitDrawing(d, x, y) {
    var pts = [];
    for (var i = 0; i < d.points.length; i++) {
      var s = toScreen(d.points[i]);
      if (s) pts.push(s);
    }
    if (!pts.length) return false;
    var W = overlay ? overlay.clientWidth : 0;
    var H = overlay ? overlay.clientHeight : 0;

    switch (d.type) {
      case 'trendline':
      case 'arrow':
      case 'measure':
        return distToSeg(x, y, pts[0].x, pts[0].y, pts[1].x, pts[1].y) <= HIT;

      case 'brush': {
        for (var i2 = 1; i2 < pts.length; i2++) {
          if (distToSeg(x, y, pts[i2 - 1].x, pts[i2 - 1].y, pts[i2].x, pts[i2].y) <= HIT) return true;
        }
        return false;
      }

      case 'hline':
      case 'priceline':
        return Math.abs(y - pts[0].y) <= HIT;

      case 'vline':
        return Math.abs(x - pts[0].x) <= HIT;

      case 'rect': {
        var x0 = Math.min(pts[0].x, pts[1].x), x1 = Math.max(pts[0].x, pts[1].x);
        var y0 = Math.min(pts[0].y, pts[1].y), y1 = Math.max(pts[0].y, pts[1].y);
        var inside = (x >= x0 && x <= x1 && y >= y0 && y <= y1);
        var onEdge = (Math.abs(y - y0) <= HIT || Math.abs(y - y1) <= HIT ||
          Math.abs(x - x0) <= HIT || Math.abs(x - x1) <= HIT);
        return inside || onEdge;
      }

      case 'fib': {
        var p0 = d.points[0].p, p1 = d.points[1] ? d.points[1].p : d.points[0].p;
        if (p0 == null || p1 == null) return false;
        var ratios = (Array.isArray(d.levels) && d.levels.length) ? d.levels : FIB_RATIOS;
        for (var r = 0; r < ratios.length; r++) {
          var yy = toScreen({ p: p0 + (p1 - p0) * ratios[r] });
          if (yy && Math.abs(y - yy.y) <= HIT) return true;
        }
        return distToSeg(x, y, pts[0].x, pts[0].y, pts[1].x, pts[1].y) <= HIT;
      }

      case 'text': {
        var txt = d.text || 'نص';
        var tw = 0;
        if (octx) { octx.font = FONT; tw = octx.measureText(txt).width; }
        else tw = txt.length * 7;
        return (x >= pts[0].x - 4 && x <= pts[0].x + tw + 10 &&
          y >= pts[0].y - 12 && y <= pts[0].y + 12);
      }

      case 'flag':
        return Math.hypot(x - pts[0].x, y - (pts[0].y - 12)) <= HIT + 4;

      case 'timeline': {
        var s1 = toScreen({ t: d.points[0].t }), s2 = toScreen({ t: d.points[1] ? d.points[1].t : d.points[0].t });
        if (!s1 || !s2) return false;
        var tx = Math.min(s1.x, s2.x), tw2 = Math.abs(s2.x - s1.x);
        return (y >= H - BAND_H - 3) && x >= tx - 3 && x <= tx + tw2 + 3;
      }
    }
    return false;
  }

  function hitTest(x, y) {
    /* المحدد فوق كل حاجة */
    var sel = selectedId ? getDrawing(selectedId) : null;
    if (sel) {
      for (var i = 0; i < sel.points.length; i++) {
        var s = toScreen(sel.points[i]);
        if (s && Math.hypot(x - s.x, y - s.y) <= HIT) return { id: sel.id, vertex: i };
      }
    }
    for (var j = drawings.length - 1; j >= 0; j--) {
      if (drawings[j].locked) continue;
      if (hitDrawing(drawings[j], x, y)) return { id: drawings[j].id, vertex: -1 };
    }
    return null;
  }

  /* ═══════════════════════════════════════════════════════════
     🖱 التفاعل (ماوس + لمس)
     ═══════════════════════════════════════════════════════════ */
  function effectiveTool() {
    return (tool === 'magnet') ? lastDrawTool : tool;
  }

  function newPoint(pt) {
    var p = { };
    if (pt.t !== null && pt.t !== undefined) p.t = pt.t;
    if (pt.p !== null && pt.p !== undefined) p.p = pt.p;
    return p;
  }

  function startDraft(pos, ev) {
    var et = effectiveTool();
    if (DRAWING_TOOLS.indexOf(et) === -1) return;

    var snapped = snapMagnet(newPoint(pos));
    var d = {
      id: uid(), type: et, points: [snapped],
      color: color, width: lineWidth, text: '', locked: false
    };

    if (et === 'hline' || et === 'priceline') {
      d.points = [{ p: snapped.p }];
    } else if (et === 'vline') {
      d.points = [{ t: snapped.t }];
    } else if (et === 'text' || et === 'flag') {
      d.points = [snapped];
    } else {
      d.points = [snapped];
    }

    draft = d;
    if (et === 'brush') {
      draft.points = [snapped];
      draft._last = { x: pos.x, y: pos.y };
    }
  }

  function updateDraft(pos) {
    if (!draft) return;
    var et = draft.type;
    var snapped = snapMagnet(newPoint(pos));

    if (et === 'hline' || et === 'priceline') {
      draft.points[0] = { p: snapped.p };
    } else if (et === 'vline') {
      draft.points[0] = { t: snapped.t };
    } else if (et === 'brush') {
      var last = draft._last || { x: pos.x, y: pos.y };
      if (Math.hypot(pos.x - last.x, pos.y - last.y) >= 3 && draft.points.length < MAX_POINTS) {
        draft.points.push(snapped);
        draft._last = { x: pos.x, y: pos.y };
      }
    } else if (et === 'text' || et === 'flag') {
      draft.points[0] = snapped;
    } else {
      draft.points[1] = snapped;
    }
    render();
  }

  function commitDraft() {
    if (!draft) return;
    var d = draft;
    draft = null;
    if (!d.points.length) return;

    /* نقطتين مطلوبتين للأدوات الثنائية */
    if (['trendline', 'hline', 'vline', 'rect', 'fib', 'measure', 'arrow', 'priceline', 'timeline'].indexOf(d.type) !== -1) {
      if (d.type === 'hline' || d.type === 'priceline') {
        if (d.points[0].p == null) return;
      } else if (d.type === 'vline') {
        if (d.points[0].t == null) return;
      } else if (d.type === 'timeline') {
        if (d.points[0].t == null) return;
        if (!d.points[1]) d.points[1] = { t: d.points[0].t };
      } else {
        if (!d.points[1]) return;      /* سحب لازم يكون اتعمل */
        if (d.points[0].t == null || d.points[1].t == null) {
          if (d.points[0].p == null || d.points[1].p == null) return;
        }
      }
    }

    /* النص والعلامة: بنطلب النص */
    if (d.type === 'text' || d.type === 'flag') {
      var label = askText(d.type === 'text' ? 'اكتب النص' : 'اكتب نص العلامة (اختياري)', d.text || '');
      if (label === null) { render(); return; }   /* المستخدم لغى */
      d.text = label;
      if (d.type === 'text' && !d.text) { render(); return; }
    }

    addDrawing(d);
    render();
  }

  function askText(title, def) {
    if (typeof opts.onText === 'function') {
      var v = opts.onText(title, def);
      return (v === undefined) ? null : String(v);
    }
    if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
      var r = window.prompt(title, def || '');
      return (r === null) ? null : String(r);
    }
    return def || '';
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && typeof e.button === 'number' && e.button !== 0) return;
    if (locked) {
      if (effectiveTool() !== 'cursor') { e.preventDefault(); e.stopPropagation(); }
      return;
    }
    var pos = toData(e.clientX, e.clientY);
    if (!pos) return;

    var et = effectiveTool();

    if (et === 'cursor') {
      var hit = hitTest(pos.x, pos.y);
      if (!hit) { selectedId = null; render(); return; }
      e.preventDefault(); e.stopPropagation();
      selectedId = hit.id;
      var d = getDrawing(hit.id);
      if (d && d.locked) { render(); return; }
      if (hit.vertex >= 0) {
        drag = { mode: 'vertex', id: hit.id, index: hit.vertex, before: clone(d) };
      } else {
        drag = { mode: 'move', id: hit.id, before: clone(d), start: pos, orig: clone(d.points) };
      }
      render();
      return;
    }

    /* أداة رسم */
    e.preventDefault(); e.stopPropagation();
    startDraft(pos, e);
    if (e.pointerId != null && overlay.setPointerCapture) {
      try { overlay.setPointerCapture(e.pointerId); } catch (er) { }
    }
    render();
  }

  function onPointerMove(e) {
    var pos = toData(e.clientX, e.clientY);

    if (draft) {
      if (pos) updateDraft(pos);
      e.preventDefault(); e.stopPropagation();
      return;
    }

    if (drag) {
      if (pos) {
        var d = getDrawing(drag.id);
        if (d) {
          if (drag.mode === 'vertex') {
            /* نقطة واحدة — بتعدّل بُعد واحد بس (اللي موجود فيها) */
            var np = snapMagnet(newPoint(pos));
            var cur = d.points[drag.index] || {};
            if (cur.t !== undefined && np.t !== undefined && np.t !== null) cur.t = np.t;
            if (cur.p !== undefined && np.p !== undefined && np.p !== null) cur.p = np.p;
            d.points[drag.index] = cur;
          } else {
            /* نقل الرسمة كلها — إزاحة بالبكسل ثم رجوع للوقت/السعر */
            var dx = pos.x - drag.start.x;
            var dy = pos.y - drag.start.y;
            var ch = lwcChart();
            var ps = priceScale();
            for (var i = 0; i < d.points.length; i++) {
              var op = drag.orig[i];
              if (!op) continue;
              var st = toScreen(op);
              var np2 = {};
              if (op.t !== undefined) {
                var nt = op.t;
                if (st && ch && ch.timeScale && typeof ch.timeScale().coordinateToTime === 'function') {
                  try {
                    var v = normTime(ch.timeScale().coordinateToTime(st.x + dx));
                    if (v !== null && v !== undefined) nt = v;
                  } catch (er) { }
                }
                np2.t = nt;
              }
              if (op.p !== undefined) {
                var pr = op.p;
                if (st && ps && typeof ps.coordinateToPrice === 'function') {
                  try {
                    var v2 = num(ps.coordinateToPrice(st.y + dy));
                    if (v2 !== null) pr = v2;
                  } catch (er) { }
                }
                np2.p = pr;
              }
              d.points[i] = np2;
            }
            if (magnetOn) {
              for (var k = 0; k < d.points.length; k++) d.points[k] = snapMagnet(d.points[k]);
            }
          }
        }
      }
      e.preventDefault(); e.stopPropagation();
      render();
      return;
    }

    /* مجرد تحريك الماوس — تحديث الـhover */
    if (effectiveTool() === 'cursor' && pos) {
      var hit = hitTest(pos.x, pos.y);
      var id = hit ? hit.id : null;
      if (id !== hoverId) { hoverId = id; render(); }
    }
  }

  function onPointerUp(e) {
    if (draft) {
      commitDraft();
      e.preventDefault(); e.stopPropagation();
      return;
    }
    if (drag) {
      var d = getDrawing(drag.id);
      if (d && JSON.stringify(d) !== JSON.stringify(drag.before)) {
        pushHistory();
        emit('change', { type: 'edit', id: drag.id });
      }
      drag = null;
      e.preventDefault(); e.stopPropagation();
      render();
      return;
    }
  }

  function onDblClick(e) {
    if (effectiveTool() !== 'cursor') return;
    var pos = toData(e.clientX, e.clientY);
    if (!pos) return;
    var hit = hitTest(pos.x, pos.y);
    if (!hit) return;
    var d = getDrawing(hit.id);
    if (!d || (d.type !== 'text' && d.type !== 'flag')) return;
    e.preventDefault(); e.stopPropagation();
    if (locked) return;
    var label = askText(d.type === 'text' ? 'اكتب النص' : 'اكتب نص العلامة (اختياري)', d.text || '');
    if (label === null) return;
    pushHistory();
    d.text = label;
    emit('change', { type: 'edit', id: d.id });
    render();
  }

  /* ═══════════════════════════════════════════════════════════
     ⌨️ الكيبورد
     ═══════════════════════════════════════════════════════════ */
  function isTyping(e) {
    var t = e && e.target;
    if (!t) return false;
    var tag = (t.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
  }

  function onKeyDown(e) {
    if (!inst) return;
    if (isTyping(e)) return;
    var k = e.key;
    if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z' || k === 'y' || k === 'Y')) {
      if (k === 'y' || k === 'Y' || e.shiftKey) { if (redo()) e.preventDefault(); }
      else if (undo()) e.preventDefault();
      return;
    }
    if (k === 'Delete' || k === 'Backspace') {
      if (removeSelected()) e.preventDefault();
      return;
    }
    if (k === 'Escape') { selectedId = null; render(); }
  }

  /* ═══════════════════════════════════════════════════════════
     🔌 التوصيل بالـcore
     ═══════════════════════════════════════════════════════════ */
  function buildOverlay() {
    if (!container || typeof document === 'undefined') return;
    overlay = document.createElement('canvas');
    overlay.className = 'octa-draw-layer';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.position = 'absolute';
    overlay.style.zIndex = '4';
    overlay.style.touchAction = 'none';
    overlay.style.pointerEvents = 'none';
    overlay.style.left = '0px';
    overlay.style.top = '0px';

    var parent = container;
    if (paneCanvas && paneCanvas.offsetParent) parent = paneCanvas.offsetParent;
    parent.appendChild(overlay);
    octx = overlay.getContext('2d');

    overlay.addEventListener('pointerdown', onPointerDown);
    overlay.addEventListener('pointermove', onPointerMove);
    overlay.addEventListener('pointerup', onPointerUp);
    overlay.addEventListener('pointercancel', onPointerUp);
    overlay.addEventListener('dblclick', onDblClick);
  }

  function syncOverlay() {
    if (!overlay) return;
    var pc = resolvePaneCanvas();
    if (!pc) return;
    if (pc !== paneCanvas) {
      paneCanvas = pc;
      sig = '';
    }
    var parent = overlay.parentNode;
    var wantParent = pc.offsetParent || container;
    if (parent !== wantParent && wantParent) {
      wantParent.appendChild(overlay);
    }
    overlay.style.left = (pc.offsetLeft || 0) + 'px';
    overlay.style.top = (pc.offsetTop || 0) + 'px';
    overlay.style.width = (pc.clientWidth || 0) + 'px';
    overlay.style.height = (pc.clientHeight || 0) + 'px';
    /* في وضع الرسم الـoverlay بياخد اللمس؛ في وضع المؤشر الشارت نفسه يتحرك */
    overlay.style.pointerEvents = (effectiveTool() === 'cursor') ? 'none' : 'auto';
  }

  function bindCore() {
    if (!inst || typeof inst.on !== 'function') return;
    try {
      inst.on('crosshair', function (info) {
        if (info && info.candle) {
          var c = info.candle;
          if (c.t) candleMap[String(c.t)] = c;
        }
        if (info && info.time && (info.open != null || info.close != null)) {
          candleMap[String(info.time)] = {
            t: info.time, o: info.open, c: info.close,
            h: info.high, l: info.low, v: info.volume
          };
        }
        sig = '';
      });
      inst.on('candles', function () { sig = ''; });
      inst.on('timeframe', function () { sig = ''; });
      inst.on('type', function () { sig = ''; });
    } catch (e) { }
  }

  function enable(instance, t, options) {
    detach();
    inst = instance || null;
    opts = options || {};
    container = resolveContainer(inst);
    paneCanvas = resolvePaneCanvas();
    if (container) {
      buildOverlay();
      container.addEventListener('pointerdown', onContainerDown, true);
      container.addEventListener('pointermove', onContainerMove, true);
      container.addEventListener('pointerup', onContainerUp, true);
      container.addEventListener('pointercancel', onContainerUp, true);
      container.addEventListener('dblclick', onDblClick, true);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', onKeyDown);
    }
    bindCore();
    setTool(t || 'cursor');
    syncOverlay();
    startLoop();
    emit('ready', { ok: !!container });
    return api;
  }

  function detach() {
    stopLoop();
    if (container) {
      container.removeEventListener('pointerdown', onContainerDown, true);
      container.removeEventListener('pointermove', onContainerMove, true);
      container.removeEventListener('pointerup', onContainerUp, true);
      container.removeEventListener('pointercancel', onContainerUp, true);
      container.removeEventListener('dblclick', onDblClick, true);
    }
    if (typeof document !== 'undefined') document.removeEventListener('keydown', onKeyDown);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null; octx = null; paneCanvas = null; container = null;
    inst = null; draft = null; drag = null;
  }

  function disable() { detach(); }

  /* مسار المؤشر: بنستقبل الأحداث على الحاوية (capture) عشان
     الشارت نفسه يفضل يتقرّب/يتحرّك لما مفيش رسمة تحت الماوس */
  function onContainerDown(e) {
    if (e.target === overlay) return;             /* الطبقة بتتولى بنفسها */
    if (effectiveTool() !== 'cursor') return;      /* في وضع الرسم: تجاهل */
    onPointerDown(e);
  }
  function onContainerMove(e) {
    if (e.target === overlay) return;
    if (draft) return;
    if (drag) { onPointerMove(e); return; }
    if (effectiveTool() !== 'cursor') return;
    onPointerMove(e);
  }
  function onContainerUp(e) {
    if (e.target === overlay) return;
    if (drag) onPointerUp(e);
  }

  /* ═══════════════════════════════════════════════════════════
     🎛 واجهة الأدوات
     ═══════════════════════════════════════════════════════════ */
  function setTool(t) {
    var name = String(t || '');
    if (TOOLS.indexOf(name) === -1) return false;
    if (name === 'magnet') {
      magnetOn = true;
      tool = 'magnet';
    } else {
      tool = name;
      if (name !== 'cursor') lastDrawTool = name;
    }
    selectedId = null;
    draft = null;
    syncOverlay();
    render();
    emit('tool', { tool: tool, magnet: magnetOn });
    return true;
  }

  function setLocked(v) {
    locked = !!v;
    if (locked) { draft = null; drag = null; }
    emit('lock', { locked: locked });
    return locked;
  }

  function setMagnet(v) {
    magnetOn = !!v;
    if (!magnetOn && tool === 'magnet') tool = lastDrawTool;
    syncOverlay();
    render();
    emit('magnet', { magnet: magnetOn });
    return magnetOn;
  }

  function setStyle(o) {
    o = o || {};
    if (typeof o.color === 'string' && o.color) color = o.color;
    if (isNum(o.width) && o.width > 0) lineWidth = o.width;
    render();
  }

  function setCandles(list) {
    candles = Array.isArray(list) ? list.slice() : [];
    sig = '';
    render();
  }

  function getSelected() {
    var d = selectedId ? getDrawing(selectedId) : null;
    return d ? clone(d) : null;
  }

  /* رسم الرسومات على canvas خارجي (للتصدير) */
  function renderToCanvas(canvas, background) {
    if (!canvas || !canvas.getContext) return false;
    var ctx = canvas.getContext('2d');
    if (!ctx) return false;
    var W = canvas.clientWidth || canvas.width;
    var H = canvas.clientHeight || canvas.height;
    ctx.save();
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, W, H); }
    renderTo(ctx, W, H);
    ctx.restore();
    return true;
  }

  /* ═══════════════════════════════════════════════════════════
     📦 التصدير
     ═══════════════════════════════════════════════════════════ */
  var api = {
    TOOLS: TOOLS,
    DRAWING_TOOLS: DRAWING_TOOLS,
    TOOL_LABEL: TOOL_LABEL,
    TOOL_HINT: TOOL_HINT,
    FIB_RATIOS: FIB_RATIOS,
    MAX_HISTORY: MAX_HISTORY,

    enable: enable,
    disable: disable,
    setTool: setTool,
    getTool: function () { return tool; },
    effectiveTool: effectiveTool,

    undo: undo,
    redo: redo,
    clear: clear,
    setLocked: setLocked,
    isLocked: function () { return locked; },
    setMagnet: setMagnet,
    isMagnet: function () { return magnetOn; },
    setStyle: setStyle,
    setCandles: setCandles,

    getDrawings: getDrawings,
    setDrawings: setDrawings,
    getSelected: getSelected,
    removeDrawing: removeDrawing,
    removeSelected: removeSelected,
    addDrawing: addDrawing,

    on: on,
    render: render,
    renderTo: renderTo,
    renderToCanvas: renderToCanvas,
    getPaneCanvas: function () { return paneCanvas || resolvePaneCanvas(); },
    getContainer: function () { return container; }
  };

  return api;
});
