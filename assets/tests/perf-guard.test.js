/* ══════════════════════════════════════════════════════════════
   ⚡ حارس السرعة — الصفحة الرئيسية ما تطلبش PAGE كاملة وقت الفتح
   ────────────────────────────────────────────────────────────────
   📌 القصة (١٤ نوفمبر ٢٠٢٦): قِسنا فتح الصفحة ⇒ ٣٧ طلب API
      و~١٫١ ميجا أصول ⇒ البوابة كانت واقفة ٥٫٤ ثانية ⛔.
      السبب: (١) طلب التحقق من الحساب وقف **ورا** طابور الطلبات،
      (٢) صفحات **مش مفتوحة** كانت بتطلب داتاها مع كل زيارة،
      (٣) مفيش كاش ⇒ الطلبات المكرّرة اتكرّرت (engine-weights ×٤).
   📌 الدرس: **الصفحة اللي المستخدم مش فاتحها ما تطلبش حاجة**
      + **الطلب الحرج يطلع قبل الطابور** + **الطلب المكرر يتدمج**.
   📌 الاختبار ده بيمنع الكارثة ترجع (حراسة على الكود نفسه).
   ══════════════════════════════════════════════════════════════ */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ═══ 1) مفيش صفحة بتعمل init تلقائي وقت تحميل الملف ═══
   📌 كل صفحة من دول ليها تهيئة بتتعمل وقت **فتحها**
   (octaPageInit في octa-core.js) ⇒ ما تتحمّلش مع كل زيارة. */
const LAZY_PAGES = [
  ['assets/js/octa-challenges.js', 'init'],
  ['assets/js/octa-setups.js', 'init'],
  ['assets/js/octa-zones.js', 'init'],
  ['assets/js/octa-studio.js', 'init'],
];

test('الصفحات المعلّقة ما تتحمّلش وقت فتح الموقع', () => {
  for (const [file, fn] of LAZY_PAGES) {
    const s = read(file);
    const auto = new RegExp("DOMContentLoaded[^\\n]*\\n?[^\\n]*" + fn + "\\(");
    assert.ok(!auto.test(s), file + ' لسه بيعمل ' + fn + '() تلقائي وقت التحميل');
  }
});

test('الفلتر (screener) ما بيحمّلش الداتا الكبيرة وقت الفتح', () => {
  const s = read('assets/js/octa-screener.js');
  assert.ok(!/DOMContentLoaded[^;\n]*scInit/.test(s),
    'scInit لسه بيتنده وقت تحميل الملف ( ده كان بيجيب ٣٢٠ ك.ب مع كل زيارة )');
});

test('صفحات octaPageInit بتنده التهيئة الصح', () => {
  const s = read('assets/js/octa-core.js');
  for (const id of ['setups', 'studio', 'zones', 'challenges']) {
    assert.ok(s.indexOf("id === '" + id + "'") >= 0, 'الصفحة ' + id + ' مش مربوطة');
  }
  assert.ok(s.indexOf('OCTASetups.init') >= 0, 'setups لازم ينادي init');
  assert.ok(s.indexOf('OCTAStudio.init') >= 0, 'studio لازم ينادي init');
  assert.ok(s.indexOf('OCTAZones.init') >= 0, 'zones لازم ينادي init');
  assert.ok(s.indexOf('OCTAChallenges.init') >= 0, 'challenges لازم ينادي init');
});

/* ═══ 2) طلب التحقق من الحساب يطلع قبل الطابور ═══ */
test('البوابة بتستخدم الـfetch الخام (مش الطابور)', () => {
  const g = read('assets/js/octa-gate.js');
  assert.ok(g.indexOf('OCTA_RAW_FETCH') >= 0,
    'البوابة لازم تستخدم الـfetch الخام ⇒ تخلص فوراً');
  const a = read('assets/js/octa-api.js');
  assert.ok(a.indexOf('window.OCTA_RAW_FETCH = ORIG_FETCH') >= 0,
    'الـfetch الخام لازم يكون متاح للصفحات الحرجة');
});

/* ═══ 3) الكاش لازم يحافظ على الـquery ═══
   📌 قبل كده كان بيشيل الـquery ⇒ /api/rank?limit=252 و
   /api/rank?limit=400 هياخدوا نفس الرد (رقم غلط). */
test('مفتاح الكاش بيحافظ على المعاملات', () => {
  const a = read('assets/js/octa-api.js');
  const fn = a.match(/function _octaCacheKey\(s\) \{[\s\S]*?\n\}/);
  assert.ok(fn, 'مالقيناش _octaCacheKey');
  assert.ok(fn[0].indexOf("indexOf('?')") < 0,
    'الكاش لسه بيشيل الـquery ⇒ روابط مختلفة هتاخد نفس الرد');
  assert.ok(fn[0].indexOf('_=[0-9]+') >= 0,
    'لازم نشيل الـcache-buster بس');
});

test('مسارات التحديث ما تتكاشش', () => {
  const a = read('assets/js/octa-api.js');
  const list = a.match(/var OCTA_CACHE_PATHS = \[([\s\S]*?)\];/);
  assert.ok(list, 'مالقيناش OCTA_CACHE_PATHS');
  for (const p of ['/api/data_full', '/api/alerts/watch', '/api/subscriptions']) {
    assert.ok(list[1].indexOf(p) < 0,
      p + ' اتكاش ⇒ زرار التحديث هيجيب بيانات قديمة');
  }
  assert.ok(list[1].indexOf('/api/rank') >= 0, '/api/rank لازم يكون في الكاش');
});

/* ═══ 4) الصفحة الرئيسية ما تستناش الداتا الكبيرة ═══ */
test('الصفحة الرئيسية بتستخدم /api/rank بدل data_full', () => {
  const s = read('assets/js/octa-app.js');
  assert.ok(s.indexOf("/api/rank?limit=400") >= 0,
    'الصفحة الرئيسية لازم تاخد الدرجات من /api/rank');
});
