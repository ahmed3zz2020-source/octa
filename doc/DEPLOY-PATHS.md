# 📋 خريطة النشر — OCTA (١٥ نوفمبر ٢٠٢٦)

> ⛔ **القاعدة:** كل نشر على الإنتاج (`octashares.com`) لازم عبارة صريحة: **«ارفع على الدومين»**.
> ⛔ **الافتراضي هو المعاينة.** مافيش استثناء.

---

## ① البيئات الثلاث

| البيئة | ا��عنصر | الكود | الباك | الدخول |
|---|---|---|---|---|
| **المعاينة** | `octa-preview.ahmed3zz2020.workers.dev` | `octa` فرع `security/batch-01` | ⛔ **Staging معزول** (محلي + نفق) | صاحب الحساب |
| **الإنتاج** | `octashares.com` | `octa` فرع `main` | `octa-prices` على Railway | الزوار |
| **Staging** | رابط `trycloudflare` (مؤقّت) | نفس كود المعاينة | ⛔ بيانات وهمية ١٠٠٪ | المالك + الاختبارات |

---

## ② مسار النشر (مين يعمل إيه)

### أ) الواجهة (Cloudflare Workers)
```bash
cd /workspace/repos/octa
npm run build                 # بيبني dist + يختم النسخة (version.json)
bash tools/deploy.sh preview  # ⭐ المعاينة (wrangler.jsonc) — دايماً
bash tools/deploy.sh prod     # ⛔ الإنتاج — محتاج «ارفع على الدومين»
```
- ⛔ `tools/deploy.sh` بيستخدم `--config` **صريح** ⇐ ما فيش نشر بالغلط من مجلد فرعي.
- ⛔ الـdeploy بيعمل **فحص حيّ** (٤ محاولات × ٨ ثواني + cache-buster) ⇒ لو فشل ⇒ **تراجع تلقائي** ✅.
- ⛔ **الفرق الوحيد بين المعاينة والإنتاج = `name`** (المirea في `wrangler.jsonc` · الإنتاج في `wrangler-prod.jsonc`).
- 🆕 **Batch 02**: `OCTA_FAIL_CLOSED=on` في **المعاينة بس** ⇒ لو `OCTA_API_URL` ناقص ⇒ 503 صريح بدل الرجوع للإنتاج.

### ب) الباك (Railway)
| الحالة | التفاصيل |
|---|---|
| ⛔ **ممنوع** | أي push على `main` من غير إذن (خطر نشر إنتاجي) |
| ⛔ **ممنوع** | `railway up` / `railway redeploy` على خدمة الإنتاج |
| ✅ **المسموح** | commits محلية على فرع + patch للتسليم |
| ⚠️ | النشر اليدوي للخدمة بيحتاج توكن API مصرّح (غير متاح حالياً) |

### ج) Staging (الباك المحلي)
```bash
cd /workspace/repos/octa-prices
bash tools/staging/run_all.sh     # باك + نفق + ربط secrets المعاينة
bash tools/staging/run_all.sh --stop
```
- ⛔ بيلمس `octa-preview` **بس** — مافيش سطر بيلمس `octa` (الإنتاج).
- ⛔ الأسرار في `/workspace/.staging-secrets.json` (بره مجلد الداتا) ⇒ **ثابتة** بين التشغيلات.

---

## ③ سر الـedge (X-OCTA-Proxy)

| الحاجة | المكان | ملاحظة |
|---|---|---|
| السر | Cloudflare **secret** على `octa-preview` + متغيّر بيئة في الباك | ⛔ **مش** في الريبو |
| ⚠️ | بعد أي rollback | تعديل سر السكربت بيتقفل (Cloudflare `10215`) ⇒ الحل: خلّي السر ثابت أو `wrangler versions deploy` الأول |
| ⛔ | الإنتاج | `OCTA_PROXY_SECRET` غير مضبوط ⇒ الباك مكشوف مباشرة (موثّق كـ«مخاطرة متبقية») |

---

## ④ عزل الـKV

| الـKV | العامل | البيانات |
|---|---|---|
| `HALAN_KV` | `halan-feed` (عامل منفصل) | أخبار هالان (بيانات عامة) |
| — | `octa-preview` | ⛔ مافيش KV إلا `HALAN_KV` ⇐ نفس，الإنتاج ⬇️ |

⚠️ **ملاحظة isolation:** `HALAN_KV` **مش** فيه بيانات مستخدمين — بس نفس الاسم موجود في المعاينة والإنتاج ⇐ أي كتابة عليه من المعاينة **تظهر** في الإنتاج ⬇️ (الإصلاح المقترح: KV منفصل للمعاينة `octa-preview-kv` — تكلفة: صفر).

---

## ⑤ الـCI

| الملف | بيشغّل إيه | ملاحظة |
|---|---|---|
| `.github/workflows/ci.yml` (الباك) | فحص syntax + أنماط (`...`) | ⛔ بيشتغل على `main` و`pull_request` بس |
| `npm test` (الواجهة) | `node --test assets/tests/*.test.js` | ٣٠٩ اختبار ✅ |
| `test_security_batch01.py` | ٦٦ اختبار | ⛔ **مش** في الـCI (محتاج env معزول) |
| `test_security_batch02.py` | ٦٢ اختبار | ⛔ نفس |
| `test_security_p0.py` | ٣٤ اختبار | ⛔ نفس |

⭐ **مقترح (يحتاج موافقة):** إضافة الـCI على فرع `security/*` مع بيئة معزولة (`OCTA_DATA_DIR` مؤقت + أسرار `TEST-ONLY-*`) ⇒ يبقى كل commit بيختبر نفسه.

---

## ⑥ checklist قبل أي نشر إنتاجي

1. ⛔ «ارفع على الدومين» مكتوبة في المحادثة.
2. ⛔ `git log --oneline -1` ⇒ الـSHA اللي هيتنشر.
3. ⛔ `bash tools/deploy.sh prod` (الافتراضي = preview ⬇️ ⇒ لازم `--prod` صريح).
4. ✅ الفحص الحيّ نجح (٤ محاولات + cache-buster).
5. ✅ `curl -s https://octashares.com/api/health` ⇒ `app_writable=true` + `gemini=configured` (إنتاج ✅).
6. ✅ قياس الموبايل (390px): البوابة + صفحة سهم + منبهات.
