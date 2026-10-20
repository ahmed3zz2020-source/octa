#!/usr/bin/env bash
# 🐙 OCTA — تحديث آلي للأرقام في ملفات المعرفة
#
# الاستعمال:
#   bash tools/refresh-context.sh
#
# بيعمل: يجيب آخر commit · يحسب عدد الملفات · يحدّث آخر تحديث للبيانات
#         في AGENTS.md و PROJECT_STATE.md

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🐙 OCTA — تحديث السياق"
echo "═══════════════════════════"

# ─── ١) آخر commit ───
COMMIT=$(git log --oneline -1 2>/dev/null || echo "غير معروف")
COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "0000000")
echo "آخر commit: $COMMIT"

# ─── ٢) عدد الملفات ───
JS_COUNT=$(ls assets/js/*.js 2>/dev/null | wc -l | tr -d ' ')
CSS_COUNT=$(ls assets/*.css 2>/dev/null | wc -l | tr -d ' ')
JS_LINES=$(cat assets/js/*.js 2>/dev/null | wc -l | tr -d ' ' | awk '{printf "%d", $1}')
echo "ملفات JS: $JS_COUNT · سطور: $JS_LINES"
echo "ملفات CSS: $CSS_COUNT"

# ─── ٣) آخر تحديث للبيانات من الباك ───
API="https://octa-prices-production-4ccb.up.railway.app"
DATA_TS=$(curl -s --max-time 12 "$API/" 2>/dev/null \
  | python3 -c "import json,sys
try:
    d=json.load(sys.stdin)
    t=d.get('lastUpdate','')
    print(t[:19].replace('T',' ') if t else 'غير متاح')
except Exception:
    print('غير متاح')" 2>/dev/null || echo "غير متاح")

if [ "$DATA_TS" = "غير متاح" ]; then
    echo -e "${YELLOW}⚠️  الباك مش راد — البيانات مش محدّثة${NC}"
else
    echo -e "${GREEN}✅ آخر تحديث للبيانات: $DATA_TS${NC}"
fi

# ─── ٤) عدد endpoints الباك ───
EP_COUNT="غير معروف"
if [ -d /workspace/octa-prices ]; then
    EP_COUNT=$(grep -ohP '@app\.route\("\K/api/[^"]+' /workspace/octa-prices/*.py 2>/dev/null \
      | sort -u | wc -l | tr -d ' ')
    echo "endpoints الباك: $EP_COUNT"
fi

# ─── ٥) عدد平日 التوصيات ───
DEC_COUNT=$(grep -c '^\s*"[^"]*"\s*:\s*[0-9]' /workspace/octa-prices/update_prices.py 2>/dev/null || echo "؟")

# ─── ٦) تحديث الملفات ───
TODAY=$(date +"%Y-%m-%d")

update_file() {
    local file="$1"
    [ -f "$file" ] || return 0
    sed -i "s|^\*\*آخر تحديث:\*\* .*|**آخر تحديث:** ${TODAY} · \`${COMMIT_SHA}\`|" "$file"
    sed -i "s|commit الحالي:      .*|commit الحالي:      ${COMMIT_SHA}|" "$file"
    echo "  ✅ حدّثت $file"
}

echo ""
echo "تحديث الملفات:"
update_file "AGENTS.md"
update_file "ARCHITECTURE.md"
update_file "DOMAINS.md"
update_file "DECISIONS.md"
update_file "SESSION-NOTES.md"

# ─── ٧) فحص شامل ───
echo ""
echo "═══════════════════════════"
echo "فحص الحالة:"

# فحص الصيغة
if [ -d assets/js ]; then
    JS_ERR=$(for f in assets/js/*.js; do node --check "$f" 2>&1; done | head -5)
    if [ -z "$JS_ERR" ]; then
        echo -e "  ${GREEN}✅ كل ملفات JS سليمة${NC}"
    else
        echo -e "  ${RED}❌ أخطاء في JS:${NC}"
        echo "$JS_ERR"
    fi
fi

# فحص التالفة في ملفات المعرفة
BAD=$(grep -l $'\ufffd' *.md 2>/dev/null || true)
if [ -z "$BAD" ]; then
    echo -e "  ${GREEN}✅ مفيش رموز تالفة في المعرفة${NC}"
else
    echo -e "  ${YELLOW}⚠️  رموز تالفة في: $BAD${NC}"
fi

# فحص وجود الملفات الأساسية
MISSING=""
for f in AGENTS.md ARCHITECTURE.md DOMAINS.md DECISIONS.md SESSION-NOTES.md; do
    [ -f "$f" ] || MISSING="$MISSING $f"
done
if [ -z "$MISSING" ]; then
    echo -e "  ${GREEN}✅ كل ملفات المعرفة موجودة${NC}"
else
    echo -e "  ${RED}❌ ناقص:$MISSING${NC}"
fi

echo ""
echo -e "${GREEN}✅ خلص${NC}"