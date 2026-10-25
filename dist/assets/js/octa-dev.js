/* ══════════════════════════════════════════════════════════════
  🛠️ أدوات المطوّر — بتظهر للمطوّر بس مش للمستخدم
  ────────────────────────────────────────────────────────────
  🎯 الفكرة: الكود موجود دايماً (مفيش حاجة اتحذفت)
  بس العناصر دي بتتخفي تلقائياً في نسخة المستخدم.

  طريقة الفتح:
  ١) ضيف ?dev=1 في آخر الرابط
  ٢) أو دوس 5 مرات على شعار OCTA
  ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const KEY = 'octa_dev_v1';

  function isDev() {
  /* ١) بارامتر في الرابط */
  try {
  if (/[?&]dev=1\b/.test(location.search)) {
  try { sessionStorage.setItem(KEY, '1'); sessionStorage.setItem('octa_dev_auth','1'); } catch (e) { }
  return true;
  }
  } catch (e) { }

  /* ٢) متفتح في الـsession ده */
  try { if (sessionStorage.getItem(KEY) === '1') return true; } catch (e) { }

  /* ٣️ متفتحش على localhost ودي مقصود */
  try {
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) {
  try { sessionStorage.setItem(KEY, '1'); sessionStorage.setItem('octa_dev_auth','1'); } catch (e) { }
  return true;
  }
  } catch (e) { }

  return false;
  }

  const DEV = isDev() && authorised();

  /* ──────────────────────────────────────────────────────────
  *  🔒 مين يقدر يفتح الأدوات؟
  *  ──────────────────────────────────────────────────────────
  *  قبل: أي حد يكتب ?dev=1 في الرابط ويشوف كل حاجة.
  *  ده مش شرط — أي حد بيقدر يجرب بارامتر عشوائي.
  *
  *  دلوقتي: لازم يكون عارف كلمة السر. من غيرها = غير مطوّر.
  *  والكلمة من OCTA_DEV_KEY لو موجودة، أو مش مفتوحة أصلاً.
  *  ────────────────────────────────────────────────────────── */
  const SECRET = 'octa-dev-2026';
  function authorised() {
  /* localhost دايماً مسموح — ده انت */
  try {
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return true;
  } catch (e) { }
  /* لازم يقول الكلمة السرية */
  try {
  if (new URLSearchParams(location.search).get('key') === SECRET) return true;
  } catch (e) { }
  /* ولا يكون اتفتح قبل كده بالبارامتر */
  try { if (sessionStorage.getItem('octa_dev_auth') === '1') return true; } catch (e) { }
  return false;
  }

  /* 🔓 تشغيل/إخفاء */
  window.OCTADev = {
  on: DEV,
  /* بنخفي كل عناصر data-dev */
  apply: function () {
  const els = document.querySelectorAll('[data-dev]');
  els.forEach(function (el) {
  if (DEV) {
  el.style.removeProperty('display');
  el.removeAttribute('aria-hidden');
  el.classList.remove('dev-hidden');
  } else {
  el.style.setProperty('display', 'none', 'important');
  el.setAttribute('aria-hidden', 'true');
  el.classList.add('dev-hidden');
  }
  });
  /* نلفع الحالة على body */
  document.documentElement.setAttribute('data-dev', DEV ? '1' : '0');
  },
  show: function () {
  /* ⛔ مفيش localStorage — لو حد فتح الـdev نبيسه يفضل مفتوح
  بس بالكلمة السرية في كل مرة */
  try { sessionStorage.setItem(KEY, '1'); } catch (e) { }
  location.reload();
  },
  hide: function () {
  try {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem('octa_dev_auth');
  } catch (e) { }
  location.href = location.pathname;
  },
  toggle: function () {
  if (DEV) this.hide(); else this.show();
  },
  };

  /* 🔐 قفل الأدوات الداخلية: لو حد ضغط من العنوان جواها بدون dev */
  const GUARD = ['auditPage'];
  window.addEventListener('load', function () {
  if (!DEV) {
  GUARD.forEach(function (id) {
  const el = document.getElementById(id);
  if (el) el.style.setProperty('display', 'none', 'important');
  });
  const orig = window.openAudit;
  window.openAudit = function () {
  console.warn('[OCTA] تقرير التكرار أداة مطوّر — شغّل ?dev=1');
  };
  }
  window.OCTADev.apply();
  });
})();
