/* ══════════════════════════════════════════════════════════════════
   🛡️ دفعة الأمان ٠١ — اختبارات الواجهة (١٥ نوفمبر ٢٠٢٦)
   ──────────────────────────────────────────────────────────────────
   📌 كل اختبار هنا **ثابت** (static) — بيقرا الكود وبيتحقق ⬇️
   📌 ⬇️ ⇒ بيتكرر مع أي commit (مش قياس يدوي) ⬇️ ⬇️
   📌 الهدف: يمنع رجوع الإصلاحات الأمنية في الواجهة ⬇️
   ══════════════════════════════════════════════════════════════════ */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const API = read('assets/js/octa-api.js');
const GATE = read('assets/js/octa-gate.js');
const WORKER = read('worker.js');
const RESET = read('reset.html');

/* ──────────────────────────────────────────────────────────────────
   ١) الكاش العام مابيلمسش حالة المستخدم
   ────────────────────────────────────────────────────────────────── */
test('🛡️ مسارات حالة المستخدم بره الكاش العام', () => {
  assert.ok(/NO_CACHE_PATHS/.test(API),
    'NO_CACHE_PATHS مش موجود');
  for (const p of ['/api/auth/me', '/api/portfolio', '/api/alerts/watch',
                   '/api/dashboard', '/api/subscriptions/me']) {
    assert.ok(API.includes("'" + p + "'"),
      'المسار مش في قائمة الاستثناء: ' + p);
  }
  assert.ok(/_isUserState/.test(API), 'دالة _isUserState مش موجودة');
  assert.ok(/_isGet\s*&&\s*!_isUserState/.test(API),
    'الكاش مابيفحصش _isUserState قبل ما يخزّن');
});

/* ──────────────────────────────────────────────────────────────────
   ٢) سبب رفض البصمة بيوصل للمستخدم (مش بيمسح في نفس اللحظة)
   ────────────────────────────────────────────────────────────────── */
test('🛡️ سبب رفض البصمة بيتقول (fingerprint_disabled + need_pin)', () => {
  assert.ok(/fingerprint_disabled/.test(GATE),
    'السبب fingerprint_disabled مش متعامل معاه');
  assert.ok(/need_pin/.test(GATE), 'السبب need_pin مش متعامل معاه');
  /* ⛔ لازم toast — مش #gtMsg بس (لأن login(1) بيمسحه) */
  assert.ok(/toast\(msg,\s*true\)/.test(GATE),
    'مافيش toast بعد رفض البصمة ⇒ المستخدم مش هيشوف السبب');
  assert.ok(/function toast\(/.test(GATE), 'دالة toast مش موجودة');
});

/* ──────────────────────────────────────────────────────────────────
   ٣) تنظيف الموقع ⇒ إبطال الجلسة على السيرفر (مش مسح كوكي بس)
   ────────────────────────────────────────────────────────────────── */
test('🛡️ reset.html بيقفل الجلسة على السيرفر', () => {
  assert.ok(/auth\/logout/.test(RESET),
    'reset.html مابيغلقش الجلسة على السيرفر');
  assert.ok(/credentials:\s*'include'/.test(RESET),
    'reset.html مابيتبعثش الكوكي مع طلب الخروج');
});

/* ──────────────────────────────────────────────────────────────────
   ٤) الـWorker بيوقّع الطلب بالسر + يبعت IP العميل الموثوق
   ────────────────────────────────────────────────────────────────── */
test('🛡️ الـWorker بيبعت السر والـIP الموثوق للـbackend', () => {
  assert.ok(/OCTA_PROXY_SECRET/.test(WORKER),
    'السر مش متظبط في الـworker');
  assert.ok(/X-OCTA-Proxy/.test(WORKER),
    'ترويسة X-OCTA-Proxy مش مبعوتة');
  assert.ok(/X-OCTA-Client-IP/.test(WORKER),
    'ترويسة X-OCTA-Client-IP مش مبعوتة');
  assert.ok(/buildHeaders\(request,\s*env\)/.test(WORKER),
    'buildHeaders مابياخدش الـenv ⇒ السر مش هيوصل');
  /* ⛔⛔ لازم يكون جوّه شرط (لو الـsecret مش متظبطلوش ⇒ مافيش ترويسة) */
  assert.ok(/if \(ps\)/.test(WORKER),
    'السر بيتبعث دايماً — لازم يكون جوّه شرط');
});

/* ──────────────────────────────────────────────────────────────────
   ٥) ⛔ مافيش أسرار مكتوبة في الكود
   ────────────────────────────────────────────────────────────────── */
test('🛡️ مافيش مفتاح أدمن ولا سر توكن مكتوب في الكود', () => {
  const bad = [
    [/X-OCTA-Admin['"]\s*[:=]\s*['"][A-Za-z0-9_-]{12,}/, 'مفتاح أدمن مكتوب'],
    [/octa_token['"]\s*[:=]\s*['"][A-Za-z0-9_-]{20,}/, 'توكن مكتوب'],
  ];
  for (const [re, label] of bad) {
    for (const [name, src] of [['worker.js', WORKER], ['octa-api.js', API],
                                ['octa-gate.js', GATE], ['reset.html', RESET]]) {
      assert.ok(!re.test(src), label + ' في ' + name);
    }
  }
});
