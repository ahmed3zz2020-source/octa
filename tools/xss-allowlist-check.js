#!/usr/bin/env node
/* 🛡️ الجولة ٢٠ (R20) — حارس قائمة الإذن في جرد XSS
 *
 * 📌 الهدف: ⛔ ما يفضلش أي موضع XSS «متوسط/عالي» غير موثّق ⭐
 * ⭐ + ⛔ أي سطر موثّق لازم يفضل **زي ما هو** ⭐ (لو الكود اتغيّر ⇒
 *   Toyota القائمة بقت قديمة ⇒ الفحص يفشل ⭐).
 *
 * ⛔ مافيش تعديل على الكود — أداة قراءة + بوابة جودة ⭐
 * شغّلها:  node tools/xss-allowlist-check.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ALLOW = path.join(ROOT, 'tools', 'xss-allowlist.json');
const TMP = path.join(ROOT, '.xss-allowlist-check.json');

let pass = 0, fail = 0;
function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label + (extra ? '  — ' + extra : '')); }
  return !!cond;
}

console.log('\n── حارس قائمة الإذن (XSS) ──');

let list;
try {
  list = JSON.parse(fs.readFileSync(ALLOW, 'utf8'));
} catch (e) {
  console.log('  ❌ مقدرتش أقرأ قائمة الإذن: ' + e.message);
  process.exit(1);
}
const entries = list.entries || [];

/* ① كل موضع متوسط/عالي لازم يكون مغطّى ⭐ */
let raw = '';
try {
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'xss-inventory.js'),
    '--json', path.basename(TMP)], { cwd: ROOT, stdio: 'pipe' });
  raw = fs.readFileSync(TMP, 'utf8');
} catch (e) {
  raw = (e.stdout || '').toString() + (e.stderr || '').toString();
}
let rows = [];
try { rows = JSON.parse(raw); } catch (e) { rows = []; }
if (!Array.isArray(rows)) rows = rows.rows || rows.items || [];

const risky = rows.filter(r =>
  r.exploit === 'متوسطة' || r.exploit === 'عالية');
console.log('  · المواضع «غير مُرمَّز» المبلّغ عنها: ' + rows.length +
  ' · متوسط/عالي: ' + risky.length);

const covered = new Set(entries.map(e => e.file + ':' + e.line));
const uncovered = risky.filter(r => !covered.has(r.file + ':' + r.line));
ok(uncovered.length === 0,
  'كل موضع متوسط/عالي مغطّى بالقائمة',
  uncovered.map(r => r.file + ':' + r.line).join(', '));
ok(risky.length === entries.length,
  'عدد المواضع المغطّاة = عدد المواضع المبلّغ عنها',
  risky.length + ' ≠ ' + entries.length);

/* ② كل سطر موثّق لازم يفضل زي ما هو ⭐ */
for (const e of entries) {
  const f = path.join(ROOT, e.file);
  if (!fs.existsSync(f)) { ok(false, e.file + ':' + e.line + ' — الملف موجود'); continue; }
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const src = lines.slice(Math.max(0, e.line - 14), e.line + 12).join('\n');
  const same = src.indexOf(e.fingerprint) > -1;
  ok(same, e.file + ':' + e.line + ' — الكود زي ما هو (' + e.fingerprint + ')',
    same ? '' : 'البصمة مش موجودة في vicinity السطر');
}

try { fs.unlinkSync(TMP); } catch (e) { /* مافيش ملف */ }

console.log('\n  النتيجة: ' + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
