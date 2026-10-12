# 📍 خريطة المشروع — OCTA

> آخر تحديث: 12 أكتوبر 2026 · 03:15
> السطر ده بيتحدث مع كل شغل

---

## 🎯 **إيه المشروع ده؟**

**منصة عربية لتحليل البورصة المصرية**

**الفكرة:**estock نديك قرار شراء/بيع واضح

**ماشي على:** 8 فلاتر + تقييم من 100

---

## 🔗 **الروابط المهمة**

```
🌐 الموقع      → https://octashares.com
🔌 الـAPI      → https://octa-prices-production-4ccb.up.railway.app
📦 الباك-إند   → /workspace/octa-prices
🎨 الواجهة     → /workspace/octa5
```

---

## ✅ **اللي خلص**

### 🛡️ **أمان (11 مهمة)**

```
1.  توكن تيليجرام اتدوّر
2.  CORS اتقيّد
3.  حد الطلبات (120/15/5)
4.  حسابات + عزل المحفظة
5.  إخفاء أوزان التقييم
6.  إزالة الرقم المفبرك 50
7.  رقم النسخة snapshot_id
8.  إصلاح Content-Length
9.  security headers كامل
10. منع تصدير الداتا
11. تنظيف تسريب الأسرار
```

### 👥 **حسابات (3)**
```
12. إيميل + استرجاع الباسورد
13. واجهة تسجيل
14. بوابة دخول إجبارية
```

### 📊 **بيانات (2)**
```
15. تتبع الزيارات
16. لوحة إحصائيات
```

### ⚖️ **قانوني (1)**
```
17. إخلاء مسؤولية كامل
```

### 🧹 **نظافة (2)**
```
18. إزالة trackers
19. أدوات المطوّر بقفل
```

**المجموع: 19 مهمة ✅**

---

## 🚧 **اللي فاضل**

| # | المهمة | الأولوية | الوقت |
|---|---|---|---|
| 1 | **ربط خدمة الإيميل** (استرجاع) | 🔴 عالية | ساعة |
| 2 | **نظام دفع** (لو عايز مدفوع) | 🟡 متوسطة | يومين |
| 3 | **تنظيف Git history** (توكن قديم) | 🟢 منخفضة | — |
| 4 | **إصلاح فحص CI** | 🟢 منخفضة | — |

---

## ⚠️ **مشاكل معروفة**

### 1. نظام الإيميل مربوطش

```
كود الاسترجاع بيطبع في لوج السيرفر
مش بيتبعت للإيميل
```

**الحل:** اربط [Resend](https://resend.com) أو [Brevo](https://brevo.com) — 3000 إيميل/شهر مجاناً

**التعديل:** سطر واحد في `_reset_send` في `update_prices.py`

### 2. فحص CI مكسور

```
بيرفض "..." (تلات نقط) في الكومنتات
```

**الحل:** محتاج توكن بـ scope: workflow

### 3. التوكن القديم في Git history

```
ملغى — بس لسه موجود في 9 commits
محتاج git-filter-repo
```

---

## 📐 **البنية**

### الباك-إند (`/workspace/octa-prices`)

```
update_prices.py    ← كل حاجة في ملف واحد (~6000 سطر)
  ├─ 57 route
  ├─ rate limiting (3 طبقات)
  ├─ حسابات (PBKDF2 + HMAC)
  ├─ تتبع (track.json)
  └─ إخفاء الأوزان
```

### الواجهة (`/workspace/octa5`)

```
index.html          ← 52KB · 16 script
assets/
  octa.css          ← 253KB
  js/               ← 14 ملف
    octa-core.js    ← التوجيه + التتبع
    octa-gate.js    ← بوابة الدخول ⬅️ جديد
    octa-auth.js    ← الحساب
    octa-stats.js   ← الإحصائيات ⬅️ جديد
    octa-screener.js
    octa-chart.js
    octa-decide.js
    ...
data/
  data_full.json    ← 488KB · 296 سهم
  data_egx.json     ← 244KB
  data_risk.json    ← 48KB
```

---

## 🧭 **إزاي تبني عليه؟**

```bash
# الباك-إند
cd /workspace/octa-prices
git log --oneline -5
python3 -m py_compile update_prices.py    # دايماً اتأكد
git add -A && git commit -m "..."
git push origin main                        # Railway بيعمل deploy

# الواجهة
cd /workspace/octa5
npm run build                               # لازم قبل كل deploy
git add -A && git commit -m "..."
git push origin main
npx wrangler deploy --config wrangler.jsonc  # Cloudflare
```

---

## 🔑 **متغيرات البيئة (Railway)**

```
GEMINI_API_KEY        ← ذكاء اصطناعي
TELEGRAM_BOT_TOKEN    ← البوت (متوقف دلوقتي)
TELEGRAM_CHAT_ID      ← رقم المحادثة
OCTAD_TOKEN_SECRET    ← توقيع التوكنات ⭐ مهم
EGX_LIVE_KEY          ← obdepth (مفيش)
ALLOWED_ORIGINS       ← نطاقات مسموحة
```

**⚠️ التوكنات مش في الكود — كلهم في Railway**

---

## 📌 **قواعد مهمة**

### 1. `...` (تلات نقط) بتكسر CI

```python
# ❌ ده يكسر الفحص
# body: { "email": "..." }

# ✅ كده
# body: { "email": "name@example.com" }
```

**ده شال مني 3 مرات** 😤

### 2. `set_data` لازم bytes

```python
# ❌ غلط — بيحسب الطول بالحروف
resp.set_data(json.dumps(d, ensure_ascii=False))
resp.headers["Content-Length"] = str(len(json.dumps(d, ensure_ascii=False)))

# ✅ صح
raw = json.dumps(d, ensure_ascii=False).encode("utf-8")
resp.set_data(raw)
resp.headers["Content-Length"] = str(len(raw))
```

### 3. HTML لازم متوازن

```bash
python3 -c "
import io,re
s=io.open('index.html',encoding='utf-8').read()
for t in ['div','script','button','span']:
    o=len(re.findall(rf'<{t}[\s>]',s)); c=len(re.findall(rf'</{t}>',s))
    print(f'<{t}>: {o}/{c}', '✅' if o==c else '❌')"
```

### 4. `node --check` لكل ملف JS

```bash
for f in assets/js/*.js; do node --check "$f"; done
```

### 5. CSS مافيش HTML

```python
css = s[:s.index('</style>')]
assert css.count('<span') == 0
```

---

## 🧠 **قرارات معمارية**

| القرار | السبب |
|---|---|
| مش Django → Flask | أخف، Railway بيدعمه |
| JS plain scripts | المشروع بيستخدم globals |
| الحساب = كود مش باسورد | أسرع، مافيش email verification |
| الحفظ في JSON files | البساطة، حجم صغير |
| في-memory rate limit | كافي لـ replica واحدة |
| إخفاء الأوزان في after_request | catch-all بدل كل route |

---

## 🔮 **إيه اللي جاي؟**

### شركات محتملة

```
1. ربط الإيميل (حاجز أساسي للاسترجاع)
2. نظام اشتراك (لو عايز مدفوع)
3. Telegram bot يشتغل
4. إشعارات الأسعار
5. تطبيق موبايل
```

---

## 📞 **معلومات مهمة**

```
الدومين    octashares.com
Cloudflare Workers + Registrar
Railway     للأpiercurrd
GitHub      ahmed3zz2020-source
  → octa (الواجهة)
  → octa-prices (الباك)
```

---

## 💡 **حاجات اتعلمتها**

1. **الـCI بيحب يفشل** — الفحص بتاع `...` غلط
2. **`set_data` بايتي** — العربي بايتين للحرف
3. **GitHub مش بيسمح بتعديل الـworkflow** من غير توكن خاص
4. **Cloudflare بيعمل 503** أحياناً — عادي، استنى
5. **`git reset`** بيمسح التعديلات لو مش متأكد

---

## 🔄 **آخر تحديث**

```bash
echo "آخر commit:"
git -C /workspace/octa5 log --oneline -1
git -C /workspace/octa-prices log --oneline -1
```
