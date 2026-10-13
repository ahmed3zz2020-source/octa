/* ═══ octa-csp.js ═══
   ⛌ ليه file منفصل؟
   سطر meta في الـHTML بيتنفذ قبل أي حاجة. لو في خطأ،
   الصفحة كلها مبيتحملش أصلاً ومن vesiclesنشوفش حاجة.
   هنا بنحطه بعد تحميل الصفحة، ونقدر نطفيه لو/File heetgsht
   الملف موجود مش ناقص.

   📌 report-only الأول: المتصفح بيسجّل المخالفات بدل ما يمنعها.
      لو مش كل حاجة ماشية صح، نفضل نراقب بدل ما نكسر الموقع على الناس.
*/
(function () {
  'use strict';
  var ENFORCE = false;   // ⛔ خلّيها false لحد ما نتأكد إن مفيش مخالفة

  function readMeta() {
    var m = document.querySelector('meta[name="octa-csp-report"]');
    return m ? m.getAttribute('content') : null;
  }

  function install(csp) {
    var s = document.createElement('meta');
    s.setAttribute('http-equiv', 'Content-Security-Policy');
    if (!ENFORCE) s.setAttribute('content', 'report-uri /csp-report; ' + csp);
    else           s.setAttribute('content', csp);
    document.head.appendChild(s);
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else fn();
  }

  ready(function () {
    var csp = readMeta();
    if (!csp) return;
    try { install(csp); } catch (e) { /* أحسن ما نكسر الصفحة */ }
  });
})();
