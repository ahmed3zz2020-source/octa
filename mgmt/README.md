# 📊 OCTA-MGMT — تقرير الزوار (تطبيق دائم)

لوحة تحكم ويب قابلة للتثبيت (PWA) بتجيب داتا OCTA الحية **مباشرة من السيرفر**،
وتشتغل أوفلاين، وبتحدّث نفسها لوحدها.

**🔗 اللينك الدائم:** https://octa-mgmt.ahmed3zz2020.workers.dev

---

## 🏗️ البنية

```
octa-mgmt/
├── worker.js              🛡️ الوسيط الآمن (Cloudflare Worker)
├── wrangler.jsonc         ⚙️ إعدادات النشر
├── build_app.py           🔧 باني صفحة التطبيق
└── public/
    ├── index.html         📊 لوحة التحكم (٩ أقسام)
    ├── app.js             📱 طبقة التطبيق (دخول · تحديث · إعدادات · SW)
    ├── sw.js              🔄 Service Worker (أوفلاين + تحديث تلقائي)
    ├── manifest.webmanifest  📦 بيانات التثبيت (PWA)
    └── icons/             🎨 الأيقونات (192 · 512 · maskable)
```

**مسار البيانات:**

```
المتصفح  ──►  octa-mgmt Worker  ──►  Railway API
               (يضيف X-OCTA-Admin)      /api/admin/monthly
               (يخزّن التوكن سري)         /api/admin/users
                                          /api/admin/logins
```

⛔ **التوكن ما بيوصلش المتصفح أبداً** — بيفضل جوه الـWorker كـsecret.
⛔ المتصفح مبيعرفش رابط السيرفر غير لما يسجّل دخول بكلمة مرور.

---

## 🔐 الأسرار (كلها في Cloudflare — مش في الكود)

| الاسم | الوصف | فين تتغير |
|---|---|---|
| `OCTA_ADMIN_TOKEN` | توكن الأدمن (يحقن في الطلبات للسيرفر) | `wrangler secret put OCTA_ADMIN_TOKEN` |
| `APP_PASSWORD` | كلمة مرور الدخول للتطبيق | `wrangler secret put APP_PASSWORD` |
| `SESSION_SECRET` | مفتاح توقيع كوكي الجلسة | `wrangler secret put SESSION_SECRET` |

```bash
# تغيير كلمة المرور (٣٠ ثانية):
cd octa-mgmt
printf '%s' 'كلمة-المرور-الجديدة' | npx wrangler secret put APP_PASSWORD
```

---

## 🚀 النشر

```bash
cd octa-mgmt
npx wrangler secret put OCTA_ADMIN_TOKEN   # مرة واحدة
npx wrangler secret put APP_PASSWORD       # مرة واحدة
npx wrangler secret put SESSION_SECRET     # مرة واحدة
npx wrangler deploy
```

بعد النشر غيّر `VERSION` في `public/sw.js` عشان الأجهزة تاخد النسخة الجديدة.

---

## 🔄 التحديث التلقائي

1. **الداتا:** كل ٥ دقايق (قابل للتغيير من «الإعدادات» داخل التطبيق) + عند رجوعك للتاب.
2. **نفس التطبيق:** الـService Worker بيعمل `updatefound` ⇒ يظهر تنبيه «فيه تحديث جديد» ⇒ ضغطة واحدة.
3. **المسار المستقبلي:** لو `/api/admin/events` اتنفّذ على السيرفر، التطبيق **هيعرضه لوحده**
   من غير أي نشر — مش محتاج تاني.

---

## 🛡️ الحماية

| الطبقة | التفاصيل |
|---|---|
| كلمة مرور | ٨ محاولات / ١٥ دقيقة لكل IP |
| كوكي جلسة | موقّع HMAC · HttpOnly · Secure · SameSite=Strict · ٨ ساعات |
| توكن الأدمن | ما بيخرجش من الـWorker خالص |
| المسارات | `/api/proxy` بيقبل `/api/admin/*` بس — ⛔ مفيش SSRF |

---

## 📚 الأقسام

1. **الملخص** — ٨ مؤشرات
2. **مين دخل** — ١٣ مستخدم بكل التفاصيل (قابل للترتيب + تفاصيل لكل واحد)
3. **الخط الزمني** — كل عملية دخول بالتوقيت بالثانية (فلترة بالاسم/الطريقة/الجهاز)
4. **الأجهزة والـIP** — ١٦ بصمة · ٦ عناوين
5. **السلوك** — التوزيع بالساعات والأيام + الصفحات + أنواع الأحداث
6. **القمع** — من الزيارة للولاء
7. **الفجوات** — ٦ مشاكل موثّقة + الحل جاهز لكل واحدة
8. **السجل الخام** — يظهر تلقائياً أول ما `/api/admin/events` يتنفّذ

---

## ⚖️ الأرقام محسوبة إزاي

- **الجلسة** = فجوة > ٤٥ دقيقة بين عمليتي دخول
- **آخر جلسة** = من لحظة الدخول لآخر نشاط مسجّل (مقيسة)
- **إجمالي الوقت** = مجموع الجلسات (حد أعلى تقريبي)
- **أحداث بلا uid** = أحداث الـ`page_view` اللي مالها `uid` (السبب: `OCTA_USER_ID` بيتحدد مرة واحدة بعد الدخول ⇒ الـrefresh بيمسحه)

---

## 🛡️ الجولة ٢٣ (R23) — الإبطال القوي + حزمة الاحتواء

> ⛔ **الحالة: كود جاهز ⭐ — ومتنشرش ⭐** ⛔ مافيش نشر ⛔ مافيش مورد اتعمل ⭐
> **الحزمة الكاملة:** `/workspace/output/OCTA-ROUND23-CONTAINMENT/` ⭐

### ① إيه الجديد في الكود

| الملف | إيه اللي فيه |
|---|---|
| `mgmt/worker.js` | صنف `RevokeDO` ⭐ — مخزن **مشترك** و**متسق بقوة** ⭐ (قراءة بعد كتابة ⭐ ⇒ مافيش نافذة ⭐) + `doRevoke()` / `doIsRevoked()` ⭐ |
| `mgmt/wrangler.jsonc` | الـbinding `REVOKE_DO` ⭐ + الـmigration `v1` (`new_sqlite_classes`) ⭐ |
| `assets/tests/r23-do-integration.test.js` | ⭐ **اختبار متكامل** ⭐ (مش وحدات ⭐) — خروج حقيقي على نسخة A بيُبطل الجلسة فورًا على نسخة B ⭐، مع **KV متأخر** ⭐، و**fail-closed** ⭐ |

⛔ **الإبطال القوي (الـDO) مش مطلوب لصحة السلوك** ⭐ — الـKV fallback كافي ⭐
والفرق الوحيد **نافذة ≈٦٠ ثانية** ⭐ (موثّقة في `mgmt/worker.js` ⭐).

### ② تشغيل الاختبار (محلي ⭐ — مافيش شبكة ⭐ مافيش حساب ⭐)

```bash
cd /workspace/.wt_r18fe
node --test assets/tests/r23-do-integration.test.js
# ✅ ٧ نجح · ٠ فشل · exit 0
```

**البرهان السالب** (نفس الملف على نسخة **قبل** الـDO ⭐):

```bash
OCTA_MGMT_WORKER=/workspace/output/OCTA-ROUND23-CONTAINMENT/evidence/pre-do-worker.js \
  node --test assets/tests/r23-do-integration.test.js
# ⛔ ٤ نجح · ٣ فشل · exit 1
```

### ③ النشر (⛔ المالك هو اللي يوافق ⭐)

```bash
cd /workspace/.wt_r18fe/mgmt
npx wrangler deploy --config wrangler.jsonc
```

⛔ **دايماً من جوه `mgmt/`** ⭐ — تاريخ المشروع: `wrangler deploy` من غير
`--config` سبّب ٤ نشرات على الإنتاج في ٥٢ ثانية ⭐.

**بعد النشر:**

```bash
curl -sS "https://octa-mgmt.ahmed3zz2020.workers.dev/api/health" | python3 -m json.tool
# ⇒ revoke_shared: true  ·  revoke_strong: true
```

**التكلفة:** ٠ دولار ⭐ (داخل الحد المجاني ⭐).

### ④ الرجوع (⛔ من غير ما تفتح حاجة ⭐)

شيل الـ`REVOKE_DO` binding من `mgmt/wrangler.jsonc` ⭐ و**سيب الـmigration**
⭐ (حذف migration بيكسّر النشر الجاي ⭐) ⭐ ⇒ انشر تاني ⭐ ⇒ النتيجة:
**fallback على الـKV** ⭐ بنافذة ≈٦٠ ثانية ⭐.

⛔ **ما تمسحش** تطبيق Access ⭐ ولا قاعدة WAF ⭐ — دول في طبقة Cloudflare
مش في الكود ⭐ (التفصيل في `ROLLBACK.md` ⭐).

### ⑤ ⚠️ حالة الـworker المنشور

النسخة المنشورة دلوقتي (قياس ٢٠٢٦-١١-١٨ ⭐) عندها `APP_PASSWORD` ⭐
و`OCTA_ADMIN_TOKEN` ⭐ و`SESSION_SECRET` ⭐ بس — **مافيش** `REVOKE_KV` ⭐
ولا `REVOKE_DO` ⭐.

⇒ **إبطال كل الجلسات دلوقتي = تدوير `SESSION_SECRET`** ⭐ (الكوكي موقّع
عليه ⭐) ⭐ — والتفاصيل والترتيب في `SESSION-ROTATION.md` ⭐.

⛔ ولوحة الإدارة كانت **بتُخدَم لزائر مجهول** (`200` ⭐) ⇒ لازم Cloudflare
Access على `octa-mgmt.ahmed3zz2020.workers.dev` ⭐ — التسلسل في `ACCESS.md` ⭐.
