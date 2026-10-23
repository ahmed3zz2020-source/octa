/* ══════════════════════════════════════════════════════════════
   🛡️ حارس رابعة — حروف صينية/كورية/يابانية داخل نص عربي
   ──────────────────────────────────────────────────────────────
   📌 القصة: تسلّلت حروف صينية/كورية (CJK) جوّه تعليقات عربية في
      أكتر من ملف — «المؤشرات기술ية» و«القاع헤진 السعر».
      مش بتكسر الكود، بس بتبوّخ الكود وتخلي الكود شكله غريب.
   📌 الـguard الموجود في radar.test.js بيغطي المحرك بس ⇒
      وسّعناه هنا لكل ملفات الكود بالمشروع.
   ──────────────────────────────────────────────────────────────
   ⛔ اللي مش بنمسّه (ومقصود):
      · `data/` — فيها أسماء شركات فعلية (سامسونج الإلكترونية
        مُدرجة في السعودية باسم كوري) ⇒ بيانات مش كود.
      · سطور الـguard نفسها (فيها النمط حرفياً).
      · الإيموجي (〰️ = U+3030) — رمز مش حرف.
   ⛔ ملاحظة: «Gemini» كاسم **مؤشر سوقي** (LS3 Banker Fund
      Oscillator Gemini) مش اسم أداة ذكاء اصطناعي — فممنوعش
      نعمل عليه guard. الـguard الموجود في worker.test.js بيكفي
      لأنه بيسيب سطح المستخدم (index.html) بس.
   ══════════════════════════════════════════════════════════════ */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const EXTS = ['.js', '.css', '.html'];

/* ⛔ ideographs + kana + hangul + fullwidth forms
   (مستبعدين الـemoji وعلامات الترقيم当时的 CJK) */
const BAD = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uFF01-\uFF60\uFFE0-\uFFE6]/;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist'
      || e.name === 'vendor' || e.name === 'data' || e.name === 'output') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}

/* ⛔ سطور الـguard نفسها فيها النمط حرفياً — نستثنيها */
function isGuardFile(rel) {
  return rel.endsWith(path.join('assets', 'tests', 'agent-name-guard.test.js'))
    || rel.endsWith(path.join('assets', 'tests', 'radar.test.js'))
    || rel.endsWith(path.join('assets', 'tests', 'worker.test.js'));
}

test('🛡️ مفيش حروف صينية/كورية/يابانية في كود المشروع', () => {
  const files = walk(ROOT, []);
  assert.ok(files.length > 20, 'الملفات اتقرت: ' + files.length);
  const bad = [];
  for (const f of files) {
    const rel = path.relative(ROOT, f);
    if (isGuardFile(rel)) continue;
    const text = fs.readFileSync(f, 'utf8');
    text.split('\n').forEach((line, i) => {
      if (BAD.test(line)) bad.push(rel + ':' + (i + 1) + ' → ' + line.trim().slice(0, 80));
    });
  }
  assert.deepEqual(bad, [], '⛔ حروف CJK داخل النص العربي:\n' + bad.join('\n'));
});

test('🛡️ مفيش قوس إغلاق زيادة في CSS (الملف يفضل متوازن)', () => {
  const bad = [];
  for (const f of walk(ROOT, []).filter(x => x.endsWith('.css'))) {
    const rel = path.relative(ROOT, f);
    const t = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const o = (t.match(/\{/g) || []).length, c = (t.match(/\}/g) || []).length;
    if (o !== c) bad.push(rel + ' → ' + o + ' فتح / ' + c + ' إغلاق');
  }
  assert.deepEqual(bad, [], '⛔ CSS غير متوازن:\n' + bad.join('\n'));
});
