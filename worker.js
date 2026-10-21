/* ═══════════════════════════════════════════════════════════
   🐙 OCTA — Worker entrypoint
   ───────────────────────────────────────────────────────────
   Proxy /api/* → octa-prices-production-4ccb.up.railway.app
   (يحايل CORS + cross-origin-resource-policy في الباك).
   باقي الطلبات → static assets في dist/.

   ⚠️ ليش فيه إعادة محاولة؟
   الاتصال من الـWorker للـRailway بيتقطّع أحياناً (TLS reset من
   الطرف التاني) — والطلب كان بيرجع 503 للمستخدم من غير سبب.
   فبنحاول ٣ مرات بتباعد قصير قبل ما نرجّع خطأ.

   ═══════════════════════════════════════════════════════════
   🚪 البوابة — ٢١ أكتوبر ٢٠٢٦
   ───────────────────────────────────────────────────────────
   ⛔⛔⛔ المشكلة: الـWorker كان بيقدّم التطبيق **كله** (١٫٨ ميجا)
   لأي زائر — حتى لو مش مسجّل. والبيانات كانت بتنزل من غير توكن.

   ⛌ الحل: الـWorker بيفحص **كوكي الجلسة**:
     · كوكي present  → التطبيق (زي ما كان)
     · مفيش كوكي    → صفحة بوابة صغيرة (gate.html) بدل التطبيق

   ⛌ ليه كوكي وليه مش localStorage؟
     الـWorker مش بيقدر يقرا localStorage — ده المتصفح بس.
     فالجلسة لازم تكون كوكي على دومين الموقع. الـكوكي HttpOnly
     (يعني السكربتات ماتقراهوش) + SameSite=Lax + Secure.

   ⛌⛔ مهم — البوابة **مش** بديل عن حماية الباك:
     الباك نفسه بقى يقفل كل مسار بيانات ورا توكن
     (api_gate في update_prices.py). البوابة دي طبقة أولى
     (بتوفّر ١٫٨ ميجا للزائر المجهول) — والباك هو الطبقة
     اللي بتمنع تنزيل الداتا فعلياً.
   ═══════════════════════════════════════════════════════════ */

const API = 'https://octa-prices-production-4ccb.up.railway.app';
const TRIES = 3;

/* ⛔ اسم كوكي الجلسة — لازم يبقى نفس اسم الباك (octa_token) */
const SESSION_COOKIE = 'octa_token';

/* 🚪 صفحات التطبيق — دي اللي بتتقفل بدون جلسة
   ⛌ الـassets (js/css/images) بتتنفع عادي — صفحة البوابة
      محتاجاها. */
const GATE_PAGES = ['/', '/index.html', '/chart', '/chart.html'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 🔁 جلب من الـAPI مع إعادة محاولة — الخطأ البسيط بيتراجع لوحده */
async function fetchApi(target, init) {
  let lastErr = null;
  for (let i = 0; i < TRIES; i++) {
    try {
      const r = await fetch(target, init);
      if (r.status >= 500 && i < TRIES - 1) {
        lastErr = new Error('upstream ' + r.status);
        await sleep(180 * (i + 1));
        continue;
      }
      return r;
    } catch (e) {
      lastErr = e;
      if (i < TRIES - 1) await sleep(180 * (i + 1));
    }
  }
  throw lastErr || new Error('api-proxy-failed');
}

/* ═══════════════════════════════════════════════════════════
   🔐 هيدرات الطلب اللي بتتبعت للـAPI
   ───────────────────────────────────────────────────────────
   ⛔⛔ ٢١ أكتوبر ٢٠٢٦ — الـworker كان بيبعت Accept بس
   ⛌ وبيرمي Authorization و Cookie و جسم الطلب!
   ⛌ النتيجة: أي مسار محمي كان بيرجّع 401 دايماً لما يمر
   ⛌ من الـworker.
   ═══════════════════════════════════════════════════════════ */
function buildHeaders(request) {
  const h = new Headers();
  h.set('Accept', 'application/json');
  /* ⛔ التوكن —Authorization (الباك بيقراه) */
  const auth = request.headers.get('Authorization');
  if (auth) h.set('Authorization', auth);
  /* ⛔ الكوكي — عشان الباك يقرأ الجلسة من الكوكي كمان */
  const ck = request.headers.get('Cookie');
  if (ck) h.set('Cookie', ck);
  /* ⛔ نوع المحتوى — لازم يوصل زي ما هو */
  const ct = request.headers.get('Content-Type');
  if (ct) h.set('Content-Type', ct);
  /* ⛌⛔⛔ identity — عشان مفيش gzip من الـAPI
     ⛌ (الـruntime بيضغط الردود لوحده قبل ما تطلع للعميل) */
  h.set('Accept-Encoding', 'identity');
  /* ⛌ الـIP — الباك بيقراه للrate limit */
  const cf = request.headers.get('CF-Connecting-IP');
  if (cf) h.set('X-Forwarded-For', cf);
  return h;
}

/* ═══════════════════════════════════════════════════════════
   🍪 فيه جلسة ولا لأ؟
   ───────────────────────────────────────────────────────────
   ⛌ بنفحص **وجود** الكوكي بس — مش صحته.
   ⛌ الـworker مش بيقدر يفكّ التوقيع (السر عند الباك).
   ⛌ ⇒ لو الكوكي forged ⇒ الـworker هيقدّم التطبيق… والباك
   ⛌   هيرفض كل طلب بيانات (401). يعني: مفيش تسريب.
   ═══════════════════════════════════════════════════════════ */
function hasSession(request) {
  try {
    const c = request.headers.get('Cookie') || '';
    if (!c) return false;
    const parts = c.split(';');
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      if (p.indexOf(SESSION_COOKIE + '=') === 0) {
        const v = p.slice(SESSION_COOKIE.length + 1);
        if (v) return true;
      }
    }
  } catch (e) { }
  return false;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* 1) proxy للـAPI (نفس origin عشان نتفادى CORP same-site) */
    if (url.pathname.startsWith('/api/')) {
      const target = API + url.pathname + url.search;
      const init = {
        method: request.method,
        headers: buildHeaders(request)
      };
      /* ⛔⛔ جسم الطلب — كان بيضيع خالص!
         ⛌ يعني كل POST (chat · analyze · charts · auth) كان
         ⛌ بيوصل للباك من غير body. */
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
          const buf = await request.arrayBuffer();
          if (buf && buf.byteLength) init.body = buf;
        } catch (e) { }
      }
      try {
        const upstream = await fetchApi(target, init);
        const body = await upstream.text();
        const out = new Headers();
        out.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
        /* ⛔⛔⛔ Set-Cookie — كان بيضيع!
           ⛌ ده كوكي الجلسة HttpOnly — من غير ما يوصل للصفحة
           ⛌ مفيش جلسة أصلاً والبوابة هتفضل قايمة للأبد. */
        const sc = upstream.headers.get('Set-Cookie');
        if (sc) out.set('Set-Cookie', sc);
        out.set('Cache-Control', 'no-store');
        return new Response(body, { status: upstream.status, headers: out });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'api-proxy-failed', message: String(e && e.message || e) }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    /* 2) 🚪 البوابة — صفحة التطبيق من غير جلسة = صفحة البوابة */
    const isGatePage = GATE_PAGES.indexOf(url.pathname) !== -1;
    if (isGatePage && !hasSession(request)) {
      try {
        const gateUrl = new URL('/gate.html', url);
        const gate = await env.ASSETS.fetch(new Request(gateUrl.toString(), request));
        if (gate && gate.status < 400) {
          const h = new Headers(gate.headers);
          h.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
          return new Response(gate.body, { status: 200, headers: h });
        }
      } catch (e) { }
    }

    /* 3) static assets (الصور/HTML/CSS/JS) */
    return env.ASSETS.fetch(request);
  }
};
