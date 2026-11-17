# SEC-031 · وضع `octa_app.py` — إثبات إنه **مش منشور** ومش مستخدم

> الجولة ١٨ · تاريخ الفحص: ١٧ نوفمبر ٢٠٢٦ · النطاق: **واجهة OCTA** (ريبو `octa`)
> الخلاصة: `octa_app.py` **ملف قديم** في ريبو الباك (`octa-prices`) — **مش** نقطة الدخول
> في الإنتاج، و**مش** مستخدم من أي ملف أو سكربت. ⛔ مافيش تعديل مطلوب.

---

## ① السؤال

هل `octa_app.py` (تطبيق بديل قديم) **منشور** على الإنتاج أو **مستخدم** في أي مسار حيّ؟

## ② الإجابة (مُثبتة بالأدلة)

| # | الدليل | النتيجة |
|---|---|---|
| ١ | `octa_app.py` **مش موجود** في ريبو الواجهة: `git ls-files \| grep octa_app` ⇒ **فارغ** | ⛔ مش جزء من نشر الواجهة (Cloudflare) |
| ٢ | الملف موجود في **ريبو الباك** `/workspace/repos/octa-prices/octa_app.py` (٢٠٬٦٦٣ بايت) | مكانه: الباك بس |
| ٣ | **نقطة الدخول الفعلية في الإنتاج** = `Procfile` (ريبو الباك):<br>`web: gunicorn update_prices:app --bind 0.0.0.0:$PORT --workers 1 --timeout 120` | ✅ `update_prices:app` — **مش** `octa_app:app` |
| ٤ | `update_prices.py:15898` (ريبو الباك) تعليق صريح:<br>«⛔ لازم يتربط هنا (مش في octa_app) — لأن الـProcfile بيشغّل update_prices:app وده **نقطة الدخول الفعلية في الإنتاج**» | ✅ الباك نفسه بيوثّق إن `octa_app` مش نقطة الدخول |
| ٥ | `octa_app.py` **مش مستورَد** من أي ملف: `grep -rn "import octa_app"` ⇒ **فارغ** (كل الملفات) | ✅ مافيش حد بيفتحه |
| ⑥ | `octa_app.py:36-37` بيعمل `import gold_signal; gold_signal.register(app)` — لكن `update_prices.py:15861-15863` بيعمل **نفس** التسجيل (`_gold_mod.register(app)`) | ✅ المسارات اللي بيضيفها `octa_app` (‏`/api/gold/*`) متسجّلة في نقطة الدخول الحقيقية ⇒ **مافيش ميزة ناقصة** |
| ٧ | `octa_app.py:7` (تعليق قديم): «Railway لازم يشغّل: gunicorn octa_app:app» — **يتناقض** مع الـProcfile | ⚠️ **تعليق قديم/مضلّل** — هو مصدر الالتباس (وسبب فتح البند ده) |
| ⑧ | نشر الواجهة (Cloudflare): `wrangler.jsonc` · `wrangler-prod.jsonc` · `wrangler-local.jsonc` · `wrangler-v2.jsonc` ⇒ كلهم `"main": "worker.js"` + أصول ثابتة. ⛔ مافيش أي مرجع للباك ولا لـ`octa_app` | ✅ نشر الواجهة **مش** بيلمس الباك |
| ٩ | سكربتات النشر `tools/deploy.sh` · `tools/cf-deploy.js` · `tools/check-dist.js` ⇒ مافيش أي ذكر لـ`octa_app` ولا لرفع الباك | ✅ الواجهة ما بترفعش الباك |
| ٩ب | CI للباك `.github/workflows/ci.yml`: بيفحص `update_prices.py` + وجود `Procfile` فيه سطر `web:` — **مش** `octa_app.py` | ✅ مسار النشر الوحيد = الـProcfile |
| ١٠ | `AGENTS.md:98` (ريبو الواجهة) بيذكر `octa_app.py` في **شجرة الباك** كملف «مسارات إضافية» | 📌 توثيق قديم — محتاج تصحيح (اختياري) |

## ③ الخلاصة

- ✅ **مش منشور**: نقطة الدخول في Railway هي `update_prices:app` (الـProcfile) — `octa_app.py` ما بيتنفّذش.
- ✅ **مش مستخدم**: مافيش `import octa_app` في أي مكان؛ ووظائفه (تسجيل مسارات الذهب) متسجّلة في `update_prices.py` نفسها.
- ⚠️ **الخطر الحقيقي**: ملف ميت فيه سطر **تعليق قديم** (`octa_app.py:7`) بيقول إن Railway لازم يشغّل `octa_app:app` — لو حد اتّكل عليه وغيّر الـProcfile ⇒ نقطة الدخول هتتغيّر ⇒ سلوك مختلف (مسارات /api/gold/* + أي تعديلات قديمة). ⛔ **التوصية**: حذف `octa_app.py` من ريبو الباك (بقرار المالك) أو تعديل التعليق ليقول «ملف مؤرشف».

## ④ الأرقام / المواضع

| الملف | السطر | النص |
|---|---|---|
| `octa-prices/Procfile` | ١ | `web: gunicorn update_prices:app ...` |
| `octa-prices/octa_app.py` | ٧ | «Railway لازم يشغّل: gunicorn octa_app:app» (تعليق قديم) |
| `octa-prices/octa_app.py` | ٣٦-٣٧ | `import gold_signal` + `gold_signal.register(app)` |
| `octa-prices/update_prices.py` | ١٥٨٦١-١٥٨٦٣ | `_gold_mod.register(app)` (نفس التسجيل في نقطة الدخول الحقيقية) |
| `octa-prices/update_prices.py` | ١٥٨٩٨ | تعليق: «الـProcfile بيشغّل update_prices:app وده نقطة الدخول الفعلية في الإنتاج» |
| `octa/AGENTS.md` | ٩٨ | `octa_app.py ← مسارات إضافية` (شجرة الباك) |
| `octa/wrangler.jsonc` · `wrangler-prod.jsonc` · `wrangler-local.jsonc` · `wrangler-v2.jsonc` | — | `"main": "worker.js"` (مافيش مرجع للباك) |

## ⑤ ما اتعمل في الجولة دي

- ⛔ **مافيش تعديل على الباك** (البند طلب إثبات + توثيق بس).
- ⛔ **مافيش نشر · مافيش لمس إعدادات Cloudflare/Railway**.
- ✅ التوثيق: الملف ده (`docs/SEC-031-OCTA-APP-STATUS.md`).
