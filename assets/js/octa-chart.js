/* ══════════════════════════════════════════════════════════════
   📊 شارت TradingView — الملف الوحيد للشارت في الموقع
   ──────────────────────────────────────────────────────────────
   ⛔⛔⛔ اتشال الشارت اللي احنا كنا بنطوّره (كانفاس محلي + أدوات رسم
   + SMA200 + إدارة أطباق) — كان تقيل على الموقع وبيزحلق وبيغيّرش حاجة على أرقام الموقع.
   فضل TradingView Advanced Chart الرسمي بس:
     · شموع · أدوات رسم · مؤشرات · فريمات زمنية
     · بياخد المساحة كلها على الموبايل وزرار X يقفل ويرجّعك للموقع
     · بيفتح جوّه — مش بيوديك لـtradingview.com

   📌 الأصول (الذهب · الدولار · EGX30 · النفط) ليها نفس الشارت:
     <b data-tv="OANDA:XAUUSD" data-tvn="الذهب">…</b>
     أو برمجياً: openAssetChart('OANDA:XAUUSD', 'الذهب')
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const MK_TG = { egypt: 'EGX', us: 'NASDAQ', saudi: 'TADAWUL', uae: 'DFM' };
  const TV_WIDGET = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';

  let CURRENT = { code: null, name: null, mk: 'egypt', symbol: null };

  function symbolOf(code, mk) {
    return (MK_TG[mk] || 'EGX') + ':' + code;
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/[^\u0020-\u007E\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isMobile() {
    return window.matchMedia('(max-width: 820px)').matches;
  }

  /* 
      بناء النافذة
      */
  function build(title, subtitle, symbol, extra) {
    const old = document.getElementById('chModal');
    if (old) old.remove();

    const wrap = document.createElement('div');
    wrap.id = 'chModal';
    wrap.className = 'ch-modal' + (isMobile() ? ' ch-mob' : '');
    wrap.innerHTML =
      '<div class="ch-box">' +

        '<div class="ch-head">' +
          '<div class="ch-t">' +
            '<b>' + esc(title) + '</b>' +
            (subtitle ? '<span>' + esc(subtitle) + '</span>' : '') +
          '</div>' +
          '<div class="ch-links">' +
            '<a class="ch-lb ch-tv-out" target="_blank" rel="noopener nofollow" href="https://www.tradingview.com/chart/?symbol=' +
              encodeURIComponent(symbol) + '" title="افتح في موقع TradingView" aria-label="افتح في TradingView"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg></a>' +
            '<button class="ch-lb ch-fs-b" onclick="chFull()" title="ملء الشاشة" aria-label="ملء الشاشة"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg></button>' +
            '<button class="ch-lb ch-x" onclick="closeChart()" title="اقفل (Esc)" aria-label="اقفل"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>' +
          '</div>' +
        '</div>' +

        '<div class="ch-tv-wrap" id="chTvWrap">' +
          '<div id="chTv" class="tradingview-widget-container">' +
            '<div id="chTvInner" class="tradingview-widget-container__widget"></div>' +
            '<div class="tradingview-widget-copyright"></div>' +
          '</div>' +
        '</div>' +

      '</div>';

    document.body.appendChild(wrap);

    /*  قفل الـscroll  من غير كده الصفحة ورا الشارت بتتزحلق
       بإيدك وإنت بترسم على الشارت */
    document.body.style.overflow = 'hidden';

    mountTV({
      autosize: true,
      symbol: symbol,
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
        'scalesProperties.textColor': '#8b9eb0'
      },
      studies: [{ name: 'SMA', id: 'study_SMA_200', overlay: true }]
    });

    bindKeys();

    /* -network أول ضغطة على الـclose بتظهر  الـiframe بياخد
       شوية وقت يبنى، والقفل كان بيفتح قبل ما يتركّب */
    const x = wrap.querySelector('.ch-x');
    if (x) setTimeout(function () { x.style.opacity = '1'; }, 250);

    return wrap;
  }

  /*  تركيب الـwidget  */
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
    script.textContent = JSON.stringify(cfg);

    inner.appendChild(script);
    holder.appendChild(inner);
  }

  /* 
      شارت السهم
      */
  window.openChart = function (code, nameAr, market, tvSymbol) {
    const mk = market || window.__scMarket || 'egypt';
    window.__scMarket = mk;
    const symbol = tvSymbol || symbolOf(code, mk);
    CURRENT = { code: code, name: nameAr || '', mk: mk, symbol: symbol };
    build(code, nameAr || '', symbol);
  };

  /* 
      شارت الأصول  الذهب  الدولار  EGX30  النفط
      */
  window.openAssetChart = function (symbol, title, sub) {
    CURRENT = { code: null, name: title || '', mk: null, symbol: symbol };
    build(title || symbol, sub || symbol, symbol);
  };

  /* 
      أي عنصر عليه data-tv يفتح الشارت بتاعه
      */
  document.addEventListener('click', function (e) {
    const el = e.target.closest ? e.target.closest('[data-tv]') : null;
    if (!el) return;
    /*  متعاملش مع الضغط لو جوه الشارت نفسه */
    if (e.target.closest('#chModal')) return;
    e.preventDefault();
    e.stopPropagation();
    window.openAssetChart(
      el.getAttribute('data-tv'),
      el.getAttribute('data-tvn') || el.getAttribute('data-tv'),
      el.getAttribute('data-tvs') || ''
    );
  }, true);

  /* 
     ️ أدوات
      */
  window.chFull = function () {
    const box = document.querySelector('.ch-box');
    if (!box) return;
    box.classList.toggle('ch-fs');
    document.body.style.overflow = box.classList.contains('ch-fs') ? 'hidden' : '';
  };

  window.closeChart = function () {
    const el = document.getElementById('chModal');
    if (el) el.remove();
    document.body.style.overflow = '';
    CURRENT = { code: null, name: null, mk: null, symbol: null };
  };

  function bindKeys() {
    if (window.__octaChartKeys) return;
    window.__octaChartKeys = true;
    document.addEventListener('keydown', function (e) {
      if (!document.getElementById('chModal')) return;
      if (e.key === 'Escape') { window.closeChart(); return; }
      if (e.key === 'f' || e.key === 'F') { window.chFull(); }
    });
    /*  الباك بيسيب الـbody مقفول  لو أي حاجة قفلت الشارت
       من غير ما ترجّع الـscroll، الصفحة بتفضل مش بتتزحلق */
    window.addEventListener('pagehide', function () { document.body.style.overflow = ''; });
  }

  /*  الأصول والعملات: خلّي عنصر الـticker قابل للدوس */
  const PAIRS = {
    'tk-gold':   ['OANDA:XAUUSD', '🥇 الذهب', 'أونصة · XAU/USD'],
    'tk-goldoz': ['OANDA:XAUUSD', '🥇 أونصة الذهب', 'OANDA:XAUUSD'],
    'tk-gold24': ['OANDA:XAUUSD', '🥇 الذهب', 'أونصة · XAU/USD'],
    'tk-silver': ['OANDA:XAGUSD', '🥈 الفضة', 'أونصة · XAG/USD'],
    'tk-usd':    ['EGP=X', '💵 دولار / جنيه', 'EGP=X'],
    'tk-eur':    ['EUR=X', '💶 يورو / جنيه', 'EUR=X'],
    'tk-egx':    ['EGX:EGX30', '📊 مؤشر EGX30', 'EGX:EGX30'],
    'tk-egx70':  ['EGX:EGX70', '📈 مؤشر EGX70', 'EGX:EGX70'],
    'tk-egx100': ['EGX:EGX100', '📉 مؤشر EGX100', 'EGX:EGX100'],
    'tk-egx33':  ['EGX:EGX33', '🕌 مؤشر EGX33 شرعي', 'EGX:EGX33'],
    'tk-oil':    ['TVC:USOIL', '🛢️ نفط WTI', 'TVC:USOIL'],
    'tk-ukoil':  ['TVC:UKOIL', '🛢️ نفط برنت', 'TVC:UKOIL'],
    'tk-spx':    ['SP:SPX', 'S&P 500', 'SP:SPX'],
    'tk-nasdaq': ['NASDAQ:IXIC', '💻 Nasdaq', 'NASDAQ:IXIC']
  };

  function paintAssets() {
    try {
      const MAP = PAIRS;
      Object.keys(MAP).forEach(function (id) {
        const el = document.getElementById(id);
        if (!el || el.getAttribute('data-tv')) return;
        el.setAttribute('data-tv', MAP[id][0]);
        el.setAttribute('data-tvn', MAP[id][1]);
        el.setAttribute('data-tvs', MAP[id][2]);
        el.style.cursor = 'pointer';
        el.title = 'دوس تشوف الشارت';
      });
    } catch (e) { /* مالوش لازمة تسقط الموقع */ }
  }

  /* ⛌🥇 كارت الذهب — بيتضاف في السايدبار (موجود في كل الصفحات)
     والدوس عليه بيفتح شارت الذهب بنفس زرار السهم بالظبط. */
  function injectGoldCard() {
    const nav = document.querySelector('#sideHost .sb-nav')
             || document.querySelector('.sb-nav');
    if (!nav || nav.querySelector('.gc-card')) return;
    const card = document.createElement('button');
    card.className = 'sb-i gc-card';
    card.type = 'button';
    card.setAttribute('data-tv', 'OANDA:XAUUSD');
    card.setAttribute('data-tvn', '🥇 الذهب');
    card.setAttribute('data-tvs', 'أونصة · XAU/USD');
    card.title = 'دوس تفتح شارت الذهب';
    card.innerHTML =
      '<span class="sb-ico">🥇</span>' +
      '<span class="sb-t"><b>الذهب</b><i>شارت مباشر · XAU/USD</i></span>';
    nav.insertBefore(card, nav.firstChild);
  }

  function boot() {
    injectGoldCard();
    paintAssets();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 900); });
  } else {
    setTimeout(boot, 900);
  }
  /* ⛔ السايدبار ممكن يتفتح بعد — نتابع لحد ما الكارت يوصل */
  let tries = 0;
  const iv = setInterval(function () {
    injectGoldCard();
    if (++tries > 20) clearInterval(iv);
  }, 700);

  document.addEventListener('click', function (e) {
    const el = e.target.closest ? e.target.closest('.tk-mini') : null;
    if (!el || el.getAttribute('data-tv')) return;
    const v = el.querySelector('.tkm-v');
    const id = v && v.id ? v.id.replace(/^tkm-?/, '') : '';
    const name = (el.querySelector('.tkm-n') || {}).innerText || '';
    const hit = PAIRS[id] || PAIRS[Object.keys(PAIRS).find(function (k) { return name.indexOf(k.split(':')[1]) >= 0; })];
    if (!hit) return;
    el.setAttribute('data-tv', hit[0]);
    el.setAttribute('data-tvn', name || hit[1]);
    el.setAttribute('data-tvs', hit[2]);
    el.style.cursor = 'pointer';
  }, true);

})();