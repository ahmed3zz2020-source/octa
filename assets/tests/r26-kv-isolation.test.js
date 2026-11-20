/* ═══════════════════════════════════════════════════════════════════════
 *  🧪🛡️ الجولة ٢٦ (R26) · حارس فصل مساحات KV
 *  ───────────────────────────────────────────────────────────────────────
 *  📌 العيب المقاس ⭐:
 *     لوحة الأدمن (`mgmt/wrangler.jsonc` ⭐) كانت بتربط `REVOKE_KV` ⭐
 *     على **نفس** مساحة `octa-halan-cache` ⭐ (= `HALAN_KV` ⭐ عند الموقع ⭐).
 *  ⛔ الأثر ⭐: ⭐ عامل الموقع (octa ⭐ / octa-preview ⭐) وعامل halan-feed ⭐
 *     عندهم ⭐ صلاحية كتابة ⭐ على نفس المساحة ⭐
 *     ⇒ ⭐ يقدروا ⭐ يمسحوا ⭐ علامات إبطال جلسات الأدمن (`rev:*` ⭐)
 *     ⇒ ⛔ جلسة مبتطللة ترجع تُقبل ⭐ (fail-open ⭐).
 *  ✅ المعيار ⭐:
 *     ① مساحة الإبطال ⭐ ≠ ⭐ مساحة كاش السوق ⭐ (في كل ملفات الإعدادات ⭐).
 *     ② عاملو الموقع ⭐ ⛔ ما يربطوش ⭐ `REVOKE_KV` ⭐.
 *     ③ لوحة الأدمن ⭐ لازم تعلن `APP_ENV=production` ⭐ + الـDO + الـmigration ⭐.
 *  📌 كل الاختبارات **محدّدة** ⭐ (مفيش شبكة ⭐).
 *  📌 التشغيل: node --test assets/tests/r26-kv-isolation.test.js
 *  ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

/* ⭐ قراءة JSONC ⭐ (شيل التعليقات ⭐ — مع احترام النصوص ⭐) */
function readJsonc(file) {
  const raw = fs.readFileSync(file, 'utf8');
  let out = '';
  let inStr = false;
  let inBlock = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    const n = raw[i + 1];
    if (inBlock) {
      if (c === '*' && n === '/') { inBlock = false; i++; }
      continue;
    }
    if (inStr) {
      out += c;
      if (c === '\\') { out += raw[i + 1] || ''; i++; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    if (c === '/' && n === '/') {
      while (i < raw.length && raw[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    out += c;
  }
  return JSON.parse(out);
}

const MGMT = readJsonc(path.join(ROOT, 'mgmt', 'wrangler.jsonc'));
const SITE_PREVIEW = readJsonc(path.join(ROOT, 'wrangler.jsonc'));
const SITE_PROD = readJsonc(path.join(ROOT, 'wrangler-prod.jsonc'));

function kvId(cfg, binding) {
  const list = cfg.kv_namespaces || [];
  const hit = list.find((k) => k.binding === binding);
  return hit ? hit.id : null;
}

/* ═══════════════════════════════════════════════════════════════════════
 *  ① ⭐⭐ الفصل الفعلي ⭐⭐
 *  ═══════════════════════════════════════════════════════════════════════ */
test('R26-KV-01 · مساحة إبطال جلسات الأدمن ⛔ مختلفة ⭐ عن مساحة كاش السوق', () => {
  const revoke = kvId(MGMT, 'REVOKE_KV');
  const halanPrev = kvId(SITE_PREVIEW, 'HALAN_KV');
  const halanProd = kvId(SITE_PROD, 'HALAN_KV');
  assert.ok(revoke, '⛔⛔⛔ مافيش ربط REVOKE_KV ⭐ في لوحة الأدمن ⭐');
  assert.ok(halanPrev, '⛔⛔⛔ مافيش ربط HALAN_KV ⭐ في إعدادات المعاينة ⭐');
  assert.ok(halanProd, '⛔⛔⛔ مافيش ربط HALAN_KV ⭐ في إعدادات الإنتاج ⭐');
  assert.notEqual(revoke, halanPrev,
    '⛔⛔⛔ مساحة الإبطال رجعت لنفس مساحة كاش المعاينة ⭐ ⇒ عامل الموقع يقدر يمسح علامات الإبطال ⭐');
  assert.notEqual(revoke, halanProd,
    '⛔⛔⛔ مساحة الإبطال رجعت لنفس مساحة كاش الإنتاج ⭐ ⇒ عامل الموقع يقدر يمسح علامات الإبطال ⭐');
});

test('R26-KV-02 · مساحة الإبطال ⭐ هي المخصّصة ⭐ (octa-session-revocation)', () => {
  const revoke = kvId(MGMT, 'REVOKE_KV');
  assert.equal(revoke, 'bbbbeb98fd604c07980da23e99848209',
    '⛔⛔⛔ مساحة الإبطال ما بقاش المخصّصة ⭐ (حد رجّعها القديمة ⭐)');
});

test('R26-KV-03 · عاملو الموقع ⛔ ما يربطوش ⭐ REVOKE_KV ⭐ (مفيش امتياز زيادة ⭐)', () => {
  for (const [name, cfg] of [['المعاينة', SITE_PREVIEW], ['الإنتاج', SITE_PROD]]) {
    assert.equal(kvId(cfg, 'REVOKE_KV'), null,
      '⛔⛔⛔ إعدادات ' + name + ' ⭐ مربوطة بـREVOKE_KV ⭐ ⇒ ⭐ صلاحية زيادة ⭐');
  }
});

/* ═══════════════════════════════════════════════════════════════════════
 *  ② ⭐⭐ جاهزية الإنتاج ⭐⭐ (منظومة الجلسات R26 ⭐)
 *  ═══════════════════════════════════════════════════════════════════════ */
test('R26-KV-04 · لوحة الأدمن تعلن APP_ENV=production ⭐ (fail-closed ⭐)', () => {
  assert.equal((MGMT.vars || {}).APP_ENV, 'production',
    '⛔⛔⛔ لوحة الأدمن ⭐ ما علامتش إنها إنتاج ⭐ ⇒ ⛔ الدخول يظل شغّال من غير مصدر إبطال ⭐');
});

test('R26-KV-05 · لوحة الأدمن مربوطة بالـDO ⭐ + الـmigration ⭐ (المرجع القوي ⭐)', () => {
  const bindings = (MGMT.durable_objects || {}).bindings || [];
  const hit = bindings.find((b) => b.name === 'REVOKE_DO');
  assert.ok(hit, '⛔⛔⛔ مافيش ربط REVOKE_DO ⭐ ⇒ ⛔ مافيش مصدر إبطال قوي ⭐');
  assert.equal(hit.class_name, 'RevokeDO');
  const tags = (MGMT.migrations || []).map((m) => m.tag);
  assert.ok(tags.includes('v1'), '⛔⛔⛔ مافيش migration v1 ⭐');
  const v1 = (MGMT.migrations || []).find((m) => m.tag === 'v1');
  assert.ok((v1.new_sqlite_classes || []).includes('RevokeDO'),
    '⛔⛔⛔ migration v1 ⭐ لازم يسجّل RevokeDO ⭐ (SQLite ⭐ مش key-value ⭐)');
});

/* ═══════════════════════════════════════════════════════════════════════
 *  ③ ⭐⭐ الكاش العام ⭐⭐ — يفضل **مشترك** ⭐ (قرار مقصود ⭐)
 *  ═══════════════════════════════════════════════════════════════════════ */
test('R26-KV-06 · ⭐⭐⭐ (R28 · R26-I05) ⭐ كاش السوق ⭐ **منفصل** ⭐ بين المعاينة والإنتاج ⭐', () => {
  /* ⭐⭐⭐ (R28) ⭐ تغيّر القرار ⭐ (ملاحظة المراجع المستقل ⭐):
     📌 R26 ⭐: كان **مشترك** ⭐ (قرار مقصود ⭐ — بيانات عامة ⭐).
     📌 R28 ⭐: ⛔ المعاينة والإنتاج لازم ما يشاركواوش نفس المساحة ⭐
        ⇒ ⭐ المعاينة ليها مساحة **خاصة** ⭐ (نسخة مستقلة ⭐).
     📌 الاختبار الجديد (R28-PR-11 ⭐) بيتأكد من نفس القاعدة ⭐. */
  assert.notEqual(kvId(SITE_PREVIEW, 'HALAN_KV'), kvId(SITE_PROD, 'HALAN_KV'),
    '⛔⛔⛔ المعاينة والإنتاج على نفس مساحة هالان ⭐ ⇒ ⛔ R26-I05 مفتوح ⭐');
});

test('R26-KV-07 · مفاتيح الإبطال ⭐ namespace منفصل ⭐ ⇒ ⭐ مافيش خلط ⭐', () => {
  /* ⭐ الكود نفسه ⭐ لازم يفضّل بادئة `rev:` ⭐ داخل مساحة الإبطال ⭐ */
  const src = fs.readFileSync(path.join(ROOT, 'mgmt', 'worker.js'), 'utf8');
  assert.match(src, /rev:/,
    '⛔⛔⛔ مافيش بادئة `rev:` ⭐ ⇒ ⭐ خلط محتمل ⭐');
  assert.ok(!/HALAN_KV/.test(src),
    '⛔⛔⛔ لوحة الأدمن ⛔ ما تربطش ⭐ HALAN_KV ⭐ (كاش السوق ⭐)');
});
