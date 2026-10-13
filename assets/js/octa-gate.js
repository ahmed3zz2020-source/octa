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

  /* 📌 الشريط فوق: عنوان على اليمين + زرار على الشمال */
  function head(title, back) {
    var t = topT(), b = topB();
    if (t) t.textContent = title;
    if (!b) return;
    b.style.visibility = '';
    if (back) {
      b.textContent = 'رجوع';
      b.className = 'gt-top-b bk';
      b.onclick = function () { welcome(); };
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
  var state = { pin: '', lock: 0, tries: 0, lockTimer: null, jump: null };

  function stopLock() {
    if (state.lockTimer) { clearInterval(state.lockTimer); state.lockTimer = null; }
    if (state.jump) { clearTimeout(state.jump); state.jump = null; }
    state.lock = 0;
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
      else if (state.pin.length < PIN_LEN) state.pin += k;
      else return;
      paintDots();
      if (onAny) onAny();
      /* ⛌ 4 أرقام كملوا → يتسلّموا لوحدهم. مفيش زرار «دخول» أصلاً. */
      if (state.pin.length === PIN_LEN && onFull) {
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

  function badPin(left) {
    state.pin = '';
    paintDots();
    shake();
    if (left == null) clearMsg();
    else if (left <= 0) say('الباسورد غلط — المحاولات خلصت', false);
    else if (left === 1) say('الباسورد غلط — آخر محاولة', false);
    else say('الباسورد غلط — فاضل ' + left + ' محاولات', false);
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
    state.pin = ''; state.tries = 0;
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
    state.pin = '';
    mount();
    head('حساب جديد', 1);
    boxEl().className = 'gt-box reg';
    formEl().innerHTML =
      '<label class="gt-lb" for="gtName">اسمك</label>' +
      '<input id="gtName" class="gt-in" placeholder="مثلاً: أحمد" maxlength="40" autocomplete="name">' +
      '<label class="gt-lb" for="gtMail">إيميلك</label>' +
      '<input id="gtMail" class="gt-in" type="email" placeholder="name@mail.com" maxlength="120" autocomplete="email" dir="ltr">' +
      '<p class="gt-sub2">هنبعتلك إيميل تأكيد مرة واحدة — بعد كده الباسورد هو كل حاجة</p>' +
      '<label class="gt-lb">الباسورد <small>4 أرقام</small></label>' +
      padHtml(0) +
      '<button class="gt-go" id="gtDo" type="button" disabled>أنشئ حسابي</button>';

    var btn = document.getElementById('gtDo');
    function syncGo() { if (btn) btn.disabled = state.pin.length !== PIN_LEN; }

    function send() {
      var name = (document.getElementById('gtName').value || '').trim();
      var mail = (document.getElementById('gtMail').value || '').trim();
      if (btn) { btn.disabled = true; btn.textContent = '⏳ بنسجّل…'; }
      paintPad(true);
      clearMsg();

      post('/api/auth/pin/register', { name: name, email: mail, pin: state.pin })
        .then(function (o) {
          if (o.s === 200 && o.d && (o.d.ok || o.d.token)) {
            if (o.d.token) put(o.d.token, o.d.user);
            try { octaTrack('signup', 'gate', ''); } catch (e) { }
            done(mail);
            return;
          }
          state.pin = '';
          paintDots(); paintPad(false); syncGo();
          if (btn) btn.textContent = 'أنشئ حسابي';
          fail(o, 'التسجيل مانفعش — جرّب تاني');
        })
        .catch(function () {
          state.pin = ''; paintDots(); paintPad(false); syncGo();
          if (btn) btn.textContent = 'أنشئ حسابي';
          down('التسجيل');
        });
    }

    function check() {
      if (state.pin.length !== PIN_LEN) return;
      var name = (document.getElementById('gtName').value || '').trim();
      var mail = (document.getElementById('gtMail').value || '').trim();
      if (!name) { bad2('اكتب اسمك الأول'); return; }
      if (!mail) { bad2('اكتب إيميلك'); return; }
      if (mail.indexOf('@') < 1 || mail.indexOf('.') < 1) { bad2('شكل الإيميل غلط'); return; }
      send();
    }
    /* ⛌ الباسورد بسّط بس — نفسه محتاج بيانات، فنفضّه ونرجّع اللوحة شغالة */
    function bad2(t) {
      state.pin = '';
      paintDots(); paintPad(false); syncGo();
      say('❌ ' + t, false);
      shake();
    }

    onPad(check, syncGo);
    if (btn) btn.onclick = function () { if (state.pin.length === PIN_LEN) check(); };

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
  function login() {
    stopLock();
    state.pin = ''; state.tries = 0;
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
            put(o.d.token, o.d.user);
            shut();
            return;
          }
          if (o.s === 429) { locked(o.d.retry_after || o.d.retry || 60); return; }
          /* ⛌ كل حاجة تانية = الباسورد غلط. ما نقولش حاجة عن الحساب. */
          badPin(leftTries(o.d, state.tries));
          paintPad(false);
        })
        /* ⛔ شبكة — المحاولة دي مااتحسبتش عند السيرفر، فنصفّر العدّاد */
        .catch(function () { state.tries = 0; paintPad(false); down('الدخول'); });
    });

    document.getElementById('gtForgot').onclick = function () { forgot(); };
    document.getElementById('gtBack').onclick = function () { welcome(); };
  }

  /* ═══════════════════════════════════════════════════════════
     ④ نسيت الباسورد
     ───────────────────────────────────────────────────────────
     ⛔⛔ حسابات الباسورد **مافيش لها استرجاع** — ده تصميم الباك
        مش نقص في الشاشة:
          · إيميل التأكيد مابقعش فيه الباسورد ولا فيه زرار استرجاع
          · /api/auth/reset بيرجّع كود النظام القديم (key) مش للباسورد
        ⛌ فبنقولها للمستخدم بنص صريح بدل ما نوعده بإيميل مش هيوصله.
        📌 لو الباك ضاف POST /api/auth/pin/reset — السطر الوحيد
           هنا هو اللي هيتغيّر.
     ═══════════════════════════════════════════════════════════ */
  function forgot() {
    stopLock();
    state.pin = '';
    head('نسيت كلمة المرور', 1);
    boxEl().className = 'gt-box';
    formEl().innerHTML =
      '<div class="gt-ico">🔒</div>' +
      '<h1 class="gt-h">مافيش استرجاع للباسورد</h1>' +
      '<div class="gt-txt left">' +
        'حسابك اتفتح بـ<b>٤ أرقام</b> هم المفتاح الوحيد ليه —<br>' +
        'الإيميل اللي بعتناه وقت التسجيل كان <b>تأكيد</b> بس، ومكانش فيه الباسورد،' +
        ' ومكانش فيه زرار «نسيت» جواه.<br><br>' +
        'عشان كده مفيش إيميل استرجاع ولا زرار أرجّعلك الباسورد — ' +
        'وده اللي بيمنع حد يفتح إيميلك ويسرق حسابك.' +
      '</div>' +
      '<button class="gt-go" id="gtNewAcc" type="button">عمل حساب جديد</button>' +
      '<button class="gt-back" id="gtBack3" type="button">رجوع للدخول</button>';

    document.getElementById('gtNewAcc').onclick = function () { signup(); };
    document.getElementById('gtBack3').onclick = function () { login(); };
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
        '• <b>نسيت الـ4 أرقام؟</b> مفيش استرجاع — اعرف حساب جديد<br>' +
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
    state.pin = '';
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

  /* ═══ تشغيل ═══ */
  window.OCTAGate = {
    open: open, shut: shut,
    welcome: welcome, login: login, signup: signup,
    forgot: forgot, help: help, changePin: changePin
  };

  /* ⛔⛌ السيرفر رفض بيانات محمية (401) — يعني التوكن مش صالح.
     ⛌ قبل الكود ده كان الموضوع صامت: الصفحة بتفتح وهي فاضية
        والـuser مبيعرفش إن السبب إن sessionته انتهت.
     ⛌ دلوقتي: نقوله بالظبط ونرجّعه للبابة بدل ما نسيبه قدام
        صفحة صامتة. */
  window.OCTAAuthFail = function (path) {
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
         · أي حاجة تانية → التوكن يتمسح ونرجع للشاشة الأولى
         · خطأ شبكة   → نفضل مقفولين ونقوله، ⛔ ما نفتحش أبداً */
    fetch(apiBase() + '/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + t }
    }).then(function (r) {
      if (r.ok) { shut(); return; }
      logoutLocal();
      welcome();
      open();
    }).catch(function () {
      if (document.getElementById('gt-form')) down('السيرفر');
    });
  }

})();
