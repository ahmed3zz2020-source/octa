/* ═══════════════════════════════════════════════════════════════════
   🧪 اختبار «محور الأخبار» + «فلتر الأذرع» — assets/tests/arms-news.test.js
   ───────────────────────────────────────────────────────────────────
   التشغيل:  cd octa && node --test assets/tests/arms-news.test.js
   📌 مافيش متصفح ⇒ DOM مصغّر + تحميل الملف في بيئة معزولة (vm).
   ⛔ مافيش شبكة — الداتا من mock.

   📌 ليه الاختبار ده؟
      ① ١٤ نوفمبر ٢٠٢٦: كارت محور الأخبار كان بيعرض «العنوان : اسم
         الشركة (ADCI.CA) …» ⇒ المستخدم مش شايف الخبر نفسه.
      ② نفس اليوم: عمود «التقييم» في جدول الأذرع كان بيعرض **حجم
         التداول** (٤٦٤٢٧٢٢١٤٧) ⇒ رقم مش ليه معنى.

   📌 القواعد الحمرا اللي الاختبار بيحرسها:
      ① الكارت يعرض عنوان الحدث + نص الإعلان، ومفيش «بورصة هالان».
      ② «التقييم» = درجة ٠-١٠٠ من مضاعف الربحية/القيمة الدفترية —
         مش الحجم.
      ③ محاور المحرك جاية من الطبقة الحية (نفس لحظة الدرجة النهائية).
      ④ «الفرق» = «—» للمحاور اللي مش داخل في المجموع.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

/* ═══════════ DOM مصغّر ═══════════ */
function makeEl(id) {
  const el = {
    id: id, innerHTML: '', textContent: '', value: '', checked: false,
    isConnected: true, offsetHeight: 120,
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
    querySelector: () => null,
    body: makeEl('body'),
    head: makeEl('head'),
    _l: {},
    addEventListener(t, fn) { (doc._l[t] = doc._l[t] || []).push(fn); },
    dispatchEvent(ev) { (doc._l[ev.type] || []).forEach((fn) => fn(ev)); }
  };
  const win = {
    document: doc,
    OCTA_API: 'https://api.test',
    location: { protocol: 'https:', host: 'octashares.com', href: 'https://octashares.com/' },
    addEventListener() { }, removeEventListener() { },
    setTimeout: (f) => { try { f(); } catch (e) { } },
    clearTimeout() { }, setInterval() { return 0; }, clearInterval() { },
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

/* ═══════════ موك nzAxisScore (نفس سلوك محور التقييم ١٥٪) ═══════════
   📌 الاختبار بيتأكد من منطق الفلتر (مين بيقرا منين) — أما جداول
      الدرجة نفسها فمتغطّاة في اختبارات نور. */
function bandPE(v) {
  const t = [[5, 95], [8, 88], [12, 78], [18, 66], [28, 52], [50, 35]];
  if (v <= t[0][0]) return v <= 0 ? 20 : 95;
  for (let i = 0; i < t.length; i++) {
    if (v <= t[i + 1][0]) {
      const lo = t[i], hi = t[i + 1];
      const r = (v - lo[0]) / (hi[0] - lo[0]);
      return lo[1] + r * (hi[1] - lo[1]);
    }
  }
  return 20;
}
function bandPB(v) {
  const t = [[0.5, 95], [0.9, 88], [1.4, 78], [2.2, 66], [3.5, 52], [6, 35]];
  if (v <= t[0][0]) return v <= 0 ? 20 : 95;
  for (let i = 0; i < t.length; i++) {
    if (v <= t[i + 1][0]) {
      const lo = t[i], hi = t[i + 1];
      const r = (v - lo[0]) / (hi[0] - lo[0]);
      return lo[1] + r * (hi[1] - lo[1]);
    }
  }
  return 20;
}
function stubNzAxisScore(s) {
  const vals = [];
  if (s.pe != null) vals.push(bandPE(Number(s.pe)));
  if (s.pb != null) vals.push(bandPB(Number(s.pb)));
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  return {
    total: mean, wGot: vals.length ? 0.15 : 0,
    axes: [{ id: 'val', ic: '💎', ar: 'التقييم', w: 15, n: 2, have: vals.length, mean: mean, eff: 0.15, items: [] }]
  };
}

/* ═══════════ تحميل فلتر الأذرع في بيئة معزولة ═══════════ */
function loadArms(db, liveMap) {
  const sb = mkSandbox(null);
  sb.win.OS_DB = db || [];
  sb.win.octaLoadDB = function () { return Promise.resolve(sb.win.OS_DB); };
  sb.win.nzAxisScore = stubNzAxisScore;
  sb.win.nzIsBank = function () { return false; };
  /* أوزان المحرك الحيّة (مصدر واحد) */
  sb.win.OCTA_AXIS_W = function () {
    return { risk: 27, fundamental: 24, technical: 20, liquidity: 20, news: 5, sentiment: 4, portfolio: 0 };
  };
  sb.win.OCTALiveMarkets = function () {
    return Promise.resolve({ ok: true, map: liveMap || {}, ts: '2026-11-14T05:00:00Z', n: Object.keys(liveMap || {}).length });
  };
  const code = fs.readFileSync(path.join(ROOT, 'assets/js/octa-armsfilter.js'), 'utf8');
  vm.runInContext(code, sb.ctx, { filename: 'octa-armsfilter.js' });
  return sb;
}

/* ضغطة على ذراع (اختيار) */
function clickArm(sb, armId) {
  const card = { getAttribute: () => armId };
  sb.doc.dispatchEvent({
    type: 'click',
    target: { closest: (sel) => (sel === '[data-af]' ? card : null) }
  });
}

/* موك سجل (٩ أكتوبر) — الحقل v هنا = **حجم التداول** (ده سبب المشكلة) */
function mkStock(o) {
  o = o || {};
  return {
    code: o.code || 'COMI',
    name: o.name || 'البنك التجاري الدولي',
    sector: o.sector || 'بنوك',
    sectorAr: o.sectorAr || 'بنوك',
    sectorEn: o.sectorEn || 'banks',
    price: o.price === undefined ? 100 : o.price,
    p: o.p === undefined ? 100 : o.p,
    change: o.change === undefined ? 1.2 : o.change,
    score: o.score === undefined ? 60 : o.score,
    safety: o.safety === undefined ? 70 : o.safety,
    dy: o.dy === undefined ? 2.5 : o.dy,
    pe: o.pe, pb: o.pb,
    vol1y: 30, mdd: 40, sharpe3y: 0.8,
    sect: { q: 60, v: o.volume === undefined ? 46427222 : o.volume, m: 50, sf: 55, lq: 60 }
  };
}

/* موك الطبقة الحية (شكل /api/markets) */
function mkLive(o) {
  o = o || {};
  return {
    code: o.code, name: 'سهم حي', sector: 'بنوك',
    price: o.price, pe: o.pe, pb: o.pb, div_yield: o.dy,
    ts: '2026-11-14T05:00:00Z',
    all_axes: {
      fundamental: o.fund === undefined ? 71 : o.fund,
      technical: o.tech === undefined ? 44 : o.tech,
      liquidity: o.liq === undefined ? 33 : o.liq,
      risk: 80, news: 45, sentiment: 50, portfolio: null
    }
  };
}

const DB = [
  mkStock({ code: 'COMI', pe: 6.0, pb: 1.8, price: 128.75, p: 124.65, score: 62, safety: 83 }),
  mkStock({ code: 'ADCI', pe: 14.3, pb: 5.3, price: 272.0, p: 272.95, score: 54, safety: 74 })
];
const LIVE = {
  COMI: mkLive({ code: 'COMI', price: 128.75, pe: 6.19, pb: 1.84, fund: 62, tech: 50, liq: 62, dy: 2.5 }),
  ADCI: mkLive({ code: 'ADCI', price: 272.0, pe: 14.05, pb: 4.34, fund: 72, tech: 47, liq: 36, dy: 1.1 })
};

/* ═══════════════════════════════════════════════════════════════════
   ① عمود «التقييم» — كان حجم التداول
   ═══════════════════════════════════════════════════════════════════ */
test('① عمود التقييم = درجة ٠-١٠٠ — مش حجم التداول', () => {
  const sb = loadArms(DB, LIVE);
  const A = sb.win.OCTAArmsFilter;
  const arm = A.arms.filter((a) => a.id === 'v')[0];
  A._t.setLive(LIVE);
  const v = arm.get(DB[0]);
  assert.notEqual(v, null, 'لازم يبقى في درجة');
  assert.ok(v >= 0 && v <= 100, 'الدرجة لازم تكون بين ٠ و ١٠٠ — الفعلي: ' + v);
  assert.notEqual(v, 46427222, 'مش حجم التداول!');
  assert.ok(v < 1000, 'مش رقم بحجم الآلاف');
});

test('② التقييم بيستخدم المضاعف المحدّث على السعر الحالي', () => {
  const sb = loadArms(DB, LIVE);
  const A = sb.win.OCTAArmsFilter;
  A._t.setLive(LIVE);
  /* كومي: مضاعف الربحية في السجل ٦٫٠٠ والسعر اتغيّر من ١٢٤٫٦٥
     لـ ١٢٨٫٧٥ ⇒ المضاعف المعدَّل ≈ ٦٫١٩ (وهو اللي في الطبقة الحية) */
  const scaled = A._t.scaledMult(DB[0], DB[0].pe);
  assert.ok(Math.abs(scaled - 6.19) < 0.05, 'المضاعف المعدَّل ≈ ٦٫١٩ — الفعلي: ' + scaled);
  const v = A._t.valScore(DB[0]);
  const vScaled = A._t.valScore(Object.assign({}, DB[0], { pe: scaled, pb: A._t.scaledMult(DB[0], DB[0].pb) }));
  assert.equal(v, vScaled, 'الدرجة لازم تكون مبنية على المضاعف المعدَّل');
});

test('③ محاور المحرك من الطبقة الحية — مش من السجل القديم', () => {
  const sb = loadArms(DB, LIVE);
  const A = sb.win.OCTAArmsFilter;
  A._t.setLive(LIVE);
  const get = (id, s) => A.arms.filter((a) => a.id === id)[0].get(s);
  assert.equal(get('q', DB[0]), 62, 'الأساسي = المحور الحي (62) مش السجل (60)');
  assert.equal(get('m', DB[0]), 50, 'الفني = المحور الحي (50)');
  assert.equal(get('lq', DB[0]), 62, 'السيولة = المحور الحي (62) مش السجل (60)');
  assert.equal(get('sf', DB[0]), 83, 'الأمان = الدرجة الحية (83) مش السجل (55)');
  assert.equal(get('total', DB[0]), 62, 'المجموع = الدرجة النهائية');
});

test('④ مفيش كود بيرجع «حجم التداول» كدرجة ذراع', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/octa-armsfilter.js'), 'utf8');
  assert.ok(!/ax\(s,\s*'v'\)/.test(src), 'لسه فيه درجة بتقرا v (الحجم)');
  assert.ok(!/ax\(s,\s*"v"\)/.test(src), 'لسه فيه درجة بتقرا v (الحجم)');
});

/* ═══════════════════════════════════════════════════════════════════
   ② الجدول — الأعمدة والفرق
   ═══════════════════════════════════════════════════════════════════ */
test('⑤ الجدول بيوضح إن كل الأرقام درجات من ٠ لـ ١٠٠', () => {
  const sb = loadArms(DB, LIVE);
  sb.win.OCTAArmsFilter._t.setLive(LIVE);
  sb.win.OCTAArmsFilter.render();
  clickArm(sb, 'q');
  const html = sb.els.armsList.innerHTML;
  assert.ok(html.includes('من 100'), 'لازم يكون واضح إن الأرقام من ١٠٠');
  assert.ok(html.includes('كل الأرقام درجات'), 'لازم يكون فيه شرح الأرقام');
  assert.ok(!html.includes('af-over'), 'علامة «عدّى 100» اتشالت (كانت بسبب الحجم)');
});

test('⑥ «الفرق» = «—» للمحاور اللي مش داخل في المجموع', () => {
  const sb = loadArms(DB, LIVE);
  sb.win.OCTAArmsFilter._t.setLive(LIVE);
  /* ذراع التقييم (محور مش داخل في المجموع) */
  clickArm(sb, 'v');
  let html = sb.els.armsList.innerHTML;
  assert.ok(html.includes('af-d na'), 'لازم عمود الفرق يبقى «—»');
  assert.ok(html.includes('معندهاش معنى'), 'لازم الشرح يقول إن الفرق مالوش معنى');
  /* ذراع الأساسي (داخل في المجموع) ⇒ الفرق رقم */
  clickArm(sb, 'q');
  html = sb.els.armsList.innerHTML;
  assert.ok(!html.includes('af-d na'), 'في ذراع داخل في المجموع ⇒ الفرق لازم يبقى رقم');
  assert.ok(html.includes('الفرق'), 'لازم عمود الفرق موجود');
});

test('⑦ التقييم مش داخل في المجموع — والأساسي داخل', () => {
  const sb = loadArms(DB, LIVE);
  const A = sb.win.OCTAArmsFilter;
  assert.equal(A.arms.filter((a) => a.id === 'v')[0].inTotal, undefined, 'التقييم محور مش داخل في المجموع');
  assert.equal(A.arms.filter((a) => a.id === 'q')[0].inTotal, true, 'الأساسي داخل في المجموع');
  assert.equal(A.arms.filter((a) => a.id === 'risk')[0].inTotal, undefined, 'المخاطرة مش داخلة');
});

/* ═══════════════════════════════════════════════════════════════════
   ③ محور الأخبار — الخبر نفسه
   ═══════════════════════════════════════════════════════════════════ */
function loadNews(axisPayload) {
  const sb = mkSandbox(function (u) {
    if (String(u).indexOf('/api/halan/axis') >= 0) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(axisPayload) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
  const code = fs.readFileSync(path.join(ROOT, 'assets/js/na-axis.js'), 'utf8');
  vm.runInContext(code, sb.ctx, { filename: 'na-axis.js' });
  return sb;
}

const AXIS_PAYLOAD = {
  ok: true, count: 2, updatedAt: '2026-11-14T04:31:38.575Z',
  source: 'إعلانات البورصة الرسمية',
  axes: [
    {
      code: 'ADCI', axis: 82, events: 10, materiality: 'medium', has_news: true, source: 'halan',
      headline: 'العنوان : العربية للادوية (ADCI.CA) - قرارات مجلس الادارة اسم الشركة: العربية كود رويترز: ADCI.CA مضمون الاعلان : نص الإعلان الفعلي هنا',
      title: 'قرارات مجلس الادارة', body: 'نص الإعلان الفعلي هنا'
    },
    {
      code: 'ABUK', axis: 62, events: 4, materiality: 'high', has_news: true, source: 'halan',
      headline: 'العنوان : ابوقير للاسمدة (ABUK.CA) - بيان من الشركة',
      title: 'بيان من الشركة', body: ''
    }
  ]
};

test('⑧ الكارت بيعرض عنوان الخبر ونصّه', async () => {
  const sb = loadNews(AXIS_PAYLOAD);
  await sb.win.naLoad();
  const html = sb.els.naList.innerHTML;
  assert.ok(html.includes('قرارات مجلس الادارة'), 'لازم عنوان الخبر ظاهر');
  assert.ok(html.includes('نص الإعلان الفعلي هنا'), 'لازم نص الخبر ظاهر');
  assert.ok(html.includes('82'), 'لازم الدرجة (82) ظاهرة');
  assert.ok(html.includes('من 100'), 'لازم «من 100»');
});

test('⑨ مفيش «بورصة هالان» ولا «المصدر» في كارت الأخبار', async () => {
  const sb = loadNews(AXIS_PAYLOAD);
  await sb.win.naLoad();
  const list = sb.els.naList.innerHTML;
  const note = sb.els.naSrc.innerHTML;
  assert.ok(!list.includes('بورصة هالان'), 'الكارت لسه فيه «بورصة هالان»');
  assert.ok(!note.includes('بورصة هالان'), 'الشرح لسه فيه «بورصة هالان»');
  assert.ok(!note.includes('المصدر'), 'الشرح لسه فيه «المصدر»');
});

test('⑩ عنوان القائمة يقول الفلتر الحالي', async () => {
  const sb = loadNews(AXIS_PAYLOAD);
  await sb.win.naLoad();
  assert.ok(sb.els.naSecH.innerHTML.includes('كل الأسهم'), 'الكل افتراضياً');
  /* ضغطة على «أهمية متوسطة» */
  const btn = { dataset: { naf: 'medium' }, classList: { toggle() { } } };
  sb.doc.dispatchEvent({
    type: 'click',
    target: { closest: (sel) => (sel === '[data-naf],[data-nas]' ? btn : null) }
  });
  assert.ok(sb.els.naSecH.innerHTML.includes('أهمية متوسطة'), 'لازم عنوان الفلتر يقول «أهمية متوسطة»');
  assert.ok(sb.els.naSecH.innerHTML.includes('1 سهم'), 'لازم عدد الأسهم يطابق الفلتر');
});

test('⑫ الشركة الخاسرة (مضاعف ٠) بتاخد أسوأ درجة — مش ٩٥', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/octa-filters.js'), 'utf8');
  assert.ok(src.includes('b:[[0,20],[5,95],[8,88],[12,78],[18,66],[28,52],[50,35],[NZ_R,20]]'),
    'شريحة مضاعف الربحية لازم تبدأ بـ[0,20]');
  assert.ok(src.includes('b:[[0,20],[0.5,95],[0.9,88],[1.4,78],[2.2,66],[3.5,52],[6,35],[NZ_R,20]]'),
    'شريحة مضاعف القيمة الدفترية لازم تبدأ بـ[0,20]');
  /* نفس منطق nzBand بالظبط */
  const band = (v, b) => { for (const p of b) if (v <= p[0]) return p[1]; return b[b.length - 1][1]; };
  const pe = [[0, 20], [5, 95], [8, 88], [12, 78], [18, 66], [28, 52], [50, 35], [1e9, 20]];
  const pb = [[0, 20], [0.5, 95], [0.9, 88], [1.4, 78], [2.2, 66], [3.5, 52], [6, 35], [1e9, 20]];
  assert.equal(band(0, pe), 20, 'خاسر (pe=0) ⇒ 20');
  assert.equal(band(0, pb), 20, 'حقوق ملكية سالبة (pb=0) ⇒ 20');
  assert.equal(band(1, pe), 95, 'رخيص (pe=1) ⇒ 95');
  assert.equal(band(60, pe), 20, 'غالي جداً ⇒ 20');
});

test('⑪ parseHalaText بيفصل العنوان ونص الإعلان', () => {
  const halanSrc = fs.readFileSync(path.join(ROOT, 'halan-news.js'), 'utf8')
    .replace(/export\s+(function|const|let|var)\s+/g, '$1 ')
    .replace(/export\s*\{[^}]*\}\s*;?/g, '')
    .replace(/export\s+default\s+/g, '');
  const fn = new Function(halanSrc + '\nreturn parseHalaText;');
  const parse = fn();
  const raw = 'العنوان : العربية للادوية والصناعات الكيماوية (ADCI.CA) - قرارات مجلس ادارة الشركة بجلسته المنعقدة بتاريخ 11/11/2026 اسم الشركة: العربية كود الترقيم الدولي: EGS38321C013 كود رويترز: ADCI.CA مضمون الاعلان : نص الإعلان';
  const out = parse(raw);
  assert.equal(out.title, 'قرارات مجلس ادارة الشركة بجلسته المنعقدة بتاريخ 11/11/2026');
  assert.ok(!out.title.includes('العربية'), 'اسم الشركة لسه في العنوان');
  assert.equal(out.body, 'نص الإعلان');
  /* نص فاضي ⇒ مفيش استثناء */
  const empty = parse('');
  assert.equal(empty.title, '');
  assert.equal(empty.body, '');
});

/* ═══════════════════════════════════════════════════════════════════
   ⑥ البحث في محور الأخبار + شرح الفرق بين الأعمدة
   ═══════════════════════════════════════════════════════════════════ */
test('⑬ البحث في محور الأخبار يشتغل بالكود', async () => {
  const sb = loadNews(AXIS_PAYLOAD);
  await sb.win.naLoad();
  assert.ok(sb.els.naList.innerHTML.includes('ADCI'), 'قبل البحث: ADCI ظاهر');
  assert.ok(sb.els.naList.innerHTML.includes('ABUK'), 'قبل البحث: ABUK ظاهر');
  /* كتابة «adci» (حروف صغيرة) */
  sb.doc.dispatchEvent({ type: 'input', target: { id: 'naSearch', value: 'adci' } });
  const html = sb.els.naList.innerHTML;
  assert.ok(html.includes('ADCI'), 'بعد البحث: ADCI لسه ظاهر');
  assert.ok(!html.includes('ABUK'), 'بعد البحث: ABUK مخفي');
  assert.ok(sb.els.naSecH.innerHTML.includes('نتائج'), 'العنوان يقول «نتائج»');
});

test('⑭ بحث مالوش نتيجة ⇒ رسالة واضحة', async () => {
  const sb = loadNews(AXIS_PAYLOAD);
  await sb.win.naLoad();
  sb.doc.dispatchEvent({ type: 'input', target: { id: 'naSearch', value: 'ZZZZ' } });
  const html = sb.els.naList.innerHTML;
  assert.ok(html.includes('مفيش سهم بالبحث'), 'لازم رسالة واضحة');
  assert.ok(!html.includes('ADCI'), 'مفيش أسهم');
});

test('⑮ الجدول بيشرح الفرق بين درجة الذراع والمجموع', () => {
  const sb = loadArms(DB, LIVE);
  sb.win.OCTAArmsFilter._t.setLive(LIVE);
  /* ذراع التقييم ⇒ مش جزء من النتيجة النهائية */
  clickArm(sb, 'v');
  let html = sb.els.armsList.innerHTML;
  assert.ok(html.includes('af-dnote'), 'لازم فيه صندوق الشرح');
  assert.ok(html.includes('مش جزء'), 'التقييم: لازم يتsay إنه مش جزء من النتيجة');
  assert.ok(html.includes('النتيجة النهائية'), 'لازم يشرح إيه هو المجموع');
  assert.ok(html.includes('مفيش رقم ناقصه نقارنه بيه'), 'لازم يشرح ليه الفرق «—» هنا');
  /* ذراع داخل في المجموع ⇒ بوزن من المصدر الحيّ */
  clickArm(sb, 'q');
  html = sb.els.armsList.innerHTML;
  assert.ok(html.includes('داخل في النتيجة النهائية'), 'الأساسي داخل في النتيجة');
  assert.ok(html.includes('24%'), 'لازم وزن المحور من المصدر الحيّ');
  assert.ok(html.includes('بالنقاط'), 'الفرق بالنقاط');
});
