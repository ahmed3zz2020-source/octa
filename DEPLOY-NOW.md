# 🚀 نشر التعديلات — خطوة واحدة

## ❓ ليه التعديلات لسه ما ظهرتش؟

لأن `dist/` في `.gitignore`

يعني التعديلات **مش بتترفع على GitHub**

ولازم `npm run deploy` ينشرها على Cloudflare يدوي

---

## 🔑 المطلوب: توكن Cloudflare

**خطوات عشان:**

```
1. افتح:  https://dash.cloudflare.com/profile/api-tokens
2. اضغط:  Create Token
3. اختار: Edit Cloudflare Workers   (أو Custom Token)
4. صلاحيات:
     Account → Workers Scripts → Edit
     Account → Workers KV Storage → Edit
5. اضغط: Create Token
6. انسخ التوكن (بيبدأ بـ eyJ)
```

---

## ⚡ بعد ما تبعتلي التوكن

هعمل ده بالترتيب:

```bash
# 1) حفظ التوكن (مش هيتكتب في أي ملف)
export CLOUDFLARE_API_TOKEN="التوكن"

# 2) بناء
npm run build

# 3) نشر
npx wrangler deploy --config wrangler.jsonc
```

---

## ✅ الفحص قبل النشر (اتعمل خلاص)

```
✅ HTML متوازن — 377/377 div
✅ 12 ملف JS — كلهم node --check
✅ tracker — مش موجود
✅ البالونة — مش موجودة
✅ 17 ملف محلي — كلهم موجودين
✅ الحجم: 5.3MB
```

---

## ⚠️ لو في problem

```bash
# شوف الـlogs
npx wrangler tail

# ارجع للإصدار اللي فات
npx wrangler rollback
```

---

## 🔁 Rollback للـAPI

```bash
cd /workspace/octa-prices
git log --oneline -5
git revert <commit>
git push origin main
```

Railway بيعمل redeploy تلقائي.
