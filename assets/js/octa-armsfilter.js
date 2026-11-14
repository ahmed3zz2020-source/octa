/* ═══ OCTA · octa-armsfilter.js · فلتر الأذرع ═══
  ═══════════════════════════════════════════════════════════
  ⚠ القاعدة الذهبية في الملف ده:
  الذراع بيعرض ** نفس الرقم ** اللي دخل في مجموع OCTA.
  مفيش حساب تاني ولا تقريب ولا رواية تانية.

  يعني لو اخترت «الأساسي»، أنت بتقرأ sect.q بالظبط —
  نفس القيمة اللي اتضربت في 22% وجمعت في الدرجة النهائية.
  ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── الأذرع الثمانية ──
  sext = الحقل داخل OS_DB (مجاني 100%)
  src  = مصدر الرقم — بيتعرض للمستخدم
  cov  = التغطية (بيتحسب وقت التشغيل، مش مكتوب يدوي) */
  /* قراءة الدرجة من أي مكان محفوظة فيه — خطأ تطبيع واحد
  يكفي يخلي الفلتر يرجع صفر صف من غير ما يبان */
  function ax(s, k) {
  var sc = s.sect || s.sections;
  if (sc && sc[k] != null) return sc[k];
  return s[k];
  }

  /* ═══ الطبقة الحية (المحرك الحيّ) ═══
  📌⭐ ١٤ نوفمبر ٢٠٢٦ — إصلاح جوهري:
     ① «التقييم» كان بيعرض **حجم التداول** (الحقل v في السجل ده
        الحجم مش درجة!) ⇒ أرقام زي ٤٦٤٢٧٢٢١٤٧ مش ليها معنى.
        دلوقتي = درجة تقييم ٠-١٠٠ من مضاعف الربحية والقيمة الدفترية
        (نفس «محور التقييم ١٥٪» في نور ⇒ رقم واحد في كل مكان).
     ② باقي المحاور كانت بتقرأ السجل القديم (٩ أكتوبر) بينما
        «المجموع» من اليوم ⇒ «الفرق» كان رقم مش ليه معنى.
        دلوقتي كل محور من نفس اللحظة (/api/markets?market=egypt).
     📌 لو الطلب فشل ⇒ بنرجع للسجل ونقول للمستخدم إن الأرقام قديمة. */
  var LIVE = null;         /* code → صف حي */
  var LIVE_STATE = 'idle'; /* idle | loading | ok | error */
  var LIVE_ERR = '';
  var LIVE_TS = '';
  var VAL_CACHE = {};      /* كود ← درجة التقييم */

  function num(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  return isFinite(n) ? n : null;
  }

  function liveRow(code) { return LIVE ? LIVE[code] : null; }

  /* ⭐ درجة المحور من الطبقة الحية — لو مش موجودة ⇒ السجل */
  function axLive(s, axisKey, oldKey) {
  var L = liveRow(s.code);
  if (L && L.all_axes && L.all_axes[axisKey] != null) return L.all_axes[axisKey];
  var old = ax(s, oldKey);
  return old == null ? null : old;
  }

  /* ⭐ المضاعف (ربحية/دفترية) محدّث على السعر الحالي:
     الأرباح والقيمة الدفترية دورية · السعر يومي ⇒ نعدّل المضاعف
     بنسبة تغيّر السعر. (المقاس: كومى — ٥٫٩٩ ⇒ ٦٫١٩ = نفس النسبة.) */
  function scaledMult(s, v) {
  var x = num(v);
  if (x == null) return null;
  var pOld = num(s.p), pNow = num(s.price);
  if (pOld && pNow && pOld > 0) return x * (pNow / pOld);
  return x;
  }

  /* ⭐ درجة التقييم (٠-١٠٠) — نفس جداول «محور التقييم» في نور */
  function valScore(s) {
  if (VAL_CACHE[s.code] !== undefined) return VAL_CACHE[s.code];
  var out = null;
  if (typeof nzAxisScore === 'function') {
  try {
  var L = liveRow(s.code);
  var rec = s;
  if (L) {
  rec = Object.assign({}, s, {
  pe: num(L.pe) != null ? num(L.pe) : scaledMult(s, s.pe),
  pb: num(L.pb) != null ? num(L.pb) : scaledMult(s, s.pb),
  price: num(L.price) != null ? num(L.price) : num(s.price)
  });
  }
  var r = nzAxisScore(rec);
  if (r && r.axes) {
  for (var i = 0; i < r.axes.length; i++) {
  if (r.axes[i].id === 'val' && r.axes[i].have > 0) { out = r.axes[i].mean; break; }
  }
  }
  } catch (e) { out = null; }
  }
  VAL_CACHE[s.code] = out;
  return out;
  }

  /* ⭐ نسبة القسيمة — من الطبقة الحية لو موجودة */
  function liveDy(s) {
  var L = liveRow(s.code);
  if (L && num(L.div_yield) != null) return num(L.div_yield);
  return num(s.dy);
  }

  var ARMS8 = [
  { id: 'total', ic: '🐙', n: 'المجموع', d: 'تقييم OCTA الكامل',
  get: function (s) { return num(s.score); }, src: 'محاور المحرك كلها', inTotal: true },
  { id: 'q', ic: '💰', n: 'الأساسي', d: 'جودة الشركة من جوه',
  get: function (s) { return axLive(s, 'fundamental', 'q'); }, src: 'أرباح وعوائد ونسب', inTotal: true, axis: 'fundamental' },
  { id: 'v', ic: '🏷️', n: 'التقييم', d: 'السهم غالي ولا رخيص',
  get: function (s) { return valScore(s); }, src: 'مضاعف الربحية والقيمة الدفترية', derived: true },
  { id: 'm', ic: '📈', n: 'الفني', d: 'حركة السعر والزخم',
  get: function (s) { return axLive(s, 'technical', 'm'); }, src: 'مؤشرات فنية من الرسم البياني', inTotal: true, axis: 'technical' },
  { id: 'lq', ic: '💧', n: 'السيولة', d: 'تقدر تبيع بدري ولا لأ',
  get: function (s) { return axLive(s, 'liquidity', 'lq'); }, src: 'حجم التداول ونسبته', inTotal: true, axis: 'liquidity' },
  { id: 'sf', ic: '🛡️', n: 'الأمان', d: 'السهم بيتزنق قد إيه',
  get: function (s) { var v = num(s.safety); if (v != null) return v; var o = ax(s, 'sf'); return o == null ? null : o; },
  src: 'بيتا · دين · تقلب · أكبر هبوط · شارپ', inTotal: true, axis: 'risk' },
  /* ↓ الاتنين دول مش من محرك الخمسة — محسوبين من بيانات تاريخية حقيقية.
  كل واحد فيهم بيقول التغطية بتاعته بوضوح. */
  { id: 'risk', ic: '⚠️', n: 'المخاطرة', d: 'التذبذب وأكبر هبوط',
  get: function (s) { return ARM_RISK[s.code]; }, src: '4996 شمعة لكل سهم · 2000→2026', derived: true },
  { id: 'div', ic: '🎁', n: 'التوزيعات', d: 'بيدفع لك كام',
  get: function (s) { return ARM_DIV[s.code]; }, src: 'نسبة التوزيع من بيانات البورصة', derived: true,
  /* ⚠ صفر توزيع مش «بيانات» — السهم ده مش بيوزّع أصلاً
  ولازم المستخدم يشوف العدد ده مش في الحسبة. */
  has: function (s) { return ARM_DIV[s.code] != null && liveDy(s) > 0; } }
  ];

  /* ── نتيجتين مشتقة ── */
  var ARM_RISK = {}, ARM_DIV = {};

  /* ═══ حساب النسبة المئوية داخل القطاع ═══
  لأن المقارنة العادلة بين الأسهم بتكون جوه نفس القطاع:
  بنك مقابل بنك، مش بنك مقابل سهم صناعي. */
  function pctRank(list, valFn, dir) {
  /* dir = 1  → القيمة الأكبر أفضل
  dir = -1 → القيمة الأصغر أفضل */
  var vals = [];
  list.forEach(function (s) {
  var v = valFn(s);
  if (v != null && isFinite(v)) vals.push({ c: s.code, v: v });
  });
  if (!vals.length) return;
  vals.sort(function (a, b) { return dir > 0 ? a.v - b.v : b.v - a.v; });
  var n = vals.length;
  vals.forEach(function (o, i) {
  /* +0.5 عشان النتيجة متوسطة للمتساويين مش 0 */
  var r = ((i + 0.5) / n) * 100;
  ARM_DIV[o.c] = Math.round(r);
  });
  }

  function buildDerived() {
  try { buildDiv(); } catch (e) { console.warn('توزيعات:', e); ARM_DIV = {}; }
  }
  function buildDiv() {
  ARM_DIV = {};
  var bySector = {};
  OS_DB.forEach(function (s) { (bySector[s.sectorEn || s.sector] = bySector[s.sectorEn || s.sector] || []).push(s); });

  /* ⛌ المخاطرة مش هنا — buildRisk3 هي اللي بتحسبها من 3 مؤشرات.
  كانت بتتكتب هنا وبتتمسح بعدها، والنتيجة كانت شاربي لوحدها. */
  Object.keys(bySector).forEach(function (sec) {
  pctRank(bySector[sec], function (s) { return liveDy(s) || 0; }, 1);
  });
  }

  /* المخاطرة المحسوبة من 3 مصادر — بنعملها منفصلة عشان ما نلخبطش */
  function buildRisk3() {
  try { buildRisk3Run(); } catch (e) { console.warn('مخاطرة:', e); ARM_RISK = {}; }
  }
  function buildRisk3Run() {
  var parts = { vol: {}, mdd: {}, shp: {} };
  var bySector = {};
  OS_DB.forEach(function (s) { (bySector[s.sectorEn || s.sector] = bySector[s.sectorEn || s.sector] || []).push(s); });

  function rank(sec, fn) {
  var vals = [];
  sec.forEach(function (s) {
  var v = fn(s);
  if (v != null && isFinite(v)) vals.push({ c: s.code, v: v });
  });
  if (vals.length < 3) return;
  vals.sort(function (a, b) { return a.v - b.v; });
  var n = vals.length;
  vals.forEach(function (o, i) { vals[i].r = ((i + 0.5) / n) * 100; });
  return vals;
  }

  /* ⛌ rank بترجع undefined لما يكون في أقل من 3 أسهم في القطاع،
  والـforEach عليها كانت بتوقّف الصفحة كلها. */
  function each(sec, fn, out) {
  var r = rank(sec, fn);
  if (!r) return;
  r.forEach(function (o) { out[o.c] = o.r; });
  }
  Object.keys(bySector).forEach(function (name) {
  var L = bySector[name];
  each(L, function (s) { return s.vol1y; }, parts.vol);
  each(L, function (s) { return s.mdd; }, parts.mdd);
  each(L, function (s) { return s.sharpe3y; }, parts.shp);
  });

  ARM_RISK = {};
  Object.keys(parts.vol).forEach(function (c) {
  var a = parts.vol[c], b = parts.mdd[c], d = parts.shp[c];
  if (a == null || b == null || d == null) return;  /* مفيش بيانات كافية = مش بيتحتسب */
  ARM_RISK[c] = Math.round(a * 0.40 + b * 0.35 + d * 0.25);
  });
  }

  /* ═══ الحالة ═══ */
  var AF = { arm: 'total', min: 0, sector: 'all', sel: null, built: false };

  /* تهريب النصوص — الاسم جاي من البيانات */
  function esc(v) {
  return String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
  }

  /* ⛌ النسب مبنية على OS_DB — لو اتحسبت قبل ما البيانات توصل
  بتفضل فاضية. فبنبنيها عند كل قراءة: 296 صف و12 قطاع،
  مش تكلفة. */
  function ensureBuilt() {
  if (!OS_DB || !OS_DB.length) return;
  buildDerived();
  buildRisk3();
  }

  /* ═══ تحميل الطبقة الحية — مرة واحدة في الصفحة ═══
  ⛔ متحمّلش ٨٥٠ ك.ب قبل ما المستخدم يفتح صفحة الأذرع فعلاً. */
  function ensureLive() {
  if (LIVE_STATE !== 'idle') return;
  if (!armsVisible()) return;
  LIVE_STATE = 'loading';
  if (typeof window.OCTALiveMarkets !== 'function') {
  LIVE_STATE = 'error';
  LIVE_ERR = 'مصدر البيانات الحية غير متاح';
  return;
  }
  window.OCTALiveMarkets().then(function (res) {
  if (res && res.ok) {
  LIVE = res.map; LIVE_TS = res.ts || ''; LIVE_STATE = 'ok';
  } else {
  LIVE = null; LIVE_STATE = 'error'; LIVE_ERR = (res && res.err) || 'الطلب فشل';
  }
  /* ⭐ أعد الرسم بالبيانات الحية — بس لو الصفحة لسه مفتوحة */
  if (!armsVisible()) return;
  if (AF.sel) renderDetail(); else renderPage();
  });
  }

  /* ⭐ ملاحظة مصدر الأرقام (بيظهر بس لو الطبقة الحية مش متاحة) */
  function liveNote() {
  if (LIVE_STATE === 'error') {
  return '<div class="af-warn">⚠️ مقدرتش أجيب المحاور الحية (' + esc(LIVE_ERR || 'الطلب فشل') +
  ') — الأرقام المعروضة من سجل ٩ أكتوبر، فمتحسبش عليها قرار. جرّب زرار «تحديث».</div>';
  }
  if (LIVE_TS) {
  return '<div class="af-legend">🕒 أرقام المحاور من نفس لحظة المحرك: ' + esc(String(LIVE_TS).slice(0, 16).replace('T', ' ')) + '</div>';
  }
  return '';
  }

  /* ═══ التغطية ═══ */
  function coverage(arm) {
  ensureBuilt();
  var rows = OS_DB.filter(function (s) { return s.price > 0; });
  var have = rows.filter(function (s) { return arm.has ? arm.has(s) : arm.get(s) != null; });
  return { have: have.length, all: rows.length, pct: rows.length ? Math.round(have.length / rows.length * 100) : 0 };
  }

  /* ═══ الصفحة ═══ */
  /* آخر عدد صفوف اشتغلنا عليه — لو OS_DB اتغيّر نعيد الرسم */
  var lastN = -1;

  function renderPage() {
  var host = document.getElementById('armsList');
  if (!host) return;
  ensureLive();
  ensureBuilt();
  lastN = OS_DB.length;

  if (AF.sel) return renderDetail();

  /* ⭐ الداتا الحية لسه جاية ⇒ ننتظر بدل ما نعرض أرقام من ٥ أسابيع */
  if (LIVE_STATE === 'loading') {
  host.innerHTML = '<div class="af-empty">⏳ جاري تحميل المحاور الحية…</div>';
  return;
  }

  var priced = OS_DB.filter(function (s) { return s.price > 0; }).length;
  var h = '';

  h += '<div class="af-intro">';
  h += '<div class="af-i-q">ازاي OCTA بيحلّل؟</div>';
  h += '<div class="af-i-a">المحرك بيقيّم كل سهم من <b>7 محاور</b>، وكل محور بيطلع درجة من 100.</div>';
  h += '<div class="af-i-a">الدرجة النهائية = مجموع (درجة كل محور × وزنه) بعد استبعاد المحاور الناقصة، وبعدين خصومات.</div>';
  /* ⛔⛔⛔ ٢٧ أكتوبر ٢٠٢٦ — الأوزان كانت مكتوبة بالحرف (24/22/18/18/9/5/4)
     ⛌   و«محورين ثابتين» — ده كلام بقى غلط بعد ٢٦ أكتوبر (محور المحفظة
     ⛌   اتشال ووزنه اتوزّع على المحاور الحقيقية).
     ✅ الحل: نقراها من المصدر الحيّ (/api/engine-weights) + بديل صح. */
  var AW = (typeof window.OCTA_AXIS_W === 'function') ? window.OCTA_AXIS_W()
    : { risk: 27, fundamental: 24, technical: 20, liquidity: 20, news: 5, sentiment: 4, portfolio: 0 };
  h += '<div class="af-i-w">' +
  '<span>🛡️ الأمان <b>' + AW.risk + '%</b></span><span>💰 الأساسي <b>' + AW.fundamental + '%</b></span>' +
  '<span>📈 الفني <b>' + AW.technical + '%</b></span><span>💧 السيولة <b>' + AW.liquidity + '%</b></span>' +
  '<span>📰 الأخبار <b>' + AW.news + '%</b></span>' +
  '<span>🧠 المعنويات <b>' + AW.sentiment + '%</b></span>' +
  '<span>💼 المحفظة <b>مستبعد</b> <i class="af-fix">مفيش مصدر</i></span></div>';
  h += '<div class="af-i-hon">' +
  '✅ <b>كل الأوزان دي أرقام حقيقية</b> — كل محور بيتحسب من مصدره. ' +
  'محور «المحفظة» اتشال لأنه كان رقم ثابت لكل سهم (يعني بيفرق صفر بين الأسهم) ' +
  'واللي كان اخد وزنه اتوزّع على المحاور الحقيقية. ولو محور ناقص لمصدره ⇒ ' +
  'المحور كله بيتشال والوزن بيتحسب على الموجود بس — مفيش رقم مخترع.' +
  '</div>';
  h += '<div class="af-i-n">👆 اختار ذراع عشان تشوف الأسهم مرتبة بيها — الدرجة دي <b>نفس رقم المحرك الحيّ</b>، مش حساب تاني. ' +
  'والمحاور التلاتة التانية (التقييم · المخاطرة · التوزيعات) محسوبة من بيانات تانية، ومش جزء من الدرجة النهائية.</div>';
  h += '</div>';

  h += aboutBox();

  h += '<div class="af-grid">';
  ARMS8.forEach(function (a) {
  var c = coverage(a);
  var strong = Math.round(c.pct * 0.6);
  h += '<button type="button" class="af-card' + (a.derived ? ' der' : '') + '" data-af="' + a.id + '">' +
  '<div class="af-c-ic">' + a.ic + '</div>' +
  '<div class="af-c-main">' +
  '<div class="af-c-n">' + a.n + '</div>' +
  '<div class="af-c-d">' + a.d + '</div>' +
  '<div class="af-c-bar"><i style="width:' + strong + '%"></i></div>' +
  '<div class="af-c-src">' + c.have + ' من ' + c.all + ' سهم · ' + c.pct + '%</div>' +
  '</div><div class="af-c-a">←</div></button>';
  });
  h += '</div>';

  h += '<div class="af-note">💡 الذراعين <b>المخاطرة</b> و<b>التوزيعات</b> بيتحسبوا من تاريخ كل سهم — كل واحد فيهم بيقول التغطية بتاعته بوضوح. اللي مش عنده بيانات مش بيتردب.</div>';

  host.innerHTML = h;
  }

  /* ══ كارت الشرح — نفس فكرة كارت الفلتر (الفحص) ══ */
  function aboutBox() {
  var o = !!AF.about;
  var h = '<div class="af-about' + (o ? ' open' : '') + '">';
  h += '<button type="button" class="af-about-h" data-af="about">' +
  '<span>❓ كل الفلاتر دي بتعمل إيه؟</span><b>' + (o ? '▲' : '▼') + '</b></button>';
  if (!o) { h += '</div>'; return h; }

  h += '<div class="af-about-b">';

  h += '<div class="af-diff">';
  h += '<div class="af-dc">' +
  '<div class="af-dh">🔒 من محرك OCTA</div>' +
  '<div class="af-db">الأوزان دي <b>مقفولة</b> — إحنا اللي بنظبطها</div>' +
  '<ul class="af-dl">' +
  '<li>محور واحد بياخد أوزان مجرّدة ومحدّدة</li>' +
  '<li>الدرجة النهائية = المجموع المرجّح بعد خصم المخاطرة</li>' +
  '<li>ليه؟ عشان تكون الدرجة <b>مقارنة</b> بين الأسهم مش مقارنة بين أسهم مختلفة</li>' +
  '</ul></div>';
  h += '<div class="af-dc">' +
  '<div class="af-dh">🎚️ من ذراع بتختاره</div>' +
  '<div class="af-db">أنت بتختار <b>ذراع واحدة</b> بس</div>' +
  '<ul class="af-dl">' +
  '<li>الأسهم بتترتيب <b>بالدرجة دي</b> بس</li>' +
  '<li>عمود «الفرق» بيقولك السهم قوي هنا ولا ضعيف</li>' +
  '<li>ده مش بيغيّر الدرجة النهائية — بيغيّر <b>نظرك أنت</b></li>' +
  '</ul></div>';
  h += '</div>';

  /* 🏦 ملاحظة لازم تكون في مكان واضح —Banksوالعقارات */
  h += '<div class="af-banks">';
  h += '<div class="af-bk-t">🏦 البنوك والعقارات بتتقاس بطريقة مختلفة</div>';
  h += '<div class="af-bk-b">' +
  'مضاعف الربحية <b>(PE)</b> بيتشوّه فيهم. البنك ممكن يطلع «غالي» وهو رخيص، ' +
  'أو «رخيص» وهو غالي — لأن رقم المضاعف نفسه مش بيعني حاجة عنهم. ' +
  'عشان كده بيتقاسوا بـ<b>مضاعف القيمة الدفترية (PB)</b> — يعني السعر مقابل ' +
  'اللي وراه فعلاً في الميزانية.' +
  '<br><br>' +
  'وكمان <b>العائد على حقوق الملكية (ROE)</b> بتاع البنك عادي — مش عيب ومش ميزة. ' +
  'لأنه شغلهم إيداع، وده تعريف الشغل نفسه.' +
  '</div>';
  h += '<div class="af-bk-f">💡 يعني: لو بتقيّم بنك أو شركة عقارات، محور <b>القيمة</b> ' +
  'لوحده مش كفاية — اقرأ <b>الأساسي</b> كمان.</div>';
  h += '</div>';

  /* ⛌ الخلط اللي الناس بتعمله */
  h += '<div class="af-warn">' +
  '<b>⚠️ الخلط اللي بيحصل:</b> ' +
  '«الأعلى في الذراع» مش معناها «الأفضل استثمار». ' +
  'سهم ممتاز في <b>الأساسي</b> ممكن يكون ضعيف في <b>الأمان</b> — وده بالظبط الفرق بين اختيار ذراع والاختيار تاني.' +
  '</div>';

  /* الأذرع ورا Expedition بعض */
  h += '<div class="af-dl2">';
  ARMS8.forEach(function (a) {
  var c = coverage(a);
  h += '<div class="af-r' + (a.derived ? ' der' : '') + '">' +
  '<span class="af-ri">' + a.ic + '</span>' +
  '<span class="af-rn">' + a.n + '</span>' +
  '<span class="af-rd">' + a.d + '</span>' +
  '<span class="af-rc">' + c.have + '/' + c.all + ' · ' + c.pct + '%</span>' +
  '<span class="af-rs">' + a.src + '</span>' +
  '</div>';
  });
  h += '</div>';

  h += '<div class="af-note2">💡 <b>التغطية</b> بتقول لك كام سهم عنده بيانات للذراع ده فعلاً. ' +
  'اللي مالوش بيانات مش بيتردب بصفر — بيتشال من الحسبة ويُحسب لك.</div>';

  h += liveNote();

  h += '</div></div>';
  return h;
  }

  /* ⭐⭐ شرح الفرق بين عمود الذراع وعمود المجموع (١٤ نوفمبر ٢٠٢٦)
     📌 المالك سأل: «التقييم من 100 والمجموع من 100 — الفرق إيه؟»
     ⇒ التقييم = درجة السهم في الذراع ده وحده · المجموع = نتيجته النهائية.
     ⭐ والوزن بيتقرا من المصدر الحيّ (محرك الأوزان) — مش رقم ثابت. */
  function armExplain(arm) {
  var AW = (typeof window.OCTA_AXIS_W === 'function') ? window.OCTA_AXIS_W() : null;
  var w = '';
  if (arm.axis && AW && typeof AW[arm.axis] === 'number') w = String(AW[arm.axis]);
  var h = '<div class="af-dnote">';
  if (arm.inTotal) {
  h += '<div class="af-dn"><b>' + esc(arm.n) + '</b> = درجة السهم في الذراع ده وحده — وده <b>داخل في النتيجة النهائية</b>' +
  (w ? ' بوزن <b>' + w + '%</b>' : '') + '.</div>';
  } else {
  h += '<div class="af-dn"><b>' + esc(arm.n) + '</b> = درجة السهم في الذراع ده وحده — وده <b>مش جزء</b> من النتيجة النهائية.</div>';
  }
  h += '<div class="af-dn"><b>المجموع</b> = <b>النتيجة النهائية</b> في محرك OCTA (سبعة محاور موزونة، بعد خصم المخاطرة والثقة).</div>';
  if (arm.inTotal) {
  h += '<div class="af-dn"><b>الفرق</b> = الفرق بين الدرجتين <b>بالنقاط</b> — كل ما الرقم أعلى، السهم ده قوي في الذراع ده بس ضعيف في الباقي.</div>';
  } else {
  h += '<div class="af-dn"><b>الفرق</b> = «—» هنا، لأن الدرجة دي مش جزء من المجموع، فمفيش رقم ناقصه نقارنه بيه.</div>';
  }
  h += '</div>';
  return h;
  }

  /* ═══ التفاصيل ═══ */
  function renderDetail() {
  var arm = ARMS8.filter(function (a) { return a.id === AF.arm; })[0] || ARMS8[0];
  ensureLive();

  /* ⭐ الداتا الحية لسه جاية ⇒ شريط الرجوع + انتظار (من غير أرقام قديمة) */
  if (LIVE_STATE === 'loading') {
  document.getElementById('armsList').innerHTML =
  '<div class="af-bar">' +
  '<button type="button" class="af-bb" data-af="back">→ كل الأذرع</button>' +
  '<div class="af-bar-r">' +
  '<span class="af-tm">' + esc(AF.tstamp || '—') + '</span>' +
  '<button type="button" class="af-xb" data-af="close" aria-label="اخرج من الفلتر">✕</button>' +
  '</div></div>' +
  '<div class="af-empty">⏳ جاري تحميل المحاور الحية…</div>';
  bind();
  return;
  }

  var rows = OS_DB.filter(function (s) {
  if (s.price <= 0) return false;
  if (AF.sector !== 'all' && (s.sectorEn || s.sector) !== AF.sector) return false;
  return true;
  });
  var scored = rows.filter(function (s) { return arm.has ? arm.has(s) : arm.get(s) != null; });
  var skipped = rows.length - scored.length;
  var shown = scored.filter(function (s) { return arm.get(s) >= AF.min; })
  .sort(function (a, b) { return arm.get(b) - arm.get(a); });

  var h = '';
  h += '<div class="af-bar">' +
  '<button type="button" class="af-bb" data-af="back">→ كل الأذرع</button>' +
  '<div class="af-bar-r">' +
  '<span class="af-tm" id="afTime">' + esc(AF.tstamp || '—') + '</span>' +
  '<button type="button" class="af-rb" data-af="refresh"' + (AF.busy ? ' disabled' : '') + '>' +
  (AF.busy ? '⏳ جاري…' : '🔄 تحديث') + '</button>' +
  '<button type="button" class="af-xb" data-af="close" aria-label="اخرج من الفلتر">✕</button>' +
  '</div></div>';

  h += '<div class="af-d-h"><span class="af-d-ic">' + arm.ic + '</span>' +
  '<div><div class="af-d-n">' + arm.n + '</div>' +
  '<div class="af-d-s">' + arm.d + ' · ' + arm.src + '</div></div></div>';

  h += '<div class="af-ctl"><label class="af-lb">أقل درجة: <b id="afMinV">' + AF.min + '</b></label>' +
  '<input type="range" id="afMin" min="0" max="100" step="5" value="' + AF.min + '"></div>';

  h += '<div class="af-stats">' +
  '<span class="af-s"><b>' + scored.length + '</b> عندهم بيانات</span>' +
  (skipped ? '<span class="af-s warn"><b>' + skipped + '</b> ' +
  (arm.id === 'div' ? 'بدون توزيع' : 'بدون بيانات') + '</span>' : '') +
  '<span class="af-s ok"><b>' + shown.length + '</b> عدّى الفلتر</span></div>';

  /* ⭐ شرح الأعمدة (قبل الجدول) — الفرق بين درجة الذراع والمجموع */
  h += armExplain(arm);

  if (!shown.length) {
  h += '<div class="af-empty">مفيش سهم عدّى. جرّب تنزل الدرجة لـ ' + Math.max(0, AF.min - 20) + '.' +
  (AF.sector !== 'all' ? ' شوف كل القطاعات.' : '') + '</div>';
  document.getElementById('armsList').innerHTML = h;
  lastN = OS_DB.length;
  bind();
  return;
  }

  h += '<div class="af-wrap"><table class="af-t"><thead><tr>' +
  '<th>#</th><th>السهم</th><th>القطاع</th>' +
  '<th>' + arm.n + ' <span class="af-th-u">من 100</span></th>' +
  '<th>المجموع <span class="af-th-u">من 100</span></th>' +
  '<th>الفرق</th><th>السعر</th><th>تغير</th>' +
  '</tr></thead><tbody>';
  shown.slice(0, 120).forEach(function (s, i) {
  var av = arm.get(s), tv = num(s.score) || 0, d = Math.round(av - tv);
  h += '<tr data-afcode="' + s.code + '">' +
  '<td class="af-i">' + (i + 1) + '</td>' +
  '<td><b>' + esc(s.code) + '</b><span class="af-nm">' + esc(s.name || '') + '</span></td>' +
  '<td class="af-sc">' + esc(s.sectorAr || s.sector || '—') + '</td>' +
  '<td><b class="af-v' + (av >= 70 ? ' hi' : av >= 50 ? ' mid' : ' lo') + '">' + Math.round(av) + '</b></td>' +
  '<td class="af-tot">' + Math.round(tv) + '</td>' +
  (arm.inTotal
  ? '<td class="af-d' + (d > 0 ? ' up' : d < 0 ? ' dn' : '') + '">' + (d > 0 ? '+' : '') + d + '</td>'
  : '<td class="af-d na">—</td>') +
  '<td class="af-n">' + (s.price || 0).toFixed(2) + '</td>' +
  '<td class="af-c' + ((s.change || 0) >= 0 ? ' up' : ' dn') + '">' +
  ((s.change || 0) >= 0 ? '▲ ' : '▼ ') + Math.abs(s.change || 0).toFixed(2) + '%</td>' +
  '</tr>';
  });
  h += '</tbody></table>';
  if (shown.length > 120) h += '<div class="af-more">📊 بيعرض أول 120 من ' + shown.length + ' سهم — ضيّق الفلتر عشان تشوف الباقي</div>';
  h += '</div>';
  /* ⭐ الشرح — بلدي: كل الأرقام درجات من ٠ لـ ١٠٠، والفرق معناها إيه */
  h += '<div class="af-legend">📊 <b>كل الأرقام درجات من ٠ لـ ١٠٠</b> — «' + arm.n +
  '» = درجة السهم في الذراع ده، و«المجموع» = درجته النهائية في محرك OCTA.</div>';
  if (arm.inTotal) {
  h += '<div class="af-legend">➖ <b>الفرق</b> = درجة «' + arm.n +
  '» ناقص درجة المجموع (بالنقاط). كل ما الرقم أعلى، السهم ده قوي في الذراع ده بس ضعيف في الباقي.</div>';
  } else {
  h += '<div class="af-legend">➖ <b>الفرق</b> معندهاش معنى هنا — «' + arm.n +
  '» محور محسوب من بيانات تانية (مش داخل في المجموع)، فمفيش رقم ناقصه نقارنه بيه.</div>';
  }
  h += '<div class="af-legend">💡 الدرجة الأعلى في الذراع مش معناها «الأفضل استثمار» — الذراع بيغيّر <b>نظرك</b> بس، مش الدرجة النهائية.</div>';
  h += liveNote();

  document.getElementById('armsList').innerHTML = h;
  bind();
  }

  /* ══ ريفيش جو الفلتر — مش بيخرج بره ولا بيرسم الصفحة ══
  ⛌ لو نادينا switchPage كان المستخدم بيضيع مكانه في كل مرة. */
  function doRefresh() {
  AF.busy = true;
  renderDetail();

  var done = function (ok) {
  AF.busy = false;
  /* ⛌ الوقت في AF.tstamp مش في الـDOM — أي إعادة رسم
  (مراقب البيانات مثلاً) كانت بترجّعه لـ — وتمسح حالة الزرار */
  AF.tstamp = ok
  ? new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  : 'فشل التحديث';
  renderDetail();
  };

  function run() {
  /* octaLoadDB بيرجّع فوراً لو البيانات جاهزة — فنجبر تحميل جديد */
  try { if (typeof EGX_DB !== 'undefined') EGX_DB = null; } catch (e) { }
  try { if (typeof OS_READY !== 'undefined') OS_READY = false; } catch (e) { }
  /* ⭐ الطبقة الحية كمان — إعادة تحميل كاملة */
  try { if (typeof window.OCTALiveMarketsReset === 'function') window.OCTALiveMarketsReset(); } catch (e) { }
  LIVE = null; LIVE_STATE = 'idle'; VAL_CACHE = {};
  var pr = (typeof octaLoadDB === 'function') ? octaLoadDB : null;
  if (!pr) return done(false);
  try {
  var r = pr();
  if (r && typeof r.then === 'function') {
  return r.then(function () { done(true); }).catch(function () { done(false); });
  }
  } catch (e) { return done(false); }
  setTimeout(function () { done(true); }, 1500);
  }
  run();
  }

  /* ══ اخرج من الفلتر — يرجّعك مكان ما كنتش ══ */
  function leaveFilter() {
  AF.sel = null;
  var back = AF.from || 'home';
  if (typeof switchPage === 'function') switchPage(back);
  }

  function currentPageId() {
  var p = document.querySelector('.page');
  if (p && p.id) return p.id.replace('page-', '');
  return 'home';
  }

  /* ═══ الأحداث ═══ */
  function bind() {
  var min = document.getElementById('afMin');
  if (min) min.addEventListener('input', function () {
  AF.min = Number(min.value);
  var v = document.getElementById('afMinV');
  if (v) v.textContent = AF.min;
  });
  }

  function armsVisible() {
  var el = document.getElementById('page-arms');
  return !!el && el.style.display !== 'none' && el.offsetHeight > 0;
  }

  document.addEventListener('click', function (e) {
  var card = e.target.closest('[data-af]');
  if (!card) return;
  var v = card.getAttribute('data-af');
  if (v === 'back') { AF.sel = null; renderPage(); return; }
  if (v === 'about') { AF.about = !AF.about; renderPage(); return; }
  if (v === 'close') { leaveFilter(); return; }
  if (v === 'refresh') { doRefresh(); return; }
  if (v === 'min') return;
  AF.arm = v; AF.min = 0; AF.sel = v;
  AF.from = currentPageId();
  renderDetail();
  });

  document.addEventListener('input', function (e) {
  if (e.target.id !== 'afMin') return;
  AF.min = Number(e.target.value);
  var v = document.getElementById('afMinV');
  if (v) v.textContent = AF.min;
  });

  document.addEventListener('change', function (e) {
  if (e.target.id !== 'afMin') return;
  renderDetail();
  });

  /* ⛌ الكروت كانت بتترسم قبل ما الأسعار توصل، فكانت بتقول 0 من 296.
  ده مراقب خفيف: بيشتغل بس والصفحة مفتوحة، وبيعيد الرسم
  غير لما عدد الأسهم يتغيّر فعلاً. */
  setInterval(function () {
  if (OS_DB.length === lastN) return;
  if (!armsVisible()) return;
  if (AF.sel) renderDetail(); else renderPage();
  }, 1200);

  /* ═══ الواجهة ═══ */
  window.OCTAArmsFilter = {
  render: function () {
  AF.built = false; AF.sel = null; AF.arm = 'total'; AF.min = 0;
  renderPage();
  },
  /* ⭐ إعادة رسم بدون ما نreset الاختيار (لما المستخدم يفتح الصفحة تاني) */
  refresh: function () {
  if (AF.sel) renderDetail(); else renderPage();
  },
  arms: ARMS8,
  coverage: coverage,
  /* 🧪 خطّاف الاختبار (زي الفلتر الفني) */
  _t: {
  setLive: function (map) { LIVE = map; LIVE_STATE = 'ok'; VAL_CACHE = {}; },
  valScore: valScore,
  axLive: axLive,
  scaledMult: scaledMult,
  liveDy: liveDy,
  arms: ARMS8
  }
  };

  /* شيل الفلتر القديم لو موجود — الأذرع بقت صفحة تحليل مش كروت */
  window.renderArms = function () { window.OCTAArmsFilter.render(); };

  document.addEventListener('DOMContentLoaded', function () {
  setTimeout(function () { if (typeof renderArms === 'function') renderArms(); }, 200);
  });
})();