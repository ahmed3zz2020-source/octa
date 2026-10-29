/* ══════════════════════════════════════════════════════════════
   🧹 تنظيف Service Workers (٣٠ أكتوبر ٢٠٢٦)
   ────────────────────────────────────────────────────────────────
   📌 السبب: الـService Worker الأول (شبكة أوفلاين) سبّب مشاكل في
   📌   كروم: شاشة بيضا + «تنزيل الملف» + كاش بيتمسح وسط التحميل.
   📌 ✅ القرار: رجعنا لوضع المتصفح العادي (مفيش SW).
   📌 📌 الملف ده بيعمل حاجتين:
   📌   ① بيلغي **كل** Service Workers مسجّلة على الموقع (القديمة).
   📌   ② بيمسح كل الكاش.
   📌   ⇒ لو المستخدم لسه عنده الـSW القديم، أول صفحة تفتح بتقتله
   📌     والتحديث اللي بعدها بيبقى طبيعي ١٠٠٪.
   ⛔ مفيش تسجيل جديد — الملف ده **من cleaner فقط**.
   ══════════════════════════════════════════════════════════════ */
(function () {
  try {
    if (!('serviceWorker' in navigator)) return;

    function kill() {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        if (!regs || !regs.length) return;
        regs.forEach(function (r) {
          try { r.unregister(); } catch (e) { }
        });
        /* ⛔ الكاش: نمسحه بس لو كان فيه SW (يعني كان في خرب) */
        if (window.caches && window.caches.keys) {
          window.caches.keys().then(function (keys) {
            keys.forEach(function (k) { try { window.caches.delete(k); } catch (e) { } });
          }).catch(function () { });
        }
      }).catch(function () { });
    }

    if (document.readyState === 'complete') kill();
    else window.addEventListener('load', kill);
  } catch (e) { }
})();
