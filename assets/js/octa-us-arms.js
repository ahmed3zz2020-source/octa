/* ═══ OCTA · octa-us-arms.js · أذرع السوق الأمريكي ═══
   ⭐ ٦ نوفمبر ٢٠٢٦ — طلب المالك: في وضع America الداشبورد كله يبقى أمريكي.
   📌 كل ذراع بتبني نفسها من نفس مصدر البيانات (فيدرول) + محرك الدرجة نفسه.
   📌 مفيش أي رقم مصري هنا — الأرقام كلها من TradingView scanner.

   ⚠️ ملاحظات تقنية:
   · الدوال جوّه object literal لازم بينها فاصلة.
   · ممنوع تكتب نص فيه خاتمة كومنت جوّه كومنت.
   · الفحص بـ esbuild مش node --check.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var HERO = {
  market:       { q:'السوق الأمريكي عامل إيه دلوقتي؟',
                  lead:'مؤشر S&P 500 • ١١ سهم كبرى • كارت القرار • الفرص',
                  icon:'🇺🇸', color:'#38bdf8' },
  technical:    { q:'مين عنده نموذج فني دلوقتي؟',
                  lead:'RSI • MACD • المتوسطات • التذبذب • أعلى ١١ سهم',
                  icon:'📈', color:'#22c55e' },
  fundamental:  { q:'مين رخيص مقارنة بأسهمه؟',
                  lead:'P/E • P/B • ROE • هامش الربح • الدين',
                  icon:'💰', color:'#d4af37' },
  liquidity:    { q:'فين الفلوس رايحة في أمريكا؟',
                  lead:'حجم التداول • الحجم النسبي • القيمة السوقية',
                  icon:'💧', color:'#06b6d4' },
  news:         { q:'فيه خبر يقلب معادلة سهم؟',
                  lead:'مصدر الأخبار الأمريكي — بنشتغل عليه',
                  icon:'📰', color:'#a855f7' },
  risk:         { q:'مين الخطر فيه عالي؟',
                  lead:'التذبذب • البيتا • الدين • المسافة عن القمة',
                  icon:'⚠️', color:'#ef4444' },
  portfolio:    { q:'مين يناسب محفظتي الأمريكية؟',
                  lead:'بنشتغل عليها — محفظتك في السوق الأمريكي',
                  icon:'💼', color:'#8b5cf6' },
  opportunity:  { q:'إيه أكتر فرصة دلوقتي؟',
                  lead:'ترتيب النتيجة • السعر المستهدف • بوابة القرار',
                  icon:'🎯', color:'#16c79a' }
};

/* ── أدوات ─────────────────────────────────────────────── */
function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}
function rows(){
  try{
    if (typeof DATA !== 'undefined' && DATA && DATA.us && DATA.us.stocks) return DATA.us.stocks;
  }catch(e){}
  return null;
}
function short(o){ return String(o._symbol||'').split(':').pop(); }
function nm(o){ return o.name || short(o); }
function axes(o){
  try{ return (typeof scoreUSFull === 'function') ? scoreUSFull(o) : {}; }catch(e){ return {}; }
}
function sc(o){
  try{ return (typeof scoreUSFull === 'function') ? scoreUSFull(o).total : (o._sc||0); }catch(e){ return o._sc||0; }
}
function pf(v){ return (v==null||isNaN(v))?'—':Number(v).toFixed(2); }
function p1(v){ return (v==null||isNaN(v))?'—':(Number(v)>0?'+':'')+Number(v).toFixed(1)+'%'; }
function big(n){
  if (n==null||isNaN(n)) return '—';
  var a=Math.abs(n);
  if (a>=1e12) return (n/1e12).toFixed(2)+' تريليون';
  if (a>=1e9) return (n/1e9).toFixed(1)+' مليار';
  if (a>=1e6) return (n/1e6).toFixed(0)+' مليون';
  if (a>=1e3) return (n/1e3).toFixed(0)+' ألف';
  return String(n);
}
function row(o, extra){
  var c = o.change||0;
  return '<div class="ic-row" onclick="event.stopPropagation(); openCard(\''+short(o)+'\',null,\'us\')">' +
    '<span class="r-c" style="direction:ltr;text-align:left">' + esc(short(o)) + '</span>' +
    '<span class="r-n" dir="auto">' + esc(nm(o)) + '</span>' + (extra||'') +
    '<span class="r-s">' + sc(o) + '</span>' +
    '<span class="r-x ' + (c>=0?'pos':'neg') + '">' + (c>=0?'+':'') + c.toFixed(1) + '%</span>' +
    '</div>';
}
function rowsHtml(list, extraFn){
  if (!list || !list.length) return '<div class="ss-empty">لا توجد بيانات</div>';
  return '<div class="ic-rows">' + list.slice(0,12).map(function(o){
    return row(o, extraFn ? extraFn(o) : '');
  }).join('') + '</div>';
}
function ucard(icon, title, desc, stat, body, color){
  return '<div class="ic" onclick="icToggle(this)" style="--ac:' + color + '">' +
    '<span class="ic-ico">' + icon + '</span>' +
    '<div class="ic-t">' + title + '</div>' +
    '<div class="ic-d">' + desc + '</div>' +
    (stat ? '<div class="ic-stat"><b>' + stat + '</b></div>' : '') +
    '<div class="ic-more">' + body + '</div>' +
    '</div>';
}
function grid(inner, color){
  return '<div class="ic-grid" style="--ac:' + color + '">' + inner + '</div>';
}
function byKey(list, key, dir){
  return list.slice().sort(function(a,b){
    var x = key(a), y = key(b);
    if (x==null) return 1;
    if (y==null) return -1;
    return dir ? (y-x) : (x-y);
  });
}
function keyVal(o, k){ return (o && o[k]!=null) ? o[k] : null; }

/* ── لوحات كل ذراع ────────────────────────────────────── */
function buildMarket(list){
  var idx = null;
  try{ if (typeof DATA !== 'undefined' && DATA && DATA.us) idx = DATA.us.index; }catch(e){}
  var top = byKey(list, function(o){ return sc(o); }, true);
  var movers = byKey(list, function(o){ return o.change; }, true);
  var caps = byKey(list, function(o){ return o.market_cap_basic; }, true);
  var idxCard = idx
    ? ucard('📊','مؤشر S&P 500','السوق الأمريكي العام', nf(idx.value,2)+' · '+p1(idx.change),
        '<div class="ic-rows"><div class="ic-row"><span class="r-c" style="direction:ltr;text-align:left">SPX</span>' +
        '<span class="r-n">S&P 500</span><span class="r-x '+(idx.change>=0?'pos':'neg')+'">' +
        p1(idx.change)+'</span></div></div>', '#38bdf8')
    : '';
  return grid(
    idxCard +
    ucard('🏆','الأعلى نتيجة','ترتيب محرك OCTA على الأسهم الأمريكية', top.length+' سهم',
      rowsHtml(top.slice(0,8)), '#d4af37') +
    ucard('📈','أكتر اتحرك','أعلى نسبة تغيير اليوم', movers.length+' سهم',
      rowsHtml(movers.slice(0,8)), '#22c55e') +
    ucard('🏛️','أكبر قيمة سوقية','حجم الشركة بالسوق', caps.length+' سهم',
      rowsHtml(caps.slice(0,8), function(o){
        return '<span class="r-n" style="min-width:64px;text-align:left;direction:ltr">' + big(o.market_cap_basic) + '</span>';
      }), '#8b5cf6'),
    '#38bdf8');
}
function nf(v,d){ return (v==null||isNaN(v))?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:d||2}); }

function buildTechnical(list){
  var byTech = byKey(list, function(o){ return axes(o).technical; }, true);
  var weak = byTech.slice().reverse();
  return grid(
    ucard('🎯','أقوى فنياً','ترتيب على RSI و MACD والمتوسطات و ATR', byTech.length+' سهم',
      rowsHtml(byTech.slice(0,8)), '#22c55e') +
    ucard('📊','قراءة المؤشرات','RSI و ATR% لكل سهم', '١١ سهم',
      rowsHtml(byKey(list, function(o){ return o.RSI; }, false), function(o){
        var ap = (o.ATR!=null && o.close) ? (o.ATR/o.close*100).toFixed(2) : '—';
        return '<span class="r-n" style="min-width:78px;text-align:left;direction:ltr">RSI '+pf(o.RSI)+' · ATR '+ap+'%</span>';
      }), '#38bdf8') +
    ucard('⚠️','أضعف فنياً','إشارة سلبية — حذر', weak.length+' سهم',
      rowsHtml(weak.slice(0,6)), '#ef4444') +
    ucard('🧭','فوق/تحت المتوسطات','السعر مقارنة بـ EMA 50 و EMA 200', 'مقارنة',
      rowsHtml(list, function(o){
        var t = '—';
        if (o.close!=null && o.EMA200!=null) t = (o.close>o.EMA200)?'فوق EMA200':'تحت EMA200';
        return '<span class="r-n" style="min-width:70px;text-align:left">' + t + '</span>';
      }), '#06b6d4'),
    '#22c55e');
}
function buildFundamental(list){
  var byF = byKey(list, function(o){ return axes(o).fundamental; }, true);
  var cheap = byKey(list.filter(function(o){ return o.price_earnings_ttm>0; }),
                    function(o){ return o.price_earnings_ttm; }, false);
  var roe = byKey(list.filter(function(o){ return o.return_on_equity_fq!=null; }),
                  function(o){ return o.return_on_equity_fq; }, true);
  return grid(
    ucard('🏆','أقوى أساسياً','ترتيب الأساسيات (P/E · ROE · هامش · دين)', byF.length+' سهم',
      rowsHtml(byF.slice(0,8)), '#d4af37') +
    ucard('💰','الأرخص','أقل P/E بين الأسهم المتاحة', cheap.length+' سهم',
      rowsHtml(cheap.slice(0,8), function(o){
        return '<span class="r-n" style="min-width:56px;text-align:left;direction:ltr">P/E '+pf(o.price_earnings_ttm)+'</span>';
      }), '#16c79a') +
    ucard('📈','أعلى ROE','العائد على حقوق الملكية', roe.length+' سهم',
      rowsHtml(roe.slice(0,8), function(o){
        return '<span class="r-n" style="min-width:56px;text-align:left;direction:ltr">ROE '+pf(o.return_on_equity_fq)+'%</span>';
      }), '#22c55e') +
    ucard('🧾','الدين والربح','نسبة الدين وصافي الربح', 'مقارنة',
      rowsHtml(list, function(o){
        return '<span class="r-n" style="min-width:96px;text-align:left;direction:ltr">D/E '+pf(o.debt_to_equity)+
               ' · NI '+big(o.net_income)+'</span>';
      }), '#8b5cf6'),
    '#d4af37');
}
function buildLiquidity(list){
  var byL = byKey(list, function(o){ return axes(o).liquidity; }, true);
  var vol = byKey(list, function(o){ return o.volume; }, true);
  return grid(
    ucard('💧','أعلى سيولة','ترتيب على الحجم والحجم النسبي والقيمة السوقية', byL.length+' سهم',
      rowsHtml(byL.slice(0,8)), '#06b6d4') +
    ucard('📊','أكبر تداول','حجم التداول الفعلي', vol.length+' سهم',
      rowsHtml(vol.slice(0,8), function(o){
        return '<span class="r-n" style="min-width:74px;text-align:left;direction:ltr">'+big(o.volume)+'</span>';
      }), '#38bdf8') +
    ucard('⚡','الحجم النسبي','الحجم مقارنة بالمعتاد (10 أيام)', 'مقياس',
      rowsHtml(list, function(o){
        return '<span class="r-n" style="min-width:44px;text-align:left;direction:ltr">'+pf(o.relative_volume_10d_calc)+'×</span>';
      }), '#d4af37') +
    ucard('🏛️','القيمة السوقية','حجم كل شركة', 'مقارنة',
      rowsHtml(byKey(list, function(o){ return o.market_cap_basic; }, true).slice(0,8), function(o){
        return '<span class="r-n" style="min-width:74px;text-align:left;direction:ltr">'+big(o.market_cap_basic)+'</span>';
      }), '#8b5cf6'),
    '#06b6d4');
}
function buildRisk(list){
  var byR = byKey(list, function(o){ return axes(o).risk; }, true);
  var risky = byR.slice().reverse();
  var fromHigh = byKey(list.filter(function(o){ return o.high_52w>0 && o.close!=null; }),
                       function(o){ return (o.close/o.high_52w - 1) * 100; }, false);
  return grid(
    ucard('🛡️','أهدأ سهم','أقل مخاطرة حسب التذبذب والبيتا والدين', byR.length+' سهم',
      rowsHtml(byR.slice(0,8)), '#16c79a') +
    ucard('⚠️','أعلى مخاطرة','خطر أعلى — راجع قبل الشراء', risky.length+' سهم',
      rowsHtml(risky.slice(0,6)), '#ef4444') +
    ucard('📉','أبعد عن القمة','المسافة من أعلى سعر خلال سنة', fromHigh.length+' سهم',
      rowsHtml(fromHigh.slice(0,8), function(o){
        return '<span class="r-n" style="min-width:56px;text-align:left;direction:ltr">'+p1((o.close/o.high_52w-1)*100)+' من القمة</span>';
      }), '#f97316') +
    ucard('📐','أرقام الخطر','تذبذب يومي · بيتا · مدى 52 أسبوع', 'مقارنة',
      rowsHtml(list, function(o){
        return '<span class="r-n" style="min-width:104px;text-align:left;direction:ltr">Vol '+pf(o['Volatility.D'])+
               ' · β '+pf(o.beta_1_year)+'</span>';
      }), '#8b5cf6'),
    '#ef4444');
}
function buildOpportunity(list){
  var top = byKey(list, function(o){ return sc(o); }, true);
  var upside = byKey(list.filter(function(o){
      return o.price_target_median!=null && o.close>0; }),
      function(o){ return (o.price_target_median/o.close - 1) * 100; }, true);
  return grid(
    ucard('🎯','أفضل فرص','ترتيب محرك OCTA على كل الأسهم الأمريكية', top.length+' سهم',
      rowsHtml(top.slice(0,10)), '#16c79a') +
    ucard('💡','السعر المستهدف','الفرق بين السعر الحالي ومستهدف الفيدرول', upside.length+' سهم',
      rowsHtml(upside.slice(0,8), function(o){
        return '<span class="r-n" style="min-width:60px;text-align:left;direction:ltr">'+p1((o.price_target_median/o.close-1)*100)+'</span>';
      }), '#d4af37') +
    ucard('🚦','بوابة القرار','ليه ده مختار؟ — افتح الكارت', 'الدليل',
      '<div class="ss-empty">دوس على أي سهم فوق ⇒ هتلاقي «🐙 ليه ده مختار؟» + «قواعدي» + «بوابة القرار» + «التذكرة»</div>',
      '#38bdf8') +
    ucard('🗂️','فلاتر المؤشرات','بنبنيها للسوق الأمريكي', 'قيد الإنشاء',
      '<div class="ss-empty">قيد الإنشاء — الأدوات المصرية اتشالت في وضع (America) لحد ما تبني نسختها الأمريكية.</div>',
      '#6b7280'),
    '#16c79a');
}
function buildWip(icon, title, sub, note){
  return grid(
    ucard(icon, title, sub, 'قيد الإنشاء',
      '<div class="ss-empty">' + note + '</div>', '#6b7280'),
    '#6b7280');
}

var BUILDERS = {
  market: buildMarket,
  technical: buildTechnical,
  fundamental: buildFundamental,
  liquidity: buildLiquidity,
  news: function(){ return buildWip('📰','أخبار السوق الأمريكي','مصدر الأخبار الأمريكي','بنشتغل على مصدر أخبار الشركات الأمريكية (8-K وإعلانات الأرباح). المعطيات الحالية كلها من الفيدرول.'); },
  risk: buildRisk,
  portfolio: function(){ return buildWip('💼','محفظتك الأمريكية','ملاءمة كل سهم لمحفظتك','بنشتغل على حساب محفظة منفصل للسوق الأمريكي. لحد ما يبقى جاهز، استخدم «التذكرة» في كارت السهم.'); },
  opportunity: buildOpportunity
};

/* ── التشغيل ──────────────────────────────────────────── */
async function loadUs(){
  var r = rows();
  if (r) return r;
  try{ if (typeof window.mkLoad === 'function') await window.mkLoad(); }catch(e){}
  return rows() || [];
}

async function usOpenArm(arm){
  var h = HERO[arm] || HERO.market;
  try{
    document.querySelectorAll('.arm-btn').forEach(function(b){
      b.classList.toggle('active', b.dataset.arm === arm);
    });
    if (typeof OS_NAV !== 'undefined' && OS_NAV.arm) OS_NAV.arm(arm);
    if (typeof showArmView === 'function') showArmView(arm);
  }catch(e){}
  try{
    document.documentElement.style.setProperty('--ac', h.color);
    var hq = document.getElementById('armHeroQ');   if (hq) hq.textContent = h.q;
    var hl = document.getElementById('armHeroLead'); if (hl) hl.textContent = h.lead;
    var hi = document.getElementById('armHeroIco');  if (hi) hi.textContent = h.icon;
    var av = document.getElementById('armView');    if (av) av.style.setProperty('--ac', h.color);
  }catch(e){}
  var box = document.getElementById('armBody');
  if (!box) return;
  box.innerHTML = '<div class="opps-loading">🔄 جاري تحميل بيانات السوق الأمريكي...</div>';
  try{
    var list = await loadUs();
    var fn = BUILDERS[arm] || BUILDERS.market;
    box.innerHTML = fn(list);
  }catch(e){
    box.innerHTML = '<div class="err">⚠️ ' + esc(e.message || 'فشل جلب البيانات الأمريكية') + '</div>';
  }
  try{ window.scrollTo({ top: 0, behavior: 'smooth' }); }catch(e){}
}

window.usOpenArm = usOpenArm;
window.usArmBuilders = BUILDERS;
})();
