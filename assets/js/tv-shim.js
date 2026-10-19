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
  var DEFAULT_STUDIES = 'MASimple@tv-basicstudies%5CRSI@tv-basicstudies%5CMACD@tv-basicstudies';

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
    q.set('withdateranges', 'true');
    q.set('hide_side_toolbar', o.hideSideToolbar ? 'true' : 'false');
    q.set('allow_symbol_change', o.allowSymbolChange ? '1' : '0');
    q.set('save_image', '0');
    if (o.studies !== false) {
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
     نقيس ارتفاع الحاوية ونحطّه، ونتابع أي تغيّر في الحجم. */
  function fitToHost(f, host) {
    var last = -1;
    function fit() {
      var h = host.clientHeight;
      if (h > 20 && h !== last) { last = h; f.style.height = h + 'px'; }
    }
    fit();
    if (window.ResizeObserver) {
      try {
        var ro = new ResizeObserver(function () { fit(); });
        ro.observe(host);
        f.__octaTvRO = ro;
      } catch (e) {}
    }
  }

  /* ── التركيب: امسح القديم وحط الإطار ── */
  function mount(host, o) {
    o = o || {};
    if (typeof host === 'string') host = document.getElementById(host);
    if (!host) return null;

    var sym = normSym(o.symbol, o.prefix);
    if (!sym) return null;

    host.innerHTML = '';

    var f = document.createElement('iframe');
    f.className = 'octa-tv-frame';
    f.src = buildUrl(Object.assign({}, o, { symbol: sym }));
    f.title = 'شارت TradingView — ' + sym;
    f.setAttribute('allowtransparency', 'true');
    f.setAttribute('scrolling', 'no');
    f.style.cssText = 'display:block;width:100%;height:100%;border:0;' +
      'min-height:' + (o.minHeight || 300) + 'px';
    f.dataset.tvSymbol = sym;
    f.dataset.tvInterval = normIv(o.interval);
    host.appendChild(f);
    fitToHost(f, host);

    if (o.link !== false) host.appendChild(makeLink(sym));

    return { frame: f, url: f.src, symbol: sym, interval: f.dataset.tvInterval };
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

  window.OCTA_TV = {
    mount: mount,
    update: update,
    buildUrl: buildUrl,
    normIv: normIv,
    normSym: normSym,
    whenSized: whenSized,
    isLight: isLight,
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
