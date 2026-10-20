/* ═══ OCTA · octa-app.js · 101KB ═══ */
/* ══════════ إعدادات الأسواق — إضافة سوق جديد = سطر واحد ══════════ */
const MARKETS = {
  egypt: {
  name:'مصري', flag:'🇪🇬', tab:'🇪🇬 المصري',
  api: OCTA_API, phase: 'cairo',
  stocks: null,  /* كل الأسهم من الـ API */
  index: null  /* EGX30 من /api/ticker */
  },
  us: {
  name:'أمريكي', flag:'🇺🇸', tab:'🇺🇸 الأمريكي',
  api: TV_SCAN, phase: 'ny',
  stocks: ['NASDAQ:AAPL','NASDAQ:NVDA','NASDAQ:TSLA','NASDAQ:MSFT','NASDAQ:AMZN',
  'NASDAQ:META','NASDAQ:GOOGL','NASDAQ:AMD','NASDAQ:NFLX','NYSE:BRK.B',
  'OTC:CSANY'],
  index: 'SP:SPX'
  }
  /* سوق جديد؟ ضيف بلوك هنا — الباقي بيشتغل لوحده */
};
function TV_SCAN(){return 'https://scanner.tradingview.com/america/scan'}

const US_COLS=["close","change","volume","relative_volume_10d_calc","market_cap_basic",
"price_earnings_ttm","price_book_fq","RSI","MACD.macd","MACD.signal","EMA20","EMA50",
"EMA200","ATR","high_52w","low_52w","Perf.1M","Perf.Y","Volatility.D","beta_1_year",
"fundamental_currency_code","exchange","sector","industry","name","description",
"total_shares_outstanding","Recommend.All","price_target_median",
"earnings_per_share_diluted_ttm","net_income","debt_to_equity","return_on_equity_fq",
"operating_margin","dividends_yield_current"];

/* ══════════ أدوات ══════════ */
const $=i=>document.getElementById(i);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=(n,d=2)=>(n==null||isNaN(n))?'—':Number(n).toLocaleString('en-US',{maximumFractionDigits:d});
const sf=(n,d=2)=>(n==null||isNaN(n))?'—':(n>=0?'+':'')+Number(n).toFixed(d)+'%';
const big=n=>{if(n==null||isNaN(n))return'—';const a=Math.abs(n);
  if(a>=1e12)return(n/1e12).toFixed(2)+' تريليون';
  if(a>=1e9)return(n/1e9).toFixed(1)+' مليار';
  if(a>=1e6)return(n/1e6).toFixed(0)+' مليون';
  if(a>=1e3)return(n/1e3).toFixed(0)+' ألف';return String(n)};
const cls=v=>v>=CFG.th.safe?'g':(v>=CFG.th.mid?'m':'b');

/* ══════════ الحالة ══════════ */
// ⛔ الافتراضي المصري — الموقع كله عن البورصة المصرية.
//  لو اتغير لـus، صفحات زي «أفضل فرصة» بتطلع أسهم أمريكية
//  (AAPL/MSFT) في مشروع مفروض كله مصري.
let MK='egypt';
let DATA={egypt:null,us:null};
let FILTER='all';
let QUERY='';
let TIMER=null;

/* ══════════ الفلاتر — بتتولّد من الفلتر النشط ══════════ */
const FILTERS={
  egypt:[
  {id:'all',  t:'الكل {n}'},
  {id:'buy',  t:'تجميع / شراء'},
  {id:'hold', t:'إشارة محايدة'},
  {id:'sell', t:'بيع / تجنّب'},
  {id:'high', t:'أعلى نتيجة'},
  {id:'safe', t:'الأكثر أمانًا'},
  {id:'big',  t:'القيمة السوقية'}
  ],
  us:[
  {id:'all',  t:'الكل'},
  {id:'buy',  t:'تجميع / شراء'},
  {id:'hold',  t:'إشارة محايدة'},
  {id:'sell',  t:'بيع / تجنّب'},
  {id:'high',  t:'أعلى نتيجة'},
  {id:'safe',  t:'الأكثر أمانًا'},
  {id:'ovr',  t:'يتفوّق على S&P'},
  {id:'und',  t:'وراء S&P'},
  {id:'mega',  t:'عملاق (>200 مليار $)'},
  {id:'cheap', t:'رخيص (P/E<20)'},
  {id:'prof',  t:'مربح (ROE>15%)'},
  {id:'grow',  t:'صاعد (سنة>20%)'},
  {id:'vol',  t:'نشيط (حجم عالي)'}
  ]
};

/* ══════════ حالة السوق ══════════ */
function phaseOf(mk){
  const tz = mk==='egypt'?'Africa/Cairo':'America/New_York';
  const f=new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
  const p=Object.fromEntries(f.formatToParts(new Date()).map(x=>[x.type,x.value]));
  const d=p.weekday,h=+p.hour+ +p.minute/60;
  if(d==='Fri'||d==='Sat') return['closed','ويك إند','ph-closed'];
  if(h>=15) return['closed','مقفول','ph-closed'];
  if(h<10) return['pre','قبل الفتح','ph-pre'];
  return['open','مفتوح','ph-open'];
}

/* ══════════ جلب البيانات ══════════ */
async function loadEgypt(){
  const B=OCTA_API, bus='?_='+Date.now();
  const [prices,ticker]=await Promise.all([
  fetch(B+'/api/prices'+bus).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch(B+'/api/ticker'+bus).then(r=>r.ok?r.json():null).catch(()=>null)
  ]);
  if(!prices||!prices.egx30) throw new Error('ما قدرتش أوصل لسيرفر السوق المصري');
  const idx=(ticker&&ticker.ticker||[]).find(t=>t.id==='tk-egx');
  // كل الأسهم — مش بس أعلى 20
  const all=prices.egx30.filter(s=>s&&s.code);
  return{index: idx?{name:'EGX 30',value:idx.value,change:idx.change}:null,
  top10: all};
}

async function loadUS(){
  const syms=MARKETS.us.stocks.concat([MARKETS.us.index]);
  const body=JSON.stringify({symbols:{tickers:syms,query:{types:[]}},columns:US_COLS});
  const r=await fetch(TV_SCAN(),{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body});
  const j=await r.json();
  if(!j.data||!j.data.length) throw new Error('ما قدرتش أوصل لمصدر البيانات الأمريكي');
  const idxRow=j.data.find(d=>d.s===MARKETS.us.index);
  const idx=idxRow?{name:'S&P 500',value:idxRow.d[0],change:idxRow.d[1]}:null;
  const bench=idxRow;
  const stocks=j.data.filter(d=>d.s!==MARKETS.us.index).map(d=>{
  const o={_symbol:d.s};
  US_COLS.forEach((c,i)=>o[c]=d.d[i]);
  // مقارنة مع المؤشر
  const rel=(v,b)=>(v!=null&&b!=null)?v-b:null;
  o._rel={d1M:rel(o['Perf.1M'],bench?bench.d[16]:null), dY:rel(o['Perf.Y'],bench?bench.d[17]:null)};
  o._sc=scoreUS(o);
  return o;
  });
  return{index:idx,stocks:stocks};
}

/* ══════════ حساب النتيجة ══════════
   الأوزان بقت فاضية وقت التحميل (مخبيّة عن الزائر ومحجوبة بتوكن).
   فنقرأها لحظياً من CFG بدل ما نجمّدها في متغيّر ثابت. */
function WUS(){ return (window.CFG && CFG.weights && CFG.weights.usScan) || {}; }
function WEGX(){ return (window.CFG && CFG.weights && CFG.weights.egx) || {}; }
function clamp(x){return Math.max(5,Math.min(95,Math.round(x)))}

function scoreUS(d){
  const s={};const P=d.close;
  let t=50;
  const rsi=d.RSI;
  if(rsi!=null){ if(rsi>70)t-=14; else if(rsi>60)t-=5; else if(rsi<30)t+=8; else if(rsi>45)t+=2; else t-=2 }
  if(P!=null&&d.EMA200!=null){ P>d.EMA200?t+=9:t-=7 }
  if(d['MACD.macd']!=null&&d['MACD.signal']!=null){ (d['MACD.macd']>d['MACD.signal'])?t+=7:t-=6 }
  const ap=(d.ATR!=null&&P)?d.ATR/P*100:null;
  if(ap!=null){ if(ap>5)t-=9; else if(ap>3.5)t-=4; else if(ap<1.5)t+=3 }
  s.technical=clamp(t);

  let f=50;
  /* 📌 وحدة الحقل: d.debt_to_equity من الفيدر الخارجي (السوق الأمريكي) بمقياس
     0-100 — أي 50 معناها 50٪. ده مش s.de بتاع السجل المصري اللي نسبة (1.0 = 100٪).
     الحقلين مختلفين بوحدتين مختلفين — ما تدمجهوش. */
  const pe=d.price_earnings_ttm,roe=d.return_on_equity_fq,om=d.operating_margin,de=d.debt_to_equity;
  if(pe==null){ if(d.net_income!=null&&d.net_income<0)f-=12; f-=4 }
  else { pe>40?f-=10 : pe>25?f-=5 : pe<15?f+=6 : f+=2 }
  if(roe!=null){ roe>20?f+=8 : roe>10?f+=4 : roe<0?f-=6 : f-=2 }
  if(om!=null){ om>25?f+=6 : om>15?f+=3 : om<5?f-=5:0 }
  if(de!=null){ de<50?f+=6 : de<150?f+=1 : de>300?f-=10 : f-=4 }
  s.fundamental=clamp(f);

  let v=50;const pb=d.price_book_fq,tgt=d.price_target_median;
  if(pb!=null){ pb<1.5?v+=10 : pb<3?v+=4 : pb<6?v-=3 : v-=9 }
  if(pe!=null){ pe<15?v+=5 : pe>35?v-=5:0 }
  if(tgt!=null&&P){ const up=(tgt/P-1)*100; up>20?v+=8 : up>5?v+=3 : up< -15?v-=8 : v-=3 }
  s.valuation=clamp(v);

  let l=50;const mv=d.market_cap_basic,rv=d.relative_volume_10d_calc;
  if(mv!=null){ mv>1e11?l+=10 : mv>1e10?l+=6 : mv>1e9?l+=1 : mv>1e8?l-=5 : l-=14 }
  if(rv!=null){ rv>1.5?l+=6 : rv>0.8?l+=2 : rv<0.4?l-=5:0 }
  if(d.exchange==='OTC')l-=22;
  s.liquidity=clamp(l);

  let m=50;
  if(d['Perf.1M']!=null){ d['Perf.1M']>15?m+=8 : d['Perf.1M']>5?m+=3 : d['Perf.1M']< -15?m-=8:0 }
  if(d['Perf.Y']!=null){ d['Perf.Y']>25?m+=6 : d['Perf.Y']< -25?m-=6:0 }
  if(d['Recommend.All']!=null){ d['Recommend.All']>0?m+=5 : d['Recommend.All']< -0.2?m-=5:0 }
  s.sentiment=clamp(m);

  let r=50;const vo=d['Volatility.D'],bt=d.beta_1_year;
  if(vo!=null){ vo<1.5?r+=10 : vo<2.5?r+=5 : vo<4?r-=3 : r-=9 }
  if(bt!=null){ bt<0.8?r+=6 : bt<1.2?r+=2 : bt>1.8?r-=8:0 }
  if(de!=null){ de<50?r+=8 : de>200?r-=9:0 }
  if(d.net_income!=null&&d.net_income<0)r-=6;
  s.risk=clamp(r);

  const W=WUS();let a=0,w=0;for(const k in W){a+=s[k]*W[k];w+=W[k]}
  return w?Math.round(a/w):0;
}
function verdictOf(x){
  if(x>=65)return['تجميع / شراء','b-buy'];
  if(x>=50)return['إشارة محايدة','b-hold'];
  if(x>=40)return['متابعة / متردد','b-hold'];
  return['إشارة سلبية','b-sell'];
}

/* ══════════ الرسم ══════════ */
function renderTabs(){
  $('tabs').innerHTML=Object.keys(MARKETS).map(k=>{
  const m=MARKETS[k];
  return'<button class="tab'+(k===MK?' active':'')+'" onclick="setMK(\''+k+'\')">'+
  '<span class="ic">'+m.flag+'</span>'+m.name+'</button>';
  }).join('');
}

function renderFilters(){
  const d = DATA[MK]||{}; const total = (d.stocks||d.top10||[]).length;
  $('filters').innerHTML=FILTERS[MK].map(f=>{
  // {n} بتتحل لعدد الأسهم الكلي
  const label = f.t.replace('{n}', total ? '('+total+')' : '');
  if (f.id !== 'all') return '<button class="fbtn'+(f.id===FILTER?' on':'')+'" onclick="setFilter(\''+f.id+'\')">'+label+'</button>';
  return '<button class="fbtn'+(f.id===FILTER?' on':'')+'" onclick="setFilter(\''+f.id+'\')">'+label+'</button>';
  }).join('');
}

function renderMktBar(){
  $('mktbar').innerHTML=Object.keys(MARKETS).map(k=>{
  const m=MARKETS[k],[st,lb,cl]=phaseOf(k);
  const idx=(DATA[k]&&DATA[k].index);
  const v=idx?nf(idx.value,2):'—';
  const c=idx?idx.change:null;
  return'<div class="mbar"><div class="nm">'+m.flag+' '+m.name+' · '+esc(idx?idx.name:'…')+'</div>'+
  '<div class="vl">'+v+'</div>'+
  '<span class="ch '+(c>=0?'up':'down')+'">'+(c!=null?(c>=0?'▲ +':'▼ ')+c.toFixed(2)+'%':'')+
  ' <span class="ph '+cl+'">'+lb+'</span></span></div>';
  }).join('');
}

function applyFilter(rows,mk){
  let out=rows.slice();
  const f=FILTER;
  // ⚠️ الدرجات ممكن تيجي عشرية (65.9) — لازم نقارن على أرقام صحيحة
  const S=r=>Math.round(r.score||0);
  if(f==='buy')  out=out.filter(r=>S(r)>=65);
  else if(f==='hold') out=out.filter(r=>S(r)>=50&&S(r)<65);
  else if(f==='sell') out=out.filter(r=>S(r)<50);
  else if(f==='high') out.sort((a,b)=>S(b)-S(a));
  else if(f==='safe') out.sort((a,b)=>(b.safety||0)-(a.safety||0));
  else if(f==='liq') out.sort((a,b)=>(b.liquidity||0)-(a.liquidity||0));
  else if(f==='ovr') out=out.filter(r=>r.rel&&r.rel.dY!=null&&r.rel.dY>5).sort((a,b)=>b.rel.dY-a.rel.dY);
  else if(f==='und') out=out.filter(r=>r.rel&&r.rel.dY!=null&&r.rel.dY< -5).sort((a,b)=>a.rel.dY-b.rel.dY);
  // فلاتر مصرى
  else if(f==='big') out.sort((a,b)=>(b.mcap||0)-(a.mcap||0));
  // فلاتر أمريكي على أرقام حقيقية
  else if(f==='mega')  out=out.filter(r=>r.mcap!=null&&r.mcap>=2e11).sort((a,b)=>b.mcap-a.mcap);
  else if(f==='cheap') out=out.filter(r=>r.pe!=null&&r.pe>0&&r.pe<20).sort((a,b)=>a.pe-b.pe);
  else if(f==='prof')  out=out.filter(r=>r.roe!=null&&r.roe>15).sort((a,b)=>b.roe-a.roe);
  else if(f==='grow')  out=out.filter(r=>r.perfY!=null&&r.perfY>20).sort((a,b)=>b.perfY-a.perfY);
  else if(f==='vol')  out=out.filter(r=>r.relvol!=null&&r.relvol>1.2).sort((a,b)=>b.relvol-a.relvol);
  return out;
}

function render(){
  const d=DATA[MK];
  if(!d){ $('out').innerHTML='<div class="load"><span class="spin"></span> جاري التحميل...</div>'; return }

  let rows;
  if(MK==='us'){
  rows=d.stocks.map(s=>Object.assign({
  code:s._symbol.split(':')[1], name:s.description||s.name||s._symbol.split(':')[1], price:s.close,
  change:s.change, score:s._sc, cur:s.fundamental_currency_code||'$',
  sector:s.sector||'—', risk:s.risk, liquidity:s.liquidity, exchange:s.exchange,
  isOTC:s.exchange==='OTC', rel:s._rel, mcap:s.market_cap_basic, pe:s.price_earnings_ttm,
  roe:s.return_on_equity_fq, perfY:s['Perf.Y'], relvol:s.relative_volume_10d_calc,
  _raw:s
  }));
  } else {
  // مصري — كل الأسهم الـ252 من /api/prices
  rows=(d.top10||[]).filter(t=>t&&t.code).map(t=>Object.assign({
  code:t.code, name:t.name, price:t.price, change:t.change,
  score:(t.final_score!=null)?t.final_score:t.score,
  cur:'ج.م', sector:t.sector||'—',
  safety:(t.safety!=null)?t.safety:(t.safety_score!=null?t.safety_score:null),
  riskLevel:t.risk_level, exchange:'EGX', isOTC:false,
  decision:t.decision, conf:t.confidence,
  mcap:t.market_cap_basic||null, pe:t.pe||null, rel:null,
  _raw:t
  }));
  }
  const rows0=rows.slice();
  if(QUERY) rows=rows.filter(r=>
  (r.code||'').toUpperCase().includes(QUERY.toUpperCase()) ||
  (r.name||'').includes(QUERY));

  rows=applyFilter(rows,MK);

  $('cnt').textContent=rows.length?
  ('عرض '+rows.length+' من '+rows0.length+' سهم'):'';

  if(!rows.length){ $('out').innerHTML='<div class="empty">مفيش نتائج للفلتر ده</div>'; return }

  $('out').innerHTML='<div class="grid">'+rows.map(r=>{
  const [vt,vc]=verdictOf(Math.round(r.score));
  const ch=r.change;
  return'<div class="scard '+(ch>=0?'up':'down')+'" onclick="openCard(\''+r.code+'\',null,\''+MK+'\')">'+
  '<div class="sh"><div>'+
  '<div class="scd">'+esc(r.code)+
  (r.isOTC?' <span class="bdg b-otc">OTC</span>':'')+'</div>'+
  '<div class="snm">'+esc(r.name)+'</div>'+
  '</div><div class="spx"><b>'+nf(r.price)+'</b>'+
  '<span class="'+(ch>=0?'up':'down')+'">'+(ch>=0?'▲ +':'▼ ')+nf(ch)+'%</span></div></div>'+
  '<div class="sbar"><span class="tk"><span class="fl '+cls(r.score)+'" style="width:'+Math.round(r.score)+'%"></span></span>'+
  '<span class="nv '+cls(r.score)+'">'+Math.round(r.score)+'</span>'+
  '<span class="bdg '+vc+'">'+vt+'</span></div>'+
  '<div class="rmet">'+
  '<span>'+esc(r.sector)+'</span>'+
  (r.mcap?'<span>القيمة <b>'+big(r.mcap)+'</b></span>':'')+
  (r.rel&&r.rel.dY!=null?'<span>مقابل S&P <b class="'+(r.rel.dY>0?'up':'down')+'">'+sf(r.rel.dY)+'</b></span>':'')+
  (r.safety!=null?'<span>أمان <b>'+nf(r.safety,0)+'</b></span>':'')+
  (r.decision?'<span>قرار المحرك: <b>'+esc(r.decision)+'</b></span>':'')+
  '</div></div>';
  }).join('')+'</div>';
}

async function load(){
  try{
  $('out').innerHTML='<div class="load"><span class="spin"></span> جاري التحميل...</div>';
  // الشريط يبقى فيه كل الأسواق دايمًا — مش بس النشط
  const jobs=Object.keys(MARKETS).map(async k=>{
  try{ DATA[k]= k==='egypt'? await loadEgypt() : await loadUS(); }
  catch(e){ DATA[k]=null; DATA[k+'_err']=e.message; }
  });
  await Promise.all(jobs);
  renderMktBar(); render();
  }catch(e){
  $('out').innerHTML='<div class="err">⚠️ '+esc(e.message||'فشل الاتصال')+
  '<br><br><button class="fbtn on" onclick="load()">🔄 إعادة المحاولة</button></div>';
  }
  clearInterval(TIMER);
  const ms = phaseOf(MK)[0]==='open' ? 60000 : 300000;
  TIMER=setInterval(load, ms);
}

function setMK(k){ MK=k; FILTER='all'; QUERY=''; $('q').value='';
  renderTabs(); renderFilters(); render(); }
function setFilter(f){ FILTER=f; renderFilters(); render(); }

$('q').addEventListener('input',e=>{QUERY=e.target.value.trim();render()});

/* ══════════════════════════════════════════════════════════
  كارت القرار — نفس المنطق لكلا السوقين
  ══════════════════════════════════════════════════════════ */
let MC={mk:null,code:null,sym:null};

function tvLink(){
  if(!MC.sym) return;
  const ex=MARKETS[MC.mk].key==='egypt' ? 'EGX%3A'+encodeURIComponent(MC.code) : encodeURIComponent(MC.sym);
  window.open('https://www.tradingview.com/chart/?symbol='+ex,'_blank');
}

function closeCard(){
  $('mlay').classList.remove('on');
  document.body.style.overflow='';
  MC={mk:null,code:null,sym:null};
}

async function openCard(code,row,mk){
  const useMk = mk||MK;
  MC={mk:useMk,code:code,sym:null};
  const lay=$('mlay');
  lay.classList.add('on'); document.body.style.overflow='hidden';
  $('mTtl').textContent='جارٍ التحميل…';
  $('mBody').innerHTML='<div class="load"><span class="spin"></span> بنحسب الكارت...</div>';
  lay.scrollTop=0;
  try{
  const d = useMk==='us' ? await cardUS(code) : await cardEGX(code,row);
  MC.sym=d._sym;
  $('mTtl').textContent=d._title;
  $('mBody').innerHTML=d._html;
  }catch(e){
  $('mTtl').textContent='كارت القرار';
  $('mBody').innerHTML='<div class="err">⚠️ '+esc(e.message||'فشل جلب البيانات')+
  '<br><br><button class="mbtn" onclick="openCard(\''+code+'\',null,\''+MC.mk+'\')">🔄 إعادة المحاولة</button></div>';
  }
}

/* ── كارت السوق المصري ── */
async function cardEGX(code,row){
  const B=OCTA_API, bus='?_='+Date.now();
  const [intel,expl,tech,fund,risk,news,opp,pf]=await Promise.all([
  fetch(B+'/api/intelligence/'+code+bus).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch(B+'/api/explain/'+code+bus).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch(B+'/api/technical/'+code+bus).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch(B+'/api/fundamental/'+code+bus).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch(B+'/api/risk/'+code+bus).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch(B+'/api/news/'+code+bus).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch(B+'/api/opportunity/'+code+bus).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch(B+'/api/portfolio/fit/'+code+bus).then(r=>r.ok?r.json():null).catch(()=>null)
  ]);
  if(!intel) throw new Error('السهم «'+code+'» مش موجود');

  const ax=intel.axes||{}, f=intel.fundamental||{}, re=intel.risk_engine||{};
  const ex=(expl&&expl.explanation)||{};
  const T=(tech&&tech.technical)||{}, TI=(tech&&tech.indicators)||{};
  const FU=(fund&&fund.fundamental)||fund||{};
  const RK=(risk&&risk.risk)||{};
  const NW=(news&&news.news)||news||{};
  const OP=(opp&&opp.opportunity)||{};
  const S=Math.round(intel.final_score||0);
  const [vt,vc]=verdictOf(S);
  const color=S>=CFG.th.buy?'#16c79a':(S>=CFG.th.hold?'#d4af37':'#ff5252');

  const names={technical:'فني',fundamental:'أساسي',liquidity:'سيولة',news:'أخبار',
  sentiment:'معنويات',risk:'أمان خطر',portfolio:'محفظة'};
  const W=WEGX();
  let arms='';
  for(const k in names){
  const v=Math.round(ax[k]||0);
  arms+='<div class="marm"><span class="nm2">'+names[k]+'</span>'+
  '<span class="tk2"><span class="fl2 '+cls(v)+'" style="width:'+v+'%"></span></span>'+
  '<span class="nv2 '+cls(v)+'">'+v+'</span></div>';
  }

  // ═══ 1. ليه القرار ═══
  let why='';
  (ex.top_positives||[]).slice(0,3).forEach(p=>{why+='<div class="mflag grn"><span>✅</span><span>'+
  esc(p.text)+'<span style="display:block;color:var(--muted);font-size:.7rem">'+esc(p.from)+'</span></span></div>'});
  (ex.top_negatives||[]).slice(0,3).forEach(p=>{why+='<div class="mflag red"><span>⚠️</span><span>'+
  esc(p.text)+'<span style="display:block;color:var(--muted);font-size:.7rem">'+esc(p.from)+'</span></span></div>'});
  if(!why) why='<div class="mflag gold"><span>😐</span><span>مفيش نقاط مميزة اتسجلت</span></div>';

  // ═══ 2. التفاصيل الفنية ═══
  let techHtml='';
  const ind=[['RSI (14)',TI.rsi],['EMA 20',TI.ema20],['EMA 50',TI.ema50],['EMA 200',TI.ema200],
  ['SMA 50',TI.sma50],['ATR',TI.atr],['MACD',TI.macd],['الإشارة',TI.macd_signal]];
  if(TI.rsi!=null||TI.ema20!=null){
  techHtml='<div class="mcard"><div class="msec">📈 التفاصيل الفنية</div><table>'+
  ind.map(x=>x[1]!=null?('<tr><td>'+x[0]+'</td><td><b>'+nf(x[1],2)+'</b></td></tr>'):'').join('')+
  (T.breakdown?'<tr><td>التقييم الفني</td><td><b>'+nf(T.score!=null?T.score:(intel.axes||{}).technical,0)+'/100</b></td></tr>':'')+
  (T.atr_pct!=null?'<tr><td>التذبذب</td><td><b>'+nf(T.atr_pct)+'%</b></td></tr>':'')+
  '</table>'+
  (T.positives&&T.positives.length?'<div style="margin-top:8px;font-size:.72rem;color:var(--sec)">'+
  T.positives.slice(0,2).map(x=>'✅ '+esc(x)).join('<br>')+'</div>':'')+
  (T.negatives&&T.negatives.length?'<div style="margin-top:5px;font-size:.72rem;color:var(--red2)">'+
  T.negatives.slice(0,2).map(x=>'⚠️ '+esc(x)).join('<br>')+'</div>':'')+
  '</div>';
  }

  // ═══ 3. التفاصيل الأساسية ═══
  let fundHtml='';
  const fbd=FU.breakdown||{};
  if(Object.keys(fbd).length||FU.fair_value){
  fundHtml='<div class="mcard"><div class="msec">📊 التفاصيل الأساسية</div><table>'+
  (FU.fair_value?'<tr><td>القيمة العادلة</td><td><b>'+nf(FU.fair_value)+'</b></td></tr>':'')+
  (FU.fair_value_confidence!=null?'<tr><td>ثقة القيمة</td><td>'+nf(FU.fair_value_confidence,0)+'%</td></tr>':'')+
  (FU.upside_pct!=null?'<tr><td>التقدير</td><td><span class="bdg '+
  (FU.upside_pct>0?'b-buy':'b-sell')+'">'+(FU.upside_pct>0?'+':'')+FU.upside_pct+'%</span></td></tr>':'')+
  (FU.valuation_status?'<tr><td>حالة التقييم</td><td>'+esc(FU.valuation_status)+'</td></tr>':'')+
  Object.keys(fbd).map(k=>'<tr><td>'+esc(k)+'</td><td><b>'+nf(fbd[k],0)+'</b></td></tr>').join('')+
  '</table>'+
  (FU.positives&&FU.positives.length?'<div style="margin-top:8px;font-size:.72rem;color:var(--sec)">'+
  FU.positives.slice(0,2).map(x=>'✅ '+esc(x)).join('<br>')+'</div>':'')+
  (FU.negatives&&FU.negatives.length?'<div style="margin-top:5px;font-size:.72rem;color:var(--red2)">'+
  FU.negatives.slice(0,2).map(x=>'⚠️ '+esc(x)).join('<br>')+'</div>':'')+
  '</div>';
  }

  // ═══ 4. المخاطر ═══
  const rbd=RK.breakdown||{};
  let riskHtml='<div class="mcard"><div class="msec">🛡️ محرك المخاطر</div><table>'+
  '<tr><td>مستوى الخطر</td><td><b>'+esc(RK.risk_level||re.risk_level||'—')+'</b></td></tr>'+
  (re.safety_score!=null?'<tr><td>درجة الأمان</td><td><b>'+re.safety_score+'/100</b></td></tr>':'')+
  (re.risk_adjusted_opportunity!=null?'<tr><td>الفرصة معدّلة بالمخاطرة</td><td><b>'+
  nf(re.risk_adjusted_opportunity)+'</b></td></tr>':'')+
  Object.keys(rbd).map(k=>'<tr><td>'+esc(k)+'</td><td><b>'+nf(rbd[k],0)+'</b></td></tr>').join('')+
  '</table>'+
  ((RK.notes||re.notes||[]).length?'<div style="margin-top:8px;font-size:.72rem;color:var(--muted);line-height:1.7">'+
  (RK.notes||re.notes).slice(0,3).map(x=>'• '+esc(x)).join('<br>')+'</div>':'')+
  '</div>';

  // ═══ 5. السيولة ═══
  const lq=intel.liquidity||{};
  const lm=lq.metrics||{};
  let liqHtml='';
  if(Object.keys(lm).length){
  liqHtml='<div class="mcard"><div class="msec">💧 السيولة</div><table>'+
  Object.keys(lm).slice(0,6).map(k=>'<tr><td>'+esc(k)+'</td><td><b>'+
  (typeof lm[k]==='number'?nf(lm[k],1):esc(String(lm[k])))+'</b></td></tr>').join('')+
  (lq.max_safe_position_egp?'<tr><td>أقصى حجم آمن</td><td><b>'+big(lq.max_safe_position_egp)+' ج.م</b></td></tr>':'')+
  '</table>'+
  (lq.risk_note?'<div style="margin-top:7px;font-size:.72rem;color:var(--muted)">'+esc(lq.risk_note)+'</div>':'')+
  '</div>';
  }

  // ═══ 6. الأخبار ═══
  let newsHtml='';
  if(NW){
  const has=NW.has_news!==false&&(NW.events_count>0||(NW.events&&NW.events.length));
  newsHtml='<div class="mcard"><div class="msec">📰 الأخبار والمحفزات</div>'+
  (has?'<div class="mflag grn"><span>📢</span><span><b>فيه أحداث.</b> '+esc(NW.headline||'')+'</div>'
  :'<div class="mflag gold"><span>😐</span><span>'+esc(NW.headline||NW.note||'لا توجد أحداث معلنة')+'</div>')+
  (NW.score!=null?'<div style="font-size:.72rem;color:var(--muted);margin-top:7px">درجة الأخبار: '+
  Math.round(NW.score)+'/100 · materiality: '+esc(String(NW.materiality||'—'))+'</div>':'')+
  '</div>';
  }

  // ═══ 7. الفرص المبكرة ═══
  let oppHtml='';
  if(OP&&Object.keys(OP).length>1){
  oppHtml='<div class="mcard"><div class="msec">🔎 الفرص المبكرة</div><table>'+
  Object.keys(OP).slice(0,8).map(k=>{
  const v=OP[k];
  return (typeof v==='number'||typeof v==='string')
  ?'<tr><td>'+esc(k)+'</td><td><b>'+(typeof v==='number'?nf(v):esc(String(v)))+'</b></td></tr>':'';
  }).join('')+'</table></div>';
  }

  // ═══ 8. ملاءمة المحفظة ═══
  const pd=pf&&pf.fit?pf.fit:pf;
  let pfHtml='';
  if(pd&&(pd.positives||pd.negatives||pd.note)){
  pfHtml='<div class="mcard"><div class="msec">💼 ملاءمة المحفظة</div>'+
  (pd.note?'<div style="font-size:.75rem;color:var(--muted);line-height:1.7;margin-bottom:7px">'+esc(pd.note)+'</div>':'')+
  (pd.positives||[]).slice(0,2).map(x=>'<div class="mflag grn"><span>✅</span><span>'+esc(x)+'</span></div>').join('')+
  (pd.negatives||[]).slice(0,2).map(x=>'<div class="mflag red"><span>⚠️</span><span>'+esc(x)+'</span></div>').join('')+
  (pd.warnings&&pd.warnings.length?'<div class="mflag gold"><span>⚠️</span><span>'+
  esc(pd.warnings.slice(0,2).join(' · '))+'</span></div>':'')+
  '</div>';
  }

  // ═══ 9. المستويات الحقيقية ═══
  const lv=T.levels||{};
  let lvlHtml='';
  if(lv['دعم_1']!=null||lv['مقاومة_1']!=null||TI.atr!=null){
  const ap=T.atr_pct, noChase=(ap&&intel.price)?intel.price*(1+ap/100*2):null;
  lvlHtml='<div class="mcard"><div class="msec">🎯 مستويات حقيقية</div><table>'+
  (lv['مقاومة_1']!=null?'<tr><td>مقاومة 1</td><td><b>'+nf(lv['مقاومة_1'])+'</b></td></tr>':'')+
  (lv['دعم_1']!=null?'<tr><td>دعم 1</td><td><b>'+nf(lv['دعم_1'])+'</b></td></tr>':'')+
  (TI.ema20!=null?'<tr><td>EMA 20</td><td><b>'+nf(TI.ema20)+'</b></td></tr>':'')+
  (TI.ema50!=null?'<tr><td>EMA 50</td><td><b>'+nf(TI.ema50)+'</b></td></tr>':'')+
  (TI.ema200!=null?'<tr><td>EMA 200</td><td><b>'+nf(TI.ema200)+'</b></td></tr>':'')+
  (noChase?'<tr><td>⛔ لا تتسرّب فوق</td><td><b style="color:var(--red2)">'+nf(noChase)+'</b></td></tr>':'')+
  '</table>'+
  '<div style="font-size:.7rem;color:var(--muted);margin-top:7px">محسوبة من بيانات المحرك — مش تقدير</div></div>';
  }

  // ═══ 10. شروط الإبطال ═══
  const inval=(ex.what_could_invalidate||[]);
  const change=(ex.what_could_change_score||[]);
  let invHtml='';
  if(inval.length||change.length){
  invHtml='<div class="mcard"><div class="msec">🚫 شروط الإبطال</div>'+
  change.slice(0,2).map(t=>'<div class="mflag gold"><span>🔄</span><span>'+esc(t)+'</span></div>').join('')+
  inval.slice(0,3).map(t=>'<div class="mflag red"><span>⛔</span><span>'+esc(t)+'</span></div>').join('')+
  '</div>';
  }

  // ═══ 11. فجوة البيانات ═══
  const miss=(ex.missing_data||[]);
  const dc=intel.data_confidence;
  let gapHtml='';
  if(miss.length||(dc!=null&&dc<80)){
  gapHtml='<div class="mcard"><div class="msec">🕳️ فجوة البيانات</div>'+
  '<div class="mflag '+(dc!=null&&dc<60?'red':'gold')+'"><span>⚠️</span><span>'+
  'اكتمال البيانات <b>'+(dc!=null?dc+'%':'—')+'</b>.'+
  (miss.length?' ناقص: '+esc(miss.join('، ')):' الظروف مكتملة لكن الدرجة منخفضة — خلّي بالك.')+
  '</span></div>'+
  '<div style="font-size:.7rem;color:var(--muted);margin-top:6px;line-height:1.7">'+
  'قاعدة OCTA: ما نبنيش قرار قوي على بيانات ناقصة. اقرأ الدرجة مع الفجوة.</div></div>';
  }

  // ═══ freshness ═══
  const flag=intel.data_ts?ago(intel.data_ts):null;
  const stale=flag!=null&&flag>7200;

  return{_sym:'EGX:'+code, _title:intel.name+' · '+code,
  _html:
  '<div class="mcard" style="border-color:'+(stale?'rgba(255,82,82,.4)':'')+'">'+
  '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">'+
  '<div><div style="font-size:.95rem;font-weight:900;color:#fff">'+esc(intel.name)+'</div>'+
  '<div style="font-size:.71rem;color:var(--muted);margin-top:3px">'+esc(code)+' · '+esc(f.sector||intel.sector||'—')+
  ' · أمان '+(re.safety_score!=null?re.safety_score:'—')+' · قرار المحرك: <b>'+esc(intel.decision||'—')+'</b></div></div>'+
  '<div style="text-align:left"><div style="font-size:1.3rem;font-weight:900;color:#fff">'+
  nf(intel.price)+' <span style="font-size:.72rem;color:var(--muted)">ج.م</span></div>'+
  '<span style="font-size:.78rem;font-weight:800;color:'+(intel.change>=0?'var(--sec)':'var(--red2)')+'">'+
  (intel.change>=0?'▲ +':'▼ ')+nf(intel.change)+'%</span></div></div>'+
  (stale?'<div style="margin-top:9px;padding:7px 10px;border-radius:9px;background:rgba(255,138,128,.09);'+
  'border:1px solid rgba(255,82,82,.3);font-size:.72rem;color:var(--red2)">⚠️ آخر تحديث '+
  agoTxt(flag)+' — البيانات قد تكون قديمة</div>':'')+
  '</div>'+

  '<div class="mcard"><div class="msec">🎯 القرار</div>'+ ringHTML(S,color)+
  '<div style="text-align:center"><span class="bdg '+vc+'">'+vt+'</span></div>'+
  '<div style="text-align:center;font-size:.75rem;color:var(--muted);margin-top:8px">'+
  'الدرجة '+S+'/100 · ثقة '+nf(intel.confidence,0)+'% · مكتمل '+(dc!=null?dc+'%':'—')+'</div>'+
  '</div>'+

  '<div class="mcard"><div class="msec">🦞 الأذرع السبعة</div>'+arms+
  '<div style="font-size:.7rem;color:var(--muted);margin-top:8px">أوزان المحرك: مخاطرة <span class="flt-ltr">24%</span> · أساسي <span class="flt-ltr">22%</span> · سيولة <span class="flt-ltr">18%</span></div></div>'+

  '<div class="mcard"><div class="msec">🔍 ليه القرار</div>'+why+
  (ex.formula?'<div style="font-size:.7rem;color:var(--muted);margin-top:7px">المعادلة: '+esc(ex.formula)+'</div>':'')+
  '</div>'+

  lvlHtml + techHtml + fundHtml + riskHtml + liqHtml + newsHtml + oppHtml + pfHtml + gapHtml + invHtml
  };
}

/* ── كارت السوق الأمريكي ── */
async function cardUS(code){
  const m=MARKETS.us;
  const sym = m.stocks.find(s=>s.split(':')[1]===code);
  if(!sym) throw new Error('الرمز مش موجود');
  const syms=m.stocks.concat([m.index]);
  const body=JSON.stringify({symbols:{tickers:syms,query:{types:[]}},columns:US_COLS});
  const r=await fetch(TV_SCAN(),{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body});
  const j=await r.json();
  const row=j.data.find(d=>d.s===sym);
  if(!row) throw new Error('الرمز مش موجود');
  const d={_symbol:sym};
  US_COLS.forEach((c,i)=>d[c]=row.d[i]);
  const bench=j.data.find(x=>x.s===m.index);
  const bi=k=>bench?((bench.d[US_COLS.indexOf(k)]!=null)?bench.d[US_COLS.indexOf(k)]:null):null;

  const sc=scoreUSFull(d);
  const S=sc.total;
  const [vt,vc]=verdictOf(S);
  const color=S>=CFG.th.buy?'#16c79a':(S>=CFG.th.hold?'#d4af37':'#ff5252');
  const names={technical:'فني',fundamental:'أساسي',valuation:'تقييم',liquidity:'سيولة',
  sentiment:'معنويات',risk:'مخاطرة'};
  let arms='';
  for(const k in names){
  const v=sc[k];
  arms+='<div class="marm"><span class="nm2">'+names[k]+'</span>'+
  '<span class="tk2"><span class="fl2 '+cls(v)+'" style="width:'+v+'%"></span></span>'+
  '<span class="nv2 '+cls(v)+'">'+v+'</span></div>';
  }

  // ═══ مقارنة المؤشر ═══
  let cmp='';
  const r1M=(d['Perf.1M']!=null&&bi('Perf.1M')!=null)?d['Perf.1M']-bi('Perf.1M'):null;
  const rY=(d['Perf.Y']!=null&&bi('Perf.Y')!=null)?d['Perf.Y']-bi('Perf.Y'):null;
  if(rY!=null){
  const V=rY>20?'outperform':rY>5?'slight-out':rY< -20?'underperform':rY< -5?'slight-under':'inline';
  const vt2={outperform:['🏆 بيتفوق بوضوح على S&P','أداءه أقوى من السوق بفرق كبير'],
  'slight-out':['📈 تفوق متوسط','أفضل من المؤشر لكن مش دراماتيكي'],
  inline:['➖ مع المؤشر','بيتحرك مع السوق — مفيش أفضلية مستقلة'],
  'slight-under':['📉 ورا المؤشر','السوق أفضل منه'],
  underperform:['🔻 ورا بكتير','أداءه أضعف من المؤشر بشكل واضح']}[V];
  const vc2=V==='outperform'?'grn':(V==='underperform'?'red':'gold');
  cmp='<div class="mcard"><div class="msec">📊 مقارنة مع S&amp;P 500</div>'+
  '<table><tr><th>الفترة</th><th>السهم</th><th>المؤشر</th><th>الفرق</th></tr>'+
  relRW('شهر',d['Perf.1M'],bi('Perf.1M'))+
  relRW('3 شهور',d['Perf.3M'],bi('Perf.3M'))+
  relRW('سنة',d['Perf.Y'],bi('Perf.Y'))+
  '</table>'+
  (r1M!=null&&rY!=null&&Math.sign(r1M)!==Math.sign(rY)
  ?'<div class="mflag gold"><span>⚠️</span><span><b>تعارض مهم:</b> على الشهر '+(r1M>0?'يتفوّق':'يتأخر')+
  ' بـ '+Math.abs(r1M).toFixed(1)+'%، لكن على السنة '+(rY>0?'يتفوّق':'يتأخر')+
  ' بـ '+Math.abs(rY).toFixed(1)+'% — الحركة الحالية مش استمرار، بل ارتداد أو حدث مؤقت.</span></div>':'')+
  '<div class="mflag '+vc2+'"><span>'+vt2[0]+'</span><span>'+vt2[1]+'</span></div>'+
  (d.beta_1_year!=null?'<div style="font-size:.72rem;color:var(--muted);margin-top:7px">'+
  '<b>حساسية السوق:</b> (beta) '+nf(d.beta_1_year,2)+(d.beta_1_year>1.2?' — بيتحرك أكتر من السوق':(d.beta_1_year<0.8?' — مستقل نسبيًا عن السوق':' — قريب من حركة السوق'))+'</div>':'')+
  '</div>';
  }

  // ═══ التفاصيل الفنية ═══
  const ap=(d.ATR!=null&&d.close)?d.ATR/d.close*100:null;
  let techHtml='';
  if(d.RSI!=null||d.EMA20!=null){
  const macdUp=d['MACD.macd']!=null&&d['MACD.signal']!=null?d['MACD.macd']>d['MACD.signal']:null;
  techHtml='<div class="mcard"><div class="msec">📈 التفاصيل الفنية</div><table>'+
  '<tr><td>RSI (14)</td><td><b>'+(d.RSI!=null?nf(d.RSI,1):'—')+'</b> '+
  '<span class="bdg '+(d.RSI>70?'b-sell':(d.RSI>60?'b-hold':'b-buy'))+'">'+
  (d.RSI>70?'تشبّع بيعي':(d.RSI>60?'مرتفع':'طبيعي'))+'</span></td></tr>'+
  '<tr><td>MACD</td><td><b>'+(d['MACD.macd']!=null?nf(d['MACD.macd'],3):'—')+'</b> · إشارة '+
  (d['MACD.signal']!=null?nf(d['MACD.signal'],3):'—')+
  (macdUp!=null?' <span class="bdg '+(macdUp?'b-buy':'b-sell')+'">'+(macdUp?'صاعد':'هابط')+'</span>':'')+'</td></tr>'+
  '<tr><td>EMA 20 / 50 / 200</td><td>'+nf(d.EMA20)+' · '+nf(d.EMA50)+' · '+nf(d.EMA200)+'</td></tr>'+
  '<tr><td>السعر فوق EMA200</td><td>'+(d.close&&d.EMA200 ?
  ('<span class="bdg '+(d.close>d.EMA200?'b-buy':'b-sell')+'">'+
  ((d.close>d.EMA200?'+':'')+((d.close/d.EMA200-1)*100).toFixed(1))+'%</span>')
  : '—')+'</td></tr>'+
  (ap!=null?'<tr><td>التذبذب (ATR)</td><td><b>'+ap.toFixed(2)+'%</b></td></tr>':'')+
  (d.high_52w?'<tr><td>أعلى 52 أسبوع</td><td>$'+nf(d.high_52w)+'</td></tr>':'')+
  (d.low_52w?'<tr><td>أدنى 52 أسبوع</td><td>$'+nf(d.low_52w)+'</td></tr>':'')+
  '</table>'+
  '<div style="font-size:.7rem;color:var(--muted);margin-top:7px">كل الأرقام من البيانات الحية — مش محسوبة يدويًا</div>'+
  '</div>';
  }

  // ═══ التفاصيل الأساسية ═══
  let fundHtml='';
  const pe=d['price_earnings_ttm'], pb=d['price_book_fq'];
  if(pe!=null||pb!=null||d['market_cap_basic']!=null){
  fundHtml='<div class="mcard"><div class="msec">📊 التفاصيل الأساسية</div><table>'+
  (d['market_cap_basic']!=null?'<tr><td>القيمة السوقية</td><td><b>'+big(d['market_cap_basic'])+'</b></td></tr>':'')+
  '<tr><td>سعر/ربحية</td><td><b>'+(pe!=null?nf(pe):'خاسر — مفيش')+'</b></td></tr>'+
  '<tr><td>سعر/كتاب</td><td><b>'+(pb!=null?nf(pb):'—')+'</b></td></tr>'+
  (d['operating_margin']!=null?'<tr><td>هامش تشغيل</td><td><b>'+nf(d['operating_margin'],1)+'%</b></td></tr>':'')+
  (d['gross_margin']!=null?'<tr><td>هامش خام</td><td><b>'+nf(d['gross_margin'],1)+'%</b></td></tr>':'')+
  (d['return_on_equity_fq']!=null?'<tr><td>عائد ملكية</td><td><b>'+nf(d['return_on_equity_fq'],1)+'%</b></td></tr>':'')+
  (d['debt_to_equity']!=null?'<tr><td>دين/ملكية</td><td><b>'+nf(d['debt_to_equity'],0)+'%</b></td></tr>':'')+
  (d['net_income']!=null?'<tr><td>صافي الربح</td><td><b>'+big(d['net_income'])+'</b></td></tr>':'')+
  (d['dividends_yield_current']?'<tr><td>عائد توزيعات</td><td><b>'+nf(d['dividends_yield_current'])+'%</b></td></tr>':'')+
  '</table>'+
  (d['Recommend.All']!=null?'<div style="margin-top:8px;font-size:.72rem;color:var(--muted)">'+
  'توصية المحللين (المجمّعة): <b>'+recTxt(d['Recommend.All'])+'</b>'+
  (d['price_target_median']!=null&&d.close?' · الهدف $'+nf(d['price_target_median'])+
  ' ('+sf((d['price_target_median']/d.close-1)*100)+')':'')+'</div>':'')+
  '</div>';
  }

  // ═══ السيولة ═══
  let liqHtml='';
  if(d['market_cap_basic']!=null||d['relative_volume_10d_calc']!=null){
  liqHtml='<div class="mcard"><div class="msec">💧 السيولة</div><table>'+
  '<tr><td>حجم اليوم</td><td><b>'+(d['volume']!=null?big(d['volume'])+' سهم':'—')+'</b></td></tr>'+
  (d['relative_volume_10d_calc']!=null?'<tr><td>الحجم النسبي</td><td><b>'+
  nf(d['relative_volume_10d_calc'],2)+'×</b></td></tr>':'')+
  (d['total_shares_outstanding']!=null?'<tr><td>عدد الأسهم</td><td><b>'+
  big(d['total_shares_outstanding'])+'</b></td></tr>':'')+
  (d['exchange']!=null?'<tr><td>البورصة</td><td><b>'+esc(d['exchange'])+'</b></td></tr>':'')+
  '</table>'+
  (d.exchange==='OTC'?'<div class="mflag red" style="margin-top:7px"><span>🏚️</span><span>'+
  'سيولة خارج البورصة ضعيفة — حجم التداول بيسيب فروق كبيرة.</span></div>':'')+
  '</div>';
  }

  // ═══ الرايات ═══
  let flags='';
  if(d['earnings_per_share_diluted_ttm']!=null&&d['earnings_per_share_diluted_ttm']<0)
  flags+='<div class="mflag red"><span>🔻</span><span><b>خسائر.</b> ربحية السهم '+
  nf(d['earnings_per_share_diluted_ttm'])+' — صافي ربح '+big(d['net_income'])+'</span></div>';
  if(d['return_on_equity_fq']!=null&&d['return_on_equity_fq']<0)
  flags+='<div class="mflag red"><span>📉</span><span><b>عائد ملكية سالب.</b> '+
  nf(d['return_on_equity_fq'],1)+'% — حقوق الملكية بتتدمر</span></div>';
  if(d['debt_to_equity']!=null&&d['debt_to_equity']>200)
  flags+='<div class="mflag red"><span>⚖️</span><span><b>دين عالي.</b> دين/ملكية '+
  nf(d['debt_to_equity'],0)+'% — ضغط على الأرباح</span></div>';
  if(pe!=null&&pe>100)
  flags+='<div class="mflag red"><span>💸</span><span><b>تقييم غالي.</b> P/E = '+nf(pe)+'</span></div>';
  if(d.exchange==='OTC')
  flags+='<div class="mflag red"><span>🏚️</span><span><b>خارج البورصة.</b> سيولة ضعيفة، '+
  'مفيش إفصاح (SEC)، فروق أسعار بتوسع</span></div>';
  if(d['price_target_median']!=null&&d.close&&d['price_target_median']<d.close*0.95)
  flags+='<div class="mflag red"><span>🎯</span><span><b>فوق هدف المحللين.</b> الهدف $'+
  nf(d['price_target_median'])+' وأنت في $'+nf(d.close)+'</span></div>';
  if(d['Volatility.D']!=null&&d['Volatility.D']>4)
  flags+='<div class="mflag red"><span>🎢</span><span><b>تذبذب عالي.</b> '+
  nf(d['Volatility.D'])+'% يوميًا — ربح وفقدان بالحجم ده</span></div>';
  if(d.RSI!=null&&d.RSI>70)
  flags+='<div class="mflag gold"><span>📈</span><span><b>تشبّع بيعي.</b> RSI '+
  nf(d.RSI,0)+' — السهم متحمس زيادة</span></div>';
  if(!flags) flags='<div class="mflag grn"><span>✅</span><span><b>لا رايات حمراء بارزة</b> في البيانات المتاحة</span></div>';

  // ═══ المستويات ═══
  let lvl='';
  if(ap&&d.EMA200){
  const nc=d.close*(1+ap/100*2);
  lvl='<div class="mcard"><div class="msec">🎯 مستويات حقيقية</div><table>'+
  '<tr><td>مقاومة (EMA200 + ATR)</td><td><b>$'+nf(d.EMA200+d.ATR)+'</b></td></tr>'+
  '<tr><td>⛔ لا تتسرّب فوق</td><td><b style="color:var(--red2)">$'+nf(nc)+'</b></td></tr>'+
  '<tr><td>دعم EMA20</td><td>$'+nf(d.EMA20)+'</td></tr>'+
  '<tr><td>دعم EMA50</td><td>$'+nf(d.EMA50)+'</td></tr>'+
  '<tr><td>دعم EMA200</td><td>$'+nf(d.EMA200)+'</td></tr>'+
  '</table><div style="font-size:.7rem;color:var(--muted);margin-top:7px">'+
  'محسوبة من (ATR) الحقيقي ('+ap.toFixed(2)+'%) — مش تقدير. '+
  'المستوى الأحمر = فوق هنا الدخول بيبقى خطير.</div></div>';
  }

  // ═══ المعنويات ═══
  let sentHtml='';
  if(d['Recommend.All']!=null||d['Perf.1M']!=null){
  sentHtml='<div class="mcard"><div class="msec">🎭 المعنويات</div><table>'+
  (d['Recommend.All']!=null?'<tr><td>توصية المحللين</td><td><b>'+recTxt(d['Recommend.All'])+
  '</b> <span class="bdg '+(d['Recommend.All']>0.1?'b-buy':(d['Recommend.All']< -0.1?'b-sell':'b-hold'))+'">'+
  nf(d['Recommend.All'],2)+'</span></td></tr>':'')+
  (d['Perf.1M']!=null?'<tr><td>أداء شهر</td><td><b class="'+(d['Perf.1M']>=0?'up':'down')+'">'+
  sf(d['Perf.1M'])+'</b></td></tr>':'')+
  (d['Perf.Y']!=null?'<tr><td>أداء سنة</td><td><b class="'+(d['Perf.Y']>=0?'up':'down')+'">'+
  sf(d['Perf.Y'])+'</b></td></tr>':'')+
  '</table>'+
  '<div style="font-size:.7rem;color:var(--muted);margin-top:7px">المعنويات عامل مساعد مش حقيقة — '+
  'وزنه في المحرك '+W_US_FEEL+'% بس.</div></div>';
  }

  // ═══ شروط الإبطال ═══
  let invHtml='';
  const inv=[];
  if(d.exchange==='OTC')inv.push('سوق (OTC) — لو اتشال من التداول نهائيًا، السهم بيبقى بلا سيولة');
  if(d['debt_to_equity']!=null&&d['debt_to_equity']>200)inv.push('لو الدين زاد أكتر — ضغط على الأرباح');
  if(d['earnings_per_share_diluted_ttm']!=null&&d['earnings_per_share_diluted_ttm']<0)
  inv.push('لو الخسائر استمرت — حقوق الملكية بتتدمر');
  if(d['price_target_median']!=null&&d.close&&d['price_target_median']<d.close)
  inv.push('لو السعر عدّى لهدف المحللين — الفكرة ضعفت');
  if(d.RSI!=null&&d.RSI>70)inv.push('لو الـ RSI نزل تحت 50 — الزخم ضعيف');
  if(d.close!=null&&d.EMA200!=null)inv.push('كسر دعم EMA200 ($'+nf(d.EMA200)+') — الترند طويل اتقلب');
  if(inv.length) invHtml='<div class="mcard"><div class="msec">🚫 شروط الإبطال</div>'+
  inv.map(t=>'<div class="mflag red"><span>⛔</span><span>'+esc(t)+'</span></div>').join('')+'</div>';

  // ═══ فجوة البيانات ═══
  const miss=US_COLS.filter(c=>(d[c]!=null&&d[c]!==0)?1:0).length;
  const cov=Math.round(miss/12*100);
  let gapHtml='';
  if(cov<70){
  gapHtml='<div class="mcard"><div class="msec">🕳️ فجوة البيانات</div>'+
  '<div class="mflag '+(cov<50?'red':'gold')+'"><span>⚠️</span><span>'+
  'اكتمال البيانات <b>'+cov+'%</b>.'+
  (cov<50?' بيانات ناقصة — القرار ضعيف الأساس.':' البيانات جزئية — خلّي بالك.')+
  '</span></div>'+
  '<div style="font-size:.7rem;color:var(--muted);margin-top:6px;line-height:1.7">'+
  'قاعدة OCTA: ما نبنيش قرار قوي على بيانات ناقصة.</div></div>';
  }

  const isOTC=d.exchange==='OTC';
  return{_sym:sym, _title:(d.description||d.name||sym)+' · '+code,
  _html:
  (isOTC?'<div class="mcard" style="border-color:rgba(255,82,82,.4);background:linear-gradient(135deg,rgba(255,82,82,.14),rgba(255,82,82,.04))">'+
  '<div style="font-size:.83rem;font-weight:900;color:var(--red2)">🚨 سوق خارج البورصة (OTC)</div>'+
  '<div style="font-size:.75rem;color:var(--txt);line-height:1.7;margin-top:5px">'+
  'سيولة ضعيفة، مفيش إفصاح (SEC)، فروق أسعار بتوسع. رأس مالك في خطر حقيقي.</div></div>':'')+

  '<div class="mcard"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">'+
  '<div><div style="font-size:.95rem;font-weight:900;color:#fff">'+esc(d.description||d.name)+'</div>'+
  '<div style="font-size:.71rem;color:var(--muted);margin-top:3px">'+esc(code)+' · '+esc(d.sector||'—')+
  ' · '+esc(d.industry||'—')+'</div></div>'+
  '<div style="text-align:left"><div style="font-size:1.3rem;font-weight:900;color:#fff">$'+
  nf(d.close)+'</div><span style="font-size:.78rem;font-weight:800;color:'+
  (d.change>=0?'var(--sec)':'var(--red2)')+'">'+(d.change>=0?'▲ +':'▼ ')+nf(d.change)+'%</span></div></div></div>'+

  '<div class="mcard"><div class="msec">🎯 القرار</div>'+ringHTML(S,color)+
  '<div style="text-align:center"><span class="bdg '+vc+'">'+vt+'</span></div>'+
  '<div style="text-align:center;font-size:.75rem;color:var(--muted);margin-top:8px">الدرجة '+S+'/100</div>'+
  '</div>'+

  '<div class="mcard"><div class="msec">🦞 الأذرع الستة</div>'+arms+
  '<div style="font-size:.7rem;color:var(--muted);margin-top:8px">محسوبة من البيانات الحية — مش مكتوبة يدويًا</div></div>'+

  cmp+lvl+techHtml+fundHtml+liqHtml+sentHtml+gapHtml+invHtml+

  '<div class="mcard"><div class="msec">🚨 رايات حمراء</div>'+flags+'</div>'
  };
}

/* نسخة مفصّلة — ترجع كل الأذرع + المجموع (للكارت) */
function scoreUSFull(d){
  const s={};
  const P=d.close, rsi=d.RSI;
  let t=50;
  if(rsi!=null){ if(rsi>70)t-=14; else if(rsi>60)t-=5; else if(rsi<30)t+=8; else if(rsi>45)t+=2; else t-=2 }
  if(P!=null&&d.EMA200!=null){ P>d.EMA200?t+=9:t-=7 }
  if(d['MACD.macd']!=null&&d['MACD.signal']!=null){ (d['MACD.macd']>d['MACD.signal'])?t+=7:t-=6 }
  const ap=(d.ATR!=null&&P)?d.ATR/P*100:null;
  if(ap!=null){ if(ap>5)t-=9; else if(ap>3.5)t-=4; else if(ap<1.5)t+=3 }
  s.technical=clamp(t);

  let f=50;
  /* 📌 وحدة الحقل: d.debt_to_equity من الفيدر الخارجي (السوق الأمريكي) بمقياس
     0-100 — أي 50 معناها 50٪. ده مش s.de بتاع السجل المصري اللي نسبة (1.0 = 100٪).
     الحقلين مختلفين بوحدتين مختلفين — ما تدمجهوش. */
  const pe=d['price_earnings_ttm'],roe=d['return_on_equity_fq'],om=d['operating_margin'],de=d['debt_to_equity'];
  if(pe==null){ if(d['net_income']!=null&&d['net_income']<0)f-=12; f-=4 }
  else { pe>40?f-=10 : pe>25?f-=5 : pe<15?f+=6 : f+=2 }
  if(roe!=null){ roe>20?f+=8 : roe>10?f+=4 : roe<0?f-=6 : f-=2 }
  if(om!=null){ om>25?f+=6 : om>15?f+=3 : om<5?f-=5:0 }
  if(de!=null){ de<50?f+=6 : de<150?f+=1 : de>300?f-=10 : f-=4 }
  s.fundamental=clamp(f);

  let v=50;const pb=d['price_book_fq'],tgt=d['price_target_median'];
  if(pb!=null){ pb<1.5?v+=10 : pb<3?v+=4 : pb<6?v-=3 : v-=9 }
  if(pe!=null){ pe<15?v+=5 : pe>35?v-=5:0 }
  if(tgt!=null&&P){ const up=(tgt/P-1)*100; up>20?v+=8 : up>5?v+=3 : up< -15?v-=8 : v-=3 }
  s.valuation=clamp(v);

  let l=50;const mv=d['market_cap_basic'],rv=d['relative_volume_10d_calc'];
  if(mv!=null){ mv>1e11?l+=10 : mv>1e10?l+=6 : mv>1e9?l+=1 : mv>1e8?l-=5 : l-=14 }
  if(rv!=null){ rv>1.5?l+=6 : rv>0.8?l+=2 : rv<0.4?l-=5:0 }
  if(d.exchange==='OTC')l-=22;
  s.liquidity=clamp(l);

  let m=50;
  if(d['Perf.1M']!=null){ d['Perf.1M']>15?m+=8 : d['Perf.1M']>5?m+=3 : d['Perf.1M']< -15?m-=8:0 }
  if(d['Perf.Y']!=null){ d['Perf.Y']>25?m+=6 : d['Perf.Y']< -25?m-=6:0 }
  if(d['Recommend.All']!=null){ d['Recommend.All']>0?m+=5 : d['Recommend.All']< -0.2?m-=5:0 }
  s.sentiment=clamp(m);

  let r=50;const vo=d['Volatility.D'],bt=d['beta_1_year'];
  if(vo!=null){ vo<1.5?r+=10 : vo<2.5?r+=5 : vo<4?r-=3 : r-=9 }
  if(bt!=null){ bt<0.8?r+=6 : bt<1.2?r+=2 : bt>1.8?r-=8:0 }
  if(de!=null){ de<50?r+=8 : de>200?r-=9:0 }
  if(d['net_income']!=null&&d['net_income']<0)r-=6;
  s.risk=clamp(r);

  const W=WUS();let a=0,wt=0;for(const k in W){a+=s[k]*W[k];wt+=W[k]}
  s.total=wt?Math.round(a/wt):0;
  return s;
}

function recTxt(r){
  return r>0.5?'شراء قوي' : r>0.2?'شراء' : r>0.05?'شراء محايد' : r> -0.05?'محايد'
  : r> -0.2?'إشارة سلبية' : r> -0.5?'إشارة سلبية' : 'بيع قوي';
}
const W_US_FEEL=10;

function relRW(l,a,bb){
  const dd=(a!=null&&bb!=null)?a-bb:null;
  return '<tr><td>'+l+'</td><td class="'+(a>=0?'up':'down')+'">'+sf(a)+'</td>'+
  '<td class="'+(bb>=0?'up':'down')+'">'+sf(bb)+'</td><td>'+
  (dd==null?'—':'<span class="bdg '+(dd>0?'b-buy':(dd<0?'b-sell':'b-hold'))+'">'+
  (dd>0?'+':'')+dd.toFixed(1)+'%</span>')+'</td></tr>';
}

function ringHTML(p,color){
  const R=50,C=2*Math.PI*R;
  return '<div class="mring"><svg width="118" height="118">'+
  '<circle cx="59" cy="59" r="'+R+'" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="10"/>'+
  '<circle cx="59" cy="59" r="'+R+'" fill="none" stroke="'+color+'" stroke-width="10" stroke-linecap="round" '+
  'stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+(C*(1-p/100)).toFixed(1)+
  '" style="transition:stroke-dashoffset 1s"/></svg>'+
  '<div class="v"><b>'+p+'</b><span>OCTA /100</span></div></div>';
}

/* ── أدوات الوقت ── */
function ago(iso){
  if(!iso) return null;
  const t=Date.parse(iso); if(isNaN(t)) return null;
  return Math.max(0,Math.round((Date.now()-t)/1000));
}
function agoTxt(s){
  if(s==null) return 'غير معروف';
  if(s<60) return 'من '+s+' ثانية';
  if(s<3600) return 'من '+Math.round(s/60)+' دقيقة';
  return 'من '+Math.round(s/3600)+' ساعة';
}

/* ══════════ تشغيل ══════════ */
renderTabs(); renderFilters(); renderMktBar(); load().then(()=>renderFilters());
setInterval(renderMktBar,30000);
  window.mkLoad = load;
  window.mkSetMK = setMK;
  
/* ════════════════════════════════════════════════════════════
  بطاقة السهم — تظهر جوه الصفحة تحت التنبيه مباشرة
  ════════════════════════════════════════════════════════════ */
let LAST_ARM = 'market';
let OM_OPEN = false;

function hardCloseViews() {
  ['stockPage','intelPage','dashPage','auditPage','page-markets'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.style.setProperty('display','none','important');
  });
  document.querySelectorAll('.page').forEach(p => {
  p.classList.remove('active');
  p.style.setProperty('display','none','important');
  });
  document.querySelectorAll('.arm-btn').forEach(b => b.classList.remove('active'));
}

function closeStockPanel() {
  const p = document.getElementById('stockPanel');
  if (p) p.style.display = 'none';
  OM_OPEN = false;
}

function restoreArm() {
  // لو جاي من صفحة بحث OCTA — نرجعلهالصفحة دي مش للذراع
  if (OS_ORIGIN) {
  const o = OS_ORIGIN; OS_ORIGIN = null;
  setTimeout(() => { if (typeof switchPage === 'function') switchPage(o); }, 70);
  return;
  }
  setTimeout(() => { if (typeof openArm === 'function') openArm(LAST_ARM || 'market'); }, 70);
}

function goFullAnalysis() {
  const code = window.SI_CODE;
  if (!code) return;
  if (typeof openStock === 'function') {
  closeStockPanel();
  try { openStock(code); return; } catch (e) {}
  }
  restoreArm();
}

/* دوس على سهم → البطاقة تظهر تحت التنبيه */
/* ⛔ إصلاح ١٨ أكتوبر ٢٠٢٦ — openChart كانت بتتندى في ٤ مواضع
   (octa-filters.js سطرين · octa-screener.js سطرين) ومحدش معرّفها
   ⇒ «ReferenceError: openChart is not defined»
   ⛌ الحل: مودال مستقل فيه شارت canvas بتاعنا (octa-chart-live.js)
   — يشتغل ١٠٠٪ · بياناتنا الأصلية من /api/candles · قابل للحفظ.
   ⛌ ماشي بالـopenStockModal: التحليل الكامل جوّه المودال نفسه. */
/* ✅ 18 أكتوبر 2026 — رجعنا لـTradingView (زي ما أحمد طلب).
   ⛌ الـcanvas بتاعنا: ناقصه أدوات رسم وحفظ. الحل النهائي
      للـcanvas جاي في شات «تطوير شارت OCTA» الجديد.
   ⛌ دلوقتي: TradingView iframe بالظبط + زر يفتح نفس الأصل بره
      في تاب جديد (لحد ما الشارت الجديد يجهز).
   ⛌ fixCSP: الـiframe كان أبيض لأن الـCSP بيمنع طلباته الداخلية. */
/* ✅ 19 أكتوبر 2026 — الشارت بقى TradingView واحد لكل الموقع.
   ⛌ كان: canvas بتاعنا (octa-chart-v2.js) → «مفيش شموع» في الفلتر.
   ⛌ السبب: الشارت كان بيتعمل على canvas من /api/candles، والـAPI
      كان مش راجع للرمز ده → من غير شموع.
   ✅ دلوقتي: shart TradingView واحد (assets/js/tv-shim.js) — نفس
      المصدر اللي في صفحة الشارت وفي كارت الذهب. شموع + أدوات رسم. */
/* ⛔ مودال الذهب ومودال السهم بيستخدموا نفس الـid (gmv-chart) —
   فلازم نلفّ على الحاوية جوّه المودال بتاعنا بس. */
function chartHost(modal) {
  if (!modal) return null;
  return modal.querySelector('.gchart');
}
/* 🔎 اسم الشركة بالعربي من قاعدة الأسهم — عشان كل الفلاتر والأدوات
   تفتح بنفس الطريقة حتى لو مانعتش الاسم. */
function chartNameFor(code) {
  var c = String(code || '').toUpperCase();
  try {
    if (typeof OS_DB !== 'undefined' && OS_DB && OS_DB.length) {
      for (var i = 0; i < OS_DB.length; i++) {
        if (OS_DB[i] && OS_DB[i].code === c) return OS_DB[i].name || c;
      }
    }
  } catch (e) { }
  return '';
}
window.openChart = function (code, name, market) {
  code = String(code || '').toUpperCase().trim();
  if (!code) return;
  /* 🐙 19 أكتوبر ٢٠٢٦ — تحقق إن الرمز في قاعدة بياناتنا
     قبل فتح الشارت. لو مش موجود، اعرض رسالة بدل
     "هذا الرمز غير موجود" في TradingView. */
  try {
    if (typeof OS_DB !== 'undefined' && OS_DB && OS_DB.length) {
      var found = null;
      for (var i = 0; i < OS_DB.length; i++) {
        if (OS_DB[i] && OS_DB[i].code === code) { found = OS_DB[i]; break; }
      }
      if (!found) {
        var msg = 'الرمز «' + code + '» غير موجود في OCTA.\n' +
          'ممكن يكون رمز جديد في البورصة أو غير مدرج.\n' +
          'هل تبي تجرب في TradingView؟';
        if (window.confirm(msg)) {
          window.open('https://www.tradingview.com/chart/?symbol=EGX%3A' + encodeURIComponent(code), '_blank', 'noopener');
        }
        return;
      }
      /* لو الـname مش موجود، خده من OS_DB */
      if (!name) name = found.name || code;
    }
  } catch (e) {}
  var label = name || chartNameFor(code) || code;
  var sym = 'EGX:' + code;

  var m = document.getElementById('octaChartModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'octaChartModal';
    m.className = 'octa-chart-modal';
    /* 🐙 19 أكتوبر 2026 — الترويسة بقت: اسم الشركة + الرمز + ⛶ + ×
       ⛌ اتشال: زرار «افتح على TradingView» (مش مطلوب).
       ⛌ اتشال: صف الفريمات (٥د/١٥د/ساعة/يوم/أسبوع) —
          TradingView عنده أزرار الفريم جوّه الرسمة نفسها. */
    /* ⭐ تخطيط من صفين (طلب أحمد 19 أكتوبر ٢٠٢٦):
       صف ١: الاسم العربي وبجانبه الرمز.
       صف ٢: السيرش · التكبير · الاسكرين · × (بترتيب ثابت ومسافات منتظمة). */
    m.innerHTML =
      '<div class="ocm-back" data-close></div>' +
      '<div class="ocm-panel" role="dialog" aria-modal="true">' +
      '<div class="ocm-head">' +
      '<div class="ocm-row1">' +
      '<span class="ocm-title" id="ocm-title"></span>' +
      '<span class="ocm-code" id="ocm-code"></span>' +
      '<span class="ocm-price" id="ocm-price" data-pending="1">' +
        '<span id="ocm-price-v"></span>' +
        '<span class="ocm-change" id="ocm-price-c"></span>' +
      '</span></div>' +
      '<div class="ocm-row2">' +
      '<button class="ocm-close" data-close aria-label="اقفل">✕</button>' +
      '<span class="ocm-slot ocm-slot-shot" id="ocm-shot"></span>' +
      '<span class="ocm-slot ocm-slot-search" id="ocm-pick"></span>' +
      '<a class="ocm-fs" id="ocm-fs" href="https://www.tradingview.com/chart/?symbol=EGX%3ACOMI" target="_blank" rel="noopener noreferrer" aria-label="افتح في TradingView" title="افتح في TradingView (الرسم الكامل)">⛶</a>' +
      '</div>' +
      '</div>' +
      '<div id="gmv-chart" class="gchart"></div>' +
      '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closeOctaChart();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && m.style.display === 'flex' &&
        !(window.OCTA_TV && window.OCTA_TV.isFullscreen(chartHost(m)))) {
        closeOctaChart();
      }
    });
    /* ⛶ يفتح TradingView في تاب جديد (الرسم شغّال هناك)
       بدل ما يوسّع الـiframe (اللي الرسم فيه صعب). */
    var fsBtn = document.getElementById('ocm-fs');
    if (fsBtn) {
      fsBtn.addEventListener('click', function (e) { e.stopPropagation(); });
    }
  }
  m.style.display = 'flex';
  document.body.classList.add('ocm-open');

  /* الاسم + الرمز */
  var tEl = document.getElementById('ocm-title');
  var cEl = document.getElementById('ocm-code');
  if (tEl) { tEl.textContent = '📈 ' + label; tEl.title = label; }
  /* ⭐ الرمز جنب الاسم — زي TradingView بالظبط */
  if (cEl) { cEl.textContent = sym; cEl.title = sym; }

  /* 💰 19 أكتوبر ٢٠٢٦ (الجولة الثالثة) — شغّل تايكر السعر اللحظي.
     بيحدّث العنصر مباشرة (مش من خلال loadChartSymbol). */
  try { window.startPriceTicker && window.startPriceTicker(code); } catch (e1) {}
  if (typeof startPriceTicker === 'function') {
    try { startPriceTicker(code); } catch (e2) {}
  }

  /* ⛔ لو كان ملء الشاشة مفتوح من قبل — اقفله قبل ما نعاود الرسم */
  try {
    if (window.OCTA_TV && window.OCTA_TV.isFullscreen(chartHost(m))) window.OCTA_TV.exitFullscreen();
  } catch (e) {}

  /* ⛶ رابط TradingView — يفتح نفس السهم في تاب جديد (الرسم شغّال) */
  var fsb = document.getElementById('ocm-fs');
  if (fsb) {
    fsb.href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(sym);
    fsb.setAttribute('data-sym', sym);
  }

  /* 🔎 مستطيل البحث — يتعمل مرة واحدة ويتحدّث في كل فتح */
  var slot = document.getElementById('ocm-pick');
  if (slot && window.OCTA_TV && window.OCTA_TV.makePicker) {
    if (!window.__octaChartPick) {
      window.__octaChartPick = window.OCTA_TV.makePicker({
        value: sym,
        onChange: function (it) { loadChartSymbol(it); }
      });
      slot.appendChild(window.__octaChartPick.el);
    } else {
      window.__octaChartPick.setValue(sym);
    }
  }

  function loadChartSymbol(it) {
    if (!it || !it.sym) return;
    var t = document.getElementById('ocm-title');
    var c = document.getElementById('ocm-code');
    if (t) { t.textContent = '📈 ' + (it.name || it.code); t.title = it.name || it.code; }
    if (c) { c.textContent = it.sym; c.title = it.sym; }
    /* 💰 19 أكتوبر ٢٠٢٦ — legend سعر لحظي */
    try { startPriceTicker(it.code || (it.sym || '').split(':').pop()); } catch (e) {}
    var sh = document.getElementById('ocm-shot');
    if (sh && window.OCTA_TV) { sh.innerHTML = ''; sh.appendChild(window.OCTA_TV.makeShotBtn(it.sym)); }
    var fsb = document.getElementById('ocm-fs');
    if (fsb) {
      fsb.href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(it.sym);
      fsb.setAttribute('data-sym', it.sym);
    }
    window.OCTA_TV.whenSized(chartHost(m), function () {
      window.OCTA_TV.mount(chartHost(m), { symbol: it.sym, interval: '1D' });
    });
  }

  /* 📷 زرار التصوير */
  var shotSlot = document.getElementById('ocm-shot');
  if (shotSlot && window.OCTA_TV && window.OCTA_TV.makeShotBtn) {
    shotSlot.innerHTML = '';
    shotSlot.appendChild(window.OCTA_TV.makeShotBtn(sym));
  }
  var fsb = document.getElementById('ocm-fs');
  if (fsb) {
    fsb.href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(sym);
    fsb.setAttribute('data-sym', sym);
  }

  /* 💰 19 أكتوبر ٢٠٢٦ (الجولة الثالثة) — legend عربي بسعر لحظي.
     TradingView widgetembed ما بيعرضش السعر اللحظي (refresh كل 15 دقيقة).
     هنا بنجيب السعر من /api/stocks عند فتح الشارت + كل 15 ثانية. */
  function startPriceTicker(symbol) {
    var priceEl = document.getElementById('ocm-price-v');
    var chgEl = document.getElementById('ocm-price-c');
    var priceBox = document.getElementById('ocm-price');
    if (!priceEl || !chgEl) return;
    function fmt(n) {
      if (n == null || isNaN(n)) return '—';
      return Number(n).toFixed(2);
    }
    function update() {
      /* 19 أكتوبر ٢٠٢٦ — same-origin: الـworker يعمل proxy.
         يتفادى CORP same-site على الـAPI الأصلي. */
      var api = '/api/stocks';
      fetch(api, { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d) return;
          var all = [].concat(d.egx30 || [], d.egx70 || [], d.egx33 || [], d.egx100 || [], d.amwal || [], d.dawabet || []);
          var stk = all.find(function (s) { return s && s.code === symbol; });
          if (!stk) return;
          var p = stk.price;
          var ch = stk.change;
          if (p != null) priceEl.textContent = fmt(p) + ' EGP';
          if (ch != null) {
            chgEl.textContent = (ch > 0 ? '▲ +' : ch < 0 ? '▼ ' : 'ـ ') + fmt(ch) + '%';
            chgEl.className = 'ocm-change ' + (ch > 0 ? 'up' : ch < 0 ? 'down' : 'flat');
          }
          if (priceBox) priceBox.removeAttribute('data-pending');
        }).catch(function () {});
    }
    update();
    /* ⏱ تحديث كل 15 ثانية — نفس تردد TradingView */
    if (window.__octaPriceTimer) clearInterval(window.__octaPriceTimer);
    window.__octaPriceTimer = setInterval(update, 15000);
  }

  /* 📌 19 أكتوبر ٢٠٢٦ — شِيلنا شريط أدوات الرسم OCTA بناءً على طلب
     أحمد. أدوات TradingView الأصلية في الـside toolbar تكفي. */

  /* 📌 19 أكتوبر ٢٠٢٦ — شِيلنا شريط أدوات الرسم OCTA بناءً على طلب
     أحمد. أدوات TradingView الأصلية في الـside toolbar تكفي. */

  /* ⛔ قفل تمرير الصفحة (html + body) عشان متبقاش بتتزحلقش ورا المودال */
  try { if (window.OCTA_TV) window.OCTA_TV.lockPage(true); } catch (e2) {}

  /* ⛔ شارت TradingView — لازم الحاوية يكون ليها حجم قبل التركيب */
  setTimeout(function () {
    try {
      window.OCTA_TV.whenSized(chartHost(m), function () {
        window.OCTA_TV.mount(chartHost(m), { symbol: sym, interval: '1D' });
      });
    } catch (err) {
      var g = chartHost(m);
      if (g) g.innerHTML = '<div class="gempty">الشارت مش متاح دلوقتي.</div>';
    }
  }, 60);
};
window.closeOctaChart = function () {
  var m = document.getElementById('octaChartModal');
  /* ⛔ لو ملء الشاشة مفتوح — اقفله الأول (عشان القفل ما يسيبش المستخدم نص الشاشة) */
  try {
    if (window.OCTA_TV && window.OCTA_TV.isFullscreen(chartHost(m))) window.OCTA_TV.exitFullscreen();
  } catch (e) {}
  if (m) m.style.display = 'none';
  document.body.classList.remove('ocm-open');
  try { if (window.OCTA_TV) window.OCTA_TV.lockPage(false); } catch (e2) {}
  if (window.TV_STOCK) { try { window.TV_STOCK.remove(); } catch (e) {} window.TV_STOCK = null; }
};




async function openStockModal(code) {
  ensurePanel();
  code = String(code || '').toUpperCase().trim();
  if (!code) return;
  window.SI_CODE = code;
  LAST_ARM = window.SI_ARM || LAST_ARM;
  OM_OPEN = true;
  // ═══ ما نقفلش حاجة — البانل يظهر فوق الفلتر مباشرة ═══
  const av = document.getElementById('armView');
  if (av) av.style.display = 'block';

  const p = document.getElementById('stockPanel');
  const body = document.getElementById('spBody');
  const head = document.getElementById('spHead');
  if (!p || !body) return;
  p.style.display = 'block';
  p.style.animation = 'none'; void p.offsetHeight;
  p.style.animation = 'spIn .3s cubic-bezier(.4,0,.2,1)';
  head.textContent = '📊 تحليل ' + code;
  body.innerHTML = '<div class="dc-loading" style="padding:50px;text-align:center;color:#8b9eb0">🔄 جاري التحليل...</div>';
  setTimeout(() => p.scrollIntoView({ behavior:'smooth', block:'start' }), 120);

  try {
  const B = OCTA_API, q = '?_=' + Date.now();
  const [intel, expl, tech] = await Promise.all([
  fetch(B + '/api/intelligence/' + code + q).then(r => r.ok ? r.json() : null).catch(() => null),
  fetch(B + '/api/explain/' + code + q).then(r => r.ok ? r.json() : null).catch(() => null),
  fetch(B + '/api/technical/' + code + q).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);
  if (!intel) throw new Error('بيانات غير متاحة للسهم ' + code);
  const ax = intel.axes || {}, f = intel.fundamental || {}, rk = intel.risk_engine || {};
  const t = (tech && tech.technical) || {}, ex = (expl && expl.explanation) || {};
  const S = Math.round(intel.final_score || 0);
  const dec = intel.decision || '—';
  const col = S >= CFG.th.buy ? '#16c79a' : (S >= CFG.th.hold ? '#d4af37' : '#ff5252');
  const decCol = /تجميع|شراء/.test(dec) ? '#16c79a' : (/بيع|تجنّب/.test(dec) ? '#ff5252' : '#d4af37');
  const chg = intel.change || 0;
  const AX = {technical:'فني',fundamental:'أساسي',liquidity:'سيولة',news:'أخبار',
  sentiment:'معنويات',risk:'أمان',portfolio:'محفظة'};
  let axHtml = '';
  for (const k of Object.keys(AX)) {
  const v = ax[k], val = v == null ? '—' : Math.round(v);
  const c = v == null ? '#8b9eb0' : (v>=CFG.th.safe?'#16c79a':(v>=CFG.th.mid?'#d4af37':'#ff5252'));
  axHtml += '<div class="dc-axis"><div class="da-n">' + AX[k] + '</div>' +
  '<div class="da-v" style="color:' + c + '">' + val + '</div>' +
  '<div class="da-bar"><i style="width:' + (v||0) + '%;background:' + c + '"></i></div></div>';
  }
  const pos = (ex.top_positives||[]).map(x=>'<div class="dc-fact pos">✅ ' + x.text + '</div>').join('');
  const neg = (ex.top_negatives||[]).map(x=>'<div class="dc-fact neg">❌ ' + x.text + '</div>').join('');
  const tp = (t.positives||[]).slice(0,2).map(x=>'<div class="dc-fact pos">📈 ' + x + '</div>').join('');
  const tn = (t.negatives||[]).slice(0,2).map(x=>'<div class="dc-fact neg">📉 ' + x + '</div>').join('');
  body.innerHTML =
  '<div class="dc-result"><div class="dcr-top">' +
  '<div><div class="dcr-code">' + code + '</div><div class="dcr-name">' + (intel.name||'') + '</div>' +
  '<div class="dcr-sect">' + (intel.sector||'') + '</div></div>' +
  '<div class="dcr-price"><div class="dcr-p">' + Number(intel.price||0).toFixed(2) + '</div>' +
  '<div class="dcr-c ' + (chg>=0?'pos':'neg') + '">' + (chg>=0?'▲ +':'▼ ') + chg.toFixed(2) + '%</div></div>' +
  '</div><div class="dcr-scores">' +
  '<div class="dcr-score"><div class="ds-v" style="color:' + col + '">' + S + '</div><div class="ds-l">النتيجة</div></div>' +
  '<div class="dcr-score"><div class="ds-v" style="color:#16c79a">' + (intel.confidence||0) + '%</div><div class="ds-l">الثقة</div></div>' +
  '<div class="dcr-score"><div class="ds-v" style="color:' + decCol + ';font-size:1.05rem;padding:.45rem 0">' + dec + '</div><div class="ds-l">القرار</div></div>' +
  '<div class="dcr-score"><div class="ds-v" style="color:#d4af37;font-size:1.05rem">' + (rk.risk_level||'—') + '</div><div class="ds-l">المخاطرة</div></div>' +
  '</div></div>' +
  '<div class="dc-sect-h">🎯 المحاور السبعة</div><div class="dc-axes">' + axHtml + '</div>' +
  (f.fair_value ? '<div class="dc-fv"><span>القيمة العادلة: <b>' + Number(f.fair_value).toFixed(2) + ' ج.م</b>' +
  (f.upside_pct != null ? ' <small>(' + (f.upside_pct>0?'+':'') + f.upside_pct.toFixed(1) + '%)</small>' : '') +
  '</span><span>' + (f.valuation_status||'') + '</span></div>' : '') +
  ((pos||neg||tp||tn) ? '<div class="dc-sect-h">💡 ليه التقييم كده؟</div><div class="dc-facts">' + pos + tp + neg + tn +
  ((ex.what_could_invalidate||[]).length ? '<div class="dc-fact inv">⚠️ ' + ex.what_could_invalidate[0] + '</div>' : '') +
  '</div>' : '') +
  '<button onclick="goFullAnalysis()" style="margin-top:18px;width:<span class="flt-ltr">100%</span>;padding:13px;background:var(--gold);' +
  'color:#0a1929;border:none;border-radius:12px;font-weight:900;font-size:.92rem;cursor:pointer">' +
  '📊 افتح التحليل الكامل (شارت TradingView + كل التفاصيل)</button>';
  } catch (e) {
  body.innerHTML = '<div class="dc-loading" style="padding:40px;text-align:center;color:#ff5252">❌ ' + (e.message||'') + '</div>';
  }
}

/* إنشاء لوحة السهم جوه الصفحة */
function ensurePanel() {
  if (document.getElementById('stockPanel')) return;
  const d = document.createElement('div');
  d.id = 'stockPanel';
  d.style.cssText = 'max-width:1400px;margin:0 auto 40px;padding:0 22px;display:none';
  d.innerHTML =
  '<div style="background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:20px;padding:22px">' +
  '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">' +
  '<div id="spHead" style="flex:1;font-size:1.05rem;font-weight:900;color:var(--gold)"></div>' +
  '<button onclick="goFullAnalysis()" class="omfull" style="padding:8px 14px;border-radius:9px;border:1px solid rgba(212,175,55,.4);background:rgba(212,175,55,.12);color:var(--gold);font-weight:800;font-size:.78rem;cursor:pointer;font-family:inherit">📊 التحليل الكامل</button>' +
  '<button onclick="closeStockPanel()" class="omx" style="width:34px;height:34px;border-radius:<span class="flt-ltr">50%</span>;border:1px solid var(--line);background:rgba(255,255,255,.06);color:var(--txt);font-size:1.2rem;cursor:pointer;font-family:inherit">×</button>' +
  '</div>' +
  '<div id="spBody"></div>' +
  '</div>';
  // ═══ نحطها في container ثابت فوق armView ═══
  if (!document.getElementById('stockPanelHost')) {
  const host = document.createElement('div');
  host.id = 'stockPanelHost';
  // ═══ نضعه قبل armView مباشرة — يبان في مكانه مش في آخر الصفحة ═══
  const av = document.getElementById('armView');
  if (av && av.parentNode) av.parentNode.insertBefore(host, av);
  else document.body.appendChild(host);
  }
  document.getElementById('stockPanelHost').appendChild(d);
  const st = document.createElement('style');
  st.textContent = '@keyframes spIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}' +
  'body.light #stockPanel>div{background:#fff!important;border-color:#e5e7eb!important}';
  document.head.appendChild(st);
}

/* ══════ فتح صفحة الأسواق ══════ */
function openMarkets() {
  hardCloseViews();
  document.querySelectorAll('.arm-btn').forEach(b => b.classList.remove('active'));
  const pg = document.getElementById('page-markets');
  if (pg) { pg.classList.add('active'); pg.style.setProperty('display','block','important'); }
  const ed = document.getElementById('eduBanner');
  if (ed) ed.style.display = '';
  if (typeof window.mkLoad === 'function') setTimeout(() => { try { window.mkLoad(); } catch(e){ console.warn(e.message); } }, 250);
}

/* ══════ الوضع النهاري ══════ */
function toggleLight() {
  document.body.classList.toggle('light');
  const on = document.body.classList.contains('light');
  try { localStorage.setItem('octa_light', on ? '1' : '0'); } catch(e){}
  const b = document.getElementById('lightBtn');
  if (b) b.textContent = on ? '☀️' : '🌙';
}

/* ══════ التنبيه ══════ */
function toggleEdu() {
  const m = document.getElementById('eduMore');
  if (!m) return;
  const open = m.classList.toggle('open');
  const btn = document.querySelector('.edu-toggle');
  if (btn) btn.textContent = open ? 'إخفاء ▴' : 'التفاصيل ▾';
}

/* ══════ Escape ══════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && OM_OPEN) { closeStockModal(); restoreArm(); }
});

/* ---- OCTA Compare v2 ---- */
/* ══════════════════════════════════════════════════════════════
  ⚖️ OCTA Compare v2 — 6 أصول + radar + فائز لكل مؤشر + ملف المستثمر
  ══════════════════════════════════════════════════════════════ */
let CMP = []; const CMP_MAX = 6;

const CMP_METRICS = [
  { k:'score',  lab:'نتيجة OCTA',  icon:'🐙', dir:'up',
  get:s=>s.score, note:'الدرجة النهائية من المحرك' },
  { k:'roe',  lab:'ROE',  icon:'📈', dir:'up',
  get:s=>s.roe, note:'العائد على حقوق الملكية' },
  { k:'pe',  lab:'P/E',  icon:'💎', dir:'down',
  get:s=>s.pe, note:'أرخص = أفضل' },
  { k:'pb',  lab:'P/B',  icon:'📚', dir:'down',
  get:s=>s.pb, note:'أرخص = أفضل' },
  { k:'rsi',  lab:'RSI',  icon:'⚡', dir:'mid',
  get:s=>s.rsi, note:'30-70 المنطقة الآمنة' },
  { k:'vol1y',  lab:'التذبذب',  icon:'〰️', dir:'down',
  get:s=>s.vol1y, note:'وسط السوق <span class="flt-ltr">44%</span>' },
  { k:'mdd',  lab:'أقصى هبوط',  icon:'🛡️', dir:'down',
  get:s=>s.mdd, note:'أخطر حاجة في تاريخ السهم' },
  { k:'sharpe', lab:'شارب',  icon:'⭐', dir:'up',
  get:s=>s.sharpe, note:'العائد ÷ المخاطرة' },
  { k:'cagr3y', lab:'نمو السعر 3 سنين', icon:'🚀', dir:'up',
  get:s=>s.cagr3y, note:'نمو سعر السهم المركّب على 3 سنين — مش نمو الشركة' },
  { k:'yield',  lab:'عائد التوزيع',  icon:'💰', dir:'up',
  get:s=>s.yield, note:'التوزيع ÷ السعر' },
  { k:'change', lab:'تغير اليوم',  icon:'📊', dir:'up',
  get:s=>s.change, note:'أداء الجلسة' },
  { k:'mcap',  lab:'القيمة السوقية', icon:'🏢', dir:'up',
  get:s=>s.mcap, note:'حجم الشركة' },
];
const CMP_AXES = ['roe','pe','sharpe','cagr3y','score','yield'];
const CMP_HUES = ['#16c79a','#d4af37','#4dabf7','#ff8f4d','#e05fa8','#8b7cf6'];

const cmpN = v => (typeof v==='number' && isFinite(v)) ? v : null;
const cmpF = (v,d) => v==null ? '—' : Number(v).toFixed(d==null?1:d);
const cmpColor = i => CMP_HUES[i % CMP_HUES.length];
function cmpMcap(v){
  if (!v) return '—';
  const n = Number(v);
  if (n >= 1e9) return (n/1e9).toFixed(1)+' مليار';
  if (n >= 1e6) return (n/1e6).toFixed(0)+' مليون';
  return n.toFixed(0);
}
function cmpVal(m, v){
  if (v == null) return '—';
  if (m.k==='mcap') return cmpMcap(v);
  /* 🔴 كل حاجة مرّت على السطر الأخير وطلعت بنسبة — حتى الحاجات مش نسب:
     P/E و P/B مضاعفين (6.0 مش 600%) · RSI مؤشر من 0 لـ100 مش نسبة.
     */
  if (m.k==='score')  return Number(v).toFixed(0)+' / 100';
  if (m.k==='sharpe') return Number(v).toFixed(2);
  if (m.k==='pe' || m.k==='pb') return Number(v).toFixed(1)+'×';
  if (m.k==='rsi')  return Number(v).toFixed(0);
  if (m.k==='change') return (v>0?'+':'')+Number(v).toFixed(2)+'٪';
  return Number(v).toFixed(1)+'٪';
}

function cmpRenderPicker(){
  const host = document.getElementById('cmpPick'); if (!host) return;
  const db = OS_DB.filter(x=>x.price>0).sort((a,b)=>(b.score||0)-(a.score||0));
  let h = '<div class="cmp-picks">';
  for (let i=0;i<CMP_MAX;i++){
  const cur = CMP[i], col = cmpColor(i);
  h += '<div class="cmp-slot'+(cur?' on':'')+'" style="--slot:'+col+'">' +
  '<span class="cmp-slot-n" style="background:'+col+'">'+(i+1)+'</span>' +
  '<select class="cmp-sel" onchange="cmpPick('+i+',this.value)">' +
  '<option value="">— اختر سهم —</option>' +
  db.map(x=>'<option value="'+x.code+'"'+(cur===x.code?' selected':'')+'>'+x.code+' · '+(x.name||'').slice(0,26)+'</option>').join('') +
  '</select>' +
  (cur?'<button class="cmp-x" onclick="cmpRemove('+i+')">✕</button>':'') +
  '</div>';
  }
  h += '</div><div class="cmp-quick">' +
  '<button class="dv-tab" onclick="cmpPreset(\'top\')">🔥 أعلى نتيجة</button>' +
  '<button class="dv-tab" onclick="cmpPreset(\'safe\')">🛡️ الأكثر أماناً</button>' +
  '<button class="dv-tab" onclick="cmpPreset(\'chance\')">⚡ فرص RSI</button>' +
  '<button class="dv-tab" onclick="cmpPreset(\'div\')">💰 أعلى توزيع</button>' +
  '<button class="dv-tab" onclick="cmpClear()">🧹 صفّر</button>' +
  '</div>';
  host.innerHTML = h;  /* ⚠️ السطر ده كان ناقص — الفلاتر مكانتش بتظهر */
}

function cmpPick(i, code){
  CMP[i] = code || undefined;
  cmpRenderPicker(); cmpRender();
}
function cmpRemove(i){ CMP[i] = undefined; cmpRenderPicker(); cmpRender(); }
function cmpClear(){ CMP = []; cmpRenderPicker(); cmpRender(); }

function cmpPreset(kind){
  const db = OS_DB.filter(x=>x.price>0);
  let pick = [];
  if (kind==='top')  pick = db.filter(x=>x.score>0).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,CMP_MAX).map(x=>x.code);
  if (kind==='safe')  pick = db.filter(x=>cmpN(x.vol1y)!=null&&cmpN(x.mdd)!=null&&x.vol1y<32&&x.mdd<60).sort((a,b)=>(a.vol1y-b.vol1y)).slice(0,CMP_MAX).map(x=>x.code);
  if (kind==='chance') pick = db.filter(x=>cmpN(x.rsi)!=null&&x.rsi<36&&x.rsi>5).sort((a,b)=>(a.rsi-b.rsi)).slice(0,CMP_MAX).map(x=>x.code);
  if (kind==='div')  pick = db.filter(x=>cmpN(x.yield)>0).sort((a,b)=>(b.yield||0)-(a.yield||0)).slice(0,CMP_MAX).map(x=>x.code);
  if (!pick.length) pick = ['COMI','MICH','EGAL'];
  CMP = []; pick.forEach((c,i)=>CMP[i]=c);
  cmpRenderPicker(); cmpRender();
}

function cmpRadar(list){
  const axes = CMP_AXES.map(k => CMP_METRICS.find(m=>m.k===k)).filter(Boolean);
  const N = axes.length, CX=160, CY=150, R=108;
  function norm(m, s){
  const n = cmpN(m.get(s)); if (n==null) return 0;
  const vals = list.map(x=>cmpN(m.get(x))).filter(v=>v!=null);
  if (!vals.length) return 0;
  let lo=Math.min.apply(null,vals), hi=Math.max.apply(null,vals);
  if (m.k==='rsi'){ lo=10; hi=90; }
  if (m.k==='pe'||m.k==='pb'){ lo=Math.max(0.5,lo); hi=Math.max(hi,lo*1.2); }
  if (m.k==='mdd'){ hi=Math.max(hi,lo+5); }
  if (hi===lo) return 0.55;
  let t=(n-lo)/(hi-lo);
  if (m.dir==='down') t=1-t;
  if (m.k==='rsi') t=1-Math.abs(n-50)/45;
  return Math.max(0.08, Math.min(1,t));
  }
  function pt(i,r){
  const a=-Math.PI/2 + i*2*Math.PI/N;
  return [ (CX+Math.cos(a)*r*R).toFixed(1), (CY+Math.sin(a)*r*R).toFixed(1) ];
  }
  let g='';
  [0.25,0.5,0.75,1].forEach(function(k){
  g += '<polygon points="'+axes.map(function(_,i){return pt(i,k).join(',');}).join(' ')+'" fill="none" stroke="var(--line)" stroke-width="1"/>';
  });
  axes.forEach(function(m,i){
  const p=pt(i,1);
  g += '<line x1="'+CX+'" y1="'+CY+'" x2="'+p[0]+'" y2="'+p[1]+'" stroke="var(--line)"/>';
  const l=pt(i,1.26);
  g += '<text x="'+l[0]+'" y="'+l[1]+'" text-anchor="middle" font-size="9.5" fill="var(--muted)">'+m.icon+' '+m.lab+'</text>';
  });
  list.forEach(function(s,si){
  const col=cmpColor(si);
  const poly=axes.map(function(m,i){return pt(i,norm(m,s)).join(',');}).join(' ');
  g += '<polygon points="'+poly+'" fill="'+col+'" fill-opacity="0.15" stroke="'+col+'" stroke-width="2" stroke-linejoin="round"/>';
  axes.forEach(function(m,i){
  const p=pt(i,norm(m,s));
  g += '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="2.8" fill="'+col+'"/>';
  });
  });
  return '<svg viewBox="0 0 320 300" class="cmp-radar">'+g+'</svg>';
}

function cmpWinners(list){
  const out=[];
  CMP_METRICS.forEach(function(m){
  const vals=list.map(s=>cmpN(m.get(s)));
  if (!vals.some(v=>v!=null)) return;
  let bi=-1, bv=null;
  vals.forEach(function(v,i){
  if (v==null) return;
  let better;
  if (m.k==='rsi') better = (bv==null) ? true : Math.abs(v-50) < Math.abs(bv-50);
  else if (m.dir==='down') better = (bv==null) ? true : v < bv;
  else better = (bv==null) ? true : v > bv;
  if (better){ bi=i; bv=v; }
  });
  if (bi<0) return;
  out.push({ m:m, code:list[bi].code, val:cmpVal(m,bv), color:cmpColor(bi) });
  });
  return out;
}

function cmpProfile(s){
  const t=[];
  const sc = cmpN(s.score);
  if (sc!=null) t.push({ i:'🐙', c: sc>=65?'good':(sc>=50?'':'bad'), x:'نتيجة OCTA '+sc.toFixed(0)+'/100' });
  if (cmpN(s.mdd)!=null) t.push(s.mdd>70 ? {i:'⚠️',c:'bad',x:'أقصى هبوط '+s.mdd.toFixed(0)+'% — مخاطرة عالية'}
  : (s.mdd<35 ? {i:'🛡️',c:'good',x:'هبوط محدود ('+s.mdd.toFixed(0)+'%)'} : null));
  if (cmpN(s.vol1y)!=null) t.push(s.vol1y<28 ? {i:'〰️',c:'good',x:'هادي — تذبذب '+s.vol1y.toFixed(0)+'%'}
  : (s.vol1y>60 ? {i:'🎢',c:'bad',x:'م··ذبذب — '+s.vol1y.toFixed(0)+'%'} : null));
  if (cmpN(s.rsi)!=null) t.push(s.rsi<32 ? {i:'⚡',c:'good',x:'متشبع بيعي — RSI '+s.rsi.toFixed(0)}
  : (s.rsi>70 ? {i:'🔴',c:'bad',x:'متشبع شرائي — RSI '+s.rsi.toFixed(0)} : null));
  if (cmpN(s.roe)>20)  t.push({i:'📈',c:'good',x:'مشترك قوي — ROE '+s.roe.toFixed(0)+'%'});
  if (cmpN(s.pe)>0 && cmpN(s.pe)<10) t.push({i:'💎',c:'good',x:'رخيص — P/E '+s.pe.toFixed(1)});
  if (cmpN(s.yield)>=5) t.push({i:'💰',c:'good',x:'عائد توزيعي '+s.yield.toFixed(1)+'%'});
  if (cmpN(s.cagr3y)>20)  t.push({i:'🚀',c:'good',x:'نمو سعر '+s.cagr3y.toFixed(0)+'٪ سنوي 3 سنين'});
  if (cmpN(s.sharpe)>1.5) t.push({i:'⭐',c:'good',x:'شارب ممتاز '+s.sharpe.toFixed(2)});
  return t.filter(Boolean).slice(0,4);
}

function cmpVerdict(list){
  const rows=[];
  list.forEach(function(s,i){
  let pts=0,n=0;
  CMP_METRICS.forEach(function(m){
  const v=cmpN(m.get(s)); if (v==null) return;
  const vals=list.map(x=>cmpN(m.get(x))).filter(x=>x!=null);
  if (vals.length<2) return;
  const lo=Math.min.apply(null,vals), hi=Math.max.apply(null,vals);
  let r;
  if (m.k==='rsi') r=1-Math.abs(v-50)/45;
  else if (m.dir==='down') r=1-(v-lo)/(hi-lo+1e-9);
  else r=(v-lo)/(hi-lo+1e-9);
  pts+=r; n++;
  });
  rows.push({ s:s, i:i, pct: n?Math.round(pts/n*100):0, wins:0 });
  });
  const win=cmpWinners(list);
  rows.forEach(function(r){ r.wins = win.filter(w=>w.code===r.s.code).length; });
  rows.sort((a,b)=> (b.wins-a.wins) || (b.pct-a.pct));
  const top=rows[0]||{s:{code:'—',name:''},pct:0,wins:0};
  const label = top.pct>=75 ? 'الأقوى في المقارنة'
  : (top.pct>=55 ? 'متوازن — اختيارك حسب هدفك' : 'متشابه كتير — الفرق بسيط');
  return { rows:rows, top:top, label:label, win:win };
}

function cmpRender(){
  const out=document.getElementById('cmpOut'); if (!out) return;
  const list = CMP.filter(Boolean).map(c=>OS_DB.find(x=>x.code===c)).filter(x=>x&&x.price>0);
  if (list.length<2){
  out.innerHTML='<div class="cmp-empty">⚖️ اختر سهمين على الأقل — كلما زاد العدد، المقارنة أدق</div>';
  return;
  }
  const V=cmpVerdict(list);

  let bars='<div class="cmp-ranks">';
  V.rows.forEach(function(r,k){
  const col=cmpColor(r.i);
  bars += '<div class="cmp-rank'+(k===0?' top':'')+'" onclick="openStock(\''+r.s.code+'\')" style="--slot:'+col+'">' +
  '<span class="cmp-rank-n">'+(k===0?'🏆':(k+1))+'</span>' +
  '<span class="cmp-rank-c">'+r.s.code+'</span>' +
  '<span class="cmp-rank-m">'+(r.s.name||'')+'</span>' +
  '<span class="cmp-rank-b"><i style="width:'+r.pct+'%;background:'+col+'"></i></span>' +
  '<span class="cmp-rank-p">'+r.pct+'%</span>' +
  '<span class="cmp-rank-w">🏆 '+r.wins+'</span></div>';
  });
  bars+='</div>';

  let cards='<div class="cmp-cards">';
  list.forEach(function(s,i){
  const col=cmpColor(i), chg=Number(s.change||0), d=spDecStyle(s.decision);
  const prof=cmpProfile(s);
  cards += '<div class="cmp-card" style="--slot:'+col+'" onclick="openStock(\''+s.code+'\')">' +
  '<div class="cmp-card-hd"><span class="cmp-card-c">'+s.code+'</span><span class="cmp-card-dot"></span></div>' +
  '<div class="cmp-card-n">'+(s.name||'')+'</div>' +
  '<div class="cmp-card-s">'+(s.sector||'—')+'</div>' +
  '<div class="cmp-card-pr"><b>'+Number(s.price||0).toFixed(2)+'</b> ج' +
  '<span class="cmp-card-cg '+(chg>=0?'up':'down')+'">'+(chg>=0?'▲+':'▼')+chg.toFixed(2)+'%</span></div>' +
  '<div class="cmp-card-d" style="color:'+d.c+';background:'+d.bg+'">'+(s.decision||'—')+'</div>' +
  '<div class="cmp-card-prof">'+(prof.length ? prof.map(p=>'<span class="cmp-tag '+(p.c||'')+'">'+p.i+' '+p.x+'</span>').join('') : '<span class="cmp-tag">لا إشارات مميزة</span>')+'</div>' +
  '</div>';
  });
  cards+='</div>';

  let tbl='<div class="cmp-tablewrap"><table class="cmp-table"><thead><tr><th>المؤشر</th>';
  list.forEach(function(s,i){ tbl+='<th style="--slot:'+cmpColor(i)+'">'+s.code+'</th>'; });
  tbl+='</tr></thead><tbody>';
  CMP_METRICS.forEach(function(m){
  const w=V.win.find(x=>x.m.k===m.k);
  tbl+='<tr><td class="cmp-th" title="'+m.note+'">'+m.icon+' '+m.lab+'<small>'+m.note+'</small></td>';
  list.forEach(function(s,i){
  const v=cmpN(m.get(s)), isW=(w&&w.code===s.code);
  tbl+='<td class="'+(isW?'win':'')+(v==null?' na':'')+'">'+cmpVal(m,v)+(isW?' <span class="cmp-w">🏆</span>':'')+'</td>';
  });
  tbl+='</tr>';
  });
  tbl+='</tbody></table></div>';

  let wg='<div class="cmp-wgrid">';
  V.win.forEach(function(w){
  wg+='<div class="cmp-wcell" style="--slot:'+w.color+'" onclick="openStock(\''+w.code+'\')">' +
  '<span class="cmp-wcell-m">'+w.m.icon+' '+w.m.lab+'</span>' +
  '<span class="cmp-wcell-c">'+w.code+'</span>' +
  '<span class="cmp-wcell-v">'+w.val+'</span></div>';
  });
  wg+='</div>';

  out.innerHTML =
  '<div class="cmp-verdict">' +
  '<div class="cmp-vtitle">🎯 '+V.label+'</div>' +
  '<div class="cmp-vsub">'+V.top.s.code+' — '+(V.top.s.name||'')+' · '+V.top.pct+'% توافق · '+V.top.wins+' مؤشر</div>' +
  '<div class="cmp-vnote">لكل مؤشر بنحسب ترتيب كل سهم داخل المقارنة دي ونجمعه. الأعلى = فايز. ' +
  'المؤشرات ناقصة على بعض الأسهم — فالمقارنة بتتعمل على الموجود بس.</div>' +
  '</div>' +
  '<div class="cmp-sec-h">🏅 الترتيب النهائي</div>'+bars+
  '<div class="cmp-sec-h">📊 الصورة الأكبر — 6 محاور</div>'+
  '<div class="cmp-radarwrap">'+cmpRadar(list)+'<div class="cmp-legend">'+
  list.map((s,i)=>'<span style="--slot:'+cmpColor(i)+'"><i></i>'+s.code+'</span>').join('')+
  '</div></div>'+
  '<div class="cmp-sec-h">🏆 مين فايز في كل مؤشر</div>'+wg+
  '<div class="cmp-sec-h">📋 الجدول الكامل</div>'+tbl+
  '<div class="cmp-sec-h">🧭 كل سهم ومناسب لمين</div>'+cards;
}

function cmpInit(){
  const db = OS_DB.filter(x=>x.price>0);
  if (!db.length){
  const host=document.getElementById('cmpPick');
  if (host) host.innerHTML='<div class="cmp-empty">⏳ جاري تحميل الأسهم…</div>';
  return;
  }
  if (!CMP.filter(Boolean).length){
  const def = db.filter(x=>x.score>0).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,3).map(x=>x.code);
  CMP = [];
  (def.length>=2 ? def : ['COMI','MICH','EGAL']).forEach((c,i)=>CMP[i]=c);
  }
  cmpRenderPicker(); cmpRender();
}


/* ---- المقارنة الذكية ---- */
/* ══════════════════════════════════════════════════════════════
  ⭐ المقارنة الذكية — HOOK المشروع
  اكتب كود أو اسم عربي، دوس ➕، يتضاف الكارت (لحد 10)
  بيجمع البيانات لحظياً ويقيّم ويشرح كل سهم
  ══════════════════════════════════════════════════════════════ */
const PICK_MAX = 10;
let PICK = [];  /* الأكواد */
let PICK_DATA = {};  /* نسخة البيانات وقت الإضافة — مش دلوقتي */
const PICK_TIME = {};

/* 🐛 تصحيح أسماء — HDBK كان «بنك الإسكندرية»، الصح «بنك التعمير والإسكان» */
const OCTA_NAME_FIX = { HDBK:'بنك التعمير والإسكان' };
const PICK_HUES = ['#16c79a','#d4af37','#4dabf7','#ff8f4d','#e05fa8','#8b7cf6',
  '#3bc9d6','#f26b8a','#9ad14b','#c9a227'];
const pickColor = i => PICK_HUES[i % PICK_HUES.length];

/* 🎨 لون النص الآمن (WCAG AA ≥ 4.5:1)
   ألوان PICK_HUES كلها باستثناء واحدة فاتحة على خلفية فاتحة (light mode).
   بنغمّق اللون رياضياً لحد ما النسبة تعدّي 4.5:1 — مش رقم ثابت متخيّط. */
const _ptLum = h => {
  const c = [1,3,5].map(i => parseInt(h.substr(i,2),16)/255)
    .map(v => v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
  return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
};
const PT_LIGHT_BG = (function(){            /* لون خلفية الجدول في الوضع الفاتح */
  const c=[0xf4,0xf6,0xf9];
  const l=c.map(v=>{ v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); });
  return 0.2126*l[0] + 0.7152*l[1] + 0.0722*l[2];
})();
const pickColorT = i => {
  const h = pickColor(i);
  const bg = PT_LIGHT_BG, need = 4.5;
  let out = h;
  for (let k=0; k<=10; k++){                 /* 10 خطوات تغمق أكتر من اللازم */
    const f = 1 - k*0.09;
    if (f <= 0) break;
    out = '#'+[1,3,5].map(i2 => {
      const v = Math.round(parseInt(h.substr(i2,2),16)*f);
      return ('0'+Math.max(0,Math.min(255,v)).toString(16)).slice(-2);
    }).join('');
    const lb = _ptLum(out);
    if ((bg+0.05)/(lb+0.05) >= need) return out;
  }
  return '#0f1b2b';                          /* آخر حاجة: لون آمن مضمون */
};

/* 🧮 التقييم — نفس منطق كارت القرار: 5 محاور
   ⚠ الأوزان مش مكتوبة هنا مرتين: pickScore() دي بتقرأ PICK_AXES
      (المصفوفة الوحيدة أسفل الصفحة) عشان الكود يقول اللي في الصندوق.
      قبل 2026-10-15 الصندوق كان بيقول 30/20/20/15/15 والكود بيقسم بالتساوي
      على المتاح ⇒ الأوزان المكتوبة للمستخدم كانت مش المكتوبة في الكود.
   ⛔ القاعدة (نفس محرك OCTA): لو محور ناقص ما بنحطّش له رقم وسط —
      بنستبعده وبنقسم على مجموع أوزان المتاح بس. */
function pickScore(s){
  const n = v => (typeof v==='number' && isFinite(v)) ? v : null;
  const sc  = n(s.score);
  /* P/E بأشرطة مطلقة — أدق من المعادلة النسبية (0-100 جاهزة) */
  const peV = n(s.pe)>0 ? (s.pe<6?95 : s.pe<10?85 : s.pe<15?70 : s.pe<22?55 : s.pe<30?40 : 25) : null;
  const liqv = n(s.volume);
  const rs   = n(s.rsi);
  const df   = n(s.dy);
  const axes = { tech:null, fund:peV, liq:liqv, val:df, risk:rs };
  /* ⛔ المحرك بيرجّع 0 لما السهم مالوش بيانات خالص (مؤقفة/مغلقة:
     DCCC·KNGC·PMSC·EFAC… عندهم total=0 وحجم=0. صفر هنا مش «تقييم ضعيف»،
     ده «مفيش تقييم». بنعتبره محور ناقص بدل ما نطبع 0 قدام المستخدم. */
  const val = {
    score: (sc==null || sc<=0) ? null : Math.max(0, Math.min(100, sc)),
    val  : peV,
    rsi  : rs==null ? null : (rs<25||rs>78?30 : rs<32||rs>70?60 : rs<42||rs>60?80 : 100),
    liq  : (liqv==null || liqv<=0) ? null : (() => { const m=[1e4,5e7];
        return Math.max(0,Math.min(1,(Math.log10(Math.max(liqv,m[0]))-4)/(Math.log10(m[1])-4)))*100; })(),
    dy   : df==null ? null : Math.max(0, Math.min(100, df/8*100)),
  };
  /* 🔴 إصلاح 2026-10-15: السطر القديم كان
       pts += Math.max(0, Math.min(100, 100 - val*100/25))
     و val هو 0-100 أصلاً ⇒ 100 - 4×val ≤ 0 دايماً ⇒ **محور التقييم كان
     بيساهم بصفر مهما كان الـP/E** (حتى P/E = 3). ولسه كان بيزوّد cnt
     فينقسم عليه، فكان بيسحب 20% من الدرجة لكل سهم تقييماً ضيّعناه.
     الصح: val نفسها هي الدرجة 0-100. */
  let pts=0, wsum=0, cnt=0;
  PICK_AXES.forEach(a=>{
    const v = val[a.k]; if (v==null) return;   /* ⛔ محور ناقص = مستبعد */
    pts += v*a.w; wsum += a.w; cnt++;
  });
  return { total: wsum?Math.round(pts/wsum):null, axes:axes, have:cnt, wHave:wsum };
}
/* 🎯 القرار — بنسق منطقي موثّق */
function pickDecision(s, sc){
  const n = v => (typeof v==='number' && isFinite(v)) ? v : null;
  const rs=n(s.rsi), mdd=n(s.mdd), roe=n(s.roe), pe=n(s.pe), dy=n(s.dy), cg=n(s.cagr3y), vol=n(s.vol1y);
  const notes = [];
  if (pe!=null) notes.push(pe<8 ? '💎 رخيص — P/E '+pe.toFixed(1)
  : pe>28 ? '⚠️ غالي — P/E '+pe.toFixed(1) : '📊 تقييم معقول — P/E '+pe.toFixed(1));
  if (roe!=null && roe>18) notes.push('📈 ROE قوي — '+roe.toFixed(0)+'%');
  if (rs!=null) notes.push(rs<32 ? '⚡ RSI '+rs.toFixed(0)+' — متشبع بيعي (فرصة)'
  : rs>70 ? '🔴 RSI '+rs.toFixed(0)+' — متشبع شرائي (خطر)' : '📈 RSI '+rs.toFixed(0)+' — منطقة آمنة');
  if (mdd!=null) notes.push(mdd>70 ? '⚠️ أقصى هبوط '+mdd.toFixed(0)+'% — مخاطرة عالية'
  : mdd<30 ? '🛡️ هبوط محدود '+mdd.toFixed(0)+'%' : null);
  if (vol!=null) notes.push(vol<25 ? '〰️ هادي — تذبذب '+vol.toFixed(0)+'%'
  : vol>55 ? '🎢 متذبذب — '+vol.toFixed(0)+'%' : null);
  if (dy!=null && dy>=4) notes.push('💰 عائد توزيعي '+dy.toFixed(1)+'%');
  if (cg!=null && cg>20) notes.push('🚀 نمو سعر '+cg.toFixed(0)+'٪ سنوي 3 سنين');
  return notes.filter(Boolean).slice(0,4);
}
function pickLabel(s, total){
  if (total>=72) return {t:'🟢 تجميع — أقوى خيار', c:'good'};
  if (total>=60) return {t:'🔵 احتفظ — كويس بس مش مغري', c:''};
  if (total>=45) return {t:'🟡 متابعة — راقبه', c:'warn'};
  return {t:'🔴 تجنّب — ضعيف دلوقتي', c:'bad'};
}

/* 🔎 البحث — كود أو اسم عربي (مرن: تشكيل، همزة، تاء مربوطة) */
function pickNorm(t){
  return String(t||'').toLowerCase()
  .replace(/[\u064B-\u0652\u0670\u0640]/g,'')
  .replace(/[\u0622\u0623\u0625\u0671]/g,'\u0627')
  .replace(/\u0649/g,'\u064A').replace(/\u0624/g,'\u0648').replace(/\u0626/g,'\u064A')
  .replace(/\u0629/g,'\u0647')
  .replace(/[^\u0600-\u06FFa-z0-9]/g,'');
}
function pickSearch(q){
  const db = OS_DB.filter(x=>x.price>0);
  const n = pickNorm(q);
  if (!n) return db.sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,8);
  const hit = [];
  const start = Math.max(8, Math.min(CMP_MAX + 2, PICK.length + 7));
  for (const x of PICK){ const i=db.findIndex(y=>y.code===x); if(i>=0) hit.push(db.splice(i,1)[0]); }
  const rest = db.filter(s=>{
  if (pickNorm(s.code).indexOf(n)>=0) return true;
  if (pickNorm(s.name).indexOf(n)>=0) return true;
  if (pickNorm(s.nameAr||'').indexOf(n)>=0) return true;
  if (pickNorm(s.sector).indexOf(n)>=0) return true;
  return false;
  }).sort((a,b)=>(b.score||0)-(a.score||0));
  return hit.concat(rest).slice(0, start);
}

/* ➕ إضافة — بتجمّد نسخة البيانات وقت الإضافة */
/* ⌨️ Enter يضيف أول نتيجة — عشان السلسلة تبقى سريعة */
function pickEnter(ev){
  /* Enter من الكيبورد · أو ضغط ➕ (الكليك مافيش key) */
  if (ev && ev.key && ev.key !== 'Enter') return;
  if (ev && ev.preventDefault) ev.preventDefault();
  const inp = document.getElementById('pickQ');
  const q = (inp ? inp.value : '').trim();
  /* ⚡ نفس ترتيب الاقتراحات المعروضة — اللي تشوفه هو اللي بيتضاف */
  let code = null;
  if (q){
  const r = pickRank(q);
  if (r.length) code = r[0].code;
  }
  if (!code){
  const first = document.querySelector('#pickHintBar .ph-c b');
  if (first) code = first.textContent.trim();
  }
  if (code) pickAdd(code);
}
/* ➕ على الكارت → يضيف ويرجّعلك للسيرش فوراً (سلسلة) */
function pickAdd(code, keepFocus){
  code = (code||'').toUpperCase().trim();
  if (!code) return;
  if (PICK.length >= PICK_MAX){ alert('الحد الأقصى '+PICK_MAX+' أسهم — شيل واحد الأول'); return; }
  const s = OS_DB.find(x=>x.code===code);
  if (!s){ alert('السهم '+code+' مش موجود'); return; }
  const inp = document.getElementById('pickQ');
  if (PICK.indexOf(code) < 0){
  PICK.push(code);
  PICK_DATA[code] = Object.assign({}, s);  /* 🔒 نسخة ثابتة */
  PICK_TIME[code] = new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  const _c = document.getElementById('pickCount'); if (_c) _c.textContent = PICK.length+'/'+PICK_MAX;
  try { localStorage.setItem('octa_pick_v1', JSON.stringify({c:PICK, t:PICK_TIME})); } catch(e){}
  }
  pickRenderList(inp ? inp.value : '');
  pickHints();
  pickRenderCards();
  /* 🔗 رجّع التركيز وفضّي السيرش — جاهز للي بعده */
  const inp2 = document.getElementById('pickQ');
  if (inp2){
  if (keepFocus !== false){ inp2.value = ''; pickRenderList(''); pickHints(); }
  inp2.focus();
  try { inp2.setSelectionRange(inp2.value.length, inp2.value.length); } catch(e){}
  }
}
function pickRemove(code){
  const s = PICK_DATA[code];
  if (!confirm('تشيل '+code+(s&&s.name?(' — '+s.name):'')+' من المقارنة؟')) return;
  PICK = PICK.filter(x=>x!==code);
  delete PICK_DATA[code]; delete PICK_TIME[code];
  try { localStorage.setItem('octa_pick_v1', JSON.stringify({c:PICK, t:PICK_TIME})); } catch(e){}
  pickRenderList('');
  pickRenderCards();
  const inp = document.getElementById('pickQ');
  if (inp){ inp.focus(); try{ inp.setSelectionRange(inp.value.length, inp.value.length); }catch(e){} }
}
function pickClear(){
  PICK = []; PICK_DATA = {};
  try{ localStorage.removeItem('octa_pick_v1'); }catch(e){}
  const inp = document.getElementById('pickQ'); if (inp) inp.value = '';
  pickRenderList(''); pickHints(); pickRenderCards();
}

/* 🎯 التحليل النهائي للمجموعة */
function pickSummary(){
  const list = PICK.map(c=>PICK_DATA[c]).filter(Boolean);
  if (!list.length) return null;
  const n = v => (typeof v==='number' && isFinite(v)) ? v : null;
  const med = arr => { const a=arr.filter(v=>v!=null).sort((x,y)=>x-y);
  if(!a.length) return null; const m=a.length>>1; return a.length%2?a[m]:(a[m-1]+a[m])/2; };
  const avg  = arr => { const a=arr.filter(v=>v!=null); return a.length?a.reduce((x,y)=>x+y,0)/a.length:null; };
  const scs  = list.map(x=>pickScore(x).total);
  const strongest = list.slice().sort((a,b)=>pickScore(b).total-pickScore(a).total)[0];
  const safest  = list.filter(x=>n(x.mdd)!=null).sort((a,b)=>a.mdd-b.mdd)[0];
  const cheapest  = list.filter(x=>n(x.pe)>0).sort((a,b)=>a.pe-b.pe)[0];
  const momentum  = list.filter(x=>n(x.rsi)!=null&&x.rsi<35).sort((a,b)=>a.rsi-b.rsi)[0];
  const topPct  = Math.max.apply(null, scs.concat([0]));
  const avgPct  = avg(scs) || 0;
  const best  = list.slice().sort((a,b)=>pickScore(b).total-pickScore(a).total)[0];
  /* ⚖️ توازن الصنف — مش رمي كل بيضك في سلة واحدة */
  /* 🏆 كام مؤشر كل سهم فايز فيه — جوّه المجموعة */
  const KEYS = ['score','roe','pe','mdd','vol1y'];
  const DOWN = { pe:true, mdd:true, vol1y:true };
  const winsOf = {};
  list.forEach(function(s){ winsOf[s.code]=[]; });
  KEYS.forEach(function(k){
  const pairs = list.map(function(s){ return {c:s.code, v:n(s[k])}; }).filter(p=>p.v!=null);
  if (pairs.length<2) return;
  const lo=Math.min.apply(null,pairs.map(p=>p.v)), hi=Math.max.apply(null,pairs.map(p=>p.v));
  if (hi===lo) return;
  let w=pairs[0];
  pairs.forEach(function(p){
  const better = DOWN[k] ? (p.v < w.v) : (p.v > w.v);
  if (better) w=p;
  });
  if (winsOf[w.c]) winsOf[w.c].push(k);
  });
  const alloc = {};
  list.forEach(function(s){
  const wins = winsOf[s.code]||[];
  let share = 20 + Math.min(30, wins.length*8);
  if (pickScore(s).total===topPct) share += 8;
  const LAB = { score:'نتيجة', roe:'ROE', pe:'P/E', mdd:'أمان', vol1y:'هدوء' };
  alloc[s.code] = { share: Math.round(share), wins: wins.map(k=>LAB[k]) };
  });
  const sum = Object.keys(alloc).reduce((a,k)=>a+alloc[k].share,0) || 1;
  Object.keys(alloc).forEach(k=>alloc[k].share = Math.round(alloc[k].share/sum*100));
  const rng = pickSummaryText({scs:scs,avgPct:avgPct,best:best,strongest:strongest,
  safest:safest, cheapest:cheapest, momentum:momentum, alloc:alloc});
  return { list:list, scs:scs, avgPct:Math.round(avgPct), best:best, strongest:strongest,
  safest:safest, cheapest:cheapest, momentum:momentum, alloc:alloc, rng:rng };
}
function pickSummaryText(x){
  const t = [];
  t.push('📊 متوسط تقييم المجموعة <b>'+x.avgPct+'%</b>'+(x.avgPct>=65?' — قوية':x.avgPct>=50?'— متوسطة':'— ضعيفة'));
  if (x.strongest) t.push('🐙 <b>'+x.strongest.code+'</b> الأقوى ('+Math.max.apply(null,x.scs)+'%)');
  if (x.safest)  t.push('🛡️ <b>'+x.safest.code+'</b> الأقل مخاطرة');
  if (x.cheapest)  t.push('💎 <b>'+x.cheapest.code+'</b> الأرخص (P/E)');
  if (x.momentum)  t.push('⚡ <b>'+x.momentum.code+'</b> فيه فرصة RSI');
  const a = Object.keys(x.alloc).map(k=>k+' '+x.alloc[k].share+'%').join(' · ');
  t.push('⚖️ توزيع مقترح (مش توصية): '+a);
  return t;
}

/* ═══ الرسم ═══ */
/* 🏷️ قائمة الاقتراحات — منفصلة عن الـinput عشان مايفقدش التركيز */
let PICK_QUERY = '';
function pickRenderList(q){
  PICK_QUERY = q||'';
  const host = document.getElementById('pickSuggest'); if (!host) return;
  /* الاقتراحات مش بتظهر — الإضافة بزر ➕ أو Enter فقط */
  const res = pickSearch(PICK_QUERY);
  const cnt = document.getElementById('pickCount'); if (cnt) cnt.textContent = PICK.length+'/'+PICK_MAX;
  if (!res.length){ host.innerHTML = '<div class="pick-none">⛔ مفيش نتائج — جرّب كود أو جزء من الاسم</div>'; pickSyncPlus(); return; }
  pickSyncPlus();
  host.innerHTML = res.map(function(s){
  const inP = PICK.indexOf(s.code)>=0;
  const col = inP ? pickColor(PICK.indexOf(s.code)) : '#6b7d8f';
  return '<button class="pick-sg'+(inP?' on':'')+'" style="--slot:'+col+'" ' +
  'data-code="'+s.code+'" title="'+escPick(s.name||'')+'">' +
  '<b>'+s.code+'</b>' +
  '<span class="pick-sg-t"><span>'+escPick((s.name||'').slice(0,32))+'</span>' +
  '<em>'+(s.score!=null?Math.round(s.score)+' من 100':'—')+'</em></span>' +
  '<i class="pick-add"'+(inP?' done':'')+'" onclick="event.stopPropagation();pickAdd(\''+s.code+'\')">'+
  (inP?'✓':'+')+'</i></button>';
  }).join('');
}
/* 🔎 الكتابة — بتحدّث الاقتراحات بس، من غير ما تلمس الـinput */
function pickSearchLive(q){ pickRenderList(q); pickHints(); }
/* ➕ يتوهّج لو فيه نتيجة، ويضلم لو مفيش */
function pickSyncPlus(){
  const btn = document.getElementById('pickPlus'); if (!btn) return;
  const inp = document.getElementById('pickQ');
  const q  = (inp ? inp.value : '').trim();
  const first = document.querySelector('#pickSuggest .pick-sg');
  const ok = first || (q && OS_DB.some(function(x){ return pickNorm(x.code).indexOf(pickNorm(q))>=0; }));
  btn.classList.toggle('ready', !!ok);
  btn.disabled = !ok;
}

function pickRender(){
  const box = document.getElementById('pickBox');
  if (box && !box.dataset.ready){
  box.dataset.ready = '1';
  box.innerHTML =
  '<div class="pick-inputrow">' +
  '<span class="pick-ico">🔎</span>' +
  '<input id="pickQ" type="search" enterkeyhint="done" autocomplete="off" ' +
  'oninput="pickSearchLive(this.value)" onkeydown="pickEnter(event)" ' +
  'placeholder="اكتب الكود أو الاسم — مثل COMI أو التجاري" />' +
  '<button class="pick-auto" id="pickAutoBtn" onclick="pickAuto()" title="اقتراح 5 أسهم بتوصية محرك OCTA">⚡</button>' +
  '<button class="pick-clear" id="pickClearBtn" onclick="pickClear()" title="صفّر الكل">🧹</button>' +
  '<span class="pick-count" id="pickCount">0/' + PICK_MAX + '</span>' +
  '<button class="pick-plus" id="pickPlus" onclick="pickEnter(event)" title="ضيف السهم">+</button>' +
  '</div>' +
  '<div class="pick-hintbar" id="pickHintBar" style="display:none"></div>' +
  '<div id="pickCritBar"></div>';
  pickRenderList('');
  }
  pickRenderAbout();
  pickRenderCards();
  const cb = document.querySelector('.pick-crit-btn');
  if (cb) cb.classList.toggle('on', PICK_ABOUT);
}

/* 🧮 معايير OCTA — قابلة للشرح للمستخدم
   ⛔ مرجع واحد بس: pickScore() فوق بيقرأ نفس المصفوفة دي،
      فاللي المستخدم بيقراه في الصندوق هو اللي اتحسب فعلاً. */
const PICK_AXES = [
  { k:'score', i:'📊', t:'نقطة OCTA', w:30,
    d:'الدرجة النهائية من المحرك (0-100) — أساس الترتيب' },
  { k:'val',   i:'💎', t:'التقييم', w:20,
    d:'P/E بأشرطة: أقل من 6 ممتاز · 10-15 معقول · فوق 30 غالي' },
  { k:'rsi',   i:'⚡', t:'الزخم (RSI)', w:20,
    d:'30-70 المنطقة الآمنة · تحت 32 فرصة · فوق 70 خطر' },
  { k:'liq',   i:'📈', t:'السيولة', w:15,
    d:'حجم التداول اليومي — السهم اللي بيتداول كتير أسهل يتباع' },
  { k:'dy',    i:'💰', t:'عائد التوزيع', w:15,
    d:'التوزيع ÷ السعر — كل ما زاد، أحسن للمستثمر' },
];
function escPick(t){
  return String(t==null?'':t).replace(/[<>&]/g, function(c){
  return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]; });
}
let PICK_ABOUT = false;

/* 📂 كرت المعايير — يظهر فوق الجدول ويشرح الأوزان والمؤشرات */
function pickRenderAbout(){
  const host = document.getElementById('pickCritBar'); if (!host) return;
  if (!PICK_ABOUT){ host.innerHTML = ''; return; }
  host.innerHTML = pickAbout();
}
function pickToggleAboutBox(){
  PICK_ABOUT = !PICK_ABOUT;
  pickRenderAbout();
  const btn = document.querySelector('.pick-crit-btn');
  if (btn) btn.classList.toggle('on', PICK_ABOUT);
}
function pickToggleAbout(){
  PICK_ABOUT = !PICK_ABOUT;
  const b = document.getElementById('pickAboutB');
  if (b){ b.style.display = PICK_ABOUT ? 'block' : 'none'; }
  const i = document.querySelector('.pick-about-h i');
  if (i) i.textContent = PICK_ABOUT ? '−' : '✕';
}
function pickAbout(){
  /* الأوزان دي نفس اللي في pickScore فوق بالحرف — مرجع واحد، مفيش نسختين */
  const axes = (typeof PICK_AXES !== 'undefined' && PICK_AXES.length) ? PICK_AXES : [];
  return '<div class="pick-about">' +
  '<button class="pick-about-h" onclick="pickToggleAbout()">' +
  '<span>❓ إزاي OCTA بيختار الأعلى؟</span>' +
  '<i class="pick-about-x" onclick="event.stopPropagation();pickToggleAbout()" title="اقفل">✕</i>' +
  '</button>' +
  '<div class="pick-about-b" id="pickAboutB" style="display:'+(PICK_ABOUT?'block':'none')+'">' +
  '<div class="pick-about-n">الأوزان (المجموع <span class="flt-ltr">100%</span>): ' +
  axes.map(a=>a.w+'%').join(' + ') + '</div>' +
  axes.map(a=>{ const d=DESC[a.k]||{i:'•',t:a.t,d:''};
    return '<div class="pick-about-i"><span class="pa-i">'+d.i+'</span>' +
    '<div><b>'+d.t+' — '+a.w+'%</b><small>'+d.d+'</small></div></div>'; }).join('') +
  '<div class="pick-about-f">📌 الترتيب بيتحسب وقت الإضافة — لو السوق اتغيّر، أنت شايف التقييم وقت ما اخترت.</div>' +
  '<div class="pick-about-f">⚠️ لو محور ناقص في السهم ده: بيتشال من الحساب، والباقي بيتقسم على مجموع أوزان المتاح بس — ما بنحطّش له رقم وسط.</div>' +
  '<div class="pick-about-f">ℹ️ عمود «نمو السعر 3 سنين» = نمو **سعر السهم** المركّب على 3 سنين. مش نمو الشركة (مفيش رقم للفرق ده في البيانات الحالية).</div>' +
  '</div></div>';
}
function pickRenderCards(){
  const out = document.getElementById('pickOut'); if (!out) return;
  if (!PICK.length){
  out.innerHTML = '<div class="pick-empty">⭐ اكتب الكود أو اسم الشركة فوق واضغط ➕<br>' +
  '<span class="pick-empty-sub">لحد '+PICK_MAX+' أسهم — الترتيب تلقائي حسب تحليل OCTA</span>' +
  '</div>';
  return;
  }
  const S = pickSummary();
  out.innerHTML = (PICK_ABOUT ? pickAbout() : '') + ptRenderFilters() + ptRenderTable() +
  '<div class="cmp-sec-h">🎯 الخلاصة — إيه اللي نعمله؟</div>' +
  (S ? ('<div class="pick-sum"><div class="pick-sum-grid">' +
  (S.strongest?'<div class="psg best" onclick="openStock(\''+S.strongest.code+'\')"><span>🐙 الأقوى</span><b>'+S.strongest.code+'</b><em>'+escPick(S.strongest.name||'')+'</em></div>':'') +
  (S.safest?  '<div class="psg" onclick="openStock(\''+S.safest.code+'\')"><span>🛡️ الأقل مخاطرة</span><b>'+S.safest.code+'</b><em>هبوط '+(S.safest.mdd!=null?Number(S.safest.mdd).toFixed(0)+'%':'—')+'</em></div>':'') +
  (S.cheapest? '<div class="psg" onclick="openStock(\''+S.cheapest.code+'\')"><span>💎 الأرخص</span><b>'+S.cheapest.code+'</b><em>P/E '+(S.cheapest.pe!=null?Number(S.cheapest.pe).toFixed(1):'—')+'</em></div>':'') +
  (S.momentum? '<div class="psg" onclick="openStock(\''+S.momentum.code+'\')"><span>⚡ فرصة</span><b>'+S.momentum.code+'</b><em>RSI '+(S.momentum.rsi!=null?Number(S.momentum.rsi).toFixed(0):'—')+'</em></div>':'') +
  '</div><div class="pick-alloc-h">⚖️ توزيع مقترح (مش توصية استثمارية)</div><div class="pick-alloc">' +
  Object.keys(S.alloc).map(function(k){ const a2=S.alloc[k];
  return '<div class="pa" style="--slot:'+pickColor(PICK.indexOf(k))+'"><span>'+k+'</span><b>'+a2.share+'%</b><i style="width:'+a2.share+'%"></i>'+(a2.wins.length?'<em>'+a2.wins.join(' · ')+'</em>':'')+'</div>'; }).join('') +
  '</div><div class="pick-sum-n">ⓘ حسابي بحت — راجع كارت القرار لكل سهم قبل ما تقرر.</div></div>') : '');
}

function pickInit(){
  try{
  const raw = JSON.parse(localStorage.getItem('octa_pick_v1')||'null');
  if (raw && raw.c && raw.c.length){
  const db = OS_DB;
  raw.c.forEach(function(c){ if (db.some(x=>x.code===c)){
  PICK.push(c); PICK_DATA[c]=Object.assign({}, db.find(x=>x.code===c)); PICK_TIME[c]=(raw.t||{})[c]||''; } });
  }
  }catch(e){}
  pickRender();
}

/* ---- جدول المرشحين ---- */
/* ══════════════════════════════════════════════════════════════
  ⭐ جدول المرشحين — بديل الكروت
  ترتيب تلقائي حسب تحليل OCTA + فلاتر + أفق أفق
  ══════════════════════════════════════════════════════════════ */
let PICK_SORT = 'pct';
let PICK_ROW  = false;  /* تبسيط الصف: وسيط كل عمود */
let PICK_ONLY = 'all';  /* فلتر صفّي */

/* ⭐ أعمدة جدول المرشحين
   ⚠ كل عمود لازم يعرف وحدته. عمود «نمو» كان بيطبع rg والإيراد بالجنيه
      كأنه نسبة ⇒ 4731916011٪. دلوقتي cagr3y = نمو **السعر** المركّب على
      3 سنين، والتسمية بتقول «نمو السعر 3 سنين» صراحةً. */
const PT_COLS = [
  { k:'idx',  t:'#',  cls:'pt-i',  s:false },
  { k:'code', t:'الرمز',  cls:'pt-code' },
  { k:'name', t:'الشركة',  cls:'pt-name' },
  { k:'price',t:'السعر',  cls:'pt-num' },
  { k:'chg',  t:'التغير',  cls:'pt-num', unit:'٪' },
  { k:'pct',  t:'التقييم',  cls:'pt-pct', isScore:true,
    tip:'درجة من 100 تجمع 5 محاور بأوزانها: نقطة OCTA 30٪ · التقييم (P/E) 20٪ · الزخم (RSI) 20٪ · السيولة 15٪ · عائد التوزيع 15٪. لو محور ناقص بيتشال والباقي بيتقسم على أوزان المتاح.' },
  { k:'pe',  t:'P/E',  cls:'pt-num',
    tip:'مضاعف الربحية — كام سنة عشان ترجع استثمارك. أقل = أرخص. مفيش علامة نسبة لأن ده مضاعف مش نسبة.' },
  { k:'roe',  t:'ROE',  cls:'pt-num', unit:'٪',
    tip:'العائد على حقوق الملكية — نسبة مئوية. سالب معناها الشركة خسرانة.' },
  { k:'rsi',  t:'RSI',  cls:'pt-num',
    tip:'مؤشر الزخم من 0 لـ100. تحت 32 = تشبع بيعي · فوق 70 = تشبع شرائي.' },
  { k:'vol',  t:'التذبذب',  cls:'pt-num', unit:'٪',
    tip:'تقلب السعر السنوي. وسط السوق المصري حوالي 44٪.' },
  { k:'mdd',  t:'أقصى هبوط', cls:'pt-num', unit:'٪',
    tip:'أكبر نزول من قمته في التاريخ. الرقم ده مش بيتكرر — أصعب حاجة في السهم.' },
  { k:'sh',  t:'شارب',  cls:'pt-num',
    tip:'العائد مقسوم على المخاطرة. فوق 1.5 = عائد كويس مقابل مخاطرة معقولة.' },
  { k:'cg',  t:'نمو السعر 3 سنين',  cls:'pt-num', unit:'٪',
    tip:'نمو سعر السهم المركّب على 3 سنين = (السعر اليوم ÷ سعر 3 سنين قبلها) مرفوع لـ(1÷3) ناقص 1. ده نمو السعر مش نمو الشركة — بيانات نمو الإيراد السنوي مش موجودة في السجل الحالي.' },
  { k:'dy',  t:'عائد',  cls:'pt-num', unit:'٪',
    tip:'التوزيعات ÷ السعر. عائد نقدي فعلي مش رقم محاسبي.' },
  { k:'dec', t:'قرار OCTA',cls:'pt-dec' },
  { k:'act',  t:'',  cls:'pt-act' },
];

function ptRow(s){
  const n = v => (typeof v==='number' && isFinite(v)) ? v : null;
  const sc = pickScore(s);
  return {
  s:s, code:s.code, name:s.name||'', sector:s.sector||'—',
  price:n(s.price), chg:n(s.change), pct:sc.total,
  pe:n(s.pe), roe:n(s.roe), rsi:n(s.rsi), vol:n(s.vol1y),
  /* 🔴 rg كان = الإيراد بالجنيه (4,731,916,011) واتطبع بـ ٪ ⇒ 4731916011٪.
     cg = cagr3y = نمو السعر المركّب 3 سنين — نسبة حقيقية. */
  mdd:n(s.mdd), sh:n(s.sharpe), cg:n(s.cagr3y), dy:n(s.yield),
  /* أرقام الفلاتر الجديدة — من نفس سجل السهم */
  de:n(s.de), cr:n(s.cr), pb:n(s.pb), relvol:n(s.relVolume!=null?s.relVolume:s.relvol),
  /* 📌 المحاور الناقصة الخمسة: q جودة · v قيمة · m زخم · sf أمان · lq سيولة
     ⛔ r.missing موجود بس مش مضمون إنه كامل — لو رجع ناقص بنكمله من r.partial
        (اللي فيه أسماء المحاور **المتاحة**) عشان مابقاش الفلتر بيمرّ على كل حاجة. */
  miss: (function(){
    const A = ['q','v','m','sf','lq'];
    const have = new Set(Array.isArray(s.partial) ? s.partial : []);
    (Array.isArray(s.missingSections) ? s.missingSections : []).forEach(x=>have.delete(x));
    return A.filter(a=>!have.has(a));
  })(),
  dec:s.decision||'—', time:PICK_TIME[s.code]||'', sc:sc
  };
}
/* ══════════════════════════════════════════════════════════════
  🧮 فلاتر الجدول — كل فلتر مربوط بمحور وأوزانه في المحرك
  ══════════════════════════════════════════════════════════════
  الأوزان من /workspace/octa-prices/octa_score.py ← AXIS_WEIGHTS v1.1:
    المخاطرة 24٪ · الأساسي 22٪ · الفني 18٪ · السيولة 18٪
  وجوه المخاطرة من نفس الملف (RW): تقلب 26٪ · بيتا 22٪ · هبوط 22٪
                                     دين 18٪ · شارب 12٪
  ⛔ مفيش فلتر مخترع هنا: كل شرط رقمه مكتوب في الكود نفسه.
  ⛔ لو السهم مالوش الرقم ده بيتشال — مش بنعتبره عدّى. */
const PT_SEC = (()=>{   /* وسيط P/E لكل قطاع — نفس build_sector_stats في المحرك */
  const by = {};
  (typeof OS_DB!=='undefined' ? OS_DB : []).forEach(s=>{
    if (!(s.pe>0)) return;
    const k = s.sector||'أخرى'; (by[k]=by[k]||[]).push(s.pe);
  });
  const out = {};
  Object.keys(by).forEach(k=>{ const a=by[k].sort((x,y)=>x-y); out[k]=a[a.length>>1]; });
  return out;
})();
const PT_SEC_MED = (sec) => PT_SEC[sec||'أخرى'];

/* 🎚️ حدود الفلاتر — كل رقم وراه سبب مكتوب للمستخدم */
const PT_FLT = {
  best  : { t:'🟢 تقييم ≥60', why:'نقطة OCTA فوق 60 من 100.' },
  chance: { t:'⚡ فرصة', why:'RSI تحت 35 — السوق باع السهم بالقوة.' },
  safe  : { t:'🛡️ آمن', why:'تقلب سنوي أقل من 32٪ وأقصى هبوط أقل من 55٪ — دول 48٪ من وزن محور المخاطرة.' },
  risk  : { t:'⚠️ خطر', why:'أقصى هبوط فوق 60٪ — السهم نزل 60٪+ من قمته قبل كده.' },

  debt  : { t:'🏦 أمان مالي', why:'نسبة الدين ≤ 50٪ — دين 18٪ من وزن محور المخاطرة، وهو 24٪ من الدرجة كلها. 50٪ يعني الدين نص حجمه (نفس تسمية «دين/أصول» في صفحة الفلاتر).',
            f:r => r.de!=null && r.de<=0.50 },
  value : { t:'💎 أرخص من قطاعه', why:'P/E عنده ≤ وسيط P/E في نفس قطاعه. «رخيص» معناها رخيص مقارنة بالقطاع مش رقم مطلق — نفس قاعدة build_sector_stats في المحرك.',
            f:r => r.pe!=null && r.pe>0 && PT_SEC_MED(r.sector)!=null && r.pe<=PT_SEC_MED(r.sector) },
  income: { t:'💰 توزيعات ≥3٪', why:'عائد التوزيع ≥ 3٪ — نفس الرقم المكتوب في المحرك حرفياً (STRATEGIES.income.min_div_yield = 3.0).',
            f:r => r.dy!=null && r.dy>=3 },
  liq   : { t:'💧 سيولة تداول', why:'حجم اليوم ÷ متوسط 30 يوم ≥ 0.8. محور السيولة لوحده 18٪ من الدرجة — والسهم اللي مش بيتداول مش هتقدر تبيعه وقت ما تحب.',
            f:r => r.relvol!=null && r.relvol>=0.8 },
  cover : { t:'✅ كل المحاور', why:'المحاور الخمسة كلها متاحة عند السهم ده. المحرك بيستبعد المحور الناقص ويقسّم على المتاح — فالسهم ده تقييمه اتبنى على البيانات كلها، مش على نصها.',
            f:r => r.miss.length===0 },
};

function ptRows(){
  const all = PICK.map(c=>PICK_DATA[c]).filter(Boolean).map(ptRow);
  let rows = all.slice();
  const D = PT_FLT[PICK_ONLY];
  if (D && D.f) rows = rows.filter(D.f);
  else {
    if (PICK_ONLY==='best')  rows = rows.filter(r=>r.pct>=60);
    if (PICK_ONLY==='chance')rows = rows.filter(r=>r.rsi!=null && r.rsi<35);
    if (PICK_ONLY==='risk')  rows = rows.filter(r=>r.mdd!=null && r.mdd>60);
    if (PICK_ONLY==='safe')  rows = rows.filter(r=>r.vol!=null && r.vol<32 && r.mdd!=null && r.mdd<55);
  }
  const S = PICK_SORT;
  rows.sort((a,b)=>{
  const g = k => (a[k]==null?1e12:a[k]);
  if (S==='pct')  return (b.pct==null?1:0)-(a.pct==null?1:0) || ((b.pct||0)-(a.pct||0));
  if (S==='chg')  return g('chg')===1e12?-1:(b.chg-a.chg);
  if (S==='pe')  return (a.pe?a.pe:1e9)-(b.pe?b.pe:1e9);
  if (S==='roe')  return g('roe')===1e12?-1:(b.roe-a.roe);
  if (S==='rsi')  return (a.rsi!=null?a.rsi:1e9)-(b.rsi!=null?b.rsi:1e9);
  if (S==='vol')  return (a.vol!=null?a.vol:1e9)-(b.vol!=null?b.vol:1e9);
  if (S==='mdd')  return (a.mdd!=null?a.mdd:1e9)-(b.mdd!=null?b.mdd:1e9);
  if (S==='sh')  return g('sh')===1e12?-1:(b.sh-a.sh);
  if (S==='cg')  return g('cg')===1e12?-1:(b.cg-a.cg);
  if (S==='dy')  return g('dy')===1e12?-1:(b.dy-a.dy);
  if (S==='name')  return String(a.name).localeCompare(String(b.name),'ar');
  return (b.pct==null?1:0)-(a.pct==null?1:0);
  });
  return rows;
}
function ptMedian(rows, k){
  const a = rows.map(r=>r[k]).filter(v=>v!=null).sort((x,y)=>x-y);
  if(!a.length) return null;
  const m=a.length>>1;
  return a.length%2 ? a[m] : (a[m-1]+a[m])/2;
}
const ptF = (v,d) => v==null?'—':(typeof v==='number'?v.toFixed(d==null?1:d):v);
/* 🔴 كان الكود بيعمل  ptF(v)+'%'  ⇒ الرقم الناقص بيطلع «—%».
   علامة النسبة بتتحط على رقم موجود بس. */
const ptU = (v,d,u) => v==null?'—':ptF(v,d)+u;

function ptRenderTable(){
  const rows = ptRows();
  if (!rows.length) return '<div class="pt-empty">مفيش أسهم في الفلتر ده</div>';

  /* صف الوسيط (المحايد) */
  const med = {};
  ['price','chg','pct','pe','roe','rsi','vol','mdd','sh','cg','dy'].forEach(k=> med[k]=ptMedian(rows,k));

  /* 🏆 الفائز في كل عمود */
  const best = {};
  ['price','chg','pct','pe','roe','rsi','vol','mdd','sh','cg','dy'].forEach(k=>{
  const vals = rows.map(r=>r[k]).filter(v=>v!=null);
  if (vals.length<2) return;
  let bv=null, bc=null;
  rows.forEach(r=>{
  const v=r[k]; if(v==null) return;
  let better;
  if (k==='price'||k==='pe'||k==='vol'||k==='mdd') better = bv==null?true:(v<bv);
  else if (k==='rsi') better = bv==null?true:(Math.abs(v-50)<Math.abs(bv-50));
  else better = bv==null?true:(v>bv);
  if(better){ bv=v; bc=r.code; }
  });
  best[k]=bc;
  });

  let h = '<div class="pt-wrap"><table class="pt"><thead><tr>';
  PT_COLS.forEach(c=>{
  const sortable = c.k!=='idx' && c.k!=='act';
  const on = PICK_SORT===c.k;
  h += '<th class="'+c.cls+(sortable?' sort':'')+(on?' on':'')+'"'+
  (sortable?' onclick="PICK_SORT=\''+c.k+'\';pickRenderCards()"':'')+
  (c.tip?' title="'+c.tip.replace(/"/g,'&quot;')+'"':'')+'>'+
  (c.t||'✕')+(on?'<i>▾</i>':'')+'</th>';
  });
  h += '</tr></thead><tbody>';

  rows.forEach((r,i)=>{
  h += '<tr class="'+(i===0?'top':'')+'">' +
  '<td class="pt-i"><span style="--slot:'+pickColor(i)+'">'+(i===0?'🏆':i+1)+'</span></td>' +
  '<td class="pt-code"><span style="--slot:'+pickColor(i)+'">'+r.code+'</span></td>' +
  '<td class="pt-name">'+escPick(r.name)+'<small>'+escPick(r.sector)+'</small></td>' +
  '<td class="pt-num">'+ptF(r.price,2)+'</td>' +
  '<td class="pt-num '+(r.chg!=null&&r.chg>=0?'up':(r.chg!=null?'down':''))+'">'+ptU(r.chg,2,'٪')+'</td>' +
  /* --slot كان متعرّف على الشريط <i> بس، فـ .pt-pct b كان بيلاقي --slot فاضي
     والرقم بيرجع للوراثة ⇒ تباين 1.08:1 (رقم شبه مخفي). دلوقتي على الـtd. */
  '<td class="pt-pct'+(r.pct==null?' pt-na':'')+'" style="--slot:'+pickColor(i)+';--slotT:'+pickColorT(i)+'"'+
  ' title="'+(r.pct==null?'مفيش بيانات كافية — المحرك ما اقدرش يقيّم السهم ده':'')+'">'+
  '<span class="pt-bar"><i style="width:'+Math.max(0,Math.min(100,r.pct||0))+'%"></i></span>'+
  /* ⓘ لو أقل من 5 محاور اتاحت، نقول للمستخدم قد إيه اتبنى تقييمه من بيانات.
     ⚠ لازم الأقواس: من غيرها الـternary كان بيبتلع باقي الخلايا. */
  '<b>'+ptF(r.pct,0)+'</b>'+(r.sc && r.sc.have<5
     ? '<em class="pt-part" title="التقييم اتبنى على '+r.sc.have+' من 5 محاور — الباقي بيانات ناقصة">'+r.sc.have+'/5</em>' : '')+'</td>' +
  '<td class="pt-num'+(best.pe===r.code?' win':'')+'">'+ptF(r.pe,1)+'</td>' +
  '<td class="pt-num'+(best.roe===r.code?' win':'')+'">'+ptU(r.roe,0,'٪')+'</td>' +
  '<td class="pt-num'+(best.rsi===r.code?' win':'')+(r.rsi!=null&&r.rsi<32?' ok':(r.rsi!=null&&r.rsi>70?' bad':''))+'">'+ptF(r.rsi,0)+'</td>' +
  '<td class="pt-num'+(best.vol===r.code?' win':'')+'">'+ptU(r.vol,0,'٪')+'</td>' +
  '<td class="pt-num'+(best.mdd===r.code?' win':'')+(r.mdd!=null&&r.mdd>60?' bad':'')+'">'+ptU(r.mdd,0,'٪')+'</td>' +
  '<td class="pt-num'+(best.sh===r.code?' win':'')+'">'+ptF(r.sh,2)+'</td>' +
  '<td class="pt-num'+(best.cg===r.code?' win':'')+(r.cg!=null&&r.cg>150?' bad':'')+'" title="'+
  (r.cg==null?'مفيش تاريخ سعر 3 سنين لهذا السهم':(r.cg>150?'⚡ رقم طيران — نمو 3 سنين أعلى من 150٪، غالباً إعادة تسعير مرة واحدة':'نمو سعر السهم المركّب على 3 سنين'))+
  '">'+ptU(r.cg,0,'٪')+'</td>' +
  '<td class="pt-num'+(best.dy===r.code?' win':'')+'">'+ptU(r.dy,1,'٪')+'</td>' +
  '<td class="pt-dec">'+escPick(r.dec)+'</td>' +
  '<td class="pt-act">' +
  '<button class="pt-bell" data-bell="'+r.code+'" onclick="event.stopPropagation();watchEdit(\''+r.code+'\')" title="منبه سعر">🔕</button>' +
  '<button class="pt-open" onclick="event.stopPropagation();openStock(\''+r.code+'\')" title="افتح">📈</button>' +
  '<button class="pt-rm2" onclick="event.stopPropagation();pickRemove(\''+r.code+'\')" title="شيل">✕</button>' +
  '</td></tr>';
  });

  /* صف الوسيط — سطر محايد */
  if (PICK_ROW && rows.length>=2){
  h += '<tr class="pt-med"><td class="pt-i">—</td><td class="pt-code">الوسيط</td>' +
  '<td class="pt-name">قيمة المنتصف بين كل الأسهم<small>استخدمها كمرجع سريع</small></td>' +
  '<td class="pt-num">'+ptF(med.price,2)+'</td><td class="pt-num">'+ptU(med.chg,2,'٪')+'</td>' +
  '<td class="pt-pct"><b>'+ptF(med.pct,0)+'</b></td>' +
  '<td class="pt-num">'+ptF(med.pe,1)+'</td><td class="pt-num">'+ptU(med.roe,0,'٪')+'</td>' +
  '<td class="pt-num">'+ptF(med.rsi,0)+'</td><td class="pt-num">'+ptU(med.vol,0,'٪')+'</td>' +
  '<td class="pt-num">'+ptU(med.mdd,0,'٪')+'</td><td class="pt-num">'+ptF(med.sh,2)+'</td>' +
  '<td class="pt-num">'+ptU(med.cg,0,'٪')+'</td><td class="pt-num">'+ptU(med.dy,1,'٪')+'</td>' +
  '<td class="pt-dec">—</td><td class="pt-act"></td></tr>';
  }
  h += '</tbody></table></div>';
  return h;
}

function ptRenderFilters(){
  const all = PICK.map(c=>PICK_DATA[c]).filter(Boolean).map(ptRow);
  const cnt = k => {
    if (k==='all') return all.length;
    const D = PT_FLT[k]; if (!D) return 0;
    if (D.f) return all.filter(D.f).length;
    if (k==='best')  return all.filter(r=>r.pct>=60).length;
    if (k==='chance') return all.filter(r=>r.rsi!=null&&r.rsi<35).length;
    if (k==='risk')  return all.filter(r=>r.mdd!=null&&r.mdd>60).length;
    if (k==='safe')  return all.filter(r=>r.vol!=null&&r.vol<32&&r.mdd!=null&&r.mdd<55).length;
    return 0;
  };
  const mk=(id,lb,tip)=>'<button class="pt-f'+(PICK_ONLY===id?' on':'')+'"'+
    (tip?' title="'+String(tip).replace(/"/g,'&quot;')+'"':'')+
    ' onclick="PICK_ONLY=\'' + id + '\';pickRenderCards()">'+lb+' <b>'+cnt(id)+'</b></button>';
  const cur = PT_FLT[PICK_ONLY];
  return '<div class="pt-filters">' +
  mk('all','📋 الكل','كل الأسهم من غير فلتر') +
  '<span class="pt-sep"></span>' +
  mk('best',  PT_FLT.best.t,   PT_FLT.best.why) +
  mk('safe',  PT_FLT.safe.t,   PT_FLT.safe.why) +
  mk('risk',  PT_FLT.risk.t,   PT_FLT.risk.why) +
  mk('chance',PT_FLT.chance.t, PT_FLT.chance.why) +
  '<span class="pt-sep"></span>' +
  mk('debt',  PT_FLT.debt.t,   PT_FLT.debt.why) +
  mk('value', PT_FLT.value.t,  PT_FLT.value.why) +
  mk('income',PT_FLT.income.t, PT_FLT.income.why) +
  mk('liq',   PT_FLT.liq.t,    PT_FLT.liq.why) +
  mk('cover', PT_FLT.cover.t,  PT_FLT.cover.why) +
  '<span class="pt-sep"></span>' +
  '<button class="pt-f'+(PICK_ROW?' on':'')+'" onclick="PICK_ROW=!PICK_ROW;pickRenderCards()">📐 صف الوسيط</button>' +
  '<button class="pt-f pick-crit-btn'+(PICK_ABOUT?' on':'')+'" onclick="pickToggleAboutBox()">❓ معايير OCTA</button>' +
  '</div>' +
  (cur ? '<div class="pt-fwhy"><b>'+cur.t+'</b> — '+cur.why+'</div>' : '') +
  '<div class="pt-fwhy pt-fwhy-sub">أوزان محرك OCTA: مخاطرة 24٪ · أساسي 22٪ · فني 18٪ · سيولة 18٪ · أخبار 5٪ · معنويات 4٪ · محفظة 9٪.</div>';
}


/* ⚡ اقتراح 5 — من محرك Sugarينر نفسه
  تجميع/شراء = توصية قوية · بيتجدد مع كل تحميل فالتوصية بتتبع السوق */
let PICK_SUGGEST_LOADING = false;
async function pickAuto(){
  if (PICK_SUGGEST_LOADING) return;
  PICK_SUGGEST_LOADING = true;
  const btn = document.getElementById('pickAutoBtn');
  if (btn){ btn.disabled = true; btn.textContent = '⏳'; }
  let list = [];
  try {
  const r = await fetch(OCTA_API + '/api/rank?limit=10&decision='
  + encodeURIComponent('إشارة إيجابية') + '&_=' + Date.now())
  .then(x => x.ok ? x.json() : null).catch(() => null);
  if (r && r.results && r.results.length){
  list = r.results.slice(0, 5).map(function(x){
  const s = OS_DB.find(y => y.code === x.code);
  if (!s) return null;
  return Object.assign({}, s, {
  score: x.final_score || x.score || s.score,
  decision: x.decision || s.decision
  });
  }).filter(Boolean);
  }
  } catch(e){}
  /* fallback — أعلى نتيجة بتوصية شرائية */
  if (list.length < 3){
  const seen = {}; list.forEach(x => { seen[x.code] = 1; });
  OS_DB.filter(x => x.price > 0 && x.score > 0 && /تجميع|شراء/.test(x.decision || ''))
  .sort((a,b) => (b.score||0) - (a.score||0))
  .forEach(function(x){ if (list.length < 5 && !seen[x.code]){ list.push(x); seen[x.code] = 1; } });
  }
  if (!list.length){
  list = OS_DB.filter(x => x.price > 0 && x.score > 0)
  .sort((a,b) => (b.score||0) - (a.score||0)).slice(0, 5);
  }
  PICK = []; PICK_DATA = {};
  const now = new Date().toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
  list.forEach(function(x){ PICK.push(x.code); PICK_DATA[x.code] = Object.assign({}, x); PICK_TIME[x.code] = now; });
  try{ localStorage.setItem('octa_pick_v1', JSON.stringify({c:PICK, t:PICK_TIME})); }catch(e){}
  PICK_SUGGEST_LOADING = false;
  const inp = document.getElementById('pickQ'); if (inp) inp.value = '';
  pickRenderList('');
  pickRenderCards();
  if (btn){ btn.disabled = false; btn.textContent = '⚡'; }
}

/* ══════════════════════════════════════════════════════════════
  💡 الاقتراحات الذكية — أثناء الكتابة
  فكّرCrazy: لو ناسي الكود، أول حرف بيجيب اقتراحات
  أو لو فاكر أول كلمة من الاسم
  ══════════════════════════════════════════════════════════════ */
const PICK_HINTS = [
  { c:'HDBK',  k:'التعمير',  a:'بنك التعمير والإسكان' },
  { c:'ALEX',  k:'الإسكندرية',  a:'بنك الإسكندرية' },
  { c:'COMI',  k:'التجاري',  a:'البنك التجاري الدولي' },
  { c:'ETEL',  k:'المصرية للاتصالات', a:'المصرية للاتصالات' },
  { c:'SWDY',  k:'السويدي',  a:'السويدي إليكتريك' },
  { c:'TMGH',  k:'طلعت',  a:'طلعت مصطفى القابضة' },
  { c:'ORWE',  k:'النساجون',  a:'النساجون الشرقيون' },
  { c:'ABUK',  k:'ابوقير',  a:'أبو قير للأسمدة' },
  { c:'MFPC',  k:'مصر',  a:'مصر للنسج' },
  { c:'ESRS',  k:'إيسترن',  a:'إيسترن كومباني' },
  { c:'MICH',  k:'الكميويات',  a:'مصر للصناعات الكيماوية' },
  { c:'EGAL',  k:'الالومنيوم',  a:'مصر للألومنيوم' },
  { c:'HRHO',  k:'هيرميس',  a:'المجموعة المالية هيرميس' },
  { c:'CIEB',  k:'البنك التجاري',  a:'البنك التجاري المصري' },
];
let PICK_HINT_T = null;

/* 💡 شريط الاقتراحات — يظهر تحت السيرش وقت الكتابة */
function pickHints(){
  const box = document.getElementById('pickHintBar'); if (!box) return;
  const inp = document.getElementById('pickQ');
  const q = (inp ? inp.value : '').trim();
  const n = pickNorm(q);
  box.innerHTML = '';
  if (n.length < 1){ box.style.display = 'none'; return; }

  const hits = [];
  /* ① نفس ترتيب Enter بالظبط — أول كارت = أول نتيجة */
  const ranked = pickRank(q);
  if (ranked.length){
  const starts = ranked.filter(x => pickNorm(x.code).indexOf(n) === 0);
  const pool = starts.length ? starts : ranked;
  const exact = pool.filter(x => pickNorm(x.code) === n);
  const lbl = exact.length ? '✅ «'+q.toUpperCase()+'» بالظبط'
  : (starts.length ? '🔤 بيبدأ بـ «'+q+'»' : '🔎 فيه «'+q+'»');
  hits.push({ t: lbl, c: (exact.length ? exact : pool).slice(0, 6) });
  }

  /* ② ذكاء: لو المستخدم كتب كلمة من اسم مشهور */
  PICK_HINTS.forEach(function(h){
  const hn = pickNorm(h.k);
  if (n.length >= 2 && (hn.indexOf(n) >= 0 || n.indexOf(hn) >= 0))
  hits.push({ t:'💡 '+h.a, l:[h.c] });
  });

  if (!hits.length){ box.style.display = 'none'; return; }
  box.style.display = 'block';
  let html = '';
  hits.forEach(function(g){
  html += '<div class="ph-g"><span class="ph-t">'+g.t+'</span>';
  (g.c || g.l.map(c => OS_DB.find(x => x.code === c))).forEach(function(s){
  if (!s) return; const c = s.code;
  const inP = PICK.indexOf(c) >= 0;
  html += '<button class="ph-c'+(inP?' on':'')+'" onclick="pickAdd(\''+c+'\')">' +
  '<b>'+c+'</b><span>'+escPick((s.name||'').slice(0,22))+'</span>' +
  /* 🔴 الدرجة من 100 مش نسبة مئوية. «72%» غلط — الصح «72» مع /100 في العنوان. */
  '<em>'+(s.score!=null?Math.round(s.score):'—')+'</em></button>';
  });
  html += '</div>';
  });
  box.innerHTML = html;
}

/* ══════════════════════════════════════════════════════════════
  🎯 ترتيب موحّد — اللي تشوفه واللي Enter بيضيفه لازم نفس الحاجة
  pickRank(q) → [{code}, …] مرتّبة بالدقة
  ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
  🎯 ترتيب موحّد بالدرجة — اللي تشوفه واللي Enter بيضيفه واحد
  100 كود بالظبط · 90 الكود يبدأ · 80 الاسم يبدأ بالكلمة
  70 الكود جوه · 60 كلمة كاملة بالاسم · 50 الاسم يبدأ · 40 جوه اسم · 20 قطاع
  ══════════════════════════════════════════════════════════════ */
/* ⚠️ pickNorm بيشيل المسافات — لازم نقسّم النص الخام الأول */
function pickWords(t){
  return String(t||'').split(/\s+/).map(pickNorm).filter(Boolean);
}

function pickRank(q){
  const db = OS_DB.filter(x => x.price > 0);
  const n = pickNorm((q||'').trim());
  if (!n) return [];
  const scored = [];
  db.forEach(function(x){
  const code = pickNorm(x.code);
  const name = pickNorm(x.name);
  const ar  = pickNorm(x.nameAr || '');
  const sec  = pickNorm(x.sector);
  const allW = pickWords(x.name).concat(pickWords(x.nameAr || ''));
  let s = 0;
  if (code === n) s = 100;
  else if (code.indexOf(n) === 0) s = 90;
  else if (code.indexOf(n) >= 0) s = 70;
  else if (allW.indexOf(n) >= 0) s = (name.indexOf(n) === 0 || ar.indexOf(n) === 0) ? 80 : 60;
  else if (name.indexOf(n) === 0 || ar.indexOf(n) === 0) s = 50;
  else if (name.indexOf(n) >= 0 || ar.indexOf(n) >= 0) s = 40;
  else if (sec.indexOf(n) >= 0) s = 20;
  if (s <= 0) return;
  scored.push({ x:x, s:s, boost:(x.score||0)/1000 });
  });
  scored.sort(function(a,b){ return (b.s + b.boost) - (a.s + a.boost); });
  return scored.map(function(o){ return o.x; });
}
