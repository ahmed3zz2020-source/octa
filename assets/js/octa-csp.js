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
  var ENFORCE = false;  // ⛔ خلّيها false لحد ما نتأكد إن مفيش مخالفة

  function readMeta() {
  var m = document.querySelector('meta[name="octa-csp-report"]');
  return m ? m.getAttribute('content') : null;
  }

  function install(csp) {
  /* ⛌ report-uri و frame-ancestors المتروكة بالـmeta بيطلعوا تحذير.
  المتصفح بيتجاهلهم تماماً — إحنا بنحطّهم في الهيدر
  (Railway/CORS) — هنا بنشيلهم ونسيب الباقي يشتغل. */
  csp = csp.replace(/report-uri[^;]*;?\s*/i, '')
  .replace(/frame-ancestors[^;]*;?\s*/i, '');
  var el = document.createElement('meta');
  el.setAttribute('http-equiv', 'Content-Security-Policy');
  el.setAttribute('content', csp);
  document.head.appendChild(el);
  }

  function ready(fn) {
  if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fn);
  } else fn();
  }

  ready(function () {
  /* ⛔⛔⛔⛔ كان ENFORCE = false  بس الكود **بيتجاهلها خالص**
  وبيركّب الـCSP في كل مرة  والـCSP ده فيه
  script-src 'self'  من غير 'unsafe-inline'
  ⭐ وده بيمنع **كل** onclick في الـHTML 
  ٧٠ زر  كلهم ميتين  والمستخدم بيشوف
  «مفيش حاجة شغالة»  والسبب مش واضح.

  ⛌ الحل  نقرأ ENFORCE فعلاً  ولو false  نقدر
  نعمل report-only بدل ما نمنع. */
  if (!ENFORCE) {
  try {
  var csp = readMeta();
  if (csp) {
  csp = csp.replace(/report-uri[^;]*;?\s*/gi, '')
  .replace(/frame-ancestors[^;]*;?\s*/gi, '');
  var el = document.createElement('meta');
  el.setAttribute('http-equiv', 'Content-Security-Policy-Report-Only');
  el.setAttribute('content', csp);
  document.head.appendChild(el);
  }
  } catch (e) { }
  return;  /* ⛔ متركّبش حاجة  الصفحة تشتغل عادي */
  }
  var csp2 = readMeta();
  if (!csp2) return;
  try { install(csp2); } catch (e) { /* أحسن ما نكسر الصفحة */ }
  });
})();
