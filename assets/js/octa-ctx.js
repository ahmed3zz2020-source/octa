/* ═══ OCTA · octa-ctx.js · سياق السوق (مصر / أمريكا) ═══
   ⭐ ٦ نوفمبر ٢٠٢٦ — طلب المالك:
   «لما ندوس على الأمريكي من الضبط، الداشبورد كله يبقى يخص أمريكا».

   📌 المصدر الواحد للحالة = localStorage (وقت الحقيقة مش وقت التشغيل).
   📌 كل أداة/صفحة/ذراع بيسأل OCTACtx.get() ⇒ يقرر: مصر ولا أمريكا.
   📌 مفيش صفحة مصرية تتفتح في وضع أمريكا (دي كانت المشكلة: الداشبورد
     كان بيفضل ١٠٠٪ مصري وخلاص).

   ⚠️ ملاحظات تقنية (متحقَّق منها):
   · الدوال جوّه object literal لازم بينها فاصلة.
   · ممنوع تكتب نص فيه خاتمة كومنت جوّه كومنت.
   · الفحص بـ esbuild مش node --check.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var KEY = 'octa_ctx_v1';
var listeners = [];

function read(){
  try{
    var o = JSON.parse(localStorage.getItem(KEY) || '{}');
    return (o && o.market === 'us') ? 'us' : 'egypt';
  }catch(e){ return 'egypt'; }
}
var MKT = read();

function save(){
  try{ localStorage.setItem(KEY, JSON.stringify({ market: MKT })); }catch(e){}
}
function get(){ return MKT; }
function isUS(){ return MKT === 'us'; }
function onChange(fn){ if (typeof fn === 'function') listeners.push(fn); }
function notify(){
  listeners.forEach(function(fn){ try{ fn(MKT); }catch(e){} });
}

/* ⭐ كل أداة لها سوق:
   'egx' = مصرية بس · 'us' = أمريكية بس · 'both' = في الوضعين */
function toolMk(id){
  try{
    if (typeof ALL_TOOLS !== 'undefined' && ALL_TOOLS.length){
      for (var i=0;i<ALL_TOOLS.length;i++){
        if (ALL_TOOLS[i].id === id && ALL_TOOLS[i].mk) return ALL_TOOLS[i].mk;
      }
    }
  }catch(e){}
  return 'both';
}
function toolAllowed(id){
  var mk = toolMk(id);
  if (mk === 'both') return true;
  return isUS() ? (mk === 'us') : (mk === 'egx');
}

/* ⭐ الأدوات المتاحة في وضع أمريكا + عنوان كل واحدة (لصفحة «قيد البناء») */
var US_WIP = {
  engine:     ['🧠', 'محرك السوق الأمريكي', 'التحليل الكامل بالمحاور — بنبنه دلوقتي'],
  filter:     ['🗂️', 'فلاتر المؤشرات الأمريكية', 'نفس فلاتر مصر بس بمعادلات السوق الأمريكي'],
  screener:   ['🔍', 'OCTAView الأمريكي', 'الفلاتر المباشرة على الأسهم الأمريكية'],
  octasearch: ['🔎', 'بحث OCTA الأمريكي', 'دوّر على أي سهم أمريكي بالاسم أو الرمز'],
  dividends:  ['📅', 'التوزيعات الأمريكية', 'Dividends + yield لكل سهم'],
  pick:       ['🆚', 'المقارنة الذكية', 'اكتب لحد ١٠ أسهم أمريكية'],
  compare:    ['⚖️', 'مقارنة الأصول', 'لحد ٦ أصول أمريكيين جنب بعض'],
  bestpick:   ['🏆', 'أفضل فرصة', 'اختيار السهم الأمريكي'],
  money:      ['💰', 'Smart Money الأمريكي', 'قوة الفلوس · ٤ محاور'],
  radar:      ['🛰️', 'الرادار الذكي الأمريكي', 'مسح السوق الأمريكي · ٤ مؤشرات'],
  zones:      ['🗺️', 'المناطق الأمريكية', 'أقرب مستوى قدام كل سهم'],
  setups:     ['🧩', 'النماذج الأمريكية', 'أنماط كسر مُقاسة'],
  dash:       ['📊', 'لوحة التحكم الأمريكية', 'حالة النظام · أفضل ١٠ أسهم'],
  news:       ['📰', 'أخبار السوق الأمريكي', 'أخبار الشركات الأمريكية'],
  verdict:    ['🃏', 'كارت القرار الأمريكي', 'يتحسب وقت الفتح'],
  decide:     ['🎯', 'قرار اليوم', '٣ قرارات جاهزة'],
  academy:    ['🎓', 'أكاديمية', 'بافيت · لينتش'],
  calc:       ['🧮', 'حاسبات', '٤ أدوات']
};

/* ⭐ تطبيق الحالة على الواجهة كلها */
function apply(){
  var us = isUS();
  try{ document.body.classList.toggle('ctx-us', us); }catch(e){}
  try{ if (typeof buildToolbar === 'function') buildToolbar(); }catch(e){}
  try{ if (typeof window.sbRebuild === 'function') window.sbRebuild(); }catch(e){}
  try{
    if (window.octaNav && typeof window.octaNav.mark === 'function') window.octaNav.mark('');
  }catch(e){}
  /* ⛔ الصفحة المفتوحة: لو مصرية ونحن في وضع أمريكا ⇒ صفحة «قيد البناء» */
  try{
    var cur = (typeof OS_NAV !== 'undefined' && OS_NAV.get) ? (OS_NAV.get() || '') : '';
    if (us && cur && cur !== 'wip' && !toolAllowed(cur)){
      if (typeof switchPage === 'function') switchPage('wip');
    }
  }catch(e){}
  /* ⭐ تاب لوحة الأسواق يتبع السوق */
  try{ if (typeof window.mkSetMK === 'function') window.mkSetMK(MKT); }catch(e){}
}

function set(m, opts){
  m = (m === 'us') ? 'us' : 'egypt';
  var changed = (m !== MKT);
  MKT = m;
  save();
  apply();
  if (changed || (opts && opts.force)) notify();
  return MKT;
}

/* ⭐ الصفحة الفاضية (قيد البناء) — بتاخد عنوان الأداة */
function wipInfo(id){
  var w = US_WIP[id];
  if (w) return { icon: w[0], title: w[1], sub: w[2] };
  return { icon: '🚧', title: 'الأداة دي بنتباها للسوق الأمريكي', sub: 'لسه شغالة عليها' };
}

window.OCTACtx = {
  get: get, set: set, isUS: isUS, onChange: onChange, apply: apply,
  toolMk: toolMk, toolAllowed: toolAllowed, wipInfo: wipInfo, KEY: KEY
};

/* ⭐ تطبيق الحالة الأولى (وقت فتح الصفحة) */
try{ apply(); }catch(e){}
try{
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ try{ apply(); }catch(e){} });
  }
}catch(e){}
})();
