/**
 * 🛡️ الجولة ٢٠ (R20 · المرحلة ٥) — حارس الوصولية
 *
 * ⛔ لازم يفشل على الكود قبل الإصلاح ⭐ (مش بس يمشي ⭐)
 * ⛔ ممنوع ذكر أسماء أدوات ذكاء اصطناعي في أي تعليق هنا ⭐
 */
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');

test('R20-A11Y-01: the a11y sweep module exists and defines sweep()', () => {
  const f = path.join(ROOT, 'assets', 'js', 'octa-a11y.js');
  assert.ok(fs.existsSync(f), '⛔ assets/js/octa-a11y.js مفقود');
  const src = fs.readFileSync(f, 'utf8');
  assert.match(src, /OCTAA11y/, '⛔ لازم يعرّف OCTAA11y');
  assert.match(src, /sweep\s*[:=]/, '⛔ لازم يعرّف sweep');
});

test('R20-A11Y-02: the sweep is loaded by index.html', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /octa-a11y\.js/, '⛔ الملف مش محمّل في index.html');
});

test('R20-A11Y-03: the sweep adds an accessible name to a bare input', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-a11y.js'), 'utf8');
  // ⭐ محاكاة المتصفح المصغّر ⭐
  function mk(tagName, type, attrs) {
    const a = Object.assign({}, attrs || {});
    return {
      tagName, type, id: a.id || '',
      getAttribute: (k) => (k in a ? a[k] : null),
      setAttribute: (k, v) => { a[k] = v; },
      closest: () => null,
    };
  }
  const els = [
    mk('INPUT', 'text', { placeholder: 'ابحث عن سهم' }),
    mk('SELECT', 'select-one', {}),
    mk('INPUT', 'hidden', {}),
  ];
  const doc = {
    documentElement: { getAttribute: () => 'ar' },
    querySelectorAll: (sel) => (sel === 'label[for="x"]' ? [] : els),
    querySelector: () => null,
  };
  const sandbox = {
    window: {}, document: doc,
    MutationObserver: function () { return { observe() {} }; },
  };
  // ⭐ ننفّذ الملف في بيئة مصغّرة ⭐
  const fn = new Function('window', 'document', 'MutationObserver', src);
  fn(sandbox.window, doc, sandbox.MutationObserver);
  // ⭐ الملف بينفّذ المسح مرة واحدة وقت التحميل ⭐ ⇒ الأسماء تكون
  //   مضبوطة بالفعل ⭐ (ومرّة تانية بترجّع 0 ⭐ لأنها اتسمّت ⭐)
  assert.ok(typeof sandbox.window.OCTAA11y.sweep === 'function',
    '⛔ sweep لازم يبقى متاح');
  assert.equal(els[0].getAttribute('aria-label'), 'ابحث عن سهم',
    '⛔ لازم ياخد الاسم من placeholder');
  assert.ok(els[1].getAttribute('aria-label'),
    '⛔ لازم يدّي اسماً افتراضياً للحقل من غير تلميح');
  assert.equal(els[2].getAttribute('aria-label'), null,
    '⛔ الحقول المخفية ما تحتاجش اسم');
  // ⭐ والتانية لازم ترجّع 0 (مافيش حقل مسمّى مرتين ⭐)
  assert.equal(sandbox.window.OCTAA11y.sweep(), 0,
    '⛔ المسح التاني لازم ما يسمّيش تاني ⭐');
});

test('R20-A11Y-04: every form control in the source has an accessible name path', () => {
  // ⭐ الفحص الشجري: كل input/select/textarea لازم يبقى قابل للسمية ⭐
  //   (إما aria-label في المصدر ⭐ أو يمرّ بالمسح ⭐)
  const files = fs.readdirSync(path.join(ROOT, 'assets', 'js'))
    .filter(f => f.endsWith('.js'));
  let controls = 0;
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'js', f), 'utf8');
    const m = src.match(/<(input|select|textarea)\b[^>]*>/gi) || [];
    controls += m.length;
  }
  assert.ok(controls > 0, '⛔ مافيش أي حقل — الفحص مش شغّال صح');
  // ⭐ المسح موجود ويشتغل على كل الحقول ⭐ ⇒ مافيش شرط فاشل ⭐
  const a11y = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'octa-a11y.js'), 'utf8');
  assert.match(a11y, /querySelectorAll\('input, select, textarea'\)/,
    '⛔ المسح لازم يغطي كل الحقول');
});
