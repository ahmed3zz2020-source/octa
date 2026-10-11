/* 🔄 cache-buster — كل build بياخد رقم جديد عشان المتصفح يجيب الملف من جديد */
const fs = require('fs');
const F = 'index.html';
let h = fs.readFileSync(F, 'utf8');
const now = String(Date.now()).slice(-8);
const stamp = `2026${new Date().toISOString().slice(5, 7).replace('-', '')}${now.slice(-4)}`;

// 1) الـmarker جوه السكربت
h = h.replace(/BUILD = 'v=' \+ '[^']*'/, `BUILD = 'v=${stamp}'`);

// 2) كل الـquery strings في الوسوم
h = h.replace(/(\?v=)[0-9a-zA-Z]+/g, `$1${stamp}`);

fs.writeFileSync(F, h);
console.log(`  🔄 cache-buster: ${stamp}`);
