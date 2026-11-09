#!/bin/bash
# ⭐ بناء بدون bump-cache (عشان نخلي الـlocal = الـcommit = الـpreview بنفس الختم)
set -e
cd /workspace/octa
STAMP=$(grep -o "var BUILD = 'v=[0-9]*'" index.html | head -1 | grep -o '[0-9]\{12\}')
echo "🧾 stamp من index.html: $STAMP"
python3 - "$STAMP" <<'PY'
import json, sys, time
json.dump({"build": "v=" + sys.argv[1], "ts": int(time.time()*1000)}, open('version.json','w'), indent=2)
print("  🆕 version.json:", sys.argv[1])
PY
rm -rf dist && mkdir -p dist
cp index.html dist/ && cp sw.js dist/ && cp reset.html dist/ && cp gate.html dist/ && cp market.html dist/
cp robots.txt dist/ && cp sitemap.xml dist/ && cp manifest.json dist/
mkdir -p dist/admin && cp admin/index.html admin/users.html admin/README.md admin/MONTHLY-REPORT.md dist/admin/
cp -r assets/. dist/assets/
OCTA_STATIC_MARKETS=0 node tools/copy-data.js
cp _headers dist/_headers && cp data_ipo.json dist/data_ipo.json && cp version.json dist/version.json
node tools/mk-chart-root.js
echo _worker.js > dist/.assetsignore
node tools/check-dist.js
echo "✅ build بدون bump — الختم $STAMP"
