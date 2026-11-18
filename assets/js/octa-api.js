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

  /* 🎯 السيرفر المباشر — احتياطي لو الـWorker وقع
     🐞🛡️ ١٥ نوفمبر ٢٠٢٦ (دفعة الأمان ٠٢) — ⛔ قابل للضبط من الـworker ⬇️
     📌 ⬇️ المعاينة: الـworker بيحقن القائمة ⇒ ما يلمسش الإنتاج ⬇️ ⬇️
     📌 ⬇️ (لو الـworker وقع أثناء اختبار معزول) ⬇️ ⬇️
     📌 ⬇️ الإنتاج: من غير حقن ⇒ القائمة الافتراضية (زي ما كان) ⬇️ ⬇️ */
  /* ⛔⛔⛔ ١٥ نوفمبر ٢٠٢٦ (المراجعة الأمنية) — وضع الإغلاق الآمن ⬇️
     🐞 🐞 🐞 المعاينة بتحطّ `window.OCTA_FAIL_CLOSED=1` ⬇️⬇️
     🐞 🐞 🐞 القائمة الفاضية = ممنوع الاتصال بالإنتاج ⬇️⬇️
     🐞 🐞 🐞 المعاينة من غير وجهة ⇒ الواجهة ما تتصلش بالإنتاج ⬇️⬇️
     🐞 🐞 🐞 الإنتاج: من غير العلامة ⇒ السلوك القديم (الاحتياطي) ⬇️⬇️ */
  const FAIL_CLOSED = !!(window.OCTA_FAIL_CLOSED);
  const SERVERS = (window.OCTA_DIRECT_LIST && window.OCTA_DIRECT_LIST.length)
  ? window.OCTA_DIRECT_LIST
  : (FAIL_CLOSED ? [] : [
  { name: 'railway', url: 'https://octa-prices-production-4ccb.up.railway.app', on: true },
  /* ↑ سيرفر احتياطي (Render مثلاً) — حطّه هنا وخلي on:true */
  /* { name: 'render',  url: 'https://octa-prices.onrender.com',  on: false } */
  ]);

  /* نحفظ الـfetch الأصلي قبل ما نلفّه (لأن window.fetch بيتغيّر) */
  const ORIG_FETCH = (typeof window !== 'undefined' && window.fetch)
  ? window.fetch.bind(window) : null;
  if (!ORIG_FETCH) { /* مفيش fetch — نخرج بهدوء */ return; }
  /* ⭐⭐⭐ ١٤ نوفمبر ٢٠٢٦ — ⭐ الـfetch الخام متاح للصفحات الحرجة
     📌 السبب (مقيس): البوابة كانت بتطلب /api/auth/me **ورا** طابور
     ~٣٥ طلب تاني ⇒ استنّى ٤٫٥ ثانية ⇒ «مهلة السماح» فتحت الشاشة
     ⇒ المستخدم قعد قدام البوابة ٥٫٤ ثانية ⛔.
     📌 ✅ الحل: طلب التحقق من الحساب يخرج **مباشرة** (من غير الخانق
     ولا الطابور) ⇒ البوابة تفتح في ~٠٫٣ ثانية.
     📌 ⚠️ الطلب لازم يكون GET عادي والترويسات بتتحط بنفسها. */
  try { window.OCTA_RAW_FETCH = ORIG_FETCH; } catch (e) { }
  /* 🛡️ R23 — الـfetch الخام *الأصلي* (مفيش حارس عليه)
     📌 الحارس نفسه بيحتاجه (تحميل العقدة + فحص الصحة) ⇒ لازم يكون
     📌 متاح قبل ما الحارس يلتفّ على OCTA_RAW_FETCH. */
  try { window.OCTA_ORIGIN_FETCH = ORIG_FETCH; } catch (e) { }

  /* ════════════════════════════════════════════════════════════════
   🛡️ الجولة ٢٣ (R23) — حارس الوجهة (fail-closed)
   ────────────────────────────────────────────────────────────────
   📌 المشكلة (مقاس): المعاينة كانت بتروّح على نفق ميت ⇒ 530/1016
      ⇒ الواجهة فاكرة إن «الباسورد غلط» ⇒ المستخدم بيتّهم بإيمه.
   📌 ⛔ القاعدة: المعاينة ⇒ ممنوع تلمس الإنتاج. ومفيش رجوع صامت.
   📌 الحارس بيتحمّل من هنا (مش من index.html) ⇒ صفحة واحدة تتغير.
   📌 ⛔ الإنتاج: مافيش blockade — نفس الأصل (الـworker) زي ما هو.
   ════════════════════════════════════════════════════════════════ */
  const OCTA_GUARD_SRC = '/assets/js/octa-origin-guard.js';

  /* 📌 مضيفات الإنتاج — لازم تبقى مطابقة لـ octa-origin-guard.js
     (فيه اختبار بيقارن الاتنين ⇒ مفيش انحراف بصمت). */
  const OCTA_PROD_HOSTS = [
    'octashares.com',
    'www.octashares.com',
    'octa-prices-production-4ccb.up.railway.app'
  ];

  function _octaHostOf(u) {
    try {
      const s = String(u || '');
      if (!s) return '';
      if (s.charAt(0) === '/') return '';
      const m = s.match(/^https?:\/\/([^\/:?#]+)/i);
      return m ? String(m[1]).toLowerCase() : '';
    } catch (e) { return ''; }
  }

  function _octaIsProdHost(h) {
    const x = String(h || '').toLowerCase();
    if (!x) return false;
    for (let i = 0; i < OCTA_PROD_HOSTS.length; i++) {
      const p = OCTA_PROD_HOSTS[i];
      if (x === p) return true;
      if (x.length > p.length && x.slice(-(p.length + 1)) === '.' + p) return true;
    }
    return false;
  }

  /* 📦 المعاينة = أي حاجة مش على دومين الإنتاج */
  function _octaPreviewMode() {
    try {
      const h = String((location && location.hostname) || '').toLowerCase();
      if (!h) return true;          /* ⛔ مفيش دومين ⇒ نقفل */
      return !_octaIsProdHost(h);
    } catch (e) { return true; }
  }

  /* 📌 لواحق الأنفاق المؤقتة (لازم تطابق الـguard) */
  const OCTA_TUNNEL_SUFFIXES = ['.trycloudflare.com', '.ngrok.io',
    '.ngrok-free.app', '.loca.lt', '.serveo.net', '.localhost.run', '.bore.pub'];

  function _octaIsTunnelHost(h) {
    const x = String(h || '').toLowerCase();
    if (!x) return false;
    for (let i = 0; i < OCTA_TUNNEL_SUFFIXES.length; i++) {
      const s = OCTA_TUNNEL_SUFFIXES[i];
      if (x.length > s.length && x.slice(-s.length) === s) return true;
    }
    return false;
  }

  /* 📌 «شبه المعاينة» — ممنوع في الإنتاج (حماية قبل ما الحارس يجهز) */
  function _octaIsPreviewLike(h) {
    const x = String(h || '').toLowerCase();
    if (!x) return false;
    if (x.indexOf('preview') > -1) return true;
    return _octaIsTunnelHost(x);
  }

  /* 📌 الحارس (لو محمّل) */
  function _guardInstance() {
    try { return window.OCTA_ORIGIN_GUARD || null; } catch (e) { return null; }
  }

  /* 📌 حكم **المضيف** (سريع · متزامن) — شبكة الأمان
     ⛔ المعاينة ⇒ ممنوعة من الإنتاج والأنفاق.
     ⛔ الإنتاج  ⇒ ممنوع من المعاينة والأنفاق. */
  function _guardHostVerdict(url) {
    try {
      const host = _octaHostOf(url);
      if (!host) return null;
      if (_octaPreviewMode()) {
        if (_octaIsProdHost(host) || _octaIsTunnelHost(host)) {
          return {
            ok: false, code: 'production_origin_in_preview',
            message: 'المعاينة ممنوعة من الإنتاج ومن الأنفاق المؤقتة'
          };
        }
      } else if (_octaIsPreviewLike(host)) {
        return {
          ok: false, code: 'preview_origin_in_production',
          message: 'الإنتاج ممنوع من وجهة المعاينة ومن الأنفاق المؤقتة'
        };
      }
    } catch (e) { }
    try {
      const g = _guardInstance();
      if (g && typeof g.checkHost === 'function') {
        const v = g.checkHost(url);
        if (v && v.ok === false) return v;
      }
    } catch (e) { }
    return null;
  }

  /* 📌 حكم الوجهة (للفشل التلقائي) — حكم المضيف + حكم العقدة */
  function _guardAllow(url) {
    const hv = _guardHostVerdict(url);
    if (hv && hv.ok === false) return hv;
    try {
      const g = _guardInstance();
      if (g && typeof g.allowOrigin === 'function') return g.allowOrigin(url);
    } catch (e) { }
    return null;
  }

  /* 🛡️ R23 — ⛔ جلسة اتباطلت (401 والتوكن كان مبعوت) ⇒ حالة انتهاء صريحة
     📌 ⛔ زائر مجهول (مافيش توكن مبعوت) ⇒ ما نعملش حاجة. */
  function _octaSessionExpired(url, opt) {
    try {
      let had = false;
      try {
        const h = opt && opt.headers;
        if (h && typeof h.get === 'function') had = !!h.get('Authorization');
      } catch (e) { had = false; }
      if (!had) return;
      if (typeof window.OCTAAuthFail === 'function') window.OCTAAuthFail(_pathOf(url));
    } catch (e) { }
  }

  function _guardBlock(v) {
    /* ⛔ نمنع الطلب ونرجّع خطأ واضح (مش 530 ولا «حصل خطأ») */
    const msg = (v && v.message) ? String(v.message) : 'الطلب اتمنع';
    const code = (v && v.code) ? String(v.code) : 'origin_blocked';
    try {
      const g = _guardInstance();
      if (g && typeof g.showBanner === 'function') g.showBanner(v);
    } catch (e) { }
    const err = new Error(msg);
    try { err.octaGuard = { code: code, message: msg }; } catch (e) { }
    return Promise.reject(err);
  }

  /* 📦 تحميل سكربت الحارس (مرة واحدة) */
  function _guardLoad() {
    if (window.OCTA_ORIGIN_GUARD_LOAD) return window.OCTA_ORIGIN_GUARD_LOAD;
    const p = new Promise(function (resolve) {
      try {
        const s = document.createElement('script');
        s.src = OCTA_GUARD_SRC;
        s.async = false;
        s.onload = function () { resolve(window.OCTA_ORIGIN_GUARD_READY || null); };
        s.onerror = function () { resolve(null); };
        (document.head || document.documentElement).appendChild(s);
      } catch (e) { resolve(null); }
    });
    window.OCTA_ORIGIN_GUARD_LOAD = p;
    return p;
  }

  /* 📦 الحارس جاهز؟ (بيستنى التهيئة — مش بس تحميل الملف) */
  function _guardReady() {
    if (window.OCTA_ORIGIN_GUARD_READY) return window.OCTA_ORIGIN_GUARD_READY;
    return _guardLoad();
  }

  try { window.OCTA_ORIGIN_GUARD_LOAD = _guardLoad(); } catch (e) { }

  /* ════════════════════════════════════════════════════════════════
   🛡️ R23 — الـfetch الخام كمان يعدّي من الحارس (مافيش طريق محيط)
   ────────────────────────────────────────────────────────────────
   📌 البوابة بتستخدم الـfetch الخام عشان تتجاوز الخانق
   (استجابة /api/auth/me لازم تيجي بسرعة).
   ⛔ قبل الإصلاح: ده كان **مسار محيط** — الطلب بيعدّي من غير حكم!
   📌 بعد الإصلاح: الـfetch الخام محاط بالحارس زي أي نداء تاني.
   📌 الحارس نفسه بيستخدم `OCTA_ORIGIN_FETCH` (الخام الأصلي) عشان
   تحميل العقدة وفحص الصحة ميتقفلوش بنفس الحكم.
   ════════════════════════════════════════════════════════════════ */
  try {
   const _RAW = ORIG_FETCH;
   window.OCTA_RAW_FETCH = function (url, opts) {
    const s = String(url || '');
    const g = _guardInstance();
    if (g && typeof g.check === 'function') {
     const v = g.check(s);
     if (v && v.ok === false) return _guardBlock(v);
     return _RAW.apply(window, arguments);
    }
    return _guardReady().then(function (gg) {
     if (gg && typeof gg.check === 'function') {
      const v = gg.check(s);
      if (v && v.ok === false) return _guardBlock(v);
     }
     return _RAW.apply(window, arguments);
    });
   };
  } catch (e) { }

  let active = -1;  /* رقم السيرفر اللي شغال */
  let fails = {};   /* عدّاد فشل لكل سيرفر */

  function base() {
  if (active < 0) {
  for (let i = 0; i < SERVERS.length; i++) {
  if (!SERVERS[i].on) continue;
  /* 🛡️ R23 — ⛔ ما نختارش مضيف إنتاج في وضع المعاينة */
  const v = _guardAllow(SERVERS[i].url);
  if (v && v.ok === false) {
  try { console.warn('[OCTA] السيرفر اتمنع:', SERVERS[i].name, '-', v.code); } catch (x) { }
  continue;
  }
  active = i; break;
  }
  }
  /* ⛔ مافيش سيرفرات ⇒ مافيش عنوان ⇒ مافيش اتصال بالإنتاج */
  if (!SERVERS.length) return '';
  /* 🛡️ R23 — ⛔ كل السيرفرات اتمنعت ⇒ مافيش عنوان (fail closed) */
  if (active < 0) return '';
  return SERVERS[active].url;
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
  current: () => (SERVERS.length && active >= 0
  ? SERVERS[active]
  : { name: 'none', url: '' }),
  /* لو السيرفر فشل n times → جرّب اللي بعده */
  failover: function () {
  fails[active] = (fails[active] || 0) + 1;
  for (let i = 0; i < SERVERS.length; i++) {
  if (!SERVERS[i].on) continue;
  if (active >= 0 && i === active) continue;
  /* 🛡️ R23 — ⛔ ممنوع نرجع للإنتاج من المعاينة (ولا نفق مؤقت) */
  const v = _guardAllow(SERVERS[i].url);
  if (v && v.ok === false) {
  try { console.warn('[OCTA] التحويل اتمنع —', SERVERS[i].name, '-', v.code); } catch (x) { }
  continue;
  }
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
  🐞🛡️ SEC-025 (الجولة ١٨ · P1) — هوية المستخدم **في مفتاح الكاش**
  ───────────────────────────────────────────────────────────
  📌 العيب: مفتاح الكاش كان = المسار + المعاملات بس ⛔
     ⇒ نفس المسار بيرجّع ردّ المستخدم **الأول** لأي مستخدم تاني
       على نفس الجهاز (خصوصاً بعد تبديل الحساب).
  📌 الحل: المفتاح = (هوية المستخدم) + (المسار + المعاملات).
     ⛔ الهوية مش بتتسجّل بالتوكن الخام — هاش قصير بس.
     ⛔ لو معرّف المستخدم مش معروف (مافيش توكن في الواجهة)
        ⇒ مسارات حالة المستخدم **بره الكاش** خالص (fail-closed).
  ═══════════════════════════════════════════════════════════ */
  function _octaScopeHash(s) {
  try {
  let h = 5381, h2 = 52711;
  const t = String(s || '');
  for (let i = 0; i < t.length; i++) {
  const c = t.charCodeAt(i);
  h = ((h << 5) + h + c) >>> 0;          /* djb2 */
  h2 = (((h2 << 5) + h2) ^ c) >>> 0;      /* sdbm-xor */
  }
  return h.toString(16) + '-' + h2.toString(16);
  } catch (e) { return 'x'; }
  }

  /* ⛔ 'anon' = معرّف المستخدم مش معروف ⇒ مافيش تمييز بين مستخدمين */
  function _octaUserScope(headers) {
  try {
  if (headers && headers.get) {
  const a = headers.get('Authorization') || '';
  if (/^bearer\s+/i.test(a)) {
  return 'u' + _octaScopeHash(a.replace(/^bearer\s+/i, '').trim());
  }
  }
  } catch (e) { }
  const t = _token();
  if (t) return 'u' + _octaScopeHash(t);
  return 'anon';
  }

  /* ⛔ معرّف معروف؟ (يعني نقدر نفصل بين مستخدمين) */
  function _octaScopeKnown(headers) {
  return _octaUserScope(headers) !== 'anon';
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
  /* 🛡️ R23 — ⛔ ممنوع نرجع للإنتاج (ولا نفق) من المعاينة
     📌 ده كان المسار اللي بيربط الإنتاج بالمعاينة من غير ما حد ياخد باله. */
  const v = _guardAllow(window.OCTA_DIRECT);
  if (v && v.ok === false) return s;
  return window.OCTA_DIRECT + s.slice(i);
  }

  /* ════════════════════════════════════════════════════════════════
   * ⭐⭐⭐ ٩ نوفمبر ٢٠٢٦ — ⭐⭐⭐ منع الطلبات المكرّرة (in-flight)
   * ────────────────────────────────────────────────────────────────
   * 📌 القياس (متصفح موبايل · ٣٩٠ بكسل · أول تحميل):
   *   ١٠١ طلب · ١.٧ ميجا · ٦.٥ ثانية
   *   ⇒ /api/prices اتطلب **مرتين** (٨٠ ك.ب كل مرة)
   *   ⇒ /api/rank?limit=400 اتطلب **مرتين**
   * 📌 ⭐ السبب: كذا كود بطلب نفس الداتا في نفس اللحظة.
   * 📌 ✅ الحل: لو اتنين GET على نفس المسار راحوا مع بعض ⇒
   *   يتشاركوا نفس الرد (طلب واحد على الشبكة).
   * 📌 📌 لازم كل مستهلك ياخد **نسخة** من الـbody
   *   (الـResponse بيتقرا مرة واحدة بس — التانية كانت هتفشل).
   * 📌 📌 المسارات المسمحوح فيها الدمج محدودة (قائمة أدناه)
   *   ⇒ أي طلب تاني (صور·ملفات·CSV) بيمشي زي ما هو.
   * ════════════════════════════════════════════════════════════════ */
  const OCTA_DEDUPE_PATHS = ['/api/prices', '/api/rank', '/api/data_full',
                             '/api/quot', '/api/dividends', '/api/stocks',
                             '/api/engine-weights', '/api/ticker'];
  const OCTA_INFLIGHT = {};

  function _dedupeOk(s) {
    for (let i = 0; i < OCTA_DEDUPE_PATHS.length; i++) {
      if (s.indexOf(OCTA_DEDUPE_PATHS[i]) >= 0) return true;
    }
    return false;
  }
  /* ⭐ المفتاح = (هوية المستخدم) + المسار + المعاملات، من غير الـcache-buster (_=)
     🐞🛡️ SEC-025 (الجولة ١٨ · P1) — هوية المستخدم داخل المفتاح ⬇️
        📌 قبل: المفتاح = المسار بس ⇒ مستخدم B بياخد ردّ مستخدم A. */
  function _inflightKey(s, headers) {
    try {
      /* ⭐⭐⭐ ١٤ نوفمبر ٢٠٢٦ — ⭐ نشيل الأصل (الدومين) من المفتاح
         📌 السبب (مقيس): نفس المسار كان بيتطلب مرتين — مرة من
         نفس أصل الموقع (/api/gold/signal) ومرة من السيرفر المباشر
         ⇒ مفتاحين مختلفين ⇒ مفيش دمج ⇒ الطلب اتكرر ⛔.
         📌 ✅ الحل: نطبّع الأصل ⇒ نفس المسار = نفس المفتاح ⛔→✅.
         📌 ⚠️ الداتا واحدة (نفس السيرفر) ⇒ الدمج آمن. */
      const path = String(s)
        .replace(/^https?:\/\/[^/]+/i, '')
        .replace(/([?&])_=[0-9]+/g, '$1')
        .replace(/[?&]+$/, '')
        .replace(/\?&/, '?')
        .replace(/&&+/g, '&');
      return _octaUserScope(headers) + '|' + path;
    } catch (e) { return String(s); }
  }

  /* 🐞🛡️ ١٥ نوفمبر ٢٠٢٦ — دفعة الأمان ٠١ — ⛔ مسارات حالة المستخدم ⬇️
     ⛔ ⬇️ الكاش العام كان بيخزّن **كل** GET ⬇️ ⬇️
     ⛔ ⬇️ ⇒ بعد ما المستخدم يخرج ويسجّل دخول بحساب تاني ⬇️ ⬇️
     ⛔ ⬇️ ⇒ ممكن يشوف بيانات الحساب القديم (محفظة · منبهات) ⬇️ ⬇️
     ⛔ ⬇️ ⬇️ ⇒ تسريب بين المستخدمين على نفس الجهاز ⬇️ ⬇️
     ✅ الحل: المسارات دي **بره الكاش** خالص ⬇️ */
  const NO_CACHE_PATHS = [
    '/api/auth/me', '/api/auth/refresh', '/api/portfolio',
    '/api/dashboard', '/api/alerts/watch', '/api/alerts/state',
    '/api/subscriptions/me', '/api/charts/list', '/api/stats',
    /* 🐞🛡️ SEC-025 — الاستوديو: «scope=mine» = رسومات المستخدم (خاصة).
       ⛔ كان في كاش الـoctaFetch (المفتاح = المسار بس) ⇒ مستخدم تاني
          على نفس الجهاز بيشوف رسومات الأول. */
    '/api/studio/list'
  ];

  function _isUserState(path) {
    const p = String(path || '');
    for (let i = 0; i < NO_CACHE_PATHS.length; i++) {
      const n = NO_CACHE_PATHS[i];
      if (p === n || p.indexOf(n + '?') === 0) return true;
    }
    return false;
  }

  /* 🩺 شغّل على السيرفر التاني لو الرئيسي واقع */
  const ORIG = ORIG_FETCH;
  /* 🛡️ R23 — التنفيذ الأصلي (الحارس ملفّف بره) */
  const _apiFetch = function (url, opts) {
  const s = String(url || '');
  /* ⛌ URL خارجي (مش نداء بتاعنا) → يفضل زي ما هو */
  if (!_isOurs(s)) return ORIG.apply(this, arguments);
  /* ⛌ مش /api/ → يفضل زي ما هو */
  if (s.indexOf('/api/') === -1) return ORIG.apply(this, arguments);

  const opt = _withToken(s, opts);

  /* ⭐⭐⭐ الدمج: طلبات GET المتطابقة في نفس اللحظة ⇒ طلب واحد */
  let method = 'GET';
  try { method = String((opt && opt.method) || 'GET').toUpperCase(); } catch (e) { }
  if (method === 'GET' && _dedupeOk(s)) {
    const key = _inflightKey(s, opt && opt.headers);
    let rec = OCTA_INFLIGHT[key];
    if (!rec) {
      /* ⭐ الطلب المشترك مالهوش signal بتاع مستهلك واحد
         (لو اتأخر مستهلك، الطلب مابيتشالش من الباقي). */
      const o2 = Object.assign({}, opt);
      delete o2.signal;
      let ctrl = null, timer = null;
      if (typeof AbortController !== 'undefined') {
        ctrl = new AbortController();
        o2.signal = ctrl.signal;
      }
      /* ⭐⭐ المؤقّت (٢٠ ثانية) لازم يبدأ **وقت الإرسال** مش وقت
         الجدولة — لغير كده الطابور بيأخّر الطلب ⇒ المؤقّت بيطلع
         قبل ما الطلب يطلع ⇒ «signal is aborted without reason». */
      const p = _octaSchedule(function () {
        if (timer === null) {
          timer = setTimeout(function () { try { ctrl.abort(); } catch (e) { } }, 30000);
        }
        return _octaFetchRetry(s, o2, 0);
      }, s)
        .then(function (r) {
          if (r.status >= 500) window.OCTAServer.failover();
          const hs = [];
          try { r.headers.forEach(function (v, k) { hs.push([k, v]); }); } catch (e) { }
          const ct = (r.headers && r.headers.get) ? (r.headers.get('Content-Type') || '') : '';
          return r.text().then(function (body) {
            return { status: r.status, hs: hs, ct: ct, body: body };
          });
        })
        .catch(function (e) {
          const nu = _directUrl(s);
          if (nu === s) throw e;
          window.OCTAServer.failover();
          try { console.warn('[OCTA]_primary failed — trying direct API'); } catch (x) { }
          return ORIG.call(window, nu, _withToken(nu, opts)).then(function (r) {
            const hs = [];
            try { r.headers.forEach(function (v, k) { hs.push([k, v]); }); } catch (e) { }
            return r.text().then(function (body) {
              return { status: r.status, hs: hs, ct: (r.headers.get('Content-Type') || ''), body: body };
            });
          });
        })
        .then(function (out) {
          if (timer) clearTimeout(timer);
          delete OCTA_INFLIGHT[key];
          return out;
        }, function (err) {
          if (timer) clearTimeout(timer);
          delete OCTA_INFLIGHT[key];
          throw err;
        });
      rec = OCTA_INFLIGHT[key] = { p: p };
    }
    /* ⭐ كل مستخدم ياخد Response جديدة (الجسم بيتقرا مرة واحدة) */
    const mkResp = function (out) {
      try {
        const hd = {};
        for (let i = 0; i < out.hs.length; i++) hd[out.hs[i][0]] = out.hs[i][1];
        if (!hd['Content-Type'] && out.ct) hd['Content-Type'] = out.ct;
        return new Response(out.body, { status: out.status, headers: hd });
      } catch (e) {
        return new Response(out.body, { status: 200 });
      }
    };
    const pResp = rec.p.then(mkResp);
    /* ⭐⭐ مهلة المستهلك (٧ ثواني في fetchRetry) لازم تفضل شغّالة:
       لو المستعمل ده اتأخر ⇒ هو بس اللي يفشل — والطلب المشترك
       يكمل عشان الباقي. */
    if (opt && opt.signal) {
      return new Promise(function (resolve, reject) {
        let done = false;
        const onAbort = function () {
          if (done) return; done = true;
          try { reject(new Error('انتهت المهلة')); } catch (e) { }
        };
        try {
          if (opt.signal.aborted) { onAbort(); return; }
          if (opt.signal.addEventListener) opt.signal.addEventListener('abort', onAbort, { once: true });
        } catch (e) { }
        pResp.then(function (r) {
          if (done) return; done = true;
          try { if (opt.signal.removeEventListener) opt.signal.removeEventListener('abort', onAbort); } catch (e) { }
          resolve(r);
        }, function (e) {
          if (done) return; done = true;
          reject(e);
        });
      });
    }
    return pResp;
  }

  /* ⭐⭐⭐ الخانق هنا (في الـfetch العام) ⇒ كل نداء في التطبيق
     بيعدّي منه — مش بس النداءات اللي بتستخدم octaFetch.
     📌 (النسخة الأولى حطّيت الخانق في octaFetch بس ⇒ النداءات
        المباشرة في باقي الملفات عدّت من غير خانق ⇒ 429.) */
  /* ⭐⭐⭐ الكاش القصير: نفس GET اتطلب قبل كده (من غير تغيير في
     المعاملات ⇒ نفس البيانات) ⇒ نردّ من الذاكرة فوراً. */
  const _isGet = (String((opt && opt.method) || 'GET')).toUpperCase() === 'GET';
  /* 🐞🛡️ SEC-025 — المفتاح فيه هوية المستخدم + مسارات حالة المستخدم
     بره الكاش خالص (زي ما كانت بالظبط) + المعرّف المجهول ⇒ بره الكاش. */
  const _ckey = (_isGet && !_isUserState(_pathOf(s)))
    ? _inflightKey(s, opt && opt.headers) : '';
  if (_ckey) {
    const _hit = _octaCacheGet(_ckey);
    if (_hit) {
      const _mk = _octaCacheMake(_hit);
      if (_mk) return Promise.resolve(_mk);
    }
  }
  const _budgeted = function () {
    return _octaSchedule(function () { return _octaFetchRetry(s, opt, 0); }, s);
  };
  return _budgeted().then(function (r) {
  if (_ckey) { try { _octaCachePut(_ckey, r.clone()); } catch (e) { } }
  /* السيرفر رجّع error حقيقي (مش شبكة) — مفيش failover */
  if (r.status >= 500) window.OCTAServer.failover();
  /* ⛔ ⛔ ⛔ ٤٠١ معناها «التوكن مش صالح» مش «الموقع وقع».
  ⛌ أي طلب واحد بيرجع ٤٠١ بيطرد المستخدم فوراً — فبنكتفي
  ⛌ بإننا نلاحظ ونكمّل عادي. البوابة لوحدها تتحقق. */
  if (r.status === 401 && !_isOpen(_pathOf(s))) {
  try { console.warn('[OCTA] ' + _pathOf(s) + ' محمي — توكن ناقص'); }
  catch (e) { }
  /* 🛡️ R23 (الجولة ٢٣) — ⛔ جلسة **باطلة** ⇒ حالة انتهاء صريحة
  📌 التOKEن كان مبعوت (يعني المستخدم داخل) والسيرفر رجّع 401
  📌 ⇒ الجلسة انتهت (أو اتباطلت) ⇒ لازم المستخدم يعرف السبب
  📌 ⛔ زائر مجهول (مافيش توكن) ⇒ مافيش جلسة تنتهي ⇒ ما نعملش حاجة. */
  _octaSessionExpired(s, opt);
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
   🛡️ R23 — الحارس ملفّف حوالين الـfetch
   ────────────────────────────────────────────────────────────────
   📌 أي نداء /api/ لازم يعدّي من الحارس **قبل** ما يطلع على الشبكة.
   📌 ⛔ لو الحارس رفض ⇒ بنرجّع خطأ واضح (مفيش 530 ولا صمت).
   📌 ⛔ لو الحارس لسه بيحمّل ⇒ بنستناه (مرة واحدة) — مافيش طلب
      يعدّي قبل ما الحكم يخلص.
   ════════════════════════════════════════════════════════════════ */
  window.fetch = function (url, opts) {
  const s = String(url || '');
  /* 🛡️ R23 — ⛔ ممنوع أي نداء لمضيف إنتاج في وضع المعاينة (فوراً) */
  const hv = _guardHostVerdict(s);
  if (hv && hv.ok === false) return _guardBlock(hv);
  if (!_isOurs(s)) return _apiFetch.apply(this, arguments);
  if (s.indexOf('/api/') === -1) return _apiFetch.apply(this, arguments);
  const g = _guardInstance();
  if (g && typeof g.check === 'function') {
  let v = null;
  try { v = g.check(s); } catch (e) { v = null; }
  if (v && v.ok === false) return _guardBlock(v);
  return _apiFetch.apply(this, arguments);
  }
  /* ⛔ الحارس لسه بيحمّل ⇒ نستناه قبل أي نداء */
  return _guardReady().then(function (gg) {
  if (gg && typeof gg.check === 'function') {
  const v = gg.check(s);
  if (v && v.ok === false) return _guardBlock(v);
  }
  return _apiFetch.call(window, s, opts);
  }, function () {
  return _apiFetch.call(window, s, opts);
  });
  };

/* ════════════════════════════════════════════════════════════════
  🚦 ⭐⭐⭐ ١٠ نوفمبر ٢٠٢٦ — ⭐ خانق الطلبات + إعادة محاولة 429
  ────────────────────────────────────────────────────────────────
  📌 المشكلة (مقيسة بالفحص الآلي): المستخدم اللي بيتنقل بسرعة
     بين الصفحات بيعمل ١٢٠+ طلب في الدقيقة ⇒ السيرفر بيرجّع
     429 ⇒ أجزاء من الصفحة بتفضل فاضية (ومفيش رسالة واضحة).
  📌 ⛔⛔⛔ الأسوأ: على موبايل بشبكة بطيئة + ضغط سريع = نفس المشكلة.
  ✅ الحل (٣ قطع):
     ① طابور: ٦ طلبات مع بعض + ١٢٠ مللي بين كل طلبين.
     ② لو ردّ السيرفر 429 ⇒ نستنى Retry-After (حد أقصى ١٠ ثواني)
        ونحاول تاني مرة واحدة.
     ③ لو فشل كمان ⇒ رد JSON نظيف برسالة عربية (مش انهيار).
  ════════════════════════════════════════════════════════════════ */
var OCTA_MAX_CONC = 6;      /* أقصى طلبات متوازية */
var OCTA_MIN_GAP = 120;     /* أقل مسافة بين طلبين (مللي) */
var OCTA_BUDGET = 100;      /* ⭐ ميزانية الدقيقة (السيرفر يسمح ١٢٠) */
var OCTA_HITS = [];         /* أوقات الطلبات في آخر دقيقة */
/* ⭐⭐⭐ حدود السيرفر مقسّمة على «أنواع مسارات» — لازم نطابقها بالظبط:
   📌 default   : ١٢٠ / دقيقة   ⇒ ميزانيتنا ١٠٠
   📌 expensive :  ٤٠ / دقيقة   ⇒ ميزانيتنا ٣٢  (تحليل · أخبار · شموع …)
   📌 write     :   ٥ / دقيقة   ⇒ ميزانيتنا ٤   (حفظ · تنبيهات …)
   📌 ⛔ قبل كنا بنحسب ميزانية واحدة ⇒ المسارات الغالية كانت بتعدّي
      حدّها (٤٠)⇒ 429 ⇒ أجزاء فاضية في الصفحات التحليلية. */
var OCTA_BUDGETS = { default: 100, expensive: 32, write: 4 };
var OCTA_BUCKETS = { default: [], expensive: [], write: [] };
/* ⭐ التصنيف = **أول جزء بعد /api/** بالظبط (زي السيرفر)
   ⛔ مثال مهم: /api/portfolio كتابة · بس /api/alpha/portfolio قراءة! */
var OCTA_EXPENSIVE = ['analyze', 'chat', 'news', 'candles', 'intelligence',
  'explain', 'egx_full', 'risk', 'fundamental', 'technical', 'obdepth',
  'sentiment', 'portfolio_fit', 'opportunity'];
var OCTA_WRITES = ['portfolio', 'alerts', 'dividends', 'calibration', 'stress'];

function _octaBucket(url) {
  try {
    var s = String(url || '');
    var i = s.indexOf('/api/');
    if (i < 0) return 'default';
    var rest = s.slice(i + 5);
    var name = rest.split(/[\/?]/)[0].toLowerCase();
    if (OCTA_WRITES.indexOf(name) >= 0) return 'write';
    if (OCTA_EXPENSIVE.indexOf(name) >= 0) return 'expensive';
  } catch (e) { }
  return 'default';
}
var OCTA_QUEUE = [];
var OCTA_ACTIVE = 0;
var OCTA_LAST = 0;

/* ⭐⭐⭐ ميزانية الـrate limit — لازم نحسبها قبل كل طلب
   📌 السبب: حدّ السيرفر ١٢٠ طلب/دقيقة ⇒ أي المستخدم يضغط بسرعة
      (أو موبايل بشبكة بطيئة) ممكن يتجاوز ⇒ 429 ⇒ أجزاء فاضية.
   📌 الحل: نحسب الطلبات في آخر 60 ثانية ⇒ لو وصلنا للميزانية،
      نستنى لحد ما تتحرر نافذة الدقيقة (مش 429 ولا بيانات ناقصة). */
function _octaBudgetWait(bucket) {
  var now = Date.now();
  var key = bucket || 'default';
  var list = OCTA_BUCKETS[key] || (OCTA_BUCKETS[key] = []);
  while (list.length && (now - list[0]) > 60000) list.shift();
  var limit = OCTA_BUDGETS[key] || OCTA_BUDGET;
  /* ⭐⭐⭐ مسافة ثابتة ١٢٠ مللي بين الطلبات (تقليل الـburst)
     📌 ⛔ تجربة: خليها صفر تحت نص الحد ⇒ التحميل أسرع، بس
        الفحص الآلي رجّع 429 ⇒ الرجوع للمسافة الثابتة.
     📌 عند الحد ⇒ نستنى (بسقف ٢٫٥ ثانية) ونرجع نعمل retry. */
  if (list.length >= limit) {
    var free = list[0] + 60000 - now + 60;
    /* ⭐⭐⭐ سقف الانتظار ٢٫٥ ثانية!
       📌 من غير السقف: الطابور بيستنى لحد ما تتحرر نافذة
          الدقيقة (٦٠ ثانية) ⇒ ⛔ الواجهة بتتجمّد و«بنحسب…» بيفضل
          معلّق ⇒ ⭐ ده كان سبب ظهور Alpha واقف.
       📌 مع السقف: الطلب بينزل 429 ⇒ ونعيد المحاولة بعد Retry-After
          بتاع السيرفر ⇒ البيانات بتوصل بس أبطأ شوية. */
    if (free > 2500) return 2500;
    if (free > OCTA_MIN_GAP) return free;
  }
  return OCTA_MIN_GAP;
}

/* ⭐⭐⭐ كاش ردود قصير (٣٠ ثانية) داخل طبقة الـfetch
   📌 السبب: المستخدم بينقل بسرعة بين الأذرع ⇒ نفس المسار بيتطلب
      مرات ورا بعض ⇒ ضغط على السيرفر + انتظار.
   📌 الكاش هنا يخلّي الطلبات المتكررة ترجع فوراً من الذاكرة.
   📌 ⛔ ٣٠ ثانية بس (الأسعار بتتحدّث كل ١٥ دقيقة ⇒ أأمن من الكاش). */
var OCTA_RESP_CACHE = {};
var OCTA_RESP_TTL = 30000;
/* ⭐⭐⭐ ١٤ نوفمبر ٢٠٢٦ — ⭐ عمر مختلف لكل مسار
   📌 الأسعار: ٥ ثواني ⇒ الطلبات المتكررة بتتدمج (طلب ٩٢٧ ك.ب!)
   بس زرار «تحديث الأسعار» يجيب بيانات جديدة ⇒ مش بيفضل قديم.
   📌 الرتب: ١٠ ثواني ⇒ الدرجة مابتتغيرش في دقايق.
   📌 الباقي: ٣٠ ثانية (الافتراضي). */
var OCTA_RESP_TTL_BY_PATH = { '/api/prices': 5000, '/api/rank': 10000,
                               '/api/ticker': 10000, '/api/data_full': 10000 };
function _octaCacheTTL(key) {
  try {
    var s = String(key || '');
    for (var p in OCTA_RESP_TTL_BY_PATH) {
      if (s.indexOf(p) >= 0) return OCTA_RESP_TTL_BY_PATH[p];
    }
  } catch (e) { }
  return OCTA_RESP_TTL;
}
function _octaCacheGet(key) {
  try {
    var rec = OCTA_RESP_CACHE[key];
    if (!rec) return null;
    if (Date.now() - rec.t > _octaCacheTTL(key)) { delete OCTA_RESP_CACHE[key]; return null; }
    return rec;
  } catch (e) { return null; }
}
/* ⭐⭐⭐ ١٤ نوفمبر ٢٠٢٦ — ⭐⭐⭐ إصلاح جذري: نخزّن **نص** الرد
   📌 كان بنخزّن الـResponse نفسه ⇒ أول مستهلك بيقراه (res.json())
   ⇒ الـbody بيتقرا ⇒ الـclone بعدين بيفشل ⇒ الكاش **ما كانش
   بيشتغل خالص** ⛔ (وهو سبب تكرار الطلبات: engine-weights ×٥).
   📌 ✅ الحل: نقرا نسخة من الـbody كنص ⇒ ونرجّع Response جديد لكل
   مستهلك ⇒ الكاش يشتغل فعلاً ⛔→✅. */
function _octaCachePut(key, resp) {
  try {
    if (!resp || !resp.ok) return;
    var clone = resp.clone();
    var ct = '';
    try { ct = resp.headers.get('Content-Type') || ''; } catch (e) { }
    var st = 200;
    try { st = resp.status || 200; } catch (e) { }
    clone.text().then(function (body) {
      try {
        OCTA_RESP_CACHE[key] = { t: Date.now(), body: body, ct: ct, status: st };
        var n = 0; for (var k in OCTA_RESP_CACHE) n++;
        if (n > 160) {
          var oldest = null, ot = 1e12;
          for (var k2 in OCTA_RESP_CACHE) {
            if (OCTA_RESP_CACHE[k2].t < ot) { ot = OCTA_RESP_CACHE[k2].t; oldest = k2; }
          }
          if (oldest) delete OCTA_RESP_CACHE[oldest];
        }
      } catch (e2) { }
    }).catch(function () { });
  } catch (e) { }
}
function _octaCacheMake(rec) {
  try {
    return new Response(rec.body, {
      status: rec.status || 200,
      headers: { 'Content-Type': rec.ct || 'application/json' }
    });
  } catch (e) { return null; }
}

function _octaPump() {
  if (OCTA_ACTIVE >= OCTA_MAX_CONC) return;
  if (!OCTA_QUEUE.length) return;
  var item = OCTA_QUEUE.shift();
  var bucket = 'default';
  try { bucket = _octaBucket(item.url); } catch (e) { }
  var wait = Math.max(0, _octaBudgetWait(bucket) - (Date.now() - OCTA_LAST));
  OCTA_ACTIVE++;
  setTimeout(function () {
    OCTA_LAST = Date.now();
    try {
      var list = OCTA_BUCKETS[bucket] || (OCTA_BUCKETS[bucket] = []);
      list.push(Date.now());
      if (list.length > 120) list.shift();
    } catch (e) { }
    var p;
    try { p = item.fn(); } catch (e) { p = Promise.reject(e); }
    OCTA_ACTIVE--;
    item.resolve(p);
    _octaPump();
  }, wait);
}

function _octaSchedule(fn, url) {
  return new Promise(function (resolve) {
    OCTA_QUEUE.push({ fn: fn, resolve: resolve, url: url || '' });
    _octaPump();
  });
}

/* ⭐ إعادة محاولة واحدة عند 429 (مع احترام Retry-After) */
function _octaFetchRetry(url, o, attempt) {
  /* ⭐⭐⭐ لازم نستخدم الـfetch **الأصلي** هنا — لو استدعينا
     window.fetch (المغلّف) ⇒ هينادي الخانق ⇒ الخانق هينادي
     _octaFetchRetry ⇒ ⇒ استدعاء لا نهائي ⇒ الطلب ما بيطلعش أبدًا
     ⇒ ⛔ «بنحسب المحفظة…» بيفضل معلّق. */
  var raw = (typeof ORIG_FETCH !== 'undefined' && ORIG_FETCH) ? ORIG_FETCH : window.fetch;
  return raw.call(window, url, o).then(function (resp) {
    if (!resp || resp.status !== 429) return resp;
    if ((attempt || 0) >= 1) {
      /* ⛔ فشل تاني ⇒ رد نظيف برسالة عربية (بدل انهيار في الكونسول) */
      var body = JSON.stringify({
        ok: false, error: 'طلبات كتير في وقت قصير',
        retry_after: 5, hint: 'استنى ٥ ثواني وحاول تاني'
      });
      try {
        return new Response(body, {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'X-RateLimit-Retry': '1' }
        });
      } catch (e) { return resp; }
    }
    var ra = 3;
    try { ra = parseInt(resp.headers.get('Retry-After') || '3', 10) || 3; } catch (e) { ra = 3; }
    if (ra > 10) ra = 10;
    if (ra < 1) ra = 1;
    /* ⭐⭐ تكيّف: كل 429 ⇒ نوسّع المسافة بين الطلبات (حتى ١٥٠٠ مللي)
       ⇒ الطلبات بتتبطّأ لوحدها بدل ما تفضل تطلع 429. */
    OCTA_MIN_GAP = Math.min(1500, Math.max(OCTA_MIN_GAP * 2, 250));
    return new Promise(function (r) { setTimeout(r, ra * 1000); })
      .then(function () { return _octaFetchRetry(url, o, (attempt || 0) + 1); });
  });
}

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
var OCTA_CACHE = {};        /* url(مع الـquery) → {t, body, ct} */
var OCTA_CACHE_TTL = 20000; /* ٢٠ ثانية — كفاية للتجربة، ومنع للتكرار */
/* ⭐⭐⭐ ١٤ نوفمبر ٢٠٢٦ — ⭐ اتساع قائمة المسارات المحميّة بالكاش
   📌 السبب (مقيس): الصفحة الرئيسية بتطلب ~٣٧ طلب عند الفتح، فيها
      طلبات **مكرّرة بالظبط**: /api/engine-weights ×٤ · /api/rank ×٢
      · /api/prices ×٢ · /api/analyze ×٢ · /api/gold/signal ×٢
      · /api/quotes ×٢ ⇒ ١٤ طلب زيادة + نفس البايتات.
   📌 ✅ الحل: كاش قصير (٢٠ ثانية) بمفتاح = الرابط **بكل معاملاته**
      (ما عدا الـcache-buster `?_=`) ⇒ الطلب المكرر بيرجّع من الذاكرة.
   📌 ⛔ مهم: المفتاح لازم يحافظ على الـquery! قبل كده كان بيشيله
      ⇒ /api/rank?limit=252 و /api/rank?limit=400 هياخدوا نفس الرد
      (رقم غلط!) ⇒ دي كانت سبب إننا ما نقدرش نضيف /api/rank للكاش.
   📌 ⛔ والأسعار كاش ٢٠ ثانية: التحديث الحقيقي كل ١٥ دقيقة ⇒ أأمن. */
var OCTA_CACHE_PATHS = ['/api/intelligence/', '/api/explain/', '/api/technical/',
                        '/api/engine-weights',
                        /* ⭐⭐ ٩ نوفمبر ٢٠٢٦ — طلب مكرّر (مقيس):
                           /api/engine-weights اتطلب ٥ مرات ⇒ ٥ من الـ٦
                           اتصالات المتوازية بتروح لطلب واحد.
                           📌 ⛔ ما نضيفش /api/rank هنا: مفتاح الكاش
                           بيشيل الـquery ⇒ limit=252 وlimit=400 هياخدوا
                           نفس الرد (خطأ!). الرتب بتتدمج لحظياً بس
                           (في الـdedupe) من غير كاش زمني. */
                        /* ⭐⭐⭐ ١٤ نوفمبر ٢٠٢٦ — بقى آمن بعد إصلاح المفتاح */
                        '/api/rank', '/api/prices', '/api/ticker',
                        '/api/quotes', '/api/dividends',
                        '/api/dashboard', '/api/analyze', '/api/gold/signal',
                        '/api/setups', '/api/challenges', '/api/studio/list',
                        '/api/radar/history', '/api/tvquote'];
/* ⛔⛔⛔ ١٤ نوفمبر ٢٠٢٦ — ⭐ شيلنا ٣ مسارات من الكاش **عن قصد**:
   📌 /api/data_full — زرار «تحديث» لازم يجيب بيانات جديدة ⇒ الكاش
     كان هيرجّع القديم ⇒ التحديث ما يعملش ⛔.
   📌 /api/alerts/watch و /api/subscriptions/me — دول حالة المستخدم
     (حفظ/اشتراك) ⇒ رد قديم بعد الحفظ = واجهة غلط ⛔.
   📌 الـcache-buster `?_=` بيتشال من المفتاح ⇒ لازم نعتمد على
     طلب جديد فعلياً ⇒ فالمسارات دي من غير كاش أحسن. */

function _octaCacheKey(s, headers) {
  try {
    /* ⭐⭐⭐ ١٤ نوفمبر ٢٠٢٦ — ⭐ المفتاح = المسار + **كل المعاملات**
       📌 بنشيل الـcache-buster بس (`?_=1794…`) ⇒ نفس الطلب الحقيقي
       بيلقى نفس المفتاح ⇒ الكاش بيشتغل ⛔.
       📌 ⛔ قبل كده: بنشيل الـquery كله ⇒ /api/rank?limit=252
       و /api/rank?limit=400 بياخدوا نفس الرد (رقم غلط) ⇒ كان
       سبب إننا نقدرش نضيف /api/rank للكاش أصلاً.
       🐞🛡️ SEC-025 (الجولة ١٨ · P1) — ⛔ فوق ده: **هوية المستخدم**
          ⇒ مفتاح واحد لكل مستخدم ⇒ مافيش تسرّب بين المستخدمين. */
    var u = String(s || '');
    /* ⭐ ١٤ نوفمبر ٢٠٢٦ — نشيل الأصل برضه (نفس السبب: طلبان
       من دومينين = نفس الداتا ⇒ نفس المفتاح) */
    u = u.replace(/^https?:\/\/[^/]+/i, '');
    u = u.replace(/([?&])_=[0-9]+/g, '$1').replace(/[?&]+$/, '').replace(/\?&/, '?').replace(/&&+/g, '&');
    return _octaUserScope(headers) + '|' + u;
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

  /* ⛔⛔⛔ الكاش — المسارات الغالية بس (مش الأسعار، عشان تبقى حيّة)
     🐞🛡️ SEC-025 (الجولة ١٨ · P1) — ⛔ شرطين إضافيين:
        ① المفتاح فيه **هوية المستخدم** (مستخدمان = مفتاحان).
        ② مسارات حالة المستخدم (/api/dashboard · /api/studio/list …)
           ⇒ **بره الكاش** خالص — زي ما هو في الـfetch العام.
        ⛔ ولما معرّف المستخدم مش معروف (مافيش توكن) ⇒ بره الكاش. */
  var _userState = _isUserState(_pathOf(s));
  var _scopeKnown = _octaScopeKnown(o && o.headers);
  if (_octaIsCacheable(s, o && o.method) && !_userState && _scopeKnown) {
    var key = _octaCacheKey(s, o && o.headers);
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
  /* ⭐ كل المسارات بتمر على الـfetch العام (هو اللي فيه الخانق) */
  return window.fetch(url, o);
};

})();
