# 🏗️ OCTA — خريطة النظام (ARCHITECTURE.md)

**متى تقراه:** قبل أي تعديل على البنية أو إضافة ملف جديد.
> عشان تعرف إيه بيستقبل إيه، ومنين بتطلع الداتا، وإيه بياخد قرار.

**آخر تحديث:** 2026-10-20 · `596c665`

---

## ١) نظرة عامة

```
┌─────────────────────────────────────────────────────────────┐
│  المتصفح (RTL عربي)                                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  index.html  ·  ٢٢ ملف JS  ·  ٦ ملفات CSS              │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐    │  │
│  │  │core     │ │screener  │ │app     │ │tv-shim   │    │  │
│  │  │المحرك   │ │الفلاتر   │ │المودال │ │الشارت ⭐ │    │  │
│  │  └────┬────┘ └────┬─────┘ └────┬───┘ └────┬─────┘    │  │
│  └───────┼──────────┼──────────┼──────────┼────────────┘  │
│          │          │          │          │                │
│    fetch('/api/stocks')  ←──────┘          │                │
└──────────┼──────────────────────────────────┼───────────────┘
           │                                   │
    ┌──────▼────────┐                 ┌────────▼──────────┐
    │ Cloudflare    │                 │ TradingView       │
    │ Worker        │                 │ s.tradingview.com │
    │ (worker.js)   │                 │ /widgetembed/ ⭐   │
    │  proxy للـAPI │                 └───────────────────┘
    └──────┬────────┘
           │ fetch (نفس origin)
    ┌──────▼────────────────────────────────────────┐
    │ Railway · Python Flask · Gunicorn             │
    │ update_prices.py (١١٬٥٩٦ سطر)               │
    │  · ٨ محaxes + محرك التوصيات                   │
    │  · بوت تيليجرام (cron داخلي)                  │
    │  · ١٠٠ endpoint                               │
    └──────┬────────────────────────────────────────┘
           │
    ┌──────▼────────┐
    │ TradingView   │
    │ startamarkets │
    │ EGX / FRA     │
    └───────────────┘
```

---

## ٢) تدفّق البيانات

```
١. المستخدم يفتح الموقع
   ↓
٢. octa-gate.js → يطلب /api/auth/me
   ↓
٣. لو مفيش توكن → يطلب /api/auth/otp/send (PIN)
   ↓
٤. بعد الدخول → octa-core.js يحمّل البيانات:
   fetch('/api/stocks')  ← نفس origin (worker.js proxy)
   ↓
٥. الباك (Railway) يحمّل من TradingView + startamarkets
   يحسب: المحاور الستة + المحصلة + التوصية
   ↓
٦. يرجّع JSON فيه ٢٨٥ سهم بكل البيانات
   ↓
٧. octa-core.js يبني OS_DB (قاعدة الأسهم في المتصفح)
   ↓
٨. الواجهة ترسم: الفلاتر · الصفحات · المودالات
```

---

## ٣) ملفات الواجهة — بالتفصيل

### 🔵 النواة

| الملف | السطور | الوظيفة |
|---|---:|---|
| `octa-config.js` | ٩٧ | الإعدادات الثابتة · روابط · ثوابت |
| `octa-api.js` | ١٣٨ | مدير السيرفرات + failover بين المصادر |
| `octa-core.js` | ٢٬٨٥٢ | **المحرك الأمامي** · بناء `OS_DB` · البحث · الفلاتر الأساسية |
| `octa-csp.js` | ٦٦ | سياسة أمان المحتوى |

### 🟢 الصفحات والأدوات

| الملف | السطور | الوظيفة |
|---|---:|---|
| `octa-app.js` | ٢٬٥٢١ | **المودالات** · `openChart()` · `closeOctaChart()` · الترويسة الموحدة |
| `octa-pages.js` | ٤٬٢٣٣ | صفحات الأسهم · «التحليل البياني» · `renderSiChart()` |
| `octa-filters.js` | ٤٬٣٩٧ | الفلاتر المتقدّمة (٦ فلاتر) |
| `octa-screener.js` | ١٬٤٢٥ | الفلتر الأساسي · جدول النتائج |
| `octa-armsfilter.js` | ٤٧٢ | فلتر «الأذرع» |

### 🟡 المميزات

| الملف | السطور | الوظيفة |
|---|---:|---|
| `octa-decide.js` | ٤٧٢ | كارت القرار (الملخص النهائي) |
| `octa-indicators.js` | ٨٤٢ | المؤشرات الفنية · `divergence()` |
| `octa-gold.js` | ١٬٢١٠ | الذهب + الفريمات الخاصة |
| `octa-watch.js` | ٢٣١ | متابعة الأسهم |
| `octa-copy.js` | ٣٤٦ | نسخ · مشاركة |
| `octa-stats.js` | ١٢٤ | إحصائيات السوق |
| `octa-clock.js` | ١٢٨ | ساعة البورصة المصرية |
| `octa-dev.js` | ١٢١ | أدوات المطور · كارت الفحص |

### 🔴 الأمان

| الملف | السطور | الوظيفة |
|---|---:|---|
| `octa-auth.js` | ٢٨٥ | الدخول بـ OTP · PIN |
| `octa-gate.js` | ١٬٩٦٥ | **البوابة** · القفل بعد ٣٠ دق · حماية |
| `octa-sidebar.js` | ٢١٤ | الشريط الجانبي |
| `octa-settings.js` | ١٬١٣٦ | الإعدادات |

### ⭐ الشارت

| الملف | السطور | الوظيفة |
|---|---:|---|
| `tv-shim.js` | ٧٧٩ | **المصدر الوحيد للشارت** — `OCTA_TV.mount()` |

---

## ٤) ⭐ `tv-shim.js` — المصدر الواحد للشارت

**الملف الأهم في الواجهة.** أي شارت في الموقع لازم يمر من هنا.

### الـAPI

```javascript
OCTA_TV.mount(host, opts)      // ينشئ الشارت
OCTA_TV.update(host, opts)    // يغيّر السهم/الفريم
OCTA_TV.buildUrl(opts)        // يبني رابط TradingView
OCTA_TV.whenSized(host, cb)   // ينتظر لحد ما الحاوية ليها حجم
OCTA_TV.lockPage(on)          // قفل تمرير الصفحة
OCTA_TV.fullscreen(host)      // ملء الشاشة
OCTA_TV.makePicker(opts)      // البحث
OCTA_TV.makeShotBtn(sym)      // زرار التصوير
OCTA_TV.symbolList            // ٢٨٥ سهم للبحث
```

### الـparams المهمة

| Param | القيمة | السبب |
|---|---|---|
| `symbol` | `EGX:COMI` | البورصة المصرية |
| `interval` | `1D` · `5` · `15` · `60` · `1W` · `1M` | الفريمات |
| `locale` | `ar_AE` | ⭐ عربي — بدونها الإ englاني |
| `autosize` | `true` | يملأ الحاوية |
| `save_image` | `1` | زرار التصوير |
| `hide_side_toolbar` | `false` | أدوات الرسم (لازم تكون ظاهرة) |
| `hide_legend` | `true` على الموبايل | ⭐ يحرر مساحة |
| `withdateranges` | `false` على الموبايل | ⭐ التقويم العربي بيتعارض |
| `studies` | مفيش على الموبايل | ⭐ المؤشرات بتاكل الشاشة |
| `theme` | `light` / `dark` | من `body.classList` |

### ⛔ ليه `s.tradingview.com/widgetembed`؟

البدائل بتIFF:
- `s3.tradingview.com/external-embedding` → بيفضل فاضي (∅)
- `embed-widget-advanced-chart.js` → غالباً إنجليزي

`widgetembed` = **العربي شغّال + البيانات صح** في كل المتصفحات.

### ⛔ بلوك معروف: أدوات الرسم

**أدوات الرسم في المودال بتفشل على الموبايل** — الـcrosshair بيقف مكانه.

**الأدلة:**
- نفس الـiframe في صفحة بسيطة = الرسم **يشتغل**
- نفس الـiframe جوّه مودال = الرسم **يفشل** (٣/٣)
- الأحداث بتوصل للـiframe سليمة (`pointermove` ١٩ · `pointerup` ٢)

**السبب:** TradingView widgetembed + Chrome Android جوّه DOM فيه حاويات فوق الـiframe.

**الحل الوحيد اللي اشتغل:** ⛶ يفتح `https://www.tradingview.com/chart/?symbol=...` في تاب جديد.
**مفيش حل من برّه الـiframe.**

---

## ٥) 🎨 الـCSS

| الملف | الدور |
|---|---|
| `octa-tokens.css` | ⭐ المتغيرات (ألوان · مسافات · خطوط) |
| `octa.css` | الأساس · الـtopbar · البوت |
| `css-decide.css` | كارت القرار |
| `css-screener.css` | جدول الفلتر |
| `css-chart.css` | المودال · الشارت |
| `css-gold.css` | ⭐ الأكبر (٩١١ سطر) · المودالات · الشارت · الذهب |

**ترتيب التحميل مهم** — `tokens` الأول عشان الباقي ياخد المتغيرات.

---

## ٦) 🔌 الباك (Railway)

### `update_prices.py` — ١١٬٥٩٦ سطر

| القسم | السطر تقريباً | الوظيفة |
|---|---:|---|
| محرك التقييم | ٥٬٣٠٤ | المحاور الستة + الأوزان + التوصية |
| محرك المعنويات | ٥٬٦٧٦ | Sentiment مع cap ٢٥٪ |
| Fundamental | ٥٬٤٢٤ | P/E · ROE · الصحة المالية |
| Technical | ٥٬٣٠٤ | RSI · MACD · MA200 · Bollinger |
| بوت تيليجرام | ٩٬٨٣٨ | `a_decision()` · `send()` · كوكي |
| الـendpoints | متفرق | ١٠٠ مسار |
| البيانات | ٢٢٬٧٥٨ | `data_full.json` (JSON منسّق) |

### الـendpoints المهمة

| Endpoint | الوظيفة |
|---|---|
| `GET /api/stocks` | كل الأسهم (٢٨٥) بكل البيانات |
| `GET /api/rank` | مرتّب بالنقاط |
| `GET /api/candles/<code>` | شموع تاريخية |
| `GET /api/dividends` | توزيعات الأرباح |
| `GET /api/gold` | الذهب + سعر الدولار |
| `POST /api/auth/*` | OTP · PIN · البصمة |
| `GET /api/tg-status` | تشخيص البوت |

---

## ٧) 🌐 `worker.js` — الـproxy

```javascript
// أي طلب /api/* → يروح للـRailway ويرجع بنفس الـorigin
if (url.pathname.startsWith('/api/')) {
  const upstream = await fetch(API + url.pathname, {...});
  return new Response(body, {
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
      'Cache-Control': 'no-store'
    }
  });
}
```

**⛔ ليه موجود:** الـRailway بيرد `cross-origin-resource-policy: same-site`
⇒ المتصفح بيحجب الـbody لو الطلب من `workers.dev`.

**✅ الحل:** نفس الـorigin عن طريق الـproxy.

---

## ٨) 🔐 الأمان

| الطبقة | الآلية |
|---|---|
| الدخول | OTP على الإيميل + PIN (٦ أرقام) |
| القفل | بعد ٣٠ دق خامل → البوابة |
| OTP | `/api/auth/otp/send` |
| البصمة | `/api/auth/bio` — بصمة المتصفح |
| الحماية | CSRF + rate limit على الباك |

---

## ٩) 🎨 Tokens التصميم

```css
--gold:      #d4af37    /* الذهبي */
--pri:       #0a1929    /* الخلفية */
--pri2:      #102a43    /* البطاقات */
--pri3:      #1c3b58    /* الأزرار */
--txt:       #e8eef5    /* النص */
--muted:     #8b9eb0    /* النص الثاني */
```

**الأزرار:** ٤٤×٤٤ بكسل على الموبايل (للتUILouch).
**الخطوط:** النظام + monospace للأرقام.

---

## 🔗 الملفات المرتبطة

| الملف | المحتوى |
|---|---|
| `AGENTS.md` | عقد العمل · القوانين · الأوامر |
| `DOMAINS.md` | المحاور · الأوزان · قوانين السوق |
| `DECISIONS.md` | القرارات + الأسباب |
| `SESSION-NOTES.md` | يوميات آخر ٣٠ يوم |