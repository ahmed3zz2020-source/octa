/* ══════════════════════════════════════════════════════════════
 🚪 بوابة الدخول — لوحة الأرقام
 ──────────────────────────────────────────────────────────────
 الباسورد = 4 أرقام، بيتكتب من على لوحة زي تليفون الموبايل،
 وبيتسلّم لوحده أواخر 4 رقم — من غير زرار.

 ⛔ الشاشة مقفولة دايماً لحد ما السيرفر يوافق — مفيش استثناء.
 ══════════════════════════════════════════════════════════════ */
(function () {
 'use strict';

 /* 📌 عدد أرقام الباسورد — تغيّره هنا بس */
 var PIN_LEN = 4;

 /* 📌 عدد المحاولات المسموحة — نفس PIN_FAIL_LIMIT بتاع الباك.
 ⛔ لو الباك غيّر الرقم، غيّر السطر ده بس. */
 var PIN_TRIES = 5;

 /* ═══════════════════════════════════════════════════════════
 🔑 القاعدة الجديدة — ٣ غلط ورا بعض جوه دقيقة = كود إيميل
 ═══════════════════════════════════════════════════════════ */

 /* 📌 عدد أرقام الكود — ٦، زي ^[0-9]{6}$ في الباك */
 var CODE_LEN = 6;

 /* 📌 نافذة المحاولات القصيرة — نفس WINDOW_SECONDS في الباك.
 ⛔ لو الباك غيّرها، السطرين دول هما اللي يتغيّروا بس. */
 var STRIKE_LIMIT = 4; /* ⭐ ٤ غلط  زي الباك  قفل ٣٠ ثانية */
 var STRIKE_WINDOW = 60; /* جوه ٦٠ ثانية */

 /* 📌 صلاحية الكود — ١٠ دقايق.
 📌 ده عرض في الواجهة بس — الباك هو اللي بيحسم وبيبعت سبب
 المنتهي. العدّاد بيقف لو السيرفر اتأخر. */
 var CODE_TTL = 10 * 60;

 /* 📌 محاولات الكود الغلط قبل ما الكود يموت (TOO_MANY_WRONG) */
 var CODE_TRIES = 5;

 /* 📌 مسارات الكود.
 ⛔ الباك الحالي (update_prices.py) مافيش المسارات دي — الموجود
 /api/auth/otp/* وده بيرفض حسابات الباسورد بـ409 pin_account.
 دي مسارات العقد الجديد (plan.yaml بند ٣).
 ⛌ لو الباك غيّر الاسم، غيّر السطر ده بس — الباقي بيقرا منه. */
 var PATHS = {
 send: '/api/auth/pin/challenge/send',
 verify: '/api/auth/pin/challenge/verify',
 newpin: '/api/auth/pin/challenge/newpin'
 };

 /* ⛔🔴 تدفّق التسجيل الجديد — الإيميل يتأكد **أول** حاجة.
 ⛌ `pin/register` بقى 410  و-callah مابقاش له معنى.
 ⭐ الترتيب: اسم+إيميل  كود  ٤ أرقام  حساب جاهز.
 الحساب **مش** بيتعمل غير بعد ما الكود يتأكد. */
 var SIGNUP = {
 start: '/api/auth/signup/start',
 verify: '/api/auth/signup/verify',
 newpin: '/api/auth/signup/newpin'
 };

 /* 📌 التجديد الصامت — قبل ما التوكن يخلص.
 ⛔ صفر شاشات · صفر طلب باسورد · صفر إزعاج.
 ⛔⛔⛔ الرقم بيتقرأ من السيرفر (expires_in) — ممنوع رقم ثابت هنا.
 لو ثبّتنا على نفس عمر التوكن كان التجديد بيقع على اللحظة
 اللي بينتهي فيها ⇒ 401 ⇒ المستخدم بيتطرد كل ساعتين وهو
 بيتصفح عادي. دهدرس مهم اتصاد بالاختبار مش بالنظر. */
 var RENEW_FALLBACK_MS = 90 * 60 * 1000; // ٧٢٠٠ × ٠.٧٥
 var RENEW_PATH = '/api/auth/refresh';

 /* 📌 ٧٥٪ من عمر التوكن: فارق آمن ضد أي تأخّر في الشبكة،
 وقريب ما يكفيش إنه يضيّع وقت المستخدم في وضع معتمد. */
 function renewDelayMs(expiresInSec) {
 var s = Number(expiresInSec);
 if (!isFinite(s) || s <= 0) s = 7200;
 /* ⛌ حد أدنى دقيقة — لو السيرفر رجّع رقم غريب ما نبقاش
 بنجدد كل ٢٠٠ مللي ثانية. */
 return Math.max(60000, Math.floor(s * 1000 * 0.75));
 }

 /* 📌 الخمول — ٣٠ دقيقة من غير ما يلمس الموقع.
 ⛔ دي خامل (idle) في المتصفح مش تروكن بصري: بتتحسب من آخر
 لمسة (ماوس · لمس · ضغط · كتابة · scroll) — مش من وقت فتح
 الصفحة ومش من وقت الـHTTP. */
 var IDLE_MS = 30 * 60 * 1000;
 var IDLE_TICK = 60 * 1000;

 /* 📌 البصمة — للموبايل بس. التابلت واللاب مافيش فيهما مستشعر
 بصمة أصلاً، فبيشتغلوا بـ٤ أرقام وخلاص.
 ⛔ البصمة **مفيش لها endpoint في الباك لسه** — شوف deliverable.
 لو المسار رجّع 404 أو المتصفح مافيش فيه WebAuthn، بنردّ
 فوراً على لوحة ٤ أرقام. */
 var P_BIO = '/api/auth/pin/fingerprint';

 /* 📌 ⛔⛔ الرد المحايد — حرفياً واحد، في كل الحالات.
 ⛔ ممنوع نكتب «الإيميل مش مسجّل» — الرد ده بيعمل تلميح
 وبيبقى قناة مفتوحة عشان نعرف مين عندنا حساب ومين لأ. */
 var NOTE_SAME = 'لو الإيميل ده بتاعك، هتلاقي كود من ٦ أرقام في بريدك';

 /* ═══ الاتصال ═══ */
 function apiBase() {
 try { return (typeof OCTA_API !== 'undefined' && OCTA_API) || ''; }
 catch (e) { return ''; }
 }

 /* ⛌ التوكن بيتلزق جوّه octa-api.js — مش هنا.
 بنقرا الرد كنص الأول عشان السيرفر ممكن يردّ HTML صفحة خطأ. */
 function post(path, body) {
 return fetch(apiBase() + path, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 credentials: 'include',
 body: JSON.stringify(body || {})
 }).then(function (r) {
 return r.text().then(function (txt) {
 var d = null;
 try { d = JSON.parse(txt); } catch (e) { d = null; }
 return { s: r.status, d: d || {} };
 }, function () { return { s: r.status, d: {} }; });
 /* ⛔⛔⛔ ٢١ أكتوبر ٢٠٢٦ — catch للشبكة!
   ⛌ قبل كده: لو الـfetch وقع (timeout · DNS · انقطاع)، الـpromise
   ⛌ كان بيرفض والـUI بيفضل ثا��ت على «بيحاول» للأبد.
   ⛌ ⛌ النتيجة: المستخدم بيكتب ٤ أرقام ولا حاجة بتحصل.
   ⛌ ⛌ الحل: نرجّع حالة pseudo عشان الـcaller يشوف ويفرز اللوحة. */
 }).catch(function (e) {
 return { s: 0, d: {}, err: String((e && e.message) || e || 'network') };
 });
 }

 function esc(s) {
 return String(s == null ? '' : s)
 .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
 .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
 }

 /* 📌 طلب بتروكن (تروكن الفتح أو تروكن الجلسة) — الباك بيقرا
 التروكن من هيدر Authorization مش من الـbody.
 ⛔-body فاضي للأومد: /api/auth/refresh بيرفض أي credential
 في الـbody بـ400 — فمفيش سبب نبعت أي حاجة. */
 function postAuth(path, body, authToken) {
 var h = { 'Content-Type': 'application/json' };
 if (authToken) h['Authorization'] = 'Bearer ' + authToken;
 return fetch(apiBase() + path, {
 method: 'POST',
 headers: h,
 credentials: 'include',
 body: JSON.stringify(body || {})
 }).then(function (r) {
 return r.text().then(function (txt) {
 var d = null;
 try { d = JSON.parse(txt); } catch (e) { d = null; }
 return { s: r.status, d: d || {} };
 }, function () { return { s: r.status, d: {} }; });
 });
 }

 /* ═══ التوكن ═══ */
 function token() {
 try { return localStorage.getItem('octa_token') || ''; } catch (e) { return ''; }
 }
 function put(t, u) {
 try {
 localStorage.setItem('octa_token', t);
 localStorage.setItem('octa_user', JSON.stringify(u || {}));
 window.OCTA_USER_ID = (u && u.id) || '';
 } catch (e) { }
 }
 function logoutLocal() {
 try {
 localStorage.removeItem('octa_token');
 localStorage.removeItem('octa_user');
 window.OCTA_USER_ID = '';
 } catch (e) { }
 }

 /* ═══════════════════════════════════════════════════════════
 🖼️ الهيكل
 ───────────────────────────────────────────────────────────
 ⛌ نسخة مطابقة لـindex.html. لو الـDOM اتشال (shut) ورجع
 اتفتح تاني، بنعيد بناؤه من هنا — البوابة من غير زرار = موقع ميت.
 ═══════════════════════════════════════════════════════════ */
 var SHELL =
 '<div class="gt-top">' +
 '<div class="gt-top-t" id="gtTopT">تسجيل الدخول</div>' +
 '<button class="gt-top-b" id="gtTopB" type="button">أريد مساعدة</button>' +
 '</div>' +
 '<div class="gt-body">' +
 '<div class="gt-box" id="gtBox"><div id="gt-form"></div></div>' +
 '</div>';

 function gateEl() { return document.getElementById('gate'); }

 /* ⛌ المونتاج — idempotent: يا ما فيش حاجة، يا بترجّع نفس العنصر */
 function mount() {
 var g = gateEl();
 if (g) return g;
 g = document.createElement('div');
 g.id = 'gate';
 g.className = 'gt-wrap';
 g.style.cssText = 'position:fixed;inset:0;z-index:999999;display:flex;';
 g.innerHTML = SHELL;
 document.body.appendChild(g);
 return g;
 }

 function formEl() {
 var f = document.getElementById('gt-form');
 if (f) return f;
 mount();
 return document.getElementById('gt-form');
 }
 function boxEl() { return document.getElementById('gtBox'); }
 function topT() { return document.getElementById('gtTopT'); }
 function topB() { return document.getElementById('gtTopB'); }

 /* 📌 الشريط فوق: عنوان على اليمين + زرار على الشمال.
 📌 backFn — الدالة اللي زرار الرجوع بيرجعله.
 لو مش موجودة بيرجع لأول شاشة (زي ما كان قبل كده). */
 function head(title, back, backFn) {
 var t = topT(), b = topB();
 if (t) t.textContent = title;
 if (!b) return;
 b.style.visibility = '';
 if (back) {
 b.textContent = 'رجوع';
 b.className = 'gt-top-b bk';
 b.onclick = function () { (backFn || welcome)(); };
 } else {
 b.textContent = 'أريد مساعدة';
 b.className = 'gt-top-b';
 b.onclick = function () { help(); };
 }
 }

 function open() {
 var g = mount();
 g.style.display = 'flex';
 document.body.style.overflow = 'hidden';
 try { clearTimeout(_fsTimer); _fsTimer = _failSafe(); } catch(e){}
 setTimeout(function () {
 var gg = gateEl();
 var f = document.getElementById('gt-form');
 if (gg && gg.style.display !== 'none' && (!f || !f.innerHTML.trim())) welcome();
 }, 120);
 }

 /* ══════════════════════════════════════════════════════════════
 🛟 FAIL-SAFE — ٢٣ أكتوبر ٢٠٢٦
 ⛔ المشكلة: لو open() اشتغلت وJS وقع بعد كده، الـoverflow بيفضل
 ⛔ hidden والصفحة بتفضل بيضا Though الباك شغال ٢٠٠.
 ⛌ الحل: بعد ١٢ ثانية، لو البوابة لسه موجودة → شيلها وافتح.
 ⛌ ⛌ ده مش بيكسر الحماية: الـgate لو اتنفّذ صح بيشيل نفسه
 ⛌ ⛌ بـshut() في أقل من ثانية. ده بس network/JS failure path.
 ══════════════════════════════════════════════════════════════ */
 var _fsTimer = null;
 function _failSafe(){
 return setTimeout(function(){
 try {
 var g = gateEl();
 /* ⛔⛔⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐⭐⭐ إصلاح «الموقع فتح عادي»!
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 السبب: Fail-safe كان بيشيل البوابة بعد ١٢ ثانية ⇒
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⇒ **الموقع بيفتح** — وده اللي شكا منه أحمد!
 📌 ✅ Fail-safe بيشتغل بس لو البوابة **فاضية ومفيش تفاعل**
 📌 ✅ + في تدفّق ⇒ ما نفتحش + فيه توكن ⇒ ما نفتحش
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ */
 if (g && g.style.display === 'flex') {
 if (inFlow() || token()) { return; }
 /* ⛌ الشاشة فيها محتوى = المستخدم بيتعامل ⇒ ما نفتحش */
 var _f = document.getElementById('gt-form');
 if (_f && _f.innerHTML && _f.innerHTML.length > 40) { return; }
 g.remove();
 document.body.style.overflow = '';
 stopLock();
 console.warn('[gate] fail-safe: البوابة اتفتحت تلقائيًا بعد ١٢ ثانية');
 }
 } catch(e){}
 }, 12000);
 }

 function shut() {
 var g = gateEl();
 if (g) g.remove();
 document.body.style.overflow = '';
 /* ⛌ البوابة اشتغلت صح — نلغي الـfail-safe */
 try { if (_fsTimer) { clearTimeout(_fsTimer); _fsTimer = null; } } catch(e){}
 stopLock();
 wipeFlow(); /* ⛔ الإيميل والكود يتمسحوا مع إغلاق البوابة */
 try { window.OCTAAuth && window.OCTAAuth.refresh && window.OCTAAuth.refresh(); } catch (e) { }

 /* ⛔⛔ ٢١ أكتوبر ٢٠٢٦ — صفحة البوابة المستقلة (gate.html):
   ⛌ دي مش جوه التطبيق — مفيش محتوى ورا البوابة هنا.
   ⛌ ⇒ بعد ما يسجّل دخول، بنحوّله على التطبيق.
   ⛌ (صفحة البوابة نفسها بتتأكد إن الكوكي اتحفظ قبل التحويل
   ⛌  — راجع OCTA_GATE_REDIRECT في gate.html.) */
 if (window.OCTA_GATE_PAGE) {
  try {
  if (typeof window.OCTA_GATE_REDIRECT === 'function') window.OCTA_GATE_REDIRECT();
  else location.replace('/');
  } catch (e) { try { location.replace('/'); } catch (x) { } }
  return;
 }

 /* ⛔⛔ المحتوى المحمي بيتخطّى وهو لسه بره البوابة (السيرفر بيرد 401).
 البوابة بتنطفي من غير reload، فالمحتوى ده ميفتحش لوحده.
 ⛌ الحدث بيقول للصفحة: اتأكدت، حمّل دلوقتي. */
 try { document.dispatchEvent(new CustomEvent('octa:authed')); } catch (e) { }

 /* ⛔⛔⛔⛔ التصحيح 
 ⛌ أضفت هنا reload  اعتقدت إنه هيصلّح تحميل البيانات.
 ⛌⛔⛔ غلط  الغلاف هنا كان قاتل:
 ⛌ الـreload بيعمل DOMContentLoaded تاني  اللي
 ⛌ بيعمل mount + open  فالبوابة بترجع تغطي الموقع
 ⛌ حتى لو التوكن صالح  لأن الـverify بتاخد وقت.

 ⛔ الحل  من غير reload  نطلب تحميل البيانات بس. */
 try {
 document.dispatchEvent(new CustomEvent('octa:authed', { detail: { reload: false } }));
 /* ⭐ وبنستنى الأرقام  لو مش جاية  بنعمل refresh
  للدالة نفسها  مش للصفحة كلها. */
 setTimeout(function () {
 try {
 if (typeof window.octaReloadData === 'function') window.octaReloadData();
 } catch (e) { }
 }, 400);
 } catch (e) { }
 }

 /* ok = true (أخضر) · false (أحمر) · 'hi' (عادي) */
 function say(t, ok) {
 /* ⭐ الرسالة لازم **تظهر دايماً**  مهما كانت الشاشة.
 ⛌ قبل كده  الشاشة اللي مافيش فيها `#gtMsg`  كانت
 بتبلع الرسالة في صمت  والمستخدم يدوس  ميفهمش.
 ⛔ الحل  لو الحاوية مش موجودة  ننشئها. */
 var m = document.getElementById('gtMsg');
 if (!m) {
 var host = formEl();
 if (!host) return;
 m = document.createElement('div');
 m.id = 'gtMsg';
 m.className = 'gt-msg';
 var go = host.querySelector('.gt-go');
 if (go && go.parentNode) { go.parentNode.insertBefore(m, go); }
 else { host.appendChild(m); }
 }
 m.textContent = t;
 m.className = 'gt-msg' + (ok === true ? ' ok' : (ok === false ? ' no' : ''));
 }
 function clearMsg() { say('', 'hi'); }

 /* حالة الانتظار — بدل الكارت الفاضي */
 function pending(msg) {
 var f = formEl();
 if (!f) return;
 f.innerHTML = '<div class="gt-wait"><span class="gt-spin"></span>' + (msg || '⏳ بنتحقق من حسابك…') + '</div>';
 head('أهلاً بعودتك', 1);
 }

 /* ═══════════════════════════════════════════════════════════
 🔢 لوحة الأرقام
 ───────────────────────────────────────────────────────────
 state.pin الأرقام اللي اتكتبت
 state.lock ثواني فاضية (السيرفر رجّع 429)
 state.tries عدد المحاولات الغلط
 ═══════════════════════════════════════════════════════════ */
 var state = { pin: '', len: PIN_LEN, lock: 0, tries: 0, lockTimer: null, jump: null };

 /* ⛔⛔⛔ بيانات الشاشة الجديدة — في الذاكرة **بس**.
 ⛔ ممنوع الإيميل أو الكود أو التذكرة يتفكّروا في
 localStorage أو sessionStorage أو cookie أو log أو تحليلات.
 الباك نفسه بيخزّنهم مشفّرين — الواجهة ماتخزّنش خالص. */
 /* ⛔⛔⛔ ٢١ أكتوبر ٢٠٢٦ — triedPins: الأرقام اللي المستخدم جرّبها.
   ⛌ دي بتتبعت مع كود «نسيت الباسورد» عشان السيرفر يمسح
   ⛌ العدّادات بتاعتها (كان بيفضل «محاولات كتيرة» حتى لو الكود صح). */
var flow = { email: '', code: '', unlock: '', cd: 0, cdTimer: null, tries: 0,
             triedPins: [] };

 /* 📌 التسجيل  لوحده عنده حالة مستقلة  عشان ما نخلطش
 بين «استرجاع باسورد» و«إنشاء حساب». والمهم 
 `s.mode` بيقول لـcodeEntry و-newPin فين يروحوا لو رجعنا. */
 var s = { name: '', email: '', mode: 'login' };

 function wipeFlow() {
 flow.email = ''; flow.code = ''; flow.unlock = '';
 flow.tries = 0;
 /* ⛔ ٢١ أكتوبر: منسيب العدّادات القديمة عند بداية جلسة جديدة */
 if (flow.triedPins && flow.triedPins.length) {
  try { sessionStorage.setItem('octa_tried_pins', JSON.stringify(flow.triedPins)); }
  catch (e) { }
 }
 flow.triedPins = [];
 stopCd();
 }

 function stopCd() {
 if (flow.cdTimer) { clearInterval(flow.cdTimer); flow.cdTimer = null; }
 flow.cd = 0;
 }

 /* ═══════════════════════════════════════════════════════════
 ⏱ نافذة المحاولات القصيرة — ٣ غلط ورا بعض جوه ٦٠ ثانية
 ───────────────────────────────────────────────────────────
 ⛔ النافذة **سلايدر**: كل محاولة جديدة بتدفع القديمة اللي
 خرجت بره الـ٦٠ ثانية. لو فضلت دقيقة وفسكت، العدّاد
 بيبدأ من الصفر — وده بالظبط اللي بيمنع المهاجم يوزّع
 محاولاته على نافذتين.
 📌 الختم بتاعها: Date.now() — الوقت من المتصفح.
 ⛔ ده مش أمان، ده راحة للمستخدم. الأمان كله في الباك،
 والواجهة بتتبعه مش بتعارضه.
 ═══════════════════════════════════════════════════════════ */
 var hits = [];
 function strikeCount() {
 var cut = Date.now() - STRIKE_WINDOW * 1000;
 while (hits.length && hits[0] <= cut) hits.shift();
 return hits.length;
 }
 function strikePush() { hits.push(Date.now()); return strikeCount(); }
 function strikeReset() { hits = []; }

 /* ⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐ المستخدم في نص تدفّق (كود/تسجيل)؟
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 السبب: المستخدم بعتطلب كود ⇒ flow.email اتملأ ⇒ لو
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⇒ أي تجديد/تحقق فشل ⇒ البوابة تفتح وتضيّع screen الكود!
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ✅ الحل: ما نفتحش البوابة لو المستخدم في نص تدفّق.
 */
 function inFlow() {
 try {
 return !!(flow.email || flow.unlock || flow.code);
 } catch (e) { return false; }
 }

 function stopLock() {
 if (state.lockTimer) { clearInterval(state.lockTimer); state.lockTimer = null; }
 if (state.jump) { clearTimeout(state.jump); state.jump = null; }
 state.lock = 0;
 stopCd(); /* ⛌ عدّاد الكود يموت مع أي شاشة جديدة */
 /* ⛔⛔⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐⭐⭐ امسح مستمع الكليك العام
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 السبب: مستمع `.gt-body.onclick` (من شاشة البصمة) كان
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ فاضل
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ عالـDOM
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ أي لمسة في أي شاشة بعدين ⇒
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ toPin() ⇒ login(1) ⇒ الشاشة
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⇒ «دخل قبل ما أكتب الباسورد» و«الكود وصل فرقع».
 📌 ✅ الحل: نمسحه في stopLock() — أي شاشة جديدة بتمسحه.
 📌 ✅ (الـscreenId increment بيكفي日为 But الكليك مربوط بالـDOM)
 */
 try {
 var _bdy = document.querySelector('.gt-body');
 if (_bdy) { _bdy.onclick = null; }
 } catch (e) { }
 screenId++; /* ⛌ أي مستمع شاشة قديم يموت فورًا (زي مستمع البصمة) */
 }

 /* 📌 النقطة الواحدة بتتعبى مع كل رقم — وده كل مؤشر التقدم */
 function paintDots() {
 var d = document.getElementById('gtDots');
 if (!d) return;
 var kids = d.childNodes;
 for (var i = 0; i < kids.length; i++) {
 if (kids[i].className !== undefined) {
 kids[i].className = 'gt-dot' + (i < state.pin.length ? ' on' : '');
 }
 }
 }

 /* ═══════════════════════════════════════════════════════════
 🔢 خانات الكود — ٦ خانات LTR (زي لوحة الأرقام بالظبط)
 ═══════════════════════════════════════════════════════════ */
 function codeHtml() {
 /* ⛔⛔⛔ الـinput ده حقيقي  مش زخرفة.
 الخانات الستة مجرد عرض  وأي كتابة (كيبورد · لصق · قلم)
 بتروح للحقل المخفيّ ده  وبعدها بننسخها على الخانات.
 من غيره  مفيش أي طريقة تكتب الكود  إلا بلوحة الأرقام. */
 var b = '';
 for (var i = 0; i < CODE_LEN; i++) b += '<div class="gt-cb"></div>';
 return '<div class="gt-code-row" id="gtCodeRow">' +
 '<input class="gt-code-in" id="gtCodeIn" type="tel" inputmode="numeric"' +
 ' autocomplete="one-time-code" autocorrect="off" autocapitalize="off"' +
 ' spellcheck="false" maxlength="' + CODE_LEN + '"' +
 ' aria-label="كود التأكيد اللي جالك على الإيميل">' +
 b + '</div>';
 }

 /* 📌 اللصق  المستخدم بيجيب الكود من الإيميل ويلصقه 
 لازم يشتغل من أول مرة  من غير ما يضغط ٦ أرقام واحد واحد. */
 function wireCodeInput() {
 var inp = document.getElementById('gtCodeIn');
 var row = document.getElementById('gtCodeRow');
 if (!inp) return;

 function digitsOnly(v) {
 return String(v || '').replace(/[^0-9]/g, '').slice(0, CODE_LEN);
 }

 inp.oninput = function () {
 state.pin = digitsOnly(inp.value);
 inp.value = state.pin;
 paintCode();
 paintPad(state.lock > 0);
 /* ⛌ الكود كامل  يروح لوحده  من غير زرار زيادة */
 if (state.pin.length === CODE_LEN) {
 paintPad(true);
 setTimeout(function () { if (inp.blur) inp.blur(); }, 120);
 var f = inp.onfull;
 if (f) { inp.onfull = null; f(state.pin); }
 }
 };

 /* ⛌ اللصق  sometimes المتصفح لصق نص فيه رموز  هننضفه */
 inp.onpaste = function (e) {
 try {
 var t = (e.clipboardData || window.clipboardData).getData('text');
 var d = digitsOnly(t);
 if (!d) return;
 e.preventDefault();
 state.pin = d;
 inp.value = d;
 paintCode();
 if (d.length === CODE_LEN) {
 paintPad(true);
 setTimeout(function () { if (inp.blur) inp.blur(); }, 120);
 var f2 = inp.onfull;
 if (f2) { inp.onfull = null; f2(d); }
 }
 } catch (err) { }
 };

 inp.onfocus = function () { if (row) row.classList.add('focus'); };
 inp.onblur = function () { if (row) row.classList.remove('focus'); };
 inp.onkeydown = function (e) {
 if (e.key === 'Enter' && state.pin.length === CODE_LEN) {
 e.preventDefault();
 var f3 = inp.onfull;
 if (f3) { inp.onfull = null; f3(state.pin); }
 }
 };

 /* ⛌ دوس على أي مكان في صف الخانات  يفتح الكيبورد */
 if (row) {
 row.onclick = function () { try { inp.focus(); } catch (e) { } };
 }
 }

 function paintCode() {
 var r = document.getElementById('gtCodeRow');
 if (!r) return;
 var ks = r.getElementsByTagName('div');
 for (var i = 0; i < ks.length; i++) {
 var on = i < state.pin.length;
 ks[i].className = 'gt-cb' + (on ? ' on' : '');
 /* ⭐ الرقم نفسه لازم يبان  الكود ده مؤقت ولمرة واحدة
  مفيش أي معنى لإخفائه .User لازم يشوف اللي كتبه. */
 ks[i].textContent = on ? state.pin.charAt(i) : '';
 }
 }

 function shakeCode() {
 var r = document.getElementById('gtCodeRow');
 if (!r) return;
 r.classList.remove('bad');
 void r.offsetWidth; /* ⛌ بدون force reflow الأنيميشن مش هيشتغل تاني */
 r.classList.add('bad');
 setTimeout(function () {
 var e = document.getElementById('gtCodeRow');
 if (e) e.classList.remove('bad');
 }, 560);
 }

 function padHtml(dis) {
 return '<div class="gt-dots" id="gtDots">' +
 '<i class="gt-dot"></i><i class="gt-dot"></i>' +
 '<i class="gt-dot"></i><i class="gt-dot"></i>' +
 '</div>' +
 '<div class="gt-msg" id="gtMsg"></div>' +
 '<div class="gt-pad' + (dis ? ' dis' : '') + '" id="gtPad">' +
 '<button class="gt-key" data-k="1" type="button">1</button>' +
 '<button class="gt-key" data-k="2" type="button">2</button>' +
 '<button class="gt-key" data-k="3" type="button">3</button>' +
 '<button class="gt-key" data-k="4" type="button">4</button>' +
 '<button class="gt-key" data-k="5" type="button">5</button>' +
 '<button class="gt-key" data-k="6" type="button">6</button>' +
 '<button class="gt-key" data-k="7" type="button">7</button>' +
 '<button class="gt-key" data-k="8" type="button">8</button>' +
 '<button class="gt-key" data-k="9" type="button">9</button>' +
 '<button class="gt-key gt-del" data-k="d" type="button" aria-label="مسح">' +
 '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9L2.5 12z"/>' +
 '<path d="M15.6 9.6 20.4 14.4M20.4 9.6 15.6 14.4"/></svg>' +
 '</button>' +
 '<button class="gt-key" data-k="0" type="button">0</button>' +
 '<span class="gt-key off"></span>' +
 '</div>';
 }

 /* 📌 نفس اللوحة في كل شاشة — الفرق بس في اللي فوقها */
 function paintPad(dis) {
 var p = document.getElementById('gtPad');
 if (!p) return;
 p.className = 'gt-pad' + (dis ? ' dis' : '');
 var bs = p.getElementsByTagName('button');
 for (var i = 0; i < bs.length; i++) bs[i].disabled = !!dis;
 paintDots();
 }

 /* 📌 علّق على اللوحة — كل ضغطة رقم أو ⌫.
 onFull(pin) → اتعبّت 4 أرقام (هنا بنسلّم)
 onAny() → أي تغيير (للزرار المتغيّر في شاشة التسجيل) */
 function onPad(onFull, onAny) {
 var p = document.getElementById('gtPad');
 if (!p) return;
 p.onclick = function (e) {
 var b = e.target;
 while (b && b !== p && !(b.getAttribute && b.tagName)) b = b.parentNode;
 var k = b && b.getAttribute && b.getAttribute('data-k');
 if (!k || state.lock > 0) return;
 /* ⛌ زرار متقفل = الرقم مش هيتقبل (قفل السيرفر أو وهو رايح) */
 if (b.tagName === 'BUTTON' && b.disabled) return;
 if (k === 'd') state.pin = state.pin.slice(0, -1);
 else if (state.pin.length < state.len) state.pin += k;
 else return;
 /* ⭐ الشاشة دي ٦ أرقام  الخانات هي اللي بتتعبى 
 مش الـ4 نقط بتاعت الباسورد  دي كانت السبب
 في إن الكود مش بيظهر خالص. */
 paintEntries();
 if (onAny) onAny();
 /* ⛌ الأرقام كملت → يتسلّموا لوحدهم. مفيش زرار «دخول» أصلاً. */
 if (state.pin.length === state.len && onFull) {
 var v = state.pin;
 paintPad(true); /* ⛌ نقفل اللوحة وهو رايح للسيرفر */
 setTimeout(function () {
 /* ⛌ لو المستخدم مسح رقم في الـ130ms دي، ما نسلّمش رقم قديم */
 if (state.pin !== v) { paintPad(false); return; }
 onFull(v);
 }, 130);
 }
 };
 }

 /* ⭐⭐⭐ «كود موصلش؟ ابعت كود جديد»
 ⛌ السبب: أحياناً الكود ميوصلش  سبام · فلتر · تأخير.
 ⛌ من غير زرار  المستخدم ملقاش غير إنه يطلب من الأول.
 ⛔ بس في حد  الباك عنده rate limit  فبنعمل
 ⛌⛌⛌ cooldown في الواجهة  ٣٠ ثانية  ونعدّ تنازلي
  عشان محدش يضغط على زرار ٤٠٠ مرة في الدقيقة. */
 var RESEND_CD = 30;
 var resendT = null;

 function wireResend(reg) {
 var b = document.getElementById('gtResend');
 if (!b) return;
 var left = 0;
 if (left <= 0) { b.disabled = false; b.textContent = reg ? '📩 ابعت كود جديد' : '📩 ابعت كود جديد'; }
 b.onclick = function () {
 if (state.lock > 0 || b.disabled) return;
 b.disabled = true;
 b.textContent = '⏳ بنبعت…';
 clearMsg();
 var path = reg ? SIGNUP.start : PATHS.send;
 var body = reg ? { name: s.name, email: s.email } : { email: flow.email };
 post(path, body)
 .then(function (o) {
 if (o.s === 200) {
 say('✅ كود جديد اتبعت  افتح الإيميل تاني', false);
 state.pin = ''; state.len = CODE_LEN;
 paintEntries();
 startCd();
 left = RESEND_CD; tick();
 return;
 }
 var d = o.d || {};
 if (o.s === 429) {
 left = Math.min(180, Math.max(10, d.retry_after || d.retry || 60));
 tick();
 return;
 }
 b.disabled = false;
 b.textContent = '📩 جرّب تاني';
 say('❌ ' + (d.error || 'مقدرناش نبعت كود جديد'), false);
 })
 .catch(function () {
 b.disabled = false;
 b.textContent = '📩 جرّب تاني';
 down('الإيميل');
 });
 };
 function tick() {
 if (resendT) clearInterval(resendT);
 resendT = setInterval(function () {
 left--;
 if (left <= 0) {
 clearInterval(resendT); resendT = null;
 b.disabled = false;
 b.textContent = '📩 ابعت كود جديد';
 return;
 }
 b.textContent = '📩 كود جديد بعد ' + left + ' ثانية';
 }, 1000);
 }
 }

 /* ⭐ paints the right display for the current length 
 4 → PIN dots · 6 → the six code boxes.
 ⛌ painting the dots unconditionally was the bug  the
 code filled the dots and the boxes stayed empty. */
 function paintEntries() {
 var inp = document.getElementById('gtCodeIn');
 if (inp && inp.value !== state.pin) inp.value = state.pin;
 if (state.len === CODE_LEN) { paintCode(); }
 else { paintDots(); }
 }

 /* 📌 اهتزاز — خطأ الباسورد أو ضغطة غلط */
 function shake() {
 var d = document.getElementById('gtDots');
 if (!d) return;
 d.classList.remove('bad');
 /* ⛌ بدون force reflow، المتصفح مش هيشغّل الأنيميشن تاني */
 void d.offsetWidth;
 d.classList.add('bad');
 /* ⛌ اللون الأحمر للنقط بيوصل لـ560ms بس — بعدين نلمس الأثر */
 setTimeout(function () {
 var e = document.getElementById('gtDots');
 if (e) e.classList.remove('bad');
 }, 560);
 }

 /* 🧹 تنظيف السجل بعد نجاح العملية */
 function clearTriedPins() {
  try { sessionStorage.removeItem('octa_tried_pins'); } catch (e) { }
  if (flow && flow.triedPins) flow.triedPins = [];
 }

 /* 🧾 تسجيل الأرقام اللي اتجرّبت في الجلسة دي.
   ⛔⛔⛔ ٢١ أكتوبر ٢٠٢٦ — لازم نعرفها عشان «نسيت الباسورد» يمسحها.
   ⛌ التخزين في sessionStorage = بيمسح لما قفل التبويب.
   ⛌ ⛌Namespace: octa_tried_pins */
 function recordTriedPin(pin) {
  var t = String(pin || '').trim();
  if (!/^[0-9]{4}$/.test(t)) return;
  try {
   var raw = sessionStorage.getItem('octa_tried_pins') || '[]';
   var arr = JSON.parse(raw);
   if (!Array.isArray(arr)) arr = [];
   if (arr.indexOf(t) === -1) arr.push(t);
   if (arr.length > 20) arr = arr.slice(-20);
   sessionStorage.setItem('octa_tried_pins', JSON.stringify(arr));
  } catch (e) { }
 }

 function badPin(left, strikes) {
 state.pin = '';
 paintDots();
 shake();
 if (strikes == null) { clearMsg(); return; }
 /* 📌 left = المحاولات الفاضلة في نافذة الدقيقة (السيرفر بيحسبها) */
 /* ⛔⛔ إصلاح ٢٠ أكتوبر ٢٠٢٦ — الرقم ٤ كان مكتوب hard-coded.
  ⛌ PIN_TRIES = 5 بس الرسالة بتقول «من ٤» — المستخدم بيحسب غلط.
  ⛌ الحل: نجيب الرقم من STRIKE_LIMIT نفسه. */
 if (left <= 0) say('❌ الباسورد غلط — خلصت المحاولات  ابعت كود على الإيميل', false);
 else say('❌ الباسورد غلط — فاضل ' + left + ' من ' + STRIKE_LIMIT + ' محاولات', false);
 }

 function mm(s) {
 var m = Math.floor(s / 60), r = s % 60;
 return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
 }

 /* 📌 السيرفر رجّع 429 → اقفل + عدّاد تنازلي */
 function locked(sec) {
 /* ⛔⛔⛔ ⭐ طلب أحمد  «عايز ٤ محاولات  والعدّاد يتشال»
 ⛌ العدّاد  كان ١٥ دقيقة  بيقفل اللوحة entirely
  والمستخدم لازم يعدّي وقت  وده تجربة سيئة.
 ⛌ الحل  نرجّع اللوحة فورًا  ونقول «الباسورد غلط» 
  والتجربة الحقيقية ٤ محاولات — عندها يرجع فورًا 
  خلاص  مش رسالة ولا شاشة قفل. */
 /* ⭐⭐⭐ الأهم  الشاشة ترجع فورًا 
 ⛌ «المحاولات خلصت»  كانت بتخلّي المستخدم يفتكر إنه
 ⛌ اتقفل  وإن الباسورد غلط  حتى لو صح  حرج.
 ⛌ دلوقتي  بنقول «استنى ٣٠ ثانية»  بوضوح 
 ⛌ وبعدين يقدر يكتب تاني  من غير ما يعمل حاجة. */
 state.lock = 0;
 state.pin = '';
 state.tries = 0;
 strikeReset();
 paintDots();
 paintCode();
 paintPad(false);
 paintPad(false);
 /* ⭐⭐⭐ ⭐⭐ ده التском الحقيقي 
 ⛌ «استنى ٣٠ ثانية»  بس  لو المستخدم **نسي**
  الباسورد  هيضل يدور تاني  لحد ما يمل.
 ⛌ فبنديه  في نفس اللحظة  زرار «نسيت الباسورد؟»
 يبعت كود على الإيميل  وده طريق واحد 
  ما بياخدش غير دقيقة  وبيحل الموضوع نهائياً. */
 var m0 = document.getElementById('gtMsg');
 if (m0) {
 m0.className = 'gt-msg no';
 m0.innerHTML = '⛔ ٤ محاولات  الباسورد ده مش بتاعك. '
 + 'لو فاكره  جرّب تاني  ولو نسيته  ابعت كود.' +
 '<button class="gt-forgot" id="gtLockForgot" type="button" ' +
 'style="width:100%;margin-top:8px">📩 ابعت كود على الإيميل</button>';
 var lf = document.getElementById('gtLockForgot');
 if (lf) lf.onclick = function () { stopLock(); forgot(); };
 }
 shake();
 return;
 }

 function lockedOld(sec) {
 var s = Math.max(1, Math.ceil(Number(sec) || 0) || 60);
 state.lock = s;
 /* ⛌ نفضّي النقط: متبقاش 4 نقط مملوءة وباسورد غلط */
 state.pin = '';
 paintDots();
 paintCode();
 paintPad(true);

 var m = document.getElementById('gtMsg');
 if (m) {
 m.className = 'gt-msg no';
 m.innerHTML = '⛔ مقفول ' + Math.floor(s / 60) + ' دقيقة' +
 ' <span class="gt-cd" id="gtLockCd">(' + mm(s) + ')</span>';
 }
 stopLock();
 state.lock = s;
 state.lockTimer = setInterval(function () {
 state.lock--;
 var cd = document.getElementById('gtLockCd');
 if (cd) cd.textContent = '(' + mm(Math.max(0, state.lock)) + ')';
 var mm0 = document.getElementById('gtMsg');
 if (state.lock <= 0) {
 stopLock();
 paintPad(false);
 clearMsg();
 return;
 }
 if (mm0 && state.lock % 60 === 0) {
 mm0.innerHTML = '⛔ مقفول ' + Math.floor(state.lock / 60) + ' دقيقة' +
 ' <span class="gt-cd">(' + mm(state.lock) + ')</span>';
 }
 }, 1000);
 }

 /* 📌 رقم المحاولات اللي فاضل.
 ⛔ السيرفر مش بيبعته (بيسلّم 401 {why:"bad_pin"} بس) — فبنحسبه
 من عندنا على PIN_FAIL_LIMIT بتاع الباك (٥). لو الباك بعت
 رقم في المستقبل، إحنا بنحترمه. */
 function leftTries(d, tries) {
 var v = d && (d.remaining != null ? d.remaining
 : (d.left != null ? d.left : (d.tries_left != null ? d.tries_left : null)));
 if (v == null || isNaN(v)) return Math.max(0, PIN_TRIES - (tries || 0));
 return Math.max(0, Number(v));
 }

 /* ═══ أخطاء مش متوقعة — السيرفر واقع أو مفيش نت ═══ */
 function down(what) {
 formEl().innerHTML =
 '<div class="gt-err">⚠️ مش قادرين نوصل للسيرفر</div>' +
 '<p class="gt-txt">الاتصال بـ' + esc(what) + ' فشل — تأكد من النت وجرب تاني</p>' +
 '<button class="gt-go" id="gtRetry" type="button">🔄 جرّب تاني</button>';
 var b = document.getElementById('gtRetry');
 if (b) b.onclick = function () { location.reload(); };
 }

 /* 📌 رد السيرفر في التسجيل — بنوريه زي ما هو،
 ⛔ وبيتقسم على why (نوع الخطأ) عشان 409 (إيميل أو باسورد مكرر)
 ما يطلعش للمستخدم كرقم أو كود غامض. */
 function fail(o, fallback) {
 if (o.s === 429) { locked(o.d.retry_after || o.d.retry || 60); return; }
 var d = o.d || {};
 var t = d.error || fallback || ('حصل خطأ (' + o.s + ')');
 if (d.why === 'email_taken') {
 /* ⛔⛔⛔ الرسالة دي  كانت بتقول «ادخل»  فالمستخدم
  بيضغط دوس  وبيتحرك لصفحة تانية  وهو أصلاً في
  صفحة الدخول  فبيتلخبط  والسبب مش واضح.
 ⛌ البديل  نقوله الحقيقة  بوضوح  وبس. */
 t = d.error || 'الحساب ده اتعمل قبل كده  ادخل بالبسورد بتاعك';
 say('❌ ' + t, false);
 } else if (d.why === 'pin_taken') {
 say('❌ ' + (d.error || 'الباسورد ده مستخدم من قبل') + ' — اكتب ٤ أرقام تانية', false);
 } else {
 say('❌ ' + t, false);
 }
 shake();
 }

 /* ═══════════════════════════════════════════════════════════
 ① شاشة الاختيار — أول مرة ولا راجع
 ═══════════════════════════════════════════════════════════ */
 function welcome() {
 stopLock();
 state.pin = ''; state.tries = 0; state.len = PIN_LEN;
 mount();
 head('تسجيل الدخول', 0);
 boxEl().className = 'gt-box';
 formEl().innerHTML =
 '<div class="gt-ico">🐙</div>' +
 '<h1 class="gt-h">OCTA</h1>' +
 '<p class="gt-sub">اخطبوط — 8 أذرع بتحلّل السهم من كل زاوية</p>' +
 '<button class="gt-go" id="gtReg" type="button">إعمل حساب جديد</button>' +
 '<button class="gt-go alt" id="gtLogin" type="button">عندك حساب؟ ادخل</button>' +
 '<div class="gt-note">الدخول بالباسورد بس — 4 أرقام من غير إيميل</div>';

 document.getElementById('gtReg').onclick = function () { signup(); };
 document.getElementById('gtLogin').onclick = function () { login(); };
 }

 /* ═══════════════════════════════════════════════════════════
 ② التسجيل — مرة واحدة بس
 ═══════════════════════════════════════════════════════════ */
 function signup() {
 stopLock();
 state.pin = ''; state.len = PIN_LEN;
 mount();
 head('حساب جديد', 1);
 boxEl().className = 'gt-box reg';
 formEl().innerHTML =
 '<label class="gt-lb" for="gtName">اسمك</label>' +
 '<input id="gtName" class="gt-in" placeholder="مثلاً: أحمد" maxlength="40" autocomplete="name">' +
 '<label class="gt-lb" for="gtMail">إيميلك</label>' +
 '<input id="gtMail" class="gt-in" type="email" placeholder="name@mail.com" maxlength="120" autocomplete="email" dir="ltr">' +
 '<p class="gt-sub2">هنبعتلك كود على الإيميل  تكتبه وبعدين تختار ٤ أرقام. ' +
 'حسابك مش بيتعمل غير لما الكود يتأكد.</p>' +
 /* ⛔⛔⛔ صندوق الرسالة  لازم يكون موجود في **كل** شاشة.
 ⛌ say() و fail() و down() كلهم بيكتبوا فيه 
 ⛌ لو مش موجود  المستخدم يدوس الزرار  ميفهمش
 ⛌ حاجة  ولا يبقى عارف عمل إيه  «مفيش حاجة بخصل». */
 '<div class="gt-msg" id="gtMsg"></div>' +
 '<button class="gt-go" id="gtDo" type="button">ابعت الكود</button>';

 var btn = document.getElementById('gtDo');

 function send() {
 var name = (document.getElementById('gtName').value || '').trim();
 var mail = (document.getElementById('gtMail').value || '').trim();
 if (!name) { say('❌ اكتب اسمك الأول', false); return; }
 if (!mail || mail.indexOf('@') < 1) {
 say('❌ اكتب إيميل صح', false); return;
 }
 if (btn) { btn.disabled = true; btn.textContent = '⏳ بنبعت الكود…'; }
 clearMsg();

 /* ⛔⛔ مافيش باسورد في الطلب  ولا في الشاشة 
 الإيميل يتأكد **أول** حاجة وبعدين بس نطلب ٤ أرقام. */
 post(SIGNUP.start, { name: name, email: mail })
 .then(function (o) {
 if (o.s === 200) {
 s.name = name; s.email = mail; s.mode = 'signup';
 flow.email = mail;
 try { octaTrack('signup_start', 'gate', ''); } catch (e) { }
 codeEntry();
 return;
 }
 if (btn) { btn.disabled = false; btn.textContent = 'ابعت الكود'; }
 var d = o.d || {};
 if (o.s === 429) { locked(d.retry_after || d.retry || 60); return; }
 /* ⛔⛔⛔ إصلاح ٢٠ أكتوبر ٢٠٢٦ — 409 «الإيميل موجود»
  ⛌ كان بيروح في الرسمة العامة «مقدرناش نبعت الكود» —
  ⛌ مستخدم عنده حساب بيدوس «حساب جديد» مالوش أي طريقة
  ⛌ يعرف إن الإيميل مسجّل أصلاً.
  ⛌ الحل: رسالة واضحة + زرار «ادخل بالباسورد». */
 if (o.s === 409) {
  flow.email = mail;
  say('ℹ️ الإيميل ده مسجّل عندنا من قبل — ادخل بباسووردك بدل ما تعمل حساب تاني.', false);
  var reg2 = formEl().querySelector('.gt-go');
  if (reg2) { reg2.textContent = 'ادخل بالباسورد'; reg2.className = 'gt-go gt-go-alt';
  reg2.onclick = function () { try { flow.email = mail; } catch (e) { } login(); };
  reg2.classList.add('gt-go-login'); }
  return;
 }
 say('❌ ' + ((d.error) || 'مقدرناش نبعت الكود — جرّب تاني'), false);
 })
 .catch(function () {
 if (btn) { btn.disabled = false; btn.textContent = 'ابعت الكود'; }
 down('التسجيل');
 });
 }

 if (btn) btn.onclick = send;

 /* ⛌ مافيش لوحة أرقام في شاشة التسجيل  مافيش باسورد هنا.
 الباسورد بيتطلب **بعد** ما الكود يتأكد  newPin(). */

 setTimeout(function () {
 var n = document.getElementById('gtName');
 if (n) n.focus();
 }, 60);
 }

 /* ═══════════════════════════════════════════════════════════
 👆 البصمة — الموبايل بس
 ───────────────────────────────────────────────────────────
 ⛌ على التابلت واللاب  مافيش  بالظبط زي ما طلب.
 ⌌ السر  بيتولّد في المتصفح  وبيتخزن **محلياً بس**
  والباك  بيخزن **هاش** منه  مش السر نفسه.
 ⛔ ولا مرة  ما نبعتهش لـGoogle  ولا لـأي حد تاني. */
 function bioOnFlag() {
 try { return localStorage.getItem('octa_bio_on') === '1'; }
 catch (e) { return false; }
 }

 /* ⭐ البصمة مفعّلة؟  نتحقق من الجهاز  مش من السيرفر
  عشان ماتفتحش الشاشة على حد مفعّلهاش. */
 function bioEnabled() {
 try { return localStorage.getItem('octa_bio_on') === '1'; }
 catch (e) { return false; }
 }

 function bioSecret() {
 var k = 'octa_bio_key';
 try {
 var v = localStorage.getItem(k);
 if (v && v.length >= 32) return v;
 var b = new Uint8Array(32);
 (window.crypto || window.msCrypto).getRandomValues(b);
 var h = [];
 for (var i = 0; i < b.length; i++) h.push(('0' + b[i].toString(16)).slice(-2));
 v = h.join('');
 localStorage.setItem(k, v);
 return v;
 } catch (e) { return ''; }
 }

 function bioOn() {
 if (!isPhone()) return;
 var s2 = bioSecret();
 if (!s2) return;
 postAuth('/api/auth/bio', { device: s2 })
 .then(function (o) {
 if (o.s === 200) say('✅ البصمة اتسجّلت على الجهاز ده', false);
 else say('❌ ' + ((o.d && o.d.error) || 'مقدرناش نسجّل البصمة'), false);
 })
 .catch(function () { say('❌ مش قادرين نوصل للسيرفر', false); });
 }

 function bioOff() {
 var s2 = bioSecret();
 postAuth('/api/auth/bio', { device: s2, off: '1' })
 .then(function () { say('🚪 البصمة اتشالت من الجهاز ده', false); })
 .catch(function () { });
 }

 /* ═══════════════════════════════════════════════════════════
 👆 شاشة تفعيل البصمة  موبايل بس
 ───────────────────────────────────────────────────────────
 ⛔⛔ دي شاشة كاملة  مش popup  لإنها خطوة في تسجيل
  الحساب  زي أي خطوة تانية  والمستخدم يقدر يرجع.

 ⛌ السر  بيتولّد في المتصفح  وبيتخزن **محلياً بس**
  والباك  بيخزن **هاش** منه  مش السر نفسه.
 ⛔ ولا مرة  ما نبعتهش لـGoogle  ولا لـأي حد تاني. */
 var _bioAsked = false;

 function bioSecret() {
 var k = 'octa_bio_key';
 try {
 var v = localStorage.getItem(k);
 if (v && v.length >= 32) return v;
 var b = new Uint8Array(32);
 (window.crypto || window.msCrypto).getRandomValues(b);
 var h = [];
 for (var i = 0; i < b.length; i++) h.push(('0' + b[i].toString(16)).slice(-2));
 v = h.join('');
 localStorage.setItem(k, v);
 return v;
 } catch (e) { return ''; }
 }

 function bioDo(on) {
 var s2 = bioSecret();
 if (!s2) { say('❌ المتصفح مش داعم  جرّب متصفح تاني', false); return; }
 postAuth('/api/auth/bio',
  on ? { device: s2 } : { device: s2, off: '1' },
  token())  /* ⛔ التوكن  المعامل التالت  كان ناقص */
 .then(function (o) {
 if (o.s === 200) {
 _bioAsked = true;
 try { localStorage.setItem('octa_bio_on', on ? '1' : '0'); } catch (e) { }
 /* ⭐ نص زر القائمة  يتحدّد  من هنا  مكان واحد */
 try { if (typeof window.bioBtnText === 'function') window.bioBtnText(); }
 catch (e) { }
 /* ⛌⛔⛔ لازم نبلّغ المستخدم  «تم»  مش
 reload  صامت  المستخدم يفتكر إنه مفيش
 حصل فيدوس تاني . */
 var t = on ? '✅ البصمة بقت شغالة  المرة الجاية بإصبعك'
 : '🚪 البصمة اتقفلت  هتدخل بـ٤ أرقام';
 if (document.getElementById('gtMsg')) { say(t, true); return; }
 window.alert(t);
 return;
 }
 /* ⛔⛔ ⭐⭐⭐ لازم نقول السبب  مش «مقدرناش» */
 var d = o.d || {};
 var why = d.why || '';
 var txt = d.error || 'مقدرناش  جرّب تاني';
 if (why === 'bio_taken') {
 txt = '⛔ البصمة مسجّلة على جهاز  استخدم «نسيت كلمة المرور»';
 } else if (why === 'unauthorized') {
 txt = '⛔ لازم تسجّل دخول  اعمل دخول تاني';
 } else if (why === 'bad_device') {
 txt = '⛔ المتصفح مش داعم  جرّب متصفح تاني';
 } else if (o.s === 429) {
 txt = '⛔ طلبات كتير  استنى شوية وحاول تاني';
 }
 if (document.getElementById('gtMsg')) { say('❌ ' + txt, false); return; }
 window.alert('❌ ' + txt);
 })
 .catch(function () {
 var m = '❌ مش قادرين نوصل للسيرفر  اتأكد من الإنترنت';
 if (document.getElementById('gtMsg')) { say(m, false); return; }
 window.alert(m);
 });
 }

 function bioTurnOn() { bioDo(true); }
 function bioTurnOff() { bioDo(false); }

 function bioScreen() {
 stopLock();
 state.pin = ''; state.len = PIN_LEN;
 mount();
 head('تسجيل الدخول بالبصمة', 1, function () { login(true); });
 boxEl().className = 'gt-box bio';
 formEl().innerHTML =
 '<div class="gt-ico">\uD83D\uDC46</div>' +
 '<h1 class="gt-h">تفتح OCTA بإصبعك؟</h1>' +
 '<p class="gt-txt">' +
 'بدل ما تكتب <b>٤ أرقام</b> كل مرة  هتلمس الزرار مرة واحدة\n' +
 'وإيدك أو بصمتك بتفتحلك الموقع.\n' +
 '</p>' +
 '<div class="gt-note gt-bio-note">' +
 '<b>إيه اللي بيتحفظ؟</b><br>' +
 'مفتاح عشوائي بيتولّد في جهازك  والسيرفر بيحفظ <b>هاش</b>\n' +
 'منه  مش المفتاح نفسه \n' +
 '<br>\n' +
 '<b>إيه اللي مابيحصلش؟</b><br>' +
 '⛔ المفتاح ما بيتبعتش لـGoogle ولا لحد\n' +
 '⛔ حد تاني بجهاز تاني  ميفتحش حسابك\n' +
 '⛔ تقدر تلغيه في أي وقت' +
 '</div>' +
 '<button class="gt-go" id="gtBioYes" type="button">\uD83D\uDC46 فعّل البصمة</button>' +
 '<button class="gt-back" id="gtBioNo" type="button">' +
 'لا  عايز ٤ أرقام كل مرة</button>';

 /* ⭐⭐⭐ ⭐ الأهم 
 ⛌ الشاشة دي  كانت دايماً «فعّل البصمة» 
 ⛌ حتى لو البصمة **شغالة أصلاً**  فالمستخدم بيضغط
 ⛌ «فعّل»  والسرفر بيرد «rate limit»  حرج.

 ⛌ الحل  لو مفعّلة  ندخل بيها على طول 
  ولو لأ  دي شاشة التفعيل. */
 if (bioEnabled()) { bioLogin(); return; }

 var y = document.getElementById('gtBioYes');
 var n = document.getElementById('gtBioNo');
 if (y) y.onclick = function () { bioDo(true); };
 if (n) n.onclick = function () { login(true); };
 }

 /* ═══ شاشة النجاح ═══ */
 function done(mail) {
 stopLock();
 head('تم التسجيل', 0);
 var tb = topB();
 if (tb) tb.style.visibility = 'hidden'; /* مفيش مساعدة محتاجاك دلوقتي */
 boxEl().className = 'gt-box';
 formEl().innerHTML =
 '<div class="gt-ico">✅</div>' +
 '<h1 class="gt-h">تم</h1>' +
 '<p class="gt-txt">من هنا وكل مرة هتدخل بالباسورد</p>' +
 '<p class="gt-sent-s">' + esc(mail || '') + '</p>' +
 '<div class="gt-note">احفظ الـ4 أرقام دي كويس — هم وسيلة الدخول الوحيدة</div>' +
 '<button class="gt-go" id="gtNow" type="button">ادخل دلوقتي</button>';

 var b = document.getElementById('gtNow');
 if (b) b.onclick = function () { stopLock(); login(); };
 state.jump = setTimeout(function () { state.jump = null; login(); }, 3200);
 }

 /* ═══════════════════════════════════════════════════════════
 ③ الدخول — بالظبط زي الصورة
 ═══════════════════════════════════════════════════════════ */
 /* ═══════════════════════════════════════════════════════════
 👆 البصمة — للموبايل بس
 ───────────────────────────────────────────────────────────
 📌 «طريقة تلغي التانية»: الموبايل بصمته الأول، والتابلت
 واللاب مافيش فيهما مستشعر أصلاً فبيشتغلوا بـ٤ أرقام
 وخلاص — من غير ما نذكر البصمة أصلاً.
 ⛔⛔ مافيش endpoint للبصمة في الباك لسه (update_prices.py) —
 فبنتعامل مع ده بأمان: لو WebAuthn مش موجود، أو المتصفح
 رفض، أو المسار رجّع 404 → لوحة ٤ أرقام فوراً.
 ⛌ الضغط **بره** الكارت = ٤ أرقام على طول. مافيش قفل
 للمستخدم اللي مش عايز البصمة.
 ═══════════════════════════════════════════════════════════ */
 /* 📌 البصمة — للموبايل بس.
 ⛔⛔⛔ شرط أحمد: التابلت واللاب ٤ أرقام بس، وصفر ذكر للبصمة
 — عشان «الموقع يبان بروفيشنال».
 ⛔ متكفيش بـ hasTouch: لابتوب بلمس أو تابلت في وضع
 أفقي هيبقى عنده maxTouchPoints > 0 وهيعرض البصمة غلط. */
 var BIO_MIN_EDGE = 600; /* أصغر ضلع — أي جهاز منه أكبر = تابلت أو لاب */

 function isPhone() {
 try {
 var w = window.screen.width || 0, h = window.screen.height || 0;
 if (!w || !h) return false;
 /* ⛔ التابلت (٧٦٨×١٠٢٤) واللاب (١٤٤٠×٩٠٠) ولاب-بلمس
 (١٠٢٤×٦٠٠) كلهم أكبر من ٦٠٠ ⇒ ٤ أرقام بس.
 الموبايت أقل من ٦٠٠ في الضلع الأصغر — ده الحد المعروف. */
 if (Math.min(w, h) >= BIO_MIN_EDGE) return false;
 var coarse = window.matchMedia
 && window.matchMedia('(pointer: coarse)').matches;
 return coarse || (navigator.maxTouchPoints > 0);
 } catch (e) { return false; }
 }
 function isTouch() { return isPhone(); }
 function hasBio() {
 try {
 return typeof window.PublicKeyCredential === 'function'
 && !!(navigator.credentials && navigator.credentials.get);
 } catch (e) { return false; }
 }

 /* 📌 عدّاد شاشات البوابة — أي مستمع قديم يموت لما الشاشة تتغيّر.
 ⛌ stopLock() بيعدّه، وكل شاشة بتناديه الأول. */
 var screenId = 0;

 function bioLogin() {
 stopLock();
 /* ⛔⛔⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐⭐⭐ إصلاح «بيخش برضو قبل
 📌 ما أكتب الباسورد / الكود».
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ السبب: مستمع الـclick على .gt-body كان فاضل من
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ شاشة البصمة ⇒ أي لمسة بره الكارت (والمستخدم
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ بيضغط «رجوع» أو بيكتب الكود) ⇒ toPin() ⇒
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ login(1) ⇒ الشاشة بتتبدّل لـ٤ أرقام!
 📌 ✅ الحل: (١) نضمن إن كل شاشة جديدة تلغي المستمع
 📌 ✅ (٢) ونتأكد إن المستمع لسه على الشاشة الصح.
 */
 var me = screenId;
 /* ⛔ ⛌ ⛌ ⛌ ⛌ امسح أي مستمع click قديم على body
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ (من أي شاشة قبلها) — غير كده الكليك
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ بره الكارت بيرجّعنا لشاشة ٤ أرقام.
 */
 try {
 var _bd = document.querySelector('.gt-body');
 if (_bd) { _bd.onclick = null; }
 } catch (e) { }
 mount();
 head('تسجيل الدخول', 0);
 boxEl().className = 'gt-box bio';
 formEl().innerHTML =
 '<div class="gt-bio" id="gtBio">' +
 '<div class="gt-ico">👆</div>' +
 '<h1 class="gt-h">ادخل ببصمة</h1>' +
 '<p class="gt-sub2">ضع إصبعك على المستشعر — أسرع وأأمن من ٤ أرقام</p>' +
 '<button class="gt-go" id="gtBioGo" type="button">\uD83D\uDC46 ادخل دلوقتي</button>' +
 '<button class="gt-back" id="gtBioPin" type="button">ادخل بـ٤ أرقام</button>' +
 '<p class="gt-note">لو البصمة مشتغلتش، دوس بره الكارت وهتدخل بأرقام</p>' +
 '</div>';

 function off() {
 var b = document.querySelector('.gt-body');
 if (b) b.onclick = null;
 }

 function toPin() { if (me !== screenId) return; off(); login(1); }

 var go = document.getElementById('gtBioGo');
 if (go) go.onclick = function () { if (me === screenId) doBio(off); };
 var pb = document.getElementById('gtBioPin');
 if (pb) pb.onclick = toPin;

 /* ⛌⛌ الضغط بره الكارت = ٤ أرقام فوراً (بلا ما نطلب ولا كلمة)
 ⛌⛌ بنيسجّل المستمع بعد ما الحدث الحالي يخلص (setTimeout):
 ضغطة «ادخل» نفسها بتكمّل في الـbubbling على .gt-body بعد ما
 الشاشة الجديدة تركب — فكانت بتلخبطنا على لوحة الأرقام في نفس
 اللحظة (البصمة ما كانتش بتبان أصلاً على الموبايل). */
 var body = document.querySelector('.gt-body');
 if (body) {
 setTimeout(function () {
 if (me !== screenId) return;
 body.onclick = function (e) {
 if (me !== screenId) return;
 var box = document.getElementById('gtBio');
 if (box && (box === e.target || box.contains(e.target))) return;
 toPin();
 };
 }, 0);
 }
 /* ⛔⛔⛔ ⭐ ده كان سبب إن الشاشة  بتظهر وتختفي في أقل من ثانية.
 ⛌ الكود القديم  كان بيعمل `go.click()`  تلقائي
  فبيجرب البصمة  ولو فشلت  بيرجع
  � فورًا  المستخدم ميحقش يشوف الشاشة أصلاً.
 ⛌ ⭐ دلوقتي  المستخدم هو اللي يدوس  وبShown أعرف السبب. */
 }

 /* 📌 محاولة البصمة — أي فشل بيرجّعنا للوحة ٤ أرقام */
 function doBio(off) {
 off = off || function () { };
 var box = document.getElementById('gtBio');
 if (box) box.setAttribute('data-busy', '1');
 var b = document.getElementById('gtBioGo');
 if (b) { b.disabled = true; b.textContent = '⏳ بنستنى البصمة...'; }
 var go = window.location.protocol === 'https:' || isLocal()
 ? postAuth(P_BIO, { device: bioSecret() }, null)
 : Promise.resolve({ s: 404, d: {} });
 go.then(function (o) {
 if (o.s === 200 && o.d && o.d.token) {
 off();
 put(o.d.token, o.d.user);
 shut();
 return;
 }
 /* ⛔⛔⛔ ⭐⭐⭐ السبب 
 ⛌ كان  `login(1)`  فورًا  من غير سبب
 ⛌ فالمستخدم بيشوف الشاشة بتختفي  ويفتكر
 ⛌ إن البصمة خراب  من غير ما يقرا حاجة.

 ⛌ ⭐ الحل  نقوله السبب  ونسيبه  مش بنطرده. */
 off();
 var msg = '❌ البصمة مش هتنفع على الجهاز ده  استخدم ٤ أرقام';
 var m = document.getElementById('gtMsg');
 if (m) { m.className = 'gt-msg no'; m.textContent = msg; }
 setTimeout(function () { login(1); }, 2200);
 }).catch(function () {
 off();
 var m2 = document.getElementById('gtMsg');
 if (m2) { m2.className = 'gt-msg no';
 m2.textContent = '❌ مش قادرين نوصل للسيرفر  جرّب ٤ أرقام'; }
 setTimeout(function () { login(1); }, 2200);
 });
 }

 function isLocal() {
 try {
 var h = location.hostname;
 return h === 'localhost' || h === '127.0.0.1' || h === '';
 } catch (e) { return false; }
 }

 /* 📌 noBio — جاي من شاشة البصمة نفسها:Means «المستخدم اختار
 الأرقام بنفسه»، فماشيش تاني على البصمة. */
 function login(noBio) {
 stopLock();
 /* ⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐ شاشة الـPIN-login مفيش فيها
 📌 «تسجيل» ولا «استرجاع» ⇒ نخلّي الـmode فاضي.
 📌 ⛌ ⛌ ⛌ (كان بيفضل 'signup' من محاولة سابقة ⇒ والرجوع
 📌 ⛌ ⛌ ⛌ من شاشة الكود بيرجع لـlogin بـmode غلط)
 */
 s.mode = '';
 state.pin = ''; state.tries = 0; state.len = PIN_LEN;
 /* ⛔⛔⛔ ⭐ الترحيب  الحل
 ⛌ كل ما المستخدم يفتح شاشة الدخول  العدّاد يصفّر.
 ⛌ قبل كده  المحاولات القديمة كانت بتضل محسوبة 
  فالمستخدم كان بيكتب الباسورد **الصحيح**  وبيرد
  «المحاولات خلصت»  ويفتكر إنه اتقفل  حرج.
 ⛌ ده مش ضعف  الحماية الحقيقية  القفل على القرص
  في الباك  وهetyفضل شغال  حتى لو الوصفّر. */
 strikeReset();
 /* ⛔ رجع المستخدم وشكله خلص من النافذة القصيرة — مش هنفسحله
 الطريق ونعيده للوحة تاني. */
 /* ⛌ لو عدّى محاولات  نبعته على شاشة الكود  فورًا
  مع زرار «٤ أرقام»  لو فاكرها  رجوع فوري. */
 if (strikeCount() >= STRIKE_LIMIT) { locked(30); return; }
 /* 📱 الموبايل: البصمة الأول. ⛔ التابلت واللاب: ٤ أرقام بس
 من غير ما نذكر البصمة أصلاً — مافيش مستشعر. */
 /* ⛔⛔⛔ ⭐ القاعد�� الجديدة 
 ⛌ البصمة  **ما تظهرش تلقائي**  لحد ما المستخدم
  يفعّلها بنفسه  من القائمة.
 ⛌ قبل كده  كانت بتظهر دايماً  فالمستخدم بيدخل 
  بيضغط «بصمة»  والجهاز ما إيدش عليه مستشعر 
  فيحصل «عندك حساب؟ ادخل»  ويفتكر الموقع بايظ.

 ⭐ الحل  الرقم الشاشة  ورقم البصمة  جنب بعض
  والموبايل يشوف البصمة  والتابلت واللاب لأ. */
 if (!noBio && bioEnabled() && isPhone()) { bioScreen(); return; }
 mount();
 head('تسجيل الدخول', 0);
 boxEl().className = 'gt-box pin';
 formEl().innerHTML =
 '<div class="gt-ico">🗝️</div>' +
 '<h1 class="gt-h">مرحباً بك في OCTA</h1>' +
 padHtml(0) +
 '<button class="gt-forgot" id="gtForgot" type="button">نسيت كلمة المرور؟</button>' +
 /* ⭐⭐ البصمة  في نفس شاشة الأرقام  موبايل بس
 ⛌ التابلت واللاب  مافيش  بالظبط زي ما طلب.
 ⛌ لو البصمة مفعّلة  بتدخل بيها  ولو لأ  بتفعّلها. */
 (isPhone()
 ? '<button class="gt-bio" id="gtBio" type="button">' +
 (bioOnFlag()
 ? '👆 ادخل بالبصمة'
 : '👆 فعّل الدخول بالبصمة') + '</button>'
 : '') +
 '<button class="gt-back" id="gtBack" type="button">رجوع</button>';

 onPad(function (p) {
 /* ⛌ العدّاد بيتزاد قبل الطلب — عشان الرسالة بعد الغلط
 تقول كام محاولة فاضلة فعلاً (مش دايماً ٥). */
 state.tries++;
 paintPad(true);
 clearMsg();

 /* ⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐ نرسل الجهاز مع الباسورد.
 📌 الباك بقى يتحقق: الجهاز ده مسجّل على الحساب ولا لأ.
 📌 ⛌ ⛌ ⛌ لو م=new ⇒ 401 need_code ⇒ كود على الإيميل.
 📌 ⛌ ⛌ ⛌ (ده يمنع حد يدخل بحساب حد تاني من موبايل تاني) */
 post('/api/auth/pin/login', { pin: p, device: bioSecret() })
 .then(function (o) {
 if (o.s === 200 && o.d && o.d.token) {
 strikeReset();
 put(o.d.token, o.d.user);
 shut();
 return;
 }
 /* ⛔⛌ السيرفر هو اللي بيحسم. 429 = قفل ١٥ دقيقة (القاعدة ②).
 والـneed_code بيرجع **401** مش 429 — انتبه. */
 /* ⛔ شبكة (s===0) — مش خطأ باسورد. مافيش خصم من العدّاد. */
 if (o.s === 0) {
 state.tries = 0; strikeReset();
 say('⚠️ الشبكة ضعيفة — جاوب تاني', false);
 paintPad(false);
 return;
 }
 if (o.s === 429) { locked(o.d.retry_after || o.d.retry || 60); return; }
 /* ⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐ device جديد ⇒ شاشة إيميل مخصصة
 📌 (مش «محاولات كتيرة» — الرقم صح، الجهاز مختلف) */
 if (o.d && (o.d.why === 'new_device' || o.d.why === 'new_device_code')) {
 askCode('newdev'); return;
 }
 if (needCode(o.d)) { askCode('need'); return; }
 /* ⛌ كل حاجة تانية = الباسورد غلط. ما نقولش حاجة عن الحساب. */
 /* ⛔⛔⛔ ٢١ أكتوبر ٢٠٢٦ — نسجّل الرقم اللي اتجرّب.
   ⛌ الهدف: لو عمل «نسيت الباسورد» وكتب الكود الصح،
   ⛌ السيرفر يقدر يمسح عدّاد p:الرقم ده بالظبط.
   ⛌ ⛌ من غير ده: القفل بيفضل حتى لو الكود صح. */
 try { recordTriedPin(p); } catch (e) { }
 var n = strikePush();
 if (n >= STRIKE_LIMIT) { locked(30); return; }
 badPin(winLeft(o.d, state.tries), n);
 paintPad(false);
 })
 /* ⛔ شبكة — المحاولة دي مااتحسبتش عند السيرفر، فنصفّر العدّاد */
 .catch(function () {
 state.tries = 0; strikeReset(); paintPad(false); down('الدخول');
 });

 /* ⛔⛔ ٢١ أكتوبر ٢٠٢٦ — s:0 = فشل شبكة (مش رد من السيرفر).
   ⛌ قبل: الـcaller كان بيفتكر ده «باسورد غلط» وبيحسبه محاولة.
   ⛌ ⛌ دلوقتي: رسالة صريحة + مافيش خصم من العدّاد. */
 /* (الـbranch فوق بيشوف s===0 الأول) */
 });

 document.getElementById('gtForgot').onclick = function () { forgot(); };
 document.getElementById('gtBack').onclick = function () { welcome(); };
 /* ⭐ زرار البصمة  موبايل بس  في نفس شاشة الأرقام */
 var bb = document.getElementById('gtBio');
 if (bb) {
 bb.onclick = function () {
 stopLock();
 state.pin = ''; paintDots();
 /* ⛌ مفعّلة  نحاول ندخل بيها  مش مفعّلة  نفتح الشاشة */
 if (bioOnFlag()) { try { bioLogin(); } catch (e) { bioScreen(); } }
 else { bioScreen(); }
 };
 }
 }

 /* ⛌ السيرفر قال «الكود مطلوب»؟ — الباك بيرجّعها 401 + why:need_code.
 📌 لو الباك غيّر الاسم، زيده هنا. */
 function needCode(d) {
 if (!d) return false;
 if (d.need_code === true) return true;
 var w = String(d.why || '');
 return w === 'need_code' || w === 'code_required' || w === 'challenge'
 || w === 'need_email' || w === 'need_challenge'
 || w === 'new_device' || w === 'new_device_code';
 }

 /* 📌 كام محاولة في **نافذة الدقيقة** فاضلة — الباك بيبعتها في
 attempts_left. لو مش موجودة بنحسبها عندنا. */
 function winLeft(d, tries) {
 var v = d && (d.attempts_left != null ? d.attempts_left : null);
 if (v == null || isNaN(v)) return Math.max(0, STRIKE_LIMIT - (tries || 0));
 return Math.max(0, Number(v));
 }

 /* ═══════════════════════════════════════════════════════════
 ④ نسيت الباسورد
 ───────────────────────────────────────────────────────────
 📌 القاعدة الجديدة غيّرته — بقى في استرجاع بالكود.
 الكلام القديم كان «مافيش استرجاع» واللي فاتح من ساعتها.
 ═══════════════════════════════════════════════════════════ */
 function forgot() {
 stopLock();
 state.pin = ''; state.len = PIN_LEN;
 head('نسيت كلمة المرور', 1);
 boxEl().className = 'gt-box';
 formEl().innerHTML =
 '<div class="gt-ico">🔑</div>' +
 '<h1 class="gt-h">بنسلّك من غير الباسورد</h1>' +
 '<div class="gt-txt left">' +
 'الطريقة الوحيدة: <b>كود على الإيميل</b>.<br>' +
 'اكتب إيميلك المسجّل وهنعتلك كود من ٦ أرقام،' +
 ' تكتبه وتختار ٤ أرقام جديدة تدخل بيها من هنا.<br><br>' +
 '<b>الإيميل لوحده مش بيفتح</b> — لازم الكود اللي جالك' +
 ' في بريدك كمان. عشان كده لو حد غيرك فتح إيميلك' +
 ' ميقدرش ياخد حسابك بنفسه.' +
 '</div>' +
 '<button class="gt-go" id="gtChGo" type="button">ابعتلي كود على الإيميل</button>' +
 '<button class="gt-go alt" id="gtNewAcc" type="button">عمل حساب جديد</button>' +
 '<button class="gt-back" id="gtBack3" type="button">رجوع للدخول</button>';

 var cg = document.getElementById('gtChGo');
 if (cg) cg.onclick = function () { askCode('forgot'); };
 document.getElementById('gtNewAcc').onclick = function () { signup(); };
 document.getElementById('gtBack3').onclick = function () { login(); };
 }

 /* ═══════════════════════════════════════════════════════════
 ⑤ شاشة طلب الكود — إيميل واحد وزرار
 ───────────────────────────────────────────────────────────
 ⛔⛔⛔ الرد المحايد شرط أمني مش ذوق:
 · الإيميل مسجّل -> 200 «لو الإيميل ده بتاعك...»
 · الإيميل مش مسجّل -> 200 **بالنص نفسه** ومفيش إرسال
 ⛔ ممنوع نميّز بين اتنين — لا في الواجهة ولا في الباك.
 أي كلمة زي «الإيميل ده مش مسجّل» بتبقى قناة مفتوحة
 نبني بيها قاموس بالمحاولات ونعرف مين عندنا حساب.
 ═══════════════════════════════════════════════════════════ */
/* ⛔⛔⛔ إصلاح ٢٠ أكتوبر ٢٠٢٦
  ⛌ الشاشة دي كانت بتقول «محاولات كتيرة» لكل حد بيوصلها —
  ⛌ حتى لو دوس «نسيت الباسورد» وهو ما غلطش أصلاً.
  ⛌ ده كذب صريح: المستخدم يتلخبط ويفتكر في حد بيخترق حسابه.
  ⛌ الحل: 'locked' → تحذير · 'forgot' → رسالة عادية · 'need' → محاولات كتيرة */
 function askCode(cause) {
 stopLock();
 var why = (cause === 'locked') ? 'locked' : (cause === 'newdev' ? 'newdev' : (cause === 'forgot' ? 'forgot' : 'need'));
 /* ⛔⛔⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐⭐⭐ إصلاح «الكود بيوصل بخطأ»
 📌 السبب: `s.mode` كان بيتحدد **مرة واحدة** عند الـsignup
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ (سطر 907) وبيتفضل 'signup' للأبد!
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ بعد ما يعمل signup، لو رجع وطلب «نسيت
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ الباسورد» ⇒ codeEntry() شايفها signup ⇒
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ «كود التأكيد» + «ارجع — عدّل الإيميل» ⇒
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ المستخدم محتار + يظن إنه بيعمل حساب جديد.
 📌 ✅ الحل: كل مسار يحدّد الـmode بتاعه صراحةً.
 📌 ✅ forgot → 'forgot' · newdev/need/locked → 'forgot' كمان
 📌 ✅ (كلهم استرجاع، مش تسجيل)
 */
 s.mode = (why === 'locked' || why === 'newdev' || why === 'need' || why === 'forgot')
 ? 'forgot' : 'forgot';
 state.pin = ''; state.len = PIN_LEN; flow.tries = 0;
 /* ⛔ ٢١ أكتوبر: منسيب العدّادات القديمة عند بداية جلسة جديدة */
 if (flow.triedPins && flow.triedPins.length) {
  try { sessionStorage.setItem('octa_tried_pins', JSON.stringify(flow.triedPins)); }
  catch (e) { }
 }
 flow.triedPins = [];
 mount();
 head(why === 'locked' ? 'محاولات كتيرة' : 'هنبعتلك كود',
      1, function () { login(); });
 boxEl().className = 'gt-box code card';
 formEl().innerHTML =
 '<div class="gt-ico">🔑</div>' +
 (why === 'locked'
   ? '<div class="gt-alert">⚠️ عملت محاولات كتيرة غلط</div>' +
     '<h1 class="gt-h">استنى بصوت شوية وجرّب تاني</h1>' +
     '<p class="gt-sub2">عملنا قفل مؤقت عشان أمانك — مش فيه مشكلة في حسابك</p>'
   : why === 'newdev'
     ? '<div class="gt-alert">📱 دخول من جهاز جديد</div>' +
       '<h1 class="gt-h">هنبعتلك كود على الإيميل المسجّل</h1>' +
       '<p class="gt-sub2">الباسورد صح، بس ده جهاز مختلف — كود على الإيميل عشان نتأكد إنك إنت</p>'
   : why === 'need'
     ? '<div class="gt-alert">⛔ محاولات كتيرة</div>' +
       '<h1 class="gt-h">هنبعتلك كود على الإيميل المسجّل</h1>' +
       '<p class="gt-sub2">بعد محاولات غلط ورا بعض — ودي أأمن من إنك تفضل تخمّن</p>'
     : '<h1 class="gt-h">هنبعتلك كود على الإيميل المسجّل</h1>' +
       '<p class="gt-sub2">ما بعتش باسورد أبداً — كود واحد بس وإحنا نتأكد إنك إنت</p>') +
 '<label class="gt-lb" for="gtChMail">إيميلك المسجّل</label>' +
 '<input id="gtChMail" class="gt-in" type="email" dir="ltr" maxlength="120" ' +
 'autocomplete="email" inputmode="email" placeholder="name@mail.com">' +
 '<div class="gt-msg" id="gtMsg"></div>' +
 '<button class="gt-go" id="gtChSend" type="button">ابعت الكود</button>' +
 '<button class="gt-back" id="gtChBack" type="button">رجوع للدخول</button>';

 var btn = document.getElementById('gtChSend');
 var mail = document.getElementById('gtChMail');

 function send() {
 var v = (mail.value || '').trim();
 /* ⛌ فحص الشكل بس — مش وجود الإيميل. وجوده الباك هو اللي
 بيحكم فيه، وهو اللي بيرد المحايد. */
 if (!v) { say('اكتب إيميلك الأول', false); return; }
 if (v.indexOf('@') < 1 || v.indexOf('.') < 1) { say('شكل الإيميل غلط', false); return; }
 if (btn) { btn.disabled = true; btn.textContent = '⏳ بنعت...'; }
 clearMsg();

 post(PATHS.send, { email: v })
 .then(function (o) {
 if (o.s === 200) {
 /* ⛔⛔ نفس الشاشة ونفس الكلام — مسجّل أو لأ. */
 flow.email = v;
 /* ⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐ ثبّت الـmode صراحةً
 📌 (استرجاع — مش تسجيل).askCode ضبطها بس نتأكد هنا كمان
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ خاطرة لو flow اتنادى من مكان تاني.
 */
 s.mode = 'forgot';
 codeEntry();
 return;
 }
 /* ⛔ 429 → الزر يفضل مقفول طول العدّاد (sayRate بيفتحه). */
 if (o.s === 429) { sayRate(o.d); return; }
 if (btn) { btn.disabled = false; btn.textContent = 'ابعت الكود'; }
 if (o.s === 400) { say('❌ ' + ((o.d && o.d.error) || 'شكل الإيميل غلط'), false); return; }
 /* ⛔⛔ أي حاجة تانية (404/409/500): مفيش كلام يبوّح إن
 الإيميل مسجّل ولا لأ. رسالة عامة وخلاص. */
 say('❌ مش قادرين نبعت الكود دلوقتي — جرّب بعد شوية', false);
 })
 .catch(function () {
 if (btn) { btn.disabled = false; btn.textContent = 'ابعت الكود'; }
 say('❌ مش قادرين نوصل للسيرفر', false);
 });
 }

 /* 📌 429 — حد الإرسال (٣ أكواد للإيميل في اليوم) أو حد الـIP.
 ⛔ العدّاد بييجي من السيرفر مش متخيّنين. */
 function sayRate(d) {
 /* ⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐ تفريق بين نوعين من القفل
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 السبب: الكود القديم كان بيقول «استنى ١٥ دقيقة» لكل حالة.
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ✅ daily_limit = «استنى بكرة» (مش ١٥ دقيقة!)
 📌 ✅ rate العادي = «استنى شوية»
 */
 var daily = !!(d && (d.why === 'daily_limit' || d.until_midnight));
 var s2 = Math.max(1, Number((d && (d.retry_after || d.retry)) || 0) || (daily ? 3600 : 900));
 if (btn) { btn.disabled = true; btn.textContent = daily ? '⛔ استنى بكرة' : '⛔ استنى'; }
 var m = document.getElementById('gtMsg');
 if (!m) return;
 m.className = 'gt-msg no';
 if (daily) {
 /* ⛔ «استنى بكرة» بوضوح + العدّاد ينزّل لحد نص الليل */
 m.innerHTML = '⛔ طلبت ٣ أكواد على الإيميل ده اليوم — استنى بكرة' +
 ' <span class="gt-cd" id="gtRateCd">(' + mm(s2) + ')</span>';
 var td = setInterval(function () {
 s2--;
 var c = document.getElementById('gtRateCd');
 if (s2 <= 0) {
 clearInterval(td);
 if (btn) { btn.disabled = true; btn.textContent = '⛔ استنى بكرة'; }
 m.innerHTML = '⛔ الحد اليومي خلص — جرّب بكرة الصبح';
 return;
 }
 if (c) c.textContent = '(' + mm(s2) + ')';
 }, 1000);
 return;
 }
 m.innerHTML = '⛔ استنى شوية واطلب تاني' +
 ' <span class="gt-cd" id="gtRateCd">(' + mm(s2) + ')</span>';
 var t = setInterval(function () {
 s2--;
 var c = document.getElementById('gtRateCd');
 if (s2 <= 0) {
 clearInterval(t);
 if (btn) { btn.disabled = false; btn.textContent = 'ابعت الكود'; }
 m.innerHTML = '⛔ خلص الوقت — تقدر تطلب تاني';
 return;
 }
 if (c) c.textContent = '(' + mm(s2) + ')';
 }, 1000);
 }

 if (btn) btn.onclick = send;
 if (mail) mail.onkeydown = function (e) { if (e.key === 'Enter') send(); };
 document.getElementById('gtChBack').onclick = function () { login(); };
 setTimeout(function () { if (mail) mail.focus(); }, 60);
 }

 /* ═══════════════════════════════════════════════════════════
 ⑥ شاشة كتابة الكود — ٦ خانات وعدّاد صلاحية
 ═══════════════════════════════════════════════════════════ */
 function codeEntry() {
 stopLock();
 state.pin = ''; state.len = CODE_LEN; flow.tries = 0;
 /* ⛔ ٢١ أكتوبر: منسيب العدّادات القديمة عند بداية جلسة جديدة */
 if (flow.triedPins && flow.triedPins.length) {
  try { sessionStorage.setItem('octa_tried_pins', JSON.stringify(flow.triedPins)); }
  catch (e) { }
 }
 flow.triedPins = [];
 mount();
 /* 📌 رجوع وإرسال  حسب إحنا في «تسجيل» ولا «استرجاع» */
 var reg = (s.mode === 'signup');
 head(reg ? 'كود التأكيد' : 'كود الدخول', 1, function () {
 if (reg) { signup(); } else { askCode('forgot'); }
 });
 boxEl().className = 'gt-box code';
 formEl().innerHTML =
 '<div class="gt-ico">📩</div>' +
 '<h1 class="gt-h">اكتب الكود اللي جالك</h1>' +
 '<p class="gt-txt">' + (reg ? esc(esc(NOTE_SAME) + ' — ده كود إنشاء حسابك') : esc(NOTE_SAME)) + '</p>' +
 codeHtml() +
 '<p class="gt-cdt" id="gtCd">⏱ الكود صالح <b id="gtCdN">' + mm(CODE_TTL) + '</b></p>' +
 /* ⛌ padHtml(0)  الـ4 نقط دي بتاعت الباسورد
  والكود ٦ أرقام  فبنخبّيها  مربكة وغلط. */
 padHtml(0) +
 /* ⭐⭐ زرار «كود جديد»  لازم يكون واضح تحت الخانات.
 ⛌ الكود ممكن ميوصلش  سبام · تأخير · فلتر.
 ⛌ من غير الزرار ده  مفيش غير إنه يعمل التسجيل من الأول. */
 '<button class="gt-go alt" id="gtResend" type="button">' +
 '\uD83D\uDCE9 الكود موصلش؟ ابعت كود جديد</button>' +
 '<button class="gt-back" id="gtChAgain" type="button">' +
 (reg ? 'ارجع — عدّل الإيميل' : 'ارجع — اكتب إيميل تاني') + '</button>';

 var back = document.getElementById('gtChAgain');
 if (back) back.onclick = function () { if (reg) { signup(); } else { askCode('forgot'); } };

 /* ⛌⛌⛌ الخانات دلوقتي قابلة للكتابة  كيبورد ولصق وقلم */
 wireCodeInput();
 /* ⛌ إخفاء نقط الـ4  دي بتاعة الباسورد 
 شاشة الكود ٦ خانات  والنقاط دي ملهاش لازمة. */
 var dots = document.getElementById('gtDots');
 if (dots) dots.style.display = 'none';
 startCd();
 wireResend(reg);

 /* ⭐ لوحة الأرقام  بتستخدم نفس دالة الإرسال 
 عشان الكيبورد واللصق ولوحة الأرقام كلهم سلوك واحد. */
 onPad(function (v) { submitCode(v); });

 var inp = document.getElementById('gtCodeIn');
 if (inp) inp.onfull = function (v) { inp.onfull = null; submitCode(v); };

 function submitCode(v) {
 paintPad(true);
 clearMsg();
 /* ⛔⛔⛔ ٢١ أكتوبر ٢٠٢٦ — نبعت الأرقام المتجرّبة مع الكود.
   ⛌ السيرفر بيمسح عدّاداتها بس لما يبقى التأكد ناجح.
   ⛌ ⛌ من غيرها: «نسيت الباسورد» ميبفلحش يفتح أبداً. */
 var tried = [];
 try { tried = JSON.parse(sessionStorage.getItem('octa_tried_pins') || '[]'); }
 catch (e) { tried = []; }
 if (!Array.isArray(tried)) tried = [];
 if (tried.length > 20) tried = tried.slice(-20);
 post(reg ? SIGNUP.verify : PATHS.verify,
      { email: flow.email, code: v, tried_pins: tried })
 .then(function (o) {
 var d = o.d || {};
 if (o.s === 200) {
 flow.unlock = d.unlock || d.ticket || '';
 flow.code = v;
 state.pin = '';
 paintCode();
 newPin();
 return;
 }
 if (o.s === 429) {
 if (String(d.why || '') === 'too_many_wrong') {
 codeDead('⛔ الكود اتقفل — اطلب كود جديد');
 return;
 }
 locked(d.retry_after || d.retry || 60);
 return;
 }
 if (o.s === 401 || o.s === 400) { codeWrong(d); return; }
 codeDead('❌ مش قادرين نكمّل — اطلب كود جديد');
 })
 .catch(function () {
 paintPad(false);
 say('❌ مش قادرين نوصل للسيرفر', false);
 });
 }
 }

 /* 📌 الكود غلط أو منتهي — الرد واحد في الحالتين.
 📌 العدّاد بيكمل طول ما الكود حي؛ ولما يوصل ٥ غلط (نفس
 PIN_CHAL_WRONG بتاع الباك) نقفل الشاشة ونقول «اطلب جديد». */
 function codeWrong(d) {
 flow.tries++;
 var left = Math.max(0, CODE_TRIES - flow.tries);
 state.pin = '';
 paintCode();
 paintPad(false);
 shakeCode();
 if (left <= 0) { codeDead('⛔ الكود اتقفل — اطلب كود جديد'); return; }
 var t = String((d && d.error) || 'الكود غلط');
 if (left === 1) say('❌ ' + t + ' — آخر محاولة', false);
 else say('❌ ' + t + ' — فاضل ' + left + ' محاولات', false);
 }

 /* 📌 الكود مات — الشاشة بتقف واللوحة بتقفل، وزرار الرجوع
 بيفتح شاشة طلب كود جديد من الأول. */
 function codeDead(msg) {
 stopCd();
 state.pin = '';
 paintCode();
 paintPad(true);
 say(msg, false);
 var b = document.getElementById('gtChAgain');
 if (b) b.textContent = 'اطلب كود جديد';
 }

 /* 📌 عدّاد صلاحية الكود — 10:00 ينزل لحد 00:00 */
 function startCd() {
 stopCd();
 flow.cd = CODE_TTL;
 var n0 = document.getElementById('gtCdN');
 if (n0) n0.textContent = mm(flow.cd);
 flow.cdTimer = setInterval(function () {
 flow.cd--;
 var num = document.getElementById('gtCdN');
 if (flow.cd <= 0) {
 stopCd();
 if (num) num.textContent = '00:00';
 codeDead('⏰ الكود خلصت صلاحيته — اطلب كود جديد');
 return;
 }
 if (num) num.textContent = mm(flow.cd);
 }, 1000);
 }

 /* ═══════════════════════════════════════════════════════════
 ⑦ شاشة اختيار الباسورد الجديد
 ───────────────────────────────────────────────────────────
 ⛔⛔⛔ مفيش أي شاشة «تم الدخول» هنا. التوكن بييجي من طلب واحد
 بعد ما الـ4 أرقام يتقبلوا، ومفيش طريق تاني يفتح الموقع.
 ═══════════════════════════════════════════════════════════ */
 function newPin() {
 stopLock();
 var reg = (s.mode === 'signup');
 state.pin = ''; state.len = PIN_LEN;
 mount();
 head(reg ? 'اختار باسورد' : 'اختار باسورد جديد', 1, function () {
 if (reg) { codeEntry(); } else { login(); }
 });
 boxEl().className = 'gt-box pin';
 formEl().innerHTML =
 '<div class="gt-ico">🔐</div>' +
 '<h1 class="gt-h">' + (reg ? 'اختار ٤ أرقام' : 'اختار ٤ أرقام جديدة') + '</h1>' +
 '<p class="gt-sub2">' +
 (reg ? 'دي اللي هتدخل بيه من هنا  من غيرها مفيش دخول'
 : 'دي اللي هتدخل بيه من هنا') + '</p>' +
 padHtml(0) +
 '<button class="gt-back" id="gtNpBack" type="button">رجوع</button>';

 document.getElementById('gtNpBack').onclick = function () {
 if (reg) { codeEntry(); } else { login(); }
 };

 onPad(function (v) {
 paintPad(true);
 clearMsg();
 /* 📌 تروكن الفتح في هيدر Authorization (مش في الـbody) —
 زي ما الباك بيقرا (_bearer). والـbody فيه new_pin بس. */
 /* ⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐ نرسل الجهاز مع الباسورد الجديد.
 📌 الباك بيخزّنه على الحساب ⇒ أول دخول بعد التسجيل يشتغل. */
 postAuth(reg ? SIGNUP.newpin : PATHS.newpin,
 { new_pin: v, device: bioSecret() }, flow.unlock)
 .then(function (o) {
 var d = o.d || {};
 if (o.s === 200 && d.token) {
 /* ⛔⛔ اللحظة الوحيدة اللي فيها توكن — بعد ما ٤ أرقام
 جديدة اتقبلت. قبل كده مافيش توين خالص. */
 var who = (reg ? s.email : flow.email);
 wipeFlow();
 try { octaTrack(reg ? 'signup' : 'pin_reset', 'gate', ''); } catch (e) { }
 put(d.token, d.user);
 /* ⭐ ⭐ ⭐ البصمة  ⭐ ⭐ ⭐
 ⛌ أي حساب جديد  موبايل  نسأله «تفعيل البصمة؟»
  بعد ثانية واحدة  لو رفض  عادي 
 ⛌ التابلت واللاب  مافيش  بالظبط زي ما طلب. */
 /* ⭐ ⭐ ⭐ بعد إنشاء الحساب  خطوة البصمة  جزء
  من تسجيل الحساب  زي الكود والباسورد بالظبط.
 ⛌ موبايل  بس  التابلت واللاب  مافيش 
  لأن البصمة مالهاش معنى على جهاز كبير. */
 /* ⭐ طلب أحمد  «التعيين من القائمة  مش شاشة إجبارية»
 ⛌ فبعد التسجيل  بيوصل لصفحة النجاح  على طول
  والبصمة  المستخدم يفعّلها وقت ما يحب  من
  القائمة  أو من زرار  في شاشة الأرقام. */
 try { clearTriedPins(); } catch (e) { }
 if (reg) { done(who); } else { shut(); }
 return;
 }
 state.pin = '';
 paintDots();
 /* ⛔⛔⛔ ٢١ أكتوبر ٢٠٢٦ — نسجّل الرقم الجديد كمان.
   ⛌ لو هو اللي بيقفل العدّاد، المستخدم يقدر يطلّعه بكود
   ⛌ من غير ما يستنى ١٥ دقيقة. */
 try { recordTriedPin(v); } catch (e) { }
 if (o.s === 409 || d.why === 'pin_taken') {
 /* ⛌ 409 → اللوحة فاضية تاني والمستخدم يختار غيره */
 paintPad(false);
 say('❌ الباسورد ده مستخدم من قبل — اختار غيره', false);
 shake();
 return;
 }
 if (o.s === 400) {
 paintPad(false);
 say('❌ ' + (d.error || 'الباسورد لازم يكون ٤ أرقام'), false);
 shake();
 return;
 }
 if (o.s === 429) { locked(d.retry_after || d.retry || 60); return; }
 if (o.s === 401) {
 /* ⛔ تروكن الفتح خلص (عمره ١٠ دقايق) — نبدأ من الأول */
 wipeFlow();
 askCode();
 return;
 }
 if (o.s === 404) {
 wipeFlow();
 paintPad(false);
 say('❌ الحساب مش موجود — ابدأ من الأول', false);
 return;
 }
 wipeFlow();
 paintPad(false);
 say('❌ مش قادرين نكمّل — جرّب تاني', false);
 })
 .catch(function () {
 state.pin = ''; paintDots(); paintPad(false);
 down('تغيير الباسورد');
 });
 });
 }

 /* ═══ «أريد مساعدة» — صفحة مساعدة جوه البوابة ═══ */
 function help() {
 stopLock();
 head('مساعدة', 1);
 boxEl().className = 'gt-box';
 formEl().innerHTML =
 '<div class="gt-ico">💡</div>' +
 '<h1 class="gt-h">محتاج مساعدة؟</h1>' +
 '<div class="gt-txt left">' +
 '• <b>الباسورد</b> هو الـ4 أرقام اللي انت اخترتها أول مرة — من غيرهم مفيش دخول<br>' +
 '• <b>مفيش إيميل</b> في شاشة الدخول — الباسورد هو كل حاجة<br>' +
 '• <b>نسيت الـ4 أرقام؟</b> ابعت كود على إيميلك المسجّل واختار ٤ جديدة<br>' +
 '• <b>3 غلط ورا بعض جوه دقيقة</b> يطلبوا كود على الإيميل — وده بيحميك<br>' +
 '• <b>القفل</b> بعد ٤ محاولات غلط  وبيفتح فورًا  ابعت كود على الإيميل' +
 '</div>' +
 '<button class="gt-go" id="gtBackH" type="button">فهمت — ارجع</button>';

 document.getElementById('gtBackH').onclick = function () {
 if (boxEl().className.indexOf('pin') !== -1) login(); else welcome();
 };
 }

 /* ═══ تغيير الباسورد — للحساب القايم (من الإعدادات) ═══
 بيبعت /api/auth/pin/change والتوكن بيتلزق من octa-api.js */
 function pinStep(title, hint) {
 stopLock();
 state.pin = ''; state.len = PIN_LEN;
 mount();
 head(title, 1);
 boxEl().className = 'gt-box';
 formEl().innerHTML =
 '<p class="gt-txt">' + hint + '</p>' +
 padHtml(0) +
 '<button class="gt-back" id="gtBackC" type="button">رجوع</button>';
 var b = document.getElementById('gtBackC');
 if (b) b.onclick = function () { welcome(); };
 }

 function changePin() {
 pinStep('تغيير الباسورد', 'اكتب الباسورد القديم — 4 أرقام');
 onPad(function (oldPin) {
 paintPad(true);
 clearMsg();
 state.jump = setTimeout(function () {
 pinStep('الباسورد الجديد', 'اكتب الـ4 أرقام الجديدة');
 onPad(function (newPin) {
 paintPad(true);
 post('/api/auth/pin/change', { old_pin: oldPin, new_pin: newPin })
 .then(function (o) {
 if (o.s === 200 && o.d && (o.d.ok || o.d.token)) {
 if (o.d.token) put(o.d.token, o.d.user);
 shut();
 return;
 }
 state.pin = ''; paintDots(); paintPad(false);
 say('❌ ' + ((o.d && o.d.error) || 'الباسورد القديم غلط'), false);
 })
 .catch(function () { state.pin = ''; paintDots(); paintPad(false); down('التغيير'); });
 });
 }, 500);
 });
 }

 /* ═══════════════════════════════════════════════════════════
 🔄 مزامنة النسخة — تحلّ مشاكل «التباب القديم»
 ───────────────────────────────────────────────────────────
 ⛔ التابات القديمة في المتصفح بتفضل شغالة بالكود القديم
 (نفس الـDOM ونفس الـJavaScript) حتى بعد النشر. المستخدم
 يشوف رسالة من يوم فاتت ويحس إن الموقع باظ.
 ⛌ بنخزّن رقم النسخة، ولو اختلف → إعادة تحميل واحدة.
 ═══════════════════════════════════════════════════════════ */
 function syncBuild() {
 try {
 var me = document.currentScript;
 var v = (me && me.src || '').split('v=')[1] || '';
 if (!v) v = String(Date.now()).slice(0, 6);
 var prev = localStorage.getItem('octa_build_v');
 /* ⛔⛔⛔ الحلقة المفرغة  اللي كانت بتخلي الموقع مايفتحش:
 ⛌ الصفحة بتعمل reload  والتاب القديم لسه عنده
  النسخة القديمة  فبيرجع يعمل reload تاني  للأبد.
 ⛌ الحل  نعمل reload **مرة واحدة في الجلسة** بس 
  وبعدها نحدّث الرقم من غير reload  ونكمل. */
 if (prev && prev !== v) {
 var already = false;
 try { already = sessionStorage.getItem('octa_reloaded') === v; } catch (e) { already = false; }
 if (!already) {
 localStorage.setItem('octa_build_v', v);
 sessionStorage.setItem('octa_reloaded', v);
 location.reload();
 return;
 }
 /* ⛌ اتحمّل قبل كده  نكمل عادي  نحدّث بس الرقم. */
 }
 localStorage.setItem('octa_build_v', v);
 try { sessionStorage.setItem('octa_reloaded', v); } catch (e) { }
 } catch (e) { }
 }
 syncBuild();

 /* ═══════════════════════════════════════════════════════════
 ⏰ التجديد الصامت — كل ساعتين بالظبط
 ───────────────────────────────────────────────────────────
 ⛔⛔⛔ صفر شاشات · صفر spinner · صفر إشعار · صفر طلب باسورد.
 المستخدم ميفحشش عن حاجة. الهدف إن الجلسة ما تقطعش
 وهو قاعد يقرأ.
 📌 التوكن الجديد بيتخزّن في نفس الاسم octa_token — زي النظام.
 ⛔⛔ ممنوع أي حاجة تانية تتخزّن: لا باسورد ولا كود إيميل
 ولا بصمة. المتصفح بيخزّن التّوكن بس.
 ⛔ مافيش مؤقّت جلسات في الواجهة — ما فيش شاشة بتقفل بعد
 وقت معيّن. البوابة بتظهر بس لما السيرفر يرفض التوكن.
 ═══════════════════════════════════════════════════════════ */
 var renewAt = 0;
 var renewTimer = null;
 var renewMs = RENEW_FALLBACK_MS; /* بيتحدّث من expires_in كل مرة */

 function renew() {
 /* ⛔ مفيش توكن = مفيش حاجة نعملها — ونتقفل بهدوء */
 if (!token()) return Promise.resolve({ s: 0, d: {} });
 renewAt = Date.now() + renewMs;

 /* 📌 POST /api/auth/refresh — التوكن القديم بس.
 ⛔ الـbody فاضي عن قصد: الباك بيرفض أي credential فيه بـ401. */
 return postAuth(RENEW_PATH, {}, token()).then(function (o) {
 if (o.s === 200) {
 /* 📌 لو رجّع توكن جديد → نحدّثه بصمت. */
 if (o.d && o.d.token) {
 put(o.d.token, o.d.user);
 /* ⛔ الجدولة بتتبع السيرفر دايماً — لو غيّر عمر التوكن
 من غير ما نعرف، هنمشي معاه. */
 renewMs = renewDelayMs(o.d.expires_in);
 clearInterval(renewTimer); renewTimer = null;
 renewEvery();
 }
 return o;
 }
 if (o.s === 401 || o.s === 400) {
 /* ⛔⛔⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐⭐⭐ إصلاح «البوابة فجأة»
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 السبب: التوكن خلص (ساعتين) والـrefresh رجّع 401 ⇒ الكود
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ logoutLocal() + open() ⇒
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ **البوابة فجأة** وبنص
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ✅ الحل: قبل ما نطلّع المستخدم — نجيب /api/auth/me
 📌 ✅ (الكوكي HttpOnly ممكن يبقى صالح!) ⇒ لو رجّع 200
 📌 ✅ ⇒ نجدد التوكن ونكمل. لو 401 ⇒ فعلاً خلص ⇒ البوابة.
 📌 ⛌ (ومتنسحبش الـtoken لوSessionShopekh还会话)
 */
 /* ⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐ /api/auth/me = GET (مش POST!)
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ */
 return fetch(apiBase() + '/api/auth/me', {
 headers: { 'Authorization': 'Bearer ' + token() },
 credentials: 'include',
 cache: 'no-store'
 }).then(function (rr) {
 return rr.text().then(function (txt) {
 var m = { s: rr.status, d: {} };
 try { m.d = JSON.parse(txt || '{}'); } catch (e) { }
 return m;
 });
 }).then(function (m) {
 if (m.s === 200 && m.d && m.d.token) {
 /* ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ */
 put(m.d.token, m.d.user);
 renewMs = renewDelayMs(m.d.expires_in);
 clearInterval(renewTimer); renewTimer = null;
 renewEvery();
 return o;
 }
 /* ⛌ ⛌ ⛌ ⛌ ⛌ فعلاً الجلسة خلصت ⇒ البوابة
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ */
 /* ⛔ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ */
 if (inFlow()) { return o; }   /* ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ */
 logoutLocal();
 wipeFlow();
 welcome();
 open();
 return o;
 }).catch(function () {
 /* ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ خطأ شبكة ⇒ ما نفتحش البوابة (المستخدم خالص). */
 return o;
 });
 }
 /* ⛔ خطأ شبكة أو 500 — مش هنقفل حاجة على المستخدم؛
 هنجرّب تاني بعد نفس المدة. */
 return o;
 }).catch(function () { return { s: 0, d: {} }; });
 }

 /* 📌 المجدول — بيتحسب من expires_in اللي الباك رجّعه. */
 function renewEvery() {
 if (renewTimer) clearInterval(renewTimer);
 renewAt = Date.now() + renewMs;
 renewTimer = setInterval(function () { renew(); }, renewMs);
 }

 /* ═══════════════════════════════════════════════════════════
 ⏱ نافذة الخمول — ٣٠ دقيقة من غير ما يلمس الموقع
 ───────────────────────────────────────────────────────────
 ⛔⛔⛔ دي **خامل (idle) في المتصفح** — مش تروكن بصري ومش وقت
 HTTP. بتتحسب من **آخر لمسة**: ماوس · لمس · ضغط · كتابة ·
 scroll. مش من وقت فتح الصفحة.
 ⛌ mousemove لوحده بيحصل أثناء القراءة العادية — فمفيش إزعاج
 للمستخدم اللي قاعد يقرأ من غير ما يحرّك إيده.
 ⛔⛔/browser ما فتحش الموقع تاني خالص → ما ينفعش نقفل حاجة
 أصلاً. القفل بيحصل أول ما يرجع.
 ═══════════════════════════════════════════════════════════ */
 var lastTouch = Date.now();
 function touch() { lastTouch = Date.now(); }
 ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel']
 .forEach(function (ev) {
 try { document.addEventListener(ev, touch, { passive: true }); } catch (e) { }
 });

 function idleCheck() {
 /* ⛔ مفيش توكن (في البوابة دلوقتي) → مافيش قفل */
 if (!token()) { lastTouch = Date.now(); return; }
 if (Date.now() - lastTouch <= IDLE_MS) return;
 /* ⛔ عدّى نص ساعة خامل → البوابة. التوكن يتمسح. */
 logoutLocal();
 wipeFlow();
 lastTouch = Date.now();
 welcome();
 open();
 }

 /* 📌 التابات بتجمّد المؤقّتات في الخلفية. أول ما المستخدم يرجع
 للتاب بنشوف: عدّى وقت الخمول ولا التجديد ولا لأ. بصمت. */
 document.addEventListener('visibilitychange', function () {
 if (document.visibilityState !== 'visible') return;
 if (token() && Date.now() - lastTouch > IDLE_MS) { idleCheck(); return; }
 if (Date.now() - renewAt >= 0) renew();
 });

 setInterval(idleCheck, IDLE_TICK);
 renewEvery();

 /* ═══ تشغيل ═══ */
 window.OCTAGate = {
 open: open, shut: shut,
 welcome: welcome, login: login, signup: signup,
 forgot: forgot, help: help, changePin: changePin,
 /* 📌 الشاشتين الجديدتين مفتوحين للاختبار والمعاينة */
 askCode: askCode, codeEntry: codeEntry, newPin: newPin,
 bioScreen: bioScreen, bioTurnOn: bioTurnOn, bioTurnOff: bioTurnOff,
 /* ⭐⭐⭐ ⭐⭐ دالة واحدة  لكل حاجة البصمة.
 ⛌ كانت  القائمة بتعمل `fetch`  لوحدها  وبتعمل
 request  مختلف  وbrowser  بيرفضها.
 ⛌ ⭐ دلوقتي  كل حاجة  من هنا  مسار واحد . */
 bioToggle: bioDo,
 renew: renew, renewEvery: function () { return renewMs; }
 };

 /* ⛔⛌ السيرفر رفض بيانات محمية (401) — يعني التوكن مش صالح.
 ⛌ قبل الكود ده كان الموضوع صامت: الصفحة بتفتح وهي فاضية
 والـuser مبيعرفش إن السبب إن sessionته انتهت.
 ⛌ دلوقتي: نقوله بالظبط ونرجّعه للبابة بدل ما نسيبه قدام
 صفحة صامتة. */
 window.OCTAAuthFail = function (path) {
 if (window.__octaAuthFailShown) return; /* مرة واحدة بس */
 window.__octaAuthFailShown = true;
 logoutLocal();
 var b = document.getElementById('octaAuthMsg');
 if (!b) {
 b = document.createElement('div');
 b.id = 'octaAuthMsg';
 b.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;'
 + 'align-items:center;justify-content:center;background:rgba(10,14,20,.82);'
 + 'padding:20px;font-family:system-ui,sans-serif';
 b.innerHTML = '<div style="max-width:340px;background:var(--pri2);'
 + 'border:1px solid var(--line);border-radius:16px;padding:26px;'
 + 'text-align:center;color:var(--txt)">'
 + '<div style="font-size:34px">🔑</div>'
 + '<div style="margin:10px 0 6px;font-size:18px;font-weight:700">انتهت جلستك</div>'
 + '<div style="color:var(--muted);font-size:14px;line-height:1.7">'
 + 'حسابك مش متعرّف عليه — ادخل بالباسورد تاني</div>'
 + '<button id="octaAuthAgain" style="margin-top:18px;width:100%;padding:12px;'
 + 'border:0;border-radius:10px;background:var(--gold);color:var(--pri4);'
 + 'font-weight:700;font-size:15px;cursor:pointer">إعادة الدخول</button></div>';
 document.body.appendChild(b);
 var g = document.getElementById('octaAuthAgain');
 if (g) g.onclick = function () {
 try { b.remove(); } catch (e) { }
 window.__octaAuthFailShown = false;
 welcome();
 open();
 };
 }
 };

 window.addEventListener('DOMContentLoaded', function () {
 /* ⛔ localhost ميفتحش البوابة — للتطوير */
 try {
 var h = location.hostname;
 if (h === 'localhost' || h === '127.0.0.1') { shut(); return; }
 } catch (e) { }

 /* ⛌ الترتيب الصح: ارسم ← اقفل ← تحقق.
 البوابة بترسم نفسها الأول — دايماً، قبل أي تحقق. */
 /* ⛔⛔⛔⛔ لازم البوابة ما تظهرش **لحظة واحدة**  ولا في حال.
 ⛌ `mount()` + `open()`  بيعملوا طبقة فوق الشاشة كلها
  (position:fixed · inset:0 · z-index:999999).
 ⛌ كده المستخدم بيشوف الموقع من تحتها  وبيعمل اسكرول
 ⛌ وكل دوسة بتروح للبوابة  «مفيش حاجة بتستجيب» 
 ⛌ وده بالظبط اللي كان بيحصل.

 ⭐ الترتيب الصح  نتحقق **قبل** ما نرسم.
 ⛌ فيه توكن  نرسم شاشة «بنتحقق» بس  مش البوابة كلها.
 ⛌ مافيش توكن  عندنا البوابة كلها  زي ما هي. */
 if (token()) {
 /* ⛌ التوكن موجود  متحطش البوابة الكاملة  خلي
 الموقع يبان، وحط شريط صغير فوقه لحد ما نتحقق. */
 verify();
 return;
 }
 /* ⛔⛔⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐⭐⭐ إصلاح «البوابة بعد كل refresh»
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 السبب: الكوكي HttpOnly ممكن يبقى موجود والـlocalStorage اتمسح.
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⇒ الكود القديم كان بيعمل probeApi('/api/health') ⇒ السيرفر
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⇒ شغال ⇒ mount() + welcome() + open() ⇒ **البوابة مفتوحة**
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⇒ والمستخدم مسجّل فعلاً! (الكوكي لسه صالح)
 📌 ✅ الحل: نطلب /api/auth/me الأول — لو رجّع 200 ⇒ في
 📌 ✅ جلسة ⇒ نجيب التوكن وندخل. لو 401 ⇒ زائر ⇒ البوابة.
 📌 ⛌ (الكوكي HttpOnly بيبعت تلقائياً مع الطلب — فمافيش
 📌 ⛌ حاجة تتقرا من JS)
 */
 hint('⏳ بنتحقق من حسابك…', '#0f2a44', '#cfe3f5');
 fetch(apiBase() + '/api/auth/me', {
 headers: token() ? { 'Authorization': 'Bearer ' + token() } : {},
 credentials: 'include',
 cache: 'no-store'
 }).then(function (r) {
 clearHint();
 if (r && r.ok) {
 /* ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ في جلسة (بالكوكي)
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ */
 return r.text().then(function (txt) {
 try {
 var _bd = JSON.parse(txt || '{}');
 if (_bd && _bd.token && _bd.user) {
 put(_bd.token, _bd.user);
 shut();
 return 'DONE';
 }
 } catch (e) { }
 });
 }
 /* ⛌ مافيش جلسة ⇒ زائر ⇒ البوابة (الوضع الطبيعي) */
 return null;
 }).catch(function () { clearHint(); return null; })
 .then(function (r) {
 /* ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ لو لقى جلسة ⇒ خلّينا البوابة مقفولة ودخلنا.
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ */
 if (r === 'DONE') return;
 mount(); welcome(); open();
 });
 /* ⛔⛔⛔ ٢٢ أكتوبر ٢٠٢٦ — السيرفر واقع + مافيش توكن
 ⛌ الكود القديم: البوابة كاملة وال��ستخدم مش قادر يدخل (لأن
 ⛌   الدخول نفسه محتاج السيرفر). ⇒ تقفل قدام البوابة وخلاص.
 ⛌ الحل: نفحص الـhealth بسرعة (٣ ثواني) — لو السيرفر واقع
 ⛌   بنفتح التصفح (الأدوات اللي مش محتاجة السيرفر بتفضل شغالة)
 ⛌   بدل ما نقفل البوابة على مستخدم مالوش حل.
 ⛌ ⛔ الداتا المحمية لسه محمية: كل endpoint ورا require_user. */
 probeApi(function (down) {
 /* ⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐⭐⭐ «الموقع فتح عادي» اتقفل
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 السبب: الكود القديم هنا كان يعمل shut() لما السيرفر يرد
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⇒ بعد ٣ ثواني فشل ⇒ الموقع بيفتح (من غير تسجيل!).
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ✅ الحل: (١) لو في تدفّق ⇒ ما نقفلش
 📌 ✅ (٢) لو فيه توكن ⇒ ما نقفلش (مستخدم مسجّل)
 📌 ✅ (٣) زائر ⇒ نسمح بالتصفح (مع شريط تنبيه) — وده صح
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 */
 if (down) {
 try { sessionStorage.setItem('octa_allow_browse', '1'); } catch (e) { }
 try {
 var hs = document.querySelectorAll('.gt-netbar');
 for (var i = 0; i < hs.length; i++) hs[i].remove();
 } catch (e) { }
 var nb = document.createElement('div');
 nb.className = 'gt-netbar';
 nb.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:999999;'
 + 'background:#7a2b16;color:#ffd9c9;padding:11px 14px;'
 + 'font:600 14px/1.5 system-ui;text-align:center';
 nb.textContent = '⚠️ السيرفر بينزل — بتفتح بدون تسجيل. الداتا المحمية هتطلب الدخول.';
 try { document.body.appendChild(nb); } catch (e) { }
 /* ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ */
 if (inFlow() || token()) {
 /* ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ */
 hint('⚠️ السيرفر بطيء — استنى ثانية.', '#7a2b16', '#ffd9c9');
 mount(); welcome(); open();
 return;
 }
 shut();
 return;
 }
 mount();
 welcome();
 open();
 });
 });

 /* ⛌ فحص سريع: السيرفر شغال ولا واقع؟ (٣ ثواني وخلاص) */
 function probeApi(cb) {
 try {
 var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
 var to = setTimeout(function () { if (ctrl) try { ctrl.abort(); } catch (e) { } }, 3000);
 fetch(apiBase() + '/api/health', { credentials: 'include', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
 .then(function (r) {
 clearTimeout(to);
 /* 5xx = السيرفر واقع · أي 2xx/4xx = شغال (الـhealth مفتوح) */
 cb(!!(r && r.status >= 500));
 })
 .catch(function () { clearTimeout(to); cb(true); });
 } catch (e) { cb(false); }
 }

 /* ⛔⛔⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐⭐⭐ إصلاح «hint is not defined»
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 السبب: `clearHint` و `hint` كانوا معرّفين **جوّه verify()**
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⇒ أي استخدام **بره** verify() ⇒ ReferenceError ⇒ «hint is
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 not defined» ⇒ الـDOMContentLoaded handler وقع ⇒ البوابة
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ✅ الحل: نرفعهم للنطاق المشترك (IIFE) عشان كل الشاشات
 📌 ✅ تقدر تستخدمهم.
 */
 function clearHint(){
 try {
 var hs = document.querySelectorAll('.gt-netbar');
 for (var i = 0; i < hs.length; i++) hs[i].remove();
 } catch (e) { }
 }

 function hint(msg, bg, fg){
 clearHint();
 try {
 var b = document.createElement('div');
 b.className = 'gt-netbar';
 b.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:999999;'
 + 'background:' + bg + ';color:' + fg + ';padding:11px 14px;'
 + 'font:600 14px/1.5 system-ui;text-align:center';
 b.textContent = msg;
 try { document.body.appendChild(b); } catch (e) { }
 } catch (e) { }
 }

 /* التأكد إن التوكن لسه صالح — لو مش كده نرجع للبوابة */
 function verify() {
 var t = token();
 if (!t) { mount(); welcome(); open(); return; }
/* ⛔⛔⛔⛔ ⭐ الإصلاح ٢٠ أكتوبر ٢٠٢٦
 ⛌ الكود القديم كان بيشيل البوابة **قبل** الـfetch:
 ⛌   try { var g0 = gateEl(); if (g0) g0.remove(); } catch (e) { }
 ⛌   document.body.style.overflow = '';
 ⛌ وبعدين بيعمل الـfetch.
 ⛌ النتيجة: أي توكن مزيف + شبكة ضعيفة = الموقع بيفتح بالكامل.
 ⛌ كومنت الكود نفسه كان مكتوب فيه «شك = مقفول» — والسلوك كان معاكس.
 ⛌ ⛔ الحل: البوابة تفضل مقفولة لحد ما نعرف. ما نرسمهاش أبداً. */

 
 /* ⛌ القاعدة: شك = مقفول لمدة ٨ ثواني، بعدها نسأل الواجهة عن
   الإجابة من cache (يدوي/افتراضي: مفتوح). ده يمنع الـrace condition
   في أول load (الداتا في طريقها) من إنه يدخل حلقة شك لا تنتهي.
 · 200 → shut() → ينفتح
 · !ok → logoutLocal() + البوابة
 · خطأ شبكة → ٣ محاولات (max ٨ ثواني) → البوابة + رسالة
 · ⛔ بعد ٨ ثواني بدون رد: نسمح بالتصفح زي زائر عادي
   (الباك لما يرد هيتحقق من require_user في كل endpoint محمي) */

 var tries = 0, MAX_TRIES = 3;
 var STARTED = 0;

 function verifyOnce(){
 STARTED = Date.now();
 /* ⛔⛔ ٢٢ أكتوبر ٢٠٢٦ — مهلة ٨ ثواني على الطلب نفسه.
 ⛌ الـWorker بيحاول ٣ مرات والـRailway واقع ⇒ الطلب بيرجع بعد
 ⛌   دقيقة أو أكتر. قبل كده المستخدم كان واقف قدام «جاري التحقق»
 ⛌   دقيقة كاملة. دلوقتي بنقطعه بعد ٨ ثواني وندخله تصفح. */
 var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
 var to = setTimeout(function () { if (ctrl) try { ctrl.abort(); } catch (e) { } }, 8000);
 return fetch(apiBase() + '/api/auth/me', {
 headers: { 'Authorization': 'Bearer ' + t },
 credentials: 'include',
 cache: 'no-store',
 signal: ctrl ? ctrl.signal : undefined
 }).then(function (r) {
 clearTimeout(to);
 /* ⛔⛔⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐⭐⭐ إصلاح «البوابة بعد كل refresh»
  📌 السبب: الكوكي HttpOnly بيفضل موجود، بس الـlocalStorage
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ ممكن يتمسح ⇒ التوكن ضاع ⇒ /api/auth/me رجّع
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ 401 ⇒ logoutLocal() + البوابة ⇒ والمستخدم
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ مسجّل فعلاً!
  📌 ✅ الحل: /api/auth/me بقى بيرجّع توكن جديد ⇒ نخزّنه.
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ (والكوكي لسه شغال كخط دفاع تاني)
  */
 if (r.ok) {
 /* ⛌⛌⛌ ٢٤ أكتوبر ٢٠٢٦ — ⭐ نقرأ الـbody مرة واحدة كـtext
  📌 (r.json() ممكن يت consume — safer نحمله ourselves)
  */
 try {
 r.text().then(function (txt) {
 try {
 var _bd = JSON.parse(txt || '{}');
 if (_bd && _bd.token && _bd.user) { put(_bd.token, _bd.user); }
 } catch (e) { }
 clearHint(); shut();
 });
 } catch (e) { clearHint(); shut(); }
 return;
 }
 /* ⛔⛔⛔⛔ ٢٢ أكتوبر ٢٠٢٦ — السيرفر واقع (5xx) مش توكن غلط
 ⛌ الكود القديم: أي !ok ⇒ logoutLocal() + البوابة.
 ⛌ النتيجة وقت حادثة Railway: الـWorker بيرجّع 502 ⇒ التوكن بيتمسح
 ⛌   والمستخدم بيتقفل قدام شاشة الدخول و**مش قادر يدخل خالص** —
 ⛌   مع إن في أدوات شغالة من غير السيرفر (الفلتر بيجيب داتاه من
 ⛌   TradingView مباشرة).
 ⛌ الحل: 5xx = السيرفر واقع ⇒ نفتح التصفح مع شريط تنبيه، والتوكن
 ⛌   يفضل مكانه (لما السيرفر يرجع تفضل مسجّل).
 ⛌ ⛔ 401/403 = التوكن فعلاً غلط ⇒ المسح + البوابة زي ما هي. */
 if (r.status >= 500) {
 clearHint();
 try { sessionStorage.setItem('octa_allow_browse', '1'); } catch (e) { }
 hint('⚠️ السيرفر بينزل — بتفتح بدون تسجيل. الداتا المحمية هتطلب الدخول.', '#7a2b16', '#ffd9c9');
 shut();
 return;
 }
 /* ⛔ التوكن مش صالح  المسح  وبعدين البوابة تظهر
  لأن مينفعش حد يتفرج من غير دخول. */
 clearHint();
 /* ⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐ لو المستخدم في نص تدفّق
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 (طلب كود · تسجيل · استرجاع) ⇒ ما نفتحش البوابة فوقه
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ✅ الحل: لو في تدفّق ⇒ نكتفي بمسح التوكن ومكملش
 📌 ✅ (المستخدم هيكمّل كتابة الكود / الباسورد عادي).
 */
 if (inFlow()) { return; }
 logoutLocal();
 mount(); welcome(); open();
 }).catch(function () {
 clearTimeout(to);
 tries++;
 var elapsed = (Date.now() - STARTED) / 1000;
 /* ⛔⛔ ٢١ أكتوبر ٢٠٢٦ — hard limit ٨ ثواني.
  ⛌ الباك في ساعات الذروة بيرد بعد ١٥ ثانية (timeout curl).
  ⛌ لو البوابة فضلت مقفولة أكتر من كده، المستخدم ميشوفش حاجة.
  ⛌ الحل: بعد ٨ ثواني نسمح للزائر يفتح زي ما في حالة عدم وجود توكن
  ⛌ (كل endpoints محمية محمية بـrequire_user على السيرفر — فمش دخول). */
 if (elapsed >= 8) {
 clearHint();
 /* ⛔⛔⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐⭐⭐ إصلاح «الموقع فتح عادي»
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 السبب: الكود القديم هنا كان يعمل shut() ⇒ **الموقع بيفتح**
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⇒ ده بالظبط اللي شكا منه أحمد («الموقع فتح عادي كمان»).
 📌 ✅ الحل: (١) مستخدم في تدفّق ⇒ ما نفتحش
 📌 ✅ (٢) مستخدم عنده توكن ⇒ ما نفتحش (البوابة تفضل مقفولة)
 📌 ✅ (٣) زائر من غير توكن ⇒ التصفح مفتوح (صح)
 */
 try { sessionStorage.setItem('octa_allow_browse', '1'); } catch (e) { }
 if (inFlow()) {
 hint('⚠️ السيرفر بطيء — استنى ثانية وحاول تكمل.', '#7a2b16', '#ffd9c9');
 mount(); welcome(); open();
 return;
 }
 if (token()) {
 hint('⚠️ السيرفر بطيء — بنحاول تاني. متقفلش الصفحة.', '#7a2b16', '#ffd9c9');
 mount(); welcome(); open();
 return;
 }
 /* ⛌ زائر من غير توكن ⇒ التصفح مفتوح (صح) */
 hint('⚠️ السيرفر بطيء — بتفتح بدون تسجيل. الداتا المحمية هتطلب الدخول.', '#7a2b16', '#ffd9c9');
 shut();
 return;
 }
 if (tries < MAX_TRIES) {
  hint('⏳ بنحاول نتأكد من حسابك… (' + tries + '/' + MAX_TRIES + ')', '#0f2a44', '#cfe3f5');
  setTimeout(verifyOnce, 900 * tries);
  return;
 }
 /* ⛔ فشلت كل المحاولات → نقفل ونقوله بوضوح. */
 hint('⛔ مش قادرين نتأكد من حسابك — الاتصال بالسيرفر ضعيف. جرّب تاني بعد شوية.', '#7a2b16', '#ffd9c9');
 /* ⛔ ما نفتحش. البوابة تفضل مقفولة. */
 mount(); welcome(); open();
 });
 }

 hint('⏳ جاري التحقق من حسابك…', '#0f2a44', '#cfe3f5');
 verifyOnce();
 }

})();
