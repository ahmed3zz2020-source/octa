# 🛡️ خطة CSP — من Report-Only إلى Enforce (١٥ نوفمبر ٢٠٢٦)

> ⛔ **الوضع الحالي:** `Content-Security-Policy-Report-Only` مفعّل في **ترويسة الـWorker** (كل رد).
> ⛔ **مش** Enforce — لأن فيه **٧٨ زر `onclick`** جوه الـHTML + **١٣ سكربت مضمّن**.
> ✅ **قرار صريح:** متحوّلش لـEnforce قبل ما الـonclick يتبشّل (الخطوات تحت).

---

## ① الوضع الحالي (مقيس)

| البند | العدد | المصدر |
|---|---|---|
| `onclick=` في صفحات HTML | **٧٨** | `grep -o "onclick=" *.html` |
| سكربتات مضمّنة (من غير `src`) | **١٣** | `index.html` ٨ · `gate.html` ٢ · `market.html` ٢ · `reset.html` ١ |
| `style=` مضمّن | موجود | لازم `style-src 'unsafe-inline'` لحد ما يتحوّل لـCSS classes |
| ترويسة CSP موجودة؟ | ⬇️ **Report-Only** فقط | `worker.js` ⇒ `cspPolicy()` |
| `script-src` الحالي | `'self' 'unsafe-inline' https://s3.tradingview.com` | لازم `unsafe-inline` مؤقتاً |

---

## ② اللي اتعمل فعلاً (Batch 02)

1. ✅ **ترويسة CSP Report-Only** في ردود الـWorker (`Content-Security-Policy-Report-Only` + `Report-To`).
2. ✅ الـCSP **ديناميكي**: في المعاينة بيستبدل رابط الإنتاج بعنوان الـstaging ⇒ المعاينة ما تقدرش تطلب الإنتاج أصلاً.
3. ✅Telemetry: `Report-To: {"group":"csp"}` — المتصفح بيبعت المخالفات (لو Cloudflare Reporting مفعّل).
4. ✅ **إصلاح ٤ نقاط XSS** (مدخلات المستخدم + بيانات خارجية):
   - `octa-core.js` (بحث السهم) · `octa-pages.js` (بحث الرمز · نص آخر تحديث · مصدر الطروحات)
5. ✅ **اختبارات XSS** بـ`assets/tests/xss.test.js` (مدخلات صناعية غير ضارة).

---

## ③ الخطة التدريجية (٤ مراحل — كل مرحلة قابلة للتراجع)

### المرحلة ١ — قياس (مُنجزة ✅)
- الـCSP في Report-Only ⇒ المتصفح بيسجّل المخالفات.
- ⛔ **مش مطلوب** من المستخدم ⇒ مافيش كسر.

### المرحلة ٢ — إزالة `unsafe-inline` من السكربتات (شغل ≥ أسبوعين)
| الخطوة | التفصيل | التقدير |
|---|---|---|
| ٢-١ | نقل الـ١٣ سكربت المضمّن ⇒ ملفات `.js` خارجية (`assets/js/*.js`) | ١ يوم |
| ٢-٢ | `script-src 'self' https://s3.tradingview.com` (بدون `unsafe-inline`) | ١ ساعة |
| ٢-٣ | فحص: `npm test` + المتصفح (390px) على **كل** الصفحات | ٢ ساعة |
| ⛔ | **شرط الانتقال:** المتصفح مابعتش أي مخالفة script-src في ٧ أيام | — |

### المرحلة ٣ — إزالة `onclick` (٧٨ زر)
| الخطوة | التفصيل |
|---|---|
| ٣-١ | `data-action="pick" data-code="XYZ"` بدل `onclick="octaPick('XYZ')"` |
| ٣-٢ | **مستمع واحد** على `document` يوجّه الـ`data-action` (تفويض الأحداث) |
| ٣-٣ | نفس الكلام للأزرار الديناميكية (`.map()` ⇒ `innerHTML` بـ`data-action`) |
| ⛔ | **شرط الانتقال:** `grep -c "onclick=" *.html` = **٠** |

### المرحلة ٤ — Enforce
```js
h.set('Content-Security-Policy', cspPolicy());   // بدل Report-Only
```
- ⛔ **مش قبل المرحلة ٣** (هيكسر ٧٨ زر).
- ⛔ `style-src 'unsafe-inline'` يفضل لحد ما الـinline styles يتحوّلوا لـclasses (أكبر شغل ⇒ مش أولوية).

---

## ④ ليش Enforce دلوقتي = كارثة

- ٧٨ زر `onclick` ⇒ كلهم بيحتاجوا سكربت ⇒ `script-src` بلا `unsafe-inline` ⇒ **الزر ما هيشتغلش**.
- ١٣ سكربت مضمّن ⇒ **نص الصفحة مش هيتنفّذ** ⇒ الموقع هيبقى أفرغ.
- ⛔ ⇒ القاعدة: **Report-Only الأول ⇒ قياس ٧ أيام ⇒ بعدين Enforce**.

---

## ⑤ بديل أسرع (لو الوقت ضيّق): `strict-dynamic` + nonce
- ⛔ **مش مستحسن دلوقتي**: الـnonce لازم يتولّد لكل رد ⇒ تغيير في بنية الـworker + مراجعة كل الـinline scripts ⇒ أعلى مخاطرة من الحالة الحالية.

---

## ⑥ ملاحظات إضافية

- ⛔ الـ`onclick` جوه **سلاسل `innerHTML`** (مش بس في الـHTML الثابت) ⇒ لازم الفحص يشمل `assets/js/*.js` كمان.
- ⛔ `data:` في `img-src` لازم (أيقونات base64) · `blob:` في `worker-src` لازم (Service Worker).
- 📌 `frame-src` لازم يفضل فيه TradingView (الشارت مدمج).
