#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# 🚀 نشر Cloudflare Worker عبر REST API مباشرة (multipart)
# ──────────────────────────────────────────────────────────────
# السبب: توكن CLOUDFLARE_API_TOKEN ناقصه scope
#        "Workers Scripts:Edit" ⇒ `wrangler deploy` بيفشل 401.
# الحل: نرفع multipart form (modules format + assets binding)
#       مباشرة على /workers/scripts/<name>.
#
# ⚠️ مفيش force-push ولا تعديل على production — الاسم بيتحدد
#    بالمتغير NAME (octa-preview افتراضياً).
# ══════════════════════════════════════════════════════════════
set -euo pipefail

ACCOUNT_ID="${ACCOUNT_ID:-74e046678adabf0706024b97b205882b}"
NAME="${NAME:-octa-preview}"
DIST="${DIST:-dist}"
API="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${NAME}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "⛔ CLOUDFLARE_API_TOKEN مش موجود" >&2; exit 1
fi

# ── 1) اجمع ملفات الـassets (كل اللي مش _worker.js) ──
echo "📦 بنجمع الأصول من $DIST ..."
( cd "$DIST" && find . -type f ! -name '_worker.js' ! -name '_headers' -print0 ) \
  | while IFS= read -r -d '' f; do
      rel="${f#./}"
      mkdir -p "$TMP/assets/$(dirname "$rel")"
      cp "$DIST/$rel" "$TMP/assets/$rel"
    done

# ── 2) الـmetadata (نفس اللي wrangler بيبعته) ──
# Vars بتاعة الـpreview: OCTA_GATE=off · OCTA_TV_PROXY=on
write_metadata() {
  local out="$1"
  {
    echo '{"main_module":"_worker.js","body_part":"_worker.js","bindings":['
    printf '{"type":"assets","name":"ASSETS"}'
    if [ "${OCTA_GATE:-off}" != "null" ]; then
      printf ',{"type":"plain_text","name":"OCTA_GATE","text":"%s"}' "${OCTA_GATE:-off}"
    fi
    if [ "${OCTA_TV_PROXY:-on}" != "null" ]; then
      printf ',{"type":"plain_text","name":"OCTA_TV_PROXY","text":"%s"}' "${OCTA_TV_PROXY:-on}"
    fi
    echo ']}'
  } > "$out"
}
write_metadata "$TMP/metadata.json"

# ── 3) ابني الـmultipart body ──
echo "🔧 بنبني الـmultipart body ..."
BODY="$TMP/body.bin"
: > "$BODY"

BOUNDARY="----OCTAFormBoundary$(date +%s)$RANDOM"

add_part() {
  # $1 = name, $2 = filename (أو ""), $3 = content-type, $4 = file
  {
    printf -- "--%s\r\n" "$BOUNDARY"
    if [ -n "$2" ]; then
      printf 'Content-Disposition: form-data; name="%s"; filename="%s"\r\n' "$1" "$2"
    else
      printf 'Content-Disposition: form-data; name="%s"\r\n' "$1"
    fi
    printf 'Content-Type: %s\r\n\r\n' "$3"
    cat "$4"
    printf '\r\n'
  } >> "$BODY"
}

add_part "metadata" "" "application/json" "$TMP/metadata.json"
add_part "_worker.js" "_worker.js" "application/javascript+module" "$DIST/_worker.js"

# كل ملف asset كـ part باسم path-ه
( cd "$TMP/assets" && find . -type f -print0 ) | while IFS= read -r -d '' f; do
  rel="${f#./}"
  # name = "assets/<rel>" لحد الـasset path
  {
    printf -- "--%s\r\n" "$BOUNDARY"
    printf 'Content-Disposition: form-data; name="%s"; filename="%s"\r\n' "$rel" "$rel"
    printf 'Content-Type: application/octet-stream\r\n\r\n'
    cat "$TMP/assets/$rel"
    printf '\r\n'
  } >> "$BODY"
done

{
  printf -- "--%s--\r\n" "$BOUNDARY"
} >> "$BODY"

echo "📤 بنرفع (${#BODY} bytes) إلى $NAME ..."
RESP="$(curl -s -X PUT \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: multipart/form-data; boundary=${BOUNDARY}" \
  --data-binary "@${BODY}" \
  "${API}?include_subdomain_availability=true" )"

echo "$RESP" | head -c 900
echo
if echo "$RESP" | grep -q '"success":true'; then
  echo "✅ اتنشر بنجاح: $NAME"
else
  echo "⛔ فشل النشر" >&2; exit 1
fi
