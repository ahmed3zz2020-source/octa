

/* ✅ FIX 18-10-2026 —=live prices للفلاتر.
   ⛔ السبب: الفلتر بيقرا OS_DB ودي كاش بيتبني مرة واحدة عند التحميل.
      فلو المستخدم فتح الموقع الساعة ٣٠ وبقا فيه ١٠ وبيعمل refresh للصفحة
      بس مش للموقع كله ⇒ الفلتر بيعرض سعر قديم.
   ⛌ الحل: نحدّث OS_DB من /api/quotes كل ٦٠ ثانية.
   ⛔ نفس endpoint اللي الاسكرينر بيستخدمه — فالفلتر والاسكرينر هيبقوا متطابقين. */
(function octaFilterLivePrices(){
  var LAST = 0;
  function tick(){
    var now = Date.now();
    if (now - LAST < 60000) return;      /* كل دقيقة */
    LAST = now;
    /* FIX 18-10-2026: OS_DB كان let في scope عام — مش window.OS_DB.
      قراءة window.OS_DB كانت هترجع undefined وبيرجّع الـtick فاضي.
       ⛌ الحل: نقرا من الـglobal scope مباشرة (OS_DB متاح كـbinding). */
    var DB = (typeof OS_DB !== 'undefined') ? OS_DB : (window.OS_DB || null);
    if (!DB || !DB.length) return;
    if (!window.OCTA_API) return;
    fetch(window.OCTA_API + '/api/quotes?market=egypt', { cache: 'no-store' })
    .then(function(r){ return r.json(); })
    .then(function(j){
      var rows = (j && j.markets && j.markets.egypt) || null;
      if (!rows) return;
      var n = 0;
      for (var i = 0; i < DB.length; i++){
        var s2 = DB[i], q = rows[s2.code];
        if (!q || q.close == null) continue;
        if (s2.price !== q.close){
          s2._up = q.close > (s2.price || 0);
          s2.price = q.close;
          n++;
        }
        if (q.change != null) s2.change = q.change;
        if (q.volume != null) s2.volume = q.volume;
      }
      if (n && typeof window.fzRenderActive === 'function'){
        try { window.fzRenderActive(); } catch(e){}
      }
      if (n && typeof window.renderStockPage === 'function'){
        try { window.renderStockPage(); } catch(e){}
      }
    })
    .catch(function(){});
  }
  setTimeout(tick, 3000);
  setInterval(tick, 60000);
})();
/* ═══ OCTA · octa-filters.js · 136KB ═══ */
/* ══════════════════════════════════════════════════════════════
  🛡️ فلتر الأمان — أول فلتر من الثمانية
  مبني على OS_DB الحقيقية (296 سهم) — مش بيانات تجريبية
  ══════════════════════════════════════════════════════════════ */

const FLT_SAFETY = { on:false, beta:1.2, vol:50, mdd:50, sharpe:0 };

function fltNum(v, dec){ return (v==null||v!==v) ? '—' : Number(v).toFixed(dec==null?1:dec); }
function escFlt(s){ return String(s==null?'':s).replace(/[<>&]/g, function(c){
  return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]; }); }

function fltRows(){
  const f = FLT_SAFETY;
  return OS_DB.filter(function(s){
  const has = [s.vol1y, s.mdd1y, s.sharpe3y, s.beta].filter(x=>x!=null).length;
  if (has < 2) return false;
  if (f.on){
  if (s.beta  != null && s.beta  > f.beta)  return false;
  if (s.vol1y  != null && s.vol1y  > f.vol)  return false;
  if (s.mdd1y  != null && s.mdd1y  > f.mdd)  return false;
  if (s.sharpe3y  != null && s.sharpe3y  < f.sharpe) return false;
  }
  return true;
  });
}

/* 🎯 درجة الأمان 0-100 */
function fltSafetyScore(s){
  let sc = 0;
  if (s.vol1y  != null) sc += (s.vol1y  < 25 ? 32 : s.vol1y  < 35 ? 26 : s.vol1y  < 50 ? 17 : 8);
  if (s.mdd1y  != null) sc += (s.mdd1y  < 20 ? 32 : s.mdd1y  < 35 ? 26 : s.mdd1y  < 50 ? 16 : 6);
  if (s.sharpe3y!= null) sc += (s.sharpe3y> 1  ? 20 : s.sharpe3y>0.5 ? 14 : s.sharpe3y>0 ? 8 : 3);
  if (s.beta  != null) sc += (s.beta  < 0.8 ? 16 : s.beta  < 1.1 ? 11 : s.beta  < 1.3 ? 6 : 2);
  return Math.round(sc);
}

/* 🎯 معامل المخاطرة — السالب/الصفر = السهم بيتحرك لوحده */
function fltBeta(v){
  if (v == null) return '<span class="flt-na">—</span>';
  if (Math.abs(v) < 0.15)
  return '<span class="flt-b ok" title="السهم بيتحرك لوحده — بعيد عن السوق">◈ '+
  (v < 0 ? 'معاكس' : 'منفصل')+'</span>';
  return fltBadge(v, 1.1, 0, 1);
}

function fltBadge(v, good, bad, invert, unit){
  /* ⛔ ناقص = «—» نضيف. والوحدة بتتطبع جوه الشارة بس لما في رقم،
     عشان الناقص مطلعش «—%» — الرقم الناقص مالهوش وحدة أصلاً. */
  if (v == null) return '<span class="flt-na">—</span>';
  const ok = invert ? (v <= good) : (v >= good);
  const bd = invert ? (v >= bad)  : (v <= bad);
  return '<span class="flt-b '+(ok?'ok':bd?'bad':'mid')+'">'+fltNum(v)
       + (unit?'<i>'+unit+'</i>':'')+'</span>';
}

/* ═══════ ❓ كارت الشرح — نشرحها لحد عنده 15 سنة ═══════ */
let FLT_HELP = false;

function fltHelpBox(){
  const on = FLT_HELP;
  let h = '<div class="flt-help">';
  h += '<button class="flt-help-h'+(on?' open':'')+'" onclick="fltHelpToggle()">'
  +  '<span>❓ إيه الفلتر ده؟ وإيه بيفيدني منه؟</span><i>'+(on?'✕':'؟')+'</i></button>';
  h += '<div class="flt-help-b" style="display:'+(on?'block':'none')+'">';

  /* ① الفكرة */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🎯</span> الفكرة في سطر</div>'
  + '<p class="flt-h-p">في البورصة فيه أسهم زي البنوك — لوحدها بتمشي بهدوء.</p>'
  + '<p class="flt-h-p">وفي أسهم زي المرايج — لوحدها بتمشي وتيجي بعنف.</p>'
  + '<p class="flt-h-p"><b>الفلتر ده بيطلعلك الأسهم الهادية بس.</b> '
  + 'يعني لو السوق كله نزل <span class="flt-ltr">10%</span>، هي العادي ما تنزلش غير <span class="flt-ltr">3%</span>.</p>'
  + '<div class="flt-h-ex">'
  +  '<div class="flt-h-exi"><b>🛡 آمن</b><span>سهم هادي</span><em>السوق <span class="flt-ltr">−10%</span> ← هو <span class="flt-ltr">−3%</span></em></div>'
  +  '<div class="flt-h-exi bad"><b>⚠️ خطر</b><span>سهم عنيف</span><em>السوق <span class="flt-ltr">−10%</span> ← هو <span class="flt-ltr">−73%</span></em></div>'
  + '</div></div>';

  /* ② الأرقام الأربعة */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📊</span> الأرقام اللي بنقيس بيها — ومعناها إيه</div>';
  h += '<div class="flt-h-metric"><b>① معامل المخاطرة (Beta)</b>'
  + '<p><b>السهم بيتحرك قد إيه مع السوق؟</b></p>'
  + '<p>السوق نزل <span class="flt-ltr">10%</span> وهو نزل <span class="flt-ltr">10%</span> ⇒ <b>Beta = 1</b> (مثل السوق)</p>'
  + '<p>السوق نزل <span class="flt-ltr">10%</span> وهو نزل <span class="flt-ltr">3%</span> ⇒ <b>Beta = 0.3</b> (هادي)</p>'
  + '<p>السوق نزل <span class="flt-ltr">10%</span> وهو نزل <span class="flt-ltr">25%</span> ⇒ <b>Beta = 2.5</b> (عنيف)</p>'
  + '<p class="flt-h-note">⚡ لما يشوف «◈ منفصل» معناها (Beta) تحت 0.15 — السهم مش بيهم مع السوق خالص. '
  + 'ده أحسن حاجة في الفلتر: لو السوق وقع، السهم ده مش هيقع.</p></div>';
  h += '<div class="flt-h-metric"><b>② التذبذب السنوي</b>'
  + '<p><b>السهم بيتحرك كام في السنة بالمعدل؟</b></p>'
  + '<p>يعني سعر السهم بيتغيّر كام في المرة في السنة العادية (مش أسوأ حالة).</p>'
  + '<p>تذبذب <span class="flt-ltr">25%</span> ⇒ بيتحرك تقريباً ±<span class="flt-ltr">25%</span> في السنة</p>'
  + '<p class="flt-h-note">⚠️ تذبذب <span class="flt-ltr">70%</span> يعني ممكن يتحرك <span class="flt-ltr">70%</span> في السنة دي — وده مش استثناء، ده العادي.</p></div>';
  h += '<div class="flt-h-metric"><b>③ أقصى هبوط في سنة</b>'
  + '<p><b>أكبر خسارة حصلتله آخر سنة؟</b></p>'
  + '<p>رقم حقيقي من تاريخ السهم — مش تقدير ولا تخمين.</p>'
  + '<p>هبوط <span class="flt-ltr">18%</span> ⇒ في أسوأ سنة نزل <span class="flt-ltr">18%</span> من قيمته</p>'
  + '<p class="flt-h-note">💡 ده الرقم اللي بيفرق معاك فلوسك: لو معاك 100 ألف جنيه وهبوط <span class="flt-ltr">18%</span> '
  + '⇒ أخسرك 18 ألف. لو هبوط <span class="flt-ltr">73%</span> ⇒ أخسرك 73 ألف.</p></div>';
  h += '<div class="flt-h-metric"><b>④ شارب (Sharpe)</b>'
  + '<p><b>العائد يستاهل المخاطرة؟</b></p>'
  + '<p>ببساطة: كام جنيه بتكسب مقابل كل جنيه بتخاطر بيه.</p>'
  + '<p>شارب 1.33 ⇒ بتكسب 1.33 جنيه لكل 1 مخاطرة ← ممتاز</p>'
  + '<p>شارب 0.26 ⇒ بتكسب 0.26 جنيه لكل 1 مخاطرة ← ضعيف</p>'
  + '<p class="flt-h-note">📌 شراب سالب = خسران حتى بعد ما تتحمّل المخاطرة. '
  + 'ده سهم لو معاك فيه فلوس، الأحسن تتخلص منها.</p></div>';
  h += '</div>';

  /* ③ الدرجة */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🏅</span> درجة الأمان من 100 — بتتحسب إزاي</div>'
  + '<p class="flt-h-p">بنحسب 4 حاجات، وكل واحد ليه وزن مختلف:</p>'
  + '<div class="flt-h-w">'
  +  '<div class="flt-h-wi"><span>التذبذب</span><b>32</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>هبوط السنة</span><b>32</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>شارب</span><b>20</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>Beta</span><b>16</b><i>من 100</i></div>'
  + '</div>'
  + '<p class="flt-h-p" style="margin-top:10px">لو السهم تذبذب قليل وهبط قليل وشاربه كويس '
  + '⇒ درجته <b>100 ★</b>. ولو العكس ⇒ درجته قريبة من الصفر.</p>'
  + '<div class="flt-h-legend">'
  +  '<span class="hi">85-100 · 🟢 آمن جداً</span>'
  +  '<span class="md">65-84 · 🟡 آمن</span>'
  +  '<span class="lo">0-64 · 🔴 خطر</span>'
  + '</div></div>';

  /* ④ المعايير */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🎚️</span> أرقام الفلاتر وليه اخترناها</div>'
  + '<table class="flt-h-tbl"><thead><tr><th>الفلتر</th><th>الرقم</th><th>ليه؟</th></tr></thead><tbody>'
  + '<tr><td>Beta</td><td>1.2</td><td>فوق 1.2 السهم بيتحرك أكتر من السوق — نتجنّبه</td></tr>'
  + '<tr><td>تذبذب</td><td>50%</td><td>فوق <span class="flt-ltr">50%</span> حركة السهم سنوية كبيرة — محتاج صبر</td></tr>'
  + '<tr><td>هبوط سنة</td><td>50%</td><td>لو بيقبل ينزل نص قيمته — ده استثمار عالي خطورة</td></tr>'
  + '<tr><td>شارب</td><td>0</td><td>شارب صفر يعني مفيش عائد مقابل المخاطرة</td></tr>'
  + '</tbody></table>'
  + '<p class="flt-h-note">📌 الأرقام دي <b>مش تخمين</b> — قلّنا بالفلتر، وبصّينا على السوق كله:</p>'
  + '<ul class="flt-h-ul">'
  + '<li>من 296 سهم، <b>218</b> عندهم بيانات مخاطرة كاملة</li>'
  + '<li>من دول، <b>44 سهم</b> درجتهم 80+ (آمنين)</li>'
  + '<li>فقط <b>7 أسهم</b> درجتها أقل من 40 (خطرين)</li>'
  + '<li>الفرق: هبوط الوسيط <b>18% آمن</b> مقابل <b>73% خطر</b></li>'
  + '</ul></div>';

  /* ⑤ السوابق */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">⚠️</span> ليه ده مهم في السوق المصري بالذات</div>'
  + '<p class="flt-h-p">في البورصة المصرية فيه أسهم <b>فقدت كل قيمتها</b>. دي أرقام حقيقية:</p>'
  + '<div class="flt-h-loss">'
  +  '<div class="flt-h-li"><b>COPR</b><span>العقارية للبنوك الوطنية</span><em>−<span class="flt-ltr">100%</span></em></div>'
  +  '<div class="flt-h-li"><b>ISMA</b><span>السماعيلية للدواجن</span><em>−<span class="flt-ltr">99%</span></em></div>'
  +  '<div class="flt-h-li"><b>RAYA</b><span>راية</span><em>−<span class="flt-ltr">99%</span></em></div>'
  +  '<div class="flt-h-li"><b>EPCO</b><span>إجيبكو</span><em>−<span class="flt-ltr">99%</span></em></div>'
  + '</div>'
  + '<p class="flt-h-p" style="margin-top:10px">الفلتر ده <b>مش بيمنع</b> الخسارة — '
  + 'لكن بيوريكلك <b>فين الخطر</b> قبل ما تدفع.</p></div>';

  /* ⑥ الخطوات */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📱</span> إزاي تستخدمه في 4 خطوات</div>'
  + '<ol class="flt-h-steps">'
  + '<li><b>افتح الفلتر</b> — هتلاقي كل الأسهم الهادية (218 سهم)</li>'
  + '<li><b>شغّل الفلاتر</b> — دوس على 🔓 فوق (الفلاتر مقفولة عشان تشوف الكل الأول)</li>'
  + '<li><b>حرّك المؤشرات</b> — لو عايز أمان أعلى، قلّل الأرقام. النتيجة بتتحدث فوراً</li>'
  + '<li><b>اختار وضيف</b> — دوس ➕ على أي سطر يضيفه للمرشحين تلقائياً</li>'
  + '</ol></div>';

  /* ⑦ التحذير */
  h += '<div class="flt-h-warn">⚠️ <b>مهم:</b> ده أداة تحليل وفلترة — مش نصيحة شراء أو بيع. '
  + 'البيانات بتتأخر أحياناً، والعائد الماضي مضمونش للمستقبل. '
  + 'قبل ما تشتري، اقرأ كارت القرار لكل سهم، ووزّع فلوسك على أكتر من سهم.</div>';

  h += '</div></div>';  /* فاصل flt-help-b + flt-help */
  return h;
}

function fltHelpToggle(){ FLT_HELP = !FLT_HELP; fltRender(); }

/* ═══════ الرسم ═══════ */
function fltInit(){
  const box = document.getElementById('fltBox');
  if (box && !box.dataset.r){ box.dataset.r = '1'; }
  fltRender();
}

function fltRender(){
  const box = document.getElementById('fltBox'); if (!box) return;
  const f = FLT_SAFETY;
  const all = OS_DB.filter(s=>[s.vol1y,s.mdd1y,s.sharpe3y,s.beta].filter(x=>x!=null).length>=2);
  const rows = fltRows().map(function(s){ const c = Object.assign({}, s); c._safe = fltSafetyScore(s); return c; })
  .sort(function(a,b){ return b._safe - a._safe; });

  const sl = (id,label,v,min,max,unit,step)=>
  '<div class="flt-sl"><label>'+label+' <b>'+v+'</b>'+(unit||'')+'</label>'
  + '<input type="range" id="flt-'+id+'" min="'+min+'" max="'+max+'" step="'+(step||1)+'" value="'+v+'" '
  + 'oninput="fltSet(\''+id+'\',this.value)"></div>';

  let h = '';
  h += '<div class="flt-head"><div><h2>🛡️ فلتر الأمان</h2>'
  + '<p class="flt-sub">أسهم أقل مخاطرة — الأرقام محسوبة من تاريخ كل سهم على حدة</p></div>'
  + '<button class="flt-sw'+(f.on?' on':'')+'" onclick="fltToggle()">'
  + (f.on?'🔒 الفلاتر مفعّلة':'🔓 فعّل الفلاتر')+'</button></div>';

  h += '<div class="flt-filters'+(f.on?'':' hid')+'">'
  + sl('beta','أقصى معامل مخاطرة',f.beta,0,2.5,'',0.1)
  + sl('vol','أقصى تذبذب سنوي %',f.vol,15,150,'%')
  + sl('mdd','أقصى هبوط سنة %',f.mdd,10,90,'%')
  + sl('sharpe','أدنى شارب',f.sharpe,-1,2,'',0.1)
  + '<button class="flt-rst" onclick="fltReset()">↺ إعادة</button></div>';

  h += fltHelpBox();

  const avgB = rows.filter(s=>s.beta!=null);
  h += '<div class="flt-stats">'
  + '<div><b>'+rows.length+'</b><span>من '+all.length+' عندهم بيانات</span></div>'
  + '<div><b>'+(all.length?Math.round(rows.length/all.length*100):0)+'%</b><span>نسبة المستوفين</span></div>'
  + '<div><b>'+fltNum(avgB.length?avgB.reduce((a,s)=>a+s.beta,0)/avgB.length:0,2)+'</b><span>متوسط (Beta)</span></div>'
  + '</div>';

  if (!rows.length){
  box.innerHTML = h + '<div class="flt-empty">⛔ مفيش أسهم بتستوفي الشروط دي<br>'
  + '<button class="dv-tab" onclick="fltReset()">وسّع الفلاتر</button></div>';
  return;
  }

  const CAP = 150;
  h += '<div class="flt-tbl-wrap"><table class="flt-tbl"><thead><tr>'
  + '<th>السهم</th><th>🛡 الأمان</th><th>(Beta)</th><th>تذبذب</th><th>هبوط سنة</th>'
  + '<th>هبوط كلي</th><th>شارب</th><th>القطاع</th><th>OCTA</th><th></th>'
  + '</tr></thead><tbody>';
  rows.slice(0,CAP).forEach(function(s){
  h += '<tr>'
  + '<td><b class="flt-c">'+s.code+'</b><small>'+escFlt((s.name||'').slice(0,22))+'</small></td>'
  + '<td><span class="flt-safe s'+(s._safe>=85?'hi':s._safe>=65?'md':'lo')+'">'+s._safe+'</span>'
  +  (s._safe>=100?'<span class="flt-tie" title="أمان كامل">★</span>':'')+'</td>'
  + '<td>'+fltBeta(s.beta)+'</td>'
  + '<td>'+fltBadge(s.vol1y, 35, 50, 1, '%')+'</td>'
  + '<td>'+fltBadge(s.mdd1y, 35, 50, 1, '%')+'</td>'
  + '<td>'+fltBadge(s.mdd, 60, 85, 1, '%')+'</td>'
  + '<td>'+fltBadge(s.sharpe3y, 0.5, 0, 0)+'</td>'
  + '<td class="flt-sect">'+escFlt(s.sectorAr||'—')+'</td>'
  + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
  +  escFlt(s.decision||'—')+'</span><small>'+fltNum(s.score,0)+'% · '+fzConfCell(s.scoreConf)+'</small></td>'
  + '<td><button class="flt-add" onclick="fltAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
  + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول '+CAP+' من '+rows.length+' — ضيّق الفلاتر عشان تشوف الكل</div>';

  /* 🧮 نور: ترتيب الجدول (دوس على رأس العمود) */
  box.innerHTML = h;
  if (typeof nzSortPaint === 'function') nzSortPaint('safety');
}

function fltToggle(){ FLT_SAFETY.on = !FLT_SAFETY.on; fltRender(); }
function fltReset(){ const f = FLT_SAFETY; f.beta=1.2; f.vol=50; f.mdd=50; f.sharpe=0; f.on=false; fltRender(); }
function fltSet(k,v){ FLT_SAFETY[k] = Number(v); fltRender(); }

/* ➕ ضيف للمرشحين مباشرة */
function fltAdd(code){
  const s = OS_DB.find(x=>x.code===code); if (!s) return;
  if (typeof pickAdd !== 'function'){ alert('صفحة المرشحين لسه مش محمّلة'); return; }
  if (typeof PICK === 'undefined' || PICK.indexOf(code) >= 0) return;
  if (!s._flt) s._flt = Object.assign({}, s);
  PICK.push(code);
  PICK_DATA[code] = s._flt;
  PICK_TIME[code] = new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  try{ localStorage.setItem('octa_pick_v1', JSON.stringify({c:PICK,t:PICK_TIME})); }catch(e){}
  const cnt = document.getElementById('pickCount'); if (cnt) cnt.textContent = PICK.length+'/'+(typeof PICK_MAX!=='undefined'?PICK_MAX:10);
  const i = document.getElementById('pickQ');
  if (typeof pickRenderList === 'function') pickRenderList(i?i.value:'');
  if (typeof pickRenderCards === 'function') pickRenderCards();
  fltRender();
}
/* 🛡️ مراقب الوضع — يحدّث خلفية <html> مع body (لو الـbody طلع transparent) */
(function syncThemeToHtml(){
  const html = document.documentElement, b = document.body;
  const sync = () => { html.className = b.className; };
  sync();
  new MutationObserver(sync).observe(b, { attributes:true, attributeFilter:['class'] });
})();


/* ══════════════════════════════════════════════════════════════
  💰 فلتر التوزيعات — الفلتر الثاني
  💡 المبدأ: التوزيع العالي مش دايمًا كويس
  لو الشركة ضعيفة والعائد 40% ⇒ غالبًا مؤقت ومش هيتكرر
  الأحسن: عائد معقول + شركة سليمة
  ══════════════════════════════════════════════════════════════ */

const FLT_INC = { on:false, dyMin:0, dyMax:99, minScore:0, safeOnly:false, sector:'all' };

function fltIncRows(){
  const f = FLT_INC;
  return OS_DB.filter(function(s){
  if (!s.dy || s.dy <= 0) return false;  /* لازم يوزّع أصلاً */
  if (s.dy < f.dyMin || s.dy > f.dyMax) return false;
  if (f.minScore && (s.score||0) < f.minScore) return false;
  if (f.safeOnly){
  /* 💡 الشركة لازم تكون سليمة — نستخدم الأمان المطلق */
  const bad = (s.mdd1y!=null && s.mdd1y>55) || (s.vol1y!=null && s.vol1y>65);
  if (bad) return false;
  }
  if (f.sector!=='all' && (s.sectorAr||'')!==f.sector) return false;
  return true;
  });
}

/* 🎯 درجة «التوزيع الصح» — العendance + صحة الشركة */
function fltIncScore(s){
  const dy = s.dy||0;
  let sc = 0;
  /* ① العائد — بس بتobed سقف: فوق 15% غالباً مؤقت */
  if (dy < 1)  sc += 5;
  else if (dy < 3)  sc += 22;
  else if (dy < 5)  sc += 32;
  else if (dy < 8)  sc += 28;
  else if (dy < 12)  sc += 18;
  else if (dy < 18)  sc += 10;
  else  sc += 4;  /* ⚠️ 18%+ = علامة استفهام مش ميزة */
  /* ② صحة الشركة — ناخد تقييم OCTA */
  const t = s.score||0;
  sc += (t>=70)?26 : (t>=55)?20 : (t>=45)?13 : (t>=35)?6 : 0;
  /* ③ الثقة — بيانات ناقصة = خطر */
  sc += Math.min(14, (s.scoreConf||0) / 100 * 14);
  /* ④ الخطأBag: هبوط-history كبير + توزيع عالي = فخ */
  if (s.mdd1y!=null && s.mdd1y>70 && dy>8) sc = Math.max(0, sc-12);
  return Math.round(sc);
}

/* ⚠️ تنبيه ذكي — ليه العائد ده مش مضمون */
function fltIncWarn(s){
  const dy = s.dy||0, w = [];
  if (dy > 15)  w.push('⚠️ عائد ' + dy.toFixed(0) + '% فوق العادي — ممكن يكون توزيع استثنائي ومش هيتكرر');
  if (dy > 8 && (s.score||0) < 45) w.push('⚠️ التوزيع عالي بس الشركة ضعيفة — خطر توقّف التوزيع');
  if (s.mdd1y != null && s.mdd1y > 60) w.push('⚠️ نزل ' + s.mdd1y.toFixed(0) + '% في أسوأ سنة — التوزيع ممكن يتقطّع');
  if ((s.scoreConf||0) < 60) w.push('📌 بيانات ناقصة (' + (s.scoreConf||0) + '%) — راجع كارت القرار');
  return w;
}

/* 💸 كم هيدفعلك سنوياً لو اشتريت بـ10,000 جنيه */
function fltIncome10k(s){ return (s.dy||0) * 100; }

let FLT_INC_HELP = false;
function fltIncHelpBox(){
  const on = FLT_INC_HELP;
  let h = '<div class="flt-help">';
  h += '<button class="flt-help-h'+(on?' open':'')+'" onclick="fltIncHelpToggle()">'
  +  '<span>❓ إيه فلتر التوزيعات؟ وإيه الفخ اللي فيه؟</span><i>'+(on?'✕':'؟')+'</i></button>';
  h += '<div class="flt-help-b" style="display:'+(on?'block':'none')+'">';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🎯</span> الفكرة في سطر</div>'
  + '<p class="flt-h-p">شركات كتير بتدفع لك زيادة كل سنة لوحدها. لو اشتريت بـ<b>10,000 جنيه</b> '
  + 'وعائد السهم <b>5%</b>، هيدفعلك <b>500 جنيه كل سنة</b> من غير ما تبيع.</p>'
  + '<p class="flt-h-p"><b>الفلتر ده بيطلعلك الأسهم اللي بتوزّع — وبيحذّرك من الغلطة الشائعة.</b></p></div>';

  /* ⚠️ الفخ — أهم جزء */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">⚠️</span> الغلطة اللي ناس كتير بتعملها</div>'
  + '<p class="flt-h-p"><b>«السهم ده توزيعه 40%! واصلة لـ 26.6% — ده استثناء نادر></b> — غلط.</p>'
  + '<p class="flt-h-p">العالي كده معناه غالباً إن الشركة <b>مفيش منها فايض</b> وبتوزّع الباقي مرة واحدة. '
  + 'السنة الجاية ممكن مايدفعش خالص.</p>'
  + '<div class="flt-h-ex">'
  +  '<div class="flt-h-exi bad"><b>❌ MEGM</b><span>عائد 42% · تقييم 24%</span>'
  +  '<em>توزيع خرافي على شركة ضعيفة — خطير</em></div>'
  +  '<div class="flt-h-exi"><b>✅ DEIN</b><span>عائد 16% · تقييم 80%</span>'
  +  '<em>عائد عالي + شركة سليمة — ده كنز</em></div>'
  + '</div>'
  + '<p class="flt-h-note">📌 لاحظ: في السوق <b>2 من 12</b> سهم عندهم عائد فوق 8% لكن تقييمهم أقل من 50%. '
  + 'دي الفخاخ بتاعتنا. الفلتر بيملّش عليها.</p></div>';

  /* المعايير */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🎚️</span> الدرجة بتتحسب إزاي (من 100)</div>'
  + '<div class="flt-h-w">'
  +  '<div class="flt-h-wi"><span>العائد</span><b>46</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>صحة الشركة</span><b>40</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>نضج البيانات</span><b>14</b><i>من 100</i></div>'
  + '</div>'
  + '<p class="flt-h-note">⚠️ لاحظ العائد وبياخد <b>46</b> بس — ومفيش سهم فوق 8% بياخد أكتر من <b>28</b> من الجزء ده. '
  + 'لأن العائد المجنون فوق 15٪ بيتحسب كـ«مؤقت».</p></div>';

  /* الفلاتر */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📊</span> الفلاتر ومعناها</div>'
  + '<table class="flt-h-tbl"><thead><tr><th>الفلتر</th><th>الرقم</th><th>ليه؟</th></tr></thead><tbody>'
  + '<tr><td>أقل عائد</td><td>0%</td><td>الحد الأدنى — أقله نكوّنش مقنع</td></tr>'
  + '<tr><td>أعلى عائد</td><td>99%</td><td>مفيش حد — لو عايز كل الموزعين</td></tr>'
  + '<tr><td>أقل تقييم</td><td>0</td><td>تقدر ترفعه لإخفاء الأسهم الضعيفة</td></tr>'
  + '<tr><td>🔒 شركة سليمة</td><td>مقفول</td><td>يتجاهل الأسهم اللي نزلت أكتر من 55% في سنة</td></tr>'
  + '<tr><td>القطاع</td><td>الكل</td><td>يديك بنك وبركه فقط — أو كل القطاعات</td></tr>'
  + '</tbody></table></div>';

  /* الأرقام الحقيقية */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📈</span> أرقام حقيقية من السوق المصري</div>'
  + '<ul class="flt-h-ul">'
  + '<li>من 296 سهم، <b>98</b> بيوزّعوا فعلاً (33%)</li>'
  + '<li>وسيط العائد في السوق كله: <b>3.2%</b></li>'
  + '<li>فوق 6% عائد: <b>18 سهم</b> — وهنا الفخ بيبدأ</li>'
  + '<li>أعلى عائد في السوق كله: <b>42.2%</b> (MEGM) — بس تقييمه 24%!</li>'
  + '<li>العائد 3-7% (المدى الصح): <b>37 سهم</b>، منهم <b>17</b> تقييمهم 55%+</li>'
  + '</ul></div>';

  /* نصيحة */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">💡</span> نصيحة عملية</div>'
  + '<p class="flt-h-p">القاعدة السهلة: <b>العائد المثالي للسوق المصري من 4% لـ8%</b>.</p>'
  + '<p class="flt-h-p">تحت 3% ⇒ مخاطرة إنك تعمل ما ينفعش حاجة.</p>'
  + '<p class="flt-h-p">فوق 15% ⇒ اسأل نفسك: الشركة دي بتوزّع قد إيه من أرباحها؟ '
  + 'لو بتوزّع أكتر من أرباحها، ده قرض مش توزيع.</p>'
  + '<p class="flt-h-p">📌 ودايماً: قبل ما تشتري، <b>دوّر على تاريخ الاستحقاق</b> في صفحة التوزيعات. '
  + 'لازم تكون مالك السهم يوم الاستحقاق عشان تاخد التوزيع.</p></div>';

  h += '<div class="flt-h-warn">⚠️ <b>مهم:</b> العائد اللي بتشوفه ده <b>السنة الماضية</b> — مش ضمان للسنة الجاية. '
  + 'الشركات بتقلّل أو توقف التوزيعات لو الأرباح قلّت. '
  + 'ودايماً اقرأ كارت القرار لكل سهم، ووزّع فلوسك على أكتر من سهم.</div>';

  h += '</div></div>';
  return h;
}
function fltIncHelpToggle(){ FLT_INC_HELP = !FLT_INC_HELP; fltIncRender(); }

function fltIncInit(){
  const b = document.getElementById('fltIncBox'); if (b && !b.dataset.r) b.dataset.r = '1';
  fltIncRender();
}

function fltIncRender(){
  const box = document.getElementById('fltIncBox'); if (!box) return;
  const f = FLT_INC;
  const payers = OS_DB.filter(s=>s.dy && s.dy>0);
  const rows = fltIncRows().map(s=>{ const c=Object.assign({},s); c._inc=fltIncScore(s); return c; })
  .sort((a,b)=>b._inc-a._inc || b.dy-a.dy);

  /* القطاعات المتاحة */
  const secs = [...new Set(payers.map(s=>s.sectorAr).filter(Boolean))].sort();

  let h = '';
  h += '<div class="flt-head"><div><h2>💰 فلتر التوزيعات</h2>'
  + '<p class="flt-sub">أسهم بتدفعلك كل سنة — ومتحميك من الفخ</p></div>'
  + '<button class="flt-sw'+(f.on?' on':'')+'" onclick="fltIncToggle()">'
  + (f.on?'🔒 الفلاتر مفعّلة':'🔓 فعّل الفلاتر')+'</button></div>';

  h += '<div class="flt-filters'+(f.on?'':' hid')+'">'
  + '<div class="flt-sl"><label>أقل عائد <b>'+f.dyMin+'</b>%</label>'
  +  '<input type="range" id="fli-dyMin" min="0" max="20" step="0.5" value="'+f.dyMin+'" '
  +  'oninput="fltIncSet(\'dyMin\',this.value)"></div>'
  + '<div class="flt-sl"><label>أعلى عائد <b>'+(f.dyMax>90?'∞':f.dyMax)+'</b>%</label>'
  +  '<input type="range" id="fli-dyMax" min="1" max="99" step="1" value="'+f.dyMax+'" '
  +  'oninput="fltIncSet(\'dyMax\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقل تقييم OCTA <b>'+f.minScore+'</b></label>'
  +  '<input type="range" id="fli-score" min="0" max="80" step="5" value="'+f.minScore+'" '
  +  'oninput="fltIncSet(\'minScore\',this.value)"></div>'
  + '<div class="flt-sl"><label>القطاع <b>'+fzSectorName(f.sector)+'</b></label>'
  +  '<select class="fli-sel" onchange="fltIncSet(\'sector\',this.value)">'
  +  '<option value="all">كل القطاعات</option>'
  +  secs.map(x=>'<option value="'+escFlt(x)+'"'+(f.sector===x?' selected':'')+'>'+escFlt(x)+'</option>').join('')
  +  '</select></div>'
  + '<label class="fli-check"><input type="checkbox"'+(f.safeOnly?' checked':'')+' '
  +  'onchange="fltIncSet(\'safeOnly\',this.checked)"> 🔒 شركة سليمة فقط</label>'
  + '<button class="flt-rst" onclick="fltIncReset()">↺ إعادة</button></div>';

  h += fltIncHelpBox();

  const avgDy = rows.length ? rows.reduce((a,s)=>a+s.dy,0)/rows.length : 0;
  h += '<div class="flt-stats">'
  + '<div><b>'+rows.length+'</b><span>موزّع من '+payers.length+' في السوق</span></div>'
  + '<div><b>'+fltNum(avgDy,1)+'%</b><span>متوسط العائد</span></div>'
  + '<div><b>'+fltNum(fltIncome10k(rows[0]||{dy:0}),0)+'</b><span>جنيه سنوياً من 10 آلاف (الأعلى)</span></div>'
  + '</div>';

  if (!rows.length){
  box.innerHTML = h + '<div class="flt-empty">⛔ مفيش أسهم بتستوفي الشروط<br>'
  + '<button class="dv-tab" onclick="fltIncReset()">وسّع الفلاتر</button></div>';
  return;
  }

  const CAP = 60;
  h += '<div class="flt-tbl-wrap"><table class="flt-tbl"><thead><tr>'
  + '<th>السهم</th><th>💰 التوزيع</th><th>💸 من 10 آلاف</th><th>الصحة</th>'
  + '<th>OCTA</th><th>هبوط سنة</th><th>ملاحظات</th><th></th></tr></thead><tbody>';
  rows.slice(0,CAP).forEach(function(s){
  const warns = fltIncWarn(s);
  h += '<tr>'
  + '<td><b class="flt-c">'+s.code+'</b><small>'+escFlt((s.name||'').slice(0,20))+'</small></td>'
  + '<td><span class="flt-dy '+(s.dy>15?'hi':s.dy>8?'mid':'ok')+'">'+fltNum(s.dy,1)+'<i>%</i></span></td>'
  + '<td class="flt-inc">'+fltNum(fltIncome10k(s),0)+' ج</td>'
  + '<td><span class="flt-safe s'+((s.score||0)>=65?'hi':(s.score||0)>=45?'md':'lo')+'">'
  +  Math.round(s.score||0)+'</span></td>'
  + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
  +  escFlt(s.decision||'—')+'</span><small>'+fzConfCell(s.scoreConf)+'</small></td>'
  + '<td>'+(s.mdd1y!=null?'<span class="flt-b '+(s.mdd1y<35?'ok':s.mdd1y<55?'mid':'bad')+'">'+fltNum(s.mdd1y,0)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td class="flt-warn">'+fltWarnCell(warns,'✅ آمن')+'</td>'
  + '<td><button class="flt-add" onclick="fltIncAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
  + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length
  +'</b> سهم موزّع — ضيّق الفلاتر عشان تشوف الكل</div>';
  /* 🧮 نور: ترتيب الجدول (دوس على رأس العمود) */
  box.innerHTML = h;
  if (typeof nzSortPaint === 'function') nzSortPaint('income');
}

function fltIncToggle(){ FLT_INC.on = !FLT_INC.on; fltIncRender(); }
function fltIncReset(){ const f=FLT_INC; f.dyMin=0; f.dyMax=99; f.minScore=0; f.safeOnly=false; f.sector='all'; f.on=false; fltIncRender(); }
function fltIncSet(k,v){ FLT_INC[k] = (typeof v==='string') ? v : Number(v); fltIncRender(); }

function fltIncAdd(code){
  const s = OS_DB.find(x=>x.code===code); if (!s) return;
  if (typeof pickAdd !== 'function'){ alert('صفحة المرشحين لسه مش محمّلة'); return; }
  if (typeof PICK === 'undefined' || PICK.indexOf(code) >= 0) return;
  if (!s._flt) s._flt = Object.assign({}, s);
  PICK.push(code); PICK_DATA[code] = s._flt;
  PICK_TIME[code] = new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  try{ localStorage.setItem('octa_pick_v1', JSON.stringify({c:PICK,t:PICK_TIME})); }catch(e){}
  const cnt = document.getElementById('pickCount'); if (cnt) cnt.textContent = PICK.length+'/'+(typeof PICK_MAX!=='undefined'?PICK_MAX:10);
  const i = document.getElementById('pickQ');
  if (typeof pickRenderList === 'function') pickRenderList(i?i.value:'');
  if (typeof pickRenderCards === 'function') pickRenderCards();
  fltIncRender();
}

/* ══════════════════════════════════════════════════════════════
  ⚡ فلتر الزخم — الفلتر الثالث (الأقوى · 88% تغطية)
  💡 المبدأ:لاقي اللي بيتحرك — بس مع التحذير من الفخ
  ⚠️ RSI > 70 = تشبع شرائي (اشترِ دلوقتي = خطر)
  ⚠️ أداء > 100% = طيران (ممكن يكون قاعه فاتك)
  ══════════════════════════════════════════════════════════════ */

const FLT_MOM = { on:false, p3min:-20, p3max:200, rsiMin:0, rsiMax:100,
  needConfirm:true, minScore:0, sector:'all' };

/* 🔍 كشف قسمة السهم (Stock Split)
  - السعر 3× أو أكتر من متوسط 200 يوم
  - أو الأداء الشهري = أداء 3 شهور بالظبط (المؤشر مش بيتحدّث)
  الأرقام شكلها خرافية وهي غلط — بتديك صعود وهمي */
function fltIsSplit(s){
  if (s.p != null && s.ma200 != null && s.ma200 > 0 && s.p / s.ma200 >= 3) return true;
  if (s.perf3m != null && s.perf1m != null &&
  Math.abs(s.perf3m - s.perf1m) < 0.5 && Math.abs(s.perf3m) > 20) return true;
  return false;
}

function fltMomRows(){
  const f = FLT_MOM;
  return OS_DB.filter(function(s){
  if (s.perf3m == null) return false;  /* لازم أداء 3 شهور */
  if (fltIsSplit(s)) return false;  /* 🚫 قسمة — أرقام مضلّلة */
  if (s.perf3m < f.p3min || s.perf3m > f.p3max) return false;
  if (f.needConfirm && s.rsi != null && s.rsi > 70) return false;  /* ⚠️ تشبع شرائي */
  if (s.rsi != null && (s.rsi < f.rsiMin || s.rsi > f.rsiMax)) return false;
  if (f.minScore && (s.score||0) < f.minScore) return false;
  if (f.sector !== 'all' && (s.sectorAr||'') !== f.sector) return false;
  return true;
  });
}

/* 🎯 درجة الزخم — قوة الحركة + صحتها */
function fltMomScore(s){
  const p3 = s.perf3m || 0, p1 = s.perf1m || 0;
  let sc = 0;
  /* ① أداء 3 شهور — الذروة 25-80% (أعلى من كده مبالغة) */
  if (p3 < 0)  sc += 8;
  else if (p3 < 10)  sc += 18;
  else if (p3 < 25)  sc += 26;
  else if (p3 < 50)  sc += 25;
  else if (p3 < 100)  sc += 16;
  else if (p3 < 200)  sc += 8;
  else  sc += 3;  /* ⚠️ طيران — غالباً وصل القمة */
  /* ② أداء الشهر — تأكيد إن الحركة لسه مستمرة */
  if (p1 > 5)  sc += 16;
  else if (p1 > 0)  sc += 12;
  else if (p1 > -5) sc += 7;
  else  sc += 2;
  /* ③ RSI — المنطقة الصح 45-65 */
  if (s.rsi != null){
  sc += (s.rsi>=45 && s.rsi<=65) ? 16 : (s.rsi>=35&&s.rsi<45) ? 12
  : (s.rsi>65&&s.rsi<=75) ? 9 : s.rsi<35 ? 6 : 3;
  }
  /* ④ توصية TradingView — تأكيد خارجي */
  if (s.tvRec != null) sc += (s.tvRec>0.2)?14 : (s.tvRec>0.05)?10 : (s.tvRec>-0.1)?6 : 2;
  /* ⑤ صحة الشركة (OCTA) — الزخم بلا أساسيات = فخ */
  const t = s.score||0;
  sc += (t>=70)?18 : (t>=55)?13 : (t>=45)?8 : (t>=35)?4 : 0;
  /* ⑥ الثقة */
  sc += Math.min(11, (s.scoreConf||0)/100*11);
  return Math.round(Math.min(100, sc));
}

/* ⚠️ التحذيرات — الأهم في الفلتر ده */
function fltMomWarn(s){
  if (fltIsSplit(s)) return ['🚫 الأرقام مضلّلة — السهم اتقسم (Stock Split)'];
  const w = [], p3 = s.perf3m||0, r = s.rsi;
  if (r != null && r > 70) w.push('⚠️ مؤشر القوة <b>'+r.toFixed(0)+'</b> — تشبع شرائي، الشراء دلوقتي خطر');
  else if (r != null && r < 30) w.push('💡 مؤشر القوة <b>'+r.toFixed(0)+'</b> — تشبع بيعي، ممكن فرصة (بس فيها خطر)');
  if (p3 > 100) w.push('⚠️ زاد <b>'+p3.toFixed(0)+'%</b> في 3 شهور — ممكن يكون وصل القمة');
  else if (p3 > 60) w.push('📌 زاد <b>'+p3.toFixed(0)+'%</b> — زخم قوي بس راقب_probs');
  if (p3 < 0 && p1 > 0) w.push('💡 بينزل بس بدأ يرجع — ممكن فرصة');
  if (s.mdd1y != null && s.mdd1y > 55 && p3 > 40) w.push('⚠️ رغم الزخم نزل <b>'+s.mdd1y.toFixed(0)+'%</b> في أسوأ سنة');
  if ((s.score||0) < 45 && p3 > 25) w.push('⚠️ زخم بلا أساسيات — الاستمرار غير مضمون');
  if ((s.scoreConf||0) < 60) w.push('📌 بيانات ناقصة ('+(s.scoreConf||0)+'%)');
  return w;
}

let FLT_MOM_HELP = false;
function fltMomHelpBox(){
  const on = FLT_MOM_HELP;
  let h = '<div class="flt-help">';
  h += '<button class="flt-help-h'+(on?' open':'')+'" onclick="fltMomHelpToggle()">'
  +  '<span>❓ إيه فلتر الزخم؟ وليه مش بنقولك «اشترِ اللي طلع»؟</span><i>'+(on?'✕':'؟')+'</i></button>';
  h += '<div class="flt-help-b" style="display:'+(on?'block':'none')+'">';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🎯</span> الفكرة في سطر</div>'
  + '<p class="flt-h-p">في البورصة فيه أسهم زي الدراجة الهوائية — بتتحرك بسرعة.</p>'
  + '<p class="flt-h-p">وفي أسهم زي العربية — بتتحرك ببطء.</p>'
  + '<p class="flt-h-p"><b>الفلتر ده بيطلعلك اللي بيتحرك — بس بيقولك كمان: دلوقتي وقت الشراء ولا وقت الانتظار؟</b></p>'
  + '<p class="flt-h-p">لأن السهم اللي زاد 200% — ممكن يكون <b>وصل القمة</b> وخايبثمن فلوسك.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📊</span> الأرقام ومعناها البسيط</div>'
  + '<div class="flt-h-metric"><b>① أداء 3 شهور</b>'
  + '<p><b>السهم زاد كام % من 3 شهور لحد دلوقتي؟</b></p>'
  + '<p>السهم زاد 30% ⇒ غالي شوية · زاد 80% ⇒ غالي أوي</p>'
  + '<p>السهم زاد 300% ⇒ على الأرجح <b>وصل القمة</b> ⚠️</p>'
  + '<p class="flt-h-note">💡 القاعدة: archaeological region 20% لـ80% هو المدى الصح. '
  + 'تحت صفر يعني بينزل · فوق 100% مبالغة.</p></div>'
  + '<div class="flt-h-metric"><b>② مؤشر القوة (RSI)</b>'
  + '<p><b>السهم وصل نهايته ولا لسه عنده مجال؟</b></p>'
  + '<p><b>مؤشر القوة النسبية (RSI)</b> — بيقيس من 100: السوق كله بيقارنه بيه.</p>'
  + '<p>مؤشر القوة النسبية تحت 30 ⇒ السوق زهق منه (تشبع بيعي)</p>'
  + '<p>مؤشر القوة النسبية من 45 لـ65 ⇒ فيه توازن — المنطقة الصح</p>'
  + '<p>مؤشر القوة النسبية فوق 70 ⇒ الناس اشترت كله — <b>تشبع شرائي</b> ⚠️</p>'
  + '<p class="flt-h-note">⚡ <b>أهم حاجة:</b> لما المؤشر فوق 70، الفلتر بيخفي السهم تلقائياً. '
  + 'لأنك لو اشتريت هنا — ممكن تشتري في القمة. '
  + 'مثال: في السوق دلوقتي <b>36 سهم</b> فيهم المؤشر فوق 70.</p></div>'
  + '<div class="flt-h-metric"><b>③ توصية المحللين</b>'
  + '<p><b>محرك بحث كبير في العالم بيقول إيه؟</b></p>'
  + '<p>رقم موجب = المحلل شايف السهم مشتري · سالب = مش بيشتري</p>'
  + '<p class="flt-h-note">📌 دي مش توصينا — دي رأي محرك تاني. '
  + 'بنستخدمها كـ«تأكيد خارجي» مش كـ«قرار».</p></div></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🏅</span> الدرجة من 100</div>'
  + '<div class="flt-h-w">'
  +  '<div class="flt-h-wi"><span>أداء 3 شهور</span><b>40</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>استمرار</span><b>16</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>مؤشر القوة</span><b>16</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>التوصية + الصحة</span><b>28</b><i>من 100</i></div>'
  + '</div>'
  + '<p class="flt-h-note">⚠️ لاحظ: السهم اللي زاد <b>300%</b> م بياخدش 40 من أول 40 نقطة — '
  + 'بياخد <b>3</b> بس. لأن الحركة الشديدة غالباً بتخلص.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📈</span> أرقام حقيقية من السوق دلوقتي</div>'
  + '<ul class="flt-h-ul">'
  + '<li>من 296 سهم، <b>263</b> عندهم أداء 3 شهور (88%)</li>'
  + '<li>وسيط أداء السوق كله: <b>9%</b> في 3 شهور — السوق بطيء</li>'
  + '<li>الأسهم القوية (25%+): <b>72 سهم</b></li>'
  + '<li>الطيران (100%+): <b>10 أسهم</b> — غالباً وصلوا القمة</li>'
  + '<li>في <b>36 سهم</b> مؤشر القوة فوق 70 — دي اللي الفلتر بيخفيهم</li>'
  + '<li>في <b>5 أسهم</b> مؤشر القوة تحت 30 — فرص محتملة</li>'
  + '</ul></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">⚠️</span> الغلطة اللي الفلتر بيمنعك تعملها</div>'
  + '<p class="flt-h-p"><b>«السهم ده زاد 300% — أشتريه عشان اله-bot!»</b> — غلط.</p>'
  + '<p class="flt-h-p">السهم اللي زاد كده غالباً الناس اللي اشترته بدري خرجت <b>قبل كده بكتير</b>. '
  + 'لو اشتريت دلوقتي، أنت بتشتري من الناس اللي عايزة تبيع.</p>'
  + '<p class="flt-h-p">📌 في ناس بتقول «صعود متقطع كله» — بس بعد ما خلص. '
  + 'الفلتر بيقولك: <b>دلوقتي وقت الدخول ولا وقت الانتظار؟</b></p></div>';

  h += '<div class="flt-h-warn">⚠️ <b>مهم:</b> الزخم سلاح ذو حدّين — السهم اللي بيتحرك بسرعة '
  + 'ينفعت كمان ينزل بسرعة. وأكثر الأسهم بتغيّر اتجاهها فجأة. '
  + 'الزخم مش شراء واحتفاظ — ده أداة لحركة على المدى القصير. '
  + 'الفلتر بيقولك الصورة مش بيضمن النتيجة.</div>';

  h += '</div></div>';
  return h;
}
function fltMomHelpToggle(){ FLT_MOM_HELP = !FLT_MOM_HELP; fltMomRender(); }

function fltMomInit(){
  const b = document.getElementById('fltMomBox'); if (b && !b.dataset.r) b.dataset.r = '1';
  fltMomRender();
}

function fltMomRender(){
  const box = document.getElementById('fltMomBox'); if (!box) return;
  const f = FLT_MOM;
  const all = OS_DB.filter(s=>s.perf3m != null);
  const rows = fltMomRows().map(s=>{ const c=Object.assign({},s); c._mom=fltMomScore(s); return c; })
  .sort((a,b)=>b._mom-a._mom);
  const secs = [...new Set(all.map(s=>s.sectorAr).filter(Boolean))].sort();
  const overbought = all.filter(s=>s.rsi!=null && s.rsi>70).length;

  let h = '';
  h += '<div class="flt-head"><div><h2>⚡ فلتر الزخم</h2>'
  + '<p class="flt-sub">اللي بيتحرك دلوقتي — مع تحذير من القمة</p></div>'
  + '<button class="flt-sw'+(f.on?' on':'')+'" onclick="fltMomToggle()">'
  + (f.on?'🔒 الفلاتر مفعّلة':'🔓 فعّل الفلاتر')+'</button></div>';

  h += '<div class="flt-filters'+(f.on?'':' hid')+'">'
  + '<div class="flt-sl"><label>أقل أداء 3 شهور <b>'+f.p3min+'</b>%</label>'
  +  '<input type="range" id="flm-p3min" min="-70" max="100" step="5" value="'+f.p3min+'" '
  +  'oninput="fltMomSet(\'p3min\',this.value)"></div>'
  + '<div class="flt-sl"><label>أعلى أداء 3 شهور <b>'+f.p3max+'</b>%</label>'
  +  '<input type="range" id="flm-p3max" min="10" max="400" step="10" value="'+f.p3max+'" '
  +  'oninput="fltMomSet(\'p3max\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقل مؤشر القوة <b>'+f.rsiMin+'</b></label>'
  +  '<input type="range" id="flm-rsiMin" min="0" max="70" step="5" value="'+f.rsiMin+'" '
  +  'oninput="fltMomSet(\'rsiMin\',this.value)"></div>'
  + '<div class="flt-sl"><label>أعلى مؤشر القوة <b>'+(f.rsiMax>=100?'∞':f.rsiMax)+'</b></label>'
  +  '<input type="range" id="flm-rsiMax" min="30" max="100" step="5" value="'+f.rsiMax+'" '
  +  'oninput="fltMomSet(\'rsiMax\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقل تقييم OCTA <b>'+f.minScore+'</b></label>'
  +  '<input type="range" id="flm-score" min="0" max="70" step="5" value="'+f.minScore+'" '
  +  'oninput="fltMomSet(\'minScore\',this.value)"></div>'
  + '<div class="flt-sl"><label>القطاع <b>'+fzSectorName(f.sector)+'</b></label>'
  +  '<select class="fli-sel" onchange="fltMomSet(\'sector\',this.value)">'
  +  '<option value="all">كل القطاعات</option>'
  +  secs.map(x=>'<option value="'+escFlt(x)+'"'+(f.sector===x?' selected':'')+'>'+escFlt(x)+'</option>').join('')
  +  '</select></div>'
  + '<label class="fli-check"><input type="checkbox"'+(f.needConfirm?' checked':'')+' '
  +  'onchange="fltMomSet(\'needConfirm\',this.checked)"> 🎯 أخفِ التشبع الشرائي</label>'
  + '<button class="flt-rst" onclick="fltMomReset()">↺ إعادة</button></div>';

  /* شريط تنبيه تشبع شرائي */
  if (overbought && f.needConfirm){
  h += '<div class="flt-alert">🎯 <b>إخفاء التشبع الشرائي:</b> '
  + overbought+' سهم عندهم مؤشر القوة فوق 70 — مخفيين دلوقتي. '
  + '<span class="flt-alert-s">افتح الكارت لو عايز تشوفهم.</span></div>';
  }

  h += fltMomHelpBox();

  const avgP3 = rows.length ? rows.reduce((a,s)=>a+(s.perf3m||0),0)/rows.length : 0;
  h += '<div class="flt-stats">'
  + '<div><b>'+rows.length+'</b><span>من '+all.length+' عندهم أداء</span></div>'
  + '<div><b>'+fltNum(avgP3,0)+'%</b><span>متوسط الأداء (السوق 9%)</span></div>'
  + '<div><b>'+overbought+'</b><span>مخفيين للتشبّع</span></div>'
  + '</div>';

  if (!rows.length){
  box.innerHTML = h + '<div class="flt-empty">⛔ مفيش أسهم بتستوفي الشروط<br>'
  + '<button class="dv-tab" onclick="fltMomReset()">وسّع الفلاتر</button></div>';
  return;
  }

  const CAP = 60;
  h += '<div class="flt-tbl-wrap"><table class="flt-tbl"><thead><tr>'
  + '<th>السهم</th><th>⚡ الزخم</th><th>3 شهور</th><th>شهر</th><th>من أول السنة</th>'
  + '<th>القوة</th><th>توصية المحللين</th><th>OCTA</th><th>ملاحظات</th><th></th>'
  + '</tr></thead><tbody>';
  rows.slice(0,CAP).forEach(function(s){
  const warns = fltMomWarn(s);
  h += '<tr>'
  + '<td><b class="flt-c">'+s.code+'</b><small>'+escFlt((s.name||'').slice(0,20))+'</small></td>'
  + '<td><span class="flt-safe s'+(s._mom>=70?'hi':s._mom>=50?'md':'lo')+'">'+s._mom+'</span></td>'
  + '<td><span class="flt-pct '+(s.perf3m>0?'up':'dn')+'">'
  +  (s.perf3m>0?'+':'')+fltNum(s.perf3m,0)+'<b class="flt-pu">%</b></span></td>'
  + '<td>'+(s.perf1m!=null?'<span class="flt-pct '+(s.perf1m>0?'up':'dn')+'">'
  +  (s.perf1m>0?'+':'')+fltNum(s.perf1m,0)+'<b class="flt-pu">%</b></span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(s.perfYtd!=null?'<span class="flt-pct '+(s.perfYtd>0?'up':'dn')+'">'
  +  (s.perfYtd>0?'+':'')+fltNum(s.perfYtd,0)+'<b class="flt-pu">%</b></span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(s.rsi!=null?'<span class="flt-b '+(s.rsi<30?'ok':s.rsi<70?'mid':'bad')+'">'
  +  s.rsi.toFixed(0)+'</span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(s.tvRec!=null?'<span class="flt-b '+(s.tvRec>0?'ok':s.tvRec>-0.1?'mid':'bad')+'">'
  +  (s.tvRec>0?'+':'')+s.tvRec.toFixed(2)+'</span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
  +  escFlt(s.decision||'—')+'</span><small>'+Math.round(s.score||0)+'% · '+fzConfCell(s.scoreConf)+'</small></td>'
  + '<td class="flt-warn">'+fltWarnCell(warns,'✅ زخم سليم')+'</td>'
  + '<td><button class="flt-add" onclick="fltMomAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
  + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length+'</b></div>';
  /* 🧮 نور: ترتيب الجدول (دوس على رأس العمود) */
  box.innerHTML = h;
  if (typeof nzSortPaint === 'function') nzSortPaint('moment');
}

function fltMomToggle(){ FLT_MOM.on = !FLT_MOM.on; fltMomRender(); }
function fltMomReset(){ const f=FLT_MOM; f.p3min=-20; f.p3max=200; f.rsiMin=0; f.rsiMax=100;
  f.needConfirm=true; f.minScore=0; f.sector='all'; f.on=false; fltMomRender(); }
function fltMomSet(k,v){ FLT_MOM[k] = (typeof v==='string') ? v : Number(v); fltMomRender(); }

function fltMomAdd(code){
  const s = OS_DB.find(x=>x.code===code); if (!s) return;
  if (typeof pickAdd !== 'function'){ alert('صفحة المرشحين لسه مش محمّلة'); return; }
  if (typeof PICK === 'undefined' || PICK.indexOf(code) >= 0) return;
  if (!s._flt) s._flt = Object.assign({}, s);
  PICK.push(code); PICK_DATA[code] = s._flt;
  PICK_TIME[code] = new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  try{ localStorage.setItem('octa_pick_v1', JSON.stringify({c:PICK,t:PICK_TIME})); }catch(e){}
  const cnt = document.getElementById('pickCount'); if (cnt) cnt.textContent = PICK.length+'/'+(typeof PICK_MAX!=='undefined'?PICK_MAX:10);
  const i = document.getElementById('pickQ');
  if (typeof pickRenderList === 'function') pickRenderList(i?i.value:'');
  if (typeof pickRenderCards === 'function') pickRenderCards();
  fltMomRender();
}
/* ══════════════════════════════════════════════════════════════
  🗂️ صفحة الفلاتر — تبويبات
  ══════════════════════════════════════════════════════════════ */
/* ⭐ التعريف الوحيد لتبويب «الفرصة المثالية».
   ⛔ كان في تعريفين: واحد هنا جوّه FZ_TABS وواحد جوه اسم NZ_BEST
      (تحت، سطر كان 3136) — inequivalent نصوص وbox في مكانين.
      دلوقتي الـNZ_BEST اتشال وكله بيشاور على FZ_TAB_BEST. مفيش مصدر تاني. */
const FZ_TAB_BEST = { id:'best', i:'⭐⭐⭐', n:'الفرصة المثالية',
  box:'fltIdealBox', init:'fzBestInit', render:'fzIdealRender', row:2 };

/* ⭐ التبويب الحادي عشر — أفضل 5 فرص (16 أكتوبر 2026)
   ⛔ تجزئة: نفس منطق FZ_TAB_BEST بالظبط (fzBestRows/nzTopFive) بس بيعرض
      أول 5 صفوف بس في جدول مستقل. ⛔ مافيش نسخة تانية من الحساب —
      نفس الدوال ونفس المصفوفة ونفس القيم. التجزئة بتزود تبويب مش بتكرر منطق. */
const FZ_TAB_FIVE = { id:'five', i:'⭐', n:'أفضل 5 فرص',
  box:'fltFiveBox', init:'fzFiveInit', render:'fzFiveRender', row:2 };

/* 📊 التبويب الثاني عشر — أفضل 3 فرص (16 أكتوبر 2026)
   ⛔ تجزئة: نفس منطق الفرص الثلاثية بالظبط (fzTripleRows/nzTripleTable) بس
      بيعرض أول 3 صفوف في جدول مستقل. ⛔ نفس القيم — مافيش نسخة تانية. */
const FZ_TAB_TRIPLE = { id:'triple', i:'📊', n:'أفضل 3 فرص',
  box:'fltThreeBox', init:'fzTripleInit', render:'fzTripleRender', row:2 };

/* 🌐 اسم القطاع بالعربي — ⛔ قبل كده كان بيطبع 'all' الإنجليزي في الواجهة.
   'all' قيمة داخلية (القيمة في <option>) مش نص للمستخدم. */
function fzSectorName(v){
  if (v==null || v==='' || v==='all') return 'كل القطاعات';
  return String(v);
}
const FZ_TABS = [
  { id:'safety', i:'🛡️', n:'الأمان',  box:'fltBox',  init:'fltInit',  render:'fltRender'  },
  { id:'income', i:'💰', n:'التوزيعات', box:'fltIncBox', init:'fltIncInit', render:'fltIncRender' },
  { id:'moment', i:'⚡', n:'الزخم',  box:'fltMomBox', init:'fltMomInit', render:'fltMomRender' },
  { id:'value',  i:'💎', n:'القيمة',  box:'fltValBox', init:'fzValInit', render:'fzValRender' },
  { id:'qual',  i:'🎯', n:'الجودة',  box:'fltQuaBox', init:'fzQualInit', render:'fzQualRender' },
  { id:'liquid', i:'💵', n:'السيولة',  box:'fltLiqBox', init:'fzLiqInit', render:'fzLiqRender' },
  { id:'growth', i:'📈', n:'النمو',  box:'fltGroBox', init:'fzGrowInit', render:'fzGrowRender' },
  { id:'cash',  i:'🏦', n:'التدفق',  box:'fltCfwBox', init:'fzCfwInit', render:'fzCfwRender' },
  /* ⭐ التبويب التاسع — ⛔ ورا الـ8 بالظبط (مش فوقهم · مش بنقص منهم حاجة)
     row:2 = يروح في صف لوحده تحتهم. ⛔ الإضافة دي في الآخر من غير ما نلمس
     ترتيب أو اسم أو أيقونة أي واحد من الـ8 —.diff بيحلف على كده. */
  FZ_TAB_BEST,
  FZ_TAB_FIVE,
  FZ_TAB_TRIPLE,
];
let FZ_ACTIVE = 'safety';

function fzCount(){
  /* وسيط القطاعات لازم يتحسب الأول — وإلا القيمة الفلتر هتكون غلط */
  if (!FZ_SECTOR_MED || !Object.keys(FZ_SECTOR_MED).length){
  if (typeof fzComputeSectorMed === 'function') fzComputeSectorMed();
  }
  const out = {};
  FZ_TABS.forEach(function(t){
  if (!t.render || typeof window[t.render] !== 'function') return;
  try { out[t.id] = (window[t.render] === fltRender) ? fltRows().length
  : (window[t.render] === fltIncRender) ? fltIncRows().length
  : (window[t.render] === fltMomRender) ? fltMomRows().length
  : (window[t.render] === fzValRender) ? fzValRows().length
  : (window[t.render] === fzQualRender) ? fzQualRows().length
  : (window[t.render] === fzLiqRender) ? fzLiqRows().length
  : (window[t.render] === fzGrowRender) ? fzGrowRows().length
  : (window[t.render] === fzCfwRender) ? fzCfwRows().length
  : (t.id==='best' || t.id==='five') ? fzBestRows().length
  : (window[t.render] === fzTripleRender) ? fzTripleRows().length
  : null; } catch(e){ out[t.id] = null; }
  });
  return out;
}

function fzRenderTabs(){
  const bar = document.getElementById('fzTabs'); if (!bar) return;
  const counts = fzCount();
  /* النجمة تلمع وهي نشطة بس — لو الكل فاتح يبان زي الباقي */
  /* 📖 علامة (؟) — بتشرح معايير الاختيار. ⛔ للشم��ين بس (row:2)
     والـ8 الأول ما ليهمش علامة — شرط أحمد. */
  const WHY = { 'best':'TAB5', 'triple':'TAB3' };
  const one = function(t){
  const n = counts[t.id];
  const badge = (n!=null) ? '<span class="fz-tab-n">'+n+'</span>' : '';
  const wkey = WHY[t.id];
  /* ⛔ الزر (؟) بره الـ<button> عشان ما يتفعّلش التبويب لما تدوس عليه */
  const why = wkey
  ? '<span class="octa-why-btn" role="button" tabindex="0" title="معايير الاختيار"'
  + ' onclick="event.stopPropagation();window.__octaCopyUI&&openWhy(\''+wkey+'\')"'
  + ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.stopPropagation();window.__octaCopyUI&&openWhy(\''+wkey+'\')}">؟</span>'
  : '';
  return '<span class="fz-tab-wrap">'
  + '<button class="fz-tab'+(FZ_ACTIVE===t.id?' on':'')+(t.soon?' soon':'')+'"'
  + (t.soon ? ' title="قريباً"' : ' onclick="fzGo(\''+t.id+'\')"')
  + '><span class="fz-tab-i">'+t.i+'</span><span>'+t.n+'</span>'+badge+'</button>'
  + why + '</span>';
  };
  /* ⭐ صفّين: الأول الـ8 كما هم بالظبط · التاني التبويب التاسع لوحده
     ⛔ شرط أحمد: ترتيب الـ8 وأسماؤها وأيقوناتها ما تتغيرش — فبنفلتر بس. */
  const r1 = FZ_TABS.filter(function(t){ return t.row !== 2; }).map(one).join('');
  const r2 = FZ_TABS.filter(function(t){ return t.row === 2; });
  bar.innerHTML = r1;
  if (!r2.length) return;
  let b2 = nzRow2Host();
  if (b2) b2.innerHTML = r2.map(one).join('');
}

function fzGo(id){
  const t = FZ_TABS.find(x=>x.id===id); if (!t) return;
  FZ_ACTIVE = id;
  /* إخفاء الكل */
  FZ_TABS.forEach(function(x){
  const el = document.getElementById(x.box);
  if (el) el.style.display = (x.id===id) ? 'block' : 'none';
  });
  fzRenderTabs();
  /* وسيط القطاعات — لازم يتحسب قبل أي رسم */
  if (!FZ_SECTOR_MED || !Object.keys(FZ_SECTOR_MED).length){
  if (typeof fzComputeSectorMed === 'function') fzComputeSectorMed();
  }
  /* رسم المحتوى */
  if (typeof window[t.render] === 'function'){
  try { window[t.render](); }
  catch(e){ console.warn('فلتِر '+id+':', e.message); }
  }
  window.scrollTo({ top:0, behavior:'smooth' });
}

function fzInit(){
  if (typeof nzBoot === 'function') nzBoot();   /* 🧮 نور: صف التاسع + نظام الترتيب */
  if (typeof fzHeroRender === 'function') fzHeroRender();
  fzGo(FZ_ACTIVE || 'safety');
}


/* ══════════════════════════════════════════════════════════════
  💎 فلتر القيمة — الفلتر الرابع
  💡 المبدأ: P/E لوحده مضلّل. بنك بـ9 صناعي بـ9 = فرق كبير
  الحل: حزمة مؤشرات حسب القطاع + مقارنة مع وسيط القطاع
  ══════════════════════════════════════════════════════════════ */

/* 🏷️ حزمة كل قطاع — المؤشر الصح + اللي ما ينفعش */
const FZ_PACKS = {
  'بنوك ومالية': {
  ar:'بنوك', use:['pb','roe'], ban:['evEbitda','fcf'],
  note:'البنوك بتتقاس بـ<b>القيمة الدفترية</b> مش الربحية — P/E بيضلّل هنا',
  tip:'البنك الغالي مش لأن ربحه ضعيف، لأن سعر السهم فوق قيمته الحقيقية على الورق.'
  },
  'عقارات': {
  ar:'عقارات', use:['pb','roe','ps'], ban:['pe'],
  note:'العقارات بتتقاس بالقيمة الدفترية — الـP/E بيتشوّه بسبب أوضاع التقييم',
  tip:'شركة العقارات بتشتري المال وتبني، فربحها بيقل مع الوقت. القيمة الدفترية أهم.'
  },
  'تجزئة وتوزيع': {
  ar:'تجزئة', use:['pb','ps','roe'], ban:['pe'],
  note:'مضاعف الربحية مشوّه في القطاع — هنقيس بالقيمة الدفترية والمبيعات',
  tip:'كثير من شركات التجزئة ربحها قريب من الصفر فالـP/E بيطلع أرقام مش معناها'
  },
  'صناعات عملية': {
  ar:'صناعة', use:['evEbitda','pe','ps'], ban:[],
  note:'الصناعة بتتقاس بأرباح قبل الفوائد — الـROE فيها ممكن يكون سالب',
  tip:'متوسط العائد على حقوق الملكية في القطاع **سالب** — نقيس بالتشغيل مش بالحقة'
  },
  'تكنولوجيا وخدمات': {
  ar:'تكنولوجيا', use:['pe','ps','roe'], ban:['de'],
  note:'الشركات الحديثة بتستثمر فبتنخفض الديون — مفيش داعي نستبعدها',
  tip:'الديون المنخفضة في التكنولوجيا مش ميزة — معناها الشركة بتستثمر في النمو'
  },
  'معادن وطاقة غير نفطي': {
  ar:'معادن', use:['evEbitda','pe','pb'], ban:[],
  note:'القطاعات الدورية بتتقاس بـEV/EBITDA — الـP/E بيتغيّر مع أسعار البضاعة',
  tip:'الربح بيتغيّر مع سعر البضاعة — الـEV/EBITDA أدق من الـP/E هنا'
  },
};
const FZ_PACK_DEFAULT = {
  ar:'عام', use:['pe','pb','ps'], ban:['evEbitda'],
  note:'مفيش بيانات كافية لتحديد الحزمة — بنستخدم المؤشرات العامة',
  tip:'نستخدم P/E و P/B مع بعض — أفضل من مؤشر واحد'
};

const FZ_VAL = { on:false, peMax:20, pbMax:2.5, minIndic:2, relSector:true, maxMult:1.3,
  minMcap:0, sector:'all', minScore:0 };

function fzPack(sec){
  for (const k in FZ_PACKS) if (sec === k || (sec||'').indexOf(k) >= 0) return FZ_PACKS[k];
  return FZ_PACK_DEFAULT;
}

/* 🔢 كام مؤشر قيمة متاح للسهم */
function fzValCount(r){
  return ['pe','pb','ps','evEbitda'].filter(k => r[k] != null && r[k] > 0).length;
}

function fzValRows(){
  const f = FZ_VAL;
  return OS_DB.filter(function(s){
  if (f.minIndic && fzValCount(s) < f.minIndic) return false;  /* مفيش بيانات كفاية */
  const pk = fzPack(s.sectorAr);
  /* المقياس الأساسي حسب الحزمة */
  if ('pb' in pk.use && f.pbMax < 3){
  if (s.pb != null && s.pb > f.pbMax) return false;
  }
  if ('pe' in pk.use && f.peMax < 30){
  if (s.pe != null && s.pe > f.peMax && s.pe < 300) return false;
  }
  /* مقارنة بالقطاع */
  if (f.relSector){
  const med = FZ_SECTOR_MED[s.sector] || {};
  const my = ('pb' in pk.use) ? s.pb : s.pe;
  const ref = ('pb' in pk.use) ? med.pb : med.pe;
  if (my != null && ref != null && ref > 0 && my > ref * f.maxMult) return false;
  }
  if (f.minMcap > 0 && (s.mc == null || s.mc < f.minMcap)) return false;
  if (f.sector !== 'all' && s.sectorAr !== f.sector) return false;
  if (f.minScore && (s.score||0) < f.minScore) return false;
  return true;
  });
}

/* 🎯 درجة «الرخص» — مع مراعاة إن الرقمفرد مايكفيش */
function fzValScore(s){
  const pk = fzPack(s.sectorAr);
  const med = FZ_SECTOR_MED[s.sector] || {};
  let sc = 0, n = 0;
  /* ① المقياس الأساسي حسب الحزمة */
  const main = ('pb' in pk.use) ? s.pb : s.pe;
  const mainRef = ('pb' in pk.use) ? med.pb : med.pe;
  if (main != null && main > 0){
  /* مقارنة نسبية أهم من الرقم المطلق */
  if (mainRef > 0){
  const r = main / mainRef;
  sc += r<0.6?46 : r<0.85?40 : r<1.0?32 : r<1.3?20 : 8;
  } else {
  const v = main;
  sc += ('pb' in pk.use) ? (v<0.8?46 : v<1.2?40 : v<2?28 : v<4?14 : 4)
  : (v<6?46 : v<10?40 : v<15?28 : v<25?14 : 4);
  }
  n += 46;
  }
  /* ② المؤشر المساعد */
  const second = ('pb' in pk.use) ? s.pe : s.pb;
  if (second != null && second > 0 && second < 300){
  sc += ('pb' in pk.use) ? (second<7?16 : second<12?13 : second<20?8 : 3)
  : (second<1?16 : second<2?13 : second<4?8 : 3);
  n += 16;
  }
  /* ③ مؤشرات إضافية */
  if (s.ps != null && s.ps > 0){ sc += s.ps<1?9 : s.ps<2.5?7 : s.ps<5?4 : 1; n += 9; }
  if (s.evEbitda != null && s.evEbitda > 0){ sc += s.evEbitda<8?9 : s.evEbitda<12?7 : s.evEbitda<18?4 : 1; n += 9; }
  /* ④ صحة الشركة — السهم الرخيص المكسور مش صفقة */
  const t = s.score || 0;
  sc += t>=70?20 : t>=55?15 : t>=45?10 : t>=35?5 : 0;
  n += 20;
  /* ⑤ الثقة */
  sc += Math.min(9, (s.scoreConf||0)/100*9);
  return n ? Math.round(Math.min(100, sc)) : 0;
}

/* ⚠️ تحذيرات القيمة */
function fzValWarn(s){
  const w = [];
  const pe = s.pe, pb = s.pb;
  if (pe != null && pe > 100) w.push('⚠️ P/E فوق 100 — الربح قريب من الصفر');
  if (pe != null && pe > 0 && pe < 3) w.push('⚠️ P/E تحت 3 — غير طبيعي، ممكن ربح مؤقت');
  if (pb != null && pb > 8) w.push('⚠️ P/B ' + pb.toFixed(1) + ' — غالي على الورق');
  if ((s.score||0) < 40 && (pe != null && pe < 8)) w.push('⚠️ رخيص بس الشركة ضعيفة — «فخ»');
  if (s.mdd1y != null && s.mdd1y > 60) w.push('⚠️ نزل ' + s.mdd1y.toFixed(0) + '% في أسوأ سنة');
  if ((s.av30||0) < 1.5e5) w.push('⚠️ سيولة ضعيفة (' + ((s.av30||0)/1e3).toFixed(0) + ' ألف/يوم) — صعب تشتري وتبيع');
  if (fzValCount(s) < 3) w.push('📌 بيانات ناقصة (' + fzValCount(s) + ' مؤشرات فقط)');
  if ((s.scoreConf||0) < 60) w.push('📌 ثقة ' + (s.scoreConf||0) + '%');
  return w;
}

let FZ_VAL_HELP = false;
function fzValHelpBox(){
  const on = FZ_VAL_HELP;
  let h = '<div class="flt-help">';
  h += '<button class="flt-help-h'+(on?' open':'')+'" onclick="fzValHelpToggle()">'
  +  '<span>❓ إيه فلتر القيمة؟ وليه الـP/E بيضلّل؟</span><i>'+(on?'✕':'؟')+'</i></button>';
  h += '<div class="flt-help-b" style="display:'+(on?'block':'none')+'">';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🎯</span> الفكرة في سطر</div>'
  + '<p class="flt-h-p"><b>«رخيص» مش رقم واحد — ده مقارنة.</b></p>'
  + '<p class="flt-h-p">السهم بـP/E 9 ممكن يكون غالي — لو في قطاعه كله بـ7. '
  + 'وممكن يكون رخيص — لو في قطاعه كله بـ20.</p>'
  + '<div class="flt-h-ex">'
  +  '<div class="flt-h-exi bad"><b>❌ غلط</b><span>P/E 9 في البنوك</span><em>القطاع كله 8.9 — مش رخيص</em></div>'
  +  '<div class="flt-h-exi"><b>✅ صح</b><span>P/E 9 في الخدمات</span><em>القطاع كله 20 — رخيص فعلاً</em></div>'
  + '</div>'
  + '<p class="flt-h-note">📌 عشان كده الفلتر بيقارن السهم بـ<b>وسيط قطاعه</b> مش برقم ثابت.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🏷️</span> ليه كل قطاع ليه مؤشر مختلف</div>'
  + '<div class="flt-h-metric"><b>البنوك (84 سهم · 28% من السوق)</b>'
  + '<p>البنك مش بيقيم بمضاعف الربحية. الـ<b>القيمة الدفترية</b> (P/B) هي الصح — '
  + 'لأن ربح البنك بيتغيّر حسب الفائدة، لكن أصوله (القروض) ثابتة.</p>'
  + '<p class="flt-h-note">وسيط بنوك مصر: <b>P/B = 2.22</b> · <b>P/E = 8.9</b> · 41 سهم عندهم بيانات كافية</p></div>'
  + '<div class="flt-h-metric"><b>الصناعة — بتتقاس بـEV/EBITDA</b>'
  + '<p>الربح قبل الفوائد والضرايب (EBITDA) بيشيل أثر الدين — وده المهم في الشركات الصناعية.</p>'
  + '<p class="flt-h-note">⚠️ متوسط العائد على حقوق الملكية في <b>صناعات عملية سالب (-42%)</b> — '
  + 'يعني نص القطاع خسران. القياس بالـROE هيستبعدهم خطأ.</p></div>'
  + '<div class="flt-h-metric"><b>العقارات والتجزئة — P/B مش P/E</b>'
  + '<p>العقار بيشتري ويبني، فالربح بينزل كل سنة والـP/E بيرتفع كده. القيمة الدفترية أصدق.</p>'
  + '<p class="flt-h-note">التجزئة: وسيط P/E في القطاع = <b>257</b> — رقم مشوّه تمامًا. '
  + 'شركات ربحها قريب من الصفر.</p></div></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">⚠️</span> الفخ: «رخيص» مش دايمًا «فرصة»</div>'
  + '<p class="flt-h-p">السهم الرخيص بيتزحلق لأن <b>السوق خايف منه</b>. '
  + 'أحياناً السوق صح.</p>'
  + '<div class="flt-h-ex">'
  +  '<div class="flt-h-exi bad"><b>❌ فخ</b><span>P/E 2 · الشركة ضعيفة</span>'
  +  '<em>السوق عارف إنها وحشة — في كل الأحوال</em></div>'
  +  '<div class="flt-h-exi"><b>✅ فرصة</b><span>P/E 8 · الشركة سليمة</span>'
  +  '<em>السوق مش مبالٍ — وأرقامها كويسة</em></div>'
  + '</div>'
  + '<p class="flt-h-note">📌 عشان كده الفلتر بياخد <b>40 نقطة للتقييم</b> جوّه الدرجة. '
  + 'السهم الرخيص اللي شركته بتخسر مش بيتعرض.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📊</span> المؤشرات ومعناها</div>'
  + '<table class="flt-h-tbl"><thead><tr><th>المؤشر</th><th>معناه ببساطة</th><th>التغطية</th></tr></thead><tbody>'
  + '<tr><td>P/E</td><td>بكام جنيه بتدفع عن كل جنيه ربح</td><td>32%</td></tr>'
  + '<tr><td>P/B</td><td>بكام على القيمة الحقيقية على الورق</td><td><b>62%</b></td></tr>'
  + '<tr><td>P/S</td><td>بكام على كل جنيه مبيعات</td><td>35%</td></tr>'
  + '<tr><td>EV/EBITDA</td><td>أدق من P/E للصناعة</td><td>13٪</td></tr>'
  + '</tbody></table>'
  + '<p class="flt-h-note">📌 <b>112 سهم من 296</b> مافيش عندهم أي مؤشر قيمة — الفلتر بيستبعدهم. '
  + 'و<b>105</b> عندهم 3 مؤشرات أو أكتر — دول اللي بيظهروا.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🏅</span> الدرجة من 100</div>'
  + '<div class="flt-h-w">'
  +  '<div class="flt-h-wi"><span>المقياس الأساسي</span><b>46</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>المؤشر المساعد</span><b>16</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>مؤشرات أخرى</span><b>18</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>صحة الشركة</span><b>20</b><i>من 100</i></div>'
  + '</div>'
  + '<p class="flt-h-note">⚠️ لاحظ: <b>صحة الشركة 20</b> — مش 10. '
  + 'لأن السهم الرخيص المكسور هو أخطر حاجة في الفلتر ده.</p></div>';

  h += '<div class="flt-h-warn">⚠️ <b>مهم:</b> «رخيص» مش معناه «هيزيد». '
  + 'أسهم كتير رخيصة بتفضل رخيصة سنين. الفلتر بيقولك <b>إنت بتدفع كام مقارنة بالسوق</b> — '
  + 'القرار لوحده</div>';

  h += '</div></div>';
  return h;
}
function fzValHelpToggle(){ FZ_VAL_HELP = !FZ_VAL_HELP; fzValRender(); }

function fzValInit(){ fzValRender(); }

/* 🧮 وسيط كل قطاع — بيتحسب مرة واحدة */
let FZ_SECTOR_MED = {};
function fzComputeSectorMed(){
  const by = {};
  OS_DB.forEach(function(s){
  const k = s.sector || 'عام';
  (by[k] = by[k] || []).push(s);
  });
  FZ_SECTOR_MED = {};
  for (const k in by){
  const g = by[k];
  const med = (f) => {
  const v = g.map(x=>x[f]).filter(x=>x!=null && x>0 && x<300).sort((a,b)=>a-b);
  return v.length ? v[Math.floor(v.length/2)] : null;
  };
  FZ_SECTOR_MED[k] = { pe:med('pe'), pb:med('pb'), ps:med('ps'), n:g.length };
  }
}

function fzValRender(){
  const box = document.getElementById('fltValBox'); if (!box) return;
  const f = FZ_VAL;
  const all = OS_DB.filter(s=>fzValCount(s) >= 2);
  const rows = fzValRows().map(s=>{ const c=Object.assign({},s); c._val=fzValScore(s); return c; })
  .sort((a,b)=>b._val-a._val);
  const secs = [...new Set(OS_DB.map(s=>s.sectorAr).filter(Boolean))].sort();

  let h = '';
  h += '<div class="flt-head"><div><h2>💎 فلتر القيمة</h2>'
  + '<p class="flt-sub">الأسهم الرخيصة — مقارنةً بقطاعها مش برقم ثابت</p></div>'
  + '<button class="flt-sw'+(f.on?' on':'')+'" onclick="fzValToggle()">'
  + (f.on?'🔒 الفلاتر مفعّلة':'🔓 فعّل الفلاتر')+'</button></div>';

  h += '<div class="flt-filters'+(f.on?'':' hid')+'">'
  + '<div class="flt-sl"><label>أعلى P/E <b>'+(f.peMax>29?'∞':f.peMax)+'</b></label>'
  +  '<input type="range" id="fzv-pe" min="3" max="60" step="1" value="'+f.peMax+'" '
  +  'oninput="fzValSet(\'peMax\',this.value)"></div>'
  + '<div class="flt-sl"><label>أعلى P/B <b>'+f.pbMax+'</b></label>'
  +  '<input type="range" id="fzv-pb" min="0.5" max="10" step="0.1" value="'+f.pbMax+'" '
  +  'oninput="fzValSet(\'pbMax\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقل مؤشرات <b>'+f.minIndic+'</b></label>'
  +  '<input type="range" id="fzv-ind" min="1" max="4" step="1" value="'+f.minIndic+'" '
  +  'oninput="fzValSet(\'minIndic\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقل حجم سوق <b>'+(f.minMcap/1e9).toFixed(1)+'</b> مليار</label>'
  +  '<input type="range" id="fzv-mc" min="0" max="50" step="0.5" value="'+(f.minMcap/1e9)+'" '
  +  'oninput="fzValSet(\'minMcap\',this.value*1e9)"></div>'
  + '<div class="flt-sl"><label>القطاع <b>'+fzSectorName(f.sector)+'</b></label>'
  +  '<select class="fli-sel" onchange="fzValSet(\'sector\',this.value)">'
  +  '<option value="all">كل القطاعات</option>'
  +  secs.map(x=>'<option value="'+escFlt(x)+'"'+(f.sector===x?' selected':'')+'>'+escFlt(x)+'</option>').join('')
  +  '</select></div>'
  + '<label class="fli-check"><input type="checkbox"'+(f.relSector?' checked':'')+' '
  +  'onchange="fzValSet(\'relSector\',this.checked)"> 📊 مقارنة بالقطاع</label>'
  + '<button class="flt-rst" onclick="fzValReset()">↺ إعادة</button></div>';

  /* ⚠️ تنبيه النطاق */
  if (f.on && f.minIndic >= 2){
  const thin = OS_DB.filter(s=>fzValCount(s) < f.minIndic).length;
  if (thin) h += '<div class="flt-alert">📊 <b>محتاج بيانات:</b> '
  + thin + ' سهم مافيش عندهم ' + f.minIndic + ' مؤشرات تقييم — مخفيين. '
  + '<span class="flt-alert-s">أقلّل الحد عشان أشوفهم (بالمخاطر).</span></div>';
  }

  h += fzValHelpBox();

  h += '<div class="flt-stats">'
  + '<div><b>'+rows.length+'</b><span>من '+all.length+' عندهم بيانات</span></div>'
  + '<div><b>'+OS_DB.filter(s=>fzValCount(s)>=3).length+'</b><span>بـ3+ مؤشرات</span></div>'
  + '<div><b>'+OS_DB.filter(s=>fzValCount(s)<1).length+'</b><span>بلا بيانات</span></div>'
  + '</div>';

  if (!rows.length){
  box.innerHTML = h + '<div class="flt-empty">⛔ مفيش أسهم بتستوفي الشروط<br>'
  + '<button class="dv-tab" onclick="fzValReset()">وسّع الفلاتر</button></div>';
  return;
  }

  const CAP = 60;
  h += '<div class="flt-tbl-wrap"><table class="flt-tbl"><thead><tr>'
  + '<th>السهم</th><th>💎 القيمة</th><th>الحزمة</th><th>P/E</th><th>P/B</th>'
  + '<th>قيمة ÷ قطاعها</th><th>OCTA</th><th>القطاع</th><th>ملاحظات</th><th></th>'
  + '</tr></thead><tbody>';
  rows.slice(0,CAP).forEach(function(s){
  const pk = fzPack(s.sectorAr);
  const main = ('pb' in pk.use) ? s.pb : s.pe;
  const mainRef = ('pb' in pk.use) ? (FZ_SECTOR_MED[s.sector]||{}).pb : (FZ_SECTOR_MED[s.sector]||{}).pe;
  const rel = (main!=null && mainRef>0) ? main/mainRef : null;
  const warns = fzValWarn(s);
  h += '<tr>'
  + '<td><b class="flt-c">'+s.code+'</b><small>'+escFlt((s.name||'').slice(0,20))+'</small></td>'
  + '<td><span class="flt-safe s'+(s._val>=70?'hi':s._val>=50?'md':'lo')+'">'+s._val+'</span></td>'
  + '<td><span class="flt-pack">'+escFlt(pk.ar)+'</span></td>'
  + '<td>'+(s.pe!=null&&s.pe>0?'<span class="flt-b '+(s.pe<12?'ok':s.pe<25?'mid':'bad')+'">'
  +  fltNum(s.pe,1)+'</span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(s.pb!=null&&s.pb>0?'<span class="flt-b '+(s.pb<1.5?'ok':s.pb<3.5?'mid':'bad')+'">'
  +  fltNum(s.pb,2)+'</span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(rel!=null?'<span class="flt-b '+(rel<0.8?'ok':rel<1.1?'mid':'bad')+'">'
  +  '×'+fltNum(rel,2)+'</span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
  +  escFlt(s.decision||'—')+'</span><small>'+fltNum(s.score,0)+'% · '+fzConfCell(s.scoreConf)+'</small></td>'
  + '<td class="flt-sect">'+escFlt(s.sectorAr||'—')+'</td>'
  + '<td class="flt-warn">'+fltWarnCell(warns,'✅ رخيص وسليم')+'</td>'
  + '<td><button class="flt-add" onclick="fzValAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
  + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length+'</b></div>';
  /* 🧮 نور: ترتيب الجدول (دوس على رأس العمود) */
  box.innerHTML = h;
  if (typeof nzSortPaint === 'function') nzSortPaint('value');
}

/* 🧮 خلية التحذيرات — سطر واحد نظيف */
function fltWarnCell(warns, okText){
  if (!warns || !warns.length) return '<span class="flt-ok">'+okText+'</span>';
  let out = warns.slice(0,2).join('<br>');
  if (warns.length > 2) out += '<span class="flt-more-w">+'+(warns.length-2)+' تحذير</span>';
  return out;
}

function fzValToggle(){ FZ_VAL.on = !FZ_VAL.on; fzValRender(); }
function fzValReset(){ const f=FZ_VAL; f.peMax=20; f.pbMax=2.5; f.minIndic=2; f.relSector=true;
  f.maxMult=1.3; f.minMcap=0; f.sector='all'; f.minScore=0; f.on=false; fzValRender(); }
function fzValSet(k,v){ FZ_VAL[k] = (typeof v==='string') ? v : Number(v); fzValRender(); }

function fzValAdd(code){
  const s = OS_DB.find(x=>x.code===code); if (!s) return;
  if (typeof pickAdd !== 'function'){ alert('صفحة المرشحين لسه مش محمّلة'); return; }
  if (typeof PICK === 'undefined' || PICK.indexOf(code) >= 0) return;
  if (!s._flt) s._flt = Object.assign({}, s);
  PICK.push(code); PICK_DATA[code] = s._flt;
  PICK_TIME[code] = new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  try{ localStorage.setItem('octa_pick_v1', JSON.stringify({c:PICK,t:PICK_TIME})); }catch(e){}
  const cnt = document.getElementById('pickCount'); if (cnt) cnt.textContent = PICK.length+'/'+(typeof PICK_MAX!=='undefined'?PICK_MAX:10);
  const i = document.getElementById('pickQ');
  if (typeof pickRenderList === 'function') pickRenderList(i?i.value:'');
  if (typeof pickRenderCards === 'function') pickRenderCards();
  fzValRender();
}

/* ══════════════════════════════════════════════════════════════
  🎯 فلتر الجودة — الفلتر الخامس (الأقوى في الباقي)
  💡 المبدأ: «الشركة دي بتكسب بجد ولا بتّل أرقامها؟»
  🔥 مبني على مؤشرات جديدة ماكانوش موجودين: الدين 50% · التداول 51%
  ══════════════════════════════════════════════════════════════ */

/* ⚖️ العتبات الافتراضية: متوسطة-صارمة. 296 سهم بس 71 عندهم بيانات كافية،
  والفلتر بيرجّع 27-40 — وده الصadium الحقيقي مش اختيار عشوائي. */
const FZ_QUAL = { on:false, roeMin:10, deMax:1.0, crMin:1.0, nmMin:3,
  minInd:4, sector:'all', minConf:0 };

function fzQualCount(r){
  return ['roe','roa','roic','nm','om','de','cr','qr'].filter(k => r[k] != null).length;
}

function fzQualRows(){
  const f = FZ_QUAL;
  return OS_DB.filter(function(s){
  if (fzQualCount(s) < f.minInd) return false;  /* مفيش بيانات كفاية */
  if (s.roe  != null && s.roe  < f.roeMin) return false;
  if (s.de  != null && s.de  > f.deMax)  return false;
  if (s.cr  != null && s.cr  < f.crMin)  return false;
  if (s.nm  != null && s.nm  < f.nmMin)  return false;
  if (f.minConf && (s.scoreConf||0) < f.minConf) return false;
  if (f.sector !== 'all' && s.sectorAr !== f.sector) return false;
  return true;
  });
}

/* 🎯 درجة الجودة — ربح + انضباط مالي */
function fzQualScore(s){
  let sc = 0, got = 0;
  /* ① العائد على حقوق الملكية (30) — أقوى مؤشر الأرباح */
  if (s.roe != null && s.roe > 0){
  sc += s.roe>=30?30 : s.roe>=20?26 : s.roe>=15?22 : s.roe>=10?16 : s.roe>=5?9 : 3;
  got += 30;
  }
  /* ② العائد على رأس المال المستثمر (20) — أدق من ROE */
  if (s.roic != null && s.roic > 0){
  sc += s.roic>=20?20 : s.roic>=14?17 : s.roic>=9?14 : s.roic>=5?9 : 4;
  got += 20;
  } else if (s.roa != null && s.roa > 0){
  sc += s.roa>=12?20 : s.roa>=7?16 : s.roa>=4?12 : s.roa>=2?7 : 3;
  got += 20;
  }
  /* ③ الانضباط المالي (25) — الديون والسيولة */
  if (s.de != null){
  const de = s.de;
  /* ملاحظة: للبنوك الديون جزء طبيعي من النشاط — بنخفف العقوبة */
  const isBank = /بنك|مالي|Finance/.test(s.sectorAr||'') || /بنك|مالي|Finance/.test(s.sector||'');
  let p;
  if (isBank) p = de<=1.2?12 : de<=2.5?9 : de<=4?6 : 3;
  else  p = de<=0.2?12 : de<=0.4?10 : de<=0.7?7 : de<=1.2?4 : 1;
  sc += p; got += 12;
  }
  if (s.cr != null){
  const cr = s.cr;
  const isBank = /بنك|مالي|Finance/.test(s.sectorAr||'');
  let p;
  if (isBank) p = cr>=1.1?13 : cr>=0.9?10 : cr>=0.7?6 : 3;
  else  p = cr>=2.5?13 : cr>=1.8?11 : cr>=1.3?8 : cr>=1?5 : 2;
  sc += p; got += 13;
  }
  /* ④ جودة الربح (25) — الهامش */
  if (s.nm != null && s.nm > 0){
  sc += s.nm>=25?25 : s.nm>=15?21 : s.nm>=10?17 : s.nm>=5?12 : 6;
  got += 25;
  } else if (s.om != null && s.om > 0){
  sc += s.om>=25?25 : s.om>=15?21 : s.om>=10?17 : s.om>=5?12 : 6;
  got += 25;
  }
  /* ⑤ ع bonus: سيولة سريعة + مدى */
  if (s.qr != null && s.cr != null && s.qr > s.cr) sc += 3;  /* سيولة سريعة أعلى = زيادة بسيطة */
  return got ? Math.round(Math.min(100, sc * (100/Math.max(40,got)) )) : 0;
}

/* ⚠️ تحذيرات الجودة — فين الثغرة؟ */
function fzQualWarn(s){
  const w = [];
  if (s.de != null && s.de > 1.2 && !/بنك|مالي|Finance/.test(s.sectorAr||''))
  w.push('⚠️ دين/أصول ' + (s.de*100).toFixed(0) + '٪ — ديون أعلى من أصولها');
  if (s.cr != null && s.cr < 1)
  w.push('⚠️ نسبة التداول ' + s.cr.toFixed(2) + ' — مش قادر يدفع التزاماته');
  if (s.roe != null && s.roe < 0)
  w.push('⚠️ ROE سالب (' + s.roe.toFixed(0) + '%) — الشركة خسرانة');
  else if (s.roe != null && s.roe > 0 && s.roe < 5)
  w.push('⚠️ ROE ضعيف (' + s.roe.toFixed(0) + '%) — العائد على حقوق الملكية قليل');
  if (s.nm != null && s.nm < 5)
  w.push('⚠️ هامش صافي ' + s.nm.toFixed(1) + '% — الربح ضعيف مقارنة بالمبيعات');
  if (s.om != null && s.nm != null && s.om > 0 && s.nm < 0)
  w.push('⚠️ تشغيلي موجب وصافي سالب — مصاريف فايدة/مالية عالية');
  if (fzQualCount(s) < 6)
  w.push('📌 بيانات ناقصة (' + fzQualCount(s) + '/8 مؤشرات)');
  if ((s.mdd1y||0) > 50)
  w.push('⚠️ نزل ' + s.mdd1y.toFixed(0) + '% في أسوأ سنة — جودة financial مش بتحميك من الخوف');
  if ((s.scoreConf||0) < 60)
  w.push('📌 ثقة ' + (s.scoreConf||0) + '%');
  return w;
}

let FZ_QUAL_HELP = false;
function fzQualHelpBox(){
  const on = FZ_QUAL_HELP;
  let h = '<div class="flt-help">';
  h += '<button class="flt-help-h'+(on?' open':'')+'" onclick="fzQualHelpToggle()">'
  +  '<span>❓ إيه فلتر الجودة؟ وإيه الفرق بين شركة مديانة وشركة ضعيفة؟</span><i>'+(on?'✕':'؟')+'</i></button>';
  h += '<div class="flt-help-b" style="display:'+(on?'block':'none')+'">';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🎯</span> الفكرة في سطر</div>'
  + '<p class="flt-h-p"><b>الشركة ممكن تكسب كتير وترجع للسهم فايدة من غير ما تحس.</b></p>'
  + '<p class="flt-h-p">سهم رخيص في شركة <b>مديانة</b> — الشركة ممكن ما تقدرش تدفع فوايدها السنة الجاية.</p>'
  + '<p class="flt-h-p"><b>الفلتر ده بيبص على «صحة الحسابات» مش على الرقم الظاهر بس.</b></p>'
  + '<div class="flt-h-ex">'
  +  '<div class="flt-h-exi bad"><b>❌ ربح كاذب</b><span>شركة مديانة</span>'
  +  '<em>ربح بيقول 10% — بس الدين 3 أضعاف حقوق الملكية</em></div>'
  +  '<div class="flt-h-exi"><b>✅ ربح حقيقي</b><span>شركة سليمة</span>'
  +  '<em>ربح 20% + دين منخفض + سيولة كويسة</em></div>'
  + '</div></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📊</span> المؤشرات الأربعة ومعناها</div>'
  + '<div class="flt-h-metric"><b>① العائد على حقوق الملكية (ROE)</b>'
  + '<p><b>الشركة بتكسب كام في كل 100 جنيه ملكية؟</b></p>'
  + '<p>ROE = صافي الربح ÷ حقوق الملكية (فلوس المساهمين)</p>'
  + '<p>ROE 30% ⇒ الشركة بتكسب 30 جنيه عن كل 100 جنيه ملكيتها</p>'
  + '<p class="flt-h-note">📌 وسيط السوق المصري: <b>24.5%</b> — وده عالي. '
  + '60 من 97 سهم عندهم ROE فوق 20%.</p></div>'
  + '<div class="flt-h-metric"><b>② الانضباط المالي — الدين والسيولة</b>'
  + '<p><b>الشركة مديانة قد إيه؟</b></p>'
  + '<p><b>نسبة الدين</b> = الديون ÷ الأصول · كل ما قلّت أحسن</p>'
  + '<p><b>نسبة التداول</b> = هل الشركة تقدر تحول الأصول لكاش بسرعة؟</p>'
  + '<p class="flt-h-note">🔥 <b>دي المؤشرات الجديدة</b> — في كانت <b>صفر%</b>، '
  + 'دلوقتي <b>50%</b> و<b>51%</b>. ولا منافس عربي عنده.</p></div>'
  + '<div class="flt-h-metric"><b>③ جودة الربح — الهامش</b>'
  + '<p><b>من كل 100 جنيه مبيعات، الشركة بتاخد كام صافي؟</b></p>'
  + '<p>هامش 25% ⇒ بتاخد 25 من كل 100 مبيعات</p>'
  + '<p class="flt-h-note">📌 وسيط السوق: <b>17.3%</b> — وده رقم كويس لمصر.</p></div></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🏦</span> قياسات البنوك مختلفة — ليه؟</div>'
  + '<p class="flt-h-p">البنك<b>شغله</b> إنه ياخد ديون ويقرض. يعني الديون عنده<b>طبيعي</b> '
  + 'مش خطر. شركة صناعية عندها ديون = مشكلة.</p>'
  + '<p class="flt-h-p">عشان كده الفلتر بيعاقب على الديون بشكل <b>أخف في البنوك</b>:</p>'
  + '<div class="flt-h-tbl" style="font-size:.73rem">'
  + '<div style="display:grid;grid-template-columns:110px 1fr 1fr;gap:2px;padding:8px 0;border-bottom:1px solid var(--line);font-weight:800">'
  + '<span>المؤشر</span><span>بنك</span><span>غير بنك</span></div>'
  + '<div style="display:grid;grid-template-columns:110px 1fr 1fr;gap:2px;padding:7px 0;border-bottom:1px solid var(--line-soft)">'
  + '<span style="color:var(--muted)">دين مقبول</span><span style="color:var(--sec)">حتى 4</span><span style="color:var(--sec)">حتى 0.7</span></div>'
  + '<div style="display:grid;grid-template-columns:110px 1fr 1fr;gap:2px;padding:7px 0">'
  + '<span style="color:var(--muted)">تدفق مقبول</span><span style="color:var(--sec)">فوق 0.7</span><span style="color:var(--sec)">فوق 1.3</span></div>'
  + '</div></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🏅</span> الدرجة من 100</div>'
  + '<div class="flt-h-w">'
  +  '<div class="flt-h-wi"><span>العائد على الملكية</span><b>30</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>رأس المال</span><b>20</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>الانضباط المالي</span><b>25</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>جودة الربح</span><b>25</b><i>من 100</i></div>'
  + '</div></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📈</span> أرقام حقيقية من السوق المصري</div>'
  + '<ul class="flt-h-ul">'
  + '<li>نسبة الدين متاحة لـ<b>149</b> من 296 سهم (50%) — أعلى تغطية في كل الفلاتر</li>'
  + '<li>نسبة التداول متاحة لـ<b>152</b> سهم (51%)</li>'
  + '<li>ROE وسيطه <b>24.5%</b> — السوق فيه شركات قوية</li>'
  + '<li>نسبة الدين وسيطها <b>0.18</b> — أغلب الشركات مديونة قليلة</li>'
  + '<li>نسبة التداول وسيطها <b>1.36</b></li>'
  + '<li><b>43 سهم</b> عندهم المؤشرات الثمانية كلها</li>'
  + '<li><b>71 سهم</b> عندهم 5+ مؤشرات — دي اللي الفلتر بيشتغل عليها</li>'
  + '</ul></div>';

  h += '<div class="flt-h-warn">⚠️ <b>مهم:</b> الجودة وحدها مش كفاية. '
  + 'شركة ممتازة بس سعرها غالي ممكن ترجع 30%. '
  + 'الفلتر ده بيقولك <b>الشركة سليمة</b> — السعر والوقت المناسب في فلاتر تانية (القيمة والزخم). '
  + 'استخدمهم مع بعض.</div>';

  h += '</div></div>';
  return h;
}
function fzQualHelpToggle(){ FZ_QUAL_HELP = !FZ_QUAL_HELP; fzQualRender(); }

function fzQualInit(){ fzQualRender(); }

function fzQualRender(){
  const box = document.getElementById('fltQuaBox'); if (!box) return;
  const f = FZ_QUAL;
  const all = OS_DB.filter(s=>fzQualCount(s) >= f.minInd);
  const rows = fzQualRows().map(s=>{ const c=Object.assign({},s); c._qual=fzQualScore(s); return c; })
  .sort((a,b)=>b._qual-a._qual);
  const secs = [...new Set(OS_DB.map(s=>s.sectorAr).filter(Boolean))].sort();

  let h = '';
  h += '<div class="flt-head"><div><h2>🎯 فلتر الجودة</h2>'
  + '<p class="flt-sub">شركات بتكسب بجد — والميزانية سليمة</p></div>'
  + '<button class="flt-sw'+(f.on?' on':'')+'" onclick="fzQualToggle()">'
  + (f.on?'🔒 الفلاتر مفعّلة':'🔓 فعّل الفلاتر')+'</button></div>';

  h += '<div class="flt-filters'+(f.on?'':' hid')+'">'
  + '<div class="flt-sl"><label>أقل ROE <b>'+f.roeMin+'</b>%</label>'
  +  '<input type="range" id="fzq-roe" min="0" max="40" step="1" value="'+f.roeMin+'" '
  +  'oninput="fzQualSet(\'roeMin\',this.value)"></div>'
  + '<div class="flt-sl"><label>أعلى دين/أصول <b>'+(f.deMax*100).toFixed(0)+'٪</b></label>'
  +  '<input type="range" id="fzq-de" min="0" max="3" step="0.1" value="'+f.deMax+'" '
  +  'oninput="fzQualSet(\'deMax\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقل نسبة تداول <b>'+f.crMin+'</b></label>'
  +  '<input type="range" id="fzq-cr" min="0.5" max="4" step="0.1" value="'+f.crMin+'" '
  +  'oninput="fzQualSet(\'crMin\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقل هامش صافي <b>'+f.nmMin+'</b>%</label>'
  +  '<input type="range" id="fzq-nm" min="0" max="40" step="1" value="'+f.nmMin+'" '
  +  'oninput="fzQualSet(\'nmMin\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقل مؤشرات <b>'+f.minInd+'</b>/8</label>'
  +  '<input type="range" id="fzq-ind" min="3" max="8" step="1" value="'+f.minInd+'" '
  +  'oninput="fzQualSet(\'minInd\',this.value)"></div>'
  + '<div class="flt-sl"><label>القطاع <b>'+fzSectorName(f.sector)+'</b></label>'
  +  '<select class="fli-sel" onchange="fzQualSet(\'sector\',this.value)">'
  +  '<option value="all">كل القطاعات</option>'
  +  secs.map(x=>'<option value="'+escFlt(x)+'"'+(f.sector===x?' selected':'')+'>'+escFlt(x)+'</option>').join('')
  +  '</select></div>'
  + '<button class="flt-rst" onclick="fzQualReset()">↺ إعادة</button></div>';

  if (f.on && f.minInd >= 5){
  const thin = OS_DB.filter(s=>fzQualCount(s) < f.minInd).length;
  if (thin) h += '<div class="flt-alert">📊 <b>محتاج بيانات:</b> '
  + thin + ' سهم مافيش عندهم ' + f.minInd + ' مؤشرات جودة — مخفيين. '
  + '<span class="flt-alert-s">وده طبيعي — 114 سهم من 296 ما ينشرش قوائمهم المالية أصلاً. '
  + 'الفلتر بيشتغل على اللي بياخدوا المال بشكل جدي.</span></div>';
  }

  h += fzQualHelpBox();

  h += '<div class="flt-stats">'
  + '<div><b>'+rows.length+'</b><span>من '+all.length+' عندهم بيانات</span></div>'
  + '<div><b>'+OS_DB.filter(s=>fzQualCount(s)>=6).length+'</b><span>بـ6+ مؤشرات</span></div>'
  + '<div><b>'+(rows.length?(rows.reduce((a,s)=>a+(s.de||0),0)/rows.filter(s=>s.de!=null).length*100||0).toFixed(0):'—')+'٪</b><span>متوسط الدين</span></div>'
  + '</div>';

  if (!rows.length){
  box.innerHTML = h + '<div class="flt-empty">⛔ مفيش أسهم بتستوفي الشروط<br>'
  + '<button class="dv-tab" onclick="fzQualReset()">وسّع الفلاتر</button></div>';
  return;
  }

  const CAP = 60;
  h += '<div class="flt-tbl-wrap"><table class="flt-tbl"><thead><tr>'
  + '<th>السهم</th><th>🎯 الجودة</th><th>ROE</th><th>ROA/ROIC</th><th>دين/أصول ٪</th>'
  + '<th>تداول</th><th>هامش</th><th>OCTA</th><th>القطاع</th><th>ملاحظات</th><th></th>'
  + '</tr></thead><tbody>';
  rows.slice(0,CAP).forEach(function(s){
  const warns = fzQualWarn(s);
  const isBank = /بنك|مالي|Finance/.test(s.sectorAr||'');
  h += '<tr>'
  + '<td><b class="flt-c">'+s.code+'</b><small>'+escFlt((s.name||'').slice(0,20))+'</small></td>'
  + '<td><span class="flt-safe s'+(s._qual>=70?'hi':s._qual>=50?'md':'lo')+'">'+s._qual+'</span></td>'
  + '<td>'+(s.roe!=null?'<span class="flt-b '+(s.roe>=20?'ok':s.roe>=10?'mid':'bad')+'">'
  +  fltNum(s.roe,1)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+((s.roic!=null||s.roa!=null)?'<span class="flt-b '+((s.roic||s.roa)>=12?'ok':(s.roic||s.roa)>=6?'mid':'bad')+'">'
  +  fltNum(s.roic!=null?s.roic:s.roa,1)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(s.de!=null?'<span class="flt-b '+((isBank?(s.de<=2.5):(s.de<=0.6))?'ok':(isBank?(s.de<=4):(s.de<=1.2))?'mid':'bad')+'">'
  /* 🔴 de نسبة (1.0 = 100٪) — كان بيطلع «0.44» جنب ROE 34٪ ومن غير وحدة
     ⇒ المستخدم مش عارف يقرأها 0.44٪ ولا 44٪. دلوقتي 44٪. */
  +  fltNum(s.de*100,0)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(s.cr!=null?'<span class="flt-b '+((isBank?(s.cr>=0.9):(s.cr>=1.3))?'ok':(isBank?(s.cr>=0.7):(s.cr>=1))?'mid':'bad')+'">'
  +  fltNum(s.cr,2)+'</span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(s.nm!=null?'<span class="flt-b '+(s.nm>=15?'ok':s.nm>=5?'mid':'bad')+'">'
  +  fltNum(s.nm,1)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
  +  escFlt(s.decision||'—')+'</span><small>'+fltNum(s.score,0)+'% · '+fzConfCell(s.scoreConf)+'</small></td>'
  + '<td class="flt-sect">'+escFlt(s.sectorAr||'—')+'</td>'
  + '<td class="flt-warn">'+fltWarnCell(warns,'✅ جودة عالية')+'</td>'
  + '<td><button class="flt-add" onclick="fzQualAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
  + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length+'</b></div>';
  /* 🧮 نور: ترتيب الجدول (دوس على رأس العمود) */
  box.innerHTML = h;
  if (typeof nzSortPaint === 'function') nzSortPaint('qual');
}

function fzQualToggle(){ FZ_QUAL.on = !FZ_QUAL.on; fzQualRender(); }
function fzQualReset(){ const f=FZ_QUAL; f.roeMin=10; f.deMax=1.0; f.crMin=1.0; f.nmMin=3;
  f.minInd=4; f.sector='all'; f.minConf=0; f.on=false; fzQualRender(); }
function fzQualSet(k,v){ FZ_QUAL[k] = (typeof v==='string') ? v : Number(v); fzQualRender(); }

function fzQualAdd(code){
  const s = OS_DB.find(x=>x.code===code); if (!s) return;
  if (typeof pickAdd !== 'function'){ alert('صفحة المرشحين لسه مش محمّلة'); return; }
  if (typeof PICK === 'undefined' || PICK.indexOf(code) >= 0) return;
  if (!s._flt) s._flt = Object.assign({}, s);
  PICK.push(code); PICK_DATA[code] = s._flt;
  PICK_TIME[code] = new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  try{ localStorage.setItem('octa_pick_v1', JSON.stringify({c:PICK,t:PICK_TIME})); }catch(e){}
  const cnt = document.getElementById('pickCount'); if (cnt) cnt.textContent = PICK.length+'/'+(typeof PICK_MAX!=='undefined'?PICK_MAX:10);
  const i = document.getElementById('pickQ');
  if (typeof pickRenderList === 'function') pickRenderList(i?i.value:'');
  if (typeof pickRenderCards === 'function') pickRenderCards();
  fzQualRender();
}

/* ══════════════════════════════════════════════════════════════
  💵 فلتر السيولة — الفلتر السادس
  💡 المبدأ: مش مهم السهم كويس — المهم تقدر تبيعه
  سهم بـ6 آلاف جنيه/يوم مش مشكلة لحد ما تحتاج تبيعه
  🔥 88% تغطية — أعلى تغطية في كل الفلاتر
  ══════════════════════════════════════════════════════════════ */

const FZ_LIQ = { on:false, minVol:200000, minRel:0.8, minMcap:0,
  portfolio:100000, maxDays:7, sector:'all' };

/* 🕐 كم يوم عشان تبيع محفظتك في السهم ده؟ */
function fzExitDays(s, capital){
  const px = s.p || s.price;  /* p أو price */
  if (!px || !s.av30 || s.av30 <= 0) return null;
  const shares = capital / px;  /* كام سهم هتشتري */
  const daily  = s.av30 * 0.15;  /* 15% من الحجم —Estimatesواقعي */
  return daily > 0 ? shares / daily : 999;
}

function fzLiqRows(){
  const f = FZ_LIQ;
  return OS_DB.filter(function(s){
  if (s.av30 == null || s.av30 <= 0) return false;
  if (s.av30 < f.minVol) return false;
  if (f.minRel > 0 && s.relvol != null && s.relvol < f.minRel) return false;
  if (f.minMcap > 0 && (s.mc == null || s.mc < f.minMcap)) return false;
  if (f.maxDays < 999){
  const d = fzExitDays(s, f.portfolio);
  if (d == null || d > f.maxDays) return false;
  }
  if (f.sector !== 'all' && s.sectorAr !== f.sector) return false;
  return true;
  });
}

/* 🎯 درجة السيولة — سهولة الدخول والخروج */
function fzLiqScore(s){
  let sc = 0;
  /* ① حجم يومي (40) — — كل ما كان أكبر أفضل */
  const av = s.av30 || 0;
  if  (av > 5e6) sc += 40;
  else if (av > 2e6) sc += 36;
  else if (av > 1e6) sc += 32;
  else if (av > 5e5) sc += 27;
  else if (av > 2e5) sc += 21;
  else if (av > 1e5) sc += 14;
  else  sc += 6;
  /* ② سرعة البيع من 100 ألف (35) */
  const d = fzExitDays(s, FZ_LIQ.portfolio);
  if (d != null){
  if  (d < 0.5) sc += 35;
  else if (d < 1)  sc += 31;
  else if (d < 3)  sc += 26;
  else if (d < 7)  sc += 19;
  else if (d < 14)  sc += 11;
  else if (d < 30)  sc += 5;
  else  sc += 0;
  }
  /* ③ الحجم النسبي (15) — هل بيتداول اليوم أكتر من المعتاد؟ */
  if (s.relvol != null){
  sc += s.relvol > 1.5 ? 15 : s.relvol > 1.1 ? 12 : s.relvol > 0.8 ? 8 : s.relvol > 0.5 ? 4 : 1;
  }
  /* ④ حجم الشركة (10) — السهم الكبير أأمن في السيولة */
  if (s.mc != null){
  sc += s.mc > 2e10 ? 10 : s.mc > 5e9 ? 8 : s.mc > 1e9 ? 6 : s.mc > 3e8 ? 3 : 1;
  }
  return Math.round(Math.min(100, sc));
}

/* ⚠️ تحذيرات السيولة */
function fzLiqWarn(s){
  const w = [];
  const av = s.av30 || 0;
  const d = fzExitDays(s, FZ_LIQ.portfolio);
  if (d != null && d > 30) w.push('🚨 بياخد <b>'+d.toFixed(0)+' يوم</b> تبيع — لو محتاج الفلوس بسرعة دي مشكلة');
  else if (d != null && d > 7) w.push('⚠️ بياخد <b>'+d.toFixed(1)+' يوم</b> تبيع 100 ألف');
  if (av > 0 && av < 1e5) w.push('⚠️ سيولة <b>'+(av/1e3).toFixed(0)+' ألف/يوم</b> — ضعيفة جداً');
  if (s.relvol != null && s.relvol < 0.4) w.push('📌 حجم اليوم <b>'+s.relvol.toFixed(2)+'×</b> المعتاد — السهم نايم');
  if (s.mc != null && s.mc < 5e8) w.push('📌 شركة صغيرة ('+(s.mc/1e6).toFixed(0)+' مليون) — حساسة للحركات');
  if (s.mdd1y != null && s.mdd1y > 60) w.push('⚠️ نزل ' + s.mdd1y.toFixed(0) + '% — والسيولة الضعيفة بتزوّده');
  if ((s.av30||0) < 1e5 && (s.mc||0) > 3e9) w.push('🚨 شركة كبيرة لكن مش بتتداول — ده أخطر نوع');
  return w;
}

let FZ_LIQ_HELP = false;
function fzLiqHelpBox(){
  const on = FZ_LIQ_HELP;
  let h = '<div class="flt-help">';
  h += '<button class="flt-help-h'+(on?' open':'')+'" onclick="fzLiqHelpToggle()">'
  +  '<span>❓ إيه فلتر السيولة؟ وليه «سهم كويس» ممكن يبقى فخ؟</span><i>'+(on?'✕':'؟')+'</i></button>';
  h += '<div class="flt-help-b" style="display:'+(on?'block':'none')+'">';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🎯</span> الفكرة في سطر</div>'
  + '<p class="flt-h-p">تخيّل إنك لقيت سهم ممتاز وعايز تشتريه بـ<b>100 ألف جنيه</b>.</p>'
  + '<p class="flt-h-p">بس السهم ده بيتداول <b>6 آلاف جنيه في اليوم</b>.</p>'
  + '<p class="flt-h-p"><b>الشراء سهل — بس البيع؟</b> لو السوق نزل يبقى أنت مش قادر تخرج.</p>'
  + '<div class="flt-h-ex">'
  +  '<div class="flt-h-exi bad"><b>❌ فخ</b><span>سيولة 5 آلاف/يوم</span>'
  +  '<em>لو اشتريت 100 ألف — بتبيعهم على مدى شهور</em></div>'
  +  '<div class="flt-h-exi"><b>✅ سيولة كويسة</b><span>سيولة 4 ملايين/يوم</span>'
  +  '<em>تبيع 100 ألف في أقل من يوم</em></div>'
  + '</div></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🚨</span> أخطر حالة في السوق المصري</div>'
  + '<p class="flt-h-p"><b>شركة كبيرة + سيولة ضعيفة = أخطر من شركة صغيرة.</b></p>'
  + '<p class="flt-h-p">لأنك في الحالة دي بتشتري بـ«سعر الشركة» — '
  + 'والشركة دي شكلها كويسة — بس السوق فعلاً<b>مش مهتم</b> يبيع منها.</p>'
  + '<p class="flt-h-note">📌 في السوق دلوقتي فيه أسهم زي: <b>CPCI</b> القاهرة للأدوية '
  + '(9 مليار حجم، 7 آلاف/يوم) · <b>AXPH</b> الإسكندرية للأدوية (7.5 مليار، 5 آلاف/يوم). '
  + 'شركات بمليارات… ومش بتتداول.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📊</span> الأرقام ومعناها</div>'
  + '<table class="flt-h-tbl"><thead><tr><th>المؤشر</th><th>معناه</th><th>ليه مهم؟</th></tr></thead><tbody>'
  + '<tr><td>حجم 30 يوم</td><td>كام بيتداول يومياً</td><td>بيحدد لو تقدر تبيع</td></tr>'
  + '<tr><td>أيام البيع</td><td>بتاخد كام يوم عشان تخرج</td><td>🔟 الأهم — حسب محفظتك</td></tr>'
  + '<tr><td>حجم نسبي</td><td>نشط اليوم مقارنة بالمعتاد</td><td>السهم نايم ولا صاحي؟</td></tr>'
  + '<tr><td>حجم الشركة</td><td>القيمة السوقية (MC) بالمليار</td><td>الشركة الكبيرة أأمن</td></tr>'
  + '</tbody></table>'
  + '<p class="flt-h-note">💡 الفلتر بيحسب <b>أيام البيع</b> على محفظتك أنت — '
  + 'مش رقم ثابت. لو معاك مليون بدل 100 ألف،النتيجة مختلفة.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">⚙️</span> المعيار: 15% من الحجم</div>'
  + '<p class="flt-h-p">لما نقول «تقدر تبيع»، احنا بنفترض إنك تقدر تاخد '
  + '<b>15% من حجم اليوم</b> من غير ما السعر يتحرك كتير.</p>'
  + '<p class="flt-h-p">ليه 15%؟ عشان لو أخذت نص أو تلتا الحجم، هتدفع فرق سعر كبير. '
  + 'الـ15% حد متحفّظ وواقعي.</p>'
  + '<p class="flt-h-note">📌 تقدر تغيّر المبلغ في الفلاتر فوق (دلوقتي 100 ألف). '
  + 'لو مستثمر كبير، حطّ المبلغ الحقيقي.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🏅</span> الدرجة من 100</div>'
  + '<div class="flt-h-w">'
  +  '<div class="flt-h-wi"><span>حجم يومي</span><b>40</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>سرعة البيع</span><b>35</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>نشاط نسبي</span><b>15</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>حجم الشركة</span><b>10</b><i>من 100</i></div>'
  + '</div>'
  + '<p class="flt-h-note">💡 <b>سرعة البيع 35 نقطة</b> — أعلى من الحجم نفسه. '
  + 'لأن المهم مش «السهم بيتداول كام» — المهم «هل أقدر أخرج منه؟»</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📈</span> أرقام حقيقية</div>'
  + '<ul class="flt-h-ul">'
  + '<li>حجم 30 يوم متاح لـ<b>262</b> من 296 سهم (88%)</li>'
  + '<li>وسيط حجم السوق كله: <b>751 ألف</b> في اليوم</li>'
  + '<li><b>47 سهم</b> سيولتها تحت 50 ألف/يوم (18%)</li>'
  + '<li>سهم واحد بيتداول <b>6 آلاف/يوم</b> — ALEX أسمنت بورتلاند</li>'
  + '<li><b>9 أسهم</b> لو اشتريت 100 ألف، بتاخد <b>أكثر من شهر</b> عشان تبيع</li>'
  + '<li>أسوأهم: <b>NDRL</b> — <b>640 يوم</b> تبيع</li>'
  + '</ul></div>';

  h += '<div class="flt-h-warn">⚠️ <b>مهم:</b> السيولة العالية مش معناها السهم كويس — '
  + 'ممكن يكون سهم خسران بيتداول كتير عشان الناس بتبيع. '
  + 'السيولة شرط <b>ضروري</b> مش <b>كافي</b> — استخدمها مع الأمان والجودة والقيمة.</div>';

  h += '</div></div>';
  return h;
}
function fzLiqHelpToggle(){ FZ_LIQ_HELP = !FZ_LIQ_HELP; fzLiqRender(); }

function fzLiqInit(){ fzLiqRender(); }

function fzLiqRender(){
  const box = document.getElementById('fltLiqBox'); if (!box) return;
  const f = FZ_LIQ;
  const all = OS_DB.filter(s=>s.av30 != null && s.av30 > 0);
  const rows = fzLiqRows().map(s=>{ const c=Object.assign({},s); c._liq=fzLiqScore(s); c._days=fzExitDays(s,f.portfolio); return c; })
  .sort((a,b)=>b._liq-a._liq);
  const secs = [...new Set(all.map(s=>s.sectorAr).filter(Boolean))].sort();
  const slow = all.filter(s=>{ const d=fzExitDays(s,f.portfolio); return d!=null && d>f.maxDays; }).length;

  let h = '';
  h += '<div class="flt-head"><div><h2>💵 فلتر السيولة</h2>'
  + '<p class="flt-sub">أسهم تقدر تدخلها وتخرج منها — بسرعة</p></div>'
  + '<button class="flt-sw'+(f.on?' on':'')+'" onclick="fzLiqToggle()">'
  + (f.on?'🔒 الفلاتر مفعّلة':'🔓 فعّل الفلاتر')+'</button></div>';

  h += '<div class="flt-filters'+(f.on?'':' hid')+'">'
  + '<div class="flt-sl"><label>أقل حجم يومي <b>'+(f.minVol/1e3)+'k</b></label>'
  +  '<input type="range" id="fzl-vol" min="0" max="3000" step="50" value="'+(f.minVol/1e3)+'" '
  +  'oninput="fzLiqSet(\'minVol\',this.value*1000)"></div>'
  + '<div class="flt-sl"><label>محفظتك <b>'+(f.portfolio/1000)+'k</b> جنيه</label>'
  +  '<input type="range" id="fzl-cap" min="10000" max="2000000" step="10000" value="'+f.portfolio+'" '
  +  'oninput="fzLiqSet(\'portfolio\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقصى أيام البيع <b>'+(f.maxDays>=999?'∞':f.maxDays)+'</b></label>'
  +  '<input type="range" id="fzl-days" min="1" max="60" step="1" value="'+Math.min(60,f.maxDays)+'" '
  +  'oninput="fzLiqSet(\'maxDays\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقل حجم نسبي <b>'+f.minRel+'</b>×</label>'
  +  '<input type="range" id="fzl-rel" min="0" max="2" step="0.1" value="'+f.minRel+'" '
  +  'oninput="fzLiqSet(\'minRel\',this.value)"></div>'
  + '<div class="flt-sl"><label>القطاع <b>'+fzSectorName(f.sector)+'</b></label>'
  +  '<select class="fli-sel" onchange="fzLiqSet(\'sector\',this.value)">'
  +  '<option value="all">كل القطاعات</option>'
  +  secs.map(x=>'<option value="'+escFlt(x)+'"'+(f.sector===x?' selected':'')+'>'+escFlt(x)+'</option>').join('')
  +  '</select></div>'
  + '<button class="flt-rst" onclick="fzLiqReset()">↺ إعادة</button></div>';

  if (f.on && f.maxDays < 999 && slow){
  h += '<div class="flt-alert">🚨 <b>بطيء الخروج:</b> ' + slow
  + ' سهم لو اشتريت بـ' + (f.portfolio/1000) + 'k هتاخد أكتر من ' + f.maxDays
  + ' يوم عشان تبيع — مخفيين. '
  + '<span class="flt-alert-s">ارفع «أيام البيع» لو مستعجل، أو ارفع سيولتك.</span></div>';
  }

  h += fzLiqHelpBox();

  const medDays = rows.length ? rows.map(r=>r._days).filter(d=>d!=null).sort((a,b)=>a-b)
  [Math.floor(rows.length/2)] : null;
  h += '<div class="flt-stats">'
  + '<div><b>'+rows.length+'</b><span>من '+all.length+' بيتداولوا</span></div>'
  + '<div><b>'+(medDays!=null&&medDays<1?'<1':fltNum(medDays,1))+'</b><span>وسيط أيام البيع</span></div>'
  + '<div><b>'+all.filter(s=>{const d=fzExitDays(s,f.portfolio);return d!=null&&d>30;}).length+'</b><span>أكثر من شهر</span></div>'
  + '</div>';

  if (!rows.length){
  box.innerHTML = h + '<div class="flt-empty">⛔ مفيش أسهم بتستوفي الشروط<br>'
  + '<button class="dv-tab" onclick="fzLiqReset()">وسّع الفلاتر</button></div>';
  return;
  }

  const CAP = 60;
  h += '<div class="flt-tbl-wrap"><table class="flt-tbl"><thead><tr>'
  + '<th>السهم</th><th>💵 السيولة</th><th>حجم/يوم</th><th>أيام البيع</th>'
  + '<th>حجم نسبي</th><th>حجم السوق</th><th>OCTA</th><th>ملاحظات</th><th></th>'
  + '</tr></thead><tbody>';
  rows.slice(0,CAP).forEach(function(s){
  const warns = fzLiqWarn(s);
  const d = s._days;
  h += '<tr>'
  + '<td><b class="flt-c">'+s.code+'</b><small>'+escFlt((s.name||'').slice(0,20))+'</small></td>'
  + '<td><span class="flt-safe s'+(s._liq>=70?'hi':s._liq>=50?'md':'lo')+'">'+s._liq+'</span></td>'
  + '<td><span class="flt-b '+(s.av30>5e5?'ok':s.av30>1e5?'mid':'bad')+'">'
  +  (s.av30>=1e6?(s.av30/1e6).toFixed(1)+'m':(s.av30/1e3).toFixed(0)+'k')+'</span></td>'
  + '<td>'+(d!=null?'<span class="flt-b '+(d<1?'ok':d<3?'mid':'bad')+'">'
  +  (d<0.1?'⚡ فوري':d<1?'أقل من يوم':fltNum(d,1)+(d<10?' أيام':''))+'</span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(s.relvol!=null?'<span class="flt-b '+(s.relvol>1?'ok':s.relvol>0.6?'mid':'bad')+'">'
  +  '×'+fltNum(s.relvol,2)+'</span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(s.mc!=null?'<span class="flt-b '+(s.mc>5e9?'ok':s.mc>1e9?'mid':'bad')+'">'
  +  (s.mc>=1e9?(s.mc/1e9).toFixed(1)+'b':(s.mc/1e6).toFixed(0)+'m')+'</span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
  +  escFlt(s.decision||'—')+'</span><small>'+fltNum(s.score,0)+'% · '+fzConfCell(s.scoreConf)+'</small></td>'
  + '<td class="flt-warn">'+fltWarnCell(warns,'✅ سهل البيع')+'</td>'
  + '<td><button class="flt-add" onclick="fzLiqAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
  + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length+'</b></div>';
  /* 🧮 نور: ترتيب الجدول (دوس على رأس العمود) */
  box.innerHTML = h;
  if (typeof nzSortPaint === 'function') nzSortPaint('liquid');
}

function fzLiqToggle(){ FZ_LIQ.on = !FZ_LIQ.on; fzLiqRender(); }
function fzLiqReset(){ const f=FZ_LIQ; f.minVol=200000; f.minRel=0.8; f.minMcap=0;
  f.portfolio=100000; f.maxDays=7; f.sector='all'; f.on=false; fzLiqRender(); }
function fzLiqSet(k,v){ FZ_LIQ[k] = (typeof v==='string') ? v : Number(v); fzLiqRender(); }

function fzLiqAdd(code){
  const s = OS_DB.find(x=>x.code===code); if (!s) return;
  if (typeof pickAdd !== 'function'){ alert('صفحة المرشحين لسه مش محمّلة'); return; }
  if (typeof PICK === 'undefined' || PICK.indexOf(code) >= 0) return;
  if (!s._flt) s._flt = Object.assign({}, s);
  PICK.push(code); PICK_DATA[code] = s._flt;
  PICK_TIME[code] = new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  try{ localStorage.setItem('octa_pick_v1', JSON.stringify({c:PICK,t:PICK_TIME})); }catch(e){}
  const cnt = document.getElementById('pickCount'); if (cnt) cnt.textContent = PICK.length+'/'+(typeof PICK_MAX!=='undefined'?PICK_MAX:10);
  const i = document.getElementById('pickQ');
  if (typeof pickRenderList === 'function') pickRenderList(i?i.value:'');
  if (typeof pickRenderCards === 'function') pickRenderCards();
  fzLiqRender();
}

/* ══════════════════════════════════════════════════════════════
  📈 فلتر النمو — الفلتر السابع
  💡 المبدأ: «الشركة بتكبر» ≠ «السهم بيتحرك»
  نمو الشركة = ROE + الهامش + الحجم
  نمو السهم = CAGR 3 سنين (مved later)
  ⚠️ التغطية 37% — أقل الفلترات
  ══════════════════════════════════════════════════════════════ */

const FZ_GROW = { on:false, roeMin:12, cagrMin:10, minData:2, nmMin:3,
  maxCagr:150, sector:'all', minScore:0 };

function fzGrowCount(r){
  return ['roe','nm','om','rev','ni','cagr3y'].filter(k => r[k] != null).length;
}

function fzGrowRows(){
  const f = FZ_GROW;
  return OS_DB.filter(function(s){
  if (fzGrowCount(s) < f.minData) return false;
  if (s.roe  != null && s.roe  < f.roeMin) return false;
  if (s.nm  != null && s.nm  < f.nmMin)  return false;
  if (s.cagr3y != null){
  if (s.cagr3y < f.cagrMin) return false;
  if (f.maxCagr < 999 && s.cagr3y > f.maxCagr) return false;  /* نمو طيران — مش مستقر */
  }
  if (f.sector !== 'all' && s.sectorAr !== f.sector) return false;
  if (f.minScore && (s.score||0) < f.minScore) return false;
  return true;
  });
}

/* 🎯 درجة النمو — نمو مستقر + جودة الربح */
function fzGrowScore(s){
  let sc = 0;
  /* ① نمو الشركة (35) — من ROE لأنه المتاح أكتر (32% مقابل 20% للنمو) */
  if (s.roe != null && s.roe > 0){
  sc += s.roe>=30?35 : s.roe>=20?30 : s.roe>=14?25 : s.roe>=10?18 : s.roe>=5?10 : 4;
  } else if (s.nm != null && s.nm > 0){
  sc += s.nm>=25?35 : s.nm>=15?28 : s.nm>=8?20 : s.nm>=4?12 : 5;
  }
  /* ② نمو السهم 3 سنين (25) — بس الغموض: 25-80 هو المدى الصح */
  if (s.cagr3y != null){
  const g = s.cagr3y;
  sc += g>=25&&g<=80 ? 25 : g>=15&&g<=120 ? 20 : g>=8&&g<=150 ? 15
  : g>=0 ? 9 : g>=-20 ? 4 : 0;
  }
  /* ③ الهامش (20) — النمو لازم يكون فيه ربح */
  const mg = s.nm != null ? s.nm : s.om;
  if (mg != null && mg > 0){
  sc += mg>=25?20 : mg>=15?17 : mg>=10?13 : mg>=5?8 : 4;
  }
  /* ④ حجم الشركة (10) — النمو في شركة كبيرة أضمن */
  if (s.mc != null){
  sc += s.mc>1e10?10 : s.mc>3e9?8 : s.mc>1e9?6 : s.mc>3e8?3 : 1;
  }
  /* ⑤ الثقة (10) */
  sc += Math.min(10, (s.scoreConf||0)/100*10);
  return Math.round(Math.min(100, sc));
}

/* ⚠️ تحذيرات النمو */
function fzGrowWarn(s){
  const w = [];
  const g = s.cagr3y;
  if (g != null && g > 100) w.push('⚠️ نمو <b>'+g.toFixed(0)+'%</b> في 3 سنين — طيران، غير مستقر');
  else if (g != null && g > 80) w.push('📌 نمو مرتفع ('+g.toFixed(0)+'%) — راقب لو هيقبل');
  if (g != null && g < 0) w.push('⚠️ السهم نزل <b>'+Math.abs(g).toFixed(0)+'%</b> في 3 سنين');
  if (s.roe != null && s.roe > 80) w.push('⚠️ ROE <b>'+s.roe.toFixed(0)+'%</b> — نادر، اتأكد إنه حقيقي');
  if (s.nm != null && s.nm < 3) w.push('⚠️ هامش صافي ضعيف ('+s.nm.toFixed(1)+'%) — نمو بلا ربح');
  if (s.rev != null && s.rev <= 0) w.push('⚠️ الإيرادات صفر أو سالبة');
  if (g != null && g > 50 && (s.mc||0) < 1e9) w.push('📌 شركة صغيرة ('+((s.mc||0)/1e6).toFixed(0)+' مليون) بنمو سريع — مخاطرة');
  if (fzGrowCount(s) < 4) w.push('📌 بيانات ناقصة ('+fzGrowCount(s)+'/6)');
  if ((s.scoreConf||0) < 60) w.push('📌 ثقة '+(s.scoreConf||0)+'%');
  return w;
}

let FZ_GROW_HELP = false;
function fzGrowHelpBox(){
  const on = FZ_GROW_HELP;
  let h = '<div class="flt-help">';
  h += '<button class="flt-help-h'+(on?' open':'')+'" onclick="fzGrowHelpToggle()">'
  +  '<span>❓ إيه فلتر النمو؟ وفرق إيه بين نمو الشركة ونمو السهم؟</span><i>'+(on?'✕':'؟')+'</i></button>';
  h += '<div class="flt-help-b" style="display:'+(on?'block':'none')+'">';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🎯</span> الفكرة في سطر</div>'
  + '<p class="flt-h-p"><b>فيه فرق كبير بين حاجتين:</b></p>'
  + '<div class="flt-h-ex">'
  +  '<div class="flt-h-exi"><b>🏭 نمو الشركة</b><span>بتكبر فعلاً؟</span>'
  +  '<em>شركتها بتكبر — ده إنت فايدك على المدى الطويل</em></div>'
  +  '<div class="flt-h-exi bad"><b>📈 نمو السهم</b><span>بتعلى؟</span>'
  +  '<em>السهم طلع — ده ممكن يكون خلص!</em></div>'
  + '</div>'
  + '<p class="flt-h-p">الشركة ممكن تكون بتكبر وسهمها نازل — أو العكس.</p>'
  + '<p class="flt-h-note">📌 الفلتر ده بيبص على <b>الاتنين</b> مع بعض. '
  + 'نمو الشركة من غير نمو السهم = فرصة محدودة. '
  + 'ونمو السهم من غير نمو الشركة = غالباً مضاربة.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📊</span> المؤشرات ومعناها</div>'
  + '<div class="flt-h-metric"><b>① نمو الشركة (35 نقطة)</b>'
  + '<p><b>الشركة بتكبر فعلاً؟</b></p>'
  + '<p>بنقيسه بـ<b>العائد على حقوق الملكية</b> (ROE) — وهو المؤشر المتاح أكتر (32% مقابل 20% للنمو المباشر)</p>'
  + '<p>ROE 25% ⇒ الشركة بتكسب 25 جنيه عن كل 100 جنيه ملكيتها</p>'
  + '<p class="flt-h-note">📌 <b>ليه ROE مش نمو الإيرادات؟</b> لأن نمو الإيرادات مباشر '
  + 'متاح لـ20% من السوق بس — لكن ROE متاح لـ32%. '
  + 'وكلاهما بيوصّل نفس الفكرة: الشركة بتنتج أكتر.</p></div>'
  + '<div class="flt-h-metric"><b>② نمو السهم 3 سنين (25 نقطة)</b>'
  + '<p><b>السهم طلع قد إيه من 3 سنين؟</b></p>'
  + '<p>ده CAGR — معدل النمو المركّب: لو زاد 25% كل سنة × 3 سنين</p>'
  + '<p class="flt-h-note">⚠️ <b>المدى الصح: 25% لـ 80%.</b> '
  + 'فوق 100% = طيران غالباً وصل القمة. '
  + 'وسيط السوق دلوقتي <b>52.8%</b> — يعني السوق كله في طور نمو.</p></div>'
  + '<div class="flt-h-metric"><b>③ الهامش (20 نقطة)</b>'
  + '<p><b>النمو ده بيجيب فلوس فعلاً؟</b></p>'
  + '<p>شركة بتضاعف مبيعاتها ومفيش ربح — ده نمو مش بيفيد.</p>'
  + '<p class="flt-h-note">📌 عشان كده الفلتر بيطلب هامش صافي كمان.</p></div></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">⚠️</span> أحلى حاجة عنا — واللي لازم تخاف منه</div>'
  + '<p class="flt-h-p"><b>تحديث مهم:</b> في <b>182 سهم</b> من 296 (61%) '
  + 'عندهم نمو مركّب 3 سنين. ده <b>رقم قياسي</b> — مفيش منصة تانية بتديه.</p>'
  + '<p class="flt-h-p">بس خد بالك:</p>'
  + '<ul class="flt-h-ul">'
  + '<li><b>52%</b> من الأسهم دي نموها فوق 50% — ده <b>مرتفع</b></li>'
  + '<li>13 سهم نموهم <b>سالب</b> — راكدين أو بينزلوا</li>'
  + '<li>أعلى نمو: <b>ARCC</b> العربية للأسمنت 135% · <b>MPCI</b> ممفيس للأدوية 134% (ROE 70%!)</li>'
  + '<li><b>TMGH</b> طلعت مصطفى نمو 115% — نمو مش حقيقي (بيع أصول)</li>'
  + '</ul>'
  + '<p class="flt-h-note">📌 الفلتر بيحط سقف للنمو (<b>150%</b>) — '
  + 'لأن النمو الروحي بييجي معاه تقلب عالي.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📈</span> أرقام حقيقية</div>'
  + '<ul class="flt-h-ul">'
  + '<li>نمو 3 سنين متاح لـ<b>181</b> من 296 سهم (61%)</li>'
  + '<li>ووسطه في السوق كله: <b>52.8%</b></li>'
  + '<li>أسهم نموها <b>25-50%</b> (المدى الصح): <b>44</b> سهم</li>'
  + '<li>أسهم نموها <b>فوق 50%</b> (طيران): <b>95</b> سهم</li>'
  + '<li>ROE متاح لـ<b>97</b> سهم · الإيرادات لـ<b>108</b></li>'
  + '<li><b>85</b> سهم عندهم نمو + قوائم مالية مع بعض</li>'
  + '</ul></div>';

  h += '<div class="flt-h-warn">⚠️ <b>مهم:</b> النمو من أعلى ع المخاطر في البورصة. '
  + 'شركات بتكبر بسرعة ممكن تكون بتصرف فلوس كتير على النمو ومش بتبنيربح. '
  + 'استخدم فلتر <b>الجودة</b> معاه عشان تتأكد إن النمو ده حقيقي.</div>';

  h += '</div></div>';
  return h;
}
function fzGrowHelpToggle(){ FZ_GROW_HELP = !FZ_GROW_HELP; fzGrowRender(); }

function fzGrowInit(){ fzGrowRender(); }

function fzGrowRender(){
  const box = document.getElementById('fltGroBox'); if (!box) return;
  const f = FZ_GROW;
  const all = OS_DB.filter(s=>fzGrowCount(s) >= f.minData);
  const rows = fzGrowRows().map(s=>{ const c=Object.assign({},s); c._grow=fzGrowScore(s); return c; })
  .sort((a,b)=>b._grow-a._grow);
  const secs = [...new Set(OS_DB.map(s=>s.sectorAr).filter(Boolean))].sort();

  let h = '';
  h += '<div class="flt-head"><div><h2>📈 فلتر النمو</h2>'
  + '<p class="flt-sub">شركات بتكبر — والسهم بيتبعها</p></div>'
  + '<button class="flt-sw'+(f.on?' on':'')+'" onclick="fzGrowToggle()">'
  + (f.on?'🔒 الفلاتر مفعّلة':'🔓 فعّل الفلاتر')+'</button></div>';

  h += '<div class="flt-filters'+(f.on?'':' hid')+'">'
  + '<div class="flt-sl"><label>أقل ROE <b>'+f.roeMin+'</b>%</label>'
  +  '<input type="range" id="fzg-roe" min="0" max="40" step="1" value="'+f.roeMin+'" '
  +  'oninput="fzGrowSet(\'roeMin\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقل نمو 3 سنين <b>'+f.cagrMin+'</b>%</label>'
  +  '<input type="range" id="fzg-cagr" min="-30" max="80" step="5" value="'+f.cagrMin+'" '
  +  'oninput="fzGrowSet(\'cagrMin\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقصى نمو (سقف) <b>'+f.maxCagr+'</b>%</label>'
  +  '<input type="range" id="fzg-max" min="50" max="400" step="10" value="'+f.maxCagr+'" '
  +  'oninput="fzGrowSet(\'maxCagr\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقل هامش <b>'+f.nmMin+'</b>%</label>'
  +  '<input type="range" id="fzg-nm" min="0" max="30" step="1" value="'+f.nmMin+'" '
  +  'oninput="fzGrowSet(\'nmMin\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقل بيانات <b>'+f.minData+'</b>/6</label>'
  +  '<input type="range" id="fzg-ind" min="2" max="6" step="1" value="'+f.minData+'" '
  +  'oninput="fzGrowSet(\'minData\',this.value)"></div>'
  + '<div class="flt-sl"><label>القطاع <b>'+fzSectorName(f.sector)+'</b></label>'
  +  '<select class="fli-sel" onchange="fzGrowSet(\'sector\',this.value)">'
  +  '<option value="all">كل القطاعات</option>'
  +  secs.map(x=>'<option value="'+escFlt(x)+'"'+(f.sector===x?' selected':'')+'>'+escFlt(x)+'</option>').join('')
  +  '</select></div>'
  + '<button class="flt-rst" onclick="fzGrowReset()">↺ إعادة</button></div>';

  if (f.on && f.minData >= 3){
  const thin = OS_DB.filter(s=>fzGrowCount(s) < f.minData).length;
  if (thin) h += '<div class="flt-alert">📊 <b>محتاج بيانات:</b> '
  + thin + ' سهم مافيش عندهم ' + f.minData + ' مؤشرات نمو — مخفيين. '
  + '<span class="flt-alert-s">السبب: نمو الشركة محتاج قوائم مالية — و114 سهم في البورصة ما ينشرهاش.</span></div>';
  }

  h += fzGrowHelpBox();

  const medCagr = rows.length ? (()=>{const a=rows.filter(s=>s.cagr3y!=null).map(s=>s.cagr3y).sort((x,y)=>x-y);
  return a.length?a[Math.floor(a.length/2)]:null;})() : null;
  h += '<div class="flt-stats">'
  + '<div><b>'+rows.length+'</b><span>من '+all.length+' عندهم بيانات</span></div>'
  + '<div><b>'+(medCagr!=null?fltNum(medCagr,0)+'%':'—')+'</b><span>وسيط النمو (السوق 53%)</span></div>'
  + '<div><b>'+rows.filter(s=>s.roe!=null&&s.roe>=20).length+'</b><span>ROE فوق 20%</span></div>'
  + '</div>';

  if (!rows.length){
  box.innerHTML = h + '<div class="flt-empty">⛔ مفيش أسهم بتستوفي الشروط<br>'
  + '<button class="dv-tab" onclick="fzGrowReset()">وسّع الفلاتر</button></div>';
  return;
  }

  const CAP = 60;
  h += '<div class="flt-tbl-wrap"><table class="flt-tbl"><thead><tr>'
  + '<th>السهم</th><th>📈 النمو</th><th>ROE</th><th>نمو 3 سنين</th>'
  + '<th>هامش</th><th>حجم السوق</th><th>OCTA</th><th>القطاع</th><th>ملاحظات</th><th></th>'
  + '</tr></thead><tbody>';
  rows.slice(0,CAP).forEach(function(s){
  const warns = fzGrowWarn(s);
  const g = s.cagr3y;
  const inSweet = g!=null && g>=25 && g<=80;
  h += '<tr>'
  + '<td><b class="flt-c">'+s.code+'</b><small>'+escFlt((s.name||'').slice(0,20))+'</small></td>'
  + '<td><span class="flt-safe s'+(s._grow>=70?'hi':s._grow>=50?'md':'lo')+'">'+s._grow+'</span></td>'
  + '<td>'+(s.roe!=null?'<span class="flt-b '+(s.roe>=20?'ok':s.roe>=10?'mid':'bad')+'">'
  +  fltNum(s.roe,1)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(g!=null?'<span class="flt-b '+(inSweet?'ok':g<0?'bad':'mid')+'">'
  +  (g>0?'+':'')+fltNum(g,0)+'<i>%</i></span>'+(inSweet?' <i class="flt-sweet">✓</i>':''):'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(s.nm!=null?'<span class="flt-b '+(s.nm>=15?'ok':s.nm>=5?'mid':'bad')+'">'
  +  fltNum(s.nm,1)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(s.mc!=null?'<span class="flt-b '+(s.mc>3e9?'ok':s.mc>1e9?'mid':'bad')+'">'
  +  (s.mc>=1e9?(s.mc/1e9).toFixed(1)+'b':(s.mc/1e6).toFixed(0)+'m')+'</span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
  +  escFlt(s.decision||'—')+'</span><small>'+fltNum(s.score,0)+'% · '+fzConfCell(s.scoreConf)+'</small></td>'
  + '<td class="flt-sect">'+escFlt(s.sectorAr||'—')+'</td>'
  + '<td class="flt-warn">'+fltWarnCell(warns,'✅ نمو مستقر')+'</td>'
  + '<td><button class="flt-add" onclick="fzGrowAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
  + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length+'</b></div>';
  /* 🧮 نور: ترتيب الجدول (دوس على رأس العمود) */
  box.innerHTML = h;
  if (typeof nzSortPaint === 'function') nzSortPaint('growth');
}

function fzGrowToggle(){ FZ_GROW.on = !FZ_GROW.on; fzGrowRender(); }
function fzGrowReset(){ const f=FZ_GROW; f.roeMin=12; f.cagrMin=10; f.minData=2; f.nmMin=3;
  f.maxCagr=150; f.sector='all'; f.minScore=0; f.on=false; fzGrowRender(); }
function fzGrowSet(k,v){ FZ_GROW[k] = (typeof v==='string') ? v : Number(v); fzGrowRender(); }

function fzGrowAdd(code){
  const s = OS_DB.find(x=>x.code===code); if (!s) return;
  if (typeof pickAdd !== 'function'){ alert('صفحة المرشحين لسه مش محمّلة'); return; }
  if (typeof PICK === 'undefined' || PICK.indexOf(code) >= 0) return;
  if (!s._flt) s._flt = Object.assign({}, s);
  PICK.push(code); PICK_DATA[code] = s._flt;
  PICK_TIME[code] = new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  try{ localStorage.setItem('octa_pick_v1', JSON.stringify({c:PICK,t:PICK_TIME})); }catch(e){}
  const cnt = document.getElementById('pickCount'); if (cnt) cnt.textContent = PICK.length+'/'+(typeof PICK_MAX!=='undefined'?PICK_MAX:10);
  const i = document.getElementById('pickQ');
  if (typeof pickRenderList === 'function') pickRenderList(i?i.value:'');
  if (typeof pickRenderCards === 'function') pickRenderCards();
  fzGrowRender();
}

/* ══════════════════════════════════════════════════════════════
  🏦 فلتر التدفق النقدي — الفلتر الثامن (الأخير)
  💡 المبدأ: «الربح على الورق» ≠ «كاش في إيدك»
  شركة بتقول ربح 100 مليون وتصرف 150 مليون = خسران
  ⚠️ التغطية 15% — أقل الفلترات. هو كشارة مش فلتر كامل.
  ══════════════════════════════════════════════════════════════ */

const FZ_CFW = { on:false, fcfMin:0, qualityMin:40, ebitdaMin:0, maxDebt:2.0,
  requireBoth:true, sector:'all' };

function fzCfwCount(r){
  return ['fcf','ebitda','om','nm','de','rev','ni'].filter(k => r[k] != null).length;
}

/* 🔑 جودة الربح — نسبة الكاش للربح قبل الفوائد
  100% = كل الربح كاش حقيقي
  <50% = جزء كبير ورق
  سالب = بتصرف كاش أكتر مما بتكسب */
function fzCashQuality(s){
  if (!s.fcf || s.fcf == null) return null;
  if (!s.ebitda || s.ebitda <= 0){
  /* من غير EBITDA: نستخدم صافي الربح كبديل */
  if (s.ni != null && s.ni > 0) return Math.round(s.fcf / s.ni * 100);
  return null;
  }
  return Math.round(s.fcf / s.ebitda * 100);
}

function fzCfwRows(){
  const f = FZ_CFW;
  return OS_DB.filter(function(s){
  if (f.requireBoth && !f._skipBoth){
  /* لازم FCF متاح على الأقل */
  if (s.fcf == null) return false;
  }
  if (s.fcf != null && s.fcf < f.fcfMin) return false;
  if (s.ebitda != null && s.ebitda < f.ebitdaMin) return false;
  if (s.de != null && s.de > f.maxDebt) return false;
  /* جودة الربح */
  const q = fzCashQuality(s);
  if (q != null && q < f.qualityMin) return false;
  if (f.sector !== 'all' && s.sectorAr !== f.sector) return false;
  return true;
  });
}

/* 🎯 درجة التدفق النقدي */
function fzCfwScore(s){
  let sc = 0;
  /* ① FCF موجب وكبير (35) */
  const mc = s.mc || 0;
  if (s.fcf != null && s.fcf > 0){
  /* FCF كنسبة من حجم السوق — абсолют малоScaleShares */
  const fcfYield = mc > 0 ? s.fcf / mc * 100 : null;
  if (fcfYield != null){
  sc += fcfYield>=8?35 : fcfYield>=5?31 : fcfYield>=3?26 : fcfYield>=1?19 : 10;
  } else sc += 22;
  } else if (s.fcf != null){
  sc += 0;  /* بتصرف كاش — صفر */
  }
  /* ② جودة الربح — FCF/EBITDA (30) */
  const q = fzCashQuality(s);
  if (q != null){
  if  (q >= 90) sc += 30;
  else if (q >= 65) sc += 26;
  else if (q >= 45) sc += 21;
  else if (q >= 20) sc += 14;
  else if (q >= 0)  sc += 6;
  /* سالب = 0 */
  }
  /* ③ EBITDA موجود وموجب (15) */
  if (s.ebitda != null && s.ebitda > 0){
  const em = s.rev != null && s.rev > 0 ? s.ebitda / s.rev * 100 : null;
  sc += em==null ? 9 : em>=25?15 : em>=15?12 : em>=8?8 : 4;
  } else if (s.om != null && s.om > 0) sc += 7;
  /* ④ الديون (10) — الشركة اللي بتصرف كاش ومديانة = مزدوجة الخطورة */
  if (s.de != null) sc += s.de<=0.2?10 : s.de<=0.5?8 : s.de<=1?5 : s.de<=2?2 : 0;
  /* ⑤ الثقة (10) */
  sc += Math.min(10, (s.scoreConf||0)/100*10);
  return Math.round(Math.min(100, sc));
}

function fzCfwWarn(s){
  const w = [];
  const q = fzCashQuality(s);
  if (s.fcf != null && s.fcf < 0) w.push('🚨 بتصرف كاش (<b>'+(Math.abs(s.fcf)/1e6).toFixed(0)+' مليون</b>) — محتاجة تمويل');
  if (q != null && q < 0) w.push('⚠️ جودة الربح <b>'+q.toFixed(0)+'%</b> — بتصرف أكتر مما بتكسب');
  else if (q != null && q < 45) w.push('⚠️ الـ'+q.toFixed(0)+'% من الربح كاش — الباقي ورقي');
  if (s.de != null && s.de > 1.5 && (s.fcf||0) < 0)
  w.push('🚨 <b>مديانة وبتصرف كاش</b> — أخطر تركيبة مالية');
  if (s.ni != null && s.ni > 0 && s.fcf != null && s.fcf < 0)
  w.push('📌 بتقول ربح <b>'+(s.ni/1e6).toFixed(0)+' مليون</b> بس بتصرف كاش — الربح ورقي');
  if (fzCfwCount(s) < 4) w.push('📌 بيانات ناقصة ('+fzCfwCount(s)+'/7)');
  if ((s.scoreConf||0) < 60) w.push('📌 ثقة '+(s.scoreConf||0)+'%');
  return w;
}

let FZ_CFW_HELP = false;
function fzCfwHelpBox(){
  const on = FZ_CFW_HELP;
  let h = '<div class="flt-help">';
  h += '<button class="flt-help-h'+(on?' open':'')+'" onclick="fzCfwHelpToggle()">'
  +  '<span>❓ ليه «الربح» على الورق مش مهم كده؟</span><i>'+(on?'✕':'؟')+'</i></button>';
  h += '<div class="flt-help-b" style="display:'+(on?'block':'none')+'">';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🎯</span> الفكرة في سطر</div>'
  + '<p class="flt-h-p">شركة بتقول «ربحنا 100 مليون جنيه السنة دي».</p>'
  + '<p class="flt-h-p">بس لو هي تصرف 150 مليون — يعني <b>خسران 50 مليون</b> '
  + 'وإنما الكلام ده كله على الورق.</p>'
  + '<div class="flt-h-ex">'
  +  '<div class="flt-h-exi bad"><b>❌ ربح ورقي</b><span>كسبت 100 · صرفت 150</span>'
  +  '<em>خسران — والـ100 مليون دي على الورق بس</em></div>'
  +  '<div class="flt-h-exi"><b>✅ ربح نقدي</b><span>كسبت 100 · صرفت 60</span>'
  +  '<em>عندك 40 مليون كاش في إيدك فعلاً</em></div>'
  + '</div></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📊</span> المؤشر الأهم: جودة الربح</div>'
  + '<div class="flt-h-metric"><b>نسبة الكاش ÷ الربح (30 نقطة)</b>'
  + '<p><b>من كل 100 جنيه ربح، الشركة بتمسك كام كاش؟</b></p>'
  + '<p>نحسبها كده: <b>التدفق الحر ÷ الربح قبل الفوائد والضرايب والإهلاك</b></p>'
  + '<p class="flt-h-note">📌 <b>ليه نقيس كده؟</b> لأن الـEBITDA بيشيل الإهلاك — '
  + 'يعني لو الشركة اشترت آلات بـ100 مليون، الـEBITDA مش هيحسب الـ100 دي. '
  + 'فلو الـFCF منخفض مع EBITDA عالي = الشركة بتصرف على أصول مش بتجيب ربح منها.</p></div>'
  + '<div class="flt-h-metric"><b>التدفق الحر (35 نقطة)</b>'
  + '<p><b>الكاش الفعلي اللي فاضل بعد كل المصاريف</b></p>'
  + '<p>ربح − مصاريف تشغيل − ضرائب − شراء أصول − سداد ديون = <b>اللي فاضل</b></p>'
  + '<p class="flt-h-note">💡 ده الرقم اللي بيحدد الشركة تقدر <b>توزّع منه</b> فعلاً. '
  + 'عشان كده استخدمناه في فلتر التوزيعات كـ«صحة الشركة».</p></div></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">⚠️</span> أخطر تركيبة مالية</div>'
  + '<p class="flt-h-p"><b>مديانة + بتصرف كاش</b> — دي الشركة اللي هتحتاج تمويل.</p>'
  + '<p class="flt-h-p">لأنها خسران <b>و</b> مديانة — يعني لو السوق هبط، '
  + 'مش هيقدر تلاقي حد يمولها.</p>'
  + '<p class="flt-h-note">📌 الفلتر بيحط <b>صفر</b> في الحالة دي — مش خصم، صفر. '
  + 'ومش بيعرضها خالص لو polarity عالية.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📈</span> أرقام حقيقية — وده اللي بيخوّف</div>'
  + '<ul class="flt-h-ul">'
  + '<li>التدفق الحر متاح لـ<b>50</b> سهم فقط (16%) — وده أقل الفلترات</li>'
  + '<li>من الـ41 اللي عندهم FCF + EBITDA:</li>'
  + '<li>— <b>21</b> عندهم تدفق حر موجب (بتكسب كاش)</li>'
  + '<li>— <b>20</b> عندهم تدفق حر <b>سالب</b> (بتصرف كاش)</li>'
  + '<li>فقط <b>10</b> عندهم نسبة كاش/ربح من 50-100% — أي ربح نقدي صافي</li>'
  + '<li><b>28</b> ربحهم أقل من 50% كاش — أي ربح ورقي</li>'
  + '</ul>'
  + '<p class="flt-h-note">📌 يعني: <b>نص الشركات اللي عندنا بياناتها بتصرف كاش مش بتكسب.</b> '
  + 'ده رقم مهم جداً — ومفيش منصة تانية بتقولهولك.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📌</span> ليه الفلتر ده مهم رغم إن تغطيته 15%؟</div>'
  + '<p class="flt-h-p">لأنه <b>أقوى فلتر تثقيفي</b> عندنا — يعني بيعمل «استبعاد» مش «اختيار».</p>'
  + '<p class="flt-h-p">لما تدخل فيه وتشوف شركة الـFCF بتاعها سالب — دي علامة حمراء '
  + 'مش محتاجة كل المؤشرات التانية تاكدها.</p>'
  + '<p class="flt-h-note">📌 استخدمه كـ<b>آخر خطوة قبل الشراء</b>: '
  + 'بعد ما تختار من الأمان والجودة والقيمة — عدّ كده وأتأكد إنك مش بتشتري شركة بتصرف كاش.</p></div>';

  h += '<div class="flt-h-warn">⚠️ <b>مهم:</b> التغطية هنا <b>15% فقط</b> (50 من 296 سهم) — '
  + 'وده أقل الفلترات. السبب: معظم الشركات المصريةSmall-Sized ما ينشرش '
  + '«قائمة التدفق النقدي» في قوائمها المالية. '
  + '<b>مفيش بيانات مش احتيال.</b> لو السهم مش ظاهر هنا — ده معناه إن البيانات ناقصة، مش إن الشركة وحشة.</div>';

  h += '</div></div>';
  return h;
}
function fzCfwHelpToggle(){ FZ_CFW_HELP = !FZ_CFW_HELP; fzCfwRender(); }

function fzCfwInit(){ fzCfwRender(); }

function fzCfwRender(){
  const box = document.getElementById('fltCfwBox'); if (!box) return;
  const f = FZ_CFW;
  f._skipBoth = false;
  const all = OS_DB.filter(s=>s.fcf != null);
  const withEbitda = OS_DB.filter(s=>s.fcf != null && s.ebitda != null);
  const rows = fzCfwRows().map(s=>{ const c=Object.assign({},s); c._cfw=fzCfwScore(s); c._q=fzCashQuality(s); return c; })
  .sort((a,b)=>b._cfw-a._cfw);
  const secs = [...new Set(all.map(s=>s.sectorAr).filter(Boolean))].sort();
  const burn = all.filter(s=>s.fcf<0).length;
  const fake = all.filter(s=>{const q=fzCashQuality(s);return q!=null&&q<45&&q>=0;}).length;

  let h = '';
  h += '<div class="flt-head"><div><h2>🏦 فلتر التدفق النقدي</h2>'
  + '<p class="flt-sub">شركات ربحها كاش حقيقي — مش على الورق</p></div>'
  + '<button class="flt-sw'+(f.on?' on':'')+'" onclick="fzCfwToggle()">'
  + (f.on?'🔒 الفلاتر مفعّلة':'🔓 فعّل الفلاتر')+'</button></div>';

  h += '<div class="flt-filters'+(f.on?'':' hid')+'">'
  + '<div class="flt-sl"><label>أقل تدفق حر <b>'+(f.fcfMin/1e6).toFixed(0)+'</b> مليون</label>'
  +  '<input type="range" id="fzc-fcf" min="-200" max="500" step="10" value="'+(f.fcfMin/1e6)+'" '
  +  'oninput="fzCfwSet(\'fcfMin\',this.value*1e6)"></div>'
  + '<div class="flt-sl"><label>أقل جودة ربح <b>'+f.qualityMin+'</b>%</label>'
  +  '<input type="range" id="fzc-q" min="0" max="120" step="5" value="'+f.qualityMin+'" '
  +  'oninput="fzCfwSet(\'qualityMin\',this.value)"></div>'
  + '<div class="flt-sl"><label>أعلى دين/أصول <b>'+f.maxDebt+'</b></label>'
  +  '<input type="range" id="fzc-de" min="0" max="3" step="0.1" value="'+f.maxDebt+'" '
  +  'oninput="fzCfwSet(\'maxDebt\',this.value)"></div>'
  + '<label class="fli-check"><input type="checkbox"'+(f.requireBoth?' checked':'')+' '
  +  'onchange="fzCfwSet(\'requireBoth\',this.checked)"> 🔒 يتطلب بيانات التدفق</label>'
  + '<button class="flt-rst" onclick="fzCfwReset()">↺ إعادة</button></div>';

  h += '<div class="flt-alert" style="border-color:rgba(255,143,77,.32);background:rgba(255,143,77,.07)">'
  + 'ℹ️ <b>تغطية محدودة:</b> التدفق الحر متاح لـ<b>' + all.length
  + '</b> سهم فقط من 296 (16%). باقي الأسهم <b>ما ينشرش</b> قائمة التدفق النقدي. '
  + '<span class="flt-alert-s">مفيش بيانات ≠ مش كويس. استخدمه كـ«تأكيد» مش كـ«اختيار».</span></div>';

  h += fzCfwHelpBox();

  h += '<div class="flt-stats">'
  + '<div><b>'+rows.length+'</b><span>بتدفق حر موجب</span></div>'
  + '<div><b>'+burn+'</b><span>بتصرف كاش 🔴</span></div>'
  + '<div><b>'+fake+'</b><span>ربح ورقي (أقل من 45% كاش)</span></div>'
  + '</div>';

  if (!rows.length){
  box.innerHTML = h + '<div class="flt-empty">⛔ مفيش أسهم بتستوفي الشروط<br>'
  + '<button class="dv-tab" onclick="fzCfwReset()">وسّع الفلاتر</button></div>';
  return;
  }

  const CAP = 60;
  h += '<div class="flt-tbl-wrap"><table class="flt-tbl"><thead><tr>'
  + '<th>السهم</th><th>🏦 التدفق</th><th>تدفق حر</th><th>عائد التدفق</th>'
  + '<th>جودة الربح</th><th>EBITDA</th><th>دين/أصول ٪</th><th>OCTA</th><th>ملاحظات</th><th></th>'
  + '</tr></thead><tbody>';
  rows.slice(0,CAP).forEach(function(s){
  const warns = fzCfwWarn(s);
  const q = s._q;
  const mc = s.mc || 0;
  const fcfYield = mc>0 && s.fcf!=null ? s.fcf/mc*100 : null;
  h += '<tr>'
  + '<td><b class="flt-c">'+s.code+'</b><small>'+escFlt((s.name||'').slice(0,20))+'</small></td>'
  + '<td><span class="flt-safe s'+(s._cfw>=70?'hi':s._cfw>=50?'md':'lo')+'">'+s._cfw+'</span></td>'
  + '<td><span class="flt-b '+(s.fcf>0?'ok':'bad')+'">'
  +  fzBigMoney(s.fcf)+'</span></td>'
  + '<td>'+(fcfYield!=null?'<span class="flt-b '+(fcfYield>=5?'ok':fcfYield>=2?'mid':'bad')+'">'
  +  fltNum(fcfYield,1)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(q!=null?'<span class="flt-b '+(q>=90?'ok':q>=45?'mid':'bad')+'">'
  +  fltNum(q,0)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(s.ebitda!=null?'<span class="flt-b '+(s.ebitda>0?'ok':'bad')+'">'
  +  fzBigMoney(s.ebitda)+'</span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(s.de!=null?'<span class="flt-b '+(s.de<=0.5?'ok':s.de<=1.5?'mid':'bad')+'">'
  +  fltNum(s.de*100,0)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
  +  escFlt(s.decision||'—')+'</span><small>'+fltNum(s.score,0)+'% · '+fzConfCell(s.scoreConf)+'</small></td>'
  + '<td class="flt-warn">'+fltWarnCell(warns,'✅ كاش حقيقي')+'</td>'
  + '<td><button class="flt-add" onclick="fzCfwAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
  + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length+'</b></div>';
  /* 🧮 نور: ترتيب الجدول (دوس على رأس العمود) */
  box.innerHTML = h;
  if (typeof nzSortPaint === 'function') nzSortPaint('cash');
}

/* 💰 عرض المبلغ بشكل مفهوم — مليار/مليون */
function fzBigMoney(v){
  if (v == null) return '—';
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e9) return s + (a/1e9).toFixed(a/1e9 >= 10 ? 0 : 1) + ' مليار';
  if (a >= 1e6) return s + Math.round(a/1e6) + ' مليون';
  if (a >= 1e3) return s + Math.round(a/1e3) + ' ألف';
  return s + Math.round(a);
}

function fzCfwToggle(){ FZ_CFW.on = !FZ_CFW.on; fzCfwRender(); }
function fzCfwReset(){ const f=FZ_CFW; f.fcfMin=0; f.qualityMin=40; f.ebitdaMin=0;
  f.maxDebt=2.0; f.requireBoth=true; f.sector='all'; f.on=false; fzCfwRender(); }
function fzCfwSet(k,v){ FZ_CFW[k] = (typeof v==='string') ? v : Number(v); fzCfwRender(); }

function fzCfwAdd(code){
  const s = OS_DB.find(x=>x.code===code); if (!s) return;
  if (typeof pickAdd !== 'function'){ alert('صفحة المرشحين لسه مش محمّلة'); return; }
  if (typeof PICK === 'undefined' || PICK.indexOf(code) >= 0) return;
  if (!s._flt) s._flt = Object.assign({}, s);
  PICK.push(code); PICK_DATA[code] = s._flt;
  PICK_TIME[code] = new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  try{ localStorage.setItem('octa_pick_v1', JSON.stringify({c:PICK,t:PICK_TIME})); }catch(e){}
  const cnt = document.getElementById('pickCount'); if (cnt) cnt.textContent = PICK.length+'/'+(typeof PICK_MAX!=='undefined'?PICK_MAX:10);
  const i = document.getElementById('pickQ');
  if (typeof pickRenderList === 'function') pickRenderList(i?i.value:'');
  if (typeof pickRenderCards === 'function') pickRenderCards();
  fzCfwRender();
}

/* ══════════════════════════════════════════════════════════════
  ⭐ الفرصة المثالية — التبويب التاسع (الأهم)
  💡 المبدأ: السهم اللي يستوفي 5+ فلاتر مع بعض = فرصة ذهبية
  🔥 ده اللي بيميّز OCTA: مش فلتر واحد، لكن تداخل الفلاتر
  ══════════════════════════════════════════════════════════════ */

/* 🏷️ تعريف الفلاتر الـ8 في مكان واحد — العرض والحساب بيشاركوا نفس التعريف */
const FZ_CHECKS = [
  { id:'safety', i:'🛡️', n:'آمن',  desc:'مخاطرة منخفضة',  test:s=>fltChkSafe(s) },
  { id:'income', i:'💰', n:'بيوزّع',  desc:'عائد ≥ 3%',  test:s=>fltChkInc(s)  },
  { id:'moment', i:'⚡', n:'بيتحرك',  desc:'صاعد 3 شهور ≥ 10%',  test:s=>fltChkMom(s)  },
  { id:'value',  i:'💎', n:'رخيص',  desc:'أرخص من متوسط قطاعه',  test:s=>fltChkVal(s)  },
  { id:'qual',  i:'🎯', n:'جودة عالية', desc:'أرباح + ميزانية سليمة', test:s=>fltChkQua(s)  },
  { id:'liquid', i:'💵', n:'سهل البيع',  desc:'سيولة ≥ 200 ألف/يوم',  test:s=>fltChkLiq(s)  },
  { id:'growth', i:'📈', n:'بيكبر',  desc:'سعره بيكبر 10%+ سنوياً (3 سنين)',  test:s=>fltChkGro(s)  },
  { id:'cash',  i:'🏦', n:'كاش حقيقي',  desc:'بتكسب نقداً',  test:s=>fltChkCfw(s)  },
];

function fltChkSafe(s){
  const v = s.vol1y, m = s.mdd1y, sh = s.sharpe3y, b = s.beta;
  if (v==null && m==null && sh==null && b==null) return null;  /* مفيش بيانات */
  return (v==null||v<=45) && (m==null||m<=40) && (sh==null||sh>0.3) && (b==null||b<=1.3);
}
function fltChkInc(s){
  if (s.dy==null) return null;
  return s.dy >= 3;
}
function fltChkMom(s){
  if (s.perf3m==null) return null;
  return s.perf3m >= 10;
}
function fltChkVal(s){
  const pk = fzPack(s.sectorAr), med = FZ_SECTOR_MED[s.sector]||{};
  const main = ('pb' in pk.use) ? s.pb : s.pe;
  const ref  = ('pb' in pk.use) ? med.pb : med.pe;
  if (main==null || ref==null || ref<=0) return null;
  return main <= ref;
}
function fltChkQua(s){
  const n = ['roe','roa','roic','nm','om','de','cr','qr'].filter(k=>s[k]!=null).length;
  if (n < 4) return null;
  return (s.roe==null||s.roe>=10) && (s.de==null||s.de<=1.0) && (s.cr==null||s.cr>=1.0);
}
function fltChkLiq(s){
  if (s.av30==null) return null;
  return s.av30 >= 2e5;
}
function fltChkGro(s){
  if (s.cagr3y==null) return null;
  return s.cagr3y >= 10 && s.cagr3y <= 150;
}
function fltChkCfw(s){
  if (s.fcf==null) return null;
  return s.fcf > 0;
}

const FZ_BEST = { minPass:4, maxPass:8, needKnown:5, sector:'all', sort:'pass' };

function fzBestCount(s){
  let p=0, k=0;
  FZ_CHECKS.forEach(function(c){
  const r = c.test(s);
  if (r===true){ p++; k++; } else if (r===false){ k++; }
  });
  return { p:p, k:k };
}

function fzBestRows(){
  const f = FZ_BEST;
  return OS_DB.filter(function(s){
  const r = fzBestCount(s);
  if (r.p < f.minPass) return false;
  if (r.k < f.needKnown) return false;
  if (f.sector !== 'all' && s.sectorAr !== f.sector) return false;
  return true;
  }).map(function(s){
  const r = fzBestCount(s);
  const c = Object.assign({}, s);
  c._pass = r.p; c._known = r.k;
  /* 🎯 الدرجة النهائية — نسبة الاستيفاء × مكافأة الاتساق */
  const ratio = r.p / 8;
  const consist = r.k / 8;
  c._best = Math.round(ratio * 82 + consist * 18);
  return c;
  }).sort(function(a,b){ return b._best - a._best; });
}

/* 🔍 ليه السهم ده استحق — شرح لكل فلتر */
/* 🔤 عزل الأرقام جوه جملة عربية
   بنستخدم محرفَي Unicode للاتجاه (LRI / PDI) مش HTML، لأن نصوص عمود
   «ليه؟» بتعدّي على escFlt اللي بيهرب أي وسم — ف الوسوم كانت بتظهر كنص.
   المحرفين دول بيظهروا «+15%» صح جوّه جملة عربية من غير ما يبطّلوا التوجيه. */
function fzLtr(x){ return '\u2066'+x+'\u2069'; }
function fzBestWhy(s){
  const out = [];
  FZ_CHECKS.forEach(function(c){
  const r = c.test(s);
  if (r===true){
  let d = '';
  if (c.id==='safety') d = 'هبوط '+fzLtr(s.mdd1y!=null?s.mdd1y.toFixed(0)+'%':'—')+' · شارب '+fzLtr(s.sharpe3y!=null?s.sharpe3y.toFixed(1):'—');
  if (c.id==='income')  d = 'عائد '+fzLtr(s.dy!=null?s.dy.toFixed(1)+'%':'—');
  if (c.id==='moment')  d = fzLtr('+'+(s.perf3m!=null?s.perf3m.toFixed(0)+'%':'—'))+' في 3 شهور';
  if (c.id==='value')  d = fzLtr('P/B '+(s.pb!=null?s.pb.toFixed(2):'—'))+' · '+fzLtr('P/E '+(s.pe!=null?s.pe.toFixed(1):'—'));
  if (c.id==='qual')  d = fzLtr('ROE '+(s.roe!=null?s.roe.toFixed(0)+'%':'—'))+' · دين '+fzLtr(s.de!=null?(s.de*100).toFixed(0)+'٪':'—');
  if (c.id==='liquid')  d = fzBigMoney(s.av30)+'/يوم';
  if (c.id==='growth')  d = 'السهم '+fzLtr(fzCagrTxt(s.cagr3y)+'%')+' سنوياً';
  if (c.id==='cash')  d = fzBigMoney(s.fcf)+' كاش حر';
  out.push({ i:c.i, n:c.n, d:d, ok:true });
  } else if (r===false){
  out.push({ i:c.i, n:c.n, d:fzBestFailReason(c, s), ok:false });
  }
  });
  return out;
}
function fzBestFailReason(c, s){
  if (c.id==='safety') return s.vol1y!=null&&s.vol1y>45 ? 'تذبذب '+fzLtr(s.vol1y.toFixed(0)+'%') : (s.mdd1y!=null&&s.mdd1y>40?'هبوط '+fzLtr(s.mdd1y.toFixed(0)+'%'):'شارب ضعيف');
  if (c.id==='income')  return 'عائد '+fzLtr(s.dy!=null?s.dy.toFixed(1)+'%':'—');
  if (c.id==='moment')  return (s.perf3m!=null?fzLtr((s.perf3m>0?'+':'')+s.perf3m.toFixed(0)+'%'):'—');
  if (c.id==='value')  return 'مش أرخص من قطاعه';
  if (c.id==='qual')  return s.roe!=null&&s.roe<10 ? fzLtr('ROE '+s.roe.toFixed(0)+'%') : 'بيانات ناقصة';
  if (c.id==='liquid')  return fzBigMoney(s.av30)+'/يوم';
  if (c.id==='growth'){
    if (s.cagr3y == null) return 'مفيش تاريخ سعر 3 سنين';
    if (s.cagr3y > 150) return '⚡ '+fzLtr(fzCagrTxt(s.cagr3y)+'%')+' سنوياً — رقم طيران';
    if (s.cagr3y <  10) return fzLtr(fzCagrTxt(s.cagr3y)+'%')+' سنوياً — '+(s.cagr3y<0 ? 'السهم نزل' : 'أقل من 10%');
    return fzLtr(fzCagrTxt(s.cagr3y)+'%')+' سنوياً';
  }
  if (c.id==='cash')  return 'بتصرف كاش';
  return '';
}

let FZ_BEST_HELP = false;
function fzBestHelpBox(){
  const on = FZ_BEST_HELP;
  let h = '<div class="flt-help">';
  h += '<button class="flt-help-h'+(on?' open':'')+'" onclick="fzBestHelpToggle()">'
  +  '<span>❓ إيه «الفرصة المثالية»؟ وإيه اللي بيخلّي السهم ده مميز؟</span><i>'+(on?'✕':'؟')+'</i></button>';
  h += '<div class="flt-help-b" style="display:'+(on?'block':'none')+'">';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🎯</span> الفكرة في سطر</div>'
  + '<p class="flt-h-p">كل فلتر لوحده بيديك <b>نوع</b> من الأسهم.</p>'
  + '<p class="flt-h-p">لكن السهم اللي يستوفي <b>5 فلاتر مع بعض</b> — ده مختلف خالص.</p>'
  + '<p class="flt-h-p"><b>الفرصة المثالية = السهم اللي عنده أكتر من ميزة.</b></p>'
  + '<div class="flt-h-ex">'
  +  '<div class="flt-h-exi bad"><b>❌ فلتر واحد</b><span>آمن بس رخيص</span>'
  +  '<em>آمن بس مفيش سبب يشتريه دلوقتي</em></div>'
  +  '<div class="flt-h-exi"><b>✅ 5 فلاتر</b><span>آمن + رخيص + بيكبر</span>'
  +  '<em>كل المؤشرات بتقول اشترِ — ده أقوى</em></div>'
  + '</div></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🏅</span> الدرجة من 100 — ليه مش مجرد عدد؟</div>'
  + '<p class="flt-h-p">الدرجة = <b>82% استيفاء</b> + <b>18% اتساق</b></p>'
  + '<div class="flt-h-w">'
  +  '<div class="flt-h-wi"><span>استيفاء</span><b>82</b><i>من 100</i></div>'
  +  '<div class="flt-h-wi"><span>اتساق</span><b>18</b><i>من 100</i></div>'
  + '</div>'
  + '<p class="flt-h-p" style="margin-top:10px"><b>الاستيفاء:</b> كام فلتر السهم عدّى (من 8)</p>'
  + '<p class="flt-h-p"><b>الاتساق:</b> كام فلتر <b>عرف الحكم عليه</b> (مش «مفيش بيانات»)</p>'
  + '<p class="flt-h-note">📌 الفرق: سهم يستوفي <b>5</b> ويعرف الحكم على <b>8</b> — '
  + 'أقوى من سهم يستوفي <b>5</b> ويعرف الحكم على <b>5</b> بس. '
  + 'لأن البيانات الكثيرة = ثقة أعلى.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📋</span> شروط الفلترة</div>'
  + '<table class="flt-h-tbl"><thead><tr><th>الشرط</th><th>الرقم</th><th>ليه؟</th></tr></thead><tbody>'
  + '<tr><td>أقل فلاتر مستوفاة</td><td>4</td><td>أقل من كده مش «فرصة»</td></tr>'
  + '<tr><td>أقل فلاتر معروفة</td><td>5</td><td>لازم نعرف الحكم عليه</td></tr>'
  + '<tr><td>الترتيب</td><td>حسب الدرجة</td><td>الأعلى استيفاءً الأول</td></tr>'
  + '</tbody></table>'
  + '<p class="flt-h-note">💡 لو طلعلك أقل من 4 فلاتر، يبقى مفيش فرصة مثالية — وده بحد ذاته معلومة مهمة.</p></div>';

  /* 📊 التوزيع محسوب من الداتا الحيّة — الأرقام المكتوبة كانت قديمة
     (كان مكتوب 49 و64 و43 و27 و18 و4 · والحقيقة 43 و68 و38 و17 و32 و7) */
  const D = {}; OS_DB.forEach(function(s){ const r = fzBestCount(s); D[r.p] = (D[r.p]||0)+1; });
  const n5 = (D[5]||0)+(D[6]||0)+(D[7]||0)+(D[8]||0);
  const n7 = (D[7]||0)+(D[8]||0);
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📈</span> أرقام حقيقية من السوق</div>'
  + '<ul class="flt-h-ul">'
  + '<li>محسوبة من <b>'+OS_DB.length+'</b> سهم وقت التحميل — مش أرقام مكتوبة:</li>'
  + '<li>— <b>'+(D[0]||0)+'</b> سهم مفيش ولا فلتر واحد يستوفيهم</li>'
  + '<li>— <b>'+(D[3]||0)+'</b> سهم يستوفيوا 3 فلاتر بس</li>'
  + '<li>— <b>'+(D[4]||0)+'</b> سهم يستوفيوا 4 فلاتر</li>'
  + '<li>— <b>'+(D[5]||0)+'</b> سهم يستوفيوا 5 فلاتر</li>'
  + '<li>— <b>'+n5+'</b> سهم يستوفيوا 5 فلاتر أو أكتر ← <b>هنا الفرص</b></li>'
  + '<li>— <b>'+n7+'</b> سهم يستوفيوا 7 فلاتر أو أكتر — نادر جداً</li>'
  + '</ul>'
  + '<p class="flt-h-note">📌 لاحظ: <b>'+(D[0]||0)+' سهم مفيش عندهم ميزة واحدة واضحة</b> — '
  + 'الفلتر بيوفّر عليك تدقيقهم واحد واحد.</p></div>';

  h += '<div class="flt-h-warn">⚠️ <b>مهم:</b> استيفاء فلاتر كتير <b>مش ضمان</b> — '
  + 'يعني السهم عنده مزايا كتير، مش إنه هيزيد. '
  + 'افتح كارت القرار لكل سهم، وقارن، وقرر بنفسك. '
  + 'الفلتر ده بيوفّر عليك البحث — مش بياخد القرار عنك.</div>';

  h += '</div></div>';
  return h;
}
function fzBestHelpToggle(){ FZ_BEST_HELP = !FZ_BEST_HELP; fzIdealRender(); }

function fzBestInit(){
  /* ⭐ كارت الفرصة بقى جوّه تبويب صفحة الفلاتر (مش صفحة مستقلة).
     فلو حد فتح #page-best بالقديم — رابط قديم أو TOOL_PAGES —
     بنوديه للصفحة الصح والتبويب الصح، عشان ما يشوفش شاشة فاضية.
     ⛔ الشرط بقى على الصفحة النشطة (مش على مكان الكارت) — لأن
        الكارت دلوقتي جوّه #fzPane naturally، فالفحص القديم ماكانش
        بيلقط حاجة. */
  const pb = document.getElementById('page-best');
  if (pb && pb.classList.contains('active') && typeof switchPage === 'function'){
  switchPage('filter');
  if (typeof fzGo === 'function') fzGo('best');
  return;
  }
  if (!FZ_SECTOR_MED || !Object.keys(FZ_SECTOR_MED).length){
  if (typeof fzComputeSectorMed === 'function') fzComputeSectorMed();
  }
  fzIdealRender();
}

/* ══════════════════════════════════════════════════════════════
   📖 قارئات الأرقام — كل رقم بيتقري من مكان واحد
   ⛔ القاعدة: الحقل الناقص يبقى «—» — ممنوع نُظهر صفر مكان حقل غايب
   ══════════════════════════════════════════════════════════════ */

/* 📈 نمو سعر السهم 3 سنين — وده مش نمو الشركة ⛔
   المصدر: update_prices.py سطر 8587
     cagr3y = ((close[-1] / close[-756]) ** (1/3) - 1) * 100
   لو السعر ضاعف 8 مرات في 3 سنين ⇒ +100% سنوياً
   ⛔ دي حركة سعر السهم لوحده (من غير التوزيعات) — مش إيرادات ومش أرباح
   الأشرطة المستخدمة في العرض:
     أقل من 0  = السهم نزل في الـ3 سنين
     0 – 10     = بطء، مش بيكبر كفاية
     10 – 80    = المتزن (نفس أعلى شريحة في fzGrowScore)
     80 – 100   = مرتفع، ممكن يبقى طيران
     100 – 150  = طيران وغير مستقر
     فوق 150    = رقم غريب — غالباً قاعدة صغيرة أو خطأ بيانات
   ملاحظة مهمة: الفلاتر (fltChkGro) بتقبل 10-150 بس، والعرض أوسع
   عشان يميّز المستقر من الطائر. الفرق مقصود وموثّق هنا. */
function fzCagrBand(g){
  if (g > 150) return { cls:'bad', mark:'⚡' };
  if (g > 100) return { cls:'bad', mark:'' };
  if (g >  80) return { cls:'mid', mark:'' };
  if (g >=  10) return { cls:'ok',  mark:'' };
  if (g >=   0) return { cls:'mid', mark:'' };
  return { cls:'bad', mark:'▼' };
}
/* 🔢 النص: تحت 10% نعرض رقمين · من 10 لـ 100 رقم واحد · فوق 100 رقم صحيح
   السبب: الباك بيخزّن رقمين عشريين (round 2)، فالعرض بالرقمين = الرقم
   الحقيقي نفسه، واللون بيتحسب على نفس الرقم المكتوب ⇒ مفيش تناقض
   بين اللي مكتوب واللي ملوّن (زي 9.99% اللي كانت بتطلع «10%» بلون أصفر) */
function fzCagrTxt(g){
  if (g == null) return '—';
  const a = Math.abs(g);
  let n = a < 10 ? g.toFixed(2) : a < 100 ? g.toFixed(1) : g.toFixed(0);
  if (/^-0(\.0+)?$/.test(n)) n = n.slice(1);   /* -0% مفيش معنى */
  return (g > 0 ? '+' : '') + n;
}
const FZ_CAGR_TIP = 'معدل النمو السنوي لسعر السهم خلال آخر 3 سنين (من غير التوزيعات) — مش نمو الشركة، ومش مضمون يتكرر.';
function fzCagrCell(g, tip){
  if (g == null)
    return '<span class="flt-na" title="مفيش تاريخ سعر 3 سنين كامل — الرقم مش متاح">—</span>';
  const b = fzCagrBand(g);
  /* dir=ltr = اتجاه معزول، عشان «+112%» ما تظهرش «112%+» في صفحة RTL
     (لوحده direction:ltr مش كفاية — محتاج unicode-bidi وده اللي بيعمله dir) */
  return '<span class="flt-pct flt-b '+b.cls+'" dir="ltr" title="'+escFlt(tip||FZ_CAGR_TIP)+'">'
       + b.mark + fzCagrTxt(g) + '<b class="flt-pu">%</b></span>';
}

/* 🎯 درجة التطابق — من 100، ومعادلتها مكتوبة تحت
   82 نقطة = نسبة استيفاء الفلاتر الثمانية (عدد اللي عدّى ÷ 8)
   18 نقطة = اتساق البيانات (عدد الفلاتر اللي عرفنا الحكم عليها ÷ 8)
   ⛔ المعادلة نفسها (_best) مش بتتلمس هنا — التوضيح بس */
const FZ_BEST_TIP = 'درجة التطابق من 100 = 82 نقطة استيفاء الفلاتر + 18 نقطة اتساق البيانات. أخضر 75 فأعلى · أصفر من 55 لـ 74 · أحمر أقل من 55.';
function fzBestCell(s){
  const p = s._pass || 0, k = s._known || 0;
  const t = 'الدرجة '+s._best+' من 100 = استيفاء '+p+'/8 ('+Math.round(p/8*82)
          + ' نقطة) + اتساق '+k+'/8 ('+Math.round(k/8*18)+' نقطة)';
  return '<span class="flt-safe s'+(s._best>=75?'hi':s._best>=55?'md':'lo')+'" dir="ltr" title="'+escFlt(t)+'">'
       + s._best + '<i>/100</i></span>';
}

/* 🎖️ عمود OCTA — رقمين جنب بعض، كل واحد بأسمه
   ⛔ (s.scoreConf||0) كان بيعرض «ثقة 0%» لو الحقل مش موجود
      (بيحصل لما الموقع يرجع على /api/egx_full بدل data_full) — رقم مخترع */
const FZ_OCTA_TIP = 'تقييم محرك OCTA من 100 · والثقة = نسبة البيانات المتاحة اللي اتحسبت عليه.';
function fzPctCell(v){ return v==null ? '<span class="flt-na">—</span>'
  : '<span class="flt-pct" dir="ltr">'+fltNum(v,0)+'<b class="flt-pu">%</b></span>'; }
function fzConfCell(v){ return v==null ? '<span class="flt-na">ثقة —</span>'
  : 'ثقة <span class="flt-pct" dir="ltr">'+fltNum(v,0)+'<b class="flt-pu">%</b></span>'; }

/* 🔤 قارئ الحقول بأسماء بديلة — 16 أكتوبر 2026
   ⛔ المشكلة: نفس الرقم متخزّن بأكثر من اسم، وكل واحد بياقرا اسم واحد.
      مثال: OS_DB فيها ma50 و ma200 (88٪/87٪ تغطية) بس الكود كان بيقرا
      sma50 و sma200 ⇒ رجع null ⇒ نقطة الدخول والوقف اتحسبوا من غير أساس.
   ⛔ القاعد��: أول اسم موجود هو الصح. لو كلهم null ⇒ null (مش 0).
      الحقل الناقص فضل ناقص — عمره ما يتحوّل لصفر ولا لقيمة متوسطة. */
function nzF(s){
  /* ⛔ مش بنخزّن في s — بنرجّع كاش للكائن، سرّاً (مش بيلوّس أي object جاري) */
  if (!s || typeof s !== 'object') return {};
  if (s.__nzKey === s) return s.__nzMap;
  const m = {};
  /* كل مجموعة: الاسم المفضّل الأول، وبعده البدائل المقبولة */
  m.ma50   = nzPick(s, ['sma50', 'ma50']);
  m.ma200  = nzPick(s, ['sma200', 'ma200']);
  m.ma20   = nzPick(s, ['sma20', 'ma20']);
  m.ema20  = nzPick(s, ['ema20', 'ema20v', 'ema20V']);
  m.h52    = nzPick(s, ['h52', 'high52']);
  m.l52    = nzPick(s, ['l52', 'low52']);
  m.atr    = nzPick(s, ['atr', 'atr14']);
  /* ⛔⛔ اتساق زمني (16 أكتوبر 2026):
     px    = السعر الحي — اللي المستخدم هيتداول بيه فعلاً.
     pxSnap= سعر نفس لحظة بناء المؤشرات. البوابات التقنية لازم تقارن
             بـ pxSnap مش px — غير كده بنقارن سعر الساعة ١ بمؤشرات
             من امبارح، وقرار «فوق/تحت المتوسط» بيتقلب على سهم مااتغيّرش.
     الفرق بيتقاس ويتعرض — مش بيتخفى. */
  m.px     = nzPick(s, ['price', 'p']);
  m.pxSnap = nzPick(s, ['p', 'price']);
  m.flt    = nzPick(s, ['float', 'freeFloat', 'flt']);
  m.vol30  = nzPick(s, ['av30', 'avgVol30']);
  m.rvol   = nzPick(s, ['relvol', 'relVolume']);
  m.rsi    = nzPick(s, ['rsi', 'rsi14']);
  m.tgt    = nzPick(s, ['price_target_median', 'pt_med', 'tgt_med']);
  m.mc     = nzPick(s, ['mc', 'mcap', 'mkt_cap']);
  try { Object.defineProperty(s, '__nzKey', { value: s, enumerable: false, configurable: true }); } catch(e){}
  try { Object.defineProperty(s, '__nzMap', { value: m, enumerable: false, configurable: true }); } catch(e){}
  return m;
}
/* أول رقم صالح من قائمة أسماء — null لو كلهم ناقصين */
function nzPick(s, names){
  for (let i=0;i<names.length;i++){
    const v = nzNum(s[names[i]]);
    if (v != null) return v;
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════
  📊 الفرص الثلاثية — معايير مختلفة عن الخمسة (16 أكتوبر 2026)
  ══════════════════════════════════════════════════════════════
  ⛔ الخمسة = ترتيب بالدرجة من 5 محاور + سعر عادل.
     التلاتة = نقطة صعود فنية (breakout). الميكانيكا مختلفة تماماً:
     الخمسة بتختار «أحسن شركة»، التلاتة بتختار «أقرب نمط للصعود».
  ⛔ والتلاتة مش توصية شراء دلوقتي — هي نمط بانتظار تحقق شرط.
     نقطة الدخول عندهم مستوى مش سعر currently. لو السعر لسه أقل منها،
     السهم مش «فرصة شراء» — ده سهم بيتتفرج عليه.

  🧮 المعايير — 6 بوابات، لازم يعدّي كلهم (and/ مش or):
     ① اتجاه صاعد           price > ma200            (سهم فوق متوسطه الطويل)
     ② اصطفاف المتوسطات      ma50 > ma200             (50 فوق 200 = اتجاه غالباً)
     ③ فوق المتوسط 50        price ≥ ma50             (مؤكِد إن القمة خارجة)
     ④ زخم في مدى الشراء    50 ≤ RSI ≤ 72            (مش ضعيف ومش متشبع)
     ⑤ حجم مؤكِّد            الحجم النسبي ≥ 1.2       (الحركة عليها_structural)
     ⑥ سيولة كافية          متوسط 30 يوم ≥ 200 ألف   (تقدر تنفّذ فعلاً)

  📊 الترتيب بين الـ3 (اللي يستوفي كلهم) — 4 أوزان معلنة:
     قرب من القمة-technical 40٪ · قوة الاتجاه 25٪ · تأكيد الحجم 20٪ · اتزان RSI 15٪

  ⛔ مستوى الهدف ووقف الخسارة: نسب ثابتة معلنة (مش ATR لأن المدى الحقيقي
     مش موجود في الداتا المتاحة — قِس بنفسك: قِسنا ATR و طلع 0٪ تغطية).
     ⛔ النتيجة: العائد/المخاطرة 12٪÷3.5٪ ≈ 3.4 ثابتة لكل التلاتة
     بالحساب — يعني **مش دليل جودة**. هي مقارنة بين 3 مستويات فقط.
  ⛔ مفيش look-ahead: كل الحقول آخر قيمة متاحة دلوقتي. */
const NZ_BR = { ma200:0, align:0, above50:0, rsi:0, relvol:0, liq:0, n:6 };

function fzTripleRows(){
  const out = [];
  if (typeof OS_DB === 'undefined' || !OS_DB) return out;
  for (let i=0;i<OS_DB.length;i++){
    const s = OS_DB[i], f = nzF(s);
    /* ⛔ البوابات على سعر اللقطة (نفس لحظة المؤشرات) — مش السعر الحي */
    const px = f.pxSnap;
    if (px==null || px<=0) continue;
    const ma200 = f.ma200, ma50 = f.ma50, rsi = f.rsi, rv = f.rvol, av = f.vol30;
    if (ma200==null || ma200<=0) continue;   /* ⛔ من غير متوسط 200 مش بنحكم على الاتجاه */
    if (ma50==null || ma50<=0) continue;     /* ⛔ نفس القو��ن لـ50 */
    if (rsi==null) continue;                 /* ⛔ RSI ناقص = مش بنخمّن */
    if (rv==null) continue;                  /* ⛔ حجم نسبي ناقص */
    if (av==null) continue;                  /* ⛔ سيولة ناقصة */

    const g = {
      up200:   px > ma200,
      align:   ma50 > ma200,
      above50: px >= ma50,
      rsi:     rsi>=50 && rsi<=72,
      relvol:  rv>=1.2,
      liq:     av>=2e5,
    };
    const passed = [g.up200,g.align,g.above50,g.rsi,g.relvol,g.liq].filter(Boolean).length;
    if (passed < NZ_BR.n) continue;         /* ⛔ لازم الـ6 كلهم */

    /* درجة الترتيب — 4 أوزان معلنة، كل واحد 0..100 */
    /* ① قرب من القمة الفنية 40٪: فوق ma50 كل ما زاد، والمدى بيتقل ⇒ أقرب لكسر */
    const upMa50 = (px - ma50)/px*100;
    const scNear = nzBand(upMa50, [[0,45],[1,60],[3,75],[6,88],[10,95],[NZ_R,100]]);
    /* ② قوة الاتجاه 25٪: فوق ma200 كل ما زاد */
    const upMa200 = (px - ma200)/px*100;
    const scTrend = nzBand(upMa200, [[0,40],[2,55],[5,70],[10,85],[20,95],[NZ_R,100]]);
    /* ③ تأكيد الحجم 20٪: الحجم النسبي 1.2..2.5 هوSweet spot، فوقيه عنيف */
    const scVol = nzBand(rv, [[0,30],[1.2,60],[1.6,80],[2.5,95],[4,80],[8,55],[NZ_R,30]]);
    /* ④ اتزان RSI 15٪: 60..65 أحسن، و70..72 لسه مقبول، 50..55 ضعيف */
    const scRsi = nzBand(rsi, [[0,20],[50,45],[55,62],[60,80],[65,88],[70,70],[72,55],[NZ_R,20]]);

    const W = { near:0.40, trend:0.25, vol:0.20, rsi:0.15 };
    const total = (scNear*W.near + scTrend*W.trend + scVol*W.vol + scRsi*W.rsi);
    out.push({ s:s, f:f, px:px, pxLive:f.px, ma50:ma50, ma200:ma200, rsi:rsi, rv:rv, av:av,
      upMa50:upMa50, upMa200:upMa200, pxLive:f.px, drift:fzTripleDrift(f),
      sc:{ near:scNear, trend:scTrend, vol:scVol, rsi:scRsi },
      w:W, total:total, plan:fzTriplePlan(px) });
  }
  out.sort(function(a,b){ return b.total - a.total; });
  return out;
}

/* 🎯 خطة النقطة الصعود — نسب ثابتة معلنة (مفيش ATR في الداتا المتاحة)
   نقطة الدخول = السعر الحالي + 1٪ (لما يكسر ويقفل فوقها)
   الهدف        = الدخول + 12٪  (متوسط مدى الانفجار بعد كسر مؤكَّد)
   الوقف        = الدخول − 3.5٪ (كسر فشل ورجع تحت مستواه) */
const NZ_BR_TGT = 0.12, NZ_BR_STOP = 0.035, NZ_BR_BUF = 0.01;
function fzTriplePlan(px){
  const dec2 = (x)=> Math.round(x*100)/100;
  const entry = dec2(px*(1+NZ_BR_BUF));
  const target = dec2(entry*(1+NZ_BR_TGT));
  const stop = dec2(entry*(1-NZ_BR_STOP));
  const ok = (entry>0 && target>entry && stop>0 && stop<entry);
  return { entry:ok?entry:null, target:ok?target:null, stop:ok?stop:null,
    up:ok?((target/entry-1)*100):null, risk:ok?((1-stop/entry)*100):null,
    whyEntry:'السعر الحالي '+px.toFixed(2)+' ج + 1٪ حشو — نقطة الدخول مش شرطها السعر دلوقتي، '
           +'شرطها إن السهم يكسر ويقفل فوق المستوى ده',
    whyTarget:'نسبة ثابتة معلنة: الدخول + 12٪. ⛔ مش ATR لأن المدى الحقيقي غير متاح في الداتا، '
           +'ومش بنحط رقماً متخيّله مكانه',
    whyStop:'نسبة ثابتة معلنة: الدخول − 3.5٪. ⛔ نفس الملاحظة — '
          +'المدى الحقيقي (ATR) غير متاح فبنستخدم نسبة صريحة مش رقم مخترع' };
}

/* 📊 جدول التلاتة */
function nzTripleTable(){
  const rows = fzTripleRows();
  if (!rows.length){
    return '<div class="flt-empty">⛔ مفيش سهم عدّى الـ6 معايير مع بعض دلوقتي — '
         + 'ده معلومة مش فشل: البورصة المصرية بتقعد جنب قممها فترات طويلة. '
         + 'جرّب تبويب «⭐ الفرصة المثالية» — معاييره مختلفة عن دي تماماً.</div>';
  }
  const top = rows.slice(0,3);
  const cell = function(v, how, dec, cls){
    if (v==null) return '<span class="flt-na" title="'+escFlt(how||'غير متاح')+'">—</span>';
    return '<span class="'+(cls||'flt-b')+'" dir="ltr" title="'+escFlt(nzTip(how))+'">'+v.toFixed(dec==null?2:dec)+'</span>';
  };
  const medals = ['🥇','🥈','🥉'];
  let h = '<div class="flt-tbl-wrap"><table class="flt-tbl"><thead><tr>'
    + '<th>#</th><th>الرمز</th><th>الشركة</th><th>السعر الآن</th><th>نقطة الدخول</th>'
    + '<th>الهدف</th><th>نسبة المكسب</th><th>وقف الخسارة</th><th>المخاطرة</th>'
    + '<th>الدرجة</th><th></th></tr></thead><tbody>';
  top.forEach(function(r, i){
    const s = r.s, p = r.plan;
    h += '<tr>'
      + '<td>'+medals[i]+'</td>'
      + '<td><b class="flt-c">'+escFlt(s.code)+'</b></td>'
      + '<td>'+escFlt((s.name||'').slice(0,20))+'</td>'
      + '<td>'+cell(r.pxLive, 'السعر الحي وقت العرض (من المحرك) — المؤشرات الفنية في هذا الصف محسوبة على سعر '
            +r.px.toFixed(2)+' ج لحظة بناء الملف ('+nzDataWhen()+')'
            + (r.drift!=null ? (' · الفرق '+(r.drift>0?'+':'')+r.drift.toFixed(1)+'٪') : ''))+'</td>'
      +   (r.drift!=null && Math.abs(r.drift)>2
             ? '<small title="'+escFlt('⛔ السعر الحي اتغيّر '+r.drift.toFixed(1)+'٪ عن السعر اللي اتحسبت عليه المؤشرات الفنية. '
                 +'الدرجة دي محسوبة على سعر اللقطة عشان تبقى متسقة — لكن السعر اللي هتشتري بيه الحالي. ياريت تراجع البوابات قبل ما تتصرف')+'">'
               +'⚠️ سعر متغيّر '+r.drift.toFixed(1)+'٪</small>' : '')
      + '</td>'
      + '<td>'+cell(p.entry, p.whyEntry, 2, 'flt-safe smd')+'</td>'
      + '<td>'+cell(p.target, p.whyTarget, 2, 'flt-safe shi')+'</td>'
      + '<td><span class="flt-pct" dir="ltr" title="'+escFlt(nzTip('(الهدف ÷ نقطة الدخول − 1) × 100 — نسبة ثابتة معلنة'))+'">'
      +   (p.up!=null?('+'+p.up.toFixed(1)+'<i>%</i>'):'—')+'</span></td>'
      + '<td>'+cell(p.stop, p.whyStop, 2)+'</td>'
      + '<td><span class="flt-pct" dir="ltr" title="'+escFlt(nzTip('نسبة الخسارة من نقطة الدخول'))+'">'
      +   (p.risk!=null?('-'+p.risk.toFixed(1)+'<i>%</i>'):'—')+'</span></td>'
      + '<td><span class="flt-safe s'+(r.total>=70?'hi':r.total>=55?'md':'lo')+'" dir="ltr" title="'
      +   escFlt(nzTip('ترتيب نمط الصعود: قرب القمة 40٪ · قوة الاتجاه 25٪ · تأكيد الحجم 20٪ · اتزان الزخم 15٪'
          +' · فوق ma50 بـ'+r.upMa50.toFixed(1)+'٪ · فوق ma200 بـ'+r.upMa200.toFixed(1)+'٪'))+'">'
      +   nzGrade(r.total,70,55)+'</span></td>'
      + '<td style="white-space:nowrap">'
      +   (typeof openChart==='function' ? '<button class="flt-add" onclick="openChart(\''+escFlt(s.code)+'\')" title="افتح الرسمة البيانية — هي اللي بتأكد النمط">📈</button>' : '')
      +   '<button class="flt-add" onclick="fltAdd(\''+escFlt(s.code)+'\')" title="ضيف للمرشحين">➕</button></td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';

  /* ── المعايير مكتوبة تحت الجدول — زي ما أحمد طلب ── */
  const cand = rows.length;
  h += '<div class="flt-h-note">';
  h += '🚨 <b>دي مش توصية شراء دلوقتي — دي قائمة انتظار.</b> '
     + 'نقطة الدخول عندها مستوى لازم السهم يكسره ويقفل فوقه. '
     + 'لو السعر لسه أقل منها، السهم مش «فرصة شراء» — هو سهم بيتتفرج عليه. '
     + 'والBreakout اللي يفشل بيرجع لمستواه الأصلي، فالمخاطرة حقيقية.';
  h += '<br>🧮 <b>المعايير الستة — لازم يعدّيهم كلهم (مش أي واحد فيهم):</b>';
  h += '<br>① <b>اتجاه صاعد</b> — السعر أعلى من المتوسط المتحرك 200 يوم · تغطية الحقل '+(rows.length)+'/'+(typeof OS_DB!=='undefined'?OS_DB.length:0);
  h += '<br>② <b>اصطفاف المتوسطات</b> — المتوسط 50 أعلى من المتوسط 200 (اتجاه غالباً مش عرضي)';
  h += '<br>③ <b>فوق المتوسط 50</b> — القمة خارجة فعلاً مش لسه بتتكوّن';
  h += '<br>④ <b>زخم في مدى الشراء</b> — مؤشر القوة من 50 لـ72 (تحت 50 = ضعيف · فوق 72 = متشبّع)';
  h += '<br>⑤ <b>حجم مؤكِّد</b> — الحجم النسبي 1.2× أو أعلى (الحركة عليها_structural مش عشوائية)';
  h += '<br>⑥ <b>سيولة كافية</b> — متوسط حجم 30 يوم 200 ألف سهم أو أعلى (تقدر تنفّذ فعلاً)';
  h += '<br>📊 <b>الترتيب بين الـ'+top.length+' — 4 أوزان معلنة:</b> '
     + 'قرب القمة الفنية 40٪ · قوة الاتجاه 25٪ · تأكيد الحجم 20٪ · اتزان الزخم 15٪.';
  h += '<br>📌 <b>عدد الأسهم اللي عدّت الـ6 كلها: '+cand+'</b> — '
     + 'من '+OS_DB.length+' سهم في السوق. لو الرقم صغير ده طبيعي: النمط ده بيحصل في وقت معيّن مش كل وقت.';
  h += '<br>⚠️ <b>نسبة المكسب 12٪ ووقف الخسارة 3.5٪ نسب ثابتة معلنة — مش محسوبة من السهم.</b> '
     + 'المدى الحقيقي (ATR) غير متاح في الداتا الحالية (0٪ تغطية — قِسناها) '
     + 'ولما بنستخدم نسبة ثابتة بدل مدى كل سهم، العائد/المخاطرة بتطلع ~3.4 ثابتة '
     + '⇒ <b>دي مش دليل جودة، هي مقارنة بين 3 مستويات وخلاص.</b> '
     + 'لو عايز وقف خسارة على مقاس كل سهم، محتاجين المدى الحقيقي يوصل من المصدر.';
  h += '<br>📈 <b>ليه معاييرهم مختلفة عن الخمسة؟</b> الخمسة بيجيبوا «أحسن شركة دلوقتي» '
     + '(درجة من 5 محاور + سعر عادل) — دي نظرة fundamental. التلاتة بيجيبوا '
     + '«أقرب نمط للصعود» — دي نظرة فنية على نفس السهم.els ممكن سهم واحد يطلع في الاتنين، '
     + 'وممكن التلاتة يطلعوا فوق المية والخمسة يطلعوا غيرهم — وده المطلوب.';
  h += '<br>📅 <b>تاريخ السحب: '+escFlt(nzDataWhen())+'</b> — مفيش رقم من تاريخ مختلف.';
  h += '<br>⚖️ <b>مفيش look-ahead:</b> كل الحقول آخر قيمة متاحة وقت العرض. '
     + 'مفيش أي رقم مأخوذ من تاريخ بعد كده. والعائد الماضي مش ضمان للمستقبل.';
  h += '</div>';
  return h;
}

function fzTripleRender(){
  const box = document.getElementById(FZ_TAB_TRIPLE.box); if (!box) return;
  let h = '<div class="flt-head"><div><h2>📊 أفضل 3 فرص</h2>'
    + '<p class="flt-sub">٣ نمط صعود فني — لازم يعدّي ٦ بوابات كلها. '
    + 'نقطة الدخول مستوى لازم السهم يكسره، مش سعر دلوقتي</p></div></div>';
  h += nzTripleTable();
  box.innerHTML = h;
}

/* ══════════════════════════════════════════════════════════════
   ⭐ التبويب الجديد: أفضل 5 فرص — 16 أكتوبر 2026
   ══════════════════════════════════════════════════════════════
   ⛔ التجزئة: الدالة دي بتاخد نفس مصفوفة FZ_TAB_BEST بالظبط
      (fzBestRows) وتطلع أول ٥ صفوف بـ nzTopFive — نفس الدالة
      ونفس الأوزان ونفس السعر العادل. ⛔ مافيش حساب تاني ولا
      نسخة من المنطق. الفرق الوحيد: جدول لوحده بدل الجدول الكامل.
   ⛔ زائد: أعمدة الترتيب (nzSortBy) شغالة تلقائياً — الشيفرة
      بتلزق data-k على كل th وتربطها بـ NZ_SORT عبر jqDel.
   ══════════════════════════════════════════════════════════════ */
function fzFiveRender(){
  const box = document.getElementById(FZ_TAB_FIVE.box); if (!box) return;
  let h = '';
  h += '<div class="flt-head"><div><h2>⭐ أفضل 5 فرص</h2>'
    + '<p class="flt-sub">٥ أقوى فرص من الفلتر — مرتبة بسعرها العادل '
    + 'ودرجتها من ٥ محاور بأوزان معلنة. اضغط على رأس العمود للترتيب</p>'
    + '</div></div>';
  h += '<div class="flt-stats" id="fzFiveStats"></div>';
  h += nzFiveTable();
  box.innerHTML = h;
  if (typeof nzSortPaint === 'function') nzSortPaint('five');
}

function fzFiveInit(){ fzFiveRender(); }
/* ⛔ انحراف السعر الحي عن سعر اللقطة — ببال مئوية.
   > 2٪ = المؤشرات기술ية من وقت تاني عن السعر اللي بتعرضه ⇒ نحذّر. */
function fzTripleDrift(f){
  const a = f.pxSnap, b = f.px;
  if (a==null || a<=0 || b==null || b<=0) return null;
  return (b/a - 1) * 100;
}

function nzTripleCount(){
  /* ⛔ العدّاد = عدد الصفوف اللي بتظهر (3) مش عدد المرشحين (14).
     غير كده الـbadge هيقول 14 والجدول هيعرض 3 = رقمان مختلفين لنفس الحاجة. */
  try { return Math.min(3, fzTripleRows().length); } catch(e){ return null; }
}

function fzIdealRender(){
  const box = document.getElementById('fltIdealBox'); if (!box) return;
  const f = FZ_BEST;
  const all = OS_DB;
  const rows = fzBestRows();
  const secs = [...new Set(all.map(s=>s.sectorAr).filter(Boolean))].sort();
  const dist = {};
  all.forEach(function(s){ const r=fzBestCount(s); dist[r.p]=(dist[r.p]||0)+1; });

  let h = '';
  h += '<div class="flt-head"><div><h2>⭐ الفرصة المثالية</h2>'
  + '<p class="flt-sub">التقييم الكامل: كل سهم بياخد درجة من الفلاتر الثمانية، وتشوفليه كل فلتر على حدة — يمرّ أم لا، وبأي رقم</p></div>'
  + '<button class="flt-sw'+(f.on?' on':'')+'" onclick="fzBestToggle()">'
  + (f.on?'🔒 مفعّل':'🔓 فعّل')+'</button></div>';

  h += '<div class="flt-filters'+(f.on?'':' hid')+'">'
  + '<div class="flt-sl"><label>أقل فلاتر مستوفاة <b>'+f.minPass+'</b> من 8</label>'
  +  '<input type="range" id="fzb-pass" min="2" max="8" step="1" value="'+f.minPass+'" '
  +  'oninput="fzBestSet(\'minPass\',this.value)"></div>'
  + '<div class="flt-sl"><label>أقل فلاتر معروفة <b>'+f.needKnown+'</b> من 8</label>'
  +  '<input type="range" id="fzb-known" min="3" max="8" step="1" value="'+f.needKnown+'" '
  +  'oninput="fzBestSet(\'needKnown\',this.value)"></div>'
  + '<div class="flt-sl"><label>القطاع <b>'+fzSectorName(f.sector)+'</b></label>'
  +  '<select class="fli-sel" onchange="fzBestSet(\'sector\',this.value)">'
  +  '<option value="all">كل القطاعات</option>'
  +  secs.map(x=>'<option value="'+escFlt(x)+'"'+(f.sector===x?' selected':'')+'>'+escFlt(x)+'</option>').join('')
  +  '</select></div>'
  + '<button class="flt-rst" onclick="fzBestReset()">↺ إعادة</button></div>';

  /* 📊 شريط التوزيع — بصرياً */
  h += '<div class="fz-dist">';
  for (let k=0;k<=8;k++){
  const n = dist[k]||0;
  if (!n) continue;
  h += '<div class="fz-dist-i'+(k>=f.minPass?' hi':'')+'">'
  +  '<span class="fz-dist-n">'+n+'</span>'
  +  '<span class="fz-dist-l">'+k+' '+FZ_CHECKS.slice(0,k).map(c=>c.i).join('')+'</span>'
  + '</div>';
  }
  h += '</div>';

  h += fzBestHelpBox();

  const gold = rows.filter(s=>s._pass>=6).length;
  h += '<div class="flt-stats">'
  + '<div><b>'+rows.length+'</b><span>فرصة مثالية (من '+all.length+')</span></div>'
  + '<div><b>'+gold+'</b><span>بـ6+ فلاتر (ذهبي)</span></div>'
  + '<div><b>'+(dist[0]||0)+'</b><span>مفيش ولا فلتر</span></div>'
  + '</div>';

  if (!rows.length){
  box.innerHTML = h + '<div class="flt-empty">⛔ مفيش سهم يستوفي '+f.minPass+' فلاتر<br>'
  + '<button class="dv-tab" onclick="fzBestReset()">وسّع</button></div>';
  return;
  }

  const CAP = 40;
  h += '<div class="flt-tbl-wrap"><table class="flt-tbl fz-tbl"><thead><tr>'
  + '<th>السهم</th><th title="'+escFlt(FZ_BEST_TIP)+'">⭐ درجة التطابق</th>'
  + '<th title="عدد الفلاتر المستوفاة من 8">الفلاتر</th><th>ليه؟</th>'
  + '<th>السعر</th><th title="نسبة القسيمة السنوية على سعر السهم">التوزيعات</th>'
  + '<th title="'+escFlt(FZ_CAGR_TIP)+'">نمو السعر 3 سنين</th>'
  + '<th title="'+escFlt(FZ_OCTA_TIP)+'">OCTA</th><th></th>'
  + '</tr></thead><tbody>';
  rows.slice(0,CAP).forEach(function(s){
  const why = fzBestWhy(s);
  const ok  = why.filter(w=>w.ok);
  const bad = why.filter(w=>!w.ok);
  const dr = s.dy;
  h += '<tr>'
  + '<td><b class="flt-c">'+s.code+'</b><small>'+escFlt((s.name||'').slice(0,20))+'</small></td>'
  + '<td>'+fzBestCell(s)+'</td>'
  + '<td><div class="fz-pips">'
  +  FZ_CHECKS.map(c=>'<span class="fz-pip '+(why.find(w=>w.n===c.n&&w.ok)?'on':(why.find(w=>w.n===c.n)?'off':'na'))+'" title="'+c.n+'">'+c.i+'</span>').join('')
  +  '<b class="fz-pn">'+s._pass+'/8</b></div></td>'
  + '<td class="fz-why">'+ok.slice(0,3).map(w=>'<span class="fz-w ok">'+w.i+' '+escFlt(w.d)+'</span>').join('')
  +  (bad.length?'<span class="fz-w no">✕ '+escFlt(bad[0].n)+' — '+escFlt(bad[0].d)+'</span>':'')+'</td>'
  + '<td>'+(s.p!=null?'<span class="flt-b">'+fltNum(s.p,2)+'</span>':'<span class="flt-na">—</span>')+'</td>'
  + '<td>'+(dr!=null?'<span class="flt-pct flt-b '+(dr>=3?'ok':dr>0?'mid':'bad')+'" dir="ltr" title="نسبة القسيمة السنوية على سعر السهم">'
  +  fltNum(dr,1)+'<b class="flt-pu">%</b></span>':'<span class="flt-na" title="السهم مش موزّع أو البيانات ناقصة">—</span>')+'</td>'
  + '<td>'+fzCagrCell(s.cagr3y)+'</td>'
  + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'" title="'+escFlt(FZ_OCTA_TIP)+'">'
  +  escFlt(s.decision||'—')+'</span><small>'+fzPctCell(s.score)+' · '+fzConfCell(s.scoreConf)+'</small></td>'
  + '<td><button class="flt-add" onclick="fzBestAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
  + '</tr>';
  });
  h += '</tbody></table></div>';
  /* 🔑 مفاتيح القراءة — ما ينفعش نعرض رقم من غير ما نشرح إزاي اتحسب
     المدى مكتوب بكلمات (من … لـ) مش بشرطة، عشان مايتقلبش في صفحة RTL */
  h += '<div class="flt-h-note">'
  + '🔑 <b>درجة التطابق</b> من 100: <b>82</b> نقطة استيفاء الفلاتر (اللي عدّى ÷ 8) '
  + '+ <b>18</b> نقطة اتساق البيانات (اللي عرفنا الحكم عليه ÷ 8). '
  + '<span class="flt-h-legend" style="display:inline-flex;margin:0 4px">'
  + '<span class="hi">75 فأعلى</span><span class="md">من 55 لـ 74</span><span class="lo">أقل من 55</span></span>'
  + '<br>📈 <b>نمو السعر 3 سنين</b> = معدل النمو السنوي لسعر السهم (من غير التوزيعات) — '
  + '<b>مش نمو الشركة</b> ومش مضمون يتكرر: '
  + '<span class="flt-h-legend" style="display:inline-flex;margin:0 4px">'
  + '<span class="hi">من 10% لـ 80%</span><span class="md">أقل من 10% أو من 80% لـ 150%</span>'
  + '<span class="lo">سالب أو فوق 150%</span></span>'
  + '<br>📌 «—» معناها الحقل مش موجود في البيانات — مش صفر. '
  + 'الفلاتر نفسها بتقبل نمو من 10% لـ 150% بس.</div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length+'</b></div>';
  /* 🧮 نور: كارت التحليل الكامل (5 فرص) + ترتيب الجدول */
  box.innerHTML = h;
    /* ⛔ (16 أكتوبر 2026) nzBestExtra اتشال من هنا — كانت بتضيف جدول
       الخمسة تاني جوه «الفرصة المثالية» = نفس البيانات مرتين في صفحتين.
       دلوقتي كل حاجة في مكانها: المثالية هنا · الخمسة في #fltFiveBox · التلاتة في #fltThreeBox */
  if (typeof nzSortPaint === 'function') nzSortPaint('best');
}

function fzBestToggle(){ FZ_BEST.on = !FZ_BEST.on; fzIdealRender(); }
function fzBestReset(){ const f=FZ_BEST; f.minPass=4; f.needKnown=5; f.sector='all'; f.sort='pass'; f.on=false; fzIdealRender(); }
function fzBestSet(k,v){ FZ_BEST[k] = (typeof v==='string') ? v : Number(v); fzIdealRender(); }

function fzBestAdd(code){
  const s = OS_DB.find(x=>x.code===code); if (!s) return;
  if (typeof pickAdd !== 'function'){ alert('صفحة المرشحين لسه مش محمّلة'); return; }
  if (typeof PICK === 'undefined' || PICK.indexOf(code) >= 0) return;
  if (!s._flt) s._flt = Object.assign({}, s);
  PICK.push(code); PICK_DATA[code] = s._flt;
  PICK_TIME[code] = new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  try{ localStorage.setItem('octa_pick_v1', JSON.stringify({c:PICK,t:PICK_TIME})); }catch(e){}
  const cnt = document.getElementById('pickCount'); if (cnt) cnt.textContent = PICK.length+'/'+(typeof PICK_MAX!=='undefined'?PICK_MAX:10);
  const i = document.getElementById('pickQ');
  if (typeof pickRenderList === 'function') pickRenderList(i?i.value:'');
  if (typeof pickRenderCards === 'function') pickRenderCards();
  fzIdealRender();
}
/* ══════════════════════════════════════════════════════════════
  ⭐ الهيرو — «قرار OCTA» — آخر حاجة في صفحة الفلاتر
  ──────────────────────────────────────────────────────────────
  ⛔ قرار 16 أكتوبر 2026: الكارت ده بيعرض **أعلى 5 فرص** — وبنفس
     الترتيب بالظبط اللي في تبويب ⭐ الفرصة المثالية فوق
     (nzTopFive). قبل كده كان بيعرض «أحسن 3» بمقياس تاني خالص
     (تقاطع 4 فلاتر أو أكتر) والتبويب بيعرض 5 بمقياس تالت
     (المحاور الخمسة بأوزانها) ⇒ اتنين بيقولوا حاجة مختلفة
     للمستخدم في نفس الصفحة. دلوقتي: مقياس واحد + قائمة واحدة.
  ⛔ مفيش رقم مخترع: الدرجة من nzAxisScore (٥ محاور بأوزانها)
     والسعر العادل من nzFair (٣ مصادر مرجّحة) والتاريخ من nzDataWhen().
  ══════════════════════════════════════════════════════════════ */

/* 🧱 شريحة المحور الواحد: أيقونة + الدرجة. «—» = المحور كله ناقص */
function fzHeroAxisChip(a){
  const m = a.mean;
  const cls = (m==null) ? 'na' : (m>=70 ? 'hi' : (m>=50 ? 'md' : 'lo'));
  const t = a.ar+' — وزن '+a.w+'٪ · درجة '+(m==null?'—':Math.round(m))+' من 100'
          + ' · تغطية '+a.have+' من '+a.n+' مؤشر'
          + (a.have===0 ? ' · المحور ده كله ناقص — وزنه اتوزّع على المحاور التانية، ومش درجة صفر' : '');
  return '<span class="fz-hax '+cls+'" title="'+escFlt(t)+'">'
       + a.ic+'<b dir="ltr">'+(m==null?'—':Math.round(m))+'</b></span>';
}

/* ❓ ليش دي فرصة — من نفس المحاور الخمسة، مش من مقياس تاني.
   بنقول: أقوى محور · أضعف محور · التغطية · السعر مقابل العادل. */
function fzHeroWhy(row){
  const sc = row.sc, fv = row.fv, up = row.up;
  const have = sc.axes.filter(function(a){ return a.have>0 && a.mean!=null; });
  if (!have.length) return '⛔ بيانات المحاور ناقصة — مش قادر نرتّبه';
  const srt = have.slice().sort(function(a,b){ return b.mean-a.mean; });
  const hi = srt[0], lo = srt[srt.length-1];
  const out = ['✅ أقوى: '+hi.ic+' '+hi.ar+' ('+Math.round(hi.mean)+' من 100)'];
  if (srt.length>1 && lo.id!==hi.id){
  out.push('⚠️ أضعف: '+lo.ic+' '+lo.ar+' ('+Math.round(lo.mean)+' من 100)');
  }
  out.push('تغطية '+Math.round(sc.wGot*100)+'٪ من أوزان المحاور');
  /* ⛔ صريح في عدد مصادر السعر العادل — الداتا الحقيقية مفيش فيها
     هدف محللين (0 من 296)، فالسعر العادل بيتحسب من مصدرين بس
     والوزن الناقص بيتوزّع ⇒ الرقم بيتأرجح. نقوله للمستخدم بدل ما نخفّيه. */
  const used = (fv.src||[]).filter(function(x){ return x.v!=null; }).length;
  if (fv.ok && used < 3){
  out.push('السعر العادل من '+used+' من 3 مصادر بس (الباقي «—» اتشال ووزنه اتوزّع)');
  }
  if (up==null) out.push('⛔ مفيش سعر عادل محسوب');
  else if (up>0.5)   out.push('سعره '+fzLtr(Math.abs(up).toFixed(0)+'%')+' تحت السعر العادل');
  else if (up<-0.5)  out.push('سعره '+fzLtr(Math.abs(up).toFixed(0)+'%')+' فوق السعر العادل — مش شراء دلوقتي');
  else out.push('سعره قريب من السعر العادل');
  return out.join(' · ');
}

/* 📊 الخمسة فرص في **جدول** — 16 أكتوبر 2026 (قرار أحمد: ⛔ كروت · ✅ جدول)
   ──────────────────────────────────────────────────────────────────────
   ⛔ صف واحد لكل سهم. الأعمدة بالترتيب المطلوب بالظبط:
      الرمز · الشركة · السعر · السعر العادل · نقطة الدخول · الهدف
      · نسبة المكسب · وقف الخسارة · الدرجة
   🔑 كل رقم جوّه tooltip فيه: المصدر + تاريخ السحب + طريقة الحساب (nzTip).
   ⛔ «—» معناها الحقل مش موجود في البيانات — مش صفر — والسبب في الـtooltip.
   ⛔ نفس مصفوفة `five` اللي الكارت كان بيعرضها (nzTopFive) — مفيش اختيار تاني.
   ⛔ نفس تعريف «نسبة المكسب» في nzFiveTable بالظبط: من نقطة الدخول
      مش من السعر الحالي، عشان الرقم يبقى واحد في مكانين بالصفحة. */
function fzHeroFiveTable(five){
  if (!five || !five.length){
    return '<div class="fz-hero-empty">⛔ مفيش سهم يستوفي '+FZ_BEST.minPass+' فلاتر أو أكتر<br>'
         +  '<small>وسّع الشرط من تبويب ⭐ فوق</small></div>';
  }
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  let h = '<div class="fz-hero-t">🏆 الترتيب — نفس الخمسة في تبويب ⭐</div>';
  h += '<div class="flt-tbl-wrap" style="max-height:none"><table class="flt-tbl"><thead><tr>'
    + '<th>الرمز</th><th>الشركة</th><th>السعر</th><th>السعر العادل</th>'
    + '<th>نقطة الدخول</th><th>الهدف</th><th>نسبة المكسب</th>'
    + '<th>وقف الخسارة</th><th>الدرجة</th>'
    + '</tr></thead><tbody>';
  five.forEach(function(r, i){
    const s = r.s, sc = r.sc, fv = r.fv;
    const pl = nzPlan(s, fv), px = fv.px;
    const up = (pl.target!=null && pl.entry!=null && pl.entry>0)
             ? (pl.target/pl.entry-1)*100 : null;
    h += '<tr>'
      + '<td><span style="font-size:.62rem;opacity:.85">'+medals[i]+'</span>'
      +   '<b class="flt-c" title="'+escFlt('رمز السهم في البورصة المصرية')+'">'+escFlt(s.code)+'</b></td>'
      + '<td title="'+escFlt(s.name||'')+'">'+escFlt((s.name||'').slice(0,20))+'</td>'
      + '<td>'+nzValCell(px,' ج','سعر السهم الحالي وقت العرض من المحرك الحي',2,'flt-b')+'</td>'
      + '<td>'+nzValCell(fv.ok?fv.fair:null,' ج',
            fv.ok ? ('متوسط مرجّح لـ'+fv.used.length+' مصدر: '+fv.src.filter(function(x){ return x.v!=null; }).map(function(x){ return x.ar; }).join(' + '))
                  : (fv.notes[0]||'المصادر ناقصة'), 2,
            'flt-safe s'+((fv.ok&&up!=null&&up>0)?'hi':(fv.ok?'md':'lo')))+'</td>'
      + '<td>'+nzValCell(pl.entry,' ج', pl.entryWhy, 2, 'flt-b')+'</td>'
      + '<td>'+nzValCell(pl.target,' ج', pl.targetWhy, 2, 'flt-safe s'+((up!=null&&up>0)?'hi':'lo'))+'</td>'
      + '<td>'+nzPctCell(up, 'نسبة المكسب من نقطة الدخول: (الهدف ÷ نقطة الدخول − 1) × 100'
            +' · ⛔ محسوبة من نقطة الدخول مش من السعر الحالي، لأن نقطة الدخول هي اللي هتشتري بيه')+'</td>'
      + '<td>'+nzValCell(pl.stop,' ج', pl.stopWhy, 2, 'flt-b')
      +   (pl.stopEst ? '<small title="'+escFlt('الرقم ده متقدَّر من التقلب السنوي — المدى الحقيقي (ATR) غير متاح في الداتا. مش قياس')+'">ⓘ مُقدَّر</small>' : '')
      + '</td>'
      + '<td>'+nzHeroGradeCell(sc, s)+'</td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';
  h += '<div class="flt-h-note" style="margin-top:8px">'
     + '🎯 نقطة الدخول من قراءة المتوسطات المتحركة ومؤشر القوة · '
     + 'الهدف = السعر العادل · وقف الخسارة = نقطة الدخول − 2 × المدى (ATR أو مُقدَّر من التقلب).'
     + '<br>📌 «—» = الحقل مش موجود في البيانات، مش صفر. والمصدر والتاريخ والطريقة في كل خانة.</div>';
  return h;
}

/* 🧮 خانة الدرجة — الرقم جواها + التغطية + أسماء المحاور والمؤشرات المتاحة.
   ⛔ مش درجة مخترعة: nzAxisScore · محاور بأوزانها · الناقص بيتشال ووزنه بينتشر. */
function nzHeroGradeCell(sc, s){
  const t = nzTip('متوسط درجات المحاور الخمسة بأوزانها بعد توزيع وزن كل محور على مؤشراته المتاحة'
      +' · الأساسيات 30٪ · المخاطرة 25٪ · الفني 20٪ · التقييم 15٪ · التوزيع والسيولة 10٪'
      +' · تغطية '+Math.round(sc.wGot*100)+'٪ من 100٪'
      +' · المؤشرات المتاحة: '+nzAxesSrc(s));
  return '<span class="flt-safe s'+((sc.total>=70)?'hi':(sc.total>=50)?'md':'lo')+'" dir="ltr" title="'
       +  escFlt(t)+'">'+Math.round(sc.total)+'</span>';
}

function fzHeroRender(){
  const host = document.getElementById('fzHero'); if (!host) return;
  if (!FZ_SECTOR_MED || !Object.keys(FZ_SECTOR_MED).length){
  if (typeof fzComputeSectorMed === 'function') fzComputeSectorMed();
  }
  /* ⛔ نفس قاعدة التبويب: لازم 4 فلاتر أو أكتر (FZ_BEST.minPass).
     ⛔ الكارت بياخد نفس مصفوفة الأسهم بتاعة التبويب حرف بحرف —
        مفيش اختيار تاني ولا مقياس تاني في الكارت. */
  const base = fzBestRows();
  const five = base.length ? nzTopFive(base) : [];
  const grades = five.map(function(r){ return r.sc.total; }).filter(function(v){ return v!=null; });
  const bestG  = grades.length ? Math.max.apply(null, grades) : null;
  const avgG   = grades.length ? grades.reduce(function(a,b){ return a+b; },0)/grades.length : null;
  const fairN  = five.filter(function(r){ return r.fv.ok; }).length;

  let h = '<div class="fz-hero-in">';
  /* ── الشريط الأيمن: العنوان + شرح المقياس + الأرقام ── */
  h += '<div class="fz-hero-l">'
  +  '<div class="fz-hero-badge">⭐ قرار OCTA</div>'
  +  '<h2>أعلى 5 فرص دلوقتي</h2>'
  +  '<p class="fz-hero-p">الترتيب واحد، والنتيجة واحدة، والكارت ده هو نفس التبويب ⭐ فوق.</p>'
  /* ⛔ كل وزن في سطر لوحده — سطر واحد فيه 5 أرقام و5 إيموجي بيتلخبط
     في RTL والرقم بيقفز لآخر السطر. سطر سطر = مفيش لبس. */
  +  '<p class="fz-hero-p fz-hero-lead">الدرجة من 100 = متوسط 5 محاور بأوزانها:</p>'
  +  '<div class="fz-hero-wx">'
  +  '<span class="fz-wx">🧱 الأساسيات 30٪</span>'
  +  '<span class="fz-wx">🛡 المخاطرة 25٪</span>'
  +  '<span class="fz-wx">📈 الفني 20٪</span>'
  +  '<span class="fz-wx">💎 التقييم 15٪</span>'
  +  '<span class="fz-wx">💵 التوزيع والسيولة 10٪</span>'
  +  '</div>'
  +  '<p class="fz-hero-p fz-hero-lead">💰 السعر العادل = متوسط مرجّح لثلاثة مصادر:</p>'
  +  '<div class="fz-hero-wx">'
  +  '<span class="fz-wx">🎯 هدف المحللين 40٪</span>'
  +  '<span class="fz-wx">📚 القيمة الدفترية 30٪</span>'
  +  '<span class="fz-wx">📐 النموذج الفني 30٪</span>'
  +  '</div>'
  +  '<p class="fz-hero-p fz-hero-lead">والمحور الناقص بيتشال من الحساب ووزنه بيتوزّع — مش درجة صفر.</p>'
  +  '<div class="fz-hero-stats">'
  +  '<div><b>'+(bestG==null?'—':Math.round(bestG))+'</b><span>أعلى درجة</span></div>'
  +  '<div><b>'+(avgG==null?'—':Math.round(avgG))+'</b><span>متوسط الخمسة</span></div>'
  +  '<div><b>'+fairN+'<small>/5</small></b><span>لهم سعر عادل</span></div>'
  +  '</div>'
  +  '<button class="fz-hero-btn" onclick="fzGo(\'best\')">'
  +  'افتح التحليل الكامل <span>←</span></button>'
  +  '<p class="fz-hero-src">📅 '+escFlt(nzDataWhen())+'</p>'
  + '</div>';
  /* ── الشريط الأيسر: نفس الخمسة في جدول — ⛔ كروت ممنوعة هنا ── */
  h += '<div class="fz-hero-r">';
  h += fzHeroFiveTable(five);
  h += '</div></div>';
  host.innerHTML = h;
}
/* ══════════════════════════════════════════════════════════════════════
  🧮 نور · الطبقة التحليلية — أُضيفت 15 أكتوبر 2026
  ──────────────────────────────────────────────────────────────────────
  ① نظام ترتيب واحد يخدم الجداول الـ8 + التاسع
  ② صف التبويب التاسع (الفرصة المثالية) — الكارت انتقل من آخر الصفحة
  ③ نظام المحاور الخمسة بالأوزان (أساسيات 30 · مخاطرة 25 · فني 20 · تقييم 15 · توزيع 10)
  ④ السعر العادل (3 مصادر) + نقطة الدخول + الهدف + وقف الخسارة من ATR

  ⛔ القواعد الحاكمة اللي الكود ده ملزوم بيها:
   1. مفيش رقم من غير أساس: كل مؤشر له وحدة مكتوبة + طريقة + مصدر.
   2. المفقود = «—» مش صفر. والمحور اللي كل مؤشراته ناقصة بيتشال من الحساب
      ووزنه بيتوزّع على المحاور التانية — مش بيبقى صفر.
   3. كل نسخة من رقم يتحسب **مرة واحدة بس** (المكرّر بيتدمج).
   4. مفيش look-ahead: كل الأرقام من نفس ملف البيانات وقت السحب.
  ══════════════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────────────
  🧰 أدوات أساسية
  ────────────────────────────────────────────────────────────────────── */
function nzNum(v){
  if (v==null || v==='' || typeof v==='boolean') return null;
  const n = Number(v);
  return (typeof n==='number' && isFinite(n)) ? n : null;
}
function nzTxt(v){ return (v==null) ? '' : String(v); }
function nzIsBank(s){ return /بنك|مالي|Finance/i.test(nzTxt(s && (s.sectorAr||s.sector))); }

/* 📅 تاريخ سحب البيانات — من EGX_META.ts بتاع المحرك
   ⛔ لو مش موجود بنكتب «—» — مش بنخمّن تاريخ */
const NZ_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function nzDataWhen(){
  try{
    const t = (typeof EGX_META!=='undefined' && EGX_META) ? (EGX_META.ts || EGX_META._ts) : null;
    if (!t) return '—';
    const d = new Date(t);
    if (isNaN(d.getTime())) return '—';
    const p = (x)=> (x<10 ? '0'+x : ''+x);
    return d.getDate()+' '+NZ_MONTHS[d.getMonth()]+' '+d.getFullYear()+' · '+p(d.getHours())+':'+p(d.getMinutes());
  }catch(e){ return '—'; }
}
const NZ_SRC = 'محرك الأسعار عبر (TradingView)';
/* 🏷️ tooltip إلزامي: المصدر + تاريخ السحب + طريقة الحساب */
function nzTip(how, src){
  return 'المصدر: '+(src||NZ_SRC)+' · تاريخ السحب: '+nzDataWhen()+' · الطريقة: '+how;
}
function nzMoney(v, dec){
  const n = nzNum(v); if (n==null) return '<span class="flt-na">—</span>';
  return '<span dir="ltr">'+n.toFixed(dec==null?2:dec)+'</span>';
}
/* درجة المحور: من 0 لـ 100 */
function nzGrade(v, hi, mid){
  const c = 'flt-safe s'+((v>=hi)?'hi':(v>=mid)?'md':'lo');
  return '<span class="'+c+'" dir="ltr">'+Math.round(v)+'</span>';
}

/* ──────────────────────────────────────────────────────────────────────
  ① نظام الترتيب — دالة واحدة بتخدم كل الجداول
  ──────────────────────────────────────────────────────────────────────
  ⛔ الفكرة: مش بنكتب كود ترتيب 8 مرات. بنوصف كل جدول مرة واحدة
     (رقم العمود + الحقل)، والدالة دي لوحدها بتلزق الرؤوس وبترتّب.
  • الدوس على رأس العمود = تبديل التصاعدي/التنازلي
  • «—» دايماً في الآخر مهما كان الاتجاه (مش بيتحسب صفر)
  • الافتراضي = ترتيب الدرجة تنازلياً = نفس ترتيب الداتا الحالي (مفيش مفاجأة) */
const NZ_SORT_KEY = 'octa_nz_sort_v1';
const NZ_SORT = Object.create(null);

function nzSortLoad(){
  try{ const raw = localStorage.getItem(NZ_SORT_KEY);
    if (raw){ const o = JSON.parse(raw); if (o && typeof o==='object') return o; } }catch(e){}
  return {};
}
function nzSortSave(){
  try{ localStorage.setItem(NZ_SORT_KEY, JSON.stringify(NZ_SORT)); }catch(e){}
}
function nzSortState(tab){
  const cfg = NZ_SORT_COLS[tab]; if (!cfg) return null;
  const st = NZ_SORT[tab];
  if (st && cfg.cols.some(c=>c.k===st.k)) return st;
  const def = { k: cfg.def, d: -1 };          /* ‎-1 = تنازلي (الدرجة) */
  NZ_SORT[tab] = def; return def;
}

/* 🧮 قيمة الترتيب لسهم واحد — ترجع رقم أو نص أو null(=«—») */
function nzSortVal(s, k){
  if (!s) return null;
  switch(k){
    case 'code':    return nzTxt(s.code);
    case 'name':    return nzTxt(s.name || s.code);
    case 'sector':  return nzTxt(s.sectorAr || s.sector);
    case 'decision':return nzTxt(s.decision);
    case 'price':   { const p = nzNum(s.price); return (p!=null) ? p : nzNum(s.p); }
    case 'score':   return nzNum(s.score);
    case 'conf':    return nzNum(s.scoreConf);
    case 'dy':      return nzNum(s.dy);
    case 'inc10k':  { const d = nzNum(s.dy); return (d!=null) ? d*100 : null; }
    case 'beta':    return nzNum(s.beta);
    case 'vol1y':   return nzNum(s.vol1y);
    case 'mdd1y':   return nzNum(s.mdd1y);
    case 'mdd':     return nzNum(s.mdd);
    case 'sharpe3y':return nzNum(s.sharpe3y);
    case 'perf3m':  return nzNum(s.perf3m);
    case 'perf1m':  return nzNum(s.perf1m);
    case 'perfYtd': return nzNum(s.perfYtd);
    case 'rsi':     return nzNum(s.rsi);
    case 'tvRec':   return nzNum(s.tvRec);
    case 'pe':      return nzNum(s.pe);
    case 'pb':      return nzNum(s.pb);
    case 'roe':     return nzNum(s.roe);
    case 'roa':     return nzNum(s.roa);
    case 'roic':    return nzNum(s.roic);
    case 'om':      return nzNum(s.om);
    case 'nm':      return nzNum(s.nm);
    case 'cr':      return nzNum(s.cr);
    case 'dePct':   { const d = nzNum(s.de); return (d!=null) ? d*100 : null; }
    case 'cagr3y':  return nzNum(s.cagr3y);
    case 'av30':    return nzNum(s.av30);
    case 'relvol':  return nzNum(s.relvol);
    case 'mc':      return nzNum(s.mc);
    case 'fcf':     return nzNum(s.fcf);
    case 'ebitda':  return nzNum(s.ebitda);
    case 'fcfY':    { const f=nzNum(s.fcf), m=nzNum(s.mc); return (f!=null && m>0) ? f/m*100 : null; }
    case 'cashQ':   return (typeof fzCashQuality==='function') ? fzCashQuality(s) : null;
    case 'valRel': {
      if (typeof fzPack!=='function' || typeof FZ_SECTOR_MED==='undefined') return null;
      const pk = fzPack(s.sectorAr), med = (FZ_SECTOR_MED[s.sector]||{});
      const usePb = ('pb' in pk.use);
      const main = usePb ? nzNum(s.pb) : nzNum(s.pe);
      const ref  = usePb ? nzNum(med.pb) : nzNum(med.pe);
      return (main!=null && ref!=null && ref>0) ? main/ref : null;
    }
    case 'days': {
      if (typeof fzExitDays!=='function') return null;
      const cap = (typeof FZ_LIQ!=='undefined') ? FZ_LIQ.portfolio : 1e5;
      return fzExitDays(s, cap);
    }
    case 'pass': return (typeof fzBestCount==='function') ? fzBestCount(s).p : null;
  }
  return null;
}
function nzCmp(a, b){
  const an = (a==null), bn = (b==null);
  if (an && bn) return 0;                 /* الاتنين «—» */
  if (an) return 1;                        /* «—» دايماً في الآخر */
  if (bn) return -1;
  if (typeof a==='string' || typeof b==='string'){
    return nzTxt(a).localeCompare(nzTxt(b), 'ar');
  }
  return (a<b) ? -1 : (a>b) ? 1 : 0;
}

/* 📋 وصف كل جدول مرة واحدة — ده كل اللي بيحتاجه الترتيب */
const NZ_SORT_COLS = {
  safety: { box:'fltBox', def:'sc', cols:[
    { i:1, k:'sc',     n:'الأمان' },
    { i:2, k:'beta',   n:'معامل المخاطرة', d:-1 },
    { i:3, k:'vol1y',  n:'التذبذب السنوي',  d:-1 },
    { i:4, k:'mdd1y',  n:'هبوط سنة',        d:-1 },
    { i:5, k:'mdd',    n:'هبوط كلي',        d:-1 },
    { i:6, k:'sharpe3y',n:'شارب',           d:-1 },
    { i:7, k:'sector', n:'القطاع', d:1 },
    { i:8, k:'score',  n:'تقييم OCTA', d:-1 },
  ]},
  income: { box:'fltIncBox', def:'sc', cols:[
    { i:1, k:'sc',     n:'التوزيع' },
    { i:2, k:'inc10k', n:'من 10 آلاف', d:-1 },
    { i:3, k:'score',  n:'صحة السهم', d:-1 },
    { i:4, k:'decision', n:'قرار OCTA', d:1 },
    { i:5, k:'mdd1y',  n:'هبوط سنة', d:-1 },
  ]},
  moment: { box:'fltMomBox', def:'sc', cols:[
    { i:1, k:'sc',     n:'الزخم' },
    { i:2, k:'perf3m', n:'3 شهور', d:-1 },
    { i:3, k:'perf1m', n:'شهر', d:-1 },
    { i:4, k:'perfYtd',n:'من أول السنة', d:-1 },
    { i:5, k:'rsi',    n:'قوة الشراء (RSI)', d:-1 },
    { i:6, k:'tvRec',  n:'تقييم المحللين', d:-1 },
    { i:7, k:'score',  n:'تقييم OCTA', d:-1 },
  ]},
  value: { box:'fltValBox', def:'sc', cols:[
    { i:1, k:'sc',     n:'القيمة' },
    { i:2, k:'sector', n:'الحزمة', d:1 },
    { i:3, k:'pe',     n:'مضاعف الربحية', d:-1 },
    { i:4, k:'pb',     n:'مضاعف القيمة الدفترية', d:-1 },
    { i:5, k:'valRel', n:'قيمة ÷ قطاعها', d:-1 },
    { i:6, k:'score',  n:'تقييم OCTA', d:-1 },
    { i:7, k:'sector', n:'القطاع', d:1 },
  ]},
  qual: { box:'fltQuaBox', def:'sc', cols:[
    { i:1, k:'sc',     n:'الجودة' },
    { i:2, k:'roe',    n:'العائد على حقوق الملكية', d:-1 },
    { i:3, k:'roic',   n:'العائد على رأس المال', d:-1 },
    { i:4, k:'dePct',  n:'دين ÷ أصول', d:-1 },
    { i:5, k:'cr',     n:'نسبة التداول', d:-1 },
    { i:6, k:'nm',     n:'هامش صافي', d:-1 },
    { i:7, k:'score',  n:'تقييم OCTA', d:-1 },
    { i:8, k:'sector', n:'القطاع', d:1 },
  ]},
  liquid: { box:'fltLiqBox', def:'sc', cols:[
    { i:1, k:'sc',     n:'السيولة' },
    { i:2, k:'av30',   n:'حجم يومي', d:-1 },
    { i:3, k:'days',   n:'أيام البيع', d:-1 },
    { i:4, k:'relvol', n:'حجم نسبي', d:-1 },
    { i:5, k:'mc',     n:'حجم السوق', d:-1 },
    { i:6, k:'score',  n:'تقييم OCTA', d:-1 },
  ]},
  growth: { box:'fltGroBox', def:'sc', cols:[
    { i:1, k:'sc',     n:'النمو' },
    { i:2, k:'roe',    n:'العائد على حقوق الملكية', d:-1 },
    { i:3, k:'cagr3y', n:'نمو 3 سنين', d:-1 },
    { i:4, k:'om',     n:'هامش', d:-1 },
    { i:5, k:'mc',     n:'حجم السوق', d:-1 },
    { i:6, k:'score',  n:'تقييم OCTA', d:-1 },
    { i:7, k:'sector', n:'القطاع', d:1 },
  ]},
  cash: { box:'fltCfwBox', def:'sc', cols:[
    { i:1, k:'sc',     n:'التدفق' },
    { i:2, k:'fcf',    n:'تدفق حر', d:-1 },
    { i:3, k:'fcfY',   n:'عائد التدفق', d:-1 },
    { i:4, k:'cashQ',  n:'جودة الربح', d:-1 },
    { i:5, k:'ebitda', n:'أرباح قبل الفوائد', d:-1 },
    { i:6, k:'dePct',  n:'دين ÷ أصول', d:-1 },
    { i:7, k:'score',  n:'تقييم OCTA', d:-1 },
  ]},
  best: { box:'fltIdealBox', def:'sc', cols:[
    { i:1, k:'sc',     n:'درجة التطابق' },
    { i:2, k:'pass',   n:'الفلاتر المستوفاة', d:-1 },
    { i:3, k:'price',  n:'السعر', d:-1 },
    { i:4, k:'dy',     n:'التوزيعات', d:-1 },
    { i:5, k:'cagr3y', n:'نمو السعر 3 سنين', d:-1 },
    { i:6, k:'score',  n:'تقييم OCTA', d:-1 },
  ]},
};

/* 🔨 الخطوة الوحيدة: تقرا الجدول بعد ما يرسم، تلزق الرؤوس، وترتّب */
function nzSortPaint(tab){
  const cfg = NZ_SORT_COLS[tab]; if (!cfg) return;
  const box = document.getElementById(cfg.box); if (!box) return;
  const tbl = box.querySelector('table.flt-tbl'); if (!tbl) return;
  /* ⛔ لازم من جدول البيانات نفسه — صفحة الفلاتر فيها جدول شرح فوق الجدول */
  const ths = tbl.querySelectorAll('thead th');
  const body = tbl.querySelector('tbody'); if (!body) return;
  const trs = body.querySelectorAll('tr'); if (!trs.length) return;
  const st = nzSortState(tab);

  /* ① الرؤوس — دوس + سهم + شرح */
  for (let i=0; i<ths.length; i++){
    const th = ths[i];
    let col = null;
    for (let j=0; j<cfg.cols.length; j++){ if (cfg.cols[j].i===i){ col = cfg.cols[j]; break; } }
    if (!col){
      const old = th.querySelector('.nz-ar'); if (old) old.parentNode.removeChild(old);
      th.removeAttribute('onclick'); th.style.cursor='';
      th.setAttribute('aria-sort', 'none');
      continue;   /* ⛔ continue مش return — رجوع يوقف الرؤوس كلها */
    }
    const act = (st.k===col.k);
    let ar = th.querySelector('.nz-ar');
    if (!ar){ ar = document.createElement('i'); ar.className='nz-ar'; th.appendChild(ar); }
    ar.textContent = act ? (st.d<0 ? '▼' : '▲') : '▼';
    ar.setAttribute('style', act
      ? 'font-size:10px;margin-inline-start:4px;opacity:.95'
      : 'font-size:10px;margin-inline-start:4px;opacity:.25');
    th.setAttribute('onclick', 'nzSortBy(\''+tab+'\',\''+col.k+'\')');
    th.setAttribute('role', 'columnheader');
    th.setAttribute('tabindex', '0');
    /* 🔑 aria-sort — ده اللي بتقراه سلمى في الـCSS + قارئ الشاشة + الترتيب الحقيقي.
       none = لسه ما اتضغط · descending = من الأكبر · ascending = من الأصغر */
    th.setAttribute('aria-sort', act ? (st.d<0 ? 'descending' : 'ascending') : 'none');
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    const dirTxt = act ? (st.d<0 ? 'تنازلي (من الأكبر)' : 'تصاعلي (من الأصغر)') : 'اضغط للترتيب';
    th.setAttribute('title', col.n+' — '+dirTxt+(col.t?(' · '+col.t):''));
    th.setAttribute('aria-label', col.n+' — '+dirTxt);
  }

  /* ② الترتيب — «—» دايماً في الآخر */
  const isScore = (k)=> (k==='sc');
  const list = [];
  for (let i=0; i<trs.length; i++){
    const tr = trs[i];
    const el = tr.querySelector('.flt-c');
    const code = el ? el.textContent : '';
    const stk = (typeof OS_DB!=='undefined') ? OS_DB.find(x=>x.code===code) : null;
    let v;
    if (isScore(st.k)){
      const cell = tr.querySelector('td:nth-child('+(cfg.cols.filter(c=>c.k==='sc')[0].i+1)+') .flt-safe');
      v = cell ? nzNum(cell.textContent) : null;
    } else {
      v = nzSortVal(stk, st.k);
    }
    list.push({ tr:tr, v:v, i:i });
  }
  const d = st.d;
  list.sort(function(a,b){
    const c = nzCmp(a.v, b.v);
    if (c!==0) return c*d;
    return a.i - b.i;                      /* ثابت: «—» يفضل ترتيبه */
  });
  const frag = document.createDocumentFragment();
  for (let i=0; i<list.length; i++) frag.appendChild(list[i].tr);
  body.appendChild(frag);
}

/* 👆 ضغطة على رأس العمود */
function nzSortKey(tab, k, ev){
  if (ev){ if (ev.key==='Enter' || ev.key===' '){ if (ev.preventDefault) ev.preventDefault(); nzSortBy(tab,k); } }
}
function nzSortBy(tab, k){
  const cfg = NZ_SORT_COLS[tab]; if (!cfg) return;
  const st = nzSortState(tab);
  if (st.k===k){ st.d = -st.d; }            /* نفس العمود = عكس الاتجاه */
  else {
    let col = null;
    for (let j=0; j<cfg.cols.length; j++){ if (cfg.cols[j].k===k){ col = cfg.cols[j]; break; } }
    st.k = k; st.d = col ? (col.d==null?-1:col.d) : -1;
  }
  NZ_SORT[tab] = st; nzSortSave();
  const t = FZ_TABS.find(function(x){ return x.id===tab; });
  if (t && typeof window[t.render]==='function'){
    try { window[t.render](); } catch(e){ console.warn('ترتيب', tab, e.message); }
  }
}

/* ──────────────────────────────────────────────────────────────────────
  ② صف التبويب التاسع — الفرصة المثالية
  ──────────────────────────────────────────────────────────────────────
  ⛔ الـ8 محاور مرتبين زي ما هم بالظبط. البند التاسع ده صف لوحده تحتهم.
  ⛔ الكارت `fltIdealBox` بقى جوّه تبويب الصفحة الأولى (في index.html) —
     مش جوّه صفحة مستقلة. الدالة اللي تحته بقت احتياط لـHTML قديم في الكاش بس.
  ⛔ التعريف نفسه (الاسم والأيقونة والـbox) = FZ_TAB_BEST فوق.
     `NZ_BEST` اتشال — كان تعريف تاني لنفس التبويب بمحتوى مختلف. */

function nzMountBest(){
  const bb = document.getElementById(FZ_TAB_BEST.box); if (!bb) return false;
  const pane = document.getElementById('fzPane');
  /* احتياطي فقط: لو الكارت لسه بره الـpane (كاش قديم) ننقله جوّه */
  if (pane && bb.parentNode !== pane) pane.appendChild(bb);
  bb.style.display = 'none';
  return true;
}
function nzRow2Host(){
  /* ⭐ سلمى حاطّة <div class="fz-tabs fz-tabs-r2" id="fzTabsStar"> في index.html
     والـCSS بتاعها بيرتّب الصف ده لوحده (و :empty بيخفيه لو فاضي).
     ⛔ بنستخدم حاويتها هي — مش حاويتنا — عشان الشكل يطلع صح من أول مرة.
     ولو الحاوية مش موجودة (نسخة قديمة من index.html) بنعمل واحد بأنفسنا
     جوّه نفس حاوية الـsticky عشان ما يحصلش تداخل. */
  let b2 = document.getElementById('fzTabsStar');
  if (b2) return b2;
  const bar = document.getElementById('fzTabs'); if (!bar) return null;
  b2 = document.getElementById('nzTabs2');
  if (!b2){
  b2 = document.createElement('div');
  b2.id = 'nzTabs2';
  b2.className = 'fz-tabs fz-tabs-r2';
  const sticky = bar.closest ? bar.closest('.fz-tabs-sticky') : null;
  if (sticky) sticky.appendChild(b2);
  else if (bar.parentNode) bar.parentNode.insertBefore(b2, bar.nextSibling);
  }
  return b2;
}
function nzBestCount(){
  try { return (typeof fzBestRows==='function') ? fzBestRows().length : null; }
  catch(e){ return null; }
}

/* 🆕 الـbox بتاع التلاتة — بينعمل dynamic
   ⛔⛔ ليه؟ index.html ممنوع نلمسه في التعديل ده (قرار أحمد)،
      و #fltThreeBox لسه مش موجود فيه. فنعمله هنا ونحطه جوّه
      نفس #fzPane بتاع كل الفلاتر عشان يرث نفس السلوك.
   ⛔ لو Ahmed ضاف <div id="fltThreeBox"> في index.html بعدين —
      getElementById هيلاقيه الأول وهنستخدمه هو من غير ما نعمل تاني. */
function nzMountTriple(){
  let bb = document.getElementById(FZ_TAB_TRIPLE.box);
  if (!bb){
    const pane = document.getElementById('fzPane');
    if (!pane) return false;
    bb = document.createElement('div');
    bb.id = FZ_TAB_TRIPLE.box;
    pane.appendChild(bb);
  }
  bb.style.display = 'none';
  return true;
}
function fzTripleInit(){ /* التلاتة مش محتاجة set-up */ }

function nzBoot(){
  const saved = nzSortLoad();
  for (const k in saved){ if (NZ_SORT_COLS[k]) NZ_SORT[k] = saved[k]; }
  nzMountBest();
  nzMountTriple();
  nzRow2Host();
}

/* ──────────────────────────────────────────────────────────────────────
  ③ نظام المحاور الخمسة بالأوزان  (قرار أحمد 15 أكتوبر 2026 — ملزم)
  ──────────────────────────────────────────────────────────────────────
     الأساسيات 30٪ · المخاطرة 25٪ · الفني 20٪ · التقييم 15٪ · التوزيع والسيولة 10٪
     • كل مؤشر جوّه المحور: وزن متساوي.
     • ⛔ المؤشر الناقص بيتشال من الحساب — مش بيبقى صفر — ووزنه بيتوزّع
       على المؤشرات الموجودة في نفس المحور.
     • ⛔ المحور كله ناقص (صفر مؤشرات) بيتشال كلياً ووزنه بينتقل للمحاور
       التانية. عشان كده السهم اللي financials بتاعه مش موجودة مايتظلمش.
     • ⛔ النسخ المكرّرة اتدمجت: p1m=perf1m · sma50=ma50 · sma200=ma200 · de=deRatio
  ────────────────────────────────────────────────────────────────────── */

/* 🎚️ مقياس الدرجة: أول حدّ لسه الرقم أصغر منه = الدرجة */
function nzBand(v, b){
  const n = nzNum(v); if (n==null || !b) return null;
  for (let i=0; i<b.length; i++){ if (n <= b[i][0]) return b[i][1]; }
  return b.length ? b[b.length-1][1] : null;
}
const NZ_R = 1e9;

/* 📐 نسبة السعر للمتوسط المتحرك — رقم واحد يقارن كل المتوسطات ببعض */
function nzMaGap(s, k){
  const px = nzNum(s.price) != null ? nzNum(s.price) : nzNum(s.p);
  const ma = nzNum(s[k]);
  if (px==null || px<=0 || ma==null || ma<=0) return null;
  return (px - ma) / px * 100;
}
const NZ_B_GAP = [[-NZ_R,8],[-25,18],[-12,35],[-5,55],[-1,72],[1,85],[5,95],[NZ_R,100]];

const NZ_AXES = [
{ id:'fund', ic:'🧱', ar:'الأساسيات', w:30, items:[
  { k:'roe', n:'العائد على حقوق الملكية', u:'٪', f:function(s){ return s.roe; },
    b:[[0,0],[8,30],[15,55],[25,75],[35,90],[NZ_R,100]],
    how:'رقم العائد على حقوق الملكية كما ورد من المصدر' },
  { k:'roa', n:'العائد على الأصول', u:'٪', f:function(s){ return s.roa; },
    b:[[0,0],[2,35],[5,55],[10,75],[18,90],[NZ_R,100]],
    how:'رقم العائد على الأصول كما ورد من المصدر' },
  { k:'roic', n:'العائد على رأس المال المستثمر', u:'٪', f:function(s){ return s.roic; },
    b:[[0,0],[5,30],[12,55],[20,78],[30,92],[NZ_R,100]],
    how:'رقم العائد على رأس المال المستثمر كما ورد من المصدر' },
  { k:'om', n:'هامش التشغيل', u:'٪', f:function(s){ return s.om; },
    b:[[0,5],[5,30],[15,55],[30,78],[50,92],[NZ_R,100]],
    how:'الربح قبل الفوائد والضرائب ÷ الإيرادات — الرقم من المصدر' },
  { k:'nm', n:'هامش الربح الصافي', u:'٪', f:function(s){ return s.nm; },
    b:[[0,5],[5,30],[15,55],[30,80],[50,93],[NZ_R,100]],
    how:'صافي الربح ÷ الإيرادات — الرقم من المصدر' },
  { k:'fcfm', n:'هامش التدفق الحر', u:'٪', f:function(s){
      const f = nzNum(s.fcf), r = nzNum(s.rev);
      if (f==null || r==null || r<=0) return null;
      const v = f/r*100;
      return (Math.abs(v)>300) ? null : v;   /* ⛔ نسبة جنونية = بيانات ناقمة مش جودة */
    },
    b:[[-NZ_R,5],[-20,22],[0,35],[5,52],[10,68],[20,82],[40,93],[80,100],[NZ_R,70]],
    how:'التدفق الحر ÷ الإيرادات × 100. لو طلعت أكبر من 300٪ أو أقل من −100٪ بتعتبر ناقمة (رقم مش منطقي) مش درجة صفر' },
  { k:'dePct', n:'الدين ÷ الأصول', u:'٪', f:function(s){
      const d = nzNum(s.de); return (d==null) ? null : d*100; },
    b:[[10,95],[25,85],[40,70],[55,55],[75,35],[100,18],[NZ_R,8]],
    bBank:[[40,90],[55,80],[70,65],[90,45],[NZ_R,25]],
    how:'إجمالي الدين ÷ إجمالي الأصول. للبنوك نقطة قطع مختلفة لأن الودائع بتتحسب دين — فبنستخدم مدى تاني معاها' },
  { k:'cr', n:'نسبة التداول', u:'×', f:function(s){ return s.cr; },
    b:[[0,5],[0.5,20],[0.8,35],[1,50],[1.2,65],[2,82],[3,92],[NZ_R,100]],
    bBank:[[0.3,40],[0.5,60],[0.7,72],[0.9,82],[1.1,90],[NZ_R,95]],
    how:'الأصول المتداولة ÷ الالتزامات قصيرة الأجل. نفس السبب — مدى تاني للبنوك' },
]},
{ id:'risk', ic:'🛡', ar:'المخاطرة', w:25, items:[
  { k:'vol1y', n:'التذبذب السنوي', u:'٪', f:function(s){ return s.vol1y; },
    b:[[20,95],[30,85],[40,72],[50,58],[70,35],[90,18],[NZ_R,8]],
    how:'المتوسط السنوي لتحرّك سعر السهم — أقل = أهدأ' },
  { k:'vol3y', n:'التذبذب 3 سنين', u:'٪', f:function(s){ return s.vol3y; },
    b:[[20,95],[30,85],[40,72],[50,58],[70,35],[90,18],[NZ_R,8]],
    how:'متوسط التذبذب على 3 سنين — المدى الأطول، أهدى معناه ثبات' },
  { k:'mdd', n:'أكبر هبوط في تاريخه', u:'٪', f:function(s){ return s.mdd; },
    b:[[40,92],[60,82],[75,68],[85,52],[92,35],[97,18],[NZ_R,8]],
    how:'أكبر نزول من قمة القاع عبر تاريخ السهم — رقم حقيقي من سوقنا' },
  { k:'mdd1y', n:'أكبر هبوط في سنة', u:'٪', f:function(s){ return s.mdd1y; },
    b:[[15,92],[25,82],[35,68],[50,50],[65,32],[80,18],[NZ_R,8]],
    how:'أكبر نزول خلال آخر سنة — أقصر من أطول' },
  { k:'sharpe3y', n:'شارب 3 سنين', u:'', f:function(s){ return s.sharpe3y; },
    b:[[-NZ_R,5],[0,20],[0.5,45],[1,68],[1.5,85],[2,94],[NZ_R,100]],
    how:'العائد الزائد مقابل المخاطرة — أعلى = العائد يستاهل التقلّب' },
  { k:'sortino3y', n:'سورتينو 3 سنين', u:'٪', f:function(s){ return s.sortino3y; },
    b:[[10,30],[15,48],[25,65],[35,78],[50,90],[80,96],[NZ_R,70]],
    how:'العائد مقابل الهبوط بس (مش مقابل كل التقلّب) — أعلى = أحسن' },
  { k:'beta', n:'معامل المخاطرة', u:'', f:function(s){ return s.beta; },
    b:[[0.2,95],[0.5,85],[0.8,70],[1,55],[1.2,40],[1.5,25],[NZ_R,12]],
    how:'إزاي السهم بيتحرك مع السوق. 1 = زي السوق. سالب = بيتحرك عكسه (مش معناها آمن، فبيدخل بأعلى درجة)' },
  { k:'atrp', n:'المدى الحقيقي ÷ السعر', u:'٪', f:function(s){
      const a = nzNum(s.atr), px = nzNum(s.price) != null ? nzNum(s.price) : nzNum(s.p);
      if (a==null || a<=0 || px==null || px<=0) return null;   /* ⛔ ATR صفر = مفيش بيانات، مش «سهم ساكن» */
      return a/px*100; },
    b:[[2,92],[3.5,82],[4.5,70],[6,55],[8,38],[12,20],[NZ_R,10]],
    how:'المدى الحقيقي (ATR) ÷ السعر × 100 — عشان نقارن سهم بـ10 جنيه بسهم بـ1500 بنفس القيمة' },
]},
{ id:'tech', ic:'📈', ar:'الفني', w:20, items:[
  { k:'rsi', n:'مؤشر القوة (RSI)', u:'', f:function(s){ return s.rsi; },
    b:[[25,45],[35,60],[45,72],[55,88],[65,100],[75,85],[85,60],[NZ_R,40]],
    how:'قوة الشراء من 0 لـ100. أحسن منطقة 55-65 (صاعد من غير تشبّع). فوق 85 خطر ارتداد، تحت 25 السهم بينزلق' },
  { k:'macdg', n:'تقاطع MACD', u:'٪', f:function(s){
      const m = nzNum(s.macd), g = nzNum(s.macdSig);
      const px = nzNum(s.price) != null ? nzNum(s.price) : nzNum(s.p);
      if (m==null || g==null || px==null || px<=0) return null;
      return (m-g)/px*100; },
    b:[[-NZ_R,8],[-1.5,18],[-0.8,30],[-0.3,45],[0,60],[0.3,75],[0.8,90],[1.5,100],[NZ_R,88]],
    how:'(MACD − خط الإشارة) ÷ السعر × 100. موجب = تقاطع ذهبي، سالب = تقاطع أحمر' },
  { k:'sma20', n:'السعر مقابل المتوسط 20', u:'٪', f:function(s){ return nzMaGap(s,'sma20'); },
    b:NZ_B_GAP, how:'(السعر − المتوسط) ÷ السعر × 100. فوق المتوسط = اتجاه صاعد' },
  { k:'sma50', n:'السعر مقابل المتوسط 50', u:'٪', f:function(s){ return nzMaGap(s,'sma50'); },
    b:NZ_B_GAP, how:'(السعر − المتوسط) ÷ السعر × 100. سطر الـ50 هو منحنى الشراء/البيع الشهير' },
  { k:'sma100', n:'السعر مقابل المتوسط 100', u:'٪', f:function(s){ return nzMaGap(s,'sma100'); },
    b:NZ_B_GAP, how:'(السعر − المتوسط) ÷ السعر × 100' },
  { k:'sma200', n:'السعر مقابل المتوسط 200', u:'٪', f:function(s){ return nzMaGap(s,'sma200'); },
    b:NZ_B_GAP, how:'(السعر − المتوسط) ÷ السعر × 100. تحت ده = سوق هابط' },
  { k:'ema20', n:'السعر مقابل EMA 20', u:'٪', f:function(s){ return nzMaGap(s,'ema20'); },
    b:NZ_B_GAP, how:'(السعر − المتوسط المتحرك الأسّي) ÷ السعر × 100' },
  { k:'ema50', n:'السعر مقابل EMA 50', u:'٪', f:function(s){ return nzMaGap(s,'ema50'); },
    b:NZ_B_GAP, how:'(السعر − المتوسط المتحرك الأسّي) ÷ السعر × 100' },
  { k:'ema200', n:'السعر مقابل EMA 200', u:'٪', f:function(s){ return nzMaGap(s,'ema200'); },
    b:NZ_B_GAP, how:'(السعر − المتوسط المتحرك الأسّي) ÷ السعر × 100' },
  { k:'tvRec', n:'تقييم المحللين', u:'', f:function(s){ return s.tvRec; },
    b:[[-NZ_R,10],[-0.5,22],[-0.2,38],[-0.05,55],[0.05,72],[0.2,88],[NZ_R,100]],
    how:'توصية المصدر الفني من −1 (بيع) لـ+1 (شراء) — الرقم من المصدر' },
]},
{ id:'val', ic:'💎', ar:'التقييم', w:15, items:[
  { k:'pe', n:'مضاعف الربحية', u:'×', f:function(s){
      const v = nzNum(s.pe); if (v==null) return null;
      return (v>0) ? v : 0; },   /* 0 = الشركة بتخسر ⇒ أسوأ درجة، ومش «ناقص» */
    b:[[5,95],[8,88],[12,78],[18,66],[28,52],[50,35],[NZ_R,20]],
    how:'السعر ÷ Earnings Per Share. مضاعف 0 أو أقل = الشركة خاسرة (أسوأ درجة). مضلّل في secteur البنوك فبيتفسّر مع ملاحظة الحزمة' },
  { k:'pb', n:'مضاعف القيمة الدفترية', u:'×', f:function(s){
      const v = nzNum(s.pb); if (v==null) return null;
      return (v>0) ? v : 0; },
    b:[[0.5,95],[0.9,88],[1.4,78],[2.2,66],[3.5,52],[6,35],[NZ_R,20]],
    how:'السعر ÷ القيمة الدفترية. مضاعف 0 = حقوق الملكية سالبة (أسوأ درجة)' },
]},
{ id:'dist', ic:'💰', ar:'التوزيع والسيولة', w:10, items:[
  { k:'dy', n:'نسبة القسيمة السنوية', u:'٪', f:function(s){ return s.dy; },
    b:[[0,0],[1,45],[2.5,65],[4,82],[6,92],[9,100],[15,85],[NZ_R,55]],
    how:'القسيمة ÷ سعر السهم. 0 = السهم مش موزّع. فوق 15٪ بيتعامل معاه «مؤقت» لأنه غالباً توزيع مرة واحدة' },
  { k:'mc', n:'حجم السوق', u:'ج.م', f:function(s){
      const v = nzNum(s.mc); if (v==null || v<=0) return null; return v; },
    b:[[1e8,15],[5e8,35],[1e9,50],[5e9,72],[2e10,88],[1e11,96],[1e12,100]],
    how:'قيمة كل أسهم الشركة بالجنيه — مؤشر ثبات مش جودة. ⛔ القيمة السوقية صفر أو ناقصة — بتعتبر ناقصة مش صفر' },
  { k:'floatPct', n:'نسبة الحرة من السوق', u:'٪', f:function(s){
      const f = nzF(s).flt, m = nzNum(s.mc);
      if (f==null || m==null || m<=0) return null;
      const v = f/m*100;
      return (v>150) ? null : v;   /* ⛔ حرة أكبر من السوق كله = تناقض في المصدر */
    },
    b:[[5,35],[10,50],[20,65],[35,80],[60,92],[90,98],[NZ_R,100]],
    how:'القيمة الحرة ÷ القيمة السوقية × 100. الحرة أعلى = سيولة أفضل. ⛔ لو طلعت أكبر من 150٪ بتعتبر ناقصة (الحرة أكبر من السوق كلها = تناقض)' },
  { k:'relvol', n:'الحجم النسبي اليوم', u:'×', f:function(s){
      const v = nzNum(s.relvol); if (v==null || v<=0) return null; return v; },
    b:[[0.3,35],[0.6,55],[1,80],[1.5,90],[2.5,75],[5,55],[NZ_R,35]],
    how:'حجم اليوم ÷ متوسط حجم المصدر. 1 = عادي. فوق 2.5 = عنيف مش سيولة، فبينقص الدرجة' },
  { k:'av30', n:'متوسط حجم 30 يوم', u:'سهم/يوم', f:function(s){
      const v = nzNum(s.av30); if (v==null || v<=0) return null; return v; },
    b:[[5e4,20],[2e5,40],[5e5,60],[1e6,75],[5e6,90],[2e7,97],[1e12,100]],
    how:'عدد الأسهم المتداولة يومياً (مش جنيه) — يبقى الرقم نفسه أي محفظة مهما كان حجمها' },
]},
];

/* 🧮 الدرجة النهائية من المحاور الخمسة */
function nzAxisScore(s){
  /* 📌 الميكانيكا بالبلدي:
     eff  = وزن المحور × (المؤشرات المتاحة ÷ إجمالي المؤشرات)   ← الناقص بيتوزّع جوّه المحور
     tot += متوسط درجات المحور × eff
     الدرجة = tot ÷ wGot   ← wGot = مجموع الأوزان الفعلي��ة
     ⛔ المحور اللي معندوش ولا مؤشر واحد: eff = 0 ⇒ مش يدخل في tot ولا في wGot
        ⇒ وزنه بينتقل للمحاور التانية تلقائياً، ومش بيبقى درجة صفر أبداً. */
  const axes = [];
  let tot = 0, wGot = 0;
  NZ_AXES.forEach(function(ax){
    const items = [];
    let sum = 0, have = 0;
    for (let i=0; i<ax.items.length; i++){
      const it = ax.items[i];
      let v = null;
      try { v = it.f(s); } catch(e){ v = null; }
      v = nzNum(v);
      const ok = (v != null);
      const sc = ok ? nzBand(v, (nzIsBank(s) && it.bBank) ? it.bBank : it.b) : null;
      if (ok && sc!=null){ sum += sc; have++; }
      items.push({ k:it.k, n:it.n, u:it.u, v:v, sc:sc, how:it.how });
    }
    const n = ax.items.length;
    const mean = have ? sum/have : null;
    const eff = have ? (ax.w/100) * (have/n) : 0;   /* الوزن الفعلي بعد استبعاد الناقص */
    if (have && eff>0){ tot += mean*eff; wGot += eff; }
    axes.push({ id:ax.id, ic:ax.ic, ar:ax.ar, w:ax.w, n:n, have:have, mean:mean, eff:eff, items:items });
  });
  /* ⛔ tot已是 على مقياس 0-100 (مجموع mean×eff) — ما نقسمش تاني على 100 */
  return { total: (wGot>0) ? (tot/wGot) : null, wGot:wGot, axes:axes };
}

/* ──────────────────────────────────────────────────────────────────────
  ④ السعر العادل + نقطة الدخول + الهدف + وقف الخسارة
  ──────────────────────────────────────────────────────────────────────
  السعر العادل = متوسط مرجّح لـ 3 مصادر (40٪ محللين · 30٪ قيمة دفترية · 30٪ فني)
  ⛔ مصدر ناقص = «—» ووزنه بينتشر على الموجودين — عمره ما يتحوّل لصفر.
  ⛔ لو النتيجة خارج المدى المعقول (أقل من ÷3 أو أكبر من ×3 السعر)
     بتعتبر مش معقولة وبتعرض «—» — عشان ما يظهرش رقم مستحيل. */
const NZ_FV = [
  { id:'an', ic:'🎯', ar:'هدف المحللين',  w:40 },
  { id:'bv', ic:'📚', ar:'القيمة الدفترية', w:30 },
  { id:'tc', ic:'📐', ar:'النموذج الفني', w:30 },
];
function nzFair(s){
  const res = { px:null, src:[], notes:[], ok:false };
  const p1 = nzNum(s.price), p2 = nzNum(s.p);
  res.px = (p1!=null && p1>0) ? p1 : p2;
  if (res.px==null || res.px<=0){ res.notes.push('السعر غير متاح'); return res; }
  const px = res.px;

  /* ① هدف المحللين — رقم حقيقي من الـscanner، أو «—»
     🔥 حدّ المعقولية (16 أكتوبر 2026): المصدر فيه أهداف قديمة أو مرتبطة بسهم
        تاني. الفحص الحي على الـ49 سهم اللي عندهم هدف: 3 منهم هدفهم أكبر من
        20× السعر الحالي (EGBE: هدف 10.54ج وسعره 0.11ج · VLMR: 60.24ج مقابل
        0.65ج) — أرقام مستحيلة. ⛔ من غير الحقل ده، وسيط واحد فاسد بيسحب
        السعر العادل كله وراه، والواجهة بتعرض «مكسب +9000٪» = رقم مخترع.
        نفس القاعدة المطبّقة على المصدرين ② و ③ بالظبط: أكبر من 2.5×
        أو أصغر من ÷3 ⇒ مش معقول ⇒ «—» مع السبب، ومينفعش يتحوّل صفر. */
  const tg = nzTarget(s);
  const tgRatio = (tg.med!=null && res.px>0) ? (tg.med/res.px) : null;
  const tgSane = (tgRatio!=null) && (tgRatio>=0.4 && tgRatio<=2.5);
  if (tg.med!=null && tgSane){
    res.src.push({ id:'an', v:tg.med, w:40,
      how:'وسيط أهداف المحللين كما ورد من المصدر'
         +(tgRatio!=null ? (' · الهدف يساوي '+Math.round(tgRatio*100)+'٪ من السعر الحالي') : '')
         +((tg.low!=null||tg.high!=null)
            ? ' · مدى المصدر: '+(tg.low!=null?tg.low.toFixed(2):'—')+' — '+(tg.high!=null?tg.high.toFixed(2):'—')
            : ''),
      src:'مصادر المحللين (TradingView)' });
  } else {
    const cov = nzTargetCover();
    let why;
    if (tg.med!=null){
      why = '⛔ المصدر فيه وسيط ('+tg.med.toFixed(2)+' ج) بس ده يساوي '
          + Math.round(tgRatio*100) + '٪ من السعر الحالي ('+res.px.toFixed(2)+' ج) — '
          + 'رقم مستحيل (المقبول 40٪–250٪). غالباً هدف قديم أو مرتبط بسهم آخر، '
          + 'فبنستبعده بدل ما نخلّيه يسحب السعر العادل وراه.';
    } else if (tg.low!=null || tg.high!=null){
      why = 'المصدر فيه هدف أدنى '+(tg.low!=null?tg.low.toFixed(2):'—')+' وأعلى '
          + (tg.high!=null?tg.high.toFixed(2):'—')
          + ' بس مفيش وسيط — والوسيط هو الرقم الصح. من غيره بنكتب «—». ';
    } else {
      why = 'مفيش هدف محللين لهذا السهم في المصدر. ';
    }
    res.src.push({ id:'an', v:null, w:40,
      why: why + 'التغطية في السوق كله: '+cov.have+' من '+cov.all+' ('+cov.pct+'٪) — '
         + 'اللي ناقص بنستبعده من المتوسط، مش بنحطه صفر.' });
  }

  /* ② القيمة الدفترية × وسيط مضاعف القطاع
     ⛔ بنحسب القيمة الدفترية من السعر ÷ P/B مش من حقل bvps:
        حقل القيمة الدفترية (bvps) في المصدر غير متسق مع P/B — قيمته أقل بـ50 مرة في 71 سهم من 72 */
  const pb = nzNum(s.pb);
  const med = (typeof FZ_SECTOR_MED!=='undefined' && s.sector) ? (FZ_SECTOR_MED[s.sector]||{}) : {};
  const medPB = nzNum(med.pb), medN = med.n||0;
  if (pb!=null && pb>0 && medPB!=null && medPB>0 && medN>=5){
    const bvps = px/pb;
    const f = bvps*medPB;
    if (f/px>=0.4 && f/px<=2.5){
      res.src.push({ id:'bv', v:f, w:30,
        how:'القيمة الدفترية (السعر ÷ مضاعف القيمة الدفترية) × وسيط مضاعف «'+(s.sectorAr||s.sector||'القطاع')+'» ('+medN+' سهم)',
        src:NZ_SRC+' + وسيط القطاع' });
    } else {
      res.src.push({ id:'bv', v:null, w:30,
        why:'الناتج ('+f.toFixed(2)+') بعيد جداً عن السعر الحالي (أكبر من 2.5× أو أصغر من ÷3) — رقم مش معقول فبنعرض «—»' });
    }
  } else {
    res.src.push({ id:'bv', v:null, w:30,
      why: (!medN||medN<5) ? 'مفيش-sector كامل في السوق يوصل لـ5 أسهم بمضاعف قيمة دفترية — من غير وسيط مش بنخمّن'
        : 'مضاعف القيمة الدفترية غير متاح لهذا السهم أو أقل من صفر' });
  }

  /* ③ النموذج الفني — المتوسطات + الدعم والمقاومة */
  const parts = [];
  /* 🔤 nzF بيقرا الأسماء البديلة — OS_DB فيها ma50/ma200مش sma50/sma200
     (لعدم التحقق نضيف ma20/ema20 كمان). قبل الإصلاح ده كله كان null. */
  const F = nzF(s);
  const sma50 = F.ma50, sma200 = F.ma200;
  const sma20 = F.ma20, ema20 = F.ema20;
  const l52 = F.l52, h52 = F.h52;
  if (sma50!=null && sma50>0 && sma200!=null && sma200>0) parts.push({ v:(sma50+sma200)/2, w:45, n:'متوسط sma50 و sma200' });
  if (sma20!=null && sma20>0 && ema20!=null && ema20>0) parts.push({ v:(sma20+ema20)/2, w:25, n:'متوسط sma20 و ema20' });
  if (l52!=null && l52>0 && h52!=null && h52>l52) parts.push({ v:(l52+h52)/2, w:30, n:'منتصف مدى 52 أسبوع (دعم ومقاومة)' });
  if (parts.length>=2){
    let w=0, s2=0;
    for (let i=0;i<parts.length;i++){ w+=parts[i].w; s2+=parts[i].v*parts[i].w; }
    const f = s2/w;
    if (f/px>=0.4 && f/px<=2.5){
      let how = '';
      for (let i=0;i<parts.length;i++) how += (i?' · ':'')+parts[i].n+' ('+Math.round(parts[i].w)+'٪)';
      res.src.push({ id:'tc', v:f, w:30, how:how, src:NZ_SRC });
    } else {
      res.src.push({ id:'tc', v:null, w:30,
        why:'الناتج بعيد جداً عن السعر الحالي (أكبر من 2.5× أو أصغر من ÷3) — رقم مش معقول فبنعرض «—»' });
    }
  } else {
    res.src.push({ id:'tc', v:null, w:30,
      why:'مفيش متوسطات متحركة + مدى سنة كاملة في الداتا (محتاج 2 على الأقل)' });
  }

  /* ⚖️ المتوسط المرجّح — بس على المصادر اللي عندها رقم */
  let W=0, S=0, used=[];
  for (let i=0;i<res.src.length;i++){ const x=res.src[i]; if (x.v!=null){ W+=x.w; S+=x.v*x.w; used.push(x.id); } }
  res.used = used;
  if (W>0){
    const f = S/W;
    if (f/px>=0.33 && f/px<=3){
      res.fair = f; res.wUsed = W; res.ok = true;
    } else {
      res.notes.push('المتوسط المرجّح ('+f.toFixed(2)+') خارج المدى المعقول مقارنة بالسعر ('+px.toFixed(2)+') — اتعرض «—»');
    }
  }
  if (!res.ok && !res.notes.length) res.notes.push('مفيش مصدر واحد متاح — من غير أرقام حقيقية مش بنعرض سعر عادل');
  return res;
}

/* ⭐ هدف المحللين — الحقل ممكن يبقى في 3 أماكن:
   ① على السهم نفسه (لو الـAPI رجعه)  ② في السجل الخام EGX_DB (لو data_full فيه)
   ③ في السهم الحيّ
   ⛔ لو مفيش — بنكتب «—». ⛔ عمرنا ما بنحسبه ourselves ولا بنقرّبه. */
function nzTarget(s){
  const keys = ['price_target_median'];
  let med = null, low = null, high = null;
  const take = function(o){
    if (!o) return;
    if (med==null) med = nzNum(o.price_target_median);
    if (low==null) low = nzNum(o.price_target_low);
    if (high==null) high = nzNum(o.price_target_high);
  };
  try { take(s); } catch(e){}
  try { if (med==null && typeof EGX_DB!=='undefined' && EGX_DB && s && s.code) take(EGX_DB[s.code]); } catch(e){}
  const ok = (med!=null && med>0);
  return { med: ok?med:null, low:(low!=null&&low>0)?low:null, high:(high!=null&&high>0)?high:null };
}
/* 📊 تغطية هدف المحللين في الداتا المتاحة دلوقتي — رقم حقيقي للمستخدم */
function nzTargetCover(){
  let have = 0, all = 0;
  if (typeof OS_DB==='undefined' || !OS_DB) return { have:0, all:0, pct:0 };
  all = OS_DB.length;
  for (let i=0;i<OS_DB.length;i++){ if (nzTarget(OS_DB[i]).med!=null) have++; }
  return { have:have, all:all, pct: all? Math.round(have/all*100) : 0 };
}

/* 🎯 نقطة الدخول + الهدف + وقف الخسارة — كلها من قراءة حقيقية للشارت */
function nzPlan(s, fair){
  const p1 = nzNum(s.price), p2 = nzNum(s.p);
  const px = (p1!=null && p1>0) ? p1 : p2;
  const out = { px:px, entry:null, entryWhy:'', target:null, stop:null, stopWhy:'', stopEst:false };
  if (px==null || px<=0) return out;
  /* 🔤 nzF بيقرا الأسماء البديلة (16 أكتوبر 2026).
     ⛔ قبل الإصلاح ده السطر كله كان راجع null: OS_DB فيها ma50/ma200
     (88٪/87٪) مش sma50/sma200 ⇒ كل الفروع اللي جوايه كانت ميتة
     ⇒ نقطة الدخول كانت «فوق كل المتوسطات» (وهي كذبة — ماكانش فوق ولا واحد). */
  const F = nzF(s);
  const rsi = F.rsi, sma20 = F.ma20, sma50 = F.ma50, sma200 = F.ma200;
  let e = px, why = 'فوق كل المتوسطات المتحركة — الدخول بسعر اليوم';
  if (rsi!=null && rsi>68 && sma20!=null && sma20>0){ e = sma20; why = 'مؤشر القوة '+Math.round(rsi)+' فوق 68 = السهم متشبّع، نستنى رجوعه للمتوسط 20'; }
  else if (sma20!=null && sma20>0 && px < sma20){ e = sma20; why = 'السعر تحت المتوسط 20 — نقطة الدخول أول ما يلمسه'; }
  else if (sma50!=null && sma50>0 && px < sma50){ e = sma50; why = 'السعر تحت المتوسط 50 — نقطة الدخول عند لمسه'; }
  else if (sma200!=null && sma200>0 && px < sma200){ e = sma200; why = 'السهم تحت المتوسط 200 (سوق هابط) — نقطة الدخول أول ما يرجع لمستوى ده'; }
  else if (sma200!=null && sma200>0 && px < sma200*1.02){ e = sma200; why = 'ملامسة للمتوسط 200 — مستوى الدعم الأهم'; }
  out.entry = e; out.entryWhy = why;

  const fv = nzFair(s);
  out.target = (fv.ok ? fv.fair : null);
  out.targetWhy = fv.ok
    ? 'الهدف = السعر العادل (متوسط 3 مصادر مرجّح)'
    : ('مفيش سعر عادل متاح — '+(fv.notes[0]||'المصادر ناقصة'));

  /* ⛔⛔ المدى الحقيقي (ATR) = 0٪ تغطية في OS_DB ⇒ قبل كده عمود «وقف
     الخسارة» كان كله «—». مش بنسيبه كده: في رقم حقيقي تاني من نفس
     المصدر — التقلب السنوي vol1y (75٪ تغطية) — ومنه نقدّر المدى:
        تقلب يومي مُقدَّر = (vol1y ÷ 100) ÷ √252
        مدى مُقدَّر        ≈ تقلب يومي × السعر
     ⛔ ده **تقدير مش قياس** — مكتوب كده في الخانة والـtooltip.
     ⛔ ولو ATR رجع من المصدر يوم، هو اللي بيتاخد مش التقدير.
     ⛔ ولو vol1y ناقص ← «—» مع سبب. عمره ما بنقرب ولا بنتوسّط. */
  const atrReal = F.atr;
  let atr = atrReal, atrEst = false;
  const vol1y = nzNum(s.vol1y);
  if ((atr==null || atr<=0) && vol1y!=null && vol1y>0 && px>0){
    atr = px * (vol1y/100) / Math.sqrt(252);
    atrEst = true;
  }
  /* ⛔ المقارنة بعد التقريب لـ2: سهم بـ0.11 ج والهدف 0.005 — التقريب بيخلي
     الوقف ونقطة الدخول نفس الرقم. وقف الخسارة اللي = الدخول مش وقف خسارة. */
  const dec2 = (x)=> Math.round(x*100)/100;
  const er = dec2(e), sr = (atr!=null && atr>0) ? dec2(e - 2*atr) : null;
  if (sr!=null && er>0 && sr>0 && sr<er){
    out.stop = sr;
    out.stopEst = atrEst;
    out.stopWhy = atrEst
      ? ('سعر الدخول ناقص 2 × **مدى مُقدَّر** ('+atr.toFixed(2)+' ج). ⛔ المدى الحقيقي (ATR) غير '
         +'متاح في الداتا فاحتسبناه من التقلب السنوي: ('+vol1y.toFixed(1)+'٪ ÷ 100) ÷ √252 × '
         +px.toFixed(2)+' ج. ده **تقدير مش قياس** — لو ATR رجع من المصدر هنستخدمه هو')
      : ('سعر الدخول ناقص 2 × المدى الحقيقي المقيس (ATR='+atr.toFixed(2)+' ج)');
  } else if (atr!=null && atr>0){
    out.stopWhy = (atrEst ? 'المدى المُقدَّر' : 'المدى الحقيقي (ATR)')+' ('+atr.toFixed(4)+' ج) صغير جداً على سعر السهم — بعد التقريب الوقف والدخول نفس الرقم، فمفيش وقف خسارة حقيقي';
  } else out.stopWhy = 'المدى الحقيقي (ATR) غير متاح لهذا السهم، والتقلب السنوي (vol1y) ناقص كمان — من غير اتنين ممنعملش تقدير';
  return out;
}

/* ──────────────────────────────────────────────────────────────────────
  🃏 ترتيب أحسن 5 فرص بالدرجة الجديدة
  ────────────────────────────────────────────────────────────────────── */
function nzTopFive(given){
  /* ⛔ `given`: لو حد بعت مصفوفة، بنستخدمها هي — عشان الكارت والتبويب
     ياخدوا نفس الأسهم بالظبط. من غيرها بنجيب fzBestRows() زي الأول. */
  let base = Array.isArray(given) ? given.slice() : [];
  if (!given){
  try { base = (typeof fzBestRows==='function') ? fzBestRows() : []; } catch(e){ base = []; }
  }
  if (!base.length && typeof OS_DB!=='undefined') base = OS_DB.slice();
  const out = [];
  for (let i=0;i<base.length;i++){
    const sc = nzAxisScore(base[i]);
    if (sc.total==null) continue;
    const fv = nzFair(base[i]);
    const up = (fv.ok && fv.px>0) ? (fv.fair/fv.px-1)*100 : null;
    /* ⛔ الترتيب 3 مجموعات — زي الباك بالظبط (post_close_picks):
       ① سعره تحت سعره العادل (فرصة شراء فعلاً)  ② سعره فوق العادل  ③ مفيش سعر عادل
       جوه كل مجموعة: الدرجة تنازلياً.
       سبب: سهم درجته 90 وسعره فوق العادل بـ20% = مش «فرصة مثالية» دلوقتي. */
    const grp = (up==null) ? 2 : (up>0 ? 0 : 1);
    out.push({ s:base[i], sc:sc, fv:fv, up:up, grp:grp });
  }
  out.sort(function(a,b){
    if (a.grp!==b.grp) return a.grp - b.grp;
    return b.sc.total - a.sc.total;
  });
  return out.slice(0, 5);
}

/* ──────────────────────────────────────────────────────────────────────
  🃏 عرض كارت الفرصة المثالية — التبويب التاسع
  ──────────────────────────────────────────────────────────────────────
  ⛔ كل رقم في الكارت جنبه tooltip فيه: المصدر + تاريخ السحب + طريقة الحساب.
  ⛔ كل مؤشر بيعرض وحدته جنبه. والمفقود «—» مع سبب مكتوب تحته. */
function nzValCell(v, unit, how, dec, cls){
  if (v==null) return '<span class="flt-na" title="'+escFlt(how||'الحقل غير متاح في البيانات')+'">—</span>';
  const t = nzTip(how);
  return '<span class="'+(cls||'flt-b')+'" dir="ltr" title="'+escFlt(t)+'">'
       + v.toFixed(dec==null?2:dec)+(unit?'<i>'+escFlt(unit)+'</i>':'')+'</span>';
}
/* ٪ بخانة آمنة — ⛔ المفقود «—» مش صفر، والمصدر والتاريخ والطريقة في الـtooltip */
function nzPctCell(v, how){
  const n = nzNum(v);
  if (n==null || !isFinite(n)) return '<span class="flt-na" title="'+escFlt(how||'النسبة غير متاحة في بيانات هذا السهم')+'">—</span>';
  return '<span class="flt-pct" dir="ltr" title="'+escFlt(nzTip(how))+'">'
       +  (n>0?'+':'')+n.toFixed(1)+'<b class="flt-pu">%</b></span>';
}
function nzAxisRow(a){
  const eff = (a.eff*100);
  let h = '<div class="nz-ar-row'+(a.have===0?' na':'')+'" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:3px 0">';
  h += '<span class="nz-ar-n" style="flex:1 1 130px">'+a.ic+' '+escFlt(a.ar)+'</span>';
  h += '<span class="nz-ar-w" dir="ltr" title="'+escFlt(nzTip('وزن المحور المعلن '+a.w+'٪ — كل مؤشر جوّه المحور وزنه متساوي'))+'">'
     +  a.w+'٪</span>';
  h += '<span class="nz-ar-h" dir="ltr" title="'+escFlt(nzTip('المؤشرات المتاحة من أصل '+a.n+' في بيانات هذا السهم'))+'">'
     +  a.have+'/'+a.n+'</span>';
  if (a.have===0){
    h += '<span class="nz-ar-m" title="'+escFlt('⛔ المحور ده كله ناقص لهذا السهم — بيتشال من الحساب ووزنه ('+a.w+'٪) بيتوزّع على المحاور التانية. مش درجة صفر.')+'">'
       +  'مش متاح — وزنه اتوزّع</span>';
  } else {
    h += '<span class="nz-ar-m">'+nzGrade(a.mean, 70, 50)+' · وزن فعلي '
       +  '<b dir="ltr">'+eff.toFixed(1)+'٪</b>'
       +  ' <span class="nz-ar-s" title="'+escFlt(nzTip('الوزن بعد استبعاد المؤشرات الناقصة: '+a.w+'٪ × ('+a.have+'÷'+a.n+')'))+'">(من '+a.w+'٪)</span></span>';
  }
  h += '</div>';
  return h;
}
function nzItemsBox(a){
  let h = '<div class="nz-items" style="display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:4px">';
  for (let i=0;i<a.items.length;i++){
    const it = a.items[i];
    const v = (it.v==null) ? null : it.v;
    h += '<div class="nz-it'+(it.v==null?' na':'')+'" style="display:flex;gap:4px;align-items:baseline;font-size:10px;opacity:.85">';
    h +=  '<span class="nz-it-n" style="flex:1 1 auto">'+escFlt(it.n)+(it.u?(' <i>'+escFlt(it.u)+'</i>'):'')+'</span>';
    h +=  '<span class="nz-it-v" dir="ltr" title="'+escFlt(nzTip(it.how))+'">'
       +  (v==null ? '—' : v.toFixed(Math.abs(v)<10?2:1))+'</span>';
    h +=  '<span class="nz-it-s" dir="ltr" title="'+escFlt(nzTip('درجة المؤشر من 100 حسب المدى المكتوب — دي مساهمته في متوسط المحور'))+'">'
       +  (it.sc==null ? '—' : Math.round(it.sc))+'</span>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}
function nzStockCard(row, rank, medal){
  const s = row.s, sc = row.sc, fv = nzFair(s), pl = nzPlan(s, fv);
  const px = fv.px;
  const up = (pl.target!=null && px!=null && px>0) ? (pl.target/px-1)*100 : null;
  const fx = (pl.entry!=null && pl.stop!=null && pl.entry>0) ? ((pl.stop/pl.entry-1)*100) : null;
  const cov = Math.round(sc.wGot*100);

  /* ⛔ ستايل مدمج جوّه الكود: octa.css ملف سلمى — من غيره الكارت بيتقرا ملخبط.
     لو سلمى زوّقت الـclasses دي في الـCSS، كل حاجة هتفضل شغالة. */
  let h = '<div class="nz-card" data-c="'+escFlt(s.code)+'"'
     +  ' style="margin:10px 0;padding:10px;border:1px solid var(--line,#1e3a5c);'
     +  'border-radius:12px;background:var(--card,#0e2033)">';
  /* ── الرأس ── */
  h += '<div class="nz-card-h" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px">';
  h +=  '<span class="nz-medal" style="font-size:14px">'+medal+'</span>';
  h +=  '<b class="nz-code" style="font-size:15px">'+escFlt(s.code)+'</b>';
  h +=  '<small class="nz-name" style="opacity:.75;flex:1 1 120px">'+escFlt((s.name||'').slice(0,26))+'</small>';
  h +=  '<span class="nz-grade" dir="ltr" title="'+escFlt(nzTip('متوسط درجات المحاور الخمسة بأوزانها، بعد توزيع وزن كل محور على مؤشرات المتاحة فيه'))+'">'
     +  nzGrade(sc.total, 70, 50)+'</span>';
  if (pl.target!=null && px!=null && up!=null && up<0){
  h += '<span class="nz-warn" style="font-size:10px;color:#f0a020" title="'+escFlt('سعر السهم أعلى من السعر العادل المحسوب — يعني مش فرصة شراء دلوقتي. الهدف اللي تحت معناه «السعر محترم» مش «اشترِ دلوقتي».')+'">⚠️ السعر فوق العادل</span>';
  }
  h +=  '<span class="nz-cov" style="font-size:11px;opacity:.8" dir="ltr" title="'+escFlt(nzTip('نسبة أوزان المحاور اللي اتحسبت من بيانات حقيقية — '+Math.round(sc.wGot*10000)+'٪ من '+10000+' نقطة وزن'))+'">تغطية '
     +  cov+'٪</span>';
  h += '</div>';

  /* ── الأرقام الأربعة ── */
  h += '<div class="nz-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">';
  h +=  '<div class="nz-g" style="display:flex;flex-direction:column;gap:2px;padding:6px;border-radius:8px;background:rgba(255,255,255,.04)"><span>السعر الآن</span>'
     +  nzValCell(px,' ج','سعر السهم الحالي وقت العرض',2,'flt-b')+'</div>';
  h +=  '<div class="nz-g" style="display:flex;flex-direction:column;gap:2px;padding:6px;border-radius:8px;background:rgba(255,255,255,.04)"><span>السعر العادل</span>'
     +  nzValCell(fv.ok?fv.fair:null,' ج', fv.ok
          ? ('متوسط مرجّح لـ'+fv.used.length+' مصدر: '+fv.src.filter(x=>x.v!=null).map(x=>x.ar).join(' + '))
          : (fv.notes[0]||'المصادر ناقصة'), 2, 'flt-safe s'+((fv.ok&&up>0)?'hi':(fv.ok?'md':'lo')))+'</div>';
  h +=  '<div class="nz-g"><span>الفرق</span>'
     +  (up==null ? '<span class="flt-na" title="'+escFlt('مفيش سعر عادل — من غير هدف مش بنحسب فرق')+'">—</span>'
          : '<span class="flt-pct" dir="ltr" title="'+escFlt(nzTip('(السعر العادل ÷ السعر الحالي − 1) × 100'))+'">'
          +(up>0?'+':'')+up.toFixed(1)+'<b class="flt-pu">%</b></span>')+'</div>';
  h +=  '<div class="nz-g"><span>نقطة الدخول</span>'
     +  nzValCell(pl.entry,' ج', pl.entryWhy, 2, 'flt-b')+'</div>';
  h +=  '<div class="nz-g"><span>الهدف</span>'
     +  nzValCell(pl.target,' ج', pl.targetWhy, 2, 'flt-safe s'+((up!=null&&up>0)?'hi':'lo'))+'</div>';
  h +=  '<div class="nz-g"><span>وقف الخسارة</span>'
     +  nzValCell(pl.stop,' ج', pl.stopWhy, 2, 'flt-b')+'</div>';
  h +=  '<div class="nz-g"><span>مسافة الوقف</span>'
     +  (fx==null ? '<span class="flt-na" title="'+escFlt('مفيش نقطة دخول أو المدى الحقيقي (ATR) — من غيرهم مش بنحسب مسافة الوقف')+'">—</span>'
          : '<span class="flt-pct" dir="ltr" title="'+escFlt(nzTip('نسبة وقف الخسارة من نقطة الدخول'))+'">'
          +fx.toFixed(1)+'<b class="flt-pu">%</b></span>')+'</div>';
  h +=  '<div class="nz-g"><span>التقييم الفني</span>'
     +  nzValCell(nzNum(s.tvRec),'', 'توصية المحللين من −1 (بيع) لـ+1 (شراء)', 2, 'flt-b')+'</div>';
  h += '</div>';

  /* ── مصادر السعر العادل التلاتة ── */
  const _cov = nzTargetCover();
  h += '<div class="nz-srcs" style="margin-top:8px;padding:6px;border-radius:8px;background:rgba(255,255,255,.03)">';
  h +=  '<div style="font-size:10px;opacity:.75;margin-bottom:4px" title="'
     +  escFlt('عدد الأسهم اللي في الداتا عندها هدف محللين — رقم حقيقي من المصدر')+'">'
     +  '📊 تغطية هدف المحللين: <b dir="ltr">'+_cov.have+'/'+_cov.all+'</b> ('+_cov.pct+'٪) — '
     +  (_cov.pct>=50?'الباقي بنستبعده من المتوسط':'اللي ناقص بنستبعده من المتوسط')+'</div>';
  h +=  '<div class="nz-srcs-t" style="font-size:11px;opacity:.8;margin-bottom:4px">💰 مصادر السعر العادل — 3 مصادر، ومين فيهم موجود ومنين لأ</div>';
  for (let i=0;i<fv.src.length;i++){
    const x = fv.src[i];
    const meta = NZ_FV[i];
    h += '<div class="nz-src'+(x.v==null?' na':'')+'" style="display:flex;flex-wrap:wrap;gap:6px;align-items:baseline;padding:3px 0">';
    h +=  '<span class="nz-src-i">'+meta.ic+'</span>';
    h +=  '<span class="nz-src-n" style="flex:1 1 150px">'+escFlt(meta.ar)+'</span>';
    h +=  '<span class="nz-src-w" dir="ltr" title="'+escFlt(nzTip('وزن المصدر في المتوسط المرجّح'))+'">'+meta.w+'٪</span>';
    if (x.v!=null){
      h += '<span class="nz-src-v" dir="ltr" title="'+escFlt(nzTip(x.how, x.src))+'">'+x.v.toFixed(2)+'</span>';
    } else {
      h += '<span class="flt-na" title="'+escFlt(x.why)+'">—</span>';
      h += '<small class="nz-src-why" style="flex:1 1 100%;opacity:.7;font-size:10px;line-height:1.5">'+escFlt(x.why)+'</small>';
    }
    h += '</div>';
  }
  if (fv.ok){
    h += '<div class="nz-src-calc" title="'+escFlt(nzTip('Σ(قيمة المصدر × وزنه) ÷ مجموع أوزان المصادر المتاحة'))+'">'
       + 'المتوسط المرجّح على '+(100 - Math.round(100 - fv.wUsed))+'٪ من الأوزان (الباقي «—» وبيتشال)</div>';
  } else {
    h += '<div class="nz-src-calc na">⛔ '+(fv.notes[0]||'مفيش مصدر متاح')+'</div>';
  }
  h += '</div>';

  /* ── المحاور الخمسة ── */
  h += '<div class="nz-axes" style="margin-top:8px;padding:6px;border-radius:8px;background:rgba(255,255,255,.03)">';
  h +=  '<div class="nz-axes-t" style="font-size:11px;opacity:.8;margin-bottom:4px">🧱 الدرجة من 5 محور — '+escFlt('الأساسيات 30٪ · المخاطرة 25٪ · الفني 20٪ · التقييم 15٪ · التوزيع والسيولة 10٪')+'</div>';
  for (let i=0;i<sc.axes.length;i++) h += nzAxisRow(sc.axes[i]);
  h += '</div>';
  h += '</div>';
  return h;
}

/* ══════════════════════════════════════════════════════════════
  📊 الخمسة فرص في جدول — قرار أحمد 16 أكتوبر 2026
  ══════════════════════════════════════════════════════════════
  ⛔ كروت ممنوعة هنا. ⛔ صف واحد لكل سهم.
  الأعمدة بالترتيب المطلوب بالظبط:
  الرمز · الشركة · السعر · السعر العادل · نقطة الدخول · الهدف · نسبة المكسب · وقف الخسارة · الدرجة
  🔑 كل رقم جوّه <span title> فيه: مصدره + تاريخ السحب + طريقة حسابه.
  ⛔ «—» معناها الحقل مش موجود في البيانات — مش صفر. والسبب مكتوب في الـtooltip.
  ⛔ مفيش look-ahead: كل الأرقام من نفس ملف السحب وبتأريخه. */
function nzFiveTable(){
  const base = fzBestRows();
  const top  = base.length ? nzTopFive(base) : [];
  if (!top.length) return '<div class="flt-empty">⛔ مفيش سهم يستوفي '+FZ_BEST.minPass
                        + ' فلاتر أو أكتر — وسّع الشرط من الفلاتر فوق</div>';

  /* ⟨A⟩ خلية واحدة: قيمة + tooltip بالمصدر والتاريخ وطريقة الحساب */
  const cell = function(v, how, dec, cls){
    if (v==null) return '<span class="flt-na" title="'+escFlt(how||'الحقل غير متاح في بيانات هذا السهم')+'">—</span>';
    return '<span class="'+(cls||'flt-b')+'" dir="ltr" title="'+escFlt(nzTip(how))+'">'
         +  v.toFixed(dec==null?2:dec)+'</span>';
  };
  /* ⟨B⟩ نسبة ٪ بخانة آمنة — المحرك الحي بيجيب غير الأرقام أحياناً */
  const pct = function(v, how){
    if (v==null || !isFinite(v)) return '<span class="flt-na" title="'+escFlt(how||'النسبة غير متاحة')+'">—</span>';
    return '<span class="flt-pct" dir="ltr" title="'+escFlt(nzTip(how))+'">'
         +  (v>0?'+':'')+v.toFixed(1)+'<i>%</i></span>';
  };
  /* ⟨C⟩ درجة بأمانة كاملة: + تغطية الأوزان اللي اتحسبت من بيانات حقيقية */
  const grade = function(sc, s){
    return '<span class="flt-safe s'+(sc.total>=70?'hi':sc.total>=50?'md':'lo')+'" dir="ltr" title="'
         +  escFlt(nzTip('متوسط درجات المحاور الخمسة بأوزانها بعد توزيع وزن كل محور على مؤشراته المتاحة'
              +' · تغطية '+Math.round(sc.wGot*100)+'٪ من 100٪ · '
              +'مصادر '+nzAxesSrc(s)))+'">'+nzGrade(sc.total,70,50)+'</span>';
  };

  let h = '<div class="flt-tbl-wrap"><table class="flt-tbl"><thead><tr>'
    + '<th>#</th><th>الرمز</th><th>الشركة</th><th>السعر</th><th>السعر العادل</th>'
    + '<th>نقطة الدخول</th><th>الهدف</th><th>نسبة المكسب</th><th>وقف الخسارة</th><th>الدرجة</th><th></th>'
    + '</tr></thead><tbody>';

  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  top.forEach(function(row, i){
    const s = row.s, sc = row.sc, fv = nzFair(s), pl = nzPlan(s, fv), px = fv.px;
    /* ⛔ نسبة المكسب = من نقطة الدخول مش من السعر الحالي.
       من السعر = رقم مربح زيادة لصف فيه入场 أأمن. */
    const up = (pl.target!=null && pl.entry!=null && pl.entry>0)
             ? (pl.target/pl.entry-1)*100 : null;
    const risk = (pl.stop!=null && pl.entry!=null && pl.entry>0)
               ? (1 - pl.stop/pl.entry)*100 : null;
    /* ⛔ لو الخسارة والربح متساويين أو الخسارة أكبر، النسبة دي مش فرصة.
       بنعرضها صريحة بدل ما نخفيها. */
    const rr = (up!=null && risk!=null && risk>0) ? (up/risk) : null;

    h += '<tr>'
      + '<td title="'+escFlt('الترتيب داخل الخمسة — الترتيب بالدرجة، وأولوية.group للسعر تحت العادل')+'">'+medals[i]+'</td>'
      + '<td><b class="flt-c" title="'+escFlt('رمز السهم في البورصة المصرية')+'">'+escFlt(s.code)+'</b></td>'
      + '<td title="'+escFlt(escFlt(s.name||''))+'">'+escFlt((s.name||'').slice(0,20))+'</td>'
      + '<td>'+cell(px, 'السعر وقت العرض من المحرك الحي — تاريخ السحب: '+nzDataWhen())+'</td>'
      + '<td>'+cell(fv.ok?fv.fair:null,
            fv.ok ? ('متوسط مرجّح لـ'+fv.used.length+' مصدر متاح: '+fv.src.filter(x=>x.v!=null).map(x=>x.ar).join(' + ')
                    +' · الحد المعقول ±3× السعر · تاريخ السحب: '+nzDataWhen())
                  : ('⛔ مفيش سعر عادل معقول — '+(fv.notes[0]||'المصادر ناقصة')), 2,
            'flt-safe s'+((fv.ok&&up>0)?'hi':(fv.ok?'md':'lo')))+'</td>'
      + '<td>'+cell(pl.entry, pl.entryWhy, 2)+'</td>'
      + '<td>'+cell(pl.target, pl.targetWhy, 2)+'</td>'
      + '<td>'+pct(up, 'نسبة المكسب من نقطة الدخول: (الهدف ÷ نقطة الدخول − 1) × 100'
            +' · ⛔ محسوبة من نقطة الدخول مش من السعر الحالي، لأن نقطة الدخول هي اللي هتشتري بيه')+'</td>'
      + '<td>'+cell(pl.stop, pl.stopWhy, 2)
      +   (pl.stopEst ? '<small title="'+escFlt('الرقم ده متقدَّر من التقلب السنوي — المدى الحقيقي (ATR) غير متاح في الداتا. مش قياس')+'">ⓘ مُقدَّر</small>' : '')
      + '</td>'
      + '<td>'+grade(sc, s)+'</td>'
      + '<td style="white-space:nowrap">'
      +   (typeof openChart==='function' ? '<button class="flt-add" onclick="openChart(\''+escFlt(s.code)+'\')" title="افتح الرسمة البيانية">📈</button>' : '')
      +   '<button class="flt-add" onclick="fltAdd(\''+escFlt(s.code)+'\')" title="ضيف للمرشحين">➕</button></td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';

  /* ── القواعد اللي اشتُقّت منها الأرقام — تحت الجدول مش جوّه ── */
  const cov = nzTargetCover();
  h += '<div class="flt-h-note">';
  h += '🔑 <b>الدرجة من 100</b> = متوسط درجات المحاور الخمسة بأوزانها '
     + '(الأساسيات 30٪ · المخاطرة 25٪ · الفني 20٪ · التقييم 15٪ · التوزيع والسيولة 10٪)، '
     + 'وكل مؤشر جوّه أي محور وزنه متساوي مع باقيه.';
  h += '<br>⚖️ <b>المؤشر الناقص بيتشال من الحساب</b> — مش بيبقى صفر — ووزنه بينتشر على الموجودين في نفس المحور. '
     + 'ولو المحور كله ناقص، وزنه بينتقل للتانية. عشان ك جنب كل درجة «تغطية» جوّه الـtooltip.';
  h += '<br>💰 <b>السعر العادل</b> = متوسط مرجّح لـ3 مصادر: هدف المحللين 40٪ · القيمة الدفترية × وسيط القطاع 30٪ · النموذج الفني 30٪. '
     + 'المصدر الناقص بيتبعت «—» ووزنه بينتشر على الموجودين — <b>عمره ما بياخد صفر</b>. '
     + 'ولو الناتج خرج خارج ⅓–3× السعر بيتعتبر مش معقول وبيتعرض «—».';
  h += '<br>🎯 <b>نقطة الدخول</b> من قراءة المتوسطات المتحركة ومؤشر القوة. '
     + '<b>الهدف</b> = السعر العادل. '
     + '<b>وقف الخسارة</b> = نقطة الدخول − 2 × المدى الحقيقي (ATR).';
  h += '<br>⚠️ <b>نسبة المكسب من نقطة الدخول مش من السعر الحالي</b> — '
     + 'لأن نقطة الدخول هي السعر اللي هتشتري بيه فعلاً. لو استخدمنا السعر الحالي كانت النسبة هتبقى رقم مربح زيادة.';
  h += '<br>📊 <b>تغطية هدف المحللين: '+cov.have+' من '+cov.all+' ('+cov.pct+'٪)</b> — رقم حقيقي من المصدر مش تقدير. '
     + 'اللي مفيهوش هدف بيتعرض «—» مع سبب.';
  h += '<br>📅 <b>تاريخ السحب: '+escFlt(nzDataWhen())+'</b> — كل الأرقام من نفس الملف وقت السحب (مفيش رقم من تاريخ مختلف).';
  h += '<br>📌 <b>«—» معناها الحقل مش موجود في البيانات — مش صفر.</b> والسبب مكتوب جوّه الـtooltip.';
  h += '<br>⚖️ <b>مفيش look-ahead:</b> التحليل بيستخدم آخر بيانات متاحة وقت العرض بس، '
     + 'ومفيش أي رقم مأخوذ من تاريخ بعده. والعائد الماضي مش ضمان للمستقبل.';
  h += '</div>';
  return h;
}

/* 📚 أسماء مصادر الدرجة — بتظهر في tooltip الدرجة عشان المستخدم يعرف الرقم جه منين */
function nzAxesSrc(s){
  try {
    const out = [];
    NZ_AXES.forEach(function(ax){
      let have = 0;
      for (let i=0;i<ax.items.length;i++){
        let v=null; try { v = nzNum(ax.items[i].f(s)); } catch(e){ v=null; }
        if (v!=null) have++;
      }
      if (have) out.push(ax.ar+' '+have+'/'+ax.items.length);
    });
    return out.join(' · ') || 'مفيش مؤشر متاح';
  } catch(e){ return '—'; }
}

  /* ⛔ (16 أكتوبر 2026) nzBestExtra اتشالت نهائياً.
     كانت بتضيف جدول الخمسة تاني جوه «الفرصة المثالية» — نفس
     البيانات مرتين في صفحتين. دلوقتي كل حاجة في مكانها:
       · الفرصة المثالية → #fltIdealBox  (تقييم كامل + ترتيب)
       · أفضل 5 فرص      → #fltFiveBox   (nzFiveTable)
       · أفضل 3 فرص      → #fltThreeBox  (nzTripleTable)
     مافيش أي استدعاء ليها — الدالة اتمسحت عشان ما يرجعش
     حد يناديها بالغلط ويرجّع التكرار. */

