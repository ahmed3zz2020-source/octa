#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# 🔒 فحص عزل ثابت — يقرأ ملفات V2 فقط ويبحث عن أي ارتباط بالإنتاج
# ═══════════════════════════════════════════════════════════════
# الفحص غير مكتوب ليعمل في CI — بيطبع تقرير وبيخرج بـ 1 لو لقي ارتباط.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "🔒 فحص عزل V2 — المجلد: $ROOT"
echo

fail=0
# ⛔ نتجاهل أسطر التعليقات (توثيق) — نفحص الكود الفعلي فقط
strip_comments() { sed -E 's|^[^:]+:[0-9]+:||' | grep -vE '^[[:space:]]*(\*|//|/\*|\*/)' || true; }

check() {
  local label="$1"; local pattern="$2"; local kinds="${3:-js html css jsonc json}"
  local inc=""
  for k in $kinds; do inc="$inc --include=*.$k"; done
  local out
  out=$(grep -rInE "$pattern" $inc . 2>/dev/null | strip_comments || true)
  if [ -n "$out" ]; then
    echo "⛔ $label:"
    echo "$out" | sed 's/^/     /'
    fail=1
  else
    echo "✅ $label — لا يوجد"
  fi
}

check "لا يوجد عنوان Railway"          'railway\.app|railway\.dev'
check "لا يوجد تيليجرام"              'telegram|t\.me/'
check "لا يوجد نطاق الإنتاج"          'octashares\.com'
check "لا يوجد مسار API خارجي"        '/api/|fetch\(["'"'"']https?://|XMLHttpRequest\s*\(' js html
check "لا يوجد تخزين محلي"            'localStorage|sessionStorage|indexedDB|document\.cookie' js html
check "لا يوجد استيراد من ملفات الإنتاج" 'octa-(core|api|app|config|pages|filters|screener)\.js' js

# العناوين الخارجية: يُسمح فقط بمساحات أسماء XML (www.w3.org) والعناوين المحلية
ext=$(grep -rInE 'https?://' --include='*.js' --include='*.html' --include='*.css' . 2>/dev/null \
      | strip_comments | grep -v 'www\.w3\.org' | grep -v '127\.0\.0\.1' | grep -v 'localhost' || true)
if [ -n "$ext" ]; then
  echo "⛔ لا يوجد عنوان خارجي (http):"
  echo "$ext" | sed 's/^/     /'
  fail=1
else
  echo "✅ لا يوجد عنوان خارجي (http) — غير مساحات أسماء XML"
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "✅ كل الفحوص ناجحة — V2 لا يشير إلى أي مورد إنتاج."
else
  echo "⛔ لقيت ارتباطات — راجعها قبل أي نشر."
fi
exit $fail
