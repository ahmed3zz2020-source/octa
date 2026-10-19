/* ══════════════════════════════════════════════════════════════
   📈 شارت OCTA — محرك واحد للذهب والأسهم (١٨ أكتوبر ٢٠٢٦)
   ══════════════════════════════════════════════════════════════
   ✅ Historic chart لكل الأدوات: ذهب + أسهم EGX.
   ⛔ ليه canvas مش iframe؟
      · البيانات عندنا مش عند TradingView (٢٨٥ سهم مصري)
      · السرعة — مافيش ٣ ميجا JS
      · الرسم باللمس + التكبير + الحفظ (إحنا بنحفظ، هم لأ)
      · الـiframe كان بيطلع ١٥٠px على الموبايل وبيكسر
   ⛔ كل رقم من /api/candles أو /api/gold/deep — مافيش تخترع.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CFG = {
    up: '#16a34a', dn: '#dc2626', ma50: '#2563eb', ma200: '#ea580c',
    rsi: '#7c3aed', grid: 'rgba(100,116,139,.16)', txt: '#334155', mut: '#64748b',
    padR: 68, padL: 6, gap: 6, minBars: 22, maxBars: 140
  };

  var S = {
    host: null, cv: null, g: null, tf: '15',
    bars: null, view: 0, cross: null,
    drag: null, pinch: null, zoomN: null, dpr: 1, raf: 0
  };

  /* ── أدوات ── */
  function num(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var n = parseFloat(String(v).replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x0660; }));
    return isFinite(n) ? n : null;
  }
  function fmt(v, d) {
    if (v == null) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: d || 2, maximumFractionDigits: d || 2 });
  }
  function ema(a, n) {
    if (!a.length) return [];
    var k = 2 / (n + 1), o = [a[0]];
    for (var i = 1; i < a.length; i++) o.push(a[i] * k + o[i - 1] * (1 - k));
    return o;
  }
  function rsi(cl, n) {
    if (cl.length < n + 1) return [];
    var g = 0, l = 0, o = new Array(n).fill(null);
    for (var i = 1; i <= n; i++) { var d = cl[i] - cl[i - 1]; if (d >= 0) g += d; else l -= d; }
    g /= n; l /= n;
    o.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
    for (i = n + 1; i < cl.length; i++) {
      var dd = cl[i] - cl[i - 1];
      g = (g * (n - 1) + (dd > 0 ? dd : 0)) / n;
      l = (l * (n - 1) + (dd < 0 ? -dd : 0)) / n;
      o.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
    }
    return o;
  }
  function api() { return window.OCTA_API || ''; }

  /* ── الرسم ── */
  function draw() {
    var h = S.host; if (!h || !S.g) return;
    var W = h.clientWidth || 360, H = h.clientHeight || 440;
    S.dpr = window.devicePixelRatio || 1;
    S.cv.width = Math.round(W * S.dpr); S.cv.height = Math.round(H * S.dpr);
    S.cv.style.width = W + 'px'; S.cv.style.height = H + 'px';
    var g = S.g; g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    var bars = S.bars;
    if (!bars || !bars.length) {
      g.fillStyle = CFG.mut; g.font = '13px system-ui'; g.textAlign = 'center';
      g.fillText('مفيش شموع — استنى ثانية', W / 2, H / 2);
      return;
    }

    var usable = H - CFG.gap * 4;
    var CH = Math.round(usable * 0.62), VOL_H = Math.round(usable * 0.18), RSI_H = Math.round(usable * 0.20);
    var n = Math.max(CFG.minBars, Math.min(bars.length, S.zoomN || CFG.maxBars));
    S.view = Math.max(0, Math.min(S.view, bars.length - n));
    var vis = bars.slice(S.view, S.view + n);
    var plotW = W - CFG.padL - CFG.padR, bw = plotW / n;
    var xP = function (i) { return CFG.padL + i * bw + bw / 2; };

    /* السعر */
    var hi = -Infinity, lo = Infinity;
    vis.forEach(function (b) {
      var H2 = num(b.h), L2 = num(b.l);
      if (H2 != null && H2 > hi) hi = H2;
      if (L2 != null && L2 < lo) lo = L2;
    });
    if (!isFinite(hi) || !isFinite(lo) || hi <= lo) return;
    var pad = (hi - lo) * 0.08; hi += pad; lo -= pad;
    var yP = function (p) {
      if (p == null) return null;
      var y = CFG.gap + (hi - p) / (hi - lo) * (CH - CFG.gap * 2);
      return (y >= -20 && y <= CH + 20) ? y : null;
    };

    /* الشبكة + محور السعر */
    g.font = '9px system-ui'; g.fillStyle = CFG.mut;
    for (var k = 0; k <= 4; k++) {
      var p = lo + (hi - lo) * k / 4, y = Math.round(yP(p)) + 0.5;
      g.strokeStyle = CFG.grid; g.lineWidth = 1;
      g.beginPath(); g.moveTo(CFG.padL, y); g.lineTo(W - CFG.padR, y); g.stroke();
      g.textAlign = 'left'; g.fillText(fmt(p, 0), W - CFG.padR + 5, y + 3);
    }

    /* المتوسطات */
    var allC = bars.map(function (b) { return num(b.c); });
    var e50 = ema(allC, 50), e200 = ema(allC, 200);
    g.lineWidth = 1.5;
    [[e50, CFG.ma50], [e200, CFG.ma200]].forEach(function (sp) {
      g.strokeStyle = sp[1]; g.beginPath(); var st = 0;
      for (var i = 0; i < vis.length; i++) {
        var v = sp[0][S.view + i], y = yP(v);
        if (y == null) continue;
        if (st) g.lineTo(xP(i), y); else { g.moveTo(xP(i), y); st = 1; }
      }
      g.stroke();
    });

    /* الشموع */
    var cw = Math.max(1, Math.min(bw * 0.62, 10));
    vis.forEach(function (b, i) {
      var o = num(b.o), H2 = num(b.h), L2 = num(b.l), c = num(b.c);
      if (o == null || c == null || H2 == null || L2 == null) return;
      g.strokeStyle = g.fillStyle = (c >= o) ? CFG.up : CFG.dn;
      var x = xP(i), yh = yP(H2), yl = yP(L2), y1 = yP(Math.max(o, c)), y2 = yP(Math.min(o, c));
      if (yh == null || yl == null || y1 == null || y2 == null) return;
      g.beginPath(); g.moveTo(Math.round(x) + 0.5, yh); g.lineTo(Math.round(x) + 0.5, yl); g.stroke();
      g.fillRect(Math.round(x - cw / 2), Math.round(y1), Math.ceil(cw), Math.max(1, Math.round(y2 - y1)));
    });

    /* الحجم */
    var vt = CH + CFG.gap, vmax = 0;
    vis.forEach(function (b) { var v = num(b.v || b.volume); if (v != null && v > vmax) vmax = v; });
    if (vmax) vis.forEach(function (b, i) {
      var v = num(b.v || b.volume); if (!v) return;
      var hh = (v / vmax) * (VOL_H - 8), c = num(b.c), o = num(b.o);
      g.fillStyle = (c >= o) ? 'rgba(22,163,74,.35)' : 'rgba(220,38,38,.35)';
      g.fillRect(Math.round(xP(i) - cw / 2), Math.round(vt + VOL_H - hh), Math.ceil(cw), Math.round(hh));
    });

    /* القوة النسبية */
    var rt = vt + VOL_H + CFG.gap, allR = rsi(allC, 14);
    g.fillStyle = CFG.txt; g.font = '10px system-ui'; g.textAlign = 'right';
    var last = allR[allR.length - 1];
    g.fillText('القوة النسبية ' + (last == null ? '—' : Math.round(last)), W - CFG.padR - 4, rt + 11);
    [70, 50, 30].forEach(function (lv) {
      var y = rt + 13 + (100 - lv) / 100 * (RSI_H - 20);
      g.strokeStyle = lv === 50 ? 'rgba(100,116,139,.3)' : 'rgba(100,116,139,.15)';
      g.setLineDash(lv === 50 ? [] : [3, 3]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(CFG.padL, y); g.lineTo(W - CFG.padR, y); g.stroke();
      g.setLineDash([]); g.fillStyle = CFG.mut; g.font = '9px system-ui'; g.textAlign = 'left';
      g.fillText(String(lv), W - CFG.padR + 5, y + 3);
    });
    g.strokeStyle = CFG.rsi; g.lineWidth = 1.5; g.beginPath(); var st2 = 0;
    for (var j = 0; j < vis.length; j++) {
      var rv = allR[S.view + j]; if (rv == null) continue;
      var yy = rt + 13 + (100 - rv) / 100 * (RSI_H - 20);
      if (st2) g.lineTo(xP(j), yy); else { g.moveTo(xP(j), yy); st2 = 1; }
    }
    g.stroke();

    /* خط التقاطع */
    if (S.cross != null && S.cross >= 0 && S.cross < vis.length) {
      var bb = vis[S.cross], cx = xP(S.cross), cc = num(bb.c), cy = yP(cc);
      g.strokeStyle = 'rgba(100,116,139,.5)'; g.setLineDash([4, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, rt + RSI_H); g.stroke(); g.setLineDash([]);
      if (cy != null) {
        g.fillStyle = CFG.txt; g.fillRect(cx - 42, cy - 9, 84, 17);
        g.fillStyle = '#fff'; g.font = '10px system-ui'; g.textAlign = 'center';
        g.fillText(fmt(cc), cx, cy + 3);
      }
    }

    /* العنوان */
    g.fillStyle = CFG.mut; g.font = '10px system-ui'; g.textAlign = 'right';
    g.fillText(S.tf + ' · ' + bars.length + ' شمعة', W - CFG.padR - 2, 11);
  }
  function redraw() {
    if (S.raf) return;
    S.raf = requestAnimationFrame(function () { S.raf = 0; draw(); });
  }

  /* ── التحميل ── */
  function load(which) {
    var url = (which === 'gold')
      ? api() + '/api/gold/deep'
      : api() + '/api/candles/' + which + '?n=300';
    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var b = (which === 'gold') ? (d.bars || {})[S.goldTf || 'M15'] : d.candles;
        if (b && b.length) {
          S.bars = b; S.which = which;
          if (S.view === 0) S.view = Math.max(0, b.length - 90);
          redraw();
        }
      })
      .catch(function () { /* السيرفر واقع — نخلي آخر رسمة */ });
  }

  /* ── اللمس ── */
  function bind() {
    var cv = S.cv;
    function px(e) { var r = cv.getBoundingClientRect(); var t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; }
    function idx(x) {
      if (!S.bars) return -1;
      var W = cv.clientWidth, n = Math.max(CFG.minBars, Math.min(S.bars.length, S.zoomN || CFG.maxBars));
      return Math.max(0, Math.min(n - 1, Math.round((x - CFG.padL) / ((W - CFG.padL - CFG.padR) / n))));
    }
    cv.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        S.pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) };
      } else {
        S.drag = { x: e.touches[0].clientX, v: S.view };
        S.cross = idx(px(e).x); redraw();
      }
    }, { passive: true });

    cv.addEventListener('touchmove', function (e) {
      if (!S.bars) return;
      if (S.pinch && e.touches.length === 2) {
        e.preventDefault();
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        var cur = Math.max(CFG.minBars, Math.min(S.bars.length, S.zoomN || CFG.maxBars));
        S.zoomN = Math.max(CFG.minBars, Math.min(S.bars.length, Math.round(cur * (S.pinch.d / Math.max(1, d)))));
        redraw(); return;
      }
      if (S.drag) {
        e.preventDefault();
        var n = Math.max(CFG.minBars, Math.min(S.bars.length, S.zoomN || CFG.maxBars));
        S.view = Math.round(S.drag.v + (e.touches[0].clientX - S.drag.x) / ((cv.clientWidth - CFG.padL - CFG.padR) / n));
        S.cross = idx(px(e).x); redraw();
      } else { S.cross = idx(px(e).x); redraw(); }
    }, { passive: false });

    cv.addEventListener('touchend', function () {
      if (S.drag) { S.drag = null; setTimeout(function () { S.cross = null; redraw(); }, 2200); }
      S.pinch = null;
    }, { passive: true });

    cv.addEventListener('mousemove', function (e) { S.cross = idx(px(e).x); redraw(); });
    cv.addEventListener('mouseleave', function () { S.cross = null; redraw(); });
    window.addEventListener('resize', redraw);
  }

  /* ── التهيئة ── */
  function init(hostId, which, tf) {
    var host = document.getElementById(hostId || 'gmv-chart'); if (!host) return;
    S.host = host; S.which = which || 'gold';
    if (tf) { if (which === 'gold') S.goldTf = tf; else S.tf = tf; }
    if (!host.querySelector('canvas')) {
      host.innerHTML = '<canvas></canvas>';
      S.cv = host.querySelector('canvas');
      S.g = S.cv.getContext('2d');
      bind();
    } else {
      S.cv = host.querySelector('canvas'); S.g = S.cv.getContext('2d');
    }
    load(S.which);
    redraw();
  }

  window.octaChart = {
    init: init, redraw: redraw, load: load,
    setTf: function (t) {
      if (S.which === 'gold') { S.goldTf = t; } else { S.tf = t; S.view = 0; S.zoomN = null; }
      load(S.which);
    }
  };

  if (document.readyState !== 'loading') { /* ننتظر الـmodal */ }
  else document.addEventListener('DOMContentLoaded', function () {});
  /* ⛔ المودال بيتعمل بعد الصفحة ⇒ نراقب لحد ما #gmv-chart يظهر */
  var _w = setInterval(function () {
    if (document.getElementById('gmv-chart')) { clearInterval(_w); init('gmv-chart', 'gold'); }
  }, 500);
  setTimeout(function () { clearInterval(_w); }, 90000);
})();