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

/* ══════════════════════════════════════════════════════════════
 🛡️ ⭐ ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ PII — بيانات مستخدمين حقيقية
 ────────────────────────────────────────────────────────────────
 📌 المشكلة (ثغرة حرجة): `admin/users.json` كان مرفوع على git
 📌 ⛌⛌⛌ و `npm run build` بيعمل `cp -r admin dist/admin` ⬇️
 📌 ⛌⛌⛌ ⇒ الملف بينزل مع الحزمة للعامة ⬇️
 📌 ⛌⛌⛌ ⇒ https://octashares.com/admin/users.json بيرجّع HTTP 200
 📌 ⛌⛌⛌ ⇒ وفيه إيميلات + أسماء + uids حقيقية لـ ٥ مستخدمين.
 📌 ⛔⛔⛔ ده **تسريب PII** — مش بيانات سوق عامة.
 📌 ✅ الحل: الملف ده مش بيتبني خالص + بيتشال من git + الحارس
 📌    بيمرفض أي بناء فيه.
 ══════════════════════════════════════════════════════════════ */
const BANNED_PII = [
  { f: 'admin/users.json', why: 'إيميلات + أسماء + uids مستخدمين حقيقية' },
  { f: 'admin/data.json', why: 'أسماء + uids + تواريخ (الإيميلات مخفية بس الباقي PII)' },
  { f: 'users.json', why: 'إيميلات + أسماء + uids مستخدمين حقيقية' },
  { f: 'data.json', why: 'أسماء + uids مستخدمين حقيقية' },
];

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

/* ⛔⛔⛔ PII — بيانات مستخدمين حقيقية — ممنوعة تنزل للعامة ⬇️ */
for (const b of BANNED_PII) {
  const hit = rel.filter(r => r === b.f || r.endsWith('/' + b.f));
  if (hit.length) {
    bad++;
    console.error(`⛔⛔⛔ ${b.f} موجود في dist → ${hit.join(', ')}`);
    console.error(`   السبب: ${b.why}. دي PII — ممنوعة تنزل مع الحزمة العامة.`);
  }
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
/* 📌 ⛔⛔⛔ ٢٥ أكتوبر ٢٠٢٦ — ⭐ الوضع الصارم يتبع نفس المتغير
   ⛌⛌⛌ اللي بيحكم النسخ (tools/copy-data.js) ⬇️
   📌 ⛌⛌⛌ كان `const strict = true` ثابت ⬇️ ⇐ `npm run build`
   📌 ⛌⛌⛌ (اللي مش بيحط المتغير) كان **بيفشل دايماً** ⬇️
   📌 ⛌⛌⛌ ⇒ مفيش حد يقدر يبني أصلاً ⇒ الإصلاحات الأمنية
   📌 ⛌⛌⛌ مش بتوصل للإنتاج.
   📌 ✅ الحل: نقرا نفس المتغير ⇒ `build` (1) و `build:strict` (0).
   📌 ⛌⛌⛌ ملاحظة: PII guard **دايمماً شغّال** — مش متاع الـstrict. */
const strict = process.env.OCTA_STATIC_MARKETS === '0';
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
