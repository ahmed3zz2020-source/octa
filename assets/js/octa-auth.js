/* ══════════════════════════════════════════════════════════════
   👤 الحسابات — واجهة تسجيل الدخول
   ──────────────────────────────────────────────────────────────
   ✅ الموقع كله مفتوح للزوار
   🔒 بس المحفظة والمنبهات ليهم حساب
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function apiBase() {
    try { return (typeof OCTA_API !== 'undefined' && OCTA_API) || ''; }
    catch (e) { return ''; }
  }

  function getToken() {
    try { return localStorage.getItem('octa_token') || ''; } catch (e) { return ''; }
  }

  function setUser(token, user) {
    try {
      localStorage.setItem('octa_token', token);
      localStorage.setItem('octa_user', JSON.stringify(user || {}));
      window.OCTA_USER_ID = (user && user.id) || '';
    } catch (e) { }
  }

  function clearUser() {
    try {
      localStorage.removeItem('octa_token');
      localStorage.removeItem('octa_user');
      window.OCTA_USER_ID = '';
    } catch (e) { }
    location.reload();
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem('octa_user') || 'null'); }
    catch (e) { return null; }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ═══ النافذة ═══ */
  function modal(html) {
    var h = document.createElement('div');
    h.id = 'authHost';
    h.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.76);' +
      'backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:18px';
    h.innerHTML = '<div class="au-box">' + html + '</div>';
    document.body.appendChild(h);

    h.addEventListener('click', function (e) {
      if (e.target === h) h.remove();
    });
    return h;
  }

  function msg(t, ok) {
    var el = document.getElementById('auMsg');
    if (!el) return;
    el.textContent = t;
    el.style.color = ok ? '#22c55e' : '#ef4444';
    el.style.fontSize = '.78rem';
    el.style.marginTop = '9px';
    el.style.lineHeight = '1.7';
  }

  /* ═══ تسجيل / دخول ═══ */
  window.OCTAAuth = {
    user: getUser,
    token: getToken,
    logout: clearUser,

    show: function (mode) {
      var isLogin = mode === 'login';
      var h = modal(
        '<button class="au-x" onclick="document.getElementById(\'authHost\').remove()">✕</button>' +
        '<h2 class="au-h">' + (isLogin ? '🔑 تسجيل الدخول' : '👤 حساب جديد') + '</h2>' +
        '<p class="au-sub">' + (isLogin
          ? 'ادخل الكود بتاعك — نفس الكود اللي سجّلت بيه'
          : 'الكود السري هو اللي بيفتح محفظتك ومنبهاتك. سيبه لو نسيته.') + '</p>' +
        '<input id="auName" class="au-in" placeholder="اسمك (اختياري)" maxlength="40" ' +
        (isLogin ? 'style="display:none"' : '') + '>' +
        '<input id="auKey" class="au-in" type="password" placeholder="الكود السري (6 حروف على الأقل)" maxlength="80">' +
        (isLogin ? '' :
          '<input id="auMail" class="au-in" type="email" placeholder="إيميل (اختياري — لو نسيت الكود)" maxlength="120">') +
        '<div id="auMsg"></div>' +
        '<button class="au-go" id="auGo">' + (isLogin ? 'دخول' : 'أنشئ حسابي') + '</button>' +
        '<div class="au-alt">' + (isLogin
          ? 'ما عندكش حساب؟ <a href="javascript:OCTAAuth.show(\'reg\')">اعمل واحد</a>'
          : 'عندك حساب؟ <a href="javascript:OCTAAuth.show(\'login\')">ادخل</a>') +
        ' · <a href="javascript:document.getElementById(\'authHost\').remove()">إلغاء</a></div>' +
        '<div class="au-note">🔒 الكود بيتخزن مشفّر — مينفعش حد يقراه</div>');

      var go = document.getElementById('auGo');
      var keyIn = document.getElementById('auKey');

      function submit() {
        var key = keyIn.value.trim();
        if (key.length < 6) { msg('❌ الكود 6 حروف على الأقل', false); return; }
        go.disabled = true;
        go.textContent = '⏳ لحظة…';

        var body = { key: key };
        if (!isLogin) {
          body.name = document.getElementById('auName').value.trim();
          var m = document.getElementById('auMail');
          if (m && m.value.trim()) body.email = m.value.trim();
        }

        fetch(apiBase() + '/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }).then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
          .then(function (o) {
            if (o.d && o.d.ok) {
              setUser(o.d.token, o.d.user);
              try { octaTrack('signup', 'auth', ''); } catch (e) { }
              h.remove();
              OCTAAuth.refresh();
            } else {
              msg('❌ ' + ((o.d && o.d.error) || 'حصل خطأ'), false);
              go.disabled = false;
              go.textContent = isLogin ? 'دخول' : 'أنشئ حسابي';
            }
          }).catch(function () {
            msg('❌ الاتصال فشل — حاول تاني', false);
            go.disabled = false;
            go.textContent = isLogin ? 'دخول' : 'أنشئ حسابي';
          });
      }

      go.addEventListener('click', submit);
      keyIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      setTimeout(function () { keyIn.focus(); }, 60);
    },

    /* شريط الحالة — فوق */
    refresh: function () {
      var old = document.getElementById('auBar');
      if (old) old.remove();

      var u = getUser();
      /* ⛌⛌ المستخدم المسجّل: مافيش شريط خالص.
         ⛌ الاسم + «تغيير الكود» + ⚙️ كانوا رجعوا تاني من غير ما نعرف،
         والثلاثة كلهم في مكان واحد (شريط الحساب au-bar).
         مكانهم دلوقتي: لوحة الإعدادات · المزيد · الحساب
         (والخروج «🚪 تسجيل الخروج» موجود هناك كمان — سطر 726). */
      if (u) return;

      var bar = document.createElement('div');
      bar.id = 'auBar';
      bar.className = 'au-bar';
      /* ⛌ «خروج» اتشال من الشريط — مش المكان بتاعه. */
      bar.innerHTML = '<span class="au-dot off"></span>' +
        '<a href="javascript:OCTAAuth.show(\'reg\')">💼 احفظ محفظتك ومنبهاتك</a>';
      document.body.appendChild(bar);
    }
  };

  /* شغّل لما الصفحة تجهز */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.OCTAAuth.refresh(); });
  } else {
    window.OCTAAuth.refresh();
  }
})();
