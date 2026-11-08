/* ══════════════════════════════════════════════════════════════
  🌍 ماسح الأسواق غير المصرية — للفلتر
  ══════════════════════════════════════════════════════════════
  📌 ٩ نوفمبر ٢٠٢٦ — ليه الملف ده؟
  ⛔ المشكلة: الـAPI (/api/markets) بيرجّع مصر بس (٢٨٥ سهم) وباقي
     الأسواق بيرجّعوا فاضي ⇒ تبويبات «أمريكا / السعودية / الإمارات»
     في فلتر الأسهم كانت بتطلع «٠ من ٠» (مقيس بجلسة حقيقية).
  📌 الحل: نفس فكرة صفحة الأسواق (octa-app.js) — مسح TradingView
     من المتصفح ⇒ بيانات حية + نفس أسماء الحقول اللي الفلتر بيقراها.
  📌 ⛔ مفيش أرقام مخترعة: أي عمود مش موجود بيفضل فاضي (مش صفر).

  📌 الأسماء العربية: TradingView بيدي الاسم الإنجليزي بس ⇒ بنجيب
     الاسم العربي من خريطة أسماء صغيرة (data/market_names.js)
     بتتحمّل **لما المستخدم يختار سوق غير مصري** بس.
*/
(function () {
  'use strict';

  /* ⭐ أعمدة الماسح ⇐ أسماء حقول الفلتر */
  const COLS = [
    'close', 'change', 'change_abs', 'volume', 'relative_volume_10d_calc',
    'market_cap_basic', 'price_earnings_ttm', 'price_book_fq', 'RSI',
    'MACD.macd', 'MACD.signal', 'EMA20', 'EMA50', 'EMA200', 'ATR',
    'price_52_week_high', 'price_52_week_low', 'Perf.1M', 'Perf.3M', 'Perf.6M',
    'Perf.Y', 'Perf.YTD', 'Volatility.D', 'beta_1_year', 'fundamental_currency_code',
    'exchange', 'sector', 'industry', 'description', 'total_shares_outstanding',
    'Recommend.All', 'dividends_yield_current', 'average_volume_30d_calc',
    'earnings_per_share_diluted_ttm', 'net_income', 'debt_to_equity',
    'return_on_equity_fq', 'operating_margin', 'return_on_assets',
    'return_on_invested_capital', 'gross_margin', 'net_margin', 'current_ratio',
    'quick_ratio', 'total_revenue', 'ebitda', 'free_cash_flow', 'total_debt',
    'VWAP', 'price_target_median'
  ];

  /* ⭐ خريطة: عمود الماسح ⇐ حقل الفلتر */
  const MAP = {
    close: 'price', change: 'change', change_abs: 'chgAbs', volume: 'volume',
    relative_volume_10d_calc: 'rel_volume', market_cap_basic: 'mc',
    price_earnings_ttm: 'pe', price_book_fq: 'pb', RSI: 'rsi',
    'MACD.macd': 'macd', 'MACD.signal': 'macdSig',
    EMA20: 'ema20', EMA50: 'ema50', EMA200: 'ema200', ATR: 'atr',
    price_52_week_high: 'h52', price_52_week_low: 'l52',
    'Perf.1M': 'p1m', 'Perf.3M': 'p3m', 'Perf.6M': 'p6m',
    'Perf.Y': 'p1y', 'Perf.YTD': 'pYtd', 'Volatility.D': 'volD',
    beta_1_year: 'beta', fundamental_currency_code: 'currency',
    exchange: 'exchange', sector: 'sector', industry: 'industry',
    description: 'nameEn', total_shares_outstanding: 'sharesOut',
    'Recommend.All': 'tvRec', dividends_yield_current: 'dy',
    average_volume_30d_calc: 'av30',
    earnings_per_share_diluted_ttm: 'eps', net_income: 'ni',
    debt_to_equity: 'de', return_on_equity_fq: 'roe',
    operating_margin: 'om', return_on_assets: 'roa',
    return_on_invested_capital: 'roic', gross_margin: 'gm',
    net_margin: 'nm', current_ratio: 'cr', quick_ratio: 'qr',
    total_revenue: 'rev', ebitda: 'ebitda', free_cash_flow: 'fcf',
    total_debt: 'debt', VWAP: 'vwap', price_target_median: 'tgtPrice'
  };

  /* ⭐ إعداد كل سوق */
  const MK = {
    us: {
      url: 'https://scanner.tradingview.com/america/scan', n: 800,
      body: {
        filter: [{ left: 'type', operation: 'equal', right: 'stock' }],
        options: { lang: 'en' }, markets: ['america']
      }
    },
    saudi: {
      url: 'https://scanner.tradingview.com/global/scan', n: 400,
      body: {
        filter: [
          { left: 'exchange', operation: 'in_range', right: ['TADAWUL'] },
          { left: 'type', operation: 'equal', right: 'stock' }
        ],
        options: { lang: 'en' }
      }
    },
    uae: {
      url: 'https://scanner.tradingview.com/uae/scan', n: 200,
      body: {
        filter: [{ left: 'type', operation: 'equal', right: 'stock' }],
        options: { lang: 'en' }, markets: ['uae']
      }
    }
  };

  const CACHE = {};

  /* ⭐ خريطة الأسماء العربية — بتتحمّل عند الطلب */
  let namesCb = null;
  function loadNames(cb) {
    if (window.OCTA_MKT_NAMES) { try { cb(); } catch (e) { } return; }
    if (namesCb) { namesCb.push(cb); return; }
    namesCb = [cb];
    try {
      var s = document.createElement('script');
      s.src = 'data/market_names.js';
      s.onload = function () { fire(); };
      s.onerror = function () { fire(); };
      document.head.appendChild(s);
    } catch (e) { fire(); }
    function fire() {
      var list = namesCb || [];
      namesCb = null;
      for (var i = 0; i < list.length; i++) { try { list[i](); } catch (e) { } }
    }
  }

  function toRows(j) {
    var out = [];
    var data = (j && j.data) || [];
    for (var i = 0; i < data.length; i++) {
      var d = data[i], o = {};
      for (var k = 0; k < COLS.length; k++) {
        var v = d.d[k];
        if (v === null || v === undefined) continue;
        o[MAP[COLS[k]] || COLS[k]] = v;
      }
      var sym = String(d.s || '');
      o.code = sym.split(':').pop() || sym;
      o.tvSymbol = sym;
      o.mcap = o.mc;
      o.relvol = o.rel_volume;
      /* ⭐ التوقع: (السعر المستهدف ÷ السعر) − ١ */
      if (o.tgtPrice != null && o.price) {
        o.upside = (o.tgtPrice / o.price - 1) * 100;
      }
      out.push(o);
    }
    return out;
  }

  function scan(mk, cb) {
    var cfg = MK[mk];
    if (!cfg) { cb([]); return; }
    if (CACHE[mk]) { cb(CACHE[mk]); return; }
    loadNames(function () {
      var body = {
        filter: cfg.body.filter, options: cfg.body.options,
        columns: COLS, sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
        range: [0, cfg.n]
      };
      if (cfg.body.markets) body.markets = cfg.body.markets;
      try {
        fetch(cfg.url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify(body)
        })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            var rows = j ? toRows(j) : [];
            var map = window.OCTA_MKT_NAMES || {};
            for (var i = 0; i < rows.length; i++) {
              var nm = map[rows[i].code];
              if (nm) rows[i].name = nm;
              else if (!rows[i].nameEn) rows[i].nameEn = rows[i].code;
            }
            CACHE[mk] = rows;
            cb(rows);
          })
          .catch(function () { cb([]); });
      } catch (e) { cb([]); }
    });
  }

  window.OCTAMkScan = { scan: scan, has: function (mk) { return !!MK[mk]; } };
})();
