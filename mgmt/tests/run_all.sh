#!/usr/bin/env bash
# 🧪 كل اختبارات لوحة الإدارة (octa-mgmt) — محلي بالكامل، بلا إنتاج
# ⛔ مافيش أي اتصال بالإنترنت في الاختبارات دي.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
MGMT="$(dirname "$HERE")"
cd "$MGMT"

RC=0
echo "════ ١) اختبارات Node (البوابة + البناء النظيف) ════"
node --test "$HERE"/*.test.js || RC=1

echo ""
echo "════ ٢) حارس البناء (exit 0 = نظيف) ════"
python3 check_build_clean.py || RC=1

echo ""
echo "════ ٣) اختبار اللوحة من طرف لطرف (محلي) ════"
python3 "$HERE/test_panel_e2e.py" || RC=1

echo ""
if [ "$RC" = "0" ]; then echo "✅ كل الاختبارات نجحت"; else echo "❌ فيه اختبارات فشلت"; fi
exit $RC
