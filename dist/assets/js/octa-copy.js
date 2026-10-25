/* ══════════════════════════════════════════════════════════════════════
  📖 شرح تبويبات الصف التاني — ⭐ الخمسة و 📊 التلاتة
  ياسر · 16 أكتوبر 2026
  ──────────────────────────────────────────────────────────────────────
  ✅ إزاي تستخدمه:
     النصوص دي HTML جاهز للحقن بـ innerHTML جوه نافذة الشرح (؟).
     كل نص بيبدأ بسطرين ملخص، والباقي جوّه <details> — المستخدم
     يقرا الملخص ويقفل، أو يضغط «اقرأ» ويكمّل.
     لو حبيت تحطه نص عادي (textContent) — شيل الوسوم بإيدك.

  ⛔ قاعدة: كل رقم لازم يبان معناه في نفس السطر.
  ⛔ مفيش أي كلام بيوعد بالربح.
  ══════════════════════════════════════════════════════════════════════ */
window.OCTACOPY = {

/* ══════════════════════════════════════════════════════════════════════
  ⭐ TAB5 — أعلى 5 فرص (الدرجة من 100)
  ══════════════════════════════════════════════════════════════════════ */
TABBEST: `
<p><b>الفرصة المثالية = السهم اللي بيعدّي على أكبر عدد فلاتر مع بعض.</b>
بنقيّم كل سهم في السوق على الفلاتر الثمانية، ونحسب ليه درجة من
<span class="flt-ltr">100</span> بتتوزّع على 5 محاور.</p>

<p>وفي خطوة قبل الدرجة: لو السهم سعره <b>تحت</b> سعره العادل بيبقى أقوى
فرصة من اللي سعره فوقه بكتير — عشان كده تلاقي في الجدول سهم درجته
<span class="flt-ltr">90</span> فوق التقييم، But سهم درجته
<span class="flt-ltr">85</span> تحت التقييم بيتقدّم عليه.</p>

<details><summary>📖 إزاي تقرأ الفلتر الواحد؟</summary>
<p>كل سهم بيمرّ على الفلاتر الثمانية، ولكل فلتر نتيجة من اتنين:</p>
<ul>
<li><b>✅ عدّى</b> — الشرط اتحقق بالرقم اللي موجود في البيانات</li>
<li><b>⛔ مفيش</b> — либо الشرط ماتحققش، أو بيانات السهم ناقصة</li>
</ul>
<p>ولو المؤشر مش موجود في البيانات أصلاً: بيظهر
<b>«—»</b> وبيتقال من الحساب — مش صفر. يعني السهم ما اتحرقش عشان
بياناته ناقصة.</p>
</details>

<details><summary>🎯 الفرق بين التلاتة تبويبات</summary>
<p><b>الفرصة المثالية</b> — بتقيّم كل الفلاتر الثمانية وتشوف كل التفاصيل.
الأسهم كلها اللي بتعدّي.</p>
<p><b>أفضل 5 فرص</b> — نفس الحساب بالظبط، بس أول 5 صفوف بس، مرتبة بسعرها
العادل.</p>
<p><b>أفضل 3 فرص</b> — ده مختلف خالص: نمط فني صعود. لازم السهم يعدّي 6 شروط
فنية (فوق متوسط الـ<span class="flt-ltr">200</span> · فوق متوسط
الـ<span class="flt-ltr">50</span> · الزخم بين
<span class="flt-ltr">50</span> و<span class="flt-ltr">72</span> · حجم
نسبي <span class="flt-ltr">1.2+</span> · سيولة يومية
<span class="flt-ltr">200</span> ألف+).</p>
<p>ممكن نفس السهم يطلع في التلاتة الـ<a href="#" onclick="return false"> الأول</a>
والتلاتة التانيين — وده كويس، بس المعايير مختلفة.</p>
</details>

<details><summary>⚠️ تحذير مهم</summary>
<p>الترتيب <b>قياس ومقارنة</b> — مش توصية شراء ولا وعد بالربح.
السعر العادل تقدير بيتبني على 3 مصادر، وكل رقم جنبه مصدره وتاريخه.</p>
<p>العائد الماضي مش ضمان للمستقبل.</p>
</details>
`,

TAB5: `
<p><b>الخمسة دول مش بالصدفة.</b> بنحسب لكل سهم في السوق درجة من <span class="flt-ltr">100</span>، وبعدين بنرتبهم وناخد أعلى خمسة.</p>
<p>وفي خطوة قبل الدرجة: السهم اللي سعره <b>تحت</b> سعره العادل بيتقدّم على اللي فوقه — لأنه فرصة شراء دلوقتي، مش بس شركة شكلها كويس.</p>

<details><summary>📐 الدرجة من 100 بتتوزع إزاي؟</summary>
<p>كل سهم بيتقيّم على 5 محاور، وكل محور ليه وزن من الـ<span class="flt-ltr">100</span>:</p>
<ul>
<li>🧱 <b>الأساسيات <span class="flt-ltr">30٪</span></b> — الشركة بتجيب فلوسها من شغلها ولا من القرض. ده أكبر وزن، لأن أساس الشركة مش بيتبني في نص ساعة.</li>
<li>🛡 <b>المخاطرة <span class="flt-ltr">25٪</span></b> — السهم بيتذبذب قد إيه، وأقصى هبوط في تاريخه كان كام. السهم الهادي أسهل فيك تنفيذاً.</li>
<li>📈 <b>الفني <span class="flt-ltr">20٪</span></b> — شكل السعر دلوقتي: فوق المتوسطات المتحركة ولا تحت، وفي منطقة شراء ولا بيع.</li>
<li>💎 <b>التقييم <span class="flt-ltr">15٪</span></b> — السعر غالي ولا رخيص مقارنةً بدخل الشركة وبقيمة أصولها في الدفاتر.</li>
<li>💰 <b>التوزيع والسيولة <span class="flt-ltr">10٪</span></b> — فيه قسيمة سنوية؟ وهل تقدر تبيع أي كمية في أي يوم من غير ما السعر يطيح؟</li>
</ul>
<p>المجموع <span class="flt-ltr">100٪</span> — كل سهم بياخد رقم واحد من 100، ومفيش سهم ياخد غيره.</p>
</details>

<details><summary>⛔ لو مؤشر مش موجود في البيانات؟</summary>
<p>المؤشر الناقص بيتشال من الحساب، ووزنه بيتقسم على المؤشرات اللي موجودة فعلاً.</p>
<p>⛔ <b>مش بنحط صفر مكانه.</b> الصفر معناه «الشركة وحشة» — وده ظلم ليها.</p>
<p>ولو محور كامل ناقص (مثلاً مفيش ولا مؤشر في التقييم) — المحور بيتشال ووزنه بيروح للمحاور اللي اتحسبت. وبنكتب جنبه «مش متاح — وزنه اتوزّع».</p>
<p>فوق كل سهم في الكارت تلاقي <b>«تغطية»</b> — دي نسبة الأوزان اللي اتحسبت من بيانات حقيقية. تغطية <span class="flt-ltr">60٪</span> معناها إن <span class="flt-ltr">40٪</span> من الدرجة مبنية على مؤشرات أقل من المعتاد، وده لازم تعرفه.</p>
</details>

<details><summary>📊 الترتيب نفسه إزاي؟</summary>
<p>الترتيب 3 مجموعات، وجوه كل واحدة الدرجة تنازلياً:</p>
<p>① اللي سعره تحت سعره العادل (فرصة شراء فعلاً) — ② اللي سعره فوق العادل — ③ اللي مفيش ليهم سعر عادل أصلاً.</p>
<p>السبب: سهم درجته عالية وسعره فوق العادل بـ<span class="flt-ltr">20٪</span> مش فرصة شراء دلوقتي، مهما كانت جودته.</p>
</details>

<details><summary>⚠️ الأرقام دي مش بتقول إيه</summary>
<p class="flt-h-note">⛔ الدرجة <b>مقارنة مش وعد</b>. الترتيب بيقول مين أحسن شكلاً دلوقتي — مش بيقول السهم هيطلع، ولا بكرة، ولا بكام.
<br>⛔ كل رقم آخر قيمة متاحة وقت العرض. سعر الأمس مش سعر النهارده.
<br>⛔ التقييم الحلو ما بيغنيش عن المخاطرة. شركة ممتازة ممكن تسقط <span class="flt-ltr">40٪</span> لو السوق اتقلب.
<br>⛔ التبويب ده ترتيب، مش أمر شراء. القرار قرارك أنت.</p>
</details>
`,

/* ══════════════════════════════════════════════════════════════════════
  📊 TAB3 — أفضل 3 فرص (نقطة الصعود الفنية)
  ══════════════════════════════════════════════════════════════════════ */
TAB3: `
<p><b>التلاتة دول بنختارهم بطريقة مختلفة تماماً.</b> مش بندوّر على أحسن شركة — بندوّر على السهم اللي شكله جاهز يكسر المقاومة ويكمّل.</p>
<p>نقطة الدخول عندهم <b>مش سعر النهارده</b>. دي مستوى لازم السعر يكسره ويقفل فوقه.</p>

<details><summary>🎯 شروط الاختيار — 6 شروط، لازم يعدّيهم كلهم</summary>
<p>السهم لازم يعدّي الستة كلهم، مش واحد فيهم:</p>
<ul>
<li>① <b>السعر فوق المتوسط <span class="flt-ltr">200</span> يوم</b> — المتوسط المتحرك لـ<span class="flt-ltr">200</span> يوم هو خط الاتجاه الطويل. فوقه = السهم في اتجاه صاعد.</li>
<li>② <b>المتوسط <span class="flt-ltr">50</span> فوق المتوسط <span class="flt-ltr">200</span></b> — المتوسطات مرتبة فوق بعض، فالاتجاه غالباً حقيقي مش عرضي.</li>
<li>③ <b>السعر فوق المتوسط <span class="flt-ltr">50</span></b> — القمة خارجة فعلاً، مش لسه بتتكوّن.</li>
<li>④ <b>مؤشر القوة النسبي (RSI) من <span class="flt-ltr">50</span> لـ<span class="flt-ltr">72</span></b> — فوق <span class="flt-ltr">50</span> يعني مش ضعيف، وتحت <span class="flt-ltr">72</span> يعني لسه مش متشبّع.</li>
<li>⑤ <b>الحجم النسبي <span class="flt-ltr">1.2×</span> أو أعلى</b> — حجم اليوم أكبر من معاده. الرقم <span class="flt-ltr">1</span> يعني يوم عادي، و<span class="flt-ltr">1.2</span> معناها الحركة اتأكّدت مش عشوائية.</li>
<li>⑥ <b>متوسط حجم 30 يوم <span class="flt-ltr">200</span> ألف سهم أو أعلى</b> — معناها تقدر تشتري وتبيع من غير ما السعر يطير عليك.</li>
</ul>
<p>وجوه الستة، الترتيب بـ4 أوزان: قرب القمة الفنية <span class="flt-ltr">40٪</span> · قوة الاتجاه <span class="flt-ltr">25٪</span> · تأكيد الحجم <span class="flt-ltr">20٪</span> · اتزان الزخم <span class="flt-ltr">15٪</span>.</p>
</details>

<details><summary>💡 نقطة الدخول المقترحة</summary>
<p>نقطة الدخول = سعر النهارده + <span class="flt-ltr">1٪</span> حشو. الحشو ده عشان ما يتنفّذش باللمسة الأولى من غير تأكيد.</p>
<p>⛔ معناها مش «اشترِ». معناها: لو السعر كسر المستوى ده <b>وقفل فوقه</b>، عندها النمط بدأ. لو السعر لسه أقل منها، السهم مش فرصة شراء — هو سهم بيتفرج عليه.</p>
<p>⛔ الـ<span class="flt-ltr">1٪</span> دي والهدف <span class="flt-ltr">+12٪</span> ووقف الخسارة <span class="flt-ltr">−3.5٪</span> نسب ثابتة معلنة، مش محسوبة من السهم نفسه. المدى الحقيقي للسهم غير متاح في البيانات، ومبنحطش رقم متخيّل مكانه.</p>
<p>⛔ النسب دي واحدة للتلاتة، فالمقارنة بين 3 مستويات — <b>مش دليل جودة سهم</b>.</p>
</details>

<details><summary>💎 السعر العادل</summary>
<p>رقم واحد بيجمع 3 مصادر بأوزانها: هدف المحللين <span class="flt-ltr">40٪</span> · القيمة الدفترية × وسيط مضاعف القطاع <span class="flt-ltr">30٪</span> · نموذج فني من المتوسطات <span class="flt-ltr">30٪</span>.</p>
<p>⛔ لو مصدر ناقص، أو رقمه مستحيل (أكبر من <span class="flt-ltr">2.5</span> ضعف السعر، أو أصغر من ثلثه) — بنستبعده. <b>مش بنحطه صفر.</b></p>
<p>⛔ ولو مفيش ولا مصدر عنده رقم، بنكتب «—» ومعاه السبب. من غير أرقام حقيقية مش بنخمّن سعر عادل.</p>
<p>⛔ السعر العادل رقم تقدير — مش وعد إن السعر هيوصله. ولو السعر فوقه، بنحط عليه علامة تحذير ونقولك: مش فرصة شراء دلوقتي.</p>
</details>

<details><summary>📈 قراءة الشكل البياني</summary>
<p>الأرقام بتقول «النمط قريب». الرسم البياني هو اللي بيأكّد — افتح السهم واضغط زر الرسم.</p>
<p>اتفرج على 3 حاجات: السهم واقف فوق المتوسط <span class="flt-ltr">50</span>؟ يوم الكسر كان بحجم كبير ولا ضعيف؟ السعر قفل فوق نقطة الدخول ولا لمسها ورجع؟</p>
<p>⛔ الرسم بيعرض تاريخ، مش بيبنيء المستقبل. ⛔ لو مش متفهم الرسم، متتعبطش عليه — ارجع للأرقام، هي اللي اتحسبت.</p>
</details>

<details><summary>🚨 لو مفيش 3 أسهم عندهم نقطة صعود</summary>
<p>لو مفيش 3 أسهم عندهم نقطة صعود واضحة، بنقول كده ونكتب: «مفيش سهم عدّى الشروط دلوقتي».</p>
<p>⛔ <b>مش بنختار أي حد عشان الجدول يمتلئ.</b> صفحة فاضية أحسن من اختيار عشوائي.</p>
<p>وده معلومة مش فشل: البورصة المصرية بتقعد جنب قممها فترات طويلة. جرّب تبويب «⭐ الفرصة المثالية» — معاييره مختلفة تماماً.</p>
</details>

<details><summary>⚠️ الأرقام دي مش بتقول إيه</summary>
<p class="flt-h-note">⛔ دي <b>قائمة انتظار</b> مش توصية شراء. الدخول قبل الكسر = رهان على توقّع.
<br>⛔ الكسر اللي يفشل بيرجع لمستواه الأصلي، فالمخاطرة حقيقية.
<br>⛔ المعايير دي على <b>الشكل</b> مش على الشركة. ممكن السهم يكون محترم ويبقى التلاتة غيره.
<br>⛔ التلاتة والخمسة ممكن يطلعوا نفس السهم، وممكن يختلفوا تماماً — وده المقصود.</p>
</details>
`
 
};

/* ══════════════════════════════════════════════════════════════════════
  ❓ واجهة الشرح — علامة (؟) تحت تبويبَي الصف التاني + النافذة
  سلمى · 16 أكتوبر 2026
  ──────────────────────────────────────────────────────────────────────
  ⭐ تحت ⭐ (الفرصة المثالية / أعلى 5 فرص)  ← شرح TAB5
  📊 تحت 📊 (الفرص الثلاثية)             ← شرح TAB3

  ⛔ ليه غلاف (wrapper) على `fzRenderTabs`؟
     `fzRenderTabs` بيعمل `b2.innerHTML = ...` ⇒ بيمسح أي حاجة متحطّة
     جوّه #fzTabsStar. فلو حطينا العلامة مرة واحدة بس، هتروح أول ما
     المستخدم يبدّل تبويب. فبنغلّف الدالة ونثبّت العلامتين بعدها في كل مرة.
  ⛔ وكمان في MutationObserver — شبكة أمان: لو اتغيّر الصف من أي مكان
     تاني (إعادة رسم، فتح صفحة…) العلامتين بترجع لوحدها.
  ══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if (window.__octaCopyUI) return;      /* اتحمّل مرتين — متكررش */
window.__octaCopyUI = true;

/* معرّف التبويب (من onclick بتاعه) ← مفتاح النص في OCTACOPY */
var MAP = { best:'TABBEST', five:'TAB5', triple:'TAB3' };
var TITLES = {
  TABBEST:'⭐⭐⭐ الفرصة المثالية — إزاي بتقيّم كل سهم',
  TAB3:'📊 الفرص الثلاثية — إزاي بنختارهم؟'
  };
var LABELS = {
  TAB5:'معايير ⭐ أعلى 5 فرص',
  TABBEST:'معايير ⭐⭐⭐ الفرصة المثالية',
  TAB3:'معايير 📊 الفرص الثلاثية'
  };
var STAR = '\u2B50', CHART = '\uD83D\uDCCA';

/* ⛔ النصوص بتاعت المستخدم كلها عربي — ومفيش أي اسم أداة ذكاء اصطناعي */

/* أي نص في التنفيذ — بنستخدمه في console لو حصل خطأ */
function keyOf(btn){
  var oc = btn.getAttribute('onclick') || '';
  var m = oc.match(/fzGo\((['"])([A-Za-z0-9_]+)\1/);
  if (m && MAP[m[2]]) return MAP[m[2]];
  var t = btn.textContent || '';
  if (t.indexOf(CHART) >= 0) return 'TAB3';
  if (t.indexOf(STAR)  >= 0) return 'TAB5';
  return null;
  }

/* ⭐ تركيب العلامتين: كل خلية = [ زر التبويب · ثم العلامة تحته ] */
function mount(){
  var host = document.getElementById('fzTabsStar');
  if (!host) return 0;
  var bs = host.querySelectorAll('button.fz-tab');
  var n = 0;
  for (var i = 0; i < bs.length; i++){
  var b = bs[i];
  if (!b.parentNode || b.closest('.octa-qcell')) continue;   /* متركّبة خلاص */
  var k = keyOf(b);
  if (!k) continue;
  var cell = document.createElement('div');
  cell.className = 'octa-qcell';
  var q = document.createElement('button');
  q.type = 'button';
  q.className = 'octa-q';
  q.setAttribute('data-k', k);
  q.setAttribute('aria-label', LABELS[k]);
  q.setAttribute('aria-haspopup', 'dialog');
  q.title = LABELS[k];
  q.innerHTML = '<span>؟</span>';
  q.addEventListener('click', function(e){
  e.preventDefault();
  e.stopPropagation();
  open(this.getAttribute('data-k'), this);
  });
  b.parentNode.insertBefore(cell, b);
  cell.appendChild(b);
  cell.appendChild(q);
  n++;
  }
  return n;
  }

/* ⛔ بنغلّف الدالتين: fzRenderTabs (الرسم) و fzGo (التبديل).
   أي واحدة فيهم ممكن تمسح العلامتين — فبنثبّتها بعد كل نداء. */
function wrap(name){
  var f = window[name];
  if (typeof f !== 'function' || f.__octa) return;
  var orig = f;
  var w = function(){
  var r = orig.apply(this, arguments);
  try { mount(); } catch(e){}
  return r;
  };
  w.__octa = true;
  w.__octaOrig = orig;
  window[name] = w;
  }
function hook(){
  wrap('fzRenderTabs');
  wrap('fzGo');
  }

function observe(){
  var host = document.getElementById('fzTabsStar');
  if (!host || host.__octaObs) return;
  host.__octaObs = new MutationObserver(function(){ try { mount(); } catch(e){} });
  host.__octaObs.observe(host, { childList:true, subtree:true });
  }

/* ══ النافذة ══ */
var back = null, lastFocus = null, prevOv = null;

function ensureBack(){
  if (back) return back;
  back = document.createElement('div');
  back.id = 'octaQmBack';
  back.className = 'octa-qm-back';
  back.setAttribute('role', 'presentation');
  back.addEventListener('click', function(e){
  var t = e.target;
  if (t === back) { close(); return; }
  if (t && t.closest && t.closest('.octa-qm-x')) close();
  });
  document.body.appendChild(back);
  return back;
  }

function open(k, src){
  var C = window.OCTACOPY || {};
  var html = C[k];
  if (!html) return;
  var b = ensureBack();
  b.innerHTML = '<div class="octa-qm" role="dialog" aria-modal="true" aria-label="'
  + LABELS[k] + '">'
  + '<div class="octa-qm-h"><h3>' + TITLES[k] + '</h3>'
  + '<button class="octa-qm-x" type="button" aria-label="اقفل الشرح">✕</button></div>'
  + '<div class="octa-qm-b">' + html + '</div></div>';
  lastFocus = src || null;
  prevOv = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  b.classList.add('on');
  var x = b.querySelector('.octa-qm-x');
  if (x && x.focus) x.focus();
  }

function close(){
  if (!back) return;
  back.classList.remove('on');
  back.innerHTML = '';
  if (prevOv !== null) document.body.style.overflow = prevOv;
  prevOv = null;
  if (lastFocus && lastFocus.focus){ try { lastFocus.focus(); } catch(e){} }
  lastFocus = null;
  }

document.addEventListener('keydown', function(e){
  if ((e.key === 'Escape' || e.keyCode === 27) && back && back.classList.contains('on')) close();
  });

/* ══ الإقلاع ══ */
function boot(){ hook(); mount(); observe(); }

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

/* ⛔ لو octa-filters.js لسه ما اشتغلش — نستنى ونحاول تاني (لحد 6 ثواني).
   بيقف أول ما العلامتين يتركّبوا، عشان مفضلش مؤقّت شغال في الفاضي. */
var tries = 0;
var iv = setInterval(function(){
  hook(); mount(); observe();
  if (hostReady() || ++tries >= 30) clearInterval(iv);
  }, 200);

function hostReady(){
  var h = document.getElementById('fzTabsStar');
  return !!(h && h.querySelectorAll('.octa-qcell').length >= 2);
  }

/* للاستخدام من الـconsole والاختبار */
window.octaCopyOpen = open;
window.octaCopyClose = close;
window.octaCopyMount = mount;

/* ⛔ الاسم المطلوب في المواصفة: openWhy('TAB5') / openWhy('TAB3')
   ⛔ مجرد اسم بديل لنفس الدالة — مافيش تكرار ولا نسخة تانية.
      الشكل بيفتح بـinnerHTML لأن النص HTML جاهز (details/ul/span). */
window.openWhy = function(id){
  var k = MAP[id] || id;
  if (!window.OCTACOPY || !window.OCTACOPY[k]) return false;
  open(k, null);
  return true;
  };


})();
