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

# ─── ٥) عدد أيام التوصيات ───
DEC_COUNT=$(grep -c '^\s*"[^"]*"\s*:\s*[0-9]' /workspace/octa-prices/update_prices.py 2>/dev/null || echo "؟")

# ─── ٥-ب) أرقام الباك: أسطر + endpoints + عدد الأسهم الحي ───
BACK="/workspace/octa-prices"
UP_LINES=$(wc -l < "$BACK/update_prices.py" 2>/dev/null | tr -d ' ' || echo "0")
EP_LIVE=$(curl -s --max-time 12 "$API/api/health" 2>/dev/null \
  | python3 -c "import json,sys
try:
    d=json.load(sys.stdin)
    print(d.get('stocks','غير متاح'))
except Exception:
    print('غير متاح')" 2>/dev/null || echo "غير متاح")
if [ -n "$EP_COUNT" ] && [ "$EP_COUNT" != "غير معروف" ]; then
    echo "أسطر update_prices.py: $UP_LINES · أسهم حية: $EP_LIVE"
fi

# تحويل الأرقام لصيغة عربية (٢٨٥)
to_ar() {
    python3 -c "
import sys
s=sys.argv[1]
print(''.join(chr(0x0660+int(c)) if c.isdigit() else c for c in s))
" "$1" 2>/dev/null || echo "$1"
}

AR_EP=$(to_ar "$EP_COUNT")
AR_UP=$(to_ar "$UP_LINES")
AR_JS_LINES=$(to_ar "$JS_LINES")
AR_STOCKS=$(to_ar "$EP_LIVE")
AR_JS_COUNT=$(to_ar "$JS_COUNT")
AR_CSS_COUNT=$(to_ar "$CSS_COUNT")

# ─── ٦) تحديث الملفات ───
TODAY=$(date +"%Y-%m-%d")

update_file() {
    local file="$1"
    [ -f "$file" ] || return 0
    sed -i "s|^\*\*آخر تحديث:\*\* .*|**آخر تحديث:** ${TODAY} · \`${COMMIT_SHA}\`|" "$file"
    sed -i "s|commit الحالي:      .*|commit الحالي:      ${COMMIT_SHA}|" "$file"
    echo "  ✅ حدّثت $file"
}

# تحديث الأرقام جوّه ملف (السطر الأول بس اللي بيتباعل)
set_num() {
    local file="$1" pattern="$2" value="$3"
    [ -f "$file" ] || return 0
    if grep -q "$pattern" "$file"; then
        sed -i "s|$pattern|$value|" "$file"
        echo "  ✅ $file ← $value"
    fi
}

echo ""
echo "تحديث الملفات:"
update_file "AGENTS.md"
update_file "ARCHITECTURE.md"
update_file "DOMAINS.md"
update_file "DECISIONS.md"
update_file "SESSION-NOTES.md"

echo ""
echo "تحديث الأرقام:"
# AGENTS.md
set_num "AGENTS.md" "^\*\*آخر تحديث:\*\*.*" "**آخر تحديث:** ${TODAY} · \`${COMMIT_SHA}\`"
set_num "AGENTS.md" "^│   ├── js/.*" "│   ├── js/                 ← ${AR_JS_COUNT} ملف · ${AR_JS_LINES} سطر"
set_num "AGENTS.md" "^│   └── css\*.css.*" "│   └── css*.css            ← ${AR_CSS_COUNT} ملفات"
set_num "AGENTS.md" "^├── update_prices.py .*" "├── update_prices.py       ← ${AR_UP} سطر — المحرك كله"
set_num "AGENTS.md" "^│   └── [٠-٩]+ endpoint" "│   └── ${AR_EP} endpoint"
set_num "AGENTS.md" "^endpoints الباك:.*" "endpoints الباك:     ${AR_EP}"
set_num "AGENTS.md" "^إجمالي الأسهم:.*" "إجمالي الأسهم:     ${AR_STOCKS} من API · ٢٬٢٨٩ من data_markets"
set_num "AGENTS.md" "^الأسهم المصرية:.*" "الأسهم المصرية:     ${AR_STOCKS}"
# PROJECT_STATE.md في الباك
if [ -f "$BACK/PROJECT_STATE.md" ]; then
    set_num "$BACK/PROJECT_STATE.md" "^\*\*آخر تحديث:\*\*.*" "**آخر تحديث:** ${TODAY}"
    set_num "$BACK/PROJECT_STATE.md" "^| \.commit الحالي .*" "| .commit الحالي | \`${COMMIT_SHA}\` |"
    set_num "$BACK/PROJECT_STATE.md" "^| عدد الـ endpoints .*" "| عدد الـ endpoints | ${AR_EP} |"
    set_num "$BACK/PROJECT_STATE.md" "^| أسطر الكود .*" "| أسطر الكود | ${AR_UP} |"
    set_num "$BACK/PROJECT_STATE.md" "^| الأسهم المحللة .*" "| الأسهم المحللة | ${AR_STOCKS} |"
fi

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