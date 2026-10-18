/* ══════════════════════════════════════════════════════════════
   👆 OCTA — إيماءات اللمس (Phase 1 · T3)
   ──────────────────────────────────────────────────────────────
   📌 العقد (§4.5):
      OCTAChart.gest.attach(instance, {onCrosshair, onLongPress})
      • إصبع واحد  = سحب (pan)
      • إصبعين     = تكبير (pinch zoom)
      • ضغط مطوّل  = crosshair باللمس
      • مافيش scroll للصفحة وقت السحب على الشارت
   ──────────────────────────────────────────────────────────────
   📌 الـpan والـpinch الأساسيين بيعملهم lightweight-charts نفسه
      (handleScroll.horzTouchDrag + handleScale.pinch) — احنا بنكمّل
      بس بالـcrosshair باللمس + منع سكرول الصفحة.
   ══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';

  var api = factory();

  root.OCTAChart = root.OCTAChart || {};
  root.OCTAChart.gest = api;

  if (typeof module === 'object' && module.exports) { module.exports = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var LONG_PRESS_MS = 450;   /* مدة الضغط المطوّل */
  var MOVE_TOL = 10;         /* حدود الحركة قبل ماPRESS يتبطل */
  var THEME_CROSS = '#9598a1';

  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* الوقت → 'YYYY-MM-DD' (نفس logic بتاع core) */
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

  function fmtDay(t) {
    if (typeof t !== 'string') return '';
    var p = t.split('-');
    if (p.length !== 3) return t;
    return p[0] + '/' + p[1] + '/' + p[2];
  }

  function fmtNum(x, d) {
    if (!isNum(x)) return '—';
    if (d == null) d = 2;
    var neg = x < 0;
    var s = Math.abs(x).toFixed(d);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + parts.join('.');
  }

  function changePct(o, c) {
    if (!isNum(o) || !isNum(c) || o === 0) return null;
    return ((c - o) / Math.abs(o)) * 100;
  }

  /* ═══════════════════════════════════════════════════════════
     👆 attach
     ═══════════════════════════════════════════════════════════ */
  function attach(instance, opts) {
    opts = opts || {};
    if (!instance || typeof instance.getChart !== 'function') return null;

    var chart = instance.getChart();
    if (!chart) return null;

    var el = (typeof chart.chartElement === 'function') ? chart.chartElement() : null;
    if (!el) return null;

    var host = el.parentNode || el;

    /* منع سكرول الصفحة وقت السحب على الشارت */
    try { host.style.touchAction = 'none'; } catch (e) { }
    try { el.style.touchAction = 'none'; } catch (e) { }
    try { el.style.webkitUserSelect = 'none'; } catch (e) { }
    try { el.style.userSelect = 'none'; } catch (e) { }

    /* ─────────────────────────────────────────────────────
       🧱 طبقة الـcrosshair باللمس
       ───────────────────────────────────────────────────── */
    var layer = document.createElement('div');
    layer.className = 'octa-touch-cross';
    layer.style.position = 'absolute';
    layer.style.inset = '0';
    layer.style.pointerEvents = 'none';
    layer.style.display = 'none';
    layer.style.zIndex = '5';
    host.appendChild(layer);

    var vLine = document.createElement('div');
    vLine.className = 'octa-touch-cross-v';
    vLine.style.position = 'absolute';
    vLine.style.top = '0';
    vLine.style.bottom = '0';
    vLine.style.width = '1px';
    vLine.style.background = THEME_CROSS;

    var hLine = document.createElement('div');
    hLine.className = 'octa-touch-cross-h';
    hLine.style.position = 'absolute';
    hLine.style.left = '0';
    hLine.style.right = '0';
    hLine.style.height = '1px';
    hLine.style.background = THEME_CROSS;

    layer.appendChild(vLine);
    layer.appendChild(hLine);

    var tip = document.createElement('div');
    tip.className = 'octa-chart-tip octa-touch-tip';
    tip.setAttribute('dir', 'rtl');
    tip.style.position = 'absolute';
    tip.style.display = 'none';
    tip.style.pointerEvents = 'none';
    layer.appendChild(tip);

    /* ─────────────────────────────────────────────────────
       📇 خريطة الوقت → الشمعة
       ───────────────────────────────────────────────────── */
    var byTime = {};

    function reindex() {
      byTime = {};
      var list = [];
      try { list = instance.getCandles() || []; } catch (e) { list = []; }
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c && typeof c.t === 'string') byTime[c.t.slice(0, 10)] = c;
      }
    }
    reindex();

    /* ─────────────────────────────────────────────────────
       🖐️ حالة اللمس
       ───────────────────────────────────────────────────── */
    var pressTimer = null;
    var touchMode = false;      /* الضغطة المطوّلة اتفعلت */
    var startX = 0, startY = 0;
    var activeId = null;

    function clearPress() {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    }

    function showCross(x, y) {
      var ts = chart.timeScale();
      var t = null;
      try { t = ts.coordinateToTime(x); } catch (e) { }
      var key = timeKey(t);
      var candle = byTime[key] || null;

      layer.style.display = 'block';
      vLine.style.left = Math.round(x) + 'px';
      hLine.style.top = Math.round(y) + 'px';

      if (candle) {
        tip.textContent = '';
        var head = document.createElement('div');
        head.className = 'octa-chart-tip-head';
        head.textContent = fmtDay(candle.t);
        tip.appendChild(head);
        tip.appendChild(row('افتتاح', fmtNum(candle.o, 2)));
        tip.appendChild(row('أعلى', fmtNum(candle.h, 2)));
        tip.appendChild(row('أدنى', fmtNum(candle.l, 2)));
        tip.appendChild(row('إغلاق', fmtNum(candle.c, 2)));
        var ch = changePct(candle.o, candle.c);
        if (ch == null) {
          tip.appendChild(row('التغير', '—'));
        } else {
          var sign = ch > 0 ? '+' : '';
          tip.appendChild(row('التغير', sign + fmtNum(ch, 2) + '%', ch >= 0 ? 'is-up' : 'is-down'));
        }
        tip.appendChild(row('الحجم', fmtNum(candle.v, 0)));

        var w = host.clientWidth;
        var h = host.clientHeight;
        var tw = tip.offsetWidth || 170;
        var th = tip.offsetHeight || 160;
        var left = x + 16;
        var top = y + 16;
        if (left + tw > w - 8) left = x - tw - 16;
        if (left < 8) left = 8;
        if (top + th > h - 8) top = y - th - 16;
        if (top < 8) top = 8;
        tip.style.left = Math.round(left) + 'px';
        tip.style.top = Math.round(top) + 'px';
        tip.style.display = 'block';
      } else {
        tip.style.display = 'none';
      }

      if (typeof opts.onCrosshair === 'function') {
        try { opts.onCrosshair({ time: key, candle: candle, point: { x: x, y: y }, touch: true }); } catch (e) { }
      }
    }

    function row(label, value, cls) {
      var r = document.createElement('div');
      r.className = 'octa-chart-tip-row' + (cls ? ' ' + cls : '');
      var s = document.createElement('span');
      s.className = 'octa-chart-tip-label';
      s.textContent = label;
      var v = document.createElement('b');
      v.className = 'octa-chart-tip-value';
      v.textContent = value;
      r.appendChild(s);
      r.appendChild(v);
      return r;
    }

    function hideCross() {
      layer.style.display = 'none';
      tip.style.display = 'none';
    }

    function localPoint(e) {
      var r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    /* ─────────────────────────────────────────────────────
       🖱️ pointerdown
       ───────────────────────────────────────────────────── */
    function onDown(e) {
      if (e.pointerType === 'mouse') return;   /* الماوس بيتعامل معاه الـchart لوحده */
      if (activeId !== null) return;            /* إصبع تاني = الـpinch بتاع الـlibrary */

      activeId = e.pointerId;
      touchMode = false;
      startX = e.clientX;
      startY = e.clientY;

      clearPress();
      pressTimer = setTimeout(function () {
        pressTimer = null;
        if (activeId === null) return;
        touchMode = true;
        var p = localPoint(e);
        showCross(p.x, p.y);
        if (typeof opts.onLongPress === 'function') {
          try { opts.onLongPress({ x: p.x, y: p.y, pointerId: e.pointerId }); } catch (err) { }
        }
      }, LONG_PRESS_MS);
    }

    function onMove(e) {
      if (e.pointerType === 'mouse') return;

      if (e.pointerId !== activeId) return;

      var moved = Math.abs(e.clientX - startX) > MOVE_TOL || Math.abs(e.clientY - startY) > MOVE_TOL;

      if (!touchMode) {
        if (moved) clearPress();   /* ده سحب مش ضغط مطوّل */
        return;
      }

      e.preventDefault();
      var p = localPoint(e);
      showCross(p.x, p.y);
    }

    function onUp(e) {
      if (e.pointerType === 'mouse') return;
      if (e.pointerId !== activeId) return;
      clearPress();
      activeId = null;
      if (touchMode) {
        touchMode = false;
        hideCross();
        if (typeof opts.onCrosshair === 'function') {
          try { opts.onCrosshair(null); } catch (err) { }
        }
      }
    }

    /* منع سكرول الصفحة أثناء السحب على الشارت */
    function onTouchMove(e) {
      if (e.touches && e.touches.length > 0) {
        var inside = el.contains(e.target);
        if (inside && e.cancelable) e.preventDefault();
      }
    }

    el.addEventListener('pointerdown', onDown, { passive: true });
    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', onUp, { passive: true });
    el.addEventListener('pointercancel', onUp, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });

    /* إعادة بناء الخريطة لما الشموع تتغير */
    var unwatch = null;
    if (typeof instance.on === 'function') {
      unwatch = instance.on('crosshair', function () { });
    }
    var origSet = instance.setCandles;
    if (typeof origSet === 'function') {
      instance.setCandles = function (candles, tf) {
        var r = origSet.call(instance, candles, tf);
        reindex();
        return r;
      };
    }

    return {
      detach: function () {
        clearPress();
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
        el.removeEventListener('touchmove', onTouchMove);
        if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
        if (unwatch) { try { unwatch(); } catch (e) { } }
      }
    };
  }

  return {
    attach: attach,
    LONG_PRESS_MS: LONG_PRESS_MS
  };
});
