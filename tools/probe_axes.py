"""
probe_axes.py — يشغّل دوال التقييم الفعلية من update_prices.py على بيانات حقيقية
                 بدون تشغيل السيرفر أو أي طلب شبكة.

الطريقة: parse الملف بـ ast، أستخرج الدوال المطلوبة فقط، وأنفّذها في مساحة معزولة.
مفيش أي تعديل على update_prices.py — قراءة فقط.

الاستخدام:
    python3 /workspace/octa5/tools/probe_axes.py
"""
import ast
import json
import os
import sys

SRC = "/workspace/octa-prices/update_prices.py"
DATA = "/workspace/octa5/data_full.json"

WANT = {
    "tech_score", "derive_technical", "fundamental_score", "build_sector_stats",
    "liquidity_score", "final_score", "sentiment_engine", "risk_engine",
    "news_engine", "portfolio_fit",
}

GLOBALS = {
    "AXIS_WEIGHTS": {
        "technical": 0.18, "fundamental": 0.22, "liquidity": 0.18,
        "news": 0.05, "sentiment": 0.04, "risk": 0.24, "portfolio": 0.09,
    },
    "SENTIMENT_CAP": 25,
    "PORTFOLIO": {"holdings": {}, "cash": 0.0},
    "SECTOR_STATS": {},
    "_actions": [],
    "material": None,
}


def load_funcs():
    src = open(SRC, encoding="utf-8").read()
    tree = ast.parse(src)
    keep = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in WANT:
            keep.append(node)
    mod = ast.Module(body=keep, type_ignores=[])
    ns = dict(GLOBALS)
    exec(compile(ast.fix_missing_locations(mod), SRC, "exec"), ns)
    return ns, [n.name for n in keep]


def main():
    ns, got = load_funcs()
    print("extracted:", sorted(got))
    missing = WANT - set(got)
    if missing:
        print("NOT FOUND:", sorted(missing))

    d = json.load(open(DATA, encoding="utf-8"))
    raw = d["stocks"]
    print("dataset _ts:", d.get("_ts"), "| _src:", d.get("_src"),
          "| rows:", len(raw), "| file:", DATA,
          "| size:", os.path.getsize(DATA))
    print()

    # ── اختبار 1: fundamental_score على سهم بـ 7 حقول فاضية ──
    empty = {"code": "ZZZ", "name": "اختبار", "sector": "عام", "price": 100.0}
    fs = ns["fundamental_score"](dict(empty), {})
    print("TEST 1 — fundamental_score على صف بلا أي بيانات مالية:")
    print("  score =", fs["score"], "| breakdown =", fs["breakdown"])
    print()

    # ── اختبار 2: نفس الدالة على القيم الحقيقية ──
    st = [dict(v) for v in raw.values()]
    for s in st:
        s.setdefault("sector", s.get("sector") or "عام")
    stats = ns["build_sector_stats"](st)
    print("sector_stats sectors:", len(stats))
    print()

    real = {}
    for s in st:
        f = ns["fundamental_score"](dict(s), stats)
        if f:
            real[s["code"]] = (f["score"], f["breakdown"], s)
    scores = sorted(v[0] for v in real.values())
    print("fundamental_score on real rows: n=%d min=%.1f p50=%.1f max=%.1f"
          % (len(scores), scores[0], scores[len(scores) // 2], scores[-1]))
    top = sorted(real.items(), key=lambda kv: -kv[1][0])[:5]
    print("  top5:", [(c, v[0]) for c, v in top])
    bot = sorted(real.items(), key=lambda kv: kv[1][0])[:5]
    print("  bot5:", [(c, v[0]) for c, v in bot])
    print()

    # ── اختبار 3: تغطية البيانات المالية الحقيقية مقابل counter الكود ──
    n = len(st)
    fields = ["pe", "pb", "roe", "nm", "de", "eps", "rev"]
    print("TEST 3 — تغطية حقول fundamental (7 حقول اللي conf_s بتحسبها):")
    cov = []
    for k in fields:
        c = sum(1 for s in st if s.get(k) is not None)
        cov.append(c)
        print(f"  {k:5} {c:4}/{n}  {c / n * 100:5.1f}%")
    avail_hist = {}
    for s in st:
        a = sum(1 for k in fields if s.get(k) is not None)
        avail_hist[a] = avail_hist.get(a, 0) + 1
    print("  توزيع avail (0..7):", dict(sorted(avail_hist.items())))
    print()

    # ── اختبار 4: liquidity + risk + final على صفوف حقيقية ──
    liq_scores, risk_saf, finals, crashed = [], [], [], []
    crash_err = set()
    liq_none = []
    for s in st:
        ns["derive_technical"](s)
        li = ns["liquidity_score"](s)
        rk = ns["risk_engine"](s, stats)
        t = ns["tech_score"](s)
        f = ns["fundamental_score"](s, stats)
        try:
            fin = ns["final_score"](s, t, f, li, stats)
        except TypeError as e:
            crashed.append(s["code"]); crash_err.add(str(e))
            fin = None
        if li:
            liq_scores.append((li["score"], s["code"]))
        else:
            liq_none.append(s["code"])
        if rk:
            risk_saf.append((rk["safety_score"], rk["risk_score"], s["code"]))
        if fin and fin.get("final_score") is not None:
            finals.append((fin["final_score"], s["code"], dict(fin["axes"])))
    for label, arr in (("liquidity", liq_scores), ("risk_safety", [x[0] for x in risk_saf]),
                       ("final", [x[0] for x in finals])):
        v = sorted(arr)
        if v:
            print(f"{label:12} n={len(v):3} min={v[0]:6.1f} p10={v[len(v)//10]:6.1f} "
                  f"p50={v[len(v)//2]:6.1f} p90={v[9*len(v)//10]:6.1f} max={v[-1]:6.1f}")
    print()

    # ── اختبار 5: إعادة الحساب في كتلة 4845 (المتلبّسة) ──
    print("TEST 4a — liquidity_score رجّع None (مفيش سعر):", len(liq_none), liq_none[:10])
    print()

    print("TEST 4b — final_score بيهـر على صفوف lacks risk axis:")
    print(f"  صفوف فقدت final_score بالكامل: {len(crashed)}/{n}")
    print(f"  الأخطاء: {crash_err}")
    print("  أمثلة:", crashed[:12])
    print()

    print("TEST 5 — الفرق بين خصم المخاطرة في final_score وفي إعادة الحساب:")
    W = GLOBALS["AXIS_WEIGHTS"]
    n_diff = 0
    max_gap = 0.0
    gap_ex = None
    for fsc, code, ax in finals:
        b = sum(ax[k] * W[k] for k in W)
        pen_capped = min(15.0, (100 - ax["risk"]) * 0.18)
        pen_loose = (100 - ax["risk"]) * 0.18
        if abs(pen_capped - pen_loose) > 0.05:
            n_diff += 1
            g = pen_loose - pen_capped
            if g > max_gap:
                max_gap, gap_ex = g, (code, ax["risk"], round(pen_capped, 2), round(pen_loose, 2))
    print(f"  صفوف يتأثر فيها الفرق: {n_diff}/{len(finals)} | أقصى فرق: {max_gap:.2f} نقطة")
    if gap_ex:
        print("  مثال:", gap_ex)
    print()

    out = {
        "dataset": {"file": DATA, "_ts": d.get("_ts"), "_src": d.get("_src"), "rows": len(raw)},
        "extracted": sorted(got),
        "fundamental_empty_row_score": fs["score"],
        "coverage": {k: sum(1 for s in st if s.get(k) is not None) for k in fields},
        "avail_hist": dict(sorted(avail_hist.items())),
    }
    dst = "/workspace/octa5/private-docs/_probe_out.json"
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
    print("wrote", dst)


if __name__ == "__main__":
    main()
