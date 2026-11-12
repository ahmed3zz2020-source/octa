#!/usr/bin/env bash
# تشغيل V2 محليًا (سيرفر ثابت — بلا أي خدمة خارجية)
# الاستخدام: bash v2/scripts/serve.sh [port]
set -euo pipefail
PORT="${1:-8099}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "🌐 OCTA V2 (تجريبي معزول) ⇒ http://127.0.0.1:${PORT}/"
echo "   المجلد: $ROOT"
echo "   ⛔ لا يتصل بأي خدمة خارجية — كل البيانات تجريبية داخل الحزمة."
exec python3 -m http.server "$PORT" --bind 127.0.0.1
