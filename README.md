# 🐙 OCTA — منصة تحليل الأسهم العربية

> **octashares.com** — منصة تحليل أسهم مصرية وأمريكية وسعودية وإماراتية

[![النشر](https://img.shields.io/badge/نشر-octashares.com-2ea44f)](https://octashares.com)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://dash.cloudflare.com)

---

## 📌 المشروع

**OCTA** منصة تحليل أسهم عربية مبنية على:
- **بيانات حقيقية** من TradingView و startamarkets
- **محرك تقييم خاص** من 100 نقطة
- **8 فلاتر** (4 من TradingView + 4 من OCTA)
- **ساعة البورصة المصرية** بتحدّث حسب مواعيد التداول الفعلية

**مش نصيحة استثمارية** — كله تحليل بيانات.

---

## 📊 الأرقام

| السوق | عدد الأسهم |
|---|---|
| 🇪🇬 مصر | 290 |
| 🇺🇸 أمريكا | 1,463 |
| 🇸🇦 السعودية | 388 |
| 🇦🇪 الإمارات | 148 |
| **المجموع** | **2,289** |

---

## 🦑 الأذرع الثمانية

| # | الذراع | الرمز | بتعمل إيه |
|---|---|---|---|
| 1 | 🐙 **السوق** | `market` | نظرة عامة على البورصة المصرية |
| 2 | 💼 **المحفظة** | `portfolio` | المرشحين + منبهات الأسعار |
| 3 | ⚠️ **المخاطرة** | `risk` | التذبذب وأقصى هبوط تاريخي |
| 4 | 📰 **الأخبار** | `news` | أخبار السوق |
| 5 | 💧 **السيولة** | `liquidity` | أحجام التداول |
| 6 | 💵 **الأساسي** | `fundamental` | البيانات المالية |
| 7 | 📈 **الفني** | `technical` | مؤشرات TradingView |
| 8 | 📊 **الأرصدة** | `opportunity` | الفرص المرصودة |

> **فلسفة OCTA:** عقرب واحد بيفكر — **ONE BRAIN · EIGHT ARMS**
> كل ذراع بتاخد زاوية مختلفة، والعقرب بيجمعهم في قرار واحد.

---

## 🧭 خريطة الموقع

| الصفحة | الوظيفة |
|---|---|
| 🐙 **السوق** | نظرة عامة على البورصة المصرية |
| 💵 **الأساسي** | البيانات المالية (P/E · ROE · الأصول) |
| 📈 **الفني** | مؤشرات TradingView (RSI · MACD · SMA) |
| 💧 **السيولة** | أحجام التداول والسيولة |
| ⚖️ **المخاطرة** | التذبذب وأقصى هبوط |
| 💰 **الفرص** | أفضل الفرص مرصودة |
| 📊 **التحليل** | التحليل الكامل لسهم |
| 📡 **الأخبار** | أخبار السوق |
| 🔔 **التوزيعات** | مواعيد الأرباح وتوزيعات الأسهم |
| 🎯 **قرار اليوم** | 3 فرص محسوبة |
| 🔍 **الفلاتر** | 8 فلاتر + شرح 4 مستويات |

---

## 🔄 طريقة العمل

```
Ahmed بيصف المشكلة أو التعديل
        ↓
المحرك يعدّل في /workspace/octa5
        ↓
4 فحوصات تلقائية
        ↓
git commit + push
        ↓
Cloudflare Workers ينشر أوتوماتيك
        ↓
octashares.com اتحدث
```

⏱️ **من الوصف للنشر: 4-6 دقايق**

📖 **[دليل النشر الكامل](DEPLOY.md)**

---

## 🧪 الفحوصات قبل النشر

| # | الفحص | الأمر |
|---|---|---|
| ① | **JavaScript سليم** | `for f in assets/js/*.js; do node --check "$f"; done` |
| ② | **CSS نضيف** | مافيش HTML جوه + الأقواس متوازنة |
| ③ | **HTML متوازن** | `<div>` و `</div>` نفس العدد |
| ④ | **الكروت سليمة** | `grep -c "يعني إيه" assets/js/octa-screener.js` |

**لو أي فحص فشل → النشر بيقف** 🛑

---

## 📁 هيكل المشروع

```
octa5/
├── index.html               ← الصفحة الرئيسية (50 KB)
├── wrangler.jsonc           ← إعدادات Cloudflare
├── package.json             ← أوامر البناء
├── DEPLOY.md                ← دليل النشر
│
├── assets/
│   ├── octa.css             ← الأنماط الأساسية (250 KB)
│   ├── css-screener.css     ← أنماط الفلاتر
│   ├── css-chart.css        ← أنماط الشارت
│   ├── css-decide.css       ← أنماط القرار
│   ├── cards-preview.html   ← صفحة اختبار الكروت
│   └── js/                  ← 12 ملف
│       ├── octa-api.js      ← مدير السيرفرات + failover
│       ├── octa-clock.js    ← مواعيد البورصة المصرية
│       ├── octa-dev.js      ← أدوات المطوّر (مخفية)
│       ├── octa-config.js   ← الأوزان والعتبات
│       ├── octa-core.js     ← النواة
│       ├── octa-screener.js ← الفلاتر + الشرح
│       ├── octa-chart.js    ← شارت TradingView
│       ├── octa-pages.js    ← الصفحات
│       ├── octa-app.js      ← منطق التطبيق
│       ├── octa-filters.js  ← فلاتر OCTA
│       ├── octa-watch.js    ← المرشحين + منبهات
│       └── octa-decide.js   ← قرار اليوم
│
├── data/
│   └── data_markets.js      ← 2,289 سهم (3.4 ميجا)
│
├── data_full.json           ← بيانات التحليل (490 KB)
├── data_egx.json            ← بيانات مصر (245 KB)
├── data_ipo.json            ← رادار الاكتتاب
├── data_risk.json           ← بيانات المخاطر التاريخية
│
└── dist/                    ← البناء (بيتعمل أوتوماتيك)
```

---

## 🔐 الملاحظات

### الأسرار

- **مافيش توكين في أي ملف** — GitHub push protection بيمنع لو حاولنا
- التوكن في **Cloudflare dashboard** بس
- ** secrets بتاع تيليجرام** في **Railway Variables**

### المصادر

| المصدر | الاستخدام |
|---|---|
| **TradingView** | البيانات المالية والفنية |
| **startamarkets** | الأسعار والشموع التاريخية |
| **EGX / FRA** | رادار الاكتتاب |

---

## ⚠️ تنبيه قانوني

> **التقييم مش نصيحة استثمارية.**
>
> هذه المنصة تحلل بيانات عامة ولا تقدم خدمة إدارة أموال.
> لا تتلقى أي أصول أو أموال من المستخدمين.
> أي قرار استثماري هو قرارك أنت وحدك.

---

## 🔗 الروابط

| | |
|---|---|
| **الموقع** | https://octashares.com |
| **اختبار الكروت** | https://octashares.com/assets/cards-preview.html |
| **Workers** | https://octashares.com/workers-and-pages |
| **المستودع** | https://github.com/ahmed3zz2020-source/octa |

---

## 🛠️ التشغيل على الجهاز

### الموقع (الواجهة)

```bash
cd octa5
python3 -m http.server 8080
```

ثم افتح: `http://localhost:8080`

### السيرفر (الأسعار والتنبيهات)

```bash
cd octa-prices
pip install -r requirements.txt
python3 update_prices.py
```

السيرفر بيشتغل على: `http://localhost:5000`

---

## 📅 آخر تحديث

**11 أكتوبر 2026** — الدومين اتشترى والموقع اتربط بـGitHub

---

**🦑 ماله ستاك**

| | |
|---|---|
| **Frontend** | HTML · CSS · JavaScript (بلا framework) |
| **Backend** | Python · Flask · Gunicorn |
| **Frontend Hosting** | Cloudflare Workers |
| **Backend Hosting** | Railway |
| **Registrar** | Cloudflare |
| **CI/CD** | GitHub → Cloudflare auto-build |
| **Bot** | Telegram Bot API |

---

💙 **ONE BRAIN · EIGHT ARMS**