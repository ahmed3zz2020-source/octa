/* ══════════════════════════════════════════════════════════════
   🧪 اختبار واجهة «المناطق» — assets/tests/zones-ui.test.js
   ──────────────────────────────────────────────────────────────
   التشغيل:  cd /workspace/repos/octa && node --test assets/tests/zones-ui.test.js
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
    OCTA_EGX_NAMES: { names: { COMI: 'البنك التجاري الدولي - مصر' }, sectors: {} },
    location: { protocol: 'https:', host: 'octashares.com', href: 'https://octashares.com/#zones', hash: '#zones' },
    addEventListener() { },
    setTimeout: (f) => { try { f(); } catch (e) { } },
    clearTimeout() { },
    fetch: fetchImpl || (() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })),
    octaFetch: function (u) { return win.fetch(u); },
    AbortController: function () { this.abort = () => { }; },
    localStorage: (function () {
      const st = {};
      return { getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: (k) => { delete st[k]; } };
    })(),
    console: console
  };
  win.window = win; win.self = win;
  return { ctx: vm.createContext(win), win: win, els: els, doc: doc };
}

function loadUI(fetchImpl) {
  const sb = mkSandbox(fetchImpl);
  const code = fs.readFileSync(path.join(ROOT, 'assets/js/octa-zones.js'), 'utf8');
  vm.runInContext(code, sb.ctx, { filename: 'octa-zones.js' });
  return sb;
}

function mkRow(o) {
  o = o || {};
  return {
    code: o.code || 'COMI', name: o.name || 'التجاري', sector: 'بنوك',
    price: 122.8, atr: 2.4, atr_pct: 2.36,
    kind: o.kind || 'resistance', label: o.kind === 'support' ? 'دعم' : 'مقاومة',
    level: o.level || 129.99, zone_low: 128, zone_high: 130,
    distance_pct: o.distance_pct != null ? o.distance_pct : 5.86,
    distance_atr: 2.48, touches: o.touches || 2, reactions: 2,
    last_test: '2026-10-20', age_days: 3, score: 74.7
  };
}

test('الواجهة بتتحمّل من غير crash', () => {
  const sb = loadUI();
  assert.ok(sb.win.OCTAZones, 'الـAPI متاحة');
});

test('الجدول بيعرض المستوى والنوع والبُعد', () => {
  const sb = loadUI();
  const S = sb.win.OCTAZones.state;
  S.rows = [mkRow({}), mkRow({ code: 'ETEL', kind: 'support', level: 120, distance_pct: -2.1 })];
  S.loaded = true;
  sb.win.OCTAZones._test.apply();
  sb.win.OCTAZones._test.renderTable();
  const html = sb.els['znTableBox'].innerHTML;
  assert.ok(html.indexOf('COMI') >= 0, 'الرمز');
  assert.ok(html.indexOf('مقاومة') >= 0, 'نوع المقاومة');
  assert.ok(html.indexOf('دعم') >= 0, 'نوع الدعم');
  assert.ok(html.indexOf('129.99') >= 0, 'المستوى');
  assert.ok(html.indexOf('+5.86%') >= 0, 'البُعد');
  assert.ok(html.indexOf('undefined') < 0, 'مفيش undefined');
  assert.ok(html.indexOf('NaN') < 0, 'مفيش NaN');
});

test('فلتر النوع والبُعد والبحث', () => {
  const sb = loadUI();
  const S = sb.win.OCTAZones.state;
  S.rows = [
    mkRow({ code: 'COMI', kind: 'resistance', distance_pct: 5.86 }),
    mkRow({ code: 'ETEL', kind: 'support', distance_pct: -2.1 }),
    mkRow({ code: 'TMGH', kind: 'resistance', distance_pct: 20 })
  ];
  S.loaded = true;
  S.kind = 'resistance';
  sb.win.OCTAZones._test.apply();
  assert.equal(S.filtered.length, 2, 'فلتر النوع');
  S.kind = 'all';
  S.maxDist = 10;
  sb.win.OCTAZones._test.apply();
  assert.equal(S.filtered.length, 2, 'فلتر المسافة');
  S.maxDist = 25;
  S.q = 'ETEL';
  sb.win.OCTAZones._test.apply();
  assert.equal(S.filtered.length, 1, 'فلتر البحث');
});
