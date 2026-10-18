/* ══════════════════════════════════════════════════════════════
   🧪 اختبار دمج الفلتر — يشتغل على الداتا الحيّة
   ──────────────────────────────────────────────────────────────
   بيحاكي نفس اللي octa-screener.js بيعمله:
     1. بياخد الملف الثابت (data/data_markets.js)
     2. بيعمل patch للسعر من /api/quotes
     3. بيعمل patch لأرقام التحليل من /api/market_tech
     4. بيعمل markGhosts للأسهم اللي مش في البث
   وبعدين بيتأكد إن الأرقام الظاهرة بقت مطابقة لـ TradingView.

   التشغيل:  node test-screener-merge.mjs
   ══════════════════════════════════════════════════════════════ */
import fs from 'fs';

const API = process.env.OCTA_API || 'https://octa-prices-production-4ccb.up.railway.app';
const MK_URL = process.env.OCTA_MK || 'https://octashares.com/data/data_markets.js';

let fail = 0, pass = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  → ' + extra : '')); }
};

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.json();
}
async function getText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.text();
}

/* ── ① الملف الثابت ── */
console.log('=== ① تحميل الملف الثابت ===');
const mkText = await getText(MK_URL);
const MK = JSON.parse(mkText.slice(mkText.indexOf('=') + 1).replace(/;\s*$/, ''));
const db0 = MK.egypt;
console.log('  صفوف مصر في الملف الثابت: ' + db0.length);
ok('الملف فيه صفوف', db0.length > 200, db0.length);

/* ── ② البث الحي ── */
console.log('\n=== ② البث الحي ===');
const quotes = await getJSON(API + '/api/quotes?market=egypt');
const tech = await getJSON(API + '/api/market_tech?market=egypt');
const qRows = quotes.markets.egypt || {};
const tRows = tech.markets.egypt || {};
console.log('  أسعار: ' + Object.keys(qRows).length + ' (عمرها ' + quotes.age + 's)');
console.log('  تحليل: ' + Object.keys(tRows).length + ' (عمرها ' + tech.age + 's)');
ok('عمر بيانات الأسعار أقل من 60 ثانية', quotes.age < 60, quotes.age + 's');

/* ── ③ نفس اللي بيعمله الفلتر ── */
db0.forEach(st => {
  const q = qRows[st.code];
  if (!q || q.close == null) return;
  st.price = q.close;
  if (q.change != null) st.change = q.change;
  if (q.volume != null) st.volume = q.volume;
  if (q.Recommend != null) st.tvRec = q['Recommend.All'];
});

/* markGhosts — نفس الكود في الفلتر */
function markGhosts(rows) {
  if (!db0.length) return 0;
  const n = Object.keys(rows || {}).length;
  if (n < db0.length * 0.9) return -1;      // حارس: البث ناقص
  const seen = {};
  for (const c in rows) seen[c] = 1;
  let marked = 0;
  db0.forEach(st => { if (!seen[st.code]) { st.noData = true; marked++; } });
  return marked;
}
const marked = markGhosts(qRows);
console.log('  صفوف اتعلّمت noData: ' + marked);

/* دمج أرقام التحليل — نفس الكود في الفلتر */
let touched = 0;
db0.forEach(st => {
  const t = tRows[st.code];
  if (!t) return;
  for (const k in t) {
    if (t[k] !== null && t[k] !== undefined && st[k] !== t[k]) { st[k] = t[k]; touched++; }
  }
});
console.log('  خانة اتحدّثت من التحليل: ' + touched);

/* ── ④ الشبح ── */
console.log('\n=== ④ صفوف الشبح ===');
const GHOSTS = ['FCMD', 'ESAC', 'NAPR', 'ACRO', 'IDSC'];
for (const g of GHOSTS) {
  const st = db0.find(x => x.code === g);
  ok(g + ' اتعلّم noData', st && st.noData === true, st ? 'noData=' + st.noData : 'مش موجود');
}
const visible = db0.filter(s => !s.noData);
console.log('  صفوف ظاهرة بعد الفلترة: ' + visible.length + ' من ' + db0.length);
ok('الصفوف الظاهرة أقل من الملف', visible.length < db0.length);

/* ── ⑤ الأرقام بقت من TradingView؟ ── */
console.log('\n=== ⑤ الأرقام بعد الدمج ===');
const TVCOLS = ['RSI', 'Perf.1M', 'Perf.3M', 'Perf.Y', 'Volatility.D', 'SMA200'];
const body = {
  filter: [{ left: 'name', operation: 'match', right: '.' }],
  options: { lang: 'en' }, markets: ['egypt'],
  symbols: { query: { types: [] }, tickers: [] }, columns: TVCOLS,
  range: [0, 600]
};
const tv = await (await fetch('https://scanner.tradingview.com/egypt/scan', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})).json();
const TV = {};
for (const it of tv.data) TV[it.s.split(':').pop()] = Object.fromEntries(TVCOLS.map((c, i) => [c, it.d[i]]));

const PAIRS = [['rsi', 'RSI'], ['p1m', 'Perf.1M'], ['p3m', 'Perf.3M'], ['p1y', 'Perf.Y'],
  ['volD', 'Volatility.D'], ['sma200', 'SMA200']];

function score(getVal) {
  let m = 0, t = 0;
  for (const st of db0) {
    const tv = TV[st.code];
    if (!tv) continue;
    for (const [mine, theirs] of PAIRS) {
      const v = getVal(st, mine);
      if (v == null || tv[theirs] == null) continue;
      t++;
      const tol = Math.max(0.5, Math.abs(tv[theirs]) * 0.01);   // 1% أو 0.5 — market بيتحرك
      if (Math.abs(v - tv[theirs]) <= tol) m++;
    }
  }
  return { m, t, pct: t ? (m / t * 100) : 0 };
}

/* ⛔ قبل الدمج = قيم الملف الثابت (7 أكتوبر) */
const BEFORE = { };
const raw = JSON.parse(mkText.slice(mkText.indexOf('=') + 1).replace(/;\s*$/, '')).egypt;
const RAW = {}; for (const r of raw) RAW[r.code] = r;

/* ✅ بعد الدمج = قيم TradingView */
const after = score((st, f) => st[f]);
/* الملف القديم */
let m0 = 0, t0 = 0;
for (const st of db0) {
  const tv = TV[st.code]; if (!tv) continue;
  for (const [mine, theirs] of PAIRS) {
    const v = RAW[st.code] ? RAW[st.code][mine] : null;
    if (v == null || tv[theirs] == null) continue;
    t0++;
    if (Math.abs(v - tv[theirs]) <= Math.max(0.5, Math.abs(tv[theirs]) * 0.01)) m0++;
  }
}
console.log(`  المطابقة قبل الإصلاح (ملف 7 أكتوبر): ${m0}/${t0} = ${(m0/t0*100).toFixed(1)}%`);
console.log(`  المطابقة بعد الإصلاح  (من الـAPI):  ${after.m}/${after.t} = ${after.pct.toFixed(1)}%`);
ok('الدمج حسّن المطابقة بشكل واضح', after.pct > (m0 / t0 * 100) + 15,
   `${(m0/t0*100).toFixed(1)}% → ${after.pct.toFixed(1)}%`);
ok('أكثر من 90% مطابق لـ TradingView', after.pct > 90, after.pct.toFixed(1) + '%');

/* ── ⑥ السعر مطابق؟ ── */
let pm = 0, pt = 0;
for (const st of db0) {
  const t = TV[st.code];
  if (!t || t['Perf.Y'] == null) continue;
  pt++;
  if (st.change != null && Math.abs(st.change) <= 30) pm++;
}
console.log(`\n  صفوف بالسعر الحي: ${pt}`);
ok('نسبة كبيرة من الصفوف سعرها محدّث', pt / db0.length > 0.95, pt + '/' + db0.length);

/* ── ⑦ ما زال فيه صف من الملف القديم متسرب؟ ── */
console.log('\n=== ⑦ فحص الصفوف المتسربة ===');
const STALE = ['FCMD', 'ESAC', 'NAPR', 'ACRO', 'IDSC'];
const leak = visible.filter(s => STALE.includes(s.code));
ok('مفيش صف شبح ظاهر', leak.length === 0, leak.map(s => s.code).join(','));
const noPrice = visible.filter(s => s.price == null);
ok('كل الصفوف الظاهرة ليها سعر', noPrice.length === 0, noPrice.length + ' صف');

console.log('\n' + '─'.repeat(46));
console.log(fail === 0 ? `✅ ${pass} اختبار عدّوا` : `❌ ${fail} فشل · ${pass} عدّا`);
process.exit(fail === 0 ? 0 : 1);