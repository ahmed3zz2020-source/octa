/* ══════════════════════════════════════════════════════════════
   🔗 رابط الشارت الفني — ملف واحد مستقل
   ──────────────────────────────────────────────────────────────
   🎯 الهدف: اربط شارت OCTA الجديد (chart.html) بالموقع من غير ما
      نلمس أي ملف موجود. الملف ده بيعمل 3 حاجات:

      1) openChartNew(code) — تفتح صفحة الشارت على أي سهم
      2) يوجّه openChart() القديمة ( اللي فيها TradingView iframe )
        للشارت الجديد بدل ما تفتح الـiframe — فزرار الشارت
         كده بيفتح الشارت الحقيقي
      3) يضيف زرار «الشارت» في قائمة الموقع (السايدبار)

   📌 التركيب: سطر واحد في index.html قبل </body>
      <script src="assets/js/octa-chart-link.js?v=1"></script>

   ⛔ الملف ده آمن: مافيش تعديل على أي كود موجود، كل حاجة
      additional + guarded. لو السايدبار مش موجود → مفيش error.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PAGE = 'chart.html';

  function url(code) {
    var c = String(code || '').trim().toUpperCase();
    if (!c) return PAGE;
    return PAGE + '?code=' + encodeURIComponent(c);
  }

  function go(code) {
    var u = url(code);
    try { window.location.assign(u); }
    catch (e) { window.location.href = u; }
    return false;              /* يمنع الرجوع التلقائي للمودال */
  }

  /* 1) دالة عامة */
  window.openChartNew = function (code) { return go(code); };

  /* 2) نوجّه openChart القديمة للشارت الجديد.
        ⛔ بنلمسها بس لو موجودة — ولو المودال القديم اتفتح قبل كده. */
  var oldOpenChart = window.openChart;
  window.openChart = function (code) {
    if (window.__octaChartNew) return go(code);
    if (typeof oldOpenChart === 'function') {
      /* لو المستخدم اختار الشارت القديم من إعدادات، نسيبه زي ما هو */
      try {
        if (localStorage.getItem('octa_chart_modal') === '1') {
          return oldOpenChart.apply(this, arguments);
        }
      } catch (e) { }
    }
    return go(code);
  };

  /* 3) زرار الشارت في السايدبار */
  var ITEM_HTML =
    '<button class="sb-i" data-tool="chart" title="شارت شموع كامل">' +
    '<span class="sb-ico">📈</span>' +
    '<span class="sb-t"><b>الشارت</b><i>شموع · مؤشرات · رسم</i></span>' +
    '</button>';

  function inject() {
    var nav = document.querySelector('.sb-nav');
    if (!nav) return false;
    if (nav.querySelector('.sb-i[data-tool="chart"]')) return true;

    var head = document.createElement('div');
    head.className = 'sg-h';
    head.innerHTML = '<span class="sg-i">📈</span>التحليل الفني';

    var holder = document.createElement('div');
    holder.innerHTML = ITEM_HTML;
    var btn = holder.firstChild;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      /* ⛔ مش بن relied على sbGo — ممكن يكون صفحة مش موجودة */
      var c = '';
      try {
        var sel = document.querySelector('.sv-i.on .sv-code, .sv-row.on');
        if (sel && sel.getAttribute) c = sel.getAttribute('data-code') || '';
      } catch (x) { }
      go(c);
    });

    nav.appendChild(head);
    nav.appendChild(btn);
    return true;
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else fn();
  }

  ready(function () {
    /* السايدبار ممكن يتكوّن بعدنا بـملّي ثانية — ن.poll لحد ما يظهر */
    var tries = 0;
    (function tick() {
      if (inject()) return;
      tries++;
      if (tries < 30) setTimeout(tick, 200);   /* 6 ثواني كفاية */
    })();

    /* لو السايدبار ات rebuilding بعدين */
    try {
      if (window.MutationObserver) {
        new MutationObserver(function () { setTimeout(inject, 80); })
          .observe(document.documentElement, { childList: true, subtree: true });
      }
    } catch (e) { }
  });

  /* لو حد فتح المودال القديم عمداً من مكان تاني */
  window.__octaChartUseOld = function (v) {
    try { localStorage.setItem('octa_chart_modal', v ? '1' : '0'); } catch (e) { }
  };
})();