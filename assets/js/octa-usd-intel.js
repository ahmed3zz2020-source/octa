/* ══════════════════════════════════════════════════════════════════════
   💵 ذكاء الدولار (OCTA USD INTELLIGENCE)
   كل الأرقام من الـAPI — مفيش ولا رقم في الواجهة من عندنا.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API = (window.OCTA_API || '').replace(/\/$/, '');
  const USD = { data: null, busy: false, seq: 0, mode: 'USDEGP', tf: '1D', period: '1Y', tab: 'overview', factors: null, calendar: null, news: null, tech: null, cmp: null };
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
      fetchJ('tech', '/api/usd/technical?symbol=' + USD.mode + '&tf=' + USD.tf),
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
  function chartGeo() {
    const body = document.getElementById('usd-body');
    let w = 0;
    if (body && body.clientWidth) {
      const cs = getComputedStyle(body);
      w = body.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 26;
    }
    if (!w) w = (window.innerWidth || 390) - 60;
    return { W: Math.max(300, Math.min(1000, Math.round(w))), H: 230, PAD_L: 8, PAD_R: 56, PAD_T: 12, PAD_B: 30 };
  }

  function buildChart(series, zones, mode) {
    const G = chartGeo();
    const W = G.W, H = G.H;
    if (!series || series.length < 2) return '<div class="usd-empty">📉 مفيش شموع متاحة</div>';
    const vals = series.map((b) => b.c);
    let vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals);
    if (vmin === vmax) { vmin -= 1; vmax += 1; }
    const dmin = vmin, dmax = vmax;
    const pad = (vmax - vmin) * 0.08;
    vmin -= pad; vmax += pad;
    const t0 = series[0].t, t1 = series[series.length - 1].t;
    const x = (t) => G.PAD_L + (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * (W - G.PAD_L - G.PAD_R));
    const y = (v) => G.PAD_T + (1 - (v - vmin) / (vmax - vmin)) * (H - G.PAD_T - G.PAD_B);
    let path = '', area = '';
    series.forEach((b, i) => {
      path += (i ? 'L' : 'M') + x(b.t).toFixed(1) + ' ' + y(b.c).toFixed(1);
    });
    area = path + 'L' + x(t1).toFixed(1) + ' ' + (H - G.PAD_B) + 'L' + x(t0).toFixed(1) + ' ' + (H - G.PAD_B) + 'Z';

    // مناطق الدعم/المقاومة
    let zg = '';
    (zones || []).forEach((z) => {
      const y1 = y(z.upper), y2 = y(z.lower);
      zg += '<rect class="usd-zone ' + (z.kind === 'support' ? 'sup' : 'res') + '" x="' + G.PAD_L + '" y="' +
        Math.min(y1, y2).toFixed(1) + '" width="' + (W - G.PAD_L - G.PAD_R) + '" height="' +
        Math.max(2, Math.abs(y2 - y1)).toFixed(1) + '"></rect>';
    });

    // تسميات المحور
    const nLab = W < 520 ? 3 : 5;
    let xlab = '';
    for (let i = 0; i <= nLab; i++) {
      const t = t0 + ((t1 - t0) * i) / nLab;
      const cx = x(t);
      const anch = cx < 46 ? 'start' : (cx > W - G.PAD_R - 46 ? 'end' : 'middle');
      const lx = cx < 46 ? 2 : (cx > W - G.PAD_R - 46 ? cx + 40 : cx);
      xlab += '<text class="usd-axis" x="' + lx.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + anch + '">' +
        (W < 520 ? dShort(t) : dLabel(t)) + '</text>';
    }
    const ylabels =
      '<text class="usd-axis" x="' + (W - G.PAD_R + 6) + '" y="' + (y(dmax) + 4).toFixed(1) + '" text-anchor="start">' + num(dmax, 2) + '</text>' +
      '<text class="usd-axis" x="' + (W - G.PAD_R + 6) + '" y="' + (y(dmin) + 4).toFixed(1) + '" text-anchor="start">' + num(dmin, 2) + '</text>';

    /* 📌 Ahmed: شريط قراءة أفقي فوق الرسم — مفيش حاجة معلّقة على الشارت. */
    const readout =
      '<div class="usd-readout" id="usd-readout">' +
      '<div class="usd-ro-cell"><span class="usd-ro-l">التاريخ</span><span class="usd-ro-v" id="usd-ro-date">—</span></div>' +
      '<div class="usd-ro-cell"><span class="usd-ro-l">السعر</span><span class="usd-ro-v" id="usd-ro-val">—</span></div>' +
      '<div class="usd-ro-cell"><span class="usd-ro-l">من بداية الفترة</span><span class="usd-ro-v" id="usd-ro-pct">—</span></div>' +
      '</div>';

    return readout + '<div class="usd-chart-wrap" id="usd-chart-wrap">' +
      '<svg class="usd-chart" id="usd-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" direction="ltr" role="img" aria-label="رسم بياني لسعر ' + esc(mode) + '">' +
      '<path class="usd-area" d="' + area + '" fill="url(#usdg)"></path>' +
      zg +
      '<path class="usd-line" d="' + path + '" fill="none" stroke="var(--gold)" stroke-width="1.6" vector-effect="non-scaling-stroke"></path>' +
      '<line class="usd-cross" id="usd-cross" x1="0" y1="' + G.PAD_T + '" x2="0" y2="' + (H - G.PAD_B) + '" style="opacity:0"></line>' +
      '<circle class="usd-dot" id="usd-dot" cx="0" cy="0" r="4" style="opacity:0"></circle>' +
      xlab + ylabels +
      '<defs><linearGradient id="usdg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--gold)" stop-opacity=".34"></stop>' +
      '<stop offset="100%" stop-color="var(--gold)" stop-opacity="0"></stop></linearGradient></defs>' +
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
    const dot = document.getElementById('usd-dot');
    const roDate = document.getElementById('usd-ro-date');
    const roVal = document.getElementById('usd-ro-val');
    const roPct = document.getElementById('usd-ro-pct');
    const vals = series.map((b) => b.c);
    let vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals);
    if (vmin === vmax) { vmin -= 1; vmax += 1; }
    const pad = (vmax - vmin) * 0.08;
    vmin -= pad; vmax += pad;
    const t0 = series[0].t, t1 = series[series.length - 1].t;
    const first = series[0].c;

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
      const cx = G.PAD_L + ((best.t - t0) / ((t1 - t0) || 1)) * (G.W - G.PAD_L - G.PAD_R);
      const cy = G.PAD_T + (1 - (best.c - vmin) / ((vmax - vmin) || 1)) * (G.H - G.PAD_T - G.PAD_B);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.style.opacity = '1';
      dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.style.opacity = '1';
      const fs = first ? (best.c / first - 1) * 100 : null;
      if (roDate) roDate.textContent = dLabel(best.t);
      if (roVal) roVal.textContent = num(best.c, 4);
      if (roPct) {
        roPct.textContent = fs == null ? '—' : pct(fs, 2);
        roPct.className = 'usd-ro-v ' + (fs == null ? '' : sgn(fs));
      }
    }
    function hide() {
      cross.style.opacity = '0'; dot.style.opacity = '0';
      /* 📌 عند المغادرة: الشريط يرجع لآخر نقطة */
      const last = series[series.length - 1];
      const fs = first ? (last.c / first - 1) * 100 : null;
      if (roDate) roDate.textContent = dLabel(last.t);
      if (roVal) roVal.textContent = num(last.c, 4);
      if (roPct) {
        roPct.textContent = fs == null ? '—' : pct(fs, 2);
        roPct.className = 'usd-ro-v ' + (fs == null ? '' : sgn(fs));
      }
    }
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('pointercancel', hide);
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
    return '<div class="usd-sec"><h3 class="usd-h">📈 التحليل الفني — ' + esc(t.name_ar || '') + '</h3>' +
      '<div class="usd-modes">' +
      '<button class="usd-m' + (USD.mode === 'USDEGP' ? ' on' : '') + '" data-mode="USDEGP">الدولار/الجنيه</button>' +
      '<button class="usd-m' + (USD.mode === 'DXY' ? ' on' : '') + '" data-mode="DXY">مؤشر الدولار (DXY)</button>' +
      '<button class="usd-tfbtn' + (USD.tf === '1D' ? ' on' : '') + '" data-tf="1D">يومي</button>' +
      '<button class="usd-tfbtn' + (USD.tf === '1W' ? ' on' : '') + '" data-tf="1W">أسبوعي</button>' +
      '<button class="usd-tfbtn' + (USD.tf === '1M' ? ' on' : '') + '" data-tf="1M">شهري</button>' +
      '</div>' +
      '<div class="usd-chart-box">' + buildChart(t.series, zones, t.name_ar || '') + '</div>' +
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
      ((sr.resistances || []).length ? sr.resistances.map((z) => zoneRow(z)).join('') : '<div class="usd-sm">مفيش مقاومة محسولة فوق السعر (السعر عند قمةhistorical).</div>') +
      '</div>' +
      '<div class="usd-note">📌 طريقة الحساب: ' + esc(sr.method || '') + '. ' + esc(sr.note || '') +
      ' البيانات ' + esc(t.from || '') + ' → ' + esc(t.to || '') + ' (' + (t.bars || 0) + ' شمعة) · المصدر: ' + esc(t.source || '') + '</div>' +
      '</div>';
  }

  function zoneRow(z) {
    const dir = z.distance_pct >= 0 ? 'فوق السعر' : 'تحت السعر';
    return '<div class="usd-zone-row">' +
      '<div class="usd-zr-p">' + num(z.lower, 4) + ' — ' + num(z.upper, 4) + '</div>' +
      '<div class="usd-zr-m">' + num(Math.abs(z.distance_pct), 2) + '٪ ' + dir + ' · ' + z.touches + ' لمسة · قوة ' + z.strength + '/100</div>' +
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
      b.onclick = () => { USD.tf = b.getAttribute('data-tf'); USD.tech = null; render(); loadTech(); };
    });
    body.querySelectorAll('[data-fkey]').forEach((b) => {
      b.onclick = () => openFactor(b.getAttribute('data-fkey'));
    });
  }

  async function loadTech() {
    const j = await fetchJ('tech', '/api/usd/technical?symbol=' + USD.mode + '&tf=' + USD.tf);
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
