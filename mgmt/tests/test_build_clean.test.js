/* ══════════════════════════════════════════════════════════════════════
   🧹 اختبار «بناء نظيف» — لوحة الإدارة
   ──────────────────────────────────────────────────────────────────────
   🎯 الهدف: ملف public/index.html (الملف اللي بيتقدّم للعموم) ما فيهوش
      أي بيانات مستخدمين حقيقية: لا إيميلات ولا عناوين IP.
   ⛔ الأرقام فقط في الرسايل — ما بنطبعش أي قيمة.
   ⛔ التشغيل:
      node --test mgmt/tests/
      MGMT_PUBLIC=<public dir> node --test mgmt/tests/
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { scan } = require('./lib/leakscan.js');

const MGMT = path.join(__dirname, '..');
const PUBLIC = process.env.MGMT_PUBLIC || path.join(MGMT, 'public');
const INDEX = path.join(PUBLIC, 'index.html');
const GUARD = path.join(MGMT, 'check_build_clean.py');

test('ملف index.html بعد البناء نظيف — مافيش إيميلات ولا IP', () => {
  assert.ok(fs.existsSync(INDEX), 'مافيش index.html: ' + INDEX);
  const body = fs.readFileSync(INDEX, 'utf8');
  const s = scan(body);
  assert.equal(s.emails, 0, 'index.html فيه ' + s.emails + ' إيميل (بيانات شخصية مدمجة)');
  assert.equal(s.ips, 0, 'index.html فيه ' + s.ips + ' عنوان IP (بيانات شخصية مدمجة)');
  assert.equal(s.hosts, 0, 'index.html فيه ' + s.hosts + ' عنوان backend (تسريب داخلي)');
});

test('مافيش بيانات مدمجة في أي ملف من مجلد public', () => {
  const files = fs
    .readdirSync(PUBLIC, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => path.join(PUBLIC, d.name));
  let bad = 0;
  files.forEach((f) => {
    const s = scan(fs.readFileSync(f, 'utf8'));
    if (s.emails || s.ips) bad += 1;
  });
  assert.equal(bad, 0, bad + ' ملف في public فيه بيانات شخصية');
});

test('حارس البناء: نظيف ⇒ exit 0 · ملوّث ⇒ exit ≠ 0', () => {
  assert.ok(fs.existsSync(GUARD), 'مافيش حارس البناء: ' + GUARD);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'octa-guard-'));
  const dirty = path.join(tmp, 'dirty.html');
  /* ⛔ بيانات اصطناعية للاختبار فقط (مش بيانات حقيقية) */
  fs.writeFileSync(
    dirty,
    '<html><body><script>var DATA={"email":"qa.fixture@example.invalid","ip":"203.0.113.7"};</script></body></html>',
    'utf8'
  );
  const clean = path.join(tmp, 'clean.html');
  fs.writeFileSync(clean, '<html><body><h1>نظيف</h1></body></html>', 'utf8');

  const run = (target) => {
    try {
      execFileSync('python3', [GUARD, target], { stdio: 'pipe' });
      return 0;
    } catch (e) {
      return typeof e.status === 'number' ? e.status : 1;
    }
  };

  const rcClean = run(clean);
  const rcDirty = run(dirty);
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.equal(rcClean, 0, 'الحارس لازم ينجح على ملف نظيف — got ' + rcClean);
  assert.notEqual(rcDirty, 0, 'الحارس لازم يفشل على ملف فيه بيانات — got ' + rcDirty);
});

test('صفحة الدخول (login.html) موجودة ونظيفة', () => {
  const login = path.join(PUBLIC, 'login.html');
  assert.ok(fs.existsSync(login), 'مافيش login.html — البوابة محتاجة صفحة دخول مستقلة');
  const s = scan(fs.readFileSync(login, 'utf8'));
  assert.equal(s.emails, 0, 'login.html فيه ' + s.emails + ' إيميل');
  assert.equal(s.ips, 0, 'login.html فيه ' + s.ips + ' عنوان IP');
});
