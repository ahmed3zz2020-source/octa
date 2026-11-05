/* 🔄 cache-buster — كل build بياخد رقم جديد عشان المتصفح يجيب الملف من جديد */
const fs = require('fs');
/* ⛔⛔⛔ ٢٤ أكتوبر ٢٠٢٦ — ⭐ gate.html كمان!
 📌 الكود القديم كان بيحدّث index.html بس ⇒ الـgate.html كان
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ بيفتح الـJS بنسخة قديمة ⇒ مستخدم بيشوف
 📌 ⛌ ⛌ ⛌ ⛌ ⛌ ⛌ «طلبت ٣ أكواد» بدل «٥» + البوابة القديمة.
 📌 ✅ الحل: نحدّث الملفين.
 */
const FILES = ['index.html', 'gate.html'];
/* ⛔ كان بياخد آخر 4 أرقام من الـepoch ms — مش تاريخ، وبيرجع
   لورا أحياناً. دلوقتي تاريخ+وقت حقيقي: YYYYMMDDHHmm (بيزيد كل مرة). */
const _d = new Date();
const _p = (n) => (n < 10 ? '0' : '') + n;
const stamp = `${_d.getFullYear()}${_p(_d.getMonth() + 1)}${_p(_d.getDate())}${_p(_d.getHours())}${_p(_d.getMinutes())}`;

// 2) ⭐ ملف النسخة (٦ نوفمبر ٢٠٢٦) — للتطبيق المثبّت
// 📌 السبب: التطبيق المثبّت (WebAPK) كان بيعرض نسخة قديمة.
// 📌 الحل: octa-update.js يقارن BUILD بالصفحة بـ build في version.json.
// 📌 ⛔ لازم يتنسخ لـdist مع الباقي (شوف package.json build).
try {
  const fs2 = require('fs');
  fs2.writeFileSync('version.json', JSON.stringify({
    build: 'v=' + stamp,
    ts: Date.now()
  }, null, 2));
  console.log('  🆕 version.json: ' + stamp);
} catch (e) { console.log('  ⚠️ version.json: ' + e.message); }

// 1) الـmarker جوه السكربت
// ⛔ الـregex القديم كان بيتوقع 'v=' + 'xxx' بس الكود كاتبه
//    'v=2026101806' + 'dd' — يعني ماكانش بيلقط.
//    دلوقتي بنمسح أي قيمة وندّيله الرقم الجديد.
FILES.forEach(function (F) {
  if (!fs.existsSync(F)) return;
  let h = fs.readFileSync(F, 'utf8');
  h = h.replace(/var BUILD = '[^']*'(\s*\+\s*'[^']*')?;/, `var BUILD = 'v=${stamp}';`);
  h = h.replace(/(\?v=)[0-9a-zA-Z]+/g, `$1${stamp}`);
  fs.writeFileSync(F, h);
  console.log(`  🔄 cache-buster [${F}]: ${stamp}`);
});
