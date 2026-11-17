/**
 * 🛡️ OCTA-MGMT — وسيط آمن لتقرير الزوار
 * ─────────────────────────────────────────────
 * 🎯 الهدف: يوصّل الداتا الحية للمتصفح من غير ما يسرّب توكن الأدمن.
 *
 * ⛔ ليه Worker أصلاً؟  ←  CORS في الباك مقفول على أي أصل غريب،
 *    فالمتصفح مش هيقدر ينادي /api/admin/* مباشرة من دومين تاني.
 *    ⇒ السيرفر (الـWorker) هو اللي بينادي Railway ويضيف التوكن.
 *
 * 🔐 طبقتان:
 *   ١) تسجيل دخول بكلمة مرور ⇒ كوكي موقّع (HttpOnly + Secure + SameSite=Strict)
 *   ٢) التوكن نفسه ما بيوصلش المتصفح أبداً — بيفضل جوه الـWorker.
 *
 * 📡 المسارات:
 *   POST /api/login      {password}      ⇒ كوكي جلسة
 *   POST /api/logout                     ⇒ مسح الكوكي
 *   GET  /api/session                    ⇒ {ok:true} أو 401
 *   GET  /api/proxy?path=/api/admin/x   ⇒ تمرير للـRailway مع التوكن
 *   GET  /api/health                     ⇒ حالة الوسيط (booleans بس)
 *   *                                    ⇒ الملفات الثابتة (PWA) — ⛔ جلسة مطلوبة
 *
 * 🛡️ الجولة ١٨ (P0) — «إغلاق التسرّب العلني»:
 *   ⛔ ١) أي صفحة/ملف ثابت ⇒ **جلسة صالحة**. بدونها ⇒ 302 لصفحة الدخول
 *        (لو المتصفح طلب HTML) أو 401 (لو طلب ملف). ⛔ مافيش محتوى الصفحة.
 *   ⛔ ٢) `/api/health` ⇒ booleans بس (has_admin/has_password) — ⛔ مافيش
 *        عنوان الـbackend ولا أسماء متغيّرات.
 *   ⛔ ٣) رسائل الأخطاء ⇒ **عامة**. التفاصيل الداخلية تروح لوج الـWorker بس.
 *   ⛔ ٤) المسارات المسموحة للتمرير ⇒ قائمة بيضاء صريحة (منع SSRF).
 */

const ORIGIN = "https://octa-prices-production-4ccb.up.railway.app";
/* ⭐ كاش التفضيلات (في الذاكرة) — ٣٠ دقيقة */
let PREFS_CACHE = null;
const COOKIE = "octa_mgmt_sess";
const SESSION_TTL = 60 * 60 * 24 * 30; // ٣٠ يوم

/* 🛡️ الجولة ١٨ — الأخطاء: رسالة عامة للمستخدم + تفصيل في لوج الـWorker فقط */
const ERR_UPSTREAM = "تعذّر الوصول للسيرفر — جرّب تاني بعد شوية";
const ERR_AUTH = "لازم تسجيل دخول";

/* 🛡️ الجولة ١٨ — الأصول العامة (من غير جلسة).
   ⛔ مافيش هنا غير صفحة الدخول — ⛔ مافيش أي صفحة فيها بيانات. */
const PUBLIC_FILES = new Set(["/login.html", "/icons/favicon.png"]);

/* 🛡️ الجولة ١٨ — مسارات الـAPI المفتوحة (من غير جلسة) — مافيش بيانات شخصية */
const PUBLIC_API = new Set(["/api/login", "/api/logout", "/api/session", "/api/health"]);

/* 🛡️ الجولة ١٨ — القائمة البيضاء للتمرير.
   الشكل: method + نمط. ⛔ أي مسار برّه القائمة ⇒ 400 (منع SSRF). */
const PROXY_ALLOW = [
  { m: "GET", re: /^\/api\/admin\/[A-Za-z0-9_\/-]*$/ },
  { m: "GET", re: /^\/api\/subscriptions\/log$/ },
  { m: "GET", re: /^\/api\/ticker$/ },
  { m: "POST", re: /^\/api\/subscriptions\/activate$/ },
  { m: "POST", re: /^\/api\/admin\/(reset_chal|set_device|trust_device)$/ },
  { m: "DELETE", re: /^\/api\/admin\/user\/[A-Za-z0-9_.@\-]{1,120}$/ },
];

function proxyAllowed(method, target) {
  return PROXY_ALLOW.some((r) => r.m === method && r.re.test(target));
}

/* ── أدوات ── */
const enc = new TextEncoder();

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

async function sign(payload, secret) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseCookies(req) {
  const out = {};
  (req.headers.get("Cookie") || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders },
  });
}

/* ── كوكي الجلسة ── */
async function makeSession(secret) {
  const exp = String(Date.now() + SESSION_TTL * 1000);
  const sig = await sign(exp, secret);
  return `${exp}.${sig}`;
}

async function validSession(req, secret) {
  /* 🛡️ من غير سر ⇒ مافيش جلسة صالحة أبداً (لا ت trusting for undefined) */
  if (!secret) return false;
  const raw = parseCookies(req)[COOKIE];
  if (!raw) return false;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return false;
  const exp = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (Number(exp) < Date.now()) return false;
  const expect = await sign(exp, secret);
  return timingSafeEqual(sig, expect);
}

/* ── محدّد محاولات الدخول (حماية من التخمين) ── */
const attempts = new Map();
function tooMany(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.t > 15 * 60 * 1000) { attempts.delete(ip); return false; }
  return rec.n >= 8;
}
function noteFail(ip) {
  const rec = attempts.get(ip) || { n: 0, t: Date.now() };
  rec.n += 1; rec.t = Date.now();
  attempts.set(ip, rec);
}

/* ── تمرير الطلب للـRailway ──
   ⛔ الجولة ١٨: method + body مدعومين (للأفعال) — والردود 5xx بتتحوّل لرسالة
   عامة (⭐ تفصيلها في لوج الـWorker بس — ⛔ ما بتظهرش للمستخدم). */
async function proxyToRailway(path, token, method, bodyText) {
  const url = ORIGIN + path;
  const init = {
    method: method || "GET",
    headers: { "X-OCTA-Admin": token, "Accept": "application/json" },
  };
  if (bodyText) {
    init.body = bodyText;
    init.headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, init);
  const body = await res.text();
  if (res.status >= 500) {
    /* ⛔ مافيش تفاصيل السيرفر في الرد — لوج بس */
    console.error("[octa-mgmt] upstream error", { path, status: res.status, body: body.slice(0, 300) });
    return json({ ok: false, error: "السيرفر مرجع خطأ — التفاصيل في سجل الـWorker" }, 502);
  }
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/* ── 🛡️ الجولة ١٨ — جلب متابعات المستخدمين (كاش ٣٠ دقيقة) ──
   ⛔ كل mint_session بيتم في السيرفر — المتصفح ما بياخدش أي توكن. */
async function fetchPrefs(env) {
  const now = Date.now();
  if (PREFS_CACHE && (now - PREFS_CACHE.ts) < 1800000) return PREFS_CACHE.users;
  const up = await proxyToRailway("/api/admin/users", env.OCTA_ADMIN_TOKEN, "GET", null);
  if (!up.ok) throw new Error("users fetch failed");
  const uj = await up.json();
  const items = await Promise.all((uj.users || []).map(async (u) => {
    const email = String(u.email || "").trim();
    const base = { uid: u.uid, name: u.name, email: email, watch: [], n: 0 };
    if (!email) return base;
    try {
      const mr = await fetch(ORIGIN + "/api/admin/mint_session", {
        method: "POST",
        headers: { "X-OCTA-Admin": env.OCTA_ADMIN_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
      });
      if (!mr.ok) return base;
      const mj = await mr.json();
      if (!mj.token) return base;
      const wr = await fetch(ORIGIN + "/api/alerts/watch", {
        headers: { Authorization: "Bearer " + mj.token },
      });
      if (!wr.ok) return base;
      const wj = await wr.json();
      /* ⛔ باك في الباك (update_prices.py:12583): w_list جوّه اللوب
         ⇒ القائمة كلها بتترجع مع كل عنصر ⇒ ٦ أسهم = ٣٦ سطر.
         هنا بنخلي أول ظهور بس لكل كود. */
      const seen = {}, list = [];
      (wj.items || []).forEach((i) => {
        if (!i || !i.code || seen[i.code]) return;
        seen[i.code] = 1;
        list.push({ code: i.code, hi: i.hi, lo: i.lo, at: i.at });
      });
      return { uid: u.uid, name: u.name, email: email, watch: list, n: list.length };
    } catch (e) {
      console.error("[octa-mgmt] prefs item failed", { uid: u.uid, err: String(e && e.message || e) });
      return base;
    }
  }));
  PREFS_CACHE = { ts: now, users: items };
  return items;
}

/* ── 🛡️ الجولة ١٨ — خريطة الأسعار (كاش ٥ دقايق) ──
   ⛔ /api/prices حجمه ~٦٩٠ ك.ب ⇒ بنفلتره في السيرفر ونبعت للمتصفح
      الأكواد اللي المستخدمين متابعينها بس. */
let PRICE_CACHE = null;
async function fetchPriceMap(env) {
  const now = Date.now();
  if (PRICE_CACHE && (now - PRICE_CACHE.ts) < 300000) return PRICE_CACHE.map;
  const res = await fetch(ORIGIN + "/api/prices", {
    headers: { "X-OCTA-Admin": env.OCTA_ADMIN_TOKEN, "Accept": "application/json" },
  });
  if (!res.ok) throw new Error("prices fetch failed");
  const j = await res.json();
  const map = {};
  (j.egx30 || []).forEach((r) => {
    const c = String((r && r.code) || "").trim();
    const p = Number(r && r.price);
    if (c && isFinite(p) && p > 0) {
      map[c] = p;
      const base = c.split(".")[0];
      if (base && map[base] === undefined) map[base] = p;
    }
  });
  PRICE_CACHE = { ts: now, map };
  return map;
}

/* 🛡️ الجولة ١٨ — بوابة الملفات الثابتة */
function loginRedirect(url) {
  const to = new URL("/login.html", url);
  const next = url.pathname;
  if (next && next !== "/" && next !== "/index.html") to.searchParams.set("next", next);
  return new Response(null, {
    status: 302,
    headers: { "Location": to.toString(), "Cache-Control": "no-store" },
  });
}

function wantsHtml(request) {
  const a = (request.headers.get("Accept") || "").toLowerCase();
  return a.includes("text/html") || a.includes("application/xhtml");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    /* ═══ API ═══ */
    if (path.startsWith("/api/")) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";

      /* 🛡️ الجولة ١٨ (P0): ⛔ أي مسار API غير عام ⇒ لازم جلسة صالحة
         (يتحقق **قبل** أي طلب للباك — ⛔ صفر تسريب قبل التحقق). */
      if (!PUBLIC_API.has(path)) {
        const authed = await validSession(request, env.SESSION_SECRET);
        if (!authed) return json({ ok: false, error: ERR_AUTH }, 401);
      }

      /* ── تسجيل الدخول ── */
      if (path === "/api/login" && request.method === "POST") {
        if (tooMany(ip)) {
          return json({ ok: false, error: "محاولات كتير. استنى ١٥ دقيقة." }, 429);
        }
        let body = {};
        try { body = await request.json(); } catch (e) { /* body فاضي */ }
        const pass = String(body.password || "");
        const want = String(env.APP_PASSWORD || "");
        if (!want) return json({ ok: false, error: "التطبيق مش مهيّأ" }, 500);
        const ok = timingSafeEqual(await sha256(pass), await sha256(want));
        if (!ok) {
          noteFail(ip);
          return json({ ok: false, error: "كلمة المرور غلط" }, 401);
        }
        attempts.delete(ip);
        const sess = await makeSession(env.SESSION_SECRET);
        return json({ ok: true }, 200, {
          "Set-Cookie": `${COOKIE}=${encodeURIComponent(sess)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`,
        });
      }

      /* ── خروج ── */
      if (path === "/api/logout" && request.method === "POST") {
        return json({ ok: true }, 200, {
          "Set-Cookie": `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
        });
      }

      /* ── حالة الجلسة ── */
      if (path === "/api/session") {
        const ok = await validSession(request, env.SESSION_SECRET);
        return json(ok ? { ok: true, ts: Date.now() } : { ok: false }, ok ? 200 : 401);
      }

      /* ── حالة الوسيط ──
         ⛔ الجولة ١٨: ⛔ مافيش عنوان الـbackend ولا أسماء متغيّرات — booleans بس. */
      if (path === "/api/health") {
        return json({
          ok: true,
          has_admin: !!env.OCTA_ADMIN_TOKEN,
          has_password: !!env.APP_PASSWORD,
        });
      }

      /* ── ⭐ تفضيلات المستخدمين: الأسهم اللي بيتابعها كل واحد ──
         ⛔ الـadmin token مش بيوصلش للمتصفح ⇒mint_session + alerts/watch
         كلهم من السيرفر. الكاش ٣٠ دقيقة (البيانات مش بتتغير كل ثانية).
         ⛔ الجولة ١٨: ⛔ التحقق من الجلسة *قبل* أي طلب للباك. */
      if (path === "/api/prefs") {
        const authed = await validSession(request, env.SESSION_SECRET);
        if (!authed) return json({ ok: false, error: ERR_AUTH }, 401);
        if (!env.OCTA_ADMIN_TOKEN) return json({ ok: false, error: "التوكن غير مهيّأ" }, 500);
        try {
          const items = await fetchPrefs(env);
          const cached = !!(PREFS_CACHE && Date.now() - PREFS_CACHE.ts < 1800000);
          return json({ ok: true, cached: cached ? 1 : 0, users: items }, 200);
        } catch (e) {
          /* ⛔ الجولة ١٨: ⛔ ما بنردّش بتفاصيل الداخلية */
          console.error("[octa-mgmt] prefs failed", { err: String(e && e.message || e) });
          return json({ ok: false, error: ERR_UPSTREAM }, 502);
        }
      }

      /* ── 🔔 الجولة ١٨ — تنبيهات الأسعار (للوحة الإدارة) ──
         ⛔ كل الشغل ده جوه الـWorker: prices (٦٩٠ ك.ب) مش بتوصلش للمتصفح،
            المتصفح بياخد بس {code, price, state} لكل منبه. */
      if (path === "/api/panel/alerts") {
        if (!env.OCTA_ADMIN_TOKEN) return json({ ok: false, error: "التوكن غير مهيّأ" }, 500);
        try {
          const items = await fetchPrefs(env);
          const map = await fetchPriceMap(env);
          const alerts = [];
          let hi = 0, lo = 0;
          (items || []).forEach((u) => {
            (u.watch || []).forEach((w) => {
              const code = String(w.code || "");
              const px = map[code] !== undefined ? map[code]
                : (map[code.split(".")[0]] !== undefined ? map[code.split(".")[0]] : null);
              const h = Number(w.hi), l = Number(w.lo);
              let state = "none", label = "مفيش حد";
              if (px !== null && isFinite(h) && h > 0 && px >= h) { state = "hi"; label = "عدّى الحد الأعلى"; hi += 1; }
              else if (px !== null && isFinite(l) && l > 0 && px <= l) { state = "lo"; label = "وصل الحد الأدنى"; lo += 1; }
              alerts.push({
                uid: u.uid, name: u.name, email: u.email, code: code,
                hi: w.hi, lo: w.lo, at: w.at, price: px, state: state, label: label,
              });
            });
          });
          return json({
            ok: true, alerts: alerts,
            summary: {
              total: alerts.length, triggered_hi: hi, triggered_lo: lo,
              users: (items || []).length,
              priced: alerts.filter((a) => a.price !== null).length,
            },
          }, 200);
        } catch (e) {
          console.error("[octa-mgmt] alerts failed", { err: String(e && e.message || e) });
          return json({ ok: false, error: ERR_UPSTREAM }, 502);
        }
      }

      /* ── التمرير ── */
      if (path === "/api/proxy") {
        const authed = await validSession(request, env.SESSION_SECRET);
        if (!authed) return json({ ok: false, error: ERR_AUTH }, 401);
        const target = url.searchParams.get("path") || "";
        const method = (request.method || "GET").toUpperCase();
        /* ⛔ منع الـSSRF — القائمة البيضاء بس (method + path) */
        if (!proxyAllowed(method, target)) {
          return json({ ok: false, error: "مسار غير مسموح" }, 400);
        }
        if (!env.OCTA_ADMIN_TOKEN) return json({ ok: false, error: "التوكن غير مهيّأ" }, 500);
        let bodyText = null;
        if (method === "POST") {
          try { bodyText = await request.text(); } catch (e) { bodyText = null; }
          if (!bodyText) bodyText = "{}";
        }
        try {
          const up = await proxyToRailway(target, env.OCTA_ADMIN_TOKEN, method, bodyText);
          /* ⛔ المسار لسه مش موجود على السيرفر ⇒ 204 (مش خطأ — ميزة مستقبلية) */
          if (up.status === 404 || up.status === 405) {
            return new Response("", { status: 204, headers: { "X-OCTA-Missing": "1" } });
          }
          return up;
        } catch (e) {
          /* ⛔ الجولة ١٨: ⛔ رسالة عامة للمستخدم — التفصيل في لوج الـWorker بس */
          console.error("[octa-mgmt] proxy failed", { path: target, method, err: String(e && e.message || e) });
          return json({ ok: false, error: ERR_UPSTREAM }, 502);
        }
      }

      return json({ ok: false, error: "مسار غير معروف" }, 404);
    }

    /* ═══ الملفات الثابتة (PWA) ═══
       🛡️ الجولة ١٨ (P0): ⛔ أي صفحة/ملف ثابت ⇒ جلسة صالحة.
       بدون جلسة ⇒ 302 لصفحة الدخول (لو المتصفح طلب HTML) أو 401 (لو طلب ملف).
       ⛔ ممنوع يطلع 200 فيه بيانات لزائر. */
    const isPublic = PUBLIC_FILES.has(path);
    if (!isPublic) {
      const authed = await validSession(request, env.SESSION_SECRET);
      if (!authed) {
        if (wantsHtml(request)) return loginRedirect(url);
        return json({ ok: false, error: ERR_AUTH }, 401);
      }
    }

    /* ⛔ لازم يبقى index.html للروابط الداخلية (SPA) */
    const res = await env.ASSETS.fetch(request);
    if (res.status === 404 && request.method === "GET" &&
        !url.pathname.includes(".") && !url.pathname.startsWith("/api/")) {
      const shell = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
      if (shell && shell.status < 400) return shell;
    }
    return res;
  },
};
