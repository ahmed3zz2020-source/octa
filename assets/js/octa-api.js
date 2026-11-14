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
  /* ⭐⭐⭐ ١٤ نوفمبر ٢٠٢٦ — ⭐ الـfetch الخام متاح للصفحات الحرجة
     📌 السبب (مقيس): البوابة كانت بتطلب /api/auth/me **ورا** طابور
     ~٣٥ طلب تاني ⇒ استنّى ٤٫٥ ثانية ⇒ «مهلة السماح» فتحت الشاشة
     ⇒ المستخدم قعد قدام البوابة ٥٫٤ ثانية ⛔.
     📌 ✅ الحل: طلب التحقق من الحساب يخرج **مباشرة** (من غير الخانق
     ولا الطابور) ⇒ البوابة تفتح في ~٠٫٣ ثانية.
     📌 ⚠️ الطلب لازم يكون GET عادي والترويسات بتتحط بنفسها. */
  try { window.OCTA_RAW_FETCH = ORIG_FETCH; } catch (e) { }

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
  /* ⭐ المفتاح = المسار + المعاملات، من غير الـcache-buster (_=) */
  function _inflightKey(s) {
    try {
      return String(s)
        .replace(/([?&])_=[0-9]+/g, '$1')
        .replace(/[?&]+$/, '')
        .replace(/\?&/, '?')
        .replace(/&&+/g, '&');
    } catch (e) { return String(s); }
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

  /* ⭐⭐⭐ الدمج: طلبات GET المتطابقة في نفس اللحظة ⇒ طلب واحد */
  let method = 'GET';
  try { method = String((opt && opt.method) || 'GET').toUpperCase(); } catch (e) { }
  if (method === 'GET' && _dedupeOk(s)) {
    const key = _inflightKey(s);
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
  const _ckey = _isGet ? _inflightKey(s) : '';
  if (_ckey) {
    const _hit = _octaCacheGet(_ckey);
    if (_hit) {
      try { return Promise.resolve(_hit.resp.clone()); } catch (e) { }
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
function _octaCacheGet(key) {
  try {
    var rec = OCTA_RESP_CACHE[key];
    if (!rec) return null;
    if (Date.now() - rec.t > OCTA_RESP_TTL) { delete OCTA_RESP_CACHE[key]; return null; }
    return rec;
  } catch (e) { return null; }
}
function _octaCachePut(key, resp) {
  try {
    OCTA_RESP_CACHE[key] = { t: Date.now(), resp: resp };
    var n = 0; for (var k in OCTA_RESP_CACHE) n++;
    if (n > 160) {
      var oldest = null, ot = 1e12;
      for (var k2 in OCTA_RESP_CACHE) {
        if (OCTA_RESP_CACHE[k2].t < ot) { ot = OCTA_RESP_CACHE[k2].t; oldest = k2; }
      }
      if (oldest) delete OCTA_RESP_CACHE[oldest];
    }
  } catch (e) { }
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

function _octaCacheKey(s) {
  try {
    /* ⭐⭐⭐ ١٤ نوفمبر ٢٠٢٦ — ⭐ المفتاح = المسار + **كل المعاملات**
       📌 بنشيل الـcache-buster بس (`?_=1794…`) ⇒ نفس الطلب الحقيقي
       بيلقى نفس المفتاح ⇒ الكاش بيشتغل ⛔.
       📌 ⛔ قبل كده: بنشيل الـquery كله ⇒ /api/rank?limit=252
       و /api/rank?limit=400 بياخدوا نفس الرد (رقم غلط) ⇒ كان
       سبب إننا نقدرش نضيف /api/rank للكاش أصلاً. */
    var u = String(s || '');
    u = u.replace(/([?&])_=[0-9]+/g, '$1').replace(/[?&]+$/, '').replace(/\?&/, '?').replace(/&&+/g, '&');
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
  /* ⭐ كل المسارات بتمر على الـfetch العام (هو اللي فيه الخانق) */
  return window.fetch(url, o);
};

})();
