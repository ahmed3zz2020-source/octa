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
  let IX_ACTIVE = null;      /* المؤشر المفتوح */
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
  function num(v, d) {
    if (v == null || isNaN(v)) return '—';
    d = (d === undefined) ? 2 : d;
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function pct(v, d) {
    if (v == null || isNaN(v)) return '—';
    d = (d === undefined) ? 2 : d;
    return (v >= 0 ? '+' : '') + Number(v).toFixed(d) + '%';
  }
  function dayTs(ts) {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function shortDay(ts) {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  function tsOf(str) {
    if (!str) return null;
    const t = Date.parse(String(str).replace(' ', 'T') + (String(str).length <= 10 ? 'Z' : ''));
    return isNaN(t) ? null : Math.floor(t / 1000);
  }
  function signClass(v) { return v > 0 ? 'pos' : (v < 0 ? 'neg' : ''); }
  function dirIcon(v) { return v > 0 ? '▲' : (v < 0 ? '▼' : '■'); }

  /* ══════════════════════════════════════════════════════════════════════
   ① المودال
   ══════════════════════════════════════════════════════════════════════ */
  function closeIndexIntel() {
    const m = document.getElementById('ix-modal');
    if (m) m.remove();
    document.body.style.overflow = '';
    IX_ACTIVE = null;
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
      '<button class="ix-close" onclick="closeIndexIntel()" aria-label="إغلاق">✕</button>' +
      '</div>' +
      '<div class="ix-body" id="ix-body"><div class="ix-loading">⏳ جاري تحميل بيانات المؤشر…</div></div>' +
      '</div>';
    document.body.appendChild(wrap);

    IX_ACTIVE = ixId;
    const seq = ++IX_SEQ;
    IX[ixId] = IX[ixId] || { period: 'MAX', mode: 'value', view: null, data: null };

    try {
      const r = await octaFetch(API + '/api/indices/' + encodeURIComponent(ixId) + '/analysis?period=' + IX[ixId].period);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (seq !== IX_SEQ) return;
      if (!d || !d.ok) {
        document.getElementById('ix-body').innerHTML =
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
    const W = 720, H = 260, PAD_L = 8, PAD_R = 46, PAD_T = 12, PAD_B = 26;
    if (!series || series.length < 2) return '<div class="ix-empty">📉 مفيش بيانات للرسم</div>';

    const vals = series.map(p => p[1]);
    const t0 = series[0][0], t1 = series[series.length - 1][0];
    let vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals);
    if (vmin === vmax) { vmin -= 1; vmax += 1; }
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

    /* علامات المحور */
    const nLab = 4;
    let xlab = '';
    for (let i = 0; i <= nLab; i++) {
      const t = t0 + ((t1 - t0) * i) / nLab;
      const cx = x(t).toFixed(1);
      xlab += '<text class="ix-axis" x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + shortDay(t) + '</text>';
    }

    const ylabels =
      '<text class="ix-axis" x="' + (W - PAD_R + 6) + '" y="' + (PAD_T + 6) + '" text-anchor="start">' + num(vmax, 0) + '</text>' +
      '<text class="ix-axis" x="' + (W - PAD_R + 6) + '" y="' + (H - PAD_B) + '" text-anchor="start">' + num(vmin, 0) + '</text>';

    return '<div class="ix-chart-wrap" id="ix-chart-wrap" data-ix="' + esc(ixId) + '">' +
      '<svg class="ix-chart" id="ix-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" ' +
      'role="img" aria-label="رسم بياني تاريخي لقيمة المؤشر">' +
      '<defs><linearGradient id="ixg' + esc(ixId) + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--gold)" stop-opacity=".38"/>' +
      '<stop offset="100%" stop-color="var(--gold)" stop-opacity="0"/></linearGradient></defs>' +
      '<path class="ix-area" d="' + area + '" fill="url(#ixg' + esc(ixId) + ')"/>' +
      '<path class="ix-line" d="' + path + '" fill="none" stroke="var(--gold)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>' +
      '<line class="ix-cross" id="ix-cross" x1="0" y1="' + PAD_T + '" x2="0" y2="' + (H - PAD_B) + '" style="opacity:0"/>' +
      '<circle class="ix-dot" id="ix-dot" cx="0" cy="0" r="4" style="opacity:0"/>' +
      marks + xlab + ylabels + '</svg>' +
      '<div class="ix-tip" id="ix-tip" style="opacity:0"></div>' +
      '<div class="ix-axis-note">أعلى: ' + num(vmax - padv, 0) + ' · أدنى: ' + num(vmin + padv, 0) + '</div>' +
      '</div>';
  }

  /* تحريك المؤشر على الرسم (ماوس + لمس) */
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
    const tip = document.getElementById('ix-tip');
    const W = 720, PAD_L = 8, PAD_R = 46;

    function nearest(clientX) {
      const r = svg.getBoundingClientRect();
      const rel = ((clientX - r.left) / r.width) * W;
      const t0 = series[0][0], t1 = series[series.length - 1][0];
      const frac = (rel - PAD_L) / (W - PAD_L - PAD_R);
      const target = t0 + frac * (t1 - t0);
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
      const W2 = W, PAD_T = 12, PAD_B = 26;
      const vmin = st.view.vmin, vmax = st.view.vmax;
      const y = PAD_T + (1 - (v - vmin) / (vmax - vmin)) * (260 - PAD_T - PAD_B);
      const cx = PAD_L + ((t - series[0][0]) / (series[series.length - 1][0] - series[0][0])) * (W2 - PAD_L - PAD_R);
      const px = (cx / W2) * r.width, py = (y / 260) * r.height;
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.style.opacity = '1';
      dot.setAttribute('cx', cx); dot.setAttribute('cy', y); dot.style.opacity = '1';
      const prev = st.view.prev[t];
      const chg = prev ? ((v / prev - 1) * 100) : null;
      const ph = (st.view.phases || []).find(pp => t >= pp.start && t <= pp.end);
      tip.innerHTML = '<b>' + dayTs(t) + '</b><br>القيمة: ' + num(v, 2) +
        (chg == null ? '' : '<br>التغير: <span class="' + signClass(chg) + '">' + pct(chg) + '</span>') +
        (ph ? '<br><span class="ix-tip-ph">' + esc(PHASE_LABEL[ph.kind] || ph.kind) + '</span>' : '');
      tip.style.opacity = '1';
      const left = Math.max(4, Math.min(r.width - 150, px - 70));
      tip.style.left = left + 'px';
      tip.style.top = Math.max(2, py - 66) + 'px';
    }
    function hide() {
      cross.style.opacity = '0'; dot.style.opacity = '0'; tip.style.opacity = '0';
    }
    svg.addEventListener('mousemove', show);
    svg.addEventListener('mouseleave', hide);
    svg.addEventListener('touchstart', (e) => { if (e.touches[0]) show(e.touches[0]); }, { passive: true });
    svg.addEventListener('touchmove', (e) => { if (e.touches[0]) show(e.touches[0]); }, { passive: true });
    svg.addEventListener('touchend', hide);

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
      (ix.short_ar ? ix.short_ar + ' · ' : '') + 'المصدر: البورصة المصرية · ' +
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

    /* حالة البيانات */
    const dataStatus = '<div class="ix-datastat">' +
      '<span class="ix-badge ' + (ms.status === 'Open' ? 'live' : 'closed') + '">' +
      (ms.status === 'Open' ? '🟢 السوق مفتوح' : '⚪ السوق مغلق') + '</span>' +
      '<span class="ix-badge">📅 تغطية البيانات: ' + esc(cov.from || '—') + ' → ' + esc(cov.to || '—') + '</span>' +
      '<span class="ix-badge">📊 عدد أيام التداول: ' + num(cov.count, 0) + '</span>' +
      (cov.note ? '<span class="ix-badge warn">ℹ️ ' + esc(cov.note) + '</span>' : '') +
      '</div>';

    /* أزرار الفترات */
    let perBtns = '<div class="ix-periods" role="tablist" aria-label="اختر الفترة">';
    PERIODS.forEach(function (p) {
      perBtns += '<button class="ix-per' + (st.period === p[0] ? ' on' : '') + '" data-per="' + p[0] + '" ' +
        'role="tab" aria-selected="' + (st.period === p[0] ? 'true' : 'false') + '">' + p[1] + '</button>';
    });
    perBtns += '</div>';

    /* أزرار طريقة العرض */
    const modes = [['value', 'قيمة المؤشر'], ['normalized', 'نسبة مطبّعة (100)'], ['drawdown', 'التراجع عن القمة']];
    let modeBtns = '<div class="ix-modes">';
    modes.forEach(function (m) {
      modeBtns += '<button class="ix-mode' + (st.mode === m[0] ? ' on' : '') + '" data-mode="' + m[0] + '">' + m[1] + '</button>';
    });
    modeBtns += '</div>';

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
      'انحراف معياري للعيائد اليومية (٣٠ يوم) مضروب في √٢٥٢. بيقيس التشتّت مش احتمال الخسارة.');
    const rec = stt.recovery || {};
    stats += statCard('التعافي', rec.recovered ? '✅ تعافى' : '⏳ لم يتعافَ', rec.recovered ? 'pos' : '',
      rec.recovered
        ? 'رجع المؤشر لقمة الهبوط بعد ' + num(rec.days_to_recover, 0) + ' يوم من القمة.'
        : 'لم يسترد المؤشر القمة السابقة حتى آخر بيانات متاحة.');
    stats += statCard('التراجع عن القمة', pct(dd.pct), 'neg',
      'يوضح مدى انخفاض المؤشر عن أعلى مستوى وصله داخل الفترة المختارة.');
    stats += statCard('فترات صاعدة', num(stt.positive_periods, 0) + ' / ' + num(stt.negative_periods, 0),
      '', 'عدد الأيام الصاعدة مقابل الهابطة داخل الفترة.');
    stats += '</div>';

    /* حالة السوق */
    const regHtml = '<div class="ix-regime ix-reg-' + esc(reg.regime || 'uncertain') + '">' +
      '<div class="ix-regime-head"><span class="ix-regime-ico">' + (REGIME_ICON[reg.regime] || '❓') + '</span>' +
      '<div><div class="ix-regime-t">حالة المؤشر: ' + esc(REGIME_LABEL[reg.regime] || 'غير محدد') + '</div>' +
      '<div class="ix-regime-c">درجة الثقة ' + num(reg.confidence, 0) + '٪ — محسوبة من عدد المؤشرات المتفقة</div></div></div>' +
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
      eduBlock('علاقته بسوق تاني', ed.vs_market) +
      '</div></div>';

    /* المنهجية الرسمية */
    const off = ix.official || {};
    const offHtml = '<div class="ix-sec"><h3 class="ix-h">🏛️ معلومات رسمية من البورصة المصرية</h3>' +
      '<div class="ix-offgrid">' +
      offCell('تاريخ التدشين', off.inception_date) +
      offCell('القيمة الأساس', off.base_value != null ? num(off.base_value, 0) + ' نقطة' : null) +
      offCell('عدد المكونات', off.constituents_count != null ? num(off.constituents_count, 0) + ' شركة' : null) +
      offCell('طريقة الوزن', off.weight_method) +
      offCell('وزن كل مكون', off.weight_pct != null ? num(off.weight_pct, 2) + '٪' : null) +
      offCell('شروط القبول', off.eligibility) +
      offCell('المراجعة الدورية', off.revision) +
      '</div></div>';

    /* المراحل */
    const phases = d.phases || [];
    let phasesHtml = '<div class="ix-sec"><h3 class="ix-h">🗺️ مراحل المؤشر عبر الزمن</h3>' +
      '<div class="ix-note">المراحل دي محسوبة آلياً من البيانات الحقيقية (مش يدوية) — ' +
      'هبوط حاد = أكبر من ٢٠٪ من قمة، تصحيح = بين ١٠٪ و٢٠٪.</div>';
    if (!phases.length) {
      phasesHtml += '<div class="ix-empty">مفيش مراحل واضحة في الفترة دي.</div>';
    } else {
      phasesHtml += '<div class="ix-phases">';
      phases.forEach(function (p, i) {
        const k = p.kind;
        const cls = k === 'uptrend' ? 'pos' : (k === 'major_drawdown' ? 'neg' : (k === 'correction' ? 'neg' : ''));
        phasesHtml += '<div class="ix-phase ' + cls + '" data-phase="' + i + '" tabindex="0" role="button">' +
          '<div class="ix-phase-t">' + esc(PHASE_LABEL[k] || k) + '</div>' +
          '<div class="ix-phase-d">' + dayTs(p.start) + ' → ' + dayTs(p.end) + '</div>' +
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
          '<div class="ix-event-d">' + dayTs(e.start_ts) + (e.end_ts && e.end_ts !== e.start_ts ? ' → ' + dayTs(e.end_ts) : '') + '</div>' +
          (e.impact_pct != null ? '<div class="ix-event-i ' + signClass(e.impact_pct) + '">أداء المؤشر خلال الفترة: ' + pct(e.impact_pct) + '</div>' : '') +
          (e.description_ar ? '<div class="ix-event-x">' + esc(e.description_ar) + '</div>' : '') +
          (e.source_name ? '<a class="ix-event-s" href="' + esc(e.source_url || '#') + '" target="_blank" rel="noopener">' + esc(e.source_name) + ' ↗</a>' : '') +
          '</div>';
      });
      evHtml += '</div><div class="ix-note">ⓘ تزامنت الفترة مع الحدث ده — وده مش معناه إن<Event> هو السبب. الأثر محسوب من المؤشر نفسه.</div></div>';
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
      consHtml = '<div class="ix-sec"><h3 class="ix-h">🏢 مكونات المؤشر ونتيجة OCTA لكل سهم</h3>' +
        '<div class="ix-note">الوزن والأسماء من البورصة المصرية الرسمية — والنتيجة والقرار من محرك OCTA.</div>' +
        '<div class="dash-tbl-wrap"><table class="mini-table ix-table"><thead><tr>' +
        '<th>الرمز</th><th>الاسم</th><th>الوزن</th><th>السعر</th><th>النتيجة</th><th>القرار</th>' +
        '</tr></thead><tbody>';
      cons.slice(0, 40).forEach(function (c) {
        consHtml += '<tr' + (c.code ? ' onclick="openIntel(\'' + esc(c.code) + '\')" style="cursor:pointer"' : '') + '>' +
          '<td><b>' + esc(c.code) + '</b></td>' +
          '<td>' + esc(c.name_ar || '') + '</td>' +
          '<td>' + (c.weight != null ? num(c.weight, 2) + '٪' : '—') + '</td>' +
          '<td>' + (c.price != null ? num(c.price, 2) : '—') + '</td>' +
          '<td class="' + signClass(c.score) + '">' + (c.score != null ? num(c.score, 1) : '—') + '</td>' +
          '<td class="' + (/إيجابية/.test(c.decision || '') ? 'pos' : (/سلبية/.test(c.decision || '') ? 'neg' : '')) + '">' +
          esc(c.decision || '—') + '</td></tr>';
      });
      consHtml += '</tbody></table></div><div class="dash-tbl-hint"><span>←</span> اسحب الجدول جنباً <span>←</span></div></div>';
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
      perBtns + modeBtns + chart +
      '<div class="ix-chart-legend"><span class="ix-lg-line"></span> قيمة المؤشر' +
      '<span class="ix-lg-ev"></span> حدث موثّق</div>' +
      '</div>' +
      '<div class="ix-sec"><h3 class="ix-h">📊 أداء الفترة</h3>' + stats + '</div>' +
      '<div class="ix-sec"><h3 class="ix-h">🧭 قراءة حالة السوق</h3>' + regHtml + '</div>' +
      eduHtml + offHtml + phasesHtml + evHtml + persHtml + consHtml + lessonHtml + srcHtml;

    bindChart(ixId);
    bindIndexActions(ixId);
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
    const full = (d.series && d.series.values) || [];
    const norm = (d.series && d.series.normalized) || [];
    const dd = (d.series && d.series.drawdown) || [];
    const src = st.mode === 'normalized' ? norm : (st.mode === 'drawdown' ? dd : full);
    const vals = src.map(p => p[1]);
    let vmin = vals.length ? Math.min.apply(null, vals) : 0;
    let vmax = vals.length ? Math.max.apply(null, vals) : 1;
    if (vmin === vmax) { vmin -= 1; vmax += 1; }
    const padv = (vmax - vmin) * 0.08;
    vmin -= padv; vmax += padv;
    /* خريطة القيم السابقة لحساب التغير اليومي */
    const prev = {};
    for (let i = 1; i < full.length; i++) prev[full[i][0]] = full[i - 1][1];
    st.view = { series: src, vmin: vmin, vmax: vmax, prev: prev, phases: d.phases || [] };
    return st.view;
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
        title: 'الهبوط بيحصل — والتعافي بياخد وقت',
        text: 'أكبر هبوط في ' + per + ' كان ' + pct(dd.pct, 1) + ' (من ' + num(dd.peak, 0) +
          ' إلى ' + num(dd.trough, 0) + '). ' +
          (rec.recovered
            ? 'والمؤشر رجع القمة بعد ' + num(rec.days_to_recover, 0) + ' يوم.'
            : 'والمؤشر لسه ما رجعش القمة لغاية آخر بيانات متاحة.'),
      });
    }
    if (st.return_pct != null && st.return_pct > 0) {
      out.push({
        title: 'الصعود بيبقى أبطأ من الهبوط',
        text: 'المؤشر ربح ' + pct(st.return_pct) + ' في ' + per + ' — وده بعد ما عدّى بأكبر هبوط ' +
          pct(dd.pct, 1) + '. يعني العائد النهائي مش بيوصف الرحلة.',
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
        out.push({
          title: 'أيام الصعود أكتر من أيام الهبوط — بس مش بالضرورة ربح',
          text: 'في ' + per + ': ' + st.positive_periods + ' يوم صاعد مقابل ' + st.negative_periods +
            ' يوم هابط (' + p + '٪ صعود). الشكل وحده مش بيضمن نتيجة — حجم كل حركة هو اللي بيهم.',
        });
      }
    }
    if (reg.regime === 'uncertain') {
      out.push({
        title: 'لما المؤشرات تتفق، ده أحسن من环境污染 الرأي',
        text: 'المؤشرات الحالية متعارضة (السعر مقابل المتوسطات المتحركة، والزخم)، فالمحرك بيقول «اتجاه غير واضح» بدل ما يفرض رأي. ده سلوك صح.',
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
      '<div class="ix-evcard-d">' + dayTs(e.start_ts) + (e.end_ts && e.end_ts !== e.start_ts ? ' → ' + dayTs(e.end_ts) : '') + '</div>' +
      (e.impact_pct != null ? '<div class="ix-evcard-i ' + signClass(e.impact_pct) + '">أداء المؤشر خلال الفترة: ' + pct(e.impact_pct) + '</div>' : '') +
      (e.description_ar ? '<div class="ix-evcard-x2">' + esc(e.description_ar) + '</div>' : '') +
      (e.source_url ? '<a class="ix-evcard-s" href="' + esc(e.source_url) + '" target="_blank" rel="noopener">' + esc(e.source_name || 'المصدر') + ' ↗</a>' : '') +
      '<div class="ix-note">ⓘ تزامنت الفترة مع الحدث — وده مش إثبات سببية.</div>';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ── الأحداث (أزرار الفترات والوضع والمراحل) ─────────────────────── */
  function bindIndexActions(ixId) {
    const st = IX[ixId];
    const body = document.getElementById('ix-body');

    body.querySelectorAll('.ix-per').forEach(function (b) {
      b.onclick = async function () {
        const per = b.getAttribute('data-per');
        if (per === st.period) return;
        st.period = per;
        body.querySelectorAll('.ix-per').forEach(x => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-selected', x === b ? 'true' : 'false');
        });
        body.querySelector('.ix-chartsec').insertAdjacentHTML('afterbegin', '<div class="ix-loading sm">⏳ جاري التحديث…</div>');
        try {
          const r = await octaFetch(API + '/api/indices/' + encodeURIComponent(ixId) + '/analysis?period=' + per);
          const d = await r.json();
          if (d && d.ok) { st.data = d; renderIndexIntel(ixId); }
        } catch (e) { }
      };
    });

    body.querySelectorAll('.ix-mode').forEach(function (b) {
      b.onclick = function () {
        st.mode = b.getAttribute('data-mode');
        body.querySelectorAll('.ix-mode').forEach(x => x.classList.toggle('on', x === b));
        const sec = body.querySelector('.ix-chartsec');
        const view = buildView(ixId);
        const chart = buildChart(ixId, view.series, st.mode, st.data.events);
        sec.querySelector('.ix-chart-wrap').outerHTML = chart;
        bindChart(ixId);
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
        body.querySelector('.ix-chart-wrap').outerHTML = chart;
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
      '<button class="ix-close" onclick="document.getElementById(\'ix-cmp\').remove()" aria-label="إغلاق">✕</button></div>' +
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
      let chart = '<div class="ix-cmp-chart"><svg viewBox="0 0 720 260" preserveAspectRatio="none" class="ix-chart" id="ix-cmp-svg"></svg></div>';
      let table = '<div class="dash-tbl-wrap"><table class="mini-table ix-table"><thead><tr>' +
        '<th>المؤشر</th><th>العائد</th><th>أقصى هبوط</th><th>التقلب</th><th>أعلى</th><th>أدنى</th><th>أيام التعافي</th>' +
        '</tr></thead><tbody>';
      d.indices.forEach(function (i) {
        table += '<tr><td><b style="color:' + esc(i.accent || 'var(--gold)') + '">' + esc(i.name_ar || i.id) + '</b></td>' +
          '<td class="' + signClass(i.return_pct) + '">' + pct(i.return_pct) + '</td>' +
          '<td class="neg">' + pct(i.max_drawdown, 1) + '</td>' +
          '<td>' + (i.volatility != null ? pct(i.volatility, 1) : '—') + '</td>' +
          '<td>' + num(i.high, 0) + '</td><td>' + num(i.low, 0) + '</td>' +
          '<td>' + (i.recovery_days != null ? num(i.recovery_days, 0) : '—') + '</td></tr>';
      });
      table += '</tbody></table></div><div class="dash-tbl-hint"><span>←</span> اسحب الجدول جنباً <span>←</span></div>';

      const best = d.indices.find(i => i.id === (d.summary || {}).best_return);
      const worst = d.indices.find(i => i.id === (d.summary || {}).worst_drawdown);
      let summary = '<div class="ix-cmp-sum">';
      if (best) summary += '<div>📈 أعلى أداء في الفترة: <b>' + esc(best.name_ar) + '</b> (' + pct(best.return_pct) + ')</div>';
      if (worst) summary += '<div>📉 أكبر هبوط: <b>' + esc(worst.name_ar) + '</b> (' + pct(worst.max_drawdown, 1) + ')</div>';
      summary += '<div class="ix-note">📌 أداء تاريخي مش ضمان لل مستقبل. كل مؤشر ليه منهجية مختلفة — والقارنة بين их بتوضح الفرق مش الترتيب.</div></div>';

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
      const W = 720, H = 260, PL = 8, PR = 46, PT = 12, PB = 26;
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
        lab += '<text class="ix-axis" x="' + X(t).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + shortDay(t) + '</text>';
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
  window.openIndexIntel = openIndexIntel;
  window.openIndexCompare = openIndexCompare;
  window.closeIndexIntel = closeIndexIntel;

  /* إغلاق بمفتاح Escape */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (document.getElementById('ix-evcard')) { document.getElementById('ix-evcard').remove(); return; }
      if (document.getElementById('ix-cmp')) { document.getElementById('ix-cmp').remove(); document.body.style.overflow = ''; return; }
      if (document.getElementById('ix-modal')) closeIndexIntel();
    }
  });

})();
