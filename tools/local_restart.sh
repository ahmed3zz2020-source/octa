#!/bin/bash
# ⭐ بناء + إعادة تشغيل السيرفر المحلي (لازم بعد كل build —
#   ⛔ workerd بيمسك معاملات الملفات القديمة ⇒ 500 "Stale file handle"
#   ⛔⇒ بننسخ في مجلد جديد (dist_local) وبنعمله كـconfig مستقل)
set -e
cd /workspace/octa
npm run build:strict 2>&1 | tail -3
rm -rf dist_local
cp -a dist dist_local
# ملف الـSW القديم للاختبار فقط (مش هينزل على الريبو)
[ -f /tmp/old_sw.js ] && cp /tmp/old_sw.js dist_local/sw-old.js
printf '/sw-old.js\n  Service-Worker-Allowed: /\n' >> dist_local/_headers
pkill -f "wrangler@3.114.14 dev" 2>/dev/null || true
pkill -f "workerd" 2>/dev/null || true
sleep 3
(npx wrangler@3.114.14 dev --config wrangler-local.jsonc --port 8787 --local > /tmp/wrangler.log 2>&1 &)
sleep 26
curl -s -o /dev/null -w "root=%{http_code} " http://127.0.0.1:8787/
curl -s -o /dev/null -w "sw.js=%{http_code} " http://127.0.0.1:8787/sw.js
curl -s -o /dev/null -w "sw-old=%{http_code}\n" http://127.0.0.1:8787/sw-old.js
