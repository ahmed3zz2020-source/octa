/* ══════════════════════════════════════════════════════════════════════
   ⚙️ OCTA · octa-settings.js — لوحة الإعدادات الكاملة
   ══════════════════════════════════════════════════════════════════════
   • 5 أقسام بالترتيب: السوق · اللغة · المظهر · الأدوات · المزيد
   • كل تغيير: localStorage + تطبيق فوري بدون reload
   • بيستخدم الكلاسات الموجودة: .te-overlay / .te-panel / .te-h / .te-t …
     وأي كلاس جديد بيبدأ بـ set-
   • ⛔ ممنوع أي توكن أو مفتاح — التصدير بفلتر deny-list
   • 🚫 مفيش حذف لأي حاجة موجودة — الإعدادات القديمة بتتقرأ وبتتزامن
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     1) المخزن — مصدر واحد للإعدادات الجديدة
     ══════════════════════════════════════════════════════════ */
  var KEY = 'octa_settings_v1';

  var DEF = {
    v: 1,
    market: 'egypt',      /* egypt | us          */
    refresh: true,        /* تحديث تلقائي للأسعار */
    refreshSec: 60,       /* 30 | 60 | 300        */
    cur: 'egp',           /* egp | EGP | usd      */
    nums: 'lat',          /* lat | ar — ٠١٢٣      */
    dir: 'rtl',           /* rtl | ltr            */
    labels: 'simple',     /* simple | tech        */
    theme: 'auto',        /* auto | dark | light  */
    accent: 'gold',       /* gold | green | blue | purple */
    size: 100,            /* 90 → 130            */
    density: 'comfy',     /* comfy | snug | tight */
    sticky: true,         /* تثبيت الشريط العلوي  */
    motion: false,        /* تقليل الحركة         */
    tabular: true,        /* أرقام بعرض ثابت      */
    focus: false,         /* وضع التركيز (إخفاء اللوحات التعليمية) */
    track: true,          /* إحصائيات الاستخدام   */
    wset: 'us'            /* مجموعة أوزان مفتوحة  */
  };

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function lsArr(k) { try { var v = JSON.parse(lsGet(k)); return Array.isArray(v) ? v : []; } catch (e) { return []; } }

  function load() {
    var s = {}, raw = null;
    try { raw = JSON.parse(lsGet(KEY) || 'null'); } catch (e) { raw = null; }
    for (var k in DEF) s[k] = DEF[k];
    if (raw && typeof raw === 'object') {
      for (var j in DEF) if (Object.prototype.hasOwnProperty.call(raw, j) && raw[j] != null) s[j] = raw[j];
    }
    /* ⛔ نشترط نوع القيمة — عشان تخزين قديم مش يبوّظ اللوحة */
    if (typeof s.size !== 'number' || s.size < 80 || s.size > 140) s.size = 100;
    if ([30, 60, 300].indexOf(s.refreshSec) < 0) s.refreshSec = 60;
    if (['gold', 'green', 'blue', 'purple'].indexOf(s.accent) < 0) s.accent = 'gold';
    if (['comfy', 'snug', 'tight'].indexOf(s.density) < 0) s.density = 'comfy';
    if (['simple', 'tech'].indexOf(s.labels) < 0) s.labels = 'simple';
    if (['us', 'egx', 'intel', 'usScan'].indexOf(s.wset) < 0) s.wset = 'us';
    return s;
  }

  var S = load();

  function save() { lsSet(KEY, JSON.stringify(S)); }

  /* ══════════════════════════════════════════════════════════
     2) أدوات مساعدة
     ══════════════════════════════════════════════════════════ */
  function esc(x) {
    return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(id) { return document.getElementById(id); }
  function has(o, k) { try { return typeof o !== 'undefined' && o !== null && o[k] != null; } catch (e) { return false; } }

  /* ⛔ الكلام الإنجليزي جوّه سطر عربي لازم يكون معزول — bidi isolate */
  function ltr(s) { return '<span class="flt-ltr">' + esc(s) + '</span>'; }

  /* ══════════════════════════════════════════════════════════
     3) الألوان — كل سمة بتتوافق مع octa-tokens.css
     ══════════════════════════════════════════════════════════ */
  /* gold3 = النسخة الغامقة من لون التمييز — دي اللي بتتكتب بيها
     النصوص الصغيرة في السمة الفاتحة (#6b5410 مش #9a7b18). */
  var ACCENTS = {
    gold:   { n: 'ذهبي',   gold: '#d4af37', gold2: '#f4d03f', gold3: '#6b5410', bg: 'rgba(212,175,55,.12)' },
    green:  { n: 'زمردي',  gold: '#16c79a', gold2: '#5eead4', gold3: '#0b5f58', bg: 'rgba(22,199,154,.12)' },
    blue:   { n: 'أزرق',   gold: '#4dabf7', gold2: '#8fd0ff', gold3: '#1e3a8a', bg: 'rgba(77,171,247,.12)' },
    purple: { n: 'بنفسجي', gold: '#a78bfa', gold2: '#c9b8ff', gold3: '#4c1d95', bg: 'rgba(167,139,250,.12)' }
  };
  var LIGHT_ACCENT = {
    gold:   { gold: '#9a7b18', gold2: '#b8912f', gold3: '#6b5410', bg: 'rgba(154,123,24,.1)' },
    green:  { gold: '#0f766e', gold2: '#0d9488', gold3: '#0b5f58', bg: 'rgba(15,118,110,.1)' },
    blue:   { gold: '#1d4ed8', gold2: '#2563eb', gold3: '#1e3a8a', bg: 'rgba(29,78,216,.1)' },
    purple: { gold: '#6d28d9', gold2: '#7c3aed', gold3: '#4c1d95', bg: 'rgba(109,40,217,.1)' }
  };

  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function isLight() { return document.body && document.body.classList.contains('light'); }

  /* ══════════════════════════════════════════════════════════
     4) المظهر — تطبيق فوري
     ══════════════════════════════════════════════════════════ */
  function applyTheme() {
    var t = S.theme;
    if (t === 'auto') t = (mq && mq.matches) ? 'light' : 'dark';
    var lt = (t === 'light');

    document.body.classList.toggle('light', lt);
    document.documentElement.classList.toggle('light', lt);
    document.documentElement.setAttribute('data-theme', lt ? 'light' : 'dark');

    /* 🔗 تزامن مع المفاتيح القديمة — مفيش حاجة بتتعارض */
    lsSet('octa_light', lt ? '1' : '0');
    lsSet('octa_theme', lt ? 'light' : 'dark');

    /* 🌙 زر السمة في الهيدر — نسخة واحدة بيشتغلوا بيها */
    ['lightBtn', 'themeBtn'].forEach(function (id) {
      var b = el(id);
      if (!b) return;
      b.textContent = lt ? '☀️' : '🌙';
      b.title = lt ? 'الوضع النهاري' : 'الوضع الليلي';
    });

    applyAccent();
  }

  function applyAccent() {
    var a = (isLight() ? LIGHT_ACCENT : ACCENTS)[S.accent] || ACCENTS.gold;
    var r = document.documentElement.style;
    r.setProperty('--gold', a.gold);
    r.setProperty('--gold2', a.gold2);
    r.setProperty('--gold3', a.gold3);   /* النسخة الغامقة — لوحدها هي اللي بتوصل AA في الفاتح */
    r.setProperty('--goldBg', a.bg);
    r.setProperty('--ac', a.gold);
    r.setProperty('--pct', a.gold);
    r.setProperty('--set-accent', a.gold);
    r.setProperty('--set-accent-bg', a.bg);
  }

  function applyLook() {
    var r = document.documentElement.style;
    var b = document.body.classList;

    r.setProperty('--set-fs', (S.size / 100).toFixed(3));
    document.documentElement.style.fontSize = (16 * S.size / 100).toFixed(2) + 'px';

    b.remove('set-snug', 'set-tight', 'set-nomotion', 'set-nofocus', 'set-unstick', 'set-notab');
    b.add('set-' + S.density);
    if (S.motion) b.add('set-nomotion');
    if (!S.sticky) b.add('set-unstick');
    if (!S.tabular) b.add('set-notab');
    if (S.focus) applyFocus();
  }

  function applyDir() {
    var d = (S.dir === 'ltr') ? 'ltr' : 'rtl';
    document.documentElement.setAttribute('dir', d);
    document.documentElement.setAttribute('lang', d === 'rtl' ? 'ar' : 'en');
  }

  /* وضع التركيز — يخفي اللوحات التعليمية بس */
  function applyFocus() {
    var hide = !!S.focus;
    var eb = el('eduBanner');
    if (eb) eb.style.display = hide ? 'none' : '';
    document.querySelectorAll('.edu-toggle').forEach(function (n) { n.style.display = hide ? 'none' : ''; });
  }

  /* ══════════════════════════════════════════════════════════
     5) الأرقام العربية — ٠١٢٣ — اختيارية (الافتراضي لاتيني زي ما كان)
     ══════════════════════════════════════════════════════════ */
  var LAT = '0123456789', ARAB = '٠١٢٣٤٥٦٧٨٩';
  var L2A = {}, A2L = {};
  (function () { for (var i = 0; i < 10; i++) { L2A[LAT[i]] = ARAB[i]; A2L[ARAB[i]] = LAT[i]; } })();

  var orig = new WeakMap();     /* TextNode → النص الأصلي */
  var convCount = 0;            /* كام عقدة اتحوّلت — عشان منمشيش على الشجرة كلها بلا داعي */
  var convTimer = null;

  function swap(t, tbl) {
    var o = '';
    for (var i = 0; i < t.length; i++) o += (tbl[t.charAt(i)] !== undefined) ? tbl[t.charAt(i)] : t.charAt(i);
    return o;
  }

  function convNode(n) {
    if (!n || n.nodeType !== 3 || !n.nodeValue) return;
    if (S.nums === 'ar') {
      if (orig.has(n)) return;
      var t = n.nodeValue;
      if (!/[0-9٠-٩]/.test(t)) return;
      orig.set(n, t); convCount++;
      n.nodeValue = swap(t, L2A);
    } else {
      if (!orig.has(n)) return;
      n.nodeValue = orig.get(n);
      orig.delete(n); convCount--;
    }
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CANVAS: 1, SVG: 1, CODE: 1, KBD: 1, SAMP: 1, VAR: 1 };

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { convNode(root); return; }
    if (root.nodeType !== 1) return;
    if (SKIP[root.nodeName]) return;
    if (root.closest && root.closest('[data-set-nodigits]')) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) convNode(n);
  }

  function applyNums() {
    if (S.nums === 'lat' && convCount === 0) return;   /* مفيش حاجة اتحوّلت — متحمشش الصفحة */
    walk(document.body);
  }

  /* نراقب أي نص جديد — عشان اللوحة كلها تتحوّل زي باقي الموقع */
  function watchNums() {
    if (typeof MutationObserver === 'undefined') return;
    var mo = new MutationObserver(function (muts) {
      if (S.nums !== 'ar') return;
      clearTimeout(convTimer);
      convTimer = setTimeout(function () {
        muts.forEach(function (m) {
          if (m.type === 'characterData') convNode(m.target);
          else for (var i = 0; i < m.addedNodes.length; i++) walk(m.addedNodes[i]);
        });
      }, 350);
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /* ══════════════════════════════════════════════════════════
     6) تسميات القراءة — CFG.labels (الملف موجود، بنعدّل قيمه)
     ══════════════════════════════════════════════════════════ */
  var LABELS_TECH = { buy: 'تراكم / شراء', hold: 'حياد', sell: 'توزيع / تجنّب' };

  function applyLabels() {
    if (typeof CFG === 'undefined' || !CFG.labels) return;
    if (S.labels === 'tech') {
      CFG.labels.buy = LABELS_TECH.buy;
      CFG.labels.hold = LABELS_TECH.hold;
      CFG.labels.sell = LABELS_TECH.sell;
    } else {
      CFG.labels.buy = 'إشارة إيجابية';
      CFG.labels.hold = 'إشارة محايدة';
      CFG.labels.sell = 'إشارة سلبية';
    }
  }

  /* ══════════════════════════════════════════════════════════
     7) الأوزان والعتبات — CFG.weights / CFG.th
     ══════════════════════════════════════════════════════════ */
  var W_KEY = 'octa_weights_v1';
  var W_DEF = {
    us: { technical: 15, fundamental: 20, valuation: 15, liquidity: 10, news: 10, sentiment: 10, risk: 10, portfolio: 10 },
    egx: { technical: 18, fundamental: 22, valuation: 0, liquidity: 18, news: 5, sentiment: 4, risk: 24, portfolio: 9 },
    intel: { technical: 20, fundamental: 25, liquidity: 10, news: 7, sentiment: 5, risk: 20, portfolio: 13 },
    usScan: { technical: 15, fundamental: 20, valuation: 15, liquidity: 10, sentiment: 10, risk: 10 }
  };
  var W_NAME = {
    technical: 'الفني', fundamental: 'الأساسي', valuation: 'التقييم',
    liquidity: 'السيولة', news: 'الأخبار', sentiment: 'المزاج',
    risk: 'المخاطر', portfolio: 'المحفظة'
  };
  var TH_NAME = { buy: 'عتبة الإشارة الإيجابية', hold: 'عتبة المحايد', safe: 'عتبة الأمان', mid: 'عتبة المتوسط', market: 'عتبة السوق الهابط' };

  function wLoad() {
    var w = JSON.parse(JSON.stringify(W_DEF)), raw = null;
    try { raw = JSON.parse(lsGet(W_KEY) || 'null'); } catch (e) { raw = null; }
    if (raw && typeof raw === 'object') {
      for (var g in W_DEF) {
        if (!raw[g] || typeof raw[g] !== 'object') continue;
        for (var k in W_DEF[g]) {
          var v = Number(raw[g][k]);
          if (!isNaN(v) && v >= 0 && v <= 100) w[g][k] = v;
        }
      }
    }
    return w;
  }
  function wSave(w) { lsSet(W_KEY, JSON.stringify(w)); }

  function applyWeights() {
    if (typeof CFG === 'undefined' || !CFG.weights) return;
    var w = wLoad();
    for (var g in CFG.weights) if (w[g]) for (var k in w[g]) if (CFG.weights[g][k] != null) CFG.weights[g][k] = w[g][k];
  }

  /* ══════════════════════════════════════════════════════════
     8) الأدوات — الشريط والـsidebar
     ══════════════════════════════════════════════════════════ */
  var EXTRA_KEY = 'octa_toolbar_extra_v1';   /* أدوات الـsidebar اللي اتشالت للشريط */
  var BASE_IDS = null;                        /* الـ8 الأصلية — نictionalize مرة واحدة */

  if (typeof TOOLS !== 'undefined' && Array.isArray(TOOLS)) {
    BASE_IDS = TOOLS.map(function (t) { return t.id; });   /* الـ8 الأصلية — مش هنمسحها أبداً */
  }
  function tools() {
    if (typeof TOOLS === 'undefined' || !Array.isArray(TOOLS)) return [];
    if (!BASE_IDS) BASE_IDS = TOOLS.map(function (t) { return t.id; });
    return TOOLS;
  }
  function allTools() {
    if (typeof ALL_TOOLS !== 'undefined' && ALL_TOOLS && ALL_TOOLS.length) return ALL_TOOLS;
    return tools();
  }
  function inBar(id) {
    return tools().some(function (t) { return t.id === id; });
  }

  /* ⛔ ما بنمسحش حاجة — بنضيف ونتشيل من مصفوفة TOOLS بس */
  function applyBar() {
    var list = tools();
    if (!list.length) return;
    var want = lsArr(EXTRA_KEY);
    var all = allTools();

    /* شيل أي حاجة مش مطلوبة — الـ8 الأصلية مش هنمسحها أبداً */
    for (var i = list.length - 1; i >= 0; i--) {
      var id = list[i].id;
      if (BASE_IDS && BASE_IDS.indexOf(id) >= 0) continue;
      if (want.indexOf(id) < 0) list.splice(i, 1);
    }
    /* ضيف المطلوب */
    want.forEach(function (id) {
      if (inBar(id)) return;
      var t = all.find(function (x) { return x.id === id; });
      if (t) list.push({ id: t.id, i: t.i, n: t.n, d: t.d, modal: t.modal });
    });
    if (typeof buildToolbar === 'function') buildToolbar();
  }

  function setBar(id, on) {
    var want = lsArr(EXTRA_KEY).filter(function (x) { return x !== id; });
    if (on) want.push(id);
    lsSet(EXTRA_KEY, JSON.stringify(want));
    applyBar();
  }

  function order() {
    if (typeof toolOrder === 'function') return toolOrder();
    return tools().map(function (t) { return t.id; });
  }
  function hidden() {
    if (typeof toolHidden === 'function') return toolHidden();
    return [];
  }
  function saveOrder(ids) {
    if (typeof toolSave === 'function' && typeof TOOL_KEY !== 'undefined') toolSave(TOOL_KEY, ids);
    else lsSet('octa_tool_order_v1', JSON.stringify(ids));
    if (typeof buildToolbar === 'function') buildToolbar();
  }
  function move(id, dir) {
    var o = order(), i = o.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= o.length) return;
    var tmp = o[i]; o[i] = o[j]; o[j] = tmp;
    saveOrder(o);
  }
  function toggleVis(id) {
    if (typeof toolToggle === 'function') { toolToggle(id); return; }
    var h = hidden(), k = h.indexOf(id);
    if (k >= 0) h.splice(k, 1); else h.push(id);
    lsSet('octa_tool_hidden_v1', JSON.stringify(h));
    if (typeof buildToolbar === 'function') buildToolbar();
  }
  function resetBar() {
    lsDel('octa_tool_order_v1'); lsDel('octa_tool_hidden_v1'); lsDel(EXTRA_KEY);
    if (typeof toolReset === 'function') toolReset();
    applyBar();
  }

  function sidebarOpen() { return (lsGet('octa_sidebar') === '1'); }
  function setSidebar(on) {
    lsSet('octa_sidebar', on ? '1' : '0');
    document.body.classList.toggle('sb-open', on);
  }

  /* ══════════════════════════════════════════════════════════
     9) السوق — التحديث التلقائي
     ══════════════════════════════════════════════════════════ */
  var refTimer = null;

  function marketsOpen() {
    var p = el('page-markets');
    return !!(p && p.classList.contains('active'));
  }
  function tick() {
    if (!marketsOpen()) return;                 /* ما نصرفش نت خالص */
    if (typeof window.mkLoad === 'function') { try { window.mkLoad(); } catch (e) { } }
  }
  function applyRefresh() {
    if (refTimer) { clearInterval(refTimer); refTimer = null; }
    if (!S.refresh) return;
    refTimer = setInterval(tick, S.refreshSec * 1000);
  }
  /* force = المستخدم داس دلوقتي — وقتها نطبّق أي قيمة حتى لو رجع مصري
  /* force = المستخدم داس دلوقتي — وقتها نطبّق أي قيمة حتى لو رجع مصري.
     من غير force (أول تحميل) بنسلّم قيمة 'us' بس، عشان ما نمسحش
     فلتر صفحة الأسواق لأي زائر جديد. */
  function applyMarket(force) {
    if (typeof window.mkSetMK !== 'function') return;
    if (!force && S.market === 'egypt') return;
    setTimeout(function () {
      try { window.mkSetMK(force ? S.market : 'us'); } catch (e) { }
    }, 400);
  }

  /* ══════════════════════════════════════════════════════════
     10) التصدير والاستيراد — ⛔ بلا أسرار
     ══════════════════════════════════════════════════════════ */
  var EXPORT_OK = [
    'octa_settings_v1', 'octa_weights_v1', 'octa_tool_order_v1', 'octa_tool_hidden_v1',
    EXTRA_KEY, 'octa_light', 'octa_theme', 'octa_sidebar', 'octa_watch_v1',
    'octa_ipo_manual_v1', 'octa_no_track', 'octa_pick_v1'
  ];
  var DENY = /token|secret|passw|apikey|api_key|auth|credit|card|session|key/i;

  function safeKey(k) { return EXPORT_OK.indexOf(k) >= 0 && !DENY.test(k); }

  function exportData() {
    var out = { app: 'OCTA', v: 1, at: new Date().toISOString(), data: {} };
    EXPORT_OK.forEach(function (k) {
      if (!safeKey(k)) return;
      var v = lsGet(k);
      if (v != null) out.data[k] = v;
    });
    return out;
  }

  function download() {
    var blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'octa-settings-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  function importFile(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var j = null;
      try { j = JSON.parse(fr.result); } catch (e) { j = null; }
      if (!j || !j.data || typeof j.data !== 'object') { toast('الملف مش صالح ❌'); return; }
      var n = 0;
      Object.keys(j.data).forEach(function (k) {
        if (!safeKey(k)) return;            /* ⛔ أي مفتاح مش مسموح يتجاهل */
        lsSet(k, String(j.data[k])); n++;
      });
      S = load();
      applyAll();
      if (ov) render();
      toast('اترجّع ' + n + ' إعداد ✅');
    };
    fr.readAsText(file);
  }

  /* ══════════════════════════════════════════════════════════
     11) التخزين + المسح الآمن
     ══════════════════════════════════════════════════════════ */
  var KEEP = ['octa_token', 'octa_user', 'octa_watch_v1', 'octa_ipo_manual_v1', 'octa_build_v1'];

  function storageSize() {
    var total = 0, count = 0, rows = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i), v = localStorage.getItem(k) || '';
        var b = (k.length + v.length) * 2;
        total += b; count++;
        rows.push({ k: k, b: b, keep: KEEP.indexOf(k) >= 0 });
      }
    } catch (e) { }
    rows.sort(function (a, b) { return b.b - a.b; });
    return { total: total, count: count, rows: rows };
  }

  function clearSoft() {
    Object.keys(localStorage).forEach(function (k) {
      if (KEEP.indexOf(k) >= 0) return;
      if (DENY.test(k)) return;                 /* ⛔ ما نمسحش الدخول */
      lsDel(k);
    });
    S = load(); applyAll();
    toast('اتمسح كل حاجة إلا بيانات الدخول ✅');
  }
  function resetAll() {
    if (!confirm('ترجّع كل الإعدادات الافتراضية؟\nبيانات الدخول والمتابعة هتفضل زي ما هي.')) return;
    lsDel(KEY); lsDel(W_KEY); lsDel(EXTRA_KEY);
    S = load(); applyAll();
    toast('رجعنا للافتراضي ✅');
  }

  /* ══════════════════════════════════════════════════════════
     12) Toast
     ══════════════════════════════════════════════════════════ */
  function toast(msg) {
    var t = el('setToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('on'); }, 2400);
  }

  /* ══════════════════════════════════════════════════════════
     13) رسم الأقسام
     ══════════════════════════════════════════════════════════ */
  var SECS = [
    { id: 'market', ic: '📈', t: 'السوق' },
    { id: 'lang', ic: '🌐', t: 'اللغة' },
    { id: 'look', ic: '🎨', t: 'المظهر' },
    { id: 'tools', ic: '🧰', t: 'الأدوات' },
    { id: 'more', ic: '🛡️', t: 'المزيد' }
  ];
  var CUR_NAME = { egp: 'ج.م', EGP: 'EGP', usd: '$' };
  var CUR_RATE = { egp: 1, EGP: 1, usd: 48.5 };

  var sec = 'market';

  function seg(name, opts, val) {
    return '<div class="set-seg" data-seg="' + name + '" role="radiogroup">' +
      opts.map(function (o) {
        return '<button type="button" role="radio" aria-checked="' + (o[0] === val) + '"' +
          ' class="set-seg-b' + (o[0] === val ? ' on' : '') + '" data-set="' + name + '" data-val="' + esc(o[0]) + '">' +
          o[1] + '</button>';
      }).join('') + '</div>';
  }

  function row(o) {
    return '<div class="set-row' + (o.warn ? ' warn' : '') + '">' +
      '<div class="set-r-t"><b>' + o.t + '</b>' + (o.s ? '<span>' + o.s + '</span>' : '') + '</div>' +
      '<div class="set-r-c">' + o.c + '</div>' +
      '</div>';
  }

  function sw(on, act) {
    /* «ON / OFF» جوه المفتاح — بدون الكلام ده
       الوضع مش واضح بالعين. */
    return '<button type="button" class="set-sw' + (on ? ' on' : '') + '" data-set="' + act + '" data-val="1"' +
      ' role="switch" aria-checked="' + (on ? 'true' : 'false') + '"' +
      ' aria-label="' + (on ? 'مفعّل' : 'مقفول') + '">' +
      '<i></i><em><b class="sw-off">OFF</b><b class="sw-on">ON</b></em></button>';
  }

  /* ── ① السوق ── */
  function secMarket() {
    var h = '';
    h += row({
      t: 'السوق الافتراضي', s: 'الأسهم والبيانات اللي بتظهر افتراضياً',
      c: seg('market', [['egypt', '🇪🇬 المصري'], ['us', '🇺🇸 الأمريكي']], S.market)
    });
    if (S.market === 'us') {
      h += '<div class="set-note warn">⚠️ السوق الأمريكي بيغيّر نتائج «أفضل فرصة» و«المرشحين» — المشروع مصري أساساً.</div>';
    }
    h += row({
      t: 'تحديث تلقائي للأسعار', s: 'يعمل بس وأنت داخل صفحة الأسواق',
      c: sw(S.refresh, 'refresh')
    });
    if (S.refresh) {
      h += row({
        t: 'كل قد إيه؟', s: 'كل ما الصفحة مفتوحة بس هيتحدّث',
        c: seg('refreshSec', [['30', '30 ثانية'], ['60', 'دقيقة'], ['300', '5 دقايق']], String(S.refreshSec))
      });
    }
    /* ⛌ «عملة العرض» اتشالت — البورصة المصرية بالجنيه المصري
       دايماً، والاختيار كان بيلخبط (ج.م / EGP / $ لنفس الرقم). */
    h += '<div class="set-foot">كل التغييرات بتتحفظ على جهازك فوراً — مفيش إعادة تحميل.</div>';
    return h;
  }

  /* ── ② اللغة ── */
  function secLang() {
    var h = '';
    h += row({
      t: 'لغة الأرقام', s: 'الافتراضي: 0123 — مش بيغيّر أي حاجة',
      c: seg('nums', [['lat', '0123'], ['ar', '٠١٢٣']], S.nums)
    });
    h += row({
      t: 'اتجاه العرض', s: 'عربي من اليمين / إنجليزي من الشمال',
      c: seg('dir', [['rtl', 'عربي'], ['ltr', 'إنجليزي']], S.dir)
    });
    if (S.dir === 'ltr') {
      h += '<div class="set-note warn">⚠️ الإنجليزي دلوقتي اتجاه بس — نصوص الموقع عربي لسه. الاتجاه بيتظبط للصفحات، والباقي جاية مع الترجمة.</div>';
    }
    h += row({
      t: 'تسميات القراءة', s: 'كلمات الإشارة بدل «شراء/بيع»',
      c: seg('labels', [['simple', 'مبسّطة'], ['tech', 'تقنية']], S.labels)
    });
    h += row({
      t: 'قراءة التوقيت', s: 'الوقت بيتحسب بتوقيت جهازك دلوقتي',
      c: '<span class="set-val">' + ltr(new Date().toLocaleTimeString(S.nums === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })) + '</span>'
    });
    h += '<div class="set-note">💡 لو حبّيت كل النصوص إنجليزي، قولّي — ده شغل ترجمة مش إعداد، وبتاخد يوم كامل.</div>';
    return h;
  }

  /* ── ③ المظهر ── */
  function secLook() {
    var h = '';
    h += row({
      t: 'السمة', s: '«تلقائي» يتبع إعداد جهازك أول مرة',
      c: seg('theme', [['auto', 'تلقائي'], ['dark', '🌙 ليلي'], ['light', '☀️ نهاري']], S.theme)
    });
    h += row({
      t: 'لون التمييز', s: 'ألوان الأزرار والعناوين',
      c: '<div class="set-dots">' + Object.keys(ACCENTS).map(function (k) {
        var a = ACCENTS[k];
        return '<button type="button" class="set-dot' + (S.accent === k ? ' on' : '') + '" data-set="accent" data-val="' + k + '"' +
          ' title="' + a.n + '" aria-label="' + a.n + '" style="--d:' + a.gold + '"></button>';
      }).join('') + '</div>'
    });
    h += row({
      t: 'حجم الخط', s: 'بيأثر على الموقع كله',
      c: '<div class="set-rng"><span class="set-val">' + ltr('100%') + '</span>' +
        '<input type="range" min="90" max="130" step="5" value="' + S.size + '" data-set="size" data-val="" aria-label="حجم الخط">' +
        '<button type="button" class="set-mini" data-set="size" data-val="100">إعادة</button></div>'
    });
    h += row({
      t: 'الكثافة', s: 'المسافات بين العناصر',
      c: seg('density', [['comfy', 'مريحة'], ['snug', 'متوسطة'], ['tight', 'مضغوطة']], S.density)
    });
    h += row({ t: 'تثبيت الشريط العلوي', s: 'يفضل فوق طول الصفحة', c: sw(S.sticky, 'sticky') });
    h += row({ t: 'أرقام بعرض ثابت', s: 'الأرقام كلها بعرض واحد عشان الأعمدة تتحاذى', c: sw(S.tabular, 'tabular') });
    h += row({ t: 'تقليل الحركة', s: 'يشيل كل الأنيميشن — ده أريح للعين', c: sw(S.motion, 'motion') });
    return h;
  }

  /* ── ④ الأدوات ── */
  function secTools() {
    var ord = order(), hid = hidden(), all = allTools();
    var inbar = all.filter(function (t) { return inBar(t.id); });
    var rest = all.filter(function (t) { return !inBar(t.id); });

    var h = '';

    h += '<div class="set-h2">🧰 شريط الأدوات</div>';
    h += '<div class="set-note">اختار أي أداة من القائمة الجانبية وحطّها هنا. الترتيب بيتحفظ على جهازك.</div>';

    h += '<div class="set-list">';
    inbar.forEach(function (t) {
      var off = hid.indexOf(t.id) >= 0, i = ord.indexOf(t.id);
      h += '<div class="set-trow' + (off ? ' off' : '') + '">' +
        '<span class="set-tico">' + t.i + '</span>' +
        '<span class="set-tnm"><b>' + esc(t.n) + '</b><i>' + esc(t.d) + '</i></span>' +
        '<span class="set-tmv">' +
        '<button type="button" data-set="move" data-val="' + esc(t.id) + '|1" ' + (i >= ord.length - 1 ? 'disabled' : '') + ' aria-label="لأعلى">▲</button>' +
        '<button type="button" data-set="move" data-val="' + esc(t.id) + '|-1" ' + (i <= 0 ? 'disabled' : '') + ' aria-label="لتحت">▼</button>' +
        '</span>' +
        '<button type="button" class="set-tvis' + (off ? '' : ' on') + '" data-set="vis" data-val="' + esc(t.id) + '"' +
        ' title="' + (off ? 'اظهرها' : 'اخفيها') + '" aria-label="' + (off ? 'اظهرها' : 'اخفيها') + '">' + (off ? '🚫' : '👁️') + '</button>' +
        '<button type="button" class="set-remove" data-set="unbar" data-val="' + esc(t.id) + '" title="شيلها من الشريط" aria-label="شيلها من الشريط">✕</button>' +
        '</div>';
    });
    if (!inbar.length) h += '<div class="set-empty">الشريط فاضي — ضيف أداة من تحت 👇</div>';
    h += '</div>';

    if (rest.length) {
      h += '<div class="set-h2">📦 متاح من القائمة الجانبية</div><div class="set-chips">';
      rest.forEach(function (t) {
        h += '<button type="button" class="set-chip" data-set="bar" data-val="' + esc(t.id) + '">' + t.i + ' ' + esc(t.n) + '</button>';
      });
      h += '</div>';
    }

    h += '<div class="set-btns"><button type="button" data-set="resetBar" class="set-ghost">↩️ رجّع الشريط للافتراضي</button></div>';

    h += '<div class="set-h2">📂 القائمة الجانبية</div>';
    h += row({ t: 'افتحها بالأساس', s: 'أول مرة المستخدم بيدخل', c: sw(sidebarOpen(), 'sidebar') });

    /* ── أوزان المحرك والعتبات ── */
    var w = wLoad();
    if (typeof CFG !== 'undefined' && CFG && CFG.weights && CFG.weights[S.wset]) {
      var cur = CFG.weights[S.wset], tot = 0, keys = Object.keys(cur);
      keys.forEach(function (k) { tot += (w[S.wset][k] != null ? w[S.wset][k] : Number(cur[k]) || 0); });

      h += '<div class="set-h2">⚖️ أوزان المحرك</div>';
      h += row({
        t: 'أي مجموعة؟', s: 'بتتحكم في ترجيح المحاور',
        c: seg('wset', [['us', 'المستخدم'], ['egx', 'محرك EGX'], ['intel', 'التحليل'], ['usScan', 'فحص أمريكي']], S.wset)
      });
      h += '<div class="set-weights">';
      keys.forEach(function (k) {
        var v = w[S.wset][k] != null ? w[S.wset][k] : (Number(cur[k]) || 0);
        h += '<label class="set-w">' +
          '<span class="set-wn">' + esc(W_NAME[k] || k) + '</span>' +
          '<input type="range" min="0" max="40" step="1" value="' + v + '" data-set="w" data-val="' + k + '">' +
          '<b class="set-wv">' + ltr(v + '%') + '</b>' +
          '</label>';
      });
      h += '</div>';
      h += '<div class="set-sum' + (Math.round(tot) === 100 ? ' ok' : ' bad') + '">' +
        'المجموع ' + ltr(tot + '%') + ' — ' +
        (Math.round(tot) === 100 ? '✅ تمام' : 'مش لازم 100 بالظبط، بس كل ما زاد عن 100 قلّل منه') + '</div>';
      h += '<div class="set-btns"><button type="button" data-set="wnorm" class="set-ghost">⚖️ وزّع بالتساوي</button>' +
        '<button type="button" data-set="wreset" class="set-ghost">↩️ أوزان OCTA الأصلية</button></div>';

      if (typeof CFG.th === 'object' && CFG.th) {
        h += '<div class="set-h2">🚦 عتبات الإشارة</div><div class="set-weights">';
        ['buy', 'hold', 'safe', 'mid', 'market'].forEach(function (k) {
          if (CFG.th[k] == null) return;
          h += '<label class="set-w">' +
            '<span class="set-wn">' + esc(TH_NAME[k] || k) + '</span>' +
            '<input type="range" min="0" max="100" step="1" value="' + CFG.th[k] + '" data-set="th" data-val="' + k + '">' +
            '<b class="set-wv">' + ltr(CFG.th[k]) + '</b></label>';
        });
        h += '</div>';
        h += '<div class="set-btns"><button type="button" data-set="threset" class="set-ghost">↩️ العتبات الأصلية (65 / 50 / 45 / 40)</button></div>';
      }
    }
    return h;
  }

  /* ── ⑤ المزيد ── */
  /* ── كتلة الحساب ── */
  function acctBlock() {
    var u = (window.OCTAAuth && OCTAAuth.user) ? OCTAAuth.user() : null;
    var h = '';
    if (u) {
      h += '<div class="set-note">مسجّل دخولك باسم <b>' +
        esc(u.name || 'مستخدم') + '</b> — محفظتك ومنبهاتك محفوظة بيه.</div>';
      h += '<div class="set-btns">' +
        '<button type="button" data-set="chgCode" class="set-ghost">🔑 تغيير كود الدخول</button>' +
        '<button type="button" data-set="logout" class="set-danger">🚪 تسجيل الخروج</button>' +
        '</div>';
    } else {
      h += '<div class="set-note">مش مسجّل دخول — محفظتك بتتحفظ على الجهاز لحد ما تسجّل.</div>';
      h += '<div class="set-btns">' +
        '<button type="button" data-set="login" class="set-ghost">💼 تسجيل الدخول</button>' +
        '</div>';
    }
    return h;
  }

  function secMore() {
    var st = storageSize();
    var h = '';

    h += row({
      t: 'إحصائيات الاستخدام', s: 'نعرف الصفحات الأكثر استخداماً — من غير اسم ولا إيميل',
      c: sw(S.track, 'track')
    });

    h += row({
      t: 'وضع التركيز', s: 'يخفي اللوحات التعليمية — بعد ما تتعوّد',
      c: sw(S.focus, 'focus')
    });

    h += '<div class="set-h2">💾 نسختك</div>';
    h += '<div class="set-note">الملف ده فيه إعداداتك بس — مفيش أي كلمة مرور أو توكن.</div>';
    h += '<div class="set-btns">' +
      '<button type="button" data-set="export" class="set-ghost">⬇️ نزّل نسخة</button>' +
      '<button type="button" data-set="import" class="set-ghost">⬆️ ارفع نسخة</button>' +
      '<input type="file" id="setFile" accept="application/json,.json" hidden>' +
      '</div>';

    h += '<div class="set-h2">📦 مساحة التخزين</div>';
    h += '<div class="set-meter"><i style="width:' + Math.min(100, Math.round(st.total / 5120 * 100)) + '%"></i></div>';
    h += '<div class="set-note">' +
      ltr(st.count === 0 ? 'مفيش' : st.count === 1 ? 'عنصر واحد' : st.count === 2 ? 'عنصرين' : st.count <= 10 ? st.count + ' عناصر' : st.count + ' عنصر') +
      ' · ' + ltr((st.total / 1024).toFixed(1) + ' كيلوبايت') +
      ' من ' + ltr('5 ميجابايت') + '</div>';
    h += '<div class="set-keys">' + st.rows.slice(0, 6).map(function (r) {
      return '<span class="set-key">' + esc(r.k) + ' <i>' + ltr((r.b / 1024).toFixed(1) + 'KB') + '</i></span>';
    }).join('') + '</div>';

    h += '<div class="set-h2">👤 الحساب</div>';
    h += acctBlock();

    h += '<div class="set-h2">♻️ تنظيف</div>';
    h += '<div class="set-btns"><button type="button" data-set="clearSoft" class="set-ghost">🧹 مسح الإعدادات والكاش (مش الدخول)</button></div>';

    h += '<div class="set-h2 danger">⚠️ منطقة الخطر</div>';
    h += '<div class="set-btns"><button type="button" data-set="resetAll" class="set-danger">رجّع كل الإعدادات للافتراضي</button></div>';

    h += '<div class="set-about">' +
      '🐙 <b>OCTA</b> — منصة البورصة المصرية<br>' +
      'القراءة مش توصية. مفيش ولا أمر شراء ولا بيع.' +
      '</div>';
    return h;
  }

  function body() {
    return sec === 'market' ? secMarket()
      : sec === 'lang' ? secLang()
        : sec === 'look' ? secLook()
          : sec === 'tools' ? secTools()
            : secMore();
  }

  /* ══════════════════════════════════════════════════════════
     14) اللوحة نفسها
     ══════════════════════════════════════════════════════════ */
  var ov = null, lastFocus = null;

  /* ⛌ قبل الـ10-10-2025: أي render() كان بيرجّع شريط التمرير لفوق،
     فلو المستخدم ضغط «أوزان OCTA الأصلية» جوّه نص القسم الطويل
     كان بيختفي منه فوراً. دلوقتي بنحفظ المكان ونرجّعه. */
  var keepScroll = 0;
  function render() {
    if (!ov) return;
    var oldBody = document.getElementById('setBody');
    if (oldBody) keepScroll = oldBody.scrollTop;
    ov.innerHTML =
      '<div class="te-panel set-panel" role="dialog" aria-modal="true" aria-label="إعدادات OCTA">' +
        '<div class="te-h"><div>' +
          '<div class="te-t">⚙️ إعدادات المنصة</div>' +
          '<div class="te-s">كل حاجة بتتحفظ على جهازك — مفيش حساب ولا تسجيل.</div>' +
        '</div><button type="button" class="te-eye set-x" data-set="close" aria-label="اقفل">✕</button></div>' +

        '<div class="set-tabs" role="tablist">' +
          SECS.map(function (s) {
            return '<button type="button" role="tab" aria-selected="' + (s.id === sec) + '"' +
              ' class="set-tab' + (s.id === sec ? ' on' : '') + '" data-set="tab" data-val="' + s.id + '">' +
              '<span>' + s.ic + '</span>' + s.t + '</button>';
          }).join('') +
        '</div>' +

        '<div class="set-body" id="setBody" role="tabpanel">' + body() + '</div>' +

        '<div class="te-actions">' +
          '<button type="button" class="done" onclick="OCTASettings.close()">تم ✅</button>' +
        '</div>' +
      '</div>';
    var cfg = el('toolCfg');
    if (cfg) cfg.textContent = '✕';

    var nb = document.getElementById('setBody');
    if (nb) nb.scrollTop = keepScroll;
  }

  function open(id) {
    if (typeof id === 'string' && SECS.some(function (s) { return s.id === id; })) sec = id;
    if (ov) { render(); return; }
    lastFocus = document.activeElement;

    ov = document.createElement('div');
    ov.className = 'te-overlay set-overlay';
    ov.id = 'setOverlay';
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.body.appendChild(ov);

    render();
    document.body.classList.add('set-locked');
    setTimeout(function () { var f = ov.querySelector('.set-tab.on'); if (f) f.focus(); }, 40);
  }

  function close() {
    if (!ov) return;
    ov.remove(); ov = null;
    document.body.classList.remove('set-locked');
    var cfg = el('toolCfg');
    if (cfg) cfg.textContent = '⚙️';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { } }
  }
  function isOpen() { return !!ov; }
  function toggle() { ov ? close() : open(); }

  function trap(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab' || !ov) return;
    var f = ov.querySelectorAll('button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var a = f[0], b = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
    else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
  }

  /* ══════════════════════════════════════════════════════════
     15) الأحداث — كله بـ delegation
     ══════════════════════════════════════════════════════════ */
  function softRender() { render(); }

  function onSet(name, val) {
    switch (name) {
      /* تبويبات */
      case 'tab': sec = val; keepScroll = 0; render(); return;
      case 'close': close(); return;

      /* السوق */
      case 'market':
        S.market = val; save(); applyMarket(true); render(); return;
      case 'refresh':
        S.refresh = !S.refresh; save(); applyRefresh(); render(); return;
      case 'refreshSec':
        S.refreshSec = parseInt(val, 10) || 60; save(); applyRefresh(); render(); return;
      case 'cur':
        S.cur = val; save(); render(); return;

      /* اللغة */
      case 'nums':
        S.nums = val; save();
        if (val === 'ar') { toast('جاري تحويل الأرقام…'); setTimeout(applyNums, 30); }
        else applyNums();
        render(); return;
      case 'dir': S.dir = val; save(); applyDir(); render(); return;
      case 'labels': S.labels = val; save(); applyLabels(); render(); return;

      /* المظهر */
      case 'theme': S.theme = val; save(); applyTheme(); render(); return;
      case 'accent': S.accent = val; save(); applyAccent(); render(); return;
      case 'size': S.size = parseInt(val, 10) || 100; save(); applyLook(); render(); return;
      case 'density': S.density = val; save(); applyLook(); render(); return;
      case 'sticky': S.sticky = !S.sticky; save(); applyLook(); render(); return;
      case 'tabular': S.tabular = !S.tabular; save(); applyLook(); render(); return;
      case 'motion': S.motion = !S.motion; save(); applyLook(); render(); return;

      /* الأدوات */
      case 'bar': setBar(val, true); toast('اتضافت للشريط ✅'); render(); return;
      case 'unbar': setBar(val, false); render(); return;
      case 'vis': toggleVis(val); render(); return;
      case 'move': { var p = String(val).split('|'); move(p[0], parseInt(p[1], 10)); render(); return; }
      case 'resetBar': resetBar(); toast('رجع الشريط للافتراضي ✅'); render(); return;
      case 'sidebar': setSidebar(!sidebarOpen()); render(); return;

      /* الأوزان */
      case 'wnorm': {
        var w = wLoad(), ks = Object.keys(w[S.wset] || {}), base = Math.floor(100 / ks.length);
        var acc = 0;
        ks.forEach(function (k, i) { var v = (i === ks.length - 1) ? (100 - acc) : base; w[S.wset][k] = v; acc += v; });
        wSave(w); applyWeights(); render(); return;
      }
      case 'wreset': { wSave(JSON.parse(JSON.stringify(W_DEF))); applyWeights(); render(); return; }
      case 'threset': {
        if (typeof CFG === 'undefined' || !CFG.th) return;
        var d = { buy: 65, hold: 50, safe: 65, mid: 45, market: 40 };
        for (var k in d) if (CFG.th[k] != null) CFG.th[k] = d[k];
        render(); return;
      }

      /* المزيد */
      case 'track': {
        S.track = !S.track; save();
        if (typeof octaTrackConsent === 'function') octaTrackConsent(S.track);
        else if (S.track) lsDel('octa_no_track'); else lsSet('octa_no_track', '1');
        render(); return;
      }
      case 'focus': S.focus = !S.focus; save(); applyLook(); applyFocus(); render(); return;
      case 'export': download(); toast('اتنزّل الملف ✅'); return;
      case 'import': { var f = el('setFile'); if (f) f.click(); return; }
      case 'chgCode': OCTASettings.close(); OCTAAuth.show('login'); return;
      case 'login': OCTASettings.close(); OCTAAuth.show('login'); return;
      case 'logout':
        if (confirm('تسجيل الخروج؟ محفظتك ومنبهاتك هتفضل محفوظة على الحساب.')) {
          OCTAAuth.logout();
        }
        render();
        return;
      case 'clearSoft': clearSoft(); render(); return;
      case 'resetAll': resetAll(); render(); return;
    }
  }

  function onSlide(e) {
    var n = e.target;
    if (!n || !n.dataset || !n.dataset.set) return;
    var name = n.dataset.set, val = n.dataset.val;

    if (name === 'size') {
      S.size = parseInt(n.value, 10) || 100; save(); applyLook();
      var p = n.parentNode.querySelector('.set-val'); if (p) p.textContent = S.size + '%';
      return;
    }
    if (name === 'w') {
      var w = wLoad(); if (!w[S.wset]) return;
      w[S.wset][val] = parseInt(n.value, 10) || 0; wSave(w);
      if (typeof CFG !== 'undefined' && CFG.weights[S.wset] && CFG.weights[S.wset][val] != null) {
        CFG.weights[S.wset][val] = w[S.wset][val];
      }
      var lbl = n.parentNode.querySelector('.set-wv');
      if (lbl) lbl.textContent = w[S.wset][val] + '%';
      var box = n.closest('.set-weights');
      if (box && box.nextElementSibling && box.nextElementSibling.classList.contains('set-sum')) {
        var tot = 0;
        Object.keys(w[S.wset]).forEach(function (k) { tot += w[S.wset][k]; });
        box.nextElementSibling.innerHTML = 'المجموع ' + ltr(tot + '%') + ' — ' +
          (Math.round(tot) === 100 ? '✅ تمام' : 'مش لازم 100 بالظبط، بس كل ما زاد عن 100 قلّل منه');
        box.nextElementSibling.className = 'set-sum ' + (Math.round(tot) === 100 ? 'ok' : 'bad');
      }
      return;
    }
    if (name === 'th') {
      if (typeof CFG === 'undefined' || !CFG.th || CFG.th[val] == null) return;
      CFG.th[val] = parseInt(n.value, 10) || 0;
      var l2 = n.parentNode.querySelector('.set-wv'); if (l2) l2.textContent = CFG.th[val];
      return;
    }
  }

  function onInputFile(e) {
    if (e.target && e.target.id === 'setFile' && e.target.files && e.target.files[0]) {
      importFile(e.target.files[0]);
      e.target.value = '';
    }
  }

  function bind() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-set]') : null;
      if (!b || !ov) return;
      onSet(b.dataset.set, b.dataset.val);
    }, true);

    document.addEventListener('input', function (e) {
      if (!ov) return;
      var t = e.target;
      if (t && t.type === 'range' && t.dataset && t.dataset.set) onSlide(e);
    });

    /* ⛔ change للرنج — عشان يشتغل كمان بالأسهم/الكيبورد صح */
    document.addEventListener('change', function (e) {
      if (!ov) return;
      var t = e.target;
      if (t && t.type === 'range') return;   /* اتعامل معاه في input */
      if (t && t.dataset && t.dataset.set) onSlide(e);
      onInputFile(e);
    });

    /* ⌨️ Ctrl/⌘ + , يفتح الإعدادات — زي أي برنامج.
       Escape + حبس الـTab: على document مش على الـoverlay
       (الحدث بيبدأ من العنصر المركّز جواه، فلو مربوط على ov هيمشي صح —
        بس document أأمن لو التركيز اتسرّب). */
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); toggle(); return; }
      if (ov) trap(e);
    });
  }

  /* ══════════════════════════════════════════════════════════
     16) التشغيل
     ══════════════════════════════════════════════════════════ */
  function syncLegacy() {
    /* أول مرة: لو فيه اختيار قديم، نحترمه ونعمله preference صريح */
    try {
      if (!lsGet(KEY)) {
        var old = lsGet('octa_light');
        if (old === '1') S.theme = 'light';
        else if (old === '0') S.theme = 'dark';
        else if (lsGet('octa_theme') === 'light') S.theme = 'light';
        save();
      }
    } catch (e) { }
    if (lsGet('octa_no_track') === '1') S.track = false;
  }

  function applyAll() {
    applyDir();
    applyWeights();
    applyLabels();
    applyTheme();
    applyLook();
    applyFocus();
    applyBar();
    applyMarket();
    applyRefresh();
    applyNums();
  }

  function routeLegacyToggles() {
    /* زرار الهيدر يفضل شغّال — لكن يروح على نفس المصدر الواحد */
    ['toggleLight', 'toggleTheme'].forEach(function (n) {
      var orig = window[n];
      if (typeof orig !== 'function' || orig.__set) return;
      var f = function () {
        var cur = document.body.classList.contains('light');
        S.theme = cur ? 'dark' : 'light';
        save(); applyTheme();
        if (ov) render();
      };
      f.__set = true;
      window[n] = f;
    });
  }

  var booted = false;
  function boot() {
    if (booted) return;          /* ما يشتغلش مرتين */
    booted = true;
    syncLegacy();
    bind();
    routeLegacyToggles();
    applyAll();
    watchNums();

    if (!el('setToast')) {
      var t = document.createElement('div');
      t.id = 'setToast';
      t.className = 'set-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      t.setAttribute('data-set-nodigits', '');   /* الأرقام اللي جوّاها تفضل لاتينية */
      document.body.appendChild(t);
    }

    if (mq && mq.addEventListener) {
      mq.addEventListener('change', function () { if (S.theme === 'auto') { applyTheme(); if (ov) render(); } });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ══════════════════════════════════════════════════════════
     17) الواجهة العامة
     ══════════════════════════════════════════════════════════ */
  window.OCTASettings = {
    open: open,
    close: close,
    toggle: toggle,
    isOpen: isOpen,
    tab: function (id) { open(id); },
    get: function (k) { return k ? S[k] : JSON.parse(JSON.stringify(S)); },
    set: function (k, v) { S[k] = v; save(); applyAll(); },
    reset: resetAll,
    exportFile: download,
    exportData: exportData,
    /* عملة العرض — نفس السمة */
    money: function (n) {
      var d = S.nums === 'ar' ? 'ar-EG' : 'en-US';
      var s = (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString(d, { maximumFractionDigits: 2 });
      return s + ' ' + (CUR_NAME[S.cur] || 'ج.م');
    },
    /* رقم فقط بنفس لغة الأرقام */
    num: function (n, d) {
      if (n == null || isNaN(n)) return '—';
      return Number(n).toLocaleString(S.nums === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: d == null ? 2 : d });
    },
    /* ترجمة الأرقام لأي نص — عشان الكود الجديد يستخدمها */
    digits: function (s) { return S.nums === 'ar' ? swap(String(s), L2A) : String(s); },
    apply: applyAll,
    refresh: function () { S = load(); applyAll(); if (ov) render(); }
  };

})();
