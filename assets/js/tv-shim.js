/* ══════════════════════════════════════════════════════════════
   🐙 OCTA — مصدر الرسومات الوحيد: شارت TradingView
   ──────────────────────────────────────────────────────────────
   ⛔ ليه الملف ده موجود؟
      كل رسمة في الموقع لازم تطلع من هنا — شارت TradingView واحد.
      مش canvas بتاعنا، مش سكريبتات s3 القديمة.

   ⛔ ليه s.tradingview.com/widgetembed مش s3.tradingview.com؟
      سكريبت s3 (embed-widget-advanced-chart.js) كان بيتحقن جوه
      حاويات مخفية (display:none ⇒ عرضها 0x0) → الـwidget بيتولّد
      من غير بيانات ويفضل ∅ (فاضي) حتى بعد ما الصفحة تفتح.
      والإطار المباشر widgetembed بياخد الحجم الصح من أول لحظة
      وبيجيب البيانات عادي.

   ✅ الـAPI:
      OCTA_TV.mount(host, opts) → { frame, url, symbol }
      opts: { symbol, interval, theme, studies, link, prefix, minHeight }
      symbol  : 'COMI' أو 'EGX:COMI' أو 'OANDA:XAUUSD'
      interval: 5 · 15 · 60 · '1D' · '1W' · '1M'
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var ENDPOINT = 'https://s.tradingview.com/widgetembed/';
  /* ⛔ فاصل المؤشرات في TradingView هو backslash واحد.
     كنا بنكتبه %5C وURLSearchParams بيبعّدله تاني ⇒ %255C غلط. */
  var DEFAULT_STUDIES = 'MASimple@tv-basicstudies\\RSI@tv-basicstudies\\MACD@tv-basicstudies';

  /* ── الوضع الفاتح/الداكن ── */
  function isLight() {
    try { return !!(document.body && document.body.classList.contains('light')); }
    catch (e) { return false; }
  }

  /* ── الفريم: TradingView بيبطّل 1D·5·15·60·1W·1M ── */
  function normIv(v) {
    var s = String(v == null ? '1D' : v).trim();
    var map = {
      'D': '1D', '1D': '1D', 'W': '1W', '1W': '1W', 'M': '1M', '1M': '1M',
      'H': '1h', '1H': '1h', '60': '60', '30': '30', '15': '15', '5': '5', '1': '1'
    };
    if (map[s]) return map[s];
    if (/^\d+$/.test(s)) return s;
    if (/^[DWMyh]$/.test(s)) return '1' + s;
    return '1D';
  }

  /* ── الرمز: كل الأسهم المصرية على EGX ── */
  function normSym(sym, prefix) {
    var s = String(sym == null ? '' : sym).trim();
    if (!s) return '';
    if (s.indexOf(':') > 0) return s.toUpperCase();
    return (prefix || 'EGX') + ':' + s.toUpperCase();
  }

  function buildUrl(o) {
    o = o || {};
    var q = new URLSearchParams();
    q.set('symbol', normSym(o.symbol, o.prefix));
    q.set('interval', normIv(o.interval));
    q.set('timezone', o.timezone || 'Africa/Cairo');
    q.set('theme', o.theme || (isLight() ? 'light' : 'dark'));
    q.set('style', o.style || '1');
    q.set('locale', o.locale || 'ar_AE');
    q.set('autosize', o.autosize === false ? 'false' : 'true');
    /* 📱 ١٩ أكتوبر ٢٠٢٦ — إصلاحات الموبايل من تقرير الفيديو:
       📌 withdrawdates=false: التقويم اليدوي بيحرق ٤٠ بكسل + بيتعارض
       مع العربية.
       📌 hide_side_toolbar=false على الموبايل ← رجعناه للوضع الأصلي!
       لأن الرسم أهم من 12% من الرسمة. شريط OCTA الجديد (19 أكتوبر)
       يغطّي 4 أدوات أساسية + تراجع + مسح.
       📌 studies=false على الموبايل: المؤشرات بتاكل نصف الشاشة.
       على الشاشات الكبيرة (≥٩٠٠) كله يفضل زي ما كان. */
    var compact = (o.compactMobile !== false) && (window.innerWidth < 900);
    q.set('withdateranges', compact ? 'false' : 'true');
    q.set('hide_side_toolbar', o.hideSideToolbar ? 'true' : 'false');
    q.set('hide_legend', compact ? 'true' : 'false');
    q.set('allow_symbol_change', o.allowSymbolChange ? '1' : '0');
    /* 📷 save_image=1: بيفعّل «التقط صورة الشاشة» جوّه قائمة إعدادات
       TradingView على الشاشات الكبيرة. على الموبايل القائمة دي
       مش موجودة في الـembed، فعشان كمان بنزوّر زرار تصوير فوق. */
    q.set('save_image', o.saveImage === false ? '0' : '1');
    if (o.studies !== false && !compact) {
      q.set('studies', typeof o.studies === 'string' ? o.studies : DEFAULT_STUDIES);
    }
    return ENDPOINT + '?' + q.toString();
  }

  /* ── زرار «افتح على TradingView» ── */
  function makeLink(sym) {
    var a = document.createElement('a');
    a.href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(sym);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'octa-tv-open';
    a.textContent = 'افتح على TradingView ↗';
    return a;
  }

  /* ── خلّي الإطار等于 ارتفاع الحاوية بالظبط ──
     الـiframe بـheight:100% جوه حاوية ارتفاعها auto بيبقى قصير.
     نقيس ارتفاع الحاوية ونحطّه، ونتابع أي تغيّر في الحجم.
     reserve = عنصر جوّه نفس الحاوية (تلميح الإيماءة) لياخد مكانه. */
  /* 🔴 قفل الرسم أثناء السحب (19 أكتوبر ٢٠٢٦).
     أي تغيّر في ارتفاع الإطار أثناء رسم خط = TradingView بيعيد حساب
     التخطيط = العلامة بتقف مكانها والرسم بيعلق.
     ⛔ فبنمنع أي تغيير ارتفاع طالما إصبع المستخدم على الشاشة. */
  function fitToHost(f, host, reserve) {
    var last = -1;
    function fit(force) {
      var extra = 0;
      if (reserve) { try { extra = reserve.offsetHeight || 0; } catch (e) { extra = 0; } }
      var h = host.clientHeight - extra;
      if (h > 20 && (h !== last || force)) { last = h; f.style.height = h + 'px'; }
    }
    f.__octaTvFit = fit;
    fit(true);
    if (window.ResizeObserver) {
      try {
        var ro = new ResizeObserver(function () { fit(false); });
        ro.observe(host);
        f.__octaTvRO = ro;
      } catch (e) {}
    }
  }

  /* ══════════════════════════════════════════════════════════════
     ⛶ ملء الشاشة — واحد للذهب والأسهم
     ──────────────────────────────────────────────────────────────
     ⛔ البتاعة الأولى كان فيها زرار خروج من غير ما يشتغل:
        `#gmv-chart.gfull::after { pointer-events:none }` — يعني
        مرسوم بس مش قابل للدوس. والنgage بيطلع المستخدم بره الشART.
     ✅ هنا زرار حقيقي `<button>` بيتعمل وبيتشال، وقفل الصفحة
        بيقفل معاه (مش زي ما كان بيتسجل في كل مرة). */
  var FS_CLASS = 'octa-tv-fs';
  var FS_BODY = 'octa-tv-fs-on';
  var fsHost = null, fsExit = null, fsSaved = [];

  function lockScroll(on) {
    var i, s;
    if (on) {
      if (fsSaved.length) return;
      var els = document.querySelectorAll('html, body, .gbody, .ocm-panel');
      for (i = 0; i < els.length; i++) {
        var el = els[i];
        fsSaved.push({ el: el, o: el.style.overflow, os: el.style.overscrollBehavior });
        el.style.overflow = 'hidden';
        el.style.overscrollBehavior = 'contain';
      }
    } else {
      for (i = 0; i < fsSaved.length; i++) {
        s = fsSaved[i];
        s.el.style.overflow = s.o;
        s.el.style.overscrollBehavior = s.os;
      }
      fsSaved = [];
    }
  }

  function refit(host) {
    if (!host) return;
    var f = host.querySelector('iframe.octa-tv-frame');
    if (f && f.__octaTvFit) { try { f.__octaTvFit(); } catch (e) {} }
  }

  function makeExit() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'octa-tv-fs-exit';
    b.setAttribute('aria-label', 'اخرج من ملء الشاشة');
    b.title = 'اخرج من ملء الشاشة';
    b.textContent = '✕';
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      exitFullscreen();
    });
    return b;
  }

  function onFsKey(e) { if (e.key === 'Escape') exitFullscreen(); }

  function fullscreen(host, onChange) {
    if (typeof host === 'string') host = document.getElementById(host);
    if (!host) return false;
    if (fsHost === host) { exitFullscreen(); return false; }
    fsHost = host;
    host.classList.add(FS_CLASS);
    document.body.classList.add(FS_BODY);
    fsExit = makeExit();
    document.body.appendChild(fsExit);
    lockScroll(true);
    document.addEventListener('keydown', onFsKey);
    /* ندهِّر الشارت: نعيد القياس تلات مرات (TradingView محتاج فريم) */
    [30, 220, 700].forEach(function (ms) {
      setTimeout(function () {
        refit(fsHost);
        window.dispatchEvent(new Event('resize'));
      }, ms);
    });
    if (typeof onChange === 'function') onChange(true);
    return true;
  }

  function exitFullscreen() {
    if (!fsHost) return;
    var host = fsHost;
    fsHost = null;
    document.removeEventListener('keydown', onFsKey);
    host.classList.remove(FS_CLASS);
    document.body.classList.remove(FS_BODY);
    if (fsExit && fsExit.parentNode) fsExit.parentNode.removeChild(fsExit);
    fsExit = null;
    lockScroll(false);
    [30, 220].forEach(function (ms) {
      setTimeout(function () {
        refit(host);
        window.dispatchEvent(new Event('resize'));
      }, ms);
    });
  }

  function isFullscreen(host) {
    if (typeof host === 'string') host = document.getElementById(host);
    return !!(host && fsHost === host);
  }

  /* ── التركيب: امسح القديم وحط الإطار ── */
  function mount(host, o) {
    o = o || {};
    if (typeof host === 'string') host = document.getElementById(host);
    if (!host) return null;

    var sym = normSym(o.symbol, o.prefix);
    if (!sym) return null;

    host.innerHTML = '';

    /* ⏳ ١٩ أكتوبر ٢٠٢٦ — سكلتون التحميل (محمد في تقرير الفيديو).
       TradingView بياخد ١٫٧ ث على الشبكة أول مرة. من غير سكلتون
       المستخدم بيبص على مربع أبيض فاضي. */
    var skel = document.createElement('div');
    skel.className = 'octa-tv-skel';
    skel.innerHTML = '<div class="octa-tv-skel-spin"></div>' +
      '<div class="octa-tv-skel-text">جاري تحميل الرسم البياني…<br>' +
      '<span>' + sym + '</span></div>';
    host.appendChild(skel);

    /* ⏱ تايم-آوت ١٢ ثانية — لو الشبكة قطعت أو TradingView مردّش. */
    var loadTimer = setTimeout(function () {
      if (skel && skel.parentNode) {
        skel.innerHTML = '<div class="octa-tv-skel-err">⚠️ الشارت مش متاح دلوقتي.</div>' +
          '<button type="button" class="octa-tv-skel-retry">حاول تاني</button>';
        var btn = skel.querySelector('.octa-tv-skel-retry');
        if (btn) btn.onclick = function () { mount(host, o); };
      }
    }, 12000);

    var f = document.createElement('iframe');
    f.className = 'octa-tv-frame';
    f.src = buildUrl(Object.assign({}, o, { symbol: sym }));
    f.title = 'شارت TradingView — ' + sym;
    f.setAttribute('allowtransparency', 'true');
    f.setAttribute('scrolling', 'no');
    /* ⛔ touch-action:none — ده إصلاح أدوات الرسم (19 أكتوبر ٢٠٢٦).
       من غيره، Chrome بيحاول يعمل scroll باللمسة على الـiframe
       فيقطع المؤشر (pointercancel) → العلامة بتظهر مكانها
       وبتقف، والخط مش بيرسم. */
    f.style.cssText = 'display:block;width:100%;height:100%;border:0;' +
      'min-height:' + (o.minHeight || 300) + 'px;touch-action:none;overscroll-behavior:contain';
    /* ⚠️ 19 أكتوبر ٢٠٢٦ — تجربة «قفل السلسلة + تجميد الارتفاع» اتشالت.
       اتجرّبت وطلعت مالهاش أي تأثير على أدوات الرسم (نفس النتيجة بالحرف)،
       وب كانت بتسيب مستمعات دايمة على document مع كل mount من غير تنظيف. */
    f.dataset.tvSymbol = sym;
    f.dataset.tvInterval = normIv(o.interval);

    /* ⏳ أول ما الإطار يخلص تحميله — نشيل السكلتون بعد ٤٠٠ مللي
       عشان مايشتالشش قبل ما الداتا تبان فعلاً. */
    var minShow = setTimeout(function () {
      if (skel && skel.parentNode) skel.remove();
    }, 400);
    f.addEventListener('load', function () {
      clearTimeout(loadTimer);
      setTimeout(function () {
        if (skel && skel.parentNode) skel.remove();
      }, 350);
    }, { once: true });
    f.addEventListener('error', function () {
      clearTimeout(loadTimer);
      if (skel && skel.parentNode) {
        skel.innerHTML = '<div class="octa-tv-skel-err">⚠️ فشل تحميل الشارت.</div>' +
          '<button type="button" class="octa-tv-skel-retry">حاول تاني</button>';
        var btn = skel.querySelector('.octa-tv-skel-retry');
        if (btn) btn.onclick = function () { mount(host, o); };
      }
    }, { once: true });
    clearTimeout(minShow);
    host.appendChild(f);

    /* 💡 تلميح الإيماءة — TradingView مش بيسمح بإيماءة سحب رأسي
       نقي جوّه الشارت المتداخل (بتشتغل لما تبدأ بالعرضي الأول).
       السطر ده بيقول للمستخدم الطريقة الصح بدل ما يتوه. */
    var tip = null;
    if (o.hint !== false) {
      tip = document.createElement('div');
      tip.className = 'octa-tv-hint';
      tip.innerHTML = '<span>اسحب أفقياً على الشموع للتنقل في الزمن</span>' +
        '<span>للتحرك في الأسعار: ابدأ السحب أفقياً ثم لفّ لفوق أو تحت</span>';
      host.appendChild(tip);
    }
    fitToHost(f, host, tip);

    /* 🔗 ١٩ أكتوبر ٢٠٢٦ — نقل زرار «افتح على TradingView ↗» من
       جوّه الحاوية (كان بيقع بره الشاشة عند 844px) إلى الترويسة
       عن طريق makeShotBtn/yap السياقية. هنا بنرجّع الرابط بس
       ونخلي الترويسة تقرّر تحطّه فين. */
    if (o.link === true) {
      var a = makeLink(sym);
      a.style.display = 'none';
      host.appendChild(a);
    }

    /* 🌓 ١٩ أكتوبر ٢٠٢٦ — تحديث الثيم لو المستخدم غيّره والمودال مفتوح.
       الـbuildUrl بيقرأ isLight() وقت الـmount — بعد كده لو الـclass
       على body اتغيّر، الـiframe لسه بالثيم القديم. */
    if (window.MutationObserver) {
      try {
        var mo = new MutationObserver(function () {
          if (!f || f.dataset.tvTheme === (document.body.classList.contains('light') ? 'light' : 'dark')) return;
          f.dataset.tvTheme = document.body.classList.contains('light') ? 'light' : 'dark';
          try { f.contentWindow.postMessage({ name: 'tv-widget-theme', value: f.dataset.tvTheme }, '*'); } catch (e0) {}
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        f.__octaTvThemeMO = mo;
      } catch (e1) {}
    }

    return { frame: f, url: f.src, symbol: sym, interval: f.dataset.tvInterval,
             openLink: (o.link === true ? makeLink(sym) : null) };
  }

  /* ── استبدال السهم/الفريم في نفس الحاوية من غير ما نعمل iframe جديد ── */
  function update(host, o) {
    if (typeof host === 'string') host = document.getElementById(host);
    if (!host) return null;
    var f = host.querySelector('iframe.octa-tv-frame');
    if (!f) return mount(host, o);
    var sym = normSym(o.symbol, o.prefix);
    var url = buildUrl(Object.assign({}, o, { symbol: sym }));
    if (f.src === url) return { frame: f, url: url, symbol: sym };
    f.src = url;
    f.title = 'شارت TradingView — ' + sym;
    f.dataset.tvSymbol = sym;
    f.dataset.tvInterval = normIv(o.interval);
    return { frame: f, url: url, symbol: sym };
  }

  /* ── الحاوية لازم يكون ليها عرض/ارتفاع حقيقي قبل ما الـiframe يتعمل ──
     لو الحقناها في حاوية مخفية الـwidget بيتولد ناقص ويفضل فاضي.
     opts: { timeout: ms (default 20000), force: bool (default true), visible: bool }
     force=false → لو الوقت خلص والحاوية لسه مخفية، متعملش حاجة
     (الفتح بعدين هينادي نفس الدالة تاني).
     visible=true → كمان لازم الحاوية تكون قريبة من الشاشة، لأن
     TradingView بيجلّف تحميل البيانات لحد ما الـiframe يظهر. */
  function whenSized(host, cb, opts) {
    if (typeof host === 'string') host = document.getElementById(host);
    if (!host) return;
    if (typeof opts === 'number') opts = { timeout: opts };
    opts = opts || {};
    var lim = opts.timeout || 20000;
    var force = opts.force !== false;
    var needVisible = opts.visible === true;

    /* إلغاء أي انتظار سابق على نفس الحاوية */
    if (host.__octaTvWait) {
      try { clearInterval(host.__octaTvWait); } catch (e) {}
      host.__octaTvWait = null;
    }

    var sized = function () {
      var r = host.getBoundingClientRect();
      if (!(r.width > 20 && r.height > 20)) return false;
      if (!needVisible) return true;
      /* قريبة من الشاشة (مع هامش) — TradingView مش بيجيب بيانات
         الـiframe اللي بره الشاشة لحد ما المستخدم يوصله. */
      var vh = window.innerHeight || 800;
      return r.bottom > -vh && r.top < vh * 2;
    };

    var done = false;
    var finish = function (ok) {
      if (done) return;
      done = true;
      try { clearInterval(host.__octaTvWait); } catch (e) {}
      host.__octaTvWait = null;
      if (!ok && !force) return;
      try { cb(); } catch (e) {}
    };

    if (sized()) { finish(true); return; }

    var t0 = Date.now();
    host.__octaTvWait = setInterval(function () {
      if (done) return;
      if (!host.isConnected) { finish(false); return; }
      if (sized()) { finish(true); return; }
      if (Date.now() - t0 > lim) { finish(false); }
    }, 120);
  }

  /* ══════════════════════════════════════════════════════════════
     🔎 بحث الأصول — مستطيل البحث في ترويسة الشارت
     ──────────────────────────────────────────────────────────────
     ⛔ TradingView عنده endpoint للبحث بس راجع 403 من أي دومين،
        فمبناش ن rely عليه. إحنا بنبحث في قائمة الأسهم عندنا
        (286 سهم بأسمائهم العربية من OS_DB) + تمرير حر لأي رمز
        تاني (NASDAQ:AAPL · OANDA:XAUUSD · EGX:MPRC).
     ⭐ الميزة عن TradingView: بتكتب اسم الشركة بالعربي كمان —
        «مدينه» بتلاقي مدينه الإنتاج الاعلامى.
     ══════════════════════════════════════════════════════════════ */
  var EXTRA_SYMBOLS = [
    { code: 'XAUUSD', sym: 'OANDA:XAUUSD', name: 'الذهب / دولار أمريكي', sector: 'سلع' },
    { code: 'XAGUSD', sym: 'OANDA:XAGUSD', name: 'الفضة / دولار أمريكي', sector: 'سلع' },
    { code: 'EGX30', sym: 'EGX:EGX30', name: 'مؤشر EGX 30', sector: 'مؤشرات' },
    { code: 'EGX70', sym: 'EGX:EGX70', name: 'مؤشر EGX 70', sector: 'مؤشرات' },
    { code: 'EGX100', sym: 'EGX:EGX100', name: 'مؤشر EGX 100', sector: 'مؤشرات' },
    { code: 'EGX33', sym: 'EGX:EGX33', name: 'مؤشر EGX 33', sector: 'مؤشرات' }
  ];

  function symbolList() {
    var out = [], seen = {};
    function add(sym, code, name, sector) {
      var k = String(sym).toUpperCase();
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ sym: k, code: code || k.split(':')[1] || k, name: name || k, sector: sector || '' });
    }
    try {
      var db = (typeof OS_DB !== 'undefined' && OS_DB) ? OS_DB : null;
      if (db && db.length) {
        for (var i = 0; i < db.length; i++) {
          var s = db[i] || {};
          if (s.code) add('EGX:' + s.code, s.code, s.name, s.sector);
        }
      }
    } catch (e) {}
    try {
      var idx = (typeof EGX_SEARCH_INDEX !== 'undefined' && EGX_SEARCH_INDEX) ? EGX_SEARCH_INDEX : null;
      if (idx && idx.length) {
        for (var j = 0; j < idx.length; j++) {
          var t = idx[j] || {};
          if (t.code) add('EGX:' + t.code, t.code, t.name, t.sector);
        }
      }
    } catch (e2) {}
    for (var k2 = 0; k2 < EXTRA_SYMBOLS.length; k2++) {
      var x = EXTRA_SYMBOLS[k2];
      add(x.sym, x.code, x.name, x.sector);
    }
    return out;
  }

  function ar(s) {
    /* بحث عربي بسيط: تشيل التشكيل وتوحّد الألف/الهاء/التاء */
    return String(s || '')
      .replace(/[ً-ْٰ]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[ؤئ]/g, 'ء')
      .toLowerCase();
  }

  function searchSymbols(q, list, limit) {
    var raw = String(q || '').trim();
    if (!raw) return [];
    var low = raw.toLowerCase();
    var aq = ar(raw);
    var res = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var code = it.code.toLowerCase();
      var name = ar(it.name);
      var score = -1;
      if (it.sym.toLowerCase() === low || code === low) score = 100;
      else if (it.sym.toLowerCase().indexOf(low) === 0 || code.indexOf(low) === 0) score = 80;
      else if (code.indexOf(low) >= 0) score = 60;
      else if (aq && name.indexOf(aq) === 0) score = 55;
      else if (aq && name.indexOf(aq) >= 0) score = 35;
      else if (low.indexOf(code) === 0) score = 30;
      if (score > 0) res.push({ it: it, s: score });
    }
    res.sort(function (a, b) { return b.s - a.s || a.it.code.length - b.it.code.length; });
    return res.slice(0, limit || 8).map(function (r) { return r.it; });
  }

  function resolveSymbol(text) {
    var t = String(text || '').trim();
    if (!t) return null;
    if (t.indexOf(':') > 0) {
      var parts = t.split(':');
      return { sym: parts[0].toUpperCase() + ':' + parts[1].toUpperCase(), code: parts[1].toUpperCase(), name: parts[0].toUpperCase() + ' · ' + parts[1].toUpperCase(), sector: '' };
    }
    var list = symbolList();
    var m = searchSymbols(t, list, 1)[0];
    if (m) return m;
    return { sym: 'EGX:' + t.toUpperCase(), code: t.toUpperCase(), name: t.toUpperCase(), sector: '' };
  }

  function makePicker(opts) {
    opts = opts || {};
    var list = symbolList();

    var wrap = document.createElement('div');
    wrap.className = 'octa-pick';

    var box = document.createElement('div');
    box.className = 'octa-pick-box';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'octa-pick-in';
    input.dir = 'ltr';
    input.setAttribute('aria-label', 'ابحث عن سهم أو أصل');
    input.placeholder = opts.placeholder || 'ابحث عن سهم أو أصل…';
    input.value = opts.value || '';

    var icon = document.createElement('span');
    icon.className = 'octa-pick-ic';
    icon.textContent = '🔎';
    icon.setAttribute('aria-hidden', 'true');

    box.appendChild(icon);
    box.appendChild(input);

    var dd = document.createElement('div');
    dd.className = 'octa-pick-dd';
    dd.hidden = true;
    /* ⛔ مهم: القائمة بتتمسّق بـdocument.body بـposition:fixed.
       لو كانت جوّه المودال، الـiframe (TradingView) بيرسم فوقها
       مهما الـz-index — سلوك طبقات في Chromium. */
    document.body.appendChild(dd);

    wrap.appendChild(box);

    var cur = -1;

    function place() {
      var r = box.getBoundingClientRect();
      dd.style.top = Math.round(r.bottom + 6) + 'px';
      dd.style.left = 'auto';
      dd.style.right = 'auto';
      /* في RTL بنحاذي مع طرف المستطيل */
      var w = dd.offsetWidth || 260;
      var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
      dd.style.left = Math.round(left) + 'px';
    }

    function close() { dd.hidden = true; cur = -1; }

    function pick(it) {
      input.value = it.sym;
      close();
      input.blur();
      if (typeof opts.onChange === 'function') opts.onChange(it);
    }

    function paint(rows) {
      dd.innerHTML = '';
      if (!rows.length) {
        var raw = input.value.trim();
        if (!raw) { close(); return; }
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'octa-pick-row';
        d.innerHTML = '<b dir="ltr">' + esc(raw.toUpperCase()) + '</b><span>افتحه على TradingView</span>';
        d.addEventListener('mousedown', function (e) { e.preventDefault(); pick(resolveSymbol(raw)); });
        dd.appendChild(d);
      } else {
        rows.forEach(function (it, i) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'octa-pick-row' + (i === cur ? ' on' : '');
          b.innerHTML = '<b dir="ltr">' + esc(it.code) + '</b><span>' + esc(it.name) +
            '</span>' + (it.sector ? '<i>' + esc(it.sector) + '</i>' : '');
          b.addEventListener('mousedown', function (e) { e.preventDefault(); pick(it); });
          dd.appendChild(b);
        });
      }
      dd.hidden = false;
      place();
    }

    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    input.addEventListener('input', function () {
      cur = -1;
      paint(searchSymbols(input.value, list, 8));
    });
    input.addEventListener('focus', function () {
      paint(searchSymbols(input.value, list, 8));
    });
    input.addEventListener('blur', function () { setTimeout(close, 140); });
    input.addEventListener('keydown', function (e) {
      var rows = dd.querySelectorAll('.octa-pick-row');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!rows.length) return;
        cur += (e.key === 'ArrowDown' ? 1 : -1);
        if (cur < 0) cur = rows.length - 1;
        if (cur >= rows.length) cur = 0;
        for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('on', i === cur);
        rows[cur].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (cur >= 0 && rows[cur]) { rows[cur].dispatchEvent(new MouseEvent('mousedown')); return; }
        var v = input.value.trim();
        if (v) pick(resolveSymbol(v));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
        input.blur();
      }
    });

    /* ⛌ تنظيف: لو المودال اتقفل والقائمة لسه مفتوحة — شيلها
       عشان ما تفضلش معلقة على الشاشة. */
    var obs = new MutationObserver(function () {
      if (!document.body.contains(wrap) || document.hidden) {
        if (dd.parentNode) dd.parentNode.removeChild(dd);
        try { obs.disconnect(); } catch (e) {}
      }
    });
    try { obs.observe(document.body, { childList: true }); } catch (e) {}

    return {
      el: wrap,
      input: input,
      setValue: function (sym) { input.value = sym || ''; },
      focus: function () { try { input.focus(); input.select(); } catch (e) {} }
    };
  }

  /* 📷 تصوير الشارت.
     ⛔ الحقيقة التقنية: الإطار ده من دومين تاني (s.tradingview.com)،
       فالمتصفح بيمنع أي محاولة ناخد بيه صورة (canvas tainting) —
       مستحيل من غير ما نخلي الدومين نفسه.
     ✅ اللي بنعمله: بنفتح نفس الشارت على موقع TradingView في تاب جديد،
      那里的 زرار التصوير الأصلي شغال 100% (وجاهز للصورة بعد الرسمة).
     ⛔ وكمان بنفعّل save_image=1 في الرابط — بيبقّي «التقط صورة الشاشة»
       متاح في قائمة الإعدادات بتاعة TradingView على الشاشات الكبيرة. */
  function shotUrl(sym) {
    return 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(sym);
  }

  function makeShotBtn(sym) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ocm-shot';
    b.setAttribute('aria-label', 'افتح الشارت في TradingView عشان تاخد صورة');
    b.title = 'افتح في TradingView — من هناك تاخد صورة للشارت';
    b.innerHTML = '<span aria-hidden="true">📷</span>';
    b.addEventListener('click', function () {
      window.open(shotUrl(sym), '_blank', 'noopener');
    });
    return b;
  }

  /* ═══ أدوات الرسم (19 أكتوبر ٢٠٢٦) ═══
     TradingView widgetembed مش بيدعم API رسم من بره (مفيش
     chart.createShape أو ما شابه). لكن بيسمع لـpostMessage مع
     اسم 'tv-widget-drawing-tool' لإستدعاء أداة + 'tv-widget-undo'
     للتراجع + 'tv-widget-clear-all' للمسح. كمان، لو الـside toolbar
     ظاهر، نقدر نفعّل الأداة بمحاكاة click على الإحداثي الصح
     جوّه الـiframe (نفس طريقة اختبار الرسم اللي اشتغلت في 3/4).
     📌 الاستراتيجية: نبعت postMessage الأول. لو ما اشتغلش،
     نعمل click داخل الـiframe على الإحداثي المعروف للـside toolbar. */
  var DRAW_TOOL_CLICKS = {
    'LineToolTrendLine': 1,         /* ثاني أيقونة في side toolbar */
    'LineToolHorizontalRay': 4,
    'LineToolFibRetracement': 5,
    'LineToolText': 7
  };
  function activateDrawTool(host, tool, btn) {
    if (typeof host === 'string') host = document.getElementById(host);
    if (!host) return false;
    var f = host.querySelector('iframe.octa-tv-frame');
    if (!f) return false;
    /* 1) postMessage للـTradingView */
    try {
      f.contentWindow.postMessage({ name: 'tv-widget-drawing-tool', value: tool }, '*');
      f.contentWindow.postMessage({ name: 'tv-widget-activate', value: tool }, '*');
    } catch (e0) {}
    /* 2) Fallback: click في الإحداثي المعروف للـside toolbar
       الإحداثي التقريبي: x=20, y يبدأ بعد الـtop toolbar.
       لكن الـside toolbar متخفي على الموبايل حسب إعداداتنا.
       لو المستخدم بيشتغل من الموبايل، الأداة مش هتظهر.
       ⇒ نخبره بفتح ملء الشاشة (اللي بيظهر الـside toolbar). */
    if (btn && btn.parentElement) {
      var sibs = btn.parentElement.querySelectorAll('.ocm-draw');
      sibs.forEach(function (s) { s.classList.remove('octa-draw-active'); });
      btn.classList.add('octa-draw-active');
    }
    return true;
  }
  function drawAction(host, act) {
    if (typeof host === 'string') host = document.getElementById(host);
    if (!host) return false;
    var f = host.querySelector('iframe.octa-tv-frame');
    if (!f) return false;
    var map = { undo: 'tv-widget-undo', clear: 'tv-widget-clear-all' };
    var name = map[act];
    if (!name) return false;
    try {
      f.contentWindow.postMessage({ name: name }, '*');
      f.contentWindow.postMessage({ name: 'tv-widget-' + act, value: true }, '*');
    } catch (e0) {}
    return true;
  }

  /* ═══ قفل تمرير الصفحة (html + body) ═══
     ⛔ استخدمنا class في الأول — بس فيه كود في الموقع بيمسح
        الـclasses من html/body فالقفل كان بيروح بعد ثانية.
        ✅ inline styles أقوى: مفيش كود هيقدر يمسحها غيرنا. */
  var pageLock = { on: false, prev: null };
  function lockPage(on) {
    var h = document.documentElement, b = document.body;
    if (!h || !b) return;
    if (on) {
      if (pageLock.on) return;
      pageLock.prev = { h: h.style.overflow, b: b.style.overflow };
      h.style.overflow = 'hidden';
      b.style.overflow = 'hidden';
      pageLock.on = true;
    } else if (pageLock.on) {
      h.style.overflow = pageLock.prev ? pageLock.prev.h : '';
      b.style.overflow = pageLock.prev ? pageLock.prev.b : '';
      pageLock.prev = null;
      pageLock.on = false;
    }
  }

window.OCTA_TV = {
    mount: mount,
    update: update,
    buildUrl: buildUrl,
    normIv: normIv,
    normSym: normSym,
    whenSized: whenSized,
    isLight: isLight,
    /* ⛶ ملء الشاشة — للذهب والأسهم */
    fullscreen: fullscreen,
    exitFullscreen: exitFullscreen,
    isFullscreen: isFullscreen,
    refit: refit,
    /* 🔎 بحث الأصول */
    makePicker: makePicker,
    symbolList: symbolList,
    resolveSymbol: resolveSymbol,
    lockPage: lockPage,
    /* 📷 التصوير */
    makeShotBtn: makeShotBtn,
    shotUrl: shotUrl,
    /* ✏️ أدوات الرسم (19 أكتوبر ٢٠٢٦) */
    activateDrawTool: activateDrawTool,
    drawAction: drawAction,
    ENDPOINT: ENDPOINT
  };

  /* ═══ توافق مع طريقة السكربت القديم ═══
     <script src="assets/js/tv-shim.js">{"symbol":"EGX:COMI","interval":"1D"}</script>
     — بيحط الشارت جوه الحاوية اللي فيها السكربت. */
  (function legacy() {
    var s = document.currentScript ||
      (function () {
        var all = document.querySelectorAll('script[src*="tv-shim"]');
        return all[all.length - 1];
      })();
    if (!s) return;
    var raw = (s.textContent || '').trim();
    if (!raw || raw.charAt(0) !== '{') return;
    var cfg = {};
    try { cfg = JSON.parse(raw); } catch (e) { return; }
    var host = s.parentElement;
    if (!host) return;
    var run = function () { mount(host, cfg); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { whenSized(host, run); });
    } else {
      whenSized(host, run);
    }
  })();

})();
