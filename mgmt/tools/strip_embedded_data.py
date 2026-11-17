#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🧹 شيل البيانات المدمجة من صفحة لوحة الإدارة (HTML)
=====================================================
🎯 الهدف: ملف HTML اللي بيتقدّم للعموم ما يحويش أي بيانات مستخدمين
   (لا إيميلات ولا عناوين IP ولا uid) ⇒ الداتا بتيجي من /api/* بعد الجلسة.

⭐ الدالة `strip(html)` pure (من غير كتابة ملفات) ⇒ قابلة للاختبار.
📌 الاستخدام:
    from strip_embedded_data import strip
    html, report = strip(html)
"""
import re

MARK = "R18-NO-EMBEDDED-DATA"

BASE_BLOCK = (
    "const DATA = null; /* " + MARK + " — مافيش بيانات مستخدمين مدمجة: "
    "الداتا كلها بتيجي من /api/* بعد التحقق من الجلسة */"
)

BASE_SKELETON = (
    "var D = null, sortKey = 'hits', sortDir = -1, sortUsers = null;\n"
    "/* " + MARK + " — الهيكل الفاضي: merge() يبني عليه (مافيش استنساخ من D) */\n"
    "const BASE = {\n"
    "  generated:'-', snapshot:'', api:'',\n"
    "  kpi:{users:0,pin_users:0,events:0,events7:0,login_events:0,login_count:0,\n"
    "      devices:0,ips:0,active7:0,active30:0,tracked:0,untracked:0,tracked_pct:0,\n"
    "      untracked_pct:0,sessions:0,guests:0,pages:[],by_event:[],actions:[],growth:[]},\n"
    "  users:[], timeline:[], devices:[], ips:[], hourly:new Array(24).fill(0),\n"
    "  daily:[], funnel:[]\n"
    "};"
)


def strip(html):
    """⛔ يرجّع (html_new, report) — شيل البيانات المدمجة."""
    report = {"changed": False, "had_data": False, "had_pull": False}
    if MARK in html:
        report["changed"] = False
        return html, report

    out = []
    for line in html.split("\n"):
        if line.startswith("const DATA = {"):
            report["had_data"] = True
            out.append(BASE_BLOCK)
            continue
        out.append(line)
    html = "\n".join(out)

    html = html.replace(
        "var D = DATA, sortKey = 'hits', sortDir = -1, sortUsers = null;",
        BASE_SKELETON,
    )
    html = html.replace(
        "  const out = JSON.parse(JSON.stringify(D));",
        "  const out = JSON.parse(JSON.stringify(BASE)); /* " + MARK + " */",
    )

    # ⛔ شيل pull() القديمة (بتبعت توكن الأدمن من المتصفح + عنوان backend مدمج)
    start = html.find("/* ══ التحديث الحي ══ */")
    end = html.find("function setSt(m,c){")
    if start != -1 and end != -1 and start < end:
        html = html[:start] + "function setSt(m,c){" + html[end + len("function setSt(m,c){"):]
        report["had_pull"] = True

    # ⛔ حارس: D فاضي ⇒ message واضح بدل crash
    html = html.replace(
        "function renderAll(){ DASH.browse = computeBrowse();",
        "function renderAll(){ if(!D){ var l=$('#loadingBox'); if(l) l.classList.add('on'); return; }"
        " DASH.browse = computeBrowse();",
    )
    html = html.replace(
        "  $('#gen').textContent = 'توليد: ' + D.generated + ' · لقطة: ' + (D.snapshot||'—');",
        "  $('#gen').textContent = D ? ('توليد: ' + D.generated + ' · لقطة: ' + (D.snapshot||'—'))"
        " : 'جاري تحميل البيانات…';",
    )
    html = html.replace(
        "  $('#footSnap').textContent = 'لقطة ' + (D.snapshot||'—');",
        "  $('#footSnap').textContent = D ? ('لقطة ' + (D.snapshot||'—')) : '—';",
    )

    report["changed"] = True
    return html, report


if __name__ == "__main__":
    import io
    import os
    import sys

    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "public", "index.html"
    )
    target = os.path.abspath(target)
    with io.open(target, "r", encoding="utf-8") as f:
        src = f.read()
    new, rep = strip(src)
    if rep["changed"]:
        with io.open(target, "w", encoding="utf-8") as f:
            f.write(new)
    print("✅ %s — بيانات مدمجة اتشالت: %s · pull() قديمة اتشالت: %s"
          % (os.path.relpath(target), rep["had_data"], rep["had_pull"]))
