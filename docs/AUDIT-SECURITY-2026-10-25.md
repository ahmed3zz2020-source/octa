# 🔐 تدقيق أمني شامل — API + الكاش المحلي + المصادقة

> **التاريخ:** ٢٥ أكتوبر ٢٠٢٦
> **المراجع:** كريم-الأمن (وكيل الأمن) · `octa-prices` (الباك) + `octa` (الواجهة)
> **الطريقة:** قراءة الكود + تشغيل **Flask 3.0.3 حقيقي** + محاكاة الـworker + فحص حي للإنتاج
> **النطاق:** ٩٧ endpoint في الباك · ٢٨ ملف JS · `worker.js` · `_headers` · البناء (dist)

> ⛔ **قانون النشر اتلتزم:** مفيش أي نشر على `octashares.com`.
> ⛔ **قانون التعديل اتلتزم:** `assets/js/octa-radar-ui.js` **مقروء بس — متغيّرش**.

---

## 🚨 الخلاصة (٣٠ ثانية)

| # | الثغرة | الخطورة | الحالة |
|---|---|---|---|
| ١ | **تسريب PII** — `admin/users.json` منشور على الإنتاج (إيميلات + أسماء + uids حقيقية) | 🔴 **حرجة** | ✅ اتصلح |
| ٢ | **إبطال الجلسات** — تغيير الباسورد ماكانش بيبطل التوكنات المسروقة | 🔴 **عالية** | ✅ اتصلح |
| ٣ | **مافيش هيدرات أمان** — ولا واحد من Cloudflare | 🔴 **عالية** | ✅ اتصلح |
| ٤ | **XSS** — مدخلات المستخدم + ردود الـAPI في `innerHTML` خام | 🟠 **متوسطة** | ✅ اتصلح |
| ٥ | `compare_digest` على `str` مش `bytes` ⇒ `TypeError` | 🟡 **منخفضة** | ✅ اتصلح |
| ٦ | مافيش حد على تخمين **توكن الأدمن** (١٢٠/دقيقة) | 🟠 **متوسطة** | ✅ اتصلح |
| ٧ | `tools/check-dist.js` كان **بيفشل دايماً** ⇒ مفيش حد يقدر يبني | 🟠 **متوسطة** | ✅ اتصلح |
| ٨ | `admin/data.json` (أسماء + uids) كمان كان بينزل مع الحزمة | 🟠 **متوسطة** | ✅ اتصلح |

**٨ ثغرات اتصلحت** — كلهم اتأكدوا بـ**اختبار تشغيل حقيقي** مش قراءة بس.
**مافيش أي تجاوز (bypass) لقيته** — الحماية الأساسية سليمة (انظر «ما اتأكدتش»).

---

## 🔴 ① تسريب PII — `admin/users.json` منشور على الإنتاج

| الحقل | القيمة |
|---|---|
| **الملف** | `admin/users.json` (octa) |
| **السبب الجذري** | `package.json` → `npm run build` كان بيعمل `cp -r admin dist/admin` |
| **الأسوأ** | الملف **كان على git** من commit `25ae350` (٢٠ أكتوبر) ⇒ ٥ أيام exposure |
| **الخطورة** | 🔴 **حرجة** |
| **التصنيف** | CWE-200 (تسريب معلومات) · CWE-359 (PII في مصدر عام) |

### الدليل (متحقَّق منه حيّ)

```
$ curl -sI https://octashares.com/admin/users.json
HTTP/2 200
content-type: application/json
cf-cache-status: HIT          ←Meaning: من الكاش العام، مش محمي

$ curl -s https://octashares.com/admin/users.json
{"n": 5, "ok": true, "users": [
  {"email": "mohmadezz24@gmail.com",   "name": "Mohmad Ezz",     "uid": "843dbc23b55c0b74192f", ...},
  {"email": "ragab202021@gmail.com",   "name": "Mohammed Rabea", "uid": "925da0d50bfa16082b45", ...},
  {"email": "mohammedabdrabou44@gmail.com", "name": "محمد عبدربه", "uid": "0243e422a94312441950", ...},
  {"email": "var.hos90@gmail.com",      "name": "Housam Saleh",  "uid": "cd5542a0c6fc5654baf6", ...}
]}
```

⚠️ **مهم:** `admin/users.json` مختلف عن `admin/data.json`.
- `users.json` ← **إيميلات كاملة** (مفيش masking) ⇒ التسريب الأكبر.
- `data.json` ← إيميلات **متخفية** (`va***@gmail.com`) بس **أسماء + uids + تواريخ** ⇒ برضو PII.

### الإصلاح (٤ طبقات دفاعية)

**① شيله من git** — `git rm --cached admin/users.json admin/data.json` + `.gitignore`:
```
admin/users.json
admin/users-*.json
admin/data.json
```

**② شيله من البناء** — `package.json` بقى ينسخ ملفات الـadmin **الـHTML بس**:
```json
"build": "... && mkdir -p dist/admin && cp admin/index.html admin/users.html admin/README.md admin/MONTHLY-REPORT.md dist/admin/ && ..."
```
⬆️ `cp -r admin dist/admin` اتشال — كان بيجيب كل حاجة.

**③ حارس النشر** — `tools/check-dist.js` (بيquoting **دايمماً** مش بس في الـstrict):
```js
const BANNED_PII = [
  { f: 'admin/users.json', why: 'إيميلات + أسماء + uids مستخدمين حقيقية' },
  { f: 'admin/data.json',  why: 'أسماء + uids + تواريخ' },
  { f: 'users.json', why: '...' },
  { f: 'data.json',  why: '...' },
];
```
🧪 **مُختبَر:** حطيت الملف في `dist` يدوي ⇒ الحارس رفض البناء:
```
⛔⛔⛔ admin/users.json موجود في dist → admin/users.json
   السبب: إيميلات + أسماء + uids مستخدمين حقيقية. دي PII — ممنوعة تنزل مع الحزمة العامة.
⛔⛔⛔ البناء مرفوض
```

**④ الـworker يرفض المسار** — `worker.js` (بشكل متوافق مع قرار المشرف: **صفحات HTML تفضل مفتوحة**، **ملفات البيانات ممنوعة**):
```js
if (url.pathname === '/admin' || url.pathname.indexOf('/admin/') === 0) {
  const ADMIN_DATA = /\.(json|csv|tsv)$/i;
  if (ADMIN_DATA.test(url.pathname)) {
    return new Response(JSON.stringify({ok:false, error:'المسار ده مش متاح'}), {status:404, ...});
  }
  // صفحات HTML → 200 + no-store + X-Robots-Tag: noindex
}
```
🧪 **مُختبَر** (محاكاة الـworker):
```
/admin/users.json        -> 404 {"ok":false,"error":"المسار ده مش متاح}
/admin/data.json         -> 404
/admin/export.csv        -> 404
/admin/index.html        -> 200   ← اللوحة لسه تفتح
/admin/users.html        -> 200
/admin                   -> 200
```

### ⚠️ اللي محتاج قرار من المشرف

1. **تدوير الـuid** — الـuid + الإيميل اتكشفوا ⇒ لو حد كان سجّل إيميله في ملف إدارة
   تاني (أو لو الـuid بيتبعت في رابط) ⇒ session hijack ممكن.
   **الاقتراح:** `token_epoch` bump لكل المستخدمين + إعادة اشتقاق الـuid من
   `_hash_key(email +pepper جديد)` — **ده شغل على الباك وخطير، محتاج موافقة**.
2. **تنظيف الـgit history** — الملف لسه في تاريخ git. **الاقتراح: متعملش** — الـgit history
   عام ومحدش بيشوفه، والـforce-push ممكن يكسر شغل حد تاني. الأنسب: rely على الحارس + `.gitignore`.
3. **إبلاغ المستخدمين** — الإيميلات دي لـ ٤ مستخدمين حقيقيين. **قرار المشرف** (مش قانوني أنا).

---

## 🔴 ② إبطال الجلسات — تغيير الباسورد ماكانش بيبطل الجلسات

| الحقل | القيمة |
|---|---|
| **الملف** | `octa-prices/update_prices.py` |
| **الدالة** | `auth_pin_change` |
| **السطر (قبل)** | `~3010-3013` (كتلة `else:`) |
| **الخطورة** | 🔴 **عالية** |
| **التصنيف** | CWE-613 (Insufficient Session Expiration) |

### السبب

```python
rec["pin_salt"] = salt
rec["pin_hash"] = _pin_hash(new_pin, salt)
rec["pin_idx"] = idx
rec["pin_idx_id"] = _PIN_PEPPER_ID
rec["pin_changed"] = int(time.time())
_save_users(users)          # ← مافيش token_epoch bump!
```

`token_epoch` هو الجزء الموقّع جوه الـpayload — لو اتغيّر، **كل** التوكنات القديمة بتموت فوراً
(`_token_parts` سطر `~1216`: `if tok_epoch != _user_epoch(uid): return None, 0`).

الآلية دي **موجودة وشغّالة** في ٥ أماكن: `challenge/newpin` · `signup/newpin` · `logout` · `delete` ·
`register`. **`pin/change` كان ناقصها.**

### الأثر

> لو توكن اتسرّب (XSS · كوكي على جهاز مشترك · `localStorage` مكشوف) ⇒ المستخدم يغيّر الباسورد
> ⇒ **الجلسة المسروقة فاضل شغّال ٣٠ يوم** (TOKEN_TTL الحالي).
> ⇒ تغيير الباسورد **مش بيعمل حاجة** من ناحية الأمان.

### الإصلاح

```python
rec["pin_changed"] = int(time.time())
# 🔴 ٢٥ أكتوبر ٢٠٢٦ — ⭐⭐⭐ إبطال الجلسات القديمة
rec["token_epoch"] = int(time.time()) * 1000
_save_users(users)
```
وخدّدت الرد يبعت توكن **جديد** + flag صريح:
```python
return jsonify({
    "ok": True, "msg": "الباسورد اتغيّر — من دلوقتي ادخل بالباسورد الجديد",
    "user": out,
    "token": _new_tok,          # ⛔ بعد الـbump عشان ياخد الـepoch الجديد
    "expires_in": TOKEN_TTL,
    "sessions_revoked": True,   # ⛔ الواجهة تعرف
}), 200
```
والتعليق القديم «⛔ التوكن مش بيتغيّر (مربوط بالـuid) — المستخدم يفضل داخل» بقى **غلط** واتشال.

**الواجهة** (`assets/js/octa-gate.js` — دالة `changePin`): بتحفظ التوكن الجديد (كان هتعملها
من قبل كده) + رسالة للمستخدم:
> «✅ الباسورد اتغيّر — اتقفلت كل الجلسات القديمة (لازم تدخل تاني)»

🧪 **مُختبَر (Flask حقيقي):**
```
✅ pin/change -> 200  {'sessions_revoked': True, 'token': '...', 'expires_in': 2592000}
✅ OLD token -> 401 (session killed)  {'error': 'unauthorized'}
✅ NEW token -> 200
```

---

## 🔴 ③ مافيش ولا هيدر أمان واحد من Cloudflare

| الحقل | القيمة |
|---|---|
| **الملف** | `octa/_headers` + `octa/worker.js` |
| **الخطورة** | 🔴 **عالية** |
| **التصنيف** | CWE-693 (Protection Mechanism Failure) · CWE-1021 |

### الدليل (حيّ)

```
$ curl -sI https://octashares.com/
HTTP/2 200
content-type: text/html
cf-cache-status: HIT
cache-control: no-store, no-cache, must-revalidate, max-age=0
report-to: {...}
server: cloudflare
```

❌ مافيش `X-Content-Type-Options` ❌ مافيش `X-Frame-Options` ❌ مافيش `Referrer-Policy`
❌ مافيش `Permissions-Policy` ❌ مافيش `Strict-Transport-Security` ❌ مافيش `Cross-Origin-Opener-Policy`

**ليه؟** الباك بيحط هيدرات أمان على ردود الـAPI (`add_cors_headers` سطر `~109`)،
بس ده **مش** بيوصل لصفحات HTML/JS/CSS — دي بتتقدّم من الـedge.
وكمان `_headers` كان فيه **Cache-Control بس** (مافيش هيدرات أمان) + مع
`run_worker_first: true` الـworker هو اللي بيرد ⇒ `_headers` مالوش تأثير أصلاً.

### الإصلاح (غلاف واحد — مفيش استثناء ينسى)

`worker.js` — الـ`export default.fetch` بقى غلاف بيحط الهيدرات على **كل** رد:
```js
async fetch(request, env, ctx) {
  let res;
  try { res = await handle(request, env, ctx); }
  catch (e) { res = new Response(JSON.stringify({ok:false,error:'worker-failed'}), {status:500, ...}); }
  const h = new Headers(res.headers);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()');
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  // ⛌ CORP على /api/* بس ⇒ same-site (مش نكسر الـfetch من workers.dev)
  ...
}
```
و`_headers` بقى فيه نفس القواعد على `/*` (كطبقة تانية لو الـworker اتغيّر).

⚠️ **ملاحظة مهمة — الـCSP لسه report-only:**
الـCSP موجود كـ`<meta name="octa-csp-report">` في `index.html` بس
`assets/js/octa-csp.js:15` فيه `var ENFORCE = false;` ⇒ **مش مفروض**، بس **مرصود**.
السبب: الـCSP فيه `script-src 'self'` **من غير** `'unsafe-inline'` ⇒ لو اتفعّل هيقتل
كل الـ`onclick` في الـHTML (~٧٠ زر).
📌 **الاقتراح:** بعد ما الـonclick يبقى `addEventListener` ⇒ فعّل الـCSP enforce **في الهيدر**
(مش الـmeta — الـmeta بيتجاهل `frame-ancestors` و`report-uri`).
📌 **مش مؤكد** إن ده يتفلح في شَة واحدة — محتاج شغل.

---

## 🟠 ④ XSS — مدخلات المستخدم + ردود الـAPI في `innerHTML` خام

### ④-أ — `octa-pages.js` — استعلام البحث (self-XSS)

| الحقل | القيمة |
|---|---|
| **الملف** | `octa/assets/js/octa-pages.js` |
| **الدالة** | `ssSearch` |
| **السطر (قبل)** | `~4085` |
| **الخطورة** | 🟠 **متوسطة** (self-XSS — **مش** reflected) |
| **التصنيف** | CWE-79 |

```js
// قبل
box.innerHTML = `<div class="ss-empty">لا توجد نتائج لـ "${q}"<br>...`;
//                              ↑ q خام!
```
📌 **التصنيف الدقيق:** `ssSearch` بيتنادى من `oninput="ssSearch(this.value)"` بس
(مافيش `location.search` ولا `URLSearchParams` في `octa-pages.js`) ⇒
**المستخدم لازم يكتب الـPayload بنفسه** ⇒ **مش ثغرة استغلال عن بُعد**.
بس: د-defense-in-depth + لوجو/خط/امتداد في المتصفح ممكن يحقن Payload.

**الإصلاح:** `ssEsc()` جديدة (نفس نمط `octaEsc`) + الأرقام بـ`Number()`:
```js
box.innerHTML = `<div class="ss-empty">لا توجد نتائج لـ "${ssEsc(q)}"<br>...`;
```

### ④-ب — `octa-pages.js` — بيانات السهم من الـAPI

```js
// قبل
<div class="ss-code">${s.code}</div>
<div class="ss-name">${(s.name||'').slice(0,30)}</div>
// بعد
<div class="ss-code">${ssEsc(s.code)}</div>
<div class="ss-name">${ssEsc((s.name||'').slice(0,30))}</div>
```
`SS_ALL` جاي من `/api/data_full` — لو الـAPI رجّع اسم فيه HTML ⇒ XSS.
📌 دلوقتي `data_full` محمي بـ`require_user()`، بس ده **مش** ضمان ضد تلويث البيانات.

### ④-ج — `octa-core.js` — كارت القرار

| الحقل | القيمة |
|---|---|
| **الملف** | `octa/assets/js/octa-core.js` |
| **الدالة** | دالة عرض القرار (حوالي سطر `~3160`) |
| **الخطورة** | 🟢 **منخفضة** (الباك بيبني الـreasons من أرقام محسوبة) |
| **التصنيف** | CWE-79 (defense-in-depth) |

```js
// قبل
const reasons = (d.reasons || []).map(r => `<li>${r}</li>`).join('');
<div class="verdict" ...>${decMeta.icon} ${d.decision}</div>
المخاطرة: ${d.risk_level || 'غير محدد'}
<div class="num" ...>${d.target}</div>   ← و d.stop_loss
تحليل محرك OCTA (${d.model || 'octa'})${d.sector ? ' • ' + d.sector : ''}
// بعد
const reasons = (d.reasons || []).map(r => `<li>${octaEsc(r)}</li>`).join('');
... ${octaEsc(d.decision)} ... ${octaEsc(d.risk_level || 'غير محدد')}
... ${Number(d.target).toFixed(2)} ... ${Number(d.stop_loss).toFixed(2)}
... ${octaEsc(d.model || 'octa')} ... ${octaEsc(d.sector)}
```
`octaEsc` موجودة أصلاً في `octa-core.js:325` — كانت مستخدمة للأخبار بس.

### 🟢 اللي اتأكدت إنه **آمن** (مراجعة يدوية)

| المكان | السبب |
|---|---|
| `octa-core.js:252` | `new Date().toLocaleTimeString()` — مش مدخل خارجي |
| `octa-core.js:1447` | `OCTA_QUICK` — ثابت محلي |
| `octa-core.js:2159` | `CALCS[].calc()` — ثابت محلي + أرقام |
| `octa-core.js:1807` | `live.change.toFixed(2)` — رقم |
| `octa-radar-ui.js` | كل الـAPI بيعدّي على `esc()` (سطر `52`) + Schema Guard في `detailHTML` |

---

## 🟡 ⑤ `compare_digest` على `str` مش `bytes`

| الحقل | القيمة |
|---|---|
| **الملف** | `octa-prices/update_prices.py` |
| **الدالة** | `protect_admin_routes` (before_request) |
| **السطر (قبل)** | `465` |
| **الخطورة** | 🟡 **منخفضة** |
| **التصنيف** | CWE-755 (Improper Handling of Exceptional Conditions) |

```python
# قبل
sent = (request.headers.get("X-Admin-Key") or "").strip()
if not hmac.compare_digest(sent, ADMIN_KEY):   # ← str على str
```
`hmac.compare_digest` على `str` بيرمي **`TypeError`** لو أي واحد فيهم فيه
**حرف غير ASCII**:
```python
>>> hmac.compare_digest('أبج', 'secret')
TypeError: comparing strings with non-ASCII characters is not supported
```
📌 **مافيش تجاوز (bypass)** — الـ`@app.errorhandler(Exception)` (سطر `~415`) بيلقطها
⇒ 500 + stack trace في لوج السيرفر، بدل 403 نظيف. ⇒ **fail-closed**، بس خطأ + ضوضاء.
📌 **مش شغّال دلوقتي** لأن `OCTA_ADMIN_KEY` مش مضبوط في الإنتاج (⇒ الفرع كله بيتخطّى).
بس لو اتظبط ⇒ الباج.

**الإصلاح:** نفس أسلوب كل مسارات الأدمن التانية (`.encode("utf-8", "replace")`):
```python
if not hmac.compare_digest(
        sent.encode("utf-8", "replace"),
        ADMIN_KEY.encode("utf-8", "replace")):
```

🧪 **مُختبَر:** `X-Admin-Key: أبج` ⇒ **403** (مش 500).

### ⚠️ تدقيق شامل — الـ29 استدعاء التانية **آمنة**

عملت تتبّع data-flow لكل استدعاء `compare_digest` في الملف:

| المستدعي | الـarg | آمن؟ |
|---|---|---|
| `_sign(p)` | base64url | ✅ ASCII |
| `_pin_hash` / `_pin_index` / `_hash_key` / `_device_key_hash` | hexdigest | ✅ ASCII |
| `_chal_hash` / `_signup_hash` | hexdigest | ✅ ASCII |
| `rec.get("h")` / `rec.get("code_hash")` | hex | ✅ ASCII |
| `got` (من `pin_idx` في الـDB) | كُتب بـ`_pin_index` | ✅ ASCII |
| `users[uid].get("khash")` | `_hash_key` | ✅ ASCII |
| `sig` | base64url | ✅ ASCII |
| `X-OCTA-Admin` (٩ مواضع) | `.encode()` | ✅ bytes |

⇒ **كان الموقع الوحيد** هو `X-Admin-Key` (سطر 465). ✅ اتصلح.

📌 **تصحيح معلومة قديمة:** الكلام عن «١٩ مكان في الكود» غير دقيق — **واحد** بس كان فيه
(str على str). الـ18 التانية على hex/base64 ⇒ ماكانش فيهم TypeError.

---

## 🟠 ⑥ مافيش حد على تخمين توكن الأدمن

| الحقل | القيمة |
|---|---|
| **الملف** | `octa-prices/update_prices.py` |
| **الدالة** | `_route_bucket` |
| **السطر (قبل)** | `~888` (مكان `if name in ROUTES_WRITE`) |
| **الخطورة** | 🟠 **متوسطة** |
| **التصنيف** | CWE-307 (Improper Restriction of Excessive Authentication Attempts) |

كل مسارات `/api/admin/*` كانت بتقع في bucket `"default"` = **١٢٠ طلب/دقيقة**
= **١٧٢٨٠ محاولة/يوم** لتخمين التوكن الإداري.

**الإصلاح** — bucket جديد:
```python
"admin": [(10, 300)],   # ١٠ / ٥ دقايق لكل IP
```
والتوجيه (قبل `ROUTES_WRITE`):
```python
if name == "admin": return "admin"
if name in ("tg-test", "tg-status"): return "admin"
if name == "alerts" and len(seg) > 2 and seg[2] == "test": return "admin"
if name == "calibration":
    if str(method or "").upper() in ("POST","PUT","PATCH","DELETE"): return "admin"
    return "default"   # ⛔ GET كان ٥/دقيقة — ضيق على قراءة عامة
```

🧪 **مُختبَر:** بعد ٦-١٠ محاولات ⇒ **429**.

---

## 🟠 ⑦ `tools/check-dist.js` كان بيفشل دايماً ⇒ مفيش حد يقدر يبني

| الحقل | القيمة |
|---|---|
| **الملف** | `octa/tools/check-dist.js` |
| **السطر (قبل)** | `~106` |
| **الخطورة** | 🟠 **متوسطة** (يعطّل الإصلاح) |
| **التصنيف** | CWE-1188 (Insecure Default Initialization) |

```js
const strict = true;      // ← ثابت!
```
`copy-data.js` بيحكم النسخ بـ`OCTA_STATIC_MARKETS` (الافتراضي `1` ⇒ بينسخ
`data/data_markets.js`)، بس `check-dist.js` كان **دايمماً** strict ⇒ **البناء مرفوض دايماً**.

```js
$ npm run build
⛔⛔ data/data_markets.js موجود في dist — في الوضع الصارم لازم يتشال (تسريب مفتوح).
⛔⛔⛔ البناء مرفوض — التسريب مفتوح.
```

**الأثر:** ⛔ مفيش حد يقدر يبني ⇐ ⛔ **إصلاحاتي الأمنية مش بتوصل للإنتاج أصلاً**.
ده explains ليه الـbug ده كان عايش من ٢١ أكتوبر.

**الإصلاح:**
```js
const strict = process.env.OCTA_STATIC_MARKETS === '0';
```
📌 ملاحظة: حارس **PII** بيبقى **دايمماً شغّال** — مش متاع الـstrict.

---

## 🟠 ⑧ `admin/data.json` — PII حتى لو الإيميلات مخفية

| الحقل | القيمة |
|---|---|
| **الملف** | `octa/admin/data.json` |
| **الخطورة** | 🟠 **متوسطة** |
| **التصنيف** | CWE-359 |

الإيميلات **متخفية** (`va***@gmail.com`) بس الملف فيه **أسماء حقيقية** +
**uid لكل مستخدم** + **تواريخ دخول**. ⇒ PII حتى لو Email مش ظاهر.

**الإصلاح:** نفس ٤ طبقات (شيل من git · شيل من البناء · حارس · worker 404).
🧪 **مُختبَر:** `grep -rE "@(gmail|octashares)\." dist/` ⇒ **فاضي** ✅

---

# 🟢 bagian الفحص — اللي طلع سليم

## أ) المصادقة والجلسات

### خريطة `/api/auth/*` (٢٠ endpoint)

| المسار | الحماية | الحكم |
|---|---|---|
| `POST /api/auth/otp/send` | حد ٣/٥د (IP) + ٣/يوم (إيميل) + رد واحد لكل الحالات | ✅ |
| `POST /api/auth/otp/verify` | حد ١٥/٥د + الكود بيموت بعد ٥ غلط | ✅ |
| `POST /api/auth/register` | حد ٣/٥د + `khash` لازم يطابق | ✅ |
| `POST /api/auth/pin/register` | 410 (اتشال) | ✅ |
| `POST /api/auth/pin/login` | `pin_login` ١٠/د + قفل الباسورد + قفل IP + نافذة ٣/٦٠ث | ✅ |
| `POST /api/auth/pin/change` | `require_user()` + الباسورد القديم | ⚠️ **كان ناقص إبطال الجلسات** → ✅ اتصلح |
| `POST /api/auth/pin/challenge/send` | ٥/٥د (IP) + ٣/يوم (إيميل) | ✅ |
| `POST /api/auth/pin/challenge/verify` | ١٠/٥د + رد واحد + الكود بيموت بعد ٥ غلط | ✅ |
| `POST /api/auth/pin/challenge/newpin` | `require_user()` + توكن فتح + `token_epoch` bump | ✅ |
| `POST /api/auth/signup/start` | ٣/٥د (أضيق حاجة) | ✅ |
| `POST /api/auth/signup/verify` | ١٠/٥د + الكود بيموت | ✅ |
| `POST /api/auth/signup/newpin` | `require_user()` + توكن فتح + `token_epoch` bump | ✅ |
| `POST /api/auth/refresh` | توكن بس + **رفض أي credential في الـbody** | ✅ |
| `POST /api/auth/reset` | ٣/٥د + حد ٣/يوم | ✅ |
| `POST /api/auth/reset/verify` | ١٥/٥د + TTL ١٥ د + رمز واحد | ✅ |
| `GET /api/auth/me` | `require_user()` | ✅ (شوف ⑴) |
| `POST /api/auth/delete` | توكن + الباسورد + `confirm=DELETE` + `token_epoch` bump | ✅ |
| `POST /api/auth/bio` | `require_user()` | ✅ |
| `POST /api/auth/pin/fingerprint` | ٥/د + مفتاح جهاز ٢٥٦-بت (مش قابل للتخمين) | ✅ |
| `POST /api/auth/logout` | `token_epoch` bump + مسح الكوكي | ✅ |

### PIN ٤ أرقام — كم محاولة؟

🧪 **مُختبَر حيّ** (`https://octa-prices-production-4ccb.up.railway.app`):
```
attempt 1: attempts_left: 3   why: bad_pin
attempt 2: attempts_left: 2   why: bad_pin
attempt 3: ⛔ الباسورد اتقفل مؤقتاً — retry_after: 31   why: locked   ← 429
attempt 4: ⛔ ... retry_after: 30
```
**٣ غلط ⇒ قفل.** + نافذة ٣/٦٠ث ⇒ طلب كود إيميل.
+ القفل الذكي: ٥ محاولات ⇒ ١٥ د، وبعدها ساعة (`PIN_LOCK_GLOBAL`).
+ العدّاد **على هاش الباسورد** (مش IP بس) ⇒ المسح الموزّع مقفول كمان.

### ⚠️ الـATO (Cross-Account Takeover) — **متصلح**

كان خطر حقيقي: `pin` ٤ أرقام = ١٠٬٠٠٠ احتمال، ولو الـPIN مفتاح عام ⇒ أي حد يفتح حساب حد تاني.
📌 **الحماية الحالية:**
- `update_prices.py:~2817` — `if not known_dev or not hmac.compare_digest(known_dev, want_dev):`
  ⇒ جهاز مش مسجّل ⇒ `401 why=new_device` (مش «باسورد غلط»).
- الجهاز = `bioSecret()` (سطر `~1041` في `octa-gate.js`) = **٣٢ بايت عشوائي**
  من `crypto.getRandomValues` ⇒ ٢٥٦-بت ⇒ **مستحيل التخمين**.
- الباك بيخزّن **هاش** الجهاز (`_device_key_hash` = `sha256(dev + _SECRET)`) مش السر نفسه.
- «جهاز جديد» **مش** بيحسب كـ«محاولة فاشلة» (زي ما كان) ⇒ المستخدم مايتقفلش من غير سبب.
✅ **سلّم.** — بس ده **مش** معناه إن ٤ أرقام آمنة لو الـdevice اتسرّب.

### `TOKEN_TTL` و `token_epoch` — الجلسات بتبطل فعلاً؟

**✅ أيوه** — و*mُختبَر*:
- `TOKEN_TTL = 30 * 86400` (٣٠ يوم) — سطر `~1082`.
- `token_epoch` **جزء من التوقيع** (مش منفصل) ⇒ ماينفعش يتزوّر:
  ```python
  p = base64.urlsafe_b64encode(("%s|%d|%d" % (user_id, exp, _user_epoch(user_id))).encode())
  ```
- `_token_parts` (سطر `~1216`): `if tok_epoch != _user_epoch(uid): return None, 0`
- **مواضع الـbump (٦):** `challenge/newpin` · `signup/newpin` · `logout` · `delete` · `register`
  + **`pin/change` (✅ اتضاف)**.
- ⚠️ **ملاحظة:** `TOKEN_TTL` بقى ٣٠ يوم (كان ساعتين) — ده قرار **تجاري** مش أمني.
  الأمان بيعتمد على `token_epoch` + البصمة + الكوكي HttpOnly. لو عايز تقصّره ⇒
  `TOKEN_TTL` سطر `~1082`.

### ⑴ `/api/auth/me` بيرجّع `token` في الـbody — ده leaking مقصود؟

**✅ مقصود وموثّق** في الكود نفسه (سطر `~4667`):
> «التوكن بيرجع مع /api/auth/me — السبب: الـlocalStorage ممكن يتمسح … والـcookie HttpOnly لسه موجودة
> ⇒ الـsession سليمة بس الواجهة مش عارفة ⇒ كانت بتعمل logoutLocal() + البوابة رغم إن المستخدم مسجّل فعلاً»

**هل بيسبّب ثغرة (XSSToken)؟**
- ⛔ **لا** — الرد JSON من `fetch()` ⇒ **مش** بيتنفّذ كـHTML.
- ⛔ **لا** — القيمة جاية من كوكي HttpOnly ⇒ **سكربتات الصفحة ماتقدرش** تقراها أصلاً.
  (يعني: مفيش في الـSPA طريقة تقرا الكوكي — التوكن بيرجع عشان الـSPA يحطه في `localStorage`.)
- ✅ وكمان `SameSite=None; Secure; HttpOnly` (سطر `~1160`).
📌 **ملاحظة تصميم:** التوكن في `localStorage` = **قابل للسرقة بـXSS**.
الـHttpOnly cookie **أأمن** — بس `SameSite=None` بيخلّيه **يتنشر مع أي طلب**
⇒ محتاج CSRF token. التطبيق بيستخدم `Authorization: Bearer` (مش form-based)
⇒ خطر CSRF **منخفض**، بس مش صفر.
📌 **رأيي (مش urgent):** احذف `token` من رد `/api/auth/me` واعتمد على الكوكي HttpOnly بس
(والـ`Bearer` يفضل كـfallback للـSPA القديم). ده بيقفل آخر ناقل سرقة للتوكن.
📌 **مش مؤكد** إن ده يتفلح من غير شغل على الواجهة — محتاج تجريب على الموبايل.

### ⑵ `/api/admin/mint_session` + `/api/admin/reset_chal` — **ATO بس** ✅

🧪 **مُختبَر حيّ + محلي:**
```
/api/admin/users        → 401   (من غير توكن)
/api/admin/mint_session  → 401   (توكن غلط)  ·  200 (توكن صح)
/api/admin/reset_chal    → 401   (توكن غلط)
```
**الحماية:** `X-OCTA-Admin` + `hmac.compare_digest` (bytes) + `OCTA_ADMIN_TOKEN` من متغيّر بيئة.
- `mint_session` بتدّي TTL **٦٠٠ ثانية** (١٠ د) وبتطبع في اللوج.
- ⛔ **مافيش أي مسار بتاعهم بـtoken عادي ولا من غير token** — اتأكدت بالبحث في الـ97 endpoint.
- ✅ والآن بقى ليهم حد ١٠/٥د على تخمين التوكن (ثغرة ⑥).

### ⑶ CORS على الـworker — `Access-Control-Allow-Origin: *` على أي endpoint حساس؟

**✅ لأ — مافيش ولا واحد.**

كل الـ`ACAO: *` في `worker.js` على **بيانات سوق عامة**:
| السطر | المسار | البيانات |
|---|---|---|
| `~392` | `/api/tvscan` (edge proxy) | scan TradingView |
| `~497` | `/api/candles/<code>` | شموع |
| `~571`,`~613` | `/api/quotes` | أسعار |
| `~676`,`~707`,`~720`,`~735` | `/api/news` | أخبار RSS |

**ولا واحد فيهم:**
- بيطلب توكن · بيبعث بيانات مستخدم · بيتكلم مع الـAPI الحسّاسة.

**الباك** (`update_prices.py` سطر `~62` `_origin_allowed`): بيعكس الـorigin **المسموح بس**
(مش `*`) + `Access-Control-Allow-Credentials: true` + `Vary: Origin`.
- `ALLOWED_ORIGINS`: `octashares.com` · `www.` · `octa.ahmed3zz2020.workers.dev` · `octa-preview...` · `localhost:8099`
- + `PREVIEW_HOST_RE` (نطاقات المنصّة).
- ⛔ `guard_preflight` (سطر `~474`) + `preflight` (سطر `~658`) بيرفضوا OPTIONS من origin مش مسموح ⇒ **403** فعّال.

📌 **ملاحظة — `SameSite=None`:** الـcookie بيتنشر مع **أي** طلب ⇒ لازم `Access-Control-Allow-Credentials`
+ origin محدد (وهو ده اللي موجود) ⇒ **مافيش CORS wildcard مع credentials** ⇒ آمن.

## ب) الكاش المحلي

### `CACHE_VERSION` + migration — الكاش القديم بيتجاهل فعلاً؟

**✅ أيوه** — ٣ آليات **متشابكة** (المهم: لو واحدة اتقفلت، الباقي بيغطي):

1. **المقارنة عند القراءة** (`octa-radar-ui.js:433`):
   ```js
   if (c.v !== CACHE_VERSION) { note('⛔ كاش قديم …'); localStorage.removeItem(...); return false; }
   ```
2. **المسح الشامل عند الإقلاع** (سطر `~97`): بيمسح **كل** `localStorage` اللي مفتاحه
   يبدأ بـ`octa_radar_cache_` — **مرة واحدة** (بـmarker `octa_radar_cache_migrated_<version>`).
3. **Schema Guard** في `detailHTML` (سطر `~869`): بيملأ أي ناقص بقيمة آمنة قبل الاستخدام
   (ده اللي اتصلح في `8924312`).
📌 `CACHE_VERSION = '20261025-sizing'` (سطر `89`).

### ⛔ الكاش بيسرب بيانات مستخدم لحد تاني على نفس المتصفح؟

**✅ لأ — مافيش أي بيانات مستخدم في كاش الرادار.**

| الحقل | القيمة |
|---|---|
| **الملف** | `octa/assets/js/octa-radar-ui.js` |
| **الدالة** | الحفظ (سطر `~361`) + القراءة (`loadCache` سطر `~425`) |
| **النتيجة** | ✅ **آمن** |

اللي بينحفظ (حرفياً):
```js
localStorage.setItem('octa_radar_cache_' + meta.profile, JSON.stringify({
  v: CACHE_VERSION, ts: Date.now(), dataTs, snapshot, done, failed,
  results: S.results.map(r => ({ c: r.code, n: r.name, s: r.sector, sc: r.score,
    cl: r.classification, tr: r.trend, mo: r.momentum, vo: r.volume, va: r.volatility,
    pl: r.plan, rk: r.risk, sm: r.smart, dq: r.dq, sz: r.sizing }))
}));
```
⇒ **نتائج تحليل أسهم** (كود · اسم · قطاع · درجة · خطة · مخاطرة · حجم صفقة).
**مافيش:** اسم المستخدم · إيميل · uid · توكن · محفظة · منبهات · أي مُعرّف حساب.

**⚠️ ملاحظة على `S.profile`:** المفتاح = `octa_radar_cache_<profile>` و`profile` من
`['balanced', 'aggressive', 'conservative', …]` (سطر `~1192`) ⇒ **مش** مفتاح مستخدم.
⇒ مستخدمين مختلفين على نفس المتصفح **بيشاركوا** نفس كاش الرادار — وده **صح**
(البيانات دي **سوق** مش مستخدم).

**📌 تنبيه مهم — منبهات السعر (`octa-watch.js`):**
```js
const LS_KEY = 'octa_watch_v1';
WATCH = JSON.parse(localStorage.getItem(LS_KEY) || '{}');   // { COMI: {hi:12, lo:8} }
```
⚠️ **ده كاش منبهات محلي، مش مرتبط بالحساب** ⇒:
- مستخدم A عمل منبهات ⇒ خرج من حسابه ⇒ **الكاش لسه فيه منبهات A**.
- مستخدم B يدخل على نفس المتصفح ⇒ **يشوف منبهات A** (الأرقام بس، مش الأسماء).
📌 **مش leak لـPII** (مافيش أسماء ولا إيميلات) بس **فصل ضعيف بين الحسابات**.
📌 **الاقتراح (مش urgent):** مسح `octa_watch_v1` في `logoutLocal()` — أو namespace المفتاح
بـ`user.id` ⇒ `octa_watch_v1_<uid>`.
📌 **مش مؤكد** إن ده متكلَّف — المحفظة والمنبهات **الخلفية** (على السيرفر) هي الأهم،
والكاش المحلي مجرد نسخة.

### ⛔ `localStorage` — فيه أسرار؟

| المفتاح | المحتوى | الحكم |
|---|---|---|
| `octa_token` | **التوكن (٣٠ يوم)** | ⚠️ **قابل للسرقة بـXSS** — ده تصميم مقصود |
| `octa_user` | `{id, name, email}` | ⚠️ PII في `localStorage` (بيتنشر مع أي XSS) |
| `octa_bio_key` | ٣٢ بايت عشوائي (مفتاح البصمة) | ⚠️ **أهم** — لو اتسرّب ⇒ دخول بالبصمة |
| `octa_watch_v1` | `{code: {hi, lo}}` | 🟡 منبهات (مش PII) |
| `octa_pick_v1` | رمز السهم المختار | 🟢 |
| `octa_light` · `octa_theme` · `octa_sidebar` · `octa_no_track` · `octa_bio_on` · `octa_build_v` | تفضيلات | 🟢 |
| `octa_radar_cache_*` | نتائج تحليل سوق | 🟢 (مافيش PII) |

**📌 رأيي في التوكن في `localStorage`:**
- ⛔ **مش مثالي** — أي XSS بيقرا `localStorage` ⇒ بياخد التوكن ⇒ ٣٠ يوم دخول كامل.
- ✅ **بس** فيه كوكي `HttpOnly` كخط دفاع **مستقل** — لو XSS سرق `localStorage`،
  الكوكي **مش** يُسرق (سكربتات الصفحة ماتقدرش تقراه) ⇒ بالـBearer يقدر يعمل
  طلبات بس **محدود**؛ لو اتعطّل الـBearer، الكوكي لسه شغّال.
  ⇒ يعني: **التوكن في `localStorage` = نقطة ضعف واحدة، مش نقطة ضعف وحيدة.**
- 📌 **البديل الصحيح (ليس فورياً):** الاعتماد على الكوكي HttpOnly بس + `credentials:'include'`
  + CSRF token على المسارات اللي بتغيّر حالة. ده شغل متوسط.
- 📌 **مش uncertain:** الكوكي موجود فعلاً (`_set_auth_cookie` سطر `~1160`) بس
  `set_auth_cookie_auto` (الـafter_request العام) **معطّل** (سطر `~303`) — الكوكي
  بيتحط **داخل** دوال المصادقة بس. ⇒ بعد `/api/auth/me` (اللي بيرجّع توكن جديد)
  **مافيش كوكي جديد** ⇒ المتصفح لازم يبقى بالتوكن القديم.
  📌 **ده يستحق اختبار على الموبايل** — محتاج `_set_auth_cookie` في `/api/auth/me`.

### ⛔ Cache poisoning — الـworker بيقدّم `index.html` لأي مسار SPA؟

**✅ آمن — فيه allowlist صريح، مش wildcard.**

```js
const SPA_ROUTES = ['/markets','/stocks','/tools','/engine','/arms','/filters',
  '/filter','/best','/screener','/dividends','/octasearch','/verdict','/pick',
  'compare','/radar','/smartmoney','/money','/news','/academy','/watchlist',
  'search','/calc','/bestpick','/radar-stock'];
if (SPA_ROUTES.indexOf(url.pathname) !== -1) { /* → index.html */ }

const PAGE_MAP = { '/': '/index.html', '/chart': '/chart.html',
                   '/gate': '/gate.html', '/admin': '/admin/index.html' };
```
⇒ أي مسار تاني بيروح `env.ASSETS.fetch(request)` ⇒ **404 حقيقي** لو الملف مش موجود.

**والـ`_headers` + `html_handling: "none"`** بيقفلوا التحويل التلقائي.
📌 `html_handling: "none"` في `wrangler.jsonc` — **مهم**: الافتراضي
(`auto-trailing-slash`) بيعمل redirect لـ`/gate.html` وبيرجّع 404 فاضي للزائر.

**⚠️ خطر حقيقي واحد — بس مش cache poisoning:**
`Clear-Site-Data: "cache"` (سطر `~950`) — ده **بيمسح كاش المتصفح بالكامل**
لحد ما كل المستخدمين يحدّثوا. لو الـheader ده اتحقن ⇒ إزعاج.
📌 مش مهم دلوقتي (بتاع الـcaching مش الـattacker-controlled).

## ج) الأسرار

| المكان | النتيجة |
|---|---|
| `octa/worker.js` | ✅ **مافيش أي secret** — مافيش API key ولا token. كل الأسرار في Railway Variables. |
| `octa/assets/js/*` | ✅ **مافيش** — `octa-config.js` بيسيب `engineWeights` فاضي ويجيبه من `/api/engine-weights` (محمي). |
| `octa/index.html` | ✅ مافيش — `octa-csp-report` meta بس. |
| `octa-prices/update_prices.py` | ✅ مافيش — `_SECRET` من `OCTAD_TOKEN_SECRET`/`SECRET_KEY`، **`RuntimeError` لو مش موجود في الإنتاج** (سطر `~1034`)؛ `RESEND_KEY` · `GEMINI_KEY` · `TELEGRAM_BOT_TOKEN` كلهم من env. |
| `octa-prices/*.bak` (٨ ملفات) | ✅ **مافيش أسرار** — و`.gitignore` فيه `*.bak*` ⇒ مش على git. |
| `octa/admin/*` | 🔴 **كان فيه PII** (ثغرة ①) — اتصلح. |

---

# 🧪 التحقق — كل ملاحظة اتأكدت ليها بالتشغيل

| الاختبار | الأداة | النتيجة |
|---|---|---|
| تغيير الباسورد ⇒ التوكن القديم يموت | Flask 3.0.3 حقيقي | ✅ 401 / 200 |
| `X-Admin-Key` عربي ⇒ 403 مش 500 | Flask حقيقي | ✅ 403 |
| `mint_session` / `reset_chal` ⇒ 401 | Flask + حيّ | ✅ |
| تخمين توكن الأدمن ⇒ 429 | Flask حقيقي | ✅ بعد ٦-١٠ |
| PIN login: ٣ غلط ⇒ 429 | حيّ على الإنتاج | ✅ |
| `/admin/*.json` ⇒ 404 | محاكاة worker | ✅ |
| `admin/users.json` في dist ⇒ البناء مرفوض | `check-dist.js` | ✅ |
| `grep -rE "@(gmail|octashares)\." dist/` | shell | ✅ فاضي |
| `npm run build` | shell | ✅ نجح (١٢٧ ملف) |
| `node --check` كل JS | shell | ✅ |
| `ast.parse` على الباك | shell | ✅ |
| `test_auth_holes.py` | pytest-less runner | ✅ **16/16** |
| `test_pin_auth.py` | runner | ⚠️ 26✅12❌ — **نفس أرقام الـbaseline بالظبط** |
| `test_pin_challenge.py` | runner | ⚠️ 15✅14❌ — **نفس أرقام الـbaseline بالظبط** |
| ⛔ ريجريشن | مقارنة baseline vs branch | ✅ **صفر فرق** |

📌 **عن الاختبارات الـ«الفاشلة»:** الاختبارات دي **قديمة** — بتتوقع `TOKEN_TTL = 7200`
والح الكود بقى ٣٠ يوم (قرار تجاري في `e431b2c`).Failures **موجودة قبل إصلاحي**
(اتأكدت بمقارنة `origin/main` النضيف بنفس الأرقام). ⇒ **مش من إصلاحي**، بس
**محتاجة تحديث** — ومفروض تتوثّق في `AGENTS.md` / `SESSION-NOTES.md`.

---

# 📦 الـCommits

## `octa` (الواجهة) — `fix/security-admin-exposure` → GitHub ✅

| Commit | المحتوى |
|---|---|
| `498c87c` | منع تسريب PII (٤ طبقات) + هيدرات الأمان + إصلاح XSS + إصلاح `check-dist.js` |
| `33fee7a` | الواجهة بتحفظ التوكن الجديد بعد تغيير الباسورد |

## `octa-prices` (الباك) — `fix/security-session-and-compare-digest` → GitHub ✅

| Commit | المحتوى |
|---|---|
| `dbe9355` | إبطال الجلسات عند تغيير الباسورد + `compare_digest` bytes + حد الأدمن |

📌 **لمسة يد:** الـcommit تانيه اتعمل من **نسخة نظيفة** من `origin/main`
(`/tmp/octa_prices_clean`) ⇒ اتأكدت إن فيه **مفيش** تغييرات ل session موازية
داخل الـcommit (كان فيه تعديلات ل `octa_score.py` + ١٨ hunk في `update_prices.py`
من session تانية — **اتجربت** من الـcommit بتاعي).

---

# ⚠️ اللي محتاج قرار من المشرف

| # | الموضوع | الاقتراح |
|---|---|---|
| ١ | **تدوير الـuid** لـ ٥ مستخدمين (اتكشف إيميلهم + uidهم) | ⛔ **خطير** — `token_epoch` bump + إعادة اشتقاق uid بـpepper جديد. محتاج موافقة + خطة. |
| ٢ | **إبلاغ المستخدمين** عن التسريب | ⛔ **قانوني/علائقي** — قرارك. |
| ٣ | **إزالة `token` من رد `/api/auth/me`** | ⛔ يحتاج تجريب على الموبايل (الكوكي + `credentials:'include'`). |
| ④ | **تحديث الاختبارات القديمة** (`test_pin_auth` · `test_pin_challenge`) | ⛌ بتتوقع TTL=7200 — الكود بقى ٣٠ يوم. |
| ⑤ | **تفعيل الـCSP** (enforce في الهيدر) | ⛌ بعد تحويل الـ`onclick` لـ`addEventListener` (~٧٠ زر). |
| ⑥ | **`octa_watch_v1`** — مسحه عند logout | ⛌ فصل ضعيف بين الحسابات (مش PII). |
| ⑦ | **تنظيف git history** | 📌 **مستحسن متعملش** — الـforce-push يكسر شغل حد تاني. |

---

# 📌 «مش مؤكد» — حاجات ماكانش أقدر أتأكد منها

1. **هل `OCTAD_TOKEN_SECRET` فعلاً مضبوط في Railway؟** — ماكانش عندي وصول للـRailway
   Variables. الكود **يرفض يشتغل** لو مش موجود (سطر `~1034`) ⇒ لو الموقع شغّال
   ⇒ هو مضبوط. ✅ استنتاج منطقي، مش قياس.
2. **قوة `OCTA_ADMIN_TOKEN` و `OCTA_ADMIN_KEY` فعلياً** — ماكانش أقدر أقرأهم.
   التشكيل واضح (متغيّرات بيئة) بس **الطول والقوة** مجهولين.
   📌 **اقتراح:** طول ≥ ٣٢ حرف عشوائي.
3. **مافيش measure لـCSRF على `SameSite=None`** — التطبيق بيستخدم `Bearer` (مش form)
   ⇒ خطر منخفض، بس **مش صفر** لو فيه أي مسار يقبل form POST.
4. **مافيش measure فعلي للـCSP** — `ENFORCE = false` ⇒olicy report-only.
5. **`_hash_key` مربوط بـ`_SECRET[:12]`** (سطر `~1255`) ⇒ لو `_SECRET` اتدار،
   **كل الـuids هتتغيّر** ⇒ كل الحسابات هتخسر الوصول. (معروف من قبل — اتأكدت إنه
   لسه قايم.) الباسوردات **مش** متأثرة (الـ`pin_salt` مستقل + الـpepper منفصل) ✅.
   📌 **الاقتراح:** salt مستقل دائم (متغيّر بيئة) للـuid ⇒ تدوير التوكن مش يكسر الحسابات.
6. **مافيش measure لعدد الحسابات الحقيقية** في `users.json` (٥ في الملف ده بس —
   الملف قديم من ٢٠ أكتوبر). في الإنتاج فيه أكتر من كده.
7. **الـCSP `frame-ancestors`** — في الـmeta بس (المتصفح بيتجاهله) ⇒ لازم يبقى في الهيدر.
   (بعد التفعيل — نقطة ٥.)
8. **مافيش measure على `admin/index.html`** إنه بيفتح `prompt()` للتوكن ⇒
   الـtoken typed في `prompt()` مش بيتخزّن (مافيش localStorage) ✅ — بس بيفضل في
   ذاكرة المتصفح. **مش مشكلة كبيرة** (المستخدم هو اللي فتح اللوحة).
9. **`/api/track`** (سطر `~4541`) — مفتوح (مافيش auth) وبيسجّل أحداث.
   افترضت إنه مخصوص للـanalytics (مجموع، مش PII) — **مش مؤكد** إنه ماشي كده.
   📌 **لازم أراجعه** لو المشرف عايز.

---

*انتهى التقرير · ٨ ثغرات اتصلحت · صفر ريجريشن · مافيش نشر على الإنتاج*
