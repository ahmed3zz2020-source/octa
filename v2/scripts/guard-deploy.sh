#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# 🛡️ حارس نشر V2 — يمنع نشر V2 على الإنتاج أو المعاينة الحالية
# ═══════════════════════════════════════════════════════════════
# ⛔ يمنع: octa (الإنتاج · octashares.com)
# ⛔ يمنع: octa-preview (المعاينة الحالية)
# ⛔ يمنع: octa-v2 (نسخة قديمة باسم V2 — غير معزولة)
# ✅ يسمح: octa-v2-preview (المعاينة الثالثة المستقلة)
set -euo pipefail

CONFIG="${1:-v2/wrangler.v2-preview.jsonc}"
ALLOWED_NAME="octa-v2-preview"
FORBIDDEN_NAMES="octa octa-preview octa-v2"

echo "🛡️ حارس نشر V2 — الملف: $CONFIG"

if [ ! -f "$CONFIG" ]; then
  echo "⛔ الملف غير موجود: $CONFIG"
  exit 1
fi

# اسم العامل من ملف الإعداد (jsonc ⇒ ن stripping للتعليقات بشكل مبسّط)
NAME=$(sed -e 's|/\*.*\*/||g' -e 's|//.*$||' "$CONFIG" | grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')

if [ -z "$NAME" ]; then
  echo "⛔ تعذّر قراءة اسم العامل من $CONFIG"
  exit 1
fi

echo "   · اسم العامل: $NAME"

for BAD in $FORBIDDEN_NAMES; do
  if [ "$NAME" = "$BAD" ]; then
    echo "⛔⛔⛔ مرفوض: '$NAME' هدف إنتاج/معاينة/نسخة قديمة — ممنوع في مسار V2."
    exit 1
  fi
done

if [ "$NAME" != "$ALLOWED_NAME" ]; then
  echo "⛔⛔⛔ مرفوض: الاسم المسموح الوحيد في مسار V2 هو '$ALLOWED_NAME' (والحالي '$NAME')."
  exit 1
fi

# ⛔ لا worker script في إعدادات V2 (يعني لا مسارات /api ولا Railway)
if grep -q '"main"[[:space:]]*:' "$CONFIG"; then
  echo "⛔⛔⛔ مرفوض: إعدادات V2 لا تحتوي 'main' — أي worker script يفتح باب /api/* وRailway."
  exit 1
fi

# ⛔ لا KV ولا cron ولا أسرار
if grep -Eq '"kv_namespaces"|"crons"|"vars"|"durable_objects"|"r2_buckets"|"d1_databases"' "$CONFIG"; then
  echo "⛔⛔⛔ مرفوض: إعدادات V2 لا تحتوي KV / cron / vars / R2 / D1 — العزل يتطلب أصولًا فقط."
  exit 1
fi

echo "✅ الحارس مرّ: '$NAME' هدف V2 مسموح (أصول ثابتة فقط)."
echo "   تذكير: النشر يحتاج موافقة المالك — لا تنشر قبل اعتماده."
