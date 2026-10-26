/* ════════════════════════════════════════════════════════════════════════════
 🕌 ذكاء المؤشرات — OCTA INDEX INTELLIGENCE
 ٢٦ أكتوبر ٢٠٢٦
 ════════════════════════════════════════════════════════════════════════════
 📌 «مش مجرد رقم بيتحرك على الشاشة. افهم اتجاه المؤشر، تاريخه، مراحل
    الصعود والهبوط، المخاطر، وأهم الإشارات اللي تساعدك في قراءة السوق.»
 📌 كل رقم جاي من الـAPI (اللي بيحسبه محرك تحليل المؤشرات في الباك).
    ⛔ مفيش أي رقم متظبطة هنا — العرض بس.
 📌 ⛔ مفيش أي ذكر لأدوات ذكاء اصطناعي في الكود أو الواجهة.
 ════════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const API = (typeof OCTA_API !== 'undefined') ? OCTA_API : '';
  const IX = {};              /* كاش لكل مؤشر */
  let IX_SEQ = 0;            /* عشان نلغي الردود القديمة */

  const PERIODS = [
    ['1M', 'شهر'], ['3M', '٣ شهور'], ['6M', '٦ شهور'], ['YTD', 'من بداية السنة'],
    ['1Y', 'سنة'], ['3Y', '٣ سنين'], ['5Y', '٥ سنين'], ['10Y', '١٠ سنين'], ['MAX', 'الكل'],
  ];

  const PHASE_LABEL = {
    uptrend: 'مرحلة صعود',
    major_drawdown: 'مرحلة هبوط حاد',
    correction: 'تصحيح',
    consolidation: 'مرحلة تذبذب',
  };

  const REGIME_LABEL = {
    strong_uptrend: 'اتجاه صاعد بقوة',
    uptrend: 'اتجاه صاعد',
    sideways: 'عرضي',
    downtrend: 'اتجاه هابط',
    strong_downtrend: 'اتجاه هابط بقوة',
    high_volatility: 'تقلب عالي',
    recovery: 'تعافٍ',
    uncertain: 'اتجاه غير واضح',
  };

  const REGIME_ICON = {
    strong_uptrend: '📈', uptrend: '📈', sideways: '➖', downtrend: '📉',
    strong_downtrend: '📉', high_volatility: '⚡', recovery: '🔄', uncertain: '❓',
  };

  /* ── أدوات ───────────────────────────────────────────────────────────── */
  const _ = (s) => document.createElement(s);
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* ⛔⛔⛔ إشارات الأرقام جوّه نص عربي (RTL) بتتقلب: «-71.6%» بتظهر «71.6%-»
     📌 السبب: الشرطة قبل الرقم بتتعتبر محرف محايد ⇒ بتاخد اتجاه الفقرة.
     📌 الحل: نعزل الرقم بعلامات العزل (LRI/PDI) — Unicode U+2066 / U+2069.
     📌 ده بيشتغل سواء النص اتهرّب (escaped) أو اتحط HTML — بخلاف الـspan. */
  const LRI = '\u2066', PDI = '\u2069';
  function lnum(v) { return LRI + v + PDI; }
  /* 📌 نسبة بنفس الشكل في كل مكان (العلامة جوه العزل) */
  function pctN(v, d) {
    if (v == null || isNaN(v)) return '—';
    d = (d === undefined) ? 2 : d;
    return lnum((v >= 0 ? '+' : '') + Number(v).toFixed(d) + '%');
  }
  function num(v, d) {
    if (v == null || isNaN(v)) return '—';
    d = (d === undefined) ? 2 : d;
    return lnum(Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
  }
  function pct(v, d) {
    if (v == null || isNaN(v)) return '—';
    d = (d === undefined) ? 2 : d;
    return lnum((v >= 0 ? '+' : '') + Number(v).toFixed(d) + '%');
  }
  function dayTs(ts) {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  /* ⛔⛔⛔ التاريخ في سطر عربي (RTL) بيتكسّر: الرقم الأول بيطير لآخر السطر
     📌 الحل: نلفّ التاريخ في span اتجاهه LTR ومفيش كسر (§unicode-bidi). */
  /* ⛔ المدى كله لازم يكون في كتلة LTR واحدة — وإلا السهم ورتّبوا مع بعض غلط */
  function drange(a, b) {
    const t = dayTs(a) + (b && b !== a ? ' \u2192 ' + dayTs(b) : '');
    return '<span class="ix-date">' + t + '</span>';
  }
  function shortDay(ts) {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  /* 📌 شرح كل وضع عرض بلغة بسيطة */
  const MODE_LEGEND = {
    value: 'رقم المؤشر (نقطة)',
    normalized: 'النسبة (خط الأساس = 100)',
    drawdown: 'التراجع عن القمة (0 = على القمة)',
  };
  const MODE_HELP = {
    value: 'أعلى وأدنى رقم وصله المؤشر في الفترة دي. اضغط على أي مكان على الرسم عشان تشوف قيمته ونسبته في اليوم ده.',
    normalized: 'كل المؤشرات بتبدأ من 100 في أول يوم للفترة — كده نقارن صعود ونزول من نفس نقطة البداية. الرقم فوق 100 يعني صعود عن بداية الفترة.',
    drawdown: 'التراجع عن أعلى نقطة وصلها المؤشر في الفترة. 0 يعني المؤشر على قمته، و-30 يعني نزل 30% من قمته.',
  };

  /* 📅 أسماء الشهور بالعربي — Ahmed طلب إن المحور يبين السنة */
  const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  function arMonth(ts) { return AR_MONTHS[new Date(ts * 1000).getMonth()]; }
  function arYear(ts) { return new Date(ts * 1000).getFullYear(); }
  function arDay(ts) { return new Date(ts * 1000).getDate(); }
  /* 📅 تسمية المحور: يوم + شهر + سنة */
  function axLabel(ts) { return arDay(ts) + ' ' + arMonth(ts) + ' ' + arYear(ts); }
  /* 📐 هندسة الرسم — بتتحسب مرة واحدة وبتتشرك بين البناء والتفاعل
     ⛔⛔⛔ P1: كنا بنخمن العرض من window.innerWidth ⇒ على الديسكتوب الـviewBox
     أوسع من الكارت ⇒ النص بيتصغّر. الحل: نقيس العرض الحقيقي بعد أول رسم. */
  let CHART_W = 0;
  function chartGeo() {
    let w = CHART_W;
    if (!w) {
      const body = document.getElementById('ix-body');
      if (body && body.clientWidth) {
        const cs = getComputedStyle(body);
        const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        w = body.clientWidth - padX - 28;   /* 28 = حشو الكارت */
      }
    }
    if (!w) w = (window.innerWidth || 390) - 46;
    const W = Math.max(300, Math.min(1100, Math.round(w)));
    return { W: W, H: 250, PAD_L: 10, PAD_R: 58, PAD_T: 14, PAD_B: 38 };
  }
  /* 📌 بعد أول رسم: نقيس العرض الحقيقي ونصحّح لو فيه فرق */
  function syncChartWidth(ixId) {
    const svg = document.getElementById('ix-chart');
    const st = IX[ixId];
    if (!svg || !st) return;
    const real = Math.round(svg.getBoundingClientRect().width);
    const cur = (st.geo || {}).W || 0;
    if (!real || Math.abs(real - cur) < 5) return;
    CHART_W = real;
    const wrap = document.getElementById('ix-chart-wrap');
    const view = buildView(ixId);
    const chart = buildChart(ixId, view.series, st.mode, st.data.events);
    if (wrap) { wrap.outerHTML = chart; bindChart(ixId); }
  }
  /* ⛔⛔⛔ روابط من البيانات: نقبل http/https بس (مش javascript:) */
  function safeUrl(u) {
    const s = String(u || '').trim();
    return /^https?:\/\//i.test(s) ? s : '#';
  }
  function signClass(v) { return v > 0 ? 'pos' : (v < 0 ? 'neg' : ''); }
  function dirIcon(v) { return v > 0 ? '▲' : (v < 0 ? '▼' : '■'); }

  /* ══════════════════════════════════════════════════════════════════════
   ① المودال
   ══════════════════════════════════════════════════════════════════════ */
  function closeIndexIntel() {
    /* ⛔⛔⛔ P0: الرد المعلّق كان بيكتب على #ix-body بعد ما المودال يتشال
       📌 الحل: نزوّد الـseq ⇒ أي رد قديم يتجاهل. */
    IX_SEQ++;
    const m = document.getElementById('ix-modal');
    if (m) m.remove();
    document.body.style.overflow = '';
    if (typeof octaWeightsReady === 'function') { try { octaWeightsReady(); } catch (e) { } }
  }

  async function openIndexIntel(ixId) {
    ixId = String(ixId || '').toUpperCase();
    const old = document.getElementById('ix-modal');
    if (old) old.remove();
    document.body.style.overflow = 'hidden';

    const wrap = _('div');
    wrap.id = 'ix-modal';
    wrap.className = 'ix-overlay';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'تحليل المؤشر');
    wrap.onclick = (e) => { if (e.target === wrap) closeIndexIntel(); };
    wrap.innerHTML =
      '<div class="ix-box">' +
      '<div class="ix-head">' +
      '<div><div class="ix-title" id="ix-title">جارِ التحميل…</div>' +
      '<div class="ix-sub" id="ix-sub"></div></div>' +
      '<button class="ix-cmp-btn" onclick="openIndexCompare()" title="مقارنة المؤشرات" aria-label="مقارنة المؤشرات">⚖️<span class="ix-cmp-txt"> مقارنة</span></button>' +
      '<button class="ix-close" onclick="closeIndexIntel()" aria-label="إغلاق">✕</button>' +
      '</div>' +
      '<div class="ix-body" id="ix-body"><div class="ix-loading">⏳ جاري تحميل بيانات المؤشر…</div></div>' +
      '</div>';
    document.body.appendChild(wrap);
    /* 📌 P2: بعد الفتح التركيز لازم يروح جوّه المودال (مش الزرار اللي فاتح) */
    const box = wrap.querySelector('.ix-box');
    if (box) { try { box.setAttribute('tabindex', '-1'); box.focus({ preventScroll: true }); } catch (e) { } }

    const seq = ++IX_SEQ;
    IX[ixId] = IX[ixId] || { period: 'MAX', mode: 'value', view: null, data: null };

    try {
      const r = await octaFetch(API + '/api/indices/' + encodeURIComponent(ixId) + '/analysis?period=' + IX[ixId].period);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (seq !== IX_SEQ) return;
      const bodyEl = document.getElementById('ix-body');
      if (!bodyEl) return;
      if (!d || !d.ok) {
        bodyEl.innerHTML =
          '<div class="ix-empty">📉 ' + esc((d && d.error) || 'البيانات غير متاحة') + '</div>';
        return;
      }
      IX[ixId].data = d;
      renderIndexIntel(ixId);
    } catch (e) {
      if (seq !== IX_SEQ) return;
      document.getElementById('ix-body').innerHTML =
        '<div class="ix-empty">❌ تعذر تحميل التحليل (' + esc(e.message || 'خطأ') + ')</div>';
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
   ② الرسم — مرسم بنفسي (SVG) خفيف: خط/مساحة + محور + tooltip + سحب
   ══════════════════════════════════════════════════════════════════════ */
  function buildChart(ixId, series, mode, events) {
    /* ⛔⛔⛔ العرض لازم يبقى بنفس نسبة الـviewBox عشان الأرقام متت تشوّه
    📌 كنا بنستخدم 720 ثابت + preserveAspectRatio=none ⇒ النص كان بيتشوّه.
    📌 ✅ الحل: نحسب العرض من عرض الشاشة ⇒ 1 وحدة = 1 بكسل.
    📌 📌 الأهم: الهندسة بتتخزّن في st.view.geo ⇒ البناء والتفاعل بيستخدموا نفس الأرقام
       (كان في bindChart نسخة تانية ثابتة ⇒ ReferenceError: H is not defined). */
    const G = chartGeo();
    const W = G.W, H = G.H, PAD_L = G.PAD_L, PAD_R = G.PAD_R, PAD_T = G.PAD_T, PAD_B = G.PAD_B;
    if (!series || series.length < 2) return '<div class="ix-empty">📉 مفيش بيانات للرسم</div>';
    if (IX[ixId]) IX[ixId].geo = G;

    const vals = series.map(p => p[1]);
    const t0 = series[0][0], t1 = series[series.length - 1][0];
    let vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals);
    if (vmin === vmax) { vmin -= 1; vmax += 1; }
    /* ⛔⛔⛔ قبل ما نوسّع المحور: نحفظ القيم الحقيقية
       📌 كنا بنعرض «vmax - padv» ⇒ رقم تقريبي مختلف عن الإحصاء. */
    const dmin = vmin, dmax = vmax;
    const padv = (vmax - vmin) * 0.08;
    vmin -= padv; vmax += padv;

    const x = (t) => PAD_L + (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * (W - PAD_L - PAD_R));
    const y = (v) => PAD_T + (1 - (v - vmin) / (vmax - vmin)) * (H - PAD_T - PAD_B);

    let path = '', area = '';
    series.forEach(function (p, i) {
      const cx = x(p[0]).toFixed(1), cy = y(p[1]).toFixed(1);
      path += (i ? 'L' : 'M') + cx + ' ' + cy;
    });
    area = path + 'L' + x(t1).toFixed(1) + ' ' + (H - PAD_B) + 'L' + x(t0).toFixed(1) + ' ' + (H - PAD_B) + 'Z';

    /* علامات الأحداث */
    let marks = '';
    (events || []).forEach(function (e) {
      const ts = e.start_ts;
      if (ts == null || ts < t0 || ts > t1) return;
      const cx = x(ts).toFixed(1);
      marks += '<circle class="ix-ev-mark" cx="' + cx + '" cy="' + (H - PAD_B + 7) + '" r="4" ' +
        'tabindex="0" role="button" aria-label="' + esc(e.title_ar || 'حدث') + '" ' +
        'data-ev=\'' + esc(JSON.stringify(e)) + '\'></circle>';
    });

    /* علامات المحور — يوم + شهر + سنة (Ahmed طلب السنة تكون باينة) */
    /* 📌 عدد التسميات: على الموبايل التسمية أطول (يوم + شهر + سنة) ⇒ ٣ تسميات
       ⛔ ٤ تسميات كانت بتتخانق في النص. */
    const nLab = W < 520 ? 2 : 5;
    let xlab = '';
    for (let i = 0; i <= nLab; i++) {
      const t = t0 + ((t1 - t0) * i) / nLab;
      const cx = x(t).toFixed(1);
      /* ⛔ أول/آخر تسمية كانت بتتقص — نثبّت المحاذاة */
      const anch = cx < 46 ? 'start' : (cx > W - PAD_R - 46 ? 'end' : 'middle');
      const lx = cx < 46 ? 2 : (cx > W - PAD_R - 46 ? cx + 42 : cx);
      xlab += '<text class="ix-axis" x="' + lx + '" y="' + (H - 8) + '" text-anchor="' + anch + '">' + axLabel(t) + '</text>';
    }

    /* ⛔⛔⛔ كان بنكتب الـvmax بعد الـpadding ⇒ الرقم كان أعلى من القمة الحقيقية
       📌 مثال: قمة EGX100 الحقيقية 28,292.60 والمحور كان بيقول 30,361 ⇒ المستخدم
          فكّر إن ده القمة. الحل: نكتب القيم الحقيقية على المحور. */
    /* 📌 التسمية تقف عند موضع القيمة نفسها على الرسم (مش عند طرف المحور) */
    const yOf = (v) => PAD_T + (1 - (v - vmin) / (vmax - vmin)) * (H - PAD_T - PAD_B);
    const ylabels =
      '<text class="ix-axis" x="' + (W - PAD_R + 6) + '" y="' + (yOf(dmax) + 4).toFixed(1) + '" text-anchor="start">' + num(dmax, 0) + '</text>' +
      '<text class="ix-axis" x="' + (W - PAD_R + 6) + '" y="' + (yOf(dmin) + 4).toFixed(1) + '" text-anchor="start">' + num(dmin, 0) + '</text>';

    return '<div class="ix-chart-wrap" id="ix-chart-wrap" data-ix="' + esc(ixId) + '">' +
      '<svg class="ix-chart" id="ix-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" direction="ltr" ' +
      'role="img" aria-label="رسم بياني تاريخي لقيمة المؤشر">' +
      '<defs><linearGradient id="ixg' + esc(ixId) + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--gold)" stop-opacity=".38"/>' +
      '<stop offset="100%" stop-color="var(--gold)" stop-opacity="0"/></linearGradient></defs>' +
      '<path class="ix-area" d="' + area + '" fill="url(#ixg' + esc(ixId) + ')"/>' +
      '<path class="ix-line" d="' + path + '" fill="none" stroke="var(--gold)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>' +
      '<line class="ix-cross" id="ix-cross" x1="0" y1="' + PAD_T + '" x2="0" y2="' + (H - PAD_B) + '" style="opacity:0"/>' +
      '<circle class="ix-dot" id="ix-dot" cx="0" cy="0" r="4" style="opacity:0"/>' +
      marks + xlab + ylabels + '</svg>' +
      '<div class="ix-axis-note">' + (mode === 'drawdown'
        ? 'أكبر تراجع في الفترة: ' + num(dmin, 1) + '%'
        : (mode === 'normalized'
          ? 'أعلى نسبة: ' + num(dmax, 1) + ' · أدنى نسبة: ' + num(dmin, 1) + ' (خط الأساس = 100)'
          : 'أعلى: ' + num(dmax, 2) + ' · أدنى: ' + num(dmin, 2))) + '</div>' +
      '</div>';
  }

  /* تحريك المؤشر على الرسم (ماوس + لمس) */
  /* 📌 تهيئة الشريط على آخر نقطة */
  function resetReadout(ixId) {
    const st = IX[ixId];
    if (!st || !st.view) return;
    const series = st.view.series || [];
    if (!series.length) return;
    const last = series[series.length - 1];
    const base = series[0] ? series[0][1] : null;
    const d = document.getElementById('ix-ro-date');
    const v = document.getElementById('ix-ro-val');
    const pc = document.getElementById('ix-ro-pct');
    const vl = document.getElementById('ix-ro-vlabel');
    const pl = document.getElementById('ix-ro-plabel');
    if (!d || !v || !pc) return;
    const mode = st.mode || 'value';
    d.textContent = axLabel(last[0]);
    if (mode === 'drawdown') {
      v.textContent = num(last[1], 1) + '%';
      pc.textContent = '—';
      pc.className = 'ix-ro-v';
      if (vl) vl.textContent = 'التراجع عن القمة';
      if (pl) pl.textContent = 'تغيّر التراجع عن النقطة السابقة';
    } else if (mode === 'normalized') {
      v.textContent = num(last[1], 1);
      const fs = last[1] - 100;
      pc.textContent = pct(fs, 1);
      pc.className = 'ix-ro-v ' + signClass(fs);
      if (vl) vl.textContent = 'النسبة (خط الأساس = 100)';
      if (pl) pl.textContent = 'من بداية الفترة';
    } else {
      v.textContent = num(last[1], 2);
      const fs = base ? (last[1] / base - 1) * 100 : null;
      pc.textContent = (fs == null ? '—' : pct(fs, 1));
      pc.className = 'ix-ro-v ' + (fs == null ? '' : signClass(fs));
      if (vl) vl.textContent = 'رقم المؤشر';
      if (pl) pl.textContent = 'من بداية الفترة';
    }
  }

  function bindChart(ixId) {
    const wrap = document.getElementById('ix-chart-wrap');
    const svg = document.getElementById('ix-chart');
    if (!wrap || !svg) return;
    const st = IX[ixId];
    if (!st || !st.view) return;
    const series = st.view.series;
    if (!series || series.length < 2) return;

    const cross = document.getElementById('ix-cross');
    const dot = document.getElementById('ix-dot');
    /* 📌 الشريط الأفقي فوق الرسم — هنا الأرقام بتتحرك مع التحرك على المنحنى
       📌 Ahmed: مفيش حاجة ظاهرة على الشارت (شالنا الـtooltip وال-box المعلّق). */
    const roDate = document.getElementById('ix-ro-date');
    const roVal = document.getElementById('ix-ro-val');
    const roPct = document.getElementById('ix-ro-pct');
    const roVLbl = document.getElementById('ix-ro-vlabel');
    const roPLbl = document.getElementById('ix-ro-plabel');
    /* ⛔⛔⛔ كنا بنستخدم أرقام ثابتة (720/8/46/260) هنا — والبناء بيستخدم أرقام تانية
       ⇒ ReferenceError: H is not defined + الماوس بيشاور على مكان غلط.
       📌 ✅ الحل: الهندسة بتتشرك من buildChart. */
    const G = st.geo || chartGeo();
    const W = G.W, H = G.H, PAD_L = G.PAD_L, PAD_R = G.PAD_R, PAD_T = G.PAD_T, PAD_B = G.PAD_B;
    const mode = st.mode || 'value';
    /* 📌 عائد الفترة: أول قيمة في السلسلة ⇒ الأساس 100% */
    const baseVal = series[0] ? series[0][1] : null;

    function nearest(clientX) {
      const r = svg.getBoundingClientRect();
      const rel = ((clientX - r.left) / r.width) * W;
      const t0 = series[0][0], t1 = series[series.length - 1][0];
      const span = (W - PAD_L - PAD_R) || 1, dt = (t1 - t0) || 1;
      const frac = (rel - PAD_L) / span;
      const target = t0 + frac * dt;
      let best = series[0], bd = Infinity;
      for (let i = 0; i < series.length; i++) {
        const d = Math.abs(series[i][0] - target);
        if (d < bd) { bd = d; best = series[i]; }
      }
      return best;
    }

    function show(ev) {
      const p = nearest(ev.clientX);
      const t = p[0], v = p[1];
      const r = svg.getBoundingClientRect();
      const vmin = st.view.vmin, vmax = st.view.vmax;
      const y = PAD_T + (1 - (v - vmin) / (vmax - vmin)) * (H - PAD_T - PAD_B);
      const _span = (series[series.length - 1][0] - series[0][0]) || 1;
      const cx = PAD_L + ((t - series[0][0]) / _span) * (W - PAD_L - PAD_R);
      const px = (cx / W) * r.width, py = (y / H) * r.height;
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.style.opacity = '1';
      dot.setAttribute('cx', cx); dot.setAttribute('cy', y); dot.style.opacity = '1';
      const prev = st.view.prev[t];
      const chg = prev ? ((v / prev - 1) * 100) : null;
      /* 📌 النسبة الأساسية: من أول يوم في الفترة (ده اللي Ahmed طلبه) */
      let fromStart = null;
      if (mode === 'value' && baseVal) fromStart = (v / baseVal - 1) * 100;
      else if (mode === 'normalized') fromStart = v - 100;
      else if (mode === 'drawdown') fromStart = v;
      const ph = (st.view.phases || []).find(pp => t >= pp.start && t <= pp.end);

      /* 📌 Ahmed: مفيش حاجة ظاهرة على الشارت أثناء التحرك
         ⇒ الأرقام كلها في الشريط الأفقي فوق الرسم فوق الرسم. */
      /* ⛔⛔⛔ السلسلة المختصرة معناها كل نقطة ≈ عدة أيام
         📌 فالتسمية «تغير اليوم» كانت كاذبة ⇒ «التغير عن النقطة السابقة». */
      /* 📌 الشريط الأفقي فوق الرسم: التاريخ + رقم المؤشر + النسبة */
      if (roDate) roDate.textContent = axLabel(t);
      if (roVal) {
        roVal.textContent = (mode === 'drawdown') ? num(v, 1) + '%'
          : (mode === 'normalized' ? num(v, 1) : num(v, 2));
        roVal.className = 'ix-ro-v ' + (mode === 'drawdown' ? signClass(v) : '');
      }
      if (roPct) {
        if (mode === 'drawdown') {
          roPct.textContent = (chg == null ? '—' : pct(chg, 1));
          roPct.className = 'ix-ro-v ' + (chg == null ? '' : signClass(chg));
        } else {
          roPct.textContent = (fromStart == null ? '—' : pct(fromStart, 1));
          roPct.className = 'ix-ro-v ' + (fromStart == null ? '' : signClass(fromStart));
        }
      }
      if (roVLbl) roVLbl.textContent = (mode === 'drawdown') ? 'التراجع عن القمة'
        : (mode === 'normalized' ? 'النسبة (خط الأساس = 100)' : 'رقم المؤشر');
      if (roPLbl) roPLbl.textContent = (mode === 'drawdown') ? 'تغيّر التراجع عن النقطة السابقة'
        : 'من بداية الفترة';
    }
    function hide() {
      cross.style.opacity = '0'; dot.style.opacity = '0';
      /* 📌 لما يسيب الرسم ⇒ الشريط يرجع لآخر نقطة (الحالة الطبيعية) */
      const last = series[series.length - 1];
      if (last && roDate) {
        roDate.textContent = axLabel(last[0]);
        if (roVal) roVal.textContent = (mode === 'drawdown') ? num(last[1], 1) + '%'
          : (mode === 'normalized' ? num(last[1], 1) : num(last[1], 2));
        if (roPct) {
          if (mode === 'drawdown') { roPct.textContent = '—'; roPct.className = 'ix-ro-v'; }
          else {
            const fs = (mode === 'normalized') ? last[1] - 100
              : (baseVal ? (last[1] / baseVal - 1) * 100 : null);
            roPct.textContent = (fs == null ? '—' : pct(fs, 1));
            roPct.className = 'ix-ro-v ' + (fs == null ? '' : signClass(fs));
          }
        }
      }
    }
    /* 📌 pointer events: ماوس + لمس + قلم في حدث واحد */
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('pointercancel', hide);

    /* علامات الأحداث */
    svg.querySelectorAll('.ix-ev-mark').forEach(function (c) {
      function openEv() {
        try {
          const e = JSON.parse(c.getAttribute('data-ev'));
          showEventCard(ixId, e);
        } catch (err) { }
      }
      c.addEventListener('click', openEv);
      c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEv(); } });
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
   ③ العرض الرئيسي
   ══════════════════════════════════════════════════════════════════════ */
  function renderIndexIntel(ixId) {
    const st = IX[ixId];
    const d = st.data;
    const th = d.thresholds || {};
    const ix = d.index || {};
    const live = (d.live && d.live.official) || {};
    const liveNow = (d.live && d.live.now) || {};
    const stt = d.stats || {};
    const reg = d.regime || {};
    const cov = d.coverage || {};
    const ms = d.market_status || {};

    document.getElementById('ix-title').innerHTML =
      '<span class="ix-dotc" style="background:' + esc(ix.accent || 'var(--gold)') + '"></span>' +
      esc(ix.name_ar || ixId) + ' <span class="ix-en">' + esc(ix.name_en || '') + '</span>';
    document.getElementById('ix-sub').textContent =
      (ix.short_ar ? ix.short_ar + ' · ' : '') + 'القيمة الحالية: البورصة المصرية · السلسلة اليومية: TradingView · ' +
      (ms.status_ar || (ms.status === 'Open' ? 'مفتوح' : 'مغلق')) +
      (ms.as_of ? ' (' + String(ms.as_of).slice(11, 16) + ')' : '');

    const val = live.value != null ? live.value : liveNow.value;
    const chg = live.change_pct != null ? live.change_pct : liveNow.change;

    /* الكارت العلوي */
    let hero = '<div class="ix-hero">' +
      '<div class="ix-hero-val">' +
      '<div class="ix-k">قيمة المؤشر</div>' +
      '<div class="ix-v">' + num(val, 2) + '</div>' +
      '<div class="ix-c ' + signClass(chg) + '">' + dirIcon(chg) + ' ' + pct(chg) +
      (live.change != null ? ' (' + num(live.change, 2) + ' نقطة)' : '') + '</div>' +
      '</div>' +
      '<div class="ix-hero-side">' +
      miniStat('أعلى اليوم', live.high != null ? num(live.high, 2) : '—') +
      miniStat('أدنى اليوم', live.low != null ? num(live.low, 2) : '—') +
      miniStat('من بداية السنة', live.ytd_pct != null ? pct(live.ytd_pct) : '—', signClass(live.ytd_pct)) +
      '</div></div>';

    /* 📌 لو الإغلاق المباشر مش متاح ⇒ نقول بوضوح إن الرقم من آخر لقطة رسمية */
    const noLive = (liveNow.value == null);
    const liveNote = noLive
      ? '<div class="ix-badge warn">⚠️ الرقم الظاهر من آخر لقطة رسمية من البورصة (' +
        esc((d.live && d.live.snapshot_date) || '—') + ') — الإغلاق المباشر غير متاح دلوقتي.</div>'
      : '';

    /* حالة البيانات */
    const dataStatus = '<div class="ix-datastat">' + liveNote +
      '<span class="ix-badge ' + (ms.status === 'Open' ? 'live' : 'closed') + '">' +
      (ms.status === 'Open' ? '🟢 السوق مفتوح' : '⚪ السوق مغلق') + '</span>' +
      /* ⛔⛔⛔ المدى لازم يكون في كتلة LTR واحدة (.ix-date = direction:ltr + isolate)
         📌 بدونها: في السياق العربي (RTL) السهم بيقلب الترتيب ⇒ يظهر
         📌 «2026-10-26 → 2026-04-28» (النهاية قبل البداية) — والسبب في الكود.
         📌 نفس الباج كان في مودال الدولار (usd-intel) — اتصلح بنفس الطريقة. */
      '<span class="ix-badge">📅 تغطية البيانات (كل المدة): <span class="ix-date">' + esc(cov.from || '—') + ' → ' + esc(cov.to || '—') + '</span></span>' +
      '<span class="ix-badge">📊 أيام التداول في البيانات كلها: ' + num(cov.count, 0) + '</span>' +
      (cov.note ? '<span class="ix-badge warn">ℹ️ ' + esc(cov.note) + '</span>' : '') +
      '</div>';

    /* أزرار الفترات */
    let perBtns = '<div class="ix-periods" role="group" aria-label="اختر الفترة">';
    PERIODS.forEach(function (p) {
      perBtns += '<button class="ix-per' + (st.period === p[0] ? ' on' : '') + '" data-per="' + p[0] + '" ' +
        'aria-pressed="' + (st.period === p[0] ? 'true' : 'false') + '">' + p[1] + '</button>';
    });
    perBtns += '</div>';

    /* أزرار طريقة العرض */
    /* 📌 Ahmed ما فهمش «نسبة مطبّعة» و«التراجع عن القمة» ⇒ أسماء أوضح + شرح */
    const modes = [['value', 'رقم المؤشر'], ['normalized', 'نسبة البداية (خط الأساس = 100)'], ['drawdown', 'انخفاضه من القمة']];
    let modeBtns = '<div class="ix-modes">';
    modes.forEach(function (m) {
      modeBtns += '<button class="ix-mode' + (st.mode === m[0] ? ' on' : '') + '" data-mode="' + m[0] + '" ' +
        'aria-pressed="' + (st.mode === m[0] ? 'true' : 'false') + '">' + m[1] + '</button>';
    });
    modeBtns += '</div>';

    /* 📌 شريط القراءة الأفقي فوق الرسم (مرة واحدة — مش مع كل إعادة رسم) */
    const readoutHtml = '<div class="ix-readout" id="ix-readout">' +
      '<div class="ix-ro-cell"><span class="ix-ro-l">التاريخ</span><span class="ix-ro-v" id="ix-ro-date">—</span></div>' +
      '<div class="ix-ro-cell"><span class="ix-ro-l" id="ix-ro-vlabel">رقم المؤشر</span><span class="ix-ro-v" id="ix-ro-val">—</span></div>' +
      '<div class="ix-ro-cell"><span class="ix-ro-l" id="ix-ro-plabel">من بداية الفترة</span><span class="ix-ro-v" id="ix-ro-pct">—</span></div>' +
      '</div>';

    /* الرسم */
    const view = buildView(ixId);
    const chart = buildChart(ixId, view.series, st.mode, d.events);

    /* إحصائيات الفترة */
    let stats = '<div class="ix-stats">';
    stats += statCard('عائد الفترة', pct(stt.return_pct), signClass(stt.return_pct),
      'نسبة التغير من أول إغلاق للفترة لآخر إغلاق فيها.');
    stats += statCard('التغير المطلق', (stt.abs_change != null ? num(stt.abs_change, 2) : '—'),
      signClass(stt.abs_change), 'الفرق بالنقاط بين أول إغلاق وآخر إغلاق في الفترة.');
    stats += statCard('أعلى قيمة', num(stt.high), '', 'أعلى إغلاق وصله المؤشر داخل الفترة.');
    stats += statCard('أدنى قيمة', num(stt.low), '', 'أقل إغلاق وصله المؤشر داخل الفترة.');
    stats += statCard('متوسط الفترة', num(stt.avg), '', 'المتوسط الحسابي لإغلاقات الفترة.');
    const dd = stt.max_drawdown || {};
    stats += statCard('أقصى هبوط', pct(dd.pct), 'neg',
      'أكبر انخفاض من قمة سابقة إلى قاع لاحق خلال الفترة المحددة.');
    const vol = stt.volatility || {};
    stats += statCard('التقلب السنوي', vol.latest != null ? pct(vol.latest, 1) : '—', '',
      'انحراف معياري للعيائد اليومية (٣٠ يوم) مضروب في جذر ٢٥٢. بيقيس التشتّت مش احتمال الخسارة.');
    const rec = stt.recovery || {};
    stats += statCard('عدد أيام التعافي', rec.recovered ? '✅ تعافى' : '⏳ لم يتعافَ', rec.recovered ? 'pos' : '',
      rec.recovered
        ? 'رجع المؤشر لمستوى ما قبل الهبوط بعد ' + num(rec.days_to_recover, 0) + ' يوم من القمة.'
        : 'لم يسترد المؤشر القمة السابقة حتى آخر بيانات متاحة.');
    stats += statCard('أيام صاعدة', num(stt.positive_periods, 0) + ' / ' + num(stt.negative_periods, 0),
      '', 'عدد الأيام الصاعدة مقابل الهابطة داخل الفترة.');
    stats += '</div>';

    /* حالة السوق */
    const regHtml = '<div class="ix-regime ix-reg-' + esc(reg.regime || 'uncertain') + '">' +
      '<div class="ix-regime-head"><span class="ix-regime-ico">' + (REGIME_ICON[reg.regime] || '❓') + '</span>' +
      '<div><div class="ix-regime-t">حالة المؤشر: ' + esc(REGIME_LABEL[reg.regime] || 'غير محدد') + '</div>' +
      '<div class="ix-regime-c">درجة الثقة ' + num(reg.confidence, 0) + '٪ — تقدير داخلي للمحرك، مش احتمال ولا تنبؤ</div></div></div>' +
      '<ul class="ix-reasons">' + (reg.reasons || []).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' +
      '<div class="ix-note">📌 التصنيف بيشرح إيه اللي حصل في الفترة المختارة — مش تنبؤ بالمستقبل، ومفيش أي توصية شراء أو بيع.</div>' +
      '</div>';

    /* التعليم */
    const ed = ix.education || {};
    const eduHtml = '<div class="ix-sec"><h3 class="ix-h">📚 المؤشر ده بيقيس إيه؟</h3>' +
      '<div class="ix-edu">' +
      eduBlock('يعني إيه', ed.what_is) +
      eduBlock('بيتكوّن من إيه', ed.constituents) +
      eduBlock('إزاي بيتحسب', ed.calculation) +
      eduBlock('إيه اللي بيحرّكه', ed.what_moves) +
      eduBlock('بيقولك إيه', ed.what_tells) +
      eduBlock('مش بيقولك إيه', ed.what_not_tells, 'warn') +
      eduBlock('المقارنة بمؤشر تاني', ed.vs_market) +
      '</div></div>';

    /* المنهجية الرسمية */
    const off = ix.official || {};
    const offHtml = '<div class="ix-sec"><h3 class="ix-h">🏛️ معلومات رسمية من البورصة المصرية</h3>' +
      '<div class="ix-offgrid">' +
      offCell('تاريخ بدء المؤشر', off.inception_date) +
      offCell('قيمة الأساس', off.base_value != null ? num(off.base_value, 0) + ' نقطة' : null) +
      offCell('عدد المكونات', off.constituents_count != null ? num(off.constituents_count, 0) + ' شركة' : null) +
      offCell('بدأ نشر المؤشر', off.disseminated_from) +
      offCell('نسخة الدولار', off.usd_from ? ('بدأت من ' + off.usd_from) : null) +
      offCell('طريقة الوزن', off.weight_method) +
      offCell('وزن كل مكون', off.weight_pct != null ? num(off.weight_pct, 2) + '٪' : null) +
      offCell('شروط القبول', off.eligibility) +
      offCell('المراجعة الدورية', off.revision) +
      '</div></div>';

    /* المراحل */
    const phases = d.phases || [];
    let phasesHtml = '<div class="ix-sec"><h3 class="ix-h">🗺️ مراحل المؤشر عبر الزمن</h3>' +
      '<div class="ix-note">المراحل دي محسوبة آلياً من البيانات الحقيقية (مش يدوية) — ' +
      'هبوط حاد = ' + (th && th.major_drawdown != null ? num(Math.abs(th.major_drawdown), 0) + '٪' : '—') +
      ' أو أكتر من القمة، وتصحيح = بين ' + (th && th.correction != null ? num(Math.abs(th.correction), 0) + '٪' : '—') +
      ' و' + (th && th.major_drawdown != null ? num(Math.abs(th.major_drawdown), 0) + '٪' : '—') + '.</div>';
    if (!phases.length) {
      phasesHtml += '<div class="ix-empty">مفيش مراحل واضحة في الفترة دي.</div>';
    } else {
      phasesHtml += '<div class="ix-phases">';
      phases.forEach(function (p, i) {
        const k = p.kind;
        const cls = k === 'uptrend' ? 'pos' : (k === 'major_drawdown' ? 'neg' : (k === 'correction' ? 'neg' : ''));
        phasesHtml += '<div class="ix-phase ' + cls + '" data-phase="' + i + '" tabindex="0" role="button">' +
          '<div class="ix-phase-t">' + esc(PHASE_LABEL[k] || k) + '</div>' +
          '<div class="ix-phase-d">' + drange(p.start, p.end) + '</div>' +
          '<div class="ix-phase-r ' + signClass(p.return_pct) + '">' + dirIcon(p.return_pct) + ' ' + pct(p.return_pct) + '</div>' +
          '<div class="ix-phase-x">' + num(p.start_value, 0) + ' → ' + num(p.end_value, 0) +
          ' · أقصى هبوط ' + pct(p.max_drawdown_pct, 1) + ' · ' + num(p.days, 0) + ' يوم</div>' +
          '</div>';
      });
      phasesHtml += '</div>';
    }
    phasesHtml += '</div>';

    /* الأحداث */
    let evHtml = '';
    if ((d.events || []).length) {
      evHtml = '<div class="ix-sec"><h3 class="ix-h">📰 أحداث تاريخية موثّقة</h3><div class="ix-events">';
      d.events.forEach(function (e, i) {
        evHtml += '<div class="ix-event" data-evi="' + i + '">' +
          '<div class="ix-event-t">' + esc(e.title_ar || '') + '</div>' +
          '<div class="ix-event-d">' + drange(e.start_ts, e.end_ts) + '</div>' +
          (e.impact_pct != null ? '<div class="ix-event-i ' + signClass(e.impact_pct) + '">أداء المؤشر خلال الفترة: ' + pct(e.impact_pct) + '</div>' : '') +
          (e.description_ar ? '<div class="ix-event-x">' + esc(e.description_ar) + '</div>' : '') +
          (e.source_name ? '<a class="ix-event-s" href="' + esc(safeUrl(e.source_url)) + '" target="_blank" rel="noopener">' + esc(e.source_name) + ' ↗</a>' : '') +
          '</div>';
      });
      evHtml += '</div><div class="ix-note">ⓘ تزامنت الفترة مع الحدث ده — وده مش معناه إن الحدث هو السبب. الأثر محسوب من المؤشر نفسه.</div></div>';
    }

    /* شخصية المؤشر */
    const hints = ix.personality_hints || [];
    let persHtml = '';
    if (hints.length) {
      persHtml = '<div class="ix-sec"><h3 class="ix-h">🧬 شخصية المؤشر</h3><ul class="ix-list">' +
        hints.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>' +
        '<div class="ix-note">📌 الأرقام المرتبطة بالصفات دي محسوبة من الفترة المختارة ('
        + esc(d.period ? d.period.label : '') + ') — مش وصف ثابت.</div></div>';
    }

    /* المكونات */
    const cons = d.constituents || [];
    let consHtml = '';
    if (cons.length) {
      /* 📌 بحث + فلتر بالنتيجة (زي جدول الشريعة) — Ahmed طلب نفس الطابع */
      consHtml = '<div class="ix-sec"><h3 class="ix-h">🏢 مكونات المؤشر ونتيجة OCTA لكل سهم</h3>' +
        '<div class="ix-note">الوزن والأسماء من البورصة المصرية الرسمية — والنتيجة والقرار من محرك OCTA.</div>' +
        '<div class="ix-cons-tools">' +
        '<input class="ix-cons-q" id="ix-cons-q" type="search" placeholder="🔍 ابحث بالرمز أو الاسم أو القطاع…" ' +
        'value="' + esc(IX[ixId].consQ || '') + '" aria-label="بحث في مكونات المؤشر">' +
        '<div class="ix-note">📌 النتيجة: درجة من 100 بتقيس قوة السهم في محرك OCTA (0 = أضعف، 100 = أقوى).</div>' +
        '<div class="ix-cons-filters" role="group" aria-label="فلتر بالنتيجة">' +
        [['all', 'الكل'], ['50', 'النتيجة 50+'], ['60', 'النتيجة 60+'], ['65', 'النتيجة 65+']].map(function (f) {
          const on = (f[0] === 'all') ? (Number(IX[ixId].consMin || 0) === 0)
            : (Number(IX[ixId].consMin || 0) === Number(f[0]));
          return '<button class="ix-cons-f' + (on ? ' on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') +
            '" data-cmin="' + f[0] + '">' + f[1] + '</button>';
        }).join('') +
        '</div></div>' +
        '<div class="dash-tbl-wrap"><table class="mini-table ix-table"><thead><tr>' +
        '<th>الرمز</th><th>الاسم</th><th>الوزن</th><th>السعر</th><th>النتيجة</th><th>القرار</th>' +
        '</tr></thead><tbody>';
      const CONS_SHOW = 40;
      const hasWeights = cons.some(c => c.weight != null);
      const q = (IX[ixId].consQ || '').trim().toUpperCase();
      const minS = Number(IX[ixId].consMin || 0);
      const filtered = cons.filter(function (c) {
        if (minS && (c.score == null || c.score < minS)) return false;
        if (!q) return true;
        return ((c.code || '') + ' ' + (c.name_ar || '') + ' ' + (c.name_en || '') + ' ' + (c.sector || ''))
          .toUpperCase().indexOf(q) >= 0;
      });
      IX[ixId].consFiltered = filtered;
      const shown = (IX[ixId].consAll ? filtered : filtered.slice(0, CONS_SHOW));
      shown.forEach(function (c) {
        consHtml += '<tr' + (c.code ? ' data-ix-code="' + esc(c.code) + '" style="cursor:pointer"' : '') + '>' +
          '<td><b>' + esc(c.code) + '</b></td>' +
          '<td>' + esc(c.name_ar || '') + '</td>' +
          '<td>' + (c.weight != null ? num(c.weight, 2) + '٪' : '—') + '</td>' +
          '<td>' + (c.price != null ? num(c.price, 2) : '—') + '</td>' +
          '<td class="' + signClass(c.score) + '">' + (c.score != null ? num(c.score, 1) : '—') + '</td>' +
          '<td class="' + (/إيجابية/.test(c.decision || '') ? 'pos' : (/سلبية/.test(c.decision || '') ? 'neg' : '')) + '">' +
          esc(c.decision || '—') + '</td></tr>';
      });
      consHtml += '</tbody></table></div><div class="dash-tbl-hint"><span>←</span> اسحب الجدول أفقيًا <span>←</span></div>';
      if (filtered.length > CONS_SHOW) {
        consHtml += '<button class="ix-more" data-ix-cons="1">' +
          (IX[ixId].consAll ? 'إخفاء الباقي' : 'عرض كل الـ ' + num(filtered.length, 0) + ' مكون') + '</button>';
      }
      consHtml += '<div class="ix-note" id="ix-cons-note">📌 المعروض: ' + num(shown.length, 0) + ' من أصل ' +
        num(cons.length, 0) + ' مكون (بعد الفلتر: ' + num(filtered.length, 0) + ').</div>';
      if (!hasWeights) {
        consHtml += '<div class="ix-note">ℹ️ البورصة بتنشر الأوزان الرسمية لمؤشر EGX30 بس. أما EGX70 و EGX100 فأوزانهما متساوية، ومؤشر الشريعة مرجّح بالقيمة السوقية بسقف 15% لكل سهم.</div>';
      }
      if (ixId === 'EGX33') {
        consHtml += '<button class="ix-more" onclick="openShariahIndex()">📋 جدول مكونات مؤشر الشريعة بالتفصيل</button>';
      }
      consHtml += '</div>';
    }

    /* الدروس */
    const lessons = buildLessons(d);
    let lessonHtml = '<div class="ix-sec"><h3 class="ix-h">🎓 السوق علّمنا إيه؟</h3><div class="ix-lessons">';
    lessons.forEach(function (l) {
      lessonHtml += '<div class="ix-lesson"><div class="ix-lesson-t">' + esc(l.title) + '</div>' +
        '<div class="ix-lesson-x">' + esc(l.text) + '</div></div>';
    });
    lessonHtml += '</div><div class="ix-note">📌 كل درس مربوط بالأرقام المعروضة — وده تاريخ، مش وعد بالمستقبل.</div></div>';

    /* المصادر */
    const srcHtml = '<div class="ix-sec"><h3 class="ix-h">🔗 مصادر البيانات</h3><ul class="ix-list ix-srcs">' +
      '<li>📊 القيم الحالية والأوزان والمكونات: البورصة المصرية الرسمية (EGX).</li>' +
      '<li>📈 السلسلة التاريخية اليومية: TradingView websocket — إغلاقات يومية.</li>' +
      '<li>🏛️ المنهجية والتواريخ: صفحات المؤشرات الرسمية في موقع البورصة.</li>' +
      '<li>🧮 كل الحسابات (العائد · الهبوط · التقلب · التعافي · المراحل): محرك تحليل المؤشرات في خادم OCTA.</li>' +
      '</ul><div class="ix-note">⚠️ كل الأرقام محسوبة من بيانات حقيقية. لو مصدر مش متاح بيظهر «غير متاح» — مفيش أي رقم تقديري.</div></div>';

    document.getElementById('ix-body').innerHTML =
      hero + dataStatus +
      '<div class="ix-sec ix-chartsec">' +
      perBtns + modeBtns + readoutHtml + chart +
      '<div class="ix-chart-legend"><span class="ix-lg-line"></span> ' + esc(MODE_LEGEND[st.mode] || 'رقم المؤشر') +
      '<span class="ix-lg-ev"></span> حدث موثّق</div>' +
      '<div class="ix-mode-help">' + esc(MODE_HELP[st.mode] || '') + '</div>' +
      '</div>' +
      '<div class="ix-sec"><h3 class="ix-h">📊 أداء الفترة</h3>' + stats + '</div>' +
      '<div class="ix-sec"><h3 class="ix-h">🧭 قراءة حالة السوق</h3>' + regHtml + '</div>' +
      eduHtml + offHtml + phasesHtml + evHtml + persHtml + consHtml + lessonHtml + srcHtml;

    bindChart(ixId);
    resetReadout(ixId);
    bindIndexActions(ixId);
    bindConsRows(ixId);
    syncChartWidth(ixId);
  }

  /* ── عناصر مساعدة ─────────────────────────────────────────────────── */
  function miniStat(k, v, cls) {
    return '<div class="ix-mini"><div class="ix-k">' + esc(k) + '</div><div class="ix-v ' + (cls || '') + '">' + esc(v) + '</div></div>';
  }
  function statCard(title, val, cls, exp) {
    return '<div class="ix-stat"><div class="ix-stat-t">' + esc(title) + '</div>' +
      '<div class="ix-stat-v ' + (cls || '') + '">' + esc(val) + '</div>' +
      '<div class="ix-stat-x">' + esc(exp) + '</div></div>';
  }
  function eduBlock(t, body, cls) {
    if (!body) return '';
    return '<div class="ix-edu-b ' + (cls || '') + '"><div class="ix-edu-t">' + esc(t) + '</div>' +
      '<div class="ix-edu-x">' + esc(body) + '</div></div>';
  }
  function offCell(t, v) {
    if (v == null || v === '') return '';
    return '<div class="ix-off"><div class="ix-k">' + esc(t) + '</div><div class="ix-v">' + esc(v) + '</div></div>';
  }

  /* ── بناء السلسلة المعروضة حسب الوضع ─────────────────────────────── */
  function buildView(ixId) {
    const st = IX[ixId];
    const d = st.data;
    let full = (d.series && d.series.values) || [];
    const norm = (d.series && d.series.normalized) || [];
    const dd = (d.series && d.series.drawdown) || [];
    /* ⛔⛔⛔ P1: زووم المرحلة كان يضيع أول ما تغيّر وضع العرض
       📌 الحل: نحفظ المدى في st.zoom ونطبّقه على كل السلسلة. */
    if (st.zoom && st.zoom.from != null) {
      const sub = full.filter(function (q) { return q[0] >= st.zoom.from && q[0] <= st.zoom.to; });
      if (sub.length > 1) full = sub;
    }
    const src = st.mode === 'normalized' ? norm : (st.mode === 'drawdown' ? dd : full);
    const vals = src.map(p => p[1]);
    let vmin = vals.length ? Math.min.apply(null, vals) : 0;
    let vmax = vals.length ? Math.max.apply(null, vals) : 1;
    if (vmin === vmax) { vmin -= 1; vmax += 1; }
    const padv = (vmax - vmin) * 0.08;
    vmin -= padv; vmax += padv;
    /* ⛔⛔⛔ خريطة القيم السابقة لازم تتحسب من السلسلة المعروضة نفسها
       📌 كنا بنحسبها من السلسلة الخام ⇒ في وضع «نسبة البداية» و«انخفاضه من القمة»
       التغير اليومي كان رقم مش معنى (زي -100.32% في وضع التراجع). */
    const prev = {};
    for (let i = 1; i < src.length; i++) prev[src[i][0]] = src[i - 1][1];
    st.view = { series: src, vmin: vmin, vmax: vmax, prev: prev, phases: d.phases || [] };
    return st.view;
  }

  /* ── جدول المكونات (يُعاد رسمه لوحده عند البحث) ───────────────────── */
  function renderConsTable(ixId) {
    const cons = (IX[ixId].data && IX[ixId].data.constituents) || [];
    const tbody = document.querySelector('#ix-modal .ix-table tbody');
    if (!tbody) { renderIndexIntel(ixId); return; }
    const q = (IX[ixId].consQ || '').trim().toUpperCase();
    const minS = Number(IX[ixId].consMin || 0);
    const filtered = cons.filter(function (c) {
      if (minS && (c.score == null || c.score < minS)) return false;
      if (!q) return true;
      return ((c.code || '') + ' ' + (c.name_ar || '') + ' ' + (c.name_en || '') + ' ' + (c.sector || ''))
        .toUpperCase().indexOf(q) >= 0;
    });
    IX[ixId].consFiltered = filtered;
    const CONS_SHOW = 40;
    const shown = (IX[ixId].consAll ? filtered : filtered.slice(0, CONS_SHOW));
    let html = '';
    shown.forEach(function (c) {
      html += '<tr' + (c.code ? ' data-ix-code="' + esc(c.code) + '" style="cursor:pointer"' : '') + '>' +
        '<td><b>' + esc(c.code) + '</b></td>' +
        '<td>' + esc(c.name_ar || '') + '</td>' +
        '<td>' + (c.weight != null ? num(c.weight, 2) + '٪' : '—') + '</td>' +
        '<td>' + (c.price != null ? num(c.price, 2) : '—') + '</td>' +
        '<td class="' + signClass(c.score) + '">' + (c.score != null ? num(c.score, 1) : '—') + '</td>' +
        '<td class="' + (/إيجابية/.test(c.decision || '') ? 'pos' : (/سلبية/.test(c.decision || '') ? 'neg' : '')) + '">' +
        esc(c.decision || '—') + '</td></tr>';
    });
    tbody.innerHTML = html || '<tr><td colspan="6">📭 مفيش نتائج بالبحث ده</td></tr>';
    bindConsRows(ixId);
    const note = document.getElementById('ix-cons-note');
    if (note) note.textContent = '📌 المعروض: ' + shown.length + ' من أصل ' + cons.length +
      ' مكون (بعد الفلتر: ' + filtered.length + ').';
    const more = document.querySelector('#ix-modal .ix-more[data-ix-cons]');
    if (more) {
      more.textContent = IX[ixId].consAll
        ? 'إخفاء الباقي'
        : 'عرض كل الـ ' + filtered.length + ' مكون';
      more.style.display = filtered.length > CONS_SHOW ? '' : 'none';
    }
  }

  function bindConsRows(ixId) {
    document.querySelectorAll('#ix-modal .ix-table tbody tr[data-ix-code]').forEach(function (tr) {
      tr.onclick = function () {
        const code = tr.getAttribute('data-ix-code');
        if (code && typeof openIntel === 'function') openIntel(code);
      };
    });
  }

  /* ── الدروس (من الأرقام المعروضة) ─────────────────────────────────── */
  function buildLessons(d) {
    const out = [];
    const st = d.stats || {};
    const dd = st.max_drawdown || {};
    const rec = st.recovery || {};
    const vol = st.volatility || {};
    const reg = d.regime || {};
    const per = (d.period && d.period.label) || 'الفترة المختارة';

    if (dd.pct != null && dd.pct <= -20) {
      out.push({
        title: 'أكبر هبوط في الفترة — والتعافي (لو حصل) بياخد وقت',
        text: 'أكبر هبوط في ' + per + ' كان ' + pct(dd.pct, 1) + ' (من ' + num(dd.peak, 0) +
          ' إلى ' + num(dd.trough, 0) + '). ' +
          (rec.recovered
            ? 'والمؤشر رجع القمة بعد ' + num(rec.days_to_recover, 0) + ' يوم.'
            : 'والمؤشر لسه ما رجعش القمة لغاية آخر بيانات متاحة.'),
      });
    }
    if (st.return_pct != null && st.return_pct > 0) {
      out.push({
        title: 'العائد النهائي لوحده مش بيوصف الرحلة',
        text: 'المؤشر ربح ' + pct(st.return_pct) + ' في ' + per + ' — وده بعد ما عدّى بأكبر هبوط ' +
          pct(dd.pct, 1) + '. يعني نفس الرقم النهائي ممكن يغيّر طريقته كتير.',
      });
    }
    if (vol.latest != null) {
      out.push({
        title: 'التقلب = تشتّت، مش احتمال خسارة',
        text: 'التقلب السنوي في ' + per + ' هو ' + pct(vol.latest, 1) + ' (المعدل ' + pct(vol.avg, 1) +
          '، وأعلى قيمة ' + pct(vol.max, 1) + '). ده بيقيس قد إيه الأسعار بتتحرك — مش احتمال إنك تخسر.',
      });
    }
    if (st.positive_periods != null && st.negative_periods != null) {
      const tot = st.positive_periods + st.negative_periods;
      if (tot > 20) {
        const p = Math.round((st.positive_periods / tot) * 100);
        /* ⛔⛔⛔ العنوان لازم يتبع المقارنة الفعلية
           📌 كنا بنكتب «أيام الصعود أكتر» حتى لو الهبوط أكتر ⇒ عنوان كاذب. */
        const upMore = st.positive_periods > st.negative_periods;
        const downMore = st.negative_periods > st.positive_periods;
        const title = upMore
          ? 'أيام الصعود أكتر من أيام الهبوط — بس مش بالضرورة ربح'
          : (downMore ? 'أيام الهبوط أكتر من أيام الصعود — وده مش معناها خسارة أكيد'
            : 'أيام الصعود زي أيام الهبوط — توازن في الشكل');
        out.push({
          title: title,
          text: 'في ' + per + ': ' + st.positive_periods + ' يوم صاعد مقابل ' + st.negative_periods +
            ' يوم هابط (' + p + '٪ صعود). الشكل وحده مش بيضمن نتيجة — حجم كل حركة هو اللي بيهم.',
        });
      }
    }
    if (reg.regime === 'uncertain') {
      out.push({
        title: 'المؤشرات متعارضة — فالمحرك بيقول «اتجاه غير واضح» بدل ما يفرض رأي',
        text: 'المؤشرات الحالية (السعر مقابل المتوسطات المتحركة، والزخم) بتتعارض، فالمحرك بيقول «اتجاه غير واضح» بدل ما يفرض رأي. ده سلوك صح.',
      });
    }
    if ((d.constituents || []).length) {
      const w = (d.constituents || []).filter(c => c.weight != null).sort((a, b) => b.weight - a.weight);
      if (w.length >= 3) {
        const top3 = w.slice(0, 3).reduce((s, c) => s + (c.weight || 0), 0);
        if (top3 >= 30) {
          out.push({
            title: 'المؤشر = تركيز في كام سهم',
            text: 'أكبر ٣ مكونات في ' + (d.index ? d.index.name_ar : 'المؤشر') + ' مجموع وزنهم ' +
              num(top3, 1) + '٪ من المؤشر. ده معناه إن أداء ٣ شركات بس ممكن يوجّه المؤشر كله — ' +
              'والمؤشر مش بيمثل كل السهم بالتساوي.',
          });
        }
      }
    }
    if (!out.length) {
      out.push({
        title: 'البيانات في الفترة دي محدودة',
        text: 'الفترة المختارة قصيرة أوي أو مستقرة، فمفيش مراحل أو هبوط واضح نقدر نتكلم عنه.',
      });
    }
    return out;
  }

  /* ── كارت الحدث ───────────────────────────────────────────────────── */
  function showEventCard(ixId, e) {
    let box = document.getElementById('ix-evcard');
    if (!box) {
      box = _('div');
      box.id = 'ix-evcard';
      box.className = 'ix-evcard';
      document.getElementById('ix-body').appendChild(box);
    }
    box.innerHTML = '<button class="ix-evcard-x" onclick="document.getElementById(\'ix-evcard\').remove()" aria-label="إغلاق">✕</button>' +
      '<div class="ix-evcard-t">' + esc(e.title_ar || '') + '</div>' +
      '<div class="ix-evcard-d">' + drange(e.start_ts, e.end_ts) + '</div>' +
      (e.impact_pct != null ? '<div class="ix-evcard-i ' + signClass(e.impact_pct) + '">أداء المؤشر خلال الفترة: ' + pct(e.impact_pct) + '</div>' : '') +
      (e.description_ar ? '<div class="ix-evcard-x2">' + esc(e.description_ar) + '</div>' : '') +
      (e.source_url ? '<a class="ix-evcard-s" href="' + esc(safeUrl(e.source_url)) + '" target="_blank" rel="noopener">' + esc(e.source_name || 'المصدر') + ' ↗</a>' : '') +
      '<div class="ix-note">ⓘ تزامنت الفترة مع الحدث — وده مش إثبات سببية.</div>';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ── الأحداث (أزرار الفترات والوضع والمراحل) ─────────────────────── */
  function bindIndexActions(ixId) {
    const st = IX[ixId];
    const body = document.getElementById('ix-body');

    body.querySelectorAll('[data-ix-cons]').forEach(function (b) {
      b.onclick = function () {
        IX[ixId].consAll = !IX[ixId].consAll;
        renderConsTable(ixId);
      };
    });
    /* 📌 البحث والفلتر في جدول المكونات */
    const cq = document.getElementById('ix-cons-q');
    if (cq) {
      /* ⛔⛔⛔ P1: كنا بنعيد رسم المودال كله في كل حرف (بطيء + المؤشر بيقفز لآخر النص)
         📌 الحل: نرسم جدول المكونات بس + ما نلمسش المؤشر. */
      cq.oninput = function () {
        IX[ixId].consQ = cq.value;
        IX[ixId].consAll = false;
        renderConsTable(ixId);
      };
    }
    body.querySelectorAll('[data-cmin]').forEach(function (b) {
      b.onclick = function () {
        IX[ixId].consMin = Number(b.getAttribute('data-cmin')) || 0;
        IX[ixId].consAll = false;
        body.querySelectorAll('[data-cmin]').forEach(function (x) {
          const on = x === b;
          x.classList.toggle('on', on);
          x.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        renderConsTable(ixId);
      };
    });
    body.querySelectorAll('.ix-per').forEach(function (b) {
      b.onclick = async function () {
        const per = b.getAttribute('data-per');
        if (per === st.period) return;
        st.period = per;
        body.querySelectorAll('.ix-per').forEach(x => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
        const sec = body.querySelector('.ix-chartsec');
        if (!sec) return;
        const spin = document.createElement('div');
        spin.className = 'ix-loading sm';
        spin.id = 'ix-spin';
        spin.textContent = '⏳ جاري التحديث…';
        sec.insertAdjacentElement('afterbegin', spin);
        /* ⛔⛔⛔ P0: سباق بين الردود + سبينر بيفضل للأبد لو فشل الطلب
           📌 الحل: seq لكل طلب (الأحدث يكسب) + finally بيشيل السبينر دايماً. */
        const seq = ++IX_SEQ;
        try {
          const r = await octaFetch(API + '/api/indices/' + encodeURIComponent(ixId) + '/analysis?period=' + per);
          if (seq !== IX_SEQ) return;
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const d = await r.json();
          if (seq !== IX_SEQ) return;
          if (d && d.ok) { st.data = d; renderIndexIntel(ixId); }
          else {
            const sp = document.getElementById('ix-spin');
            if (sp) sp.remove();
            sec.insertAdjacentHTML('afterbegin', '<div class="ix-empty">📉 البيانات مش متاحة للفترة دي</div>');
          }
        } catch (e) {
          if (seq !== IX_SEQ) return;
          const sp = document.getElementById('ix-spin');
          if (sp) sp.remove();
          sec.insertAdjacentHTML('afterbegin',
            '<div class="ix-empty">⚠️ تعذر تحميل الفترة دي — حاول تاني</div>');
        }
      };
    });

    body.querySelectorAll('.ix-mode').forEach(function (b) {
      b.onclick = function () {
        st.mode = b.getAttribute('data-mode');
        body.querySelectorAll('.ix-mode').forEach(x => x.classList.toggle('on', x === b));
        const sec = body.querySelector('.ix-chartsec');
        if (!sec) return;
        const view = buildView(ixId);
        const chart = buildChart(ixId, view.series, st.mode, st.data.events);
        /* ⛔⛔⛔ P0: لو مفيش بيانات ⇒ buildChart بيرجّع .ix-empty مش .ix-chart-wrap */
        const wrap = sec.querySelector('.ix-chart-wrap');
        if (wrap) wrap.outerHTML = chart; else sec.insertAdjacentHTML('afterbegin', chart);
        /* 📌 الشرح والمنعطف في الرسم لازم يتغيّروا مع الوضع */
        const lg = sec.querySelector('.ix-chart-legend');
        if (lg) {
          lg.innerHTML = '<span class="ix-lg-line"></span> ' + esc(MODE_LEGEND[st.mode] || 'رقم المؤشر') +
            '<span class="ix-lg-ev"></span> حدث موثّق';
        }
        const hp = sec.querySelector('.ix-mode-help');
        if (hp) hp.textContent = MODE_HELP[st.mode] || '';
        bindChart(ixId);
        resetReadout(ixId);
      };
    });

    body.querySelectorAll('.ix-phase').forEach(function (el) {
      function go() {
        const i = parseInt(el.getAttribute('data-phase'), 10);
        const p = (st.data.phases || [])[i];
        if (!p) return;
        const d = st.data;
        const full = (d.series && d.series.values) || [];
        const from = p.start, to = p.end;
        const sub = full.filter(function (q) { return q[0] >= from && q[0] <= to; });
        if (sub.length < 2) return;
        st.zoom = { from: from, to: to, label: (p.label || '') };
        st.mode = 'value';
        body.querySelectorAll('.ix-mode').forEach(x => x.classList.toggle('on', x.getAttribute('data-mode') === 'value'));
        const view = buildView(ixId);
        view.series = sub;
        const vals = sub.map(q => q[1]);
        let vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals);
        if (vmin === vmax) { vmin -= 1; vmax += 1; }
        const pad = (vmax - vmin) * 0.08; vmin -= pad; vmax += pad;
        view.vmin = vmin; view.vmax = vmax;
        const chart = buildChart(ixId, sub, 'value', d.events);
        const wrap2 = body.querySelector('.ix-chart-wrap');
        if (wrap2) wrap2.outerHTML = chart; else {
          const sec2 = body.querySelector('.ix-chartsec');
          if (sec2) sec2.insertAdjacentHTML('afterbegin', chart);
        }
        bindChart(ixId);
        const sec = body.querySelector('.ix-chartsec');
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      el.onclick = go;
      el.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
   ④ مقارنة المؤشرات
   ══════════════════════════════════════════════════════════════════════ */
  async function openIndexCompare() {
    const old = document.getElementById('ix-cmp');
    if (old) old.remove();
    document.body.style.overflow = 'hidden';
    const wrap = _('div');
    wrap.id = 'ix-cmp';
    wrap.className = 'ix-overlay';
    wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); document.body.style.overflow = ''; };
    wrap.innerHTML = '<div class="ix-box">' +
      '<div class="ix-head"><div><div class="ix-title">⚖️ مقارنة المؤشرات</div>' +
      '<div class="ix-sub">كل المؤشرات مطبّعة على 100 في بداية الفترة</div></div>' +
      '<button class="ix-close" onclick="closeIndexCompare()" aria-label="إغلاق">✕</button></div>' +
      '<div class="ix-body" id="ix-cmp-body"><div class="ix-loading">⏳ جاري التحميل…</div></div></div>';
    document.body.appendChild(wrap);

    const body = document.getElementById('ix-cmp-body');
    let period = '1Y';
    let sel = { EGX30: true, EGX70: true, EGX100: false, EGX33: false };

    async function load() {
      body.innerHTML = '<div class="ix-loading">⏳ جاري التحميل…</div>';
      try {
        const ids = Object.keys(sel).filter(k => sel[k]).join(',');
        const r = await octaFetch(API + '/api/indices/compare?ids=' + encodeURIComponent(ids) + '&period=' + period);
        const d = await r.json();
        if (!d || !d.ok) { body.innerHTML = '<div class="ix-empty">📉 ' + esc((d && d.error) || 'مفيش بيانات') + '</div>'; return; }
        renderCmp(d);
      } catch (e) {
        body.innerHTML = '<div class="ix-empty">❌ تعذر التحميل (' + esc(e.message || '') + ')</div>';
      }
    }

    function renderCmp(d) {
      const all = ['EGX30', 'EGX70', 'EGX100', 'EGX33'];
      const names = { EGX30: 'EGX30', EGX70: 'EGX70 EWI', EGX100: 'EGX100 EWI', EGX33: 'EGX33 Shariah' };
      let ctl = '<div class="ix-cmp-ctl">';
      all.forEach(function (k) {
        ctl += '<button class="ix-cmp-chip' + (sel[k] ? ' on' : '') + '" data-cmp="' + k + '">' + names[k] + '</button>';
      });
      ctl += '<span class="ix-cmp-sep"></span>';
      PERIODS.forEach(function (p) {
        ctl += '<button class="ix-per' + (period === p[0] ? ' on' : '') + '" data-cper="' + p[0] + '">' + p[1] + '</button>';
      });
      ctl += '</div>';

      /* الرسم المقارن */
      let chart = '<div class="ix-cmp-chart"><svg class="ix-chart" id="ix-cmp-svg"></svg></div>';
      let table = '<div class="dash-tbl-wrap"><table class="mini-table ix-table"><thead><tr>' +
        '<th>المؤشر</th><th>العائد</th><th>أقصى هبوط</th><th>التقلب</th><th>أعلى</th><th>أدنى</th><th>عدد أيام التعافي</th>' +
        '</tr></thead><tbody>';
      d.indices.forEach(function (i) {
        table += '<tr><td><b style="color:' + esc(i.accent || 'var(--gold)') + '">' + esc(i.name_ar || i.id) + '</b></td>' +
          '<td class="' + signClass(i.return_pct) + '">' + pct(i.return_pct) + '</td>' +
          '<td class="neg">' + pct(i.max_drawdown, 1) + '</td>' +
          '<td>' + (i.volatility != null ? pct(i.volatility, 1) : '—') + '</td>' +
          '<td>' + num(i.high, 0) + '</td><td>' + num(i.low, 0) + '</td>' +
          '<td>' + (i.recovery_days != null ? num(i.recovery_days, 0) : '—') + '</td></tr>';
      });
      table += '</tbody></table></div><div class="dash-tbl-hint"><span>←</span> اسحب الجدول أفقيًا <span>←</span></div>';

      const best = d.indices.find(i => i.id === (d.summary || {}).best_return);
      const worst = d.indices.find(i => i.id === (d.summary || {}).worst_drawdown);
      let summary = '<div class="ix-cmp-sum">';
      if (best) summary += '<div>📈 أعلى أداء في الفترة: <b>' + esc(best.name_ar) + '</b> (' + pct(best.return_pct) + ')</div>';
      if (worst) summary += '<div>📉 أكبر هبوط: <b>' + esc(worst.name_ar) + '</b> (' + pct(worst.max_drawdown, 1) + ')</div>';
      summary += '<div class="ix-note">📌 أداء تاريخي مش ضمان للمستقبل. كل مؤشر ليه منهجية مختلفة — والقارنة بين их بتوضح الفرق مش الترتيب.</div></div>';

      body.innerHTML = ctl + chart + table + summary;
      drawCmp(d);
      body.querySelectorAll('.ix-cmp-chip').forEach(function (b) {
        b.onclick = function () {
          const k = b.getAttribute('data-cmp');
          const on = Object.values(sel).filter(Boolean).length;
          if (sel[k] && on <= 2) return;
          sel[k] = !sel[k];
          load();
        };
      });
      body.querySelectorAll('[data-cper]').forEach(function (b) {
        b.onclick = function () { period = b.getAttribute('data-cper'); load(); };
      });
    }

    function drawCmp(d) {
      const svg = document.getElementById('ix-cmp-svg');
      if (!svg) return;
      /* 📌 نفس دالة الهندسة بتاعة الرسم الأساسي (من غير نسختين) */
      const G2 = chartGeo();
      const W = G2.W, H = G2.H, PL = G2.PAD_L, PR = G2.PAD_R, PT = G2.PAD_T, PB = G2.PAD_B;
      /* ⛔⛔⛔ الـviewBox لازم يبقى بنفس أبعاد الإحداثيات
      📌 كنا بنستخدم viewBox ثابت 720 والحداثيات W≈330 ⇒ الرسم كان بيقف عند 46%. */
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      const series = d.indices.map(i => ({ id: i.id, color: i.accent || 'var(--gold)', pts: i.normalized || [] }))
        .filter(s => s.pts.length > 1);
      if (!series.length) return;
      let vmin = 100, vmax = 100;
      series.forEach(s => s.pts.forEach(p => {
        const v = p[1]; if (v < vmin) vmin = v; if (v > vmax) vmax = v;
      }));
      const pad = (vmax - vmin) * 0.08 || 1; vmin -= pad; vmax += pad;
      const t0 = series[0].pts[0][0], t1 = series[0].pts[series[0].pts.length - 1][0];
      const X = (t) => PL + (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * (W - PL - PR));
      const Y = (v) => PT + (1 - (v - vmin) / (vmax - vmin)) * (H - PT - PB);
      let paths = '';
      series.forEach(s => {
        let p = '';
        s.pts.forEach((q, i) => { p += (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1); });
        paths += '<path d="' + p + '" fill="none" stroke="' + esc(s.color) + '" stroke-width="1.8" vector-effect="non-scaling-stroke"/>';
      });
      let lab = '';
      for (let i = 0; i <= 4; i++) {
        const t = t0 + ((t1 - t0) * i) / 4;
        const cx2 = X(t), anch2 = cx2 < 34 ? 'start' : (cx2 > W - PR - 34 ? 'end' : 'middle');
        const lx2 = cx2 < 34 ? 2 : (cx2 > W - PR - 34 ? cx2 + 28 : cx2);
        lab += '<text class="ix-axis" x="' + lx2.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + anch2 + '">' + axLabel(t) + '</text>';
      }
      lab += '<line x1="' + PL + '" y1="' + Y(100).toFixed(1) + '" x2="' + (W - PR) + '" y2="' + Y(100).toFixed(1) + '" stroke="var(--line)" stroke-dasharray="3 3"/>';
      lab += '<text class="ix-axis" x="' + (W - PR + 6) + '" y="' + (Y(vmax)).toFixed(1) + '" text-anchor="start">' + num(vmax, 0) + '</text>';
      lab += '<text class="ix-axis" x="' + (W - PR + 6) + '" y="' + (Y(vmin)).toFixed(1) + '" text-anchor="start">' + num(vmin, 0) + '</text>';
      svg.innerHTML = paths + lab;
    }

    load();
  }

  /* ══════════════════════════════════════════════════════════════════════
   ⑤ التصدير العام
   ══════════════════════════════════════════════════════════════════════ */
  function closeIndexCompare() {
    const el = document.getElementById('ix-cmp');
    if (el) el.remove();
    if (!document.getElementById('ix-modal')) document.body.style.overflow = '';
  }
  window.closeIndexCompare = closeIndexCompare;
  window.openIndexIntel = openIndexIntel;
  window.openIndexCompare = openIndexCompare;
  window.closeIndexIntel = closeIndexIntel;

  /* إغلاق بمفتاح Escape */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (document.getElementById('ix-evcard')) { document.getElementById('ix-evcard').remove(); return; }
      if (document.getElementById('ix-cmp')) {
        document.getElementById('ix-cmp').remove();
        /* ⛔ ما نلمسش overflow لو المودال الأساسي لسه مفتوح */
        if (!document.getElementById('ix-modal')) document.body.style.overflow = '';
        return;
      }
      if (document.getElementById('ix-modal')) closeIndexIntel();
    }
  });

})();
