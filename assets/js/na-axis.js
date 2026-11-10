/* ══════════════════════════════════════════════════════════════════════
   ⭐ na-axis.js — صفحة «محور الأخبار» (بورصة هالان)
   ──────────────────────────────────────────────────────────────────────
   📌 الصفحة دي بتجاوب سؤال واحد: **درجة محور الأخبار لكل سهم جت منين؟**
      ⇒ محور حقيقي (مش 45 وهمية) · عدد الأحداث · الأهمية · العنوان.

   📌 المصدر: بورصة هالان (Halan Borsa) — إعلانات وأخبار الشركات الرسمية،
      بتتشغّل عبر MCP وبتتخزّن في Cloudflare KV، والصفحة بتقرأ من الـAPI.

   📌 ⛔ ملاحظة مهمة: هذه **م cherries** صفحة *محور* — مش صفحة «الأخبار» العامة
      (دي RSS من مواقع إخبارية، ومصدرها مختلف تماماً).
   ══════════════════════════════════════════════════════════════════════ */

var NA_DATA = null;
var NA_LOADING = false;
var NA_FILTER = 'all';
var NA_SORT = 'desc';

function naEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function naMatLabel(m) {
  if (m === 'critical') return { t: 'حدث حرج', c: 'red' };
  if (m === 'high') return { t: 'أهمية عالية', c: 'grn' };
  if (m === 'medium') return { t: 'أهمية متوسطة', c: 'gld' };
  return { t: 'أهمية منخفضة', c: 'mut' };
}

function naAxisColor(v) {
  if (v >= 78) return '#16c79a';
  if (v >= 62) return '#d4af37';
  if (v >= 45) return '#ff9f43';
  return '#8b9eb0';
}

async function naLoad() {
  if (NA_DATA || NA_LOADING) { if (NA_DATA) naRender(); return; }
  NA_LOADING = true;
  const box = document.getElementById('naList');
  try {
    const r = await octaFetch(OCTA_API + '/api/halan/axis?_=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    NA_DATA = await r.json();
    naRender();
  } catch (e) {
    if (box) box.innerHTML = '<div class="dv-empty">⚠️ تعذر تحميل المحاور: ' +
      naEsc(e.message || '') + '<br>جرّب تحديث الصفحة.</div>';
  }
  NA_LOADING = false;
}

function naRender() {
  if (!NA_DATA) return;
  const all = NA_DATA.axes || [];

  /* ⭐ بطاقات الأرقام */
  const kpis = document.getElementById('naKpis');
  if (kpis) {
    const real = all.filter(a => a.has_news && a.axis > 45).length;
    const fake = all.filter(a => !a.has_news || a.axis === 45).length;
    const upd = NA_DATA.updatedAt
      ? new Date(NA_DATA.updatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      : '—';
    kpis.innerHTML =
      '<div class="dv-kpi dv-good"><div class="dv-kpi-v">' + all.length + '</div>' +
      '<div class="dv-kpi-l">سهم عنده محور حقيقي</div></div>' +
      '<div class="dv-kpi"><div class="dv-kpi-v">' + fake + '</div>' +
      '<div class="dv-kpi-l">مفيش أحداث (محايد)</div></div>' +
      '<div class="dv-kpi"><div class="dv-kpi-v" style="font-size:1.05rem">' + upd + '</div>' +
      '<div class="dv-kpi-l">آخر تحديث</div></div>';
  }

  /* ⭐ الفلترة */
  let rows = all.filter(a => {
    if (NA_FILTER === 'all') return true;
    return a.materiality === NA_FILTER;
  });
  rows.sort((a, b) => NA_SORT === 'desc' ? (b.axis - a.axis) : (a.axis - b.axis));

  const h = document.getElementById('naSecH');
  if (h) h.innerHTML = '📋 كل الأسهم <span class="dv-s">' + rows.length + ' سهم</span>';

  const box = document.getElementById('naList');
  if (!box) return;
  if (!rows.length) {
    box.innerHTML = '<div class="dv-empty">📭 مفيش أسهم في الفلتر ده.</div>';
  } else {
    box.innerHTML = rows.map(function (a) {
      const m = naMatLabel(a.materiality);
      const col = naAxisColor(a.axis);
      const hl = String(a.headline || '').slice(0, 150);
      /* ⭐ بنستخدم كلاسات dv-i1 / dv-i2 / dv-i3 الموجودة في الـCSS */
      return '<div class="dv-item">' +
        '<div class="dv-i1">' +
        '<div class="dv-code">' + naEsc(a.code) + '</div>' +
        '<div class="dv-name">' + (hl ? naEsc(hl) : '—') + '</div>' +
        '</div>' +
        '<div class="dv-i2">' +
        '<div class="dv-val" style="color:' + col + '">' + naEsc(a.axis) + '</div>' +
        '<div class="dv-yld">من 100</div>' +
        '</div>' +
        '<div class="dv-i3">' +
        '<span class="dv-tag k">' + m.t + '</span>' +
        '<span class="dv-tag up">' + naEsc(a.events) + ' حدث</span>' +
        '<span class="dv-tag">بورصة هالان</span>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  const src = document.getElementById('naSrc');
  if (src) src.innerHTML = '📡 المصدر: <b>' + naEsc(NA_DATA.source || 'بورصة هالان') + '</b> · ' +
    all.length + ' سهم · التحديث كل 30 دقيقة';
}

/* ⭐ أزرار الفلترة والترتيب */
document.addEventListener('click', function (e) {
  const b = e.target && e.target.closest ? e.target.closest('[data-naf],[data-nas]') : null;
  if (!b) return;
  if (b.dataset.naf) {
    NA_FILTER = b.dataset.naf;
    document.querySelectorAll('[data-naf]').forEach(function (x) {
      x.classList.toggle('active', x === b);
    });
  } else if (b.dataset.nas) {
    NA_SORT = b.dataset.nas;
    document.querySelectorAll('[data-nas]').forEach(function (x) {
      x.classList.toggle('active', x === b);
    });
  }
  naRender();
});
