#!/usr/bin/env python3
"""يبني خريطة الأسماء العربية للسوق السعودي والإماراتي.

📌 ليه؟ TradingView بيدي الاسم الإنجليزي بس، والفلتر بيعرض `name`
   ⇒ من غير الخريطة دي الكارت بيطلع **فاضي**.
📌 المصدر: data/data_markets.js (أسماء رسمية مجمّعة قبل كده).
📌 المخرج: data/market_names.js (صغير — بيتحمّل عند الطلب بس).
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "data_markets.js")
OUT = os.path.join(ROOT, "data", "market_names.js")

s = open(SRC, encoding="utf-8").read()
d = json.loads(s[s.index("{"):].rstrip().rstrip(";"))

names = {}
stats = {}
for mk in ("saudi", "uae"):
    rows = d.get(mk) or []
    got = 0
    for r in rows:
        code = str(r.get("code") or "").strip()
        nm = str(r.get("name") or "").strip()
        if not code or not nm:
            continue
        names[code] = nm
        got += 1
    stats[mk] = (len(rows), got)

# ⭐ نفس الاسم بأكتر من كود (بيحصل في الكود الرقمي) ⇒ الأولوية للي تقدر تتقرا
uniq = {}
for code, nm in names.items():
    if code in uniq:
        continue
    uniq[code] = nm

body = "/* ⭐ خريطة الأسماء العربية — سعودي + إمارات (بتتحمّل عند الطلب)\n" \
       "   مولّدة بـ: tools/build_market_names.py  ⛔ متعدّلش باليد */\n" \
       "window.OCTA_MKT_NAMES = " + json.dumps(uniq, ensure_ascii=False, separators=(",", ":")) + ";\n"
open(OUT, "w", encoding="utf-8").write(body)

print("✅ market_names.js:", len(body), "بايت ·", len(uniq), "اسم")
for mk, (tot, got) in stats.items():
    print(f"   {mk}: {got}/{tot} اسم عربي · ناقص: {tot - got}")
