#!/usr/bin/env bash
# 🐙 OCTA — تحديث آلي للأرقام في ملفات المعرفة
#
# الاستعمال:
#   bash tools/refresh-context.sh
#
# بيعمل: يجيب آخر commit · يحسب الملفات والأسطر والـendpoints · يجيب آخر
#         تحديث للبيانات والأرقام الحية من الـAPI · ويحدّث الأرقام في
#         AGENTS.md و ARCHITECTURE.md و DOMAINS.md و DECISIONS.md
#         و SESSION-NOTES.md و octa-prices/PROJECT_STATE.md
#
# ملاحظة: «عدد الـendpoints» = مسارات /api/ الفريدة (مش الـdecorators).
# ٨٨ هو الرقم الصح — ومكتوب في كل ملفات المعرفة.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

BACK="/workspace/octa-prices"
API="https://octa-prices-production-4ccb.up.railway.app"

echo "🐙 OCTA — تحديث السياق"
echo "═══════════════════════════"

# ─── ١) آخر commit ───
COMMIT=$(git log --oneline -1 2>/dev/null || echo "غير معروف")
COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "0000000")
echo "آخر commit: $COMMIT"

# ─── ٢) عدد الملفات ───
JS_COUNT=$(ls assets/js/*.js 2>/dev/null | wc -l | tr -d ' ')
CSS_COUNT=$(ls assets/*.css 2>/dev/null | wc -l | tr -d ' ')
JS_LINES=$(cat assets/js/*.js 2>/dev/null | wc -l | tr -d ' ')
echo "ملفات JS: $JS_COUNT · سطور: $JS_LINES"
echo "ملفات CSS: $CSS_COUNT"

# ─── ٣) آخر تحديث للبيانات + الأسهم الحية من الـAPI ───
HEALTH=$(curl -s --max-time 15 "$API/api/health" 2>/dev/null || echo "{}")
RAW=$(printf '%s' "$HEALTH" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    ts=(d.get('lastUpdate') or 'غير متاح')[:19].replace('T',' ')
    print(ts + '|' + str(d.get('stocks','غير متاح')))
except Exception:
    print('غير متاح|غير متاح')
" 2>/dev/null || echo "غير متاح|غير متاح")
DATA_TS="${RAW%%|*}"
EP_LIVE="${RAW##*|}"

if [ "$DATA_TS" = "غير متاح" ]; then
    echo -e "${YELLOW}⚠️  الباك مش راد — البيانات مش محدّثة${NC}"
else
    echo -e "${GREEN}✅ آخر تحديث للبيانات: $DATA_TS${NC}"
fi

# ─── ٤) عدد endpoints الباك (مسارات /api/ الفريدة) + أسطر الكود ───
EP_COUNT="88"
UP_LINES="0"
if [ -d "$BACK" ]; then
    EP_COUNT=$(grep -hoP '@app\.route\("\K/api/[^"]+' "$BACK"/*.py 2>/dev/null \
      | sort -u | wc -l | tr -d ' ')
    UP_LINES=$(wc -l < "$BACK/update_prices.py" 2>/dev/null | tr -d ' ' || echo "0")
    echo "endpoints الباك: $EP_COUNT · أسطر update_prices.py: $UP_LINES · أسهم حية: $EP_LIVE"
fi

# ─── ٥) تحويل الأرقام لصيغة عربية بفاصل آلاف ───
to_ar() {
    python3 -c "
import sys
s = sys.argv[1].strip()
try:
    n = int(s)
    s = format(n, ',')
except Exception:
    pass
print(''.join(chr(0x0660 + int(c)) if c.isdigit() else c for c in s).replace(',', '٬'))
" "$1" 2>/dev/null || echo "$1"
}

AR_EP=$(to_ar "$EP_COUNT")
AR_UP=$(to_ar "$UP_LINES")
AR_JS_LINES=$(to_ar "$JS_LINES")
AR_JS_COUNT=$(to_ar "$JS_COUNT")
AR_CSS_COUNT=$(to_ar "$CSS_COUNT")
AR_STOCKS=$(to_ar "$EP_LIVE")

# ─── ٦) تحديث الملفات ───
TODAY=$(date +"%Y-%m-%d")

# تعديل سطر واحد بالـsed — الفاصل @@ عشان السطور فيها | ما تتكسّرش
set_line() {
    local file="$1" pattern="$2" value="$3"
    [ -f "$file" ] || return 0
    if grep -qE "$pattern" "$file" 2>/dev/null; then
        python3 - "$file" "$pattern" "$value" <<'PY'
import re, sys
path, pat, val = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(path, encoding='utf-8').read()
lines = s.split('\n')
rx = re.compile(pat)
for i, line in enumerate(lines):
    if rx.search(line):
        lines[i] = rx.sub(lambda m: val, line, count=1)
        break
open(path, 'w', encoding='utf-8').write('\n'.join(lines))
PY
        echo "  ✅ $file"
    fi
}

echo ""
echo "تحديث الأرقام:"

# AGENTS.md
set_line "AGENTS.md" '^\*\*آخر تحديث:\*\*.*' "**آخر تحديث:** ${TODAY} · \`${COMMIT_SHA}\`"
set_line "AGENTS.md" '^│   ├── js/.*' "│   ├── js/                 ← ${AR_JS_COUNT} ملف · ${AR_JS_LINES} سطر"
set_line "AGENTS.md" '^│   └── css\*.css.*' "│   └── css*.css            ← ${AR_CSS_COUNT} ملفات"
set_line "AGENTS.md" '^├── update_prices\.py .*' "├── update_prices.py       ← ${AR_UP} سطر — المحرك كله"
set_line "AGENTS.md" '^│   └── .* endpoint$' "│   └── ${AR_EP} endpoint"
set_line "AGENTS.md" '^endpoints الباك:.*' "endpoints الباك:     ${AR_EP}"
set_line "AGENTS.md" '^إجمالي الأسهم:.*' "إجمالي الأسهم:     ${AR_STOCKS} من API · ٢٬٢٨٩ من data_markets"
set_line "AGENTS.md" '^الأسهم المصرية:.*' "الأسهم المصرية:     ${AR_STOCKS}"

# سطر آخر تحديث للبيانات (بصيغة عربية)
DATA_AR=$(python3 -c "
import sys
ts = sys.argv[1]
try:
    d, t = ts.split(' ')
    y, mo, dd = d.split('-')
    months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    ar = lambda n: ''.join(chr(0x0660+int(c)) for c in n)
    print(f'{ar(dd)} {months[int(mo)-1]} {ar(y)} · {ar(t[:5])} UTC')
except Exception:
    print(ts)
" "$DATA_TS" 2>/dev/null || echo "$DATA_TS")
set_line "AGENTS.md" '^آخر تحديث للبيانات:.*' "آخر تحديث للبيانات: ${DATA_AR}"

# ARCHITECTURE.md
set_line "ARCHITECTURE.md" '^\*\*آخر تحديث:\*\*.*' "**آخر تحديث:** ${TODAY} · \`${COMMIT_SHA}\`"
set_line "ARCHITECTURE.md" 'update_prices\.py \(.* سطر\)' "update_prices.py (${AR_UP} سطر)"
set_line "ARCHITECTURE.md" '· .* endpoint' "· ${AR_EP} endpoint"
set_line "ARCHITECTURE.md" '^\| الـendpoints \| متفرق \| .* \|$' "| الـendpoints | متفرق | ${AR_EP} مسار |"

# DOMAINS / DECISIONS / SESSION-NOTES — التاريخ والـcommit
for f in DOMAINS.md DECISIONS.md SESSION-NOTES.md; do
    set_line "$f" '^\*\*آخر تحديث:\*\*.*' "**آخر تحديث:** ${TODAY} · \`${COMMIT_SHA}\`"
done
set_line "SESSION-NOTES.md" '^commit الحالي:.*' "commit الحالي:      ${COMMIT_SHA}"

# PROJECT_STATE.md في الباك
if [ -f "$BACK/PROJECT_STATE.md" ]; then
    set_line "$BACK/PROJECT_STATE.md" '^\*\*آخر تحديث:\*\*.*' "**آخر تحديث:** ${TODAY}"
    set_line "$BACK/PROJECT_STATE.md" '^\| \.commit الحالي .*$' "| .commit الحالي | \`${COMMIT_SHA}\` |"
    set_line "$BACK/PROJECT_STATE.md" '^\| عدد الـ endpoints .*$' "| عدد الـ endpoints | ${AR_EP} |"
    set_line "$BACK/PROJECT_STATE.md" '^\| أسطر الكود .*$' "| أسطر الكود | ${AR_UP} |"
    set_line "$BACK/PROJECT_STATE.md" '^\| الأسهم المحللة .*$' "| الأسهم المحللة | ${AR_STOCKS} |"
    set_line "$BACK/PROJECT_STATE.md" '^## 📊 نقاط النهاية الـ .*$' "## 📊 نقاط النهاية الـ ${AR_EP}"
fi

# ─── ٧) فحص شامل ───
echo ""
echo "═══════════════════════════"
echo "فحص الحالة:"

if [ -d assets/js ]; then
    JS_ERR=$(for f in assets/js/*.js; do node --check "$f" 2>&1; done | head -5)
    if [ -z "$JS_ERR" ]; then
        echo -e "  ${GREEN}✅ كل ملفات JS سليمة${NC}"
    else
        echo -e "  ${RED}❌ أخطاء في JS:${NC}"
        echo "$JS_ERR"
    fi
fi

BAD=$(grep -l $'\ufffd' *.md 2>/dev/null || true)
if [ -z "$BAD" ]; then
    echo -e "  ${GREEN}✅ مفيش رموز تالفة في المعرفة${NC}"
else
    echo -e "  ${YELLOW}⚠️  رموز تالفة في: $BAD${NC}"
fi

CJK=$(grep -lP '[\x{4e00}-\x{9fff}]' *.md assets/js/*.js 2>/dev/null || true)
if [ -z "$CJK" ]; then
    echo -e "  ${GREEN}✅ مفيش حروف صينية في المعرفة والكود${NC}"
else
    echo -e "  ${YELLOW}⚠️  حروف صينية في: $CJK${NC}"
fi

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
