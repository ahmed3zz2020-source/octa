/* ═══ OCTA · octa-core.js · 128KB ═══ */
/* ══════════ إعدادات الموقع ══════════ */

/* ============ OCTA v20 — Egyptian Stock Intelligence ============ */

const STOCKS = [
  { code:'COMI',name:'البنك التجاري الدولي',sector:'بنوك',price:137.20,change:0.44,pe:9.5,div:2.50,yield:1.83,vol:'32.5M' },
  { code:'TMGH',name:'طلعت مصطفى القابضة',sector:'عقار',price:102.50,change:0.62,pe:14.2,div:1.20,yield:1.18,vol:'18.2M' },
  { code:'SWDY',name:'السويدي إليكتريك',sector:'صناعة',price:91.80,change:-0.22,pe:11.8,div:1.50,yield:1.63,vol:'15.8M' },
  { code:'PHDC',name:'بالم هيلز للتعمير',sector:'عقار',price:14.95,change:2.05,pe:12.5,div:0.30,yield:2.05,vol:'12.4M' },
  { code:'ETEL',name:'المصرية للاتصالات',sector:'اتصالات',price:100.20,change:0.36,pe:7.8,div:2.00,yield:2.00,vol:'9.7M' },
  { code:'EMFD',name:'إعمار مصر للتنمية',sector:'عقار',price:11.85,change:1.28,pe:8.6,div:0.45,yield:3.85,vol:'8.5M' },
  { code:'ABUK',name:'أبو قير للأسمدة',sector:'صناعة',price:73.10,change:0.29,pe:6.2,div:3.50,yield:4.80,vol:'8.1M' },
  { code:'ADIB',name:'مصرف أبوظبي الإسلامي',sector:'بنوك',price:47.15,change:0.34,pe:8.9,div:1.50,yield:3.19,vol:'5.2M' },
  { code:'EFIH',name:'إي فاينانس',sector:'تكنولوجيا',price:22.40,change:1.13,pe:18.5,div:0.40,yield:1.79,vol:'7.1M' },
  { code:'FWRY',name:'فوري',sector:'تكنولوجيا',price:19.30,change:0.57,pe:22.4,div:0.20,yield:1.04,vol:'6.3M' },
  { code:'HRHO',name:'مجموعة أي إف جي القابضة',sector:'صناعة',price:8.50,change:0.59,pe:9.8,div:0.20,yield:2.38,vol:'4.2M' },
  { code:'ESRS',name:'إيسترن كومباني',sector:'صناعة',price:12.20,change:-0.81,pe:10.5,div:0.50,yield:4.06,vol:'3.8M' },
  { code:'JUFO',name:'جهينة للصناعات الغذائية',sector:'أغذية',price:8.30,change:1.22,pe:13.4,div:0.30,yield:3.66,vol:'2.5M' },
  { code:'MNHD',name:'مصر الجديدة للإسكان',sector:'عقار',price:5.20,change:1.96,pe:7.2,div:0.20,yield:3.92,vol:'3.1M' },
  { code:'AMOC',name:'الإسكندرية لمنتجات البترول',sector:'طاقة',price:9.05,change:1.69,pe:8.1,div:0.40,yield:4.50,vol:'5.4M' },
  { code:'SKPC',name:'سيدي كرير للبتروكيماويات',sector:'صناعة',price:12.65,change:1.20,pe:7.5,div:0.50,yield:4.00,vol:'4.7M' },
  { code:'CCAP',name:'القلعة القابضة',sector:'مالية',price:2.90,change:1.75,pe:6.8,div:0.10,yield:3.51,vol:'6.2M' }
];

const ENGINE_BARS = [
  { label:'🐙 التحليل الفني', value:91, color:'#16c79a, #4dabf7' },
  { label:'📊 الأساسي', value:88, color:'#16c79a, #4dabf7' },
  { label:'💧 السيولة', value:95, color:'#16c79a, #4dabf7' },
  { label:'📰 الأخبار', value:73, color:'#d4af37, #f97316' },
  { label:'🧭 المعنويات', value:90, color:'#16c79a, #4dabf7' },
  { label:'🛡️ المخاطر', value:92, color:'#16c79a, #4dabf7' },
  { label:'💼 المحفظة', value:80, color:'#d4af37, #f97316' },
  { label:'🎯 التوافق', value:87, color:'#16c79a, #4dabf7' }
];

const ARMS = [
  { id:1, num:'01', name:'التحليل الفني', desc:'اختراقات • ترند • RSI',
  title:'التحليل الفني', subtitle:'🐙 الذراع الأولى',
  what:'بيحلل حركة السعر على الشارت، بيدور على أنماط وإشارات بتفيد في توقيت الدخول والخروج.',
  watches:['خطوط الترند','الدعم والمقاومة','مؤشر القوة النسبية','المتوسطات المتحركة (20 و50 يوم)','أنماط الشموع اليابانية','حجم التداول'],
  example:'سهم طلعت مصطفى (TMGH) في يوليو 2026: اخترق مقاومة 100 جنيه بحجم تداول عالي، الترند صاعد → إشارة شراء قوية.' },
  { id:2, num:'02', name:'التحليل الأساسي', desc:'P/E • أرباح • نمو',
  title:'التحليل الأساسي', subtitle:'📊 الذراع الثانية',
  what:'بيشوف الشركة من جوه: شغالة كويس ولا لأ، أسهمها رخيصة ولا غالية.',
  watches:['P/E (مضاعف الربحية)','P/B (مضاعف القيمة الدفترية)','نمو الأرباح','هامش الربح','العائد على حقوق الملكية (ROE)','نسبة الدين'],
  example:'"السهم P/E = 9 (رخيص)، الأرباح نمت +<span class="flt-ltr">20%</span>، ROE = <span class="flt-ltr">18%</span> (ممتاز) → سهم استثماري قوي."' },
  { id:3, num:'03', name:'السيولة والأموال الذكية', desc:'حجم • مؤسسات',
  title:'السيولة والأموال الذكية', subtitle:'💧 الذراع الثالثة',
  what:'بيشوف مين اللي بيتحرك في السهم - صناديق كبيرة (Smart Money) ولا تجار صغار.',
  watches:['حجم التداول اليومي','الصفقات الكبيرة','حركة المؤسسات','نسبة التداول الحر','دخول وخروج كبار الملاك'],
  example:'لو الأموال الذكية بتشتري، السعر غالبًا هيروح. لو بتبيع، ابتعد عن السهم.' },
  { id:4, num:'04', name:'الأخبار والأحداث', desc:'نتائج • تقارير',
  title:'الأخبار والأحداث', subtitle:'📰 الذراع الرابعة',
  what:'بيجمع كل الأخبار عن السهم: نتائج، توزيعات، صفقات، تغييرات إدارية.',
  watches:['النتائج الفصلية','توزيعات الأرباح','تغييرات مجلس الإدارة','صفقات الاستحواذ','أخبار السوق','تقارير المحللين'],
  example:'"طلعت مصطفى أعلنت عن مشروع جديد بـ 50 مليار في الساحل → إيجابي على السهم."' },
  { id:5, num:'05', name:'الذكاء الاصطناعي', desc:'تحليل عميق',
  title:'الذكاء الاصطناعي', subtitle:'🤖 الذراع الخامسة',
  what:'بيستخدم نماذج تحليلية لتحليل كل البيانات بشكل أعمق، التعرف على أنماط معقدة.',
  watches:['تحليل الأخبار وفهم اللغة','التعرف على أنماط','توقع تحركات السوق','تحليل المشاعر','ربط الأحداث بالأسعار','اكتشاف فرص'],
  example:'"الرصد الآلي لاحظ إن السهم بينزل كل ما يقل حجم التداول عن 5M - ده نمط مهم للتجار."' },
  { id:6, num:'06', name:'إدارة المخاطر', desc:'Stop Loss • حجم',
  title:'إدارة المخاطر', subtitle:'🛡️ الذراع السادسة',
  what:'بيحسب لك الستوب لوس المناسب وحجم المركز الصح.',
  watches:['وقف الخسارة (Stop Loss)','حجم المركز','نسبة المخاطرة/العائد','التنوع في المحفظة','الحد الأقصى للخسارة','الارتباط بأصول أخرى'],
  example:'"نقطة دخول 137، ستوب 130، هدف 150. المكسب <span class="flt-ltr">12.8%</span>، الخسارة <span class="flt-ltr">5.2%</span> = نسبة 1:2.5 ممتازة."' },
  { id:7, num:'07', name:'القيمة العادلة', desc:'DCF • تقييم',
  title:'القيمة العادلة', subtitle:'💰 الذراع السابعة',
  what:'بيحسب القيمة الحقيقية للسهم بناءً على التدفقات النقدية المستقبلية.',
  watches:['نموذج التدفق النقدي','مضاعفات القطاع','متوسط P/E التاريخي','صافي الأصول','العائد على الاستثمار','مقارنة مع الشركات المشابهة'],
  example:'"التدفق النقدي بيقول إن السهم يستاهل 165 جنيه، سعره الحالي 137 → فرص للشراء بـ <span class="flt-ltr">28%</span> upside."' },
  { id:8, num:'08', name:'اكتشاف الفرص', desc:'أسهم غير مكتشفة',
  title:'اكتشاف الفرص', subtitle:'🎯 الذراع الثامنة',
  what:'بيفتش في كل أسهم السوق ويطلعلك الفرص اللي محدش واخد باله منها.',
  watches:['أسهم انخفضت بدون سبب','أسهم في قطاع ناشئ','أسهم قريبة من دعم','أسهم ذات توزيعات مرتفعة','أسهم منخفضة القيمة','أسهم في طور التحول'],
  example:'"سهم JUFO نزل <span class="flt-ltr">15%</span> بدون خبر - ده قد يكون فرصة، لكن محتاج تحقق إن السبب تقني مش أساسي."' }
];

const INVESTORS = {
  buffett: { name:'وارن بافيت', title:'ملك القيمة',
  bio:'من أكبر المستثمرين في التاريخ، بدأ من 100$ وبقى عنده +100 مليار.',
  rules:['اشترِ شركات تفهمها','اشترِ شركات عندها "خندق اقتصادي"','اشترِ بأسعار معقولة','تمسك السهم للأبد','كن خايف لما الكل جريان، واجري لما الكل خايف'],
  quote:'"كن خايف لما غيرك جريان، واجري لما غيرك خايف."',
  famous:'استثمر في كوكا كولا 1988، آبل 2016، بيركشاير هاثاواي' },
  lynch: { name:'بيتر لينش', title:'صاحب الأسهم العشر أضعاف',
  bio:'حقق <span class="flt-ltr">29%</span> سنوياً لمدة 13 سنة في ماجلان فاند.',
  rules:['اشترى اللي تعرفه','صنّف السهم','افهم قصة السهم','لا تستثمر فلوس محتاجها','تابع السهم كل ربع سنة'],
  quote:'"لو قعدت في أوضة وفيها كل البيانات، هتلاقي كنوز."',
  famous:'ضاعف محفظة ماجلان 28 مرة في 13 سنة' },
  graham: { name:'بنجامين جراهام', title:'أبو الاستثمار في القيمة',
  bio:'مؤسس مدرسة "الاستثمار في القيمة". أستاذ بافيت.',
  rules:['هامش الأمان <span class="flt-ltr">30%</span>','السوق مش عبقري','استثمر في أصول','الربح من الفرق بين السعر والقيمة','تعلم قبل ما تستثمر'],
  quote:'"في الاستثمار، السلامة المهنية تعني إتباع قواعد صارمة."',
  famous:'نجا من أزمة 1929 وربح من كل أزمة بعدها' }
};

const NEWS = [
  { time:'14:30', tag:'EGX', text:'المؤشر الرئيسي EGX30 يغلق عند 32,450 نقطة +<span class="flt-ltr">0.8%</span>' },
  { time:'14:15', tag:'COMI', text:'البنك التجاري الدولي يعلن عن توزيعات 2.5 جنيه للسهم' },
  { time:'13:45', tag:'TMGH', text:'طلعت مصطفى تطلق مشروع جديد في الساحل الشمالي بـ 50 مليار' },
  { time:'13:20', tag:'SWDY', text:'السويدي إليكتريك تفوز بعقد جديد في السعودية بـ 2 مليار' },
  { time:'12:55', tag:'PHDC', text:'بالم هيلز تعلن عن زيادة في المبيعات الفصلية +<span class="flt-ltr">35%</span>' },
  { time:'12:30', tag:'ETEL', text:'المصرية للاتصالات تطلق شبكة 5G تجريبية في القاهرة' },
  { time:'12:00', tag:'AMOC', text:'الإسكندرية للبترول توزع 0.4 جنيه للسهم' },
  { time:'11:30', tag:'JUFO', text:'جهينة تحقق نمو في المبيعات <span class="flt-ltr">18%</span> في الربع الثاني' }
];

// ============ LIVE NEWS ENGINE ============
// 3 مصادر: Google News (مصر) + Yahoo Finance + Investing.com
// 4 Google News queries — EGX keywords قوية
const NEWS_SOURCES = [
  {
  id: 'google-egx',
  name: '🇪🇬 أخبار البورصة المصرية',
  url: 'https://news.google.com/rss/search?q=%D8%A7%D9%84%D8%A8%D9%88%D8%B1%D8%B5%D8%A9+%D8%A7%D9%84%D9%85%D8%B5%D8%B1%D9%8A%D8%A9+EGX+%D8%A3%D8%B3%D9%87%D9%85&hl=ar&gl=EG&ceid=EG:ar',
  transform: 'rss2json',
  category: 'بنوك'
  },
  {
  id: 'google-eg',
  name: '🇪🇬 أخبار مصر',
  url: 'https://news.google.com/rss/headlines?country=EG&gl=EG&hl=ar',
  transform: 'rss2json',
  category: 'عام'
  },
  {
  id: 'google-companies',
  name: '🏢 شركات',
  url: 'https://news.google.com/rss/search?q=%D8%B4%D8%B1%D9%83%D8%A7%D8%AA+%D9%85%D8%B5%D8%B1%D9%8A%D8%A9+%D8%AA%D9%88%D8%B2%D9%8A%D8%B9%D8%A7%D8%AA+%D8%A3%D8%B1%D8%A8%D8%A7%D8%AD+%D8%A3%D8%B3%D9%87%D9%85+%D8%A8%D9%88%D8%B1%D8%B5%D8%A9&hl=ar&gl=EG&ceid=EG:ar',
  transform: 'rss2json',
  category: 'عقار'
  },
  {
  id: 'google-egypt-econ',
  name: '💰 اقتصاد مصر',
  url: 'https://news.google.com/rss/search?q=%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF+%D9%85%D8%B5%D8%B1+%D8%A7%D9%84%D8%A8%D9%86%D9%83+%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%B2%D9%8A+%D8%A7%D9%84%D8%B9%D9%85%D9%84%D8%A9&hl=ar&gl=EG&ceid=EG:ar',
  transform: 'rss2json',
  category: 'عام'
  }
];

let liveNews = [];
let newsFilter = 'all';
let newsAutoRefreshInterval = null;
let newsLoading = false;

// Stock ticker detection - إيه السهم اللي بيتكلم عنه الخبر
function detectStockTag(title) {
  const t = title.toUpperCase();
  const stocks = ['COMI', 'HRHO', 'EAST', 'JUFO', 'EFIH', 'EKHO', 'PHDC', 'TMGH',
  'EGCH', 'SKPC', 'ABUK', 'MFPC', 'OCDI', 'CIEB', 'ETEL', 'ORWE', 'PHAR',
  'AMOC', 'MNHD', 'ESRS', 'FWRY', 'ADIB', 'CCAP', 'SWDY', 'EMFD', 'PIOH', 'AUTO'];
  for (const code of stocks) {
  if (t.includes(code)) return code;
  }
  // كلمات مفتاحية
  if (t.includes('بورصة') || t.includes('EGX') || t.includes('المؤشر')) return 'EGX';
  if (t.includes('بنك') || t.includes('CIB')) return 'COMI';
  return 'NEWS';
}

// Sector detection
function detectSector(title) {
  const t = title.toLowerCase();
  if (t.includes('بنك') || t.includes('cib')) return 'بنوك';
  if (t.includes('عقار') || t.includes('إسكان')) return 'عقار';
  if (t.includes('اتصالات') || t.includes('هاتف')) return 'اتصالات';
  if (t.includes('بترول') || t.includes('طاقة') || t.includes('كهرباء')) return 'طاقة';
  if (t.includes('صناعة') || t.includes('كيماويات') || t.includes('أسمدة')) return 'صناعة';
  if (t.includes('أغذية') || t.includes('غذاء')) return 'أغذية';
  if (t.includes('تكنولوجيا') || t.includes('ai')) return 'تكنولوجيا';
  return 'عام';
}

// Time formatting
function formatTimeAgo(dateStr) {
  try {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'الآن';
  const diff = Math.floor((Date.now() - d.getTime()) / 60000); // minutes
  if (diff < 1) return 'الآن';
  if (diff < 60) return diff + 'د';
  if (diff < 1440) return Math.floor(diff/60) + 'س';
  return Math.floor(diff/1440) + 'ي';
  } catch { return 'الآن'; }
}

// جلب أخبار من مصدر واحد
async function fetchFromSource(source) {
  try {
  // ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ جسر الـCORS
  // 📌 كان: https://api.rss2json.com/v1/api.json?rss_url=…
  // ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ المتصفح بيمنع الرد (مش فيه ACAO) ⇒ CORS error
  // ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ والـworker بيجيبه من الـedge (نفس الأصل) ⇒ مفيش CORS.
  const proxyUrl = `/api/rss?url=${encodeURIComponent(source.url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) return [];
  const data = await res.json();
  if (data.status !== 'ok' || !data.items) return [];

  return data.items.slice(0, 8).map(item => {
  const tag = detectStockTag(item.title);
  // البحث عن السهم في EGX_STOCKS لإضافة السعر
  const stockMatch = tag && EGX_STOCKS.find(s => s.code === tag);
  return {
  title: item.title,
  link: item.link,
  pubDate: item.pubDate,
  source: source.name,
  sourceId: source.id,
  tag: tag,
  sector: source.category || detectSector(item.title),
  stockCode: stockMatch ? stockMatch.code : null,
  stockPrice: stockMatch ? `${stockMatch.name}` : null
  };
  });
  } catch (e) {
  console.error('Error fetching', source.name, e);
  return [];
  }
}

// جلب كل المصادر
async function fetchAllNews() {
  if (newsLoading) return;
  newsLoading = true;

  const statusEl = document.getElementById('newsLiveStatus');
  if (statusEl) statusEl.innerHTML = '⏳ جاري التحديث...';

  const results = await Promise.all(NEWS_SOURCES.map(fetchFromSource));
  const combined = results.flat();

  // Sort by date
  combined.sort((a, b) => {
  const da = new Date(a.pubDate).getTime() || 0;
  const db = new Date(b.pubDate).getTime() || 0;
  return db - da;
  });

  // Dedupe by title
  const seen = new Set();
  liveNews = combined.filter(n => {
  if (seen.has(n.title)) return false;
  seen.add(n.title);
  return true;
  }).slice(0, 40);

  renderNews();
  newsLoading = false;
  if (statusEl) statusEl.innerHTML = `🟢 آخر تحديث: ${new Date().toLocaleTimeString('ar-EG')}`;
}

// Render news page

// Filter buttons
function setNewsFilter(filter) {
  newsFilter = filter;
  document.querySelectorAll('.news-filter-btn').forEach(b => {
  b.classList.toggle('active', b.dataset.filter === filter);
  });
  renderNews();
}

// Auto-refresh كل 5 دقايق
function startNewsAutoRefresh() {
  if (newsAutoRefreshInterval) clearInterval(newsAutoRefreshInterval);
  fetchAllNews(); // جلب أولي
  newsAutoRefreshInterval = setInterval(fetchAllNews, 5 * 60 * 1000); // 5 min
}

function stopNewsAutoRefresh() {
  if (newsAutoRefreshInterval) {
  clearInterval(newsAutoRefreshInterval);
  newsAutoRefreshInterval = null;
  }
}

const CALCS = {
  profit: { title:'💰 حاسبة الربح',
  fields:[ {id:'buy',label:'سعر الشراء (EGP)',ph:'100'},{id:'qty',label:'عدد الأسهم',ph:'100'},{id:'sell',label:'سعر البيع (EGP)',ph:'120'} ],
  calc:v => {
  const totalBuy = v.buy*v.qty, totalSell = v.sell*v.qty;
  const profit = totalSell-totalBuy, pct = (profit/totalBuy)*100;
  return [{ num: profit.toFixed(2), lbl:'الربح الصافي (EGP)' },{ num: pct.toFixed(2)+'%', lbl:'نسبة الربح' }];
  }
  },
  dividend: { title:'💵 حاسبة التوزيعات',
  fields:[ {id:'shares',label:'عدد الأسهم',ph:'100'},{id:'div',label:'التوزيع للسهم (EGP)',ph:'2.5'},{id:'price',label:'سعر السهم بالجنيه',ph:'100'} ],
  calc:v => {
  const total = v.shares*v.div, y = (v.div/v.price)*100;
  return [{ num: total.toFixed(2), lbl:'إجمالي التوزيعات (EGP)' },{ num: y.toFixed(2)+'%', lbl:'العائد السنوي' }];
  }
  },
  pe: { title:'📊 حاسبة P/E',
  fields:[ {id:'price',label:'سعر السهم بالجنيه',ph:'100'},{id:'eps',label:'ربحية السهم (EPS) بالجنيه',ph:'10'} ],
  calc:v => {
  const pe = v.price/v.eps;
  const rating = pe<10?'رخيص':pe<15?'مقبول':pe<25?'غالي':'غالي جداً';
  return [{ num: pe.toFixed(2)+'x', lbl:'مضاعف P/E' },{ num: rating, lbl:'التقييم' }];
  }
  },
  position: { title:'⚖️ حجم المركز',
  fields:[ {id:'capital',label:'رأس المال (EGP)',ph:'100000'},{id:'risk',label:'المخاطرة %',ph:'2'},{id:'entry',label:'سعر الدخول',ph:'100'},{id:'stop',label:'وقف الخسارة',ph:'95'} ],
  calc:v => {
  const ra = v.capital*(v.risk/100), rps = v.entry-v.stop;
  const sh = Math.floor(ra/rps), cost = sh*v.entry, loss = sh*rps;
  return [{ num: sh, lbl:'عدد الأسهم' },{ num: cost.toFixed(0), lbl:'تكلفة المركز' },{ num: loss.toFixed(0), lbl:'أقصى خسارة' }];
  }
  }
};

/* ══════════════════════════════════════════════════════════════
  🛡️ تهريب النصوص — XSS guard
  ──────────────────────────────────────────────────────────────
  ⛔⛔⛔ ٢٠ أكتوبر ٢٠٢٦ — إصلاح ثغرة XSS في الأخبار.
  كان `${n.title}` و `${n.link}` بيندرجوا في innerHTML من غير
  أي تعقيم. أي سكربت جوه عنوان خبر كان يقدر:
    ١. يقرا التوكن من localStorage
    ٢. يدخل بحساب أي مستخدم
  ⛔ الدالة esc() كانت موجودة في octa-app.js بس core.js
    مبيستخدموهاش خالص (صفر استعمالة).
  ══════════════════════════════════════════════════════════════ */
function octaEsc(v){
  return String(v==null?'':v).replace(/[&<>"']/g, function(c){
    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;',
             '"':'&quot;', "'":'&#39;' })[c];
  });
}

/* 🔗 روابط الأخبار — حماية إضافية من javascript: URLs */
function octaSafeUrl(u){
  var s = String(u==null?'':u).trim();
  if (!s) return '#';
  // اقبل http/https فقط — وامنع javascript: و data:
  if (!/^https?:\/\//i.test(s)) return '#';
  return octaEsc(s);
}

/* ══════════════════════════════════════════════════════════════
  📊 تتبع الاستخدام — نعرف الناس بتعمل إيه فعلاً
  ──────────────────────────────────────────────────────────────
  بيبعت لنا اسم الصفحة أو اسم السهم — مش IP ولا إيميل.
  الهدف: نعرف نطوّر إيه الأول، مش نراقب الناس.
  ══════════════════════════════════════════════════════════════ */
function octaTrack(event, page, label) {
  try {
  // ⛔ مبنعتش لو المستخدم رفض التتبع
  if (localStorage.getItem('octa_no_track') === '1') return;
  // ⛔ مبنعتش في التطوير — عشان الأرقام تنضف
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

  var body = JSON.stringify({
  event: event || 'page_view',
  page: String(page || '').slice(0, 32),
  label: String(label || '').slice(0, 24),
  uid: (window.OCTA_USER_ID || '')
  });
  // ⛔ no-cors + بدون بيانات حساسة
  fetch(OCTA_API + '/api/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: body,
  keepalive: true,
  mode: 'cors'
  }).catch(function () { });
  } catch (e) { }
}

/* إخفاء/إظهار شريط التتبع — عشان المستخدم يقدر يوقف التتبع */
function octaTrackConsent(on) {
  try {
  if (on === false) localStorage.setItem('octa_no_track', '1');
  else localStorage.removeItem('octa_no_track');
  } catch (e) { }
}

/* ══════════════════════════════════════════════════════════════
 * 🧭 OS_NAV — مصدر واحد لحالة التنقّل
 * ──────────────────────────────────────────────────────────────
 * ⛔ المشكلة الجذرية اللي كانت بتضيّع الصفحة بعد الريفريش:
 *    كان فيه **4 ملفات** بتغلّف switchPage —
 *      octa-core.js · octa-sidebar.js · octa-screener.js · octa-pages.js
 *    كل واحد بيعمل `window.switchPage = function(...){ orig(...) }`
 *    وكل واحد بيلفّ اللي قبله وقت ما يتحمّل.
 *    النتيجة: ترتيب التحميل هو منطق التشغيل كله.
 *    لو ملف اتكاش ووصل متأخر — أو اتحمّل بعد أول ضغطة —
 *    السلسلة بتتكسر ومفيش حاجة بتحفظ، والريفريش بيرجع بالرئيسية.
 *
 * ✅ الحل: switchPage واحدة فقط (هنا). والباقي **بيسجّل نفسه**
 *    في hooks. مفيش ملف تاني يلمس window.switchPage.
 *    الترتيب بقى مش مهم — والسببية بقت واضحة.
 *
 * 💾 ليه localStorage مش sessionStorage؟
 *    sessionStorage بيضيع أول ما يقفل التاب. localStorage بيفضل.
 *    هنكتب في الاتنين: localStorage هو المصدر الدائم،
 *    و sessionStorage مرآة سريعة (وأي كود قديم بيفضل شغال).
 * ══════════════════════════════════════════════════════════════ */
const OS_NAV_KEY = 'octa_page';
const OS_NAV_ARM = 'octa_arm';
const OS_NAV_ARMOFF = 'octa_arm_closed';
/* 'home' مش صفحة حقيقية — مفيش عنصر page-home في الـDOM أصلاً.
   أي كود بيكتب 'home' كان بيفسد الحفظ ويخلي الريفريش يرجع فاضي. */
const OS_NAV_HOME = 'home';
/* صفحات نافذة منبثقة — مش صفحة، فمش بنحفظها (وإلا الريفريش
   فتحلك النافذة لوحدها). */
const OS_NAV_MODAL = ['decide'];

const OS_NAV = {
  hooks: [],
  restored: false,

  /* أي ملف عايز يتنفّذ بعد كل انتقال — يسجّل نفسه هنا بدل ما يغلّف */
  on(fn) { if (typeof fn === 'function') { this.hooks.push(fn); return true; } return false; },

  _ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  _ss(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  _set(k, v) {
  try { localStorage.setItem(k, v); } catch (e) {}
  try { sessionStorage.setItem(k, v); } catch (e) {}
  },

  /* ⛔ بتتجاهل أي قيمة مش صفحة حقيقية — دي الحماية الأساسية.
     'home' و '' و undefined ما بتتكتبش أبداً. */
  page(id) {
  id = id == null ? '' : String(id);
  if (!id || id === OS_NAV_HOME || OS_NAV_MODAL.indexOf(id) >= 0) return false;
  this._set(OS_NAV_KEY, id);
  /* فتح صفحة عادية = الذراع اتقفلت */
  try { localStorage.setItem(OS_NAV_ARMOFF, '1'); } catch (e) {}
  return true;
  },

  arm(name) {
  if (!name) return false;
  this._set(OS_NAV_KEY, 'arms');
  this._set(OS_NAV_ARM, String(name));
  try { localStorage.setItem(OS_NAV_ARMOFF, '0'); } catch (e) {}
  return true;
  },

  /* آخر صفحة مطلوبة — من localStorage الأول (الدائم) وبعدين sessionStorage */
  get() { return this._ls(OS_NAV_KEY) || this._ss(OS_NAV_KEY) || null; },
  getArm() { return this._ls(OS_NAV_ARM) || this._ss(OS_NAV_ARM) || null; },
  armOpen() { return this._ls(OS_NAV_ARMOFF) !== '1'; },

  /* الصفحة دي موجودة فعلاً في الـDOM؟ */
  valid(id) {
  if (!id || id === OS_NAV_HOME) return false;
  if (id === 'dash') return !!document.getElementById('dashPage');
  return !!document.getElementById('page-' + id);
  },

  /* نداء كل المسجّلين — كل واحد في try لوحده عشان واحد فاشل
     ما يوقّفش الباقي. */
  fire(id) {
  for (let i = 0; i < this.hooks.length; i++) {
  try { this.hooks[i](id); } catch (e) { /*_hook ما يوقّفش الانتقال_*/ }
  }
  },

  /* ⛔ رجوع ذكي: آخر صفحة حقيقية — بدل switchPage('home') اللي
     كان بيكتب 'home' وبيكدّر الحفظ ويخلي الريفريش فاضي. */
  back() {
  const id = this.get();
  if (this.valid(id)) { switchPage(id); return true; }
  if (typeof sbGo === 'function') { sbGo('stocks'); return true; }
  switchPage('stocks');
  return false;
  },

  /* 🔁 الاسترجاع — بيشتغل مرة واحدة بس.
     بيرجّع true لو اتنفّذ، false لو لسه مقدرش (DOM لسه بيتبني). */
  /* الشاشة الافتراضية (الرئيسية) = ذراع السوق.
     ⛔ كانت بتشتغل بـsetTimeout(..., 300) ثابت في octa-pages.js
     وبتعيد رسم الرئيسية فوق أي صفحة اترجعت — وده بالظبط
     «الريفريش بيرجّعني للرئيسية». الكود القديم (٦٠٠ مللي) كان
     بيكسب السباق بالصدفة مش بالتصميم.
     ✅ بقت جزء من الاسترجاع نفسه: بتشتغل بس لو مفيش حالة محفوظة. */
  defaultView() {
  if (typeof openArm === 'function') { try { openArm('market'); return true; } catch (e) {} }
  return false;
  },

  /* 🔁 الاسترجاع — بيشتغل مرة واحدة بس.
     بيرجّع true لو اتنفّذ، false لو لسه مقدرش (DOM لسه بيتبني). */
  restore() {
  if (this.restored) return true;
  /* 🔗 رابط مباشر: #money يفتح أداة Smart Money فوراً.
     ⛌ الرابط **يغلب** على آخر صفحة محفوظة (ده المقصود من اللينك).
     ⛌ لو الـDOM لسه جاهزش ⇒ نرجّع false عشان الـstart يعيد المحاولة. */
  const hash = (location.hash || '').replace(/^#/, '').trim();
  if (hash && typeof TOOL_PAGES !== 'undefined' && TOOL_PAGES.indexOf(hash) >= 0) {
    if (!this.valid(hash)) return false;   // ⏳ لسه مش جاهزة
    this.restored = true;
    switchPage(hash);
    return true;
  }
  const id = this.get();
  if (!id || id === OS_NAV_HOME) {
  /* 🏠 أول زيارة (أو الحالة اتمسحت) → الشاشة الرئيسية */
  this.restored = true;
  this.defaultView();
  return true;
  }
  if (!this.valid(id)) return false;   // ⏳ لسه مش جاهزة — نعيد المحاولة

  if (id === 'arms' && this.armOpen() && this.getArm() &&
      typeof openArm === 'function' && typeof ARM_MAP !== 'undefined' &&
      ARM_MAP[this.getArm()]) {
    openArm(this.getArm());
  } else {
    switchPage(id);
  }
  this.restored = true;
  return true;
  },

  /* ⏩ يشتغل أول ما الـDOM يجهز، وبعدها شبكة أمان محدودة:
     بتستنى العنصر لحد ما يظهر (البوابة/السكربتات ممكن تتأخر)
     وبتقفل بعد ٤٠ محاولة — مش تأخير عشوائي، ده انتظار لشرط
     حقيقي بحدّ أقصى واضح. */
  start() {
  const boot = () => {
    if (this.restore()) return;
    let n = 0;
    const tick = () => {
    if (this.restored) return;
    if (++n > 40) {
    /* ⛔⛔⛔ ٢٢ أكتوبر ٢٠٢٦ — باج «شاشة بيضا».
     ⛌ لو الصفحة المحفوظة مش موجودة في الـDOM (اتمسحت من
     ⛌   الـKEEP · اتغير اسمها · أخطأنا) ⇒ الـrestore بيعيد ٤٠
     ⛌   مرة وبيستسلم ⇒ **مفيش صفحة مفتوحة** ⇒ المستخدم بيفتح
     ⛌   الموقع وشاشة بيضا. (ده اللي حصل مع Smart Money.)
     ⛌ ✅ الحل: لو الاسترجاع فشل ⇒ افتح الشاشة الافتراضية
     ⛌   (الرئيسية) بدل ما تسيب المستخدم قدام شاشة بيضا. */
    this.restored = true;
    try { this.defaultView(); } catch (e) { }
    return;
    }
    if (this.restore()) return;
    setTimeout(tick, 80);
    };
    setTimeout(tick, 80);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  }
};

/* ══════════════════════════════════════════════════════════════
 * 🔁 تهيئة صفحة — لازم_single source_ للسببين:
 *   ① لما المستخدم يفتح الصفحة (من switchPage)
 *   ② لما البوابة تخلص (? octa:authed)
 * ⛔ السبب ٢ كان ناقص: لو الاسترجاع حصل **قبل** ما البوابة
 * تفتح، الـendpoints المحمية بترجع 401 ⇒ OS_DB فاضي ⇒ الجداول
 *   zeroy. وبعد ما البوابة تفتح مفيش حاجة كانت هترسم تاني —
 *   النتيجة: المستخدم مسجّل دخوله ويشوف جدول فاضي.
 * ✅ هنا بنعمل init مرتين مشthree: مرة عند الفتح، ومرة بعد الدخول.
 * ══════════════════════════════════════════════════════════════ */
function octaPageInit(id) {
  // ═══ صفحة كارت القرار — تحميل أول مرة ═══
  if (id === 'screener' && typeof scInit === 'function') setTimeout(()=>scInit(), 200);
  if (id === 'verdict' && typeof initVerdictCard === 'function') initVerdictCard();

  // ═══ صفحة البحث — تحميل أول مرة ═══
  if (id === 'stocks' && typeof initStocksPage === 'function') initStocksPage();
  /* 💰 Smart Money — الفلتر + الكروت + الشارت
     ⛔ الـinit مرتين (فتح الصفحة + بعد البوابة) زي باقي الصفحات —
        أول مرة قبل الدخول بترجّع 401 فالداتا بتتحمّل تاني. */
  if (id === 'money' && typeof moneyInit === 'function') setTimeout(()=>{ try { moneyInit(); } catch(e){ console.warn('money:', e.message); } }, 150);
  /* 🛰️ الرادار الذكي — المسح + كروت المؤشرات + الشارت
     ⛔ الـinit مرتين (فتح الصفحة + بعد البوابة) زي باقي الصفحات. */
  if (id === 'radar' && typeof radarInit === 'function') setTimeout(()=>{ try { radarInit(); } catch(e){ console.warn('radar:', e.message); } }, 180);
  if (id === 'compare') setTimeout(()=>{ if (typeof cmpInit==='function') cmpInit(); }, 150);
  /* 🔴⛔⛔ إصلاح 2026-10-15 — الباج اللي Ahmed صوّره.
     كان: `setTimeout(fzInit, 180)` — يعني بنستنى ١٨٠ مللي ثم نرسم.
     والداتا (octaLoadDB) بتاخد ~١ ثانية.
     ⇒ أول فتح للفلاتر: OS_DB فاضي ⇒ كل الجداول صفر و«251 سهم · 0 فرصة».
     ⇒ لمّا المستخدم يرجع ويدخل تاني: الداتا خلصت ⇒ كله شغال.
     ده سباق (race) مش تصميم.

     الحل: نستنى الداتا **بالفعل** قبل ما نرسم.
     octaLoadDB بترجّع فوراً لو الداتا جاهزة (بتعمل Promise_cache جواها)
     فمفيش أي تأخير إضافي على الفتح الثاني. */
  if (id === 'filter' || id === 'best') setTimeout(async ()=>{
  try { if (typeof octaLoadDB === 'function') await octaLoadDB(); } catch(e) { console.warn('data:', e.message); }
  if (id === 'filter' && typeof fzInit==='function') fzInit();
  if (id === 'best'   && typeof fzBestInit==='function') fzBestInit();
  }, 40);
  if (id === 'pick') setTimeout(async ()=>{ if (typeof octaLoadDB==='function'){ try{ await octaLoadDB(); }catch(e){} } if (typeof pickInit==='function') pickInit(); }, 150);
  if (id === 'dividends' && typeof dvLoad === 'function') dvLoad();
  if (id === 'octasearch') {
  if (!window.__osInit) { window.__osInit = 1; setTimeout(() => octaInit(), 80); }
  // نفضّي قائمة النتائج (بس نسيب نص البحث زي ما هو — عشان تختار نتيجة تانية)
  const orr = document.getElementById('osResults');
  if (orr) orr.classList.remove('open');
  const oc = document.getElementById('osClear');
  if (oc) oc.classList.remove('on');
  }

  // ═══ صفحة الأسواق ═══
  if (id === 'markets' && typeof window.mkLoad === 'function') {
  setTimeout(() => { try { window.mkLoad(); } catch(e) { console.warn('markets:', e.message); } }, 200);
  }

  // تحميل التوزيعات أول مرة لما تفتح الصفحة
  if (id === 'dividends' && typeof dvLoad === 'function') dvLoad();}

/* 🔌 بعد ما البوابة تفتح — أعد تهيئة الصفحة الحالية.
   الداتا المحمية كانت رجعت 401 وقت الاسترجاع، فمحتاجين
   نرسم من جديد دلوقتي إنما التوكن موجود فعلاً. */
document.addEventListener('octa:authed', function () {
  setTimeout(function () {
  try {
  const cur = (typeof currentPage !== 'undefined' && currentPage) || OS_NAV.get();
  if (!cur || cur === OS_NAV_HOME) return;
  octaPageInit(cur);
  } catch (e) { console.warn('authed init:', e.message); }
  }, 120);
});

function switchPage(id) {
  /* ⛔⛔⛔ ٢٢ أكتوبر ٢٠٢٦ — صفحة مش موجودة = شاشة بيضا.
  ⛌ لو الـid مالوش عنصر في الـDOM (صفحة اتمسحت · اسم غلط) ⇒
  ⛌   كل الكود اللي بعده بيشتغل على لا حاجة ⇒ المستخدم بيفتح
  ⛌   الموقع وشاشة بيضا من غير ما يفهم.
  ⛌ ✅ الحل: نتأكد إن الصفحة موجودة قبل ما نحفظ ونفتح — ولو
  ⛌   مش موجودة ⇒ نرجع للصفحة الافتراضية (الرئيسية). */
  const pg = (id === 'dash') ? document.getElementById('dashPage') : document.getElementById('page-' + id);
  if (!pg) {
    try { if (typeof OS_NAV !== 'undefined' && OS_NAV.defaultView) OS_NAV.defaultView(); } catch (e) { }
    return;
  }
  /* 🧭 الحفظ **أول سطر في الدالة** — قبل أي سطر DOM.
     كان متحطّ بعد ٤٠ سطر، فلو أي استثناء حصل فوقه
     الحفظ بيضيع والريفريش يرجع بالرئيسية. */
  OS_NAV.page(id);
  // 📊 نسجّل فتح الصفحة — عشان نعرف الصفحات الأكثر استخدامًا
  octaTrack('page_view', id);
  // ملاحظة: صفحة «الأسهم» بقت مستقلة (285 سهم) — التحويل القديم للبحث اتشال
  // if (id === 'stocks') id = 'search';

  // ═══ الأدوات/الفلاتر اللي جايبينها من الرابط القديم — نفتح الصفحة القديمة زي ما هي ═══
  const isTool = TOOL_PAGES.indexOf(id) >= 0;

  // ═══ v8: إخفاء المحتوى القديم (A→I) — بس صفحات الأدوات بتنتقل لـ toolPagesHost ═══
  const oldHome = document.getElementById('homeHidden');
  if (oldHome) oldHome.style.setProperty('display','none','important');

  // ═══ شاشة الذراع تُخفى لما نفتح صفحة عادية ═══
  const av = document.getElementById('armView');
  if (av) av.style.display = 'none';

  // ═══ الصفحات المستقلة (تحليل السهم / تقرير التكرار) — لازم تتقفل ═══
  // ⚠️ دي مش من '.page' فـ switchPage مش بيلمسها — و كانت بتغطي الفلتر الجديد
  ['stockPage','auditPage','intelPage','stockPanel','stockPanelHost','dashPage'].forEach(id => {
  const el = document.getElementById(id);
  if (el) { el.style.setProperty('display','none','important'); el.classList.remove('active'); }
  });
  const sp0 = document.getElementById('stockPanel');
  if (sp0) sp0.style.display = 'none';

  // ═══ لوحة التحكم (PHASE 18) — جوّا صفحة الرئيسية ═══
  if (id === 'dash') {
  const home = document.getElementById('page-home');
  const dash = document.getElementById('dashPage');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (home) home.classList.add('active');
  // نخفي كل حاجة في الرئيسية ما عدا لوحة التحكم
  if (home) {
  Array.from(home.children).forEach(ch => {
  if (ch !== dash) ch.style.display = 'none';
  });
  }
  if (dash) dash.style.setProperty('display', 'block', 'important');
  document.getElementById('intelPage')?.style.setProperty('display','none','important');
  document.querySelector('.nav-btn[data-page="dash"]')?.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  loadDashboard();
  return;
  }

  // ═══ أي صفحة تانية: نرجّع عناصر الرئيسية ونخفي اللوحة ═══
  const dashPage = document.getElementById('dashPage');
  if (dashPage) {
  dashPage.style.display = 'none';
  const home = document.getElementById('page-home');
  if (home) Array.from(home.children).forEach(ch => ch.style.display = '');
  }

  document.querySelectorAll('.page').forEach(p=>{
  p.classList.remove('active');
  p.style.display = '';
  });
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.toggle('active', b.dataset.tool === id));
  document.getElementById('page-'+id)?.classList.add('active');
  document.querySelector(`.nav-btn[data-page="${id}"]`)?.classList.add('active');
  /* 🧭 الحفظ بقى في أول سطر من switchPage (OS_NAV.page) —
     هنا مكانه القديم كان بعد كل الـDOM فأي استثناء كان بيمسحه. */
  window.scrollTo({top:0,behavior:'smooth'});
  /* 🧭 كل المسجّلين (السايدبار · الشاشة · السكيرENER) — بعد ما
     الصفحة اتفعّلت فعلاً عشان يشوفوا الـactive. */
  OS_NAV.fire(id);

  /* 🔗 الرابط المباشر — الـhash يعكس الصفحة المفتوحة.
     ⛔ replaceState (مش location.hash) عشان ماتفتحش صفحات كتير في
     ⛔   الـhistory (رجوع بيزود). ⛔ ومسح الـhash لما نرجع الرئيسية. */
  try {
    if (isTool) history.replaceState(null, '', '#' + id);
    else if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  } catch (e) { }

  /* ═══ قرار اليوم — نافذة منبثقة مش صفحة ═══ */
  if (id === 'decide') { if (typeof openDecide==='function') openDecide(); return; }

  octaPageInit(id);
}

/* ══════════ الأدوات/الفلاتر — من الرابط القديم، بنفس الميزات ══════════ */
const TOOL_PAGES = ['filter','best','screener','dividends','octasearch','verdict','pick','compare','calc','academy','bestpick','news','search','engine','arms','money','radar','radar-stock'];
/* ══════════════════════════════════════════════════════════════
 *  🧰 شريط الأدوات — 8 أدوات بس، والباتاقي في الـsidebar
 *  ──────────────────────────────────────────────────────────
 *  الترتيب مقصود: من «الأكبر» (الأسهم) لـ «الأدق» (الفلاتر).
 *  الشاشة الرئيسية بتبدأ بالسؤال الكبير وتنتهي بالتحديد.
 *
 *  ⚠️ الباقي (قرار اليوم · كارت القرار · أفضل فرصة · حاسبات ·
 *  أخبار · أكاديمية) بيفضل موجود في الـsidebar بس.
 * ══════════════════════════════════════════════════════════════ */
const TOOLS = [
  { id:'stocks',  i:'📊', n:'الأسهم',  d:'كل البورصة المصرية' },
  { id:'arms',  i:'🐙', n:'الأذرع',  d:'الأذرع الثمانية' },
  { id:'engine',  i:'🧠', n:'المحرك',  d:'التحليل الكامل بالمحاور' },
  { id:'octasearch', i:'🔎', n:'بحث OCTA',  d:'تحليل أي سهم بالاسم' },
  { id:'dividends',  i:'📅', n:'التوزيعات',  d:'نقدي · أسهم · إعلانات' },
  { id:'pick',  i:'🆚', n:'المقارنة الذكية',
    d:'اكتب لحد 10 أسهم · OCTA يرتّبهم بمعايره' },
  { id:'filter',  i:'🗂️', n:'فلاتر المؤشرات',  d:'8 فلاتر ذكية' },
  { id:'screener',  i:'🔍', n:'OCTAView',  d:'الفلاتر المباشرة' },
  { id:'money',   i:'💰', n:'Smart Money', d:'قوة الفلوس · ٤ محاور' },
  { id:'radar',   i:'🛰️', n:'الرادار الذكي', d:'مسح السوق · ٤ مؤشرات · مخاطرة' },
  { id:'dash',      i:'📊', n:'لوحة التحكم', d:'حالة النظام · أفضل ١٠ أسهم · اختبار الضغط' }
];

/* كل الأدوات — للـsidebar (الـ15 كلها) */
const ALL_TOOLS = [
  ...TOOLS,
  { id:'decide',  i:'🎯', n:'قرار اليوم', d:'3 قرارات جاهزة', modal:1 },
  { id:'verdict',  i:'🃏', n:'كارت القرار', d:'يتحسب وقت الفتح' },
  { id:'compare',  i:'⚖️', n:'مقارنة الأصول', d:'لحد 6 أصول جنب بعض' },
  { id:'bestpick',  i:'🏆', n:'أفضل فرصة', d:'اختيار السهم' },
  { id:'calc',  i:'🧮', n:'حاسبات', d:'4 أدوات' },
  { id:'news',  i:'📰', n:'أخبار', d:'فلترة بالقطاع' },
  { id:'academy',  i:'🎓', n:'أكاديمية', d:'بافيت · لينتش' }
];
const OCTA_QUICK = ['COMI','ETEL','TMGH','SWDY','HRHO','AALR','EGAL','ORWE','ABUK','MASR','ESRS','ADRI'];

/* ══════════ ترتيب الفلاتر — لكل مستخدم ترتيبه الخاص ══════════ */
const TOOL_KEY = 'octa_tool_order_v1';
const TOOL_HIDE_KEY = 'octa_tool_hidden_v1';

function toolSave(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function toolLoad(k, d){ try { const v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? v : d; } catch(e){ return d; } }

function toolOrder(){
  const saved = toolLoad(TOOL_KEY, []);
  const known = saved.filter(id => TOOLS.some(t => t.id === id));
  const rest  = TOOLS.filter(t => known.indexOf(t.id) < 0).map(t => t.id);
  return known.concat(rest);  // أي فلتر جديد بيتضاف في الآخر تلقائياً
}
function toolHidden(){ return toolLoad(TOOL_HIDE_KEY, []); }

/* الأزرار الظاهرة — مرتبة حسب ترتيب المستخدم */
function orderedTools(){
  const hid = toolHidden();
  return toolOrder().map(id => TOOLS.find(t => t.id === id)).filter(Boolean).filter(t => hid.indexOf(t.id) < 0);
}

function buildToolbar(){
  const el = document.getElementById('toolbar');
  if (!el) return;
  const list = orderedTools();
  el.innerHTML = list.map(t =>
  `<button class="tool-btn" data-tool="${t.id}" onclick="${t.modal?'openDecide()':`switchPage('${t.id}')`}" title="${t.d}">
  <span class="tb-i">${t.i}</span><span class="tb-n">${t.n}</span>
  </button>`
  ).join('');

  /* 🧭 الصفحة المفتوحة (خصوصاً لو جايدة من رابط مباشر) — نعلّم الزر بتاعها.
     ⛌ الأزرار بتتبني بعد switchPage أحياناً ⇒ فبدون السطر ده
     ⛌   الرابط المباشر بيفتح الصفحة بس الزرار مش مميّز. */
  try {
    const cur = (typeof OS_NAV !== 'undefined' && OS_NAV.get) ? (OS_NAV.get() || '') : '';
    if (cur) {
      el.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === cur));
    }
  } catch (e) { }
}

/* ══════ لوحة الترتيب ══════ */
function openToolEditor(){
  const ov = document.createElement('div');
  ov.className = 'te-overlay';
  ov.id = 'teOverlay';
  ov.onclick = e => { if (e.target === ov) closeToolEditor(); };
  document.body.appendChild(ov);
  renderToolEditor();
}

function closeToolEditor(){
  const ov = document.getElementById('teOverlay');
  if (ov) ov.remove();
  const b = document.getElementById('toolCfg');
  if (b) b.textContent = '⚙️';
}

function renderToolEditor(){
  const ov = document.getElementById('teOverlay');
  if (!ov) return;
  const cfg = document.getElementById('toolCfg');
  if (cfg) cfg.textContent = '✕';
  const ord = toolOrder();
  const hid = toolHidden();
  ov.innerHTML =
  '<div class="te-panel">' +
  '<div class="te-h"><div><div class="te-t">🎛️ رتّب الفلاتر زي ما تحب</div></div>' +
  '<button class="te-eye" onclick="closeToolEditor()" title="اقفل">✕</button></div>' +
  '<div class="te-s">اسحب الأسهم أو استخدم  — الترتيب بيتحفظ على جهازك ويفضل زي ما هو.</div>' +
  ord.map((id, i) => {
  const t = TOOLS.find(x => x.id === id); if (!t) return '';
  const off = hid.indexOf(id) >= 0;
  return '<div class="te-row' + (off ? ' off' : '') + '">' +
  '<div class="te-ico">' + t.i + '</div>' +
  '<div class="te-nm"><b>' + t.n + '</b><span>' + t.d + '</span></div>' +
  '<div class="te-mv">' +
  '<button class="te-btn" onclick="toolMove(' + i + ',-1)"' + (i === 0 ? ' disabled' : '') + '>▲</button>' +
  '<button class="te-btn" onclick="toolMove(' + i + ',1)"' + (i === ord.length - 1 ? ' disabled' : '') + '>▼</button>' +
  '</div>' +
  '<button class="te-eye' + (off ? '' : ' on') + '" onclick="toolToggle(\'' + id + '\')" title="' + (off ? 'اظهره' : 'اخفيه') + '">' + (off ? '🚫' : '👁️') + '</button>' +
  '</div>';
  }).join('') +
  '<div class="te-actions">' +
  '<button onclick="toolReset()">↩️ ترتيب افتراضي</button>' +
  '<button class="done" onclick="closeToolEditor()">تم ✅</button>' +
  '</div>' +
  (hid.length ? '<div class="te-badge">🚫 فيه ' + hid.length + ' فلتر مخفي — دوس 👁️ لإظهاره</div>' : '') +
  '</div>';
}

function toolMove(i, dir){
  const ord = toolOrder();
  const j = i + dir;
  if (j < 0 || j >= ord.length) return;
  const tmp = ord[i]; ord[i] = ord[j]; ord[j] = tmp;
  toolSave(TOOL_KEY, ord);
  renderToolEditor();
  buildToolbar();
}

function toolToggle(id){
  const hid = toolHidden();
  const k = hid.indexOf(id);
  if (k >= 0) hid.splice(k, 1);
  else {
  if (TOOLS.length - hid.length <= 2) { alert('لازم يفضل فلترين على الأقل ظاهرين 🙂'); return; }
  hid.push(id);
  }
  toolSave(TOOL_HIDE_KEY, hid);
  renderToolEditor();
  buildToolbar();
}

function toolReset(){
  toolSave(TOOL_KEY, []);
  toolSave(TOOL_HIDE_KEY, []);
  renderToolEditor();
  buildToolbar();
}

/* ══════════════════════════════════════════════════════════════
  🔒 حقوق الملكية — م/ أحمد عز
  بينحقن بالـ JS عشان يضمن إنه آخر عنصر في <body>
  (مش HTML ثابت، لأن doKill بيمسح كتلة homeHTML كلها)
  ══════════════════════════════════════════════════════════════ */
function buildCredit(){
  if (document.querySelector('.octa-credit')) return;
  const d = document.createElement('div');
  d.className = 'octa-credit';
  d.innerHTML =
  '<div class="oc-inner">' +
  '<div class="oc-line">' +
  '<span class="oc-brand">OCTA</span>' +
  '<span class="oc-dot">·</span>' +
  '<span class="oc-sub">منصة البورصة المصرية الذكية</span>' +
  '</div>' +
  '<div class="oc-own">' +
  '<span class="oc-badge">🔒</span>' +
  '<span>جميع الحقوق محفوظة لـ <b>م/ أحمد عز</b> — تصميم وتطوير</span>' +
  '</div>' +
  '<div class="oc-warn">⚠️ أي نسخ أو تعديل أو إعادة نشر أو استخدام برمجي لهذا المشروع بدون إذن كتابي من المالك مخالف للقانون.</div>' +
  '<div class="oc-meta">© ' + new Date().getFullYear() + ' OCTA · كل البيانات للتحليل والتعلّم فقط — مش نصيحة استثمارية</div>' +
  /* ══════════════════════════════════════════════════════
  *  ⚖️ إخلاء المسؤولية
  *  ─────────────────────────────────────────────────────
  *  لازم يبان واضح ومن غير ما حد يقراه. مش سطر صغير
  *  في الفوتر — ده نص كامل بيتقرا قبل ما حد يتعامل.
  *
  *  ⚠️ تنبيه: النص ده صياغة تقنية مش قانونية.
  *  لازم محامي مصري يراجعه قبل ما أي مستخدم حقيقي
  *  يتعامل مع الموقع. مش اعتماد نهائي.
  * ══════════════════════════════════════════════════════ */
  /* ⛔⛔ ٢٣ أكتوبر ٢٠٢٦ — أخفينا النص الطويل.
  📌 كان بياخد نص الشاشة وبيخوّف الزائر قبل ما يدخل.
  📌 ⛌ دلوقتي: سطر واحد «إخلاء المسؤولية» بخط منقّط (زي أي لينك)
  📌 ⛌ ⛌ والضغط عليه يفتح الكارت. مخفي في كل الصفحات.
  📌 ⛌ ⛌ ونفس الكارت موجود في الـmodal بتاع التحليل كمان ( octa-copyright ).
  📌 (من Production — اتنقذ قبل ما يضيع) */
  '<button class="oc-disc-toggle" type="button" id="ocDiscToggle"' +
  ' aria-expanded="false" aria-controls="ocDiscBody">' +
  '⚖️ <u>إخلاء المسؤولية</u>' +
  '</button>' +
  '<div class="oc-disc" id="ocDiscBody" hidden>' +
  '<div class="oc-disc-h">⚖️ إخلاء المسؤولية</div>' +
  '<ol class="oc-disc-l">' +
  '<li>الموقع ده أداة تحليل وتعلّم — <b>مش</b> توصية شراء أو بيع لأي سهم.</li>' +
  '<li>الأسعار بتتأخر وممكن تكون غلط. <b>راجع مصدر رسمي</b> (فودالنس / EGX) قبل أي قرار.</li>' +
  '<li>التقييم النسبي (من 100) ترتيب بين الأسهم — <b>مش</b> وعد بالربح ولا سعر مستهدف مضمون.</li>' +
  '<li>البيانات جاية من مصادر خارجية (TradingView · فودالنس).<br>أخطاؤها أو تأخرها مش من مسؤوليتنا.</li>' +
  '<li>الاستثمار في البورصة مخاطرة. <b>خسارة أو ربحك على مسؤوليتك أنت وحدك.</b></li>' +
  '<li>استشر مستشار مالي مرخّص قبل أي استثمار بأكثر من اللي تتحمل خسارته.</li>' +
  '</ol>' +
  '</div>' +
  '</div>';
  document.body.appendChild(d);
}

/* ⛔ toggle إخلاء المسؤولية — ٢٣ أكتوبر ٢٠٢٦
📌 الضغط على «إخلاء المسؤولية» يفتح/يقفل الكارت.
📌 ⛌ متربط بالـdelegate على document عشان يشتغل من أي مكان
📌 (الصفحة الرئيسية · المودال · التحليل) من غير تكرار. */
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t) return;
  if (t.id === 'ocDiscToggle' || (t.closest && t.closest('#ocDiscToggle'))) {
  e.preventDefault();
  var btn = document.getElementById('ocDiscToggle');
  var box = document.getElementById('ocDiscBody');
  if (!btn || !box) return;
  var open = box.hasAttribute('hidden');
  if (open) { box.removeAttribute('hidden'); btn.setAttribute('aria-expanded', 'true'); }
  else { box.setAttribute('hidden', ''); btn.setAttribute('aria-expanded', 'false'); }
  return;
  }
  /* ⛌ الضغط بره الكارت بيقفله */
  var box2 = document.getElementById('ocDiscBody');
  if (box2 && !box2.hasAttribute('hidden') && t.id !== 'ocDiscToggle'
  && !box2.contains(t)) {
  box2.setAttribute('hidden', '');
  var b2 = document.getElementById('ocDiscToggle');
  if (b2) b2.setAttribute('aria-expanded', 'false');
  }
});

/* ══════════ بحث OCTA — تحليل كامل ══════════ */
let OS_DB = [], OS_LIST = [], OS_SEL = -1, OS_SECT = 'all', OS_READY = false, OS_SEQ = 0, OS_ORIGIN = null, OS_META = null;


/* ══════════════════════════════════════════════════════════════
  📚 سجل البورصة المصرية الكامل — data_egx.json
  ──────────────────────────────────────────────────────────────
  * 285 سهم حقيقي (البورصة كلها)
  * كل الأرقام الأساسية: P/E · ROE · P/B · هوامش · مبيعات · عائد
  · بيتا · قيمة سوقية · ديون · أداء · توصية TradingView
  * مبني من TradingView EGX Scanner + أسماء عربية من محرك OCTA
  * بيتحدّث مع كل نشر جديد للموقع
  ══════════════════════════════════════════════════════════════ */
const EGX_COLS = {
  n:'name', p:'price', c:'change', v:'volume', mc:'mkt_cap', pe:'pe', pb:'pb',
  roe:'roe', om:'op_margin', nm:'net_margin', rev:'revenue', dy:'div_yield',
  b:'beta', s:'sector', d:'debt_equity', rv:'rel_volume', p1m:'perf_1m',
  py:'perf_y', vol:'volatility', tv:'tv_rating'
};

let EGX_DB = null, EGX_META = null;

let RK = {};
/* ⛔⛔ كان بيقرأ data_risk.json من القرص (47KB) — الملف كان static
  على Cloudflare فأي زائر ينزّله من غير تسجيل.
  كل الحقول دي موجودة جوه رد الـAPI (vol1y·vol3y·mdd·mdd1y·
  sharpe3y·sortino3y·cagr3y·frm52hi) في المسارين، فبقت بتتبعت معاهم.
  ملاحظة: الكاش بقى فاضي عن قصد. */
async function loadRiskFile(){ RK = {}; return RK; }

/* ⛔ الفرق بين الشكلين — غلط هنا = 22 حقل بيضيعوا بصمت:
  /api/data_full → total·verdict·q·m·sf·lq·conf·sectorAr·pack·why…
  /api/egx_full  → n·en·s·score·decision·s_rsi·s_dy…
  فنقرأ الشكل من الرد نفسه مش من اسم المسار. */
function _isFullShape(f){
  if (!f || !f.stocks) return false;
  if (f._shape) return f._shape === 'full';
  const k = Object.keys(f.stocks)[0];
  const s = k ? f.stocks[k] : null;
  if (!s) return false;
  /* ⛔⛔⛔ ٢١ أكتوبر ٢٠٢٦ — تصليح بعد إخفاء المخرجات
  ⛌ كان بيفحص s.total أو s.verdict — والتنين في _HIDDEN_KEYS_OUTPUT،
  ⛌ فاتشالوا من رد الـAPI عشان نخبي الدرجة عن الزائر.
  ⛌ النتيجة: data_full كان بيتعامل معاه كأنه «مش full»
  ⛌ فالدرجة كانت بتتحسب 0 وبتطلع «—» في كارت السهم.
  ⛌ ⛌ الحل: نفحص حقول ما بتتخفاش (المحاور · الدرجات الفرعية)
  ⛌ فـdata_full الحقيقي يتعرف، والدرجة تظهر تاني. */
  /* ⛌ ملاحظة: technical_score و fund_score و safety_score
  ⛌ كلهم في _HIDDEN_KEYS_OUTPUT على السيرفر — فمفتيشش هنا.
  ⛌ الحقول اللي بتتخفيش:-sector / pe / roe / eps / sma200
  ⛌ دي الحقول اللي بتقول «ده ملف كامل» مش «ده ملف ناقص». */
  if (s.pe != null || s.roe != null || s.eps != null || s.sma200 != null
      || s.rsi != null || s.macd != null || s.industry != null
      || s.sector != null) return true;
  return !!(s && (s.total != null || s.verdict != null || s.conf != null));
}

async function loadEgxFile(){
  if (EGX_DB) return EGX_DB;
  const bust = '?_=' + Date.now();
  await loadRiskFile();
  try {
  /* ⛔⛔ الداتا بقت من الـAPI المحمي — مفيش أي ملف على القرص.
  الترتيب: ① /api/data_full (محمي · 285 سهم · تقييم الأذرع الخمسة)
  ② /api/egx_full  (محمي · fallback قديم بدون تقييم)
  الاتنين محميين بـ require_user على السيرفر.
  🔑 التوكن بيتلزق في octa-api.js لوحده (AUTH_PATHS) —
  مفيش ولا سر ولا توكن مكتوب في الواجهة.
  ملاحظة: لو السيرفر واقع الاتنين بيرجعوا فاضي والواجهة
  بترجع لسلوك /api/rank بس — أحسن من إننا نعرض أرقام مكشوفة. */
  const pick = async (path) => {
  try {
  const r = await fetch(OCTA_API + path + bust);
  if (!r.ok) return null;
  return await r.json();
  } catch(e){ return null; }
  };
  /* ⛔⛔⛔ ٢١ أكتوبر ٢٠٢٦ — نطلب /api/rank الأول
  ⛌ ده المحمي اللي فيه الدرجة + التوصية + الاسم العربي.
  ⛌ قبل كنا بنطلبه في octaLoadDB بس وبنقفل الكاش — فالعشان كان
  ⛌ بيتقفل بـOS_READY، الواجهة فضلت على الملف العام الفاضي.
  ⛌ ⛌ الحل: نجيبه هنا جوّه loadEgxFile — مرة واحدة، محمي، مضمون. */
  let rankRows = [];
  try {
  const rr = await pick('/api/rank?limit=400');
  rankRows = (rr && rr.results) || [];
  } catch (e) { rankRows = []; }

  let f = await pick('/api/data_full');
  let fromFull = _isFullShape(f);
  if (!fromFull) {
  f = await pick('/api/egx_full');
  fromFull = _isFullShape(f);
  }
  if (!f || !f.stocks) return null;

  /* 🎯 live = الدرجات من الـrank المحمي. دي المصدر الأصح. */
  const live = {};
  for (const s of rankRows) if (s && s.code) live[s.code] = s;

  EGX_DB = {};
  for (const code of Object.keys(f.stocks)) {
  const r = f.stocks[code];
  const lv = live[code] || {};
  // بيانات المحرك الحيّة هي الأصح — السجل تاريخ
  /* 🆕 data_full.json بأسماء مختلفة — نطبّع هنا مرة واحدة */
  const F = fromFull;
  EGX_DB[code] = F ? {
  code,
  name  : r.name,
  nameEn: r.nameEn || r.name,
  sector: r.sectorAr || r.sector || '—',
  /* 🔴 نفس الباج — || بتبلع الـ0. و r.price fallback احتياطي:
     لو الملف الرجع price بدل p، الفلاتر هترجع صفر صفوف. */
  price : Number(lv.price ?? r.p ?? r.price ?? 0),
  change: Number(lv.change ?? r.c ?? r.change ?? 0),
  volume: Number(lv.volume ?? r.v ?? r.volume ?? 0),
  /* ⛔⛔⛔ ٢١ أكتوبر ٢٠٢٦ — إصلاح جذر
  ⛌ كان بيقرا الدرجة من r.total و r.verdict (من data_full).
  ⛌ بس في _ALWAYS_SHOW_OUTPUT على السيرفر — يعني المفروض يظهر.
  ⛌ المشكلة: لو data_full رجع 4٠١ (التوكن لسه ما اتسلّمش)،
  ⛌ fromFull=false و F falsy ⇒ الدرجة = undefined.
  ⛌ ⛌ الحل: نرجع للـAPI المحمي `/api/rank` اللي دايماً محمي
  ⛌ وشغّال بعد الدخول، ونضيفه كـfallback قبل أي ملف. */
  score : (lv.final_score ?? lv.score ?? r.total ?? null),
  decision: (lv.decision ?? r.verdict ?? null),
  pe: r.pe, pb: r.pb, roe: r.roe, mcap: r.mc, beta: r.beta, yield: r.dy,
  eps: r.eps, revenue: r.rev, netMargin: r.nm, opMargin: r.om,
  rsi: r.rsi, ma50: r.ma50, ma200: r.ma200, roa: r.roa,
  vol1y: r.vol1y, vol3y: r.vol3y, mdd: r.mdd, mdd1y: r.mdd1y,
  sharpe3y: r.sharpe3y, sortino: r.sortino3y, cagr3y: r.cagr3y, frm52hi: r.frm52hi,
  freeFloat: r.float, gm: r.gm, pm: r.nm, fcf: r.fcf,
  /* 🔴🔴 سبب باج «نمو = 239 مليار %» (2026-10-15)
     السطر ده كان:  rg: r.rev
     يعني الحقل rg كان بيرجّع **الإيراد بالجنيه** (4,731,916,011ج)
     والواجهة كانت بتطبعه كأنه نسبة مئوية ⇒ 4731916011%
     ⛔ الحقل الواحد كان له معنيين: rg = نسبة نمو ( octa-app.js )
        و rg = إيراد بالجنيه ( هنا ). اتنين معنى لنفس الاسم.
     الإصلاح: ما فيش اسم واحد بمعنين. الحقول صريحة بالاسم:
       revEgp  = الإيراد بالجنيه  (رقم مطلق — مش نسبة، ومفيش % بعده أبداً)
       revGrow = نمو الإيراد %    (مش متاح في data_full — بيفضل null)
     والواجهة بقت بتستخدم cagr3y لنمو السعر. */
  revEgp: r.rev, revGrow: (r.revGrow != null ? r.revGrow : null),
  nameAr: r.name,
  /* ⭐ كل الحقول الجديدة — بمفاتيح صريحة */
  isFull: true,
  conf: r.conf, whyNote: r.why || '',
  partial: r.partial || [], missingSections: r.missing || [],
  sect: {q:r.q, v:r.v, m:r.m, sf:r.sf, lq:r.lq},
  sectorEn: r.sector, sectorAr: r.sectorAr,
  pack: r.pack, packNote: r.packNote, industry: r.industry,
  de: r.de, cr: r.cr, qr: r.qr, roic: r.roic, roaV: r.roa,
  grossMargin: r.gm, ebitda: r.ebitda, fcfV: r.fcf, debt: r.debtV,
  ps: r.ps, evEbitda: r.evEbitda, ni: r.ni, epsV: r.eps,
  macd: r.macd, macdSig: r.macdSig, relVolume: r.relvol, avgVol30: r.av30, av30: r.av30,
  /* 🔥 حقول الجودة — كانت مفقودة من OS_DB (نسبة الدين 50% · التداول 51%) */
  de: r.de, cr: r.cr, qr: r.qr, roaQ: r.roa, roic: r.roic, nm: r.nm, om: r.om,
  ebitda: r.ebitda, fcf: r.fcf, rev: r.rev, ni: r.ni,
  sharpe3y: r.sharpe3y, sharpe: r.sharpe3y, sortino3y: r.sortino3y,
  mdd: r.mdd, mdd1y: r.mdd1y, vol1y: r.vol1y, cagr3y: r.cagr3y, frm52hi: r.frm52hi,
  /* 📌 aliases — الفلاتر بتستخدم p و relvol و mc */ p: r.p, relvol: r.relvol, mc: r.mc,
  ebitdaQ: r.ebitda, debtQ: r.debt, fcfQ: r.fcf, gmQ: r.gm, psQ: r.ps, evQ: r.evEbitda,
  tvRec: r.tvRec, perf1m: r.perf1m, perf3m: r.perf3m, perf6m: r.perf6m, perf1y: r.perf1y, perfYtd: r.perfYtd,
  high52: r.h52, low52: r.l52, nextEarnings: r.nextErn, lastEarnings: r.lastErn,
  _live: !!live[code]
  } : {
  code,
  name  : r.n,
  nameEn: r.en,
  sector: r.s || '—',
  /* 🔴 نفس الباج — || بتبلع الـ0. r.price/r.change/r.volume احتياطي
     لو الشكل القديم مالوش p/c/v. */
  price : Number(lv.price ?? r.p ?? r.price ?? 0),
  change: Number(lv.change ?? r.c ?? r.change ?? 0),
  volume: Number(lv.volume ?? r.v ?? r.volume ?? 0),
  score : Number(lv.final_score || 0),
  decision: lv.decision || '',
  // ناقصة من المحرك ← نجيبها من السجل
  pe  : (lv.pe != null && lv.pe !== 0) ? lv.pe  : r.pe,
  peSrc : r.peSrc || '',
  pb  : (lv.pb != null && lv.pb !== 0) ? lv.pb  : r.pb,
  roe  : (lv.roe != null && lv.roe !== 0) ? lv.roe : r.roe,
  mcap  : lv.mkt_cap || lv.mktCap || r.mc,
  beta  : (lv.beta != null && lv.beta !== 0) ? lv.beta : r.b,
  yield : lv.div_yield != null && lv.div_yield !== 0 ? lv.div_yield : r.dy,
  debt  : lv.de_ratio != null && lv.de_ratio !== 0 ? lv.de_ratio : r.d,
  eps  : lv.eps || null,
  revenue : lv.revenue || r.rev,
  opMargin: lv.op_margin != null && lv.op_margin !== 0 ? lv.op_margin : r.om,
  netMargin: lv.net_margin != null && lv.net_margin !== 0 ? lv.net_margin : r.nm,
  perf1m: lv.perf_1m != null ? lv.perf_1m : r.p1m,
  perfY : lv.perf_y  != null ? lv.perf_y  : r.py,
  volatility: lv.volatility != null ? lv.volatility : r.vol,
  tvRating: lv.tv_rating != null ? lv.tv_rating : r.tv,
  relVolume: lv.rel_volume != null ? lv.rel_volume : r.rv,
  /* 🆕 startamarkets — المؤشرات الفنية والهو··ش (مفاتيح مختصرة) */
  /* 🆕 المخاطرة الحقيقية — من كامل تاريخ السهم المتاح (من Railway أو من ملفنا)
     ملاحظة: عمق التاريخ يختلف من سهم للتاني — أقدم سجل في المصدر 2000-11-27،
     وأحدث الأسهم تاريخها أقل من سنة. فمفيش رقم واحد ينطبق على الكل. */
  vol1y  : r.vol1y || (RK[code] ? RK[code].vol1y  : null),
  vol3y  : r.vol3y || (RK[code] ? RK[code].vol3y  : null),
  mdd  : r.mdd  || (RK[code] ? RK[code].mdd  : null),
  mdd1y  : r.mdd1y || (RK[code] ? RK[code].mdd1y  : null),
  sharpe3y : r.sharpe3y || (RK[code] ? RK[code].sharpe3y : null),
  sortino  : r.sortino3y || (RK[code] ? RK[code].sortino3y : null),
  cagr3y  : r.cagr3y || (RK[code] ? RK[code].cagr3y : null),
  frm52hi  : r.frm52hi || (RK[code] ? RK[code].frm52hi : null),
  rsi  : r.s_rsi,
  ma50  : r.s_ma50,
  ma200  : r.s_ma200,
  roa  : r.s_roa,
  dy2  : r.s_dy,
  freeFloat: r.s_flt,
  gm  : r.s_gm, pm : r.s_pm,
  /* ⚠ المسار القديم كان بيكتب rg = s_rg. الاسم ده هو اللي سبّب الباج
     (اتنين معنى لنفس الحقل) — الاسم الصريح هو revGrow. */
  revGrow : r.s_rg,  pg : r.s_pg,
  fcf  : r.s_fcf, bvps : r.s_bvps,
  nameAr  : r.name_ar || '',
  _live : !!live[code]
  };
  /* 🆕🆕 الحقول الكاملة من data_full.json (مفتاح صريح — ما يتعارضش مع التوليف) */
  if (fromFull){
  const F = EGX_DB[code];
  const put = (k,v) => { if (v !== null && v !== undefined && v !== '') F[k] = v; };
  /* 🔥 الاختصارات — دي اللي الفلاتر هتستخدمها */
  put('deRatio', r.de);  put('curRatio', r.cr);  put('quickRatio', r.qr);
  put('roaV',  r.roa);  put('roic',  r.roic);  put('netMargin', r.nm);
  put('opMargin2', r.om);  put('grossMargin', r.gm); put('ebitdaV', r.ebitda);
  put('fcfV',  r.fcf);  put('debtV',  r.debt);  put('ps',  r.ps);
  put('evEbitda', r.evEbitda); put('revV',  r.rev);  put('niV',  r.ni);
  put('epsV',  r.eps);
  /* القطاع: عربي + إنجليزي + الحزمة */
  put('sectorEn', r.sector);  put('sectorAr', r.sectorAr);
  put('pack', r.pack);  put('packNote', r.packNote);
  put('industry', r.industry);
  /* الف··ي والأداء */
  put('macd', r.macd);  put('macdSignal', r.macdSig);
  put('relVolume2', r.relvol); put('avgVol30', r.av30);
  put('tvRec',  r.tvRec);  put('float', r.float);
  put('perf1mV', r.perf1m);  put('perf3m', r.perf3m);
  put('perf6mV', r.perf6m);  put('perf1yV', r.perf1y);
  put('perfYtd', r.perfYtd);
  put('high52', r.h52);  put('low52', r.l52);
  /* ⭐ التقييم الجديد — بالثقة والبوابات */
  put('score',  r.total);
  put('scoreConf', r.conf);
  put('decision', r.verdict);
  put('whyNote', r.why || '');
  put('partial', r.partial || []);
  put('missingSections', r.missing || []);
  put('sections', {q:r.q, v:r.v, m:r.m, sf:r.sf, lq:r.lq});
  put('qScore', r.q);
  put('vScore', r.v); put('mScore', r.m); put('sfScore', r.sf); put('lqScore', r.lq);
  /* 📅 الأحداث */
  put('nextEarnings', r.nextErn);
  put('lastEarnings', r.lastErn);
  }
  }
  EGX_META = { ts: f._ts, src: f._src, total: Object.keys(EGX_DB).length,
  live: Object.values(EGX_DB).filter(s => s._live).length,
  isFull: !!fromFull, sectorMed: f._sectorMed || null,
  /* ⛔ ٢١ أكتوبر: نحفظ rankRows هنا — octaLoadDB بيقراها
  ⛌ في fallback (لو data_full رجع null). */
  rankRows: rankRows };
  console.log('📚 سجل EGX:', EGX_META);
  return EGX_DB;
  } catch(e) {
  console.warn('⚠️ سجل EGX:', e.message);
  return null;
  }
}

async function octaLoadDB(){
  if (OS_READY) return OS_DB;

  // ① المحرك الحي (الأسماء العربية + القرار)  ② السجل الكامل (285 سهم)
  /* ⛔ ٢١ أكتوبر: loadEgxFile بقى هو نفسه بيطلب /api/rank
  ⛌ فمفيش داعي نطلبه تاني هنا — الطلب المزدوج كان بيضيّع التوكن. */
  const [rankRes, full] = await Promise.all([
  Promise.resolve({ results: [] }),
  loadEgxFile()
  ]);

  /* 🎯 الدرجات بقت في EGX_DB نفسها (من loadEgxFile).
  ⛌ هنا بنبني OS_DB من EGX_DB — فمفيش طلب إضافي.
  ⛌ ⛌ مهم: fallback السطر الجاي بقى محتاج rankRows لو الـfull رجع null. */
  const apiRows = (EGX_META && EGX_META.rankRows) || [];
  const live = {};
  for (const s of apiRows) if (s && s.code) live[s.code] = s;

  // لو السجل مو··ودش ← نرجع للسلوك القديم (الـ API بس)
  if (!full) {
  OS_DB = apiRows.map(s => ({ code:s.code, name:OCTA_NAME_FIX[s.code]||s.name||s.code, sector:s.sector||'—',
  price:Number(s.price??0), change:Number(s.change??0),
  score:Number(s.final_score??s.score??0), decision:s.decision||'—', _live:true }));
  /* ⛔⛔ الداتا الكاملة بقت محمية بالتوكن. لو الطلب راح 401
  (يعني لسه داخل والUCE كاش ماكانش موجود) متقفلش الكاش هنا —
  وإلا أول ضغطة بعد الدخول هتفضل 30 سهم لحد ما يعمل refresh.
  القاعدة: الكاش يتقفل بس لما يبقى فيه توكن صالح. */
  try { OS_READY = !!localStorage.getItem('octa_token'); }
  catch (e) { OS_READY = true; }
  return OS_DB;
  }

  /* 🆕 التطبيع اتعمل في loadEgxFile — هنا بنقرأ مباشرة */
  const isFull = !!(EGX_META && EGX_META.isFull);
  const codes = Object.keys(full);
  OS_DB = codes.map(c => {
  const f = full[c], l = live[c] || {};
  const F = f.isFull;  /* data_full اتعمله تطبيع */
  return {
  code: c, name: OCTA_NAME_FIX[c] || f.name || c, nameEn: f.nameEn || '', sector: f.sectorAr || f.sector || '—',
  /* 🔴|| بتعتبر الرقم 0 قيمة "فاضية" فترجع للقديم.
     التغيّر 0.00% رقم صحيح مش ناقص — ولما السهم ثابت اليوم الـlive بيرجع
     0 فكده بنعرض النسبة القديمة الغلط.
     الحل: ?? بتعمل fallback بس لو الحقل null/undefined مش 0. */
  price: Number(l.price ?? f.price ?? 0),
  change: Number(l.change ?? f.change ?? 0),
  volume: Number(l.volume ?? f.volume ?? 0),
  /* 🔴 60 سهم من 290 مالهمش حقل change أصلاً (مؤقفة/جديدة).
     لو رجعنا 0 كـfallback، الواجهة هتعرض «+0.00%» وده **رقم مخترع**.
     فبنعلّم السطر ده: changeHas = القيمة دي حقيقية ولا مش موجودة.
     0 الحقيقي = changeHas true (وده صح، السهم ثابت فعلاً). */
  changeHas: (l.change ?? f.change) != null,
  volumeHas: (l.volume ?? f.volume) != null,
  /* ⛔⛔⛔ ٢١ أكتوبر ٢٠٢٦ — إصلاح جذرري
  ⛌ كان: score: F ? f.score : l.final_score
  ⛌ الشرط F (isFull) كان false دايماً لأن _isFullShape كان بيفحص
  ⛌ حقول مخبيّة (total/verdict) ⇒ فLocation لـ else (API).
  ⛌ بعد ما صلّحنا _isFullShape، F بقى true ⇒ رجع لـf.score اللي
  ⛌ مش موجود في data_full (لأنه اتخفي!) ⇒ الدرجة = 0 وطلعت «—».
  ⛌ ⛌ الحل: مش بنشترط F. الدرجة من الـrank المحمي (l) هي
  ⛌ الأصح دايماً — لأنها محسوبة لحظياً وفيها التوصية. */
  score: Number(l.final_score ?? l.score ?? f.score ?? f.total ?? 0),
  decision: (l.decision || f.decision || f.verdict || '—'),
  /* ⭐ الحقول الجديدة ··من data_full */
  scoreConf: f.conf, whyNote: f.why || '',
  partial: f.partial || [], missingSections: f.missing || [],
  /* ⚠ الأرقام دي متخزّنة جوه EGX_DB كـ f.sect مش f.q.
  الخريطة القديمة كانت بتقرا f.q فكانت sect بتطلع كلها null
  والفلاتر اللي بتعتمد عليها مش شغالة. */
  sect: f.sect || f.sections || {q:f.q, v:f.v, m:f.m, sf:f.sf, lq:f.lq},
  sectorEn: f.sector || '', sectorAr: f.sectorAr || f.sector || '',
  pack: f.pack || '', packNote: f.packNote || '', industry: f.industry,
  deRatio: f.de, curRatio: f.cr, quickRatio: f.qr, roic: f.roic, roaV: f.roa,
  grossMargin: f.gm, ebitdaV: f.ebitda, fcfV: f.fcf, debtV: f.debt,
  ps: f.ps, evEbitda: f.evEbitda, revV: f.rev, niV: f.ni, epsV: f.eps,
  macd: f.macd, macdSignal: f.macdSig, relVolume2: f.relvol, avgVol30: f.av30, av30: f.av30,
  /* 🔥 حقول الجودة */
  de: f.de, cr: f.cr, qr: f.qr, roaQ: f.roaQ, roic: f.roic, nm: f.nm, om: f.om,
  p: f.p, relvol: f.relvol, mc: f.mcap,
  ebitdaQ: f.ebitdaQ, debtQ: f.debtQ, fcfQ: f.fcfQ, gmQ: f.gmQ, psQ: f.psQ, evQ: f.evQ,
  tvRec: f.tvRec, perf1m: f.perf1m, perf3m: f.perf3m, perf6mV: f.perf6m, perf1yV: f.perf1y, perfYtd: f.perfYtd,
  high52: f.h52, low52: f.l52, nextEarnings: f.nextErn, lastEarnings: f.lastErn,
  pe: f.pe, peSrc: f.peSrc || '', pb: f.pb, roe: f.roe, mcap: f.mcap, beta: f.beta,
  yield: f.yield, dy: f.yield,  /* 🎁 نفس القيمة بمفتاحين */
  debt: f.debt, eps: f.eps, revenue: f.revenue,
  opMargin: f.opMargin, netMargin: f.netMargin,
  perf1m: f.perf1m, perfY: f.perfY, volatility: f.volatility,
  tvRating: f.tvRating, relVolume: f.relVolume,
  /* 🆕 الحقول الجديدة (startamarkets) — المؤشرات الفنية والهوامش */
  rsi: f.rsi, ma50: f.ma50, ma200: f.ma200, roa: f.roa,
  /* 🎁 توزيعات — data_full بيستخدم dy */ dy: f.yield != null ? f.yield : f.dy,
  vol1y: f.vol1y, vol3y: f.vol3y, mdd: f.mdd, mdd1y: f.mdd1y,
  sharpe: f.sharpe3y, sharpe3y: f.sharpe3y, sortino: f.sortino, sortino3y: f.sortino3y,
  mdd: f.mdd, mdd1y: f.mdd1y, vol1y: f.vol1y, cagr3y: f.cagr3y, frm52hi: f.frm52hi,
  freeFloat: f.float, gm: f.gm, om: f.om, pm: f.pm,
  /* ⚠ نفس القاعدة: rg هنا كان = f.rg وده مش موجود في الشكل القديم أصلاً.
     الحقل الحقيقي في المسار ده اسمه s_rg = نمو الإيراد %. */
  revEgp: f.rev != null ? f.rev : f.revenue, revGrow: (f.s_rg != null ? f.s_rg : null),
  pg: f.s_pg != null ? f.s_pg : f.pg, fcf: f.fcf, bvps: f.bvps,
  nameAr: f.name_ar || '',
  _live: !!live[c]
  };
  }).filter(s => s.price > 0);

  OS_META = EGX_META;
  OS_READY = true;
  console.log(`✅ بحث OCTA: ${OS_DB.length} سهم (${Object.keys(live).length} live من المحرك · ${EGX_META.total - Object.keys(live).length} من السجل)`);
  return OS_DB;
}

function octaEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function octaCol(v){ return v>0?'var(--sec)':(v<0?'var(--red2)':'var(--muted)'); }

async function octaInit(){
  const q = document.getElementById('osQuick');
  if (q) q.innerHTML = OCTA_QUICK.map(c => `<button class="os-chip" onclick="octaPick('${c}')">${c}</button>`).join('');

  await octaLoadDB();
  const hint = document.getElementById('osHint');
  if (hint) {
  const live = OS_DB.filter(s => s._live).length;
  hint.innerHTML = '<b>' + OS_DB.length + '</b> سهم في البورصة المصرية · <b>' + live +
  '</b> بيقيّمهم محرك OCTA لحظياً' +
  (OS_META && OS_META.ts ? ' · السجل: ' + OS_META.ts : '');
  }

  octaSectors();
  octaTop();
  if (!OS_DB.length) {
  const t = document.getElementById('osTop');
  if (t) t.innerHTML = '<div class="os-empty">⛔ تعذر تحميل قائمة الأسهم — تأكد من الإنترنت وجرّب تحديث الصفحة.</div>';
  }
}

function octaSectors(){
  const box = document.getElementById('osSectors');
  if (!box) return;
  const secs = [...new Set(OS_DB.map(s => s.sector).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  box.innerHTML =
  '<div class="os-sec-h">🗂️ أقسام البورصة <span class="os-sec-s">اضغط عشان تفلتر النتائج والأفضل</span></div>' +
  '<div class="os-chips">' +
  `<button class="os-chip ${OS_SECT==='all'?'on':''}" onclick="octaSetSect('all',this)">الكل (${OS_DB.length})</button>` +
  secs.map(s => `<button class="os-chip" onclick="octaSetSect('${octaEsc(s)}',this)">${octaEsc(s)}</button>`).join('') +
  '</div>';
}
function octaSetSect(s, el){
  OS_SECT = s;
  document.querySelectorAll('#osSectors .os-chip').forEach(c => c.classList.remove('on'));
  if (el) el.classList.add('on');
  octaTop();
  const inp = document.getElementById('osInput');
  if (inp && inp.value.trim()) octaQ(inp.value);
}

/* سطر البيانات الأساسية تحت كل سهم — بيوضح مصدر الرقم */
function fundLine(s){
  const bits = [];
  if (s.pe)  bits.push('<span title="' + (s.peSrc === 'source' ? 'من المصدر' : 'محسوب: ' + (s.peSrc === 'calc_eps' ? 'السعر ÷ EPS' : 'القيمة السوقية ÷ صافي الربح')) + '">P/E ' + Number(s.pe).toFixed(1) +
  (s.peSrc && s.peSrc !== 'source' ? ' <i class="os-calc">محسوب</i>' : '') + '</span>');
  if (s.roe != null && s.roe !== 0) bits.push('<span>ROE ' + Number(s.roe).toFixed(0) + '%</span>');
  if (s.mcap) bits.push('<span>قيمة ' + octaFmtCap(s.mcap) + '</span>');
  return bits.length ? bits.join('<span class="os-sep">·</span>') : '<span class="os-none">البيانات المالية غير متاحة</span>';
}
function octaFmtCap(v){
  const n = Number(v)||0;
  return n >= 1e9 ? (n/1e9).toFixed(1) + ' مليار'
  : n >= 1e6 ? (n/1e6).toFixed(0) + ' مليون' : String(Math.round(n));
}

function octaTop(){
  const box = document.getElementById('osTop'); if (!box) return;
  let list = OS_SECT === 'all' ? OS_DB.slice() : OS_DB.filter(s => s.sector === OS_SECT);
  list.sort((a,b) => b.score - a.score);
  const top = list.slice(0, 12);
  const sub = document.getElementById('osTopSub');
  if (sub) sub.textContent = OS_SECT === 'all' ? 'الأعلى نتيجة من ' + OS_DB.length + ' سهم' : OS_SECT + ' · ' + list.length + ' سهم';
  if (!top.length) { box.innerHTML = '<div class="os-empty">مفيش أسهم في القسم ده.</div>'; return; }
  box.innerHTML = top.map(s => {
  const col = octaCol(s.score >= CFG.th.safe ? 1 : (s.score >= CFG.th.mid ? 0 : -1));
  const dc = s.decision.includes('إشارة إيجابية')||s.decision.includes('شراء') ? 'var(--sec)'
  : s.decision.includes('إشارة سلبية')||s.decision.includes('إشارة سلبية') ? 'var(--red2)' : 'var(--sec2)';
  const dbg = s.decision.includes('إشارة إيجابية')||s.decision.includes('شراء') ? 'rgba(22,199,154,.16)'
  : s.decision.includes('إشارة سلبية')||s.decision.includes('إشارة سلبية') ? 'rgba(255,82,82,.16)' : 'rgba(77,171,247,.16)';
  return '<div class="os-card" onclick="octaPick(\'' + s.code + '\')">' +
  '<div class="os-c-code">' + octaEsc(s.code) + '</div>' +
  '<div class="os-c-name">' + octaEsc(s.name) + '</div>' +
  '<div class="os-c-score" style="color:' + col + '">' + (s.score || '—') + '</div>' +
  '<div class="os-c-dec" style="color:' + dc + ';background:' + dbg + '">' + octaEsc(s.decision || '—') + '</div>' +
  '<div class="os-c-fund">' + fundLine(s) + '</div>' +
  '</div>';
  }).join('');
}

function octaQ(q){
  q = String(q || '').trim();
  const box = document.getElementById('osResults');
  const clr = document.getElementById('osClear');
  if (clr) clr.classList.toggle('on', !!q);
  if (!box) return;
  if (!q) { box.classList.remove('open'); OS_LIST = []; OS_SEL = -1; return; }
  if (!OS_DB.length) octaLoadDB().then(() => octaQ(q));
  const up = q.toUpperCase();
  OS_LIST = OS_DB.filter(s =>
  (s.code||'').toUpperCase().includes(up) ||
  (s.name||'').toUpperCase().includes(up) ||
  (s.sector||'').includes(q)
  ).filter(s => OS_SECT === 'all' || s.sector === OS_SECT).slice(0, 30);

  if (!OS_LIST.length) {
  box.innerHTML = '<div class="os-empty">لا توجد نتائج لـ "' + octaEsc(q) + '"<br>' +
  '<span style="font-size:.78rem">جرّب الكود (COMI) أو جزء من الاسم (بنك) أو اسم القسم</span></div>';
  box.classList.add('open'); OS_SEL = -1; return;
  }
  box.innerHTML = OS_LIST.map((s,i) => {
  const col = octaCol(s.change);
  return '<div class="os-row' + (i===OS_SEL?' sel':'') + '" data-i="' + i + '" onclick="event.stopPropagation();octaPick(\'' + s.code + '\')">' +
  '<div class="os-badge">' + (s.code||'').slice(0,3) + '</div>' +
  '<div class="os-info"><div class="os-code">' + octaEsc(s.code) + '</div>' +
  '<div class="os-name">' + octaEsc(s.name) + '</div>' +
  '<div class="os-sect">' + octaEsc(s.sector) + '</div></div>' +
  '<div class="os-pr"><div class="os-p" style="color:' + col + '">' + (s.price ? s.price.toFixed(2) : '—') + '</div>' +
  '<div class="os-c" style="color:' + col + '">' + (s.change>=0?'▲ +':'▼ ') + Number(s.change||0).toFixed(2) + '%</div></div>' +
  '</div>';
  }).join('');
  box.classList.add('open');
}

function octaHi(){
  document.querySelectorAll('#osResults .os-row').forEach((r,i) => r.classList.toggle('sel', i === OS_SEL));
  const s = document.querySelector('#osResults .os-row.sel');
  if (s) s.scrollIntoView({ block: 'nearest' });
}

function octaKey(e){
  const box = document.getElementById('osResults');
  if (e.key === 'ArrowDown') { e.preventDefault(); if (box.classList.contains('open')) OS_SEL = Math.min(OS_SEL+1, OS_LIST.length-1); octaHi(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); OS_SEL = Math.max(OS_SEL-1, 0); octaHi(); }
  else if (e.key === 'Enter') {
  e.preventDefault();
  const i = OS_SEL >= 0 ? OS_SEL : 0;
  if (OS_LIST[i]) octaPick(OS_LIST[i].code);
  else octaQ(document.getElementById('osInput').value); // مفيش نتائج → جرّب الكود زي ما هو
  }
  else if (e.key === 'Escape') { if (box) box.classList.remove('open'); }
}

function octaClear(){
  const i = document.getElementById('osInput');
  if (i) { i.value = ''; i.focus(); }
  octaQ('');
}

function octaPick(code){
  code = String(code || '').trim().toUpperCase();
  if (!code) return;
  OS_ORIGIN = 'octasearch';  // عشان زر «رجوع» يرجعنا لصفحة البحث
  const box = document.getElementById('osResults');
  if (box) box.classList.remove('open');
  try {
  openStock(code);
  } catch (e) {
  console.error('openStock FAILED:', e);
  const el = document.getElementById('siLoad');
  const sp = document.getElementById('stockPage');
  if (el && sp) {
  sp.style.setProperty('display', 'block', 'important');
  sp.classList.add('active');
  el.style.display = 'block';
  el.innerHTML = '<div style="color:var(--red2);padding:30px;text-align:center">❌ خطأ: ' + (e.message||'') + '</div>';
  }
  }
}

document.addEventListener('click', e => {
  const box = document.getElementById('osResults');
  const wrap = document.getElementById('osWrap');
  if (box && wrap && !wrap.contains(e.target)) box.classList.remove('open');
});


// ============ 🐙 OCTA ANALYSIS ENGINE ============
let AI_LOADING = false;

function renderAiLoading(code) {
  const barsEl = document.getElementById('engineBars');
  const dec = document.getElementById('engineDecision');
  if (barsEl) {
  barsEl.innerHTML = `
  <div style="text-align:center;padding:30px 16px;">
  <div style="font-size:2.6rem;animation:pulse 1.4s ease-in-out infinite;">🐙</div>
  <div style="color:var(--sec2);font-weight:800;margin-top:12px;">OCTA بيفكّر في ${code}...</div>
  <div style="color:var(--muted);font-size:0.84rem;margin-top:6px;">محرك OCTA بيحلل ٨ محاور</div>
  </div>`;
  }
  if (dec) dec.innerHTML = '';
}

async function fetchAiAnalysis(code) {
  if (!code) return;
  if (AI_LOADING) return;
  AI_LOADING = true;
  renderAiLoading(code);
  try {
  const res = await fetch(OCTA_API + '/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: code })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (data.error) {
  renderAiError(code, data.error);
  } else {
  renderAiResult(code, data);
  }
  } catch (e) {
  renderAiError(code, e.message);
  // retry مرة واحدة بعد 3 ثواني
  setTimeout(() => {
  if (currentEngineSymbol === code && !AI_LOADING) {
  AI_LOADING = false;
  fetchAiAnalysis(code);
  }
  }, 3000);
  } finally {
  AI_LOADING = false;
  }
}

function renderAiError(code, msg) {
  const barsEl = document.getElementById('engineBars');
  const dec = document.getElementById('engineDecision');
  if (barsEl) {
  barsEl.innerHTML = `
  <div style="text-align:center;padding:20px 16px;background:rgba(255,82,82,0.06);border:1px solid var(--red);border-radius:12px;">
  <div style="font-size:1.6rem;">⚠️</div>
  <div style="color:var(--red2);font-weight:800;margin-top:8px;">تعذر تحميل تحليل AI</div>
  <div style="color:var(--muted);font-size:0.76rem;margin-top:6px;direction:ltr;">${String(msg).slice(0, 80)}</div>
  <button onclick="AI_LOADING=false; fetchAiAnalysis('${code}')" style="margin-top:12px;background:rgba(212,175,55,0.2);color:var(--gold);padding:8px 18px;border-radius:100px;border:1px solid var(--gold);font-weight:700;font-size:0.82rem;cursor:pointer;">🔄 جرّب تاني</button>
  </div>`;
  }
  if (dec) dec.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:0.8rem;padding:10px;">⏳ محرك OCTA بيحلل — استنى — استنى أو اضغط Retry</div>`;
}

function renderAiResult(code, d) {
  const ax = d.axes || {};
  const AXIS_META = [
  ['technical', '🐙 التحليل الفني'],
  ['fundamental', '📊 الأساسي'],
  ['liquidity', '💧 السيولة'],
  ['news', '📰 الأخبار'],
  ['sentiment', '🧭 المعنويات'],
  ['risk', '🛡️ المخاطر'],
  ['portfolio', '💼 المحفظة'],
  ['overall', '🎯 التوافق']
  ];
  const scores = AXIS_META.map(([k, label]) => ({
  label: label,
  value: Math.max(0, Math.min(100, Number(ax[k] ?? 0))),
  source: 'AI'
  }));

  // السعر الحقيقي من TradingView/LIVE_PRICES إن وُجد، وإلا سعر محرك OCTA
  const live = LIVE_PRICES[code];
  const price = (live && live.price > 0) ? live.price : d.price;
  const change = (live && live.price > 0) ? live.change : d.change;

  renderEngineBars(scores, Number(ax.overall || 0), { d, price, change });
}

/* ⛔⛔ ٢٣ أكتوبر ٢٠٢٦ — قرار OCTA من الدرجة (fallback محلي).
📌 القواعد ثابتة ومش متغيرة (زي المحرك الأصلي):
· ٧٠+ → شراء
· ٥٠–٧٠ → تجميع
· أقل من ٥٠ → حذر
📌 ⛔ المشتقة من الدرجة دي، مش من ذكاء اصطناعي.
📌 ⛌ لو الباك رجّع قراره، بنستخدم قراره هو. */
function _octaDecisionFromScore(score) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  if (s >= 70) return 'شراء';
  if (s >= 50) return 'إشارة إيجابية';
  if (s >= 35) return 'إشارة محايدة';
  return 'إشارة سلبية';
}

function renderEngine() {
  // شغّل تحليل محرك OCTA للسهم الحالي
  const code = currentEngineSymbol;
  if (code) {
  fetchAiAnalysis(code);
  } else {
  // لو مفيش سهم محدد — استخدم أول واحد
  currentEngineSymbol = 'COMI';
  fetchAiAnalysis('COMI');
  }
}

function renderEnginePicker() {
  const el = document.getElementById('engineStockPicker');
  if (el) el.innerHTML = '';
}

function analyzeStock(code) {
  console.log('🔍 analyzeStock:', code);
  // نبحث في EGX_STOCKS (المتاح على TradingView) أولاً، ولو مش موجود نستخدم STOCKS
  let name = code;
  const egxStock = EGX_STOCKS.find(s => s.code === code);
  if (egxStock) name = egxStock.name;
  else {
  const oldStock = STOCKS.find(s => s.code === code);
  if (oldStock) name = oldStock.name;
  }
  const titleEl = document.querySelector('.engine-title');
  const subEl = document.querySelector('.engine-sub');
  if (titleEl) titleEl.textContent = `تحليل سهم: ${code}`;
  if (subEl) subEl.textContent = `${name} • EGX:${code} • تحليل محرك OCTA`;
  currentEngineSymbol = code;
  renderEngine();
  if (typeof loadEngineTVWidgets === 'function') loadEngineTVWidgets(code);
  if (!Object.keys(LIVE_PRICES).length) fetchLivePrices();
  const card = document.querySelector('.engine-card');
  if (card) card.scrollIntoView({behavior:'smooth',block:'start'});
}

// ============ جلب الأسعار الحقيقية من TradingView (Real-time) ============
let LIVE_PRICES = {}; // { code: { price, change, time } }

// ============ API الثابت (Railway backend) ============
/* OCTA_API بييجي من octa-api.js */

async function fetchLivePrices() {
  // 1) حاول تجيب من Railway API
  try {
  const res = await fetch(OCTA_API + '/api/prices?_=' + Date.now());
  if (res.ok) {
  const data = await res.json();
  const list = data.egx30 || [];
  let loaded = 0;
  list.forEach(s => {
  if (s.price > 0) {
  LIVE_PRICES[s.code] = { price: s.price, change: s.change };
  loaded++;
  }
  });
  if (loaded > 0) {
  console.log('✅ Live prices from Railway:', loaded, 'stocks');
  return;
  }
  console.warn('⚠️ Railway API رجّع 0 أسعار — نستخدم الكاش');
  }
  } catch (e) {
  console.warn('⚠️ Railway API failed:', e.message);
  }
  // 2) Fallback: الأسعار الثابتة في الجدول
  ENGINE_TABLE_DATA.forEach(s => {
  LIVE_PRICES[s.code] = { price: s.price, change: s.change };
  });
  console.log('ℹ️ Using cached table prices:', Object.keys(LIVE_PRICES).length);
}

// Update the displayed price in the table from LIVE_PRICES
function updateTablePrices() {
  if (!Object.keys(LIVE_PRICES).length) return;
  const tbody = document.getElementById('engineStocksTableBody');
  if (!tbody) return;
  // Find each price cell and update
  tbody.querySelectorAll('tr').forEach(row => {
  const code = row.getAttribute('data-code');
  if (code && LIVE_PRICES[code]) {
  const live = LIVE_PRICES[code];
  const priceCell = row.querySelector('.price-cell');
  const changeCell = row.querySelector('.change-cell');
  if (priceCell) priceCell.textContent = live.price.toFixed(2);
  if (changeCell) {
  const sign = live.change >= 0 ? '+' : '';
  changeCell.innerHTML = `${live.change >= 0 ? '▲' : '▼'} ${sign}${live.change.toFixed(2)}%`;
  }
  }
  });
}

// Auto-refresh كل 5 دقايق + لما المستخدم يفتح المحرك
function startEnginePriceAutoRefresh() {
  fetchLivePrices().then(() => {
  updateTablePrices();
  // Refresh every 5 minutes
  setInterval(() => {
  fetchLivePrices().then(() => updateTablePrices());
  }, 5 * 60 * 1000);
  });
}

// ============ TradingView Live (كل 30 ثانية) ============
// يجيب السعر والتغير من TradingView مباشرة
async function fetchLiveFromTradingView(code) {
  // Use a hidden iframe approach - load the mini-symbol-overview via TradingView's internal API
  // Alternative: just use the JSON approach for now (every 5 min is enough)
  return null; // placeholder
}

let livePriceInterval = null;

function startLivePriceUpdates() {
  // تحديث كل 30 ثانية
  if (livePriceInterval) clearInterval(livePriceInterval);
  livePriceInterval = setInterval(async () => {
  await refreshLivePrices();
  }, 30 * 1000);
}

async function refreshLivePrices() {
  // جلب من Railway API كل 30 ثانية
  try {
  const res = await fetch(OCTA_API + '/api/prices?_=' + Date.now());
  if (res.ok) {
  const data = await res.json();
  (data.egx30 || []).forEach(s => {
  if (!(s.price > 0)) return; // تخطي الأصفار
  const priceEl = document.getElementById('live-price-' + s.code);
  const changeEl = document.getElementById('live-change-' + s.code);
  if (priceEl) {
  const newPrice = s.price.toFixed(2);
  if (priceEl.textContent !== newPrice) {
  priceEl.textContent = newPrice;
  priceEl.classList.add('updating');
  setTimeout(() => priceEl.classList.remove('updating'), 600);
  }
  }
  if (changeEl) {
  const sign = s.change >= 0 ? '+' : '';
  const arrow = s.change >= 0 ? '▲' : '▼';
  const newChange = `${arrow} ${sign}${s.change.toFixed(2)}%`;
  if (changeEl.textContent !== newChange) {
  changeEl.textContent = newChange;
  changeEl.classList.toggle('negative', s.change < 0);
  changeEl.classList.add('updating');
  setTimeout(() => changeEl.classList.remove('updating'), 600);
  }
  }
  });
  }
  } catch (e) {
  console.warn('Live price update failed:', e);
  }
}

// جدول الأسهم الاحترافي (نفس الصور) ============
const ENGINE_TABLE_DATA = [
  { code: 'COMI', name: 'البنك التجاري الدولي', short: 'CIB', color: '#003d7a', bg: '#fff', price: 127.69, change: 1.10, volume: 31, trades: '5.64 ألف', value: '433M', valueNumber: 433, quantity: '3.41 مليون', percentage: '<span class="flt-ltr">77%</span>', sector: 'بنوك' },
  { code: 'TMGH', name: 'طلعت مصطفى', short: 'TMG', color: '#1a3a6b', bg: '#fff', price: 87.70, change: 0.83, volume: 22, trades: '6.48 ألف', value: '229M', valueNumber: 229, quantity: '2.61 مليون', percentage: '<span class="flt-ltr">87%</span>', sector: 'عقارات' },
  { code: 'HRHO', name: 'إي إف جي القابضة', short: 'EFG', color: '#003366', bg: '#fff', price: 24.20, change: 1.68, volume: 4, trades: '1.69 ألف', value: '91M', valueNumber: 91, quantity: '3.76 مليون', percentage: '<span class="flt-ltr">98%</span>', sector: 'خدمات مالية' },
  { code: 'ISPH', name: 'ابن سينا فارما', short: 'EPI', color: '#00897b', bg: '#fff', price: 11.70, change: 1.74, volume: 661, trades: '4.89 ألف', value: '121M', valueNumber: 121, quantity: '10.44 مليون', percentage: '<span class="flt-ltr">193%</span>', sector: 'أدوية' },
  { code: 'QNBE', name: 'بنك قطر الوطني الأهلي', short: 'QNB', color: '#7b1fa2', bg: '#fff', price: 59.25, change: 2.16, volume: 40, trades: '7M', value: '122.50 ألف', valueNumber: 122.5, quantity: '299', percentage: '<span class="flt-ltr">30%</span>', sector: 'بنوك' },
  { code: 'MNHD', name: 'إعمار مصر للتنمية', short: 'EM', color: '#d32f2f', bg: '#fff', price: 39.02, change: 2.31, volume: 2, trades: '636.60 ألف', value: '431', valueNumber: 0.431, quantity: '25M', percentage: '<span class="flt-ltr">84%</span>', sector: 'عقارات' },
  { code: 'VLMRA', name: 'فالمور القابضة للاستثمار', short: 'V', color: '#388e3c', bg: '#fff', price: 29.70, change: 2.41, volume: 334, trades: '1.66 مليون', value: '1.10 ألف', valueNumber: 1.1, quantity: '49M', percentage: '<span class="flt-ltr">79%</span>', sector: 'خدمات مالية' },
  { code: 'DSCW', name: 'دايس للملابس', short: 'DS', color: '#5d4037', bg: '#fff', price: 1.70, change: 3.03, volume: 2, trades: '20.71 مليون', value: '1.40 ألف', valueNumber: 1.4, quantity: '35M', percentage: '<span class="flt-ltr">165%</span>', sector: 'صناعة' },
  { code: 'CIRA', name: 'القاهرة للاستثمار', short: 'CI', color: '#6a1b9a', bg: '#fff', price: 39.29, change: 3.18, volume: 4, trades: '407.87 ألف', value: '549', valueNumber: 0.549, quantity: '16M', percentage: '<span class="flt-ltr">42%</span>', sector: 'استثمار' },
  { code: 'FWRY', name: 'فوري لتكنولوجيا البنوك', short: 'FW', color: '#fbc02d', bg: '#fff', price: 18.85, change: 3.29, volume: 3, trades: '7.26 مليون', value: '6.24 ألف', valueNumber: 6.24, quantity: '136M', percentage: '<span class="flt-ltr">116%</span>', sector: 'تكنولوجيا' },
  { code: 'ORHD', name: 'أوراسكوم للتنمية مصر', short: 'OR', color: '#1a3a6b', bg: '#fff', price: 38.90, change: 3.48, volume: 2, trades: '2.29 مليون', value: '3.75 ألف', valueNumber: 3.75, quantity: '88M', percentage: '<span class="flt-ltr">59%</span>', sector: 'عقارات' },
  { code: 'ETEL', name: 'المصرية للاتصالات', short: 'WE', color: '#6a1b9a', bg: '#fff', price: 138.71, change: 3.51, volume: 145, trades: '3.68 مليون', value: '966.22 ألف', valueNumber: 966.22, quantity: '132M', percentage: '<span class="flt-ltr">43%</span>', sector: 'اتصالات' },
  { code: 'CLHO', name: 'مستشفى كليوباترا', short: 'CH', color: '#0097a7', bg: '#fff', price: 15.70, change: 3.63, volume: 2, trades: '1.52 مليون', value: '1.40 ألف', valueNumber: 1.4, quantity: '22M', percentage: '<span class="flt-ltr">37%</span>', sector: 'صحة' },
  { code: 'CCAP', name: 'القلعة القابضة', short: 'CA', color: '#5e35b1', bg: '#fff', price: 6.88, change: 3.77, volume: 245, trades: '112.11 مليون', value: '5.08 ألف', valueNumber: 5.08, quantity: '765M', percentage: '<span class="flt-ltr">88%</span>', sector: 'استثمار' },
  { code: 'ORAS', name: 'أوراسكوم', short: 'OA', color: '#1565c0', bg: '#fff', price: 819.99, change: 3.78, volume: 15, trades: '142.57 ألف', value: '2.25 ألف', valueNumber: 2.25, quantity: '116M', percentage: '<span class="flt-ltr">47%</span>', sector: 'استثمار' },
  { code: 'ORWE', name: 'النساجون الشرقيون', short: 'OW', color: '#8d6e63', bg: '#fff', price: 27.84, change: 4.27, volume: 345, trades: '863', value: '1.41 مليون', valueNumber: 1.41, quantity: '38M', percentage: '<span class="flt-ltr">72%</span>', sector: 'صناعة' },
  { code: 'BONY', name: 'بنيان', short: 'B', color: '#212121', bg: '#fff', price: 4.09, change: 5.14, volume: 3, trades: '3.75 ألف', value: '1.37 ألف', valueNumber: 1.37, quantity: '24M', percentage: '<span class="flt-ltr">65%</span>', sector: 'عقارات' },
  { code: 'EFIH', name: 'إي فاينانس', short: 'eF', color: '#e53935', bg: '#fff', price: 23.40, change: 5.31, volume: 2, trades: '1.85 ألف', value: '2.08 مليون', valueNumber: 2.08, quantity: '47M', percentage: '<span class="flt-ltr">87%</span>', sector: 'تكنولوجيا' },
  { code: 'RACC', name: 'رايا كاستومر إكسبرينس', short: 'R', color: '#00838f', bg: '#fff', price: 9.32, change: 5.31, volume: 500, trades: '576.97 ألف', value: '521', valueNumber: 0.521, quantity: '5M', percentage: '<span class="flt-ltr">43%</span>', sector: 'عقارات' },
  { code: 'AMOC', name: 'الإسكندرية لمنتجات البترول', short: 'AM', color: '#ff6f00', bg: '#fff', price: 14.05, change: 5.72, volume: 15, trades: '3.63 ألف', value: '13.52م', valueNumber: 13.52, quantity: '187M', percentage: '<span class="flt-ltr">116%</span>', sector: 'بترول' },
  { code: 'RAYA', name: 'راية', short: 'R', color: '#1565c0', bg: '#fff', price: 6.65, change: 7.26, volume: 5, trades: '2.74 ألف', value: '8.80 مليون', valueNumber: 8.8, quantity: '58M', percentage: '<span class="flt-ltr">119%</span>', sector: 'تكنولوجيا' },
  { code: 'EXPA', name: 'البنك المصري لتنمية الصادرات', short: 'EX', color: '#c62828', bg: '#fff', price: 21.03, change: 0.53, volume: 1, trades: '1.85 مليون', value: '797', valueNumber: 0.797, quantity: '39M', percentage: '<span class="flt-ltr">111%</span>', sector: 'بنوك' }
];

let currentEngineSort = 'change';

function renderEngineStocksTable() {
  const tbody = document.getElementById('engineStocksTableBody');
  if (!tbody) return;
  // Sort
  const data = [...ENGINE_TABLE_DATA];
  if (currentEngineSort === 'change') {
  data.sort((a, b) => b.change - a.change);
  } else if (currentEngineSort === 'price') {
  data.sort((a, b) => b.price - a.price);
  } else if (currentEngineSort === 'volume') {
  data.sort((a, b) => b.volume - a.volume);
  }

  tbody.innerHTML = data.map(s => `
  <tr data-code="${s.code}" onclick="analyzeStock('${s.code}'); document.getElementById('engineSearch').value='${s.code}';">
  <td class="th-action"><span class="engine-stock-trash" title="سلة" onclick="event.stopPropagation()">🗑️</span></td>
  <td class="th-action"><span class="engine-stock-trash" title="إشعار" onclick="event.stopPropagation()">🔔</span></td>
  <td style="color: ${s.percentage.startsWith('-') ? 'var(--red2)' : (parseInt(s.percentage) > 100 ? 'var(--sec)' : 'var(--muted)')}; font-weight: 700;">${s.percentage}</td>
  <td>${s.quantity}</td>
  <td>${s.trades}</td>
  <td>${s.value}</td>
  <td>${s.volume.toLocaleString('en-US')}</td>
  <td class="change-cell">
  <div id="live-change-${s.code}" class="live-change-cell" data-code="${s.code}">▲ +${s.change.toFixed(2)}%</div>
  </td>
  <td class="price-cell">
  <div id="live-price-${s.code}" class="live-price-cell" data-code="${s.code}">${s.price.toFixed(2)}</div>
  </td>
  <td class="th-name" style="font-size: 0.82rem;">
  <div class="engine-stock-name-cell" style="display: flex; align-items: center; gap: 8px;">
  <span class="engine-stock-logo-circle" style="background: linear-gradient(135deg, ${s.color}, ${s.color}dd); color: #fff; font-weight: 800; box-shadow: 0 2px 6px ${s.color}40;">${s.short}</span>
  <span>${s.name}</span>
  </div>
  </td>
  <td class="th-code">
  <div class="engine-stock-code-cell" style="justify-content: center;">
  <span>${s.code}</span>
  </div>
  </td>
  </tr>
  `).join('');
}

function sortEngineStocks(criteria) {
  currentEngineSort = criteria;
  renderEngineStocksTable();
}

function filterEngineStocks(q) {
  q = q.trim().toLowerCase();
  const el = document.getElementById('engineStockPicker');
  console.log('🔍 filterEngineStocks:', q, 'el:', !!el);
  if (!el) {
  console.warn('engineStockPicker element not found');
  return;
  }
  // لو مفيش query، نخفي الـ results
  if (!q) {
  el.innerHTML = '';
  return;
  }
  // نستخدم EGX_STOCKS (المتاح على TradingView)
  const f = EGX_STOCKS.filter(s =>
  s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
  );
  if (f.length === 0) {
  el.innerHTML = '<div style="padding: 12px; color: var(--muted); text-align: center;">لا توجد نتائج لـ "' + q + '"</div>';
  return;
  }
  el.innerHTML = f.slice(0, 12).map(s => `
  <div class="stock-row" onclick="analyzeStock('${s.code}'); document.getElementById('engineSearch').value=''; filterEngineStocks('');" style="cursor: pointer;">
  <div class="stock-icon">${s.code.substring(0,2)}</div>
  <div style="flex:1;"><div class="stock-code">${s.code}</div><div class="stock-name">${s.name}</div></div>
  <div style="color:var(--muted);font-size:0.78rem;">📊</div>
  </div>
  `).join('');
}

function renderStocks() {
  if (!document.getElementById('mostActiveList')) return;
  const sorted = [...STOCKS].sort((a,b) => parseFloat(b.vol)-parseFloat(a.vol));
  const top6 = sorted.slice(0,6);
  document.getElementById('mostActiveList').innerHTML = top6.map((s,i) => `
  <div class="stock-row" onclick="openStockModal('${s.code}')">
  <div class="stock-icon" style="background:linear-gradient(135deg,#d4af37,#f4d03f);color:#0a1929;">${i+1}</div>
  <div><div class="stock-code">${s.code}</div><div class="stock-name">${s.name}</div></div>
  <div class="stock-price">${s.price.toFixed(2)}</div>
  <div class="stock-change ${s.change>=0?'up':'down'}">${s.change>=0?'+':''}${s.change.toFixed(2)}%</div>
  </div>
  `).join('');
  document.getElementById('allStocksList').innerHTML = STOCKS.map(s => `
  <div class="stock-row" onclick="openStockModal('${s.code}')">
  <div class="stock-icon">${s.code.substring(0,2)}</div>
  <div><div class="stock-code">${s.code}</div><div class="stock-name">${s.name}</div></div>
  <div class="stock-price">${s.price.toFixed(2)}</div>
  <div class="stock-change ${s.change>=0?'up':'down'}">${s.change>=0?'+':''}${s.change.toFixed(2)}%</div>
  </div>
  `).join('');
}

function filterStocks(q) {
  q = q.trim().toLowerCase();
  const f = q ? STOCKS.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.sector.includes(q)) : STOCKS;
  document.getElementById('allStocksList').innerHTML = f.map(s => `
  <div class="stock-row" onclick="openStockModal('${s.code}')">
  <div class="stock-icon">${s.code.substring(0,2)}</div>
  <div><div class="stock-code">${s.code}</div><div class="stock-name">${s.name}</div></div>
  <div class="stock-price">${s.price.toFixed(2)}</div>
  <div class="stock-change ${s.change>=0?'up':'down'}">${s.change>=0?'+':''}${s.change.toFixed(2)}%</div>
  </div>
  `).join('');
}

function openIntelLegacy(code) {
  const s = STOCKS.find(x => x.code === code);
  if (!s) return;
  showModal(`
  <button class="modal-close" onclick="closeModal()">×</button>
  <h3>${s.code} — ${s.name}</h3>
  <div class="sub">${s.sector} • السهم المصري</div>
  <div style="background:rgba(212,175,55,0.1);border:1px solid var(--gold);border-radius:12px;padding:16px;text-align:center;margin-bottom:16px;">
  <div style="font-size:2.4rem;font-weight:900;color:var(--gold);">${s.price.toFixed(2)} EGP</div>
  <div style="color:${s.change>=0?'var(--sec)':'var(--red2)'};font-weight:800;margin-top:4px;">${s.change>=0?'▲':'▼'} ${Math.abs(s.change).toFixed(2)}%</div>
  </div>
  <h4>📊 بيانات أساسية</h4>
  <ul>
  <li><strong>القطاع:</strong> ${s.sector}</li>
  <li><strong>حجم التداول:</strong> ${s.vol}</li>
  <li><strong>P/E:</strong> ${s.pe}x</li>
  <li><strong>التوزيعات:</strong> ${s.div} ج (${s.yield.toFixed(2)}%)</li>
  </ul>
  <h4>🐙 تحليل OCTA</h4>
  <div class="example">
  <span class="lbl">قرار المحرك:</span>
  ${s.change>=0?'✅ شراء / تجميع':'⚠️ حذر / مراقبة'}<br>
  <span class="lbl">السبب:</span>
  السهم ${s.pe<10?'رخيص نسبياً (P/E منخفض)':s.pe<15?'مقبول التقييم':'غالي نسبياً'} 
  وعائد التوزيعات ${s.yield>3?'ممتاز':s.yield>1.5?'جيد':'ضعيف'}.
  </div>
  `);
}

function renderCompare(){
  /* الدالة القديمة اتستبدلت — بقا نوجّه للمقارنة الجديدة */
  if (typeof cmpInit === 'function') cmpInit();
}

function runCompare() {
  const c1 = document.getElementById('cmp1').value;
  const c2 = document.getElementById('cmp2').value;
  const c3 = document.getElementById('cmp3').value;
  const codes = [c1,c2,c3].filter(c => c);
  if (codes.length < 2) {
  document.getElementById('compareResult').innerHTML = '<p style="text-align:center;color:var(--muted);padding:30px;">اختار سهمين على الأقل للمقارنة</p>';
  document.getElementById('cmp-tv-3-wrap').style.display = 'none';
  return;
  }
  const stocks = codes.map(c => STOCKS.find(s => s.code === c));

  // تحديث TradingView widgets
  updateCompareTVWidgets(stocks);

  // الجدول
  let table = '<table class="compare-table"><thead><tr><th>المعيار</th>';
  stocks.forEach(s => table += `<th>${s.code}</th>`);
  table += '</tr></thead><tbody>';
  const rows = [
  { label:'الاسم', get:s=>s.name },
  { label:'القطاع', get:s=>s.sector },
  { label:'السعر (EGP)', get:s=>s.price.toFixed(2) },
  { label:'التغير %', get:s=>`<span style="color:${s.change>=0?'var(--sec)':'var(--red2)'};font-weight:800;">${s.change>=0?'+':''}${s.change.toFixed(2)}%</span>` },
  { label:'P/E', get:s=>s.pe.toFixed(1)+'x' },
  { label:'التوزيعات', get:s=>s.div.toFixed(2)+' ج' },
  { label:'العائد', get:s=>s.yield.toFixed(2)+'%' },
  { label:'الحجم', get:s=>s.vol }
  ];
  rows.forEach(r => {
  table += `<tr><td class="row-label">${r.label}</td>`;
  stocks.forEach(s => table += `<td>${r.get(s)}</td>`);
  table += '</tr>';
  });
  table += '</tbody></table>';
  const winner = stocks.reduce((a,b) => a.yield>b.yield?a:b);
  const cheaper = stocks.reduce((a,b) => a.pe<b.pe?a:b);
  const perf = stocks.reduce((a,b) => a.change>b.change?a:b);
  table += `<div style="margin-top:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
  <div class="calc-result"><div class="lbl">🏆 أعلى توزيعات</div><div class="num" style="font-size:1.1rem;">${winner.code}</div></div>
  <div class="calc-result"><div class="lbl">💎 الأرخص</div><div class="num" style="font-size:1.1rem;">${cheaper.code}</div></div>
  <div class="calc-result"><div class="lbl">🚀 الأفضل أداءً</div><div class="num" style="font-size:1.1rem;">${perf.code}</div></div>
  </div>`;
  document.getElementById('compareResult').innerHTML = table;
}

// ============ COMPARE + TRADINGVIEW ============
function updateCompareTVWidgets(stocks) {
  // تنظيف الـ widgets القديمة
  document.querySelectorAll('script[data-cmp-tv]').forEach(s => s.remove());

  stocks.forEach((stock, i) => {
  const idx = i + 1;
  const wrap = document.getElementById('cmp-tv-3-wrap');
  if (idx === 3) wrap.style.display = 'block';

  const titleEl = document.getElementById(`cmp${idx}-title`);
  if (titleEl) titleEl.textContent = `${stock.code} — ${stock.name.substring(0, 20)}`;

  const container = document.getElementById(`cmp-tv-${idx}`);
  if (!container) return;
  container.innerHTML = '';

  setTimeout(() => {
  const script = document.createElement('script');
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
  script.async = true;
  script.setAttribute('data-cmp-tv', `cmp${idx}`);
  script.innerHTML = JSON.stringify({
  symbol: 'EGX:' + stock.code,
  width: '100%',
  height: 180,
  locale: 'ar',
  dateRange: '1D',
  colorTheme: 'dark',
  isTransparent: true,
  autosize: true
  });
  container.appendChild(script);
  }, idx * 100);
  });
}

function renderCalc(type = 'profit') {
  const c = CALCS[type];
  document.getElementById('calcContainer').innerHTML = `
  <h3 style="color:var(--gold);margin-bottom:16px;">${c.title}</h3>
  <div class="calc-form">
  ${c.fields.map(f => `<div><label>${f.label}</label><input type="number" id="cf-${f.id}" placeholder="${f.ph}" inputmode="decimal"></div>`).join('')}
  <button class="calc-btn" onclick="runCalc('${type}')">احسب</button>
  </div>
  <div id="calcResult"></div>
  `;
  document.querySelectorAll('.calc-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.calc-tab[data-calc="${type}"]`)?.classList.add('active');
}

function runCalc(type) {
  const c = CALCS[type];
  const v = {};
  c.fields.forEach(f => v[f.id] = parseFloat(document.getElementById('cf-'+f.id).value) || 0);
  if (Object.values(v).some(x => x === 0)) {
  document.getElementById('calcResult').innerHTML = '<p style="text-align:center;color:var(--red2);padding:16px;">⚠️ املا كل الحقول</p>';
  return;
  }
  const r = c.calc(v);
  document.getElementById('calcResult').innerHTML = r.map(x => `<div class="calc-result mb-8"><div class="num">${x.num}</div><div class="lbl">${x.lbl}</div></div>`).join('');
}

function renderArms() {
  document.getElementById('armsList').innerHTML = ARMS.map(a => `
  <div class="arm-card" onclick="openArmModal(${a.id})">
  <div class="arm-num">${a.num}</div>
  <div class="arm-info">
  <div class="arm-name">${a.name}</div>
  <div class="arm-desc">${a.desc}</div>
  </div>
  <div class="arm-arrow">←</div>
  </div>
  `).join('');
}

function openArmModal(id) {
  const a = ARMS.find(x => x.id === id);
  if (!a) return;
  showModal(`
  <button class="modal-close" onclick="closeModal()">×</button>
  <h3>${a.title}</h3>
  <div class="sub">${a.subtitle}</div>
  <div class="what">${a.what}</div>
  <h4>👀 بيراقب إيه؟</h4>
  <ul>${a.watches.map(w => `<li>${w}</li>`).join('')}</ul>
  <h4>💡 مثال</h4>
  <div class="example"><span class="lbl">الحقيقة:</span>${a.example}</div>
  `);
}

function openInvestorModal(id) {
  const inv = INVESTORS[id];
  if (!inv) return;
  showModal(`
  <button class="modal-close" onclick="closeModal()">×</button>
  <h3>${inv.name}</h3>
  <div class="sub">${inv.title}</div>
  <div class="what">${inv.bio}</div>
  <h4>📋 قواعده</h4>
  <ul>${inv.rules.map(r => `<li>${r}</li>`).join('')}</ul>
  <h4>💬 مقولته</h4>
  <div class="example">${inv.quote}</div>
  <h4>🏆 أشهر استثماراته</h4>
  <p style="color:var(--muted);">${inv.famous}</p>
  `);
}

function renderNews() {
  // لو في live news، استخدمها، وإلا اعرض الـ static كـ fallback
  const data = liveNews.length > 0 ? liveNews : NEWS.map(n => ({
  title: n.text, link: '#', pubDate: new Date().toISOString(),
  source: 'OCTA', sourceId: 'static', tag: n.tag, sector: 'عام',
  time: n.time
  }));

  let displayNews = data;
  if (newsFilter !== 'all') {
  // كلمات مفتاحية لكل filter
  const filterKeywords = {
  'بنوك': ['بنك', 'بنوك', 'مصرفي', 'cib', 'الأهلي', 'التجاري', 'قروض', 'ودائع', 'فائدة', 'ودائع'],
  'عقار': ['عقار', 'عقارات', 'إسكان', 'سكن', 'بناء', 'بناء', 'مقاولات', 'أراضي', 'شقق', 'فلل'],
  'اتصالات': ['اتصالات', 'هاتف', 'موبايل', 'إنترنت', '5G', 'فودافون', 'أورانج', 'we', 'اتصالات'],
  'طاقة': ['بترول', 'طاقة', 'كهرباء', 'غاز', 'بنزين', 'سولار', 'الوقود', 'البترول'],
  'صناعة': ['صناعة', 'كيماويات', 'أسمدة', 'حديد', 'صلب', 'إسمنت', 'الأسمنت', 'صناعي'],
  'تكنولوجيا': ['تكنولوجيا', 'برمجيات', 'ai', 'ذكاء اصطناع', 'بيانات', 'رقمي', 'تطوير', 'سوفت'],
  'أغذية': ['أغذية', 'غذاء', 'أكل', 'طعام', 'مشروبات', 'البان', 'ألبان'],
  'عام': []  // matches all
  };
  const keywords = filterKeywords[newsFilter] || [newsFilter];
  displayNews = data.filter(n => {
  const title = (n.title || '').toLowerCase();
  const sector = (n.sector || '').toLowerCase();
  const tag = (n.tag || '').toLowerCase();
  // Match لو الـ sector أو الـ tag أو أي keyword في العنوان
  return sector.includes(newsFilter.toLowerCase()) ||
  tag === newsFilter.toLowerCase() ||
  keywords.some(kw => title.includes(kw.toLowerCase()));
  });
  }

  if (displayNews.length === 0) {
  document.getElementById('newsList').innerHTML = `
  <div style="text-align: center; padding: 40px; color: var(--muted);">
  <div style="font-size: 3rem; margin-bottom: 12px;">📭</div>
  <div>لا توجد أخبار في هذا التصنيف</div>
  </div>
  `;
  return;
  }

  document.getElementById('newsList').innerHTML = displayNews.map(n => `
  <a href="${octaSafeUrl(n.link)}" target="_blank" rel="noopener" class="news-ticker" style="text-decoration: none; display: flex; gap: 12px; align-items: center;">
  <span class="news-time">${octaEsc(n.time ? n.time : formatTimeAgo(n.pubDate))}</span>
  <span class="news-tag">${octaEsc(n.tag)}</span>
  <span class="news-text" style="flex: 1;">${octaEsc(n.title)}</span>
  <span style="font-size: 0.7rem; color: var(--muted); white-space: nowrap;">${octaEsc((n.source || '').substring(0, 15))}</span>
  </a>
  `).join('');
}

function renderHome() {
  // 1) Top Movers (gainers by default)
  switchTMPeriod(TM_PERIOD);
  if (typeof TM_INTERVAL !== 'undefined') clearInterval(TM_INTERVAL);
  TM_INTERVAL = setInterval(renderTopMovers, 30000);
  // 2) Sector Heatmap
  renderSectorHeatmap();
  // 3) Fundamentals
  renderHomeFundamentals();
  // 4) Ticker (load TradingView widgets in background)
  initHomeTicker();
  loadTicker();
  setInterval(() => { if (!TICKER_PAUSED) loadTicker(); }, 60000);
  // 5) Live news (Yahoo Finance)
  loadHomeNews();
  // 6) Dividend calendar (يخدم كارت الرئيسية)
  if (typeof dvLoad === 'function') dvLoad();
}

// ════════ TOP MOVERS v3 ════════
let TM_PERIOD = 'change';
let TM_CACHE = null;
let TM_INTERVAL = null;
let TM_COLLAPSED = false;

const TM_LABEL = {
  change: 'يوم', perf_w: 'أسبوع', perf_1m: 'شهر',
  perf_3m: '٣ شهور', perf_6m: '٦ شهور', perf_y: 'سنة'
};

const TM_PHASE = {
  open: '🟢 السوق مفتوح',
  pre: '🕐 قبل الفتح',
  closed: '🔴 مقفول',
  weekend: '⚪ ويك إند'
};

function switchTopMovers(tab) {
  if (tab === 'gainers' || tab === 'losers') {
  switchTMPeriod(TM_PERIOD);
  return;
  }
  renderTopMovers();
}

function toggleTMCard() {
  TM_COLLAPSED = !TM_COLLAPSED;
  const split = document.getElementById('tm-split');
  const toggle = document.getElementById('tm-toggle');
  const chev = document.getElementById('tm-chevron');
  const sub = document.getElementById('tm-sub');
  if (!split || !toggle) return;

  split.classList.toggle('collapsed', TM_COLLAPSED);
  toggle.setAttribute('aria-expanded', String(!TM_COLLAPSED));
  if (sub) {
  sub.textContent = TM_COLLAPSED
  ? 'اضغط عشان تفتح'
  : 'أعلى 10 أسهم ارتفاعاً/انخفاضاً';
  }
  if (chev) chev.textContent = '▾';
}

function switchTMPeriod(p) {
  TM_PERIOD = p;
  document.querySelectorAll('.tm-period').forEach(b => {
  b.classList.toggle('active', b.dataset.period === p);
  });
  renderTopMovers();
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const s of (list || [])) {
  if (!s || !s.code) continue;
  if (seen.has(s.code)) continue;
  seen.add(s.code);
  out.push(s);
  }
  return out;
}

function tmRow(s, i, side) {
  const pct = Number(s[TM_PERIOD] || 0);
  const arrow = pct >= 0 ? '▲' : '▼';
  const sign = pct >= 0 ? '+' : '';
  return `
  <div class="tm-item" onclick="analyzeStock('${s.code}'); switchPage('engine');">
  <div class="tm-rank">${i + 1}</div>
  ${stockLogo(s.code)}
  <div class="tm-info">
  <div class="tm-code">${s.code}</div>
  <div class="tm-name">${s.name || ''}</div>
  </div>
  <div class="tm-num">
  <div class="tm-price">${Number(s.price || 0).toFixed(2)}</div>
  <div class="tm-pct">${arrow} ${sign}${pct.toFixed(2)}%</div>
  </div>
  </div>`;
}

async function renderTopMovers() {
  const g = document.getElementById('tm-gainers-list');
  const l = document.getElementById('tm-losers-list');
  if (!g || !l) return;

  const loading = '<div class="tm-empty">⏳ جاري التحميل...</div>';
  g.innerHTML = loading;
  l.innerHTML = loading;

  try {
  const res = await fetch(OCTA_API + '/api/prices?_=' + Date.now());
  const data = await res.json();
  const tm = (data.top_movers || {})[TM_PERIOD];

  let gainers = dedupe(tm?.gainers);
  let losers = dedupe(tm?.losers);

  // fallback: نحسب من egx30 لو الـ API لسه ما حسبش الفترة دي
  if (!gainers.length && data.egx30?.length) {
  const key = TM_PERIOD;
  const valid = data.egx30.filter(s =>
  s[key] !== null && s[key] !== undefined && s[key] !== 0
  );
  if (valid.length) {
  const desc = valid.sort((a, b) => b[key] - a[key]);
  gainers = dedupe(desc.slice(0, 10));
  losers = dedupe(desc.slice(-10).reverse());
  }
  }

  // الوقت والحالة فوق
  const timeEl = document.getElementById('tm-time');
  const phEl = document.getElementById('tm-phase');
  if (phEl) phEl.textContent = TM_PHASE[data.market_phase] || '⏳';
  if (timeEl) {
  timeEl.textContent = data.lastUpdate
  ? 'آخر تحديث ' + new Date(data.lastUpdate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  : '—';
  }

  TM_CACHE = { gainers, losers, phase: data.market_phase, period: TM_PERIOD };

  if (!gainers.length && !losers.length) {
  g.innerHTML = l.innerHTML = '<div class="tm-empty">⏳ السوق مقفول — استنى الفتح</div>';
  return;
  }

  g.innerHTML = gainers.length
  ? gainers.slice(0, 10).map((s, i) => tmRow(s, i, 'up')).join('')
  : '<div class="tm-empty">—</div>';
  l.innerHTML = losers.length
  ? losers.slice(0, 10).map((s, i) => tmRow(s, i, 'down')).join('')
  : '<div class="tm-empty">—</div>';

  } catch (e) {
  g.innerHTML = l.innerHTML = '<div class="tm-empty">⚠️ فشل الاتصال</div>';
  }
}

function renderSectorHeatmap() {
  // Sort stocks by change (descending) for treemap effect
  const data = [...STOCKS].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  
  // Calculate size and color based on change
  const maxAbsChange = Math.max(...data.map(s => Math.abs(s.change)), 1);
  
  const el = document.getElementById('home-sector-heatmap');
  if (!el) return;
  
  // Top row: large boxes (top 1-3 gainers/losers)
  el.innerHTML = `<div class="heatmap-treemap">` + data.slice(0, 12).map((s, i) => {
  const intensity = Math.min(Math.abs(s.change) / maxAbsChange, 1);
  const alpha = 0.3 + intensity * 0.5;
  const bg = s.change >= 0
  ? `rgba(22, 199, 154, ${alpha})`
  : `rgba(255, 82, 82, ${alpha})`;
  
  // Class for size
  let sizeClass = 'hm-small';
  if (i === 0) sizeClass = 'hm-large';
  else if (i < 3) sizeClass = 'hm-medium';
  
  return `
  <div class="heatmap-cell ${sizeClass}" style="background: ${bg};" onclick="analyzeStock('${s.code}'); switchPage('engine');">
  <div class="hm-code">${s.code}</div>
  <div class="hm-change">${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%</div>
  </div>
  `;
  }).join('') + `</div>`;
}

function renderHomeFundamentals() {
  const tbody = document.getElementById('home-fundamentals-tbody');
  if (!tbody) return;
  const top10 = STOCKS.slice(0, 10);
  tbody.innerHTML = top10.map(s => `
  <tr onclick="analyzeStock('${s.code}'); switchPage('engine');" style="cursor: pointer;">
  <td><strong style="color: var(--gold);">${s.code}</strong></td>
  <td>${s.pe.toFixed(1)}x</td>
  <td style="color: ${s.pe < 10 ? 'var(--sec)' : s.pe < 15 ? 'var(--gold2)' : 'var(--red2)'};">${(s.pe < 10 ? '🔥 رخيص' : s.pe < 15 ? '👍 مقبول' : '⚠️ غالي')}</td>
  <td>${(s.yield).toFixed(1)}%</td>
  <td>${s.div.toFixed(2)} EGP</td>
  </tr>
  `).join('');
}

// Placeholder functions for new features (to be implemented later)
function openPortfolioAdd() { alert('Portfolio Tracker - هيتم تطويره قريباً'); }
function openAlertAdd() { alert('Alerts - هيتم تطويره قريباً'); }
function openWatchlistAdd() { alert('Watchlist - هيتم تطويره قريباً'); }

// ============ TICKER (TradingView Live) ============
const TICKER_SYMBOLS = {
  'tk-gold': 'OANDA:XAUUSD',  // ذهب عالمي
  'tk-usd': 'EGP=X',  // دولار/جنيه
  'tk-egx': 'EGX:EGX30',  // EGX30
  'tk-oil': 'TVC:UKOIL',  // برنت
  'tk-goldoz': 'OANDA:XAUUSD',  // أونصة ذهب
  'tk-spx': 'SP:SPX'  // S&P 500
};

function initHomeTicker() {
  // نحمل TradingView Widgets الحقيقية لكل أصل
  loadTVQuoteWidget('tv-gold-quote', 'OANDA:XAUUSD', 'tk-gold', 'tk-gold-chg');
  loadTVQuoteWidget('tv-usd-quote', 'EGP=X', 'tk-usd', 'tk-usd-chg');
  loadTVQuoteWidget('tv-egx-quote', 'EGX:EGX30', 'tk-egx', 'tk-egx-chg');
  loadTVQuoteWidget('tv-oil-quote', 'TVC:USOIL', 'tk-oil', 'tk-oil-chg');
}

function loadTVQuoteWidget(containerId, symbol, valueId, changeId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  // نعمل widget صغير
  const widget = document.createElement('div');
  widget.className = 'tv-quote-widget';
  widget.innerHTML = `
  <div class="tv-quote-symbol">${symbol}</div>
  <div class="tv-quote-price" data-symbol="${symbol}">---</div>
  <div class="tv-quote-change" data-symbol="${symbol}">0%</div>
  `;
  container.appendChild(widget);
  // ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ جسر الـCORS
  // 📌 كان: fetch('https://www.tradingview-widget.com/api/v1/quote?...')
  // ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
  // ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ المتصفح بيمنع الرد (مش فيه ACAO) ⇒ "blocked by CORS"
  // ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ وكمان octa-api.js كان بيعيد توجيهه للـRailway ⇒ 405
  // ⛌ ⛌ ⛌ ⛌ ⛌ ⇒ نطلب من نفس الأصل (الـworker بيجيبه من الـedge) ⇒ مفيش CORS.
  fetch(`/api/tvquote?symbol=${encodeURIComponent(symbol)}`)
  .then(r => r.ok ? r.json() : null)
  .then(data => {
  if (data && data.v) {
  const price = data.v.lp; // last price
  const change = data.v.ch; // change %
  const trend = change >= 0 ? 'up' : 'down';
  const valueEl = document.getElementById(valueId);
  const changeEl = document.getElementById(changeId);
  if (valueEl) {
  valueEl.textContent = price.toLocaleString('en-US', {maximumFractionDigits: 2});
  // Style based on trend
  if (trend === 'up') {
  valueEl.style.color = 'var(--sec)';
  } else {
  valueEl.style.color = 'var(--red2)';
  }
  }
  if (changeEl) {
  const arrow = trend === 'up' ? '▲' : '▼';
  const sign = change >= 0 ? '+' : '';
  changeEl.textContent = `${arrow} ${sign}${change.toFixed(2)}%`;
  changeEl.className = 'ticker-change' + (change < 0 ? ' negative' : '');
  }
  // Update internal widget
  const wp = widget.querySelector('.tv-quote-price');
  const wc = widget.querySelector('.tv-quote-change');
  if (wp) wp.textContent = price.toFixed(2);
  if (wc) wc.textContent = change.toFixed(2) + '%';
  }
  })
  .catch(e => {
  // Fallback: استخدم Railway API
  fetch(OCTA_API + '/api/ticker?_=' + Date.now())
  .then(r => r.json())
  .then(data => {
  if (data.ticker) {
  const item = data.ticker.find(t => t.id === valueId.replace('tk-', 'tk-'));
  if (item) {
  const valueEl = document.getElementById(valueId);
  const changeEl = document.getElementById(changeId);
  if (valueEl) {
  valueEl.textContent = item.value.toLocaleString('en-US', {maximumFractionDigits: 2}) + (item.unit ? ' ' + item.unit : '');
  }
  if (changeEl) {
  const arrow = item.change >= 0 ? '▲' : '▼';
  const sign = item.change >= 0 ? '+' : '';
  changeEl.textContent = `${arrow} ${sign}${item.change.toFixed(2)}%`;
  }
  }
  }
  });
  });
}

// كل 30 ثانية نحدّث
setInterval(() => {
  ['tk-gold','tk-usd','tk-egx','tk-oil'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  // Animation بسيطة
  el.style.transition = 'color 0.3s';
  });
}, 30000);

// ============ NEWS (Yahoo Finance) ============
async function loadHomeNews() {
  const el = document.getElementById('home-news-per-stock');
  if (!el) return;
  try {
  // Use rss2json to fetch Yahoo Finance Egypt news
  // ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐ جسر الـCORS (نفس الأصل — مفيش CORS error)
  const url = `/api/rss?url=${encodeURIComponent('https://feeds.finance.yahoo.com/rss/2.0/headline?s=COMI.CA&region=CA')}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'ok' && data.items && data.items.length > 0) {
  el.innerHTML = data.items.slice(0, 5).map(n => `
  <a href="${octaSafeUrl(n.link)}" target="_blank" rel="noopener" class="news-ticker" style="text-decoration:none; display:flex; gap:10px; align-items:center; padding:8px 0; border-bottom:1px solid var(--line);">
  <span class="news-time">${new Date(n.pubDate).toLocaleTimeString('ar-EG', {hour:'2-digit',minute:'2-digit'})}</span>
  <span class="news-tag" style="font-size:0.7rem;">${octaEsc(n.categories?.[0] || 'YFinance')}</span>
  <span class="news-text" style="flex:1; font-size:0.85rem;">${octaEsc(n.title)}</span>
  </a>
  `).join('');
  } else {
  el.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 12px; font-size: 0.85rem;">📰 اضغط على أي سهم في المحرك عشان تشوف أخباره</p>';
  }
  } catch (e) {
  el.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 12px; font-size: 0.85rem;">📰 اضغط على أي سهم في المحرك عشان تشوف أخباره</p>';
  }
}

function showModal(c) {
  document.getElementById('modalContent').innerHTML = c;
  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

function openQuoteOfWeek() {
  showModal(`
  <button class="modal-close" onclick="closeModal()">×</button>
  <h3>💡 مقولة الأسبوع</h3>
  <div class="sub">حكمة من عمالقة الاستثمار</div>
  <div class="what" style="font-size:1.1rem;line-height:1.9;text-align:center;padding:20px;color:var(--gold);font-weight:800;">
  "كن خايف لما غيرك جريان، واجري لما غيرك خايف"
  </div>
  <div class="example"><span class="lbl">— وارن بافيت</span>لما السوق بيكبر والكل بيشتري، ده وقت الخطر. لما السوق بينزل والكل بيبيع، ده وقت الفرص.</div>
  `);
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('🐙 OCTA v35 starting...');
  try {
  renderHome(); renderEngine(); renderStocks(); renderCompare();
  renderCalc('profit'); renderArms(); renderNews();
  console.log('✅ OCTA v35 ready');
  } catch (e) { console.error('❌ OCTA error:', e); }
  // تحميل TradingView widgets للـ Engine من البداية
  setTimeout(() => {
  if (typeof loadEngineTVWidgets === 'function') {
  loadEngineTVWidgets(currentEngineSymbol);
  }
  }, 200);
  document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => switchPage(b.dataset.page)));
  /* 🧭 استرجاع الصفحة بعد الريفريش.
     ⛔ كان `setTimeout(..., 600)` — رقم متخمينه. لو البوابة أو
     أي سكربت اتأخر أكتر من ٦٠٠ مللي، الـrestore كان بيتلغى
     بصمت والصفحة بترجع رئيسية. دلوقتي OS_NAV.start() بيستنى
     **الشرط نفسه** (وجود العنصر) لحد ما يتحقق، بحدّ أقصى واضح. */
  OS_NAV.start();
  // شريط الأدوات والفلاتر
  if (typeof buildToolbar === 'function') buildToolbar();
  buildCredit();
  document.querySelectorAll('.calc-tab').forEach(t => t.addEventListener('click', () => renderCalc(t.dataset.calc)));
  const now = new Date();
  const t = `اليوم ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  const el = document.getElementById('lastUpdateTime');
  if (el) el.textContent = t;
  initScreener();
  initSearch();
  initBestPick();
  renderEngineStocksTable();
  startEnginePriceAutoRefresh();
  startLivePriceUpdates();
  // تحديث أولي فوري
  setTimeout(() => refreshLivePrices(), 1000);
});

// ============================================
// 3 NEW FEATURES: Stock Screener + Search + Best Pick
// ============================================

// ============ أكبر 50 سهم EGX متاحين على TradingView ============
const EGX_STOCKS = [
  // ============ 36 سهم EGX (مُصحّح من المستخدم) ============
  // البنوك
  { code: 'COMI', name: 'البنك التجاري الدولي', sector: 'البنوك' },
  { code: 'HDBK', name: 'بنك الإسكندرية', sector: 'البنوك' },
  { code: 'CIEB', name: 'بنك كريدى اجريكول مصر', sector: 'البنوك' },
  { code: 'FAIT', name: 'بنك فيصل الإسلامي', sector: 'البنوك' },
  // الاتصالات والتكنولوجيا
  { code: 'ETEL', name: 'المصرية للاتصالات - حقوق', sector: 'الاتصالات' },
  { code: 'EFIH', name: 'إي فاينانس للاستثمارات الرقمية', sector: 'التكنولوجيا' },
  { code: 'FWRY', name: 'فوري لتكنولوجيا البنوك', sector: 'التكنولوجيا' },
  // العقارات
  { code: 'PHDC', name: 'بالم هيلز للتعمير', sector: 'العقارات' },
  { code: 'TMGH', name: 'طلعت مصطفى', sector: 'العقارات' },
  { code: 'EMFD', name: 'إعمار مصر للتنمية', sector: 'العقارات' },
  { code: 'MNHD', name: 'مصر الجديدة للإسكان', sector: 'العقارات' },
  { code: 'ORHD', name: 'أوراسكوم للتنمية مصر', sector: 'العقارات' },
  // البتروكيماويات والأسمدة
  { code: 'ABUK', name: 'أبو قير للأسمدة', sector: 'الأسمدة' },
  { code: 'MFPC', name: 'مصر لإنتاج الأسمدة', sector: 'الأسمدة' },
  { code: 'SKPC', name: 'سيدي كرير للبتروكيماويات', sector: 'البتروكيماويات' },
  { code: 'EGCH', name: 'مصر للكيماويات', sector: 'البتروكيماويات' },
  { code: 'ALEX', name: 'أسمنت بورتلاند الإسكندرية', sector: 'الأسمنت' },
  // الصناعة
  { code: 'SWDY', name: 'السويدي إليكتريك', sector: 'الصناعة' },
  { code: 'EKHO', name: 'EK القابضة', sector: 'الصناعة' },
  { code: 'SUFI', name: 'سيدي كرير للغزل والنسيج', sector: 'الصناعة' },
  { code: 'ORWE', name: 'النساجون الشرقيون', sector: 'الصناعة' },
  // التبغ (الشرقية للدخان)
  { code: 'EAST', name: 'الشرقية للدخان', sector: 'التبغ' },
  // الأغذية
  { code: 'JUFO', name: 'جهينة للصناعات الغذائية', sector: 'الأغذية' },
  // النقل
  { code: 'OCDI', name: 'الإسكندرية لتداول الحاويات', sector: 'النقل' },
  // البترول
  { code: 'AMOC', name: 'الإسكندرية لمنتجات البترول', sector: 'البترول' },
  // الرعاية الصحية
  { code: 'NINH', name: 'النيل للأدوية', sector: 'الرعاية الصحية' },
  { code: 'CLHO', name: 'مستشفى كليوباترا', sector: 'الرعاية الصحية' },
  // الحديد والصلب
  { code: 'ESRS', name: 'حديد عز', sector: 'الحديد والصلب' },
  // الاستثمارات
  { code: 'CCAP', name: 'القلعة القابضة', sector: 'الاستثمار' },
  { code: 'PIOH', name: 'بايونيرز القابضة', sector: 'الاستثمار' },
  { code: 'AUTO', name: 'جي بي كورب', sector: 'الاستثمار' },
  { code: 'GBCO', name: 'GB Corp القابضة', sector: 'الاستثمار' },
  { code: 'ORAS', name: 'أوراسكوم للاستثمار', sector: 'الاستثمار' },
  // الخدمات المالية
  { code: 'HRHO', name: 'مجموعة أي إف جي القابضة', sector: 'الخدمات المالية' },
  { code: 'EASB', name: 'المصرية العربية ثمار لتداول الأوراق', sector: 'الخدمات المالية' },
  { code: 'VALU', name: 'فاليو للتمويل العقاري', sector: 'الخدمات المالية' }
];

let screenerMarket = 'egypt';
let bestPickSymbol = 'MFPC';

function injectWidget(elementId, scriptFile, config, dataKey) {
  const el = document.getElementById(elementId);
  if (!el) return;
  /* ⛔ 19 أكتوبر 2026 — لازم الحاوية يكون ليها حجم قبل الحقن.
     الـwidget لو اتولد جوه حاوية 0x0 (تبويب مخفي) بيطلع فاضي (∅)
     ويفضل كده حتى بعد ما المستخدم يفتح التبويب.
     ✅ الحل: نستنى لحد ما الحاوية تبان، وقتها الـwidget بيتولد صح. */
  const doInject = () => {
    if (!el.isConnected) return;
    /* 🐙 شارت TradingView بييجي من tv-shim.js (نفس مصدر كل الرسومات).
       سكربت s3 القديم كان بيطلع ∅ — من غير بيانات خالص. */
    if (window.OCTA_TV && /advanced-chart/.test(scriptFile)) {
      try {
        window.OCTA_TV.mount(el, {
          symbol: config.symbol,
          interval: config.interval || '1D',
          link: false
        });
        return;
      } catch (e) { }
    }
    el.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/' + scriptFile;
    script.async = true;
    script.setAttribute('data-bp', dataKey);
    script.innerHTML = JSON.stringify(config);
    el.appendChild(script);
  };
  if (window.OCTA_TV && window.OCTA_TV.whenSized) {
    window.OCTA_TV.whenSized(el, doInject, { timeout: 30000, force: false });
  } else {
    doInject();
  }
}

// ============ SCREENER ============
function initScreener() {
  /* الفلتر الجديد في octa-screener.js — مش محتاج تهيئة هنا */
}

/* loadScreener القديمة اتشالت — الفلتر الجديد في octa-screener.js */

// ============ SEARCH ============
function initSearch() {
  const container = document.getElementById('quickPicksContainer');
  if (container) {
  container.innerHTML = EGX_STOCKS.slice(0, 8).map(s => 
  `<button class="quick-pick-btn" onclick="searchStock('${s.code}')">${s.code}</button>`
  ).join('');
  }
}

const EGX_SEARCH_INDEX = [{"code":"AALR","name":"العامة لاستصلاح الأراضي","sector":"زراعة"},{"code":"ABUK","name":"أبو قير للأسمدة","sector":"زراعة"},{"code":"ACAMD","name":"الشركة العربية لإدارة وتطوير الأصول","sector":"متنوع"},{"code":"ACAP","name":"أي كابيتال القابضة","sector":"خدمات مالية"},{"code":"ACGC","name":"العربية لحليج الأقطان","sector":"صناعة"},{"code":"ACTF","name":"أكت فاينانشال","sector":"خدمات مالية"},{"code":"ADCI","name":"العربية للأدوية","sector":"رعاية صحية"},{"code":"ADIB","name":"مصرف أبوظبي الإسلامي - مصر","sector":"بنوك"},{"code":"ADPC","name":"العربية لمنتجات الألبان","sector":"سلع استهلاكية"},{"code":"ADRI","name":"أراب للتنمية و الاستثمار العقاري","sector":"عقارات"},{"code":"AFDI","name":"الأهلي للتنمية والاستثمار","sector":"عقارات"},{"code":"AFMC","name":"مطاحن الإسكندرية","sector":"سلع استهلاكية"},{"code":"AIDC","name":"أرابيا للاستثمار والتنمية","sector":"متنوع"},{"code":"AIFI","name":"أطلس","sector":"عقارات"},{"code":"AJWA","name":"أجواء للصناعات الغذائية","sector":"سلع استهلاكية"},{"code":"ALCN","name":"الإسكندرية لتداول الحاويات والبضائع","sector":"نقل"},{"code":"ALEX","name":"أسمنت بورتلاند الإسكندرية","sector":"مواد أساسية"},{"code":"ALUM","name":"العربية للألومنيوم","sector":"صناعة"},{"code":"AMER","name":"عامر جروب القابضة","sector":"عقارات"},{"code":"AMES","name":"الإسكندرية للخدمات الطبية","sector":"رعاية صحية"},{"code":"AMIA","name":"الملتقى العربي للاستثمارات","sector":"متنوع"},{"code":"AMII","name":"العربية للصناعات المعدنية","sector":"صناعة"},{"code":"AMOC","name":"الإسكندرية لمنتجات البترول","sector":"طاقة"},{"code":"AMPI","name":"المؤشر للبرمجة","sector":"تكنولوجيا"},{"code":"APPC","name":"المتقدمة للتعبئة الدوائية","sector":"رعاية صحية"},{"code":"APSW","name":"يونيراب بولفارا للغزل والنسيج","sector":"صناعة"},{"code":"ARAB","name":"المطورون العرب القابضة","sector":"عقارات"},{"code":"ARCC","name":"أسمنت العربية","sector":"مواد أساسية"},{"code":"AREH","name":"المجموعة المصرية العقارية","sector":"عقارات"},{"code":"ASCM","name":"أسكوم للتعدين","sector":"صناعة"},{"code":"ASPI","name":"أسباير كابيتال القابضة","sector":"خدمات مالية"},{"code":"ATLC","name":"التوفيق للتأجير التمويلي","sector":"متنوع"},{"code":"ATQA","name":"مصر الوطنية للصلب - عتاقة","sector":"طاقة"},{"code":"AXPH","name":"الإسكندرية للأدوية","sector":"رعاية صحية"},{"code":"BIDI","name":"بي اي دي – البدر للاستثمار والتنمية","sector":"صناعة"},{"code":"BIGP","name":"بى اى جى للتجارة والاستثمار","sector":"سلع استهلاكية"},{"code":"BINV","name":"بي إنفستمنتس القابضة","sector":"خدمات مالية"},{"code":"BIOC","name":"جلاكسو سميثكلاين مصر","sector":"رعاية صحية"},{"code":"BONY","name":"بنيان للتطوير والتجاري","sector":"عقارات"},{"code":"BTFH","name":"بلتون المالية القابضة","sector":"خدمات مالية"},{"code":"CAED","name":"القاهرة للخدمات التعليمية","sector":"تكنولوجيا"},{"code":"CANA","name":"بنك قناة السويس","sector":"بنوك"},{"code":"CCAP","name":"القلعة القابضة","sector":"خدمات مالية"},{"code":"CCRS","name":"الخليجية الكندية للاستثمار العقاري","sector":"عقارات"},{"code":"CEFM","name":"مطاحن مصر الوسطى","sector":"سلع استهلاكية"},{"code":"CERA","name":"العربية للخزف (ريماس)","sector":"مواد أساسية"},{"code":"CFGH","name":"كونكريت فاشون جروب","sector":"متنوع"},{"code":"CICH","name":"سي آي كابيتال القابضة","sector":"خدمات مالية"},{"code":"CIEB","name":"بنك كريدي أجريكوول مصر","sector":"بنوك"},{"code":"CIRA","name":"القاهرة للاستثمار والتنمية العقارية","sector":"عقارات"},{"code":"CLHO","name":"مستشفى كليوباترا","sector":"رعاية صحية"},{"code":"CNFN","name":"كونتكت المالية القابضة","sector":"خدمات مالية"},{"code":"COMI","name":"البنك التجاري الدولي - مصر","sector":"بنوك"},{"code":"COPR","name":"كوبر للاستثمار التجاري والعقاري","sector":"عقارات"},{"code":"COSG","name":"القاهرة للزيوت والصابون","sector":"سلع استهلاكية"},{"code":"CPCI","name":"القاهرة للأدوية والصناعات الكيماوية","sector":"رعاية صحية"},{"code":"CPME","name":"كاتاليست بارتنرز","sector":"خدمات مالية"},{"code":"CRST","name":"كريست مارك للمقاولات والتطوير العقاري","sector":"عقارات"},{"code":"CSAG","name":"القناة للتوكيلات الملاحية","sector":"نقل"},{"code":"DAPH","name":"التعمير والاستشارات الهندسية","sector":"متنوع"},{"code":"DCRC","name":"دلتا للإنشاء والتعمير","sector":"عقارات"},{"code":"DEIN","name":"دلتا للتأمين","sector":"تأمين"},{"code":"DGTZ","name":"ديجيتايز للاستثمار والتقنية","sector":"تكنولوجيا"},{"code":"DOMT","name":"دومتي للصناعات الغذائية","sector":"سلع استهلاكية"},{"code":"DSCW","name":"دايس للملابس الجاهزة","sector":"صناعة"},{"code":"DTPP","name":"دلتا للطباعة والتغليف","sector":"صناعة"},{"code":"EALR","name":"العربية لاستصلاح الأراضي","sector":"زراعة"},{"code":"EASB","name":"المصرية العربية ثمار لتداول الأوراق المالية","sector":"خدمات مالية"},{"code":"EAST","name":"الشرقية للدخان","sector":"سلع استهلاكية"},{"code":"EBSC","name":"أصول للسمسرة في الأوراق المالية","sector":"خدمات مالية"},{"code":"ECAP","name":"العز للسيراميك والبورسلين","sector":"صناعة"},{"code":"EDFM","name":"مطاحن شرق الدلتا","sector":"سلع استهلاكية"},{"code":"EEII","name":"العربية للصناعات الهندسية","sector":"صناعة"},{"code":"EFIC","name":"المالية والصناعية المصرية","sector":"متنوع"},{"code":"EFID","name":"إيديتا للصناعات الغذائية","sector":"سلع استهلاكية"},{"code":"EFIH","name":"إي فاينانس للاستثمارات الرقمية","sector":"تكنولوجيا"},{"code":"EGAL","name":"مصر للألومنيوم","sector":"صناعة"},{"code":"EGAS","name":"غاز مصر","sector":"طاقة"},{"code":"EGBE","name":"البنك المصري الخليجي","sector":"بنوك"},{"code":"EGCH","name":"مصر للكيماويات (موبكو)","sector":"بتروكيماويات"},{"code":"EGREF","name":"صندوق المصريين للاستثمار العقاري","sector":"صناديق"},{"code":"EGSA","name":"نايل سات","sector":"إعلام"},{"code":"EGTS","name":"المصرية للمنتجعات السياحية","sector":"سياحة"},{"code":"EHDR","name":"المصريين للإسكان والتنمية والتعمير","sector":"عقارات"},{"code":"EITP","name":"المصرية للمشروعات السياحية العالمية","sector":"سياحة"},{"code":"ELEC","name":"الكابلات الكهربائية المصرية","sector":"صناعة"},{"code":"ELKA","name":"القاهرة للإسكان والتعمير","sector":"عقارات"},{"code":"ELNA","name":"النصر لتصنيع الحاصلات الزراعية","sector":"سلع استهلاكية"},{"code":"ELSH","name":"الشمس للإسكان والتعمير","sector":"عقارات"},{"code":"ELWA","name":"الوادي العالمية للاستثمار والتنمية","sector":"متنوع"},{"code":"EMFD","name":"إعمار مصر للتنمية","sector":"عقارات"},{"code":"ENGC","name":"الصناعات الهندسية (أيكون)","sector":"صناعة"},{"code":"EOSB","name":"العروبة للسمسرة في الأوراق المالية","sector":"خدمات مالية"},{"code":"EPCO","name":"المصرية للدواجن","sector":"سلع استهلاكية"},{"code":"EPPK","name":"الأهرام للطباعة والتغليف","sector":"صناعة"},{"code":"ETEL","name":"المصرية للاتصالات","sector":"اتصالات"},{"code":"ETRS","name":"إيجيترانس للنقل","sector":"نقل"},{"code":"EXPA","name":"البنك المصري لتنمية الصادرات","sector":"بنوك"},{"code":"FAIT","name":"بنك فيصل الإسلامي","sector":"بنوك"},{"code":"FAITA","name":"بنك فيصل الإسلامي بالدولار","sector":"بنوك"},{"code":"FERC","name":"فيركيم مصر للأسمدة","sector":"بتروكيماويات"},{"code":"FIRE","name":"الأولى للاستثمار","sector":"عقارات"},{"code":"FNAR","name":"الفنار للمقاولات","sector":"متنوع"},{"code":"FTNS","name":"فتنس برايم للاندية الصحية","sector":"سياحة"},{"code":"FWRY","name":"فوري لتكنولوجيا البنوك والمدفوعات الإلكترونية","sector":"تكنولوجيا"},{"code":"GBCO","name":"جي بي كورب القابضة","sector":"متنوع"},{"code":"GDWA","name":"جدوى للتنمية الصناعية","sector":"صناعة"},{"code":"GGCC","name":"الجيزة العامة للمقاولات","sector":"متنوع"},{"code":"GGRN","name":"جو جرين للاستثمار الزراعي","sector":"زراعة"},{"code":"GIHD","name":"الغربية الإسلامية للتنمية العمرانية","sector":"عقارات"},{"code":"GMCI","name":"جي إم سي جروب","sector":"متنوع"},{"code":"GOUR","name":"جورميه إيجيبت","sector":"سلع استهلاكية"},{"code":"GPIM","name":"جي بي آي","sector":"مواد أساسية"},{"code":"GPPL","name":"الأهرام الذهبية بلازا","sector":"عقارات"},{"code":"GRCA","name":"جراند إنفستمنت القابضة","sector":"خدمات مالية"},{"code":"GSSC","name":"العامة للصوامع والتخزين","sector":"متنوع"},{"code":"GTEX","name":"جي تكس للاستثمارات التجارية والصناعية","sector":"صناعة"},{"code":"GTHE","name":"جلوبال تيلكوم","sector":"تكنولوجيا"},{"code":"GTWL","name":"جولدن تكس للأصواف","sector":"صناعة"},{"code":"HBCO","name":"هيبكو","sector":"مواد أساسية"},{"code":"HDBK","name":"بنك الإسكندرية","sector":"بنوك"},{"code":"HELI","name":"مصر الجديدة للإسكان","sector":"عقارات"},{"code":"HRHO","name":"مجموعة أي إف جي القابضة","sector":"خدمات مالية"},{"code":"IBCT","name":"انترناشيونال بزنيس كوربوريشن","sector":"سلع استهلاكية"},{"code":"ICFC","name":"الدولية للأسمدة","sector":"بتروكيماويات"},{"code":"ICID","name":"العالمية للاستثمار والتنمية","sector":"متنوع"},{"code":"ICLE","name":"الدولية للتأجير التمويلي","sector":"خدمات مالية"},{"code":"IDRE","name":"الإسماعيلية الجديدة للتطوير العمراني","sector":"عقارات"},{"code":"IEEC","name":"المشروعات الصناعية والهندسية","sector":"مواد أساسية"},{"code":"IFAP","name":"الدولية للمحاصيل الزراعية","sector":"زراعة"},{"code":"INEG","name":"المجموعة المتكاملة للاعمال الهندسية","sector":"مواد أساسية"},{"code":"INFI","name":"الإسماعيلية الوطنية للصناعات الغذائية","sector":"سلع استهلاكية"},{"code":"IRAX","name":"العز الدخيلة للصلب","sector":"صناعة"},{"code":"IRON","name":"الحديد والصلب المصرية","sector":"صناعة"},{"code":"ISMA","name":"الإسماعيلية مصر للدواجن","sector":"سلع استهلاكية"},{"code":"ISMQ","name":"الحديد والصلب للمناجم والمحاجر","sector":"صناعة"},{"code":"ISPH","name":"ابن سينا فارما","sector":"رعاية صحية"},{"code":"JUFO","name":"جهينة للصناعات الغذائية","sector":"سلع استهلاكية"},{"code":"KABO","name":"النصر للملابس والمنسوجات (كابو)","sector":"صناعة"},{"code":"KORA","name":"قرة لمشروعات الطاقة والاستثمار","sector":"مواد أساسية"},{"code":"KRDI","name":"نهر الخير للتنمية الزراعية","sector":"زراعة"},{"code":"KWIN","name":"القاهرة الوطنية للاستثمار","sector":"خدمات مالية"},{"code":"KZPC","name":"كفر الزيات للمبيدات","sector":"بتروكيماويات"},{"code":"LCSW","name":"ليسيكو مصر","sector":"صناعة"},{"code":"LUTS","name":"لوتس للتنمية والاستثمار الزراعي","sector":"زراعة"},{"code":"MAAL","name":"مرسيليا المصرية الخليجية","sector":"متنوع"},{"code":"MASR","name":"مدينة مصر للإسكان والتعمير","sector":"عقارات"},{"code":"MBEG","name":"إم بي","sector":"صناعة"},{"code":"MBSC","name":"مصر بني سويف للأسمنت","sector":"مواد أساسية"},{"code":"MCQE","name":"مصر للأسمنت قنا","sector":"مواد أساسية"},{"code":"MCRO","name":"ماكرو جروب للأدوية","sector":"رعاية صحية"},{"code":"MENA","name":"مينا للاستثمار السياحي والعقاري","sector":"عقارات"},{"code":"MEPA","name":"العبوات الطبية","sector":"رعاية صحية"},{"code":"MFPC","name":"مصر لإنتاج الأسمدة (موبكو","sector":"زراعة"},{"code":"MFSC","name":"مصر للأسواق الحرة","sector":"سلع استهلاكية"},{"code":"MHOT","name":"مصر للفنادق","sector":"سياحة"},{"code":"MICH","name":"مصر للصناعات الكيماوية","sector":"بتروكيماويات"},{"code":"MILS","name":"مطاحن شمال القاهرة","sector":"سلع استهلاكية"},{"code":"MIPH","name":"مينا فارم للأدوية","sector":"رعاية صحية"},{"code":"MISR","name":"ايجى ستون","sector":"مواد أساسية"},{"code":"MMAT","name":"مرسى علم للتنمية السياحية","sector":"سياحة"},{"code":"MOED","name":"نظم التعليم الحديثة","sector":"تكنولوجيا"},{"code":"MOIL","name":"ماريديف لخدمات البترول","sector":"نقل"},{"code":"MOIN","name":"المهندس للتأمين","sector":"تأمين"},{"code":"MOSC","name":"مصر للزيوت والصابون","sector":"سلع استهلاكية"},{"code":"MPCI","name":"ممفيس للأدوية","sector":"رعاية صحية"},{"code":"MPCO","name":"المنصورة للدواجن","sector":"سلع استهلاكية"},{"code":"MPRC","name":"المصرية لمدينة الإنتاج الإعلاني","sector":"إعلام"},{"code":"MTIE","name":"إم إم جروب للصناعة والتجارة العالمية","sector":"متنوع"},{"code":"NAHO","name":"نعيم القابضة للاستثمارات","sector":"خدمات مالية"},{"code":"NARE","name":"نعيم العقارية القابضة","sector":"عقارات"},{"code":"NBKE","name":"الوطني","sector":"بنوك"},{"code":"NCCW","name":"النصر للأعمال المدنية","sector":"متنوع"},{"code":"NCGC","name":"النيل لحليج الاقطان","sector":"سلع استهلاكية"},{"code":"NDRL","name":"الحفر الوطنية","sector":"متنوع"},{"code":"NEDA","name":"شمال الصعيد للتنمية الزراعية","sector":"زراعة"},{"code":"NHPS","name":"الوطنية لإسكان النقابات المهنية","sector":"عقارات"},{"code":"NINH","name":"النيل للأدوية","sector":"رعاية صحية"},{"code":"NIPH","name":"النيل للأدوية والصناعات الكيماوية","sector":"رعاية صحية"},{"code":"OBRI","name":"العبور للاستثمار العقاري","sector":"عقارات"},{"code":"OCDI","name":"الإسكندرية لتداول الحاويات","sector":"نقل"},{"code":"OCPH","name":"أكتوبر فارما","sector":"رعاية صحية"},{"code":"ODIN","name":"أودن للاستثمارات","sector":"متنوع"},{"code":"OFH","name":"أو بي المالية القابضة","sector":"خدمات مالية"},{"code":"OIH","name":"أوراسكوم للاستثمار القابضة","sector":"متنوع"},{"code":"OLFI","name":"عبور لاند للصناعات الغذائية","sector":"سلع استهلاكية"},{"code":"ORAS","name":"أوراسكوم للاستثمار","sector":"خدمات مالية"},{"code":"ORHD","name":"أوراسكوم للتنمية مصر","sector":"عقارات"},{"code":"ORWE","name":"النساجون الشرقيون","sector":"صناعة"},{"code":"PACH","name":"باكين","sector":"صناعة"},{"code":"PHAR","name":"فاركو للأدوية","sector":"رعاية صحية"},{"code":"PHDC","name":"بالم هيلز للتعمير","sector":"عقارات"},{"code":"PHGC","name":"بريميوم هيلثكير جروب","sector":"رعاية صحية"},{"code":"PHTV","name":"بيراميزا للفنادق والمنتجعات","sector":"سياحة"},{"code":"POUL","name":"القاهرة للدواجن","sector":"سلع استهلاكية"},{"code":"PRCL","name":"العامة للخزف والصيني","sector":"صناعة"},{"code":"PRDC","name":"بايونيرز بروبرتيز","sector":"عقارات"},{"code":"PRMH","name":"برايم القابضة","sector":"خدمات مالية"},{"code":"QNBE","name":"بنك قطر الوطني الأهلي","sector":"بنوك"},{"code":"RACC","name":"رايا كاستومر إكسبرينس","sector":"تكنولوجيا"},{"code":"RAKT","name":"راكتا لصناعة الورق","sector":"صناعة"},{"code":"RAYA","name":"راية القابضة للاستثمارات المالية","sector":"خدمات مالية"},{"code":"RKAZ","name":"ركاز القابضة","sector":"صناعة"},{"code":"RMDA","name":"راميدا للأدوية","sector":"رعاية صحية"},{"code":"ROTO","name":"رواد السياحة","sector":"سياحة"},{"code":"RREI","name":"أليكو للاستثمار العقاري","sector":"عقارات"},{"code":"RTVC","name":"ريمكو للقرى السياحية","sector":"سياحة"},{"code":"RUBX","name":"روبكس العالمية للبلاستيك","sector":"صناعة"},{"code":"SAIB","name":"بنك الشركة المصرفية العربية الدولية","sector":"بنوك"},{"code":"SAUD","name":"بنك البركة مصر","sector":"بنوك"},{"code":"SCEM","name":"أسمنت سيناء","sector":"مواد أساسية"},{"code":"SCFM","name":"مطاحن جنوب القاهرة والجيزة","sector":"سلع استهلاكية"},{"code":"SCTS","name":"قناة السويس لتوطين التكنولوجيا","sector":"نقل"},{"code":"SDTI","name":"شرم دريمز للاستثمار السياحي","sector":"سياحة"},{"code":"SEIG","name":"السعودية المصرية للاستثمار","sector":"خدمات مالية"},{"code":"SIPC","name":"سبأ الدولية للأدوية","sector":"رعاية صحية"},{"code":"SKPC","name":"سيدي كرير للبتروكيماويات","sector":"بتروكيماويات"},{"code":"SMFR","name":"سماد مصر","sector":"بتروكيماويات"},{"code":"SMPP","name":"الشروق الحديثة للطباعة والتغليف","sector":"صناعة"},{"code":"SNFC","name":"الشرقية الوطنية للأمن الغذائي","sector":"سلع استهلاكية"},{"code":"SNFI","name":"سوهاج الوطنية","sector":"زراعة"},{"code":"SPHT","name":"الشمس بيراميدز للفنادق","sector":"عقارات"},{"code":"SPIN","name":"الإسكندرية للغزل والنسيج","sector":"صناعة"},{"code":"SPMD","name":"سبيد ميديكال","sector":"رعاية صحية"},{"code":"SUCE","name":"هايدلبرج ماتريالز -السويس للأسمنت","sector":"مواد أساسية"},{"code":"SUGR","name":"دلتا للسكر","sector":"سلع استهلاكية"},{"code":"SVCE","name":"جنوب الوادي للأسمنت","sector":"مواد أساسية"},{"code":"SWDY","name":"السويدي إليكتريك","sector":"صناعة"},{"code":"TALM","name":"تعليم لخدمات الإدارة","sector":"تكنولوجيا"},{"code":"TANM","name":"تنمية للاستثمار العقاري","sector":"عقارات"},{"code":"TAQA","name":"طاقة عربية","sector":"طاقة"},{"code":"TMGH","name":"مجموعة طلعت مصطفى القابضة","sector":"عقارات"},{"code":"TORA","name":"اسمنت طرة","sector":"مواد أساسية"},{"code":"TRTO","name":"عبر المحيطات للسياحة","sector":"سياحة"},{"code":"TWSA","name":"توسع للتخصيم","sector":"خدمات مالية"},{"code":"TYCN","name":"تايكون للاستثمارات القابضة","sector":"خدمات مالية"},{"code":"UBEE","name":"البنك المتحد","sector":"بنوك"},{"code":"UEFM","name":"مطاحن مصر العليا","sector":"سلع استهلاكية"},{"code":"UEGC","name":"الصعيد العامة للمقاولات والاستثمار العقاري","sector":"عقارات"},{"code":"UNIP","name":"يونيفرسال للورق والتغليف","sector":"صناعة"},{"code":"UNIT","name":"المتحدة للإسكان والتعمير","sector":"عقارات"},{"code":"UPMS","name":"الاتحاد الصيدلى","sector":"رعاية صحية"},{"code":"UTOP","name":"يوتوبيا","sector":"عقارات"},{"code":"VALU","name":"ڤاليو للتمويل الاستهلاكي","sector":"تكنولوجيا"},{"code":"VERT","name":"فرتيكا","sector":"صناعة"},{"code":"VLMR","name":"فالمور القابضة","sector":"متنوع"},{"code":"VLMRA","name":"فالمور القابضة للاستثمار بالجنيه","sector":"خدمات مالية"},{"code":"WATP","name":"بيتومود","sector":"مواد أساسية"},{"code":"WCDF","name":"مطاحن وسط وغرب الدلتا","sector":"سلع استهلاكية"},{"code":"WKOL","name":"وادي كوم أمبو لاستصلاح الأراضي","sector":"زراعة"},{"code":"ZEOT","name":"الزيوت المستخلصة ومنتجاتها","sector":"سلع استهلاكية"},{"code":"ZMID","name":"زهراء المعادي للاستثمار والتعمير","sector":"عقارات"}];

function searchStock(query) {
  if (!query) return;
  const q = query.toLowerCase().trim();
  const INDEX = (typeof EGX_SEARCH_INDEX !== 'undefined' && EGX_SEARCH_INDEX.length) ? EGX_SEARCH_INDEX : EGX_STOCKS;
  let stock = INDEX.find(s =>
  (s.code||'').toLowerCase() === q ||
  (s.code||'').toLowerCase().includes(q) ||
  (s.name||'').toLowerCase().includes(q)
  );
  if (!stock) {
  stock = EGX_STOCKS.find(s =>
  (s.code||'').toLowerCase().includes(q) || (s.name||'').toLowerCase().includes(q)
  );
  }
  const symbol = stock ? stock.code : q.toUpperCase();
  const tvSymbol = 'EGX:' + symbol;
  const displayName = stock ? stock.name : q.toUpperCase();
  const result = document.getElementById('search-result');
  
  result.innerHTML = `
  <div class="search-loading">
  <div class="spinner"></div>
  <p>جاري تحميل البيانات...</p>
  </div>
  `;
  
  setTimeout(() => {
  result.innerHTML = `
  <div class="search-result-card">
  <div class="result-header">
  <h3 class="result-title">${displayName}</h3>
  <p class="result-subtitle">${stock ? stock.sector : 'غير محدد'} • ${tvSymbol}</p>
  </div>
  <div class="result-section">
  <h4 class="result-section-title">💰 السعر والمعلومات</h4>
  <div class="tradingview-widget-container" style="min-height: 200px;">
  <div id="sr-symbol-info-${tvSymbol}"></div>
  </div>
  </div>
  <div class="result-section">
  <h4 class="result-section-title">🧠 التحليل الفني</h4>
  <div class="tradingview-widget-container" style="min-height: 480px;">
  <div id="sr-tech-analysis-${tvSymbol}"></div>
  </div>
  </div>
  <div class="result-section">
  <h4 class="result-section-title">📊 الرسم البياني التفاعلي</h4>
  <div class="tradingview-widget-container" style="min-height: 600px;">
  <div id="sr-advanced-chart-${tvSymbol}"></div>
  </div>
  </div>
  </div>
  `;
  
  setTimeout(() => injectWidget('sr-symbol-info-' + tvSymbol, 'embed-widget-mini-symbol-overview.js', {
  symbol: tvSymbol, width: '100%', height: 280, locale: 'ar', dateRange: '1D',
  colorTheme: 'dark', isTransparent: true, autosize: true
  }, 'sr1'), 100);
  
  setTimeout(() => injectWidget('sr-tech-analysis-' + tvSymbol, 'embed-widget-technical-analysis.js', {
  symbol: tvSymbol, width: '100%', height: 480, locale: 'ar', colorTheme: 'dark', isTransparent: true,
  interval: '1D', showIntervalTabs: true
  }, 'sr2'), 250);
  
  setTimeout(() => injectWidget('sr-advanced-chart-' + tvSymbol, 'embed-widget-advanced-chart.js', {
  symbol: tvSymbol, width: '100%', height: 600, locale: 'ar', colorTheme: 'dark', isTransparent: true,
  autosize: true, interval: 'D', timezone: 'Africa/Cairo', theme: 'dark', style: '1',
  withdateranges: true, hide_side_toolbar: false, allow_symbol_change: true,
  details: false, hotlist: false, calendar: false,
  studies: [
  'MASimple@tv-basicstudies', 'RSI@tv-basicstudies', 'MACD@tv-basicstudies'
  ]
  }, 'sr3'), 400);
  }, 300);
}

// ============ BEST PICK ============
function initBestPick() {
  const container = document.getElementById('symbolButtonsContainer');
  if (container) {
  container.innerHTML = EGX_STOCKS.map(s => 
  `<button class="symbol-btn ${s.code === bestPickSymbol ? 'active' : ''}" onclick="changeBestPick('${s.code}')">
  <span class="sym-code">${s.code}</span>
  <span class="sym-name">${s.name}</span>
  </button>`
  ).join('');
  }
}

function changeBestPick(symbol) {
  bestPickSymbol = symbol;
  document.querySelectorAll('.symbol-btn').forEach(btn => {
  btn.classList.toggle('active', btn.querySelector('.sym-code').textContent === symbol);
  });
  loadBestPickWidgets(symbol);
}

function loadBestPickWidgets(symbol) {
  const code = String(symbol || bestPickSymbol || 'MFPC').toUpperCase();
  bestPickSymbol = code;

  /* ⛔⛔ ٢٠ أكتوبر ٢٠٢٦ — الصفحة كانت فاضية خالص:
     الـ3 widgets كانوا embed-widget-* من TradingView، وهُم بيفضلوا
     فاضيين (CORS + CSP بيرفضوا نداء widgetembed نفسه).
     ✅ الشارت بقى من المصدر الوحيد: s.tradingview.com/widgetembed (OCTA_TV.mount)
     ✅ والبيانات بقت من محركنا: /api/intelligence + /api/technical */
  const chartHost = document.getElementById('bp-advanced-chart');
  if (chartHost) {
    if (window.OCTA_TV) {
      window.OCTA_TV.mount(chartHost, { symbol: 'EGX:' + code, interval: '1D',
        studies: 'MASimple@tv-basicstudies,RSI@tv-basicstudies,MACD@tv-basicstudies' });
    } else {
      chartHost.innerHTML = '<div class="opps-loading">جاري تحميل الرسم البياني…</div>';
    }
  }

  const info = document.getElementById('bp-symbol-info');
  const tech = document.getElementById('bp-tech-analysis');
  if (info) info.innerHTML = '<div class="opps-loading">جاري تحميل البيانات…</div>';
  if (tech) tech.innerHTML = '<div class="opps-loading">جاري تحميل البيانات…</div>';

  (async () => {
    try {
      const [ri, rt] = await Promise.all([
        fetch(OCTA_API + '/api/intelligence/' + code).then(r => r.ok ? r.json() : {}).catch(() => ({})),
        fetch(OCTA_API + '/api/technical/' + code).then(r => r.ok ? r.json() : {}).catch(() => ({})),
      ]);
      if (info) info.innerHTML = bpInfoHTML(ri);
      if (tech) tech.innerHTML = bpTechHTML(rt, ri);
    } catch (e) {
      if (info) info.innerHTML = '<div class="opps-loading">تعذر تحميل البيانات</div>';
      if (tech) tech.innerHTML = '<div class="opps-loading">تعذر تحميل البيانات</div>';
    }
  })();
}

/* 💰 كارت السعر والمعلومات — من محرك OCTA */
function bpInfoHTML(d) {
  if (!d || !d.code) return '<div class="opps-loading">لا توجد بيانات لهذا السهم</div>';
  const ch = Number(d.change || 0);
  const cls = ch >= 0 ? 'pos' : 'neg';
  const dec = String(d.decision || '—');
  const dcls = /إيجابية/.test(dec) ? 'good' : (/سلبية/.test(dec) ? 'bad' : '');
  const cell = (label, val, c) => '<div class="bp-info-cell"><span>' + label + '</span><b class="' + (c || '') + '">' + val + '</b></div>';
  return '<div class="bp-info-grid">' +
    cell('السعر', Number(d.price || 0).toFixed(2)) +
    cell('التغير', (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%', cls) +
    cell('النتيجة', (d.final_score != null ? d.final_score : '—')) +
    cell('القرار', dec, dcls) +
    cell('الثقة', (d.confidence != null ? d.confidence + '%' : '—')) +
    cell('القطاع', (d.sector || '—')) +
    cell('الأمان', (d.risk_level || '—')) +
    cell('آخر تحديث', String(d.data_ts || '').slice(0, 16).replace('T', ' ')) +
    '</div>';
}

/* 🧠 كارت التحليل الفني + التوصية */
function bpTechHTML(t, intel) {
  if (!t || !t.code) return '<div class="opps-loading">لا توجد بيانات فنية</div>';
  const ind = t.indicators || {};
  const tec = t.technical || {};
  const axes = (intel && intel.axes) || {};
  const AX = { technical: 'فني', fundamental: 'أساسي', liquidity: 'سيولة', news: 'أخبار',
    sentiment: 'معنويات', risk: 'أمان', portfolio: 'محفظة' };
  const num = (v, d) => (v == null ? '—' : (typeof v === 'number' ? (Math.round(v * 100) / 100) : v));
  const indRow = (k, label, v) => '<div class="bp-ind"><span>' + label + '</span><b>' + v + '</b></div>';
  let h = '<div class="bp-tech-head">' +
    '<span class="bp-signal ' + (tec.signal === 'شراء' ? 'good' : (tec.signal === 'بيع' ? 'bad' : '')) + '">' +
    (tec.signal || '—') + '</span>' +
    '<span>نتيجة الفني: <b>' + num(tec.score) + '/100</b></span>' +
    '<span>ثقة المؤشرات: <b>' + num(tec.confidence) + '%</b></span>' +
    '</div>';
  h += '<div class="bp-ind-grid">' +
    indRow('rsi', 'RSI', num(ind.rsi)) +
    indRow('macd', 'MACD', num(ind.macd)) +
    indRow('ema20', 'EMA 20', num(ind.ema20)) +
    indRow('ema200', 'EMA 200', num(ind.ema200)) +
    indRow('atr', 'ATR %', num(tec.atr_pct)) +
    indRow('bb', 'Bollinger', (ind.bb_lower != null && ind.bb_upper != null) ?
      (Math.round(ind.bb_lower * 100) / 100) + ' – ' + (Math.round(ind.bb_upper * 100) / 100) : '—') +
    '</div>';
  const ax = Object.keys(axes).filter(k => k !== 'final' && k !== 'safety')
    .map(k => '<span class="bp-ax"><i>' + (AX[k] || k) + '</i><b>' + num(axes[k]) + '</b></span>').join('');
  if (ax) h += '<div class="bp-axes">' + ax + '</div>';
  const pos = (tec.positives || []).slice(0, 3).join(' · ');
  const neg = (tec.negatives || []).slice(0, 3).join(' · ');
  if (pos || neg) {
    h += '<div class="bp-why">';
    if (pos) h += '<div class="good">✅ ' + pos + '</div>';
    if (neg) h += '<div class="bad">⛔ ' + med_escape(neg) + '</div>';
    h += '</div>';
  }
  return h;
}

function med_escape(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
  });
}

/* Dispatcher: لما المستخدم يدخل على الـ 3 pages الجديدة
   ⛔ كان `window.switchPage = ...` — غلاف رابع على نفس الدالة.
   دلوقتي بيسجّل نفسه كـhook، فبدون ما يلمس الـwindow خالص. */
OS_NAV.on(function (pageId) {
  if (pageId === 'bestpick') {
  setTimeout(() => loadBestPickWidgets(bestPickSymbol), 100);
  } else if (pageId === 'engine') {
  setTimeout(() => loadEngineTVWidgets(currentEngineSymbol), 100);
  } else if (pageId === 'news') {
  // ابدأ الـ auto-refresh لما المستخدم يدخل على الأخبار
  if (!liveNews.length) {
  startNewsAutoRefresh();
  }
  }
});

// ============ ENGINE + TRADINGVIEW ============
let currentEngineSymbol = 'COMI';
let ENGINE_AXES_UNUSED_GUARD = null;

// نطمّن إن المتغيرات معرّفة قبل أي استخدام
if (typeof LIVE_PRICES === 'undefined') window.LIVE_PRICES = {};

// 8 محاور بأوزان مختلفة — كل واحد بيدور على data حقيقي
const ENGINE_AXES = [
  { id:'technical', label:'🐙 التحليل الفني', weight: 1.2, source:'RSI / MACD / MA', icon:'📈' },
  { id:'fundamental', label:'📊 الأساسي', weight: 1.3, source:'P/E / ROE / Growth', icon:'📊' },
  { id:'liquidity', label:'💧 السيولة', weight: 1.0, source:'Volume / MFI', icon:'💧' },
  { id:'news', label:'📰 الأخبار', weight: 0.9, source:'Sentiment / Events', icon:'📰' },
  { id:'ai', label:'🤖 ذكاء اصطناعي', weight: 1.1, source:'Pattern Recognition', icon:'🤖' },
  { id:'risk', label:'🛡️ المخاطر', weight: 1.0, source:'Volatility / Beta', icon:'🛡️' },
  { id:'portfolio', label:'💼 المحفظة', weight: 0.9, source:'Correlation / Allocation', icon:'💼' },
  { id:'valuation', label:'🎯 التوافق', weight: 1.1, source:'DCF / Fair Value', icon:'🎯' }
];

function loadEngineTVWidgets(symbol) {
  console.log('📊 loadEngineTVWidgets:', symbol);
  currentEngineSymbol = symbol;
  // اجيب الأسعار الأول (عشان ندمجها) — وبعدين شغّل محرك OCTA
  fetchLivePrices().then(() => fetchAiAnalysis(symbol));
  const tvSymbol = 'EGX:' + symbol;
  // Clean previous
  ['engine-tv-symbol-info', 'engine-tv-tech-analysis', 'engine-tv-advanced-chart'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '';
  });
  document.querySelectorAll('script[data-engine-tv]').forEach(s => s.remove());

  // Mini Symbol Overview widget (السعر + الشارت + التغير)
  setTimeout(() => injectEngineWidget('engine-tv-symbol-info', 'embed-widget-mini-symbol-overview.js', {
  symbol: tvSymbol, width: '100%', height: 180, locale: 'ar', dateRange: '1D',
  colorTheme: 'dark', isTransparent: true, autosize: true
  }, 'sym'), 50);

  // technical analysis widget
  setTimeout(() => injectEngineWidget('engine-tv-tech-analysis', 'embed-widget-technical-analysis.js', {
  symbol: tvSymbol, width: '100%', height: 480, locale: 'ar', colorTheme: 'dark', isTransparent: true,
  interval: '1D', showIntervalTabs: true
  }, 'tech'), 150);

  // advanced chart
  setTimeout(() => injectEngineWidget('engine-tv-advanced-chart', 'embed-widget-advanced-chart.js', {
  symbol: tvSymbol, width: '100%', height: 600, locale: 'ar', colorTheme: 'dark', isTransparent: true,
  autosize: true, interval: 'D', timezone: 'Africa/Cairo', theme: 'dark', style: '1',
  withdateranges: true, hide_side_toolbar: false, allow_symbol_change: true,
  details: false, hotlist: false, calendar: false,
  studies: [
  'MASimple@tv-basicstudies', 'RSI@tv-basicstudies', 'MACD@tv-basicstudies'
  ]
  }, 'chart'), 250);
}

// خانة السعر — البيانات من TradingView widget (الـ widget بيظهر السعر الحقيقي)
function updateEnginePriceBox(symbol) {
  const stockNames = {
  'COMI':'البنك التجاري الدولي','TMGH':'طلعت مصطفى','SWDY':'السويدي إليكتريك',
  'PHDC':'بالم هيلز','ETEL':'المصرية للاتصالات','EMFD':'إعمار مصر للتنمية',
  'ABUK':'أبو قير للأسمدة','ADIB':'مصرف أبوظبي الإسلامي','EFIH':'إي فاينانس',
  'FWRY':'فوري','HRHO':'مجموعة أي إف جي القابضة','ESRS':'إيسترن كومباني',
  'JUFO':'جهينة للصناعات الغذائية','MNHD':'مصر الجديدة للإسكان',
  'AMOC':'الإسكندرية لمنتجات البترول','SKPC':'سيدي كرير للبتروكيماويات',
  'CCAP':'القلعة القابضة'
  };
  document.getElementById('enginePriceSymbol').textContent = symbol;
  document.getElementById('enginePriceName').textContent = stockNames[symbol] || '';
  document.getElementById('enginePriceValue').innerHTML = `<span class="live-tick"></span>📊 سعر لحظي`;
  const chg = document.getElementById('enginePriceChange');
  chg.textContent = 'EGX:' + symbol;
  chg.className = 'price-change up';

  // الـ 8 محاور — من محرك OCTA AI (مش hash عشوائي)
  fetchAiAnalysis(symbol);
}

// ⚠️ الكود القديم ده كان hash عشوائي — اتشال. الباقي محفوظ للـ reference فقط
function calculateOctopusScore(symbol) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
  hash = ((hash << 5) - hash) + symbol.charCodeAt(i);
  hash |= 0;
  }
  const seed = (hash % 100) / 100; // 0-1

  // كل سهم عنده base score + variation
  const baseScore = 50 + (seed * 40); // 50-90

  // الـ 8 محاور — قيم حول الـ base مع variation
  const variation = () => Math.round((Math.random() - 0.5) * 20);

  const scores = [
  { ...ENGINE_AXES[0], value: Math.min(100, Math.max(20, baseScore + variation())) },
  { ...ENGINE_AXES[1], value: Math.min(100, Math.max(20, baseScore + variation())) },
  { ...ENGINE_AXES[2], value: Math.min(100, Math.max(20, baseScore + variation())) },
  { ...ENGINE_AXES[3], value: Math.min(100, Math.max(20, baseScore + variation())) },
  { ...ENGINE_AXES[4], value: Math.min(100, Math.max(20, baseScore + variation())) },
  { ...ENGINE_AXES[5], value: Math.min(100, Math.max(20, baseScore + variation())) },
  { ...ENGINE_AXES[6], value: Math.min(100, Math.max(20, baseScore + variation())) },
  { ...ENGINE_AXES[7], value: Math.min(100, Math.max(20, baseScore + variation())) }
  ];

  // إجمالي مرجح
  const totalWeight = scores.reduce((s, a) => s + a.weight, 0);
  const weightedSum = scores.reduce((s, a) => s + (a.value * a.weight), 0);
  const finalScore = Math.round(weightedSum / totalWeight);

  renderEngineBars(scores, finalScore);
}

// عرض الـ 8 محاور بالـ bars — نسخة AI
function renderEngineBars(scores, finalScore, extra) {
  const barsEl = document.getElementById('engineBars');
  if (!barsEl) return;
  barsEl.innerHTML = scores.map(s => `
  <div class="engine-bar">
  <div class="lbl">${s.label} <span style="color:var(--muted);font-size:0.7rem;">(${s.source || 'AI'})</span></div>
  <div class="bar">
  <div class="fill" style="background:linear-gradient(90deg, ${s.value >= 80 ? '#16c79a, #4dabf7' : s.value >= 60 ? '#4dabf7, #f4d03f' : '#d4af37, #f97316'}); width:0%; --target:${s.value}%;">${s.value}</div>
  </div>
  </div>
  `).join('');
  setTimeout(() => barsEl.querySelectorAll('.fill').forEach(f => f.style.width = f.style.getPropertyValue('--target')), 200);

  const dec = document.getElementById('engineDecision');
  if (!dec) return;

  // لو مفيش AI (fallback قديم)
  if (!extra || !extra.d) {
  let verdict = '✅ شراء';
  let action = 'السهم في منطقة شراء جيدة';
  if (finalScore < 50) { verdict = '⚠️ حذر'; action = 'السهم يحتاج مراقبة'; }
  else if (finalScore < 70) { verdict = '🟡 تجميع'; action = 'ممكن تجمع على دفعات'; }
  dec.innerHTML = `<div class="verdict">${verdict}</div>
  <div class="action">${action} — مرجح من 8 محاور</div>
  <div class="conf">🐙 نسبة الأخطبوط: <strong>${finalScore}%</strong></div>`;
  return;
  }

  const d = extra.d;
  /* ⛔⛔ ٢٣ أكتوبر ٢٠٢٦ — القرار كان undefined في كل سهم.
  ⛌ السبب: الباك مش بيرجّع decision/axes/... في كل رد anymore،
  ⛌ فالـtemplate كان بيطبع undefined و NaN.
  ⛌ ⛌ الحل: لو الحقول ناقصة، نحسب القرار من finalScore (المحلي).
  ⛌ ⛌ نفس قواعد المحرك: ٧٠+ شراء · ٥٠-٧٠ تجميع · أقل حذر.
  ⛌ ⛌ (من Production — اتنقذ قبل ما يضيع) */
  if (!d.decision) d.decision = _octaDecisionFromScore(finalScore);
  if (!d.confidence) d.confidence = Math.min(95, Math.round(finalScore));
  if (!d.risk_level) d.risk_level = finalScore >= 70 ? 'منخفضة' : finalScore >= 50 ? 'متوسطة' : 'عالية';
  if (!d.model) d.model = 'octa';
  if (!d.sector) d.sector = '';
  if (d.reasons && !Array.isArray(d.reasons)) d.reasons = [];
  const DEC_MAP = {
  'شراء': { icon: '✅', cls: '#16c79a' },
  'إشارة إيجابية': { icon: '🟡', cls: '#f4d03f' },
  'إشارة محايدة': { icon: '🔵', cls: '#4dabf7' },
  'إشارة سلبية': { icon: '🔴', cls: '#ff8a80' },
  'تجنب': { icon: '⛔', cls: '#ff5252' }
  };
  const decMeta = DEC_MAP[d.decision] || { icon: '🐙', cls: '#d4af37' };

  const reasons = (d.reasons || []).map(r => `<li>${r}</li>`).join('');

  dec.innerHTML = `
  <div style="background:linear-gradient(135deg, rgba(212,175,55,0.14), rgba(13,33,55,0.6)); border:1px solid var(--gold); border-radius:14px; padding:18px; margin-bottom:14px;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
  <span style="color:var(--gold);font-size:0.8rem;font-weight:800;">🐙 قرار OCTA</span>
  <span style="color:var(--muted);font-size:0.7rem;">ثقة ${d.confidence || 0}%</span>
  </div>
  <div class="verdict" style="color:${decMeta.cls};">${decMeta.icon} ${d.decision}</div>
  <div style="color:var(--muted);font-size:0.82rem;margin-top:4px;">المخاطرة: ${d.risk_level || 'غير محدد'}${extra.price ? ` • السعر: ${Number(extra.price).toFixed(2)} EGP` : ''}</div>
  </div>

  ${d.target ? `
  <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:14px;">
  <div class="calc-result" style="padding:10px;">
  <div class="lbl">🎯 الهدف</div>
  <div class="num" style="font-size:1.1rem;color:var(--sec);">${d.target}</div>
  </div>
  <div class="calc-result" style="padding:10px;">
  <div class="lbl">⛔ ستوب</div>
  <div class="num" style="font-size:1.1rem;color:var(--red2);">${d.stop_loss}</div>
  </div>
  <div class="calc-result" style="padding:10px;">
  <div class="lbl">📊 التوافق</div>
  <div class="num" style="font-size:1.1rem;color:var(--gold);">${finalScore}%</div>
  </div>
  </div>` : ''}

  ${reasons ? `
  <div style="background:rgba(255,255,255,0.04); border-radius:12px; padding:14px; margin-bottom:10px;">
  <div style="color:var(--sec2);font-weight:800;font-size:0.85rem;margin-bottom:8px;">📋 ليه القرار ده؟</div>
  <ul style="margin:0; padding-right:18px; color:var(--txt); font-size:0.85rem; line-height:1.8;">${reasons}</ul>
  </div>` : ''}

  <div style="color:var(--muted);font-size:0.72rem; text-align:center;">
  🤖 تحليل محرك OCTA (${d.model || 'octa'})${d.cached ? ' • مُخزّن' : ''}${d.sector ? ' • ' + d.sector : ''}
  </div>
  `;
}

function injectEngineWidget(elementId, scriptFile, config, dataKey) {
  const el = document.getElementById(elementId);
  if (!el) return;
  /* ⛔ نفس قاعدة injectWidget — الحاوية المخفية (0x0) بتولّد widget فاضي. */
  const doInject = () => {
    if (!el.isConnected) return;
    /* 🐙 نفس القاعدة — شارت TradingView من tv-shim.js */
    if (window.OCTA_TV && /advanced-chart/.test(scriptFile)) {
      try {
        window.OCTA_TV.mount(el, {
          symbol: config.symbol,
          interval: config.interval || '1D',
          link: false
        });
        return;
      } catch (e) { }
    }
    /* ⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — guard: لو الحاوية اتشالت (تبديل صفحة قبل
    📌 تحميل سكربت TradingView) ⇒ null error في الكونسول. */
    try {
    if (!el.isConnected) return;
    el.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/' + scriptFile;
    script.async = true;
    script.setAttribute('data-engine-tv', dataKey);
    script.innerHTML = JSON.stringify(config);
    el.appendChild(script);
    } catch (e) {
    try { console.warn('[OCTA] TV widget skipped'); } catch (x) { }
    }
  };
  if (window.OCTA_TV && window.OCTA_TV.whenSized) {
    window.OCTA_TV.whenSized(el, doInject, { timeout: 30000, force: false });
  } else {
    doInject();
  }
}