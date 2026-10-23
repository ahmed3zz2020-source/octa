/* ══════════════════════════════════════════════════════════════
   🛰️ OCTA Smart Money Radar — صفحة المسح
   ──────────────────────────────────────────────────────────────
   📌 الصفحة: داشبورد المسح + لوحة تحليل السهم.

   📌 البنية:
      1) الترويسة + حالة البيانات + العدادات
      2) شريط التحكم (بروفايل · بحث · قطاع · ترتيب · فلاتر)
      3) لوحة التقدّم (شغّال وقت المسح)
      4) النتائج (جدول على الديسكوب · كروت على الموبايل)
      5) لوحة السهم (٤ كروت + دليل ذكي + خطة + مخاطرة + شارت)
      6) الدليل التعليمي + التنويه

   ⛔ ممنوع: أي اسم أداة ذكاء اصطناعي في الكود أو التعليقات.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const R = window.OCTA_RADAR;
  const X = window.OCTA_RADAR_EXPLAIN;
  if (!R || !X) { console.warn('[radar] المحرك مش موجود'); return; }

  /* ══════════ الحالة ══════════ */
  const S = {
    universe: [],        /* [{code,name,sector}] */
    tech: {},            /* code → market_tech */
    quotes: {},          /* code → quotes row */
    results: [],         /* نتائج التحليل */
    byCode: {},
    candles: {},         /* code → شموع (للتفاصيل) */
    profile: 'balanced',
    sort: 'score', dir: -1,
    q: '', sector: 'all', cls: 'all',
    minLiq: 'all', minRR: 0, maxAtr: 0, minRvol: 0,
    showAll: false,
    money: { capital: 100000, riskPct: 1, maxAllocPct: 20 },
    scan: { running: false, total: 0, done: 0, failed: 0, steps: {}, err: null, lastRun: null },
    selected: null,
    started: false
  };

  const CHUNK = 40;   /* ⛔ ٤٠ كود × ٦ حروف = ٢٤٠ حرف < سقف التنظيف ٣٠٠ */

  /* ══════════ أدوات ══════════ */
  const $ = (id) => document.getElementById(id);
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(v, d) { return (v == null || !isFinite(v)) ? (d == null ? '—' : d) : v; }

  /* ⛔ تنسيق السعر حسب حجمه (زي محرك Smart Money) */
  function fmtPrice(v) {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v);
    const d = a >= 100 ? 2 : a >= 10 ? 2 : a >= 1 ? 3 : a >= 0.1 ? 4 : 5;
    return Number(v).toFixed(d);
  }
  function fmtNum(v) {
    if (v == null || !isFinite(v)) return '—';
    return Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  function fmtPct(v) {
    if (v == null || !isFinite(v)) return '—';
    return (v > 0 ? '+' : '') + Number(v).toFixed(1) + '%';
  }
  async function jget(path, ms) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), ms || 45000);
      const r = await fetch((window.OCTA_API || '') + path, { cache: 'no-store', signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }

  /* ══════════════════════════════════════════════════════════════
   📥 1) تحميل البيانات
   ══════════════════════════════════════════════════════════════ */

  /* 🌍 الكون — من /api/radar/universe (حيّ + عربي) */
  async function loadUniverse() {
    let u = await jget('/api/radar/universe', 30000);
    if (u && u.ok && u.stocks && u.stocks.length) {
      S.universe = u.stocks;
      S.scan.marketPhase = u.market_phase;
      S.scan.snapshot = u.snapshot_id;
      S.scan.dataTs = u.ts;
      return true;
    }
    /* ⛔ احتياطي: market_tech مفتوح + ملف المرجع المحلي */
    const mt = await jget('/api/market_tech?market=egypt', 30000);
    if (!mt || !mt.markets || !mt.markets.egypt) return false;
    const ref = window.OCTA_RADAR_REF || {};
    const nonEq = new Set(['EGS30AJ1C016-EGP', 'EGS65101C015', 'EGS65621C012', 'EGS65861C014', 'EGS72L31C011']);
    const isin = { 'EGS3I0S1C019': 'FCMD', 'EGS48271C018-EGP': 'ESAC', 'EGS370O1C013': 'NAPR', 'EGS3E071C013-EGP': 'ACRO', 'EGS659O1C015': 'IDSC' };
    S.universe = Object.keys(mt.markets.egypt)
      .filter(c => !nonEq.has(c))
      .map(c => {
        const code = isin[c] || c;
        const r = ref[code] || {};
        return { code: code, name: r.n || code, sector: r.s || 'غير مصنّف' };
      });
    S.scan.snapshot = mt.snapshot_id;
    S.scan.dataTs = mt.updated;
    return S.universe.length > 0;
  }

  /* 📊 المؤشرات الجماعية + الأسعار */
  async function loadBulk() {
    const mt = await jget('/api/market_tech?market=egypt', 30000);
    if (mt && mt.markets && mt.markets.egypt) {
      S.tech = mt.markets.egypt;
      S.scan.dataTs = S.scan.dataTs || mt.updated;
    }
    const q = await jget('/api/quotes', 30000);
    if (q && q.markets && q.markets.egypt) S.quotes = q.markets.egypt;
  }

  /* 📜 تاريخ مجموعة أكواد — دفعة واحدة من السيرفر */
  async function loadHistory(codes) {
    const list = codes.join(',');
    const d = await jget('/api/radar/history?list=' + encodeURIComponent(list) + '&n=320', 120000);
    if (!d || !d.ok || !d.codes) return { got: {}, failed: codes.slice() };
    return { got: d.codes || {}, failed: d.failed || [] };
  }

  /* ══════════════════════════════════════════════════════════════
   🔄 2) المسح
   ══════════════════════════════════════════════════════════════ */
  async function scan() {
    if (S.scan.running) return;
    S.scan.running = true; S.scan.done = 0; S.scan.failed = 0; S.scan.err = null;
    S.results = []; S.byCode = {}; S.candles = {};
    S.scan.steps = {};
    setStatus('busy', '⏳ بنجيب بيانات السوق…');
    renderProgress(true);

    try {
      if (!S.universe.length) {
        setStatus('busy', '⏳ بنجهّز الكون…');
        if (!await loadUniverse()) throw new Error('مفيش بيانات للسوق');
        renderStats();
      }
      S.scan.total = S.universe.length;
      renderProgress(true);

      /* المؤشرات الجماعية (سريعة) */
      setStatus('busy', '⏳ بنجيب المؤشرات الجماعية…');
      await loadBulk();
      S.scan.steps.bulk = 'ok';
      renderProgress(true);

      /* التاريخ — دفعات متتابعة (مش متوازية: عشان ما نضغطش على المصدر) */
      const codes = S.universe.map(u => u.code);
      for (let i = 0; i < codes.length; i += CHUNK) {
        const part = codes.slice(i, i + CHUNK);
        setStatus('busy', '⏳ بنجيب الشموع… ' + Math.min(i + CHUNK, codes.length) + ' من ' + codes.length);
        const r = await loadHistory(part);
        for (const k in r.got) S.candles[k] = r.got[k];
        S.scan.done += part.length - (r.failed || []).length;
        S.scan.failed += (r.failed || []).length;
        renderProgress(true);
      }
      S.scan.steps.history = 'ok';

      /* التحليل */
      setStatus('busy', '⏳ بنحلل…');
      const meta = { profile: S.profile, money: S.money };
      S.universe.forEach(u => {
        const c = S.candles[u.code];
        const tech = S.tech[u.code] || {};
        const q = S.quotes[u.code] || {};
        let a;
        try {
          a = R.analyze(c || [], {
            code: u.code, name: u.name, sector: u.sector,
            price: q.close != null ? q.close : tech.p,
            change: q.change, marketCap: tech.mc,
            rec: q['Recommend.All'], profile: meta.profile, money: meta.money
          });
        } catch (e) {
          a = R.analyze([], { code: u.code, name: u.name, sector: u.sector, profile: meta.profile });
        }
        S.results.push(a);
        S.byCode[u.code] = a;
      });
      S.scan.steps.analyze = 'ok';
      S.scan.lastRun = new Date().toISOString();

      setStatus('live', '✅ تم المسح — ' + S.scan.done + ' سهم محلّل' +
        (S.scan.failed ? ' · ' + S.scan.failed + ' تعذّر' : ''));
      renderAll();
    } catch (e) {
      S.scan.err = String(e && e.message || e);
      setStatus('err', '⛔ ' + S.scan.err);
    } finally {
      S.scan.running = false;
      renderProgress(false);
      renderStats();
    }
  }

  /* ══════════════════════════════════════════════════════════════
   🎨 3) العرض
   ══════════════════════════════════════════════════════════════ */
  function setStatus(kind, text) {
    const s = $('rdStatus');
    if (!s) return;
    s.innerHTML = '<span class="rd-dot ' + (kind || '') + '"></span> ' + esc(text);
  }

  function renderStats() {
    const res = S.results;
    const cnt = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    res.forEach(r => { cnt[r.classification.code] = (cnt[r.classification.code] || 0) + 1; });
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set('rdTotal', S.universe.length || '—');
    set('rdAnalyzed', res.length || '—');
    set('rdA', cnt.A || 0);
    set('rdB', cnt.B || 0);
    set('rdC', cnt.C || 0);
    set('rdE', cnt.E || 0);
    set('rdUpd', S.scan.dataTs ? String(S.scan.dataTs).slice(0, 16).replace('T', ' ') : '—');
  }

  function renderProgress(show) {
    const p = $('rdProgress');
    if (!p) return;
    if (!show) { p.style.display = 'none'; return; }
    p.style.display = '';
    const total = S.scan.total || S.universe.length || 1;
    const pct = Math.round(Math.min(100, (S.scan.done / total) * 100));
    const st = S.scan.steps;
    const step = (n, label, key) => {
      const s = st[key] || '';
      return '<div class="rd-step ' + (s || '') + '"><i class="n">' + n + '</i>' + esc(label) + '</div>';
    };
    p.innerHTML =
      '<h4>⏳ جاري فحص السوق — ' + S.scan.done + ' من ' + total + ' سهمًا</h4>' +
      '<div class="rd-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="rd-steps">' +
      step(1, 'بيانات السوق', 'bulk') +
      step(2, 'الشموع اليومية', 'history') +
      step(3, 'التحليل', 'analyze') +
      step(4, 'التصنيف', 'analyze') +
      '</div>';
  }

  /* 🔎 الفلترة */
  function filtered() {
    const liqRank = { DEEP: 5, LIQUID: 4, MODERATE: 3, THIN: 2, ILLIQUID: 1 };
    let out = S.results.slice();
    if (S.q) {
      const q = S.q.toUpperCase();
      out = out.filter(r => (r.code || '').toUpperCase().indexOf(q) >= 0 ||
        (r.name || '').indexOf(S.q) >= 0);
    }
    if (S.sector !== 'all') out = out.filter(r => r.sector === S.sector);
    if (S.cls !== 'all') out = out.filter(r => r.classification.code === S.cls);
    if (S.minLiq !== 'all') {
      out = out.filter(r => r.volume.liq && r.volume.liq !== 'NONE' &&
        (liqRank[r.volume.liq] || 0) >= (liqRank[S.minLiq] || 0));
    }
    if (S.minRR > 0) out = out.filter(r => r.plan.rr != null && r.plan.rr >= S.minRR);
    if (S.maxAtr > 0) out = out.filter(r => r.volatility.atrPct != null && r.volatility.atrPct <= S.maxAtr);
    if (S.minRvol > 0) out = out.filter(r => r.volume.rvol != null && r.volume.rvol >= S.minRvol);
    if (!S.showAll) out = out.filter(r => r.classification.code !== 'E');

    const key = S.sort;
    out.sort((a, b) => {
      let x, y;
      if (key === 'score') { x = a.score.total; y = b.score.total; }
      else if (key === 'trend') { x = a.trend.score; y = b.trend.score; }
      else if (key === 'momentum') { x = a.momentum.score; y = b.momentum.score; }
      else if (key === 'volume') { x = a.volume.score; y = b.volume.score; }
      else if (key === 'volatility') { x = a.volatility.score; y = b.volatility.score; }
      else if (key === 'rvol') { x = a.volume.rvol; y = b.volume.rvol; }
      else if (key === 'rr') { x = a.plan.rr; y = b.plan.rr; }
      else if (key === 'liquidity') { x = liqRank[a.volume.liq] || 0; y = liqRank[b.volume.liq] || 0; }
      else if (key === 'risk') { x = a.risk.riskScore; y = b.risk.riskScore; }
      else if (key === 'change') { x = a.change; y = b.change; }
      else { x = a.price; y = b.price; }
      if (x == null) x = -Infinity;
      if (y == null) y = -Infinity;
      return (x - y) * S.dir;
    });
    return out;
  }

  function clsBadge(code) {
    const map = {
      A: ['a', 'مرشح قوي'], B: ['b', 'يحتاج تأكيد'], C: ['c', 'مخاطرة عالية'],
      D: ['d', 'مفيش إعداد'], E: ['e', 'بيانات ناقصة']
    };
    const m = map[code] || map.D;
    return '<span class="rd-badge ' + m[0] + '">' + m[1] + '</span>';
  }
  function stateCell(v) {
    if (v == null) return '<span class="rd-na">—</span>';
    const s = String(v);
    let c = '';
    if (/UPTREND|STRONG POSITIVE|POSITIVE MOMENTUM|HIGH VOLUME|DEEP|LIQUID|LOWER RELATIVE|POTENTIAL ENTRY/.test(s)) c = 'rd-up';
    else if (/DOWNTREND|STRONG NEGATIVE|NEGATIVE MOMENTUM|ILLIQUID|VERY HIGH|INVALIDATED/.test(s)) c = 'rd-dn';
    else if (/HIGH VOLATILITY|EXTREME|VERY HIGH RISK|THIN/.test(s)) c = 'rd-warn';
    else if (/INSUFFICIENT|NONE|UNAVAILABLE/.test(s)) c = 'rd-na';
    return '<span class="' + c + '">' + esc(X.tr('ar', s)) + '</span>';
  }

  function renderList() {
    const box = $('rdList');
    if (!box) return;
    const rows = filtered();
    $('rdCount') && ($('rdCount').textContent = rows.length);
    if (!rows.length) {
      box.innerHTML =
        '<div class="rd-empty"><h3>لم تظهر أسهم تطابق المعايير الحالية</h3>' +
        '<p>جرّب تخفيف فلتر أو تغيير البروفايل.</p>' +
        '<ul><li>وسّع الفلاتر (السيولة / التذبذب / نسبة العائد)</li>' +
        '<li>جرّب بروفايل «متوازن» بدل «محافظ»</li>' +
        '<li>اعمل «تحديث» للمسح من جديد</li></ul>' +
        '<button class="rd-chip" id="rdReset2" type="button">↺ تصفير الفلاتر</button></div>';
      const b = $('rdReset2');
      if (b) b.onclick = resetFilters;
      return;
    }
    /* الجدول (ديسكوب) */
    let html = '<div class="rd-row head"><span>السهم</span><span>السعر</span><span>الاتجاه</span>' +
      '<span>الزخم</span><span>الحجم</span><span>التذبذب</span><span>الدرجة</span><span>الحالة</span></div>';
    rows.forEach(r => {
      html += '<div class="rd-row" data-code="' + esc(r.code) + '" tabindex="0" role="button" ' +
        'aria-label="' + esc(r.name + ' — ' + X.tr('ar', r.classification.state)) + '">' +
        '<div class="rd-nm"><b>' + esc(r.name) + '</b><span class="rd-code">' + esc(r.code) +
        (r.sector ? ' · ' + esc(r.sector) : '') + '</span></div>' +
        '<div class="rd-cell"><b>' + fmtPrice(r.price) + '</b>' +
        (r.change != null ? ' <span class="' + (r.change >= 0 ? 'rd-up' : 'rd-dn') + '">' + fmtPct(r.change) + '</span>' : '') + '</div>' +
        '<div class="rd-cell">' + stateCell(r.trend.state) + '</div>' +
        '<div class="rd-cell">' + stateCell(r.momentum.state) + '</div>' +
        '<div class="rd-cell">' + stateCell(r.volume.state) + '</div>' +
        '<div class="rd-cell">' + stateCell(r.volatility.state) + '</div>' +
        '<div class="rd-cell"><b>' + (r.score.total == null ? '—' : r.score.total) + '</b></div>' +
        '<div>' + clsBadge(r.classification.code) + '</div>' +
        '</div>';
    });
    /* الكروت (موبايل) */
    let cards = '';
    rows.forEach(r => {
      cards += '<div class="rd-card" data-code="' + esc(r.code) + '" tabindex="0" role="button" ' +
        'aria-label="' + esc(r.name) + '">' +
        '<div class="top"><div class="rd-nm"><b>' + esc(r.name) + '</b>' +
        '<span class="rd-code">' + esc(r.code) + (r.sector ? ' · ' + esc(r.sector) : '') + '</span></div>' +
        '<div style="text-align:left">' + clsBadge(r.classification.code) +
        '<div style="margin-top:5px;font-size:15px;font-weight:800;color:var(--gold)">' +
        (r.score.total == null ? '—' : r.score.total) + '</div></div></div>' +
        '<div class="grid">' +
        '<div>السعر<b>' + fmtPrice(r.price) + '</b></div>' +
        '<div>الاتجاه<b>' + X.tr('ar', r.trend.state) + '</b></div>' +
        '<div>الزخم<b>' + X.tr('ar', r.momentum.state) + '</b></div>' +
        '<div>الحجم<b>' + X.tr('ar', r.volume.state) + '</b></div>' +
        '<div>التذبذب<b>' + X.tr('ar', r.volatility.state) + '</b></div>' +
        '<div>المخاطرة<b>' + X.tr('ar', r.risk.state) + '</b></div>' +
        '</div></div>';
    });
    box.innerHTML = html + '<div class="rd-cards">' + cards + '</div>';
    box.querySelectorAll('[data-code]').forEach(n => {
      n.addEventListener('click', () => openStock(n.getAttribute('data-code')));
      n.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStock(n.getAttribute('data-code')); }
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
   🔍 4) لوحة السهم
   ══════════════════════════════════════════════════════════════ */
  function openStock(code) {
    const a = S.byCode[code];
    if (!a) return;
    S.selected = code;
    const d = $('rdDetail');
    if (!d) return;
    d.style.display = '';
    d.innerHTML = detailHTML(a);
    bindDetail(a);
    d.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function tipBtn(key) {
    return '<button class="rd-tip" data-tip="' + esc(key) + '" type="button" ' +
      'aria-label="شرح المصطلح">؟</button>';
  }

  function detailHTML(a) {
    const card = X.card(a, 'ar');
    const se = X.scoreExplain(a, 'ar');
    const steps = X.steps(a, 'ar');
    const parts = (arr) => (arr || []).map(p =>
      '<div class="rd-part ' + (p.ok ? 'ok' : 'no') + '"><i>' + (p.ok ? '✓' : '✕') + '</i>' +
      '<span><b>' + esc(p.label) + '</b> — ' + esc(p.detail || '') +
      (p.v != null ? ' <b>' + fmtNum(p.v) + '</b>' : '') + '</span></div>').join('');

    /* ── كارت المؤشر ── */
    function indCard(title, key, st, score, kv, text, prt) {
      return '<div class="rd-indc"><h4>' + esc(title) + ' ' + tipBtn(key) + '</h4>' +
        '<div class="st">' + stateCell(st) + '</div>' +
        (score == null ? '<div class="sc">— <small>غير متاح</small></div>'
          : '<div class="sc">' + score + ' <small>/ 100</small></div>') +
        '<div class="rd-kv">' + (kv || '') + '</div>' +
        '<div class="rd-txt">' + esc(text || '') + '</div>' +
        (prt ? '<div class="rd-parts">' + parts(prt) + '</div>' : '') +
        '</div>';
    }

    const t = a.trend, m = a.momentum, v = a.volume, va = a.volatility, sm = a.smart;
    const indicators =
      '<div class="rd-ind">' +
      indCard('الاتجاه', 'trend', t.state, t.score,
        (t.ema20 != null ? '<span>EMA20 <b>' + fmtNum(t.ema20) + '</b></span>' : '') +
        (t.ema50 != null ? '<span>EMA50 <b>' + fmtNum(t.ema50) + '</b></span>' : '') +
        (t.ema200 != null ? '<span>EMA200 <b>' + fmtNum(t.ema200) + '</b></span>' : '') +
        (t.adx != null ? '<span>ADX <b>' + fmtNum(t.adx) + '</b></span>' : ''),
        X.trendText(a, 'ar'), t.parts) +
      indCard('الزخم', 'momentum', m.state, m.score,
        (m.rsi != null ? '<span>RSI <b>' + fmtNum(m.rsi) + '</b></span>' : '') +
        (m.macd != null ? '<span>MACD <b>' + fmtNum(m.macd) + '</b></span>' : '') +
        (m.signal != null ? '<span>الإشارة <b>' + fmtNum(m.signal) + '</b></span>' : ''),
        X.momentumText(a, 'ar'), m.parts) +
      indCard('حجم التداول', 'rvol', v.state, v.score,
        (v.rvol != null ? '<span>الحجم النسبي <b>' + fmtNum(v.rvol) + '×</b></span>' : '') +
        (v.turnover != null ? '<span>الدوران <b>' + fmtNum(v.turnover) + '%</b></span>' : '') +
        '<span>السيولة <b>' + X.tr('ar', v.liq) + '</b></span>',
        X.volumeText(a, 'ar'), v.parts) +
      indCard('التذبذب', 'atr', va.state, va.score,
        (va.atr != null ? '<span>ATR <b>' + fmtNum(va.atr) + '</b></span>' : '') +
        (va.atrPct != null ? '<span>ATR% <b>' + fmtNum(va.atrPct) + '</b></span>' : '') +
        (va.avgRange != null ? '<span>متوسط النطاق <b>' + fmtNum(va.avgRange) + '</b></span>' : ''),
        X.volatilityText(a, 'ar'), va.parts) +
      '</div>';

    /* ── الدليل الذكي ── */
    const smRows = (sm.components || []).map(c =>
      '<div class="rd-part ' + (c.score >= 60 ? 'ok' : 'no') + '"><i>' + (c.score >= 60 ? '✓' : '·') + '</i>' +
      '<span><b>' + esc(c.label) + '</b> — ' + esc(c.detail) +
      ' <span style="opacity:.7">(' + esc(c.src) + ' · ثقة ' + fmtNum(c.conf * 100) + '%)</span></span></div>'
    ).join('');
    const smart =
      '<div class="rd-cardbox"><h3>🕵️ نشاط التداول ' + tipBtn('smartMoney') +
      '<span class="sp">الدرجة: ' + (sm.score == null ? 'غير متاحة' : sm.score + ' / 100') +
      ' · الثقة: ' + X.tr('ar', sm.confidence) + '</span></h3>' +
      '<div class="rd-txt" style="margin-bottom:8px">' + esc(X.smartText(a, 'ar')) + '</div>' +
      '<div class="rd-parts">' + smRows + '</div>' +
      '<div class="rd-warn na">⛔ بيانات نشاط المؤسسات غير متاحة — ' +
      '«دليل النشاط الذكي» بيقيس الأدلة المتاحة من السعر والحجم وتوصية المحللين، ' +
      'مش بيوثّق إن المؤسسات هي اللي بتشتري.</div></div>';

    /* ── الخطة والمخاطرة ── */
    const p = a.plan, sz = a.sizing;
    const plan =
      '<div class="rd-cardbox"><h3>🎯 خطة الدخول وإدارة المخاطر ' + tipBtn('riskReward') +
      '<span class="sp">' + esc(X.tr('ar', p.status)) + '</span></h3>' +
      '<div class="rd-plan">' +
      '<div class="rd-pv"><span>السعر الحالي</span><b>' + fmtPrice(p.current) + '</b></div>' +
      '<div class="rd-pv entry"><span>الدخول</span><b>' + (p.entry == null ? '—' : fmtPrice(p.entry)) + '</b></div>' +
      '<div class="rd-pv stop"><span>الوقف</span><b>' + (p.stop == null ? '—' : fmtPrice(p.stop)) + '</b></div>' +
      '<div class="rd-pv tgt"><span>الهدف ١</span><b>' + (p.target1 == null ? '—' : fmtPrice(p.target1)) + '</b></div>' +
      '<div class="rd-pv tgt"><span>الهدف ٢</span><b>' + (p.target2 == null ? '—' : fmtPrice(p.target2)) + '</b></div>' +
      '<div class="rd-pv"><span>العائد/المخاطرة</span><b>' + (p.rr == null ? '—' : p.rr) + '</b></div>' +
      '<div class="rd-pv"><span>الكمية (افتراضي)</span><b>' + (sz.qty == null ? '—' : fmtNum(sz.qty)) + '</b></div>' +
      '<div class="rd-pv"><span>قيمة المركز</span><b>' + (sz.positionValue == null ? '—' : fmtNum(sz.positionValue)) + '</b></div>' +
      '</div>' +
      (p.confirm ? '<div class="rd-txt"><b>شرط التأكيد:</b> ' + esc(p.confirm) + '</div>' : '') +
      (p.notes && p.notes.length ? '<div class="rd-warns">' + p.notes.map(n =>
        '<div class="rd-warn">⚠️ ' + esc(n) + '</div>').join('') + '</div>' : '') +
      (a.risk.warnings.length ? '<div class="rd-warns">' + a.risk.warnings.map(w =>
        '<div class="rd-warn ' + (w.k === 'institutional_na' ? 'na' : '') + '">⚠️ ' + esc(w.msg) + '</div>').join('') + '</div>' : '') +
      '<div class="rd-txt" style="margin-top:9px">' + esc(X.planText(a, 'ar')) + '</div>' +
      '<div class="rd-txt" style="margin-top:6px;opacity:.85">⛔ كل المستويات افتراضية — ' +
      'مش أوامر. ⛔ تكاليف المعاملة غير مشمولة. ⛔ الكمية محسوبة على إعداداتك: ' +
      'رأس مال ' + fmtNum(S.money.capital) + ' · مخاطرة ' + S.money.riskPct + '% · ' +
      'سقف تخصيص ' + S.money.maxAllocPct + '%.</div>' +
      '</div>';

    /* ── البطاقة النهائية ── */
    const scoreRows = se.rows.map(r =>
      '<div class="rd-part ok"><i>•</i><span><b>' + esc(r.label) + '</b> = ' + r.value +
      ' <span style="opacity:.7">(وزن ' + r.weight + '%' +
      (r.baseWeight != null && Math.abs(r.weight - r.baseWeight) > 0.05 ? ' · بعد إعادة التوزيع من ' + r.baseWeight + '%' : '') +
      ')</span></span></div>').join('');
    const final =
      '<div class="rd-cardbox"><h3>🏁 الخلاصة التحليلية ' + tipBtn('classification') + '</h3>' +
      '<div class="rd-final"><h3>' + esc(card.title) + '</h3>' +
      '<p>' + esc(card.reason) + '</p>' +
      '<div class="st"><b>' + esc(se.label) + ':</b> ' + (se.total == null ? 'غير متاحة' : se.total + ' / 100') +
      ' · تغطية ' + se.completeness + '%' +
      (se.note ? ' · ' + esc(se.note) : '') + '</div>' +
      '<div class="rd-parts" style="margin-top:8px">' + scoreRows + '</div>' +
      (a.classification.missing.length ?
        '<ul>' + a.classification.missing.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul>' : '') +
      '</div></div>';

    /* ── الخطوات ── */
    const stepBox =
      '<div class="rd-cardbox"><h3>🔄 كيف الرادار بيحلل السهم؟</h3><div class="rd-steps">' +
      steps.map(s => '<div class="rd-step ' + s.status + '"><i class="n">' + s.n + '</i>' +
        '<span>' + esc(s.title) + ' — <b>' + esc(s.detail) + '</b></span></div>').join('') +
      '</div></div>';

    /* ── الشارت ── */
    const chart =
      '<div class="rd-cardbox"><h3>📈 أداء السهم' +
      '<span class="sp">' + (a.dataTimestamp ? 'آخر جلسة: ' + esc(a.dataTimestamp) : '') + '</span></h3>' +
      '<div id="rdChart" style="height:300px;direction:ltr"></div>' +
      '<div id="rdChartText" class="rd-txt" style="margin-top:8px"></div></div>';

    return '<div class="rd-cardbox"><h3>📊 ' + esc(a.name) + ' ' + tipBtn('trend') +
      '<span class="sp">' + esc(a.code) + (a.sector ? ' · ' + esc(a.sector) : '') +
      ' · ' + fmtPrice(a.price) + (a.change != null ? ' (' + fmtPct(a.change) + ')' : '') + '</span></h3>' +
      '<div class="rd-txt">💡 ' + esc(X.trendText(a, 'ar')) + ' · ' + esc(X.momentumText(a, 'ar')) +
      ' · ' + esc(X.volumeText(a, 'ar')) + '</div></div>' +
      indicators + smart + plan + final + chart + stepBox;
  }

  function bindDetail(a) {
    /* التلميحات */
    document.querySelectorAll('[data-tip]').forEach(b => {
      b.addEventListener('click', () => showTip(b.getAttribute('data-tip')));
    });
    /* الشارت */
    const c = S.candles[a.code];
    if (c && c.length) {
      const box = $('rdChart');
      const txt = $('rdChartText');
      if (txt) {
        txt.innerHTML = '📊 ' + c.length + ' شمعة يومية · آخر ' + esc(c[c.length - 1].t) +
          ' · الإغلاق ' + fmtPrice(c[c.length - 1].c) +
          ' · أعلى ' + fmtPrice(c[c.length - 1].h) + ' · أدنى ' + fmtPrice(c[c.length - 1].l) +
          ' · الحجم ' + fmtNum(c[c.length - 1].v);
      }
      mountChart(box, c, a);
    }
  }

  /* ══════════════════════════════════════════════════════════════
   📈 5) الشارت — lightweight-charts (بيتحمّل عند الطلب)
   ══════════════════════════════════════════════════════════════ */
  let chartLib = null;
  function loadChartLib() {
    if (chartLib) return Promise.resolve(chartLib);
    if (window.LightweightCharts) { chartLib = window.LightweightCharts; return Promise.resolve(chartLib); }
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'assets/js/vendor/lightweight-charts.standalone.production.js';
      s.onload = () => { chartLib = window.LightweightCharts; res(chartLib); };
      s.onerror = () => rej(new Error('chart lib failed'));
      document.head.appendChild(s);
    });
  }
  function mountChart(box, candles, a) {
    if (!box) return;
    loadChartLib().then(lib => {
      try {
        const chart = lib.createChart(box, {
          layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8b9eb0', fontSize: 10 },
          grid: { vertLines: { color: 'rgba(255,255,255,.05)' }, horzLines: { color: 'rgba(255,255,255,.05)' } },
          rightPriceScale: { borderColor: 'rgba(255,255,255,.12)' },
          timeScale: { borderColor: 'rgba(255,255,255,.12)', timeVisible: false },
          height: 300
        });
        const cs = chart.addSeries(lib.CandlestickSeries, {
          upColor: '#22c55e', downColor: '#ef4444',
          borderUpColor: '#22c55e', borderDownColor: '#ef4444',
          wickUpColor: '#22c55e', wickDownColor: '#ef4444'
        });
        cs.setData(candles.map(c => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c })));
        /* المتوسطات المتحركة */
        const closes = candles.map(c => c.c);
        function emaLine(len, color) {
          /* ⛔⛔ الإزاحة بتاعت EMA لازم تكون مظبوطة — لو غلطت
             candles[off+i] بيرجع undefined والشارت بيقع بالكامل.
             ⇒ العقد معرّف ومختبر في المحرك (R.emaAligned). */
          const data = R.emaAligned(closes, candles.map(c => c.t), len);
          if (!data || !data.length) return;
          const line = chart.addSeries(lib.LineSeries, { color: color, lineWidth: 1 });
          line.setData(data.map(d => ({ time: d.t, value: d.value })));
        }
        emaLine(20, '#d4af37'); emaLine(50, '#3b82f6'); emaLine(200, '#a855f7');
        /* الحجم */
        const vs = chart.addSeries(lib.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '' }, 1);
        vs.setData(candles.map(c => ({
          time: c.t, value: c.v,
          color: c.c >= c.o ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)'
        })));
        /* المستويات */
        const p = a.plan;
        if (p.entry) cs.createPriceLine({ price: p.entry, color: '#d4af37', lineWidth: 1, lineStyle: 2, title: 'دخول' });
        if (p.stop) cs.createPriceLine({ price: p.stop, color: '#ef4444', lineWidth: 1, lineStyle: 2, title: 'وقف' });
        if (p.target1) cs.createPriceLine({ price: p.target1, color: '#22c55e', lineWidth: 1, lineStyle: 2, title: 'هدف' });
        chart.timeScale().fitContent();
        window.addEventListener('resize', () => { try { chart.applyOptions({ width: box.clientWidth }); } catch (e) { } });
      } catch (e) {
        box.innerHTML = '<div class="rd-txt">⛔ تعذّر رسم الشارت — البيانات في النص تحت.</div>';
      }
    }).catch(() => {
      box.innerHTML = '<div class="rd-txt">⛔ مكتبة الشارت مش متاحة — البيانات في النص تحت.</div>';
    });
  }

  /* ══════════════════════════════════════════════════════════════
   💬 6) التلميحات التعليمية
   ══════════════════════════════════════════════════════════════ */
  function showTip(key) {
    const t = X.term(key, 'ar');
    if (!t) return;
    const bg = el('div', 'rd-modal-bg');
    bg.innerHTML = '<div class="rd-modal" role="dialog" aria-modal="true" aria-label="شرح">' +
      '<button class="x" type="button" aria-label="إغلاق">✕</button>' +
      '<h3>' + esc(key) + '</h3>' +
      '<h5>ما الذي يقيسه</h5><p>' + esc(t.what) + '</p>' +
      '<h5>لماذا يهمّك</h5><p>' + esc(t.why) + '</p>' +
      '<h5>كيف يستخدمه OCTA</h5><p>' + esc(t.how) + '</p>' +
      '<h5>ما الذي لا يعنيه</h5><p>' + esc(t.not) + '</p></div>';
    function close() { if (bg.parentNode) bg.parentNode.removeChild(bg); document.removeEventListener('keydown', esc2); }
    function esc2(e) { if (e.key === 'Escape') close(); }
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
    bg.querySelector('.x').addEventListener('click', close);
    document.addEventListener('keydown', esc2);
    document.body.appendChild(bg);
  }

  /* ══════════════════════════════════════════════════════════════
   🎛️ 7) التحكم
   ══════════════════════════════════════════════════════════════ */
  function resetFilters() {
    S.q = ''; S.sector = 'all'; S.cls = 'all';
    S.minLiq = 'all'; S.minRR = 0; S.maxAtr = 0; S.minRvol = 0; S.showAll = false;
    const q = $('rdQ'); if (q) q.value = '';
    ['rdSect', 'rdCls', 'rdLiq', 'rdRR', 'rdAtr', 'rdRvol'].forEach(id => {
      const e = $(id); if (e) e.value = e.tagName === 'SELECT' ? (id === 'rdSect' ? 'all' : id === 'rdCls' ? 'all' : id === 'rdLiq' ? 'all' : '0') : '0';
    });
    const sa = $('rdShowAll'); if (sa) sa.classList.remove('on');
    renderList();
  }

  function fillSectors() {
    const s = $('rdSect');
    if (!s) return;
    const set = {};
    S.universe.forEach(u => { if (u.sector) set[u.sector] = (set[u.sector] || 0) + 1; });
    const keys = Object.keys(set).sort();
    s.innerHTML = '<option value="all">كل القطاعات (' + S.universe.length + ')</option>' +
      keys.map(k => '<option value="' + esc(k) + '">' + esc(k) + ' (' + set[k] + ')</option>').join('');
  }

  function bindControls() {
    const q = $('rdQ');
    if (q) q.addEventListener('input', () => { S.q = q.value.trim(); renderList(); });
    const sect = $('rdSect');
    if (sect) sect.addEventListener('change', () => { S.sector = sect.value; renderList(); });
    const cls = $('rdCls');
    if (cls) cls.addEventListener('change', () => { S.cls = cls.value; renderList(); });
    const sort = $('rdSort');
    if (sort) sort.addEventListener('change', () => { S.sort = sort.value; renderList(); });
    const dir = $('rdDir');
    if (dir) dir.addEventListener('click', () => {
      S.dir = -S.dir; dir.textContent = S.dir < 0 ? '⬇' : '⬆'; renderList();
    });
    const prof = $('rdProfile');
    if (prof) prof.addEventListener('change', () => {
      S.profile = prof.value;
      const p = R.getProfile(prof.value);
      setStatus('busy', '⏳ بنعيد التحليل ببروفايل «' + p.name + '»…');
      reclassify();
    });
    const liq = $('rdLiq');
    if (liq) liq.addEventListener('change', () => { S.minLiq = liq.value; renderList(); });
    const rr = $('rdRR');
    if (rr) rr.addEventListener('change', () => { S.minRR = Number(rr.value) || 0; renderList(); });
    const atr = $('rdAtr');
    if (atr) atr.addEventListener('change', () => { S.maxAtr = Number(atr.value) || 0; renderList(); });
    const rv = $('rdRvol');
    if (rv) rv.addEventListener('change', () => { S.minRvol = Number(rv.value) || 0; renderList(); });
    const showAll = $('rdShowAll');
    if (showAll) showAll.addEventListener('click', () => {
      S.showAll = !S.showAll; showAll.classList.toggle('on', S.showAll); renderList();
    });
    const reset = $('rdReset');
    if (reset) reset.addEventListener('click', resetFilters);
    const scanB = $('rdScan');
    if (scanB) scanB.addEventListener('click', () => scan());
    const closeB = $('rdClose');
    if (closeB) closeB.addEventListener('click', () => {
      const d = $('rdDetail'); if (d) { d.style.display = 'none'; d.innerHTML = ''; }
      S.selected = null;
    });
  }

  /* ♻️ إعادة التصنيف بعد تغيير البروفايل (من غير إعادة جلب البيانات) */
  function reclassify() {
    S.results.forEach(a => {
      a.profile = R.getProfile(S.profile);
      a.score = R.compositeScore({
        trend: a.trend.score, momentum: a.momentum.score,
        volume: a.volume.score, risk: a.volatility.score
      }, a.profile, { total: R.COMPONENTS.length });
      a.classification = R.classify(a, a.profile);
    });
    renderAll();
    setStatus('live', '✅ تم المسح — ' + S.scan.done + ' سهم محلّل (بروفايل ' +
      R.getProfile(S.profile).name + ')');
  }

  function renderAll() {
    renderStats();
    renderList();
    if (S.selected && S.byCode[S.selected]) {
      const d = $('rdDetail');
      if (d) { d.style.display = ''; d.innerHTML = detailHTML(S.byCode[S.selected]); bindDetail(S.byCode[S.selected]); }
    }
  }

  /* ══════════════════════════════════════════════════════════════
   🚀 8) نقطة الدخول
   ══════════════════════════════════════════════════════════════ */
  window.radarInit = function () {
    if (S.started) { if (S.results.length) { renderAll(); } return; }
    S.started = true;
    bindControls();
    fillSectors();
    setStatus('busy', '⏳ بنجهّز بيانات السوق…');
    (async () => {
      const okU = await loadUniverse();
      if (!okU) {
        setStatus('err', '⛔ مفيش بيانات سوق — تأكد إن الاتصال شغال');
        const b = $('rdList');
        if (b) b.innerHTML = '<div class="rd-empty"><h3>⛔ مفيش بيانات السوق</h3>' +
          '<p>محتاجين الوصول لبيانات البورصة. جرّب «تحديث» أو ارجع بعد شوية.</p>' +
          '<button class="rd-chip" id="rdRetry" type="button">↻ إعادة المحاولة</button></div>';
        const rb = $('rdRetry');
        if (rb) rb.onclick = () => { S.started = false; radarInit(); };
        return;
      }
      fillSectors();
      renderStats();
      await scan();
    })();
  };

  /* ⛔ إتاحة الدالة للاختبارات */
  window.OCTA_RADAR_UI = {
    state: S, scan: scan, renderList: renderList, renderStats: renderStats,
    detailHTML: detailHTML, filtered: filtered, resetFilters: resetFilters
  };
})();
