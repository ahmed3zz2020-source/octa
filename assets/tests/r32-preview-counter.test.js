/* ══════════════════════════════════════════════════════════════════════
   🛡️🧪 R32 · عدّاد المحاولات في المعاينة — ذرّياً + تصفيره صح
   ──────────────────────────────────────────────────────────────────────
   📌 البند ⭐:
      ① ⭐⭐⭐ التحديث **المتزامن** ⭐ ⭐ ⭐ ⇒ ⛔ مافيش lost update ⭐ ⭐ ⭐
         (طلبان مع بعض ⭐ ⇒ ⭐ العدّاد يزيد مرتين ⭐ ⭐ ⭐ مش مرة ⭐ ⭐).
      ② ⭐⭐⭐ **توقيت التصفير** ⭐ ⭐ ⭐ ⇒ ⭐ بعد دخول صح ⭐ ⭐ ⭐
         ⭐ ⭐ ⭐ عدّاد الـIP ⭐ ⭐ ⭐ كمان يتصفّر ⭐ ⭐ ⭐ (زي الإنتاج ⭐ ⭐ ⭐)
         ⭐ ⭐ ⭐ ⇒ ⭐ ⭐ ⭐ أول محاولة غلط بعدها ⭐ ⭐ ⭐ ⭐ ⭐ ⭐ ما بتقفلش ⭐ ⭐ ⭐.
      ③ ⭐⭐⭐ الباسورد صح ⭐ ⭐ ⭐ + جهاز غريب ⭐ ⭐ ⭐ ⇒ ⭐ صفر خصم ⭐ ⭐ ⭐ (R31 ⭐).

   📌 الـDO الوهمي ⭐ بيسلّم الطلبات **واحد واحد** ⭐ (زي الـDO الحقيقي ⭐)
      ⇒ ⭐ ده اللي بيخلّي الاختبار **حقيقي** ⭐ (لو الـDO كان بيزامن ⭐
      ⭐ ⭐ ⭐ فالزيادة الضايعة ⭐ ⭐ ⭐ كانت مش هتبان ⭐ ⭐ ⭐).

   📌 التشغيل ⭐: node --test assets/tests/r32-preview-counter.test.js ⭐
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { handlePreviewApi } = require('../../preview-api.js');
const { PreviewStore } = require('../../preview-store.js');

/* ── KV وهمي ⭐ ── */
function fakeKV() {
  const store = new Map();
  return {
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

/* ── DO وهمي **متسلسل** ⭐ (زي الـDO الحقيقي ⭐) ── */
function fakeDOSerial() {
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
  /* ⭐⭐⭐ الطلبات بتتنفّذ **واحد واحد** ⭐ ⭐⭐ (زي الـDO ⭐) ⭐ */
  let chain = Promise.resolve();
  return {
    map: map,
    idFromName: (n) => ({ name: String(n) }),
    get: (id) => ({
      fetch(url, opts) {
        const run = () => instance.fetch(new Request(url, opts));
        const next = chain.then(run, run);
        chain = next.then(() => undefined, () => undefined);
        return next;
      },
    }),
  };
}

function env(overrides) {
  return Object.assign({
    OCTA_PREVIEW_SELF_API: 'on',
    PREVIEW_KV: fakeKV(),
    PREVIEW_STORE: fakeDOSerial(),
    PREVIEW_SESSION_SECRET: 'test-secret-not-real',
    PREVIEW_CONSOLE_KEY: 'test-preview-console-key'
  }, overrides || {});
}

function req(p, opts) {
  opts = opts || {};
  const headers = new Headers(opts.headers || {});
  if (opts.json !== undefined) headers.set('Content-Type', 'application/json');
  return new Request('https://octa-preview.example' + p, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.json === undefined ? undefined : JSON.stringify(opts.json),
  });
}

async function call(e, p, opts) {
  const r = await handlePreviewApi({
    request: req(p, opts), env: e,
    url: new URL('https://octa-preview.example' + p),
  });
  const body = r ? await r.clone().json().catch(() => null) : null;
  return { status: r ? r.status : 0, body: body };
}

const IP = '203.0.113.9';
const IPH = null; /* اتحسب جوّه الاختبار */

async function ipHash() {
  const crypto = require('node:crypto');
  return crypto.createHash('sha256').update(IP).digest('hex');
}

async function makeAccount(e, email, pin, device) {
  const created = await call(e, '/api/auth/signup/start', {
    method: 'POST', json: { email: email, name: 'R32' },
  });
  assert.strictEqual(created.status, 200);
  const uid = 'u_' + require('node:crypto').createHash('sha256')
    .update(email.trim().toLowerCase()).digest('hex');
  const acct = await e.PREVIEW_STORE.get(e.PREVIEW_STORE.idFromName('x'));
  return { uid: uid, acct: acct };
}

/* ══════════════════════════════════════════════════════════════════════
   ① التحديث المتزامن
   ══════════════════════════════════════════════════════════════════════ */
test('R32 · ①أ عملية العدّاد **ذرّية** في الـDO (٨ زيادات متزامنة ⇒ ٨)', async () => {
  const e = env();
  const key = 'lock:ip:atomic-probe';
  const N = 8;
  /* ⭐ ٨ عمليات **متزامنة** ⭐ على نفس السجل ⭐ */
  const out = await Promise.all(Array.from({ length: N }, () =>
    e.PREVIEW_STORE.get(e.PREVIEW_STORE.idFromName('x'))
      .fetch('https://store.internal/cmd', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'lock_bump', key: key, max: 99, lockTtl: 60, ttl: 600 }),
      }).then((r) => r.json())));
  for (const o of out) {
    assert.strictEqual(o.ok, true, 'عملية زيادة العدّاد لازم تنجح');
  }
  const rec = e.PREVIEW_STORE.map.get(key);
  assert.ok(rec, 'لازم يكون فيه سجل العدّاد');
  assert.strictEqual(Number(rec.count), N,
    'العدّاد لازم يعدّ ' + N + ' بالظبط — أي رقم أقل = lost update (سباق)');
});

test('R32 · ①ب النمط القديم (قراءة + كتابة) **بضيّع** الزيادة — توثيق العيب', async () => {
  const e = env();
  const key = 'lock:ip:old-pattern';
  const N = 8;
  const store = e.PREVIEW_STORE;
  const one = async () => {
    const g = await store.get(store.idFromName('x'))
      .fetch('https://store.internal/cmd', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'get', key: key }),
      }).then((r) => r.json());
    const cur = (g && g.value) || { count: 0, until: 0 };
    cur.count = Number(cur.count || 0) + 1;
    await store.get(store.idFromName('x'))
      .fetch('https://store.internal/cmd', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'put', key: key, value: cur }),
      });
  };
  await Promise.all(Array.from({ length: N }, one));
  const rec = store.map.get(key);
  assert.strictEqual(Number(rec.count), 1,
    'النمط القديم (قراءة + كتابة) لازم يضيّع الزيادة ⇒ 1 بدل ' + N + ' (ده هو العيب)');
});

test('R32 · ①ج مسار المحاولة الفاشلة بيستعمل العملية الذرّية (مش قراءة + كتابة)', async () => {
  const e = env();
  const ops = [];
  const inner = e.PREVIEW_STORE.get(e.PREVIEW_STORE.idFromName('x'));
  const origFetch = inner.fetch;
  e.PREVIEW_STORE.get = (id) => ({
    fetch: (u, o) => {
      try { ops.push(JSON.parse(o.body).op); } catch (e) { }
      return origFetch(u, o);
    },
  });
  const r = await call(e, '/api/auth/pin/login', {
    method: 'POST', headers: { 'CF-Connecting-IP': IP },
    json: { pin: '0000', device: 'dev-aaaaaaaaaaaaaaaaaaaa' },
  });
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.body.why, 'bad_pin_or_device');
  assert.ok(ops.includes('lock_bump'),
    'مسار المحاولة الفاشلة لازم يستعمل lock_bump (عملية واحدة ذرّية) — ops: ' + ops.join(','));
});

/* ══════════════════════════════════════════════════════════════════════
   ② توقيت التصفير
   ══════════════════════════════════════════════════════════════════════ */
test('R32 · ② بعد دخول صح ⇒ عدّاد الـIP يتصفّر (زي الإنتاج) + المحاولة التالية ما بتقفلش', async () => {
  const e = env();
  const IPHASH = await ipHash();
  const email = 'r32.reset@example.test';
  const pin = '2468';
  const device = 'dev-bbbbbbbbbbbbbbbbbbbb';

  /* ⭐ حساب اصطناعي ⭐ (تسجيل + كود + باسورد) ⭐ عبر الـAPI ⭐ */
  const start = await call(e, '/api/auth/signup/start', {
    method: 'POST', json: { email: email, name: 'R32' },
  });
  assert.strictEqual(start.status, 200);
  /* ⭐ الكود بيتقرا من صندوق المعاينة ⭐ (المفتاح موجود ⭐ في البيئة ⭐) ⭐ */
  const uid = 'u_' + require('node:crypto').createHash('sha256')
    .update(email.trim().toLowerCase()).digest('hex');
  const mail = e.PREVIEW_STORE.map.get('mail:' + uid);
  assert.ok(mail && mail.code, 'لازم يكون فيه كود في صندوق المعاينة');
  const ver = await call(e, '/api/auth/signup/verify', {
    method: 'POST', json: { email: email, code: String(mail.code) },
  });
  assert.strictEqual(ver.status, 200);
  const npin = await call(e, '/api/auth/signup/newpin', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + ver.body.unlock },
    json: { new_pin: pin, device: device },
  });
  assert.strictEqual(npin.status, 200);

  /* ⭐ ٣ محاولات فاشلة ⇒ عدّاد الـIP = ٣ ⭐ */
  for (let i = 0; i < 3; i++) {
    const bad = await call(e, '/api/auth/pin/login', {
      method: 'POST', headers: { 'CF-Connecting-IP': IP },
      json: { pin: '0000', device: device },
    });
    assert.strictEqual(bad.status, 401);
  }
  let rec = e.PREVIEW_STORE.map.get('lock:ip:' + IPHASH);
  assert.ok(rec && Number(rec.count) === 3, 'عدّاد الـIP لازم يكون ٣ قبل الدخول الصح');

  /* ⭐ دخول صح ⭐ ⇒ لازم يتصفّر عدّاد الـIP ⭐ */
  const ok = await call(e, '/api/auth/pin/login', {
    method: 'POST', headers: { 'CF-Connecting-IP': IP },
    json: { pin: pin, device: device },
  });
  assert.strictEqual(ok.status, 200, 'الدخول الصح لازم ينجح');
  rec = e.PREVIEW_STORE.map.get('lock:ip:' + IPHASH);
  assert.ok(!rec, 'عدّاد الـIP لازم يتمسح بعد الدخول الصح (التصفير)');

  /* ⭐ وبعدها محاولة غلط واحدة ⭐ ⇒ ما فيش قفل ⭐ */
  const after = await call(e, '/api/auth/pin/login', {
    method: 'POST', headers: { 'CF-Connecting-IP': IP },
    json: { pin: '0000', device: device },
  });
  assert.strictEqual(after.status, 401);
  assert.strictEqual(after.body.why, 'bad_pin_or_device',
    'المحاولة بعد الدخول الصح ما بتقفلش (التصفير صح)');
});

/* ══════════════════════════════════════════════════════════════════════
   ③ الباسورد صح + جهاز غريب ⇒ صفر خصم
   ══════════════════════════════════════════════════════════════════════ */
test('R32 · ③ الباسورد صح + جهاز غريب ⇒ صفر خصم من عدّاد الـIP', async () => {
  const e = env();
  const IPHASH = await ipHash();
  const email = 'r32.newdev@example.test';
  const pin = '1357';

  const start = await call(e, '/api/auth/signup/start', {
    method: 'POST', json: { email: email, name: 'R32' },
  });
  assert.strictEqual(start.status, 200);
  const uid = 'u_' + require('node:crypto').createHash('sha256')
    .update(email.trim().toLowerCase()).digest('hex');
  const mail = e.PREVIEW_STORE.map.get('mail:' + uid);
  assert.ok(mail && mail.code);
  const ver = await call(e, '/api/auth/signup/verify', {
    method: 'POST', json: { email: email, code: String(mail.code) },
  });
  assert.strictEqual(ver.status, 200);
  const npin = await call(e, '/api/auth/signup/newpin', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + ver.body.unlock },
    json: { new_pin: pin },
  });
  assert.strictEqual(npin.status, 200);

  const r = await call(e, '/api/auth/pin/login', {
    method: 'POST', headers: { 'CF-Connecting-IP': IP },
    json: { pin: pin, device: 'device-cccccccccccccccccccc' },
  });
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.body.why, 'new_device', 'المسار لازم يبقى توثيق مش خطأ');
  const rec = e.PREVIEW_STORE.map.get('lock:ip:' + IPHASH);
  assert.ok(!rec, 'مافيش خصم من عدّاد الـIP (الباسورد صح)');
});
