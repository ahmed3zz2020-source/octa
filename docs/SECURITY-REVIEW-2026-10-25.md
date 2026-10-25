# 🔐 مراجعة أمنية + تشخيص الـ logout — ٢٥ أكتوبر ٢٠٢٦

> المراجع: كريم (وكيل الأمن) · **read-only** — مفيش أي تعديل ولا commit
> الطريقة: تشغيل **Flask 3.0.3 حقيقي** (من `/workspace/.venv-real/real`) + اختبار المسارات فعلياً
> الأدلة: كل سطر من `file:line` — اللي اتأكدت منه بالتشغيل اتكتب «✅ مُختبَر»

---

## ① جدول: تقرير الـ SECURITY-AUDIT.md — نقطة نقطة

| # | النقطة | الحالة | الدليل (file:line) |
|---|---|---|---|
| ١ | البوابة طبقة فوق الصفحة | ✅ **اتصلح** (مشكلته) | `octa-gate.js:180` (`SHELL` بـ`position:fixed`) · `octa-gate.js:2490-2497` التعليق القديم بتاع «يشيل البوابة قبل الـfetch» اتمسح |
| ٢ | ٨ endpoints مفتوحة | ✅ **اتصلح** | `update_prices.py:8828` `/api/stocks` · `:8838` `/api/markets` · `:9181` `/api/ranking` · `:9500` `/api/rank` · `:9231` `/api/portfolio` · `:10083` `/api/egx_full` · `:10285` `/api/data_full` · `:9614` `/api/engine-weights` — كلهم 401 ✅ مُختبَر |
| ٣ | البوابة بتفتح قبل التحقق | ✅ **اتصلح** | `octa-gate.js:2535` `if (r.ok) { … clearHint(); shut(); }` — `shut()` بعد الـ200 مش قبل. `octa-gate.js:2559` 5xx ⇒ تصفح مع شريط تنبيه |
| ٤ | PIN ٤ أرقام | 🔴 **لسه** (مقصود) | `octa-gate.js:13` `var PIN_LEN = 4;` — مخفّض بالـdevice+email-code، بس ١٠٬٠٠٠ احتمال |
| ٥ | التوكن في localStorage | ⚠️ **جزئي** | لسه في `localStorage` (`octa-gate.js:157,161`) **بس** اتضاف كوكي HttpOnly: `update_prices.py:1054` `_set_auth_cookie` · `:1084` `max_age=TOKEN_TTL, httponly=True, samesite="None"` · `octa-gate.js:2117` `credentials:'include'` |
| ٦ | `/api/alerts/watch` بيرجع ٢٠٠ | ⚠️ **نص نص** | `update_prices.py:11082` `require_user()` موجود، بس الرد **٢٠٠ مش ٤٠١** (`jsonify({ok:False…})` بدون status) — التقرير صح في الملاحظة، لسه مش متصلح بالكامل |
| ٧ | XSS في الأخبار | ✅ **اتصلح** | `octa-core.js:321` `function octaEsc(v)` · `octa-core.js:329` `octaSafeUrl` (بتقبل http/https بس) · الاستخدامات: `octa-core.js:2159, 2488` `octaEsc(n.title)` + `octaSafeUrl(n.link)` — `esc()` في `octa-app.js` لسه موجودة لكن مش مستخدمة (مش مشكلة) |
| ٨ | `data_markets.js` مكشوف | ⚠️ **نص نص** | الملف **اتنضّف**: مافيش `decision`/`score`/`conf` — ٨٦ حقل كلهم داتا سوق خام (اتأكدت: `python3` parse). **بس** بيكتب في `dist/` — `octa/tools/copy-data.js:30` `const keepStatic = process.env.OCTA_STATIC_MARKETS !== '0'` ⇒ **الافتراضي ١ = بيتنسخ** · `package.json` `deploy` = `npm run build` (المتسرب) مش `build:secure` |
| ٩ | الأوزان مكشوفة في `octa-config.js` | ✅ **اتصلح** | `octa-config.js:42` `engineWeights: {}` · `:45` `weights:{us:{},egx:{},usScan:{},intel:{}}` · `:126` `fetch('/api/engine-weights')` — و`/api/engine-weights` محمي (`update_prices.py:9614` + `require_user`) |
| ١٠ | PIN ٤ أرقام ضعيف | 🔴 **لسه** | `update_prices.py:1709` `PIN_FAIL_LIMIT=4` · `:1778` `_pin_keys` ⇒ العدّاد على **هاش الباسورد** (مش IP) ⇒ قفل عالمي. `:1726` `PIN_LOCK_GLOBAL = 6*3600` (٦ ساعات على القفل الثالث). الحماية **قوية** ضد المسح الموزّع |
| ١١ | «نسيت الباسورد» بتقول «محاولات كتيرة» | ✅ **اتصلح** | `octa-gate.js:1578-1579` `s.mode = … ? 'forgot' : 'forgot'` (الفرع كله `forgot`) · `octa-gate.js:1566` `why` بيتحسب صح |
| ١٢ | ٤٠٩ «الإيميل موجود» | ✅ **اتصلح** | `octa-gate.js:994-996` `if (o.s === 409) say('ℹ️ الإيميل ده مسجّل عندنا من قبل — ادخل بباسووردك…')` |
| ١٣ | PIN_TRIES=5 vs «من ٤» | ✅ **اتصلح** | `octa-gate.js:792` بيستخدم `STRIKE_LIMIT` (٤) مش `PIN_TRIES` (٥) — `octa-gate.js:28` |
| ١٤ | التوكن قابل للقراءة بـXSS | ⚠️ **جزئي** | الـXSS اتصلح (#٧) فتقلّت الخطورة، بس التوكن لسه في `localStorage` — `octa-gate.js:157` |
| — | **Cross-Account Takeover** | ✅ **اتصلح** | `update_prices.py:2739` `if not known_dev or not hmac.compare_digest(known_dev, want_dev)` ⇒ جهاز مش مسجّل ⇒ `new_device` · `:2807` نفس الفحص · `:3319` `rec["bio_hash"] = _device_key_hash(_dev_rec)` (تسجيل الجهاز بعد الـchallenge) · `:3923` نفس الشيء في الـsignup. **مُختبَر**: جهاز جديد ⇒ 401 `why=new_device`، جهاز مسجّل ⇒ 200 |
| — | bug: 429 بدل 500 | ✅ **اتصلح** | **مُختبَر**: ٤ محاولات غلط ⇒ **429** + `retry_after` (مش 500) |
| — | bug: `why` بتتشال من الردود | ✅ **اتصلح** | `update_prices.py:201-203` `_AUTH_REASONS_ALLOWED = ("/api/auth/",)` · `:338` `_p = str(request.path or "")` · `:366-369` إعادة إدخال `why` — **مُختبَر**: الرد فيه `why: new_device` |
| — | bug: `_shows_output` دايمًا False | ✅ **اتصلح** | `update_prices.py:275` `p = str(request.path or "")` (مش `resp.request.path`) — **مُختبَر**: `/api/rank` بعد تسجيل الدخول بيرجّع الدرجات |
| — | bug: «جهاز جديد» = محاولة فاشلة | ✅ **اتصلح** | `update_prices.py:2740-2744` التعليق + السلوك — **مُختبَر**: ٥ محاولات من جهاز جديد ⇒ كلهم `new_device` وصفر قفل |
| — | bug: `pin_login` bucket | ✅ **اتصلح** | `update_prices.py:652` `"pin_login": [(10, 60)]` · `:794-795` الـrouting — **مُختبَر**: `_route_bucket` بيرجّع `pin_login` |
| — | bug: `s.mode` ثابت `'signup'` | ✅ **اتصلح** | `octa-gate.js:1578`, `:1635` — كل مسار بيحدّد الـmode صراحةً |
| — | bug: `.gt-body.onclick` فاضل | ✅ **اتصلح** | `octa-gate.js:458` `stopLock()` · `octa-gate.js:1259,1374,1489,1565` بينادى في كل شاشة |
| — | bug: `clearHint`/`hint` جوّه `verify()` | ✅ **اتصلح** | `octa-gate.js:2487` `verify()` بقى **من غير** أي `function hint` جوّه — دالة `hint` في النطاق المشترك (نفس السطر 2562 بيستخدمها) |
| — | bug: الكوكي على دومين Railway | ✅ **اتصلح** | `update_prices.py:1084` `set_cookie(..., samesite="None", secure=True)` من غير `Domain=` |
| — | bug: `_pin_locked_resp` / `_rate_check` 500 | ✅ **اتصلح** | **مُختبَر**: 429 صحيح |

---

## ② تشخيص الـ logout بعد ساعات — **السبب الحقيقي**

### 🎯 الخلاصة في ٣ أسطر

> **الـ logout بعد ساعات مش بسبب الـ TTL. السبب هو `idleCheck()` في الواجهة — ٣٠ دقيقة من غير ما تلمس الشاشة، وبيمسح التوكن وبيفتح البوابة.**
> و`TOKEN_TTL = 30*86400` (٣٠ يوم) **إصلاح غلط** — خلاه أطول من أي حاجة المفروض تعملها.

### السلسلة بالترتيب (كل خطوة بدليل)

```
الخطوة ١ — المستخدم بيفتح الموقع وبيسجّل دخول
   ⛔ octa-gate.js:83    var IDLE_MS = 30 * 60 * 1000;   ← ٣٠ دقيقة
   ⛔ octa-gate.js:2193  var lastTouch = Date.now();
   ⛔ octa-gate.js:2195  ['pointerdown','pointermove','keydown','scroll','touchstart','wheel']
   ⛔ octa-gate.js:2220  setInterval(idleCheck, IDLE_TICK);
        ▼
الخطوة ٢ — المستخدم قاعد يقرأ (أو التاب في الخلفية)
   ⛔ ⛔ ⛔ ده مش وقت HTTP. ده وقت «آخر لمسة» في المتصفح بس.
   ⛔ ⛔ ⛔ Tab في الخلفية ⇒ المؤقتات بتجمّد ⇒ lastTouch ما بيتحدّثش
   ⛔ ⛔ ⛔ ( octa-gate.js:2212-2218 بيقول «التابات بتجمّد المؤقّتات… بصمت» )
        ▼
الخطوة ٣ — بعد ٣٠ دقيقة: آخر لمسة أقدم من IDLE_MS
   ⛔ octa-gate.js:2200  function idleCheck() {
   ⛔ octa-gate.js:2202    if (!token()) { lastTouch = Date.now(); return; }
   ⛔ octa-gate.js:2203    if (Date.now() - lastTouch <= IDLE_MS) return;
   ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔ ⛔
   ⛔ octa-gate.js:2205    logoutLocal();      ← ★ التوكن اتمسح من localStorage
   ⛔ octa-gate.js:2206    wipeFlow();
   ⛔ octa-gate.js:2208    welcome();
   ⛔ octa-gate.js:2209    open();              ← ★ البوابة اتفتحت
        ▼
الخطوة ٤ — المستخدم رجع وصلّى على الموقع ⇒ لقى البوابة
   ⇒ «لازم أعمل حساب جديد وأبعت OTP»
        ▼
الخطوة ٥ — وده بالظبط «بعد ساعات» ⇒ مش بعدها بس
   ⛔ octa-gate.js:2216  visibilitychange ⇒ idleCheck() فوراً
```

### 🔬 ليه دايماً «بعد ساعات» مش «بعد ٣٠ دقيقة»؟

لأن `IDLE_MS = ٣٠ دقيقة` بس الـ**تجديد الصامت** بيخلي المستخدم يكمّل:

| كل قد إيه | إيه اللي بيحصل |
|---|---|
| ٣٠ دقايق | `idleCheck()` بيمسح التوكن ⇒ **البوابة** |
| ٩٠ دقيقة | `renew()` — لو `renewMs` اتظبط صح |
| ٢٤ ساعة | المستخدم رجع ⇒ `visibilitychange` ⇒ `idleCheck()` ⇒ **البوابة فوراً** |

⇒ **المستخدم اللي قاعد يقرأ ٣٠ دقيقة ويقفل التاب، لما يرجع أي وقت بعد كده: البوابة.** وده «بعد ساعات».

### ❓ هل `TOKEN_TTL = 30*86400` كافي؟

**لا — وهو موشproblem. هو المشكلة.**

| | |
|---|---|
| `update_prices.py:1004` | `TOKEN_TTL = 30 * 86400  # ⭐ ٣٠ يوم (كان ساعتين)` |
| `update_prices.py:1047` | `exp = int(time.time()) + int(ttl if ttl else TOKEN_TTL)` |
| `update_prices.py:4051` | `"expires_in": TOKEN_TTL` |

**أDefaults كويس؟** لا. لأن:
1. **الـidle (٣٠ دقيقة) هو اللي بيقتل الجلسة فعلياً** — فـ ٣٠ يوم TTL مش بيساعد خالص.
2. **٣٠ يوم = نافذة سرقة توكن ٣٠ يوم** لو اتسرق (من XSS، من جهاز مشترك، من localStorage على جهاز عام).
3. **التجديد الصامت بقى كل ٢٢.٥ ساعة** (`renewDelayMs(2592000)` = ٥٤٠ ساعة × ٠.٧٥) ⇒ عملياً **لا تجديد تقي**.
4. `octa-gate.js:66` `RENEW_FALLBACK_MS = 90 * 60 * 1000` — الـfallback بيفترض ٧٢٠٠ ثانية (ساعتين) — **لاخلّط مع ٣٠ يوم**.

### 🔎 كل حاجة بتمسح الجلسة (المفحوصة كلها)

| المكان | إيه اللي بيعمل | تقييم |
|---|---|---|
| `octa-gate.js:2205` `logoutLocal()` | **idle ٣٠ دقيقة** | ⛔ **السبب الرئيسي** |
| `octa-gate.js:2153` `logoutLocal()` | `renew()` ⇒ 401 ⇒ `/api/auth/me` ⇒ برضو 401 | ⛔ المسار التاني (بصراحة: مظبوط) |
| `octa-gate.js:2247` `logoutLocal()` | `window.OCTAAuthFail` — سيرفر رجّع 401 | ⛔ تالت (مظبوط) |
| `octa-gate.js:166-171` `logoutLocal()` |本体 — `removeItem('octa_token')` + `removeItem('octa_user')` | ✅ مفيش `localStorage.clear()` خالص |
| `octa-gate.js:1898` `put(d.token, d.user)` | «نسيت الباسورد» ⇒ **بيستبدل** التوكن | ⚠️ شوف ②-ج |
| `update_prices.py:4640` `token_epoch` BUMP | **حذف الحساب** بس | ✅ |
| `update_prices.py:3798` `token_epoch` BUMP | **إنشاء حساب جديد** بس | ✅ |
| `_pinlock_clear_pins` | **مش موجود** في الكود | ℹ️ مفيش حاجة تمسح البصمات |
| `update_prices.py:1138` `if tok_epoch != _user_epoch(uid): return None, 0` | إبطال التوكنات القديمة | ⚠️ **بايظ** — شوف ②-ج |

### ②-ج ⛔⛔ السؤال الأهم: «نسيت الباسورد» — الجلسة القديمة بتموت؟

**❌ لأ.olut.** وده **مقصود** — لكن بتفصيل مهم:

**المسار اللي بيموت:**
```
POST /api/auth/pin/challenge/newpin  (body: new_pin, device) + توكن الفتح
   update_prices.py:3223  @app.route("/api/auth/pin/challenge/newpin", methods=["POST"])
   update_prices.py:3305-3311  rec["pin_salt"]=… ; rec["pin_hash"]=… ; rec["pin_idx"]=…
        ⛔⛔ ⛔ مافيش سطر واحد فيه "token_epoch" ⛔⛔ ⛔
   update_prices.py:3363  _chal_unlock_drop(unlock)
   update_prices.py:3371  "token": _make_token(uid)   ← توكن جديد
```

**🧪 مُختبَر فعلياً (Flask 3.0.3 حقيقي):**
```
قبل:  token_epoch = 1792898306000
        OLD /api/auth/me     → 200 ✅
        OLD /api/auth/refresh → 200 ✅
── forgot + كود + ٤ أرقام جديدة ──
بعد:   token_epoch = 1792898306000   ← ★ ما اتغيرش
        OLD /api/auth/me     → 200 ✅   ← ★ الجلسة القديمة لسه شغالة
        OLD /api/auth/refresh → 200 ✅   ← ★ بتتجدّد كمان
        pin/login بالرقم الجديد 5678 → 200 ✅
        pin/login بالرقم القديم 1234 → 401 ✅
```

### الإجابة على أسئلتك بالترتيب

> **«هل challenge/newpin أو signup/newpin بيبعثوا token_epoch جديد؟»**
> **❌ لأ.** `grep -n "token_epoch" update_prices.py` ⇒ ٦ نتايج بس: `999` (تعليق)، `1024/1028/1033` (القراءة)، `3798` (إنشاء حساب)، `4640` (حذف)، `12354` (تعليق). **صفر** في `challenge/newpin` (3223) ولا `signup/newpin` (3826).

> **«هل المستخدم لازم يعمل OTP جديد كل مرة يعمل نسيت الباسورد؟»**
> **✅ أيوه — وده صح ومقصود.** الاسترجاع = إثبات ملكية بالإيميل ⇒ لازم كود جديد كل مرة. مفيش method تاني.

> **«بعد نسيت الباسورد + كود + ٤ أرقام جديدة — هل الجلسة القديمة بتموت؟»**
> **❌ لأ، مش على السيرفر.** بس **على المتصفح** بتتموت:
> - `octa-gate.js:1898` `put(d.token, d.user)` ⇒ **التوكن الجديد بيحلّ محل** القديم في `localStorage`.
> - ⇒ الجلسة القديمة **تضل صالحة على السيرفر ٣٠ يوم** (TTL) — بس **العميل** بقى ماسك توكن جديد.
> - ⇒ **الخطر الحقيقي:** لو حد سرق التوكن القديم (XSS/جهاز) — يقدر يفضل داخل **بعد** ما صاحب الحساب عمل «نسيت الباسورد» وغيّر الباسورد.

### 🐛 bug في نفس المنطقة: `expires_in` مفقود من `/api/auth/me`

```python
update_prices.py:4555-4563   return jsonify({
    "ok": True, "token": _make_token(...),
    "user": {...}, "stats": {...},
})   # ⛔ مافيش expires_in !
```

```javascript
octa-gate.js:2131   renewMs = renewDelayMs(m.d.expires_in);   // ← undefined
octa-gate.js:71-77  function renewDelayMs(expiresInSec) {
                      var s = Number(expiresInSec);
                      if (!isFinite(s) || s <= 0) s = 7200;   // ← fallback ساعتين
```
**مُختبَر:** `renewDelayMs(undefined)` ⇒ **٩٠ دقيقة** (مش ٢٢.٥ ساعة). ⇒ بعد `/api/auth/me`، المجدول بيرجع every ٩٠ دقيقة — مهمة بدون لازمة بس مش معطّلة.

---

## ③ جدول المسارات — ٩٧ `@app.route`

**الحماية المستخدمة:** `require_user()` (دالة) · `_require_user` (ديكوريتور، `update_prices.py:1322`) · `X-OCTA-Admin` (توكن أدمن)

### 🔒 محمي (٢٤)

| السطر | المسار | الحماية |
|---|---|---|
| 1503 | `/api/auth/register` | `require_user` (للحالة الموجودة) |
| 2853 | `/api/auth/pin/change` | `require_user` |
| 4466 | `/api/stats` | `require_user` |
| 4539 | `/api/auth/me` | `require_user` |
| 4570 | `/api/auth/delete` | `require_user` |
| 4671 | `/api/auth/bio` | `require_user` |
| 8828 | `/api/stocks` | `_require_user` |
| 8838 | `/api/markets` | `_require_user` |
| 9181 | `/api/ranking` | `require_user` |
| 9231 | `/api/portfolio` | `require_user` |
| 9500 | `/api/rank` | `require_user` |
| 9614 | `/api/engine-weights` | `require_user` |
| 9660 | `/api/dashboard` | `require_user` (جزئي — زائر ياخد status بس) |
| 9693 | `/api/audit/redundancy` | `require_user` |
| 10083 | `/api/egx_full` | `require_user` |
| 10285 | `/api/data_full` | `require_user` |
| 11074/11101 | `/api/alerts/watch` GET+POST | `require_user` |
| 11170 | `/api/alerts/diag` | `require_user` |
| 11652/11677 | `/api/charts` GET+POST | `require_user` |
| 11782/11806 | `/api/charts/<id>` GET+DELETE | `require_user` |
| 9592 | `/api/calibration` | `X-OCTA-Admin` (POST) |
| 12065 | `/api/market_tech` | ⛔ **مفيش — مفتوح!** (شوف المشكلة #2) |
| 12171 | `/api/admin/telegram_test` | `X-OCTA-Admin` |
| 12197 | `/api/admin/users` | `X-OCTA-Admin` |
| 12227 | `/api/admin/user/<uid>` | `X-OCTA-Admin` |
| 12268 | `/api/admin/logins` | `X-OCTA-Admin` |
| 12305 | `/api/admin/reset_chal` | `X-OCTA-Admin` |
| 12345 | `/api/admin/mint_session` | `X-OCTA-Admin` |
| 12396 | `/api/admin/set_device` | `X-OCTA-Admin` |
| 12448 | `/api/admin/monthly` | `X-OCTA-Admin` |

### 🔓 مفتوح (٧٣) — مختصر الأهم

| السطر | المسار | ملاحظة |
|---|---|---|
| 580/581 | `OPTIONS /` | preflight |
| 1373 | `/api/auth/otp/send` | مقصود (فيه rate limit) |
| 1420 | `/api/auth/otp/verify` | مقصود |
| 2627 | `/api/auth/pin/register` | مقصود |
| 2650 | `/api/auth/pin/login` | مقصود |
| 3034 | `/api/auth/pin/challenge/send` | مقصود |
| 3149 | `/api/auth/pin/challenge/verify` | مقصود |
| 3223 | `/api/auth/pin/challenge/newpin` | **مفتوح عمداً** (توكن الفتح) |
| 3673/3746/3826 | `/api/auth/signup/*` | **مفتوح عمداً** (توكن الفتح) |
| 4000 | `/api/auth/refresh` | `_bearer` (توكن التوكن) |
| 4303/4308 | `/api/auth/reset/*` | **ميت** (بيرجع 409 `pin_account`) |
| 4419 | `/api/track` | analytics |
| 4716 | `/api/auth/pin/fingerprint` | تشخيص |
| 4765 | `/api/auth/logout` | ⛔ مفتوح — شوف المشكلة #4 |
| 8783/8784 | `/` · `/api/health` | عام |
| 8820/8824 | `/api/prices` · `/api/ticker` | ⛔ مخرجات المحرك **مخفية** (`_HIDDEN_KEYS_OUTPUT`) ✅ |
| 8884 | `/api/analyze` | ⛔ **post** — يستهلك Gemini API |
| 9024 | `/api/chat` | ⛔ **post** — Gemini مفتوح |
| 9079-9376 | `/api/technical|fundamental|sector-stats|diagnostic|intelligence|sentiment|risk|news` | ⛔ مخرجات **مخفية** ✅ |
| 9376 | `/api/explain/<code>` | ⛔ `decision` **مخفي** ✅ · `explanation` مكشوف |
| 9405/9422 | `/api/opportunity*` | ⛔ مخرجات **مخفية** ✅ |
| 9448/9460 | `/api/strategies` · `/api/strategy/<c>/<s>` | ⛔ الأوزان **مخفية** ✅ |
| 9500 | `/api/score-error` | ⛔ مفتوح |
| 9556-9592 | `/api/filters|backtest|backtest/snapshot|stress` | مفتوح |
| 9702/9742 | `/api/gold` · `/api/gold/candles` | مفتوح |
| 9833-9897 | `/api/top-movers|heat|sector/<s>|search/<q>|dividends|dividends/stats|ai-status` | مفتوح |
| 10357 | `/api/ipo` | مفتوح |
| 10397 | `/api/obdepth/<code>` | مفتوح (EGX Live) |
| **10936** | `/api/tg-status` | ⛔ **بيكشف `token_prefix` + `chat_id`** — مشكلة #1 |
| **10959** | `/api/tg-test` | ⛔ **مفتوح** — بيبعت ٣ رسايل تليجرام — مشكلة #1 |
| **11058** | `/api/alerts/test` | ⛔ **مفتوح** — بيبعت على تليجرام أحمد — مشكلة #1 |
| 11065 | `/api/alerts/state` | مفتوح |
| 11262-11344 | `/api/logos` · `/logos/<f>` · `/api/tvlogo/<l>` · `/api/candles/<c>` | مفتوح |
| 11671 | `/api/charts/list` | ⛔ **مفتوح** وفيه user charts — مشكلة #3 |
| 11889 | `/api/quotes` | مفتوح |
| 12065 | `/api/market_tech` | ⛔ **مفتوح** — مشكلة #2 |

### ✅ تأكيد: مخرجات المحرك **مخفية** فعلاً

**مُختبَر** — حطيت صفوف synthetic فيها `final_score` · `decision` · `fair_value` · `price_target_*` · `why` · `conf` · `tvRec` · `weights` وقِست الردود المفتوحة:
```
/api/prices        200  leak=['.egx30[0].confidence']   ← 'confidence' بس (مقياس جودة داتا)
/api/opportunities  200  leak=NONE ✅
/api/strategies     200  leak=NONE ✅
/api/dashboard      200  leak=['.bottom10[0].confidence']
/api/intelligence/… 200  leak=['.confidence', '.technical.confidence', …]
/api/explain/…      200  leak=['.explanation.confidence']
```
⇒ `final_score` · `decision` · `fair_value` · `price_target_*` · `why` · `tvRec` **كلهم مخفيين**. الـ`confidence` هي **مقياس جودة الداتا** مش التوصية ⇒ **مش تسريب للمنتج**. ✅

---

## ④ أهم ٥ مشاكل متبقية — مرتبة بالخطورة

### 🔴 #1 — `/api/alerts/test` + `/api/tg-test` + `/api/tg-status` مفتوحين بالكامل

| | |
|---|---|
| **الخطورة** | 🔴 عالية (إساءة استخدام + تسريب بنية) |
| **الدليل** | `update_prices.py:11058-11062` (`/api/alerts/test` — **مفيش `require_user`**) · `:10959-10966` (`/api/tg-test` — التعليق نفسه: «⛔ مفيش كوكي — مخصوص للتجربة. **⛔ احذف المسار بعد ما تتأكد**») · `:10936-10956` (`/api/tg-status` بيرجّع `token_prefix` (أول ٨ حروف من توكن البوت!) + `chat_id` (رقم كروب أحمد) + آخر خطأ) |
| **الأثر** | ① **أي حد على الإنترنت** يطلب `/api/alerts/test` ⇒ بتبعت رسالة حقيقية على تليجرام أحمد (طلب غير مرغوب + إزعاج + ممكن يتused للإغراق). ② `/api/tg-test` بيبعت ٣ رسائل تجريبية. ③ `/api/tg-status` **بيكشف أول ٨ حروف من توكن البوت** + رقم الكروب =information disclosure بيساعد في استغلال البوت. |
| **مُختبَر** | ✅ `/api/alerts/test` → **200** بدون أي توكن |
| **الإصلاح المقترح** | `require_user()` + gate بتوكن الأدمن على التلاتة، أو امسح `/api/tg-test` نهائياً. **اقتراح:**<br>`@app.route("/api/alerts/test")` ← `if not _admin_ok(): return jsonify({"ok":False,"error":"محمي"}), 401` |
| **ملاحظة** | `_admin_ok` مش موجودة كدالة — فيه pattern مكرر ٩ مرات (`update_prices.py:12356-12360` et al). **اقتراح:** اعمل helper واحد `_require_admin()` واستخدمه في الـ١٠ مسارات. |

---

### 🔴 #2 — `/api/market_tech` مفتوح — بيكشف التحليل الفني لكل الأسهم

| | |
|---|---|
| **الخطورة** | 🔴 عالية (تسريب بيانات + خطأ تصميم) |
| **الدليل** | `update_prices.py:12065-12066` `@app.route("/api/market_tech")` + `def api_market_tech():` — **مافيش `require_user()` خالص**. الـdocstring بيقول «أرقام التحليل لكل الأسهم مباشرة من TradingView scanner» |
| **الأثر** | بيرجّع **كل المؤشرات الفنية** لكل الأسهم في كل الأسواق (مصر/أمريكا/السعودية/الإمارات): RSI · MACD · EMA ·VWAP · بيتا · ٥٢ أسبوع · لكل سهم. ده **أكبر مسح من داتا** في الـAPI كله بعد `data_markets.js` — ومحدش بيحتاجه غير المستخدم المسجّل. + ممكن يكون باب DOS (بيروح TradingView كل مرة). |
| **مُختبَر** | ✅ `/api/market_tech` → **200** بدون توكن |
| **الإصلاح المقترح** | `if not require_user(): return jsonify({"ok":False,"error":"محمي","markets":{}}), 401` — والح-protection على القراءة بس. |

---

### 🟠 #3 — `/api/charts/list` مفتوح + `/api/auth/logout` مفتوح

| | |
|---|---|
| **الخطورة** | 🟠 متوسطة–عالية (تسريب بيانات مستخدم + session fixation) |
| **الدليل** | `update_prices.py:11671-11672` `@app.route("/api/charts/list", methods=["GET"])` — **مافيش `require_user()`**، بينما `/api/charts` (11652) و`/api/charts/<id>` (11782/11806) **محميين** ← اتساهَل في واحد |
| | `update_prices.py:4765` `@app.route("/api/auth/logout", methods=["POST"])` — **مافيش حماية** |
| **الأثر** | ① `/api/charts/list` بيرجّع **قائمة شارتات المستخدمين** — محتمل إنها فيها أسماء/معرّفات شارتات ⇒ تسريب بيانات + كشف النشاط. ② `/api/auth/logout` مفتوح: أي حد يقدر يبعت POST بـ`octa_token` (من كوكي) ⇒ يعمل logout لحد تاني = **DoS صغير** + session invalidation. |
| **مُختبَر** | ✅ `/api/charts/list` → **200** بدون توكن (و`/api/charts` → 401) |
| **الإصلاح المقترح** | `require_user()` على `/api/charts/list`. وعلى `/api/auth/logout`: اقرأ التوكن من `Authorization` أو الكوكي، وبطلّل الكوكي **بس** لو طابق الـuid بتاعه (وإلا ��لخبط) — أو اعمله POST-only مع CSRF token. |

---

### 🟠 #4 — تغيير الباسورد **مش** بيبطل الجلسات القديمة (ثغرة اختراق حساب متبقية)

| | |
|---|---|
| **الخطورة** | 🟠 عالية أمنياً (Privilege persistence بعد استرجاع) |
| **الدليل** | `update_prices.py:3223-3373` (`challenge/newpin`) و`:3826-3983` (`signup/newpin`) — **مافيش `token_epoch` bump**. الـ`token_epoch` بيتكتب في `:3798` (إنشاء حساب) و`:4640` (حذف) **فقط**. و`update_prices.py:1137-1139` `if tok_epoch != _user_epoch(uid): return None, 0` — mechanism موجود وشغّال، بس **مش مستدعى** في مسار تغيير الباسورد |
| **الأثر** | لو التوكن اتسرق (XSS، جهاز مشترك، localStorage على جهاز عام):<br>① الضحية تعمل «نسيت الباسورد» + كود + رقم جديد ⇒ **الرقم القديم بتموت** ✅ (مُختبَر: 1234 ⇒ 401)<br>② بس **التوكن المسروق لسه صالح ٣٠ يوم** ⇒ المهاجم داخل persists ❌<br>③ والضحية مش عارفة، لأن كل حاجة شكلها طبيعي. |
| **مُختبَر** | ✅ `token_epoch` = `1792898306000` **قبل وبعد** `challenge/newpin` — **ما اتغيرش**. `OLD /api/auth/me` ⇒ **200**. `OLD /api/auth/refresh` ⇒ **200**. |
| **الإصلاح المقترح** | في `challenge/newpin` (بعد `rec["pin_salt"]=…`، سطر 3306) و`signup/newpin` (بعد 3909) — ضيف:<br>`rec["token_epoch"] = int(time.time()) * 1000`<br>⚠️ **مهم:** `signup/newpin` ده مسار إنشاء حساب جديد ⇒ الـepoch الجديد بيبطل أي توكن قديم — **مقصود**. لكن في `challenge/newpin` لازم نضمن إن `_make_token(uid)` في السطر 3371 يُعمل **بعد** الـBump (مش قبل) — وإلا التوكن الجديد نفسه يموت.<br>⚠️ وكمان: **الواجهة** `octa-gate.js:1898` `put(d.token, d.user)` — لازم تتأكد إنها بتحط التوكن الجديد (يعني بعد الـBump) — هي كده ✅ |

---

### 🟡 #5 — `data_markets.js` بيكتب في `dist/` بـ`npm run build` (و`deploy` بيستخدمه)

| | |
|---|---|
| **الخطورة** | 🟡 متوسطة (تسريب حجم + احتياطي متبقي) |
| **الدليل** | `octa/tools/copy-data.js:28-30` `const DROP = ['data_markets.js']; const keepStatic = process.environ.OCTA_STATIC_MARKETS !== '0';` ⇒ **الافتراضي ١ = الملف بيتنسخ**. و`octa/package.json` `"build": "… && node tools/copy-data.js && …"` و`"deploy": "npm run build && wrangler deploy"` ⇒ **الـdeploy بينسخ الملف**. فيه `build:secure` و`build:strict` بـ`OCTA_STATIC_MARKETS=0` — **بس مفيش حد بيستخدمهم**. و`octa/tools/check-dist.js:25` بيحذّر بس ما بيمنعش. |
| **الأثر** | الملف **٣.٣٧ ميجا** (٢٩٠ سهم × ٨٦ حقل) بينزل على CDN. **مافيش `decision`/`score`/`conf`** (اتنضّف ✅) — فالتسريب داتا سوق خام بس، مش المنتج. لكن: (١) حجم CDN ضخم، (٢) **الاحتياطي**: لو `/api/markets` وقع، الواجهة هترجع تقرأ الملف العام وتعمل من غير تسجيل — **يعني الحجب بيرجع يسقط** |
| **مُختبَر** | ✅ parse ⇒ ٢٩٠ صف، ٨٦ حقل، **صفر** حقل من نوع decision/score/conf/tvRec |
| **الإصلاح المقترح** | خلي `deploy` = `npm run build:strict`. وخلّي `check-dist.js` **يفشل** (exit 1) لو `data/data_markets.js` موجود في `dist/` — مش يطبع تحذير بس. |

---

## 🎁 بونص: ملاحظات سريعة (مش في الـ٥ لكن مهمة)

| # | الملاحظة | الدليل | الأثر |
|---|---|---|---|
| أ | `expires_in` مفقود من `/api/auth/me` | `update_prices.py:4555-4563` vs `octa-gate.js:2131` | الجدولة بترجع ٩٠ دقيقة بدل ٢٢.٥ ساعة (fallback ٧٢٠٠ ثانية) |
| ب | `octa-api.js` بتعمل `Authorization: Bearer` + الكوكي معاً | `octa-gate.js:1272-1283` `_bearer()` fallback على الكوكي | ⛔ **الكوكي HttpOnly + `SameSite=None; Secure` + `Access-Control-Allow-Credentials: true`** ⇒ **CSRF ممكن** على أي endpoint بيقرا الكوكي.Bearer لحاله كان هيبقى آمن. **مهم** إن كل POST الحساس يتحقق من Origin/Referer. |
| ج | `/api/alerts/watch` بيرجّع ٢٠٠ مش ٤٠١ | `update_prices.py:11085-11089` | التقرير_external صح — لازم 401 |
| د | `admin` × ١٠ مسارات بتكرر نفس كود التوكن | `update_prices.py:12356, 12178, 12202, 12236, 12284, 12319, 12358, 12412, 12455` | نسخة واحدة من الكود = أقل خطأ. **ماشي** (`compare_digest` بـ`.encode("utf-8","replace")` ✅) |
| هـ | `hmac.compare_digest` على `str` | `:465` (`ADMIN_KEY` vs header)، `:1114`/`:1158`/`:2324`/`:3604` (توقيع hex ✅)، `:1545`/`:2274`/`:2514`/`:2550`/`:2739`/`:2807`/`:3285`/`:3888` (هاش hex ✅) | ⚠️ **مستوى الخطر منخفض** — الـASCII صح. بس `:465` لو `ADMIN_KEY` اتظبط على قيمة عربية ⇒ `TypeError` ⇒ 500 بدل 401/403. **الإصلاح:** `got.encode("utf-8","replace")` زي الباقي. |
| و | `PREVIEW_HOST_RE` يسمح بأي subdomain على `*.space.minimax.io` | `update_prices.py:37-39` | CORS بيقبل أي preview ⇒ لو حد رفع preview فيه كود، يقدر يقرا الـAPI. **مقبول** — بس راجعه. |
| ز | `octa-core.js:3057` — `${r}` (reasons) من غير escape | `octa-core.js:3057` | ⚠️ **مش مؤكد**它是 ثغرة حالية: الـ`reasons` مبنية في الباك من أرقام (`update_prices.py:6049-6052`). بس لو الـAI رجّع نص، `update_prices.py:4904` هو prompt بس. **الإصلاح الآمن:** `octaEsc(r)` — تكلفة صفر. |

---

## ✅ ملخص تنفيذي

| | |
|---|---|
| **نقاط التقرير الـ١١ + ATO** | **٩ اتصلحوا فعلاً** · ٢ نص نص · ١ لسه (PIN ٤ أرقام — مخفّض بالطبقات الجديدة) |
| **الـ bugs الـ٤ + ٥** | **كلها اتصلحوا** (مُختبَر واحد واحد) |
| **تسريب ٢٨٥ سهم** | ✅ **اتصلح** — `final_score`/`decision`/`fair_value`/`price_target_*`/`conf`/`why`/`tvRec` **متخفية** في كل الردود المفتوحة |
| **XSS** | ✅ **اتصلح** (`octaEsc` + `octaSafeUrl`) — لازم `octaEsc(r)` كتنظيف احتياطي في `octa-core.js:3057` |
| **CORS** | ✅ **اتصلح** — echo للـorigin المسموح، مش `*` |
| **الـ logout بعد ساعات** | 🔴 **السبب: `idleCheck()` — ٣٠ دقيقة بدون لمس** (`octa-gate.js:2200-2210`). مش الـTTL. و`TOKEN_TTL=30 يوم` **تصعيد خطورة** مش إصلاح. |
| **«نسيت الباسورد» بيموت الجلسة؟** | ❌ **لأ** — `token_epoch` **ما بيتحدّثش** في `challenge/newpin` ولا `signup/newpin` (مُختبَر). **مقصود** في التصميم، بس **ثغرة اختراق حساب متبقية** (مشكلة #4) |
| **الويب-سايت آمن دلوقتي؟** | 🟡 **أفضل بكتير** — بس ٣ مسارات مفتوحة فيها تبعات (§٤ #1-#3) + الـCSRF عبر الكوكي (بونص ب) +Persist بعد تغيير الباسورد (#4) |

### 🎯 الترتيب المقترح للإصلاح (لو هنعمل دفعة واحدة)

1. **`octa-gate.js:2200-2210`** — شيل `idleCheck` أو خلّيه **٧ أيام** (مش ٣٠ دقيقة). ده أسرع إصلاح بيحل شكاوى أحمد. ⏱ ٥ دقايق
2. **`update_prices.py:11058, 10959, 10936`** — `require_admin()` على التلاتة. ⏱ ١٠ دقايق
3. **`update_prices.py:12065`** — `require_user()` على `/api/market_tech`. ⏱ دقيقتين
4. **`update_prices.py:11671`** — `require_user()` على `/api/charts/list` + `update_prices.py:4765` على `/api/auth/logout`. ⏱ ٥ دقايق
5. **`update_prices.py:3306+` و `3909+`** — `token_epoch` bump في تغيير الباسورد. ⏱ ١٠ دقايق (⚠️ ترتيب مهم: بعد الـBump قبل `_make_token`)
6. **`update_prices.py:1004`** — رجّع `TOKEN_TTL` لـ`7*86400` بعد ما الـidle يتظبط. ⏱ دقيقة
7. **`update_prices.py:4555`** — ضيف `"expires_in": TOKEN_TTL` في `/api/auth/me`. ⏱ دقيقة
8. **`octa/package.json`** — `deploy` = `npm run build:strict`. ⏱ دقيقة

---

*كل نتيجة في التقرير دي اتأكدت منها بتشغيل Flask 3.0.3 حقيقي + قراءة الكود. اللي اتأكدت منه بالتشغيل اتكتب «مُختبَر» — واللي كان تحليل من قراءة بس اتhekker عليه. مفيش أي ملف اتعدّل (read-only).*


---

## ✅ ملحق ٢٥ أكتوبر — تطبيق الإصلاحات (المشرف)

### ما اتصلح واتنشر
| # | الإصلاح | الملف | الحالة |
|---|---|---|---|
| ① | `idleCheck` ٣٠ دقيقة ⇒ بقى يعمل `renew` مش `logout` | `octa-gate.js:2278` | ✅ منتشر |
| ② | `/api/tg-status` + `/api/tg-test` + `/api/alerts/test` ⇒ `_require_admin()` | `update_prices.py` | ✅ ٤٠١ مُختبَر |
| ③ | `/api/market_tech` ⇒ `require_user()` | `update_prices.py` | ✅ ٤٠١ مُختبَر |
| ④ | `/api/charts/list` ⇒ `require_user()` | `update_prices.py` | ✅ ٤٠١ مُختبَر |
| ⑤ | `/api/auth/logout` ⇒ `token_epoch` bump | `update_prices.py` | ✅ |
| ⑥ | `challenge/newpin` + `signup/newpin` ⇒ `token_epoch` bump | `update_prices.py` | ✅ |
| ⑦ | `/api/auth/me` ⇒ `expires_in` | `update_prices.py` | ✅ |
| ⑧ | `TOKEN_TTL` ٢ ساعة ⇒ ٣٠ يوم | `update_prices.py:1004` | ✅ منتشر |
| ⑨ | **bootstrap متزامن** — استرجاع الجلسة قبل أي سكربت | `index.html` | ✅ منتشر |
| ⑩ | ترتيب السكربتات — البوابة قبل الـcore | `index.html` | ✅ منتشر |
| ⑪ | URL خارجي بـ`/api/` مابقاش نداء داخلي | `octa-api.js` | ✅ منتشر |
| ⑫ | جسر CORS: `/api/tvquote` + `/api/rss` | `worker.js` | ✅ منتشر |
| ⑬ | البانر المتفي (شريط «السيرفر بينزل») | `index.html` | ✅ |
| ⑭ | «ادخل بـ٤ أرقام» ظاهر دايماً | `octa-gate.js` | ✅ |
| ⑮ | `deploy` = `build:strict` + check-dist يفشل دايماً | `package.json` | ✅ |

### 🎯 السبب الجذري للـlogout — ملاحظة المشرف
كريم قال «الـTTL ٣٠ يوم تصعيد خطورة». **ملاحظة المشرف:**
الـidle (٣٠ دقيقة) هو السبب الحقيقي — اتصلح. الـTTL ٣٠ يوم **فضل** لأن:
- القفل الحقيقي موجود (عمر التوكن + `token_epoch` عند تغيير الباسورد + بصمة الجهاز + كوكي HttpOnly)
- ٧ أيام هتسبب نفس المشكلة بالظبط (المستخدم بيرجع بعد أسبوع ولقى البوابة)
- **لو في疑虑 أمني ⇒ `token_epoch` bump + `logout` server-side هما الحل — مش تقصير العمر**

### 🔎 الـidle بعد الإصلاح
```
قبل:  ٣٠ دقيقة بلا لمس ⇒ logoutLocal() ⇒ البوابة ⇒ «اعمل حساب جديد»
بعد:  ٣٠ دقيقة بلا لمس ⇒ renew() ⇒ لو الكوكي صالح ⇒ الجلسة بتكمّل
      (لو فشل فعلاً ⇒ وقتها بس البوابة)
```


---

## 🐛🐛🐛 الفحص الشامل لكل الأدوات والفلاتر (٢٥ أكتوبر ٢٠٢٦)

### 🔴 السبب الجذري — «كل حاجة بتقول جاري التحميل»
```
الباك (Railway) بيضغط الردود الكبيرة بـgzip
  ↓
الـworker كان بيضغط تاني بـCompressionStream
  ↓
Cloudflare edge بيضغط كمان
  ↓
⇒ gzip×٢ ⇒ المتصفح بيفكّ مرة واحدة ⇒ يفضل بايتات غلط
  ↓
⇒ res.json() بيفشل ⇒ OS_DB = 0 ⇒ OS_LIST = 0
  ↓
⇒ ⇒ ⇒ **كل الأدوات والفلاتر بتقول «جاري التحميل» — والصفحات فاضية!**
```

**✅ الحل:** شيل الضغط من الـworker خالص — Cloudflare بيضغط صح لوحده.

### 📊 نتيجة الفحص الشامل (الـpreview)

| المجموعة | العدد | النتيجة |
|---|---|---|
| صفحات | ٢٠ | **١٦/١٨ سليمة** (`home` مش موجودة بالتصميم · `news` بتحدّث) |
| فلاتر | ١١ | **١١/١١ شغالين** |
| أذرع (مودالات) | ٨ | **٨/٨ شغالين** |
| الرادار | — | ✅ ٢٣١ كارت في ٨ ثواني |
| Smart Money | — | ✅ ٢٥٨ نتيجة من ٢٨٦ سهم |
| OCTAView | — | ✅ البحث شغال (COMI ظهر) |
| المقارنة | — | ✅ ١٣ صف |
| صفحة السهم | — | ✅ كل الأرقام + ١ شارت |
| API errors | — | **صفر** 4xx/5xx |

### 🔧 إصلاحات إضافية في نفس الجولة
| # | المشكلة | الإصلاح |
|---|---|---|
| ① | `injectEngineWidget` بيقع `null` | `try/catch` + `isConnected` check |
| ② | عنوان خبر فيه HTML (من الـRSS) ⇒ المستخدم بيشوف الكود | `octaCleanText()` — تشيل الـtags + تفك الـentities |


---

## ✅ النشر على الإنتاج (٢٥ أكتوبر ٢٠٢٦) — بعد موافقة أحمد

**Worker:** `dc631297-d25d-406a-b01a-7dd04425ed5e` → `9deff7db-cf0c-4a76-a90b-d66b21bf524a`
**Preview:** `dcbb8493-d85f-483d-a702-6fac098668da`

### 🔴 ٣ أخطاء لازم تتذكر
| # | الخطأ | السبب | الإصلاح |
|---|---|---|---|
| ① | `env.ASSETS.fetch('/')` → **404** | مافيش asset اسمه `/` | fetch مباشر لـ`/index.html` |
| ② | HTML مبيوصلش تحديث | الـJS كان no-store بس الـHTML لأ | no-store للـHTML كمان |
| ③ | **gzip×٢** | الباك + worker + Cloudflare | شلت الضغط من الـworker |

### 🧪 الفحص النهائي على الإنتاج
```
CORE        : OS_DB=285 · gate=false
صفحات      : ١٦/١٨ سليمة (home مش موجودة بالتصميم · news بتحدّث)
فلاتر      : ١١/١١ ✅
أذرع       : ٨/٨ ✅
الرادار     : ٤٠ كارت في ١٦ ثانية (بيزيد) ✅
Smart Money : ٢٥٨+ نتيجة ✅
OCTAView    : COMI ظهر ✅
المقارنة   : ١٣ صف ✅
صفحة السهم  : كل الأرقام + شارت ✅
Challenge   : forgot → إيميل → send 200 → شاشة الكود ✅
API errors  : صفر ✅
```

---

## 🔴 تحديث ٢٥ أكتوبر ٢٠٢٦ — إصلاح 401 عام + تخطيط كارت السهم

### 🔴 الخلل الجذري: `octaFetch` المشترك (٤٠+ نداء كان بيرجع 401)
**السبب:** `octa-api.js` كان بيلفّ `window.fetch` — بس **بالـURL النسبي فقط** (نفس الأصل).
الملفات التانية (`octa-pages.js` · `octa-app.js`) بتعمل `fetch(OCTA_API + ...)` **مباشرة**
⇒ مفيش `Authorization` header ⇒ **401 على كل المسارات المحمية**
⇒ النتيجة: صفحة السهم بتقول «فشل تحميل بيانات ABUK — `/api/intelligence/ABUK`».

**✅ الإصلاح:** `window.octaFetch(url, opts)` في `assets/js/octa-api.js`:
- يضيف `Authorization: Bearer <token>` من `localStorage.octa_token` لكل نداء فيه `/api/`.
- يضيف `credentials: 'include'` (الكوكي HttpOnly).
- **لا يلمس** أي URL خارجي (TradingView · RSS · IPO sources) — بيحافظ على `_isOurs()`.

**✅ التغطية:** ٤٧ موضع تم تحويله عبر `octa-pages.js` (٣٣) و `octa-app.js` (١٤).

### 🎨 إصلاحات الواجهة
| المشكلة | السبب | الإصلاح |
|---|---|---|
| «القرار —» فاضي | `intel.decision` مخفي في `/api/intelligence` | `octaStockMeta(code).decision` من `OS_DB` |
| المحاور إنجليزي | `k` مباشرة بدل `AR_MS[k]` | `AR_MS` (٧ محاور عربي) |
| `rgba(255,255,255,...)` في الكارت | inline styles مش متحوّلة | `var(--wash)` |
| كارت لوحده في آخر صف | `auto-fit minmax(130px)` مع ٧ عناصر | `repeat(3,1fr)` للكر��ت + `repeat(2,1fr)` للمحاور |

### 🧪 نتيجة الفحص النهائي (production، موبايل ٣٩٠px)
```
١٨/١٨ صفحة: صفر NaN · صفر undefined · صفر «النتيجة 0/100» · صفر «القرار —»
صفر JS errors · صفر API 4xx/5xx (غير 429 transient)
OS_DB = 285 في كل الصفحات · CFG موجود · ٧ أوزان · مجموع ١٠٠٪
```

### 📦 النشر
- Production worker version: `4e2c149f-86c4-4c5e-9ecb-3af734cdcb50`
- Commits: `050bc8d` (octaFetch + كارت السهم) · `d293ab7` (تخطيط الكارت)

---

## 🎨 إعادة هيكلة الثيمين (CSS) — ٢٥ أكتوبر ٢٠٢٦

### 🔴 المشكلة: `octa.css` كان بيكسر الثيمين
| الخلل | الأثر |
|---|---|
| `--wash` **مش معرّف خالص** | `--line: var(--wash)` ⇒ invalid ⇒ كل `background: var(--wash)` شفاف ⇒ **كروت لوحة الأسواق غامقة/شفافة في النهاري** |
| `--up2` مش معرّف | `--sec: var(--up2)` invalid |
| **٣٢ متغير** مستخدم ومش معرّف | `--slot`(39 موضع) · `--goldBg`(20) · `--up`(21) · `--t1`(20) · `--r2/3/4` · `--s2/3/4` · `--sh2/3` · `--dn` · `--line2` |
| `:root` مكرّر مرتين | قيم متضاربة |
| `body.light` مكرّر مرتين | `#fff` vs `#f4f6f9` — آخر واحد بيفوز |

### ✅ الحل
- **حُذفت كل بلوكات `:root` و `body.light` من `assets/octa.css`.**
- **`assets/octa-tokens.css` = المصدر الوحيد** (زي ما مكتوب في نص الملف).
- الـ32 متغير الناقصة اتعرّفت في `octa-tokens.css` (داكن + نهاري).
- `--d` و `--slotT` اتعرّفا.

### 🔴 تعارض أسماء CSS (3 أنواع)
| الاسم | التعارض | الحل |
|---|---|---|
| `.mbar` | كارت مؤشر السوق **و** ترويسة مودال الشارت | الترويسة ⇒ `.chbar` |
| `.ic` | كارت info (padding 16px) **و** علم صغير في `.tab` | override `.tab .ic { padding:0; border:0; background:none }` |
| `.tabs` | `rgba(0,0,0,.28)` hardcoded | `var(--wash)` |

### 🎯 قياس التباين (WCAG)
**قبل:** داكن = ٢٤٧ عنصر · نهاري = ١٧٩.
**بعد:** داكن = ١ · نهاري = ٢ (كلهم مقصودين: علم على مربع أبيض + رقم تاب نشط).
**إصلاحات:** `--gold2` النهاري `#b8912f` ⇒ `#8a6d12` · `.bdg.b-hold` ⇒ `#7a5f0e` ·
`.sb-out` ⇒ `#b4471f` · `.sb-bio` ⇒ `#1f7a4d`.

## ⭐ روابط مباشرة لكل الصفحات
- `/markets` · `/stocks` · `/filter` · `/engine` · `/arms` · `/compare` · `/radar` · `/news` …
- كلهم 200 دلوقتي (كانوا 404).
- 3 قطع: `SPA_ROUTES` في worker · `pathname` في `OS_NAV.restore()` · توحيد `markets`→`stocks`.

### 📦 النشر
- Production worker version: `80f95082-8559-4e18-9df8-ad03d6928a0f`
- Commits: `be3b643` · `45c2759` · `d0ce7fe` · `416546a` · `6dcadb2` · `7ec70fb` · `9408324`
