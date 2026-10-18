/* ══════════════════════════════════════════════════════════════
   🖥️ نسخة الشارت في جذر الموقع
   ──────────────────────────────────────────────────────────────
   assets/chart.html بيشتغل صح في مساره، بس الرابط
   /assets/chart.html طويل. هنا بنعمل نسخة في الجذر
   (/chart.html) ونعدّل المسارات النسبية تبعاها.
   ══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'chart.html');
const OUT = path.join(__dirname, '..', 'dist', 'chart.html');

if (!fs.existsSync(SRC)) {
  console.error('❌ assets/chart.html مش موجود');
  process.exit(0);
}

let html = fs.readFileSync(SRC, 'utf8');

/* المسارات النسبية بتتحوّل من /assets/ الجذر */
html = html
  .replace(/(href|src)="js\//g, '$1="assets/js/')
  .replace(/href="\.\.\/index\.html"/g, 'href="/index.html"');

fs.writeFileSync(OUT, html, 'utf8');
console.log('  🖥️ chart.html → dist/chart.html');
