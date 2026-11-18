/* ══════════════════════════════════════════════════════════════
  👤 الحسابات — واجهة تسجيل الدخول
  ──────────────────────────────────────────────────────────────
  ✅ الموقع كله مفتوح للزوار
  🔒 بس المحفظة والمنبهات ليهم حساب
  ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function apiBase() {
  try { return (typeof OCTA_API !== 'undefined' && OCTA_API) || ''; }
  catch (e) { return ''; }
  }

  /* ═══════════════════════════════════════════════════════════════
  🩺 الجولة ١٨ (P3) — ⛔ خطأ البنية ⇒ رسالة **محدّدة** ⬇️
  ───────────────────────────────────────────────────────────────
  📌 الـworker بيرجّع (لما الـAPI مش موصل):
       {ok:false, error:'الخدمة مؤقتًا غير متاحة', why:'api_unreachable'}
  📌 قبل: الرد كان 530 بنص إنجليزي (مش JSON) ⇒ الواجهة قلّت
     «حصل خطأ» ⇒ المستخدم مش فاهم إن الخدمة نفسها مش شغّالة.
  ⛔ الرسالة دي **محدّدة** — وبتقول للمستخدم يعمل إيه.
  ⛔ باقي الرسائل (باسورد غلط · إيميل مكرر · ...) زي ما هي.
  ═══════════════════════════════════════════════════════════════ */
  var API_DOWN_MSG = 'الخدمة مؤقتًا غير متاحة — جرّب بعد قليل';
  var API_DOWN_HINT = 'افحص حالة الخدمة';

  function getToken() {
  try { return localStorage.getItem('octa_token') || ''; } catch (e) { return ''; }
  }

  function setUser(token, user) {
  try {
  localStorage.setItem('octa_token', token);
  localStorage.setItem('octa_user', JSON.stringify(user || {}));
  window.OCTA_USER_ID = (user && user.id) || '';
  /* ⭐⭐ ١٤ نوفمبر ٢٠٢٦ — السبب الجذري لـ«آخر ظهور» قديم و٢٣٪ زيارات
     غير منسوبة: الـuid كان في الذاكرة بس ⇒ أي تحديث للصفحة بيمسحه.
     دلوقتي بنحفظه مع الـtoken ⇒ كل page_view بعد التحديث ليها uid. */
  try { localStorage.setItem('octa_uid', window.OCTA_USER_ID || ''); } catch (e) { }
  } catch (e) { }
  }

  function clearUser() {
  /* ⭐⭐⭐ ١٤ نوفمبر ٢٠٢٦ — ⛔ الباج: كان بيمسح الـlocalStorage بس
     ⛔ فالكوكي HttpOnly بيفضل موجود ⇒ الـWorker شايف جلسة ⇒ المستخدم
     ⛔ بيدخل تاني فوراً بعد «تسجيل الخروج».
     ⭐ الحل: نبلّغ السيرفر (/api/auth/logout) ⇒ هو يمسح الكوكي ويلغي
     كل التوكنات القديمة (token_epoch) — ونستنى الرد قبل الـreload. */
  /* 🐞🛡️ ١٥ نوفمبر ٢٠٢٦ — ⛔ نجمع التوكن **قبل** المسح ⬇️
     📌 ⬇️ (بعد المسح مفيش Bearer ⇒ الخروج يعتمد على الكوكي بس) ⬇️
     📌 ⬇️ ⇒ لو الكوكي مش موجود ⇒ الخروج يفشل ⇒ نبيه المستخدم ⬇️ */
  var _tok = '';
  try { _tok = localStorage.getItem('octa_token') || ''; } catch (e) {}
  /* ① مسح المتصفح **قبل** التنقل (التنقل بيوقف السكربت فوراً) */
  try {
  localStorage.removeItem('octa_token');
  localStorage.removeItem('octa_user');
  try { localStorage.removeItem('octa_uid'); } catch (e) { }
  window.OCTA_USER_ID = '';
  } catch (e) { }
  var done = function () { try { location.reload(); } catch (e) { } };
  /* 🐞🛡️ ١٥ نوفمبر ٢٠٢٦ (دفعة الأمان ٠٢ · المراجعة الأمنية) — ⛔⛔⛔ ⬇️
     📌 ⬇️ ⛔ كان: تنقل GET ⇒ الرد كان بيرجع فوراً ⬇️ ⬇️ ⬇️
     📌 ⬇️ ⛔ والإبطال في الخلفية ⇒ «خرج» والتوكن لسه صالح ⬇️ ⬇️ ⬇️
     📌 ⬇️ ✅ الحل: POST + **ننتظر** الرد ⬇️ ⬇️ ⬇️
     📌 ⬇️ ✅ ونتحقق إن `revoked=true` ⬇️ ⬇️ ⬇️
     📌 ⬇️ ✅ ولو فشل ⇒ **مافيش** «نجاح» كاذب (نقوله للمستخدم) ⬇️ ⬇️ ⬇️
     📌 ⬇️ (الكوكي HttpOnly ⇒ المتصفح ما يقدرش يمسحه بنفسه) ⬇️ ⬇️ ⬇️ */
  var _fallback = function () {
    try { location.replace('/api/auth/logout'); } catch (e) { done(); }
  };
  try {
    var _h = { method: 'POST', credentials: 'include', keepalive: true };
    var _t = _tok || '';
    if (_t) _h.headers = { 'Authorization': 'Bearer ' + _t };
    fetch('/api/auth/logout', _h).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok && j && j.revoked === true) {
          try { location.replace('/gate.html'); } catch (e) { done(); }
        } else {
          /* ⛔ فشل ⇒ نقول الحقيقة ⬇️ (وماننظّفش حاجة) ⬇️ */
          alert('ما قدرناش نقفل الجلسة على السيرفر.\nحاول تاني أو اعمل "تنظيف الموقع" من صفحة البوابة.');
          done();
        }
      });
    }).catch(function () { _fallback(); });
  } catch (e) { _fallback(); }
  }

  function getUser() {
  try { return JSON.parse(localStorage.getItem('octa_user') || 'null'); }
  catch (e) { return null; }
  }

  /* ⭐⭐ ١٤ نوفمبر ٢٠٢٦ — استرجاع الـuid من localStorage عند تحميل الصفحة.
     ⛔ لازم يبقى قبل أي page_view ( octaTrack بيرجع للـuid المحفوظ كمان). */
  try {
  if (!window.OCTA_USER_ID) {
  window.OCTA_USER_ID = localStorage.getItem('octa_uid') || '';
  if (!window.OCTA_USER_ID) {
  var _u = null;
  try { _u = JSON.parse(localStorage.getItem('octa_user') || 'null'); } catch (e) { }
  if (_u && _u.id) { window.OCTA_USER_ID = _u.id; localStorage.setItem('octa_uid', _u.id); }
  }
  }
  } catch (e) { }

  function esc(s) {
  return String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ═══ النافذة ═══ */
  function modal(html) {
  var h = document.createElement('div');
  h.id = 'authHost';
  h.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.76);' +
  'backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:18px';
  h.innerHTML = '<div class="au-box">' + html + '</div>';
  document.body.appendChild(h);

  h.addEventListener('click', function (e) {
  if (e.target === h) h.remove();
  });
  return h;
  }

  function msg(t, ok) {
  var el = document.getElementById('auMsg');
  if (!el) return;
  el.textContent = t;
  el.style.color = ok ? '#22c55e' : '#ef4444';
  el.style.fontSize = '.78rem';
  el.style.marginTop = '9px';
  el.style.lineHeight = '1.7';
  }

  /* ═══ حالة السوق ═══
  ⛌ المصدر الوحيد = محرّك مواعيد البورصة المصرية (assets/js/octa-clock.js).
  ⛌ ممنوع نحسب الساعات بأنفسنا · ممنوع API call · ممنوع قيمة ثابتة.
  الملف بينشر `window.EGXClock` — بنقبل الاسم التاني كمان لو اتغيّر. */
  function clock() {
  return (typeof window.EGXClock !== 'undefined' && window.EGXClock) ||
  (typeof window.OCTAClock !== 'undefined' && window.OCTAClock) || null;
  }

  /* ⏱️ إعادة القراءة — الفترة بيجيبها المحرك نفسه (٥ ثواني وقت
  التداول · دقيقة برّه · ١٥ دقيقة في العطلة). إحنا مش بنخترع وقت. */
  var mktTimer = null;

  function stopMkt() {
  if (mktTimer) { clearInterval(mktTimer); mktTimer = null; }
  }

  function paintMkt(btn) {
  if (!btn || !document.contains(btn)) return;
  var C = clock();
  var st = null;
  try { st = (C && typeof C.state === 'function') ? C.state() : null; }
  catch (e) { st = null; }

  var txt = btn.querySelector('.au-mkt-t');
  var on = !!(st && st.open);
  btn.classList.toggle('on', on);
  btn.classList.toggle('off', !on);
  /* ⛌ لو المحرك لسه مااشحملش بنكتب «—» مش «متوقف» — أحسن من
  حالة غلط. الحالة الحقيقية بتظهر أول ما المحرك يجهز. */
  if (txt) txt.textContent = st ? (on ? 'شغال' : 'متوقف') : '—';

  /* العنوان = تفاصيل الحالة الحقيقية (الجلسة + الموعد الجاي) */
  var full = st
  ? 'حالة السوق: ' + (st.t || '—') + (st.nextAt ? ' · التالي ' + st.nextAt : '')
  : 'حالة السوق: غير متاحة';
  btn.setAttribute('title', full);
  btn.setAttribute('aria-label', full);
  }

  function watchMkt(btn) {
  stopMkt();
  var C = clock();
  if (!C || typeof C.period !== 'function') {
  /* ⛌ محرك المواعيد بيجي بعدنا في ترتيب السكربتات — نستنى
  تحميل الصفحة ونجرب تاني بدل ما نعرض حالة مخترعة. */
  window.addEventListener('load', function () {
  if (document.contains(btn)) { paintMkt(btn); watchMkt(btn); }
  }, { once: true });
  return;
  }
  mktTimer = setInterval(function () { paintMkt(btn); }, C.period());
  }

  /* ═══ مكان الكارت ═══
  ⛌ الشريط القديم كان `position:fixed` فوق الـNorth-west وكان
  بيغطي الهيدر — اتشال كله. مكانه دلوقتي جوّه الهيدر نفسه
  (شريط #auSlot في index.html)، فالصف بيكبر بالقدر المناسب
  وبيختفي معاه لما الهيدر ينطوي. */
  function host() {
  return document.getElementById('auSlot') ||
  document.querySelector('.octa-brand-right') || null;
  }

  /* 🕐 زر حالة السوق — نقطة + كلمة. دوس عليه يفتح ذراع السوق. */
  function mktBtn() {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'au-mkt off';
  b.innerHTML = '<span class="au-dot"></span>' +
  '<span class="au-mkt-t" aria-live="polite">—</span>';
  b.addEventListener('click', function () {
  if (typeof window.openArm === 'function') window.openArm('market');
  });
  return b;
  }

  /* 👋 «مرحبا {الاسم}» — الاسم من حالة المستخدم نفسها
  (OCTAAuth.user().name) — نفس مصدر لوحة الإعدادات.
  ⛌ مفيش صورة ولا حرف أول: الكارت صغير أوي في هيدر ٣٠px،
  والحرف العربي الصغير بيطلع مش واضح. */
  function userCard(name) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'au-bar';
  b.title = 'حسابي';
  b.innerHTML = '<span class="au-hello">' +
  '<span class="au-hi">مرحبا</span>' +
  '<b class="au-name" dir="auto">' + esc(name) + '</b>' +
  '</span>';
  b.addEventListener('click', function () {
  if (window.OCTASettings && typeof OCTASettings.tab === 'function') OCTASettings.tab('more');
  });
  return b;
  }

  /* زائر — دعوة صغيرة، من غير ما تكبر الهيدر */
  function guestCard() {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'au-bar au-guest';
  b.innerHTML = '<span class="au-hello"><b class="au-name">تسجيل الدخول</b></span>';
  b.addEventListener('click', function () { window.OCTAAuth.show('login'); });
  return b;
  }

  /* ═══ تسجيل / دخول ═══ */
  window.OCTAAuth = {
  user: getUser,
  token: getToken,
  logout: clearUser,

  show: function (mode) {
  var isLogin = mode === 'login';
  var h = modal(
  '<button class="au-x" onclick="document.getElementById(\'authHost\').remove()">✕</button>' +
  '<h2 class="au-h">' + (isLogin ? '🔑 تسجيل الدخول' : '👤 حساب جديد') + '</h2>' +
  '<p class="au-sub">' + (isLogin
  ? 'ادخل الكود بتاعك — نفس الكود اللي سجّلت بيه'
  : 'الكود السري هو اللي بيفتح محفظتك ومنبهاتك. سيبه لو نسيته.') + '</p>' +
  '<input id="auName" class="au-in" placeholder="اسمك (اختياري)" maxlength="40" ' +
  (isLogin ? 'style="display:none"' : '') + '>' +
  '<input id="auKey" class="au-in" type="password" placeholder="الكود السري (6 حروف على الأقل)" maxlength="80">' +
  (isLogin ? '' :
  '<input id="auMail" class="au-in" type="email" placeholder="إيميل (اختياري — لو نسيت الكود)" maxlength="120">') +
  '<div id="auMsg"></div>' +
  '<button class="au-go" id="auGo">' + (isLogin ? 'دخول' : 'أنشئ حسابي') + '</button>' +
  '<div class="au-alt">' + (isLogin
  ? 'ما عندكش حساب؟ <a href="javascript:OCTAAuth.show(\'reg\')">اعمل واحد</a>'
  : 'عندك حساب؟ <a href="javascript:OCTAAuth.show(\'login\')">ادخل</a>') +
  ' · <a href="javascript:document.getElementById(\'authHost\').remove()">إلغاء</a></div>' +
  '<div class="au-note">🔒 الكود بيتخزن مشفّر — مينفعش حد يقراه</div>');

  var go = document.getElementById('auGo');
  var keyIn = document.getElementById('auKey');

  function submit() {
  var key = keyIn.value.trim();
  if (key.length < 6) { msg('❌ الكود 6 حروف على الأقل', false); return; }
  go.disabled = true;
  go.textContent = '⏳ لحظة…';

  var body = { key: key };
  if (!isLogin) {
  body.name = document.getElementById('auName').value.trim();
  var m = document.getElementById('auMail');
  if (m && m.value.trim()) body.email = m.value.trim();
  }

  fetch(apiBase() + '/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
  }).then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
  .then(function (o) {
  if (o.d && o.d.ok) {
  setUser(o.d.token, o.d.user);
  try { octaTrack('signup', 'auth', ''); } catch (e) { }
  h.remove();
  OCTAAuth.refresh();
  } else {
  /* 🩺 الجولة ١٨ (P3) — ⛔ البنية مش شغّالة ⇒ مش «حصل خطأ» ⬇️ */
  if (o.d && o.d.why === 'api_unreachable') {
  msg('⚠️ ' + API_DOWN_MSG + ' — ' + API_DOWN_HINT, false);
  go.disabled = false;
  go.textContent = isLogin ? 'دخول' : 'أنشئ حسابي';
  return;
  }
  msg('❌ ' + ((o.d && o.d.error) || 'حصل خطأ'), false);
  go.disabled = false;
  go.textContent = isLogin ? 'دخول' : 'أنشئ حسابي';
  }
  }).catch(function (e) {
  /* 🛡️ R23 (الجولة ٢٣) — ⛔ الحارس رفض الطلب ⇒ سبب **محدّد**
  📌 (وجهة مقفولة · نفق · DNS · مش رادّة) — مش «الاتصال فشل». */
  var gm = '';
  try {
   var gc = (e && e.octaGuard && e.octaGuard.code) ? String(e.octaGuard.code) : '';
   if (gc && window.OCTAOriginGuard && typeof window.OCTAOriginGuard.messageFor === 'function') {
    gm = window.OCTAOriginGuard.messageFor(gc);
   }
  } catch (x) { gm = ''; }
  msg('❌ ' + (gm || 'الاتصال فشل — حاول تاني'), false);
  go.disabled = false;
  go.textContent = isLogin ? 'دخول' : 'أنشئ حسابي';
  });
  }

  go.addEventListener('click', submit);
  keyIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  setTimeout(function () { keyIn.focus(); }, 60);
  },

  /* ═══ كارت الحساب — جوّه الهيدر ═══ */
  refresh: function () {
  stopMkt();

  /* ⛌ تشريحة: لو نسخة قديمة من الكود لسا شغالة في الذاكرة
  (hot reload / refresh متكرر) — نشيل مستطيلها ونبدأ نظيف. */
  var legacy = document.getElementById('auBar');
  if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);

  var h = host();
  /* ⛌ مفيش هيدر = مفيش كارت. ممنوع نرجع نطفو فوق الشاشة. */
  if (!h) return;

  /* نمسح نسختنا بس — ما نمسشش كارت الساعة ولا زر الوضع */
  var olds = h.querySelectorAll('.au-bar, .au-mkt');
  for (var i = 0; i < olds.length; i++) {
  if (olds[i].parentNode) olds[i].parentNode.removeChild(olds[i]);
  }

  var u = getUser();
  var name = (u && u.name) ? String(u.name).trim() : '';
  h.appendChild(name ? userCard(name) : guestCard());

  var b = mktBtn();
  h.appendChild(b);
  paintMkt(b);
  watchMkt(b);
  }
  };

  /* شغّل لما الصفحة تجهز */
  if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { window.OCTAAuth.refresh(); });
  } else {
  window.OCTAAuth.refresh();
  }
})();
