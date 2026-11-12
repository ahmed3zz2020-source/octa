#!/usr/bin/env bash
# بناء ملفات V2 الثابتة (أصول فقط — بلا worker)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rm -rf "$ROOT/dist"
mkdir -p "$ROOT/dist"
cp "$ROOT/index.html" "$ROOT/dist/"
cp "$ROOT/favicon.svg" "$ROOT/dist/"
cp -r "$ROOT/assets" "$ROOT/dist/assets"
echo "✅ تم بناء V2 ⇒ $ROOT/dist"
echo "   ($(find "$ROOT/dist" -type f | wc -l) ملف)"
