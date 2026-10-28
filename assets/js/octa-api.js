/* ═══════════════════════════════════════════════════════════════
  🔌 مدير السيرفرات + توكن كل المسارات
  ──────────────────────────────────────────────────────────────
  🎯 مش بنحتاج نغيّر الكود لو نقلنا لسيرفر جديد — بدّل السطر ده وخلاص

  ⛔⛔⛔ ٢١ أكتوبر ٢٠٢٦ — تغييران كبيرين:

  ① نفس الأصل (relative) ⇐ الـWorker مش بيقدر يقرا localStorage
     ⇒ لازم الجلسة تكون **كوكي** على دومين الموقع نفسه.
     ⇒ كل نداء لازم يطلع من نفس الأصل عشان الكوكي يوصل.
     ⛌ السيرفر المباشر (Railway) بقى **احتياطي** — بيستخدم
        بس لو الـWorker وقع (شبكة).

  ② التوكن بيبعت مع **كل** نداء /api/* — مش بس ٨ مسارات.
     ⛌ السبب: الباك بقى يقفل كل مسار بيانات ورا توكن
        (api_gate في update_prices.py) — فأي مسار مش مبعوت
        ليه توكن بيرجّع 401 والصفحة بتفتح فاضية.
     ⛌ المسارات المفتوحة (health · track · auth · logos) بتقبل
        التوكن كمان — الباك بيتجاهله، فمافيش ضرر.
  ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* 🎯 السيرفر المباشر — احتياطي لو الـWorker وقع */
  const SERVERS = [
  { name: 'railway', url: 'https://octa-prices-production-4ccb.up.railway.app', on: true },
  /* ↑ سيرفر احتياطي (Render مثلاً) — حطّه هنا وخلي on:true */
  /* { name: 'render',  url: 'https://octa-prices.onrender.com',  on: false } */
  ];

  /* نحفظ الـfetch الأصلي قبل ما نلفّه (لأن window.fetch بيتغيّر) */
  const ORIG_FETCH = (typeof window !== 'undefined' && window.fetch)
  ? window.fetch.bind(window) : null;
  if (!ORIG_FETCH) { /* مفيش fetch — نخرج بهدوء */ return; }

  let active = -1;  /* رقم السيرفر اللي شغال */
  let fails = {};   /* عدّاد فشل لكل سيرفر */

  function base() {
  if (active < 0) {
  for (let i = 0; i < SERVERS.length; i++) {
  if (SERVERS[i].on) { active = i; break; }
  }
  }
  return SERVERS[active >= 0 ? active : 0].url;
  }

  window.OCTADev = window.OCTADev || {};

  /* ⭐⭐⭐ نفس الأصل — ده مش تفصيل:
     الـWorker هو اللي بيقدّم صفحة البوابة، وهو بيفحص
     كوكي الجلسة. الكوكي لازم يكون على دومين الموقع
     عشان يوصل. ⇒ الـAPI base = '' (relative).
     ⛌ والاحتياطي (السيرفر المباشر) موجود تحت. */
  window.OCTA_API = '';
  window.OCTA_DIRECT = base();

  /* 🔄 بدّل السيرفر النشط */
  window.OCTAServer = {
  list: SERVERS,
  current: () => SERVERS[active >= 0 ? active : 0],
  /* لو السيرفر فشل n times → جرّب اللي بعده */
  failover: function () {
  fails[active] = (fails[active] || 0) + 1;
  for (let i = 0; i < SERVERS.length; i++) {
  if (!SERVERS[i].on || i === active) continue;
  active = i;
  window.OCTA_API = SERVERS[i].url;
  window.OCTA_DIRECT = SERVERS[i].url;
  console.warn('[OCTA] السيرفر الرئيسي واقع — تحوّل لـ', SERVERS[i].name);
  return true;
  }
  return false;
  },
  failed: (i) => fails[i || active] || 0,
  };

  /* ═══════════════════════════════════════════════════════════
  🔐 المسارات المفتوحة — دي مش محتاجة توكن
  ──────────────────────────────────────────────────────────────
  ⛔ ⛔ ⛔ أي مسار تاني (غير ده) محمي ورا توكن.
  ⛌ البصق: نفس قائمة الاستثناءات في update_prices.py
     (API_OPEN_PATHS + API_OPEN_PREFIXES).
  ═══════════════════════════════════════════════════════════ */
  const OPEN_PATHS = [
  '/api/health', '/api/track', '/api/logos', '/api/tvlogo'
  ];
  const OPEN_PREFIXES = [
  '/api/auth/', '/api/logos/', '/api/tvlogo/', '/api/admin/', '/api/tg-',
  /* 🛰️ الرادار الذكي — مفتوح زي /api/candles بالظبط
     (نفس بيانات الشموع + كون المرجع في ملف ثابت). */
  '/api/radar/'
  ];

  /* ⛔ الـfetch بتيجي برابط كامل (https://…) أو نسبي (/api/…)
  والمقارنة كانت على السلسلة نفسها، فindexOf كان -1 دايماً
  والتوكن ماتبعتش أصلاً. بنطلّع المسار بس ونقارن بيه. */
  function _pathOf(url) {
  const s = String(url || '').split('?')[0].split('#')[0];
  const i = s.indexOf('/api/');
  return i === -1 ? s : s.slice(i);
  }

  function _isOpen(path) {
  if (OPEN_PATHS.indexOf(path) !== -1) return true;
  for (let i = 0; i < OPEN_PREFIXES.length; i++) {
  if (path.indexOf(OPEN_PREFIXES[i]) === 0) return true;
  }
  return false;
  }

  function _token() {
  try { return localStorage.getItem('octa_token') || ''; } catch (e) { return ''; }
  }

  /* ═══════════════════════════════════════════════════════════
  ⭐⭐⭐ ٢٤ أكتوبر ٢٠٢٦ — ⭐ تمييز نداءاتنا عن أي URL خارجي
  ───────────────────────────────────────────────────────────
  ⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔
  📌 المشكلة: `indexOf('/api/')` كان بيعتبر أي URL فيه '/api/'
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
  📌 «نداء بتاعنا» — حتى لو URL خارجي!
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
  📌 ⇒ tradingview-widget.com/api/v1/quote كان بيتبعت للـRailway!
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
  📌 ⇒ (١) 405 من Railway (٢) CORS error (٣) ⛔⛔⛔ طلب لطرف ثالث
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
  📌 ✅ الحل: نديو على **أصل** الـURL + مثال على السيرفر المباشر.
  ═══════════════════════════════════════════════════════════ */
  function _isOurs(url) {
  const s = String(url || '');
  if (!s) return false;
  if (s.charAt(0) === '/') return true;         /* ⛌ نسبي ⇒ نداء بتاعنا */
  try {
  const u = new URL(s);
  if (u.origin === (location.origin || '')) return true;
  /* ⛌ السيرفر المباشر (الاحتياطي) — نداء بتاعنا برضه */
  const d = String(window.OCTA_DIRECT || '');
  if (d && u.href.indexOf(d) === 0) return true;
  } catch (e) { }
  return false;
  }

  /* ⭐ التوكن + الكوكي على كل نداء /api/
     ⛌ credentials: 'same-origin' عشان الكوكي HttpOnly يمشي مع
        الطلب — هو ده اللي يخلي الـWorker يقدر يفحص الجلسة. */
  function _withToken(url, opts) {
  if (!_isOurs(url)) return opts;
  if (String(url || '').indexOf('/api/') === -1) return opts;
  const o = opts || {};
  try {
  const h = new Headers(o.headers || {});
  const t = _token();
  if (t && !h.get('Authorization')) h.set('Authorization', 'Bearer ' + t);
  o.headers = h;
  if (!o.credentials) o.credentials = 'same-origin';
  } catch (e) {
  const t = _token();
  o.headers = Object.assign({}, o.headers || {},
  t ? { 'Authorization': 'Bearer ' + t } : {});
  if (!o.credentials) o.credentials = 'same-origin';
  }
  return o;
  }

  /* 🩺 لو الـWorker وقع → جرّب السيرفر المباشر */
  function _directUrl(s) {
  if (!_isOurs(s)) return s;
  const i = s.indexOf('/api/');
  if (i === -1) return s;
  return window.OCTA_DIRECT + s.slice(i);
  }

  /* 🩺 شغّل على السيرفر التاني لو الرئيسي واقع */
  const ORIG = ORIG_FETCH;
  window.fetch = function (url, opts) {
  const s = String(url || '');
  /* ⛌ URL خارجي (مش نداء بتاعنا) → يفضل زي ما هو */
  if (!_isOurs(s)) return ORIG.apply(this, arguments);
  /* ⛌ مش /api/ → يفضل زي ما هو */
  if (s.indexOf('/api/') === -1) return ORIG.apply(this, arguments);

  const opt = _withToken(s, opts);

  return ORIG.call(this, s, opt)
  .then(function (r) {
  /* السيرفر رجّع error حقيقي (مش شبكة) — مفيش failover */
  if (r.status >= 500) window.OCTAServer.failover();
  /* ⛔ ⛔ ⛔ ٤٠١ معناها «التوكن مش صالح» مش «الموقع وقع».
  ⛌ أي طلب واحد بيرجع ٤٠١ بيطرد المستخدم فوراً — فبنكتفي
  ⛌ بإننا نلاحظ ونكمّل عادي. البوابة لوحدها تتحقق. */
  if (r.status === 401 && !_isOpen(_pathOf(s))) {
  try { console.warn('[OCTA] ' + _pathOf(s) + ' محمي — توكن ناقص'); }
  catch (e) { }
  }
  return r;
  })
  .catch(function (e) {
  /* شبكة — جرّب السيرفر المباشر */
  const nu = _directUrl(s);
  if (nu === s) throw e;
  window.OCTAServer.failover();
  try { console.warn('[OCTA]_primary failed — trying direct API'); } catch (x) { }
  return ORIG.call(window, nu, _withToken(nu, opts));
  });
  };

/* ════════════════════════════════════════════════════════════════
 🌐 ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐ octaFetch: fetch بتوكن (لكل المسارات)
 ────────────────────────────────────────────────────────────────
 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌
 📌 المشكلة: `octa-api.js` كان بيلفّ `window.fetch` — بس الّف
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ بيحط التوكن بس لو الـURL نسبي (نفس الأصل).
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
 📌 ⛌ ⛌ ⇒ الملفات التانية (octa-pages · octa-config …) بتعمل
 📌 ⛌ ⛌ fetch **مباشرة** ⇒ مفيش Authorization ⇒ 401 على
 📌 ⛌ ⛌ المسارات المحمية (intelligence · ranking · strategies).
 📌 ✅ الحل: helper مشترك — كل الـfetch تمر عليه.
 ════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
 🗂️ ⭐⭐⭐ ٢٦ أكتوبر ٢٠٢٦ — ⭐⭐⭐ كاش بسيط للطلبات الغالية
 ────────────────────────────────────────────────────────────────
 📌 المشكلة: الصفحة كانت بتطلب /api/intelligence و /api/explain
 📌 و /api/technical **٦ مرات لنفس السهم** (كل نداء ← ٣ مسارات)
 📌 ⛌ ⛌⛌ ⛌⛌⛌ ١٨ نداء غالي = فوق حد الـrate limit (١٥/دقيقة)
 📌 ⛌ ⛌⛌ ⛌⛌⛌ ⇒ 429 ⇒ «تعذر تحميل التحليل» للمستخدم.
 📌 📌 السبب: /api/engine-weights بيتطلب ٦ مرات (لما البوابة تجهز
 📌 📌 التوكن) وكل نداء بيلفّي حدث octa:weights ⇒ إعادة رسم الكارت.
 📌 ✅ الحل: كاش في المتصفح للطلبات الغالية (TTL قصير).
 📌 ⛌⛌⛌ الـcache busting (?_=Date.now) بيخلي الرابط مختلف كل مرة
 📌 ⛌⛌⛌ ⇒ بنمسح الـquery من الـkey عشان نلاقي التكرار.
 ════════════════════════════════════════════════════════════════ */
var OCTA_CACHE = {};        /* url(من غير query) → {t, body, ct} */
var OCTA_CACHE_TTL = 20000; /* ٢٠ ثانية — كفاية للتجربة، ومنع للتكرار */
var OCTA_CACHE_PATHS = ['/api/intelligence/', '/api/explain/', '/api/technical/'];

function _octaCacheKey(s) {
  try {
    var u = String(s || '');
    var i = u.indexOf('?');
    if (i >= 0) u = u.slice(0, i);
    return u;
  } catch (e) { return String(s || ''); }
}

function _octaIsCacheable(s, method) {
  try {
    if (method && String(method).toUpperCase() !== 'GET') return false;
    var u = String(s || '');
    for (var i = 0; i < OCTA_CACHE_PATHS.length; i++) {
      if (u.indexOf(OCTA_CACHE_PATHS[i]) >= 0) return true;
    }
  } catch (e) { }
  return false;
}

window.octaFetch = function (url, opts) {
  var o = opts || {};
  var s = '';
  try {
    s = String(url || '');
    if (s.indexOf('/api/') >= 0) {
      var h = new Headers(o.headers || {});
      var t = '';
      try { t = localStorage.getItem('octa_token') || ''; } catch (e) { }
      if (t && !h.get('Authorization')) h.set('Authorization', 'Bearer ' + t);
      o.headers = h;
      if (!o.credentials) o.credentials = 'include';
    }
  } catch (e) { }

  /* ⛔⛔⛔ الكاش — المسارات الغالية بس (مش الأسعار، عشان تبقى حيّة) */
  if (_octaIsCacheable(s, o && o.method)) {
    var key = _octaCacheKey(s);
    var hit = OCTA_CACHE[key];
    var now = Date.now();
    if (hit && (now - hit.t) < OCTA_CACHE_TTL) {
      try {
        /* ⚠️ بنعيد Response جديد من النص المحفوظ — مش clone.
        📌 الـclone ممكن يفشل لو المستهلك قرا الـbody قبلين. */
        return Promise.resolve(new Response(hit.body, {
          status: 200,
          headers: { 'Content-Type': hit.ct || 'application/json' }
        }));
      } catch (e) { }
    }
    return window.fetch(url, o).then(function (resp) {
      try {
        if (resp && resp.ok) {
          /* ⚠️ لازم الاستنساخ يتعمل **قبل** ما نرجع الرد للمستهلك */
          var clone = resp.clone();
          var ct = '';
          try { ct = resp.headers.get('Content-Type') || ''; } catch (e) { }
          clone.text().then(function (body) {
            OCTA_CACHE[key] = { t: Date.now(), body: body, ct: ct };
          }).catch(function () { });
        }
      } catch (e) { }
      return resp;
    });
  }
  return window.fetch(url, o);
};

})();
