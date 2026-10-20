/* ══════════════════════════════════════════════════════════════
  🔌 مدير السيرفرات — لو السيرفر الأساسي وقع، جرّب التاني
  ──────────────────────────────────────────────────────────────
  🎯 مش بنحتاج نغيّر الكود لو نقلنا لسيرفر جديد — بدّل السطر ده وخلاص
  ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* 🎯 كل السيرفرات بالترتيب — الأول اللي شغال هو المستخدم */
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
  let fails = {};  /* عدّاد فشل لكل سيرفر */

  function base() {
  if (active < 0) {
  for (let i = 0; i < SERVERS.length; i++) {
  if (SERVERS[i].on) { active = i; break; }
  }
  }
  return SERVERS[active >= 0 ? active : 0].url;
  }

  window.OCTADev = window.OCTADev || {};

  window.OCTA_API = base();

  /* 🔄 بدّل السيرفر النشط */
  window.OCTAServer = {
  list: SERVERS,
  current: () => SERVERS[active < 0 ? 0 : active],
  /* لو السيرفر فشل ن times → جرّب اللي بعده */
  failover: function () {
  fails[active] = (fails[active] || 0) + 1;
  for (let i = 0; i < SERVERS.length; i++) {
  if (!SERVERS[i].on || i === active) continue;
  active = i;
  window.OCTA_API = SERVERS[i].url;
  console.warn('[OCTA] السيرفر الرئيسي واقع — تحوّل لـ', SERVERS[i].name);
  return true;
  }
  return false;
  },
  failed: (i) => fails[i || active] || 0,
  };

  /* ═══════════════════════════════════════════════════════════
  🔐 المسارات المحمية — لازم يتبعتلها توكن المستخدم
  ───────────────────────────────────────────────────────────
  ⛔ ⛔ السيرفر بيرفض /api/egx_full و /api/ranking بدون توكن
  (401 «النسخة الكاملة محمية») — والواجهة كلها بتتبني عليهما،
  فكانت الصفحة بتفتح وهي فاضية.
  ⛌ بنضيف التوكن هنا في مكان واحد بدل 30 نداء في كل ملف.
  ⛌ بنضيفه للمسارات المحمية بس — عشان ما نعملش preflight
  على كل طلب في الموقع (벨ا двуفة).
  ═══════════════════════════════════════════════════════════ */
  const AUTH_PATHS = [
  '/api/egx_full', '/api/data_full', '/api/ranking', '/api/portfolio',
  /* ⛔⛔ ٢٠ أكتوبر ٢٠٢٦ — /api/rank بقى محمي على السيرفر
  ⛌ فلازم نبعتهو مع التوكن، وإلا رجع 401 والواجهة فاضية. */
  '/api/rank',
  '/api/stats', '/api/alerts/watch', '/api/alerts/diag',
  '/api/auth/me', '/api/auth/pin/change'
  ];

  /* ⛔ الـfetch بتيجي برابط كامل (https://…/api/egx_full) —
  والمقارنة كانت على السلسلة نفسها، فindexOf كان -1 دايماً
  والتوكن ماتبعتش أصلاً. بنطلّع المسار بس ونقارن بيه. */
  function _pathOf(url) {
  const s = String(url || '').split('?')[0].split('#')[0];
  const i = s.indexOf('/api/');
  return i === -1 ? s : s.slice(i);
  }

  function _withToken(url, opts) {
  if (AUTH_PATHS.indexOf(_pathOf(url)) === -1) return opts;
  let t = '';
  try { t = localStorage.getItem('octa_token') || ''; } catch (e) { }
  if (!t) return opts;
  const o = opts || {};
  try {
  const h = new Headers(o.headers || {});
  if (!h.get('Authorization')) h.set('Authorization', 'Bearer ' + t);
  o.headers = h;
  } catch (e) {
  o.headers = Object.assign({}, o.headers || {}, { 'Authorization': 'Bearer ' + t });
  }
  return o;
  }

  /* 🩺 شغّل على السيرفر التاني لو الرئيسي واقع */
  const ORIG = ORIG_FETCH;
  window.fetch = function (url, opts) {
  const s = String(url || '');
  if (s.indexOf(SERVERS[0].url) !== 0) return ORIG.apply(this, arguments);

  const opt = _withToken(url, opts);
  const guarded = AUTH_PATHS.indexOf(_pathOf(url)) !== -1;

  return ORIG.call(this, url, opt)
  .then(function (r) {
  /* السيرفر رجّع error حقيقي (مش شبكة) — مفيش failover */
  if (r.status >= 500) window.OCTAServer.failover();
  /* ⛔ ⛔ التوكن مرفوض أو مش موجود ← الموقع كله هيطلع فاضي
  والـuser مش هيعرف السبب. الحل الوحيد: نقوله ونرجّعه للبابة
  بدل ما نسيبه قدام صفحة صامتة. */
  /* ⛔⛔⛔⛔ كان فيComparison  `r.path !== '/api/auth/me'`
  و-response مالوش `path`  undefined  فالمقارنة
  دايماً true  يعني **كل** 4٠١  حتى لو
  /api/auth/me  كان عايز يتجاهل  بيطرد المستخدم.

  ⭐ الحل  نقارن بالمسار الحقيقي  اللي إحنا طالبيناه. */
  /* ⛔⛔⛔⛔ ⭐ القاعد�� الجديدة 
  ⛌ 4٠١  معناها «التوكن مش صالح»  مش «الموقع وقع».
  ⛌ كان أي طلب واحد بيرجع 4٠1  بيطرد المستخدم فوراً
  ⛌ حتى لو الباقي شغال  والمستخدم كان داخل للتو.
  ⛌ دلوقتي  بنتجاهل الطلب ده  ونكمل عادي
  والبوابة لوحدها تتحقق عند فتح الصفحة. */
  if (guarded && r.status === 401) {
  try { console.warn('[OCTA] ' + _pathOf(url) + ' محمي  توكن ناقص'); }
  catch (e) { }
  }
  return r;
  })
  .catch(function (e) {
  /* شبكة — جرّب السيرفر التاني */
  window.OCTAServer.failover();
  const nu = String(url).replace(SERVERS[0].url, window.OCTA_API);
  return ORIG.call(window, nu, _withToken(nu, opts));
  });
  };
})();
