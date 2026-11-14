#!/usr/bin/env python3
"""مولّد حالات اختبار لمطابقة محرك الأخبار (Worker JS ⇄ الباك Python).

⛔ ليش مش بنستورد update_prices؟
   البيئة دي مفيش فيها flask/requests والـpip mirror مقفول.
   ⇒ بنستخرج الدالة `news_engine` + `MATERIAL_KEYWORDS` من **الكود المصدري**
     (تحليل AST — مش نسخ يدوي) وبنشغّلها في عملية معزولة.
   ⇒ كده المقارنة بتكون على كود الباك الحقيقي، مش على نسخة مكتوبة بإيدنا.

الاستخدام:  python3 tools/gen-halan-news-cases.py <out.json>
"""
import ast
import json
import os
import sys

BACKEND = os.environ.get("OCTA_BACKEND_DIR", "/workspace/work/octa-prices")
KV_EVENTS = os.environ.get("HALAN_KV_EVENTS", "/tmp/kv_events.json")


def extract_node(src, name):
    """بيرجّع عقدة الدالة/الثابت من الكود المصدري (AST)."""
    tree = ast.parse(src)
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return node
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id == name:
                    return node
    raise KeyError("مش لاقي: " + name)


def build_engine_module(actions, halan_by_code):
    """يبني موديل بايثون فيه news_engine + MATERIAL_KEYWORDS + _actions."""
    src = open(os.path.join(BACKEND, "update_prices.py"), encoding="utf-8").read()

    nodes = [
        extract_node(src, "MATERIAL_KEYWORDS"),
        extract_node(src, "news_engine"),
    ]

    # news_engine بيقرأ المتغير العام _actions ⇒ لازم نمدّيه قبل النداء.
    prelude = ast.parse("_actions = []\n").body

    mod = ast.Module(body=prelude + nodes, type_ignores=[])
    ast.fix_missing_locations(mod)

    # ⛔ مهم: news_engine بيقرأ `_actions` كـ**متغير عام في الموديل**
    #    ⇒ لازم نلمس الموديل بعد التنفيذ (مش الـnamespaceINITIAL).
    mod_ns = {"__name__": "extracted_octa_news"}
    exec(compile(mod, "<extracted>", "exec"), mod_ns)
    mod_ns["_actions"] = actions

    # ⛔ الأهم: الباك بيشوف أحداث هالان من `_halan_actions` (كاش على القرص)
    #    ⇒ لازم نحطّ نفس أحداث هالان في نفس المتغير العام.
    #    (لو ما حطّيناهاش ⇒ الباك مش بيشوف هالان والمقارنة هتبقى مضلّلة)
    mod_ns["_halan_actions"] = halan_by_code
    return mod_ns["news_engine"], mod_ns


def load_halan_by_code():
    out = {}
    with open(KV_EVENTS, encoding="utf-8") as fh:
        d = json.load(fh)
    for e in d.get("events") or []:
        code = str(e.get("code") or "").upper()
        if not code:
            continue
        out.setdefault(code, []).append({
            "kind": e.get("kind") or "general",
            "kindAr": e.get("kindAr"),
            "headline": e.get("headline") or "",
            "date": e.get("date"),
            "value": None,
        })
    return out


def load_backend_actions():
    """أحداث الباك (foudalens) — من الـAPI الحيّ (div_actions محتاج شبكة).

    📌 الـendpoint بيرجّع List ده بعد ما الـWorker يدمج هالان
       ⇒ نفصل اللي مصدره BFD (source مش 'halan') عن هالان.
    """
    api = os.environ.get(
        "OCTA_DIVIDENDS_URL",
        "https://octa-preview.ahmed3zz2020.workers.dev/api/dividends")
    try:
        import urllib.request
        req = urllib.request.Request(
            api, headers={"User-Agent": "Mozilla/5.0 octa-news-cases"})
        with urllib.request.urlopen(req, timeout=40) as r:
            d = json.loads(r.read().decode())
    except Exception as e:
        print("⚠️  مقدرتش أقرأ /api/dividends: %s ⇒ هستخدم مفيش" % e)
        return [], "فاضي"

    acts = []
    for a in d.get("actions") or []:
        if a.get("source") == "halan":
            continue          # ده هالان — هنجيبه من KV
        acts.append(a)
    return acts, "/api/dividends"


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/halan-news-cases.json"

    halan_by_code = load_halan_by_code()
    actions, src_name = load_backend_actions()

    news_engine, _mod_ns = build_engine_module(actions, halan_by_code)

    backend_by_code = {}
    for a in actions:
        code = str(a.get("code") or "").upper()
        if not code:
            continue
        backend_by_code.setdefault(code, []).append(a)

    codes = sorted(set(list(backend_by_code.keys()) + list(halan_by_code.keys())))

    cases = []
    for code in codes:
        be = backend_by_code.get(code, [])
        he = halan_by_code.get(code, [])
        merged = list(be)
        seen = set()
        for e in be:
            seen.add((str(e.get("kind") or ""), str(e.get("date") or "")[:10]))
        for e in he:
            k = (str(e.get("kind") or ""), str(e.get("date") or "")[:10])
            if k in seen:
                continue
            seen.add(k)
            merged.append(e)
        merged.sort(key=lambda x: str(x.get("date") or ""), reverse=True)

        expected = news_engine({"code": code})
        if not expected:
            continue
        cases.append({
            "code": code,
            "backend_events": be,
            "halan_events": he,
            "expected": {
                "score": expected.get("score"),
                "has_news": expected.get("has_news"),
                "materiality": expected.get("materiality"),
                "confidence": expected.get("confidence"),
                "events_count": expected.get("events_count"),
                "events": expected.get("events") or [],
                "positives": expected.get("positives") or [],
                "negatives": expected.get("negatives") or [],
                "neutral": expected.get("neutral") or [],
                "headline": expected.get("headline"),
            },
        })

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(cases, fh, ensure_ascii=False, indent=1)

    with_news = sum(1 for c in cases if c["expected"]["has_news"])
    print(f"✅ {len(cases)} حالة · منها {with_news} عندها أحداث · {out_path}")
    print(f"   مصدر أحداث الباك: {src_name} ({len(actions)} حدث)")


if __name__ == "__main__":
    main()
