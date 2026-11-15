/* ══════════════════════════════════════════════════════════════════════
   🧪🛡️ اختبار عزل لقطات المحرّك عن بناء الإنتاج
   ──────────────────────────────────────────────────────────────────────
   assets/tests/prod-snapshot-isolation.test.js

   📌 العيب المقاس (١٥ نوفمبر ٢٠٢٦):
      ① `build:strict` كان فيه OCTA_OPP_SNAPSHOT=1 و`deploy.sh` كان
         بيستعمل نفس البناء للمعاينة والإنتاج ⇒ ملفات
         `data/opp_snapshot.json` و`data/alpha_snapshot.json` كانت
         بتتنسخ في حزمة الإنتاج ⇒ وبتتقدّم على نطاق عام بلا توكن.
      ② اقتران المتغيّرات: شرط تخطّي ملف Alpha في `copy-data.js` كان
         معتمد على `keepSnapshot` ⇒ `OCTA_ALPHA_SNAPSHOT=0` ما كانش
         بيشتغل طول ما `OCTA_OPP_SNAPSHOT=1`.

   📌 التشغيل:  node --test assets/tests/prod-snapshot-isolation.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const COPY_SRC = fs.readFileSync(path.join(ROOT, 'tools', 'copy-data.js'), 'utf8');
const CHECK_SRC = fs.readFileSync(path.join(ROOT, 'tools', 'check-dist.js'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/* ═══ بيئة وهمية: بنسخ السكربتات في شجرة مؤقتة ═══
   السكربتان بيشتغلوا على path.join(__dirname, '..') ⇒ نسخهم في
   جذر مؤقت بيعمل نفس السلوك بالظبط على ملفات تجريبية. */
function makeTree(files) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'octa-snap-'));
  fs.mkdirSync(path.join(tmp, 'tools'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'data'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'dist'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'tools', 'copy-data.js'), path.join(tmp, 'tools', 'copy-data.js'));
  fs.copyFileSync(path.join(ROOT, 'tools', 'check-dist.js'), path.join(tmp, 'tools', 'check-dist.js'));
  for (const [name, body] of Object.entries(files || {})) {
    fs.writeFileSync(path.join(tmp, 'data', name), body, 'utf8');
  }
  return tmp;
}

function runCopy(tmp, env) {
  try {
    const out = execFileSync(process.execPath, [path.join(tmp, 'tools', 'copy-data.js')], {
      env: Object.assign({}, process.env, env || {}),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

function copied(tmp) {
  const dir = path.join(tmp, 'dist', 'data');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort();
}

const FIX = {
  'opp_snapshot.json': '{"ok":true}',
  'alpha_snapshot.json': '{"ok":true}',
  'other.json': '{"ok":true}',
};

/* ───────────────────────── ① ───────────────────────── */
test('لقطة الفرص ما بتتنسخش لو مفتاحها الخاص مطفي', () => {
  const tmp = makeTree(FIX);
  runCopy(tmp, { OCTA_OPP_SNAPSHOT: '0', OCTA_ALPHA_SNAPSHOT: '1', OCTA_BUILD_TARGET: 'preview' });
  const files = copied(tmp);
  assert.ok(!files.includes('opp_snapshot.json'), 'لقطة الفرص اتنسخت رغم OCTA_OPP_SNAPSHOT=0');
  assert.ok(files.includes('alpha_snapshot.json'), 'لقطة Alpha المفروض تنسخ (مفتاحها =1)');
  fs.rmSync(tmp, { recursive: true, force: true });
});

/* ───────────────────────── ② ───────────────────────── */
test('مفتاح Alpha مستقل — Opus=1 مع Alpha=0 ما ينسخش Alpha', () => {
  const tmp = makeTree(FIX);
  runCopy(tmp, { OCTA_OPP_SNAPSHOT: '1', OCTA_ALPHA_SNAPSHOT: '0', OCTA_BUILD_TARGET: 'preview' });
  const files = copied(tmp);
  assert.ok(!files.includes('alpha_snapshot.json'),
    'لقطة Alpha اتنسخت رغم OCTA_ALPHA_SNAPSHOT=0 (اقتران المتغيّرات)');
  assert.ok(files.includes('opp_snapshot.json'), 'لقطة الفرص المفروض تنسخ (مفتاحها =1)');
  fs.rmSync(tmp, { recursive: true, force: true });
});

/* ───────────────────────── ③ ───────────────────────── */
test('بناء الإنتاج ما بينسخش أي لقطة مهما كانت المتغيّرات', () => {
  const tmp = makeTree(FIX);
  runCopy(tmp, { OCTA_OPP_SNAPSHOT: '1', OCTA_ALPHA_SNAPSHOT: '1', OCTA_BUILD_TARGET: 'prod' });
  const files = copied(tmp);
  assert.ok(!files.includes('opp_snapshot.json'), 'لقطة الفرص اتنسخت في بناء إنتاجي');
  assert.ok(!files.includes('alpha_snapshot.json'), 'لقطة Alpha اتنسخت في بناء إنتاجي');
  fs.rmSync(tmp, { recursive: true, force: true });
});

/* ───────────────────────── ④ ───────────────────────── */
test('حارس النشر يرفض بناء إنتاجي فيه لقطات', () => {
  const tmp = makeTree(FIX);
  runCopy(tmp, { OCTA_OPP_SNAPSHOT: '1', OCTA_ALPHA_SNAPSHOT: '1', OCTA_BUILD_TARGET: 'preview' });
  const distData = path.join(tmp, 'dist', 'data');
  fs.mkdirSync(distData, { recursive: true });
  fs.writeFileSync(path.join(distData, 'opp_snapshot.json'), '{"ok":true}', 'utf8');
  fs.writeFileSync(path.join(distData, 'alpha_snapshot.json'), '{"ok":true}', 'utf8');
  const r = (() => {
    try {
      const out = execFileSync(process.execPath, [path.join(tmp, 'tools', 'check-dist.js')], {
        env: Object.assign({}, process.env, { OCTA_BUILD_TARGET: 'prod' }),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
    }
  })();
  assert.notEqual(r.code, 0, 'حarshal ما رفضش بناء إنتاجي فيه لقطات');
  assert.ok(/opp_snapshot\.json/.test(r.out), 'الرسالة لازم تذكر اسم الملف');
  fs.rmSync(tmp, { recursive: true, force: true });
});

/* ───────────────────────── ⑤ ───────────────────────── */
test('حارس النشر يعدّي بناء إنتاجي نضيف', () => {
  const tmp = makeTree({ 'other.json': '{"ok":true}' });
  runCopy(tmp, { OCTA_BUILD_TARGET: 'prod' });
  const r = (() => {
    try {
      const out = execFileSync(process.execPath, [path.join(tmp, 'tools', 'check-dist.js')], {
        env: Object.assign({}, process.env, { OCTA_BUILD_TARGET: 'prod' }),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
    }
  })();
  assert.equal(r.code, 0, 'حarshal رفض بناء إنتاجي نضيف: ' + r.out);
  fs.rmSync(tmp, { recursive: true, force: true });
});

/* ───────────────────────── ⑥ ───────────────────────── */
test('سكربتات البناء: مسار إنتاجي مستقل ومبني على fail-closed', () => {
  const scripts = PKG.scripts || {};
  assert.ok(scripts['build:prod'], 'مافيش build:prod');
  assert.ok(scripts['build:preview'], 'مافيش build:preview');
  assert.ok(/OCTA_BUILD_TARGET=prod/.test(scripts['build:prod']), 'build:prod مش مربوط بالهدف');
  assert.ok(/OCTA_OPP_SNAPSHOT=0/.test(scripts['build:prod']), 'build:prod مش مقفول للقطات');
  assert.ok(/OCTA_ALPHA_SNAPSHOT=0/.test(scripts['build:prod']), 'build:prod مش مقفول للقطات');
  /* ⛔ أي بناء افتراضي لازم يبقى آمن (مافيش لقطات) */
  const plain = scripts['build'] || '';
  assert.ok(!/OCTA_OPP_SNAPSHOT=1/.test(plain), 'البناء الافتراضي فيه لقطات');
  /* ⛔ build:strict كان مرجع deploy.sh — لازم يبقى آمن */
  if (scripts['build:strict']) {
    assert.ok(!/OCTA_OPP_SNAPSHOT=1/.test(scripts['build:strict']),
      'build:strict لسه فيه لقطات — أي مستخدم قديم هينشرها');
  }
});

/* ───────────────────────── ⑦ ───────────────────────── */
test('deploy.sh بيختار البناء حسب الهدف', () => {
  const dep = fs.readFileSync(path.join(ROOT, 'tools', 'deploy.sh'), 'utf8');
  assert.ok(/BUILD_CMD="build:prod"/.test(dep), 'مافيش مسار بناء إنتاجي في deploy.sh');
  assert.ok(/BUILD_CMD="build:preview"/.test(dep), 'مافيش مسار بناء معاينة في deploy.sh');
  assert.ok(/OCTA_BUILD_TARGET="\$TARGET"/.test(dep), 'الهدف مش بيتبعت للبناء');
  assert.ok(!/npm run build:strict/.test(dep), 'deploy.sh لسه بيستعمل البناء الموحّد');
});

/* ───────────────────────── ⑧ ───────────────────────── */
test('مصدر copy-data.js فيه استقلال المتغيّرات + قفل الإنتاج', () => {
  assert.ok(/IS_PROD_BUILD/.test(COPY_SRC), 'مافيش قفل بناء إنتاجي في copy-data.js');
  const alphaLine = COPY_SRC.split('\n').filter(l => /isAlpha \? keepAlpha/.test(l));
  assert.ok(alphaLine.length === 1, 'ملف Alpha لسه مربوط بـkeepSnapshot (اقتران)');
  assert.ok(!/!keepSnapshot && !\(isAlpha && keepAlpha\)/.test(COPY_SRC), 'الاقتران القديم لسه موجود');
});

/* ───────────────────────── ⑨ ───────────────────────── */
test('مصدر check-dist.js فيه حارس اللقطات للإنتاج', () => {
  assert.ok(/SNAPSHOT_FILES/.test(CHECK_SRC), 'مافيش قائمة لقطات في الحارس');
  assert.ok(/opp_snapshot\.json/.test(CHECK_SRC), 'الحارس مش فاحص لقطة الفرص');
  assert.ok(/alpha_snapshot\.json/.test(CHECK_SRC), 'الحارس مش فاحص لقطة Alpha');
});
