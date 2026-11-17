#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🔍 ماسح التسرّب — يعدّ الإيميلات وعناوين الـIP في ملف/HTML *بدون* طباعة أي قيمة.

⛔ قاعدة صارمة: المخرجات أعداد فقط (عدد/عدد). أي قيمة مش بتتطبع.
⛔ الاستخدام:
    python3 scan_leak.py <path> [<path> ...]
    python3 scan_leak.py --url https://host/    (بيجيب من الشبكة)
"""
import re
import sys
import json
import urllib.request

# ⛔ إيميل: نمط عملي — [local]@ [domain] [tld]
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
# ⛔ عنوان IPv4 صالح (أرقام 0-255)
IPV4_RE = re.compile(
    r"(?<![\w.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}"
    r"(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\w.])"
)

# ⛔ استثناءات معروفة: ليست بيانات مستخدمين (بنية/إصدار/سكريبت)
IPV4_ALLOW = {
    "0.0.0.0",
    "127.0.0.1",
    "255.255.255.255",
    "1.1.1.1",
}


def scan_text(t):
    emails = set(EMAIL_RE.findall(t))
    ips = set()
    for ip in IPV4_RE.findall(t):
        if ip in IPV4_ALLOW:
            continue
        ips.add(ip)
    # ⛔ أسماء المتغيّرات/المضيفات (عناوين داخلية) — عدد فقط
    hosts = set(re.findall(r"[A-Za-z0-9\-]+\.(?:up\.railway\.app|workers\.dev)", t))
    return {
        "emails": len(emails),
        "ips": len(ips),
        "hosts": len(hosts),
        "bytes": len(t.encode("utf-8", "replace")),
    }


def scan_file(p):
    with open(p, "r", encoding="utf-8", errors="replace") as f:
        return scan_text(f.read())


def scan_url(u):
    req = urllib.request.Request(u, headers={"User-Agent": "octa-leak-scan/1.0"})
    with urllib.request.urlopen(req, timeout=45) as r:
        body = r.read().decode("utf-8", "replace")
        out = scan_text(body)
        out["status"] = r.status
        return out


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    results = []
    for a in argv:
        try:
            if a.startswith("--url="):
                a = a.split("=", 1)[1]
            if a.startswith("http://") or a.startswith("https://"):
                results.append({"target": "url", "ok": True, **scan_url(a)})
            else:
                results.append({"target": a, "ok": True, **scan_file(a)})
        except Exception as e:  # ⛔ ما بنطبعش تفاصيل حسّاسة
            results.append({"target": a, "ok": False, "error": type(e).__name__})
    for r in results:
        if not r.get("ok"):
            print("❌ %s → %s" % (r["target"], r.get("error")))
            continue
        extra = ""
        if "status" in r:
            extra = " · status=%s" % r["status"]
        print(
            "%s · bytes=%s · emails=%s · ips=%s · hosts=%s%s"
            % (r["target"], r["bytes"], r["emails"], r["ips"], r["hosts"], extra)
        )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
