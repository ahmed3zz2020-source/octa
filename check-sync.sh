#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  حارس المزامنة — شغّله أول حاجة في أي شات جديد على OCTA
#  (٢٣ أكتوبر ٢٠٢٦ — اتطوّر: بيقول اتجاه الفرق مش بس «فيه فرق»)
# ══════════════════════════════════════════════════════════════
#
#  📌 ليه الاتجاه مهم؟
#     «≠» من غير اتجاه = إنذار كاذب. اللي بيفرق:
#       🚨 الإنتاج فيه شغل ناقص من GitHub ⇒ هيضيع مع أي نشر
#          من GitHub (ده اللي حصل مع octa-back.js — الملف كله).
#       ✅ GitHub متقدّم ⇒ ده نشر معلّق، مفيش خطر ضياع.
#
#  ⛔⚠️ خدعة raw.githubusercontent.com:
#     الملفات الجديدة بترجع 404 من raw حتى بعد الـpush (كاش قديم)
#     ⇒ الفحص بيرجع «مفيش الملف» وبيقول «حاجة ناقصة» وبيغلط.
#     الحل: نجيب الملف من الـAPI (أدق) ونرجع للـraw بس لو الـAPI
#     مش متاح (من غير توكن).
# ══════════════════════════════════════════════════════════════

BASE="https://octashares.com"
REPO="ahmed3zz2020-source/octa"
TMP=$(mktemp -d)
UA="Mozilla/5.0 (X11; Linux x86_64) octa-sync"

echo "═══════════════════════════════════════════════════════"
echo "  فحص المزامنة — $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════════════"

curl -sfL --compressed --max-time 60 -A "$UA" "$BASE/" -o "$TMP/index.html" || { echo "❌ الموقع مش راد — استنى"; exit 1; }
FILES=$(grep -o 'assets/[a-zA-Z0-9/._-]*\.\(js\|css\)' "$TMP/index.html" | sort -u)

DRIFT=0
LOST=0
AHEAD=0
LIST=""

for f in $FILES; do
  curl -sfL --compressed --max-time 40 -A "$UA" "$BASE/$f" -o "$TMP/live" || continue
  # ⛔ الـAPI أولاً (بيتجنّب كاش الـ404 القديم) — وبتوك لو متاح
  if [ -n "$GITHUB_TOKEN" ]; then
    curl -sfL --max-time 30 -A "$UA" -H "Authorization: Bearer $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/$REPO/contents/$f?ref=main" \
      | python3 -c "
import json,sys,base64
try:
    d=json.load(sys.stdin)
    sys.stdout.buffer.write(base64.b64decode(d['content']))
except Exception:
    pass
" > "$TMP/gh"
  fi
  if [ ! -s "$TMP/gh" ]; then
    curl -sfL --max-time 30 -A "$UA" \
      "https://raw.githubusercontent.com/$REPO/main/$f" -o "$TMP/gh"
  fi
  [ -s "$TMP/gh" ] || { echo "  ⚠️  $f — مش موجود في GitHub"; LOST=$((LOST+1)); DRIFT=$((DRIFT+1)); LIST="$LIST\n  ⚠️  $f — الملف كله ناقص"; continue; }

  LIVE=$(md5sum < "$TMP/live" | cut -d' ' -f1)
  GH=$(md5sum < "$TMP/gh" | cut -d' ' -f1)
  if [ "$LIVE" != "$GH" ]; then
    DRIFT=$((DRIFT+1))
    # ⛔ اتجاه الفرق: مين عنده سطور زيادة عن التاني
    MORE_LIVE=$(comm -23 <(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' "$TMP/live" | grep -v '^$' | grep -v '^/\*' | grep -v '^\*' | grep -v '^//' | sort -u) \
                      <(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' "$TMP/gh"  | grep -v '^$' | grep -v '^/\*' | grep -v '^\*' | grep -v '^//' | sort -u) | wc -l)
    MORE_GH=$(comm -13 <(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' "$TMP/live" | grep -v '^$' | grep -v '^/\*' | grep -v '^\*' | grep -v '^//' | sort -u) \
                     <(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' "$TMP/gh"  | grep -v '^$' | grep -v '^/\*' | grep -v '^\*' | grep -v '^//' | sort -u) | wc -l)
    if [ "$MORE_LIVE" -gt "$MORE_GH" ]; then
      LOST=$((LOST+1))
      echo "  🚨 $f — الإنتاج فيه شغل ناقص من GitHub ($MORE_LIVE سطر) ⇒ هيضيع مع أي نشر!"
      LIST="$LIST\n  🚨 $f"
    else
      AHEAD=$((AHEAD+1))
      echo "  ✅ $f — GitHub متقدّم ($MORE_GH سطر زيادة) ⇒ نشر معلّق، مفيش خطر"
      LIST="$LIST\n  ✅ $f"
    fi
  fi
  rm -f "$TMP/gh"
done

echo "═══════════════════════════════════════════════════════"
if [ "$DRIFT" = "0" ]; then
  echo "  ✅ كل حاجة مظبوطة. GitHub = الإنتاج."
else
  echo "  📊 الاختلافات: $DRIFT"
  echo "     🚨 شغل على الإنتاج ناقص من GitHub (بيضيع!): $LOST"
  echo "     ✅ GitHub متقدّم (نشر معلّق — مفيش خطر): $AHEAD"
  if [ "$LOST" -gt 0 ]; then
    echo ""
    echo "  ⛔⛔⛔ لازم تنقّذ الـ$LOST دول في GitHub قبل أي نشر."
    echo "     (اسحب الملف من octashares.com وحطه في الريبو)."
  fi
  echo "  ⛔ ممنوع تنشر على الدومين غير بإذن أحمد."
fi
echo "═══════════════════════════════════════════════════════"
rm -rf "$TMP"
