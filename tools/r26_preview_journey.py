#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R26 — رحلة المعاينة الحقيقية (برهان حيّ على workers.dev).

📌 الهدف ⭐: إثبات أن المعاينة **شغّالة فعليًا** ⭐: تسجيل ⭐ دخول ⭐ جلسة ⭐
   أسعار ⭐ محفظة ⭐ تنبيهات ⭐ إبطال فوري ⭐ — بخطوات **المستخدم الحقيقي**
   (كوكي + Origin من نفس الأصل) ⭐.

📌 مافيش أي اتصال بالإنتاج ⭐ (المعاينة معزولة ⭐).

📌 التشغيل:
   python3 tools/r26_preview_journey.py [https://octa-preview.ahmed3zz2020.workers.dev]
"""
import io
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

BASE = (sys.argv[1] if len(sys.argv) > 1
        else "https://octa-preview.ahmed3zz2020.workers.dev")
RESULTS = []


def ok(cond, label, extra=""):
    RESULTS.append((bool(cond), label))
    print(("  [PASS] " if cond else "  [FAIL] ") + label +
          (("  — " + str(extra)) if extra else ""), flush=True)
    return bool(cond)


def call(path, method="GET", body=None, cookie=None, origin=None):
    url = BASE + path
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    # ⛔ User-Agent متصنعاع ⭐ — البوابة بترفض العملات غير المتصنعاع ⭐
    headers = {"Accept": "application/json",
               "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) octa-preview-journey"}
    if data is not None:
        headers["Content-Type"] = "application/json; charset=utf-8"
    if cookie:
        headers["Cookie"] = cookie
    if origin:
        headers["Origin"] = origin
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        res = urllib.request.urlopen(req, timeout=30)
        raw = res.read().decode("utf-8", "replace")
        sc = res.headers.get("Set-Cookie") or ""
        status = res.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        sc = e.headers.get("Set-Cookie") or ""
        status = e.code
    except Exception as e:
        return {"status": 0, "json": None, "cookie": "", "raw": str(e)}
    try:
        j = json.loads(raw)
    except Exception:
        j = None
    return {"status": status, "json": j, "cookie": sc.split(";")[0], "raw": raw}


def main():
    print("== رحلة المعاينة الحقيقية ==")
    print("   %s" % BASE)
    print()

    email = "r26.journey.%s@example.com" % uuid.uuid4().hex[:8]
    device = "dev-%s" % uuid.uuid4().hex

    # ① الفحص
    h = call("/api/health")
    ok(h["status"] == 200 and (h["json"] or {}).get("ok"),
       "① /api/health ⇒ 200 وجسم صالح", h["status"])
    ok((h["json"] or {}).get("source") == "preview-isolated",
       "①ب المعاينة معزولة (مش الشكل ده)", (h["json"] or {}).get("source"))

    # ② التسجيل
    s = call("/api/auth/signup/start", "POST",
             {"name": "رحلة R26", "email": email}, origin=BASE)
    code = (s["json"] or {}).get("preview_code")
    ok(s["status"] == 200 and bool(code), "② التسجيل (start) ⇒ كود وصل", s["status"])

    v = call("/api/auth/signup/verify", "POST", {"email": email, "code": code}, origin=BASE)
    ok(v["status"] == 200 and (v["json"] or {}).get("needs_pin"),
       "②ب تأكيد الكود ⇒ محتاج باسورد", v["status"])

    n = call("/api/auth/signup/newpin", "POST",
             {"email": email, "code": code, "pin": "2468", "device": device}, origin=BASE)
    cookie = n["cookie"]
    ok(n["status"] == 200 and bool((n["json"] or {}).get("token")),
       "②ج إنشاء الحساب ⇒ توكن + كوكي", n["status"])
    ok(cookie.startswith("octa_token="), "②د كوكي الجلسة اترسل", cookie[:24])

    # ③ الجلسة
    me = call("/api/auth/me", cookie=cookie)
    ok(me["status"] == 200 and (me["json"] or {}).get("user", {}).get("email") == email,
       "③ من أنا بالجلسة ⇒ صح", me["status"])

    # ④ الأسعار
    q = call("/api/quotes?market=egypt")
    n_egy = len(((q["json"] or {}).get("markets") or {}).get("egypt") or {})
    ok(q["status"] == 200 and n_egy > 50, "④ الأسعار من لقطة المعاينة ⇒ %d سهم" % n_egy, q["status"])

    # ⑤ المحفظة
    pw = call("/api/portfolio", "POST",
              {"cash": 5000, "positions": {"COMI": {"shares": 10, "cost": 12.5}}},
              cookie=cookie, origin=BASE)
    ok(pw["status"] == 200, "⑤ حفظ المحفظة", pw["status"])
    pr = call("/api/portfolio", cookie=cookie)
    pf = (pr["json"] or {}).get("portfolio") or {}
    ok(pf.get("cash") == 5000 and (pf.get("positions") or {}).get("COMI", {}).get("shares") == 10,
       "⑤ب قراءة المحفظة ⇒ البيانات صح", pf.get("cash"))

    # ⑥ التنبيهات + منع التكرار
    a1 = call("/api/alerts", "POST", {"alert": {"id": "r26-1", "symbol": "COMI", "kind": "price"}},
              cookie=cookie, origin=BASE)
    a2 = call("/api/alerts", "POST", {"alert": {"id": "r26-1", "symbol": "COMI", "kind": "price"}},
              cookie=cookie, origin=BASE)
    ok(a1["status"] == 200 and (a1["json"] or {}).get("created"), "⑥ إضافة تنبيه", a1["status"])
    ok((a2["json"] or {}).get("dedup") is True,
       "⑥ب التنبيه المكرر اتمنع (مافيش تكرار)", (a2["json"] or {}).get("dedup"))

    # ⑦ التجديد
    rf = call("/api/auth/refresh", "POST", {}, cookie=cookie, origin=BASE)
    new_cookie = rf["cookie"]
    ok(rf["status"] == 200 and bool(new_cookie), "⑦ تجديد الجلسة", rf["status"])
    old = call("/api/auth/me", cookie=cookie)
    ok(old["status"] == 401, "⑦ب الجلسة القديمة ماتت بعد التجديد", old["status"])

    # ⑧ الخروج + الإبطال الفوري
    lo = call("/api/auth/logout", "POST", {}, cookie=new_cookie, origin=BASE)
    ok(lo["status"] == 200 and (lo["json"] or {}).get("revoked"), "⑧ تسجيل الخروج", lo["status"])
    after = call("/api/auth/me", cookie=new_cookie)
    ok(after["status"] == 401, "⑧ب الإبطال فوري (الجلسة ماتت)", after["status"])

    # ⑨ الدخول تاني
    li = call("/api/auth/pin/login", "POST", {"pin": "2468", "device": device}, origin=BASE)
    ok(li["status"] == 200 and bool((li["json"] or {}).get("token")), "⑨ دخول تاني بالباسورد", li["status"])
    bad = call("/api/auth/pin/login", "POST", {"pin": "0000", "device": device}, origin=BASE)
    ok(bad["status"] == 401, "⑨ب باسورد غلط اترفض", bad["status"])

    # ⑩ CSRF
    cs = call("/api/auth/logout", "POST", {}, cookie=li["cookie"], origin="https://evil.example")
    ok(cs["status"] == 403, "⑩ طلب من أصل خارجي اترفض (CSRF)", cs["status"])

    # ⑪ عزل المحفظة
    email2 = "r26.journey2.%s@example.com" % uuid.uuid4().hex[:8]
    s2 = call("/api/auth/signup/start", "POST", {"name": "تاني", "email": email2}, origin=BASE)
    c2 = (s2["json"] or {}).get("preview_code")
    n2 = call("/api/auth/signup/newpin", "POST",
              {"email": email2, "code": c2, "pin": "1357", "device": "dev-" + uuid.uuid4().hex},
              origin=BASE)
    pf2 = call("/api/portfolio", cookie=n2["cookie"])
    ok(((pf2["json"] or {}).get("portfolio") or {}).get("cash") in (0, None),
       "⑪ محفظة الحساب التاني فاضية (عزل ⭐)", (pf2["json"] or {}).get("portfolio"))

    passed = sum(1 for r in RESULTS if r[0])
    failed = len(RESULTS) - passed
    print()
    print("RESULT: %d/%d PASS · %d FAIL" % (passed, len(RESULTS), failed))
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
