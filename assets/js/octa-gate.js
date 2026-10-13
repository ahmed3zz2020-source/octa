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

  function errAr(d) {
    var e = (d && d.error) || '';
    if (e === 'rate limit exceeded') {
      var w = (d && d.retry_after) || 60;
      return 'استنى ' + Math.ceil(w / 60) + ' دقيقة وجرب تاني';
    }
    if (e === 'too many') return '📧 بعتّ الكود كتير — استنى شوية';
    if (!e) return 'حصل خطأ';
    return e;
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

    /* ⛔⛔ المحتوى المحمي بيتخطّى وهو لسه بره البوابة (عشان السيرفر
       بيرد 401). البوابة دي بتنطفي من غير reload، فالمحتوى ده
       ميفتحش لوحده. ⛌ الحدث ده بيقول للصفحة: اتأكدت، حمّل دلوقتي. */
    try { document.dispatchEvent(new CustomEvent('octa:authed')); } catch (e) { }
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

  /* ═══ التسجيل ═══
     📌 إيميل → كود في الإيميل → دخول.
     ⛌ مش بنطلب كلمة سر: إثبات إن الإيميل ليك أصعب بكتير
     من إنك تفتكر حاجة اخترتها من زمان.
  */
  function signup() {
    formEl().innerHTML =
      '<label class="gt-lb">اسمك</label>' +
      '<input id="gtName" class="gt-in" placeholder="مثلاً: أحمد" maxlength="40" autocomplete="name">' +
      '<label class="gt-lb">إيميلك</label>' +
      '<input id="gtMail" class="gt-in" type="email" placeholder="example@mail.com" maxlength="120" autocomplete="email" dir="ltr">' +
      '<div id="gtMsg" class="gt-msg"></div>' +
      '<button class="gt-go" id="gtDo">ابعتلي الكود</button>' +
      '<button class="gt-back" id="gtBack">رجوع</button>';

    var go = function () {
      var name = document.getElementById('gtName').value.trim();
      var mail = document.getElementById('gtMail').value.trim();
      var btn = document.getElementById('gtDo');

      if (!mail) { say('❌ الإيميل مطلوب', false); return; }
      if (mail.indexOf('@') < 1 || mail.indexOf('.') < 1) { say('❌ شكل الإيميل غلط', false); return; }

      btn.disabled = true; btn.textContent = '⏳ بنبعت…';
      fetch(apiBase() + '/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mail, name: name || 'مستخدم' })
      }).then(function (r) {
        return r.text().then(function (txt) {
          var d = null; try { d = JSON.parse(txt); } catch (e) { d = null; }
          return { s: r.status, d: d };
        });
      }).then(function (o) {
        if (o.s === 200 && o.d && o.d.ok) { askCode(name, mail, 'حساب جديد'); return; }
        if (o.s === 429) { var w = (o.d && o.d.retry_after) || 60; say('⏳ استنى ' + Math.ceil(w / 60) + ' دقيقة وجرب تاني', false); }
        else say('❌ ' + ((o.d && o.d.error) || ('خطأ ' + o.s)), false);
        btn.disabled = false; btn.textContent = 'ابعتلي الكود';
        return;
      }).catch(function (e) {
        var why = (e && e.message) ? e.message : String(e);
        say('⚠️ مش قادرين نوصل للسيرفر (' + why.slice(0, 55) + ')', false);
        btn.disabled = false; btn.textContent = 'ابعتلي الكود';
      });
    };

    document.getElementById('gtDo').onclick = go;
    document.getElementById('gtBack').onclick = welcome;
    document.getElementById('gtKey')
      && document.getElementById('gtKey').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    setTimeout(function () { document.getElementById('gtName').focus(); }, 60);
  }

  /* ═══ شاشة استقبال الكود ═══ */
  function askCode(name, mail, what) {
    formEl().innerHTML =
      '<div class="gt-sent">📬</div>' +
      '<div class="gt-sent-t">ابعتنا الكود على إيميلك</div>' +
      '<div class="gt-sent-s">' + esc(mail) + '</div>' +
      '<label class="gt-lb">الكود <small>6 أرقام</small></label>' +
      '<input id="gtKey" class="gt-in gt-code-in" placeholder="······" maxlength="6" inputmode="numeric" autocomplete="one-time-code">' +
      '<div id="gtMsg" class="gt-msg"></div>' +
      '<button class="gt-go" id="gtDo">ادخل</button>' +
      '<button class="gt-back" id="gtResend">📩 ابعت تاني</button>' +
      '<button class="gt-back" id="gtBack">رجوع</button>';

    var go = function () {
      var k = document.getElementById('gtKey').value.trim();
      var btn = document.getElementById('gtDo');
      if (!/^\d{6}$/.test(k)) { say('❌ الكود 6 أرقام', false); return; }
      btn.disabled = true; btn.textContent = '⏳ بنتحقق…';
      fetch(apiBase() + '/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mail, code: k, name: name })
      }).then(function (r) { return r.json().then(function (d) { return { d: d, ok: r.ok }; }); })
        .then(function (o) {
          if (o.ok && o.d && o.d.token) {
            put(o.d.token, o.d.user);
            try { octaTrack('signup', 'gate', ''); } catch (e) { }
            shut();
          } else {
            say('❌ ' + ((o.d && o.d.error) || 'الكود غلط'), false);
            btn.disabled = false; btn.textContent = 'ادخل';
            document.getElementById('gtKey').value = '';
          }
        }).catch(function () {
          say('❌ الاتصال فشل — جرب تاني', false);
          btn.disabled = false; btn.textContent = 'ادخل';
        });
    };

    document.getElementById('gtDo').onclick = go;
    document.getElementById('gtBack').onclick = welcome;
    document.getElementById('gtResend').onclick = function () {
      var b = this; b.disabled = true; b.textContent = '⏳…';
      fetch(apiBase() + '/api/auth/otp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mail, name: name || 'مستخدم' })
      }).then(function () { say('✅ بعثنا كود جديد', true); })
        .finally(function () { b.disabled = false; b.textContent = '📩 ابعت تاني'; });
    };
    var k = document.getElementById('gtKey');
    k.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    setTimeout(function () { k.focus(); }, 80);
  }

  /* ═══ دخول ═══ */
  function login() {
    formEl().innerHTML =
      '<label class="gt-lb">إيميلك</label>' +
      '<input id="gtMail2" class="gt-in" type="email" placeholder="example@mail.com" maxlength="120" autocomplete="email" dir="ltr">' +
      '<div id="gtMsg" class="gt-msg"></div>' +
      '<button class="gt-go" id="gtDo2">ابعتلي الكود</button>' +
      '<button class="gt-back" id="gtBack2">رجوع</button>';

    var go = function () {
      var mail = document.getElementById('gtMail2').value.trim();
      var btn = document.getElementById('gtDo2');
      if (!mail) { say('❌ الإيميل مطلوب', false); return; }
      if (mail.indexOf('@') < 1 || mail.indexOf('.') < 1) { say('❌ شكل الإيميل غلط', false); return; }
      btn.disabled = true; btn.textContent = '⏳ بنبعت…';
      fetch(apiBase() + '/api/auth/otp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mail })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.ok) {
          say('❌ ' + errAr(d), false);
          btn.disabled = false; btn.textContent = 'ابعتلي الكود'; return;
        }
        askCode('', mail, 'دخول');
      }).catch(function () {
        say('❌ الاتصال فشل — جرب تاني', false);
        btn.disabled = false; btn.textContent = 'ابعتلي الكود';
      });
    };

    document.getElementById('gtDo2').onclick = go;
    document.getElementById('gtBack2').onclick = welcome;
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
            say('❌ ' + errAr(d), false);
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

  /* ═══════════════════════════════════════════════════════════
     🔄 مزامنة النسخة — تحلّ مشاكل «التباب القديم»
     ───────────────────────────────────────────────────────────
     ⛔⛔ المشكلة: التابات القديمة في المتصفح بتفضل شغالة بالكود القديم
        (نفس الـDOM ونفس الـJavaScript) حتى بعد النشر. المستخدم
        يشوف رسالة من يوم فاتت ويحس إن الموقع باظ.
        ⛌ الحل: بنخزّن رقم النسخة، ولو اختلف → إعادة تحميل واحدة.
        ⛌ «مرة واحدة بس» عشان ما نعملش loop لا نهائي.
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
    login: login, signup: signup, welcome: welcome
  };

  /* ⛔⛌ السيرفر رفض بيانات محمية (401) — يعني التوكن مش صالح.
     ⛔ قبل الكود ده كان الموضوع صامت: الصفحة بتفتح وهي فاضية
        والـuser مبيعرفش إن السبب إن sessionته انتهت.
        ⛌ دلوقتي: نقوله بالظبط ونرجّعه للبابة. */
  window.OCTAAuthFail = function (path) {
    if (window.__octaAuthFailShown) return;   /* مرة واحدة بس */
    window.__octaAuthFailShown = true;
    try { localStorage.removeItem('octa_token'); } catch (e) { }
    try { localStorage.removeItem('octa_user'); } catch (e) { }
    window.OCTA_USER_ID = '';
    try {
      var b = document.getElementById('octaAuthMsg');
      if (!b) {
        b = document.createElement('div');
        b.id = 'octaAuthMsg';
        b.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;'
          + 'align-items:center;justify-content:center;background:rgba(10,14,20,.82);'
          + 'padding:20px;font-family:system-ui,sans-serif';
        b.innerHTML = '<div style="max-width:340px;background:#16202e;border:1px solid #2b3a4f;'
          + 'border-radius:16px;padding:26px;text-align:center;color:#e8edf5">'
          + '<div style="font-size:34px">🔑</div>'
          + '<div style="margin:10px 0 6px;font-size:18px;font-weight:700">انتهت جلستك</div>'
          + '<div style="color:#93a1b5;font-size:14px;line-height:1.7">'
          + 'حسابك مش متعرّف عليه — اعمل دخول تاني من إيميلك</div>'
          + '<button id="octaAuthAgain" style="margin-top:18px;width:100%;padding:12px;'
          + 'border:0;border-radius:10px;background:#d4af37;color:#16202e;font-weight:700;'
          + 'font-size:15px;cursor:pointer">إعادة الدخول</button></div>';
        document.body.appendChild(b);
        var g = document.getElementById('octaAuthAgain');
        if (g) g.onclick = function () { location.href = location.origin + location.pathname + '?r=' + Date.now(); };
      }
    } catch (e) { }
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
