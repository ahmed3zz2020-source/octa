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
 { id:'g4', n:'محتوى', i:'📰', tools:['news','academy'] },
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
 return ALL_TOOLS.map(t => ({ id:t.id, i:t.i, n:t.n, d:t.d, modal:t.modal }));
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
 '<nav class="sb-nav">' + html + '</nav>' +
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

 window.sbToggle = function () {
 OPEN = !OPEN;
 try { localStorage.setItem('octa_sidebar', OPEN ? '1' : '0'); } catch (e) {}
 syncOpen();
 };

 window.sbGo = function (id) {
 const t = allTools().find(x => x.id === id);
 const isModal = id === 'decide';
 if (isModal && typeof openDecide === 'function') openDecide();
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