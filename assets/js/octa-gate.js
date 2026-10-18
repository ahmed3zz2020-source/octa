/* ══════════════════════════════════════════════════════════════
   🚪 بوابة الدخول — لوحة الأرقام
   ──────────────────────────────────────────────────────────────
   الباسورد = 4 أرقام، بيتكتب من على لوحة زي تليفون الموبايل،
   وبيتسلّم لوحده أواخر 4 رقم — من غير زرار.

   ⛔ الشاشة مقفولة دايماً لحد ما السيرفر يوافق — مفيش استثناء.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* 📌 عدد أرقام الباسورد — تغيّره هنا بس */
  var PIN_LEN = 4;

  /* 📌 عدد المحاولات المسموحة — نفس PIN_FAIL_LIMIT بتاع الباك.
     ⛔ لو الباك غيّر الرقم، غيّر السطر ده بس. */
  var PIN_TRIES = 5;

  /* ═══════════════════════════════════════════════════════════
     🔑 القاعدة الجديدة — ٣ غلط ورا بعض جوه دقيقة = كود إيميل
     ═══════════════════════════════════════════════════════════ */

  /* 📌 عدد أرقام الكود — ٦، زي ^[0-9]{6}$ في الباك */
  var CODE_LEN = 6;

  /* 📌 نافذة المحاولات القصيرة — نفس WINDOW_SECONDS في الباك.
     ⛔ لو الباك غيّرها، السطرين دول هما اللي يتغيّروا بس. */
  var STRIKE_LIMIT = 3;      /* ٣ غلط ورا بعض */
  var STRIKE_WINDOW = 60;    /* جوه ٦٠ ثانية */

  /* 📌 صلاحية الكود — ١٠ دقايق.
     📌 ده عرض في الواجهة بس — الباك هو اللي بيحسم وبيبعت سبب
        المنتهي. العدّاد بيقف لو السيرفر اتأخر. */
  var CODE_TTL = 10 * 60;

  /* 📌 محاولات الكود الغلط قبل ما الكود يموت (TOO_MANY_WRONG) */
  var CODE_TRIES = 5;

  /* 📌 مسارات الكود.
     ⛔ الباك الحالي (update_prices.py) مافيش المسارات دي — الموجود
        /api/auth/otp/* وده بيرفض حسابات الباسورد بـ409 pin_account.
        دي مسارات العقد الجديد (plan.yaml بند ٣).
     ⛌ لو الباك غيّر الاسم، غيّر السطر ده بس — الباقي بيقرا منه. */
  var PATHS = {
    send:   '/api/auth/pin/challenge/send',
    verify: '/api/auth/pin/challenge/verify',
    newpin: '/api/auth/pin/challenge/newpin'
  };

  /* ⛔🔴 تدفّق التسجيل الجديد — الإيميل يتأكد **أول** حاجة.
     ⛌ `pin/register` بقى 410 ⬇️ و-callah مابقاش له معنى.
     ⭐ الترتيب: اسم+إيميل ⬇️ كود ⬇️ ٤ أرقام ⬇️ حساب جاهز.
       الحساب **مش** بيتعمل غير بعد ما الكود يتأكد. */
  var SIGNUP = {
    start: '/api/auth/signup/start',
    verify: '/api/auth/signup/verify',
    newpin: '/api/auth/signup/newpin'
  };

  /* 📌 التجديد الصامت — قبل ما التوكن يخلص.
     ⛔ صفر شاشات · صفر طلب باسورد · صفر إزعاج.
     ⛔⛔⛔ الرقم بيتقرأ من السيرفر (expires_in) — ممنوع رقم ثابت هنا.
        لو ثبّتنا على نفس عمر التوكن كان التجديد بيقع على اللحظة
        اللي بينتهي فيها ⇒ 401 ⇒ المستخدم بيتطرد كل ساعتين وهو
        بيتصفح عادي. دهدرس مهم اتصاد بالاختبار مش بالنظر. */
  var RENEW_FALLBACK_MS = 90 * 60 * 1000;   // ٧٢٠٠ × ٠.٧٥
  var RENEW_PATH = '/api/auth/refresh';

  /* 📌 ٧٥٪ من عمر التوكن: فارق آمن ضد أي تأخّر في الشبكة،
     وقريب ما يكفيش إنه يضيّع وقت المستخدم في وضع معتمد. */
  function renewDelayMs(expiresInSec) {
    var s = Number(expiresInSec);
    if (!isFinite(s) || s <= 0) s = 7200;
    /* ⛌ حد أدنى دقيقة — لو السيرفر رجّع رقم غريب ما نبقاش
       بنجدد كل ٢٠٠ مللي ثانية. */
    return Math.max(60000, Math.floor(s * 1000 * 0.75));
  }

  /* 📌 الخمول — ٣٠ دقيقة من غير ما يلمس الموقع.
     ⛔ دي خامل (idle) في المتصفح مش تروكن بصري: بتتحسب من آخر
        لمسة (ماوس · لمس · ضغط · كتابة · scroll) — مش من وقت فتح
        الصفحة ومش من وقت الـHTTP. */
  var IDLE_MS = 30 * 60 * 1000;
  var IDLE_TICK = 60 * 1000;

  /* 📌 البصمة — للموبايل بس. التابلت واللاب مافيش فيهما مستشعر
     بصمة أصلاً، فبيشتغلوا بـ٤ أرقام وخلاص.
     ⛔ البصمة **مفيش لها endpoint في الباك لسه** — شوف deliverable.
        لو المسار رجّع 404 أو المتصفح مافيش فيه WebAuthn، بنردّ
        فوراً على لوحة ٤ أرقام. */
  var P_BIO = '/api/auth/pin/fingerprint';

  /* 📌 ⛔⛔ الرد المحايد — حرفياً واحد، في كل الحالات.
     ⛔ ممنوع نكتب «الإيميل مش مسجّل» — الرد ده بيعمل تلميح
        وبيبقى قناة مفتوحة عشان نعرف مين عندنا حساب ومين لأ. */
  var NOTE_SAME = 'لو الإيميل ده بتاعك، هتلاقي كود من ٦ أرقام في بريدك';

  /* ═══ الاتصال ═══ */
  function apiBase() {
    try { return (typeof OCTA_API !== 'undefined' && OCTA_API) || ''; }
    catch (e) { return ''; }
  }

  /* ⛌ التوكن بيتلزق جوّه octa-api.js — مش هنا.
     بنقرا الرد كنص الأول عشان السيرفر ممكن يردّ HTML صفحة خطأ. */
  function post(path, body) {
    return fetch(apiBase() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.text().then(function (txt) {
        var d = null;
        try { d = JSON.parse(txt); } catch (e) { d = null; }
        return { s: r.status, d: d || {} };
      }, function () { return { s: r.status, d: {} }; });
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 📌 طلب بتروكن (تروكن الفتح أو تروكن الجلسة) — الباك بيقرا
     التروكن من هيدر Authorization مش من الـbody.
     ⛔-body فاضي للأومد: /api/auth/refresh بيرفض أي credential
     في الـbody بـ400 — فمفيش سبب نبعت أي حاجة. */
  function postAuth(path, body, authToken) {
    var h = { 'Content-Type': 'application/json' };
    if (authToken) h['Authorization'] = 'Bearer ' + authToken;
    return fetch(apiBase() + path, {
      method: 'POST',
      headers: h,
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.text().then(function (txt) {
        var d = null;
        try { d = JSON.parse(txt); } catch (e) { d = null; }
        return { s: r.status, d: d || {} };
      }, function () { return { s: r.status, d: {} }; });
    });
  }

  /* ═══ التوكن ═══ */
  function token() {
    try { return localStorage.getItem('octa_token') || ''; } catch (e) { return ''; }
  }
  function put(t, u) {
    try {
      localStorage.setItem('octa_token', t);
      localStorage.setItem('octa_user', JSON.stringify(u || {}));
      window.OCTA_USER_ID = (u && u.id) || '';
    } catch (e) { }
  }
  function logoutLocal() {
    try {
      localStorage.removeItem('octa_token');
      localStorage.removeItem('octa_user');
      window.OCTA_USER_ID = '';
    } catch (e) { }
  }

  /* ═══════════════════════════════════════════════════════════
     🖼️ الهيكل
     ───────────────────────────────────────────────────────────
     ⛌ نسخة مطابقة لـindex.html. لو الـDOM اتشال (shut) ورجع
     اتفتح تاني، بنعيد بناؤه من هنا — البوابة من غير زرار = موقع ميت.
     ═══════════════════════════════════════════════════════════ */
  var SHELL =
    '<div class="gt-top">' +
      '<div class="gt-top-t" id="gtTopT">تسجيل الدخول</div>' +
      '<button class="gt-top-b" id="gtTopB" type="button">أريد مساعدة</button>' +
    '</div>' +
    '<div class="gt-body">' +
      '<div class="gt-box" id="gtBox"><div id="gt-form"></div></div>' +
    '</div>';

  function gateEl() { return document.getElementById('gate'); }

  /* ⛌ المونتاج — idempotent: يا ما فيش حاجة، يا بترجّع نفس العنصر */
  function mount() {
    var g = gateEl();
    if (g) return g;
    g = document.createElement('div');
    g.id = 'gate';
    g.className = 'gt-wrap';
    g.style.cssText = 'position:fixed;inset:0;z-index:999999;display:flex;';
    g.innerHTML = SHELL;
    document.body.appendChild(g);
    return g;
  }

  function formEl() {
    var f = document.getElementById('gt-form');
    if (f) return f;
    mount();
    return document.getElementById('gt-form');
  }
  function boxEl() { return document.getElementById('gtBox'); }
  function topT() { return document.getElementById('gtTopT'); }
  function topB() { return document.getElementById('gtTopB'); }

  /* 📌 الشريط فوق: عنوان على اليمين + زرار على الشمال.
     📌 backFn — الدالة اللي زرار الرجوع بيرجعله.
        لو مش موجودة بيرجع لأول شاشة (زي ما كان قبل كده). */
  function head(title, back, backFn) {
    var t = topT(), b = topB();
    if (t) t.textContent = title;
    if (!b) return;
    b.style.visibility = '';
    if (back) {
      b.textContent = 'رجوع';
      b.className = 'gt-top-b bk';
      b.onclick = function () { (backFn || welcome)(); };
    } else {
      b.textContent = 'أريد مساعدة';
      b.className = 'gt-top-b';
      b.onclick = function () { help(); };
    }
  }

  function open() {
    var g = mount();
    g.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      var gg = gateEl();
      var f = document.getElementById('gt-form');
      if (gg && gg.style.display !== 'none' && (!f || !f.innerHTML.trim())) welcome();
    }, 120);
  }

  function shut() {
    var g = gateEl();
    if (g) g.remove();
    document.body.style.overflow = '';
    stopLock();
    wipeFlow();     /* ⛔ الإيميل والكود يتمسحوا مع إغلاق البوابة */
    try { window.OCTAAuth && window.OCTAAuth.refresh && window.OCTAAuth.refresh(); } catch (e) { }

    /* ⛔⛔ المحتوى المحمي بيتخطّى وهو لسه بره البوابة (السيرفر بيرد 401).
       البوابة بتنطفي من غير reload، فالمحتوى ده ميفتحش لوحده.
       ⛌ الحدث بيقول للصفحة: اتأكدت، حمّل دلوقتي. */
    try { document.dispatchEvent(new CustomEvent('octa:authed')); } catch (e) { }
  }

  /* ok = true (أخضر) · false (أحمر) · 'hi' (عادي) */
  function say(t, ok) {
    var m = document.getElementById('gtMsg');
    if (!m) return;
    m.textContent = t;
    m.className = 'gt-msg' + (ok === true ? ' ok' : (ok === false ? ' no' : ''));
  }
  function clearMsg() { say('', 'hi'); }

  /* حالة الانتظار — بدل الكارت الفاضي */
  function pending(msg) {
    var f = formEl();
    if (!f) return;
    f.innerHTML = '<div class="gt-wait"><span class="gt-spin"></span>' + (msg || '⏳ بنتحقق من حسابك…') + '</div>';
    head('أهلاً بعودتك', 1);
  }

  /* ═══════════════════════════════════════════════════════════
     🔢 لوحة الأرقام
     ───────────────────────────────────────────────────────────
     state.pin    الأرقام اللي اتكتبت
     state.lock   ثواني فاضية (السيرفر رجّع 429)
     state.tries  عدد المحاولات الغلط
     ═══════════════════════════════════════════════════════════ */
  var state = { pin: '', len: PIN_LEN, lock: 0, tries: 0, lockTimer: null, jump: null };

  /* ⛔⛔⛔ بيانات الشاشة الجديدة — في الذاكرة **بس**.
     ⛔ ممنوع الإيميل أو الكود أو التذكرة يتفكّروا في
        localStorage أو sessionStorage أو cookie أو log أو تحليلات.
        الباك نفسه بيخزّنهم مشفّرين — الواجهة ماتخزّنش خالص. */
  var flow = { email: '', code: '', unlock: '', cd: 0, cdTimer: null, tries: 0 };

  /* 📌 التسجيل ⬇️ لوحده عنده حالة مستقلة ⬇️ عشان ما نخلطش
     بين «استرجاع باسورد» و«إنشاء حساب». والمهم ⬇️
     `s.mode` بيقول لـcodeEntry و-newPin فين يروحوا لو رجعنا. */
  var s = { name: '', email: '', mode: 'login' };

  function wipeFlow() {
    flow.email = ''; flow.code = ''; flow.unlock = '';
    flow.tries = 0;
    stopCd();
  }

  function stopCd() {
    if (flow.cdTimer) { clearInterval(flow.cdTimer); flow.cdTimer = null; }
    flow.cd = 0;
  }

  /* ═══════════════════════════════════════════════════════════
     ⏱ نافذة المحاولات القصيرة — ٣ غلط ورا بعض جوه ٦٠ ثانية
     ───────────────────────────────────────────────────────────
     ⛔ النافذة **سلايدر**: كل محاولة جديدة بتدفع القديمة اللي
        خرجت بره الـ٦٠ ثانية. لو فضلت دقيقة وفسكت، العدّاد
        بيبدأ من الصفر — وده بالظبط اللي بيمنع المهاجم يوزّع
        محاولاته على نافذتين.
     📌 الختم بتاعها: Date.now() — الوقت من المتصفح.
        ⛔ ده مش أمان، ده راحة للمستخدم. الأمان كله في الباك،
           والواجهة بتتبعه مش بتعارضه.
     ═══════════════════════════════════════════════════════════ */
  var hits = [];
  function strikeCount() {
    var cut = Date.now() - STRIKE_WINDOW * 1000;
    while (hits.length && hits[0] <= cut) hits.shift();
    return hits.length;
  }
  function strikePush() { hits.push(Date.now()); return strikeCount(); }
  function strikeReset() { hits = []; }

  function stopLock() {
    if (state.lockTimer) { clearInterval(state.lockTimer); state.lockTimer = null; }
    if (state.jump) { clearTimeout(state.jump); state.jump = null; }
    state.lock = 0;
    stopCd();   /* ⛌ عدّاد الكود يموت مع أي شاشة جديدة */
    screenId++; /* ⛌ أي مستمع شاشة قديم يموت فورًا (زي مستمع البصمة) */
  }

  /* 📌 النقطة الواحدة بتتعبى مع كل رقم — وده كل مؤشر التقدم */
  function paintDots() {
    var d = document.getElementById('gtDots');
    if (!d) return;
    var kids = d.childNodes;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].className !== undefined) {
        kids[i].className = 'gt-dot' + (i < state.pin.length ? ' on' : '');
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════
     🔢 خانات الكود — ٦ خانات LTR (زي لوحة الأرقام بالظبط)
     ═══════════════════════════════════════════════════════════ */
  function codeHtml() {
    var b = '';
    for (var i = 0; i < CODE_LEN; i++) b += '<div class="gt-cb"></div>';
    return '<div class="gt-code-row" id="gtCodeRow">' + b + '</div>';
  }

  function paintCode() {
    var r = document.getElementById('gtCodeRow');
    if (!r) return;
    var ks = r.getElementsByTagName('div');
    for (var i = 0; i < ks.length; i++) {
      ks[i].className = 'gt-cb' + (i < state.pin.length ? ' on' : '');
    }
  }

  function shakeCode() {
    var r = document.getElementById('gtCodeRow');
    if (!r) return;
    r.classList.remove('bad');
    void r.offsetWidth;          /* ⛌ بدون force reflow الأنيميشن مش هيشتغل تاني */
    r.classList.add('bad');
    setTimeout(function () {
      var e = document.getElementById('gtCodeRow');
      if (e) e.classList.remove('bad');
    }, 560);
  }

  function padHtml(dis) {
    return '<div class="gt-dots" id="gtDots">' +
        '<i class="gt-dot"></i><i class="gt-dot"></i>' +
        '<i class="gt-dot"></i><i class="gt-dot"></i>' +
      '</div>' +
      '<div class="gt-msg" id="gtMsg"></div>' +
      '<div class="gt-pad' + (dis ? ' dis' : '') + '" id="gtPad">' +
        '<button class="gt-key" data-k="1" type="button">1</button>' +
        '<button class="gt-key" data-k="2" type="button">2</button>' +
        '<button class="gt-key" data-k="3" type="button">3</button>' +
        '<button class="gt-key" data-k="4" type="button">4</button>' +
        '<button class="gt-key" data-k="5" type="button">5</button>' +
        '<button class="gt-key" data-k="6" type="button">6</button>' +
        '<button class="gt-key" data-k="7" type="button">7</button>' +
        '<button class="gt-key" data-k="8" type="button">8</button>' +
        '<button class="gt-key" data-k="9" type="button">9</button>' +
        '<button class="gt-key gt-del" data-k="d" type="button" aria-label="مسح">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9L2.5 12z"/>' +
          '<path d="M15.6 9.6 20.4 14.4M20.4 9.6 15.6 14.4"/></svg>' +
        '</button>' +
        '<button class="gt-key" data-k="0" type="button">0</button>' +
        '<span class="gt-key off"></span>' +
      '</div>';
  }

  /* 📌 نفس اللوحة في كل شاشة — الفرق بس في اللي فوقها */
  function paintPad(dis) {
    var p = document.getElementById('gtPad');
    if (!p) return;
    p.className = 'gt-pad' + (dis ? ' dis' : '');
    var bs = p.getElementsByTagName('button');
    for (var i = 0; i < bs.length; i++) bs[i].disabled = !!dis;
    paintDots();
  }

  /* 📌 علّق على اللوحة — كل ضغطة رقم أو ⌫.
     onFull(pin)  → اتعبّت 4 أرقام (هنا بنسلّم)
     onAny()      → أي تغيير (للزرار المتغيّر في شاشة التسجيل) */
  function onPad(onFull, onAny) {
    var p = document.getElementById('gtPad');
    if (!p) return;
    p.onclick = function (e) {
      var b = e.target;
      while (b && b !== p && !(b.getAttribute && b.tagName)) b = b.parentNode;
      var k = b && b.getAttribute && b.getAttribute('data-k');
      if (!k || state.lock > 0) return;
      /* ⛌ زرار متقفل = الرقم مش هيتقبل (قفل السيرفر أو وهو رايح) */
      if (b.tagName === 'BUTTON' && b.disabled) return;
      if (k === 'd') state.pin = state.pin.slice(0, -1);
      else if (state.pin.length < state.len) state.pin += k;
      else return;
      paintDots();
      if (onAny) onAny();
      /* ⛌ الأرقام كملت → يتسلّموا لوحدهم. مفيش زرار «دخول» أصلاً. */
      if (state.pin.length === state.len && onFull) {
        var v = state.pin;
        paintPad(true);          /* ⛌ نقفل اللوحة وهو رايح للسيرفر */
        setTimeout(function () {
          /* ⛌ لو المستخدم مسح رقم في الـ130ms دي، ما نسلّمش رقم قديم */
          if (state.pin !== v) { paintPad(false); return; }
          onFull(v);
        }, 130);
      }
    };
  }

  /* 📌 اهتزاز — خطأ الباسورد أو ضغطة غلط */
  function shake() {
    var d = document.getElementById('gtDots');
    if (!d) return;
    d.classList.remove('bad');
    /* ⛌ بدون force reflow، المتصفح مش هيشغّل الأنيميشن تاني */
    void d.offsetWidth;
    d.classList.add('bad');
    /* ⛌ اللون الأحمر للنقط بيوصل لـ560ms بس — بعدين نلمس الأثر */
    setTimeout(function () {
      var e = document.getElementById('gtDots');
      if (e) e.classList.remove('bad');
    }, 560);
  }

  function badPin(left, strikes) {
    state.pin = '';
    paintDots();
    shake();
    if (strikes == null) { clearMsg(); return; }
    /* 📌 left = المحاولات الفاضلة في نافذة الدقيقة (السيرفر بيحسبها) */
    if (left <= 0) say('الباسورد غلط — المحاولات خلصت', false);
    else if (left === 1) say('الباسورد غلط — آخر محاولة قبل ما نطلب كود على الإيميل', false);
    else say('الباسورد غلط — فاضل ' + left + ' محاولات قبل ما نطلب كود', false);
  }

  function mm(s) {
    var m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  /* 📌 السيرفر رجّع 429 → اقفل + عدّاد تنازلي */
  function locked(sec) {
    var s = Math.max(1, Math.ceil(Number(sec) || 0) || 60);
    state.lock = s;
    /* ⛌ نفضّي النقط: متبقاش 4 نقط مملوءة وباسورد غلط */
    state.pin = '';
    paintDots();
    paintCode();
    paintPad(true);

    var m = document.getElementById('gtMsg');
    if (m) {
      m.className = 'gt-msg no';
      m.innerHTML = '⛔ مقفول ' + Math.floor(s / 60) + ' دقيقة' +
        ' <span class="gt-cd" id="gtLockCd">(' + mm(s) + ')</span>';
    }
    stopLock();
    state.lock = s;
    state.lockTimer = setInterval(function () {
      state.lock--;
      var cd = document.getElementById('gtLockCd');
      if (cd) cd.textContent = '(' + mm(Math.max(0, state.lock)) + ')';
      var mm0 = document.getElementById('gtMsg');
      if (state.lock <= 0) {
        stopLock();
        paintPad(false);
        clearMsg();
        return;
      }
      if (mm0 && state.lock % 60 === 0) {
        mm0.innerHTML = '⛔ مقفول ' + Math.floor(state.lock / 60) + ' دقيقة' +
          ' <span class="gt-cd">(' + mm(state.lock) + ')</span>';
      }
    }, 1000);
  }

  /* 📌 رقم المحاولات اللي فاضل.
     ⛔ السيرفر مش بيبعته (بيسلّم 401 {why:"bad_pin"} بس) — فبنحسبه
        من عندنا على PIN_FAIL_LIMIT بتاع الباك (٥). لو الباك بعت
        رقم في المستقبل، إحنا بنحترمه. */
  function leftTries(d, tries) {
    var v = d && (d.remaining != null ? d.remaining
      : (d.left != null ? d.left : (d.tries_left != null ? d.tries_left : null)));
    if (v == null || isNaN(v)) return Math.max(0, PIN_TRIES - (tries || 0));
    return Math.max(0, Number(v));
  }

  /* ═══ أخطاء مش متوقعة — السيرفر واقع أو مفيش نت ═══ */
  function down(what) {
    formEl().innerHTML =
      '<div class="gt-err">⚠️ مش قادرين نوصل للسيرفر</div>' +
      '<p class="gt-txt">الاتصال بـ' + esc(what) + ' فشل — تأكد من النت وجرب تاني</p>' +
      '<button class="gt-go" id="gtRetry" type="button">🔄 جرّب تاني</button>';
    var b = document.getElementById('gtRetry');
    if (b) b.onclick = function () { location.reload(); };
  }

  /* 🔄 السيرفر بيعمل restart (503 / 502)
     ⛔ الرسالة دي بتظهر أثناء إعادة النشر — والمستخدم ثابت
        جواه، فماينفعش نقوله «ادخل من جديد» والسبب إن السيرفر
        بدأ يفتح. بنستناه ونعيد المحاولة لوحدنا. */
  function booting(n) {
    var f = formEl();
    if (!f) return;
    f.innerHTML =
      '<div class="gt-err">🔄 السيرفر بيعمل restart</div>' +
      '<p class="gt-txt">ثواني وبعدين هيفتح لوحده — متقلقش، حسابك محفوظ (محاولة ' + n + ')</p>';
  }

  /* 📌 رد السيرفر في التسجيل — بنوريه زي ما هو،
     ⛔ وبيتقسم على why (نوع الخطأ) عشان 409 (إيميل أو باسورد مكرر)
        ما يطلعش للمستخدم كرقم أو كود غامض. */
  function fail(o, fallback) {
    if (o.s === 429) { locked(o.d.retry_after || o.d.retry || 60); return; }
    var d = o.d || {};
    var t = d.error || fallback || ('حصل خطأ (' + o.s + ')');
    if (d.why === 'email_taken') {
      t = d.error || 'الإيميل ده مسجّل قبل كده';
      say('❌ ' + t + ' — لو فاكر الباسورد، «عندك حساب؟ ادخل»', false);
    } else if (d.why === 'pin_taken') {
      say('❌ ' + (d.error || 'الباسورد ده مستخدم من قبل') + ' — اكتب ٤ أرقام تانية', false);
    } else {
      say('❌ ' + t, false);
    }
    shake();
  }

  /* ═══════════════════════════════════════════════════════════
     ① شاشة الاختيار — أول مرة ولا راجع
     ═══════════════════════════════════════════════════════════ */
  function welcome() {
    stopLock();
    state.pin = ''; state.tries = 0; state.len = PIN_LEN;
    mount();
    head('تسجيل الدخول', 0);
    boxEl().className = 'gt-box';
    formEl().innerHTML =
      '<div class="gt-ico">🐙</div>' +
      '<h1 class="gt-h">OCTA</h1>' +
      '<p class="gt-sub">اخطبوط — 8 أذرع بتحلّل السهم من كل زاوية</p>' +
      '<button class="gt-go" id="gtReg" type="button">إعمل حساب جديد</button>' +
      '<button class="gt-go alt" id="gtLogin" type="button">عندك حساب؟ ادخل</button>' +
      '<div class="gt-note">الدخول بالباسورد بس — 4 أرقام من غير إيميل</div>';

    document.getElementById('gtReg').onclick = function () { signup(); };
    document.getElementById('gtLogin').onclick = function () { login(); };
  }

  /* ═══════════════════════════════════════════════════════════
     ② التسجيل — مرة واحدة بس
     ═══════════════════════════════════════════════════════════ */
  function signup() {
    stopLock();
    state.pin = ''; state.len = PIN_LEN;
    mount();
    head('حساب جديد', 1);
    boxEl().className = 'gt-box reg';
    formEl().innerHTML =
      '<label class="gt-lb" for="gtName">اسمك</label>' +
      '<input id="gtName" class="gt-in" placeholder="مثلاً: أحمد" maxlength="40" autocomplete="name">' +
      '<label class="gt-lb" for="gtMail">إيميلك</label>' +
      '<input id="gtMail" class="gt-in" type="email" placeholder="name@mail.com" maxlength="120" autocomplete="email" dir="ltr">' +
      '<p class="gt-sub2">هنبعتلك كود على الإيميل ⬇️ تكتبه وبعدين تختار ٤ أرقام. ' +
      'حسابك مش بيتعمل غير لما الكود يتأكد.</p>' +
      '<button class="gt-go" id="gtDo" type="button">ابعت الكود</button>';

    var btn = document.getElementById('gtDo');

    function send() {
      var name = (document.getElementById('gtName').value || '').trim();
      var mail = (document.getElementById('gtMail').value || '').trim();
      if (!name) { say('❌ اكتب اسمك الأول', false); return; }
      if (!mail || mail.indexOf('@') < 1) {
        say('❌ اكتب إيميل صح', false); return;
      }
      if (btn) { btn.disabled = true; btn.textContent = '⏳ بنبعت الكود…'; }
      clearMsg();

      /* ⛔⛔ مافيش باسورد في الطلب ⬇️ ولا في الشاشة ⬇️
         الإيميل يتأكد **أول** حاجة وبعدين بس نطلب ٤ أرقام. */
      post(SIGNUP.start, { name: name, email: mail })
        .then(function (o) {
          if (o.s === 200) {
            s.name = name; s.email = mail; s.mode = 'signup';
            flow.email = mail;
            try { octaTrack('signup_start', 'gate', ''); } catch (e) { }
            codeEntry();
            return;
          }
          if (btn) { btn.disabled = false; btn.textContent = 'ابعت الكود'; }
          var d = o.d || {};
          if (o.s === 429) { locked(d.retry_after || d.retry || 60); return; }
          say('❌ ' + ((d.error) || 'مقدرناش نبعت الكود — جرّب تاني'), false);
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = 'ابعت الكود'; }
          down('التسجيل');
        });
    }

    if (btn) btn.onclick = send;

    /* ⛌ مافيش لوحة أرقام في شاشة التسجيل ⬇️ مافيش باسورد هنا.
       الباسورد بيتطلب **بعد** ما الكود يتأكد ⬇️ newPin(). */

    setTimeout(function () {
      var n = document.getElementById('gtName');
      if (n) n.focus();
    }, 60);
  }

  /* ═══ شاشة النجاح ═══ */
  function done(mail) {
    stopLock();
    head('تم التسجيل', 0);
    var tb = topB();
    if (tb) tb.style.visibility = 'hidden';   /* مفيش مساعدة محتاجاك دلوقتي */
    boxEl().className = 'gt-box';
    formEl().innerHTML =
      '<div class="gt-ico">✅</div>' +
      '<h1 class="gt-h">تم</h1>' +
      '<p class="gt-txt">من هنا وكل مرة هتدخل بالباسورد</p>' +
      '<p class="gt-sent-s">' + esc(mail || '') + '</p>' +
      '<div class="gt-note">احفظ الـ4 أرقام دي كويس — هم وسيلة الدخول الوحيدة</div>' +
      '<button class="gt-go" id="gtNow" type="button">ادخل دلوقتي</button>';

    var b = document.getElementById('gtNow');
    if (b) b.onclick = function () { stopLock(); login(); };
    state.jump = setTimeout(function () { state.jump = null; login(); }, 3200);
  }

  /* ═══════════════════════════════════════════════════════════
     ③ الدخول — بالظبط زي الصورة
     ═══════════════════════════════════════════════════════════ */
  /* ═══════════════════════════════════════════════════════════
     👆 البصمة — للموبايل بس
     ───────────────────────────────────────────────────────────
     📌 «طريقة تلغي التانية»: الموبايل بصمته الأول، والتابلت
        واللاب مافيش فيهما مستشعر أصلاً فبيشتغلوا بـ٤ أرقام
        وخلاص — من غير ما نذكر البصمة أصلاً.
     ⛔⛔ مافيش endpoint للبصمة في الباك لسه (update_prices.py) —
        فبنتعامل مع ده بأمان: لو WebAuthn مش موجود، أو المتصفح
        رفض، أو المسار رجّع 404 → لوحة ٤ أرقام فوراً.
     ⛌ الضغط **بره** الكارت = ٤ أرقام على طول. مافيش قفل
        للمستخدم اللي مش عايز البصمة.
     ═══════════════════════════════════════════════════════════ */
  /* 📌 البصمة — للموبايل بس.
     ⛔⛔⛔ شرط أحمد: التابلت واللاب ٤ أرقام بس، وصفر ذكر للبصمة
        — عشان «الموقع يبان بروفيشنال».
        ⛔ متكفيش بـ hasTouch: لابتوب بلمس أو تابلت في وضع
        أفقي هيبقى عنده maxTouchPoints > 0 وهيعرض البصمة غلط. */
  var BIO_MIN_EDGE = 600;   /* أصغر ضلع — أي جهاز منه أكبر = تابلت أو لاب */

  function isPhone() {
    try {
      var w = window.screen.width || 0, h = window.screen.height || 0;
      if (!w || !h) return false;
      /* ⛔ التابلت (٧٦٨×١٠٢٤) واللاب (١٤٤٠×٩٠٠) ولاب-بلمس
        (١٠٢٤×٦٠٠) كلهم أكبر من ٦٠٠ ⇒ ٤ أرقام بس.
        الموبايت أقل من ٦٠٠ في الضلع الأصغر — ده الحد المعروف. */
      if (Math.min(w, h) >= BIO_MIN_EDGE) return false;
      var coarse = window.matchMedia
        && window.matchMedia('(pointer: coarse)').matches;
      return coarse || (navigator.maxTouchPoints > 0);
    } catch (e) { return false; }
  }
  function isTouch() { return isPhone(); }
  function hasBio() {
    try {
      return typeof window.PublicKeyCredential === 'function'
        && !!(navigator.credentials && navigator.credentials.get);
    } catch (e) { return false; }
  }

  /* 📌 عدّاد شاشات البوابة — أي مستمع قديم يموت لما الشاشة تتغيّر.
     ⛌ stopLock() بيعدّه، وكل شاشة بتناديه الأول. */
  var screenId = 0;

  function bioLogin() {
    stopLock();
    var me = screenId;
    mount();
    head('تسجيل الدخول', 0);
    boxEl().className = 'gt-box bio';
    formEl().innerHTML =
      '<div class="gt-bio" id="gtBio">' +
        '<div class="gt-ico">👆</div>' +
        '<h1 class="gt-h">ادخل ببصمة</h1>' +
        '<p class="gt-sub2">ضع إصبعك على المستشعر — أسرع وأأمن من ٤ أرقام</p>' +
        '<button class="gt-go" id="gtBioGo" type="button">👆 بصمة</button>' +
        '<button class="gt-back" id="gtBioPin" type="button">ادخل بـ٤ أرقام</button>' +
        '<p class="gt-note">لو البصمة مشتغلتش، دوس بره الكارت وهتدخل بأرقام</p>' +
      '</div>';

    function off() {
      var b = document.querySelector('.gt-body');
      if (b) b.onclick = null;
    }

    function toPin() { if (me !== screenId) return; off(); login(1); }

    var go = document.getElementById('gtBioGo');
    if (go) go.onclick = function () { if (me === screenId) doBio(off); };
    var pb = document.getElementById('gtBioPin');
    if (pb) pb.onclick = toPin;

    /* ⛌⛌ الضغط بره الكارت = ٤ أرقام فوراً (بلا ما نطلب ولا كلمة)
       ⛌⛌ بنيسجّل المستمع بعد ما الحدث الحالي يخلص (setTimeout):
          ضغطة «ادخل» نفسها بتكمّل في الـbubbling على .gt-body بعد ما
          الشاشة الجديدة تركب — فكانت بتلخبطنا على لوحة الأرقام في نفس
          اللحظة (البصمة ما كانتش بتبان أصلاً على الموبايل). */
    var body = document.querySelector('.gt-body');
    if (body) {
      setTimeout(function () {
        if (me !== screenId) return;
        body.onclick = function (e) {
          if (me !== screenId) return;
          var box = document.getElementById('gtBio');
          if (box && (box === e.target || box.contains(e.target))) return;
          toPin();
        };
      }, 0);
    }
    if (go) go.click();          /* 📌 بنجرب البصمة لوحدها */
  }

  /* 📌 محاولة البصمة — أي فشل بيرجّعنا للوحة ٤ أرقام */
  function doBio(off) {
    off = off || function () { };
    var box = document.getElementById('gtBio');
    if (box) box.setAttribute('data-busy', '1');
    var b = document.getElementById('gtBioGo');
    if (b) { b.disabled = true; b.textContent = '⏳ بنستنى البصمة...'; }
    var go = window.location.protocol === 'https:' || isLocal()
      ? postAuth(P_BIO, { device: 'bio' }, null)
      : Promise.resolve({ s: 404, d: {} });
    go.then(function (o) {
      if (o.s === 200 && o.d && o.d.token) {
        off();
        put(o.d.token, o.d.user);
        shut();
        return;
      }
      /* ⛔⛔ مافيش بصمة في الباك — أو رفضها المتصفح. ٤ أرقام على طول. */
      off();
      login(1);
    }).catch(function () { off(); login(1); });
  }

  function isLocal() {
    try {
      var h = location.hostname;
      return h === 'localhost' || h === '127.0.0.1' || h === '';
    } catch (e) { return false; }
  }

  /* 📌 noBio — جاي من شاشة البصمة نفسها:Means «المستخدم اختار
     الأرقام بنفسه»، فماشيش تاني على البصمة. */
  function login(noBio) {
    stopLock();
    state.pin = ''; state.tries = 0; state.len = PIN_LEN;
    /* ⛔ رجع المستخدم وشكله خلص من النافذة القصيرة — مش هنفسحله
        الطريق ونعيده للوحة تاني. */
    if (strikeCount() >= STRIKE_LIMIT) { askCode(); return; }
    /* 📱 الموبايل: البصمة الأول. ⛔ التابلت واللاب: ٤ أرقام بس
        من غير ما نذكر البصمة أصلاً — مافيش مستشعر. */
    if (!noBio && isTouch() && hasBio()) { bioLogin(); return; }
    mount();
    head('تسجيل الدخول', 0);
    boxEl().className = 'gt-box pin';
    formEl().innerHTML =
      '<div class="gt-ico">🗝️</div>' +
      '<h1 class="gt-h">مرحباً بك في OCTA</h1>' +
      padHtml(0) +
      '<button class="gt-forgot" id="gtForgot" type="button">نسيت كلمة المرور؟</button>' +
      '<button class="gt-back" id="gtBack" type="button">رجوع</button>';

    onPad(function (p) {
      /* ⛌ العدّاد بيتزاد قبل الطلب — عشان الرسالة بعد الغلط
        تقول كام محاولة فاضلة فعلاً (مش دايماً ٥). */
      state.tries++;
      paintPad(true);
      clearMsg();

      post('/api/auth/pin/login', { pin: p })
        .then(function (o) {
          if (o.s === 200 && o.d && o.d.token) {
            strikeReset();
            put(o.d.token, o.d.user);
            shut();
            return;
          }
          /* ⛔⛌ السيرفر هو اللي بيحسم. 429 = قفل ١٥ دقيقة (القاعدة ②).
            والـneed_code بيرجع **401** مش 429 — انتبه. */
          if (o.s === 429) { locked(o.d.retry_after || o.d.retry || 60); return; }
          if (needCode(o.d)) { askCode(); return; }
          /* ⛌ كل حاجة تانية = الباسورد غلط. ما نقولش حاجة عن الحساب. */
          var n = strikePush();
          if (n >= STRIKE_LIMIT) { askCode(); return; }
          badPin(winLeft(o.d, state.tries), n);
          paintPad(false);
        })
        /* ⛔ شبكة — المحاولة دي مااتحسبتش عند السيرفر، فنصفّر العدّاد */
        .catch(function () {
          state.tries = 0; strikeReset(); paintPad(false); down('الدخول');
        });
    });

    document.getElementById('gtForgot').onclick = function () { forgot(); };
    document.getElementById('gtBack').onclick = function () { welcome(); };
  }

  /* ⛌ السيرفر قال «الكود مطلوب»؟ — الباك بيرجّعها 401 + why:need_code.
     📌 لو الباك غيّر الاسم، زيده هنا. */
  function needCode(d) {
    if (!d) return false;
    if (d.need_code === true) return true;
    var w = String(d.why || '');
    return w === 'need_code' || w === 'code_required' || w === 'challenge'
        || w === 'need_email' || w === 'need_challenge';
  }

  /* 📌 كام محاولة في **نافذة الدقيقة** فاضلة — الباك بيبعتها في
     attempts_left. لو مش موجودة بنحسبها عندنا. */
  function winLeft(d, tries) {
    var v = d && (d.attempts_left != null ? d.attempts_left : null);
    if (v == null || isNaN(v)) return Math.max(0, STRIKE_LIMIT - (tries || 0));
    return Math.max(0, Number(v));
  }

  /* ═══════════════════════════════════════════════════════════
     ④ نسيت الباسورد
     ───────────────────────────────────────────────────────────
     📌 القاعدة الجديدة غيّرته — بقى في استرجاع بالكود.
        الكلام القديم كان «مافيش استرجاع» واللي فاتح من ساعتها.
     ═══════════════════════════════════════════════════════════ */
  function forgot() {
    stopLock();
    state.pin = ''; state.len = PIN_LEN;
    head('نسيت كلمة المرور', 1);
    boxEl().className = 'gt-box';
    formEl().innerHTML =
      '<div class="gt-ico">🔑</div>' +
      '<h1 class="gt-h">بنسلّك من غير الباسورد</h1>' +
      '<div class="gt-txt left">' +
        'الطريقة الوحيدة: <b>كود على الإيميل</b>.<br>' +
        'اكتب إيميلك المسجّل وهنعتلك كود من ٦ أرقام،' +
        ' تكتبه وتختار ٤ أرقام جديدة تدخل بيها من هنا.<br><br>' +
        '<b>الإيميل لوحده مش بيفتح</b> — لازم الكود اللي جالك' +
        ' في بريدك كمان. عشان كده لو حد غيرك فتح إيميلك' +
        ' ميقدرش ياخد حسابك بنفسه.' +
      '</div>' +
      '<button class="gt-go" id="gtChGo" type="button">ابعتلي كود على الإيميل</button>' +
      '<button class="gt-go alt" id="gtNewAcc" type="button">عمل حساب جديد</button>' +
      '<button class="gt-back" id="gtBack3" type="button">رجوع للدخول</button>';

    var cg = document.getElementById('gtChGo');
    if (cg) cg.onclick = function () { askCode(); };
    document.getElementById('gtNewAcc').onclick = function () { signup(); };
    document.getElementById('gtBack3').onclick = function () { login(); };
  }

  /* ═══════════════════════════════════════════════════════════
     ⑤ شاشة طلب الكود — إيميل واحد وزرار
     ───────────────────────────────────────────────────────────
     ⛔⛔⛔ الرد المحايد شرط أمني مش ذوق:
        · الإيميل مسجّل     -> 200 «لو الإيميل ده بتاعك...»
        · الإيميل مش مسجّل  -> 200 **بالنص نفسه** ومفيش إرسال
        ⛔ ممنوع نميّز بين اتنين — لا في الواجهة ولا في الباك.
           أي كلمة زي «الإيميل ده مش مسجّل» بتبقى قناة مفتوحة
           نبني بيها قاموس بالمحاولات ونعرف مين عندنا حساب.
     ═══════════════════════════════════════════════════════════ */
  function askCode() {
    stopLock();
    state.pin = ''; state.len = PIN_LEN; flow.tries = 0;
    mount();
    head('محاولات كتيرة', 1, function () { login(); });
    boxEl().className = 'gt-box code card';
    formEl().innerHTML =
      '<div class="gt-ico">🔑</div>' +
      '<div class="gt-alert">⚠️ محاولات كتيرة</div>' +
      '<h1 class="gt-h">هنبعتلك كود على الإيميل المسجّل</h1>' +
      '<p class="gt-sub2">بعد ٣ محاولات غلط ورا بعض — ودي أأمن من إنك تضل تخمّن</p>' +
      '<label class="gt-lb" for="gtChMail">إيميلك المسجّل</label>' +
      '<input id="gtChMail" class="gt-in" type="email" dir="ltr" maxlength="120" ' +
        'autocomplete="email" inputmode="email" placeholder="name@mail.com">' +
      '<div class="gt-msg" id="gtMsg"></div>' +
      '<button class="gt-go" id="gtChSend" type="button">ابعت الكود</button>' +
      '<button class="gt-back" id="gtChBack" type="button">رجوع للدخول</button>';

    var btn = document.getElementById('gtChSend');
    var mail = document.getElementById('gtChMail');

    function send() {
      var v = (mail.value || '').trim();
      /* ⛌ فحص الشكل بس — مش وجود الإيميل. وجوده الباك هو اللي
         بيحكم فيه، وهو اللي بيرد المحايد. */
      if (!v) { say('اكتب إيميلك الأول', false); return; }
      if (v.indexOf('@') < 1 || v.indexOf('.') < 1) { say('شكل الإيميل غلط', false); return; }
      if (btn) { btn.disabled = true; btn.textContent = '⏳ بنعت...'; }
      clearMsg();

      post(PATHS.send, { email: v })
        .then(function (o) {
          if (o.s === 200) {
            /* ⛔⛔ نفس الشاشة ونفس الكلام — مسجّل أو لأ. */
            flow.email = v;
            codeEntry();
            return;
          }
          /* ⛔ 429 → الزر يفضل مقفول طول العدّاد (sayRate بيفتحه). */
          if (o.s === 429) { sayRate(o.d); return; }
          if (btn) { btn.disabled = false; btn.textContent = 'ابعت الكود'; }
          if (o.s === 400) { say('❌ ' + ((o.d && o.d.error) || 'شكل الإيميل غلط'), false); return; }
          /* ⛔⛔ أي حاجة تانية (404/409/500): مفيش كلام يبوّح إن
             الإيميل مسجّل ولا لأ. رسالة عامة وخلاص. */
          say('❌ مش قادرين نبعت الكود دلوقتي — جرّب بعد شوية', false);
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = 'ابعت الكود'; }
          say('❌ مش قادرين نوصل للسيرفر', false);
        });
    }

    /* 📌 429 — حد الإرسال (٣ أكواد للإيميل في اليوم) أو حد الـIP.
       ⛔ العدّاد بييجي من السيرفر مش متخيّنين. */
    function sayRate(d) {
      var s2 = Math.max(1, Number((d && (d.retry_after || d.retry)) || 0) || 900);
      if (btn) { btn.disabled = true; btn.textContent = '⏔ استنى'; }
      var m = document.getElementById('gtMsg');
      if (!m) return;
      m.className = 'gt-msg no';
      m.innerHTML = '⏔ استنى شوية واطلب تاني' +
        ' <span class="gt-cd" id="gtRateCd">(' + mm(s2) + ')</span>';
      var t = setInterval(function () {
        s2--;
        var c = document.getElementById('gtRateCd');
        if (s2 <= 0) {
          clearInterval(t);
          if (btn) { btn.disabled = false; btn.textContent = 'ابعت الكود'; }
          m.innerHTML = '⏔ خلص الوقت — تقدر تطلب تاني';
          return;
        }
        if (c) c.textContent = '(' + mm(s2) + ')';
      }, 1000);
    }

    if (btn) btn.onclick = send;
    if (mail) mail.onkeydown = function (e) { if (e.key === 'Enter') send(); };
    document.getElementById('gtChBack').onclick = function () { login(); };
    setTimeout(function () { if (mail) mail.focus(); }, 60);
  }

  /* ═══════════════════════════════════════════════════════════
     ⑥ شاشة كتابة الكود — ٦ خانات وعدّاد صلاحية
     ═══════════════════════════════════════════════════════════ */
  function codeEntry() {
    stopLock();
    state.pin = ''; state.len = CODE_LEN; flow.tries = 0;
    mount();
    /* 📌 رجوع وإرسال ⬇️ حسب إحنا في «تسجيل» ولا «استرجاع» */
    var reg = (s.mode === 'signup');
    head(reg ? 'كود التأكيد' : 'كود الدخول', 1, function () {
      if (reg) { signup(); } else { askCode(); }
    });
    boxEl().className = 'gt-box code';
    formEl().innerHTML =
      '<div class="gt-ico">📩</div>' +
      '<h1 class="gt-h">اكتب الكود اللي جالك</h1>' +
      '<p class="gt-txt">' + (reg ? esc(esc(NOTE_SAME) + ' — ده كود إنشاء حسابك') : esc(NOTE_SAME)) + '</p>' +
      codeHtml() +
      '<p class="gt-cdt" id="gtCd">⏱ الكود صالح <b id="gtCdN">' + mm(CODE_TTL) + '</b></p>' +
      padHtml(0) +
      '<button class="gt-back" id="gtChAgain" type="button">' +
        (reg ? 'ارجع — عدّل الإيميل' : 'ارجع — اكتب إيميل تاني') + '</button>';

    var back = document.getElementById('gtChAgain');
    if (back) back.onclick = function () { if (reg) { signup(); } else { askCode(); } };

    startCd();

    onPad(function (v) {
      paintPad(true);
      clearMsg();
      post(reg ? SIGNUP.verify : PATHS.verify, { email: flow.email, code: v })
        .then(function (o) {
          var d = o.d || {};
          if (o.s === 200) {
            /* 📌 ده **تروكن فتح** مش توكن جلسة — الباك بيوقّعه
               بمفتاح تاني و require_user() بيرفضه. عمره ١٠ دقايق
               واستعمال واحد. التوكن مش بيتسلّمش غير لما المستخدم
               يختار الباسورد الجديد. */
            flow.unlock = d.unlock || d.ticket || '';
            flow.code = v;
            state.pin = '';
            paintCode();
            newPin();
            return;
          }
          if (o.s === 429) {
            if (String(d.why || '') === 'too_many_wrong') {
              codeDead('⛔ الكود اتقفل — اطلب كود جديد');
              return;
            }
            locked(d.retry_after || d.retry || 60);
            return;
          }
          /* ⛔⛔ 401 = رد واحد في كل الأحوال: كود غلط · كود منتهي ·
             مفيش كود · الإيميل مش مسجّل. الباك مش بيفرّق — والواجهة
             كمان مش هتفرّق. بنورّي كلامه هو (فيه «اطلب كود جديد»)
             وعدّاد المحاولات بيتحسب عندنا. */
          if (o.s === 401 || o.s === 400) { codeWrong(d); return; }
          codeDead('❌ مش قادرين نكمّل — اطلب كود جديد');
        })
        .catch(function () {
          paintPad(false);
          say('❌ مش قادرين نوصل للسيرفر', false);
        });
    });
  }

  /* 📌 الكود غلط أو منتهي — الرد واحد في الحالتين.
     📌 العدّاد بيكمل طول ما الكود حي؛ ولما يوصل ٥ غلط (نفس
        PIN_CHAL_WRONG بتاع الباك) نقفل الشاشة ونقول «اطلب جديد». */
  function codeWrong(d) {
    flow.tries++;
    var left = Math.max(0, CODE_TRIES - flow.tries);
    state.pin = '';
    paintCode();
    paintPad(false);
    shakeCode();
    if (left <= 0) { codeDead('⛔ الكود اتقفل — اطلب كود جديد'); return; }
    var t = String((d && d.error) || 'الكود غلط');
    if (left === 1) say('❌ ' + t + ' — آخر محاولة', false);
    else say('❌ ' + t + ' — فاضل ' + left + ' محاولات', false);
  }

  /* 📌 الكود مات — الشاشة بتقف واللوحة بتقفل، وزرار الرجوع
     بيفتح شاشة طلب كود جديد من الأول. */
  function codeDead(msg) {
    stopCd();
    state.pin = '';
    paintCode();
    paintPad(true);
    say(msg, false);
    var b = document.getElementById('gtChAgain');
    if (b) b.textContent = 'اطلب كود جديد';
  }

  /* 📌 عدّاد صلاحية الكود — 10:00 ينزل لحد 00:00 */
  function startCd() {
    stopCd();
    flow.cd = CODE_TTL;
    var n0 = document.getElementById('gtCdN');
    if (n0) n0.textContent = mm(flow.cd);
    flow.cdTimer = setInterval(function () {
      flow.cd--;
      var num = document.getElementById('gtCdN');
      if (flow.cd <= 0) {
        stopCd();
        if (num) num.textContent = '00:00';
        codeDead('⏰ الكود خلصت صلاحيته — اطلب كود جديد');
        return;
      }
      if (num) num.textContent = mm(flow.cd);
    }, 1000);
  }

  /* ═══════════════════════════════════════════════════════════
     ⑦ شاشة اختيار الباسورد الجديد
     ───────────────────────────────────────────────────────────
     ⛔⛔⛔ مفيش أي شاشة «تم الدخول» هنا. التوكن بييجي من طلب واحد
        بعد ما الـ4 أرقام يتقبلوا، ومفيش طريق تاني يفتح الموقع.
     ═══════════════════════════════════════════════════════════ */
  function newPin() {
    stopLock();
    var reg = (s.mode === 'signup');
    state.pin = ''; state.len = PIN_LEN;
    mount();
    head(reg ? 'اختار باسورد' : 'اختار باسورد جديد', 1, function () {
      if (reg) { codeEntry(); } else { login(); }
    });
    boxEl().className = 'gt-box pin';
    formEl().innerHTML =
      '<div class="gt-ico">🔐</div>' +
      '<h1 class="gt-h">' + (reg ? 'اختار ٤ أرقام' : 'اختار ٤ أرقام جديدة') + '</h1>' +
      '<p class="gt-sub2">' +
        (reg ? 'دي اللي هتدخل بيه من هنا ⬇️ من غيرها مفيش دخول'
             : 'دي اللي هتدخل بيه من هنا') + '</p>' +
      padHtml(0) +
      '<button class="gt-back" id="gtNpBack" type="button">رجوع</button>';

    document.getElementById('gtNpBack').onclick = function () {
      if (reg) { codeEntry(); } else { login(); }
    };

    onPad(function (v) {
      paintPad(true);
      clearMsg();
      /* 📌 تروكن الفتح في هيدر Authorization (مش في الـbody) —
         زي ما الباك بيقرا (_bearer). والـbody فيه new_pin بس. */
      postAuth(reg ? SIGNUP.newpin : PATHS.newpin, { new_pin: v }, flow.unlock)
        .then(function (o) {
          var d = o.d || {};
          if (o.s === 200 && d.token) {
            /* ⛔⛔ اللحظة الوحيدة اللي فيها توكن — بعد ما ٤ أرقام
               جديدة اتقبلت. قبل كده مافيش توين خالص. */
            var who = (reg ? s.email : flow.email);
            wipeFlow();
            try { octaTrack(reg ? 'signup' : 'pin_reset', 'gate', ''); } catch (e) { }
            put(d.token, d.user);
            if (reg) { done(who); } else { shut(); }
            return;
          }
          state.pin = '';
          paintDots();
          if (o.s === 409 || d.why === 'pin_taken') {
            /* ⛌ 409 → اللوحة فاضية تاني والمستخدم يختار غيره */
            paintPad(false);
            say('❌ الباسورد ده مستخدم من قبل — اختار غيره', false);
            shake();
            return;
          }
          if (o.s === 400) {
            paintPad(false);
            say('❌ ' + (d.error || 'الباسورد لازم يكون ٤ أرقام'), false);
            shake();
            return;
          }
          if (o.s === 429) { locked(d.retry_after || d.retry || 60); return; }
          if (o.s === 401) {
            /* ⛔ تروكن الفتح خلص (عمره ١٠ دقايق) — نبدأ من الأول */
            wipeFlow();
            askCode();
            return;
          }
          if (o.s === 404) {
            wipeFlow();
            paintPad(false);
            say('❌ الحساب مش موجود — ابدأ من الأول', false);
            return;
          }
          wipeFlow();
          paintPad(false);
          say('❌ مش قادرين نكمّل — جرّب تاني', false);
        })
        .catch(function () {
          state.pin = ''; paintDots(); paintPad(false);
          down('تغيير الباسورد');
        });
    });
  }

  /* ═══ «أريد مساعدة» — صفحة مساعدة جوه البوابة ═══ */
  function help() {
    stopLock();
    head('مساعدة', 1);
    boxEl().className = 'gt-box';
    formEl().innerHTML =
      '<div class="gt-ico">💡</div>' +
      '<h1 class="gt-h">محتاج مساعدة؟</h1>' +
      '<div class="gt-txt left">' +
        '• <b>الباسورد</b> هو الـ4 أرقام اللي انت اخترتها أول مرة — من غيرهم مفيش دخول<br>' +
        '• <b>مفيش إيميل</b> في شاشة الدخول — الباسورد هو كل حاجة<br>' +
        '• <b>نسيت الـ4 أرقام؟</b> ابعت كود على إيميلك المسجّل واختار ٤ جديدة<br>' +
        '• <b>3 غلط ورا بعض جوه دقيقة</b> يطلبوا كود على الإيميل — وده بيحميك<br>' +
        '• <b>القفل</b> بيقفل ١٥ دقيقة بعد ٥ محاولات غلط — وبعدها ساعة' +
      '</div>' +
      '<button class="gt-go" id="gtBackH" type="button">فهمت — ارجع</button>';

    document.getElementById('gtBackH').onclick = function () {
      if (boxEl().className.indexOf('pin') !== -1) login(); else welcome();
    };
  }

  /* ═══ تغيير الباسورد — للحساب القايم (من الإعدادات) ═══
     بيبعت /api/auth/pin/change والتوكن بيتلزق من octa-api.js */
  function pinStep(title, hint) {
    stopLock();
    state.pin = ''; state.len = PIN_LEN;
    mount();
    head(title, 1);
    boxEl().className = 'gt-box';
    formEl().innerHTML =
      '<p class="gt-txt">' + hint + '</p>' +
      padHtml(0) +
      '<button class="gt-back" id="gtBackC" type="button">رجوع</button>';
    var b = document.getElementById('gtBackC');
    if (b) b.onclick = function () { welcome(); };
  }

  function changePin() {
    pinStep('تغيير الباسورد', 'اكتب الباسورد القديم — 4 أرقام');
    onPad(function (oldPin) {
      paintPad(true);
      clearMsg();
      state.jump = setTimeout(function () {
        pinStep('الباسورد الجديد', 'اكتب الـ4 أرقام الجديدة');
        onPad(function (newPin) {
          paintPad(true);
          post('/api/auth/pin/change', { old_pin: oldPin, new_pin: newPin })
            .then(function (o) {
              if (o.s === 200 && o.d && (o.d.ok || o.d.token)) {
                if (o.d.token) put(o.d.token, o.d.user);
                shut();
                return;
              }
              state.pin = ''; paintDots(); paintPad(false);
              say('❌ ' + ((o.d && o.d.error) || 'الباسورد القديم غلط'), false);
            })
            .catch(function () { state.pin = ''; paintDots(); paintPad(false); down('التغيير'); });
        });
      }, 500);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     🔄 مزامنة النسخة — تحلّ مشاكل «التباب القديم»
     ───────────────────────────────────────────────────────────
     ⛔ التابات القديمة في المتصفح بتفضل شغالة بالكود القديم
        (نفس الـDOM ونفس الـJavaScript) حتى بعد النشر. المستخدم
        يشوف رسالة من يوم فاتت ويحس إن الموقع باظ.
        ⛌ بنخزّن رقم النسخة، ولو اختلف → إعادة تحميل واحدة.
     ═══════════════════════════════════════════════════════════ */
  function syncBuild() {
    try {
      var me = document.currentScript;
      var v = (me && me.src || '').split('v=')[1] || '';
      if (!v) v = String(Date.now()).slice(0, 6);
      var prev = localStorage.getItem('octa_build_v');
      if (prev && prev !== v) {
        localStorage.setItem('octa_build_v', v);
        sessionStorage.setItem('octa_reloaded', v);
        location.reload();
        return;
      }
      localStorage.setItem('octa_build_v', v);
      sessionStorage.setItem('octa_reloaded', v);
    } catch (e) { }
  }
  syncBuild();

  /* ═══════════════════════════════════════════════════════════
     ⏰ التجديد الصامت — كل ساعتين بالظبط
     ───────────────────────────────────────────────────────────
     ⛔⛔⛔ صفر شاشات · صفر spinner · صفر إشعار · صفر طلب باسورد.
        المستخدم ميفحشش عن حاجة. الهدف إن الجلسة ما تقطعش
        وهو قاعد يقرأ.
     📌 التوكن الجديد بيتخزّن في نفس الاسم octa_token — زي النظام.
     ⛔⛔ ممنوع أي حاجة تانية تتخزّن: لا باسورد ولا كود إيميل
        ولا بصمة. المتصفح بيخزّن التّوكن بس.
     ⛔ مافيش مؤقّت جلسات في الواجهة — ما فيش شاشة بتقفل بعد
        وقت معيّن. البوابة بتظهر بس لما السيرفر يرفض التوكن.
     ═══════════════════════════════════════════════════════════ */
  var renewAt = 0;
  var renewTimer = null;
  var renewMs = RENEW_FALLBACK_MS;   /* بيتحدّث من expires_in كل مرة */

  function renew() {
    /* ⛔ مفيش توكن = مفيش حاجة نعملها — ونتقفل بهدوء */
    if (!token()) return Promise.resolve({ s: 0, d: {} });
    renewAt = Date.now() + renewMs;

    /* 📌 POST /api/auth/refresh — التوكن القديم بس.
       ⛔ الـbody فاضي عن قصد: الباك بيرفض أي credential فيه بـ401. */
    return postAuth(RENEW_PATH, {}, token()).then(function (o) {
      if (o.s === 200) {
        /* 📌 لو رجّع توكن جديد → نحدّثه بصمت. */
        if (o.d && o.d.token) {
          put(o.d.token, o.d.user);
          /* ⛔ الجدولة بتتبع السيرفر دايماً — لو غيّر عمر التوكن
             من غير ما نعرف، هنمشي معاه. */
          renewMs = renewDelayMs(o.d.expires_in);
          clearInterval(renewTimer); renewTimer = null;
          renewEvery();
        }
        return o;
      }
      if (o.s === 401 || o.s === 400) {
        /* ⛔ التوكن مش صالح خلاص → البوابة. بس كده. */
        logoutLocal();
        wipeFlow();
        welcome();
        open();
        return o;
      }
      /* ⛔ خطأ شبكة أو 500 — مش هنقفل حاجة على المستخدم؛
         هنجرّب تاني بعد نفس المدة. */
      return o;
    }).catch(function () { return { s: 0, d: {} }; });
  }

  /* 📌 المجدول — بيتحسب من expires_in اللي الباك رجّعه. */
  function renewEvery() {
    if (renewTimer) clearInterval(renewTimer);
    renewAt = Date.now() + renewMs;
    renewTimer = setInterval(function () { renew(); }, renewMs);
  }

  /* ═══════════════════════════════════════════════════════════
     ⏱ نافذة الخمول — ٣٠ دقيقة من غير ما يلمس الموقع
     ───────────────────────────────────────────────────────────
     ⛔⛔⛔ دي **خامل (idle) في المتصفح** — مش تروكن بصري ومش وقت
        HTTP. بتتحسب من **آخر لمسة**: ماوس · لمس · ضغط · كتابة ·
        scroll. مش من وقت فتح الصفحة.
     ⛌ mousemove لوحده بيحصل أثناء القراءة العادية — فمفيش إزعاج
        للمستخدم اللي قاعد يقرأ من غير ما يحرّك إيده.
     ⛔⛔/browser ما فتحش الموقع تاني خالص → ما ينفعش نقفل حاجة
        أصلاً. القفل بيحصل أول ما يرجع.
     ═══════════════════════════════════════════════════════════ */
  var lastTouch = Date.now();
  function touch() { lastTouch = Date.now(); }
  ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel']
    .forEach(function (ev) {
      try { document.addEventListener(ev, touch, { passive: true }); } catch (e) { }
    });

  function idleCheck() {
    /* ⛔ مفيش توكن (في البوابة دلوقتي) → مافيش قفل */
    if (!token()) { lastTouch = Date.now(); return; }
    if (Date.now() - lastTouch <= IDLE_MS) return;
    /* ⛔ عدّى نص ساعة خامل → البوابة. التوكن يتمسح. */
    logoutLocal();
    wipeFlow();
    lastTouch = Date.now();
    welcome();
    open();
  }

  /* 📌 التابات بتجمّد المؤقّتات في الخلفية. أول ما المستخدم يرجع
     للتاب بنشوف: عدّى وقت الخمول ولا التجديد ولا لأ. بصمت. */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (token() && Date.now() - lastTouch > IDLE_MS) { idleCheck(); return; }
    if (Date.now() - renewAt >= 0) renew();
  });

  setInterval(idleCheck, IDLE_TICK);
  renewEvery();

  /* ═══ تشغيل ═══ */
  window.OCTAGate = {
    open: open, shut: shut,
    welcome: welcome, login: login, signup: signup,
    forgot: forgot, help: help, changePin: changePin,
    /* 📌 الشاشتين الجديدتين مفتوحين للاختبار والمعاينة */
    askCode: askCode, codeEntry: codeEntry, newPin: newPin,
    renew: renew, renewEvery: function () { return renewMs; }
  };

  /* ⛔⛌ السيرفر رفض بيانات محمية (401) — يعني التوكن مش صالح.
     ⛌ قبل الكود ده كان الموضوع صامت: الصفحة بتفتح وهي فاضية
        والـuser مبيعرفش إن السبب إن sessionته انتهت.
     ⛌ دلوقتي: نقوله بالظبط ونرجّعه للبابة بدل ما نسيبه قدام
        صفحة صامتة. */
  window.OCTAAuthFail = function (path) {
    /* ⛔⛔⛔ قبل ما نطرد المستخدم: جرّب تجديد صامت مرة واحدة.
       المسارات المحمية بترجّع 401 لو التوكن خلص عمره بالظبط في
       اللحظة دي — وده مش معناه إن الباسورد غلط.
       ⛌ لو التجديد نجح بنكمّل عادي من غير ما نلمس الجلسة. */
    if (window.__octaAuthRetry) return;        /* أثناء المحاولة جاري */
    window.__octaAuthRetry = true;
    try {
      if (typeof renew === 'function' && token()) {
        renew().then(function (o) {
          window.__octaAuthRetry = false;
          if (o && o.s === 200) { try { location.reload(); } catch (e) { } return; }
          showAuthFail(path);
        }).catch(function () { window.__octaAuthRetry = false; showAuthFail(path); });
        return;
      }
    } catch (e) { }
    window.__octaAuthRetry = false;
    showAuthFail(path);
  };

  function showAuthFail(path) {
    if (window.__octaAuthFailShown) return;   /* مرة واحدة بس */
    window.__octaAuthFailShown = true;
    logoutLocal();
    var b = document.getElementById('octaAuthMsg');
    if (!b) {
      b = document.createElement('div');
      b.id = 'octaAuthMsg';
      b.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;'
        + 'align-items:center;justify-content:center;background:rgba(10,14,20,.82);'
        + 'padding:20px;font-family:system-ui,sans-serif';
      b.innerHTML = '<div style="max-width:340px;background:var(--pri2);'
        + 'border:1px solid var(--line);border-radius:16px;padding:26px;'
        + 'text-align:center;color:var(--txt)">'
        + '<div style="font-size:34px">🔑</div>'
        + '<div style="margin:10px 0 6px;font-size:18px;font-weight:700">انتهت جلستك</div>'
        + '<div style="color:var(--muted);font-size:14px;line-height:1.7">'
        + 'حسابك مش متعرّف عليه — ادخل بالباسورد تاني</div>'
        + '<button id="octaAuthAgain" style="margin-top:18px;width:100%;padding:12px;'
        + 'border:0;border-radius:10px;background:var(--gold);color:var(--pri4);'
        + 'font-weight:700;font-size:15px;cursor:pointer">إعادة الدخول</button></div>';
      document.body.appendChild(b);
      var g = document.getElementById('octaAuthAgain');
      if (g) g.onclick = function () {
        try { b.remove(); } catch (e) { }
        window.__octaAuthFailShown = false;
        welcome();
        open();
      };
    }
  };

  window.addEventListener('DOMContentLoaded', function () {
    /* ⛔ localhost ميفتحش البوابة — للتطوير */
    try {
      var h = location.hostname;
      if (h === 'localhost' || h === '127.0.0.1') { shut(); return; }
    } catch (e) { }

    /* ⛌ الترتيب الصح: ارسم ← اقفل ← تحقق.
       البوابة بترسم نفسها الأول — دايماً، قبل أي تحقق. */
    mount();
    welcome();
    open();

    if (token()) {
      pending('⏳ بنتحقق من حسابك…');
      verify();
    }
  });

  /* التأكد إن التوكن لسه صالح — لو مش كده نرجع للبوابة */
  function verify() {
    var t = token();
    if (!t) { welcome(); open(); return; }

    /* ⛌ القاعدة: **شك = مقفول**.
         · 200      → الموقع ينفتح
         · 401/403  → التوكن مش صالح، يتمسح ونرجع للشاشة الأولى
         · 5xx      → السيرفر بيعمل restart — ⛔ ما نمسحش التوكن،
                      نقوله استنى ونعيد المحاولة لوحدنا
         · خطأ شبكة   → نفضل مقفولين ونقوله، ⛔ ما نفتحش أبداً */
    var tries = 0;
    (function ask() {
    fetch(apiBase() + '/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + t }
    }).then(function (r) {
      if (r.ok) {
        shut();
        /* ⛔⛔⛔ الباج اللي كان بيطلّع المستخدم كل ساعتين وهو بيتصفح
           عادي: التوكن عمره ساعتين، والجدولة كانت بتبدأ من وقت فتح
           الصفحة بـ90 دقيقة **بدون ما تعرف الوقت اللي فاضل**.
           يعني: دخلت 10:00 (التوكن يموت 12:00) → عملت refresh 11:20
           → الجدولة اتحطت 12:50 → عند 12:00 التوكن مات وكل
           المسارات المحمية رجّعت 401 → طرد من الحساب.
           ⛌ الحل: أول ما نتحقق من التوكن نجدده فوراً، والباك يرجّع
           expires_in الحقيقي فتصير الجدولة على endowaq fi alhyqiq. */
        renew();
        return;
      }
      /* ⛔⛔⛔ الباج اللي كان بيطرد المستخدم وقت إعادة النشر
         الكود القديم كان بيعمل logoutLocal() عند **أي** رد مش
         200 — فلما السيرفر بيعمل restart ويرد 503 كان بيمسح
         التوكن ويطلّعه على شاشة الدخول. يعني ركلة شبكة واحدة = طرد.
         دلوقتي: التوكن يتمسح عند 401/403 بس (رفض حقيقي)،
         و5xx = السيرفر بيعمل restart → استنى ونعيد المحاولة. */
      if (r.status >= 500) {
        tries++;
        if (tries <= 12) {
          booting(tries);
          setTimeout(ask, 3000 + tries * 1500);
          return;
        }
        down('السيرفر');
        return;
      }
      logoutLocal();
      welcome();
      open();
    }).catch(function () {
      if (document.getElementById('gt-form')) down('السيرفر');
    });
    })();
  }

})();
