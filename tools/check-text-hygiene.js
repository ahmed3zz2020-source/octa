/* ══════════════════════════════════════════════════════════════════════
   🧹 حارس نظافة النص — الواجهة (الجولة ٢٦ — نطاق الشجرة كاملة)
   ──────────────────────────────────────────────────────────────────────
   ⛔ ليش؟ في ٤ مواضع كان فيه محرف بديل (U+FFFD) داخل تعليقات عربية
      ⇒ النص بيظهر مخروم للقارئ.
   ⛔ الحارس: FFFD + حروف سيريلية (homoglyphs) + CJK/Hangul/Kana +
      ترقيم CJK + fullwidth في **كل** الملفات النصية المتتبَّعة.
   📌 ليش الشجرة كاملة؟ (درس الجولة ٢٦): التلوّث كان في ١٣ ملفاً خارج
      نطاق الامتدادات (.js/.html/.css/.md) — زي .gitignore و .bak/ و
      ملفات .json و .py ⇒ نطاق قديم = تسرّب دائم.
   📌 مستثنى (مقصود ومش غلط):
      · CJK في assets/tests/radar.test.js (حارس اختبار)
      · الكوري في data/market_names.js و data/data_markets.js (سامسونج TADAWUL)
      · U+3030 (〰️) رمز إيموجي مقصود — مش محرف — ومش داخل نطاق الفحص.

   📌 التشغيل: node tools/check-text-hygiene.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

/* ⛔ مسارات مسموح فيها (سببها موثّق فوق) */
const ALLOW = {
  'assets/tests/radar.test.js': 'حارس CJK مقصود (نمط كاشف + توثيق خطأ قديم)',
  'data/market_names.js': 'أسماء سوق سعودي (كوري شرعي)',
  'data/data_markets.js': 'أسماء سوق سعودي (كوري شرعي)'
};

const SKIP_DIRS = ['node_modules', 'dist', 'build', '.git', '__pycache__', '.pytest_cache'];

/* النمط: FFFD + سيريل + صيني + كوري + كاكا + ترقيم CJK + fullwidth
   (U+3030 مستثنى: رمز إيموجي مقصود في octa-app.js) */
const PATTERNS = [
  { re: new RegExp('\\uFFFD', 'u'), why: 'FFFD (محرف بديل)' },
  { re: new RegExp('[\\u0400-\\u04FF]{2,}', 'u'), why: 'Cyrillic homoglyph' },
  { re: new RegExp('[\\u4E00-\\u9FFF\\u3400-\\u4DBF]', 'u'), why: 'CJK' },
  { re: new RegExp('[\\uAC00-\\uD7AF\\u1100-\\u11FF]', 'u'), why: 'Hangul' },
  { re: new RegExp('[\\u3040-\\u30FF]', 'u'), why: 'Kana' },
  { re: new RegExp('[\\u3000-\\u302F\\u3031-\\u303F]', 'u'), why: 'CJK punctuation' },
  { re: new RegExp('[\\uFF01-\\uFF60\\uFFE0-\\uFFE6]', 'u'), why: 'fullwidth' }
];

function trackedFiles() {
  try {
    const out = execFileSync('git', ['ls-files'], {
      cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
    });
    const list = out.split('\n').filter(Boolean);
    if (list.length) return list;
  } catch (e) {
    /* fallback: مشي على الشجرة */
  }
  const out = [];
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.indexOf(e.name) !== -1) continue;
        walk(p);
      } else {
        out.push(path.relative(ROOT, p));
      }
    }
  })(ROOT);
  return out;
}

function isBinary(p) {
  try {
    const fd = fs.openSync(p, 'r');
    const buf = Buffer.alloc(4096);
    const n = fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);
    return buf.slice(0, n).includes(0);
  } catch (e) {
    return true;
  }
}

const files = trackedFiles();
const bad = [];
let scanned = 0;

for (const rel of files) {
  if (ALLOW[rel]) continue;
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p) || !fs.statSync(p).isFile() || isBinary(p)) continue;
  let t;
  try { t = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
  scanned += 1;
  const lines = t.split('\n');
  lines.forEach((line, i) => {
    for (const { re, why } of PATTERNS) {
      const m = line.match(re);
      if (m) bad.push({ rel, line: i + 1, why: why + ': ' + m[0] });
    }
  });
}

if (bad.length) {
  console.error('⛔⛔ حارس النظافة فشل — ' + bad.length + ' موضع:');
  for (const b of bad.slice(0, 25)) {
    console.error('   ' + b.rel + ':' + b.line + '  (' + b.why + ')');
  }
  process.exit(1);
}

console.log('🧹 حارس نظافة النص: ' + scanned + ' ملف متتبَّع · مافيش نص تالف ✅');
