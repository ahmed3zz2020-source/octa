/* ══════════════════════════════════════════════════════════════
   🧭 حارس المسارات — SPA_ROUTES ⇔ OCTA_PATH_ALIAS ⇔ TOOL_PAGES
   ──────────────────────────────────────────────────────────────
   📌 القصة: الـworker بيقدّم `index.html` لكل مسار في `SPA_ROUTES`
      (رابط مباشر أو مشاركة أو نسخة قديمة). ⇒ أي مسار في القائمة لازم
      **يفتح الصفحة الصح** لما حد يفتحه مباشرة.

      ⛔ الخطر الحقيقي: `SPA_ROUTES` و `TOOL_PAGES` قوائم **من ملفين
      مختلفين** (worker.js و octa-core.js) ⇒ سطر واحد ناقص ⇒ الرابط
      بيفتح صفحة تانية (أو مايفتحش حاجة) من غير أي خطأ في الكود.

   📌 الـalias (OCTA_PATH_ALIAS) هو الجسر: بيترجم المسار ⇒ الـid.
      ⛔ لازم كل مسار في SPA_ROUTES يبقى:
         ① إما موجود في TOOL_PAGES كما هو
         ② أو له alias ⇒ وبيوصل لـid موجود في TOOL_PAGES
      ③ وكل id في TOOL_PAGES لازم ليه **صفحة في الـHTML**

   📌 هذا **حارس وقائي** (مش إصلاح): بيمنع regresión future.
      التشغيل: node --test assets/tests/route-contract.test.js
   ══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ── SPA_ROUTES من worker.js ── */
function spaRoutes() {
  const s = read('worker.js');
  const m = s.match(/const SPA_ROUTES\s*=\s*\[([^\]]+)\]/);
  assert.ok(m, 'مالقيناش SPA_ROUTES في worker.js');
  return m[1].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

/* ── TOOL_PAGES من octa-core.js ── */
function toolPages() {
  const s = read('assets/js/octa-core.js');
  const m = s.match(/const TOOL_PAGES\s*=\s*\[([^\]]+)\]/);
  assert.ok(m, 'مالقيناش TOOL_PAGES في octa-core.js');
  return m[1].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

/* ── OCTA_PATH_ALIAS من octa-core.js ── */
function pathAlias() {
  const s = read('assets/js/octa-core.js');
  const m = s.match(/const OCTA_PATH_ALIAS\s*=\s*\{([\s\S]*?)\n\};/);
  assert.ok(m, 'مالقيناش OCTA_PATH_ALIAS في octa-core.js');
  const out = {};
  for (const mm of m[1].matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) out[mm[1]] = mm[2];
  return out;
}

/* ── ALL_TOOLS (الـsidebar) ──
   📌 كل أداة إمّا صفحة (id بتاعها في TOOL_PAGES) أو **مودال** (modal:1)
      ⇒ «قرار اليوم» مودال مش صفحة ⇒ مالهاش container في الـHTML. */
function allToolEntries() {
  const s = read('assets/js/octa-core.js');
  const start = s.indexOf('const ALL_TOOLS');
  assert.ok(start > -1, 'مالقيناش ALL_TOOLS في octa-core.js');
  const body = s.slice(start, s.indexOf('const OCTA_QUICK', start));
  const out = [];
  for (const m of body.matchAll(/\{[^}]*id:\s*'([^']+)'[^}]*\}/g)) {
    out.push({ id: m[1], modal: /modal:\s*1/.test(m[0]) });
  }
  return out;
}

/* ── صفحة الـHTML لـid معيّن ── */
const SPECIAL = { dash: 'dashPage' };
function pageIdOf(id) { return SPECIAL[id] || ('page-' + id); }

test('🧭 كل مسار في SPA_ROUTES لازم يوصّل لصفحة حقيقية', () => {
  const routes = spaRoutes();
  const pages = toolPages();
  const alias = pathAlias();
  const broken = [];
  for (const route of routes) {
    const slug = route.replace(/^\//, '');
    const mapped = alias[slug] || slug;
    if (pages.indexOf(mapped) === -1) {
      broken.push(route + ' ⇒ ' + mapped + (alias[slug] ? ' (من الـalias)' : ' (مافيش alias)'));
    }
  }
  assert.deepEqual(broken, [],
    '⛔ مسارات في SPA_ROUTES ما بتوصلش لصفحة:\n  ' + broken.join('\n  '));
});

test('🧭 كل alias لازم يوصل لـid موجود في TOOL_PAGES', () => {
  const pages = toolPages();
  const alias = pathAlias();
  const broken = Object.keys(alias).filter(k => pages.indexOf(alias[k]) === -1);
  assert.deepEqual(broken, [],
    '⛔ alias بيوصّل لـid مش موجود في TOOL_PAGES:\n  ' + broken.join('\n  '));
});

test('🧭 كل id في TOOL_PAGES لازم ليه صفحة في index.html', () => {
  const html = read('index.html');
  const missing = toolPages().filter(id => html.indexOf('id="' + pageIdOf(id) + '"') === -1);
  assert.deepEqual(missing, [],
    '⛔ ids في TOOL_PAGES بلا صفحة في الـHTML:\n  ' + missing.join('\n  '));
});

test('🧭 كل أداة في الـsidebar: صفحة (TOOL_PAGES) أو مودال (modal:1)', () => {
  const pages = toolPages();
  const missing = allToolEntries()
    .filter(e => !e.modal && pages.indexOf(e.id) === -1)
    .map(e => e.id);
  assert.deepEqual(missing, [],
    '⛔ أدوات في الـsidebar مش في TOOL_PAGES ومش مودال (فتحها هيفتح صفحة تانية):\n  '
    + missing.join('\n  '));
});

test('🧭 كل مسار في SPA_ROUTES لازم يبقى فريد (مافيش تكرار)', () => {
  const routes = spaRoutes();
  const dup = routes.filter((r, i) => routes.indexOf(r) !== i);
  assert.deepEqual(dup, [], '⛔ مسارات مكرّرة: ' + dup.join(', '));
});
