# 🚀 دليل التحويل للمعاينة ⇒ الدومين (١٤ نوفمبر ٢٠٢٦)

> **الهدف:** رابط المعاينة `octa-preview.ahmed3zz2020.workers.dev` **هو** الدومين
> بالظبط — نفس الكود، نفس الإعدادات، نفس البيانات. فلمّا تقول
> «ارفع على الدومين» يبقى النشر **سطر واحد** والباقي مُقاس.

---

## ① المبدأ: المعاينة والدومين متطابقين ١٠٠٪

| البند | المعاينة | الدومين | ملاحظة |
|---|---|---|---|
| كود الـWorker | `worker.js` (نفس الملف) | نفس الملف | ⛔ مفيش نسخة تانية |
| `wrangler.jsonc` | `name: octa-preview` | `name: octa` (في `wrangler-prod.jsonc`) | **الاسم فقط** الفرق |
| `vars` | ٦ متغيرات متطابقة | نفس الستة | ⛔ مفيش `OCTA_SLOWTEST` في أيّ منهما |
| ربط `HALAN_KV` | ✅ | ✅ | نفس الـnamespace |
| `triggers.crons` | `*/5 * * * *` | `*/5 * * * *` | إيقاظ السيرفر |
| الأصول | نفس `dist/` | نفس `dist/` | ⛔ `build:strict` دايماً |

⭐ **فحص التطابق (قبل أي نشر):**
```bash
python3 - <<'PY'
import re, json
def cfg(p):
    s = open(p, encoding='utf-8').read()
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    d = json.loads(s)
    return {k: v for k, v in d.items() if k not in ('name',)}
a = cfg('wrangler.jsonc'); b = cfg('wrangler-prod.jsonc')
print('متطابقين؟', a == b)
if a != b:
    for k in set(a) | set(b):
        if a.get(k) != b.get(k): print('  فرق في', k, '→', a.get(k), '≠', b.get(k))
PY
```

---

## ② الشرط الوحيد: موافقة صريحة

⛔ **مفيش نشر على الإنتاج من غير العبارة دي حرفياً:**
```
PUBLISH_PROD="ارفع على الدومين" bash tools/deploy.sh prod
```

اللي بيحصل جوّه `tools/deploy.sh prod`:
1. 🔒 يقفل لو العبارة مش موجودة (كود خروج ١).
2. 🎯 بيتأكد إن `wrangler-prod.jsonc` اسمه `octa` فعلاً.
3. 🔐 بيتأكد إن الإنتاج **ما عندوش** أسرار Halan (دي في `halan-feed` بس).
4. 🔨 `npm run build:strict`.
5. 🚀 `wrangler deploy --config wrangler-prod.jsonc`.
6. ✅ **فحص حيّ**: `/` · `/api/health` · `/api/rank` + الصفحة فيها سكريبت الموقع
   + **بصمة البناء** (الختم `v=YYYYMMDDHHmm` — لو النسخة المخدومة قديمة
   ⇒ يفشل و**يتراجع تلقائي** للإصدار السابق).
7. ⏱️ لو الفحص فشل ⇒ `wrangler rollback <الإصدار السابق> --yes`.

---

## ③ قبل التحويل: تشيك ليست (كلها بتتحقق آلياً)

| # | الفحص | الأمر | المتوقع |
|---|---|---|---|
| 1 | حارس النشر | `node tools/check-deploy-guard.js` | ٢٢/٢٢ ✅ |
| 2 | اختبارات الواجهة | `for f in assets/tests/*.test.js; do node $f; done` | ٢٥٧ pass · ٠ fail |
| 3 | syntax كل JS | `npx esbuild <file> --outfile=/dev/null` | صفر أخطاء |
| 4 | الأصول المختومة | `curl -I .../octa-core.js?v=<stamp>` | `immutable` |
| 5 | HTML طازج | `curl -I .../tools` | `no-store` |
| 6 | اللقطة موجودة | `ls dist/data/*snapshot.json` | ملفين |
| 7 | تطابق الإعدادات | سكربت ① فوق | `متطابقين؟ True` |
| 8 | الإيقاظ شغال | `curl .../api/health` بعد ١٠ دقايق | ~٠٫٢ ثانية |

---

## ④ التحقق الحيّ بعد التحويل (نفسه اللي بنعمله على المعاينة)

```bash
# ① الصفحة + البصمة
curl -s https://octashares.com/tools | grep -oE "BUILD = 'v=[0-9]+'" | head -1

# ② الكاش
curl -sI "https://octashares.com/assets/js/octa-core.js?v=<الرقم من فوق>" | grep -i cache-control
#   ⇒ لازم: public, max-age=31536000, immutable

# ③ الـAPI
for p in /api/health /api/rank /api/dividends; do
  curl -s -o /dev/null -w "$p => %{http_code} (%{time_total}s)\n" https://octashares.com$p
done

# ④ محور الأخبار (هالان)
curl -s https://octashares.com/api/halan/axis | head -c 200
```

---

## ⑤ إيه اللي اتغيّر في ١٤ نوفمبر (ملخّص السبب)

| العَرَض | السبب الجذري | الإصلاح |
|---|---|---|
| **٣٥ ثانية قبل ما الموقع يفتح** | ١) ٦٤ ملف (٣ ميجا) بتبعتوا `no-store` ⇒ كل زيارة بتحمّلهم من الأول ٢) Railway بينام بعد خمول ⇒ cold start ٦-١٢ ثا ٣) البوابة كانت بتقعد قدام الشاشة لحد ٤٥ ثانية ٤) العميل كان بيعيد المحاولة لحد ٣٥ ثانية | ① كاش `immutable` للأصول المختومة ② كرون إيقاظ كل ٥ دقايق (عامل هالان + marker قياس) ③ مهلة سماح ٤٫٥ ثانية في البوابة ④ سقف إعادة المحاولة ١٢٠٠/٣٠٠٠ مللي |
| **البيانات ناقصة في الأول** | الطلبات بتترفض (429) + التحقق بيتأخر | البوابة مش بتقفل التطبيق + المراقب كل ٨ ثواني بيعيد بناء الكارت الفاضي |
| **السيرش والأخبار مش في السايد بار** | شغل «هالان» كان على branch مخطوط ومالمنشرش | اتدمج ونُشر (commit `42d21ef`) |
| **خطر النشر على الإنتاج بالغلط** | `npm run deploy` كان = إنتاج | الافتراضي = معاينة + حارس بعبارة صريحة (commit `42d21ef`) |

---

## ⑥ ⚠️ فجوة معروفة (مفتوحة، موثّقة)

**محور الأخبار = مصدرين.** الرقم في صفحة «محور الأخبار» (من هالان)
↔ الرقم جوّه «كارت القرار» (من إعلانات البورصة عبر foudalens).
- ✅ **JS engine متطابق ١:١** مع `news_engine` في الباك (١٨/١٨ على نفس البيانات).
- ⛔ **الباك لسه ما بيقرأش أحداث هالان** (`_halan_actions` مش موجود في
  `update_prices.py`) ⇒رقمين مختلفين لنفس المحور.
- 🔧 **الحل الجاهز (لما نقرّر):**
  ① `div_actions.py` يدمج أحداث هالان من `/api/halan/events` (endpoint عام
     على العامل) في `_actions` ⇒ الباك يشوفها ⇒ رقم واحد.
  ② العامل يخدم `/api/halan/axis` من نفس المجموعة المدمجة.
- ⛔ **مش هينفع يتعمل دلوقتي** ⇒ تغيير الباك = تغيير أرقام الدومين
  الإنتاجي ⇒ محتاج موافقة صريحة (زي النشر على الإنتاج نفسه).

---

## ⑦ ⭐ ملاحظة مهمة: توكن التشخيص

`/api/admin/mint_session` (أداة التشخيص) **عمره ١٠ دقايق بس**.
لما ي expired ⇒ `/api/auth/me` بيرجّع 401 ⇒ الواجهة تفتح «من غير تسجيل»
⇒ وتحصل 429 من إعادة المحاولة ⇒ **ده مش خطأ الموقع**.
تعمل توكن جديد:
```bash
curl -s -X POST -H "X-OCTA-Admin: $OCTA_ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"ahmed3zz2020@gmail.com"}' \
  https://octa-prices-production-4ccb.up.railway.app/api/admin/mint_session
```
