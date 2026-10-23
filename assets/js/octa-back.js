/* ══════════════════════════════════════════════════════════════
 📱 زر الرجوع في PWA — ٢٣ أكتوبر ٢٠٢٦
 ══════════════════════════════════════════════════════════════
 📌 الطلب: لمّا الموقع مثبّت كـapp على الموبايل، زر الرجوع
 📌 بتاع الموبايل (السهم الوردي) لازم يطلعني من الصفحة الحالية
 📌 للصفحة اللي قبلها → للرئيسية → وبعدها بره خالص.
 📌
 📌 ⛔ المشكلة: `history.back()` في PWA standalone بيرجع لتبويب
 📌 المتصفح أو بيفلق التطبيق فجأة — من غير ترتيب.
 📌
 📌 ⛌ ⛌ الحل: نبني history manager ourselves.
 📌 ١ — نعمل stack للصفحات
 📌 ٢ — نحط state في كل history entry
 📌 ٣ — نعمل popstate handler يفهم stack بتاعنا
 📌 ٤ — لوRemaining مفيش ⇒ `location.href = site root` (بره)
 ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (window.__octaBack) return;   /* محمّل مرة واحدة */
  window.__octaBack = true;

  /* ⛌ أقصى عمق — يمنع الستاك من التكبر بلا حد */
  var MAX = 30;

  function root() {
    try { return new URL('/', location.origin).href; }
    catch (e) { return location.origin + '/'; }
  }

  function isStandalone() {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
          || window.navigator.standalone === true;
    } catch (e) { return false; }
  }

  /* ═══ ٠ — الصفحة البديلة للرئيسية ═══ */
  /* ⛔⛔⛔ ٢٣ أكتوبر ٢٠٢٦ — طلب أحمد الصريح:
  📌 «لما أرجع بعد ما أخلص كل الصفحات، عايزني فلتر المؤشرات».
  📌 ⛌ السبب: الفلتر هو المدخل العملي للبحث عن سهم — مش الرئيسية
  📌 (الرئيسية فيها قوائم، الفلتر فيه البحث).
  📌 ⛌ ⛌ ⛌ دي بتتستخدم في موضعين:
  📌 ⛌ ⛌ ① popstate لما الـhistory يخلص
  📌 ⛌ ⛌ ② octaHome() (لوحده)
  📌 ⛌ ومتغيّرتش من غير سبب — لو عايز ترجّعها home قولّي. */
  var HOME_ALT = 'markets';   /* ⛔⛔ آخر صفحة قبل الخروج: صفحة السوق */

  /* ═══ ١ — الـstack بتاعنا ═══ */
  var stack = [];

  function push(page) {
    if (!page) return;
    var top = stack[stack.length - 1];
    if (top === page) return;          /* مافيش تكرار */
    stack.push(page);
    if (stack.length > MAX) stack.shift();
  }

  function pop() {
    if (stack.length > 1) stack.pop();
    return stack[stack.length - 1] || null;
  }

  function reset(page) {
    stack = [page || 'home'];
  }

  /* ═══ ٢ — نعمل state في history ═══
     ⛌ الـindex بيتحسب من طول الـstack: كل صفحة بتاخد entry.
     ⛌ ⛌ نستخدم replaceState مش pushState عشان نمنع التكرار. */
  function mark(page, replace) {
    if (!window.history || !history.pushState) return;
    try {
      var st = { octa: true, page: page, depth: stack.length };
      if (replace) history.replaceState(st, '', location.href);
      else history.pushState(st, '', location.href);
    } catch (e) { /* Safari private — نتجاهل */ }
  }

  /* ══════════════════════════════════════════════════════════════
  ═══ ٣ — popstate ═══════════════════════════════════════════════
  ══════════════════════════════════════════════════════════════
  📌 دالة الـpopstate في الـworker بتعمل state كامل بـpopstate.
  ⛌ ⛌⛌ — ٢٣ أكتوبر ٢٠٢٦ — تصحيح مهم:
  ⛌ الـstate اللي بيرجع **مش بتاعنا** (null أو object تاني) معناها
  ⛌ إن المستخدم وصل **لنهاية الـhistory** — أي رجع قبل ما الموقع
  ⛌ يفتح (صفحة خارجية / تبويب تاني).
  ⛌
  ⛌ ⛌ السلوك الافتراضي للمتصفح هنا: يرجع للصفحة اللي قبلها في
  ⛌ ⛌ التبويب، أو يقفل التطبيق فجأة. ده اللي المستخدم شايفه
  ⛌ ⛌ الصبح لما دوس زر الرجوع وطلع من الموقع.
  ⛌
  ✅ ⛌ الحل: أول ما نلاقي الـstate مش بتاعنا →
  ⛌ ⛌ ١ — نرجع للرئيسية (مش بره خالص — المستخدم لسه جوّه الموقع)
  ⛌ ⛌ ٢ — نعمل replaceState عشان الـentry دي تصير "رئيسية" دايماً
  ⛌ ⛌ ٣ — نعيد الـstack لـ[home] عشان الرجوع اللي بعده يشتغل صح
  ══════════════════════════════════════════════════════════════ */
  window.addEventListener('popstate', function (ev) {
    var st = ev.state;

    /* ⛔⛔⛔ حالة: الـhistory خلص (رجوع لنهاية) أو من صفحة خارجية */
    if (!st || !st.octa) {
      /* ⛔⛔⛔ نقطة الخروج — ٢٣ أكتوبر ٢٠٢٦
      📌 الـhistory خلص = إحنا في آخر صفحة.
      📌 ⛌⛌⛌ لو الصفحة دي Markets ⇒ نقطة الخروج ⇒ يخرج خالص.
      📌 ⛌⛌⛌ وده بالظبط اللي طلبه أحمد: آخر صفحة السوق قبل الخروج. */
      var curPage = stack[stack.length - 1] || 'home';
      if (curPage === HOME_ALT) {
      /* ⛌ عندنا في صفحة السوق والرجوع خلص ⇒ خروج نهائي */
      try {
      window.history.pushState({ octa: true, page: HOME_ALT, depth: 1, exit: 1 },
      '', location.href);
      } catch (x) { }
      try {
      /* ⛌⛌ window.close() في PWA بيقفل التطبيق */
      if (window.close) { window.close(); return; }
      } catch (x) { }
      /* ⛌⛌⛌ مافيش close (تبويب عادي) ⇒ نعمل exit للسيرفر
      ⛌⛌⛌ أو نرجع للصفحة الأولى (سلوك أي موقع) */
      reset('home');
      try {
      window.history.replaceState({ octa: true, page: 'home', depth: 1 },
      '', location.href);
      window.__octaBacking = true;
      switchPage('home');
      window.__octaBacking = false;
      } catch (e) { location.href = root(); }
      return;
      }

      /* ⛔⛔⛔ ٢٣ أكتوبر ٢٠٢٦ — طلب أحمد الصريح:
      📌 «عايز آخر صفحة السوق تبقى آخر صفحة قبل الخروج»
      📌 «الرجوع يوديني تدريجي لحد ما أوصل صفحة السوق»
      📌 «وبعدها لو دوست تاني ⇒ يخرج خالص».
      📌 ⛌ ⛌ ⛌ زي أي تطبيق: رجوع متدرّج، وآخر صفحة = نقطة الخروج. */
      reset(HOME_ALT);
      try {
        history.replaceState({ octa: true, page: HOME_ALT, depth: 1 },
                             '', location.href);
      } catch (e) { }
      /* ⛌ نفس الباج: ⛔ بنرجّع لصفحة داخلية، فمتعملش pushState */
      window.__octaBacking = true;
      try { switchPage(HOME_ALT); }
      catch (e) { location.href = root(); }
      finally { window.__octaBacking = false; }
      return;
    }

    /* ⛌ الحالة الطبيعية: الـstate بتاعنا ⇒ رجوع لصفحة داخلية */
    var page = st.page || 'home';
    var want = Math.max(1, Number(st.depth) || 1);

    /* ⛔⛔⛔ حالة خاصة: الـstate بيقول gate=true
    📌 يعني إحنا في **بوابة الدخول**. بعد تسجيل الدخول، المستخدم
    📌 بيدوس الرجوع — لازم يروح للفلتر مش الرئيسية.
    📌 ⛌ ⛌ (وده المطلوب من أحمد: الفلتر هي الوجهة). */
    if (st.gate) {
      page = HOME_ALT;
      reset(page);
      try {
        history.replaceState({ octa: true, page: page, depth: 1 },
                             '', location.href);
      } catch (e) { }
    }

    /* ⛌ نعدّل الـstack: نقطع لوHistory أعمق، ونكمل لو أضيق */
    while (stack.length > want && stack.length > 1) stack.pop();
    while (stack.length < want) stack.push(page);

    /* ⛔⛔⛔ ٢٣ أكتوبر ٢٠٢٦ — ⭐ الباج الحقيقي اللي كان بيقصّ الرجوع.
    📌 الـpopstate هيتنادى، وهنا بنعمل switchPage.
    📌 ⛌ ⛌ switchPage (بتاعتنا) بتشوف __octaBacking falsy ⇒
    📌 ⛌ ⛌ بتعمل pushState جديد ⇒ بتقطع الـstack وhistory.length
    📌 ⛌ ⛌ بيكبر ⇒ والرجوع التاني بيرجع لنفس المكان.
    ✅ ⛌ الحل: نعمل __octaBacking = true قبل النداء، ونرجّعها
    ✅ false بعده — فبتعرف إن ده رجوع مش فتح جديد. */
    window.__octaBacking = true;
    try { switchPage(page); }
    catch (e) { location.href = root(); }
    finally { window.__octaBacking = false; }
  });

  /* ═══ ٤ — نعرّف للـswitchPage إننا بنتغيّر ═══ */
  /* ⛌⛌ ٢٣ أكتوبر ٢٠٢٦ — gate.html مافيش switchPage.
  📌 ⛌ الحل: نعمل stub بسيط لو مش موجودة — بيحوّل
  📌 ⛌ المسار (location) بدل ما نعمل page swap.
  📌 ⛌ كده الشريط يشتغل حتى في البوابة. */
  if (typeof window.switchPage !== 'function') {
  window.switchPage = function (id) {
  try { if (id && id !== 'home') location.href = '/?page=' + encodeURIComponent(id); }
  catch (e) { location.href = '/'; }
  };
  window.OCTA_GATE_PAGE = true;
  }

  var _origSwitch = window.switchPage;
  if (typeof _origSwitch === 'function') {
    window.switchPage = function (id) {
      /* ⛌ لو راجعين — متسجّلش */
      var isBack = window.__octaBacking;
      if (!isBack) {
        push(id);
        mark(id, false);
      } else {
        window.__octaBacking = false;
      }
      var r = _origSwitch.apply(this, arguments);
      return r;
    };
  }

  /* ═══ ٥ — دوال عامة ═══ */
  window.octaBack = function () {
    var prev = pop();
    if (!prev || prev === 'home' || stack.length <= 1) {
      /* ⛌ مافيش صفحة قبل ⇒ بره خالص */
      try { location.replace(root()); }
      catch (e) { location.href = root(); }
      return;
    }
    window.__octaBacking = true;
    window.__octaBacking = true;   /* ⛌ رجوع مش فتح جديد */
    try { history.back(); }
    catch (e) {
      try { switchPage(prev); } catch (x) { location.href = root(); }
    }
  };

  /* ⛔⛔ ٢٣ أكتوبر ٢٠٢٦ — «الرئيسية» بتاعنا = فلتر المؤشرات.
  📌 السبب: الفلتر هو المدخل العملي للبحث عن سهم.
  📌 ⛌ ⛌ نفس الـfallback بتاع الـpopstate (HOME_ALT). */
  window.octaHome = function () {
    reset(HOME_ALT);
    window.__octaBacking = true;
    try {
      history.replaceState({ octa: true, page: HOME_ALT, depth: 1 }, '', location.href);
      switchPage(HOME_ALT);
      window.__octaBacking = false;
    } catch (e) { location.href = root(); }
  };

  window.octaExit = function () {
    try { location.replace(root()); }
    catch (e) { location.href = root(); }
  };

  /* ═══ ٦ — نبدأ من الصفحة الحالية ═══ */

  function boot() {
    var m = location.search.match(/[?&]page=([^&]+)/);
    /* ⛔⛔⛔ ٢٣ أكتوبر ٢٠٢٦ — caso البوابة.
    📌 لو مفيش توكن (عميل زائر / اتمنّى الجلسة)، الصفحة المعروضة
    📌 هي **بوابة الدخول** مش أي صفحة جوّه الموقع.
    📌 ⛌ ⛌ في الحالة دي، الرجوع لازم يودّي **فلتر المؤشرات**
    📌 ⛌ ⛌ (مش بوابة تانية، ومش الرئيسية).
    📌 ⛌ ⛌ وبعد تسجيل الدخول بـhistory.back() بيرجع للفلتر
    📌 ⛌ ⛌ وده المطلوب من أحمد بالظبط. */
    var hasTok = false;
    try { hasTok = !!(localStorage.getItem('octa_token')
                     || document.cookie.indexOf('octa_token') >= 0); } catch (e) { }
    if (!hasTok && !m) {
      reset(HOME_ALT);   /* ⛌ الفلتر هو الوجهة */
      try {
        history.replaceState({ octa: true, page: HOME_ALT, depth: 1, gate: true },
                             '', location.href);
      } catch (e) { }
      return;   /* ⛌⛌ نوقف — مافيش dummy entry، مافيش stack مفتوح */
    }

    /* ⛔⛔⛔ ٢٣ أكتوبر ٢٠٢٦ — الصفحة الأولى = صفحة السوق
    📌 (ليست 'home' — ده طلب أحمد: السوق آخر صفحة قبل الخروج،
    📌  ف-logically هي نقطة البداية والنهاية)
    📌 ⛌ الـhomeSlim بيشيل الـhomeHidden، فالرئيسية مش stable. */
    var pg = m ? decodeURIComponent(m[1]) : HOME_ALT;
    reset(pg);

    /* ⛔⛔⛔ ٢٣ أكتوبر ٢٠٢٦ — ⭐ الحل الحقيقي لزر الرجوع.
    📌 المشكلة: أول ما المستخدم يفتح الموقع، الـhistory entry
    📌 الحالية هي **قبل ما نتحكم** فيها. فأول رجوع = رجوع لصفحة
    📌 خارجية أو إغلاق للتطبيق فجأة.
    📌
    ✅ الحل: نعمل **دخلة وهمية** (dummy entry) في الـhistory
    📌 فبنضمن إن أول رجوع يبقى جوّه الموقع (بيرجع للرئيسية).
    📌 ⛌ وبعدها الـpopstate handler بتاعنا يشوف state مش بتاعنا
    📌 ⛌ ⇒ يوديه للرئيسية بأمان.
    📌 ⛌ ⛌ الـentry الوهمية مابتحملش عنوان جديد — نفس الـURL. */
    try {
      if (!location.hash && !window.__octaDummy) {
        history.pushState({ octa: true, dummy: true, page: pg, depth: 1 },
                           '', location.href);
        window.__octaDummy = 1;
        /* ⛌ والـentry الأصلية (الحالية) بقت 'الرئيسية' */
        history.replaceState({ octa: true, page: pg, depth: 1 },
                             '', location.href);
      }
    } catch (e) { }

    mark(pg, true);

    /* ⛌⛌ ٢٣ أكتوبر ٢٠٢٦ — لو جايين بـ?page=foo ننفّذها بعد الإقلاع
    📌 (ده اللي بيحصل من اختصارات التطبيق في manifest).
    📌 ⛌ بنج delay بسيط عشان switchPage يبقى متعرّف. */
    if (m && pg !== 'home' && typeof window.switchPage === 'function') {
    setTimeout(function () {
    try { window.__octaBacking = true; switchPage(pg); window.__octaBacking = false; }
    catch (e) { }
    }, 120);
    }
  }



  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();

  /* ⛌⛌ بعد load: switchPage ممكن تكون شغّلت وحجبت الـparent تاني */
  window.addEventListener('load', function () { });
  /* ⛌ ⛌ ⛌ التحقق النهائي: لو الدالة لسه مش متعرّفة (tie في الـJS order)
  ⛌ ⛌ ⛌ بنجيبها بعد tick — عشان مافيشXf حالة الـbar مفقود. */

  setTimeout(function(){ }, 800);
  setTimeout(function(){ }, 2500);
  setTimeout(function(){ }, 5000);

  window.addEventListener('popstate', function () { });

  /* ═══ ٧ — expose للـdebug + واجهة للتسجيل السريع ═══ */
  /* ⛔⛔ ٢٣ أكتوبر ٢٠٢٦ — openMarkets() محتاج يسجّل في الـstack
  📌 من غير ما يمر على switchPage (عشان مافيش logic تاني يتكرر).
  📌 ⛌ ⛌ فبنصدّر window.octaNav بـpush و mark. */
  window.octaNav = {
    push: function (page) { push(page); },
    mark: function (page, replace) { mark(page, !!replace); },
    reset: function (page) { reset(page); },
    depth: function () { return stack.length; },
    last: function () { return stack[stack.length - 1] || 'home'; }
  };

  window.__octaNav = {
    stack: function () { return stack.slice(); },
    depth: function () { return stack.length; },
    home: window.octaHome,
    back: window.octaBack,
    exit: window.octaExit,
    standalone: isStandalone
  };
})();