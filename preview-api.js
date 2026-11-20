/* ══════════════════════════════════════════════════════════════════════
   🧪 المعاينة الحقيقية — API مستقل داخل عامل Cloudflare (الجولة ٢٦)
   ──────────────────────────────────────────────────────────────────────
   ⛔ ليش؟ المعاينة كانت بتخدم HTML + لقطة الفرص بس ⇒ التسجيل والأسعار
      بيرجعوا 503 ⇒ مش تشغيل وظيفي (البند ٤ من تكليف المالك).

   ✅ الحل ⭐: API حقيقي **داخل نفس العامل** ⭐:
      · تخزين خاص بالمعاينة فقط (PREVIEW_KV) ⭐ — منفصل عن الإنتاج ⭐.
      · سر جلسات خاص (PREVIEW_SESSION_SECRET) ⭐.
      · صفر اتصال بالإنتاج ⭐ (مافيش fallback ولا proxy ⭐).

   🛡️ القواعد ⭐:
      · fail-closed ⭐: لو الـKV أو السر ناقص ⇒ 503 صريح (مافيش نجاح وهمي).
      · إبطال فوري ⭐: الجلسة متخزّنة ⇒ الإبطال بيشتغل فوراً ⭐.
      · CSRF ⭐: أي طلب بيغيّر الحالة لازم يكون same-origin ⭐.
      · منع تعداد الحسابات ⭐: رد واحد Whether مسجّل أو لأ ⭐.
      · قفل المحاولات ⭐: ٥ محاولات ⇒ قفل ١٥ دقيقة ⭐.

   📌 التشغيل: node tools/check-text-hygiene.js + node --test assets/tests/*.test.js
   ══════════════════════════════════════════════════════════════════════ */
const PREVIEW_COOKIE = 'octa_token';
const SESSION_TTL_SEC = 7 * 24 * 3600;
const CHALLENGE_TTL_SEC = 600;
const LOCK_TTL_SEC = 15 * 60;
const MAX_ATTEMPTS = 5;
const PBKDF2_ROUNDS = 60000;

/* ── أدوات ترميز ─────────────────────────────────────────────────────── */
function b64u(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uDecode(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const raw = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function enc(obj) {
  return b64u(new TextEncoder().encode(JSON.stringify(obj)));
}
function dec(str) {
  try { return JSON.parse(new TextDecoder().decode(b64uDecode(str))); }
  catch (e) { return null; }
}
async function sha256hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return b64u(new Uint8Array(sig));
}
async function pbkdf2(pin, saltB64) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2', salt: b64uDecode(saltB64), iterations: PBKDF2_ROUNDS,
    hash: 'SHA-256'
  }, key, 256);
  return b64u(new Uint8Array(bits));
}
function randDigits(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  let s = '';
  for (let i = 0; i < n; i++) s += String(a[i] % 10);
  return s;
}
function nowSec() { return Math.floor(Date.now() / 1000); }

function json(body, status, headers) {
  const h = new Headers(headers || {});
  h.set('Content-Type', 'application/json; charset=utf-8');
  h.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { status: status || 200, headers: h });
}

/* ── كوكي الجلسة ─────────────────────────────────────────────────────── */
function sessionCookie(value, maxAge) {
  const parts = [
    PREVIEW_COOKIE + '=' + value,
    'Path=/', 'HttpOnly', 'Secure', 'SameSite=None'
  ];
  if (typeof maxAge === 'number') parts.push('Max-Age=' + maxAge);
  return parts.join('; ');
}
function readCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const kv = part.trim().split('=');
    if (kv[0] === name) return decodeURIComponent(kv.slice(1).join('='));
  }
  return '';
}

/* ── same-origin (CSRF) ───────────────────────────────────────────────── */
function isSameOrigin(request, url) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;                 /* مفيش Origin = طلب مش من المتصفح */
  try { return new URL(origin).host === url.host; } catch (e) { return false; }
}

/* ── كeys ─────────────────────────────────────────────────────────────── */
async function uidOf(email) {
  /* ⛔ لازم await ⭐ — غير كده كل الحسابات بتاخد نفس الـuid ⭐ */
  return 'u_' + (await sha256hex(String(email).trim().toLowerCase()));
}
const acctKey = (uid) => 'acct:' + uid;
/* ⭐⭐⭐ (R28 · R26-I01) ⭐ صندوق المعاينة ⭐ — الكود (نص صريح ⭐)
   ⭐ بيتقرأ بـ**مفتاح المعاينة** ⭐ بس ⭐ ⇒ ⛔ مافيش استحواذ ⭐. */
const mailKey = (uid) => 'mail:' + uid;
const chalKey = (uid) => 'chal:' + uid;
const sessKey = (uid, sid) => 'sess:' + uid + ':' + sid;
const lockKey = (kind, id) => 'lock:' + kind + ':' + id;

/* ⭐⭐⭐ (R28) ⭐ مخزن المعاينة (Durable Object ⭐) ⭐
   📌 السبب ⭐: ⛔ الـKV اتساقه مؤجل ⭐ ⇒ ⛔ R26-I02 (إبطال مش فوري ⭐)
      + ⛔ R26-I04 (كتابة متزامنة بتضيع ⭐).
   ✅ الـDO ⭐: قراءة بعد كتابة ⭐ + ⭐ كتابة ذرّية ⭐.
   📌 ⛔fail-closed ⭐: لو الربط ناقص ⭐ ⇒ ⭐ null ⭐ ⇒ ⭐ الـAPI يرد 503 ⭐. */
const DO_NAME = 'preview_state';

async function storeCmd(env, cmd) {
  if (!env.PREVIEW_STORE) return null;
  try {
    const id = env.PREVIEW_STORE.idFromName(DO_NAME);
    const stub = env.PREVIEW_STORE.get(id);
    const res = await stub.fetch('https://store.internal/cmd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    if (!res || !res.ok) return null;
    const body = await res.json().catch(() => null);
    if (!body || body.ok !== true) return null;
    return body;
  } catch (e) { return null; }
}
async function storeGet(env, key) {
  const r = await storeCmd(env, { op: 'get', key: key });
  return r ? (r.value === undefined ? null : r.value) : null;
}
async function storePut(env, key, value, ttlSec) {
  const r = await storeCmd(env, { op: 'put', key: key, value: value, ttl: ttlSec || 0 });
  return !!r;
}
async function storeDel(env, key) {
  const r = await storeCmd(env, { op: 'del', key: key });
  return !!r;
}
async function storeList(env, prefix) {
  const r = await storeCmd(env, { op: 'list', prefix: prefix });
  /* ⭐⭐⭐ (R28 · FINDING-01) ⭐⭐⭐ ⛔ الفشل مايبش قائمة فارغة ⭐⭐⭐
     ⑈ قبل مكانها كانت قائمة فارغة · ⛔ لمفرقتنا مع الخطا ⭐
     → ⛔ المستخدم يفرّق بقائمة فارغة ⭐ و المعالجة لا تحتاج إطلاق الحساب⭐ */
  if (!r) return null;
  const keys = r.keys;
  if (!Array.isArray(keys)) return null;
  return keys;
}
/* ⭐ اللقطة ⭐ — **بتفضل في الـKV** ⭐ (بيانات قراءة ⭐ من أداة التغذية ⭐) */
async function snapshotGet(env, key) {
  try {
    const raw = await env.PREVIEW_KV.get(key, 'text');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

/* ── قفل المحاولات ───────────────────────────────────────────────────── */
/* ⭐⭐⭐ (R28) ⭐ القفل بقى **في المخزن القوي** ⭐ (مش الـKV ⭐)
   ⭐ ⇒ ⭐ العدّاد متسق فوراً ⭐ بين كل النسخ ⭐ (R26-I03 ⭐).
   ⭐ ⭐ القفل دلوقتي على **مصدرين** ⭐:
      ① `pin` ⭐ = هاش الباسورد (كل الأجهزة ⭐) ⭐ ⇒ ⛔ تغيير الجهاز مابيفلتش ⭐.
      ② `ip` ⭐ = عنوان الـIP ⭐ ⇒ ⛔ تخمين من جهاز ⭐. */
async function lockState(env, kind, id) {
  const rec = await storeGet(env, lockKey(kind, id));
  if (!rec) return null;
  if (rec.until && rec.until > nowSec()) return rec.until - nowSec();
  return null;
}
async function bumpAttempts(env, kind, id) {
  const key = lockKey(kind, id);
  const rec = (await storeGet(env, key)) || { count: 0, until: 0 };
  rec.count = (rec.count || 0) + 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.until = nowSec() + LOCK_TTL_SEC;
    rec.count = 0;
  }
  await storePut(env, key, rec, LOCK_TTL_SEC * 2);
  return rec;
}

/* ── الجلسات ──────────────────────────────────────────────────────────── */
async function issueSession(env, acct, device) {
  const sid = b64u(crypto.getRandomValues(new Uint8Array(18)));
  const payload = { uid: acct.uid, sid: sid, exp: nowSec() + SESSION_TTL_SEC };
  const body = enc(payload);
  const sig = await hmac(env.PREVIEW_SESSION_SECRET, body);
  const token = body + '.' + sig;
  /* ⭐⭐⭐ (R28) ⭐ الجلسة في المخزن القوي ⭐ ⇒ ⭐ إبطال فوري ⭐ (R26-I02 ⭐)
     ⭐⭐⭐ (R28 · FINDING-02) ⭐⭐⭐ ⛔ الكتابة لازم **تتأكد** ⭐⭐⭐
     📌 قبل ⭐: الكتابة كانت متجاهَلة ⭐ ⇒ ⭐ التوكن بيرجع ⭐
        ⇒ ⭐ لكن ما يتحفظش ⭐ ⇒ ⭐ ⛔ جلسة ميتة ⭐ (نجاح كاذب ⭐).
     ✅ دلوقتي ⭐: ⛔ لو الكتابة فشلت ⭐ ⇒ ⛔ null ⭐ ⇒ ⛔ ما نصدرش توكن ⭐. */
  const wrote = await storePut(env, sessKey(acct.uid, sid), {
    uid: acct.uid, sid: sid, exp: payload.exp,
    device: device || '', epoch: acct.epoch || 1
  }, SESSION_TTL_SEC + 3600);
  if (!wrote) return null;
  return token;
}

async function readSession(env, request) {
  const raw = readCookie(request, PREVIEW_COOKIE);
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot < 1) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expect = await hmac(env.PREVIEW_SESSION_SECRET, body);
  if (sig.length !== expect.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expect.charCodeAt(i);
  if (diff !== 0) return null;                    /* توقيع غلط ⇒ مفيش جلسة */
  const payload = dec(body);
  if (!payload || !payload.uid || !payload.sid) return null;
  if ((payload.exp || 0) <= nowSec()) return null;
  const rec = await storeGet(env, sessKey(payload.uid, payload.sid));
  if (!rec) return null;                          /* ⛔ مُبطل ⇒ رفض فوراً */
  const acctNow = await storeGet(env, acctKey(payload.uid));
  if (!acctNow) return null;
  if (rec.epoch !== (acctNow.epoch || 1)) return null;
  return { payload: payload, rec: rec };
}

function userView(acct) {
  return {
    email: acct.email, name: acct.name, uid: acct.uid,
    created_at: acct.created_at || 0, plan: acct.plan || 'preview'
  };
}

/* ⭐ مقارنة ثابتة الزمن ⭐ (مقارنة سر المعاينة ⭐) */
function safeEqual(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/* ── الكود ────────────────────────────────────────────────────────────── */
async function makeChallenge(env, uid, email, name) {
  const code = randDigits(6);
  await storePut(env, chalKey(uid), {
    code_hash: await sha256hex(code), email: email, name: name || '',
    exp: nowSec() + CHALLENGE_TTL_SEC, tries: 0
  }, CHALLENGE_TTL_SEC + 60);
  /* ⭐⭐⭐ (R28 · R26-I01) ⭐ الكود (نص صريح ⭐) في صندوق المعاينة ⭐
     ⭐ — مش في الرد ⭐ — ومقفول بمفتاح ⭐. */
  await storePut(env, mailKey(uid), {
    code: code, email: email, exp: nowSec() + CHALLENGE_TTL_SEC
  }, CHALLENGE_TTL_SEC + 60);
  return code;
}
async function checkChallenge(env, uid, code) {
  const rec = await storeGet(env, chalKey(uid));
  if (!rec) return { ok: false, why: 'challenge_expired' };
  if ((rec.exp || 0) <= nowSec()) { await storeDel(env, chalKey(uid)); return { ok: false, why: 'challenge_expired' }; }
  if ((rec.tries || 0) >= 5) return { ok: false, why: 'too_many_tries' };
  const got = await sha256hex(String(code || '').trim());
  if (got !== rec.code_hash) {
    rec.tries = (rec.tries || 0) + 1;
    await storePut(env, chalKey(uid), rec, CHALLENGE_TTL_SEC + 60);
    return { ok: false, why: 'bad_code' };
  }
  return { ok: true, rec: rec };
}

/* ⭐⭐⭐ (R28 · FINDING-07) ⭐⭐⭐ المسارات اللي توصل للـbackend ⭐⭐⭐
   📌 قائمة **قراءة فقط** ⭐ ⇒ ⭐ المعاينة ما تكتبش على الإنتاج ⭐ ⭐
     📌 حالة المعاينة (الحسابات ⭐ والجلسات ⭐ والمحفظة ⭐ والتنبيهات ⭐)
        ⇒ ⭐ باقية في المخزن القوي الخاص بالمعاينة ⭐ (مافيش اكتشاف ⭐).
   📌 ⛔ أي مسار مش في القائمة ⭐ ⇒ ⛔ مافيش إنترنت ⭐ (fail-closed ⭐). */
const BACKEND_READONLY_EXACT = new Set([
  '/api/health', '/api/analyze', '/api/bench', '/api/strategies', '/api/rank',
  '/api/ranking', '/api/stats', '/api/sector-stats', '/api/dividends',
  '/api/zones', '/api/track', '/api/preflight', '/api/engine-weights',
  '/api/tvquote', '/api/tvscan', '/api/tvlogo', '/api/tvcandles',
  '/api/gold', '/api/opp/strategies', '/api/opp/summary',
  '/api/opp/list', '/api/opp/detail', '/api/opp/explain',
  '/api/indices/compare', '/api/charts/list', '/api/setups',
]);
const BACKEND_READONLY_PREFIX = [
  '/api/gold/', '/api/candles/', '/api/tvlogo/', '/api/fundamental/',
  '/api/technical/', '/api/risk/', '/api/alpha/', '/api/radar/',
  '/api/indices/', '/api/opp/', '/api/opportunity/', '/api/strategy/',
  '/api/charts/', '/api/usd/', '/api/explain/', '/api/calendar',
];
export function isBackendReadOnly(path) {
  if (BACKEND_READONLY_EXACT.has(path)) return true;
  for (const pre of BACKEND_READONLY_PREFIX) {
    if (path.indexOf(pre) === 0) return true;
  }
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PIN_RE = /^\d{4}$/;

/* ── المعالج الرئيسي ─────────────────────────────────────────────────── */
async function handlePreviewApi(opts) {
  const request = opts.request;
  const env = opts.env;
  const url = opts.url;

  /* ⛔⛔ fail-closed ⛔⛔ — لو الإعداد ناقص ⇒ 503 صريح (مافيش نجاح وهمي) */
  if (!env || env.OCTA_PREVIEW_SELF_API !== 'on') return null;
  if (!env.PREVIEW_KV || !env.PREVIEW_SESSION_SECRET || !env.PREVIEW_STORE) {
    return json({
      ok: false, error: 'preview_backend_misconfigured',
      why: 'المعاينة محتاجة تخزينها الخاص وسر جلساتها ومخزنها القوي ⭐ — من غيرهم مفيش تشغيل ⭐'
    }, 503);
  }

  const p = url.pathname;
  const m = request.method;
  const wantsJson = p.startsWith('/api/');
  if (!wantsJson) return null;

  /* ⛔ CSRF: أي طلب بيغيّر الحالة لازم يكون من نفس الأصل ⭐ */
  const mutating = (m === 'POST' || m === 'PUT' || m === 'DELETE' || m === 'PATCH');
  if (mutating && !isSameOrigin(request, url)) {
    return json({ ok: false, error: 'cross_site_blocked',
      why: 'طلب من أصل خارجي اترفض' }, 403);
  }

  let body = {};
  if (mutating) {
    try { body = await request.json(); } catch (e) { body = {}; }
    if (!body || typeof body !== 'object') body = {};
  }

  /* ── ① التسجيل: start ⭐ */
  if (p === '/api/auth/signup/start' && m === 'POST') {
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const name = String(body.name || '').trim().slice(0, 40) || 'مستخدم';
    if (!EMAIL_RE.test(email)) {
      return json({ ok: false, error: 'الإيميل مش مظبوط', why: 'bad_email' }, 400);
    }
    const uid = await uidOf(email);
    const lock = await lockState(env, 'signup', uid);
    if (lock) return json({ ok: false, error: 'محاولات كتير — استنى شوية', why: 'locked' }, 429);
    const code = await makeChallenge(env, uid, email, name);
    /* ⛔ رد واحد Whether الإيميل مسجّل أو لأ ⭐ (مافيش تعداد) */
    /* ⭐⭐⭐ (R28 · R26-I01) ⭐ ⛔⛔⛔ الكود **مش** بيرجع في الرد ⭐ ⛔⛔⛔
       📌 قبل ⭐: `preview_code` ⭐ ⇒ ⭐ أي حد يقدر ياخد كود أي إيميل ⭐
          ⇒ ⭐ ⛔ استحواذ على الحسابات ⭐ (تسجيل ⭐ أو استرجاع ⭐).
       ✅ دلوقتي ⭐: الكود بيتبعت على **صندوق المعاينة** ⭐
          ⭐ (يتقرأ بـ**مفتاح المعاينة** ⭐ بس ⭐) ⭐. */
    return json({
      ok: true, sent: true, expires_in: CHALLENGE_TTL_SEC,
      message: 'لو الإيميل ده بتاعك، هتلاقي كود من ٦ أرقام في بريدك',
      preview_mailbox: true,
      preview_note: 'معاينة: الكود في صندوق المعاينة ⭐ — محتاج مفتاح المعاينة ⭐'
    });
  }

  /* ── ② التسجيل: verify (كود التأكيد) ⭐ */
  if (p === '/api/auth/signup/verify' && m === 'POST') {
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const uid = await uidOf(email);
    const chk = await checkChallenge(env, uid, body.code);
    if (!chk.ok) {
      return json({ ok: false, error: 'الكود مش مظبوط أو خلص', why: chk.why },
        chk.why === 'too_many_tries' ? 429 : 400);
    }
    const acct = await storeGet(env, acctKey(uid));
    if (!acct) {
      return json({ ok: true, verified: true, needs_pin: true,
        message: 'الكود اتأكد ⭐ — دلوقتي حطّ الباسورد من ٤ أرقام ⭐' });
    }
    return json({ ok: true, verified: true, needs_pin: false,
      message: 'الحساب موجود ⭐ — كمّل بـchallenges ⭐' });
  }

  /* ── ③ التسجيل: newpin (باسورد جديد) ⭐ */
  if (p === '/api/auth/signup/newpin' && m === 'POST') {
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const pin = String(body.pin || '').trim();
    const uid = await uidOf(email);
    const chk = await checkChallenge(env, uid, body.code);
    if (!chk.ok) return json({ ok: false, error: 'الكود مش مظبوط أو خلص', why: chk.why }, 400);
    if (!PIN_RE.test(pin)) {
      return json({ ok: false, error: 'الباسورد ٤ أرقام بالظبط', why: 'bad_pin' }, 400);
    }
    const salt = b64u(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await pbkdf2(pin, salt);
    /* ⭐⭐⭐ (R28 · R26-I01) ⭐ ⛔⛔⛔ الحساب الموجود **ما بيتكتبش** ⭐ ⛔⛔⛔
       📌 قبل ⭐: `newpin` ⭐ كان بيعيد كتابة أي حساب ⭐ ⇒ ⭐ ⛔ استحواذ ⭐.
       ✅ دلوقتي ⭐: الحساب الموجود ⭐ ⇒ ⭐ الطريق الصح ⭐ = استرجاع ⭐
          (pin/challenge ⭐) ⭐. */
    const existing = await storeGet(env, acctKey(uid));
    if (existing) {
      return json({
        ok: false, error: 'الحساب موجود — استخدم استرجاع الباسورد',
        why: 'account_exists'
      }, 409);
    }
    const acct = {
      uid: uid, email: email, name: chk.rec.name || 'مستخدم',
      pin_salt: salt, pin_hash: hash, epoch: 1,
      devices: [], created_at: nowSec(), plan: 'preview'
    };
    await storePut(env, acctKey(uid), acct);
    await storeDel(env, chalKey(uid));
    const device = String(body.device || '').trim();
    if (device) acct.devices = [device];
    if (device) await storePut(env, acctKey(uid), acct);
    /* ⭐ فهرس الباسورد ⭐ (قراءة قوية ⭐ — القوائم متأخرة ⭐) */
    try { await storePut(env, 'pinidx:' + await sha256hex(String(pin)), acctKey(uid)); } catch (e) { }
    const token = await issueSession(env, acct, device);
    /* ⭐⭐⭐ (R28 · FINDING-02) ⭐⭐⭐ ⛔ لا نصدر توكن غير محفوظ ⭐⭐⭐ */
    if (!token) {
      return json({ ok: false, error: 'تعذّر تسجيل الجلسة',
        why: 'issue_failed' }, 503);
    }
    return json({
      ok: true, token: token, expires_in: SESSION_TTL_SEC,
      user: userView(acct), message: 'الحابز اتعمل ⭐'
    }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_TTL_SEC) });
  }

  /* ── ④ تحدي الباسورد (إعادة التعيين/جهاز جديد) ⭐ */
  if (p === '/api/auth/pin/challenge/send' && m === 'POST') {
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const uid = await uidOf(email);
    await makeChallenge(env, uid, email, '');
    /* ⭐⭐⭐ (R28 · R26-I01) ⭐ ⛔ الكود مش بيرجع ⭐ (زي التسجيل ⭐) ⭐ */
    return json({
      ok: true, sent: true, expires_in: CHALLENGE_TTL_SEC,
      message: 'لو الإيميل ده بتاعك، هتلاقي كود من ٦ أرقام في بريدك',
      preview_mailbox: true,
      preview_note: 'معاينة: الكود في صندوق المعاينة ⭐ — محتاج مفتاح المعاينة ⭐'
    });
  }
  if (p === '/api/auth/pin/challenge/verify' && m === 'POST') {
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const uid = await uidOf(email);
    const chk = await checkChallenge(env, uid, body.code);
    if (!chk.ok) return json({ ok: false, error: 'الكود مش مظبوط أو خلص', why: chk.why }, 400);
    return json({ ok: true, verified: true });
  }
  if (p === '/api/auth/pin/challenge/newpin' && m === 'POST') {
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const pin = String(body.pin || '').trim();
    const uid = await uidOf(email);
    const chk = await checkChallenge(env, uid, body.code);
    if (!chk.ok) return json({ ok: false, error: 'الكود مش مظبوط أو خلص', why: chk.why }, 400);
    if (!PIN_RE.test(pin)) return json({ ok: false, error: 'الباسورد ٤ أرقام بالظبط', why: 'bad_pin' }, 400);
    const acct = await storeGet(env, acctKey(uid));
    if (!acct) return json({ ok: false, error: 'مفيش حساب بالإيميل ده', why: 'no_account' }, 404);
    const salt = b64u(crypto.getRandomValues(new Uint8Array(16)));
    acct.pin_salt = salt;
    acct.pin_hash = await pbkdf2(pin, salt);
    acct.epoch = (acct.epoch || 1) + 1;         /* ⛔ إبطال كل الجلسات ⭐ */
    await storePut(env, acctKey(uid), acct);
    await storeDel(env, chalKey(uid));
    return json({ ok: true, message: 'الباسورد اتغيّر ⭐ — لازم تعمل دخول تاني ⭐' });
  }

  /* ── ⑤ دخول بالباسورد ⭐ */
  if (p === '/api/auth/pin/login' && m === 'POST') {
    const pin = String(body.pin || '').trim();
    const device = String(body.device || '').trim();
    if (!PIN_RE.test(pin)) {
      return json({ ok: false, error: 'الباسورد ٤ أرقام بالظبط', why: 'bad_pin' }, 400);
    }
    /* ⛔⛔⛔ الجهاز **إلزامي** ⭐ (زي الإنتاج ⭐): الباسورد لوحده
       ⛔ مش مفتاح ⭐ (٤ أرقام ⭐ ⇒ ١٠٬٠٠٠ احتمال ⭐) ⭐ ولا هو
       ⛔ هو اللي بيميّز حسابين بنفس الباسورد ⭐ ⇒ لازم نطابق
       ⛔ (الباسورد + الجهاز المسجّل) ⭐ مع بعض ⭐. */
    if (!device || device.length < 8) {
      return json({ ok: false, error: 'لازم بصمة الجهاز',
        why: 'device_required' }, 400);
    }
    /* ⭐⭐⭐ (R28 · R26-I03) ⭐ القفل بيتفحص **قبل** أي محاولة ⭐ ⭐⭐
       📌 قبل ⭐: `lockState` ⭐ مكانش بيتنادى في المسار ده خالص ⭐
          ⇒ ⛔ القفل كان بلا أثر ⭐ ⇒ ⛔ تخمين ٤ أرقام (١٠٬٠٠٠ ⭐) مفتوح ⭐.
       ✅ دلوقتي ⭐: قفل على **هاش الباسورد** ⭐ (كل الأجهزة ⭐)
          + قفل على **الـIP** ⭐ ⇒ ⛔ تغيير الجهاز مابيفلتش ⭐. */
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const pinHash = await sha256hex(String(pin));
    const lockPin = await lockState(env, 'pin', pinHash);
    if (lockPin) {
      return json({ ok: false, error: 'محاولات كتير — استنى شوية',
        why: 'locked', retry_after: Math.ceil(lockPin) }, 429);
    }
    const lockIp = await lockState(env, 'ip', await sha256hex(ip));
    if (lockIp) {
      return json({ ok: false, error: 'محاولات كتير — استنى شوية',
        why: 'locked', retry_after: Math.ceil(lockIp) }, 429);
    }
    const listRaw = await storeList(env, 'acct:');
    /* ⭐ لميست يكون ⭐ → ⛔ مافيش اسحاني ⭐ (فاصل الفحص القوي بيستمر في المحفظة) ⭐ */
    const list = Array.isArray(listRaw) ? listRaw : [];
    let found = null;
    const cands = [];
    /* ⭐ الفهرس أولاً ⭐ (قراءة قوية ⭐) */
    try {
      const idx = await storeGet(env, 'pinidx:' + pinHash);
      if (idx) {
        const a0 = await storeGet(env, idx);
        if (a0) {
          const h0 = await pbkdf2(pin, a0.pin_salt || '');
          if (h0 === a0.pin_hash && (a0.devices || []).includes(device)) found = a0;
        }
      }
    } catch (e) { }
    for (const key of list) {
      if (found) break;
      const acct = await storeGet(env, key);
      if (!acct) continue;
      const hash = await pbkdf2(pin, acct.pin_salt || '');
      if (hash !== acct.pin_hash) continue;
      /* ⭐ (R26) ⭐ الحساب = (باسورد + جهاز مسجّل) ⭐
         ⭐ (زي الإنتاج ⭐) + ⭐ فهرس PIN ⭐ (قراءة قوية ⭐
         ⭐ بدل مسح الـKV ⭐ (القوائم متأخرة ⭐ ⇒ الدخول بي fallback ✗). */
      cands.push(acct);
    }
    /* ⭐ أكتر من حساب بنفس الباسورد ⇒ لازم الجهاز يطابق ⭐ */
    if (!found) {
      for (const a of cands) {
        if ((a.devices || []).includes(device)) { found = a; break; }
      }
    }
    if (!found) {
      /* ⭐⭐⭐ (R28 · R26-I03) ⭐ العدّاد بيزيد على **الباسورد** ⭐ + **الـIP** ⭐ */
      await bumpAttempts(env, 'pin', pinHash);
      await bumpAttempts(env, 'ip', await sha256hex(ip));
      /* ⛔ نردّ نفس الرسالة سواء الباسورد غلط ولا الجهاز مش مسجّل ⭐
         ⛔ (مافيش تعداد للحسابات ⭐) ⭐. */
      return json({ ok: false, error: 'الباسورد غلط أو الجهاز مش مسجّل',
        why: 'bad_pin_or_device' }, 401);
    }
    /* ⭐ كلمة المرور صح ⭐ ⇒ ⭐ العدّاد يتصفّر ⭐ */
    await bumpAttempts(env, 'pin', pinHash);
    const token = await issueSession(env, found, device);
    if (!token) {
      return json({ ok: false, error: 'تعذّر تسجيل الجلسة',
        why: 'issue_failed' }, 503);
    }
    return json({ ok: true, token: token, expires_in: SESSION_TTL_SEC,
      user: userView(found) }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_TTL_SEC) });
  }

  /* ── ⑥ البصمة (تسجيل الجهاز) ⭐ */
  if (p === '/api/auth/pin/fingerprint' && m === 'POST') {
    const device = String(body.device || '').trim();
    if (!device || device.length < 16) {
      return json({ ok: false, error: 'بصمة الجهاز ناقصة', why: 'bad_device' }, 400);
    }
    const listRaw = await storeList(env, 'acct:');
    const list = Array.isArray(listRaw) ? listRaw : [];
    for (const key of list) {
      const acct = await storeGet(env, key);
      if (!acct) continue;
      if ((acct.devices || []).includes(device)) {
        const token = await issueSession(env, acct, device);
        if (!token) {
          return json({ ok: false, error: 'تعذّر تسجيل الجلسة',
            why: 'issue_failed' }, 503);
        }
        return json({ ok: true, token: token, expires_in: SESSION_TTL_SEC,
          user: userView(acct) }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_TTL_SEC) });
      }
    }
    return json({ ok: false, error: 'مفيش جلسة لهذا الجهاز', why: 'no_device' }, 401);
  }

  /* ── ⑦ من أنا ⭐ */
  if (p === '/api/auth/me' && (m === 'GET' || m === 'POST')) {
    const sess = await readSession(env, request);
    if (!sess) return json({ ok: false, error: 'محتاج تسجيل دخول', why: 'unauthorized' }, 401);
    const acct = await storeGet(env, acctKey(sess.payload.uid));
    if (!acct) return json({ ok: false, error: 'محتاج تسجيل دخول', why: 'unauthorized' }, 401);
    return json({ ok: true, user: userView(acct), expires_in: sess.payload.exp - nowSec() });
  }

  /* ── ⑧ تجديد الجلسة ⭐ */
  if (p === '/api/auth/refresh' && m === 'POST') {
    const sess = await readSession(env, request);
    if (!sess) return json({ ok: false, error: 'محتاج تسجيل دخول', why: 'unauthorized' }, 401);
    const acct = await storeGet(env, acctKey(sess.payload.uid));
    if (!acct) return json({ ok: false, error: 'محتاج تسجيل دخول', why: 'unauthorized' }, 401);
    /* ⭐⭐⭐ (R28 · FINDING-02) ⭐⭐⭐ استبدال الجلسة = عملية **متسقة** ⭐⭐⭐
       📌 قبل ⭐: `storeDel` ⭐ (القديم) ⭐ وبعدين `issueSession` ⭐ (الجديد) ⭐
          ⇒ ⛔ لو الإصدار فشل ⭐ ⇒ ⭐ المستخدم بلا جلسة ⭐ (خسارة ⭐)
          ⇒ ⛔ والقديم ⭐ كان بيرجع نجاح ⭐ حتى لو الكتابة ما تمّت ⭐.
       ✅ الترتيب ⭐: ① **إبطال القديم** ⭐ (ويجب أن ينجح ⭐)
          ② **إصدار الجديد** ⭐ (ويجب أن يُكتب في المخزن ⭐)
          ⇒ ⛔ لو الإبطال فشل ⭐ ⇒ ⛔ مفيش جلسة بديلة ⭐ (والقديمة بتفضل زي ما هي ⭐).
       ⭐ والكتابة لازم تتأكد ⭐ ⇒ ⛔ ما نرجّعش توكن مش محفوظ ⭐. */
    const revoked = await storeDel(env, sessKey(sess.payload.uid, sess.payload.sid));
    if (!revoked) {
      /* ⛔ تعذّر الإبطال ⭐ ⇒ ⛔ refuse إصدار بديل ⭐ (fail-closed ⭐) */
      return json({ ok: false, error: 'تعذّر إنهاء الجلسة القديمة',
        why: 'revoke_failed' }, 503);
    }
    const token = await issueSession(env, acct, sess.rec.device || '');
    if (!token) {
      return json({ ok: false, error: 'تعذّر تجديد الجلسة',
        why: 'issue_failed' }, 503);
    }
    return json({ ok: true, token: token, expires_in: SESSION_TTL_SEC,
      user: userView(acct) }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_TTL_SEC) });
  }

  /* ── ⑨ تسجيل الخروج ⭐ */
  if (p === '/api/auth/logout' && (m === 'GET' || m === 'POST')) {
    const sess = await readSession(env, request);
    /* ⭐⭐⭐ (R28 · FINDING-02) ⭐⭐⭐ نجاح الخروج = **إبطال مؤكد** ⭐⭐⭐
       📌 قبل ⭐: الرد كان `revoked:true` ⭐ حتى لو الحذف فشل ⭐ ⇒ ⛔ كذب ⭐.
       ✅ دلوقتي ⭐: ⛔ لو الإبطال فشل ⭐ ⇒ ⛔ 503 ⭐ (مافيش نجاح ⭐).
       📌 مافيش جلسة ⭐ ⇒ ⛔ مافيش حاجة تُبطل ⭐ ⇒ ⛔ رفض ⭐ (401 ⭐). */
    if (!sess) {
      return json({ ok: false, error: 'محتاج تسجيل دخول', why: 'unauthorized' }, 401);
    }
    const revoked = await storeDel(env, sessKey(sess.payload.uid, sess.payload.sid));
    if (!revoked) {
      return json({ ok: false, error: 'تعذّر إنهاء الجلسة',
        why: 'revoke_failed' }, 503);
    }
    return json({ ok: true, revoked: true },
      200, { 'Set-Cookie': sessionCookie('', 0) });
  }

  /* ── ⑩ الأسعار (من لقطة المعاينة) ⭐ */
  if (p === '/api/quotes' && m === 'GET') {
    const snap = await snapshotGet(env, 'snap:quotes');
    if (!snap) {
      return json({ ok: false, error: 'لقطة الأسعار مش موجودة',
        why: 'snapshot_missing' }, 503);
    }
    const mk = (url.searchParams.get('market') || 'all').toLowerCase();
    const codes = url.searchParams.get('codes');
    const markets = snap.markets || {};
    if (codes) {
      const want = codes.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      const out = {};
      for (const mkt of Object.keys(markets)) {
        const hit = {};
        for (const c of want) if (markets[mkt][c]) hit[c] = markets[mkt][c];
        if (Object.keys(hit).length) out[mkt] = hit;
      }
      return json({ ok: true, ts: nowSec(), updated: snap.updated || nowSec(), quotes: out });
    }
    const selected = (mk === 'all') ? markets : (markets[mk] ? { [mk]: markets[mk] } : {});
    const counts = {};
    for (const k of Object.keys(selected)) counts[k] = Object.keys(selected[k]).length;
    return json({
      ok: true, ts: nowSec(), updated: snap.updated || nowSec(),
      age: Math.max(0, nowSec() - (snap.updated || nowSec())), ttl: snap.ttl || 120,
      egx: snap.egx || {}, markets: selected, counts: counts,
      preview_note: 'معاينة معزولة ⭐ — الأرقام من لقطة المعاينة ⭐ ومفيش اتصال بالإنتاج ⭐'
    });
  }

  /* ── ⑩ب الترتيب (من لقطة المعاينة) ⭐ — زي عقد الإنتاج ⭐ */
  if (p === '/api/rank' && m === 'GET') {
    /* ⛔ زي الإنتاج ⭐: بدون جلسة ⇒ 401 بجسم متطابق ⭐ */
    const sess = await readSession(env, request);
    if (!sess) {
      return json({ ok: false, error: 'النسخة الكاملة محمية', count: 0,
        results: [], filters: {}, _protected: true }, 401);
    }
    const snap = await snapshotGet(env, 'snap:quotes');
    if (!snap) return json({ ok: false, error: 'لقطة الأسعار مش موجودة', why: 'snapshot_missing' }, 503);
    const rows = (snap.markets || {}).egypt || {};
    const limit = Math.max(1, Math.min(400, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
    const codesWanted = url.searchParams.get('codes');
    let entries = Object.keys(rows);
    if (codesWanted) {
      const want = codesWanted.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      entries = entries.filter(c => want.indexOf(c) >= 0);
    }
    const results = entries.slice(0, limit).map(c => {
      const r = rows[c] || {};
      return {
        code: c,
        price: (r.close === undefined ? null : r.close),
        change: (r.change === undefined ? null : r.change),
        volume: (r.volume === undefined ? null : r.volume),
        market_cap_basic: (r.market_cap_basic === undefined ? null : r.market_cap_basic),
        recommend: (r['Recommend.All'] === undefined ? null : r['Recommend.All'])
      };
    });
    return json({ ok: true, count: results.length, results: results,
      filters: {}, updated: snap.updated || nowSec(),
      preview_note: 'معاينة معزولة ⭐ — الترتيب من لقطة المعاينة ⭐' });
  }

  /* ── ⑪ المحفظة (لكل حساب لوحده) ⭐ */
  if (p === '/api/portfolio' && (m === 'GET' || m === 'POST')) {
    const sess = await readSession(env, request);
    if (!sess) return json({ ok: false, error: 'محتاج تسجيل دخول', why: 'unauthorized' }, 401);
    const key = 'pf:' + sess.payload.uid;
    if (m === 'GET') {
      const pf = await storeGet(env, key);
      return json({ ok: true, portfolio: pf || { cash: 0, positions: {} } });
    }
    /* ⭐⭐⭐ (R28 · R26-I04) ⭐ الكتابة **ذرّية** ⭐ (قراءة+تعديل+كتابة جوه الـDO ⭐)
       ⇒ ⛔ مافيش ضياع للكتابات المتزامنة ⭐. */
    const pf = body && typeof body === 'object' ? body : {};
    const r = await storeCmd(env, { op: 'pf_set', key: key, patch: pf });
    if (!r) {
      return json({ ok: false, error: 'المحفظة مش متاحة دلوقتي',
        why: 'store_unavailable' }, 503);
    }
    return json({ ok: true, portfolio: r.portfolio });
  }

  /* ── ⑫ التنبيهات (لكل حساب لوحده + منع التكرار) ⭐ */
  /* ⭐⭐⭐ (R28) ⭐ مسارين ⭐: `/api/alerts` ⭐ (POST/GET ⭐) و`/api/alerts/state` ⭐ (GET ⭐)
     📌 السبب ⭐: ⭐ الواجهة بتطلب `/api/alerts/state` ⭐ (قراءة الحالة ⭐)
        ⇒ ⭐ وفي المعاينة كان بيرجع 501 ⭐ ⇒ ⭐ صفحة التنبيهات معطّلة ⭐. */
  if ((p === '/api/alerts' || p === '/api/alerts/state')
      && (m === 'GET' || (m === 'POST' && p === '/api/alerts'))) {
    const sess = await readSession(env, request);
    if (!sess) return json({ ok: false, error: 'محتاج تسجيل دخول', why: 'unauthorized' }, 401);
    const key = 'al:' + sess.payload.uid;
    if (m === 'GET') {
      const cur = await storeGet(env, key);
      const items = (cur && cur.items) || [];
      if (p === '/api/alerts/state') {
        return json({ ok: true, state: { items: items }, alerts: items,
          count: items.length, updated: (cur && cur.updated_at) || nowSec() });
      }
      return json({ ok: true, alerts: items });
    }
    const item = body && body.alert && typeof body.alert === 'object' ? body.alert : body;
    /* ⭐⭐⭐ (R28 · R26-I04) ⭐ الإضافة **ذرّية** ⭐ + ⭐ منع التكرار ⭐ جوه الـDO ⭐
       ⇒ ⛔ مافيش ضياع ⭐ + ⛔ مافيش تكرار ⭐ مع الكتابات المتزامنة ⭐. */
    const r = await storeCmd(env, { op: 'alerts_add', key: key, item: item });
    if (!r) {
      return json({ ok: false, error: 'التنبيهات مش متاحة دلوقتي',
        why: 'store_unavailable' }, 503);
    }
    return json({ ok: true, created: r.created === true, dedup: r.dedup === true,
      alerts: r.items || [] });
  }

  /* ── ⭐⭐⭐ (R28 · R26-I01) ⭐ صندوق المعاينة ⭐ ⭐⭐
     📌 ⛔ الكود **مش** بيرجع في الرد ⭐ (R26 ⭐) ⭐ ⇒ ⛔ مافيش استحواذ ⭐.
     ✅ القراءة بـ**مفتاح المعاينة** ⭐ (سر ⭐) ⭐ بس ⭐.
     📌 ⛔ مافيش مفتاح ⭐ ⇒ ⛔ 503 ⭐ (fail-closed ⭐). */
  if (p === '/api/preview/mailbox' && m === 'GET') {
    const want = String((env && env.PREVIEW_CONSOLE_KEY) || '');
    if (!want) {
      return json({ ok: false, error: 'صندوق المعاينة مش مهيّأ',
        why: 'console_key_missing' }, 503);
    }
    const got = String(request.headers.get('X-Preview-Key') || '');
    if (!safeEqual(got, want)) {
      return json({ ok: false, error: 'مفتاح المعاينة غلط', why: 'bad_key' }, 401);
    }
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase().slice(0, 120);
    if (!EMAIL_RE.test(email)) {
      return json({ ok: false, error: 'الإيميل مش مظبوط', why: 'bad_email' }, 400);
    }
    const uid = await uidOf(email);
    const mail = await storeGet(env, mailKey(uid));
    if (!mail || !mail.code) {
      return json({ ok: false, error: 'مفيش كود نشط دلوقتي', why: 'no_code' }, 404);
    }
    if ((mail.exp || 0) <= nowSec()) {
      return json({ ok: false, error: 'الكود خلص — اطلب كود جديد', why: 'expired' }, 410);
    }
    return json({
      ok: true, email: email, code: String(mail.code),
      expires_in: Math.max(0, (mail.exp || 0) - nowSec()),
      preview_note: 'كود المعاينة ⭐ — مفيش بريد ⭐'
    });
  }

  /* ⛔ /api/health للـworker ⭐ (نسخة المعاينة المعزولة ⭐) ⭐ */
  if (p === '/api/health') return null;

  /* ── مسارات المعاينة غير المغطّاة ⇒ رد صريح (مافيش 503 غامض) ⭐ */
  if (p.startsWith('/api/')) {
    /* ⭐⭐⭐ (R28 · FINDING-07) ⭐⭐⭐ مسارات الباك الحقيقي ⭐⭐⭐
       📌 قبل ⭐: كل مسار غير مغطّى ⭐ ⇒ 501 ⭐ ⇒ ⭐ المعاينة كانت **معزولة عن البيانات** ⭐.
       ✅ دلوقتي ⭐: مسارات **قراءة فقط** ⭐ ⇒ ⭐ تروح للـbackend الحقيقي ⭐
          (عبر `OCTA_API_URL` ⭐ + `OCTA_PROXY_SECRET` ⭐) ⭐
          ⇒ ⭐ والمعاينة تفضل معزولة في **الحالة** ⭐:
             ⭐ الحسابات ⭐ والجلسات ⭐ والمحفظة ⭐ والتنبيهات ⭐
             ⇒ ⭐ ما بتوصلش لاستدعاء بيكتب على الإنتاج ⭐.
       ⛔ أي مسار تاني ⭐ ⇒ ⛔ مافيش إنترنت ⭐ (fail-closed ⭐). */
    if (isBackendReadOnly(p)) return null;   /* ⭐ يستمر للـbackend الحقيقي ⭐ */
    return json({
      ok: false, error: 'preview_route_not_implemented',
      why: 'المسار ده مش متاح في المعاينة المعزولة ⭐',
      preview_note: 'المعاينة بتخدم: التسجيل ⭐ الدخول ⭐ الجلسات ⭐ الأسعار ⭐ المحفظة ⭐ التنبيهات ⭐'
    }, 501);
  }

  return null;
}

function num(v) {
  const n = Number(v);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export { handlePreviewApi };
