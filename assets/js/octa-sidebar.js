/* ══════════════════════════════════════════════════════════════
   📂 الشريط الجانبي — كل الصفحات في مكان واحد
   ══════════════════════════════════════════════════════════════
   الشريط الأفقي كان 15 زر في صف واحد وبياخد الشاشة كلها
   وبيكسر على الموبايل. الـsidebar بياخد الشاشات الصغيرة.

   ⛔ الموبايل: بيتقفل افتراضي — الشاشة ضيقة
   ✅ التابلت والديسكتوب: مفتوح على طول
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── المجموعات ──
     مرتبة حسب اللي المستثمر بيدور عليه، مش حسب الترتيب القديم */
  const GROUPS = [
    { id:'g1', n:'الأساسيات', i:'📌', tools:['decide','verdict','pick','bestpick'] },
    { id:'g2', n:'الأدوات',   i:'🛠️', tools:['filter','screener','stocks','search','compare'] },
    { id:'g3', n:'البيانات',  i:'📊', tools:['dividends','news','octasearch'] },
    { id:'g4', n:'التعلّم',   i:'🎓', tools:['academy','engine','arms','calc'] },
  ];

  /* ⛌ الافتراضي كان مقفول — أول مرة المستخدم بيفتح الموقع
   مش بيشوف الـsidebar خالص، واللي بيتعلمه إن «مفيش حاجة دي».
   دلوقتي: مفتوح افتراضياً إلا لو المستخدم قفله بنفسه. */
let OPEN = localStorage.getItem('octa_sidebar') !== '0';

  function allTools(){
    const el = document.getElementById('toolbar');
    if (!el) return [];
    return Array.from(el.querySelectorAll('.tool-btn')).map(b => ({
      id: b.dataset.tool,
      i: (b.querySelector('.tb-i') || {}).textContent || '',
      n: (b.querySelector('.tb-n') || {}).textContent || '',
      d: b.getAttribute('title') || ''
    }));
  }

  function build(){
    const host = document.getElementById('sideHost');
    if (!host) return;

    const map = {};
    allTools().forEach(t => { map[t.id] = t; });

    // أي أداة مش في مجموعة — نحطها في «أخرى» عشان ما تضيعش
    const grouped = {};
    let used = new Set();
    GROUPS.forEach(g => {
      g.tools.forEach(id => {
        if (map[id]) { grouped[id] = g.n; used.add(id); }
      });
    });
    const rest = Object.keys(map).filter(id => !used.has(id));
    if (rest.length) {
      GROUPS.push({ id:'gX', n:'أخرى', i:'📦', tools:rest });
      rest.forEach(id => grouped[id] = 'أخرى');
    }

    let html = '';
    GROUPS.forEach(g => {
      const items = g.tools.map(id => map[id]).filter(Boolean);
      if (!items.length) return;
      html += '<div class="sg-h"><span class="sg-i">' + g.i + '</span>' + g.n + '</div>';
      html += items.map(t =>
        '<button class="sb-i" data-tool="' + t.id + '" title="' + t.d + '" ' +
        'onclick="sbGo(\'' + t.id + '\')">' +
          '<span class="sb-ico">' + t.i + '</span>' +
          '<span class="sb-t"><b>' + t.n + '</b><i>' + t.d + '</i></span>' +
        '</button>'
      ).join('');
    });

    host.innerHTML =
      '<div class="sb-head">' +
        '<span class="sb-logo">🐙</span>' +
        '<div class="sb-brand"><b>OCTA</b><i>اخطبوط 5</i></div>' +
        '<button class="sb-x" onclick="sbToggle()">✕</button>' +
      '</div>' +
      '<nav class="sb-nav">' + html + '</nav>' +
      '<div class="sb-foot">' +
        '<button class="sb-acc" onclick="OCTAAuth.show(\'login\')">👤 حسابي</button>' +
      '</div>';

    syncOpen();
    markActive();
  }

  function syncOpen(){
    document.body.classList.toggle('sb-open', OPEN);
  }

  function markActive(){
    const cur = (typeof currentPage !== 'undefined') ? currentPage : '';
    document.querySelectorAll('.sb-i').forEach(b => {
      b.classList.toggle('on', b.dataset.tool === cur);
    });
  }

  window.sbToggle = function () {
    OPEN = !OPEN;
    try { localStorage.setItem('octa_sidebar', OPEN ? '1' : '0'); } catch (e) {}
    syncOpen();
  };

  window.sbGo = function (id) {
    const t = allTools().find(x => x.id === id);
    const isModal = id === 'decide';
    if (isModal && typeof openDecide === 'function') openDecide();
    else if (typeof switchPage === 'function') switchPage(id);
    // على الموبايل نقفل بعد الاختيار
    if (window.innerWidth < 900 && OPEN) {
      OPEN = false;
      try { localStorage.setItem('octa_sidebar', '0'); } catch (e) {}
      syncOpen();
    }
  };

  // زرار فتح في الهيدر
  window.sbOpenBtn = function () {
    OPEN = true;
    try { localStorage.setItem('octa_sidebar', '1'); } catch (e) {}
    syncOpen();
  };

  window.addEventListener('DOMContentLoaded', () => {
    build();
    // كل ما الصفحة تتغير نعلّم-active
    const orig = window.switchPage;
    if (typeof orig === 'function') {
      window.switchPage = function (id) {
        window.currentPage = id;
        const r = orig.apply(this, arguments);
        markActive();
        return r;
      };
    }
  });
})();