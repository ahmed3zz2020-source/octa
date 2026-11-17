/* 🛡️ الجولة ٢٠ (R20 · المرحلة ٥) — طبقة الوصولية (a11y sweep)
 *
 * 📌 المشكلة (مثبتة بالقياس): ⛔ **١٠٠** حقل إدخال/اختيار في الواجهة
 *   **من غير اسم مقروء** (aria-label / label) ⭐ ⇒ قارئ الشاشة
 *   بيقول «نص» وخلاص ⭐ ⇒ ⛔ الحقل ده مش قابل للاستخدام ⭐.
 *
 * ✅ الحل: ⭐ **مسح واحد** بعد كل رسم ⭐ بيملأ `aria-label` من:
 *   ① label مرتبط (`for=` / أب) ⭐ — لو موجود ⇒ نتخطاه ⭐
 *   ② `placeholder` ⭐
 *   ③ `title` ⭐
 *   ④ ⭐ **النص المرئي في نفس الصف/الحاوية** ⭐ (ده أفضل اسم مقروء ⭐)
 *   ⑤ ⭐ بديل حسب النوع ⭐ (بحث / قيمة / اختيار / تاريخ) ⭐
 *
 * ⛔ ما بنغيّرش أي شكل ولا سلوك ⭐ (بضيف aria-label بس ⭐)
 * ⛔ ما بنكتبش كود فيه أسماء أدوات ذكاء اصطناعي ⭐
 */
(function () {
  'use strict';
  if (window.OCTAA11y && window.OCTAA11y.sweep) return;

  function txtOf(el) {
    try {
      var s = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return s;
    } catch (e) { return ''; }
  }

  /* ⭐ النص المرئي الأقرب: الصف/الحاوية اللي فيها الحقل ⭐ */
  function visibleLabel(el) {
    var tries = ['label', '.flt-row', '.row', '.flt-item', '.f-item',
                 '.filter-row', '.sh-item', '.cell', 'td', 'li', '.card',
                 '.panel', 'section', 'div'];
    for (var i = 0; i < tries.length; i++) {
      var host = el.closest ? el.closest(tries[i]) : null;
      if (!host || host === el) continue;
      var t = txtOf(host);
      /* ⛔ الاسم لازم يكون قصير ⇒ سطر واحد ⭐ */
      t = t.split('\n')[0].trim();
      if (t && t.length <= 60) {
        /* ⛔ لو النص هو القيمة نفسها (رقم) ⇒ مش اسم ⭐ */
        if (!/^[\d\s.,%-]+$/.test(t)) return t;
      }
    }
    return '';
  }

  function fallbackFor(el) {
    var tag = (el.tagName || '').toLowerCase();
    var type = (el.type || '').toLowerCase();
    if (tag === 'select') return 'اختيار';
    if (type === 'search') return 'بحث';
    if (type === 'range') return 'قيمة';
    if (type === 'number') return 'رقم';
    if (type === 'checkbox') return 'خيار';
    if (type === 'radio') return 'خيار';
    if (type === 'date') return 'تاريخ';
    if (type === 'email') return 'بريد إلكتروني';
    if (type === 'password') return 'كلمة مرور';
    return 'حقل إدخال';
  }

  function sweep() {
    var els = document.querySelectorAll('input, select, textarea');
    var n = 0;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      try {
        /* ⛔ الحقول المخفية ما تحتاجش اسم ⭐ */
        var ty = (el.type || '').toLowerCase();
        if (ty === 'hidden') continue;
        if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) continue;
        if (el.id && document.querySelector('label[for="' + el.id + '"]')) continue;
        if (el.closest && el.closest('label')) continue;
        var name = '';
        try { name = (el.getAttribute('placeholder') || '').trim(); } catch (e) { }
        if (!name) { try { name = (el.getAttribute('title') || '').trim(); } catch (e) { } }
        if (!name) name = visibleLabel(el);
        if (!name) name = fallbackFor(el);
        if (!name) continue;
        el.setAttribute('aria-label', name.slice(0, 80));
        n++;
      } catch (e) { /* ناقص حقل ⭐ — نكمل الباقي ⭐ */ }
    }
    return n;
  }

  window.OCTAA11y = { sweep: sweep };

  /* ⭐ تشغيل فوري + بعد كل رسم ⭐ */
  try { sweep(); } catch (e) { }
  try {
    var mo = new MutationObserver(function () {
      try { sweep(); } catch (e) { }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) { /* MutationObserver مش متاح ⭐ */ }
})();
