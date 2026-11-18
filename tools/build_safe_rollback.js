/* ═══════════════════════════════════════════════════════════════════════
   🛡️ الجولة ٢٤ (R24 · المرحلة الأولى) — بناء نسخة التراجع الآمنة محلياً
   ───────────────────────────────────────────────────────────────────────
   📌 المشكلة:
      النسخة الحيّة رقم ٢٣٦ فيها «حارس تسريب اللقطات» ⭐
      والنسخة رقم ٢٣٥ ما فيهاش الحارس ⭐
      ⇒ الرجوع المباشر لنسخة ٢٣٥ بيعيد فتح تسريب اللقطات ⭐.

   📌 المطلوب:
      نسخة تراجع محلية (في ملف ⭐ بدون نشر ⭐) تحافظ على حارس التسريب
      وتبني على أساس النسخة ٢٣٥ ⭐.

   ✅ الطريقة (قابلة لإعادة الإنتاج ⭐):
      ① الأساس       = `worker.js` عند كتلة الأساس (النسخة ٢٣٥ ⭐)
      ② الحارس       = فرق (diff) جولة ٢٣ على نفس الملف ⭐
      ③ الدمج        = تطبيق الفرق على الأساس بـ git apply ⭐
      ④ الاختبار     = tools/check_safe_rollback.js ⭐ (١٨ صيغة ⭐)

   ⛔ ممنوع: نشر ⭐ · لمس بيئة حيّة ⭐ · إنشاء أي مورد مدفوع ⭐.
   ⛔ مفيش كتابة على أي مستودع خارجي ⭐ — الملف كله محلي ⭐.

   📌 التشغيل:
      node tools/build_safe_rollback.js
      node tools/check_safe_rollback.js rollback/worker.v235-safe.js
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

/* ⭐ الأساس = آخر نسخة قبل حارس الجولة ٢٣ ⭐ (مطابقة لنسخة ٢٣٥ المنشورة ⭐) */
const BASE_COMMIT = process.env.R24_BASE_COMMIT || '71ba99a';
/* ⭐ الحارس = جولة ٢٣ (تطبيع المسار قبل بلوك اللقطات ⭐) */
const GUARD_COMMIT = process.env.R24_GUARD_COMMIT || '1ec73d8';
const OUT_REL = process.env.R24_OUT || 'rollback/worker.v235-safe.js';
const MANIFEST_REL = 'rollback/worker.v235-safe.manifest.json';

function git(args, opts) {
  return execFileSync('git', args, Object.assign({
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  }, opts || {}));
}

function sha256(buf) {
  return require('node:crypto').createHash('sha256').update(buf).digest('hex');
}

function main() {
  const baseSha = git(['rev-parse', BASE_COMMIT]).trim();
  const guardSha = git(['rev-parse', GUARD_COMMIT]).trim();

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r24-safe-'));
  try {
    /* ① الأساس */
    const baseSrc = git(['show', baseSha + ':worker.js']);
    fs.writeFileSync(path.join(tmp, 'worker.js'), baseSrc, 'utf8');

    /* ② الحارس = فرق جولة ٢٣ على نفس الملف */
    const patch = git(['diff', baseSha, guardSha, '--', 'worker.js']);
    fs.writeFileSync(path.join(tmp, 'guard.patch'), patch, 'utf8');

    /* ③ الدمج */
    execFileSync('git', ['apply', '--verbose', 'guard.patch'], {
      cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8'
    });

    const merged = fs.readFileSync(path.join(tmp, 'worker.js'), 'utf8');
    const guardRef = git(['show', guardSha + ':worker.js']);

    /* ⛔ sanity: الناتج لازم يحتوي الحارس ⭐ */
    if (merged.indexOf('function normalizeAssetPath(') === -1) {
      throw new Error('الحارس مش موجود في الناتج ⛔');
    }
    if (merged.indexOf('isSnapshotPath(url.pathname)') === -1) {
      throw new Error('نقطة بلوك اللقطات مش موجودة في الناتج ⛔');
    }

    const outAbs = path.join(ROOT, OUT_REL);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, merged, 'utf8');

    const manifest = {
      artifact: OUT_REL,
      purpose: 'rollback-safe worker bundle (v235 base + R23 snapshot guard)',
      base_commit: baseSha,
      base_commit_short: BASE_COMMIT,
      guard_commit: guardSha,
      guard_commit_short: GUARD_COMMIT,
      bytes: Buffer.byteLength(merged, 'utf8'),
      sha256: sha256(Buffer.from(merged, 'utf8')),
      identical_to_guard_commit_worker: merged === guardRef,
      patch_bytes: Buffer.byteLength(patch, 'utf8'),
      built_at: new Date().toISOString(),
      deployed: false,
      notes: [
        'ملف محلي ⭐ — مفيش نشر ⭐ ولا اتصال بأي بيئة حيّة ⭐.',
        'أساس النسخة ٢٣٥ + حارس الجولة ٢٣ ⭐.',
        'الاختبار: node tools/check_safe_rollback.js ' + OUT_REL
      ]
    };
    fs.writeFileSync(path.join(ROOT, MANIFEST_REL),
      JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    console.log('BUILT: ' + OUT_REL);
    console.log('BASE_COMMIT: ' + baseSha);
    console.log('GUARD_COMMIT: ' + guardSha);
    console.log('SHA256: ' + manifest.sha256);
    console.log('IDENTICAL_TO_GUARD_COMMIT_WORKER: ' +
      manifest.identical_to_guard_commit_worker);
    console.log('DEPLOYED: false');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main();
