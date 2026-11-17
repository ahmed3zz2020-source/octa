#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""🛡️ الجولة ١٩ (SEC-024) — ترميز آلي **مضبوط** للحقول من الـAPI في سياق نص.

📌 المراجع المستقل: «النصوص الثابتة والقيم الرقمية مع تحقق النوع بدل إصلاح آلي عشوائي»
   ⇒ هنا بنعدّل **الحقول من الـAPI أو من مدخل المستخدم** فقط، وبنحدّد السطر بدقة،
   وبنعرض الـdiff قبل التطبيق، وبعدين بنتحقّق بالاختبارات + الفحص في المتصفح.

⛔ مافيش نشر · مافيش مورد مدفوع.
"""
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FIELDS = ROOT / "docs" / "xss-fields.json"

# ⛔ دالة الترميز المتاحة في كل ملف (متحقَّق منها بالبحث في الكود)
ESC = {
    "assets/js/octa-app.js": "esc",
    "assets/js/octa-pages.js": "ssEsc",
    "assets/js/octa-core.js": "octaEsc",
    "assets/js/octa-challenges.js": "esc",
    "assets/js/octa-radar-ui.js": "esc",
    "assets/js/octa-settings.js": "esc",
    "assets/js/octa-gate.js": "esc",
    "assets/js/octa-money.js": "esc",
}

TPL = re.compile(r"\$\{([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\}")
CONCAT = re.compile(r"(?<![\w$.'\"])([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)(?![\w$'\"])")


def last_ident(expr):
    return expr.split(".")[-1]


def patch_line(line, field, esc):
    out = line
    # ① داخل قالب جمل ${...}
    def tpl(m):
        expr = m.group(1)
        if last_ident(expr) != field:
            return m.group(0)
        if re.search(r"\b%s\s*\(" % re.escape(esc), expr):
            return m.group(0)
        return "${%s(%s)}" % (esc, expr)
    out = TPL.sub(tpl, out)
    # ② دمج نصوص: + X +
    def cat(m):
        expr = m.group(1)
        if last_ident(expr) != field:
            return expr
        if re.search(r"\b%s\s*\(" % re.escape(esc), expr):
            return expr
        return "%s(%s)" % (esc, expr)
    # ⛔ الدمج: لازم يكون محاط بـ+ على الجنبين أو بداية/نهاية سلسلة
    out = re.sub(r"\+\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\+",
                 lambda m: "+ " + cat(m) + " +", out)
    return out


def main():
    apply_mode = "--apply" in sys.argv
    data = json.loads(FIELDS.read_text(encoding="utf-8"))
    targets = [d for d in data
               if d["source"] in ("API", "مستخدم") and d["ctx"] == "نص"
               and d["file"] in ESC]
    by_file = {}
    for t in targets:
        by_file.setdefault(t["file"], {}).setdefault(t["line"], set()).add(t["name"])
    changed_total = 0
    for rel, lines_map in sorted(by_file.items()):
        path = ROOT / rel
        src = path.read_text(encoding="utf-8")
        lines = src.split("\n")
        esc = ESC[rel]
        touched = 0
        for ln, fields in lines_map.items():
            idx = ln - 1
            if idx < 0 or idx >= len(lines):
                continue
            orig = lines[idx]
            new = orig
            for f in sorted(fields):
                new = patch_line(new, f, esc)
            if new != orig:
                lines[idx] = new
                touched += 1
        if touched:
            changed_total += touched
            print("📝 %s: %d سطر" % (rel, touched))
            if apply_mode:
                path.write_text("\n".join(lines), encoding="utf-8")
    print("الإجمالي: %d سطر%s" % (changed_total, " (اتكتب)" if apply_mode else " (معاينة)"))
    if apply_mode:
        subprocess.run(["git", "-C", str(ROOT), "diff", "--stat"], check=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
