/* ══════════════════════════════════════════════════════════════
   🧪 اختبار واجهة الرادار — assets/tests/radar-ui.test.js
   ──────────────────────────────────────────────────────────────
   التشغيل:  cd /workspace/octa && node --test assets/tests/radar-ui.test.js
   📌 مافيش متصفح ⇒ DOM مصغّر + تحميل الملف في بيئة معزولة (vm).
   ⛔ مافيش شبكة — كل الأرقام من mock مبني على بيانات حقيقية.
   ══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const R = require('../js/octa-radar.js');
const X = require('../js/octa-radar-explain.js');

function dayIso(offset) {
  const d = new Date(Date.now() - (offset || 0) * 86400000);
  return d.toISOString().slice(0, 10);
}

/* ═══════════ DOM مصغّر ═══════════ */
function makeEl(id) {
  const el = {
    id: id, innerHTML: '', textContent: '', value: '', checked: false,
    style: { display: '' }, _l: {},
    classList: {
      _s: new Set(),
      toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) { this._s.add(c); } else { this._s.delete(c); } },
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    addEventListener(t, fn) { (el._l[t] = el._l[t] || []).push(fn); },
    removeEventListener() { }, remove() { }, appendChild() { },
    setAttribute() { }, getAttribute() { return null; }, focus() { },
    querySelector() { return null; }, querySelectorAll() { return []; },
    scrollIntoView() { },
    click() { (el._l.click || []).forEach(f => { try { f({ type: 'click', target: el }); } catch (e) { } }); }
  };
  return el;
}

function mkSandbox() {
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
    OCTA_RADAR: R,
    OCTA_RADAR_EXPLAIN: X,
    OCTA_RADAR_REF: {},
    OCTA_API: '',
    location: { protocol: 'https:', host: 'octashares.com', href: 'https://octashares.com/#radar', hash: '#radar' },
    addEventListener() { },
    setTimeout: (f) => { try { f(); } catch (e) { } },
    clearTimeout() { },
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
    AbortController: function () { this.abort = () => { }; },
    localStorage: (function () {
      const st = {};
      return {
        getItem: (k) => (k in st ? st[k] : null),
        setItem: (k, v) => { st[k] = String(v); },
        removeItem: (k) => { delete st[k]; },
        _dump: () => st
      };
    })(),
    console: console
  };
  win.window = win;
  win.self = win;
  const ctx = vm.createContext(win);
  return { ctx: ctx, win: win, els: els, doc: doc };
}

function loadUI() {
  const sb = mkSandbox();
  const code = fs.readFileSync(path.join(ROOT, 'assets/js/octa-radar-ui.js'), 'utf8');
  vm.runInContext(code, sb.ctx, { filename: 'octa-radar-ui.js' });
  return sb;
}

/* ═══════════ شموع وهمية ═══════════ */
function mkCandles(n, trend, seed) {
  let s = seed || 7;
  function rnd() { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }
  const out = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    p = p * (1 + (trend == null ? 0.004 : trend) + (rnd() - 0.5) * 0.02);
    out.push({
      t: dayIso(n - 1 - i), o: p, h: p * 1.006, l: p * 0.994, c: p,
      v: 1000 + Math.floor(rnd() * 3000)
    });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════
   🧩 1) تحميل الملف
   ═══════════════════════════════════════════════════════════ */
test('الواجهة بتتحمّل من غير crash', () => {
  const sb = loadUI();
  assert.equal(typeof sb.win.radarInit, 'function', 'radarInit موجودة');
  assert.ok(sb.win.OCTA_RADAR_UI, 'الـAPI الداخلية متاحة للاختبار');
});

/* ═══════════════════════════════════════════════════════════
   🧩 2) لوحة تفاصيل السهم
   ═══════════════════════════════════════════════════════════ */
test('لوحة التفاصيل بتطلع الأقسام الأربعة + الخطة + الخلاصة', () => {
  const sb = loadUI();
  const a = R.analyze(mkCandles(250, 0.004, 3), {
    code: 'TEST', name: 'سهم تجريبي', sector: 'بنوك',
    price: 120, marketCap: 5e9, rec: 0.3
  });
  const html = sb.win.OCTA_RADAR_UI.detailHTML(a);
  assert.ok(html.length > 800, 'HTML طويل');
  assert.ok(html.indexOf('الاتجاه') >= 0, 'كارت الاتجاه');
  assert.ok(html.indexOf('الزخم') >= 0, 'كارت الزخم');
  assert.ok(html.indexOf('حجم التداول') >= 0, 'كارت الحجم');
  assert.ok(html.indexOf('التذبذب') >= 0, 'كارت التذبذب');
  assert.ok(html.indexOf('نشاط التداول') >= 0, 'كارت الدليل الذكي');
  assert.ok(html.indexOf('خطة الدخول') >= 0, 'كارت الخطة');
  assert.ok(html.indexOf('الخلاصة التحليلية') >= 0, 'البطاقة النهائية');
  assert.ok(html.indexOf('كيف الرادار بيحلل') >= 0, 'خطوات التحليل');
  assert.ok(html.indexOf('data-tip=') >= 0, 'أزرار الشرح موجودة');
});

test('⛔ مفيش undefined ولا NaN في HTML', () => {
  const sb = loadUI();
  const a = R.analyze(mkCandles(250, 0.004, 3), { code: 'T', name: 'سهم', price: 120, marketCap: 5e9 });
  const html = sb.win.OCTA_RADAR_UI.detailHTML(a);
  assert.equal(html.indexOf('undefined'), -1, '⛔ undefined');
  assert.equal(html.indexOf('NaN'), -1, '⛔ NaN');
});

test('⛔ التنويه بيظهر دايماً (بيانات المؤسسات + الدرجة)', () => {
  const sb = loadUI();
  const a = R.analyze(mkCandles(250, 0.004, 3), { code: 'T', name: 'سهم', price: 120, marketCap: 5e9 });
  const html = sb.win.OCTA_RADAR_UI.detailHTML(a);
  assert.ok(html.indexOf('بيانات نشاط المؤسسات غير متاحة') >= 0, '⛔ تنبيه المؤسسات');
  assert.ok(html.indexOf('مش أوامر') >= 0, '⛔ المستويات افتراضية');
  assert.ok(html.indexOf('تكاليف المعاملة غير مشمولة') >= 0, '⛔ التكاليف');
});

test('سهم ببيانات ناقصة ⇒ اللوحة بتطلع من غير crash', () => {
  const sb = loadUI();
  const a = R.analyze([], { code: 'T', name: 'سهم', price: 10 });
  const html = sb.win.OCTA_RADAR_UI.detailHTML(a);
  assert.ok(html.length > 300, 'HTML موجود');
  assert.equal(html.indexOf('undefined'), -1, '⛔ undefined');
});

/* ═══════════════════════════════════════════════════════════
   🧩 3) الفلترة والترتيب
   ═══════════════════════════════════════════════════════════ */
function seedState(sb) {
  const S = sb.win.OCTA_RADAR_UI.state;
  S.results = [
    R.analyze(mkCandles(250, 0.006, 3), { code: 'AAA', name: 'أول', sector: 'بنوك', price: 100, marketCap: 5e9, rec: 0.4 }),
    R.analyze(mkCandles(250, -0.006, 9), { code: 'BBB', name: 'ثاني', sector: 'عقارات', price: 200, marketCap: 2e9, rec: -0.3 }),
    R.analyze([], { code: 'CCC', name: 'ثالث', sector: 'بنوك', price: 50 })
  ];
  S.results.forEach(r => { S.byCode[r.code] = r; });
  return S;
}

test('الفلترة بالبحث بالاسم أو الرمز', () => {
  const sb = loadUI();
  const S = seedState(sb);
  S.showAll = true;   /* ⛔ ناقص البيانات مخفي افتراضياً */
  S.q = 'AAA';
  assert.equal(sb.win.OCTA_RADAR_UI.filtered().length, 1, 'بحث بالرمز');
  S.q = 'ثالث';
  assert.equal(sb.win.OCTA_RADAR_UI.filtered().length, 1, 'بحث بالاسم');
  S.q = '';
  assert.ok(sb.win.OCTA_RADAR_UI.filtered().length >= 2, 'بحث فاضي ⇒ الكل');
});

test('الفلترة بالقطاع وبالتصنيف', () => {
  const sb = loadUI();
  const S = seedState(sb);
  S.showAll = true;
  S.sector = 'بنوك';
  assert.equal(sb.win.OCTA_RADAR_UI.filtered().length, 2, 'قطاع بنوك');
  S.sector = 'all';
  S.cls = 'A';
  assert.ok(sb.win.OCTA_RADAR_UI.filtered().every(r => r.classification.code === 'A'), 'تصنيف A');
  S.cls = 'all';
});

test('⛔ ناقص البيانات مخفي افتراضياً ويبان لما نطلب', () => {
  const sb = loadUI();
  const S = seedState(sb);
  const hidden = sb.win.OCTA_RADAR_UI.filtered();
  assert.ok(!hidden.some(r => r.code === 'CCC'), '⛔ ناقص البيانات مخفي');
  S.showAll = true;
  assert.ok(sb.win.OCTA_RADAR_UI.filtered().some(r => r.code === 'CCC'), 'ظاهر لما نطلب');
  S.showAll = false;
});

test('الترتيب يشتغل على البيانات الفعلية', () => {
  const sb = loadUI();
  const S = seedState(sb);
  S.showAll = true;
  S.sort = 'price'; S.dir = -1;
  const byPrice = sb.win.OCTA_RADAR_UI.filtered();
  for (let i = 1; i < byPrice.length; i++) {
    assert.ok(byPrice[i - 1].price >= byPrice[i].price, 'ترتيب تنازلي بالسعر');
  }
  S.sort = 'score'; S.dir = -1;
  const byScore = sb.win.OCTA_RADAR_UI.filtered();
  for (let i = 1; i < byScore.length; i++) {
    const a = byScore[i - 1].score.total, b = byScore[i].score.total;
    if (a == null || b == null) continue;
    assert.ok(a >= b, 'ترتيب تنازلي بالدرجة');
  }
});

test('تصفير الفلاتر بيرجّع كل حاجة', () => {
  const sb = loadUI();
  const S = seedState(sb);
  S.q = 'AAA'; S.sector = 'بنوك'; S.cls = 'A'; S.minRR = 3; S.showAll = false;
  sb.win.OCTA_RADAR_UI.resetFilters();
  assert.equal(S.q, '', 'البحث اتصفّر');
  assert.equal(S.sector, 'all', 'القطاع اتصفّر');
  assert.equal(S.cls, 'all', 'التصنيف اتصفّر');
  assert.equal(S.minRR, 0, 'العائد اتصفّر');
});

/* ═══════════════════════════════════════════════════════════
   🧩 4) الـHTML — RTL والوصولية
   ═══════════════════════════════════════════════════════════ */
test('صفحة الرادار موجودة في index.html وبتتكلم عربي RTL', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(html.indexOf('id="page-radar"') >= 0, 'الصفحة موجودة');
  assert.ok(html.indexOf('octa-radar.js') >= 0, 'المحرك متحمّل');
  assert.ok(html.indexOf('octa-radar-explain.js') >= 0, 'طبقة الشرح متحمّلة');
  assert.ok(html.indexOf('octa-radar-ui.js') >= 0, 'الواجهة متحمّلة');
  assert.ok(html.indexOf('css-radar.css') >= 0, 'الـCSS متحمّل');
  /* ⛔ التنويه لازم يكون موجود في الصفحة نفسها */
  assert.ok(html.indexOf('لا تمثل توصية بالشراء أو البيع') >= 0, '⛔ التنويه موجود');
  assert.ok(html.indexOf('بيانات نشاط المؤسسات غير متاحة') >= 0, '⛔ تنبيه المؤسسات');
  assert.ok(html.indexOf('الرادار الذكي للأسهم') >= 0, 'العنوان العربي');
  /* ⛔ كل الـselect لازم يكون ليه aria-label */
  ['rdProfile', 'rdSect', 'rdCls', 'rdSort', 'rdLiq', 'rdRR', 'rdAtr', 'rdRvol']
    .forEach(id => {
      const re = new RegExp('id="' + id + '"[^>]*aria-label');
      assert.ok(re.test(html), '⛔ ' + id + ' محتاج aria-label');
    });
});

test('الأداة مسجّلة في الـsidebar والـrouting', () => {
  const core = fs.readFileSync(path.join(ROOT, 'assets/js/octa-core.js'), 'utf8');
  assert.ok(core.indexOf("id:'radar'") >= 0, 'الأداة في TOOLS');
  assert.ok(core.indexOf("'money','radar'") >= 0, 'الصفحة في TOOL_PAGES');
  assert.ok(core.indexOf("id === 'radar'") >= 0, 'الـinit');
});

test('الـCSS بيستخدم رموز التصميم بس (مفيش hex جوّه)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets/css-radar.css'), 'utf8');
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g);
  assert.equal(hex, null, '⛔ ألوان hex برّه الـtokens — ' + (hex || []).join(','));
  assert.ok(css.indexOf('var(--') >= 0, 'بيستخدم رموز التصميم');
});

test('⛔ رموز التصميم موجودة فعلاً في octa-tokens.css', () => {
  const tok = fs.readFileSync(path.join(ROOT, 'assets/octa-tokens.css'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'assets/css-radar.css'), 'utf8');
  const used = [...css.matchAll(/var\(--([a-zA-Z0-9]+)/g)].map(m => m[1]);
  const uniq = [...new Set(used)];
  const missing = uniq.filter(v => tok.indexOf('--' + v + ':') < 0);
  assert.equal(missing.length, 0, '⛔ رموز ناقصة: ' + missing.join(', '));
});

/* ═══════════════════════════════════════════════════════════
   🩺 8) التشخيص + الكاش + fail-soft (٢٣ أكتوبر ٢٠٢٦)
   ───────────────────────────────────────────────────────────
   📌 المشكلة: لو الطلب فشل، الصفحة كانت واقفة «بنجيب بيانات
   السوق» للأبد من غير أي سبب ظاهر. دلوقتي:
   · كل نداء بيسجّل السبب والوقت
   · مودال تشخيص بيعرض السجل للمستخدم
   · الكاش المحلي بيخلّي إعادة الفتح فورية
   ═══════════════════════════════════════════════════════════ */

test('🩺 مودال التشخيص بيعرض السجل وسبب الفشل', () => {
  const sb = loadUI();
  const S = sb.win.OCTA_RADAR_UI.state;
  S.scan.log.push('✗ الكون فشل: HTTP 502 (1200ms)');
  S.scan.err = 'مفيش بيانات للسوق';
  sb.win.OCTA_RADAR_UI.showDiag();
  const box = sb.els.rdDiag;
  assert.ok(box.innerHTML.length > 100, 'المودال اتملأ');
  assert.ok(box.innerHTML.indexOf('تشخيص') >= 0, 'العنوان');
  assert.ok(box.innerHTML.indexOf('HTTP 502') >= 0, '⛔ سبب الفشل ظاهر للمستخدم');
  assert.ok(box.innerHTML.indexOf('نسخ السجل') >= 0, 'زرار نسخ — المستخدم مش هيفتح الـconsole');
});

test('💾 مسح كامل بـmock ⇒ كاش محلي بيتحفظ', () => {
  const sb = loadUI();
  const S = sb.win.OCTA_RADAR_UI.state;
  const candles = mkCandles(250, 0.004, 9);
  const hist = { TEST: candles };
  sb.win.fetch = (url) => {
    const u = String(url);
    let j = {};
    if (u.indexOf('/api/radar/universe') >= 0) {
      j = { ok: true, stocks: [{ code: 'TEST', name: 'سهم تجريبي', sector: 'بنوك' }], ts: '2026-10-23T10:00:00', snapshot_id: 's1' };
    } else if (u.indexOf('/api/market_tech') >= 0) {
      j = { markets: { egypt: { TEST: { p: 100, mc: 5e9 } } }, updated: '2026-10-23T10:00:00' };
    } else if (u.indexOf('/api/quotes') >= 0) {
      j = { markets: { egypt: { TEST: { close: 100, change: 1.2 } } } };
    } else if (u.indexOf('/api/radar/history') >= 0) {
      j = { ok: true, codes: hist, failed: [] };
    }
    return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(j) });
  };
  return sb.win.OCTA_RADAR_UI.scan().then(() => {
    assert.equal(S.results.length, 1, '⛔ النتيجة اتحللت');
    assert.equal(S.scan.done, 1, '⛔ عدّاد الجاب');
    assert.equal(S.scan.err, null, '⛔ مفيش خطأ: ' + S.scan.err);
    const raw = sb.win.localStorage.getItem('octa_radar_cache_' + S.profile);
    assert.ok(raw, '⛔ مفيش كاش اتحفظ');
    const c = JSON.parse(raw);
    assert.equal(c.results.length, 1, 'النتيجة اتحفظت');
    assert.equal(c.results[0].c, 'TEST', 'الكود اتحفظ');
    assert.ok(c.ts, 'الوقت اتحفظ');
  });
});

test('⛔ الكاش المنتهي (أقدم من يوم) بيتجاهل', () => {
  const sb = loadUI();
  const S = sb.win.OCTA_RADAR_UI.state;
  const old = JSON.stringify({ ts: Date.now() - 2 * 24 * 3600 * 1000, results: [{ c: 'OLD' }] });
  sb.win.localStorage.setItem('octa_radar_cache_' + S.profile, old);
  const ok = sb.win.OCTA_RADAR_UI.loadCache();
  assert.equal(ok, false, '⛔ كاش منتهي لازم يتجاهل');
  assert.equal(S.results.length, 0, 'مفيش نتائج قديمة');
});

test('⛔ فشل المؤشرات الجماعية ما بيوقّفش المسح (fail-soft)', () => {
  const sb = loadUI();
  const S = sb.win.OCTA_RADAR_UI.state;
  const candles = mkCandles(250, 0.004, 11);
  sb.win.fetch = (url) => {
    const u = String(url);
    let j = null;
    if (u.indexOf('/api/radar/universe') >= 0) {
      j = { ok: true, stocks: [{ code: 'TEST', name: 'سهم', sector: 'بنوك' }], ts: '2026-10-23T10:00:00' };
    } else if (u.indexOf('/api/radar/history') >= 0) {
      j = { ok: true, codes: { TEST: candles }, failed: [] };
    }
    /* ⛔ market_tech و quotes بيرجعوا 500 */
    if (!j) return Promise.resolve({ ok: false, status: 500, statusText: 'Server Error', json: () => Promise.resolve({}) });
    return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(j) });
  };
  return sb.win.OCTA_RADAR_UI.scan().then(() => {
    assert.equal(S.results.length, 1, '⛔ المسح خلص رغم فشل المؤشرات');
    assert.equal(S.scan.err, null, '⛔ مفيش خطأ: ' + S.scan.err);
    assert.ok(S.scan.log.some(l => l.indexOf('المؤشرات') >= 0), '⛔ السجل بيقول إن المؤشرات تعذّرت');
    assert.ok(S.scan.log.some(l => l.indexOf('الأسعار') >= 0), '⛔ السجل بيقول إن الأسعار تعذّرت');
    assert.ok(S.scan.log.some(l => l.indexOf('الشموع') >= 0), '⛔ السجل بيقول إن الشموع جابت');
  });
});

/* ═══════════════════════════════════════════════════════════
   🛟 9) الاحتياطي — لو الكون فشل، market_tech + ملف المرجع
   ───────────────────────────────────────────────────────────
   📌 ده بالظبط اللي كان مفروض ينقذ المستخدم لما الـكون
   وقع عنده — وفيه باج كان بيمنعه يشتغل خالص (الشكل القديم).
   ═══════════════════════════════════════════════════════════ */
test('🛟 لو الكون فشل، الاحتياطي (market_tech) بيشتغل والمسح بيكمّل', () => {
  const sb = loadUI();
  const S = sb.win.OCTA_RADAR_UI.state;
  sb.win.OCTA_RADAR_REF = { TEST: { n: 'سهم اختباري', s: 'بنوك' } };
  const candles = mkCandles(250, 0.004, 21);
  sb.win.fetch = (url) => {
    const u = String(url);
    let j = null;
    if (u.indexOf('/api/radar/universe') >= 0) {
      return Promise.resolve({ ok: false, status: 500, statusText: 'Server Error', json: () => Promise.resolve({}) });
    }
    if (u.indexOf('/api/market_tech') >= 0) {
      j = { markets: { egypt: { TEST: { p: 100, mc: 5e9 } } }, updated: '2026-10-23T10:00:00' };
    } else if (u.indexOf('/api/quotes') >= 0) {
      j = { markets: { egypt: { TEST: { close: 100, change: 1 } } } };
    } else if (u.indexOf('/api/radar/history') >= 0) {
      j = { ok: true, codes: { TEST: candles }, failed: [] };
    }
    if (!j) return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found', json: () => Promise.resolve({}) });
    return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(j) });
  };
  return sb.win.OCTA_RADAR_UI.scan().then(() => {
    assert.equal(S.universe.length, 1, '⛔ الكون الاحتياطي اتبنى');
    assert.equal(S.universe[0].code, 'TEST', '⛔ الكود صح');
    assert.equal(S.universe[0].name, 'سهم اختباري', '⛔ الاسم من ملف المرجع');
    assert.equal(S.results.length, 1, '⛔ النتيجة اتحللت');
    assert.equal(S.results[0].code, 'TEST', '⛔ مفيش نتيجة بـcode=undefined');
    assert.ok(S.scan.log.some(l => l.indexOf('الكون فشل') >= 0), '⛔ السجل بيقول إن الكون فشل');
  });
});

test('🛟 النتيجة ما فيهاش entry بـcode=undefined (Display تدريجي)', () => {
  const sb = loadUI();
  const S = sb.win.OCTA_RADAR_UI.state;
  const candles = mkCandles(250, 0.004, 33);
  const stocks = [
    { code: 'AAA', name: 'أ', sector: 'بنوك' },
    { code: 'BBB', name: 'ب', sector: 'عقارات' },
    { code: 'CCC', name: 'ج', sector: 'نPyx' }
  ];
  sb.win.fetch = (url) => {
    const u = String(url);
    let j = null;
    if (u.indexOf('/api/radar/universe') >= 0) j = { ok: true, stocks: stocks, ts: 't' };
    else if (u.indexOf('/api/market_tech') >= 0) j = { markets: { egypt: {} }, updated: 't' };
    else if (u.indexOf('/api/quotes') >= 0) j = { markets: { egypt: {} } };
    else if (u.indexOf('/api/radar/history') >= 0) {
      const codes = {};
      stocks.forEach(s => { codes[s.code] = candles; });
      j = { ok: true, codes: codes, failed: [] };
    }
    if (!j) return Promise.resolve({ ok: false, status: 404, statusText: 'x', json: () => Promise.resolve({}) });
    return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(j) });
  };
  return sb.win.OCTA_RADAR_UI.scan().then(() => {
    assert.equal(S.results.length, 3, '⛔ ٣ نتائج');
    S.results.forEach(r => {
      assert.ok(r.code, '⛔ مفيش نتيجة برمز فاضي');
      assert.ok(stocks.some(s => s.code === r.code), '⛔ رمز غريب: ' + r.code);
    });
  });
});
