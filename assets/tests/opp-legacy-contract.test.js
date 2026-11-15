/* ══════════════════════════════════════════════════════════════════════
   🧪🛡️ اختبار عقد المسار القديم للفرص (fallback)
   ──────────────────────────────────────────────────────────────────────
   assets/tests/opp-legacy-contract.test.js

   📌 العيب المقاس (١٥ نوفمبر ٢٠٢٦):
      `octa-pages.js` كان يقرأ `s.opportunity` في بطاقات «فرص مبكرة»
      ⇒ وردّ /api/opportunities الحالي بيرجّع الحقل `score`
      ⇒ كل بطاقة كانت بتعرض «—» رغم وجود درجة ⇒ المستخدم شايف
      «مفيش بيانات» وهو شايف بيانات.

   📌 المطلوب: نقرأ `score` أولاً، مع توافق عكسي لو الرد فيه
      `opportunity` بس، والقيمة الفارغة تبقى «—» مش صفر.

   📌 التشغيل:  node --test assets/tests/opp-legacy-contract.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const PAGES = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-pages.js'), 'utf8');
const OPPS = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-opps.js'), 'utf8');

/* ═══ استخراج دالة oppScoreValue من المصدر وتقييمها في معزل ═══ */
function loadScoreHelper() {
  const m = PAGES.match(/function oppScoreValue\s*\([\s\S]*?\n\}/);
  assert.ok(m, 'دالة oppScoreValue مش موجودة');
  const fn = new Function(m[0] + '\nreturn oppScoreValue;');
  return fn();
}

/* ───────────────────────── ① ───────────────────────── */
test('الدرجة الجديدة (score) بتترجم صح', () => {
  const f = loadScoreHelper();
  assert.equal(f({ score: 73, name: 'سهم' }), 73);
  assert.equal(f({ score: '81.4' }), 81.4);
});

/* ───────────────────────── ② ───────────────────────── */
test('توافق عكسي: لو الرد فيه opportunity بس، بتفضل تترجم', () => {
  const f = loadScoreHelper();
  assert.equal(f({ opportunity: 65 }), 65);
});

/* ───────────────────────── ③ ───────────────────────── */
test('لو فيه score = 0 و opportunity = 70 ⇒ الجديد له الأولوية', () => {
  const f = loadScoreHelper();
  assert.equal(f({ score: 0, opportunity: 70 }), null,
    'الصفر في الحقل الجديد لازم يبقى «—» مش يرجع للقديم');
  assert.equal(f({ score: 70, opportunity: 10 }), 70);
});

/* ───────────────────────── ④ ───────────────────────── */
test('القيم الفارغة بترجع null (مش صفر)', () => {
  const f = loadScoreHelper();
  for (const bad of [null, undefined, {}, { score: null }, { score: undefined },
    { score: '' }, { score: 'abc' }, { score: NaN }, { score: 0 }]) {
    assert.equal(f(bad), null, 'قيمة ناقصة رجعت: ' + JSON.stringify(bad));
  }
});

/* ───────────────────────── ⑤ ───────────────────────── */
test('المسار القديم بيستخدم الدالة الجديدة ومش الحقل القديم مباشرة', () => {
  assert.ok(/oppScoreValue\(s\)/.test(PAGES), 'المسار القديم لسه مش بيستخدم oppScoreValue');
  assert.ok(!/\(s\.opportunity>0\)/.test(PAGES), 'القراءة القديمة لسه موجودة');
  assert.ok(!/\(s\.opportunity \|\| 0\)/.test(PAGES), 'القراءة القديمة لسه موجودة');
});

/* ───────────────────────── ⑥ ───────────────────────── */
test('رسالة «المحرك غير متاح مؤقتًا» معتمدة في شاشة الفرص', () => {
  const msg = 'محرّك الاستراتيجيات الجديد غير متاح مؤقتًا. تُعرض النسخة الأساسية للفرص إلى حين اكتمال التحديث.';
  assert.ok(OPPS.includes(msg), 'رسالة الحالة غير موجودة في octa-opps.js');
  assert.ok(/__oppNotPublished/.test(OPPS), 'العلامة __oppNotPublished اتشالت');
  /* ⛔ ممنوع نوعد بإعادة المحاولة في حالة عدم النشر */
  assert.ok(/opps-stale/.test(OPPS), 'الملاحظة التوضيحية اتشالت');
});
