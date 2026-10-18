/* ══════════════════════════════════════════════════════════════
   🧪 اختبارات الحفظ — assets/tests/storage.test.js
   ──────────────────────────────────────────────────────────────
   التشغيل:  cd /workspace/octa && node --test assets/tests/storage.test.js
   ⛔ مافيش framework تاني — node:test + node:assert/strict بس
   ⛔ مافيش fetch حقيقي — كل النداءات على mock
   ══════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const storage = require('../js/chart/storage.js');

/* ═══════════════════════════════════════════════════════════
   🛠 أدوات مساعدة
   ═══════════════════════════════════════════════════════════ */

const API_BASE = 'https://api.octa.test';

/* localStorage وهمي */
function mockStorage(seed) {
  const store = new Map();
  if (seed) for (const k of Object.keys(seed)) store.set(k, seed[k]);
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
    get length() { return store.size; }
  };
}

/* fetch وهمي — بيسجّل النداءات وبيرجّع رد مجهّز */
function mockFetch(handler) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = function (url, init) {
    calls.push({ url: String(url), init: init || {} });
    const res = handler ? handler(String(url), init || {}) : { ok: true, status: 200, body: { ok: true } };
    return Promise.resolve({
      ok: res.ok !== false,
      status: res.status === undefined ? 200 : res.status,
      json: () => Promise.resolve(res.body === undefined ? {} : res.body),
      text: () => Promise.resolve(JSON.stringify(res.body === undefined ? {} : res.body))
    });
  };
  return {
    calls,
    restore() { globalThis.fetch = orig; }
  };
}

/* نركّب البيئة: window (OCTA_API) + localStorage + fetch */
function withEnv(opts) {
  const o = opts || {};
  const hadWindow = 'window' in globalThis;
  const prevWindow = globalThis.window;
  const hadLS = 'localStorage' in globalThis;
  const prevLS = globalThis.localStorage;

  globalThis.window = { OCTA_API: o.base === undefined ? API_BASE : o.base };
  globalThis.localStorage = mockStorage(o.token ? { octa_token: o.token } : (o.storage || null));

  const f = mockFetch(o.handler);
  const messages = [];
  storage.setMessageHandler((t) => { messages.push(t); });

  return {
    calls: f.calls,
    messages,
    token: o.token || '',
    restore() {
      f.restore();
      storage.setMessageHandler(null);
      if (hadWindow) globalThis.window = prevWindow; else delete globalThis.window;
      if (hadLS) globalThis.localStorage = prevLS; else delete globalThis.localStorage;
    }
  };
}

/* رسمة كاملة — نفس forma الـdraw.js */
function sampleDrawings() {
  return [
    {
      id: 'd1', type: 'trendline',
      points: [{ t: '2026-09-01', p: 12.5 }, { t: '2026-10-01', p: 15.25 }],
      color: '#131722', width: 2, text: '', locked: false
    },
    {
      id: 'd2', type: 'hline',
      points: [{ p: 14.75 }],
      color: '#2962ff', width: 2, text: '', locked: false
    }
  ];
}

function sampleChart() {
  return {
    name: 'تحليل COMI',
    note: 'ملاحظة تجريبية',
    symbol: 'COMI',
    tf: '1D',
    type: 'candles',
    indicators: [{ id: 'sma', params: { period: 20 } }],
    drawings: sampleDrawings()
  };
}

/* ═══════════════════════════════════════════════════════════
   📦 الـpayload + الـround-trip
   ═══════════════════════════════════════════════════════════ */

test('storage: buildPayload — الحقول المطلوبة كلها موجودة', () => {
  const src = sampleChart();
  const p = storage.buildPayload(src);

  assert.equal(p.symbol, 'COMI');
  assert.equal(p.tf, '1D');
  assert.equal(p.type, 'candles');
  assert.equal(p.name, 'تحليل COMI');
  assert.equal(p.note, 'ملاحظة تجريبية');
  assert.ok(Array.isArray(p.indicators));
  assert.equal(p.indicators.length, 1);
  assert.equal(p.indicators[0].id, 'sma');
  assert.ok(Array.isArray(p.drawings));
  assert.equal(p.drawings.length, 2);
  assert.equal(p.drawings[0].type, 'trendline');
  assert.equal(p.drawings[0].points[0].t, '2026-09-01');
  assert.equal(p.drawings[0].points[0].p, 12.5);
  assert.equal(p.drawings[1].type, 'hline');
  assert.equal(p.drawings[1].points[0].p, 14.75);
});

test('storage: round-trip — object → JSON → object متساوي', () => {
  const p = storage.buildPayload(sampleChart());
  const json = JSON.stringify(p);
  const back = JSON.parse(json);
  assert.deepEqual(back, p);

  /* ونفس الرسومات بالظبط */
  const src = sampleChart();
  const p2 = storage.buildPayload(src);
  assert.deepEqual(JSON.parse(JSON.stringify(p2.drawings)), src.drawings);
  assert.deepEqual(JSON.parse(JSON.stringify(p2.indicators)), src.indicators);

  /* ومفيش أي مرجع مشترك (نسخة مستقلة) */
  p2.drawings[0].points[0].p = 999;
  assert.equal(src.drawings[0].points[0].p, 12.5);
});

/* ═══════════════════════════════════════════════════════════
   🛡 التنظيف (XSS)
   ═══════════════════════════════════════════════════════════ */

test('storage: sanitizer — اسم فيه HTML بيتشال بالكامل', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const p = storage.buildPayload({ name: evil, note: '<script>alert(2)</script>مرحبا', symbol: 'COMI' });

  assert.ok(!p.name.includes('<'), 'الاسم فيه <');
  assert.ok(!p.name.includes('>'), 'الاسم فيه >');
  assert.ok(!p.name.includes('onerror'), 'الاسم فيه onerror');
  assert.ok(!p.note.includes('<'), 'الملاحظة فيها <');
  assert.ok(!p.note.includes('script'), 'الملاحظة فيها script');
  assert.equal(p.name, '');
  assert.equal(p.note, 'مرحبا');
});

test('storage: escapeHtml — الأقواس بتت conversions', () => {
  const out = storage.escapeHtml('<b onclick="x">&\'</b>');
  assert.ok(!out.includes('<'));
  assert.ok(!out.includes('>'));
  assert.ok(out.includes('&lt;'));
  assert.ok(out.includes('&amp;'));
  assert.ok(out.includes('&quot;'));
});

test('storage: sanitizer — محارف التحكم بتتشال والنص بيتقلم', () => {
  assert.equal(storage.sanitizeText('  مرحبا  '), 'مرحبا');
  assert.equal(storage.sanitizeText('a\u0007b'), 'ab');
  assert.equal(storage.sanitizeText(null), '');
  assert.equal(storage.sanitizeText(undefined), '');
});

/* ═══════════════════════════════════════════════════════════
   📨 buildRequest
   ═══════════════════════════════════════════════════════════ */

test('storage: buildRequest — header Bearer + base صح', () => {
  const req = storage.buildRequest('/api/charts', {
    method: 'POST', token: 'tok-123', base: API_BASE, payload: { name: 'x' }
  });

  assert.equal(req.url, API_BASE + '/api/charts');
  assert.equal(req.method, 'POST');
  assert.equal(req.headers.Authorization, 'Bearer tok-123');
  assert.equal(req.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(req.body), { name: 'x' });
});

test('storage: buildRequest — مافيش توكن → مافيش header Authorization', () => {
  const req = storage.buildRequest('/api/charts/list', { method: 'GET', token: '', base: API_BASE });
  assert.equal(req.url, API_BASE + '/api/charts/list');
  assert.equal(req.method, 'GET');
  assert.equal(req.headers.Authorization, undefined);
  assert.equal(req.body, null);
});

test('storage: buildRequest — الـbase بيتقرأ من window.OCTA_API', () => {
  const env = withEnv({ token: 'tok-xyz', base: 'https://other.test/' });
  try {
    const req = storage.buildRequest('/api/charts', { method: 'GET' });
    assert.equal(req.url, 'https://other.test/api/charts');
    assert.equal(req.headers.Authorization, 'Bearer tok-xyz');
  } finally {
    env.restore();
  }
});

/* ═══════════════════════════════════════════════════════════
   💾 الحفظ
   ═══════════════════════════════════════════════════════════ */

test('storage: save بلا توكن — «سجّل دخول الأول» + حفظ محلي (مابتكسرش)', async () => {
  const env = withEnv({ token: '' });
  try {
    const res = await storage.save(sampleChart());
    assert.equal(res.ok, true);
    assert.equal(res.local, true);
    assert.ok(res.id, 'مفيش id');
    assert.ok(env.messages.includes('سجّل دخول الأول'), 'مفيش رسالة «سجّل دخول الأول»');
    assert.equal(env.calls.length, 0, 'مفروض مافيش طلب شبكة');

    /* الحفظ المحلي موجود فعلاً */
    const list = storage.localList();
    assert.equal(list.length, 1);
    assert.equal(list[0].symbol, 'COMI');
    assert.equal(list[0].name, 'تحليل COMI');
  } finally {
    env.restore();
  }
});

test('storage: save بتوكن — POST /api/charts + Bearer + body صحيح', async () => {
  const env = withEnv({
    token: 'tok-abc',
    handler: () => ({ ok: true, status: 200, body: { ok: true, id: 'chart-77' } })
  });
  try {
    const res = await storage.save(sampleChart());
    assert.equal(res.ok, true);
    assert.equal(res.id, 'chart-77');
    assert.equal(res.local, false);

    assert.equal(env.calls.length, 1);
    const call = env.calls[0];
    assert.equal(call.url, API_BASE + '/api/charts');
    assert.equal(call.init.method, 'POST');
    assert.equal(call.init.headers.Authorization, 'Bearer tok-abc');
    assert.equal(call.init.headers['Content-Type'], 'application/json');

    const body = JSON.parse(call.init.body);
    assert.equal(body.symbol, 'COMI');
    assert.equal(body.tf, '1D');
    assert.equal(body.type, 'candles');
    assert.equal(body.drawings.length, 2);
    assert.equal(body.indicators.length, 1);
  } finally {
    env.restore();
  }
});

test('storage: save والرد 401 — «سجّل دخول الأول» + fallback محلي', async () => {
  const env = withEnv({
    token: 'tok-bad',
    handler: () => ({ ok: false, status: 401, body: { error: 'unauthorized' } })
  });
  try {
    const res = await storage.save(sampleChart());
    assert.equal(res.ok, true);
    assert.equal(res.local, true);
    assert.ok(env.messages.includes('سجّل دخول الأول'));
    assert.equal(storage.localList().length, 1);
  } finally {
    env.restore();
  }
});

test('storage: save والسيرفر واقع — fallback محلي ومابتكسرش', async () => {
  const env = withEnv({ token: 'tok-x' });
  const orig = globalThis.fetch;
  globalThis.fetch = function () { return Promise.reject(new Error('offline')); };
  try {
    const res = await storage.save(sampleChart());
    assert.equal(res.ok, true);
    assert.equal(res.local, true);
    assert.ok(res.id);
  } finally {
    globalThis.fetch = orig;
    env.restore();
  }
});

/* ═══════════════════════════════════════════════════════════
   📋 القراءة
   ═══════════════════════════════════════════════════════════ */

test('storage: list — GET /api/charts/list + تنظيف الأسماء', async () => {
  const env = withEnv({
    token: 'tok-l',
    handler: () => ({
      ok: true, status: 200,
      body: {
        ok: true,
        charts: [{
          id: 'c1', name: '<img src=x onerror=alert(1)>', note: '<b>hi</b>',
          symbol: 'comi', tf: '1D', updated: '2026-10-18T00:00:00Z'
        }]
      }
    })
  });
  try {
    const list = await storage.list();
    assert.equal(env.calls.length, 1);
    assert.equal(env.calls[0].url, API_BASE + '/api/charts/list');
    assert.equal(env.calls[0].init.method, 'GET');
    assert.equal(env.calls[0].init.headers.Authorization, 'Bearer tok-l');

    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'c1');
    assert.equal(list[0].symbol, 'COMI');
    assert.ok(!list[0].name.includes('<'));
    assert.ok(!list[0].name.includes('onerror'));
    assert.ok(!list[0].note.includes('<'));
    assert.equal(list[0].updated, '2026-10-18T00:00:00Z');
  } finally {
    env.restore();
  }
});

test('storage: list — لو /list رجّع 404 بيرجع لـ /api/charts', async () => {
  const env = withEnv({
    token: 'tok-l2',
    handler: (url) => {
      if (url.indexOf('/api/charts/list') !== -1) return { ok: false, status: 404, body: {} };
      return { ok: true, status: 200, body: { ok: true, charts: [{ id: 'c9', name: 'x' }] } };
    }
  });
  try {
    const list = await storage.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'c9');
    assert.equal(env.calls.length, 2);
    assert.equal(env.calls[1].url, API_BASE + '/api/charts');
  } finally {
    env.restore();
  }
});

test('storage: load — GET /api/charts/<id> بيرجّع الحالة', async () => {
  const env = withEnv({
    token: 'tok-load',
    handler: () => ({
      ok: true, status: 200,
      body: {
        ok: true,
        chart: {
          id: 'c5', name: 'خط اتجاه', note: 'ملاحظة',
          symbol: 'COMI', tf: '1W', type: 'bars',
          indicators: [{ id: 'ema', params: { period: 50 } }],
          drawings: sampleDrawings()
        }
      }
    })
  });
  try {
    const st = await storage.load('c5');
    assert.equal(env.calls[0].url, API_BASE + '/api/charts/c5');
    assert.equal(env.calls[0].init.method, 'GET');
    assert.equal(st.id, 'c5');
    assert.equal(st.symbol, 'COMI');
    assert.equal(st.tf, '1W');
    assert.equal(st.type, 'bars');
    assert.equal(st.indicators.length, 1);
    assert.equal(st.drawings.length, 2);
    assert.equal(st.drawings[0].points[1].p, 15.25);
  } finally {
    env.restore();
  }
});

test('storage: remove — DELETE /api/charts/<id>', async () => {
  const env = withEnv({
    token: 'tok-del',
    handler: () => ({ ok: true, status: 200, body: { ok: true, deleted: true } })
  });
  try {
    const res = await storage.remove('c5');
    assert.equal(res.ok, true);
    assert.equal(res.deleted, true);
    assert.equal(env.calls[0].url, API_BASE + '/api/charts/c5');
    assert.equal(env.calls[0].init.method, 'DELETE');
    assert.equal(env.calls[0].init.headers.Authorization, 'Bearer tok-del');
  } finally {
    env.restore();
  }
});

/* ═══════════════════════════════════════════════════════════
   🖼 تصدير PNG
   ═══════════════════════════════════════════════════════════ */

test('storage: buildFilename — الاسم فيه رمز السهم', () => {
  const name = storage.buildFilename('COMI');
  assert.ok(name.includes('COMI'), 'الاسم فيه رمز السهم');
  assert.ok(name.endsWith('.png'), 'الاسم لازم ينتهي بـ .png');

  const named = storage.buildFilename('COMI', 'تحليل-الشهر');
  assert.ok(named.includes('COMI'));
  assert.ok(named.endsWith('.png'));
  assert.ok(!named.includes('/'), 'مفيش slash في اسم الملف');
});

test('storage: exportPNG — بيرجّع اسم فيه رمز السهم (من غير DOM = reason واضح)', async () => {
  const env = withEnv({ token: '' });
  try {
    const res = await storage.exportPNG({ symbol: 'COMI' }, 'خط-اتجاه');
    assert.ok(res.filename.includes('COMI'), 'الاسم فيه رمز السهم');
    assert.ok(res.filename.endsWith('.png'));
    /* في Node مافيش DOM — لازم يرجّع سبب واضح مش exception */
    assert.equal(res.ok, false);
    assert.ok(res.reason, 'مفيش سبب');
  } finally {
    env.restore();
  }
});

/* ═══════════════════════════════════════════════════════════
   🔒 مافيش fetch حقيقي
   ═══════════════════════════════════════════════════════════ */

test('storage: كل النداءات كانت على الـmock — مافيش شبكة حقيقية', async () => {
  const env = withEnv({
    token: 'tok-safe',
    handler: (url) => {
      /* لو وصلنا شبكة حقيقية هنوقف */
      assert.ok(String(url).startsWith(API_BASE), 'طلب خارج الـbase: ' + url);
      return { ok: true, status: 200, body: { ok: true, id: 'x', charts: [], chart: null, deleted: true } };
    }
  });
  const isMock = globalThis.fetch;
  try {
    await storage.save(sampleChart());
    await storage.list();
    await storage.load('x');
    await storage.remove('x');

    assert.equal(env.calls.length, 4);
    for (const c of env.calls) {
      assert.ok(c.url.startsWith(API_BASE), 'URL غلط: ' + c.url);
    }
    assert.equal(globalThis.fetch, isMock, 'الـfetch اتغيّر');
  } finally {
    env.restore();
  }
});
