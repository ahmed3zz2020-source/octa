/* ══════════════════════════════════════════════════════════════
   🛡️ تسجيل الـService Worker (٢٩ أكتوبر ٢٠٢٦)
   📌 السبب: التطبيق المثبّت (WebAPK) كان بيمسك نسخة قديمة
   📌   من الصفحة ⇒ لو كانت فاضية ⇒ شاشة بيضا للأبد.
   📌 الحل: SW يعمل network-first ⇒ كل فتح ياخد نسخة حية.
   ⛔ لازم يتحمّل من أصل الجذر (/) عشان يشمل المسار كله.
   ⛔ التسجيل بيحصل بعد الـload عشان ما يبطئش أول رسم للصفحة.
   ══════════════════════════════════════════════════════════════ */
(function () {
  try {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:') return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js?v=20261029', { scope: '/' }).then(function (reg) {
        try { window.__octaSW = reg; } catch (e) { }
      }).catch(function () { /* ⛔ التسجيل فشل ⇒ الموقع يشتغل عادي */ });
    });
  } catch (e) { }
})();
