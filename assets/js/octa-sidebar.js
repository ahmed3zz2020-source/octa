/* ══════════════════════════════════════════════════════════════
 📂 الشريط الجانبي — كل الصفحات في مكان واحد
 ══════════════════════════════════════════════════════════════
 الشريط الأفقي كان 15 زر في صف واحد وبياخد الشاشة كلها
 وبيكسر على الموبايل. الـsidebar بياخد الشاشات الصغيرة.

 ⛔ الموبايل: بيتقفل افتراضي — الشاشة ضيقة
 ✅ التابلت والديسكتوب: مفتوح على طول
 ══════════════════════════════════════════════════════════════ */
(function () {
 'use strict';

 /* ── المجموعات ──
 مرتبة حسب اللي المستثمر بيدور عليه، مش حسب الترتيب القديم */
 /* ⚠️ الـsidebar بيقرأ من ALL_TOOLS (ال15) — مش من الـtoolbar (8).
 الشاشة الرئيسية = 8، والقائمة = كل حاجة. */
 const GROUPS = [
 { id:'g0', n:'الشاشة الرئيسية', i:'⭐', tools:['stocks','arms','engine','octasearch','dividends','pick','filter','screener'] },
 { id:'g1', n:'القرارات', i:'🎯', tools:['decide','verdict','bestpick'] },
 { id:'g2', n:'المقارنة والبحث', i:'⚖️', tools:['compare'] },
 { id:'g3', n:'أدوات', i:'🧮', tools:['calc'] },
 { id:'g4', n:'محتوى', i:'📰', tools:['news','newsaxis','academy'] },
 ];

 /* ⛌ الافتراضي كان مقفول — أول مرة المستخدم بيفتح الموقع
 مش بيشوف الـsidebar خالص، واللي بيتعلمه إن «مفيش حاجة دي».
 دلوقتي: مفتوح افتراضياً إلا لو المستخدم قفله بنفسه. */
/* ⛌ الافتراضي كان مفتوح — المستخدم طلب يقفل لحد ما يدوس ☰ */
let OPEN = localStorage.getItem('octa_sidebar') === '1';

 function allTools(){
 /* ⛔ الـtoolbar دلوقتي 8 أدوات بس، بس الـsidebar عايز الـ15.
 فبنقرأ من ALL_TOOLS مباشرة — المصدر واحد ومكانه واحد. */
 try {
 if (typeof ALL_TOOLS !== 'undefined' && ALL_TOOLS.length) {
 /* ⭐ ٦ نوفمبر ٢٠٢٦ — فلترة حسب سياق السوق.
 📌 في وضع الأمريكي: الأدوات المصرية بتتشال من القائمة (مش هتكمّل موجودة). */
 const us = (window.OCTACtx && window.OCTACtx.isUS()) ? true : false;
 return ALL_TOOLS.map(t => {
 const us = (window.OCTACtx && window.OCTACtx.isUS()) ? true : false;
 if (us && t.n_us) return { id:t.id, i:(t.i_us||t.i), n:t.n_us, d:(t.d_us||t.d), modal:t.modal, mk:t.mk };
 return { id:t.id, i:t.i, n:t.n, d:t.d, modal:t.modal, mk:t.mk };
 })
 .filter(t => us ? (t.mk === 'us' || t.mk === 'both') : (t.mk === 'egx' || t.mk === 'both'));
 }
 } catch (e) {}
 const el = document.getElementById('toolbar');
 if (!el) return [];
 return Array.from(el.querySelectorAll('.tool-btn')).map(b => ({
 id: b.dataset.tool,
 i: (b.querySelector('.tb-i') || {}).textContent || '',
 n: (b.querySelector('.tb-n') || {}).textContent || '',
 d: b.getAttribute('title') || ''
 }));
 }

 function build(){
 const host = document.getElementById('sideHost');
 if (!host) return;

 const map = {};
 allTools().forEach(t => { map[t.id] = t; });

 // أي أداة مش في مجموعة — نحطها في «أخرى» عشان ما تضيعش
 const grouped = {};
 let used = new Set();
 GROUPS.forEach(g => {
 g.tools.forEach(id => {
 if (map[id]) { grouped[id] = g.n; used.add(id); }
 });
 });
 const rest = Object.keys(map).filter(id => !used.has(id));
 if (rest.length) {
 GROUPS.push({ id:'gX', n:'أخرى', i:'📦', tools:rest });
 rest.forEach(id => grouped[id] = 'أخرى');
 }

 let html = '';
 /* ⛔⭐ ٦ نوفمبر ٢٠٢٦ — مدخل «الأسواق العالمية» في أول القائمة.
    📌 السبب: لوحة الأسواق (وهي اللي فيها تاب 🇺🇸 الأمريكي) مكانتش في الـsidebar خالص
    ⇒ المستخدم مكانش يلاقيها إلا من كارت جوّه صفحة الأذرع.
    📌 الـid = 'world' وبيفتح openMarkets() (مش switchPage) عشان اللوحة تفتح صح. */
 html += '<div class="sg-h"><span class="sg-i">🌎</span>الأسواق</div>';
 const usMode = (window.OCTACtx && window.OCTACtx.isUS()) ? true : false;
 html += '<button class="sb-i" data-tool="world" title="' + (usMode ? 'لوحة السوق الأمريكي' : 'مصر وأمريكا — نفس كارت القرار') + '" ' +
   'onclick="sbGo(\'world\')">' +
   '<span class="sb-ico">' + (usMode ? '🇺🇸' : '🌎') + '</span>' +
   '<span class="sb-t"><b>' + (usMode ? 'لوحة السوق الأمريكي' : 'الأسواق العالمية') + '</b>' +
   '<i>' + (usMode ? '🇺🇸 نفس كارت القرار' : 'مصر · أمريكا · نفس الكارت') + '</i></span>' +
   '</button>';
 /* ⭐ ٦ ноября ٢٠٢٦ — في وضع الأمريكي: مدخل «بنبنيها» (خريطة الأدوات الجاية). */
 if (window.OCTACtx && window.OCTACtx.isUS()) {
 html += '<button class="sb-i" data-tool="wip" title="الأدوات الأمريكية اللي بنبنيها" ' +
 'onclick="sbGo(\'wip\')">' +
 '<span class="sb-ico">🚧</span>' +
 '<span class="sb-t"><b>بنبنيها</b><i>الأدوات الأمريكية الجاية</i></span>' +
 '</button>';
 }
 GROUPS.forEach(g => {
 const items = g.tools.map(id => map[id]).filter(Boolean);
 if (!items.length) return;
 html += '<div class="sg-h"><span class="sg-i">' + g.i + '</span>' + g.n + '</div>';
 html += items.map(t =>
 '<button class="sb-i" data-tool="' + t.id + '" title="' + t.d + '" ' +
 'onclick="sbGo(\'' + t.id + '\')">' +
 '<span class="sb-ico">' + t.i + '</span>' +
 '<span class="sb-t"><b>' + t.n + '</b><i>' + t.d + '</i></span>' +
 '</button>'
 ).join('');
 });

 host.innerHTML =
 '<div class="sb-head">' +
 '<span class="sb-logo">🐙</span>' +
 '<div class="sb-brand"><b>OCTA</b><i>اخطبوط 5</i></div>' +
 '<button class="sb-x" onclick="sbToggle()">✕</button>' +
 '</div>' +
 /* ⭐⭐⭐ بحث في القائمة (١٠ نوفمبر ٢٠٢٦)
    📌 السبب: الشريط طويل (٢٤ زر) ⇒ المستخدم بيدوّر على الأداة ومش
       لاقيها (خصوصاً أداة جديدة). ⛔ البحث بيخفي غير المطابق فوراً.
    📌 ⛔ مفيش فلترة للـDOM (الكود القديم كان بيحذف) ⇒ بنخفي بس. */
 '<div class="sb-search">' +
 '<input type="search" id="sbSearch" placeholder="🔍 دوّر على أداة…" ' +
 'oninput="sbFilter(this.value)" autocomplete="off" />' +
 '</div>' +
 '<nav class="sb-nav" id="sbNav">' + html + '</nav>' +
 '<div class="sb-foot">' +
 '<button class="sb-acc" onclick="OCTAAuth.show(\'login\')">👤 حسابي</button>' +
 /* ⛔⛔ البصمة  لازم المستخدم يلغيها  لو مش عايزها.
 ⛌ من غير ده  المستخدم حبيس  ولازم يسترجع بالباسورد. */
 '<button class="sb-bio" id="sbBio" onclick="sbBio()">👆 البصمة: شغالة</button>' +
 /* ⛔⛔⛔ تسجيل الخروج  لازم يكون واضح ومن تحت خالص.
 ⛌ ليش  التوكن بيفضل في المتصفح  فالموقع بيفتح
 ⛌ على طول من غير ما نعدّي على البوابة  فمش بنقدر
 ⛌ نجرّب تجربة الدخول  من غير ما نخرج الأول. */
 '<button class="sb-out" id="sbLogout" onclick="sbLogout()">' +
 '🚪 تسجيل الخروج</button>' +
 '</div>';

 /* ⛔ حالة البصمة  بتتظبط أول ما القائمة تفتح */
 try {
 var bb = document.getElementById('sbBio');
 if (bb) bb.textContent = localStorage.getItem('octa_bio_on') === '1'
 ? '👆 البصمة: شغالة' : '👆 البصمة: مقفلة';
 } catch (e) { }

 syncOpen();
 markActive();
 }

 function syncOpen(){
 document.body.classList.toggle('sb-open', OPEN);
 }

 function markActive(){
 const cur = (typeof currentPage !== 'undefined') ? currentPage : '';
 document.querySelectorAll('.sb-i').forEach(b => {
 b.classList.toggle('on', b.dataset.tool === cur);
 });
 }

 /* ⭐ إعادة بناء القائمة (لما سياق السوق يتغير) */
 window.sbRebuild = function () { try { build(); } catch (e) {} };

 /* ⭐ فلترة القائمة بالبحث — نخفي غير المطابق (مش بنحذف) */
 window.sbFilter = function (q) {
  try {
   var s = String(q || '').trim().toLowerCase();
   var nav = document.getElementById('sbNav');
   if (!nav) return;
   var groups = Array.prototype.slice.call(nav.querySelectorAll('.sg-h'));
   var btns = Array.prototype.slice.call(nav.querySelectorAll('.sb-i'));
   btns.forEach(function (b) {
    var txt = (b.innerText || '').toLowerCase();
    var hit = !s || txt.indexOf(s) >= 0;
    b.style.display = hit ? '' : 'none';
   });
   /* ⛔ العناوين: نخفي المجموعة لو مفيش تحتها زر ظاهر */
   groups.forEach(function (g) {
    var nxt = g.nextElementSibling, any = false;
    while (nxt && !nxt.classList.contains('sg-h')) {
     if (nxt.classList.contains('sb-i') && nxt.style.display !== 'none') any = true;
     nxt = nxt.nextElementSibling;
    }
    g.style.display = any ? '' : 'none';
   });
   /* ⛔ لو مفيش نتيجة ⇒ رسالة واضحة (مش صفحة فاضية) */
   var none = !btns.some(function (b) { return b.style.display !== 'none'; });
   var msg = document.getElementById('sbNoRes');
   if (!msg) {
    msg = document.createElement('div');
    msg.id = 'sbNoRes';
    msg.style.cssText = 'padding:14px 10px;font-size:.78rem;color:var(--muted);text-align:center';
    nav.parentNode.insertBefore(msg, nav);
   }
   msg.textContent = none ? ('🔍 مفيش أداة اسمها «' + String(q || '').trim() + '»') : '';
   msg.style.display = none ? '' : 'none';
  } catch (e) {}
 };

 window.sbToggle = function () {
 OPEN = !OPEN;
 try { localStorage.setItem('octa_sidebar', OPEN ? '1' : '0'); } catch (e) {}
 syncOpen();
 };

 window.sbGo = function (id) {
 const t = allTools().find(x => x.id === id);
 const isModal = id === 'decide';
 if (isModal && typeof openDecide === 'function') openDecide();
 /* ⛔⭐ ٦ نوفمبر ٢٠٢٦ — مدخل «الأسواق العالمية» ⇒ openMarkets() (مش switchPage).
    📌 السبب: switchPage('markets') بيروح لصفحة الأسهم المصرية (٢٨٥) مش لوحة الأسواق. */
 else if (id === 'world' && typeof openMarkets === 'function') openMarkets();
 else if (id === 'wip') { if (typeof openUsWip === 'function') openUsWip('filter'); }
 else if (typeof switchPage === 'function') switchPage(id);
 // على الموبايل نقفل بعد الاختيار
 if (window.innerWidth < 900 && OPEN) {
 OPEN = false;
 try { localStorage.setItem('octa_sidebar', '0'); } catch (e) {}
 syncOpen();
 }
 };

 // زرار فتح في الهيدر
 /* ⛔ تسجيل الخروج  لازم يمسح كل حاجة  مش التوكن بس
  وكمان يفتح البوابة  عشان المستخدم يشوف أول مرة من جديد. */
 window.sbLogout = function () {
 if (!window.confirm('تسجيل الخروج؟ هتحتاج الـ4 أرقام تاني.')) return;
 try { localStorage.removeItem('octa_token'); } catch (e) {}
 try { localStorage.removeItem('octa_user'); } catch (e) {}
 try { sessionStorage.clear(); } catch (e) {}
 OPEN = false;
 try { localStorage.setItem('octa_sidebar', '0'); } catch (e) {}
 try {
 var g = document.getElementById('gate');
 if (g) g.remove();
 if (typeof window.OCTAGate === 'object' && window.OCTAGate) {
 if (typeof window.OCTAGate.welcome === 'function') window.OCTAGate.welcome();
 if (typeof window.OCTAGate.open === 'function') window.OCTAGate.open();
 }
 } catch (e) {}
 if (typeof window.OCTAAuthFailShown !== 'undefined') window.OCTAAuthFailShown = false;
 /* ⛌ الـreload  لازم يبقى **بعد** ما البوابة ترسم 
  كده الصفحة بتتحمّل  والتوكن مش موجود 
  والبوابة بترسم لوحدها  ونتيجة مضمونة. */
 setTimeout(function () { window.location.reload(); }, 60);
 };

 /* ⛔⛔⛔ ⭐⭐⭐ البصمة  بتاخد نفس دالة البوابة  نفس المسار.
 ⛌ كانت  هنا  `fetch`  لوحدها وبتعمل
 ⛌ request مختلف والمتصفح كان
 ⛌ بيرفضه وبنشوف «يرفض موقع».
 ⛌ ⭐ دلوقتي  بننادي `OCTAGate.bioToggle`  نفس
 ⛌ الدالة نفس المسار ونفس التوكن . */
 function bioState() {
 try { return localStorage.getItem('octa_bio_on') === '1'; }
 catch (e) { return false; }
 }
 function bioBtnText() {
 var b = document.getElementById('sbBio');
 if (b) b.textContent = bioState() ? '👆 البصمة: شغالة' : '👆 البصمة: مقفلة';
 }
 window.bioBtnText = bioBtnText;

 window.sbBio = function () {
 var G = window.OCTAGate;
 if (!G || typeof G.bioToggle !== 'function') {
 window.alert('⛔ البوابة لسه بتحمّل  استنى ثانية وحاول تاني');
 return;
 }
 /* ⛌⛔⛔ مافيش confirm  مافيش fetch  مافيش alert
 الدالة الواحدة بتعمل كل حاجة وبترجّع النتيجة. */
 G.bioToggle(!bioState());
 };

 window.sbOpenBtn = function () {
 OPEN = true;
 try { localStorage.setItem('octa_sidebar', '1'); } catch (e) {}
 syncOpen();
 };

 window.addEventListener('DOMContentLoaded', () => {
 build();
 });

 /* 🧭 كان غلاف على switchPage. دلوقتي hook — بيشتغل بعد ما
    الصفحة تتفعّل، ومش بيلمس window.switchPage خالص. */
 if (typeof OS_NAV !== 'undefined' && OS_NAV.on) {
 OS_NAV.on(function (id) {
 window.currentPage = id;
 markActive();
 });
 }
})();