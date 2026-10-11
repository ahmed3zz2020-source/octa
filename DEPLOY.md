# 🚀 دليل النشر — OCTA

## طريقة الشغل من دلوقتي

```
Ahmed بيقولي المشكلة أو التعديل
        ↓
أنا بعدّل في /workspace/octa5
        ↓
أعمل 4 فحوصات
        ↓
git commit + push
        ↓
npx wrangler deploy
        ↓
octashares.com اتحدث ✅
```

---

## 🔑 المفاتيح

```
CLOUDFLARE_API_TOKEN      ← 🔒 من Railway/Cloudflare dashboard
CLOUDFLARE_ACCOUNT_ID     ← 74e046678adabf0706024b97b205882b
```

⚠️ **التوكن مش مكتوب في أي ملف — عايزه من Cloudflare مباشرة**
**🔗 https://dash.cloudflare.com/profile/api-tokens**

---

## ✅ الفحوصات الـ4 (قبل أي نشر)

### ① فحص JavaScript

```bash
for f in assets/js/*.js; do node --check "$f" || echo "❌ $f"; done
```

### ② فحص CSS

```bash
# مفيش HTML داخل CSS + الأقواس متوازنة
```

### ③ فحص HTML

```bash
# div متوازن: <div ...> و </div> نفس العدد
```

### ④ عدّ الكروت

```bash
grep -c "يعني إيه" assets/js/octa-screener.js
```

---

## 🚀 النشر

```bash
cd /workspace/octa5

# 1. تجهيز مجلد dist (من غير node_modules)
npm run build

# 2. حفظ الكود
git add -A
git commit -m "وصف التعديل"
git -c http.sslVerify=false push -q origin main

# 3. النشر على Cloudflare
export CLOUDFLARE_API_TOKEN=      # 🔒 التوكن من Cloudflare
export CLOUDFLARE_ACCOUNT_ID=74e046678adabf0706024b97b205882b
npx wrangler deploy
```

**لو Cloudflare رجّع 503** (مؤقت):

```bash
sleep 40
npx wrangler deploy
```

**جرّب 2-3 مرات** — دي مشكلة مؤقتة من Cloudflare مش من الكود

---

## 🔍 التحقق بعد النشر

```bash
# ⚠️ لازم cache-bust عشان Cloudflare كاش قوي
curl -s "https://octashares.com/assets/js/octa-screener.js?v=$(date +%s)" | grep -c "يعني إيه"
```

---

## 🔄 لو المستخدم مش شايف التعديل

**المتصفح بيخزّن الملفات القديمة.**

**الحل على الموبايل:**

| الطريقة | |
|---|---|
| **الأسهل** | اكتب `octashares.com/@@` في العنوان |
| **Chrome** | ⋮ ← Reload |
| **Safari** | زر ↻ في الأسفل |

---

## 📂 هيكل المشروع

```
octa5/
├── index.html              ← الصفحة الرئيسية
├── wrangler.jsonc          ← إعدادات Cloudflare
├── package.json            ← أوامر البناء
├── assets/
│   ├── octa.css            ← الأنماط الأساسية
│   ├── css-screener.css    ← أنماط الفلاتر
│   ├── css-chart.css       ← أنماط الشارت
│   ├── css-decide.css      ← أنماط القرار
│   ├── octa-logo.png
│   ├── cards-preview.html  ← صفحة اختبار الكروت
│   └── js/
│       ├── octa-api.js     ← مدير السيرفرات + failover
│       ├── octa-clock.js   ← مواعيد البورصة المصرية
│       ├── octa-dev.js     ← أدوات المطوّر (مخفية)
│       ├── octa-screener.js← الفلاتر + الشرح  ← بيتعدّل كتير
│       └── ...
├── data/
│   ├── data_markets.js     ← 2,289 سهم (3.4 ميجا)
│   └── ...
├── data_full.json          ← بيانات التحليل
├── data_egx.json           ← بيانات مصر
└── dist/                   ← البناء (بيتعمل أوتوماتيك)
```

---

## 🔐 ملاحظات أمان

### الباسوردات

- **مش بتتحفظ** في أي ملف
- الباتسوردات في Railway Variables
- التوكن في Cloudflare dashboard بس

### في الكود

- `esc()` بتهرب كل النصوص
- `gl()` بتسمح بـ `<b>` و `<br>` بس
- أي `<script>` أو `onclick` بيتشال ✅

---

## 🆘 حل المشاكل

| المشكلة | الحل |
|---|---|
| `Asset too large` | `npm run build` — الـnode_modules مش هينزل |
| `Invalid API Token` | التوكن غلط — ارجع من Cloudflare |
| `503 Service Unavailable` | استنى 40 ثانية وحاول تاني |
| `Cannot use assets with a binding` | شيل `"binding"` من wrangler.jsonc |
| التعديل مش ظاهر | `octashares.com/@@` |
| `memberships` authentication error | حط `CLOUDFLARE_ACCOUNT_ID` |

---

## 📊 روابط مهمة

| | |
|---|---|
| **الموقع** | https://octashares.com |
| **اختبار الكروت** | https://octashares.com/assets/cards-preview.html |
| **Workers** | https://octashares.com/workers-and-pages |
| **GitHub** | https://github.com/ahmed3zz2020-source/octa |
| **Railway API** | https://octa-prices-production-4ccb.up.railway.app |

---

## 💡 قواعد الكتابة

### ✅ افعل

- اكتب بالعربي الفصيح
- كل جملة تامة المعنى
- استخدم تشبيه لو المصطلح صعب
- «يعني إيه؟» قبل أي رقم

### ❌ لا تفعل

- متكتبش مصطلحات إنجليزي وسط عربي
- متكتبش جملة من غير فعل
- متسيبش رقم من غير تفسير
- متحطش توكين في الكود

---