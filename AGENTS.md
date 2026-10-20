# 🐙 OCTA — عقد العمل (AGENTS.md)

> **هذا أول ملف يقراه أي مساعد في أي شات جديد على OCTA.**
> اقرأه كامل قبل ما تعمل أي حاجة. ٣٠ ثانية بيفرق بين شات شغال وشات ضايع.

**آخر تحديث:** 2026-10-20 · `8be20af`
**الحالة:** ✅ الإنتاج شغّال على `octashares.com`

---

## ١) المشروع إيه؟

**OCTA** — منصة تحليل أسهم عربية (مصر/أمريكا/السعودية/الإمارات).

- **٢٬٢٨٩ سهم** في ٤ أسواق
- **٢٨٥-٢٩٠ سهم مصري** في المحرك الحي
- **محرك تقييم من ١٠٠ نقطة** على ٧ محاور
- **٨ أذرع** (أدوات): السوق · المحفظة · المخاطرة · الأخبار · السيولة · الأساسي · الفني · الأرصدة
- **فلسفة:** `ONE BRAIN · EIGHT ARMS` — عقرب واحد بيفكر

**مش نصيحة استثمارية.** كله تحليل بيانات.

---

## ٢) 🏗️ الـStack

| الطبقة | التقنية | وين |
|---|---|---|
| **الواجهة** | HTML · CSS · JS خام (بلا framework) | Cloudflare Workers Assets |
| **الباك** | Python · Flask · Gunicorn | Railway |
| **البيانات** | TradingView · startamarkets · EGX/FRA | عبر الباك |
| **البوت** | Telegram Bot API | cron داخلي في الباك |
| **الدومين** | Cloudflare | `octashares.com` |
| **source** | GitHub | `ahmed3zz2020-source/octa` |

**الريبوهات (٢):**
- `octa` — الواجهة ( workers + assets )
- `octa-prices` — الباك (Flask + البوت )

---

## ٣) ⚠️ القانون الذهبي — النشر

**ممنوع أي نشر على `octashares.com` من غير كلمة أحمد الحرفية: «ارفع على الدومين».**

```
١) عدّل على GitHub
٢) انشر على octa-preview   ( octa-preview.ahmed3zz2020.workers.dev )
٣) اختبار (أحمد على موبايله الحقيقي)
٤) أحمد يقول: «ارفع على الدومين»
٥) انشر على الإنتاج
```

**⛔ ليه مهم:** الشاتات المتعددة بتنشر على نفس المكان، فبيتلغى بعضها. ضاع شغل أيام بسبب كده.

---

## ٤) 📂 الريبوهات والملفات

### `octa/` — الواجهة
```
octa/
├── AGENTS.md              ← أنت هنا
├── ARCHITECTURE.md         ← خريطة النظام
├── DOMAINS.md              ← المعرفة التقنية
├── DECISIONS.md            ← سجل القرارات
├── SESSION-NOTES.md        ← يوميات العمل
├── PROJECT-RULES.md        ← (قديم — دمج في AGENTS)
├── PROJECT_STATE.md        ← (قديم — سجل المشروع الدائم في octa-prices/)
├── index.html              ← الصفحة الرئيسية
├── worker.js               ← proxy للـAPI (نفس origin)
├── assets/
│   ├── js/                 ← ٢٢ ملف · ٢٤٬٠٧٧ سطر
│   │   ├── octa-core.js    ← المحرك + تحميل البيانات
│   │   ├── octa-app.js     ← المودالات + openChart
│   │   ├── tv-shim.js      ← ⭐ مصدر الشارت الوحيد
│   │   ├── octa-screener.js ← الفلتر الأساسي
│   │   ├── octa-filters.js ← الفلاتر المتقدمة
│   │   ├── octa-pages.js   ← صفحات الأسهم + gold_signal
│   │   └── ...
│   └── css*.css            ← ٦ ملفات
├── tools/
│   ├── devserver.py        ← سيرفر محلي + API proxy
│   ├── visual-check.py     ← فحص بصري آلي
│   └── chart-check.py      ← فحص الشارت
└── dist/                   ← build output (مولّد — gitignore)
```

### `octa-prices/` — الباك
```
octa-prices/
├── update_prices.py       ← ١١٬٥٩٦ سطر — المحرك كله
│   ├── المحاور الستة + الأوزان
│   ├── محرك التوصيات
│   ├── بوت تيليجرام
│   └── ٨٨ endpoint
├── octa_app.py            ← مسارات إضافية
├── data_full.json         ← ٢٨٥ سهم (full)
├── PROJECT_STATE.md       ← سجل المشروع الدائم بالأرقام
├── div_actions.py         ← بيانات التوزيعات
├── Procfile               ← gunicorn
└── requirements.txt
```

---

## ٥) 🎯 الأوامر المهمة

```bash
# ⭐ أول حاجة في أي شات جديد
cd /workspace/octa && bash check-sync.sh

# بناء
npm run build

# فحص الصيغة
node --check assets/js/*.js

# نشر على المعاينة
NODE_OPTIONS="--dns-result-order=ipv4first" \
  npx --yes wrangler@4.151.1 deploy --config wrangler-preview.jsonc

# نشر على الإنتاج (⛔ محتاج موافقة!)
NODE_OPTIONS="--dns-result-order=ipv4first" \
  npx --yes wrangler@4.151.1 deploy

# الباك: git push بيكفي (Railway auto-deploy)
cd /workspace/octa-prices && git add -A && git commit -m "..." && git push origin HEAD:main

# سيرفر محلي للاختبار
python3 tools/devserver.py 8811
```

---

## ٦) 🚫 «متعملش كده» — القائمة المتراكمة

**دول أخطاء اتوقعنا فيها. متكرّرهاش.**

### النشر
- ❌ **ما تنشرش على الإنتاج من غير «ارفع على الدومين»** — حرفياً
- ❌ **ما تستخدمش `wrangler@3.x`** — بيفشل 503. استخدم **4.151.1**
- ❌ **ما تنساش `NODE_OPTIONS="--dns-result-order=ipv4first"`** — بيفشل

### الشارت (tv-shim.js)
- ❌ **ما تستخدمش `s3.tradingview.com/external-embedding` ولا `embed-widget`** — بيفضل فاضي
- ✅ **المصدر الوحيد = `s.tradingview.com/widgetembed/`**
- ❌ **ما تعملش iframe جديد لكل شارت** — كل الشارتات من `OCTA_TV.mount()`
- ⚠️ **أدوات الرسم في المودال بتفشل** — TradingView widgetembed مش شغّال صح على
  الموبايل جوّه مودال. **الحل الوحيد: ⛶ يفتح `tradingview.com/chart/?symbol=`** في تاب

### الأوزان (octa-app.js)
- ❌ **ما تحطش أوزان في `index.html`** — بتتعرض. حطها في `after_request` catch-all

### البيانات
- ❌ **ما تستخدمش أسماء الحقول القصيرة (`p` · `mc` · `av30`)** — لازم الـaliases الكاملة
- ❌ **ما تعملش fetch للـAPI من `workers.dev`** — الـAPI بيرد `cross-origin-resource-policy: same-site`
  ⇒ **لازم `/api/stocks` (نفس origin عبر `worker.js` proxy)**

### البوت (octa-prices)
- ❌ **ما تنساش `parse_mode: "HTML"` في `send()`** — تيليجرام بيعرض `<b>` كنص
- ❌ **ما تسيبش `ORDER` ناقص** — لازم كل أسماء التوصيات

---

## ٧) 📊 الأرقام الحيّة

```
الأسهم المصرية:     ٢٨٥
إجمالي الأسهم:     ٢٨٥ من API · ٢٬٢٨٩ من data_markets
endpoints الباك:     ٨٨
commit الحالي:      596c665
آخر تحديث للبيانات: 2026-10-20 11:13:00
```

**لتحديث الأرقام:** `bash tools/refresh-context.sh`

---

## ٨) 🎨 قواعد التصميم

- **عربي مصري ١٠٠٪** — كل النصوص للمستخدم بالعربي
- **RTL كامل** — `<html dir="rtl" lang="ar">`
- **ممنوع ذكر اسم أداة AI** في الموقع (Claude · ChatGPT · Gemini · Copilot)
  → البديل: «محرك OCTA» · «بيحلل بذكاء»
- **ممنوع ذكر إيدي أو طريقة البناء** على الموقع
- **الألوان:** `--gold: #d4af37` · `--pri: #0a1929` · `--pri2` · `--pri3`
- **الأزرار:** ٤٤×٤٤ بكسل على الموبايل

---

## ٩) 🔄 أول ٥ دقايق في أي شات جديد

```bash
cd /workspace/octa
bash check-sync.sh                              # ١) اتأكد مفيش اختلاف
cat AGENTS.md                                   # ٢) أنت في القايمة أصلاً
tail -40 SESSION-NOTES.md                       # ٣) إيه اللي حصل آخر مرة
grep -A5 "شهر" DECISIONS.md | tail -30          # ٤) إيه القرارات الأخيرة
```

**ثم:** قولّي إيه المطلوب، وأنا أبدأ فوراً.

---

## ١٠) 📎 روابط مهمة

| | |
|---|---|
| **الموقع** | https://octashares.com |
| **المعاينة** | https://octa-preview.ahmed3zz2020.workers.dev |
| **صفحة الشارت** | https://octashares.com/chart |
| **الـAPI** | https://octa-prices-production-4ccb.up.railway.app |
| **ريبو الواجهة** | github.com/ahmed3zz2020-source/octa |
| **ريبو الباك** | github.com/ahmed3zz2020-source/octa-prices |

---

## 🔗 الملفات المرتبطة

| الملف | المحتوى |
|---|---|
| `ARCHITECTURE.md` | كل ملف ووظيفته + تدفّق البيانات |
| `DOMAINS.md` | محرك التقييم + المحاور + قوانين السوق |
| `DECISIONS.md` | كل قرار سوّاناه والسبب |
| `SESSION-NOTES.md` | يوميات آخر ٣٠ يوم |
| `octa-prices/PROJECT_STATE.md` | سجل المشروع الدائم بالأرقام |

---

**🦑 ONE BRAIN · EIGHT ARMS**