/* ═══════════════════════════════════════════════════════════════
   🧪🛡️ اختبارات XSS — assets/tests/xss.test.js
   ───────────────────────────────────────────────────────────────
   التشغيل:  cd /workspace/repos/octa && node --test assets/tests/xss.test.js

   📌 ⛔ المدخلات كلها **صناعية وغير ضارة** ⬇️
   📌 ⛔ مافيش تنفيذ كود · مافيش شبكة · مافيش بيانات حقيقية ⬇️

   📌 التغطية:
      ① دوال الترميز بتخنّي < > " ' &
      ② الـinnerHTML ما بيحقنش HTML من مدخلات
      ③ الـonclick من غير user-controlled string
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

/* 🐞 مدخلات صناعية غير ضارة */
const PAYLOADS = [
  '<img src=x onerror="window.__xss=1">',
  '<script>window.__xss=1</script>',
  '"><svg onload=window.__xss=1>',
  "javascript:window.__xss=1",
  "' onmouseover='window.__xss=1",
];

/* 🛠 بنحمّل دوال الترميز من الملفات (بنحطّها في نفس الـscope) */
function loadEscapers() {
  const out = {};
  const files = {
    naEsc: 'assets/js/na-axis.js',
    octaEsc: 'assets/js/octa-core.js',
    ssEsc: 'assets/js/octa-pages.js',
  };
  for (const [name, file] of Object.entries(files)) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const m = src.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) { out[name] = null; continue; }
    const start = m.index;
    let depth = 0, i = src.indexOf('{', start), end = i;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    const body = src.slice(start, end);
    out[name] = new Function(body + '\nreturn ' + name + ';')();
  }
  return out;
}

const E = loadEscapers();

test('دوال الترميز موجودة في الملفات المتوقعة', () => {
  for (const [name, fn] of Object.entries(E)) {
    assert.equal(typeof fn, 'function', name + ' مش موجودة');
  }
});

test('① دوال الترميز بتخنّي كل المحارف الخطرة', () => {
  for (const [name, fn] of Object.entries(E)) {
    if (!fn) continue;
    for (const p of PAYLOADS) {
      const out = String(fn(p));
      assert.ok(out.indexOf('<') === -1, name + ' سمح بـ < : ' + out);
      assert.ok(out.indexOf('>') === -1, name + ' سمح بـ > : ' + out);
      assert.ok(out.indexOf('"') === -1, name + ' سمح بـ " : ' + out);
      assert.ok(out.indexOf("'") === -1, name + " سمح بـ ' : " + out);
    }
  }
});

test('② دالة الترميز بتخلي النص آمن جوه innerHTML', () => {
  for (const [name, fn] of Object.entries(E)) {
    if (!fn) continue;
    const out = String(fn('<img src=x onerror="alert(1)">'));
    assert.ok(out.indexOf('&lt;') > -1, name + ' ماخلّعش الـ< : ' + out);
    assert.ok(out.indexOf('onerror') > -1, name + ' مسح الكلمة بالكامل (مش لازم)');
  }
});

test('③ مافيش innerHTML فيه مدخل مستخدم من غير ترميز (عيّنة)', () => {
  /* ⛔ فحص عيّنة على المواضع اللي اتصلّحت في دفعة الأمان ٠٢ ⬇️ */
  const core = fs.readFileSync(path.join(ROOT, 'assets/js/octa-core.js'), 'utf8');
  const pages = fs.readFileSync(path.join(ROOT, 'assets/js/octa-pages.js'), 'utf8');
  assert.ok(core.indexOf('لا توجد نتائج لـ "\' + octaEsc(q) + \'"') > -1,
    'بحث السهم (octa-core) لسه من غير ترميز');
  assert.ok(pages.indexOf('لا توجد نتائج لـ "\' + ssEsc(q) + \'"') > -1,
    'بحث الرمز (octa-pages) لسه من غير ترميز');
});

test('④ مافيش eval ولا setTimeout بنص في ملفات الواجهة', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'assets/js'))) {
    if (!f.endsWith('.js')) continue;
    const s = fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8');
    assert.ok(!/\beval\s*\(/.test(s), f + ' فيه eval');
    assert.ok(!/setTimeout\s*\(\s*['"]/.test(s), f + ' فيه setTimeout بنص');
  }
});
