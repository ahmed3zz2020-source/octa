/**
 * 🛡️ الجولة ٢٣ (R23) — اختبار **متكامل** لمسار الإبطال بـDurable Object
 * ──────────────────────────────────────────────────────────────────────────
 * 📌 الفرق عن `r21-do-strong-revocation.test.js` (وحدة): ⭐
 *   الاختبار ده **متكامل** (integrated) ⭐ — بيمشي على **HTTP كامل** ⭐:
 *   POST /api/login ⇒ GET /api/session ⇒ POST /api/logout ⇒ GET /api/session
 *   ⇒ GET /api/prefs ⇒ GET / (بوابة الملفات الثابتة) ⭐
 *   على **نسختين مستقلتين** من الـworker (جداول إبطال منفصلة في الذاكرة) ⭐.
 *
 * 📌 جديد الجولة ٢٣ — **محاكاة اتساق الـKV المتأخر** ⭐:
 *   الـKV الحقيقي اتساقه **متأخر** (حتى ~٦٠ ثانية ⭐) ⇦ الأسلوب القديم
 *   (r21) كان بيستخدم KV **متسق فوراً** ⭐ ⇒ ما كانش بيوضحش **ليه**
 *   الـDO مهم ⭐.
 *   هنا بنعمل replica متأخر حقيقي ⭐ ⇒ ونثبت إن:
 *     ① النسخة B **ترفض فوراً** ⭐ (رغم إن الـKV عندها لسه متأخرة ⭐)
 *     ② ⭐⇒ القرار جاء من الـDO (المصدر القوي) ⭐ مش من الـKV ⭐
 *     ③ ومن غير الـDO ⇒ في **نافذة** بتقبل جلسة اتبطلت ⭐ (≤٦٠ ثانية ⭐)
 *
 * 📌 البرهان السالب (negative proof) ⭐:
 *   نفس الملف ده بيتشغّل على **نسخة الـworker قبل الـDO** (من git) ⭐:
 *     OCTA_MGMT_WORKER=<مسار worker قبل الـDO> node --test assets/tests/r23-do-integration.test.js
 *   ⛔ النسخة دي **مافيش فيها** صنف `RevokeDO` ⭐ ⇒ الاختبار **بيفشل** ⭐
 *   (وده هو البرهان إن الـDO هو مصدر الاتساق القوي ⭐).
 *
 * ⛔ مافيش شبكة ⛔ مافيش حساب ⛔ مافيش مورد ⛔ مافيش نشر ⭐
 * ⛔ ممنوع ذكر أسماء أدوات ذكاء اصطناعي في أي تعليق هنا ⭐
 */
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = process.env.OCTA_FE_ROOT || path.resolve(__dirname, '..', '..');

/* ⭐ مسار الـworker تحت الاختبار ⭐
   ⭐ الافتراضي = نسخة المستودع الحالية ⭐
   ⭐ وفيه مسار بديل (من متغيّر بيئة ⭐) عشان **البرهان السالب** ⭐ */
const WORKER_PATH = process.env.OCTA_MGMT_WORKER
  ? (path.isAbsolute(process.env.OCTA_MGMT_WORKER)
      ? process.env.OCTA_MGMT_WORKER
      : path.resolve(ROOT, process.env.OCTA_MGMT_WORKER))
  : path.join(ROOT, 'mgmt/worker.js');

const WORKER_SRC = fs.readFileSync(WORKER_PATH, 'utf8');

/* ⭐ نفس أسلوب تحميل المشروع (نفس الـsandbox ⭐ — مافيش import ⭐) */
function loadDefault(src) {
  const body = src
    /* ⭐ شيل التصدير المسمّى ⭐ (وإلا الـparser هيرفض الملف ⭐) */
    .replace(/^export\s*\{[^}]*\};?$/gm, '')
    /* ⭐ الـdefault export ⇒ return ⭐ */
    .replace(/^export\s+default/m, 'return');
  return new Function('Response', 'Request', 'URL', 'crypto', body)(
    Response, Request, URL, crypto);
}

/* ⭐ تحميل **صنف** الـDurable Object من نفس الملف ⭐
   ⭐ لو الصنف مش موجود ⇒ `null` ⭐ (نسخة ما قبل الـDO ⭐) ⭐ */
function loadRevokeDOClass(src) {
  const m = src.match(/^export\s*\{([^}]*)\};?$/m);
  if (!m) return null;
  const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
  if (!names.length) return null;
  const body = src
    .replace(/^export\s*\{[^}]*\};?$/gm, '')
    .replace(/^export\s+default/m, 'const __default =');
  const ret = 'return { ' + names.join(', ') + ' };';
  const mod = new Function('Response', 'Request', 'URL', 'crypto', body + '\n' + ret)(
    Response, Request, URL, crypto);
  return mod && mod[names[0]] ? mod[names[0]] : null;
}

const REVOKE_DO_CLASS = loadRevokeDOClass(WORKER_SRC);

/* ⭐⭐ state بتاع الـDO ⭐ — تخزين **مشترك** ⭐ (Map واحد ⭐ مقسّم على الـids ⭐)
   ⭐ ده بالظبط معنى الاتساق القوي ⭐: قراءة بعد كتابة ⭐ مافيش تأخير ⭐ */
function makeState(store, id) {
  const rec = () => {
    if (!store.has(id)) store.set(id, new Map());
    return store.get(id);
  };
  return {
    storage: {
      async get(k) { const r = rec(); return r.has(k) ? r.get(k) : undefined; },
      async put(k, v) { rec().set(k, v); },
      async delete(k) { rec().delete(k); },
    },
  };
}

/* ⭐⭐ مُحاكي Durable Object ⭐⭐
   ⭐ `stateless: true` ⭐ ⇦ **مافيش** صنف `RevokeDO` ⭐ (نسخة ما قبل الـDO ⭐)
     ⇦ كل `/check` بيرجّع `{revoked:false}` ⭐ (مافيش تخزين دائم ⭐)
     ⇦ بالذالك مافيش مصدر اتساق قوي ⭐ ⇒ الإبطال بين النسخ **مش** مضمون ⭐
   📌 `fail`: 'throw' | '500' | 'garbage' ⭐ (أعطال متعمّدة ⭐) */
function mockDo(RevokeDOClass, opts = {}) {
  const store = new Map();
  const instances = new Map();
  const calls = [];
  const stateless = !RevokeDOClass;
  const ns = {
    store,
    calls,
    stateless,
    idFromName: (name) => ({ name: String(name) }),
    get: (id) => {
      if (stateless) {
        /* ⭐ بلا صنف ⭐ ⇒ بلا تخزين دائم ⭐ */
        return {
          async fetch(url, init) {
            const method = (init && init.method) || 'GET';
            calls.push({ id: id.name, url: String(url), method });
            if (opts.fail === 'throw') throw new Error('DO unreachable');
            if (opts.fail === '500') return new Response('boom', { status: 500 });
            if (opts.fail === 'garbage') return new Response('not-json', { status: 200 });
            if (method === 'POST') {
              return new Response(JSON.stringify({ ok: true, revoked: true }),
                { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
        /* ⭐ (R28) ⭐ حالة كلمة المرور ⭐ (panel_state ⭐) ⭐ */
        if (String(url || '').indexOf('/pwd') >= 0
            && (opts && opts.method) === undefined) {
          return new Response(JSON.stringify({ ok: true, pwd: null }),
            { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
            return new Response(JSON.stringify({ revoked: false }),
              { status: 200, headers: { 'Content-Type': 'application/json' } });
          },
        };
      }
      let inst = instances.get(id.name);
      if (!inst) {
        inst = new RevokeDOClass(makeState(store, id.name), {});
        instances.set(id.name, inst);
      }
      return {
        async fetch(url, init) {
          const method = (init && init.method) || 'GET';
          calls.push({ id: id.name, url: String(url), method });
          if (opts.fail === 'throw') throw new Error('DO unreachable');
          if (opts.fail === '500') return new Response('boom', { status: 500 });
          if (opts.fail === 'garbage') return new Response('not-json', { status: 200 });
          return inst.fetch(new Request(url, init));
        },
      };
    },
  };
  return ns;
}

/* ⭐⭐ محرّك الـKV بـ**اتساق متأخر** ⭐⭐
   ⭐ `backend.log` = سجلّ **عالمي** ⭐ (كل الكتابات ⭐ فوراً ⭐)
   ⭐ كل replica بيقرأ الحالة **بتاعته قبل lagMs** ⭐ ⇦ اتساق متأخر ⭐
   ⭐Production lag ≈ ٦٠ ثانية ⭐ (موثّق في mgmt/worker.js ⭐) ⭐ */
function makeKvBackend() {
  return { log: [] };
}

function makeKvReplica(backend, opts = {}) {
  const lagMs = Number(opts.lagMs || 0);
  const reads = [];
  function visibleAt(k, now) {
    const cutoff = now - lagMs;
    let val = null;
    for (const e of backend.log) {
      if (e.k === k && e.at <= cutoff) val = e.v;
    }
    return val;
  }
  return {
    lagMs,
    reads,
    async get(k) {
      const now = Date.now();
      const val = visibleAt(k, now);
      reads.push({ k, at: now, found: val !== null });
      return val;
    },
    async put(k, v) { backend.log.push({ k, v, at: Date.now() }); },
    async delete(k) { backend.log.push({ k, v: null, at: Date.now() }); },
    /* ⭐ هل النسخة دي شافت المفتاح دلوقتي؟ ⭐ */
    sees(k) { return visibleAt(k, Date.now()) !== null; },
  };
}

/* ⭐ الـenv — نفس شكل الـworker الحقيقي ⭐ */
function makeEnv(kv, doNs) {
  return {
    APP_PASSWORD: 'synthetic-password',
    SESSION_SECRET: 'synthetic-secret',
    OCTA_ADMIN_TOKEN: 'synthetic-token',
    /* 🛡️ R26 ⭐ — ⭐ الاختبارات دي بتقيس **نافذة اتساق الـKV** ⭐ (وهي risk
       ⭐ بيشيله الـDO ⭐) ⇒ ⭐ لازم تكون في بيئة **غير إنتاج** ⭐
       📌 في الإنتاج ⭐ ⛔ الـKV لوحده **مش** دليل قبول ⭐ ⇒ ⛔ رفض ⭐. */
    APP_ENV: 'preview',
    REVOKE_KV: kv || null,
    REVOKE_DO: doNs || null,
    ASSETS: {
      fetch: async () => new Response('<html><body>panel shell</body></html>',
        { status: 200, headers: { 'Content-Type': 'text/html' } }),
    },
  };
}

function req(p, opts = {}) {
  return new Request('https://mgmt.invalid' + p, opts);
}

/* ⭐ (R28) ⭐ عمط كوكي صنيع من المرشح ⭐ */
function mintCookie(expMs, secret, password, ver) {
  const nodeCrypto = require('node:crypto');
  const exp = String(expMs);
  const v = (ver === undefined || ver === null) ? 'nostate' : String(ver);
  const tag = nodeCrypto.createHash('sha256')
    .update(String(password) + '|' + v).digest('hex').slice(0, 16);
  const sig = nodeCrypto.createHmac('sha256', secret)
    .update(exp + '.' + tag).digest('hex');
  return 'octa_mgmt_sess=' + encodeURIComponent(exp + '.' + tag + '.' + sig);
}

async function login(worker, env) {
  const res = await worker.fetch(req('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password: env.APP_PASSWORD }),
  }), env);
  assert.equal(res.status, 200, '⛔ لازم الدخول ينجح ⭐');
  const sc = res.headers.get('Set-Cookie');
  assert.ok(sc, '⛔ لازم يتبعت كوكي ⭐');
  return sc.split(';')[0];
}

async function logout(worker, env, cookie) {
  const res = await worker.fetch(req('/api/logout', {
    method: 'POST', headers: { Cookie: cookie },
  }), env);
  return res.status;
}

async function sessionStatus(worker, env, cookie) {
  const res = await worker.fetch(req('/api/session', { headers: { Cookie: cookie } }), env);
  return res.status;
}

/* ⭐ مسار API **محمي حقيقي** ⭐ — لازم يرفض قبل أي كلام مع الباك ⭐ */
async function protectedApiStatus(worker, env, cookie) {
  const res = await worker.fetch(req('/api/prefs', { headers: { Cookie: cookie } }), env);
  return res.status;
}

/* ⭐ نفس حساب مفتاح الإبطال في الـworker ⭐ (rev: + هاش موقّع ⭐) */
async function revokeKeyFor(cookie) {
  const raw = decodeURIComponent((cookie.split('=')[1] || ''));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode('synthetic-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(raw));
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
  return 'rev:' + hex;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ⭐ بانر يوضّح أي نسخة عمال عليها ⭐ (مهم للبرهان السالب ⭐) */
console.log('[R23-DO-INT] worker under test: ' + WORKER_PATH +
  '  (RevokeDO class: ' + (REVOKE_DO_CLASS ? 'present' : 'ABSENT') + ')');

/* ── ⓪) القدرة: لازم يكون فيه صنف DO بتخزين دائم ⭐────────────────────── */
test('R23-DO-INT-00: the worker under test ships a durable RevokeDO class (strong-consistency source)', () => {
  assert.ok(REVOKE_DO_CLASS,
    '⛔ مافيش صنف RevokeDO في ' + WORKER_PATH +
    ' — الإبطال القوي (read-after-write) **مستحيل** بدونه ⭐');
});

/* ── ①) المتكامل: خروج حقيقي على A ⇒ رفض فوري على B ⭐─────────────────── */
test('R23-DO-INT-01: a real logout on instance A invalidates the session on instance B immediately, while the KV replica is still stale', async () => {
  /* ⭐⭐ نسختين **مستقلتين** من الـworker ⭐
     ⛔ نفس الـmodule ⇒ جدول الإبطال في الذاكرة مشترك ⭐ ⇒ مش برهان ⭐ */
  const workerA = loadDefault(WORKER_SRC);
  const workerB = loadDefault(WORKER_SRC);
  const doNs = mockDo(REVOKE_DO_CLASS);
  /* ⭐ الـKV متأخر ٦٠ ثانية ⭐ (زي الإنتاج ⭐) ⭐ */
  const backend = makeKvBackend();
  const kvA = makeKvReplica(backend, { lagMs: 60000 });
  const kvB = makeKvReplica(backend, { lagMs: 60000 });
  const envA = makeEnv(kvA, doNs);
  const envB = makeEnv(kvB, doNs);

  const cookie = await login(workerA, envA);

  /* ⭐ قبل الخروج: النسخة B بتقبل الجلسة ⭐ */
  assert.equal(await sessionStatus(workerB, envB, cookie), 200,
    '⛔ الجلسة لازم تكون صالحة قبل الخروج ⭐');

  /* ⭐ الخروج **الحقيقي** على النسخة A ⭐ */
  assert.equal(await logout(workerA, envA, cookie), 200,
    '⛔ لازم الخروج ينجح ⭐');

  /* ⭐⭐⭐ البرهان ⭐⭐⭐ — النسخة B لازم ترفض **فوراً** ⭐ */
  assert.equal(await sessionStatus(workerB, envB, cookie), 401,
    '⛔ النسخة B قبلت جلسة اتبطلت في النسخة A — الإبطال مش متسق بقوة ⭐');

  /* ⭐⭐ واثبات إن القرار جاء من الـDO مش من الـKV ⭐⭐
     ⭐ الـKV عند B **لسه متأخرة** ⭐ ⇒ لازم ما تكونش شافت المفتاح ⭐ */
  const key = await revokeKeyFor(cookie);
  assert.equal(kvB.sees(key), false,
    '⛔ الاختبار فاقد معناه: الـKV عند B كانت اتزامنت — يبقى مفيش برهان على-gap ⭐');
  assert.ok(kvB.reads.length > 0, '⛔ لازم النسخة B تكون قرأت من الـKV ⭐');

  /* ⭐ والـDO اتكلم فعلاً ⭐ */
  assert.ok(doNs.calls.some(c => c.method === 'GET' && c.url.endsWith('/check')),
    '⛔ لازم فحص الجلسة يروح للـDO ⭐');

  /* ⭐ ومسار API محمي حقيقي ⭐ (مش بس /api/session) ⭐ */
  assert.equal(await protectedApiStatus(workerB, envB, cookie), 401,
    '⛔ /api/prefs لازم يرفض ⭐');
  assert.equal(await protectedApiStatus(workerA, envA, cookie), 401,
    '⛔ /api/prefs على النسخة A لازم يرفض ⭐');
});

/* ── ②) fail-closed: خطأ الـDO ⇒ رفض (مش قبول أبدًا) ⭐─────────────────── */
test('R23-DO-INT-02: a DO failure fails closed — the session is REFUSED, never accepted', async () => {
  for (const mode of ['throw', '500', 'garbage']) {
    const workerA = loadDefault(WORKER_SRC);
    const workerB = loadDefault(WORKER_SRC);
    const doNs = mockDo(REVOKE_DO_CLASS, { fail: mode });
    const backend = makeKvBackend();
    /* ⭐ الـKV كمان متأخر ⭐ ⇒ مافيش شبكة أمان ⭐ ⇒ لازم يرفض من الـDO ⭐ */
    const envA = makeEnv(makeKvReplica(backend, { lagMs: 60000 }), doNs);
    const envB = makeEnv(makeKvReplica(backend, { lagMs: 60000 }), doNs);

    /* ⭐ (R28) ⭐ لما يقبل الدخول نفسه ⭐ ⛔ خطأ في ال​​​DO ⇒ ⛔ لا ينفعش الدخول ⭐ */
    const res0 = await workerA.fetch(req('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password: envA.APP_PASSWORD }),
    }), envA);
    assert.notEqual(res0.status, 200,
      '⛔⛔ ال​​​DO فاشل ⇒ ⛔ لا ينفعش جلسة ⭐');
    const cookie = mintCookie(Date.now() + 3600000, envA.SESSION_SECRET, envA.APP_PASSWORD, 'nostate');
    /* 🛡️🛡️ R25 (R24-I09) ⭐ — العقد الجديد ⭐:
       ⭐ «المصدر المتسق (الـDO) هو المرجع الأساسي» ⭐
       ⭐ ⇒ فشل الـDO ⛔ **مش نجاح** ⭐ (٥٠٣ ⭐) — حتى لو الـKV اشتغل ⭐
       ⭐ (الـKV **شاهد** ⭐ مش مرجع ⭐). */
    const outStatus = await logout(workerA, envA, cookie);
    assert.notEqual(outStatus, 200,
      '⛔⛔⛔ ال​​​DO فاشل ⇒ ⛔ الخرج ما ينفع يعلن نجاح ⭐');
    assert.ok(outStatus === 503 || outStatus === 401,
      '⛔⛔⛔ ال​​​DO فاشل ⇒ ⛔ الخرج لازم ييقبل نجاح (۵۳ مو ۴۱⭐)');
    const st = await sessionStatus(workerB, envB, cookie);
    assert.notEqual(st, 200,
      '⛔ خطأ في الـDO (' + mode + ') ما ينفعش يقبل الجلسة ⭐ — ده قبول صامت ⭐');
    assert.equal(st, 401,
      '⛔ خطأ في الـDO (' + mode + ') ⇒ لازم يرفض (fail-closed) ⭐');
  }
});

/* ── ③) الـDO **مش مطلوب** لصحة السلوك اليوم ⭐ (fallback الـKV) ⭐───────── */
test('R23-DO-INT-03: the DO is NOT required for correctness today — the KV fallback still revokes across instances', async () => {
  const workerA = loadDefault(WORKER_SRC);
  const workerB = loadDefault(WORKER_SRC);
  const backend = makeKvBackend();
  /* ⭐ KV **متسق** (نشر الـKV الحقيقي بيشتغل صح ⭐) ⭐ */
  const envA = makeEnv(makeKvReplica(backend, { lagMs: 0 }), null);
  const envB = makeEnv(makeKvReplica(backend, { lagMs: 0 }), null);

  const cookie = await login(workerA, envA);
  assert.equal(await sessionStatus(workerB, envB, cookie), 200);
  assert.equal(await logout(workerA, envA, cookie), 200);

  assert.equal(await sessionStatus(workerB, envB, cookie), 401,
    '⛔ من غير DO والـKV متسقة ⇒ لازم يرفض ⭐');
  assert.equal(await protectedApiStatus(workerB, envB, cookie), 401,
    '⛔ /api/prefs لازم يرفض ⭐');
});

/* ── ④) **نافذة** الـKV المتأخر ⭐ (ده سبب وجود الـDO ⭐) ───────────────── */
test('R23-DO-INT-04: without the DO the eventually-consistent KV leaves a window in which instance B still accepts the revoked session (the risk the DO removes)', async () => {
  const workerA = loadDefault(WORKER_SRC);
  const workerB = loadDefault(WORKER_SRC);
  const backend = makeKvBackend();
  const LAG = 120;                     /* ⭐ نافذة قصيرة ⭐ (الإنتاج ≈ ٦٠ ثانية ⭐) */
  const envA = makeEnv(makeKvReplica(backend, { lagMs: LAG }), null);
  const envB = makeEnv(makeKvReplica(backend, { lagMs: LAG }), null);

  const cookie = await login(workerA, envA);
  assert.equal(await logout(workerA, envA, cookie), 200);

  /* ⭐⭐ توثيق الخطر ⭐⭐ — من غير الـDO ⇒ في نافذة قبول ⭐ */
  assert.equal(await sessionStatus(workerB, envB, cookie), 200,
    '⛔ لازم نوثّق إن الـKV المتأخر بيسيب نافذة قبول ⭐' +
    ' (لو رجع 401 ⇒ يبقى الاختبار فاقد معناه ⭐)');

  /* ⭐ وبعد ما الـKV تتزامن ⇒ النافذة بتتقفل ⭐ */
  await sleep(LAG + 60);
  assert.equal(await sessionStatus(workerB, envB, cookie), 401,
    '⛔ بعد تزامن الـKV لازم يرفض ⭐');
});

/* ── ⑤) بوابة الملفات الثابتة ⭐ (الـshell نفسه مقفول ⭐) ───────────────── */
test('R23-DO-INT-05: the panel shell is gated — no session ⇒ 302 to /login.html, and a revoked session is refused too', async () => {
  const worker = loadDefault(WORKER_SRC);
  const env = makeEnv(makeKvReplica(makeKvBackend(), { lagMs: 0 }), mockDo(REVOKE_DO_CLASS));

  const anon = await worker.fetch(
    req('/', { headers: { Accept: 'text/html' } }), env);
  assert.equal(anon.status, 302, '⛔ لازم يتحوّل لصفحة الدخول ⭐');
  assert.match(anon.headers.get('Location') || '', /\/login\.html/,
    '⛔ لازم التحويل يكون لصفحة الدخول ⭐');

  const cookie = await login(worker, env);
  assert.equal(await logout(worker, env, cookie), 200);

  const after = await worker.fetch(
    req('/', { headers: { Accept: 'text/html', Cookie: cookie } }), env);
  assert.equal(after.status, 302,
    '⛔ جلسة ملغاة ⇒ لازم ترجع لصفحة الدخول ⭐ (مش 200 ⭐)');
});

/* ── ⑥) /api/health يعلن مصدر الإبطال ⭐─────────────────────────────────── */
test('R23-DO-INT-06: /api/health reports revoke_strong only when the DO binding is present', async () => {
  const worker = loadDefault(WORKER_SRC);
  const withDo = await worker.fetch(req('/api/health'),
    makeEnv(makeKvReplica(makeKvBackend(), { lagMs: 0 }), mockDo(REVOKE_DO_CLASS)));
  assert.equal(withDo.status, 200);
  const b1 = await withDo.json();
  assert.equal(b1.revoke_shared, true, '⛔ لازم يعلن إن الإبطال مشترك ⭐');
  assert.equal(b1.revoke_strong, !!REVOKE_DO_CLASS,
    '⛔ revoke_strong لازم يتبع وجود الـDO ⭐');

  const withoutDo = await worker.fetch(req('/api/health'),
    makeEnv(makeKvReplica(makeKvBackend(), { lagMs: 0 }), null));
  const b2 = await withoutDo.json();
  assert.equal(b2.revoke_shared, true);
  assert.equal(b2.revoke_strong, false,
    '⛔ من غير DO ⇒ revoke_strong=false ⭐');
});
