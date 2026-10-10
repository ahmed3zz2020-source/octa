/* ══════════════════════════════════════════════════════════════
   🔔 نظام مراقبة السعر عبر تيليجرام
   ------------------------------------------------------------
   يربط زر 🔔 في جدول المرشحين بالـAPI على Railway
   فيمكنك تحدد حد أعلى / حد أدنى لأي سهم وتستقبل تنبيه على تيليجرام.

   المتغيرات المستخدمة (من octa-core.js):
     OCTA_API   — عنوان الـAPI
   ══════════════════════════════════════════════════════════════ */

(function () {

  /* ── حالة محلية: أي سهم عنده منبه وإيه حدوده ── */
  const LS_KEY = 'octa_watch_v1';
  let WATCH = {};                 /* { COMI: {hi: 12, lo: 8} } */

  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    if (raw && typeof raw === 'object') WATCH = raw;
  } catch (e) { WATCH = {}; }

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(WATCH)); } catch (e) { }
  }

  /* ── إظهار رسالة صغيرة للمستخدم ── */
  function toast(msg, kind) {
    let box = document.getElementById('wtToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'wtToast';
      box.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:22px', 'transform:translateX(-50%)',
        'z-index:99999', 'max-width:88vw', 'padding:11px 18px', 'border-radius:12px',
        'font:600 14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif',
        'text-align:center', 'pointer-events:none', 'transition:opacity .3s',
        'box-shadow:0 8px 28px rgba(0,0,0,.35)'
      ].join(';');
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.style.background = kind === 'err' ? '#b91c1c' : (kind === 'on' ? '#047857' : '#1e293b');
    box.style.color = '#fff';
    box.style.opacity = '1';
    clearTimeout(box._t);
    box._t = setTimeout(function () { box.style.opacity = '0'; }, 2600);
  }

  /* ── قراءة السعر الحالي للسهم من OS_DB ── */
  function pxOf(code) {
    try {
      const s = (typeof OS_DB !== 'undefined' ? OS_DB : [])
        .find(function (x) { return x.code === code; });
      const p = s && (s.price != null ? s.price : s.p);
      return p ? Number(p) : null;
    } catch (e) { return null; }
  }

  function nmOf(code) {
    try {
      const s = (typeof OS_DB !== 'undefined' ? OS_DB : [])
        .find(function (x) { return x.code === code; });
      return (s && s.name) || code;
    } catch (e) { return code; }
  }

  /* ── فتح نافذة ضبط المنبه ── */
  window.watchEdit = function (code) {
    const px = pxOf(code);
    const w = WATCH[code] || {};
    const hint = px ? 'السعر الآن: ' + px.toFixed(2) + ' ج'
      : 'السعر غير متاح حالياً';

    /* اقترح حدود معقولة: ±8% من السعر الحالي */
    const dHi = w.hi != null ? w.hi : (px ? +(px * 1.08).toFixed(2) : '');
    const dLo = w.lo != null ? w.lo : (px ? +(px * 0.92).toFixed(2) : '');

    const old = document.getElementById('wtModal');
    if (old) old.remove();

    const m = document.createElement('div');
    m.id = 'wtModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.72);' +
      'display:flex;align-items:center;justify-content:center;padding:16px;' +
      'backdrop-filter:blur(3px)';

    m.innerHTML =
      '<div style="background:var(--card,#111827);color:var(--txt,#e5e7eb);' +
      'border:1px solid var(--line,#1f2937);border-radius:16px;padding:20px;' +
      'max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.5)">' +

      '<div style="font:700 17px/1.4 system-ui,sans-serif;margin-bottom:4px">' +
      '🔔 تنبيه سعر — ' + esc(code) + '</div>' +

      '<div style="font:400 13px/1.5 system-ui,sans-serif;opacity:.72;margin-bottom:16px">' +
      esc(nmOf(code)) + ' · ' + esc(hint) + '</div>' +

      '<label style="display:block;font:600 13px system-ui,sans-serif;margin-bottom:5px">' +
      '🔺 حد أعلى — نبعتلك لما السعر يوصل أو يعدّيه</label>' +
      '<input id="wtHi" inputmode="decimal" value="' + dHi + '" ' +
      'style="width:100%;padding:11px 12px;margin-bottom:14px;border-radius:10px;' +
      'border:1px solid var(--line,#1f2937);background:var(--bg,#0b1220);' +
      'color:inherit;font:600 15px system-ui,sans-serif">' +

      '<label style="display:block;font:600 13px system-ui,sans-serif;margin-bottom:5px">' +
      '🔻 حد أدنى — نبعتلك لما السعر يوصل أو ينزل تحتّه</label>' +
      '<input id="wtLo" inputmode="decimal" value="' + dLo + '" ' +
      'style="width:100%;padding:11px 12px;margin-bottom:18px;border-radius:10px;' +
      'border:1px solid var(--line,#1f2937);background:var(--bg,#0b1220);' +
      'color:inherit;font:600 15px system-ui,sans-serif">' +

      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button id="wtSave" style="flex:1 1 110px;padding:12px;border-radius:10px;border:0;' +
      'background:#047857;color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer">' +
      '✅ حفظ</button>' +
      '<button id="wtTest" style="flex:1 1 110px;padding:12px;border-radius:10px;border:1px solid var(--line,#1f2937);' +
      'background:transparent;color:inherit;font:600 14px system-ui,sans-serif;cursor:pointer">' +
      '📨 رسالة تجريبية</button>' +
      '<button id="wtDel" style="flex:0 0 auto;padding:12px 16px;border-radius:10px;border:1px solid #7f1d1d;' +
      'background:transparent;color:#f87171;font:600 14px system-ui,sans-serif;cursor:pointer">' +
      '🗑️</button>' +
      '<button id="wtX" style="flex:0 0 auto;padding:12px 16px;border-radius:10px;border:1px solid var(--line,#1f2937);' +
      'background:transparent;color:inherit;font:600 14px system-ui,sans-serif;cursor:pointer">' +
      '✕</button>' +
      '</div>' +

      '<div style="font:400 11.5px/1.6 system-ui,sans-serif;opacity:.6;margin-top:14px">' +
      'الفحص بيتم كل 5 دقايق على سيرفر Railway، ومفيش إشعار مكرر لنفس الحد خلال 4 ساعات.' +
      '</div>' +

      '</div>';

    document.body.appendChild(m);

    const close = function () { m.remove(); };
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    document.getElementById('wtX').onclick = close;
    document.getElementById('wtDel').onclick = function () {
      delete WATCH[code]; save(); close(); toast('🗑️ اتشال منبه ' + code, 'off'); renderBell(code);
    };

    document.getElementById('wtSave').onclick = function () {
      const hi = parseFloat(document.getElementById('wtHi').value);
      const lo = parseFloat(document.getElementById('wtLo').value);
      const okHi = !isNaN(hi) && hi > 0;
      const okLo = !isNaN(lo) && lo > 0;

      if (!okHi && !okLo) { toast('❌ لازم حد على الأقل — أعلى أو أدنى', 'err'); return; }
      if (okHi && okLo && lo >= hi) { toast('❌ الحد الأدنى لازم يكون أصغر من الأعلى', 'err'); return; }

      WATCH[code] = {};
      if (okHi) WATCH[code].hi = hi;
      if (okLo) WATCH[code].lo = lo;
      save(); close(); renderBell(code);
      pushWatch(code).then(function (r) {
        toast(r ? '🔔 اتفعّل — هننبّهك على تيليجرام' : '⚠️ اتحفظ محلياً بس', r ? 'on' : 'err');
      });
    };

    document.getElementById('wtTest').onclick = function () {
      toast('📨 جاري الإرسال…');
      fetch(OCTA_API + '/api/alerts/test', { method: 'GET' })
        .then(function (r) { return r.json(); })
        .then(function (j) { toast(j && j.ok ? '✅ وصلتك رسالة على تيليجرام' : '❌ فشل: ' + ((j && j.error) || '?'), (j && j.ok) ? 'on' : 'err'); })
        .catch(function () { toast('❌ مفيش اتصال بالسيرفر', 'err'); });
    };
  };

  /* ── إرسال قائمة المتابعة للسيرفر ── */
  function pushWatch(code) {
    const w = WATCH[code] || {};
    return fetch(OCTA_API + '/api/alerts/watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', code: code, hi: w.hi, lo: w.lo })
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  function pullWatch() {
    return fetch(OCTA_API + '/api/alerts/watch')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.items) return;
        (j.items || []).forEach(function (it) {
          WATCH[it.code] = {};
          if (it.hi != null) WATCH[it.code].hi = it.hi;
          if (it.lo != null) WATCH[it.code].lo = it.lo;
        });
        save();
      }).catch(function () { });
  }

  /* ── رسم جرس المنبه في الجدول ── */
  window.renderBell = function (code) {
    document.querySelectorAll('[data-bell="' + code + '"]').forEach(function (el) {
      const on = !!WATCH[code];
      el.textContent = on ? '🔔' : '🔕';
      el.title = on
        ? ('منبه مفعّل — اضغط للتعديل\n' +
            (WATCH[code].hi ? 'أعلى: ' + WATCH[code].hi + '\n' : '') +
            (WATCH[code].lo ? 'أدنى: ' + WATCH[code].lo : ''))
        : 'اضغط ل منبه سعر على تيليجرام';
      el.style.opacity = on ? '1' : '.4';
    });
  };

  window.watchIsOn = function (code) { return !!WATCH[code]; };

  /* ── زرار عام لو مش في الجدول (في كارت القرار مثلاً) ── */
  window.watchToggle = function (code) { window.watchEdit(code); };

  /* ── بدء: نقرأ من السيرفر بعد ما OS_DB يجهز ── */
  function boot() {
    pullWatch();
    /* إعادة رسم الأجراس كل ثانية — عشان لو الجدول اترسم بعدين */
    setInterval(function () {
      document.querySelectorAll('[data-bell]').forEach(function (el) {
        window.renderBell(el.getAttribute('data-bell'));
      });
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.WATCH = WATCH;
  window.watchSave = save;

})();