/* ══════════════════════════════════════════════════════════════
   🔍 Stock Screener v5 — فلاتر TradingView الحقيقية
   ------------------------------------------------------------
   كل الأعمدة من TradingView scanner مباشرة:
   Valuation · Profitability · Leverage · Dividends · Technical
   Performance · Liquidity · Growth
   ══════════════════════════════════════════════════════════════ */

(function () {

  /* ══════════════ حالة الفلترة ══════════════ */
  const S = {
    q: '', sect: 'all',
    /* تقييم */
    peMax: null, peMin: null, pbMax: null,
    /* ربحية */
    roeMin: null, roaMin: null, roicMin: null,
    nmMin: null, omMin: null, gmMin: null,
    /* رافعة وسيولة */
    deMax: null, crMin: null, qrMin: null,
    /* توزيعات */
    dyMin: null, payoutMax: null,
    /* فنية */
    rsiMin: null, rsiMax: null,
    ma200: null,                 /* above | below */
    macd: null,                  /* above | below */
    /* أداء */
    p1mMin: null, p3mMin: null, p6mMin: null, p1yMin: null, pYtdMin: null,
    /* سيولة */
    volMin: null, mcMin: null,
    /* حجم traded */
    valMin: null,
    /* توصية TV */
    tv: null,
    sort: 'mc', dir: -1, shown: 40,
    /* OCTA */
    oScoreMin: null, oConfMin: null, oMddMax: null, oVolMax: null,
    oSharpeMin: null, oCagrMin: null, oRoicMin: null, oFcfMin: null, oVerdict: null,
    mode: 'tv',            /* tv | octa */
    lvl: 'start',          /* start | mid | pro | inst */
    live: false,           /* التحديث اللحظي شغّال؟ */
    lastQ: null,           /* آخر وقت تحديث */
    mkt: null, mktT: null, /* حالة السوق */
    live: false,           /* التحديث اللحظي شغّال؟ */
    lastQ: null,           /* آخر وقت تحديث */
    mkt: null, mktT: null, /* حالة السوق */
    advOpen: false, aboutOpen: false, grp: 'all', grpO: 'qual'
  };

  const MARKS = [
    { id: 'egypt', i: '🇪🇬', n: 'بورصة مصر', cur: 'ج' },
    { id: 'us', i: '🇺🇸', n: 'أمريكا', cur: '$' },
    { id: 'saudi', i: '🇸🇦', n: 'السعودية', cur: 'ر' },
    { id: 'uae', i: '🇦🇪', n: 'الإمارات', cur: 'د' }
  ];
  let M = MARKS[0];
  let MK = null;
  function mkData() {
    if (MK) return MK;
    try { if (typeof OCTA_MK !== 'undefined' && OCTA_MK) { MK = OCTA_MK; return MK; } } catch (e) { }
    return null;
  }

  /* ══════════════ أدوات ══════════════ */
  const N = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  function safe(v) {
    return String(v == null ? '' : v)
      .replace(/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF\u4e00-\u9fff\u0400-\u04FF\ufffd]/g, '')
      .replace(/\s{2,}/g, ' ').replace(/'/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  const esc = safe;
  const f2 = v => N(v) != null ? Number(v).toFixed(2) : null;
  const f1 = v => N(v) != null ? Number(v).toFixed(1) : null;
  const f0 = v => N(v) != null ? Math.round(v) : null;
  const sg = v => N(v) != null ? (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%' : null;
  const sd = v => {                        /* يوم واحد → 1.42 */
    if (N(v) == null) return null;
    if (v < 0) return null;
    return v < 1 ? (v * 100).toFixed(2) : v.toFixed(2);
  };
  function big(v) {
    if (N(v) == null) return null;
    const a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(2) + 'K';
    return String(Math.round(v));
  }
  function dirCls(v) {
    if (v == null) return '';
    return v < 0 ? 'dn' : 'up';
  }

  function gq(s, keys, d) {
    for (let i = 0; i < keys.length; i++) {
      const v = s[keys[i]];
      if (v != null && v !== '' && !Number.isNaN(v)) return v;
    }
    return d;
  }
  function db() { const d = mkData(); return (d && d[M.id]) || []; }

  /* ══════════════ لوغوهات ══════════════ */
  const LB = [
    ['#4dabf7', '#1971c2'], ['#51cf66', '#2f9e44'], ['#ffa94d', '#e8590c'],
    ['#b197fc', '#7048e8'], ['#ff8787', '#e03131'], ['#3bc9db', '#0c8599'],
    ['#ffd43b', '#f08c00'], ['#63e6be', '#0ca678'], ['#faa2c1', '#c2255c'],
    ['#91a7ff', '#364fc7'], ['#fcc419', '#e67700'], ['#38d9a9', '#087f5b'],
    ['#748ffc', '#4263eb'], ['#ff922b', '#e8590c'], ['#22b8cf', '#0b7285'],
    ['#f06595', '#c92a2a'], ['#69db7c', '#2f9e44'], ['#9775fa', '#5f3dc4'],
    ['#ffa8a8', '#c92a2a'], ['#66d9e8', '#1098ad'], ['#ffe066', '#f59f00'],
    ['#8ce99a', '#37b24d'], ['#d0bfff', '#7950f2'], ['#ffc078', '#e8590c']
  ];
  function logoOf(code) {
    let h = 0;
    for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) & 0x7fffffff;
    const c = LB[h % LB.length];
    return 'linear-gradient(140deg,' + c[0] + ' 0%,' + c[1] + ' 100%)';
  }
  const logoHTML = c =>
    '<span class="sv-logo" style="background:' + logoOf(c) + '">' + esc(c.charAt(0)) + '</span>';

  /* ══════════════ التوصية الفنية ══════════════ */
  function tvVerdict(s) {
    /* لو TradingView مجابش توصية (أسهم ناشفة) — نستعمل حسابنا من RSI/MACD/MA200 */
    let r = N(s.tvRec);
    if (r == null) r = N(s.tvRecCalc);
    if (r == null) return { t: 'حيادي', cls: 'neutral' };
    if (r >= 0.5) return { t: 'شراء قوي', cls: 'sbuy' };
    if (r >= 0.1) return { t: 'شراء', cls: 'buy' };
    if (r > -0.1) return { t: 'حيادي', cls: 'neutral' };
    if (r > -0.5) return { t: 'بيع', cls: 'sell' };
    return { t: 'بيع قوي', cls: 'ssell' };
  }

  const SEC_AR = {
    'Finance': 'مالية', 'Bank': 'بنوك', 'Banks': 'بنوك', 'Financial Services': 'خدمات مالية',
    'Process Industries': 'صناعات عملية', 'Consumer Non-Durables': 'سلع استهلاكية',
    'Consumer Durables': 'سلع معمّرة', 'Health Technology': 'رعاية صحية',
    'Healthcare': 'رعاية صحية', 'Technology': 'تكنولوجيا', 'Technology Services': 'خدمات تكنولوجيا',
    'Transportation': 'نقل', 'Energy': 'طاقة', 'Oil & Gas': 'نفط وغاز',
    'Consumer Cyclical': 'استهلاكي متكرر', 'Consumer Defensive': 'استهلاكي أساسي',
    'Utilities': 'مرافق', 'Real Estate': 'عقارات', 'Basic Materials': 'مواد أساسية',
    'Industrials': 'صناعة', 'Communication Services': 'اتصالات', 'Retail': 'تجزئة',
    'Retail Trade': 'تجزئة', 'Construction': 'مقاولات', 'Travel & Tourism': 'سياحة',
    'Education': 'تعليم', 'Food & Beverage': 'أغذية', 'Agriculture': 'زراعة',
    'Mining': 'تعدين', 'Semiconductors': 'أشباه موصلات', 'Software': 'برمجيات',
    'Internet': 'إنترنت', 'Media': 'إعلام', 'Insurance': 'تأمين',
    'Biotechnology': 'بيوتكولوجيا', 'Pharmaceuticals': 'أدوية',
    'Medical Devices': 'أجهزة طبية', 'Auto Components': 'قطع غيار'
  };
  function sectorAr(s) {
    if (s.sectorAr) return s.sectorAr;
    const raw = s.sector || 'عام';
    if (/[؀-ۿ]/.test(raw)) return raw;
    return SEC_AR[raw] || raw;
  }

  /* ══════════════ الفلترة ══════════════ */
  function sectors() {
    const set = {};
    db().forEach(s => { const k = sectorAr(s); set[k] = (set[k] || 0) + 1; });
    return Object.keys(set).sort((a, b) => set[b] - set[a]);
  }

  /* helper: القيمة أو null — الفلاتر بتتجاهل اللي فاضي */
  function ok(v, min, max) {
    if (v == null) return false;
    if (min != null && v < min) return false;
    if (max != null && v > max) return false;
    return true;
  }

  function filter() {
    const q = S.q.trim().toLowerCase();
    return db().filter(function (s) {
      /* ⚠️ أسهم بلا بيانات (موقوفة / غير متاحة) — نستبعدها من الجدول
         لأنها مش قابلة للتحليل — مفيش سعر ولا مؤشرات */
      if (s.noData) return false;
      const px = N(gq(s, ['price'], 0));
      if (!px) return false;
      if (q) {
        const c = (s.code || '').toLowerCase();
        const n = (s.name || '').toLowerCase();
        const e = (s.nameEn || '').toLowerCase();
        if (c.indexOf(q) < 0 && n.indexOf(q) < 0 && e.indexOf(q) < 0) return false;
      }
      if (S.sect !== 'all' && sectorAr(s) !== S.sect) return false;

      /* التقييم */
      if (S.peMax != null && !ok(s.pe, null, S.peMax)) return false;
      if (S.peMin != null && !ok(s.pe, S.peMin, null)) return false;
      if (S.pbMax != null && !ok(s.pb, null, S.pbMax)) return false;

      /* الربحية */
      if (S.roeMin != null && !ok(s.roe, S.roeMin, null)) return false;
      if (S.roaMin != null && !ok(s.roa, S.roaMin, null)) return false;
      if (S.roicMin != null && !ok(s.roic, S.roicMin, null)) return false;
      if (S.nmMin != null && !ok(s.nm, S.nmMin, null)) return false;
      if (S.omMin != null && !ok(s.om, S.omMin, null)) return false;
      if (S.gmMin != null && !ok(s.gm, S.gmMin, null)) return false;

      /* الرافعة والسيولة */
      if (S.deMax != null && !ok(s.de, null, S.deMax)) return false;
      if (S.crMin != null && !ok(s.cr, S.crMin, null)) return false;
      if (S.qrMin != null && !ok(s.qr, S.qrMin, null)) return false;

      /* التوزيعات */
      if (S.dyMin != null && !ok(s.dy, S.dyMin, null)) return false;
      if (S.payoutMax != null && !ok(s.payout, null, S.payoutMax)) return false;

      /* فنية */
      if (S.rsiMin != null && !ok(s.rsi, S.rsiMin, null)) return false;
      if (S.rsiMax != null && !ok(s.rsi, null, S.rsiMax)) return false;
      if (S.ma200 === 'above' && !(s.price > s.sma200)) return false;
      if (S.ma200 === 'below' && !(s.price < s.sma200)) return false;
      if (S.ma200 === 'above90' && !(s.price > s.sma200 * 0.9)) return false;
      if (S.macd === 'above' && !((s.macd != null && s.macdSig != null) && s.macd > s.macdSig)) return false;
      if (S.macd === 'below' && !((s.macd != null && s.macdSig != null) && s.macd < s.macdSig)) return false;

      /* الأداء */
      if (S.p1mMin != null && !ok(s.p1m, S.p1mMin, null)) return false;
      if (S.p3mMin != null && !ok(s.p3m, S.p3mMin, null)) return false;
      if (S.p6mMin != null && !ok(s.p6m, S.p6mMin, null)) return false;
      if (S.p1yMin != null && !ok(s.p1y, S.p1yMin, null)) return false;
      if (S.pYtdMin != null && !ok(s.pYtd, S.pYtdMin, null)) return false;

      /* السيولة */
      if (S.volMin != null && !ok(s.av30, S.volMin, null)) return false;
      if (S.mcMin != null && !ok(s.mc, S.mcMin, null)) return false;
      if (S.valMin != null) {
        const vp = (s.volume != null && s.price) ? s.volume * s.price : null;
        if (vp == null || vp < S.valMin) return false;
      }

      /* توصية TV */
      if (S.tv) { if (tvVerdict(s).t.indexOf(S.tv) < 0) return false; }

      /* ═══ فلاتر OCTA ═══ */
      if (S.mode === 'octa') {
        if (S.oScoreMin != null && !ok(s.total, S.oScoreMin, null)) return false;
        if (S.oConfMin != null && !ok(s.conf, S.oConfMin, null)) return false;
        if (S.oMddMax != null && !ok(s.mdd1y, null, S.oMddMax)) return false;
        if (S.oVolMax != null && !ok(s.vol1y, null, S.oVolMax)) return false;
        if (S.oSharpeMin != null && !ok(s.sharpe3y, S.oSharpeMin, null)) return false;
        if (S.oCagrMin != null && !ok(s.cagr3y, S.oCagrMin, null)) return false;
        if (S.oRoicMin != null && !ok(s.roic, S.oRoicMin, null)) return false;
        if (S.oFcfMin != null && !ok(s.fcf, S.oFcfMin, null)) return false;
        if (S.oVerdict && String(s.verdict || '') !== S.oVerdict) return false;
      }

      return true;
    });
  }

  const SORTK = {
    code: ['code'], name: ['name'], price: ['price'], chg: ['change'],
    vol: ['volume'], val: ['__val'], av30: ['av30'], mc: ['mc'],
    pe: ['pe'], pb: ['pb'], eps: ['eps'], roe: ['roe'], roa: ['roa'],
    nm: ['nm'], om: ['om'], gm: ['gm'], de: ['de'], cr: ['cr'], qr: ['qr'],
    dy: ['dy'], payout: ['payout'], rsi: ['rsi'], beta: ['beta'],
    volD: ['volD'], p1w: ['p1w'], p1m: ['p1m'], p3m: ['p3m'],
    p6m: ['p6m'], p1y: ['p1y'], pYtd: ['pYtd'], tv: ['tvRec'],
    ema20: ['ema20'], sma50: ['sma50'], sma200: ['sma200'],
    score: ['total'], verdict: ['verdict'], conf: ['conf'],
    sharpe: ['sharpe3y'], cagr: ['cagr3y'], mdd: ['mdd1y'],
    float: ['float'], rev: ['rev'], ebitda: ['ebitda'], fcf: ['fcf'],
    epsF: ['epsF'], sector: ['__sec']
  };

  /* ترتيب نصّي بالأولوية (مش أبجدي!) */
  const TV_RANK = { 'شراء قوي': 5, 'شراء': 4, 'حيادي': 3, 'بيع': 2, 'بيع قوي': 1 };
  const OCTA_ORDER = ['تجميع', 'احتفظ', 'غير كافٍ', 'بيع', 'متابعة', '—'];
  const VERDICT_W = { 'تجميع': 5, 'احتفظ': 4, 'متابعة': 3, 'غير كافٍ': 2, 'بيع': 1 };

  function sortRows(rows) {
    const k = S.sort, d = S.dir;
    /* ⬇️ الترتيب التصنيفي — dir = -1 يعني الأقوى فوق دايماً */

    /* التوصية الفنية — بالأولوية مش بالرقم */
    if (k === 'tv') {
      return rows.slice().sort(function (a, b) {
        const ra = TV_RANK[tvVerdict(a).t] || 0, rb = TV_RANK[tvVerdict(b).t] || 0;
        return ra !== rb ? (ra - rb) * d : String(a.code).localeCompare(String(b.code));
      });
    }
    /* قرار OCTA — بالأولوية */
    if (k === 'verdict') {
      return rows.slice().sort(function (a, b) {
        const ra = VERDICT_W[a.verdict] || 0, rb = VERDICT_W[b.verdict] || 0;
        return ra !== rb ? (ra - rb) * d : String(a.code).localeCompare(String(b.code));
      });
    }
    return rows.slice().sort(function (a, b) {
      if (k === 'code' || k === 'name' || k === 'sector') {
        const ga = k === 'sector' ? sectorAr(a) : (a[k] || a.name || a.code || '');
        const gb = k === 'sector' ? sectorAr(b) : (b[k] || b.name || b.code || '');
        return String(ga).localeCompare(String(gb), 'ar') * d;
      }
      let va, vb;
      if (k === 'val') { va = a.volume != null ? a.volume * a.price : null; vb = b.volume != null ? b.volume * b.price : null; }
      else va = N(a[k]), vb = N(b[k]);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (vb - va) * d;
    });
  }

  /* ══════════════════════════════════════════════════════════════
     💵 الأسعار اللحظية — مواعيد البورصة المصرية + كل ساعة
     ══════════════════════════════════════════════════════════════ */
  const LIVE_API = window.OCTA_API + '/api/quotes';
  let LIVE_TIMER = null;
  let CLOCK_TIMER = null;

  /* 🕐 حالة السوق من EGXClock (لو مش موجود نعمل واحد احتياطي) */
  function mkt() {
    if (window.EGXClock) return window.EGXClock.state();
    const n = new Date();
    return { e: '🟢', c: '#51cf66', p: 60000, open: true, live: true, t: '—', nextAt: null };
  }

  function startLive() {
    if (LIVE_TIMER) return;
    tickLive();
    scheduleNext();
    /* ⏱️ تحديث العدّاد كل 5 ثواني حتى لو السعر مش بيتغير */
    CLOCK_TIMER = setInterval(function () {
      renderLiveDot();
      /* لو الوقت اتغير ( session بدأت أو خلصت ) نحدّث فورًا */
      const st = mkt();
      if (st.t !== S.mktT) { S.mktT = st.t; scheduleNext(); tickLive(); }
    }, 5000);
  }

  /* ⏱️ نحسب الوقت الجاي حسب حالة السوق */
  function scheduleNext() {
    const st = mkt();
    clearTimeout(LIVE_TIMER);
    LIVE_TIMER = setTimeout(function () { tickLive(); scheduleNext(); }, st.p);
    S.mktT = st.t;
  }

  function tickLive() {
    const db0 = db();
    if (!db0.length) return;
    fetch(LIVE_API + '?market=' + M.id)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) return;
        const rows = (j.markets || {})[M.id];
        if (!rows) return;
        let changed = 0;
        db0.forEach(function (st) {
          const q = rows[st.code];
          if (!q || q.close == null) return;
          const old = st.price;
          st.price = q.close;
          if (q.change != null) st.change = q.change;
          if (q.volume != null) st.volume = q.volume;
          if (q.Recommend != null) st.tvRec = q['Recommend.All'];
          if (old != null && old !== q.close) { st._up = q.close > old; changed++; }
        });
        S.live = true;
        const d = new Date();
        S.lastQ = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        S.mkt = mkt();
        if (changed && !document.querySelector('.sv-adv')) render();
        else renderLiveDot();
      })
      .catch(function () { S.live = false; renderLiveDot(); });
  }

  /* 🕐 العدّاد: حالة السوق + آخر تحديث */
  function renderLiveDot() {
    const el = document.getElementById('scUpd');
    if (!el) return;
    const st = mkt();
    const dot = S.live ? '🟢' : '⚪';
    const t = S.lastQ || '…';
    el.innerHTML = '<span class="sc-upd">'
      + '<b style="color:' + (S.live ? st.c : '#868e96') + '">' + st.e + ' ' + st.t + '</b>'
      + ' <span style="opacity:.6">·</span> '
      + '<span>' + dot + ' ' + t + '</span>'
      + (st.nextAt ? ' <span style="opacity:.55">· بعده: ' + st.nextAt + '</span>' : '')
      + '</span>';
  }

  /* ══════════════ الرندر ══════════════ */
  function render() {
    const head = document.getElementById('scHead');
    const out = document.getElementById('scBody');
    if (!out) return;

    if (head) head.innerHTML = headHTML();
    const rows = sortRows(filter());
    const total = db().length;

    const tE = document.getElementById('scTotal'); if (tE) tE.textContent = total;
    const cE = document.getElementById('scCount'); if (cE) cE.textContent = rows.length;
    renderLiveDot();

    if (!total) { out.innerHTML = '<div class="sv-empty">⏳ بنحمّل البيانات...<br><small>ثانيتين بس</small></div>'; return; }
    if (!rows.length) { out.innerHTML = '<div class="sv-empty">🚫 مفيش أسهم مطابقة<br><small>وسّع الشروط</small></div>' + aboutBox(); return; }

    const shown = rows.slice(0, S.shown);
    out.innerHTML = tbl(shown) +
      (rows.length > S.shown
        ? '<button class="sv-more" onclick="scMore()">عرض ' + Math.min(40, rows.length - S.shown) +
        ' كمان — (' + rows.length + ' متبقي)</button>' : '') + aboutBox();
  }

  function headHTML() {
    const sec = sectors();
    return '<div class="sv-marks">' + MARKS.map(m =>
      '<button class="sv-mk' + (m.id === M.id ? ' on' : '') + '" onclick="scSetMarket(\'' + m.id + '\')">' +
      '<span>' + m.i + '</span>' + esc(m.n) + '</button>').join('') + '</div>' +

      '<div class="sv-mode">' +
        '<button class="sv-mb' + (S.mode === 'tv' ? ' on' : '') +
        '" onclick="scMode(\'tv\')">📊 فلاتر TradingView</button>' +
        '<button class="sv-mb' + (S.mode === 'octa' ? ' on' : '') +
        '" onclick="scMode(\'octa\')">🐙 فلاتر OCTA</button>' +
      '</div>' +

      '<div class="sv-row">' +
        '<div class="sv-search">' +
          '<input id="scQ" type="search" placeholder="ابحث بالاسم أو الرمز…" value="' + esc(S.q) + '" oninput="scQInput(this)" autocomplete="off" spellcheck="false">' +
          (S.q ? '<button onclick="scQ(\'\')">✕</button>' : '') +
        '</div>' +
        '<button class="sv-adv' + (S.advOpen ? ' on' : '') + '" onclick="scAdv()">' +
          (S.advOpen ? '✕ إخفاء' : '⚙ الفلاتر') + (advCount() ? ' <b>' + advCount() + '</b>' : '') + '</button>' +
        '<button class="sv-about" onclick="scAbout()">❓ المعايير</button>' +
      '</div>' +

      (S.advOpen ? advPanel() : '') +

      (S.advOpen ? grpBar() : '') +

      '<div class="sv-sects">' +
        '<button class="sv-sect' + (S.sect === 'all' ? ' on' : '') + '" onclick="scSect(\'all\')">الكل</button>' +
        sec.map(k => '<button class="sv-sect' + (S.sect === k ? ' on' : '') +
          '" onclick="scSect(\'' + esc(k) + '\')">' + esc(k) + '</button>').join('') +
      '</div>';
  }

  /* ══════════════ مجموعات الفلاتر ══════════════ */
  const GRPS = [
    { id: 'val', n: '💎 التقييم', f: [
      ['P/E — أقصى', 'peMax', 0, 200, 1], ['P/E — أدنى', 'peMin', 0, 100, 1],
      ['P/B — أقصى', 'pbMax', 0, 30, 0.5] ] },
    { id: 'prof', n: '📈 الربحية', f: [
      ['ROE أدنى %', 'roeMin', -30, 80, 1], ['ROA أدنى %', 'roaMin', -30, 60, 1],
      ['ROIC أدنى %', 'roicMin', -30, 60, 1], ['هامش صافي %', 'nmMin', -100, 90, 1],
      ['هامش تشغيلي %', 'omMin', -200, 90, 1], ['هامش إجمالي %', 'gmMin', -200, 95, 1] ] },
    { id: 'lev', n: '⚖️ الرافعة', f: [
      ['دين / حقوق %', 'deMax', 0, 500, 5], ['سيولة_current', 'crMin', 0, 15, 0.1],
      ['سيولة سريعة', 'qrMin', 0, 15, 0.1] ] },
    { id: 'div', n: '💵 التوزيعات', f: [
      ['عائد أدنى %', 'dyMin', 0, 30, 0.5], ['نسبة التوزيع %', 'payoutMax', 0, 200, 5] ] },
    { id: 'tech', n: '📊 الفنية', sel: [
      ['ma200', 'above', 'فوق SMA200'], ['ma200', 'below', 'تحت SMA200'],
      ['macd', 'above', 'MACD فوق الإشارة'], ['macd', 'below', 'MACD تحت الإشارة'] ] },
    { id: 'perf', n: '📊 الأداء', f: [
      ['1 أسبوع %', 'p1wMin', -100, 500, 5], ['1 شهر %', 'p1mMin', -100, 500, 5],
      ['3 شهور %', 'p3mMin', -100, 900, 5], ['6 شهور %', 'p6mMin', -200, 2000, 10],
      ['1 سنة %', 'p1yMin', -200, 3000, 10], ['من بداية السنة %', 'pYtdMin', -200, 3000, 10] ] },
    { id: 'liq', n: '💧 السيولة', f: [
      ['حجم 30 يوم', 'volMin', 0, 1e9, 10000], ['قيمة سوقية (مليون)', 'mcMin', 0, 1e7, 100],
      ['قيمة متداولة', 'valMin', 0, 1e9, 100000] ] },
    { id: 'rsi', n: '🌡️ RSI', f: [
      ['RSI أدنى', 'rsiMin', 0, 100, 5], ['RSI أقصى', 'rsiMax', 0, 100, 5] ] },
    { id: 'tv', n: '🎯 توصية TV', sel: [
      ['tv', 'شراء قوي', 'شراء قوي'], ['tv', 'شراء', 'شراء'], ['tv', 'حيادي', 'حيادي'],
      ['tv', 'بيع', 'بيع'], ['tv', 'بيع قوي', 'بيع قوي'] ] }
  ];

  /* ══ مجموعات OCTA ══ */
  const GRPS_O = [
    { id: 'qual', n: '🎯 الجودة', f: [
      ['تقييم OCTA أدنى', 'oScoreMin', 0, 100, 5],
      ['ثقة البيانات أدنى %', 'oConfMin', 0, 100, 10],
      ['ROIC أدنى %', 'oRoicMin', -20, 50, 1],
      ['كاش تشغيلي (FCF)', 'oFcfMin', -1e12, 1e12, 1e8] ] },
    { id: 'val', n: '💎 القيمة', f: [
      ['P/E أقصى', 'peMax', 0, 200, 1], ['P/B أقصى', 'pbMax', 0, 30, 0.5] ] },
    { id: 'risk', n: '🛡️ المخاطرة', f: [
      ['أقصى هبوط %', 'oMddMax', 5, 100, 5],
      ['تذبذب سنوي %', 'oVolMax', 10, 200, 5] ] },
    { id: 'perf', n: '📊 الأداء', f: [
      ['شارب أدنى', 'oSharpeMin', -5, 10, 0.25],
      ['CAGR 3 سنين %', 'oCagrMin', -50, 100, 5] ] },
    { id: 'dec', n: '⚖️ القرار', sel: [
      ['oVerdict', 'تجميع', 'تجميع'], ['oVerdict', 'احتفظ', 'احتفظ'],
      ['oVerdict', 'غير كافٍ', 'غير كافٍ'], ['oVerdict', 'بيع', 'بيع'] ] }
  ];

  function grpBar() {
    if (S.mode === 'octa') {
      return '<div class="sv-grps">' + GRPS_O.map(g =>
        '<button class="sv-grp-b' + (S.grpO === g.id ? ' on' : '') +
        '" onclick="scGrpO(\'' + g.id + '\')">' + g.n + '</button>').join('') + '</div>';
    }
    return '<div class="sv-grps">' + GRPS.map(g =>
      '<button class="sv-grp-b' + (S.grp === g.id ? ' on' : '') +
      '" onclick="scGrp(\'' + g.id + '\')">' + g.n + '</button>').join('') + '</div>';
  }

    function advPanel() {
    if (S.mode === 'octa') {
      const g = GRPS_O.find(x => x.id === S.grpO) || GRPS_O[0];
      let body = '';
      if (g.sel) {
        const seen = {};
        g.sel.forEach(function (x) {
          const k = x[0], v = x[1], l = x[2];
          if (seen[k]) return; seen[k] = 1;
          body += '<label class="sv-f"><i>' + l + '</i><select class="sv-sel" onchange="scSel(\'' + k + '\',this.value)">' +
            '<option value="">الكل</option>' +
            g.sel.filter(y => y[0] === k).map(y => '<option value="' + y[1] + '"' +
              (String(S[k] || '') === y[1] ? ' selected' : '') + '>' + y[2] + '</option>').join('') +
            '</select></label>';
        });
      } else {
        body = g.f.map(function (x) {
          const l = x[0], k = x[1], mn = x[2], mx = x[3], st = x[4];
          return '<label class="sv-f"><i>' + l + '</i>' +
            '<input type="number" min="' + mn + '" max="' + mx + '" step="' + st +
            '" value="' + (S[k] == null ? '' : S[k]) + '" placeholder="الكل" ' +
            'oninput="scInp(\'' + k + '\',this,' + mn + ',' + mx + ')" ' +
        'onchange="scNum(\'' + k + '\',this.value,' + mn + ',' + mx + ')"></label>';
        }).join('');
      }
      return '<div class="sv-advp">' + body +
        '<div class="sv-advf">' +
        '<button class="sv-rst" onclick="scReset()">🔄 مسح الكل</button>' +
        (advCount() ? '<span>' + advCount() + ' فلتر مُفعّل</span>' : '<span>مفيش فلاتر مفعّلة</span>') +
        '</div></div>';
    }

    const g = GRPS.find(x => x.id === S.grp) || GRPS[0];
    let body = '';
    if (g.sel) {
      const seen = {};
      g.sel.forEach(function (x) {
        const k = x[0], v = x[1], l = x[2];
        if (seen[k]) return; seen[k] = 1;
        body += '<label class="sv-f"><i>' + l + '</i><select class="sv-sel" onchange="scSel(\'' + k + '\',this.value)">' +
          '<option value="">الكل</option>' +
          g.sel.filter(y => y[0] === k).map(y => '<option value="' + y[1] + '"' +
            (String(S[k] || '') === y[1] ? ' selected' : '') + '>' + y[2] + '</option>').join('') +
          '</select></label>';
      });
    } else {
      body = g.f.map(function (x) {
        const l = x[0], k = x[1], mn = x[2], mx = x[3], st = x[4];
        return '<label class="sv-f"><i>' + l + '</i>' +
          '<input id="f_' + k + '" type="number" min="' + mn + '" max="' + mx + '" step="' + st +
          '" value="' + (S[k] == null ? '' : S[k]) + '" placeholder="الكل" ' +
          'oninput="scInp(\'' + k + '\',this,' + mn + ',' + mx + ')" ' +
        'onchange="scNum(\'' + k + '\',this.value,' + mn + ',' + mx + ')"></label>';
      }).join('');
    }
    return '<div class="sv-advp">' + body +
      '<div class="sv-advf">' +
      '<button class="sv-rst" onclick="scReset()">🔄 مسح الكل</button>' +
      (advCount() ? '<span>' + advCount() + ' فلتر مُفعّل</span>' : '<span>مفيش فلاتر مفعّلة</span>') +
      '</div></div>';
  }

  function advCount() {
    return Object.keys(S).filter(function (k) {
      return ['peMax', 'peMin', 'pbMax', 'roeMin', 'roaMin', 'roicMin', 'nmMin', 'omMin',
        'gmMin', 'deMax', 'crMin', 'qrMin', 'dyMin', 'payoutMax', 'rsiMin', 'rsiMax',
        'p1wMin', 'p1mMin', 'p3mMin', 'p6mMin', 'p1yMin', 'pYtdMin',
        'volMin', 'mcMin', 'valMin', 'ma200', 'macd', 'tv',
        'oScoreMin', 'oConfMin', 'oMddMax', 'oVolMax', 'oSharpeMin', 'oCagrMin',
        'oRoicMin', 'oFcfMin', 'oVerdict'].indexOf(k) >= 0 && S[k] != null;
    }).length;
  }

  /* ══════════════ كارت المعايير ══════════════ */
  /* ══════════════════════════════════════════════════════════════
     📖 كارت الشرح — 4 مستويات + مقارنة TV vs OCTA
     ══════════════════════════════════════════════════════════════ */
  const LVL = [
    { id: 'start', n: '🌱 مبتدئ', d: 'أول مرة تستخدم الفلتر' },
    { id: 'mid',   n: '🔧 متوسط', d: 'فهمت الأساسيات' },
    { id: 'pro',   n: '🎯 خبير',  d: 'بتحلل بعمق' },
    { id: 'inst',  n: '🏛️ محترف', d: 'مح Portfolio Manager' }
  ];

  function aboutBox() {
    const lv = S.lvl || 'start';
    return '<div class="sv-about' + (S.aboutOpen ? ' open' : '') + '">' +
      '<div class="sv-about-h" onclick="scAbout()">' +
        '<span>❓ كل الفلاتر دي بتعمل إيه؟</span><b>' + (S.aboutOpen ? '▲' : '▼') + '</b>' +
      '</div>' +
      (S.aboutOpen ? '<div class="sv-about-b">' +

        /* ── المقارنة الكبرى ── */
        '<div class="sv-diff">' +
          '<div class="sv-dc">' +
            '<div class="sv-dh">📊 فلاتر TradingView</div>' +
            '<div class="sv-db">المصدر: <b>بيانات TradingView المباشرة</b></div>' +
            '<ul class="sv-dl">' +
              '<li><b>متشygloal</b> — نفس أرقام TradingView اللي بتشوفها عندهم في الموقع</li>' +
              '<li><b>محايد</b> — مش بياخد رأينا، بيقول الأرقام بس</li>' +
              '<li><b>مناسب للبحث السريع</b> — بتشوف السوق زي ما هو</li>' +
            '</ul>' +
          '</div>' +
          '<div class="sv-dc sv-dc-octa">' +
            '<div class="sv-dh">🐙 فلاتر OCTA</div>' +
            '<div class="sv-db">المصدر: <b>محرك التحليل بتاعنا</b> (بيانات 26 سنة)</div>' +
            '<ul class="sv-dl">' +
              '<li><b>رأي محسوب</b> — بيجمع 40+ مؤشر في رقم واحد من 100</li>' +
              '<li><b>عربي خالص</b> — مبني على الشروط الحقيقية لسوق مصر</li>' +
              '<li><b>مناسب للاختيار</b> — بيقولك إيه اللي يستحق انتباهك</li>' +
            '</ul>' +
          '</div>' +
        '</div>' +

        /* ── مستويات الشرح ── */
        '<div class="sv-lvls">' + LVL.map(l =>
          '<button class="sv-lvl' + (lv === l.id ? ' on' : '') +
          '" onclick="scLvl(\'' + l.id + '\')" title="' + esc(l.d) + '">' + l.n + '</button>'
        ).join('') + '</div>' +

        lvlBody(lv) +

      '</div>' : '') +
    '</div>';
  }

  /* ── محتوى كل مستوى ── */
  function lvlBody(lv) {
    if (lv === 'start') return `
      <div class="sv-ab-sec">
        <div class="sv-ab-t">🌱 لو أول مرة — ده أهم حاجة تفهمها</div>
        <div class="sv-ex">
          <div class="sv-exq">P/E يعني إيه؟</div>
          <div class="sv-exa">تخيّل إنك بتدفع 100 جنيه على سهم، والشركة بتوزّع <b>10 جنيه</b> أرباح
          في السنة. الـP/E هنا = <b>10</b>.
          يعني لو كل ده استمر، <b>10 سنين</b> ترجع فلوسك.
          <br><b>رقم أقل = أرخص.</b> تحت 12 = كويس · فوق 40 = غالي.</div>
        </div>
        <div class="sv-ex">
          <div class="sv-exq">ROE يعني إيه؟</div>
          <div class="sv-exa">الشركة بتستثمر <b>100 جنيه</b> من فلوس المساهمين (حقوق الملكية)
          وبتعمل منهم <b>20 جنيه ربح</b>؟ الـROE = <b>20%</b>.
          <br><b>رقم أعلى = الشركة بتعرف تستثمر فلوسك كويس.</b> فوق 15% = ممتاز.</div>
        </div>
        <div class="sv-ex">
          <div class="sv-exq">ليه Dividend (العائد) مهم؟</div>
          <div class="sv-exa">كل شركة بتنقسم أرباحها على shareholders وتديهم لك <b>نقد كل شهر أو سنة</b>.
          العائد 5% = لو سهمك بـ100، هتاخد <b>5 جنيه كل سنة</b> من غير ما تبيع.
          <br>⚠️ ده مش مضمون — الشركة ممكن توقف التوزيع.</div>
        </div>
        <div class="sv-ex">
          <div class="sv-exq">أعلى هبوط (MDD) يعني إيه؟</div>
          <div class="sv-exa">أكبر مرة السهم نزل فيها من أعلى سعر.
          لو نزل <b>40%</b>، معاك لازم تتحمّل إنك تخسر 40% لو اشتريت في الغلط.
          <br>تحت 25% = آمن · فوق 60% = خطر.</div>
        </div>
        <div class="sv-tip">
          💡 <b>القاعدة السهلة:</b> ابدأ بـ <b>ROE &gt; 15%</b> + <b>P/E &lt; 20</b> +
          <b>عائد &gt; 3%</b> + <b>هبوط &lt; 40%</b> — دي هتلاقي أسهم كويسة.
        </div>`;

    if (lv === 'mid') return `
      <div class="sv-ab-sec">
        <div class="sv-ab-t">🔧 الأساسيات اللي محتاجها</div>
        <div class="sv-grid">
          gl('P/B — السعر ÷ القيمة الدفترية', 'البنك بـ 5 جنيه وده يعني كل جنيه فيه بـ 5. ده غالي مقارنة بمجردانه. نفس الـP/E بس أشمل للبنوك.')
          gl('D/E — الدين ÷ حقوق المساهمين', 'الشركة استلفت 50 جنيه وحق المساهمين 50 → النسبة 1. فوق 1 = دين أكتر.')
          gl('Current Ratio', 'معاك 100 جنيه كاش ودين 80 → النسبة 1.25. فوق 1 = الشركة تقدر تفي.')
          gl('ROIC — العائد على رأس المال', 'زي ROE بس أدق — بيقيس الشغل نفسه مش الدين.')
          gl('RSI', 'من 0 لـ100. فوق 70 = السهم غالي أوي. تحت 30 = نازل أوي.')
          gl('تقييم OCTA', 'رقم من 100 بيجمع الجودة + القيمة + الزخم + النمو − مخاطرة. فوق 70 = ممتاز.')
        </div>
      </div>
      <div class="sv-ab-sec">
        <div class="sv-ab-t">🎯 أوتوماتيك: تقييم OCTA vs تقييم TradingView</div>
        <div class="sv-ex">
          <div class="sv-exq">ليه قيمتين مختلفين؟</div>
          <div class="sv-exa">
            <b>TradingView</b> بيحسب من مؤشرات فنية بس (RSI · MACD · المتوسطات) — يعني
            بيقولك السهم <i>غالي دلوقتي ولا لأ</i>.
            <br><br>
            <b>OCTA</b> بيحسب من <b>الأساسيات</b> (ROE · الدين · الأرباح) +
            <b>تاريخ 26 سنة</b> (شارب · CAGR · أقصى هبوط) + البيانات الحالية.
            يعني بيقولك السهم <i>يستثمر فلوسك كويس ولا لأ</i>.
            <br><br>
            <b>ممكن سهم يكون TradingView يقول "بيع" و OCTA يقول "تجميع"</b> — وده بيحصل
            لما السعر يكون نزل كتير بس الشركة نفسها كويسة. ده <b>فرصة</b> مش تناقض.
          </div>
        </div>
      </div>`;

    if (lv === 'pro') return `
      <div class="sv-ab-sec">
        <div class="sv-ab-t">🎯 المستوى الخبير — تعمّق في المؤشرات</div>
        <div class="sv-grid">
          gl('Forward P/E', 'التقييم على ربح السنة الجاية بدل آخر سنة. أقل = الشركة بتكبر')
          gl('هامش صافي / تشغيلي', 'من كل 100 جنيه دخل، كام فاضل صافي؟ 20%+ = شركة قوية')
          gl('Quick Ratio', 'السيولة بدون المخزون — أسرع')
          gl('CAGR 3 سنين', 'نمو سنوي مركّب خلال 3 سنين. فوق 15% = نمو حقيقي')
          gl('شارب (Sharpe)', 'العائد ÷ المخاطرة. فوق 1 = ممتاز · تحت 0 = أسوأ من الودائع')
          gl('Beta', 'حساسية السوق. فوق 1.2 = بيتحرك أكتر من السوق')
          gl('Payout Ratio', 'نسبة الأرباح المتوزعة. فوق 100% = بتصرف أكتر ما بتكسب (خطر)')
          gl('Volatility', 'التذبذب اليومي. تحت 2% = هادي · فوق 4% = متقلب')
        </div>
      </div>
      <div class="sv-ab-sec">
        <div class="sv-ab-t">⚡ إشارات فنية في فلتر TradingView</div>
        <div class="sv-grid">
          gl('فوق/تحت SMA200', 'SMA200 = متوسط آخر 200 يوم. فوقه = اتجاه صاعد طويل المدى')
          gl('MACD فوق/تحت الإشارة', 'تقاطع = إشارة تغيير اتجاه · بيع مبكر وخطير')
          gl('الشهر 1/3/6', 'أداء السهم بالأسابيع والأشهر — بيديك الصورة القريبة')
          gl('التوصية الفنية', 'من 26 مؤشر فني في TradingView')
        </div>
      </div>`;

    if (lv === 'inst') return `
      <div class="sv-ab-sec">
        <div class="sv-ab-t">🏛️ المستوى المحترف — بناء سلة</div>
        <div class="sv-ex">
          <div class="sv-exq">إزاي OCTA بيحسب التقييم؟</div>
          <div class="sv-exa">
            <div class="sv-plain"><b>الفكرة ببساطة:</b> كل سهم بيتقيّم من 100 نقطة.
            الشركة القوية النشطة الرخيصة بتاخد نقاط عالية، والضعيفة أو الغالية أو الخطيرة بتاخد نقاط قليلة.</div>
            <br>
            <b>① الجودة — 40 نقطة (أهم حاجة)</b>
            <span class="sv-q">السهم بياخد 40 نقطة بس لو الشركة فعلاً كويسة.</span>
            <br>لازم <b>3 من 6</b> حاجات دول تكون موجودة:
            <br>· <b>مربحة</b> (بتكسب فلوس حقيقية)
            <br>· <b>مش مدينة</b> (دين قليل)
            <br>· <b>بيتباع كتير</b> (سيولة عالية)
            <br>· <b>بيشتغل بفلوسه</b> (كاش في الشركة)
            <br>· <b>بيجيب ربح لكل سهم</b>
            <br>· <b>أعلى ربح في السوق</b>
            <br>
            <b>② القيمة — 25 نقطة</b>
            <span class="sv-q">السهم الغالي مبياخدش نقاط. الرخيص = نقاط أعلى.</span>
            <br>· <b>السعر مقابل الربح</b> لو أقل من 15 = غالي كثير
            <br>· <b>البنوك</b> بنقيسها بطريقة تانية (البنك مش غالي بل Rembrandt بيخسر)
            <br>
            <b>③ الزخم — 20 نقطة</b>
            <span class="sv-q">السهم طالع ولا نازل؟ الطالع = نقاط أعلى.</span>
            <br>· <b>القوة الحالية</b> في مكان طبيعي (40-65)، مش متفقط ومش هابط
            <br>· <b>فوق متوسطه السنوي</b> = اتجاه صاعد
            <br>· <b>زخم إيجابي</b> = القوة بتيجي
            <br>
            <b>④ النمو — 15 نقطة</b>
            <span class="sv-q">الشركة بتكبر ولا واقفة؟</span>
            <br>· الأرباح بتزيد
            <br>· المبيعات بتزيد
            <br>· نمو ثابت 3 سنين
            <br>
            <b>⑤ عقوبة المخاطرة — بخصم نقاط</b>
            <span class="sv-q">الأسهم الخطير بيخسر نقاط، مهما كان باقي).</span>
            <br>· سهم كان بينزل 70% = خصم كبير
            <br>· سهم بيتذبذب كل يوم = خصم كبير
            <br>
            <div class="sv-ex-sum">
            <b>مثال:</b> سهم جودته ممتازة (40) بس بينزل 60% ويonybezelاب كل يوم
            ← هيفقد نقاط المخاطرة ويبقى تقييمه 55 مش 75.
            </div>
          </div>
        </div>
      </div>
      <div class="sv-ab-sec">
        <div class="sv-ab-t">📊 مؤشرات تاريخية — من 4996 شمعة لكل سهم</div>
        <div class="sv-grid">
          gl('شارب 3 سنين', 'الربح الزائد فوق الودائع ÷ المخاطرة. > 1 = يستحق')
          gl('Sortino', 'زي شارب بس بيقيس المخاطرة السالبة فقط — أدق')
          gl('أقصى هبوط تاريخي', 'أكبر نزول من 2000 لليوم. > 90% = خسر ن من فلوسه مرتين')
          gl('CAGR 3 سنين', 'النمو السنوي المركب — أقرب لقياس ربحية السهم')
          gl('من أعلى 52 أسبوع', 'كم بعيد عن القمة — 0% = على القمة بالظبط · -50% = نصفي')
          gl('أرأس مال حر (Float)', 'حجم الأسهم اللي بيتداول فعلاً — كل ما قل، السعر أسرع')
        </div>
      </div>
      <div class="sv-ab-sec">
        <div class="sv-ab-t">⚠️ حدود OCTA — لازم تعرفها</div>
        <div class="sv-warn">
          ⚠️ التقييم <b>مش نصيحة استثمارية</b> — هو ترتيب نسبي مش وعد بالربح.
          <br>⚠️ <b>البنوك</b> محتاجة معايير مختلفة — الـROE بتاعهم عادي لأنه شغلهم إيداع.
          <br>⚠️ <b>الأسهم بدون بيانات</b> (ما عندهاش بيانات كافية) بتاخد صفر.
          <br>⚠️ <b>كل الأرقام</b> من TradingView + startamarkets — في تأخير يوم أو يومين.
        </div>
      </div>`;
    return '';
  }

  const gl = (t, d) =>
    '<div class="sv-g"><b>' + esc(t) + '</b><span>' + esc(d) + '</span></div>';

  const abR = (a, b) => '<div class="sv-ab-r"><b>' + esc(a) + '</b><span>' + esc(b) + '</span></div>';

  /* ══════════════ الجدول ══════════════ */
  const COLS = [
    { k: 'code', t: 'الرمز', cls: 'c' },
    { k: 'price', t: 'السعر', cls: 'n' },
    { k: 'chg', t: 'التغير %', cls: 'n' },
    { k: 'tv', t: 'التوصية', cls: 'tv' },
    { k: 'pe', t: 'P/E', cls: 'n' },
    { k: 'pb', t: 'P/B', cls: 'n' },
    { k: 'eps', t: 'EPS', cls: 'n' },
    { k: 'roe', t: 'ROE', cls: 'n' },
    { k: 'roe', t: 'ROA', cls: 'n', k2: 'roa' },
    { k: 'de', t: 'D/E', cls: 'n' },
    { k: 'dy', t: 'عائد', cls: 'n' },
    { k: 'rsi', t: 'RSI', cls: 'n' },
    { k: 'vol', t: 'تذبذب', cls: 'n' },
    { k: 'p1m', t: '1M', cls: 'n' },
    { k: 'p3m', t: '3M', cls: 'n' },
    { k: 'p1y', t: '1Y', cls: 'n' },
    { k: 'vol', t: 'الحجم', cls: 'n', k2: 'volume' },
    { k: 'mc', t: 'القيمة السوقية', cls: 'n' },
    { k: 'employees', t: 'موظفين', cls: 'n' },
    { k: 'sector', t: 'القسم', cls: 'sn' },
    { k: 'act', t: '', cls: 'c' }
  ];

  /* أعمدة OCTA */
  const COLS_O = [
    { k: 'code', t: 'الرمز', cls: 'c' },
    { k: 'price', t: 'السعر', cls: 'n' },
    { k: 'chg', t: 'التغير %', cls: 'n' },
    { k: 'score', t: 'تقييم OCTA', cls: 'n' },
    { k: 'verdict', t: 'القرار', cls: 'tv' },
    { k: 'conf', t: 'الثقة', cls: 'n' },
    { k: 'roe', t: 'ROE', cls: 'n' },
    { k: 'roic', t: 'ROIC', cls: 'n' },
    { k: 'pe', t: 'P/E', cls: 'n' },
    { k: 'de', t: 'D/E', cls: 'n' },
    { k: 'dy', t: 'عائد', cls: 'n' },
    { k: 'mdd', t: 'هبوط سنة %', cls: 'n' },
    { k: 'vol', t: 'تذبذب %', cls: 'n', k2: 'vol1y' },
    { k: 'sharpe', t: 'شارب', cls: 'n', k2: 'sharpe3y' },
    { k: 'cagr', t: 'CAGR 3س %', cls: 'n', k2: 'cagr3y' },
    { k: 'p1y', t: 'أداء سنة', cls: 'n' },
    { k: 'sector', t: 'القسم', cls: 'sn' },
    { k: 'act', t: '', cls: 'c' }
  ];

  function tbl(rows) {
    const cols = (S.mode === 'octa') ? COLS_O : COLS;
    return '<div class="sv-wrap"><table class="sv-tbl"><thead><tr>' +
      cols.map(function (c) {
        const sk = c.k2 || c.k;
        const sortable = c.k !== 'act';
        return '<th class="' + c.cls + '"' + (sortable ?
          ' onclick="scSort(\'' + sk + '\')" style="cursor:pointer"' : '') + '>' + c.t +
          (S.sort === sk ? '<i class="sv-ar">' + (S.dir < 0 ? '▼' : '▲') + '</i>' : '') + '</th>';
      }).join('') + '</tr></thead><tbody>' +
      rows.map(row).join('') + '</tbody></table></div>';
  }

  function rowO(s) {
    const px = N(s.price) || 0;
    const ch = N(s.change);
    const dcls = ch > 0 ? 'up' : ch < 0 ? 'dn' : '';
    const nm = s.name || '';
    const verdict = s.verdict || '—';
    const vcls = verdict === 'تجميع' ? 'dg' : verdict === 'بيع' ? 'db' :
      verdict === 'احتفظ' ? 'dk' : 'na';
    const sc = N(s.total) || 0;
    const scC = sc >= 70 ? 'gg' : sc >= 50 ? 'gm' : 'ym';
    const cP = function (v, g, b) { return v == null ? 'na' : v >= g ? 'gg' : v <= b ? 'rm' : 'ym'; };

    return '<tr class="sv-tr">' +
      '<td class="c sv-idw">' +
        '<button class="sv-id" onclick="event.stopPropagation();openChart(\'' + s.code + '\',\'' + esc(nm) + '\',\'' + window.__scMarket + '\',\'' + (s.tvSymbol || '') + '\')" title="افتح الشارت">' +
        logoHTML(s.code) +
        '<span class="sv-txt"><b>' + esc(s.code) + '</b>' + (nm ? '<i>' + esc(nm) + '</i>' : '') + '</span>' +
        '</button></td>' +
      '<td class="n"><b>' + f2(px) + '</b> <i class="sv-cur">' + M.cur + '</i></td>' +
      '<td class="n ' + dcls + '">' + (sg(ch) || '—') + '</td>' +
      '<td class="n"><span class="sv-badge ' + scC + '">' + f0(sc) + '</span></td>' +
      '<td class="tv"><span class="sv-tv ' + vcls + '">' + esc(verdict) + '</span></td>' +
      '<td class="n ' + (s.conf == null ? 'na' : s.conf >= 70 ? 'gg' : s.conf >= 50 ? 'ym' : 'rm') + '">' +
        (s.conf != null ? f0(s.conf) + '%' : '—') + '</td>' +
      '<td class="n ' + cP(s.roe, 20, 5) + '">' + (s.roe != null ? f0(s.roe) + '%' : '—') + '</td>' +
      '<td class="n ' + cP(s.roic, 15, 5) + '">' + (s.roic != null ? f0(s.roic) + '%' : '—') + '</td>' +
      '<td class="n ' + cP(s.pe, 12, 0) + '">' + (s.pe && s.pe > 0 ? f1(s.pe) : '—') + '</td>' +
      '<td class="n ' + cP(s.de, 50, 100) + '">' + (s.de != null ? f0(s.de) : '—') + '</td>' +
      '<td class="n ' + cP(s.dy, 5, 0) + '">' + (s.dy != null ? f2(s.dy) + '%' : '—') + '</td>' +
      '<td class="n ' + cP(s.mdd1y, 0, 25) + '">' + (s.mdd1y != null ? f0(s.mdd1y) + '%' : '—') + '</td>' +
      '<td class="n ' + cP(s.vol1y, 0, 44) + '">' + (s.vol1y != null ? f0(s.vol1y) + '%' : '—') + '</td>' +
      '<td class="n ' + cP(s.sharpe3y, 1, 0) + '">' + (s.sharpe3y != null ? f2(s.sharpe3y) : '—') + '</td>' +
      '<td class="n ' + cP(s.cagr3y, 15, 0) + '">' + (s.cagr3y != null ? f0(s.cagr3y) + '%' : '—') + '</td>' +
      '<td class="n ' + dirCls(s.p1y) + '">' + (sg(s.p1y) || '—') + '</td>' +
      '<td class="sn">' + esc(sectorAr(s)) + '</td>' +
      '<td class="c"><button class="sv-bell" onclick="event.stopPropagation();watchEdit(\'' + s.code + '\')">🔔</button></td>' +
      '</tr>';
  }

  function row(s) {
    if (S.mode === 'octa') return rowO(s);
    const px = N(s.price) || 0;
    const ch = N(s.change);
    const tv = tvVerdict(s);
    const dcls = ch > 0 ? 'up' : ch < 0 ? 'dn' : '';
    const nm = s.name || '';

    const cP = (v, g, b) => v == null ? 'na' : v >= g ? 'gg' : v <= b ? 'rm' : 'ym';
    const peC = cP(s.pe, 12, 0);
    const pbC = cP(s.pb, 2, 0);
    const epsC = cP(s.eps, 3, 0);
    const roeC = cP(s.roe, 20, 5);
    const roaC = cP(s.roa, 10, 0);
    const deC = s.de == null ? 'na' : s.de <= 50 ? 'gg' : s.de <= 150 ? 'ym' : 'rm';
    const dyC = cP(s.dy, 5, 0);
    const rsiC = s.rsi == null ? 'na' : s.rsi > 70 ? 'rm' : s.rsi > 60 ? 'ym' : s.rsi > 40 ? 'gm' : s.rsi > 30 ? 'gm' : 'gg';
    const volC = s.volD == null ? 'na' : s.volD < 1.5 ? 'gg' : s.volD < 3 ? 'gm' : s.volD < 5 ? 'ym' : 'rm';

    return '<tr class="sv-tr">' +
      '<td class="c sv-idw">' +
        '<button class="sv-id" onclick="event.stopPropagation();openChart(\'' + s.code + '\',\'' + esc(nm) + '\',\'' + window.__scMarket + '\',\'' + (s.tvSymbol || '') + '\')" title="افتح الشارت">' +
        logoHTML(s.code) +
        '<span class="sv-txt"><b>' + esc(s.code) + '</b>' + (nm ? '<i>' + esc(nm) + '</i>' : '') + '</span>' +
        '</button>' +
      '</td>' +
      '<td class="n"><b>' + f2(px) + '</b> <i class="sv-cur">' + M.cur + '</i></td>' +
      '<td class="n ' + dcls + '">' + (sg(ch) || '—') + '</td>' +
      '<td class="tv"><span class="sv-tv ' + tv.cls + '">' + esc(tv.t) + '</span></td>' +
      '<td class="n ' + peC + '">' + (s.pe && s.pe > 0 ? f1(s.pe) : '—') + '</td>' +
      '<td class="n ' + pbC + '">' + (s.pb && s.pb > 0 ? f2(s.pb) : '—') + '</td>' +
      '<td class="n ' + epsC + '">' + (f2(s.eps) || '—') + '</td>' +
      '<td class="n ' + roeC + '">' + (s.roe != null ? f0(s.roe) + '%' : '—') + '</td>' +
      '<td class="n ' + roaC + '">' + (s.roa != null ? f0(s.roa) + '%' : '—') + '</td>' +
      '<td class="n ' + deC + '">' + (s.de != null ? f0(s.de) : '—') + '</td>' +
      '<td class="n ' + dyC + '">' + (s.dy != null ? f2(s.dy) + '%' : '—') + '</td>' +
      '<td class="n ' + rsiC + '">' + (f0(s.rsi) != null ? f0(s.rsi) : '—') + '</td>' +
      '<td class="n ' + volC + '">' + (s.volD != null ? f2(s.volD) : '—') + '</td>' +
      '<td class="n ' + dirCls(s.p1m) + '">' + (sg(s.p1m) || '—') + '</td>' +
      '<td class="n ' + dirCls(s.p3m) + '">' + (sg(s.p3m) || '—') + '</td>' +
      '<td class="n ' + dirCls(s.p1y) + '">' + (sg(s.p1y) || '—') + '</td>' +
      '<td class="n">' + (big(s.volume) || '—') + '</td>' +
      '<td class="n">' + (big(s.mc) || '—') + '</td>' +
      '<td class="n">' + (big(s.employees) || '—') + '</td>' +
      '<td class="sn">' + esc(sectorAr(s)) + '</td>' +
      '<td class="c"><button class="sv-bell" onclick="event.stopPropagation();watchEdit(\'' + s.code + '\')">🔔</button></td>' +
      '</tr>';
  }

  /* ══════════════ API ══════════════ */
  window.scSetMarket = function (id) {
    const m = MARKS.find(x => x.id === id); if (m) M = m;
    window.__scMarket = M.id;          /* نمرّرها للشارت */
    S.shown = 40; render();
    S.live = false; S.lastQ = null; renderLiveDot(); tickLive();
  };
  window.scQInput = function (el) {
    const v = el.value, p = el.selectionStart;
    S.q = v; S.shown = 40; render();
    const n = document.getElementById('scQ');
    if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (e) { } }
  };
  window.scQ = v => { S.q = v || ''; S.shown = 40; render(); };
  window.scSect = v => { S.sect = v; S.shown = 40; render(); };
  window.scAdv = () => { S.advOpen = !S.advOpen; render(); };
  window.scAbout = () => { S.aboutOpen = !S.aboutOpen; render(); };
  window.scLvl = function (l) { S.lvl = l; render(); };
  window.scGrp = g => { S.grp = g; render(); };
  window.scGrpO = function (g) { S.grpO = g; render(); };
  window.scMode = function (m) {
    S.mode = m;
    S.shown = 40;
    if (m === 'octa' && S.grp === 'all') S.grp = 'qual';
    render();
  };
  window.scSel = (k, v) => { S[k] = v || null; S.shown = 40; render(); };
  /* إدخال رقم — بيحافظ على التركيز والـcursor مثل السيرش */
  window.scInp = function (k, el, mn, mx) {
    const pos = el.selectionStart;
    let v = el.value;
    /* لو المستخدم كاتب سالب في خانة من 0 — سيبه */
    let n = parseFloat(v);
    if (!isNaN(n)) { n = Math.max(mn, Math.min(mx, n)); }
    S[k] = isNaN(n) ? null : n;
    S.shown = 40;
    render();
    const again = document.getElementById('f_' + k);
    if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { } }
  };

  window.scNum = function (k, v, mn, mx) {
    const n = parseFloat(v);
    S[k] = isNaN(n) ? null : Math.max(mn, Math.min(mx, n));
    S.shown = 40; render();
  };
  window.scSort = function (k) {
    if (S.sort === k) { S.dir = -S.dir; }
    else {
      S.sort = k;
      /* الأرقام والتنصنيفات: أول ضغطة = تنازلي (الأعلى/الأقوى فوق)
         الأسماء: أول ضغطة = تصاعدي (أ-ي) */
      S.dir = (k === 'code' || k === 'name' || k === 'sector') ? 1 : -1;
    }
    render();
  };
  window.scMore = () => { S.shown += 40; render(); };
  window.scReset = function () {
    Object.keys(S).forEach(function (k) {
      if (k !== 'q' && k !== 'sect' && k !== 'sort' && k !== 'dir' &&
        k !== 'shown' && k !== 'advOpen' && k !== 'aboutOpen' &&
        k !== 'grp' && k !== 'grpO' && k !== 'mode' && k !== 'lvl') S[k] = null;
    });
    S.q = ''; S.sect = 'all'; S.shown = 40;
    render();
  };
  let MK_DONE = false;
  function loadMK(cb) {
    const d = mkData();
    if (MK_DONE && d && d[M.id] && d[M.id].length) { cb(); return; }
    const sc = document.createElement('script');
    sc.src = 'data/data_markets.js';
    sc.onload = function () { MK = null; mkData(); MK_DONE = true; cb(); };
    sc.onerror = function () { MK_DONE = true; cb(); };
    document.head.appendChild(sc);
  }

  window.scInit = function () {
    window.__scMarket = M.id;
    render();
    loadMK(function () { render(); startLive(); });
  };

  const orig = window.switchPage;
  if (typeof orig === 'function') {
    window.switchPage = function (id) {
      orig.apply(this, arguments);
      if (id === 'screener') setTimeout(window.scInit, 150);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.scInit);
  else setTimeout(window.scInit, 300);

})();