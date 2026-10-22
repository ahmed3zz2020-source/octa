/* ══════════════════════════════════════════════════════════════
   💰 Smart Money — فلتر المحاور الأربعة + كروت المؤشرات + الشارت
   ──────────────────────────────────────────────────────────────
   📌 الصفحة بتعمل ٣ حاجات:
      ① فلتر — ترتيب كل أسهم البورصة حسب قوة الـSmart Money
      ② كروت — شرح كل مؤشر: بيقيس إيه · قيمته كام · إيجابي ولا سالب
      ③ شارت — TradingView بالمؤشرات (RSI · MACD)

   📌 مصدر البيانات (٣ مصادر، كل واحد بيكمل التاني):
      · /api/markets?market=egypt    → سعر · حجم · تقلب · سيولة
      · /api/market_tech?market=egypt → RSI · MACD · SMA200 · حجم نسبي
      · OS_DB (من /api/data_full)     → احتياطي: متوسطات · أداء · مخاطر

   ⛔ كل رقم في الشاشة ده بييجي من المحرك (octa-smartmoney.js) —
      مافيش رقم مخترع ولا شرح من عندي.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ⛔ الملف بيتحمّل مرتين في index.html (بلوك السكربتات مكرر)
     ⇒ guard عشان ماتفتحش البيانات مرتين ولا تتربطش الأحداث مرتين. */
  if (window.__octaMoneyLoaded) return;
  window.__octaMoneyLoaded = true;

  /* ══════════ الحالة ══════════ */
  const S = {
    rows: [],        /* كل الأسهم بعد الدمج */
    view: [],        /* بعد الفلترة والترتيب */
    q: '', sect: 'all',
    sort: 'score', dir: -1,
    min: 0, agreeOnly: false, showWeak: false,
    sel: null,       /* الكود المفتوح */
    detail: null,    /* نتيجة الشموع */
    loading: false,
    ts: null,
    err: ''
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : null;
  const f1 = (v) => num(v) != null ? Number(v).toFixed(1) : '—';
  const f2 = (v) => num(v) != null ? Number(v).toFixed(2) : '—';
  const pct = (v) => num(v) != null ? (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%' : '—';
  const clr = (v) => num(v) == null ? 'var(--muted)' : (v > 0 ? 'var(--up)' : (v < 0 ? 'var(--dn)' : 'var(--muted)'));

  /* الأيقونات للـ٤ محاور */
  const AX = {
    trend: { i: '📈', n: 'الاتجاه' },
    momentum: { i: '⚡', n: 'الزخم' },
    volatility: { i: '🌊', n: 'التذبذب' },
    volume: { i: '💧', n: 'الحجم' }
  };
  const SORTS = [
    { id: 'score', n: 'النتيجة', get: (r) => r.score },
    { id: 'trend', n: 'الاتجاه', get: (r) => r.axes.trend.score },
    { id: 'momentum', n: 'الزخم', get: (r) => r.axes.momentum.score },
    { id: 'volatility', n: 'التذبذب', get: (r) => r.axes.volatility.score },
    { id: 'volume', n: 'الحجم', get: (r) => r.axes.volume.score },
    { id: 'change', n: 'التغير', get: (r) => r.change },
    { id: 'price', n: 'السعر', get: (r) => r.price }
  ];

  /* ══════════════════════════════════════════════════════════════
   📥 تحميل البيانات
   ══════════════════════════════════════════════════════════════ */
  async function jget(path) {
    try {
      const r = await fetch((window.OCTA_API || '') + path, { cache: 'no-store' });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }

  /* ⏱ مهلة — لو الباك واقع ما ننتظرش طويل */
  function withTimeout(p, ms) {
    return new Promise((res) => {
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; res(null); } }, ms);
      Promise.resolve(p).then((v) => { if (!done) { done = true; clearTimeout(t); res(v); } },
        () => { if (!done) { done = true; clearTimeout(t); res(null); } });
    });
  }

  /* 🗺️ الأسماء العربية — من ملف الأسماء (٢٧١ سهم) */
  function arName(code, fallback) {
    try {
      const m = window.OCTA_EGX_NAMES;
      if (m && m.names && m.names[code]) return m.names[code];
    } catch (e) { }
    return fallback || code;
  }
  function arSector(code, fallback) {
    try {
      const m = window.OCTA_EGX_NAMES;
      if (m && m.sectors && m.sectors[code]) return m.sectors[code];
    } catch (e) { }
    return fallback || '';
  }

  /* ⭐ مصدر ٢ — جسر الـWorker (سكانر TradingView من الـedge)
     ⛌ ده بيشتغل من غير الباك خالص — يعني الفلتر بيفتح وقت الأعطال.
       和生产 هو مقفول (OCTA_TV_PROXY) — فبيسقط تلقائياً وميبانش. */
  async function tvBridge() {
    const j = await jget('/api/tvscan');
    if (!j || !j.ok || !j.rows || !j.rows.length) return null;
    const rows = j.rows.map(r => {
      const code = r.code;
      return Object.assign({}, r, {
        name: arName(code, code),
        sector: arSector(code, ''),
        _src: 'tv'
      });
    });
    return { rows: rows, src: 'tv' };
  }

  /* ⭐ مصدر ١ — الباك (المرجع: أسماء عربية + كل الحقول) */
  async function backendData() {
    const [mk, tech] = await Promise.all([
      jget('/api/markets?market=egypt'),
      jget('/api/market_tech?market=egypt')
    ]);
    const mkRows = (mk && mk.egypt) ? mk.egypt : [];
    if (!mkRows.length) return null;
    const techMap = (tech && tech.markets && tech.markets.egypt) ? tech.markets.egypt : {};
    const rows = mkRows.map(r => Object.assign({}, r, {
      name: arName(r.code, r.name),
      sector: arSector(r.code, r.sector),
      _tech: techMap[r.code] || null,
      _src: 'api'
    }));
    return { rows: rows, src: 'api' };
  }

  async function loadData(force) {
    if (S.loading) return;
    if (S.rows.length && !force) { render(); return; }
    S.loading = true; S.err = ''; renderStatus();

    /* ① السجل الأساسي (محمي) — فيه المتوسطات والأداء */
    try { if (typeof octaLoadDB === 'function') await octaLoadDB(); } catch (e) { }

    /* ② الباك الأول (المرجع) · لو واقع ⇒ جسر TradingView */
    const backend = await withTimeout(backendData(), 6000);
    const src = backend || await tvBridge();
    if (!src) {
      S.err = 'مقدرتش أجيب بيانات السوق. جرّب تحديث الصفحة.';
      S.loading = false; renderStatus(); return;
    }
    S.src = src.src;

    const dbMap = {};
    const db = (typeof OS_DB !== 'undefined' && OS_DB) ? OS_DB : [];
    for (let i = 0; i < db.length; i++) if (db[i] && db[i].code) dbMap[db[i].code] = db[i];

    const SM = window.OCTA_SM;
    const merged = [];
    for (let i = 0; i < src.rows.length; i++) {
      const r = src.rows[i];
      const m = SM.merge(r, r._tech || null, dbMap[r.code] || null);
      m.code = r.code;
      m.name = r.name || m.name;
      m.sector = r.sector || m.sector;
      merged.push(m);
    }
    /* أسهم السجل اللي مش في مصدر السوق */
    Object.keys(dbMap).forEach(code => {
      if (merged.some(x => x.code === code)) return;
      const m = SM.merge({ code: code }, null, dbMap[code]);
      m.code = code; m.name = dbMap[code].name || code;
      merged.push(m);
    });

    S.rows = SM.rank(merged);
    S.ts = new Date();
    S.loading = false;
    buildSectors();
    apply();
  }

  /* ══════════════════════════════════════════════════════════════
   🔍 الفلترة والترتيب
   ══════════════════════════════════════════════════════════════ */
  function apply() {
    const q = S.q.trim().toLowerCase();
    let list = S.rows.filter(r => {
      if (!S.showWeak && r.weak) return false;
      if (S.sect !== 'all' && r.sector !== S.sect) return false;
      if (S.min > 0 && r.score < S.min) return false;
      if (S.agreeOnly && !r.badges.some(b => b.id === 'agree')) return false;
      if (q) {
        const hay = (r.code + ' ' + r.name + ' ' + (r.sector || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    const s = SORTS.filter(x => x.id === S.sort)[0] || SORTS[0];
    list.sort((a, b) => {
      const av = s.get(a), bv = s.get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * S.dir;
    });
    S.view = list;
    render();
  }

  function buildSectors() {
    const sel = $('smSect');
    if (!sel) return;
    const secs = [];
    const seen = {};
    for (let i = 0; i < S.rows.length; i++) {
      const s = S.rows[i].sector;
      if (s && !seen[s]) { seen[s] = 1; secs.push(s); }
    }
    secs.sort((a, b) => a.localeCompare(b, 'ar'));
    sel.innerHTML = '<option value="all">كل القطاعات</option>' +
      secs.map(s => '<option value="' + esc(s) + '"' + (S.sect === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    sel.value = S.sect;
  }

  /* ══════════════════════════════════════════════════════════════
   🎨 الرسم
   ══════════════════════════════════════════════════════════════ */
  function renderStatus() {
    const st = $('smStatus');
    if (!st) return;
    if (S.loading) { st.innerHTML = '<span class="sm-dot"></span> بنجيب بيانات السوق…'; return; }
    if (S.err) { st.innerHTML = '<span class="sm-dot err"></span> ' + esc(S.err); return; }
    const ok = S.rows.filter(r => !r.weak).length;
    const agree = S.rows.filter(r => r.badges.some(b => b.id === 'agree')).length;
    const t = $('smTotal'); if (t) t.textContent = S.rows.length;
    const o = $('smOk'); if (o) o.textContent = ok;
    const a = $('smAgree'); if (a) a.textContent = agree;
    const u = $('smUpd');
    if (u) u.textContent = S.ts ? S.ts.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—';
    /* ⛌ مصدر البيانات — لازم المستخدم يعرف الأرقام جاية منين */
    const srcTxt = S.src === 'tv' ? 'بيانات حية من TradingView' : 'بيانات المحرك';
    st.innerHTML = '<span class="sm-dot ok"></span> البيانات جاهزة · ' + srcTxt;
  }

  function bar(v, color) {
    const x = Math.max(0, Math.min(100, num(v) == null ? 0 : v));
    return '<span class="sm-bar"><i style="width:' + x + '%;background:' + (color || 'var(--gold)') + '"></i></span>';
  }

  function axisCell(key, r) {
    const a = r.axes[key];
    const v = a.score;
    const col = v >= 60 ? 'var(--up)' : (v >= 45 ? 'var(--gold)' : 'var(--dn)');
    return '<span class="sm-ax" title="' + esc(a.label) + '">' + AX[key].i +
      '<b style="color:' + col + '">' + Math.round(v) + '</b></span>';
  }

  function badgeHtml(r) {
    return r.badges.map(b =>
      '<span class="sm-badge' + (b.ok ? ' ok' : ' no') + '">' + (b.ok ? '✅' : '❌') + ' ' + esc(b.t) + '</span>'
    ).join('');
  }

  function renderList() {
    const box = $('smList');
    if (!box) return;
    if (S.err) {
      box.innerHTML = '<div class="sm-empty">⚠️ ' + esc(S.err) + '</div>';
      return;
    }
    if (!S.rows.length) {
      box.innerHTML = '<div class="sm-empty">⏳ بنحمّل بيانات البورصة…</div>';
      return;
    }
    if (!S.view.length) {
      box.innerHTML = '<div class="sm-empty">🚫 مفيش أسهم مطابقة للفلتر. جرّب حد أدنى أقل أو شيل الفلاتر.</div>';
      return;
    }
    const rows = S.view.slice(0, 120);
    box.innerHTML =
      '<div class="sm-list-head">' +
      '<span class="sm-c1">السهم</span>' +
      '<span class="sm-c2">السعر</span>' +
      '<span class="sm-c3">Smart Money</span>' +
      '<span class="sm-c4">المحاور</span>' +
      '<span class="sm-c5">الحالة</span>' +
      '</div>' +
      rows.map(r =>
        '<div class="sm-row' + (r.weak ? ' weak' : '') + (S.sel === r.code ? ' sel' : '') + '" data-code="' + esc(r.code) + '" role="button" tabindex="0">' +
        '<span class="sm-c1"><b>' + esc(r.code) + '</b><i>' + esc(r.name) + '</i>' +
        (r.sector ? '<em>' + esc(r.sector) + '</em>' : '') + '</span>' +
        '<span class="sm-c2"><b>' + f2(r.price) + '</b><i style="color:' + clr(r.change) + '">' + pct(r.change) + '</i></span>' +
        '<span class="sm-c3"><b class="sm-score" style="color:' + (r.score >= 60 ? 'var(--up)' : (r.score >= 45 ? 'var(--gold)' : 'var(--dn)')) + '">' + Math.round(r.score) + '</b>' +
        bar(r.score, r.score >= 60 ? 'var(--up)' : (r.score >= 45 ? 'var(--gold)' : 'var(--dn)')) + '</span>' +
        '<span class="sm-c4">' + axisCell('trend', r) + axisCell('momentum', r) + axisCell('volatility', r) + axisCell('volume', r) + '</span>' +
        '<span class="sm-c5">' + badgeHtml(r) + '</span>' +
        '</div>').join('') +
      (S.view.length > rows.length
        ? '<div class="sm-more">و ' + (S.view.length - rows.length) + ' سهم تاني — ضيّق الفلتر عشان تشوفهم</div>'
        : '');
    const c = $('smCount');
    if (c) c.textContent = S.view.length;
  }

  function render() {
    renderStatus();
    renderList();
  }

  /* ══════════════════════════════════════════════════════════════
   🃏 كارت السهم — الكروت + الشارت
   ══════════════════════════════════════════════════════════════ */
  function moneyOpen(code) {
    S.sel = code;
    const r = S.rows.filter(x => x.code === code)[0];
    const box = $('smDetail');
    if (!r || !box) { renderList(); return; }
    box.style.display = 'block';
    box.innerHTML =
      '<div class="sm-d-hd">' +
      '<div><div class="sm-d-code">' + esc(r.code) + '</div><div class="sm-d-name">' + esc(r.name) + '</div>' +
      '<div class="sm-d-meta">' + esc(r.sector || '') + (r.m.price != null ? ' · ' + f2(r.m.price) + ' ج.م' : '') +
      ' <span style="color:' + clr(r.change) + '">' + pct(r.change) + '</span></div></div>' +
      '<div class="sm-d-score"><b style="color:' + (r.score >= 60 ? 'var(--up)' : (r.score >= 45 ? 'var(--gold)' : 'var(--dn)')) + '">' + Math.round(r.score) + '</b><i>Smart Money</i></div>' +
      '<button class="sm-d-close" type="button" id="smDClose" title="اقفل">✕</button>' +
      '</div>' +
      '<div class="sm-d-chart" id="smChart"></div>' +
      '<div class="sm-d-badges">' + badgeHtml(r) + '</div>' +
      '<div class="sm-cards" id="smCards">' +
      '<div class="sm-loading">⏳ بنجيب الشموع عشان المؤشرات الذكية…</div>' +
      '</div>';
    renderList();
    /* زرار القفل (مش onclick inline — شيفرة CSP) */
    const cl = $('smDClose');
    if (cl) cl.addEventListener('click', moneyClose);
    /* الشارت */
    try {
      if (window.OCTA_TV) {
        window.OCTA_TV.mount($('smChart'), {
          symbol: 'EGX:' + r.code, interval: '1D',
          studies: 'RSI@tv-basicstudies,MACD@tv-basicstudies',
          compactMobile: false,
          minHeight: 360
        });
      }
    } catch (e) { /* الشارت مش لازم للصفحة تشتغل */ }
    /* الشموع → المؤشرات الثلاثة */
    loadDetail(r);
  }

  function moneyClose() {
    S.sel = null; S.detail = null;
    const box = $('smDetail');
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    renderList();
  }

  async function loadDetail(r) {
    const box = $('smCards');
    if (!box) return;
    /* ① الباك (المرجع) · ② جسر المعاينة (لما الباك يكون واقع) */
    let j = await jget('/api/candles/' + encodeURIComponent(r.code) + '?n=320');
    let via = 'api';
    if (!j || !j.ok || !j.candles || j.candles.length < 25) {
      j = await jget('/api/tvcandles?code=' + encodeURIComponent(r.code) + '&n=320');
      via = 'tv';
    }
    if (!j || !j.ok || !j.candles || j.candles.length < 25) {
      box.innerHTML = '<div class="sm-loading">⚠️ مقدرتش أجيب شموع السهم — المؤشرات الذكية مش متاحة دلوقتي.</div>';
      return;
    }
    const SM = window.OCTA_SM;
    const d = SM.fromCandles(j.candles, r.m);
    S.detail = d;
    box.innerHTML = cardsHtml(r, d) +
      '<div class="sm-src">المؤشرات محسوبة من ' + (j.count || (j.candles ? j.candles.length : 0)) + ' شمعة يومية حقيقية' +
      (via === 'tv' ? ' · من TradingView' : '') + '</div>';
  }

  /* كارت واحد: الاسم · القيمة · بيقيس إيه · الحكم
     ⛔ الحكم لازم يكون ✅ أو ❌ دايماً — مافيش «محايد».
        المستخدم بيسأل «أعمل إيه؟» فالإجابة لازم تكون واضحة. */
  function card(title, icon, value, measures, ok, why, extra) {
    return '<div class="sm-card' + (ok ? ' good' : ' bad') + '">' +
      '<div class="sm-card-h"><span class="sm-card-i">' + icon + '</span><span class="sm-card-t">' + esc(title) + '</span>' +
      '<span class="sm-card-v">' + value + '</span></div>' +
      '<div class="sm-card-m">📎 ' + esc(measures) + '</div>' +
      '<div class="sm-card-w">' + (ok ? '✅' : '❌') + ' ' + esc(why) + '</div>' +
      (extra ? '<div class="sm-card-x">' + extra + '</div>' : '') +
      '</div>';
  }

  function cardsHtml(r, d) {
    const out = [];

    /* ── المحاور الأربعة (من بيانات السوق) ── */
    ['trend', 'momentum', 'volatility', 'volume'].forEach(k => {
      const a = r.axes[k];
      const v = Math.round(a.score);
      const ok = v >= 55;
      const why = (ok ? 'قوي — ' : 'ضعيف — ') + partsText(a);
      out.push(card(AX[k].n, AX[k].i, v + ' / 100', AX_MEASURE[k], ok, why,
        bar(a.score, ok ? 'var(--up)' : 'var(--dn)')));
    });

    if (!d) return out.join('');

    /* ── ① جيميني ── */
    if (d.gemini) {
      const g = d.gemini;
      const st = g.state;
      /* تشبع بيعي = فرصة (ضغط البيع خلص) · تشبع شرائي = خطر */
      const ok = (st === 'bull' || st === 'oversold');
      const why = st === 'overbought' ? 'تشبع شرائي — الخطر بقى أكبر من الفرصة'
        : st === 'oversold' ? 'تشبع بيعي — ضغط البيع خلص (فرصة، مش ترند مكسور)'
          : (st === 'bull' ? 'الفلوس الصاعدة أقوى من الهابطة' : 'الفلوس الهابطة أقوى');
      out.push(card('جيميني — ذكاء الفلوس', '🧠', f1(g.value) + ' / 100',
        'تقاطع تدفق الفلوس بين قصير المدى ومتوسط المدى. فوق ٨٠ تشبع شرائي · تحت ٢٠ تشبع بيعي',
        ok, why, geminiBars(g)));
    }

    /* ── ② القفل ── */
    if (d.lock) {
      const l = d.lock;
      const ok = l.state === 'in' ? true : (l.state === 'out' ? false : null);
      const why = l.state === 'in' ? 'مؤسسات داخل — حجم مع الصعود'
        : (l.state === 'out' ? 'مؤسسات بتسحب — حجم مع الهبوط' : 'مفيش اتجاه واضح في الحجم');
      out.push(card('القفل — تدفق الحجم', '🔒', l.state === 'in' ? 'دخول' : (l.state === 'out' ? 'خروج' : 'محايد'),
        'أعمدة الحجم بتقول المؤسسات دخلت ولا خرجت. مفيش أعمدة = المؤسسات بتسحب',
        ok, why, lockBars(l)));
    }

    /* ── ③ MCDX ── */
    if (d.mcdx) {
      const x = d.mcdx;
      const ok = x.state === 'inst';
      const why = x.state === 'inst' ? 'المؤسسات مسيطرة على السوق'
        : (x.state === 'retail' ? 'الأفراد مسيطرين — مش هما اللي بيتحكموا' : 'مفيش هيمنة واضحة — مش مؤشر ذكي');
      const cross = x.cross === 'gc' ? ' · التقاطع الذهبي = إشارة دخول'
        : (x.cross === 'dc' ? ' · التقاطع المميت = المؤسسات بتسحب' : '');
      out.push(card('MCDX — مين ماسك السوق', '⚖️', f1(x.value) + ' / 100',
        'فرق السيطرة بين المؤسسات والأفراد. فوق ٥٠ المؤسسات · تحت ٥٠ الأفراد' + cross,
        ok, why, mcdxBar(x)));
    }

    /* ── البنية ── */
    if (d.structure) {
      const s = d.structure;
      const ok = s.state === 'bull';
      out.push(card('البنية — BOS و CHoC', '🏗️', s.bos === 'up' ? 'BOS صاعد' : (s.bos === 'down' ? 'BOS هابط' : (s.choc ? 'تغيّر الطابع' : 'سوق عرض')),
        'كسر السقف أو الأرض = البنية الجديدة. كسر عكس الاتجاه = تغيّر الطابع',
        ok, s.label,
        '<div class="sm-lv"><span>مقاومة <b>' + f2(s.resistance) + '</b></span><span>دعم <b>' + f2(s.support) + '</b></span></div>'));
    }

    /* ── مستويات الـATR ── */
    if (d.levels) {
      const L = d.levels;
      out.push('<div class="sm-card sm-card-wide">' +
        '<div class="sm-card-h"><span class="sm-card-i">🎯</span><span class="sm-card-t">الدخول ووقف الخسارة والهدف</span>' +
        '<span class="sm-card-v">ATR ' + f2(d.atr) + ' (' + f1(d.atrPct) + '% من السعر)</span></div>' +
        '<div class="sm-lv3">' +
        '<div class="sm-lv3-i"><span>دخول</span><b>' + f2(L.entry) + '</b></div>' +
        '<div class="sm-lv3-i stop"><span>وقف الخسارة</span><b>' + f2(L.stop) + '</b><i>' + f1(L.stopPct) + '%</i></div>' +
        '<div class="sm-lv3-i tgt"><span>هدف أول</span><b>' + f2(L.target) + '</b><i>' + f1(L.targetPct) + '%</i></div>' +
        '</div>' +
        '<div class="sm-card-m">📎 المسافة محسوبة من مدى التذبذب الحقيقي (ATR) — مش رقم مخترع.</div>' +
        '</div>');
    }

    return out.join('');
  }

  const AX_MEASURE = {
    trend: 'السوق صاعد ولا هابط · السعر فوق المتوسطات المتحركة',
    momentum: 'قوة الحركة · RSI و MACD (مع عقوبة التشبع)',
    volatility: 'سرعة تغيّر السعر · مقاس بالنطاق المريح للسوق',
    volume: 'ضغط التدفق والسيولة · هل فيه فلوس بتدخل'
  };

  function partsText(a) {
    const bits = a.parts.map(p => p.txt).filter(Boolean);
    if (!bits.length) return 'مفيش بيانات كفاية';
    return bits.slice(0, 3).join(' · ');
  }

  function geminiBars(g) {
    const st = g.short, mt = g.mid;
    const w = (v) => Math.max(6, Math.min(100, Math.abs(v) * 220 + 12));
    return '<div class="sm-gem">' +
      '<span class="sm-gem-i' + (st >= mt ? ' up' : ' dn') + '">قصير المدى <i style="width:' + w(st) + '%"></i></span>' +
      '<span class="sm-gem-i' + (st >= mt ? ' up' : ' dn') + '">متوسط المدى <i style="width:' + w(mt) + '%"></i></span>' +
      '<span class="sm-gem-n">الفرق ' + f1(g.spread) + '%</span></div>';
  }

  function lockBars(l) {
    const max = Math.max.apply(null, l.bars.map(b => Math.abs(b)).concat([0.5]));
    return '<div class="sm-lock">' + l.bars.map(b =>
      '<i class="' + (b >= 0 ? 'up' : 'dn') + '" style="height:' + (Math.abs(b) / max * 100) + '%"></i>').join('') + '</div>';
  }

  function mcdxBar(x) {
    const p = Math.max(0, Math.min(100, x.value));
    return '<div class="sm-mcdx"><span class="sm-mcdx-retail">أفراد</span>' +
      '<span class="sm-mcdx-bar"><i style="width:' + p + '%"></i></span>' +
      '<span class="sm-mcdx-inst">مؤسسات</span>' +
      '<span class="sm-mcdx-gap">الفجوة ' + f1(x.gap) + '</span></div>';
  }

  /* ══════════════════════════════════════════════════════════════
   🔌 التهيئة + الأحداث
   ══════════════════════════════════════════════════════════════ */
  window.moneyInit = function () {
    if (!S.rows.length) loadData(); else render();
  };
  window.moneyOpen = moneyOpen;
  window.moneyClose = moneyClose;
  window.moneyReload = function () { S.rows = []; loadData(true); };

  function bind() {
    const q = $('smQ');
    if (q) q.addEventListener('input', function () { S.q = q.value; apply(); });
    const sort = $('smSort');
    if (sort) sort.addEventListener('change', function () { S.sort = sort.value; apply(); });
    const sect = $('smSect');
    if (sect) sect.addEventListener('change', function () { S.sect = sect.value; apply(); });
    const min = $('smMin');
    if (min) min.addEventListener('input', function () {
      S.min = Number(min.value || 0);
      const v = $('smMinV'); if (v) v.textContent = S.min;
      apply();
    });
    const ag = $('smAgree');
    if (ag) ag.addEventListener('click', function () {
      S.agreeOnly = !S.agreeOnly;
      ag.classList.toggle('on', S.agreeOnly);
      apply();
    });
    const weak = $('smWeak');
    if (weak) weak.addEventListener('click', function () {
      S.showWeak = !S.showWeak;
      weak.classList.toggle('on', S.showWeak);
      apply();
    });
    const re = $('smReload');
    if (re) re.addEventListener('click', function () { window.moneyReload(); });
    const dir = $('smDir');
    if (dir) dir.addEventListener('click', function () {
      S.dir = -S.dir;
      dir.textContent = S.dir < 0 ? '\u2B07' : '\u2B06';
      apply();
    });
    /* 🖱 النقر على صف السهم — تفويض (مش onclick inline: سياسة الأمان) */
    const list = $('smList');
    if (list) {
      list.addEventListener('click', function (e) {
        const row = e.target && e.target.closest ? e.target.closest('.sm-row') : null;
        if (!row) return;
        const code = row.getAttribute('data-code');
        if (code) moneyOpen(code);
      });
      list.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const row = e.target && e.target.closest ? e.target.closest('.sm-row') : null;
        if (!row) return;
        e.preventDefault();
        const code = row.getAttribute('data-code');
        if (code) moneyOpen(code);
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

})();
