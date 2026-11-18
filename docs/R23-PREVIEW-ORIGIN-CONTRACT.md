# 🔗 عقد وجهة الـAPI — المعاينة ⇄ الإنتاج (الجولة ٢٣ · R23)

**المشكلة**: المعاينة كانت بتروّح على نفق ميت ⇒ Cloudflare 1016 ⇒ 530 على
`/api/*` ⇒ الواجهة فسّرت الردّ خطأً على إنه «الكود غلط» ⇒ المستخدم بيتّهم بإيمه.

**السبب الجذري**: مافيش عقد بين وجهة الـAPI في العامل وبين المستودع.

**الحل**: عقدة في المستودع (`assets/config/preview.json`) + حارس في الواجهة
(`assets/js/octa-origin-guard.js`) يفرض العقد ويقفل أي نداء بيخالفه.

## الملفات المسؤولة

| الملف | الدور |
|---|---|
| `assets/config/preview.json` | العقد: الوجهة لكل بيئة + المضيفات الممنوعة |
| `assets/js/octa-origin-guard.js` | الحارس: يحسب الوجهة، يمنع المضيف الممنوع، يفحص، ويبانر |
| `assets/js/octa-api.js` | التنفيذ: كل نداء `/api/` يعدّي من الحارس قبل ما يطلع |
| `assets/js/octa-gate.js` | الرسائل: كل حالة خطأ بنص عربي محدّد |
| `assets/tests/r23-*.test.js` | الاختبارات: وحدة + سلوك (محدّدة، مفيش شبكة) |

## الأكواد (لكل حالة خطأ كود واحد)

| الكود | الاسم | الرسالة |
|---|---|---|
| `config_missing` | `CONFIG_MISSING` | ملف إعداد المعاينة مش موجود — المعاينة مقفولة ومفيش اتصال بالإنتاج |
| `origin_missing` | `ORIGIN_MISSING` | وجهة الـAPI للمعاينة مش مضبوطة — المعاينة مقفولة ومفيش اتصال بالإنتاج |
| `origin_mismatch` | `ORIGIN_MISMATCH` | وجهة الـAPI للمعاينة مختلفة عن اللي في ملف الإعداد — المعاينة مقفولة |
| `production_origin_in_preview` | `PRODUCTION_IN_PREVIEW` | المعاينة كانت هتروح على الإنتاج — اتمنعت. لازم سيرفر منفصل. |
| `preview_origin_in_production` | `PREVIEW_IN_PRODUCTION` | الإنتاج كان هيروح على سيرفر المعاينة — اتمنعت. |
| `tunnel_origin` | `TUNNEL_ORIGIN` | وجهة الـAPI نفق مؤقت — اتمنعت. النفق بيتموت وبيسيب خطأ 530. |
| `origin_dns_error` | `ORIGIN_DNS_ERROR` | خطأ في DNS لوجهة الـAPI — الدومين مش موجود (النفق انتهى) |
| `origin_unreachable` | `ORIGIN_UNREACHABLE` | وجهة الـAPI مش رادّة — الخدمة مش شغّالة |
| `origin_blocked` | `BLOCKED` | الطلب اتمنع عشان وجهة الـAPI |

## إزاي بتتحسب الوجهة الفعّالة

1. `window.OCTA_API_ORIGIN` (من حقن العامل).
2. أول عنصر في `window.OCTA_DIRECT_LIST` (من حقن العامل).
3. العقدة: `preview.apiBaseUrl` أو `production.apiBaseUrl`.

لو (١) أو (٢) مختلفين عن (٣) ⇒ `origin_mismatch` ⇒ المعاينة بتتقفل.

## العقدة نفسها

```json
{
  "contract": "octa-origin/v1",
  "version": 1,
  "updated": "2026-11-18",
  "summary": "عقد وجهة الـAPI — بيقفل بين المعاينة والانتاج. المعاينة لازم سيرفر منفصل (داتا وبتخزين منفصلين) وممنوع تلمس الإنتاج ابداً.",
  "production": {
    "apiBaseUrl": "https://octa-prices-production-4ccb.up.railway.app",
    "healthPath": "/api/health",
    "hosts": [
      "octashares.com",
      "www.octashares.com",
      "octa-prices-production-4ccb.up.railway.app"
    ]
  },
  "preview": {
    "apiBaseUrl": "",
    "healthPath": "/api/health",
    "mustBeSeparateFromProduction": true,
    "mustHaveOwnDatabase": true,
    "mustHaveOwnStorage": true,
    "hosts": [],
    "status": "unconfigured",
    "ownerStep": "ضيف عنوان سيرفر المعاينة الدائم في preview.apiBaseUrl هنا، وضبط نفس العنوان في سر OCTA_API_URL (و OCTA_API_DIRECT) بتاع عامل المعاينة، وبعدين شغل: python3 /workspace/tools/r23_origin_preflight.py <العنوان>"
  },
  "forbidden": {
    "hosts": [
      "octashares.com",
      "www.octashares.com",
      "octa-prices-production-4ccb.up.railway.app"
    ],
    "hostSuffixes": [
      ".trycloudflare.com",
      ".ngrok.io",
      ".ngrok-free.app",
      ".loca.lt",
      ".serveo.net",
      ".localhost.run",
      ".bore.pub"
    ],
    "why": "انفاق مؤقتة — بتتموت وبتسيب خطأ 530 (Cloudflare 1016). ما ينفعش تبقى وجهة دائمة."
  },
  "notes": [
    "الواجهة بتقرأ العقدة دي (assets/js/octa-origin-guard.js) وبتقفل أي نداء API لو وجهة مضبوطة، أو الوجهة بتشير للإنتاج، أو الوجهة نفق مؤقت، أو الوجهة غلاب عن العقدة.",
    "الإنتاج بيفضل شغال زي ما هو: نفس الأصل (الـworker) هو اللي بيتكلم مع الباك، والعقدة دي بتتأكد بس ان الإنتاج ما بيوصلش لوجهة المعاينة.",
    "الفحص الحي (قبل ما تضبط السر): python3 /workspace/tools/r23_origin_preflight.py <العنوان> — قراءة بس."
  ]
}
```

## وضع الإنتاج (ما يتغيّرش)

- الإنتاج بيتكلم مع نفس الأصل (الـworker) ⇒ مافيش عنوان مطلق في الواجهة.
- العقدة في الإنتاج: مفيش blockade على أول نداء ⇒ صفر تأخير.
- الإنتاج ممنوع من وجهة المعاينة (`preview_origin_in_production`).

## خطوة المالك

1. ابنِ سيرفر Railway **منفصل** للمعاينة (داتا وتخزين منفصلين عن الإنتاج).
2. اضبط `preview.apiBaseUrl` في `assets/config/preview.json` على عنوانه.
3. اضبط نفس العنوان في سر `OCTA_API_URL` (وسر `OCTA_API_DIRECT`) بتاع عامل المعاينة.
4. شغّل الفحص قبل النشر:

```bash
python3 /workspace/tools/r23_origin_preflight.py <العنوان>
```
