/* ══════════════════════════════════════════════════════════════
   🚪 بوابة الدخول
   ──────────────────────────────────────────────────────────────
   المستخدم لازم يسجّل قبل ما يشوف أي حاجة.
   التسجيل = إيميل + كلمة سر.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function apiBase() {
    try { return (typeof OCTA_API !== 'undefined' && OCTA_API) || ''; }
    catch (e) { return ''; }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

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

  function gateEl() { return document.getElementById('gate'); }

  /* حالة الانتظار — ⛌ الكارت الفاضي كان مربك.
     المستخدم بيشوف «بنتحقق» بدل ما يفكر إن الموقع باظ. */
  function pending(msg) {
    var f = document.getElementById('gt-form');
    if (!f) return;
    f.innerHTML = '<div class="gt-wait"><span class="gt-spin"></span>' + msg + '</div>';
    var h = document.getElementById('gt-h');
    if (h) h.textContent = 'أهلاً بعودتك';
  }

  /* ⛌ حزام أمان: لو الفورم اتقفلت لسبب ما، ارسم تاني.
     البوابة بطاقة مالهاش زرار = الموقع ميت. */
  function ensurePainted() {
    var f = document.getElementById('gt-form');
    if (f && !f.innerHTML.trim()) welcome();
  }
  function formEl() { return document.getElementById('gt-form'); }

  function say(t, ok) {
    var m = document.getElementById('gtMsg');
    if (!m) return;
    m.textContent = t;
    m.style.color = ok ? '#22c55e' : '#ef4444';
  }

  function open() {
    var g = gateEl();
    if (g) g.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    /* ⛌ حزام أمان: البوابة من غير زرار = الموقع ميت ومفيش مخرج.
       ⛌ لو الفورم اتقفلت لسبب ما (خطأ في الرسم، تحديث متقطع)
       بنعيد الرسم فوراً. */
    setTimeout(function () {
      var f = document.getElementById('gt-form');
      if (g && g.style.display !== 'none' && (!f || !f.innerHTML.trim())) welcome();
    }, 120);
  }

  function shut() {
    var g = gateEl();
    if (g) g.remove();
    document.body.style.overflow = '';
    try { window.OCTAAuth && window.OCTAAuth.refresh && window.OCTAAuth.refresh(); } catch (e) { }
  }

  /* ═══ الشاشة الأولى: ترحيب + اختيار ═══ */
  function welcome() {
    formEl().innerHTML =
      '<button class="gt-go" id="gtReg">ابدأ — إعمل حساب مجاناً</button>' +
      '<button class="gt-go alt" id="gtLogin">عندك حساب؟ ادخل</button>' +
      '<div id="gtMsg" class="gt-msg"></div>';

    document.getElementById('gtReg').onclick = function () { signup(); };
    document.getElementById('gtLogin').onclick = function () { login(); };
  }

  /* ═══ تسجيل ═══
     📌 خطوتين: الأول اسم وإيميل، والتاني الكود.
     ليه كده؟ الحقول بتتعب بتبقى أسهل من 3 boxes مرة واحدة،
     والمستخدم بيفهم المطلوب منه وهو بيعمل الخطوة.
     ⛌ «الكود» مش كلمة سر — هو رقم يتحفظ في الـbrowser.
  */
  function signup() {
    formEl().innerHTML =
      '<label class="gt-lb">اسمك</label>' +
      '<input id="gtName" class="gt-in" placeholder="مثلاً: أحمد" maxlength="40" autocomplete="name">' +
      '<label class="gt-lb">إيميلك</label>' +
      '<input id="gtMail" class="gt-in" type="email" placeholder="example@mail.com" maxlength="120" autocomplete="email" dir="ltr">' +
      '<div class="gt-split" id="gtStep2" style="display:none">' +
        '<label class="gt-lb">اختار كود من 6 أرقام <small>ده اللي هتدخل بيه بعد كده</small></label>' +
        '<div class="gt-codes" id="gtCodes"></div>' +
        '<input id="gtKey" class="gt-in gt-code-in" placeholder="······" maxlength="6" inputmode="numeric" autocomplete="off">' +
      '</div>' +
      '<div id="gtMsg" class="gt-msg"></div>' +
      '<button class="gt-go" id="gtDo">التالي</button>' +
      '<button class="gt-back" id="gtBack">رجوع</button>';

    var key = document.getElementById('gtKey');
    var step = 1;

    /* ⛌ مفيش توليد على السيرفر — الكود بيختاره المستخدم.
       ⛌ مش بنطلب «اختار كلمة سر» — كلمة سر معناها إن حد بيفتكرها
       بعد سنة. كود 6 أرقام أسهل بكتير وأمانه أعلى لوحده. */
    function paintCodes() {
      var box = document.getElementById('gtCodes');
      box.innerHTML = '';
      for (var i = 0; i < 3; i++) {
        var c = String(Math.floor(100000 + Math.random() * 900000));
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'gt-pick'; b.textContent = c;
        b.onclick = function (e) {
          key.value = e.target.textContent;
          box.querySelectorAll('.gt-pick').forEach(function (x) { x.classList.remove('on'); });
          e.target.classList.add('on');
        };
        box.appendChild(b);
      }
    }
    paintCodes();

    var go = function () {
      var name = document.getElementById('gtName').value.trim();
      var mail = document.getElementById('gtMail').value.trim();
      var k = key.value.trim();
      var btn = document.getElementById('gtDo');

      if (step === 1) {
        if (!name) { say('❌ اكتب اسمك الأول', false); document.getElementById('gtName').focus(); return; }
        if (!mail) { say('❌ الإيميل مطلوب', false); document.getElementById('gtMail').focus(); return; }
        if (mail.indexOf('@') < 1 || mail.indexOf('.') < 1) { say('❌ شكل الإيميل غلط', false); return; }
        step = 2;
        document.getElementById('gtStep2').style.display = 'block';
        btn.textContent = 'اعمل حسابي';
        say('اختار كود أو اكتبه بنفسك — 6 أرقام', true);
        key.focus();
        return;
      }

      if (!/^\d{6}$/.test(k)) { say('❌ الكود 6 أرقام', false); key.focus(); return; }

      go.disabled = true; go.textContent = '⏳ بنعمل حسابك…';
      fetch(apiBase() + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || 'مستخدم', key: k, email: mail })
      }).then(function (r) { return r.json().then(function (d) { return { d: d }; }); })
        .then(function (o) {
          if (o.d && o.d.ok) {
            put(o.d.token, o.d.user);
            try { octaTrack('signup', 'gate', ''); } catch (e) { }
            shut();
          } else {
            say('❌ ' + ((o.d && o.d.error) || 'حصل خطأ'), false);
            go.disabled = false; go.textContent = 'اعمل حسابي';
            step = 2;
          }
        }).catch(function () {
          say('❌ الاتصال فشل — جرب تاني', false);
          go.disabled = false; go.textContent = 'اعمل حسابي';
        });
    };

    document.getElementById('gtDo').onclick = go;
    document.getElementById('gtBack').onclick = welcome;
    key.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    setTimeout(function () { document.getElementById('gtName').focus(); }, 60);
  }

  /* ═══ دخول ═══ */
  function login() {
    formEl().innerHTML =
      '<label class="gt-lb">إيميلك</label>' +
      '<input id="gtMail2" class="gt-in" type="email" placeholder="example@mail.com" maxlength="120" autocomplete="email" dir="ltr">' +
      '<label class="gt-lb">الكود <small>6 أرقام — اللي اخترته أول مرة</small></label>' +
      '<input id="gtKey2" class="gt-in gt-code-in" placeholder="······" maxlength="6" inputmode="numeric" autocomplete="one-time-code">' +
      '<div id="gtMsg" class="gt-msg"></div>' +
      '<button class="gt-go" id="gtDo2">ادخل</button>' +
      '<button class="gt-back" id="gtReset">نسيت الكود؟</button>' +
      '<button class="gt-back" id="gtBack2">رجوع</button>';

    var go = function () {
      var mail = document.getElementById('gtMail2').value.trim();
      var k = document.getElementById('gtKey2').value.trim();
      if (!mail) { say('❌ الإيميل مطلوب', false); return; }
      if (!/^\d{6}$/.test(k)) { say('❌ الكود 6 أرقام', false); return; }

      go.disabled = true; go.textContent = '⏳ بنتحقق…';
      fetch(apiBase() + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'x', key: k, email: mail })
      }).then(function (r) { return r.json().then(function (d) { return { d: d }; }); })
        .then(function (o) {
          if (o.d && o.d.ok) {
            put(o.d.token, o.d.user);
            try { octaTrack('login', 'gate', ''); } catch (e) { }
            shut();
          } else {
            say('❌ ' + ((o.d && o.d.error) || 'الإيميل أو كلمة السر غلط'), false);
            go.disabled = false; go.textContent = 'ادخل';
          }
        }).catch(function () {
          say('❌ الاتصال فشل — جرب تاني', false);
          go.disabled = false; go.textContent = 'ادخل';
        });
    };

    document.getElementById('gtDo2').onclick = go;
    document.getElementById('gtReset').onclick = forgot;
    document.getElementById('gtBack2').onclick = welcome;
    document.getElementById('gtKey2').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    setTimeout(function () { document.getElementById('gtMail2').focus(); }, 60);
  }

  /* ═══ نسيت كلمة السر ═══ */
  function forgot() {
    formEl().innerHTML =
      '<p class="gt-txt">اكتب إيميلك وهنبعتلك كود على طول</p>' +
      '<input id="gtMail3" class="gt-in" type="email" placeholder="إيميلك" maxlength="120">' +
      '<div id="gtMsg" class="gt-msg"></div>' +
      '<button class="gt-go" id="gtSend">ابعت الكود</button>' +
      '<div id="gtStep2" style="display:none">' +
        '<input id="gtCode" class="gt-in" placeholder="الكود (6 أرقام)" maxlength="6" inputmode="numeric">' +
        '<input id="gtNew" class="gt-in" type="password" placeholder="كلمة السر الجديدة" maxlength="80">' +
        '<button class="gt-go" id="gtSave">غيّر كلمة السر</button>' +
      '</div>' +
      '<button class="gt-back" id="gtBack3">رجوع</button>';

    document.getElementById('gtBack3').onclick = login;

    document.getElementById('gtSend').onclick = function () {
      var m = document.getElementById('gtMail3').value.trim();
      if (!m) { say('❌ اكتب الإيميل', false); return; }
      fetch(apiBase() + '/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: m })
      }).then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok) {
            say('✅ ' + (d.msg || 'تم'), true);
            document.getElementById('gtStep2').style.display = 'block';
            document.getElementById('gtSend').style.display = 'none';
            document.getElementById('gtCode').focus();
          } else {
            say('❌ ' + ((d && d.error) || 'حصل خطأ'), false);
          }
        }).catch(function () { say('❌ الاتصال فشل', false); });
    };

    document.getElementById('gtSave').onclick = function () {
      var m = document.getElementById('gtMail3').value.trim();
      var c = document.getElementById('gtCode').value.trim();
      var n = document.getElementById('gtNew').value.trim();
      if (!c || c.length !== 6) { say('❌ الكود 6 أرقام', false); return; }
      if (n.length < 6) { say('❌ كلمة السر الجديدة قصيرة', false); return; }

      fetch(apiBase() + '/api/auth/reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: m, code: c, key: n })
      }).then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok) {
            put(d.token, { name: 'مستخدم' });
            shut();
          } else {
            say('❌ ' + ((d && d.error) || 'الكود غلط'), false);
          }
        }).catch(function () { say('❌ الاتصال فشل', false); });
    };
  }

  /* ═══ تشغيل ═══ */
  window.OCTAGate = {
    open: open, shut: shut,
    login: login, signup: signup, welcome: welcome
  };

  window.addEventListener('DOMContentLoaded', function () {
    // ⛔ localhost ميفتحش البوابة — للتطوير
    try {
      var h = location.hostname;
      if (h === 'localhost' || h === '127.0.0.1') {
        shut();
        return;
      }
    } catch (e) { }

    /* ⛌ البوابة بترسم نفسها الأول — دايماً، قبل أي تحقق.
       الكود كان بيعمل open() وبعدين verify() من غير ما يستدعي
       welcome() — فأي حد عنده توكن (قديم أو مزوّر) كان بيشوف كارت
       فاضي من غير زرار واحد: البوابة مفتوحة، الموقع مقفول،
       ومفيش طريقة يخرج منها.

       ⛌ الترتيب الصح: ارسم ← اقفل ← تحقق. */
    welcome();
    open();

    if (token()) {
      pending('⏳ بنتحقق من حسابك…');
      verify();
    }
  });

  /* التأكد إن التوكن لسه صالح — لو مش كده نرجع للبابة */
  function verify() {
    var t = token();
    if (!t) { welcome(); open(); return; }

    /* ⛌ القاعدة: **شك = مقفول**.
       البوابة مرسومة بالفعل (welcome + open). SERVER يدي واحد:
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
      /* ⛌ ⛌ الشبكة وقعت.
         ⛌ القديم كان بيعمل كاش ساكت — يعني الموقع مفتوح والخسارة.
         ⛌ دلوقتي: نفضل مقفولين ونقوله يعمل refresh. */
      var f = document.getElementById('gt-form');
      if (f) {
        f.innerHTML = '<div class="gt-err">⚠️ مش قادرين نوصل للسيرفر</div>' +
          '<button class="gt-go" id="gtRetry">🔄 جرّب تاني</button>';
        var b = document.getElementById('gtRetry');
        if (b) b.onclick = function () { location.reload(); };
      }
    });
  }

  function logoutLocal() {
    try {
      localStorage.removeItem('octa_token');
      localStorage.removeItem('octa_user');
      window.OCTA_USER_ID = '';
    } catch (e) { }
  }

})();
