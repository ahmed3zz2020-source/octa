/* ══════════════════════════════════════════════════════════════════════
   💵 ذكاء الدولار (OCTA USD INTELLIGENCE)
   كل الأرقام من الـAPI — مفيش ولا رقم في الواجهة من عندنا.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API = (window.OCTA_API || '').replace(/\/$/, '');
  const USD = { data: null, busy: false, seq: 0, mode: 'USDEGP', tf: '1D', period: '1Y', tab: 'overview', factors: null, calendar: null, news: null, tech: null, cmp: null, win: 0 };
  /* 📌 نافذة العرض لكل إطار زمني (أقرب الأرقام للمحترفين) */
  const WIN = { '1D': [130, 260, 520, 1400], '1W': [60, 156, 312, 900], '1M': [36, 72, 120, 300] };
  const WIN_AR = { '1D': ['٦ شهور', 'سنة', 'سنتين', 'الكل'], '1W': ['سنة', '٣ سنين', '٦ سنين', 'الكل'], '1M': ['٣ سنين', '٦ سنين', '١٠ سنين', 'الكل'] };
  const IX = {};

  /* ── أدوات ─────────────────────────────────────────────────────── */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LRI = '\u2066', PDI = '\u2069';
  const num = (v, d) => {
    if (v == null || isNaN(v)) return '—';
    d = (d === undefined) ? 2 : d;
    const s = Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    /* 📌 الأرقام السالبة بتتقلب في النص العربي ⇒ عزل LRI/PDI */
    return (v < 0) ? (LRI + s + PDI) : s;
  };
  const lnum = (v) => LRI + v + PDI;
  const pct = (v, d) => {
    if (v == null || isNaN(v)) return '—';
    d = (d === undefined) ? 2 : d;
    return lnum((v >= 0 ? '+' : '') + Number(v).toFixed(d) + '%');
  };
  const sgn = (v) => (v > 0 ? 'pos' : (v < 0 ? 'neg' : ''));
  const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const dLabel = (ts) => { const d = new Date(ts * 1000); return d.getDate() + ' ' + AR_MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
  const dShort = (ts) => { const d = new Date(ts * 1000); return d.getDate() + ' ' + AR_MONTHS[d.getMonth()]; };
  const when = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.getDate() + ' ' + AR_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  };
  /* 📌 تاريخات نصية زي «26 Oct 2026» أو «2026-10-26 19:19» ⇒ عربية */
  const AR_MON_EN = { Jan: 'يناير', Feb: 'فبراير', Mar: 'مارس', Apr: 'أبريل', May: 'مايو', Jun: 'يونيو', Jul: 'يوليو', Aug: 'أغسطس', Sep: 'سبتمبر', Oct: 'أكتوبر', Nov: 'نوفمبر', Dec: 'ديسمبر' };
  const fmtDate = (v) => {
    if (!v) return '—';
    const t = String(v).trim();
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}))?/);
    if (m) {
      const mo = AR_MONTHS[parseInt(m[2], 10) - 1] || m[2];
      return parseInt(m[3], 10) + ' ' + mo + ' ' + m[1] + (m[4] ? ' · ' + m[4] : '');
    }
    m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
    if (m) return parseInt(m[1], 10) + ' ' + (AR_MON_EN[m[2]] || m[2]) + ' ' + m[3];
    return t;
  };

  const TREND_AR = { up: 'صاعد', down: 'هابط', range: 'عرضي', sideways: 'عرضي', unclear: 'غير واضح' };
  const REGIME_AR = { strong_uptrend: 'صاعد بقوة', uptrend: 'صاعد', sideways: 'عرضي', downtrend: 'هابط', strong_downtrend: 'هابط بقوة', uncertain: 'غير واضح', range: 'نطاق' };
  const SC_AR = { bullish: 'صاعد للدولار', bearish: 'هابط للدولار', range: 'عرضي' };

  /* ══════════════════════════════════════════════════════════════════
     ① المودال
     ══════════════════════════════════════════════════════════════════ */
  function openUSDIntel() {
    const old = document.getElementById('usd-modal');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.id = 'usd-modal';
    wrap.className = 'usd-overlay';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'ذكاء الدولار');
    wrap.onclick = (e) => { if (e.target === wrap) closeUSDIntel(); };
    wrap.innerHTML =
      '<div class="usd-box">' +
      '<div class="usd-head">' +
      '<div><div class="usd-title" id="usd-title">💵 ذكاء الدولار</div>' +
      '<div class="usd-sub" id="usd-sub">افهم حركة الدولار مقابل الجنيه المصري</div></div>' +
      '<button class="usd-close" onclick="closeUSDIntel()" aria-label="إغلاق">✕</button>' +
      '</div>' +
      '<div class="usd-body" id="usd-body"><div class="usd-loading">⏳ جاري تحميل بيانات الدولار…</div></div>' +
      '</div>';
    document.body.appendChild(wrap);
    const box = wrap.querySelector('.usd-box');
    try { box.setAttribute('tabindex', '-1'); box.focus({ preventScroll: true }); } catch (e) { }
    document.body.style.overflow = 'hidden';
    loadAll();
  }

  function closeUSDIntel() {
    const el = document.getElementById('usd-modal');
    if (el) el.remove();
    document.body.style.overflow = '';
  }

  async function loadAll() {
    const seq = ++USD.seq;
    const body = document.getElementById('usd-body');
    if (!body) return;
    body.innerHTML = '<div class="usd-loading">⏳ جاري تحميل بيانات الدولار…</div>';
    try {
      const r = await octaFetch(API + '/api/usd/overview?period=' + USD.period);
      const d = await r.json();
      if (seq !== USD.seq) return;
      if (!d || !d.ok) {
        body.innerHTML = '<div class="usd-empty">❌ ' + esc((d && d.error) || 'البيانات غير متاحة') + '</div>';
        return;
      }
      USD.data = d;
      render();
      // البيانات الثانوية بالتوازي (ما بتأخرش العرض)
      loadSide();
    } catch (e) {
      if (seq !== USD.seq) return;
      const b = document.getElementById('usd-body');
      if (b) b.innerHTML = '<div class="usd-empty">❌ تعذر تحميل البيانات — حاول تاني</div>';
    }
  }

  async function loadSide() {
    const jobs = [
      fetchJ('factors', '/api/usd/factors'),
      fetchJ('calendar', '/api/usd/calendar'),
      fetchJ('news', '/api/usd/news'),
      fetchJ('tech', techUrl()),
    ];
    const res = await Promise.all(jobs);
    USD.factors = res[0]; USD.calendar = res[1]; USD.news = res[2]; USD.tech = res[3];
    if (USD.data) render();
  }
  async function fetchJ(key, path) {
    try {
      const r = await octaFetch(API + path);
      const j = await r.json();
      return (j && j.ok) ? j : null;
    } catch (e) { return null; }
  }

  /* ══════════════════════════════════════════════════════════════════
     ② الرسم — SVG خفيف (من غير مكتبات)
     ══════════════════════════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════════════════════════
     ② الرسم — شموع + مناطق + محور أسعار (على طراز المنصات الكبرى)
     📌 كل الأرقام من الـAPI — الواجهة بترسم بس.
     ══════════════════════════════════════════════════════════════════ */
  const CH = { mode: 'candle' };   /* candle | line */

  function chartGeo() {
    const body = document.getElementById('usd-body');
    let w = 0;
    if (body && body.clientWidth) {
      const cs = getComputedStyle(body);
      w = body.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 26;
    }
    if (!w) w = (window.innerWidth || 390) - 60;
    const W = Math.max(300, Math.min(1000, Math.round(w)));
    const H = 300;
    const PAD_L = 6, PAD_R = 58, PAD_T = 10, PAD_B = 24, VOL_H = 46;
    return { W, H, PAD_L, PAD_R, PAD_T, PAD_B, VOL_H,
      PLOT_T: PAD_T, PLOT_B: H - PAD_B - VOL_H,          /* حدود لوحة السعر */
      VOL_T: H - PAD_B - VOL_H, VOL_B: H - PAD_B };      /* حدود لوحة الحجم */
  }

  function niceStep(range, target) {
    if (!(range > 0)) return 1;
    const raw = range / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * mag;
  }

  function buildChart(series, zones, name) {
    const G = chartGeo();
    const W = G.W, H = G.H;
    if (!series || series.length < 2) return '<div class="usd-empty">📉 مفيش شموع متاحة</div>';

    /* ── ① المقاييس ── */
    let vmax = -Infinity, vmin = Infinity, vmaxVol = 0;
    series.forEach((b) => {
      const hi = b.h != null ? b.h : b.c, lo = b.l != null ? b.l : b.c;
      if (hi > vmax) vmax = hi; if (lo < vmin) vmin = lo;
      if (b.v && b.v > vmaxVol) vmaxVol = b.v;
    });
    if (vmin === vmax) { vmin -= 1; vmax += 1; }
    const dmin = vmin, dmax = vmax;
    const pad = (vmax - vmin) * 0.07;
    vmin -= pad; vmax += pad;

    const t0 = series[0].t, t1 = series[series.length - 1].t;
    const span = (W - G.PAD_L - G.PAD_R) || 1;
    const dt = (t1 - t0) || 1;
    const x = (t) => G.PAD_L + ((t - t0) / dt) * span;
    const y = (v) => G.PLOT_T + (1 - (v - vmin) / ((vmax - vmin) || 1)) * (G.PLOT_B - G.PLOT_T);
    const yVol = (v) => G.VOL_B - (vmaxVol ? (v / vmaxVol) * (G.VOL_B - G.VOL_T) : 0);

    const last = series[series.length - 1];
    const lastC = last.c;

    /* ── ② الشبكة + تدرّج المحور ── */
    const step = niceStep(vmax - vmin, 4);
    let grid = '', ylabs = '';
    const firstTick = Math.ceil(vmin / step) * step;
    /* 📌 مواضع تسميات المحور (بنحسبها الأول عشان نعرفين اللي هياخدها بطاقات المناطق) */
    const tickYs = [];
    for (let v = firstTick; v <= vmax + 1e-9; v += step) tickYs.push([v, y(v)]);
    for (const pair of tickYs) {
      const v = pair[0], yy = pair[1];
      grid += '<line class="usd-grid" x1="' + G.PAD_L + '" y1="' + yy.toFixed(1) + '" x2="' +
        (W - G.PAD_R) + '" y2="' + yy.toFixed(1) + '"></line>';
    }

    /* ── ③ محور الزمن ── */
    const nLab = W < 420 ? 3 : (W < 700 ? 4 : 6);
    let xlab = '';
    for (let i = 0; i <= nLab; i++) {
      const t = t0 + (dt * i) / nLab;
      const cx = x(t);
      let lx = cx, anch = 'middle';
      if (i === 0) { lx = G.PAD_L; anch = 'start'; }
      else if (i === nLab) { lx = W - G.PAD_R; anch = 'end'; }
      const multiYear = (t1 - t0) > 300 * 86400;   /* 📌 نافذة أكتر من سنة ⇒ نبيّن السنة */
      xlab += '<text class="usd-axis" x="' + lx.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + anch + '">' +
        (W < 420 ? (multiYear ? dShort(t) + ' ' + new Date(t * 1000).getFullYear() : dShort(t))
                 : (multiYear ? dShort(t) + ' ' + new Date(t * 1000).getFullYear() : dLabel(t))) + '</text>';
      if (i > 0 && i < nLab) {
        grid += '<line class="usd-vgrid" x1="' + cx.toFixed(1) + '" y1="' + G.PLOT_T + '" x2="' +
          cx.toFixed(1) + '" y2="' + G.VOL_B + '"></line>';
      }
    }

    /* ── ④ مناطق الدعم والمقاومة (شريط مظلل + خط منقّط + بطاقة السعر) ── */
    /* 📌 عرض المناطق: الشريط لكل منطقة، بس البطاقة على المحور لأقرب دعم + أقرب مقاومة
       + الأقوى (لحد ٣ بطاقات) ⇒ مفيش تزاحم على المحور.
       📌 واسم «دعم/مقاومة» على الشريط: الأقوى بس ⇒ الشكل يفضل نضيف. */
    const zoneList = (zones || []).slice(0, 8);
    const priceNow = lastC;
    const supZ = zoneList.filter((z) => z.kind === 'support')
      .sort((a, b) => Math.abs(b.center - priceNow) - Math.abs(a.center - priceNow))[0];
    const resZ = zoneList.filter((z) => z.kind === 'resistance')
      .sort((a, b) => Math.abs(a.center - priceNow) - Math.abs(b.center - priceNow))[0];
    const strongZ = zoneList.find((z) => z.is_strongest);
    const tagged = [supZ, resZ, strongZ].filter(Boolean).filter((z, i, a) =>
      a.findIndex((x) => x.center === z.center && x.kind === z.kind) === i);
    const usedY = [];
    let zsvg = '';
    zoneList.forEach((z) => {
      const isSup = z.kind === 'support';
      const cls = isSup ? 'sup' : 'res';
      const bl = z.band_lower != null ? z.band_lower : z.lower;
      const bu = z.band_upper != null ? z.band_upper : z.upper;
      const y1 = y(bu), y2 = y(bl);
      const yc = y(z.center);
      const strong = z.is_strongest ? ' strong' : '';
      zsvg += '<g class="usd-zg ' + cls + strong + '">' +
        '<rect class="usd-zone" x="' + G.PAD_L + '" y="' + Math.min(y1, y2).toFixed(1) +
        '" width="' + span + '" height="' + Math.max(2, Math.abs(y2 - y1)).toFixed(1) + '"></rect>' +
        '<line class="usd-zline" x1="' + G.PAD_L + '" y1="' + yc.toFixed(1) + '" x2="' +
        (W - G.PAD_R) + '" y2="' + yc.toFixed(1) + '"></line>';
      /* اسم المنطقة على الشريط — الأقوى بس */
      if (z.is_strongest) {
        zsvg += '<text class="usd-zname" x="' + (G.PAD_L + 6) + '" y="' +
          (Math.min(y1, y2) + 13).toFixed(1) + '">' + (isSup ? 'أقوى دعم' : 'أقوى مقاومة') + ' ⭐</text>';
      }
      zsvg += '</g>';
    });
    /* بطاقات الأسعار على المحور */
    tagged.forEach((z) => {
      const isSup = z.kind === 'support';
      const yc = y(z.center);
      /* ⛔ منع التداخل: لو فيه بطاقة قريبة، نزيحها شوية */
      let ty = yc;
      for (let i = 0; i < 6; i++) {
        if (!usedY.some((u) => Math.abs(u - ty) < 21)) break;
        ty += (ty > yc ? -21 : 21);
      }
      usedY.push(ty);
      zsvg += '<g class="usd-zg ' + (isSup ? 'sup' : 'res') + '">' +
        '<rect class="usd-ztag-bg" x="' + (W - G.PAD_R + 2) + '" y="' + (ty - 9).toFixed(1) +
        '" width="' + (G.PAD_R - 4) + '" height="18" rx="4"></rect>' +
        '<text class="usd-ztag" x="' + (W - G.PAD_R + 6) + '" y="' + (ty + 3.5).toFixed(1) + '">' +
        num(z.center, z.center < 10 ? 3 : 2) + (z.touches ? ' ×' + z.touches : '') + '</text></g>';
    });

    /* ── ⑤ الشموع أو الخط ── */
    let marks = '';
    if (CH.mode === 'candle') {
      const cw = Math.max(1.2, Math.min(11, (span / series.length) * 0.62));
      series.forEach((b) => {
        const cx = x(b.t);
        const up = b.c >= b.o;
        const cls = up ? 'up' : 'dn';
        const yo = y(b.o), yc2 = y(b.c);
        const top = Math.min(yo, yc2), hgt = Math.max(1, Math.abs(yc2 - yo));
        marks += '<line class="usd-wick ' + cls + '" x1="' + cx.toFixed(1) + '" y1="' +
          y(b.h).toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + y(b.l).toFixed(1) + '"></line>' +
          '<rect class="usd-cdl ' + cls + '" x="' + (cx - cw / 2).toFixed(1) + '" y="' + top.toFixed(1) +
          '" width="' + cw.toFixed(1) + '" height="' + hgt.toFixed(1) + '" rx="' + Math.min(1.5, cw / 3).toFixed(1) + '"></rect>';
      });
    } else {
      let path = '';
      series.forEach((b, i) => { path += (i ? 'L' : 'M') + x(b.t).toFixed(1) + ' ' + y(b.c).toFixed(1); });
      marks = '<path class="usd-area" d="' + path + 'L' + x(t1).toFixed(1) + ' ' + G.PLOT_B +
        'L' + x(t0).toFixed(1) + ' ' + G.PLOT_B + 'Z" fill="url(#usdg)"></path>' +
        '<path class="usd-line" d="' + path + '" fill="none"></path>';
    }

    /* ── ⑥ الحجم ── */
    let vol = '';
    if (vmaxVol > 0) {
      const vw = Math.max(1, Math.min(9, (span / series.length) * 0.55));
      series.forEach((b) => {
        if (!b.v) return;
        const cx = x(b.t);
        const yy = yVol(b.v);
        vol += '<rect class="usd-vol ' + (b.c >= b.o ? 'up' : 'dn') + '" x="' + (cx - vw / 2).toFixed(1) +
          '" y="' + yy.toFixed(1) + '" width="' + vw.toFixed(1) + '" height="' + Math.max(0.6, G.VOL_B - yy).toFixed(1) + '"></rect>';
      });
    }

    /* ── ⑦ خط السعر الحالي + بطاقته ── */
    const yLast = y(lastC);
    const lastLine =
      '<line class="usd-lastline" x1="' + G.PAD_L + '" y1="' + yLast.toFixed(1) + '" x2="' +
      (W - G.PAD_R) + '" y2="' + yLast.toFixed(1) + '"></line>' +
      '<rect class="usd-lasttag-bg" x="' + (W - G.PAD_R + 2) + '" y="' + (yLast - 9).toFixed(1) +
      '" width="' + (G.PAD_R - 4) + '" height="18" rx="4"></rect>' +
      '<text class="usd-lasttag" x="' + (W - G.PAD_R + 6) + '" y="' + (yLast + 3.5).toFixed(1) + '">' +
      num(lastC, lastC < 10 ? 3 : 2) + '</text>';

    /* ── ⑧ شريط القراءة (فوق الرسم) ── */
    const readout =
      '<div class="usd-readout" id="usd-readout">' +
      '<div class="usd-ro-cell"><span class="usd-ro-l">التاريخ</span><span class="usd-ro-v" id="usd-ro-date">—</span></div>' +
      '<div class="usd-ro-cell"><span class="usd-ro-l">السعر</span><span class="usd-ro-v" id="usd-ro-val">—</span></div>' +
      '<div class="usd-ro-cell"><span class="usd-ro-l">من بداية الفترة</span><span class="usd-ro-v" id="usd-ro-pct">—</span></div>' +
      '</div>';

    /* 📌 تسميات المحور: بعد البطاقات ⇒ نتخطى أي تسمية قريبة من بطاقة منطقة */
    for (const pair of tickYs) {
      const v = pair[0], yy = pair[1];
      if (usedY.some((u) => Math.abs(u - yy) < 11)) continue;
      ylabs += '<text class="usd-axis" x="' + (W - G.PAD_R + 5) + '" y="' + (yy + 3.5).toFixed(1) +
        '" text-anchor="start">' + num(v, v < 10 ? 3 : 2) + '</text>';
    }

    return readout +
      '<div class="usd-chart-wrap" id="usd-chart-wrap">' +
      '<svg class="usd-chart" id="usd-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" direction="ltr" role="img" aria-label="رسم بياني لسعر ' + esc(name) + '">' +
      '<defs><linearGradient id="usdg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--gold)" stop-opacity=".30"></stop>' +
      '<stop offset="100%" stop-color="var(--gold)" stop-opacity="0"></stop></linearGradient></defs>' +
      grid + zsvg + marks + vol + lastLine +
      '<line class="usd-cross" id="usd-cross" x1="0" y1="' + G.PLOT_T + '" x2="0" y2="' + G.VOL_B + '" style="opacity:0"></line>' +
      '<line class="usd-cross" id="usd-crossh" x1="' + G.PAD_L + '" y1="0" x2="' + (W - G.PAD_R) + '" y2="0" style="opacity:0"></line>' +
      '<circle class="usd-dot" id="usd-dot" cx="0" cy="0" r="3.5" style="opacity:0"></circle>' +
      ylabs + xlab +
      (vmaxVol > 0 ? '<text class="usd-axis usd-vollbl" x="' + (W - G.PAD_R + 5) + '" y="' + (G.VOL_T + 8) + '" text-anchor="start">حجم</text>' : '') +
      '</svg>' +
      '</div>';
  }

  function bindChart() {
    const svg = document.getElementById('usd-chart');
    const tech = USD.tech;
    if (!svg || !tech || !tech.series) return;
    const G = chartGeo();
    const series = tech.series;
    const cross = document.getElementById('usd-cross');
    const crossh = document.getElementById('usd-crossh');
    const dot = document.getElementById('usd-dot');
    const roDate = document.getElementById('usd-ro-date');
    const roVal = document.getElementById('usd-ro-val');
    const roPct = document.getElementById('usd-ro-pct');

    let vmax = -Infinity, vmin = Infinity;
    series.forEach((b) => {
      const hi = b.h != null ? b.h : b.c, lo = b.l != null ? b.l : b.c;
      if (hi > vmax) vmax = hi; if (lo < vmin) vmin = lo;
    });
    if (vmin === vmax) { vmin -= 1; vmax += 1; }
    const pad = (vmax - vmin) * 0.07;
    vmin -= pad; vmax += pad;
    const t0 = series[0].t, t1 = series[series.length - 1].t;
    const first = series[0].c;

    function yOf(v) {
      return G.PLOT_T + (1 - (v - vmin) / ((vmax - vmin) || 1)) * (G.PLOT_B - G.PLOT_T);
    }
    function xOf(t) {
      return G.PAD_L + ((t - t0) / ((t1 - t0) || 1)) * (G.W - G.PAD_L - G.PAD_R);
    }
    function setReadout(b) {
      const fs = first ? (b.c / first - 1) * 100 : null;
      if (roDate) roDate.textContent = dLabel(b.t);
      if (roVal) roVal.textContent = num(b.c, b.c < 10 ? 3 : 2);
      if (roPct) {
        roPct.textContent = fs == null ? '—' : pct(fs, 2);
        roPct.className = 'usd-ro-v ' + (fs == null ? '' : sgn(fs));
      }
    }
    function show(ev) {
      const r = svg.getBoundingClientRect();
      const rel = ((ev.clientX - r.left) / r.width) * G.W;
      const frac = (rel - G.PAD_L) / ((G.W - G.PAD_L - G.PAD_R) || 1);
      const target = t0 + frac * ((t1 - t0) || 1);
      let best = series[0], bd = Infinity;
      for (let i = 0; i < series.length; i++) {
        const d = Math.abs(series[i].t - target);
        if (d < bd) { bd = d; best = series[i]; }
      }
      const cx = xOf(best.t), cy = yOf(best.c);
      if (cross) { cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.style.opacity = '1'; }
      if (crossh) { crossh.setAttribute('y1', cy); crossh.setAttribute('y2', cy); crossh.style.opacity = '1'; }
      if (dot) { dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.style.opacity = '1'; }
      setReadout(best);
    }
    function hide() {
      if (cross) cross.style.opacity = '0';
      if (crossh) crossh.style.opacity = '0';
      if (dot) dot.style.opacity = '0';
      setReadout(series[series.length - 1]);
    }
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('pointercancel', hide);
    hide();   /* 📌 الشريط يبدأ من آخر نقطة */
  }

  /* ══════════════════════════════════════════════════════════════════
     ③ الأقسام
     ══════════════════════════════════════════════════════════════════ */
  function heroHtml(d) {
    const u = d.usdegp, dx = d.dxy, off = u.official || {};
    return '<div class="usd-hero">' +
      '<div class="usd-hero-main">' +
      '<div class="usd-k">الدولار الأمريكي مقابل الجنيه المصري</div>' +
      '<div class="usd-price">' + num(u.value, 2) + '</div>' +
      '<div class="usd-chg ' + sgn(u.change_pct) + '">' + (u.change_pct >= 0 ? '▲ +' : '▼ ') +
      num(Math.abs(u.change_pct || 0), 2) + '% (' + num(u.change_abs, 2) + ' نقطة)</div>' +
      '<div class="usd-src">📡 سعر السوق الدولي — ' + esc(u.quote_source) + ' · ' + esc(fmtDate(u.updated_at)) + '</div>' +
      '</div>' +
      '<div class="usd-hero-side">' +
      '<div class="usd-mini"><span>السعر الرسمي (البنك المركزي)</span><b>' +
      (off.buy != null ? num(off.buy, 4) + ' / ' + num(off.sell, 4) : 'غير متاح') + '</b>' +
      '<i>' + esc(fmtDate(off.last_updated)) + '</i></div>' +
      '<div class="usd-mini"><span>أعلى / أدنى اليوم</span><b>' + num(u.high, 2) + ' / ' + num(u.low, 2) + '</b>' +
      '<i>من المصدر الرسمي للبورصة</i></div>' +
      '<div class="usd-mini"><span>مؤشر الدولار (DXY)</span><b>' + num(dx.value, 2) + '</b>' +
      '<i class="' + sgn(dx.change_pct) + '">' + pct(dx.change_pct, 2) + ' · ' + esc(dx.source || '') + '</i></div>' +
      '</div>' +
      '<div class="usd-note">ℹ️ الرقم الكبير ده سعر السوق الدولي (TradingView / ICE). ' +
      'السعر الرسمي هو سعر البنك المركزي المصري. السوق الموازي مندمج مع الرسمي حسب صندوق النقد — من غير رقم موازي هنا.</div>' +
      '</div>';
  }

  function verdictHtml(d) {
    const v = d.verdict || {};
    const q = d.quality || {};
    return '<div class="usd-sec usd-verdict">' +
      '<h3 class="usd-h">🧭 قراءة OCTA النهائية</h3>' +
      '<div class="usd-verdict-main"><div class="usd-verdict-bias ' + (v.bias === 'bullish' ? 'pos' : (v.bias === 'bearish' ? 'neg' : '')) + '">' +
      esc(v.bias_ar || '—') + '</div>' +
      '<div class="usd-verdict-str">قوة الأدلة: ' + esc(v.strength_ar || '—') + '</div></div>' +
      '<p class="usd-verdict-sum">' + esc(v.summary || '') + '</p>' +
      (v.evidence && v.evidence.length ? '<ul class="usd-list">' +
        v.evidence.map((e) => '<li>' + esc(e) + '</li>').join('') + '</ul>' : '') +
      '<div class="usd-kv"><span>الاستنتاج يتبطل لو:</span><b>' + esc(v.invalidation || '—') + '</b></div>' +
      (v.risks && v.risks.length ? '<div class="usd-kv"><span>أهم المخاطر:</span><b>' + esc(v.risks.join(' · ')) + '</b></div>' : '') +
      (v.monitor && v.monitor.length ? '<div class="usd-kv"><span>راقب:</span><b>' +
        v.monitor.filter(Boolean).map((m) => esc(m)).join(' · ') + '</b></div>' : '') +
      '<div class="usd-note">📌 قراءة تاريخية من محرك OCTA على بيانات ' + esc(fmtDate(v.generated_at)) +
      ' — مش تنبؤ ولا ضمان. جودة البيانات: ' + (q.available || 0) + ' عامل متاح من ' + (q.total || 0) +
      ' (' + (q.coverage_pct || 0) + '٪). ' + esc(v.method || '') + '</div>' +
      '</div>';
  }

  function trendHtml(d) {
    const t = d.trend || {};
    const u = t.usdegp || {}, x = t.dxy || {};
    const cell = (label, o) => {
      const tv = (o || {}).trend || 'unclear';
      return '<div class="usd-tf"><span>' + esc(label) + '</span><b class="' +
        (tv === 'up' ? 'pos' : (tv === 'down' ? 'neg' : '')) + '">' + (TREND_AR[tv] || tv) + '</b></div>';
    };
    return '<div class="usd-sec"><h3 class="usd-h">🧭 الاتجاه على الأطر الزمنية</h3>' +
      '<div class="usd-tfrow">' + cell('يومي', u.daily) + cell('أسبوعي', u.weekly) + cell('شهري', u.monthly) + '</div>' +
      '<div class="usd-tfrow usd-tfrow2">' + cell('DXY — يومي', x.daily) + cell('DXY — أسبوعي', x.weekly) + cell('DXY — شهري', x.monthly) + '</div>' +
      '<div class="usd-note">📌 ' + esc(t.agreement_note || '') + '</div>' +
      '</div>';
  }

  function compareHtml(d) {
    const c = d.comparison || {};
    if (!c.ok) return '<div class="usd-sec"><h3 class="usd-h">⚖️ الدولار عالميًا مقارنةً بالدولار في مصر</h3>' +
      '<div class="usd-empty">📉 ' + esc(c.reason || 'المقارنة غير متاحة') + '</div></div>';
    const rel = {
      same_direction: 'الاتنين تحركوا في نفس الاتجاه',
      diverged: 'تحركوا في اتجاهين مختلفين',
      aligned: 'الحركة متقاربة',
    }[c.relation] || c.relation;
    return '<div class="usd-sec"><h3 class="usd-h">⚖️ الدولار عالميًا مقارنةً بالدولار في مصر</h3>' +
      '<div class="usd-note">⚖️ هل حركة الدولار في مصر مرتبطة بقوة الدولار عالميًا، أم بعوامل محلية؟</div>' +
      '<div class="usd-cmp">' +
      '<div class="usd-cmp-col"><span>مؤشر الدولار (DXY)</span><b class="' + sgn(c.dxy.ret) + '">' + pct(c.dxy.ret, 2) + '</b><i>' +
      num(c.dxy.start, 2) + ' → ' + num(c.dxy.end, 2) + '</i></div>' +
      '<div class="usd-cmp-col"><span>الدولار/الجنيه</span><b class="' + sgn(c.usdegp.ret) + '">' + pct(c.usdegp.ret, 2) + '</b><i>' +
      num(c.usdegp.start, 4) + ' → ' + num(c.usdegp.end, 4) + '</i></div>' +
      '</div>' +
      '<div class="usd-kv"><span>الفرق في العائد:</span><b class="' + sgn(c.diff) + '">' + pct(c.diff, 2) + '</b></div>' +
      '<div class="usd-kv"><span>العلاقة في الفترة:</span><b>' + esc(rel) + '</b></div>' +
      '<div class="usd-kv"><span>الارتباط (العلمي):</span><b>' + (c.correlation != null ? num(c.correlation, 2) : 'غير متاح') + '</b></div>' +
      '<div class="usd-note">📌 ' + esc(c.correlation_note || '') + ' والمقارنة على الفترة من ' +
      when(c.from) + ' إلى ' + when(c.to) + '.</div>' +
      '</div>';
  }

  function scenariosHtml(d) {
    const sc = (d.scenarios && d.scenarios.scenarios) || [];
    const lead = d.scenarios && d.scenarios.leading;
    const STR = { strong: 'أدلة قوية', moderate: 'أدلة متوسطة', weak: 'أدلة ضعيفة', none: 'أدلة غير كافية' };
    return '<div class="usd-sec"><h3 class="usd-h">🎯 سيناريوهات حركة الدولار</h3>' +
      '<div class="usd-note">📌 القوة = عدد العوامل المؤيدة (مش احتمال ولا نسبة ثقة). ' + esc((d.scenarios || {}).method || '') + '</div>' +
      '<div class="usd-scns">' +
      sc.map((s) => '<div class="usd-scn' + (s.id === lead ? ' lead' : '') + '">' +
        '<div class="usd-scn-h">' + esc(s.title_ar) + (s.id === lead ? ' <span class="usd-lead">الأقوى حالياً</span>' : '') + '</div>' +
        '<div class="usd-scn-s">' + esc(STR[s.strength] || s.strength) + '</div>' +
        '<div class="usd-scn-c">' + esc(s.condition || '') + '</div>' +
        (s.evidence && s.evidence.length ? '<ul class="usd-list">' +
          s.evidence.map((e) => '<li>' + esc(e) + '</li>').join('') + '</ul>' : '<div class="usd-sm">مفيش أدلة داعمة.</div>') +
        '<div class="usd-kv"><span>فنياً:</span><b>' + esc(s.technical || '—') + '</b></div>' +
        '<div class="usd-kv"><span>التبطل:</span><b>' + esc(s.invalidation || '—') + '</b></div>' +
        '<div class="usd-kv"><span>الخطر:</span><b>' + esc(s.risk || '—') + '</b></div>' +
        '</div>').join('') +
      '</div></div>';
  }

  function factorsHtml() {
    const f = USD.factors;
    if (!f) return '<div class="usd-sec"><h3 class="usd-h">🧩 إيه اللي بيحرك الدولار؟</h3><div class="usd-loading sm">⏳ جاري تحميل العوامل…</div></div>';
    const cats = f.categories || {};
    const order = [['global', 'قوة الدولار عالميًا'], ['egypt', 'الاقتصاد المصري'], ['flow', 'الطلب والعرض على الدولار'], ['risk', 'المخاطر العالمية']];
    let html = '<div class="usd-sec"><h3 class="usd-h">🧩 إيه اللي بيحرك الدولار؟</h3>';
    order.forEach(([k, ar]) => {
      const list = cats[k] || [];
      if (!list.length) return;
      html += '<div class="usd-fcat"><div class="usd-fcat-h">' + esc(ar) + '</div><div class="usd-flist">' +
        list.map((x) => '<button class="usd-f' + (x.status === 'ok' ? '' : ' miss') + '" data-fkey="' + esc(x.key) + '">' +
          '<span class="usd-f-n">' + esc(x.name_ar) + '</span>' +
          '<span class="usd-f-v' + (x.direction === 'up' ? ' pos' : (x.direction === 'down' ? ' neg' : '')) + '">' +
          (x.value != null ? num(x.value, 2) + (x.unit === '%' ? '٪' : '') : 'غير متاح') + '</span>' +
          '<span class="usd-f-s">' + esc(x.source || '') + '</span></button>').join('') +
        '</div></div>';
    });
    html += '<div class="usd-note">📌 اضغط على أي عامل تشوف تفاصيله ورقمه ومصدره.</div></div>';
    return html;
  }

  function calendarHtml() {
    const c = USD.calendar;
    if (!c) return '<div class="usd-sec"><h3 class="usd-h">🗓️ الأحداث الاقتصادية القادمة</h3><div class="usd-loading sm">⏳ …</div></div>';
    const ev = (c.events || []).slice(0, 14);
    if (!ev.length) return '<div class="usd-sec"><h3 class="usd-h">🗓️ الأحداث الاقتصادية القادمة</h3><div class="usd-empty">📭 مفيش أحداث في التقويم الأسبوعي</div></div>';
    const IMP = { High: '🔴 عالية', Medium: '🟡 متوسطة', Low: '⚪ منخفضة' };
    return '<div class="usd-sec"><h3 class="usd-h">🗓️ الأحداث الاقتصادية القادمة</h3>' +
      '<div class="usd-note">📌 التوقعات (Forecast) بتظهر بس لو موجودة في المصدر — من غيرها مش بنخترع.</div>' +
      '<div class="usd-evs">' + ev.map((e) => '<div class="usd-ev">' +
        '<div class="usd-ev-d">' + esc(when(e.t)) + '</div>' +
        '<div class="usd-ev-t">' + esc(e.title) + '</div>' +
        '<div class="usd-ev-m">' + (e.country === 'USD' ? '🇺🇸 أمريكا' : '🇪🇬 مصر') + ' · ' + (IMP[e.impact] || e.impact || '') +
        (e.previous ? ' · السابق: ' + esc(e.previous) : '') + (e.forecast ? ' · المتوقع: ' + esc(e.forecast) : '') +
        (e.actual ? ' · الفعلي: ' + esc(e.actual) : '') + '</div>' +
        '</div>').join('') + '</div>' +
      '<div class="usd-note">📡 المصدر: ' + esc((c.calendar_source || []).join(' · ') || c.source || 'غير معروف') + '</div></div>';
  }

  function newsHtml() {
    const n = USD.news;
    if (!n) return '<div class="usd-sec"><h3 class="usd-h">📰 أخبار مترتبة على المصدر</h3><div class="usd-loading sm">⏳ …</div></div>';
    const items = (n.items || []).slice(0, 12);
    if (!items.length) return '<div class="usd-sec"><h3 class="usd-h">📰 أخبار</h3><div class="usd-empty">📭 مفيش أخبار دلوقتي</div></div>';
    return '<div class="usd-sec"><h3 class="usd-h">📰 أخبار مترتبة على المصدر</h3>' +
      '<div class="usd-news">' + items.map((it) => '<a class="usd-nw" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
        '<div class="usd-nw-t">' + esc(it.title) + '</div>' +
        '<div class="usd-nw-m">' + esc(it.source) + ' · ' + esc(when(it.published)) + ' · ' +
        (it.country === 'EGY' ? '🇪🇬 مصر' : '🇺🇸 عالمي') + '</div></a>').join('') + '</div>' +
      '<div class="usd-note">📡 كل خبر بمصدره ورابطه الأصلي. مفيش خبر من غير مصدر.</div></div>';
  }

  function technicalHtml() {
    const t = USD.tech;
    if (!t) return '<div class="usd-sec"><h3 class="usd-h">📈 التحليل الفني</h3><div class="usd-loading sm">⏳ …</div></div>';
    if (!t.ok) return '<div class="usd-sec"><h3 class="usd-h">📈 التحليل الفني</h3><div class="usd-empty">📉 ' + esc(t.error || 'غير متاح') + '</div></div>';
    const ind = t.indicators || {}, sr = t.sr || {}, tr = t.trend || {};
    const zones = (sr.supports || []).concat(sr.resistances || []);
    const row = (k, v) => '<div class="usd-iv"><span>' + k + '</span><b>' + v + '</b></div>';
    const tfBtn = (tf, ar) => '<button class="usd-tfbtn' + (USD.tf === tf ? ' on' : '') + '" data-tf="' + tf + '">' + ar + '</button>';
    const dash = srDashHtml(sr);
    return '<div class="usd-sec"><h3 class="usd-h">📈 التحليل الفني — ' + esc(t.name_ar || '') + '</h3>' +
      '<div class="usd-modes">' +
      '<button class="usd-m' + (USD.mode === 'USDEGP' ? ' on' : '') + '" data-mode="USDEGP">الدولار/الجنيه</button>' +
      '<button class="usd-m' + (USD.mode === 'DXY' ? ' on' : '') + '" data-mode="DXY">مؤشر الدولار (DXY)</button>' +
      tfBtn('1D', 'يومي') + tfBtn('1W', 'أسبوعي') + tfBtn('1M', 'شهري') +
      '<button class="usd-tfbtn' + (CH.mode === 'candle' ? ' on' : '') + '" data-chart="candle">🕯️ شموع</button>' +
      '<button class="usd-tfbtn' + (CH.mode === 'line' ? ' on' : '') + '" data-chart="line">📈 خط</button>' +
      '</div>' +
      '<div class="usd-modes usd-ranges">' +
      (WIN[USD.tf] || WIN['1D']).map((n, i) =>
        '<button class="usd-tfbtn' + (USD.win === i ? ' on' : '') + '" data-win="' + i + '">' +
        (WIN_AR[USD.tf] || WIN_AR['1D'])[i] + '</button>').join('') +
      '</div>' +
      '<div class="usd-chart-box">' + buildChart(t.series, zones, t.name_ar || '') + '</div>' +
      dash +
      '<div class="usd-ivs">' +
      row('الإغلاق', num(ind.last, 4)) + row('RSI (14)', num(ind.rsi14, 2)) +
      row('MACD', num(ind.macd, 4)) + row('ATR (14)', num(ind.atr14, 4)) +
      row('التقلب السنوي', num(ind.vol_annual, 2) + '٪') + row('أعلى قيمة', num(ind.high_period, 4)) +
      row('أدنى قيمة', num(ind.low_period, 4)) + row('أقصى هبوط', num((ind.max_dd || {}).pct, 2) + '٪') +
      '</div>' +
      '<div class="usd-kv"><span>الاتجاه:</span><b class="' + (tr.trend === 'up' ? 'pos' : (tr.trend === 'down' ? 'neg' : '')) + '">' +
      (TREND_AR[tr.trend] || 'غير واضح') + '</b></div>' +
      '<div class="usd-zones">' +
      '<div class="usd-zh">🟢 مناطق الدعم</div>' +
      ((sr.supports || []).length ? sr.supports.map((z) => zoneRow(z)).join('') : '<div class="usd-sm">مفيش دعم محسوب قريب.</div>') +
      '<div class="usd-zh">🔴 مناطق المقاومة</div>' +
      ((sr.resistances || []).length ? sr.resistances.map((z) => zoneRow(z)).join('') : '<div class="usd-sm">مفيش مقاومة محسولة فوق السعر (السعر عند قمة الفترة).</div>') +
      '</div>' +
      '<div class="usd-note">📌 طريقة الحساب: ' + esc(sr.method || '') + '. ' + esc(sr.note || '') +
      ' البيانات ' + esc(t.from || '') + ' → ' + esc(t.to || '') + ' (' + (t.bars || 0) + ' شمعة) · المصدر: ' + esc(t.source || '') + '</div>' +
      '</div>';
  }

  /* 📌 لوحة سريعة: السعر داخل منطقة؟ أقرب فوق/تحت (بمضاعفات التذبذب) · أقوى منطقة */
  function srDashHtml(sr) {
    if (!sr) return '';
    const na = sr.nearest_above, nb = sr.nearest_below, at = sr.at_price, st = sr.strongest;
    const cell = (lbl, val, cls) => '<div class="usd-dc"><span>' + lbl + '</span><b class="' + (cls || '') + '">' + val + '</b></div>';
    const atTxt = at ? ('داخل منطقة ' + (at.kind === 'support' ? 'دعم' : 'مقاومة')) : 'بين المناطق';
    const atCls = at ? (at.kind === 'support' ? 'pos' : 'neg') : '';
    let html = '<div class="usd-dash">' +
      cell('السعر الآن', atTxt, atCls) +
      cell('أقرب مقاومة فوق', na ? (num(na.center, 2) + ' <i>(' + na.distance_atr + '× تذبذب)</i>') : 'مفيش') +
      cell('أقرب دعم تحت', nb ? (num(nb.center, 2) + ' <i>(' + nb.distance_atr + '× تذبذب)</i>') : 'مفيش') +
      cell('أقوى منطقة', st ? ((st.kind === 'support' ? 'دعم ' : 'مقاومة ') + num(st.center, 2) + ' <i>(قوة ' + st.strength + ')</i>') : '—') +
      '</div>';
    return html;
  }

  function zoneRow(z) {
    const dir = z.distance_pct >= 0 ? 'فوق السعر' : 'تحت السعر';
    const sup = z.kind === 'support';
    const tier = z.strength_tier || '';
    const st = Math.max(4, Math.min(100, z.strength || 0));
    return '<div class="usd-zone-row ' + (sup ? 'sup' : 'res') + (z.is_strongest ? ' strong' : '') + '">' +
      '<div class="usd-zr-top"><span class="usd-dotc ' + (sup ? 'sup' : 'res') + '"></span>' +
      '<b>' + num(z.center, 4) + '</b>' +
      '<span class="usd-badge ' + (sup ? 'sup' : 'res') + '">' + (sup ? 'دعم' : 'مقاومة') + '</span>' +
      (z.is_strongest ? '<span class="usd-badge gold">⭐ الأقوى</span>' : '') +
      '<span class="usd-badge tier">' + esc(tier) + '</span></div>' +
      '<div class="usd-zr-m">' + num(Math.abs(z.distance_pct), 2) + '٪ ' + dir +
      (z.distance_atr != null ? ' · ' + z.distance_atr + '× التذبذب' : '') +
      ' · ' + z.touches + ' لمسة</div>' +
      '<div class="usd-zr-bar"><i style="width:' + st + '%"></i></div>' +
      '<div class="usd-zr-s">' + esc(z.status_ar || '') + ' · آخر اختبار ' + esc(z.last_test_day || '') + '</div>' +
      '</div>';
  }

  function sourcesHtml(d) {
    const srcs = d.sources || [];
    return '<div class="usd-sec"><h3 class="usd-h">🔗 مصادر البيانات</h3>' +
      '<div class="usd-srcs">' + srcs.map((s) => '<div class="usd-src">' +
        '<a href="' + esc(s.source_url || s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + ' ↗</a>' +
        '<div class="usd-src-m">لأجل: ' + esc(s.used_for || '') + '</div>' +
        (s.note ? '<div class="usd-src-n">' + esc(s.note) + '</div>' : '') +
        '</div>').join('') + '</div>' +
      '<div class="usd-note">📌 كل رقم في الشاشة دي ليه مصدر. لو مصدر مش متاح بنكتب «غير متاح» — مفيش أرقام تقديرية.</div></div>';
  }

  /* ══════════════════════════════════════════════════════════════════
     ④ العرض
     ══════════════════════════════════════════════════════════════════ */
  const TABS = [
    ['overview', 'نظرة عامة'], ['technical', 'التحليل الفني'], ['factors', 'إيه اللي بيحرك الدولار؟'],
    ['calendar', 'الأحداث'], ['news', 'الأخبار'], ['sources', 'المصادر'],
  ];

  function render() {
    const d = USD.data;
    const body = document.getElementById('usd-body');
    if (!d || !body) return;
    let html = '';
    if (USD.tab === 'overview') {
      html = heroHtml(d) + verdictHtml(d) + trendHtml(d) + compareHtml(d) + scenariosHtml(d);
    } else if (USD.tab === 'technical') {
      html = technicalHtml();
    } else if (USD.tab === 'factors') {
      html = factorsHtml();
    } else if (USD.tab === 'calendar') {
      html = calendarHtml();
    } else if (USD.tab === 'news') {
      html = newsHtml();
    } else if (USD.tab === 'sources') {
      html = sourcesHtml(d);
    }
    const tabs = '<div class="usd-tabs" role="tablist">' + TABS.map((t) =>
      '<button class="usd-tab' + (USD.tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '" role="tab" aria-selected="' +
      (USD.tab === t[0] ? 'true' : 'false') + '">' + esc(t[1]) + '</button>').join('') + '</div>';
    body.innerHTML = tabs + html;
    bind();
    if (USD.tab === 'technical') bindChart();
  }

  function bind() {
    const body = document.getElementById('usd-body');
    if (!body) return;
    body.querySelectorAll('.usd-tab').forEach((b) => {
      b.onclick = () => { USD.tab = b.getAttribute('data-tab'); render(); body.scrollTop = 0; };
    });
    body.querySelectorAll('[data-mode]').forEach((b) => {
      b.onclick = () => { USD.mode = b.getAttribute('data-mode'); USD.tech = null; render(); loadTech(); };
    });
    body.querySelectorAll('[data-tf]').forEach((b) => {
      b.onclick = () => {
        USD.tf = b.getAttribute('data-tf'); USD.win = 0; USD.tech = null; render(); loadTech();
      };
    });
    body.querySelectorAll('[data-chart]').forEach((b) => {
      b.onclick = () => { CH.mode = b.getAttribute('data-chart'); render(); };
    });
    body.querySelectorAll('[data-win]').forEach((b) => {
      b.onclick = () => {
        USD.win = parseInt(b.getAttribute('data-win'), 10) || 0;
        USD.tech = null; render(); loadTech();
      };
    });
    body.querySelectorAll('[data-fkey]').forEach((b) => {
      b.onclick = () => openFactor(b.getAttribute('data-fkey'));
    });
  }

  function techUrl() {
    const list = WIN[USD.tf] || WIN['1D'];
    const i = Math.max(0, Math.min(list.length - 1, USD.win));
    return '/api/usd/technical?symbol=' + USD.mode + '&tf=' + USD.tf + '&bars=' + list[i];
  }
  async function loadTech() {
    const j = await fetchJ('tech', techUrl());
    if (j) { USD.tech = j; render(); }
  }

  function openFactor(key) {
    const f = ((USD.factors || {}).factors || []).find((x) => x.key === key);
    if (!f) return;
    const old = document.getElementById('usd-fact');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'usd-fact';
    el.className = 'usd-fact-card';
    el.innerHTML =
      '<div class="usd-fact-h">' + esc(f.name_ar) +
      '<button class="usd-fact-x" id="usd-fact-x" aria-label="إغلاق">✕</button></div>' +
      '<div class="usd-fact-v">' + (f.value != null ? num(f.value, 2) + ' ' + esc(f.unit || '') : 'غير متاح') +
      (f.previous != null ? ' <i>(السابق: ' + num(f.previous, 2) + ')</i>' : '') + '</div>' +
      '<div class="usd-fact-m">الاتجاه: ' + esc({ up: '▲ صاعد', down: '▼ هابط', stable: 'ثابت', unknown: 'غير معروف' }[f.direction] || '—') +
      ' · تاريخ النشر: ' + esc(f.published || '—') + '</div>' +
      '<div class="usd-fact-w"><b>ليه بيهم؟</b><br>' + esc(f.why || '') + '</div>' +
      (f.interpretation ? '<div class="usd-fact-w"><b>القراءة الحالية</b><br>' + esc(f.interpretation) + '</div>' : '') +
      '<div class="usd-fact-w"><b>المصدر</b><br><a href="' + esc(f.source_url || '#') + '" target="_blank" rel="noopener">' +
      esc(f.source || '—') + ' ↗</a></div>' +
      (f.note ? '<div class="usd-fact-n">' + esc(f.note) + '</div>' : '') +
      '<div class="usd-note">📌 صلة العامل بالدولار: ' +
      esc({ positive: 'سالب على الجنيه (الدولار أقوى)', negative: 'موجب على الجنيه (الدولار أضعف)', mixed: 'مختلطة', unclear: 'غير واضحة' }[f.relation] || '—') + '</div>';
    const body = document.getElementById('usd-body');
    if (body) body.appendChild(el);
    const x = document.getElementById('usd-fact-x');
    if (x) x.onclick = () => { const f = document.getElementById('usd-fact'); if (f) f.remove(); };
  }

  /* ══════════════════════════════════════════════════════════════════
     ⑤ التصدير + الاختصارات
     ══════════════════════════════════════════════════════════════════ */
  window.openUSDIntel = openUSDIntel;
  window.closeUSDIntel = closeUSDIntel;
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const f = document.getElementById('usd-fact');
      if (f) { f.remove(); return; }
      if (document.getElementById('usd-modal')) closeUSDIntel();
    }
  });
})();
