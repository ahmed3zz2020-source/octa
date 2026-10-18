/* 🔄 cache-buster — كل build بياخد رقم جديد عشان المتصفح يجيب الملف من جديد */
const fs = require('fs');
const F = 'index.html';
let h = fs.readFileSync(F, 'utf8');
/* ⛔ كان بياخد آخر 4 أرقام من الـepoch ms — مش تاريخ، وبيرجع
   لورا أحياناً. دلوقتي تاريخ+وقت حقيقي: YYYYMMDDHHmm (بيزيد كل مرة). */
const _d = new Date();
const _p = (n) => (n < 10 ? '0' : '') + n;
const stamp = `${_d.getFullYear()}${_p(_d.getMonth() + 1)}${_p(_d.getDate())}${_p(_d.getHours())}${_p(_d.getMinutes())}`;

// 1) الـmarker جوه السكربت
// ⛔ الـregex القديم كان بيتوقع 'v=' + 'xxx' بس الكود كاتبه
//    'v=2026101806' + 'dd' — يعني ماكانش بيلقط.
//    دلوقتي بنمسح أي قيمة وندّيله الرقم الجديد.
h = h.replace(/var BUILD = '[^']*'(\s*\+\s*'[^']*')?;/, `var BUILD = 'v=${stamp}';`);

// 2) كل الـquery strings في الوسوم
h = h.replace(/(\?v=)[0-9a-zA-Z]+/g, `$1${stamp}`);

fs.writeFileSync(F, h);
console.log(`  🔄 cache-buster: ${stamp}`);
