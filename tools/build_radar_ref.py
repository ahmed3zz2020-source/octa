#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🔧 OCTA Smart Money Radar — بناء ملف المرجع (اسم + قطاع + صناعة)
──────────────────────────────────────────────────────────────────
📌 المبدأ: الأرقام **مش** من هنا — الأرقام من الـAPI وقت التشغيل.
   هنا الأسماء والقطاعات بس (مرجع ثابت، مش بيانات سوق).

🧩 ترتيب المصادر (الأعلى أولوية):
   ① tools/_backend_egx.json     → قائمة الباك: اسم عربي + قطاع عربي (٢٥٢) ⭐ الأفضل
   ② assets/js/octa-egx-names.js → اسم + قطاع (٢٣٠)
   ③ data/data_markets.js        → اسم + sectorAr + industry (٢٩٠)
   ④ data_full.json              → name + sectorAr + pack (٢٩٦)

🚫 قواعد صارمة:
   • كود يبدأ بـ EGS = سند/محفظة أو ISIN — **مش سهم** ⇒ يتشال.
   • ٥ أكواد ISIN معروفة بتترجَم لأسمائها الحقيقية (جدول التصحيح).
   • أي سهم مالوش قطاع ⇒ «غير مصنّف» (مش نخترع).
"""
import json
import os
import re
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 🚫 أكواد سندات حكومية / محافظ صناديق — مش أسهم (حجم شبه معدوم و mc فاضي)
NON_EQUITY = {
    "EGS30AJ1C016-EGP", "EGS65101C015", "EGS65621C012",
    "EGS65861C014", "EGS72L31C011",
}

# ⭐ جدول تصحيح ISIN → الرمز التجاري (مؤكد ٢٠٢٦-١٠-١٠)
#   TradingView بيرجّع بعض الأسهم المصرية تحت الـISIN بدل الرمز.
ISIN_MAP = {
    "EGS3I0S1C019": "FCMD",       # فيوتشر كير للصناعات الطبية
    "EGS48271C018-EGP": "ESAC",   # مصر جنوب أفريقيا للاتصالات
    "EGS370O1C013": "NAPR",       # الوطنية للطباعة
    "EGS3E071C013-EGP": "ACRO",   # أكرو مصر
    "EGS659O1C015": "IDSC",       # مصر الدولية للخدمات الطبية
}

# أسماء رُقد يدوية للأسهم اللي مش في أي مرجع (مثبتة في السجل)
MANUAL = {
    "IDSC": ("مصر الدولية للخدمات الطبية", "رعاية صحية"),
}

# ⭐ تطبيع أسماء القطاعات — عشان رادار القطاعات يجمّع صح
SECTOR_ALIAS = {
    "بنوك ومالية": "بنوك",
    "خدمات صحية": "رعاية صحية",
    "خدمات استهلاكية": "سلع استهلاكية",
    "صناعات عملية": "صناعة",
    "صناعات": "صناعة",
    "تجزئة وتوزيع": "سلع استهلاكية",
    "خدمات تجارية": "متنوع",
    "عام": "متنوع",
    "غير محدد": "غير مصنّف",
    "غير محدد ": "غير مصنّف",
    "Commercial Services": "متنوع",
    "Process Industries": "صناعة",
    "Retail": "سلع استهلاكية",
    "Distribution": "سلع استهلاكية",
    "Financial Services": "خدمات مالية",
    "Health Care": "رعاية صحية",
    "Real Estate": "عقارات",
    "Technology": "تكنولوجيا",
    "Banks": "بنوك",
    "Insurance": "تأمين",
    "Telecommunications": "اتصالات",
    "Media": "إعلام",
    "Tourism": "سياحة",
    "Transportation": "نقل",
    "Energy": "طاقة",
    "Petrochemicals": "بتروكيماويات",
    "Basic Resources": "مواد أساسية",
    "Consumer Goods": "سلع استهلاكية",
    "Consumer Staples": "سلع استهلاكية",
    "Consumer Services": "سلع استهلاكية",
    "Agriculture": "زراعة",
    "Industrial": "صناعة",
    "Diversified": "متنوع",
    "Funds": "صناديق",
    "Utilities": "طاقة",
}


def norm_sector(s):
    if not s:
        return None
    s = str(s).strip()
    if not s or s in ("—", "-", "null", "None"):
        return None
    return SECTOR_ALIAS.get(s, s)


def load_json(path):
    p = os.path.join(ROOT, path)
    if not os.path.exists(p):
        return None
    return json.load(open(p, encoding="utf-8"))


def load_octegx_names():
    p = os.path.join(ROOT, "assets/js/octa-egx-names.js")
    s = open(p, encoding="utf-8", errors="replace").read()
    i = s.index('{"names"')
    j = s.rindex("}") + 1
    return json.loads(s[i:j])


def load_data_markets():
    p = os.path.join(ROOT, "data/data_markets.js")
    s = open(p, encoding="utf-8", errors="replace").read()
    return json.loads(s[s.index("{"): s.rindex("}") + 1])


def main():
    live_path = os.path.join(ROOT, "tools/_live_mt_egypt.json")
    if not os.path.exists(live_path):
        print("⛔ محتاج snapshot من /api/market_tech — شغّل tools/fetch_radar_data.sh")
        return 1
    mt = json.load(open(live_path, encoding="utf-8"))["markets"]["egypt"]

    backend = load_json("tools/_backend_egx.json") or {}
    en = load_octegx_names()
    dmk = {r["code"]: r for r in load_data_markets().get("egypt", [])}
    dfull = (load_json("data_full.json") or {}).get("stocks", {})

    # ── بناء الكون ─────────────────────────────────────────────
    universe = {}
    for raw_code in sorted(mt):
        if raw_code in NON_EQUITY:
            continue
        code = ISIN_MAP.get(raw_code, raw_code)
        universe[code] = mt[raw_code]

    ref = {}
    for code in sorted(universe):
        name = sector = industry = None

        # ① قائمة الباك (252) — الأفضل
        if code in backend:
            name, sector = backend[code][0], backend[code][1]

        # ② مرجع الواجهة
        if code in en.get("names", {}):
            name = name or en["names"][code]
            sector = sector or en.get("sectors", {}).get(code)

        # ③ data_markets
        row = dmk.get(code)
        if row:
            name = name or row.get("name")
            industry = industry or row.get("industry")
            if not sector:
                sector = norm_sector(row.get("sectorAr"))

        # ④ data_full
        d = dfull.get(code)
        if d:
            name = name or d.get("name")
            industry = industry or d.get("industry")
            if not sector:
                sector = norm_sector(d.get("sectorAr")) or norm_sector(d.get("pack"))

        # ⑤ يدوي
        if code in MANUAL:
            name = MANUAL[code][0]
            sector = MANUAL[code][1]

        if not name:
            continue
        ref[code] = {
            "n": name,
            "s": sector or "غير مصنّف",
            "i": industry or "",
        }

    # ── تقرير التغطية ───────────────────────────────────────────
    dist = Counter(v["s"] for v in ref.values())
    miss_sector = [c for c in sorted(universe) if c in ref and ref[c]["s"] == "غير مصنّف"]
    print("📊 مرجع الرادار:")
    print(f"   أسواق حيّة: {len(mt)}  →  بعد التنظيف: {len(universe)}")
    print(f"   مدخلة في المرجع: {len(ref)} / {len(universe)}")
    print(f"   غير مصنّف: {len(miss_sector)} {miss_sector}")
    print("   توزيع القطاعات:")
    for k, v in dist.most_common():
        print(f"      {k:18s} {v}")

    out = os.path.join(ROOT, "assets/js/octa-radar-ref.js")
    body = ",\n".join(
        f'  {json.dumps(c, ensure_ascii=False)}: {{"n":{json.dumps(ref[c]["n"], ensure_ascii=False)},'
        f'"s":{json.dumps(ref[c]["s"], ensure_ascii=False)},'
        f'"i":{json.dumps(ref[c]["i"], ensure_ascii=False)}}}'
        for c in sorted(ref)
    )
    with open(out, "w", encoding="utf-8") as f:
        f.write(
            "/* ══════════════════════════════════════════════════════════════\n"
            "   🗺️ OCTA Smart Money Radar — مرجع الأسماء والقطاعات\n"
            "   ──────────────────────────────────────────────────────────────\n"
            "   ⛔ ده **مرجع ثابت** (أسماء + قطاعات) — مش بيانات سوق.\n"
            "      كل الأرقام بتيجي من الـAPI وقت التشغيل.\n"
            f"   📌 مولّد آلياً: tools/build_radar_ref.py · {len(ref)} سهم\n"
            "   ⛔ أي سهم مالوش قطاع ⇒ 'غير مصنّف' (مش نخترع).\n"
            "   ══════════════════════════════════════════════════════════════ */\n"
            "window.OCTA_RADAR_REF = {\n" + body + "\n};\n"
        )
    print(f"\n✅ اتكتب: assets/js/octa-radar-ref.js  ({os.path.getsize(out):,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
