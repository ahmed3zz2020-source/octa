#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   🛡️ حارس النشر الدائم — يمنع تكرار حادث ٩ نوفمبر ٢٠٢٦
   ──────────────────────────────────────────────────────────────────────
   📌 العيب الليBf��ى: `npm run deploy` = `wrangler deploy` بلا --config
      ⇒ wrangler بياخد wrangler.jsonc ⇒ اسمه "octa" = الإنتاج!
      ⇒ ٤ نشرات متتالية على الإنتاج في ٥٢ ثانية.

   📌 هذا الاختبار بيتشيك على:
      ① `npm run deploy` ما ينشرش على الإنتاج (لازم --config للمعاينة)
      ② مفيش سكربت في الريبو بينشر على الإنتاج بلا حارس
      ③ `wrangler.jsonc` (الافتراضي) مينفعش يكون الإنتاج
         ⇐ الحل: الافتراضي = المعاينة، والإنتاج = ملف منفصل+cargo
      ④ حارس الإنتاج (tools/deploy.sh) موجود وبيقفل من غير العبارة

   📌 التشغيل: node tools/check-deploy-guard.js
   ══════════════════════════════════════════════════════════════════════ */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = [];
let checks = 0;

function ok(cond, label, detail) {
  checks++;
  if (cond) {
    console.log('  ✅ ' + label);
  } else {
    console.log('  ❌ ' + label + (detail ? ' — ' + detail : ''));
    failures.push(label + (detail ? ' — ' + detail : ''));
  }
}

function read(p) {
  try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
  catch (e) { return ''; }
}

/* ⓪⭐ بصمة البناء في حارس النشر (١٢ نوفمبر ٢٠٢٦) */
console.log('\n▸ فحص بصمة البناء (ضد النسخة القديمة)');
const depSh = read('tools/deploy.sh');
ok(/LOCAL_BUILD/.test(depSh) && /LIVE_BUILD/.test(depSh),
  'حارس النشر بيقرأ ختم البناء (محلي + مخدوم)');
ok(/BUILD = 'v=\[0-9\]\+'/i.test(depSh) || /BUILD = 'v=/.test(depSh),
  'حارس النشر بيطابق ختم البناء');
ok(depSh.indexOf('LOCAL_BUILD') < depSh.indexOf('LIVE_BUILD') ||
   depSh.indexOf('LIVE_BUILD') > 0,
  'مقارنة الختم موجودة في الحارس');
const idxHtml = read('index.html');
ok(/BUILD = 'v=[0-9]+'/.test(idxHtml),
  'index.html فيه ختم بناء (للمقارنة)');

/* ⓪ الملفات الأساسية موجودة */
console.log('\n▸ الملفات الأساسية');
ok(fs.existsSync(path.join(ROOT, 'tools/deploy.sh')), 'tools/deploy.sh موجود');
ok(fs.existsSync(path.join(ROOT, 'tools/check-deploy-guard.js')), 'tools/check-deploy-guard.js موجود');

/* ① npm run deploy ما ينشرش على الإنتاج */
console.log('\n▸ سكربتات npm');
let pkg = {};
try { pkg = JSON.parse(read('package.json')); } catch (e) { }
const scripts = pkg.scripts || {};
ok(!!scripts.deploy, 'فيه سكربت deploy');
ok(!/\bwrangler\s+deploy\b/.test(scripts.deploy || '') || /--config\s+wrangler-preview\.jsonc/.test(scripts.deploy || ''),
  'npm run deploy ما فيهش wrangler deploy بلا --config',
  scripts.deploy);
ok(/deploy\.sh\s+preview/.test(scripts.deploy || ''),
  'npm run deploy بيشغّل حارس النشر على المعاينة', scripts.deploy);
ok(/deploy\.sh\s+prod/.test(scripts['deploy:prod'] || ''),
  'npm run deploy:prod موجود وبيمشي بالحارس', scripts['deploy:prod']);

/* ② مفيش سكربت آخر بينشر على الإنتاج بلا حارس */
console.log('\n▸ سكربتات تانية في الريبو');
const toolsDir = path.join(ROOT, 'tools');
let offenders = [];
if (fs.existsSync(toolsDir)) {
  for (const f of fs.readdirSync(toolsDir)) {
    if (!/\.(js|mjs|sh)$/.test(f)) continue;
    if (f === 'check-deploy-guard.js' || f === 'deploy.sh') continue;
    const txt = read(path.join('tools', f));
    /* 📌 نشيل التعليقات الأول ⇒ سطر في كومنت مش أمر */
    const code = txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    if (!/wrangler\s+deploy/.test(code)) continue;
    /* ⛔ مسموح لو: (أ) فيه --config للمعاينة، (ب) فيه --config للإنتاج + حارس ALLOW_PROD */
    const hasPreview = /--config\s+wrangler-preview\.jsonc/.test(txt);
    const hasProd = /--config\s+wrangler\.jsonc/.test(txt);
    const hasGuard = /ALLOW_PROD/.test(txt) || /deploy\.sh/.test(txt);
    if (!hasPreview && !(hasProd && hasGuard)) {
      offenders.push(f);
    }
  }
}
ok(offenders.length === 0,
  'مفيش سكربت بينشر على الإنتاج بلا --config + حارس',
  offenders.join(', '));

/* ③ الافتراضي (wrangler.jsonc) = preview مش إنتاج */
console.log('\n▸ الإعدادات');
function nameOf(file) {
  const txt = read(file);
  if (!txt) return null;
  const m = txt.match(/"name"\s*:\s*"([^"]+)"/);
  return m ? m[1] : null;
}
const defaultName = nameOf('wrangler.jsonc');
ok(defaultName !== null, 'wrangler.jsonc موجود وفيه name', String(defaultName));
ok(defaultName !== 'octa',
  'wrangler.jsonc (الافتراضي) مش الإنتاج — عشان الأمر بلا --config يبقى آمن',
  'name=' + defaultName);
ok(defaultName === 'octa-preview',
  'الافتراضي = octa-preview (المعاينة)', String(defaultName));
ok(nameOf('wrangler-prod.jsonc') === 'octa',
  'wrangler-prod.jsonc = octa (الإنتاج) — لازم --config صريح',
  String(nameOf('wrangler-prod.jsonc')));
/* ⛔ مفيش ملف إعدادات تاني لازم يكون الإنتاج (فخ محتمل) */
let prodFiles = [];
for (const f of fs.readdirSync(ROOT)) {
  if (!/^wrangler.*\.jsonc$/.test(f)) continue;
  if (nameOf(f) === 'octa') prodFiles.push(f);
}
ok(prodFiles.length === 1 && prodFiles[0] === 'wrangler-prod.jsonc',
  'ملف واحد بس للإنتاج (wrangler-prod.jsonc) — مفيش فخ تاني',
  prodFiles.join(', '));

/* ④ حارس الإنتاج بيقفل من غير العبارة */
console.log('\n▸ حارس الإنتاج');
const guard = read('tools/deploy.sh');
ok(/PUBLISH_PROD/.test(guard), 'الحارس بيطلب PUBLISH_PROD');
ok(/ارفع على الدومين/.test(guard), 'الحارس بيطلب العبارة الصريحة');
ok(/exit 1/.test(guard), 'الحارس بيرجع كود خطأ عند الرفض');
ok(/rollback/.test(guard), 'الحارس فيه تراجع تلقائي');
ok(/--yes/.test(guard), 'التراجع بيستخدم --yes (من غيرها بيسأل أسئلة وبيكسر)');

/* ⑤ مفيش توكن/سر في الريبو */
console.log('\n▸ أسرار');
const secretHits = [];
for (const f of ['package.json', 'tools/deploy.sh', 'halan-news.js', 'worker.js']) {
  const txt = read(f);
  if (/HALAN_MCP_REFRESH_TOKEN\s*[=:]\s*['"][^'"]{20,}/.test(txt)) secretHits.push(f);
}
ok(secretHits.length === 0, 'مفيش أسرار Halan مكتوبة في الكود', secretHits.join(', '));

/* ── النتيجة ── */
console.log('');
if (failures.length) {
  console.log('❌ فشل ' + failures.length + ' من ' + checks + ' فحص:');
  for (const f of failures) console.log('   · ' + f);
  console.log('');
  console.log('⛔⛔⛔ ده خطر نشر على الإنتاج — شوف docs/POSTMORTEM-2026-11-09-deploy-accident.md');
  process.exit(1);
}
console.log('✅ كل فحوصات حارس النشر نجحت (' + checks + ' فحص).');
