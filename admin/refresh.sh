#!/usr/bin/env bash
# 🗂️ OCTA — سحب داتا لوحة الإدارة
#
#   bash admin/refresh.sh
#
# بيسحب /api/admin/monthly ويحطها في admin/data.json
# الإيميلات بتتخفي قبل الحفظ.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API="https://octa-prices-production-4ccb.up.railway.app"
OUT="$HERE/data.json"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

TOKEN="${OCTA_ADMIN_TOKEN:-}"
if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}⚠️  OCTA_ADMIN_TOKEN مش متظبط${NC}"
    echo "   export OCTA_ADMIN_TOKEN='...'"
    exit 1
fi

echo "🗂️ سحب الداتا…"
TMP=$(mktemp)
HTTP=$(curl -s -o "$TMP" -w '%{http_code}' --max-time 30 \
    "$API/api/admin/monthly" -H "X-OCTA-Admin: $TOKEN" || echo 000)

if [ "$HTTP" != "200" ]; then
    echo -e "${RED}❌ HTTP $HTTP${NC}"
    head -c 400 "$TMP"; echo
    rm -f "$TMP"; exit 1
fi

python3 - "$TMP" "$OUT" <<'PY'
import json, sys
src, dst = sys.argv[1], sys.argv[2]
d = json.load(open(src, encoding='utf-8'))
if not d.get('ok'):
    print("❌", d.get('error')); sys.exit(1)
for u in d.get('users', []):
    e = u.get('email') or ''
    if '@' in e:
        a, b = e.split('@', 1)
        u['email_masked'] = a[:2] + '***@' + b
        del u['email']
json.dump(d, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
a = d['analytics']
print(f"✅ {dst}")
print(f"   مستخدمين: {d['total']} · جدد ٣٠: {d['new_30d']} · PIN: {d['pin_set_n']}")
print(f"   أحداث: {a['events_total']} · ٧ يوم: {a['events_7d']} · ٣٠ يوم: {a['events_30d']}")
print(f"   نشط ٧: {a['active_7d']} · نشط ٣٠: {a['active_30d']}")
print(f"   أكتر صفحة: {a['top_pages'][0] if a['top_pages'] else '—'}")
PY

rm -f "$TMP"
echo ""
echo "افتح: $HERE/index.html"