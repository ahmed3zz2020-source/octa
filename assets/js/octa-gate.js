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

  /* ═══ تسجيل ═══ */
  function signup() {
    formEl().innerHTML =
      '<input id="gtName" class="gt-in" placeholder="اسمك" maxlength="40" autocomplete="name">' +
      '<input id="gtMail" class="gt-in" type="email" placeholder="إيميلك" maxlength="120" autocomplete="email">' +
      '<input id="gtKey" class="gt-in" type="password" placeholder="كلمة سر (6 حروف على الأقل)" maxlength="80" autocomplete="new-password">' +
      '<div id="gtMsg" class="gt-msg"></div>' +
      '<button class="gt-go" id="gtDo">اعمل حسابي</button>' +
      '<button class="gt-back" id="gtBack">رجوع</button>';

    var key = document.getElementById('gtKey');
    var go = function () {
      var name = document.getElementById('gtName').value.trim();
      var mail = document.getElementById('gtMail').value.trim();
      var k = key.value.trim();

      if (!mail) { say('❌ الإيميل مطلوب', false); document.getElementById('gtMail').focus(); return; }
      if (mail.indexOf('@') < 1 || mail.indexOf('.') < 1) { say('❌ شكل الإيميل غلط', false); return; }
      if (k.length < 6) { say('❌ كلمة السر 6 حروف على الأقل', false); return; }

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
      '<input id="gtMail2" class="gt-in" type="email" placeholder="إيميلك" maxlength="120" autocomplete="email">' +
      '<input id="gtKey2" class="gt-in" type="password" placeholder="كلمة السر" maxlength="80" autocomplete="current-password">' +
      '<div id="gtMsg" class="gt-msg"></div>' +
      '<button class="gt-go" id="gtDo2">ادخل</button>' +
      '<button class="gt-back" id="gtReset">نسيت كلمة السر؟</button>' +
      '<button class="gt-back" id="gtBack2">رجوع</button>';

    var go = function () {
      var mail = document.getElementById('gtMail2').value.trim();
      var k = document.getElementById('gtKey2').value.trim();
      if (!mail || !k) { say('❌ املا الخانتين', false); return; }

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

    // ── عنده توكن؟ يفتح على طول ──
    // بدون ده، أي refresh بيرجّعك لشاشة الدخول
    // حتى لو متسجل دخول فعلاً.
    if (token()) {
      shut();
      verify();
      return;
    }

    welcome();
    open();
  });

  /* التأكد إن التوكن لسه صالح — لو مش كده نرجع للب��ابة */
  function verify() {
    var t = token();
    if (!t) { welcome(); open(); return; }
    fetch(apiBase() + '/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + t }
    }).then(function (r) {
      if (r.status === 401) {
        try {
          localStorage.removeItem('octa_token');
          localStorage.removeItem('octa_user');
          window.OCTA_USER_ID = '';
        } catch (e) { }
        welcome();
        open();
      }
      return null;
    }).catch(function () {
      // ⛔ الشبكة مش متاحة — مش معناها التوكن غلط.
      //    نسيبه زي ما هو وما نعملش logout بالغلط.
    });
  }
})();
