/* ══════════════════════════════════════════════════════════════════════
   🧹 حارس نظافة النص — الواجهة (الجولة ١٤)
   ──────────────────────────────────────────────────────────────────────
   ⛔ ليش؟ في ٤ مواضع كان فيه محرف بديل (U+FFFD) داخل تعليقات عربية
      ⇒ النص بيظهر مخروم للقارئ.
   ⛔ الحارس: FFFD + حروف سيريلية (homoglyphs) + CJK/Hangul في الملفات
      غير المسموح بها.
   📌 مستثنى (مقصود ومش غلط):
      · CJK في assets/tests/radar.test.js (حارس اختبار)
      · الكوري في data/market_names.js و data/data_markets.js (سامسونج TADAWUL)

   📌 التشغيل: node tools/check-text-hygiene.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const EXTS = ['.js', '.html', '.css', '.md'];

/* ⛔ مسارات مسموح فيها (سببها موثّق فوق) */
const ALLOW = {
  'assets/tests/radar.test.js': 'حارس CJK مقصود',
  'data/market_names.js': 'أسماء سوق سعودي (كوري شرعي)',
  'data/data_markets.js': 'أسماء سوق سعودي (كوري شرعي)'
};

const SKIP_DIRS = ['node_modules', 'dist', '.git', 'data'];

function walk(dir, out) {
  out = out || [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    const rel = path.relative(ROOT, p);
    if (e.isDirectory()) {
      if (SKIP_DIRS.indexOf(e.name) !== -1) continue;
      walk(p, out);
    } else if (EXTS.indexOf(path.extname(e.name)) !== -1) {
      out.push(rel);
    }
  }
  return out;
}

const files = walk(ROOT);
const bad = [];

for (const rel of files) {
  if (ALLOW[rel]) continue;
  const t = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const lines = t.split('\n');
  lines.forEach((line, i) => {
    let m = line.match(/[\uFFFD]/);
    if (m) bad.push({ rel, line: i + 1, why: 'FFFD (محرف بديل)' });
    m = line.match(/[\u0400-\u04FF]{2,}/);
    if (m) bad.push({ rel, line: i + 1, why: 'Cyrillic homoglyph: ' + m[0] });
    m = line.match(/[\u4E00-\u9FFF\uAC00-\uD7AF]/);
    if (m) bad.push({ rel, line: i + 1, why: 'CJK/Hangul: ' + m[0] });
  });
}

if (bad.length) {
  console.error('⛔⛔ حارس النظافة فشل — ' + bad.length + ' موضع:');
  for (const b of bad.slice(0, 25)) {
    console.error('   ' + b.rel + ':' + b.line + '  (' + b.why + ')');
  }
  process.exit(1);
}

console.log('🧹 حارس نظافة النص: ' + files.length + ' ملف · مافيش نص تالف ✅');
