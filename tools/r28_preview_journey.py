#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R28 — رحلة المعاينة الحقيقية (برهان حيّ على workers.dev) ⭐

📌 الفرق عن R26 ⭐: الكود **مش** بيرجع في رد التسجيل ⭐
   (R26-I01 ⭐ — كان استحواذ على أي حساب ⭐) ⇒ الكود في **صندوق المعاينة** ⭐
   (محتاج مفتاح المعاينة ⭐ = متغيّر بيئة ⭐ — مش في المستودع ⭐).

📌 التشغيل ⭐:
   PREVIEW_CONSOLE_KEY=... R28_TEST_PIN=2468 \
   python3 tools/r28_preview_journey.py <base> <out.json>

📌 ⛔ مافيش سر في الملفات ⭐ ⛔ مافيش بيانات عملاء ⭐ (حساب **صناعي** ⭐)
   ⛔ مافيش اتصال بالإنتاج ⭐ (المعاينة معزولة ⭐)
   ⛔ الباسورد مش بيتكتب في الدليل ⭐ — بصمته بس ⭐ (sha256[:12] ⭐).
"""
import hashlib
import io
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE = (sys.argv[1] if len(sys.argv) > 1
        else "https://octa-preview.ahmed3zz2020.workers.dev")
OUT = (sys.argv[2] if len(sys.argv) > 2 else "/tmp/r28-preview-journey.json")
PREVIEW_KEY = os.environ.get("PREVIEW_CONSOLE_KEY", "")
PIN = os.environ.get("R28_TEST_PIN", "2468")
RESULTS = []


def ok(cond, label, extra=""):
    RESULTS.append((bool(cond), label))
    print(("  [PASS] " if cond else "  [FAIL] ") + label +
          (("  — " + str(extra)) if extra else ""), flush=True)
    return bool(cond)


def call(path, method="GET", body=None, cookie=None, origin=None, extra_headers=None):
    url = BASE + path
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    # ⛔ User-Agent متصنع ⭐ — البوابة بترفض العملات غير المتصنعة ⭐
    headers = {"Accept": "application/json",
               "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) octa-preview-journey"}
    if data is not None:
        headers["Content-Type"] = "application/json; charset=utf-8"
    if cookie:
        headers["Cookie"] = cookie
    if origin:
        headers["Origin"] = origin
    # ⛔ ⛔ الظل ⭐ — كان الـparam باسم نفس الـdict المحلي ⭐
    #   ⇒ الترويسة الإضافية (Authorization ⭐) ما كانتش بتتبعت ⭐ أصلاً ⭐.
    for k, v in (extra_headers or {}).items():
        headers[k] = v
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
    print("== R28 · رحلة المعاينة الحقيقية ==")
    print("   %s" % BASE)
    if not PREVIEW_KEY:
        print("⛔ PREVIEW_CONSOLE_KEY مطلوب ⭐ (صندوق المعاينة ⭐)")
        return 2
    print()

    email = "r28.journey.%s@example.test" % uuid.uuid4().hex[:8]
    device = "dev-%s" % uuid.uuid4().hex
    evidence = {"base": BASE, "email": email, "at": None,
                "pin_fingerprint": hashlib.sha256(PIN.encode()).hexdigest()[:12],
                "steps": []}

    def step(name, rec):
        evidence["steps"].append({"step": name, "status": rec["status"],
                                   "head": rec["raw"][:220]})
        print("  %-46s ⇒ %s" % (name, rec["status"]), flush=True)

    # ① الفحص
    h = call("/api/health")
    ok(h["status"] == 200 and (h["json"] or {}).get("ok"),
       "① /api/health ⇒ 200 وجسم صالح", h["status"])
    ok((h["json"] or {}).get("source") == "preview-isolated",
       "①ب المعاينة معزولة", (h["json"] or {}).get("source"))
    step("health", h)

    # ② التسجيل
    s = call("/api/auth/signup/start", "POST",
             {"name": "رحلة R28", "email": email}, origin=BASE)
    ok(s["status"] == 200, "② signup/start ⇒ 200", s["status"])
    ok(not (s["json"] or {}).get("preview_code"),
       "②ب الكود **مش** في رد التسجيل ⭐ (استحواذ متجدد ⭐)",
       (s["json"] or {}).get("preview_code"))
    step("signup_start", s)

    # ③ صندوق المعاينة ⭐ (المفتاح من متغيّر بيئة ⭐)
    code = ""
    raw = ""
    req = urllib.request.Request(
        BASE + "/api/preview/mailbox?email=" + urllib.parse.quote(email),
        headers={"X-Preview-Key": PREVIEW_KEY, "Accept": "application/json",
                 "User-Agent": "Mozilla/5.0 octa-preview-journey"})
    try:
        res = urllib.request.urlopen(req, timeout=30)
        raw = res.read().decode("utf-8", "replace")
        code = str((json.loads(raw) or {}).get("code") or "")
    except Exception as e:
        raw = str(e)
    ok(bool(code), "③ صندوق المعاينة ⇒ الكود وصل ⭐", bool(code))
    step("mailbox", {"status": 200 if code else 0, "json": None, "raw": raw[:200]})

    # ④ تأكيد الكود
    v = call("/api/auth/signup/verify", "POST",
             {"email": email, "code": code}, origin=BASE)
    unlock = str((v["json"] or {}).get("unlock") or "")
    ok(v["status"] == 200 and (v["json"] or {}).get("needs_pin"),
       "④ signup/verify ⇒ محتاج باسورد", v["status"])
    ok(bool(unlock), "④ب توكن الفتح وصل ⭐ (عقد الإنتاج ⭐)", bool(unlock))
    step("signup_verify", v)

    # ⑤ اختيار الأرقام ⭐ (عقد الإنتاج ⭐: {new_pin} + Bearer unlock ⭐)
    n = call("/api/auth/signup/newpin", "POST",
             {"new_pin": PIN, "device": device}, origin=BASE,
             extra_headers={"Authorization": "Bearer " + unlock})
    ok(n["status"] == 200, "⑤ signup/newpin ⇒ 200", n["status"])
    step("signup_newpin", n)

    # ⑤ب ⛔ من غير توكن فتح ⇒ ⛔ 401 ⭐ (fail-closed ⭐)
    nn = call("/api/auth/signup/newpin", "POST",
              {"new_pin": PIN, "device": device}, origin=BASE)
    ok(nn["status"] == 401, "⑤ب من غير توكن الفتح ⇒ 401 ⭐", nn["status"])
    step("signup_newpin_without_unlock", nn)

    # ⑥ الدخول بنفس الجهاز
    li = call("/api/auth/pin/login", "POST",
              {"pin": PIN, "device": device}, origin=BASE)
    ok(li["status"] == 200 and (li["json"] or {}).get("token"),
       "⑥ pin/login ⇒ 200 + توكن", li["status"])
    ck = li["cookie"]
    step("pin_login", li)

    # ⑦ جلسة
    me = call("/api/auth/me", "GET", cookie=ck, origin=BASE)
    ok(me["status"] == 200, "⑦ /api/auth/me ⇒ 200", me["status"])
    step("me", me)

    # ⑧ تنبيهات (إضافة + الحالة ⭐ — حالة التنبيهات كانت 501 ⭐)
    al = call("/api/alerts", "POST",
              {"symbol": "COMI.CA", "kind": "price", "price": 100.0}, cookie=ck, origin=BASE)
    ok(al["status"] == 200, "⑧ إضافة تنبيه ⇒ 200", al["status"])
    st = call("/api/alerts/state", "GET", cookie=ck, origin=BASE)
    ok(st["status"] == 200 and (st["json"] or {}).get("state") is not None,
       "⑧ب /api/alerts/state ⇒ 200 + حالة ⭐", st["status"])
    step("alerts_add", al)
    step("alerts_state", st)

    # ⑨ محفظة
    pf = call("/api/portfolio", "POST",
              {"cash": 1234, "positions": {"COMI.CA": 5}}, cookie=ck, origin=BASE)
    ok(pf["status"] == 200, "⑨ كتابة المحفظة ⇒ 200", pf["status"])
    pr = call("/api/portfolio", "GET", cookie=ck, origin=BASE)
    ok(pr["status"] == 200 and ((pr["json"] or {}).get("portfolio") or {}).get("cash") == 1234,
       "⑨ب قراءة المحفظة ⇒ 200 + الكاش", pr["status"])
    step("portfolio_write", pf)
    step("portfolio_read", pr)

    # ⑩ الخروج + إبطال فوري
    lo = call("/api/auth/logout", "POST", {}, cookie=ck, origin=BASE)
    ok(lo["status"] == 200, "⑩ logout ⇒ 200", lo["status"])
    after = call("/api/auth/me", "GET", cookie=ck, origin=BASE)
    ok(after["status"] == 401, "⑩ب /me بعد الخروج ⇒ 401 (إبطال فوري ⭐)", after["status"])
    step("logout", lo)
    step("me_after_logout", after)

    # ⑪ CSRF
    cs = call("/api/auth/logout", "POST", {}, cookie=ck, origin="https://evil.example")
    ok(cs["status"] == 403, "⑪ طلب من أصل خارجي اترفض (CSRF)", cs["status"])
    step("csrf_logout", cs)

    # ⑫ ملاحظة ⭐ (مش فحص ⭐): المفتاح جاي من متغيّر بيئة ⭐
    #    ⇒ مافيش سر في المستودع ولا في الدليل ⭐
    print("  ⓘ المفتاح من متغيّر بيئة ⭐ — مافيش سر في المستودع ⭐")

    passed = sum(1 for r in RESULTS if r[0])
    failed = len(RESULTS) - passed
    evidence["passed"] = passed
    evidence["failed"] = failed
    evidence["total"] = len(RESULTS)
    evidence["checks"] = [{"ok": o, "label": l} for o, l in RESULTS]
    evidence["device"] = device
    try:
        with io.open(OUT, "w", encoding="utf-8") as fh:
            fh.write(json.dumps(evidence, ensure_ascii=False, indent=2))
        print("📄 %s" % OUT)
    except Exception as e:
        print("⛔ تعذّر كتابة الدليل: %s" % e)
    print()
    print("RESULT: %d/%d PASS · %d FAIL" % (passed, len(RESULTS), failed))
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
