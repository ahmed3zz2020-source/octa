#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  حارس المزامنة — شغّله أول حاجة في أي شات جديد على OCTA
# ══════════════════════════════════════════════════════════════
BASE="https://octashares.com"
REPO="ahmed3zz2020-source/octa"
TMP=$(mktemp -d)
echo "═══════════════════════════════════════════════"
echo "  فحص المزامنة — $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════"
curl -sfL --compressed --max-time 60 "$BASE/" -o "$TMP/index.html" || { echo "❌ الموقع مش راد — استنى"; exit 1; }
FILES=$(grep -o 'assets/[a-zA-Z0-9/._-]*\.\(js\|css\)' "$TMP/index.html" | sort -u)
DRIFT=0
for f in $FILES; do
  LIVE=$(curl -sfL --compressed --max-time 40 "$BASE/$f" | md5sum | cut -d' ' -f1)
  GH=$(curl -sfL --max-time 30 "https://raw.githubusercontent.com/$REPO/main/$f" | md5sum | cut -d' ' -f1)
  if [ "$LIVE" != "$GH" ]; then echo "  ≠  $f"; DRIFT=$((DRIFT+1)); fi
done
echo "═══════════════════════════════════════════════"
if [ "$DRIFT" = "0" ]; then echo "  ✅ كل حاجة مظبوطة. GitHub = الإنتاج."
else echo "  ⚠️  فيه $DRIFT اختلاف — يبقى حد نشر من غير ما يدفع."
     echo "  ⛔ ممنوع تنشر على الدومين غير بإذن أحمد."; fi
echo "═══════════════════════════════════════════════"
rm -rf "$TMP"
