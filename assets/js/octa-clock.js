/* ══════════════════════════════════════════════════════════════
   🕐 محرّك مواعيد البورصة المصرية (EGX)
   التوقيت: القاهرة (UTC+2) · ثابت طوال السنة مفيش DST
   الأحد ← الخميس أيام التداول | الجمعة والسبت عطلة
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* الجلسات بالدقائق من منتصف الليل (القاهرة) */
  var SESSIONS = {
    preOpen:   { from: 9 * 60 + 15, to: 9 * 60 + 30, label: 'حجم كبير' },        /* 09:15–09:30 */
    disc:      { from: 9 * 60 + 30, to: 10 * 60,      label: 'استكشافية' },      /* 09:30–10:00 */
    cont:      { from: 10 * 60,     to: 14 * 60 + 15, label: 'تداول مستمر' },  /* 10:00–14:15 */
    closeAuc:  { from: 14 * 60 + 15, to: 14 * 60 + 25, label: 'مزاد الإغلاق' },/* 14:15–14:25 */
    closePrice:{ from: 14 * 60 + 25, to: 14 * 60 + 30, label: 'سعر الإغلاق' }, /* 14:25–14:30 */
  };

  /* ⏱️ كل حالة بتاخد period بالثواني + لون + إيموجي */
  var STATES = {
    preOpen:    { e: '🔎', c: '#ffd43b', p: 15000, open: false, live: true,  t: 'حجم كبير' },
    disc:       { e: '🟡', c: '#ffd43b', p: 20000, open: true,  live: true,  t: 'استكشافية' },
    cont:       { e: '🟢', c: '#51cf66', p: 15000, open: true,  live: true,  t: 'تداول مستمر' },
    closeAuc:   { e: '⚡', c: '#ffa94d', p: 8000,  open: true,  live: true,  t: 'مزاد الإغلاق' },
    closePrice: { e: '🔔', c: '#ff8787', p: 8000,  open: true,  live: true,  t: 'سعر الإغلاق' },
    pre:        { e: '🔵', c: '#4dabf7', p: 120000, open: false, live: false, t: 'قبل الافتتاح' },
    post:       { e: '🌙', c: '#868e96', p: 300000, open: false, live: false, t: 'بعد الإغلاق' },
    closed:     { e: '🔴', c: '#868e96', p: 900000, open: false, live: false, t: 'عطلة' },
  };

  function cairoNow(d) {
    d = d || new Date();
    /* القاهرة = UTC+2 طوال السنة */
    return new Date(d.getTime() + (d.getTimezoneOffset() + 120) * 60000);
  }

  /* 0=الأحد … 6=السبت */
  function cairoDay() { return cairoNow().getDay(); }

  /* الحالة الحالية للسوق المصري */
  function egxState(d) {
    var now = cairoNow(d);
    var day = now.getDay();               /* 0 أحد .. 6 سبت */
    var mins = now.getHours() * 60 + now.getMinutes();

    /* الجمعة والسبت عطلة أسبوعية */
    if (day === 5 || day === 6) {
      var st = Object.assign({}, STATES.closed);
      st.next = day === 5 ? 'الأحد' : 'الإثنين';
      st.at = day === 5 ? '09:30' : '09:30';
      return st;
    }

    var k;
    if (mins < SESSIONS.preOpen.from) k = 'pre';
    else if (mins < SESSIONS.disc.from) k = 'preOpen';
    else if (mins < SESSIONS.disc.to) k = 'disc';
    else if (mins < SESSIONS.cont.to) k = 'cont';
    else if (mins < SESSIONS.closeAuc.to) k = 'closeAuc';
    else if (mins < SESSIONS.closePrice.to) k = 'closePrice';
    else k = 'post';

    var s = Object.assign({}, STATES[k]);

    /* الوقت المتباضي للجلسة الجاية */
    s.nextAt = null;
    if (k === 'pre') s.nextAt = '09:15 حجم كبير';
    else if (k === 'preOpen') s.nextAt = '09:30 استكشافية';
    else if (k === 'disc') s.nextAt = '10:00 تداول مستمر';
    else if (k === 'cont') s.nextAt = '14:15 مزاد الإغلاق';
    else if (k === 'closeAuc') s.nextAt = '14:25 سعر الإغلاق';
    else if (k === 'closePrice') s.nextAt = 'يُغلق';
    else if (k === 'post') {
      var nm = (day === 4) ? 'الأحد' : 'غداً';
      s.nextAt = nm + ' 09:15';
    }
    s.time = now.getHours().toString().padStart(2, '0') + ':' +
             now.getMinutes().toString().padStart(2, '0');
    return s;
  }

  /* ⏱️ منخفض التردد يوم الجمعة/السبت */
  function isWeekend() { var d = cairoDay(); return d === 5 || d === 6; }

  window.EGXClock = {
    now: cairoNow,
    state: egxState,
    weekend: isWeekend,
    /* فترة التحديث بالثواني حسب الحالة */
    period: function (d) { return egxState(d).p; },
    /* السوق مفتوح فعلياً؟ */
    isOpen: function (d) { return egxState(d).open; },
    sessions: SESSIONS,
  };
})();
