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
/* 🛡️ الجولة ١٩ (R18-A01) — عمر الجلسة **محدّد** (كان ٣٠ يوم ⛔ نافذة تعرّض طويلة) */
const SESSION_TTL = 8 * 60 * 60; // ٨ ساعات
/* ⛔ التدوير: لو الج-session على وشك الانتهاء ⇒ يُصدرنا جلسة جديدة (النسخة المنسوخة ما بتتجدّدش) */
const RENEW_BEFORE = 2 * 60 * 60; // ساعتين
/* 🛡️ الجولة ٢٤ (R24 · R22-I05) — هامش صلاحية علامة الإبطال ⭐
   📌 العيب المقاس في الجولة ٢٤ ⭐: `expirationTtl` في الـKV **بالثواني** ⭐
      ⇒ الكود القديم كان يحسب **بالدقائق** ⭐ ⇒ العلامة كانت بتخلص بعد
      ~٨ دقايق ⭐ (بدل ٨ ساعات ⭐) ⇒ ⛔ الجلسة المبطلة بترجع صالحة تاني ⭐.
   ✅ الحل: TTL = العمر المتبقي للجلسة (بالثواني ⭐) + هامش ⭐.
   ⛔ الحد الأدنى في الـKV = ٦٠ ثانية ⭐ ⇒ مش بننزل تحته ⭐. */
const REVOKE_TTL_MARGIN_S = 5 * 60; // ٥ دقايق هامش
/* 🛡️ الجولة ١٩ (R18-A01) — إبطال **من جهة السيرفر**:
   ⛔ قبل كده: الخروج كان بيمسح الكوكي في المتصفح بس ⇒ أي نسخة منسوخة
      كانت سليمة ٣٠ يوم! ⇒ دلوقتي الخادم نفسه بيبطل الجلسة فورًا. */
const REVOKED = new Map(); // raw ← وقت انتهاء الإبطال

/* 🛡️ الجولة ٢٠ (R20) — إبطال الجلسة عبر **أكتر من نسخة** من الـWorker ⬇️
   📌 المشكلة: `REVOKED` كان **في الذاكرة** ⇒ ⛔ كل نسخة من الـWorker
     عندها قائمتها ⭐ ⇒ ⛔ الخروج على نسخة A **ما بيمبطلش** نفس
     الجلسة على نسخة B ⭐ ⇒ ⛔ النسخة المنسوخة من الكوكي كانت
     سليمة على أي نسخة تانية ⭐ (وهو بالظبط التهديد اللي R18-A01
     قصد يوقفه) ⭐.
   ✅ الحل: **مخزن مشترك** (Cloudflare KV) ⬇️
     ⭐ الإبطال يكتب `rev:<hash>` ⇒ أي نسخة تانية تشوفه ⬇️
     ⭐ ⛔ المفتاح **هاش موقّع** (مش الكوكي نفسه) ⇒ مافيش bearer
       token في أسماء مفاتيح KV ⭐
     ⭐ ⛔ لو الـKV مش مربوط ⇒ fallback للذاكرة (سلوك نسخة واحدة)
       + **تنبيه صريح** في /api/health (booleans) ⭐
   ⛔ ملاحظة: KV اتساقه **متأخر** (حتى ~٦٠ ثانية) ⇒ الإبطال بين
     النسخ بيبقى فعّال خلال دقيقة ⭐ (والعمر ٨ ساعات يقلّل الأثر) ⭐
   ⭐ الحل الأقوى (Do) محتاج مورد جديد ⇒ ⛔ ممنوع بدون موافقة المالك ⭐ */
const REVOKE_PREFIX = "rev:";

/* 🛡️ الجولة ٢٤ (R24 · R22-I05) — حساب عمر الجلسة المتبقي ⭐
   📌 شكل الكوكي: `<exp>.<sig>` ⭐ و`exp` = وقت الانتهاء بالمللي ثانية ⭐.
   ⛔ الرجوع صفر ⭐ = ما فيش جلسة صالحة ⭐ ⇒ نستعمل الحد الأعلى ⭐. */
function sessionExpiryMs(raw) {
  if (!raw) return 0;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return 0;
  const exp = Number(raw.slice(0, dot));
  if (!isFinite(exp) || exp <= 0) return 0;
  return exp;
}

/* ⭐ العمر المتبقي بالثواني ⭐ */
function sessionRemainingSeconds(raw, nowMs) {
  const exp = sessionExpiryMs(raw);
  if (!exp) return 0;
  const now = (typeof nowMs === "number") ? nowMs : Date.now();
  return Math.max(0, Math.floor((exp - now) / 1000));
}

/* ⭐⭐ TTL = العمر المتبقي + هامش ⭐⭐ (بالثواني ⭐ — الـKV بياخد ثواني ⭐)
   ⛔ الحد الأدنى ٦٠ ثانية ⭐ (حد الـKV ⭐).
   ⛔ لو الجلسة مش معروفة ⇒ بناخد عمر الجلسة كامل ⭐ (الأأمن ⭐). */
function revokeTtlSeconds(raw, nowMs) {
  const remaining = sessionRemainingSeconds(raw, nowMs);
  const base = remaining > 0 ? remaining : SESSION_TTL;
  return Math.max(60, base + REVOKE_TTL_MARGIN_S);
}

/* ============================================================
   🛡️🛡️ الجولة ٢٥ (R25 · R24-I11) — التحقق من الكوكي **قبل** أي نداء للتخزين ⭐
   📌 المطلوب من المالك ⭐:
      «التحقق من التوقيع والانتهاء قبل استدعاء التخزين» ⭐
      «منع الكوكي المزوّر من استهلاك موارد Durable Object أو KV» ⭐.
   📌 العيب المقاس ⭐: مسار `/api/logout` كان بينادي الـDO والـKV بـ**أي** كوكي ⭐
      ⇒ ⛔ كوكي مزوّر = instance جديد في الـDO + كتابة في الـKV ⭐
      ⇒ ⛔ استنزاف + نمو غير محدود ⭐.
   ✅ دلوقتي ⭐: التوقيع + الانتهاء **قبل** أي نداء ⭐
      ⇒ ⛔ الكوكي المزوّر/المشوّه **ما بيوصلش** التخزين أصلاً ⭐.
   ⭐ مربوط بالاختبار: assets/tests/r25-logout-hardening.test.js ⭐ */
function cookieShape(raw) {
  if (!raw) return { ok: false, reason: "missing" };
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return { ok: false, reason: "shape" };
  const exp = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!/^\d+$/.test(exp)) return { ok: false, reason: "shape" };
  const expMs = Number(exp);
  if (!isFinite(expMs) || expMs <= 0) return { ok: false, reason: "shape" };
  return { ok: true, exp: exp, sig: sig, expMs: expMs };
}

/* ⭐ تحقق كامل ⭐: الشكل ⭐ ثم التوقيع ⭐ ثم الانتهاء ⭐ */
async function verifyCookie(raw, secret, env) {
  const shape = cookieShape(raw);
  if (!shape.ok) return shape;
  if (!secret) return { ok: false, reason: "no-secret" };
  let expect = "";
  try {
    /* ⭐⭐⭐ الجولة ٢٦ (R26) ⭐ — ⭐ نفس حمولة التوقيع ⭐ (exp + وسم الاعتماد ⭐)
       ⭐ ⇒ ⭐ تغيير كلمة المرور ⭐ ⛔ يبطل الكوكي ⭐ ⭐. */
    expect = await sign(shape.exp + "." + (await credentialTag(env)), secret);
  } catch (e) {
    return { ok: false, reason: "sign-failed" };
  }
  if (!timingSafeEqual(shape.sig, expect)) return { ok: false, reason: "signature" };
  shape.expired = shape.expMs < Date.now();
  return shape;
}

/* 🛡️🛡️ الجولة ٢٥ (R25 · R24-I10) — تحديد بيئة الإنتاج ⭐
   📌 المطلوب ⭐: «تنفيذ fail-closed في بيئة الإنتاج عند غياب مصدر الإبطال المطلوب» ⭐
   📌 القرار ⭐: ⛔ **بدون تصريح ⇒ نعتبرها إنتاج** ⭐ (fail-closed ⭐)
      ⭐ والبيئة غير الإنتاج لازم تصرّح صريح ⭐ (`APP_ENV=preview` ⭐).
   📌 الحماية من footgun ⭐: ملف إعدادات الإنتاج نفسه فيه تصريح ⭐
      + ⭐ اختبار حارس يقرأ الإعدادات ⭐ (r25-prod-config-guard.test.js ⭐). */
function isProductionEnv(env) {
  const flag = String((env && (env.APP_ENV || env.OCTA_ENV)) || "").trim().toLowerCase();
  /* ⭐⭐⭐ الجولة ٢٦ (R26) — ⭐⭐⭐ أي بيئة **غير معروفة** ⭐ ⇒ ⭐ إنتاج ⭐ (fail-closed ⭐)
     📌 قبل ⭐: ⛔ أي قيمة تانية ⭐ (حتى غلطة إملائية ⭐ زي "productionn" ⭐)
        ⇒ ⭐ ⛔ كانت بتعتبر بيئة غير إنتاج ⭐ ⇒ ⭐ ⭐ انفتاح ⭐ ⭐ (بدون مصدر إبطال ⭐).
     ✅ الحل ⭐: ⭐ قائمة بيضاء صريحة ⭐ لبيئات التطوير ⭐ فقط ⭐
        ⇒ ⭐ أي قيمة تانية ⭐ ⇒ ⭐ إنتاج ⭐ ⇒ ⭐ ⛔ مافيش جلسة من غير مصدر ⭐. */
  const NON_PRODUCTION = new Set(["", "dev", "development", "preview", "test",
    "testing", "local", "localhost"]);
  if (NON_PRODUCTION.has(flag)) return flag ? false : true;  /* ⭐ مفيش قيمة ⇒ إنتاج ⭐ */
  return true;
}

async function revokeKey(env, raw) {
  if (!raw) return null;
  try {
    return REVOKE_PREFIX + (await sign(raw, String(env.SESSION_SECRET || "")));
  } catch (e) {
    return null;
  }
}

/* ⭐⭐⭐ الجولة ٢٢ (R22) — **مسار الاتساق القوي** ⭐⭐⭐ (Durable Object ⭐)
   📌 المشكلة: ⛔ الـKV **اتساقه متأخر** (حتى ~٦٠ ثانية ⭐) ⇒ ⛔ في
     نافذة التأخير: نسخة تانية ممكن تقبل جلسة اتبطلت ⭐ (مُثبت بالاختبار ⭐).
   📌 ليه مش بنحلّها بـKV: ⛔ القراءة القديمة **مش able** تفرّق بين
     «مش مبطلة» و«الإبطال لسه ما وصلش» ⭐ ⇒ ⛔ الحل لازم يكون
     **مصدر واحد strongly-consistent** ⭐.
   ✅ الحل: ⭐ Durable Object ⭐ (قراءة بعد كتابة ⇒ مافيش نافذة ⭐)
     ⭐ الـbinding اسمه `REVOKE_DO` ⭐ ⇒ لما يكون موجود هو **المرجع** ⭐
     ⭐ ولما مافيش ⇒ fallback للـKV (مع توثيق النافذة ⭐)
     ⭐ والـKV بيفضل **شاهد احتياطي** ⭐ ⇒ يقدر يرفض بس ما بيقدرش يقبل ⭐.
   ⛔ مافيش مورد اتعمل ⭐ (مافيش نشر ⭐) — التفعيل بنشر المالك ⭐. */

/* ⭐ كتابة الإبطال في الـDO ⭐
   📌 **قراءة تأكيد** (read-after-write ⭐): بعد الكتابة بنقرأ تاني ⭐
     ⇒ لو الـDO مش ردي ⇒ مافيش دليل ⇒ نعتبر الكتابة **فاشلة** ⭐
     ⇒ الشاهد في الـKV بيمنع القبول الصامت ⭐.
   ⛔ أي خطأ ⇒ `false` ⭐ (مافيش استثناء بيخرج من هنا ⭐). */
async function doRevoke(env, raw) {
  if (!env.REVOKE_DO || !raw) return false;
  try {
    const name = await revokeKey(env, raw);
    if (!name) return false;
    const id = env.REVOKE_DO.idFromName(name);
    const stub = env.REVOKE_DO.get(id);
    const res = await stub.fetch("https://revoke.internal/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      /* 🛡️ R24 (I05): ⭐ بنبعت وقت انتهاء الجلسة ⭐
         ⇒ الـDO يقدر يحط صلاحية على العلامة ⭐
         ⇒ العلامة ما تعيشش بعد ما الجلسة تموت ⭐ (تنظيف ⭐)
         ⛔ والصلاحية ما تبقاش أقصر من عمر الجلسة ⭐. */
      body: JSON.stringify({
        revoked: true,
        expiresAt: sessionExpiryMs(raw) || 0,
      }),
    });
    if (!res || !res.ok) return false;         // ⛔ الكتابة فشلت ⭐
    const confirmed = await doIsRevoked(env, raw);
    return confirmed === true;                // ⭐ تأكيد بالقراءة ⭐
  } catch (e) {
    return false;                             // ⛔ مافيش دليل ⭐
  }
}

/* ⭐ فحص الإبطال في الـDO ⭐
   📌 `true` = الإبطال **مثبت** ⭐ · `false` = **مفيش إبطال** ⭐
      · `null` = ⛔ **تعذّر التحقق** ⭐ ⇒ ⛔ fail-closed ⭐ (الجلسة تُرفض ⭐).
   ⛔ الرد المش المفهوم (مش JSON ⭐ / مافيش `revoked` ⭐ / خطأ ⭐ / 5xx ⭐)
      ⇒ `null` ⭐ — **مش** `false` ⭐ (عشان ما نقبلش جلسة من غير دليل ⭐). */
async function doIsRevoked(env, raw) {
  if (!env.REVOKE_DO || !raw) return null;
  try {
    const name = await revokeKey(env, raw);
    if (!name) return null;
    const id = env.REVOKE_DO.idFromName(name);
    const stub = env.REVOKE_DO.get(id);
    const res = await stub.fetch("https://revoke.internal/check");
    if (!res || !res.ok) return null;         // ⛔ fail-closed ⭐
    let body = null;
    try { body = await res.json(); } catch (e) { return null; }
    if (!body || typeof body !== "object" || typeof body.revoked !== "boolean") {
      return null;                            // ⛔ رد مش مفهوم ⇒ fail-closed ⭐
    }
    return body.revoked;
  } catch (e) {
    return null;                              // ⛔ fail-closed ⭐
  }
}

/* ⭐⭐⭐ الجولة ٢٢ (R22) — صنف الـDurable Object ⭐⭐⭐
   📌 **instance واحد لكل جلسة** ⭐ (الاسم = `rev:` + هاش موقّع ⭐)
     ⇒ كل طلبات نفس الجلسة بتترتّب ⭐ ⇒ ⛔ مافيش سباق ⭐
     ⇒ ⛔ مافيش نافذة انتشار ⭐ (قراءة بعد كتابة ⇒ **قوي** ⭐).
   📌 التخزين: `state.storage` ⭐ (SQLite-backed ⭐) ⇒ الشاهدة بتفضل
     موجودة حتى لو الـinstance اتقفل ⭐ · ⭐ وكاش في الذاكرة للسرعة ⭐.
   ⛔ **مافيش `import`** ⭐ ⇒ نفس أسلوب تحميل اختبارات المشروع ⭐
     (الأسلوب الكلاسيكي `constructor(state, env)` مدعوم ⭐).
   ⛔ مافيش مورد اتعمل ⭐ (مافيش نشر ⭐) — التفعيل بنشر المالك ⭐. */
const DO_REVOKE_KEY = "revoked";

class RevokeDO {
  constructor(state, env) {
    this.state = state;
    this.env = env || {};
    /* ⭐ كاش الذاكرة ⭐ — `null` = مجهول ⭐ (لسه ما اتقراش ⭐) */
    this._revoked = null;
    /* 🛡️ R24 (I05): ⭐ وقت انتهاء العلامة ⭐ (بالمللي ثانية ⭐) */
    this._expiresAt = 0;
  }

  async fetch(request) {
    let path = "";
    let method = "GET";
    try {
      path = new URL(request.url).pathname;
      method = (request.method || "GET").toUpperCase();
    } catch (e) {
      return json({ ok: false, error: "bad-request" }, 400);
    }

    /* ⭐ تسجيل الإبطال ⭐ (كتابة متزامنة ⭐) */
    if (method === "POST" && path === "/revoke") {
      let body = {};
      try { body = await request.json(); } catch (e) { body = {}; }
      try {
        /* 🛡️ R24 (I05): ⭐ صلاحية على العلامة ⭐
           📌 العلامة القديمة كانت بتفضل **للأبد** ⭐ ⇒ تخزين بيزيد ⭐.
           ✅ دلوقتي: الصلاحية = نهاية الجلسة + هامش ⭐
              ⇒ ⛔ ما تبقاش أقصر من عمر الجلسة ⭐ (وإلا ⇒ قبول صامت ⭐)
              ⇒ وبتتحذف لوحدها لما الجلسة تموت ⭐ (تنظيف ⭐). */
        const nowSec = Math.floor(Date.now() / 1000);
        const expAt = Number((body && body.expiresAt) || 0);
        let ttl = SESSION_TTL + REVOKE_TTL_MARGIN_S;
        if (expAt > 0) {
          const endSec = Math.floor(expAt / 1000) + REVOKE_TTL_MARGIN_S;
          ttl = Math.max(60, endSec - nowSec);
        }
        const expiration = nowSec + ttl;
        await this.state.storage.put(DO_REVOKE_KEY, true, { expiration });
        this._revoked = true;
        this._expiresAt = expiration * 1000;
        return json({ ok: true, revoked: true });
      } catch (e) {
        return json({ ok: false, error: "storage-write-failed" }, 500);
      }
    }

    /* ⭐ الفحص ⭐ — الرد **دايمًا** JSON ⭐ */
    if (method === "GET" && path === "/check") {
      try {
        const revoked = await this._readRevoked();
        return json({ revoked: !!revoked });
      } catch (e) {
        return json({ revoked: false, error: "storage-read-failed" }, 500);
      }
    }

    /* ⭐ المسح ⭐ (تنظيف ⭐ — اختياري ⭐) */
    if (method === "POST" && path === "/clear") {
      try {
        await this.state.storage.delete(DO_REVOKE_KEY);
        this._revoked = false;
        this._expiresAt = 0;
        return json({ ok: true, revoked: false });
      } catch (e) {
        return json({ ok: false, error: "storage-delete-failed" }, 500);
      }
    }

    return json({ ok: false, error: "not-found" }, 404);
  }

  /* ⭐ قراءة الشاهدة ⭐ — الكاش الأول ⭐ ثم `state.storage` ⭐ */
  async _readRevoked() {
    /* 🛡️ R24 (I05): ⭐ الكاش ما يقدرش يتعدّى وقت الانتهاء ⭐ */
    if (this._revoked !== null) {
      if (this._expiresAt && Date.now() >= this._expiresAt) {
        this._revoked = null;
        this._expiresAt = 0;
      } else {
        return this._revoked;
      }
    }
    const v = await this.state.storage.get(DO_REVOKE_KEY);
    const revoked = v === true || v === 1 || v === "1" || v === "true";
    this._revoked = revoked;
    return revoked;
  }
}

async function kvRevoke(env, raw) {
  if (!env.REVOKE_KV || !raw) return false;
  const k = await revokeKey(env, raw);
  if (!k) return false;
  /* 🛡️ الجولة ٢٤ (R24 · R22-I05) — TTL = العمر المتبقي + هامش ⭐
     📌 قبل: `Math.floor(SESSION_TTL / 60) + 1` = ٤٨١ ⭐ ⇒ ⛔ بس **ثواني** ⭐
        ⇒ العلامة كانت بتخلص بعد ~٨ دقايق ⭐ ⇒ ⛔ الجلسة المبطلة بترجع ⭐.
     ✅ دلوقتي: الثواني المتبقية من عمر الجلسة + ٥ دقايق هامش ⭐. */
  const ttl = revokeTtlSeconds(raw);
  try {
    await env.REVOKE_KV.put(k, "1", {
      expirationTtl: ttl,
    });
    return true;
  } catch (e) {
    return false;
  }
}

/* ⛔⛔ الجولة ٢١ (R21) — **fail-closed** ⭐
   📌 قبل كده: لو الـKV واقف ⇒ `catch` بيرجّع false ⇒ ⛔ الجلسة
      بتُقبل كأنها سليمة ⭐ ⇒ ⛔ انقطاع الخدمة = انفتاح أمني ⭐.
   ✅ الحل: ⛔ خطأ الـKV ⇒ **لا نقدر نثبت الإبطال** ⇒ ⛔ نرفض ⭐
      (fail-closed ⭐ — المبدأ: «مافيش دليل ⇒ مافيش ثقة» ⭐).
   ⭐ الرمز: `true` = الإبطال **مثبت** ⭐ · `false` = **ما فيش دليل** ⭐
      ⇒ ⭐ `null` = ⛔ تعذّر التحقق ⭐ ⇒ ⛔ نرفض ⭐. */
async function kvIsRevoked(env, raw) {
  if (!env.REVOKE_KV || !raw) return false;
  const k = await revokeKey(env, raw);
  if (!k) return null;                     // ⛔ مافيش مفاتيح ⭐ ⇒ ما نقدرش نتحقق ⭐
  try {
    return !!(await env.REVOKE_KV.get(k));
  } catch (e) {
    return null;                           // ⛔ خطأ ⇒ fail-closed ⭐
  }
}

/* 🛡️ الجولة ٢٤ (R24 · R22-I05) — حالة الإبطال في **المخزن المشترك** ⭐
   ⭐ `true`  = الإبطال **مثبت** ⭐ (جلسة متبطل ⭐).
   ⭐ `false` = **مش مبتطل** ⭐ (ثابت ⭐ ⇒ نقدر نثق ⭐).
   ⭐ `null`  = ⛔ **مش معروف** ⭐ (المخزن واقف ⭐ أو رجّع رد غلط ⭐)
     ⇒ ⛔ fail-closed ⭐ (المبدأ: «مافيش دليل ⇒ مافيش ثقة» ⭐).
   ⛔ مافيش مخزن مربوط ⭐ ⇒ `false` ⭐ (وضع الذاكرة الواحدة ⭐
      وهو **موثّق** في `/api/health` ⭐ عبر `revoke_shared` ⭐).
   📌 الترتيب ⭐: الـDO (المصدر القوي ⭐) الأول ⭐ ثم الـKV (شاهد ⭐). */
async function sharedRevokeState(env, raw) {
  if (!env || !raw) return false;
  /* ⭐⭐⭐ الجولة ٢٦ (R26) — ⭐ في الإنتاج ⭐ مصدر واحد بس بيشوف الإبطال ⭐:
     ⭐ الـDurable Object ⭐ (قراءة بعد كتابة ⭐ ⇒ مافيش نافذة ⭐).
     ⭐ ⛔ الـKV لوحده ⭐ ⇒ ⭐ قراءته ممكن تكون قديمة ⭐ ⇒ ⭐ جلسة متبطل ترجع تُقبل ⭐
     ⭐ ⇒ ⭐ في الإنتاج ⭐ ⛔ الـKV **يرفض** ⭐ بس **ما بيقدرش يقبل** ⭐. */
  const prod = isProductionEnv(env);
  if (env.REVOKE_DO) {
    /* ⛔ خطأ / رد مش مفهوم ⇒ `null` ⇒ ⛔ **fail-closed** ⭐ (مش 200 أبدًا ⭐) */
    const d = await doIsRevoked(env, raw);
    if (d === null) return null;      // ⛔ ما فيش دليل ⇒ نرفض ⭐
    if (d === true) return true;      // ⛔ إبطال مثبت ⭐
    /* ⭐⭐ شاهد الـKV ⭐⭐ — بيقدر **يرفض** ⭐ بس **ما بيقدرش يقبل** ⭐ */
    if (env.REVOKE_KV) {
      const k = await kvIsRevoked(env, raw);
      if (k === null) return null;    // ⛔ الشاهد مش معروف ⇒ نرفض ⭐
      if (k === true) return true;    // ⛔ شاهد الإبطال ⭐
    }
    return false;
  }
  if (env.REVOKE_KV) {
    const k = await kvIsRevoked(env, raw);
    if (k === null) return null;      // ⛔ ما فيش دليل ⇒ نرفض ⭐
    /* ⛔⛔⛔ الجولة ٢٦ (R26) ⭐ — ⭐ في الإنتاج ⭐ ⛔ الـKV لوحده مش دليل قبول ⭐
       📌 السبب ⭐: ⛔ قراءة الـKV **ممكن تكون قديمة** ⭐ (اتساق متأخر ⭐)
          ⇒ ⛔ جلسة اتبطلت على نسخة تانية ممكن ترجع تُقبل هنا ⭐.
       ✅ الحل ⭐: ⭐ في الإنتاج ⭐ ⇒ ⭐ الـDO هو المرجع ⭐ ⇒ ⭐ مافيش DO ⭐ ⇒ `null` ⭐
          (fail-closed ⭐ ⭐ —Fail-closed ⭐) ⭐.
       📌 خارج الإنتاج ⭐ ⇒ ⭐ السلوك القديم ⭐ (وضع النسخة الواحدة ⭐ وموثّق ⭐). */
    if (prod) return null;            // ⛔ fail-closed ⭐ (مافيش مصدر قوي ⭐)
    return k;
  }
  /* ⛔⛔⛔ الجولة ٢٦ (R26) ⭐ — ⭐ مافيش مخزن مشترك إطلاقاً ⭐
     📌 قبل ⭐: ⭐ `false` ⭐ ⇒ ⭐ ⇒ ⭐ الجلسة بتُقبل ⭐ ⇒ ⭐ ⭐ انفتاح أمني ⭐ ⭐
        (الجلسة issued في ذاكرة نسخة واحدة ⭐ ⇒ ⭐ مافيش إبطال عبر النسخ ⭐).
     ✅ الحل ⭐: ⭐ في الإنتاج ⭐ ⇒ ⭐ `null` ⭐ (fail-closed ⭐ ⇒ ⭐ مافيش قبول ⭐)
        ⭐ وخارج الإنتاج ⭐ ⇒ ⭐ الذاكرة الواحدة ⭐ (موثّق في /api/health ⭐). */
  if (prod) return null;              // ⛔ fail-closed ⭐
  return false;                       // ⛔ مافيش مخزن مشترك ⭐ (ذاكرة ⭐)
}

/* ⭐⭐⭐ الجولة ٢٦ (R26) — ⭐ جاهزية مصدر الإبطال ⭐
   📌 في الإنتاج ⭐ ⇒ ⭐ لازم الـDO ⭐ (المصدر القوي ⭐) موجود ⭐
      ⭐ ⇒ ⭐ من غيره ⭐ ⛔ ما نصدرش جلسة ⭐ ولا نقبل جلسة ⭐. */
function sessionStorageReady(env) {
  if (!env) return false;
  /* ⭐⭐⭐ الجولة ۲۶ (R26) ⭐ — ⭐ في الإنتاج ⭐ ⭐ ⛔ لازم الدو ⭐ (المصدر القوي ⭐) ⭐
     ⭐ ⭐ ⭐ وخارج الإنتاج ⭐ ⇔ ⭐ ذاكرة النسخة الواحدة ⭐ (موثقّ ⭐ ومافيش أسرار حقيقي في الإطلاق ⭐). */
  if (isProductionEnv(env)) return !!env.REVOKE_DO;
  return true;
}

/* ⭐⭐⭐ الجولة ٢٦ (R26) — ⭐ كشف الطلب من أصل خارجي ⭐ (CSRF ⭐)
   📌 المتصفحات الحديثة بتبعث `Sec-Fetch-Site` ⭐ و`Origin` ⭐.
   📌 القاعدة ⭐: ⛔ `cross-site` ⭐ ⇒ ⛔ يُرفض ⭐ (403 ⭐).
   📌 مفيش هيدرات ⭐ (client مش متصفح ⭐) ⭐ ⇒ ⭐ مسموح ⭐ (مش هجوم ⭐).
   📌 `same-origin` / `same-site` / `none` ⭐ ⇒ ⭐ مسموح ⭐. */
function isCrossSiteRequest(request, url) {
  try {
    const sfs = String(request.headers.get("Sec-Fetch-Site") || "").trim().toLowerCase();
    if (sfs && sfs !== "same-origin" && sfs !== "same-site" && sfs !== "none") return true;
    const origin = String(request.headers.get("Origin") || "").trim();
    if (origin) {
      let o = null;
      try { o = new URL(origin); } catch (e) { return true; }
      if (!url || o.host !== url.host) return true;
    }
  } catch (e) { return false; }
  return false;
}

function revokeSession(raw) {
  if (!raw) return;
  REVOKED.set(raw, Date.now() + SESSION_TTL * 1000);
  /* ⛔ تنظيف دوري (ما يكبرش الكاش) */
  if (REVOKED.size > 2000) {
    const now = Date.now();
    for (const [k, t] of REVOKED) if (t < now) REVOKED.delete(k);
  }
}

function isRevoked(raw) {
  const t = REVOKED.get(raw);
  if (!t) return false;
  if (t < Date.now()) { REVOKED.delete(raw); return false; }
  return true;
}

/* 🛡️ الجولة ١٨ — الأخطاء: رسالة عامة للمستخدم + تفصيل في لوج الـWorker فقط */
const ERR_UPSTREAM = "تعذّر الوصول للسيرفر — جرّب تاني بعد شوية";
const ERR_AUTH = "لازم تسجيل دخول";

/* 🛡️ الجولة ١٨ — الأصول العامة (من غير جلسة).
   ⛔ مافيش هنا غير صفحة الدخول — ⛔ مافيش أي صفحة فيها بيانات. */
/* 🛡️🛡️ الجولة ٢٥ (R25 · المرحلة ٣) — صفحات الدخول **كل** مساراتها ⭐
   📌 السبب ⭐: راوتر الأصول (html_handling) بيعيد توجيه `/login.html` ⭐
      ⇒ `/login.html/` ⭐ ⇒ ⛔ والعامل مش بيعدّيه public ⭐ ⇒ ⛔ حلقة تحويل ⭐
      ⇒ ⛔ المالك مش بيقدر يدخل اللوحة ⭐.
   ✅ الحل ⭐: كل صيغ المسار public ⭐ (مع/بدون لاحقة / · وبالنقطتين ⭐). */
const PUBLIC_FILES = new Set([
  "/login.html", "/login.html/",
  "/icons/favicon.png",
]);

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
    if (i <= 0) return;
    const k = p.slice(0, i).trim();
    const v = p.slice(i + 1).trim();
    if (!k) return;
    /* 🛡️ الجولة ١٩ (R18-A04) — كوكي بترميز غير صالح (مثل %ZZ) كان
       بيسبب استثناء غير معالج ⇒ 500. دلوقتي: نتجاهل الكوكي الغلط
       ⇒ المتصفح بياخد 401 مضبوط (مش خطأ سيرفر). */
    try { out[k] = decodeURIComponent(v); }
    catch (e) { /* ⛔ كوكي تالف ⇒ نتجاهله */ }
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
/* ⭐⭐⭐ الجولة ٢٦ (R26) — ⭐ وسم الاعتماد ⭐
   📌 السبب ⭐: ⛔ تغيير كلمة المرور ⭐ كان **مش** بيبطل الجلسات القائمة ⭐
      (⭐ الجلسة مربوطة بسر التوقيع ⭐ بس ⭐ ⭐ ⇒ أي جلسة قديمة كانت بتفضل صالحة ⭐ ⭐).
   ✅ الحل ⭐: ⭐ التوقيع يشمل بصمة كلمة المرور ⭐ ⇒ ⭐ تغييرها ⭐ ⛔ يبطل كل الجلسات ⭐
      (⭐ من غير ما نلمس SESSION_SECRET ⭐ ⭐ — وده بيبطل الكل ⭐). */
async function credentialTag(env) {
  const pw = String((env && env.APP_PASSWORD) || "");
  if (!pw) return "";
  try { return (await sha256(pw)).slice(0, 16); } catch (e) { return ""; }
}

async function makeSession(secret, env) {
  const exp = String(Date.now() + SESSION_TTL * 1000);
  const sig = await sign(exp + "." + (await credentialTag(env)), secret);
  return `${exp}.${sig}`;
}

async function validSession(req, secret, env) {
  /* 🛡️ من غير سر ⇒ مافيش جلسة صالحة أبداً (لا ت trusting for undefined) */
  if (!secret) return false;
  const raw = parseCookies(req)[COOKIE];
  if (!raw) return false;
  /* 🛡️🛡️🛡️ الجولة ٢٤ (R24 · R22-I06) — التوقيع + الانتهاء **قبل** أي نداء للتخزين ⭐
     📌 قبل: الفحص كان بينادي الـDO/الـKV **قبل** ما يتحقق من التوقيع ⭐
        ⇒ ⛔ أي كوكي مزوّر أو منتهٍ كان بيوصل للمخزن ⭐
        (استنزاف ⭐ + تسريب ⭐ + نافذة ⭐).
     ✅ دلوقتي: ⛔ نداء **غير مصرّح به** ما بيوصلش للتخزين **أصلاً** ⭐.
     📌 ترتيب الخطوات ⭐: ① التوقيع ② الانتهاء ③ الإبطال ④ المخزن المشترك ⭐. */
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return false;
  const exp = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!/^\d+$/.test(exp)) return false;             // ⛔ شكل غير صالح ⭐
  if (Number(exp) < Date.now()) return false;       // ⛔ جلسة منتهية ⭐
  /* ⭐⭐⭐ الجولة ٢٦ (R26) ⭐ — التوقيع يشمل وسم الاعتماد ⭐
     ⭐ ⇒ ⭐ تغيير كلمة المرور ⭐ ⛔ يرفض كل الجلسات القديمة ⭐. */
  const expect = await sign(exp + "." + (await credentialTag(env)), secret);
  if (!timingSafeEqual(sig, expect)) return false;  // ⛔ توقيع غلط ⭐
  /* ⛔ دلوقتي بس ⇒ نتفرج على الإبطال ⭐ */
  /* 🛡️ الجولة ١٩ (R18-A01) — جلسة مُبطلة من جهة السيرفر ⇒ مرفوضة */
  if (isRevoked(raw)) return false;
  /* 🛡️ الجولة ٢٠/٢١/٢٢ — الإبطال عبر النسخ ⭐
     ⭐ المصدر القوي = الـDurable Object ⭐ (قراءة بعد كتابة ⭐ ⇒ مافيش نافذة ⭐)
     ⭐ والـKV شاهد احتياطي ⭐
     ⛔ `null` (مش معروف ⭐) ⇒ ⛔ **fail-closed** ⭐ (مش 200 أبدًا ⭐). */
  const state = await sharedRevokeState(env, raw);
  if (state !== false) return false;   // true ⭐ = متبطل ⭐ · null ⭐ = مش معروف ⭐ ⇒ ⛔ نرفض ⭐
  return true;
}

/* 🛡️ الجولة ١٩ (R18-A01) — التدوير: جلسة جديدة قبل الانتهاء بساعتين.
   ⛔ النسخة المنسوخة ما بتتجدّدش (المتصفح بس بياخد الكوكي الجديد). */
async function sessionRenewHeader(req, secret, env) {
  if (!secret) return {};
  const raw = parseCookies(req)[COOKIE];
  if (!raw || isRevoked(raw)) return {};
  /* 🛡️🛡️ الجولة ٢٤ (R24 · R22-I05) — التدوير لازم يسأل المخزن المشترك ⭐
     📌 قبل: التدوير كان بيعتمد على الذاكرة local بس ⭐ ⇒ ⛔ جلسة اتبطلت
        على نسخة تانية كانت **بتتجدّد** هنا ⭐ (fail-open ⭐ ⭐).
     ✅ دلوقتي: ⛔ لو حالة الإبطال **مش معروفة** ⭐ ⇒ ⛔ مفيش تجديد ⭐
        (fail-closed ⭐) ⭐ و ⛔ لو متبطل ⭐ ⇒ ⛔ مفيش تجديد ⭐. */
  const state = await sharedRevokeState(env, raw);
  if (state !== false) return {};   // true ⭐ = متبطل ⭐ · null ⭐ = مش معروف ⭐ ⇒ ⛔ مفيش تجديد ⭐
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return {};
  const exp = Number(raw.slice(0, dot));
  if (!exp || !isFinite(exp)) return {};
  if (exp - Date.now() > RENEW_BEFORE * 1000) return {};
  const sess = await makeSession(secret, env);
  return {
    "Set-Cookie": `${COOKIE}=${encodeURIComponent(sess)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`,
  };
}

/* 🛡️ الجولة ١٩ (R18-A02) — الأصول المحمية ⇒ **no-store/private**.
   ⛔ قبل كده: ردّ الـASSETS كان بيعدّي كما هو ⇒ «Cache-Control: public» ⇒
      متصفّح/وسيط مشترك ممكن يخزّن لوحة الإدارة في كاش مشترك. */
function protectedResponse(res) {
  try {
    const h = new Headers(res.headers);
    h.set("Cache-Control", "no-store, private");
    h.set("Pragma", "no-cache");
    h.set("Vary", "Cookie");
    return new Response(res.body, {
      status: res.status, statusText: res.statusText, headers: h,
    });
  } catch (e) {
    /* ⛔ لو مش قادرين نلفّ ⇒ نرجّع 401 بدل ما نسيب رد بلا كاش-كونترول */
    return json({ ok: false, error: ERR_AUTH }, 401);
  }
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
        const authed = await validSession(request, env.SESSION_SECRET, env);
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
        /* ⭐⭐⭐ الجولة ٢٦ (R26) — ⛔ في الإنتاج ⭐ ما نصدرش جلسة ⭐
           📌 السبب ⭐: ⛔ جلسة من غير مصدر إبطال مشترك ⭐ = ⭐ جلسة ما تتبطالش ⭐
              عبر النسخ ⭐ ⇒ ⭐ ⭐ انفتاح أمني ⭐ ⭐.
           📌 خارج الإنتاج ⭐ ⇒ ⭐ مسموح ⭐ (وضع التطوير ⭐ وموثّق ⭐). */
        if (!sessionStorageReady(env)) {
          console.error("[octa-mgmt] login: revocation source not ready",
            { production: isProductionEnv(env) });
          return json({
            ok: false,
            error: "مصدر الإبطال غير متاح — الدخول مقفول مؤقتاً",
            revocation_source: "unavailable",
          }, 503);
        }
        const sess = await makeSession(env.SESSION_SECRET, env);
        return json({ ok: true }, 200, {
          "Set-Cookie": `${COOKIE}=${encodeURIComponent(sess)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`,
        });
      }

      /* ── خروج ── */
      if (path === "/api/logout" && request.method === "POST") {
        /* ⭐⭐⭐ الجولة ٢٦ (R26) — ⛔ CSRF ⭐
           📌 المسار بيقبل POST ⭐ ⇒ ⛔ طلب من موقع تاني ممكن يخلّي المستخدم يخرج ⭐
              (و ⛔ مع SameSite=Strict ⭐ المتصفح مش بيبعت الكوكي ⭐ ⇒ ⭐ الأثر محدود ⭐
              ⭐ بس ⭐ ⭐ الخطأ ده ⭐ ⭐ بنقفله ⭐ ⭐).
           ✅ الحل ⭐: ⭐ طلب من أصل خارجي ⭐ ⛔ 403 ⭐ (ومفيش نداءات للتخزين ⭐). */
        if (isCrossSiteRequest(request, url)) {
          return json({ ok: false, error: "طلب من أصل خارجي — اترفض" }, 403);
        }
        const _clear = {
          "Set-Cookie": `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
        };
        const _raw = parseCookies(request)[COOKIE];
        /* 🛡️🛡️ R25 (R24-I11) — التحقق **قبل** أي نداء للتخزين ⭐
           ⛔ كوكي مزوّر/مشوّه ⇒ ⛔ صفر نداءات ⭐ (لا استنزاف ⭐ ولا نمو ⭐). */
        const _check = await verifyCookie(_raw, env.SESSION_SECRET, env);
        if (_raw && !_check.ok) {
          console.error("[octa-mgmt] logout: cookie rejected before storage",
            { reason: _check.reason });
          return json({
            ok: false,
            error: "جلسة غير صالحة",
            revoked_shared: false,
          }, 401, _clear);
        }
        /* ⭐ جلسة منتهية ⭐ ⇒ ⛔ مفيش حاجة تتبطل ⭐ ⇒ ⛔ صفر نداءات ⭐
           ⭐ (والخروج صح ⭐ ⇒ الجلسة كانت ميتة أصلاً ⭐). */
        if (_raw && _check.expired) {
          revokeSession(_raw);
          return json({ ok: true, revoked_shared: false, revocation: "not-needed" }, 200, _clear);
        }
        /* ⛔ مافيش كوكي ⭐ ⇒ ⛔ مفيش جلسة تتبطل ⭐ ⇒ نجاح بصفر نداءات ⭐ */
        if (!_raw) {
          return json({ ok: true, revoked_shared: false, revocation: "not-needed" }, 200, _clear);
        }
        /* ⛔ الذاكرة المحلية ⭐ (نفس النسخة ⭐) */
        revokeSession(_raw);
        const _hasDo = !!env.REVOKE_DO;
        const _hasKv = !!env.REVOKE_KV;
        const _prod = isProductionEnv(env);
        /* 🛡️🛡️ R25 (R24-I10) — غياب المخزن المشترك ⭐
           📌 الذاكرة المحلية **مش** حماية كافية عبر نسخ الـWorker ⭐
              (النسخة التانية مش هتشوف الإبطال ⭐ ⇒ كوكي منسوخ يفضل شغال ⭐).
           ⛔ في الإنتاج ⇒ ⛔ fail-closed ⭐ (مافيش مصدر ⇒ مافيش إعلان نجاح ⭐). */
        if (!_hasDo && !_hasKv) {
          if (_prod) {
            console.error("[octa-mgmt] logout: no shared revocation source (production)");
            return json({
              ok: false,
              error: "مصدر الإبطال غير متاح — الخرج اتقفل",
              revoked_shared: false,
            }, 503, _clear);
          }
          /* ⛔ بيئة غير إنتاج ⭐ ⇒ الذاكرة بس ⭐ (وموثّق ⭐) */
          return json({
            ok: true, revoked_shared: false, scope: "single-instance",
            revocation: "memory-only",
          }, 200, _clear);
        }
        /* 🛡️🛡️ R25 (R24-I09) — **المصدر المتسق هو المرجع** ⭐
           📌 العيب المقاس ⭐: فشل الـDO + نجاح الـKV ⇒ الرد كان `{ok:true}` ⭐
              ⇒ ⛔ **نجاح وهمي** ⭐ (الإبطال الفوري مش مثبت ⭐).
           ✅ دلوقتي ⭐: لو الـDO مربوط ⇒ لازم **هو** يأكّد (قراءة بعد كتابة ⭐)
              ⇒ ⛔ نجاح الـKV وحده **مش** دليل ⭐ ⇒ ٥٠٣ ⭐. */
        const _do = _hasDo ? await doRevoke(env, _raw) : false;
        const _kv = _hasKv ? await kvRevoke(env, _raw) : false;
        if (_hasDo && !_do) {
          console.error("[octa-mgmt] logout: authoritative source did not confirm",
            { do: _do, kv: _kv });
          return json({
            ok: false,
            error: "تعذّر إبطال الجلسة على كل النسخ — جرّب تاني",
            revoked_shared: false,
          }, 503, _clear);
        }
        if (!_hasDo && !_kv) {
          /* ⛔ الـKV متاح بس الكتابة فشلت ⭐ ⇒ ⛔ مافيش دليل ⭐ ⇒ ٥٠٣ ⭐ */
          console.error("[octa-mgmt] logout: KV witness write failed");
          return json({
            ok: false,
            error: "تعذّر إبطال الجلسة على كل النسخ — جرّب تاني",
            revoked_shared: false,
          }, 503, _clear);
        }
        /* ⭐ الـKV وحده ⭐ ⇒ ⛔ **مش إبطال فوري** ⭐ ⇒ بنقول كده بصراحة ⭐
           ⭐ (بنتأكد بالقراءة ⭐ ⇒ confirmed ⭐ / eventual ⭐). */
        if (!_hasDo) {
          const _seen = (await kvIsRevoked(env, _raw)) === true;
          return json({
            ok: true,
            revoked_shared: true,
            revocation: _seen ? "confirmed" : "eventual",
            immediate: _seen,
          }, 200, _clear);
        }
        /* ⭐ الـDO أكّد ⭐ ⇒ إبطال فوري ⭐ */
        return json({
          ok: true,
          revoked_shared: true,
          revocation: "strong",
          immediate: true,
        }, 200, _clear);
      }

      /* ── حالة الجلسة ── */
      if (path === "/api/session") {
        const ok = await validSession(request, env.SESSION_SECRET, env);
        return json(ok ? { ok: true, ts: Date.now() } : { ok: false }, ok ? 200 : 401);
      }

      /* ── حالة الوسيط ──
         ⛔ الجولة ١٨: ⛔ مافيش عنوان الـbackend ولا أسماء متغيّرات — booleans بس. */
      if (path === "/api/health") {
        return json({
          ok: true,
          has_admin: !!env.OCTA_ADMIN_TOKEN,
          has_password: !!env.APP_PASSWORD,
          /* 🛡️ الجولة ٢٠ (R20) — ⛔ booleans بس (مافيش أي اسم متغيّر) ⬇️
             ⭐ `revoke_shared` = الإبطال بيشتغل عبر أكتر من نسخة ⭐
             ⛔ `false` ⇒ الإبطال في الذاكرة بس ⇒ نسخة واحدة ⭐ */
          revoke_shared: !!(env.REVOKE_DO || env.REVOKE_KV),
          revoke_strong: !!env.REVOKE_DO,
          /* ⭐⭐⭐ الجولة ٢٦ (R26) ⭐ — ⭐ جاهزية مصدر الإبطال ⭐
             ⭐ `revocation_ready` ⭐ = ⭐ في الإنتاج ⭐ لازم الـDO ⭐ موجود ⭐
             ⭐ (⭐ من غيره ⭐ ⛔ مافيش قبول جلسة ⭐ ⛔). */
          revocation_ready: sessionStorageReady(env),
        });
      }

      /* ── ⭐ تفضيلات المستخدمين: الأسهم اللي بيتابعها كل واحد ──
         ⛔ الـadmin token مش بيوصلش للمتصفح ⇒mint_session + alerts/watch
         كلهم من السيرفر. الكاش ٣٠ دقيقة (البيانات مش بتتغير كل ثانية).
         ⛔ الجولة ١٨: ⛔ التحقق من الجلسة *قبل* أي طلب للباك. */
      if (path === "/api/prefs") {
        const authed = await validSession(request, env.SESSION_SECRET, env);
        if (!authed) return json({ ok: false, error: ERR_AUTH }, 401);
        if (!env.OCTA_ADMIN_TOKEN) return json({ ok: false, error: "التوكن غير مهيّأ" }, 500);
        try {
          const items = await fetchPrefs(env);
          const cached = !!(PREFS_CACHE && Date.now() - PREFS_CACHE.ts < 1800000);
          /* ⛔ R18-A01: تدوير الجلسة أثناء الاستخدام (الكوكي الجديد للمتصفح بس) */
          const renew = await sessionRenewHeader(request, env.SESSION_SECRET, env);
          return json({ ok: true, cached: cached ? 1 : 0, users: items }, 200, renew);
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
        const authed = await validSession(request, env.SESSION_SECRET, env);
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
          /* ⛔ المسار لسه مش موجود على السيرفر ⇒ 204 (مش خطأ — ميزة مستقبلية)
             ⛔ R18-A05: الـ204 لازم يكون **من غير body** — الـconstructor بيرمي
                استثناء لو فيه نص ⇒ الرد كان بيرجع 502 بدل حالة "غير موجود". */
          if (up.status === 404 || up.status === 405) {
            return new Response(null, {
              status: 204,
              headers: { "X-OCTA-Missing": "1", "Cache-Control": "no-store" },
            });
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
      const authed = await validSession(request, env.SESSION_SECRET, env);
      if (!authed) {
        if (wantsHtml(request)) return loginRedirect(url);
        return json({ ok: false, error: ERR_AUTH }, 401);
      }
    }

    /* ⛔ لازم يبقى index.html للروابط الداخلية (SPA) */
    const res = await env.ASSETS.fetch(request);
    /* 🛡️ الجولة ١٩ (R18-A02) — كل أصل محمي ⇒ no-store/private
       (⛔ الرد كان بيعدّي «Cache-Control: public» ⇒ كاش مشترك ممكن). */
    if (res.status === 404 && request.method === "GET" &&
        !url.pathname.includes(".") && !url.pathname.startsWith("/api/")) {
      const shell = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
      if (shell && shell.status < 400) return protectedResponse(shell);
    }
    return protectedResponse(res);
  },
};

export { RevokeDO };
