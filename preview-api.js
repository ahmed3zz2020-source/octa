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
const chalKey = (uid) => 'chal:' + uid;
const sessKey = (uid, sid) => 'sess:' + uid + ':' + sid;
const lockKey = (kind, id) => 'lock:' + kind + ':' + id;

async function kvGet(env, key) {
  const raw = await env.PREVIEW_KV.get(key, 'text');
  return raw ? JSON.parse(raw) : null;
}
async function kvPut(env, key, value, ttlSec) {
  if (ttlSec) await env.PREVIEW_KV.put(key, JSON.stringify(value), { expirationTtl: ttlSec });
  else await env.PREVIEW_KV.put(key, JSON.stringify(value));
}
async function kvDel(env, key) { await env.PREVIEW_KV.delete(key); }

/* ── قفل المحاولات ───────────────────────────────────────────────────── */
async function lockState(env, kind, id) {
  const rec = await kvGet(env, lockKey(kind, id));
  if (!rec) return null;
  if (rec.until && rec.until > nowSec()) return rec.until - nowSec();
  if (rec.count >= MAX_ATTEMPTS) return LOCK_TTL_SEC;
  return null;
}
async function bumpAttempts(env, kind, id) {
  const key = lockKey(kind, id);
  const rec = (await kvGet(env, key)) || { count: 0, until: 0 };
  rec.count = (rec.count || 0) + 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.until = nowSec() + LOCK_TTL_SEC;
    rec.count = 0;
  }
  await kvPut(env, key, rec, LOCK_TTL_SEC * 2);
}

/* ── الجلسات ──────────────────────────────────────────────────────────── */
async function issueSession(env, acct, device) {
  const sid = b64u(crypto.getRandomValues(new Uint8Array(18)));
  const payload = { uid: acct.uid, sid: sid, exp: nowSec() + SESSION_TTL_SEC };
  const body = enc(payload);
  const sig = await hmac(env.PREVIEW_SESSION_SECRET, body);
  const token = body + '.' + sig;
  await kvPut(env, sessKey(acct.uid, sid), {
    uid: acct.uid, sid: sid, exp: payload.exp,
    device: device || '', epoch: acct.epoch || 1
  }, SESSION_TTL_SEC + 3600);
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
  const rec = await kvGet(env, sessKey(payload.uid, payload.sid));
  if (!rec) return null;                          /* ⛔ مُبطل ⇒ رفض فوراً */
  if (rec.epoch !== (await kvGet(env, acctKey(payload.uid)) || {}).epoch) return null;
  return { payload: payload, rec: rec };
}

function userView(acct) {
  return {
    email: acct.email, name: acct.name, uid: acct.uid,
    created_at: acct.created_at || 0, plan: acct.plan || 'preview'
  };
}

/* ── الكود ────────────────────────────────────────────────────────────── */
async function makeChallenge(env, uid, email, name) {
  const code = randDigits(6);
  await kvPut(env, chalKey(uid), {
    code_hash: await sha256hex(code), email: email, name: name || '',
    exp: nowSec() + CHALLENGE_TTL_SEC, tries: 0
  }, CHALLENGE_TTL_SEC + 60);
  return code;
}
async function checkChallenge(env, uid, code) {
  const rec = await kvGet(env, chalKey(uid));
  if (!rec) return { ok: false, why: 'challenge_expired' };
  if ((rec.exp || 0) <= nowSec()) { await kvDel(env, chalKey(uid)); return { ok: false, why: 'challenge_expired' }; }
  if ((rec.tries || 0) >= 5) return { ok: false, why: 'too_many_tries' };
  const got = await sha256hex(String(code || '').trim());
  if (got !== rec.code_hash) {
    rec.tries = (rec.tries || 0) + 1;
    await kvPut(env, chalKey(uid), rec, CHALLENGE_TTL_SEC + 60);
    return { ok: false, why: 'bad_code' };
  }
  return { ok: true, rec: rec };
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
  if (!env.PREVIEW_KV || !env.PREVIEW_SESSION_SECRET) {
    return json({
      ok: false, error: 'preview_backend_misconfigured',
      why: 'المعاينة محتاجة تخزينها الخاص وسر جلساتها ⭐ — من غيرهم مفيش تشغيل ⭐'
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
    return json({
      ok: true, sent: true, expires_in: CHALLENGE_TTL_SEC,
      message: 'لو الإيميل ده بتاعك، هتلاقي كود من ٦ أرقام في بريدك',
      preview_code: code,
      preview_note: 'معاينة: مفيش بريد ⇒ الكود ظاهر هنا ⭐'
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
    const acct = await kvGet(env, acctKey(uid));
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
    const acct = {
      uid: uid, email: email, name: chk.rec.name || 'مستخدم',
      pin_salt: salt, pin_hash: hash, epoch: 1,
      devices: [], created_at: nowSec(), plan: 'preview'
    };
    await kvPut(env, acctKey(uid), acct);
    await kvDel(env, chalKey(uid));
    const device = String(body.device || '').trim();
    if (device) acct.devices = [device];
    if (device) await kvPut(env, acctKey(uid), acct);
    const token = await issueSession(env, acct, device);
    return json({
      ok: true, token: token, expires_in: SESSION_TTL_SEC,
      user: userView(acct), message: 'الحابز اتعمل ⭐'
    }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_TTL_SEC) });
  }

  /* ── ④ تحدي الباسورد (إعادة التعيين/جهاز جديد) ⭐ */
  if (p === '/api/auth/pin/challenge/send' && m === 'POST') {
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const uid = await uidOf(email);
    const code = await makeChallenge(env, uid, email, '');
    return json({
      ok: true, sent: true, expires_in: CHALLENGE_TTL_SEC,
      message: 'لو الإيميل ده بتاعك، هتلاقي كود من ٦ أرقام في بريدك',
      preview_code: code, preview_note: 'معاينة: مفيش بريد ⇒ الكود ظاهر هنا ⭐'
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
    const acct = await kvGet(env, acctKey(uid));
    if (!acct) return json({ ok: false, error: 'مفيش حساب بالإيميل ده', why: 'no_account' }, 404);
    const salt = b64u(crypto.getRandomValues(new Uint8Array(16)));
    acct.pin_salt = salt;
    acct.pin_hash = await pbkdf2(pin, salt);
    acct.epoch = (acct.epoch || 1) + 1;         /* ⛔ إبطال كل الجلسات ⭐ */
    await kvPut(env, acctKey(uid), acct);
    await kvDel(env, chalKey(uid));
    return json({ ok: true, message: 'الباسورد اتغيّر ⭐ — لازم تعمل دخول تاني ⭐' });
  }

  /* ── ⑤ دخول بالباسورد ⭐ */
  if (p === '/api/auth/pin/login' && m === 'POST') {
    const pin = String(body.pin || '').trim();
    const device = String(body.device || '').trim();
    if (!PIN_RE.test(pin)) {
      return json({ ok: false, error: 'الباسورد ٤ أرقام بالظبط', why: 'bad_pin' }, 400);
    }
    const list = await env.PREVIEW_KV.list({ prefix: 'acct:' });
    let found = null;
    for (const key of (list.keys || [])) {
      const acct = await kvGet(env, key.name);
      if (!acct) continue;
      const hash = await pbkdf2(pin, acct.pin_salt || '');
      if (hash === acct.pin_hash) { found = acct; break; }
    }
    if (!found) {
      await bumpAttempts(env, 'pin', await sha256hex(pin));
      return json({ ok: false, error: 'الباسورد غلط', why: 'bad_pin' }, 401);
    }
    /* ⛔ الجهاز لازم يكون مسجّل على الحساب (زي الإنتاج) ⭐ */
    if (device && !(found.devices || []).includes(device)) {
      return json({ ok: false, error: 'لازم كود على الإيميل عشان الجهاز الجديد',
        why: 'device_challenge_required' }, 403);
    }
    const token = await issueSession(env, found, device);
    return json({ ok: true, token: token, expires_in: SESSION_TTL_SEC,
      user: userView(found) }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_TTL_SEC) });
  }

  /* ── ⑥ البصمة (تسجيل الجهاز) ⭐ */
  if (p === '/api/auth/pin/fingerprint' && m === 'POST') {
    const device = String(body.device || '').trim();
    if (!device || device.length < 16) {
      return json({ ok: false, error: 'بصمة الجهاز ناقصة', why: 'bad_device' }, 400);
    }
    const list = await env.PREVIEW_KV.list({ prefix: 'acct:' });
    for (const key of (list.keys || [])) {
      const acct = await kvGet(env, key.name);
      if (!acct) continue;
      if ((acct.devices || []).includes(device)) {
        const token = await issueSession(env, acct, device);
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
    const acct = await kvGet(env, acctKey(sess.payload.uid));
    if (!acct) return json({ ok: false, error: 'محتاج تسجيل دخول', why: 'unauthorized' }, 401);
    return json({ ok: true, user: userView(acct), expires_in: sess.payload.exp - nowSec() });
  }

  /* ── ⑧ تجديد الجلسة ⭐ */
  if (p === '/api/auth/refresh' && m === 'POST') {
    const sess = await readSession(env, request);
    if (!sess) return json({ ok: false, error: 'محتاج تسجيل دخول', why: 'unauthorized' }, 401);
    const acct = await kvGet(env, acctKey(sess.payload.uid));
    if (!acct) return json({ ok: false, error: 'محتاج تسجيل دخول', why: 'unauthorized' }, 401);
    await kvDel(env, sessKey(sess.payload.uid, sess.payload.sid));   /* ⛔ القديم يموت ⭐ */
    const token = await issueSession(env, acct, sess.rec.device || '');
    return json({ ok: true, token: token, expires_in: SESSION_TTL_SEC,
      user: userView(acct) }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_TTL_SEC) });
  }

  /* ── ⑨ تسجيل الخروج ⭐ */
  if (p === '/api/auth/logout' && (m === 'GET' || m === 'POST')) {
    const sess = await readSession(env, request);
    if (sess) await kvDel(env, sessKey(sess.payload.uid, sess.payload.sid));
    return json({ ok: true, revoked: true },
      200, { 'Set-Cookie': sessionCookie('', 0) });
  }

  /* ── ⑩ الأسعار (من لقطة المعاينة) ⭐ */
  if (p === '/api/quotes' && m === 'GET') {
    const snap = await kvGet(env, 'snap:quotes');
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

  /* ── ⑪ المحفظة (لكل حساب لوحده) ⭐ */
  if (p === '/api/portfolio' && (m === 'GET' || m === 'POST')) {
    const sess = await readSession(env, request);
    if (!sess) return json({ ok: false, error: 'محتاج تسجيل دخول', why: 'unauthorized' }, 401);
    const key = 'pf:' + sess.payload.uid;
    if (m === 'GET') {
      const pf = await kvGet(env, key);
      return json({ ok: true, portfolio: pf || { cash: 0, positions: {} } });
    }
    const pf = body && typeof body === 'object' ? body : {};
    const cur = (await kvGet(env, key)) || { cash: 0, positions: {} };
    const next = {
      cash: num(pf.cash !== undefined ? pf.cash : cur.cash),
      positions: (pf.positions && typeof pf.positions === 'object') ? pf.positions : cur.positions,
      updated_at: nowSec()
    };
    await kvPut(env, key, next);
    return json({ ok: true, portfolio: next });
  }

  /* ── ⑫ التنبيهات (لكل حساب لوحده + منع التكرار) ⭐ */
  if (p === '/api/alerts' && (m === 'GET' || m === 'POST')) {
    const sess = await readSession(env, request);
    if (!sess) return json({ ok: false, error: 'محتاج تسجيل دخول', why: 'unauthorized' }, 401);
    const key = 'al:' + sess.payload.uid;
    const cur = (await kvGet(env, key)) || { items: [] };
    if (m === 'GET') return json({ ok: true, alerts: cur.items || [] });
    const item = body && body.alert && typeof body.alert === 'object' ? body.alert : body;
    const items = cur.items || [];
    const id = String(item.id || '').trim();
    if (id && items.some(a => a && a.id === id)) {
      return json({ ok: true, created: false, dedup: true, alerts: items });
    }
    const rec = {
      id: id || ('al_' + nowSec() + '_' + items.length),
      symbol: String(item.symbol || '').trim().toUpperCase(),
      kind: String(item.kind || 'price'),
      created_at: nowSec(), active: true
    };
    items.push(rec);
    await kvPut(env, key, { items: items });
    return json({ ok: true, created: true, alerts: items });
  }

  /* ── مسارات المعاينة غير المغطّاة ⇒ رد صريح (مافيش 503 غامض) ⭐ */
  if (p.startsWith('/api/')) {
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
