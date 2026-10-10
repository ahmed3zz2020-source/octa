/* ══════════════════════════════════════════════════════════════
   📊 شارت TradingView — الشارت الرسمي الاحترافي
   ------------------------------------------------------------
   شموع · أدوات رسم · 90+ مؤشر · SMA200 · إدارة مخاطر
   ══════════════════════════════════════════════════════════════ */

(function () {

  const MK_TG = { egypt: 'EGX', us: 'NASDAQ', saudi: 'TADAWUL', uae: 'DFM' };
  const TV_WIDGET = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';

  let CURRENT = { code: null, name: null, mk: 'egypt', simple: false, tv: null };

  function symbolOf(code, mk) {
    return (MK_TG[mk] || 'EGX') + ':' + code;
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF\u4e00-\u9fff\u0400-\u04FF\ufffd]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ══════════════════════════════════════════════════════════════
     📊 الشارت الرئيسي — TradingView
     ══════════════════════════════════════════════════════════════ */
  window.openChart = function (code, nameAr, market, tvSymbol) {
    const mk = market || window.__scMarket || 'egypt';
    CURRENT = { code: code, name: nameAr || '', mk: mk, simple: false, tv: tvSymbol || null };
    window.__scMarket = mk;

    const old = document.getElementById('chModal');
    if (old) old.remove();

    const wrap = document.createElement('div');
    wrap.id = 'chModal';
    wrap.className = 'ch-modal';
    wrap.innerHTML =
      '<div class="ch-box">' +

        '<div class="ch-head">' +
          '<div class="ch-t">' +
            '<b>' + esc(code) + '</b>' +
            (nameAr ? '<span>' + esc(nameAr) + '</span>' : '') +
          '</div>' +
          '<div class="ch-links">' +
            '<a class="ch-lb" target="_blank" rel="noopener" href="https://www.tradingview.com/chart/?symbol=' +
              encodeURIComponent(tvSymbol || symbolOf(code, mk)) + '" title="افتح في TradingView">↗</a>' +
            '<button class="ch-lb" onclick="chFull()" title="ملء الشاشة (F)">⛶</button>' +
            '<button class="ch-lb" onclick="closeChart()" title="اقفل (Esc)">✕</button>' +
          '</div>' +
        '</div>' +

        '<div class="ch-tv-wrap" id="chTvWrap">' +
          '<div id="chTv" class="tradingview-widget-container">' +
            '<div id="chTvInner" class="tradingview-widget-container__widget"></div>' +
            '<div class="tradingview-widget-copyright"></div>' +
          '</div>' +
        '</div>' +

        '<div class="ch-foot">' +
          '<span>💡 اسحب بإيدك · قرّب بإصبعين · الأدوات فوق الشارت مباشرة · F = ملء الشاشة</span>' +
        '</div>' +

      '</div>';

    document.body.appendChild(wrap);

    const cfg = {
      autosize: true,
      symbol: tvSymbol || symbolOf(code, mk),
      interval: 'D',
      timezone: 'Africa/Cairo',
      theme: (document.body.classList.contains('light')) ? 'light' : 'dark',
      style: '1',
      locale: 'ar',
      backgroundColor: 'rgba(10, 25, 41, 0)',
      gridColor: 'rgba(255,255,255,.06)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: true,
      withdateranges: true,
      details: false,
      hotlist: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
      loading_screen: { backgroundColor: '#0a1929', foregroundColor: '#d4af37' },
      overrides: {
        'paneProperties.background': 'rgba(10,25,41,0)',
        'paneProperties.backgroundType': 'solid',
        'scalesProperties.textColor': '#8b9eb0',
        'mainSeriesProperties.candleStyle.upColor': '#7dd3a8',
        'mainSeriesProperties.candleStyle.downColor': '#e8a0a0',
        'mainSeriesProperties.candleStyle.borderUpColor': '#7dd3a8',
        'mainSeriesProperties.candleStyle.borderDownColor': '#e8a0a0',
        'mainSeriesProperties.candleStyle.wickUpColor': '#7dd3a8',
        'mainSeriesProperties.candleStyle.wickDownColor': '#e8a0a0'
      },
      studies: [{ name: 'SMA', id: 'study_SMA_200', overlay: true }]
    };

    mountTV(cfg);
    bindKeys();
  };

  /* ── تركيب الـwidget ── */
  function mountTV(cfg) {
    const holder = document.getElementById('chTvInner');
    if (!holder) return;
    holder.innerHTML = '';

    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container';
    inner.style.height = '100%';

    const script = document.createElement('script');
    script.src = TV_WIDGET;
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify(cfg);

    inner.appendChild(script);
    holder.appendChild(inner);
  }

  /* ── ملء الشاشة ── */
  window.chFull = function () {
    const box = document.querySelector('.ch-box');
    if (!box) return;
    if (box.classList.contains('ch-fs')) {
      box.classList.remove('ch-fs');
      document.body.style.overflow = '';
    } else {
      box.classList.add('ch-fs');
      document.body.style.overflow = 'hidden';
    }
  };

  /* ══════════════════════════════════════════════════════════════
     📉 الشارت البسيط — شموع OCTA (محلي)
     ══════════════════════════════════════════════════════════════ */
  let SV = null, SX = null, scData = [], smaOn = true, smaLen = 200;
  let scOverlays = [], scTool = 'cursor', scDrag = null, scMouse = null, scCross = false;
  /* OCTA_API بييجي من octa-api.js */

  window.openSimpleChart = function (code, nameAr, market) {
    const mk = market || window.__scMarket || 'egypt';
    window.__scMarket = mk;

    const old = document.getElementById('chModal');
    if (old) old.remove();

    const wrap = document.createElement('div');
    wrap.id = 'chModal';
    wrap.className = 'ch-modal';
    wrap.innerHTML =
      '<div class="ch-box">' +
        '<div class="ch-head">' +
          '<div class="ch-t">' +
            '<b>' + esc(code) + '</b>' +
            (nameAr ? '<span>' + esc(nameAr) + '</span>' : '') +
          '</div>' +
          '<div class="ch-links">' +
            '<button class="ch-lb on" onclick="chSwitch(1)" title="الشارت البسيط">📉</button>' +
            '<button class="ch-lb" onclick="chSwitch(0)" title="شارت TradingView">📊</button>' +
            '<button class="ch-lb" onclick="chFull()" title="ملء الشاشة">⛶</button>' +
            '<button class="ch-lb" onclick="closeChart()" title="اقفل">✕</button>' +
          '</div>' +
        '</div>' +

        '<div class="ch-bar">' +
          '<div class="ch-grp">' +
            '<button class="ch-b on" data-t="cursor" onclick="scTool2(\'cursor\')">✥</button>' +
            '<button class="ch-b" data-t="hline" onclick="scTool2(\'hline\')">━</button>' +
            '<button class="ch-b" data-t="rect" onclick="scTool2(\'rect\')">▭</button>' +
            '<button class="ch-b" data-t="fib" onclick="scTool2(\'fib\')">≣</button>' +
          '</div>' +
          '<div class="ch-grp">' +
            '<button class="ch-b on" id="scSma" onclick="scToggleSma()">SMA200</button>' +
            '<button class="ch-b" onclick="scSmaLen()">SMA ▾</button>' +
            '<button class="ch-b" onclick="scClear()">🗑</button>' +
          '</div>' +
        '</div>' +

        '<div class="ch-canvas-wrap"><canvas id="scCv"></canvas>' +
        '<div class="ch-hint" id="scHint"></div></div>' +

        '<div class="ch-foot">' +
          '<span>💡 اسحب للتحريك · أدوات الرسم فوق</span>' +
          '<span id="scInfo"></span>' +
        '</div>' +
      '</div>';

    document.body.appendChild(wrap);

    SV = document.getElementById('scCv');
    SX = SV.getContext('2d');
    bindSimple();
    loadSimple(code);
    bindKeys();
  };

  /* ── تبديل بين الشارتين ── */
  window.chSwitch = function (simple) {
    const c = CURRENT.code;
    if (!c) { window.closeChart(); return; }
    window.closeChart();
    if (simple) window.openSimpleChart(c, CURRENT.name, CURRENT.mk);
    else window.openChart(c, CURRENT.name, CURRENT.mk);
  };

  /* ── جلب الشموع ── */
  function loadSimple(code) {
    const hint = document.getElementById('scHint');
    hint.textContent = '⏳ بنجيب الشموع...';
    fetch(OCTA_API + '/api/candles/' + encodeURIComponent(code) + '?n=320')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok || !j.candles || !j.candles.length) {
          hint.innerHTML = '<div class="ch-nod">⛔<br>مفيش شموع</div>';
          return;
        }
        scData = j.candles;
        hint.textContent = '';
        scOverlays = [];
        drawSimple();
      })
      .catch(function () {
        hint.innerHTML = '<div class="ch-nod">⛔<br>مفيش اتصال</div>';
      });
  }

  /* ── حساب SMA ── */
  function calcSma(d, n) {
    const out = new Array(d.length).fill(null);
    let sum = 0;
    for (let i = 0; i < d.length; i++) {
      sum += d[i].c;
      if (i >= n) sum -= d[i - n].c;
      if (i >= n - 1) out[i] = sum / n;
    }
    return out;
  }

  /* ── الرسم ── */
  function drawSimple() {
    if (!SV || !scData.length) return;
    const dpr = window.devicePixelRatio || 1;
    const W = SV.parentElement.clientWidth, H = SV.parentElement.clientHeight;
    SV.width = W * dpr; SV.height = H * dpr;
    SV.style.width = W + 'px'; SV.style.height = H + 'px';
    SX.setTransform(dpr, 0, 0, dpr, 0, 0);
    SX.clearRect(0, 0, W, H);

    const PR = 58, PL = 8, PT = 14, PB = 22;
    const cw = W - PL - PR, ch = H - PT - PB;

    let lo = Infinity, hi = -Infinity;
    scData.forEach(function (c) { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); });
    let sm = null;
    if (smaOn) {
      sm = calcSma(scData, smaLen);
      sm.forEach(function (v) { if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    }
    const pd = (hi - lo) * 0.06 || 1;
    lo -= pd; hi += pd;

    const n = scData.length;
    const bw = cw / n;
    const Y = p => PT + (hi - p) / (hi - lo) * ch;
    const X = i => PL + i * bw + bw / 2;

    /* شبكة */
    SX.strokeStyle = 'rgba(255,255,255,.055)'; SX.lineWidth = 1;
    SX.fillStyle = '#6b7f93'; SX.font = '10px system-ui,sans-serif'; SX.textAlign = 'left';
    for (let i = 0; i <= 5; i++) {
      const p = lo + (hi - lo) * i / 5, y = Y(p);
      SX.beginPath(); SX.moveTo(PL, y); SX.lineTo(W - PR, y); SX.stroke();
      SX.fillText(p.toFixed(2), W - PR + 5, y + 3.5);
    }

    /* شموع */
    const bw2 = Math.max(1.2, bw * 0.68);
    scData.forEach(function (c, i) {
      const x = X(i), up = c.c >= c.o;
      const col = up ? '#7dd3a8' : '#e8a0a0';
      SX.strokeStyle = col; SX.lineWidth = 1;
      SX.beginPath(); SX.moveTo(x, Y(c.h)); SX.lineTo(x, Y(c.l)); SX.stroke();
      const yo = Y(c.o), yc = Y(c.c);
      const top = Math.min(yo, yc), hh = Math.max(1.2, Math.abs(yc - yo));
      SX.fillStyle = up ? 'rgba(125,211,168,.32)' : 'rgba(232,160,160,.32)';
      SX.fillRect(x - bw2 / 2, top, bw2, hh);
      SX.strokeRect(x - bw2 / 2, top, bw2, hh);
    });

    /* SMA */
    if (smaOn && sm) {
      SX.strokeStyle = '#f0c040'; SX.lineWidth = 1.6; SX.beginPath();
      let st = false;
      for (let i = 0; i < n; i++) {
        if (sm[i] == null) continue;
        const x = X(i), y = Y(sm[i]);
        if (!st) { SX.moveTo(x, y); st = true; } else SX.lineTo(x, y);
      }
      SX.stroke();
      SX.fillStyle = '#f0c040'; SX.font = '700 10px system-ui,sans-serif';
      SX.fillText('SMA' + smaLen, PL + 4, PT + 12);
    }

    /* آخر سعر */
    const lc = scData[n - 1].c;
    SX.strokeStyle = 'rgba(240,196,64,.35)'; SX.setLineDash([3, 3]);
    SX.beginPath(); SX.moveTo(PL, Y(lc)); SX.lineTo(W - PR, Y(lc)); SX.stroke();
    SX.setLineDash([]);
    SX.fillStyle = '#f0c040'; SX.font = '700 10px system-ui,sans-serif';
    SX.fillText(lc.toFixed(2), W - PR + 5, Y(lc) + 3.5);

    /* التراكبات */
    scOverlays.forEach(function (o) {
      const col = o.type === 'hline' ? '#f0c040' : '#5ea9ff';
      SX.strokeStyle = col; SX.lineWidth = 1.3;
      if (o.type === 'hline') {
        SX.setLineDash([5, 4]);
        SX.beginPath(); SX.moveTo(PL, o.y); SX.lineTo(W - PR, o.y); SX.stroke();
        SX.setLineDash([]);
      } else {
        const x1 = Math.min(o.x1, o.x2), x2 = Math.max(o.x1, o.x2);
        const y1 = Math.min(o.y1, o.y2), y2 = Math.max(o.y1, o.y2);
        if (o.type === 'fib') {
          const hh = y2 - y1;
          [.236, .382, .5, .618, .786].forEach(function (f, i2) {
            SX.strokeStyle = i2 === 2 ? '#f0c040' : 'rgba(94,169,255,.45)';
            SX.beginPath(); SX.moveTo(x1, y1 + hh * f); SX.lineTo(x2, y1 + hh * f); SX.stroke();
          });
        } else {
          SX.fillStyle = col + '20';
          SX.fillRect(x1, y1, x2 - x1, y2 - y1);
          SX.strokeRect(x1, y1, x2 - x1, y2 - y1);
        }
      }
    });

    /* معاينة السحب */
    if (scTool !== 'cursor' && scDrag) {
      const col = scTool === 'hline' ? '#f0c040' : '#5ea9ff';
      SX.strokeStyle = col; SX.lineWidth = 1.2; SX.setLineDash([4, 3]);
      if (scTool === 'hline') {
        SX.beginPath(); SX.moveTo(PL, scDrag.sy); SX.lineTo(W - PR, scDrag.sy); SX.stroke();
      } else {
        SX.strokeRect(scDrag.sx, scDrag.sy, scDrag.ex - scDrag.sx, scDrag.ey - scDrag.sy);
      }
      SX.setLineDash([]);
    }

    /* خط التتبع */
    if (scCross && scMouse) {
      SX.strokeStyle = 'rgba(255,255,255,.22)'; SX.setLineDash([2, 3]);
      SX.beginPath(); SX.moveTo(scMouse.x, PT); SX.lineTo(scMouse.x, H - PB); SX.stroke();
      SX.beginPath(); SX.moveTo(PL, scMouse.y); SX.lineTo(W - PR, scMouse.y); SX.stroke();
      SX.setLineDash([]);
      const i = Math.floor((scMouse.x - PL) / bw);
      if (i >= 0 && i < n) {
        const c = scData[i];
        const t = 'O' + c.o.toFixed(2) + '  H' + c.h.toFixed(2) + '  L' + c.l.toFixed(2) + '  C' + c.c.toFixed(2);
        SX.font = '10px system-ui,sans-serif';
        const tw = SX.measureText(t).width + 14;
        SX.fillStyle = '#1a2738'; SX.strokeStyle = 'rgba(255,255,255,.14)';
        SX.beginPath(); SX.roundRect(scMouse.x + 10, PT + 6, tw, 20, 6); SX.fill(); SX.stroke();
        SX.fillStyle = '#dbe4ee'; SX.textAlign = 'left';
        SX.fillText(t, scMouse.x + 17, PT + 19);
      }
    }

    const up = scData.filter(c => c.c >= c.o).length;
    const info = document.getElementById('scInfo');
    if (info) info.textContent = n + ' شمعة · ' + up + ' صاعدة · SMA' + smaLen;
  }

  /* ── أدوات الشارت البسيط ── */
  window.scTool2 = function (t) {
    scTool = t;
    document.querySelectorAll('.ch-b[data-t]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.t === t);
    });
    const h = document.getElementById('scHint');
    if (h) h.textContent = t === 'cursor' ? '' :
      ({ hline: 'اسحب خط أفقي', rect: 'اسحب مستطيل', fib: 'اسحب للفيبوناتشي' }[t] || '');
  };
  window.scToggleSma = function () {
    smaOn = !smaOn;
    const b = document.getElementById('scSma');
    if (b) b.classList.toggle('on', smaOn);
    drawSimple();
  };
  window.scSmaLen = function () {
    const o = [20, 50, 100, 150, 200];
    smaLen = o[(o.indexOf(smaLen) + 1) % o.length];
    drawSimple();
  };
  window.scClear = function () { scOverlays = []; drawSimple(); };

  function bindSimple() {
    const wrap = SV.parentElement;
    const pos = e => {
      const r = SV.getBoundingClientRect();
      return { x: (e.touches ? e.touches[0].clientX : e.clientX) - r.left,
               y: (e.touches ? e.touches[0].clientY : e.clientY) - r.top };
    };

    wrap.addEventListener('mousemove', function (e) {
      const p = pos(e);
      scMouse = p; scCross = true;
      if (scTool === 'cursor' && scDrag) {
        wrap.scrollLeft -= (e.clientX - scDrag.lx);
      } else if (scDrag) { scDrag.ex = p.x; scDrag.ey = p.y; }
      drawSimple();
    });
    wrap.addEventListener('mouseleave', function () { scMouse = null; scCross = false; drawSimple(); });
    wrap.addEventListener('mousedown', function (e) {
      const p = pos(e);
      if (scTool === 'cursor') { scDrag = { lx: e.clientX }; return; }
      scDrag = { sx: p.x, sy: p.y, ex: p.x, ey: p.y };
    });
    window.addEventListener('mouseup', function () {
      if (scDrag && scTool !== 'cursor') {
        if (Math.abs(scDrag.ex - scDrag.sx) > 5 || Math.abs(scDrag.ey - scDrag.sy) > 5) {
          scOverlays.push({ type: scTool, x1: scDrag.sx, y1: scDrag.sy,
            x2: scDrag.ex, y2: scDrag.ey, y: scDrag.sy });
          window.scTool2('cursor');
        }
      }
      scDrag = null; drawSimple();
    });

    /* لمس */
    wrap.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) { scDrag = { zoom: dist(e.touches[0], e.touches[1]) }; e.preventDefault(); return; }
      const p = pos(e);
      if (scTool === 'cursor') scDrag = { lx: e.touches[0].clientX, pan: true };
      else scDrag = { sx: p.x, sy: p.y, ex: p.x, ey: p.y };
      e.preventDefault();
    }, { passive: false });
    wrap.addEventListener('touchmove', function (e) {
      if (!scDrag) return;
      if (scDrag.zoom && e.touches.length === 2) {
        const d = dist(e.touches[0], e.touches[1]);
        if (scDrag.zoom > 0) {
          const r = d / scDrag.zoom;
          if (r > 1.2 && scData.length > 40) { scData = scData.slice(2); scDrag.zoom = d; drawSimple(); }
          else if (r < 0.82 && scData.length < 300) {
            scData = [scData[0], scData[1], scData[1]].concat(scData); scDrag.zoom = d; drawSimple();
          }
        }
      } else if (scDrag.pan) {
        wrap.scrollLeft -= (e.touches[0].clientX - scDrag.lx);
        scDrag.lx = e.touches[0].clientX;
      } else {
        const p = pos(e);
        scDrag.ex = p.x; scDrag.ey = p.y; scMouse = p; scCross = true; drawSimple();
      }
      e.preventDefault();
    }, { passive: false });
    wrap.addEventListener('touchend', function () {
      if (scDrag && !scDrag.pan && !scDrag.zoom && scTool !== 'cursor') {
        if (Math.abs(scDrag.ex - scDrag.sx) > 8 || Math.abs(scDrag.ey - scDrag.sy) > 8) {
          scOverlays.push({ type: scTool, x1: scDrag.sx, y1: scDrag.sy,
            x2: scDrag.ex, y2: scDrag.ey, y: scDrag.sy });
          window.scTool2('cursor');
        }
      }
      scDrag = null; drawSimple();
    });

    function dist(a, b) {
      const dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
  }

  /* ── إغلاق + مفاتيح ── */
  window.closeChart = function () {
    const m = document.getElementById('chModal');
    if (m) m.remove();
    document.body.style.overflow = '';
    SV = null; SX = null; scData = []; scDrag = null;
  };

  function bindKeys() {
    if (window.__chKeys) return;
    window.__chKeys = 1;
    document.addEventListener('keydown', function (e) {
      if (!document.getElementById('chModal')) return;
      if (e.key === 'Escape') {
        if (document.querySelector('.ch-box.ch-fs')) window.chFull();
        else window.closeChart();
      } else if (e.key === 'f' || e.key === 'F') {
        window.chFull();
      } else if (e.key === 's' || e.key === 'S') {
        window.chSwitch(!CURRENT.simple);
      }
    });
  }

})();