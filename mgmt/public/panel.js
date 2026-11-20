/* ══════════════════════════════════════════════════════════════════════
   🛡️ OCTA-MGMT — لوحة الإدارة (الجولة ١٨) — واجهة الأقسام الثمانية
   ──────────────────────────────────────────────────────────────────────
   🎯 الأقسام: ملخّص يومي · إدارة مستخدمين وباقات · تسجيل دخول · الأسعار
                الأعطال · سجل صلاحيات · مركز قرارات · تنبيهات
   ⛔ كل الأرقام هنا بتيجي من /api/* **بعد** التحقق من الجلسة.
   ⛔ مافيش تخزين وهمي: أي إجراء بيستدعي endpoint موجود في الباك بس،
      ولو المسار مش موجود ⇒ «غير متاح» بوضوح.
   ⛔ كل إجراء تعديلي بيطلب تأكيد صريح (نافذة تأكيد + علامة إقرار للحذف).
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var AUDIT_KEY = 'octa_mgmt_audit';
  var MAX_AUDIT = 120;

  var S = {
    subs: null,      /* سجل الاشتراكات (/api/subscriptions/log) — null = غير متاح */
    alerts: null,    /* تنبيهات الأسعار (/api/panel/alerts) — null = غير متاح */
    ticker: null,    /* مؤشرات السوق (/api/ticker) — null = غير متاح */
    health: null,    /* حالة الوسيط (/api/health) */
    lastSync: 0,
    lastError: '',
    session: null,
    perm: null,      /* نتيجة فحص الصلاحيات */
    busy: false,
  };

  /* ══ أدوات ══ */
  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function tag(text, kind) { return '<span class="tag ' + (kind || '') + '">' + esc(text) + '</span>'; }
  function num(n) { return Number(n || 0).toLocaleString('ar-EG'); }
  function D() { return window.D || null; }
  function ago(ts) {
    if (!ts) return '—';
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'الآن';
    if (s < 3600) return 'منذ ' + Math.floor(s / 60) + ' د';
    if (s < 86400) return 'منذ ' + Math.floor(s / 3600) + ' س';
    return 'منذ ' + Math.floor(s / 86400) + ' يوم';
  }
  function cairo(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts * 1000).toLocaleString('ar-EG', { hour12: false });
    } catch (e) { return '—'; }
  }
  function isoToTs(s) {
    if (!s || s === '—') return 0;
    var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return 0;
    return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 2, +m[5]) / 1000);
  }
  /* ⛔ عمر اللقطة من snapshot_id (YYYYMMDD-HHMMSS) */
  function snapshotAge(snap) {
    var m = String(snap || '').match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
    if (!m) return -1;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000;
    return Math.floor((Date.now() / 1000 - t) / 60); /* بالدقائق */
  }

  /* ══ سجل الأفعال (محلي على جهاز الأدمن — ⛔ مافيش خادم) ══ */
  function auditLoad() {
    try {
      var a = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function auditSave(list) {
    try { localStorage.setItem(AUDIT_KEY, JSON.stringify(list.slice(0, MAX_AUDIT))); } catch (e) { }
  }
  function audit(msg, kind) {
    var list = auditLoad();
    list.unshift({ t: Date.now(), m: msg, k: kind || 'ok' });
    auditSave(list);
    renderAudit();
  }
  function auditClear() {
    auditSave([]);
    renderAudit();
  }

  /* ══ نافذة التأكيد ══ */
  var modal = { on: false };
  function confirmModal(opts) {
    var m = $('#pmodal');
    if (!m) return;
    $('#pmodalTitle').textContent = opts.title || 'تأكيد';
    $('#pmodalBody').innerHTML = opts.body || '';
    var warn = $('#pmodalWarn');
    warn.style.display = opts.warn ? 'block' : 'none';
    if (opts.warn) warn.innerHTML = opts.warn;
    var chk = $('#pmodalCheck');
    chk.style.display = opts.needCheck ? 'flex' : 'none';
    $('#pmodalCheckBox').checked = false;
    var ok = $('#pmodalOk');
    ok.disabled = !!opts.needCheck;
    ok.textContent = opts.okText || 'تأكيد';
    ok.className = 'pbtn ' + (opts.danger ? 'danger' : 'primary');
    modal.on = true;
    m.classList.add('on');
    ok.onclick = function () {
      if (opts.needCheck && !$('#pmodalCheckBox').checked) return;
      closeModal();
      opts.onConfirm();
    };
  }
  function closeModal() {
    var m = $('#pmodal');
    if (m) m.classList.remove('on');
    modal.on = false;
  }

  /* ══ طلبات للـWorker (كلها بتعدّي على جلسة الأدمن) ══ */
  function api(path, opts) {
    opts = opts || {};
    var url = '/api/proxy?path=' + encodeURIComponent(path);
    var init = { method: opts.method || 'GET', credentials: 'same-origin', cache: 'no-store' };
    if (opts.body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(opts.body);
    }
    if (opts.omit) init.credentials = 'omit';
    return fetch(url, init).then(function (r) {
      if (r.status === 204) return { missing: true, status: 204 };
      if (r.status === 401) return { unauthorized: true, status: 401 };
      return r.text().then(function (t) {
        var j = null;
        try { j = JSON.parse(t); } catch (e) { j = null; }
        return { status: r.status, ok: r.ok, json: j, text: t };
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     ١) ملخّص يومي
     ══════════════════════════════════════════════════════════════ */
  function renderDaily() {
    var box = $('#dailyBox');
    if (!box) return;
    var d = D();
    if (!d) { box.innerHTML = na('جاري تحميل البيانات…'); return; }
    var k = d.kpi || {};
    var tl = d.timeline || [];
    var today = new Date().toISOString().slice(0, 10);
    var tLogins = tl.filter(function (e) { return String(e.ts || '').slice(0, 10) === today; });
    var usersToday = d.users.filter(function (u) { return String(u.created || '').slice(0, 10) === today; });
    var activeToday = d.users.filter(function (u) { return String(u.last_seen || '').slice(0, 10) === today; });
    var daily = d.daily || [];
    var last = daily.slice(-14);
    var mx = Math.max(1, ...last.map(function (x) { return x.n || 0; }));

    var html = '<div class="pgrid c2">';

    /* بطاقة المؤشرات */
    html += '<div class="pcard"><h3>📅 النهارده ' + esc(today) +
      tag(S.lastError ? 'فيه خطأ في آخر تحديث' : 'آخر تحديث ' + ago(S.lastSync), S.lastError ? 'bad' : 'ok') + '</h3>' +
      '<div class="pmetrics">' +
      m('دخولات النهارده', tLogins.length, 'من ' + tl.length + ' كل المدة') +
      m('مستخدمين اتسجلوا', usersToday.length, 'حسابات جديدة') +
      m('نشطين النهارده', activeToday.length, 'آخر ظهور النهارده') +
      m('زيارات ٧ أيام', k.events7 || 0, 'من ' + (k.events || 0) + ' كلها') +
      m('زيارات منسوبة', (k.tracked_pct || 0) + '%', k.tracked || 0 + ' حدث') +
      m('وقت فعلي', hms(sumActive(d)), 'لكل المستخدمين') +
      '</div></div>';

    /* بطاقة الاتجاه */
    html += '<div class="pcard"><h3>📈 آخر ١٤ يوم — عدد الدخولات' +
      tag('من ' + daily.length + ' يوم مسجّل', '') + '</h3>' +
      (last.length ? last.map(function (x) {
        return '<div class="hbar"><span class="lbl mono" style="min-width:74px">' + esc(x.d) + '</span>' +
          '<span class="tr"><span class="fl" style="width:' + Math.round((x.n || 0) / mx * 100) + '%"></span></span>' +
          '<span class="v">' + (x.n || 0) + '</span></div>';
      }).join('') : '<p class="phint">لا دخولات مسجّلة</p>') +
      '</div>';

    /* بطاقة السوق */
    html += '<div class="pcard"><h3>📊 مؤشرات السوق' +
      (S.ticker && S.ticker.ticker ? tag('من /api/ticker', 'ok') : tag('غير متاح', 'na')) + '</h3>';
    if (S.ticker && S.ticker.ticker && S.ticker.ticker.length) {
      html += '<div class="pmetrics">' + S.ticker.ticker.slice(0, 4).map(function (t) {
        var ch = Number(t.change || 0);
        return '<div class="pmetric ' + (ch > 0 ? 'ok' : (ch < 0 ? 'bad' : '')) + '">' +
          '<div class="k">' + esc(t.label || t.id) + '</div>' +
          '<div class="v">' + esc(String(t.value == null ? '—' : t.value)) + '</div>' +
          '<div class="s">' + (ch > 0 ? '▲' : (ch < 0 ? '▼' : '—')) + ' ' + esc(String(ch)) + '%</div></div>';
      }).join('') + '</div>';
    } else {
      html += '<p class="phint">⛔ مسار مؤشرات السوق غير متاح في الجلسة دي.</p>';
    }
    html += '</div>';

    /* بطاقة حالة الاتصال */
    html += '<div class="pcard"><h3>🔌 حالة الاتصال' +
      tag(S.lastError ? 'خطأ' : 'شغّال', S.lastError ? 'bad' : 'ok') + '</h3>' +
      '<div class="pmetrics">' +
      m('آخر مزامنة', S.lastSync ? ago(S.lastSync) : '—', '') +
      m('اللقطة', d.snapshot || '—', 'من /api/admin/monthly') +
      m('حالة السيرفر', S.health ? (S.health.has_admin ? 'التوكن مهيّأ' : 'التوكن ناقص') : '—', '/api/health') +
      '</div>';
    if (S.lastError) {
      html += '<p class="phint" style="margin-top:9px;color:#fca5a5">⚠ آخر خطأ في السحب: ' + esc(S.lastError) + '</p>';
    }
    html += '</div></div>';

    box.innerHTML = html;
  }

  function sumActive(d) {
    return (d.users || []).reduce(function (a, u) { return a + (u.active_min || 0); }, 0);
  }
  function hms(m) {
    m = Math.round(m || 0);
    if (m < 60) return m + ' د';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' س';
    return Math.floor(h / 24) + ' يوم ' + (h % 24) + ' س';
  }
  function m(k, v, s) {
    return '<div class="pmetric"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) +
      '</div>' + (s ? '<div class="s">' + esc(s) + '</div>' : '') + '</div>';
  }
  function na(text) {
    return '<div class="pna">⛔ <b>غير متاح</b> — ' + esc(text) + '</div>';
  }

  /* ══════════════════════════════════════════════════════════════
     ٢) إدارة المستخدمين والباقات
     ══════════════════════════════════════════════════════════════ */
  function planMap() {
    var map = {};
    var items = (S.subs && S.subs.items) || [];
    items.forEach(function (it) {
      var who = String(it.email || it.uid || '').toLowerCase();
      if (!who) return;
      map[who] = it;
    });
    return map;
  }

  function renderUsers() {
    var box = $('#usersBox');
    if (!box) return;
    var d = D();
    if (!d) { box.innerHTML = na('جاري تحميل البيانات…'); return; }
    var users = d.users || [];
    var pm = planMap();
    var rows = users.map(function (u) {
      var key = String(u.email || u.uid || '').toLowerCase();
      var pl = pm[key];
      var plan = pl ? (pl.plan || 'pro') : null;
      var planTag = plan ? tag('باقة ' + plan + ' · ' + (pl.days || 0) + ' يوم', 'ok') : tag('مفيش باقة مسجّلة', 'na');
      var acts = '<div class="a">';
      if (u.email) {
        acts += '<button class="pbtn" onclick="Panel.activatePlan(\'' + esc(u.uid) + '\')">🎫 تفعيل/تجديد باقة</button>';
        acts += '<button class="pbtn" onclick="Panel.resetChal(\'' + esc(u.uid) + '\')">♻️ تصفير عدّاد الكود</button>';
      }
      acts += '<button class="pbtn danger" onclick="Panel.deleteUser(\'' + esc(u.uid) + '\')">🗑️ حذف الحساب</button>';
      acts += '</div>';
      return '<tr>' +
        '<td><b>' + esc(u.name) + '</b>' + (u.guest ? ' ' + tag('زائر', 'warn') : '') + '</td>' +
        '<td class="ltr mono">' + esc(u.email || '—') + '</td>' +
        '<td class="mono">' + esc(u.created || '—') + '</td>' +
        '<td class="num">' + (u.hits || 0) + '</td>' +
        '<td class="num">' + (u.login_count || 0) + '</td>' +
        '<td>' + planTag + '</td>' +
        '<td>' + acts + '</td>' +
        '</tr>';
    }).join('');

    box.innerHTML =
      '<div class="pstatus">' +
      tag(users.length + ' حساب', 'ok') +
      tag(S.subs ? 'سجل الاشتراكات متاح' : 'سجل الاشتراكات غير متاح', S.subs ? 'ok' : 'na') +
      tag('الباقة معروفة من سجل الاشتراكات فقط', 'na') +
      '</div>' +
      '<div class="tbl-wrap"><table class="ptbl"><thead><tr>' +
      '<th>الاسم</th><th>الإيميل</th><th>التسجيل</th><th>زيارات</th><th>دخولات</th><th>الباقة</th><th>إجراءات</th>' +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="phint">لا حسابات</td></tr>') + '</tbody></table></div>' +
      '<p class="phint" style="margin-top:9px">⛔ تغيير الباقة بيستدعي <code>/api/subscriptions/activate</code> و' +
      'حذف الحساب بيستدعي <code>DELETE /api/admin/user/&lt;uid&gt;</code> — والاتنين بيطلبوا تأكيد صريح. ' +
      '⛔ مافيش أي تنفيذ تلقائي.</p>';
  }

  /* ══════════════════════════════════════════════════════════════
     ٣) تسجيل الدخول (النظام + الجلسات)
     ══════════════════════════════════════════════════════════════ */
  function renderLogin() {
    var box = $('#loginBox');
    if (!box) return;
    var d = D();
    var tl = (d && d.timeline) || [];
    var by = {};
    tl.forEach(function (e) { by[e.via || '—'] = (by[e.via || '—'] || 0) + 1; });
    var last = tl.slice(0, 12);
    var sessOk = !!(S.session && S.session.ok);

    box.innerHTML =
      '<div class="pgrid c2">' +
      '<div class="pcard"><h3>🔐 حالة الجلسة' + tag(sessOk ? 'صالحة' : 'مش صالحة', sessOk ? 'ok' : 'bad') + '</h3>' +
      '<div class="pmetrics">' +
      m('الكوكي', 'HttpOnly', 'SameSite=Strict + Secure') +
      m('مدة الجلسة', '٣٠ يوم', 'من إعدادات الـWorker') +
      m('توكن الأدمن', S.health ? (S.health.has_admin ? 'موجود' : 'ناقص') : '—', 'مش بيوصلش المتصفح') +
      m('كلمة المرور', S.health ? (S.health.has_password ? 'موجودة' : 'ناقصة') : '—', 'متغيّر بيئة') +
      '</div>' +
      '<p class="phint" style="margin-top:10px">⛔ تغيير كلمة المرور: <b>غير متاح</b> من اللوحة — ' +
      'المتغيّر بيئة في السيرفر ويحتاج إعادة نشر. ⛔ سجل محاولات الدخول الفاشلة: <b>غير متاح</b> — مافيش مسار بيقراها.</p>' +
      '<div class="a" style="margin-top:10px"><button class="pbtn" onclick="Panel.logout()">🚪 خروج</button></div>' +
      '</div>' +

      '<div class="pcard"><h3>🚪 طرق الدخول' + tag(tl.length + ' عملية', '') + '</h3>' +
      '<div class="pmetrics">' +
      Object.keys(by).map(function (k) { return m(k, by[k], 'نوع الدخول'); }).join('') +
      '</div>' +
      '<div class="tbl-wrap" style="margin-top:11px"><table class="ptbl"><thead><tr>' +
      '<th>الوقت</th><th>المستخدم</th><th>الطريقة</th><th>جهاز جديد</th>' +
      '</tr></thead><tbody>' +
      (last.length ? last.map(function (e) {
        return '<tr><td class="mono">' + esc(e.ts) + '</td><td>' + esc(e.name) + '</td>' +
          '<td>' + esc(e.via || '—') + '</td>' +
          '<td>' + (e.newdev ? tag('جديد', 'warn') : tag('معروف', '')) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="phint">لا دخولات</td></tr>') +
      '</tbody></table></div></div></div>';
  }

  /* ══════════════════════════════════════════════════════════════
     ٤) الأسعار (باقات الاشتراك + مؤشرات السوق)
     ══════════════════════════════════════════════════════════════ */
  function renderPrices() {
    var box = $('#pricesBox');
    if (!box) return;
    var items = (S.subs && S.subs.items) || [];
    var total = items.reduce(function (a, x) { return a + (Number(x.price) || 0); }, 0);
    var byDays = {};
    items.forEach(function (x) {
      var k = String(x.days || 0);
      if (!byDays[k]) byDays[k] = { n: 0, sum: 0 };
      byDays[k].n += 1; byDays[k].sum += Number(x.price) || 0;
    });
    var last = items[0];

    box.innerHTML =
      '<div class="pgrid c2">' +
      '<div class="pcard"><h3>💰 أسعار الباقات' +
      (S.subs ? tag('من سجل الاشتراكات', 'ok') : tag('غير متاح', 'na')) + '</h3>' +
      '<div class="pmetrics">' +
      m('تفعيلات', items.length, 'كل التفعيلات المسجّلة') +
      m('إجمالي المحصّل', total, 'جنيه (من السجل)') +
      m('آخر تفعيل', last ? (last.at_date || '—') : '—', last ? (last.method || '') : '') +
      '</div>' +
      '<div class="tbl-wrap" style="margin-top:11px"><table class="ptbl"><thead><tr>' +
      '<th>المدة</th><th>عدد التفعيلات</th><th>متوسط السعر</th></tr></thead><tbody>' +
      (Object.keys(byDays).length ? Object.keys(byDays).map(function (k) {
        var v = byDays[k];
        var avg = v.n ? Math.round(v.sum / v.n) : 0;
        return '<tr><td>' + esc(k) + ' يوم</td><td class="num">' + v.n + '</td><td class="num">' + avg + '</td></tr>';
      }).join('') : '<tr><td colspan="3" class="phint">لا تفعيلات مسجّلة</td></tr>') +
      '</tbody></table></div>' +
      '<p class="phint" style="margin-top:9px">⛔ مافيش مسار أدمن بيرجّع قائمة أسعار الباقات. ' +
      'الأسعار الثابتة (شهري/سنوي) متعرّفة في كود الباك — واللي معروض هنا هو ' +
      '<b>الأسعار اللي اتفعّل بيها فعلاً</b> من السجل.</p></div>' +

      '<div class="pcard"><h3>📉 أسعار السوق' +
      (S.ticker && S.ticker.ticker ? tag('مباشر', 'ok') : tag('غير متاح', 'na')) + '</h3>' +
      (S.ticker && S.ticker.ticker && S.ticker.ticker.length
        ? '<div class="pmetrics">' + S.ticker.ticker.map(function (t) {
          var ch = Number(t.change || 0);
          return '<div class="pmetric ' + (ch > 0 ? 'ok' : (ch < 0 ? 'bad' : '')) + '">' +
            '<div class="k">' + esc(t.label || t.id) + '</div>' +
            '<div class="v">' + esc(String(t.value == null ? '—' : t.value)) + '</div>' +
            '<div class="s">' + (ch > 0 ? '▲' : (ch < 0 ? '▼' : '—')) + ' ' + esc(String(ch)) + '%</div></div>';
        }).join('') + '</div>'
        : '<p class="phint">⛔ مسار مؤشرات السوق غير متاح.</p>') +
      '<p class="phint" style="margin-top:9px">ℹ️ سعر السهم بالتفصيل (لكل كود) مش معروض هنا — ' +
      'بييجي مع قسم التنبيهات لما الكود يكون متابع.</p></div></div>';
  }

  /* ══════════════════════════════════════════════════════════════
     ٥) الأعطال
     ══════════════════════════════════════════════════════════════ */
  function renderIncidents() {
    var box = $('#incidentsBox');
    if (!box) return;
    var d = D();
    var ageMin = d ? snapshotAge(d.snapshot) : -1;
    var ageTxt = ageMin < 0 ? '—' : (ageMin < 60 ? ageMin + ' دقيقة' : Math.floor(ageMin / 60) + ' ساعة');
    var ageKind = ageMin < 0 ? 'na' : (ageMin > 1440 ? 'bad' : (ageMin > 120 ? 'warn' : 'ok'));

    box.innerHTML =
      '<div class="pgrid c2">' +
      '<div class="pcard"><h3>🩺 مؤشرات الأعطال' +
      tag(S.lastError ? 'فيه خلل' : 'مفيش خلل ظاهر', S.lastError ? 'bad' : 'ok') + '</h3>' +
      '<div class="pmetrics">' +
      m('الاتصال بالسيرفر', S.lastError ? 'فشل' : 'شغّال', 'آخر سحب') +
      m('عمر البيانات', ageTxt, 'من لقطة /api/admin/monthly') +
      m('توفّر توكن الأدمن', S.health ? (S.health.has_admin ? 'موجود' : 'ناقص') : '—', '') +
      m('كلمة المرور', S.health ? (S.health.has_password ? 'موجودة' : 'ناقصة') : '—', '') +
      '</div>' +
      '<p class="phint" style="margin-top:10px">ℹ️ المؤشرات دي <b>مشتقة</b> من حالة الاتصال وعمر اللقطة. ' +
      '⛔ مافيش مسار «سجل أعطال» على السيرفر ⇒ مافيش تاريخ أعطال ولا إنذارات مسبقة.</p>' +
      '<div class="a" style="margin-top:10px"><button class="pbtn" onclick="Panel.refresh()">🔄 إعادة الفحص</button></div>' +
      '</div>' +

      '<div class="pcard"><h3>🧯 إجراءات التشغيل' + tag('تقديري', 'na') + '</h3>' +
      '<div class="pmetrics">' +
      m('مزامنة يدوية', 'متاحة', 'تحديث الداتا') +
      m('تصفير عدّاد الكود', 'متاحة', 'يوجد في الباك') +
      m('إعادة تشغيل السيرفر', 'غير متاح', 'من Railway — قرار المالك') +
      m('سجل الأعطال', 'غير متاح', 'مافيش endpoint') +
      '</div>' +
      '<p class="phint" style="margin-top:10px">ℹ️ الأزرار المسموحة بتستدعي مسارات موجودة في الباك بس. ' +
      '⛔ أي حاجة مش موجودة ⇒ «غير متاح» بدل تخزين وهمي.</p></div></div>';
  }

  /* ══════════════════════════════════════════════════════════════
     ٦) سجل الصلاحيات
     ══════════════════════════════════════════════════════════════ */
  function renderAudit() {
    var box = $('#auditBox');
    if (!box) return;
    var list = auditLoad();
    box.innerHTML =
      '<div class="pstatus">' + tag(list.length + ' فعل مسجّل', list.length ? 'ok' : 'na') +
      tag('سجل محلي على جهاز الأدمن', 'na') + '</div>' +
      '<div class="plog">' +
      (list.length ? list.map(function (e) {
        return '<div class="e ' + esc(e.k) + '"><span class="t">' + esc(cairo(Math.floor(e.t / 1000))) + '</span>' +
          '<span class="m">' + esc(e.m) + '</span></div>';
      }).join('') : '<p class="phint">لا أفعال بعد — أي إجراء بتعمله هيتسجّل هنا.</p>') +
      '</div>' +
      '<div class="a" style="margin-top:10px"><button class="pbtn" onclick="Panel.auditClear()">🗑️ مسح السجل</button></div>';

    var perm = $('#permBox');
    if (!perm) return;
    if (!S.perm) {
      perm.innerHTML = '<div class="pstatus">' + tag('لسه متفحصش', 'na') + '</div>' +
        '<p class="phint">فحص الصلاحيات بيبعت طلبات تجريبية (من غير بيانات) للتأكد إن كل مسار محمي.</p>' +
        '<div class="a" style="margin-top:9px"><button class="pbtn" onclick="Panel.permCheck()">🛡️ فحص الصلاحيات دلوقتي</button></div>';
      return;
    }
    perm.innerHTML = '<div class="pstatus">' +
      tag(S.perm.okCount + ' / ' + S.perm.total + ' سليم', S.perm.bad === 0 ? 'ok' : 'bad') + '</div>' +
      '<div class="tbl-wrap"><table class="ptbl"><thead><tr><th>الفحص</th><th>المتوقّع</th><th>النتيجة</th><th>الحكم</th></tr></thead><tbody>' +
      S.perm.rows.map(function (r) {
        return '<tr><td class="mono ltr">' + esc(r.name) + '</td><td class="mono">' + esc(r.expect) + '</td>' +
          '<td class="mono">' + esc(r.got) + '</td><td>' + (r.pass ? tag('سليم', 'ok') : tag('خلل', 'bad')) + '</td></tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  /* ══════════════════════════════════════════════════════════════
     ٧) مركز القرارات
     ══════════════════════════════════════════════════════════════ */
  function renderDecisions() {
    var box = $('#decisionsBox');
    if (!box) return;
    var d = D();
    if (!d) { box.innerHTML = na('جاري تحميل البيانات…'); return; }
    var users = d.users || [];
    var k = d.kpi || {};
    var items = [];

    var noPin = users.filter(function (u) { return !u.guest && !u.pin; });
    if (noPin.length) {
      items.push({
        t: 'حسابات بلا باسورد', ev: noPin.length + ' حساب سجّل وما حطّش باسورد.',
        rec: 'يُفضّل تصفير عدّاد أكوادهم أو حذف الحساب عشان ما يستهلكوش حدّ الكود اليومي.',
        act: '<button class="pbtn" onclick="Panel.resetChalFirst()">♻️ تصفير عدّاد الكود</button>',
      });
    }

    var idle = users.filter(function (u) { return !u.guest && (u.hits || 0) === 0; });
    if (idle.length) {
      items.push({
        t: 'حسابات بلا زيارات', ev: idle.length + ' حساب ما فتحش أي صفحة.',
        rec: 'قرار المالك: حذفهم ولا تسيبهم؟ الحذف بيستدعي DELETE /api/admin/user/<uid>.',
        act: '<button class="pbtn danger" onclick="Panel.deleteUser(\'' + esc(idle[0].uid) + '\')">🗑️ حذف أول حساب</button>' +
          '<span class="phint">' + idle.length + ' حساب — الحذف بيطلب تأكيد</span>',
      });
    }

    var shared = (d.ips || []).filter(function (x) { return (x.users || []).length > 1; });
    if (shared.length) {
      items.push({
        t: 'نفس الـIP عند أكتر من مستخدم', ev: shared.length + ' عنوان IP مشترك بين أكتر من حساب.',
        rec: '⛔ مافيش مسار «قفل IP» في الباك ⇒ القرار يدوي من المالك (قفل الأجهزة في الإعدادات).',
        act: tag('غير متاح — قرار المالك', 'na'),
      });
    }

    var neverLogin = users.filter(function (u) { return !u.guest && (u.login_count || 0) === 0; });
    if (neverLogin.length) {
      items.push({
        t: 'حسابات بلا دخول حقيقي', ev: neverLogin.length + ' حساب اتسجّل بس ما دخلش ولا مرة.',
        rec: 'مم يكون مستخدم نسي الكود بتاعه — تصفير عدّاد الأكواد بيحل الموضوع بسرعة.',
        act: '<button class="pbtn" onclick="Panel.resetChalFirst()">♻️ تصفير عدّاد الكود</button>',
      });
    }

    var ageMin = snapshotAge(d.snapshot);
    if (ageMin >= 0 && ageMin > 120) {
      items.push({
        t: 'البيانات قديمة', ev: 'عمر اللقطة ' + Math.floor(ageMin / 60) + ' ساعة.',
        rec: 'شغّل تحديث يدوي، ولو البيانات فضلت قديمة ⇒ يعيب في محدّث الأسعار على السيرفر.',
        act: '<button class="pbtn" onclick="Panel.refresh()">🔄 تحديث دلوقتي</button>',
      });
    }

    var untracked = k.untracked || 0;
    if (untracked > 0) {
      items.push({
        t: 'زيارات مش منسوبة لمستخدم', ev: untracked + ' حدث (' + (k.untracked_pct || 0) + '%) مالهم uid.',
        rec: 'السبب في الواجهة (الـuid بيتمسح بعد التحديث) — التصحيح جاهز في الكود ويحتاج نشر.',
        act: tag('يحتاج نشر — قرار المالك', 'na'),
      });
    }

    box.innerHTML = items.length
      ? items.map(function (x) {
        return '<div class="prow"><div class="t">' + esc(x.t) + tag('يحتاج قرار', 'warn') + '</div>' +
          '<div class="e">' + esc(x.ev) + '</div>' +
          '<div class="r">💡 ' + esc(x.rec) + '</div>' +
          '<div class="a">' + x.act + '</div></div>';
      }).join('')
      : '<div class="pna">✅ مفيش قرار معلّق على البيانات الحالية.</div>';
  }

  /* ══════════════════════════════════════════════════════════════
     ٨) التنبيهات
     ══════════════════════════════════════════════════════════════ */
  function renderAlerts() {
    var box = $('#alertsBox');
    if (!box) return;
    if (!S.alerts) {
      box.innerHTML = na('مسار التنبيهات غير متاح في السيرفر — مافيش بيانات تُعرض.');
      return;
    }
    var a = S.alerts.alerts || [];
    var sm = S.alerts.summary || {};
    var trig = a.filter(function (x) { return x.state !== 'none'; });
    var rows = (trig.length ? trig : a).slice(0, 60).map(function (x) {
      var kind = x.state === 'hi' ? 'bad' : (x.state === 'lo' ? 'ok' : 'na');
      return '<tr>' +
        '<td>' + esc(x.name || '—') + '</td>' +
        '<td class="ltr mono">' + esc(x.code) + '</td>' +
        '<td class="num">' + esc(String(x.price == null ? '—' : x.price)) + '</td>' +
        '<td class="num">' + esc(String(x.hi == null ? '—' : x.hi)) + '</td>' +
        '<td class="num">' + esc(String(x.lo == null ? '—' : x.lo)) + '</td>' +
        '<td>' + tag(x.label || 'مفيش حد', kind) + '</td>' +
        '</tr>';
    }).join('');

    box.innerHTML =
      '<div class="pstatus">' +
      tag(sm.total || 0 + ' منبه', '') +
      tag((sm.triggered_hi || 0) + ' عدّى الحد الأعلى', 'bad') +
      tag((sm.triggered_lo || 0) + ' وصل الحد الأدنى', 'ok') +
      tag((sm.priced || 0) + ' منبه له سعر حالي', '') +
      '</div>' +
      '<div class="tbl-wrap"><table class="ptbl"><thead><tr>' +
      '<th>المستخدم</th><th>الكود</th><th>السعر الحالي</th><th>الحد الأعلى</th><th>الحد الأدنى</th><th>الحالة</th>' +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="6" class="phint">لا منبهات</td></tr>') + '</tbody></table></div>' +
      '<p class="phint" style="margin-top:9px">ℹ️ prices (٦٩٠ ك.ب) بتتقرأ في السيرفر وبتتبعت للمتصفح ' +
      'الأكواد المتابَعة بس. ⛔ لو الكود مش موجود فيSnapshot السوق ⇒ «مفيش سعر».';
  }

  /* ══════════════════════════════════════════════════════════════
     إجراءات (بتستدعي مسارات موجودة في الباك + تأكيد صريح)
     ══════════════════════════════════════════════════════════════ */
  function findUser(uid) {
    var d = D();
    if (!d) return null;
    var u = (d.users || []).filter(function (x) { return x.uid === uid; })[0];
    return u || null;
  }

  function activatePlan(uid) {
    var u = findUser(uid);
    if (!u) { alert('الحساب مش موجود في البيانات المحمّلة — حدّث الأول.'); return; }
    if (!u.email) { alert('الحساب ده زائر من غير إيميل — مافيش باقة ليه.'); return; }
    confirmModal({
      title: 'تفعيل/تجديد باقة',
      body: 'الحساب: <b>' + esc(u.name) + '</b><br>الباقة: <b>pro</b> · ٣٠ يوم<br>' +
        '⛔ الإجراء بيكتب في سجل الاشتراكات على السيرفر (استخدام حقيقي).',
      warn: '⛔⛔⛔ ده إجراء حقيقي على الإنتاج — مش تجربة. اتأكد من الحساب والمدة.',
      okText: 'فعّل الباقة',
      onConfirm: function () {
        api('/api/subscriptions/activate', {
          method: 'POST',
          body: { email: u.email, plan: 'pro', days: 30, price: 0, method: 'admin', note: 'لوحة الإدارة' },
        }).then(function (r) {
          if (r.missing) { audit('تفعيل باقة: المسار غير موجود في الباك', 'warn'); return; }
          if (r.unauthorized) { audit('تفعيل باقة: الجلسة منتهية', 'bad'); return; }
          if (r.ok && r.json && r.json.ok) {
            audit('تفعيل باقة لـ ' + u.name + ' (٣٠ يوم)', 'ok');
            refreshAll();
          } else {
            audit('تفعيل باقة فشل لـ ' + u.name + ' (HTTP ' + r.status + ')', 'bad');
          }
        });
      },
    });
  }

  function deleteUser(uid) {
    var u = findUser(uid);
    if (!u) { alert('الحساب مش موجود في البيانات المحمّلة — حدّث الأول.'); return; }
    confirmModal({
      title: 'حذف الحساب',
      body: 'الحساب: <b>' + esc(u.name) + '</b><br>' +
        (u.email ? 'الإيميل: <b class="ltr">' + esc(u.email) + '</b><br>' : 'زائر من غير إيميل<br>') +
        'المسار: <code>DELETE /api/admin/user/&lt;uid&gt;</code>',
      warn: '⛔⛔⛔ حذف نهائي — الحساب وكل بياناته بتتمسح. مافيش تراجع.',
      needCheck: true,
      danger: true,
      okText: 'احذف نهائيًا',
      onConfirm: function () {
        api('/api/admin/user/' + encodeURIComponent(uid), { method: 'DELETE' }).then(function (r) {
          if (r.missing) { audit('حذف حساب: المسار غير موجود', 'warn'); return; }
          if (r.unauthorized) { audit('حذف حساب: الجلسة منتهية', 'bad'); return; }
          if (r.ok && r.json && r.json.ok) {
            audit('حذف حساب ' + u.name, 'ok');
            refreshAll();
          } else {
            audit('حذف حساب فشل لـ ' + u.name + ' (HTTP ' + r.status + ')', 'bad');
          }
        });
      },
    });
  }

  function resetChal(uid) {
    var u = findUser(uid);
    if (!u) { alert('الحساب مش موجود في البيانات المحمّلة — حدّث الأول.'); return; }
    if (!u.email) { alert('الحساب ده زائر من غير إيميل — مافيش عدّاد أكواد ليه.'); return; }
    confirmModal({
      title: 'تصفير عدّاد أكواد الإيميل',
      body: 'الحساب: <b>' + esc(u.name) + '</b><br>المسار: <code>POST /api/admin/reset_chal</code>',
      okText: 'صفّر العدّاد',
      onConfirm: function () {
        api('/api/admin/reset_chal', { method: 'POST', body: { email: u.email } }).then(function (r) {
          if (r.missing) { audit('تصفير العدّاد: المسار غير موجود', 'warn'); return; }
          if (r.unauthorized) { audit('تصفير العدّاد: الجلسة منتهية', 'bad'); return; }
          if (r.ok && r.json && r.json.ok) {
            audit('تصفير عدّاد الكود لـ ' + u.name, 'ok');
          } else {
            audit('تصفير العدّاد فشل لـ ' + u.name + ' (HTTP ' + r.status + ')', 'bad');
          }
        });
      },
    });
  }

  function resetChalFirst() {
    var d = D();
    if (!d) return;
    var u = (d.users || []).filter(function (x) { return x.email && !x.pin; })[0] ||
      (d.users || []).filter(function (x) { return x.email; })[0];
    if (!u) { alert('مافيش حساب بإيميل في البيانات المحمّلة.'); return; }
    resetChal(u.uid);
  }

  /* ══ فحص الصلاحيات (طلبات تجريبية — من غير بيانات) ══ */
  function permCheck() {
    var checks = [
      { name: 'GET /api/proxy (من غير جلسة)', path: '/api/admin/users', expect: '401', omit: true },
      { name: 'GET /api/proxy (بجلسة)', path: '/api/admin/users', expect: '200' },
      { name: 'GET /api/admin/monthly', path: '/api/admin/monthly', expect: '200' },
      { name: 'GET /api/subscriptions/log', path: '/api/subscriptions/log', expect: '200/204' },
      { name: 'GET /api/admin/events', path: '/api/admin/events', expect: '200/204' },
      { name: 'POST /api/subscriptions/activate (من غير جلسة)', path: '/api/subscriptions/activate', expect: '401', omit: true, method: 'POST', body: {} },
      { name: 'DELETE /api/admin/user (من غير جلسة)', path: '/api/admin/user/none', expect: '401', omit: true, method: 'DELETE' },
    ];
    var rows = [], done = 0;
    checks.forEach(function (c) {
      api(c.path, { method: c.method, body: c.body, omit: c.omit }).then(function (r) {
        var got = String(r.status || (r.missing ? 204 : 0));
        var pass = c.expect.split('/').indexOf(got) >= 0;
        rows.push({ name: c.name, expect: c.expect, got: got, pass: pass });
        done += 1;
        if (done === checks.length) {
          var bad = rows.filter(function (x) { return !x.pass; }).length;
          S.perm = { rows: rows, total: rows.length, okCount: rows.length - bad, bad: bad };
          renderAudit();
          audit('فحص صلاحيات: ' + (rows.length - bad) + '/' + rows.length + ' سليم', bad ? 'warn' : 'ok');
        }
      });
    });
  }

  function logout() {
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).then(function () {
      try { localStorage.removeItem('octa_mgmt_audit'); localStorage.removeItem('octa_mgmt_snapshot'); } catch (e) { }
      location.replace('/login.html');
    });
  }

  function refresh() { if (window.pull) window.pull(false); }
  function refreshAll() { refresh(); }

  /* ⭐⭐⭐ (R26) ⭐ تغيير كلمة مرور اللوحة ⭐⭐⭐
     📌 ⭐ المالك يختار الكلمة بنفسه ⭐ (من غير Cloudflare ⭐).
     📌 ⛔ ٦ أرقام بس ⭐ ⇒ ⛔ السيرفر بيرفض ⭐ (مليون احتمال ⭐).
     📌 ⛔ بعد النجاح ⭐ ⇒ ⭐ السيرفر بيبطل الجلسة ⭐ ⇒ ⭐ نرجع لصفحة الدخول ⭐. */
  function bindPasswordSection() {
    var btn = $('#pwSave');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var cur = ($('#pwCur') && $('#pwCur').value) || '';
      var n1 = ($('#pwNew') && $('#pwNew').value) || '';
      var n2 = ($('#pwNew2') && $('#pwNew2').value) || '';
      var msg = $('#pwMsg');
      function say(text, cls) {
        if (!msg) return;
        msg.textContent = text;
        msg.className = 'pwmsg ' + (cls || '');
      }
      if (!cur) { say('اكتب كلمة المرور الحالية', 'bad'); return; }
      if (!n1) { say('اكتب كلمة المرور الجديدة', 'bad'); return; }
      if (n1 !== n2) { say('التأكيد مش مطابق', 'bad'); return; }
      say('… جاري الحفظ', '');
      btn.disabled = true;
      fetch('/api/password/change', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: cur, next: n1 })
      }).then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = JSON.parse(t); } catch (e) { j = null; }
          return { status: r.status, json: j };
        });
      }).then(function (o) {
        btn.disabled = false;
        if (o.status === 200 && o.json && o.json.ok) {
          say('اتغيّرت — هنتقل لصفحة الدخول', 'ok');
          setTimeout(function () { location.replace('/login.html'); }, 1200);
          return;
        }
        if (o.status === 401) { say('كلمة المرور الحالية غلط', 'bad'); return; }
        if (o.status === 400 && o.json && o.json.why) { say(o.json.why, 'bad'); return; }
        if (o.status === 429) { say('محاولات كتير. استنى ١٥ دقيقة.', 'bad'); return; }
        say((o.json && o.json.error) ? String(o.json.error) : 'التغيير فشل', 'bad');
      }).catch(function () {
        btn.disabled = false;
        say('التغيير فشل — الشبكة', 'bad');
      });
    });
  }

  /* ══ ربط ══ */
  document.addEventListener('DOMContentLoaded', function () {
    var ok = $('#pmodalOk');
    if (ok) ok.addEventListener('click', function () { });
    var chk = $('#pmodalCheckBox');
    if (chk) chk.addEventListener('change', function () {
      var b = $('#pmodalOk');
      if (b) b.disabled = !chk.checked;
    });
    var x = $('#pmodalCancel');
    if (x) x.addEventListener('click', closeModal);
    var m = $('#pmodal');
    if (m) m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });
    bindPasswordSection();
    renderAll();
  });

  function renderAll() {
    renderDaily();
    renderUsers();
    renderLogin();
    renderPrices();
    renderIncidents();
    renderAudit();
    renderDecisions();
    renderAlerts();
  }

  /* ══ الواجهة العامة ══ */
  window.Panel = {
    setData: function (extra) {
      if (!extra) return;
      Object.keys(extra).forEach(function (k) { S[k] = extra[k]; });
    },
    render: renderAll,
    audit: audit,
    auditClear: auditClear,
    activatePlan: activatePlan,
    deleteUser: deleteUser,
    resetChal: resetChal,
    resetChalFirst: resetChalFirst,
    permCheck: permCheck,
    logout: logout,
    refresh: refresh,
    state: S,
  };
})();
