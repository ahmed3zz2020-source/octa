#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# 🛡️ حارس النشر على المعاينة — ١٢ نوفمبر ٢٠٢٦
# ───────────────────────────────────────────────────────────────
# 📌 ليه؟ يوم ١٢ نوفمبر اتنشر على المعاينة من شجرة قديمة (من جلسة
#    متوازية) ⇒ ملفات محرّك الفرص (octa-opps.js) ومحفظة Alpha
#    (octa-alpha.js) مش موجودة ⇒ الفلترين رجعوا للنسخة القديمة
#    والمستخدم شاف «النسخة القديمة» من غير ما يعرف.
# 📌 ⭐ الحارس: قبل أي نشر على المعاينة لازم:
#    ① ملفات المحركين موجودة في حزمة البناء (dist)
#    ② index.html بيشير ليها
#    ③ الـcommit المحلي =.origin/main (أو تحذير واضح)
#    ④ بصمة البناء بتتسجّل (عشان نعرف مين نشر آخر مرة)
# ═══════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

FAIL=0
say()  { printf '%s\n' "$*"; }
ok()   { printf '  ✅ %s\n' "$*"; }
bad()  { printf '  ❌ %s\n' "$*"; FAIL=1; }
warn() { printf '  ⚠️  %s\n' "$*"; }

say "🛡️ حارس النشر على المعاينة"
say "───────────────────────────────────────"

# ① الملفات الأساسية موجودة في المصدر
say "① ملفات المصدر:"
for f in assets/js/octa-opps.js assets/js/octa-opps-copy.js assets/js/octa-alpha.js \
         assets/css-opps.css assets/css-alpha.css; do
  if [ -f "$f" ]; then ok "$f"; else bad "$f مفقود في المصدر"; fi
done

# ② موجودة في حزمة البناء
say "② حزمة البناء (dist):"
for f in assets/js/octa-opps.js assets/js/octa-alpha.js assets/css-opps.css assets/css-alpha.css; do
  if [ -f "dist/$f" ]; then ok "dist/$f"; else bad "dist/$f مفقود ⇒ ابني أول (npm run build:strict)"; fi
done

# ③ index.html بيشير للملفات
say "③ index.html بيشير للملفات:"
if [ -f dist/index.html ]; then
  for s in octa-opps.js octa-opps-copy.js octa-alpha.js; do
    if grep -q "$s" dist/index.html; then ok "$s"; else bad "$s مش موجود في dist/index.html"; fi
  done
  for c in css-opps.css css-alpha.css; do
    if grep -q "$c" dist/index.html; then ok "$c"; else bad "$c مش موجود في dist/index.html"; fi
  done
else
  bad "dist/index.html مفقود ⇒ ابني أول"
fi

# ④ نظافة الشجرة + تطابق الـmain
say "④ نظافة المستودع:"
if [ -z "$(git status --porcelain 2>/dev/null)" ]; then
  ok "الشجرة نضيفة"
else
  warn "فيه ملفات متغيّرة (مش هتمنع النشر، بس اعرف)"
  git status --porcelain | head -8 | sed 's/^/      /'
fi

LOCAL=$(git rev-parse --short HEAD 2>/dev/null || echo '?')
REMOTE=$(git rev-parse --short origin/main 2>/dev/null || echo '?')
say "⑤ بصمة البناء:"
printf '      commit محلي = %s   |   origin/main = %s\n' "$LOCAL" "$REMOTE"
if [ "$LOCAL" = "$REMOTE" ]; then
  ok "المحلي = GitHub main"
else
  warn "المحلي مختلف عن origin/main ⇒ اتأكد إنك نشرت آخر شغل"
fi

say "───────────────────────────────────────"
if [ "$FAIL" -eq 1 ]; then
  say "⛔ الحارس رفض النشر — راجع الأخطاء فوق."
  exit 1
fi
say "✅ الحارس عدّى — ينفع تنشر على المعاينة."
say "   ⛔ متنساش: npm run deploy = إنتاج."
exit 0
