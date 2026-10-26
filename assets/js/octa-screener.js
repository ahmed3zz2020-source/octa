/* ══════════════════════════════════════════════════════════════
  🔍 Stock Screener v5 — فلاتر TradingView الحقيقية
  ------------------------------------------------------------
  كل الأعمدة من TradingView scanner مباشرة:
  Valuation · Profitability · Leverage · Dividends · Technical
  Performance · Liquidity · Growth
  ══════════════════════════════════════════════════════════════ */

(function () {

  /* ══════════════ حالة الفلترة ══════════════ */
  const S = {
  q: '', sect: 'all',
  /* تقييم */
  peMax: null, peMin: null, pbMax: null,
  /* ربحية */
  roeMin: null, roaMin: null, roicMin: null,
  nmMin: null, omMin: null, gmMin: null,
  /* رافعة وسيولة */
  deMax: null, crMin: null, qrMin: null,
  /* توزيعات */
  dyMin: null, payoutMax: null,
  /* فنية */
  rsiMin: null, rsiMax: null,
  ma200: null,  /* above | below */
  macd: null,  /* above | below */
  /* أداء */
  p1mMin: null, p3mMin: null, p6mMin: null, p1yMin: null, pYtdMin: null,
  /* سيولة */
  volMin: null, mcMin: null,
  /* حجم traded */
  valMin: null,
  /* توصية TV */
  tv: null,
  sort: 'mc', dir: -1, shown: 40,
  /* OCTA */
  oScoreMin: null, oConfMin: null, oMddMax: null, oVolMax: null,
  oSharpeMin: null, oCagrMin: null, oRoicMin: null, oFcfMin: null, oVerdict: null,
  mode: 'tv',  /* tv | octa */
  lvl: 'start',  /* start | mid | pro | inst */
  live: false,  /* التحديث اللحظي شغّال؟ */
  lastQ: null,  /* آخر وقت تحديث */
  mkt: null, mktT: null, /* حالة السوق */
  live: false,  /* التحديث اللحظي شغّال؟ */
  lastQ: null,  /* آخر وقت تحديث */
  mkt: null, mktT: null, /* حالة السوق */
  advOpen: false, aboutOpen: false, grp: 'all', grpO: 'qual',
  preset: null   /* ⭐ اسم الـpreset المطبّق (null = مفيش) */
  };

  const MARKS = [
  { id: 'egypt', i: '🇪🇬', n: 'بورصة مصر', cur: 'ج' },
  { id: 'us', i: '🇺🇸', n: 'أمريكا', cur: '$' },
  { id: 'saudi', i: '🇸🇦', n: 'السعودية', cur: 'ر' },
  { id: 'uae', i: '🇦🇪', n: 'الإمارات', cur: 'د' }
  ];
  let M = MARKS[0];
  let MK = null;
  /* ══════════════════════════════════════════════════════════════
  🗂️ مصدر البيانات — EGX_DB (الغني) — ٢٥ أكتوبر ٢٠٢٦
  ────────────────────────────────────────────────────────────────
  📌 ⛔ المشكلة: الفلتر كان بيقرا `/api/markets` — وده **مضغوط**:
  📌   فيه السعر والتغيير والمحاور، بس **مفيش** الأساسيات
  📌   (ROE · P/E · صافي ربح · هامش · ROIC · شارب · CAGR · هبوط).
  📌   ⇒ ٩ أعمدة كانت بتطلع «—» لكل ٢٨٤ سهم.
  📌 ✅ الحل: `EGX_DB` (من `/api/data_full` المحمي) فيه كل ده
  📌   + الدرجة + القرار — وهو نفس مصدر باقي الموقع.
  📌 ⛔ fallback: لو EGX_DB لسه ما اتحمّلش ⇒ /api/markets (أنضف).
  ══════════════════════════════════════════════════════════════ */
  function mkData() {
  if (MK) return MK;
  try {
  if (typeof EGX_DB !== 'undefined' && EGX_DB && Object.keys(EGX_DB).length) {
  MK = { egypt: EGX_DB };
  return MK;
  }
  } catch (e) { }
  try { if (typeof OCTA_MK !== 'undefined' && OCTA_MK) { MK = OCTA_MK; return MK; } } catch (e) { }
  return null;
  }

  /* ══════════════ أدوات ══════════════ */
  const N = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  function safe(v) {
  return String(v == null ? '' : v)
  .replace(/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF\u4e00-\u9fff\u0400-\u04FF\ufffd]/g, '')
  .replace(/\s{2,}/g, ' ').replace(/'/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  const esc = safe;
  /* ══════════════════════════════════════════════════════════════
  🔢 الأرقام العربية (٠١٢٣)
  ──────────────────────────────────────────────────────────────
  📌 النمط في المشروع: النصوص الساكنة (عناوين · شرح) بأرقام عربية،
  ⛌ والأرقام الحية (أسعار · درجات) بأرقام لاتينية عشان القراءة
  ⛌   السريعة للرقم Viva. السطر ده بيطبّق **العكس** على العدّادات
  ⛌   الكبيرة (عدد النتائج · الدرجة) — لأنها بتتقارن بالنص.
  ⛌ ⛌ ملاحظة: الأرقام اللاتينية جوّه جملة عربية لازم تفضل
  ⛌   <bdi> عشان ما تكسّرش ترتيب السطر.
  ══════════════════════════════════════════════════════════════ */
  const AR_D = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  function ar(v) {
  if (v == null || v === '') return '—';
  const s = String(v);
  let out = '';
  for (let i = 0; i < s.length; i++) {
  const c = s.charCodeAt(i);
  out += (c >= 48 && c <= 57) ? AR_D[c - 48] : s[i];
  }
  return out;
  }
  /* عدد + كلمة — زي «٧٨ سهم مطابق» */
  function arN(v, unit) { return '<bdi>' + ar(v) + '</bdi> ' + unit; }

  const f2 = v => N(v) != null ? Number(v).toFixed(2) : null;
  const f1 = v => N(v) != null ? Number(v).toFixed(1) : null;
  const f0 = v => N(v) != null ? Math.round(v) : null;
  const sg = v => N(v) != null ? (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%' : null;
  const sd = v => {  /* يوم واحد → 1.42 */
  if (N(v) == null) return null;
  if (v < 0) return null;
  return v < 1 ? (v * 100).toFixed(2) : v.toFixed(2);
  };
  function big(v) {
  if (N(v) == null) return null;
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return String(Math.round(v));
  }
  function dirCls(v) {
  if (v == null) return '';
  return v < 0 ? 'dn' : 'up';
  }

  function gq(s, keys, d) {
  for (let i = 0; i < keys.length; i++) {
  const v = s[keys[i]];
  if (v != null && v !== '' && !Number.isNaN(v)) return v;
  }
  return d;
  }
  /* ══════════════════════════════════════════════════════════════
  🗂️ تطبيع أسماء الحقول — ٢٥ أكتوبر ٢٠٢٦
  ────────────────────────────────────────────────────────────────
  📌 المشكلة: الـAPI (/api/markets) بيرجّع أسماء زي
  📌   `div_yield` · `de_ratio` · `mkt_cap` · `net_margin` · `confidence`
  📌 والواجهة بتقرأ `dy` · `de` · `mc` · `nm` · `conf`.
  📌 ⛔ النتيجة: أعمدة كاملة في الفلتر بتطلع «—» (فاضية).
  📌 ✅ الحل: نطبّع هنا مرة واحدة ⇒ باقي الكود يفضل زي ما هو.
  ══════════════════════════════════════════════════════════════ */
  const FIELD_ALIAS = {
  /* ⭐ أسماء EGX_DB (data_full) — دي الغنية */
  dy: ['dy', 'yield', 'div_yield'], de: ['de', 'de_ratio'], mc: ['mc', 'mkt_cap'],
  nm: ['nm', 'net_margin'], om: ['om', 'op_margin'], gm: ['gm', 'gross_margin'],
  roic: ['roic', 'roic'], mdd1y: ['mdd1y', 'mdd1y'], vol1y: ['vol1y', 'vol1y'],
  sharpe3y: ['sharpe3y', 'sharpe3y'], cagr3y: ['cagr3y', 'cagr3y'],
  cr: ['cr', 'current_ratio'], qr: ['qr', 'quick_ratio'],
  av30: ['av30', 'avgVol30', 'avg_volume_30d'],
  p1y: ['perf1y', 'perf_y', 'p1y'],
  p1m: ['perf1m', 'perf_1m', 'p1m'], p3m: ['perf3m', 'perf_3m', 'p3m'],
  p6m: ['perf6m', 'perf_6m', 'p6m'], pYtd: ['perfYtd', 'perf_ytd', 'pYtd'],
  p1w: ['perf1w', 'perf_w', 'p1w'], rel_volume: ['relvol', 'rel_volume'],
  revenue: ['rev', 'revenue'], sharpe: ['sharpe', 'sharpe3y'],
  ema20: ['ema20', 'ema20'],
  volatility: ['volatility', 'volatility'], upside: ['upside', 'upside'],
  roic: ['roic', 'roic'], cr: ['current_ratio', 'cr'], qr: ['quick_ratio', 'qr'],
  conf: ['conf', 'confidence'], total: ['total', 'score', 'final_score'],
  verdict: ['verdict', 'decision'], tvRec: ['tvRec', 'tv_rating'],
  perf1y: ['perf1y'], perf1m: ['perf1m'], perf3m: ['perf3m'], perf6m: ['perf6m'],
  ma50: ['ma50', 'sma50'], ma200: ['ma200', 'sma200'],
  av30: ['avg_volume_30d', 'av30'], volume: ['volume', 'vol'],
  p1w: ['perf_w', 'p1w'], p1m: ['perf_1m', 'p1m'], p3m: ['perf_3m', 'p3m'],
  p6m: ['perf_6m', 'p6m'], p1y: ['perf_y', 'p1y'], pYtd: ['perf_ytd', 'pYtd'],
  upside: ['upside', 'upside'], beta: ['beta', 'beta'],
  pb: ['pb', 'pb'], rel_volume: ['rel_volume', 'rel_volume'],
  volatility: ['volatility', 'volatility'], risk_level: ['risk_level', 'risk_level'],
  rsi: ['rsi', 'rsi'], eps: ['eps', 'eps'],
  sma50: ['sma50', 'sma50'], sma200: ['sma200', 'sma200'],
  ema20: ['ema20', 'ema20'], ema50: ['ema50', 'ema50'], ema200: ['ema200', 'ema200']
  };

  /* ⛔ نحسب الدرجة من المحاور لو مش موجودة */
  const AXIS_W = { fundamental: 22, technical: 18, liquidity: 18, risk: 24,
  news: 5, sentiment: 4, portfolio: 9 };

  function normalize(r) {
  if (!r || typeof r !== 'object') return r;
  const o = Object.assign({}, r);
  /* ⭐ EGX_DB بيستخدم أسماء مختلفة عن /api/markets */
  if (o.change == null && o.c != null) o.change = o.c;
  if (o.price == null && o.p != null) o.price = o.p;
  if (o.volume == null && o.v != null) o.volume = o.v;
  if (o.score == null && o.total != null) o.score = o.total;
  /* ⭐ EGX_DB: الدرجة في `score` والقرار في `decision` */
  if (o.total == null && o.score != null) o.total = o.score;
  if (!o.verdict && o.decision) o.verdict = o.decision;
  if (o.dy == null && o.yield != null) o.dy = o.yield;
  if (o.rel_volume == null && o.relvol != null) o.rel_volume = o.relvol;
  Object.keys(FIELD_ALIAS).forEach(function (k) {
  if (o[k] != null) return;
  const alt = FIELD_ALIAS[k];
  for (let i = 0; i < alt.length; i++) {
  if (o[alt[i]] != null) { o[k] = o[alt[i]]; break; }
  }
  });
  /* ⛔ الدرجة: `total` أو `score` أو محسوبة من `all_axes` */
  if (o.total == null && o.all_axes && typeof o.all_axes === 'object') {
  let sum = 0, w = 0;
  Object.keys(AXIS_W).forEach(function (a) {
  const v = o.all_axes[a];
  if (typeof v === 'number' && isFinite(v)) { sum += v * AXIS_W[a]; w += AXIS_W[a]; }
  });
  if (w > 0) o.total = Math.round(sum / w * 10) / 10;
  }
  /* ⛔ الأمان: من محور المخاطرة (risk أعلى = أمان أعلى) */
  if (o.safety == null && o.all_axes && typeof o.all_axes === 'object') {
  const rk = o.all_axes.risk;
  if (typeof rk === 'number' && isFinite(rk)) o.safety = Math.round(rk);
  }
  /* ⛔ القرار: من المحور الإيجابي */
  if (!o.verdict && o.all_axes && typeof o.all_axes === 'object') {
  const t = o.total;
  o.verdict = (t == null) ? '—'
  : t >= 65 ? 'إشارة إيجابية'
  : t >= 50 ? 'إشارة محايدة' : 'إشارة سلبية';
  }
  return o;
  }

  function db() {
  const d = mkData();
  let rows = (d && d[M.id]) || [];
  /* ⛔ ٢٥ أكتوبر ٢٠٢٦ — EGX_DB object (code → row) مش array.
     ⛔ ⇒ rows.map بيرمي «rows.map is not a function». */
  if (!Array.isArray(rows)) {
  rows = Object.keys(rows).map(function (k) { return rows[k]; });
  }
  return rows.map(normalize);
  }

  /* ══════════════ لوغوهات ══════════════ */
  const LB = [
  ['#4dabf7', '#1971c2'], ['#51cf66', '#2f9e44'], ['#ffa94d', '#e8590c'],
  ['#b197fc', '#7048e8'], ['#ff8787', '#e03131'], ['#3bc9db', '#0c8599'],
  ['#ffd43b', '#f08c00'], ['#63e6be', '#0ca678'], ['#faa2c1', '#c2255c'],
  ['#91a7ff', '#364fc7'], ['#fcc419', '#e67700'], ['#38d9a9', '#087f5b'],
  ['#748ffc', '#4263eb'], ['#ff922b', '#e8590c'], ['#22b8cf', '#0b7285'],
  ['#f06595', '#c92a2a'], ['#69db7c', '#2f9e44'], ['#9775fa', '#5f3dc4'],
  ['#ffa8a8', '#c92a2a'], ['#66d9e8', '#1098ad'], ['#ffe066', '#f59f00'],
  ['#8ce99a', '#37b24d'], ['#d0bfff', '#7950f2'], ['#ffc078', '#e8590c']
  ];
  function logoOf(code) {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) & 0x7fffffff;
  const c = LB[h % LB.length];
  return 'linear-gradient(140deg,' + c[0] + ' 0%,' + c[1] + ' 100%)';
  }
  const logoHTML = c =>
  '<span class="sv-logo" style="background:' + logoOf(c) + '">' + esc(c.charAt(0)) + '</span>';

  /* ══════════════ التوصية الفنية ══════════════ */
  function tvVerdict(s) {
  /* لو TradingView مجابش توصية (أسهم ناشفة) — نستعمل حسابنا من RSI/MACD/MA200 */
  let r = N(s.tvRec);
  if (r == null) r = N(s.tvRecCalc);
  if (r == null) return { t: 'حيادي', cls: 'neutral' };
  if (r >= 0.5) return { t: 'شراء قوي', cls: 'sbuy' };
  if (r >= 0.1) return { t: 'شراء', cls: 'buy' };
  if (r > -0.1) return { t: 'حيادي', cls: 'neutral' };
  if (r > -0.5) return { t: 'إشارة سلبية', cls: 'sell' };
  return { t: 'بيع قوي', cls: 'ssell' };
  }

  const SEC_AR = {
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
  function sectorAr(s) {
  if (s.sectorAr) return s.sectorAr;
  const raw = s.sector || 'عام';
  if (/[؀-ۿ]/.test(raw)) return raw;
  return SEC_AR[raw] || raw;
  }

  /* ══════════════ الفلترة ══════════════ */
  function sectors() {
  const set = {};
  db().forEach(s => { const k = sectorAr(s); set[k] = (set[k] || 0) + 1; });
  return Object.keys(set).sort((a, b) => set[b] - set[a]);
  }

  /* helper: القيمة أو null — الفلاتر بتتجاهل اللي فاضي */
  function ok(v, min, max) {
  if (v == null) return false;
  if (min != null && v < min) return false;
  if (max != null && v > max) return false;
  return true;
  }

  function filter() {
  const q = S.q.trim().toLowerCase();
  return db().filter(function (s) {
  /* ⚠️ أسهم بلا بيانات (موقوفة / غير متاحة) — نستبعدها من الجدول
  لأنها مش قابلة للتحليل — مفيش سعر ولا مؤشرات */
  if (s.noData) return false;
  const px = N(gq(s, ['price', 'p'], 0));
  if (!px) return false;
  if (q) {
  const c = (s.code || '').toLowerCase();
  const n = (s.name || '').toLowerCase();
  const e = (s.nameEn || '').toLowerCase();
  if (c.indexOf(q) < 0 && n.indexOf(q) < 0 && e.indexOf(q) < 0) return false;
  }
  if (S.sect !== 'all' && sectorAr(s) !== S.sect) return false;

  /* التقييم */
  if (S.peMax != null && !ok(s.pe, null, S.peMax)) return false;
  if (S.peMin != null && !ok(s.pe, S.peMin, null)) return false;
  if (S.pbMax != null && !ok(s.pb, null, S.pbMax)) return false;

  /* الربحية */
  if (S.roeMin != null && !ok(s.roe, S.roeMin, null)) return false;
  if (S.roaMin != null && !ok(s.roa, S.roaMin, null)) return false;
  if (S.roicMin != null && !ok(s.roic, S.roicMin, null)) return false;
  if (S.nmMin != null && !ok(s.nm, S.nmMin, null)) return false;
  if (S.omMin != null && !ok(s.om, S.omMin, null)) return false;
  if (S.gmMin != null && !ok(s.gm, S.gmMin, null)) return false;

  /* الرافعة والسيولة */
  if (S.deMax != null && !ok(s.de, null, S.deMax)) return false;
  if (S.crMin != null && !ok(s.cr, S.crMin, null)) return false;
  if (S.qrMin != null && !ok(s.qr, S.qrMin, null)) return false;

  /* التوزيعات */
  if (S.dyMin != null && !ok(s.dy, S.dyMin, null)) return false;
  if (S.payoutMax != null && !ok(s.payout, null, S.payoutMax)) return false;

  /* فنية */
  if (S.rsiMin != null && !ok(s.rsi, S.rsiMin, null)) return false;
  if (S.rsiMax != null && !ok(s.rsi, null, S.rsiMax)) return false;
  if (S.ma200 === 'above' && !(s.price > s.sma200)) return false;
  if (S.ma200 === 'below' && !(s.price < s.sma200)) return false;
  if (S.ma200 === 'above90' && !(s.price > s.sma200 * 0.9)) return false;
  if (S.macd === 'above' && !((s.macd != null && s.macdSig != null) && s.macd > s.macdSig)) return false;
  if (S.macd === 'below' && !((s.macd != null && s.macdSig != null) && s.macd < s.macdSig)) return false;

  /* الأداء */
  if (S.p1mMin != null && !ok(s.p1m, S.p1mMin, null)) return false;
  if (S.p3mMin != null && !ok(s.p3m, S.p3mMin, null)) return false;
  if (S.p6mMin != null && !ok(s.p6m, S.p6mMin, null)) return false;
  if (S.p1yMin != null && !ok(s.p1y, S.p1yMin, null)) return false;
  if (S.pYtdMin != null && !ok(s.pYtd, S.pYtdMin, null)) return false;

  /* السيولة */
  if (S.volMin != null && !ok(s.av30, S.volMin, null)) return false;
  if (S.mcMin != null && !ok(s.mc, S.mcMin, null)) return false;
  if (S.valMin != null) {
  const vp = (s.volume != null && s.price) ? s.volume * s.price : null;
  if (vp == null || vp < S.valMin) return false;
  }

  /* توصية TV */
  if (S.tv) { if (tvVerdict(s).t.indexOf(S.tv) < 0) return false; }

  /* ═══ فلاتر OCTA ═══ */
  if (S.mode === 'octa') {
  if (S.oScoreMin != null && !ok(s.total, S.oScoreMin, null)) return false;
  if (S.oConfMin != null && !ok(s.conf, S.oConfMin, null)) return false;
  if (S.oMddMax != null && !ok(s.mdd1y, null, S.oMddMax)) return false;
  if (S.oVolMax != null && !ok(s.vol1y, null, S.oVolMax)) return false;
  if (S.oSharpeMin != null && !ok(s.sharpe3y, S.oSharpeMin, null)) return false;
  if (S.oCagrMin != null && !ok(s.cagr3y, S.oCagrMin, null)) return false;
  if (S.oRoicMin != null && !ok(s.roic, S.oRoicMin, null)) return false;
  if (S.oFcfMin != null && !ok(s.fcf, S.oFcfMin, null)) return false;
  if (S.oVerdict && String(s.verdict || '') !== S.oVerdict) return false;
  }

  return true;
  });
  }

  const SORTK = {
  code: ['code'], name: ['name'], price: ['price'], chg: ['change'],
  vol: ['volume'], val: ['__val'], av30: ['av30'], mc: ['mc'],
  pe: ['pe'], pb: ['pb'], eps: ['eps'], roe: ['roe'], roa: ['roa'],
  nm: ['nm'], om: ['om'], gm: ['gm'], de: ['de'], cr: ['cr'], qr: ['qr'],
  dy: ['dy'], payout: ['payout'], rsi: ['rsi'], beta: ['beta'],
  volD: ['volD'], p1w: ['p1w'], p1m: ['p1m'], p3m: ['p3m'],
  p6m: ['p6m'], p1y: ['p1y'], pYtd: ['pYtd'], tv: ['tvRec'],
  ema20: ['ema20'], sma50: ['sma50'], sma200: ['sma200'],
  score: ['total'], verdict: ['verdict'], conf: ['conf'],
  /* ⛔ ٢٥ أكتوبر ٢٠٢٦ — أعمدة جديدة متاحة في الـAPI */
  pb: ['pb'], nm: ['nm'], om: ['om'], rvol: ['rel_volume'],
  upside: ['upside'], volatility: ['volatility'], dy: ['dy'],
  sharpe: ['sharpe3y'], cagr: ['cagr3y'], mdd: ['mdd1y'],
  float: ['float'], rev: ['rev'], ebitda: ['ebitda'], fcf: ['fcf'],
  epsF: ['epsF'], sector: ['__sec']
  };

  /* ترتيب نصّي بالأولوية (مش أبجدي!) */
  const TV_RANK = { 'شراء قوي': 5, 'شراء': 4, 'حيادي': 3, 'إشارة سلبية': 2, 'بيع قوي': 1 };
  const OCTA_ORDER = ['إشارة إيجابية', 'إشارة محايدة', 'غير كافٍ', 'إشارة سلبية', 'متابعة', '—'];
  const VERDICT_W = { 'إشارة إيجابية': 5, 'إشارة محايدة': 4, 'متابعة': 3, 'غير كافٍ': 2, 'إشارة سلبية': 1 };

  function sortRows(rows) {
  const k = S.sort, d = S.dir;
  /*  الترتيب التصنيفي — dir = -1 يعني الأقوى فوق دايماً */

  /* التوصية الفنية — بالأولوية مش بالرقم */
  if (k === 'tv') {
  return rows.slice().sort(function (a, b) {
  const ra = TV_RANK[tvVerdict(a).t] || 0, rb = TV_RANK[tvVerdict(b).t] || 0;
  return ra !== rb ? (ra - rb) * d : String(a.code).localeCompare(String(b.code));
  });
  }
  /* قرار OCTA — بالأولوية */
  if (k === 'verdict') {
  return rows.slice().sort(function (a, b) {
  const ra = VERDICT_W[a.verdict] || 0, rb = VERDICT_W[b.verdict] || 0;
  return ra !== rb ? (ra - rb) * d : String(a.code).localeCompare(String(b.code));
  });
  }
  return rows.slice().sort(function (a, b) {
  if (k === 'code' || k === 'name' || k === 'sector') {
  const ga = k === 'sector' ? sectorAr(a) : (a[k] || a.name || a.code || '');
  const gb = k === 'sector' ? sectorAr(b) : (b[k] || b.name || b.code || '');
  return String(ga).localeCompare(String(gb), 'ar') * d;
  }
  let va, vb;
  if (k === 'val') { va = a.volume != null ? a.volume * a.price : null; vb = b.volume != null ? b.volume * b.price : null; }
  /* ⛔ ٢٥ أكتوبر ٢٠٢٦ — `k` ممكن يكون الاسم المختصر (rvol) والفعلي
     (rel_volume) ⇒ نحلّه من SORTK قبل القراءة. */
  else {
  const sk = (SORTK[k] && SORTK[k][0]) || k;
  va = N(a[sk]), vb = N(b[sk]);
  }
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  return (vb - va) * d;
  });
  }

  /* ══════════════════════════════════════════════════════════════
  💵 الأسعار اللحظية — مواعيد البورصة المصرية + كل ساعة
  ══════════════════════════════════════════════════════════════ */
  const LIVE_API = window.OCTA_API + '/api/quotes';
  let LIVE_TIMER = null;
  let CLOCK_TIMER = null;

  /* 🕐 حالة السوق من EGXClock (لو مش موجود نعمل واحد احتياطي) */
  function mkt() {
  if (window.EGXClock) return window.EGXClock.state();
  const n = new Date();
  return { e: '🟢', c: '#51cf66', p: 60000, open: true, live: true, t: '—', nextAt: null };
  }

  function startLive() {
  if (LIVE_TIMER) return;
  tickLive();
  scheduleNext();
  /* ⏱️ تحديث العدّاد كل 5 ثواني حتى لو السعر مش بيتغير */
  CLOCK_TIMER = setInterval(function () {
  renderLiveDot();
  /* لو الوقت اتغير ( session بدأت أو خلصت ) نحدّث فورًا */
  const st = mkt();
  if (st.t !== S.mktT) { S.mktT = st.t; scheduleNext(); tickLive(); }
  }, 5000);
  }

  /* ⏱️ نحسب الوقت الجاي حسب حالة السوق */
  function scheduleNext() {
  const st = mkt();
  clearTimeout(LIVE_TIMER);
  LIVE_TIMER = setTimeout(function () { tickLive(); scheduleNext(); }, st.p);
  S.mktT = st.t;
  }

  function tickLive() {
  const db0 = db();
  if (!db0.length) return;
  fetch(LIVE_API + '?market=' + M.id)
  .then(function (r) { return r.json(); })
  .then(function (j) {
  if (!j || !j.ok) return;
  const rows = (j.markets || {})[M.id];
  if (!rows) return;
  let changed = 0, haltChanged = 0;
  db0.forEach(function (st) {
  const q = rows[st.code];
  if (!q || q.close == null) {
  if (!st._halted) { st._halted = true; haltChanged++; }
  return;
  }
  if (st._halted) { st._halted = false; haltChanged++; }
  const old = st.price;
  st.price = q.close;
  if (q.change != null) st.change = q.change;
  if (q.volume != null) st.volume = q.volume;
  if (q.Recommend != null) st.tvRec = q['Recommend.All'];
  if (old != null && old !== q.close) { st._up = q.close > old; changed++; }
  });
  S.live = true;
  const d = new Date();
  S.lastQ = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  S.mkt = mkt();
  if ((changed || haltChanged) && !document.querySelector('.sv-adv')) render();
  else renderLiveDot();
  })
  .catch(function () { S.live = false; renderLiveDot(); });
  }

  /* 📢 شريط حالة السوق */
  function renderMktNote() {
  const n = document.getElementById('scMktNote');
  if (!n) return;
  const st = mkt();
  const txt = n.querySelector('.txt');
  if (!txt) return;

  n.classList.toggle('open', !!st.open);

  if (st.open) {
  txt.innerHTML = '✅ السوق مفتوح دلوقتي — الأسعار بتتحدث كل ' +
  Math.round(st.p / 1000) + ' ثانية';
  } else if (st.t === 'عطلة') {
  txt.innerHTML = '😴 السوق مقفول (عطلة أسبوعية) — الأسعار آخر سعر رسمي من آخر جلسة تداول';
  } else {
  txt.innerHTML = '⏸️ السوق مقفول دلوقتي — الأسعار آخر سعر رسمي.<br>' +
  '<b style="color:#ffc078">أول ما السوق يفتح بيحدّث نفسه لوحده</b> ' +
  (st.nextAt ? '(' + st.nextAt + ')' : '');
  }
  }

  /* 🕐 العدّاد: حالة السوق + آخر تحديث */
  function renderLiveDot() {
  renderMktNote();
  /* ① حالة السوق — خانة مستقلة */
  const m = document.getElementById('scMkt');
  if (m) {
  const st = mkt();
  m.textContent = st.e + ' ' + st.t;
  m.style.color = st.open ? '#7dd3a8' : '#ffc078';
  m.title = st.open
  ? 'السوق مفتوح — الأسعار بتتحدث لحظياً'
  : 'السوق مقفول — الأسعار آخر سعر رسمي من آخر جلسة';
  }

  /* ② آخر تحديث */
  const el = document.getElementById('scUpd');
  if (!el) return;
  const st = mkt();
  const dot = S.live ? '🟢' : '⚪';
  const t = S.lastQ || '…';
  el.textContent = dot + ' ' + t;
  el.title = S.live ? 'بنحدّث كل دقيقة' : 'بنحدّث كل ١٥ دقيقة وأنا السوق مقفول';
  }

  /* ══════════════ الرندر ══════════════ */
  function render() {
  const head = document.getElementById('scHead');
  const out = document.getElementById('scBody');
  if (!out) return;

  const rows = sortRows(filter());
  const total = db().length;

  const tE = document.getElementById('scTotal'); if (tE) tE.textContent = ar(total);
  const cE = document.getElementById('scCount'); if (cE) cE.textContent = ar(rows.length);
  renderLiveDot();

  /* ⭐ السطر الأول: البحث + عدّاد النتيجة + الأمثلة السريعة */
  if (head) head.innerHTML = topBarHTML();
  /* ⭐ الفلاتر السريعة + الملخص + الفرز — كلهم فوق النتيجة */
  const mid = document.getElementById('scMid');
  if (mid) mid.innerHTML = (!total) ? '' : midHTML(rows);

  if (!total) { out.innerHTML = '<div class="sv-empty">⏳ بنحمّل البيانات...<br><small>ثانيتين بس</small></div>'; return; }
  if (!rows.length) { out.innerHTML = noResultHTML() + aboutBox(); return; }

  const shown = rows.slice(0, S.shown);
  out.innerHTML = tbl(shown) +
  (rows.length > S.shown
  ? '<button class="sv-more" onclick="scMore()">عرض ' + ar(Math.min(40, rows.length - S.shown)) +
  ' كمان — (' + ar(rows.length - S.shown) + ' متبقي)</button>' : '') + aboutBox();
  }

  /* ══════════════════════════════════════════════════════════════
  ⭐ الطبقة الأولى — البحث + الأمثلة السريعة
  ──────────────────────────────────────────────────────────────
  📌 «كم نتيجة؟» لازم تكون في **أول عين** — مش في الترويسة
  ⛌   فوق شريط البحث كده، ولا مخبيّة جوه زرار.
  ══════════════════════════════════════════════════════════════ */
  function topBarHTML() {
  const rows = sortRows(filter());
  const n = rows.length;
  const total = db().length;
  const sec = sectors();
  return '<div class="sc2-top">' +

  /* ① السوق */
  '<div class="sv-marks">' + MARKS.map(m =>
  '<button class="sv-mk' + (m.id === M.id ? ' on' : '') + '" onclick="scSetMarket(\'' + m.id + '\')">' +
  '<span>' + m.i + '</span>' + esc(m.n) + '</button>').join('') + '</div>' +

  /* ② الوضع (TV / OCTA) */
  '<div class="sv-mode">' +
  '<button class="sv-mb' + (S.mode === 'tv' ? ' on' : '') +
  '" onclick="scMode(\'tv\')">📊 فلاتر TradingView</button>' +
  '<button class="sv-mb' + (S.mode === 'octa' ? ' on' : '') +
  '" onclick="scMode(\'octa\')">🐙 فلاتر OCTA</button>' +
  '</div>' +

  /* ③ البحث */
  '<div class="sv-row">' +
  '<div class="sv-search">' +
  '<input id="scQ" type="search" placeholder="ابحث بالاسم أو الرمز…" value="' + esc(S.q) + '" oninput="scQInput(this)" autocomplete="off" spellcheck="false">' +
  (S.q ? '<button onclick="scQ(\'\')" aria-label="مسح البحث">✕</button>' : '') +
  '</div>' +
  '<button class="sv-adv' + (S.advOpen ? ' on' : '') + '" onclick="scAdv()">' +
  (S.advOpen ? '✕ إخفاء' : '⚙ فلاتر متقدمة') + (advCount() ? ' <b>' + ar(advCount()) + '</b>' : '') + '</button>' +
  '<button class="sv-about-btn" onclick="scAbout()">❓ المعايير</button>' +
  '</div>' +

  /* ④ عدّاد النتيجة — بارز */
  '<div class="sc2-count' + (n ? '' : ' zero') + '">' +
  '<span class="sc2-count-n">' + ar(n) + '</span>' +
  '<span class="sc2-count-l">سهم مطابق</span>' +
  '<span class="sc2-count-t">من ' + ar(total) + ' سهم في ' + esc(M.n) + '</span>' +
  '</div>' +

  /* ⑤ الأمثلة السريعة */
  '<div class="sc2-presets">' +
  '<span class="sc2-presets-l">أمثلة سريعة</span>' +
  PRESETS.map(function (p) {
  return '<button class="sc2-preset' + (S.preset === p.id ? ' on' : '') + '" onclick="scPreset(\'' + p.id + '\')" title="' + esc(p.d) + '">' +
  p.n + '</button>';
  }).join('') +
  (S.preset ? '<button class="sc2-preset-x" onclick="scPreset(null)">✕ إلغاء</button>' : '') +
  '</div>' +

  /* ⑥ القطاعات */
  '<div class="sv-sects">' +
  '<button class="sv-sect' + (S.sect === 'all' ? ' on' : '') + '" onclick="scSect(\'all\')">الكل</button>' +
  sec.map(k => '<button class="sv-sect' + (S.sect === k ? ' on' : '') +
  '" onclick="scSect(\'' + esc(k) + '\')">' + esc(k) + '</button>').join('') +
  '</div>' +

  '</div>';
  }

  /* ══════════════════════════════════════════════════════════════
  ⭐ الطبقة الثانية — الفلاتر السريعة + الملخص + الفرز
  ──────────────────────────────────────────────────────────────
  📌 الترتيب: فلاتر (فوق النتيجة) ← ملخص ← فرز ← جدول.
  ⛌   الملخص والفرز **بين** الفلاتر والجدول — عشان لما
  ⛌   المستخدم يغيّر فلتر يشوف النتيجة تتحدث تحته على طول.
  ══════════════════════════════════════════════════════════════ */
  function midHTML(rows) {
  return quickPanelHTML() + summaryHTML(rows) + sortBarHTML();
  }

  /* ── الفلاتر السريعة (أسئلة فوق النتيجة) ── */
  function quickPanelHTML() {
  const list = quickList();
  return '<div class="sc2-qpanel">' +
  '<div class="sc2-qpanel-h">' +
  '<span class="sc2-qpanel-t">🎯 صفّي بالأسئلة دي</span>' +
  '<span class="sc2-qpanel-s">اكتب الرقم وهتلاقي النتيجة تتحدث فوراً</span>' +
  '</div>' +
  '<div class="sc2-qgrid">' +
  list.map(function (f) {
  const v = S[f.k];
  return '<label class="sc2-q">' +
  '<span class="sc2-q-l">' + esc(f.q) + '</span>' +
  '<span class="sc2-q-inp">' +
  '<input type="number" inputmode="decimal" id="q_' + f.k + '"' +
  ' min="' + f.mn + '" max="' + f.mx + '" step="' + f.st + '"' +
  ' value="' + (v == null ? '' : v) + '" placeholder="الكل"' +
  ' oninput="scQuick(\'' + f.k + '\',this,' + f.mn + ',' + f.mx + ')"' +
  ' onchange="scNum(\'' + f.k + '\',this.value,' + f.mn + ',' + f.mx + ')">' +
  '<span class="sc2-q-u">' + esc(f.u) + '</span>' +
  '</span>' +
  '</label>';
  }).join('') +
  '</div>' +
  (advCount() ? '<div class="sc2-qmore">🔧 في <b>' + ar(advCount()) + '</b> فلتر متقدم مفعّل — <button onclick="scAdv()">شوفهم</button></div>' : '') +
  '</div>';
  }

  /* ── شريط الملخص ── */
  function summaryHTML(rows) {
  if (!rows.length) return '';
  const s = summarize(rows);
  return '<div class="sc2-sum">' +
  '<div class="sc2-sum-i"><span class="sc2-sum-l">النتيجة</span><span class="sc2-sum-v">' + ar(s.count) + '</span></div>' +
  '<div class="sc2-sum-i"><span class="sc2-sum-l">أقوى درجة</span><span class="sc2-sum-v gold">' + (s.best == null ? '—' : ar(s.best)) + '</span></div>' +
  '<div class="sc2-sum-i"><span class="sc2-sum-l">متوسط الأمان</span><span class="sc2-sum-v ' + (s.safety == null ? '' : (s.safety >= 60 ? 'up' : s.safety >= 40 ? 'gold' : 'dn')) + '">' + (s.safety == null ? '—' : ar(s.safety)) + '</span></div>' +
  '<div class="sc2-sum-i wide"><span class="sc2-sum-l">أكتر محور متكرر</span><span class="sc2-sum-v">' + esc(s.topSector) + '</span></div>' +
  '</div>';
  }

  /* ⭐ حساب الملخص من النتيجة نفسها — مش من أرقام مخترعة */
  function summarize(rows) {
  let best = null, sum = 0, cnt = 0;
  const sec = {};
  rows.forEach(function (r) {
  const sc = N(r.total);
  if (sc != null) { if (best == null || sc > best) best = sc; }
  const sf = safetyOf(r);
  if (sf != null) { sum += sf; cnt++; }
  const k = sectorAr(r); sec[k] = (sec[k] || 0) + 1;
  });
  let topSector = '—', topN = 0;
  Object.keys(sec).forEach(function (k) { if (sec[k] > topN) { topN = sec[k]; topSector = k; } });
  return {
  count: rows.length,
  best: best == null ? null : Math.round(best),
  safety: cnt ? Math.round(sum / cnt) : null,
  topSector: topN ? topSector + ' (' + ar(topN) + ')' : '—'
  };
  }

  /* ⭐ «متوسط الأمان» — محور واحد، مش رقم مخترع.
  📌 بنحسبه من الأرقام الموجودة فعلاً:
  ⛌   دين منخفض + سيولة كويسة + هبوط صغير + شارب موجب.
  ⛌   لو مفيش ولا رقم متاح ⇒ null ⇒ «—» (مش صفر — الصفر كذب). */
  function safetyOf(r) {
  const parts = [];
  /* ⛔ ٢٥ أكتوبر ٢٠٢٦ — الحقول دي (mdd1y · sharpe3y · vol1y · cr)
     مش موجودة في /api/markets ⇒ الملخص كان بيطلع «—» دايماً.
     ✅ نحسب الأمان من محور المخاطرة (available) + نسبة الدين (de_ratio). */
  if (N(r.safety) != null) parts.push(Math.max(0, Math.min(100, r.safety)));
  else if (r.all_axes && typeof r.all_axes.risk === 'number' && isFinite(r.all_axes.risk)) {
  parts.push(Math.max(0, Math.min(100, r.all_axes.risk)));
  }
  if (N(r.de) != null) parts.push(Math.max(0, Math.min(100, (1.5 - r.de) / 1.5 * 100)));
  if (N(r.mdd1y) != null) parts.push(Math.max(0, Math.min(100, 100 - r.mdd1y * 1.4)));
  if (N(r.sharpe3y) != null) parts.push(Math.max(0, Math.min(100, 50 + r.sharpe3y * 25)));
  if (N(r.cr) != null) parts.push(Math.max(0, Math.min(100, r.cr / 2 * 100)));
  if (N(r.vol1y) != null) parts.push(Math.max(0, Math.min(100, 100 - r.vol1y * 1.6)));
  if (!parts.length) return null;
  return parts.reduce(function (a, b) { return a + b; }, 0) / parts.length;
  }

  /* ── شريط الفرز (ظاهر · سهل) ── */
  const SORTS = [
  { k: 'mc', n: '💰 الأكبر قيمة' },
  { k: 'score', n: '⭐ أقوى تقييم' },
  { k: 'p1m', n: '📈 أحسن أداء' },
  { k: 'p1y', n: '📅 أداء السنة' },
  { k: 'dy', n: '💵 أعلى توزيع' },
  { k: 'roe', n: '🏆 أعلى ربحية' },
  { k: 'pe', n: '💎 الأرخص' },
  { k: 'rsi', n: '🌡️ القوة النسبية' },
  { k: 'vol', n: '🔊 أعلى تداول' }
  ];
  function sortBarHTML() {
  return '<div class="sc2-sort">' +
  '<span class="sc2-sort-l">رتّب بـ</span>' +
  '<div class="sc2-sort-b">' +
  SORTS.map(function (s) {
  const on = S.sort === s.k;
  return '<button class="sc2-sort-b1' + (on ? ' on' : '') + '" onclick="scSort(\'' + s.k + '\')">' +
  s.n + (on ? '<i>' + (S.dir < 0 ? '▼' : '▲') + '</i>' : '') + '</button>';
  }).join('') +
  '</div></div>';
  }

  /* ══════════════════════════════════════════════════════════════
  🚫 «لا نتائج» — مش شاشة فاضية
  ──────────────────────────────────────────────────────────────
  📌 القاعدة: لو مفيش نتيجة، **قول للمستخدم إيه يعمل**.
  ⛌   «مفيش أسهم مطابقة» لوحدها = المستخدم قاعد يتفرج على
  ⛌   شاشة فاضية ومش عارف هو غلط في إيه.
  ⛌ ✅ الحل: (١) عدّ الفلاتر المفعّلة (٢) اقترح تخفيف الأضيق
  ⛌   (٣) اعرض أزرار «امسح كل الفلاتر» و«خفّف فلتر واحد».
  ══════════════════════════════════════════════════════════════ */
  function noResultHTML() {
  /* الفلاتر المفعّلة — مرتّبة: الأضيق (أكتر نتيجة) الأول */
  const active = [];
  QUICK.forEach(function (f) { if (S[f.k] != null) active.push({ k: f.k, q: f.q, v: S[f.k] }); });
  const extraKeys = ['peMin', 'pbMax', 'roeMin', 'roaMin', 'roicMin', 'nmMin', 'omMin', 'gmMin',
  'deMax', 'crMin', 'qrMin', 'dyMin', 'payoutMax', 'rsiMin', 'rsiMax',
  'p1wMin', 'p1mMin', 'p3mMin', 'p6mMin', 'p1yMin', 'pYtdMin',
  'volMin', 'mcMin', 'valMin', 'oScoreMin', 'oConfMin', 'oMddMax', 'oVolMax',
  'oSharpeMin', 'oCagrMin', 'oRoicMin', 'oFcfMin'];
  extraKeys.forEach(function (k) { if (S[k] != null) active.push({ k: k, q: k, v: S[k] }); });
  if (S.ma200) active.push({ k: 'ma200', q: 'المتوسط السنوي', v: S.ma200 });
  if (S.macd) active.push({ k: 'macd', q: 'إشارة الزخم', v: S.macd });
  if (S.tv) active.push({ k: 'tv', q: 'توصية فنية', v: S.tv });
  if (S.oVerdict) active.push({ k: 'oVerdict', q: 'قرار OCTA', v: S.oVerdict });

  /* ⭐ suggestion ذكي: جرّب نشيل كل فلتر واحد بال轮流
  ⛌   — شوف هل في فلتر واحد هو اللي قفل النتيجة. */
  const suggestions = [];
  active.forEach(function (a) {
  const saved = S[a.k];
  S[a.k] = null;
  const n = filter().length;
  S[a.k] = saved;
  if (n > 0) suggestions.push({ k: a.k, q: a.q, v: a.v, n: n });
  });
  suggestions.sort(function (x, y) { return y.n - x.n; });

  let h = '<div class="sc2-none">' +
  '<div class="sc2-none-ico">🚫</div>' +
  '<div class="sc2-none-t">مفيش سهم واحد مطابق</div>' +
  '<div class="sc2-none-s">فلاترك أضيق من اللازم. جرّب واحد من دول:</div>';

  if (suggestions.length) {
  h += '<div class="sc2-none-fix">' +
  suggestions.slice(0, 3).map(function (sg) {
  return '<button class="sc2-fix" onclick="scRelax(\'' + sg.k + '\')">' +
  '🔓 خفّفت «' + esc(sg.q) + '» ← يطلع <b>' + ar(sg.n) + '</b> سهم</button>';
  }).join('') +
  '</div>';
  } else {
  h += '<div class="sc2-none-fix">' +
  '<button class="sc2-fix" onclick="scReset()">🔄 امسح كل الفلاتر</button>' +
  '</div>';
  }

  if (active.length) {
  h += '<div class="sc2-none-act">' +
  '<span>الفلاتر المفعّلة (' + ar(active.length) + '):</span>' +
  active.map(function (a) {
  return '<button class="sc2-chip" onclick="scRelax(\'' + a.k + '\')" title="شيل الفلتر ده">' +
  esc(a.q) + ' <i>' + esc(String(a.v)) + '</i> ✕</button>';
  }).join('') +
  '</div>' +
  '<button class="sc2-none-reset" onclick="scReset()">🔄 امسح كل الفلاتر وابدأ من جديد</button>';
  } else {
  h += '<div class="sc2-none-act"><span>مفيش فلاتر مفعّلة — يعني المشكلة في البحث أو السوق.</span></div>';
  }
  h += '</div>';
  return h;
  }

  /* ══════════════ مجموعات الفلاتر ══════════════ */
  const GRPS = [
  { id: 'val', n: '💎 التقييم', f: [
  ['P/E — أقصى', 'peMax', 0, 200, 1], ['P/E — أدنى', 'peMin', 0, 100, 1],
  ['P/B — أقصى', 'pbMax', 0, 30, 0.5] ] },
  { id: 'prof', n: '📈 الربحية', f: [
  ['ROE أدنى %', 'roeMin', -30, 80, 1], ['ROA أدنى %', 'roaMin', -30, 60, 1],
  ['ROIC أدنى %', 'roicMin', -30, 60, 1], ['هامش صافي %', 'nmMin', -100, 90, 1],
  ['هامش تشغيلي %', 'omMin', -200, 90, 1], ['هامش إجمالي %', 'gmMin', -200, 95, 1] ] },
  { id: 'lev', n: '⚖️ الرافعة', f: [
  ['دين / حقوق %', 'deMax', 0, 500, 5], ['سيولة_current', 'crMin', 0, 15, 0.1],
  ['سيولة سريعة', 'qrMin', 0, 15, 0.1] ] },
  { id: 'div', n: '💵 التوزيعات', f: [
  ['عائد أدنى %', 'dyMin', 0, 30, 0.5], ['نسبة التوزيع %', 'payoutMax', 0, 200, 5] ] },
  { id: 'tech', n: '📊 الفنية', sel: [
  ['ma200', 'above', 'فوق SMA200'], ['ma200', 'below', 'تحت SMA200'],
  ['macd', 'above', 'MACD فوق الإشارة'], ['macd', 'below', 'MACD تحت الإشارة'] ] },
  { id: 'perf', n: '📊 الأداء', f: [
  ['1 أسبوع %', 'p1wMin', -100, 500, 5], ['1 شهر %', 'p1mMin', -100, 500, 5],
  ['3 شهور %', 'p3mMin', -100, 900, 5], ['6 شهور %', 'p6mMin', -200, 2000, 10],
  ['1 سنة %', 'p1yMin', -200, 3000, 10], ['من بداية السنة %', 'pYtdMin', -200, 3000, 10] ] },
  { id: 'liq', n: '💧 السيولة', f: [
  ['حجم 30 يوم', 'volMin', 0, 1e9, 10000], ['قيمة سوقية (مليون)', 'mcMin', 0, 1e7, 100],
  ['قيمة متداولة', 'valMin', 0, 1e9, 100000] ] },
  { id: 'rsi', n: '🌡️ RSI', f: [
  ['RSI أدنى', 'rsiMin', 0, 100, 5], ['RSI أقصى', 'rsiMax', 0, 100, 5] ] },
  { id: 'tv', n: '🎯 توصية TV', sel: [
  ['tv', 'شراء قوي', 'شراء قوي'], ['tv', 'شراء', 'شراء'], ['tv', 'حيادي', 'حيادي'],
  ['tv', 'إشارة سلبية', 'إشارة سلبية'], ['tv', 'بيع قوي', 'بيع قوي'] ] }
  ];

  /* ══ مجموعات OCTA ══ */
  const GRPS_O = [
  { id: 'qual', n: '🎯 الجودة', f: [
  ['تقييم OCTA أدنى', 'oScoreMin', 0, 100, 5],
  ['ثقة البيانات أدنى %', 'oConfMin', 0, 100, 10],
  ['ROIC أدنى %', 'oRoicMin', -20, 50, 1],
  ['كاش تشغيلي (FCF)', 'oFcfMin', -1e12, 1e12, 1e8] ] },
  { id: 'val', n: '💎 القيمة', f: [
  ['P/E أقصى', 'peMax', 0, 200, 1], ['P/B أقصى', 'pbMax', 0, 30, 0.5] ] },
  { id: 'risk', n: '🛡️ المخاطرة', f: [
  ['أقصى هبوط %', 'oMddMax', 5, 100, 5],
  ['تذبذب سنوي %', 'oVolMax', 10, 200, 5] ] },
  { id: 'perf', n: '📊 الأداء', f: [
  ['شارب أدنى', 'oSharpeMin', -5, 10, 0.25],
  ['CAGR 3 سنين %', 'oCagrMin', -50, 100, 5] ] },
  { id: 'dec', n: '⚖️ القرار', sel: [
  ['oVerdict', 'إشارة إيجابية', 'إشارة إيجابية'], ['oVerdict', 'إشارة محايدة', 'إشارة محايدة'],
  ['oVerdict', 'غير كافٍ', 'غير كافٍ'], ['oVerdict', 'إشارة سلبية', 'إشارة سلبية'] ] }
  ];

  /* ══════════════════════════════════════════════════════════════
  ⭐ الأمثلة السريعة (presets) — زرار واحد = شروط جاهزة
  ──────────────────────────────────────────────────────────────
  📌 الفكرة: المستخدم الجديد مش عارف الفلتر بيشتغل إزاي.
  ⛌ فبنديه ٣ زرار بيقول كل واحد فيهم: «دوس وده هيعملك فلترة كده».
  ⛌ كل preset بيمسح الفلاتر القديمة الأول (مش بيراكم) — عشان
  ⛌   المستخدم يفهم النتيجة بتيجي من إيه بالظبط.
  ══════════════════════════════════════════════════════════════ */
  const PRESETS = [
  {
  id: 'buy', n: '🚀 فرص شراء', d: 'شركات بتكسب وبتستثمر كويس — بسعر معقول',
  apply: function () {
  S.mode = 'octa';
  S.oScoreMin = 60; S.oRoicMin = 8; S.peMax = 25; S.rsiMax = 70;
  S.oMddMax = 50;
  S.tv = null; S.sect = 'all'; S.sort = 'score'; S.dir = -1;
  }
  },
  {
  id: 'div', n: '💰 آمنة التوزيع', d: 'بتديك كاش كل سنة — وهادية',
  apply: function () {
  S.mode = 'tv';
  S.dyMin = 3; S.payoutMax = 80; S.deMax = 1.5; S.volMax = 40;
  S.peMax = 25; S.rsiMax = 70;
  S.tv = null; S.sect = 'all'; S.sort = 'dy'; S.dir = -1;
  }
  },
  {
  id: 'growth', n: '📈 نمو سريع', d: 'بتنمو بسرعة — والعائد بعد سنة قوية',
  apply: function () {
  S.mode = 'tv';
  S.p3mMin = 15; S.p6mMin = 25; S.p1yMin = 20; S.mcMin = 500;
  S.roeMin = 8; S.peMax = 35;
  S.tv = null; S.sect = 'all'; S.sort = 'p6m'; S.dir = -1;
  }
  }
  ];

  /* ══════════════════════════════════════════════════════════════
  🎯 الفلاتر السريعة — **دايماً فوق النتيجة مباشرة**
  ──────────────────────────────────────────────────────────────
  📌 كل فلتر = **سؤال بالعربي** مش اسم تقني.
  ⛌ مثال: «الدرجة أعلى من؟» بدل «minScore».
  ⛌ الترتيب: من الأهم للأقل — زي ترتيب القراءة.
  ⛌ ٤ فلاتر بس فوق النتيجة — الباقي في «فلاتر متقدمة».
  ⛌   (كتير فلاتر فوق = المستخدم بيتوه وبيفتح المتقدم بالغلط)
  ══════════════════════════════════════════════════════════════ */
  const QUICK = [
  { k: 'oScoreMin', q: 'الدرجة أعلى من؟', u: 'من ١٠٠', mn: 0, mx: 100, st: 5, octa: 1 },
  { k: 'peMax', q: 'السعر مضاعف الربح أقل من؟', u: 'مرة', mn: 0, mx: 200, st: 1 },
  { k: 'roeMin', q: 'العائد على حقوق الملكية أعلى من؟', u: '٪', mn: -50, mx: 90, st: 1 },
  { k: 'dyMin', q: 'التوزيع السنوي أعلى من؟', u: '٪', mn: 0, mx: 30, st: 0.5 },
  { k: 'oMddMax', q: 'أكبر هبوط في السنة أقل من؟', u: '٪', mn: 5, mx: 100, st: 5, octa: 1 },
  { k: 'p1yMin', q: 'أداء السنة أعلى من؟', u: '٪', mn: -50, mx: 500, st: 5 }
  ];

  /* ⭐ الفلاتر السريعة بتتغيّر حسب الوضع (TV / OCTA) */
  function quickList() {
  if (S.mode === 'octa') return QUICK.filter(function (f) { return f.octa; });
  return QUICK.filter(function (f) { return !f.octa; });
  }

  function grpBar() {
  if (S.mode === 'octa') {
  return '<div class="sv-grps">' + GRPS_O.map(g =>
  '<button class="sv-grp-b' + (S.grpO === g.id ? ' on' : '') +
  '" onclick="scGrpO(\'' + g.id + '\')">' + g.n + '</button>').join('') + '</div>';
  }
  return '<div class="sv-grps">' + GRPS.map(g =>
  '<button class="sv-grp-b' + (S.grp === g.id ? ' on' : '') +
  '" onclick="scGrp(\'' + g.id + '\')">' + g.n + '</button>').join('') + '</div>';
  }

  function advPanel() {
  if (S.mode === 'octa') {
  const g = GRPS_O.find(x => x.id === S.grpO) || GRPS_O[0];
  let body = '';
  if (g.sel) {
  const seen = {};
  g.sel.forEach(function (x) {
  const k = x[0], v = x[1], l = x[2];
  if (seen[k]) return; seen[k] = 1;
  body += '<label class="sv-f"><i>' + l + '</i><select class="sv-sel" onchange="scSel(\'' + k + '\',this.value)">' +
  '<option value="">الكل</option>' +
  g.sel.filter(y => y[0] === k).map(y => '<option value="' + y[1] + '"' +
  (String(S[k] || '') === y[1] ? ' selected' : '') + '>' + y[2] + '</option>').join('') +
  '</select></label>';
  });
  } else {
  body = g.f.map(function (x) {
  const l = x[0], k = x[1], mn = x[2], mx = x[3], st = x[4];
  return '<label class="sv-f"><i>' + l + '</i>' +
  '<input type="number" min="' + mn + '" max="' + mx + '" step="' + st +
  '" value="' + (S[k] == null ? '' : S[k]) + '" placeholder="الكل" ' +
  'oninput="scInp(\'' + k + '\',this,' + mn + ',' + mx + ')" ' +
  'onchange="scNum(\'' + k + '\',this.value,' + mn + ',' + mx + ')"></label>';
  }).join('');
  }
  return '<div class="sv-advp">' + body +
  '<div class="sv-advf">' +
  '<button class="sv-rst" onclick="scReset()">🔄 مسح الكل</button>' +
  (advCount() ? '<span>' + advCount() + ' فلتر مُفعّل</span>' : '<span>مفيش فلاتر مفعّلة</span>') +
  '</div></div>';
  }

  const g = GRPS.find(x => x.id === S.grp) || GRPS[0];
  let body = '';
  if (g.sel) {
  const seen = {};
  g.sel.forEach(function (x) {
  const k = x[0], v = x[1], l = x[2];
  if (seen[k]) return; seen[k] = 1;
  body += '<label class="sv-f"><i>' + l + '</i><select class="sv-sel" onchange="scSel(\'' + k + '\',this.value)">' +
  '<option value="">الكل</option>' +
  g.sel.filter(y => y[0] === k).map(y => '<option value="' + y[1] + '"' +
  (String(S[k] || '') === y[1] ? ' selected' : '') + '>' + y[2] + '</option>').join('') +
  '</select></label>';
  });
  } else {
  body = g.f.map(function (x) {
  const l = x[0], k = x[1], mn = x[2], mx = x[3], st = x[4];
  return '<label class="sv-f"><i>' + l + '</i>' +
  '<input id="f_' + k + '" type="number" min="' + mn + '" max="' + mx + '" step="' + st +
  '" value="' + (S[k] == null ? '' : S[k]) + '" placeholder="الكل" ' +
  'oninput="scInp(\'' + k + '\',this,' + mn + ',' + mx + ')" ' +
  'onchange="scNum(\'' + k + '\',this.value,' + mn + ',' + mx + ')"></label>';
  }).join('');
  }
  return '<div class="sv-advp">' + body +
  '<div class="sv-advf">' +
  '<button class="sv-rst" onclick="scReset()">🔄 مسح الكل</button>' +
  (advCount() ? '<span>' + advCount() + ' فلتر مُفعّل</span>' : '<span>مفيش فلاتر مفعّلة</span>') +
  '</div></div>';
  }

  function advCount() {
  return Object.keys(S).filter(function (k) {
  return ['peMax', 'peMin', 'pbMax', 'roeMin', 'roaMin', 'roicMin', 'nmMin', 'omMin',
  'gmMin', 'deMax', 'crMin', 'qrMin', 'dyMin', 'payoutMax', 'rsiMin', 'rsiMax',
  'p1wMin', 'p1mMin', 'p3mMin', 'p6mMin', 'p1yMin', 'pYtdMin',
  'volMin', 'mcMin', 'valMin', 'ma200', 'macd', 'tv',
  'oScoreMin', 'oConfMin', 'oMddMax', 'oVolMax', 'oSharpeMin', 'oCagrMin',
  'oRoicMin', 'oFcfMin', 'oVerdict'].indexOf(k) >= 0 && S[k] != null;
  }).length;
  }

  /* ══════════════ كارت المعايير ══════════════ */
  /* ══════════════════════════════════════════════════════════════
  📖 كارت الشرح — 4 مستويات + مقارنة TV vs OCTA
  ══════════════════════════════════════════════════════════════ */
  const LVL = [
  { id: 'start', n: '🌱 مبتدئ', d: 'أول مرة تستخدم الفلتر' },
  { id: 'mid',  n: '🔧 متوسط', d: 'فهمت الأساسيات' },
  { id: 'pro',  n: '🎯 خبير',  d: 'بتحلل بعمق' },
  { id: 'inst',  n: '🏛️ محترف', d: 'مح Portfolio Manager' }
  ];

  function aboutBox() {
  const lv = S.lvl || 'start';
  return '<div class="sv-about' + (S.aboutOpen ? ' open' : '') + '" dir="rtl">' +
  '<div class="sv-about-h" onclick="scAbout()">' +
  '<span>❓ كل الفلاتر دي بتعمل إيه؟</span><b>' + (S.aboutOpen ? '▲' : '▼') + '</b>' +
  '</div>' +
  (S.aboutOpen ? '<div class="sv-about-b">' +

  /* ── المقارنة الكبرى ── */
  '<div class="sv-diff">' +
  '<div class="sv-dc">' +
  '<div class="sv-dh">📊 فلاتر TradingView</div>' +
  '<div class="sv-db">المصدر: <b>بيانات TradingView المباشرة</b></div>' +
  '<ul class="sv-dl">' +
  '<li><b>محايد تماماً</b> — بيقولك الأرقام زي ما هي، من غير ما ياخد قرار</li>' +
  '<li><b>بدون ترجيح</b> — مافيش أفضلية لأي سهم على التاني</li>' +
  '<li><b>مناسب للبحث السريع</b> — بتشوف السوق زي ما هو</li>' +
  '</ul>' +
  '</div>' +
  '<div class="sv-dc sv-dc-octa">' +
  '<div class="sv-dh">🐙 فلاتر OCTA</div>' +
  '<div class="sv-db">المصدر: <b>محرك التحليل بتاعنا</b></div>' +
  '<ul class="sv-dl">' +
  '<li><b>رأي محسوب</b> — بيجمع 40+ مؤشر في رقم واحد من 100</li>' +
  '<li><b>عربي خالص</b> — مبني على الشروط الحقيقية لسوق مصر</li>' +
  '<li><b>مناسب للاختيار</b> — بيقولك إيه اللي يستحق انتباهك</li>' +
  '</ul>' +
  '</div>' +
  '</div>' +

  /* ── مستويات الشرح ── */
  '<div class="sv-lvls">' + LVL.map(l =>
  '<button class="sv-lvl' + (lv === l.id ? ' on' : '') +
  '" onclick="scLvl(\'' + l.id + '\')" title="' + esc(l.d) + '">' + l.n + '</button>'
  ).join('') + '</div>' +

  lvlBody(lv) +

  '</div>' : '') +
  '</div>';
  }

  /* ── محتوى كل مستوى ── */
  function lvlBody(lv) {
  if (lv === 'start') return `
  <div class="sv-ab-sec">
  <div class="sv-ab-t">🌱 لو أول مرة — ده أهم حاجة تفهمها</div>
  <div class="sv-ex">
  <div class="sv-exq">P/E يعني إيه؟</div>
  <div class="sv-exa">تخيّل إنك بتدفع 100 جنيه على سهم، والشركة بتوزّع <b>10 جنيه</b> أرباح
  في السنة. الـP/E هنا = <b>10</b>.
  يعني لو كل ده استمر، <b>10 سنين</b> ترجع فلوسك.
  <br><b>رقم أقل = أرخص.</b> تحت 12 = كويس · فوق 40 = غالي.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">ROE يعني إيه؟</div>
  <div class="sv-exa">الشركة بتستثمر <b>100 جنيه</b> من فلوس المساهمين (حقوق الملكية)
  وبتعمل منهم <b>20 جنيه ربح</b>؟ الـROE = <b>20%</b>.
  <br><b>رقم أعلى = الشركة بتعرف تستثمر فلوسك كويس.</b> فوق 15% = ممتاز.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">ليه التوزيعات (الفلوس اللي بتديك) مهمة؟</div>
  <div class="sv-exa">كل شركة بتقسم أرباحها وبتدي جزء منها لك <b>نقد كل سنة</b>.
  العائد 5% = لو سهمك بـ100، هتاخد <b>5 جنيه كل سنة</b> من غير ما تبيع.
  <br>⚠️ ده مش مضمون — الشركة ممكن توقف التوزيع.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">أعلى هبوط (MDD) يعني إيه؟</div>
  <div class="sv-exa">أكبر مرة السهم نزل فيها من أعلى سعر.
  لو نزل <b>40%</b>، معاك لازم تتحمّل إنك تخسر 40% لو اشتريت في الغلط.
  <br>تحت 25% = آمن · فوق 60% = خطر.</div>
  </div>
  <div class="sv-tip">
  💡 <b>القاعدة السهلة:</b> ابدأ بـ <b>ROE &gt; 15%</b> + <b>P/E &lt; 20</b> +
  <b>عائد &gt; 3%</b> + <b>هبوط &lt; 40%</b> — دي هتلاقي أسهم كويسة.
  </div>`;

  if (lv === 'mid') return `
  <div class="sv-ab-sec">
  <div class="sv-ab-t">💰 فلوس الشركة — ثمن السهم مقارنة بفلوسها الحقيقية</div>
  <div class="sv-ex">
  <div class="sv-exq">مضاعف الكتاب (P/B) يعني إيه؟</div>
  <div class="sv-exa">بيقسّم <b>سعر السهم</b> على <b>القيمة الدفترية</b> — يعني كام جنيه بتدفع
  في السهم على كل جنيه حقيقي واقف وراه في الشركة.
  <br>تخيّل الشركة ماسكة أصول بـ100 جنيه، وسهمها بـ300. الـ<bdi>P/B</bdi> = <b>3</b>.
  <br><b>رقم أقل = أرخص.</b> تحت 1 = بتدفع أقل من القيمة الدفترية · فوق 5 = بتدفع خمسة أضعافها.
  <br>⚠️ القيمة الدفترية مش فلوس جاهزة — فيها مخازن وآلات. فالمقارنة بتتأثر بتركيبة كل شركة.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">نسبة الدين (D/E) يعني إيه؟</div>
  <div class="sv-exa">بتقسّم <b>إجمالي الدين</b> على <b>حقوق الملكية</b>.
  الشركة مديانة 50 جنيه وحقوق ملكيتها 100 → الـ<bdi>D/E</bdi> = <b>0.5</b>، يعني الدين نص حقوق الملكية.
  <br><b>رقم أقل = أمان أكبر.</b> تحت 0.5 = دين خفيف · 1 = الدين يساوي حقوق الملكية ·
  فوق 2 = الدين ضعف حقوق الملكية.
  <br>⚠️ الدين مش بيتقاس بالتساوي للكل. الشركة اللي بتبيع بالآجل من غير قروض بنكية بتطلع نسبة دينها
  عالية بشكل طبيعي، وده مش بالضرورة خطر.
  <br>⚠️ خانة الفلتر مكتوب عليها <b>«%»</b> بس القيمة معامل: تكتب <b>0.5</b> مش 50.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">نسبتا السيولة (current ratio) و(quick ratio) يعني إيه؟</div>
  <div class="sv-exa">الاتنين بيجاوبوا نفس السؤال: الشركة تقدر تسدّد التزاماتها <b>قصيرة الأجل</b>
  من فلوسها <b>دلوقتي</b> ولا لأ.
  <br>الرقم <b>معامل</b> مش نسبة. <b>1</b> معناها كل جنيه من الالتزامات متغطّى بجنيه سيولة موجود.
  <br><b>فوق 1</b> = مغطّاة · <b>تحت 1</b> = لو الدائنين طالبوا الفلوس دلوقتي، هتحتاج تبيع بضاعة الأول.
  <br>الفرق إن النسبة <b>السريعة</b> بتشيل البضاعة المخزنة من الحساب، فدايماً أصغر من الأولى.
  <br>⚠️ الأرقام دي مش للمقارنة في <b>البنوك</b> — البنك مفيش عنده بضاعة بالمفهوم ده،
  فالنسب بتطلع من غير معنى.</div>
  </div>
  </div>
  <div class="sv-ab-sec">
  <div class="sv-ab-t">🏭 الشركة بتستخدم فلوسها بكفاءة ولا بتهدرها؟</div>
  <div class="sv-ex">
  <div class="sv-exq">العائد على رأس المال المستثمر (ROIC) يعني إيه؟</div>
  <div class="sv-exa">بيقسّم <b>الربح التشغيلي</b> على <b>رأس المال المستثمر</b> — يعني الفلوس
  اللي الشركة حطتها في شغلها فعلاً: فلوسها + الدين اللي استلفته عشان تشتغل.
  <br>الشركة حطت 100 جنيه في شغل وعملت منهم 18 ربح → الـ<bdi>ROIC</bdi> = <b>18%</b>.
  <br><b>رقم أعلى = بتستثمر أحسن.</b> فوق 15% = الشركة بتجيب ربح محترم على كل جنيه بتستخدمه ·
  تحت 5% = الفلوس اللي بتدخلها مش بتجيب ربح يُذكر.
  <br>⚠️ الـ<bdi>ROIC</bdi> بيقيس <b>الشغل</b> مش فلوس المساهمين. عشان كده ممكن تلاقي شركة
  الـ<bdi>ROIC</bdi> بتاعها عالي والـ<bdi>ROE</bdi> بتاعها أقل — وده مش تناقض.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">ليه بنقرا العائد على رأس المال (ROIC) والعائد على حقوق الملكية (ROE) مع بعض؟</div>
  <div class="sv-exa">العائد على حقوق الملكية (ROE) بيقسّم الربح على <b>حقوق المساهمين</b> بس.
  وهو رقم كويس… لكن الشركة ممكن ترفعه من غير ما تشتغل أحسن: لو الشركة مديانة، حقوق الملكية بتقل،
  فينقسم نفس الربح على رقم أصغر، والـ<bdi>ROE</bdi> بيطلع أعلى.
  <br>فـ <b>عائد على حقوق الملكية عالي</b> + <b>عائد على رأس المال عادي</b> = ربح مبني على <b>دين</b> مش على شغل.
  <br>فـ <b>العائدين عاليين مع بعض</b> = الشركة بتكسب وبتشتغل بفلوسها فعلاً.
  <br>⚠️ الـ<bdi>ROE</bdi> لوحده مقياس ناقص، وده سبب إن الفلتر بيعرض المؤشرين جنب بعض.</div>
  </div>
  </div>
  <div class="sv-ab-sec">
  <div class="sv-ab-t">🌡️ حالة السهم في السوق دلوقتي</div>
  <div class="sv-ex">
  <div class="sv-exq">مؤشر القوة النسبية (RSI) يعني إيه؟</div>
  <div class="sv-exa">رقم من 0 لـ100 بيقيس <b>قوة آخر الحركات الصاعدة مقابل الهابطة</b>
  في فترة قصيرة (عادةً 14 يوم).
  <br>الحسبة ببساطة: لو في الفترة دي 70 يوم طلع و30 يوم نزل، النتيجة تقريباً <b>70</b>.
  <br><b>فوق 70</b> = الحركات الصاعدة طاغية على غير المعتاد، وكتير بيتقري إنه تشبّع.
  <b>تحت 30</b> = ضغط بيعي غير معتاد، وكتير بيتقري إنه تعبُق.
  <br>⚠️ مفيش «حد آمن» في المؤشر: 80 ممكن تبدأ بعدها تصحيح حقيقي، و20 ممكن يكون قاع فعلاً.
  الـ<bdi>RSI</bdi> بيقولك الحركة <b>قوية ولا ضعيفة</b>، مش بيقولك <b>الجاية إيه</b>.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">ليه ما بننصحش بمؤشر القوة النسبية (RSI) لوحده؟</div>
  <div class="sv-exa">لانه بيتحسب من <b>الأسعار اللي فاتت</b>، ومحدش بيعرف حركة الجاية منه.
  السهم اللي مؤشره 80 ممكن يكمّل صعود، وممكن يصحّح 20% في أسبوع.
  <br>الاستخدام الصح: تستخدمه <b>فلتر</b> — «وريني الأسهم اللي مش طالعة بقوة» — وبعدين تبصّ على
  الأساسيات (الجودة والقيمة) قبل ما تاخد قرار.
  <br>⚠️ أي رقم فني لوحده — <bdi>RSI</bdi> أو <bdi>MACD</bdi> أو غيره — <b>مش توصية استثمارية</b>.</div>
  </div>
  </div>
  <div class="sv-ab-sec">
  <div class="sv-ab-t">🎯 تقييم <bdi>OCTA</bdi> — الرقم اللي بيجمع كل ده</div>
  <div class="sv-ex">
  <div class="sv-exq">تقييم <bdi>OCTA</bdi> يعني إيه؟</div>
  <div class="sv-exa">رقم من 0 لـ100 بيجمع <b>7 محاور</b> في رقم واحد، وكل محور ليه وزن:
  <br>🛡️ <b>المخاطر 24%</b> (الأعلى) — بيتا، التقلب، وأكبر هبوط، والدين
  <br>💰 <b>الأساسي 22%</b> — الأرباح والعائد على رأس المال والمديونية
  <br>📈 <b>الفني 18%</b> — أداء 3 شهور وأداء شهر، ومؤشر القوة النسبية
  <br>💧 <b>السيولة 18%</b> — حجم التداول ومقارنته بالمعتاد
  <br>💼 المحفظة 9% · 📰 الأخبار 5% · 🧠 المعنويات 4%
  <br><br>📊 <b>القيمة</b> (مضاعف الربحية والكتاب) بتتحسب مع الأساسي — ومفيش ليها وزن لوحدها.
  <br><b>رقم أعلى = الشركة أفضل في المحاور دي.</b> فوق 70 = تقييم مرتفع · تحت 50 = ضعيف.
  <br>⚠️ الرقم ده <b>ترتيب نسبي</b> بين الأسهم في نفس السوق، مش وعد بالربح.
  سهم تقييمه 80 في سوق كله ضعيف ممكن يكون أقل جاذبية من سهم تقييمه 60 في سوق قوي.
  <br>🏦 <b>البنوك والعقارات</b> بتتقاس بالقيمة الدفترية مش بمضاعف الربحية — لأن مضاعف
  الربحية بيتشوّه فيهم. والعائد على حقوق الملكية بتاع البنك عادي لأنه شغلهم إيداع،
  وده تعريف الشغل نفسه مش ميزة.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">ليه نلاقي نفس التقييم لكن قرار مختلف؟</div>
  <div class="sv-exa">لأن التقييم <b>رقم واحد</b>، والقرار بياخد في الحسبان كمان
  <b>نسبة البيانات المتاحة</b> — دي عمود الثقة.
  <br>سهم تقييمه 65 بثقة 100% (كل الأرقام موجودة) مش زي سهم تقييمه 65 بثقة 40% (نص الأرقام ناقص).
  <br>لما البيانات تنقص، التقييم بيتحسب من المحاور الموجودة بس — فبيطلع أعلى نسبياً.
  <br>الحل: اقرأ <b>التقييم</b> و<b>الثقة</b> و<b>القرار</b> مع بعض. كل ما الثقة ناقصة، الحكم بيبقى أضعف.</div>
  </div>
  </div>
  <div class="sv-ab-sec">
  <div class="sv-ab-t">⚖️ ليه في قيمتين مختلفتين لنفس السهم؟</div>
  <div class="sv-ex">
  <div class="sv-exq">ليه مصادر البيانات بتقول رأيين مختلفين على نفس السهم؟</div>
  <div class="sv-exa">
  <b>فلاتر <bdi>TradingView</bdi></b> بتعرض الأرقام زي ما هي من غير ترجيح، وبتجاوب على سؤال
  <i>السهم دلوقتي فين؟</i> — وده الجانب الفني، المبني على سلوك <b>السعر</b>:
  مؤشر القوة النسبية، وإشارة تغيّر الزخم، والمتوسطات المتحركة.
  <br><br>
  <b>فلاتر <bdi>OCTA</bdi></b> بتعمل رأي محسوب، وبتجاوب على سؤال <i>الشركة دي تستثمر فلوسك ولا لأ؟</i> —
  وده الجانب الأساسي: أرباح الشركة، وقيمتها، وأداءها على <b>3 سنين</b> كاملة، وسيولتها.
  <br><br>
  عشان كده نفس السهم ممكن يطلع عليه رأي مختلف من المسارين، وده <b>مش خطأ</b> —
  كل واحد بيجاوب على سؤال مختلف. الفني بيقولك <i>إيه اللي حصل في السوق دلوقتي؟</i>،
  والأساسي بيقولك <i>إيه اللي جاي من الشركة نفسها؟</i>
  <br><br>
  <b>قاعدة عملية:</b> لو عايز تبني قرار، ابني على <b>الأساسيات</b> وخلّي الفني مجرد
  <b>توقيت دخول وخروج</b> — مش العكس.
  <br>⚠️ أي رقم أو توصية معروضة هنا تحليل بيانات، <b>مش نصيحة استثمارية</b>.</div>
  </div>
  </div>`;

  if (lv === 'pro') return `
  <div class="sv-ab-sec">
  <div class="sv-ab-t">📊 ربحية الشركة — من كل 100 جنيه بتكسب كام؟</div>
  <div class="sv-ex">
  <div class="sv-exq">هامش الربح الصافي (net margin) يعني إيه؟</div>
  <div class="sv-exa">بتقسّم <b>صافي الربح</b> على <b>إجمالي المبيعات</b> — يعني من كل 100 جنيه دخل،
  كام باقى للشركة بعد كل المصاريف (بضاعة، رواتب، إيجار، فوائد، ضرايب).
  <br>دخل 100 مليون وصافي ربح 20 مليون → الهامش = <b>20%</b>.
  <br><b>رقم أعلى = الشركة بتكسب أكتر من كل جنيه بتبيعه.</b> فوق 20% = هامش قوي ·
  تحت 5% = لو المبيعات زادت 10%، الربح مش هيتحرك كتير.
  <br>⚠️ الهامش <b>مش قابل للمقارنة بين القطاعات</b>: هامش 5% في المقاولات ممكن ممتاز،
  وهامش 50% في التوزيع ممكن عادي. وشركة بتكسب 50% لازم تاخد بالها إن مبيعاتها بتضيع بسرعة.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">الهامش الإجمالي (gross) والتشغيلي (operating) يعني إيه؟</div>
  <div class="sv-exa">الاتنين بيقسموا الربح، بس على مراحل مختلفة:
  <br>· <b>الهامش الإجمالي</b> = (المبيعات − تكلفة البضاعة المباعة) على المبيعات.
  يعني الفلوس اللي فاضلة <b>قبل</b> أي مصاريف تانية.
  <br>· <b>الهامش التشغيلي</b> = الربح <b>بعد</b> المصاريف التشغيلية (رواتب، إيجار، إدارية)
  وقبل الفوائد والضرايب.
  <br>الفرق بينهم = مصاريف التشغيل. لو الفرق كبير، الشركة عندها تكاليف تشغيل ثقيلة محتاجة مبيعات كبيرة عشان تغطيها.
  <br>⚠️ أرقام الهوامش دي متاحة لنحو <b>خُمس</b> أسهم السوق المصري بس، فمفيش خلاصة حقيقية تقدر تستنتجها.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">إيه معنى التقييم على السنة الجاية (forward P/E)؟</div>
  <div class="sv-exa">المضاعف العادي بيقسّم السعر على <b>أرباح السنة اللي فاتت</b>.
  التقييم على السنة الجاية بيقسّم السعر على <b>أرباح السنة اللي جاية</b> (تقديرات المحللين).
  <br>من غير التقييم العادي: الشركة ربحت 5 جنيه في السنة اللي فاتت، ومتوقع 10 في الجاية.
  لو السهم بـ100 → المضاعف الماضي <b>20</b>، والجاي <b>10</b>.
  <br><b>رقم أقل = رخيص.</b> المضاعف الجاي أقل من الماضي = الشركة بتكبر.
  <br>⚠️ تقديرات السنة الجاية <b>مش أرقام مؤكدة</b> — تغيير واحد في التوقع بيقلب النسبة كلها.
  <br>⚠️ في السوق المصري البيانات دي ناقصة جداً: متاحة لـ<b>5 أسهم</b> من أصل 290.</div>
  </div>
  </div>
  <div class="sv-ab-sec">
  <div class="sv-ab-t">📈 النمو — الشركة بتكبر ولا واقفة؟</div>
  <div class="sv-ex">
  <div class="sv-exq">نمو 3 سنين المركّب (CAGR) يعني إيه؟</div>
  <div class="sv-exa">بيقيس النمو السنوي <b>المتوسط المركّب</b> — أي إن السهم لو ضاعف نفسه
  في 3 سنين، الـ<bdi>CAGR</bdi> هو الرقم اللي لو كرّرته كل سنة توصل لنفس النتيجة.
  <br>السهم بدأ بـ10 وانتهى بـ80 في 3 سنين → الـ<bdi>CAGR</bdi> ≈ <b>100%</b> في السنة.
  <br><b>رقم أعلى = نمو أكبر.</b> فوق 25% = نمو حقيقي · تحت 5% = شبه راكد.
  <br>⚠️ الرقم ده بيتضخّم لما السهم يبدأ من سعر واطي. سهم طلع من 2 لـ20 يكبر ثلاثة أضعاف، أكبر نمواً من سهم طلع
  من 100 لـ400، حتى لو الزوجين كسبوا نفس المبلغ. فدايماً اقرأ الـ<bdi>CAGR</bdi> جنب القيمة السوقية.
  <br>⚠️ وفي السوق المصري وسيط الرقم ده فوق 50% — الرقم ماشي مع التضخم، مش مع نمو أرباح الشركة.
  <br>⚠️ متاح لنحو <b>62%</b> من الأسهم بس.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">ليه بنقارن النمو على 3 سنين مش سنة واحدة؟</div>
  <div class="sv-exa">لأن أداء سنة واحدة بيعكس <b>مزاج السوق</b>، لا حالة الشركة.
  <br>سهم ممكن يطير 80% في سنة (كل السوق طار) وينزل 40% تاني، ويفضل في نفس المكان.
  <br>ولهذا المؤشرات التاريخية (شارب، أقصى هبوط، النمو) بتاخد دور كبير في تقييم
  <b>الأمان</b> مش بس في السعة.
  <br>⚠️ الرقم مُحسب من سعر السهم، مش من أرباح الشركة. السهم ممكن يطلع بسبب مش بيخالص الشركة حاجة.</div>
  </div>
  </div>
  <div class="sv-ab-sec">
  <div class="sv-ab-t">⚖️ المخاطرة — العائد يستاهل المخاطر اللي بتحملها؟</div>
  <div class="sv-ex">
  <div class="sv-exq">نسبة العائد مقابل المخاطرة (Sharpe) يعني إيه؟</div>
  <div class="sv-exa">بتقسّم <b>العائد الزائد</b> على <b>التقلّب</b>: العائد بتاع السهم ناقص
  العائد الآمن، مقسوم على قفزة السهم. لاحظ إننا بنقيس <b>الزائد</b> — أي العائد اللي فوق
  خط الأمان.
  <br><b>رقم أعلى = ربح أكبر مقابل نفس قدر التقلّب.</b>
  <br>فوق 1 = العائد الزائد أكبر من تقلب السهم · تحت 0 = السهم اهتز أكتر من ربحه.
  <br>⚠️ المقياس بيقيس <b>الإثارة</b> مش الجودة. سهم ساخر 100% ورافع ربح 10% ممكن يطلع
  شارب كويس لو كان هادي. اقراه مع <b>هامش الربح</b> و<b>القيمة الدفترية</b>.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">حساسية السوق (beta) يعني إيه؟</div>
  <div class="sv-exa">بيقيس السهم بيتحرك مع السوق ولا ضده، بمعامل:
  <br><b>1</b> = بيتحرك مع السوق بنفس الدرجة · <b>فوق 1</b> = بيتحرك أكتر من السوق ·
  <b>تحت 1</b> = بيتحرك أهدأ من السوق · <b>سالب</b> = بيتحرك عكس السوق.
  <br><b>رقم أقل = هدوء أكتر.</b> بيتا تحت 0.9 = السهم بيتحرك بنص حركة السوق تقريباً.
  <br>⚠️ بيتا <b>مش بيتحسب زي ما هو في كل الأسواق</b>. في السوق المصري السوق نفسه بيتحرك
  بصعوبة، فمتوسط البيتا فيه <b>0.44</b> — أي أن «سهم بيتحرك مع السوق» في مصر معناه بيتا حوالي 0.4.
  <br>⚠️ والبيتا السالب مش حماية: بيقول إن السهم بيتحرك عكس السوق، مش إنه آمن.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">التذبذب اليومي يعني إيه؟</div>
  <div class="sv-exa">حركة السعر اليومية كنسبة من السعر نفسه — يعني السهم بيتحرك
  <b>أوي كل يوم</b> ولا <b>بهدوء</b>.
  <br>سهم سعره 100 وتذبذبه 1.5% = بيتحرك ±1.5 جنيه في اليوم عادةً.
  <br><b>رقم أقل = أهدأ.</b> تحت 2% = هادي · فوق 4% = بيتحرك كتير — وهو كمان معناه
  <b>صعوبة في الدخول والخروج</b> (فرق أكبر بين سعر الشراء والبيع).
  <br>⚠️ في السوق المصري متوسط التذبذب اليومي <b>3.4%</b> — أعلى من الأسواق الكبيرة.
  ده يخلي الحجم المطلوب كبير عشان تعدّي السوق.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">نسبة التوزيعات (payout ratio) يعني إيه؟</div>
  <div class="sv-exa">بتقسّم <b>التوزيعات</b> على <b>صافي الربح</b> — يعني الشركة بتوزّع كام
  من كل جنيه ربحته على المساهمين.
  <br>وزّعت 30 من ربح 100 → النسبة = <b>30%</b>.
  <br><b>رقم أقل = الشركة محتفظ أكتر.</b> تحت 40% = بتحتفظ بباقي الربح ·
  <b>فوق 100%</b> = بتصرف أكتر مما كسبت، وده <b>غير مستدام</b> على المدى الطويل.
  <br>⚠️ توزيع عالي مع شركة نامية = الشركة بتقفل نفسها — تصرف أكتر مما بتكسب. 
  <br>⚠️ <b>غير متاح</b> في بيانات السوق المصري الحالية — الحقل مش موجود عند أي سهم،
  فخانة الفلتر بترجع فاضية والفلتر ده مش بيشتغل في مصر.</div>
  </div>
  </div>
  <div class="sv-ab-sec">
  <div class="sv-ab-t">📡 الإشارات الفنية في فلتر <bdi>TradingView</bdi></div>
  <div class="sv-ex">
  <div class="sv-exq">السعر فوق أو تحت المتوسط السنوي (SMA200) يعني إيه؟</div>
  <div class="sv-exa">المتوسط السنوي هو <b>متوسط سعر آخر 200 يوم</b>. الفلتر بيقارن السعر الحالي
  بالمتوسط ده:
  <br><b>فوق المتوسط</b> = السهم في اتجاه صاعد طويل المدى · <b>تحته</b> = في اتجاه هابط.
  <br>الاستخدام الشائع: منتقي الصاعدين بس، فتلاقي نفسك داخل في اتجاه أكبر.
  <br>⚠️ المؤشر بيقولك <b>اتجاه</b>، مش <b>توقيت</b>. فوق المتوسط ممكن يكون اتحرك 40% فوق
  ويبقى جاهز يصحّح. ووكمان: لو السوق كله عرضي (من غير اتجاه)، الفلتر ده بيطلع نص الأسهم تقريباً.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">إشارة تغيّر الزخم (MACD) يعني إيه؟</div>
  <div class="sv-exa">الـ<bdi>MACD</bdi> بيقارن <b>متوسط السعر على 12 يوم</b> بـ<b>متوسط 26 يوم</b>،
  والفرق بينهم (خط الإشارة) بيقيس اتجاه الزخم.
  <br>الـ<bdi>MACD</bdi> فوق خط الإشارة = الزخم بيلف لفوق · تحته = بيلف لتحت.
  <br><b>القاعدة:</b> لما الـ<bdi>MACD</bdi> يقطع خط الإشارة من فوق لتحت، الزخم بدأ يقل —
  وده ممكن يكون بداية تصحيح، لكن <b>مش ضمانة</b>.
  <br>⚠️ الـ<bdi>MACD</bdi> متأخر: بيوصلك الإشارة بعد ما السعر يتحرك. هو بيقولك
  «الحركة بدأت تهدى» — مش «السهم هيطلع».</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">أداء الأسبوع والشهر والتوصية الفنية يعني إيه؟</div>
  <div class="sv-exa"><b>أداء الشهر</b> = السهم ربح أو خسر قد إيه في آخر 30 يوم. رقم سريع
  بيقولك إيه اللي حصل، <b>مش إيه اللي هيحصل</b>.
  <br><b>التوصية الفنية</b> (شراء قوي / شراء / حيادي / إشارة سلبية / بيع قوي) = خلاصة
  حساب فني على <b>26 مؤشر فني</b> (مؤشرات، متوسطات، زخم، حجم).
  <br>⚠️ التوصية <b>محسوبة على سلوك السعر</b> — مش على الشركة. وممكن توصية إيجابية
  لسهم قيمته الدفترية بتتآكل.
  <br>⚠️ «أداء الأسبوع» <b>غير متاح</b> في البيانات الحالية — الفلتر بيرجع صفر نتيجة في كل الأسواق.</div>
  </div>
  </div>`;

  if (lv === 'inst') return `
  <div class="sv-ab-sec">
  <div class="sv-ab-t">🏛️ المستوى المحترف — إزاي تقرأ تقييم <bdi>OCTA</bdi> صح</div>
  <div class="sv-ex">
  <div class="sv-exq">إزاي <bdi>OCTA</bdi> بيحسب التقييم من 100 نقطة؟</div>
  <div class="sv-exa">
  <b>الفكرة:</b> كل سهم بيتقيّم من 100 نقطة، والنقاط بتتقسم على <b>7 محاور</b> بأوزان مختلفة.
  كل محور بيتحسب لوحده من صفر لمية، وبعدين النتيجة النهائية هي <b>المتوسط المرجّح</b>
  للمحاور اللي اتحسبت فعلاً.
  <br><br>
  <b>الأوزان السبعة:</b>
  <br>🛡️ <b>المخاطر 24%</b> — أكبر محور: الأمان في السوق المصري أهم من العائد.
  <br>💰 <b>الأساسي 22%</b> — الشركة بتكسب بجد وبتستثمر فلوسها صح.
  <br>📈 <b>الفني 18%</b> — حركة السعر والزخم.
  <br>💧 <b>السيولة 18%</b> — السوق المصري ضعيف السيولة، فالمحور لازم يتحسب.
  <br>💼 <b>المحفظة 9%</b> · 📰 <b>الأخبار 5%</b> · 🧠 <b>المعنويات 4%</b>
  <br><br>
  <b>النتيجة الثامنة (🐙 التوافق العام)</b> مش محور مستقل — هي <b>ناتج</b> تجميع السبعة.
  <br><br>
  <b>مهم — محورين ثابت��ن دلوقتي:</b> الأخبار (45 لكل سهم) والمحفظة (70 لكل سهم)
  مفيش مصدر بيانات ليهم لسه، فمافيش فيهم فرق بين أي سهم والتاني.
  يعني <b>14% من الوزن ثابت</b>، واللي بيفرّق فعلياً هو <b>5 محاور</b>.
  <br><br>
  <b>الفكرة الجوهرية:</b> لو مؤشر ناقص، النظام <b>مش بيخمّن ولا بيفترض رقماً في النص</b> —
  المحور كله بيتشال، والمتوسط بيتحسب على الموجود بس.
  <br>النتيجة العملية: التقييم بيتأثر بـ<b>نسبة البيانات المتاحة</b> — ده عمود الثقة.
  سهم بياناته ناقصة ممكن يطلع تقييمه أعلى من سهم بياناته كاملة، وده <b>عيب في الرقم لا في الشركة</b>.
  <br>عشان كده <b>الثقة</b> عمود مستقل، ولازم تقراه مع التقييم.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">القرار (تجميع / احتفظ / متابعة / غير كافٍ) بيتحسب إزاي؟</div>
  <div class="sv-exa">القرار <b>مش نسخة من التقييم</b> — هو نفس التقييم بعد شروط:
  <br><br>
  <b>① لو الثقة أقل من 40%</b> (يعني بيانات ناقصة) → القرار <b>«غير كافٍ»</b> مهما كان التقييم.
  لأن رقم اتحسب من بيانات ناقصة <b>مش رقم يُبنى عليه قرار</b>.
  <br><br>
  <b>② لو مفيش جودة ولا قيمة</b> (يعني البيانات كلها زخم وسيولة) → <b>«متابعة»</b>.
  لأنك بتعرف سلوك السهم، مش الشركة اللي وراه.
  <br><br>
  <b>③ لو فيه مؤشر واحد بس</b> من الجودة أو القيمة → لازم التقييم <b>60</b> على الأقل عشان ياخد «احتفظ».
  <br><br>
  <b>④ لو الجودة والقيمة موجودين مع بعض</b> (يعني البيانات كافية فعلاً):
  <br>· <b>تجميع</b> = التقييم عدّى الحد، والحد بيتحسب حسب الثقة: كل ما الثقة قلّت، الحد علا.
  <br>· <b>احتفظ</b> = عدّى حد تاني أقل.
  <br>· <b>متابعة</b> = قريب من الحد بس لسه.
  <br>· <b>غير كافٍ</b> = بعيد عن أي حد.
  <br><br>
  <b>النقطة الجوهرية:</b> القرار <b>بيخزّن جودة البيانات جوه نفسه</b>.
  سهم تقييمه 70 بثقة 100% بياخد قرار أقوى من سهم تقييمه 70 بثقة 40%، لأن الأول اتحسب على أرقام أكتر.
  <br>⚠️ القرار <b>مش توقّع</b>. هو تصنيف نسبي، ممكن يتغير لو السوق اتقلب أو البيانات اتحدّثت.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">ليه التقييم بيفرق عن السعر؟</div>
  <div class="sv-exa">لأن <b>السعر مش جزء من الحساب</b>. التقييم بيقيس الشركة، والسعر بيحدد
  <b>القيمة</b> بس.
  <br>شركة ممتازة بس سعرها غالي → التقييم <b>منخفض</b>. نفس الشركة لو سعرها نزل → التقييم <b>علا</b>.
  <br>ده التصميم الصح: التقييم بيديك <b>ترتيب الشركات</b>، والسعر بيديك <b>نقطة الدخول</b>.
  <br>⚠️ وده معناه: سهم تقييمه 70 مش معناه «اشتري دلوقتي». معناه «لو سعره مناسب، دي من أحسن الشركات».</div>
  </div>
  </div>
  <div class="sv-ab-sec">
  <div class="sv-ab-t">📊 المؤشرات التاريخية — محسوبة من سعر السهم</div>
  <div class="sv-ex">
  <div class="sv-exq">أقصى هبوط (MDD) يعني إيه؟</div>
  <div class="sv-exa">أكبر نزول حصل للسهم من قمته. لو نزل من 100 لـ60، أقصى هبوط = <b>40%</b>.
  <br>فيه نسختين في الجدول: <b>هبوط سنة</b> (آخر 12 شهر)، و<b>أقصى هبوط تاريخي</b> (من أول البيانات).
  <br><b>رقم أقل = صمود أكتر.</b>
  <br>· <b>هبوط السنة</b>: تحت 25% = هبوط معقول · فوق 50% = السهم خسر نص قيمته في سنة.
  <br>· <b>التاريخي</b>: وسيط السوق المصري حوالي <b>82%</b> — يعني أغلب الأسهم مرّت بهبوط
  قريب منضياع الفلوس كاملة. ده مش غريب في سوق نقدته ضعيفة، بس بيوضح إن
  <b>الصمود على المدى الطويل نادر</b>.
  <br>⚠️ الرقم <b>مش توقّع</b>. السهم اللي هبط 90% ممكن يهبط تاني، وممكن يرجع.
  هو بيقولك إيه اللي حصل، مش إيه اللي هيحصل.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">العائد مقابل المخاطرة (Sharpe) ومؤشر سورتينو (Sortino) يعني إيه؟</div>
  <div class="sv-exa">الاتنين بيقيسوا: <b>العائد الزائد فوق العائد الآمن</b> مقسوم على <b>المخاطرة</b>.
  <br>الفرق الوحيد: <b>شارب</b> بيقيس المخاطرة كلها (صعود وهبوط)، و<b>سورتينو</b> بيقيس
  <b>النزول السالب بس</b> — فسورتينو أدق لو أنت خايف على رأس مالك.
  <br><b>رقم أعلى = ربح أكبر مقابل نفس المخاطرة.</b> فوق 1 = العائد الزائد أكبر من التقلّب.
  <br>⚠️ الرقم <b>مش عائد مضمون</b> — هو مقياس <b>سلوك ماضٍ</b>. سهم شارب 2 ممكن يكون متحمس
  دلوقتي ومعرض لتصحيح.
  <br>⚠️ بيتحسب على <b>3 سنين</b>، فشركة عمرها سنتين مش بتاخده. وفي السوق المصري
  متاح لنحو <b>62%</b> من الأسهم بس.
  <br>⚠️ و<bdi>سورتينو</bdi> في بياناتنا بأرقام كبيرة (وسطها <b>33</b>) لأن حسابه بيستخدم
  الانحراف المعياري <b>اليومي</b> لا الشهري، فمرجع المقارنة مختلف. اقرأه نسبياً مش مطلقاً.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">النمو على 3 سنين والمسافة من القمة يعني إيه؟</div>
  <div class="sv-exa"><b>النمو المركّب على 3 سنين</b> = النمو السنوي المتوسط (اتكلمنا عنه في
  المستوى الخبير). أعلى = الشركة بتكبر. بس تذكّر: مبني على <b>السعر</b>، ومتاح لـ<b>62%</b> من الأسهم.
  <br><br>
  <b>المسافة من أعلى 52 أسبوع</b> بتقولك السهم واقف فين من قمته:
  <br>· <b>0%</b> = على القمة بالظبط. · <b>-25%</b> = نزل ربع من القمة. · <b>-50%</b> = نص سعره راح.
  <br><b>رقم أقل = بعيد عن القمة.</b> وده <b>مش دليل رخيص</b> — السهم النازل ممكن يكون شركة
  فاشلة، وممكن يكون فرصة. الرقم بيقولك «إيه اللي حصل» بس.
  <br>⚠️ القمة على 52 أسبوع مش معناها «قيمته الحالية قريبة منها». القيمة الدفترية ممكن تكون بعيدة تماماً.</div>
  </div>
  <div class="sv-ex">
  <div class="sv-exq">رأس المال الحر (float) يعني إيه؟</div>
  <div class="sv-exa">عدد الأسهم اللي <b>بتتداول فعلياً</b> في السوق، من غير الأسهم المحجوزة
  عند مؤسسين أو عند الحكومة أو في خزائن الشركات القابضة.
  <br>كل ما الـ<bdi>float</bdi> <b>أقل</b>، أي كمية بتتم التداول عليها بتزحزح السعر أكتر —
  يعني <b>سيولة أقل</b> وتذبذب أعلى.
  <br>· <b>حجم حر كبير</b> = سوق واسع، تقدر تدخل وتخرج بسهولة.
  <br>· <b>حجم حر صغير</b> = أسهل في الصعود، وأصعب في الخروج وقت ما تحتاج تبيع.
  <br>⚠️ الرقم بيأثر على <b>قابلية التنفيذ</b> مش على قيمة الشركة. سهم ممتاز بحجم حر صغير
  ممكن يكون <b>أصعب تبيعه في الوقت المناسب</b> من سهم عادي بحجم حر كبير.</div>
  </div>
  </div>
  <div class="sv-ab-sec">
  <div class="sv-ab-t">⚠️ حدود <bdi>OCTA</bdi> — لازم تعرفها قبل ما تاخد قرار</div>
  <div class="sv-warn">
  ⚠️ <b>مش نصيحة استثمارية.</b> التقييم ترتيب نسبي بين الأسهم، مش وعد بالربح ولا سعر مستهدف.
  <br>⚠️ <b>البنوك والعقارات</b> محتاجة معايير مختلفة — بتتقاس بمضاعف الكتاب لا بمضاعف الربحية.
  <br>⚠️ <b>الأسهم الناقصة بيانات</b> بترجع «غير كافٍ» — وده أأمن من التخممين.
  <br>⚠️ <b>الأرقام من <bdi>TradingView</bdi></b> مع ملف الأسعار التاريخي، وفيه تأخير يوم أو يومين عن السعر الحالي.
  <br>⚠️ <b>المؤشرات التاريخية</b> محسوبة من <b>السعر</b> لا من الشركة — مفيش ضمان إن السعر رجع يقيس الشركة.
  <br>⚠️ <b>كل الأرقام زمانها 2026-10-09</b>. السوق بيتغيّر كل يوم — اقرأ التاريخ قبل ما تحكم.
  </div>
  </div>`;
  return '';
  }

  /* gl — الكارت: العنوان + الشرح
  ملاحظة: الوصف د (d) مسموح فيه HTML (b/br) عشان «يعني إيه؟» يبان سطر لوحده
  بس لازم نهرّب أي نص جاي من الداتا — عشان كده بنعمل split */
  /* ──────────────────────────────────────────────────────────
  *  عزل النص الإنجليزي عن العربي
  *  ──────────────────────────────────────────────────────────
  *  المشكلة: سطر فيه عربي + إنجليزي بيتلخبط. القارئ
  *  مش بعرف فين الجملة العربية خلصت والإنجليزي بدأ.
  *
  *  الحل: <bdi> — وسم HTML قياسي بيقول للمتصفح
  *  «تعامل مع النص ده ككتلة مستقلة»، فالترتيب
  *  العربي يفضل سليم.
  *
  *  مش بنمسح الكلمة — بنخليها واضحة ومنظمة.
  * ────────────────────────────────────────────────────────── */
  function isolateLatin(text) {
  /*
  * ⛌ الخلل الحقيقي (اتصلّح هنا):
  *  الدالة دي كانت بتلفّ أي كلمة إنجليزية بـ <bdi> على
  *  النص كما هو. لكن `gl()` بيبعتها على نص **فيه تاج HTML**
  *  (`<b>` و `<br>` بعد الـescape). فالـregex كان بيلتقط
  *  **اسم التاج نفسه**:
  *  <b>  →  <bdi>b</bdi>>  /t<ajax مبظوم>/
  *  </b> →  <bdi>b</bdi>>  /نفس الحاجة/
  *  <br> →  <bdi>br</bdi>>  /نفس الحاجة/
  *  النتيجة: التاج اتدمّر + حروف لاتينية زفت (b / br) ظهرت
  *  في أول الفقرة. ولأن الـCSS كان `unicode-bidi:plaintext`
  *  (= أول حرف قوي يحدد اتجاه الفقرة) — الحرف القوي الأول بقى
  *  لاتيني، فالفقرة كلها اتقلبت LTR والعربي اتقرا مقلوب.
  *
  * الحل: نقسّم النص لـ chunks، ونلفّ اللاتيني في chunk النص بس.
  * التاجات (<?>) وكيانات HTML (&gt; &lt; &amp; …) بتعدي زي ما هي.
  *
  * ⛌ والـregex القديم كان كمان بيبلع الـquote اللي قبل الكلمة،
  *  فطلع «(RSI)» كـ «(' RSI')» — علامات غلط.
  *  كلمة إنجليزية لازم تبدأ بحرف وتخلص قبل أي رمز غير إنجليزي.
  */
  /*
  * الـregex بياخد الكلمة مع الأقواس اللي حواليها (اختيارياً).
  * ده مهم: «(RSI)» بتتفلو كوحدة واحدة. لو لفّينا الكلمة لوحدها
  * والأقواس برّه، المتصفح بيرتّب الأقواس على ناحية وتسبب
  * «(RSI )أو» و«(OCTA» ناقصة.
  *
  * (?<![\w])|(?![\w]) — بنمنع الكلمة من جوه كلمة تانية،
  * وtrim() عشان المسافات جوه الأقواس ماتبقاش جوه الـbdi.
  */
  const RE = /[\(\[]?\s*([A-Za-z][A-Za-z0-9]*(?:[.\/][A-Za-z0-9]+)*)\s*[\)\]]?/g;
  /* ['<tag>' | '&entity;' | 'نص'] — الـcapture بيخليهم يتقروا منفصلين.
  (?:amp;)? عشان كيان زي «&gt;» بعد الـescape بيبقى «&amp;gt;» */
  return String(text)
  .split(/(<[^<>]*>|&(?:amp;)?(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)/g)
  .map(part => {
  if (!part) return '';
  const c = part.charAt(0);
  if (c === '<' || c === '&') return part;  /* تاج أو كيان — نلمسهوش */
  /*
  * ⛔ الكلمة لازم تكون «مستقلة» — يعني surrounded بمسافة أو
  *  حد الجملة. لو ملزوقة بحرف عربي على جنبها (زي «تunderlying»)
  *  نسيبها زي ما هي بدل ما نقطعها في النص.
  */
  return part.replace(RE, function (m, off, str) {
  const before = off > 0 ? str[off - 1] : ' ';
  const after = (off + m.length < str.length) ? str[off + m.length] : ' ';
  if (/[\u0600-\u06FF]/.test(before) || /[\u0600-\u06FF]/.test(after)) return m;
  return '<bdi>' + m.trim() + '</bdi>';
  });
  })
  .join('');
  }

  const gl = (t, d) => {
  let desc = String(d == null ? '' : d);
  let ttl = String(t == null ? '' : t);
  /* نسمح بـ <b> و <br> بس — أي تاج تاني بيتشال بالكامل */
  if (/<(b|br)[\s/>]/i.test(desc)) {
  desc = esc(desc)
  .replace(/&lt;b&gt;/gi, '<b>').replace(/&lt;\/b&gt;/gi, '</b>')
  .replace(/&lt;br\s*\/?&gt;/gi, '<br>');
  /* حما إضافية: نشيل أي on* handler أو javascript: */
  desc = desc.replace(/on[a-z]+\s*=\s*(['"])?[^'"\s>]+\1/gi, '');
  desc = desc.replace(/javascript\s*:/gi, '');
  /* ⚠️ الـisolateLatin شغالة وهي واعية بالتاجات — من غير كده
  بتاكل <b> و <br> وبتقلب اتجاه الفقرة (شوف جوهرها) */
  desc = isolateLatin(desc);
  } else {
  desc = isolateLatin(esc(desc));
  }
  return '<div class="sv-g"><b>' + isolateLatin(esc(ttl)) + '</b><span>' + desc + '</span></div>';
  };

  const abR = (a, b) => '<div class="sv-ab-r"><b>' + esc(a) + '</b><span>' + esc(b) + '</span></div>';

  /* ══════════════ الجدول ══════════════ */
  const COLS = [
  { k: 'code', t: 'الرمز', cls: 'c' },
  { k: 'price', t: 'السعر', cls: 'n' },
  { k: 'chg', t: 'التغير %', cls: 'n' },
  { k: 'tv', t: 'التوصية', cls: 'tv' },
  { k: 'pe', t: 'P/E', cls: 'n' },
  { k: 'pb', t: 'P/B', cls: 'n' },
  { k: 'eps', t: 'EPS', cls: 'n' },
  { k: 'roe', t: 'ROE', cls: 'n' },
  { k: 'roe', t: 'ROA', cls: 'n', k2: 'roa' },
  { k: 'de', t: 'دين/الأصول ٪', cls: 'n' },
  { k: 'dy', t: 'عائد', cls: 'n' },
  { k: 'rsi', t: 'RSI', cls: 'n' },
  { k: 'vol', t: 'تذبذب', cls: 'n' },
  { k: 'p1m', t: '1M', cls: 'n' },
  { k: 'p3m', t: '3M', cls: 'n' },
  { k: 'p1y', t: '1Y', cls: 'n' },
  { k: 'vol', t: 'الحجم', cls: 'n', k2: 'volume' },
  { k: 'mc', t: 'القيمة السوقية', cls: 'n' },
  { k: 'employees', t: 'موظفين', cls: 'n' },
  { k: 'sector', t: 'القسم', cls: 'sn' },
  { k: 'act', t: '', cls: 'c' }
  ];

  /* أعمدة OCTA */
  /* ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — الأعمدة دي (ROIC · هبوط سنة · شارب · CAGR)
     ⛌ مش موجودة في /api/markets ⇒ كانت بتطلع «—» لكل ٢٨٤ سهم.
     📌 استبدلناها بأعمدة **موجودة فعلاً** في الـAPI:
     📌   P/B · صافي الربح · الهامش التشغيلي · التقييم · السيولة · التذبذب.
     ⚠️ مفيش عمود «فاضي» — كل عمود إما فيه رقم أو «غير متاح» صراحة. */
  const COLS_O = [
  { k: 'code', t: 'الرمز', cls: 'c' },
  { k: 'price', t: 'السعر', cls: 'n' },
  { k: 'chg', t: 'التغير %', cls: 'n' },
  { k: 'score', t: 'تقييم OCTA', cls: 'n' },
  { k: 'verdict', t: 'القرار', cls: 'tv' },
  { k: 'conf', t: 'الثقة', cls: 'n' },
  { k: 'roe', t: 'ROE', cls: 'n' },
  { k: 'pb', t: 'P/B', cls: 'n' },
  { k: 'pe', t: 'P/E', cls: 'n' },
  { k: 'nm', t: 'صافي ربح %', cls: 'n' },
  { k: 'om', t: 'هامش تشغيلي %', cls: 'n' },
  { k: 'de', t: 'دين/الأصول ٪', cls: 'n' },
  { k: 'dy', t: 'عائد', cls: 'n' },
  { k: 'vol', t: 'تذبذب', cls: 'n', k2: 'volatility' },
  { k: 'rvol', t: 'حجم نسبي', cls: 'n', k2: 'rel_volume' },
  { k: 'upside', t: 'فرصة %', cls: 'n' },
  { k: 'p1y', t: 'أداء سنة', cls: 'n' },
  { k: 'sector', t: 'القسم', cls: 'sn' },
  { k: 'act', t: '', cls: 'c' }
  ];

  function tbl(rows) {
  const cols = (S.mode === 'octa') ? COLS_O : COLS;
  /* ⛔⛔⛔ ٢١ أكتوبر ٢٠٢٦ — مؤشّر السحب على الموبايل
     ⛌ الجدول أعرض من الشاشة — والمستخدم مش عارف إن في سحب.
     ⛌ دلوقتي: شريط صغير فوق الجدول بيقول «اسحب» وبيختفي بعد أول حركة. */
  return '<div class="sv-scroll-hint" id="svScrollHint">' +
  '<span>←</span> اسحب الجدول عشان تشوف باقي الأعمدة <span>←</span>' +
  '</div><div class="sv-wrap"><table class="sv-tbl"><thead><tr>' +
  cols.map(function (c) {
  const sk = c.k2 || c.k;
  const sortable = c.k !== 'act';
  return '<th class="' + c.cls + '"' + (sortable ?
  ' onclick="scSort(\'' + sk + '\')" style="cursor:pointer"' : '') + '>' + c.t +
  (S.sort === sk ? '<i class="sv-ar">' + (S.dir < 0 ? '▼' : '▲') + '</i>' : '') + '</th>';
  }).join('') + '</tr></thead><tbody>' +
  rows.map(row).join('') + '</tbody></table></div>';
  }

  function rowO(s) {
  const px = N(s.price) || 0;
  const ch = N(s.change);
  const dcls = ch > 0 ? 'up' : ch < 0 ? 'dn' : '';
  const nm = s.name || '';
  const verdict = s.verdict || '—';
  const vcls = verdict === 'إشارة إيجابية' ? 'dg' : verdict === 'إشارة سلبية' ? 'db' :
  verdict === 'إشارة محايدة' ? 'dk' : 'na';
  const sc = N(s.total) || 0;
  const scC = sc >= 70 ? 'gg' : sc >= 50 ? 'gm' : 'ym';
  const cP = function (v, g, b) { return v == null ? 'na' : v >= g ? 'gg' : v <= b ? 'rm' : 'ym'; };

  return '<tr class="sv-tr">' +
  '<td class="c sv-idw">' +
  '<button class="sv-id" onclick="event.stopPropagation();openChart(\'' + s.code + '\',\'' + esc(nm) + '\',\'' + window.__scMarket + '\',\'' + (s.tvSymbol || '') + '\')" title="افتح الرسم البياني">' +
  logoHTML(s.code) +
  '<span class="sv-txt"><b>' + esc(s.code) + '</b>' + (nm ? '<i>' + esc(nm) + '</i>' : '') + '</span>' +
  '</button></td>' +
  '<td class="n"><b' + (s._halted ? ' class="halt"' : '') + '>' + f2(px) + '</b> <i class="sv-cur">' + M.cur + '</i>' +
  (s._halted ? '<span class="sv-halt" title="مصدرنا لسه ماجابش سعر محدّث لهذا السهم — الرقم ده آخر سعر وصلنا، مش سعر النهاردة">سعر قديم</span>' : '') + '</td>' +
  '<td class="n ' + dcls + '">' + (sg(ch) || '—') + '</td>' +
  '<td class="n"><span class="sv-badge ' + scC + '">' + f0(sc) + '</span></td>' +
  '<td class="tv"><span class="sv-tv ' + vcls + '">' + esc(verdict) + '</span></td>' +
  '<td class="n ' + (s.conf == null ? 'na' : s.conf >= 70 ? 'gg' : s.conf >= 50 ? 'ym' : 'rm') + '">' +
  (s.conf != null ? f0(s.conf) + '%' : '—') + '</td>' +
  '<td class="n ' + cP(s.roe, 20, 5) + '">' + (s.roe != null ? f0(s.roe) + '%' : '—') + '</td>' +
  '<td class="n ' + cP(s.pb, 2, 0) + '">' + (s.pb && s.pb > 0 ? f1(s.pb) : '—') + '</td>' +
  '<td class="n ' + cP(s.pe, 12, 0) + '">' + (s.pe && s.pe > 0 ? f1(s.pe) : '—') + '</td>' +
  '<td class="n ' + cP(s.nm, 10, 0) + '">' + (s.nm != null ? f1(s.nm) + '%' : '—') + '</td>' +
  '<td class="n ' + cP(s.om, 15, 0) + '">' + (s.om != null ? f1(s.om) + '%' : '—') + '</td>' +
  /* 🔴 de نسبة (1.0 = 100٪). الكود كان cP(s.de, 50, 100) ⇒ كل سهم أحمر،
     و f0(s.de) من 0.44 = «0» ⇒ العمود كان بيعرض صفر لكل السهم.
     الصح: نحول لنسبة مئوية ونقارن على 50٪ و100٪. */
  '<td class="n ' + cP(s.de != null ? s.de*100 : null, 50, 100) + '">' + (s.de != null ? f0(s.de*100) + '٪' : '—') + '</td>' +
  '<td class="n ' + cP(s.dy, 5, 0) + '">' + (s.dy != null ? f2(s.dy) + '%' : '—') + '</td>' +
  '<td class="n ' + cP(s.volatility, 60, 30) + '">' + (s.volatility != null ? f0(s.volatility) : '—') + '</td>' +
  '<td class="n ' + cP(s.rel_volume, 1.5, 0.6) + '">' + (s.rel_volume != null ? f2(s.rel_volume) + '×' : '—') + '</td>' +
  '<td class="n ' + cP(s.upside, 20, 0) + '">' + (s.upside != null ? f1(s.upside) + '%' : '—') + '</td>' +
  '<td class="n ' + dirCls(s.p1y) + '">' + (sg(s.p1y) || '—') + '</td>' +
  '<td class="sn">' + esc(sectorAr(s)) + '</td>' +
  '<td class="c"><button class="sv-bell" onclick="event.stopPropagation();watchEdit(\'' + s.code + '\')">🔔</button></td>' +
  '</tr>';
  }

  function row(s) {
  if (S.mode === 'octa') return rowO(s);
  const px = N(s.price) || 0;
  const ch = N(s.change);
  const tv = tvVerdict(s);
  const dcls = ch > 0 ? 'up' : ch < 0 ? 'dn' : '';
  const nm = s.name || '';

  const cP = (v, g, b) => v == null ? 'na' : v >= g ? 'gg' : v <= b ? 'rm' : 'ym';
  const peC = cP(s.pe, 12, 0);
  const pbC = cP(s.pb, 2, 0);
  const epsC = cP(s.eps, 3, 0);
  const roeC = cP(s.roe, 20, 5);
  const roaC = cP(s.roa, 10, 0);
  /* 🔴 de نسبة (1.0 = 100٪) — المقارنة بـ 50/150 كانت على 0.44 ⇒ كل سهم أحمر */
  const deC = s.de == null ? 'na' : s.de <= 0.6 ? 'gg' : s.de <= 1.5 ? 'ym' : 'rm';
  const dyC = cP(s.dy, 5, 0);
  const rsiC = s.rsi == null ? 'na' : s.rsi > 70 ? 'rm' : s.rsi > 60 ? 'ym' : s.rsi > 40 ? 'gm' : s.rsi > 30 ? 'gm' : 'gg';
  const volC = s.volD == null ? 'na' : s.volD < 1.5 ? 'gg' : s.volD < 3 ? 'gm' : s.volD < 5 ? 'ym' : 'rm';

  return '<tr class="sv-tr">' +
  '<td class="c sv-idw">' +
  '<button class="sv-id" onclick="event.stopPropagation();openChart(\'' + s.code + '\',\'' + esc(nm) + '\',\'' + window.__scMarket + '\',\'' + (s.tvSymbol || '') + '\')" title="افتح الرسم البياني">' +
  logoHTML(s.code) +
  '<span class="sv-txt"><b>' + esc(s.code) + '</b>' + (nm ? '<i>' + esc(nm) + '</i>' : '') + '</span>' +
  '</button>' +
  '</td>' +
  '<td class="n"><b' + (s._halted ? ' class="halt"' : '') + '>' + f2(px) + '</b> <i class="sv-cur">' + M.cur + '</i>' +
  (s._halted ? '<span class="sv-halt" title="مصدرنا لسه ماجابش سعر محدّث لهذا السهم — الرقم ده آخر سعر وصلنا، مش سعر النهاردة">سعر قديم</span>' : '') + '</td>' +
  '<td class="n ' + dcls + '">' + (sg(ch) || '—') + '</td>' +
  '<td class="tv"><span class="sv-tv ' + tv.cls + '">' + esc(tv.t) + '</span></td>' +
  '<td class="n ' + peC + '">' + (s.pe && s.pe > 0 ? f1(s.pe) : '—') + '</td>' +
  '<td class="n ' + pbC + '">' + (s.pb && s.pb > 0 ? f2(s.pb) : '—') + '</td>' +
  '<td class="n ' + epsC + '">' + (f2(s.eps) || '—') + '</td>' +
  '<td class="n ' + roeC + '">' + (s.roe != null ? f0(s.roe) + '%' : '—') + '</td>' +
  '<td class="n ' + roaC + '">' + (s.roa != null ? f0(s.roa) + '%' : '—') + '</td>' +
  /* نفس التصحيح: de نسبة 1.0 = 100٪ — العرض ف0(s.de) كان بيطلع «0» لكل سهم */
  '<td class="n ' + deC + '">' + (s.de != null ? f0(s.de*100) + '٪' : '—') + '</td>' +
  '<td class="n ' + dyC + '">' + (s.dy != null ? f2(s.dy) + '%' : '—') + '</td>' +
  '<td class="n ' + rsiC + '">' + (f0(s.rsi) != null ? f0(s.rsi) : '—') + '</td>' +
  '<td class="n ' + volC + '">' + (s.volD != null ? f2(s.volD) : '—') + '</td>' +
  '<td class="n ' + dirCls(s.p1m) + '">' + (sg(s.p1m) || '—') + '</td>' +
  '<td class="n ' + dirCls(s.p3m) + '">' + (sg(s.p3m) || '—') + '</td>' +
  '<td class="n ' + dirCls(s.p1y) + '">' + (sg(s.p1y) || '—') + '</td>' +
  '<td class="n">' + (big(s.volume) || '—') + '</td>' +
  '<td class="n">' + (big(s.mc) || '—') + '</td>' +
  '<td class="n">' + (big(s.employees) || '—') + '</td>' +
  '<td class="sn">' + esc(sectorAr(s)) + '</td>' +
  '<td class="c"><button class="sv-bell" onclick="event.stopPropagation();watchEdit(\'' + s.code + '\')">🔔</button></td>' +
  '</tr>';
  }

  /* ══════════════ API ══════════════ */
  window.scSetMarket = function (id) {
  const m = MARKS.find(x => x.id === id); if (m) M = m;
  window.__scMarket = M.id;  /* نمرّرها للشارت */
  S.shown = 40; render();
  S.live = false; S.lastQ = null; renderLiveDot(); tickLive();
  };
  window.scQInput = function (el) {
  const v = el.value, p = el.selectionStart;
  S.q = v; S.shown = 40; render();
  const n = document.getElementById('scQ');
  if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (e) { } }
  };
  window.scQ = v => { S.q = v || ''; S.shown = 40; render(); };
  window.scSect = v => { S.sect = v; S.shown = 40; render(); };
  window.scAdv = () => { S.advOpen = !S.advOpen; render(); };
  window.scAbout = () => { S.aboutOpen = !S.aboutOpen; render(); };
  window.scLvl = function (l) { S.lvl = l; render(); };
  window.scGrp = g => { S.grp = g; render(); };
  window.scGrpO = function (g) { S.grpO = g; render(); };
  window.scMode = function (m) {
  if (S.mode === m) return;
  S.mode = m;
  S.shown = 40;
  if (m === 'octa' && S.grp === 'all') S.grp = 'qual';
  /* ⛌ تغيير الوضع يدوياً يلغي الـpreset — Conditions بتتغيّر */
  S.preset = null;
  render();
  };
  window.scSel = (k, v) => { S[k] = v || null; S.shown = 40; render(); };
  /* إدخال رقم — بيحافظ على التركيز والـcursor مثل السيرش */
  window.scInp = function (k, el, mn, mx) {
  const pos = el.selectionStart;
  let v = el.value;
  /* لو المستخدم كاتب سالب في خانة من 0 — سيبه */
  let n = parseFloat(v);
  if (!isNaN(n)) { n = Math.max(mn, Math.min(mx, n)); }
  S[k] = isNaN(n) ? null : n;
  S.shown = 40;
  render();
  const again = document.getElementById('f_' + k);
  if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { } }
  };

  window.scNum = function (k, v, mn, mx) {
  const n = parseFloat(v);
  S[k] = isNaN(n) ? null : Math.max(mn, Math.min(mx, n));
  S.shown = 40; render();
  };
  window.scSort = function (k) {
  if (S.sort === k) { S.dir = -S.dir; }
  else {
  S.sort = k;
  /* الأرقام والتنصنيفات: أول ضغطة = تنازلي (الأعلى/الأقوى فوق)
  الأسماء: أول ضغطة = تصاعدي (أ-ي) */
  S.dir = (k === 'code' || k === 'name' || k === 'sector') ? 1 : -1;
  }
  /* ⛌ ترتيب يدوي يلغي الـpreset — الترتيب جزء من شروط الـpreset */
  if (S.preset) S.preset = null;
  render();
  };
  window.scMore = () => { S.shown += 40; render(); };
  window.scReset = function () {
  Object.keys(S).forEach(function (k) {
  if (k !== 'q' && k !== 'sect' && k !== 'sort' && k !== 'dir' &&
  k !== 'shown' && k !== 'advOpen' && k !== 'aboutOpen' &&
  k !== 'grp' && k !== 'grpO' && k !== 'mode' && k !== 'lvl' &&
  k !== 'preset') S[k] = null;
  });
  S.q = ''; S.sect = 'all'; S.shown = 40; S.preset = null;
  render();
  };

  /* ══════════════════════════════════════════════════════════════
  🎯 الفلاتر السريعة — الكتابة بتحدّث النتيجة فوراً
  ──────────────────────────────────────────────────────────────
  📌 زي السيرش: بنحافظ على التركيز والـcursor بعد الرندر،
  ⛌   عشان المستخدم يقدر يكتب رقم ويفضّله.
  ⛌ ⛌ ⛌ مهم: الرندر بيعيد بناء الـDOM ⇒ لو رجعنا التركيز
  ⛌   بس من غير الـselectionStart، المؤشر بيروح لأول الخانة.
  ══════════════════════════════════════════════════════════════ */
  window.scQuick = function (k, el, mn, mx) {
  const pos = el.selectionStart;
  let n = parseFloat(el.value);
  if (!isNaN(n)) n = Math.max(mn, Math.min(mx, n));
  S[k] = isNaN(n) ? null : n;
  S.shown = 40;
  S.preset = null;   /* ⛌ تعديل يدوي يلغي الـpreset */
  render();
  const again = document.getElementById('q_' + k);
  if (again) {
  again.focus();
  try { again.setSelectionRange(pos, pos); } catch (e) { }
  }
  };

  /* ══════════════════════════════════════════════════════════════
  ⭐ الأمثلة السريعة — زرار واحد يعمّي كل الفلترة
  ──────────────────────────────────────────────────────────────
  📌 الـpreset بيمسح كل الفلاتر الأول — عشان النتيجة تبقى
  ⛌   واضحة («دي نتيجة條件 دا بالظبط» مش «دة نتيجة条件和 stacked»).
  ══════════════════════════════════════════════════════════════ */
  window.scPreset = function (id) {
  /* ⛔ مسح كل الفلاتر (من غير البحث والوضع) */
  const keep = { q: 1, sect: 1, sort: 1, dir: 1, shown: 1, advOpen: 1,
  aboutOpen: 1, grp: 1, grpO: 1, mode: 1, lvl: 1, preset: 1 };
  Object.keys(S).forEach(function (k) { if (!keep[k]) S[k] = null; });
  S.q = ''; S.sect = 'all'; S.shown = 40;
  if (!id) { S.preset = null; render(); return; }
  const p = PRESETS.find(function (x) { return x.id === id; });
  if (!p) { S.preset = null; render(); return; }
  S.preset = id;
  p.apply();
  S.shown = 40;
  render();
  };

  /* ══════════════════════════════════════════════════════════════
  🔓 تخفيف فلتر واحد (من رسالة «لا نتائج» أو من الشيب)
  ──────────────────────────────────────────────────────────────
  📌 بيشيل الفلتر ده بس — والباقي زي ما هو.
  ══════════════════════════════════════════════════════════════ */
  window.scRelax = function (k) {
  S[k] = null;
  S.preset = null;
  S.shown = 40;
  render();
  };
  let MK_DONE = false;
  /* ⛔⛔⛔ ٢١ أكتوبر ٢٠٢٦ — داتا السوق بقت من الـAPI المحمي.
  ⛌ قبل كده: <script src="data/data_markets.js"> — ٣٫٤ ميجا
  ⛌   كانوا بينزّلوا من غير أي توكن = تسريب تنافسي.
  ⛌ دلوقتي: /api/markets?market=<السوق> — محمي، ومقسّم
  ⛌   (مصر ٣٩٠ ك.ب بدل ٣٫٤ ميجا لكل صفحة).
  ⛌ ⛌ الـfallback للملف الثابت بيفضل شغّال لحد ما الـAPI
  ⛌    يتنشر — وبعدها الملف بيتشال من حزمة النشر نهائياً. */
  // ⛔⛔⛔ ٢١ أكتوبر ٢٠٢٦ — fallback للملف الثابت محذوف.
  // ⛌ الـAPI /api/markets محمي ومقسم — كل الحمل بقى في الخادم.
  // ⛌ ⛌ لو الـAPI رجع 401 (مفيش توكن)، الـscreener لسه يقدر
  // ⛌ يشتغل لأن البيانات تيجي من LIVE_DATA المحلي في octa-core.
  function loadStaticMK(cb) {
  if (typeof cb === 'function') cb();
  }
  function loadMK(cb) {
  const d = mkData();
  if (MK_DONE && d && d[M.id] && d[M.id].length) { cb(); return; }
  /* ⭐ ٢٥ أكتوبر ٢٠٢٦ — لو EGX_DB اتحمّل ⇒ فيه كل الحقول الغنية
     ⛔ ⇒ نكتفي بيه (أغنى من /api/markets). */
  try {
  if (typeof window !== 'undefined' && window.EGX_DB && Object.keys(window.EGX_DB).length) {
  MK = { egypt: window.EGX_DB };
  MK_DONE = true;
  cb();
  return;
  }
  } catch (e) { }
  const base = (typeof window !== 'undefined' && window.OCTA_API) || '';
  const url = base + '/api/markets?market=' + encodeURIComponent(M.id);
  let done = false;
  function finish() { if (!done) { done = true; cb(); } }
  try {
  fetch(url, { cache: 'no-store' })
  .then(function (r) { return r.ok ? r.json() : null; })
  .then(function (j) {
  if (j && j[M.id] && j[M.id].length) {
  MK = j; MK_DONE = true; finish(); return;
  }
  loadStaticMK(finish);
  })
  .catch(function () { loadStaticMK(finish); });
  } catch (e) { loadStaticMK(finish); }
  }

  window.scInit = function () {
  window.__scMarket = M.id;
  render();
  /* ⭐ ٢٥ أكتوبر ٢٠٢٦ — نستنى `octaLoadDB` (بيجيب EGX_DB الغني)
     ⛔ قبل ما نرسم. ⛔ من غير كده: الفلتر بيرسم بصفوف فاضية
     ⛔   ومحدش بيعرف يعيد الرسم بعد ما الداتا توصل. */
  const wait = (typeof octaLoadDB === 'function')
  ? Promise.resolve().then(function () { return octaLoadDB(); }).catch(function () { })
  : Promise.resolve();
  wait.then(function () {
  MK = null;           /* ⛔ نخلّي mkData تقرا EGX_DB تاني */
  render();
  loadMK(function () { render(); startLive(); });
  });
  };

  /* ⛔ كان غلاف رابع لـswitchPage وبيعمل scInit **متلتين**
     (مرة هنا ومرة في switchPage نفسه). اتشال الغلاف —
     switchPage أصلاً بينادي scInit لوحده. */

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.scInit);
  else setTimeout(window.scInit, 300);

})();
/* ══════════════════════════════════════════════════════════════
  👆 إخفاء مؤشّر السحب بعد أول حركة
  ──────────────────────────────────────────────────────────────
  ⛔ ٢١ أكتوبر ٢٠٢٦ — المؤشّر بيشيل نفسه أول ما المستخدم يسحب
  ⛌ عشان مايفضلش Fraud في الشاشة بعد ما فهم.
  ══════════════════════════════════════════════════════════════ */
(function () {
  if (typeof document === 'undefined') return;
  let done = false;

  function hideHint() {
    if (done) return;
    done = true;
    const h = document.getElementById('svScrollHint');
    if (!h) return;
    h.style.transition = 'opacity .3s, max-height .3s';
    h.style.opacity = '0';
    h.style.maxHeight = '0';
    h.style.padding = '0';
    h.style.marginBottom = '0';
    h.style.overflow = 'hidden';
    setTimeout(function () { h.remove(); }, 350);
  }

  document.addEventListener('touchstart', function (e) {
    if (e.target && e.target.closest && e.target.closest('.sv-wrap')) hideHint();
  }, { passive: true, once: true });

  document.addEventListener('wheel', function (e) {
    if (e.target && e.target.closest && e.target.closest('.sv-wrap') && Math.abs(e.deltaX) > 12) {
      hideHint();
    }
  }, { passive: true, once: true });

  /* على الموبايل بس — بعد ١٠ ثواني نخفيه عشو كمان */
  if (window.matchMedia && window.matchMedia('(max-width: 680px)').matches) {
    setTimeout(hideHint, 10000);
  }
})();
