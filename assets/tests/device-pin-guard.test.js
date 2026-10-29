/* ══════════════════════════════════════════════════════════════════════
   🔐 حارس تثبيت الجهاز — لازم الدخول بالـPIN ٤ أرقام (٣٠ أكتوبر ٢٠٢٦)
   ──────────────────────────────────────────────────────────────────────
   📌 القصة (باج حقيقي):
      الباك بيسجّل الجهاز على الحساب وقت التحقق (challenge/verify
      بيقرا body.device) — بس الواجهة كانت مش بتبعته ⇒ ⇒ الجهاز
      **ما كانش بيتسجّل** ⇒ ⇒ ⇒ الكود على الإيميل بيجي **كل مرة**
      والأبد! ⇒ المستخدم قاعد يستنى كود في كل دخول.
   ✅ الحل (في الواجهة بس — مفيش تغيير في الباك ولا في الإنتاج):
      ① طلب الكود (verify) ⇒ يبعت `device`.
      ② رقم الجهاز (bioSecret) ⇒ نسخة احتياطية في الكوكي ⇒
         مسح «بيانات المواقع» ما يغيّرش الجهاز ⇒ الحساب يفضل فاكره.
   ⛔ وشكل مهم: كان فيه **تعريفين** لـ bioSecret في نفس الملف ⇒
      ⛔ التاني كان بيلغي الأول (JavaScript hoisting) ⇒ أي إصلاح في
      ⛔ الأول يبقى كود ميت. ⇒ الاختبار ده بيمنع تكرارها.
   ══════════════════════════════════════════════════════════════════════ */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const GATE = path.join(ROOT, 'assets', 'js', 'octa-gate.js');
const src = fs.readFileSync(GATE, 'utf8');

test(' bioSecret متعرّف مرة واحدة بس (التاني كان بيلغي الأول)', () => {
  const n = (src.match(/function bioSecret\s*\(/g) || []).length;
  assert.equal(n, 1, 'في أكتر من تعريف لـ bioSecret — الأخير بيلغي اللي قبله');
});

test(' bioSecret بيحفظ نسخة في الكوكي (so مسح localStorage ما يغيّرش الجهاز)', () => {
  assert.ok(/octa_bio_ck/.test(src), 'مفيش نسخة الكوكي الاحتياطية');
  assert.ok(/document\.cookie\s*=\s*ck\s*\+/.test(src), 'النسخة الاحتياطية مش بتتكتب');
  assert.ok(/readCookie\(\)/.test(src), 'مفيش قراءة للنسخة الاحتياطية');
});

test(' طلب الكود (verify) بيبعت الجهاز (device) — عشان الباك يسجّله', () => {
  const m = src.match(/post\(\s*reg\s*\?\s*SIGNUP\.verify\s*:\s*PATHS\.verify,[\s\S]{0,400}?\)/);
  assert.ok(m, 'ما لقيتش نداء verify');
  assert.ok(/device:\s*bioSecret\(\)/.test(m[0]),
    'طلب verify مش بيبعت device ⇒ الباك مش هيسجّل الجهاز ⇒ الكود كل مرة');
});

test(' تسجيل الدخول بالـPIN بيبعت الجهاز كمان', () => {
  assert.ok(/post\('\/api\/auth\/pin\/login',\s*\{\s*pin:\s*p,\s*device:\s*bioSecret\(\)/.test(src)
    || /pin\/login[^\n]*device:\s*bioSecret\(\)/.test(src),
    'الدخول بالـPIN مش بيبعت الجهاز');
});

test(' مفيش تعريف مكرر ل bioSecret في أي ملف تاني', () => {
  const dir = path.join(ROOT, 'assets', 'js');
  const bad = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    const n = (s.match(/function bioSecret\s*\(/g) || []).length;
    if (n > 1) bad.push(f + ' (' + n + ')');
  }
  assert.equal(bad.length, 0, 'تعريفات مكررة: ' + bad.join(', '));
});
