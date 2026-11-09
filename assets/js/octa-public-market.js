/* ════════════════════════════════════════════════════════════════
   🌍 فلتر السوق العام — من غير تسجيل دخول
   ────────────────────────────────────────────────────────────────
   📌 ٩ نوفمبر ٢٠٢٦ — الواجهة العامة للموقع.
   📌 كل البيانات هنا **عامة** (من غير جلسة):
     · مصر      ⇒ /api/quotes?market=egypt (٢٩٧ سهم · أسعار حيّة)
     · السعودية/الإمارات/أمريكا ⇒ مسح TradingView من المتصفح
   📌 ⛔ مفيش أي بيانات محمية (قرار OCTA · الدرجة · المحفظة).
   📌 ⛔ مفيش أرقام مخترعة: أي حقل مش موجود بيفضل فاضي (مش صفر).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ⭐ الوحدات */
  const MK = [
    { id: 'egypt', i: '🇪🇬', n: 'بورصة مصر', cur: 'ج.م', src: 'quotes' },
    { id: 'saudi', i: '🇸🇦', n: 'السعودية', cur: 'ر.س', src: 'scan' },
    { id: 'uae', i: '🇦🇪', n: 'الإمارات', cur: 'د.إ', src: 'scan' },
    { id: 'us', i: '🇺🇸', n: 'أمريكا', cur: '$', src: 'scan' }
  ];

  const S = { mk: 'egypt', q: '', sect: 'all', chg: 'all', sort: 'mc', shown: 40 };
  let ROWS = [], LOADED = {};

  const $ = (id) => document.getElementById(id);
  const elRows = $('pmRows'), elCount = $('pmCount'), elMore = $('pmMore'), elEmpty = $('pmEmpty');

  /* ── تنسيق ── */
  function f2(v) { return (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function f0(v) { return (v == null || isNaN(v)) ? '—' : Math.round(Number(v)).toLocaleString('en-US'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function big(v) {
    if (v == null || isNaN(v)) return '—';
    const n = Number(v);
    if (n >= 1e9) return (n / 1e9).toFixed(1) + ' مليار';
    if (n >= 1e6) return (n / 1e6).toFixed(0) + ' مليون';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + ' ألف';
    return f0(n);
  }
  function chgCls(v) { return (v == null || isNaN(v)) ? 'pm-na' : (Number(v) > 0 ? 'pm-up' : (Number(v) < 0 ? 'pm-down' : 'pm-na')); }
  function chgTxt(v) { return (v == null || isNaN(v)) ? '—' : (Number(v) > 0 ? '+' : '') + Number(v).toFixed(2) + '%'; }

  /* ⭐ القطاعات (نفس خريطة التطبيق — مصدر واحد) */
  const SEC_AR = (typeof window !== 'undefined' && window.OCTA_SEC_AR) ? window.OCTA_SEC_AR : {
    'Finance': 'مالية', 'Bank': 'بنوك', 'Banks': 'بنوك', 'Financial Services': 'خدمات مالية',
    'Process Industries': 'صناعات عملية', 'Consumer Non-Durables': 'سلع استهلاكية',
    'Consumer Durables': 'سلع معمّرة', 'Health Technology': 'رعاية صحية',
    'Healthcare': 'رعاية صحية', 'Technology': 'تكنولوجيا', 'Technology Services': 'خدمات تكنولوجيا',
    'Transportation': 'نقل', 'Energy': 'طاقة', 'Oil & Gas': 'نفط وغاز',
    'Consumer Cyclical': 'استهلاكي متكرر', 'Consumer Defensive': 'استهلاكي أساسي',
    'Utilities': 'مرافق', 'Real Estate': 'عقارات', 'Basic Materials': 'مواد أساسية',
    'Industrials': 'صناعة', 'Communication Services': 'اتصالات', 'Retail': 'تجزئة',
    'Retail Trade': 'تجزئة', 'Construction': 'مقاولات', 'Travel & Tourism': 'سياحة',
    'Education': 'تعليم', 'Food & Beverage': 'أغذية', 'Agriculture': 'زراعة',
    'Mining': 'تعدين', 'Semiconductors': 'أشباه موصلات', 'Software': 'برمجيات',
    'Internet': 'إنترنت', 'Media': 'إعلام', 'Insurance': 'تأمين',
    'Biotechnology': 'بيوتكولوجيا', 'Pharmaceuticals': 'أدوية',
    'Medical Devices': 'أجهزة طبية', 'Auto Components': 'قطع غيار'
  };
  function sectorAr(raw) {
    const r = String(raw || 'عام');
    if (/[؀-ۿ]/.test(r)) return r;
    return SEC_AR[r] || r;
  }

  /* ── التحميل ── */
  function loadEgypt(cb) {
    if (LOADED.egypt) { cb(LOADED.egypt); return; }
    const names = (window.OCTA_EGX_NAMES && window.OCTA_EGX_NAMES.names) || {};
    const sectors = (window.OCTA_EGX_NAMES && window.OCTA_EGX_NAMES.sectors) || {};
    fetch('/api/quotes?market=egypt', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const src = (j && j.markets && j.markets.egypt) || {};
        const rows = [];
        for (const code in src) {
          const q = src[code] || {};
          const price = q.close;
          if (price == null) continue;          /* ⛔ بلا سعر ⇒ ما نورّدهوش */
          rows.push({
            code: code,
            name: names[code] || '',
            sector: sectors[code] || '',
            price: price,
            change: (q.change == null ? null : Number(q.change)),
            mc: (q.market_cap_basic == null ? null : Number(q.market_cap_basic)),
            vol: (q.volume == null ? null : Number(q.volume))
          });
        }
        LOADED.egypt = rows;
        cb(rows);
      })
      .catch(() => cb([]));
  }

  function loadScan(mk, cb) {
    if (LOADED[mk]) { cb(LOADED[mk]); return; }
    if (!window.OCTAMkScan || !window.OCTAMkScan.has(mk)) { cb([]); return; }
    window.OCTAMkScan.scan(mk, function (rows) {
      const out = (rows || []).map(r => ({
        code: r.code,
        name: r.name || r.nameEn || r.code,
        sector: sectorAr(r.sector),
        price: (r.price == null ? null : Number(r.price)),
        change: (r.change == null ? null : Number(r.change)),
        mc: (r.mc == null ? null : Number(r.mc)),
        vol: (r.volume == null ? null : Number(r.volume))
      })).filter(r => r.price != null);
      LOADED[mk] = out;
      cb(out);
    });
  }

  function load(mk, cb) {
    const m = MK.find(x => x.id === mk);
    if (!m) { cb([]); return; }
    if (m.src === 'quotes') loadEgypt(cb);
    else loadScan(mk, cb);
  }

  /* ── الفلترة والترتيب ── */
  function filtered() {
    const q = S.q.trim().toLowerCase();
    let out = ROWS.filter(function (r) {
      if (q) {
        const c = (r.code || '').toLowerCase();
        const n = (r.name || '').toLowerCase();
        if (c.indexOf(q) < 0 && n.indexOf(q) < 0) return false;
      }
      if (S.sect !== 'all' && r.sector !== S.sect) return false;
      if (S.chg === 'up' && !(r.change > 0)) return false;
      if (S.chg === 'down' && !(r.change < 0)) return false;
      return true;
    });
    const k = S.sort;
    out.sort(function (a, b) {
      let x = a[k], y = b[k];
      if (k === 'name') return String(a.name || a.code).localeCompare(String(b.name || b.code), 'ar');
      if (x == null) return 1;
      if (y == null) return -1;
      return (Number(y) - Number(x));
    });
    return out;
  }

  /* ── الرسم ── */
  function rowHTML(r) {
    const m = MK.find(x => x.id === S.mk);
    return '<div class="pm-row">' +
      '<div class="pm-row-main">' +
      '<div class="pm-row-code">' + esc(r.code) + '</div>' +
      '<div class="pm-row-name">' + esc(r.name || r.code) + '</div>' +
      '<div class="pm-row-sect">' + esc(r.sector || '—') + '</div>' +
      '</div>' +
      '<div class="pm-row-num">' +
      '<div class="pm-row-price">' + f2(r.price) + ' <span class="pm-row-chg ' + chgCls(r.change) + '">' + chgTxt(r.change) + '</span></div>' +
      '<div class="pm-row-mc">القيمة السوقية: ' + big(r.mc) + (m ? ' ' + m.cur : '') + '</div>' +
      '</div>' +
      '<div class="pm-row-num pm-row-mc">حجم التداول: ' + (r.vol == null ? '—' : f0(r.vol)) + '</div>' +
      '</div>';
  }

  function render() {
    const rows = filtered();
    const m = MK.find(x => x.id === S.mk) || MK[0];
    elCount.textContent = rows.length
      ? (rows.length + ' سهم · ' + m.n)
      : (m.n + ' — مفيش بيانات');
    const part = rows.slice(0, S.shown);
    elRows.innerHTML = part.map(rowHTML).join('');
    elMore.hidden = rows.length <= S.shown;
    elMore.textContent = 'عرض المزيد (' + Math.max(0, rows.length - S.shown) + ' باقي)';
    elEmpty.hidden = rows.length > 0;
    /* ⭐ قائمة القطاعات حسب الداتا الحالية */
    const sel = $('pmSect');
    const secSet = {};
    ROWS.forEach(r => { if (r.sector) secSet[r.sector] = (secSet[r.sector] || 0) + 1; });
    const secs = Object.keys(secSet).sort((a, b) => secSet[b] - secSet[a]);
    if (sel.dataset.mk !== S.mk) {
      sel.dataset.mk = S.mk;
      sel.innerHTML = '<option value="all">كل القطاعات</option>' +
        secs.map(s => '<option value="' + esc(s) + '">' + esc(s) + ' (' + secSet[s] + ')</option>').join('');
      sel.value = 'all';
      S.sect = 'all';
    }
  
  try { if (typeof window.__pmBootDone === 'function') window.__pmBootDone(); } catch (e) { }
}

  function setMk(mk) {
    S.mk = mk; S.shown = 40; S.q = ''; S.sect = 'all'; S.chg = 'all';
    const qEl = $('pmQ'); if (qEl) qEl.value = '';
    Array.prototype.forEach.call(document.querySelectorAll('#pmMk button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-mk') === mk);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.pm-chip'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-chg') === 'all');
    });
    elRows.innerHTML = '';
    elCount.textContent = '…';
    load(mk, function (rows) {
      ROWS = rows;
      render();
    });
  }

  /* ── التشغيل ── */
  function boot() {
    const mkWrap = $('pmMk');
    if (mkWrap) {
      mkWrap.innerHTML = MK.map(m =>
        '<button data-mk="' + m.id + '" class="' + (m.id === S.mk ? 'on' : '') + '">' +
        m.i + ' ' + esc(m.n) + '</button>').join('');
      mkWrap.addEventListener('click', function (e) {
        const b = e.target.closest ? e.target.closest('button[data-mk]') : null;
        if (!b) return;
        setMk(b.getAttribute('data-mk'));
      });
    }
    const qEl = $('pmQ');
    if (qEl) {
      let t = null;
      qEl.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { S.q = qEl.value; S.shown = 40; render(); }, 180);
      });
    }
    const sel = $('pmSort');
    if (sel) sel.addEventListener('change', function () { S.sort = sel.value; S.shown = 40; render(); });
    const sct = $('pmSect');
    if (sct) sct.addEventListener('change', function () { S.sect = sct.value; S.shown = 40; render(); });
    Array.prototype.forEach.call(document.querySelectorAll('.pm-chip'), function (b) {
      b.addEventListener('click', function () {
        S.chg = b.getAttribute('data-chg'); S.shown = 40;
        Array.prototype.forEach.call(document.querySelectorAll('.pm-chip'), function (x) {
          x.classList.toggle('on', x === b);
        });
        render();
      });
    });
    if (elMore) elMore.addEventListener('click', function () { S.shown += 40; render(); });
    setMk(S.mk);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
