/* ══════════════════════════════════════════════════════════════
 *  🛡️ OCTA · octa-origin-guard.js — حارس وجهة الـAPI
 *  ──────────────────────────────────────────────────────────────
 *  📌 المشكلة (الجولة ٢٣ ·measured): المعاينة كانت بتروّح على
 *     نفق trycloudflare ميت ⇒ Cloudflare 1016 ⇒ 530 على /api/*
 *     والواجهة كانت فاكرة إن «الباسورد غلط».
 *  📌 القاعدة الذهبية:
 *     ⛔ المعاينة ⇒ ممنوع تلمس الإنتاج (أبداً).
 *     ⛔ الإنتاج  ⇒ ممنوع يوصل لوجهة المعاينة.
 *     ⛔ مفيش ارتجاع صامت: لو الوجهة ناقصة/ميتة/نفق ⇒ خطأ واضح.
 *  📌 العقدة (contract): assets/config/preview.json
 *  📌 الوحدة دي بتعمل ٣ حاجات:
 *     ① تحسب الوجهة الفعّالة وتقارنها بالعقدة.
 *     ② تفحص الوجهة (DNS + /api/health) — **قراءة بس**.
 *     ③ تعرض بانر واضح + ترفض أي نداء API لو الحارس رفض.
 *  ══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  var api = factory();
  /* ⛔ Node (الاختبارات) — نفس الوحدة بتتنفّذ في المتصفح */
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.OCTAOriginGuard = api;
    try { api.autoInstall(root); } catch (e) { }
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
   *  📚 الأكواد — قاموس واحد لكل الحالات
   *  ══════════════════════════════════════════════════════════════ */
  var CODES = {
    OK: 'ok',
    CONFIG_MISSING: 'config_missing',
    ORIGIN_MISSING: 'origin_missing',
    ORIGIN_MISMATCH: 'origin_mismatch',
    PRODUCTION_IN_PREVIEW: 'production_origin_in_preview',
    PREVIEW_IN_PRODUCTION: 'preview_origin_in_production',
    TUNNEL_ORIGIN: 'tunnel_origin',
    ORIGIN_DNS_ERROR: 'origin_dns_error',
    ORIGIN_UNREACHABLE: 'origin_unreachable',
    BLOCKED: 'origin_blocked',
    NETWORK: 'network'
  };

  /* 📌 الرسالة العربية لكل حالة — لازم تكون **محدّدة** */
  var MESSAGES = {
    ok: 'اتصال سليم',
    config_missing: 'ملف إعداد المعاينة مش موجود — المعاينة مقفولة ومفيش اتصال بالإنتاج',
    origin_missing: 'وجهة الـAPI للمعاينة مش مضبوطة — المعاينة مقفولة ومفيش اتصال بالإنتاج',
    origin_mismatch: 'وجهة الـAPI للمعاينة مختلفة عن اللي في ملف الإعداد — المعاينة مقفولة',
    production_origin_in_preview: 'المعاينة كانت هتروح على الإنتاج — اتمنعت. لازم سيرفر منفصل.',
    preview_origin_in_production: 'الإنتاج كان هيروح على سيرفر المعاينة — اتمنعت.',
    tunnel_origin: 'وجهة الـAPI نفق مؤقت — اتمنعت. النفق بيتموت وبيسيب خطأ 530.',
    origin_dns_error: 'خطأ في DNS لوجهة الـAPI — الدومين مش موجود (النفق انتهى)',
    origin_unreachable: 'وجهة الـAPI مش رادّة — الخدمة مش شغّالة',
    origin_blocked: 'الطلب اتمنع عشان وجهة الـAPI',
    network: 'الشبكة ضعيفة — جاوب تاني'
  };

  /* ⛔ مضيفات الإنتاج — ممنوعة في المعاينة */
  var PRODUCTION_HOSTS = [
    'octashares.com',
    'www.octashares.com',
    'octa-prices-production-4ccb.up.railway.app'
  ];

  /* ⛔ لواحق الأنفاق المؤقتة — ممنوعة في الإنتاج والمعاينة */
  var TUNNEL_SUFFIXES = [
    '.trycloudflare.com',
    '.ngrok.io',
    '.ngrok-free.app',
    '.loca.lt',
    '.serveo.net',
    '.localhost.run',
    '.bore.pub'
  ];

  var CONFIG_PATH = '/assets/config/preview.json';
  var BANNER_ID = 'octa-origin-banner';

  /* ══════════════════════════════════════════════════════════════
   *  🧰 أدوات صغيرة
   *  ══════════════════════════════════════════════════════════════ */
  function str(s) { return String(s == null ? '' : s).trim(); }

  /* 📌 اسم المضيف من أي عنوان (نسبي ⇒ نفس الأصل ⇒ '') */
  function hostOf(url) {
    var s = str(url);
    if (!s) return '';
    if (s.charAt(0) === '/') return '';
    try {
      var u = new URL(s);
      return str(u.hostname).toLowerCase();
    } catch (e) {
      var m = s.match(/^https?:\/\/([^\/:?#]+)/i);
      return m ? str(m[1]).toLowerCase() : '';
    }
  }

  /* 📌 تنظيف العنوان (نشيل الشرطة الأخيرة) */
  function normalizeBase(url) {
    var s = str(url);
    if (!s) return '';
    if (s.charAt(0) === '/') return '';
    s = s.replace(/\/+$/, '');
    return s;
  }

  /* 📌 العنوان المطلق ده subrange ولا لأ؟ */
  function _endsWith(host, suffix) {
    var h = str(host).toLowerCase();
    var s = str(suffix).toLowerCase();
    if (!h || !s) return false;
    if (h === s) return true;
    if (s.charAt(0) === '.') return h.length > s.length && h.slice(-s.length) === s;
    return h.length > s.length && h.slice(-(s.length + 1)) === '.' + s;
  }

  /* ══════════════════════════════════════════════════════════════
   *  🔎 تصنيف المضيف
   *  ══════════════════════════════════════════════════════════════ */
  function isProductionHost(host, config) {
    var h = str(host).toLowerCase();
    if (!h) return false;
    var list = PRODUCTION_HOSTS.slice();
    try {
      if (config && config.forbidden && config.forbidden.hosts) {
        list = list.concat(config.forbidden.hosts);
      }
      if (config && config.production && config.production.hosts) {
        list = list.concat(config.production.hosts);
      }
    } catch (e) { }
    for (var i = 0; i < list.length; i++) {
      if (_endsWith(h, list[i])) return true;
    }
    return false;
  }

  function isTunnelHost(host, config) {
    var h = str(host).toLowerCase();
    if (!h) return false;
    var list = TUNNEL_SUFFIXES.slice();
    try {
      if (config && config.forbidden && config.forbidden.hostSuffixes) {
        list = list.concat(config.forbidden.hostSuffixes);
      }
    } catch (e) { }
    for (var i = 0; i < list.length; i++) {
      var s = str(list[i]).toLowerCase();
      if (!s) continue;
      if (s.charAt(0) !== '.') s = '.' + s;
      if (_endsWith(h, s)) return true;
    }
    return false;
  }

  /* ══════════════════════════════════════════════════════════════
   *  🎭 وضع التشغيل — معاينة ولا إنتاج؟
   *  ══════════════════════════════════════════════════════════════ */
  function detectMode(env, config) {
    var e = env || {};
    var m = str(e.mode).toLowerCase();
    if (m === 'production' || m === 'preview') return m;
    var h = str(e.hostname).toLowerCase();
    var hosts = PRODUCTION_HOSTS.slice();
    try {
      if (config && config.production && config.production.hosts) {
        hosts = hosts.concat(config.production.hosts);
      }
    } catch (x) { }
    for (var i = 0; i < hosts.length; i++) {
      if (h && _endsWith(h, hosts[i])) return 'production';
    }
    return 'preview';
  }

  /* ══════════════════════════════════════════════════════════════
   *  🎯 الوجهة الفعّالة
   *  ──────────────────────────────────────────────────────────────
   *  📌 من فين؟ بالترتيب:
   *     ① origin جاي من العامل (window.OCTA_API_ORIGIN) — الأ truth.
   *     ② أول عنصر في window.OCTA_DIRECT_LIST (الـworker بيحقنه).
   *     ③ العقدة (assets/config/preview.json) — المصدر في المستودع.
   *  📌 لو (١) و(٣) مختلفين ⇒ تعارض ⇒ نقفل (مفيش تخمين).
   *  ══════════════════════════════════════════════════════════════ */
  function resolveOrigin(opts) {
    var o = opts || {};
    var mode = o.mode === 'production' ? 'production' : 'preview';
    var config = o.config || null;
    var runtime = normalizeBase(o.runtimeOrigin);
    var pinned = '';
    try {
      if (config && config[mode] && config[mode].apiBaseUrl) {
        pinned = normalizeBase(config[mode].apiBaseUrl);
      }
    } catch (e) { }
    var mismatch = !!(runtime && pinned && runtime !== pinned);
    return {
      origin: runtime || pinned,
      runtime: runtime,
      pinned: pinned,
      mismatch: mismatch,
      source: runtime ? 'runtime' : (pinned ? 'config' : 'none')
    };
  }

  /* ══════════════════════════════════════════════════════════════
   *  🚦 الحكم — هذا هو مصدر الحقيقة الوحيد في الواجهة
   *  ══════════════════════════════════════════════════════════════ */
  function evaluateOrigin(opts) {
    var o = opts || {};
    var mode = o.mode === 'production' ? 'production' : 'preview';
    var config = o.config || null;
    var r = resolveOrigin({ mode: mode, config: config, runtimeOrigin: o.runtimeOrigin });
    var origin = r.origin;
    var host = hostOf(origin);
    var res = {
      ok: false,
      code: CODES.OK,
      mode: mode,
      origin: origin,
      host: host,
      pinned: r.pinned,
      runtime: r.runtime,
      source: r.source,
      mismatch: r.mismatch,
      message: ''
    };

    function fail(code) {
      res.ok = false;
      res.code = code;
      res.message = MESSAGES[code] || MESSAGES.origin_blocked;
      return res;
    }

    if (mode === 'preview') {
      /* ⛔ المعاينة: من غير عقدة ⇒ نقفل (fail closed) */
      if (!config) return fail(CODES.CONFIG_MISSING);
      /* ⛔ من غير وجهة ⇒ نقفل — مفيش رجوع للإنتاج أبداً */
      if (!origin) return fail(CODES.ORIGIN_MISSING);
      /* ⛔ تعارض بين العامل والعقدة ⇒ نقفل */
      if (r.mismatch) return fail(CODES.ORIGIN_MISMATCH);
      /* ⛔ المعاينة ⇒ ممنوعة من لمس الإنتاج */
      if (isProductionHost(host, config)) return fail(CODES.PRODUCTION_IN_PREVIEW);
      /* ⛔ نفق مؤقت ⇒ ممنوع (بيتموت وبيسيب 530) */
      if (isTunnelHost(host, config)) return fail(CODES.TUNNEL_ORIGIN);
      res.ok = true;
      res.code = CODES.OK;
      res.message = MESSAGES.ok;
      return res;
    }

    /* ── الإنتاج ──
       📌 الإنتاج بيتكلم مع نفس الأصل (الـworker) ⇒ وجهة نسبية = عادي.
       📌 بس لو لقى وجهة المعاينة أو نفق ⇒ نقفل. */
    var previewPinned = '';
    try {
      if (config && config.preview && config.preview.apiBaseUrl) {
        previewPinned = hostOf(config.preview.apiBaseUrl);
      }
    } catch (e) { }
    if (host) {
      if (previewPinned && host === previewPinned) return fail(CODES.PREVIEW_IN_PRODUCTION);
      if (isTunnelHost(host, config)) return fail(CODES.TUNNEL_ORIGIN);
    }
    res.ok = true;
    res.code = CODES.OK;
    res.message = MESSAGES.ok;
    return res;
  }

  /* ══════════════════════════════════════════════════════════════
   *  🩺 فحص الوجهة — **قراءة بس** (مفيش أي كتابة)
   *  ──────────────────────────────────────────────────────────────
   *  📌 ① DNS: لو المضيف مش موجود (NXDOMAIN) ⇒ «خطأ DNS / نفق انتهى».
   *  📌 ② /api/health: لو مش رادّ ⇒ «الوجهة مش موصولة».
   *  📌 الفحص ما بيمنعش نداءات الـAPI — هو تشخيص بس.
   *  ══════════════════════════════════════════════════════════════ */
  function defaultResolve(host) {
    var h = str(host).toLowerCase();
    if (!h) return Promise.resolve({ code: 'unknown' });
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
      return Promise.resolve({ code: 'ip', addresses: [h] });
    }
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
      return Promise.resolve({ code: 'unknown' });
    }
    var f = window.OCTA_RAW_FETCH || window.fetch;
    var url = 'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(h) + '&type=A';
    var opt = { cache: 'no-store', headers: { 'Accept': 'application/dns-json' } };
    try {
      if (typeof AbortController !== 'undefined') {
        var ctrl = new AbortController();
        opt.signal = ctrl.signal;
        setTimeout(function () { try { ctrl.abort(); } catch (e) { } }, 4000);
      }
    } catch (e) { }
    return f.call(window, url, opt).then(function (r) {
      if (!r || !r.ok) return { code: 'unknown' };
      return r.json().then(function (j) {
        var st = Number(j && j.Status);
        if (st === 3) return { code: 'nxdomain' };
        if (st === 0) {
          var ans = (j && j.Answer) ? j.Answer : [];
          var out = [];
          for (var i = 0; i < ans.length; i++) {
            if (ans[i] && ans[i].data) out.push(String(ans[i].data));
          }
          return { code: 'ok', addresses: out };
        }
        return { code: 'unknown' };
      });
    }).catch(function () { return { code: 'unknown' }; });
  }

  function defaultHealth(origin, deps) {
    var d = deps || {};
    var path = d.healthPath || '/api/health';
    /* 📌 الفحص بيتم على **نفس الأصل** (الـworker بيوجّه /api/* للوجهة)
       📌 ليه؟ لأن المتصفح بيمنع قراءة ردود النطاقات التانية (CORS)
       ⛌ فالفحص المباشر كان هيبقى «مش راد» وهو شغال أصلاً.
       📌 كده الفحص بيمرّ بنفس السلسلة اللي بتستخدمها الواجهة فعلياً. */
    var url = d.healthUrl || path;
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
      return Promise.resolve({ ok: false, status: 0, error: 'no-fetch' });
    }
    var f = window.OCTA_RAW_FETCH || window.fetch;
    var opt = { method: 'GET', cache: 'no-store', credentials: 'same-origin' };
    try {
      if (typeof AbortController !== 'undefined') {
        var ctrl = new AbortController();
        opt.signal = ctrl.signal;
        setTimeout(function () { try { ctrl.abort(); } catch (e) { } }, d.timeoutMs || 4000);
      }
    } catch (e) { }
    return f.call(window, url, opt).then(function (r) {
      var st = (r && r.status) || 0;
      if (st >= 200 && st < 300) {
        return { ok: true, status: st, url: url };
      }
      /* 📌 503 {why:'api_unreachable'} = العامل لقى الوجهة ميتة */
      return r.text().then(function (txt) {
        var why = '';
        try { why = String((JSON.parse(txt || '{}') || {}).why || ''); } catch (e) { why = ''; }
        return { ok: false, status: st, url: url, why: why };
      }, function () {
        return { ok: false, status: st, url: url };
      });
    }).catch(function (e) {
      return { ok: false, status: 0, url: url, error: str((e && e.message) || e) };
    });
  }

  function probeOrigin(origin, deps) {
    var d = deps || {};
    var resolve = d.resolve || defaultResolve;
    var health = d.health || defaultHealth;
    var host = hostOf(origin);
    var out = {
      ok: false, code: CODES.OK, origin: normalizeBase(origin),
      host: host, dns: null, health: null, message: ''
    };
    if (!out.origin) {
      out.code = CODES.ORIGIN_MISSING;
      out.message = MESSAGES[out.code];
      return Promise.resolve(out);
    }
    return Promise.resolve(resolve(host)).then(function (dns) {
      out.dns = dns || { code: 'unknown' };
      if (out.dns.code === 'nxdomain') {
        out.code = CODES.ORIGIN_DNS_ERROR;
        out.message = MESSAGES[out.code];
        return out;
      }
      return Promise.resolve(health(out.origin, d)).then(function (h) {
        out.health = h || { ok: false };
        if (out.health.ok !== true) {
          out.code = CODES.ORIGIN_UNREACHABLE;
          out.message = MESSAGES[out.code];
          return out;
        }
        out.ok = true;
        out.code = CODES.OK;
        out.message = MESSAGES.ok;
        return out;
      });
    }).catch(function (e) {
      out.ok = false;
      out.code = CODES.ORIGIN_UNREACHABLE;
      out.message = MESSAGES[out.code];
      out.error = str((e && e.message) || e);
      return out;
    });
  }

  /* ══════════════════════════════════════════════════════════════
   *  🧾 تصنيف فشل الشبكة — عشان الرسالة تبقى **محدّدة**
   *  ──────────────────────────────────────────────────────────────
   *  📌 «الشبكة ضعيفة» (استجابة العتاد) غير «الوجهة مش موجودة»
   *     (خطأ في البنية) — والمستخدم لازم يعرف الفرق.
   *  ══════════════════════════════════════════════════════════════ */
  function classifyFailure(err, state) {
    try {
      if (err && err.octaGuard && err.octaGuard.code) return str(err.octaGuard.code);
    } catch (e) { }
    try {
      var st = state || {};
      var p = st.probe ? st.probe : st;
      if (p && p.ok === false && p.code && p.code !== CODES.NETWORK) return str(p.code);
    } catch (e) { }
    return CODES.NETWORK;
  }

  function messageFor(code) {
    var c = str(code);
    return MESSAGES[c] || MESSAGES[CODES.NETWORK];
  }

  /* ══════════════════════════════════════════════════════════════
   *  🧱 الحارس — الحالة + الفحص + البانر
   *  ══════════════════════════════════════════════════════════════ */
  function createGuard(opts) {
    var o = opts || {};
    var win = o.window || (typeof window !== 'undefined' ? window : null);
    var mode = o.mode === 'production' ? 'production' : 'preview';
    var config = o.config || null;
    var runtimeOrigin = o.runtimeOrigin || '';
    var verdict = o.verdict || evaluateOrigin({
      mode: mode, config: config, runtimeOrigin: runtimeOrigin
    });
    var probeState = null;
    var probePromise = null;

    function healthPath() {
      try {
        if (config && config[mode] && config[mode].healthPath) return config[mode].healthPath;
      } catch (e) { }
      return '/api/health';
    }

    function state() {
      return {
        mode: mode,
        config: config,
        verdict: verdict,
        probe: probeState,
        blocked: !verdict.ok,
        code: verdict.code
      };
    }

    /* 📌 الفحص — بياخدDependencies من المعايرة (للاختبارات) */
    function probe() {
      if (probePromise) return probePromise;
      if (!verdict.origin) {
        probeState = {
          ok: false, code: CODES.ORIGIN_MISSING,
          message: MESSAGES[CODES.ORIGIN_MISSING], origin: '', host: ''
        };
        return Promise.resolve(probeState);
      }
      probePromise = probeOrigin(verdict.origin, {
        resolve: o.resolve,
        health: o.health,
        healthPath: healthPath(),
        timeoutMs: o.timeoutMs
      }).then(function (p) {
        probeState = p;
        try { if (win) win.OCTA_ORIGIN_STATE = state(); } catch (e) { }
        if (!p.ok) showBanner({ code: p.code, message: p.message });
        return p;
      });
      return probePromise;
    }

    /* 📌 حكم **المضيف** بس (من غير حكم العقدة) — سريع وprecise
       📌 مستخدم في كل نداء (حتى الصور) ⇒ المعاينة ما تلمسش الإنتاج أبداً. */
    function checkHost(url) {
      var host = hostOf(url);
      if (!host) {
        return { ok: true, code: CODES.OK, message: MESSAGES.ok, mode: mode };
      }
      if (mode === 'preview') {
        if (isProductionHost(host, config)) {
          return {
            ok: false, code: CODES.PRODUCTION_IN_PREVIEW,
            message: MESSAGES[CODES.PRODUCTION_IN_PREVIEW], mode: mode
          };
        }
        if (isTunnelHost(host, config)) {
          return {
            ok: false, code: CODES.TUNNEL_ORIGIN,
            message: MESSAGES[CODES.TUNNEL_ORIGIN], mode: mode
          };
        }
        return { ok: true, code: CODES.OK, message: MESSAGES.ok, mode: mode };
      }
      /* ── الإنتاج ── */
      var previewPinned = '';
      try {
        if (config && config.preview && config.preview.apiBaseUrl) {
          previewPinned = hostOf(config.preview.apiBaseUrl);
        }
      } catch (e) { }
      if (previewPinned && host === previewPinned) {
        return {
          ok: false, code: CODES.PREVIEW_IN_PRODUCTION,
          message: MESSAGES[CODES.PREVIEW_IN_PRODUCTION], mode: mode
        };
      }
      if (isTunnelHost(host, config)) {
        return {
          ok: false, code: CODES.TUNNEL_ORIGIN,
          message: MESSAGES[CODES.TUNNEL_ORIGIN], mode: mode
        };
      }
      return { ok: true, code: CODES.OK, message: MESSAGES.ok, mode: mode };
    }

    /* 📌 كل نداء API يعدّي من هنا */
    function check(url) {
      if (!verdict.ok) {
        return { ok: false, code: verdict.code, message: verdict.message, mode: mode };
      }
      return checkHost(url);
    }

    /* 📌 نفس الحكم بس لوجهة مرشّحة (failover) */
    function allowOrigin(url) { return check(url); }

    /* 📌 البانر — واضح ولافت (مش console) */
    function showBanner(v) {
      if (!win || !win.document || !win.document.body) return null;
      var d = win.document;
      var el = d.getElementById(BANNER_ID);
      if (!el) {
        el = d.createElement('div');
        el.id = BANNER_ID;
        el.setAttribute('role', 'alert');
        el.setAttribute('aria-live', 'assertive');
        el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483000;' +
          'padding:10px 14px;font:700 14px/1.8 system-ui,-apple-system,sans-serif;' +
          'text-align:center;background:#7f1d1d;color:#fff;white-space:pre-wrap;' +
          'box-shadow:0 3px 14px rgba(0,0,0,.4)';
        d.body.appendChild(el);
      }
      var code = (v && v.code) ? str(v.code) : CODES.BLOCKED;
      var msg = (v && v.message) ? str(v.message) : messageFor(code);
      el.textContent = '⛔ ' + msg + ' — ' + code;
      try { el.setAttribute('data-octa-origin-code', code); } catch (e) { }
      try { d.documentElement.setAttribute('data-octa-origin', code); } catch (e) { }
      return el;
    }

    function hideBanner() {
      if (!win || !win.document) return;
      var el = win.document.getElementById(BANNER_ID);
      if (el && el.parentNode) el.parentNode.removeChild(el);
      try { win.document.documentElement.removeAttribute('data-octa-origin'); } catch (e) { }
    }

    function classify(err) { return classifyFailure(err, state()); }

    return {
      mode: mode,
      state: state,
      check: check,
      checkHost: checkHost,
      allowOrigin: allowOrigin,
      probe: probe,
      showBanner: showBanner,
      hideBanner: hideBanner,
      classify: classify,
      messageFor: messageFor,
      setConfig: function (c) {
        config = c;
        verdict = evaluateOrigin({ mode: mode, config: c, runtimeOrigin: runtimeOrigin });
        return verdict;
      },
      setVerdict: function (v) { verdict = v; return verdict; },
      getConfig: function () { return config; },
      getVerdict: function () { return verdict; }
    };
  }

  /* ══════════════════════════════════════════════════════════════
   *  📥 تحميل العقدة (قراءة بس)
   *  ══════════════════════════════════════════════════════════════ */
  function configPathOf(win) {
    var w = win || (typeof window !== 'undefined' ? window : null);
    try {
      if (w && w.OCTA_ORIGIN_CONFIG) return str(w.OCTA_ORIGIN_CONFIG);
    } catch (e) { }
    return CONFIG_PATH;
  }

  function loadConfig(win, path) {
    var w = win || (typeof window !== 'undefined' ? window : null);
    var p = path || configPathOf(w);
    if (!w || typeof w.fetch !== 'function') return Promise.resolve(null);
    var f = w.OCTA_RAW_FETCH || w.fetch;
    return f.call(w, p, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    }).then(function (r) {
      if (!r || !r.ok) return null;
      return r.json();
    }).then(function (j) {
      if (!j || typeof j !== 'object') return null;
      return j;
    }).catch(function () { return null; });
  }

  /* 📌 الوجهة اللي العامل حقنها (لو موجودة) */
  function runtimeOriginOf(win) {
    var w = win || (typeof window !== 'undefined' ? window : null);
    if (!w) return '';
    try {
      if (w.OCTA_API_ORIGIN) return normalizeBase(w.OCTA_API_ORIGIN);
    } catch (e) { }
    try {
      var list = w.OCTA_DIRECT_LIST;
      if (list && list.length && list[0] && list[0].url) {
        return normalizeBase(list[0].url);
      }
    } catch (e) { }
    return '';
  }

  /* ══════════════════════════════════════════════════════════════
   *  🚀 التشغيل التلقائي
   *  ══════════════════════════════════════════════════════════════ */
  function init(win, opts) {
    var w = win || (typeof window !== 'undefined' ? window : null);
    if (!w) return Promise.resolve(null);
    var o = opts || {};
    var hostname = '';
    try { hostname = str(w.location && w.location.hostname).toLowerCase(); } catch (e) { hostname = ''; }
    var mode = detectMode({ hostname: hostname, mode: w.OCTA_MODE }, null);
    var runtimeOrigin = runtimeOriginOf(w);

    /* ── الإنتاج: مافيش blockade على أول نداء.
       📌 العقدة بتتحمّل بعدين (تشخيص بس) — عشان مناشيّطش الإنتاج. */
    if (mode === 'production') {
      var v0 = evaluateOrigin({ mode: mode, config: null, runtimeOrigin: runtimeOrigin });
      var g0 = createGuard({
        window: w, mode: mode, config: null, verdict: v0,
        runtimeOrigin: runtimeOrigin, resolve: o.resolve, health: o.health
      });
      loadConfig(w, configPathOf(w)).then(function (cfg) {
        if (!cfg) return;
        var v = evaluateOrigin({ mode: mode, config: cfg, runtimeOrigin: runtimeOrigin });
        g0.setConfig(cfg);
        g0.setVerdict(v);
        if (!v.ok) g0.showBanner(v);
      }).catch(function () { });
      return Promise.resolve(g0);
    }

    /* ── المعاينة: العقدة لازم تتحمّل **قبل** أي نداء ⇒ fail closed */
    return loadConfig(w, configPathOf(w)).then(function (cfg) {
      var m2 = detectMode({ hostname: hostname, mode: w.OCTA_MODE }, cfg);
      var v2 = evaluateOrigin({ mode: m2, config: cfg, runtimeOrigin: runtimeOrigin });
      var g2 = createGuard({
        window: w, mode: m2, config: cfg, verdict: v2,
        runtimeOrigin: runtimeOrigin, resolve: o.resolve, health: o.health
      });
      if (!v2.ok) {
        g2.showBanner(v2);
        return g2;
      }
      g2.probe().then(function () { return g2; });
      return g2;
    }, function () {
      var v3 = evaluateOrigin({ mode: mode, config: null, runtimeOrigin: runtimeOrigin });
      var g3 = createGuard({
        window: w, mode: mode, config: null, verdict: v3, runtimeOrigin: runtimeOrigin
      });
      g3.showBanner(v3);
      return g3;
    });
  }

  function autoInstall(win) {
    var w = win || (typeof window !== 'undefined' ? window : null);
    if (!w) return null;
    if (w.OCTA_ORIGIN_GUARD_READY) return w.OCTA_ORIGIN_GUARD_READY;
    var ready = init(w).then(function (g) {
      try { w.OCTA_ORIGIN_GUARD = g; } catch (e) { }
      try { if (g) w.OCTA_ORIGIN_STATE = g.state(); } catch (e) { }
      return g;
    }, function () { return null; });
    try { w.OCTA_ORIGIN_GUARD_READY = ready; } catch (e) { }
    return ready;
  }

  return {
    CODES: CODES,
    MESSAGES: MESSAGES,
    PRODUCTION_HOSTS: PRODUCTION_HOSTS,
    TUNNEL_SUFFIXES: TUNNEL_SUFFIXES,
    CONFIG_PATH: CONFIG_PATH,
    BANNER_ID: BANNER_ID,
    hostOf: hostOf,
    normalizeBase: normalizeBase,
    isProductionHost: isProductionHost,
    isTunnelHost: isTunnelHost,
    detectMode: detectMode,
    resolveOrigin: resolveOrigin,
    evaluateOrigin: evaluateOrigin,
    probeOrigin: probeOrigin,
    classifyFailure: classifyFailure,
    messageFor: messageFor,
    createGuard: createGuard,
    loadConfig: loadConfig,
    runtimeOriginOf: runtimeOriginOf,
    configPathOf: configPathOf,
    init: init,
    autoInstall: autoInstall
  };
});
