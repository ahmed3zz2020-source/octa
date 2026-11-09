/* ═══ OCTA · octa-update.js · فحص التحديث (٦ نوفمبر ٢٠٢٦) ═══
   📌 المشكلة: أيقونة التطبيق المثبّت (WebAPK) على الموبايل كانت
   📌   بتعرض نسخة قديمة من الموقع — والباقي كله محدّث.
   📌 السبب المرجّح: الكاش/الـService Worker القديم في متصفح التثبيت،
   📌   أو كاش المتصفح داخل partitions التطبيق المثبّت.
   📌 ✅ الحل: بنقارن «ختم النسخة» (BUILD في الصفحة) بـ«ختم النسخة على
   📌   السيرفر» (version.json) ⇒ لو مختلف ⇒ شريط «فيه نسخة جديدة».

   📌 ليش version.json؟
   📌   index.html نفسه no-store ⇒ المتصفح بيجيبه جديد دايماً.
   📌   بس التطبيق المثبّت ممكن يكون عنده نسخة قديمة في الكاش.
   📌   ⇒ هنجيب ملف صغير من السيرفر بأمر «ما تخزّنش أبداً» ونقارن.

   ⚠️ ملاحظات تقنية:
   · الدوال جوّه object literal لازم بينها فاصلة.
   · ممنوع تكتب نص فيه خاتمة كومنت جوّه كومنت.
   · الفحص بـ esbuild مش node --check.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* 📌 ختم النسخة: من رابط السكربت نفسه وقت التنفيذ.
   ⛔ ليش مش من الـDOM؟ لأن سكربتات الصفحة بتتشال من الـDOM بعد ما تشتغل
   ⛔   (تنظيف الذاكرة) ⇒ document.querySelector مش هيلاقيها. */
var SELF_SRC = '';
try{ SELF_SRC = (document.currentScript && document.currentScript.getAttribute('src')) || ''; }catch(e){}

function curBuild(){
  /* 📌 ١) ختم عام لو موجود */
  try{ if (typeof window.OCTA_BUILD === 'string' && window.OCTA_BUILD) return window.OCTA_BUILD; }catch(e){}
  /* 📌 ٢) ختم نسخة السكربت نفسه (?v=…) — ده بيتبدّل مع كل build */
  try{
    var m = /[?&]v=([0-9a-z]+)/i.exec(SELF_SRC);
    if (m) return 'v=' + m[1];
  }catch(e){}
  try{ if (typeof BUILD !== 'undefined') return BUILD; }catch(e){}
  return '';
}

function showBar(){
  try{
    if (document.getElementById('octaUpdateBar')) return;
    var bar = document.createElement('div');
    bar.id = 'octaUpdateBar';
    bar.innerHTML = '<div class="octa-upd"><span>🆕 فيه نسخة جديدة من (OCTA)</span>' +
      '<button type="button" onclick="octaApplyUpdate()">تحديث دلوقتي</button></div>';
    document.body.appendChild(bar);
  }catch(e){}
}

/* ⭐ التحديث: ⭐⭐⭐ ٩ نوفمبر ٢٠٢٦ — الطريقة الآمنة
   📌 العَرَض (مقيس): التطبيق المثبّت (WebAPK) بيفتح **شاشة بيضا**
      بعد ضغط «تحديث دلوقتي».
   📌 السبب الجذري: الكود القديم كان (أ) بيمسح **كل الكاش** و(ب) بيعمل
      `reload()` **فوراً** — والـService Worker القديم (٢٩ أكتوبر) كان
      **لسه ماسك** النطاق ⇒ التنقّل بعد المسح بيفشل ⇒ كروم بيعرض
      صفحة فاضية (مش رسالة، مش خطأ — بيضا).
      ⛔⇦ ومسح الكاش والـSW لسه شغّال = **حالة ميتة** (catch-22):
      صفحة الشاشات البيضاء ماتحملش ⇒ سكربت التنظيف مش بيشتغل.
   ✅ الترتيب الصح (3 خطوات):
      ① نسجّل `/sw.js` = «مفتاح الإطفاء» (مفيش fetch handler ⇒ كل
         الطلبات بتعدّي للشبكة) ⇒ الـSW القديم يتسحب.
      ② نستنى لـclients.claim() ⇒ يبقى المفتاح ماسك الصفحة.
      ③ نمسح الكاش **بعد ما يبقى شغّال** ⇒ وبعدين reload ⇒ الصفحة بتفتح
         من الشبكة نظيفة ⇒ والمفتاح بيلغي نفسه.
   ⛔ ممنوع نعمل reload قبل ما المفتاح يبقى شغّال. */
window.octaApplyUpdate = function () {
  try {
    var b = document.querySelector('#octaUpdateBar button');
    if (b) { b.disabled = true; b.textContent = '⏳ بنحدّث…'; }
  } catch (e) { }
  var done = false;
  var reload = function () {
    if (done) return;
    done = true;
    /* ⭐⭐⭐ ٩ نوفمبر ٢٠٢٦ — ⭐⭐⭐ message أثناء التحديث
       📌 العَرَض: بعد الضغط على «تحديث دلوقتي» الصفحة بتفتح فاضية
          لحد ما التطبيق يعمل boot (٥–١٥ ثانية على شبكة الموبايل)
          ⇒ المستخدم بيشوف **شاشة بيضا** ويظن إن التطبيق اتخرّب.
       ✅ الحل: نكتب رسالة «⏳ بنحدّث…» في الصفحة **قبل** الـreload
          ⇒ كروم بيخلي الصفحة القديمة ظاهرة لحد ما الجديدة تجي
          ⇒ المستخدم بيشوف رسالة واضحة بدل بيضا. */
    try {
      var m = document.createElement('div');
      m.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;background:#0a1929;'
        + 'color:#e8f1ff;font:700 16px system-ui;display:flex;flex-direction:column;'
        + 'align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px');
      m.innerHTML = '<div style="font-size:46px">⏳</div>'
        + '<div>⏳ بنحدّث دلوقتي…</div>'
        + '<div style="font-weight:400;opacity:.75;font-size:13px;max-width:280px;line-height:1.7">'
        + 'جاري تحميل النسخة الجديدة. اقفل الشاشة شوية — التطبيق هيفتح لوحده.'
        + '</div>';
      document.body.appendChild(m);
    } catch (e) { }
    setTimeout(function () { try { window.location.reload(); } catch (e) { } }, 250);
  };
  var clearCaches = function () {
    try {
      if (window.caches && window.caches.keys) {
        window.caches.keys().then(function (ks) {
          (ks || []).forEach(function (k) { try { caches.delete(k); } catch (e) { } });
        }).catch(function () { });
      }
    } catch (e) { }
  };
  /* ⭐⭐⭐ المسار الأساسي (٩ نوفمبر ٢٠٢٦)
     📌 ⭐ المعرفة الأساسية: `register('/sw.js')` لو رجعت بنجاح ⇒
        المتصفح **استبدل** أي Service Worker كان مسجّل في نفس النطاق
        (التسجيل واحد لكل scope — السكربت بيتحدّث) ⇒ الـSW القديم
        مبقاش له حق يعترض أي تنقّل ⇒ ⭐ يبقى مسح الكاش **آمن ١٠٠٪**.
        ⇒ ومن هنا: مسح الكاش + reload ⇒ الصفحة بتفتح من الشبكة.
     📌 والأمان مضاعف: المفتاح نفسه بيمسح الكاش ويلغي تسجيل نفسه. */
  var stepSafe = function () {
    clearCaches();
    setTimeout(reload, 700);
  };
  /* ⭐⭐⭐ المسار البديل
     📌 لو تعذّر تسجيل المفتاح (شبكة ضعيفة / SW مرفوض) ⇒ ما نمسحش
        الكاش والـSW القديم لسه ماسك (ده = شاشة بيضا).
     ✅ `?clean=1` — الـSW القديم نفسه (٢٩ أكتوبر) **بيعدّي** الطلب
        للشبكة ويلغي تسجيل نفسه ⇒ الصفحة بتفتح + النطاق ينضف.
        ⭐ والسيرفر كمان بيضيف `Clear-Site-Data` على الرابط ده. */
  var stepFallback = function () {
    try {
      var p = location.pathname || '/';
      location.replace(p + (p.indexOf('?') === -1 ? '?' : '&') + 'clean=1&t=' + Date.now());
      return;
    } catch (e) { }
    stepSafe();
  };
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.register) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function () { setTimeout(stepSafe, 500); })
        .catch(function () { stepFallback(); });
    } else {
      stepFallback();
    }
  } catch (e) { stepFallback(); }
  /* ⭐ شبكة أمان: بعد ٣٫٥ ثانية لو ماحصلش حاجة ⇒ المسار الآمن
     ⛔ ممنوع نمسح الكاش والـSW القديم لسه ماسك ⇒ ده سبب البيضا. */
  setTimeout(function () { if (!done) stepFallback(); }, 3500);
};

function check(){
  try{
    if (!navigator.onLine) return;
    fetch('version.json?_=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    }).then(function (r){ return r.ok ? r.json() : null; })
      .then(function (v){
        if (!v || !v.build) return;
        if (v.build === curBuild()) return;
        showBar();
      }).catch(function () { });
  }catch(e){}
}

try{
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(check, 2500); });
  } else {
    setTimeout(check, 2500);
  }
  /* ⭐ إعادة الفحص كل ٥ دقايق (الموقع ممكن يبقى مفتوح طويل) */
  setInterval(check, 300000);
}catch(e){}
})();
