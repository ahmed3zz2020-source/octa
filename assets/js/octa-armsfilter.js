/* ═══ OCTA · octa-armsfilter.js · فلتر الأذرع ═══
   ═══════════════════════════════════════════════════════════
   ⚠ القاعدة الذهبية في الملف ده:
   الذراع بيعرض ** نفس الرقم ** اللي دخل في مجموع OCTA.
   مفيش حساب تاني ولا تقريب ولا رواية تانية.

   يعني لو اخترت «الأساسي»، أنت بتقرأ sect.q بالظبط —
   نفس القيمة اللي اتضربت في 22% وجمعت في الدرجة النهائية.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── الأذرع الثمانية ──
     sext = الحقل داخل OS_DB (مجاني 100%)
     src  = مصدر الرقم — بيتعرض للمستخدم
     cov  = التغطية (بيتحسب وقت التشغيل، مش مكتوب يدوي) */
  /* قراءة الدرجة من أي مكان محفوظة فيه — خطأ تطبيع واحد
     يكفي يخلي الفلتر يرجع صفر صف من غير ما يبان */
  function ax(s, k) {
    var sc = s.sect || s.sections;
    if (sc && sc[k] != null) return sc[k];
    return s[k];
  }

  var ARMS8 = [
    { id: 'total', ic: '🐙', n: 'المجموع', d: 'تقييم OCTA الكامل',
      get: function (s) { return s.score; }, src: 'المحركات الخمسة كلها' },
    { id: 'q', ic: '💰', n: 'الأساسي', d: 'جودة الشركة من جوه',
      get: function (s) { return ax(s, 'q'); }, src: 'أرباح وعوائد ونسب' },
    { id: 'v', ic: '🏷️', n: 'التقييم', d: 'السهم غالي ولا رخيص',
      get: function (s) { return ax(s, 'v'); }, src: 'مضاعف الربحية والقيمة الدفترية' },
    { id: 'm', ic: '📈', n: 'الفني', d: 'حركة السعر والزخم',
      get: function (s) { return ax(s, 'm'); }, src: 'مؤشرات فنية من الشارت' },
    { id: 'lq', ic: '💧', n: 'السيولة', d: 'تقدر تبيع بدري ولا لأ',
      get: function (s) { return ax(s, 'lq'); }, src: 'حجم التداول ونسبته' },
    { id: 'sf', ic: '🛡️', n: 'الأمان', d: 'السهم بيتزنق قد إيه',
      get: function (s) { return ax(s, 'sf'); }, src: 'مخاطرة وتذبذب تاريخي' },
    /* ↓ الاتنين دول مش من محرك الخمسة — محسوبين من بيانات تاريخية حقيقية.
       كل واحد فيهم بيقول التغطية بتاعته بوضوح. */
    { id: 'risk', ic: '⚠️', n: 'المخاطرة', d: 'التذبذب وأكبر هبوط',
      get: function (s) { return ARM_RISK[s.code]; }, src: '4996 شمعة لكل سهم · 2000→2026', derived: true },
    { id: 'div', ic: '🎁', n: 'التوزيعات', d: 'بيدفع لك كام',
      get: function (s) { return ARM_DIV[s.code]; }, src: 'نسبة التوزيع من بيانات البورصة', derived: true }
  ];

  /* ── نتيجتين مشتقة ── */
  var ARM_RISK = {}, ARM_DIV = {};

  /* ═══ حساب النسبة المئوية داخل القطاع ═══
     لأن المقارنة العادلة بين الأسهم بتكون جوه نفس القطاع:
     بنك مقابل بنك، مش بنك مقابل سهم صناعي. */
  function pctRank(list, valFn, dir) {
    /* dir = 1  → القيمة الأكبر أفضل
       dir = -1 → القيمة الأصغر أفضل */
    var vals = [];
    list.forEach(function (s) {
      var v = valFn(s);
      if (v != null && isFinite(v)) vals.push({ c: s.code, v: v });
    });
    if (!vals.length) return;
    vals.sort(function (a, b) { return dir > 0 ? a.v - b.v : b.v - a.v; });
    var n = vals.length;
    vals.forEach(function (o, i) {
      /* +0.5 عشان النتيجة متوسطة للمتساويين مش 0 */
      var r = ((i + 0.5) / n) * 100;
      ARM_DIV[o.c] = Math.round(r);
    });
  }

  function buildDerived() {
    ARM_DIV = {};
    var bySector = {};
    OS_DB.forEach(function (s) { (bySector[s.sectorEn || s.sector] = bySector[s.sectorEn || s.sector] || []).push(s); });

    /* ⛌ المخاطرة مش هنا — buildRisk3 هي اللي بتحسبها من 3 مؤشرات.
       كانت بتتكتب هنا وبتتمسح بعدها، والنتيجة كانت شاربي لوحدها. */
    Object.keys(bySector).forEach(function (sec) {
      pctRank(bySector[sec], function (s) { return (s.dy || 0); }, 1);
    });
  }

  /* المخاطرة المحسوبة من 3 مصادر — بنعملها منفصلة عشان ما نلخبطش */
  function buildRisk3() {
    var parts = { vol: {}, mdd: {}, shp: {} };
    var bySector = {};
    OS_DB.forEach(function (s) { (bySector[s.sectorEn || s.sector] = bySector[s.sectorEn || s.sector] || []).push(s); });

    function rank(sec, fn) {
      var vals = [];
      sec.forEach(function (s) {
        var v = fn(s);
        if (v != null && isFinite(v)) vals.push({ c: s.code, v: v });
      });
      if (vals.length < 3) return;
      vals.sort(function (a, b) { return a.v - b.v; });
      var n = vals.length;
      vals.forEach(function (o, i) { vals[i].r = ((i + 0.5) / n) * 100; });
      return vals;
    }

    Object.keys(bySector).forEach(function (name) {
      var L = bySector[name];
      rank(L, function (s) { return s.vol1y; }).forEach(function (o) { parts.vol[o.c] = o.r; });
      rank(L, function (s) { return s.mdd; }).forEach(function (o) { parts.mdd[o.c] = o.r; });
      rank(L, function (s) { return s.sharpe3y; }).forEach(function (o) { parts.shp[o.c] = o.r; });
    });

    ARM_RISK = {};
    Object.keys(parts.vol).forEach(function (c) {
      var a = parts.vol[c], b = parts.mdd[c], d = parts.shp[c];
      if (a == null || b == null || d == null) return;   /* مفيش بيانات كافية = مش بيتحتسب */
      ARM_RISK[c] = Math.round(a * 0.40 + b * 0.35 + d * 0.25);
    });
  }

  /* ═══ الحالة ═══ */
  var AF = { arm: 'total', min: 0, sector: 'all', sel: null, built: false };

  /* ═══ التغطية ═══ */
  function coverage(arm) {
    var rows = OS_DB.filter(function (s) { return s.price > 0; });
    var have = rows.filter(function (s) { return arm.get(s) != null; });
    return { have: have.length, all: rows.length, pct: rows.length ? Math.round(have.length / rows.length * 100) : 0 };
  }

  /* ═══ الصفحة ═══ */
  function renderPage() {
    var host = document.getElementById('armsList');
    if (!host) return;
    /* ⛌ النسب بتبني على OS_DB — لو اتحسبت قبل ما البيانات
       توصل، الـmaps بتفضل فاضية للأبد. فبنبنيها كل مرة؛
       296 صف و12 قطاع — مش تكلفة. */
    buildDerived();
    buildRisk3();

    if (AF.sel) return renderDetail();

    var priced = OS_DB.filter(function (s) { return s.price > 0; }).length;
    var h = '';

    h += '<div class="af-intro">';
    h += '<div class="af-i-q">ازاي OCTA بيحلّل؟</div>';
    h += '<div class="af-i-a">كل سهم بيتقيّم من <b>5 محركات</b>، وكل محرك بيطلع درجة من 100.</div>';
    h += '<div class="af-i-a">الدرجة النهائية = مجموع الدرجات مضروبة في أوزانها، بعد خصم المخاطرة.</div>';
    h += '<div class="af-i-w">' +
      '<span>🛡️ الأمان <b>24%</b></span><span>💰 الأساسي <b>22%</b></span>' +
      '<span>📈 الفني <b>18%</b></span><span>💧 السيولة <b>18%</b></span>' +
      '<span>💼 المحفظة <b>9%</b></span><span>📰 الأخبار <b>5%</b></span>' +
      '<span>🧠 المعنويات <b>4%</b></span></div>';
    h += '<div class="af-i-n">👆 اختار ذراع عشان تشوف الأسهم مرتبة بيها — الدرجة دي <b>نفس الرقم</b> اللي دخل في المجموع، مش حساب تاني.</div>';
    h += '</div>';

    h += '<div class="af-grid">';
    ARMS8.forEach(function (a) {
      var c = coverage(a);
      var strong = Math.round(c.pct * 0.6);
      h += '<button type="button" class="af-card' + (a.derived ? ' der' : '') + '" data-af="' + a.id + '">' +
        '<div class="af-c-ic">' + a.ic + '</div>' +
        '<div class="af-c-main">' +
        '<div class="af-c-n">' + a.n + '</div>' +
        '<div class="af-c-d">' + a.d + '</div>' +
        '<div class="af-c-bar"><i style="width:' + strong + '%"></i></div>' +
        '<div class="af-c-src">' + c.have + ' من ' + c.all + ' سهم · ' + c.pct + '%</div>' +
        '</div><div class="af-c-a">←</div></button>';
    });
    h += '</div>';

    h += '<div class="af-note">💡 الذراعين <b>المخاطرة</b> و<b>التوزيعات</b> بيتحسبوا من تاريخ كل سهم — كل واحد فيهم بيقول التغطية بتاعته بوضوح. اللي مش عنده بيانات مش بيتردب.</div>';

    host.innerHTML = h;
  }

  /* ═══ التفاصيل ═══ */
  function renderDetail() {
    var arm = ARMS8.filter(function (a) { return a.id === AF.arm; })[0] || ARMS8[0];
    var rows = OS_DB.filter(function (s) {
      if (s.price <= 0) return false;
      if (AF.sector !== 'all' && (s.sectorEn || s.sector) !== AF.sector) return false;
      return true;
    });
    var scored = rows.filter(function (s) { return arm.get(s) != null; });
    var skipped = rows.length - scored.length;
    var shown = scored.filter(function (s) { return arm.get(s) >= AF.min; })
      .sort(function (a, b) { return arm.get(b) - arm.get(a); });

    var h = '';
    h += '<div class="af-back"><button type="button" class="af-bb" data-af="back">→ كل الأذرع</button></div>';

    h += '<div class="af-d-h"><span class="af-d-ic">' + arm.ic + '</span>' +
      '<div><div class="af-d-n">' + arm.n + '</div>' +
      '<div class="af-d-s">' + arm.d + ' · ' + arm.src + '</div></div></div>';

    h += '<div class="af-ctl"><label class="af-lb">أقل درجة: <b id="afMinV">' + AF.min + '</b></label>' +
      '<input type="range" id="afMin" min="0" max="100" step="5" value="' + AF.min + '"></div>';

    h += '<div class="af-stats">' +
      '<span class="af-s"><b>' + scored.length + '</b> عندهم بيانات</span>' +
      (skipped ? '<span class="af-s warn"><b>' + skipped + '</b> بدون بيانات</span>' : '') +
      '<span class="af-s ok"><b>' + shown.length + '</b> عدّى الفلتر</span></div>';

    if (!shown.length) {
      h += '<div class="af-empty">مفيش سهم عدّى. جرّب تنزل الدرجة لـ ' + Math.max(0, AF.min - 20) + '.' +
        (AF.sector !== 'all' ? ' شوف كل القطاعات.' : '') + '</div>';
      document.getElementById('armsList').innerHTML = h;
      bind();
      return;
    }

    h += '<div class="af-wrap"><table class="af-t"><thead><tr>' +
      '<th>#</th><th>السهم</th><th>القطاع</th>' +
      '<th>' + arm.n + '</th><th>المجموع</th><th>الفرق</th><th>السعر</th><th>تغير</th>' +
      '</tr></thead><tbody>';
    shown.slice(0, 120).forEach(function (s, i) {
      var av = arm.get(s), tv = s.score || 0, d = Math.round(av - tv);
      h += '<tr data-afcode="' + s.code + '">' +
        '<td class="af-i">' + (i + 1) + '</td>' +
        '<td><b>' + s.code + '</b><span class="af-nm">' + (s.name || '') + '</span></td>' +
        '<td class="af-sc">' + (s.sectorAr || s.sector || '—') + '</td>' +
        '<td><b class="af-v' + (av >= 70 ? ' hi' : av >= 50 ? ' mid' : ' lo') + '">' + Math.round(av) + '</b></td>' +
        '<td class="af-tot">' + Math.round(tv) + '</td>' +
        '<td class="af-d' + (d > 0 ? ' up' : d < 0 ? ' dn' : '') + '">' + (d > 0 ? '+' : '') + d + '</td>' +
        '<td class="af-n">' + (s.price || 0).toFixed(2) + '</td>' +
        '<td class="af-c' + ((s.change || 0) >= 0 ? ' up' : ' dn') + '">' +
        ((s.change || 0) >= 0 ? '▲ ' : '▼ ') + Math.abs(s.change || 0).toFixed(2) + '%</td>' +
        '</tr>';
    });
    h += '</tbody></table>';
    if (shown.length > 120) h += '<div class="af-more">📊 بيعرض أول 120 من ' + shown.length + ' سهم — ضيّق الفلتر عشان تشوف الباقي</div>';
    h += '</div>';
    h += '<div class="af-legend"><b>الفرق</b> = درجة ' + arm.n + ' ناقص درجة المجموع. كل ما الرقم أعلى، السهم ده قوي في الذراع ده بس ضعيف في الباقي.</div>';

    document.getElementById('armsList').innerHTML = h;
    bind();
  }

  /* ═══ الأحداث ═══ */
  function bind() {
    var min = document.getElementById('afMin');
    if (min) min.addEventListener('input', function () {
      AF.min = Number(min.value);
      var v = document.getElementById('afMinV');
      if (v) v.textContent = AF.min;
    });
  }

  document.addEventListener('click', function (e) {
    var card = e.target.closest('[data-af]');
    if (!card) return;
    var v = card.getAttribute('data-af');
    if (v === 'back') { AF.sel = null; renderPage(); return; }
    if (v === 'min') return;
    AF.arm = v; AF.min = 0; AF.sel = v; renderDetail();
  });

  document.addEventListener('input', function (e) {
    if (e.target.id !== 'afMin') return;
    AF.min = Number(e.target.value);
    var v = document.getElementById('afMinV');
    if (v) v.textContent = AF.min;
  });

  document.addEventListener('change', function (e) {
    if (e.target.id !== 'afMin') return;
    renderDetail();
  });

  /* ═══ الواجهة ═══ */
  window.OCTAArmsFilter = {
    render: function () {
      AF.built = false; AF.sel = null; AF.arm = 'total'; AF.min = 0;
      renderPage();
    },
    arms: ARMS8,
    coverage: coverage
  };

  /* شيل الفلتر القديم لو موجود — الأذرع بقت صفحة تحليل مش كروت */
  window.renderArms = function () { window.OCTAArmsFilter.render(); };

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () { if (typeof renderArms === 'function') renderArms(); }, 200);
  });
})();