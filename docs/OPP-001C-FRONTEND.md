# OPP-001C — عقد الواجهة (فلتر الفرص رقم ٨)

> الملفات: `assets/js/octa-opps.js` (جديد) · `assets/css-opps.css` (جديد) · التعديل على `assets/js/octa-pages.js` (سطر واحد)
> ⛔ **مش بنعمل صفحة جديدة** — الفلتر رقم ٨ هو **الذراع الثامنة** (`openArm('opportunity')` ⇒ `ARM_MAP.opportunity` ⇒ `armOpportunity(box)`).
> ⛔ ممنوع تكرار البيانات في تاببين (درس قديم: نفس البيانات مرتين = لبس).

## ١) نقطة الدخول (التعديل الوحيد في `octa-pages.js`)
```js
/* ══════ ⑧ الفرص — أعمل إيه ═══ */
async function armOpportunity(box) {
  /* ⭐ OPP-001: الفلتر رقم ٨ بقى محرّك الفرص بتسع استراتيجيات.
     التنفيذ كله في assets/js/octa-opps.js (ملف مستقل). */
  if (typeof window.renderOppsArm === 'function') {
    window.renderOppsArm(box);
    return;
  }
  ... /* الكود القديم fallback */
}
```
- `index.html`: أضف `<script src="assets/js/octa-opps.js?v=..."></script>` و`<link href="assets/css-opps.css?v=...">`.
- ⛔ `octa-opps.js` لازم يكون **بعد** `octa-core.js` (عشان `octaFetch` و`octaHasToken` يكونوا موجودين).
- ⛔ ممنوع تكتب اسم أداة ذكاء اصطناعي في أي نص ظاهر للمستخدم.

## ٢) سلوك الواجهة
- **٩ تابات مستقلة** (من `/api/opp/strategies`): مضاربة (سوينج) · متوسط الأجل · طويل الأجل · استثمار قيمة · نمو · دخل (توزيعات) · متوازن · محافظ · جريء.
- ترتيب التابات من اليمين لليسار حسب `n` (١..٩).
- **مجموعتان بصريتان**: «مدة الاستثمار» (١-٣) و«الاستراتيجية والمخاطرة» (٤-٩) — فاصل خفيف بين المجموعتين (مش تاب).
- التاب النشط محفوظ في `localStorage` بمفتاح `octa_opps_tab_v1`.
- كل تاب بيجيب بياناته من `/api/opp/list/<key>` — **بدون ما نعمل ٩ طلبات مرة واحدة**.
- عرض من ٣ فرص (الافتراضي) لحد ١٠، مع زر «عرض المزيد».
- فرز: حسب الدرجة · حسب السيولة · حسب المخاطرة · حسب التغير.
- بحث سريع بالاسم أو الرمز (فلترة محلية على النتائج المعروضة).
- فلاتر اختيارية: القطاع · مستوى المخاطرة · المدة.
- حالات واضحة: **Loading** · **Empty** («لا توجد حاليًا فرص تستوفي جميع شروط هذه الاستراتيجية» + سبب مختصر) · **Error** (مع زر إعادة) · **Stale** (البيانات قديمة + تاريخ آخر تحديث).
- ⛔ **ممنوع تجميد الواجهة** أثناء التحديث (التحديث في الخلفية + حالة «آخر تحديث»).
- كل سهم له زر «عرض التحليل» (يفتح كارت السهم الحالي `openStockModal`) — بس لو `octaHasToken()` صح.

## ٣) عقد الـAPI (الباك)
`GET /api/opp/strategies` →
```json
{"ok":true,"model_version":"OPP-001.0","strategies":[
 {"key":"swing","n":1,"name_ar":"مضاربة (سوينج)","group":"مدة الاستثمار","icon":"⚡",
  "horizon_ar":"٣ إلى ١٥ جلسة تداول","horizon_days":[3,15],
  "definition_ar":"…","looks_for_ar":"…",
  "criteria":[{"key":"trend","label_ar":"الاتجاه الفني","weight":25,"points_max":25,"hint_ar":"…","not_ar":"…"}],
  "min_coverage":70,"accept_ar":[…],"reject_ar":[…],"risk_ar":[…],
  "invalidation_ar":[…]}]}
```
⛔ **ممنوع اسم المفتاح `weights`** (فلتر الوصفة بيشيله) — استعمل `criteria[].weight` (مفرد) و`points_max`.
⛔ ممنوع `formula` · `scoring` · `part_scores` · `axis_weight` · `min_liquidity` (كلها بتتشال).

`GET /api/opp/list/<key>` →
```json
{"ok":true,"strategy":"swing","model_version":"OPP-001.0",
 "summary":{"scanned":287,"eligible":41,"shown":10,"total_eligible":41,
            "last_update":"2026-11-10T01:25:25Z","data_from":"2026-10-09",
            "source_status":"ok","note_ar":"…"},
 "items":[{
   "code":"COMI","name":"…","sector":"…","price":128.05,"price_label":"سعر إغلاق ١٠ نوفمبر",
   "session_date":"2026-11-10","change":1.2,"score":78.4,"coverage":85,
   "available_weight":85,"missing":["news"],"grade_ar":"مطابقة مرتفعة",
   "risk_level_ar":"متوسط","risk_score":42,"hold_days":"3–15","state":"watch",
   "reasons":["…","…","…"],
   "criteria":[{"key":"trend","label_ar":"الاتجاه الفني","ratio":0.84,"points":21.0,
                "points_max":25,"weight":25,"evidence":{…},"note_ar":"…"}],
   "data_completeness":{"technical":1.0,"fundamental":0.5,"liquidity":1.0,"news":null},
   "flags":[],"plan":{…},"risks":["…"],"refs":[…]}]}
```

## ٤) أسماء الكلاسات (عقد بين الجافاسكربت و CSS) — لازم يبقى في `assets/css-opps.css`
```
.opps-wrap .opps-summary .opps-sum-item .opps-sum-k .opps-sum-v
.opps-tabs .opps-tab(.on) .opps-tab-i .opps-tab-n .opps-tabs-sep
.opps-toolbar .opps-search .opps-filters .opps-chip(.on) .opps-sort
.opps-list .opps-card(.open) .opps-card-hd .opps-card-code .opps-card-name
.opps-score .opps-score-v .opps-score-l .opps-badge-row .opps-badge
.opps-badge--risk .opps-badge--data .opps-badge--state .opps-badge--horizon .opps-badge--flag
.opps-reasons .opps-reason
.opps-detail .opps-detail-sec .opps-detail-h .opps-detail-b
.opps-plan-grid .opps-plan-cell .opps-plan-k .opps-plan-v
.opps-crit .opps-crit-bar .opps-crit-bar>i .opps-crit-k .opps-crit-v .opps-crit-empty
.opps-empty .opps-loading .opps-error .opps-stale .opps-foot
.opps-critcard .opps-critcard-hd .opps-critcard-ico .opps-critcard-bd .opps-critcard-sec
.opps-critcard-tbl .opps-src .opps-src-item .opps-limits
```
- CSS: tokens من `assets/octa.css` (متغيرات `--ac` `--gold` `--muted` `--bg` …). ⛔ **ممنوع hex مكتوب** — استخدم tokens أو متغيرات جديدة في `:root` بنفس ملف `css-opps.css`.
- RTL دايماً · موبايل ٣٩٠px أول · تبويبات قابلة للتمرير أفقياً على الموبايل.
- الـaccordion (كارت المعايير): `max-height` + `transition` · يحترم `prefers-reduced-motion` · قابل للتشغيل بلوحة المفاتيح (`button` + `aria-expanded`) · **مش modal**.
- تباين ≥ WCAG AA · كل أرقام بخط `tabular-nums` · أي كلمة إنجليزية جوّه جملة عربية تكون **في أقواس**.

## ٥) كارت «كيف اختار OCTA هذه الفرص؟» (في آخر كل تاب)
- مغلق افتراضياً · عنوان + أيقونة معلومات + سهم · بالضغط يتمدد بسلاسة.
- المحتوى ١٢ بند (من مواصفة المالك):
  ① تعريف الاستراتيجية ② مدة الاستثمار ③ نوع الأسهم التي يبحث عنها ④ جدول المعايير والأوزان
  ⑤ كيفية حساب الدرجة ⑥ شروط القبول ⑦ أسباب الاستبعاد ⑧ الحد الأدنى لجودة البيانات
  ⑨ أهم المخاطر ⑩ مصادر البيانات وتواريخ التحديث ⑪ رقم إصدار النموذج ⑫ حدود التحليل
- ④ و⑤ و⑩ و⑪ **محسوبة من الـAPI** (مش نص ثابت).
- ①②③⑥⑦⑧⑨⑫ **نص عربي** من ملف المحتوى.

## ٦) ملف المحتوى (ياسر)
`assets/js/octa-opps-copy.js` ⇒ يصدّر `window.OPS_COPY = { <strategy_key>: {definition_ar, looks_for_ar, accept_ar[], reject_ar[], risk_ar[], invalidation_ar[], limits_ar[]} }`.
⛔ كل نص عربي نظيف (ممنوع أي كلمة إنجليزية خارج الأقواس · ممنوع أي اسم أداة ذكاء اصطناعي · ممنوع مبالغة زي «مضمون» أو «الفرصة الذهبية»).
⛔ كل نص يشرح **حدوده** كمان («مش بيقول إيه»).
