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
      if (s.beta      != null && s.beta      > f.beta)   return false;
      if (s.vol1y     != null && s.vol1y     > f.vol)    return false;
      if (s.mdd1y     != null && s.mdd1y     > f.mdd)    return false;
      if (s.sharpe3y  != null && s.sharpe3y  < f.sharpe) return false;
    }
    return true;
  });
}

/* 🎯 درجة الأمان 0-100 */
function fltSafetyScore(s){
  let sc = 0;
  if (s.vol1y   != null) sc += (s.vol1y   < 25 ? 32 : s.vol1y   < 35 ? 26 : s.vol1y   < 50 ? 17 : 8);
  if (s.mdd1y   != null) sc += (s.mdd1y   < 20 ? 32 : s.mdd1y   < 35 ? 26 : s.mdd1y   < 50 ? 16 : 6);
  if (s.sharpe3y!= null) sc += (s.sharpe3y> 1  ? 20 : s.sharpe3y>0.5 ? 14 : s.sharpe3y>0 ? 8 : 3);
  if (s.beta    != null) sc += (s.beta    < 0.8 ? 16 : s.beta    < 1.1 ? 11 : s.beta    < 1.3 ? 6 : 2);
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

function fltBadge(v, good, bad, invert){
  if (v == null) return '<span class="flt-na">—</span>';
  const ok = invert ? (v <= good) : (v >= good);
  const bd = invert ? (v >= bad)  : (v <= bad);
  return '<span class="flt-b '+(ok?'ok':bd?'bad':'mid')+'">'+fltNum(v)+'</span>';
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
     +   '<div class="flt-h-exi"><b>🛡 آمن</b><span>سهم هادي</span><em>السوق <span class="flt-ltr">−10%</span> ← هو <span class="flt-ltr">−3%</span></em></div>'
     +   '<div class="flt-h-exi bad"><b>⚠️ خطر</b><span>سهم عنيف</span><em>السوق <span class="flt-ltr">−10%</span> ← هو <span class="flt-ltr">−73%</span></em></div>'
     + '</div></div>';

  /* ② الأرقام الأربعة */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📊</span> الأرقام اللي بنقيس بيها — ومعناها إيه</div>';
  h += '<div class="flt-h-metric"><b>① معامل المخاطرة (Beta)</b>'
     + '<p><b>السهم بيتحرك قد إيه مع السوق؟</b></p>'
     + '<p>السوق نزل <span class="flt-ltr">10%</span> وهو نزل <span class="flt-ltr">10%</span> ⇒ <b>Beta = 1</b> (مثل السوق)</p>'
     + '<p>السوق نزل <span class="flt-ltr">10%</span> وهو نزل <span class="flt-ltr">3%</span> ⇒ <b>Beta = 0.3</b> (هادي)</p>'
     + '<p>السوق نزل <span class="flt-ltr">10%</span> وهو نزل <span class="flt-ltr">25%</span> ⇒ <b>Beta = 2.5</b> (عنيف)</p>'
     + '<p class="flt-h-note">⚡ لما يشوف «◈ منفصل» معناها Beta تحت 0.15 — السهم مش بيهم مع السوق خالص. '
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
     +   '<div class="flt-h-wi"><span>التذبذب</span><b>32</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>هبوط السنة</span><b>32</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>شارب</span><b>20</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>Beta</span><b>16</b><i>من 100</i></div>'
     + '</div>'
     + '<p class="flt-h-p" style="margin-top:10px">لو السهم تذبذب قليل وهبط قليل وشاربه كويس '
     + '⇒ درجته <b>100 ★</b>. ولو العكس ⇒ درجته قريبة من الصفر.</p>'
     + '<div class="flt-h-legend">'
     +   '<span class="hi">85-100 · 🟢 آمن جداً</span>'
     +   '<span class="md">65-84 · 🟡 آمن</span>'
     +   '<span class="lo">0-64 · 🔴 خطر</span>'
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
     +   '<div class="flt-h-li"><b>COPR</b><span>العقارية للبنوك الوطنية</span><em>−<span class="flt-ltr">100%</span></em></div>'
     +   '<div class="flt-h-li"><b>ISMA</b><span>السماعيلية للدواجن</span><em>−<span class="flt-ltr">99%</span></em></div>'
     +   '<div class="flt-h-li"><b>RAYA</b><span>راية</span><em>−<span class="flt-ltr">99%</span></em></div>'
     +   '<div class="flt-h-li"><b>EPCO</b><span>إجيبكو</span><em>−<span class="flt-ltr">99%</span></em></div>'
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

  h += '</div></div>';   /* فاصل flt-help-b + flt-help */
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
     + '<p class="flt-sub">أسهم أقل مخاطرة — مبني على تاريخ حقيقي 26 سنة</p></div>'
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
     + '<div><b>'+fltNum(avgB.length?avgB.reduce((a,s)=>a+s.beta,0)/avgB.length:0,2)+'</b><span>متوسط Beta</span></div>'
     + '</div>';

  if (!rows.length){
    box.innerHTML = h + '<div class="flt-empty">⛔ مفيش أسهم بتستوفي الشروط دي<br>'
      + '<button class="dv-tab" onclick="fltReset()">وسّع الفلاتر</button></div>';
    return;
  }

  const CAP = 150;
  h += '<div class="flt-tbl-wrap"><table class="flt-tbl"><thead><tr>'
     + '<th>السهم</th><th>🛡 الأمان</th><th>Beta</th><th>تذبذب</th><th>هبوط سنة</th>'
     + '<th>هبوط كلي</th><th>شارب</th><th>القطاع</th><th>OCTA</th><th></th>'
     + '</tr></thead><tbody>';
  rows.slice(0,CAP).forEach(function(s){
    h += '<tr>'
      + '<td><b class="flt-c">'+s.code+'</b><small>'+escFlt((s.name||'').slice(0,22))+'</small></td>'
      + '<td><span class="flt-safe s'+(s._safe>=85?'hi':s._safe>=65?'md':'lo')+'">'+s._safe+'</span>'
      +   (s._safe>=100?'<span class="flt-tie" title="أمان كامل">★</span>':'')+'</td>'
      + '<td>'+fltBeta(s.beta)+'</td>'
      + '<td>'+fltBadge(s.vol1y, 35, 50, 1)+'%</td>'
      + '<td>'+fltBadge(s.mdd1y, 35, 50, 1)+'%</td>'
      + '<td>'+fltBadge(s.mdd, 60, 85, 1)+'%</td>'
      + '<td>'+fltBadge(s.sharpe3y, 0.5, 0, 0)+'</td>'
      + '<td class="flt-sect">'+escFlt(s.sectorAr||'—')+'</td>'
      + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
      +   escFlt(s.decision||'—')+'</span><small>'+fltNum(s.score,0)+'% · ثقة '+(s.scoreConf||0)+'%</small></td>'
      + '<td><button class="flt-add" onclick="fltAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول '+CAP+' من '+rows.length+' — ضيّق الفلاتر عشان تشوف الكل</div>';

  box.innerHTML = h;
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
    if (!s.dy || s.dy <= 0) return false;          /* لازم يوزّع أصلاً */
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
  if (dy < 1)        sc += 5;
  else if (dy < 3)   sc += 22;
  else if (dy < 5)   sc += 32;
  else if (dy < 8)   sc += 28;
  else if (dy < 12)  sc += 18;
  else if (dy < 18)  sc += 10;
  else               sc += 4;    /* ⚠️ 18%+ = علامة استفهام مش ميزة */
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
     + '<p class="flt-h-p">شركات كتير بتدفع لك extra كل سنة لوحدها. لو اشتريت بـ<b>10,000 جنيه</b> '
     + 'وعائد السهم <b>5%</b>، هيدفعلك <b>500 جنيه كل سنة</b> من غير ما تبيع.</p>'
     + '<p class="flt-h-p"><b>الفلتر ده بيطلعلك الأسهم اللي بتوزّع — وبيحذّرك من الغلطة الشائعة.</b></p></div>';

  /* ⚠️ الفخ — أهم جزء */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">⚠️</span> الغلطة اللي ناس كتير بتعملها</div>'
     + '<p class="flt-h-p"><b>«السهم ده توزيعه 40%! واصلة لـ 26.6% — ده استثناء نادر></b> — غلط.</p>'
     + '<p class="flt-h-p">العالي كده معناه غالباً إن الشركة <b>مفيش منها فايض</b> وبتوزّع الباقي مرة واحدة. '
     + 'السنة الجاية ممكن مايدفعش خالص.</p>'
     + '<div class="flt-h-ex">'
     +   '<div class="flt-h-exi bad"><b>❌ MEGM</b><span>عائد 42% · تقييم 24%</span>'
     +     '<em>توزيع خرافي على شركة ضعيفة — خطير</em></div>'
     +   '<div class="flt-h-exi"><b>✅ DEIN</b><span>عائد 16% · تقييم 80%</span>'
     +     '<em>عائد عالي + شركة سليمة — ده كنز</em></div>'
     + '</div>'
     + '<p class="flt-h-note">📌 لاحظ: في السوق <b>2 من 12</b> سهم عندهم عائد فوق 8% لكن تقييمهم أقل من 50%. '
     + 'دي الـtraps بتاعتنا. الفلتر بيملّش عليها.</p></div>';

  /* المعايير */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🎚️</span> الدرجة بتتحسب إزاي (من 100)</div>'
     + '<div class="flt-h-w">'
     +   '<div class="flt-h-wi"><span>العائد</span><b>46</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>صحة الشركة</span><b>40</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>نضج البيانات</span><b>14</b><i>من 100</i></div>'
     + '</div>'
     + '<p class="flt-h-note">⚠️ لاحظ العائد وبياخد <b>46</b> بس — ومفيش سهم فوق 8% بياخد أكتر من <b>28</b> من الجزء ده. '
     + 'لأن العائدCrazy فوق 15% بيتحاسب عليه كـ«مؤقت».</p></div>';

  /* الفلاتر */
  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📊</span> الفلاتر ومعناها</div>'
     + '<table class="flt-h-tbl"><thead><tr><th>الفلتر</th><th>الرقم</th><th>ليه؟</th></tr></thead><tbody>'
     + '<tr><td>أقل عائد</td><td>0%</td><td>الحد الأدنى — أقله نكوّنش مقنع</td></tr>'
     + '<tr><td>أعلى عائد</td><td>99%</td><td>مفيش حد — لو عايز كل الموزعين</td></tr>'
     + '<tr><td>أقل تقييم</td><td>0</td><td>تقدر ترفعه لإخفاء الأسهم الضعيفة</td></tr>'
     + '<tr><td>🔒 شركة سليمة</td><td>مقفول</td><td>يتجاهل الأسهم اللي نزلت أكتر من 55% في سنة</td></tr>'
     + '<tr><td>القطاع</td><td>الكل</td><td>يديك bank وبركهفقط — أو كل القطاعات</td></tr>'
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
     + 'الشركات بتقلّل أو توقف التوزيعات لو Profits قلّت. '
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
     +   '<input type="range" id="fli-dyMin" min="0" max="20" step="0.5" value="'+f.dyMin+'" '
     +   'oninput="fltIncSet(\'dyMin\',this.value)"></div>'
     + '<div class="flt-sl"><label>أعلى عائد <b>'+(f.dyMax>90?'∞':f.dyMax)+'</b>%</label>'
     +   '<input type="range" id="fli-dyMax" min="1" max="99" step="1" value="'+f.dyMax+'" '
     +   'oninput="fltIncSet(\'dyMax\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقل تقييم OCTA <b>'+f.minScore+'</b></label>'
     +   '<input type="range" id="fli-score" min="0" max="80" step="5" value="'+f.minScore+'" '
     +   'oninput="fltIncSet(\'minScore\',this.value)"></div>'
     + '<div class="flt-sl"><label>القطاع <b>'+escFlt(f.sector)+'</b></label>'
     +   '<select class="fli-sel" onchange="fltIncSet(\'sector\',this.value)">'
     +   '<option value="all">كل القطاعات</option>'
     +   secs.map(x=>'<option value="'+escFlt(x)+'"'+(f.sector===x?' selected':'')+'>'+escFlt(x)+'</option>').join('')
     +   '</select></div>'
     + '<label class="fli-check"><input type="checkbox"'+(f.safeOnly?' checked':'')+' '
     +   'onchange="fltIncSet(\'safeOnly\',this.checked)"> 🔒 شركة سليمة فقط</label>'
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
      +   Math.round(s.score||0)+'</span></td>'
      + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
      +   escFlt(s.decision||'—')+'</span><small>ثقة '+(s.scoreConf||0)+'%</small></td>'
      + '<td>'+(s.mdd1y!=null?'<span class="flt-b '+(s.mdd1y<35?'ok':s.mdd1y<55?'mid':'bad')+'">'+fltNum(s.mdd1y,0)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td class="flt-warn">'+fltWarnCell(warns,'✅ آمن')+'</td>'
      + '<td><button class="flt-add" onclick="fltIncAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length
    +'</b> سهم موزّع — ضيّق الفلاتر عشان تشوف الكل</div>';
  box.innerHTML = h;
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
    if (s.perf3m == null) return false;             /* لازم أداء 3 شهور */
    if (fltIsSplit(s)) return false;                /* 🚫 قسمة — أرقام مضلّلة */
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
  if (p3 < 0)        sc += 8;
  else if (p3 < 10)   sc += 18;
  else if (p3 < 25)   sc += 26;
  else if (p3 < 50)   sc += 25;
  else if (p3 < 100)  sc += 16;
  else if (p3 < 200)  sc += 8;
  else                sc += 3;    /* ⚠️ طيران — غالباً وصل القمة */
  /* ② أداء الشهر — تأكيد إن الحركة لسه مستمرة */
  if (p1 > 5)       sc += 16;
  else if (p1 > 0)  sc += 12;
  else if (p1 > -5) sc += 7;
  else              sc += 2;
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
     + '<p><b>RSI = مؤشر القوة النسبي</b> — بيقيس من 100: السوق كله بيقارنه بيه.</p>'
     + '<p>RSI تحت 30 ⇒ السوق زهق منه (تشبع بيعي)</p>'
     + '<p>RSI من 45 لـ65 ⇒ فيه توازن — المنطقة الصح</p>'
     + '<p>RSI فوق 70 ⇒ الناس اشترت كله — <b>تشبع شرائي</b> ⚠️</p>'
     + '<p class="flt-h-note">⚡ <b>أهم حاجة:</b> لما RSI فوق 70، الفلتر بيخفي السهم تلقائياً. '
     + 'لأنك لو اشتريت هنا — ممكن تشتري في القمة. '
     + 'مثال: في السوق دلوقتي <b>36 سهم</b> فيهم RSI فوق 70.</p></div>'
     + '<div class="flt-h-metric"><b>③ توصية TradingView</b>'
     + '<p><b>محركSetup كبير في العالم بيقول إيه؟</b></p>'
     + '<p>رقم موجب = TradingView شايف السهم مشتري · سالب = مش بيشتري</p>'
     + '<p class="flt-h-note">📌 دي مش توصينا — دي رأي محرك تاني. '
     + 'بنستخدمها كـ«تأكيد خارجي» مش كـ«قرار».</p></div></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🏅</span> الدرجة من 100</div>'
     + '<div class="flt-h-w">'
     +   '<div class="flt-h-wi"><span>أداء 3 شهور</span><b>40</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>استمرار</span><b>16</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>مؤشر القوة</span><b>16</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>التوصية + الصحة</span><b>28</b><i>من 100</i></div>'
     + '</div>'
     + '<p class="flt-h-note">⚠️ لاحظ: السهم اللي زاد <b>300%</b> م/biاخدش 40 من أول 40 نقطة — '
     + 'بياخد <b>3</b> بس. لأن الحركةExtreme غالباً بتخلص.</p></div>';

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
     + '<p class="flt-h-p">📌 في ناس بتقول «Zigzag كله صعود» — بس بعد ما خلص. '
     + 'الفلتر بيقولك: <b>دلوقتي وقت الدخول ولا وقت الانتظار؟</b></p></div>';

  h += '<div class="flt-h-warn">⚠️ <b>مهم:</b> الزخم سلاح ذو حدّين — السهم اللي بيتحرك بسرعة '
     + 'ينفعت كمان ينزل بسرعة. وأكثر الأسهم بتغيّر اتجاهها فجأة. '
     + 'الزخم مش buy-and-hold — ده أداة لحركة على المدى القصير. '
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
     +   '<input type="range" id="flm-p3min" min="-70" max="100" step="5" value="'+f.p3min+'" '
     +   'oninput="fltMomSet(\'p3min\',this.value)"></div>'
     + '<div class="flt-sl"><label>أعلى أداء 3 شهور <b>'+f.p3max+'</b>%</label>'
     +   '<input type="range" id="flm-p3max" min="10" max="400" step="10" value="'+f.p3max+'" '
     +   'oninput="fltMomSet(\'p3max\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقل مؤشر القوة <b>'+f.rsiMin+'</b></label>'
     +   '<input type="range" id="flm-rsiMin" min="0" max="70" step="5" value="'+f.rsiMin+'" '
     +   'oninput="fltMomSet(\'rsiMin\',this.value)"></div>'
     + '<div class="flt-sl"><label>أعلى مؤشر القوة <b>'+(f.rsiMax>=100?'∞':f.rsiMax)+'</b></label>'
     +   '<input type="range" id="flm-rsiMax" min="30" max="100" step="5" value="'+f.rsiMax+'" '
     +   'oninput="fltMomSet(\'rsiMax\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقل تقييم OCTA <b>'+f.minScore+'</b></label>'
     +   '<input type="range" id="flm-score" min="0" max="70" step="5" value="'+f.minScore+'" '
     +   'oninput="fltMomSet(\'minScore\',this.value)"></div>'
     + '<div class="flt-sl"><label>القطاع <b>'+escFlt(f.sector)+'</b></label>'
     +   '<select class="fli-sel" onchange="fltMomSet(\'sector\',this.value)">'
     +   '<option value="all">كل القطاعات</option>'
     +   secs.map(x=>'<option value="'+escFlt(x)+'"'+(f.sector===x?' selected':'')+'>'+escFlt(x)+'</option>').join('')
     +   '</select></div>'
     + '<label class="fli-check"><input type="checkbox"'+(f.needConfirm?' checked':'')+' '
     +   'onchange="fltMomSet(\'needConfirm\',this.checked)"> 🎯 أخفِ التشبع الشرائي</label>'
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
     + '<th>القوة</th><th>TradingView</th><th>OCTA</th><th>ملاحظات</th><th></th>'
     + '</tr></thead><tbody>';
  rows.slice(0,CAP).forEach(function(s){
    const warns = fltMomWarn(s);
    h += '<tr>'
      + '<td><b class="flt-c">'+s.code+'</b><small>'+escFlt((s.name||'').slice(0,20))+'</small></td>'
      + '<td><span class="flt-safe s'+(s._mom>=70?'hi':s._mom>=50?'md':'lo')+'">'+s._mom+'</span></td>'
      + '<td><span class="flt-pct '+(s.perf3m>0?'up':'dn')+'">'
      +   (s.perf3m>0?'+':'')+fltNum(s.perf3m,0)+'<b class="flt-pu">%</b></span></td>'
      + '<td>'+(s.perf1m!=null?'<span class="flt-pct '+(s.perf1m>0?'up':'dn')+'">'
      +   (s.perf1m>0?'+':'')+fltNum(s.perf1m,0)+'<b class="flt-pu">%</b></span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(s.perfYtd!=null?'<span class="flt-pct '+(s.perfYtd>0?'up':'dn')+'">'
      +   (s.perfYtd>0?'+':'')+fltNum(s.perfYtd,0)+'<b class="flt-pu">%</b></span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(s.rsi!=null?'<span class="flt-b '+(s.rsi<30?'ok':s.rsi<70?'mid':'bad')+'">'
      +   s.rsi.toFixed(0)+'</span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(s.tvRec!=null?'<span class="flt-b '+(s.tvRec>0?'ok':s.tvRec>-0.1?'mid':'bad')+'">'
      +   (s.tvRec>0?'+':'')+s.tvRec.toFixed(2)+'</span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
      +   escFlt(s.decision||'—')+'</span><small>'+Math.round(s.score||0)+'% · ثقة '+(s.scoreConf||0)+'%</small></td>'
      + '<td class="flt-warn">'+fltWarnCell(warns,'✅ زخم سليم')+'</td>'
      + '<td><button class="flt-add" onclick="fltMomAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length+'</b></div>';
  box.innerHTML = h;
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
const FZ_TABS = [
  { id:'safety', i:'🛡️', n:'الأمان',    box:'fltBox',    init:'fltInit',    render:'fltRender'    },
  { id:'income', i:'💰', n:'التوزيعات', box:'fltIncBox', init:'fltIncInit', render:'fltIncRender' },
  { id:'moment', i:'⚡', n:'الزخم',     box:'fltMomBox', init:'fltMomInit', render:'fltMomRender' },
  { id:'value',  i:'💎', n:'القيمة',    box:'fltValBox', init:'fzValInit', render:'fzValRender' },
  { id:'qual',   i:'🎯', n:'الجودة',    box:'fltQuaBox', init:'fzQualInit', render:'fzQualRender' },
  { id:'liquid', i:'💵', n:'السيولة',   box:'fltLiqBox', init:'fzLiqInit', render:'fzLiqRender' },
  { id:'growth', i:'📈', n:'النمو',     box:'fltGroBox', init:'fzGrowInit', render:'fzGrowRender' },
  { id:'cash',   i:'🏦', n:'التدفق',    box:'fltCfwBox', init:'fzCfwInit', render:'fzCfwRender' },
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
           : null; } catch(e){ out[t.id] = null; }
  });
  return out;
}

function fzRenderTabs(){
  const bar = document.getElementById('fzTabs'); if (!bar) return;
  const counts = fzCount();
  /* النجمة تلمع وهي نشطة بس — لو الكل فاتح يبان زي الباقي */
  bar.innerHTML = FZ_TABS.map(function(t){
    const n = counts[t.id];
    const badge = (n!=null) ? '<span class="fz-tab-n">'+n+'</span>' : '';
    return '<button class="fz-tab'+(FZ_ACTIVE===t.id?' on':'')+(t.soon?' soon':'')+'"'
      + (t.soon ? ' title="قريباً"' : ' onclick="fzGo(\''+t.id+'\')"')
      + '><span class="fz-tab-i">'+t.i+'</span><span>'+t.n+'</span>'+badge+'</button>';
  }).join('');
}

/* ══════════════════════════════════════════════════════════════
   🔒 البيانات الناقصة — لازم نقول للمستخدم بدل صفر صامت
   ──────────────────────────────────────────────────────────────
   ⛔⛔ الباج: لو الجلسة مش صالحة، الـdata_full والـegx_full بيرجعوا 401
   فالـOS_DB بيتقرا من ٩ حقول بس بدل ٦٩ → **كل** الفلاتر بترجع صفر
   والفيلتر شكله مكسور — والحقيقة إن مفيش داتا أصلاً.

   ⛌ الحل: نقوله بوضوح «سجّل دخولك» بدل ما نعرض أصفار ملهاش معنى.
   ══════════════════════════════════════════════════════════════ */
function fzHasFullData(){
  try {
    var db = (typeof OS_DB !== 'undefined') ? OS_DB : null;
    if (!db || !db.length) return false;
    for (var i = 0; i < Math.min(db.length, 25); i++){
      var s = db[i];
      if (!s) continue;
      if (s.mcap != null || s.pe != null || s.roe != null || s.av30 != null) return true;
    }
    return false;
  } catch(e){ return false; }
}

function fzDataWarn(){
  var tabs = document.getElementById('fzTabs');
  if (!tabs) return;
  var box = document.getElementById('fzDataWarn');
  if (fzHasFullData()){ if (box) box.remove(); return; }
  if (box) return;
  var w = document.createElement('div');
  w.id = 'fzDataWarn';
  w.className = 'fz-datawarn';
  w.innerHTML = '\u{1F512} <b>الفلتر محتاج بيانات كاملة</b>'
    + '<span>أنت داخل من غير جلسة صالحة، فالسيرفر رجّع بيانات مختصرة '
    + 'والفلاتر بترجع صفر — مش معناها مفيش أسهم.</span>';
  var b = document.createElement('button');
  b.type = 'button'; b.className = 'fz-datawarn-btn';
  b.textContent = 'تسجيل الدخول';
  b.onclick = function () {
    try { if (window.OCTAGate && window.OCTAGate.login) window.OCTAGate.login(); }
    catch (e) { location.reload(); }
  };
  w.appendChild(b);
  tabs.parentNode.insertBefore(w, tabs.nextSibling);
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
  fzDataWarn();
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
  if (typeof fzHeroRender === 'function') fzHeroRender();
  fzDataWarn();
  fzGo(FZ_ACTIVE || 'safety');
  /* ⛌ لو الجلسة اتجابت بعدين والداتا وصلت → شيل التحذير */
  var iv = setInterval(function () {
    if (fzHasFullData()){ var x = document.getElementById('fzDataWarn'); if (x) x.remove(); clearInterval(iv); }
  }, 3000);
  setTimeout(function () { clearInterval(iv); }, 120000);
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
    tip:'البنك الغالي مش لأن ربحه ضعيف، لأن سعر السهم فوق قيمته الحقيقية علىNingúnورق.'
  },
  'عقارات': {
    ar:'عقارات', use:['pb','roe','ps'], ban:['pe'],
    note:'العقارات بتتقاس بالقيمة الدفترية — الـP/E بيتشوّه بسبب أوાધه‌ยุ التقييم',
    tip:'شركة العقارات بتشتريKepital وتبني، فربحها بيقل مع الوقت. القيمة الدفترية أهم.'
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
    note:'القطاعات الدورية بتتقاس بـEV/EBITDA — الـP/E بيتغيّر مع commodity prices',
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
    if (f.minIndic && fzValCount(s) < f.minIndic) return false;   /* مفيش بيانات كفاية */
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
  if ((s.score||0) < 40 && (pe != null && pe < 8)) w.push('⚠️ رخيص بس الشركة ضعيفة — «مسTrap»');
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
     +   '<div class="flt-h-exi bad"><b>❌ غلط</b><span>P/E 9 في البنوك</span><em>القطاع كله 8.9 — مش رخيص</em></div>'
     +   '<div class="flt-h-exi"><b>✅ صح</b><span>P/E 9 في خدمة··ت</span><em>القطاع كله 20 — رخيص فعلاً</em></div>'
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
     + '<p>العقار بيشتريKepital ويبني، فالربح بينزل كل سنة والـP/E بيرتفع كده. القيمة الدفترية أصدق.</p>'
     + '<p class="flt-h-note">التجزئة: وسيط P/E في القطاع = <b>257</b> — رقم مشوّه تمامًا. '
     + 'شركات ربحها قريب من الصفر.</p></div></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">⚠️</span> الفخ: «رخيص» مش دايمًا «فرصة»</div>'
     + '<p class="flt-h-p">السهم الرخيص بيتcheap لأن <b>السوق خايف منه</b>. '
     + 'أحياناً السوق صح.</p>'
     + '<div class="flt-h-ex">'
     +   '<div class="flt-h-exi bad"><b>❌ فخ</b><span>P/E 2 · الشركة ضعيفة</span>'
     +     '<em>السوق عارف إنها وحشة — في كل الأحوال</em></div>'
     +   '<div class="flt-h-exi"><b>✅ فرصة</b><span>P/E 8 · الشركة سليمة</span>'
     +     '<em>السوق مش مبالٍ — وأرقامها كويسة</em></div>'
     + '</div>'
     + '<p class="flt-h-note">📌 عشان كده الفلتر بياخد <b>40 نقطة للتقييم</b> جوّه الدرجة. '
     + 'السهم الرخيص اللي perusahaan بتخسر مش بيتعرض.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📊</span> المؤشرات ومعناها</div>'
     + '<table class="flt-h-tbl"><thead><tr><th>المؤشر</th><th>معناه ببساطة</th><th>التغطية</th></tr></thead><tbody>'
     + '<tr><td>P/E</td><td>بكام جنيه بتدفع عن كل جنيه ربح</td><td>32%</td></tr>'
     + '<tr><td>P/B</td><td>بكام على القيمة الحقيقية على الورق</td><td><b>62%</b></td></tr>'
     + '<tr><td>P/S</td><td>بكام على كل جنيه مبيعات</td><td>35%</td></tr>'
     + '<tr><td>EV/EBITDA</td><td>أدق من P/E للindustrij</td><td>13%</td></tr>'
     + '</tbody></table>'
     + '<p class="flt-h-note">📌 <b>112 سهم من 296</b> مافيش عندهم أي مؤشر قيمة — الفلتر بيستبعدهم. '
     + 'و<b>105</b> عندهم 3 مؤشرات أو أكتر — دول اللي بيظهروا.</p></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🏅</span> الدرجة من 100</div>'
     + '<div class="flt-h-w">'
     +   '<div class="flt-h-wi"><span>المقياس الأساسي</span><b>46</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>المؤشر المساعد</span><b>16</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>مؤشرات أخرى</span><b>18</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>صحة الشركة</span><b>20</b><i>من 100</i></div>'
     + '</div>'
     + '<p class="flt-h-note">⚠️ لاحظ: <b>صحة الشركة 20</b> — مش 10. '
     + 'لأن السهم الرخيص المكسور هو أخطر حاجة في الفلتر ده.</p></div>';

  h += '<div class="flt-h-warn">⚠️ <b>مهم:</b> «رخيص» مش معناه «هيزيد». '
     + 'أسهم كتير رخيصة بتفضل رخيصة سنين. الفلتر بيقولك <b>إنت بتدفع كام مقارنة بالسوق</b> — '
     + 'القرارShardوحده. ودايماً اقرأ كارت القرار قبل ما تشتري.</div>';

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
     +   '<input type="range" id="fzv-pe" min="3" max="60" step="1" value="'+f.peMax+'" '
     +   'oninput="fzValSet(\'peMax\',this.value)"></div>'
     + '<div class="flt-sl"><label>أعلى P/B <b>'+f.pbMax+'</b></label>'
     +   '<input type="range" id="fzv-pb" min="0.5" max="10" step="0.1" value="'+f.pbMax+'" '
     +   'oninput="fzValSet(\'pbMax\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقل مؤشرات <b>'+f.minIndic+'</b></label>'
     +   '<input type="range" id="fzv-ind" min="1" max="4" step="1" value="'+f.minIndic+'" '
     +   'oninput="fzValSet(\'minIndic\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقل حجم سوق <b>'+(f.minMcap/1e9).toFixed(1)+'</b> مليار</label>'
     +   '<input type="range" id="fzv-mc" min="0" max="50" step="0.5" value="'+(f.minMcap/1e9)+'" '
     +   'oninput="fzValSet(\'minMcap\',this.value*1e9)"></div>'
     + '<div class="flt-sl"><label>القطاع <b>'+escFlt(f.sector)+'</b></label>'
     +   '<select class="fli-sel" onchange="fzValSet(\'sector\',this.value)">'
     +   '<option value="all">كل القطاعات</option>'
     +   secs.map(x=>'<option value="'+escFlt(x)+'"'+(f.sector===x?' selected':'')+'>'+escFlt(x)+'</option>').join('')
     +   '</select></div>'
     + '<label class="fli-check"><input type="checkbox"'+(f.relSector?' checked':'')+' '
     +   'onchange="fzValSet(\'relSector\',this.checked)"> 📊 مقارنة بالقطاع</label>'
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
      +   fltNum(s.pe,1)+'</span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(s.pb!=null&&s.pb>0?'<span class="flt-b '+(s.pb<1.5?'ok':s.pb<3.5?'mid':'bad')+'">'
      +   fltNum(s.pb,2)+'</span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(rel!=null?'<span class="flt-b '+(rel<0.8?'ok':rel<1.1?'mid':'bad')+'">'
      +   '×'+fltNum(rel,2)+'</span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
      +   escFlt(s.decision||'—')+'</span><small>'+fltNum(s.score,0)+'% · ثقة '+(s.scoreConf||0)+'%</small></td>'
      + '<td class="flt-sect">'+escFlt(s.sectorAr||'—')+'</td>'
      + '<td class="flt-warn">'+fltWarnCell(warns,'✅ رخيص وسليم')+'</td>'
      + '<td><button class="flt-add" onclick="fzValAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length+'</b></div>';
  box.innerHTML = h;
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
    if (fzQualCount(s) < f.minInd) return false;      /* مفيش بيانات كفاية */
    if (s.roe    != null && s.roe    < f.roeMin) return false;
    if (s.de     != null && s.de     > f.deMax)  return false;
    if (s.cr     != null && s.cr     < f.crMin)  return false;
    if (s.nm     != null && s.nm     < f.nmMin)  return false;
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
    else        p = de<=0.2?12 : de<=0.4?10 : de<=0.7?7 : de<=1.2?4 : 1;
    sc += p; got += 12;
  }
  if (s.cr != null){
    const cr = s.cr;
    const isBank = /بنك|مالي|Finance/.test(s.sectorAr||'');
    let p;
    if (isBank) p = cr>=1.1?13 : cr>=0.9?10 : cr>=0.7?6 : 3;
    else        p = cr>=2.5?13 : cr>=1.8?11 : cr>=1.3?8 : cr>=1?5 : 2;
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
  if (s.qr != null && s.cr != null && s.qr > s.cr) sc += 3;   /* سيولة سريعة أعلى = زيادة بسيطة */
  return got ? Math.round(Math.min(100, sc * (100/Math.max(40,got)) )) : 0;
}

/* ⚠️ تحذيرات الجودة — فين الثغرة؟ */
function fzQualWarn(s){
  const w = [];
  if (s.de != null && s.de > 1.2 && !/بنك|مالي|Finance/.test(s.sectorAr||''))
    w.push('⚠️ دين/أصول ' + s.de.toFixed(2) + ' — ديون أعلى من أصولها');
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
     +   '<div class="flt-h-exi bad"><b>❌ ربح كاذب</b><span>شركة مديانة</span>'
     +     '<em>ربح بيقول 10% — بس الدين 3 أضعاف حقوق الملكية</em></div>'
     +   '<div class="flt-h-exi"><b>✅ ربح حقيقي</b><span>شركة سليمة</span>'
     +     '<em>ربح 20% + دين منخفض + سيولة كويسة</em></div>'
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

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🏦</span> لمهOLOGY البنوك مختلفة — ليه؟</div>'
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
     +   '<div class="flt-h-wi"><span>العائد على الملكية</span><b>30</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>رأس المال</span><b>20</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>الانضباط المالي</span><b>25</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>جودة الربح</span><b>25</b><i>من 100</i></div>'
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
     + 'الفلتر ده بيقولك <b>الشركة-wise سليمة</b> — السعر والوقت Plaes في فلاتر تانية (القيمة والزخم). '
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
     +   '<input type="range" id="fzq-roe" min="0" max="40" step="1" value="'+f.roeMin+'" '
     +   'oninput="fzQualSet(\'roeMin\',this.value)"></div>'
     + '<div class="flt-sl"><label>أعلى دين/أصول <b>'+f.deMax+'</b></label>'
     +   '<input type="range" id="fzq-de" min="0" max="3" step="0.1" value="'+f.deMax+'" '
     +   'oninput="fzQualSet(\'deMax\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقل نسبة تداول <b>'+f.crMin+'</b></label>'
     +   '<input type="range" id="fzq-cr" min="0.5" max="4" step="0.1" value="'+f.crMin+'" '
     +   'oninput="fzQualSet(\'crMin\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقل هامش صافي <b>'+f.nmMin+'</b>%</label>'
     +   '<input type="range" id="fzq-nm" min="0" max="40" step="1" value="'+f.nmMin+'" '
     +   'oninput="fzQualSet(\'nmMin\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقل مؤشرات <b>'+f.minInd+'</b>/8</label>'
     +   '<input type="range" id="fzq-ind" min="3" max="8" step="1" value="'+f.minInd+'" '
     +   'oninput="fzQualSet(\'minInd\',this.value)"></div>'
     + '<div class="flt-sl"><label>القطاع <b>'+escFlt(f.sector)+'</b></label>'
     +   '<select class="fli-sel" onchange="fzQualSet(\'sector\',this.value)">'
     +   '<option value="all">كل القطاعات</option>'
     +   secs.map(x=>'<option value="'+escFlt(x)+'"'+(f.sector===x?' selected':'')+'>'+escFlt(x)+'</option>').join('')
     +   '</select></div>'
     + '<button class="flt-rst" onclick="fzQualReset()">↺ إعادة</button></div>';

  if (f.on && f.minInd >= 5){
    const thin = OS_DB.filter(s=>fzQualCount(s) < f.minInd).length;
    if (thin) h += '<div class="flt-alert">📊 <b>محتاج بيانات:</b> '
      + thin + ' سهم مافيش عندهم ' + f.minInd + ' مؤشرات جودة — مخفيين. '
      + '<span class="flt-alert-s">وده طبيعي — 114 سهم من 296 ما ينشرش قوائمهم المالية أصلاً. '
      + 'الفلتر بيشتغل على اللي بياخدوا المال Serious.</span></div>';
  }

  h += fzQualHelpBox();

  h += '<div class="flt-stats">'
     + '<div><b>'+rows.length+'</b><span>من '+all.length+' عندهم بيانات</span></div>'
     + '<div><b>'+OS_DB.filter(s=>fzQualCount(s)>=6).length+'</b><span>بـ6+ مؤشرات</span></div>'
     + '<div><b>'+(rows.length?(rows.reduce((a,s)=>a+(s.de||0),0)/rows.filter(s=>s.de!=null).length||0).toFixed(2):'—')+'</b><span>متوسط الدين</span></div>'
     + '</div>';

  if (!rows.length){
    box.innerHTML = h + '<div class="flt-empty">⛔ مفيش أسهم بتستوفي الشروط<br>'
      + '<button class="dv-tab" onclick="fzQualReset()">وسّع الفلاتر</button></div>';
    return;
  }

  const CAP = 60;
  h += '<div class="flt-tbl-wrap"><table class="flt-tbl"><thead><tr>'
     + '<th>السهم</th><th>🎯 الجودة</th><th>ROE</th><th>ROA/ROIC</th><th>دين/أصول</th>'
     + '<th>تداول</th><th>هامش</th><th>OCTA</th><th>القطاع</th><th>ملاحظات</th><th></th>'
     + '</tr></thead><tbody>';
  rows.slice(0,CAP).forEach(function(s){
    const warns = fzQualWarn(s);
    const isBank = /بنك|مالي|Finance/.test(s.sectorAr||'');
    h += '<tr>'
      + '<td><b class="flt-c">'+s.code+'</b><small>'+escFlt((s.name||'').slice(0,20))+'</small></td>'
      + '<td><span class="flt-safe s'+(s._qual>=70?'hi':s._qual>=50?'md':'lo')+'">'+s._qual+'</span></td>'
      + '<td>'+(s.roe!=null?'<span class="flt-b '+(s.roe>=20?'ok':s.roe>=10?'mid':'bad')+'">'
      +   fltNum(s.roe,1)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+((s.roic!=null||s.roa!=null)?'<span class="flt-b '+((s.roic||s.roa)>=12?'ok':(s.roic||s.roa)>=6?'mid':'bad')+'">'
      +   fltNum(s.roic!=null?s.roic:s.roa,1)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(s.de!=null?'<span class="flt-b '+((isBank?(s.de<=2.5):(s.de<=0.6))?'ok':(isBank?(s.de<=4):(s.de<=1.2))?'mid':'bad')+'">'
      +   fltNum(s.de,2)+'</span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(s.cr!=null?'<span class="flt-b '+((isBank?(s.cr>=0.9):(s.cr>=1.3))?'ok':(isBank?(s.cr>=0.7):(s.cr>=1))?'mid':'bad')+'">'
      +   fltNum(s.cr,2)+'</span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(s.nm!=null?'<span class="flt-b '+(s.nm>=15?'ok':s.nm>=5?'mid':'bad')+'">'
      +   fltNum(s.nm,1)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
      +   escFlt(s.decision||'—')+'</span><small>'+fltNum(s.score,0)+'% · ثقة '+(s.scoreConf||0)+'%</small></td>'
      + '<td class="flt-sect">'+escFlt(s.sectorAr||'—')+'</td>'
      + '<td class="flt-warn">'+fltWarnCell(warns,'✅ جودة عالية')+'</td>'
      + '<td><button class="flt-add" onclick="fzQualAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length+'</b></div>';
  box.innerHTML = h;
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
  const px = s.p || s.price;                  /* p أو price */
  if (!px || !s.av30 || s.av30 <= 0) return null;
  const shares = capital / px;                /* كام سهم هتشتري */
  const daily   = s.av30 * 0.15;             /* 15% من الحجم —Estimatesواقعي */
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
  if      (av > 5e6) sc += 40;
  else if (av > 2e6) sc += 36;
  else if (av > 1e6) sc += 32;
  else if (av > 5e5) sc += 27;
  else if (av > 2e5) sc += 21;
  else if (av > 1e5) sc += 14;
  else               sc += 6;
  /* ② سرعة البيع من 100 ألف (35) */
  const d = fzExitDays(s, FZ_LIQ.portfolio);
  if (d != null){
    if      (d < 0.5) sc += 35;
    else if (d < 1)   sc += 31;
    else if (d < 3)   sc += 26;
    else if (d < 7)   sc += 19;
    else if (d < 14)  sc += 11;
    else if (d < 30)  sc += 5;
    else              sc += 0;
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
  if (s.mc != null && s.mc < 5e8) w.push('📌 شركة صغيرة ('+(s.mc/1e6).toFixed(0)+' مليون) — susceptible for حركات');
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
     + '<p class="flt-h-p"><b> flapع الشراء سهل — بس البيع؟weeks.</b> لو SentdownCrash يبقى أنت مش قادر تخرج.</p>'
     + '<div class="flt-h-ex">'
     +   '<div class="flt-h-exi bad"><b>❌ فخ</b><span>سيولة 5 آلاف/يوم</span>'
     +     '<em>لو اشتريت 100 ألف — بتبيعهم على مدى شهور</em></div>'
     +   '<div class="flt-h-exi"><b>✅ سيولة كويسة</b><span>سيولة 4 ملايين/يوم</span>'
     +     '<em>تبيع 100 ألف في أقل من يوم</em></div>'
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
     + '<tr><td>حجم الشركة</td><td>MC بالمليار</td><td>الشركة الكبيرة أأمن</td></tr>'
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
     +   '<div class="flt-h-wi"><span>حجم يومي</span><b>40</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>سرعة البيع</span><b>35</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>نشاط نسبي</span><b>15</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>حجم الشركة</span><b>10</b><i>من 100</i></div>'
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
     +   '<input type="range" id="fzl-vol" min="0" max="3000" step="50" value="'+(f.minVol/1e3)+'" '
     +   'oninput="fzLiqSet(\'minVol\',this.value*1000)"></div>'
     + '<div class="flt-sl"><label>محفظتك <b>'+(f.portfolio/1000)+'k</b> جنيه</label>'
     +   '<input type="range" id="fzl-cap" min="10000" max="2000000" step="10000" value="'+f.portfolio+'" '
     +   'oninput="fzLiqSet(\'portfolio\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقصى أيام البيع <b>'+(f.maxDays>=999?'∞':f.maxDays)+'</b></label>'
     +   '<input type="range" id="fzl-days" min="1" max="60" step="1" value="'+Math.min(60,f.maxDays)+'" '
     +   'oninput="fzLiqSet(\'maxDays\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقل حجم نسبي <b>'+f.minRel+'</b>×</label>'
     +   '<input type="range" id="fzl-rel" min="0" max="2" step="0.1" value="'+f.minRel+'" '
     +   'oninput="fzLiqSet(\'minRel\',this.value)"></div>'
     + '<div class="flt-sl"><label>القطاع <b>'+escFlt(f.sector)+'</b></label>'
     +   '<select class="fli-sel" onchange="fzLiqSet(\'sector\',this.value)">'
     +   '<option value="all">كل القطاعات</option>'
     +   secs.map(x=>'<option value="'+escFlt(x)+'"'+(f.sector===x?' selected':'')+'>'+escFlt(x)+'</option>').join('')
     +   '</select></div>'
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
      +   (s.av30>=1e6?(s.av30/1e6).toFixed(1)+'m':(s.av30/1e3).toFixed(0)+'k')+'</span></td>'
      + '<td>'+(d!=null?'<span class="flt-b '+(d<1?'ok':d<3?'mid':'bad')+'">'
      +   (d<0.1?'⚡ فوري':d<1?'أقل من يوم':fltNum(d,1)+(d<10?' أيام':''))+'</span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(s.relvol!=null?'<span class="flt-b '+(s.relvol>1?'ok':s.relvol>0.6?'mid':'bad')+'">'
      +   '×'+fltNum(s.relvol,2)+'</span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(s.mc!=null?'<span class="flt-b '+(s.mc>5e9?'ok':s.mc>1e9?'mid':'bad')+'">'
      +   (s.mc>=1e9?(s.mc/1e9).toFixed(1)+'b':(s.mc/1e6).toFixed(0)+'m')+'</span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
      +   escFlt(s.decision||'—')+'</span><small>'+fltNum(s.score,0)+'% · ثقة '+(s.scoreConf||0)+'%</small></td>'
      + '<td class="flt-warn">'+fltWarnCell(warns,'✅ سهل البيع')+'</td>'
      + '<td><button class="flt-add" onclick="fzLiqAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length+'</b></div>';
  box.innerHTML = h;
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
    if (s.roe    != null && s.roe    < f.roeMin) return false;
    if (s.nm     != null && s.nm     < f.nmMin)  return false;
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
     +   '<div class="flt-h-exi"><b>🏭 نمو الشركة</b><span>بتكبر فعلاً؟</span>'
     +     '<em>شركتها بتكبر — ده إنت فايدك على المدى الطويل</em></div>'
     +   '<div class="flt-h-exi bad"><b>📈 نمو السهم</b><span>بتعلى؟</span>'
     +     '<em>السهم طلع — ده ممكن يكون خلص!</em></div>'
     + '</div>'
     + '<p class="flt-h-p">الشركة ممكن تكون بتكبر وسهمها نازل — أو العكس.</p>'
     + '<p class="flt-h-note">📌 الفلتر ده بيبص على <b>الاتنين</b> مع بعض. '
     + 'نمو الشركة من غير نمو السهم = فرصة محدودة. '
     + 'ونمو السهم من غير نمو الشركة = غالباًSpeculation.</p></div>';

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
     + '<li><b>TMGH</b> طلعت مصطفى نمو 115% —-growth-physical مش business</li>'
     + '</ul>'
     + '<p class="flt-h-note">📌 الفلتر بيحط سقف للنمو (<b>150%</b>) — '
     + 'لأن النمو الأ роحي بييجي معاه تقلب عالي.</p></div>';

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
     +   '<input type="range" id="fzg-roe" min="0" max="40" step="1" value="'+f.roeMin+'" '
     +   'oninput="fzGrowSet(\'roeMin\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقل نمو 3 سنين <b>'+f.cagrMin+'</b>%</label>'
     +   '<input type="range" id="fzg-cagr" min="-30" max="80" step="5" value="'+f.cagrMin+'" '
     +   'oninput="fzGrowSet(\'cagrMin\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقصى نمو (سقف) <b>'+f.maxCagr+'</b>%</label>'
     +   '<input type="range" id="fzg-max" min="50" max="400" step="10" value="'+f.maxCagr+'" '
     +   'oninput="fzGrowSet(\'maxCagr\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقل هامش <b>'+f.nmMin+'</b>%</label>'
     +   '<input type="range" id="fzg-nm" min="0" max="30" step="1" value="'+f.nmMin+'" '
     +   'oninput="fzGrowSet(\'nmMin\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقل بيانات <b>'+f.minData+'</b>/6</label>'
     +   '<input type="range" id="fzg-ind" min="2" max="6" step="1" value="'+f.minData+'" '
     +   'oninput="fzGrowSet(\'minData\',this.value)"></div>'
     + '<div class="flt-sl"><label>القطاع <b>'+escFlt(f.sector)+'</b></label>'
     +   '<select class="fli-sel" onchange="fzGrowSet(\'sector\',this.value)">'
     +   '<option value="all">كل القطاعات</option>'
     +   secs.map(x=>'<option value="'+escFlt(x)+'"'+(f.sector===x?' selected':'')+'>'+escFlt(x)+'</option>').join('')
     +   '</select></div>'
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
      +   fltNum(s.roe,1)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(g!=null?'<span class="flt-b '+(inSweet?'ok':g<0?'bad':'mid')+'">'
      +   (g>0?'+':'')+fltNum(g,0)+'<i>%</i></span>'+(inSweet?' <i class="flt-sweet">✓</i>':''):'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(s.nm!=null?'<span class="flt-b '+(s.nm>=15?'ok':s.nm>=5?'mid':'bad')+'">'
      +   fltNum(s.nm,1)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(s.mc!=null?'<span class="flt-b '+(s.mc>3e9?'ok':s.mc>1e9?'mid':'bad')+'">'
      +   (s.mc>=1e9?(s.mc/1e9).toFixed(1)+'b':(s.mc/1e6).toFixed(0)+'m')+'</span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
      +   escFlt(s.decision||'—')+'</span><small>'+fltNum(s.score,0)+'% · ثقة '+(s.scoreConf||0)+'%</small></td>'
      + '<td class="flt-sect">'+escFlt(s.sectorAr||'—')+'</td>'
      + '<td class="flt-warn">'+fltWarnCell(warns,'✅ نمو مستقر')+'</td>'
      + '<td><button class="flt-add" onclick="fzGrowAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length+'</b></div>';
  box.innerHTML = h;
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
    sc += 0;   /* بتصرف كاش — صفر */
  }
  /* ② جودة الربح — FCF/EBITDA (30) */
  const q = fzCashQuality(s);
  if (q != null){
    if      (q >= 90) sc += 30;
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
     + '<p class="flt-h-p">بس لو هيNotificationsتصرف 150 مليون — يعني <b>خسران 50 مليون</b> '
     + 'وإنما الكلام ده كله على الورق.</p>'
     + '<div class="flt-h-ex">'
     +   '<div class="flt-h-exi bad"><b>❌ ربح ورقي</b><span>كسبت 100 · صرفت 150</span>'
     +     '<em>خسران — والـ100 مليون دي على الورق بس</em></div>'
     +   '<div class="flt-h-exi"><b>✅ ربح نقدي</b><span>كسبت 100 · صرفت 60</span>'
     +     '<em>عندك 40 مليون كاش في إيدك فعلاً</em></div>'
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
     + '<p class="flt-h-p">لأنها خسران <b>و</b> مديانة — يعني لو السوق كsheer، '
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
     +   '<input type="range" id="fzc-fcf" min="-200" max="500" step="10" value="'+(f.fcfMin/1e6)+'" '
     +   'oninput="fzCfwSet(\'fcfMin\',this.value*1e6)"></div>'
     + '<div class="flt-sl"><label>أقل جودة ربح <b>'+f.qualityMin+'</b>%</label>'
     +   '<input type="range" id="fzc-q" min="0" max="120" step="5" value="'+f.qualityMin+'" '
     +   'oninput="fzCfwSet(\'qualityMin\',this.value)"></div>'
     + '<div class="flt-sl"><label>أعلى دين/أصول <b>'+f.maxDebt+'</b></label>'
     +   '<input type="range" id="fzc-de" min="0" max="3" step="0.1" value="'+f.maxDebt+'" '
     +   'oninput="fzCfwSet(\'maxDebt\',this.value)"></div>'
     + '<label class="fli-check"><input type="checkbox"'+(f.requireBoth?' checked':'')+' '
     +   'onchange="fzCfwSet(\'requireBoth\',this.checked)"> 🔒 يتطلب بيانات التدفق</label>'
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
     + '<th>جودة الربح</th><th>EBITDA</th><th>دين/أصول</th><th>OCTA</th><th>ملاحظات</th><th></th>'
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
      +   fzBigMoney(s.fcf)+'</span></td>'
      + '<td>'+(fcfYield!=null?'<span class="flt-b '+(fcfYield>=5?'ok':fcfYield>=2?'mid':'bad')+'">'
      +   fltNum(fcfYield,1)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(q!=null?'<span class="flt-b '+(q>=90?'ok':q>=45?'mid':'bad')+'">'
      +   fltNum(q,0)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(s.ebitda!=null?'<span class="flt-b '+(s.ebitda>0?'ok':'bad')+'">'
      +   fzBigMoney(s.ebitda)+'</span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(s.de!=null?'<span class="flt-b '+(s.de<=0.5?'ok':s.de<=1.5?'mid':'bad')+'">'
      +   fltNum(s.de,2)+'</span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
      +   escFlt(s.decision||'—')+'</span><small>'+fltNum(s.score,0)+'% · ثقة '+(s.scoreConf||0)+'%</small></td>'
      + '<td class="flt-warn">'+fltWarnCell(warns,'✅ كاش حقيقي')+'</td>'
      + '<td><button class="flt-add" onclick="fzCfwAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length+'</b></div>';
  box.innerHTML = h;
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
  { id:'safety', i:'🛡️', n:'آمن',       desc:'مخاطرة منخفضة',        test:s=>fltChkSafe(s) },
  { id:'income', i:'💰', n:'بيوزّع',     desc:'عائد ≥ 3%',            test:s=>fltChkInc(s)  },
  { id:'moment', i:'⚡', n:'بيتحرك',     desc:'صاعد 3 شهور ≥ 10%',    test:s=>fltChkMom(s)  },
  { id:'value',  i:'💎', n:'رخيص',      desc:'أرخص من متوسط قطاعه',   test:s=>fltChkVal(s)  },
  { id:'qual',   i:'🎯', n:'جودة عالية', desc:'أرباح + ميزانية سليمة', test:s=>fltChkQua(s)  },
  { id:'liquid', i:'💵', n:'سهل البيع',  desc:'سيولة ≥ 200 ألف/يوم',  test:s=>fltChkLiq(s)  },
  { id:'growth', i:'📈', n:'بيكبر',      desc:'نمو 3 سنين ≥ 10%',      test:s=>fltChkGro(s)  },
  { id:'cash',   i:'🏦', n:'كاش حقيقي',  desc:'بتكسب نقداً',           test:s=>fltChkCfw(s)  },
];

function fltChkSafe(s){
  const v = s.vol1y, m = s.mdd1y, sh = s.sharpe3y, b = s.beta;
  if (v==null && m==null && sh==null && b==null) return null;   /* مفيش بيانات */
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
  const ref   = ('pb' in pk.use) ? med.pb : med.pe;
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
function fzBestWhy(s){
  const out = [];
  FZ_CHECKS.forEach(function(c){
    const r = c.test(s);
    if (r===true){
      let d = '';
      if (c.id==='safety') d = 'هبوط '+(s.mdd1y!=null?s.mdd1y.toFixed(0)+'%':'—')+' · شارب '+(s.sharpe3y!=null?s.sharpe3y.toFixed(1):'—');
      if (c.id==='income')  d = 'عائد '+(s.dy!=null?s.dy.toFixed(1)+'%':'—');
      if (c.id==='moment')  d = '+'+(s.perf3m!=null?s.perf3m.toFixed(0)+'%':'—')+' في 3 شهور';
      if (c.id==='value')   d = 'P/B '+(s.pb!=null?s.pb.toFixed(2):'—')+' · P/E '+(s.pe!=null?s.pe.toFixed(1):'—');
      if (c.id==='qual')    d = 'ROE '+(s.roe!=null?s.roe.toFixed(0)+'%':'—')+' · دين '+(s.de!=null?s.de.toFixed(2):'—');
      if (c.id==='liquid')  d = fzBigMoney(s.av30)+'/يوم';
      if (c.id==='growth')  d = 'CAGR '+(s.cagr3y!=null?(s.cagr3y>0?'+':'')+s.cagr3y.toFixed(0)+'%':'—');
      if (c.id==='cash')    d = fzBigMoney(s.fcf)+' كاش حر';
      out.push({ i:c.i, n:c.n, d:d, ok:true });
    } else if (r===false){
      out.push({ i:c.i, n:c.n, d:fzBestFailReason(c, s), ok:false });
    }
  });
  return out;
}
function fzBestFailReason(c, s){
  if (c.id==='safety') return s.vol1y!=null&&s.vol1y>45 ? 'تذبذب '+s.vol1y.toFixed(0)+'%' : (s.mdd1y!=null&&s.mdd1y>40?'هبوط '+s.mdd1y.toFixed(0)+'%':'شارب ضعيف');
  if (c.id==='income')  return 'عائد '+(s.dy!=null?s.dy.toFixed(1)+'%':'مفيش');
  if (c.id==='moment')  return (s.perf3m!=null?(s.perf3m>0?'+':'')+s.perf3m.toFixed(0)+'%':'مفيش');
  if (c.id==='value')   return 'مش أرخص من قطاعه';
  if (c.id==='qual')    return s.roe!=null&&s.roe<10 ? 'ROE '+s.roe.toFixed(0)+'%' : 'بيانات ناقصة';
  if (c.id==='liquid')  return fzBigMoney(s.av30)+'/يوم';
  if (c.id==='growth')  return s.cagr3y!=null ? (s.cagr3y>0?'+':'')+s.cagr3y.toFixed(0)+'%' : 'مفيش';
  if (c.id==='cash')    return 'بتصرف كاش';
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
     +   '<div class="flt-h-exi bad"><b>❌ فلتر واحد</b><span>آمن بس رخيص</span>'
     +     '<em>آمن بس مفيش سبب يشتريه دلوقتي</em></div>'
     +   '<div class="flt-h-exi"><b>✅ 5 فلاتر</b><span>آمن + رخيص + بيكبر</span>'
     +     '<em>كل المؤشرات بتقول اشترِ — ده أقوى</em></div>'
     + '</div></div>';

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">🏅</span> الدرجة من 100 — ليه مش مجرد عدد؟</div>'
     + '<p class="flt-h-p">الدرجة = <b>82% استيفاء</b> + <b>18% اتساق</b></p>'
     + '<div class="flt-h-w">'
     +   '<div class="flt-h-wi"><span>استيفاء</span><b>82</b><i>من 100</i></div>'
     +   '<div class="flt-h-wi"><span>اتساق</span><b>18</b><i>من 100</i></div>'
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

  h += '<div class="flt-h-sec"><div class="flt-h-t"><span class="flt-h-i">📈</span> أرقام حقيقية من السوق</div>'
     + '<ul class="flt-h-ul">'
     + '<li>توزيع الأسهم حسب كام فلتر بيستوفيه:</li>'
     + '<li>— <b>49 سهم</b> مفيش ولا فلتر واحد يستوفيهم</li>'
     + '<li>— <b>64 سهم</b> يستوفيوا 3 فلاتر بس</li>'
     + '<li>— <b>43 سهم</b> يستوفيوا 4 فلاتر</li>'
     + '<li>— <b>27 سهم</b> يستوفيوا 5 فلاتر</li>'
     + '<li>— <b>18 سهم</b> يستوفيوا 5+ فلاتر ← <b>هنا الفرص</b></li>'
     + '<li>— <b>4 أسهم</b> يستوفيوا <b>7 فلاتر</b> — نادر جداً</li>'
     + '</ul>'
     + '<p class="flt-h-note">📌 لاحظ: <b>49 سهم مفيش ولا مزية</b> — دي أسهم اتشالت '
     + 'من أي قائمة مركزية. الفلتر ده بيوفّر عليك 49 سهم مش تستحق وقتك.</p></div>';

  h += '<div class="flt-h-warn">⚠️ <b>مهم:</b> استيفاء فلاتر كتير <b>مش ضمان</b> — '
     + 'يعني السهم عنده مزايا كتير، مش إنه هيزيد. '
     + 'افتح كارت القرار لكل سهم، وقارن، وقرر بنفسك. '
     + 'الفلتر ده بيوفّر عليك البحث — مش بياخد القرار عنك.</div>';

  h += '</div></div>';
  return h;
}
function fzBestHelpToggle(){ FZ_BEST_HELP = !FZ_BEST_HELP; fzBestRender(); }

function fzBestInit(){
  if (!FZ_SECTOR_MED || !Object.keys(FZ_SECTOR_MED).length){
    if (typeof fzComputeSectorMed === 'function') fzComputeSectorMed();
  }
  fzBestRender();
}

function fzBestRender(){
  const box = document.getElementById('fltBestBox'); if (!box) return;
  const f = FZ_BEST;
  const all = OS_DB;
  const rows = fzBestRows();
  const secs = [...new Set(all.map(s=>s.sectorAr).filter(Boolean))].sort();
  const dist = {};
  all.forEach(function(s){ const r=fzBestCount(s); dist[r.p]=(dist[r.p]||0)+1; });

  let h = '';
  h += '<div class="flt-head"><div><h2>⭐ الفرصة المثالية</h2>'
     + '<p class="flt-sub">الأسهم اللي تستوفي 4 فلاتر أو أكتر مع بعض — أقوى الفرص</p></div>'
     + '<button class="flt-sw'+(f.on?' on':'')+'" onclick="fzBestToggle()">'
     + (f.on?'🔒 مفعّل':'🔓 فعّل')+'</button></div>';

  h += '<div class="flt-filters'+(f.on?'':' hid')+'">'
     + '<div class="flt-sl"><label>أقل فلاتر مستوفاة <b>'+f.minPass+'</b> من 8</label>'
     +   '<input type="range" id="fzb-pass" min="2" max="8" step="1" value="'+f.minPass+'" '
     +   'oninput="fzBestSet(\'minPass\',this.value)"></div>'
     + '<div class="flt-sl"><label>أقل فلاتر معروفة <b>'+f.needKnown+'</b> من 8</label>'
     +   '<input type="range" id="fzb-known" min="3" max="8" step="1" value="'+f.needKnown+'" '
     +   'oninput="fzBestSet(\'needKnown\',this.value)"></div>'
     + '<div class="flt-sl"><label>القطاع <b>'+escFlt(f.sector)+'</b></label>'
     +   '<select class="fli-sel" onchange="fzBestSet(\'sector\',this.value)">'
     +   '<option value="all">كل القطاعات</option>'
     +   secs.map(x=>'<option value="'+escFlt(x)+'"'+(f.sector===x?' selected':'')+'>'+escFlt(x)+'</option>').join('')
     +   '</select></div>'
     + '<button class="flt-rst" onclick="fzBestReset()">↺ إعادة</button></div>';

  /* 📊 شريط التوزيع — بصرياً */
  h += '<div class="fz-dist">';
  for (let k=0;k<=8;k++){
    const n = dist[k]||0;
    if (!n) continue;
    h += '<div class="fz-dist-i'+(k>=f.minPass?' hi':'')+'">'
       +   '<span class="fz-dist-n">'+n+'</span>'
       +   '<span class="fz-dist-l">'+k+' '+FZ_CHECKS.slice(0,k).map(c=>c.i).join('')+'</span>'
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
     + '<th>السهم</th><th>⭐ الدرجة</th><th>الفلاتر</th><th>ليه؟</th>'
     + '<th>السعر</th><th>العائد</th><th>النمو</th><th>OCTA</th><th></th>'
     + '</tr></thead><tbody>';
  rows.slice(0,CAP).forEach(function(s){
    const why = fzBestWhy(s);
    const ok  = why.filter(w=>w.ok);
    const bad = why.filter(w=>!w.ok);
    const g   = s.cagr3y, dr = s.dy;
    h += '<tr>'
      + '<td><b class="flt-c">'+s.code+'</b><small>'+escFlt((s.name||'').slice(0,20))+'</small></td>'
      + '<td><span class="flt-safe s'+(s._best>=75?'hi':s._best>=55?'md':'lo')+'">'+s._best+'</span></td>'
      + '<td><div class="fz-pips">'
      +   FZ_CHECKS.map(c=>'<span class="fz-pip '+(why.find(w=>w.n===c.n&&w.ok)?'on':(why.find(w=>w.n===c.n)?'off':'na'))+'" title="'+c.n+'">'+c.i+'</span>').join('')
      +   '<b class="fz-pn">'+s._pass+'/8</b></div></td>'
      + '<td class="fz-why">'+ok.slice(0,3).map(w=>'<span class="fz-w ok">'+w.i+' '+escFlt(w.d)+'</span>').join('')
      +   (bad.length?'<span class="fz-w no">✕ '+escFlt(bad[0].n)+' — '+escFlt(bad[0].d)+'</span>':'')+'</td>'
      + '<td>'+(s.p!=null?'<span class="flt-b">'+fltNum(s.p,2)+'</span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(dr!=null?'<span class="flt-b '+(dr>=3?'ok':dr>0?'mid':'bad')+'">'+fltNum(dr,1)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td>'+(g!=null?'<span class="flt-b '+(g>=10&&g<=150?'ok':g<0?'bad':'mid')+'">'
      +   (g>0?'+':'')+fltNum(g,0)+'<i>%</i></span>':'<span class="flt-na">—</span>')+'</td>'
      + '<td><span class="flt-d'+(String(s.decision||'').indexOf('إشارة إيجابية')>=0?' good':'')+'">'
      +   escFlt(s.decision||'—')+'</span><small>'+fltNum(s.score,0)+'% · ثقة '+(s.scoreConf||0)+'%</small></td>'
      + '<td><button class="flt-add" onclick="fzBestAdd(\''+s.code+'\')" title="ضيف للمرشحين">➕</button></td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > CAP) h += '<div class="flt-more">📊 بيعرض أول <b>'+CAP+'</b> من <b>'+rows.length+'</b></div>';
  box.innerHTML = h;
}

function fzBestToggle(){ FZ_BEST.on = !FZ_BEST.on; fzBestRender(); }
function fzBestReset(){ const f=FZ_BEST; f.minPass=4; f.needKnown=5; f.sector='all'; f.sort='pass'; f.on=false; fzBestRender(); }
function fzBestSet(k,v){ FZ_BEST[k] = (typeof v==='string') ? v : Number(v); fzBestRender(); }

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
  fzBestRender();
}
/* ══════════════════════════════════════════════════════════════
   ⭐ الهيرو — بطاقة بارزة فوق الفلاتر الثمانية
   بتعرض أحسن فرصة + بتوصلك للصفحة المستقلة
   ══════════════════════════════════════════════════════════════ */
function fzHeroRender(){
  const host = document.getElementById('fzHero'); if (!host) return;
  if (!FZ_SECTOR_MED || !Object.keys(FZ_SECTOR_MED).length){
    if (typeof fzComputeSectorMed === 'function') fzComputeSectorMed();
  }
  const rows = fzBestRows();
  const top  = rows.slice(0, 3);
  const gold = rows.filter(s=>s._pass>=6).length;
  const none = OS_DB.filter(s=>fzBestCount(s).p===0).length;

  let h = '<div class="fz-hero-in">';
  /* 🔵 الشريط الأيسر: العنوان + الأرقام */
  h += '<div class="fz-hero-l">'
     +   '<div class="fz-hero-badge">⭐ قرار OCTA</div>'
     +   '<h2>الفرصة المثالية</h2>'
     +   '<p class="fz-hero-p">الأسهم اللي بتستوفي <b>4 فلاتر أو أكتر مع بعض</b> — '
     +     'مش فلتر واحد، لكن <b>تداخل الفلاتر الثمانية</b></p>'
     +   '<div class="fz-hero-stats">'
     +     '<div><b>'+rows.length+'</b><span>فرصة مثالية</span></div>'
     +     '<div><b>'+gold+'</b><span>بـ6+ فلاتر (ذهبي)</span></div>'
     +     '<div><b>'+none+'</b><span>مفيش ولا فلتر</span></div>'
     +   '</div>'
     +   '<button class="fz-hero-btn" onclick="switchPage(\'best\')">'
     +     'افتح التحليل الكامل <span>←</span></button>'
     + '</div>';
  /* 🔵 الشريط الأيمن: أحسن 3 فرص */
  h += '<div class="fz-hero-r">';
  if (!top.length){
    h += '<div class="fz-hero-empty">⛔ مفيش سهم يستوفي 4 فلاتر<br>'
       +   '<button class="flt-rst" onclick="fzBestSet(\'minPass\',2);switchPage(\'best\')">وسّع</button></div>';
  } else {
    h += '<div class="fz-hero-t">🏆 أحسن 3 فرص دلوقتي</div>';
    top.forEach(function(s, i){
      const pips = FZ_CHECKS.map(function(c){
        const r = c.test(s);
        return '<span class="fz-pip '+(r===true?'on':r===false?'off':'na')+'" title="'+c.n+'">'+c.i+'</span>';
      }).join('');
      h += '<button class="fz-hc" onclick="switchPage(\'best\')">'
         +   '<span class="fz-hc-r">'+(i===0?'🥇':i===1?'🥈':'🥉')+'</span>'
         +   '<span class="fz-hc-b">'
         +     '<b>'+s.code+'</b><small>'+escFlt((s.name||'').slice(0,18))+'</small>'
         +     '<em>'+s._pass+'/8 فلاتر · '+escFlt(s.sectorAr||'')+'</em>'
         +   '</span>'
         +   '<span class="fz-hc-p">'+pips+'</span>'
         + '</button>';
    });
  }
  h += '</div></div>';
  host.innerHTML = h;
}