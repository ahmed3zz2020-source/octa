/* ══════════════════════════════════════════════════════════════
   🛡️ حارس الصفحات — KEEP و TOOL_PAGES لازم يفضلوا مت-sync
   ──────────────────────────────────────────────────────────────
   📌 القصة: أضفت أداة «الرادار الذكي» (page-radar) بس ما
      ضفتهاش في قائمة KEEP بتاعت killLegacyHome().
      ⇒ #page-radar اتمسح مع #homeHidden ⇒ switchPage('radar')
        لقى الصفحة مش موجودة ⇒ رجع للافتراضي ⇒ **فتح صفحة
        السوق بدل الرادار** (٢٣ أكتوبر ٢٠٢٦).
   📌 الدرس: **أي صفحة جديدة لازم تتحط في KEEP** — والاختبار
      ده بيمنع الكارثة تتكرّر.
   ══════════════════════════════════════════════════════════════ */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* KEEP من octa-pages.js */
function keepList() {
  const s = read('assets/js/octa-pages.js');
  const m = s.match(/const KEEP = \[([^\]]+)\]/);
  assert.ok(m, 'مالقيناش KEEP في octa-pages.js');
  return m[1].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

/* TOOL_PAGES من octa-core.js */
function toolPages() {
  const s = read('assets/js/octa-core.js');
  const m = s.match(/const TOOL_PAGES = \[([^\]]+)\]/);
  assert.ok(m, 'مالقيناش TOOL_PAGES في octa-core.js');
  return m[1].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

/* TOOLS من octa-core.js */
function toolIds() {
  const s = read('assets/js/octa-core.js');
  const m = s.match(/const TOOLS = \[([\s\S]*?)\n\];/);
  assert.ok(m, 'مالقيناش TOOLS في octa-core.js');
  return [...m[1].matchAll(/id:\s*'([^']+)'/g)].map(x => x[1]);
}

test('🛡️ كل صفحة في TOOL_PAGES لازم تكون في KEEP (عشان ما تتمسحش)', () => {
  const keep = keepList(), pages = toolPages();
  const missing = pages.filter(p => !keep.includes(p));
  assert.deepEqual(missing, [],
    '⛔ صفحات في TOOL_PAGES ومش في KEEP ⇒ killLegacyHome هيمسحها:\n  ' + missing.join('\n  '));
  assert.ok(pages.includes('radar'), '⛔ Radar لازم يكون في TOOL_PAGES');
  assert.ok(keep.includes('radar'), '⛔ radar لازم يكون في KEEP');
});

/* ⛔ صفحات الـid بتاعها مش page-* (بتترنقل برضو في killLegacyHome) */
const SPECIAL = { dash: 'dashPage', intel: 'intelPage' };
function pageIdOf(id) { return SPECIAL[id] || ('page-' + id); }

test('🛡️ كل أداة في شريط الأدوات لازم ليها صفحة في index.html', () => {
  const html = read('index.html');
  const ids = toolIds();
  assert.ok(ids.length >= 10, 'عدد الأدوات: ' + ids.length);
  const missing = ids.filter(id => !html.includes('id="' + pageIdOf(id) + '"'));
  assert.deepEqual(missing, [],
    '⛔ أدوات من غير صفحة في الـHTML:\n  ' + missing.join('\n  '));
});

test('🛡️ كل صفحة في KEEP لازم موجودة في index.html', () => {
  const html = read('index.html');
  const missing = keepList().filter(id => !html.includes('id="' + pageIdOf(id) + '"'));
  assert.deepEqual(missing, [],
    '⛔ KEEP فيه صفحات مش موجودة في الـHTML:\n  ' + missing.join('\n  '));
});

test('🛡️ صفحة الرادار مش جوّه #homeHidden من غير rescue', () => {
  const html = read('index.html');
  const iRadar = html.indexOf('id="' + pageIdOf('radar') + '"');
  assert.ok(iRadar > 0, 'page-radar موجودة');
  const iHome = html.indexOf('id="homeHidden"');
  assert.ok(iHome > 0, 'homeHidden موجودة');
  /* ⛔ لو الرادار جوّه homeHidden ⇒ لازم يكون في KEEP */
  const inHome = iRadar > iHome;
  if (inHome) {
    assert.ok(keepList().includes('radar'),
      '⛔ page-radar جوّه #homeHidden ومش في KEEP ⇒ هتتمسح');
  }
});

test('🛡️ كل صفحة page-* في الـHTML لازم تكون في KEEP (ما تمسحش مع homeHidden)', () => {
  const html = read('index.html');
  const keep = keepList();
  const ids = [...html.matchAll(/id="page-([a-z0-9_-]+)"/g)].map(m => m[1]);
  /* ⛔ 'home' استثناء مقصود: الصفحة القديمة بتتمسح عمداً
     (v8 fix — الشاشة الرئيسية دلوقتي جزء من OS_NAV.restore()). */
  const missing = ids.filter(id => id !== 'home' && !keep.includes(id));
  assert.deepEqual(missing, [],
    '⛔ صفحات في الـHTML ومش في KEEP ⇒ هتتمسح مع #homeHidden:\n  ' + missing.join('\n  '));
});
