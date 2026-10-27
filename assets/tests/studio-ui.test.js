/* ══════════════════════════════════════════════════════════════
   🧪 اختبار واجهة الاستوديو — assets/tests/studio-ui.test.js
   ──────────────────────────────────────────────────────────────
   التشغيل:  cd /workspace/repos/octa && node --test assets/tests/studio-ui.test.js
   📌 مافيش متصفح ولا شبكة — DOM مصغّر + موك.
   ══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function makeEl(id) {
  const el = {
    id: id, innerHTML: '', textContent: '', value: '', checked: false,
    style: { display: '' }, _l: {}, children: [],
    classList: {
      _s: new Set(),
      toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) { this._s.add(c); } else { this._s.delete(c); } },
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    addEventListener(t, fn) { (el._l[t] = el._l[t] || []).push(fn); },
    removeEventListener() { }, remove() { },
    appendChild(c) { el.children.push(c); return c; },
    setAttribute() { }, getAttribute() { return null; }, focus() { },
    querySelector() { return makeEl('q'); }, querySelectorAll() { return []; },
    scrollIntoView() { }
  };
  return el;
}

function mkSandbox(fetchImpl) {
  const els = {};
  const doc = {
    createElement: (t) => makeEl('new-' + t),
    getElementById: (id) => (els[id] = els[id] || makeEl(id)),
    querySelectorAll: () => [],
    body: makeEl('body'),
    head: makeEl('head')
  };
  const win = {
    document: doc,
    OCTA_API: '',
    OCTA_EGX_NAMES: { names: { COMI: 'البنك التجاري الدولي - مصر', ETEL: 'المصرية للاتصالات' }, sectors: {} },
    location: { protocol: 'https:', host: 'octashares.com', href: 'https://octashares.com/#studio', hash: '#studio' },
    addEventListener() { },
    setTimeout: (f) => { try { f(); } catch (e) { } },
    clearTimeout() { },
    fetch: fetchImpl || (() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })),
    octaFetch: function (u) { return win.fetch(u); },
    AbortController: function () { this.abort = () => { }; },
    localStorage: (function () {
      const st = {};
      return {
        getItem: (k) => (k in st ? st[k] : null),
        setItem: (k, v) => { st[k] = String(v); },
        removeItem: (k) => { delete st[k]; }
      };
    })(),
    console: console
  };
  win.window = win;
  win.self = win;
  const ctx = vm.createContext(win);
  return { ctx: ctx, win: win, els: els, doc: doc };
}

function loadUI(fetchImpl) {
  const sb = mkSandbox(fetchImpl);
  const code = fs.readFileSync(path.join(ROOT, 'assets/js/octa-studio.js'), 'utf8');
  vm.runInContext(code, sb.ctx, { filename: 'octa-studio.js' });
  return sb;
}

function mockApi(payload, status) {
  return function (url) {
    return Promise.resolve({
      ok: (status || 200) < 400,
      status: status || 200,
      json: () => Promise.resolve(payload)
    });
  };
}

/* ═══════════ 1) التحمّل ═══════════ */
test('الواجهة بتتحمّل من غير crash', () => {
  const sb = loadUI();
  assert.ok(sb.win.OCTAStudio, 'الـAPI متاحة');
  assert.equal(typeof sb.win.OCTAStudio.loadCode, 'function');
});

/* ═══════════ 2) الأسماء ═══════════ */
test('الاسم العربي بيتحول لرمز والعكس', () => {
  const sb = loadUI();
  const T = sb.win.OCTAStudio._test;
  assert.equal(T.nameOf('COMI'), 'البنك التجاري الدولي - مصر');
  assert.equal(T.nameOf('XXXX'), 'XXXX', 'رمز مش موجود ⇒ نفسه');
});

/* ═══════════ 3) عرض الرسومات ═══════════ */
test('قائمة الرسومات بتعرض الكود والسعر والملاحظة', () => {
  const items = [{
    id: 'a1', code: 'COMI', name: 'التجاري', kind: 'level',
    price: 122.8, price2: null, note: 'مقاومةPrevious',
    visibility: 'public', created_at: '2026-10-28 10:00:00'
  }];
  const sb = loadUI(mockApi({ ok: true, items: items }));
  sb.win.OCTAStudio.state.public = items;
  sb.win.OCTAStudio.state.tab = 'public';
  sb.win.OCTAStudio._test.renderList();
  const html = sb.els['stList'].innerHTML;
  assert.ok(html.indexOf('COMI') >= 0, 'الرمز');
  assert.ok(html.indexOf('122.8') >= 0, 'السعر');
  assert.ok(html.indexOf('مشترك') >= 0, 'وسم المشاركة');
  assert.ok(html.indexOf('undefined') < 0, 'مفيش undefined');
});

test('مفيش رسومات ⇒ رسالة واضحة مش جدول مكسور', () => {
  const sb = loadUI(mockApi({ ok: true, items: [] }));
  sb.win.OCTAStudio.state.mine = [];
  sb.win.OCTAStudio._test.renderList();
  const html = sb.els['stList'].innerHTML;
  assert.ok(html.indexOf('ارسم أول مستوى') >= 0, 'رسالة الجدار');
});

/* ═══════════ 4) الأرقام ═══════════ */
test('تنسيق الأسعار', () => {
  const sb = loadUI();
  const T = sb.win.OCTAStudio._test;
  assert.equal(T.fmtPrice(122.8), '122.8');
  assert.equal(T.fmtPrice(120), '120');
  assert.equal(T.fmtPrice(null), '—');
});
