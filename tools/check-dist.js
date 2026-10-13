/* ══════════════════════════════════════════════════════════════
   🔒 حارس النشر — بيمنع أي ملف بيانات يطلع مع dist
   ──────────────────────────────────────────────────────────────
   الملف ده بيتشغّل آخر `npm run build` وبيقفل الباب لو رجع
   أي ملف بيانات للمجلد المنشور.

   ⛔ ليه؟ عشان `cp *.json dist` كان شيل الداتا معايا وبيلخبط.
   دلوقتي البناء بقى allow-list صريح — بس لو حد ضاف `cp *.json`
   تاني من غير ما ينتبه، الحارس ده بيطلّعه.
   ══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');

/* ⛔⛔⛔ ممنوع يتبعتوا — بيانات اسهم / تحليل / مخاطرة مكشوفة للجميع */
const BANNED = ['data_full.json', 'data_egx.json', 'data_risk.json'];

/* ⚠️ مش banning — لكن لازم يتعرف عليه: 3.4MB من أسهم السوق الأمريكي */
const WARN = [
  { f: 'data/data_markets.js', why: '2,289 سهم أمريكي — بيتحمّل بـ <script> في المتصفح' },
  { f: 'data_ipo.json', why: '23 طرح اكتتاب — مكرّر من foudalens/ar/ipo (عام)' },
];

function walk(dir, out) {
  out = out || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

if (!fs.existsSync(DIST)) {
  console.error('❌ dist/ مش موجود — شغّل npm run build الأول');
  process.exit(1);
}

const files = walk(DIST);
const rel = files.map(f => path.relative(DIST, f).split(path.sep).join('/'));
let bad = 0;

for (const b of BANNED) {
  const hit = rel.filter(r => r === b || r.endsWith('/' + b));
  if (hit.length) { bad++; console.error(`❌ ${b} موجود في dist → ${hit.join(', ')}`); }
}

if (bad) {
  console.error('\n⛔⛔⛔ البناء مرفوض — البيانات دي لازم تيجي من /api/data_full المحمي.');
  process.exit(1);
}

console.log('🔒 حارس النشر: مفيش ملفات بيانات ممنوعة في dist ✅');
console.log(`   ${rel.length} ملف · ${(files.reduce((a, f) => a + fs.statSync(f).size, 0) / 1024 / 1024).toFixed(2)} MB`);

for (const w of WARN) {
  if (rel.includes(w.f)) console.log(`   ⚠️  ${w.f} — ${w.why}`);
}
