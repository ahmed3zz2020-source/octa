/* ══════════════════════════════════════════════════════════════════════
   🧪 اختبار API المعاينة المعزولة (الجولة ٢٦ · البند ٤)
   ──────────────────────────────────────────────────────────────────────
   ⛔ الهدف: إثبات أن المعاينة عندها API **حقيقي** ⭐ (تسجيل ⭐ دخول ⭐
      جلسات ⭐ أسعار ⭐ محفظة ⭐ تنبيهات ⭐) على تخزينها الخاص ⭐
      وبمافيش أي اتصال بالإنتاج ⭐.

   📌 كل تأكيد بيتأكد من **المحتوى** ⭐ (مش 200 بس ⭐).
   📌 التشغيل: node --test assets/tests/preview-api.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { handlePreviewApi } = require('../../preview-api.js');

/* ── KV وهمي ⭐ (نفس دلالات Cloudflare KV ⭐) ── */
function fakeKV() {
  const store = new Map();
  return {
    store: store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    async list(opts) {
      /* ⭐⭐⭐ (R28 · FINDING-01) ⭐⭐⭐ عقد Cloudflare Durable Objects ⭐⭐⭐
         ⑈ العقد الحقيقيّ؟ `list()` ⭐ بترجّع **Map** ⭐ مش، {keys, cursor} ⭐
         ⑈ الموك القديم كان يستخدم العيب ⭐ ولم يكشف العيب ⭐ */
      const prefix = (opts && opts.prefix) || '';
      const out = new Map();
      for (const k of store.keys()) {
        if (k.indexOf(prefix) === 0) out.set(k, store.get(k));
      }
      return out;
    }
  };
}

function env(overrides) {
  return Object.assign({
    OCTA_PREVIEW_SELF_API: 'on',
    PREVIEW_KV: fakeKV(),
    PREVIEW_STORE: fakeDO(),
    PREVIEW_SESSION_SECRET: 'test-secret-not-real',
    PREVIEW_CONSOLE_KEY: 'test-preview-console-key'
  }, overrides || {});
}

/* ⭐⭐⭐ (R28) ⭐ مخزن المعاينة ⭐ (Durable Object ⭐) ⭐
   ⭐ الكود الحقيقي بيُستخدم الكلاس الحقيقي ⭐
   ⭐ لعند التحقق ⭐: انتساق قوي ⭐ (مافيش انتساق مقابر ⭐). */
const { PreviewStore } = require('../../preview-store.js');

function fakeDO() {
  const map = new Map();
  const storage = {
    async get(k) { return map.has(k) ? map.get(k) : undefined; },
    async put(k, v) { map.set(k, v); },
    async delete(k) { map.delete(k); },
    async list(opts) {
      /* ⭐⭐⭐ (R28 · FINDING-01) ⭐⭐⭐ عقد Cloudflare Durable Objects ⭐⭐⭐ */
      const prefix = (opts && opts.prefix) || '';
      const out = new Map();
      for (const k of map.keys()) {
        if (k.indexOf(prefix) === 0) out.set(k, map.get(k));
      }
      return out;
    }
  };
  const instance = new PreviewStore({ storage: storage }, {});
  return {
    map: map,
    idFromName: (n) => ({ name: String(n) }),
    get: (id) => ({
      async fetch(url, opts) { return instance.fetch(new Request(url, opts)); },
    }),
  };
}

/* ⭐ (R28) ⭐ ملف المعاينة ⭐ — اقراء الكود من الصندوق ⭐
   ⭐ مافيش إيميل في الرد ⭐ لا بيستطع الكود إلا فقط سرية. */
async function codeFromMailbox(e, email) {
  const r = await call(e, '/api/preview/mailbox?email=' + encodeURIComponent(email), {
    headers: { 'X-Preview-Key': e.PREVIEW_CONSOLE_KEY },
  });
  if (!r.body || !r.body.code) {
    throw new Error('mailbox: ' + JSON.stringify(r.body));
  }
  return r.body.code;
}

function req(path, opts) {
  opts = opts || {};
  const url = new URL('https://octa-preview.example' + path);
  const headers = new Headers(opts.headers || {});
  if (opts.json !== undefined) headers.set('Content-Type', 'application/json');
  return new Request(url.toString(), {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined
  });
}

async function call(e, path, opts) {
  const request = req(path, opts);
  const url = new URL(request.url);
  const res = await handlePreviewApi({ request: request, env: e, url: url });
  let body = null;
  try { body = await res.clone().json(); } catch (err) { body = null; }
  return { status: res.status, body: body, res: res };
}

/* ⭐⭐⭐ (R28 · FINDING-08) ⭐⭐⭐ توكن الفتح ⭐ (عقد الإنتاج ⭐) ⭐
   📌 عقد الإنتاج ⭐: `signup/verify` ⭐ ⇒ `{unlock}` ⭐
      ⇒ `signup/newpin` ⭐ ⇒ `{new_pin}` + `Authorization: Bearer <unlock>` ⭐.
   ⛔ من غير توكن الفتح ⭐ ⇒ ⛔ 401 ⭐ (fail-closed ⭐). */
async function unlockOf(e, email, code) {
  const v = await call(e, '/api/auth/signup/verify', {
    method: 'POST',
    json: { email: email, code: code || await codeFromMailbox(e, email) }
  });
  return (v.body && v.body.unlock) ? v.body.unlock : '';
}
async function signupWithPin(e, email, pin, device) {
  const unlock = await unlockOf(e, email);
  return await call(e, '/api/auth/signup/newpin', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + unlock },
    json: { new_pin: pin, device: device }
  });
}

function cookieOf(res) {
  const sc = res.headers.get('Set-Cookie') || '';
  return sc.split(';')[0];
}

/* ── ① fail-closed: من غير تخزين ولا سر ⇒ 503 صريح ⭐ ── */
test('① من غير PREVIEW_KV ⇒ 503 صريح (مافيش نجاح وهمي)', async () => {
  const e = env({ PREVIEW_KV: null });
  const r = await call(e, '/api/auth/me');
  assert.strictEqual(r.status, 503);
  assert.strictEqual(r.body.error, 'preview_backend_misconfigured');
});

test('①ب من غير سر الجلسات ⇒ 503 صريح', async () => {
  const e = env({ PREVIEW_SESSION_SECRET: '' });
  const r = await call(e, '/api/auth/me');
  assert.strictEqual(r.status, 503);
});

test('①ج المعاينة مش شغّالة ⇒ المسار بيرجع للفرع القديم (null)', async () => {
  const e = env({ OCTA_PREVIEW_SELF_API: 'off' });
  const r = await handlePreviewApi({
    request: req('/api/auth/me'), env: e, url: new URL('https://x/api/auth/me')
  });
  assert.strictEqual(r, null);
});

/* ── ② التسجيل الكامل ⭐ ── */
test('② تسجيل كامل ⇒ حساب ⭐ جلسة ⭐ كوكي ⭐', async () => {
  const e = env();
  const email = 'r26.test@example.com';

  const start = await call(e, '/api/auth/signup/start',
    { method: 'POST', json: { name: 'اختبار', email: email } });
  assert.strictEqual(start.status, 200);
  assert.ok(!start.body.preview_code, '⛔⛔⛔ الكود ميبيشرش في الرد ⭐');
  const code0 = await codeFromMailbox(e, email);
  assert.strictEqual(start.body.sent, true);

  /* ⛔ رد موحّد Whether الإيميل مسجّل أو لأ ⭐ */
  const start2 = await call(e, '/api/auth/signup/start',
    { method: 'POST', json: { name: 'اختبار', email: email } });
  assert.strictEqual(start2.body.sent, true);
  /* ⛔ آخر كود هو الساري ⭐ — والكود القديم لازم يبطل ⭐ */
  const stale = await call(e, '/api/auth/signup/verify',
    { method: 'POST', json: { email: email, code: code0 } });
  assert.strictEqual(stale.status, 400, 'الكود القديم لازم يبطل ⭐');
  const live = await codeFromMailbox(e, email);

  const verify = await call(e, '/api/auth/signup/verify',
    { method: 'POST', json: { email: email, code: live } });
  assert.strictEqual(verify.status, 200);
  assert.strictEqual(verify.body.needs_pin, true);

  const bad = await call(e, '/api/auth/signup/verify',
    { method: 'POST', json: { email: email, code: '000000' } });
  assert.strictEqual(bad.status, 400, 'كود غلط لازم يترفض');

  const mk = await signupWithPin(e, email, '4321', 'device-aaaa-1234');
  assert.strictEqual(mk.status, 200);
  assert.ok(mk.body.token, 'لازم يطلع توكن');
  assert.ok(cookieOf(mk.res).startsWith('octa_token='), 'لازم يطلع كوكي الجلسة');

  /* ⛔ الباسورد مش بيتبعتش خام في التخزين ⭐
     ⭐ (R28) ⭐ التخزين بقي المخزن القوي ⭐ (لا ال​KV ⭐) ⭐ */
  const raw = JSON.stringify([...e.PREVIEW_STORE.map.entries()])
    + JSON.stringify([...e.PREVIEW_KV.store.entries()]);
  assert.ok(raw.indexOf('pin_hash') >= 0, 'الهاش لازم يكون موجود');
  assert.ok(raw.indexOf('4321') < 0, 'الباسورد الخام لازم مايتخزنش ⭐');
});

test('②ب باسورد مش ٤ أرقام ⇒ 400', async () => {
  const e = env();
  const email = 'r26.bad@example.com';
  const start = await call(e, '/api/auth/signup/start',
    { method: 'POST', json: { name: 'x', email: email } });
  const unlock = await unlockOf(e, email);
  const r = await call(e, '/api/auth/signup/newpin', {
    method: 'POST', headers: { Authorization: 'Bearer ' + unlock },
    json: { new_pin: '12' }
  });
  assert.strictEqual(r.status, 400);
});

/* ── ③ الدخول + الجلسات ⭐ ── */
test('③ دخول بالباسورد + جهاز مسجّل ⇒ جلسة ⭐', async () => {
  const e = env();
  const email = 'r26.login@example.com';
  const device = 'device-bbbb-9876';
  const start = await call(e, '/api/auth/signup/start',
    { method: 'POST', json: { name: 'x', email: email } });
  await signupWithPin(e, email, '1111', device);

  const okLogin = await call(e, '/api/auth/pin/login',
    { method: 'POST', json: { pin: '1111', device: device } });
  assert.strictEqual(okLogin.status, 200);
  assert.ok(okLogin.body.token);

  const wrong = await call(e, '/api/auth/pin/login',
    { method: 'POST', json: { pin: '9999', device: device } });
  assert.strictEqual(wrong.status, 401);

  /* ⛔ جهاز جديد ⇒ لازم كود (زي الإنتاج) ⭐
     ⭐⭐⭐ (R31) ⭐⭐⭐ السلوك اتغيّر ⭐⭐⭐ — قبل ⭐ ⭐: ⛔ الرد ⭐ ⭐ كان
     ⭐ ⭐ `bad_pin_or_device` ⭐ ⭐ والعدّاد ⭐ ⭐ كان بيتخصم ⭐ ⭐ ⇒ ⛔ ⭐ ⭐
     ⭐ ⭐ الباسورد **الصحيح** ⭐ ⭐ كان بيتحسب **محاولة فاشلة** ⭐ ⭐ ⇒ ⛔ ⭐ ⭐
     ⭐ ⭐ ⭐ ⭐ قفل ذاتي ⭐ ⭐ ⭐ ⭐ (٥ محاولات ⭐ ⭐ ⇒ ⭐ ١٥ دقيقة ⭐ ⭐) ⭐ ⭐ ⭐ ⭐.
     ✅ دلوقتي ⭐ ⭐ ⭐: ⭐ ⭐ الباسورد صح ⭐ ⭐ + جهاز مش مسجّل ⭐ ⭐ ⇒ ⭐ ⭐
     ⭐ ⭐ `new_device` ⭐ ⭐ + `need_code` ⭐ ⭐ (زي الإنتاج ⭐ ⭐) ⭐ ⭐ ⭐ ⭐
     ⭐ ⭐ ⇒ ⭐ ⭐ وصفر خصم ⭐ ⭐ في العدّاد ⭐ ⭐. */
  const newDev = await call(e, '/api/auth/pin/login',
    { method: 'POST', json: { pin: '1111', device: 'device-cccc-0000' } });
  assert.strictEqual(newDev.status, 401);
  assert.strictEqual(newDev.body.why, 'new_device');
  assert.strictEqual(newDev.body.need_code, true);

  /* ⛔⛔⛔ حسابين بنفس الباسورد ⭐ ⇒ لازم الجهاز يميّز ⭐ */
  const email2 = 'r26.login2@example.com';
  const device2 = 'device-cccc-0000';
  const s2 = await call(e, '/api/auth/signup/start',
    { method: 'POST', json: { name: 'x', email: email2 } });
  await signupWithPin(e, email2, '1111', device2);
  const right = await call(e, '/api/auth/pin/login',
    { method: 'POST', json: { pin: '1111', device: device2 } });
  assert.strictEqual(right.status, 200, 'لازم يدخل الحساب اللي جهازه مطابق ⭐');
  assert.strictEqual(right.body.user.email, email2);

  /* ⛔ من غير جهاز ⇒ رفض ⭐ */
  const noDev = await call(e, '/api/auth/pin/login',
    { method: 'POST', json: { pin: '1111' } });
  assert.strictEqual(noDev.status, 400);
  assert.strictEqual(noDev.body.why, 'device_required');
});

test('③ب من أنا بالجلسة ⭐ — ومن غير جلسة ⇒ 401 ⭐', async () => {
  const e = env();
  const anon = await call(e, '/api/auth/me');
  assert.strictEqual(anon.status, 401);

  const email = 'r26.me@example.com';
  const device = 'device-dddd-1111';
  const start = await call(e, '/api/auth/signup/start',
    { method: 'POST', json: { name: 'س', email: email } });
  const mk = await signupWithPin(e, email, '2222', device);
  const cookie = cookieOf(mk.res);
  const me = await call(e, '/api/auth/me', { headers: { Cookie: cookie } });
  assert.strictEqual(me.status, 200);
  assert.strictEqual(me.body.user.email, email);
});

test('③ج ⭐ إبطال فوري ⭐ — بعد الخروج الجلسة القديمة ماتت', async () => {
  const e = env();
  const email = 'r26.logout@example.com';
  const device = 'device-eeee-2222';
  const start = await call(e, '/api/auth/signup/start',
    { method: 'POST', json: { name: 'س', email: email } });
  const mk = await signupWithPin(e, email, '3333', device);
  const cookie = cookieOf(mk.res);

  const out = await call(e, '/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
  assert.strictEqual(out.status, 200);
  assert.strictEqual(out.body.revoked, true);
  assert.ok((out.res.headers.get('Set-Cookie') || '').indexOf('Max-Age=0') >= 0,
    'الكوكي لازم يتمسح');

  const after = await call(e, '/api/auth/me', { headers: { Cookie: cookie } });
  assert.strictEqual(after.status, 401, 'الجلسة القديمة لازم تموت فوراً ⭐');
});

test('③د ⭐ تجديد الجلسة ⭐ — القديم يموت والجديد شغّال', async () => {
  const e = env();
  const email = 'r26.refresh@example.com';
  const device = 'device-ffff-3333';
  const start = await call(e, '/api/auth/signup/start',
    { method: 'POST', json: { name: 'س', email: email } });
  const mk = await signupWithPin(e, email, '4444', device);
  const cookie = cookieOf(mk.res);
  const ref = await call(e, '/api/auth/refresh', { method: 'POST', headers: { Cookie: cookie } });
  assert.strictEqual(ref.status, 200);
  const newCookie = cookieOf(ref.res);
  const old = await call(e, '/api/auth/me', { headers: { Cookie: cookie } });
  assert.strictEqual(old.status, 401, 'الجلسة القديمة لازم تموت بعد التجديد ⭐');
  const fresh = await call(e, '/api/auth/me', { headers: { Cookie: newCookie } });
  assert.strictEqual(fresh.status, 200);
});

test('③هـ ⭐ CSRF ⭐ — طلب من أصل خارجي يترفض', async () => {
  const e = env();
  const r = await call(e, '/api/auth/logout', {
    method: 'POST', headers: { Origin: 'https://evil.example' }
  });
  assert.strictEqual(r.status, 403);
  assert.strictEqual(r.body.error, 'cross_site_blocked');
});

test('③و ⭐ كوكي مزوّر ⭐ ⇒ 401', async () => {
  const e = env();
  const r = await call(e, '/api/auth/me', {
    headers: { Cookie: 'octa_token=eyJ1aWQiOiJ4In0.forged' }
  });
  assert.strictEqual(r.status, 401);
});

/* ── ④ الأسعار ⭐ ── */
test('④ ⭐ الأسعار من لقطة المعاينة ⭐ (من غير اتصال بالإنتاج)', async () => {
  const e = env();
  const missing = await call(e, '/api/quotes?market=egypt');
  assert.strictEqual(missing.status, 503);
  assert.strictEqual(missing.body.error, 'لقطة الأسعار مش موجودة');

  await e.PREVIEW_KV.put('snap:quotes', JSON.stringify({
    updated: Math.floor(Date.now() / 1000),
    markets: { egypt: { COMI: { close: 10.5, change: 1.2, volume: 100 } } },
    egx: { time: '11:00', weekday: 'Thursday', day: 3, minute: 660 }
  }));

  const q = await call(e, '/api/quotes?market=egypt');
  assert.strictEqual(q.status, 200);
  assert.strictEqual(q.body.counts.egypt, 1);
  assert.strictEqual(q.body.markets.egypt.COMI.close, 10.5);
  assert.ok(q.body.preview_note, 'لازم يبقى فيه بيان إن ده لقطة معاينة');
});

/* ── ④ب الترتيب ⭐ */
test('④ب ⭐ الترتيب ⭐ — 401 للزائر ⭐ + نتائج للمسجّل ⭐', async () => {
  const e = env();
  const anon = await call(e, '/api/rank');
  assert.strictEqual(anon.status, 401);
  assert.strictEqual(anon.body._protected, true);

  await e.PREVIEW_KV.put('snap:quotes', JSON.stringify({
    updated: Math.floor(Date.now() / 1000),
    markets: { egypt: { COMI: { close: 10.5, change: 1.2, volume: 100, 'Recommend.All': 0.1 } } }
  }));

  const email = 'r26.rank@example.com';
  const device = 'device-gggg-4444';
  const start = await call(e, '/api/auth/signup/start',
    { method: 'POST', json: { name: 'س', email: email } });
  const mk = await signupWithPin(e, email, '6666', device);
  const r = await call(e, '/api/rank?limit=10', { headers: { Cookie: cookieOf(mk.res) } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.count, 1);
  assert.strictEqual(r.body.results[0].code, 'COMI');
  assert.strictEqual(r.body.results[0].price, 10.5);
});

/* ── ⑤ المحفظة + التنبيهات ⭐ ── */
test('⑤ ⭐ المحفظة معزولة بين الحسابات ⭐', async () => {
  const e = env();
  const mkAcct = async (email, pin, device) => {
    const start = await call(e, '/api/auth/signup/start',
      { method: 'POST', json: { name: 'س', email: email } });
    const mk = await signupWithPin(e, email, pin, device);
    return cookieOf(mk.res);
  };
  const c1 = await mkAcct('a1@example.com', '1111', 'dev-aaaa-1111');
  const c2 = await mkAcct('a2@example.com', '2222', 'dev-bbbb-2222');

  const w = await call(e, '/api/portfolio', {
    method: 'POST', headers: { Cookie: c1 },
    json: { cash: 1000, positions: { COMI: { shares: 5 } } }
  });
  assert.strictEqual(w.status, 200);
  assert.strictEqual(w.body.portfolio.cash, 1000);

  const r1 = await call(e, '/api/portfolio', { headers: { Cookie: c1 } });
  assert.strictEqual(r1.body.portfolio.positions.COMI.shares, 5);

  const r2 = await call(e, '/api/portfolio', { headers: { Cookie: c2 } });
  assert.strictEqual(r2.body.portfolio.positions.COMI, undefined,
    'محفظة الحساب التاني لازم تكون فاضية ⭐');
});

test('⑤ب ⭐ التنبيهات: منع التكرار ⭐ + عزل بين الحسابات ⭐', async () => {
  const e = env();
  const start = await call(e, '/api/auth/signup/start',
    { method: 'POST', json: { name: 'س', email: 'al@example.com' } });
  const mk = await signupWithPin(e, 'al@example.com', '5555', 'dev-cccc-3333');
  const cookie = cookieOf(mk.res);

  const a1 = await call(e, '/api/alerts', {
    method: 'POST', headers: { Cookie: cookie },
    json: { alert: { id: 'x1', symbol: 'COMI', kind: 'price' } }
  });
  assert.strictEqual(a1.body.created, true);
  const a2 = await call(e, '/api/alerts', {
    method: 'POST', headers: { Cookie: cookie },
    json: { alert: { id: 'x1', symbol: 'COMI', kind: 'price' } }
  });
  assert.strictEqual(a2.body.created, false);
  assert.strictEqual(a2.body.dedup, true);
  assert.strictEqual(a2.body.alerts.length, 1, 'التكرار لازم مايتكررش ⭐');
});

/* ── ⑥ المسارات غير المغطّاة ⇒ 501 صريح ⭐ ── */
test('⑥ مسار مش مغطّى ⇒ 501 صريح (مافيش 503 غامض)', async () => {
  const e = env();
  const r = await call(e, '/api/some/unknown/route');
  assert.strictEqual(r.status, 501);
  assert.strictEqual(r.body.error, 'preview_route_not_implemented');
});
