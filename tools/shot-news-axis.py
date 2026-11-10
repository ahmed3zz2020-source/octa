#!/usr/bin/env python3
"""لقطة قسم «الأخبار والمحفزات» في كارت القرار (390px).

📌 بتستخدم نفس جلسة الأدمن (mint_session) وبتفتح الكارت زي المستخدم.
📌 بتحفظ لقطة القسم نفسه (مش الصفحة) ⇒ واضح إن الرقم ظاهر.

الاستخدام: python3 tools/shot-news-axis.py [code] [url]
"""
import sys
import os
import json
import time
import urllib.request

from playwright.sync_api import sync_playwright

CODE = sys.argv[1] if len(sys.argv) > 1 else "ETEL"
URL = sys.argv[2] if len(sys.argv) > 2 else "https://octa-preview.ahmed3zz2020.workers.dev"
API = "https://octa-prices-production-4ccb.up.railway.app"
CHROME = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"
OUT = os.environ.get("OCTA_SHOTS", "/workspace/output")


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
    pg.goto(URL + "/index.html", wait_until="domcontentloaded", timeout=60000)
    time.sleep(8)

    pg.evaluate("(c) => { try { openCard(c, null, 'egx'); } catch (e) { } }", CODE)
    for _ in range(30):
        time.sleep(1)
        txt = pg.evaluate(
            "() => { var b = document.getElementById('mBody'); return b ? b.innerText : ''; }")
        if "الأخبار والمحفزات" in txt:
            break

    # 📌 نحدّد القسم بالظبط ونمرّر ليه (هو تحت الشاشة)
    box = pg.evaluate("""() => {
        var secs = document.querySelectorAll('#mBody .mcard');
        for (var i = 0; i < secs.length; i++) {
            if ((secs[i].innerText || '').indexOf('الأخبار والمحفزات') >= 0) {
                secs[i].scrollIntoView({block: 'center'});
                return true;
            }
        }
        return false;
    }""")
    time.sleep(1.5)

    box = pg.evaluate("""() => {
        var secs = document.querySelectorAll('#mBody .mcard');
        for (var i = 0; i < secs.length; i++) {
            if ((secs[i].innerText || '').indexOf('الأخبار والمحفزات') >= 0) {
                var r = secs[i].getBoundingClientRect();
                return {x: r.x, y: r.y, w: r.width, h: r.height};
            }
        }
        return null;
    }""")
    print("box:", box)
    if not box or box["h"] < 10:
        print("❌ ما لقيتش القسم")
        sys.exit(1)

    shot = os.path.join(OUT, "news-axis-card-%s-390.png" % CODE)
    pg.screenshot(path=shot, clip={"x": max(0, box["x"] - 6), "y": max(0, box["y"] - 6),
                                    "width": min(box["w"] + 12, 390),
                                    "height": min(box["h"] + 12, 900 - max(0, box["y"] - 6))})
    print("📸", shot)

    # 📸 ولقطة كاملة للمودال (الكارت كله)
    shot2 = os.path.join(OUT, "news-axis-modal-%s-390.png" % CODE)
    pg.screenshot(path=shot2)
    print("📸", shot2)
