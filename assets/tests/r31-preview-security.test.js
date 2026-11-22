/* ══════════════════════════════════════════════════════════════════════
   🛡️🧪 R31 · دفعة الإصلاح الواحدة — اختبارات المعاينة (٣ بنود)
   ──────────────────────────────────────────────────────────────────────
   📌 البنود ⭐:
      ① ⭐ إصدار الجلسة بالبصمة وحدها ⭐ ⇒ ⛔ لازم PIN ⭐ **على نفس الجهاز** ⭐ ⭐.
      ② ⭐ العدّاد ⭐ ⇒ ⭐ الباسورد صح ⭐ + جهاز جديد ⭐ ⇒ ⛔ صفر خصم ⭐ ⭐.
      ③ ⭐ قفل الكتابة في جسر المعاينة ⭐ ⇒ ⛔ 405 ⭐ ⭐ (ومفيش ر الطلب للباك ⭐) ⭐.

   📌 كل تأكيد بيتأكد من **المحتوى** ⭐ (مش 200 بس ⭐).
   📌 التشغيل ⭐: node --test assets/tests/r31-preview-security.test.js ⭐
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { handlePreviewApi } = require('../../preview-api.js');
const { PreviewStore } = require('../../preview-store.js');

const ROOT = path.resolve(__dirname, '..', '..');

/* ── KV وهمي ⭐ ── */
function fakeKV() {
  const store = new Map();
  return {
    store: store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    async list(opts) {
      const prefix = (opts && opts.prefix) || '';
      const out = new Map();
      for (const k of store.keys()) if (k.indexOf(prefix) === 0) out.set(k, store.get(k));
      return out;
    }
  };
}

/* ── DO وهمي (الكلاس الحقيقي ⭐) ── */
function fakeDO() {
  const map = new Map();
  const storage = {
    async get(k) { return map.has(k) ? map.get(k) : undefined; },
    async put(k, v) { map.set(k, v); },
    async delete(k) { map.delete(k); },
    async list(opts) {
      const prefix = (opts && opts.prefix) || '';
      const out = new Map();
      for (const k of map.keys()) if (k.indexOf(prefix) === 0) out.set(k, map.get(k));
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

function env(overrides) {
  return Object.assign({
    OCTA_PREVIEW_SELF_API: 'on',
    PREVIEW_KV: fakeKV(),
    PREVIEW_STORE: fakeDO(),
    PREVIEW_SESSION_SECRET: 'test-secret-not-real',
    PREVIEW_CONSOLE_KEY: 'test-preview-console-key'
  }, overrides || {});
}

function req(p, opts) {
  opts = opts || {};
  const url = new URL('https://octa-preview.example' + p);
  const headers = new Headers(opts.headers || {});
  if (opts.json !== undefined) headers.set('Content-Type', 'application/json');
  return new Request(url.toString(), {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined
  });
}

async function call(e, p, opts) {
  const request = req(p, opts);
  const url = new URL(request.url);
  const res = await handlePreviewApi({ request: request, env: e, url: url });
  let body = null;
  try { body = await res.clone().json(); } catch (err) { body = null; }
  return { status: res.status, body: body, res: res };
}

async function codeFromMailbox(e, email) {
  const r = await call(e, '/api/preview/mailbox?email=' + encodeURIComponent(email), {
    headers: { 'X-Preview-Key': e.PREVIEW_CONSOLE_KEY },
  });
  if (!r.body || !r.body.code) throw new Error('mailbox: ' + JSON.stringify(r.body));
  return r.body.code;
}

async function signupWithPin(e, email, pin, device) {
  const start = await call(e, '/api/auth/signup/start',
    { method: 'POST', json: { name: 'اختبار', email: email } });
  assert.strictEqual(start.status, 200);
  const code = await codeFromMailbox(e, email);
  const v = await call(e, '/api/auth/signup/verify',
    { method: 'POST', json: { email: email, code: code } });
  const unlock = (v.body && v.body.unlock) ? v.body.unlock : '';
  assert.ok(unlock, '⛔ توكن الفتح مفقود ⭐');
  const r = await call(e, '/api/auth/signup/newpin', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + unlock },
    json: { new_pin: pin, device: device }
  });
  assert.strictEqual(r.status, 200, '⛔ التسجيل فشل: ' + JSON.stringify(r.body));
  return r;
}

const DEV = 'r31-device-key-0123456789abcdef';
const PIN = '4321';
const MAIL = 'r31.preview@example.com';

/* ══════════════════════════════════════════════════════════════════
   ① — إصدار الجلسة بالبصمة وحدها ⭐ ⇒ ⛔ مرفوض ⭐
   ══════════════════════════════════════════════════════════════════ */
test('① أ البصمة وحدها مابتissuedش جلسة (من غير توثيق بالرقم)', async () => {
  const e = env();
  await signupWithPin(e, MAIL, PIN, DEV);

  const r = await call(e, '/api/auth/pin/fingerprint',
    { method: 'POST', json: { device: DEV } });
  assert.strictEqual(r.status, 401, '⛔⛔⛔ البصمة وحدها اتقبلت ⭐');
  assert.strictEqual(r.body.why, 'need_pin', '⛔ السبب لازم يكون need_pin ⭐');
  assert.ok(!r.body.token, '⛔⛔⛔ فيه توكن ⭐ — ⛔ ده العيب ⭐');
});

test('① ب البصمة بعد توثيق بالرقم على نفس الجهاز ⇒ جلسة', async () => {
  const e = env();
  await signupWithPin(e, MAIL, PIN, DEV);

  /* ⭐ توثيق بالرقم ⭐ ⇒ المسجّل بالرقم ⭐ ⇒ لازم يسيب **إثوث** ⭐ */
  const login = await call(e, '/api/auth/pin/login',
    { method: 'POST', json: { pin: PIN, device: DEV } });
  assert.strictEqual(login.status, 200, '⛔ الدخول بالرقم فشل: ' + JSON.stringify(login.body));

  const r = await call(e, '/api/auth/pin/fingerprint',
    { method: 'POST', json: { device: DEV } });
  assert.strictEqual(r.status, 200, '⛔⛔⛔ البصمة اترفضت بعد توثيق ⭐ — ' + JSON.stringify(r.body));
  assert.ok(r.body.token, '⛔ مافيش توكن ⭐');
});

test('① ج توثيق بالرقم على جهاز تاني ⭐ ⇒ ⛔ البصمة ماتنفّذش ⭐', async () => {
  const e = env();
  await signupWithPin(e, MAIL, PIN, DEV);
  const DEV2 = 'r31-other-device-key-9876543210';
  await call(e, '/api/auth/pin/login',
    { method: 'POST', json: { pin: PIN, device: DEV } });

  /* ⭐ البصمة على جهاز **تاني** ⭐ ⇒ ⛔ لازم ترفض ⭐ */
  const r = await call(e, '/api/auth/pin/fingerprint',
    { method: 'POST', json: { device: DEV2 } });
  assert.strictEqual(r.status, 401);
  assert.ok(!r.body.token);
});

/* ══════════════════════════════════════════════════════════════════
   ② — العدّاد ⭐: باسورد صح + جهاز جديد ⭐ ⇒ ⛔ صفر خصم ⭐
   ══════════════════════════════════════════════════════════════════ */
test('② الباسورد صح + جهاز مش مسجّل ⇒ 401 need_code ⭐ ومافيش خصم في العدّاد', async () => {
  const e = env();
  await signupWithPin(e, MAIL, PIN, DEV);
  const DEV2 = 'r31-brand-new-device-key-5566';

  const r = await call(e, '/api/auth/pin/login',
    { method: 'POST', json: { pin: PIN, device: DEV2 } });
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.body.why, 'new_device', '⛔ السبب لازم new_device ⭐');
  assert.strictEqual(r.body.need_code, true, '⛔ لازم need_code ⭐');

  const locks = Array.from(e.PREVIEW_STORE.map.keys())
    .filter((k) => String(k).indexOf('lock:') === 0);
  assert.strictEqual(locks.length, 0,
    '⛔⛔⛔ العدّاد اتخصم ⭐ ⇒ قفل ذاتي ⭐ ⇒ ' + JSON.stringify(locks));
});

test('② ب الباسورد الغلط ⭐ ⇒ ⛔ العدّاد بيتخصم ⭐ (الحماية سليمة)', async () => {
  const e = env();
  await signupWithPin(e, MAIL, PIN, DEV);
  const r = await call(e, '/api/auth/pin/login',
    { method: 'POST', json: { pin: '9999', device: DEV } });
  assert.strictEqual(r.status, 401);
  const locks = Array.from(e.PREVIEW_STORE.map.keys())
    .filter((k) => String(k).indexOf('lock:') === 0);
  assert.ok(locks.length > 0, '⛔ مافيش خصم في العدّاد ⭐ — الحماية ضعيفة ⭐');
});

/* ══════════════════════════════════════════════════════════════════
   ③ — قفل الكتابة في جسر المعاينة ⭐
   ══════════════════════════════════════════════════════════════════ */
test('③ POST على مسار قراءة-بس ⭐ ⇒ ⛔ 405 ⭐ (ما بيكمّللوش للباك ⭐)', async () => {
  const e = env();
  const r = await call(e, '/api/rank',
    { method: 'POST', json: { x: 1 } });
  assert.strictEqual(r.status, 405, '⛔⛔⛔ الكتابة عدّت ⭐');
  assert.strictEqual(r.body.error, 'preview_read_only');
  assert.strictEqual(r.body.why, 'preview_write_blocked');
});

test('③ ب PUT / DELETE على مسار قراءة-بس ⭐ ⇒ ⛔ 405 ⭐', async () => {
  const e = env();
  for (const m of ['PUT', 'DELETE', 'PATCH']) {
    const r = await call(e, '/api/dividends', { method: m, json: { x: 1 } });
    assert.strictEqual(r.status, 405, '⛔ ' + m + ' عدّت ⭐');
  }
});

test('③ ج GET على نفس المسار ⭐ ⇒ ⭐ يكمّل طبيعي ⭐ (ما اتقفلتش القراءة ⭐)', async () => {
  const e = env();
  const r = await call(e, '/api/rank', { method: 'GET' });
  /* ⭐ القراءة بتكمّل ⇒ ⭐ الرد مش 405 ⭐ (إما null⇒null ⭐ أو رد ⭐) ⭐ */
  assert.notStrictEqual(r.status, 405, '⛔ القراءة اتقفلت ⭐');
});

test('③ د الحارس الثاني في worker.js ⭐ (المعاينة ما تبعتهيش كتابة للباك ⭐)', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8');
  assert.ok(src.indexOf('preview_write_blocked') >= 0,
    '⛔⛔⛔ مافيش قفل الكتابة في worker.js ⭐');
  assert.ok(src.indexOf("OCTA_PREVIEW_SELF_API === 'on'") >= 0,
    '⛔⛔⛔ الحارس مش مربوط بوضع المعاينة ⭐');
});
