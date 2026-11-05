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

/* ⭐ التحديث: نمسح أي Service Worker + الكاش ⇒ reload ⇒ نسخة جديدة */
window.octaApplyUpdate = function () {
  try{
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations){
      navigator.serviceWorker.getRegistrations().then(function (rs){
        (rs||[]).forEach(function (r){ try { r.unregister(); } catch (e) { } });
        if (window.caches && window.caches.keys){
          window.caches.keys().then(function (ks){
            (ks||[]).forEach(function (k){ try { caches.delete(k); } catch (e) { } });
          }).catch(function () { });
        }
      }).catch(function () { });
    }
  }catch(e){}
  try{ window.location.reload(); }catch(e){}
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
