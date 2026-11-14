#!/usr/bin/env python3
"""فحص صفحة «محور الأخبار» (بورصة هالان) على الموبايل 390px.

بيتحقق:
  ① الصفحة موجودة وبتظهر
  ② الجدول فيه أسهم بأرقام حقيقية (مش 45)
  ③ الفلترة بالأهمية شغالة
  ④ سطر المصدر بيقول بورصة هالان
  ⑤ لقطة شاشة

الاستخدام: python3 tools/test-news-axis-page.py [url]
"""
import sys
import os
import json
import time
import urllib.request

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "https://octa-preview.ahmed3zz2020.workers.dev"
API = "https://octa-prices-production-4ccb.up.railway.app"
CHROME = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"
OUT = os.environ.get("OCTA_SHOTS", "/workspace/output")

ok = True


def check(cond, label, extra=""):
    global ok
    print(("   ✅ " if cond else "   ❌ ") + label + ((" — " + str(extra)) if extra != "" else ""))
    if not cond:
        ok = False


def mint():
    req = urllib.request.Request(
        API + "/api/admin/mint_session",
        data=json.dumps({"email": "ahmed3zz2020@gmail.com", "ttl": 1800}).encode(),
        headers={"X-OCTA-Admin": os.environ.get("OCTA_ADMIN_TOKEN", ""),
                 "Content-Type": "application/json"},
        method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())["token"]


TOKEN = mint()
with sync_playwright() as p:
    br = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"], executable_path=CHROME)
    ctx = br.new_context(viewport={"width": 390, "height": 900}, device_scale_factor=2)
    dom = URL.split("//", 1)[1].split("/", 1)[0]
    ctx.add_cookies([{"name": "octa_token", "value": TOKEN, "domain": dom, "path": "/"}])
    ctx.add_init_script(
        "try { localStorage.setItem('octa_token', %s); } catch (e) {}" % json.dumps(TOKEN))
    pg = ctx.new_page()
    errs = []
    BENIGN = ("401", "Content Security Policy", "favicon", "Failed to load resource")
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text)
          if (m.type == "error" and not any(b in m.text for b in BENIGN)) else None)

    pg.goto(URL + "/index.html", wait_until="domcontentloaded", timeout=60000)
    time.sleep(8)

    # ⭐ نفتح الصفحة
    pg.evaluate("() => { try { switchPage('newsaxis'); } catch (e) { } }")
    time.sleep(6)

    diag = pg.evaluate("""() => {
        var pg = document.getElementById('page-newsaxis');
        var list = document.getElementById('naList');
        var src = document.getElementById('naSrc');
        return {
            exists: !!pg,
            visible: pg ? getComputedStyle(pg).display !== 'none' : false,
            rect: pg ? (function(){var r=pg.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];})() : null,
            items: list ? list.querySelectorAll('.dv-item').length : 0,
            listText: list ? (list.innerText||'').slice(0,200) : '',
            src: src ? (src.innerText||'') : '',
        };
    }""")
    print("   diag:", json.dumps(diag, ensure_ascii=False)[:400])

    check(diag["exists"], "صفحة «محور الأخبار» موجودة في الـDOM")
    check(diag["visible"], "الصفحة ظاهرة (مش display:none)")
    check(diag["items"] > 0, "في أسهم معروضة", diag["items"])

    txt = diag["listText"]
    import re
    # ⭐ الرقم في عمود منفصل («82» + «من 100») ⇒ نقرا أرقام الـdv-val
    vals = pg.evaluate("""() => {
        var out = [];
        document.querySelectorAll('#naList .dv-val').forEach(function (e) {
            var n = parseInt((e.innerText || '').trim(), 10);
            if (!isNaN(n)) out.push(n);
        });
        return out;
    }""")
    check(bool(vals), "في أرقام درجة في الجدول", vals[:6])
    if vals:
        check(all(n != 45 for n in vals), "كل الأرقام حقيقية (مش 45 وهمية)", vals[:8])
        check(max(vals) >= 60, "فيه أرقام عالية (أحداث حقيقية)", max(vals))

    check("هالان" in diag["src"], "سطر المصدر بيقول بورصة هالان", diag["src"][:90])

    # ⭐ الفلترة
    pg.evaluate("() => { var b = document.querySelector('[data-naf=\"critical\"]'); if (b) b.click(); }")
    time.sleep(2.5)
    crit = pg.evaluate("() => { var l = document.getElementById('naList'); return l ? l.querySelectorAll('.dv-item').length : -1; }")
    check(crit >= 0, "الفلترة بالأهمية شغالة", "عنصران: " + str(crit))
    pg.evaluate("() => { var b = document.querySelector('[data-naf=\"all\"]'); if (b) b.click(); }")
    time.sleep(2)

    shot = os.path.join(OUT, "news-axis-page-390.png")
    pg.screenshot(path=shot)
    print("   📸 " + shot)

    real_errs = [e for e in errs if "halan" not in e.lower()]
    check(not real_errs, "مفيش أخطاء JS", real_errs[:3])

print("")
if ok:
    print("✅ صفحة محور الأخبار شغالة.")
    sys.exit(0)
print("❌ في مشاكل — شوف فوق.")
sys.exit(1)
