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
/* ⛔⛔ ٢١ أكتوبر ٢٠٢٦ — داتا السوق بقت جوه الـAPI المحمي.
   ⛌ الملف الثابت ده كان **تسريب تنافسي** (أي حد بينزّله).
   ⛌ عايزينه يتحذف نهائياً من الحزمة ⇒ npm run build:strict
   ⛌ لحد ما الـAPI يتنشر، الملف بيفضل منسوخ (fallback للواجهة). */
const WARN = [
  { f: 'data/data_markets.js', why: '2,289 سهم — داتا عامة! تشيل بـ: npm run build:strict' },
  { f: 'data_ipo.json', why: '23 طرح اكتتاب — مكرّر من foudalens/ar/ipo (عام)' },
];

/* ⛔ الوضع الصارم — الملف ده لازم يكون مش موجود */
const STRICT_DROP = ['data/data_markets.js'];

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

/* ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐ الملف العام ده **مش** مسموح أبداً
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 السبب: لو الملف موجود، الـfallback في الواجهة بيقرأ من غير
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ ⛌
 📌 ⛌ ⛌ ⇒ يعني الحجب (المحمي) بيرجع يسقط من غير تسجيل.
 📌 ✅ الحل: `deploy` = `build:strict` + الفحص يفشل دايماً.
 */
const strict = true;
if (strict) {
  for (const f of STRICT_DROP) {
    const hit = rel.filter(r => r === f || r.endsWith('/' + f));
    if (hit.length) {
      console.error(`⛔⛔ ${f} موجود في dist — في الوضع الصارم لازم يتشال (تسريب مفتوح).`);
      bad++;
    }
  }
  if (bad) {
    console.error('\n⛔⛔⛔ البناء مرفوض — التسريب مفتوح.');
    process.exit(1);
  }
}

console.log('🔒 حارس النشر: مفيش ملفات بيانات ممنوعة في dist ✅');
console.log(`   ${rel.length} ملف · ${(files.reduce((a, f) => a + fs.statSync(f).size, 0) / 1024 / 1024).toFixed(2)} MB`);

for (const w of WARN) {
  if (rel.includes(w.f)) console.log(`   ⚠️  ${w.f} — ${w.why}`);
}
