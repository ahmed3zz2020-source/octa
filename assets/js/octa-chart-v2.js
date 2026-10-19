/* 📈 شارت الذهب — canvas خالص (١٨ أكتوبر ٢٠٢٦) */
(function () {
  'use strict';
  var GAP = 4, PAD_L = 4, PAD_R = 66;
  var TF = { 'M5': '٥د', 'M15': '١٥د', 'H1': 'ساعة', 'H4': '٤س', 'D1': 'يوم', 'S': 'يومي' };
  var st = { tf: 'M15', bars: null, view: 0, dpr: 1, cross: null, dragging: false, x0: 0, v0: 0, zoomN: null, pinch: null };

  /* ⛔ tnum ترجّع رقم حقيقي — النسخة القديمة كانت ترجّع نص والـMath بيطلع NaN */
  function tnum(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s2 = String(v).replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x0660; });
    var n = parseFloat(s2);
    return isFinite(n) ? n : null;
  }
  function fmt(v, n) {
    if (v == null || !isFinite(v)) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: n || 2, maximumFractionDigits: n || 2 });
  }
  function ema(vals, n) {
    if (!vals.length) return [];
    var k = 2 / (n + 1), out = [vals[0]];
    for (var i = 1; i < vals.length; i++) out.push(vals[i] * k + out[i - 1] * (1 - k));
    return out;
  }
  function rsi(cl, n) {
    if (cl.length < n + 1) return [];
    var g = 0, l = 0, out = new Array(n).fill(null);
    for (var i = 1; i <= n; i++) { var d = cl[i] - cl[i - 1]; if (d >= 0) g += d; else l -= d; }
    g /= n; l /= n;
    out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
    for (i = n + 1; i < cl.length; i++) {
      var dd = cl[i] - cl[i - 1];
      g = (g * (n - 1) + (dd > 0 ? dd : 0)) / n;
      l = (l * (n - 1) + (dd < 0 ? -dd : 0)) / n;
      out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
    }
    return out;
  }

  function draw() {
    var host = document.getElementById('gmv-chart'); if (!host) return;
    var cv = host.querySelector('canvas'); if (!cv) return;
    var W = host.clientWidth || 360, H = host.clientHeight || 440;
    var dpr = st.dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    var bars = st.bars && st.bars[st.tf];
    if (!bars || !bars.length) {
      /* ⛔ إصلاح ١٨ أكتوبر ٢٠٢٦: الرسم القديم (الذهب) كان بيفضل على الـcanvas
         لأن draw بترجع قبل ما تمسح. الـclearRect فوق بيحط الاستا��ة بس.
         ✅ دلوقتي: message واضح + مافيش بيانات قديمة. */
      g.fillStyle = '#64748b'; g.font = '13px system-ui'; g.textAlign = 'center';
      g.fillText(st.mode === 'stock'
        ? ('بجيب شموع ' + (STOCK_CODE || '') + '…')
        : 'مفيش شموع — استنى ثانية', W / 2, H / 2);
      return;
    }

    var usable = H - GAP * 4;
    var CH = Math.round(usable * 0.62), VOL_H = Math.round(usable * 0.18), RSI_H = Math.round(usable * 0.20);
    var plotW = W - PAD_L - PAD_R;
    var viewN = Math.max(20, Math.min(bars.length, 120));
    st.view = Math.max(0, Math.min(st.view, bars.length - viewN));
    var vis = bars.slice(st.view, st.view + viewN);
    var bw = plotW / viewN;

    var UP = '#16a34a', DN = '#dc2626', GRID = 'rgba(100,116,139,.16)', MUT = '#64748b';

    var hi = -Infinity, lo = Infinity;
    vis.forEach(function (b) {
      var h = tnum(b.h), l = tnum(b.l);
      if (h != null && h > hi) hi = h;
      if (l != null && l < lo) lo = l;
    });
    if (!isFinite(hi) || !isFinite(lo) || hi <= lo) return;
    var pad = (hi - lo) * 0.08; hi += pad; lo -= pad;
    var yP = function (p) {
      if (p == null) return null;
      var y = GAP + (hi - p) / (hi - lo) * (CH - GAP * 2);
      return (y >= -20 && y <= CH + 20) ? y : null;
    };
    var xP = function (i) { return PAD_L + i * bw + bw / 2; };

    var allC = bars.map(function (b) { return tnum(b.c); });
    var e50 = ema(allC, 50), e200 = ema(allC, 200);

    g.strokeStyle = GRID; g.lineWidth = 1; g.font = '9px system-ui'; g.fillStyle = MUT;
    for (var k = 0; k <= 4; k++) {
      var p = lo + (hi - lo) * k / 4, y = Math.round(yP(p)) + 0.5;
      if (y < 0 || y > CH) continue;
      g.beginPath(); g.moveTo(PAD_L, y); g.lineTo(W - PAD_R, y); g.stroke();
      g.textAlign = 'left'; g.fillText(fmt(p, 0), W - PAD_R + 4, y + 3);
    }

    var cw = Math.max(1, Math.min(bw * 0.62, 9));
    vis.forEach(function (b, i) {
      var o = tnum(b.o), h = tnum(b.h), l = tnum(b.l), c = tnum(b.c);
      if (o == null || h == null || l == null || c == null) return;
      var x = xP(i), yh = yP(h), yl = yP(l);
      var y1 = yP(Math.max(o, c)), y2 = yP(Math.min(o, c));
      if (yh == null || yl == null || y1 == null || y2 == null) return;
      g.strokeStyle = g.fillStyle = (c >= o) ? UP : DN;
      g.beginPath(); g.moveTo(Math.round(x) + 0.5, yh); g.lineTo(Math.round(x) + 0.5, yl); g.stroke();
      g.fillRect(Math.round(x - cw / 2), Math.round(y1), Math.ceil(cw), Math.max(1, Math.round(y2 - y1)));
    });

    g.lineWidth = 1.6;
    [['e50', '#2563eb'], ['e200', '#ea580c']].forEach(function (sp) {
      var arr = sp[0] === 'e50' ? e50 : e200;
      g.strokeStyle = sp[1]; g.beginPath(); var stt = 0;
      for (var i = 0; i < vis.length; i++) {
        var v = arr[st.view + i]; if (v == null) continue;
        var y = yP(v); if (y == null) continue;
        var x = xP(i);
        if (stt) g.lineTo(x, y); else { g.moveTo(x, y); stt = 1; }
      }
      g.stroke();
    });

    var volTop = CH + GAP, vmax = 0;
    vis.forEach(function (b) { var v = tnum(b.v) || 0; if (v > vmax) vmax = v; });
    if (vmax) vis.forEach(function (b, i) {
      var v = tnum(b.v) || 0, hgt = (v / vmax) * (VOL_H - 8);
      g.fillStyle = (tnum(b.c) >= tnum(b.o)) ? 'rgba(22,163,74,.35)' : 'rgba(220,38,38,.35)';
      g.fillRect(Math.round(xP(i) - cw / 2), Math.round(volTop + VOL_H - hgt), Math.ceil(cw), Math.round(hgt));
    });

    var rTop = volTop + VOL_H + GAP;
    var allR = rsi(allC, 14), last = allR[allR.length - 1];
    g.fillStyle = '#334155'; g.font = '10px system-ui'; g.textAlign = 'right';
    g.fillText('القوة النسبية ' + (last == null ? '—' : Math.round(last)), W - PAD_R - 4, rTop + 12);
    [70, 50, 30].forEach(function (lv) {
      var y = rTop + 14 + (100 - lv) / 100 * (RSI_H - 22);
      g.strokeStyle = lv === 50 ? 'rgba(100,116,139,.3)' : 'rgba(100,116,139,.16)';
      g.setLineDash(lv === 50 ? [] : [3, 3]);
      g.beginPath(); g.moveTo(PAD_L, y); g.lineTo(W - PAD_R, y); g.stroke(); g.setLineDash([]);
      g.fillStyle = MUT; g.font = '9px system-ui'; g.textAlign = 'left';
      g.fillText(String(lv), W - PAD_R + 4, y + 3);
    });
    g.strokeStyle = '#7c3aed'; g.lineWidth = 1.5; g.beginPath(); var s2 = 0;
    for (var j = 0; j < vis.length; j++) {
      var rv = allR[st.view + j]; if (rv == null) continue;
      var yy = rTop + 14 + (100 - rv) / 100 * (RSI_H - 22), xx = xP(j);
      if (s2) g.lineTo(xx, yy); else { g.moveTo(xx, yy); s2 = 1; }
    }
    g.stroke();

    if (st.cross != null && st.cross >= 0 && st.cross < vis.length) {
      var i2 = st.cross, cx = xP(i2), bb = vis[i2];
      g.strokeStyle = 'rgba(100,116,139,.5)'; g.setLineDash([4, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, rTop + RSI_H); g.stroke(); g.setLineDash([]);
      var lbl = fmt(tnum(bb.c), 2), yy2 = yP(tnum(bb.c));
      if (yy2 != null) {
        g.fillStyle = '#334155'; g.fillRect(cx - 40, yy2 - 9, 80, 16);
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(lbl, cx, yy2 + 3);
      }
    }

    var lb = vis[vis.length - 1];
    if (lb) { g.fillStyle = MUT; g.font = '10px system-ui'; g.textAlign = 'right';
      g.fillText(TF[st.tf] + ' · آخر تحديث ' + (lb.t || ''), W - PAD_R - 2, 11); }
  }

  function load() {
    if (!window.OCTA_API) window.OCTA_API = '';
    fetch(window.OCTA_API + '/api/gold/deep', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.bars && d.bars[st.tf] && d.bars[st.tf].length) {
          st.bars = d.bars;
          if (st.view === 0) st.view = Math.max(0, st.bars[st.tf].length - 90);
          draw();
        }
      }).catch(function () {});
  }

  function bind() {
    var host = document.getElementById('gmv-chart'); if (!host) return;
    var cv = host.querySelector('canvas'); if (!cv) return;
    function px(e) { var r = cv.getBoundingClientRect(); var t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left }; }
    function idx(x) {
      var bars = st.bars && st.bars[st.tf]; if (!bars) return -1;
      var W = cv.clientWidth, n = st.zoomN || Math.max(20, Math.min(bars.length, 120));
      var bw = (W - PAD_L - PAD_R) / n;
      return Math.max(0, Math.min(n - 1, Math.round((x - PAD_L) / bw)));
    }
    cv.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        st.pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) };
      } else { st.dragging = true; st.x0 = e.touches[0].clientX; st.v0 = st.view; st.cross = idx(px(e).x); draw(); }
    }, { passive: true });
    cv.addEventListener('touchmove', function (e) {
      var bars = st.bars && st.bars[st.tf]; if (!bars) return;
      if (st.pinch && e.touches.length === 2) {
        e.preventDefault();
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        var cur = Math.max(20, Math.min(bars.length, 120));
        st.zoomN = Math.max(20, Math.min(bars.length, Math.round(cur * (st.pinch.d / Math.max(1, d)))));
        draw(); return;
      }
      if (st.dragging) { e.preventDefault();
        var W = cv.clientWidth, n = st.zoomN || Math.max(20, Math.min(bars.length, 120));
        var bw = (W - PAD_L - PAD_R) / n;
        st.view = Math.round(st.v0 + (e.touches[0].clientX - st.x0) / bw);
        st.cross = idx(px(e).x); draw();
      } else { st.cross = idx(px(e).x); draw(); }
    }, { passive: false });
    cv.addEventListener('touchend', function (e) {
      if (!e.touches || !e.touches.length) { st.dragging = false; st.pinch = null; st.zoomN = null;
        setTimeout(function () { st.cross = null; draw(); }, 2200); }
    }, { passive: true });
    cv.addEventListener('mousemove', function (e) { st.cross = idx(px(e).x); draw(); });
    cv.addEventListener('mouseleave', function () { st.cross = null; draw(); });
    window.addEventListener('resize', function () { draw(); });
  }

  /* ⛔ إصلاح ١٨ أكتوبر ٢٠٢٦ — فصل إنشاء الـcanvas عن تحميل البيانات.
     كنا بنحمّل الذهب ونحط الـcanvas في نفس الوقت ⇒ لو We're سهم
     كانت بيانات الذهب بتتوسط فوق بيانات السهم. */
  var S_HOST_CANVAS = false;
  function ensureCanvas() {
    var host = document.getElementById('gmv-chart'); if (!host) return false;
    if (!host.querySelector('canvas')) { host.innerHTML = '<canvas></canvas>'; bind(); }
    var cv = host.querySelector('canvas'); if (!cv) return false;
    S_HOST_CANVAS = true;
    S_CV = cv; S_CTX = cv.getContext('2d');
    /* FIX 18-10-2026: هنا كان فيه draw() — بترسم الرسم القديم (الذهب)
       على نفس الـcanvas. دلوقتي: مسح كامل بس. */
    var dpr = window.devicePixelRatio || 1;
    cv.width = Math.round((cv.clientWidth || 360) * dpr);
    cv.height = Math.round((cv.clientHeight || 440) * dpr);
    var g0 = cv.getContext('2d');
    g0.setTransform(1, 0, 0, 1, 0, 0);
    g0.clearRect(0, 0, cv.width, cv.height);
    return true;
  }

  function init() {
    var host = document.getElementById('gmv-chart'); if (!host) return;
    if (host.querySelector('canvas')) { draw(); load(); return; }
    host.innerHTML = '<canvas></canvas>';
    bind(); draw(); load();
  }

  /* ═══ الأسهم: نفس المحرك · مصدر البيانات مختلف ═══
     ⛔ الذهب: /api/gold/deep → bars[TF]
     ⛌ السهم: /api/candles/<CODE>?n=300 → candles
     ✅ نفس الـcanvas · نفس الأدوات · نفس اللمس */
  var STOCK_CODE = null;
  function loadStock(code) {
    STOCK_CODE = String(code || '').toUpperCase();
    /* FIX 18-10-2026: log واضح — لو code فاضي أو الـfetch مش راجع
       كنت بتدوّر في الكاش/browser cache ساعات. */
    if (!STOCK_CODE) {
      var hh = document.getElementById('gmv-chart');
      if (hh) hh.innerHTML = '<div class="gempty">مافيش كود سهم</div>';
      return;
    }
    if (!window.OCTA_API) window.OCTA_API = '';
    fetch(window.OCTA_API + '/api/candles/' + STOCK_CODE + '?n=300', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.candles && d.candles.length) {
          /* ⛔ بسيط: نحط شموع السهم مكان الذهب — مافيش تبديل معقّد.
             st.tf بيظل زي ما هو ('15') لأن شموع السهم مش مقسّمة فريمات. */
          st.bars = { S: d.candles };
          st.tf = 'S';
          st.mode = 'stock';
          st.view = Math.max(0, d.candles.length - 90);
          draw();
        }
      }).catch(function () {
        var h = document.getElementById('gmv-chart');
        if (h) h.innerHTML = '<div class="gempty">تعذّر جلب شموع ' + STOCK_CODE + '</div>';
      });
  }

  function initStock(code) { if (!code) return; st.stock = null; st.view = 0; loadStock(code); }

  window.octaGoldChart = {
    init: function (hostId, which, code, tf) {
      /* ⛔ إصلاح ١٨ أكتوبر ٢٠٢٦: init() كانت بتنادي load() اللي بتحمّل
         الذهب الأول، وبعدين loadStock() بتحمّل السهم — والنتيجة إن
         الشارت بيعرض أسعار الذهب (٤١٦٤) على سهم سعره ١٢٥ جنيه.
         ✅ دلوقتي: لو We're سهم ⇒ متحمّلش الذهب خالص. */
      if (which === 'stock') {
        if (!S_HOST_CANVAS) ensureCanvas();
        st.mode = 'stock'; st.view = 0; st.zoomN = null;
        loadStock(code);
        return;
      }
      ensureCanvas();
      load();
    },
    redraw: function () { draw(); },
    setTf: function (k) {
      if (st.mode === 'stock') return;   /* ⛔ السهم: الفريمات مش متاحة */
      st.tf = k; st.view = 0; st.zoomN = null; draw(); load();
    },
    setStockTf: function (k) {
      /* ⛔ السهم مصدره /api/candles بيوم واحد بس — الفريمات مش متاحة.
         ⛌ الزر بيفتح رسالة صريحة بدل ما يعرض أرقام غلط. */
      if (k === '15') { st.view = Math.max(0, st.bars.S.length - 90); draw(); return; }
      var h = document.getElementById('gmv-chart');
      if (h) {
        var note = h.querySelector('.gempty');
        if (!note) {
          note = document.createElement('div');
          note.className = 'gempty';
          note.style.cssText = 'position:absolute;top:10px;left:0;right:0;text-align:center;font-size:.76rem;background:rgba(15,23,42,.72);padding:5px;border-radius:8px;color:#d97706';
          note.textContent = '⛔ الفريم ده مش متاح — المصدر بيرجّع شموع يومية بس';
          h.appendChild(note);
          setTimeout(function () { if (note.parentNode) note.remove(); }, 3500);
        }
      }
    },
    initStock: initStock
  };
  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
  /* ⛔ المودال بيتعمل بعد الـDOMContentLoaded ⇒ مراقب لحد ما يظهر */
  var _w = setInterval(function () {
    var h = document.getElementById('gmv-chart');
    if (h && !h.querySelector('canvas')) { init(); clearInterval(_w); }
  }, 400);
  setTimeout(function () { clearInterval(_w); }, 60000);
})();
