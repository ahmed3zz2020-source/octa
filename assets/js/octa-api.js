/* ══════════════════════════════════════════════════════════════
   🔌 مدير السيرفرات — لو السيرفر الأساسي وقع، جرّب التاني
   ──────────────────────────────────────────────────────────────
   🎯 مش بنحتاج نغيّر الكود لو نقلنا لسيرفر جديد — بدّل السطر ده وخلاص
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* 🎯 كل السيرفرات بالترتيب — الأول اللي شغال هو المستخدم */
  const SERVERS = [
    { name: 'railway', url: 'https://octa-prices-production-4ccb.up.railway.app', on: true },
    /* ↑ سيرفر احتياطي (Render مثلاً) — حطّه هنا وخلي on:true */
    /* { name: 'render',  url: 'https://octa-prices.onrender.com',       on: false } */
  ];

  /* نحفظ الـfetch الأصلي قبل ما نلفّه (لأن window.fetch بيتغيّر) */
  const ORIG_FETCH = (typeof window !== 'undefined' && window.fetch)
    ? window.fetch.bind(window) : null;
  if (!ORIG_FETCH) { /* مفيش fetch — نخرج بهدوء */ return; }

  let active = -1;          /* رقم السيرفر اللي شغال */
  let fails = {};          /* عدّاد فشل لكل سيرفر */

  function base() {
    if (active < 0) {
      for (let i = 0; i < SERVERS.length; i++) {
        if (SERVERS[i].on) { active = i; break; }
      }
    }
    return SERVERS[active >= 0 ? active : 0].url;
  }

  window.OCTADev = window.OCTADev || {};

  window.OCTA_API = base();

  /* 🔄 بدّل السيرفر النشط */
  window.OCTAServer = {
    list: SERVERS,
    current: () => SERVERS[active < 0 ? 0 : active],
    /* لو السيرفر فشل ن times → جرّب اللي بعده */
    failover: function () {
      fails[active] = (fails[active] || 0) + 1;
      for (let i = 0; i < SERVERS.length; i++) {
        if (!SERVERS[i].on || i === active) continue;
        active = i;
        window.OCTA_API = SERVERS[i].url;
        console.warn('[OCTA] السيرفر الرئيسي واقع — تحوّل لـ', SERVERS[i].name);
        return true;
      }
      return false;
    },
    failed: (i) => fails[i || active] || 0,
  };

  /* 🩺 شغّل على السيرفر التاني لو الرئيسي واقع */
  const ORIG = ORIG_FETCH;
  window.fetch = function (url, opts) {
    const s = String(url || '');
    if (s.indexOf(SERVERS[0].url) !== 0) return ORIG.apply(this, arguments);

    return ORIG.apply(this, arguments)
      .then(function (r) {
        /* السيرفر رجّع error حقيقي (مش شبكة) — مفيش failover */
        if (r.status >= 500) window.OCTAServer.failover();
        return r;
      })
      .catch(function (e) {
        /* شبكة — جرّب السيرفر التاني */
        window.OCTAServer.failover();
        const nu = String(url).replace(SERVERS[0].url, window.OCTA_API);
        return ORIG.call(window, nu, opts);
      });
  };
})();
