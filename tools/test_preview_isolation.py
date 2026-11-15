#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Preview isolation - real browser test (390px).

Scenario A: the preview as deployed
  => zero requests to the Railway production API, page renders, no JS errors.

Scenario B: the preview with the staging list removed + fail-closed forced
  => the frontend must NOT fall back to production (this is the regression
     proof for the octa-api.js direct-connection hole found in the review).

Run:  python3 tools/test_preview_isolation.py
"""
import sys
import time

from playwright.sync_api import sync_playwright

PREVIEW = "https://octa-preview.ahmed3zz2020.workers.dev"
PROD_API = "octa-prices-production-4ccb.up.railway.app"
CHROME = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"

results = []


def scenario(page, name, init_script=None):
    reqs = []
    errors = []
    page.on("request", lambda r: reqs.append(r.url))
    page.on("pageerror", lambda e: errors.append(str(e)))
    if init_script:
        page.add_init_script(init_script)
    page.goto(PREVIEW + "/?t=" + str(int(time.time() * 1000)),
              wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(9000)
    prod = [u for u in reqs if PROD_API in u]
    return {
        "name": name,
        "requests": len(reqs),
        "prod_requests": prod,
        "errors": errors,
        "has_list": page.evaluate("() => !!(window.OCTA_DIRECT_LIST && window.OCTA_DIRECT_LIST.length)"),
        "direct": page.evaluate("() => String(window.OCTA_DIRECT || '')"),
        "fail_closed": page.evaluate("() => !!window.OCTA_FAIL_CLOSED"),
        "body_len": int(page.evaluate("() => document.body ? document.body.innerText.length : 0") or 0),
    }


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844},
                              user_agent="Mozilla/5.0 (Linux; Android 12) octa-isolation-test",
                              is_mobile=True, has_touch=True)
    page = ctx.new_page()

    # ---------------- Scenario A: as deployed ----------------
    a = scenario(page, "A: as deployed")
    results.append(("A1 · مافيش أي طلب للإنتاج", len(a["prod_requests"]) == 0,
                    "%d طلب / %d للإنتاج" % (a["requests"], len(a["prod_requests"]))))
    results.append(("A2 · مافيش أخطاء JavaScript", len(a["errors"]) == 0,
                    "; ".join(a["errors"])[:160]))
    results.append(("A3 · الصفحة فيها محتوى", a["body_len"] > 200,
                    "حروف=%d" % a["body_len"]))
    results.append(("A4 · العلامة مفعّلة والقائمة محقونة",
                    a["fail_closed"] and a["has_list"],
                    "fc=%s list=%s direct=%s" % (a["fail_closed"], a["has_list"], a["direct"])))

    # ---------------- Scenario B: no staging list ----------------
    ctx2 = browser.new_context(viewport={"width": 390, "height": 844},
                               user_agent="Mozilla/5.0 (Linux; Android 12) octa-isolation-test",
                               is_mobile=True, has_touch=True)
    page2 = ctx2.new_page()
    b = scenario(page2, "B: no staging list",
                 init_script="try { window.OCTA_DIRECT_LIST = []; } catch (e) { }")
    results.append(("B1 · من غير قائمة ⇒ صفر طلبات للإنتاج",
                    len(b["prod_requests"]) == 0,
                    "%d طلب / %d للإنتاج" % (b["requests"], len(b["prod_requests"]))))
    results.append(("B2 · السيرفر المباشر فاضي (مافيش اتصال احتياطي)",
                    b["direct"] == "",
                    "direct=%s" % b["direct"]))

    browser.close()

print("=" * 72)
for name, passed, detail in results:
    print(("PASS " if passed else "FAIL ") + name + "  [" + detail + "]")
fails = [r for r in results if not r[1]]
print("=" * 72)
print("RESULT:", "ALL PASS" if not fails else ("%d FAILED" % len(fails)))
sys.exit(0 if not fails else 1)
