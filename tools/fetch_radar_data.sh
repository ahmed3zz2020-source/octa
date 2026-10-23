#!/usr/bin/env bash
# 🔧 OCTA Smart Money Radar — جلب لقطة البيانات الحيّة (للتطوير فقط)
# ───────────────────────────────────────────────────────────────────
# 📌 الجلب بيتم وقت التشغيل في المتصفح من الـAPI مباشرة.
#    ده بس عشان نبني/نختبر المرجع والمحرك محلياً ببيانات حقيقية.
#
# ⚠️ التوكن مش مطلوب — المسارات دي مفتوحة:
#    /api/market_tech?market=egypt   (EGX: RSI · SMA200 · MACD · Perf · relvol …)
#    /api/quotes                     (٤ أسواق: close · change · volume · mc · Recommend.All)
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="${OCTA_API:-https://octa-prices-production-4ccb.up.railway.app}"
OUT="tools"

echo "⏳ جالب market_tech…"
curl -sS --max-time 60 "$BASE/api/market_tech?market=egypt" -o "$OUT/_live_mt_egypt.json"
echo "⏳ جالب quotes…"
curl -sS --max-time 60 "$BASE/api/quotes" -o "$OUT/_live_quotes.json"

python3 - "$OUT" <<'PY'
import json, sys
o = sys.argv[1]
mt = json.load(open(f"{o}/_live_mt_egypt.json", encoding="utf-8"))
q  = json.load(open(f"{o}/_live_quotes.json", encoding="utf-8"))
print(f"✅ market_tech: {sum(len(v) for v in mt.get('markets', {}).values())} سهم | "
      f"quotes: {q.get('counts')}")
print(f"   snapshot: {mt.get('snapshot_id')} · updated: {mt.get('updated')}")
PY

echo "⏳ بيبني المرجع…"
python3 tools/build_radar_ref.py
