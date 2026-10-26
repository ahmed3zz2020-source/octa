/* ═══ OCTA · octa-pages.js · 194KB ═══ */
/* REMOVED: initFloatingBall and its DOMContentLoaded hook.
  The ball markup is gone from index.html along with the tracker;
  the handler would have been dead code pointing at a removed service. */



function safeDate(d) {
  if (!d) return null;
  let s = String(d).trim();
  // شيل +00:00 في الآخر — Safari مش بيقبلها
  s = s.replace(/\+00:00Z$/, 'Z').replace(/\+00:00$/, 'Z');
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}
function safeTime(d) {
  const dt = safeDate(d);
  return dt ? dt.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

/* ═══════════ DIVIDENDS PAGE ═══════════ */
let DIV_DATA = null;
let DIV_FILTERS = { type: 'all', status: 'all', yield: 'all' };
let DIV_SORT = { key: 'date', dir: -1 };
let DIV_LOADING = false;


function sortDivBy(key) {
  if (DIV_SORT.key === key) DIV_SORT.dir *= -1;
  else DIV_SORT = { key, dir: -1 };
}

function fmtDate(d) {
  if (!d) return '—';
  try {
  const dt = safeDate(d);
  return dt ? dt.toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  } catch (e) { return d; }
}

function daysUntil(d) {
  if (!d) return null;
  const dt = safeDate(d); if (!dt) return null; return Math.ceil((dt - new Date()) / 86400000);
}

function statusBadge(a) {
  const map = { upcoming: ['قادم', 'upcoming'], recent: ['آخر 30 يوم', 'recent'], past: ['منتهي', 'past'] };
  const [label, cls] = map[a.status] || ['—', 'past'];
  return `<span class="div-badge ${cls}">${label}</span>`;
}

function typeBadge(a) {
  const map = {
  cash: ['💰 نقدي', 'cash'], stock: ['📈 أسهم', 'stock'],
  stock_split: ['✂️ تقسيم', 'split'], rights_issue: ['📋 زيادة رأس مال', 'rights']
  };
  const [label, cls] = map[a.kind] || [a.kindAr || a.kind, 'cash'];
  return `<span class="div-badge ${cls}">${label}</span>`;
}

function valueCell(a) {
  if (a.mode === 'cash' && a.value) {
  return `<span class="div-val-cash">${Number(a.value).toFixed(2)} EGP</span>`;
  }
  if (a.mode === 'stock' && a.ratio) {
  const pct = a.ratio.pct;
  return `<span class="div-val-stock">+${pct !== null ? pct.toFixed(2) : '?'}%</span><br><small style="color:var(--muted);font-size:0.68rem;">${a.ratio.newShares} / ${a.ratio.perShares}</small>`;
  }
  return '<span style="color:var(--muted)">—</span>';
}


function openTradingView(code, name) {
  const old = document.getElementById('tv-chart-modal');
  if (old) old.remove();
  const wrap = document.createElement('div');
  wrap.id = 'tv-chart-modal';
  wrap.className = 'tv-modal-overlay';
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
  wrap.innerHTML = `
  <div class="tv-modal-box">
  <div class="tv-modal-head">
  <div>
  <div class="tv-modal-title">${code}${name ? ' — ' + name : ''}</div>
  <div class="tv-modal-sub">📈 EGX:${code} • (TradingView)</div>
  </div>
  <div class="tv-modal-actions">
  <a href="https://www.tradingview.com/chart/?symbol=EGX:${code}" target="_blank" rel="noopener"
  class="tv-btn">🔗 فتح في موقع التحليل</a>
  <button class="tv-btn ghost" onclick="document.getElementById('tv-chart-modal').remove()">✕</button>
  </div>
  </div>
  <div class="tv-modal-body" id="tv-chart-holder"></div>
  </div>`;
  document.body.appendChild(wrap);

  const cfg = {
  symbol: 'EGX:' + code,
  width: '100%', height: 520, locale: 'ar',
  colorTheme: 'dark', isTransparent: true,
  interval: 'D', timezone: 'Africa/Cairo',
  theme: 'dark', style: '1', autosize: true,
  withdateranges: true, hide_side_toolbar: false,
  allow_symbol_change: true,
  studies: [
  'MASimple@tv-basicstudies', 'RSI@tv-basicstudies', 'MACD@tv-basicstudies'
  ]
  };
  const holder = wrap.querySelector('#tv-chart-holder');
  holder.innerHTML = '';
  /* ✅ 19 أكتوبر 2026 — شارت TradingView واحد (tv-shim.js).
     ⛌ القديم: s3.tradingview.com/external-embedding/... → widget
        بيتولد ناقص ويفضل فاضي (∅) — نفس المشكلة في كل места. */
  try {
    window.OCTA_TV.whenSized(holder, function () {
      window.OCTA_TV.mount(holder, { symbol: cfg.symbol, interval: '1D' });
    });
  } catch (e) {
    holder.innerHTML = '<div class="si-empty">تعذر تحميل الرسم البياني</div>';
  }
}

function lastCloseCell(a) {
  const v = a.lastClose || (LIVE_PRICES && LIVE_PRICES[a.code] ? Number(LIVE_PRICES[a.code].price) : null);
  if (!v) return '<span class="div-yield-na" title="السعر غير متاح">—</span>';
  return `<span style="color:var(--txt);font-weight:700;">${Number(v).toFixed(2)}</span>`;
}

function yieldCell(a) {
  if (a.mode !== 'cash') return '<span class="div-yield-na">غير منطبق</span>';
  if (a.yieldPct === null || a.yieldPct === undefined) {
  return '<span class="div-yield-na" title="السعر غير متاح">—</span>';
  }
  return `<span class="div-yield">${a.yieldPct}%</span>`;
}

function applyDivFilters() {
  if (!DIV_DATA) return [];
  if (!Array.isArray(DIV_DATA.actions)) return [];
  let list = [...DIV_DATA.actions];
  const f = DIV_FILTERS;
  if (f.type !== 'all') list = list.filter(a => f.type === 'cash' ? a.mode === 'cash' : a.mode === 'stock');
  if (f.status !== 'all') list = list.filter(a => a.status === f.status);
  if (f.yield !== 'all') {
  list = list.filter(a => {
  const y = a.yieldPct;
  if (y === null || y === undefined) return false;
  if (f.yield === 'lt2') return y < 2;
  if (f.yield === '2to5') return y >= 2 && y < 5;
  if (f.yield === '5to10') return y >= 5 && y < 10;
  if (f.yield === 'gt10') return y >= 10;
  });
  }
  const { key, dir } = DIV_SORT;
  list.sort((a, b) => {
  let va = a[key], vb = b[key];
  if (key === 'yieldPct') { va = va ?? -999; vb = vb ?? -999; }
  if (va === null) va = '';
  if (vb === null) vb = '';
  if (typeof va === 'string') return va.localeCompare(vb) * dir;
  return (va - vb) * dir;
  });
  return list;
}



function openDivModal(id) {
  if (!DIV_DATA) return;
  const a = DIV_DATA.actions.find(x => x.id === id);
  if (!a) return;
  const d = daysUntil(a.date);
  const price = (LIVE_PRICES && LIVE_PRICES[a.code]) ? Number(LIVE_PRICES[a.code].price) : null;
  showModal(`
  <button class="modal-close" onclick="closeModal()">×</button>
  <h3>${a.code} — ${a.nameAr || ''}</h3>
  <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;">
  ${typeBadge(a)} ${statusBadge(a)}
  </div>
  <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:14px;margin-bottom:12px;">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
  <div><div style="color:var(--muted);font-size:0.74rem;">القيمة</div><div style="font-size:1.05rem;font-weight:800;margin-top:3px;">${valueCell(a)}</div></div>
  <div><div style="color:var(--muted);font-size:0.74rem;">نسبة التوزيع / الإغلاق</div><div style="margin-top:3px;">${yieldCell(a)}</div></div>
  ${price ? `<div><div style="color:var(--muted);font-size:0.74rem;">آخر سعر</div><div style="font-size:1.05rem;font-weight:800;margin-top:3px;">${price.toFixed(2)} EGP</div></div>` : ''}
  <div><div style="color:var(--muted);font-size:0.74rem;">تاريخ الاستحقاق</div><div style="font-weight:800;margin-top:3px;">${fmtDate(a.recordDate)}</div></div>
  <div><div style="color:var(--muted);font-size:0.74rem;">تاريخ الصرف</div><div style="font-weight:800;margin-top:3px;">${fmtDate(a.distributionDate)}</div></div>
  ${d !== null ? `<div><div style="color:var(--muted);font-size:0.74rem;">المتبقي</div><div style="font-weight:800;margin-top:3px;color:${d < 0 ? 'var(--red2)' : d <= 7 ? 'var(--gold)' : 'var(--sec)'}">${d < 0 ? 'منتهي' : d + ' يوم'}</div></div>` : ''}
  ${a.couponNumber ? `<div><div style="color:var(--muted);font-size:0.74rem;">رقم الكوبون</div><div style="font-weight:800;margin-top:3px;">${a.couponNumber}</div></div>` : ''}
  </div>
  </div>
  ${a.mode === 'stock' ? '<div style="background:rgba(77,171,247,0.1);border-left:3px solid var(--sec2);padding:10px;border-radius:8px;font-size:0.8rem;color:var(--txt);">📈 ده <strong>توزيع أسهم</strong> مش نقدي. يعني بتاخد أسهم زيادة — مش عائد نقدي.</div>' : ''}
  <div style="color:var(--muted);font-size:0.7rem;text-align:center;margin-top:12px;border-top:1px solid var(--line);padding-top:10px;">
  المصدر: ${DIV_DATA.source || '—'}<br>آخر تحديث: ${DIV_DATA.lastUpdate ? safeTime(DIV_DATA.lastUpdate) : '—'}
  </div>
  `);
}



function renderHomeDividends() {
  if (!DIV_DATA) return;
  const s = DIV_DATA.stats || {};
  const el = id => document.getElementById(id);
  if (el('hd-count')) el('hd-count').textContent = s.upcomingCount || 0;
  if (el('hd-cash')) el('hd-cash').textContent = (s.totalCashEGP || 0).toFixed(1);
  if (el('hd-week')) el('hd-week').textContent = s.in7Days || 0;
  const n = s.nextUpcoming;
  if (el('hd-next')) el('hd-next').textContent = n ? n.code : '—';
  if (el('hd-sub') && n) {
  const d = daysUntil(n.date);
  el('hd-sub').textContent = d !== null ? (d < 0 ? 'آخرها انتهى' : 'أقرب خلال ' + d + ' يوم') : 'اضغط للدخول للتفاصيل';
  }
  // قائمة أقرب 3
  const list = el('hd-list');
  if (list) {
  const soon = (DIV_DATA.actions || []).filter(a => a.status === 'upcoming').slice(0, 3);
  list.innerHTML = soon.length ? soon.map(a => {
  const d = daysUntil(a.date);
  const v = a.mode === 'cash'
  ? `<span class="div-val-cash">${Number(a.value).toFixed(2)} EGP</span>`
  : `<span class="div-val-stock">+${(a.ratio || {}).pct}% أسهم</span>`;
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 9px;background:rgba(255,255,255,0.03);border-radius:8px;font-size:0.78rem;">
  <span style="display:flex;align-items:center;gap:6px;font-weight:800;">${stockLogo(a.code)}${typeBadge(a)} ${a.code}</span>
  <span style="color:var(--muted);font-size:0.7rem;">${d !== null ? d + ' يوم' : ''}</span>
  <span>${v}</span>
  </div>`;
  }).join('') : '<div style="text-align:center;color:var(--muted);padding:10px;font-size:0.78rem;">📭 لا توجد توزيعات قادمة</div>';
  }
}


/* ═══ لوجوهات ═══ */
const LOGO_HAVE = new Set([]);

function stockLogo(code, cls) {
  const big = cls === 'lg';
  const init = String(code || '?').slice(0, 2);
  return `<span class="stock-logo-box${big ? ' lg' : ''}"><div class="logo-fallback${big ? ' lg' : ''}">${init}</div></span>`;
}
/* ════════ تحكم الشريط المتحرك ════════ */
let TICKER_PAUSED = false;
let TICKER_DATA = null;

function toggleTicker() {
  TICKER_PAUSED = !TICKER_PAUSED;
  const btn = document.getElementById('tickerCtl');
  const tape = document.getElementById('tickerTape');
  if (btn) {
  btn.textContent = TICKER_PAUSED ? '▶' : '⏸';
  btn.classList.toggle('paused', TICKER_PAUSED);
  btn.title = TICKER_PAUSED ? 'تشغيل الشريط' : 'إيقاف الشريط';
  }
  if (tape) tape.classList.toggle('paused', TICKER_PAUSED);
}

function renderTicker() {
  if (TICKER_PAUSED || !TICKER_DATA) return;
  for (const t of TICKER_DATA) {
  const vEl = document.getElementById(t.id);
  const cEl = document.getElementById(t.id + '-chg');
  if (vEl && t.value) {
  vEl.textContent = Number(t.value).toLocaleString('en-US', { maximumFractionDigits: 2 })
  + (t.unit ? ' ' + t.unit : '');
  }
  if (cEl) {
  const c = Number(t.change || 0);
  cEl.textContent = (c >= 0 ? '▲ +' : '▼ ') + c.toFixed(2) + '%';
  cEl.classList.toggle('negative', c < 0);
  }
  }
}

async function loadTicker() {
  try {
  const res = await octaFetch(OCTA_API + '/api/ticker?_=' + Date.now());
  const data = await res.json();
  if (data.ticker && data.ticker.length) {
  TICKER_DATA = data.ticker;
  renderTicker();
  }
  } catch (e) { /* silent */ }
}


/* ════════════════════════════════════════════════════════════
  PHASE 18: محرك عرض التحليل الكامل
  ════════════════════════════════════════════════════════════ */

const AXIS_LABELS = {
  technical: "التحليل الفني",
  fundamental: "التحليل الأساسي",
  liquidity: "السيولة",
  news: "الأخبار",
  sentiment: "المعنويات",
  risk: "أمان المخاطرة",
  portfolio: "ملاءمة المحفظة"
};

function axisColorClass(v) {
  if (v >= 65) return 'good';
  if (v >= 45) return 'mid';
  return 'bad';
}

async function openIntel(code) {
  const dashPage = document.getElementById('dashPage');
  if (dashPage) dashPage.style.display = 'none';
  const page = document.getElementById('intelPage');
  const loading = document.getElementById('intelLoading');
  const body = document.getElementById('intelBody');
  if (!page) return;

  // نعرض الصفحة ونخفي التاني
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  page.style.display = 'block';
  loading.style.display = 'block';
  body.style.display = 'none';
  window.scrollTo({top: 0, behavior: 'smooth'});

  try {
  /* ⭐ ٢٥ أكتوبر ٢٠٢٦ — لازم OS_DB يكون محمّل (فيه الدرجة والقرار)
     📌 لو المستخدم فتح صفحة السهم من لينك مباشر من غير ما يعدّي على
     📌 ⛌⛌ صفحة الأسهم ⇒ OS_DB فاضي ⇒ الدرجة «—» تاني. */
  try {
  if (typeof octaLoadDB === 'function'
  && (typeof OS_DB === 'undefined' || !OS_DB || !OS_DB.length)) await octaLoadDB();
  } catch (e) { }
  const res = await octaFetch(OCTA_API + '/api/intelligence/' + code);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const d = await res.json();
  if (d.error) throw new Error(d.error);
  renderIntel(d);
  loading.style.display = 'none';
  body.style.display = 'block';
  } catch (e) {
  loading.innerHTML = '<div style="color:var(--red2);padding:40px">' +
  '❌ تعذر تحميل التحليل: ' + (e.message || '') + '</div>' +
  '<button onclick="closeIntel()" style="margin-top:16px;padding:10px 22px;' +
  'background:var(--gold);color:#0a1929;border-radius:10px;font-weight:800">رجوع</button>';
  }
}

function closeIntel() {
  const page = document.getElementById('intelPage');
  if (page) page.style.display = 'none';
  // نرجع للصفحة الرئيسية أو السابقة
  const active = document.querySelector('.nav-btn.active');
  if (active && typeof switchPage === 'function') switchPage(active.dataset.page);
}

function renderIntel(d) {
  const ax = d.axes || {};
  /* ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐ الدرجة والقرار من مصدر واحد (OS_DB)
  📌 السبب: /api/intelligence بيخفي final_score و decision عن قصد ⇒
  📌 ⛌⛌⛌ ⇒ الدائرة كانت «—» والقرار فاضي (والمستخدم مش فاهم السبب).
  📌 ✅ الحل: نفس مصدر كروت السوق — octaStockMeta (من /api/rank المحمي).
  📌    وده نفس الرقم اللي في اللوحة وفي الفلتر — مصدر واحد للكل. */
  const _meta = (typeof octaStockMeta === 'function') ? octaStockMeta(d.code)
           : { score: null, decision: null, confidence: null };
  const _score = (_meta.score != null && isFinite(_meta.score)) ? Math.round(_meta.score)
              : (d.final_score != null && isFinite(d.final_score) ? Math.round(d.final_score) : null);
  const dec = d.decision || _meta.decision || '—';
  const decClass = octaDecCls(dec);

  // المحاور
  let axisHtml = '';
  /* ⭐ ٢٥ أكتوبر ٢٠٢٦ — الأوزان الحقيقية من السيرفر
     📌 كان CFG.weights.intel فاضي ⇒ كل الأوزان «0%» جنب كل محور.
     📌 ✅ الحل: لو الأوزان مش جاهزة ⇒ نستخدم engineWeights (نفس المصدر). */
  const W = (CFG.weights && CFG.weights.intel && Object.keys(CFG.weights.intel).length)
  ? CFG.weights.intel : (CFG.engineWeights || {});
  for (const k of Object.keys(AXIS_LABELS)) {
  const v = ax[k];
  const val = (v === undefined || v === null) ? 0 : Math.round(v);
  axisHtml +=
  '<div class="axis-row-2">' +
  '<span class="axis-name-2">' + AXIS_LABELS[k] + '</span>' +
  '<div class="axis-track-2"><div class="axis-fill-2 ' + axisColorClass(val) + '" style="width:' + val + '%"></div></div>' +
  '<span class="axis-num-2">' + (v === undefined ? '—' : v) + '</span>' +
  '<span class="axis-weight-2">' + (W[k] || 0) + '%</span>' +
  '</div>';
  }

  // القيمة العادلة
  const f = d.fundamental || {};
  let fvHtml = '';
  if (f.fair_value) {
  const up = f.upside_pct || 0;
  fvHtml =
  '<div class="fv-box">' +
  '<div class="fv-label">القيمة العادلة المحسوبة</div>' +
  '<div class="fv-value">' + Number(f.fair_value).toFixed(2) + ' ج.م</div>' +
  '<div class="fv-upside ' + (up >= 0 ? 'pos' : 'neg') + '">' +
  (up >= 0 ? '▲ فرص +' : '▼ ') + up.toFixed(1) + '%' +
  '</div>' +
  '<div class="fv-conf">ثقة التقدير: ' + (f.fair_value_confidence || 0) + '% · السعر الحالي: ' + d.price + ' ج.م</div>' +
  '</div>';
  }

  // الأسباب
  const t = d.technical || {}, fq = d.fundamental || {}, l = d.liquidity || {};
  function listHTML(arr, cls) {
  if (!arr || !arr.length) return '';
  return '<ul class="fact-list">' + arr.slice(0, 5).map(x => '<li class="' + cls + '">' + x + '</li>').join('') + '</ul>';
  }

  // مستوى المخاطرة
  const rl = d.risk_level || '—';
  let riskCls = rl === 'منخفض' ? 'منخفض' : rl === 'متوسط' ? 'متوسط' : rl === 'مرتفع' ? 'مرتفع' : 'مرتفع جداً';

  if (typeof renderStrategies === 'function') { /* ⛔ بينادي بعد بناء الـHTML — تحت */ }
  document.getElementById('intelBody').innerHTML =
  // ═══ الهيدر ═══
  '<div class="intel-hero">' +
  '<div class="intel-code">' + d.code + '</div>' +
  '<div class="intel-name">' + (d.name || '') + '</div>' +
  '<div class="intel-sector">' + (d.sector || '—') + '</div>' +
  '<div class="intel-price">' + Number(d.price).toFixed(2) +
  '<span class="intel-chg ' + (d.change >= 0 ? 'pos' : 'neg') + '">' +
  (d.change >= 0 ? '▲ +' : '▼ ') + Number(d.change).toFixed(2) + '%</span></div>' +
  '<div class="intel-scores">' +
  '<div class="score-circle gold"><div class="sc-val">' + (_score ?? '—') + '</div><div class="sc-label">النتيجة النهائية</div></div>' +
  '<div class="score-circle blue"><div class="sc-val">' + (d.confidence ?? '—') + '%</div><div class="sc-label">الثقة</div></div>' +
  '</div>' +
  '<div style="margin-top:18px">' +
  '<div class="intel-decision ' + decClass + '">' + dec +
  '<small>' + (f.valuation_status ? 'التقييم: ' + f.valuation_status : '') + '</small></div>' +
  '<div style="margin-top:12px">مستوى المخاطرة: <span class="risk-badge ' + riskCls + '">' + rl + '</span></div>' +
  '</div>' +
  '<button onclick="closeIntel()" style="margin-top:20px;padding:9px 26px;background:rgba(255,255,255,0.07);' +
  'border:1px solid rgba(212,175,55,0.3);border-radius:10px;color:var(--gold);font-weight:700">← رجوع</button>' +
  '</div>' +

  // ═══ القيمة العادلة ═══
  (fvHtml ? '<div style="margin-bottom:20px">' + fvHtml + '</div>' : '') +

  // ═══ المحاور ═══
  '<div class="why-box" style="margin-bottom:20px">' +
  '<div class="why-title">📊 تفصيل المحاور الستة والنتيجة</div>' +
  '<div class="axis-bars">' + axisHtml + '</div>' +
  '</div>' +

  // ═══ التفاصيل ═══
  '<div class="intel-grid-2">' +
  // الفني
  '<div class="why-box">' +
  '<div class="why-title">📈 التحليل الفني (' + (t.score ?? '—') + '/100 — ' + (t.signal || '') + ')</div>' +
  (t.positives && t.positives.length ? '<div style="font-size:0.82rem;color:var(--muted);margin-bottom:6px">✅ إيجابيات</div>' + listHTML(t.positives, 'pos') : '') +
  (t.negatives && t.negatives.length ? '<div style="font-size:0.82rem;color:var(--muted);margin:10px 0 6px">❌ سلبيات</div>' + listHTML(t.negatives, 'neg') : '') +
  (t.positives && t.positives.length && t.negatives && t.negatives.length ? '' :
  '<div style="color:var(--muted);font-size:0.86rem">لا توجد تفاصيل — البيانات الفنية غير متاحة حالياً</div>') +
  (t.levels && t.levels['دعم_1'] ? '<div style="margin-top:12px;font-size:0.84rem;color:var(--muted)">' +
  '📍 الدعم: <b style="color:var(--txt)">' + Number(t.levels['دعم_1']).toFixed(2) + '</b> · ' +
  'المقاومة: <b style="color:var(--txt)">' + (t.levels['مقاومة_1'] ? Number(t.levels['مقاومة_1']).toFixed(2) : '—') + '</b></div>' : '') +
  '</div>' +
  // الأساسي
  '<div class="why-box">' +
  '<div class="why-title">📊 التحليل الأساسي (' + (f.score ?? '—') + '/100 — ' + (f.valuation_status || '') + ')</div>' +
  (f.positives && f.positives.length ? listHTML(f.positives, 'pos') : '') +
  (f.negatives && f.negatives.length ? listHTML(f.negatives, 'neg') : '') +
  (f.sector_peers && f.sector_peers['متوسط P/E'] ? 
  '<div style="margin-top:12px;font-size:0.84rem;color:var(--muted)">' +
  '📊 متوسط مضاعف ربحية القطاع: <b style="color:var(--gold)">' + f.sector_peers['متوسط P/E'] + '</b>' +
  (f.sector_peers['عدد المقارنة'] ? ' (' + f.sector_peers['عدد المقارنة'] + ' سهم)' : '') + '</div>' : '') +
  '</div>' +
  // السيولة
  '<div class="why-box">' +
  '<div class="why-title">💧 السيولة (' + (l.score ?? '—') + '/100 — ' + (l.risk_level || '') + ')</div>' +
  (l.positives && l.positives.length ? listHTML(l.positives, 'pos') : '') +
  (l.negatives && l.negatives.length ? listHTML(l.negatives, 'neg') : '') +
  (l.max_safe_position_egp ? '<div style="margin-top:10px;font-size:0.84rem;color:var(--muted)">' +
  '💰 أقصى صفقة آمنة: <b style="color:var(--sec)">' + Number(l.max_safe_position_egp).toLocaleString('en-US', {maximumFractionDigits: 0}) + ' ج.م</b></div>' : '') +
  '</div>' +
  // الاستراتيجيات
  '<div id="stratBox" style="margin-bottom:22px"></div>' +

  // المخاطر المتقدمة
  (function(){
  var rk = d.risk_engine;
  if (!rk) return '';
  var rows = '';
  for (var k in rk.breakdown) {
  var v = rk.breakdown[k];
  if (v > 0) {
  rows += '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05)">' +
  '<span style="color:var(--muted);font-size:0.85rem">' + k + '</span>' +
  '<span style="color:' + (v > 15 ? 'var(--red2)' : v > 8 ? '#ff9800' : 'var(--gold)') + ';font-weight:800">' + v + '</span></div>';
  }
  }
  var risks = (rk.top_risks || []).map(function(r){ return '<li class="neg">' + r.الوصف + '</li>'; }).join('');
  return '<div class="why-box" style="grid-column: 1 / -1">' +
  '<div class="why-title">⚠️ المخاطر المتقدمة — أمان ' + ((rk.safety_score != null) ? rk.safety_score : ((rk.risk_score != null) ? rk.risk_score : '—')) + '/100 (' + rk.risk_level + ')</div>' +
  '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">' +
  '<div>' + rows + (rk.risk_adjusted_opportunity ?
  '<div style="margin-top:10px;padding:8px;background:rgba(212,175,55,0.08);border-radius:8px;font-size:0.85rem">' +
  '📊 عائد/مخاطرة: <b style="color:var(--gold)">' + rk.risk_adjusted_opportunity + '</b></div>' : '') + '</div>' +
  '<div><div style="font-size:0.82rem;color:var(--muted);margin-bottom:6px">أهم المخاطر:</div>' +
  '<ul class="fact-list">' + (risks || '<li class="neu">لا توجد مخاطر بارزة</li>') + '</ul></div>' +
  '</div></div>';
  })() +

  // البيانات
  '<div class="why-box">' +
  '<div class="why-title">🔒 جودة البيانات</div>' +
  '<div style="font-size:0.88rem;line-height:2;color:var(--txt)">' +
  'درجة الثقة بالبيانات: <b style="color:var(--gold)">' + (d.data_confidence ?? '—') + '/100</b><br>' +
  'وقت آخر تحديث: <b style="color:var(--txt)">' + (d.data_ts || '—').slice(0, 19).replace('T', ' ') + '</b>' +
  '</div>' +
  '</div>' +
  '</div>';

  /* ⛔⛔ لازم بعد بناء الـHTML:
     كان بينادي قبل سطر الـinnerHTML، فكان #stratBox لسه مش موجود
     وrenderStrategies كان يعمل return على طول → التبويبات مش بتظهر. */
  if (typeof renderStrategies === 'function') renderStrategies(d.code);
}


/* ════════ PHASE 13: أفضل الفرص ════════ */
let OPPS_LOADED = false;

/* ⛔⛔⛔ المسار ده بقى محمي على السيرفر (401 من غير توكن).
  ⛔ والكود ده كان بيطلبه **قبل الدخول**: setTimeout(loadOpportunities, 800)
  شغّال طول ما البوابة مفتوحة — يعني زائر مجهول كان بيطلبه
  وبياخد 401 وبيشوف "تعذر التحميل".
  ⛌ الحل مش إننا نفتح المسار تاني — الحل نتخطى النداء لحد ما
  يبقى فيه توكن، وبعدين نعيد التحميل لحظة الدخول.
  ⛌ ملاحظة: مبنحطّش OPPS_LOADED هنا — عايزينه يعيد المحاولة بعد الدخول. */
function octaHasToken() {
  try { return !!(localStorage.getItem('octa_token') || ''); } catch (e) { return false; }
}

async function loadOpportunities(force) {
  const grid = document.getElementById('oppsGrid');
  if (!grid) return;
  if (OPPS_LOADED && !force) return;
  if (!octaHasToken()) return;  /* ⛔ لسه داخلش — نتخطى، مش نفتح المسار */
  if (!grid.innerHTML || force) grid.innerHTML = '<div class="opps-loading">جاري التحميل...</div>';
  try {
  const res = await octaFetch(OCTA_API + '/api/ranking?_=' + Date.now());
  const d = await res.json();
  const list = (d.top20 || []).slice(0, 12);
  if (!list.length) { grid.innerHTML = '<div class="opps-loading">لا توجد بيانات</div>'; return; }
  grid.innerHTML = list.map((s, i) => {
  const dec = octaDecCls(s.decision);
  const up = s.upside;
  return '<div class="opp-card" onclick="openIntel(\'' + s.code + '\')">' +
  '<div class="opp-rank">' + (i + 1) + '</div>' +
  '<div class="opp-code">' + s.code + '</div>' +
  '<div class="opp-name">' + (s.name || '') + '</div>' +
  '<div class="opp-score-row">' +
  '<span class="opp-score">' + (s.score ?? 0).toFixed(0) + '</span>' +
  '<span class="opp-conf">' + (s.confidence ?? 0).toFixed(0) + '% ثقة</span>' +
  '</div>' +
  '<div class="opp-bar"><i style="width:' + Math.max(0, Math.min(100, s.score || 0)) + '%"></i></div>' +
  '<div class="opp-meta">' +
  '<span class="opp-dec ' + dec + '">' + s.decision + '</span>' +
  (up != null ? '<span class="opp-up ' + (up >= 0 ? 'pos' : 'neg') + '">' + (up >= 0 ? '▲+' : '▼') + up.toFixed(0) + '%</span>' : '<span style="color:var(--muted)">' + s.risk + '</span>') +
  '</div>' +
  '</div>';
  }).join('');
  OPPS_LOADED = true;
  } catch (e) {
  grid.innerHTML = '<div class="opps-loading" style="color:var(--red2)">تعذر التحميل</div>';
  }
}

// نحمّلها تلقائياً عند فتح الصفحة الرئيسية
(function () {
  /* 🧭 كان غلاف على switchPage. بقى hook — نفس النتيجة
     من غير ما يلمس window.switchPage خالص. */
  if (typeof OS_NAV !== 'undefined' && OS_NAV.on) {
  OS_NAV.on(function (p) { if (p === 'home' || !p) loadOpportunities(); });
  }
  document.addEventListener('DOMContentLoaded', function () { setTimeout(loadOpportunities, 800); setTimeout(loadEarlyOpps, 1800); });

  /* ⛔⛔ لحظة الدخول: البوابة بتنطفي بس الصفحة مش بتتعملها reload،
  فالمحتوى اللي اتخطّى وقت كان الزائر بره ميفتحش لوحده.
  ⛌ البوابة بتطلق الحدث ده بعد ما تتأكد → نحمّل دلوقتي. */
  document.addEventListener('octa:authed', function () {
  setTimeout(function () { loadOpportunities(true); }, 120);
  });
})();


/* ════════ PHASE 12: الفرص المبكرة ════════ */
let EARLY_LOADED = false;

async function loadEarlyOpps(force) {
  const grid = document.getElementById('earlyOpps');
  if (!grid) return;
  if (EARLY_LOADED && !force) return;
  try {
  const res = await octaFetch(OCTA_API + '/api/opportunities?_=' + Date.now());
  const d = await res.json();
  const list = (d.early_opportunities || []).slice(0, 10);
  if (!list.length) {
  grid.innerHTML = '<div class="opps-loading">لا توجد فرص مبكرة — ظروف السوق غير مواتية</div>';
  return;
  }
  grid.innerHTML = list.map(s =>
  '<div class="opp-card" onclick="openIntel(\'' + s.code + '\')">' +
  '<span class="opp-early-tag">' + (s.stage || 'فرصة مبكرة') + '</span>' +
  '<div class="opp-code-2">' + s.code + '</div>' +
  '<div class="opp-name-2">' + (s.name || '') + '</div>' +
  '<div class="opp-score-2">' + (s.score ?? 0).toFixed(0) + '<small>/100</small></div>' +
  '<div class="opp-name-2" style="margin-top:5px">فني ' + (s.technical_score ?? 0).toFixed(0) + ' · نهائي ' + (s.final_score ?? 0).toFixed(0) + '</div>' +
  '</div>'
  ).join('');
  EARLY_LOADED = true;
  } catch (e) {
  grid.innerHTML = '<div class="opps-loading" style="color:var(--red2)">تعذر التحميل</div>';
  }
}


/* ════════ PHASE 14: الاستراتيجيات ════════ */
const STRAT_AXIS = {
  technical: "فني", fundamental: "أساسي", liquidity: "سيولة",
  news: "أخبار", sentiment: "معنويات", risk: "أمان", portfolio: "محفظة"
};
let STRATS = null;
let CUR_STRAT = 'balanced';
const STRAT_CACHE = {};

async function loadStrategies() {
  if (STRATS) return STRATS;
  try {
  const r = await octaFetch(OCTA_API + '/api/strategies');
  const d = await r.json();
  STRATS = d.strategies || [];
  } catch (e) { STRATS = []; }
  return STRATS;
}

async function renderStrategies(code) {
  const box = document.getElementById('stratBox');
  if (!box) return;
  const list = await loadStrategies();
  if (!list.length) { box.innerHTML = '<div class="opps-loading">تعذر تحميل الاستراتيجيات</div>'; return; }
  if (STRAT_CACHE[code] === undefined) STRAT_CACHE[code] = {};
  if (STRAT_CACHE[code][CUR_STRAT] === undefined) {
  try {
  const r = await octaFetch(OCTA_API + '/api/strategy/' + code + '/' + CUR_STRAT);
  const j = await r.json();
  STRAT_CACHE[code][CUR_STRAT] = j.strategy || null;
  } catch (e) { STRAT_CACHE[code][CUR_STRAT] = null; }
  }
  const s = STRAT_CACHE[code][CUR_STRAT];
  const tabs = '<div class="strat-tabs">' + list.map(x =>
  '<button class="strat-tab ' + (x.key === CUR_STRAT ? 'active' : '') + '" onclick="pickStrategy(\'' + x.key + '\')">' +
  x.name + '</button>').join('') + '</div>';
  if (!s) { box.innerHTML = tabs + '<div class="opps-loading">—</div>'; return; }
  const vc = octaDecCls(s.decision);
  /* الأعمدة = نتيجة كل محور (s.axes).
     الأوزان نفسها مخفية عن الـAPI عن قصد (وصفة المحرك) — فبنعرض النتيجة. */
  const A = s.axes || {};
  let abars = '';
  for (var k in A) {
  const av = Math.max(0, Math.min(100, Number(A[k]) || 0));
  abars += '<div class="comp-row"><span class="comp-name">' + (STRAT_AXIS[k] || k) + '</span>' +
  '<div class="comp-track"><div class="comp-fill" style="width:' + av + '%"></div></div>' +
  '<span class="comp-val">' + Math.round(av) + '</span></div>';
  }
  box.innerHTML = tabs +
  '<div class="strat-info">' +
  '<h4>' + s.strategy_name + '</h4>' +
  '<div class="meta">⏱️ ' + s.timeframe + '</div>' +
  '<div class="focus">' + s.focus + '</div>' +
  '<div class="strat-score-row">' +
  '<span class="strat-score-big">' + s.score + '</span>' +
  '<span class="strat-verdict ' + vc + '">' + (s.decision || '—') + '</span>' +
  '<span style="color:var(--muted);font-size:.8rem">ثقة ' + s.confidence + '%</span>' +
  '</div>' +
  '<div style="display:flex;gap:14px;margin-top:10px;font-size:.8rem;color:var(--muted)">' +
  '<span>قبل الخصم: ' + s.base + '</span><span>خصم مخاطرة: ' + Math.abs(s.risk_penalty || 0) + '</span></div>' +
  (s.filter_notes && s.filter_notes.length ?
  '<div style="margin-top:10px">' + s.filter_notes.map(n =>
  '<div style="font-size:.8rem;color:#ff9800;padding:4px 0">⚠️ ' + n + '</div>').join('') + '</div>' : '') +
  '</div>' +
  '<div class="comp-bars">' +
  '<div style="font-size:.75rem;color:var(--muted);margin-bottom:6px">نتيجة كل محور من ١٠٠</div>' +
  abars + '</div>';
}

function pickStrategy(key) {
  CUR_STRAT = key;
  const el = document.querySelector('.intel-code');
  if (el) renderStrategies(el.textContent.trim());
}

/* ════════ PHASE 18: لوحة التحكم ════════ */
let DASH_LOADED = false;

async function loadDashboard(force) {
  if (DASH_LOADED && !force) return;
  const ld = document.getElementById('dashLoading');
  const bd = document.getElementById('dashBody');
  if (!ld || !bd) return;
  ld.style.display = 'block'; bd.style.display = 'none';
  try {
  const r = await octaFetch(OCTA_API + '/api/dashboard?_=' + Date.now());
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  renderDashboard(d);
  ld.style.display = 'none'; bd.style.display = 'block';
  DASH_LOADED = true;
  } catch (e) {
  ld.innerHTML = '<div style="color:var(--red2);padding:30px">❌ ' + (e.message || 'تعذر التحميل') + '</div>';
  }
}

const DASH_AXIS = {
  technical: "التحليل الفني", fundamental: "الأساسي", liquidity: "السيولة",
  news: "الأخبار", sentiment: "المعنويات", portfolio: "المحفظة",
  safety: "أمان المخاطرة", final: "النتيجة النهائية"
};

function axColor(v) {
  return v >= CFG.th.safe ? 'linear-gradient(90deg,#16c79a,#d4af37)' :
  v >= CFG.th.mid ? 'linear-gradient(90deg,#ffc107,#d4af37)' :
  'linear-gradient(90deg,#ff5252,#ff8a65)';
}

function renderDashboard(d) {
  const h = d.health || {};
  const age = h.data_age_minutes;
  const freshCls = (age != null && age < 10) ? 'good' : ((age != null && age < 60) ? '' : 'warn');
  const confCls = (h.avg_data_confidence >= 80) ? 'good' : ((h.avg_data_confidence >= 55) ? '' : 'warn');

  // ═══ KPIs ═══
  let html = '<div class="dash-grid">' +
  '<div class="dash-kpi"><div class="k-val">' + h.stocks + '</div><div class="k-label">سهم محلل</div></div>' +
  '<div class="dash-kpi ' + freshCls + '"><div class="k-val">' + (age != null ? age.toFixed(0) : '—') + '</div><div class="k-label">دقيقة منذ التحديث</div><div class="k-sub">' + (h.freshness || '') + '</div></div>' +
  '<div class="dash-kpi ' + confCls + '"><div class="k-val">' + (h.avg_data_confidence || 0) + '</div><div class="k-label">ثقة البيانات</div></div>' +
  '<div class="dash-kpi"><div class="k-val">' + (d.axis_average.final || 0) + '</div><div class="k-label">متوسط النتيجة</div></div>' +
  '<div class="dash-kpi"><div class="k-val">' + (d.axis_average.safety || 0) + '</div><div class="k-label">متوسط الأمان</div></div>' +
  '<div class="dash-kpi"><div class="k-val">' + (h.invalid_values || 0) + '</div><div class="k-label">قيم مرفوضة</div></div>' +
  '<div class="dash-kpi"><div class="k-val">' + (d.backtest ? d.backtest.snapshots_taken : 0) + '</div><div class="k-label">لقطة اختبار</div></div>' +
  '<div class="dash-kpi"><div class="k-val">' + (d.calibration ? d.calibration.version : '—') + '</div><div class="k-label">نسخة المعايرة</div></div>' +
  '</div>';

  // ═══ متوسط المحاور ═══
  /* أوزان المحرك مخفية عن الـAPI عن قصد (وصفة المحرك) —،
     والنسخة المحلية في CFG.engineWeights هي نفس الأرقام.
     لو الـAPI رجّعها يوم، بنستخدمها هي. */
  const Wapi = (d.weights && Object.keys(d.weights).length) ? d.weights : null;
  const W = Wapi || (CFG.engineWeights || {});
  const Wpct = (function (src) {           // الأوزان كـنسبة مئوية
  var isFrac = src.technical != null && src.technical <= 1;   // الـAPI كسر · المحلي %
  return function (key) {
  var val = src[key];
  if (key === 'safety') val = src.risk;
  if (val == null) return null;
  return Math.round(isFrac ? val * 100 : val);
  };
  })(W);
  let axesHtml = '';
  for (var k in (d.axis_average || {})) {
  var v = d.axis_average[k] || 0;
  var w = Wpct(k);
  axesHtml += '<div class="ad-row">' +
  '<span class="ad-name">' + (DASH_AXIS[k] || k) + '</span>' +
  '<div class="ad-track"><div class="ad-fill" style="width:' + v + '%;background:' + axColor(v) + '"></div></div>' +
  '<span class="ad-val">' + v + '</span><span class="ad-w">' + (w == null ? '—' : w + '%') + '</span></div>';
  }

  // ═══ توزيع القرارات + المخاطر ═══
  function dist(obj, clsMap) {
  var total = Object.values(obj).reduce(function(a,b){return a+b;},0) || 1;
  return Object.entries(obj).sort(function(a,b){return b[1]-a[1];}).map(function(e){
  var cls = clsMap[e[0]] || 'mid';
  var pct = (e[1]/total*100);
  return '<div class="dist-row"><span class="dist-label">' + e[0] + '</span>' +
  '<div class="dist-track"><div class="dist-fill ' + cls + '" style="width:' + pct + '%">' + e[1] + '</div></div></div>';
  }).join('');
  }

  var rows = function(list, positive) {
  return list.map(function(s){
  var cl = octaDecCls(s.decision) === 'buy' ? 'pos' : (octaDecCls(s.decision) === 'sell' ? 'neg' : '');
  return '<tr onclick="openIntel(\'' + s.code + '\')">' +
  '<td><b>' + s.code + '</b></td><td>' + (s.name||'').slice(0,22) + '</td>' +
  '<td>' + (s.sector||'—') + '</td><td>' + Number(s.price||0).toFixed(2) + '</td>' +
  '<td><b style="color:var(--gold)">' + s.score + '</b></td>' +
  '<td class="' + cl + '">' + (s.decision||'') + '</td>' +
  '<td>' + (s.upside != null ? (s.upside>0?'+':'')+Number(s.upside).toFixed(0)+'%' : '—') + '</td></tr>';
  }).join('');
  };

  // ═══ المقارنة مع السوق ═══
  /* ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ كل رقم تحت اسمه + شرح مبسّط
  ────────────────────────────────────────────────────────────────
  📌 المشكلة: كانت ٣ أرقام بلا أسماء («-18.03 ← -10.54 +7.48») ⇒
  📌 ⛌⛌⛌ المستخدم مش فاهم إيه رقم وإيه التاني.
  📌 ⛔⛔⛔ تصحيح مهم (متحقَّق من الكود): رقم «السوق» = **متوسط أداء
  📌 ⛔⛔⛔ كل أسهم البورصة** — مش عائد مؤشر EGX30 نفسه ⇒ التسمية
  📌 ⛔⛔⛔ لازم تبقى «متوسط البورصة» ومش «المؤشر» (صدق قبل شكل).
  📌 ✅ الحل: ٣ أعمدة، كل رقم تحته اسم واضح + سطر شرح + سطر «مهم».
  ════════════════════════════════════════════════════════════════ */
  /* ⭐ ٢٥ أكتوبر ٢٠٢٦ — اسم عمود المقارنة يجي من الباك (مؤشر ولا متوسط) */
  var MLBL = (d.benchmark && d.benchmark.market_label) || 'متوسط أسهم البورصة';
  var bench = (d.benchmark && d.benchmark.periods || []).map(function(p){
  return '<div class="bench-row"><span class="bench-p">' + p.period + '</span>' +
  '<span class="bench-c"><i>' + MLBL + '</i><b class="bench-m">' + p.market + '%</b></span>' +
  '<span class="bench-c"><i>أفضل ٢٠ عندنا</i><b class="bench-t">' + p.top20 + '%</b></span>' +
  '<span class="bench-c"><i>فرق العائد</i><b class="bench-a ' + (p.alpha>=0?'pos':'neg') + '">' +
  (p.alpha>=0?'+':'') + p.alpha + '%</b></span></div>';
  }).join('');

  // ═══ اختبار الضغط ═══
  var stress = Object.entries(d.stress || {}).map(function(e){
  var s = e[1];
  var cls = /صامد/.test(s.verdict) ? 'ok' : (/Weak/.test(s.verdict) ? 'weak' : 'bad');
  return '<div class="stress-card ' + cls + '"><div class="sc-n">' + s.name + '</div>' +
  '<div class="sc-a">' + s.avg_after + '</div>' +
  '<div class="sc-r">بعد الصدمة · احتفظ ' + s.retention + '%</div></div>';
  }).join('');

  html +=
  '<div class="dash-section"><div class="dash-h">📊 متوسط المحاور على مستوى السوق <small>النتيجة والوزن</small></div>' +
  '<div class="axis-bars-dash">' + axesHtml + '</div></div>' +

  '<div class="dash-grid" style="grid-template-columns:1fr 1fr">' +
  '<div class="why-box"><div class="dash-h">🎯 توزيع القرارات</div>' +
  dist(d.decisions || {}, {'إشارة إيجابية':'buy','شراء':'buy','إشارة محايدة':'hold','إشارة سلبية':'sell','إشارة سلبية':'sell'}) + '</div>' +
  '<div class="why-box"><div class="dash-h">⚠️ توزيع المخاطر</div>' +
  dist(d.risk_levels || {}, {'منخفض':'low','متوسط':'mid','مرتفع':'high','مرتفع جداً':'vhigh'}) + '</div>' +
  '</div>' +

  /* ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐ تمرير أفقي للجدولين (٧ أعمدة)
     📌 على الموبايل الأعمدة الأخيرة كانت بتختفي من غير سبب. */
  '<div class="dash-section"><div class="dash-h">🏆 أفضل ١٠ أسهم <small>الأعلى نتيجة (0-100)</small></div>' +
  '<div class="dash-tbl-hint"><span>←</span> اسحب الجدول جنباً عشان تشوف باقي الأعمدة <span>←</span></div>' +
  '<div class="dash-tbl-wrap"><table class="mini-table"><thead><tr><th>الرمز</th><th>الاسم</th><th>القطاع</th><th>السعر</th><th>النتيجة</th><th>القرار</th><th>فرصة</th></tr></thead>' +
  '<tbody>' + rows(d.top10 || []) + '</tbody></table></div></div>' +

  '<div class="dash-section"><div class="dash-h">📉 أسوأ ١٠ أسهم <small>الأدنى نتيجة — محتاجة انتباه</small></div>' +
  '<div class="dash-tbl-hint"><span>←</span> اسحب الجدول جنباً عشان تشوف باقي الأعمدة <span>←</span></div>' +
  '<div class="dash-tbl-wrap"><table class="mini-table"><thead><tr><th>الرمز</th><th>الاسم</th><th>القطاع</th><th>السعر</th><th>النتيجة</th><th>القرار</th><th>فرصة</th></tr></thead>' +
  '<tbody>' + rows(d.bottom10 || []) + '</tbody></table></div></div>' +

  /* ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐ بلوك جديد بيتحسب في المتصفح
  📌 السبب: أرقام المقارنة القديمة كانت متبنية على حقول جاهزة
  📌 (Perf.*) مرجعها مزحزح عند المؤشر، والصفوف الناقصة كانت بتدخل
  📌 كعوائد صفر ⇒ متوسط غلط. دلوقتي بنحسب كل رقم من الإغلاقات
  📌 الرسمية وعلى نفس تواريخ المرجع للطرفين ( octaLoadBench ).
  📌 البلوك القديم بيظل ظاهر لحد ما الجديد يجهز (أو لو فشل). */
  '<div id="benchNew">' + (d.benchmark && d.benchmark.interpretation ?
  '<div class="dash-section"><div class="dash-h">📈 أداء أفضل ٢٠ سهم عندنا مقابل متوسط البورصة <small>' + (d.benchmark.interpretation||'') + '</small></div>' +
  bench +
  '<div class="bench-note">الرقم الموجب (فرق العائد) يعني إن أفضل ٢٠ سهم عندنا كانت أعلى من ' + MLBL + ' في نفس الفترة، والسالب يعني إنها كانت أقل.</div>' +
  '<div class="bench-note">💡 الأرقام دي بتوصف فترة فاتت بس، ومش ضمان إن نفس الفرق هيتكرر في الفترة الجاية.</div>' +
  '<div class="bench-note warn">⚠️ مقارنة على أسعار النهارده بس، مش اختبار على بيانات قديمة — الاختبار الحقيقي محتاج لقطة يومية (صورة أسعار كل يوم) وبيتراكم مع الوقت.</div>' +
  '</div>' : '') + '</div>' +

  '<div class="bench-note">📌 القائمتين فوق مبنيتين على <b>نتيجة محرك OCTA</b> (من 100 = جودة + أمان + سيولة)، <b>مش</b> على ربح اليوم. أعلى نتيجة = أفضل بنية وأمان · أدنى نتيجة = أضعف وأخطر. والقائمة بتتحدث مع تحديث البيانات.</div>' +

  (stress ?
  '<div class="dash-section"><div class="dash-h">🛡️ اختبار الضغط <small>النظام تحت سيناريوهات صعبة</small></div>' +
  '<div class="stress-grid">' + stress + '</div></div>' : '') +

  '<div class="dash-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">' +
  '<div class="dash-kpi"><div class="k-val">' + (d.portfolio ? d.portfolio.holdings : 0) + '</div><div class="k-label">أسهم محفظتك</div>' +
  '<div class="k-sub">' + (d.portfolio ? d.portfolio.diversification : '') + '</div></div>' +
  '<div class="dash-kpi"><div class="k-val">' + (d.sectors ? d.sectors.length : 0) + '</div><div class="k-label">قطاع</div></div>' +
  '<div class="dash-kpi"><div class="k-val">' + (d.strategies ? d.strategies.length : 0) + '</div><div class="k-label">استراتيجية</div></div>' +
  '<div class="dash-kpi"><div class="k-val">' + (h.tickers || 0) + '</div><div class="k-label">مؤشر شريط</div>' +
  '<div class="k-sub">' + (h.market_phase === 'open' ? 'السوق مفتوح' : 'مغلق') + '</div></div>' +
  '</div>';

  document.getElementById('dashBody').innerHTML = html;
  octaLoadBench(d);
}

/* ════════════════════════════════════════════════════════════════
  📊 مقارنة المصداقية + نقاط الدخول — ٢٥ أكتوبر ٢٠٢٦
  ────────────────────────────────────────────────────────────────
  📌 الهدف: كل رقم في اللوحة لازم يكون:
  📌   ① من مصدر واحد (إغلاقات رسمية)
  📌   ② على نفس تاريخ المرجع للطرفين
  📌   ③ وتاريخ المرجع مكتوب جنبه
  📌   ④ وفاصل بين «مقارنة» و«أداء حقيقي من نقطة الدخول».
  📌 سبب التغيير: حقول Perf عند TradingView مرجعها مزحزح على
  📌 المؤشر (شهر ⇒ مرجع 3 شهور ورا)، والصفوف الناقصة (0.00%)
  📌 كانت بتدخل في المتوسط كعوائد صفر ⇒ متوسط غلط في الاتجاهين.
  ════════════════════════════════════════════════════════════════ */

function octaPct(v) {
  if (v == null || isNaN(v)) return '—';
  return (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%';
}

/* آخر إغلاق قبل (النهارده − N شهر) */
function octaRefDate(rows, monthsBack) {
  var now = new Date();
  var t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, now.getUTCDate()));
  var iso = t.toISOString().slice(0, 10);
  var pick = null;
  for (var i = 0; i < rows.length; i++) if (rows[i][0] <= iso) pick = rows[i][0];
  return pick;
}

function octaCloseAt(rows, iso) {
  for (var i = rows.length - 1; i >= 0; i--) if (rows[i][0] <= iso) return rows[i][1];
  return null;
}

async function octaLoadBench(d) {
  var box = document.getElementById('benchNew');
  if (!box) return;
  try {
    /* ① سلسلة المؤشر الرسمية */
    var hist = await fetch('/data/egx30_history.json?_=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; });
    if (!hist || !hist.rows || hist.rows.length < 30) throw new Error('no index history');
    var rows = hist.rows;
    var d1 = octaRefDate(rows, 1), d2 = octaRefDate(rows, 6), d3 = octaRefDate(rows, 12);
    var ref1 = octaCloseAt(rows, d1), ref2 = octaCloseAt(rows, d2), ref3 = octaCloseAt(rows, d3);
    if (!ref1 || !ref2 || !ref3) throw new Error('no ref closes');

    /* السعر الحالي للمؤشر: من الملف (آخر جلسة) — ولو الملف قدير
       فبنجيب السعر الحي. تاريخ آخر جلسة = آخر صف في السلسلة. */
    var nowIso = new Date().toISOString().slice(0, 10);
    var mktDate = rows[rows.length - 1][0];
    var fileAge = Math.round((Date.parse(nowIso) - Date.parse(mktDate)) / 86400000);
    var idxNow = Number(hist.last_close);
    var idxAsOf = mktDate;
    if (fileAge > 3) {
      try {
        var q = await octaFetch(OCTA_API + '/api/tvquote?symbol=EGX%3AEGX30&_=' + Date.now())
          .then(function (r) { return r.ok ? r.json() : null; });
        if (q) {
          var c = (q.close != null) ? q.close : ((q.price != null) ? q.price : ((q.c != null) ? q.c : null));
          if (c) { idxNow = Number(c); idxAsOf = q.date || nowIso; }
        }
      } catch (e) { }
    }

    /* ② أعلى ٢٠ سهم + سعرهم الحي الحالي */
    var rank = await octaFetch(OCTA_API + '/api/rank?_=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; });
    var top = ((rank && rank.results) || []).slice(0, 20);
    var codes = top.map(function (s) { return s.code; }).filter(Boolean);
    var livePrice = {};
    top.forEach(function (s) { if (s.price != null) livePrice[s.code] = Number(s.price); });
    if (!codes.length) throw new Error('no codes');

    /* ③ إغلاق كل سهم عند نفس تواريخ المرجع */
    var b = await octaFetch(OCTA_API + '/api/bench?codes=' + encodeURIComponent(codes.join(',')) +
      '&d1=' + d1 + '&d2=' + d2 + '&d3=' + d3 + '&_=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; });
    if (!b || !b.rows || !b.rows.length) throw new Error('no bench data');

    /* المتوسط: السهم اللي مفيش ليه إغلاق في تاريخ المرجع بيتشال
       — مش بيتحسب صفر (دي كانت الخطأ القديم).
       📌 السعر الحالي = السعر الحي اللي ظهر في اللوحة (من /api/rank)
       📌 مش آخر إغلاق قديم عند مزوّد البيانات (في أسهم قليلة التداول
       📌 بياناتها متأخرة ⇒ كانت هتزيح الرقم). */
    var staleList = [];
    function avgAt(key) {
      var sum = 0, n = 0;
      for (var i = 0; i < b.rows.length; i++) {
        var r = b.rows[i];
        if (!r || !r[key] || !r[key].close) continue;
        var live = livePrice[r.code];
        if (!live) continue;
        sum += (live / r[key].close - 1) * 100; n++;
        if (r.now && r.now.date !== mktDate && staleList.indexOf(r.code) < 0) staleList.push(r.code);
      }
      return n ? { avg: sum / n, n: n } : null;
    }
    var a1 = avgAt('m1'), a2 = avgAt('m6'), a3 = avgAt('y1');
    if (!a1 || !a2 || !a3) throw new Error('no averages');

    var per = [
      { label: 'شهر', ref: d1, mkt: (idxNow / ref1 - 1) * 100, ours: a1 },
      { label: '6 شهور', ref: d2, mkt: (idxNow / ref2 - 1) * 100, ours: a2 },
      { label: 'سنة', ref: d3, mkt: (idxNow / ref3 - 1) * 100, ours: a3 }
    ];

    var html = '<div class="dash-section"><div class="dash-h">📈 أفضل ٢٠ سهم عندنا مقابل مؤشر البورصة <small>EGX30 · من الإغلاقات الرسمية</small></div>';
    var behind = [], ahead = [];
    per.forEach(function (p) {
      var diff = p.ours.avg - p.mkt;
      if (diff >= 0) ahead.push(p.label + ' (' + octaPct(diff) + ')'); else behind.push(p.label + ' (' + octaPct(diff) + ')');
      html += '<div class="bench-row">' +
        '<span class="bench-p">' + p.label + '</span>' +
        '<span class="bench-c"><i>مؤشر البورصة</i><b class="bench-m">' + octaPct(p.mkt) + '</b></span>' +
        '<span class="bench-c"><i>أفضل ٢٠ عندنا</i><b class="bench-t">' + octaPct(p.ours.avg) + '</b></span>' +
        '<span class="bench-c"><i>فرق العائد</i><b class="bench-a ' + (diff >= 0 ? 'pos' : 'neg') + '">' + octaPct(diff) + '</b></span>' +
        '</div>' +
        '<div class="bench-ref">📅 المقارنة من إغلاق ' + p.ref + ' · ' + p.ours.n + ' سهم دخلوا في المتوسط</div>';
    });
    html += '<div class="bench-note">' +
      (behind.length
        ? '⚠️ ورا المؤشر في: ' + behind.join(' · ') + ' — وقدام في: ' + (ahead.length ? ahead.join(' · ') : 'ولا فترة')
        : '✅ قدام المؤشر في الفترات التلاتة: ' + ahead.join(' · ')) +
      '</div>';
    html += '<div class="bench-note">📌 كل الأرقام محسوبة من <b>نفس الإغلاقات</b> و<b>نفس تاريخ المرجع</b> للطرفين — المؤشر والأسهم مع بعض، فالمقارنة عدلة.</div>';
    html += '<div class="bench-note">📌 رقم «أفضل ٢٠» = متوسط أداء الأسهم الـ20 اللي محركنا رشحها النهارده. وده فيه تفاؤل مدمج (اخترناهم بعد ما رجعت) ⇒ الرقم الصادق هو أداؤها <b>من نقطة الدخول</b> — تحت.</div>';
    if (staleList.length) {
      html += '<div class="bench-note">📌 ' + staleList.length + ' سهم إغلاقاته متأخرة عند مزوّد البيانات (' + staleList.join('، ') + ') — استخدمنا سعره الحي، بس إغلاق تاريخ المرجع عنده أقدم من باقي الأسهم.</div>';
    }
    html += '<div class="bench-note">📌 مقارنة على فترة فاتت — مش backtest، ومش ضمان للفترة الجاية.</div>';
    html += '<div class="bench-note">📌 إغلاق المؤشر: ' + idxNow + ' (بتاريخ ' + idxAsOf + ').</div>';
    html += '</div>';

    /* ④ النتائج الحقيقية من نقطة الدخول */
    try {
      var bt = await octaFetch(OCTA_API + '/api/backtest?_=' + Date.now())
        .then(function (r) { return r.ok ? r.json() : null; });
      if (bt && bt.windows && bt.windows.length) {
        var ws = bt.windows.slice().sort(function (a, b2) { return (b2.age_days || 0) - (a.age_days || 0); });
        var old = ws[0];
        var names = {};
        try {
          var db = (typeof OS_DB !== 'undefined' && OS_DB) ? OS_DB : [];
          db.forEach(function (s) { names[s.code] = s.name; });
        } catch (e) { }
        html += '<div class="dash-section"><div class="dash-h">🎯 نتائج توصياتنا من نقطة الدخول <small>الحقيقة من غير تجميل</small></div>';
        html += '<div class="entry-sum">📌 لقطة ' + old.snapshot_date + ' (' + old.age_days + ' يوم) · ' + old.count +
          ' توصية · متوسط <b class="' + (old.avg_return >= 0 ? 'pos' : 'neg') + '">' + octaPct(old.avg_return) + '</b>' +
          ' · ' + old.wins + ' ربح · ' + old.flat + ' محايد · ' + old.losses + ' خسارة</div>';
        /* 📌 المقارنة الأصدق: المؤشر في نفس الفترة بالظبط
           (من نفس يوم التوصية لحد النهارده) — دي المقارنة اللي
           بتقولك التوصيات أحسن من السوق ولا أقل منه فعلاً. */
        var snapClose = octaCloseAt(rows, old.snapshot_date);
        if (snapClose && idxNow) {
          var idxSame = (idxNow / snapClose - 1) * 100;
          var gapSame = old.avg_return - idxSame;
          html += '<div class="entry-sum">📊 في <b>نفس الفترة بالظبط</b> (' + old.snapshot_date + ' → ' + idxAsOf +
            '): مؤشر البورصة <b class="' + (idxSame >= 0 ? 'pos' : 'neg') + '">' + octaPct(idxSame) + '</b>' +
            ' · توصياتنا <b class="' + (old.avg_return >= 0 ? 'pos' : 'neg') + '">' + octaPct(old.avg_return) + '</b>' +
            ' ⇒ <b class="' + (gapSame >= 0 ? 'pos' : 'neg') + '">' +
            (gapSame >= 0 ? 'قدام المؤشر بـ' : 'ورا المؤشر بـ') + ' ' + Math.abs(gapSame).toFixed(2) + ' نقطة</b></div>';
        }
        html += '<div class="dash-tbl-hint"><span>←</span> اسحب الجدول جنباً عشان تشوف باقي الأعمدة <span>←</span></div>';
        html += '<div class="dash-tbl-wrap"><table class="mini-table"><thead><tr><th>الرمز</th><th>العائد من الدخول</th><th>سعر الدخول</th><th>السعر دلوقتي</th><th>الاسم</th><th>القرار يوم الاختيار</th></tr></thead><tbody>';
        (old.picks || []).slice().sort(function (x, y2) { return (x.actual_return || 0) - (y2.actual_return || 0); })
          .forEach(function (p) {
            var rr = p.actual_return;
            html += '<tr><td><b>' + p.code + '</b></td>' +
              '<td class="' + (rr >= 0 ? 'pos' : 'neg') + '"><b>' + octaPct(rr) + '</b></td>' +
              '<td>' + Number(p.price_then || 0).toFixed(3) + '</td>' +
              '<td>' + Number(p.price_now || 0).toFixed(3) + '</td>' +
              '<td>' + (names[p.code] || '—') + '</td>' +
              '<td>' + (p.decision_at_pick || '—') + '</td></tr>';
          });
        html += '</tbody></table></div>';
        html += '<div class="bench-note">📌 سعر الدخول = السعر وقت ما المحرك رشح السهم · السعر الحالي = السعر دلوقتي. ده قياس حقيقي، مش تقدير.</div>';
        /* 📌 سجل التوصيات: كل لقطة يومية مقابل المؤشر في نفس الفترة
           بالظبط — ده السجل الحقيقي للمحرك (مش رقم واحد). */
        var track = [];
        (bt.windows || []).forEach(function (w) {
          if (!w || !w.snapshot_date) return;
          var c = octaCloseAt(rows, w.snapshot_date);
          if (!c || idxNow == null) return;
          var ix = (idxNow / c - 1) * 100;
          track.push({ d: w.snapshot_date, age: w.age_days, ours: w.avg_return, mkt: ix, gap: w.avg_return - ix, n: w.count, w: w.wins, l: w.losses });
        });
        track.sort(function (a, b) { return (a.d < b.d) ? 1 : -1; });
        if (track.length > 1) {
          html += '<div class="dash-h" style="margin-top:14px">📋 سجل التوصيات <small>كل لقطة يومية مقابل المؤشر في نفس الفترة</small></div>';
          html += '<div class="dash-tbl-hint"><span>←</span> اسحب الجدول جنباً <span>←</span></div>';
          html += '<div class="dash-tbl-wrap"><table class="mini-table track-tbl"><thead><tr><th>لقطة التوصية</th><th>توصياتنا</th><th>المؤشر</th><th>الفرق</th></tr></thead><tbody>';
          track.forEach(function (t) {
            html += '<tr><td><b>' + t.d + '</b><small class="td-sub">' + t.age + ' يوم</small></td>' +
              '<td class="' + (t.ours >= 0 ? 'pos' : 'neg') + '"><b>' + octaPct(t.ours) + '</b></td>' +
              '<td class="' + (t.mkt >= 0 ? 'pos' : 'neg') + '">' + octaPct(t.mkt) + '</td>' +
              '<td class="' + (t.gap >= 0 ? 'pos' : 'neg') + '"><b>' + octaPct(t.gap) + '</b></td></tr>';
          });
          html += '</tbody></table></div>';
          var behindN = track.filter(function (t) { return t.gap < 0; }).length;
          html += '<div class="bench-note">' + (behindN ? '⚠️ في ' + behindN + ' من ' + track.length + ' لقطة، التوصيات كانت ورا المؤشر في نفس الفترة.' : '✅ في كل اللقطات، التوصيات كانت قدام المؤشر في نفس الفترة.') + '</div>';
          html += '<div class="bench-note">📌 كل لقطة = 20 توصية مختلفة (ترتيب المحرك في اليوم ده) متقاسة من ساعتها لحد النهارده.</div>';
        }
        html += '<div class="bench-note warn">⚠️ المدة ' + old.age_days + ' يوم بس، فالمشكلة لسه صغيرة الأجل. بنسجل لقطة كل يوم، وكل ما المدة زادت الرقم بيبقى أصدق.</div>';
        html += '<div class="bench-note">📌 عدد اللقطات المسجلة: ' + (bt.snapshots_count || 0) + '.</div>';
        html += '</div>';
      }
    } catch (e) { }

    box.innerHTML = html;
  } catch (e) {
    /* فشل ⇒ نسيب البلوك القديم زي ما هو */
    try { console.warn('bench load failed:', e && e.message); } catch (e2) { }
  }
}

/* ════════════════════════════════════════════════════════════
  OCTA v3 — EIGHT ARMS ENGINE
  One Brain. Eight Arms. Infinite Opportunities.
  ════════════════════════════════════════════════════════════ */

// خريطة الذراع → الصفحات اللي بتعمله (من الـ nav القديم — مفيش حاجة اتشالت)
const ARM_MAP = {
  market: {
  n: 'السوق', icon: '🌊', color: '#38bdf8',
  q: 'السوق عامل إيه دلوقتي؟',
  lead: 'الأسواق المصرية والعالمية • كارت القرار • الفرص • المخاطر',
  panel: 'market'
  },
  technical: {
  n: 'الفني', icon: '📈', color: '#22c55e',
  q: 'مين عنده نموذج فني دلوقتي؟',
  lead: 'قائمة الإشارات الفنية • قوة الزخم • مستويات الدعم والمقاومةة',
  pages: [], panel: 'technical'
  },
  fundamental: {
  n: 'الأساسي', icon: '💰', color: '#d4af37',
  q: 'مين رخيص مقارنة بقطاعه؟',
  lead: 'أرخص ٢٠ • قيمة عادلة • مقارنة بالقطاع • الأرباح',
  pages: [], panel: 'fundamental'
  },
  liquidity: {
  n: 'السيولة', icon: '💧', color: '#06b6d4',
  q: 'فين الفلوس رايحة؟',
  lead: 'تدفق السيولة • معدل الدوران • أحجام استثنائية • سرعة الدخول والخروج',
  pages: [], panel: 'liquidity'
  },
  news: {
  n: 'الأخبار', icon: '📰', color: '#a855f7',
  q: 'فيه خبر يقلب معادلة سهم؟',
  lead: 'أحداث مؤثرة • الأهمية المادية • التصنيف • أثر كل خبر',
  pages: [], panel: 'news'
  },
  risk: {
  n: 'المخاطر', icon: '⚠️', color: '#ef4444',
  q: 'مين الخطر فيه عالي؟',
  lead: 'أسوأ ١٠ • مستوى الأمان • اختبار الضغط • سجل المعايرة',
  pages: [], panel: 'risk'
  },
  portfolio: {
  n: 'المحفظة', icon: '💼', color: '#8b5cf6',
  q: 'مين يناسب محفظتي؟',
  lead: 'ملاءمة كل سهم • التنويع • التركّز • التعلّم',
  pages: [], panel: 'portfolio'
  },
  opportunity: {
  n: 'الفرص', icon: '🎯', color: '#f59e0b',
  q: 'أعمل إيه دلوقتي؟',
  lead: 'الفرص المبكرة • ٧ استراتيجيات • أفضل الفرص • التفسير الكامل',
  pages: [], panel: 'opportunity'
  }
};

let CURRENT_ARM = 'market';

/* ══════════ شاشة الذراع — كل ذراع هشوية مختلفة ══════════ */
function openArm(arm) {
  const cfg = ARM_MAP[arm];
  if (!cfg) return;
  CURRENT_ARM = arm;

  document.querySelectorAll('.arm-btn').forEach(b =>
  b.classList.toggle('active', b.dataset.arm === arm));

  // ═══ صفحة جاهزة (مثل الأسواق) → نفتحها مباشرة ═══
  if (cfg.pages && cfg.pages.length) {
  const pg = cfg.pages[0];
  if (document.getElementById('page-' + pg)) {
  // نخفي شاشة الذراع
  const av = document.getElementById('armView');
  if (av) av.style.display = 'none';
  const sp = document.getElementById('stockPage');
  if (sp) sp.style.setProperty('display', 'none', 'important');
  // نفتح الصفحة
  switchPage(pg);
  if (pg === 'markets' && typeof window.mkLoad === 'function') {
  setTimeout(() => { try { window.mkLoad(); } catch(e) { console.warn(e.message); } }, 200);
  }
  return;
  }
  }

  // الألوان على :root
  document.documentElement.style.setProperty('--ac', cfg.color);

  /* 🧭 شاشة الذراع كانت **بره نظام الصفحات** — مفيش page-* ليها،
     فكانت بتتشال من الحفظ بالكامل والريفريش كان بيرجع لنقطة تانية.
     دلوقتي بنسجّلها كأنها حالة مستقلة. */
  if (typeof OS_NAV !== 'undefined' && OS_NAV.arm) OS_NAV.arm(arm);

  // نعرض شاشة الذراع (shell موحد)
  showArmView(arm);
  loadArmContent(arm);
}

function showArmView(arm) {
  const cfg = ARM_MAP[arm];
  const sp = document.getElementById('stockPanel');
  if (sp) sp.style.display = 'none';
  window.SI_ARM = arm;
  const bEl = document.getElementById('armBody');
  if (bEl) bEl.innerHTML = '<div class="opps-loading">🔄 جاري التحميل...</div>';
  // نخفي كل الصفحات
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('dashPage')?.style.setProperty('display','none','important');
  document.getElementById('intelPage')?.style.setProperty('display','none','important');
  document.querySelectorAll('.page-section').forEach(s => s.style.setProperty('display','none','important'));

  // نظهر شاشة الذراع
  const v = document.getElementById('armView');
  if (!v) return;
  v.style.display = 'block';
  v.style.setProperty('--ac', cfg.color);
  document.getElementById('armHeroQ').textContent = cfg.q;
  document.getElementById('armHeroLead').textContent = cfg.lead;
  document.getElementById('armHeroIco').textContent = cfg.icon;
  document.getElementById('armBody').innerHTML = '<div class="opps-loading">🔄 جاري التحميل...</div>';
  window.scrollTo({top: 0, behavior: 'smooth'});
}

async function loadArmContent(arm) {
  const box = document.getElementById('armBody');
  try {
  const fn = { market: armMarket, technical: armTechnical, fundamental: armFundamental,
  liquidity: armLiquidity, news: armNews, risk: armRisk,
  portfolio: armPortfolio, opportunity: armOpportunity }[arm];
  if (fn) await fn(box);
  } catch (e) {
  box.innerHTML = '<div class="opps-loading" style="color:var(--red2)">تعذر التحميل</div>';
  }
}

const armS = (arr, keys) => arr.map(s => keys.map(k => s[k]).join(' | ')).join('\n');

function armStats(items) {
  if (!items.length) return '';
  const avg = k => {
  const xs = items.map(i => Number(i[k])).filter(x => !isNaN(x));
  return xs.length ? (xs.reduce((a,b)=>a+b,0)/xs.length) : 0;
  };
  return '<div class="arm-stats">' +
  `<div class="arm-stat"><div class="as-v">${items.length}</div><div class="as-l">سهم</div></div>` +
  `<div class="arm-stat"><div class="as-v">${avg('final_score').toFixed(0)}</div><div class="as-l">متوسط النتيجة</div></div>` +
  `<div class="arm-stat"><div class="as-v">${avg('safety').toFixed(0)}</div><div class="as-l">متوسط الأمان</div></div>` +
  `<div class="arm-stat"><div class="as-v">${avg('liquidity').toFixed(0)}</div><div class="as-l">متوسط السيولة</div></div>` +
  '</div>';
}

function stockTable(rows, cols) {
  if (!rows.length) return '<div class="opps-loading">لا توجد بيانات</div>';
  let h = '<table class="mini-table"><thead><tr>';
  for (const c of cols) h += `<th>${c.h}</th>`;
  h += '</tr></thead><tbody>';
  for (const s of rows) {
  h += `<tr onclick="openStockModal('${s.code}')">`;
  for (const c of cols) h += `<td>${c.f(s)}</td>`;
  h += '</tr>';
  }
  return h + '</tbody></table>';
}

/* ══════ ① السوق ══════ */

/* ══════ التيكر بالعرض — 6 كروت ══════ */
const TICKER_WANT = [
  { id:'tk-egx',  n:'📊 EGX30',  c:'#38bdf8' },
  { id:'tk-egx70',  n:'📈 EGX70',  c:'#22c55e' },
  { id:'tk-egx100', n:'📉 EGX100',  c:'#a855f7' },
  { id:'tk-egx33',  n:'🕌 مؤشر الشريعة', c:'#16c79a' },
  { id:'tk-usd',  n:'💵 دولار/جنيه', c:'#f59e0b' },
  { id:'tk-gold24', n:'🥇 ذهب/الجرام', c:'#eab308', gold:true },
];


/* ══════ خريطة الأصول (الذهب/الدولار/النفط/المؤشرات) ══════ */
const ASSET_META = {
  'tk-gold':  { n:'🥇 الذهب',  g:'سلاح أمان',  inv:['tk-egx','tk-usd','tk-egx70'] },
  'tk-silver': { n:'🥈 الفضة',  g:'معدن ثمين',  inv:['tk-gold'] },
  'tk-usd':  { n:'💵 دولار/جنيه',  g:'عملة مصرية',  inv:['tk-gold'] },
  'tk-eur':  { n:'💶 يورو/جنيه',  g:'عملة أوروبية',  inv:['tk-usd'] },
  'tk-oil':  { n:'🛢️ نفط (WTI)',  g:'سلعة طاقة',  inv:['tk-spx','tk-egx'] },
  'tk-ukoil':  { n:'🛢️ نفط برنت',  g:'سلعة طاقة',  inv:['tk-oil'] },
  'tk-egx':  { n:'📊 EGX30',  g:'مؤشر البورصة',  inv:['tk-usd'] },
  'tk-egx70':  { n:'📈 EGX70',  g:'مؤشر واسع',  inv:['tk-egx'] },
  'tk-egx100': { n:'📉 EGX100',  g:'مؤشر صغير',  inv:['tk-egx70'] },
  'tk-egx33':  { n:'🕌 مؤشر الشريعة',  g:'مؤشر شرعي',  inv:['tk-egx'] },
  'tk-spx':  { n:'🇺🇸 S&P 500',  g:'مؤشر عالمي',  inv:['tk-oil'] },
};



/* ══════ مقالة: إزاي الأصول بتأثر على بعض ══════ */

/* ══════ خريطة القطاعات — أخضر/أحمر فقط ══════ */
// ٥ درجات: أحمر غامق → أحمر فاتح → رمادي → أخضر فاتح → أخضر غامق
function sectorColor(avg) {
  const a = Number(avg || 0);
  if (a >=  3) return 'background:linear-gradient(135deg,#15803d,#22c55e)';
  if (a >=  1) return 'background:linear-gradient(135deg,#16a34a,#4ade80)';
  if (a >  -1) return 'background:linear-gradient(135deg,#334155,#64748b)';
  if (a >  -3) return 'background:linear-gradient(135deg,#dc2626,#f87171)';
  return 'background:linear-gradient(135deg,#991b1b,#ef4444)';
}


/* ══════ ① السوق ══════ */

/* ═══ fetch آمن ═══ */
async function apiGet(path, timeout) {
  const t = timeout || 15000;
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), t);
  try {
  const r = await octaFetch(OCTA_API + path, { signal: ctl.signal });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return await r.json();
  } catch (e) {
  if (e.name === 'AbortError') throw new Error('انتهت المهلة (' + (t/1000) + 'ث)');
  throw e;
  } finally { clearTimeout(tm); }
}

/* ═══ كارت موحّد ═══ */
function ucToggle(id) { const e = document.getElementById(id); if (e) e.classList.toggle('open'); }
function uniCard(id, ico, title, sub, body, open) {
  return '<div class="uc' + (open?' open':'') + '" id="' + id + '">' +
  '<div class="uc-head" onclick="ucToggle(\'' + id + '\')">' +
  '<span class="uc-ico">' + ico + '</span>' +
  '<div class="uc-txt"><div class="uc-title">' + title + '</div>' +
  '<div class="uc-sub">' + (sub||'') + '</div></div><span class="uc-arrow">‹</span></div>' +
  '<div class="uc-body">' + body + '</div></div>';
}

/* ═══ شريط ═══ */
const SCALE_CAP = 60;
function barRow(s) {
  /* ⛔⛔⛔ 60 سهم من 290 مالهمش بيانات تغيّر أصلاً (مؤقفة/جديدة).
     قبل الكلام ده كنا بنعرض «▲ +0.00%» — وده **رقم مخترع**.
     ⛔ م.Rule: الرقم اللي مش موجود لازم ينكتب «—» مش صفر.
     «0.00%» الحقيقي لسه بيطلع 0.00% — لأن changeHas بيفرّق بينهم. */
  if (!s.changeHas) {
  return '<div class="bar-stock" onclick="openStockModal(\'' + s.code + '\')">' +
  '<div class="bs-l"><div class="bs-t"><span class="bs-code">' + s.code + '</span>' +
  '<span class="bs-name">' + (s.name||'').slice(0,20) + '</span></div>' +
  '<div class="bs-track"><div class="bs-fill na" style="width:2%"></div></div></div>' +
  '<div class="bs-val na" title="مفيش بيانات تغيّر متاحة">—</div></div>';
  }
  const v = Math.abs(s.change ?? 0);
  const pct = Math.max(2, Math.min(100, (v / SCALE_CAP) * 100));
  const cls = (s.change??0) >= 0 ? 'up' : 'down';
  return '<div class="bar-stock" onclick="openStockModal(\'' + s.code + '\')">' +
  '<div class="bs-l"><div class="bs-t"><span class="bs-code">' + s.code + '</span>' +
  '<span class="bs-name">' + (s.name||'').slice(0,20) + '</span></div>' +
  '<div class="bs-track"><div class="bs-fill ' + cls + '" style="width:' + pct + '%"></div></div></div>' +
  '<div class="bs-val ' + cls + '">' + ((s.change??0)>=0?'▲ +':'▼ ') + v.toFixed(2) + '%</div></div>';
}

/* ═══ فلاتر ═══ */
const PERIODS = [
  { k:'change', n:'اليوم' }, { k:'perf_w', n:'الأسبوع' }, { k:'perf_1m', n:'الشهر' },
  { k:'perf_3m', n:'٣ شهور' }, { k:'perf_6m', n:'٦ شهور' }, { k:'perf_y', n:'السنة' },
];
async function loadPeriodData(p) {
  const body = document.getElementById('glBody');
  if (!body) return;
  document.querySelectorAll('#glTabs .uc-tab').forEach(t => t.classList.toggle('on', t.dataset.p === p));
  body.innerHTML = '<div class="dc-loading" style="padding:22px;text-align:center;color:#8b9eb0">🔄 جاري التحميل...</div>';
  try {
  const all = (await apiGet('/api/rank?limit=252', 20000)).results || [];
  const sorted = all.slice().sort((a,b)=>(b[p]||0)-(a[p]||0));
  const up = sorted.filter(s=>(s[p]||0) > 0).slice(0,10);
  const dn = sorted.filter(s=>(s[p]||0) < 0).slice(-10).reverse();
  if (!up.length && !dn.length) { body.innerHTML = '<div class="dc-loading" style="padding:22px;text-align:center;color:#8b9eb0">لا توجد حركة</div>'; return; }
  body.innerHTML = '<div class="dc-cols">' +
  '<div><div class="dc-col-h up">▲ أعلى ١٠</div>' + up.map(barRow).join('') + '</div>' +
  '<div><div class="dc-col-h down">▼ أقل ١٠</div>' + dn.map(barRow).join('') + '</div></div>';
  } catch (e) { body.innerHTML = '<div class="dc-loading" style="padding:18px;text-align:center;color:#ff5252">تعذر: ' + (e.message||'') + '</div>'; }
}
function buildMoversCard() {
  const tabs = '<div class="uc-tabs" id="glTabs">' + PERIODS.map(p =>
  '<button class="uc-tab' + (p.k==='change'?' on':'') + '" onclick="loadPeriodData(\'' + p.k + '\')">' + p.n + '</button>').join('') + '</div>';
  return uniCard('glCard', '📊', 'أعلى ١٠ صعوداً وهبوطاً', 'اضغط للفلترة حسب الفترة', tabs + '<div id="glBody"></div>');
}

/* ════════════════════════════════════════════════════════════════
  🕌 مؤشر الشريعة (EGX 33 Shariah) — مكوناته + نتيجة OCTA
  ════════════════════════════════════════════════════════════════
  📌 المكونات من موقع البورصة المصرية الرسمي.
  📌 السعر والأداء من TradingView (المؤشر مش في الـscanner ⇒ websocket في الباك).
  📌 البحث + فلتر بنتيجة OCTA (المستخدم طلباهم صراحةً).
  ════════════════════════════════════════════════════════════════ */
let SHARIAH_DATA = null;

async function openShariahIndex() {
  const old = document.getElementById('shariah-modal');
  if (old) old.remove();
  const wrap = document.createElement('div');
  wrap.id = 'shariah-modal';
  wrap.className = 'tv-modal-overlay';
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
  wrap.innerHTML = '<div class="tv-modal-box"><div class="tv-modal-head"><div>' +
    '<div class="tv-modal-title">\u{1F54C} مؤشر الشريعة — EGX 33 Shariah</div>' +
    '<div class="tv-modal-sub">جارِ تحميل المكونات من البورصة المصرية \u2026</div>' +
    '</div><div class="tv-modal-actions">' +
    '<button class="tv-btn" onclick="document.getElementById(\'shariah-modal\').remove(); openIndexIntel(\'EGX33\')" title="تحليل مؤشر الشريعة زي باقي المؤشرات">\u{1F4CA} تحليل المؤشر</button>' +
    '<button class="tv-btn ghost" onclick="document.getElementById(\'shariah-modal\').remove()">\u2715</button></div>' +
    '</div><div class="tv-modal-body" id="shariah-body"><div class="si-empty">\u23F3 جاري التحميل\u2026</div></div></div>';
  document.body.appendChild(wrap);

  try {
    if (!SHARIAH_DATA) {
      const r = await octaFetch(OCTA_API + '/api/shariah?_=' + Date.now());
      SHARIAH_DATA = await r.json();
    }
    renderShariah(wrap);
  } catch (e) {
    const b = wrap.querySelector('#shariah-body');
    if (b) b.innerHTML = '<div class="si-empty">\u274C تعذر تحميل المكونات (' + (e.message || 'خطأ') + ')</div>';
  }
}

function shariahFilterRows(rows, q, minScore) {
  const term = (q || '').trim().toUpperCase();
  return rows.filter(function (r) {
    if (minScore && (r.score == null || r.score < minScore)) return false;
    if (!term) return true;
    return ((r.code || '') + ' ' + (r.name || '') + ' ' + (r.name_en || '') + ' ' + (r.sector || '')).toUpperCase().indexOf(term) >= 0;
  });
}

function renderShariah(wrap) {
  const d = SHARIAH_DATA || {};
  const rows = d.rows || [];
  const q = (d._q || '');
  const minScore = d._min || 0;
  const shown = shariahFilterRows(rows, q, minScore);
  const idx = d.index || {};
  const quote = d.quote || {};
  const pct = quote.change != null ? (quote.change >= 0 ? '+' : '') + Number(quote.change).toFixed(2) + '%' : '\u2014';
  const cls = (quote.change || 0) >= 0 ? 'pos' : 'neg';

  const body = wrap.querySelector('#shariah-body');
  const sub = wrap.querySelector('.tv-modal-sub');
  if (sub) sub.textContent = '٣٣ شركة · ٣٤ ورقة · المكونات من البورصة المصرية الرسمية';
  let html = '<div class="sh-summary">' +
    '<div><span class="sh-k">قيمة المؤشر</span><span class="sh-v">' +
    (quote.value != null ? Number(quote.value).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '\u2014') + '</span></div>' +
    '<div><span class="sh-k">اليوم</span><span class="sh-v ' + cls + '">' + pct + '</span></div>' +
    '<div><span class="sh-k">آخر سنة</span><span class="sh-v">' +
    (quote.perf_y != null ? (quote.perf_y >= 0 ? '+' : '') + Number(quote.perf_y).toFixed(2) + '%' : '\u2014') + '</span></div>' +
    '<div><span class="sh-k">عدد الأسهم</span><span class="sh-v">' +
    (idx.companies || rows.length) + ' <span style="font-size:.62rem;color:var(--muted);font-weight:700">شركة / ' + rows.length + ' ورقة</span></span></div>' +
    '</div>' +
    '<div class="sh-controls">' +
    '<input id="sh-search" class="sh-input" type="search" placeholder="\u0627\u0628\u062d\u062b \u0628\u0627\u0633\u0645 \u0627\u0648 \u0627\u0633\u0645 \u0627\u0644\u0634\u0631\u0643\u0629 \u0623\u0648 \u0627\u0644\u0642\u0637\u0627\u0639" value="' + q.replace(/"/g, '&quot;') + '">' +
    '<select id="sh-min" class="sh-input sh-select">' +
    '<option value="0"' + (minScore === 0 ? ' selected' : '') + '>كل النتائج</option>' +
    '<option value="50"' + (minScore === 50 ? ' selected' : '') + '>النتيجة \u2265 50</option>' +
    '<option value="60"' + (minScore === 60 ? ' selected' : '') + '>النتيجة \u2265 60</option>' +
    '<option value="65"' + (minScore === 65 ? ' selected' : '') + '>النتيجة \u2265 65</option>' +
    '</select>' +
    '<span class="sh-count">' + shown.length + ' / ' + rows.length + '</span>' +
    '</div>' +
    '<div class="dash-tbl-wrap"><table class="mini-table sh-table"><thead><tr>' +
    '<th>الرمز</th><th>النتيجة</th><th>السعر</th><th>القرار</th><th>الاسم</th><th>القطاع</th>' +
    '</tr></thead><tbody>';
  shown.forEach(function (r) {
    const sc = (r.score != null) ? Number(r.score).toFixed(1) : '\u2014';
    const scls = r.score == null ? '' : (r.score >= 65 ? 'pos' : (r.score >= 52 ? '' : 'neg'));
    const dcls = /إيجابية/.test(r.decision || '') ? 'pos' : (/سلبية/.test(r.decision || '') ? 'neg' : '');
    html += '<tr onclick="openIntel(\'' + r.code + '\')" style="cursor:pointer">' +
      '<td><b>' + r.code + '</b></td>' +
      '<td class="' + scls + '"><b>' + sc + '</b></td>' +
      '<td>' + (r.price != null ? Number(r.price).toFixed(2) : '\u2014') + '</td>' +
      '<td class="' + dcls + '">' + (r.decision || '\u2014') + '</td>' +
      '<td>' + (r.name || r.name_en || '\u2014') + '</td>' +
      '<td>' + (r.sector || '\u2014') + '</td></tr>';
  });
  if (!shown.length) {
    html += '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:18px">\u2014 مفيش نتائج بالفلتر ده \u2014</td></tr>';
  }
  html += '</tbody></table></div>' +
    '<div class="dash-tbl-hint"><span>←</span> اسحب الجدول جنباً عشان تشوف باقي الأعمدة <span>←</span></div>' +
    '<div class="sh-note">\u{1F4D6} المكونات من موقع البورصة المصرية الرسمي: ' +
    '<a href="' + (idx.source || '#') + '" target="_blank" rel="noopener" style="color:var(--gold)">' + (idx.source || '') + '</a>' +
    '<br>\u2139\uFE0F ' + (idx.source_note || '') + '</div>';
  body.innerHTML = html;

  const si = body.querySelector('#sh-search');
  const sm = body.querySelector('#sh-min');
  /* ⛔⛔⛔ ٢٦ أكتوبر ٢٠٢٦ — ⭐ الجدول RTL ⇒ بيبدأ من اليمين
  📌 فعمود «الاسم» (آخر عمود) كان بيظهر مقصوص وانت فتحت المودال.
  📌 ✅ الحل: نرجّع التمرير لأقصى اليمين (= بداية الجدول في RTL). */
  const _wrap = body.querySelector('.dash-tbl-wrap');
  if (_wrap) { try { _wrap.scrollLeft = 0; _wrap.scrollTo({ left: 0 }); } catch (e) { } }
  const apply = function () {
    SHARIAH_DATA._q = si.value;
    SHARIAH_DATA._min = parseInt(sm.value || '0', 10);
    renderShariah(wrap);
    const nsi = wrap.querySelector('#sh-search');
    if (nsi) { nsi.focus(); try { nsi.setSelectionRange(nsi.value.length, nsi.value.length); } catch (e) {} }
  };
  if (si) si.oninput = function () { clearTimeout(window._shT); window._shT = setTimeout(apply, 220); };
  if (sm) sm.onchange = apply;
}

/* ═══ المؤشرات المصرية ═══ */
function buildEgyCard(ticker, gold) {
  const map = {}; const seen = new Set();
  for (const t of (ticker||[])) { if (!seen.has(t.id)) { seen.add(t.id); map[t.id] = t; } }
  const WANT = [
  { id:'tk-egx', n:'📊 EGX30' }, { id:'tk-egx70', n:'📈 EGX70' },
  { id:'tk-egx100', n:'📉 EGX100' }, { id:'tk-egx33', n:'🕌 مؤشر الشريعة' },
  { id:'tk-usd', n:'💵 دولار/جنيه' }, { id:'tk-gold', n:'🥇 ذهب/الجرام' },
  ];
  const body = '<div class="mini-row c6">' + WANT.map(w => {
  const t = map[w.id];
  if (!t) return '<div class="mini"><div class="mini-n">' + w.n + '</div><div class="mini-v">—</div></div>';

  /* ⛔⛔⛔ ٢٦ أكتوبر ٢٠٢٦ — ⭐ صفر مش يعني «مفيش رقم»
     📌 كنا بنعمل Number(t.value||0) ⇒ رقم ناقص كان بيظهر 0.00% (كأنه رقم حقيقي).
     📌 ✅ دلوقتي: لو مفيش قيمة ⇒ «غير متاح» + «—». */
  const hasVal = t.value != null && !isNaN(Number(t.value));
  const hasChg = t.change != null && !isNaN(Number(t.change));
  let c = hasChg ? Number(t.change) : 0;
  let v = hasVal ? Number(t.value).toLocaleString('en-US',{maximumFractionDigits:2}) : 'غير متاح';

  if (w.id === 'tk-gold' && hasVal) {
  // الأونصة بالدولار × الدولار بالجنيه ÷ 31.1035 = سعر الجرام
  if (gold && gold.gram_egp) {
  v = Number(gold.gram_egp).toLocaleString('en-US',{maximumFractionDigits:0});
  // التغير = متوسط تغير الذهب + تغير الدولار
  if (gold.ounce_egp_change != null) c = Number(gold.ounce_egp_change);
  } else if (map['tk-usd'] && map['tk-usd'].value) {
  v = Number((t.value * map['tk-usd'].value) / 31.1035).toLocaleString('en-US',{maximumFractionDigits:0});
  }
  }

  /* ⛔⛔⛔ ٢٦ أكتوبر ٢٠٢٦ — ⭐⭐ كروت المؤشرات بقت قابلة للنقر
  📌 الهدف: «ذكاء المؤشرات» — تحليل كامل للمؤشر لما المستخدم يدوس عليه.
  📌 مؤشر الشريعة لسه ليها مودالها الخاص (مكوناته + نتيجة OCTA لكل سهم). */
  /* ⭐ Ahmed: مؤشر الشريعة لازم يبقى بنفس الطابع بالظبط زي باقي المؤشرات
     ⇒ كل الكروت الأربعة بتفتح «ذكاء المؤشرات» (نفس المودال + نفس الأقسام)
     ⇒ والجدول القديم بمكوناته ونتائجه بيفضل متاح من جوّه المودال. */
  var IX_MAP = { 'tk-egx':'EGX30', 'tk-egx70':'EGX70', 'tk-egx100':'EGX100', 'tk-egx33':'EGX33' };
  var ixId = IX_MAP[w.id] || null;
  /* ⭐ ٢٦ أكتوبر ٢٠٢٦ — كارت «دولار/جنيه» بقى قابل للنقر ⇒ «ذكاء الدولار»
     (نفس الطابع بتاع «ذكاء المؤشرات»). */
  var isUsd = w.id === 'tk-usd';
  var clickable = ixId
  ? ' onclick="openIndexIntel(\'' + ixId + '\')" style="cursor:pointer" title="اضغط لتحليل المؤشر"'
  : (isUsd ? ' onclick="openUSDIntel()" style="cursor:pointer" title="اضغط لتحليل الدولار"' : '');
  var sub = (ixId || isUsd)
  ? '<div class="mini-sub">اضغط للتحليل</div>'
  : '';
  const chgHtml = hasChg
    ? '<div class="mini-c ' + (c>=0?'up':'down') + '">' + (c>=0?'▲ +':'▼ ') + Math.abs(c).toFixed(2) + '%</div>'
    : '<div class="mini-c">—</div>';
  /* 📌 أحمد طلب شيل ملاحظة «إغلاق رسمي/لقطة» من كارت مؤشر الشريعة — بس الرقم.
     📌 الرقم نفسه صحيح (إغلاق رسمي اتقرا من البورصة بعد القفل) فمفيش داعي للملاحظة. */
  const offNote = '';
  return '<div class="mini"' + clickable + '><div class="mini-n">' + w.n + '</div><div class="mini-v">' + v + '</div>' +
  chgHtml + offNote + sub + '</div>';
  }).join('') + '</div>' +
  '<div class="mini-note">💡 الجرام = أونصة الذهب (دولار) × الدولار/الجنيه ÷ 31.1035 — بيتحسب لحظياً</div>' +
  '<div class="mini-note">💵 الدولار/الجنيه: اضغط عليه تشوف «ذكاء الدولار» — السعر الرسمي، التحليل الفني، الدعم والمقاومة، العوامل الاقتصادية والسيناريوهات.</div>' +
  '<div class="mini-note">🕌 مؤشر الشريعة (EGX 33 Shariah): اضغط عليه تشوف تحليل كامل —المنهجية والمكونات ونتيجة OCTA لكل سهم.</div>';
  return uniCard('egyCard', '🇪🇬', 'مؤشرات السوق المصري', 'الأسهم والمؤشرات والعملات والذهب', body, true);
}

/* ═══ الأصول العالمية ═══ */
function buildGlobalCard(ticker) {
  const map = {}; const seen = new Set();
  for (const t of (ticker||[])) { if (!seen.has(t.id)) { seen.add(t.id); map[t.id] = t; } }
  const WANT = [ { id:'tk-gold', n:'🥇 XAU/USD' }, { id:'tk-oil', n:'🛢️ US Oil' },
  { id:'tk-spx', n:'🇺🇸 S&P 500' }, { id:'tk-nasdaq', n:'💻 Nasdaq' } ];
  const body = '<div class="mini-row c4">' + WANT.map(w => {
  const t = map[w.id];
  if (!t) return '<div class="mini"><div class="mini-n">' + w.n + '</div><div class="mini-v">—</div></div>';
  const c = Number(t.change||0);
  return '<div class="mini"><div class="mini-n">' + w.n + '</div><div class="mini-v">' +
  Number(t.value||0).toLocaleString('en-US',{maximumFractionDigits:2}) + '</div>' +
  '<div class="mini-c ' + (c>=0?'up':'down') + '">' + (c>=0?'+':'') + c.toFixed(2) + '%</div></div>';
  }).join('') + '</div>';
  return uniCard('glbCard', '🌍', 'الأصول العالمية', 'الذهب والنفط والمؤشرات الأمريكية', body, true);
}

/* ═══ القطاعات ═══ */

/* ══════════ كارت الأدوات الكبير + الأكاديمية ══════════ */
const TOOLS_HUB = [
  { n:'🐙', num:'01', name:'تحليل الأذرع الثمانية', desc:'كل ذراع بتعمل إيه وإزاي توصل للتحليل النهائي',
  tags:['فني','أساسي','سيولة','مخاطر'], go:'arms' },
  { n:'🧠', num:'02', name:'المحرك الذكي', desc:'التحليل الكامل بالذكاء الاصطناعي — ٨ محاور',
  tags:['تحليل','ثقة','شرح'], go:'engine' },
  { n:'🔍', num:'03', name:'بحث الأسهم', desc:'اكتب رمز أو اسم السهم — تحميل لحظي',
  tags:['252 سهم','فوري'], go:'stocks' },
  { n:'⚖️', num:'04', name:'مقارنة الأسهم', desc:'قارن بين ٢ أو ٣ أسهم جنب بعض',
  tags:['مقارنة','رسوم'], go:'compare' },
  { n:'🔍', num:'05', name:'فلتر الأسهم', desc:'فلترة متقدمة بالقطاع والتقييم والسيولة',
  tags:['فلاتر','شامل'], go:'screener' },
  { n:'🏆', num:'06', name:'أفضل الفرص', desc:'الأسهم الأعلى نتيجة حسب تحليلنا الكامل',
  tags:['مختارة','تحليل'], go:'bestpick' },
];


/* ══════════ البحث السريع (TradingView) ══════════ */
let TV_LIST = [];
let TV_SEL = -1;

function renderTvSearchBox() {
  const el = document.getElementById('tvSearchBox');
  if (!el) return;
  el.innerHTML = '<input class="ds-input" id="tvInput" type="text" ' +
  'placeholder="اكتب كود السهم — مثال: COMI" autocomplete="off" ' +
  'oninput="tvSearch(this.value)" onkeydown="tvKey(event)">' +
  '<div class="ds-results" id="tvResults"></div>';
}

async function initTvList() {
  if (TV_LIST.length) return;
  try {
  const d = await apiGet('/api/rank?limit=252', 20000);
  TV_LIST = d.results || [];
  } catch (e) { TV_LIST = []; }
}

function tvSearch(q) {
  const box = document.getElementById('tvResults');
  if (!box) return;
  q = String(q || '').trim();
  if (!q) { box.innerHTML = ''; return; }
  initTvList().then(() => {
  const up = q.toUpperCase();
  const hits = TV_LIST.filter(s =>
  (s.code||'').toUpperCase().includes(up) || (s.name||'').includes(q)
  ).slice(0, 15);
  if (!hits.length) {
  box.innerHTML = '<div class="ds-empty">لا توجد نتائج لـ "' + q + '"</div>';
  return;
  }
  box.innerHTML = hits.map((s,i) => {
  const c = s.change || 0;
  return '<div class="ds-row" data-i="' + i + '" onclick="tvPick(' + i + ')">' +
  '<div class="ds-badge">' + (s.code||'').slice(0,2) + '</div>' +
  '<div class="ds-info"><div class="ds-code">' + s.code + '</div>' +
  '<div class="ds-name">' + (s.name||'').slice(0,28) + '</div></div>' +
  '<div class="ds-price"><div class="ds-p">' + Number(s.price||0).toFixed(2) + '</div>' +
  '<div class="ds-c ' + (c>=0?'pos':'neg') + '">' + (c>=0?'+':'') + c.toFixed(2) + '%</div></div>' +
  '</div>';
  }).join('');
  });
}

function tvKey(e) {
  const box = document.getElementById('tvResults');
  if (!box || !box.children.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); TV_SEL = Math.min(TV_SEL+1, box.children.length-1); tvHi(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); TV_SEL = Math.max(TV_SEL-1, 0); tvHi(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (TV_SEL >= 0) tvPick(TV_SEL); }
}

function tvHi() {
  document.querySelectorAll('#tvResults .ds-row').forEach((r,i) => {
  r.style.background = i === TV_SEL ? 'rgba(212,175,55,.14)' : '';
  });
}

function tvPick(i) {
  const row = document.querySelectorAll('#tvResults .ds-row')[i];
  if (!row) return;
  const code = row.querySelector('.ds-code').textContent;
  const inp = document.getElementById('tvInput');
  if (inp) { inp.value = ''; inp.placeholder = code + ' — اكتب للبحث الجديد'; }
  // البحث السريع → التحليل الكامل
  if (typeof openStock === 'function') { try { openStock(code); return; } catch(e){} }
  openStockModal(code);
}

function buildToolsCard() {
  return uniCard('toolsCard', '🧰', 'أدوات التحليل', 'اضغط على أي أداة لفتحها', 
  '<div class="tools-hub">' + TOOLS_HUB.map(t =>
  '<div class="tool-card" onclick="switchPage(\'' + t.go + '\')">' +
  '<div class="tool-num">' + t.num + '</div>' +
  '<span class="tool-ico">' + t.n + '</span>' +
  '<div class="tool-name">' + t.name + '</div>' +
  '<div class="tool-desc">' + t.desc + '</div>' +
  '<div class="tool-tags">' + t.tags.map(x=>'<span>' + x + '</span>').join('') + '</div>' +
  '</div>').join('') +
  '</div>');
}

function buildAcademyCard() {
  return uniCard('acadCard', '🎓', 'أكاديمية التداول', 'مشروع تعليمي متكامل',
  '<div class="acad-card" onclick="switchPage(\'academy\')">' +
  '<span class="acad-badge">🌟 قسم مميز</span>' +
  '<div class="acad-name">أكاديمية التداول المصرية</div>' +
  '<div class="acad-desc">' +
  'كورس كامل في التداول على البورصة المصرية — من الصفر للاحتراف.<br>' +
  'يجمع في مكان واحد: الدروس، المنتدى، وملخصات كتب أعظم المستثمرين في العالم.' +
  '</div>' +
  '<div class="acad-items">' +
  '<span>📚 كورس كامل</span><span>💬 منتدى نقاش</span>' +
  '<span>📖 ملخصات كتب</span><span>🎓 لمحة سريعة</span>' +
  '</div>' +
  '</div>');
}

function buildSectorCard(stocks) {
  const bySec = {};
  for (const s of (stocks||[])) {
  const sec = s.sector || 'أخرى';
  if (!bySec[sec]) bySec[sec] = { n:0, sum:0, cnt:0 };
  bySec[sec].n++;
  if (Number.isFinite(s.change)) { bySec[sec].sum += s.change; bySec[sec].cnt++; }
  }
  const items = Object.entries(bySec).map(([k,v]) => ({ name:k, count:v.n, avg: v.cnt?v.sum/v.cnt:0 })).sort((a,b)=>b.avg-a.avg);
  const body = '<div class="mini-row c4" id="secGrid">' + items.map(s => {
  const cls = s.avg>0.5?'up':(s.avg<-0.5?'down':'neu');
  const col = cls==='up'?'var(--sec)':(cls==='down'?'var(--red2)':'var(--muted)');
  return '<div class="sec-cell ' + cls + '" onclick="showSector(\'' + s.name + '\')">' +
  '<div class="sec-n">' + s.name + '</div>' +
  '<div class="sec-v" style="color:' + col + '">' + (s.avg>=0?'+':'') + s.avg.toFixed(2) + '%</div>' +
  '<div class="sec-c">' + s.count + ' سهم</div></div>';
  }).join('') + '</div><div id="secStocks" style="margin-top:11px"></div>';
  return uniCard('secCard', '🗺️', 'خريطة القطاعات', 'اضغط على أي قطاع لعرض أسهمه', body, false);
}
let ALL_STK = [];
async function showSector(sec) {
  const box = document.getElementById('secStocks');
  if (!box) return;
  if (box.dataset.sec === sec) { box.innerHTML=''; box.dataset.sec=''; return; }
  box.dataset.sec = sec;
  box.innerHTML = '<div class="dc-loading" style="padding:18px;text-align:center;color:#8b9eb0">🔄 ' + sec + '...</div>';
  try {
  if (!ALL_STK.length) ALL_STK = (await apiGet('/api/rank?limit=252', 20000)).results || [];
  const list = ALL_STK.filter(s => (s.sector||'أخرى')===sec).sort((a,b)=>(b.change||0)-(a.change||0)).slice(0,25);
  if (!list.length) { box.innerHTML = '<div class="dc-loading">لا توجد أسهم</div>'; return; }
  box.innerHTML = '<div class="dc-col-h" style="margin-bottom:7px">📂 أسهم ' + sec + ' (' + list.length + ')</div>' +
  list.map(barRow).join('') +
  '<button onclick="closeStockPanel()" class="omback" style="margin-top:9px">← إخفاء</button>';
  } catch (e) { box.innerHTML = '<div class="dc-loading" style="color:var(--red2)">تعذر: ' + (e.message||'') + '</div>'; }
}

/* ══════════════════════════════════════════════════════════════
  🃏 كارت القرار — بيتحسب وقت الفتح (مش ثابت)
  منقول كما هو من verdict-card.html المعتمد
  ══════════════════════════════════════════════════════════════ */
/* الأوزان جاية من /api/engine-weights بعد الدخول — مش مكتوبة في الملف. */
function W_US(){ return (CFG.weights && CFG.weights.us) || {}; }
function W_EGX(){ return (CFG.weights && CFG.weights.egx) || {}; }
const AR_MS = { technical:'فني', fundamental:'أساسي', valuation:'تقييم', liquidity:'سيولة',
  news:'محفزات', sentiment:'معنويات', risk:'مخاطرة', portfolio:'محفظة' };
let V_REFRESH_MS = 120000, V_TIMER = null, V_CURRENT = 'COMI';

const vEsc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const vNf = n => (n==null||isNaN(n)) ? '—' : Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
const vCls = v => v>=CFG.th.safe?'g':(v>=CFG.th.mid?'m':'b');

function vAgo(iso){ if(!iso) return null; const t=Date.parse(iso); if(isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now()-t)/1000)); }
function vAgoTxt(s){ if(s==null) return 'غير معروف';
  if(s<60) return 'من '+s+' ثانية'; if(s<3600) return 'من '+Math.round(s/60)+' دقيقة';
  return 'من '+Math.round(s/3600)+' ساعة'; }

const V_PHASE_TXT = { open:'🟢 التداول جاري', pre:'🟡 قبل الفتح', closed:'🔴 السوق مقفول', weekend:'⚪ ويك إند' };
function vPhaseInterval(p){ return p==='open'?120000 : p==='pre'?600000 : 3600000; }
function vSetPhase(p){
  const b = document.getElementById('vPhaseBadge');
  if (b) b.className = 'vphase ' + (p||'closed');
  const t = document.getElementById('vPhaseTxt');
  if (t) t.textContent = V_PHASE_TXT[p] || 'حالة غير معروفة';
  V_REFRESH_MS = vPhaseInterval(p);
}

function vDeriveValuation(f){
  if(!f) return null;
  const fv=f.fair_value, up=f.upside_pct, conf=f.fair_value_confidence;
  if(fv==null || isNaN(fv) || fv<=0) return null;
  let v = 50 + (up||0) * 1.1;
  if(conf!=null && conf<40) v -= 8;
  if(f.sector_peers && f.sector_peers['عدد المقارنة']===0) v -= 6;
  return Math.max(5, Math.min(95, v));
}
/* ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — vWeighted بترجّع null لما مافيش ولا محور متاح.
   ⛌ الكارت كان بيعمل usScore.toFixed(1) ⇒ «Cannot read properties of null
   ⛌   (reading 'toFixed')» ⇒ **الكرت كله بيموت** والصفحة بتعرض error.
   ⛌ ✅ الحل: null ⇒ «—» (مش صفر — الصفر كذب).
   📌 نفس القيمة بتتعرض في كمان في السطر التاني (egxScore). */
function vFmtScore(v){
  if (v==null || isNaN(v)) return '—';
  return Number(v).toFixed(1);
}
function vWeighted(scores,w){
  /* المحاور الناقصة بتتشال والباقي بيتطبّع — زي المحرك بالظبط.
  ⚠ كانت بترجّع 0 لو مفيش ولا محور متاح.
  الرقم 0 هنا معناه «صفر من 100» — وده كذب.
  ⛔ الصفر هو الدرجة الحقيقية لو محور فعلاً وصل صفر.
  لا ناقص ⛔ مفيش أرقام خالص ⇒ null. */
  let sum=0,wsum=0;
  for(const k in w){ if(w[k]<=0) continue; const v=scores[k];
  if(v==null||isNaN(v)) continue; sum+=v*w[k]; wsum+=w[k]; }
  return wsum ? sum/wsum : null;
}
function vVerdictOf(sc){ /* ⛔ null معناها «مفيش بيانات» — مش صفر.
  لو رجعناها sell هنقول للمستخدم «بيع» بسبب مفيش سبب. */
  if(sc==null||isNaN(sc)) return {t:'غير متاح',c:'v-none'};
  if(sc>=CFG.th.buy) return {t:CFG.labels.buy,c:'v-buy'};
  if(sc>=CFG.th.hold) return {t:CFG.labels.hold,c:'v-hold'};
  return {t:CFG.labels.sell,c:'v-sell'}; }
function vExplOf(x){ if(!x) return {};
  if(x.explanation && typeof x.explanation==='object') return x.explanation;
  if(x.top_positives||x.top_negatives) return x; return {}; }

function vBuildLevels(tech,price,f){
  const lv=(tech&&tech.technical&&tech.technical.levels)||{};
  const atr=(tech&&tech.technical&&tech.technical.atr_pct)||null;
  const fv=f.fair_value; const out={rows:[],note:''};
  if(!price){ out.note='⛔ مفيش سعر — مش هنخترع أرقام.'; return out; }
  if(fv && fv>0){ const upPct=f.upside_pct;
  if(upPct==null || upPct>3){
  out.rows.push({lab:'هدف القيمة العادلة',val:Number(fv).toFixed(2),
  pill:(upPct!=null&&upPct>0)?'p-go':'p-wait',txt:(upPct!=null&&upPct>0?'فوق السعر':'تحت السعر')});
  } else if(upPct!=null && upPct < -10){
  out.rows.push({lab:'القيمة العادلة',val:Number(fv).toFixed(2),pill:'p-no',txt:'السعر غالي'}); }
  }
  if(lv['دعم_1']!=null && lv['دعم_1']>0){ const d=lv['دعم_1'];
  out.rows.push({lab:'دعم 1 (من المحرك)',val:Number(d).toFixed(2),
  pill:d<price?'p-go':'p-wait',txt:d<price?'دخول أأمن':'السعر فوقه'}); }
  if(lv['مقاومة_1']!=null && lv['مقاومة_1']>0)
  out.rows.push({lab:'مقاومة 1 (من المحرك)',val:Number(lv['مقاومة_1']).toFixed(2),pill:'p-wait',txt:'حاجز'});
  if(atr && atr>0){ const noChase=price*(1+atr/100*CFG.risk.noChaseAtr);
  out.rows.push({lab:'⛔ لا تتسرّب فوق',val:noChase.toFixed(2),pill:'p-no',txt:'+'+(atr*CFG.risk.noChaseAtr).toFixed(1)+'% ('+CFG.risk.noChaseAtr+'×ATR)'});
  out.note='التقلّب الشهري '+atr.toFixed(2)+'% — كل المستويات دي من المحرك، مش تقدير.';
  } else out.note='مفيش مؤشر تذبذب متاح — المستويات المعروضة من المحرك بس.';
  return out;
}

function vRing(pct,color){
  /* ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — pct ممكن يبقى null (مافيش محاور عنده بيانات).
   ⛌ was: C*(1-pct/100) ⇒ NaN ⇒ stroke-dashoffset="NaN" ⇒ المتصفح
   ⛌   بيرسم الدايرة كلها (يعني الشكل بيكذب: بيقول 0% وهو مش عارف).
   ⛌ ✅ الحل: null ⇒ 0 + علامة «لا توجد بيانات» بدل رقم مخترع. */
  const has = (pct!=null && !isNaN(pct));
  const p = has ? Number(pct) : 0;
  const R=56,C=2*Math.PI*R,off=C*(1-p/100);
  return '<div class="vring"><svg width="132" height="132">'+
  '<circle cx="66" cy="66" r="'+R+'" fill="none" stroke="var(--vring-track)" stroke-width="11"/>'+
  '<circle cx="66" cy="66" r="'+R+'" fill="none" stroke="'+color+'" stroke-width="11" '+
  'stroke-linecap="round" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" '+
  'style="transition:stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)"/></svg>'+
  '<div class="vval"><b>'+(has ? Math.round(p) : '—')+'</b><span>'+
  (has ? 'OCTA /100' : 'لا توجد بيانات')+'</span></div></div>';
}

/* 🆕 المؤشرات الحقيقية من startamarkets (data_egx.json) */
function vTech(code){
  const st = (typeof OS_DB!=='undefined') ? OS_DB.find(x=>x.code===code) : null;
  return st || null;
}
function vTechSignals(code, price){
  const st = vTech(code); if(!st || !price) return null;
  const o = {
  rsi: vNum(st.rsi), beta: vNum(st.beta),
  ma50: vNum(st.ma50), ma200: vNum(st.ma200),
  roe: vNum(st.roe), roa: vNum(st.roa), pb: vNum(st.pb),
  dy: vNum(st.dy), float: vNum(st.float),
  gm: vNum(st.gm), cg: vNum(st.cagr3y)   /* ⚠ rg كان الإيراد بالجنيه — اتشال */
  };
  const out = [];
  /* RSI */
  if(o.rsi!=null){
  const t = o.rsi>70 ? ['🔴 تشبع شرائي — السعر بقى غالي قصير المدى',
  'قد يصحّح نزولاً. متدخلش بقوة على القمة.',
  'overbought']
  : o.rsi<30 ? ['🟢 تشبع بيعي — فرصة شراء محتملة',
  'السهم اتضغط أوي — ابحث عن علامة ارتداد.',
  'oversold']
  : ['⚪ مؤشر القوة النسبية في المنطقة المحايدة ('+o.rsi.toFixed(0)+')',
  'مفيش ضغط ولا ارتداد واضح دلوقتي.','neutral'];
  out.push({k:'RSI (14)', v:o.rsi.toFixed(1), cls:o.rsi>70?'bad':o.rsi<30?'good':'', t:t[0], sub:t[1]});
  }
  /* ضد المتوسطات */
  if(o.ma50!=null && price){
  const d = (price - o.ma50)/o.ma50*100;
  out.push({k:'مقابل المتوسط 50 يوم', v:(d>=0?'+':'')+d.toFixed(1)+'%',
  cls: d>=0?'good':'bad',
  t: d>=0 ? '🟢 فوق المتوسط — الاتجاه صاعد' : '🔴 تحت المتوسط — لسه ضعيف',
  sub:'MA50 = '+o.ma50.toFixed(2)+' ج · والسعر '+(d>=0?'فوقه':'تحته')});
  }
  if(o.ma200!=null && price){
  const d = (price - o.ma200)/o.ma200*100;
  out.push({k:'مقابل المتوسط 200 يوم', v:(d>=0?'+':'')+d.toFixed(1)+'%',
  cls: d>=0?'good':'',
  t: d>=0 ? '🟢 فوق المتوسط طويل المدى — اتجاه رئيسي صاعد'
  : '🟡 تحت المتوسط طويل المدى — في تصحيح أو تغيّر اتجاه',
  sub:'MA200 = '+o.ma200.toFixed(2)+' ج'});
  }
  /* Beta */
  if(o.beta!=null){
  const t = o.beta>1.2 ? ['🔴 معامل مخاطرة عالي — بيتحرك أكتر من السوق (أخطر وأعلى عائد)','كل <span class="flt-ltr">1%</span> في السوق بيتقابل %.2f%% في السهم.'.replace('%.2f',(o.beta).toFixed(2)),'high']
  : o.beta<0.8 ? ['🟢 معامل مخاطرة منخفض — بيتحرك أقل من السوق (أهدأ)','مناسب للمحفظة اللي عايزة استقرار.','low']
  : ['⚪ معامل مخاطرة قريب من السوق','سلوكه شبيه بالبورصة.','mid'];
  out.push({k:'Beta (سنة)', v:o.beta.toFixed(2), cls:o.beta>1.2?'bad':o.beta<0.8?'good':'', t:t[0], sub:t[1]});
  }
  return out.length?out:null;
}
function vNum(v){ return (typeof v==='number' && isFinite(v) && v) ? v : null; }

/* 🆕 المخاطرة الحقيقية — محسوبة من كامل تاريخ السهم المتاح، مش تقدير
   ملاحظة: عمق التاريخ يختلف من سهم للتاني (أقدم سجل في المصدر 2000-11-27)،
   فمفيش رقم واحد ينطبق على الكل — النصوص بتتكلم عن «تاريخ السهم» مش «تاريخ كل سهم». */
function vRiskSignals(code){
  const st = vTech(code); if(!st) return null;
  const o = { v1:st.vol1y, v3:st.vol3y, mdd:st.mdd, mdd1:st.mdd1y,
  sh:st.sharpe, so:st.sortino, cg:st.cagr3y, f52:st.frm52hi };
  const out = [];
  if(o.v1!=null){
  const t = o.v1<25 ? ['🟢 تذبذب هادي — <span class="flt-ltr">25%</span> سنوي', 'السهم بيتحرك أهدأ من نص السوق (نص السوق ~<span class="flt-ltr">44%</span>).','low']
  : o.v1<55 ? ['⚪ تذبذب متوسط — 25–<span class="flt-ltr">55%</span> سنوي', 'سلوك طبيعي لسهم في البورصة المصرية.','mid']
  : ['🔴 تذبذب عالي — فوق <span class="flt-ltr">55%</span> سنوي','يتحرك 1.5× أو أكتر من السوق. مخاطرة حقيقية.','high'];
  out.push({k:'التذبذب السنوي', v:o.v1+'%', cls:t[2], t:t[0], sub:t[1]});
  }
  if(o.mdd1!=null && o.mdd!=null && Math.abs(o.mdd1-o.mdd) < o.mdd*0.15){
  /* فرق صغير → الرقم واحد، نعرضه مرة واحدة */
  out.push({k:'أكبر هبوط', v:'−'+o.mdd+'%', cls:'bad',
  t:'📉 أعمق نقطة وصلها السهم — في آخر سنة من عمره كله',
  sub:'المحاكاة الأسوأ عبر كل تاريخ السهم المتاح. ده اللي المفروض تتحسب منه، مش السعر الحالي.'});
  } else {
  if(o.mdd1!=null) out.push({k:'أكبر هبوط (سنة)', v:'−'+o.mdd1+'%', cls:o.mdd1>50?'bad':o.mdd1>30?'':'good',
  t: o.mdd1>50 ? '🔴 فقد أكتر من نص قيمته في سنة' : o.mdd1>30 ? '⚠️ هبوط محسوس — <span class="flt-ltr">30%</span>+' : '🟢 هبوط محدود',
  sub:'أكبر نزول من قمة لـقاع خلال آخر سنة'});
  if(o.mdd!=null) out.push({k:'أكبر هبوط (كل التاريخ)', v:'−'+o.mdd+'%', cls:'bad',
  t:'📉 أعمق نقطة وصلها السهم في كل تاريخه المتاح',
  sub:'لو الشدة دي تتكرر كل شوية — ده الأسوأ الدائم'});
  }
  if(o.sh!=null){
  out.push({k:'شارب (3 سنين)', v:o.sh, cls:o.sh>1.5?'good':o.sh<0.5?'bad':'',
  t: o.sh>1.5 ? '🟢 عائد ممتاز مقابل المخاطرة' : o.sh<0.5 ? '🔴 عائد ضعيف مقابل المخاطرة' : '⚪ عائد معقول',
  sub:'العائد السنوي المركّب ÷ التذبذب ('+(o.cg!=null?o.cg+'% نمو':'—')+')'});
  }
  if(o.f52!=null){
  out.push({k:'من أعلى 52 أسبوع', v:(o.f52>=0?'+':'')+o.f52+'%', cls:o.f52>-15?'good':o.f52<-40?'bad':'',
  t: o.f52>-15 ? '🟢 قريب من قمعه — متعب بيع' : o.f52<-40 ? '🔴 بعيد أوي عن قمعه' : '⚪ في النص',
  sub:'أين السهم من أعلى سعر آخر سنة'});
  }
  return out.length?out:null;
}
function vRenderCard(d,exRaw,tech){
  const ex=vExplOf(exRaw), ax=d.axes||{}, f=d.fundamental||{}, re=d.risk_engine||{};
  const val=vDeriveValuation(f);
  const us=Object.assign({},ax,{valuation:val});
  const usScore=vWeighted(us,W_US()), egxScore=vWeighted(Object.assign({},ax),W_EGX());
  const v=vVerdictOf(usScore), vEgx=vVerdictOf(egxScore);
  /* ⛔ بدون بيانات ⇒ لون محايد، مش أحمر. الأحمر معناه «سيء» مش «مجهول». */
  const color = (usScore==null) ? '#8b93a7'
  : usScore>=CFG.th.buy ? 'var(--up)'
  : usScore>=CFG.th.hold ? 'var(--gold)' : 'var(--red2,#ff5252)';

  const s=vAgo(d.data_ts), stale = s!=null && s>7200;
  const fresh='<div class="vfresh'+(stale?' stale':'')+'">'+
  '<span>'+(stale?'⚠️ بيانات قديمة — مفيش تحديث جديد':('🕒 آخر تحديث: '+vAgoTxt(s)))+'</span>'+
  '<span class="r" id="vcnt">تحديث خلال '+Math.round(V_REFRESH_MS/1000)+'ث</span></div>';

  let arms='';
  for(const k in AR_MS){
  const raw=us[k], v2=(raw==null||isNaN(raw))?0:raw;
  arms+='<div class="varms">'+
  '<span class="varms-n">'+AR_MS[k]+'</span><span class="varms-w">'+(W_US()[k]||0)+'%</span>'+
  '<span class="varms-t"><span class="varms-f '+vCls(v2)+'" style="width:'+v2.toFixed(1)+'%"></span></span>'+
  '<span class="varms-v '+vCls(v2)+'">'+(raw==null?'—':Math.round(raw))+'</span></div>';
  }

  const pos=(ex.top_positives||[]).slice(0,3), neg=(ex.top_negatives||[]).slice(0,3);
  let why='';
  pos.forEach(p=>{why+='<div class="vwhy-i pos"><span class="ic">✅</span><span>'+vEsc(p.text)+
  '<span class="src">'+vEsc(p.from||'')+'</span></span></div>';});
  neg.forEach(p=>{why+='<div class="vwhy-i neg"><span class="ic">⚠️</span><span>'+vEsc(p.text)+
  '<span class="src">'+vEsc(p.from||'')+'</span></span></div>';});
  if(!why) why='<div class="vwhy-i"><span class="ic">😐</span><span>مفيش نقاط قوة أو ضعف مميزة اتسجلت — المحرك رجّع ملخص فاضي.</span></div>';

  const price=d.price, fv=f.fair_value, L=vBuildLevels(tech,price,f);
  let entry='<div class="vtable-wrap"><table class="vtable"><tr><th>المستوى</th><th>السعر</th><th>الحكم</th></tr>'+
  L.rows.map(r=>'<tr><td>'+r.lab+'</td><td><b>'+r.val+'</b></td>'+
  '<td><span class="vpill '+r.pill+'">'+r.txt+'</span></td></tr>').join('')+'</table></div>';
  if(L.note) entry+='<div class="vnote">'+vEsc(L.note)+'</div>';
  if(!L.rows.length) entry='<div class="vnote">⛔ لا توجد مستويات محسوبة — مش هنخترع أرقام.</div>';

  let ab='<div class="vab-row head"><span>المحور</span><span>وزنك</span><span>النتيجة</span><span>محرك التحليل</span></div>';
  for(const k in AR_MS){
  const raw=us[k], v2=(raw==null||isNaN(raw))?0:raw;
  const vx=ax[k], vx2=(vx==null||isNaN(vx))?0:vx;
  ab+='<div class="vab-row"><span class="vab-n">'+AR_MS[k]+'</span>'+
  '<span class="vab-c">'+(W_US()[k]||0)+'%</span>'+
  '<span class="vab-c '+((W_US()[k]||0)>(W_EGX()[k]||0)?'win':'')+'">'+Math.round(v2)+'</span>'+
  '<span class="vab-c '+((W_EGX()[k]||0)>(W_US()[k]||0)?'win':'')+'">'+Math.round(vx2)+'</span></div>';
  }
  ab+='<div class="vab-row vab-tot"><span class="vab-n">النتيجة</span><span></span>'+
  '<span class="vab-c win">'+vFmtScore(usScore)+'</span><span class="vab-c win">'+vFmtScore(egxScore)+'</span></div>';

  /* 🆕 قسم المؤشرات الحقيقية */
  const sig = vTechSignals(d.code, price);
  let techHtml='';
  if(sig){
  techHtml = '<div class="vcard"><div class="vsec-h">📡 الأرقام الحقيقية — دلوقتي السهم فين؟</div>'+
  '<div class="vtech">' + sig.map(x =>
  '<div class="vtech-i '+(x.cls||'') + '">' +
  '<div class="vtech-k">'+x.k+'</div>' +
  '<div class="vtech-v">'+x.v+'</div>' +
  '<div class="vtech-t">'+x.t+'</div>' +
  '<div class="vtech-s">'+vEsc(x.sub||'')+'</div>' +
  '</div>').join('') + '</div>' +
  '<div class="vnote">المصدر: بيانات البورصة الرسمية + (TradingView) · التحديث كل 15 دقيقة. ' +
  'الحكم هنا <b>مش</b> بديل قرار OCTA — ده بيوضحلك السهم فين من الناحية الفنية دلوقتي.</div></div>';
  } else {
  techHtml = '<div class="vcard"><div class="vsec-h">📡 الأرقام الحقيقية</div>' +
  '<div class="vnote">⛔ مفيش مؤشرات فنية محسوبة لهذا السهم — مش هنخترع أرقام.</div></div>';
  }

  /* 🆕 قسم المخاطرة الحقيقية */
  const rsig = vRiskSignals(d.code);
  let riskHtml='';
  if(rsig){
  riskHtml = '<div class="vcard"><div class="vsec-h">⚠️ المخاطرة الحقيقية — محسوبة من كل تاريخ السهم المتاح</div>'+
  '<div class="vtech">' + rsig.map(x =>
  '<div class="vtech-i '+(x.cls||'') + '">' +
  '<div class="vtech-k">'+x.k+'</div>' +
  '<div class="vtech-v">'+x.v+'</div>' +
  '<div class="vtech-t">'+x.t+'</div>' +
  '<div class="vtech-s">'+vEsc(x.sub||'')+'</div>' +
  '</div>').join('') + '</div>' +
  '<div class="vnote">دي أرقام محسوبة من شموع البورصة نفسها — مش تقدير. ' +
  '«أكبر هبوط» أهم رقم هنا: هو اللي بيقول لك السهم ده ممكن يروح فين الأسوأ لو الشرح أسوأ.</div></div>';
  }

  const inval=ex.what_could_invalidate||[];
  const invalHtml = inval.length
  ? '<div class="vcard"><div class="vsec-h">🚫 اللي يطلّع الفكرة دي</div><div class="vwhy">'+
  inval.slice(0,3).map(t=>'<div class="vwhy-i neg"><span class="ic">⛔</span><span>'+vEsc(t)+'</span></div>').join('')+
  '</div></div>' : '';

  const chg=d.change||0, chgCls=chg>=0?'up':'down', conf=d.confidence;

  document.getElementById('vOut').innerHTML =
  '<div class="vcard">'+fresh+
  '<div class="vcard-hd">'+
  '<div><div class="vasset-name">'+vEsc(d.name||'—')+'</div>'+
  '<span class="vasset-code">'+vEsc(d.code)+'</span>'+
  '<div class="vasset-sect">'+vEsc(f.sector||d.sector||'—')+
  ' · ثقة البيانات '+vEsc(conf!=null?conf+'%':'—')+
  (d.data_confidence!=null?(' · اكتمال '+d.data_confidence+'%'):'')+'</div></div>'+
  '<div class="vprice-box"><span class="vprice-val">'+vNf(price)+'</span>'+
  '<span class="vprice-chg '+chgCls+'">'+(chg>=0?'▲ +':'▼ ')+Number(chg).toFixed(2)+'%</span></div>'+
  '</div>'+
  vRing(usScore,color)+
  '<div class="vring-wrap"><div>'+
  '<div class="vverdict '+v.c+'">'+v.t+'</div>'+
  '<div class="vverdict-note">أمان المخاطرة: <b style="color:'+(re.safety_score>=70?'var(--sec)':(re.safety_score>=50?'var(--gold2)':'var(--red2)'))+'">'+
  (re.safety_score!=null?re.safety_score+' ('+vEsc(re.risk_level||'—')+')':'—')+'</b><br>'+
  'فرصة معدّلة بالمخاطرة: <b>'+(re.risk_adjusted_opportunity!=null?re.risk_adjusted_opportunity:'—')+'</b>'+
  '</div>'+
  '</div></div>'+
  '<button class="vrf" onclick="vLoadCard()">🔄 إعادة الحساب الآن</button>'+
  '</div>'+
  '<div class="vcard"><div class="vsec-h">🦞 الأذرع الثمانية — بأوزانك</div>'+arms+
  '<div class="vnote">محور التقييم مستنتج من القيمة العادلة — مش محور مستقل في المحرك، فلو طلع — يبقى ده فجوة بيانات.</div></div>'+
  '<div class="vcard"><div class="vsec-h">🔍 ليه القرار ده</div><div class="vwhy">'+why+'</div>'+
  (ex.formula?'<div class="vnote">المعادلة: '+vEsc(ex.formula)+'</div>':'')+'</div>'+
  techHtml+ riskHtml +
  '<div class="vcard"><div class="vsec-h">🎯 مناطق الدخول</div>'+entry+
  '<div class="vnote">القيمة العادلة: <b style="color:var(--gold2)">'+(fv?vNf(fv):'—')+'</b>'+
  (f.valuation_status?(' · '+vEsc(f.valuation_status)):'')+
  (f.upside_pct!=null?(' · التقدير '+(f.upside_pct>0?'+':'')+f.upside_pct+'%'):'')+'</div></div>'+
  '<div class="vcard"><div class="vsec-h">⚖️ وزنك مقابل محرك التحليل</div>'+ab+
  '<div class="vnote">الفرق الأساسي: إنت مديت المخاطرة <span class="flt-ltr">10%</span> والمحلرك بيخليها <span class="flt-ltr">24%</span>، والمعنويات <span class="flt-ltr">10%</span> عندك و4% عنده. '+
  'لو الفرق في القرار كبير، يبقى وزنك محتاج معايرة على بيانات حقيقية — مش كلام.</div></div>'+
  invalHtml;

  vStartCountdown();
}

function vStartCountdown(){
  if(V_TIMER) clearInterval(V_TIMER);
  let left=Math.round(V_REFRESH_MS/1000);
  V_TIMER=setInterval(()=>{
  left--;
  const el=document.getElementById('vcnt'); if(!el) return;
  if(left<=0){ clearInterval(V_TIMER); vLoadCard(true); return; }
  el.textContent='تحديث خلال '+left+'ث';
  },1000);
}

async function vLoadCard(silent){
  const inp=document.getElementById('vCodeInput');
  const code=(silent?V_CURRENT:(inp?inp.value.trim().toUpperCase():'')) || 'COMI';
  if(!silent) V_CURRENT=code;
  const out=document.getElementById('vOut'); if(!out) return;
  if(!silent) out.innerHTML='<div class="vload"><span class="vspin"></span> بجيب بيانات حيّة...</div>';
  try{
  const bust='?_='+Date.now();
  const [ir,er,rr,tr]=await Promise.all([
  octaFetch(OCTA_API+'/api/intelligence/'+code+bust).then(r=>{if(!r.ok) throw new Error('السهم '+code+' غير موجود');return r.json();}),
  octaFetch(OCTA_API+'/api/explain/'+code+bust).then(r=>r.ok?r.json():{}).catch(()=>({})),
  octaFetch(OCTA_API+'/'+bust).then(r=>r.ok?r.json():{}).catch(()=>({})),
  octaFetch(OCTA_API+'/api/technical/'+code+bust).then(r=>r.ok?r.json():{}).catch(()=>({}))
  ]);
  if(ir.error) throw new Error(ir.error);
  vSetPhase(rr.market_phase || 'closed');
  vRenderCard(ir,er,tr);
  if(!silent && inp) inp.value=code;
  }catch(e){
  out.innerHTML='<div class="vcard verr">❌ '+vEsc(e.message||'فشل الاتصال')+
  '<br><br><span class="vnote">تأكد من كود السهم، أو جرّب تاني.</span></div>';
  }
}

function initVerdictCard(){
  const qr=document.getElementById('vQuickRow');
  if(qr) qr.innerHTML=OCTA_QUICK.map(c=>'<button onclick="document.getElementById(\'vCodeInput\').value=\''+c+
  '\';vLoadCard()">'+c+'</button>').join('');
  const ci=document.getElementById('vCodeInput');
  if(ci && !ci.dataset.bound){ ci.dataset.bound='1';
  ci.addEventListener('keydown',e=>{ if(e.key==='Enter') vLoadCard(); }); }
  const out=document.getElementById('vOut');
  if(out && !out.dataset.loaded){ out.dataset.loaded='1'; vLoadCard(); }
}

/* ══════════ كارت قرار OCTA — القرار الحي للسوق ككل ══════════ */
const VC_DEC = {
  'إشارة إيجابية':  { c:'#16c79a', bg:'rgba(22,199,154,.16)' },
  'شراء':  { c:'#16c79a', bg:'rgba(22,199,154,.16)' },
  'إشارة محايدة':  { c:'#4dabf7', bg:'rgba(77,171,247,.16)' },
  'إشارة سلبية':  { c:'#ff8a80', bg:'rgba(255,82,82,.16)' },
  'تجنب':  { c:'#ff5252', bg:'rgba(255,82,82,.16)' }
};
const VC_AXES = [
  ['فني','technical'], ['أساسي','fundamental'], ['سيولة','liquidity'],
  ['أخبار','news'], ['معنويات','sentiment'], ['أمان','safety'],
  ['محفظة','portfolio'], ['النتيجة','final']
];
const vcColor = v => v >= CFG.th.safe ? '#16c79a' : v >= CFG.th.mid ? '#f4d03f' : '#ff8a80';

function buildOctaVerdictCard(d, results) {
  const dec = (d && d.decisions) || {};
  const ax  = (d && d.axis_average) || {};
  const h  = (d && d.health) || {};

  const cnt = { 'إشارة إيجابية': dec['إشارة إيجابية'] || dec['شراء'] || 0, 'إشارة محايدة': dec['إشارة محايدة'] || 0, 'إشارة سلبية': dec['إشارة سلبية'] || 0 };
  const tot = cnt['إشارة إيجابية'] + cnt['إشارة محايدة'] + cnt['إشارة سلبية'];

  // القرار العام = نص النتيجة النهائية
  const final = Number(ax.final != null ? ax.final : 0);
  const vTxt  = final >= CFG.th.buy ? '🟢 سوق تجميع' : final >= CFG.th.hold ? '🔵 سوق محايد' : final >= CFG.th.market ? '🟡 حذر' : '🔴 تجنّب';
  const vCol  = vcColor(final);

  // الدائرة
  const C = 2 * Math.PI * 30, off = C * (1 - Math.max(0, Math.min(100, final)) / 100);
  const ring =
  '<div class="vc-ring"><svg width="74" height="74" viewBox="0 0 74 74">' +
  '<circle cx="37" cy="37" r="30" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7"/>' +
  '<circle cx="37" cy="37" r="30" fill="none" stroke="' + vCol + '" stroke-width="7" ' +
  'stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
  '</svg><div class="vc-pct" style="color:' + vCol + '">' + (isFinite(final) ? final.toFixed(0) : '—') + '</div></div>';

  // التوزيع
  let dist = '';
  if (tot > 0) {
  dist = '<div class="vc-dist">' +
  '<i style="width:' + (cnt['إشارة إيجابية']/tot*100) + '%;background:#16c79a"></i>' +
  '<i style="width:' + (cnt['إشارة محايدة']/tot*100) + '%;background:#4dabf7"></i>' +
  '<i style="width:' + (cnt['إشارة سلبية']/tot*100) + '%;background:#ff5252"></i>' +
  '</div><div class="vc-legend">' +
  '<span>🟢 تجميع <b style="color:#16c79a">' + cnt['إشارة إيجابية'] + '</b></span>' +
  '<span>🔵 احتفظ <b style="color:#4dabf7">' + cnt['إشارة محايدة'] + '</b></span>' +
  '<span>🔴 بيع <b style="color:#ff8a80">' + cnt['إشارة سلبية'] + '</b></span>' +
  '<span>· الإجمالي <b>' + tot + '</b></span>' +
  '</div>';
  }

  // المحاور الثمانية
  const axes = '<div class="vc-axes">' + VC_AXES.map(p => {
  const v = Number(ax[p[1]] != null ? ax[p[1]] : NaN);
  const ok = !isNaN(v);
  const col = vcColor(ok ? v : 0);
  return '<div class="vc-ax">' +
  '<div class="vc-ax-n">' + p[0] + '</div>' +
  '<div class="vc-ax-t"><div class="vc-ax-f" style="width:' + (ok ? Math.max(0,Math.min(100,v)) : 0) + '%;background:' + col + '"></div></div>' +
  '<div class="vc-ax-v" style="color:' + col + '">' + (ok ? v.toFixed(0) : '—') + '</div>' +
  '</div>';
  }).join('') + '</div>';

  // أعلى 5 فرص
  const picks = (results || []).slice(0, 5).map(s => {
  const m = VC_DEC[s.decision] || { c:'#d4af37', bg:'rgba(212,175,55,.16)' };
  return '<div class="vc-pick" onclick="analyzeStock(\'' + s.code + '\')">' +
  '<div class="vc-p-code">' + s.code + '</div>' +
  '<div class="vc-p-name">' + (s.name || '') + '</div>' +
  '<div class="vc-p-dec" style="color:' + m.c + ';background:' + m.bg + '">' + (s.decision || '—') + '</div>' +
  '<div class="vc-p-sc" style="color:' + vcColor(octaScore(s.code, s.final_score) || 0) + '">' + (Number(octaScore(s.code, s.final_score) || 0).toFixed(0)) + '</div>' +
  '</div>';
  }).join('');

  const fresh = h.data_age_minutes != null
  ? 'آخر تحديث من ' + (Number(h.data_age_minutes) < 60 ? Number(h.data_age_minutes).toFixed(0) + ' دقيقة' : (Number(h.data_age_minutes)/60).toFixed(1) + ' ساعة')
  : '';

  return uniCard('verdictCard', '🐙', 'قرار OCTA', 'القرار الحي للسوق — بيتحسب من المحرك',
  '<div class="vc-top">' + ring +
  '<div class="vc-meta">' +
  '<div class="vc-verdict" style="color:' + vCol + '">' + vTxt + '</div>' +
  '<div class="vc-sub">متوسط النتيجة على ' + (tot || '—') + ' سهم · ثقة البيانات ' +
  (h.avg_data_confidence != null ? Number(h.avg_data_confidence).toFixed(0) + '%' : '—') + '</div>' +
  (fresh ? '<div class="vc-sub">' + fresh + ' · ' + (h.freshness || '') + '</div>' : '') +
  '</div>' +
  '</div>' +
  dist + axes +
  (picks ? '<div style="margin-top:16px;font-size:.75rem;font-weight:800;color:var(--gold);">🎯 أعلى 5 فرص</div>' + picks : '') +
  '<div style="margin-top:12px;font-size:.68rem;color:var(--muted);line-height:1.6;">⚠️ تحليل وتعلّم فقط — مش نصيحة استثمارية.</div>',
  true
  );
}

async function armMarket(box) {  const [d, tk, rank] = await Promise.all([
  apiGet('/api/dashboard', 12000).catch(() => ({decisions:{},sectors:[],top10:[],bottom10:[],health:{},axis_average:{}})),
  apiGet('/api/ticker', 10000).catch(() => ({ticker:[]})),
  apiGet('/api/rank?limit=252', 20000).catch(() => ({results:[]})),
  ]);
  const gold = (() => {
  try {
  const m = {}; for (const t of (tk.ticker||[])) m[t.id] = t;
  const g = m['tk-gold'], u = m['tk-usd'];
  if (g && u && g.value && u.value) return {
  gram_egp: (g.value*u.value)/31.1035, ounce_egp_change: ((g.change||0)+(u.change||0))/2 };
  } catch(e){}
  return null;
  })();

  box.innerHTML =
  /* ═══ الترتيب الجديد ═══ */

  // ① 🇪🇬 مؤشرات السوق المصري
  buildEgyCard(tk.ticker, gold) +

  // ② 🐂 مؤشر السوق العام
  renderBullBear(d, tk.ticker || []) +

  // ③ 🌍 الأصول العالمية
  buildGlobalCard(tk.ticker) +

  // ④ 📊 أعلى ١٠ صعوداً وهبوطاً
  buildMoversCard() +

  // ⑤ 🗺️ خريطة القطاعات
  buildSectorCard(rank.results) +

  // ⑥ 🌍 الأسواق العالمية
  uniCard('mktCard', '🌎', 'الأسواق العالمية', 'أسهم ومؤشرات أمريكا — اضغط للفتح',
  '<button onclick="openMarkets()" style="width:<span class="flt-ltr">100%</span>;padding:14px;background:linear-gradient(135deg,rgba(56,189,248,.14),rgba(255,255,255,.02));' +
  'border:1px solid rgba(56,189,248,.35);border-radius:13px;color:var(--txt);font-family:inherit;' +
  'font-size:.9rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px">' +
  '🌍 افتح لوحة الأسواق العالمية</button>') +

  // ⑦ 🧰 كارت الأدوات الكبير
  buildToolsCard() +

  // ⑧ 🎓 الأكاديمية (مميزة)
  buildAcademyCard() +

  // ⑨ 🐙 قرار OCTA — القرار الحي للسوق ككل
  buildOctaVerdictCard(d, rank.results) +

  // ⑩ ⚖️ التنبيه التعليمي — متشيلش (نسخة وحدة في شاشة الذراع)
  '';

  // الشريط المتحرك + الفترات
  initMarketTicker(gold);
  loadPeriodData('change');
}




/* ══════ التيكر بالعرض — 6 كروت ══════ */
async function initMarketTicker(goldData) {
  const el = document.getElementById('tickerRow');
  if (!el || el.dataset.loaded) return;
  el.dataset.loaded = '1';

  el.innerHTML = '<div class="ticker-row-scroll">' +
  TICKER_WANT.map(t => `<div class="tk-mini" style="--tc:${t.c}">
  <div class="tkm-n">${t.n}</div>
  <div class="tkm-v" id="tkm-${t.id}">—</div>
  <div class="tkm-c" id="tkmc-${t.id}">—</div>
  </div>`).join('') + '</div>';

  try {
  const d = await octaFetch(OCTA_API + '/api/ticker').then(r => r.json());
  const map = {}; const seen = new Set();
  for (const t of (d.ticker || [])) { if (!seen.has(t.id)) { seen.add(t.id); map[t.id] = t; } }

  for (const w of TICKER_WANT) {
  const v = document.getElementById('tkm-' + w.id);
  const c = document.getElementById('tkmc-' + w.id);
  if (!v) continue;

  // الذهب: نعرض سعر الجرام (مش الأونصة)
  if (w.gold) {
  const g = goldData;
  if (g && g.gram_egp) {
  v.textContent = g.gram_egp.toLocaleString('en-US',{maximumFractionDigits:0}) + ' ج';
  const chg = Number(g.ounce_egp_change || 0);
  c.textContent = (chg>=0?'▲ +':'▼ ') + chg.toFixed(2) + '%';
  c.style.color = chg>=0 ? '#22c55e' : '#ef4444';
  }
  continue;
  }

  const t = map[w.id];
  if (t) {
  v.textContent = Number(t.value||0).toLocaleString('en-US',{maximumFractionDigits:2});
  const chg = Number(t.change||0);
  c.textContent = (chg>=0?'▲ +':'▼ ') + chg.toFixed(2) + '%';
  c.style.color = chg>=0 ? '#22c55e' : '#ef4444';
  }
  }
  } catch (e) {}
}

/* ══════ خريطة الأصول (الذهب/الدولار/النفط/المؤشرات) ══════ */
function heatColor(chg) {
  const c = Number(chg || 0);
  if (c > 2)  return 'background:linear-gradient(135deg,#059669,#10b981)';
  if (c > 0.5)return 'background:linear-gradient(135deg,#047857,#34d399)';
  if (c > 0)  return 'background:linear-gradient(135deg,#0d9488,#5eead4)';
  if (c > -0.5)return 'background:linear-gradient(135deg,#475569,#94a3b8)';
  if (c > -2) return 'background:linear-gradient(135deg,#b45309,#f59e0b)';
  return 'background:linear-gradient(135deg,#b91c1c,#ef4444)';
}

function buildAssetHeatmap(ticker) {
  const seen = new Set();
  const items = ticker.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
  if (!items.length) return '<div class="ss-empty">لا توجد بيانات أصول</div>';
  return `<div class="heat-grid" style="grid-template-columns:repeat(auto-fill,minmax(155px,1fr))">
  ${items.map(t => {
  const m = ASSET_META[t.id] || { n:t.label, g:'—' };
  return `<div class="heat-cell" style="${heatColor(t.change)}">
  <div class="hc-s">${m.g}</div>
  <div class="hc-n">${m.n}</div>
  <div>
  <div class="hc-v">${Number(t.value||0).toLocaleString('en-US',{maximumFractionDigits:2})}</div>
  <div class="hc-c">${(t.change||0)>=0?'▲ +':'▼ '}${Number(t.change||0).toFixed(2)}%</div>
  </div>
  </div>`;
  }).join('')}
  </div>
  <div class="heat-scale">
  <span>هبوط حاد</span>
  <div class="heat-scale-bar">
  <i style="background:#b91c1c"></i><i style="background:#f59e0b"></i>
  <i style="background:#475569"></i><i style="background:#0d9488"></i>
  <i style="background:#10b981"></i>
  </div>
  <span>صعود قوي</span>
  </div>`;
}

/* ══════ مقالة: إزاي الأصول بتأثر على بعض ══════ */
function buildAssetArticle(ticker) {
  const map = {}; const seen = new Set();
  for (const t of ticker) { if (!seen.has(t.id)) { seen.add(t.id); map[t.id] = t; } }
  const chg = id => Number((map[id]||{}).change || 0);
  const val = id => Number((map[id]||{}).value || 0);

  // نحسب العلاقات
  const gold = chg('tk-gold'), usd = chg('tk-usd'), oil = chg('tk-oil');
  const egx30 = chg('tk-egx'), spx = chg('tk-spx');

  const risk = (gold < -0.3 && egx30 < -0.3) ? 'off' :
  (gold > 0.3 && egx30 > 0.3) ? 'on' : 'mixed';

  let html = `<div class="read-box">
  <div class="read-h">📖 إيه اللي بيحصل دلوقتي في الأسواق؟</div>
  <div class="read-p">
  <p style="margin-bottom:10px"><b>الذهب</b> ${gold>=0?'<b style="color:var(--sec)">صاعد '+gold.toFixed(2)+'%</b>':'<b style="color:var(--red2)">هابط '+gold.toFixed(2)+'%</b>'}
  و<b>الدولار مقابل الجنيه</b> ${usd>=0?'<b style="color:var(--sec)">قوي</b>':'<b style="color:var(--red2)">ضعيف</b>'}.
  ده بيقول إيه؟ لما الدولار بيزيد، الفلوس بتخرج من مصر — وده بيضغط على البورصة المحلية.
  لما الذهب بيزيد، معناها إن الناس بيدوروا على ملجأ آمن.</p>

  <p style="margin-bottom:10px"><b>البورصة المصرية</b> (EGX30) ${egx30>=0?'<b style="color:var(--sec)">صاعدة</b>':'<b style="color:var(--red2)">هابطة</b>'}
  و<b>السوق الأمريكي</b> (S&P 500) ${spx>=0?'<b style="color:var(--sec)">صاعد</b>':'<b style="color:var(--red2)">هابط</b>'}.
  السوق المصري بيتأثر بـ 3 حاجات أساسية: سعر الدولار، سعر البترول، وحالة الاقتصاد الداخلي.</p>
  </div>`;

  // العلاقات المقاسة
  const rels = [];
  rels.push({ a:'الدولار', b:'الذهب', v: gold*usd > 0 ? 'same' : 'inv',
  why: gold*usd > 0
  ? 'الدولار والذهب بيتحركوا بنفس الاتجاه — ده بيحصل في عدم اليقين'
  : 'الذهب والدولار عكس بعض — ده نمط طبيعي في الأزمات' });
  rels.push({ a:'البترول', b:'البورصة', v: oil*egx30 > 0 ? 'same' : 'inv',
  why: 'مصر مستوردة للبترول — سعر النفط بيأثر على الميزانية' });
  rels.push({ a:'الذهب', b:'البورصة', v: risk === 'off' ? 'same' : (risk === 'on' ? 'same' : 'neu'),
  why: risk === 'off' ? 'الذهب طالع والسوق هابط == حالة خوف من السوق' :
  risk === 'on' ? 'الذهب والسوق طالعين = شهية مخاطرة عالية' :
  'الذهب والسوق مختلطين — مفيش اتجاه واضح' });
  rels.push({ a:'أمريكا', b:'مصر', v: spx*egx30 > 0 ? 'same' : 'inv',
  why: 'الأسواق العالمية بتأثر على مصر — مفيش استثناء' });

  html += `<div style="margin-top:12px">
  <div class="read-h" style="font-size:.9rem">🔗 العلاقات المهمة دلوقتي</div>
  ${rels.map(r => `<div class="read-rel ${r.v==='same'?'up':(r.v==='inv'?'down':'')}">
  <span class="rr-a">${r.a} ↔ ${r.b}</span>
  <span class="rr-t">${r.why}</span>
  </div>`).join('')}
  </div>

  <div class="read-p" style="margin-top:12px;font-size:.82rem;color:var(--muted)">
  ⚠️ ملاحظة: دي قراءة مبنية على الأرقام الحالية. العلاقة في الأصول ممكن تتغير —
  فا تفتكرش إنها قاعدة دايمة. تابع الأرقام قبل ما تاخد قرار.
  </div></div>`;

  return html;
}

/* ══════ خريطة القطاعات (حرارية) ══════ */
function buildSectorHeatmap(stocks, sectorList) {
  if (!stocks.length) return '<div class="ss-empty">لا توجد بيانات</div>';
  // نحسب متوسط كل قطاع
  const bySec = {};
  for (const s of stocks) {
  const sec = s.sector || 'أخرى';
  if (!bySec[sec]) bySec[sec] = { n:0, sum:0, cnt:0 };
  bySec[sec].n++;
  if (Number.isFinite(s.change)) { bySec[sec].sum += s.change; bySec[sec].cnt++; }
  }
  const items = Object.entries(bySec)
  .map(([k,v]) => ({ name:k, count:v.n, avg: v.cnt ? v.sum/v.cnt : 0 }))
  .sort((a,b) => b.avg - a.avg);

  return `<div class="heat-grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">
  ${items.map(s => `<div class="heat-cell" style="${heatColor(s.avg)}">
  <div class="hc-n">${s.name}</div>
  <div>
  <div class="hc-v">${s.avg>=0?'+':''}${s.avg.toFixed(2)}%</div>
  <div class="hc-c">${s.count} سهم</div>
  </div>
  </div>`).join('')}
  </div>
  <div class="heat-scale">
  <span>قطاع هابط</span>
  <div class="heat-scale-bar">
  <i style="background:#b91c1c"></i><i style="background:#f59e0b"></i>
  <i style="background:#475569"></i><i style="background:#0d9488"></i>
  <i style="background:#10b981"></i>
  </div>
  <span>قطاع صاعد</span>
  </div>`;
}

/* ══════ ② الفني — كروت ══════ */
async function armTechnical(box) {
  const [rank, screen] = await Promise.all([
  octaFetch(OCTA_API + '/api/rank?limit=20&decision=تجميع').then(r=>r.json()).catch(()=>({results:[]})),
  octaFetch(OCTA_API + '/api/rank?limit=20&min_safety=65').then(r=>r.json()).catch(()=>({results:[]})),
  ]);
  const setups = (rank.results||[]);
  const stable = (screen.results||[]);

  box.innerHTML =
  '<div class="ic-grid" style="--ac:#22c55e">' +
  ic('🎯', 'تركيب فني إيجابي', 'أسهم قرارها "إشارة إيجابية" من التحليل الفني',
  `<span>${setups.length} سهم</span>`,
  icRows(setups)) +

  ic('🛡️', 'أمان عالي', 'أسهم أمانها ٦٥+ — حركة مستقرة',
  `<span>${stable.length} سهم</span>`,
  icRows(stable)) +

  ic('📊', 'أعلى نتيجة فنية', 'الأقوى فنياً من كل الخيارات',
  `<span>${setups.length} مرشح</span>`,
  icRows(setups.slice(0,15))) +

  ic('⚠️', 'أضعف فنياً', 'أسهم بنتيجة سلبية — احذر',
  `<span>${setups.length}</span>`,
  icRows((await octaFetch(OCTA_API + '/api/rank?limit=20&decision=بيع').then(r=>r.json()).catch(()=>({results:[]}))).results || [])) +
  '</div>';
}

/* ══════ ③ الأساسي — كروت ══════ */
async function armFundamental(box) {
  const d = await octaFetch(OCTA_API + '/api/rank?limit=50&max_pe=50').then(r=>r.json());
  const all = (d.results||[]);
  const cheap = all.filter(s => s.pe && s.pe>0).sort((a,b)=>a.pe-b.pe);
  const withDiv = all.filter(s => s.div_yield>0).sort((a,b)=>b.div_yield-a.div_yield);
  const undervalued = all.filter(s => (s.upside||0) > 20).sort((a,b)=>b.upside-a.upside);

  box.innerHTML =
  '<div class="ic-grid" style="--ac:#d4af37">' +
  ic('💰', 'الأرخص', 'أقل ٢٠ حسب مضاعف الربحية',
  `<span>${cheap.length} رخيص</span>`,
  icRows(cheap)) +

  ic('📈', 'مستحق أعلى من قيمته', 'الفرصة > ٢٠٪ حسب قيمة عادلة',
  `<span>${undervalued.length} فرصة</span>`,
  icRows(undervalued)) +

  ic('💵', 'أعلى توزيعات', 'أسهم بتدفع عائد شهري/سنوي',
  `<span>${withDiv.length} سهم</span>`,
  icRows(withDiv)) +

  ic('🏆', 'أقوى أساسياً', 'أعلى نتيجة في التحليل الأساسي',
  `<span>${all.length}</span>`,
  icRows(all.slice(0,15))) +
  '</div>';
}

/* ══════ ④ السيولة — كروت ══════ */
async function armLiquidity(box) {
  const [liq, weak] = await Promise.all([
  octaFetch(OCTA_API + '/api/rank?limit=25&min_liquidity=55').then(r=>r.json()).catch(()=>({results:[]})),
  octaFetch(OCTA_API + '/api/rank?limit=20&decision=بيع').then(r=>r.json()).catch(()=>({results:[]})),
  ]);
  const top = (liq.results||[]);
  const thin = (weak.results||[]).filter(s => (s.liquidity||0) < 45);
  const sec = await octaFetch(OCTA_API + '/api/sector-stats').then(r=>r.json()).catch(()=>({}));
  const secList = Object.entries(sec).slice(0,12);

  box.innerHTML =
  '<div class="ic-grid" style="--ac:#06b6d4">' +
  ic('💧', 'أعلى ٢٥ سيولة', 'أسهم تقدر تشتريها وتبيعها بسرعة',
  `<span>${top.length} سهم</span>`, icRows(top)) +
  ic('⚡', 'سيولة ضعيفة', 'حذر — صعب تبيع بسرعة',
  `<span>${thin.length} سهم</span>`, icRows(thin)) +
  ic('🗺️', 'السيولة حسب القطاع', 'فين السيولة أكتر؟',
  `<span>${secList.length} قطاع</span>`,
  '<div class="ic-rows">' + secList.map(([k,v]) =>
  `<div class="ic-row"><span class="r-c">${k}</span>` +
  `<span class="r-n">${v.count||0} سهم • P/E ${v.median_pe||'—'}</span></div>`).join('') + '</div>') +
  ic('📊', 'خريطة التدفق', 'أين الفلوس بتتحرك',
  `<span>كل القطاعات</span>`,
  '<div class="ic-rows">' + secList.slice(0,8).map(([k,v]) =>
  `<div class="ic-row"><span class="r-c">${k}</span>` +
  `<span class="r-n">حجم التداول</span><span class="r-s">${v.count||0}</span></div>`).join('') + '</div>') +
  '</div>';
}

/* ══════ ⑤ الأخبار — أحداث مؤثرة ══════ */
async function armNews(box) {
  const d = await octaFetch(OCTA_API + '/api/dividends').then(r => r.json());
  const events = (d.actions || d.events || []).slice(0, 20);

  box.innerHTML =
  '<div class="arm-sect"><div class="arm-sect-h">📰 أحدث الأحداث المعلنة <small>إعلانات رسمية من البورصة</small></div>' +
  (function(){
  if (!events.length) return '<div class="opps-loading">لا توجد أحداث معلنة</div>';
  let h = '<table class="mini-table"><thead><tr><th>التاريخ</th><th>الشركة</th><th>الرمز</th><th>النوع</th><th>القيمة</th></tr></thead><tbody>';
  for (const e of events.slice(0,15)) {
  h += `<tr><td>${e.date||e.distributionDate||'—'}</td><td>${(e.nameAr||e.company||'—').slice(0,20)}</td><td><b>${e.code||'—'}</b></td><td>${e.kindAr||e.kind||'—'}</td><td>${e.value||'—'}</td></tr>`;
  }
  return h + '</tbody></table>';
  })() +
  '</div>';
}

/* ══════ ⑥ المخاطر — أسوأ + ضغط ══════ */
async function armRisk(box) {
  const [d, st, cal] = await Promise.all([
  octaFetch(OCTA_API + '/api/dashboard').then(r=>r.json()),
  octaFetch(OCTA_API + '/api/stress?scenario=all').then(r=>r.json()),
  octaFetch(OCTA_API + '/api/calibration').then(r=>r.json()),
  ]);

  const worst = (d.bottom10 || []).slice().reverse().slice(0,10);
  const c = cal.calibration || {};

  box.innerHTML =
  '<div class="arm-sect"><div class="arm-sect-h">🔴 أسوأ ١٠ أسهم حسب الأمان <small>الأقل أماناً</small></div>' +
  stockTable(worst, [
  {h:'الرمز', f:s=>`<b>${s.code}</b>`},
  {h:'الاسم', f:s=>(s.name||'').slice(0,16)},
  {h:'الأمان', f:s=>`<span style="color:var(--red2);font-weight:800">${s.safety||0}</span>`},
  {h:'المخاطرة', f:s=>s.risk_level||'—'},
  {h:'النتيجة', f:s=>s.score},
  ]) +
  '</div>' +

  '<div class="arm-sect"><div class="arm-sect-h">🛡️ سلوك النظام تحت الضغط</div>' +
  '<div class="stress-grid">' +
  Object.entries(st.all||{}).map(([k,v]) => {
  const cls = /صامد/.test(v.verdict) ? 'ok' : (/Weak/.test(v.verdict) ? 'weak' : 'bad');
  return `<div class="stress-card ${cls}"><div class="sc-n">${v.name}</div><div class="sc-a">${v.avg_after}</div><div class="sc-r">بعد الصدمة</div></div>`;
  }).join('') +
  '</div></div>' +

  '<div class="arm-sect"><div class="arm-sect-h">⚙️ سجل المعايرة <small>${c.version||""}</small></div>' +
  '<div style="font-size:.82rem;color:var(--muted);line-height:1.9">' +
  'آخر معايرة: <b style="color:var(--ac)">' + (c.last_calibrated||'—') + '</b><br>' +
  'التعديلات: <b style="color:var(--ac)">' + ((c.history||[]).length) + '</b>' +
  '</div></div>';
}

/* ══════ ⑦ المحفظة — كروت ══════ */
async function armPortfolio(box) {
  /* ⛔⛔ /api/portfolio بقى 401 لزائر مجهول. الأذرع ديوراء البوابة
  (لازم تدوس على الذراع)، بس ⛌ نحوطّن كمان على localhost
  (لأن البوابة مش بتتتحط خالص هناك)
  فبنعمل نفس التخطي بدل ما نخلي 401 يمسح التوكن
  ويطلّع رسالة «انتهت جلستك» على مستخدم مش داخل أصلاً. */
  if (!octaHasToken()) {
  box.innerHTML = '<div class="opps-loading">سجّل دخولك عشان تشوف محفظتك</div>';
  return;
  }
  const [pf, d] = await Promise.all([
  octaFetch(OCTA_API + '/api/portfolio').then(r=>r.json()).catch(()=>({})),
  octaFetch(OCTA_API + '/api/rank?limit=20').then(r=>r.json()).catch(()=>({results:[]})),
  ]);
  const rows = (d.results||[]);
  const hold = pf.holdings || {};

  box.innerHTML =
  '<div class="ic-grid" style="--ac:#8b5cf6">' +
  ic('💼', 'محفظتي', 'أسهمك وتوزيعك الحالي',
  `<span>${pf.count||0} سهم</span><span>${(pf.total_value||0).toLocaleString('en-US',{maximumFractionDigits:0})} ج.م</span>`,
  Object.keys(hold).length ?
  '<div class="ic-rows">' + Object.entries(hold).map(([c,h]) =>
  `<div class="ic-row" onclick="event.stopPropagation(); openStock('${c}')">` +
  `<span class="r-c">${c}</span><span class="r-n">${h.shares} سهم @ ${h.cost}</span>` +
  `<span class="r-s">${((h.shares*h.price)||0).toLocaleString('en-US',{maximumFractionDigits:0})}</span></div>`).join('') + '</div>'
  : '<div class="ss-empty">محفظتك فاضية — أضف أسهم</div>') +

  ic('🥧', 'توزيع القطاعات', 'كام في كل قطاع؟',
  `<span>${Object.keys(pf.sector_exposure_pct||{}).length} قطاع</span>`,
  Object.keys(pf.sector_exposure_pct||{}).length ?
  '<div class="ic-rows">' + Object.entries(pf.sector_exposure_pct).map(([k,v]) =>
  `<div class="ic-row"><span class="r-c">${k}</span><span class="r-n">نسبة</span>` +
  `<span class="r-s">${v}%</span></div>`).join('') + '</div>'
  : '<div class="ss-empty">لا يوجد توزيع</div>') +

  ic('⚖️', 'التنويع', 'هل محفظتك متوازنة؟',
  `<span>${pf.diversification||'—'}</span>`,
  '<div class="ic-rows">' +
  `<div class="ic-row"><span class="r-c">عدد الأسهم</span><span class="r-n">الحد الأدنى 5</span><span class="r-s">${pf.count||0}</span></div>` +
  `<div class="ic-row"><span class="r-c">عدد القطاعات</span><span class="r-n">الحد الأدنى 3</span><span class="r-s">${Object.keys(pf.sector_exposure_pct||{}).length}</span></div>` +
  `<div class="ic-row"><span class="r-c">القيمة</span><span class="r-n">إجمالي</span><span class="r-s">${(pf.total_value||0).toLocaleString('en-US',{maximumFractionDigits:0})}</span></div>` +
  '</div>') +

  ic('🎯', 'يناسب محفظتك', 'أسهم تحسّن تنويعك',
  `<span>${rows.length} مرشح</span>`, icRows(rows.slice(0,15))) +

  ic('🎓', 'تعلّم', 'مستثمرون عظام وقواعدهم',
  `<span>بافيت • جراهام • لينش</span>`,
  '<div class="ic-rows">' +
  `<div class="ic-row" onclick="event.stopPropagation(); openInvestorModal('buffett')"><span class="r-c">بافيت</span><span class="r-n">القيمة</span></div>` +
  `<div class="ic-row" onclick="event.stopPropagation(); openInvestorModal('graham')"><span class="r-c">جراهام</span><span class="r-n">الأمان</span></div>` +
  `<div class="ic-row" onclick="event.stopPropagation(); openInvestorModal('lynch')"><span class="r-c">لينش</span><span class="r-n">النمو</span></div>` +
  '</div>') +
  '</div>';
}

/* ══════ ⑧ الفرص — أعمل إيه ══════ */
async function armOpportunity(box) {
  /* ⛔ نفس كلام armPortfolio — /api/ranking محمي دلوقتي */
  if (!octaHasToken()) {
  box.innerHTML = '<div class="opps-loading">سجّل دخولك عشان تشوف الفرص</div>';
  return;
  }
  const [opp, strat] = await Promise.all([
  octaFetch(OCTA_API + '/api/opportunities').then(r=>r.json()),
  octaFetch(OCTA_API + '/api/strategies').then(r=>r.json()),
  ]);
  const early = (opp.early_opportunities || []);
  const rank = await octaFetch(OCTA_API + '/api/ranking').then(r=>r.json());

  box.innerHTML =
  '<div class="arm-sect"><div class="arm-sect-h">🔎 فرص مبكرة — قبل ما تتحرك</div>' +
  (early.length ?
  '<div class="opp-grid">' + early.slice(0,8).map(s =>
  `<div class="opp-card" onclick="openStockModal('${s.code}')">
  <span class="opp-early-tag">${s.stage||'مبكرة'}</span>
  <div class="opp-code-2">${s.code}</div>
  <div class="opp-name-2">${(s.name||'').slice(0,16)}</div>
  <div class="opp-score-2">${(s.opportunity||0).toFixed(0)}<small>/100</small></div>
  </div>`).join('') + '</div>'
  : '<div class="opps-loading">لا توجد فرص مبكرة — راقب الأخبار الرسمية</div>') +
  '</div>' +

  '<div class="arm-sect"><div class="arm-sect-h">🏆 أفضل الفرص الآن</div>' +
  stockTable((rank.top20||[]).slice(0,12), [
  {h:'الرمز', f:s=>`<b>${s.code}</b>`},
  {h:'الاسم', f:s=>(s.name||'').slice(0,16)},
  {h:'النتيجة', f:s=>`<b style="color:var(--ac)">${s.score}</b>`},
  {h:'القرار', f:s=>s.decision},
  {h:'الفرصة', f:s=>s.upside!=null?(s.upside>0?'+':'')+s.upside.toFixed(0)+'%':'—'},
  ]) +
  '</div>' +

  '<div class="arm-sect"><div class="arm-sect-h">🎯 استراتيجيات الاستثمار</div>' +
  '<div class="strat-tabs">' + (strat.strategies||[]).map(s =>
  `<button class="strat-tab">${s.name}</button>`).join('') + '</div>' +
  '<div style="font-size:.8rem;color:var(--muted);margin-top:8px">افتح أي سهم واستخدم أزرار الاستراتيجيات لتغيير طريقة التقييم</div>' +
  '</div>';
}

/* ══════════ الوضع الليلي/النهاري ══════════ */
function toggleTheme() {
  const btn = document.getElementById('themeBtn');
  if (document.body.classList.toggle('light')) {
  btn.textContent = '☀️';
  btn.title = 'الوضع النهاري';
  try { localStorage.setItem('octa_theme', 'light'); } catch(e){}
  } else {
  btn.textContent = '🌙';
  btn.title = 'الوضع الليلي';
  try { localStorage.setItem('octa_theme', 'dark'); } catch(e){}
  }
}
function loadTheme() {
  try {
  if (localStorage.getItem('octa_theme') === 'light') {
  document.body.classList.add('light');
  const b = document.getElementById('themeBtn');
  if (b) { b.textContent = '☀️'; b.title = 'الوضع النهاري'; }
  }
  } catch(e){}
}

/* ══════════ التنبيه التعليمي ══════════ */

/* ══════════ الساعة ══════════ */
function startOctaClock() {
  const el = document.getElementById('octaClock');
  if (!el) return;
  function tick() {
  octaFetch(OCTA_API + '/').then(r => r.json()).then(d => {
  const lu = d.lastUpdate ? new Date(d.lastUpdate) : null;
  const age = lu ? Math.round((Date.now() - lu.getTime()) / 60000) : null;
  const txt = age === null ? '—' :
  age < 1 ? 'الآن' : age < 60 ? age + ' دقيقة' : Math.round(age/60) + ' ساعة';
  el.innerHTML = '<b>' + txt + '</b>' + (d.market_phase === 'open' ? 'السوق مفتوح' : 'السوق مغلق');
  }).catch(() => { el.innerHTML = '<b>—</b>غير متصل'; });
  }
  tick();
  setInterval(tick, 10000);  /* ⏱️ كل ١٠ ثواني بدل دقيقة */
}

// تشغيل
document.addEventListener('DOMContentLoaded', function () {
  loadTheme();
  startOctaClock();
  const b = document.getElementById('eduToggle');
  if (b) b.addEventListener('click', toggleEdu);
});

/* ════════════════════════════════════════════════════════════
  STOCK INTELLIGENCE — الصفحة الشاملة
  chart + محاور + تفسير + أخبار
  ════════════════════════════════════════════════════════════ */

const SI_AXES = {
  technical:  { n: 'التحليل الفني',  i: '📈' },
  fundamental: { n: 'التحليل الأساسي', i: '💰' },
  liquidity:  { n: 'السيولة',  i: '💧' },
  news:  { n: 'الأخبار',  i: '📰' },
  sentiment:  { n: 'المعنويات',  i: '🧠' },
  risk:  { n: 'أمان المخاطرة',  i: '⚠️' },
  portfolio:  { n: 'ملاءمة المحفظة', i: '💼' }
};

let SI_CODE = null;
let SI_DATA = null;

async function openStock(code) {
  code = String(code || '').toUpperCase().trim();
  if (!code) return;
  SI_CODE = code;

  // نعرض الصفحة
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('armView')?.style.setProperty('display','none','important');
  document.getElementById('intelPage')?.style.setProperty('display','none','important');
  document.getElementById('dashPage')?.style.setProperty('display','none','important');
  const sp = document.getElementById('stockPage');
  sp.style.removeProperty('display');
  sp.style.setProperty('display', 'block', 'important');
  sp.classList.add('active');
  document.getElementById('siLoad').style.display = 'block';
  document.getElementById('siContent').style.display = 'none';
  window.scrollTo({top: 0, behavior: 'smooth'});

  try {
  // نجمع كل البيانات بالتوازي
  const get = (path) => octaFetch(OCTA_API + path)
  .then(r => { if (!r.ok) throw new Error(path + ' → HTTP ' + r.status); return r.json(); })
  .catch(e => { console.error('❌ fetch failed', path, e.message); return null; });

  const [intel, explain, news, price] = await Promise.all([
  get('/api/intelligence/' + code),
  get('/api/explain/' + code),
  get('/api/dividends').then(d => d || {actions:[]}),
  get('/api/technical/' + code),
  ]);

  if (!intel) throw new Error('فشل تحميل /api/intelligence/' + code);

  SI_DATA = { intel, explain, news, price };

  const sc = document.getElementById('siContent');
  const sl = document.getElementById('siLoad');

  try {
  renderStockPage();
  } catch (e) {
  console.error('renderStockPage crashed:', e);
  // ═══ fallback بسيط ومضمون ═══
  const ax = intel.axes || {};
  const f = intel.fundamental || {};
  sc.innerHTML =
  '<div style="background:var(--wash);border:1px solid var(--line);' +
  'border-radius:16px;padding:20px;margin-bottom:16px">' +
  '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
  '<div><div style="font-size:1.5rem;font-weight:900;color:var(--gold)">' + code + '</div>' +
  '<div style="color:var(--muted);font-size:.86rem">' + (intel.name||'') + '</div></div>' +
  '<div style="text-align:left"><div style="font-size:1.8rem;font-weight:900">' +
  (intel.price||0).toFixed(2) + '</div>' +
  '<div style="color:' + ((intel.change||0)>=0?'var(--sec)':'var(--red2)') + ';font-weight:800">' +
  ((intel.change||0)>=0?'+':'') + (intel.change||0).toFixed(2) + '%</div></div>' +
  '</div></div>' +
  '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">' +
  '<div style="background:rgba(212,175,55,.1);border:1px solid rgba(212,175,55,.3);border-radius:12px;padding:14px 8px;text-align:center;min-width:0">' +
  '<div style="font-size:1.45rem;font-weight:900;color:var(--gold);white-space:nowrap">' + (octaScore(code, intel.final_score) ?? 0) + '</div>' +
  '<div style="font-size:.7rem;color:var(--muted)">النتيجة</div></div>' +
  '<div style="background:rgba(22,199,154,.1);border:1px solid rgba(22,199,154,.3);border-radius:12px;padding:14px;text-align:center">' +
  '<div style="font-size:1.45rem;font-weight:900;color:var(--sec);white-space:nowrap">' + (intel.confidence??0) + '%</div>' +
  '<div style="font-size:.7rem;color:var(--muted)">الثقة</div></div>' +
  '<div style="background:var(--wash);border:1px solid var(--line);border-radius:12px;padding:14px;text-align:center">' +
  '<div style="font-size:.98rem;font-weight:900;line-height:1.35">' + ((typeof octaStockMeta==='function' && octaStockMeta(code).decision) || intel.decision || '—') + '</div>' +
  '<div style="font-size:.7rem;color:var(--muted)">القرار</div></div>' +
  (f.fair_value ? '<div style="background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.3);border-radius:12px;padding:14px;text-align:center">' +
  '<div style="font-size:1.3rem;font-weight:900;color:#a855f7">' + Number(f.fair_value).toFixed(2) + '</div>' +
  '<div style="font-size:.7rem;color:var(--muted)">القيمة العادلة</div></div>' : '') +
  '</div>' +
  '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px">' +
  Object.entries(ax).map(([k,v]) =>
  '<div style="background:var(--wash);border:1px solid var(--line);border-radius:11px;padding:12px;text-align:center">' +
  '<div style="font-size:1.15rem;font-weight:900;color:var(--gold);white-space:nowrap">' + (v==null?'—':Math.round(v)) + '</div>' +
  '<div style="font-size:.68rem;color:var(--muted)">' + ((typeof AR_MS!=='undefined' && AR_MS[k]) ? AR_MS[k] : k) + '</div></div>').join('') +
  '</div>' +
  (f.valuation_status ? '<div style="margin-top:14px;padding:12px;background:rgba(212,175,55,.08);' +
  'border:1px solid rgba(212,175,55,.25);border-radius:11px;font-size:.86rem">' +
  '<b style="color:var(--gold)">التقييم:</b> ' + f.valuation_status +
  (f.upside_pct != null ? ' · فرصة ' + (f.upside_pct>0?'+':'') + Number(f.upside_pct).toFixed(1) + '%' : '') +
  '</div>' : '');
  }

  sl.style.display = 'none';
  sc.style.display = 'block';
  console.log('✅ stock page rendered, length:', sc.innerHTML.length);
  } catch (e) {
  document.getElementById('siLoad').innerHTML =
  '<div style="color:var(--red2);padding:30px;text-align:center">' +
  '<div style="font-size:2rem">❌</div>' +
  '<div style="margin:12px 0;font-weight:700">خطأ في تحميل بيانات ' + code + '</div>' +
  '<div style="font-size:.78rem;color:var(--muted);direction:ltr">' + (e.message||'') + '</div>' +
  '<button onclick="closeStock()" style="margin-top:16px;padding:9px 22px;background:var(--gold);' +
  'color:#0a1929;border-radius:10px;font-weight:800;border:none">رجوع</button></div>';
  }
}

function closeStock() {
  const sp = document.getElementById('stockPage');
  sp.style.setProperty('display', 'none', 'important');
  sp.classList.remove('active');
  // لو جاي من بحث OCTA — نرجعلهالصفحة دي (ونفضل حافظين نص البحث)
  if (OS_ORIGIN) { const o = OS_ORIGIN; OS_ORIGIN = null; switchPage(o); return; }
  /* ⛔⛔ كان هنا `switchPage('home')`.
     ⛔ مفيش عنصر اسمه page-home في الـDOM أصلاً ⇒ مفيش صفحة بتتفعّل
     ⛔ وكمان بيكتب 'home' في الحفظ ⇒ الريفريش بعدها بيرجع فاضي.
     ⛔ ده كان سبب شكوى أحمد: «بيرجّعني للصفحة الرئيسية».
     ✅ رجّعنا لآخر صفحة حقيقية اتفتحت. */
  if (typeof OS_NAV !== 'undefined' && OS_NAV.back) { OS_NAV.back(); return; }
  switchPage('stocks');
}

/* ══════════ أخبار السهم الحيّة — مصادر مجانية بلا مفاتيح ══════════ */
const SI_NEWS_CACHE = {};

async function rssFetch(query){
  const feed = 'https://news.google.com/rss/search?q=' + query + '&hl=ar&gl=EG&ceid=EG:ar';
  const enc  = encodeURIComponent(feed);

  try {
  // ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ جسر الـCORS (نفس الأصل)
  // 📌 كان: https://api.cors.lol/?url=… ⇒ كان بيرجّع **429** (rate limit)
  // ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ والـworker بيجيب الـRSS من الـedge
  // ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ ويرجّع JSON على شكل rss2json.
  const r = await octaFetch('/api/rss?url=' + enc);
  if (r.ok) {
  const d = await r.json();
  if (d && d.items && d.items.length) return d.items.slice(0, 12).map(it => ({
  title: (it.title || '').replace(/\s+[-–]\s+[^-–]{2,30}$/, '').trim(),
  link : it.link || '', date : it.pubDate || ''
  }));
  }
  } catch(e){}

  try {
  // ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ جسر الـCORS
  // 📌 كان: https://api.rss2json.com/v1/api.json?rss_url=…
  // ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ المتصفح بيمنع الرد (مش فيه ACAO) ⇒ "blocked by CORS"
  // ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ الـworker بيجيبه من الـedge (نفس الأصل) ⇒ مفيش CORS.
  const r = await octaFetch('/api/rss?url=' + enc);
  if (r.ok) {
  const d = await r.json();
  if (d.items && d.items.length) return d.items.slice(0, 12).map(it => ({
  title: (it.title || '').replace(/\s+[-–]\s+[^-–]{2,30}$/, '').trim(),
  link : it.link || '', date : it.pubDate || ''
  }));
  }
  } catch(e){}
  return [];
}

function newsAgo(d){
  const t = Date.parse(d);
  if (isNaN(t)) return '';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 60 ? 'من ' + m + ' دقيقة'
  : m < 1440 ? 'من ' + Math.round(m/60) + ' ساعة'
  : 'من ' + Math.round(m/1440) + ' يوم';
}

function stripAr(t){ return String(t).replace(/[ً-ٰـ]/g,''); }

/* هل الخبر ده يخص السهم فعلاً؟ */
function newsBelongs(title, code, name){
  const t = stripAr(title).toLowerCase();
  if (name && t.includes(stripAr(name).toLowerCase())) return true;
  // الاسم الكامل نادراً بييجي كامل — نجرب أول 4 كلمات
  if (name) {
  const w = stripAr(name).trim().split(/\s+/).filter(x => x.length > 3);
  if (w.length >= 2 && w.slice(0,2).every(x => t.includes(x))) return true;
  }
  const c = String(code).toLowerCase();
  if (new RegExp('\\b' + c + '\\b', 'i').test(t)) return true;
  return false;
}

async function loadStockNews(code, name){
  const box = document.getElementById('siLiveNews');
  if (!box) return;
  const c = String(code || '').toUpperCase();
  if (SI_NEWS_CACHE[c]) { box.innerHTML = SI_NEWS_CACHE[c]; return; }

  const nm = stripAr(name || '').trim();
  // استعلامين: اسم الشركة (الأساسي) + الكود — من غير علامات تنصيص
  const qs = [];
  if (nm) qs.push(encodeURIComponent(nm));
  qs.push(encodeURIComponent('البورصة المصرية ' + c));

  const results = await Promise.all(qs.map(q => rssFetch(q).catch(() => [])));

  const seen = new Set();
  const mine = [], market = [];
  for (const list of results) {
  for (const n of list) {
  if (!n.title) continue;
  const key = n.title.slice(0, 55).toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  (newsBelongs(n.title, c, nm) ? mine : market).push(n);
  if (mine.length >= 8) break;
  }
  if (mine.length >= 8) break;
  }

  const row = n => '<a class="si-nws-item" href="' + n.link + '" target="_blank" rel="noopener noreferrer">' +
  '<div class="si-nws-t">' + n.title + '</div>' +
  '<div class="si-nws-m">' + (newsAgo(n.date) ? newsAgo(n.date) + ' · ' : '') + 'Google News</div></a>';

  let html = '';
  html += '<div class="si-nws-h">🔵 أخبار تخص ' + (nm || c) + ' مباشرة</div>';
  html += mine.length ? mine.map(row).join('')
  : '<div class="si-empty">مفيش خبر مباشر على السهم دلوقتي.<br>الأخبار العامة على السوق بالأسفل — وبتأثر على التقييم.</div>';

  if (market.length) {
  html += '<div class="si-nws-h" style="margin-top:16px">🌍 أخبار عامة على السوق (بتأثر على كل الأسهم)</div>';
  html += market.slice(0, 4).map(row).join('');
  }

  SI_NEWS_CACHE[c] = html;
  box.innerHTML = html;
}

/* ══════════════════════════════════════════════════════════════
  📊 عمق السوق + التنفيذات — Order Book & Trades Tape
  ──────────────────────────────────────────────────────────────
  * البيانات: EGX Live على RapidAPI (Level 2 — 40 مستوى)
  * التحديث: كل ثانية
  * تغذّي قرارات OCTA: ضغط شرائي / بيعي / سيولة
  ══════════════════════════════════════════════════════════════ */
const OB_CFG = {
  host : 'egx-live.p.rapidapi.com',
  /* ⛔⛔ المفتاح ما يتحطّش هنا أبداً — هيوصل لسيرفرنا عبر /api/obdepth
    (server-side) وإحنا هنعمل كاش + حاجز ميزانية. */
  key  : '',
  demo : false
};
let OB_TIMER = null, OB_SEQ = 0, OB_LAST = null, OB_TAB = 'depth';

async function obFetch(path){
  /* ⛔⛔⛔ الطلب دلوقتي لسيرفر OCTA — مش للمزوّد.
     السبب: لو الطلبات طلعت من المتصفح، المفتاح بيتسرّب لأي حد
     يفتح مصدر الصفحة، والحد الشهري بيننفد وهو مش شايف. */
  const sym = String(path || '').split('/').filter(Boolean).pop() || '';
  const r = await octaFetch(window.OCTA_API + '/api/obdepth/' + encodeURIComponent(sym),
                        { headers: { 'X-OCTA-Client': 'web' } });
  let j = null;
  try { j = await r.json(); } catch (e) { }
  if (!r.ok) { const e2 = new Error('HTTP ' + r.status); e2.payload = j; throw e2; }
  return (j && j.data) ? j.data : j;
}


function obFmt(n){
  n = Number(n) || 0;
  return n >= 1e6 ? (n/1e6).toFixed(2) + ' مليون'
  : n >= 1e3 ? (n/1e3).toFixed(1) + ' ألف' : String(Math.round(n));
}

function obAnalyse(d){
  const bidVol = (d.bids||[]).reduce((s,r)=>s+(r.qty||0),0);
  const askVol = (d.asks||[]).reduce((s,r)=>s+(r.qty||0),0);
  const tot = bidVol + askVol;
  const bias = tot ? (bidVol - askVol) / tot : 0;  /* +1 كله شرائي .. -1 كله بيعي */
  const bestBid = d.bids && d.bids.length ? d.bids[0].price : (d.last||0);
  const bestAsk = d.asks && d.asks.length ? d.asks[0].price : (d.last||0);
  const spread = Math.max(0, (bestAsk - bestBid));
  const spreadPct = bestAsk ? (spread / bestAsk) * 100 : 0;
  /* سيولة الدفتر: مجموع الكميات على أول 5 مستويات */
  const depth5 = (d.bids||[]).slice(0,5).reduce((s,r)=>s+(r.qty||0),0)
  + (d.asks||[]).slice(0,5).reduce((s,r)=>s+(r.qty||0),0);
  const thin = depth5 < 12000;

  let cls='neu', ico='⚖️', txt='السوق متوازن — مفيش ضغط واضح على العرض أو الطلب.';
  if (bias >= 0.15){ cls='buy'; ico='🟢'; txt='ضغط شرائي قوي — الطلب بيزيد عن العرض بـ ' + Math.round(bias*100) + '%.'; }
  else if (bias <= -0.15){ cls='sell'; ico='🔴'; txt='ضغط بيعي — العرض بيزيد عن الطلب بـ ' + Math.round(Math.abs(bias)*100) + '%.'; }
  if (thin) txt += ' ⚠️ دفتر الأوامر ضعيف السيولة — احتمال انزلاق السعر عالي.';

  return { bias, bidVol, askVol, bestBid, bestAsk, spread, spreadPct, depth5, thin, cls, ico, txt };
}

function obRender(){
  const host = document.getElementById('obHost');
  if (!host) return;
  if (!OB_LAST){
  host.innerHTML = '<div class="ob-empty">⏳ جاري تحميل دفتر الأوامر…</div>';
  return;
  }
  const d = OB_LAST, a = obAnalyse(d);
  const maxCum = Math.max(
  (d.asks||[]).length ? d.asks[d.asks.length-1].cum : 1,
  (d.bids||[]).length ? d.bids[d.bids.length-1].cum : 1, 1);

  let html = '';

  /* الإشارة — دي اللي هتأثر في قرار OCTA */
  html += '<div class="ob-signal ' + a.cls + '">' +
  '<span class="ob-signal-ico">' + a.ico + '</span>' +
  '<div><b>' + (a.cls==='buy'?'ضغط شرائي':a.cls==='sell'?'ضغط بيعي':'توازن') + '</b> — ' + a.txt +
  '<br><span style="opacity:.85">السبريد ' + a.spread.toFixed(2) + ' ج (' + a.spreadPct.toFixed(2) + '%) · عمق أول 5 مستويات ' + obFmt(a.depth5) + ' سهم</span></div>' +
  '</div>';

  html += '<div class="ob-totals">' +
  '<div class="ob-tot bid"><div class="ob-tot-v">' + obFmt(a.bidVol) + '</div><div class="ob-tot-l">إجمالي الطلبات (Bid)</div></div>' +
  '<div class="ob-tot ask"><div class="ob-tot-v">' + obFmt(a.askVol) + '</div><div class="ob-tot-l">إجمالي العروض (Ask)</div></div>' +
  '</div>';

  html += '<div class="ob-mid">' +
  '<span>أعلى طلب <b style="color:var(--sec)">' + a.bestBid.toFixed(2) + '</b></span>' +
  '<span>·</span><span>أقل عرض <b style="color:var(--red2)">' + a.bestAsk.toFixed(2) + '</b></span>' +
  '<span>·</span><span>الفروق <b>' + a.spread.toFixed(2) + '</b></span>' +
  '<span>·</span><span class="ob-live' + (OB_CFG.key||OB_CFG.demo?' on':'') + '"><i></i>' +
  (OB_CFG.key||OB_CFG.demo ? 'مباشر' : 'غير متصل') + '</span>' +
  '</div>';

  const tabs = '<div class="ob-mid" style="background:rgba(255,255,255,.03)">' +
  '<button class="tool-btn' + (OB_TAB==='depth'?' active':'') + '" onclick="obTab(\'depth\')">📚 عمق السوق</button>' +
  '<button class="tool-btn' + (OB_TAB==='trades'?' active':'') + '" onclick="obTab(\'trades\')">⚡ التنفيذات</button>' +
  '</div>';

  if (OB_TAB === 'trades'){
  html += tabs + '<div class="ob-trades">' +
  '<div class="ob-row hdr" style="grid-template-columns:1fr 1fr 1fr">' +
  '<div class="cell">السعر</div><div class="cell">الكمية</div><div class="cell">الوقت</div></div>' +
  (d.trades||[]).map(t =>
  '<div class="ob-tr">' +
  '<span class="' + t.side + '">' + Number(t.price).toFixed(2) + '</span>' +
  '<span>' + obFmt(t.qty) + '</span>' +
  '<span class="ob-tr-t">' + (t.time||'') + '</span>' +
  '</div>').join('') +
  '</div>';
  host.innerHTML = html;
  return;
  }

  /* جدول العمق — يطابق شكل صورة الـ AMOC */
  const asks = (d.asks||[]).slice().reverse();  // الأقرب للسعر في الآخر
  const bids = d.bids || [];
  const n = Math.max(asks.length, bids.length);
  html += tabs + '<div class="ob-book">' +
  '<div class="ob-row hdr">' +
  '<div class="cell">الأوامر</div><div class="cell">كمية التسعير</div><div class="cell">سعر العرض</div>' +
  '<div class="cell" style="color:var(--gold)">سعر الطلب</div><div class="cell">كمية التسعير</div><div class="cell">الأوامر</div>' +
  '</div>';
  for (let i = 0; i < n; i++){
  const ak = asks[i], bk = bids[i];
  const akP = ak ? ak.price : null, bkP = bk ? bk.price : null;
  const akW = ak ? Math.min(100,(ak.cum/maxCum)*100) : 0;
  const bkW = bk ? Math.min(100,(bk.cum/maxCum)*100) : 0;
  html += '<div class="ob-row">' +
  (ak ? '<div class="ob-bar ask" style="width:' + akW + '%"></div>' : '') +
  (bk ? '<div class="ob-bar bid" style="width:' + bkW + '%"></div>' : '') +
  '<div class="cell ob-n">' + (ak ? ak.orders : '') + '</div>' +
  '<div class="cell ob-q">' + (ak ? obFmt(ak.qty) : '') + '</div>' +
  '<div class="cell ob-p ask">' + (ak ? akP.toFixed(2) : '') + '</div>' +
  '<div class="cell ob-p bid">' + (bk ? bkP.toFixed(2) : '') + '</div>' +
  '<div class="cell ob-q">' + (bk ? obFmt(bk.qty) : '') + '</div>' +
  '<div class="cell ob-n">' + (bk ? bk.orders : '') + '</div>' +
  '</div>';
  }
  html += '</div>';
  host.innerHTML = html;
}

function obTab(t){ OB_TAB = t; obRender(); }

async function obTick(){
  try {
  let d;
    { /* ⛔ فرعي البيانات التجريبية اتشال */

  const r = await obFetch('/api/obdepth/' + SI_CODE);
  d = {
  symbol: SI_CODE,
  /* ⛔ ٢١ أكتوبر ٢٠٢٦ — المصدر بيرجّع quantity والباك بيوحّدها،
     بس هنبقى متسامحين هنا كمان: لو الباك رجع الشكل الخام
     مفيش رقم بضيع — نقرأ qty ولا quantity ولا volume. */
  bids: (r.bids || r.depth?.bids || []).map(x => ({ price:+x.price, qty:+(x.qty ?? x.quantity ?? x.volume ?? 0), orders:+x.orders||0 })),
  asks: (r.asks || r.depth?.asks || []).map(x => ({ price:+x.price, qty:+(x.qty ?? x.quantity ?? x.volume ?? 0), orders:+x.orders||0 })),
  trades: (r.trades || []).map(t => ({ price:+t.price, qty:+(t.qty ?? t.quantity ?? t.volume ?? 0), side:t.side||'dn', time:(t.time||t.timestamp||'').toString().slice(11,19) })),
  last: r.price || r.last || 0
  };
  /* نحسب التراكمي لو مش موجود */
  let cb = 0; d.bids.forEach(x => { cb += x.qty; x.cum = cb; });
  let ca = 0; d.asks.forEach(x => { ca += x.qty; x.cum = ca; });
    /* ⛔⛔⛔ لا fallback للبيانات الوهمية — ولا كلمة.
       لو المصدر ما رجّعش صفقات، نعرض صفر مش أرقام مخترعة. */
    if (!d.trades) d.trades = [];
  }
  if (d) { OB_LAST = d; obRender(); }
  } catch(e) {
  const host = document.getElementById('obHost');
    OB_LAST = null;
    const why = (e && e.payload) ? String(e.payload.error || '') : '';
    const msg = why === 'quota' ? 'خلص الحد الشهري — مش هنعرض أرقام مش حقيقية'
             : why === 'no_key' ? 'المصدر غير مفعّل حالياً'
             : 'تعذّر جلب بيانات عمق السوق الحقيقية';
    if (host) host.innerHTML = '<div class="ob-empty" style="line-height:2">'
      + '<div style="font-size:30px;margin-bottom:8px">📡</div>'
      + '<div style="font-weight:700;margin-bottom:4px">عمق السوق غير متاح دلوقتي</div>'
      + '<div>' + msg + '</div></div>';
      '<div>غير متاح — البيانات الحقيقية مش متاحة دلوقتي</div></div>';
  stopOb();
  }
}

function startOb(){
  stopOb();
  obTick();
  OB_TIMER = setInterval(obTick, 1000);  /* كل ثانية ✅ */
}
function stopOb(){ if (OB_TIMER) { clearInterval(OB_TIMER); OB_TIMER = null; } }

function initObPanel(){
  const m = document.getElementById('obMount');
  if (!m || m.dataset.ready) return;
  m.dataset.ready = '1';
  /* ⛔⛔⛔ اتشال فورم المفتاح + «معاينة ببيانات تجريبية»
     السبب ①: المستخدم مينفعش يدخل مفتاح في متصفحه (تسريب)
     السبب ②: البيانات التجريبية بتاخد شكل الحقيقة — ده اللي غشّ
     دلوقتي الشاشة بتقول «غير متاح» بوضوح، والمصدر شغّال من السيرفر بس. */
  m.innerHTML = '<div id="obHost"><div class="ob-empty">⏳ جاري التحميل…</div></div>';
  /* 🚫 اتشال obSaveKey + obUseDemo — مابقاش في طريق يدخل به المستخدم مفتاح */
}

/* ══════════ 📱 سلوك الموبايل ══════════ */
function toggleMobileTools(){
  const open = document.body.classList.toggle('m-tools-open');
  const b = document.getElementById('mToolsBtn');
  if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
}

/* 🧰 الشريط مفتوح افتراضياً — العنوان اتشال والطي اختياري */
document.documentElement.classList.add('m-tools-open');
document.addEventListener('DOMContentLoaded', function () {
  if (!document.body.classList.contains('m-tools-open')) {
  document.body.classList.add('m-tools-open');
  }
  const b = document.getElementById('mToolsBtn');
  if (b) b.setAttribute('aria-expanded', 'true');
});

/* ⛔⛔⛔ الهيدر بقى **ثابت** — قرار أحمد 2026-10-15.
  ─────────────────────────────────────────────────
  كان فيه إخفاء تلقائي عند النزول، وبيطلع تاني عند الوقوف.
  وبقفل الصفّين فوقانيين بـ `max-height: 0` ← وده بيعمل
  إعادة تخطيط (reflow) للصفحة كلها.

  الأثر: أي وقفة في السكرول كانت بتخلي الشريط والصفحة
  يقفزوا. الفيديو اللي Ahmed بعتّه بيوضّح الفرق بوضوح.

  ⛔ القرار: الهيدر ثابت دايماً. المساحة بتوفرها Sugarول العادي.
  ⛔ شريط الأدوات والفلاتر يفضلوا في مكانهم مهما حصل. */
(function initMobileHeader(){
  const bar = document.querySelector('.octa-topbar');
  if (bar) bar.classList.remove('hide-top');
})();

/* ══════════════════════════════════════════════════════════════
  📊 صفحة الأسهم — كل البورصة (285) ببيانات حقيقية
  ══════════════════════════════════════════════════════════════ */
let SP_FILTER = 'all', SP_LOADED = false;

function spColor(v){ return v >= CFG.th.safe ? '#16c79a' : v >= CFG.th.mid ? '#f4d03f' : '#ff8a80'; }
function spDecStyle(d){
  return octaDecColor(d);
}

/* ════════════════════════════════════════════════════════════════
 🏷️ ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐ تصنيف القرار (مصدر واحد للحقيقة)
 ────────────────────────────────────────────────────────────────
 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌
 📌 المشكلة: القرار الفعلي من الباك هو:
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ «إشارة إيجابية» / «إشارة محايدة» / «إشارة سلبية»
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ — مش «تجميع» / «احتفظ» / «بيع»
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⇒ كل الـregex القديم كان بيرجّع false ⇒ كل الأسهم
 📌 ⛌ ⛌ ⛌ ⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
 📌 ⛌ ⛌ ⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
 📌 ⛌ ⛌ ⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
 📌 ⛌ ⛌ ⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌⛌
 📌 ✅ الحل: helper واحد + regex يقبل الصيغتين.
 ════════════════════════════════════════════════════════════════ */
function octaDecCls(d){
  const s = String(d||'');
  if (/تجميع|شراء|إشارة\s*إيجابية/.test(s)) return 'buy';
  if (/بيع|تجنّب|تجنب|إشارة\s*سلبية/.test(s)) return 'sell';
  if (/غير\s*كاف|بيانات\s*ناقصة/.test(s)) return 'unknown';
  return 'hold';   /* محايد (أو فاضي) */
}
function octaDecColor(d){
  const c = octaDecCls(d);
  if (c === 'buy') return { c:'#16c79a', bg:'rgba(22,199,154,.16)' };
  if (c === 'sell') return { c:'#ff8a80', bg:'rgba(255,82,82,.16)' };
  if (c === 'unknown') return { c:'#f4d03f', bg:'rgba(244,208,63,.16)' };
  return { c:'#4dabf7', bg:'rgba(77,171,247,.16)' };
}


/* ════════════════════════════════════════════════════════════════
 🏷️ ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐ الدرجة من OS_DB (مصدر واحد)
 ────────────────────────────────────────────────────────────────
 📌 /api/intelligence و /api/data_full بيخفيوا final_score
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⇒ كل الكروت كانت بتعرض ٠
 📌 ✅ الحل: نقرأ من OS_DB (من /api/rank المحمي).
 ════════════════════════════════════════════════════════════════ */
function octaScore(code, fallback) {
  try {
    if (typeof OS_DB !== 'undefined' && OS_DB && OS_DB.length) {
      for (var i = 0; i < OS_DB.length; i++) {
        var s = OS_DB[i];
        if (!s || s.code !== code) continue;
        if (s.final_score != null && isFinite(s.final_score)) return Number(s.final_score);
        if (s.score != null && isFinite(s.score)) return Number(s.score);
      }
    }
  } catch (e) { }
  return (fallback != null && isFinite(fallback)) ? Number(fallback) : null;
}

function spFmtCap(v){ const n = Number(v)||0;
  return n>=1e9 ? (n/1e9).toFixed(1)+' مليار' : n>=1e6 ? (n/1e6).toFixed(0)+' مليون' : '—'; }
function spFmtNum(v){ return v==null||v===0 ? '—' : Number(v).toFixed(1); }
function spFmtPct(v){ return v==null||v===0 ? '—' : Number(v).toFixed(1)+'%'; }

/* ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ «العرض الحالي» = القطاع المختار + البحث
   📌 ده الأساس اللي العدّادات بتبني عليه (الكل · تجميع · احتفظ …).
   📌 ⛔⛔⛔ ملاحظة مهمة: الفلتر (شيب تجميع/احتفظ/بيع) **مش** جزء
   📌 ⛔⛔⛔ من الحساب — عشان كل شيب يفضل بيقول «كام جواها» بدل صفر.
   📌 ⛌ البحث النصي جزء من الحساب: النتيجة المعروضة = اللي بتعدّ.
   ════════════════════════════════════════════════════════════════ */
function spViewRows(){
  const q = (document.getElementById('spQ')?.value || '').trim().toUpperCase();
  const sect = document.getElementById('spSect')?.value || '';
  return OS_DB.filter(s => {
    if (sect && s.sector !== sect) return false;
    if (q && !((s.code||'').toUpperCase().includes(q) || (s.name||'').toUpperCase().includes(q) || (s.sector||'').includes(q))) return false;
    return true;
  });
}

function spChips(){
  const box = document.getElementById('spChips');
  if (!box || !OS_DB.length) return;
  /* ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐ إصلاح عدّادات تبويبات «الأسهم»
  📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌 📌
  📌 السبب: القرار الفعلي من الباك هو «إشارة إيجابية» /
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
  📌 ⛌ ⛌ «إشارة محايدة» / «إشارة سلبية» — مش «تجميع» / «احتفظ» / «بيع»
  📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
  📌 ⛌ ⛌ ⇒ العدّادات كانت ٠ (🟢 تجميع ٠ · 🔵 احتفظ ٠)
  📌 ✅ الحل: نقبل الصيغتين (القديمة والجديدة) معاً.
  ════════════════════════════════════════════════════════════════ */
  /* ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ العدّادات تتبّع الفلتر (قطاع + بحث)
  ────────────────────────────────────────────────────────────────
  📌 المشكلة: العدّادات (الكل · تجميع · احتفظ · بيع · مُقيَّم …) كانت
  📌 ⛌⛌⛌ بتتحسب على **كل الـ285 سهم** ⇒ لما تختار قطاع الأرقام ما
  📌 ⛌⛌⛌ بتتغيّرش ⇒ المستخدم مش عارف قطاعه فيه كام فرصة.
  📌 ✅ الحل: العدّادات تتحسب على «العرض الحالي» = القطاع المختار
  📌    + البحث النصي — ومش على شيب الفلتر نفسه، عشان كل شيب
  📌    يفضل بيقول «كام جواها» بدل ما يبقى صفر. */
  const VIEW = spViewRows();
  const dec = c => VIEW.filter(s => c === 'all' ? true :
  c === 'buy' ? /تجميع|شراء|إشارة\s*إيجابية/.test(s.decision||'')
  : c === 'hold' ? /احتفظ|محايد/.test(s.decision||'')
  : c === 'sell' ? /بيع|تجنّب|تجنب|إشارة\s*سلبية/.test(s.decision||'')
  : c === 'live' ? s._live
  : c === 'chance' ? (s.rsi!=null && s.rsi<32 && s.rsi>0)
  : c === 'risk' ? (s.mdd!=null && s.mdd>60)
  : c === 'safe' ? (s.vol1y!=null && s.vol1y<30 && s.mdd!=null && s.mdd<45)
  : true).length;
  const mk = (id,label,n) => '<button class="sp-chip' + (SP_FILTER===id?' on':'') +
  '" onclick="spFilter(\'' + id + '\')">' + label + ' <b>' + n + '</b></button>';
  box.innerHTML =
  mk('all','📋 الكل',VIEW.length)
  + mk('buy','🟢 تجميع',dec('buy'))
  + mk('hold','🔵 احتفظ',dec('hold'))
  + mk('sell','🔴 بيع',dec('sell'))
  + mk('live','⚡ مُقيَّم',VIEW.filter(s=>s._live).length) +
  /* 🆕 مبنية على أرقام حقيقية — مش كلام */
  '<span class="sp-sep"></span>' +
  mk('chance','⚡ فرصة (RSI&lt;32)', dec('chance')) +
  mk('safe','🛡️ أمان', dec('safe')) +
  mk('risk','⚠️ خطر', dec('risk'));
}

function spSectorSelect(){
  const sel = document.getElementById('spSect');
  if (!sel || !OS_DB.length || sel.dataset.ready) return;
  sel.dataset.ready = '1';
  const secs = [...new Set(OS_DB.map(s=>s.sector).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  /* ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐ عدد كل قطاع جوّه القايمة
  📌 عشان المستخدم يشوف من غير ما يختار: «البنوك (23)» — كام سهم في
  📌 كل قطاع. والسهم بينكتب في نص الـoption (HTML attribute). */
  const cnt = {};
  OS_DB.forEach(s => { const k = String(s.sector || '').trim(); if (k) cnt[k] = (cnt[k] || 0) + 1; });
  sel.innerHTML = '<option value="">كل القطاعات (' + OS_DB.length + ')</option>' +
  secs.map(x=>'<option value="'+x+'">'+x+' ('+(cnt[x]||0)+')</option>').join('');
}

function spRows(){
  if (!OS_DB.length) return [];
  const sort = document.getElementById('spSort')?.value || 'score';

  let rows = spViewRows().filter(s => {
  /* ⭐ ٢٥ أكتوبر ٢٠٢٦ — نفس الـregex للعدّادات (Decision الحقيقي من الباك) */
  if (SP_FILTER === 'buy'  && !/تجميع|شراء|إشارة\s*إيجابية/.test(s.decision||'')) return false;
  if (SP_FILTER === 'hold' && !/احتفظ|محايد/.test(s.decision||'')) return false;
  if (SP_FILTER === 'sell' && !/بيع|تجنّب|تجنب|إشارة\s*سلبية/.test(s.decision||'')) return false;
  if (SP_FILTER === 'live' && !s._live) return false;
  /* 🆕 قائم على الأرقام الحقيقية */
  if (SP_FILTER === 'chance' && !(s.rsi!=null && s.rsi < 32 && s.rsi > 0)) return false;
  if (SP_FILTER === 'risk'  && !(s.mdd!=null && s.mdd > 60)) return false;
  if (SP_FILTER === 'safe'  && !(s.vol1y!=null && s.vol1y < 30 && s.mdd!=null && s.mdd < 45)) return false;
  return true;
  });

  const g = f => (v) => { const x = Number(v); return (isFinite(x) && x !== 0) ? x : -1e15; };
  const cmp = {
  score : (a,b) => (b.score||0) - (a.score||0),
  change: (a,b) => (b.change||0) - (a.change||0),
  pe  : (a,b) => (a.pe ? a.pe : 1e9) - (b.pe ? b.pe : 1e9),
  mcap  : (a,b) => (b.mcap||0) - (a.mcap||0),
  yield : (a,b) => (b.yield||0) - (a.yield||0),
  volume: (a,b) => (b.volume||0) - (a.volume||0),
  name  : (a,b) => String(a.name||'').localeCompare(String(b.name||''),'ar'),
  /* 🆕 ترتيبات بالأرقام الحقيقية */
  roe  : (a,b) => (b.roe||-1e9) - (a.roe||-1e9),
  pb  : (a,b) => (a.pb ? a.pb : 1e9) - (b.pb ? b.pb : 1e9),
  rsi  : (a,b) => (a.rsi!=null ? a.rsi : 1e9) - (b.rsi!=null ? b.rsi : 1e9),
  vol  : (a,b) => (a.vol1y!=null ? a.vol1y : 1e9) - (b.vol1y!=null ? b.vol1y : 1e9),
  mdd  : (a,b) => (a.mdd!=null ? a.mdd : 1e9) - (b.mdd!=null ? b.mdd : 1e9),
  sharpe: (a,b) => (b.sharpe||-1e9) - (a.sharpe||-1e9),
  growth: (a,b) => ((b.cagr3y!=null?b.cagr3y:-1e9) - (a.cagr3y!=null?a.cagr3y:-1e9))
  }[sort] || ((a,b)=>(b.score||0)-(a.score||0));
  rows.sort(cmp);
  return rows;
}

function spCard(s){
  const col = s.change >= 0 ? 'var(--sec)' : 'var(--red2)';
  const d = spDecStyle(s.decision);
  const sc = Number(s.score)||0;
  const scCol = spColor(sc);
  const calc = s.peSrc && s.peSrc !== 'source';

  const mets = [];
  mets.push('<span class="sp-m' + (calc?' calc':'') + '" title="' +
  (calc ? 'محسوب من ' + (s.peSrc==='calc_eps' ? 'السعر ÷ EPS' : 'القيمة السوقية ÷ صافي الربح')
  : 'من المصدر') + '">P/E <b>' + spFmtNum(s.pe) + '</b>' + (calc?' ⚡':'') + '</span>');
  if (s.roe != null && s.roe !== 0) mets.push('<span class="sp-m">ROE <b>' + spFmtPct(s.roe) + '</b></span>');
  if (s.mcap) mets.push('<span class="sp-m">ق.س <b>' + spFmtCap(s.mcap) + '</b></span>');
  if (s.yield != null && s.yield !== 0) mets.push('<span class="sp-m">عائد <b>' + spFmtPct(s.yield) + '</b></span>');
  if (s.change) mets.push('<span class="sp-m">تغير <b style="color:' + col + '">' + (s.change>0?'+':'') + Number(s.change).toFixed(2) + '%</b></span>');
  /* 🆕 الأرقام الحقيقية — اللي كانت مخفية عن المستخدم */
  if (s.rsi != null) mets.push('<span class="sp-m' + (s.rsi<30?' ok':s.rsi>70?' bad':'') + '" title="مؤشر القوة النسبية — تحت 30 يعني تشبع بيعي (فرصة)">RSI <b>' + Number(s.rsi).toFixed(0) + '</b></span>');
  if (s.vol1y != null) mets.push('<span class="sp-m" title="التذبذب السنوي محسوب من كل تاريخ السهم المتاح — وسط السوق <span class="flt-ltr">44%</span>">تذبذب <b>' + Number(s.vol1y).toFixed(0) + '%</b></span>');
  if (s.mdd != null) mets.push('<span class="sp-m' + (s.mdd>60?' bad':' ok') + '" title="أكبر هبوط في تاريخ السهم">أقصى هبوط <b>−' + Number(s.mdd).toFixed(0) + '%</b></span>');
  if (s.sharpe != null) mets.push('<span class="sp-m" title="العائد ÷ المخاطرة — فوق 1.5 ممتاز">شارب <b>' + Number(s.sharpe).toFixed(2) + '</b></span>');

  return '<div class="sp-card" onclick="openStock(\'' + s.code + '\')">' +
  '<div class="sp-r1">' +
  '<div class="sp-badge">' + (s.code||'').slice(0,3) + '</div>' +
  '<div class="sp-id"><div class="sp-code">' + (s.code||'') + '</div>' +
  '<div class="sp-name">' + (s.name||'') + '</div>' +
  '<span class="sp-sect">' + (s.sector||'—') + '</span></div>' +
  '<div class="sp-px"><div class="sp-p">' + (s.price ? Number(s.price).toFixed(2) : '—') + '</div>' +
  '<div class="sp-c ' + (s.change>=0?'up':'down') + '">' + (s.change>0?'▲ +':s.change<0?'▼ ':'') + Number(s.change||0).toFixed(2) + '%</div></div>' +
  '</div>' +
  '<div class="sp-r2">' + mets.join('') + '</div>' +
  (sc > 0 ? '<div class="sp-r3">' +
  '<span class="sp-sc" style="color:' + scCol + '">' + Math.round(sc) + '</span>' +
  '<span class="sp-dec" style="color:' + d.c + ';background:' + d.bg + '">' + (s.decision||'—') + '</span>' +
  '<span class="sp-bar2"><i style="width:' + Math.max(0,Math.min(100,sc)) + '%;background:' + scCol + '"></i></span>' +
  '</div>' : '') +
  '</div>';
}

function spRender(){
  const box = document.getElementById('spGrid');
  if (!box) return;
  if (!OS_DB.length){ box.innerHTML = '<div class="sp-load">⏳ جاري تحميل الأسهم…</div>'; return; }
  spChips(); spSectorSelect();
  const rows = spRows();
  document.getElementById('spCount').textContent = rows.length + ' سهم';
  const info = document.getElementById('spDataInfo');
  /* ⭐⭐⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐ العدّاد يتبع الفلتر زي الشيبات */
  if (info) info.textContent = spViewRows().filter(s=>s._live).length + ' بيقيّمهم محرك OCTA لحظياً';
  box.innerHTML = rows.length
  ? rows.slice(0, 300).map(spCard).join('')
  : '<div class="sp-empty">📭 مفيش نتائج للفلتر ده.<br>جرّب كلمة تانية أو غيّر الفلتر.</div>';
}

function spFilter(f){ SP_FILTER = f; spRender(); }

async function initStocksPage(){
  const box = document.getElementById('spGrid');
  if (box && !SP_LOADED){ box.innerHTML = '<div class="sp-load">⏳ جاري تحميل الأسهم…</div>'; }
  if (OS_DB.length){ SP_LOADED = true; spRender(); return; }
  await octaLoadDB();
  SP_LOADED = true;
  spRender();
}

/* ══════════════════════════════════════════════════════════════
  📅 التوزيعات والإجراءات — foudalens / EGX disclosures
  ══════════════════════════════════════════════════════════════ */
let DV_DATA = null, DV_LOADING = false, DV_TYPE = 'all', DV_STATUS = 'all', DV_SORT = 'date', DV_Q = '', DV_HIDE = true;

function dvAr(s){ return String(s||'').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)); }
function dvDate(s){
  if (!s) return { d: '—', sh: '' };
  const p = String(s).split('-');
  if (p.length < 3) return { d: String(s), sh: '' };
  return { d: p[2] + '/' + p[1] + '/' + p[0].slice(2), sh: p[1] + ' ' + p[0].slice(2) };
}
function dvDays(dateStr){
  const t = Date.parse(dateStr); if (isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}
function dvVal(x){
  if (x.kind === 'cash_dividend') return Number(x.value || 0).toFixed(2).replace(/\.?0+$/,'') + ' ج';
  if (x.kind === 'rights_issue' || x.kind === 'capital_increase') return 'زيادة رأس مال';
  if (x.kind === 'stock_split') return x.ratio ? '×' + x.ratio : 'تقسيم';
  if (x.kind === 'stock_dividend') return x.value ? Number(x.value).toFixed(2).replace(/\.?0+$/,'') + ' سهم' : '—';
  if (x.kind === 'cash_dividend') return Number(x.value || 0).toFixed(2) + ' ج';
  return x.value ? Number(x.value).toFixed(2).replace(/\.?0+$/,'') : '—';
}
/* سعر السهم اللحظي من سجل البورصة */
function dvLivePrice(code){
  const s = (typeof OS_DB !== 'undefined') ? OS_DB.find(x => x.code === code) : null;
  if (!s || !s.price) return null;
  const v = Number(s.price);
  /* ⭐ قيد مؤقت (0.10 / 1.00) مش سعر تداول حقيقي — ما ينفعش نعرضه */
  if (!isFinite(v) || v <= 0.5) return null;
  return v;
}
/* نسبة التوزيع من السعر اللحظي (مش المحسوبة من البورصة) */
function dvLiveYield(x, price){
  if (!price || !x.value) return null;
  const p = (price/100) * Number(x.value||0);
  return p > 0 ? (Number(x.value) / price) * 100 : null;
}
/* نسبة زيادة رأس المال — ratio object: {newShares, pct, perShares} */
function dvRatio(x){
  const r = x.ratio;
  if (!r) return '';
  if (typeof r === 'object') return r.pct != null ? 'زيادة ' + Number(r.pct).toFixed(0) + '%' : '';
  return String(r);
}

function dvRows(){
  if (!DV_DATA || !DV_DATA.actions) return [];
  const q = dvNorm(DV_Q);
  let rows = DV_DATA.actions.filter(x => {
  if (q){
  const hay = dvNorm(x.code + ' ' + (x.nameAr||'') + ' ' + dvNameAr(x.code) + ' ' + (x.kindAr||''));
  if (hay.indexOf(q) < 0) return false;
  }
  if (DV_TYPE  !== 'all' && (x.kind !== DV_TYPE && x.kindAr !== DV_TYPE)) return false;
  if (DV_STATUS !== 'all' && (x.status !== DV_STATUS)) return false;
  return true;
  });
  const cmp = {
  date : (a,b) => String(b.distributionDate||'').localeCompare(String(a.distributionDate||'')),
  yld  : (a,b) => (b.yieldPct||0) - (a.yieldPct||0),
  val  : (a,b) => (b.value||0) - (a.value||0)
  }[DV_SORT] || ((a,b)=>String(b.distributionDate||'').localeCompare(String(a.distributionDate||'')));
  return rows.sort(cmp);
}

function dvTabs(){
  const box = document.getElementById('dvTabs'); if (!box || !DV_DATA) return;
  const A = DV_DATA.actions || [];
  const cnt = { all:A.length,
  cash_dividend:A.filter(x=>x.kind==='cash_dividend').length,
  stock:A.filter(x=>x.kind==='stock_dividend').length,
  capital_increase:A.filter(x=>x.kind==='capital_increase'||x.kind==='rights_issue').length,
  rights_issue:A.filter(x=>x.kind==='rights_issue').length,
  split:A.filter(x=>x.kind==='stock_split').length,
  all_up:A.filter(x=>x.status==='upcoming').length,
  all_recent:A.filter(x=>x.status==='recent').length,
  all_past:A.filter(x=>x.status==='past').length };
  const mk = (k,l,n) => '<button class="dv-tab' + ((DV_TYPE===k || (k[0]==='a'&&DV_STATUS===k.slice(3))) ? ' on':'') +
  '" onclick="dvSet(\'' + k + '\')">' + l + ' <b>' + n + '</b></button>';
  const mkS = (k,l,n) => '<button class="dv-tab' + (DV_STATUS===k&&DV_TYPE==='all'?' on':'') +
  '" onclick="dvSetStatus(\'' + k + '\')">' + l + ' <b>' + n + '</b></button>';
  const topUp = A.filter(x=>x.status==='upcoming' && x.recordDate && dvDays(x.recordDate)>=0)
  .sort((a,b)=>String(a.recordDate).localeCompare(String(b.recordDate)))[0];
  box.innerHTML =
  '<div class="dv-quik">' +
  '<div class="dv-quik-l"><span class="dv-quik-t">📌 أقرب استحقاق</span>' +
  (topUp ? '<b>' + topUp.code + '</b><span>' + (topUp.nameAr||'') + '</span>' +
  '<em>القيد ' + dvDate(topUp.recordDate).d + ' · بعد ' + dvDays(topUp.recordDate) + ' يوم</em>'
  : '<span class="dv-muted">مفيش استحقاق قادم</span>') + '</div>' +
  '<div class="dv-search"><input id="dvQ" type="search" placeholder="🔍 دوّر بالاسم أو الكود — مثل MICH" ' +
  'oninput="dvSearch(this.value)" value="' + String(DV_Q).replace(/"/g,'') + '" />' +
  (DV_Q ? '<button class="dv-clear" onclick="dvSearch(\'\')">✕</button>' : '') + '</div>' +
  '<button class="dv-tab" onclick="dvTabsHide()">' + (DV_HIDE ? ' فلاتر متقدّمة' : ' إظهار الفلاتر') + '</button>' +
  '</div>' +
  '<div class="dv-advanced"' + (DV_HIDE ? ' style="display:none"' : '') + '>' +
  mk('all','📋 كل الأنواع',cnt.all)
  + mk('cash_dividend','💰 نقدي',cnt.cash_dividend)
  + mk('stock_dividend','📈 أسهم',cnt.stock)
  + mk('capital_increase','🏗️ زيادة رأس مال',cnt.capital_increase)
  + mk('rights_issue','📌 اكتتاب',cnt.rights_issue)
  + mk('stock_split','✂️ تقسيم',cnt.split)
  + '<span style="width:10px"></span>'
  + mkS('upcoming','🔔 قادم',cnt.all_up)
  + mkS('recent','🕐 آخر 30 يوم',cnt.all_recent)
  + mkS('past','📦 منتهي',cnt.all_past) +
  '</div>' +
  (DV_Q ? '<div class="dv-sr">🔎 نتائج «' + String(DV_Q).replace(/[<>&]/g,'') + '»</div>' : '');
}
function dvSet(k){
  if (k === 'all'){ DV_TYPE = 'all'; DV_STATUS = 'all'; }
  else if (k.startsWith('a')) { DV_TYPE='all'; DV_STATUS=k.slice(3); }
  else { DV_TYPE = k; DV_STATUS = 'all'; }
  dvRender();
}
function dvSetStatus(k){ DV_STATUS = k; DV_TYPE = 'all'; dvRender(); }
function dvTabsHide(){ DV_HIDE = !DV_HIDE; dvTabs(); }
function dvSearch(q){ DV_Q = (q||'').trim(); dvRender(); }
function dvNorm(t){
  return String(t||'').toLowerCase()
  .replace(/[\u064B-\u0652\u0670]/g,'')
  .replace(/[\u0623\u0625\u0622\u0671]/g,'\u0627')
  .replace(/[\u0649\u064A]/g,'\u064A')
  .replace(/\u0624/g,'\u0648').replace(/\u0626/g,'\u064A').replace(/\u0629/g,'\u0647')
  .replace(/[^\u0600-\u06FFa-z0-9]/g,' ');
}
function dvNameAr(code){
  const st = (typeof OS_DB!=='undefined') ? OS_DB.find(x=>x.code===code) : null;
  return st ? (st.name||'') : '';
}

function dvKpis(){
  const box = document.getElementById('dvKpis'); if (!box) return;
  const A = (DV_DATA && DV_DATA.actions) || [];
  const up = A.filter(x=>x.status==='upcoming');
  const yl = A.filter(x=>x.yieldPct);
  const top = yl.length ? yl.reduce((m,x)=>x.yieldPct>(m.yieldPct||0)?x:m) : null;
  const totVal = A.filter(x=>x.kind==='cash_dividend').reduce((s,x)=>s+(Number(x.value)||0),0);
  box.innerHTML =
  '<div class="dv-kpi dv-good"><div class="dv-kpi-v">' + up.length + '</div><div class="dv-kpi-l">🔔 توزيع قادم</div></div>' +
  '<div class="dv-kpi"><div class="dv-kpi-v">' + A.filter(x=>x.kind==='cash_dividend').length + '</div><div class="dv-kpi-l">💰 توزيع نقدي</div></div>' +
  '<div class="dv-kpi"><div class="dv-kpi-v">' + A.filter(x=>x.kind==='stock_dividend').length + '</div><div class="dv-kpi-l">📈 توزيع أسهم</div></div>' +
  '<div class="dv-kpi dv-good"><div class="dv-kpi-v">' + (top ? Number(top.yieldPct).toFixed(1) + '%' : '—') + '</div>' +
  '<div class="dv-kpi-l">🏆 أعلى عائد</div>' +
  (top ? '<div class="dv-kpi-s">' + top.code + ' · ' + (top.nameAr||'').slice(0,14) + '</div>' : '') + '</div>' +
  '<div class="dv-kpi"><div class="dv-kpi-v">' + totVal.toFixed(0) + '</div><div class="dv-kpi-l">💵 إجمالي نقدي (ج)</div></div>';
}

let DV_NEXT_OPEN = false;
function dvNext(){
  const box = document.getElementById('dvNext'); if (!box) return;
  const up = ((DV_DATA && DV_DATA.actions) || [])
  .filter(x => x.status === 'upcoming')
  .sort((a,b) => String(a.recordDate||a.distributionDate||'').localeCompare(String(b.recordDate||b.distributionDate||'')));
  if (!up.length){ box.style.display = 'none'; return; }
  box.style.display = 'block';

  const rows = up.slice(0, 6).map(x => {
  const rr = dvDate(x.recordDate), dd = dvDate(x.distributionDate);
  const days = dvDays(x.recordDate);
  const px = dvLivePrice(x.code);
  const yl = dvLiveYield(x, px);
  const closed = (days != null && days < 0);
  const chip = days == null ? '' : days >= 0
  ? '<span class="dv-days">📌 القيد بعد ' + days + ' يوم</span>'
  : '<span class="dv-days closed">🔒 القيد اتقفل</span>';
  return '<div class="dv-row' + (closed ? ' is-closed' : '') + '" onclick="openStock(\'' + x.code + '\')">' +
  '<div class="dv-date' + (days != null && days >= 0 ? ' hot' : '') + '">' +
  (days != null && days >= 0 ? days + '<small>يوم</small>' : '—') + '</div>' +
  '<div class="dv-row-who"><b>' + x.code + '</b><span>' + (x.nameAr || '') + '</span>' +
  '<em>📌 ' + rr.d + ' <i>→</i> 💸 ' + dd.d + '</em></div>' +
  '<div class="dv-strip">' +
  '<div class="dv-cellv dis"><u>التوزيع</u><b>' + dvVal(x) + '</b></div>' +
  '<div class="dv-cellv px"><u>السعر</u><b>' + (px != null ? px.toFixed(2) + ' ج' : '—') + '</b></div>' +
  '<div class="dv-cellv rate"><u>النسبة</u><b>' + (yl != null ? yl.toFixed(2) + '%' : '—') + '</b></div>' +
  chip +
  '</div>' +
  '</div>';
  }).join('');

  box.innerHTML =
  '<button class="dv-next-h dv-toggle" onclick="dvToggleNext()">' +
  '<span class="dv-caret' + (DV_NEXT_OPEN ? ' open' : '') + '">◀</span>' +
  '🔔 أقرب التوزيعات القادمة' +
  '<span class="dv-nbadge">' + up.length + '</span>' +
  '<span class="dv-hint">اضغط للفتح</span>' +
  '</button>' +
  (DV_NEXT_OPEN ? '<div class="dv-next-list">' + rows + '</div>' :
  '<div class="dv-next-note">📌 تاريخ القيد (الاستحقاق) هو الأهم — هو اللي يخليك تملك السهم وتستفيد</div>');
}
function dvToggleNext(){
  DV_NEXT_OPEN = !DV_NEXT_OPEN;
  const box = document.getElementById('dvNext');
  if (box) { box.classList.toggle('is-open', DV_NEXT_OPEN); }
  dvNext();
}
function dvItem(x){
  const dd = dvDate(x.distributionDate), rd = dvDate(x.recordDate);
  const days = dvDays(x.recordDate);
  const px = dvLivePrice(x.code);
  const yl = dvLiveYield(x, px);
  const st = x.status === 'upcoming' ? ['قادم','up'] : x.status === 'recent' ? ['مؤكد',''] : ['منتهي','past'];
  const tags = [];
  // ⭐ تاريخ القيد (الاستحقاق) الأول — ده الأهم للمستثمر
  if (rd.d !== '—') tags.push('<span class="dv-tag k">📌 القيد ' + rd.d +
  (days != null && days >= 0 ? ' <b>(بعد ' + days + ' يوم)</b>' : days != null ? ' <b>(مُقفل)</b>' : '') + '</span>');
  if (dd.d !== '—') tags.push('<span class="dv-tag">💸 الصرف ' + dd.d + '</span>');
  tags.push('<span class="dv-tag ' + st[1] + '">' + st[0] + '</span>');
  tags.push('<span class="dv-tag k">' + (x.kindAr || x.kind) + '</span>');
  if (px != null) tags.push('<span class="dv-tag">📊 السعر ' + px.toFixed(2) + '</span>');
  if (yl != null) tags.push('<span class="dv-tag up">📐 ' + yl.toFixed(2) + '% من السعر</span>');
  if (x.couponNumber) tags.push('<span class="dv-tag">🔢 القسط ' + x.couponNumber + '</span>');
  if (x.installments) tags.push('<span class="dv-tag">📆 ' + x.installments + ' أقساط</span>');
  if (x.sector) tags.push('<span class="dv-tag">🏷️ ' + x.sector + '</span>');
  if (x.lastClose) tags.push('<span class="dv-tag">إغلاق ' + Number(x.lastClose).toFixed(2) + '</span>');
  if (x.subscriptionPrice) tags.push('<span class="dv-tag">سعر الاكتتاب ' + x.subscriptionPrice + '</span>');
  const near = (x.status==='upcoming') && x.recordDate && dvDays(x.recordDate)!=null && dvDays(x.recordDate)>=0;
  return '<div class="dv-item' + (near ? ' near' : '') + '" onclick="openStock(\'' + x.code + '\')">' +
  '<div class="dv-i1"><div class="dv-code">' + x.code + '</div>' +
  '<div class="dv-name">' + (x.nameAr || '') + '</div></div>' +
  '<div class="dv-i2"><div class="dv-val">' + dvVal(x) + '</div>' +
  (x.yieldPct ? '<div class="dv-yld">عائد ' + Number(x.yieldPct).toFixed(2) + '%</div>' : '') + '</div>' +
  '<div class="dv-i3">' + tags.join('') + '</div>' +
  '</div>';
}

/* ══════════ 🎟️ الاكتتاب — حقوق + توزيع أسهم + المستفيدون ══════════ */
/* (اتشال «مين هيتضرّع» — رادار الـIPO بقى فيه teaser بدالها) */
function dvBook(){
  const host = document.getElementById('dvBook'); if (!host) return;
  const A = (DV_DATA && DV_DATA.actions) || [];
  const subs = A.filter(x => x.kind === 'rights_issue');
  const stockD = A.filter(x => x.kind === 'stock_dividend');
  const open = subs.filter(x => x.status === 'upcoming');

  const h = '<div class="dv-head">🎟️ الاكتتاب — ترقية رأس المال + توزيع أسهم</div>' +
  '<div class="dv-kpis">' +
  '<div class="dv-kpi"><div class="dv-kpi-v">' + subs.length + '</div><div class="dv-kpi-l">🎟️ اكتتاب حقوق</div></div>' +
  '<div class="dv-kpi dv-good"><div class="dv-kpi-v">' + open.length + '</div><div class="dv-kpi-l">📢 مفتوح الآن</div></div>' +
  '<div class="dv-kpi"><div class="dv-kpi-v">' + stockD.length + '</div><div class="dv-kpi-l">📈 توزيع أسهم</div></div>' +
  '</div>';

  const up = open.sort((a,b) => String(a.recordDate||'').localeCompare(String(b.recordDate||'')));
  const tbl = up.length ? '<div class="dv-list" style="margin-top:12px">' + up.map(x => {
  const rr = dvDate(x.recordDate), days = dvDays(x.recordDate);
  const px = dvLivePrice(x.code), r = x.ratio || {};
  const disc = (px && x.subscriptionPrice) ? (px - x.subscriptionPrice) / px * 100 : null;
  return '<div class="dv-next-row" onclick="openStock(\'' + x.code + '\')">' +
  '<div class="dv-date hot">' + (days != null ? days + '<small>يوم للقيد</small>' : rr.d) + '</div>' +
  '<div class="dv-ni"><div class="dv-nc">' + x.code + ' — اكتتاب حقوق</div>' +
  '<div class="dv-nn">' + (x.nameAr||'') + '</div>' +
  '<div class="dv-nn" style="margin-top:3px">📌 القيد ' + rr.d + ' · 💸 الصرف ' + dvDate(x.distributionDate).d + '</div></div>' +
  '<div class="dv-nv"><b>' + (x.subscriptionPrice||'—') + ' ج/سهم</b>' +
  '<span>' + (r.newShares||'?') + ' جديد لكل ' + (r.perShares||'?') + ' قائم</span>' +
  (px ? '<span>السعر ' + px.toFixed(2) + '</span>' : '') +
  (disc != null ? '<span>' + (disc>0?'خصم ':'علاوة ') + Math.abs(disc).toFixed(1) + '%</span>' : '') +
  '</div></div>';
  }).join('') + '</div>' : '<div class="dv-empty">📭 مفيش اكتتاب حقوق مفتوح دلوقتي.</div>';

  /* تم استبدال «مين هيتضرّع» — انقل teaserjor لداخل رادار الـIPO */

  const SRC =
  '<div class="dv-panel" style="margin-top:16px"><div class="dv-panel-h">📚 مصادر — اضغط تفتح المصدر</div>' +
  '<div class="dv-grid">' +
  '<a class="dv-cell link" href="https://foudalens.com/ar/ipo" target="_blank" rel="noopener"><div class="dv-cell-h">FoudaLens — تتبع الطروحات</div><div class="dv-muted" style="font-size:.79rem">سعر الطرح · عدد الأسهم · مواعيد الاكتتاب · أول جلسة</div><div class="dv-badge up">فتح ↗</div></a>' +
  '<a class="dv-cell link" href="https://www.egx.com.eg/ar/NewsList.aspx?Type=Listing" target="_blank" rel="noopener"><div class="dv-cell-h">البورصة المصرية — أخبار القيد</div><div class="dv-muted" style="font-size:.79rem">الإفصاحات الرسمية للطرح العام الأولي</div><div class="dv-badge up">فتح ↗</div></a>' +
  '<a class="dv-cell link" href="https://efghldg.com" target="_blank" rel="noopener"><div class="dv-cell-h">EFG Holding — إفصاحات الطروحات</div><div class="dv-muted" style="font-size:.79rem">إعلانات تنفيذ الاكتابات (Gourmet · NAPR)</div><div class="dv-badge up">فتح ↗</div></a>' +
  '</div></div>';

  host.innerHTML = h + tbl + SRC + '<div id="ipoHost" style="margin-top:20px"></div>';
}

/* ══════════════════════════════════════════════════════════
  🎟️ نظام استشعار الاكتتاب — IPO Radar
  بيمسح مصدر الطروحات ويعرف لو طلع اكتتاب جديد
  لو لقى حاجة ناقصة → يطلب مساعدة منك وبيحفظها
  ══════════════════════════════════════════════════════════ */
const IPO_SRC_URL = 'https://foudalens.com/ar/ipo';
/* ① snapshot محلي (نفس الأصل — دايماً بيشتغل)
  ② proxy حي (لو اشتغل)  ③ صفر = رسالة واضحة مشillusion */
const IPO_SOURCES = [
  { name:'FoudaLens (نسخة محلية)', url:IPO_SRC_URL, local:'data_ipo.json' },
  { name:'من المصدر', url:IPO_SRC_URL, json:OCTA_API + '/api/ipo' },
];
let IPO_DATA = null, IPO_LOADING = false, IPO_FILTER = 'فترة اكتتاب', IPO_CHECKED = 0, IPO_WHEN = '';

function _ipoClean(t){
  return (t||'')
  .replace(/<!--[\s\S]*?-->/g,'')  /* فواصل React */
  .replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;/g,"'")
  .replace(/\s+/g,' ').trim();
}
/* يحلّل كروت الطرح: كل كارت بين الكارت اللي قبله والـ anchor بتاعه */
function ipoParse(html){
  const out = [];
  const re = /<a[^>]*href="\/ar\/stock\/([A-Z0-9]+)\.CA"[^>]*>/g;
  let m, marks = [];
  while ((m = re.exec(html))) marks.push({ code:m[1], at:m.index });
  for (let k = 0; k < marks.length; k++){
  const from = k === 0 ? 0 : marks[k-1].at;
  const seg = html.slice(from, marks[k].at);
  const name = _ipoClean((seg.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1]);
  if (!name) continue;
  const after = seg.slice((seg.match(/<h3[^>]*>/) || {index:0}).index);
  const status = _ipoClean((after.match(/<\/h3>\s*<span[^>]*>([\s\S]*?)<\/span>/) || [])[1]) || '';
  let sector = '';
  if (after.indexOf('</h3>') >= 0){
  [...after.slice(after.indexOf('</h3>')+5).matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].forEach((m,i) => {
  const t = _ipoClean(m[1]);
  if (i === 0 && t === status) return;
  if (t && ['مُدرج','مدرج','قادم','فترة اكتتاب'].indexOf(t) < 0 && t.length < 40) sector = t;
  });
  }
  /* المؤشرات — نمسك 'label</p><p>value' مباشرة؛ الـ regex العام بيعلق في JSON-LD */
  const grab = (lab) => _ipoClean((seg.match(new RegExp(lab + '<\\/p>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>')) || [])[1]);
  const metrics = { 'سعر الطرح': grab('سعر الطرح'), 'قيمة الطرح': grab('قيمة الطرح') };
  /* الوصف = آخر <p> طويل */
  const ps = [...seg.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(x=>_ipoClean(x[1])).filter(t=>t.length>55);
  out.push({
  code: marks[k].code, name, status,
  sector: sector,
  price: metrics['سعر الطرح'] || '', value: metrics['قيمة الطرح'] || '',
  desc: (function(){
  let t = ps.length ? ps[ps.length-1] : '';
  if (t && (t.replace(/مُدرج|مدرج|قادم|فترة اكتتاب|تاريخ الطرح/g,'').trim().length < 25
  || t.slice(0,name.length).replace(/\s/g,'') === name.replace(/\s/g,''))) t = '';
  return t;
  })(),
  src: IPO_SOURCES[0].url
  });
  }
  return out;
}
async function ipoScan(){
  if (IPO_LOADING) return;
  IPO_LOADING = true; ipoRender();
  let list = [], how = '';
  for (const s of IPO_SOURCES){
  try {
  if (s.local){
  const r = await fetch(s.local + '?_=' + Date.now(), { cache:'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (j.ipos && j.ipos.length) { list = j.ipos; how = j.fetchedAt || ''; break; }
  continue;
  }
  if (s.json){
  const r = await fetch(s.json + '?_=' + Date.now(), { cache:'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (Array.isArray(j) && j.length){ list = j; how = 'live'; break; }
  continue;
  }
  const r = await fetch(s.proxy + '&_=' + Date.now(), { cache:'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const got = ipoParse(await r.text());
  if (got.length) { list = got; how = 'live'; break; }
  } catch(e){ console.warn('[IPO]', s.name, e.message); }
  }
  IPO_DATA = list; IPO_LOADING = false; IPO_CHECKED = Date.now(); IPO_WHEN = how; ipoRender();
}
const IPO_ST = { 'فترة اكتتاب':['open','og'], 'قادم':['soon','so'], 'مُدرج':['listed','li'],
  'مدرج':['listed','li'], 'معلق':['soon','so'] };
function ipoRows(){
  if (!IPO_DATA) return [];
  if (IPO_FILTER === 'all') return IPO_DATA;
  return IPO_DATA.filter(x => (x.status||'').trim() === IPO_FILTER);
}
function ipoRender(){
  const host = document.getElementById('ipoHost'); if (!host) return;

  if (IPO_LOADING){ host.innerHTML = '<div class="dv-empty">🔎 بافحص المصادر…</div>'; return; }
  if (!IPO_DATA){
  host.innerHTML = '<div class="dv-empty">⚠️ مقدرش أوصل لمصدر الطروحات دلوقتي — جرّب زرار التحديث.</div>' +
  '<div class="dv-tools"><button class="dv-tab on" onclick="IPO_FILTER=\'all\';ipoRender()">🔄 تحديث</button></div>'; return;
  }

  const TABS = ['all','قادم','فترة اكتتاب','مُدرج'];
  const TL = { all:'الكل','قادم':'قادم','فترة اكتتاب':'🟢 اكتتاب مفتوح','مُدرج':'مُدرج' };
  const tabs = TABS.map(t => '<button class="dv-tab' + (IPO_FILTER===t?' on':'') +
  '" onclick="IPO_FILTER=\'' + t + '\';ipoRender()">' + TL[t] +
  ' <span class="dv-s">' + (t==='all'?IPO_DATA.length:IPO_DATA.filter(x=>(x.status||'').trim()===t).length) + '</span></button>').join('');

  const rows = ipoRows().map(x => {
  const st = IPO_ST[(x.status||'').trim()] || ['soon','so'];
  const open = st[0] === 'open';
  const live = (typeof OS_DB!=='undefined') ? OS_DB.find(s=>s.code===x.code) : null;
  const listed = (x.status||'').indexOf('مدرج') >= 0 || (x.status||'').indexOf('مُدرج') >= 0;
  const px = (live && listed && dvLivePrice(x.code)) ? dvLivePrice(x.code) : null;
  const firstDay = (x.desc||'').match(/أول يوم[^\d]*([+\-]?\d+(?:\.\d+)?)\s*%/);
  return '<div class="ipo-card ' + st[1] + '">' +
  '<div class="ipo-top">' +
  '<div class="ipo-ico">' + (open ? '🟢' : st[0]==='listed' ? '✅' : '⏳') + '</div>' +
  '<div style="min-width:0;flex:1">' +
  '<div class="ipo-name">' + x.name + '</div>' +
  '<div class="ipo-meta">' +
  '<span class="ipo-tick">' + x.code + '</span>' +
  '<span class="dv-badge ' + st[1] + '">' + (x.status || '—') + '</span>' +
  (x.sector ? '<span class="dv-badge">' + x.sector + '</span>' : '') +
  '</div>' +
  '</div>' +
  '</div>' +
  ((x.price || x.value || px) ? '<div class="ipo-kpis">' +
  (x.price ? '<div><u>سعر الطرح</u><b>' + x.price + '</b></div>' : '') +
  (x.value ? '<div><u>قيمة الطرح</u><b>' + x.value + '</b></div>' : '') +
  (px  ? '<div><u>السعر الآن</u><b>' + Number(px).toFixed(2) + ' ج</b></div>' : '') +
  (firstDay ? '<div><u>أول يوم</u><b>' + firstDay[1] + '%</b></div>' : '') +
  '</div>' : '') +
  (x.desc ? '<div class="ipo-desc">' + x.desc + '</div>' : '') +
  '<div class="ipo-acts">' +
  '<button class="dv-tab" onclick="event.stopPropagation();window.open(\'' + x.src + '\',\'_blank\',\'noopener\')">📄 المصدر ↗</button>' +
  (live ? '<button class="dv-tab" onclick="event.stopPropagation();openStock(\'' + x.code + '\')">📈 افتح السهم</button>' : '') +
  '</div>' +
  '</div>';
  }).join('');

  const last = IPO_CHECKED ? new Date(IPO_CHECKED).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}) : '—';
  const when = IPO_WHEN && IPO_WHEN !== 'live'
  ? 'نسخة ' + new Date(IPO_WHEN).toLocaleDateString('ar-EG') + ' ' + new Date(IPO_WHEN).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})
  : 'مباشر';
  host.innerHTML =
  '<div class="ipo-bar">' +
  '<div><b>🎟️ رادار الطرح العام الأولي</b>' +
  '<span class="dv-s">آخر فحص ' + last + ' · ' + IPO_DATA.length + ' طرح</span></div>' +
  '<button class="dv-tab on" onclick="ipoScan()">🔄 افحص دلوقتي</button>' +
  '</div>' + ipoNewPanel() +
  '<div class="dv-tabs" style="margin-top:12px">' + tabs + '</div>' +
  (rows ? '<div class="ipo-list">' + rows + '</div>'
  : '<div class="dv-empty">📭 مفيش طرح في التصنيف ده.</div>') +
  ipoTeaser() + ipoAskPanel();
}
/* ════════════════════════════════════════════════
  🏢 مين يستفيد من الاكتتاب؟ — تشويق مش إجابة
  ⭐ مش بنتأكد حاجة من غير مصدر — بنلمي ونقولك روح اتأكد بنفسك
  ════════════════════════════════════════════════ */
const IPO_BENEFIT_TEASE = [
  { code:'MNTI', clue:'🏛️ الشركة الأم — بتبيع أكبر شريحة في الطرح',
  src:'https://www.egx.com.eg/ar/NewsList.aspx?Type=Listing' },
  { code:'HRHO', clue:'🎯 الوكيل الرئيسي — نفّذ أكبر طرحين في 2026',
  src:'https://www.efghldg.com' },
  { code:'COMI', clue:'🏦 بنك — دوره في الطرح ده محتاج تتأكد منه',
  src:'https://www.egx.com.eg/ar/NewsList.aspx?Type=Listing' },
  { code:'GBCO', clue:'💼 مساهم محتمل — أكّده من مصدر رسمي؟',
  src:'https://www.egx.com.eg/ar/NewsList.aspx?Type=Listing' },
];
function ipoTeaser(){
  const act = IPO_DATA.filter(x => (x.status||'').trim() === IPO_FILTER);
  const tick = act[0] || IPO_DATA[0];
  const who = tick ? tick.code : '—';
  return '<div class="ipo-tease">' +
  '<div class="ipo-tease-h">🏢 فيه شركات هتتأثر من اكتتاب <b>' + who + '</b> — بس هنقولك لوحدك؟ 😏</div>' +
  '<div class="ipo-tease-sub">الموقع مش بياخد كلام حد من غير مصدر. اضغط الكارت يفتح السهم، ' +
  'وزرار «🔍 اتأكد» يفتح المصدر الرسمي — ساعدنا نشوف مين فعلاً داخل في الطرح.</div>' +
  '<div class="ipo-tease-grid">' + IPO_BENEFIT_TEASE.map(t =>
  '<div class="ipo-tease-card" onclick="openStock(\'' + t.code + '\')">' +
  '<div class="ipo-tease-code">' + t.code + '</div>' +
  '<div class="ipo-tease-clue">' + t.clue + '</div>' +
  '<a class="ipo-tease-src" href="' + t.src + '" target="_blank" rel="noopener" ' +
  'onclick="event.stopPropagation()">🔍 اتأكد من المصدر ↗</a>' +
  '</div>').join('') + '</div>' +
  '</div>';
}

/* ⭐ الأكواد اللي مش في سجل البورصة عندنا = أكواد جديدة */
function ipoNewCodes(){
  if (!IPO_DATA || !Array.isArray(IPO_DATA)) return [];
  const known = (typeof OS_DB !== 'undefined') ? OS_DB.map(s => s.code) : [];
  if (!known.length) return [];
  return IPO_DATA.filter(x => x.code && known.indexOf(x.code) < 0);
}
function ipoNewPanel(){
  const nw = ipoNewCodes();
  if (!nw.length) return '';
  return '<div class="ipo-newbar">' +
  '<b>🆕 ' + nw.length + ' كود جديد مش في سجل البورصة عندنا</b>' +
  '<span>الموقع لسه مش عارف بياناتها — لو تعرفها من مصدر، اكتبها هنا و هي تظهر لكل الناس</span>' +
  '<div class="ipo-newlist">' + nw.map(x =>
  '<button class="dv-tab help" onclick="ipoAsk(\'' + x.code + '\',\'' + x.name.replace(/'/g,"") + '\')">' +
  '✍️ ' + x.code + '</button>').join('') + '</div></div>';
}
/* ✍️ لو المعلومة ناقصة → اطلبها منك واحفظها */
function ipoAsk(code, name){
  let a = IPO_MANUAL[code];
  if (!a){ a = IPO_MANUAL[code] = { code, name, note:'', price:'', val:'', role:'' }; }
  const t = prompt('📝 ساعدنا في ' + (name||code) + '\n\nاكتب المعلومة الناقصة (وكل سطر = حقل):\n' +
  'price=سعر الطرح  val=قيمة الطرح  role=دورك (وكيل/مساهم/بائع)  note=أي ملاحظة',
  [ a.price ? 'price=' + a.price : '', a.val ? 'val=' + a.val : '', a.role ? 'role=' + a.role : '', a.note||'' ].filter(Boolean).join('\n'));
  if (t === null) return;
  t.split('\n').forEach(line => {
  const mm = line.match(/^\s*(\w+)\s*=\s*(.+)$/);
  if (mm) a[mm[1]] = mm[2].trim(); else if (line.trim()) a.note = (a.note ? a.note + ' · ' : '') + line.trim();
  });
  localStorage.setItem('octa_ipo_manual_v1', JSON.stringify(IPO_MANUAL));
  ipoRender();
}
let IPO_MANUAL = {};
try { IPO_MANUAL = JSON.parse(localStorage.getItem('octa_ipo_manual_v1') || '{}'); } catch(e){}
function ipoAskPanel(){
  const k = Object.keys(IPO_MANUAL).filter(c => IPO_MANUAL[c].note || IPO_MANUAL[c].role || IPO_MANUAL[c].price);
  if (!k.length) return '';
  return '<div class="dv-panel" style="margin-top:16px"><div class="dv-panel-h">✍️ معلومات ضفتها انت</div>' +
  k.map(c => { const a = IPO_MANUAL[c];
  return '<div class="ipo-man"><b>' + c + '</b> — ' + (a.name||'') +
  (a.role ? ' <span class="dv-badge up">' + a.role + '</span>' : '') +
  (a.note ? '<div class="dv-muted" style="margin-top:5px;font-size:.8rem">' + a.note + '</div>' : '') + '</div>';
  }).join('') + '</div>';
}

function dvRender(){
  if (!DV_DATA) return;
  dvKpis(); dvNext(); dvBook(); dvTabs();
  const rows = dvRows();
  const LBL = { cash_dividend:'نقدي', stock_dividend:'أسهم', capital_increase:'زيادة رأس مال', rights_issue:'اكتتاب', stock_split:'تقسيم' };
  const label = DV_TYPE !== 'all' ? (LBL[DV_TYPE] || DV_TYPE)
  : DV_STATUS === 'upcoming' ? 'القادمة' : DV_STATUS === 'recent' ? 'آخر 30 يوم' : DV_STATUS === 'past' ? 'المنتهية' : 'الكل';
  const h = document.getElementById('dvSecH');
  if (h) h.innerHTML = '📋 ' + label + ' <span class="dv-s">' + rows.length + ' إجراء</span>';
  const box = document.getElementById('dvList');
  if (box) box.innerHTML = rows.length
  ? rows.slice(0, 200).map(dvItem).join('')
  : '<div class="dv-empty">📭 مفيش إجراءات في الفلتر ده.</div>';
  const src = document.getElementById('dvSrc');
  if (src) src.innerHTML = '📡 المصدر: <b>' + (DV_DATA.source || 'إعلانات البورصة المصرية') + '</b> · ' +
  (DV_DATA.actions||[]).length + ' إجراء · التحديث كل 6 ساعات';
  /* ⭐ آخر حاجة — بعد ما dvBook عمل الحاوية */
  if (typeof ipoRender === 'function') ipoRender();
}

async function dvLoad(){
  if (DV_DATA || DV_LOADING) { if (DV_DATA) dvRender(); return; }
  DV_LOADING = true;
  try {
  const r = await octaFetch(OCTA_API + '/api/dividends?_=' + Date.now());
  if (!r.ok) throw new Error('HTTP ' + r.status);
  DV_DATA = await r.json();
  dvRender();
  /* نحمّل سجل الأسعار بالتوازي عشان نحسب السعر اللحظي ونسبة التوزيع */
  try { if (typeof octaLoadDB === 'function') { await octaLoadDB(); dvRender(); } } catch(e){}
  if (typeof ipoScan === 'function') ipoScan();
  } catch(e) {
  const b = document.getElementById('dvList');
  if (b) b.innerHTML = '<div class="dv-empty">⚠️ تعذر تحميل البيانات: ' + (e.message||'') + '<br>جرّب تحديث الصفحة.</div>';
  }
  DV_LOADING = false;
}

function renderStockPage() {
  const { intel, explain, news } = SI_DATA;
  const exRaw = (explain && (explain.explanation || explain)) || {};
  const ax = intel.axes || {};
  const dec = intel.decision || '—';
  const decCls = octaDecCls(dec);
  const stockNews = ((news.actions || []).filter(a => a.code === SI_CODE) || []);

  // المحاور
  let axesHtml = '';
  for (const [k, meta] of Object.entries(SI_AXES)) {
  const v = ax[k];
  const has = v !== undefined && v !== null;
  const val = has ? Math.round(v) : null;
  const cls = val === null ? 'na' : '';
  axesHtml += `<div class="si-axis ${cls}">
  <div class="ax-n">${meta.i} ${meta.n}</div>
  <div class="ax-v">${val === null ? '—' : val}</div>
  <div class="ax-b"><i style="width:${val || 0}%"></i></div>
  </div>`;
  }

  // التفسير
  const pos = (explain?.top_positives || []).map(x =>
  `<div class="si-fact pos"><span class="fi">✅</span><div><div>${x.text}</div><div class="si-src">${x.from}</div></div></div>`).join('');
  const neg = (explain?.top_negatives || []).map(x =>
  `<div class="si-fact neg"><span class="fi">❌</span><div><div>${x.text}</div><div class="si-src">${x.from}</div></div></div>`).join('');
  const chg = (explain?.what_could_change_score || []).map(x =>
  `<div class="si-fact neu"><span class="fi">🔄</span><div>${x}</div></div>`).join('');
  const inv = (explain?.what_could_invalidate || []).map(x =>
  `<div class="si-fact neg"><span class="fi">⚠️</span><div>${x}</div></div>`).join('');
  const missing = (explain?.missing_data || []).length
  ? `<div class="si-fact neu"><span class="fi">📭</span><div>بيانات ناقصة: ${(explain.missing_data||[]).join('، ')}</div></div>` : '';

  // — المخاطر
  const rk = intel.risk_engine || {};
  const risks = (rk.top_risks || []).map(r =>
  `<div class="si-fact neg"><span class="fi">⚠️</span><div>${r.الوصف || r.description || ''}</div></div>`).join('');

  // القيمة العادلة
  const f = intel.fundamental || {};
  let fvHtml = '';
  if (f.fair_value) {
  const up = f.upside_pct || 0;
  fvHtml = `<div class="si-score final">
  <div class="sv" style="font-size:1.5rem">${Number(f.fair_value).toFixed(2)}</div>
  <div class="sl">القيمة العادلة (ج.م) — ${up >= 0 ? 'فرصة +' : ''}${up.toFixed(1)}%</div>
  </div>`;
  }

  // الشارت
  const chg2 = intel.change || 0;
  const src = '(TradingView)';

  document.getElementById('siContent').innerHTML = `
  <!-- HERO -->
  <div class="si-hero">
  <div class="si-top">
  <div class="si-id">
  <div class="si-badge">${SI_CODE.slice(0,2)}</div>
  <div>
  <div class="si-code">${SI_CODE}</div>
  <div class="si-name">${intel.name || ''}</div>
  <div class="si-tags">
  <span class="si-tag sector">${intel.sector || 'غير محدد'}</span>
  <span class="si-tag">💧 سيولة ${(intel.liquidity?.score ?? 0).toFixed(0)}</span>
  <span class="si-tag">🛡️ أمان ${(rk.safety_score ?? 0).toFixed(0)}</span>
  ${intel.data_ts ? `<span class="si-tag">🕐 ${intel.data_ts.slice(11,16)}</span>` : ''}
  </div>
  </div>
  </div>
  <div class="si-price-box">
  <div class="si-price ${chg2 >= 0 ? 'pos' : 'neg'}">${Number(intel.price||0).toFixed(2)}</div>
  <div class="si-chg ${chg2 >= 0 ? 'pos' : 'neg'}">${chg2 >= 0 ? '▲ +' : '▼ '}${chg2.toFixed(2)}%</div>
  </div>
  </div>

  <div class="si-scores">
  <div class="si-score final">
  <div class="sv">${octaScore(code, intel.final_score) ?? '—'}</div>
  <div class="sl">النتيجة النهائية (من 100)</div>
  </div>
  <div class="si-score conf">
  <div class="sv">${intel.confidence ?? 0}%</div>
  <div class="sl">ثقة التحليل</div>
  </div>
  <div class="si-score dec ${decCls}">
  <div class="sv">${dec}</div>
  <div class="sl">${f.valuation_status || 'التقييم غير محدد'}</div>
  </div>
  ${fvHtml}
  <button class="si-score" onclick="closeStock()" style="cursor:pointer">
  <div class="sv" style="font-size:1.5rem;color:var(--muted)">←</div>
  <div class="sl">رجوع</div>
  </button>
  </div>
  </div>

  <!-- TABS -->
  <div class="si-tabs">
  <button class="si-tab active" onclick="siTab(this,'chart')">📊 الرسم البياني</button>
  <button class="si-tab" onclick="siTab(this,'axes')">🎯 المحاور</button>
  <button class="si-tab" onclick="siTab(this,'why')">💡 ليه التقييم كده؟</button>
  <button class="si-tab" onclick="siTab(this,'news')">📰 أخبار السهم ${stockNews.length ? '('+stockNews.length+')' : ''}</button>
  <button class="si-tab" onclick="siTab(this,'risk')">⚠️ المخاطر</button>
  <button class="si-tab" onclick="siTab(this,'book')">📊 عمق السوق</button>
  </div>

  <!-- PANEL: CHART -->
  <div class="si-panel active" id="si-p-chart">
  <div class="si-chart-box">
  <div class="si-sect-h">📊 التحليل البياني <small>مصدر: ${src}</small></div>
  <div class="si-chart-sym">${SI_CODE} — ${intel.name || ''}</div>
  <div id="si-tv-chart"></div>
  </div>
  <div class="si-sect">
  <div class="si-sect-h">📈 الأرقام السريعة</div>
  <table class="mini-table"><tbody>
  <tr><td>السعر</td><td><b>${Number(intel.price||0).toFixed(2)} ج.م</b></td>
  <td>التغير</td><td class="${chg2>=0?'':''}" style="color:${chg2>=0?'var(--sec)':'var(--red2)'}">${chg2.toFixed(2)}%</td></tr>
  <tr><td>القيمة السوقية</td><td>${(intel.fundamental?.sector_peers ? '' : '') || (intel.liquidity?.metrics?.['القيمة السوقية'] ? (intel.liquidity.metrics['القيمة السوقية']/1e9).toFixed(1)+' مليار' : '—')}</td>
  <td>التذبذب</td><td>${(intel.technical?.atr_pct ?? 0).toFixed(2)}% يومياً</td></tr>
  <tr><td>مضاعف الربحية</td><td>${(f.sector_peers && intel.fundamental?.breakdown) ? (intel.raw_pe ?? '—') : '—'}</td>
  <td>القيمة العادلة</td><td>${f.fair_value ? Number(f.fair_value).toFixed(2) : '—'}</td></tr>
  </tbody></table>
  </div>
  </div>

  <!-- PANEL: AXES -->
  <div class="si-panel" id="si-p-axes">
  <div class="si-sect">
  <div class="si-sect-h">🎯 المحاور السبعة <small>كل محور من 0 إلى 100</small></div>
  <div class="si-axes">${axesHtml}</div>
  </div>
  ${f.sector_peers && f.sector_peers['متوسط P/E'] ? `
  <div class="si-sect">
  <div class="si-sect-h">📊 مقارنة بالقطاع</div>
  <div class="si-axes">
  <div class="si-axis"><div class="ax-n">متوسط P/E القطاع</div><div class="ax-v">${f.sector_peers['متوسط P/E']}</div></div>
  <div class="si-axis"><div class="ax-n">عدد المقارنة</div><div class="ax-v">${f.sector_peers['عدد المقارنة'] || 0}</div></div>
  </div>
  </div>` : ''}
  </div>

  <!-- PANEL: WHY -->
  <div class="si-panel" id="si-p-why">
  ${exRaw && exRaw.formula ? `
  <div class="si-sect">
  <div class="si-sect-h">🧮 إزاي اتحسبت النتيجة</div>
  <div class="si-formula"><code>${exRaw.formula}</code></div>
  <div class="si-stats">
  <div><span>قبل التعديلات</span><b>${exRaw.base_score != null ? Number(exRaw.base_score).toFixed(1) : '—'}</b></div>
  <div><span>الخصومات</span><b style="color:var(--red2)">−${exRaw.adjustment_total != null ? Math.abs(Number(exRaw.adjustment_total)).toFixed(1) : '0.0'}</b></div>
  <div><span>النتيجة النهائية</span><b style="color:var(--gold)">${exRaw.final_score != null ? Number(exRaw.final_score).toFixed(1) : '—'}</b></div>
  <div><span>الثقة</span><b>${exRaw.confidence != null ? exRaw.confidence + '%' : '—'}</b></div>
  </div>
  </div>` : ''}

  ${exRaw && exRaw.contributions && exRaw.contributions.length ? `
  <div class="si-sect">
  <div class="si-sect-h">📊 مساهمة كل محور في النتيجة <small>النتيجة × الوزن</small></div>
  <div class="si-contrib">
  ${exRaw.contributions.slice(0, 10).map(c => {
  const n = Number(c.score != null ? c.score : c.contribution) || 0;
  const contrib = Number(c.contribution || 0);
  const w = Number(c.axis_weight || c.weight || ((CFG.engineWeights || {})[c.axis]) || 0);
  const col = n >= 65 ? 'var(--sec)' : n >= 45 ? 'var(--gold2)' : 'var(--red2)';
  return '<div class="si-c-row">' +
  '<div class="si-c-n">' + (c.name || AXIS_LABELS[c.axis] || c.axis || '—') + '</div>' +
  '<div class="si-c-t"><i style="width:' + Math.max(0, Math.min(100, n)) + '%;background:' + col + '"></i></div>' +
  '<div class="si-c-v" style="color:' + col + '">' + Math.round(n) + '</div>' +
  '<div class="si-c-w">وزن ' + (w || '—') + '% · ساهم بـ ' + contrib.toFixed(1) + '</div>' +
  '</div>';
  }).join('')}
  </div>
  </div>` : ''}

  ${exRaw && exRaw.adjustments && exRaw.adjustments.length ? `
  <div class="si-sect">
  <div class="si-sect-h">✂️ الخصومات اللي اتطبقت</div>
  <div class="si-facts">
  ${exRaw.adjustments.slice(0, 8).map(a => {
  const t = a.type || a.name || a.reason || 'خصم';
  const v = Number(a.value || 0);
  const w = a.why || a.text || '';
  return '<div class="si-fact neg"><span class="fi">✂️</span><div><b>' + t + '</b> ' +
  (v ? '<b style="color:var(--red2)">(' + (v > 0 ? '−' : '+') + Math.abs(v).toFixed(1) + ')</b>' : '') +
  (w ? '<br><span style="opacity:.8;font-size:.92em">' + w + '</span>' : '') + '</div></div>';
  }).join('')}
  </div>
  </div>` : ''}

  ${exRaw && exRaw.what_could_change_score && exRaw.what_could_change_score.length ? `
  <div class="si-sect">
  <div class="si-sect-h">🔄 إيه اللي ممكن يغيّر التقييم؟</div>
  <div class="si-facts">
  ${exRaw.what_could_change_score.slice(0, 6).map(t =>
  '<div class="si-fact neu"><span class="fi">🔄</span><div>' +
  (typeof t === 'string' ? t : (t.text || t.what || t.condition || String(t))) + '</div></div>').join('')}
  </div>
  </div>` : ''}

  ${exRaw && exRaw.missing_data && exRaw.missing_data.length ? `
  <div class="si-sect">
  <div class="si-sect-h">⛔ بيانات ناقصة (بتأثر على النتيجة)</div>
  <div class="si-facts">
  ${exRaw.missing_data.slice(0, 6).map(m =>
  '<div class="si-fact inv"><span class="fi">⛔</span><div>' +
  (typeof m === 'string' ? m : (m.field || m.axis || m.name || String(m))) + '</div></div>').join('')}
  </div>
  </div>` : ''}

  <div class="si-why">

  <div class="si-why-h">💡 ليتم قيّمنا السهم كده؟</div>
  <div class="si-facts">
  ${pos || '<div class="si-fact neu"><span class="fi">—</span><div>لا توجد إيجابيات واضحة</div></div>'}
  ${neg || '<div class="si-fact neu"><span class="fi">—</span><div>لا توجد سلبيات واضحة</div></div>'}
  </div>
  </div>
  ${chg || inv ? `
  <div class="si-sect" style="margin-top:16px">
  <div class="si-sect-h">🔄 إيه اللي ممكن يغيّر التقييم؟</div>
  <div class="si-facts">${chg}${inv}</div>
  </div>` : ''}
  ${missing}
  </div>

  <!-- PANEL: NEWS -->
  <div class="si-panel" id="si-p-news">
  <div class="si-sect">
  <div class="si-sect-h">📰 أخبار السهم <small>من مصادر إخبارية عربية — تتحدث لحظياً</small></div>
  <div class="si-live" id="siLiveNews"><div class="si-load2">⏳ جاري البحث عن أخبار…</div></div>
  </div>
  <div class="si-sect">
  <div class="si-sect-h">📋 الإفصاحات الرسمية <small>من إعلانات البورصة المصرية</small></div>
  ${stockNews.length ? `<div class="si-news">${stockNews.map(a => `
  <div class="si-news-item ${a.status === 'upcoming' ? 'upcoming' : ''}">
  <div class="si-news-date">${a.distributionDate || a.date || '—'}</div>
  <div class="si-news-title">${a.kindAr || a.kind || 'حدث'}${a.value ? ' بقيمة ' + a.value + ' ج.م' : ''}</div>
  <div class="si-news-meta">
  <span>النوع: ${a.kind || '—'}</span>
  <span>الحالة: ${a.status === 'upcoming' ? 'قادم' : 'مؤكد'}</span>
  ${a.yieldPct ? `<span>العائد: ${a.yieldPct}%</span>` : ''}
  <span class="si-news-src">المصدر: إعلانات البورصة الرسمية (foudalens)</span>
  </div>
  </div>`).join('')}</div>`
  : '<div class="si-empty">لا توجد أحداث معلنة حالياً لهذا السهم.<br>المصدر: إعلانات البورصة الرسمية — يتم تحديثها كل 6 ساعات.</div>'}
  </div>
  <div class="si-sect">
  <div class="si-sect-h">📅 أقرب التوزيعات على مستوى السوق</div>
  <table class="mini-table"><thead><tr><th>التاريخ</th><th>الشركة</th><th>القيمة</th><th>العائد</th></tr></thead><tbody>
  ${((news.actions||[]).filter(a => a.status === 'upcoming').slice(0,8).map(a =>
  `<tr onclick="openStockModal('${a.code}')"><td>${a.distributionDate || a.date}</td><td>${a.code} — ${(a.nameAr||'').slice(0,16)}</td><td>${a.value||'—'}</td><td>${a.yieldPct||'—'}%</td></tr>`).join(''))}
  </tbody></table>
  </div>
  </div>

  <!-- PANEL: ORDER BOOK -->
  <div class="si-panel" id="si-p-book">
  <div class="si-sect">
  <div class="si-sect-h">📊 عمق السوق والتنفيذات <small>دفتر الأوامر — يتحدث كل ثانية</small></div>
  <div id="obMount"></div>
  </div>
  </div>

  <!-- PANEL: RISK -->
  <div class="si-panel" id="si-p-risk">
  <div class="si-sect">
  <div class="si-sect-h">⚠️ أهم المخاطر <small>${rk.risk_level || ''} — أمان ${rk.safety_score || 0}/100</small></div>
  <div class="si-facts">${risks || '<div class="si-fact neu"><span class="fi">✅</span><div>لا توجد مخاطر بارزة</div></div>'}</div>
  </div>
  <div class="si-sect">
  <div class="si-sect-h">📊 تفصيل المخاطر</div>
  <table class="mini-table"><tbody>
  ${Object.entries(rk.breakdown || {}).map(([k,v]) =>
  `<tr><td>${k}</td><td><b style="color:${v>15?'var(--red2)':v>8?'#ff9800':'var(--gold)'}">${v}</b></td></tr>`).join('')}
  </tbody></table>
  </div>
  </div>
  `;

  // شارت TradingView
  renderSiChart();
}

function siTab(btn, name) {
  // شغّل تحميل الأخبار أول ما المستخدم يفتح التبويب (مرة واحدة)
  if (name === 'book') { initObPanel(); startOb(); }
  if (name === 'news') loadStockNews(SI_CODE, (SI_DATA.intel||{}).name || (SI_DATA.intel||{}).sector);
  document.querySelectorAll('.si-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.si-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('si-p-' + name).classList.add('active');
}

function renderSiChart() {
  /* 🐙 19 أكتوبر 2026 — توحيد: نضع نفس الـheader (الاسم+الرمز+السعر+النسبة) inline
     ثم الشارت مباشرة في نفس الصفحة (مش مودال منفصل).
     أحمد: «ليه مش بتظهر الشارت نفسه بنفس الطريقة اللى اتفقنا عليه على طول». */
  const box = document.getElementById('si-tv-chart');
  if (!box) return;
  const code = SI_CODE || '—';
  const name = (SI_DATA.intel || {}).name || code;
  const sym = 'EGX:' + code;
  const intel = SI_DATA.intel || {};
  const price = (intel.price || 0).toFixed(2);
  const chg = (intel.change || 0).toFixed(2);
  const chgCls = chg > 0 ? 'up' : chg < 0 ? 'down' : 'flat';
  const chgSign = chg > 0 ? '▲ +' : chg < 0 ? '▼ ' : 'ـ ';
  const tradingViewUrl = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(sym);
  box.innerHTML = `
  <div class="ocm-head" style="margin-bottom:10px">
    <div class="ocm-row1">
      <span class="ocm-title">${name} 📈</span>
      <span class="ocm-code">${sym}</span>
      <span class="ocm-price"><span>${price} EGP</span><span class="ocm-change ${chgCls}">${chgSign}${chg}%</span></span>
    </div>
    <div class="ocm-row2">
      <button class="ocm-close" type="button" onclick="if(typeof closeIntel==='function')closeIntel();else if(typeof closeStock==='function')closeStock();else history.back()" aria-label="رجوع">✕</button>
      <a class="ocm-fs" href="${tradingViewUrl}" target="_blank" rel="noopener noreferrer" aria-label="افتح في TradingView" title="افتح في TradingView (الرسم الكامل)">⛶</a>
    </div>
  </div>
  <div id="siChartHost" style="height:420px"></div>
  <div class="tvbar" style="margin-top:8px;display:flex;gap:8px;align-items:center">
    <a class="btn main" href="${tradingViewUrl}" target="_blank" rel="noopener noreferrer" style="flex:1;padding:11px 14px">⛶ افتح في TradingView (الرسم الكامل)</a>
  </div>`;
  /* تحميل الشارت من نفس المصدر الموحد (tv-shim.js) */
  setTimeout(function () {
    var host = document.getElementById('siChartHost');
    if (!host || !window.OCTA_TV) return;
    window.OCTA_TV.whenSized(host, function () {
      window.OCTA_TV.mount(host, { symbol: sym, interval: '1D' });
    });
  }, 100);
}

let siChartRes = 'D';
function siTf(btn, res) {
  siChartRes = res;
  document.querySelectorAll('#siTf button').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  siChart(res);
}

function siChart(res) {
  const host = document.getElementById('siChartHost');
  if (!host) return;
  /* ✅ 19 أكتوبر 2026 — نفس مصدر الرسومات الوحيد (tv-shim.js).
     ⛌ القديم: s3.tradingview.com/tv.js → widget بيتولد ناقص ويفضل فاضي. */
  const sym = 'EGX:' + (window.SI_CODE || '');
  const paint = () => {
    try {
      window.OCTA_TV.mount(host, {
        symbol: sym, interval: res || '1D', link: false, minHeight: 360
      });
    } catch (e) {
      host.innerHTML = '<div class="si-empty">تعذر تحميل الرسم البياني</div>';
    }
  };
  if (window.OCTA_TV && window.OCTA_TV.whenSized) window.OCTA_TV.whenSized(host, paint);
  else paint();
}

/* ══════════ REDUNDANCY AUDIT ══════════ */
async function openAudit() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  ['armView','stockPage','intelPage','dashPage'].forEach(id =>
  document.getElementById(id)?.style.setProperty('display','none','important'));
  document.getElementById('auditPage').style.display = 'block';
  document.getElementById('audLoad').style.display = 'block';
  document.getElementById('audContent').style.display = 'none';
  document.querySelectorAll('.arm-btn').forEach(b => b.classList.remove('active'));
  window.scrollTo({top:0, behavior:'smooth'});

  try {
  const d = await octaFetch(OCTA_API + '/api/audit/redundancy').then(r => r.json());
  const s = d.summary || {};
  const sim = d.axis_similarity || {};
  const cr = d.score_crowding || {};

  let html = `
  <div class="aud-hero">
  <h2>🔍 تقرير التكرار — قبل إعادة التصميم</h2>
  <p>الفحص بيقول إيه المتكرر في الواجهة والبيانات. استخدمه كخريطة طريق.</p>
  </div>

  <div class="aud-sect">
  <div class="aud-h">📊 ملخص البيانات</div>
  <div class="arm-stats">
  <div class="arm-stat"><div class="as-v">${s.stocks||0}</div><div class="as-l">سهم</div></div>
  <div class="arm-stat"><div class="as-v">${s.score_spread||0}</div><div class="as-l">مدى النتائج</div></div>
  <div class="arm-stat"><div class="as-v">${s.median_score||0}</div><div class="as-l">النتيجة الوسطى</div></div>
  <div class="arm-stat"><div class="as-v">${s.stocks_in_median_band||0}</div><div class="as-l">في نفس الشريحة</div></div>
  <div class="arm-stat"><div class="as-v">${s.decision_dominance_pct||0}%</div><div class="as-l">${s.dominant_decision||'—'}</div></div>
  </div>
  </div>

  <div class="aud-sect">
  <div class="aud-h">⚠️ تكرار الواجهة <small>نفس المحتوى في أماكن كتير</small></div>
  ${(d.ui_redundancy||[]).map(r => `
  <div class="aud-item ${r.severity}">
  <div class="aud-item-t">${r.item}
  <span class="aud-sev ${r.severity}">${r.severity==='high'?'عالي':r.severity==='medium'?'متوسط':'منخفض'}</span>
  <span class="aud-sev low">×${r.count}</span>
  </div>
  <div class="aud-locs">${r.appears_in.map(l=>`<span class="aud-loc">${l}</span>`).join('')}</div>
  <div class="aud-fix">💡 ${r.fix}</div>
  </div>`).join('')}
  </div>

  <div class="aud-sect">
  <div class="aud-h">🔄 محاور بنفس المتوسط <small>ممكن تكون نفس البيانات</small></div>
  ${Object.entries(sim.averages||{}).map(([k,v]) => `
  <div class="aud-bar-row">
  <span class="aud-bar-l">${k}</span>
  <div class="aud-bar-t"><div class="aud-bar-f" style="width:${Math.min(100,(v||0))}%"></div></div>
  <span class="aud-bar-v">${v}</span>
  </div>`).join('')}
  ${(sim.similar_pairs||[]).length ? `
  <div style="margin-top:12px;font-size:.84rem;color:#ff9800">
  ⚠️ أزواج متشابهة: ${sim.similar_pairs.map(p=>`${p.a} ↔ ${p.b} (${p.diff})`).join(' • ')}
  </div>` : '<div style="color:var(--sec);font-size:.84rem">✅ مفيش محاور متشابهة</div>'}
  </div>

  <div class="aud-sect">
  <div class="aud-h">📊 ازدحام النتائج</div>
  <div class="arm-stats">
  <div class="arm-stat"><div class="as-v">${cr.bands_with_20plus||0}</div><div class="as-l">شريحة مزدحمة</div></div>
  <div class="arm-stat"><div class="as-v">${cr.worst_band||'—'}</div><div class="as-l">أسوأ شريحة</div></div>
  <div class="arm-stat"><div class="as-v">${cr.worst_band_count||0}</div><div class="as-l">سهم فيها</div></div>
  </div>
  <div style="font-size:.8rem;color:var(--muted);margin-top:8px">${cr.note||''}</div>
  </div>

  <div class="aud-sect">
  <div class="aud-h">✅ خطة الإصلاح</div>
  <ol style="font-size:.88rem;line-height:2.2;color:var(--txt)">
  ${(d.recommendations||[]).map(r=>`<li>${r}</li>`).join('')}
  </ol>
  </div>`;

  document.getElementById('audContent').innerHTML = html;
  document.getElementById('audLoad').style.display = 'none';
  document.getElementById('audContent').style.display = 'block';
  } catch (e) {
  document.getElementById('audLoad').innerHTML = '<div style="color:var(--red2);padding:40px">❌ تعذر التحميل</div>';
  }
}

/* ════════════════════════════════════════════════════════════
  SMART SEARCH — مستقل <span class="flt-ltr">100%</span>
  ════════════════════════════════════════════════════════════ */

let SS_ALL = [];
let SS_LOADING = false;
let SS_SEL = -1;
let SS_FILTERED = [];

/** يجيب كل الأسهم مرة واحدة ويخزّنها */
async function initStockSearch() {
  if (SS_ALL.length || SS_LOADING) return;
  SS_LOADING = true;
  const urls = [
  OCTA_API + '/api/rank?limit=252',
  OCTA_API + '/api/prices',
  ];
  for (const u of urls) {
  try {
  const r = await fetch(u);
  if (!r.ok) continue;
  const d = await r.json();
  const st = d.results || d.egx30 || d.stocks || (Array.isArray(d) ? d : []);
  if (st && st.length) {
  const dbg = document.getElementById('ssDebug');
  SS_ALL = st.map(s => ({
  code: s.code,
  name: s.name || s.nameAr || s.code,
  price: Number(s.price || 0),
  change: Number(s.change || 0),
  sector: s.sector || '',
  }));
  console.log('✅ search loaded:', SS_ALL.length, 'stocks');
  if (dbg) dbg.textContent = '✅ ' + SS_ALL.length + ' سهم جاهز للبحث';
  break;
  }
  } catch (e) { /* try next */ }
  }
  SS_LOADING = false;
  if (!SS_ALL.length) console.warn('⚠️ search: no stocks loaded');
}

function renderSearchUI() {
  return `<div class="smart-search">
  <div class="ss-input-wrap">
  <span class="ss-ico">🔍</span>
  <input class="ss-input" id="ssInput" type="text"
  placeholder="اكتب رمز أو اسم السهم — مثال: بنك أو COMI"
  autocomplete="off" oninput="ssSearch(this.value)" onkeydown="ssKey(event)">
  <span class="ss-hint">اكتب حرف</span>
  </div>
  <div class="ss-results" id="ssResults"></div>
  <div id="ssDebug" style="font-size:.68rem;color:var(--muted);margin-top:6px"></div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
 🛡️ ⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐ escaping للمدخلات في innerHTML
 ────────────────────────────────────────────────────────────────
 📌 المشكلة: `q` (اللي المستخدم كتبه في البحث) كان بينزل
 📌 ⛔⛔⛔ في innerHTML **من غير escape** ⬇️
 📌 ⛔⛔⛔   box.innerHTML = `... لا توجد نتائج لـ "${q}" ...`
 📌 ⛔⛔⛔ ⇒ `<img src=x onerror=alert(1)>` في حقل البحث ⬇️
 📌 ⛔⛔⛔ ⇒ ينفّذ كود.
 📌 📌 التصنيف: **self-XSS** (المستخدم لازم يكتب Payload بنفسه)
 📌 📌 ⛌⛌⛌ ⇒ مش reflected من URL ⇒ مش ثغرة استغلال عن بُعد.
 📌 📌 ⛌⛌⛌ ⇒ بس: لوجو/خط/امتداد في المتصفح ممكن يحقنPayload،
 📌 📌 ⛌⛌⛌   وكمان defense-in-depth: أي نص ييجي من المستخدم
 📌 📌 ⛌⛌⛌   لازم يتهرب قبل ما يدخل innerHTML.
 📌 ✅ الحل: نستخدم textContent (أأمن) مش string concatenation.
 ══════════════════════════════════════════════════════════════ */
function ssEsc(s) {
  return String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function ssSearch(q) {
  q = String(q || '').trim();
  const box = document.getElementById('ssResults');
  if (!box) return;

  if (!q) { box.classList.remove('open'); SS_SEL = -1; return; }
  if (!SS_ALL.length) await initStockSearch();

  const up = q.toUpperCase();
  SS_FILTERED = SS_ALL.filter(s =>
  (s.code || '').toUpperCase().includes(up) ||
  (s.name || '').toUpperCase().includes(up) ||
  (s.sector || '').includes(q)
  ).slice(0, 25);

  if (!SS_FILTERED.length) {
  /* ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — الـq اتهرب قبل ما يدخل الـHTML.
     ⛌⛌⛌ قبل: `${q}` خام ⬇️ ⛌⛌⛌ دلوقتي: `ssEsc(q)`. */
  box.innerHTML = `<div class="ss-empty">لا توجد نتائج لـ "${ssEsc(q)}"<br>
  <span style="font-size:.74rem;opacity:.7">${SS_ALL.length} سهم في قاعدة البيانات</span></div>`;
  box.classList.add('open');
  return;
  }

  box.innerHTML = SS_FILTERED.map((s, i) => {
  const c = s.change || 0;
  const col = c > 0 ? 'var(--sec)' : (c < 0 ? 'var(--red2)' : 'var(--muted)');
  /* ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐ الـcode والـname جايين من الـAPI.
     ⛌⛌⛌ قبل: `${s.code}` و `${s.name}` خام ⬇️
     ⛌⛌⛌ ⇒ لو الـAPI رجّع اسم فيه HTML ⇒ XSS.
     ⛌⛌⛌ دلوقتي: ssEsc() على كل قيمة نصية.
     ⛌⛌⛌ (الأرقام والـindex آمنين — p是真 رقم). */
  return `<div class="ss-row" data-i="${i}" onclick="event.stopPropagation(); ssPick(${i})">
  <div class="ss-badge">${ssEsc((s.code||'').slice(0,2))}</div>
  <div class="ss-info">
  <div class="ss-code">${ssEsc(s.code)}</div>
  <div class="ss-name">${ssEsc((s.name||'').slice(0,30))}</div>
  </div>
  <div class="ss-price">
  <div class="ss-p" style="color:${col}">${Number(s.price).toFixed(2)}</div>
  <div class="ss-c" style="color:${col}">${c>=0?'+':''}${Number(c).toFixed(2)}%</div>
  </div>
  </div>`;
  }).join('');
  box.classList.add('open');
  SS_SEL = -1;
}

function ssKey(e) {
  const box = document.getElementById('ssResults');
  if (!box || !box.classList.contains('open')) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); SS_SEL = Math.min(SS_SEL + 1, SS_FILTERED.length - 1); ssHi(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); SS_SEL = Math.max(SS_SEL - 1, 0); ssHi(); }
  else if (e.key === 'Enter') {
  e.preventDefault();
  const i = SS_SEL >= 0 ? SS_SEL : 0;
  if (SS_FILTERED[i]) ssPick(i);
  }
  else if (e.key === 'Escape') { box.classList.remove('open'); }
}

function ssHi() {
  document.querySelectorAll('.ss-row').forEach((r, i) => r.classList.toggle('sel', i === SS_SEL));
  const s = document.querySelector('.ss-row.sel');
  if (s) s.scrollIntoView({ block: 'nearest' });
}

function ssPick(i) {
  const s = SS_FILTERED[i];
  if (!s) return;
  const box = document.getElementById('ssResults');
  if (box) box.classList.remove('open');
  const inp = document.getElementById('ssInput');
  if (inp) { inp.value = ''; inp.placeholder = s.code + ' — ' + (s.name || '').slice(0, 24); }
  try {
  openStock(s.code);
  } catch (e) {
  console.error('openStock FAILED:', e);
  const el = document.getElementById('siLoad');
  if (el) {
  const sp = document.getElementById('stockPage');
  sp.style.removeProperty('display');
  sp.style.setProperty('display', 'block', 'important');
  sp.classList.add('active');
  el.innerHTML = '<div style="color:var(--red2);padding:30px;text-align:center">' +
  '❌ خطأ: ' + (e.message || 'غير معروف') + '</div>';
  }
  }
}

document.addEventListener('click', e => {
  const box = document.getElementById('ssResults');
  const wrap = document.querySelector('.smart-search');
  if (box && wrap && !wrap.contains(e.target)) box.classList.remove('open');
});

// تحميل مسبق — أول ما الصفحة تفتح
document.addEventListener('DOMContentLoaded', () => setTimeout(initStockSearch, 800));


/* ══════════ COLLAPSIBLE INFO CARD ══════════ */
function ic(icon, title, desc, stats, more, badge) {
  return `<div class="ic" onclick="icToggle(this)">
  ${badge ? '<div class="ic-badge">'+badge+'</div>' : ''}
  <span class="ic-ico">${icon}</span>
  <div class="ic-t">${title}</div>
  <div class="ic-d">${desc}</div>
  ${stats ? '<div class="ic-stat">'+stats+'</div>' : ''}
  <div class="ic-more">${more || ''}</div>
  </div>`;
}

function icToggle(el) {
  const wasOpen = el.classList.contains('open');
  // نقفل كل الكروت
  el.parentElement?.querySelectorAll('.ic.open').forEach(c => c.classList.remove('open'));
  if (!wasOpen) el.classList.add('open');
}

function icRows(list, valKey) {
  if (!list || !list.length) return '<div class="ss-empty">لا توجد بيانات</div>';
  return '<div class="ic-rows">' + list.slice(0,12).map(s => {
  const c = s.change || 0;
  return `<div class="ic-row" onclick="event.stopPropagation(); openStock('${s.code}')">
  <span class="r-c">${s.code}</span>
  <span class="r-n">${(s.name||'').slice(0,20)}</span>
  <span class="r-s">${s.score ?? '—'}</span>
  <span class="r-x ${c>=0?'pos':'neg'}">${c>=0?'+':''}${c.toFixed(1)}%</span>
  </div>`;
  }).join('') + '</div>';
}

/* ═══ v8: افتح على ذراع السوق افتراضياً ═══
   ⛔⛔⛔ كان هنا:
        document.addEventListener('DOMContentLoaded', () =>
          setTimeout(() => openArm('market'), 300));
   ⛔ الرقم ٣٠٠ ده كان **Mandatory overwrite** — أي صفحة اترجعت
   من الريفريش كانت بتتدمّر بعد ٣٠٠ مللي وت-user يشوف الرئيسية.
   ⛔ ده السبب الجذري الحقيقي لشكوى أحمد، مش الحفظ.
   ✅ الشاشة الرئيسية دلوقتي جزء من OS_NAV.restore() — بتشتغل
   بس لو مفيش صفحة محفوظة، وبنفس ترتيب الاسترجاع نفسه. */

/* ════════════════════════════════════════════════════════════
  v8 FIX — حذف المحتوى القديم من الـ DOM
  المشكلة: الـ CSS بيخفي بـ display:none، بس الـ JS بيرجّعه
  الحل: نحذفه نهائياً من الـ DOM
  ════════════════════════════════════════════════════════════ */
(function killLegacyHome() {
  /* ═══ صفحات الأدوات/الفلاتر — لازم نجيبها من الموت مع المحتوى القديم ═══ */
  const KEEP = ['filter','best','screener','dividends','compare','calc','academy','bestpick','news','search','engine','arms','markets','stocks','intel','dash','octasearch','verdict','pick','money','radar','radar-stock'];
  function rescueToolPages(old) {
  let host = document.getElementById('toolPagesHost');
  if (!host) {
  host = document.createElement('div');
  host.id = 'toolPagesHost';
  old.parentNode.insertBefore(host, old);
  }
  /* 🧭⛔⛔ بوجعة ثالثة كانت بتمسح الصفحة بعد الريفريش.
  الترحيل ده حركة عناصر بس، لكنه كان بينضف `.active` من كل صفحة
  و*bنفترض* إن مفيش صفحة شغّالة لسه وقت النقل.
  النتيجة: لو الاسترجاع حصل قبل الترحيل بـ١٠ مللي،
  الصفحة بترجع… وبعدها بتتمسح في نفس اللحظة.
  ✅ الحل: نحفظ مين الشغّال قبل النقل ونرجّعه بعده —
  النقل مايتغيّرش من حالة الصفحة. */
  let active = null;
  for (let i = 0; i < KEEP.length; i++) {
  const q = document.getElementById('page-' + KEEP[i]);
  if (q && q.classList.contains('active')) { active = q; break; }
  }
  KEEP.forEach(id => {
  const p = document.getElementById('page-' + id);
  if (p && p.parentNode === old) { p.classList.remove('active'); host.appendChild(p); }
  });
  /* ⛔⛔⛔ عناصر مش صفحات أدوات — الـid بتاعها مش page-*
     فكانت بتتمسح مع homeHidden وبتخسر وظيفتها بالكامل:
     · intelPage   → صفحة «التحليل الكامل» وفيها تبويبات الاستراتيجيات
     · dashPage    → «لوحة التحكم»
     · modalOverlay→ مودال السهم
     · decideModal → مودال كارت القرار
     الحل: ننقلهم للـhost قبل ما نحذف old. */
  ['intelPage', 'dashPage', 'modalOverlay', 'decideModal'].forEach(id => {
  const el = document.getElementById(id);
  if (el && old.contains(el)) { el.classList.remove('active'); host.appendChild(el); }
  });
  if (active && active.parentNode === host) active.classList.add('active');
  return host;
  }

  function doKill() {
  const old = document.getElementById('homeHidden');
  if (old && !old.dataset.killed) {
  old.dataset.killed = '1';
  // نحذف كل المحتوى جوه — بس نسيب الـ ticker
  const ticker = old.querySelector('.ticker-zone') || old.querySelector('#tickerView');
  if (ticker) {
  const holder = document.createElement('div');
  holder.id = 'tickerHolder';
  old.parentNode.insertBefore(holder, old);
  holder.appendChild(ticker);
  }
  rescueToolPages(old);
  old.remove();  // ← حذف نهائي
  console.log('✅ v8: legacy home removed · tool pages rescued');
  }
  }
  if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', doKill);
  } else {
  doKill();
  }
  // احتياطي: بعد 200ms و 800ms
  setTimeout(doKill, 200);
  setTimeout(doKill, 800);
})();

/* ══════ GLOBAL ASSETS — صف بعرض زي المؤشرات المصرية ══════ */
const GA_WANT = [
  { id:'tk-gold',  n:'🥇 XAU/USD' },
  { id:'tk-oil',  n:'🛢️ US Oil'  },
  { id:'tk-spx',  n:'🇺🇸 S&P 500' },
  { id:'tk-nasdaq', n:'💻 Nasdaq'  },
];

function renderGlobalAssets(ticker) {
  const map = {}; const seen = new Set();
  for (const t of (ticker||[])) { if (!seen.has(t.id)) { seen.add(t.id); map[t.id] = t; } }
  return '<div class="ticker-row-scroll" style="grid-template-columns:repeat(4,1fr)">' +
  GA_WANT.map(w => {
  const t = map[w.id];
  if (!t) return `<div class="tk-mini" style="--tc:#64748b">
  <div class="tkm-n">${w.n}</div>
  <div class="tkm-v">—</div><div class="tkm-c">—</div></div>`;
  const c = Number(t.change || 0);
  const col = c > 0.05 ? '#22c55e' : (c < -0.05 ? '#ef4444' : '#94a3b8');
  return `<div class="tk-mini" style="--tc:${col}">
  <div class="tkm-n">${w.n}</div>
  <div class="tkm-v">${Number(t.value||0).toLocaleString('en-US',{maximumFractionDigits:2})}</div>
  <div class="tkm-c" style="color:${col}">${c>=0?'▲ +':'▼ '}${c.toFixed(2)}%</div>
  </div>`;
  }).join('') + '</div>';
}


/* ══════ BULL vs BEAR — مضغوط بنفس حجم التيكر ══════ */
function renderBullBear(dash, ticker) {
  const map = {}; const seen = new Set();
  for (const t of (ticker||[])) { if (!seen.has(t.id)) { seen.add(t.id); map[t.id] = t; } }
  const dec = dash.decisions || {};
  const aa = dash.axis_average || {};
  const total = Object.values(dec).reduce((a,b)=>a+b,0) || 1;
  const bulls = (dec['إشارة إيجابية']||0) + (dec['إشارة محايدة']||0) * 0.5;
  const bears = (dec['إشارة سلبية']||0) + (dec['غير كافٍ']||0) * 0.3 + (dec['إشارة سلبية']||0) * 0.7;
  const sentimentPart = (bulls - bears) / total;
  const pricePart = ((aa.final || 50) - 50) / 50;
  const safetyPart = ((aa.safety || 50) - 50) / 50;
  const composite = sentimentPart * .50 + pricePart * .30 + safetyPart * .20;
  const gauge = Math.round(Math.max(2, Math.min(98, 50 + composite * 48)));
  const state = gauge >= 58 ? 'bull' : (gauge <= 42 ? 'bear' : 'neutral');
  const label = state === 'bull' ? 'صاعد 🐂' : (state === 'bear' ? 'هابط 🐻' : 'محايد ⚖️');
  const sub = state === 'bull' ? 'شهية مخاطرة عالية' : (state === 'bear' ? 'الحذر يغلب' : 'السوق متردد');

  const markerPos = ((gauge - 2) / 96 * 100).toFixed(1);
  return `<div class="bb-strip">
  <div class="bbs-side ${state==='bull'?'bull':(state==='bear'?'bear':'dim')}">
  <div class="bbs-animal">🐻</div><div class="bbs-txt">BEAR</div>
  </div>
  <div class="bbs-mid">
  <div class="bbs-row">
  <div class="bbs-gauge ${state}">${gauge}</div>
  <div class="bbs-info">
  <div class="bbs-v ${state}">${label}</div>
  <div class="bbs-s">${sub} — مؤشر السوق العام</div>
  <div class="bbs-scalebar"><div class="bbs-marker" style="left:${markerPos}%"></div></div>
  </div>
  </div>
  </div>
  <div class="bbs-side ${state==='bull'?'bull':(state==='bear'?'dim':'bear')}">
  <div class="bbs-animal">🐂</div><div class="bbs-txt">BULL</div>
  </div>
  </div>`;
}
/* ══════════════════════════════════════════════════════════════
  🔄 إعادة الرسم لما الأوزان توصل
  ──────────────────────────────────────────────────────────────
  ⛔ الأوزان بقت من /api/engine-weights (محمي).
  ⛌ ف.card القرار اتحسب أول مرة بأوزان فاضية — لازم نعيد حسابه.
  ══════════════════════════════════════════════════════════════ */
document.addEventListener('octa:weights', function () {
  setTimeout(function () {
    try {
      if (V_TIMER) { clearInterval(V_TIMER); V_TIMER = null; }
      if (typeof vLoadCard === 'function') vLoadCard(true);
    } catch (e) { }
  }, 200);
});

window.octaWeightsReady = function () { /* استدعاء من octa-config.js */ };
