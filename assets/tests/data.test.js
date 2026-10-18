/* ══════════════════════════════════════════════════════════════
   🧪 اختبارات طبقة بيانات الشارت — assets/tests/data.test.js
   ──────────────────────────────────────────────────────────────
   التشغيل:  cd /workspace/octa && node --test assets/tests/data.test.js
   ⛔ مافيش framework تاني — node:test + node:assert/strict بس
   ══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const data = require('../js/chart/data.js');

/* ═══════════════════════════════════════════════════════════
   🛠 أدوات مساعدة
   ═══════════════════════════════════════════════════════════ */

/* يوم تداول: {t, o, h, l, c, v} — نفس forma الـAPI بالظبط */
function day(t, o, h, l, c, v) {
  return { t: t, o: o, h: h, l: l, c: c, v: v };
}

/*.fetch وهمي — بيرجّع Body معيّن وبيرمي خطأ لو اتطلب */
function mockFetch(handler) {
  const orig = globalThis.fetch;
  globalThis.fetch = handler;
  return function restore() { globalThis.fetch = orig; };
}

/* window وهمي فيه OCTA_API (Node مافيشش window) */
function withWindow(apiBase) {
  const had = 'window' in globalThis;
  const prev = globalThis.window;
  globalThis.window = { OCTA_API: apiBase };
  return function restore() {
    if (had) globalThis.window = prev;
    else delete globalThis.window;
  };
}

/* ═══════════════════════════════════════════════════════════
   🎯 الفريمات
   ═══════════════════════════════════════════════════════════ */

test('TIMEFRAMES: يومي وأسبوعي وشهري بس — مافيش intraday', () => {
  assert.deepEqual(Object.keys(data.TIMEFRAMES).sort(), ['1D', '1M', '1W']);

  assert.equal(data.TIMEFRAMES['1D'].label, 'يومي');
  assert.equal(data.TIMEFRAMES['1W'].label, 'أسبوعي');
  assert.equal(data.TIMEFRAMES['1M'].label, 'شهري');

  assert.equal(data.TIMEFRAMES['1D'].bar, 'day');
  assert.equal(data.TIMEFRAMES['1W'].bar, 'week');
  assert.equal(data.TIMEFRAMES['1M'].bar, 'month');

  assert.equal(data.TIMEFRAMES['1D'].ms, 864e5);
  assert.equal(data.TIMEFRAMES['1W'].ms, 6048e5);
  assert.equal(data.TIMEFRAMES['1M'].ms, 2592e6);
});

test('TIMEFRAMES: مافيش فريم intraday متسرب', () => {
  const forbidden = ['1m', '5m', '15m', '30m', '1h', '4h', '5m', '15د', 'ساعة'];
  Object.keys(data.TIMEFRAMES).forEach((k) => {
    assert.equal(forbidden.indexOf(k), -1, 'فريم ممنوع: ' + k);
    assert.equal(data.TIMEFRAMES[k].bar === 'day' || data.TIMEFRAMES[k].bar === 'week' || data.TIMEFRAMES[k].bar === 'month', true);
  });
});

/* ═══════════════════════════════════════════════════════════
   📅 التجميع الأسبوعي — الأسبوع بيبدأ بالأحد
   ═══════════════════════════════════════════════════════════ */

/* أسبوع كامل: الأحد 11/10 → الخميس 15/10/2026 (الجمعة والسبت مفيش تداول) */
const WEEK_CANDLES = [
  day('2026-10-11', 10.0, 12.0, 9.5, 11.0, 100),
  day('2026-10-12', 11.0, 13.0, 10.5, 12.5, 200),
  day('2026-10-13', 12.5, 14.0, 12.0, 13.5, 150),
  day('2026-10-14', 13.5, 15.0, 13.0, 14.5, 300),
  day('2026-10-15', 14.5, 16.0, 14.0, 15.5, 250)
];

test('resample أسبوعي: 7 أيام متتالية (الأحد→الخميس) → شمعة واحدة صحيحة', () => {
  const out = data.resample(WEEK_CANDLES, '1W');

  assert.equal(out.length, 1, 'لازم شمعة واحدة بس');
  const w = out[0];

  /* أول يوم تداول في الأسبوع (الأحد) هو بداية الشمعة */
  assert.equal(w.t, '2026-10-11');
  /* o = أول فتح */
  assert.equal(w.o, 10.0);
  /* h = أعلى high */
  assert.equal(w.h, 16.0);
  /* l = أقل low */
  assert.equal(w.l, 9.5);
  /* c = آخر إغلاق */
  assert.equal(w.c, 15.5);
  /* v = مجموع الأحجام */
  assert.equal(w.v, 1000);
});

test('resample أسبوعي: 7 أيام تقويمية متتالية (حتى لو فيه بيانات يوم الجمعة/السبت) → شمعة واحدة', () => {
  const seven = [
    day('2026-10-11', 10.0, 12.0, 9.5, 11.0, 100),
    day('2026-10-12', 11.0, 13.0, 10.5, 12.5, 200),
    day('2026-10-13', 12.5, 14.0, 12.0, 13.5, 150),
    day('2026-10-14', 13.5, 15.0, 13.0, 14.5, 300),
    day('2026-10-15', 14.5, 16.0, 14.0, 15.5, 250),
    day('2026-10-16', 15.5, 16.5, 15.0, 16.0, 50),
    day('2026-10-17', 16.0, 17.0, 15.5, 16.5, 25)
  ];

  const out = data.resample(seven, '1W');
  assert.equal(out.length, 1);
  assert.equal(out[0].t, '2026-10-11');
  assert.equal(out[0].o, 10.0);
  assert.equal(out[0].h, 17.0);
  assert.equal(out[0].l, 9.5);
  assert.equal(out[0].c, 16.5);
  assert.equal(out[0].v, 1075);
});

test('resample أسبوعي: الخميس وأول dimanche تبعاه = أسبوعين مختلفين', () => {
  const two = [
    day('2026-10-15', 14.5, 16.0, 14.0, 15.5, 250),
    day('2026-10-18', 15.5, 17.0, 15.0, 16.5, 400)
  ];

  const out = data.resample(two, '1W');
  assert.equal(out.length, 2);
  assert.equal(out[0].t, '2026-10-15');
  assert.equal(out[1].t, '2026-10-18');
  assert.equal(out[0].v, 250);
  assert.equal(out[1].v, 400);
});

test('resample أسبوعي: ترتيب تصاعدي + مافيش شموع فاضية', () => {
  const out = data.resample(WEEK_CANDLES.concat([
    day('2026-10-19', 16.5, 18.0, 16.0, 17.5, 90),
    day('2026-10-20', 17.5, 19.0, 17.0, 18.5, 110)
  ]), '1W');

  assert.equal(out.length, 2);
  assert.ok(out[0].t < out[1].t, 'الترتيب لازم يبقى تصاعدي');

  /* مافيش يوم غير تداول اتزرع */
  out.forEach((c) => {
    assert.match(c.t, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(c.v > 0);
  });
});

/* ═══════════════════════════════════════════════════════════
   🗓 التجميع الشهري — تقويم ميلادي
   ═══════════════════════════════════════════════════════════ */

const MONTH_CANDLES = [
  day('2026-09-28', 20.0, 22.0, 19.5, 21.0, 1000),
  day('2026-09-29', 21.0, 23.0, 20.5, 22.5, 2000),
  day('2026-09-30', 22.5, 24.0, 22.0, 23.5, 1500),
  day('2026-10-01', 23.5, 25.0, 23.0, 24.5, 3000),
  day('2026-10-05', 24.5, 26.0, 24.0, 25.5, 2500)
];

test('resample شهري: بيانات عبر شهرين → شهرين بالظبط', () => {
  const out = data.resample(MONTH_CANDLES, '1M');

  assert.equal(out.length, 2);

  /* شهر سبتمبر */
  assert.equal(out[0].t, '2026-09-28');
  assert.equal(out[0].o, 20.0);
  assert.equal(out[0].h, 24.0);
  assert.equal(out[0].l, 19.5);
  assert.equal(out[0].c, 23.5);
  assert.equal(out[0].v, 4500);

  /* شهر أكتوبر */
  assert.equal(out[1].t, '2026-10-01');
  assert.equal(out[1].o, 23.5);
  assert.equal(out[1].h, 26.0);
  assert.equal(out[1].l, 23.0);
  assert.equal(out[1].c, 25.5);
  assert.equal(out[1].v, 5500);

  assert.ok(out[0].t < out[1].t);
});

test('resample شهري: بداية الشهر = أول يوم تداول (مش تاريخ تقويمي متخيّل)', () => {
  /* 1 أكتوبر مش يوم تداول (إجازة) → الشمعة لازم تبدأ بـ 5 أكتوبر */
  const out = data.resample([
    day('2026-10-05', 10.0, 11.0, 9.5, 10.5, 700),
    day('2026-10-06', 10.5, 12.0, 10.0, 11.5, 300)
  ], '1M');

  assert.equal(out.length, 1);
  assert.equal(out[0].t, '2026-10-05');
});

/* ═══════════════════════════════════════════════════════════
   🔢 مجموع الأحجام = حجم الشمعة المجمّعة
   ═══════════════════════════════════════════════════════════ */

test('مجموع أحجام اليومية = حجم الشمعة المجمّعة (أسبوعي)', () => {
  const out = data.resample(WEEK_CANDLES, '1W');
  const sum = WEEK_CANDLES.reduce((a, c) => a + c.v, 0);
  assert.equal(out[0].v, sum);
  assert.equal(out.length * out[0].v, sum);
});

test('مجموع أحجام اليومية = حجم الشمعة المجمّعة (شهري)', () => {
  const out = data.resample(MONTH_CANDLES, '1M');
  const sum = MONTH_CANDLES.reduce((a, c) => a + c.v, 0);
  assert.equal(out[0].v + out[1].v, sum);
});

test('مجموع أحجام اليومية = حجم الشمعة المجمّعة (أسبوعين)', () => {
  const twoWeeks = WEEK_CANDLES.concat([
    day('2026-10-18', 15.5, 17.0, 15.0, 16.5, 400),
    day('2026-10-19', 16.5, 18.0, 16.0, 17.5, 600)
  ]);
  const out = data.resample(twoWeeks, '1W');
  const sum = twoWeeks.reduce((a, c) => a + c.v, 0);
  assert.equal(out.length, 2);
  assert.equal(out[0].v + out[1].v, sum);
});

/* ═══════════════════════════════════════════════════════════
   🛡️ الحالات الصعبة
   ═══════════════════════════════════════════════════════════ */

test('resample: فريم مش معروف → نفس المصفوفة (fallback آمن، مافيش exception)', () => {
  assert.doesNotThrow(() => data.resample(WEEK_CANDLES, '5m'));
  const out = data.resample(WEEK_CANDLES, '5m');
  assert.equal(out.length, WEEK_CANDLES.length);
  assert.deepEqual(out, WEEK_CANDLES);

  /* حتى لو الفريم مش موجود خالص */
  assert.doesNotThrow(() => data.resample(WEEK_CANDLES, 'ZZZ'));
  assert.doesNotThrow(() => data.resample(WEEK_CANDLES, undefined));
});

test('resample: مدخلات مش صالحة → مافيش exception ومافيش قيم مخترعة', () => {
  assert.deepEqual(data.resample(null, '1W'), []);
  assert.deepEqual(data.resample(undefined, '1W'), []);
  assert.deepEqual(data.resample([], '1W'), []);
  assert.deepEqual(data.resample('مش مصفوفة', '1W'), []);
});

test('resample: شمعة ناقصة (تاريخ أو سعر غلط) بتتشال — مافيش شمعة وهمية', () => {
  const dirty = [
    day('2026-10-11', 10, 12, 9.5, 11, 100),
    { t: 'مش تاريخ', o: 1, h: 2, l: 0, c: 1, v: 5 },
    { t: '2026-10-13', o: 1, h: null, l: 0, c: 1, v: 5 },
    { t: '2026-02-30', o: 1, h: 2, l: 0, c: 1, v: 5 },
    null,
    day('2026-10-12', 11, 13, 10.5, 12.5, 200)
  ];

  const out = data.resample(dirty, '1W');
  assert.equal(out.length, 1);
  assert.equal(out[0].t, '2026-10-11');
  assert.equal(out[0].o, 10);
  assert.equal(out[0].c, 12.5);
  assert.equal(out[0].v, 300);
});

test('resample: 1D بيرجّع نفس الشموع مرتبة تصاعدياً', () => {
  const out = data.resample(WEEK_CANDLES, '1D');
  assert.equal(out.length, WEEK_CANDLES.length);
  assert.deepEqual(out, WEEK_CANDLES);

  /* ترتيب تصاعدي حتى لو المدخلات مقلوبة */
  const flipped = data.resample(WEEK_CANDLES.slice().reverse(), '1D');
  assert.equal(flipped.length, WEEK_CANDLES.length);
  assert.ok(flipped[0].t < flipped[1].t);
});

/* ═══════════════════════════════════════════════════════════
   🌐 fetchCandles
   ═══════════════════════════════════════════════════════════ */

test('fetchCandles: الـAPI رجّع ok:false → مصفوفة فاضية + reason (مافيش throw)', async () => {
  const restoreWin = withWindow('https://api.example.test');
  const restoreFetch = mockFetch(async () => ({
    ok: false,
    status: 404,
    json: async () => ({ ok: false, error: 'no data', len: 0 })
  }));

  try {
    const res = await data.fetchCandles('COMI', { n: 300, tf: '1D' });

    assert.ok(Array.isArray(res), 'لازم يرجّع مصفوفة');
    assert.equal(res.length, 0, 'مصفوفة فاضية');
    assert.ok(res.reason, 'لازم فيه reason');
    assert.match(res.reason, /no data/);
    assert.equal(res.ok, false);

    /* ⛔ مافيش قيم افتراضية ولا شموع وهمية */
    assert.deepEqual(Array.from(res), []);
  } finally {
    restoreFetch();
    restoreWin();
  }
});

test('fetchCandles: فشل الشبكة → مصفوفة فاضية + reason (مافيش exception بيتفجّر)', async () => {
  const restoreWin = withWindow('https://api.example.test');
  const restoreFetch = mockFetch(async () => { throw new Error('connection refused'); });

  try {
    const res = await data.fetchCandles('COMI');
    assert.ok(Array.isArray(res));
    assert.equal(res.length, 0);
    assert.equal(res.reason, 'network_error');
    assert.equal(res.ok, false);
  } finally {
    restoreFetch();
    restoreWin();
  }
});

test('fetchCandles: رد مش JSON → مصفوفة فاضية + reason', async () => {
  const restoreWin = withWindow('https://api.example.test');
  const restoreFetch = mockFetch(async () => ({
    ok: false,
    status: 500,
    json: async () => { throw new Error('not json'); }
  }));

  try {
    const res = await data.fetchCandles('COMI');
    assert.equal(res.length, 0);
    assert.ok(res.reason);
    assert.equal(res.ok, false);
  } finally {
    restoreFetch();
    restoreWin();
  }
});

test('fetchCandles: مافيش window.OCTA_API → مصفوفة فاضية + reason (مافيش hardcode)', async () => {
  const had = 'window' in globalThis;
  const prev = globalThis.window;
  const origFetch = globalThis.fetch;
  let called = false;
  globalThis.window = { OCTA_API: '' };
  globalThis.fetch = async () => { called = true; return { ok: true, status: 200, json: async () => ({ ok: true, candles: [] }) }; };

  try {
    const res = await data.fetchCandles('COMI');
    assert.equal(res.length, 0);
    assert.equal(res.reason, 'no_api_base');
    assert.equal(called, false, 'مفروضش يطلب من أي سيرفر');
  } finally {
    globalThis.fetch = origFetch;
    if (had) globalThis.window = prev;
    else delete globalThis.window;
  }
});

test('fetchCandles: كود فاضي → مصفوفة فاضية + reason (مافيش طلب)', async () => {
  const restoreWin = withWindow('https://api.example.test');
  const restoreFetch = mockFetch(async () => { throw new Error('مفروضش ينادي'); });

  try {
    const res = await data.fetchCandles('');
    assert.equal(res.length, 0);
    assert.equal(res.reason, 'invalid_code');
  } finally {
    restoreFetch();
    restoreWin();
  }
});

test('fetchCandles: نجاح → شموع حقيقية + الـURL من window.OCTA_API', async () => {
  const restoreWin = withWindow('https://api.example.test');
  let seenUrl = null;
  const restoreFetch = mockFetch(async (url) => {
    seenUrl = String(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, code: 'COMI', candles: WEEK_CANDLES })
    };
  });

  try {
    const res = await data.fetchCandles('COMI', { n: 300, tf: '1D' });

    assert.equal(seenUrl, 'https://api.example.test/api/candles/COMI?n=300');
    assert.equal(res.length, 5);
    assert.equal(res.ok, true);
    assert.equal(res.reason, '');
    assert.equal(res[0].t, '2026-10-11');
    assert.equal(res[0].c, 11.0);
  } finally {
    restoreFetch();
    restoreWin();
  }
});

test('fetchCandles: tf=1W بيرجّع الشموع متجمّعة أسبوعياً', async () => {
  const restoreWin = withWindow('https://api.example.test');
  const restoreFetch = mockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, code: 'COMI', candles: WEEK_CANDLES })
  }));

  try {
    const res = await data.fetchCandles('COMI', { n: 300, tf: '1W' });
    assert.equal(res.length, 1);
    assert.equal(res[0].t, '2026-10-11');
    assert.equal(res[0].v, 1000);
  } finally {
    restoreFetch();
    restoreWin();
  }
});

test('fetchCandles: n بيتبعت للـAPI زي ما هو', async () => {
  const restoreWin = withWindow('https://api.example.test');
  let seenUrl = null;
  const restoreFetch = mockFetch(async (url) => {
    seenUrl = String(url);
    return { ok: true, status: 200, json: async () => ({ ok: true, candles: [] }) };
  });

  try {
    await data.fetchCandles('COMI', { n: 500 });
    assert.match(seenUrl, /\/api\/candles\/COMI\?n=500$/);

    await data.fetchCandles('COMI');
    assert.match(seenUrl, /\/api\/candles\/COMI\?n=300$/);
  } finally {
    restoreFetch();
    restoreWin();
  }
});

test('fetchCandles: الكود بيترمز (URL encode) والمسار مظبوط', async () => {
  const restoreWin = withWindow('https://api.example.test');
  let seenUrl = null;
  const restoreFetch = mockFetch(async (url) => {
    seenUrl = String(url);
    return { ok: true, status: 200, json: async () => ({ ok: true, candles: [] }) };
  });

  try {
    await data.fetchCandles('comi');
    assert.match(seenUrl, /\/api\/candles\/COMI\?/);
  } finally {
    restoreFetch();
    restoreWin();
  }
});

/* ═══════════════════════════════════════════════════════════
   📐 toSeries — صيغة lightweight-charts v5
   ═══════════════════════════════════════════════════════════ */

test('toSeries: t→time + o/h/l/c/v→open/high/low/close/volume', () => {
  const out = data.toSeries([day('2026-10-11', 10, 12, 9.5, 11, 100)]);

  assert.equal(out.length, 1);
  assert.deepEqual(out[0], {
    time: '2026-10-11',
    open: 10,
    high: 12,
    low: 9.5,
    close: 11,
    volume: 100
  });
});

test('toSeries: الـtime بالشكل اللي lightweight-charts v5 عايزه (YYYY-MM-DD)', () => {
  const out = data.toSeries(WEEK_CANDLES);
  assert.equal(out.length, 5);
  out.forEach((p) => {
    assert.match(p.time, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof p.time, 'string');
    assert.deepEqual(Object.keys(p).sort(), ['close', 'high', 'low', 'open', 'time', 'volume']);
    assert.equal(typeof p.open, 'number');
    assert.equal(typeof p.high, 'number');
    assert.equal(typeof p.low, 'number');
    assert.equal(typeof p.close, 'number');
    assert.equal(typeof p.volume, 'number');
  });
});

test('toSeries: ترتيب تصاعدي + الشموع الناقصة بتتشال', () => {
  const out = data.toSeries([
    day('2026-10-12', 11, 13, 10.5, 12.5, 200),
    { t: 'مش تاريخ', o: 1, h: 2, l: 0, c: 1, v: 5 },
    { t: '2026-10-13', o: 1, h: null, l: 0, c: 1, v: 5 },
    day('2026-10-11', 10, 12, 9.5, 11, 100)
  ]);

  assert.equal(out.length, 2);
  assert.equal(out[0].time, '2026-10-11');
  assert.equal(out[1].time, '2026-10-12');
});

test('toSeries: مدخلات مش صالحة → مصفوفة فاضية (مافيش exception)', () => {
  assert.deepEqual(data.toSeries(null), []);
  assert.deepEqual(data.toSeries(undefined), []);
  assert.deepEqual(data.toSeries([]), []);
});

test('toSeries: شمعة مجمّعة أسبوعياً بتتحل صح', () => {
  const weekly = data.resample(WEEK_CANDLES, '1W');
  const series = data.toSeries(weekly);

  assert.equal(series.length, 1);
  assert.equal(series[0].time, '2026-10-11');
  assert.equal(series[0].open, 10);
  assert.equal(series[0].high, 16);
  assert.equal(series[0].low, 9.5);
  assert.equal(series[0].close, 15.5);
  assert.equal(series[0].volume, 1000);
});

/* ═══════════════════════════════════════════════════════════
   🔌 التصدير
   ═══════════════════════════════════════════════════════════ */

test('التصدير: module.exports فيه العقد كامل', () => {
  assert.equal(typeof data.TIMEFRAMES, 'object');
  assert.equal(typeof data.fetchCandles, 'function');
  assert.equal(typeof data.resample, 'function');
  assert.equal(typeof data.toSeries, 'function');
});

test('التصدير: window.OCTAChart.data متاح (نفس الكود في المتصفح)', () => {
  assert.ok(globalThis.OCTAChart, 'OCTAChart لازم يكون معرّف');
  assert.ok(globalThis.OCTAChart.data, 'OCTAChart.data لازم يكون معرّف');
  assert.equal(globalThis.OCTAChart.data.resample, data.resample);
  assert.equal(globalThis.OCTAChart.data.TIMEFRAMES, data.TIMEFRAMES);
});
