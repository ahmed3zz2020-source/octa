/* ══════════════════════════════════════════════════════════════════════
   🧪🛡️ اختبار حالة «محرك Alpha غير متاح مؤقتًا»
   ──────────────────────────────────────────────────────────────────────
   assets/tests/alpha-unavailable.test.js

   📌 الخلفية المقاسة (١٥ نوفمبر ٢٠٢٦):
      مسارات `/api/alpha/*` مش موجودة في الباك (ترجّع 405) ⇒ واجهة
      Alpha كانت هتعرض رسالة خطأ عامة، أو أسوأ: هتعرض نتائج قديمة
      كأنها حالية.

   📌 المطلوب: حالة صريحة معتمدة من المالك:
      «محرّك المحفظة الذكية غير متاح مؤقتًا. نعمل على ربطه ببيانات
       متجددة. لن نعرض نتائج قديمة باعتبارها نتائج حالية.»
      + من غير زر إعادة محاولة (إعادة المحاولة مش هتنفع).

   📌 التشغيل:  node --test assets/tests/alpha-unavailable.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const ALPHA = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-alpha.js'), 'utf8');

const MSG_HEAD = 'محرّك المحفظة الذكية غير متاح مؤقتًا';
const MSG_TAIL = 'لن نعرض نتائج قديمة باعتبارها نتائج حالية.';

/* ───────────────────────── ① ───────────────────────── */
test('النص المعتمد موجود حرفياً', () => {
  assert.ok(ALPHA.includes(MSG_HEAD), 'رأس الرسالة غير موجود');
  assert.ok(ALPHA.includes(MSG_TAIL), 'ذيل الرسالة غير موجود');
});

/* ───────────────────────── ② ───────────────────────── */
test('حالة عدم التوفّر متفرّدة (متغيّر مستقل عن الخطأ العام)', () => {
  assert.ok(/unavailable:\s*false/.test(ALPHA), 'مافيش متغيّر unavailable في الحالة');
  assert.ok(/S\.unavailable = true/.test(ALPHA), 'الحالة مش بتتحدّد عند الخطأ');
  assert.ok(/__engineUnavailable/.test(ALPHA), 'مافيش علامة __engineUnavailable');
});

/* ───────────────────────── ③ ───────────────────────── */
test('404/405 تتحوّل لحالة «غير متاح» مش خطأ عام', () => {
  const m = ALPHA.match(/st === 404 \|\| st === 405[\s\S]{0,400}/);
  assert.ok(m, 'مافيش فرع 404/405');
  assert.ok(/__engineUnavailable\s*=\s*true/.test(m[0]), 'الفرع مش بيعلّم الحالة');
  assert.ok(/ALPHA_UNAVAILABLE_MSG/.test(m[0]), 'الفرع مش بيستخدم الرسالة المعتمدة');
});

/* ───────────────────────── ④ ───────────────────────── */
test('شاشة الحالة الصريحة من غير زر إعادة محاولة', () => {
  const m = ALPHA.match(/if \(S\.unavailable\) \{[\s\S]{0,700}?\n    \}/);
  assert.ok(m, 'مافيش رسم لحالة عدم التوفّر');
  const block = m[0];
  assert.ok(block.includes(MSG_HEAD), 'الرسالة مش ظاهرة في الرسم');
  assert.ok(!/__alphaReload/.test(block), 'فيها زر إعادة محاولة — مش مناسب');
});

/* ───────────────────────── ⑤ ───────────────────────── */
test('الرسالة العامة بتفضل زي ما هي لبقية الأخطاء', () => {
  const m = ALPHA.match(/if \(S\.error\) \{[\s\S]{0,500}?\n    \}/);
  assert.ok(m, 'مافيش رسم للخطأ العام');
  assert.ok(/__alphaReload/.test(m[0]), 'الخطأ العام فقد زر إعادة المحاولة');
});

/* ───────────────────────── ⑥ ───────────────────────── */
test('إعادة التحميل بتمسح حالة عدم التوفّر', () => {
  assert.ok(/S\.loading = true; S\.error = ''; S\.unavailable = false;/.test(ALPHA),
    'إعادة التحميل ما بتمسحش حالة عدم التوفّر');
});
