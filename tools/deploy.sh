#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# 🚀 حارس النشر — OCTA (٩ نوفمبر ٢٠٢٦)
# ──────────────────────────────────────────────────────────────────────
# 📌 السبب الجذري للغلطة اللي حصل (منعنا نعرفها من سجل Cloudflare):
#   ⛔ `npm run deploy` كان = `wrangler deploy` **بدون --config**
#      ⇒ wrangler بياخد wrangler.jsonc تلقائياً
#      ⇒ وwrangler.jsonc اسمه "octa" = **الإنتاج**!
#      ⇒ يعني: الأمر اللي في الـREADME كان بينشر على الإنتاج من غير ما حد يحس.
#
# 📌 ⭐ ولما أعدنا التسمية (٩ نوفمبر): الافتراضي بقى **المعاينة**
#      (wrangler.jsonc = octa-preview) والإنتاج = wrangler-prod.jsonc.
#      ⇒ حتى لو حد نسي --config ⇒ بينشر على المعاينة (آمن) مش الإنتاج.
#
# 📌 الدليل (سجل deployments على Cloudflare — ٢٣:٤٢ يوم ٩ نوفمبر):
#      22:42:23 → octa (wrangler)
#      22:42:26 → octa (wrangler)
#      22:42:28 → octa (wrangler)
#      22:42:30 → octa (wrangler)
#      22:43:15 → octa (wrangler)
#      ⬇️ أربع نشرات متتالية على الإنتاج في ٥٢ ثانية.
#      octa-preview أول نشر له كان 22:45:37 ⇒ بعدهم بـ ٢ دقيقة.
#   ⇒ الطلب كان «انشر المعاينة»، واللي نزل كان الإنتاج. لأن الأمر الافتراضي = إنتاج.
#
# ✅ الحل (نهائي — مش توثيق بس):
#   ① الإنتاج **مستحيل** يتنشر من غير عبارة صريحة: `PUBLISH_PROD="ارفع على الدومين"`
#   ② بعد كل نشر: فحص حيّ للصفحة + الـAPI ⇒ لو فشل ⇒ **تراجع تلقائي**
#   ③ المعاينة هدفها الافتراضي (الأمان قبل السرعة)
#   ④ الوضع الافتراضي لـ npm scripts اتغيّر → `npm run deploy` بقى **معاينة**
# ══════════════════════════════════════════════════════════════════════

set -euo pipefail

cd "$(dirname "$0")/.."

# ── الألوان ───────────────────────────────────────────────────────────
if [ -t 1 ]; then
  R=$'\033[31m'; G=$'\033[32m'; Y=$'\033[33m'; B=$'\033[34m'; N=$'\033[0m'
else
  R=''; G=''; Y=''; B=''; N=''
fi

PROD_PHRASE='ارفع على الدومين'

# ── الأهداف ──────────────────────────────────────────────────────────
TARGET_PREVIEW_URL='https://octa-preview.ahmed3zz2020.workers.dev'
TARGET_PROD_URL='https://octashares.com'
PROD_WORKER='octa'
PREVIEW_WORKER='octa-preview'

usage() {
  cat <<EOF
${B}🚀 حارس النشر — OCTA${N}

  ${B}bash tools/deploy.sh preview${N}   ← المعاينة (الوضع الافتراضي · آمن)
  ${B}bash tools/deploy.sh prod${N}      ← الإنتاج (محتاج عبارة صريحة)

${Y}⛔ الإنتاج محتاج:${N} PUBLISH_PROD="${PROD_PHRASE}"

أمثلة:
  bash tools/deploy.sh preview
  PUBLISH_PROD="${PROD_PHRASE}" bash tools/deploy.sh prod
EOF
}

TARGET="${1:-preview}"

case "$TARGET" in
  preview) ;;
  prod) ;;
  -h|--help|help) usage; exit 0 ;;
  *) echo "${R}⛔ هدف مجهول: $TARGET${N}"; usage; exit 1 ;;
esac

# ── حارس الإنتاج: العبارة الصريحة ────────────────────────────────────
if [ "$TARGET" = "prod" ]; then
  if [ "${PUBLISH_PROD:-}" != "$PROD_PHRASE" ]; then
    echo ""
    echo "${R}╔══════════════════════════════════════════════════════╗${N}"
    echo "${R}║  ⛔⛔⛔ رفض النشر على الإنتاج — من غير موافقة صريحة   ║${N}"
    echo "${R}╚══════════════════════════════════════════════════════╝${N}"
    echo ""
    echo "   الهدف: ${R}الإنتاج (octashares.com)${N}"
    echo "   السبب: النشر على الإنتاج بيأثر على كل الزوار."
    echo ""
    echo "   لو أحمد قال «${Y}${PROD_PHRASE}${N}» ⇒:"
    echo "     ${B}PUBLISH_PROD=\"${PROD_PHRASE}\" bash tools/deploy.sh prod${N}"
    echo ""
    echo "   ولو هدفك المعاينة:"
    echo "     ${B}bash tools/deploy.sh preview${N}"
    echo ""
    exit 1
  fi
  echo ""
  echo "${Y}⚠️⚠️⚠️  نشر على الإنتاج (${TARGET_PROD_URL})  ⚠️⚠️⚠️${N}"
  echo ""
fi

# ── المتغيرات ────────────────────────────────────────────────────────
: "${CLOUDFLARE_API_TOKEN:?⛔ CLOUDFLARE_API_TOKEN مش موجود}"
export CLOUDFLARE_API_TOKEN

case "$TARGET" in
  preview)
    WRANGLER_CONFIG='wrangler.jsonc'
    WORKER_NAME="$PREVIEW_WORKER"
    CHECK_URL="$TARGET_PREVIEW_URL"
    ;;
  prod)
    WRANGLER_CONFIG='wrangler-prod.jsonc'
    WORKER_NAME="$PROD_WORKER"
    CHECK_URL="$TARGET_PROD_URL"
    ;;
esac

echo "${B}═══════════════════════════════════════════════════${N}"
echo "  العامل      : ${G}${WORKER_NAME}${N}"
echo "  ملف الإعداد : ${B}${WRANGLER_CONFIG}${N}"
echo "  الفحص بعده  : ${B}${CHECK_URL}${N}"
echo "${B}═══════════════════════════════════════════════════${N}"

# ── ① فحص الإعداد: هل الملف فعلاً للهدف ده؟ ──────────────────────────
# ⛔ فخ: لو配置文件 تغيّر بالغلط ⇒ ينشر على العامل الغلط.
CFG_NAME=$(python3 - "$WRANGLER_CONFIG" <<'PY'
import json,re,sys
p=sys.argv[1]
s=open(p,encoding='utf-8').read()
s=re.sub(r'/\*.*?\*/','',s,flags=re.S)      # شيل التعليقات
s=re.sub(r'//.*','',s)
s=re.sub(r',(\s*[}\]])',r'\1',s)            # شيل الفواصل الزائدة
try:
    d=json.loads(s)
    print(d.get('name') or '')
except Exception:
    print('')
PY
)
if [ "$CFG_NAME" != "$WORKER_NAME" ]; then
  echo "${R}⛔⛔⛔ فشل: الملف $WRANGLER_CONFIG اسمه «${CFG_NAME:-؟}» مش «$WORKER_NAME»${N}"
  echo "   ⇒ توقف قبل النشر. راجع الملف."
  exit 1
fi
echo "  ✓ اسم العامل في الملف مطابق"

# ── ②Secrets: الإنتاج ما عندوش أسرار هالان (منع تسرّب) ───────────────
if [ "$TARGET" = "prod" ]; then
  SECRETS=$(curl -s --max-time 30 \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID:-74e046678adabf0706024b97b205882b}/workers/scripts/$WORKER_NAME/secrets" \
    | python3 -c "import json,sys;d=json.load(sys.stdin);print(' '.join(sorted(x.get('name','') for x in (d.get('result') or []))))" 2>/dev/null || echo "")
  if [ -n "$SECRETS" ] && echo "$SECRETS" | grep -q 'HALAN'; then
    echo "${R}⛔⛔⛔、生产عامل عنده أسرار Halan: $SECRETS${N}"
    echo "   ⇒ توقف. أسرار Halan لازم تكون في halan-feed بس (مش في الموقع)."
    exit 1
  fi
  echo "  ✓ مفيش أسرار Halan في العامل"
fi

# ── ③ بناء ───────────────────────────────────────────────────────────
echo ""
echo "${B}▸ بناء...${N}"
npm run build:strict

# ── ④ نشر ────────────────────────────────────────────────────────────
echo ""
echo "${B}▸ نشر إلى $WORKER_NAME ...${N}"

# 📌 رقم النسخة **قبل** النشر (للتراجع لو الفحص فشل).
#    ⛔ لازم ناخد أحدث إصدار (مش أقدم واحد) ⇒ نقرأ من قائمة الإصدارات
#    ونرتّبهم بالتاريخ. القائمة بترجع الأقدم الأول.
PREV_ID=$(npx wrangler versions list --config "$WRANGLER_CONFIG" 2>/dev/null \
  | awk '/^Version ID:/ {v=$3} /^Created:/ {print v" "$2" "$3" "$4}' \
  | sort -k2 -k3 -k4 \
  | tail -1 | awk '{print $1}')
[ -n "$PREV_ID" ] && echo "  (الإصدار السابق: ${PREV_ID:0:8})"

npx wrangler deploy --config "$WRANGLER_CONFIG"

# ── ⑤ فحص حيّ بعد النشر ⇒ لو فشل ⇒ تراجع تلقائي ─────────────────────
# 📌 القاعدة: «النشر مش بيكتمل إلا لو الصفحة والـAPI بيردوا صح».
#   ⛔ /api/health = 200 مش دليل (مفيش data_version) ⇒ لازم الصفحة + المساران.
echo ""
echo "${B}▸ فحص حيّ...${N}"

check_url() {
  local url="$1"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 -A 'Mozilla/5.0 (X11; Linux x86_64) octa-deploy-check' "$url" || echo 000)
  echo "$code"
}

FAILED=0
for path in "/" "/api/health" "/api/rank"; do
  CODE=$(check_url "$CHECK_URL$path")
  if [ "$CODE" = "200" ] || [ "$CODE" = "401" ]; then
    echo "  ✓ $path ⇒ $CODE"
  else
    echo "  ${R}✗ $path ⇒ $CODE${N}"
    FAILED=1
  fi
done

# الـHTML نفسه: لازم يكون صفحة الموقع (مش رد خطأ).
# 📌 الـpublic page (/ serving) فيها octa-public-market.js مش octa-core.js
#    ⇒ نفحص الكلمتين مع بعض (أي واحدة فيهم = صفحة الموقع سليمة).
HTML_CODE=$(check_url "$CHECK_URL/")
if [ "$HTML_CODE" = "200" ]; then
  if curl -s --max-time 25 -A 'Mozilla/5.0 (X11; Linux x86_64) octa-deploy-check' "$CHECK_URL/" \
       | grep -qE 'assets/js/octa-(core|public-market)\.js'; then
    echo "  ✓ الصفحة الرئيسية فيها سكريبت الموقع"
  else
    echo "  ${R}✗ الصفحة الرئيسية مش سكريبت الموقع (رد غلط؟)${N}"
    FAILED=1
  fi
fi

if [ "$FAILED" != "0" ]; then
  echo ""
  echo "${R}╔══════════════════════════════════════════════════════╗${N}"
  echo "${R}║  ⛔ الفحص فشل ⇒ تراجع تلقائي                    ║${N}"
  echo "${R}╚══════════════════════════════════════════════════════╝${N}"
  # ⛔ --yes مهم: من غيره wrangler بيسأل أسئلة تفاعلية ⇒ في السكربت
  #    ده بيرجع prompting وبيسيب العامل في حالة نص مكسورة.
  # ⛔ وبنمرّر الإصدار السابق **بالاسم** (مش "الأحدث") ⇒ نرجع للنسخة
  #    الصح، مش لإصدار قديم من أكتوبر.
  if [ -n "$PREV_ID" ]; then
    echo "   ${B}wrangler rollback $PREV_ID --yes --config $WRANGLER_CONFIG${N}"
    if npx wrangler rollback "$PREV_ID" --yes --config "$WRANGLER_CONFIG"; then
      echo "   ${G}✓ اترجع للإصدار $PREV_ID${N}"
    else
      echo "   ${R}⛔ التراجع فشل — نفّذ يدوي:${N}"
      echo "   ${B}npx wrangler rollback $PREV_ID --yes --config $WRANGLER_CONFIG${N}"
    fi
  else
    echo "   ${R}⛔ مفيش إصدار سابق محفوظ — تراجع يدوي:${N}"
    echo "   ${B}npx wrangler rollback --yes --config $WRANGLER_CONFIG${N}"
  fi
  exit 1
fi

echo ""
echo "${G}✅ اتنشر واتفحص: $WORKER_NAME ⇒ $CHECK_URL${N}"
exit 0
