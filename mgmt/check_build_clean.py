#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🛡️ حارس البناء النظيف — لوحة الإدارة (octa-mgmt)
================================================
🎯 الهدف: **الملف اللي بيتقدّم للعموم** (public/index.html) ما فيهوش أي
   بيانات مستخدمين حقيقية: لا إيميلات ولا عناوين IP ولا عنوان الـbackend.

⛔ Output = أعداد فقط (عدد الإيميلات / عدد الـIPs). ⛔ مافيش أي قيمة بتتطبع.
⛔ الفشل = exit code غير صفري ⇒ «بناء نظيف» قابل للقياس في الـCI.

📌 التشغيل:
    python3 mgmt/check_build_clean.py                      # يفحص مجلد public كله
    python3 mgmt/check_build_clean.py public/index.html    # ملف واحد
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_TARGET = os.path.join(HERE, "public")

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
IPV4_RE = re.compile(
    r"(?<![\w.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}"
    r"(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\w.])"
)
HOST_RE = re.compile(r"[A-Za-z0-9\-]+\.(?:up\.railway\.app|workers\.dev)")

# ⛔ عناوين محجوزة — مش بيانات مستخدمين
IPV4_ALLOW = {"0.0.0.0", "127.0.0.1", "255.255.255.255", "1.1.1.1"}

TEXT_EXT = (".html", ".js", ".css", ".json", ".webmanifest", ".txt", ".md")


def scan_file(path):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()
    emails = set(EMAIL_RE.findall(text))
    ips = set(ip for ip in IPV4_RE.findall(text) if ip not in IPV4_ALLOW)
    hosts = set(HOST_RE.findall(text))
    return len(emails), len(ips), len(hosts)


def targets(paths):
    out = []
    for p in paths:
        if os.path.isdir(p):
            for root, _dirs, files in os.walk(p):
                for fn in files:
                    if fn.lower().endswith(TEXT_EXT):
                        out.append(os.path.join(root, fn))
        else:
            out.append(p)
    return sorted(out)


def main(argv):
    paths = argv or [DEFAULT_TARGET]
    files = targets(paths)
    if not files:
        print("❌ مافيش ملفات للفحص")
        return 2

    total_e = total_i = total_h = 0
    dirty = []
    for f in files:
        try:
            e, i, h = scan_file(f)
        except Exception as exc:
            print("❴ %s — %s" % (os.path.relpath(f), type(exc).__name__))
            continue
        total_e += e
        total_i += i
        total_h += h
        if e or i or h:
            dirty.append((os.path.relpath(f), e, i, h))
        print("  %-46s emails=%s ips=%s hosts=%s" % (os.path.relpath(f), e, i, h))

    print("──────────────────────────────────────────────")
    print("📦 ملفات=%s · إيميلات=%s · عناوين IP=%s · عناوين backend=%s"
          % (len(files), total_e, total_i, total_h))
    if dirty:
        print("❌ بناء مش نظيف — فيه بيانات شخصية/تسريب داخلي:")
        for rel, e, i, h in dirty:
            print("   ⚠ %s (emails=%s ips=%s hosts=%s)" % (rel, e, i, h))
        return 1
    print("✅ بناء نظيف — مافيش إيميلات ولا عناوين IP ولا عنوان backend")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
