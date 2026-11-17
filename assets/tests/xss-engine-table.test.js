/* ══════════════════════════════════════════════════════════════════════
   🛡️ الجولة ١٩ (R18-A06 / SEC-024) — إدراج HTML في جدول المحرك
   ──────────────────────────────────────────────────────────────────────
   📌 العيب: `updateTablePrices` كان يحط قيم الـAPI خام في الـHTML:
      `data-code="${s.code}"` + `onclick="analyzeStock('${s.code}')"` ⇒
      كود من رد الـAPI (مثل `'); alert(1)//`) كان بيكسر السلسلة.
   📌 المطلوب: ⛔ مافيش HTML خام من الـAPI + ⛔ مافيش onclick inline.

   ⛔ مافيش شبكة · مافيش نشر · payload ساذج.
   📌 التشغيل:  node --test assets/tests/xss-engine-table.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets/js/octa-core.js'), 'utf8');

/* ⛔ payload ساذج — لو اتحقّن ⇒ العنصر موجود في الـDOM */
const PAYLOAD = "'; window.__xss=1; //";

function sliceFn(name, endMarker) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i > -1, 'مش لاقي ' + name);
  const j = SRC.indexOf(endMarker, i);
  assert.ok(j > i, 'مش لاقي نهاية ' + name);
  return SRC.slice(i, j);
}

test('R18-A06: جدول المحرك — مافيش HTML خام من الـAPI (اسم/كود/لون)', () => {
  const body = sliceFn('renderEngineStocksTable', 'function sortEngineStocks');
  const tbody = { innerHTML: '', addEventListener() { } };
  const sb = {
    document: { getElementById: (id) => (id === 'engineStocksTableBody' ? tbody : null) },
    ENGINE_TABLE_DATA: [{
      code: PAYLOAD, name: PAYLOAD, short: PAYLOAD,
      percentage: '5%', quantity: '10', trades: '3', value: '100',
      volume: 1000, change: 1.5, price: 12.5, color: 'red;}body{display:none',
    }],
    currentEngineSort: 'change',
    setTimeout: () => { },
    octaEsc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    window: {},
    console,
  };
  vm.runInNewContext(body + '\nrenderEngineStocksTable();', sb);
  const html = tbody.innerHTML;
  /* ⛔ مافيش onclick inline (نمط الـCSP المعتمد في المشروع) */
  assert.equal(/onclick\s*=/i.test(html), false, 'لسه فيه onclick inline');
  /* ⛔ مافيش وسم جديد من الـAPI */
  assert.equal(/<script/i.test(html), false, 'فيه وسم script');
  assert.equal(/<img/i.test(html), false, 'فيه وسم img');
  assert.equal(/onerror\s*=/i.test(html), false, 'فيه onerror');
  /* ⛔ مافيش كسر للسلسلة: الـpayload لازم يظهر مُرمَّز */
  assert.equal(html.includes(PAYLOAD), false, 'الpayload طالع خام');
  assert.ok(html.includes('&#39;'), 'الـapostrophe المفروض يبقى مُرمَّز');
  /* ⛔ اللون اللي مش hex ⇒ رجع للافتراضي (مافيش CSS injection) */
  assert.equal(/red;}/.test(html), false, 'اللون اتحقن في الـstyle');
  assert.ok(html.includes('#4dabf7'), 'اللون الافتراضي المفروض يتستخدم');
});

test('R18-A06: شريط المحرك — القرار ومستوى الخطورة مُرمَّزين', () => {
  const body = sliceFn('renderEngineBars', 'function injectEngineWidget');
  const nodes = { engineBars: {}, engineDecision: {} };
  nodes.engineBars.querySelectorAll = () => [];
  const sb = {
    document: { getElementById: (id) => nodes[id] || null },
    setTimeout: () => { },
    octaEsc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    console,
  };
  vm.runInNewContext(body + '\nrenderEngineBars([], 80, {d:{decision: PAYLOAD, risk_level: PAYLOAD, confidence: 80}});',
    Object.assign({}, sb, { PAYLOAD }));
  assert.equal(nodes.engineDecision.innerHTML.includes(PAYLOAD), false, 'القرار طالع خام');
});
